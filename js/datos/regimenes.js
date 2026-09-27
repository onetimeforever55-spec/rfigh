/*
 * REGÍMENES POLÍTICOS
 * Cada régimen cambia cómo funciona el país cada turno:
 *   recaudacion     multiplica los impuestos (en una dictadura se evade y se roba más)
 *   inversion       multiplica los ingresos productivos de tus leyes (la confianza de empresas y extranjeros)
 *   felicidadTurno  lo que pesan (o alivian) las libertades cada turno
 *   estabilidadBase hacia dónde tiende la estabilidad sola
 *   represionEstab  cuánto rinde la represión en estabilidad
 *   represionFel    cuánta felicidad cuesta la represión
 *   dineroTurno     ayuda o sanciones internacionales y gastos propios del régimen (corte, cuarteles...)
 *   elecciones      'libres' | 'amanables' | null (no hay)
 */
(function (RF) {
  'use strict';

  RF.REGIMENES = {
    DEMOCRACIA: {
      nombre: 'Democracia', corto: 'DEMOCRACIA',
      descripcion: 'Congreso, jueces y prensa libres. Recaudas bien y llega inversión, pero el Congreso puede bloquear tus leyes y los escándalos pueden tumbarte.',
      recaudacion: 1.0, inversion: 1.1, felicidadTurno: 0.3, estabilidadBase: 55, represionEstab: 0.8, represionFel: 1.5, dineroTurno: 2,
      elecciones: 'libres'
    },
    ILIBERAL: {
      nombre: 'Democracia iliberal', corto: 'DEM. ILIBERAL',
      descripcion: 'Sigue habiendo elecciones, pero controlas parte del juego: jueces, prensa o Congreso. El mundo empieza a mirarte con desconfianza.',
      recaudacion: 0.95, inversion: 1.0, felicidadTurno: 0, estabilidadBase: 52, represionEstab: 1.0, represionFel: 1.2, dineroTurno: 0,
      elecciones: 'amanables'
    },
    DICTADURA: {
      nombre: 'Dictadura', corto: 'DICTADURA',
      descripcion: 'Gobiernas sin Congreso ni elecciones. Nadie bloquea tus decretos, pero la gente evade impuestos, los inversores huyen y el mundo te sanciona. La represión rinde más.',
      recaudacion: 0.85, inversion: 0.85, felicidadTurno: -0.4, estabilidadBase: 45, represionEstab: 1.3, represionFel: 0.9, dineroTurno: -3,
      elecciones: null
    },
    JUNTA: {
      nombre: 'Junta militar', corto: 'JUNTA MILITAR',
      descripcion: 'Gobiernas rodeado de generales. El orden es de hierro y los cuarteles cuestan caros. La economía se resiente y la gente vive con miedo.',
      recaudacion: 0.8, inversion: 0.8, felicidadTurno: -0.5, estabilidadBase: 52, represionEstab: 1.4, represionFel: 0.9, dineroTurno: -7,
      elecciones: null
    },
    MONARQUIA: {
      nombre: 'Monarquía absoluta', corto: 'MONARQUÍA',
      descripcion: 'Su Excelencia es ahora Su Majestad. La corona da cierta legitimidad tradicional, pero la corte cuesta un dineral y el mundo se ríe un poco.',
      recaudacion: 0.9, inversion: 0.9, felicidadTurno: -0.2, estabilidadBase: 50, represionEstab: 1.2, represionFel: 1.0, dineroTurno: -4,
      elecciones: null
    },
    TEOCRACIA: {
      nombre: 'Teocracia', corto: 'TEOCRACIA',
      descripcion: 'La ley de Dios manda, y los curas con ella. Los creyentes se sienten en paz; los demás, vigilados. Las iglesias se quedan su diezmo.',
      recaudacion: 0.9, inversion: 0.85, felicidadTurno: -0.1, estabilidadBase: 53, represionEstab: 1.2, represionFel: 1.0, dineroTurno: -2,
      elecciones: null
    }
  };

  // Lo que se cuenta al cambiar de régimen.
  RF.TEXTOS_REGIMEN = {
    DICTADURA: [
      'A las cinco de la mañana, los tanques rodean el Congreso. Los diputados que llegan a trabajar encuentran las puertas cerradas con cadenas y un cartel: "Cerrado por reformas patrióticas". Desde hoy, tu palabra es la ley.',
      'Lees el decreto en televisión, con la bandera detrás y {n_garrote} a tu lado. Se suspenden las garantías constitucionales "de forma temporal". Nadie en Valdoria sabe cuánto dura lo temporal.'
    ],
    ILIBERAL: [
      'Nada cambia en apariencia: el Congreso se reúne, los jueces juzgan, los periódicos salen cada mañana. Pero las decisiones importantes ya se toman en tu despacho.',
      'La democracia sigue en pie, como un decorado. Detrás, cada vez hay más gente tuya moviendo los hilos.'
    ],
    DEMOCRACIA: [
      'Se reabren las puertas del Congreso. Los diputados entran despacio, mirando el techo como quien vuelve a una casa después de un incendio. Las embajadas celebran; tus ministros, no tanto.',
      'Convocas elecciones libres y devuelves las llaves del Congreso. En la calle, la gente llora y se abraza. En Palacio, alguien empieza a destruir documentos.'
    ],
    JUNTA: [
      'Firmas el decreto rodeado de generales. Desde hoy, Valdoria la gobierna una Junta Militar presidida por ti. {n_garrote} sonríe por primera vez en años.',
      'Los militares ocupan los ministerios. Donde había un funcionario, ahora hay un coronel. El país se despierta con toque de queda.'
    ],
    MONARQUIA: [
      'En una ceremonia de cuatro horas, te colocas tú mismo la corona. Es de latón dorado y pesa demasiado. Desde hoy, Su Excelencia es Su Majestad Primero de Valdoria.',
      'Se proclama la monarquía. {paredes} ya ha encargado el retrato oficial con armiño. Los niños tienen que aprender un nuevo himno, con más estrofas.'
    ],
    TEOCRACIA: [
      'El arzobispo bendice el nuevo orden desde el balcón del Palacio. Las leyes se revisarán "a la luz de las Escrituras". Los bares cierran los domingos. Y los lunes, por si acaso.',
      'Valdoria se proclama Estado confesional. Los curas entran en las escuelas, en los tribunales y en los ministerios. {sombra} se compra un rosario.'
    ]
  };

  // Estado de cada institución del Estado, para contarlo.
  RF.ESTADOS_INSTITUCION = {
    congreso: { libre: 'libre', controlado: 'comprado', disuelto: 'disuelto' },
    tribunales: { libre: 'independientes', controlado: 'controlados', disuelto: 'disueltos' },
    prensa: { libre: 'libre', controlado: 'censurada', disuelto: 'cerrada' },
    elecciones: { libre: 'libres', controlado: 'amañadas', disuelto: 'suspendidas' },
    constitucion: { libre: 'vigente', controlado: 'reformada a tu medida', disuelto: 'abolida' }
  };

  // Palabras que convierten una orden en secreta.
  RF.SECRETO = /\b(secret|a escondidas|discretamente|sin que (nadie )?se (sepa|entere)|que parezca (un )?accidente|accidente|en silencio|encubiert|sin dejar rastro|por debajo de la mesa|clandestin)/;
})(globalThis.RF = globalThis.RF || {});
