# Génesis por dentro

Esta guía sirve para encontrar rápido dónde se hace cada cosa. Lista de secciones con su línea, siempre al día:

```
node scripts/mapa.js            # todas las secciones de js/mundo/
node scripts/mapa.js vida       # solo las de un archivo
node scripts/mapa.js puerto     # busca en títulos de sección y nombres de función
```

Las secciones del código empiezan con `// ---------- Título ----------` o con un bloque `/*` cuyo primer renglón va en MAYÚSCULAS («LOS BARCOS: …»). Si añades una sección, sigue ese formato y saldrá en el mapa.

## Los módulos partidos (se edita la parte, no el archivo unido)

Los seis módulos grandes están partidos por temas en carpetas: `js/mundo/sim/`, `vida/`, `mando/`, `arte/`, `pintor/` y `vista/`, con partes numeradas (`vida/12-mar.js`, `vida/14-turno.js`…), de 85 a 525 líneas cada una. Cada parte empieza con su título (`// ── GÉNESIS · LA VIDA · Los barcos y la marina de guerra ──`).

Cada módulo sigue siendo **una sola función** que comparte entre todas sus partes las constantes y funciones internas (las partes se llaman entre sí sin importar nada). Por eso no se cargan sueltas: `node scripts/unir.js` (o `npm run unir`) las junta, en el orden de su número, en el archivo de siempre (`js/mundo/vida.js`…), que es el que cargan el juego, las pruebas y el empaquetado. Los archivos unidos empiezan con `// ARCHIVO GENERADO`: no se editan a mano.

- Después de tocar una parte: `node scripts/unir.js`. `scripts/pwa.sh` y `scripts/paquete.sh` ya lo hacen solos.
- `test/partes.test.js` (y `npm test`) falla si algún archivo unido no está al día con sus partes.
- Una parte nueva: un archivo `NN-tema.js` en la carpeta del módulo; va donde diga su número. El orden importa solo para lo que se calcula al cargar (una constante que usa otra de una parte anterior).
- `datos.js`, `dios.js`, `gpu.js` y `sonido.js` son pequeños y siguen enteros.

## Los archivos (en el orden en que se cargan)

Cada archivo es un módulo `(function () { … })()` que se cuelga de `RF.MUNDO`. Los cinco primeros no tocan el navegador, así que las pruebas de Node los cargan tal cual.

| Archivo | Se cuelga en | Qué hace |
|---|---|---|
| `datos.js` | `M.ERAS`, `M.TECNOLOGIAS`, `M.tec`… | Las eras, los inventos, el carácter de los pueblos y sus nombres. Casi solo datos. |
| `sim.js` (`sim/`) | `M.sim` | El mundo grande: mapa de regiones, reinos, gobernantes, técnica y eras, opinión, alianzas, guerras, lealtad de ciudades, caída de capitales y crónica. `turno(m)` y `turnoPorPartes(m)`. |
| `vida.js` (`vida/`, 21 partes) | `M.vida` | La vida en parcelas (4×4 por región): aldeanos, oficios, edificios, mercado, comida, ejércitos, barcos, fuego, explosiones, caminos y trenes, animales, ciudades y colonos. Es el archivo más grande. |
| `dios.js` | `M.dios` | Los poderes del modo dios por texto («peste sobre X»). |
| `mando.js` (`mando/`) | `M.mando` | El modo «Gobernar un pueblo»: del texto de una orden a acciones (`ordenar`), aplicarlas (igual en local que online), el consejero y los retos. |
| `arte.js` (`arte/`) | `M.arte` | Todos los dibujos en píxeles, hechos con código: suelos, árboles, edificios por época, aldeanos, vehículos, barcos e iconos. |
| `pintor.js` (`pintor/`) | `M.pintor` | Pinta el mundo en el canvas en cada fotograma: interpola los caminos de los aldeanos entre turnos, combates, partículas, sucesos en el mapa, día y noche, cámara. |
| `sonido.js` | `M.sonido` | Sonidos sintetizados con Web Audio. |
| `vista.js` (`vista/`) | — | La interfaz: paneles, fichas, mercado, corte, tiempo y velocidad, retos, online (relé por un servidor MQTT), la ventana de órdenes y el arranque. |

`mundo.html` es la página y `css/mundo.css` su estilo. `scripts/empaquetar.js` junta todo en un solo HTML.

## Cómo fluye un turno

1. `vista/03-tiempo-y-retos.js` (sección «El tiempo») pide un turno. Usa `S.turnoPorPartes(m)`, un generador, y lo va calculando en trozos de unos 7 ms (`seguirCalculo`) para que la animación no se corte. `acabarTurno()` lo termina de golpe si hace falta antes de una acción.
2. `sim/02-turno.js › turnoPorPartes` hace lo del mundo grande (técnica, diplomacia, guerras, lealtad) y llama a `M.vida.turnoPorPasos`, que cede el control entre pasos.
3. `vida/14-turno.js › turno` (sección «Un turno de vida») mueve a cada aldeano durante `TICKS` pasos y guarda su camino. Después vienen las obras, el mercado, los barcos, el fuego, los animales, las ciudades y los colonos.
4. `pintor/02-turno-y-fotograma.js › Un turno nuevo` guarda una foto de esos caminos (`rVisto`/`rAntes`). Hasta el siguiente turno, cada fotograma interpola sobre ella.

