"""RugCheck.xyz risk summary — an optional extra screening layer.

The service is best-effort: if it is down or rate-limits us, screening falls
back to the on-chain checks rather than blocking the whole scan.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..http import HttpClient, HttpError

log = logging.getLogger(__name__)

BASE = "https://api.rugcheck.xyz/v1"


@dataclass
class RiskReport:
    mint: str
    score: float
    risks: list[str] = field(default_factory=list)
    available: bool = True


class RugCheck:
    def __init__(self, http: HttpClient) -> None:
        self.http = http

    async def report(self, mint: str) -> RiskReport:
        try:
            data = await self.http.get_json(f"{BASE}/tokens/{mint}/report/summary")
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
        return RiskReport(mint=mint, score=float(score or 0.0), risks=risks)
