"""Jupiter aggregator client: quotes and swap transaction building.

Only used in live mode. The bot never sends a private key anywhere: Jupiter
returns an unsigned transaction which is signed locally by the executor.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ..http import HttpClient

log = logging.getLogger(__name__)

LITE_BASE = "https://lite-api.jup.ag"
PRO_BASE = "https://api.jup.ag"


@dataclass
class Quote:
    input_mint: str
    output_mint: str
    in_amount: int          # base units of input_mint
    out_amount: int         # base units of output_mint
    other_amount_threshold: int
    price_impact_pct: float
    raw: dict[str, Any]


class Jupiter:
    def __init__(self, http: HttpClient, api_key: str | None = None) -> None:
        self.http = http
        self.api_key = api_key
        self.base = PRO_BASE if api_key else LITE_BASE

    @property
    def _headers(self) -> dict[str, str]:
        return {"x-api-key": self.api_key} if self.api_key else {}

    async def quote(
        self,
        input_mint: str,
        output_mint: str,
        amount: int,
        slippage_bps: int,
        *,
        only_direct_routes: bool = False,
    ) -> Quote:
        params: dict[str, Any] = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount),
            "slippageBps": str(slippage_bps),
            "restrictIntermediateTokens": "true",
        }
        if only_direct_routes:
            params["onlyDirectRoutes"] = "true"

        data = await self.http.get_json(
            f"{self.base}/swap/v1/quote", params=params, headers=self._headers
        )
        return Quote(
            input_mint=data["inputMint"],
            output_mint=data["outputMint"],
            in_amount=int(data["inAmount"]),
            out_amount=int(data["outAmount"]),
            other_amount_threshold=int(data.get("otherAmountThreshold", 0)),
            price_impact_pct=float(data.get("priceImpactPct") or 0.0) * 100.0,
            raw=data,
        )

    async def swap_transaction(
        self,
        quote: Quote,
        user_public_key: str,
        *,
        priority_fee_lamports: int = 200_000,
    ) -> str:
        """Return a base64 unsigned VersionedTransaction for `quote`."""
        body = {
            "quoteResponse": quote.raw,
            "userPublicKey": user_public_key,
            "wrapAndUnwrapSol": True,
            "dynamicComputeUnitLimit": True,
            "prioritizationFeeLamports": {
                "priorityLevelWithMaxLamports": {
                    "maxLamports": priority_fee_lamports,
                    "priorityLevel": "high",
                }
            },
        }
        data = await self.http.post_json(
            f"{self.base}/swap/v1/swap", json=body, headers=self._headers
        )
        tx = data.get("swapTransaction")
        if not tx:
            raise RuntimeError(f"Jupiter returned no swapTransaction: {data}")
        return tx

    async def price_usd(self, mints: list[str]) -> dict[str, float]:
        """USD prices for mints. Used as a cross-check against DexScreener."""
        if not mints:
            return {}
        data = await self.http.get_json(
            f"{self.base}/price/v3",
            params={"ids": ",".join(mints)},
            headers=self._headers,
        )
        out: dict[str, float] = {}
        payload = data.get("data", data) if isinstance(data, dict) else {}
        for mint, entry in (payload or {}).items():
            if isinstance(entry, dict):
                price = entry.get("usdPrice", entry.get("price"))
                if price is not None:
                    out[mint] = float(price)
        return out
