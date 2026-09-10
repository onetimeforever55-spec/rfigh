"""pump.fun specifics: launch phase, bonding-curve progress and dev holdings.

A pump.fun token lives in two phases:

  * **bonding curve** — the token trades against a program-owned curve. There
    is no LP to pull, so the classic "rug" here is the dev dumping their
    allocation, not liquidity disappearing. DexScreener reports these with
    `dexId == "pumpfun"`.
  * **graduated** — the curve filled (historically around $69k market cap) and
    liquidity moved to an AMM with the LP burned. DexScreener reports these
    with `dexId == "pumpswap"` (or `raydium` for older graduates).

Phase is derived from the DexScreener snapshot we already have, so the common
path costs no extra request. The pump.fun HTTP API is used only to enrich that
with the creator address and exact curve reserves, and is treated as
best-effort: it sits behind Cloudflare and rate-limits aggressively, so every
caller must work without it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from ..http import HttpClient, HttpError
from ..models import TokenSnapshot

log = logging.getLogger(__name__)

BASE = "https://frontend-api-v3.pump.fun"

# DexScreener dexId values, by phase.
CURVE_DEX_IDS = frozenset({"pumpfun", "pump", "pumpdotfun"})
GRADUATED_DEX_IDS = frozenset({"pumpswap", "raydium", "meteora", "orca"})


class PumpPhase(str, Enum):
    CURVE = "curve"
    GRADUATED = "graduated"
    UNKNOWN = "unknown"


def is_pumpfun_mint(mint: str) -> bool:
    """Heuristic: pump.fun mints are vanity addresses ending in `pump`.

    This is how you tell a graduated pump.fun token from any other token on the
    same AMM without an extra request. It is a convention rather than a
    guarantee, so it is only ever used to *include* candidates, never as proof
    that something is safe.
    """
    return mint.endswith("pump")


def phase_from_snapshot(snap: TokenSnapshot) -> PumpPhase:
    """Derive the launch phase from the DexScreener pair. No network calls."""
    dex = snap.dex_id.lower()
    if dex in CURVE_DEX_IDS:
        return PumpPhase.CURVE
    if dex in GRADUATED_DEX_IDS and is_pumpfun_mint(snap.mint):
        return PumpPhase.GRADUATED
    return PumpPhase.UNKNOWN


def estimate_curve_progress_pct(snap: TokenSnapshot, graduation_mcap_usd: float) -> float:
    """Rough fill level of the bonding curve, from market cap.

    The exact figure needs the curve's reserves (see `PumpFun.coin`); this
    approximation is what the bot falls back on when the pump.fun API is
    unreachable, which is most of the time. Market cap tracks curve progress
    closely enough to separate "just launched" from "about to graduate".
    """
    if graduation_mcap_usd <= 0:
        return 0.0
    mcap = snap.market_cap_usd or snap.fdv_usd
    return max(0.0, min(100.0, mcap / graduation_mcap_usd * 100.0))


@dataclass
class PumpCoin:
    """Enrichment from the pump.fun API. `available` is False when it failed."""

    mint: str
    available: bool = False
    creator: str | None = None
    graduated: bool = False
    curve_progress_pct: float | None = None
    created_at_ms: int = 0
    raydium_pool: str | None = None

    @property
    def phase(self) -> PumpPhase:
        if not self.available:
            return PumpPhase.UNKNOWN
        return PumpPhase.GRADUATED if self.graduated else PumpPhase.CURVE


class PumpFun:
    def __init__(self, http: HttpClient) -> None:
        self.http = http
        self._cache: dict[str, PumpCoin] = {}

    async def coin(self, mint: str) -> PumpCoin:
        """Fetch coin metadata. Never raises: returns `available=False` instead.

        Results are cached per mint because the creator address and launch time
        do not change, and the endpoint rate-limits hard.
        """
        cached = self._cache.get(mint)
        if cached is not None and cached.available:
            return cached

        try:
            data = await self.http.get_json(f"{BASE}/coins/{mint}")
        except HttpError as exc:
            log.debug("pump.fun API unavailable for %s: %s", mint, exc)
            return PumpCoin(mint=mint, available=False)

        if not isinstance(data, dict) or not data.get("mint"):
            return PumpCoin(mint=mint, available=False)

        coin = PumpCoin(
            mint=mint,
            available=True,
            creator=data.get("creator"),
            graduated=bool(data.get("complete")) or bool(data.get("raydium_pool")),
            curve_progress_pct=_curve_progress_from_reserves(data),
            created_at_ms=int(data.get("created_timestamp") or 0),
            raydium_pool=data.get("raydium_pool"),
        )
        self._cache[mint] = coin
        return coin


def _curve_progress_from_reserves(data: dict) -> float | None:
    """Curve fill from the token reserves the API reports, if it reports them.

    The curve starts with a fixed virtual token reserve and empties as tokens
    are bought, so the fraction sold is the progress.
    """
    try:
        virtual = float(data.get("virtual_token_reserves") or 0)
        total = float(data.get("total_supply") or 0)
    except (TypeError, ValueError):
        return None
    if virtual <= 0 or total <= 0:
        return None
    sold_fraction = 1.0 - (virtual / total)
    return max(0.0, min(100.0, sold_fraction * 100.0))
