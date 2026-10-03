/*
 * PAÍSES
 * Todo lo que hace distinto a un país vive aquí, para poder añadir otros en el futuro:
 *   identidad        nombres, capital, moneda, cómo se llama al líder
 *   barras           cómo se llaman las tres barras de arriba (dinero, inflación, estabilidad)
 *   sectores         los grupos cuyo ánimo sostiene (o tumba) el régimen; cada uno tiene su sección en el texto
 *   inicio           cómo empieza la partida: indicadores, régimen, instituciones, sectores
 *   economia         parámetros que usa el motor cada turno (ingresos, gastos, sanciones, mercado negro)
 *   conceptos        las piezas reales del país que el motor y la IA deben entender
 *   contexto         lo que la IA tiene que saber del país real para que sus consecuencias tengan sentido
 * Los textos de los eventos y personajes (datos/*.js) son de Corea del Norte; otro país necesitaría los suyos.
 */
(function (RF) {
  'use strict';

  RF.PAISES = {
    corea: {
      id: 'corea',
      nombre: 'República Popular Democrática de Corea', corto: 'Corea del Norte', marca: 'RPDC', juego: 'Consola de Pionyang',
      capital: 'Pionyang', moneda: 'wones', gentilicio: 'norcoreanos', lider: 'el Líder Supremo',
      radio: 'RADIO PIONYANG',

      barras: {
        dinero: { nombre: 'Divisas', corto: 'DIVISAS', ayuda: 'millones de dólares en las arcas, pese a las sanciones' },
        inflacion: { nombre: 'Inflación', corto: 'INFLACIÓN', ayuda: 'lo que suben los precios cada turno (sobre todo el arroz en el mercado)' },
        estabilidad: { nombre: 'Estabilidad', corto: 'ESTABILIDAD', ayuda: 'si el régimen aguanta: a 0, caes' }
      },

      // El ánimo de cada sector (0-100) empuja la estabilidad cada turno. Solo se pierde con la estabilidad a 0.
      // "poblacion" es la felicidad de la gente (sin barra propia: se ve en su sección del texto).
      sectores: {
        ejercito: { nombre: 'Ejército', seccion: 'EJÉRCITO', quien: 'el Ejército Popular de Corea: los generales, los oficiales y un millón de soldados', fin: 'ejercito' },
        elite: { nombre: 'Palacio', seccion: 'PALACIO', quien: 'la élite del Partido: los cuadros, los ministros y las familias de buen songbun', fin: 'cupula' },
        poblacion: { nombre: 'Población', seccion: 'POBLACIÓN', quien: 'la gente de a pie: raciones, mercado, apagones y altavoces', fin: 'pueblo' }
      },

      inicio: {
        stats: { dinero: 80, inflacion: 6, estabilidad: 62, felicidad: 45 },
        sectores: { ejercito: 65, elite: 60 },
        regimen: 'JUCHE',
        instituciones: { congreso: 'controlado', tribunales: 'controlado', prensa: 'controlado', elecciones: 'controlado', constitucion: 'controlado' },
        apoyo: 99,
        economia: { sanciones: 2, mercadoNegro: 60 },
        arsenal: true // heredas el programa nuclear de tu padre
      },

      /*
       * DIPLOMACIA: las potencias vecinas. Relación 0-100 (inicio y "base", a la que tiende con el tiempo),
       * qué quieren, qué temen, cómo se las nombra en un decreto y qué pasa con un gesto amistoso u hostil.
       */
      relaciones: {
        eeuu: {
          nombre: 'Estados Unidos', inicio: 18, base: 22,
          quiere: 'que desmanteles misiles y bombas; a cambio levantaría sanciones y mandaría comida',
          teme: 'un misil capaz de llegar a su costa',
          claves: /\b(estados unidos|eeuu|ee uu|usa|washington|norteamerica\w*|americanos?|yanquis?|la casa blanca)\b/,
          gestos: {
            amistad: { medida: 'el acercamiento a Estados Unidos', relaciones: { eeuu: 12, china: -4, surcorea: 3 }, efectos: { ejercito: -4, estabilidad: -1 },
              textos: ['Mandas una carta a Washington escrita a mano, con un sello de lacre y tres faltas de ortografía que {montiel} no se atrevió a corregir. La Casa Blanca contesta en cuarenta y ocho horas. Los generales, en cuarenta y ocho segundos, y no para bien.', 'Invitas a un equipo de baloncesto americano a Pionyang. Pierden 110 a 12 porque los árbitros son tuyos. Aun así, en Washington lo llaman "un paso adelante".'] },
            hostil: { medida: 'el desafío a Estados Unidos', relaciones: { eeuu: -15, china: -3, japon: -3 }, efectos: { ejercito: 5, estabilidad: 2 }, sanciones: 0,
              textos: ['El Rodong Sinmun dedica su portada a llamar al presidente americano "chocho senil con peluquín". En Washington lo traducen tres veces para asegurarse. Los generales lo enmarcan.', 'Ordenas un desfile frente a la embajada que no existe. Se desfila igual, frente a un solar, con pancartas en un inglés muy creativo.'] }
          }
        },
        china: {
          nombre: 'China', inicio: 58, base: 55, comercio: 0.1,
          petroleo: 'China ha cerrado el oleoducto "por mantenimiento": falta petróleo y suben los precios.',
          quiere: 'estabilidad en su frontera: ni guerras, ni refugiados, ni pruebas que atraigan barcos americanos',
          teme: 'que el régimen caiga y haya soldados americanos en el río Yalu',
          claves: /\b(china|chinos?|pekin|beijing|el gigante asiatico)\b/,
          gestos: {
            amistad: { medida: 'la visita a Pekín', relaciones: { china: 12, eeuu: -2 }, efectos: { dinero: 6, elite: 3 },
              textos: ['Viajas a Pekín en tu tren blindado, que va a 40 por hora porque no hay tren más rápido que no sea chino. Te reciben con alfombra roja y una lista de peticiones. Vuelves con arroz, petróleo y la sensación de que alguien te ha dado una palmadita en la cabeza.', 'Mandas a Pekín una delegación con regalos: una estatua de mármol, dos tigres disecados y un cuadro tuyo. Te devuelven un barco de fertilizante. Es el mejor cambio del año.'] },
            hostil: { medida: 'el desplante a Pekín', relaciones: { china: -18 }, efectos: { dinero: -8, inflacion: 3, ejercito: 3 },
              textos: ['Llamas "imperialistas del arroz" a los chinos en un discurso. Pekín no contesta. Solo cierra el oleoducto una semana "por mantenimiento". Nunca un mantenimiento fue tan elocuente.', 'Expulsas a tres comerciantes chinos del mercado de Sinuiju. Al día siguiente, en la frontera, los camiones chinos descubren un repentino interés por las inspecciones exhaustivas.'] }
          }
        },
        surcorea: {
          nombre: 'Corea del Sur', inicio: 28, base: 32,
          quiere: 'reencuentros de familias separadas, zonas industriales conjuntas y, algún día, la reunificación',
          teme: 'la artillería que apunta a Seúl desde la frontera',
          claves: /\b(corea del sur|surcorea\w*|seul|los del sur|el gobierno del sur)\b/,
          gestos: {
            amistad: { medida: 'la mano tendida al Sur', relaciones: { surcorea: 14, eeuu: 3, japon: 2 }, efectos: { felicidad: 2, ejercito: -3, elite: -2 },
              textos: ['Reabres la línea telefónica con Seúl, que llevaba dos años sonando sin que nadie lo cogiera. El primer día solo se dicen "¿hola?" y "¿hola?". Es histórico.', 'Mandas al Sur una caja de setas de pino, el regalo más elegante de la península. Seúl responde con mandarinas. Los generales, con cara de pocos amigos.'] },
            hostil: { medida: 'la provocación al Sur', relaciones: { surcorea: -18, eeuu: -5, japon: -2 }, efectos: { ejercito: 4, estabilidad: 1 },
              textos: ['Mandas globos con basura por encima de la frontera. Caen en Seúl bolsas con colillas y calcetines. Los surcoreanos responden con altavoces de K-pop a todo volumen. Tus soldados de la frontera se aprenden las coreografías.', 'Los altavoces de la frontera insultan al Sur día y noche. El Sur responde subiendo el volumen de sus propias canciones. Nadie duerme en veinte kilómetros.'] }
          }
        },
        japon: {
          nombre: 'Japón', inicio: 18, base: 22,
          quiere: 'que devuelvas a los japoneses secuestrados hace décadas y dejes de lanzar misiles por encima de su territorio',
          teme: 'un misil sobre Hokkaido a la hora del desayuno',
          claves: /\b(japon\w*|tokio|nipon\w*|hokkaido)\b/,
          gestos: {
            amistad: { medida: 'el deshielo con Japón', relaciones: { japon: 14, eeuu: 2 }, efectos: { dinero: 3, elite: -1 },
              textos: ['Aceptas hablar con Tokio de los secuestrados. Es la primera vez en veinte años que en una reunión diplomática nadie se levanta enfadado antes del té.', 'Permites que un barco japonés recoja a unos pescadores que habían naufragado en tu costa. Tokio da las gracias con una reverencia muy larga y un cheque muy corto.'] },
            hostil: { medida: 'la bronca con Japón', relaciones: { japon: -16, eeuu: -3 }, efectos: { ejercito: 3, felicidad: 1 },
              textos: ['{paredes} lee en televisión un comunicado de nueve páginas contra los "enanos imperialistas". Al terminar, la gente aplaude porque por fin se ha terminado.', 'Exiges a Japón reparaciones por la ocupación, un siglo de intereses y un perrito que se llevó un soldado en 1938. Tokio no contesta. El perrito tampoco.'] }
          }
        }
      },

      economia: {
        ingresos: 24,          // lo que recaudaría el Estado cada turno si nada se escapara por el mercado negro
        gastos: 20,            // sueldos, raciones y servicios del Estado cada turno
        costeSancion: 1.5,     // millones por turno que cuesta cada nivel de sanciones (0-4)
        // Sin crédito exterior: el déficit no se acumula como deuda, se imprime (parte cada turno).
        sinCredito: true,
        // Las reservas grandes atraen manos: la élite y la caja personal del Líder se llevan una parte.
        cajaLider: { nombre: 'la Oficina 39', umbral: 150, fuga: 0.08 },
        // Sin crédito no se puede deber más de esto: lo que falte se queda sin pagar (sueldos, raciones).
        suelo: -200,
        // Con el tiempo, las redes de contrabando aprenden a esquivar las sanciones (hasta este tanto por uno).
        adaptacionSanciones: 0.5,
        // Un padrino que no deja caer al régimen, y lo que cobra por cada rescate.
        padrino: { pais: 'china', estabilidad: 20, relacionMinima: 5, espera: 8, ayuda: { dinero: 15, felicidad: 3, estabilidad: 4, inflacion: -2 }, precioPorTurno: 0.8 },
        socio: 'China',        // de quien depende casi todo el comercio
        exporta: ['carbón y minerales (prohibidos por la ONU: salen de contrabando, de barco a barco)', 'textiles', 'marisco', 'trabajadores enviados al extranjero', 'ciberrobos de criptomonedas'],
        importa: ['petróleo', 'arroz y harina', 'maquinaria', 'lujos para la élite']
      },

      conceptos: {
        sanciones: 'Sanciones de la ONU (nivel 0-4): prohíben vender carbón, textiles y marisco, y limitan el petróleo. Cada nivel cuesta divisas cada turno y amarga a la élite, que se queda sin lujos importados. Los misiles y las bombas las suben; la diplomacia y el desarme las bajan.',
        mercadoNegro: 'El jangmadang (% de la economía que va por el mercado): desde la hambruna de los noventa, la gente sobrevive comprando y vendiendo en mercados medio tolerados. Cuanto más grande, mejor aguanta la población y más cobran en sobornos los cuadros, pero menos recauda el Estado. Legalizarlo lo convierte en impuestos; perseguirlo trae hambre.',
        raciones: 'El Sistema Público de Distribución: raciones del Estado que llegan tarde, incompletas o nunca, salvo en Pionyang.',
        songbun: 'El songbun: la casta política heredada. Decide dónde vives, qué estudias y si puedes vivir en Pionyang.',
        inminban: 'Las unidades populares (inminban): cada veinte o treinta familias tienen una jefa que vigila e informa.',
        donju: 'Los donju: los nuevos ricos del mercado, con coche y teléfono extranjero, que prestan dinero y construyen pisos.',
        campos: 'Los campos de prisioneros políticos (kwanliso) y el castigo a tres generaciones de una familia.',
        songun: 'El songun: el ejército primero. El ejército come antes que nadie y es el único que puede dar un golpe.',
        propaganda: 'Altavoces en cada barrio, retratos obligatorios en cada casa, el Rodong Sinmun y la radio con un solo dial.',
        fuga: 'Los desertores cruzan el río Tumen o el Yalu hacia China; las memorias USB con series del Sur entran por el mismo camino.'
      },

      // Lo que la IA (Consejo de Estado y cronista) tiene que saber de este país, en sus palabras.
      ia: {
        consejo: 'Eres el Consejo de Estado de "Consola de Pionyang", un juego satírico de gobierno. El jugador es el Líder Supremo de Corea del Norte (la República Popular Democrática de Corea): acaba de heredar el poder de su padre y gobierna escribiendo decretos en lenguaje libre. Es sátira: no nombres a ningún líder real; habla de "tu padre" y de "tu abuelo, el Presidente Eterno".',
        dinero: '- dinero = DIVISAS: millones de dólares en las arcas. Cada turno el motor ya cobra impuestos (menos lo que se escapa por el mercado negro), paga sueldos y resta las sanciones: sin buscar divisas, el país se arruina. Nadie presta al país: el déficit se tapa imprimiendo (inflación) y por debajo de -200 se dejan de pagar sueldos. Por encima de 150, la Oficina 39 (la caja del Líder) se lleva una parte. Con el tiempo el contrabando esquiva parte de las sanciones. Si la estabilidad se hunde, China rescata al régimen a cambio de minas y puertos.',
        diplomacia: 'DIPLOMACIA (campo "relaciones" de la ficha, opcional): cambios en la relación (0-100) con las potencias vecinas, de -25 a +25 cada una: {"eeuu": ..., "china": ..., "surcorea": ..., "japon": ...}. Lo que quiere y teme cada una viene en "diplomacia". Sé coherente con sus intereses: China quiere estabilidad y odia las pruebas que atraen barcos americanos; Estados Unidos quiere desnuclearización y castiga los misiles con sanciones; el Sur premia los gestos de acercamiento y teme la artillería; Japón exige a los secuestrados y odia los misiles sobre su territorio. Cada turno el motor aplica sus consecuencias: China da comercio y, si se enfada, corta el petróleo; Estados Unidos sube o baja las sanciones; el Sur manda ayuda. Si el decreto desmantela o reconstruye el arsenal nuclear, pon "arsenal": false o true.',
        economia: 'ECONOMÍA (campo "economia" de la ficha, opcional): {"sanciones": de -2 a +2 (cambia el nivel de sanciones, 0-4), "mercado_negro": de -40 a +40 (puntos del % de economía que va por el jangmadang)}. Los misiles y la bomba suben sanciones; la diplomacia y el desarme las bajan; legalizar mercados reduce el mercado negro (pasa a pagar impuestos); perseguirlo también lo reduce pero trae hambre.',
        cronista: 'Eres el cronista de "Consola de Pionyang", un juego satírico en el que el jugador es el Líder Supremo de Corea del Norte: acaba de heredar el poder de su padre y gobierna escribiendo decretos. Es sátira: no nombres a ningún líder real; habla de "tu padre" y de "tu abuelo, el Presidente Eterno".',
        tratamiento: '- Segunda persona: te diriges al gobernante ("tú"). Le llaman "el Líder Supremo" o "el Mariscal" (o "Su Majestad" si es monarquía).',
        mundo: [
        'El mundo: Corea del Norte, aislada y bajo sanciones. Pionyang es el escaparate; en el campo hay apagones y hambre. Casi todo el mundo sobrevive gracias al jangmadang, el mercado negro. Altavoces en cada barrio, retratos de la dinastía en cada casa. China compra el carbón. El barrio obrero que aparece a menudo es Sadong.',
        'Los indicadores: DIVISAS (dinero), INFLACIÓN, ESTABILIDAD; y el ánimo de tres sectores: EJÉRCITO, PALACIO (el Partido y la élite) y POBLACIÓN.',
        'La gente de a pie: la abuela Sun-ja (67 años, vende tortitas de maíz en el mercado negro, sobrevivió a la hambruna), su nieto Chol-su (19, universitario, escucha K-pop del Sur a escondidas en una memoria USB), Kwang-ho (45, taxista de Pionyang, opina de todo pero solo dentro del taxi) y Eun-hee (34, enfermera del Hospital Central con dos hijos).',
        'Fuera: China (el único aliado, que quiere estabilidad), Estados Unidos (quiere que desmanteles la bomba), Corea del Sur y Japón. Si algo de diplomacia pasa en el turno, puede aparecer en PALACIO (la ministra de Exteriores) o en la RADIO.',
        'Song Dae-ho dirige una red clandestina de memorias USB. El embajador sueco vigila con cara de preocupación. Medios: el Rodong Sinmun (oficial), Radio Pionyang (oficial) y Radio Libertad (desde el Sur, a escondidas).'
        ]
      },
      contexto: [
        'Corea del Norte real: régimen hereditario desde 1948, aislado, bajo sanciones de la ONU por sus pruebas nucleares y de misiles. Casi todo su comercio (más del 90%) es con China.',
        'Economía: el Estado ya no alimenta a todo el mundo desde la hambruna de los noventa (la "Ardua Marcha"). La gente vive del jangmadang, el mercado medio tolerado; los donju se enriquecen; los cuadros cobran sobornos. Hay apagones, escasez de petróleo y el won se desploma si se imprime. En 2009 una reforma monetaria arruinó los ahorros de la gente y provocó protestas.',
        'Divisas: entran por el contrabando de carbón de barco a barco, los trabajadores enviados a China y Rusia, el turismo chino, la venta de armas y los ciberrobos. Cada misil trae más sanciones.',
        'Sociedad: songbun (casta política), inminban (vigilancia vecinal), sesiones de autocrítica, trabajo obligatorio en el campo, servicio militar de diez años, campos de prisioneros políticos, castigo a la familia, desertores por el río hacia China, series del Sur en memorias USB.',
        'Diplomacia: China es su salvavidas (comercio, petróleo) pero quiere estabilidad y detesta las pruebas que atraen barcos americanos. Estados Unidos ofrece levantar sanciones a cambio de desnuclearizar, sin fiarse. Corea del Sur alterna la mano tendida (reencuentros familiares, la zona industrial de Kaesong) con la tensión en la frontera. Japón exige la vuelta de los ciudadanos secuestrados en los años 70 y 80 y sufre los misiles que sobrevuelan su territorio.',
        'Poder: el ejército (songun) y el Partido son los dos pilares. Si el ejército se enfada, hay golpe; si la élite se siente traicionada, hay conspiración en Palacio; si la población no aguanta, hay revuelta, aunque sea lo más difícil de todo en Corea del Norte.'
      ]
    }
  };

  RF.PAIS = RF.PAISES.corea;
})(globalThis.RF = globalThis.RF || {});
