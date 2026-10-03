# Consola de Pionyang

Un juego de consola para el celular: acabas de heredar el poder en **Corea del Norte** y gobiernas **escribiendo decretos con tus propias palabras**. Es una sátira: tú eres «el Líder Supremo», y los ministros y la gente de a pie son personajes inventados.

```
> vender carbón a China

DECRETO Nº 1 · TURNO 1                                  [DECRETADO]
La privatización del carbón.
Ahora:       Divisas +35M   Pueblo −4
Cada turno:  Divisas +8M    Pueblo −0.3

> imprimir wones
...
LEYES VIGENTES · ESTE TURNO
La impresión de dinero          +25M  arroz +6.0
La privatización del carbón      +8M  pueblo −0.3
Impuestos y gastos del Estado    −6M
Resultado del turno:  Divisas +27M   Arroz +6%
```

- **Tres barras:** DIVISAS (millones de dólares, pese a las sanciones), INFLACIÓN y ESTABILIDAD (a 0, caes).
- **Tres sectores con ánimo propio:** EJÉRCITO, PALACIO (el Partido y la élite) y POBLACIÓN. Su ánimo sube o baja con tus decretos, los eventos y la economía, y **empuja la estabilidad cada turno**. **Solo pierdes cuando la estabilidad llega a 0**: un sector hundido, la quiebra, la hiperinflación o unas elecciones perdidas no te echan, pero la desploman turno a turno; quién te tumba al final depende del sector más enfadado. **La represión da estabilidad artificial**: sube la barra y el miedo calla el descontento de la población (escribe `estado` para ver el % de miedo). Cada sector tiene su sección en el texto de cada turno, con su ánimo y si sube (▲) o baja (▼).
- **Cada turno se cuenta por secciones, corto y con humor estilo Tropico:** RADIO PIONYANG (el locutor de propaganda que lo vende todo como una victoria), PALACIO, EJÉRCITO y POBLACIÓN.
- **Economía real:** las **sanciones** (nivel 0-4) cuestan divisas cada turno y amargan a la élite; los misiles y la bomba las suben, y el desarme y la democracia las bajan. El **mercado negro** (jangmadang, % de la economía) ayuda a la población a sobrevivir y enriquece a los cuadros con sobornos, pero no paga impuestos; legalizarlo lo convierte en recaudación. Escribe `estado` para verlo.
- **Se empieza en la dinastía Juche:** la Asamblea Popular Suprema aplaude, solo existe la prensa oficial y las elecciones tienen un candidato único. Puedes democratizar el país, proclamarte rey o volver al Juche.
- **No hay último turno:** el contador sigue para siempre y gobiernas mientras aguantes. Cada 20 turnos hay elecciones: amañadas o rituales (siempre ganas) o, si has democratizado el país, libres (si pierdes, no reconoces el resultado y la estabilidad se hunde). Sin buscar divisas, las sanciones te llevan a la quiebra hacia el turno 35.

No usa ninguna IA externa: funciona sin internet, gratis y al instante.

## Cómo jugar

- Abre `index.html` en el navegador (o `dist/pionyang.html`, que es el juego entero en un solo archivo).
- Escribe un decreto y pulsa **DECRETAR**. Los botones de abajo te ayudan a empezar frases.
- Solo importan cuatro cosas: **Divisas** (millones de dólares; puede haber deuda), **Arroz** (la inflación), **Lealtad** y **Pueblo**. Si la lealtad o el pueblo llegan a 0, caes.
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
- También puedes decretar sobre personas (`destituir a Pak`, `encarcelar a Chol-su`, `matar a Song Dae-ho`) y firmar hasta 3 decretos a la vez.
- **Eventos:** cada pocos turnos, o cuando tus leyes lo provocan, salta un evento con opciones (estilo Victoria 2).
- Comandos: `esperar`, `estado`, `sistema`, `leyes`, `poder`, `historial`, `ayuda`, `reiniciar`.
- No hay último turno: gobierna mientras aguantes. La partida se guarda sola en el celular.

### Publicarlo gratis con GitHub Pages

En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. El juego quedará en `https://<usuario>.github.io/rfigh/`.

### Temas duros

Algunos decretos tienen reglas propias porque el clasificador general no los trata bien: la esclavitud, el trabajo infantil, la guerra, la bomba atómica, los campos de reeducación, la quema de libros, la tortura, el aborto, el matrimonio igualitario, la prostitución, la inmigración, el salario mínimo, las pensiones, la renta básica, los aranceles, la selva, la jornada laboral, el voto de las mujeres, la edad para votar, el bitcoin, el muro y las cárceles.

