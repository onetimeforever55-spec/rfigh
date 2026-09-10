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
