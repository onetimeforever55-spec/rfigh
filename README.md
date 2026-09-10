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

Requiere Python 3.10 o superior. Si prefieres no instalar nada en el host,
salta a [Docker](#docker).

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

# Probabilidades medidas sobre lo que el bot ya ha visto
python -m memebot -c config.yaml dataset    # tasa base del histórico grabado
python -m memebot -c config.yaml fit        # ajustar el modelo y evaluarlo
python -m memebot -c config.yaml backtest --test-only

# Panel para el móvil (solo lectura, no opera)
python -m memebot -c config.yaml dashboard
```

`Ctrl-C` termina el ciclo en curso y para de forma limpia. Las posiciones
abiertas se guardan en SQLite y se recuperan al reiniciar.

## Docker

Alternativa a la instalación local. El estado (SQLite y logs) vive en `./data` y
`./logs` del host, así que las posiciones abiertas sobreviven a un
`docker compose down`.

```bash
cp config.pumpfun.yaml config.yaml       # o config.example.yaml
mkdir -p data logs                       # deben existir y ser tuyos, no de root
cp .env.example .env && chmod 600 .env   # solo si vas a operar en real

docker compose up -d --build
docker compose logs -f
```

Comandos puntuales, sin molestar al bot que ya está corriendo:

```bash
docker compose run --rm memebot -c config.yaml scan --show-rejected
docker compose run --rm memebot -c config.yaml wallet
docker compose run --rm memebot -c config.yaml positions
docker compose run --rm memebot -c config.yaml report
docker compose run --rm memebot -c config.yaml panic

# Sobre el histórico grabado (no tocan la red)
docker compose run --rm memebot -c config.yaml dataset
docker compose run --rm memebot -c config.yaml fit
docker compose run --rm memebot -c config.yaml backtest --test-only
```

El modelo se guarda en `./data`, que ya está montado, así que `fit` desde el
contenedor deja el `model.json` donde el bot lo va a buscar.

Para parar, `docker compose stop`: manda SIGTERM, el bot termina el ciclo en
curso y cierra la base de datos limpiamente. Hay 120s de margen antes del
SIGKILL, de sobra para una confirmación en vuelo.

Lo que conviene saber:

- **La imagen se construye con `requirements-live.txt`**, así que la misma sirve
  para paper y para live sin reconstruir nada.
- **Corre como usuario 1000, no como root.** Si tu `id -u` no es 1000, ponlo en
  `.env` (`MEMEBOT_UID=...`, `MEMEBOT_GID=...`) o el contenedor no podrá
  escribir en `./data`.
- **`config.yaml` se monta en solo lectura** y no se recarga en caliente: tras
  cambiarlo, `docker compose restart`.
- **Los secretos entran por `.env`**, nunca en la imagen: `.dockerignore`
  excluye `.env`, `config.yaml`, `data/` y `*.key`. Aun así, no publiques la
  imagen en un registro público.
- **Para live** hacen falta las dos cosas de siempre: `execution.mode: live` en
  `config.yaml` **y** descomentar en `docker-compose.yml` la línea de `command`
  que lleva `--yes-really-trade-live`.
- **`restart: unless-stopped` significa que el bot vuelve solo** tras reiniciar
  el host o si el proceso muere. Con dinero real, decide a conciencia si eso es
  lo que quieres: un bot que resucita sin que estés mirando sigue operando.

---

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

## Panel para el móvil

Un servidor local que lee la misma base de datos que el bot y la pinta para una
pantalla de teléfono. Posiciones abiertas con su PnL, historial de operaciones
con el motivo de cada salida, y el estado de la grabación.

```bash
python -m memebot -c config.yaml dashboard
# http://127.0.0.1:8730/
```

Para verlo desde el móvil en tu misma red:

```bash
python -m memebot -c config.yaml dashboard --host 0.0.0.0
```

Al salir de localhost genera un token solo y te imprime la URL con él. No hay
forma de dejar el panel abierto sin querer.

### Lo que NO puede hacer

Es un proceso aparte del bot y comparte solo el fichero SQLite. Esa separación
es el diseño:

- **No puede operar.** Aquí no hay executor ni se lee nunca la clave privada,
  así que exponerlo no te puede costar dinero. Hay un test que comprueba que
  ningún secreto llega a la respuesta.
- **No puede interferir.** Abre la base de datos en modo solo lectura (`mode=ro`),
  así que un fallo del panel no toca las posiciones ni impide que el bot venda.
  En Docker, además, el volumen se monta en `:ro`.

Lo que sí puede hacer cualquiera con el enlace es **leer tu PnL**. Si lo sacas
de localhost, el token no es opcional.

### Desde Docker

Ya viene como servicio y arranca con el resto:

```bash
docker compose up -d
# http://127.0.0.1:8730/
```

Está publicado solo en localhost. Para llegar desde el móvil, pon primero un
token en `.env`:

```ini
MEMEBOT_WEB_TOKEN=...   # python -c "import secrets; print(secrets.token_urlsafe(16))"
```

y cambia el mapeo de puerto en `docker-compose.yml` de `127.0.0.1:8730:8730` a
`8730:8730`.

### Por qué no está comprando

La pestaña más útil, y la razón por la que existe: un bot parado y un bot roto
se ven exactamente igual desde fuera — los dos enseñan una lista de posiciones
vacía. Lo que los distingue es qué filtro está descartando.

El motor guarda, en cada ciclo, cuántos candidatos miró, cuántos pasaron y qué
puerta descartó a cada uno. El panel lo pinta ordenado, con los que se quedaron
a un solo filtro de pasar y el número concreto que les faltó
(`mcap $10.510 < $20.000`).

Si el RPC está rechazando las llamadas, sale un aviso explícito en vez de
dejarte pensando que el mercado está flojo. Esa diferencia —"no hay nada que
comprar" contra "tu RPC no responde"— es la que decide entre esperar y
arreglar algo.

### Detalles

Los precios salen de `last_price_usd`, que el motor refresca en cada ciclo: el
panel no hace ni una llamada extra a ninguna API, así que tenerlo abierto en el
móvil no te gasta rate limit. El punto verde junto al nombre indica si el bot
sigue vivo, deducido de si hay filas nuevas: si el motor se cae, el panel lo
dice en vez de seguir enseñando posiciones viejas como si fueran actuales.

---

## Probabilidades medidas

Los pesos de la puntuación de entrada (momentum 30, presión compradora 25,
volumen 25…) están **puestos a mano**. Nadie midió nunca que el momentum valga
30. Esta parte los sustituye por frecuencias observadas.

No hay ningún sitio de donde descargar "las probabilidades del trading" que
sirvan aquí. Lo que el bot necesita saber es `P(resultado | lo que ve en el
momento de decidir)`, y eso solo se mide grabando **exactamente esas features**
y viendo qué pasó después. Un modelo entrenado con velas de otra fuente aprende
de features que no coinciden con las que ve en vivo, y entonces la probabilidad
que da es mentira aunque el backtest salga precioso.

### El ciclo

```bash
# 1. Grabar. Va activo por defecto, también en paper. Días, no horas.
python -m memebot -c config.yaml run

# 2. ¿Qué hay en el histórico? Empieza SIEMPRE por aquí.
python -m memebot -c config.yaml dataset

# 3. Ajustar el modelo y ver si generaliza.
python -m memebot -c config.yaml fit

# 4. Replay sobre el trozo que el modelo no vio al entrenar.
python -m memebot -c config.yaml backtest --test-only
python -m memebot -c config.yaml backtest --test-only --heuristic   # comparar

# 5. Si supera a la heurística: probability.enabled: true, y otra vez a paper.
```

### Qué pregunta responde

Una sola, la única que paga:

> Comprando **aquí**, ¿el precio llega a `take_profit_pct` **antes** de tocar
> `stop_loss_pct`, dentro de `horizon_minutes`?

Esos tres valores tienen que coincidir con tus reglas de salida. Si no, el bot
**no arranca**: un modelo ajustado para "+40% antes de −25% en 4h" no dice nada
útil sobre un bot que vende a +30% y corta a −35%, y el desajuste es invisible
en marcha — todas las probabilidades siguen pareciendo razonables.

### Por qué probabilidad y no puntuación

Una puntuación 0-100 no se puede multiplicar por nada. Una probabilidad sí:

| Acierto | Gana | Pierde | Valor esperado |
|---------|------|--------|----------------|
| 30% | +100% | −25% | **+12.5%** por operación |
| 60% | +20% | −40% | **−4%** por operación |

Ganar 6 de cada 10 puede arruinarte y ganar 3 de cada 10 puede pagar muy bien.
`min_expected_value_pct` es la puerta que la puntuación no sabía expresar.

### Los sesgos, y qué se hace con cada uno

Un backtest de memecoins es trivial de falsear sin querer. Los cuatro sitios por
donde se cuela la mentira están tratados de forma explícita:

- **Look-ahead.** Las features salen de una única fila, escrita una vez y nunca
  rellenada después. Ninguna información del futuro puede llegar a ella.
- **Train/serve skew.** Decidir en vivo y entrenar pasan por la *misma* función
  `features()`, sobre el mismo dict. Una feature no puede significar una cosa al
  ajustar y otra al decidir. Hay un test que lo comprueba haciendo el viaje de
  ida y vuelta por SQLite.
- **Censura.** Si un token deja de aparecer antes de que cierre la ventana, no
  hay resultado. Esas filas se **descartan**, no se cuentan como pérdidas —
  contarlas sería una suposición disfrazada de dato. Se reportan aparte, porque
  si son muchas el dataset describe algo más estrecho de lo que parece: tokens
  que siguieron siendo visibles.
- **Huecos.** Si el bot estuvo parado, la ventana no está cubierta. Un salto
  mayor que `max_gap_minutes` corta la cobertura en vez de fingir que el precio
  no se movió.

Además, el empate se resuelve **en tu contra**: si dentro del mismo intervalo de
sondeo se tocaron los dos niveles, cuenta como pérdida. No se puede saber cuál
llegó primero, y suponer el bueno infla todos los números de ahí para abajo.

### Cuándo NO fiarte del modelo

El bot se niega a operar con un modelo que no se lo haya ganado, y falla al
arrancar en vez de volver en silencio a la heurística:

| Se rechaza si… | Por qué |
|----------------|---------|
| AUC fuera de muestra < `min_test_auc` | No aprendió nada que generalice. Operar con eso es peor que la heurística, porque *parece* fundamentado |
| Se ajustó para otros objetivos | Responde a otra pregunta |
| Menos de `min_train_rows` filas | Es ruido con formato de modelo |
| No tiene evaluación fuera de muestra | No hay ninguna evidencia de que funcione |
| Cambió el conjunto de features | Los valores caerían sobre los pesos equivocados |

`fit` imprime además la **tabla de calibración**: lo que el modelo dijo contra
lo que pasó de verdad. Si en la fila del 60% pasó el 30% de las veces, esa
probabilidad no es multiplicable por un payoff, por muy bueno que sea el AUC.

Los vetos duros (blow-off top, presión vendedora, sobreextensión) **siguen
activos** en modo probabilidad. Un modelo con unos miles de filas casi no ha
visto techos parabólicos, así que no tiene una opinión informada sobre ellos —
y "los datos no protestaron" no es lo mismo que "esto es seguro".

### Lo que el replay no modela

`backtest` es una **cota superior**, no una previsión de tu PnL. No modela el
precio al que te habrían llenado de verdad, ni los escalones parciales de
take-profit, ni el trailing stop, ni los límites de posiciones, ni el tope de
pérdida diaria, ni que tu propia compra mueve un pool fino. Sí evita el error
más gordo: una posición por mint a la vez, como el bot real. Sin eso, una subida
de tres horas se cuenta como decenas de operaciones ganadoras y todo lo demás
pasa a ser ficción.

El total se da como `+10.8x una posición`, nunca compuesto. Encadenar retornos
supondría que toda la cuenta va en cada operación en secuencia, que produce un
número espectacular que no describe nada.

### Coste

Grabar añade unas 40 filas por ciclo de descubrimiento — del orden de 75k
filas al día, unos pocos MB. `retention_days` las poda. `fit` tarda unos 25s
por cada 40k filas de entrenamiento: es Python puro a propósito, para no meter
numpy ni sklearn por un ajuste que se lanza a mano de vez en cuando.

---

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
                        ├──────────────► se graba TODO lo visto aquí,
                        │                pasara el filtro o no
                        ▼
   2. score_token    ── vetos duros, y después una de dos:
      · por defecto: puntuación 0-100 con pesos puestos a mano
      · con modelo:  P(acierto) medida + valor esperado tras costes
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

Los filtros on-chain **fallan cerrados**: si el RPC no responde, el token se
rechaza en vez de pasar sin comprobar. Esto importa más de lo que parece —
antes, la distribución de holders se saltaba en silencio ante un error de red,
y con un RPC gratuito eso es un 429 de distancia. En una sesión de prueba real
las 5 compras se hicieron con ese filtro sin ejecutar. Un control de seguridad
que desaparece cuando la red tose es peor que no tenerlo, porque crees que lo
tienes.

Con un RPC gratuito esto rechazará mucho. Es el resultado honesto: el filtro
corrió o no corrió. Si aceptas el riesgo a conciencia,
`screener.require_holder_data: false` vuelve al comportamiento anterior, ahora
con un aviso en el log en cada compra.

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
├── observations.py      grabado, features y etiquetado del histórico
├── model.py             regresión logística calibrada + métricas
├── web.py               panel solo lectura para el móvil
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

181 tests, todos offline: el `FakeHttp` de `tests/test_engine.py` sirve
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
