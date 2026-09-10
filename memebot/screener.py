"""Safety screening — the layer that decides what is even allowed to be bought.

Two tiers:
  1. `screen_market` — cheap, uses only the DexScreener snapshot we already have.
  2. `screen_onchain` — costs RPC calls, so it only runs on tokens that passed
     tier 1 and are about to be bought.
"""

from __future__ import annotations

import logging

from .config import ScreenerConfig
from .datasources.rugcheck import RugCheck
from .datasources.solana_rpc import SolanaRPC
from .models import ScreenResult, TokenSnapshot

log = logging.getLogger(__name__)


def screen_market(snap: TokenSnapshot, cfg: ScreenerConfig) -> ScreenResult:
    """Cheap filters over a market snapshot. No network calls."""
    result = ScreenResult(passed=True)

    if snap.chain_id != cfg.chain_id:
        return result.fail(f"chain {snap.chain_id} != {cfg.chain_id}")
    if snap.mint in cfg.blocked_mints:
        return result.fail("mint is blocklisted")
    if snap.dex_id in cfg.blocked_dex_ids:
        return result.fail(f"dex {snap.dex_id} is blocklisted")
    if cfg.allowed_quote_mints and snap.quote_mint not in cfg.allowed_quote_mints:
        return result.fail(f"quote token {snap.quote_symbol} not allowed")

    symbol_lower = f"{snap.symbol} {snap.name}".lower()
    for keyword in cfg.blocked_symbol_keywords:
        if keyword.lower() in symbol_lower:
            return result.fail(f"name contains blocked keyword {keyword!r}")

    if snap.price_usd <= 0:
        return result.fail("no price")

    # Liquidity.
    if snap.liquidity_usd < cfg.min_liquidity_usd:
        result.fail(f"liquidity ${snap.liquidity_usd:,.0f} < ${cfg.min_liquidity_usd:,.0f}")
    if snap.liquidity_usd > cfg.max_liquidity_usd:
        result.fail(f"liquidity ${snap.liquidity_usd:,.0f} > ${cfg.max_liquidity_usd:,.0f}")

    # Activity.
    h1, h24 = snap.window("h1"), snap.window("h24")
    if h1.volume_usd < cfg.min_volume_h1_usd:
        result.fail(f"1h volume ${h1.volume_usd:,.0f} < ${cfg.min_volume_h1_usd:,.0f}")
    if h24.volume_usd < cfg.min_volume_h24_usd:
        result.fail(f"24h volume ${h24.volume_usd:,.0f} < ${cfg.min_volume_h24_usd:,.0f}")
    if h1.txns < cfg.min_txns_h1:
        result.fail(f"{h1.txns} txns in 1h < {cfg.min_txns_h1}")

    ratio = snap.volume_liquidity_ratio
    if ratio < cfg.min_volume_liquidity_ratio:
        result.fail(f"volume/liquidity {ratio:.2f} < {cfg.min_volume_liquidity_ratio}")
    if ratio > cfg.max_volume_liquidity_ratio:
        result.fail(f"volume/liquidity {ratio:.1f} > {cfg.max_volume_liquidity_ratio} (wash trading?)")

    # Age.
    age_min = snap.age_minutes
    if age_min < cfg.min_age_minutes:
        result.fail(f"pair is {age_min:.0f}m old < {cfg.min_age_minutes:.0f}m")
    if age_min > cfg.max_age_hours * 60:
        result.fail(f"pair is {age_min / 60:.0f}h old > {cfg.max_age_hours:.0f}h")

    # Valuation.
    mcap = snap.market_cap_usd or snap.fdv_usd
    if mcap and mcap < cfg.min_market_cap_usd:
        result.fail(f"mcap ${mcap:,.0f} < ${cfg.min_market_cap_usd:,.0f}")
    if mcap and mcap > cfg.max_market_cap_usd:
        result.fail(f"mcap ${mcap:,.0f} > ${cfg.max_market_cap_usd:,.0f}")
    if snap.mcap_liquidity_ratio > cfg.max_mcap_liquidity_ratio:
        result.fail(
            f"mcap/liquidity {snap.mcap_liquidity_ratio:.0f} > "
            f"{cfg.max_mcap_liquidity_ratio:.0f} (thin float)"
        )

    if cfg.require_socials and not snap.has_socials:
        result.fail("no socials or website")

    return result


async def screen_onchain(
    snap: TokenSnapshot,
    cfg: ScreenerConfig,
    rpc: SolanaRPC | None,
    rugcheck: RugCheck | None = None,
) -> ScreenResult:
    """Expensive filters. Run only on candidates about to be bought."""
    result = ScreenResult(passed=True)

    if rpc is not None:
        try:
            info = await rpc.get_mint_info(snap.mint)
        except Exception as exc:  # noqa: BLE001 - never let a bad RPC buy a rug
            return result.fail(f"mint info unavailable ({exc})")

        if info is None:
            return result.fail("mint account not found")
        if cfg.require_mint_authority_revoked and not info.mint_authority_revoked:
            result.fail(f"mint authority still active ({info.mint_authority})")
        if cfg.require_freeze_authority_revoked and not info.freeze_authority_revoked:
            result.fail(f"freeze authority still active ({info.freeze_authority})")

        try:
            dist = await rpc.get_holder_distribution(snap.mint)
        except Exception as exc:  # noqa: BLE001
            log.warning("holder distribution unavailable for %s: %s", snap.symbol, exc)
            dist = None

        if dist is not None:
            if dist.top_holder_pct > cfg.max_top_holder_pct:
                result.fail(
                    f"top holder owns {dist.top_holder_pct:.1f}% > {cfg.max_top_holder_pct:.0f}%"
                )
            if dist.top10_pct > cfg.max_top10_holder_pct:
                result.fail(
                    f"top 10 own {dist.top10_pct:.1f}% > {cfg.max_top10_holder_pct:.0f}%"
                )

    if cfg.use_rugcheck and rugcheck is not None:
        report = await rugcheck.report(snap.mint)
        if report.available and report.score > cfg.max_rugcheck_score:
            detail = ", ".join(report.risks[:3]) or "no detail"
            result.fail(f"rugcheck score {report.score:.0f} > {cfg.max_rugcheck_score:.0f} ({detail})")

    return result
