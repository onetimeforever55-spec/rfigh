"""RugCheck.xyz — risk score, and a free source of holder concentration.

Two jobs, one request. The full report carries both the risk score and the
top holders, so fetching it once gives the screener a second way to answer
"who controls this token?" when the RPC cannot.

That fallback is not a nicety. `getTokenLargestAccounts` is expensive for a
node to serve, so free RPC endpoints refuse it outright — measured on the
public Solana endpoint: 0 of 12 calls succeeded, while a cheap call was 12 of
12. Without another source, the holder check can never run on a free setup,
and since it fails closed the bot would simply never buy.

Still best-effort: it is a third party, it can be down, stale or wrong. It is
a fallback for the RPC, never a reason to skip the check entirely.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..http import HttpClient, HttpError
from .solana_rpc import HolderDistribution

log = logging.getLogger(__name__)

BASE = "https://api.rugcheck.xyz/v1"


@dataclass
class RiskReport:
    mint: str
    score: float
    risks: list[str] = field(default_factory=list)
    available: bool = True
    # Same type the RPC path produces, so the screener compares one shape
    # against its limits and cannot drift between the two sources.
    holders: HolderDistribution | None = None


def _holders_from_report(data: dict, *, ignore_largest: int = 1) -> HolderDistribution | None:
    """Top-holder percentages, with the AMM vault dropped.

    `ignore_largest` mirrors the RPC path: on a graduated token the biggest
    account is the liquidity pool, not a holder, and counting it would flag
    every healthy token as dangerously concentrated.
    """
    entries = data.get("topHolders") or []
    pcts = sorted(
        (float(h.get("pct") or 0.0) for h in entries if isinstance(h, dict)),
        reverse=True,
    )
    if not pcts:
        return None

    pcts = pcts[ignore_largest:]
    if not pcts:
        return HolderDistribution(0.0, 0.0, [])
    return HolderDistribution(
        top_holder_pct=pcts[0],
        top10_pct=sum(pcts[:10]),
        holders=pcts,
    )


class RugCheck:
    def __init__(self, http: HttpClient) -> None:
        self.http = http

    async def report(self, mint: str) -> RiskReport:
        # The full report rather than /report/summary: same round trip, and it
        # is the only one that carries topHolders.
        try:
            data = await self.http.get_json(f"{BASE}/tokens/{mint}/report")
        except HttpError as exc:
            log.debug("rugcheck unavailable for %s: %s", mint, exc)
            return RiskReport(mint=mint, score=0.0, available=False)

        risks = []
        for risk in data.get("risks") or []:
            if isinstance(risk, dict):
                name = risk.get("name") or ""
                level = risk.get("level") or ""
                risks.append(f"{name} ({level})" if level else name)

        # `score_normalised` is 0-100 where higher is worse; older responses
        # only carry the raw `score`.
        score = data.get("score_normalised")
        if score is None:
            score = data.get("score", 0)
        return RiskReport(
            mint=mint,
            score=float(score or 0.0),
            risks=risks,
            holders=_holders_from_report(data),
        )
