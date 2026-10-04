/*
 * GÉNESIS · LOS DATOS DEL MUNDO
 * Las eras de la historia humana real, sus inventos, el carácter de los pueblos, cómo se nombran
 * y la biblioteca de porqués: mecanismos reales con su precedente histórico, para que la crónica
 * explique cada cosa que pasa en el mundo.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO = RF.MUNDO || {};

  // Cada era: cuántos años dura un turno cuando el pueblo más avanzado está en ella, cuánta gente
  // alimenta cada casilla (cap), cuánto pesa en la guerra (fuerza) y cuánta ciencia hace falta para llegar.
  M.ERAS = [
    { nombre: 'Neolítico', con: 'el Neolítico', corto: 'NEOLÍTICO', anios: 100, cap: 1.0, fuerza: 1.0, umbral: 0, inventos: ['la agricultura', 'la cerámica', 'el arado de madera'] },
    { nombre: 'Edad del Bronce', con: 'la Edad del Bronce', corto: 'BRONCE', anios: 100, cap: 1.35, fuerza: 1.4, umbral: 15, inventos: ['la escritura', 'la rueda', 'el bronce', 'el calendario'] },
    { nombre: 'Edad del Hierro', con: 'la Edad del Hierro', corto: 'HIERRO', anios: 50, cap: 1.7, fuerza: 2.0, umbral: 105, inventos: ['el hierro', 'el alfabeto', 'la moneda'] },
    { nombre: 'Antigüedad clásica', con: 'la Antigüedad clásica', corto: 'CLÁSICA', anios: 50, cap: 2.0, fuerza: 2.6, umbral: 235, inventos: ['la filosofía', 'el acueducto', 'el derecho escrito', 'el hormigón'] },
    { nombre: 'Edad Media', con: 'la Edad Media', corto: 'MEDIEVAL', anios: 50, cap: 2.3, fuerza: 3.2, umbral: 610, inventos: ['el molino de agua', 'la brújula', 'la universidad', 'el estribo'] },
    { nombre: 'Renacimiento', con: 'el Renacimiento', corto: 'RENACIMIENTO', anios: 25, cap: 3.0, fuerza: 5.0, umbral: 1060, inventos: ['la imprenta', 'la pólvora', 'la banca', 'la carabela'] },
    { nombre: 'Revolución Industrial', con: 'la Revolución Industrial', corto: 'INDUSTRIAL', anios: 15, cap: 5.0, fuerza: 9.0, umbral: 1510, inventos: ['la máquina de vapor', 'el ferrocarril', 'la fábrica'] },
    { nombre: 'Era Moderna', con: 'la Era Moderna', corto: 'MODERNA', anios: 8, cap: 8.0, fuerza: 16, umbral: 1600, inventos: ['la electricidad', 'las vacunas', 'la radio', 'el avión'] },
    { nombre: 'Era Atómica', con: 'la Era Atómica', corto: 'ATÓMICA', anios: 4, cap: 12, fuerza: 30, umbral: 1720, inventos: ['la bomba atómica', 'el ordenador', 'los satélites'] }
  ];

  // Lo que un dios puede regalar, y a qué era pertenece (para "que descubran la imprenta").
  M.INVENTOS = [
    [/agricultura|sembrar|cultivar/, 0, 'la agricultura'], [/ceramica|vasijas/, 0, 'la cerámica'],
    [/escritura|escribir/, 1, 'la escritura'], [/\brueda\b/, 1, 'la rueda'], [/bronce/, 1, 'el bronce'], [/calendario/, 1, 'el calendario'],
    [/hierro/, 2, 'el hierro'], [/alfabeto/, 2, 'el alfabeto'], [/moneda|dinero/, 2, 'la moneda'],
    [/filosofia/, 3, 'la filosofía'], [/acueducto/, 3, 'el acueducto'], [/derecho|leyes escritas/, 3, 'el derecho escrito'], [/hormigon|cemento/, 3, 'el hormigón'],
    [/molino/, 4, 'el molino de agua'], [/brujula/, 4, 'la brújula'], [/universidad/, 4, 'la universidad'], [/estribo/, 4, 'el estribo'],
    [/imprenta|libros/, 5, 'la imprenta'], [/polvora|canon/, 5, 'la pólvora'], [/banca|bancos/, 5, 'la banca'], [/carabela|barcos/, 5, 'la carabela'],
    [/vapor/, 6, 'la máquina de vapor'], [/ferrocarril|tren/, 6, 'el ferrocarril'], [/fabrica/, 6, 'la fábrica'],
    [/electricidad|luz electrica/, 7, 'la electricidad'], [/vacuna/, 7, 'las vacunas'], [/radio/, 7, 'la radio'], [/avion/, 7, 'el avión'], [/penicilina|antibiotico/, 7, 'la penicilina'],
    [/bomba atomica|bomba nuclear|arma nuclear|atomica/, 8, 'la bomba atómica'], [/ordenador|computadora/, 8, 'el ordenador'], [/satelite/, 8, 'los satélites'], [/internet/, 8, 'internet']
  ];

  // El carácter de cada pueblo cambia cómo decide: cuánto guerrea, cuánta ciencia hace, cuánto comercia.
  M.CARACTERES = {
    guerrero: { nombre: 'guerrero', agresion: 1.7, ciencia: 0.9, comercio: 0.8, estab: 0 },
    mercader: { nombre: 'mercader', agresion: 0.6, ciencia: 1.05, comercio: 1.7, estab: 0 },
    devoto: { nombre: 'devoto', agresion: 1.0, ciencia: 0.85, comercio: 1.0, estab: 6 },
    sabio: { nombre: 'sabio', agresion: 0.7, ciencia: 1.4, comercio: 1.1, estab: 0 }
  };

  M.COLORES = ['#e5533d', '#4f86e8', '#e8b13b', '#45b86a', '#a65fe0', '#e8823b', '#3cc6c6', '#e0559b', '#9bc93f', '#8a93e8', '#c9a16b', '#5fd1a0'];

  // Nombres inventados para los pueblos ("Karenia", "Tolmedor"...).
  M.SILABAS = {
    inicio: ['Ak', 'Bel', 'Cor', 'Dra', 'Esh', 'Far', 'Gal', 'Hel', 'Ish', 'Kar', 'Lum', 'Mar', 'Nor', 'Ost', 'Pel', 'Qan', 'Ras', 'Sar', 'Tal', 'Ur', 'Val', 'Xan', 'Yar', 'Zor', 'Tum', 'Ib', 'Ol', 'Sen', 'Mez', 'Ka', 'Tol', 'Ner', 'Ab', 'Ilu'],
    medio: ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'il', 'or', 'an', 'ur', 'es'],
    fin: ['ria', 'nia', 'dor', 'tan', 'ka', 'mia', 'lia', 'sis', 'ra', 'gon', 'thos', 'mar', 'shan', 'via', 'ta', 'kum', 'lan']
  };

  /*
   * LOS PORQUÉS DEL MUNDO: por cada tipo de suceso, mecanismos reales con su precedente histórico.
   * La crónica elige uno al azar para explicar lo que acaba de pasar.
   */
  M.PORQUES = {
    fundacion: [['Donde hay agua y tierra blanda, hay pueblos: las primeras civilizaciones nacieron junto a ríos.', 'Sumer, Egipto, el Indo y el río Amarillo crecieron, todos, junto a un río.']],
    expansion: [['Cuando la tierra da más comida de la que se come, sobran brazos para ir más lejos.', 'Los pueblos bantúes se extendieron por media África llevando la agricultura y el hierro.'], ['Cada casilla nueva es más comida, pero también más frontera que defender.', 'El Imperio romano llegó tan lejos que acabó construyendo muros: el de Adriano tiene 117 kilómetros.']],
    era: [['Los inventos se acumulan: cada uno hace posible el siguiente.', 'Sin la escritura no hay leyes escritas; sin leyes escritas no hay imperios.']],
    era_1: [['El bronce necesita cobre y estaño, que casi nunca están juntos: obliga a comerciar lejos.', 'Las rutas del estaño unían Cornualles con el Mediterráneo hace 4.000 años.'], ['La escritura se inventó para contar sacos de grano: los primeros textos son facturas.', 'Las tablillas de Uruk (3.200 a. C.) son, sobre todo, cuentas de cebada.']],
    era_2: [['El hierro abunda en casi todas partes: armas baratas para todos, y los reyes pierden el monopolio de la guerra.', 'Hacia 1177 a. C. se hundieron casi todos los reinos del bronce del Mediterráneo; los que llegaron después tenían hierro.']],
    era_3: [['Con ciudades grandes y gente que no tiene que cultivar, aparecen los filósofos y los ingenieros.', 'Atenas tuvo a Sócrates porque tenía esclavos y excedentes; Roma tuvo acueductos porque tenía legiones de ingenieros.']],
    era_4: [['Tras la caída de los grandes imperios, el poder se reparte entre señores y monasterios que guardan el saber.', 'Tras la caída de Roma, en Europa los libros sobrevivieron en los monasterios y en Bagdad se tradujo a Aristóteles.']],
    era_5: [['La imprenta abarata los libros: las ideas se copian más rápido de lo que se pueden prohibir.', 'Gutenberg imprimió su Biblia hacia 1455; en 1517, las tesis de Lutero corrieron por Europa en semanas.'], ['La pólvora vuelve inútiles los castillos: gana quien puede pagar cañones.', 'En 1453 los cañones otomanos abrieron las murallas de Constantinopla, que aguantaban desde hacía mil años.']],
    era_6: [['Una máquina hace el trabajo de cien hombres: la riqueza deja de ser la tierra y pasa a ser la fábrica.', 'Manchester pasó de pueblo a ciudad de 300.000 habitantes en sesenta años gracias al algodón y al vapor.']],
    era_7: [['La electricidad y la medicina alargan la vida: la población se dispara.', 'La humanidad tardó hasta 1804 en llegar a mil millones; en 1927 ya eran dos mil.']],
    era_8: [['Con la bomba atómica, la guerra total deja de tener ganador.', 'Tras Hiroshima y Nagasaki (1945), las potencias nucleares no han vuelto a enfrentarse directamente.']],
    hambruna: [['Si la población crece más deprisa que la comida, el hambre la recorta: es la trampa maltusiana.', 'Malthus lo escribió en 1798. La Gran Hambruna europea de 1315 mató a uno de cada diez.']],
    guerra: [['Las guerras empiezan por fronteras y recursos, y acaban por agotamiento.', 'La guerra de los Cien Años duró 116: se acabó cuando ninguno de los dos podía pagar otra campaña.'], ['El vecino fuerte con un vecino débil siempre encuentra un motivo.', 'Tucídides lo resumió en Melos: "los fuertes hacen lo que pueden y los débiles sufren lo que deben".']],
    conquista: [['Quien tiene mejor técnica puede vencer a muchos más: el acero contra la piedra, el cañón contra la lanza.', 'Pizarro tomó el imperio inca en 1532 con 168 hombres, caballos, acero y la viruela.'], ['Conquistar es fácil; gobernar lo conquistado es lo difícil.', 'Alejandro conquistó de Grecia a la India en once años; su imperio se partió al día siguiente de su muerte.']],
    caida: [['Ningún imperio es eterno: se hunden por dentro antes de que los derriben por fuera.', 'Roma tardó siglos en caer; en 476 el último emperador de Occidente fue depuesto casi sin ruido.']],
    revuelta: [['Cuanto más grande el reino, más lejos queda la capital de sus fronteras: las provincias dejan de obedecer.', 'El Imperio romano se dividió en dos en 395; el califato abasí acabó partido en reinos que solo le rezaban de nombre.']],
    plaga: [['Las pestes viajan con los mercaderes: cuanto más comercio, más contagio.', 'La Peste Negra llegó a Europa en 1347 en barcos genoveses desde Crimea y mató a un tercio de la población.']],
    paz: [['Las paces las firma el agotamiento más que la bondad.', 'La paz de Westfalia (1648) llegó tras treinta años de guerra que vaciaron media Alemania.']],
    comercio: [['Las ideas viajan con las mercancías: los vecinos que comercian aprenden unos de otros.', 'Por la Ruta de la Seda llegaron a Occidente el papel, la seda y, más tarde, la pólvora.']],
    revolucion: [['Hambre, impuestos e ideas nuevas: cuando se juntan las tres, cae el régimen.', 'En 1789 Francia tenía las tres: pan carísimo, un Estado en bancarrota y una imprenta llena de panfletos.']],
    unificacion: [['Unificar da un mercado grande y un solo ejército, pero borra mil costumbres locales.', 'Qin unificó China en 221 a. C.: un solo idioma escrito, una sola medida, una sola moneda... y una dinastía que duró quince años.']],
    republica: [['Cuando los ricos de la ciudad pueden más que el rey, el rey sobra.', 'Roma expulsó a su último rey en 509 a. C. y estuvo casi cinco siglos sin otro.']],
    oro: [['Mucho oro de golpe no hace rico a un pueblo: sube los precios.', 'El oro y la plata de América trajeron a España la "revolución de los precios" del siglo XVI y varias bancarrotas.']],
    terremoto: [['Un desastre natural sacude también las creencias.', 'El terremoto de Lisboa de 1755 destruyó la ciudad un día de Todos los Santos y puso a media Europa a discutir si Dios existía.']],
    diluvio: [['Las crecidas destruyen, pero dejan tierra fértil.', 'Egipto vivió milenios de las crecidas del Nilo, que cada verano dejaban limo sobre los campos.']],
    locura: [['En una monarquía, la salud del rey es la salud del Estado.', 'Carlos VI de Francia creía ser de cristal y no dejaba que nadie lo tocara; Francia perdió media guerra de los Cien Años mientras tanto.']],
    profeta: [['Una fe nueva puede unir a pueblos dispersos y lanzarlos más allá de sus fronteras.', 'El islam pasó de Arabia a Hispania y a la India en menos de un siglo.']],
    anacronismo: [['Un invento sin la sociedad que lo aproveche se queda en curiosidad.', 'Herón de Alejandría construyó una máquina de vapor en el siglo I. Se usó como juguete en los templos.']],
    nuevo_pueblo: [['Los pueblos de las estepas y los desiertos aparecen de pronto en la historia y la cambian.', 'Los mongoles de Gengis Kan pasaron de tribus enfrentadas a dominar de Corea a Hungría en cincuenta años.']],
    abundancia: [['Las buenas cosechas llenan los graneros y las cunas.', 'La patata y el maíz de América duplicaron la población de muchos países de Europa y de China en dos siglos.']],
    destruccion: [['Algunas civilizaciones desaparecen de golpe y dejan solo ruinas.', 'La erupción del Vesubio en el año 79 sepultó Pompeya en un día; la de Tera, siglos antes, quizá acabó con la Creta minoica.']],
    deforestacion: [['Un pueblo que crece tala para sembrar, construir y calentarse; si tala más deprisa de lo que el bosque crece, un día se queda sin madera.', 'En la isla de Pascua talaron hasta la última palmera: sin troncos no hubo más canoas ni más moáis.'], ['Sin bosques no hay barcos ni casas: la madera fue el petróleo de la Edad Media.', 'Inglaterra taló tanto que en el siglo XVII tuvo que pasarse al carbón, y del carbón salió la máquina de vapor.']],
    incendio: [['El fuego limpia el bosque, pero se lleva también las casas y la cosecha.', 'El gran incendio de Roma del año 64 ardió seis días; Nerón culpó a los cristianos.']],
    reforestacion: [['Donde se deja de talar, el bosque vuelve antes de lo que parece.', 'Tras la Peste Negra, media Europa quedó vacía y los bosques recuperaron los campos abandonados en pocas décadas.']],
    tala: [['La madera es riqueza inmediata; el bosque perdido, una deuda que pagan los nietos.', 'Los venecianos talaron los bosques de Dalmacia para sus galeras; la costa todavía está pelada.']],
    dictadura: [['En tiempos de crisis, la gente cambia libertad por orden.', 'La República de Weimar, con la hiperinflación y el paro, acabó en manos de un dictador en 1933.']]
  };

  // Regímenes posibles y cómo se nombran.
  // Con artículo: "la república", "el imperio".
  const FEMENINOS = new Set(['tribu', 'jefatura', 'republica', 'teocracia', 'democracia', 'dictadura', 'estado_obrero']);
  M.conArticulo = r => (FEMENINOS.has(r) ? 'la ' : 'el ') + M.REGIMENES[r];
  M.unoDe = r => (FEMENINOS.has(r) ? 'una ' : 'un ') + M.REGIMENES[r];
  M.REGIMENES = {
    tribu: 'tribu', jefatura: 'jefatura', reino: 'reino', imperio: 'imperio', republica: 'república', teocracia: 'teocracia',
    democracia: 'democracia', dictadura: 'dictadura', estado_obrero: 'república popular'
  };
})(globalThis.RF = globalThis.RF || {});
