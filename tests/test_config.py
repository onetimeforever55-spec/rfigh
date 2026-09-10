from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from memebot.config import Config, ConfigError, load_config, validate


def write(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "config.yaml"
    path.write_text(textwrap.dedent(body))
    return path


def test_defaults_are_valid() -> None:
    validate(Config())


def test_example_config_loads() -> None:
    cfg = load_config("config.example.yaml")
    assert cfg.execution.mode == "paper"
    assert cfg.screener.require_mint_authority_revoked


def test_pumpfun_profile_loads() -> None:
    cfg = load_config("config.pumpfun.yaml")
    assert cfg.pumpfun.enabled
    assert cfg.pumpfun.phase == "graduated"
    assert cfg.execution.mode == "paper"          # ships safe
    assert "pumpfun" not in cfg.screener.allowed_dex_ids
    assert cfg.exits.stop_loss_pct == -35.0


def test_nested_sections_are_parsed(tmp_path: Path) -> None:
    path = write(tmp_path, """
        risk:
          position_size_usd: 50
          max_open_positions: 3
        execution:
          mode: paper
    """)
    cfg = load_config(path)
    assert cfg.risk.position_size_usd == 50
    assert cfg.risk.max_open_positions == 3
    # Unspecified values keep their defaults.
    assert cfg.risk.max_daily_trades == 40


def test_unknown_option_is_rejected(tmp_path: Path) -> None:
    path = write(tmp_path, """
        risk:
          postion_size_usd: 50
    """)
    with pytest.raises(ConfigError, match="unknown option"):
        load_config(path)


def test_secrets_in_yaml_are_rejected(tmp_path: Path) -> None:
    path = write(tmp_path, """
        secrets:
          wallet_private_key: hunter2
    """)
    with pytest.raises(ConfigError, match="secrets must not live"):
        load_config(path)


def test_live_mode_without_a_key_is_refused(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("WALLET_PRIVATE_KEY", raising=False)
    path = write(tmp_path, """
        execution:
          mode: live
    """)
    with pytest.raises(ConfigError, match="WALLET_PRIVATE_KEY"):
        load_config(path)


def test_positive_stop_loss_is_rejected() -> None:
    cfg = Config()
    cfg.exits.stop_loss_pct = 25.0
    with pytest.raises(ConfigError, match="must be negative"):
        validate(cfg)


def test_ladder_selling_more_than_the_position_is_rejected() -> None:
    cfg = Config()
    cfg.exits.take_profit_ladder = [[40.0, 0.6], [100.0, 0.6]]
    with pytest.raises(ConfigError, match="more than 100%"):
        validate(cfg)


def test_unsorted_ladder_is_rejected() -> None:
    cfg = Config()
    cfg.exits.take_profit_ladder = [[100.0, 0.3], [40.0, 0.3]]
    with pytest.raises(ConfigError, match="ascending gain"):
        validate(cfg)


def test_missing_config_file_is_reported() -> None:
    with pytest.raises(ConfigError, match="not found"):
        load_config("does/not/exist.yaml")
