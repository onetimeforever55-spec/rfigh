from __future__ import annotations

import pytest

from memebot.config import Config
from memebot.screener import screen_market

from .conftest import make_snapshot


def test_healthy_token_passes(cfg: Config) -> None:
    result = screen_market(make_snapshot(), cfg.screener)
    assert result.passed, result.reasons


def test_thin_liquidity_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(liquidity_usd=5_000), cfg.screener)
    assert not result.passed
    assert any("liquidity" in r for r in result.reasons)


def test_brand_new_pair_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(age_minutes=2), cfg.screener)
    assert not result.passed
    assert any("old" in r for r in result.reasons)


def test_stale_pair_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(age_minutes=60 * 24 * 30), cfg.screener)
    assert not result.passed


def test_wash_trading_ratio_is_rejected(cfg: Config) -> None:
    # 100x the pool traded in 24h on a small pool: not real volume.
    result = screen_market(
        make_snapshot(liquidity_usd=25_000, vol_h24=5_000_000), cfg.screener
    )
    assert not result.passed
    assert any("wash trading" in r for r in result.reasons)


def test_thin_float_is_rejected(cfg: Config) -> None:
    result = screen_market(
        make_snapshot(liquidity_usd=25_000, market_cap_usd=25_000_000), cfg.screener
    )
    assert not result.passed
    assert any("thin float" in r for r in result.reasons)


def test_wrong_chain_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(chain_id="ethereum"), cfg.screener)
    assert not result.passed


def test_unlisted_quote_token_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(quote_mint="SomeRandomMint"), cfg.screener)
    assert not result.passed
    assert any("quote token" in r for r in result.reasons)


def test_blocked_keyword_in_name_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(symbol="SCAMCOIN"), cfg.screener)
    assert not result.passed


def test_blocklisted_mint_is_rejected(cfg: Config) -> None:
    cfg.screener.blocked_mints = ["MintAAA"]
    result = screen_market(make_snapshot(mint="MintAAA"), cfg.screener)
    assert not result.passed


def test_low_activity_is_rejected(cfg: Config) -> None:
    result = screen_market(make_snapshot(buys_h1=10, sells_h1=5), cfg.screener)
    assert not result.passed
    assert any("txns" in r for r in result.reasons)


def test_requires_socials_when_configured(cfg: Config) -> None:
    cfg.screener.require_socials = True
    assert not screen_market(make_snapshot(socials=False), cfg.screener).passed
    assert screen_market(make_snapshot(socials=True), cfg.screener).passed


# --- on-chain checks that cannot be reached --------------------------------
class _RPC:
    """Minimal SolanaRPC stand-in whose holder lookup can be made to fail."""

    def __init__(self, *, holders_raise=None, holders=None):
        self.holders_raise = holders_raise
        self.holders = holders

    async def get_mint_info(self, mint):
        from memebot.datasources.solana_rpc import MintInfo

        return MintInfo(
            mint=mint, decimals=6, supply=1_000_000_000,
            mint_authority=None, freeze_authority=None,
        )

    async def get_holder_distribution(self, mint):
        if self.holders_raise is not None:
            raise self.holders_raise
        return self.holders


async def test_unreadable_holder_data_blocks_the_buy(cfg, snap):
    """Regression: this used to fail OPEN.

    A rate-limited RPC skipped the holder-concentration check entirely and the
    token passed, so the advertised protection silently never ran. Observed on
    every buy of a live paper session against the public RPC.
    """
    from memebot.screener import screen_onchain

    rpc = _RPC(holders_raise=RuntimeError("429 Too many requests"))
    result = await screen_onchain(snap, cfg.screener, rpc, None)

    assert not result.passed
    assert "rpc_error" in result.codes
    assert "refusing to buy" in result.reasons[0]


async def test_empty_holder_data_blocks_the_buy(cfg, snap):
    from memebot.screener import screen_onchain

    result = await screen_onchain(snap, cfg.screener, _RPC(holders=None), None)
    assert not result.passed
    assert "rpc_error" in result.codes


async def test_the_holder_requirement_can_be_waived_deliberately(cfg, snap):
    from memebot.screener import screen_onchain

    cfg.screener.require_holder_data = False
    cfg.screener.use_rugcheck = False
    rpc = _RPC(holders_raise=RuntimeError("429 Too many requests"))
    result = await screen_onchain(snap, cfg.screener, rpc, None)
    assert result.passed


async def test_readable_holder_data_still_applies_the_limits(cfg, snap):
    from memebot.datasources.solana_rpc import HolderDistribution
    from memebot.screener import screen_onchain

    cfg.screener.use_rugcheck = False
    rpc = _RPC(holders=HolderDistribution(top_holder_pct=80.0, top10_pct=95.0, holders=[80.0, 15.0]))
    result = await screen_onchain(snap, cfg.screener, rpc, None)
    assert not result.passed
    assert "holder_concentration" in result.codes


