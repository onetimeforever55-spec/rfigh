"""Recording and labelling: the parts where a subtle bug becomes a fake edge."""

from __future__ import annotations

import pytest

from memebot.observations import (
    FEATURES, build_dataset, features, features_from_snapshot,
    label_mint_history, observation_row,
)
from memebot.storage import Storage

from .conftest import make_snapshot

STEP = 60_000          # one minute between observations
START = 1_700_000_000_000


def rows_from_prices(prices, *, step_ms=STEP, mint="M", start=START):
    """Fake observation rows; only the fields labelling reads have to be real."""
    out = []
    for i, price in enumerate(prices):
        out.append({
            "ts_ms": start + i * step_ms, "mint": mint, "symbol": "TK",
            "price_usd": price, "liquidity_usd": 50_000.0,
            "market_cap_usd": 200_000.0, "age_minutes": 10.0 + i,
            "vol_m5_usd": 1_000.0, "vol_h1_usd": 10_000.0, "vol_h24_usd": 90_000.0,
            "chg_m5_pct": 1.0, "chg_h1_pct": 5.0, "chg_h24_pct": 20.0,
            "buys_m5": 10, "sells_m5": 5, "buys_h1": 100, "sells_h1": 50,
            "has_socials": 1, "dex_id": "pumpswap", "passed_screen": 1, "score": 60.0,
        })
    return out


def label(prices, *, tp=40.0, sl=-25.0, horizon=10.0, gap=15.0, step_ms=STEP):
    return label_mint_history(
        rows_from_prices(prices, step_ms=step_ms),
        take_profit_pct=tp, stop_loss_pct=sl,
        horizon_minutes=horizon, max_gap_minutes=gap,
    )


class TestFeatures:
    def test_every_declared_feature_is_produced(self):
        produced = features_from_snapshot(make_snapshot())
        assert set(produced) == set(FEATURES)

    def test_a_recorded_row_yields_the_same_features_as_the_live_snapshot(self):
        """The invariant the whole thing rests on.

        If a feature means one thing when scoring live and another when
        fitting, the model is confidently wrong and nothing in the metrics
        would show it.
        """
        snap = make_snapshot()
        live = features_from_snapshot(snap)

        storage = Storage(":memory:")
        storage.save_observations(
            [observation_row(snap, passed_screen=True, score=61.0)]
        )
        stored = features(dict(storage.observations_for(snap.mint)[0]))
        storage.close()

        for name in FEATURES:
            assert stored[name] == pytest.approx(live[name]), name

    def test_extreme_moves_are_clipped(self):
        """A +40000% row is a feed error, not a signal."""
        assert features({"chg_h1_pct": 1e9})["chg_h1_pct"] == 1000.0
        assert features({"chg_m5_pct": -1e9})["chg_m5_pct"] == -100.0

    def test_zero_liquidity_does_not_blow_up(self):
        f = features({"liquidity_usd": 0.0, "vol_h1_usd": 5_000.0})
        assert f["turnover_h1"] == 0.0
        assert f["mcap_liq_ratio"] == 0.0

    def test_buy_ratio_is_bounded_without_sells(self):
        assert features({"buys_h1": 900, "sells_h1": 0})["buy_ratio_h1"] == 1.0
        assert features({"buys_h1": 0, "sells_h1": 0})["buy_ratio_h1"] == 0.5


