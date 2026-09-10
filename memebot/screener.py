"""Safety screening — the layer that decides what is even allowed to be bought.

Two tiers:
  1. `screen_market` — cheap, uses only the DexScreener snapshot we already have.
  2. `screen_onchain` — costs RPC calls, so it only runs on tokens that passed
     tier 1 and are about to be bought.
"""

from __future__ import annotations

import logging

from .config import PumpFunConfig, ScreenerConfig
from .datasources.pumpfun import (
    PumpCoin, PumpFun, PumpPhase, estimate_curve_progress_pct, is_pumpfun_mint,
    phase_from_snapshot,
)
from .datasources.rugcheck import RugCheck
from .datasources.solana_rpc import SolanaRPC
from .models import ScreenResult, TokenSnapshot

log = logging.getLogger(__name__)


def screen_market(snap: TokenSnapshot, cfg: ScreenerConfig) -> ScreenResult:
    """Cheap filters over a market snapshot. No network calls."""
    result = ScreenResult(passed=True)

    if snap.chain_id != cfg.chain_id:
        return result.fail(f"chain {snap.chain_id} != {cfg.chain_id}", "chain")
    if snap.mint in cfg.blocked_mints:
        return result.fail("mint is blocklisted", "blocklist")
    if snap.dex_id in cfg.blocked_dex_ids:
        return result.fail(f"dex {snap.dex_id} is blocklisted", "venue")
    if cfg.allowed_dex_ids and snap.dex_id not in cfg.allowed_dex_ids:
        return result.fail(f"dex {snap.dex_id} is not in the allowed venues", "venue")
    if cfg.allowed_quote_mints and snap.quote_mint not in cfg.allowed_quote_mints:
        return result.fail(f"quote token {snap.quote_symbol} not allowed", "quote_token")

    symbol_lower = f"{snap.symbol} {snap.name}".lower()
    for keyword in cfg.blocked_symbol_keywords:
        if keyword.lower() in symbol_lower:
            return result.fail(f"name contains blocked keyword {keyword!r}", "blocklist")

    if snap.price_usd <= 0:
        return result.fail("no price", "no_price")

    # Liquidity.
    if snap.liquidity_usd < cfg.min_liquidity_usd:
        result.fail(f"liquidity ${snap.liquidity_usd:,.0f} < ${cfg.min_liquidity_usd:,.0f}", "min_liquidity")
    if snap.liquidity_usd > cfg.max_liquidity_usd:
        result.fail(f"liquidity ${snap.liquidity_usd:,.0f} > ${cfg.max_liquidity_usd:,.0f}", "max_liquidity")

    # Activity.
    h1, h24 = snap.window("h1"), snap.window("h24")
    if h1.volume_usd < cfg.min_volume_h1_usd:
        result.fail(f"1h volume ${h1.volume_usd:,.0f} < ${cfg.min_volume_h1_usd:,.0f}", "min_volume_h1")
    if h24.volume_usd < cfg.min_volume_h24_usd:
        result.fail(f"24h volume ${h24.volume_usd:,.0f} < ${cfg.min_volume_h24_usd:,.0f}", "min_volume_h24")
    if h1.txns < cfg.min_txns_h1:
        result.fail(f"{h1.txns} txns in 1h < {cfg.min_txns_h1}", "min_txns_h1")

    ratio = snap.volume_liquidity_ratio
    if ratio < cfg.min_volume_liquidity_ratio:
        result.fail(f"volume/liquidity {ratio:.2f} < {cfg.min_volume_liquidity_ratio}", "min_vol_liq_ratio")
    if ratio > cfg.max_volume_liquidity_ratio:
        result.fail(f"volume/liquidity {ratio:.1f} > {cfg.max_volume_liquidity_ratio} (wash trading?)", "wash_trading")

    # Age.
    age_min = snap.age_minutes
    if age_min < cfg.min_age_minutes:
        result.fail(f"pair is {age_min:.0f}m old < {cfg.min_age_minutes:.0f}m", "min_age")
    if age_min > cfg.max_age_hours * 60:
        result.fail(f"pair is {age_min / 60:.0f}h old > {cfg.max_age_hours:.0f}h", "max_age")

    # Valuation.
    mcap = snap.market_cap_usd or snap.fdv_usd
    if mcap and mcap < cfg.min_market_cap_usd:
        result.fail(f"mcap ${mcap:,.0f} < ${cfg.min_market_cap_usd:,.0f}", "min_mcap")
    if mcap and mcap > cfg.max_market_cap_usd:
        result.fail(f"mcap ${mcap:,.0f} > ${cfg.max_market_cap_usd:,.0f}", "max_mcap")
    if snap.mcap_liquidity_ratio > cfg.max_mcap_liquidity_ratio:
        result.fail(
            f"mcap/liquidity {snap.mcap_liquidity_ratio:.0f} > "
            f"{cfg.max_mcap_liquidity_ratio:.0f} (thin float)",
            "thin_float",
        )

    if cfg.require_socials and not snap.has_socials:
        result.fail("no socials or website", "socials")

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
            return result.fail(f"mint info unavailable ({exc})", "rpc_error")

        if info is None:
            return result.fail("mint account not found", "rpc_error")
        if cfg.require_mint_authority_revoked and not info.mint_authority_revoked:
            result.fail(f"mint authority still active ({info.mint_authority})", "mint_authority")
        if cfg.require_freeze_authority_revoked and not info.freeze_authority_revoked:
            result.fail(f"freeze authority still active ({info.freeze_authority})", "freeze_authority")

        try:
            dist = await rpc.get_holder_distribution(snap.mint)
        except Exception as exc:  # noqa: BLE001
            log.warning("holder distribution unavailable for %s: %s", snap.symbol, exc)
            dist = None

        if dist is not None:
            if dist.top_holder_pct > cfg.max_top_holder_pct:
                result.fail(
                    f"top holder owns {dist.top_holder_pct:.1f}% > {cfg.max_top_holder_pct:.0f}%",
                    "holder_concentration",
                )
            if dist.top10_pct > cfg.max_top10_holder_pct:
                result.fail(
                    f"top 10 own {dist.top10_pct:.1f}% > {cfg.max_top10_holder_pct:.0f}%",
                    "holder_concentration",
                )

    if cfg.use_rugcheck and rugcheck is not None:
        report = await rugcheck.report(snap.mint)
        if report.available and report.score > cfg.max_rugcheck_score:
            detail = ", ".join(report.risks[:3]) or "no detail"
            result.fail(f"rugcheck score {report.score:.0f} > {cfg.max_rugcheck_score:.0f} ({detail})", "rugcheck")

    return result


