"""The model, and every reason the bot should refuse to trade on one."""

from __future__ import annotations

import json
import math
import random

import pytest

from memebot.config import ProbabilityConfig
from memebot.model import (
    MODEL_FORMAT, ModelError, ProbabilityModel, evaluate, expected_value_pct,
    fit, load_for_trading,
)
from memebot.observations import FEATURES, Dataset, Example

START = 1_700_000_000_000


def synthetic(n=4000, *, signal=True, seed=3) -> Dataset:
    """Examples where the truth is known: only turnover and 5m buy pressure
    decide the outcome, everything else is noise."""
    rng = random.Random(seed)
    examples = []
    for i in range(n):
        x = {name: rng.gauss(0.0, 1.0) for name in FEATURES}
        if signal:
            z = -0.8 + 1.5 * x["turnover_h1"] + 1.0 * x["buy_ratio_m5"]
        else:
            z = -0.8                      # nothing to learn: pure coin flip
        p = 1.0 / (1.0 + math.exp(-z))
        examples.append(Example(
            mint=f"m{i % 50}", symbol="TK", ts_ms=START + i * 60_000, x=x,
            y=1 if rng.random() < p else 0, mfe_pct=0.0, mae_pct=0.0,
            passed_screen=True, score=50.0,
        ))
    return Dataset(examples=examples, mints=50)


@pytest.fixture(scope="module")
def fitted() -> ProbabilityModel:
    model = fit(synthetic(), epochs=250)
    model.take_profit_pct = 40.0
    model.stop_loss_pct = -25.0
    model.horizon_minutes = 240.0
    return model


class TestExpectedValue:
    def test_a_low_win_rate_can_still_be_profitable(self):
        """The point of the whole exercise: 30% wins at 3:1 beats 60% at 1:2,
        and the composite score could not express either."""
        assert expected_value_pct(0.30, 100.0, -25.0, 3.0) > 0
        assert expected_value_pct(0.60, 20.0, -40.0, 3.0) < 0

    def test_costs_are_subtracted(self):
        free = expected_value_pct(0.5, 40.0, -25.0, 0.0)
        costly = expected_value_pct(0.5, 40.0, -25.0, 3.0)
        assert free - costly == pytest.approx(3.0)


class TestMetrics:
    def test_a_perfect_forecast_scores_zero_brier(self):
        m = evaluate([(1.0, 1), (0.0, 0), (1.0, 1)])
        assert m.brier == pytest.approx(0.0)
        assert m.auc == pytest.approx(1.0)

    def test_a_backwards_forecast_scores_below_half_auc(self):
        m = evaluate([(0.1, 1), (0.9, 0), (0.2, 1), (0.8, 0)])
        assert m.auc < 0.5
        assert m.brier_skill < 0

    def test_predicting_the_base_rate_has_no_skill(self):
        pairs = [(0.5, 1), (0.5, 0), (0.5, 1), (0.5, 0)]
        assert evaluate(pairs).brier_skill == pytest.approx(0.0)

    def test_reliability_bins_report_predicted_against_actual(self):
        m = evaluate([(0.05, 0), (0.05, 0), (0.95, 1), (0.95, 1)])
        assert m.reliability[0]["actual"] == 0.0
        assert m.reliability[-1]["actual"] == 1.0


class TestFit:
    def test_it_recovers_the_features_that_matter(self, fitted):
        top = [name for name, _ in fitted.coefficients()[:2]]
        assert set(top) == {"turnover_h1", "buy_ratio_m5"}

    def test_it_generalises_to_data_it_never_saw(self, fitted):
        assert fitted.test_metrics["auc"] > 0.7
        assert fitted.test_metrics["brier_skill"] > 0.1

    def test_it_stays_calibrated(self, fitted):
        """A stated probability has to be multipliable by a payoff."""
        for row in fitted.test_metrics["reliability"]:
            if row["n"] >= 100:
                assert abs(row["predicted"] - row["actual"]) < 0.12, row

    def test_noise_produces_no_skill(self):
        """The failure that must stay visible: with nothing to learn, the
        held-out score has to show it rather than inventing an edge."""
        model = fit(synthetic(signal=False), epochs=250)
        assert model.test_metrics["auc"] < 0.62

    def test_the_split_is_by_time_not_random(self):
        """Training on the future to predict the past is the classic way to
        manufacture a backtest that cannot be traded."""
        dataset = synthetic(n=1200)
        model = fit(dataset, test_fraction=0.25, epochs=50)
        ordered = dataset.sorted_by_time()
        boundary = ordered[model.n_train - 1].ts_ms
        assert all(e.ts_ms >= boundary for e in ordered[model.n_train:])

    def test_it_refuses_too_few_examples(self):
        with pytest.raises(ModelError, match="labelled examples"):
            fit(synthetic(n=100))

    def test_it_refuses_too_few_winners(self):
        dataset = synthetic(n=1500)
        for e in dataset.examples[:1400]:
            e.y = 0
        with pytest.raises(ModelError, match="winners"):
            fit(dataset, min_positives=200)

    def test_the_same_data_gives_the_same_model(self):
        """Deterministic, so a change in the weights means the market moved,
        not the optimiser."""
        a = fit(synthetic(n=1500), epochs=60)
        b = fit(synthetic(n=1500), epochs=60)
        assert a.weights == b.weights


