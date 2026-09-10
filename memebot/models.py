"""Domain objects shared by every layer of the bot."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


def now_ms() -> int:
    return int(time.time() * 1000)


def _f(value: Any, default: float = 0.0) -> float:
    """Coerce an API value to float. Feeds return numbers as strings/None."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _i(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass
class TokenWindow:
    """Metrics for one time window (m5, h1, h6, h24)."""

    buys: int = 0
    sells: int = 0
    volume_usd: float = 0.0
    price_change_pct: float = 0.0

    @property
    def txns(self) -> int:
        return self.buys + self.sells

    @property
    def buy_sell_ratio(self) -> float:
        """Buys per sell. Returns buys when there are no sells at all."""
        if self.sells == 0:
            return float(self.buys) if self.buys else 1.0
        return self.buys / self.sells


@dataclass
class TokenSnapshot:
    """A point-in-time view of a tradable pair, normalised from DexScreener."""

    mint: str
    symbol: str
    name: str
    pair_address: str
    chain_id: str
    dex_id: str
    quote_mint: str
    quote_symbol: str
    price_usd: float
    price_native: float
    liquidity_usd: float
    market_cap_usd: float
    fdv_usd: float
    pair_created_at_ms: int
    windows: dict[str, TokenWindow] = field(default_factory=dict)
    has_socials: bool = False
    url: str = ""
    fetched_at_ms: int = field(default_factory=now_ms)

    def window(self, key: str) -> TokenWindow:
        return self.windows.get(key, TokenWindow())

    @property
    def age_minutes(self) -> float:
        if not self.pair_created_at_ms:
            return float("inf")
        return max(0.0, (self.fetched_at_ms - self.pair_created_at_ms) / 60_000)

    @property
    def volume_liquidity_ratio(self) -> float:
        if self.liquidity_usd <= 0:
            return 0.0
        return self.window("h24").volume_usd / self.liquidity_usd

    @property
    def mcap_liquidity_ratio(self) -> float:
        if self.liquidity_usd <= 0:
            return float("inf")
        return (self.market_cap_usd or self.fdv_usd) / self.liquidity_usd

    @classmethod
    def from_dexscreener(cls, pair: dict[str, Any]) -> "TokenSnapshot":
        base = pair.get("baseToken") or {}
        quote = pair.get("quoteToken") or {}
        txns = pair.get("txns") or {}
        volume = pair.get("volume") or {}
        change = pair.get("priceChange") or {}

        windows: dict[str, TokenWindow] = {}
        for key in ("m5", "h1", "h6", "h24"):
            t = txns.get(key) or {}
            windows[key] = TokenWindow(
                buys=_i(t.get("buys")),
                sells=_i(t.get("sells")),
                volume_usd=_f(volume.get(key)),
                price_change_pct=_f(change.get(key)),
            )

        info = pair.get("info") or {}
        has_socials = bool(info.get("socials")) or bool(info.get("websites"))

        return cls(
            mint=base.get("address", ""),
            symbol=base.get("symbol", "?"),
            name=base.get("name", ""),
            pair_address=pair.get("pairAddress", ""),
            chain_id=pair.get("chainId", ""),
            dex_id=pair.get("dexId", ""),
            quote_mint=quote.get("address", ""),
            quote_symbol=quote.get("symbol", ""),
            price_usd=_f(pair.get("priceUsd")),
            price_native=_f(pair.get("priceNative")),
            liquidity_usd=_f((pair.get("liquidity") or {}).get("usd")),
            market_cap_usd=_f(pair.get("marketCap")),
            fdv_usd=_f(pair.get("fdv")),
            pair_created_at_ms=_i(pair.get("pairCreatedAt")),
            windows=windows,
            has_socials=has_socials,
            url=pair.get("url", ""),
        )


class PositionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


@dataclass
class Position:
    """An open (or closed) holding of one token."""

    mint: str
    symbol: str
    pair_address: str
    entry_price_usd: float
    entry_liquidity_usd: float
    entry_volume_h1_usd: float
    qty: float                       # token units currently held
    original_qty: float              # token units bought at entry
    cost_usd: float                  # USD actually spent, after fees
    realized_pnl_usd: float = 0.0
    fees_usd: float = 0.0
    peak_price_usd: float = 0.0
    last_price_usd: float = 0.0
    ladder_steps_done: int = 0
    opened_at_ms: int = field(default_factory=now_ms)
    closed_at_ms: int | None = None
    status: PositionStatus = PositionStatus.OPEN
    close_reason: str = ""
    entry_score: float = 0.0
    id: int | None = None

    @property
    def avg_entry_price(self) -> float:
        if self.original_qty <= 0:
            return 0.0
        return self.cost_usd / self.original_qty

    @property
    def remaining_fraction(self) -> float:
        if self.original_qty <= 0:
            return 0.0
        return self.qty / self.original_qty

    def market_value_usd(self, price_usd: float) -> float:
        return self.qty * price_usd

    def unrealized_pnl_usd(self, price_usd: float) -> float:
        """PnL of the units still held, versus their share of the cost basis."""
        open_cost = self.cost_usd * self.remaining_fraction
        return self.market_value_usd(price_usd) - open_cost

    def total_pnl_usd(self, price_usd: float) -> float:
        return self.realized_pnl_usd + self.unrealized_pnl_usd(price_usd)

    def pnl_pct(self, price_usd: float) -> float:
        """Move of the current price against the average entry price."""
        entry = self.avg_entry_price
        if entry <= 0:
            return 0.0
        return (price_usd - entry) / entry * 100.0

    @property
    def age_minutes(self) -> float:
        end = self.closed_at_ms or now_ms()
        return max(0.0, (end - self.opened_at_ms) / 60_000)


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


@dataclass
class Trade:
    """A single executed fill."""

    mint: str
    symbol: str
    side: Side
    qty: float
    price_usd: float
    value_usd: float
    fee_usd: float
    reason: str
    tx_signature: str | None = None
    realized_pnl_usd: float = 0.0
    ts_ms: int = field(default_factory=now_ms)
    id: int | None = None


@dataclass
class OrderResult:
    """What an executor returns after attempting a swap."""

    ok: bool
    qty: float = 0.0            # tokens received (buy) or sold (sell)
    price_usd: float = 0.0      # effective fill price
    value_usd: float = 0.0      # USD notional actually transacted
    fee_usd: float = 0.0
    tx_signature: str | None = None
    error: str = ""


@dataclass
class ScreenResult:
    passed: bool
    reasons: list[str] = field(default_factory=list)

    def fail(self, reason: str) -> "ScreenResult":
        self.passed = False
        self.reasons.append(reason)
        return self


@dataclass
class Signal:
    """Output of the entry strategy for one candidate."""

    mint: str
    symbol: str
    score: float
    should_buy: bool
    reasons: list[str] = field(default_factory=list)
    components: dict[str, float] = field(default_factory=dict)


@dataclass
class ExitDecision:
    should_exit: bool
    fraction: float = 0.0   # fraction of the CURRENT holding to sell
    reason: str = ""
    urgent: bool = False    # skip price-impact guards, get out now
