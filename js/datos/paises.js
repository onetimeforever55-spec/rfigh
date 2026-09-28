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

      // El ánimo de cada sector (0-100) empuja la estabilidad cada turno. Si uno llega a 0, se acabó.
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
        economia: { sanciones: 2, mercadoNegro: 60 }
      },

      economia: {
        ingresos: 24,          // lo que recaudaría el Estado cada turno si nada se escapara por el mercado negro
        gastos: 20,            // sueldos, raciones y servicios del Estado cada turno
        costeSancion: 1.5,     // millones por turno que cuesta cada nivel de sanciones (0-4)
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

      contexto: [
        'Corea del Norte real: régimen hereditario desde 1948, aislado, bajo sanciones de la ONU por sus pruebas nucleares y de misiles. Casi todo su comercio (más del 90%) es con China.',
        'Economía: el Estado ya no alimenta a todo el mundo desde la hambruna de los noventa (la "Ardua Marcha"). La gente vive del jangmadang, el mercado medio tolerado; los donju se enriquecen; los cuadros cobran sobornos. Hay apagones, escasez de petróleo y el won se desploma si se imprime. En 2009 una reforma monetaria arruinó los ahorros de la gente y provocó protestas.',
        'Divisas: entran por el contrabando de carbón de barco a barco, los trabajadores enviados a China y Rusia, el turismo chino, la venta de armas y los ciberrobos. Cada misil trae más sanciones.',
        'Sociedad: songbun (casta política), inminban (vigilancia vecinal), sesiones de autocrítica, trabajo obligatorio en el campo, servicio militar de diez años, campos de prisioneros políticos, castigo a la familia, desertores por el río hacia China, series del Sur en memorias USB.',
        'Poder: el ejército (songun) y el Partido son los dos pilares. Si el ejército se enfada, hay golpe; si la élite se siente traicionada, hay conspiración en Palacio; si la población no aguanta, hay revuelta, aunque sea lo más difícil de todo en Corea del Norte.'
      ]
    }
  };

  RF.PAIS = RF.PAISES.corea;
})(globalThis.RF = globalThis.RF || {});
