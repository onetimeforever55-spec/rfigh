"""Entry scoring and exit rules.

Entry is a weighted score over five components, each normalised to 0-1 so that
the weights in `StrategyConfig` are directly comparable. Exit is a priority
list: the first rule that fires wins, and rug-shaped conditions come first.
"""

from __future__ import annotations

import logging

from .config import ExitConfig, StrategyConfig
from .models import ExitDecision, Position, Signal, TokenSnapshot

log = logging.getLogger(__name__)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def score_token(snap: TokenSnapshot, cfg: StrategyConfig) -> Signal:
    """Score a candidate 0-100 and decide whether it is a buy."""
    m5, h1, h24 = snap.window("m5"), snap.window("h1"), snap.window("h24")
    reasons: list[str] = []

    # --- Hard vetoes: shapes we never want to enter, whatever the score. ---
    if h1.price_change_pct > cfg.max_price_change_h1:
        reasons.append(f"1h move +{h1.price_change_pct:.0f}% is a blow-off top")
    if h24.price_change_pct > cfg.max_price_change_h24:
        reasons.append(f"24h move +{h24.price_change_pct:.0f}% is overextended")
    if h1.price_change_pct < cfg.min_price_change_h1:
        reasons.append(f"1h move {h1.price_change_pct:+.1f}% below {cfg.min_price_change_h1:+.1f}%")
    if m5.price_change_pct < cfg.min_price_change_m5:
        reasons.append(f"5m move {m5.price_change_pct:+.1f}% below {cfg.min_price_change_m5:+.1f}%")
    if h1.buy_sell_ratio < cfg.min_buy_sell_ratio_h1:
        reasons.append(f"1h buy/sell {h1.buy_sell_ratio:.2f} below {cfg.min_buy_sell_ratio_h1:.2f}")
    if m5.buy_sell_ratio < cfg.min_buy_sell_ratio_m5:
        reasons.append(f"5m buy/sell {m5.buy_sell_ratio:.2f} below {cfg.min_buy_sell_ratio_m5:.2f}")

    vetoed = bool(reasons)

    # --- Components, each 0-1. ---
    # Momentum: reward a steady climb, with the recent window weighted higher.
    momentum = _clamp01(h1.price_change_pct / 60.0) * 0.6 + _clamp01(m5.price_change_pct / 12.0) * 0.4

    # Buy pressure: 1.0 buys/sell scores 0, 2.5 or better scores 1.
    pressure_h1 = _clamp01((h1.buy_sell_ratio - 1.0) / 1.5)
    pressure_m5 = _clamp01((m5.buy_sell_ratio - 1.0) / 1.5)
    buy_pressure = pressure_h1 * 0.6 + pressure_m5 * 0.4

    # Volume: turnover of the pool in the last hour. 1x liquidity/hour is hot.
    hourly_turnover = h1.volume_usd / snap.liquidity_usd if snap.liquidity_usd > 0 else 0.0
    volume = _clamp01(hourly_turnover)

    # Liquidity: deeper is safer to size into, with diminishing returns.
    liquidity = _clamp01(snap.liquidity_usd / 250_000.0)

    # Age: the sweet spot is roughly 1-12 hours old. Younger is unproven,
    # older has usually already had its run.
    age_h = snap.age_minutes / 60.0
    if age_h < 1:
        age = _clamp01(age_h)
    elif age_h <= 12:
        age = 1.0
    else:
        age = _clamp01(1.0 - (age_h - 12) / 60.0)

    components = {
        "momentum": momentum,
        "buy_pressure": buy_pressure,
        "volume": volume,
        "liquidity": liquidity,
        "age": age,
    }
    weights = {
        "momentum": cfg.weight_momentum,
        "buy_pressure": cfg.weight_buy_pressure,
        "volume": cfg.weight_volume,
        "liquidity": cfg.weight_liquidity,
        "age": cfg.weight_age,
    }
    total_weight = sum(weights.values()) or 1.0
    score = sum(components[k] * weights[k] for k in components) / total_weight * 100.0

    should_buy = not vetoed and score >= cfg.min_entry_score
    if not vetoed and not should_buy:
        reasons.append(f"score {score:.1f} below threshold {cfg.min_entry_score:.1f}")

    return Signal(
        mint=snap.mint,
        symbol=snap.symbol,
        score=score,
        should_buy=should_buy,
        reasons=reasons,
        components={k: round(v, 3) for k, v in components.items()},
    )


def evaluate_exit(
    position: Position, snap: TokenSnapshot, cfg: ExitConfig
) -> ExitDecision:
    """Decide whether (and how much) to sell. First matching rule wins."""
    price = snap.price_usd
    if price <= 0:
        return ExitDecision(False)

    pnl_pct = position.pnl_pct(price)

    # 1. Liquidity is being pulled — this is the rug case, exit everything now.
    if position.entry_liquidity_usd > 0:
        drop = (
            (position.entry_liquidity_usd - snap.liquidity_usd)
            / position.entry_liquidity_usd
            * 100.0
        )
        if drop >= cfg.max_liquidity_drop_pct:
            return ExitDecision(
                True, 1.0, f"liquidity -{drop:.0f}% since entry (rug risk)", urgent=True
            )

    # 2. Stop loss.
    if pnl_pct <= cfg.stop_loss_pct:
        return ExitDecision(True, 1.0, f"stop loss hit ({pnl_pct:+.1f}%)", urgent=True)

    # 3. Trailing stop, once armed by a large enough gain.
    peak = max(position.peak_price_usd, price)
    if peak > 0:
        peak_gain = (peak - position.avg_entry_price) / position.avg_entry_price * 100.0
        if peak_gain >= cfg.trailing_activation_pct:
            drawdown = (peak - price) / peak * 100.0
            if drawdown >= cfg.trailing_stop_pct:
                return ExitDecision(
                    True, 1.0,
                    f"trailing stop: -{drawdown:.1f}% off peak (+{peak_gain:.0f}%)",
                )

    # 4. Take-profit ladder. Fractions are of the ORIGINAL size, so convert to
    #    a fraction of what is left before selling.
    for idx, step in enumerate(cfg.take_profit_ladder):
        if idx < position.ladder_steps_done:
            continue
        target_gain, frac_of_original = float(step[0]), float(step[1])
        if pnl_pct >= target_gain:
            if position.qty <= 0:
                break
            frac_of_current = min(
                1.0, frac_of_original * position.original_qty / position.qty
            )
            return ExitDecision(
                True, frac_of_current, f"take profit {idx + 1} at {pnl_pct:+.0f}%"
            )
        break  # ladder is ordered; if this step is not hit, no later one is

    # 5. Momentum died: volume collapsed versus what we entered on.
    if (
        position.entry_volume_h1_usd > 0
        and position.age_minutes >= cfg.volume_collapse_grace_minutes
    ):
        current = snap.window("h1").volume_usd
        collapse = (
            (position.entry_volume_h1_usd - current) / position.entry_volume_h1_usd * 100.0
        )
        if collapse >= cfg.volume_collapse_pct:
            return ExitDecision(
                True, 1.0, f"1h volume -{collapse:.0f}% since entry (momentum gone)"
            )

    # 6. Time stop.
    if position.age_minutes >= cfg.max_hold_minutes:
        return ExitDecision(
            True, 1.0, f"max hold {cfg.max_hold_minutes:.0f}m reached ({pnl_pct:+.1f}%)"
        )

    return ExitDecision(False)
