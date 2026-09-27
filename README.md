# Consola de Valdoria

Un juego de consola para el celular: eres el Líder Supremo de la República de Valdoria y gobiernas **escribiendo decretos con tus propias palabras**.

```
> el aire se vende

▸ INTÉRPRETE › PRIVATIZAR + EL AIRE · 91% seguro

DECRETO Nº 1 · DÍA 1                                    [DECRETADO]
La privatización del aire. Se instalan medidores de respiración en
cada hogar. Tarifa básica: 3 valdos por hora. Los asmáticos pagan
tarifa premium.
Tesoro +24  Pueblo −25  Cúpula +16  Salud −12  Mundo −3

ROLANDO "ROLO" PAREDES · JEFE DE PROPAGANDA
La televisión estatal dedica tres horas a un documental sobre patos
para no hablar de la privatización del aire.

LA CALLE · DOÑA CARMEN
Doña Carmen enciende una vela en la iglesia. No pide por ella: pide
por su nieto Nico, que rompió un plato al oír las noticias.

(dos días después)
CONSECUENCIA · AIRE EMBOTELLADO
Aparece un mercado negro de aire embotellado en La Esperanza...
```

No usa ninguna IA externa: funciona sin internet, gratis y al instante.

## Cómo jugar

- Abre `index.html` en el navegador (o `dist/valdoria.html`, que es el juego entero en un solo archivo).
- Escribe un decreto y pulsa **DECRETAR**. Los botones de abajo te ayudan a empezar frases.
- Puedes firmar hasta 3 decretos a la vez: `prohibir el fútbol y subir impuestos a los ricos`.
- El bot entiende jerga y faltas: `banear a los tombos`, `birras gratis para los chamos`, `prohivir el alcojol`.
- **Eventos:** más o menos cada 4 días (o antes, si pasa algo grave) salta un evento con 2 o 3 opciones, al estilo Victoria 2. Cada opción muestra sus efectos. Algunas traen consecuencias más adelante o abren otro evento.
- **Economía profunda:** 8 sectores (agricultura, petróleo y minas, carbón, industria, turismo, tecnología, comercio y narcotráfico), cada uno con su peso, su dueño y un precio mundial que cambia cada día. Hay PIB, paro, inflación y contaminación. Prueba `quiero hacer un narco estado`, `toda la economía al carbón`, `imprimir dinero`, `dolarizar` o `nacionalizar el petróleo`. Una reconversión tarda días y trae sus propios eventos.
- **Instituciones del régimen:** `crear una escuadra de represión`, `fundar un partido único`, `crear una red de espías`, `crear milicias populares`, `crear un ministerio de propaganda`. Siguen actuando cada día, cuestan dinero y se pueden disolver.
- **Personas:** puedes eliminar, encarcelar, exiliar, destituir, premiar o liberar a tus ministros (`matar al general`, `destituir a Cifuentes`), a la gente de a pie (`encarcelar a Nico`), al líder de la oposición (`exiliar a Valiente`) o al embajador. Los ministros caídos se sustituyen por sucesores y todo tiene consecuencias.
- Comandos: `estado`, `economía` (también tocando la línea del mercado), `poder` (ministros, instituciones y personas), `historial`, `ayuda`, `reiniciar`.
- Sobrevive 30 días hasta las elecciones. Si alguna barra llega a 0, caes (revolución, golpe de estado, bancarrota...).
- La partida se guarda sola en el celular.

### Publicarlo gratis con GitHub Pages

En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. El juego quedará en `https://<usuario>.github.io/rfigh/`.

## Cómo funciona por dentro

El juego tiene su propio "bot", con tres piezas:

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Intérprete** | `js/interprete.js` | Entiende el decreto. Traduce jerga (`js/datos/sinonimos.js`), corrige faltas, y usa dos clasificadores Naive Bayes (acción y objeto) entrenados con las frases de `js/datos/`. Detecta negaciones ("ya no se vende el agua"), intensidad ("subir *mucho*"), objetos desconocidos ("prohibir los calcetines") y varios decretos en una frase. Si duda, pregunta. |
| **Consejero** | `js/consejero.js` | Calcula las consecuencias: 7 estadísticas, economía diaria, consecuencias con retraso, contradicciones, desgaste del poder, personajes con memoria y finales. |
| **Economía** | `js/economia.js` | El mercado: precios mundiales, reconversiones, PIB, paro, inflación, contaminación y su efecto diario en el país. |
| **Poder** | `js/poder.js` | Instituciones del régimen que actúan cada día, y decretos sobre personas concretas con sucesores y consecuencias. |
| **Director** | `js/director.js` | Decide cuándo salta un evento con decisiones: continuaciones de eventos anteriores, urgencias (huelgas, rumores de golpe, epidemias...) o, si no, uno cada ~4 días según la situación. |
| **Narrador** | `js/narrador.js` | Cuenta la historia: Gaceta Oficial, titulares de prensa (oficial, extranjera y radio pirata), el gabinete, la gente de a pie, voces anónimas, recuerdos de decretos anteriores y cómo amanece el país cada día. |

Los datos (lo que más se puede ampliar) están separados del código:

- `js/datos/acciones.js`: 14 acciones (prohibir, privatizar, castigar, crear, reconvertir la economía...) con sus frases de ejemplo.
- `js/datos/objetos.js`: 40 temas (aire, agua, fútbol, carbón, narcotráfico, escuadrón, los lunes...) con sus propiedades.
- `js/datos/sinonimos.js`: jerga y sinónimos ("tombos" → policías, "birras" → cervezas).
- `js/datos/personajes.js`: el gabinete y la gente de a pie (Doña Carmen, Nico, Ramiro, Lucía).
- `js/datos/eventos.js`: combinaciones especiales, alertas, noticias al azar y finales.
- `js/datos/dilemas.js`: 57 eventos con decisiones, sus condiciones y sus cadenas (narcoestado, carbón, escuadrón, funerales...).
- `js/datos/mercado.js`: los sectores de la economía y las noticias del mercado.
- `js/datos/poder.js`: instituciones, personas, sucesores y qué pasa con cada trato.
- `js/datos/voces.js`: titulares, voces de la calle, ambiente de cada día y reacciones a lo absurdo.

**Para que el bot entienda más:** añade frases a `frases` (acciones) o a `formas` (objetos). Se reentrena solo al cargar la página.

## Desarrollo

```bash
npm test            # prueba el Intérprete, simula 400 partidas, prueba escenarios (narcoestado, carbón, escuadrón, personas) y el equilibrio
npm run empaquetar  # genera dist/valdoria.html (todo en un archivo)
```

No hace falta instalar nada: solo Node.js para las pruebas.
