"""pump.fun phase detection, gating and dev-holding checks."""

from __future__ import annotations

import pytest

from memebot.config import Config, ConfigError, PumpFunConfig, validate
from memebot.datasources.pumpfun import (
    PumpCoin, PumpPhase, estimate_curve_progress_pct, is_pumpfun_mint,
    phase_from_snapshot,
)
from memebot.screener import screen_dev_holdings, screen_market, screen_pumpfun

from .conftest import make_snapshot

CURVE_MINT = "AbcDeFgH1234pump"
GRADUATED_MINT = "XyzWvU5678pump"
OTHER_MINT = "SomeRandomMintAddress"


def pf(**overrides) -> PumpFunConfig:
    return PumpFunConfig(**{"enabled": True, **overrides})


# --- mint and phase detection ---------------------------------------------
def test_pump_suffix_identifies_a_pumpfun_mint() -> None:
    assert is_pumpfun_mint(CURVE_MINT)
    assert not is_pumpfun_mint(OTHER_MINT)


def test_phase_is_curve_on_the_pumpfun_venue() -> None:
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun")
    assert phase_from_snapshot(snap) is PumpPhase.CURVE


def test_phase_is_graduated_on_pumpswap() -> None:
    snap = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap")
    assert phase_from_snapshot(snap) is PumpPhase.GRADUATED


def test_non_pump_mint_on_an_amm_is_not_a_pumpfun_graduate() -> None:
    snap = make_snapshot(mint=OTHER_MINT, dex_id="raydium")
    assert phase_from_snapshot(snap) is PumpPhase.UNKNOWN


def test_curve_progress_tracks_market_cap() -> None:
    snap = make_snapshot(market_cap_usd=34_500)
    assert estimate_curve_progress_pct(snap, 69_000) == pytest.approx(50.0)


def test_curve_progress_is_clamped_to_100() -> None:
    snap = make_snapshot(market_cap_usd=500_000)
    assert estimate_curve_progress_pct(snap, 69_000) == 100.0


# --- phase gating ----------------------------------------------------------
def test_gate_is_inert_when_disabled() -> None:
    snap = make_snapshot(mint=OTHER_MINT, dex_id="raydium")
    assert screen_pumpfun(snap, PumpFunConfig(enabled=False)).passed


def test_non_pump_mint_is_rejected() -> None:
    snap = make_snapshot(mint=OTHER_MINT, dex_id="pumpswap")
    result = screen_pumpfun(snap, pf())
    assert not result.passed
    assert "pump` suffix" in result.reasons[0]


def test_graduated_only_rejects_a_curve_token() -> None:
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun")
    result = screen_pumpfun(snap, pf(phase="graduated"))
    assert not result.passed
    assert "wanted graduated" in result.reasons[0]


def test_graduated_only_accepts_a_graduated_token() -> None:
    snap = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap", age_minutes=200)
    assert screen_pumpfun(snap, pf(phase="graduated")).passed


def test_curve_only_rejects_a_graduated_token() -> None:
    snap = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap")
    result = screen_pumpfun(snap, pf(phase="curve"))
    assert not result.passed


def test_both_accepts_either_phase() -> None:
    curve = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun", market_cap_usd=45_000)
    graduated = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap")
    assert screen_pumpfun(curve, pf(phase="both")).passed
    assert screen_pumpfun(graduated, pf(phase="both")).passed


def test_empty_bonding_curve_is_rejected() -> None:
    # 7% full: launched, but nobody is buying yet.
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun", market_cap_usd=5_000)
    result = screen_pumpfun(snap, pf(phase="curve"))
    assert not result.passed
    assert "only 7% full" in result.reasons[0]


def test_nearly_graduated_curve_is_rejected() -> None:
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun", market_cap_usd=68_000)
    result = screen_pumpfun(snap, pf(phase="curve"))
    assert not result.passed
    assert "too close to graduation" in result.reasons[0]


def test_api_curve_progress_overrides_the_estimate() -> None:
    """Exact reserves from the API win over the market-cap approximation."""
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun", market_cap_usd=5_000)
    coin = PumpCoin(mint=CURVE_MINT, available=True, curve_progress_pct=60.0)
    assert screen_pumpfun(snap, pf(phase="curve"), coin).passed


def test_api_phase_overrides_the_venue() -> None:
    """A token that graduated between our scan and now is still graduated."""
    snap = make_snapshot(mint=CURVE_MINT, dex_id="pumpfun")
    coin = PumpCoin(mint=CURVE_MINT, available=True, graduated=True)
    assert screen_pumpfun(snap, pf(phase="graduated"), coin).passed


