from __future__ import annotations

import pytest

from memebot.config import Config
from memebot.execution.paper import PaperExecutor
from memebot.portfolio import Portfolio
from memebot.storage import Storage

from .conftest import make_snapshot


@pytest.fixture
def executor(cfg: Config) -> PaperExecutor:
    return PaperExecutor(cfg)


async def test_buy_deducts_cash_and_charges_fees(executor: PaperExecutor) -> None:
    snap = make_snapshot(price_usd=0.001, liquidity_usd=500_000)
    start_cash = executor.cash_usd

    order = await executor.buy(snap, 25.0)

    assert order.ok
    assert executor.cash_usd == pytest.approx(start_cash - 25.0)
    assert order.fee_usd > 0
    # Fills are worse than mid: you pay above the quoted price.
    assert order.price_usd > snap.price_usd
    assert order.qty * order.price_usd == pytest.approx(25.0 - order.fee_usd)


async def test_buy_is_refused_without_cash(executor: PaperExecutor) -> None:
    order = await executor.buy(make_snapshot(), executor.cash_usd + 1)
    assert not order.ok
    assert "insufficient" in order.error


async def test_large_order_into_a_thin_pool_is_refused(executor: PaperExecutor) -> None:
    # $25 into a $200 pool is a 12.5% impact, far above the 4% limit.
    order = await executor.buy(make_snapshot(liquidity_usd=200), 25.0)
    assert not order.ok
    assert "price impact" in order.error


async def test_urgent_sell_ignores_the_impact_guard(executor: PaperExecutor) -> None:
    snap = make_snapshot(price_usd=0.001, liquidity_usd=500_000)
    buy = await executor.buy(snap, 25.0)

    thin = make_snapshot(price_usd=0.001, liquidity_usd=300)
    assert not (await executor.sell(thin, buy.qty)).ok           # guarded
    assert (await executor.sell(thin, buy.qty, urgent=True)).ok  # rug exit


async def test_round_trip_at_a_flat_price_loses_money(executor: PaperExecutor) -> None:
    """Fees and slippage must make a flat round trip a small loss, not a wash."""
    snap = make_snapshot(price_usd=0.001, liquidity_usd=500_000)
    start_cash = executor.cash_usd

    buy = await executor.buy(snap, 25.0)
    await executor.sell(snap, buy.qty)

    assert executor.cash_usd < start_cash


async def test_portfolio_books_a_profitable_round_trip(cfg: Config) -> None:
    storage = Storage(":memory:")
    portfolio = Portfolio(storage, cfg.risk.starting_equity_usd)
    executor = PaperExecutor(cfg)

    entry_snap = make_snapshot(price_usd=0.001, liquidity_usd=500_000)
    order = await executor.buy(entry_snap, 25.0)
    position = portfolio.open_position(entry_snap, order, entry_score=72.0)
    assert portfolio.holds(position.mint)

    exit_snap = make_snapshot(price_usd=0.002, liquidity_usd=500_000)
    sell = await executor.sell(exit_snap, position.qty * 0.4)
    realized = portfolio.apply_sell(position, sell, "take profit 1", ladder_step=True)

    assert realized > 0
    assert position.ladder_steps_done == 1
    assert position.remaining_fraction == pytest.approx(0.6)
    assert portfolio.holds(position.mint)     # still open after a partial sale

    final = await executor.sell(exit_snap, position.qty)
    portfolio.apply_sell(position, final, "take profit 2")

    assert not portfolio.holds(position.mint)
    assert position.status.value == "closed"
    assert position.realized_pnl_usd > 0
    assert len(storage.load_trades()) == 3
    storage.close()


async def test_dust_remainder_closes_the_position(cfg: Config) -> None:
    storage = Storage(":memory:")
    portfolio = Portfolio(storage, cfg.risk.starting_equity_usd)
    executor = PaperExecutor(cfg)

    snap = make_snapshot(price_usd=0.001, liquidity_usd=500_000)
    order = await executor.buy(snap, 25.0)
    position = portfolio.open_position(snap, order)

    sell = await executor.sell(snap, position.qty * 0.99999)
    portfolio.apply_sell(position, sell, "full exit")

    assert position.status.value == "closed"
    assert position.qty == 0.0
