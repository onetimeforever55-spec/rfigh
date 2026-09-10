"""Position bookkeeping: opening, scaling out, closing, and PnL."""

from __future__ import annotations

import logging

from .models import (
    OrderResult, Position, PositionStatus, Side, TokenSnapshot, Trade, now_ms,
)
from .storage import Storage

log = logging.getLogger(__name__)


class Portfolio:
    def __init__(self, storage: Storage, starting_equity_usd: float = 0.0) -> None:
        self.storage = storage
        self.starting_equity_usd = starting_equity_usd
        self.positions: dict[str, Position] = {
            p.mint: p for p in storage.load_open_positions()
        }
        if self.positions:
            log.info("restored %d open position(s) from disk", len(self.positions))

    # --- queries ---------------------------------------------------------
    @property
    def open_count(self) -> int:
        return len(self.positions)

    def get(self, mint: str) -> Position | None:
        return self.positions.get(mint)

    def holds(self, mint: str) -> bool:
        return mint in self.positions

    def open_value_usd(self, prices: dict[str, float]) -> float:
        return sum(
            p.market_value_usd(prices.get(mint, p.last_price_usd))
            for mint, p in self.positions.items()
        )

    def unrealized_pnl_usd(self, prices: dict[str, float]) -> float:
        return sum(
            p.unrealized_pnl_usd(prices.get(mint, p.last_price_usd))
            for mint, p in self.positions.items()
        )

    def realized_pnl_usd(self) -> float:
        """Realised PnL across every position ever held, open or closed."""
        total = sum(p.realized_pnl_usd for p in self.positions.values())
        total += sum(p.realized_pnl_usd for p in self.storage.load_closed_positions(10_000))
        return total

    # --- mutations -------------------------------------------------------
    def open_position(
        self, snap: TokenSnapshot, order: OrderResult, entry_score: float = 0.0
    ) -> Position:
        position = Position(
            mint=snap.mint,
            symbol=snap.symbol,
            pair_address=snap.pair_address,
            entry_price_usd=order.price_usd,
            entry_liquidity_usd=snap.liquidity_usd,
            entry_volume_h1_usd=snap.window("h1").volume_usd,
            qty=order.qty,
            original_qty=order.qty,
            cost_usd=order.value_usd,
            fees_usd=order.fee_usd,
            peak_price_usd=order.price_usd,
            last_price_usd=order.price_usd,
            entry_score=entry_score,
        )
        self.storage.save_position(position)
        self.positions[snap.mint] = position

        self.storage.save_trade(
            Trade(
                mint=snap.mint, symbol=snap.symbol, side=Side.BUY, qty=order.qty,
                price_usd=order.price_usd, value_usd=order.value_usd,
                fee_usd=order.fee_usd, reason=f"entry score {entry_score:.1f}",
                tx_signature=order.tx_signature,
            )
        )
        log.info(
            "OPEN %s: %.4f tokens @ $%.8f (cost $%.2f, score %.1f)",
            snap.symbol, order.qty, order.price_usd, order.value_usd, entry_score,
        )
        return position

    def apply_sell(
        self,
        position: Position,
        order: OrderResult,
        reason: str,
        *,
        ladder_step: bool = False,
    ) -> float:
        """Book a (possibly partial) sale. Returns realised PnL for this fill."""
        sold_qty = min(order.qty, position.qty)
        # Cost basis attributed to the units sold, pro rata.
        basis = position.cost_usd * (sold_qty / position.original_qty) if position.original_qty else 0.0
        realized = order.value_usd - basis

        position.qty = max(0.0, position.qty - sold_qty)
        position.realized_pnl_usd += realized
        position.fees_usd += order.fee_usd
        position.last_price_usd = order.price_usd
        if ladder_step:
            position.ladder_steps_done += 1

        # Dust below 0.01% of the original size is not worth another swap.
        if position.qty <= position.original_qty * 1e-4:
            position.qty = 0.0
            position.status = PositionStatus.CLOSED
            position.closed_at_ms = now_ms()
            position.close_reason = reason
            self.positions.pop(position.mint, None)
            log.info(
                "CLOSE %s: realised %+.2f USD (%s)",
                position.symbol, position.realized_pnl_usd, reason,
            )
        else:
            log.info(
                "TRIM %s: sold %.4f for $%.2f (%+.2f USD, %.0f%% left) — %s",
                position.symbol, sold_qty, order.value_usd, realized,
                position.remaining_fraction * 100, reason,
            )

        self.storage.save_position(position)
        self.storage.save_trade(
            Trade(
                mint=position.mint, symbol=position.symbol, side=Side.SELL,
                qty=sold_qty, price_usd=order.price_usd, value_usd=order.value_usd,
                fee_usd=order.fee_usd, reason=reason,
                tx_signature=order.tx_signature, realized_pnl_usd=realized,
            )
        )
        return realized

    def mark(self, position: Position, snap: TokenSnapshot) -> None:
        """Update the marks used by trailing stops and reporting."""
        if snap.price_usd <= 0:
            return
        position.last_price_usd = snap.price_usd
        if snap.price_usd > position.peak_price_usd:
            position.peak_price_usd = snap.price_usd
        self.storage.save_position(position)
