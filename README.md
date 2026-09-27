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
- También puedes decretar sobre personas (`destituir a Cifuentes`, `encarcelar a Nico`, `matar a Valiente`) y firmar hasta 3 decretos a la vez.
- **Eventos:** cada pocos turnos, o cuando tus leyes lo provocan, salta un evento con opciones (estilo Victoria 2).
- Comandos: `esperar`, `estado`, `leyes`, `poder`, `historial`, `ayuda`, `reiniciar`.
- Sobrevive 30 turnos hasta las elecciones. La partida se guarda sola en el celular.

### Publicarlo gratis con GitHub Pages

En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. El juego quedará en `https://<usuario>.github.io/rfigh/`.

## Cómo funciona por dentro

El juego tiene su propio "bot", con tres piezas:

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Intérprete** | `js/interprete.js` | Entiende el decreto: jerga, faltas, negaciones ("dejar de…" = derogar), intensidad, personas y varios decretos en una frase. Si duda, pregunta. |
| **Leyes** | `js/leyes.js` | La lógica de cada decreto: qué hace al firmarse, qué hace cada turno y cómo cambia con el tiempo (la gente se acostumbra, la represión se desgasta, las inversiones maduran). |
| **Consejero** | `js/consejero.js` | Los cuatro indicadores y cómo se afectan entre sí cada turno (impuestos, gastos, inflación, deuda, protestas), alertas y finales. |
| **Poder** | `js/poder.js` | Decretos sobre personas: ministros con sucesores, gente de a pie, el líder de la oposición y el embajador. |
| **Director** | `js/director.js` | Decide cuándo salta un evento y aplica la opción elegida. |
| **Narrador** | `js/narrador.js` | Cuenta la historia: Gaceta Oficial, el parte de leyes de cada turno, titulares, gabinete, calle y ambiente. |

Los datos (lo que más se puede ampliar) están separados del código:

- `js/datos/acciones.js`: las acciones (prohibir, vender, regalar, derogar...) con sus frases de ejemplo.
- `js/datos/objetos.js`: los temas (aire, agua, comida, cocaína, escuadrón...) con sus propiedades.
- `js/datos/mercado.js`: los modelos económicos para reconvertir la economía (narco, carbón, turismo...).
- `js/datos/sinonimos.js`: jerga y sinónimos.
- `js/datos/personajes.js`, `js/datos/poder.js`: gabinete, gente de a pie, instituciones y personas.
- `js/datos/eventos.js`, `js/datos/dilemas.js`, `js/datos/voces.js`: alertas, eventos con decisiones, noticias, titulares y voces.

**Para que el bot entienda más:** añade frases a `frases` (acciones) o a `formas` (objetos). Se reentrena solo al cargar la página.

## Desarrollo

```bash
npm test            # prueba el Intérprete, simula 400 partidas, comprueba la lógica de las leyes y el equilibrio
npm run empaquetar  # genera dist/valdoria.html (todo en un archivo)
```

No hace falta instalar nada: solo Node.js para las pruebas.
