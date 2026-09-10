"""Recording what the bot saw, and labelling what happened next.

This is the bridge between "the bot has opinions" and "the bot has measured
frequencies". Three jobs live here:

1. **Record.** Every discovery cycle writes one row per candidate — bought or
   not, screened out or not. Recording only what we bought would make the
   dataset useless: you can never learn that a filter rejects winners if the
   rejected tokens have no outcome on record.

2. **Featurise.** Turn a snapshot into the numbers the model consumes. Live
   decisions and training BOTH go through `features()`, from the same raw
   dict, so a feature can never mean one thing at fit time and another at
   decision time. That mismatch — train/serve skew — is the classic way a
   model looks excellent offline and loses money live.

3. **Label.** Walk each mint's history forward and ask the only question that
   pays: starting here, did the price reach the take-profit before it hit the
   stop, inside the holding window?

Three biases are handled explicitly rather than quietly:

- **Look-ahead.** Features come from a single row. A row is written once and
  never back-filled, so no future information can reach it.
- **Censoring.** A token that stops appearing in the feed has no outcome. Its
  observations are dropped, not silently counted as losers — but they are
  counted and reported, because a high censored share means the dataset is
  describing something narrower than you think.
- **Gaps.** If the bot was off, the horizon is not covered. A gap longer than
  `max_gap_minutes` ends coverage instead of pretending the price did nothing
  in between.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

from .models import TokenSnapshot

log = logging.getLogger(__name__)

# Order matters and is part of the saved model: changing this list invalidates
# any model fitted before the change, which `model.py` enforces by name.
FEATURES: tuple[str, ...] = (
    "log_liquidity",
    "log_mcap",
    "log_age_minutes",
    "turnover_h1",
    "vol_ratio_m5_h1",
    "chg_m5_pct",
    "chg_h1_pct",
    "chg_h24_pct",
    "buy_ratio_m5",
    "buy_ratio_h1",
    "log_txns_h1",
    "txn_size_h1",
    "mcap_liq_ratio",
    "has_socials",
)


def _log1p_pos(value: float) -> float:
    """log1p that never sees a negative: feeds occasionally return junk."""
    return math.log1p(max(0.0, value))


def _ratio(buys: float, sells: float) -> float:
    """Buys per side, mapped to 0-1. 0.5 is balanced, 1.0 is all buys.

    A raw buys/sells ratio is unbounded and explodes when sells is 0, which
    would let one degenerate row dominate a linear model.
    """
    total = buys + sells
    if total <= 0:
        return 0.5
    return buys / total


def features(raw: dict[str, float]) -> dict[str, float]:
    """The single definition of every feature, used by fitting and by live
    scoring alike. `raw` holds the observable fields, nothing derived."""
    liquidity = max(0.0, float(raw.get("liquidity_usd", 0.0)))
    mcap = max(0.0, float(raw.get("market_cap_usd", 0.0)))
    age = max(0.0, float(raw.get("age_minutes", 0.0)))
    vol_m5 = max(0.0, float(raw.get("vol_m5_usd", 0.0)))
    vol_h1 = max(0.0, float(raw.get("vol_h1_usd", 0.0)))
    buys_m5 = float(raw.get("buys_m5", 0.0))
    sells_m5 = float(raw.get("sells_m5", 0.0))
    buys_h1 = float(raw.get("buys_h1", 0.0))
    sells_h1 = float(raw.get("sells_h1", 0.0))
    txns_h1 = buys_h1 + sells_h1

    return {
        # Heavy-tailed money amounts: logs keep a $2M pool from swamping a
        # $20k one in a linear model.
        "log_liquidity": _log1p_pos(liquidity),
        "log_mcap": _log1p_pos(mcap),
        "log_age_minutes": _log1p_pos(age),
        # Turnover, not raw volume: $50k/h means something different in a
        # $10k pool than in a $1M pool.
        "turnover_h1": vol_h1 / liquidity if liquidity > 0 else 0.0,
        # Is the activity accelerating? m5 scaled to an hourly rate.
        "vol_ratio_m5_h1": (vol_m5 * 12.0) / vol_h1 if vol_h1 > 0 else 0.0,
        # Percent moves, clipped: a +40000% row is a data error, not a signal.
        "chg_m5_pct": max(-100.0, min(500.0, float(raw.get("chg_m5_pct", 0.0)))),
        "chg_h1_pct": max(-100.0, min(1000.0, float(raw.get("chg_h1_pct", 0.0)))),
        "chg_h24_pct": max(-100.0, min(5000.0, float(raw.get("chg_h24_pct", 0.0)))),
        "buy_ratio_m5": _ratio(buys_m5, sells_m5),
        "buy_ratio_h1": _ratio(buys_h1, sells_h1),
        "log_txns_h1": _log1p_pos(txns_h1),
        # Average trade size: separates a crowd from one whale.
        "txn_size_h1": vol_h1 / txns_h1 if txns_h1 > 0 else 0.0,
        "mcap_liq_ratio": min(1000.0, mcap / liquidity) if liquidity > 0 else 0.0,
        "has_socials": 1.0 if raw.get("has_socials") else 0.0,
    }


def raw_from_snapshot(snap: TokenSnapshot) -> dict[str, float]:
    """Observable fields of a live snapshot, in the shape `features()` wants."""
    m5, h1, h24 = snap.window("m5"), snap.window("h1"), snap.window("h24")
    return {
        "price_usd": snap.price_usd,
        "liquidity_usd": snap.liquidity_usd,
        "market_cap_usd": snap.market_cap_usd or snap.fdv_usd,
        "age_minutes": snap.age_minutes if snap.age_minutes != float("inf") else 0.0,
        "vol_m5_usd": m5.volume_usd,
        "vol_h1_usd": h1.volume_usd,
        "vol_h24_usd": h24.volume_usd,
        "chg_m5_pct": m5.price_change_pct,
        "chg_h1_pct": h1.price_change_pct,
        "chg_h24_pct": h24.price_change_pct,
        "buys_m5": m5.buys,
        "sells_m5": m5.sells,
        "buys_h1": h1.buys,
        "sells_h1": h1.sells,
        "has_socials": snap.has_socials,
    }


def features_from_snapshot(snap: TokenSnapshot) -> dict[str, float]:
    return features(raw_from_snapshot(snap))


def observation_row(
    snap: TokenSnapshot, *, passed_screen: bool, score: float
) -> tuple:
    """One row for `Storage.save_observations`, matching OBSERVATION_COLUMNS."""
    raw = raw_from_snapshot(snap)
    return (
        snap.fetched_at_ms,
        snap.mint,
        snap.symbol,
        raw["price_usd"],
        raw["liquidity_usd"],
        raw["market_cap_usd"],
        raw["age_minutes"],
        raw["vol_m5_usd"],
        raw["vol_h1_usd"],
        raw["vol_h24_usd"],
        raw["chg_m5_pct"],
        raw["chg_h1_pct"],
        raw["chg_h24_pct"],
        int(raw["buys_m5"]),
        int(raw["sells_m5"]),
        int(raw["buys_h1"]),
        int(raw["sells_h1"]),
        1 if raw["has_socials"] else 0,
        snap.dex_id,
        1 if passed_screen else 0,
        float(score),
    )


@dataclass
class Example:
    """One labelled decision point."""

    mint: str
    symbol: str
    ts_ms: int
    x: dict[str, float]
    y: int                    # 1 = take-profit reached before the stop
    mfe_pct: float            # best excursion seen inside the window
    mae_pct: float            # worst excursion seen inside the window
    passed_screen: bool
    score: float


@dataclass
class Dataset:
    examples: list[Example] = field(default_factory=list)
    censored: int = 0         # decision points whose outcome never resolved
    skipped: int = 0          # unusable rows (no price)
    mints: int = 0

    def __len__(self) -> int:
        return len(self.examples)

    @property
    def positives(self) -> int:
        return sum(e.y for e in self.examples)

    @property
    def base_rate(self) -> float:
        """The number that matters most. Every model has to beat this."""
        return self.positives / len(self.examples) if self.examples else 0.0

    @property
    def span_hours(self) -> float:
        if not self.examples:
            return 0.0
        stamps = [e.ts_ms for e in self.examples]
        return (max(stamps) - min(stamps)) / 3_600_000

    def sorted_by_time(self) -> list[Example]:
        return sorted(self.examples, key=lambda e: e.ts_ms)


def label_mint_history(
    rows: list,
    *,
    take_profit_pct: float,
    stop_loss_pct: float,
    horizon_minutes: float,
    max_gap_minutes: float,
) -> tuple[list[Example], int, int]:
    """Label every decision point in one mint's history.

    Returns (examples, censored, skipped). `rows` must be ordered by time.
    """
    examples: list[Example] = []
    censored = 0
    skipped = 0
    horizon_ms = horizon_minutes * 60_000
    gap_ms = max_gap_minutes * 60_000

    for i, row in enumerate(rows):
        entry = float(row["price_usd"])
        if entry <= 0:
            skipped += 1
            continue

        label: int | None = None
        mfe = 0.0
        mae = 0.0
        previous_ts = int(row["ts_ms"])

        for j in range(i + 1, len(rows)):
            ts = int(rows[j]["ts_ms"])
            # The bot was down, or the token dropped out and came back: we
            # cannot know what the price did in between, so coverage ends.
            if ts - previous_ts > gap_ms:
                break
            if ts - int(row["ts_ms"]) > horizon_ms:
                # The window closed with neither level touched: a real loss
                # for this strategy, because the time stop would have sold it.
                label = 0
                break
            previous_ts = ts

            price = float(rows[j]["price_usd"])
            if price <= 0:
                continue
            ret = (price - entry) / entry * 100.0
            mfe = max(mfe, ret)
            mae = min(mae, ret)

            # Order matters: whichever level is touched first is the outcome.
            # Checking the stop first is the pessimistic tie-break, and the
            # honest one — inside a single polling interval we cannot know
            # which came first, and assuming the good one inflates every
            # number downstream.
            if ret <= stop_loss_pct:
                label = 0
                break
            if ret >= take_profit_pct:
                label = 1
                break

        if label is None:
            # Ran out of data before the horizon closed. Unknowable, so it is
            # dropped — counting it as a loss would be a guess dressed up as
            # data.
            censored += 1
            continue

        examples.append(
            Example(
                mint=row["mint"],
                symbol=row["symbol"],
                ts_ms=int(row["ts_ms"]),
                x=features(dict(row)),
                y=label,
                mfe_pct=mfe,
                mae_pct=mae,
                passed_screen=bool(row["passed_screen"]),
                score=float(row["score"]),
            )
        )

    return examples, censored, skipped


def build_dataset(
    storage,
    *,
    take_profit_pct: float,
    stop_loss_pct: float,
    horizon_minutes: float,
    max_gap_minutes: float = 15.0,
    screened_only: bool = False,
) -> Dataset:
    """Turn the recorded observations into labelled training examples."""
    dataset = Dataset()
    mints = storage.observation_mints()
    dataset.mints = len(mints)

    for mint in mints:
        rows = storage.observations_for(mint)
        if len(rows) < 2:
            dataset.skipped += len(rows)
            continue
        examples, censored, skipped = label_mint_history(
            rows,
            take_profit_pct=take_profit_pct,
            stop_loss_pct=stop_loss_pct,
            horizon_minutes=horizon_minutes,
            max_gap_minutes=max_gap_minutes,
        )
        if screened_only:
            examples = [e for e in examples if e.passed_screen]
        dataset.examples.extend(examples)
        dataset.censored += censored
        dataset.skipped += skipped

    return dataset