class TestLabelling:
    def test_take_profit_before_stop_is_a_win(self):
        examples, censored, _ = label([1.0, 1.1, 1.5])
        assert examples[0].y == 1
        # The last two rows have no future left to resolve against, so they
        # are censored rather than labelled.
        assert censored == 2

    def test_stop_before_take_profit_is_a_loss(self):
        examples, _, _ = label([1.0, 0.9, 0.7, 2.0])
        assert examples[0].y == 0

    def test_the_first_level_touched_decides_it(self):
        """Down to -30% then up to +50% is a loss: the stop sold it first."""
        examples, _, _ = label([1.0, 0.70, 1.50])
        assert examples[0].y == 0

    def test_both_levels_inside_one_interval_counts_as_a_loss(self):
        """Pessimistic tie-break. Within a single polling gap we cannot know
        which came first, and assuming the good one inflates every number."""
        examples, _, _ = label([1.0, 0.5])
        assert examples[0].y == 0

    def test_horizon_expiring_flat_is_a_loss(self):
        """The time stop would have sold it, so it is not a win."""
        prices = [1.0] + [1.05] * 15
        examples, _, _ = label(prices, horizon=10.0)
        assert examples[0].y == 0

    def test_running_out_of_data_is_censored_not_a_loss(self):
        """The token stopped appearing. Counting that as a loss would be a
        guess dressed up as data."""
        examples, censored, _ = label([1.0, 1.02, 1.01], horizon=60.0)
        assert examples == []
        assert censored == 3

    def test_a_gap_ends_coverage(self):
        """The bot was down for an hour; the price in between is unknowable."""
        rows = rows_from_prices([1.0, 1.05])
        rows.append({**rows[-1], "ts_ms": rows[-1]["ts_ms"] + 3_600_000, "price_usd": 1.6})
        examples, censored, _ = label_mint_history(
            rows, take_profit_pct=40.0, stop_loss_pct=-25.0,
            horizon_minutes=240.0, max_gap_minutes=15.0,
        )
        assert examples == []          # nothing resolved across the gap
        assert censored == 3

    def test_every_row_is_its_own_decision_point(self):
        """Each observation is a separate 'buy here?' question, so one run
        produces one example per row that resolves."""
        examples, censored, _ = label([1.0, 1.5, 2.25, 3.4])
        assert [e.y for e in examples] == [1, 1, 1]
        assert censored == 1       # the final row has no future

    def test_excursions_are_recorded(self):
        examples, _, _ = label([1.0, 0.85, 1.45])
        assert examples[0].mfe_pct == pytest.approx(45.0)
        assert examples[0].mae_pct == pytest.approx(-15.0)

    def test_a_zero_price_row_is_skipped_not_labelled(self):
        examples, _, skipped = label([0.0, 1.0, 1.5])
        assert skipped == 1
        assert all(e.ts_ms != START for e in examples)

    def test_features_come_only_from_the_decision_row(self):
        """Look-ahead check: the label changes with the future, the features
        must not."""
        up, _, _ = label([1.0, 1.5])
        down, _, _ = label([1.0, 0.5])
        assert up[0].y != down[0].y
        assert up[0].x == down[0].x


class TestBuildDataset:
    def _storage_with(self, prices_by_mint):
        storage = Storage(":memory:")
        for mint, prices in prices_by_mint.items():
            rows = rows_from_prices(prices, mint=mint)
            storage.save_observations([
                (r["ts_ms"], r["mint"], r["symbol"], r["price_usd"],
                 r["liquidity_usd"], r["market_cap_usd"], r["age_minutes"],
                 r["vol_m5_usd"], r["vol_h1_usd"], r["vol_h24_usd"],
                 r["chg_m5_pct"], r["chg_h1_pct"], r["chg_h24_pct"],
                 r["buys_m5"], r["sells_m5"], r["buys_h1"], r["sells_h1"],
                 r["has_socials"], r["dex_id"], r["passed_screen"], r["score"])
                for r in rows
            ])
        return storage

    def test_base_rate_counts_winners_over_resolved_examples(self):
        storage = self._storage_with({"WIN": [1.0, 1.5], "LOSS": [1.0, 0.6]})
        dataset = build_dataset(
            storage, take_profit_pct=40.0, stop_loss_pct=-25.0,
            horizon_minutes=240.0,
        )
        storage.close()
        assert len(dataset) == 2
        assert dataset.base_rate == pytest.approx(0.5)
        assert dataset.mints == 2

    def test_a_mint_seen_once_cannot_be_labelled(self):
        storage = self._storage_with({"ONCE": [1.0]})
        dataset = build_dataset(
            storage, take_profit_pct=40.0, stop_loss_pct=-25.0,
            horizon_minutes=240.0,
        )
        storage.close()
        assert len(dataset) == 0
        assert dataset.skipped == 1

    def test_screened_only_drops_the_rest(self):
        storage = Storage(":memory:")
        snap = make_snapshot()
        rows = []
        for i, passed in enumerate([True, False]):
            s = make_snapshot(price_usd=0.001 * (1 + i))
            s.fetched_at_ms = START + i * STEP
            rows.append(observation_row(s, passed_screen=passed, score=50.0))
        storage.save_observations(rows)
        dataset = build_dataset(
            storage, take_profit_pct=40.0, stop_loss_pct=-25.0,
            horizon_minutes=240.0, screened_only=True,
        )
        storage.close()
        assert all(e.passed_screen for e in dataset.examples)


class TestRetention:
    def test_pruning_drops_only_old_rows(self):
        storage = Storage(":memory:")
        snap = make_snapshot()
        for ts in (START, START + 10 * STEP):
            snap.fetched_at_ms = ts
            storage.save_observations(
                [observation_row(snap, passed_screen=True, score=50.0)]
            )
        dropped = storage.prune_observations(START + 5 * STEP)
        assert dropped == 1
        assert storage.observation_stats()["rows"] == 1
        storage.close()
