from __future__ import annotations

from memebot.config import RiskConfig
from memebot.risk import RiskManager


def manager(**overrides) -> RiskManager:
    cfg = RiskConfig(**overrides)
    m = RiskManager(cfg)
    m.roll_day()
    return m


def entry(m: RiskManager, **overrides):
    kwargs = dict(
        mint="MintAAA", equity_usd=1_000.0, cash_usd=1_000.0,
        open_positions=0, already_held=False,
    )
    kwargs.update(overrides)
    return m.check_entry(**kwargs)


def test_normal_entry_is_allowed() -> None:
    decision = entry(manager())
    assert decision.allowed
    assert decision.size_usd == 25.0


def test_size_is_capped_by_percent_of_equity() -> None:
    # 3% of $300 is $9, below the $25 target.
    decision = entry(manager(), equity_usd=300.0, cash_usd=300.0)
    assert decision.allowed
    assert decision.size_usd == 9.0


def test_size_below_a_quarter_of_target_is_refused() -> None:
    decision = entry(manager(), equity_usd=100.0, cash_usd=100.0)
    assert not decision.allowed
    assert "too small" in decision.reason


def test_cash_reserve_caps_the_size() -> None:
    # $1000 cash minus a $990 reserve leaves $10 to spend, below the $25 target.
    decision = entry(manager(min_cash_reserve_usd=990.0), cash_usd=1_000.0)
    assert decision.allowed
    assert decision.size_usd == 10.0


def test_cash_reserve_can_block_the_trade_entirely() -> None:
    # Only $5 spendable, under the "too small to be worth the fees" floor.
    decision = entry(manager(min_cash_reserve_usd=995.0), cash_usd=1_000.0)
    assert not decision.allowed
    assert "too small" in decision.reason


def test_already_held_is_refused() -> None:
    assert not entry(manager(), already_held=True).allowed


def test_max_open_positions_is_enforced() -> None:
    decision = entry(manager(max_open_positions=3), open_positions=3)
    assert not decision.allowed
    assert "max open positions" in decision.reason


def test_daily_trade_cap_is_enforced() -> None:
    m = manager(max_daily_trades=2)
    m.record_trade()
    m.record_trade()
    assert not entry(m).allowed


def test_daily_loss_limit_halts_trading() -> None:
    m = manager(max_daily_loss_usd=50.0)
    m.record_trade(-60.0)
    decision = entry(m)
    assert not decision.allowed
    assert "daily loss limit" in decision.reason
    # The halt persists even for a different token.
    assert not entry(m, mint="OtherMint").allowed


def test_rebuy_cooldown_blocks_then_expires() -> None:
    m = manager(rebuy_cooldown_minutes=10.0)
    m.start_cooldown("MintAAA")
    assert not entry(m).allowed
    assert entry(m, mint="OtherMint").allowed

    # Expire it by rewriting the stored deadline into the past.
    m._cooldowns["MintAAA"] = 0.0
    assert entry(m).allowed


def test_new_day_clears_the_halt() -> None:
    m = manager(max_daily_loss_usd=50.0)
    m.record_trade(-60.0)
    assert not entry(m).allowed
    m.daily.day = "1999-01-01"   # simulate the UTC date rolling over
    assert entry(m).allowed
