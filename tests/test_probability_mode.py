"""Trading on measured probabilities instead of hand-set weights."""

from __future__ import annotations

import math
import random

import pytest

from memebot.config import Config, ConfigError, validate
from memebot.execution.paper import PaperExecutor
from memebot.model import ProbabilityModel, fit
from memebot.observations import FEATURES, Dataset, Example
from memebot.storage import Storage
from memebot.strategy import score_token
from memebot.engine import TradingEngine

from .conftest import make_pair, make_snapshot
from .test_engine import FakeHttp

START = 1_700_000_000_000


def constant_model(probability: float) -> ProbabilityModel:
    """A model that always answers the same thing, so a test can isolate the
    gate under test from whatever the weights would have said."""
    odds = math.log(probability / (1.0 - probability))
    return ProbabilityModel(
        features=list(FEATURES),
        mean=[0.0] * len(FEATURES),
        std=[1.0] * len(FEATURES),
        weights=[0.0] * len(FEATURES),
        bias=odds,
        take_profit_pct=40.0, stop_loss_pct=-25.0, horizon_minutes=240.0,
        n_train=5_000, test_metrics={"auc": 0.7},
    )


@pytest.fixture
def cfg() -> Config:
    cfg = Config()
    cfg.engine.discovery_queries = ["SOL"]
    return cfg


class TestEntryGates:
    def test_a_confident_model_opens_the_gate(self, cfg):
        cfg.probability.min_probability = 0.5
        signal = score_token(
            make_snapshot(), cfg.strategy,
            model=constant_model(0.8), prob_cfg=cfg.probability,
        )
        assert signal.should_buy
        assert signal.components["probability"] == pytest.approx(0.8, abs=1e-3)

    def test_below_the_probability_floor_it_stays_shut(self, cfg):
        cfg.probability.min_probability = 0.5
        signal = score_token(
            make_snapshot(), cfg.strategy,
            model=constant_model(0.2), prob_cfg=cfg.probability,
        )
        assert not signal.should_buy
        assert "P(win)" in signal.reasons[0]

    def test_a_likely_win_with_a_bad_payoff_is_still_refused(self, cfg):
        """The gate the composite score could never express: 55% wins is not
        enough when the win pays +10% and the loss costs -50%."""
        cfg.probability.min_probability = 0.0
        cfg.probability.take_profit_pct = 10.0
        cfg.probability.stop_loss_pct = -50.0
        signal = score_token(
            make_snapshot(), cfg.strategy,
            model=constant_model(0.55), prob_cfg=cfg.probability,
        )
        assert not signal.should_buy
        assert "expected value" in " ".join(signal.reasons)

    def test_an_unlikely_win_with_a_huge_payoff_is_allowed(self, cfg):
        cfg.probability.min_probability = 0.0
        cfg.probability.take_profit_pct = 300.0
        cfg.probability.stop_loss_pct = -25.0
        signal = score_token(
            make_snapshot(), cfg.strategy,
            model=constant_model(0.20), prob_cfg=cfg.probability,
        )
        assert signal.should_buy
        assert signal.components["expected_value_pct"] > 0

    def test_costs_can_close_a_marginal_gate(self, cfg):
        cfg.probability.min_probability = 0.0
        cfg.probability.take_profit_pct = 40.0
        cfg.probability.stop_loss_pct = -25.0
        model = constant_model(0.40)

        cfg.probability.round_trip_cost_pct = 0.0
        assert score_token(make_snapshot(), cfg.strategy,
                           model=model, prob_cfg=cfg.probability).should_buy

        cfg.probability.round_trip_cost_pct = 3.0
        assert not score_token(make_snapshot(), cfg.strategy,
                               model=model, prob_cfg=cfg.probability).should_buy

    def test_hard_vetoes_still_win_over_a_confident_model(self, cfg):
        """A model fitted on a few thousand rows has barely seen a blow-off
        top, so 'the data did not object' is not 'this is safe'."""
        cfg.probability.min_probability = 0.0
        blowoff = make_snapshot(change_h1=900.0, change_h24=5_000.0)
        signal = score_token(
            blowoff, cfg.strategy,
            model=constant_model(0.99), prob_cfg=cfg.probability,
        )
        assert not signal.should_buy
        assert any("blow-off" in r for r in signal.reasons)

    def test_the_heuristic_score_is_still_reported(self, cfg):
        """So you can see where the model and the old weights disagree."""
        signal = score_token(
            make_snapshot(), cfg.strategy,
            model=constant_model(0.7), prob_cfg=cfg.probability,
        )
        assert "heuristic_score" in signal.components

    def test_without_a_model_nothing_changes(self, cfg):
        plain = score_token(make_snapshot(), cfg.strategy)
        assert "probability" not in plain.components
        assert plain.score == pytest.approx(
            score_token(make_snapshot(), cfg.strategy).score
        )


