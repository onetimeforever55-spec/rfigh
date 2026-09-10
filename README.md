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

# Ver con qué wallet operaría el bot (no firma nada)
python -m memebot -c config.yaml wallet
```

`Ctrl-C` termina el ciclo en curso y para de forma limpia. Las posiciones
abiertas se guardan en SQLite y se recuperan al reiniciar.

## pump.fun

Hay un perfil listo para usar:

```bash
cp config.pumpfun.yaml config.yaml
python -m memebot -c config.yaml scan --show-rejected
```

pump.fun no es un AMM normal y el bot lo trata como lo que es. Un token vive
dos fases:

| Fase | Qué es | `dexId` en DexScreener |
|------|--------|------------------------|
| **curva** | Cotiza contra una curva de bonding del programa. No hay LP que retirar. | `pumpfun` |
| **graduado** | La curva se llenó (~69k de market cap), la liquidez pasó a un AMM y el LP está quemado. | `pumpswap`, `raydium` |

El perfil por defecto opera **solo graduados**, y es una decisión deliberada:
graduarse es la única señal dura de que hubo demanda real. La gran mayoría de
lanzamientos no llega. Para operar en la curva, hay un bloque comentado al
final de `config.pumpfun.yaml`.

Qué cambia respecto al perfil genérico:

- **Detección de fase** por `dexId` — sin peticiones extra. Los mints de
  pump.fun terminan en `pump`, que es como se distingue un graduado de
  cualquier otro token en el mismo AMM.
- **El rug aquí es otro.** En la curva no hay LP que retirar: lo que pasa es
  que el dev vende su asignación encima de tu compra. Por eso se añade
  `max_dev_holding_pct`, que mira on-chain cuánto suministro conserva el
  creador.
- **Autoridades de mint/freeze ya vienen revocadas** por el propio programa de
  pump.fun, así que ahí esos filtros no descartan nada. Se dejan activos porque
  son gratis, pero no te fíes de que "pasa los filtros de rug".
- **Ventana de progreso de curva** (solo fase curva): ignora lo que nadie está
  comprando y también lo que ya está a punto de graduar, donde los bots
  sniper llegaron antes que tú.
- **Escalas recalibradas.** Un +60% en una hora es ruido normal en pump.fun,
  no una señal. Momentum, ventana de edad y salidas están reescalados: stop más
  ancho (−35%, porque −25% te saca de todo por ruido), compensado con
  posiciones más pequeñas, escalera de beneficios más temprana (+30/+80/+200%) y
  tiempo máximo en posición de 2h en vez de 4.

Si pones `phase: curve` junto a un `min_age_minutes` alto, el bot **se niega a
arrancar**: esa combinación no compraría nunca nada y desde fuera parecería que
está funcionando.

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
   1b. screen_pumpfun ── solo si pumpfun.enabled
      fase (curva / graduado), sufijo `pump` del mint,
      progreso de la curva, tiempo desde el lanzamiento
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
      concentración de holders, informe de RugCheck,
      suministro que aún conserva el creador
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

## Dar acceso a tu wallet

El bot necesita la clave privada de una wallet para poder firmar los swaps. No
hay forma de operar sin eso — pero sí hay una forma segura de hacerlo.

### 1. Crea una wallet nueva, solo para el bot

**No uses tu wallet principal.** Un bug, una fuga del `.env` o un rug con
`setAuthority` raro afectan a todo lo que haya en esa dirección. Crea una
quemada:

*Con Phantom:* menú → Añadir cuenta → Crear cuenta nueva. Luego
Configuración → Seguridad y privacidad → Exportar clave privada. Te da una
cadena en base58.

*Con la CLI de Solana:*

```bash
solana-keygen new --outfile ~/.config/solana/bot-wallet.json
```

Te da un array JSON de bytes. El bot acepta los dos formatos.

### 2. Ponla en `.env`

```bash
cp .env.example .env
chmod 600 .env          # solo tu usuario puede leerlo
```

```ini
WALLET_PRIVATE_KEY=4xY7...          # base58 de Phantom, o [12,45,...] de la CLI
SOLANA_RPC_URL=https://tu-endpoint  # Helius, QuickNode o Triton
```

`.env` está en `.gitignore`, así que no se sube al repo. Aun así: no lo pegues
en un chat, ni en un issue, ni en una captura.

### 3. Comprueba que funciona, sin arriesgar nada

```bash
python -m memebot wallet
```

Te muestra la dirección que ha derivado de tu clave y su saldo. Compara esa
dirección con la que ves en Phantom: si coinciden, el bot tiene acceso
correctamente. Este comando no opera ni firma nada.

### 4. Fondea solo lo que puedas perder

Manda a esa dirección lo que estés dispuesto a perder por completo. Deja al
menos 0.02 SOL libres para comisiones — el bot reserva ese margen y no lo gasta.

### 5. Pasa a live

```yaml
execution:
  mode: live
