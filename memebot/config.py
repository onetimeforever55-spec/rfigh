"""Configuration loading and validation.

Config comes from a YAML file; anything secret (private key, RPC url with an
API token, Telegram credentials) comes from the environment instead, so the
YAML file stays safe to share.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any, get_type_hints

import yaml

# Well-known Solana mints used as quote currencies.
SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"


@dataclass
class ScreenerConfig:
    """Hard safety gates. A token failing any of these is never bought."""

    # Liquidity: too little and you cannot exit; too much and it is not a
    # memecoin play any more, it is a large cap.
    min_liquidity_usd: float = 20_000.0
    max_liquidity_usd: float = 3_000_000.0

    # Activity.
    min_volume_h1_usd: float = 25_000.0
    min_volume_h24_usd: float = 100_000.0
    min_txns_h1: int = 75

    # Volume relative to liquidity. Very high values mean wash trading.
    min_volume_liquidity_ratio: float = 0.5
    max_volume_liquidity_ratio: float = 60.0

    # Age. Brand new pairs are where the rugs are; very old ones are dead.
    min_age_minutes: float = 20.0
    max_age_hours: float = 96.0

    # Valuation.
    min_market_cap_usd: float = 50_000.0
    max_market_cap_usd: float = 30_000_000.0

    # Market cap far above liquidity means the float is thin relative to the
    # nominal valuation: a small sell moves the price a lot.
    max_mcap_liquidity_ratio: float = 150.0

    # Chain / venue.
    chain_id: str = "solana"
    allowed_quote_mints: list[str] = field(
        default_factory=lambda: [SOL_MINT, USDC_MINT]
    )
    # Empty means "any venue". Set to ["pumpfun", "pumpswap"] to trade only
    # pump.fun tokens.
    allowed_dex_ids: list[str] = field(default_factory=list)
    blocked_dex_ids: list[str] = field(default_factory=list)
    blocked_mints: list[str] = field(default_factory=list)
    blocked_symbol_keywords: list[str] = field(
        default_factory=lambda: ["test", "scam", "rug"]
    )

    # On-chain authority checks (need `solana_rpc_url`). These are the single
    # most effective rug filters available.
    require_mint_authority_revoked: bool = True
    require_freeze_authority_revoked: bool = True
    max_top_holder_pct: float = 25.0
    max_top10_holder_pct: float = 60.0
    # Reject when the holder distribution cannot be read at all, instead of
    # letting the token through unchecked. Free RPCs rate-limit hard, so on
    # one of those this will reject a lot — that is the honest outcome: the
    # check either ran or it did not.
    require_holder_data: bool = True
    # Share of supply the token's creator may still hold. The main rug vector
    # on a launchpad: 100 disables the check (the creator is often unknown).
    max_dev_holding_pct: float = 100.0

    # Optional third-party risk report.
    use_rugcheck: bool = True
    max_rugcheck_score: float = 40.0

    require_socials: bool = False


@dataclass
class StrategyConfig:
    """Entry signal tuning."""

    # Minimum composite score (0-100) required to open a position.
    min_entry_score: float = 60.0

    # Momentum windows, in percent.
    min_price_change_m5: float = 1.0
    min_price_change_h1: float = 5.0
    # Refuse to chase something that already went vertical.
    max_price_change_h1: float = 250.0
    max_price_change_h24: float = 900.0

    # Buy pressure: buys / sells over the window.
    min_buy_sell_ratio_m5: float = 1.0
    min_buy_sell_ratio_h1: float = 1.15

    # Normalisation of the momentum component: the move, in percent, that
    # scores full marks for that window. Memecoins on a launchpad move far
    # harder than established pairs, so this has to be venue-specific.
    momentum_scale_h1: float = 60.0
    momentum_scale_m5: float = 12.0

    # Shape of the age component, in minutes: the score ramps up until
    # `age_ramp_minutes`, sits at 1.0 until `age_peak_until_minutes`, then
    # decays to 0 over `age_decay_minutes`.
    age_ramp_minutes: float = 60.0
    age_peak_until_minutes: float = 720.0
    age_decay_minutes: float = 3_600.0

    # Relative weights of each scored component.
    weight_momentum: float = 30.0
    weight_buy_pressure: float = 25.0
    weight_volume: float = 25.0
    weight_liquidity: float = 10.0
    weight_age: float = 10.0


@dataclass
class ExitConfig:
    """Exit rules, evaluated in the order listed in `strategy.evaluate_exit`."""

    stop_loss_pct: float = -25.0
    max_hold_minutes: float = 240.0

    # Scale out on the way up: (gain %, fraction of the ORIGINAL size to sell).
    take_profit_ladder: list[list[float]] = field(
        default_factory=lambda: [[40.0, 0.4], [100.0, 0.3], [250.0, 0.2]]
    )

    # Trailing stop arms once the position has been up this much.
    trailing_activation_pct: float = 30.0
    trailing_stop_pct: float = 18.0

    # Emergency exits.
    max_liquidity_drop_pct: float = 45.0   # liquidity pulled -> rug in progress
    volume_collapse_pct: float = 85.0      # h1 volume vs. entry -> momentum dead
    volume_collapse_grace_minutes: float = 45.0


@dataclass
class PumpFunConfig:
    """pump.fun-specific gating. Inert unless `enabled` is true."""

    enabled: bool = False

    # Which launch phase to trade:
    #   "graduated" — only tokens that completed the bonding curve. Far fewer
    #                 candidates, far better survival odds. Start here.
    #   "curve"     — only tokens still on the curve. This is the lottery end.
    #   "both"
    phase: str = "graduated"

    # pump.fun mints are vanity addresses ending in "pump". Requiring the
    # suffix is how a graduated pump.fun token is told apart from any other
    # token on the same AMM without an extra request.
    require_pump_suffix: bool = True

    # Market cap at which the curve fills. Used to estimate curve progress
    # when the pump.fun API is unreachable.
    graduation_market_cap_usd: float = 69_000.0

    # Curve phase only: how full the curve must be. Below the floor there is
    # no demand yet; above the ceiling you are buying the last few percent
    # before graduation, where the sniper bots already are.
    min_curve_progress_pct: float = 40.0
    max_curve_progress_pct: float = 95.0

    # Graduated phase only: skip tokens whose run is already long over.
    max_minutes_since_launch: float = 2_880.0

    # Best-effort enrichment (creator address, exact curve reserves). The
    # endpoint is Cloudflare-protected and rate-limits hard, so the bot works
    # without it — this only decides whether it is worth trying.
    use_api: bool = True


@dataclass
class RiskConfig:
    starting_equity_usd: float = 1_000.0   # paper mode only
    position_size_usd: float = 25.0
    position_size_pct_equity: float = 3.0  # cap relative to current equity
    max_open_positions: int = 5
    max_daily_loss_usd: float = 150.0
    max_daily_trades: int = 40
    min_cash_reserve_usd: float = 0.0
    # Do not re-buy a token for this long after selling it.
    rebuy_cooldown_minutes: float = 120.0


@dataclass
class ExecutionConfig:
    mode: str = "paper"                # "paper" | "live"
    slippage_bps: int = 300            # 3%
    priority_fee_lamports: int = 200_000
    # Assumed round-trip cost applied to paper fills so paper PnL is not fiction.
    paper_fee_pct: float = 0.35
    paper_slippage_pct: float = 1.0
    max_price_impact_pct: float = 4.0
    quote_mint: str = SOL_MINT
    confirm_timeout_s: float = 90.0
    max_swap_retries: int = 3


@dataclass
class EngineConfig:
    poll_interval_s: float = 20.0        # position management cadence
    discovery_interval_s: float = 60.0   # new-candidate scan cadence
    max_candidates_per_scan: int = 40
    # Free-text queries used against the DexScreener search endpoint. Combined
    # with the boosted/trending token feeds.
    discovery_queries: list[str] = field(default_factory=lambda: ["SOL", "USDC"])
    dry_run_first_cycle: bool = False


@dataclass
class Secrets:
    """Loaded from the environment only, never from YAML."""

    solana_rpc_url: str = "https://api.mainnet-beta.solana.com"
    wallet_private_key: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    jupiter_api_key: str | None = None

    @classmethod
    def from_env(cls) -> "Secrets":
        return cls(
            solana_rpc_url=os.getenv("SOLANA_RPC_URL")
            or "https://api.mainnet-beta.solana.com",
            wallet_private_key=os.getenv("WALLET_PRIVATE_KEY") or None,
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN") or None,
            telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID") or None,
            jupiter_api_key=os.getenv("JUPITER_API_KEY") or None,
        )


@dataclass
class ProbabilityConfig:
    """Trading on measured frequencies instead of hand-set weights.

    `record` is independent of `enabled` on purpose: recording is what builds
    the dataset, so it runs from day one, while `enabled` stays off until
    there is a fitted model worth trusting.
    """

    # Write one row per candidate seen, every discovery cycle. Cheap, and the
    # only source of training data there is.
    record: bool = True
    # Drop observations older than this so the DB does not grow forever.
    retention_days: float = 30.0

    # Use the model to decide entries. Requires a fitted model on disk.
    enabled: bool = False
    model_path: str = "data/model.json"

    # The question the model answers: from here, does the price reach
    # +take_profit_pct before -stop_loss_pct, within horizon_minutes?
    take_profit_pct: float = 40.0
    stop_loss_pct: float = -25.0
    horizon_minutes: float = 240.0
    # A longer break in the data means the horizon is not really covered.
    max_gap_minutes: float = 15.0

    # Entry gates. A trade needs BOTH: enough probability to be worth the
    # slot, and a positive expectation after costs.
    min_probability: float = 0.0
    min_expected_value_pct: float = 0.0
    # Round-trip cost estimate: fees + slippage + priority fee, in percent.
    # Subtracted from every expected value, so an edge has to clear reality.
    round_trip_cost_pct: float = 3.0

    # Refuse a model whose held-out AUC is below this. 0.5 is a coin flip;
    # trading on a model that learnt nothing is worse than the heuristic,
    # because it looks principled.
    min_test_auc: float = 0.55
    # Refuse a model fitted on fewer than this many examples.
    min_train_rows: int = 500

    # Escape hatch for deliberately answering a different question than the
    # one the exit rules ask. Off, because that mismatch is almost always a
    # mistake.
    allow_target_mismatch: bool = False


@dataclass
class Config:
    screener: ScreenerConfig = field(default_factory=ScreenerConfig)
    pumpfun: PumpFunConfig = field(default_factory=PumpFunConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    exits: ExitConfig = field(default_factory=ExitConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    engine: EngineConfig = field(default_factory=EngineConfig)
    probability: ProbabilityConfig = field(default_factory=ProbabilityConfig)
    secrets: Secrets = field(default_factory=Secrets.from_env)

    database_path: str = "data/memebot.db"
    log_level: str = "INFO"
    log_file: str | None = "logs/memebot.log"


class ConfigError(ValueError):
    """Raised when the config file cannot be turned into a usable Config."""


def _build(cls: type, data: Any, path: str) -> Any:
    """Build a dataclass from a plain dict, rejecting unknown keys."""
    if data is None:
        return cls()
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: expected a mapping, got {type(data).__name__}")

    known = {f.name for f in fields(cls)}
    unknown = set(data) - known
    if unknown:
        raise ConfigError(
            f"{path}: unknown option(s) {sorted(unknown)}; "
            f"valid options are {sorted(known)}"
        )

    # `from __future__ import annotations` makes Field.type a string, so resolve
    # the real types before testing for nested dataclasses.
    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}
    for name, value in data.items():
        ftype = hints.get(name)
        if isinstance(ftype, type) and is_dataclass(ftype):
            kwargs[name] = _build(ftype, value, f"{path}.{name}")
        else:
            kwargs[name] = value
    return cls(**kwargs)


def load_config(path: str | Path | None = None) -> Config:
    """Load config from YAML, falling back to defaults when no file is given."""
    secrets = Secrets.from_env()
    if path is None:
        cfg = Config(secrets=secrets)
        validate(cfg)
        return cfg

    p = Path(path)
    if not p.exists():
        raise ConfigError(f"config file not found: {p}")
    raw = yaml.safe_load(p.read_text()) or {}
    if not isinstance(raw, dict):
        raise ConfigError(f"{p}: top level of the config must be a mapping")
    if "secrets" in raw:
        raise ConfigError(
            f"{p}: secrets must not live in the config file; "
            "set them as environment variables (see .env.example)"
        )

    cfg: Config = _build(Config, raw, str(p))
    cfg.secrets = secrets
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    """Fail fast on settings that would misbehave at runtime."""
    e = cfg.execution
    if e.mode not in ("paper", "live"):
        raise ConfigError(f"execution.mode must be 'paper' or 'live', got {e.mode!r}")
    if e.mode == "live" and not cfg.secrets.wallet_private_key:
        raise ConfigError(
            "execution.mode is 'live' but WALLET_PRIVATE_KEY is not set in the "
            "environment. Refusing to start."
        )
    if not 0 <= e.slippage_bps <= 5_000:
        raise ConfigError("execution.slippage_bps must be between 0 and 5000")

    r = cfg.risk
    if r.position_size_usd <= 0:
        raise ConfigError("risk.position_size_usd must be > 0")
    if r.max_open_positions < 1:
        raise ConfigError("risk.max_open_positions must be >= 1")

    x = cfg.exits
    if x.stop_loss_pct >= 0:
        raise ConfigError("exits.stop_loss_pct must be negative (e.g. -25)")
    total = 0.0
    last_gain = float("-inf")
    for i, step in enumerate(x.take_profit_ladder):
        if len(step) != 2:
            raise ConfigError(
                f"exits.take_profit_ladder[{i}] must be [gain_pct, fraction]"
            )
        gain, frac = float(step[0]), float(step[1])
        if gain <= last_gain:
            raise ConfigError(
                "exits.take_profit_ladder must be sorted by ascending gain"
            )
        if not 0 < frac <= 1:
            raise ConfigError(
                f"exits.take_profit_ladder[{i}] fraction must be in (0, 1]"
            )
        last_gain = gain
        total += frac
    if total > 1.0 + 1e-9:
        raise ConfigError(
            f"exits.take_profit_ladder sells {total:.0%} of the position, "
            "which is more than 100%"
        )

    s = cfg.screener
    if s.min_liquidity_usd >= s.max_liquidity_usd:
        raise ConfigError("screener.min_liquidity_usd must be < max_liquidity_usd")
    if s.min_age_minutes < 0:
        raise ConfigError("screener.min_age_minutes must be >= 0")

    pf = cfg.pumpfun
    if pf.phase not in ("curve", "graduated", "both"):
        raise ConfigError(
            f"pumpfun.phase must be 'curve', 'graduated' or 'both', got {pf.phase!r}"
        )
    if pf.min_curve_progress_pct >= pf.max_curve_progress_pct:
        raise ConfigError(
            "pumpfun.min_curve_progress_pct must be < max_curve_progress_pct"
        )
    if pf.enabled and pf.phase in ("curve", "both") and s.min_age_minutes > 30:
        raise ConfigError(
            f"pumpfun.phase includes the bonding curve but "
            f"screener.min_age_minutes is {s.min_age_minutes:.0f}: almost every "
            "curve token is younger than that, so nothing would ever be bought"
        )

    if cfg.engine.poll_interval_s < 1:
        raise ConfigError("engine.poll_interval_s must be >= 1")

    p = cfg.probability
    if p.stop_loss_pct >= 0:
        raise ConfigError("probability.stop_loss_pct must be negative (e.g. -25)")
    if p.take_profit_pct <= 0:
        raise ConfigError("probability.take_profit_pct must be positive")
    if p.horizon_minutes <= 0:
        raise ConfigError("probability.horizon_minutes must be > 0")
    if not 0.0 <= p.min_probability <= 1.0:
        raise ConfigError("probability.min_probability must be between 0 and 1")
    if p.retention_days <= 0:
        raise ConfigError("probability.retention_days must be > 0")

    # The model must answer the question the exit rules actually ask. A model
    # fitted on "+40% before -25% within 4h" says nothing useful about a bot
    # that sells at +30% and stops out at -35%, and the mismatch is invisible
    # at runtime: every probability still looks perfectly reasonable.
    if p.enabled and not p.allow_target_mismatch:
        first_rung = float(x.take_profit_ladder[0][0]) if x.take_profit_ladder else None
        mismatches = []
        if first_rung is not None and abs(p.take_profit_pct - first_rung) > 1e-6:
            mismatches.append(
                f"probability.take_profit_pct={p.take_profit_pct:g} but the first "
                f"take-profit rung is {first_rung:g}"
            )
        if abs(p.stop_loss_pct - x.stop_loss_pct) > 1e-6:
            mismatches.append(
                f"probability.stop_loss_pct={p.stop_loss_pct:g} but "
                f"exits.stop_loss_pct={x.stop_loss_pct:g}"
            )
        if abs(p.horizon_minutes - x.max_hold_minutes) > 1e-6:
            mismatches.append(
                f"probability.horizon_minutes={p.horizon_minutes:g} but "
                f"exits.max_hold_minutes={x.max_hold_minutes:g}"
            )
        if mismatches:
            raise ConfigError(
                "the probability targets do not match the exit rules, so the "
                "model would be answering a different question than the bot "
                "trades:\n  - " + "\n  - ".join(mismatches)
                + "\nAlign them, or set probability.allow_target_mismatch: true "
                "if the difference is deliberate."
            )
