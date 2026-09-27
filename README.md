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
- Comandos: `estado`, `gabinete`, `historial`, `ayuda`, `reiniciar`.
- Sobrevive 30 días hasta las elecciones. Si alguna barra llega a 0, caes (revolución, golpe de estado, bancarrota...).
- La partida se guarda sola en el celular.

### Publicarlo gratis con GitHub Pages

En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. El juego quedará en `https://<usuario>.github.io/rfigh/`.

## Cómo funciona por dentro

El juego tiene su propio "bot", con tres piezas:

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Intérprete** | `js/interprete.js` | Entiende el decreto. Dos clasificadores Naive Bayes (acción y objeto) entrenados con las frases de `js/datos/`. Corrige faltas ("prohivir" → "prohibir"), detecta negaciones ("ya no se vende el agua"), intensidad ("subir *mucho*") y objetos desconocidos ("prohibir los calcetines"). Si duda, pregunta. |
| **Consejero** | `js/consejero.js` | Calcula las consecuencias: 7 estadísticas, economía diaria, consecuencias con retraso, contradicciones, desgaste del poder, personajes con memoria y finales. |
| **Narrador** | `js/narrador.js` | Cuenta la historia: Gaceta Oficial, reacción del gabinete, la vida de la gente de a pie y los sucesos del día. Usa plantillas con variaciones `[a\|b\|c]`. |

Los datos (lo que más se puede ampliar) están separados del código:

- `js/datos/acciones.js`: 12 acciones (prohibir, privatizar, castigar...) con sus frases de ejemplo.
- `js/datos/objetos.js`: 24 temas (aire, agua, fútbol, ejército...) con sus propiedades.
- `js/datos/personajes.js`: el gabinete y la gente de a pie (Doña Carmen, Nico, Ramiro, Lucía).
- `js/datos/eventos.js`: combinaciones especiales, alertas, sucesos al azar y finales.

**Para que el bot entienda más:** añade frases a `frases` (acciones) o a `formas` (objetos). Se reentrena solo al cargar la página.

## Desarrollo

```bash
npm test            # prueba el Intérprete, simula 400 partidas y comprueba el equilibrio
npm run empaquetar  # genera dist/valdoria.html (todo en un archivo)
```

No hace falta instalar nada: solo Node.js para las pruebas.
