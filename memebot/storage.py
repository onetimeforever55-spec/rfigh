"""SQLite persistence, so a restart does not lose open positions."""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

from .models import Position, PositionStatus, Side, Trade

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    pair_address TEXT NOT NULL,
    entry_price_usd REAL NOT NULL,
    entry_liquidity_usd REAL NOT NULL,
    entry_volume_h1_usd REAL NOT NULL,
    qty REAL NOT NULL,
    original_qty REAL NOT NULL,
    cost_usd REAL NOT NULL,
    realized_pnl_usd REAL NOT NULL DEFAULT 0,
    fees_usd REAL NOT NULL DEFAULT 0,
    peak_price_usd REAL NOT NULL DEFAULT 0,
    last_price_usd REAL NOT NULL DEFAULT 0,
    ladder_steps_done INTEGER NOT NULL DEFAULT 0,
    opened_at_ms INTEGER NOT NULL,
    closed_at_ms INTEGER,
    status TEXT NOT NULL,
    close_reason TEXT NOT NULL DEFAULT '',
    entry_score REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty REAL NOT NULL,
    price_usd REAL NOT NULL,
    value_usd REAL NOT NULL,
    fee_usd REAL NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    tx_signature TEXT,
    realized_pnl_usd REAL NOT NULL DEFAULT 0,
    ts_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(ts_ms);

CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Every candidate seen during discovery, whether or not it was bought.
-- This is the raw material the probability model is fitted on: recording only
-- what we bought would make it impossible to ever learn that a filter is
-- wrong, because the rejected tokens would have no outcome on record.
--
-- Only fields observable AT THAT INSTANT are stored. Nothing here is ever
-- back-filled, so a row cannot be contaminated by hindsight.
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_ms INTEGER NOT NULL,
    mint TEXT NOT NULL,
    symbol TEXT NOT NULL,
    price_usd REAL NOT NULL,
    liquidity_usd REAL NOT NULL,
    market_cap_usd REAL NOT NULL,
    age_minutes REAL NOT NULL,
    vol_m5_usd REAL NOT NULL,
    vol_h1_usd REAL NOT NULL,
    vol_h24_usd REAL NOT NULL,
    chg_m5_pct REAL NOT NULL,
    chg_h1_pct REAL NOT NULL,
    chg_h24_pct REAL NOT NULL,
    buys_m5 INTEGER NOT NULL,
    sells_m5 INTEGER NOT NULL,
    buys_h1 INTEGER NOT NULL,
    sells_h1 INTEGER NOT NULL,
    has_socials INTEGER NOT NULL,
    dex_id TEXT NOT NULL,
    passed_screen INTEGER NOT NULL,
    score REAL NOT NULL
);
-- Labelling walks one mint's history forward in time, so this is the index
-- that matters.
CREATE INDEX IF NOT EXISTS idx_obs_mint_ts ON observations(mint, ts_ms);
CREATE INDEX IF NOT EXISTS idx_obs_ts ON observations(ts_ms);
"""

_POSITION_COLUMNS = (
    "mint", "symbol", "pair_address", "entry_price_usd", "entry_liquidity_usd",
    "entry_volume_h1_usd", "qty", "original_qty", "cost_usd", "realized_pnl_usd",
    "fees_usd", "peak_price_usd", "last_price_usd", "ladder_steps_done",
    "opened_at_ms", "closed_at_ms", "status", "close_reason", "entry_score",
)


OBSERVATION_COLUMNS = (
    "ts_ms", "mint", "symbol", "price_usd", "liquidity_usd", "market_cap_usd",
    "age_minutes", "vol_m5_usd", "vol_h1_usd", "vol_h24_usd", "chg_m5_pct",
    "chg_h1_pct", "chg_h24_pct", "buys_m5", "sells_m5", "buys_h1", "sells_h1",
    "has_socials", "dex_id", "passed_screen", "score",
)


class Storage:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path))
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    # --- positions -------------------------------------------------------
    def save_position(self, position: Position) -> Position:
        values = [getattr(position, col) for col in _POSITION_COLUMNS]
        values[_POSITION_COLUMNS.index("status")] = position.status.value

        if position.id is None:
            placeholders = ", ".join("?" * len(_POSITION_COLUMNS))
            cur = self.conn.execute(
                f"INSERT INTO positions ({', '.join(_POSITION_COLUMNS)}) "
                f"VALUES ({placeholders})",
                values,
            )
            position.id = cur.lastrowid
        else:
            assignments = ", ".join(f"{c} = ?" for c in _POSITION_COLUMNS)
            self.conn.execute(
                f"UPDATE positions SET {assignments} WHERE id = ?",
                [*values, position.id],
            )
        self.conn.commit()
        return position

    def load_open_positions(self) -> list[Position]:
        rows = self.conn.execute(
            "SELECT * FROM positions WHERE status = ? ORDER BY opened_at_ms",
            (PositionStatus.OPEN.value,),
        ).fetchall()
        return [self._row_to_position(row) for row in rows]

    def load_closed_positions(self, limit: int = 100) -> list[Position]:
        rows = self.conn.execute(
            "SELECT * FROM positions WHERE status = ? ORDER BY closed_at_ms DESC LIMIT ?",
            (PositionStatus.CLOSED.value, limit),
        ).fetchall()
        return [self._row_to_position(row) for row in rows]

    @staticmethod
    def _row_to_position(row: sqlite3.Row) -> Position:
        return Position(
            id=row["id"],
            mint=row["mint"],
            symbol=row["symbol"],
            pair_address=row["pair_address"],
            entry_price_usd=row["entry_price_usd"],
            entry_liquidity_usd=row["entry_liquidity_usd"],
            entry_volume_h1_usd=row["entry_volume_h1_usd"],
            qty=row["qty"],
            original_qty=row["original_qty"],
            cost_usd=row["cost_usd"],
            realized_pnl_usd=row["realized_pnl_usd"],
            fees_usd=row["fees_usd"],
            peak_price_usd=row["peak_price_usd"],
            last_price_usd=row["last_price_usd"],
            ladder_steps_done=row["ladder_steps_done"],
            opened_at_ms=row["opened_at_ms"],
            closed_at_ms=row["closed_at_ms"],
            status=PositionStatus(row["status"]),
            close_reason=row["close_reason"],
            entry_score=row["entry_score"],
        )

    # --- trades ----------------------------------------------------------
    def save_trade(self, trade: Trade) -> Trade:
        cur = self.conn.execute(
            "INSERT INTO trades (mint, symbol, side, qty, price_usd, value_usd, "
            "fee_usd, reason, tx_signature, realized_pnl_usd, ts_ms) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                trade.mint, trade.symbol, trade.side.value, trade.qty,
                trade.price_usd, trade.value_usd, trade.fee_usd, trade.reason,
                trade.tx_signature, trade.realized_pnl_usd, trade.ts_ms,
            ),
        )
        trade.id = cur.lastrowid
        self.conn.commit()
        return trade

    def load_trades(self, limit: int = 200) -> list[Trade]:
        rows = self.conn.execute(
            "SELECT * FROM trades ORDER BY ts_ms DESC LIMIT ?", (limit,)
        ).fetchall()
        return [
            Trade(
                id=row["id"], mint=row["mint"], symbol=row["symbol"],
                side=Side(row["side"]), qty=row["qty"], price_usd=row["price_usd"],
                value_usd=row["value_usd"], fee_usd=row["fee_usd"],
                reason=row["reason"], tx_signature=row["tx_signature"],
                realized_pnl_usd=row["realized_pnl_usd"], ts_ms=row["ts_ms"],
            )
            for row in rows
        ]

    # --- observations ----------------------------------------------------
    def save_observations(self, rows: list[tuple]) -> int:
        """Bulk-insert one discovery cycle's worth of observations."""
        if not rows:
            return 0
        self.conn.executemany(
            f"INSERT INTO observations ({', '.join(OBSERVATION_COLUMNS)}) "
            f"VALUES ({', '.join('?' * len(OBSERVATION_COLUMNS))})",
            rows,
        )
        self.conn.commit()
        return len(rows)

    def observation_mints(self) -> list[str]:
        rows = self.conn.execute(
            "SELECT DISTINCT mint FROM observations ORDER BY mint"
        ).fetchall()
        return [row["mint"] for row in rows]

    def observations_for(self, mint: str) -> list[sqlite3.Row]:
        """One mint's full history, oldest first — the order labelling needs."""
        return self.conn.execute(
            "SELECT * FROM observations WHERE mint = ? ORDER BY ts_ms", (mint,)
        ).fetchall()

    def observation_stats(self) -> dict[str, float]:
        row = self.conn.execute(
            "SELECT COUNT(*) AS rows, COUNT(DISTINCT mint) AS mints, "
            "MIN(ts_ms) AS first_ms, MAX(ts_ms) AS last_ms FROM observations"
        ).fetchone()
        return {
            "rows": row["rows"] or 0,
            "mints": row["mints"] or 0,
            "first_ms": row["first_ms"] or 0,
            "last_ms": row["last_ms"] or 0,
        }

    def prune_observations(self, older_than_ms: int) -> int:
        """Drop history past the retention window, so the DB stops growing."""
        cur = self.conn.execute(
            "DELETE FROM observations WHERE ts_ms < ?", (older_than_ms,)
        )
        self.conn.commit()
        return cur.rowcount

    # --- key/value state -------------------------------------------------
    def get_state(self, key: str, default: str | None = None) -> str | None:
        row = self.conn.execute(
            "SELECT value FROM state WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default

    def set_state(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT INTO state (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        self.conn.commit()