```

```bash
python -m memebot -c config.yaml run --yes-really-trade-live
```

Hacen falta las dos cosas: el cambio en el config **y** el flag. Es a propósito.

Empieza con `position_size_usd: 5` y `max_open_positions: 2`. Súbelo solo
cuando lleves días de resultados reales.

### Qué hace el bot con tu clave

La clave se lee del entorno al arrancar y **no sale nunca del proceso**:

```
Jupiter  ←── recibe solo tu clave PÚBLICA
         ──→ devuelve una transacción SIN FIRMAR
                        │
                  se firma en local
                        │
                        ▼
              RPC de Solana (transacción ya firmada)
```

Nunca se escribe en logs, ni se manda a Telegram, ni se guarda en la base de
datos. El bot también rechaza cualquier config que traiga una sección
`secrets:`, para que no acabe en un YAML por accidente.

Si algo va mal, `python -m memebot -c config.yaml panic` vende todo a mercado.
Y si quieres cortar de raíz, mueve los fondos fuera de esa dirección: la wallet
del bot no tiene por qué guardar nada entre sesiones.

## Configuración

Todas las opciones están en `config.example.yaml` con su valor por defecto y un
comentario. Las opciones desconocidas se rechazan al arrancar, así que una
errata en el YAML falla de inmediato en vez de ignorarse en silencio.

Los secretos **solo** se leen del entorno; el bot rechaza un config que
contenga una sección `secrets`.

### Qué filtro te está bloqueando

`scan` te dice qué puerta descarta más candidatos y cuáles se quedan a **un
solo filtro** de pasar, que son los que desbloquearías aflojando una cosa:

```
     Rejections by gate
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓
┃ Gate           ┃ Rejected ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━━━━━┩
│ min_liquidity  │        2 │
│ wash_trading   │        2 │
│ min_age        │        1 │
└────────────────┴──────────┘
2 token(s) failed exactly one gate — loosening it would let them through:
  YOUNG: pair is 3m old < 20m
  QUIET: 24h volume $50,000 < $100,000
```

Úsalo antes de tocar nada: si el bot no compra, casi siempre es una puerta
concreta la que bloquea, y aflojar otra no cambia nada. Un token que falla
varias puertas cuenta en cada una — la tabla mide qué filtro bloquea, no
reparte tokens.

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
├── datasources/         DexScreener · pump.fun · Jupiter · RugCheck · RPC
└── execution/           executor paper y executor live (Jupiter)
```

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

101 tests, todos offline: el `FakeHttp` de `tests/test_engine.py` sirve
respuestas simuladas de DexScreener y del RPC, así que la suite cubre el ciclo
completo (descubrir → filtrar → comprar → gestionar → salir) sin tocar la red ni
mover un céntimo.

## Fuentes de datos

| Servicio | Para qué | Clave |
|----------|----------|-------|
| DexScreener | Descubrimiento, precios y fase de pump.fun | No |
| pump.fun | Creador del token y reservas exactas de la curva | No (best-effort) |
| Solana RPC | Autoridades del mint, holders, saldos, envío de tx | Recomendada para live |
| RugCheck | Informe de riesgo adicional | No |
| Jupiter | Cotización y swaps (solo live) | Opcional (tier de pago) |

La API de pump.fun está detrás de Cloudflare y limita por rate, así que se
trata como enriquecido opcional: si no responde, la fase se deduce del venue
de DexScreener y el progreso de la curva se estima por market cap. Igual con
RugCheck y los feeds de promoción. Si lo que falla es el precio de una
posición abierta, el bot **no** la vende a ciegas.