def test_unavailable_api_falls_back_to_the_venue() -> None:
    snap = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap", age_minutes=200)
    assert screen_pumpfun(snap, pf(phase="graduated"), PumpCoin(mint=GRADUATED_MINT)).passed


def test_stale_launch_is_rejected() -> None:
    snap = make_snapshot(mint=GRADUATED_MINT, dex_id="pumpswap", age_minutes=60 * 96)
    result = screen_pumpfun(snap, pf(max_minutes_since_launch=2_880))
    assert not result.passed
    assert "past" in result.reasons[0]


# --- venue allowlist -------------------------------------------------------
def test_dex_allowlist_rejects_other_venues(cfg: Config) -> None:
    cfg.screener.allowed_dex_ids = ["pumpfun", "pumpswap"]
    assert not screen_market(make_snapshot(dex_id="raydium"), cfg.screener).passed
    assert screen_market(make_snapshot(dex_id="pumpswap"), cfg.screener).passed


# --- dev holdings ----------------------------------------------------------
class FakeRPC:
    def __init__(self, creator_balance: float, supply: float = 1_000_000_000.0) -> None:
        self.creator_balance = creator_balance
        self.supply = supply

    async def get_mint_info(self, mint):
        from memebot.datasources.solana_rpc import MintInfo

        return MintInfo(mint=mint, decimals=6, supply=self.supply,
                        mint_authority=None, freeze_authority=None)

    async def get_token_balance(self, owner, mint):
        return self.creator_balance


class FakePumpFun:
    def __init__(self, coin: PumpCoin) -> None:
        self._coin = coin

    async def coin(self, mint: str) -> PumpCoin:
        return self._coin


async def test_dev_dumping_risk_is_rejected(cfg: Config) -> None:
    cfg.screener.max_dev_holding_pct = 12.0
    snap = make_snapshot(mint=CURVE_MINT)
    pumpfun = FakePumpFun(PumpCoin(mint=CURVE_MINT, available=True, creator="DevWallet"))

    result = await screen_dev_holdings(
        snap, cfg.screener, FakeRPC(creator_balance=300_000_000), pumpfun
    )

    assert not result.passed
    assert "creator still holds 30.0%" in result.reasons[0]


async def test_small_dev_holding_passes(cfg: Config) -> None:
    cfg.screener.max_dev_holding_pct = 12.0
    snap = make_snapshot(mint=CURVE_MINT)
    pumpfun = FakePumpFun(PumpCoin(mint=CURVE_MINT, available=True, creator="DevWallet"))

    result = await screen_dev_holdings(
        snap, cfg.screener, FakeRPC(creator_balance=20_000_000), pumpfun
    )

    assert result.passed


async def test_unknown_creator_skips_the_check(cfg: Config) -> None:
    """No creator address means no check — never a silent rejection."""
    cfg.screener.max_dev_holding_pct = 12.0
    snap = make_snapshot(mint=CURVE_MINT)
    pumpfun = FakePumpFun(PumpCoin(mint=CURVE_MINT, available=False))

    result = await screen_dev_holdings(
        snap, cfg.screener, FakeRPC(creator_balance=900_000_000), pumpfun
    )

    assert result.passed


async def test_check_is_off_by_default(cfg: Config) -> None:
    assert cfg.screener.max_dev_holding_pct == 100.0
    snap = make_snapshot(mint=CURVE_MINT)
    pumpfun = FakePumpFun(PumpCoin(mint=CURVE_MINT, available=True, creator="Dev"))
    assert (await screen_dev_holdings(
        snap, cfg.screener, FakeRPC(creator_balance=900_000_000), pumpfun
    )).passed


# --- config validation -----------------------------------------------------
def test_invalid_phase_is_rejected() -> None:
    cfg = Config()
    cfg.pumpfun.phase = "moon"
    with pytest.raises(ConfigError, match="pumpfun.phase"):
        validate(cfg)


def test_curve_phase_with_a_long_min_age_is_rejected() -> None:
    """A config that would silently never trade must fail at startup."""
    cfg = Config()
    cfg.pumpfun.enabled = True
    cfg.pumpfun.phase = "curve"
    cfg.screener.min_age_minutes = 60
    with pytest.raises(ConfigError, match="nothing would ever be bought"):
        validate(cfg)
