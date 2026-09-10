"""Paper executor: simulated fills against live market data.

Fills are deliberately pessimistic — a fixed fee plus slippage that grows with
the size of the order relative to pool liquidity — so paper results are not
systematically better than what live trading would produce.
"""

from __future__ import annotations

import logging

from ..models import OrderResult, TokenSnapshot
from .base import Executor

log = logging.getLogger(__name__)


class PaperExecutor(Executor):
    name = "paper"

    def __init__(self, cfg, dex=None) -> None:
        self.cfg = cfg
        self.dex = dex
        self.cash_usd = cfg.risk.starting_equity_usd

    def _slippage_pct(self, snap: TokenSnapshot, usd_amount: float) -> float:
        """Base slippage plus a size-dependent term.

        A constant-product pool moves roughly `size / liquidity` for small
        trades, so scale the penalty on that ratio.
        """
        base = self.cfg.execution.paper_slippage_pct
        if snap.liquidity_usd <= 0:
            return base + 25.0
        impact = usd_amount / snap.liquidity_usd * 100.0
        return base + impact

    async def buy(self, snap: TokenSnapshot, usd_amount: float) -> OrderResult:
        if snap.price_usd <= 0:
            return OrderResult(ok=False, error="no price")
        if usd_amount > self.cash_usd:
            return OrderResult(
                ok=False,
                error=f"insufficient paper cash: need ${usd_amount:.2f}, have ${self.cash_usd:.2f}",
            )

        slip = self._slippage_pct(snap, usd_amount)
        if slip > self.cfg.execution.max_price_impact_pct:
            return OrderResult(
                ok=False,
                error=f"estimated price impact {slip:.2f}% > "
                f"{self.cfg.execution.max_price_impact_pct:.2f}%",
            )

        fee = usd_amount * self.cfg.execution.paper_fee_pct / 100.0
        fill_price = snap.price_usd * (1 + slip / 100.0)
        qty = (usd_amount - fee) / fill_price

        self.cash_usd -= usd_amount
        log.debug(
            "paper buy %s: $%.2f -> %.4f tokens @ %.10f (slip %.2f%%)",
            snap.symbol, usd_amount, qty, fill_price, slip,
        )
        return OrderResult(
            ok=True, qty=qty, price_usd=fill_price, value_usd=usd_amount, fee_usd=fee,
            tx_signature="paper",
        )

    async def sell(self, snap: TokenSnapshot, qty: float, *, urgent: bool = False) -> OrderResult:
        if snap.price_usd <= 0:
            return OrderResult(ok=False, error="no price")
        if qty <= 0:
            return OrderResult(ok=False, error="nothing to sell")

        gross = qty * snap.price_usd
        slip = self._slippage_pct(snap, gross)
        if not urgent and slip > self.cfg.execution.max_price_impact_pct:
            return OrderResult(
                ok=False,
                error=f"estimated price impact {slip:.2f}% > "
                f"{self.cfg.execution.max_price_impact_pct:.2f}%",
            )

        fill_price = snap.price_usd * (1 - slip / 100.0)
        proceeds = qty * fill_price
        fee = proceeds * self.cfg.execution.paper_fee_pct / 100.0
        net = proceeds - fee

        self.cash_usd += net
        log.debug(
            "paper sell %s: %.4f tokens -> $%.2f @ %.10f (slip %.2f%%)",
            snap.symbol, qty, net, fill_price, slip,
        )
        return OrderResult(
            ok=True, qty=qty, price_usd=fill_price, value_usd=net, fee_usd=fee,
            tx_signature="paper",
        )

    async def available_cash_usd(self) -> float | None:
        return self.cash_usd
