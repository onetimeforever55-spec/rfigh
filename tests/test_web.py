"""The dashboard: what it shows, and what it must never be able to do."""

from __future__ import annotations

import pathlib
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


class TestWhyItIsNotBuying:
    """An idle bot and a broken bot both show an empty position list. What
    separates them is the gate breakdown, so it has to survive the round trip
    from the engine to the page."""

    async def test_the_engine_records_what_blocked_each_cycle(self, tmp_path):
        import json

        from memebot.engine import TradingEngine
        from memebot.execution.paper import PaperExecutor

        from .conftest import make_pair
        from .test_engine import FakeHttp

        cfg = Config()
        cfg.engine.discovery_queries = ["SOL"]
        cfg.database_path = str(tmp_path / "cycle.db")
        http = FakeHttp()
        http.pairs = [
            make_pair(mint="Thin", symbol="THIN", liquidity_usd=100),
            make_pair(mint="Quiet", symbol="QUIET", vol_h1=1.0, buys_h1=1, sells_h1=1),
        ]
        storage = Storage(cfg.database_path)
        engine = TradingEngine(cfg, http=http, storage=storage,
                               executor=PaperExecutor(cfg))
        await engine.discover_and_trade()

        summary = json.loads(storage.get_state("last_cycle"))
        assert summary["scanned"] == 2
        assert summary["gates"]                       # something did the blocking
        assert sum(summary["gates"].values()) > 0
        storage.close()

    def test_the_payload_carries_it_to_the_page(self, cfg, db):
        import json

        storage = Storage(db)
        storage.set_state("last_cycle", json.dumps({
            "ts_ms": 1_700_000_000_000, "scanned": 40, "passed_screen": 2,
            "gates": {"rpc_error": 2, "min_liquidity": 30},
            "near_misses": [
                {"symbol": "TK", "code": "rpc_error",
                 "reason": "holder data unreadable (HTTP 429) — needs a paid RPC"},
            ],
        }))
        storage.close()

        cycle = build_state(cfg.database_path, cfg)["last_cycle"]
        assert cycle["gates"]["rpc_error"] == 2
        assert cycle["near_misses"][0]["code"] == "rpc_error"

    def test_a_bot_that_never_ran_reports_no_cycle(self, cfg):
        assert build_state(cfg.database_path, cfg)["last_cycle"] is None

    def test_corrupt_state_does_not_break_the_page(self, cfg, db):
        """Better a page with one section missing than a 500 on your phone."""
        storage = Storage(db)
        storage.set_state("last_cycle", "{not json")
        storage.close()
        assert build_state(cfg.database_path, cfg)["last_cycle"] is None

    def test_every_gate_code_the_screener_emits_has_a_label(self):
        """A new gate must not surface on the page as a raw snake_case code."""
        import re

        from memebot import web

        source = (
            pathlib.Path("memebot/screener.py").read_text()
            + pathlib.Path("memebot/engine.py").read_text()
        )
        emitted = set(re.findall(r'\.fail\(\s*[^)]*?"([a-z0-9_]+)"\s*\)', source, re.S))
        block = web.PAGE.split("const GATES = {", 1)[1].split("};", 1)[0]
        labelled = set(re.findall(r'([a-z0-9_]+):"', block))
        missing = emitted - labelled - {"other"}
        assert not missing, f"gate codes with no Spanish label: {sorted(missing)}"