# --- the free fallback for holder data -------------------------------------
class _Rug:
    """RugCheck stand-in. `holders` is what the free path is really for."""

    def __init__(self, *, score=5.0, holders=None, available=True):
        self.score = score
        self.holders = holders
        self.available = available
        self.calls = 0

    async def report(self, mint):
        from memebot.datasources.rugcheck import RiskReport

        self.calls += 1
        return RiskReport(mint=mint, score=self.score, risks=[],
                          available=self.available, holders=self.holders)


def _dist(top, top10):
    from memebot.datasources.solana_rpc import HolderDistribution

    return HolderDistribution(top_holder_pct=top, top10_pct=top10, holders=[top])


async def test_rugcheck_answers_when_the_rpc_refuses(cfg, snap):
    """The whole point: on a free RPC `getTokenLargestAccounts` always 429s,
    and without a second source the bot could never buy anything."""
    from memebot.screener import screen_onchain

    rpc = _RPC(holders_raise=RuntimeError("429 Too many requests"))
    rug = _Rug(holders=_dist(4.0, 20.0))
    result = await screen_onchain(snap, cfg.screener, rpc, rug)

    assert result.passed
    assert rug.calls == 1


async def test_rugcheck_data_still_enforces_the_limits(cfg, snap):
    """A fallback that waves everything through would be worse than useless."""
    from memebot.screener import screen_onchain

    rpc = _RPC(holders_raise=RuntimeError("429 Too many requests"))
    result = await screen_onchain(
        cfg=cfg.screener, snap=snap, rpc=rpc, rugcheck=_Rug(holders=_dist(90.0, 99.0))
    )
    assert not result.passed
    assert "holder_concentration" in result.codes
    assert "RugCheck" in result.reasons[0]


async def test_the_chain_wins_when_both_can_answer(cfg, snap):
    """RugCheck is a third party; first-party data is preferred when available."""
    from memebot.screener import screen_onchain

    rpc = _RPC(holders=_dist(90.0, 99.0))      # chain says: concentrated
    rug = _Rug(holders=_dist(1.0, 5.0))        # third party says: fine
    result = await screen_onchain(snap, cfg.screener, rpc, rug)

    assert not result.passed
    assert "via RPC" in result.reasons[0]


async def test_both_sources_failing_still_blocks_the_buy(cfg, snap):
    from memebot.screener import screen_onchain

    rpc = _RPC(holders_raise=RuntimeError("429"))
    result = await screen_onchain(
        snap, cfg.screener, rpc, _Rug(available=False, holders=None)
    )
    assert not result.passed
    assert "rpc_error" in result.codes


async def test_rugcheck_only_mode_skips_the_doomed_rpc_call(cfg, snap):
    """When you know your endpoint will refuse, do not spend a request and a
    log line on it every single cycle."""
    from memebot.screener import screen_onchain

    cfg.screener.holder_data_source = "rugcheck"
    rpc = _RPC(holders_raise=AssertionError("the RPC must not be asked"))
    result = await screen_onchain(snap, cfg.screener, rpc, _Rug(holders=_dist(3.0, 15.0)))
    assert result.passed


async def test_rpc_only_mode_does_not_fall_back(cfg, snap):
    """The opposite guarantee: 'rpc' means first-party data or nothing."""
    from memebot.screener import screen_onchain

    cfg.screener.holder_data_source = "rpc"
    rpc = _RPC(holders_raise=RuntimeError("429"))
    result = await screen_onchain(snap, cfg.screener, rpc, _Rug(holders=_dist(3.0, 15.0)))
    assert not result.passed
    assert "rpc_error" in result.codes


def test_holder_percentages_drop_the_pool_vault():
    """On a graduated token the biggest account is the AMM pool. Counting it
    would flag every healthy token as dangerously concentrated."""
    from memebot.datasources.rugcheck import _holders_from_report

    dist = _holders_from_report({"topHolders": [
        {"pct": 92.04}, {"pct": 0.83}, {"pct": 0.50}, {"pct": 0.42},
    ]})
    assert dist.top_holder_pct == pytest.approx(0.83)
    assert dist.top10_pct == pytest.approx(1.75)


def test_a_report_with_no_holders_yields_nothing_rather_than_zero():
    """Returning 0% would read as 'perfectly distributed' and pass every limit."""
    from memebot.datasources.rugcheck import _holders_from_report

    assert _holders_from_report({}) is None
    assert _holders_from_report({"topHolders": []}) is None
