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
    garrote: { tipo: 'ministro', stat: 'ejercito', claves: ['el general', 'al general', 'del general', 'ministro de defensa', 'jefe del ejercito', 'general garrote', 'garrote', 'bruno'] },
    cifuentes: { tipo: 'ministro', stat: 'cupula', claves: ['ministra de hacienda', 'ministro de hacienda', 'cifuentes', 'leonor'] },
    sombra: { tipo: 'ministro', stat: 'orden', claves: ['ministro del interior', 'ministra del interior', 'octavio sombra', 'sombra', 'octavio'] },
    paredes: { tipo: 'ministro', stat: 'pueblo', claves: ['jefe de propaganda', 'rolo', 'paredes', 'rolando'] },
    montiel: { tipo: 'ministro', stat: 'mundo', claves: ['canciller', 'ministra de exteriores', 'montiel', 'isabela'] },
    ventura: { tipo: 'ministro', stat: 'salud', claves: ['ministro de salud', 'ministra de salud', 'ventura', 'aurelio'] },
    carmen: { tipo: 'ciudadano', oa: 'a', claves: ['dona carmen', 'carmen', 'la arepera', 'la de las arepas'] },
    nico: { tipo: 'ciudadano', oa: 'o', claves: ['nico', 'el nieto de carmen', 'nieto de dona carmen'] },
    ramiro: { tipo: 'ciudadano', oa: 'o', claves: ['ramiro', 'el taxista'] },
    lucia: { tipo: 'ciudadano', oa: 'a', claves: ['lucia', 'la enfermera'] },
    valiente: { tipo: 'opositor', oa: 'o', nombre: 'Ernesto Valiente', claves: ['lider de la oposicion', 'jefe de la oposicion', 'lider opositor', 'ernesto valiente', 'valiente', 'ernesto'] },
    embajador: { tipo: 'extranjero', oa: 'o', nombre: 'el embajador de la Unión Atlántica', claves: ['el embajador', 'embajador', 'embajadora', 'la embajada'] }
  };

  // Quién ocupa el cargo cuando un ministro cae.
  RF.SUCESORES = {
    garrote: [{ nombre: 'General Rufino Tapia', corto: 'Tapia' }, { nombre: 'General Adela Brito', corto: 'Brito' }, { nombre: 'General Mauro Quintana', corto: 'Quintana' }],
    cifuentes: [{ nombre: 'Fermín Olazábal', corto: 'Olazábal' }, { nombre: 'Marta Iturbe', corto: 'Iturbe' }, { nombre: 'Julio Cardona', corto: 'Cardona' }],
    sombra: [{ nombre: 'Víctor Lagos', corto: 'Lagos' }, { nombre: 'Irene Cuervo', corto: 'Cuervo' }, { nombre: 'Comandante "El Tigre" Robles', corto: 'Robles' }],
    paredes: [{ nombre: 'Tito Pacheco', corto: 'Pacheco' }, { nombre: 'Nena Solís', corto: 'Solís' }, { nombre: 'Beto Almagro', corto: 'Almagro' }],
    montiel: [{ nombre: 'Aníbal Ferrer', corto: 'Ferrer' }, { nombre: 'Clara Ibarra', corto: 'Ibarra' }, { nombre: 'Luis Etxeberria', corto: 'Etxeberria' }],
    ventura: [{ nombre: 'Dra. Sonia Méndez', corto: 'Méndez' }, { nombre: 'Dr. Gil Arrieta', corto: 'Arrieta' }, { nombre: 'Dra. Paz Oviedo', corto: 'Oviedo' }]
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
      matar: { pueblo: -14, mundo: -16, orden: 3, cupula: -4 },
      encarcelar: { pueblo: -7, mundo: -9, orden: 3 },
      exiliar: { pueblo: -3, mundo: -4, orden: 2 },
      destituir: { pueblo: -3, mundo: -4, orden: 2 },
      premiar: { pueblo: 5, cupula: -5, mundo: 4, orden: 2 },
      liberar: { pueblo: 6, mundo: 6, orden: -3 }
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
        carmen: 'Doña Carmen no abre su puesto esta mañana, ni la siguiente. En su esquina, la gente deja arepas y velas. Cada día hay más.',
        nico: 'Nico no vuelve a casa. Doña Carmen lo busca en comisarías, hospitales y morgues. Lo encuentra en la tercera.',
        ramiro: 'El taxi de Ramiro aparece quemado a las afueras de la ciudad. A mediodía, todos los taxistas de la capital tocan el claxon a la vez durante un minuto.',
        lucia: 'Lucía no llega a su turno en el Hospital Central. Sus compañeras cubren el hueco sin decir nada. Esa noche, todas las enfermeras llevan un lazo negro.'
      },
      encarcelar: ['Dos hombres de traje se llevan a {nombre} de madrugada. En el barrio nadie duerme esa noche.', '{Nombre} es detenid{oa} "por actividades contra la patria". Nadie le explica cuáles.'],
      exiliar: ['{Nombre} es subid{oa} a un avión con lo puesto. Desde la ventanilla ve su barrio hacerse pequeño.'],
      destituir: ['{Nombre} pierde su trabajo por orden directa del Palacio. Nadie le explica por qué. Todo el mundo lo sabe.'],
      premiar: ['{Nombre} recibe una medalla y una foto contigo en el Palacio. En el barrio no saben si felicitar{le} o desconfiar.'],
      liberar: ['{Nombre} sale de la cárcel. En la puerta l{oa} espera media calle con pancartas y bocadillos.']
    },
    opositor: {
      matar: ['Ernesto Valiente recibe tres disparos a la salida de un mitin. Muere camino del hospital. Esa noche, cientos de miles de personas salen a la calle con velas.'],
      encarcelar: ['Ernesto Valiente es detenido en directo, en mitad de una entrevista. Sus últimas palabras antes de que corten la señal: "Esto no se acaba conmigo".'],
      exiliar: ['Ernesto Valiente es escoltado hasta la frontera. Se da la vuelta, levanta el puño y cruza. Sus seguidores lo ven por televisión.'],
      destituir: ['Ilegalizas el partido de Ernesto Valiente. Él convoca una rueda de prensa en la calle, sin partido pero con más cámaras que nunca.'],
      premiar: ['Le ofreces a Ernesto Valiente un ministerio. Tras una noche sin dormir, acepta. Sus seguidores lo llaman traidor. Tus ministros, también.'],
      liberar: ['Ernesto Valiente sale de la cárcel entre una multitud. Da las gracias a todo el mundo menos a ti.']
    },
    extranjero: {
      matar: ['El coche del embajador de la Unión Atlántica estalla frente a la embajada. En menos de una hora, el mundo entero sabe dónde está Valdoria en el mapa.'],
      encarcelar: ['La policía entra en la embajada de la Unión Atlántica y se lleva al embajador. Es la violación diplomática más grave en años. {montiel} se desmaya.'],
      exiliar: ['Declaras persona non grata al embajador de la Unión Atlántica. Tiene 24 horas para irse. Se va en 12, llevándose la bandera.'],
      destituir: ['Declaras persona non grata al embajador de la Unión Atlántica. Tiene 24 horas para irse. Se va en 12, llevándose la bandera.'],
      premiar: ['Condecoras al embajador de la Unión Atlántica con la Orden del Plátano de Oro. Sonríe para la foto y guarda la medalla en un cajón.'],
      liberar: ['El embajador sale del calabozo y se va directo al aeropuerto. Su gobierno exige disculpas por escrito.']
    }
  };

  RF.TEXTO_SUCESOR = [
    'Su puesto lo ocupa {sucesor}. En su primer día jura lealtad eterna. Todos saben cuánto duran esas cosas en Valdoria.',
    'Nombras a {sucesor} en su lugar. Su primera decisión es cambiar la cerradura de su despacho.',
    '{Sucesor} asume el cargo esa misma tarde. Nadie le pregunta qué pasó con su predecesor. Nadie quiere saberlo.'
  ];

  RF.TEXTO_YA = {
    muerto: '{Nombre} ya está muert{oa}. Ni siquiera Su Excelencia puede matar a alguien dos veces.',
    preso: '{Nombre} ya está en la cárcel.',
    exiliado: '{Nombre} ya está en el exilio, lejos de tu alcance.',
    libre: '{Nombre} no está preso: no hay a quién liberar.',
    fuera: '{Nombre} ya no ocupa ningún cargo.'
  };
})(globalThis.RF = globalThis.RF || {});
