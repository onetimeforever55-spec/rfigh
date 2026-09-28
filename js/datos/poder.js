/*
 * PODER: instituciones del régimen y personas sobre las que puedes decretar.
 */
(function (RF) {
  'use strict';

  /*
   * INSTITUCIONES: se crean con un decreto ("crear una escuadra de represión") y actúan cada día.
   *   crear     efectos al fundarla
   *   diario    efectos cada día (pueden ser decimales: se acumulan)
   *   coste     cuánto cuesta cada día (se descuenta de los ingresos)
   *   disolver  efectos al disolverla
   */
  RF.INSTITUCIONES = {
    ESCUADRON: {
      nombre: 'el Escuadrón de Orden Patriótico', corto: 'el Escuadrón', coste: 2,
      crear: { orden: 7, pueblo: -7, mundo: -8, ejercito: -4 },
      diario: { orden: 1.5, pueblo: -1, mundo: -0.7 },
      disolver: { pueblo: 4, mundo: 5, orden: -5 },
      texto: 'Hombres sin placa, con pasamontañas y camionetas sin matrícula. Solo responden ante ti. Su lema, pintado en las camionetas: "El orden no pide permiso".',
      diarioTexto: 'El Escuadrón patrulla de noche. Menos delitos, más miedo, y cada semana algún desaparecido.'
    },
    MILICIA: {
      nombre: 'las Milicias Populares', corto: 'las Milicias', coste: 1,
      crear: { orden: 3, pueblo: 2, ejercito: -9 },
      diario: { orden: 0.8, ejercito: -0.7, pueblo: 0.3 },
      disolver: { ejercito: 5, orden: -3 },
      texto: 'Se reparten fusiles viejos y brazaletes a voluntarios de los barrios. {garrote} mira la escena desde su coche, con los labios apretados.',
      diarioTexto: 'Las Milicias vigilan los barrios. El ejército no soporta compartir las armas.'
    },
    ESPIAS: {
      nombre: 'la Dirección de Inteligencia', corto: 'la Inteligencia', coste: 1,
      crear: { orden: 3, pueblo: -2, mundo: -2 },
      diario: { orden: 0.6, pueblo: -0.3 },
      disolver: { pueblo: 2, orden: -2 },
      texto: 'En cada edificio hay ahora un vecino que toma notas. Nadie sabe quién es. Todo el mundo sospecha del portero.',
      diarioTexto: 'Los informes de Inteligencia llegan cada mañana: quién habla, quién calla, quién conspira.',
      vigila: true
    },
    PARTIDO: {
      nombre: 'el Partido de la Patria', corto: 'el Partido', coste: 1,
      crear: { cupula: 6, pueblo: -2, mundo: -5 },
      diario: { cupula: 0.6, pueblo: 0.4, mundo: -0.4 },
      disolver: { cupula: -6, mundo: 4 },
      texto: 'Nace el Partido de la Patria. Tener el carnet ayuda a conseguir trabajo, piso y mesa en los buenos restaurantes. Las afiliaciones se disparan.',
      diarioTexto: 'El Partido reparte favores y carnets. Quien está dentro, prospera.'
    },
    PROPAGANDA: {
      nombre: 'el Ministerio de la Verdad', corto: 'el Ministerio de la Verdad', coste: 1,
      crear: { pueblo: 3, mundo: -4 },
      diario: { pueblo: 0.6, mundo: -0.3 },
      disolver: { pueblo: -2, mundo: 3 },
      texto: 'El nuevo Ministerio de la Verdad ocupa un edificio de doce plantas. Su primera nota de prensa anuncia que todo va muy bien. La segunda, que va aún mejor.',
      diarioTexto: 'El Ministerio de la Verdad inunda radios, pantallas y redes con buenas noticias.'
    }
  };

  /*
   * PERSONAS: ministros, gente de a pie, el líder de la oposición y el embajador.
   * "claves" son las palabras con las que el jugador puede nombrarlos.
   */
  RF.PERSONAS = {
    garrote: { tipo: 'ministro', stat: 'ejercito', claves: ['el mariscal', 'al mariscal', 'del mariscal', 'el general', 'al general', 'ministro de defensa', 'jefe del ejercito', 'mariscal jang', 'jang', 'tae bok'] },
    cifuentes: { tipo: 'ministro', stat: 'cupula', claves: ['ministra de finanzas', 'ministro de finanzas', 'ministra de hacienda', 'ministro de hacienda', 'pak mi ran', 'pak'] },
    sombra: { tipo: 'ministro', stat: 'orden', claves: ['ministro de seguridad del estado', 'ministro de seguridad', 'jefe de seguridad', 'ministro del interior', 'ryu chang sok', 'ryu'] },
    paredes: { tipo: 'ministro', stat: 'pueblo', claves: ['jefe de propaganda', 'propagandista', 'kang myong dal', 'kang'] },
    montiel: { tipo: 'ministro', stat: 'mundo', claves: ['ministra de exteriores', 'ministro de exteriores', 'canciller', 'ri song mi'] },
    ventura: { tipo: 'ministro', stat: 'salud', claves: ['ministro de salud', 'ministra de salud', 'yun jae hyon', 'yun'] },
    carmen: { tipo: 'ciudadano', oa: 'a', claves: ['abuela sun ja', 'la abuela', 'sun ja', 'sunja', 'la vendedora de tortitas', 'la de las tortitas'] },
    nico: { tipo: 'ciudadano', oa: 'o', claves: ['chol su', 'cholsu', 'el nieto de la abuela', 'nieto de sun ja', 'el estudiante'] },
    ramiro: { tipo: 'ciudadano', oa: 'o', claves: ['kwang ho', 'kwangho', 'el taxista'] },
    lucia: { tipo: 'ciudadano', oa: 'a', claves: ['eun hee', 'eunhee', 'la enfermera'] },
    valiente: { tipo: 'opositor', oa: 'o', nombre: 'Song Dae-ho', claves: ['lider de la resistencia', 'lider de la oposicion', 'jefe de la oposicion', 'lider opositor', 'el disidente', 'los disidentes', 'song dae ho', 'dae ho'] },
    embajador: { tipo: 'extranjero', oa: 'o', nombre: 'el embajador sueco', claves: ['el embajador sueco', 'el embajador', 'embajador', 'embajadora', 'la embajada'] }
  };

  // Quién ocupa el cargo cuando un ministro cae.
  RF.SUCESORES = {
    garrote: [{ nombre: 'General Oh Kum-chol', corto: 'Oh' }, { nombre: 'General Ri Yong-ho', corto: 'Ri Yong-ho' }, { nombre: 'General Kim Song-dok', corto: 'Kim Song-dok' }],
    cifuentes: [{ nombre: 'Jon Kwang-ok', corto: 'Jon' }, { nombre: 'So Hyon-ju', corto: 'So' }, { nombre: 'Paek Nam-chun', corto: 'Paek' }],
    sombra: [{ nombre: 'Kim Yong-sam', corto: 'Kim Yong-sam' }, { nombre: 'Hwang Mi-ok', corto: 'Hwang' }, { nombre: 'Coronel "El Tigre" Mun', corto: 'Mun' }],
    paredes: [{ nombre: 'Cha Sun-ok', corto: 'Cha' }, { nombre: 'Tak Il-bong', corto: 'Tak' }, { nombre: 'No Chang-su', corto: 'No Chang-su' }],
    montiel: [{ nombre: 'Kye Hyon-sil', corto: 'Kye' }, { nombre: 'Om Tae-won', corto: 'Om' }, { nombre: 'Sin Hye-gyong', corto: 'Sin Hye-gyong' }],
    ventura: [{ nombre: 'Dra. Ko Un-sil', corto: 'Ko' }, { nombre: 'Dr. Ma Chol-gun', corto: 'Ma' }, { nombre: 'Dra. Yang Sun-hwa', corto: 'Yang' }]
  };

  /*
   * TRATOS: qué puedes hacer con una persona.
   * Se detectan por palabras en el decreto (orden de prioridad de arriba abajo).
   */
  RF.TRATOS = [
    { id: 'matar', nombre: 'Eliminar', re: /\b(mat|maten|asesin|ejecut|fusil|elimin|liquid|paredon|muerte|envenen|desapare|mueran?|cargar|degoll|ahorc)/ },
    { id: 'encarcelar', nombre: 'Encarcelar', re: /\b(encarcel|arrest|deten|preso|presa|carcel|encerr|encan|captur|secuestr)/ },
    { id: 'exiliar', nombre: 'Exiliar', re: /\b(exili|desterr|deport|expuls|echar del pais|echarl)/ },
    { id: 'destituir', nombre: 'Destituir', re: /\b(destitu|despid|ech|ces|renunci|quit|fuera|jubil|reemplaz|sustitu)/ },
    { id: 'liberar', nombre: 'Liberar', re: /\b(liber|indult|solt|perdon|amnist|sacar de la carcel)/ },
    { id: 'premiar', nombre: 'Premiar', re: /\b(premi|ascend|medall|homenaj|felicit|recompens|condecor|aument|regal|ministerio|nombrar)/ }
  ];

  // Efectos de cada trato según el tipo de persona. En ministros, "stat" es la estadística que vigila.
  RF.EFECTOS_TRATO = {
    ministro: {
      matar: { stat: -22, orden: 4, cupula: -8, mundo: -8, pueblo: -2 },
      encarcelar: { stat: -14, cupula: -5, mundo: -4, orden: 2 },
      exiliar: { stat: -9, cupula: -3, mundo: -2 },
      destituir: { stat: -7, cupula: -2 },
      premiar: { stat: 9, tesoro: -4 },
      liberar: { stat: 4, mundo: 2 }
    },
    ciudadano: {
      matar: { pueblo: -8, mundo: -5, orden: 1 },
      encarcelar: { pueblo: -4, mundo: -2, orden: 2 },
      exiliar: { pueblo: -3, mundo: -2 },
      destituir: { pueblo: -1 },
      premiar: { pueblo: 2, tesoro: -2 },
      liberar: { pueblo: 3, orden: -1 }
    },
    opositor: {
      matar: ['Song Dae-ho, el líder de la red clandestina que reparte memorias USB con películas del Sur, aparece muerto en un callejón de Sinuiju. Esa noche, en los mercados, se venden velas a escondidas y nadie pregunta para qué.'],
      encarcelar: ['Los agentes de {sombra} detienen a Song Dae-ho en una casa segura de Chongjin, con una bolsa de memorias USB y un transistor. Antes de que se lo lleven, grita: "Esto no se acaba conmigo".'],
      exiliar: ['Song Dae-ho es llevado a la frontera y empujado al otro lado del río Tumen. Desde China graba un mensaje. Al día siguiente circula en cien memorias USB.'],
      destituir: ['Declaras "elemento hostil" a la red de Song Dae-ho. Su nombre desaparece de todos los registros. En los mercados, en cambio, se pronuncia más que nunca.'],
      premiar: ['Le ofreces a Song Dae-ho un cargo en el Partido. Tras una noche sin dormir, acepta. Sus seguidores lo llaman traidor. Tus ministros, también.'],
      liberar: ['Song Dae-ho sale del campo de trabajo en los huesos. Da las gracias a todo el mundo menos a ti.']
    },
    extranjero: {
      matar: { mundo: -35, tesoro: -6, ejercito: 2 },
      encarcelar: { mundo: -22, pueblo: 2 },
      exiliar: { mundo: -8, pueblo: 3 },
      destituir: { mundo: -8, pueblo: 3 },
      premiar: { mundo: 4, cupula: 2 },
      liberar: { mundo: 8 }
    }
  };

  // Lo que se cuenta. {Nombre} = nombre de la persona, {oa} = o/a, {sucesor} = quien la reemplaza.
  RF.TEXTOS_TRATO = {
    ministro: {
      matar: [
        '{Nombre} aparece muerto en su despacho. Versión oficial: "un resbalón con una cáscara de plátano". Nadie en Palacio se atreve a mirarte a los ojos.',
        'A {nombre} lo encuentran en el fondo de la bahía, con los zapatos puestos. {paredes} lo anuncia como "un trágico accidente de pesca". El gabinete ha entendido el mensaje.'
      ],
      encarcelar: ['{Nombre} sale del Palacio esposado, delante de las cámaras. Grita que tiene documentos que te comprometen. Esa misma noche, sus documentos arden en una papelera.'],
      exiliar: ['{Nombre} recibe un billete de avión solo de ida y una maleta ya hecha. "Es por su salud," le dicen en el aeropuerto.'],
      destituir: ['{Nombre} recoge sus cosas en una caja de cartón. Se lleva también la grapadora oficial, por despecho.'],
      premiar: ['{Nombre} recibe la Gran Cruz de la Patria y un aumento de sueldo. Por primera vez en semanas, sonríe de verdad.'],
      liberar: ['{Nombre} sale de la cárcel más delgado y bastante más callado.']
    },
    ciudadano: {
      matar: {
        carmen: 'La abuela Sun-ja no abre su puesto esta mañana, ni la siguiente. En su esquina, la gente deja tortitas y velas. Cada día hay más.',
        nico: 'Chol-su no vuelve a casa. La abuela Sun-ja lo busca en comisarías, hospitales y morgues. Lo encuentra en la tercera.',
        ramiro: 'El taxi de Kwang-ho aparece quemado a las afueras de la ciudad. A mediodía, todos los taxistas de la capital tocan el claxon a la vez durante un minuto.',
        lucia: 'Eun-hee no llega a su turno en el Hospital Central. Sus compañeras cubren el hueco sin decir nada. Esa noche, todas las enfermeras llevan un lazo negro.'
      },
      encarcelar: ['Dos hombres de Seguridad del Estado se llevan a {nombre} de madrugada. En el barrio nadie duerme esa noche.', '{Nombre} es detenid{oa} "por actividades contra la patria". Nadie le explica cuáles.'],
      exiliar: ['{Nombre} es desterrad{oa} con lo puesto a una aldea de la frontera norte, lejos de la capital. Desde el camión ve su barrio hacerse pequeño.'],
      destituir: ['{Nombre} pierde su trabajo por orden directa del Palacio. Nadie le explica por qué. Todo el mundo lo sabe.'],
      premiar: ['{Nombre} recibe una medalla y una foto contigo en el Palacio. En el barrio no saben si felicitar{le} o desconfiar.'],
      liberar: ['{Nombre} sale de la cárcel. En la puerta l{oa} espera media calle, en silencio, con tortitas y lágrimas.']
    },
    opositor: {
      matar: ['Song Dae-ho recibe tres disparos a la salida de un mitin. Muere camino del hospital. Esa noche, cientos de miles de personas salen a la calle con velas.'],
      encarcelar: ['Song Dae-ho es detenido en directo, en mitad de una entrevista. Sus últimas palabras antes de que corten la señal: "Esto no se acaba conmigo".'],
      exiliar: ['Song Dae-ho es escoltado hasta la frontera. Se da la vuelta, levanta el puño y cruza. Sus seguidores lo ven por televisión.'],
      destituir: ['Ilegalizas el partido de Song Dae-ho. Él convoca una rueda de prensa en la calle, sin partido pero con más cámaras que nunca.'],
      premiar: ['Le ofreces a Song Dae-ho un ministerio. Tras una noche sin dormir, acepta. Sus seguidores lo llaman traidor. Tus ministros, también.'],
      liberar: ['Song Dae-ho sale de la cárcel entre una multitud. Da las gracias a todo el mundo menos a ti.']
    },
    extranjero: {
      matar: ['El coche del embajador sueco estalla frente a la embajada. En menos de una hora, el mundo entero sabe dónde está Corea del Norte en el mapa.'],
      encarcelar: ['La policía entra en la embajada sueca y se lleva al embajador. Es la violación diplomática más grave en años. {montiel} se desmaya.'],
      exiliar: ['Declaras persona non grata al embajador sueco. Tiene 24 horas para irse. Se va en 12, llevándose la bandera.'],
      destituir: ['Declaras persona non grata al embajador sueco. Tiene 24 horas para irse. Se va en 12, llevándose la bandera.'],
      premiar: ['Condecoras al embajador sueco con la Orden de la Bandera Nacional. Sonríe para la foto y guarda la medalla en un cajón.'],
      liberar: ['El embajador sale del calabozo y se va directo al aeropuerto. Su gobierno exige disculpas por escrito.']
    }
  };

  // Lo que se cuenta cuando se hace en secreto.
  RF.TEXTOS_SECRETO = {
    matar: [
      '{Nombre} muere en un extraño accidente de tráfico: los frenos, dicen, fallaron en la única curva peligrosa de la carretera. {paredes} lamenta "la trágica pérdida" en televisión.',
      'Encuentran a {nombre} sin vida en su casa. El informe oficial habla de "un infarto fulminante". El forense que firmó el informe se ha ido de vacaciones de forma indefinida.',
      '{Nombre} cae desde el balcón de un hotel. La policía lo archiva como accidente en menos de una hora. Demasiado rápido, piensan algunos.'
    ],
    encarcelar: [
      '{Nombre} sale de casa por la mañana y no vuelve. No hay orden de detención, ni registro, ni nada. Oficialmente, nadie sabe dónde está.',
      'Una furgoneta sin matrícula, dos hombres sin placa y ningún testigo dispuesto a hablar. {Nombre} ha desaparecido.'
    ],
    exiliar: [
      '{Nombre} recibe una visita nocturna. A la mañana siguiente su familia entera ha sido trasladada a una aldea de montaña. Oficialmente, "pidieron el traslado".'
    ]
  };

  RF.TEXTO_SUCESOR = [
    'Su puesto lo ocupa {sucesor}. En su primer día jura lealtad eterna. Todos saben cuánto duran esas cosas en Corea del Norte.',
    'Nombras a {sucesor} en su lugar. Su primera decisión es cambiar la cerradura de su despacho.',
    '{Sucesor} asume el cargo esa misma tarde. Nadie le pregunta qué pasó con su predecesor. Nadie quiere saberlo.'
  ];

  RF.TEXTO_YA = {
    muerto: '{Nombre} ya está muert{oa}. Ni siquiera el Líder Supremo puede matar a alguien dos veces.',
    preso: '{Nombre} ya está en la cárcel.',
    exiliado: '{Nombre} ya está en el exilio, lejos de tu alcance.',
    libre: '{Nombre} no está preso: no hay a quién liberar.',
    fuera: '{Nombre} ya no ocupa ningún cargo.'
  };
})(globalThis.RF = globalThis.RF || {});
