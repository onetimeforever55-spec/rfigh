"""End-to-end tests of the engine against a fake HTTP layer — no network."""

from __future__ import annotations

from typing import Any

import pytest

from memebot.config import Config
from memebot.engine import TradingEngine
from memebot.execution.paper import PaperExecutor
from memebot.storage import Storage

from .conftest import make_pair


class FakeHttp:
    """Stands in for HttpClient, serving canned DexScreener/RPC responses."""

    def __init__(self) -> None:
        self.pairs: list[dict[str, Any]] = []
        self.mint_authority: str | None = None
        self.freeze_authority: str | None = None
        self.top_holder_pct = 5.0
        self.calls: list[str] = []

    # -- HttpClient API ----------------------------------------------------
    async def start(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def get_json(self, url: str, *, params=None, headers=None) -> Any:
        self.calls.append(url)
        if "/latest/dex/search" in url or "/latest/dex/tokens/" in url:
            return {"pairs": self.pairs}
        if "token-boosts" in url or "token-profiles" in url:
            return []
        if "rugcheck" in url:
            return {"score_normalised": 5, "risks": []}
        raise AssertionError(f"unexpected GET {url}")

    async def post_json(self, url: str, *, json=None, headers=None) -> Any:
        self.calls.append(f"{url}:{json.get('method')}")
        method = json.get("method")
        if method == "getAccountInfo":
            return {
                "result": {
                    "value": {
                        "data": {
                            "parsed": {
                                "info": {
                                    "decimals": 6,
                                    "supply": "1000000000000000",
                                    "mintAuthority": self.mint_authority,
                                    "freezeAuthority": self.freeze_authority,
                                }
                            }
                        }
                    }
                }
            }
        if method == "getTokenLargestAccounts":
            # First entry is the AMM vault, which screening ignores.
            return {
                "result": {
                    "value": [
                        {"uiAmount": 400_000_000.0},
                        {"uiAmount": 1_000_000_000 * self.top_holder_pct / 100},
                        {"uiAmount": 1_000_000.0},
                    ]
                }
            }
        if method == "getTokenSupply":
            return {"result": {"value": {"uiAmount": 1_000_000_000.0}}}
        raise AssertionError(f"unexpected RPC {method}")


def build_engine(cfg: Config, http: FakeHttp) -> TradingEngine:
    storage = Storage(":memory:")
    return TradingEngine(
        cfg, http=http, storage=storage, executor=PaperExecutor(cfg)
    )


@pytest.fixture
def cfg() -> Config:
    cfg = Config()
    cfg.engine.discovery_queries = ["SOL"]
    return cfg


# --- scanning --------------------------------------------------------------
async def test_scan_ranks_candidates_without_trading(cfg: Config) -> None:
    http = FakeHttp()
    http.pairs = [
        make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000),
        make_pair(mint="Weak", symbol="WEAK", change_m5=-5, change_h1=-20,
                  buys_h1=100, sells_h1=400),
        make_pair(mint="Thin", symbol="THIN", liquidity_usd=1_000),
    ]
    engine = build_engine(cfg, http)

    report = await engine.scan()

    assert report.scanned == 3
    assert report.passed_screen == 2           # THIN fails the safety screen
    assert report.signals[0].symbol == "GOOD"  # ranked best
    assert report.signals[0].should_buy
    assert not report.signals[-1].should_buy
    assert engine.portfolio.open_count == 0    # scan never trades