Cada tema se entiende en las dos direcciones: «legalizar la esclavitud» / «abolir la esclavitud», «declarar la guerra» / «firmar la paz», «talar la selva» / «dejar de talar la selva». Cada dirección tiene sus efectos, lo polémico que es para el Congreso y consecuencias con retraso: sanciones, fugas, bloqueo naval, inundaciones o la huelga de las mujeres. Ir en contra sustituye a la ley anterior, y abolir algo que nunca existió solo lo recuerda. Los temas están en `js/datos/temas.js`; para añadir uno basta con escribir su entrada.

### Diplomacia

Cuatro potencias tienen una relación contigo (0-100), algo que quieren y algo que temen. Escribe `diplomacia` para verlo.

| País | Quiere | Consecuencia cada turno |
|---|---|---|
| **China** | estabilidad en su frontera: ni guerras ni pruebas que atraigan barcos americanos | comercio (divisas). Si se enfada, corta el petróleo: suben los precios |
| **Estados Unidos** | que desmanteles el arsenal (lo heredas de tu padre) | si te odia, endurece las sanciones; si te aprecia, las alivia |
| **Corea del Sur** | reencuentros familiares, zonas industriales conjuntas | con buenas relaciones manda ayuda (y se cuelan memorias USB) |
| **Japón** | que devuelvas a los secuestrados y dejes de lanzar misiles | algo de ayuda si las relaciones son buenas |

- **Decretos diplomáticos:** `negociar con Estados Unidos`, `pedir ayuda a China`, `visitar Seúl`, `insultar a Japón`… Acercarte a uno puede molestar a otro, por ejemplo a China le ponen celosa los tratos con Washington. Los generales desconfían de los acercamientos al enemigo. Cuanto mejor es ya la relación, menos rinde cada gesto.
- **Los temas duros también cuentan:** los misiles y la bomba enfadan a todos, y más aún al país al que apuntas (`lanzar un misil a Japón`). El desarme, la paz y democratizar el país mejoran las relaciones.
- **Eventos:** la *oferta de Washington* (el arsenal a cambio de trigo y levantar sanciones; si finges aceptar, te descubren unos turnos después), *Pekín pierde la paciencia*, *Seúl tiende la mano* (Kaesong o reencuentros), *los secuestrados de Tokio* y *la cumbre*, que llega si las relaciones con EE. UU. mejoran.
- **Con IA,** el Consejo recibe qué quiere y teme cada potencia y puede mover las relaciones y el arsenal, con los mismos topes.

Las relaciones vuelven poco a poco a su punto de partida: la memoria diplomática es corta.

### Escenarios: otros momentos de la historia

Escribe `escenarios` (o "jugar urss") para cambiar de época. Cada escenario guarda su propia partida: puedes ir y volver sin perder nada.

- **Corea del Norte, hoy** — la partida libre de siempre, sin último turno.
- **La URSS, 1985** — el Politburó te elige Secretario General. Cada turno son tres meses, de marzo de 1985 a diciembre de 1991. Objetivo: que la Unión siga existiendo en diciembre de 1991, el mes en que se disolvió de verdad. La historia llega en su fecha y tú decides qué hacer: la campaña antialcohol, el hundimiento del petróleo, Chernóbil, Reikiavik, Afganistán, el pleno de octubre, el Karabaj, las primeras elecciones, los mineros, el Muro, los bálticos y el golpe de agosto. Al final, **lo que pasó de verdad** y en qué te pareciste a la historia. Tiene sus propios ministros (inventados), gente de a pie, radio, eventos, finales, régimen de partido único, potencias (Estados Unidos, Europa Occidental, China y Europa del Este) y el vocabulario de la época para el bot ("glásnost", "salir de Afganistán", "vender gas a Alemania").

Cómo se añade un país (`js/datos/urss.js` como ejemplo): un perfil en `RF.PAISES` (barras, sectores, inicio, relaciones y gestos, economía, conceptos, contexto e instrucciones para la IA, presentación, botones rápidos y `reemplazos` para los textos generales), un paquete en `RF.PAQUETES` (ministros, gente de a pie, personas, sucesores, eventos, umbrales, azar, finales, radio), lecciones en `RF.APRENDIDOS_PAIS` y el escenario en `RF.ESCENARIOS` (calendario, turnos, objetivo, historia programada, lo que pasó y la comparación). `js/datos/escenarios.js` elige el escenario guardado y carga el país antes que el motor.

### La economía de fondo

Además de las leyes, cada turno actúan mecánicas del propio país (parámetros en `js/datos/paises.js`, para poder cambiarlas en otros países):

