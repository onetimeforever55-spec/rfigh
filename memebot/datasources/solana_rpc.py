"""Direct Solana JSON-RPC calls used for on-chain safety checks.

These are the checks that actually stop rugs: a mint whose mint authority is
still live can be inflated at will, and a freeze authority can stop you from
ever selling.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ..http import HttpClient

log = logging.getLogger(__name__)


@dataclass
class MintInfo:
    mint: str
    decimals: int
    supply: float
    mint_authority: str | None
    freeze_authority: str | None

    @property
    def mint_authority_revoked(self) -> bool:
        return self.mint_authority is None

    @property
    def freeze_authority_revoked(self) -> bool:
        return self.freeze_authority is None


@dataclass
class HolderDistribution:
    top_holder_pct: float
    top10_pct: float
    # Accounts that are almost certainly not a "whale": AMM vaults hold the
    # pool's side of the market. Callers can choose to ignore the largest one.
    holders: list[float]


class SolanaRPC:
    def __init__(self, http: HttpClient, url: str) -> None:
        self.http = http
        self.url = url
        self._id = 0

    async def call(self, method: str, params: list[Any]) -> Any:
        """Raw JSON-RPC call. Public so executors can send/confirm transactions."""
        self._id += 1
        body = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params}
        data = await self.http.post_json(self.url, json=body)
        if "error" in data:
            raise RuntimeError(f"RPC {method} failed: {data['error']}")
        return data.get("result")

    async def get_mint_info(self, mint: str) -> MintInfo | None:
        result = await self.call(
            "getAccountInfo", [mint, {"encoding": "jsonParsed", "commitment": "confirmed"}]
        )
        value = (result or {}).get("value")
        if not value:
            return None
        parsed = ((value.get("data") or {}).get("parsed") or {}).get("info") or {}
        decimals = int(parsed.get("decimals", 0))
        raw_supply = float(parsed.get("supply", 0) or 0)
        return MintInfo(
            mint=mint,
            decimals=decimals,
            supply=raw_supply / (10**decimals) if decimals else raw_supply,
            mint_authority=parsed.get("mintAuthority"),
            freeze_authority=parsed.get("freezeAuthority"),
        )

    async def get_holder_distribution(
        self, mint: str, *, ignore_largest: int = 1
    ) -> HolderDistribution | None:
        """Concentration among the top token accounts.

        `ignore_largest` drops the biggest accounts before measuring, because
        on an AMM the deepest account is the liquidity pool vault, not a holder.
        """
        result = await self.call("getTokenLargestAccounts", [mint, {"commitment": "confirmed"}])
        accounts = (result or {}).get("value") or []
        if not accounts:
            return None

        supply_result = await self.call("getTokenSupply", [mint, {"commitment": "confirmed"}])
        total = float(((supply_result or {}).get("value") or {}).get("uiAmount") or 0.0)
        if total <= 0:
            return None

        amounts = sorted(
            (float(a.get("uiAmount") or 0.0) for a in accounts), reverse=True
        )
        amounts = amounts[ignore_largest:]
        if not amounts:
            return HolderDistribution(0.0, 0.0, [])

        pcts = [a / total * 100.0 for a in amounts]
        return HolderDistribution(
            top_holder_pct=pcts[0],
            top10_pct=sum(pcts[:10]),
            holders=pcts,
        )

    async def get_sol_balance(self, pubkey: str) -> float:
        result = await self.call("getBalance", [pubkey, {"commitment": "confirmed"}])
        return float((result or {}).get("value") or 0) / 1e9

    async def get_token_balance(self, owner: str, mint: str) -> float:
        result = await self.call(
            "getTokenAccountsByOwner",
            [owner, {"mint": mint}, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        total = 0.0
        for acct in (result or {}).get("value") or []:
            info = (
                ((acct.get("account") or {}).get("data") or {}).get("parsed") or {}
            ).get("info") or {}
            amount = (info.get("tokenAmount") or {}).get("uiAmount")
            total += float(amount or 0.0)
        return total
