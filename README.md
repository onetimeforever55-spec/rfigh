# Consola de Valdoria

Un juego de consola para el celular: eres el Líder Supremo de la República de Valdoria y gobiernas **escribiendo decretos con tus propias palabras**.

```
> vender el aire

DECRETO Nº 1 · TURNO 1                                  [DECRETADO]
La privatización del aire. Se instalan medidores de respiración en
cada hogar. Tarifa básica: 3 valdos por hora.
Ahora:       Dinero +42M   Felicidad −12
Cada turno:  Dinero +15M   Estabilidad −0.9   Felicidad −2.1

> imprimir dinero
...
LEYES VIGENTES · ESTE TURNO
La impresión de dinero          +25M  infl +6.0
La privatización del aire       +14M  estab −0.9  felic −2.1
Impuestos y gastos del Estado    −3M
Resultado del turno:  Dinero +36M   Inflación +6%
```

No usa ninguna IA externa: funciona sin internet, gratis y al instante.

## Cómo jugar

- Abre `index.html` en el navegador (o `dist/valdoria.html`, que es el juego entero en un solo archivo).
- Escribe un decreto y pulsa **DECRETAR**. Los botones de abajo te ayudan a empezar frases.
- Solo importan cuatro cosas: **Dinero** (millones de valdos; puede haber deuda), **Inflación**, **Estabilidad** y **Felicidad**. Si la estabilidad o la felicidad llegan a 0, caes.
- **Cada decreto es una ley vigente que actúa todos los turnos**, y las leyes se acumulan:
  - `imprimir dinero`: +25M cada turno, pero la inflación sube cada turno. Imprimir más veces dispara la hiperinflación.
  - `regalar comida`: más felicidad, pero cuesta dinero cada turno (y más con inflación). La gente se acostumbra y el efecto se va diluyendo.
  - `vender el aire`, `vender cocaína`: dinero cada turno; el aire amarga a la gente y la cocaína desestabiliza.
  - `crear una escuadra de represión`, `mano dura contra…`: más estabilidad y menos felicidad cada turno. Con el tiempo rinde menos y el rencor crece.
  - `invertir en hospitales`: cuesta mucho ahora y da fruto unos turnos después.
  - `quiero hacer un narcoestado`, `toda la economía al carbón`: reconvierten toda la economía.
- Para quitar una ley: `dejar de imprimir dinero`, `derogar la ley del aire`, `derogar el último decreto`. Quitar algo bueno duele y quitar algo malo alivia.
- `esperar` pasa el turno sin firmar nada: tus leyes siguen trabajando.
- Todo se conecta: la inflación encarece los gastos, se come los ingresos y amarga a la gente. La gente harta resta estabilidad. Sin estabilidad se recauda menos. La deuda se paga imprimiendo, lo que trae más inflación.
- **Sistema político:** empiezas en una democracia frágil, y el régimen también se cambia con decretos:
  - `disuelvo el congreso` (autogolpe → dictadura), `comprar a los diputados`, `controlar los jueces`, `amañar las elecciones`, `reelección indefinida` (→ democracia iliberal), `suspender las elecciones`, `proclamarme rey`, `instaurar una teocracia`, `ley marcial`, `restaurar la democracia`.
  - Cada régimen cambia la recaudación, la inversión, la felicidad y la estabilidad de base, lo que rinde la represión y las sanciones o ayudas internacionales.
  - En democracia, el Congreso puede **bloquear leyes polémicas** si no tienes apoyo: negocias (pagando), gobiernas por decreto o la retiras.
  - Lo que haces **en secreto** (`matar en secreto a Valiente`, `asesino contrincantes secretamente`) no pasa por el Congreso y parece un accidente, pero cada turno puede salir a la luz: escándalo y, en democracia, juicio político.
  - Al final: en democracia hay elecciones limpias, en democracia iliberal se pueden amañar, y en dictadura, monarquía, teocracia o junta solo cuenta seguir en el poder.
  - Escribe `sistema` o toca la etiqueta del régimen para ver el Congreso, los jueces, la prensa, las elecciones y la Constitución.
- También puedes decretar sobre personas (`destituir a Cifuentes`, `encarcelar a Nico`, `matar a Valiente`) y firmar hasta 3 decretos a la vez.
- **Eventos:** cada pocos turnos, o cuando tus leyes lo provocan, salta un evento con opciones (estilo Victoria 2).
- Comandos: `esperar`, `estado`, `sistema`, `leyes`, `poder`, `historial`, `ayuda`, `reiniciar`.
- Sobrevive 30 turnos hasta las elecciones. La partida se guarda sola en el celular.

### Publicarlo gratis con GitHub Pages

En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. El juego quedará en `https://<usuario>.github.io/rfigh/`.

### Temas duros