**Todo es reproducible:** el azar sale de `S.azar(m)`, con el estado guardado en el mundo. Nunca uses `Math.random()` en `sim.js`, `vida.js`, `dios.js` ni `mando.js`, porque el online depende de que cada navegador calcule lo mismo. Solo lo visual (`pintor.js`, `arte.js`) puede usar azar libre.

## Dónde tocar cada cosa

| Quiero cambiar… | Dónde |
|---|---|
| Lo que construye la IA y por qué | `vida/10-edificios-y-necesidades.js` (LOS EDIFICIOS DE CADA PLAZA, LAS NECESIDADES, `puedeColocar`) y `vida/11-defensas.js` (`edificioPendiente`) |
| Qué oficio tiene cada aldeano | `vida/03-gobernador-y-mercado.js` (EL GOBERNADOR AUTOMÁTICO), `vida/07-sucesos-y-cargas.js` (`reparto`), `vida/08-gente.js` (`reasignar`) |
| Qué hace cada aldeano en el turno | `vida/15-tareas.js` (`elegirTarea`) y `vida/16-andar.js` (`andar`, `llegar`, `terminar`) |
| Precios, tratos, carretas, trenes | `vida/03-gobernador-y-mercado.js` (EL MERCADO GLOBAL, LA CARTERA), `vida/06-banca.js` (`mercado`), `vida/07-sucesos-y-cargas.js` (carretas), `vida/17-caminos.js` |
| Barcos: pesca, mercantes, guerra, transportes | `vida/12-mar.js` (`maresDe`, `sitioPuerto`, `planNaval`, `porMar`, `NAVAL`) |
| Ejércitos, asedios, torres, trincheras, murallas | `vida/09-ejercito.js` (LOS EJÉRCITOS, EL FRENTE), `vida/13-asedios-y-fuego.js` (EL ASEDIO, LAS TORRES), `vida/11-defensas.js` (TRINCHERAS, MURALLAS, CORRALES, DEFENSAS DE FRONTERA) |
| Comercio, gremios, banco, empresarios y créditos entre reinos | `vida/04-industria.js` (industrias, negocios privados, `heredar`, `legar`, `quiebra`), `vida/05-comercio.js` (`comercio`), `vida/06-banca.js` (`banca`, ministro); `sim/04-capital-opinion-y-creditos.js` (`prestar`, `perdonar`, `pagarCreditos`) |
| Explosiones y daño a edificios | `vida/15-tareas.js` (LAS EXPLOSIONES: `estallido`, `RESISTE`) |
| Comida, animales y corrales | `vida/18-comida-y-fauna.js` (COMER, `ALIMENTOS`, `alimento`, `desglose`, `pastar`) |
| Ciudades y colonos | `vida/19-ciudades-y-colonos.js` |
| Técnica, eras, caída de capital, independencias | `sim/03-tecnica-y-edades.js`, `sim/04-capital-opinion-y-creditos.js` (CAE LA CAPITAL), `sim/05-lealtad-y-guerras.js` |
| Opinión entre reinos y guerras | `sim/04-capital-opinion-y-creditos.js` (LA OPINIÓN ENTRE REINOS), `sim/05-lealtad-y-guerras.js` |
| Entender una orden escrita | `mando/03-tropas-y-entender.js` (Del texto a las acciones) y `mando/00-base-y-cuadrillas.js` (cuadrillas) |
| Lo que hace cada orden | `mando/01-ordenes-especiales.js`, `mando/02-aplicar-extra.js`, `mando/04-aplicar.js` |
| Cómo se ve un edificio o un barco | `arte/01-edificios.js`, `arte/02-publicos-y-negocios.js`, `arte/03-fases.js`, `arte/04-gente-vehiculos-e-iconos.js` |
| Animaciones, golpes, sucesos en el mapa | `pintor/03-golpes-y-figuras.js`, `pintor/04-aldeanos.js`, `pintor/08-particulas-y-sucesos.js` |
| Botones, paneles, ventana de órdenes, online | `vista/` (y `mundo.html`, `css/mundo.css`) |
| La barra de abajo del PC (forma de WorldBox) | `vista/07-barra-pc.js` (qué botón va en cada pestaña; cada uno pulsa el botón de siempre), sus iconos en `arte/04-gente-vehiculos-e-iconos.js` (`BARRA`) y la disposición al final de `css/mundo.css` |

## Pruebas y publicación

```
node scripts/unir.js    # junta las partes en los módulos (después de tocar una parte)
for f in test/*.test.js; do timeout 900 node $f; done   # 19 pruebas; todas terminan en «Todo bien» o con sus cifras
sh scripts/pwa.sh        # genera docs/ (la versión jugable)
sh scripts/paquete.sh    # genera Genesis.html (un solo archivo)
```

`test/mundo.test.js` es la prueba grande de Génesis. Las comprobaciones que dependen del azar de un mundo concreto usan varias semillas y umbrales relativos, para que un cambio en la simulación no las rompa por mala suerte.
