# memebot

Bot de trading automático de **memecoins en Solana**. Descubre pares nuevos en
DexScreener, los filtra con un screener anti-rug (incluidas comprobaciones
on-chain), los puntúa por momentum y gestiona las salidas con stop loss,
escalera de take-profit y trailing stop.

Arranca en **modo paper** (simulado) por defecto. El modo live existe, pero hay
que activarlo a conciencia.

---

## ⚠️ Antes de nada

Esto opera memecoins. La mayoría van a cero. Puntos que no son negociables:

- **Usa una wallet quemada** con solo lo que estés dispuesto a perder por
  completo. El bot firma transacciones con esa clave.
- **Corre en paper varios días** antes de plantearte dinero real. El modo paper
  usa precios reales y aplica comisiones y slippage pesimistas, así que sus
  resultados son comparables (no idénticos) a los reales.
- Ningún filtro detecta todos los rugs. Los controles on-chain (autoridad de
  mint/freeze, concentración de holders) paran los casos más comunes, no todos.
- Revisa las obligaciones fiscales y legales de tu jurisdicción. Es tu
  responsabilidad, no la del bot.

---

## Instalación

```bash
git clone <este-repo> && cd rfigh
python3 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt          # modo paper
pip install -r requirements-live.txt     # además, para operar en real

cp config.example.yaml config.yaml
cp .env.example .env                     # solo si vas a operar en real
```

Requiere Python 3.10 o superior.

## Uso

```bash
# Escanear y rankear el mercado sin operar. Empieza siempre por aquí.
python -m memebot -c config.yaml scan
python -m memebot -c config.yaml scan --show-rejected   # y por qué se descartan

# Arrancar el bot (modo paper según config.yaml)
python -m memebot -c config.yaml run

# Ver estado
python -m memebot -c config.yaml positions
python -m memebot -c config.yaml report

# Vender todo ya
python -m memebot -c config.yaml panic
```

`Ctrl-C` termina el ciclo en curso y para de forma limpia. Las posiciones
abiertas se guardan en SQLite y se recuperan al reiniciar.

## Cómo decide

```
      DexScreener (búsqueda + feeds de boosts/perfiles)
                        │
                        ▼
   1. screen_market  ── filtros baratos, sin red extra
      liquidez, volumen, nº de txns, edad, market cap,
      ratio volumen/liquidez (wash trading), float fino
                        │
                        ▼
   2. score_token    ── puntuación 0-100 con vetos duros
      momentum (30) · presión compradora (25) · volumen (25)
      liquidez (10) · edad (10)
                        │
                        ▼
   3. RiskManager    ── ¿podemos permitirnos esta operación?
      tamaño, posiciones abiertas, límite de pérdida diaria,
      cooldown de recompra
                        │
                        ▼
   4. screen_onchain ── caro, solo para lo que sí compraríamos
      autoridad de mint revocada, autoridad de freeze revocada,
      concentración de holders, informe de RugCheck
                        │
                        ▼
                     COMPRA
```

Las salidas se evalúan en cada ciclo, por orden de prioridad:

| # | Regla | Acción |
|---|-------|--------|
| 1 | Liquidez cae ≥45% desde la entrada | Vender todo, **urgente** (rug en curso) |
| 2 | Stop loss (−25%) | Vender todo |
| 3 | Trailing stop (−18% desde el pico, activo tras +30%) | Vender todo |
| 4 | Escalera de take-profit (+40%→40%, +100%→30%, +250%→20%) | Vender un tramo |
| 5 | Volumen 1h se desploma ≥85% desde la entrada | Vender todo |
| 6 | Tiempo máximo en posición (4h) | Vender todo |

Una salida *urgente* se salta el límite de impacto de precio: cuando están
retirando la liquidez, salir importa más que el precio de salida.

## Controles de riesgo

Configurables en `risk:`:

- `position_size_usd` y `position_size_pct_equity` — tamaño por operación, se
  aplica el menor de los dos.
- `max_open_positions` — diversificación forzada.
- `max_daily_loss_usd` — al alcanzarlo el bot deja de abrir posiciones hasta el
  día siguiente (UTC). Las posiciones abiertas se siguen gestionando.
- `max_daily_trades` — corta los bucles de sobreoperación.
- `rebuy_cooldown_minutes` — evita recomprar de inmediato lo que acabas de
  vender por stop.
- `min_cash_reserve_usd` — saldo que nunca se gasta.

Además, `execution.max_price_impact_pct` rechaza cualquier operación que movería
el precio más de lo tolerado: es lo que impide entrar en pools demasiado finos.

## Modo live

1. Rellena `.env` con `WALLET_PRIVATE_KEY` (base58 de Phantom, o array JSON) y
   un `SOLANA_RPC_URL` de pago — un RPC público te va a limitar por rate.
2. Cambia `execution.mode` a `live` en tu config.
3. Arranca con la confirmación explícita:

```bash
python -m memebot -c config.yaml run --yes-really-trade-live
```

La clave privada **no sale nunca del proceso**: Jupiter recibe solo tu clave
pública y devuelve una transacción sin firmar, que se firma en local antes de
enviarla al RPC.

Empieza con `position_size_usd` muy bajo (5-10 USD) y `max_open_positions: 2`.

## Configuración

Todas las opciones están en `config.example.yaml` con su valor por defecto y un
comentario. Las opciones desconocidas se rechazan al arrancar, así que una
errata en el YAML falla de inmediato en vez de ignorarse en silencio.

Los secretos **solo** se leen del entorno; el bot rechaza un config que
contenga una sección `secrets`.

Ajustes según tu tolerancia:

| Quiero… | Cambia |
|---------|--------|
| Menos operaciones, más selectivas | `strategy.min_entry_score` a 70-75 |
| Solo tokens más establecidos | `screener.min_age_minutes` a 120, `min_liquidity_usd` a 50000 |
| Tomar beneficios antes | Primer tramo de `exits.take_profit_ladder` a `[25.0, 0.5]` |
| Aguantar más las caídas | `exits.stop_loss_pct` a -35 |
| Alertas en el móvil | `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en `.env` |

## Estructura

```
memebot/
├── config.py            carga y validación del YAML + secretos del entorno
├── models.py            TokenSnapshot, Position, Trade, OrderResult…
├── http.py              cliente async con reintentos y rate limiting
├── screener.py          filtros de seguridad (mercado + on-chain)
├── strategy.py          puntuación de entrada y reglas de salida
├── risk.py              tamaño de posición y límites globales
├── portfolio.py         contabilidad de posiciones y PnL
├── storage.py           persistencia SQLite
├── engine.py            el bucle de trading
├── cli.py               interfaz de línea de comandos
├── datasources/         DexScreener · Jupiter · RugCheck · RPC de Solana
└── execution/           executor paper y executor live (Jupiter)
```

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

71 tests, todos offline: el `FakeHttp` de `tests/test_engine.py` sirve
respuestas simuladas de DexScreener y del RPC, así que la suite cubre el ciclo
completo (descubrir → filtrar → comprar → gestionar → salir) sin tocar la red ni
mover un céntimo.

## Fuentes de datos

| Servicio | Para qué | Clave |
|----------|----------|-------|
| DexScreener | Descubrimiento y precios | No |
| Solana RPC | Autoridades del mint, holders, saldos, envío de tx | Recomendada para live |
| RugCheck | Informe de riesgo adicional | No |
| Jupiter | Cotización y swaps (solo live) | Opcional (tier de pago) |

Si RugCheck o los feeds de promoción fallan, el bot sigue con el resto de
filtros; si falla el precio de una posición abierta, **no** la vende a ciegas.