Algunos decretos tienen reglas propias porque el clasificador general no los trata bien: la esclavitud, el trabajo infantil, la guerra, la bomba atómica, los campos de reeducación, la quema de libros, la tortura, el aborto, el matrimonio igualitario, la prostitución, la inmigración, el salario mínimo, las pensiones, la renta básica, los aranceles, la selva, la jornada laboral, el voto de las mujeres, la edad para votar, el bitcoin, el muro y las cárceles.

Cada tema se entiende en las dos direcciones: «legalizar la esclavitud» / «abolir la esclavitud», «declarar la guerra» / «firmar la paz», «talar la selva» / «dejar de talar la selva». Cada dirección tiene sus efectos, lo polémico que es para el Congreso y consecuencias con retraso: sanciones, fugas, bloqueo naval, inundaciones o la huelga de las mujeres. Ir en contra sustituye a la ley anterior, y abolir algo que nunca existió solo lo recuerda. Los temas están en `js/datos/temas.js`; para añadir uno basta con escribir su entrada.

## Cómo funciona por dentro

El juego tiene su propio "bot", con tres piezas:

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Intérprete** | `js/interprete.js` | Entiende el decreto: jerga, faltas, negaciones ("dejar de…" = derogar), intensidad, personas y varios decretos en una frase. Si duda, pregunta. |
| **Leyes** | `js/leyes.js` | La lógica de cada decreto: qué hace al firmarse, qué hace cada turno y cómo cambia con el tiempo (la gente se acostumbra, la represión se desgasta, las inversiones maduran). |
| **Consejero** | `js/consejero.js` | Los cuatro indicadores y cómo se afectan entre sí cada turno (impuestos, gastos, inflación, deuda, protestas), alertas y finales. |
| **Política** | `js/politica.js` | El régimen (democracia, iliberal, dictadura, junta, monarquía, teocracia), las instituciones del Estado, el apoyo en el Congreso, los secretos y los escándalos. |
| **Poder** | `js/poder.js` | Decretos sobre personas: ministros con sucesores, gente de a pie, el líder de la oposición y el embajador. |
| **Director** | `js/director.js` | Decide cuándo salta un evento y aplica la opción elegida. |
| **Narrador** | `js/narrador.js` | Cuenta la historia: Gaceta Oficial, el parte de leyes de cada turno, titulares, gabinete, calle y ambiente. |
| **Narrador con IA** (opcional) | `js/narradorIA.js` | Convierte los datos del turno en una crónica escrita por Claude. |

Los datos (lo que más se puede ampliar) están separados del código:

- `js/datos/acciones.js`: las acciones (prohibir, vender, regalar, derogar...) con sus frases de ejemplo.
- `js/datos/objetos.js`: los temas (aire, agua, comida, cocaína, escuadrón...) con sus propiedades.
- `js/datos/mercado.js`: los modelos económicos para reconvertir la economía (narco, carbón, turismo...).
- `js/datos/sinonimos.js`: jerga y sinónimos.
- `js/datos/regimenes.js`: los regímenes y sus efectos, y los textos de cada cambio de régimen.
- `js/datos/personajes.js`, `js/datos/poder.js`: gabinete, gente de a pie, instituciones y personas.
- `js/datos/eventos.js`, `js/datos/dilemas.js`, `js/datos/voces.js`: alertas, eventos con decisiones, noticias, titulares y voces.

**Para que el bot entienda más:** añade frases a `frases` (acciones) o a `formas` (objetos). Se reentrena solo al cargar la página.

## Consejo de Estado con IA (opcional)

Sin IA, el juego entiende los decretos con su Intérprete local y aplica reglas programadas: funciona, pero solo con lo que tiene previsto. Con la IA activa (y la casilla «La IA decide las consecuencias»), cada decreto pasa por un **Consejo de Estado**:

1. El juego envía a la IA el decreto tal cual, el estado del país, el régimen y las instituciones, las leyes vigentes (con su id), quién está vivo, preso o exiliado, y la **memoria del mundo**.
2. La IA devuelve una **ficha JSON**: qué significa el decreto, qué leyes crea (efecto inicial, efecto por turno, curvas, lo polémicas que son), qué leyes deroga, qué pasa con cada persona, cambios en las instituciones o el régimen, si es secreto, consecuencias que llegan más tarde, a veces un evento con decisiones propio y los hechos que hay que recordar.
3. **El motor hace de árbitro** (`js/consejoIA.js`):
   - pone topes a los números;
   - no deja tocar a personas que no existen ni matar a quien ya está muerto;
   - decide si el Congreso bloquea la ley, si un crimen abre un juicio político o si un secreto sale a la luz;
   - aplica sucesores, mártires y autogolpes.
