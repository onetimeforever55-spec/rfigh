# Génesis por dentro

Esta guía sirve para encontrar rápido dónde se hace cada cosa. Lista de secciones con su línea, siempre al día:

```
node scripts/mapa.js            # todas las secciones de js/mundo/
node scripts/mapa.js vida       # solo las de un archivo
node scripts/mapa.js puerto     # busca en títulos de sección y nombres de función
```

Las secciones del código empiezan con `// ---------- Título ----------` o con un bloque `/*` cuyo primer renglón va en MAYÚSCULAS («LOS BARCOS: …»). Si añades una sección, sigue ese formato y saldrá en el mapa.

## Los archivos (en el orden en que se cargan)

Cada archivo es un módulo `(function () { … })()` que se cuelga de `RF.MUNDO`. Los cinco primeros no tocan el navegador, así que las pruebas de Node los cargan tal cual.

| Archivo | Se cuelga en | Qué hace |
|---|---|---|
| `datos.js` | `M.ERAS`, `M.TECNOLOGIAS`, `M.tec`… | Las eras, los inventos, el carácter de los pueblos y sus nombres. Casi solo datos. |
| `sim.js` | `M.sim` | El mundo grande: mapa de regiones, reinos, gobernantes, técnica y eras, opinión, alianzas, guerras, lealtad de ciudades, caída de capitales y crónica. `turno(m)` y `turnoPorPartes(m)`. |
| `vida.js` | `M.vida` | La vida en parcelas (4×4 por región): aldeanos, oficios, edificios, mercado, comida, ejércitos, barcos, fuego, explosiones, caminos y trenes, animales, ciudades y colonos. Es el archivo más grande. |
| `dios.js` | `M.dios` | Los poderes del modo dios por texto («peste sobre X»). |
| `mando.js` | `M.mando` | El modo «Gobernar un pueblo»: del texto de una orden a acciones (`ordenar`), aplicarlas (igual en local que online), el consejero y los retos. |
| `arte.js` | `M.arte` | Todos los dibujos en píxeles, hechos con código: suelos, árboles, edificios por época, aldeanos, vehículos, barcos e iconos. |
| `pintor.js` | `M.pintor` | Pinta el mundo en el canvas en cada fotograma: interpola los caminos de los aldeanos entre turnos, combates, partículas, sucesos en el mapa, día y noche, cámara. |
| `sonido.js` | `M.sonido` | Sonidos sintetizados con Web Audio. |
| `vista.js` | — | La interfaz: paneles, fichas, mercado, corte, tiempo y velocidad, retos, online (relé por un servidor MQTT), la ventana de órdenes y el arranque. |

`mundo.html` es la página y `css/mundo.css` su estilo. `scripts/empaquetar.js` junta todo en un solo HTML.

## Cómo fluye un turno

1. `vista.js` (sección «El tiempo») pide un turno. Usa `S.turnoPorPartes(m)`, un generador, y lo va calculando en trozos de unos 7 ms (`seguirCalculo`) para que la animación no se corte. `acabarTurno()` lo termina de golpe si hace falta antes de una acción.
2. `sim.js › turnoPorPartes` hace lo del mundo grande (técnica, diplomacia, guerras, lealtad) y llama a `M.vida.turnoPorPasos`, que cede el control entre pasos.
3. `vida.js › turno` (sección «Un turno de vida») mueve a cada aldeano durante `TICKS` pasos y guarda su camino. Después vienen las obras, el mercado, los barcos, el fuego, los animales, las ciudades y los colonos.
4. `pintor.js › Un turno nuevo` guarda una foto de esos caminos (`rVisto`/`rAntes`). Hasta el siguiente turno, cada fotograma interpola sobre ella.

**Todo es reproducible:** el azar sale de `S.azar(m)`, con el estado guardado en el mundo. Nunca uses `Math.random()` en `sim.js`, `vida.js`, `dios.js` ni `mando.js`, porque el online depende de que cada navegador calcule lo mismo. Solo lo visual (`pintor.js`, `arte.js`) puede usar azar libre.

## Dónde tocar cada cosa

| Quiero cambiar… | Dónde |
|---|---|
| Lo que construye la IA y por qué | `vida.js` › LOS EDIFICIOS DE CADA PLAZA, LAS NECESIDADES, `edificioPendiente`, `puedeColocar` |
| Qué oficio tiene cada aldeano | `vida.js` › EL GOBERNADOR AUTOMÁTICO, `reparto`, `reasignar` |
| Precios, tratos, carretas, trenes | `vida.js` › EL MERCADO GLOBAL, LA CARTERA DE CADA REINO, CAMINOS Y RUTAS COMERCIALES |
| Barcos: pesca, mercantes, guerra, transportes | `vida.js` › LOS BARCOS, LA MARINA DE GUERRA (`maresDe`, `sitioPuerto`, `planNaval`, `porMar`, `NAVAL`) |
| Ejércitos, asedios, torres, trincheras | `vida.js` › LOS EJÉRCITOS, EL ASEDIO, LAS TORRES DE VIGILANCIA, LAS TRINCHERAS |
| Banco, empresarios y créditos entre reinos | `vida.js` › LA BANCA (`banca`, `heredar`, `quiebra`, `v.privados`); `sim.js` › LOS CRÉDITOS ENTRE REINOS (`prestar`, `perdonar`, `pagarCreditos`) |
| Explosiones y daño a edificios | `vida.js` › LAS EXPLOSIONES (`estallido`, `RESISTE`) |
| Comida y sus tipos | `vida.js` › COMER, `ALIMENTOS`, `alimento`, `desglose` |
| Técnica, eras, caída de capital, independencias | `sim.js` › La técnica, CAE LA CAPITAL, LA LEALTAD DE LAS CIUDADES |
| Opinión entre reinos y guerras | `sim.js` › LA OPINIÓN ENTRE REINOS, Las relaciones entre pueblos |
| Entender una orden escrita | `mando.js` › Del texto a las acciones (y las cuadrillas al principio) |
| Cómo se ve un edificio o un barco | `arte.js` › Edificios, Templo, molino, puerto…, Barcos de cada época |
| Animaciones, golpes, sucesos en el mapa | `pintor.js` › Golpes como en WorldBox, LOS GRANDES SUCESOS EN EL MAPA |
| Botones, paneles, ventana de órdenes, online | `vista.js` (y `mundo.html`, `css/mundo.css`) |

## Pruebas y publicación

```
for f in test/*.test.js; do timeout 900 node $f; done   # 15 pruebas; todas terminan en «Todo bien» o con sus cifras
sh scripts/pwa.sh        # genera docs/ (la versión jugable)
sh scripts/paquete.sh    # genera Genesis.html (un solo archivo)
```

`test/mundo.test.js` es la prueba grande de Génesis. Las comprobaciones que dependen del azar de un mundo concreto usan varias semillas y umbrales relativos, para que un cambio en la simulación no las rompa por mala suerte.
