/*
 * ACCIONES EXTERIORES
 * Lo que un régimen aislado hace fuera de sus fronteras para conseguir divisas o influencia:
 * vender armas, armar guerrillas, apoyar golpes, pedir préstamos, mandar trabajadores, robar bancos por internet,
 * el contrabando de barco a barco. Tienen la misma forma que los temas duros (datos/temas.js), más:
 *   {destino}      a quién va dirigida la acción ("una guerrilla africana"), sacado del propio decreto
 *   destino        el destino por defecto si el decreto no lo dice
 *   programarUno   varias consecuencias posibles: sale una al azar (la operación sale bien, mal o regular)
 * Se ponen delante de los demás temas para que "vender armas" no se confunda con privatizar la industria de armas.
 */
(function (RF) {
  'use strict';

  const EXTERIOR = {
    VENTA_ARMAS: {
      nombre: 'la venta de armas', destino: 'un cliente discreto',
      destinoRe: /(?:armas|fusiles|kalashnikovs?|munici[oó]n|misiles|cohetes|lanzacohetes|tanques|armamento|granadas|artiller[ií]a)\s+(?:a|al|para|hacia)\s+([^,.;]{2,60})$/i,
      re: /\b((vend\w*|export\w*|suministr\w*|colocar|mand\w*|envi\w*) (\w+ ){0,2}(armas|fusiles|kalashnikov\w*|municion\w*|misiles|cohetes|lanzacohetes|tanques|armamento|granadas|artilleria)|trafic\w* (con|de) armas|trafico de armas)\b/,
      contraRe: /\b(dej\w* de|par(ar|en|e) de|cancel\w*|prohib\w*|no (vender|mas)|embargo)\b/,
      favor: {
        nombre: 'la venta de armas a {destino}', controversia: 3, prensa: 'economia',
        economia: { sanciones: 1 }, relaciones: { eeuu: -8, surcorea: -4, japon: -4, china: -3 },
        inicial: { dinero: 25, ejercito: 3 }, porTurno: { dinero: 6 },
        texto: 'Un barco con bandera de un país que no existe zarpa de Nampo con cajas que dicen "maquinaria agrícola". La maquinaria agrícola dispara seiscientas balas por minuto. {Destino} paga en efectivo, en oro y con un loro que nadie había pedido.',
        notas: ['Es dinero rápido y constante, pero viola las sanciones de la ONU: si se descubre, saldrá caro.'],
        programarUno: [
          { en: 3, titulo: 'Las armas salen en la tele', texto: 'Un periodista extranjero graba a {destino} disparando fusiles con el sello de una fábrica de Pionyang. {montiel} explica que los fusiles "se perdieron en una mudanza".', efectos: { dinero: -5, estabilidad: -1 }, sanciones: 1, relaciones: { eeuu: -8, japon: -3 } },
          { en: 3, titulo: 'Cliente satisfecho', texto: '{Destino} hace un segundo pedido y paga por adelantado. Incluye una nota de agradecimiento escrita a mano y con tres faltas de ortografía.', efectos: { dinero: 15, ejercito: 2 } },
          { en: 4, titulo: 'El cliente no paga', texto: '{Destino} ha perdido su guerra, o la ha ganado y ya no necesita pagar. La última entrega nunca se cobra. {cifuentes} lo apunta en la columna de "inversiones ideológicas".', efectos: { dinero: -12 } }
        ]
      },
      contra: {
        nombre: 'el fin de la venta de armas', controversia: 0, relaciones: { eeuu: 4, japon: 2 },
        inicial: { dinero: -5, ejercito: -2 }, porTurno: {},
        texto: 'Se cancelan los envíos de "maquinaria agrícola". En el puerto de Nampo sobran doscientas cajas que nadie sabe dónde guardar. Se guardan en un colegio.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['Oficialmente, Corea del Norte nunca ha vendido armas. El decreto se archiva con los demás que nunca existieron.'] }
    },

    GUERRILLA_FUERA: {
      nombre: 'el apoyo a una guerrilla', destino: 'una guerrilla lejana',
      destinoRe: /((?:la |las |los |una |unas |unos |el )?(?:guerrilla|rebelde|insurgente|revolucionari|movimiento|milicia|terrorista)[^,.;]{0,60})$/i,
      re: /\b(financi\w*|arm(ar|en|e|emos)|entren\w*|apoy\w*|ayud\w*|patrocin\w*|instru\w*|asesor\w*) (a )?(la |las |los |una |unas |unos |el )?(guerrilla\w*|rebeldes?|insurgent\w*|revolucionari\w*|movimientos? de liberacion|milicias? (de|en)|terroristas?)\b/,
      contraRe: /\b(dej\w* de|par(ar|en|e) de|abandon\w*|retir\w*|cort\w*|no (apoyar|financiar|mas))\b/,
      favor: {
        nombre: 'el apoyo a {destino}', controversia: 3, prensa: 'culto',
        relaciones: { eeuu: -10, china: -5, japon: -3 },
        inicial: { dinero: -10, ejercito: 4 }, porTurno: { dinero: -3 },
        texto: 'Instructores norcoreanos vestidos de "turistas agrícolas" llegan a los campamentos de {destino}. En dos semanas los guerrilleros desfilan en perfecta sincronía. Disparar, todavía un poco menos.',
        programarUno: [
          { en: 4, titulo: '{Destino} gana', texto: '{Destino} toma la capital. El nuevo gobierno cuelga tu retrato junto al de su líder y te paga con un contrato de minas. Resulta que son de cobre, pero algo es algo.', efectos: { dinero: 30, estabilidad: 3, ejercito: 3 } },
          { en: 4, titulo: '{Destino} es aplastada', texto: 'En el último campamento de {destino} aparecen manuales de guerrilla escritos en coreano, con dibujos. La ONU tarda poco en leerlos.', efectos: { estabilidad: -2 }, sanciones: 1, relaciones: { eeuu: -8 } },
          { en: 4, titulo: 'Guerra eterna', texto: '{Destino} ni gana ni pierde. Sigue pidiendo dinero, munición y ahora también una máquina de karaoke "para la moral".', efectos: { dinero: -8 } }
        ]
      },
      contra: {
        nombre: 'el abandono de {destino}', controversia: 0, relaciones: { eeuu: 4 },
        inicial: { ejercito: -2 }, porTurno: {},
        texto: 'Retiras a los "turistas agrícolas". {Destino} manda una carta llamándote traidor al internacionalismo. La carta llega con franqueo insuficiente.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había ninguna guerrilla a la que dejar de apoyar. Que se sepa.'] }
    },

    GOLPE_FUERA: {
      nombre: 'un golpe en el extranjero', destino: 'un país lejano',
      destinoRe: /golpe(?: de estado)? (?:en|contra) ([^,.;]{2,60})$/i,
      re: /\b(apoy\w*|organiz\w*|financi\w*|provoc\w*|promov\w*|dar|preparar|planear|orquest\w*) (un )?golpe( de estado)? (en|contra) /,
      favor: {
        nombre: 'el golpe de Estado en {destino}', controversia: 3, unaVez: true, prensa: 'secreto',
        inicial: { dinero: -20, elite: 2 }, relaciones: { eeuu: -6, china: -8 },
        texto: 'Tres coroneles de {destino} reciben un maletín, un manual y un curso acelerado de desfile. Si sale bien, tendrás un aliado. Si sale mal, tendrás una explicación que dar.',
        programarUno: [
          { en: 3, titulo: 'El golpe triunfa', texto: 'El golpe en {destino} triunfa. El nuevo presidente, un coronel que estudió en Pionyang, te regala una mina de uranio... que resulta ser de cobre. Aun así, es un aliado.', efectos: { dinero: 25, estabilidad: 3 } },
          { en: 3, titulo: 'El golpe fracasa', texto: 'El golpe en {destino} dura tres horas. Los golpistas confiesan en televisión, en un coreano sorprendentemente bueno.', efectos: { estabilidad: -3 }, sanciones: 1, relaciones: { eeuu: -10, china: -6 } }
        ]
      },
      contra: { nombre: 'la renuncia a los golpes', unaVez: true, inicial: {}, notas: ['Prometes no organizar golpes en otros países. Nadie te creía capaz; ahora tampoco.'] }
    },

    PRESTAMO: {
      nombre: 'el préstamo', destino: 'China',
      destinoRe: /(?:pr[eé]stamo|cr[eé]dito|rescate|deuda)\s+(?:a|de|con|al)\s+([^,.;]{2,50})$/i,
      re: /\b((pedir|pedirle|solicitar|negociar|conseguir|firmar) (\w+ ){0,3}(prestamo|credito|rescate)|prestamo (de|a|con)|(no pagar|dejar de pagar|impago de|suspender el pago de)( el| la)? (prestamo|deuda|credito))\b/,
      contraRe: /\b(no pagar|dejar de pagar|impago|suspender el pago|default)\b/,
      favor: {
        nombre: 'el préstamo de {destino}', controversia: 0, prensa: 'economia',
        inicial: { dinero: 45 }, porTurno: { dinero: -5 }, duracion: 12, relaciones: { china: 3 },
        texto: '{Destino} te presta 45 millones al 12% y con una cláusula en letra pequeña: si no pagas, se queda con el puerto de Rason. {cifuentes} firma sin leerla. Nadie lee nunca la letra pequeña.',
        notas: ['Durante 12 turnos pagarás 5 millones cada turno.']
      },
      contra: {
        nombre: 'el impago de la deuda', controversia: 1, relaciones: { china: -12 },
        inicial: { dinero: 5, elite: -3 }, porTurno: {},
        texto: 'Anuncias que no pagarás "hasta que el imperialismo devuelva lo robado". Los acreedores no saben a qué te refieres. Tú tampoco, pero suena firme.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No hay deuda que dejar de pagar. Por una vez.'] }
    },

    TRABAJADORES_FUERA: {
      nombre: 'los trabajadores en el extranjero', destino: 'Rusia y China',
      destinoRe: /(?:trabajadores|obreros|alba[nñ]iles|le[nñ]adores|mano de obra|brigadas de trabajo)\s+(?:a|al|hacia|para|de)\s+([^,.;]{2,50})$/i,
      re: /\b(enviar|mandar|exportar|alquilar|prestar) (\w+ ){0,2}(trabajadores|obreros|albaniles|lenadores|mano de obra|brigadas de trabajo)\b/,
      contraRe: /\b(traer de vuelta|repatri\w*|dej\w* de|par(ar|en|e) de|no (enviar|mandar))\b/,
      favor: {
        nombre: 'los trabajadores enviados a {destino}', controversia: 1, prensa: 'economia',
        inicial: { dinero: 5 }, porTurno: { dinero: 5, felicidad: -0.4 }, relaciones: { eeuu: -3 },
        texto: 'Veinte mil obreros suben a trenes hacia {destino}. Allí cortarán madera y levantarán edificios doce horas al día. El Estado se queda con el noventa por ciento del sueldo "para gastos de representación".',
        programar: [{ en: 4, titulo: 'Los que no vuelven', texto: 'Tres obreros desaparecen de una obra en {destino}. Semanas después aparecen en Seúl, dando entrevistas en las que no hablan bien de ti.', efectos: { estabilidad: -2, elite: -2 }, relaciones: { surcorea: 3 } }]
      },
      contra: {
        nombre: 'la vuelta de los trabajadores', controversia: 0,
        inicial: { felicidad: 2, dinero: -3 }, porTurno: {},
        texto: 'Los obreros vuelven de {destino} con maletas llenas de ropa, aparatos y una idea muy clara de cómo se vive fuera. Lo último no pasa por la aduana, pero entra igual.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había trabajadores fuera que traer de vuelta.'] }
    },

    CIBERROBO: {
      nombre: 'el golpe informático', destino: 'un banco extranjero',
      destinoRe: /((?:el |los |un |unos |la |las )?(?:bancos?|exchanges?|cajeros|criptomonedas?)[^,.;]{0,50})$/i,
      re: /\b((hacke\w*|robar|roben|asaltar|vaciar) (\w+ ){0,3}(bancos?|criptomonedas?|bitcoins?|exchanges?|cajeros)|ciberrob\w*|ciberataques? (a|al|contra) (\w+ )?(bancos?|exchanges?)|robar (dinero|dolares) por internet)\b/,
      favor: {
        nombre: 'el golpe informático a {destino}', controversia: 2, unaVez: true, prensa: 'secreto',
        inicial: { dinero: 35, elite: 2 }, relaciones: { eeuu: -8, surcorea: -4, japon: -3 },
        texto: 'Doce hackers de la Oficina 121 trabajan tres noches seguidas con fideos instantáneos y un único ventilador. A la cuarta, las cuentas de {destino} amanecen más ligeras.',
        programarUno: [
          { en: 3, titulo: 'Rastro digital', texto: 'Un informe del FBI atribuye el robo a "un grupo de hackers con sede en Pionyang y una sorprendente afición por el karaoke".', efectos: { estabilidad: -1 }, sanciones: 1, relaciones: { eeuu: -6 } },
          { en: 3, titulo: 'El robo perfecto', texto: 'Nadie descubre de dónde salió el dinero. Los hackers reciben un piso en Pionyang y una medalla que no pueden enseñar a nadie.', efectos: { elite: 2 } }
        ]
      },
      contra: { nombre: 'el fin de los ciberataques', unaVez: true, inicial: {}, notas: ['Oficialmente, la Oficina 121 se dedica a la jardinería.'] }
    },

    CONTRABANDO: {
      nombre: 'el contrabando', destino: 'China',
      destinoRe: /\s(?:a|con|hacia|para)\s+([^,.;]{2,40})$/i,
      re: /\b(contraband\w*|de barco a barco|vender (\w+ ){0,2}de contrabando|pasar (\w+ ){0,2}de contrabando|saltarse las sanciones|burlar las sanciones)\b/,
      no: /\b(armas|fusiles|misiles|cocaina|drogas?|heroina|metanfetamina)\b/,
      contraRe: /\b(dej\w* de|par(ar|en|e) de|persegu\w*|prohib\w*|acab\w* con|combat\w*)\b/,
      favor: {
        nombre: 'el contrabando con {destino}', controversia: 2, prensa: 'economia',
        economia: { mercadoNegro: 5 }, relaciones: { eeuu: -5 },
        inicial: { dinero: 5 }, porTurno: { dinero: 7, estabilidad: -0.2 },
        texto: 'De noche, en alta mar, barcos sin nombre pasan carbón a barcos sin bandera rumbo a {destino}. Los satélites lo ven todo. Los aduaneros, curiosamente, nada.',
        programarUno: [
          { en: 4, titulo: 'Pillados en alta mar', texto: 'Un satélite japonés fotografía dos barcos pegados en mitad del mar con la carga a medio pasar. La foto llega a la ONU antes que el carbón a puerto.', efectos: { dinero: -8 }, sanciones: 1, relaciones: { japon: -6, eeuu: -4 } },
          { en: 4, titulo: 'Negocio redondo', texto: 'El contrabando va tan bien que los capitanes ya tienen tarjetas de visita. En la tarjeta pone "pescadores".', efectos: { dinero: 6, elite: 2 } }
        ]
      },
      contra: {
        nombre: 'la persecución del contrabando', controversia: 0, relaciones: { eeuu: 3 },
        inicial: { elite: -4 }, porTurno: { dinero: -1 },
        texto: 'Mandas guardacostas a perseguir a los contrabandistas. Los guardacostas eran los principales clientes de los contrabandistas.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['Oficialmente no había contrabando. Los barcos que lo hacían siguen sin existir.'] }
    }
  };

  // Delante de los demás temas: "vender armas" no es privatizar la industria de armas.
  RF.TEMAS = Object.assign({}, EXTERIOR, RF.TEMAS);
})(globalThis.RF = globalThis.RF || {});