class TestConfigConsistency:
    def test_targets_that_contradict_the_exit_rules_are_rejected(self, cfg):
        """A model fitted on a different question still returns a perfectly
        plausible probability for every token, so this has to fail loudly."""
        cfg.probability.enabled = True
        cfg.probability.stop_loss_pct = -35.0
        cfg.exits.stop_loss_pct = -25.0
        with pytest.raises(ConfigError, match="different question"):
            validate(cfg)

    def test_aligned_targets_pass(self, cfg):
        cfg.probability.enabled = True
        cfg.probability.take_profit_pct = cfg.exits.take_profit_ladder[0][0]
        cfg.probability.stop_loss_pct = cfg.exits.stop_loss_pct
        cfg.probability.horizon_minutes = cfg.exits.max_hold_minutes
        validate(cfg)

    def test_the_mismatch_can_be_overridden_deliberately(self, cfg):
        cfg.probability.enabled = True
        cfg.probability.stop_loss_pct = -35.0
        cfg.probability.allow_target_mismatch = True
        validate(cfg)

    def test_recording_is_on_by_default(self, cfg):
        """The dataset only exists if it is collected from day one."""
        assert cfg.probability.record
        assert not cfg.probability.enabled


class TestRecording:
    async def test_every_candidate_is_recorded_not_just_the_bought_ones(self, cfg):
        """Recording only what we bought would make it impossible to ever
        learn that a filter rejects winners."""
        http = FakeHttp()
        http.pairs = [
            make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                      buys_h1=900, sells_h1=300, vol_h1=120_000,
                      liquidity_usd=150_000),
            make_pair(mint="Dead", symbol="DEAD", change_m5=-9, change_h1=-40,
                      buys_h1=10, sells_h1=400, vol_h1=200, liquidity_usd=900),
        ]
        storage = Storage(":memory:")
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))
        await engine.discover_and_trade()

        recorded = {m for m in storage.observation_mints()}
        assert recorded == {"Good", "Dead"}
        assert engine.portfolio.open_count == 1      # only one was bought

    async def test_the_screen_verdict_is_recorded_with_each_row(self, cfg):
        http = FakeHttp()
        http.pairs = [
            make_pair(mint="Thin", symbol="THIN", liquidity_usd=500),
        ]
        storage = Storage(":memory:")
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))
        await engine.discover_and_trade()

        row = storage.observations_for("Thin")[0]
        assert row["passed_screen"] == 0

    async def test_recording_can_be_turned_off(self, cfg):
        cfg.probability.record = False
        http = FakeHttp()
        http.pairs = [make_pair(mint="Good", symbol="GOOD")]
        storage = Storage(":memory:")
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))
        await engine.discover_and_trade()
        assert storage.observation_stats()["rows"] == 0

    async def test_scan_does_not_record(self, cfg):
        """`scan` is an inspection command; recording from it would write
        near-duplicate rows seconds apart and over-weight those moments."""
        http = FakeHttp()
        http.pairs = [make_pair(mint="Good", symbol="GOOD")]
        storage = Storage(":memory:")
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))
        await engine.scan()
        assert storage.observation_stats()["rows"] == 0

    async def test_a_recording_failure_never_stops_trading(self, cfg, monkeypatch):
        """Exiting a position matters more than collecting training data."""
        http = FakeHttp()
        http.pairs = [
            make_pair(mint="Good", symbol="GOOD", change_m5=6, change_h1=45,
                      buys_h1=900, sells_h1=300, vol_h1=120_000,
                      liquidity_usd=150_000),
        ]
        storage = Storage(":memory:")
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))

        def explode(_rows):
            raise sqlite_error()

        def sqlite_error():
            return RuntimeError("disk is full")

        monkeypatch.setattr(storage, "save_observations", explode)
        await engine.discover_and_trade()
        assert engine.portfolio.open_count == 1


class TestEngineRefusesBadModels:
    def test_it_will_not_start_on_a_model_that_learnt_nothing(self, cfg, tmp_path):
        """Silently falling back to the heuristic would mean the bot trades a
        different strategy than the one you configured."""
        model = constant_model(0.6)
        model.test_metrics = {"auc": 0.50}
        path = tmp_path / "model.json"
        model.save(path)

        cfg.probability.enabled = True
        cfg.probability.model_path = str(path)
        with pytest.raises(Exception, match="coin flip"):
            TradingEngine(cfg, http=FakeHttp(), storage=Storage(":memory:"),
                          executor=PaperExecutor(cfg))
