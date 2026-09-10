"""Command line interface.

    memebot scan       screen the market and print the ranking, trade nothing
    memebot run        start the trading loop
    memebot positions  show open positions and PnL
    memebot report     show closed trades and overall performance
    memebot panic      sell every open position immediately
    memebot wallet     check which wallet the bot would trade with
"""

from __future__ import annotations

import argparse
import asyncio
import logging
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
from .models import PositionStatus, Side
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

    handlers = {
        "scan": cmd_scan, "run": cmd_run, "panic": cmd_panic, "wallet": cmd_wallet,
    }
    try:
        return asyncio.run(handlers[args.command](cfg, args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
