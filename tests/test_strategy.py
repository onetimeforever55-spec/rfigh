from __future__ import annotations

from memebot.config import Config
from memebot.models import Position, TokenSnapshot
from memebot.strategy import evaluate_exit, score_token

from .conftest import make_snapshot


def open_position(**kwargs) -> Position:
    defaults = dict(
        mint="MintAAA", symbol="PEPE", pair_address="Pair",
        entry_price_usd=0.001, entry_liquidity_usd=80_000.0,
        entry_volume_h1_usd=60_000.0, qty=1_000.0, original_qty=1_000.0,
        cost_usd=1.0, peak_price_usd=0.001, last_price_usd=0.001,
    )
    defaults.update(kwargs)
    return Position(**defaults)


# --- entry scoring ---------------------------------------------------------
def test_strong_momentum_scores_a_buy(cfg: Config) -> None:
    signal = score_token(
        make_snapshot(change_m5=6, change_h1=45, buys_h1=900, sells_h1=300,
                      vol_h1=120_000, liquidity_usd=150_000),
        cfg.strategy,
    )
    assert signal.should_buy, signal.reasons
    assert signal.score >= cfg.strategy.min_entry_score


def test_dumping_token_is_not_a_buy(cfg: Config) -> None:
    signal = score_token(
        make_snapshot(change_m5=-8, change_h1=-30, buys_h1=100, sells_h1=500),
        cfg.strategy,
    )
    assert not signal.should_buy
    assert signal.reasons


def test_blowoff_top_is_vetoed_despite_high_score(cfg: Config) -> None:
    signal = score_token(
        make_snapshot(change_m5=40, change_h1=800, buys_h1=2000, sells_h1=100,
                      vol_h1=500_000),
        cfg.strategy,
    )
    assert not signal.should_buy
    assert any("blow-off" in r for r in signal.reasons)


def test_sell_pressure_is_vetoed(cfg: Config) -> None:
    signal = score_token(
        make_snapshot(buys_h1=200, sells_h1=400, change_h1=20), cfg.strategy
    )
    assert not signal.should_buy
    assert any("buy/sell" in r for r in signal.reasons)


def test_score_components_are_bounded(cfg: Config) -> None:
    signal = score_token(
        make_snapshot(change_m5=100, change_h1=200, buys_h1=10_000, sells_h1=1,
                      vol_h1=10_000_000, liquidity_usd=2_000_000),
        cfg.strategy,
    )
    assert all(0.0 <= v <= 1.0 for v in signal.components.values())
    assert 0.0 <= signal.score <= 100.0


# --- exits -----------------------------------------------------------------
def test_stop_loss_exits_everything(cfg: Config) -> None:
    position = open_position()
    snap = make_snapshot(price_usd=0.0007)  # -30%
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit and decision.fraction == 1.0
    assert decision.urgent
    assert "stop loss" in decision.reason


def test_liquidity_pull_triggers_urgent_exit(cfg: Config) -> None:
    position = open_position()
    snap = make_snapshot(price_usd=0.0011, liquidity_usd=20_000)  # -75% liquidity
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit and decision.urgent
    assert "rug risk" in decision.reason


def test_liquidity_check_beats_take_profit(cfg: Config) -> None:
    """A rug in progress must win even when the position is deeply in profit."""
    position = open_position()
    snap = make_snapshot(price_usd=0.005, liquidity_usd=10_000)
    decision = evaluate_exit(position, snap, cfg.exits)
    assert "rug risk" in decision.reason
    assert decision.fraction == 1.0


def test_take_profit_ladder_sells_a_slice(cfg: Config) -> None:
    position = open_position()
    snap = make_snapshot(price_usd=0.0015)  # +50%, first rung is +40%
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit
    # First rung sells 40% of the original size, and none has been sold yet.
    assert decision.fraction == 0.4
    assert "take profit 1" in decision.reason


def test_ladder_fraction_is_rebased_on_remaining_size(cfg: Config) -> None:
    """Rung 2 sells 30% of the ORIGINAL size, i.e. half of the 60% left."""
    position = open_position(qty=600.0, ladder_steps_done=1)
    snap = make_snapshot(price_usd=0.0025)  # +150%, rung 2 is +100%
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit
    assert decision.fraction == 0.5
    assert "take profit 2" in decision.reason


def test_completed_ladder_step_is_not_repeated(cfg: Config) -> None:
    position = open_position(qty=600.0, ladder_steps_done=1)
    snap = make_snapshot(price_usd=0.0015)  # +50%: rung 1 done, rung 2 not hit
    decision = evaluate_exit(position, snap, cfg.exits)
    assert not decision.should_exit


def test_trailing_stop_fires_after_activation(cfg: Config) -> None:
    # Peaked at +100%, now back to +55%: a 22% drawdown off the peak.
    position = open_position(peak_price_usd=0.002, ladder_steps_done=3)
    snap = make_snapshot(price_usd=0.00155)
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit and decision.fraction == 1.0
    assert "trailing stop" in decision.reason


def test_trailing_stop_stays_disarmed_below_activation(cfg: Config) -> None:
    # Peak was only +10%, so the trailing stop never armed.
    position = open_position(peak_price_usd=0.0011)
    snap = make_snapshot(price_usd=0.00095)
    decision = evaluate_exit(position, snap, cfg.exits)
    assert not decision.should_exit


def test_volume_collapse_exits_after_grace_period(cfg: Config) -> None:
    from memebot.models import now_ms

    position = open_position(opened_at_ms=now_ms() - 60 * 60_000)  # 1h old
    snap = make_snapshot(price_usd=0.00105, vol_h1=3_000)  # -95% volume
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit
    assert "momentum gone" in decision.reason


def test_volume_collapse_ignored_during_grace_period(cfg: Config) -> None:
    from memebot.models import now_ms

    position = open_position(opened_at_ms=now_ms() - 5 * 60_000)  # 5m old
    snap = make_snapshot(price_usd=0.00105, vol_h1=3_000)
    decision = evaluate_exit(position, snap, cfg.exits)
    assert not decision.should_exit


def test_time_stop_exits(cfg: Config) -> None:
    from memebot.models import now_ms

    position = open_position(opened_at_ms=now_ms() - 300 * 60_000)  # 5h old
    snap = make_snapshot(price_usd=0.00105)
    decision = evaluate_exit(position, snap, cfg.exits)
    assert decision.should_exit
    assert "max hold" in decision.reason


def test_healthy_position_is_held(cfg: Config) -> None:
    position = open_position()
    snap = make_snapshot(price_usd=0.00110)  # +10%, nothing triggered
    assert not evaluate_exit(position, snap, cfg.exits).should_exit


def test_missing_price_never_forces_a_sale(cfg: Config) -> None:
    position = open_position()
    snap = TokenSnapshot.from_dexscreener({"chainId": "solana", "priceUsd": "0"})
    assert not evaluate_exit(position, snap, cfg.exits).should_exit
