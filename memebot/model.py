"""Fitting a calibrated probability of success, and reporting honestly on it.

Deliberately a logistic regression, not something fancier. Three reasons:

- **Calibration is the product.** The bot does not need a ranking, it needs a
  number it can multiply by a payoff. A logistic fit on standardised features,
  left unbalanced, produces probabilities that mean what they say.
- **It fails visibly.** With a few thousand rows and fourteen features, a
  gradient-boosted anything will happily memorise noise and report a
  spectacular in-sample score. A linear model that has learnt nothing shows it,
  as weights near zero and a test score no better than the base rate.
- **The weights are readable.** You can look at the fitted coefficients and see
  what the bot believes, which is the entire point of replacing hand-set
  weights.

The classes are NOT rebalanced. Oversampling the winners would improve the
apparent accuracy and destroy the calibration — a model trained on a fake 50%
base rate reports fake probabilities, and every expected-value calculation
downstream inherits the lie.

Evaluation splits on TIME, never at random. Shuffling a price series lets the
model train on Tuesday to predict Monday; the split here trains on the older
part and tests on the newer, which is the only question that matters: does what
it learnt last week hold this week?
"""

from __future__ import annotations

import json
import logging
import math
import random
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .observations import FEATURES, Dataset, Example

log = logging.getLogger(__name__)

MODEL_FORMAT = 2


class ModelError(RuntimeError):
    pass


def _sigmoid(z: float) -> float:
    # Split by sign to keep exp() from overflowing on large |z|.
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-min(z, 60.0)))
    e = math.exp(max(z, -60.0))
    return e / (1.0 + e)


@dataclass
class Metrics:
    """How good the numbers are — reported for train AND test, always."""

    n: int = 0
    base_rate: float = 0.0
    brier: float = 0.0          # mean squared error of the probability itself
    log_loss: float = 0.0
    auc: float = 0.5            # ranking quality; 0.5 is a coin flip
    brier_skill: float = 0.0    # vs. always predicting the base rate
    reliability: list[dict] = field(default_factory=list)


def _auc(pairs: list[tuple[float, int]]) -> float:
    """Rank-based AUC, ties averaged."""
    positives = sum(y for _, y in pairs)
    negatives = len(pairs) - positives
    if positives == 0 or negatives == 0:
        return 0.5

    ranked = sorted(pairs, key=lambda p: p[0])
    ranks: list[float] = [0.0] * len(ranked)
    i = 0
    while i < len(ranked):
        j = i
        while j + 1 < len(ranked) and ranked[j + 1][0] == ranked[i][0]:
            j += 1
        average = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[k] = average
        i = j + 1

    positive_rank_sum = sum(r for r, (_, y) in zip(ranks, ranked) if y == 1)
    return (positive_rank_sum - positives * (positives + 1) / 2.0) / (positives * negatives)


def _reliability(pairs: list[tuple[float, int]], bins: int = 10) -> list[dict]:
    """Predicted vs. actual, bucketed. The table that shows whether a stated
    30% really happens 30% of the time."""
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for prob, y in pairs:
        idx = min(bins - 1, int(prob * bins))
        buckets[idx].append((prob, y))

    table = []
    for idx, bucket in enumerate(buckets):
        if not bucket:
            continue
        table.append({
            "bin": f"{idx / bins:.0%}-{(idx + 1) / bins:.0%}",
            "n": len(bucket),
            "predicted": sum(p for p, _ in bucket) / len(bucket),
            "actual": sum(y for _, y in bucket) / len(bucket),
        })
    return table


def evaluate(pairs: list[tuple[float, int]]) -> Metrics:
    if not pairs:
        return Metrics()

    n = len(pairs)
    base = sum(y for _, y in pairs) / n
    brier = sum((p - y) ** 2 for p, y in pairs) / n
    log_loss = -sum(
        y * math.log(max(p, 1e-12)) + (1 - y) * math.log(max(1 - p, 1e-12))
        for p, y in pairs
    ) / n
    # Brier of the do-nothing baseline: always predict the base rate.
    reference = sum((base - y) ** 2 for _, y in pairs) / n
    skill = 1.0 - brier / reference if reference > 0 else 0.0

    return Metrics(
        n=n, base_rate=base, brier=brier, log_loss=log_loss,
        auc=_auc(pairs), brier_skill=skill, reliability=_reliability(pairs),
    )