- **Sin crédito, el déficit se imprime:** nadie presta a Corea del Norte, así que cada turno un cuarto del agujero se tapa imprimiendo wones (sube la inflación). Por debajo de −200M ya no hay deuda posible: lo que falta se queda sin pagar y el ejército, el Palacio y la calle cobran en vales.
- **La Oficina 39:** por encima de 150M de reservas, la caja personal del Líder se lleva un 8% del exceso cada turno (la élite, encantada). Unas reservas sólidas, en cambio, respaldan el won y frenan la inflación.
- **Las sanciones se aprenden a esquivar:** mientras duran, las redes de contrabando mejoran hasta esquivar la mitad de su coste; si se levantan, se oxidan.
- **China no te deja caer:** si la estabilidad baja de 20 y la relación con Pekín no está rota del todo, China manda petróleo y arroz (menos si la relación es mala), como mucho cada 8 turnos. A cambio se queda con una mina o un puerto: cada rescate cuesta divisas todos los turnos siguientes.

Con estas reglas, jugar como el régimen real (un misil de vez en cuando, carbón de contrabando, obreros en Rusia) aguanta con sanciones al máximo; lanzar misiles y bombas cada turno, no.

### El bot aprende de la IA

El intérprete local (el que funciona sin IA) es un clasificador pequeño, pero **aprende de Claude** (`js/aprendiz.js`):

- **Jugando:** con la IA activa, el Consejo devuelve además una `clave` con cómo clasificaría el bot ese decreto (acción + objeto, o tema + dirección) y qué conceptos lo explican. El bot la guarda y avisa en el turno: «EL BOT APRENDE». La próxima vez entiende ese decreto, y los parecidos, sin IA.
- **Entrenando:** el comando `entrenar` (o `entrenar 20`) hace que la IA invente decretos variados, coloquiales y con faltas; el bot intenta entenderlos y aprende los que falla. Enseña el resultado: cuántos acertaba antes y cuántos después.
- **Cómo aprende:** lo aprendido va a un segundo cerebro aparte (otros dos clasificadores), que solo decide cuando el de fábrica no tiene ninguna palabra clara, así que no olvida nada de lo que ya sabía. Además recuerda las frases exactas (o casi) y los conceptos que la IA les asoció.
- **También aprende las mecánicas:** cada lección guarda los números que decidió la IA (efecto al firmar y cada turno). Cuando el bot local firma un decreto del mismo tipo, mueve los números del motor hacia la media de la IA: un 25% con una decisión, hasta un 60% con tres o más, nunca más de un límite por número (20 de divisas o 5 puntos al firmar; 6 de divisas, 1,5 de inflación o 1 punto por turno) y solo en lo que la IA mencionó. La línea del intérprete dice qué números ha ajustado.
- **Se revisa solo:** el comando `revisar` hace que la IA relea las lecciones sin revisar (dirección al revés, tema equivocado, conceptos que no pegan), corrija las que estén mal y borre las que no son decretos; las revisadas quedan marcadas y no se vuelven a pagar. El examen (`entrenar`) enseña también números. Si la IA asocia un concepto que no encaja con el decreto, el bot lo explica con su idea general y no deja que cambie los números.
- **Dónde se guarda:** jugando dentro de claude.ai, en la base de datos del juego (colección `lecciones`): sigue ahí en cualquier dispositivo y Claude puede leer y corregir las lecciones sin que nadie se las pegue. Fuera de claude.ai, en el navegador. `aprendido` enseña lo que sabe, `exportar` da la lista en JSON para pegarla en `js/datos/aprendidos.js` (lo que trae de fábrica) y `olvidar lo aprendido` la borra.
- Las lecciones de fábrica están revisadas a mano (la IA también se equivoca: marcó "fábricas de opio hasta morir" como abolir la esclavitud) y mandan sobre las guardadas con el mismo texto.
- De fábrica trae 66 lecciones: con ellas pasa de entender 2 a 15 de 28 frases coloquiales que no había visto nunca.

### Conceptos: el porqué de cada decreto

El juego no se limita a una lista de casos resueltos: razona con una **biblioteca de 164 conceptos reales** (78 mecanismos y 86 precedentes históricos) (`js/datos/conceptos.js`) de economía, sociedad, política, relaciones exteriores e historia. Cada concepto dice cuándo se aplica, cómo ajusta un poco las consecuencias según la situación del país y cómo se explica.

