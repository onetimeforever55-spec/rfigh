"""Read-only dashboard, built for a phone screen.

A separate process from the trading loop, sharing only the SQLite file. That
separation is the point:

- It cannot trade. There is no executor here and no wallet key is ever read,
  so exposing this on your network cannot cost you money.
- It cannot interfere. Nothing here writes to the database, so a stuck request
  or a crashed dashboard leaves the bot exiting its positions as usual.

Prices come from `last_price_usd`, which the engine refreshes every poll, so
the numbers are as fresh as the bot's own view — no extra API calls, no rate
limit spent on rendering a page.
"""

from __future__ import annotations

import logging
import secrets
import sqlite3
import time
from pathlib import Path

from aiohttp import web

log = logging.getLogger(__name__)

LOOPBACK = ("127.0.0.1", "localhost", "::1")


def _query(db: Path) -> sqlite3.Connection:
    # Read-only URI: a bug here can never corrupt the bot's state.
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def build_state(db_path: str, cfg) -> dict:
    """Everything the page shows, in one payload."""
    db = Path(db_path)
    if not db.exists():
        return {"error": f"no database at {db} — has the bot ever run?"}

    conn = _query(db)
    try:
        positions = []
        realised = 0.0
        unrealised = 0.0

        for row in conn.execute("SELECT * FROM positions ORDER BY opened_at_ms DESC"):
            realised += row["realized_pnl_usd"]
            if row["status"] != "open":
                continue
            qty, original = row["qty"], row["original_qty"]
            price = row["last_price_usd"] or row["entry_price_usd"]
            open_cost = row["cost_usd"] * (qty / original) if original else 0.0
            value = qty * price
            pnl = value - open_cost
            unrealised += pnl
            avg_entry = row["cost_usd"] / original if original else 0.0
            positions.append({
                "symbol": row["symbol"],
                "mint": row["mint"],
                "qty": qty,
                "cost_usd": open_cost,
                "value_usd": value,
                "pnl_usd": pnl,
                "pnl_pct": (price - avg_entry) / avg_entry * 100 if avg_entry else 0.0,
                "entry_price": avg_entry,
                "last_price": price,
                "score": row["entry_score"],
                "opened_at_ms": row["opened_at_ms"],
                "remaining_pct": (qty / original * 100) if original else 0.0,
                "ladder_steps_done": row["ladder_steps_done"],
                "realized_usd": row["realized_pnl_usd"],
            })

        trades = [{
            "ts_ms": r["ts_ms"], "symbol": r["symbol"], "side": r["side"],
            "qty": r["qty"], "price_usd": r["price_usd"],
            "value_usd": r["value_usd"], "fee_usd": r["fee_usd"],
            "pnl_usd": r["realized_pnl_usd"], "reason": r["reason"],
        } for r in conn.execute("SELECT * FROM trades ORDER BY ts_ms DESC LIMIT 50")]

        closed = conn.execute(
            "SELECT realized_pnl_usd FROM positions WHERE status = 'closed'"
        ).fetchall()
        wins = sum(1 for r in closed if r["realized_pnl_usd"] > 0)
        fees = conn.execute("SELECT COALESCE(SUM(fee_usd), 0) AS f FROM trades").fetchone()["f"]

        obs = conn.execute(
            "SELECT COUNT(*) AS rows, COUNT(DISTINCT mint) AS mints, "
            "MIN(ts_ms) AS first_ms, MAX(ts_ms) AS last_ms FROM observations"
        ).fetchone()

        # "Is it still running?" without touching the process: the engine
        # writes observations every discovery cycle, so a stale newest row
        # means the loop stopped.
        last_seen = max(
            obs["last_ms"] or 0,
            trades[0]["ts_ms"] if trades else 0,
        )
        stale_after = cfg.engine.discovery_interval_s * 3 * 1000
        alive = bool(last_seen) and (time.time() * 1000 - last_seen) < stale_after

        starting = cfg.risk.starting_equity_usd
        return {
            "generated_at_ms": int(time.time() * 1000),
            "mode": cfg.execution.mode,
            "pumpfun": cfg.pumpfun.enabled,
            "probability": cfg.probability.enabled,
            "alive": alive,
            "last_seen_ms": last_seen,
            "equity": {
                "starting": starting,
                "realised": realised,
                "unrealised": unrealised,
                "total_pnl": realised + unrealised,
                "fees": fees,
                "open_value": sum(p["value_usd"] for p in positions),
            },
            "positions": positions,
            "trades": trades,
            "stats": {
                "open": len(positions),
                "closed": len(closed),
                "wins": wins,
                "win_rate": (wins / len(closed)) if closed else None,
                "max_open": cfg.risk.max_open_positions,
                "observations": obs["rows"] or 0,
                "mints": obs["mints"] or 0,
                "span_hours": ((obs["last_ms"] or 0) - (obs["first_ms"] or 0)) / 3_600_000,
            },
        }
    finally:
        conn.close()


