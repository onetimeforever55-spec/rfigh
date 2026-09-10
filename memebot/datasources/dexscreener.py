"""DexScreener client: candidate discovery and live pricing.

The public API needs no key. Endpoints used:
  - /latest/dex/search?q=            free-text pair search
  - /latest/dex/tokens/{addresses}   pairs for up to 30 token addresses
  - /token-boosts/top/v1             tokens with paid promotion (proxy for
                                     "what is being pushed right now")
  - /token-profiles/latest/v1        newest tokens with a profile
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

from ..http import HttpClient, HttpError
from ..models import TokenSnapshot

log = logging.getLogger(__name__)

BASE = "https://api.dexscreener.com"


class DexScreener:
    def __init__(self, http: HttpClient, chain_id: str = "solana") -> None:
        self.http = http
        self.chain_id = chain_id

    async def search(self, query: str) -> list[TokenSnapshot]:
        data = await self.http.get_json(f"{BASE}/latest/dex/search", params={"q": query})
        return self._pairs_to_snapshots(data.get("pairs") or [])

    async def pairs_for_tokens(self, mints: Iterable[str]) -> list[TokenSnapshot]:
        """Fetch pairs for up to 30 mints per call (API limit)."""
        mints = [m for m in mints if m]
        out: list[TokenSnapshot] = []
        for i in range(0, len(mints), 30):
            chunk = mints[i : i + 30]
            data = await self.http.get_json(f"{BASE}/latest/dex/tokens/{','.join(chunk)}")
            pairs = data.get("pairs") if isinstance(data, dict) else data
            out.extend(self._pairs_to_snapshots(pairs or []))
        return out

    async def best_pair(self, mint: str) -> TokenSnapshot | None:
        """The deepest-liquidity pair for a mint — the one we would trade."""
        snaps = [s for s in await self.pairs_for_tokens([mint]) if s.mint == mint]
        if not snaps:
            return None
        return max(snaps, key=lambda s: s.liquidity_usd)

    async def boosted_mints(self) -> list[str]:
        try:
            data = await self.http.get_json(f"{BASE}/token-boosts/top/v1")
        except HttpError as exc:
            log.warning("boosted feed unavailable: %s", exc)
            return []
        return self._mints_from_feed(data)

    async def latest_profile_mints(self) -> list[str]:
        try:
            data = await self.http.get_json(f"{BASE}/token-profiles/latest/v1")
        except HttpError as exc:
            log.warning("token-profiles feed unavailable: %s", exc)
            return []
        return self._mints_from_feed(data)

    def _mints_from_feed(self, data: Any) -> list[str]:
        items = data if isinstance(data, list) else (data or {}).get("data") or []
        mints: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("chainId") != self.chain_id:
                continue
            mint = item.get("tokenAddress")
            if mint:
                mints.append(mint)
        return mints

    def _pairs_to_snapshots(self, pairs: list[dict[str, Any]]) -> list[TokenSnapshot]:
        out = []
        for pair in pairs:
            if not isinstance(pair, dict):
                continue
            if pair.get("chainId") != self.chain_id:
                continue
            snap = TokenSnapshot.from_dexscreener(pair)
            if snap.mint and snap.price_usd > 0:
                out.append(snap)
        return out
