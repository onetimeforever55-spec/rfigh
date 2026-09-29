/*
 * TEMAS DUROS
 * Decretos que el clasificador general no sabe tratar bien (la esclavitud, la guerra, la bomba, el aborto...).
 * Se reconocen por su forma ("re") antes que el resto, y cada uno tiene dos direcciones:
 *   favor   aplicar la política que nombra el tema (legalizar la esclavitud, declarar la guerra, quemar libros...)
 *   contra  lo contrario (abolirla, firmar la paz, proteger los libros...)
 * La dirección se decide con "contraRe" (una expresión propia) y RF.PARAR ("dejar de", "no a la"...) o, si el tema no la trae, con RF.CONTRA.
 * Cada dirección es una ley con: nombre, inicial, porTurno, curvas, texto (Gaceta), notas, programar
 * (consecuencias con retraso) y controversia (0-3: cuánto la rechaza un Congreso libre).
 * "sinLey": qué pasa con "contra" si nunca hubo ley a favor (abolir algo que ya estaba prohibido).
 * Los números siguen la escala del resto del juego: ver js/leyes.js.
 */
(function (RF) {
  'use strict';

  // Palabras que ponen un decreto "en contra" del tema.
  // Parar o rechazar algo: vale para todos los temas, salvo los que nombran una prohibición (sinParar).
  RF.PARAR = /\b(dej\w* de|par(ar|en|e|emos|ad) (de|la|el|los|las|con)|basta de|no (quiero|queremos|habra|mas|a|al))\b/;
  RF.CONTRA = /\b(liber\w* a los|prohib\w*|abol\w*|elimin\w*|acab\w* con|derog\w*|ilegaliz\w*|quit\w*|cerr\w*|suprim\w*|desmantel\w*|fin (de|a|al)|baj\w*|reduc\w*|recort\w*|congel\w*|deten\w*|frenar|castig\w*|persegu\w*|combat\w*|lucha\w* contra|impedir|vetar|veto)\b/;

  RF.TEMAS = {
    ESCLAVITUD: {
      nombre: 'la esclavitud', re: /\b(esclav\w*|trabajos? forzados?|servidumbre)\b/,
      favor: {
        nombre: 'la esclavitud legal', controversia: 3, economia: { sanciones: 1 }, relaciones: { eeuu: -8, surcorea: -6, japon: -5 },
        inicial: { dinero: 15, felicidad: -10, estabilidad: -3 },
        porTurno: { dinero: 10, felicidad: -2.5, estabilidad: -1.2 }, curvas: { dinero: 'acostumbra' },
        texto: 'Los tribunales reciben la orden de reclasificar a ciertos trabajadores como «patrimonio productivo del Estado». Las minas y las plantaciones firman contratos sin sueldo y sin fecha de salida. En el extranjero, las embajadas piden explicaciones por escrito.',
        notas: ['Sale barato producir así, pero el mundo entero lo está mirando: vienen sanciones.'],
        programar: [
          { en: 2, titulo: 'Sanciones internacionales', texto: 'La ONU congela las cuentas del Estado en el extranjero y prohíbe comprar carbón de Corea del Norte. {montiel} se encierra en su despacho.', efectos: { dinero: -20, estabilidad: -3 } },
          { en: 4, titulo: 'La fuga de las minas', texto: 'Cuarenta trabajadores forzados escapan de una mina del sur. Los pueblos del camino los esconden. La radio pirata ya tiene nombres y caras.', efectos: { estabilidad: -5, felicidad: -2 } }
        ]
      },
      contra: {
        nombre: 'la abolición de la esclavitud', controversia: 1,
        inicial: { felicidad: 8, estabilidad: -2, dinero: -10 }, porTurno: { felicidad: 0.5, dinero: -1 },
        texto: 'Quedan libres todos los trabajadores forzados. El Estado indemniza a los dueños de las minas, que protestan igual. En las plantaciones, la gente se va caminando sin mirar atrás.'
      },
      sinLey: { unaVez: true, inicial: { felicidad: 1 }, notas: ['En Corea del Norte la esclavitud ya estaba prohibida. El decreto lo repite, por si acaso.'] }
    },

    TRABAJO_INFANTIL: {
      nombre: 'el trabajo infantil', re: /\b(trabajo infantil|explotacion infantil|(que )?los (ninos|niños|menores) (trabajen|vayan a trabajar)|(ninos|niños) (a|en) (las )?(minas|fabricas|plantaciones))\b/,
      favor: {
        nombre: 'el trabajo infantil', controversia: 3,
        inicial: { dinero: 8, felicidad: -9 }, porTurno: { dinero: 5, felicidad: -1.8, estabilidad: -0.5 },
        texto: 'Se rebaja a diez años la edad para trabajar «en tareas formativas». Las fábricas encargan herramientas pequeñas. Las escuelas del interior se quedan medio vacías.',
        programar: [{ en: 3, titulo: 'Las aulas vacías', texto: 'Los maestros de los pueblos pasan lista a pupitres vacíos. {ventura} advierte de accidentes en las fábricas. La prensa extranjera publica la foto de un niño de once años con casco.', efectos: { felicidad: -4, estabilidad: -2, dinero: -6 } }]
      },
      contra: {
        nombre: 'la prohibición del trabajo infantil', controversia: 0,
        inicial: { felicidad: 4, dinero: -4 }, porTurno: { felicidad: 0.4, dinero: -1 },
        texto: 'Los niños vuelven a la escuela. Algunas familias pobres pierden un sueldo y lo notan; los inspectores de trabajo, por fin, tienen algo que hacer.'
      }
    },

    GUERRA: {
      nombre: 'la guerra', re: /\b(par(ar|en|e|emos) la guerra|firm\w* la paz|paz con|acuerdo de paz|no a la guerra|alto el fuego|armisticio|(terminar|acabar( con)?) la guerra|fin de la guerra|declar\w* (la )?guerra|invad\w*|invasion|bombarde\w*|atac\w* (a|al) (la |el )?(pais|union|vecin|suiza|frontera)|ir a la guerra|guerra (a|contra|con) (el |la )?(pais|union|vecin|suiza))/,
      no: /\b(narco\w*|drogas?|crimen|pobreza|corrupcion|hambre)\b/,
      contraRe: /\b(paz|armisticio|rendi\w*|retir\w*|alto el fuego|tregua|acabar la guerra|terminar la guerra|fin de la guerra)\b/,
      favor: {
        nombre: 'la guerra contra el país vecino', controversia: 3, economia: { sanciones: 1 }, relaciones: { eeuu: -20, china: -15, surcorea: -25, japon: -15 },
        inicial: { dinero: -30, estabilidad: 5, felicidad: 3, ejercito: 10 },
        porTurno: { dinero: -12, felicidad: -1.5, estabilidad: 0.8, ejercito: 0.5 }, curvas: { estabilidad: 'desgasta', ejercito: 'desgasta' },
        texto: 'Corea del Norte declara la guerra. Los reclutas se presentan en los cuarteles con la maleta de la escuela. Durante unos días, todo el país canta el himno a la vez. Luego llegan las facturas.',
        notas: ['Al principio la guerra une (estabilidad +). Cada turno cuesta 12 millones y desgasta la moral.'],
        programar: [
          { en: 3, titulo: 'Los primeros ataúdes', texto: 'Llegan al puerto los primeros ataúdes cubiertos con la bandera. En Sadong, tres familias ponen crespón negro en la puerta.', efectos: { felicidad: -6, estabilidad: -3 } },
          { en: 5, titulo: 'Bloqueo naval', texto: 'La flota de la ONU bloquea el puerto. Los barcos de carbón se pudren en el muelle.', efectos: { dinero: -20, felicidad: -3 } }
        ]
      },
      contra: {
        nombre: 'la paz', controversia: 0, relaciones: { eeuu: 8, china: 8, surcorea: 12, japon: 6 },
        inicial: { felicidad: 6, estabilidad: -3 }, porTurno: { felicidad: 0.5 },
        texto: 'Se firma la paz en una mesa prestada por un hotel de la frontera. {garrote} no aparece en la foto. Los soldados vuelven a casa; algunos no saben muy bien a qué.'
      },
      sinLey: { unaVez: true, inicial: { felicidad: 1 }, notas: ['Corea del Norte no estaba en guerra con nadie. El decreto de paz se archiva junto a los de buena voluntad.'] }
    },

    NUCLEAR: {
      nombre: 'la bomba atómica', re: /\b(bomba\w*|arma\w*|misil\w*|programa|cabeza\w*) (nuclear\w*|atomic\w*)\b/,
      favor: {
        nombre: 'el programa nuclear militar', controversia: 3, economia: { sanciones: 1 }, relaciones: { eeuu: -15, china: -10, surcorea: -12, japon: -12 },
        inicial: { dinero: -40, estabilidad: 2, ejercito: 6 }, porTurno: { dinero: -8, estabilidad: 0.6 }, curvas: { estabilidad: 'lenta' },
        texto: 'Un grupo de físicos se instala en una base secreta del interior. Tardarán años; mientras tanto, la palabra «nuclear» ya aparece en todos los discursos de Palacio.',
        programar: [{ en: 3, titulo: 'El mundo se entera', texto: 'Un satélite extranjero fotografía la base. La ONU convoca una cumbre de emergencia sobre Corea del Norte. El embajador ya no sonríe.', efectos: { dinero: -25, estabilidad: -4 } }]
      },
      contra: {
        nombre: 'el desarme nuclear', controversia: 0, economia: { sanciones: -2 }, relaciones: { eeuu: 25, china: 8, surcorea: 15, japon: 12 },
        inicial: { dinero: 10, estabilidad: -1, ejercito: -8 }, porTurno: { dinero: 1 },
        texto: 'Corea del Norte renuncia a las armas atómicas. Los inspectores internacionales se llevan unos papeles y dejan un cheque de ayuda.'
      },
      sinLey: { unaVez: true, inicial: { dinero: 3 }, notas: ['Ya no queda arsenal que desmantelar: los inspectores se llevaron hasta los tornillos. El mundo agradece que lo repitas.'] }
    },

    MISILES: {
      nombre: 'los misiles', re: /\b(misil\w*|cohete\w*|lanzar un satelite|prueba\w* de misiles|ensayo\w* de misiles|disparar al mar)\b/,
      contraRe: /\b(moratoria|suspend\w*|dej\w* de|par(ar|en|e) (de|las|los)|no (mas|lanzar)|prohib\w*|desmantel\w*)\b/,
      favor: {
        nombre: 'las pruebas de misiles', controversia: 2, prensa: 'culto', economia: { sanciones: 1 }, relaciones: { eeuu: -8, china: -6, surcorea: -8, japon: -10 },
        inicial: { estabilidad: 2, felicidad: 1, dinero: -12, ejercito: 6 }, porTurno: { dinero: -3, estabilidad: 0.3, ejercito: 0.5 }, curvas: { estabilidad: 'acostumbra', ejercito: 'acostumbra' },
        texto: 'Un misil despega de la costa este, cruza el cielo y cae al mar. El Rodong Sinmun dedica ocho páginas al éxito. {garrote} llora de emoción en la foto oficial, rodeado de generales que toman notas.',
        notas: ['Cada lanzamiento une a la élite, pero cuesta divisas y enfada al mundo.'],
        programar: [{ en: 2, titulo: 'Nuevas sanciones', texto: 'El Consejo de Seguridad de la ONU aprueba otra ronda de sanciones. China se abstiene, pero pide a {montiel} "un poco de calma".', efectos: { dinero: -12, estabilidad: -1 } }]
      },
      contra: {
        nombre: 'la moratoria de pruebas de misiles', controversia: 0, economia: { sanciones: -1 }, relaciones: { eeuu: 10, china: 8, surcorea: 6, japon: 10 },
        inicial: { dinero: 8, estabilidad: -1, ejercito: -6 }, porTurno: { dinero: 2 },
        texto: 'Anuncias que no habrá más lanzamientos "de momento". Llegan barcos con arroz de ayuda humanitaria. Los generales miran el cielo vacío con nostalgia.'
      },
      sinLey: { unaVez: true, inicial: { dinero: 3 }, notas: ['No había pruebas en marcha. El mundo agradece la promesa con un poco de ayuda.'] }
    },

    MERCADOS: {
      nombre: 'el mercado negro', re: /\b(jangmadang|mercados? negros?|mercados? privados?|mercados? libres?|libre mercado|abrir los mercados|cerrar los mercados|comercio privado|los mercados)\b/,
      favor: {
        nombre: 'la legalización de los mercados', controversia: 1, prensa: 'economia', economia: { mercadoNegro: -35 }, relaciones: { china: 6, surcorea: 4 },
        inicial: { felicidad: 5, estabilidad: -1, elite: -6 }, porTurno: { dinero: 5, felicidad: 0.8, inflacion: -1, estabilidad: -0.3 }, curvas: { dinero: 'madura' },
        texto: 'El jangmadang deja de ser negro: los puestos pagan una licencia y un impuesto. Las abuelas que vendían a escondidas cuelgan por primera vez un cartel con su nombre. Algunos cuadros del Partido pierden sus sobornos y ponen mala cara.',
        programar: [{ en: 3, titulo: 'Los nuevos ricos', texto: 'En Pionyang aparecen los donju, comerciantes con coche y teléfono extranjero. Compran pisos, prestan dinero y ya no bajan la mirada ante los inspectores.', efectos: { dinero: 4, estabilidad: -2 } }]
      },
      contra: {
        nombre: 'el cierre de los mercados', controversia: 1, prensa: 'esencial', economia: { mercadoNegro: -20 },
        inicial: { felicidad: -6, estabilidad: 1, elite: -3 }, porTurno: { felicidad: -1.5, inflacion: 2, estabilidad: 0.2 },
        texto: 'La policía cierra el jangmadang y requisa las mercancías. El arroz desaparece de las tiendas en dos días. Lo que queda se vende por la ventana, al triple.',
        programar: [{ en: 2, titulo: 'Las colas del hambre', texto: 'Sin mercados, las raciones del Estado no llegan. En el campo, la gente come hierba cocida. La abuela Sun-ja reparte en secreto lo que le queda.', efectos: { felicidad: -5, estabilidad: -2 } }]
      },
      sinLey: { unaVez: true, inicial: { felicidad: -2, inflacion: 1 }, notas: ['Los mercados eran ilegales, pero todos los usaban. La policía hace una redada, requisa unas cuantas cosas y todo vuelve a abrir al día siguiente.'] }
    },

    CAMPOS: {
      nombre: 'los campos de reeducación', re: /\b(campos? de (reeducacion|concentracion|trabajo|internamiento)|reeducacion)\b/,
      contraRe: /\b(cerr\w*|liber\w*|desmantel\w*|abol\w*|prohib\w*|elimin\w*)\b/,
      favor: {
        nombre: 'los campos de reeducación', controversia: 3, relaciones: { eeuu: -6, surcorea: -6, japon: -3 },
        inicial: { dinero: -15, estabilidad: 3, felicidad: -8 }, porTurno: { dinero: -4, estabilidad: 1, felicidad: -2 },
        curvas: { estabilidad: 'desgasta', felicidad: 'desgasta' },
        texto: 'En el interior se levantan barracones con alambre y un cartel que dice «Escuela de Ciudadanía». Los autobuses salen de noche. Nadie en los barrios pregunta en voz alta adónde van.',
        programar: [{ en: 3, titulo: 'Los que no vuelven', texto: 'Las madres de los internados se reúnen cada mañana frente al Ministerio de Seguridad del Estado con fotos. Cada día son más.', efectos: { felicidad: -5, estabilidad: -3, dinero: -5 } }]
      },
      contra: {
        nombre: 'el cierre de los campos', controversia: 0,
        inicial: { felicidad: 6, estabilidad: -3 }, porTurno: { felicidad: 0.4 },
        texto: 'Se abren las puertas de los campos. Los internados salen flacos y callados. Algunos ya están contando lo que vieron.'
      },
      sinLey: { unaVez: true, inicial: { felicidad: 1 }, notas: ['En Corea del Norte no había campos. El decreto tranquiliza a los que temían que los hubiera.'] }
    },

    LIBROS: {
      nombre: 'los libros', sinParar: true, re: /\b(quem\w* (los |las |de )?libros|quema de libros|prohib\w* (los )?libros|censur\w* (los )?libros|libros prohibidos)\b/,
      contraRe: /\b(libertad de|proteg\w*|devolv\w*|reabr\w*|liber\w* los libros|(dej\w*|par(ar|en|e)) de (quemar|prohibir|censurar))\b/,
      favor: {
        nombre: 'la quema de libros', controversia: 2,
        inicial: { felicidad: -6, estabilidad: 1 }, porTurno: { felicidad: -1.2, estabilidad: 0.2 },
        texto: 'En la plaza mayor arde una hoguera de novelas, diccionarios y un manual de fontanería que se coló. {paredes} lo retransmite como «limpieza cultural».',
        programar: [{ en: 3, titulo: 'Bibliotecas clandestinas', texto: 'En los sótanos de Sadong se prestan libros a escondidas. Chol-su organiza un club de lectura con contraseña.', efectos: { estabilidad: -2 } }]
      },
      contra: {
        nombre: 'la libertad de los libros', controversia: 0,
        inicial: { felicidad: 3 }, porTurno: { felicidad: 0.3 },
        texto: 'Las bibliotecas reabren. Los libros vuelven a las estanterías con olor a humo.'
      }
    },

    TORTURA: {
      nombre: 'la tortura', re: /\b(tortur\w*|interrogatorios? (duros?|mejorados?|especial(es)?))\b/,
      favor: {
        nombre: 'los interrogatorios mejorados', controversia: 3,
        inicial: { estabilidad: 2, felicidad: -5 }, porTurno: { estabilidad: 0.8, felicidad: -1.2 }, curvas: { estabilidad: 'desgasta' },
        texto: 'Un decreto de una página autoriza «interrogatorios con métodos mejorados» en los sótanos del Ministerio de Seguridad del Estado. {sombra} lo firma sin leerlo.',
        programar: [{ en: 3, titulo: 'Las fotos', texto: 'Un funcionario arrepentido filtra fotos de los sótanos a la prensa extranjera. Ya nadie puede decir que no sabía.', efectos: { estabilidad: -5, dinero: -8, felicidad: -3 } }]
      },
      contra: {
        nombre: 'la prohibición de la tortura', controversia: 0,
        inicial: { felicidad: 3, estabilidad: -1 }, porTurno: { felicidad: 0.2 },
        texto: 'Se prohíben los interrogatorios con violencia. En los sótanos del Ministerio de Seguridad del Estado se apagan unas luces que llevaban años encendidas.'
      },
      sinLey: { unaVez: true, inicial: { felicidad: 1 }, notas: ['La tortura ya era ilegal. El decreto lo recuerda en voz alta.'] }
    },

    ABORTO: {
      nombre: 'el aborto', re: /\b(abort\w*|interrupcion (voluntaria )?del embarazo)\b/,
      favor: {
        nombre: 'el aborto legal', controversia: 2,
        inicial: { felicidad: 2, estabilidad: -2 }, porTurno: { felicidad: 0.3, dinero: -0.5 },
        texto: 'Los hospitales públicos podrán interrumpir embarazos de forma legal y gratuita. {ventura} cierra dos clínicas clandestinas que ya no tienen clientes. Las ancianas del barrio murmuran.',
        programar: [{ en: 2, titulo: 'Los murmullos', texto: 'Los veteranos del Partido se quejan en voz baja de «costumbres decadentes». No hay encuestas, pero en las colas del mercado el país está partido en dos.', efectos: { estabilidad: -2 } }]
      },
      contra: {
        nombre: 'la prohibición del aborto', controversia: 2,
        inicial: { felicidad: -4, estabilidad: 1 }, porTurno: { felicidad: -0.6 },
        texto: 'El aborto queda prohibido en todos los casos: el Partido quiere «más soldados para el futuro». Las clínicas clandestinas suben sus precios esa misma noche.',
        programar: [{ en: 3, titulo: 'Clínicas clandestinas', texto: 'El Hospital Central recibe a mujeres con complicaciones de abortos clandestinos. Eun-hee hace turnos dobles y no dice nada.', efectos: { felicidad: -3 } }]
      }
    },

    MATRIMONIO: {
      nombre: 'el matrimonio igualitario', re: /\b(matrimonio (gay|igualitario|homosexual|entre personas del mismo sexo)|bodas? gay|casarse (dos )?(hombres|mujeres))\b/,
      favor: {
        nombre: 'el matrimonio igualitario', controversia: 1,
        inicial: { felicidad: 2, estabilidad: -1, dinero: 2 }, porTurno: { felicidad: 0.3, dinero: 0.5 },
        texto: 'Cualquier pareja podrá casarse en el registro civil. Los primeros en hacerlo son dos taxistas amigos de Kwang-ho, que llevaban veinte años esperando. El Rodong Sinmun no publica la foto.'
      },
      contra: {
        nombre: 'la prohibición del matrimonio igualitario', controversia: 1,
        inicial: { felicidad: -3, estabilidad: 1 }, porTurno: { felicidad: -0.4, dinero: -0.5 },
        texto: 'El matrimonio queda reservado a hombre y mujer. Algunas parejas se casan en el consulado de otro país. La prensa extranjera toma nota.'
      }
    },

    PROSTITUCION: {
      nombre: 'la prostitución', re: /\b(prostitu\w*|trabajo sexual|burdel\w*|prostibul\w*)\b/,
      favor: {
        nombre: 'la prostitución legal', controversia: 1,
        inicial: { felicidad: 1, estabilidad: -1 }, porTurno: { dinero: 3, estabilidad: 0.1 },
        texto: 'La prostitución se regula: licencia, revisión médica y facturas. Hacienda crea un código fiscal nuevo que nadie se atreve a pronunciar en voz alta.'
      },
      contra: {
        nombre: 'la persecución de la prostitución', controversia: 0,
        inicial: { estabilidad: 1 }, porTurno: { dinero: -1, felicidad: -0.2 },
        texto: 'La policía cierra los burdeles del puerto. Al día siguiente abren en otra calle, con otra puerta.'
      }
    },

    INMIGRACION: {
      nombre: 'la inmigración', sinParar: true, re: /\b(inmigra\w*|refugiad\w*|migrantes?|extranjeros ilegales|sin papeles)\b/,
      contraRe: /\b(acog\w*|regulariz\w*|papeles para|(dar|con) papeles|papeles a|nacionalidad|ciudadania|bienven\w*|abrir las fronteras|asilo)\b/,
      favor: {
        nombre: 'la expulsión de los inmigrantes', controversia: 2,
        inicial: { estabilidad: 2, felicidad: -3, dinero: -10 }, porTurno: { dinero: -3, felicidad: -0.4 },
        texto: 'Autobuses del Ministerio de Seguridad del Estado recorren los barrios deteniendo a quien no tenga papeles. En el campo, la mitad de los jornaleros desaparece en una semana.',
        programar: [{ en: 3, titulo: 'Cosechas sin recoger', texto: 'El maíz se pudre en las granjas colectivas: no queda quien lo recoja. Los dueños piden a Palacio que «los devuelvan, pero solo para la cosecha».', efectos: { dinero: -12, felicidad: -2 } }]
      },
      contra: {
        nombre: 'la regularización de los inmigrantes', controversia: 1,
        inicial: { dinero: -3, felicidad: 2, estabilidad: -1 }, porTurno: { dinero: 3, felicidad: 0.3 }, curvas: { dinero: 'madura' },
        texto: 'Los inmigrantes reciben papeles y pagan impuestos. En las colas del registro se habla en cuatro idiomas.'
      }
    },

    SALARIO: {
      nombre: 'el salario mínimo', re: /\b(salario|sueldo) minimo\b/,
      contraRe: /\b(baj\w*|elimin\w*|congel\w*|quit\w*|reduc\w*|abol\w*|recort\w*)\b/,
      favor: {
        nombre: 'la subida del salario mínimo', controversia: 1,
        inicial: { felicidad: 5, dinero: -5 }, porTurno: { felicidad: 0.8, dinero: -3, inflacion: 0.8 }, curvas: { felicidad: 'acostumbra' },
        texto: 'El salario mínimo sube un tercio. Los trabajadores lo celebran; los pequeños comercios suben los precios esa misma semana.'
      },
      contra: {
        nombre: 'la rebaja del salario mínimo', controversia: 2,
        inicial: { felicidad: -6, dinero: 3 }, porTurno: { felicidad: -1.2, dinero: 3, estabilidad: -0.5, inflacion: -0.3 },
        texto: 'El salario mínimo baja «para ganar competitividad». Los empresarios aplauden desde el club del Comité Central. En las colas del autobús nadie aplaude.'
      }
    },

    PENSIONES: {
      nombre: 'las pensiones', re: /\b(pension\w*|jubilacion\w*)\b/, no: /\bimpuest/,
      contraRe: /\b(baj\w*|elimin\w*|congel\w*|quit\w*|reduc\w*|abol\w*|recort\w*|retrasar)\b/,
      favor: {
        nombre: 'la subida de las pensiones', controversia: 0,
        inicial: { felicidad: 4, dinero: -5 }, porTurno: { felicidad: 0.6, dinero: -5, inflacion: 0.3 }, curvas: { felicidad: 'acostumbra' },
        texto: 'Las pensiones suben. La abuela Sun-ja dice que ahora podrá comprar carne dos veces por semana.'
      },
      contra: {
        nombre: 'el recorte de las pensiones', controversia: 2,
        inicial: { felicidad: -7 }, porTurno: { dinero: 7, felicidad: -1.5, estabilidad: -0.6 },
        texto: 'Las pensiones se recortan un tercio. Los jubilados forman cola en el banco para comprobar que no es un error. No lo es.',
        programar: [{ en: 2, titulo: 'Los jubilados salen a la calle', texto: 'Miles de jubilados cortan la avenida principal con bastones y cacerolas. La policía no sabe cómo cargar contra sus abuelos.', efectos: { estabilidad: -4, felicidad: -2 } }]
      }
    },

    RENTA_BASICA: {
      nombre: 'la renta básica', re: /\b(renta basica|ingreso (basico|minimo) (universal|vital)|renta universal|paga\w* (un sueldo )?a todos (los ciudadanos )?(sin trabajar)?)\b/,
      favor: {
        nombre: 'la renta básica universal', controversia: 1,
        inicial: { felicidad: 8 }, porTurno: { dinero: -16, felicidad: 1.5, inflacion: 1.5, estabilidad: 0.3 }, curvas: { felicidad: 'acostumbra' },
        texto: 'Cada adulto de Corea del Norte recibirá una paga mensual por el simple hecho de existir. {cifuentes} hace la cuenta tres veces y pide un vaso de agua.',
        notas: ['Es muy cara: 16 millones cada turno. Si no hay dinero, habrá que imprimirlo.']
      },
      contra: {
        nombre: 'el fin de la renta básica', controversia: 1,
        inicial: { felicidad: -4 }, porTurno: { dinero: 2 },
        texto: 'Se acaba la paga universal. Hay quien había dejado de trabajar y ahora tiene que volver.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había renta básica que quitar.'] }
    },

    ARANCELES: {
      nombre: 'los aranceles', re: /\b(arancel\w*|proteccionismo|libre comercio|tratados? de libre comercio|import\w* (sin impuestos|libres?)|abrir las fronteras al comercio)\b/,
      contraRe: /\b(libre comercio|baj\w*|elimin\w*|quit\w*|abr\w*|reduc\w*)\b/,
      favor: {
        nombre: 'los aranceles a las importaciones', controversia: 1,
        inicial: { felicidad: -1 }, porTurno: { dinero: 4, inflacion: 1, felicidad: -0.4, estabilidad: 0.1 },
        texto: 'Todo lo que entre por el puerto pagará un 40% extra. Las fábricas nacionales celebran; los electrodomésticos del escaparate cambian de precio antes del mediodía.',
        programar: [{ en: 3, titulo: 'Represalias comerciales', texto: 'La ONU responde con aranceles a los carbón de Corea del Norte. Los exportadores miran los barcos vacíos.', efectos: { dinero: -10 } }]
      },
      contra: {
        nombre: 'el libre comercio', controversia: 1,
        inicial: { dinero: 5 }, porTurno: { dinero: 2, inflacion: -0.6, felicidad: 0.2, estabilidad: -0.2 },
        texto: 'Se eliminan los aranceles. Las tiendas se llenan de productos baratos importados; algunas fábricas de la capital echan el cierre.'
      }
    },

    DEFORESTACION: {
      nombre: 'la selva', re: /\b(deforest\w*|reforest\w*|(tal\w*|quem\w*|arras\w*|proteg\w*|conserv\w*|salv\w*|cuid\w*|explot\w*) (la selva|los bosques|el bosque|los arboles|el amazonas))\b/,
      contraRe: /\b(proteg\w*|conserv\w*|reforest\w*|prohib\w*|parque\w*|salv\w*|plant\w*|cuid\w*)\b/,
      favor: {
        nombre: 'la tala de la selva', controversia: 1,
        inicial: { dinero: 20 }, porTurno: { dinero: 6, felicidad: -0.4 },
        texto: 'Se conceden licencias para talar la selva del sur. Los camiones de troncos bajan día y noche hacia el puerto.',
        programar: [{ en: 4, titulo: 'Las inundaciones', texto: 'Sin árboles que la frenen, la lluvia arrastra el barro hasta los pueblos del valle. Tres aldeas quedan bajo el agua.', efectos: { dinero: -15, felicidad: -4, estabilidad: -2 } }]
      },
      contra: {
        nombre: 'la protección de la selva', controversia: 0,
        inicial: { dinero: -5, felicidad: 1 }, porTurno: { dinero: -1, felicidad: 0.2 }, curvas: {},
        texto: 'La selva del sur pasa a ser parque nacional. Los madereros pierden sus licencias y los monos, por fin, duermen tranquilos.'
      }
    },

    JORNADA: {
      nombre: 'la jornada laboral', re: /\b(jornada( laboral)?|horas (de trabajo|diarias|al dia|semanales|a la semana)|semana laboral|trabajar (\d+ horas|los domingos|los sabados))\b/,
      contraRe: /\b(reduc\w*|menos horas|cuatro dias|4 dias|jornada corta|35 horas|6 horas|seis horas|descanso)\b/,
      favor: {
        nombre: 'la jornada laboral larga', controversia: 2,
        inicial: { felicidad: -5 }, porTurno: { dinero: 4, felicidad: -1.4, estabilidad: -0.4 },
        texto: 'La jornada laboral se alarga «por el bien de la patria». Los autobuses empiezan a circular a las cinco de la mañana y los bares cierran por falta de clientes despiertos.'
      },
      contra: {
        nombre: 'la jornada laboral corta', controversia: 1,
        inicial: { felicidad: 5 }, porTurno: { felicidad: 0.8, dinero: -2 }, curvas: { felicidad: 'acostumbra' },
        texto: 'Se trabaja menos horas por el mismo sueldo. Los empresarios predicen la ruina; los bares predicen un gran año.'
      }
    },

    VOTO_MUJERES: {
      nombre: 'el voto de las mujeres', re: /\b(voto (a |de )?las mujeres|sufragio femenino|(que )?las mujeres (no )?(puedan )?voten?)\b/,
      favor: {
        nombre: 'el voto de las mujeres', controversia: 0, unaVez: true,
        inicial: { felicidad: 1 }, notas: ['Las mujeres ya votan en Corea del Norte. El decreto se archiva con los obvios.']
      },
      contra: {
        nombre: 'la retirada del voto a las mujeres', controversia: 3,
        inicial: { felicidad: -12, estabilidad: -4, dinero: -5 }, porTurno: { felicidad: -2, estabilidad: -0.6 },
        texto: 'Un decreto retira el voto a la mitad del país. Esa noche, las mujeres de Sadong salen a la calle con cacerolas. La abuela Sun-ja lleva la más grande.',
        programar: [{ en: 2, titulo: 'La huelga de las mujeres', texto: 'Las mujeres dejan de trabajar, de cocinar y de ir a clase. Los hospitales, las escuelas y la mitad de los mercados cierran. El país se detiene.', efectos: { dinero: -15, estabilidad: -5 } }]
      }
    },

    BITCOIN: {
      nombre: 'el bitcoin', re: /\b(bitcoin\w*|cripto\w*)\b/,
      favor: {
        nombre: 'el bitcoin como moneda oficial', controversia: 1,
        inicial: { dinero: -10, felicidad: -1 }, porTurno: { dinero: 2, inflacion: -0.5, estabilidad: -0.3 },
        texto: 'El bitcoin pasa a ser moneda oficial. La abuela Sun-ja pone un cartel: «Tortitas: 0,00004 BTC». Nadie sabe darle el cambio.',
        programar: [{ en: 3, titulo: 'El desplome', texto: 'El bitcoin cae un 40% en una noche. Las reservas del Estado pierden un tercio de su valor mientras {cifuentes} duerme.', efectos: { dinero: -20, estabilidad: -2 } }]
      },
      contra: {
        nombre: 'la prohibición de las criptomonedas', controversia: 0,
        inicial: { estabilidad: 1 }, porTurno: {},
        texto: 'Se prohíben las criptomonedas. Tres jóvenes del barrio pierden su «inversión segura» y vuelven a casa de sus padres.'
      }
    },

    MURO: {
      nombre: 'el muro', re: /\b(muro|muralla)\b/,
      contraRe: /\b(derrib\w*|tumb\w*|demol\w*|abr\w*|quit\w*)\b/,
      favor: {
        nombre: 'el muro de la frontera', controversia: 2,
        inicial: { dinero: -40, estabilidad: 1 }, porTurno: { dinero: -2, estabilidad: 0.3, felicidad: -0.2 },
        texto: 'Empieza la construcción de un muro de seis metros en la frontera. La primera piedra la pone el Líder Supremo; la segunda, una empresa del cuñado de {cifuentes}.',
        programar: [{ en: 3, titulo: 'Escaleras de siete metros', texto: 'En los mercados de la frontera se venden escaleras de siete metros. Son el producto más vendido del mes.', efectos: { dinero: -4 } }]
      },
      contra: {
        nombre: 'el derribo del muro', controversia: 0,
        inicial: { felicidad: 4, dinero: -5 }, porTurno: {},
        texto: 'Se derriba el muro. La gente se lleva trozos a casa como recuerdo. Algunos los venden a los turistas.'
      }
    },

    EDAD_VOTO: {
      nombre: 'la edad para votar', re: /\b(edad (de|para) (votar|voto)|votar (a|desde) los \d+|voto (a los|de los) (\d+|ninos|niños|adolescentes|jovenes))\b/,
      contraRe: /\b(baj\w*|reduc\w*|ninos|niños|adolescentes|jovenes)\b/,
      favor: {
        nombre: 'la subida de la edad para votar', controversia: 2, prensa: 'libertad',
        inicial: { felicidad: -3, estabilidad: 1 }, porTurno: { felicidad: -0.3 },
        texto: 'Solo podrán votar los mayores de cuarenta años, «que ya han visto de todo». Los estudiantes salen a la calle; los jubilados, a la urna.'
      },
      contra: {
        nombre: 'el voto adolescente', controversia: 1, prensa: 'absurdo',
        inicial: { felicidad: 2, estabilidad: -1 }, porTurno: {},
        texto: 'Se rebaja la edad para votar. Los partidos abren cuentas en las redes de moda y prometen recreos más largos. Chol-su ya está haciendo campaña.',
        programar: [{ en: 3, titulo: 'El partido de los recreos', texto: 'Un partido de estudiantes de secundaria encabeza las encuestas con una sola promesa: prohibir los exámenes los viernes.', efectos: { estabilidad: -2, felicidad: 2 } }]
      }
    },

    CARCELES: {
      nombre: 'las cárceles', re: /\b(carcel\w*|prision\w*|penitenciari\w*)\b/,
      privatizar: /\b(privatiz\w*|vend\w*|concesion)\b/,
      contraRe: /\b(cerr\w*|vaci\w*|amnist\w*|liber\w* a los presos|abol\w*)\b/,
      favor: {
        nombre: 'la construcción de cárceles', controversia: 0,
        inicial: { dinero: -30, estabilidad: 1 }, porTurno: { dinero: -3, estabilidad: 0.4 }, curvas: { estabilidad: 'madura' },
        texto: 'Se construyen tres cárceles nuevas con capacidad para diez mil presos. De momento, Corea del Norte tiene cuatro mil. {sombra} dice que ya se llenarán.'
      },
      privada: {
        nombre: 'la privatización de las cárceles', controversia: 2,
        inicial: { dinero: 25 }, porTurno: { dinero: 4, felicidad: -0.5, estabilidad: -0.2 },
        texto: 'Las cárceles pasan a manos de Seguridad Patria S.A., que cobra al Estado por cada preso y por cada día. Su primer informe anual se titula «Oportunidades de crecimiento».',
        programar: [{ en: 3, titulo: 'Presos rentables', texto: 'La empresa de las cárceles pide más presos para cumplir sus objetivos. La policía detiene a un señor por silbar en la calle.', efectos: { felicidad: -3, dinero: -3 } }]
      },
      contra: {
        nombre: 'la amnistía general', controversia: 1,
        inicial: { felicidad: 3, estabilidad: -4, dinero: 5 }, porTurno: { estabilidad: -0.5 },
        texto: 'Se vacían las cárceles. Los presos salen con una bolsa de plástico y un bocadillo. Algunos vuelven a casa; otros, al trabajo de siempre.'
      }
    }
  };
})(globalThis.RF = globalThis.RF || {});