- **Mecanismos:** dinero sin respaldo, confianza en la moneda, gasto sin dinero, lo prohibido se va al mercado negro, economía sumergida, demasiados impuestos, privatizar para los de siempre, precio máximo y estantería vacía, quien siembra cosecha, el miedo, el mártir, la desigualdad que se ve, el momento más peligroso para un régimen (Tocqueville), la purga, obras que rinden si se terminan, el coste hundido, el enclave vallado, exportar con hambre en casa, la ayuda es fungible, el precio del dinero, la gasolina está en todo, el paro escondido, salida-voz-lealtad, las remesas, el soldado no siembra, todos son culpables, el dilema del dictador, la información no se desinventa…
- **Precedentes históricos** (solo explican): Weimar y Zimbabue, la reforma monetaria de 2009, la guerra del agua de Cochabamba, la Ley Seca, la Ardua Marcha, Shenzhen, el Gran Salto Adelante, la glásnost, Venezuela, Xiaogang 1978, Irak bajo sanciones, el Hotel Ryugyong, Kaesong, la Albania de Hoxha, la hambruna irlandesa, Volcker 1980, Irán 2019, el hijo único, el Muro de Berlín, el Songun, Gorbachov, las moscas y tigres de Xi, Chollima, el Período Especial cubano, Banco Delta Asia, el Chong Chon Gang, las medidas de julio de 2002.
- **Políticas nuevas que entiende el bot:** grandes obras, zonas económicas especiales, importar/exportar, ayuda humanitaria, sueldos públicos, servicio militar, amnistía, corrupción, burocracia, natalidad, emigración, tipos de interés, gasolina, vacunas, campañas de producción, casinos, espiar a los ministros y turismo.
- **Se aplican según la situación:** imprimir dinero con la inflación baja solo sube los precios, pero con la inflación ya alta hace que la gente abandone el won y la inflación se acelera sola. Subir impuestos con un mercado negro grande recauda menos.
- **Cada turno lo explica** en un bloque **POR QUÉ** de una o dos líneas: el mecanismo principal y, si viene a cuento, un precedente real.
- **El Consejo con IA recibe la misma biblioteca**, razona con ella (y con otros conceptos reales que conozca) y justifica sus consecuencias en el mismo bloque.

Políticas económicas y sociales nuevas (`js/datos/politicas.js`): control de precios, racionamiento, reforma monetaria, reparto de tierras o colectivización, y el songbun.

### Acciones exteriores

Lo que hace un régimen aislado fuera de sus fronteras (`js/datos/exterior.js`):

| Decreto de ejemplo | Qué pasa |
|---|---|
| `vender armas a una guerrilla africana` | divisas ahora y cada turno; suben las sanciones. Luego, al azar: las armas salen en la tele, el cliente repite o no paga |
| `financiar a la guerrilla de Colombia` | cuesta dinero cada turno; la guerrilla gana (contrato de minas), es aplastada (sanciones) o se eterniza |
| `apoyar un golpe de estado en X` | el golpe triunfa (un aliado y divisas) o fracasa (sanciones) |
| `pedir un préstamo a Rusia` | +45M ahora y −5M durante 12 turnos; «no pagar la deuda» enfada al acreedor |
| `enviar trabajadores a Siberia` | divisas cada turno; algunos acaban desertando |
| `hackear bancos japoneses` | +35M; puede quedar un rastro digital |
| `contrabandear carbón a China` | divisas cada turno, hasta que un satélite lo fotografía |

El destino que escribes («una guerrilla africana») aparece en la ley y en los textos. Estas acciones se reconocen antes que el resto, así que «vender armas» ya no se confunde con privatizar la industria de armas.

### Perfil de país

Todo lo que hace distinto a un país está en `js/datos/paises.js`:
- identidad: nombre, capital, moneda y cómo se llama al líder;
- los nombres de las barras y los sectores;
- la partida inicial: indicadores, régimen, instituciones, sectores, sanciones y mercado negro;
- los parámetros económicos que usa el motor: ingresos, gastos, coste de cada nivel de sanciones, socios, exportaciones e importaciones;
- los **conceptos reales** que el motor y la IA deben entender: sanciones, jangmadang, raciones, songbun, inminban, donju, campos, songun, propaganda y fugas;
- un **contexto** del país real para la IA.

Hoy solo existe Corea del Norte. Para añadir otro país hay que escribir su perfil; los eventos y personajes (`datos/*.js`) necesitarían sus propios textos.

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

**Coherencia absurda.** Cualquier estupidez se cumple al pie de la letra, con total seriedad burocrática. El Consejo razona en cadena: cómo lo aplica el Estado, quién gana dinero, quién hace la trampa y qué efecto secundario nadie previó. Esos pasos se ven en el «Informe del Consejo». La regla absurda queda en la memoria como realidad del juego: si prohíbes los lunes, en Corea del Norte después del domingo viene el martes durante el resto de la partida.

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
- **Dónde funciona cada cosa:** la cuenta de Claude, solo dentro de claude.ai. Las claves de API, en GitHub Pages o abriendo `dist/pionyang.html`; dentro de claude.ai no, porque el visor bloquea las conexiones externas.

## Desarrollo

```bash
npm test            # prueba el Intérprete, simula 400 partidas, comprueba la lógica de las leyes, el equilibrio y el narrador con IA (simulado)
npm run empaquetar  # genera dist/pionyang.html (todo en un archivo)
```

Para las pruebas solo hace falta Node.js. `npm install` instala el SDK de Anthropic, que usa la prueba del narrador con IA con respuestas simuladas; sin el SDK, esa prueba se omite.