def screen_pumpfun(
    snap: TokenSnapshot,
    cfg: PumpFunConfig,
    coin: PumpCoin | None = None,
) -> ScreenResult:
    """pump.fun phase gating. Cheap: works off the DexScreener snapshot.

    `coin` is optional enrichment from the pump.fun API; when it is missing or
    unavailable the phase and curve progress are derived from the snapshot.
    """
    result = ScreenResult(passed=True)
    if not cfg.enabled:
        return result

    if cfg.require_pump_suffix and not is_pumpfun_mint(snap.mint):
        return result.fail("not a pump.fun mint (no `pump` suffix)", "pump_suffix")

    # Prefer the API's answer, fall back to the venue the pair trades on.
    phase = coin.phase if coin is not None and coin.available else PumpPhase.UNKNOWN
    if phase is PumpPhase.UNKNOWN:
        phase = phase_from_snapshot(snap)

    if phase is PumpPhase.UNKNOWN:
        return result.fail(f"cannot tell the launch phase from dex {snap.dex_id!r}", "pump_phase")

    if cfg.phase != "both" and phase.value != cfg.phase:
        return result.fail(f"token is {phase.value}, wanted {cfg.phase}", "pump_phase")

    if phase is PumpPhase.CURVE:
        progress = (
            coin.curve_progress_pct
            if coin is not None and coin.curve_progress_pct is not None
            else estimate_curve_progress_pct(snap, cfg.graduation_market_cap_usd)
        )
        if progress < cfg.min_curve_progress_pct:
            result.fail(
                f"bonding curve only {progress:.0f}% full "
                f"(need {cfg.min_curve_progress_pct:.0f}%)",
                "curve_progress",
            )
        if progress > cfg.max_curve_progress_pct:
            result.fail(
                f"bonding curve {progress:.0f}% full, too close to graduation "
                f"(max {cfg.max_curve_progress_pct:.0f}%)",
                "curve_progress",
            )

    if snap.age_minutes > cfg.max_minutes_since_launch:
        result.fail(
            f"launched {snap.age_minutes / 60:.0f}h ago, past "
            f"{cfg.max_minutes_since_launch / 60:.0f}h",
            "pump_stale",
        )

    return result


async def screen_dev_holdings(
    snap: TokenSnapshot,
    cfg: ScreenerConfig,
    rpc: SolanaRPC | None,
    pumpfun: PumpFun | None,
) -> ScreenResult:
    """Reject a token whose creator still holds too much of the supply.

    On a launchpad this is the rug that actually happens: there is no LP to
    pull, so the dev dumps their own allocation into your bid. Needs the
    creator address, which only the pump.fun API knows — when it is
    unavailable the check is skipped, and `screen_onchain`'s top-holder
    concentration limit is what remains.
    """
    result = ScreenResult(passed=True)
    if cfg.max_dev_holding_pct >= 100 or rpc is None or pumpfun is None:
        return result

    coin = await pumpfun.coin(snap.mint)
    if not coin.available or not coin.creator:
        log.debug("creator unknown for %s, skipping the dev-holding check", snap.symbol)
        return result

    try:
        info = await rpc.get_mint_info(snap.mint)
        balance = await rpc.get_token_balance(coin.creator, snap.mint)
    except Exception as exc:  # noqa: BLE001
        log.warning("dev-holding check failed for %s: %s", snap.symbol, exc)
        return result

    if info is None or info.supply <= 0:
        return result

    held_pct = balance / info.supply * 100.0
    if held_pct > cfg.max_dev_holding_pct:
        result.fail(
            f"creator still holds {held_pct:.1f}% of supply "
            f"(max {cfg.max_dev_holding_pct:.0f}%)",
            "dev_holdings",
        )
    return result