@dataclass
class ProbabilityModel:
    """A fitted model plus everything needed to distrust it later."""

    features: list[str]
    mean: list[float]
    std: list[float]
    weights: list[float]
    bias: float

    # The targets this was fitted for. A model trained on "+30% before -35%
    # within 2h" answers only that question; using it to size a different
    # trade is a category error, so the strategy checks these.
    take_profit_pct: float = 0.0
    stop_loss_pct: float = 0.0
    horizon_minutes: float = 0.0

    trained_at_ms: int = 0
    n_train: int = 0
    n_test: int = 0
    train_metrics: dict = field(default_factory=dict)
    test_metrics: dict = field(default_factory=dict)
    format: int = MODEL_FORMAT

    def predict(self, x: dict[str, float]) -> float:
        z = self.bias
        for name, weight, mean, std in zip(
            self.features, self.weights, self.mean, self.std
        ):
            z += weight * ((x.get(name, 0.0) - mean) / std)
        return _sigmoid(z)

    def coefficients(self) -> list[tuple[str, float]]:
        """Weights on standardised features, largest effect first — directly
        comparable to each other, unlike the raw hand-set weights they replace."""
        return sorted(
            zip(self.features, self.weights), key=lambda p: abs(p[1]), reverse=True
        )

    def save(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(asdict(self), indent=2))

    @classmethod
    def load(cls, path: str | Path) -> "ProbabilityModel":
        p = Path(path)
        if not p.exists():
            raise ModelError(f"no model at {p} — run `memebot fit` first")
        data = json.loads(p.read_text())
        if data.get("format") != MODEL_FORMAT:
            raise ModelError(
                f"{p}: model format {data.get('format')} != {MODEL_FORMAT}; refit it"
            )
        if data.get("features") != list(FEATURES):
            # Silently scoring with mismatched features would map values onto
            # the wrong weights and produce confident nonsense.
            raise ModelError(
                f"{p}: was fitted on a different feature set; refit it"
            )
        return cls(**data)


def _standardise(rows: list[list[float]]) -> tuple[list[float], list[float]]:
    n = len(rows)
    width = len(rows[0])
    mean = [0.0] * width
    for row in rows:
        for i, value in enumerate(row):
            mean[i] += value
    mean = [m / n for m in mean]

    var = [0.0] * width
    for row in rows:
        for i, value in enumerate(row):
            var[i] += (value - mean[i]) ** 2
    # A constant feature has zero variance; 1.0 makes it contribute nothing
    # instead of dividing by zero.
    std = [math.sqrt(v / n) if v / n > 1e-12 else 1.0 for v in var]
    return mean, std


def _gradient_descent(
    rows: list[list[float]],
    labels: list[int],
    *,
    l2: float,
    epochs: int,
    learning_rate: float,
) -> tuple[list[float], float]:
    """Full-batch gradient descent with momentum on standardised inputs.

    Full-batch because the datasets here are small enough and it is
    deterministic: the same data always yields the same model, so a change in
    the weights means the market changed, not the optimiser.
    """
    n = len(rows)
    width = len(rows[0])
    weights = [0.0] * width
    bias = 0.0
    velocity = [0.0] * width
    bias_velocity = 0.0
    momentum = 0.9

    for epoch in range(epochs):
        grad = [0.0] * width
        bias_grad = 0.0
        for row, y in zip(rows, labels):
            z = bias
            for i in range(width):
                z += weights[i] * row[i]
            error = _sigmoid(z) - y
            bias_grad += error
            for i in range(width):
                grad[i] += error * row[i]

        bias_grad /= n
        for i in range(width):
            grad[i] = grad[i] / n + l2 * weights[i]

        # Decay keeps the tail of training from oscillating around the optimum.
        lr = learning_rate * (1.0 - epoch / (epochs * 1.2))
        bias_velocity = momentum * bias_velocity - lr * bias_grad
        bias += bias_velocity
        for i in range(width):
            velocity[i] = momentum * velocity[i] - lr * grad[i]
            weights[i] += velocity[i]

    return weights, bias