# --- entries ---------------------------------------------------------------
async def test_engine_opens_a_position_on_a_strong_signal(cfg: Config) -> None:
    http = FakeHttp()
    http.pairs = [
        make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 1
    position = engine.portfolio.get("Good")
    assert position is not None
    assert position.cost_usd == pytest.approx(cfg.risk.position_size_usd)
    assert position.entry_score >= cfg.strategy.min_entry_score


async def test_live_mint_authority_blocks_the_buy(cfg: Config) -> None:
    http = FakeHttp()
    http.mint_authority = "AttackerCanPrintMoreOfThis"
    http.pairs = [
        make_pair(mint="Rug", symbol="RUG2", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 0


async def test_concentrated_holders_block_the_buy(cfg: Config) -> None:
    http = FakeHttp()
    http.top_holder_pct = 45.0   # one wallet holds 45% of supply
    http.pairs = [
        make_pair(mint="Whale", symbol="WHALE", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 0


async def test_max_open_positions_is_respected(cfg: Config) -> None:
    cfg.risk.max_open_positions = 2
    http = FakeHttp()
    http.pairs = [
        make_pair(mint=f"Mint{i}", symbol=f"TOK{i}", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
        for i in range(5)
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 2


async def test_the_same_token_is_not_bought_twice(cfg: Config) -> None:
    http = FakeHttp()
    http.pairs = [
        make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()
    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 1


# --- exits -----------------------------------------------------------------
async def test_stop_loss_closes_the_position(cfg: Config) -> None:
    http = FakeHttp()
    entry_pair = make_pair(mint="Good", symbol="GOOD", price_usd=0.001,
                           change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                           vol_h1=120_000, liquidity_usd=150_000)
    http.pairs = [entry_pair]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()
    assert engine.portfolio.open_count == 1

    # Price halves.
    http.pairs = [dict(entry_pair, priceUsd="0.0005")]
    await engine.manage_positions()

    assert engine.portfolio.open_count == 0
    closed = engine.storage.load_closed_positions()
    assert len(closed) == 1
    assert "stop loss" in closed[0].close_reason
    assert closed[0].realized_pnl_usd < 0


async def test_take_profit_trims_but_keeps_the_position(cfg: Config) -> None:
    http = FakeHttp()
    entry_pair = make_pair(mint="Good", symbol="GOOD", price_usd=0.001,
                           change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                           vol_h1=120_000, liquidity_usd=150_000)
    http.pairs = [entry_pair]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()

    http.pairs = [dict(entry_pair, priceUsd="0.0016")]  # +60%
    await engine.manage_positions()

    position = engine.portfolio.get("Good")
    assert position is not None
    assert position.ladder_steps_done == 1
    assert position.remaining_fraction == pytest.approx(0.6, abs=0.01)
    assert position.realized_pnl_usd > 0


async def test_liquidity_rug_is_exited_urgently(cfg: Config) -> None:
    http = FakeHttp()
    entry_pair = make_pair(mint="Good", symbol="GOOD", price_usd=0.001,
                           change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                           vol_h1=120_000, liquidity_usd=150_000)
    http.pairs = [entry_pair]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()

    # Liquidity is pulled: the pool drops to 5% of what it was.
    rugged = dict(entry_pair, priceUsd="0.0009", liquidity={"usd": 7_500})
    http.pairs = [rugged]
    await engine.manage_positions()

    assert engine.portfolio.open_count == 0
    closed = engine.storage.load_closed_positions()
    assert "rug risk" in closed[0].close_reason


async def test_cooldown_prevents_an_immediate_rebuy(cfg: Config) -> None:
    http = FakeHttp()
    entry_pair = make_pair(mint="Good", symbol="GOOD", price_usd=0.001,
                           change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                           vol_h1=120_000, liquidity_usd=150_000)
    http.pairs = [entry_pair]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()

    http.pairs = [dict(entry_pair, priceUsd="0.0005")]
    await engine.manage_positions()          # stopped out, cooldown starts
    assert engine.portfolio.open_count == 0

    http.pairs = [entry_pair]                # signal is attractive again
    await engine.discover_and_trade()
    assert engine.portfolio.open_count == 0  # but the cooldown holds


async def test_missing_market_data_does_not_close_a_position(cfg: Config) -> None:
    http = FakeHttp()
    entry_pair = make_pair(mint="Good", symbol="GOOD", price_usd=0.001,
                           change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                           vol_h1=120_000, liquidity_usd=150_000)
    http.pairs = [entry_pair]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()

    http.pairs = []            # the API stops returning the pair
    await engine.manage_positions()

    assert engine.portfolio.open_count == 1


async def test_positions_survive_a_restart(cfg: Config) -> None:
    http = FakeHttp()
    http.pairs = [
        make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
    ]
    storage = Storage(":memory:")
    engine = TradingEngine(cfg, http=http, storage=storage, executor=PaperExecutor(cfg))
    await engine.discover_and_trade()
    assert engine.portfolio.open_count == 1

    # A new engine sharing the same database restores the open position.
    restarted = TradingEngine(cfg, http=http, storage=storage, executor=PaperExecutor(cfg))
    assert restarted.portfolio.open_count == 1
    assert restarted.portfolio.get("Good") is not None


async def test_panic_liquidates_everything(cfg: Config) -> None:
    http = FakeHttp()
    http.pairs = [
        make_pair(mint=f"Mint{i}", symbol=f"TOK{i}", change_m5=6, change_h1=45,
                  buys_h1=900, sells_h1=300, vol_h1=120_000, liquidity_usd=150_000)
        for i in range(3)
    ]
    engine = build_engine(cfg, http)
    await engine.discover_and_trade()
    assert engine.portfolio.open_count == 3

    sold = await engine.liquidate_all()

    assert sold == 3
    assert engine.portfolio.open_count == 0


# --- pump.fun mode ---------------------------------------------------------
async def test_pumpfun_mode_only_buys_graduated_pump_tokens(cfg: Config) -> None:
    cfg.pumpfun.enabled = True
    cfg.pumpfun.phase = "graduated"
    cfg.pumpfun.use_api = False        # rely on the venue, no API calls
    cfg.risk.max_open_positions = 5

    strong = dict(change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                  vol_h1=120_000, liquidity_usd=150_000)
    http = FakeHttp()
    http.pairs = [
        # Graduated pump.fun token — the only one that should be bought.
        make_pair(mint="Graduated1pump", symbol="GRAD", dex_id="pumpswap", **strong),
        # Still on the bonding curve.
        make_pair(mint="OnCurve1pump", symbol="CURVE", dex_id="pumpfun", **strong),
        # Ordinary Raydium token that never touched pump.fun.
        make_pair(mint="NotAPumpToken", symbol="OTHER", dex_id="raydium", **strong),
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 1
    assert engine.portfolio.get("Graduated1pump") is not None


async def test_pumpfun_curve_mode_respects_the_progress_window(cfg: Config) -> None:
    cfg.pumpfun.enabled = True
    cfg.pumpfun.phase = "curve"
    cfg.pumpfun.use_api = False
    cfg.screener.min_age_minutes = 3
    cfg.screener.min_liquidity_usd = 5_000
    cfg.screener.min_volume_h24_usd = 20_000
    cfg.screener.min_market_cap_usd = 10_000
    cfg.screener.max_mcap_liquidity_ratio = 500

    strong = dict(change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                  vol_h1=120_000, liquidity_usd=30_000, age_minutes=25)
    http = FakeHttp()
    http.pairs = [
        # ~65% of the way to graduation: in the window.
        make_pair(mint="Rising1pump", symbol="RISE", dex_id="pumpfun",
                  market_cap_usd=45_000, **strong),
        # ~9% full: no demand yet.
        make_pair(mint="Empty1pump", symbol="EMPTY", dex_id="pumpfun",
                  market_cap_usd=6_000, **strong),
        # ~99% full: the snipers already own this one.
        make_pair(mint="Late1pump", symbol="LATE", dex_id="pumpfun",
                  market_cap_usd=68_500, **strong),
    ]
    engine = build_engine(cfg, http)

    await engine.discover_and_trade()

    assert engine.portfolio.open_count == 1
    assert engine.portfolio.get("Rising1pump") is not None
