from __future__ import annotations

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
    assert "429" in result.reasons[0]


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
