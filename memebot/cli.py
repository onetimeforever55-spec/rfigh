"""Command line interface.

    memebot scan       screen the market and print the ranking, trade nothing
    memebot run        start the trading loop
    memebot positions  show open positions and PnL
    memebot report     show closed trades and overall performance
    memebot panic      sell every open position immediately
    memebot wallet     check which wallet the bot would trade with
    memebot dataset    label what was recorded and report the base rates
    memebot fit        fit the probability model and report its honesty
    memebot backtest   replay the recorded history through a decision rule
    memebot dashboard  serve the read-only phone dashboard
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import secrets
import signal
import sys

from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from .config import Config, ConfigError, load_config
from .datasources.jupiter import Jupiter
from .datasources.solana_rpc import SolanaRPC
from .engine import TradingEngine
from .http import HttpClient
from .logging_setup import setup_logging
from .model import ModelError, ProbabilityModel, expected_value_pct, fit
from .models import PositionStatus, Side
from .observations import build_dataset
from .storage import Storage

log = logging.getLogger(__name__)
console = Console()


def _fmt_usd(value: float) -> str:
    return f"${value:,.2f}"


def _pnl_style(value: float) -> str:
    return "green" if value > 0 else "red" if value < 0 else "white"


async def cmd_scan(cfg: Config, args: argparse.Namespace) -> int:
    engine = TradingEngine(cfg)
    await engine.start()
    try:
        report = await engine.scan()
    finally:
        await engine.close()

    console.print(
        f"\n[bold]Scanned {report.scanned} pairs — "
        f"{report.passed_screen} passed safety screening[/bold]\n"
    )

    if report.signals:
        table = Table(title="Ranked candidates", header_style="bold cyan")
        table.add_column("Symbol")
        table.add_column("Score", justify="right")
        table.add_column("Buy?", justify="center")
        table.add_column("Momentum", justify="right")
        table.add_column("Buy press.", justify="right")
        table.add_column("Volume", justify="right")
        table.add_column("Note", overflow="fold")
        for signal in report.signals[: args.limit]:
            c = signal.components
            table.add_row(
                signal.symbol,
                f"{signal.score:.1f}",
                "[green]YES[/green]" if signal.should_buy else "[dim]no[/dim]",
                f"{c.get('momentum', 0):.2f}",
                f"{c.get('buy_pressure', 0):.2f}",
                f"{c.get('volume', 0):.2f}",
                signal.reasons[0] if signal.reasons else "entry conditions met",
            )
        console.print(table)
    else:
        console.print("[yellow]No candidate passed the safety screen.[/yellow]")

    if report.rejected:
        # Which gate is actually doing the blocking. Without this, tuning the
        # config is guesswork: you loosen a filter that was never the problem.
        table = Table(title="Rejections by gate", header_style="bold yellow")
        table.add_column("Gate")
        table.add_column("Rejected", justify="right")
        for code, count in report.rejections_by_gate()[:10]:
            table.add_row(code, str(count))
        console.print(table)

        near = report.near_misses()
        if near:
            console.print(
                f"[dim]{len(near)} token(s) failed exactly one gate — "
                "loosening it would let them through:[/dim]"
            )
            for rejection in near[:5]:
                console.print(f"  [dim]{rejection.symbol}: {rejection.reason}[/dim]")

    if args.show_rejected and report.rejected:
        table = Table(title="Rejected", header_style="bold red")
        table.add_column("Symbol")
        table.add_column("Reasons", overflow="fold")
        for rejection in report.rejected[: args.limit]:
            table.add_row(rejection.symbol, "; ".join(rejection.reasons))
        console.print(table)

    return 0


async def cmd_run(cfg: Config, args: argparse.Namespace) -> int:
    if cfg.execution.mode == "live" and not args.yes_really_trade_live:
        console.print(
            "[bold red]Refusing to start.[/bold red] execution.mode is 'live', which "
            "spends real funds.\nRe-run with [bold]--yes-really-trade-live[/bold] "
            "once you have tested in paper mode."
        )
        return 2

    engine = TradingEngine(cfg)
    loop = asyncio.get_running_loop()
    task = asyncio.ensure_future(engine.run())

    def request_stop() -> None:
        console.print("\n[yellow]Shutting down — finishing the current cycle…[/yellow]")
        engine.stop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_stop)
        except NotImplementedError:  # pragma: no cover - Windows
            pass

    try:
        await task
    finally:
        await engine.close()
    return 0


async def cmd_wallet(cfg: Config, args: argparse.Namespace) -> int:
    """Verify wallet access without trading: derive the address, read balances."""
    from .config import SOL_MINT

    if not cfg.secrets.wallet_private_key:
        console.print(
            "[bold red]No wallet configured.[/bold red]\n"
            "Set WALLET_PRIVATE_KEY in your .env file — see .env.example."
        )
        return 2

    try:
        from .execution.solana import _load_keypair
    except Exception as exc:  # noqa: BLE001
        console.print(f"[bold red]{exc}[/bold red]")
        return 2

    try:
        keypair = _load_keypair(cfg.secrets.wallet_private_key)
    except Exception as exc:  # noqa: BLE001
        console.print(
            f"[bold red]Could not read the private key:[/bold red] {exc}\n"
            "Expected a base58 string (Phantom export) or a JSON byte array."
        )
        return 2

    pubkey = str(keypair.pubkey())
    console.print(f"\nWallet address : [bold]{pubkey}[/bold]")

    http = HttpClient()
    rpc = SolanaRPC(http, cfg.secrets.solana_rpc_url)
    jupiter = Jupiter(http, cfg.secrets.jupiter_api_key)
    try:
        sol = await rpc.get_sol_balance(pubkey)
        console.print(f"RPC endpoint   : {cfg.secrets.solana_rpc_url}")
        console.print(f"SOL balance    : [bold]{sol:.4f} SOL[/bold]")
        try:
            price = (await jupiter.price_usd([SOL_MINT])).get(SOL_MINT, 0.0)
            if price:
                console.print(f"Value          : {_fmt_usd(sol * price)}")
        except Exception:  # noqa: BLE001 - the balance is the point, not the price
            pass

        size = cfg.risk.position_size_usd
        console.print(
            f"\nMode           : [bold]{cfg.execution.mode}[/bold]"
            + ("  [dim](no real funds are spent)[/dim]"
               if cfg.execution.mode == "paper" else "")
        )
        if sol < 0.02:
            console.print(
                "[yellow]Balance is below the 0.02 SOL fee buffer — the bot "
                "would not be able to trade.[/yellow]"
            )
        else:
            console.print(
                f"Position size  : {_fmt_usd(size)} per trade, "
                f"max {cfg.risk.max_open_positions} open"
            )
    except Exception as exc:  # noqa: BLE001
        console.print(f"[bold red]Could not reach the RPC:[/bold red] {exc}")
        return 1
    finally:
        await http.close()
    return 0


async def cmd_panic(cfg: Config, args: argparse.Namespace) -> int:
    engine = TradingEngine(cfg)
    await engine.start()
    try:
        count = engine.portfolio.open_count
        if not count:
            console.print("No open positions.")
            return 0
        if not args.force:
            console.print(
                f"[bold yellow]About to market-sell {count} position(s) "
                f"in {cfg.execution.mode} mode.[/bold yellow]"
            )
            if input("Type 'sell' to confirm: ").strip().lower() != "sell":
                console.print("Aborted.")
                return 1
        sold = await engine.liquidate_all()
        console.print(f"[bold]Liquidated {sold}/{count} position(s).[/bold]")
    finally:
        await engine.close()
    return 0


def cmd_positions(cfg: Config, args: argparse.Namespace) -> int:
    storage = Storage(cfg.database_path)
    try:
        positions = storage.load_open_positions()
        if not positions:
            console.print("No open positions.")
            return 0

        table = Table(title="Open positions", header_style="bold cyan")
        for column in ("Symbol", "Qty", "Entry", "Last", "PnL %", "PnL $", "Age", "Left"):
            table.add_column(column, justify="right" if column != "Symbol" else "left")

        total = 0.0
        for p in positions:
            price = p.last_price_usd or p.entry_price_usd
            pnl = p.unrealized_pnl_usd(price) + p.realized_pnl_usd
            total += pnl
            table.add_row(
                p.symbol,
                f"{p.qty:,.2f}",
                f"${p.avg_entry_price:.8f}",
                f"${price:.8f}",
                f"[{_pnl_style(pnl)}]{p.pnl_pct(price):+.1f}%[/]",
                f"[{_pnl_style(pnl)}]{pnl:+,.2f}[/]",
                f"{p.age_minutes:.0f}m",
                f"{p.remaining_fraction:.0%}",
            )
        console.print(table)
        console.print(f"Total open PnL: [{_pnl_style(total)}]{total:+,.2f} USD[/]")
        return 0
    finally:
        storage.close()


def cmd_report(cfg: Config, args: argparse.Namespace) -> int:
    storage = Storage(cfg.database_path)
    try:
        closed = storage.load_closed_positions(args.limit)
        trades = storage.load_trades(1_000)

        if not trades:
            console.print("No trades recorded yet.")
            return 0

        table = Table(title=f"Last {len(closed)} closed positions", header_style="bold cyan")
        for column in ("Symbol", "Cost", "Realised", "Return", "Held", "Reason"):
            table.add_column(column, justify="right" if column != "Symbol" else "left")
        for p in closed:
            ret = p.realized_pnl_usd / p.cost_usd * 100 if p.cost_usd else 0.0
            table.add_row(
                p.symbol,
                _fmt_usd(p.cost_usd),
                f"[{_pnl_style(p.realized_pnl_usd)}]{p.realized_pnl_usd:+,.2f}[/]",
                f"[{_pnl_style(ret)}]{ret:+.1f}%[/]",
                f"{p.age_minutes:.0f}m",
                p.close_reason,
            )
        console.print(table)

        wins = [p for p in closed if p.realized_pnl_usd > 0]
        losses = [p for p in closed if p.realized_pnl_usd <= 0]
        realized = sum(p.realized_pnl_usd for p in closed)
        fees = sum(t.fee_usd for t in trades)
        gross_win = sum(p.realized_pnl_usd for p in wins)
        gross_loss = abs(sum(p.realized_pnl_usd for p in losses))

        console.print()
        console.print(f"Closed positions : {len(closed)}")
        if closed:
            rate = len(wins) / len(closed) * 100
            console.print(f"Win rate         : {rate:.1f}% ({len(wins)}W / {len(losses)}L)")
        console.print(f"Realised PnL     : [{_pnl_style(realized)}]{realized:+,.2f} USD[/]")
        console.print(f"Fees paid        : {_fmt_usd(fees)}")
        if gross_loss > 0:
            console.print(f"Profit factor    : {gross_win / gross_loss:.2f}")
        if wins:
            console.print(f"Average win      : {gross_win / len(wins):+,.2f} USD")
        if losses:
            console.print(f"Average loss     : {-gross_loss / len(losses):+,.2f} USD")
        console.print(f"Buys / sells     : "
                      f"{sum(1 for t in trades if t.side is Side.BUY)} / "
                      f"{sum(1 for t in trades if t.side is Side.SELL)}")
        return 0
    finally:
        storage.close()




# --- probability -------------------------------------------------------
def _dataset_for(cfg: Config, args: argparse.Namespace):
    """Build the labelled dataset, and print what it is made of."""
    p = cfg.probability
    storage = Storage(cfg.database_path)
    try:
        stats = storage.observation_stats()
        if not stats["rows"]:
            console.print(
                "[yellow]No observations recorded yet.[/yellow]\n"
                "Run the bot (paper mode is enough) with "
                "[bold]probability.record: true[/bold] and come back once it has "
                "watched the market for a while."
            )
            return None, None

        hours = (stats["last_ms"] - stats["first_ms"]) / 3_600_000
        console.print(
            f"\n[bold]{stats['rows']:,} observations[/bold] of "
            f"{stats['mints']:,} token(s) over {hours:.1f}h"
        )

        dataset = build_dataset(
            storage,
            take_profit_pct=p.take_profit_pct,
            stop_loss_pct=p.stop_loss_pct,
            horizon_minutes=p.horizon_minutes,
            max_gap_minutes=p.max_gap_minutes,
            screened_only=getattr(args, "screened_only", False),
        )
    finally:
        storage.close()

    console.print(
        f"Labelled for: reach [green]{p.take_profit_pct:+.0f}%[/green] before "
        f"[red]{p.stop_loss_pct:+.0f}%[/red], within {p.horizon_minutes:.0f}m\n"
    )

    table = Table(header_style="bold cyan", show_header=False)
    table.add_column("")
    table.add_column("", justify="right")
    table.add_row("Labelled examples", f"{len(dataset):,}")
    table.add_row("Winners", f"{dataset.positives:,}")
    table.add_row(
        "[bold]Base rate[/bold]", f"[bold]{dataset.base_rate:.1%}[/bold]"
    )
    table.add_row("Unresolved (censored)", f"{dataset.censored:,}")
    table.add_row("Unusable rows", f"{dataset.skipped:,}")
    table.add_row("Span", f"{dataset.span_hours:.1f}h")
    console.print(table)

    total = len(dataset) + dataset.censored
    if total and dataset.censored / total > 0.5:
        console.print(
            f"\n[yellow]{dataset.censored / total:.0%} of decision points never "
            "resolved[/yellow] — the token stopped appearing before the horizon "
            "closed. What is left describes tokens that stayed visible, which is "
            "a narrower thing than 'all tokens'."
        )

    return dataset, p


def cmd_dataset(cfg: Config, args: argparse.Namespace) -> int:
    dataset, p = _dataset_for(cfg, args)
    if dataset is None:
        return 1

    if not dataset.examples:
        console.print("[yellow]Nothing resolved yet — record for longer.[/yellow]")
        return 1

    # The base rate is the number to beat. Spelling out what it implies stops
    # a 12% win rate from looking like a disaster when the payoff is 3:1.
    ev = expected_value_pct(
        dataset.base_rate, p.take_profit_pct, p.stop_loss_pct, p.round_trip_cost_pct
    )
    verdict = "[green]positive[/green]" if ev > 0 else "[red]negative[/red]"
    console.print(
        f"\nBuying [bold]blindly[/bold] at this base rate returns {ev:+.2f}% per "
        f"trade after {p.round_trip_cost_pct:.1f}% costs — {verdict}.\n"
        "A model only earns its place by beating that."
    )

    passed = [e for e in dataset.examples if e.passed_screen]
    if passed and len(passed) != len(dataset.examples):
        rate = sum(e.y for e in passed) / len(passed)
        console.print(
            f"\nAmong the {len(passed):,} that passed the screen, the win rate is "
            f"[bold]{rate:.1%}[/bold] vs {dataset.base_rate:.1%} overall — "
            + ("the screen is helping." if rate > dataset.base_rate
               else "[yellow]the screen is not helping.[/yellow]")
        )
    return 0


def _print_metrics(title: str, metrics: dict) -> None:
    if not metrics or not metrics.get("n"):
        return
    console.print(
        f"\n[bold]{title}[/bold]  n={metrics['n']:,}  "
        f"base={metrics['base_rate']:.1%}  "
        f"AUC={metrics['auc']:.3f}  Brier={metrics['brier']:.4f}  "
        f"skill={metrics['brier_skill']:+.3f}"
    )


def cmd_fit(cfg: Config, args: argparse.Namespace) -> int:
    dataset, p = _dataset_for(cfg, args)
    if dataset is None:
        return 1

    try:
        model = fit(
            dataset,
            test_fraction=args.test_fraction,
            l2=args.l2,
            epochs=args.epochs,
            min_examples=p.min_train_rows,
        )
    except ModelError as exc:
        console.print(f"\n[bold red]Cannot fit:[/bold red] {exc}")
        return 1

    model.take_profit_pct = p.take_profit_pct
    model.stop_loss_pct = p.stop_loss_pct
    model.horizon_minutes = p.horizon_minutes

    _print_metrics("TRAIN (older slice)", model.train_metrics)
    _print_metrics("TEST  (newer slice)", model.test_metrics)

    test = model.test_metrics
    reliability = test.get("reliability") or []
    if reliability:
        table = Table(
            title="Calibration on held-out data", header_style="bold cyan"
        )
        table.add_column("Predicted")
        table.add_column("n", justify="right")
        table.add_column("Said", justify="right")
        table.add_column("Happened", justify="right")
        for row in reliability:
            table.add_row(
                row["bin"], f"{row['n']:,}",
                f"{row['predicted']:.1%}", f"{row['actual']:.1%}",
            )
        console.print()
        console.print(table)
        console.print(
            "[dim]'Said' and 'Happened' should track each other. Where they "
            "diverge, the probability is not one you can multiply by a "
            "payoff.[/dim]"
        )

    table = Table(title="What the bot now believes", header_style="bold cyan")
    table.add_column("Feature")
    table.add_column("Weight", justify="right")
    table.add_column("Direction")
    for name, weight in model.coefficients():
        table.add_row(
            name, f"{weight:+.3f}",
            "[green]raises[/green]" if weight > 0 else "[red]lowers[/red]",
        )
    console.print()
    console.print(table)
    console.print(
        "[dim]Weights act on standardised features, so they are directly "
        "comparable — unlike the hand-set weights they replace.[/dim]"
    )

    auc = test.get("auc", 0.0)
    if auc < p.min_test_auc:
        console.print(
            f"\n[bold red]Held-out AUC {auc:.3f} is below the configured "
            f"minimum {p.min_test_auc:.3f}.[/bold red]\n"
            "This model has not learnt anything that generalises. It is saved "
            "so you can inspect it, but the bot will refuse to trade on it."
        )
    elif test.get("brier_skill", 0.0) <= 0:
        console.print(
            "\n[yellow]Negative Brier skill: the model is worse than always "
            "predicting the base rate.[/yellow] Do not trade on it."
        )
    else:
        console.print(
            f"\n[green]Held-out AUC {auc:.3f}, "
            f"skill {test.get('brier_skill', 0):+.3f}.[/green] "
            "Better than chance on data it never saw."
        )

    model.save(p.model_path)
    console.print(f"\nSaved to [bold]{p.model_path}[/bold]")
    console.print(
        "Enable it with [bold]probability.enabled: true[/bold]. Run it in paper "
        "mode first — a good backtest and a good live result are different "
        "things."
    )
    return 0


def cmd_backtest(cfg: Config, args: argparse.Namespace) -> int:
    dataset, p = _dataset_for(cfg, args)
    if dataset is None:
        return 1
    if not dataset.examples:
        console.print("[yellow]Nothing resolved yet.[/yellow]")
        return 1

    model = None
    if not args.heuristic:
        try:
            model = ProbabilityModel.load(p.model_path)
        except ModelError as exc:
            console.print(f"[bold red]{exc}[/bold red]")
            return 1

    min_probability = (
        args.min_probability if args.min_probability is not None
        else p.min_probability
    )

    examples = dataset.sorted_by_time()
    if args.test_only:
        split = int(len(examples) * (1.0 - args.test_fraction))
        examples = examples[split:]
        console.print(
            f"[dim]Replaying only the newest {len(examples):,} examples — the "
            "slice the model was not fitted on.[/dim]"
        )

    horizon_ms = p.horizon_minutes * 60_000
    busy_until: dict[str, int] = {}
    taken: list = []

    for e in examples:
        # One position per mint at a time, exactly like the live bot. Without
        # this, a single 3-hour run gets counted as dozens of winning trades
        # and every number below turns into fiction.
        if e.ts_ms < busy_until.get(e.mint, 0):
            continue
        if args.heuristic:
            enter = e.passed_screen and e.score >= cfg.strategy.min_entry_score
        else:
            probability = model.predict(e.x)
            ev = expected_value_pct(
                probability, p.take_profit_pct, p.stop_loss_pct, p.round_trip_cost_pct
            )
            enter = (
                e.passed_screen
                and probability >= min_probability
                and ev >= p.min_expected_value_pct
            )
        if not enter:
            continue
        busy_until[e.mint] = e.ts_ms + int(horizon_ms)
        taken.append(e)

    if not taken:
        console.print("\n[yellow]This rule would not have taken a single trade.[/yellow]")
        return 0

    wins = sum(e.y for e in taken)
    win_rate = wins / len(taken)
    # Each trade pays the take-profit or the stop, which is exactly what the
    # label encodes — no extra assumption smuggled in here.
    per_trade = expected_value_pct(
        win_rate, p.take_profit_pct, p.stop_loss_pct, p.round_trip_cost_pct
    )

    rule = "heuristic score" if args.heuristic else f"P(win) >= {min_probability:.0%}"
    table = Table(title=f"Replay: {rule}", header_style="bold cyan", show_header=False)
    table.add_column("")
    table.add_column("", justify="right")
    table.add_row("Decision points", f"{len(examples):,}")
    table.add_row("Trades taken", f"{len(taken):,}")
    table.add_row("Winners", f"{wins:,}")
    table.add_row("Win rate", f"{win_rate:.1%}")
    table.add_row("Base rate (all)", f"{dataset.base_rate:.1%}")
    table.add_row(
        "Return per trade",
        f"[{'green' if per_trade > 0 else 'red'}]{per_trade:+.2f}%[/]",
    )
    # Deliberately NOT compounded. Chaining these returns would assume the
    # whole account rides on each trade in sequence, which produces a
    # spectacular number that describes nothing: the trades overlap in time
    # and the bot risks a fixed size per position.
    table.add_row(
        "Total at fixed size",
        f"{per_trade / 100 * len(taken):+.1f}x one position",
    )
    console.print()
    console.print(table)

    console.print(
        "\n[yellow]What this replay does NOT model:[/yellow] the price you would "
        "actually have been filled at, partial take-profit rungs, the trailing "
        "stop, position limits, daily loss caps, or the fact that your own buy "
        "moves a thin pool. It is an upper bound on a strategy, not a forecast "
        "of your PnL."
    )
    if len(taken) < 30:
        console.print(
            f"[yellow]{len(taken)} trades is far too few to conclude "
            "anything.[/yellow]"
        )
    return 0


def cmd_dashboard(cfg: Config, args: argparse.Namespace) -> int:
    """Serve the dashboard. Reads the database, never trades."""
    import socket

    from aiohttp import web as aioweb

    from .web import LOOPBACK, make_app

    token = args.token or None      # an unset compose env var arrives as ""
    exposed = args.host not in LOOPBACK
    if exposed and not token:
        # Binding beyond loopback puts the page on the network. Rather than
        # refuse (you asked for the phone) or expose it bare, mint a token —
        # there is no way to end up with an open dashboard by accident.
        token = secrets.token_urlsafe(16)
        console.print(
            "[yellow]Binding beyond localhost, so a token was generated.[/yellow]"
        )

    app = make_app(cfg, token)

    suffix = f"?t={token}" if token else ""
    console.print(f"\n[bold]memebot dashboard[/bold]  ({cfg.execution.mode} mode)")
    console.print(f"Reading [dim]{cfg.database_path}[/dim] — read-only, no wallet access.\n")
    console.print(f"  http://{args.host}:{args.port}/{suffix}")
    if exposed:
        try:
            lan = socket.gethostbyname(socket.gethostname())
            console.print(f"  http://{lan}:{args.port}/{suffix}   [dim]<- desde el móvil[/dim]")
        except OSError:
            pass
        console.print(
            "\n[yellow]Anyone on this network who has the link can read your "
            "positions.[/yellow] It cannot trade, but it is your PnL."
        )
    console.print("\n[dim]Ctrl-C to stop.[/dim]\n")

    aioweb.run_app(
        app, host=args.host, port=args.port, print=None, access_log=None
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="memebot", description="Automated memecoin trading bot for Solana."
    )
    parser.add_argument("-c", "--config", help="path to a YAML config file")
    parser.add_argument("--log-level", help="override the configured log level")
    sub = parser.add_subparsers(dest="command", required=True)

    p_scan = sub.add_parser("scan", help="screen and rank the market, trade nothing")
    p_scan.add_argument("--limit", type=int, default=20, help="rows to display")
    p_scan.add_argument(
        "--show-rejected", action="store_true", help="also list rejected tokens"
    )

    p_run = sub.add_parser("run", help="start the trading loop")
    p_run.add_argument(
        "--yes-really-trade-live",
        action="store_true",
        help="required confirmation when execution.mode is 'live'",
    )

    sub.add_parser("positions", help="show open positions")

    sub.add_parser(
        "wallet", help="show the bot's wallet address and balance, trade nothing"
    )

    p_report = sub.add_parser("report", help="show performance of closed trades")
    p_report.add_argument("--limit", type=int, default=50)

    p_panic = sub.add_parser("panic", help="market-sell every open position")
    p_panic.add_argument("--force", action="store_true", help="skip the confirmation")

    p_dataset = sub.add_parser(
        "dataset", help="label the recorded history and report the base rates"
    )
    p_dataset.add_argument(
        "--screened-only", action="store_true",
        help="only count candidates that passed the screen",
    )

    p_fit = sub.add_parser(
        "fit", help="fit the probability model on the recorded history"
    )
    p_fit.add_argument("--screened-only", action="store_true")
    p_fit.add_argument(
        "--test-fraction", type=float, default=0.25,
        help="newest share of the data held out for evaluation (default 0.25)",
    )
    p_fit.add_argument(
        "--l2", type=float, default=0.01, help="regularisation strength"
    )
    p_fit.add_argument("--epochs", type=int, default=400)

    p_bt = sub.add_parser(
        "backtest", help="replay the recorded history through a decision rule"
    )
    p_bt.add_argument("--screened-only", action="store_true")
    p_bt.add_argument(
        "--heuristic", action="store_true",
        help="replay the hand-set score instead of the model, to compare",
    )
    p_bt.add_argument(
        "--min-probability", type=float, default=None,
        help="entry threshold (defaults to probability.min_probability)",
    )
    p_bt.add_argument(
        "--test-only", action="store_true",
        help="replay only the slice the model was not fitted on",
    )
    p_bt.add_argument("--test-fraction", type=float, default=0.25)

    p_web = sub.add_parser(
        "dashboard", help="serve the read-only phone dashboard"
    )
    p_web.add_argument(
        "--host", default="127.0.0.1",
        help="0.0.0.0 to reach it from your phone on the same network",
    )
    p_web.add_argument("--port", type=int, default=8730)
    p_web.add_argument(
        "--token", default=None,
        help="required when binding beyond localhost; generated if omitted",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    args = build_parser().parse_args(argv)

    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        console.print(f"[bold red]Config error:[/bold red] {exc}")
        return 2

    setup_logging(args.log_level or cfg.log_level, cfg.log_file)

    if args.command == "positions":
        return cmd_positions(cfg, args)
    if args.command == "report":
        return cmd_report(cfg, args)
    # These read the recorded history and never touch the network.
    if args.command == "dataset":
        return cmd_dataset(cfg, args)
    if args.command == "fit":
        return cmd_fit(cfg, args)
    if args.command == "backtest":
        return cmd_backtest(cfg, args)
    # run_app owns the event loop, so this cannot go through asyncio.run below.
    if args.command == "dashboard":
        return cmd_dashboard(cfg, args)

    handlers = {
        "scan": cmd_scan, "run": cmd_run, "panic": cmd_panic, "wallet": cmd_wallet,
    }
    try:
        return asyncio.run(handlers[args.command](cfg, args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
