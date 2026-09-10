"""The dashboard: what it shows, and what it must never be able to do."""

from __future__ import annotations

import sqlite3
import time

import pytest
from aiohttp.test_utils import TestClient, TestServer

from memebot.config import Config
from memebot.execution.paper import PaperExecutor
from memebot.models import OrderResult, PositionStatus
from memebot.portfolio import Portfolio
from memebot.storage import Storage
from memebot.web import build_state, make_app

from .conftest import make_snapshot


@pytest.fixture
def db(tmp_path):
    """A database with one closed loser and one open winner."""
    path = tmp_path / "memebot.db"
    storage = Storage(path)
    portfolio = Portfolio(storage, 1_000.0)

    loser = make_snapshot(mint="LOSE", symbol="LOSE", price_usd=0.001)
    portfolio.open_position(
        loser, OrderResult(ok=True, qty=10_000, price_usd=0.001,
                           value_usd=10.0, fee_usd=0.05), 70.0)
    portfolio.apply_sell(
        portfolio.get("LOSE"),
        OrderResult(ok=True, qty=10_000, price_usd=0.0006,
                    value_usd=6.0, fee_usd=0.03),
        "stop loss hit (-40.0%)")

    winner = make_snapshot(mint="WIN", symbol="WIN", price_usd=0.002)
    portfolio.open_position(
        winner, OrderResult(ok=True, qty=5_000, price_usd=0.002,
                            value_usd=10.0, fee_usd=0.05), 80.0)
    position = portfolio.get("WIN")
    position.last_price_usd = 0.003          # +50%
    storage.save_position(position)

    storage.close()
    return path


@pytest.fixture
def cfg(db) -> Config:
    cfg = Config()
    cfg.database_path = str(db)
    return cfg


class TestState:
    def test_it_separates_realised_from_open(self, cfg):
        state = build_state(cfg.database_path, cfg)
        assert state["equity"]["realised"] == pytest.approx(-4.0)
        assert state["equity"]["unrealised"] == pytest.approx(5.0)
        assert state["equity"]["total_pnl"] == pytest.approx(1.0)

    def test_open_positions_are_priced_from_the_engines_last_look(self, cfg):
        position = build_state(cfg.database_path, cfg)["positions"][0]
        assert position["symbol"] == "WIN"
        assert position["pnl_pct"] == pytest.approx(50.0)
        assert position["value_usd"] == pytest.approx(15.0)

    def test_closed_positions_are_not_listed_as_open(self, cfg):
        state = build_state(cfg.database_path, cfg)
        assert [p["symbol"] for p in state["positions"]] == ["WIN"]
        assert state["stats"]["closed"] == 1
        assert state["stats"]["wins"] == 0

    def test_trades_come_back_newest_first(self, cfg):
        trades = build_state(cfg.database_path, cfg)["trades"]
        assert [t["ts_ms"] for t in trades] == sorted(
            (t["ts_ms"] for t in trades), reverse=True
        )

    def test_recent_activity_reads_as_running(self, cfg):
        """The engine writes every cycle, so a fresh row means it is alive."""
        assert build_state(cfg.database_path, cfg)["alive"] is True

    def test_silence_reads_as_stopped(self, cfg):
        """…and silence past a few discovery cycles means it stopped. Without
        this the page would keep showing stale positions as if they were live."""
        conn = sqlite3.connect(cfg.database_path)
        stale = int(time.time() * 1000) - 3_600_000
        conn.execute("UPDATE trades SET ts_ms = ?", (stale,))
        conn.commit()
        conn.close()

        state = build_state(cfg.database_path, cfg)
        assert state["alive"] is False
        assert state["last_seen_ms"] == stale

    def test_a_missing_database_explains_itself(self, cfg, tmp_path):
        state = build_state(str(tmp_path / "nope.db"), cfg)
        assert "error" in state
        assert "has the bot ever run" in state["error"]

    def test_no_secret_ever_reaches_the_payload(self, cfg):
        """The dashboard is the thing most likely to be exposed, so it must
        not be able to leak a key even if it wanted to."""
        cfg.secrets.wallet_private_key = "SUPERSECRETKEY123"
        cfg.secrets.telegram_bot_token = "TELEGRAMSECRET"
        blob = repr(build_state(cfg.database_path, cfg))
        assert "SUPERSECRETKEY123" not in blob
        assert "TELEGRAMSECRET" not in blob


class TestReadOnly:
    async def test_the_dashboard_opens_the_database_read_only(self, cfg):
        """A bug here must never be able to corrupt the bot's state."""
        from memebot.web import _query

        conn = _query(cfg.database_path)
        try:
            with pytest.raises(sqlite3.OperationalError):
                conn.execute("DELETE FROM positions")
        finally:
            conn.close()


class TestAuth:
    async def _client(self, cfg, token):
        client = TestClient(TestServer(make_app(cfg, token)))
        await client.start_server()
        return client

    async def test_no_token_means_open_access(self, cfg):
        client = await self._client(cfg, None)
        try:
            assert (await client.get("/")).status == 200
            assert (await client.get("/api/state")).status == 200
        finally:
            await client.close()

    async def test_a_wrong_token_is_refused(self, cfg):
        client = await self._client(cfg, "correct-horse")
        try:
            assert (await client.get("/api/state")).status == 401
            assert (await client.get("/api/state?t=wrong")).status == 401
            assert (await client.get("/?t=wrong")).status == 401
        finally:
            await client.close()

    async def test_the_right_token_gets_through_either_way(self, cfg):
        client = await self._client(cfg, "correct-horse")
        try:
            assert (await client.get("/api/state?t=correct-horse")).status == 200
            resp = await client.get(
                "/api/state", headers={"X-Auth-Token": "correct-horse"}
            )
            assert resp.status == 200
            assert (await resp.json())["mode"] == "paper"
        finally:
            await client.close()


class TestPage:
    async def test_the_page_is_self_contained(self, cfg):
        """No CDN, no build step: it has to render on a phone with only the
        bot's own port reachable."""
        client = TestClient(TestServer(make_app(cfg, None)))
        await client.start_server()
        try:
            html = await (await client.get("/")).text()
        finally:
            await client.close()

        assert "<title>memebot</title>" in html
        assert "viewport" in html
        for remote in ("http://", "https://"):
            # the only absolute URLs allowed are inside the inline SVG favicon
            for chunk in html.split(remote)[1:]:
                assert chunk.startswith("www.w3.org/2000/svg"), chunk[:60]