def fit(
    dataset: Dataset,
    *,
    test_fraction: float = 0.25,
    l2: float = 0.01,
    epochs: int = 400,
    learning_rate: float = 0.5,
    max_train_rows: int = 50_000,
    min_examples: int = 500,
    min_positives: int = 50,
    seed: int = 7,
) -> ProbabilityModel:
    """Fit on the older part of the data, evaluate on the newer part."""
    examples = dataset.sorted_by_time()
    if len(examples) < min_examples:
        raise ModelError(
            f"only {len(examples)} labelled examples, need at least {min_examples}. "
            "Let the bot record for longer."
        )

    split = int(len(examples) * (1.0 - test_fraction))
    train, test = examples[:split], examples[split:]
    positives = sum(e.y for e in train)
    if positives < min_positives:
        raise ModelError(
            f"only {positives} winners in the training slice, need at least "
            f"{min_positives}. A model fitted on this would be noise."
        )
    if positives == len(train):
        raise ModelError("every training example is a winner — nothing to learn")

    # Cap the cost of the pure-Python optimiser. Sampled with a fixed seed so
    # the fit stays reproducible.
    if len(train) > max_train_rows:
        train = random.Random(seed).sample(train, max_train_rows)
        train.sort(key=lambda e: e.ts_ms)

    names = list(FEATURES)
    train_rows = [[e.x.get(n, 0.0) for n in names] for e in train]
    train_labels = [e.y for e in train]
    mean, std = _standardise(train_rows)

    scaled = [
        [(value - mean[i]) / std[i] for i, value in enumerate(row)]
        for row in train_rows
    ]
    weights, bias = _gradient_descent(
        scaled, train_labels, l2=l2, epochs=epochs, learning_rate=learning_rate
    )

    model = ProbabilityModel(
        features=names, mean=mean, std=std, weights=weights, bias=bias,
        n_train=len(train), n_test=len(test),
        trained_at_ms=int(time.time() * 1000),
    )
    model.train_metrics = asdict(
        evaluate([(model.predict(e.x), e.y) for e in train])
    )
    model.test_metrics = asdict(
        evaluate([(model.predict(e.x), e.y) for e in test])
    ) if test else {}
    return model


def expected_value_pct(
    probability: float, take_profit_pct: float, stop_loss_pct: float, cost_pct: float
) -> float:
    """Expected return per trade, in percent, after round-trip costs.

    The number that decides a trade. A 25% win rate is excellent when the win
    pays +80% and the loss costs -35%; a 60% win rate loses money when the
    payoff is the other way round. The score it replaces could not express
    this at all.
    """
    return (
        probability * take_profit_pct
        + (1.0 - probability) * stop_loss_pct
        - cost_pct
    )


def load_for_trading(cfg) -> ProbabilityModel:
    """Load a model and refuse it unless it is fit to trade on.

    Every check here exists because the failure it prevents is silent: a model
    that answers a different question, or one that learnt nothing, still
    returns a perfectly plausible-looking probability for every token.
    """
    model = ProbabilityModel.load(cfg.model_path)

    targets = (
        ("take_profit_pct", model.take_profit_pct, cfg.take_profit_pct),
        ("stop_loss_pct", model.stop_loss_pct, cfg.stop_loss_pct),
        ("horizon_minutes", model.horizon_minutes, cfg.horizon_minutes),
    )
    drifted = [
        f"{name}: model was fitted for {fitted:g}, config asks for {wanted:g}"
        for name, fitted, wanted in targets
        if abs(fitted - wanted) > 1e-6
    ]
    if drifted and not cfg.allow_target_mismatch:
        raise ModelError(
            f"{cfg.model_path} answers a different question than the config asks:"
            "\n  - " + "\n  - ".join(drifted) + "\nRefit with `memebot fit`."
        )

    if model.n_train < cfg.min_train_rows:
        raise ModelError(
            f"{cfg.model_path} was fitted on {model.n_train} rows, below the "
            f"{cfg.min_train_rows} required. Record for longer, then refit."
        )

    auc = model.test_metrics.get("auc")
    if auc is None:
        raise ModelError(
            f"{cfg.model_path} has no held-out evaluation, so there is no "
            "evidence it works. Refit with a test split."
        )
    if auc < cfg.min_test_auc:
        raise ModelError(
            f"{cfg.model_path} scores AUC {auc:.3f} on held-out data, below the "
            f"{cfg.min_test_auc:.3f} required (0.5 is a coin flip). It has not "
            "learnt anything that generalises — refusing to trade on it."
        )

    return model
