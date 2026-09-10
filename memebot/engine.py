"""The trading loop.

One loop, run at `engine.poll_interval_s`:

    1. Manage open positions  — always, this is where losses are cut.
    2. Discover new candidates — only every `engine.discovery_interval_s`.

Managing positions has priority over finding new ones: if discovery fails or
the API is down, the bot still exits its trades.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from dataclasses import dataclass, field

from .config import Config
from .datasources.dexscreener import DexScreener
from .datasources.pumpfun import PumpFun
from .datasources.rugcheck import RugCheck
from .datasources.solana_rpc import SolanaRPC
from .execution import build_executor
from .execution.base import Executor
from .http import HttpClient
from .models import Position, ScreenResult, Signal, TokenSnapshot
from .notifier import Notifier
from .portfolio import Portfolio
from .risk import RiskManager
from .screener import (
    screen_dev_holdings, screen_market, screen_onchain, screen_pumpfun,
)
from .storage import Storage
from .strategy import evaluate_exit, score_token

log = logging.getLogger(__name__)


@dataclass
class Rejection:
    symbol: str
    reasons: list[str]
    codes: list[str]

    @property
    def reason(self) -> str:
        return self.reasons[0] if self.reasons else ""

    @property
    def near_miss(self) -> bool:
        """Failed exactly one gate — loosening that one would let it through."""
        return len(self.codes) == 1


@dataclass
class CycleReport:
    """What one discovery pass looked at. Used by `scan` and the tests."""

    scanned: int = 0
    passed_screen: int = 0
    signals: list[Signal] = field(default_factory=list)
    rejected: list[Rejection] = field(default_factory=list)

    def rejections_by_gate(self) -> list[tuple[str, int]]:
        """How many candidates each gate rejected, most active gate first.

        A candidate failing several gates counts once per gate: the point is to
        show which filter is doing the blocking, not to partition the tokens.
        """
        counts = Counter(code for r in self.rejected for code in r.codes)
        return counts.most_common()

    def near_misses(self) -> list[Rejection]:
        return [r for r in self.rejected if r.near_miss]


class TradingEngine:
    def __init__(
        self,
        cfg: Config,
        *,
        http: HttpClient | None = None,
        storage: Storage | None = None,
        executor: Executor | None = None,
    ) -> None:
        self.cfg = cfg
        self.http = http or HttpClient()
        self.storage = storage or Storage(cfg.database_path)
        self.dex = DexScreener(self.http, cfg.screener.chain_id)
        self.rugcheck = RugCheck(self.http) if cfg.screener.use_rugcheck else None
        self.pumpfun = (
            PumpFun(self.http) if cfg.pumpfun.enabled and cfg.pumpfun.use_api else None
        )
        self.rpc = SolanaRPC(self.http, cfg.secrets.solana_rpc_url)
        self.executor = executor or build_executor(cfg, self.http, self.dex, cfg.secrets)
        self.portfolio = Portfolio(self.storage, cfg.risk.starting_equity_usd)
        self.risk = RiskManager(cfg.risk)
        self.notifier = Notifier(
            self.http, cfg.secrets.telegram_bot_token, cfg.secrets.telegram_chat_id
        )
        self._running = False
        self._last_discovery = 0.0

    # --- lifecycle -------------------------------------------------------
    async def start(self) -> None:
        await self.http.start()
        await self.executor.start()
        self.risk.roll_day()

    async def close(self) -> None:
        await self.executor.close()
        await self.http.close()
        self.storage.close()

    def stop(self) -> None:
        self._running = False

    async def run(self) -> None:
        """Main loop. Runs until `stop()` is called or the task is cancelled."""
        self._running = True
        await self.start()
        mode = self.cfg.execution.mode.upper()
        log.info(
            "engine started in %s mode | %d open position(s) | poll %.0fs, discovery %.0fs",
            mode, self.portfolio.open_count,
            self.cfg.engine.poll_interval_s, self.cfg.engine.discovery_interval_s,
        )
        await self.notifier.send(f"🤖 memebot started in <b>{mode}</b> mode")

        try:
            while self._running:
                cycle_start = time.monotonic()
                try:
                    await self.manage_positions()

                    due = (
                        time.monotonic() - self._last_discovery
                        >= self.cfg.engine.discovery_interval_s
                    )
                    if due:
                        self._last_discovery = time.monotonic()
                        report = await self.discover_and_trade()
                        log.debug(
                            "discovery: %d scanned, %d passed screening",
                            report.scanned, report.passed_screen,
                        )
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - one bad cycle must not kill the bot
                    log.exception("cycle failed; continuing")

                elapsed = time.monotonic() - cycle_start
                await asyncio.sleep(max(0.0, self.cfg.engine.poll_interval_s - elapsed))
        except asyncio.CancelledError:
            log.info("engine cancelled")
        finally:
            self._running = False
            await self.notifier.send("🛑 memebot stopped")
            log.info("engine stopped")

    # --- position management --------------------------------------------
    async def manage_positions(self) -> None:
        if not self.portfolio.positions:
            return

        mints = list(self.portfolio.positions)
        snapshots = await self.dex.pairs_for_tokens(mints)

        # Keep the deepest pair per mint — that is the one we can exit into.
        best: dict[str, TokenSnapshot] = {}
        for snap in snapshots:
            current = best.get(snap.mint)
            if current is None or snap.liquidity_usd > current.liquidity_usd:
                best[snap.mint] = snap

        for mint in mints:
            position = self.portfolio.get(mint)
            if position is None:
                continue
            snap = best.get(mint)
            if snap is None:
                log.warning(
                    "no market data for %s (%s) — pair may have been removed",
                    position.symbol, mint[:8],
                )
                continue

            self.portfolio.mark(position, snap)
            decision = evaluate_exit(position, snap, self.cfg.exits)
            if not decision.should_exit:
                continue

            await self._execute_exit(position, snap, decision)

    async def _execute_exit(self, position: Position, snap: TokenSnapshot, decision) -> None:
        qty = position.qty * decision.fraction
        if qty <= 0:
            return

        is_ladder = decision.reason.startswith("take profit")
        order = await self.executor.sell(snap, qty, urgent=decision.urgent)
        if not order.ok:
            log.warning("exit of %s failed: %s", position.symbol, order.error)
            return

        pnl_pct = position.pnl_pct(order.price_usd)
        realized = self.portfolio.apply_sell(
            position, order, decision.reason, ladder_step=is_ladder
        )
        self.risk.record_trade(realized)

        if position.status.value == "closed":
            self.risk.start_cooldown(position.mint)

        emoji = "🟢" if realized >= 0 else "🔴"
        await self.notifier.send(
            f"{emoji} <b>SELL {position.symbol}</b> {decision.fraction:.0%} of position\n"
            f"PnL: {realized:+.2f} USD ({pnl_pct:+.1f}%)\n"
            f"Reason: {decision.reason}"
        )

    # --- discovery -------------------------------------------------------
    async def discover_candidates(self) -> list[TokenSnapshot]:
        """Collect candidate pairs from the search and promotion feeds."""
        seen: dict[str, TokenSnapshot] = {}

        async def add(snaps: list[TokenSnapshot]) -> None:
            for snap in snaps:
                current = seen.get(snap.mint)
                if current is None or snap.liquidity_usd > current.liquidity_usd:
                    seen[snap.mint] = snap

        tasks = [self.dex.search(q) for q in self.cfg.engine.discovery_queries]
        tasks.append(self._snapshots_from_feeds())
        for result in await asyncio.gather(*tasks, return_exceptions=True):
            if isinstance(result, Exception):
                log.warning("discovery source failed: %s", result)
                continue
            await add(result)

        candidates = sorted(
            seen.values(), key=lambda s: s.window("h1").volume_usd, reverse=True
        )
        return candidates[: self.cfg.engine.max_candidates_per_scan]

    async def _screen_candidate(self, snap: TokenSnapshot) -> ScreenResult:
        """Cheap screening: the generic market filters plus the pump.fun gate."""
        screen = screen_market(snap, self.cfg.screener)
        if not screen.passed:
            return screen
        if not self.cfg.pumpfun.enabled:
            return screen

        # The API lookup is skipped entirely when it is disabled; the gate then
        # works off the DexScreener venue and market cap alone.
        coin = await self.pumpfun.coin(snap.mint) if self.pumpfun else None
        return screen_pumpfun(snap, self.cfg.pumpfun, coin)

    async def _snapshots_from_feeds(self) -> list[TokenSnapshot]:
        boosted, profiles = await asyncio.gather(
            self.dex.boosted_mints(), self.dex.latest_profile_mints(),
        )
        mints = list(dict.fromkeys([*boosted, *profiles]))[:60]
        if not mints:
            return []
        return await self.dex.pairs_for_tokens(mints)

    async def scan(self) -> CycleReport:
        """Screen and score candidates without trading. Used by `memebot scan`."""
        report = CycleReport()
        candidates = await self.discover_candidates()
        report.scanned = len(candidates)

        for snap in candidates:
            screen = await self._screen_candidate(snap)
            if not screen.passed:
                report.rejected.append(
                    Rejection(snap.symbol, screen.reasons, screen.codes)
                )
                continue
            report.passed_screen += 1
            report.signals.append(score_token(snap, self.cfg.strategy))

        report.signals.sort(key=lambda s: s.score, reverse=True)
        return report

    async def discover_and_trade(self) -> CycleReport:
        report = CycleReport()
        candidates = await self.discover_candidates()
        report.scanned = len(candidates)

        equity, cash = await self._equity_and_cash()

        for snap in candidates:
            if self.portfolio.open_count >= self.cfg.risk.max_open_positions:
                break

            screen = await self._screen_candidate(snap)
            if not screen.passed:
                report.rejected.append(
                    Rejection(snap.symbol, screen.reasons, screen.codes)
                )
                continue
            report.passed_screen += 1

            signal = score_token(snap, self.cfg.strategy)
            report.signals.append(signal)
            if not signal.should_buy:
                continue

            decision = self.risk.check_entry(
                mint=snap.mint,
                equity_usd=equity,
                cash_usd=cash,
                open_positions=self.portfolio.open_count,
                already_held=self.portfolio.holds(snap.mint),
            )
            if not decision.allowed:
                log.debug("skip %s: %s", snap.symbol, decision.reason)
                continue

            # Expensive checks last, only for something we would really buy.
            onchain = await screen_onchain(
                snap, self.cfg.screener, self.rpc, self.rugcheck
            )
            if not onchain.passed:
                log.info("REJECT %s: %s", snap.symbol, "; ".join(onchain.reasons))
                report.rejected.append(
                    Rejection(snap.symbol, onchain.reasons, onchain.codes)
                )
                continue

            dev = await screen_dev_holdings(
                snap, self.cfg.screener, self.rpc, self.pumpfun
            )
            if not dev.passed:
                log.info("REJECT %s: %s", snap.symbol, "; ".join(dev.reasons))
                report.rejected.append(
                    Rejection(snap.symbol, dev.reasons, dev.codes)
                )
                continue

            if await self._enter(snap, signal, decision.size_usd):
                cash -= decision.size_usd

        report.signals.sort(key=lambda s: s.score, reverse=True)
        return report

    async def _enter(self, snap: TokenSnapshot, signal: Signal, size_usd: float) -> bool:
        order = await self.executor.buy(snap, size_usd)
        if not order.ok:
            log.warning("buy of %s failed: %s", snap.symbol, order.error)
            return False

        self.portfolio.open_position(snap, order, signal.score)
        self.risk.record_trade(0.0)
        await self.notifier.send(
            f"🚀 <b>BUY {snap.symbol}</b> (score {signal.score:.0f})\n"
            f"Size: ${order.value_usd:.2f} @ ${order.price_usd:.8f}\n"
            f"Liquidity: ${snap.liquidity_usd:,.0f} | 1h vol: "
            f"${snap.window('h1').volume_usd:,.0f}\n{snap.url}"
        )
        return True

    async def _equity_and_cash(self) -> tuple[float, float]:
        cash = await self.executor.available_cash_usd()
        if cash is None:
            cash = self.cfg.risk.starting_equity_usd
        prices = {m: p.last_price_usd for m, p in self.portfolio.positions.items()}
        equity = cash + self.portfolio.open_value_usd(prices)
        return equity, cash

    # --- manual actions --------------------------------------------------
    async def liquidate_all(self, reason: str = "manual liquidation") -> int:
        """Sell every open position at market. Used by `memebot panic`."""
        sold = 0
        for mint in list(self.portfolio.positions):
            position = self.portfolio.get(mint)
            if position is None:
                continue
            snap = await self.dex.best_pair(mint)
            if snap is None:
                log.error("cannot price %s — sell it manually", position.symbol)
                continue
            order = await self.executor.sell(snap, position.qty, urgent=True)
            if not order.ok:
                log.error("liquidating %s failed: %s", position.symbol, order.error)
                continue
            realized = self.portfolio.apply_sell(position, order, reason)
            self.risk.record_trade(realized)
            sold += 1
        return sold
