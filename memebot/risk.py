"""Risk limits: how much to buy, and when to stop trading entirely."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from .config import RiskConfig

log = logging.getLogger(__name__)


@dataclass
class RiskDecision:
    allowed: bool
    size_usd: float = 0.0
    reason: str = ""


@dataclass
class DailyStats:
    day: str = ""
    realized_pnl_usd: float = 0.0
    trades: int = 0


@dataclass
class RiskManager:
    cfg: RiskConfig
    daily: DailyStats = field(default_factory=DailyStats)
    # mint -> epoch ms at which the cooldown after a sale expires
    _cooldowns: dict[str, float] = field(default_factory=dict)
    halted_reason: str = ""

    def _today(self) -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def roll_day(self) -> None:
        """Reset daily counters when the UTC date changes."""
        today = self._today()
        if self.daily.day != today:
            if self.daily.day:
                log.info(
                    "new trading day %s (previous: %d trades, %+.2f USD)",
                    today, self.daily.trades, self.daily.realized_pnl_usd,
                )
            self.daily = DailyStats(day=today)
            self.halted_reason = ""

    def record_trade(self, realized_pnl_usd: float = 0.0) -> None:
        self.roll_day()
        self.daily.trades += 1
        self.daily.realized_pnl_usd += realized_pnl_usd

    def start_cooldown(self, mint: str) -> None:
        self._cooldowns[mint] = time.time() * 1000 + self.cfg.rebuy_cooldown_minutes * 60_000

    def cooldown_remaining_minutes(self, mint: str) -> float:
        expiry = self._cooldowns.get(mint)
        if expiry is None:
            return 0.0
        remaining = (expiry - time.time() * 1000) / 60_000
        if remaining <= 0:
            self._cooldowns.pop(mint, None)
            return 0.0
        return remaining

    def check_entry(
        self,
        *,
        mint: str,
        equity_usd: float,
        cash_usd: float,
        open_positions: int,
        already_held: bool,
    ) -> RiskDecision:
        self.roll_day()

        if self.halted_reason:
            return RiskDecision(False, reason=f"trading halted: {self.halted_reason}")

        if already_held:
            return RiskDecision(False, reason="already holding this token")

        cooldown = self.cooldown_remaining_minutes(mint)
        if cooldown > 0:
            return RiskDecision(False, reason=f"re-buy cooldown, {cooldown:.0f}m left")

        if open_positions >= self.cfg.max_open_positions:
            return RiskDecision(
                False, reason=f"at max open positions ({self.cfg.max_open_positions})"
            )

        if self.daily.trades >= self.cfg.max_daily_trades:
            return RiskDecision(
                False, reason=f"daily trade cap reached ({self.cfg.max_daily_trades})"
            )

        if self.daily.realized_pnl_usd <= -abs(self.cfg.max_daily_loss_usd):
            self.halted_reason = (
                f"daily loss limit hit ({self.daily.realized_pnl_usd:+.2f} USD)"
            )
            return RiskDecision(False, reason=self.halted_reason)

        size = min(
            self.cfg.position_size_usd,
            equity_usd * self.cfg.position_size_pct_equity / 100.0,
        )
        spendable = cash_usd - self.cfg.min_cash_reserve_usd
        if size > spendable:
            size = spendable
        if size <= 0:
            return RiskDecision(False, reason="no spendable cash left")

        # A position too small to matter costs more in fees than it can make.
        if size < self.cfg.position_size_usd * 0.25:
            return RiskDecision(
                False,
                reason=f"position size ${size:.2f} too small vs target "
                f"${self.cfg.position_size_usd:.2f}",
            )

        return RiskDecision(True, size_usd=size)
