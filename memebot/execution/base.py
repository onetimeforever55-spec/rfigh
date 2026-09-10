"""Executor interface: everything the engine needs to place a swap."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import OrderResult, TokenSnapshot


class Executor(ABC):
    """Turns a desired trade into a fill.

    Implementations must never raise for ordinary failures: return an
    `OrderResult(ok=False, error=...)` so the engine can carry on.
    """

    name: str = "base"

    @abstractmethod
    async def buy(self, snap: TokenSnapshot, usd_amount: float) -> OrderResult:
        """Spend `usd_amount` of the quote asset on `snap`'s token."""

    @abstractmethod
    async def sell(self, snap: TokenSnapshot, qty: float, *, urgent: bool = False) -> OrderResult:
        """Sell `qty` token units back into the quote asset."""

    async def available_cash_usd(self) -> float | None:
        """Spendable quote balance in USD, or None if unknown."""
        return None

    async def start(self) -> None:
        return None

    async def close(self) -> None:
        return None