def make_app(cfg, token: str | None) -> web.Application:
    app = web.Application()

    def authorised(request: web.Request) -> bool:
        if not token:
            return True
        given = request.query.get("t") or request.headers.get("X-Auth-Token", "")
        # Constant-time: a plain == leaks the token through timing.
        return secrets.compare_digest(given, token)

    async def index(request: web.Request) -> web.Response:
        if not authorised(request):
            return web.Response(status=401, text="unauthorised")
        return web.Response(text=PAGE, content_type="text/html")

    async def state(request: web.Request) -> web.Response:
        if not authorised(request):
            return web.json_response({"error": "unauthorised"}, status=401)
        return web.json_response(build_state(cfg.database_path, cfg))

    app.router.add_get("/", index)
    app.router.add_get("/api/state", state)
    return app


PAGE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0E11">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230B0E11'/%3E%3Ctext x='16' y='23' font-size='19' font-family='sans-serif' font-weight='bold' fill='%23FCD535' text-anchor='middle'%3Em%3C/text%3E%3C/svg%3E">
<title>memebot</title>
<style>
  :root {
    --bg:#0B0E11; --card:#181A20; --card2:#1E2329; --line:#2B3139;
    --text:#EAECEF; --dim:#848E9C; --accent:#FCD535;
    --up:#0ECB81; --down:#F6465D;
  }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    margin:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    font-size:14px; padding-bottom:env(safe-area-inset-bottom);
  }
  .num { font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }
  .up { color:var(--up); } .down { color:var(--down); } .dim { color:var(--dim); }

  header {
    position:sticky; top:0; z-index:10; background:var(--bg);
    padding:14px 16px 10px; border-bottom:1px solid var(--line);
  }
  .brand { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
  .brand b { font-size:15px; letter-spacing:.2px; }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--dim); }
  .dot.on { background:var(--up); box-shadow:0 0 8px var(--up); }
  .tag {
    font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px;
    background:var(--card2); color:var(--dim); letter-spacing:.4px;
  }
  .tag.live { background:var(--down); color:#fff; }
  .tag.paper { background:var(--accent); color:#0B0E11; }

  .equity .label { font-size:11px; color:var(--dim); margin-bottom:3px; }
  .equity .big { font-size:28px; font-weight:600; letter-spacing:-.5px; }
  .equity .sub { font-size:13px; margin-top:3px; }

  nav { display:flex; gap:4px; padding:10px 12px 0; }
  nav button {
    flex:1; background:none; border:none; color:var(--dim); font-size:13px;
    font-weight:600; padding:9px 0 10px; border-bottom:2px solid transparent;
    font-family:inherit; cursor:pointer;
  }
  nav button[aria-selected="true"] { color:var(--text); border-bottom-color:var(--accent); }

  main { padding:12px; display:grid; gap:10px; }
  .card { background:var(--card); border-radius:8px; padding:12px 14px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
  .row + .row { margin-top:7px; }

  .tiles { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .tile { background:var(--card); border-radius:8px; padding:11px 13px; }
  .tile .k { font-size:11px; color:var(--dim); margin-bottom:5px; }
  .tile .v { font-size:17px; font-weight:600; }

  .pos-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:9px; }
  .sym { font-size:15px; font-weight:700; }
  .pct { font-size:16px; font-weight:700; }
  .bar { height:3px; background:var(--line); border-radius:2px; overflow:hidden; margin-top:10px; }
  .bar i { display:block; height:100%; background:var(--accent); }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:5px 10px; font-size:12px; }
  .meta span:nth-child(odd) { color:var(--dim); }
  .meta span:nth-child(even) { text-align:right; }

  .tr { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); }
  .tr:last-child { border-bottom:none; }
  .side { font-size:10px; font-weight:700; padding:3px 6px; border-radius:3px; min-width:46px; text-align:center; }
  .side.buy { background:rgba(14,203,129,.15); color:var(--up); }
  .side.sell { background:rgba(246,70,93,.15); color:var(--down); }
  .tr .mid { flex:1; min-width:0; }
  .tr .mid b { font-size:13px; }
  .tr .mid div { font-size:11px; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tr .amt { text-align:right; font-size:13px; white-space:nowrap; }
  .tr .amt div { font-size:11px; color:var(--dim); }

  .empty { text-align:center; color:var(--dim); padding:32px 16px; font-size:13px; line-height:1.6; }
  footer { text-align:center; color:var(--dim); font-size:11px; padding:14px 16px 22px; }
  .warn { background:rgba(252,213,53,.1); border:1px solid rgba(252,213,53,.25);
          color:var(--accent); border-radius:8px; padding:10px 12px; font-size:12px; line-height:1.5; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="dot" id="dot"></span><b>memebot</b>
    <span class="tag" id="mode">—</span>
    <span class="tag" id="tagPf" hidden>PUMP.FUN</span>
    <span class="tag" id="tagMl" hidden>MODELO</span>
  </div>
  <div class="equity">
    <div class="label">Resultado total (realizado + abierto)</div>
    <div class="big num" id="total">—</div>
    <div class="sub num dim" id="breakdown">—</div>
  </div>
</header>

<nav>
  <button id="tabPos" aria-selected="true">Posiciones</button>
  <button id="tabTr" aria-selected="false">Operaciones</button>
  <button id="tabSt" aria-selected="false">Datos</button>
</nav>

<main id="main"></main>
<footer id="foot">conectando…</footer>

<script>
const $ = (id) => document.getElementById(id);
let tab = "pos", data = null;

const usd = (v, d = 2) =>
  (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es", {minimumFractionDigits: d, maximumFractionDigits: d});
const sgn = (v, d = 2) =>
  (v >= 0 ? "+" : "-") + "$" + Math.abs(v).toLocaleString("es", {minimumFractionDigits: d, maximumFractionDigits: d});
const dec = (v, d = 2) => v.toLocaleString("es", {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (v, d = 2) => (v >= 0 ? "+" : "") + dec(v, d) + "%";
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const cls = (v) => v > 0 ? "up" : v < 0 ? "down" : "dim";
const price = (v) => "$" + (v < 0.01 ? v.toFixed(8) : v.toFixed(4));
const clock = (ms) => new Date(ms).toLocaleTimeString("es", {hour:"2-digit", minute:"2-digit", second:"2-digit"});

const REASONS = [
  [/^entry score (.+)$/,                          (m) => `score de entrada ${m[1]}`],
  [/^take profit (\d+) at (.+)$/,                 (m) => `beneficio ${m[1]} a ${m[2]}`],
  [/^stop loss hit \((.+)\)$/,                    (m) => `stop loss (${m[1]})`],
  [/^trailing stop: (.+) off peak \((.+)\)$/,     (m) => `trailing stop: ${m[1]} desde el pico (${m[2]})`],
  [/^liquidity (.+) since entry \(rug risk\)$/,   (m) => `liquidez ${m[1]} desde la entrada (riesgo de rug)`],
  [/^1h volume (.+) since entry \(momentum gone\)$/, (m) => `volumen 1h ${m[1]} (sin momentum)`],
  [/^max hold (.+) reached \((.+)\)$/,            (m) => `tiempo máximo ${m[1]} (${m[2]})`],
  [/^manual liquidation$/,                        () => "liquidación manual"],
];
function reason(text) {
  if (!text) return "";
  for (const [re, fn] of REASONS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;   // unknown reason: show it raw rather than swallow it
}

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return Math.floor(s) + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  return Math.floor(s / 3600) + "h";
}

function renderPositions(d) {
  if (!d.positions.length) {
    return `<div class="empty">Sin posiciones abiertas.<br>
      El bot mira ${d.stats.observations.toLocaleString("es")} tokens y no ha encontrado
      ninguno que pase sus filtros.</div>`;
  }
  return d.positions.map(p => `
    <div class="card">
      <div class="pos-head">
        <div>
          <div class="sym">${p.symbol}</div>
          <div class="dim" style="font-size:11px">hace ${ago(p.opened_at_ms)} · score ${p.score.toFixed(0)}</div>
        </div>
        <div style="text-align:right">
          <div class="pct num ${cls(p.pnl_pct)}">${pct(p.pnl_pct)}</div>
          <div class="num ${cls(p.pnl_usd)}" style="font-size:12px">${sgn(p.pnl_usd)}</div>
        </div>
      </div>
      <div class="meta num">
        <span>Entrada</span><span>${price(p.entry_price)}</span>
        <span>Actual</span><span>${price(p.last_price)}</span>
        <span>Coste abierto</span><span>${usd(p.cost_usd)}</span>
        <span>Valor</span><span>${usd(p.value_usd)}</span>
        ${p.realized_usd ? `<span>Ya realizado</span><span class="${cls(p.realized_usd)}">${sgn(p.realized_usd)}</span>` : ""}
      </div>
      ${p.remaining_pct < 99.9 ? `
        <div class="bar"><i style="width:${p.remaining_pct.toFixed(0)}%"></i></div>
        <div class="dim num" style="font-size:11px;margin-top:5px">
          queda ${p.remaining_pct.toFixed(0)}% · ${plural(p.ladder_steps_done, "escalón vendido", "escalones vendidos")}
        </div>` : ""}
    </div>`).join("");
}

function renderTrades(d) {
  if (!d.trades.length) return `<div class="empty">Todavía no ha operado.</div>`;
  return `<div class="card">` + d.trades.map(t => `
    <div class="tr">
      <span class="side ${t.side}">${t.side === "buy" ? "COMPRA" : "VENTA"}</span>
      <div class="mid">
        <b>${t.symbol}</b>
        <div>${clock(t.ts_ms)} · ${reason(t.reason)}</div>
      </div>
      <div class="amt num">
        ${usd(t.value_usd)}
        ${t.side === "sell" ? `<div class="${cls(t.pnl_usd)}">${sgn(t.pnl_usd)}</div>`
                            : `<div>${price(t.price_usd)}</div>`}
      </div>
    </div>`).join("") + `</div>`;
}

function renderStats(d) {
  const s = d.stats, e = d.equity;
  const wr = s.win_rate === null ? "—" : (s.win_rate * 100).toFixed(0) + "%";
  return `
    <div class="tiles">
      <div class="tile"><div class="k">Realizado</div><div class="v num ${cls(e.realised)}">${sgn(e.realised)}</div></div>
      <div class="tile"><div class="k">Abierto</div><div class="v num ${cls(e.unrealised)}">${sgn(e.unrealised)}</div></div>
      <div class="tile"><div class="k">Comisiones</div><div class="v num">${usd(e.fees)}</div></div>
      <div class="tile"><div class="k">Valor en mercado</div><div class="v num">${usd(e.open_value)}</div></div>
      <div class="tile"><div class="k">Posiciones</div><div class="v num">${s.open}/${s.max_open}</div></div>
      <div class="tile"><div class="k">Cerradas</div><div class="v num">${s.closed}</div></div>
      <div class="tile"><div class="k">Acierto</div><div class="v num">${wr}</div></div>
      <div class="tile"><div class="k">Ganadoras</div><div class="v num">${s.wins}</div></div>
    </div>
    <div class="card">
      <div class="row"><span class="dim">Observaciones grabadas</span><b class="num">${s.observations.toLocaleString("es")}</b></div>
      <div class="row"><span class="dim">Tokens distintos</span><b class="num">${s.mints.toLocaleString("es")}</b></div>
      <div class="row"><span class="dim">Histórico</span><b class="num">${dec(s.span_hours, 1)} h</b></div>
    </div>
    ${s.closed < 30 ? `<div class="warn">
      Con ${plural(s.closed, "operación cerrada", "operaciones cerradas")}, estos porcentajes
      no significan nada todavía. El acierto no se estabiliza por debajo de unas 30.
    </div>` : ""}`;
}

function render() {
  if (!data) return;
  if (data.error) {
    $("main").innerHTML = `<div class="empty">${data.error}</div>`;
    return;
  }
  const d = data, e = d.equity;

  $("dot").className = "dot" + (d.alive ? " on" : "");
  const mode = $("mode");
  mode.textContent = d.mode.toUpperCase();
  mode.className = "tag " + d.mode;
  $("tagPf").hidden = !d.pumpfun;
  $("tagMl").hidden = !d.probability;

  const t = $("total");
  t.textContent = sgn(e.total_pnl);
  t.className = "big num " + cls(e.total_pnl);
  $("breakdown").textContent =
    `realizado ${sgn(e.realised)} · abierto ${sgn(e.unrealised)}`;

  $("main").innerHTML =
    tab === "pos" ? renderPositions(d) : tab === "tr" ? renderTrades(d) : renderStats(d);

  $("foot").textContent = d.alive
    ? `activo · última señal hace ${ago(d.last_seen_ms)}`
    : d.last_seen_ms
      ? `detenido · sin señal desde hace ${ago(d.last_seen_ms)}`
      : "el bot no ha arrancado nunca";
}

function pick(name) {
  tab = name;
  for (const [id, key] of [["tabPos","pos"], ["tabTr","tr"], ["tabSt","st"]]) {
    $(id).setAttribute("aria-selected", String(key === name));
  }
  render();
}
$("tabPos").onclick = () => pick("pos");
$("tabTr").onclick = () => pick("tr");
$("tabSt").onclick = () => pick("st");

async function poll() {
  try {
    const r = await fetch("/api/state" + location.search);
    if (r.status === 401) { $("foot").textContent = "token inválido"; return; }
    data = await r.json();
    render();
  } catch (err) {
    $("foot").textContent = "sin conexión con el bot";
  }
}
poll();
setInterval(poll, 5000);
</script>
</body>
</html>
"""