4. Cada turno **el motor sigue haciendo las cuentas**: impuestos, inflación, deuda y desgaste de las leyes.
5. Lo que pasa (hechos, decisiones en los eventos, consecuencias y escándalos) entra en la **memoria del mundo** (las últimas 30 cosas), que viaja en los turnos siguientes.

Con el Consejo activo, los eventos de catálogo solo saltan si la situación los pide (los urgentes), y no hay noticias al azar: los eventos los propone la IA a partir de lo que va pasando. Si llevan 4 turnos sin evento, se le pide que proponga uno.

**Al esperar** (sin decreto), el Consejo decide qué pasa en el país por sí solo, como consecuencia de las leyes vigentes y de la memoria: una huelga, una conspiración o algo que se sembró antes. Aparece como suceso «EN EL PAÍS». En esos turnos la IA no puede crear leyes, cambiar instituciones ni tocar personas: solo el ánimo de la gente, consecuencias, eventos y hechos.

Mientras el Consejo delibera, el juego enseña lo que ha entendido en cuanto llega («Entendido: …»).

**Coherencia absurda.** Cualquier estupidez se cumple al pie de la letra, con total seriedad burocrática. El Consejo razona en cadena: cómo lo aplica el Estado, quién gana dinero, quién hace la trampa y qué efecto secundario nadie previó. Esos pasos se ven en el «Informe del Consejo». La regla absurda queda en la memoria como realidad del juego: si prohíbes los lunes, en Valdoria después del domingo viene el martes durante el resto de la partida.

Sin IA, el bot local también cumple lo absurdo con su propia lógica: la Brigada Especial contra la gravedad, la Inspección Nacional de los sombreros o la empresa fantasma que compra la luna. Cada caso trae una consecuencia unos turnos después: mercado negro, resquicio legal, certificados falsos, el dueño que cobra o la evasión. Esta lógica está en `RF.ABSURDO.logica`, en `js/datos/voces.js`. Si la IA falla o responde algo ilegible, ese decreto lo resuelve el Intérprete local.

## Crónica con IA (opcional)

El juego funciona entero sin IA. Si quieres, toca el botón **IA** de la cabecera (o escribe `ia`).

**Dentro de claude.ai** (abriendo el juego como artefacto) no hace falta clave: elige «Tu cuenta de Claude» y Claude escribe la crónica con tu plan de claude.ai. La primera vez te pide permiso. Hay tres niveles: normal, rápido y el mejor. Esta opción solo aparece dentro de claude.ai.

**Fuera de claude.ai**, pega una clave de API. El juego reconoce el proveedor por la forma de la clave:

| Clave | Proveedor | Coste |
|---|---|---|
| `sk-or-…` | OpenRouter | Gratis: el juego lista solo los modelos gratis y elige uno solo |
| `AIza…` | Google Gemini | Plan gratis (modelo por defecto `gemini-2.5-flash`) |
| `gsk_…` | Groq | Plan gratis (modelo por defecto `llama-3.3-70b-versatile`) |
| `sk-ant-…` | Claude (Anthropic) | De pago; la mejor prosa (Opus 5, Sonnet 5 o Haiku 4.5) |

- **La IA no decide nada.** El juego calcula todo igual que siempre. Después, cada turno se envía un resumen de lo que ya pasó: indicadores, régimen, gabinete, gente, leyes vigentes, hechos del turno y los textos que escribió el narrador local como borrador. La IA solo lo convierte en una crónica. No guarda memoria entre turnos: los datos del juego son la memoria.
- **Claude** se usa con el SDK oficial, `effort: low`, caché del contexto del mundo y, en Opus 5, el *fallback* del servidor ante rechazos. **Los demás** se usan con su API compatible con OpenAI, en streaming.
- **Si falla** (sin conexión, clave mala, límite gratis agotado, rechazo), el turno se cuenta con la narración local de siempre. Si el modelo gratis elegido desaparece, el siguiente turno se elige otro.
- **La clave se guarda solo en el navegador** (`localStorage`). Las llamadas van directas del navegador al proveedor, así que no compartas tu partida con la clave puesta.
- **Dónde funciona cada cosa:** la cuenta de Claude, solo dentro de claude.ai. Las claves de API, en GitHub Pages o abriendo `dist/valdoria.html`; dentro de claude.ai no, porque el visor bloquea las conexiones externas.

## Desarrollo

```bash
npm test            # prueba el Intérprete, simula 400 partidas, comprueba la lógica de las leyes, el equilibrio y el narrador con IA (simulado)
npm run empaquetar  # genera dist/valdoria.html (todo en un archivo)
```

Para las pruebas solo hace falta Node.js. `npm install` instala el SDK de Anthropic, que usa la prueba del narrador con IA con respuestas simuladas; sin el SDK, esa prueba se omite.
