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
class Config:
    screener: ScreenerConfig = field(default_factory=ScreenerConfig)
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    exits: ExitConfig = field(default_factory=ExitConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    execution: ExecutionConfig = field(default_factory=ExecutionConfig)
    engine: EngineConfig = field(default_factory=EngineConfig)
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

    if cfg.engine.poll_interval_s < 1:
        raise ConfigError("engine.poll_interval_s must be >= 1")