class TestRoundTrip:
    def test_saving_and_loading_preserves_predictions(self, fitted, tmp_path):
        path = tmp_path / "model.json"
        fitted.save(path)
        loaded = ProbabilityModel.load(path)
        x = {name: 0.4 for name in FEATURES}
        assert loaded.predict(x) == pytest.approx(fitted.predict(x))

    def test_a_missing_feature_is_treated_as_zero_not_an_error(self, fitted):
        assert 0.0 <= fitted.predict({}) <= 1.0

    def test_a_changed_feature_set_is_rejected(self, fitted, tmp_path):
        path = tmp_path / "model.json"
        fitted.save(path)
        data = json.loads(path.read_text())
        data["features"] = data["features"][:-1]
        path.write_text(json.dumps(data))
        with pytest.raises(ModelError, match="different feature set"):
            ProbabilityModel.load(path)

    def test_an_old_format_is_rejected(self, fitted, tmp_path):
        path = tmp_path / "model.json"
        fitted.save(path)
        data = json.loads(path.read_text())
        data["format"] = MODEL_FORMAT - 1
        path.write_text(json.dumps(data))
        with pytest.raises(ModelError, match="format"):
            ProbabilityModel.load(path)

    def test_a_missing_file_says_what_to_do(self, tmp_path):
        with pytest.raises(ModelError, match="memebot fit"):
            ProbabilityModel.load(tmp_path / "nope.json")


class TestTradingGate:
    """Every refusal here guards a failure that is otherwise silent: the model
    still returns a plausible-looking probability for every token."""

    def _saved(self, model, tmp_path, **overrides):
        path = tmp_path / "model.json"
        model.save(path)
        if overrides:
            data = json.loads(path.read_text())
            data.update(overrides)
            path.write_text(json.dumps(data))
        return str(path)

    def test_a_healthy_model_is_accepted(self, fitted, tmp_path):
        cfg = ProbabilityConfig(model_path=self._saved(fitted, tmp_path))
        assert load_for_trading(cfg).n_train == fitted.n_train

    def test_a_model_that_learnt_nothing_is_refused(self, fitted, tmp_path):
        metrics = dict(fitted.test_metrics, auc=0.51)
        path = self._saved(fitted, tmp_path, test_metrics=metrics)
        with pytest.raises(ModelError, match="coin flip"):
            load_for_trading(ProbabilityConfig(model_path=path))

    def test_a_model_fitted_for_other_targets_is_refused(self, fitted, tmp_path):
        path = self._saved(fitted, tmp_path, stop_loss_pct=-35.0)
        with pytest.raises(ModelError, match="different question"):
            load_for_trading(ProbabilityConfig(model_path=path))

    def test_the_target_mismatch_can_be_overridden_deliberately(self, fitted, tmp_path):
        path = self._saved(fitted, tmp_path, stop_loss_pct=-35.0)
        cfg = ProbabilityConfig(model_path=path, allow_target_mismatch=True)
        assert load_for_trading(cfg) is not None

    def test_a_model_with_no_evaluation_is_refused(self, fitted, tmp_path):
        path = self._saved(fitted, tmp_path, test_metrics={})
        with pytest.raises(ModelError, match="no held-out evaluation"):
            load_for_trading(ProbabilityConfig(model_path=path))

    def test_a_model_fitted_on_too_little_data_is_refused(self, fitted, tmp_path):
        path = self._saved(fitted, tmp_path, n_train=120)
        with pytest.raises(ModelError, match="below the"):
            load_for_trading(ProbabilityConfig(model_path=path))
