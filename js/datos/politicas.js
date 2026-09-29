/*
 * POLÍTICAS ECONÓMICAS Y SOCIALES
 * Medidas clásicas de un régimen que el clasificador general no sabe tratar: control de precios,
 * racionamiento, reforma monetaria, la tierra, el songbun, grandes obras, zonas especiales, comercio, ayuda
 * humanitaria, sueldos públicos, servicio militar, amnistía, corrupción, burocracia, natalidad, emigración,
 * tipos de interés, combustible, salud, campañas de producción, casinos, vigilancia de la élite y turismo.
 * Misma forma que los temas duros (datos/temas.js). Sus porqués salen de la biblioteca de conceptos.
 */
(function (RF) {
  'use strict';

  const POLITICAS = {
    CONTROL_PRECIOS: {
      nombre: 'los precios',
      re: /\b((congel\w*|fij\w*|top\w*|limit\w*|control\w*|baj\w*|liber\w*|soltar) (\w+ ){0,2}precios?|precios? (maximos?|oficial(es)?|justos?|topados?|congelados?)|control de precios)\b/,
      contraRe: /\b(liber\w*|soltar|desregul\w*|dej\w* de (controlar|congelar|fijar)|acab\w* con (el )?control)\b/,
      favor: {
        nombre: 'la congelación de precios', controversia: 0, prensa: 'regalo',
        inicial: { inflacion: -4, felicidad: 3 }, porTurno: { inflacion: -0.5, felicidad: -0.6 }, economia: { mercadoNegro: 10 },
        texto: 'El Estado fija el precio justo del arroz, el aceite y el jabón. Los precios justos se imprimen en carteles preciosos. Los productos, en cambio, desaparecen de las tiendas esa misma tarde.',
        programar: [{ en: 2, titulo: 'Las tiendas vacías', texto: 'Las tiendas del Estado tienen el arroz al precio oficial. Lo que no tienen es arroz. El arroz está en el mercado, al triple, y el vendedor lo llama "precio de patriota".', efectos: { felicidad: -4 } }]
      },
      contra: {
        nombre: 'la liberación de precios', controversia: 1, prensa: 'economia',
        inicial: { inflacion: 5, felicidad: -3 }, porTurno: { inflacion: 0.3, felicidad: 0.2 }, economia: { mercadoNegro: -8 },
        texto: 'Los precios quedan libres. El primer día suben todos. El segundo, por primera vez en años, hay arroz en las tiendas.'
      },
      sinLey: { unaVez: true, inicial: { inflacion: 2 }, notas: ['No había precios congelados: ya eran libres, aunque nadie lo dijera.'] }
    },

    RACIONAMIENTO: {
      nombre: 'el racionamiento',
      re: /\b(racion\w*|cartillas?|libretas? de abastecimiento|cupon(es)? de comida|sistema publico de distribucion)\b/,
      contraRe: /\b(acab\w*|elimin\w*|quit\w*|abol\w*|suprim\w*|fin de|dej\w* de|sin)\b/,
      favor: {
        nombre: 'el racionamiento', controversia: 0, prensa: 'esencial',
        inicial: { felicidad: -3, inflacion: -2 }, porTurno: { dinero: -2, felicidad: -0.3, estabilidad: 0.2, inflacion: -0.4 }, economia: { mercadoNegro: 5 },
        texto: 'Cada familia recibe una cartilla: 400 gramos de cereal al día por persona, más si trabajas en el Partido, menos si tu abuelo estuvo en el bando equivocado. La cola empieza a las cinco de la mañana.'
      },
      contra: {
        nombre: 'el fin de las cartillas', controversia: 1,
        inicial: { felicidad: 1, inflacion: 3 }, porTurno: { dinero: 1 },
        texto: 'Se acaban las cartillas. Quien tiene dinero compra en el mercado; quien no, descubre que la cartilla era poco, pero era algo.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['Las cartillas oficiales ya no llegaban a nadie fuera de Pionyang. Nadie nota la diferencia.'] }
    },

    REFORMA_MONETARIA: {
      nombre: 'la reforma monetaria',
      re: /\b((cambi\w*|canj\w*|sustitu\w*|renov\w*) (\w+ ){0,2}(billetes|moneda)|nueva moneda|nuevo won|quit\w* (los |tres |dos )?ceros|reforma monetaria|redenominaci\w*)\b/,
      no: /\b(bitcoin\w*|cripto\w*|dolar\w*|yuan\w*|euro\w*)\b/,
      contraRe: /\b(no cambiar|anular la reforma|volver (al|a los) (won|billetes) viejos?)\b/,
      favor: {
        nombre: 'la reforma monetaria', controversia: 1, unaVez: true, prensa: 'economia',
        inicial: { inflacion: -15, felicidad: -10, estabilidad: -5, elite: -5, dinero: 10 }, economia: { mercadoNegro: -15 },
        texto: 'Mañana circula el nuevo won, con dos ceros menos y tu cara en más grande. Cada familia puede cambiar como máximo cien mil wones viejos. El resto de sus ahorros sirve, a partir de hoy, para encender la estufa.',
        programar: [{ en: 2, titulo: 'La rabia de los ahorradores', texto: 'Las vendedoras del mercado, que guardaban sus ahorros en wones viejos, se plantan frente al edificio del Partido. Es la primera protesta en años. {sombra} no sabe si detenerlas o darles la razón.', efectos: { estabilidad: -4, felicidad: -3 } }]
      },
      contra: { nombre: 'la vuelta a la moneda de siempre', unaVez: true, inicial: { felicidad: 2 }, notas: ['Nadie había cambiado la moneda. El won de siempre sigue valiendo lo de siempre: poco.'] }
    },

    TIERRA: {
      nombre: 'la tierra',
      re: /\b(reforma agraria|repart\w* (\w+ ){0,2}tierras?|tierras? (a|para) (los |las )?(campesinos|familias)|parcelas? (familiares|privadas)|colectiviz\w*|granjas? colectivas?|comunas? (agricolas|populares)|cooperativas? agricolas?)\b/,
      contraRe: /\b(colectiviz\w*|granjas? colectivas?|comunas?|cooperativas? agricolas?)\b/,
      favor: {
        nombre: 'el reparto de tierras a las familias', controversia: 1, prensa: 'regalo',
        inicial: { felicidad: 5, elite: -4, estabilidad: -1 }, porTurno: { dinero: 1, felicidad: 0.5, inflacion: -0.6 }, curvas: { dinero: 'madura', inflacion: 'madura' },
        texto: 'Cada familia campesina recibe una parcela y puede vender lo que le sobre. El primer año nadie se lo cree y siembran poco, por si acaso. El segundo, las cosechas se duplican.'
      },
      contra: {
        nombre: 'la colectivización del campo', controversia: 1, prensa: 'culto',
        inicial: { estabilidad: 1, felicidad: -5, elite: 3 }, porTurno: { felicidad: -0.6, inflacion: 0.6, dinero: -1 },
        texto: 'Las parcelas pasan a las granjas colectivas. Los campesinos trabajan en brigadas, cantando, bajo la mirada de un cuadro del Partido que no ha sembrado nunca. Los informes de producción son excelentes. Las cosechas, no tanto.'
      }
    },

    SONGBUN: {
      nombre: 'el songbun',
      re: /\b(songbun|castas?|clases? social(es)?|origen familiar|familias? (leales|hostiles))\b/,
      contraRe: /\b(abol\w*|elimin\w*|acab\w*|quit\w*|igual\w*|suprim\w*|derog\w*|fin (de|del)|romper)\b/,
      favor: {
        nombre: 'el endurecimiento del songbun', controversia: 2, prensa: 'libertad',
        inicial: { elite: 4, felicidad: -3, estabilidad: 1 }, porTurno: { felicidad: -0.3 },
        texto: 'Se revisan los expedientes de todas las familias hasta la tercera generación. Un nieto de un terrateniente de 1945 descubre que ya no puede estudiar medicina. Tampoco sabía que su abuelo tenía tierras.'
      },
      contra: {
        nombre: 'la abolición del songbun', controversia: 2, prensa: 'regalo',
        inicial: { felicidad: 6, elite: -8, estabilidad: -3 }, porTurno: { felicidad: 0.4 },
        texto: 'Se queman los expedientes de origen familiar. Por primera vez, un chico del campo puede pedir plaza en la universidad de Pionyang. Las familias de buen songbun miran sus privilegios como quien ve un helado derretirse.'
      }
    },

    INFRAESTRUCTURA: {
      nombre: 'las grandes obras',
      re: /\b((constru\w*|levant\w*|hac\w*|edific\w*|invert\w* en) (\w+ ){0,2}(presas?|embalses?|autopistas?|carreteras?|aeropuertos?|puertos?|ferrocarril\w*|tren(es)?|vias? del tren|puentes?|central(es)? (electricas?|hidroelectricas?|nuclear(es)?|solar(es)?|de carbon)|rascacielos|metro|tunel(es)?)|obras? (\w+ ){0,3}(presas?|embalses?|autopistas?|carreteras?|aeropuertos?|puertos?|ferrocarril\w*|tren(es)?|vias? del tren|puentes?|central(es)? (electricas?|hidroelectricas?|nuclear(es)?|solar(es)?|de carbon)|rascacielos|metro|tunel(es)?)|grandes obras|obras publicas)\b/,
      no: /\b(bomba|misil\w*|armas?)\b/,
      contraRe: /\b(parar|paraliz\w*|cancel\w*|abandon\w*|dej\w* de construir|suspend\w*)\b/,
      favor: {
        nombre: 'las grandes obras', controversia: 0, prensa: 'obra',
        inicial: { dinero: -40, felicidad: 2 }, porTurno: { dinero: 4, felicidad: 0.3, estabilidad: 0.2 }, curvas: { dinero: 'lenta', felicidad: 'madura' },
        texto: 'Brigadas de voluntarios obligatorios empiezan las obras con palas, carretillas y un altavoz que pone marchas militares. El plazo oficial es de 70 días. El real, nadie se atreve a calcularlo.'
      },
      contra: {
        nombre: 'la paralización de las obras', controversia: 0,
        inicial: { dinero: 15, felicidad: -2, elite: -2 }, porTurno: {},
        texto: 'Se paran las obras. Queda un esqueleto de hormigón en mitad del campo que los niños usan para jugar a la guerra y los adultos para no mirar.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había grandes obras en marcha. Hay alguna pequeña, pero esas no se paran: se pierden solas.'] }
    },

    ZONA_ESPECIAL: {
      nombre: 'la zona económica especial',
      re: /\b(zonas? (economicas? )?especial\w*|zonas? francas?|zonas? de libre comercio|zonas? industrial(es)? (con|para) extranjeros|abrir (\w+ ){0,2}(pais|puertos?) (al|a la) (inversion|capital) extranjer\w*)\b/,
      contraRe: /\b(cerr\w*|elimin\w*|acab\w*|suprim\w*|abol\w*)\b/,
      favor: {
        nombre: 'la zona económica especial', controversia: 1, prensa: 'economia',
        inicial: { dinero: -10, elite: -2 }, porTurno: { dinero: 6, felicidad: 0.2, estabilidad: -0.2 }, curvas: { dinero: 'madura' }, relaciones: { china: 6, surcorea: 3 },
        texto: 'En la costa, junto a Rason, se levanta una valla de tres metros. Dentro, fábricas chinas, sueldos en yuanes y un hotel con wifi. Fuera, todo igual. La valla es lo más importante del proyecto.',
        programar: [{ en: 4, titulo: 'Lo que se ve desde la valla', texto: 'Los obreros de la zona especial vuelven a casa con relojes, zapatillas y preguntas. Las zapatillas se venden en el mercado; las preguntas, en voz baja.', efectos: { elite: -2, felicidad: 1 } }]
      },
      contra: {
        nombre: 'el cierre de la zona especial', controversia: 0, relaciones: { china: -6 },
        inicial: { elite: 2, dinero: -5 }, porTurno: {},
        texto: 'Se cierra la zona especial. Los inversores chinos se llevan las máquinas; los obreros, los relojes.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había zona especial que cerrar.'] }
    },

    COMERCIO_EXTERIOR: {
      nombre: 'el comercio exterior',
      re: /\b(importar|importaciones|comprar (\w+ ){0,2}(en el )?extranjero|comprar (\w+ ){0,3}a (china|rusia)|abrir (\w+ ){0,2}fronteras? (con|a)|abrir el comercio|comerciar con)\b/,
      contraRe: /\b(prohib\w*|cerr\w*|dej\w* de|par(ar|en|e) de|no (importar|comprar)|autarqu\w*|autosuficien\w*)\b/,
      favor: {
        nombre: 'la apertura al comercio', controversia: 1, prensa: 'economia',
        inicial: { dinero: -8, felicidad: 3, inflacion: -2 }, porTurno: { dinero: -2, felicidad: 0.4, inflacion: -0.4 }, relaciones: { china: 5 },
        texto: 'Se abren los pasos fronterizos con China a los camiones de mercancías. En una semana, los mercados tienen arroz del sur de China, jabón que hace espuma y termos con dibujos animados.'
      },
      contra: {
        nombre: 'la autarquía', controversia: 1, prensa: 'culto',
        inicial: { felicidad: -4, dinero: 5 }, porTurno: { felicidad: -0.5, inflacion: 0.8 }, relaciones: { china: -5 },
        texto: 'Se proclama la autosuficiencia total: Corea del Norte producirá todo lo que consuma. Lo que no produzca, dejará de consumirse. Lo primero que deja de consumirse es el azúcar.'
      },
      sinLey: { unaVez: true, inicial: { felicidad: -1 }, notas: ['El comercio ya estaba bastante cerrado. El decreto lo cierra un poco más, por si acaso.'] }
    },

    AYUDA_HUMANITARIA: {
      nombre: 'la ayuda humanitaria',
      re: /\b(ayuda humanitaria|ayuda alimentaria|ayuda internacional|donaciones de (comida|arroz|trigo)|ong\w*|programa mundial de alimentos)\b/,
      contraRe: /\b(rechaz\w*|expuls\w*|prohib\w*|no (aceptar|queremos)|devolv\w*|rehus\w*)\b/,
      favor: {
        nombre: 'la aceptación de ayuda humanitaria', controversia: 0, unaVez: true, prensa: 'regalo',
        inicial: { dinero: 10, felicidad: 5, elite: -2, inflacion: -2 }, relaciones: { eeuu: 4, surcorea: 5, japon: 2 },
        texto: 'Llegan barcos con trigo de la ONU. Los sacos dicen "donación del pueblo americano". {paredes} ordena poner encima una pegatina que dice "regalo del Líder Supremo". No hay pegatinas para todos.',
        programar: [{ en: 2, titulo: 'Los inspectores de la ayuda', texto: 'Los inspectores de la ONU piden ver dónde acaba el trigo. {sombra} les enseña un orfanato modelo, limpísimo, con niños que sonríen en perfecta sincronía.', efectos: { elite: -2 } }]
      },
      contra: {
        nombre: 'el rechazo de la ayuda humanitaria', controversia: 0, unaVez: true, prensa: 'culto',
        inicial: { felicidad: -4, ejercito: 2, elite: 2 }, relaciones: { surcorea: -4 },
        texto: 'Devuelves los barcos de trigo: Corea del Norte no necesita limosnas. El discurso es muy aplaudido. El trigo, que ya estaba descargado, se reparte discretamente entre el ejército.'
      }
    },

    SUELDOS_ESTADO: {
      nombre: 'los sueldos públicos',
      re: /\b(sub\w*|aument\w*|baj\w*|recort\w*|reduc\w*|congel\w*|pag\w*) (\w+ ){0,2}(sueldos?|salarios?|pagas?|nominas?) (de |a )?(los |las )?(funcionarios|maestros|profesores|medicos|enfermeras|obreros|trabajadores del estado|empleados publicos|cuadros)\b/,
      contraRe: /\b(baj\w*|recort\w*|reduc\w*|congel\w*|quit\w*)\b/,
      favor: {
        nombre: 'la subida de los sueldos públicos', controversia: 0, prensa: 'regalo',
        inicial: { felicidad: 4, elite: 2 }, porTurno: { dinero: -6, felicidad: 0.5, inflacion: 0.5 }, curvas: { felicidad: 'acostumbra' },
        texto: 'Los funcionarios cobrarán el doble. El doble de muy poco sigue siendo poco, pero ahora alcanza para una gallina al mes.'
      },
      contra: {
        nombre: 'el recorte de los sueldos públicos', controversia: 1, prensa: 'esencial',
        inicial: { felicidad: -4, elite: -3 }, porTurno: { dinero: 5, felicidad: -0.6 }, economia: { mercadoNegro: 4 },
        texto: 'Se recortan los sueldos del Estado. Los maestros empiezan a cobrar a los alumnos "clases de refuerzo" y los médicos, "consultas de cortesía".'
      }
    },

    SERVICIO_MILITAR: {
      nombre: 'el servicio militar',
      re: /\b(servicio militar|mili|conscripci\w*|reclutamiento|reclut\w* (a )?(todos|los jovenes)|levas?)\b/,
      contraRe: /\b(reduc\w*|acort\w*|elimin\w*|abol\w*|quit\w*|voluntari\w*|baj\w*)\b/,
      favor: {
        nombre: 'el servicio militar de doce años', controversia: 1, prensa: 'culto',
        inicial: { ejercito: 6, felicidad: -4 }, porTurno: { ejercito: 0.5, dinero: -2, felicidad: -0.4 },
        texto: 'El servicio militar pasa a durar doce años. Los chicos entran con diecisiete y salen con veintinueve, sabiendo desfilar, cavar trincheras y cultivar el maíz del cuartel. Casi nada más.'
      },
      contra: {
        nombre: 'la reducción del servicio militar', controversia: 1,
        inicial: { ejercito: -8, felicidad: 5 }, porTurno: { dinero: 3, felicidad: 0.4, ejercito: -0.4 },
        texto: 'El servicio militar se reduce a cinco años. Cien mil jóvenes vuelven a casa antes de tiempo. Sus madres lloran de alegría; sus generales, de otra cosa.'
      }
    },

    AMNISTIA: {
      nombre: 'la amnistía',
      re: /\b(amnist\w*|indult\w*|liber\w* (a )?(los )?presos( politicos)?|abrir las carceles|perdon\w* a los presos)\b/,
      contraRe: /\b(cancel\w*|anul\w*|revoc\w*)\b/,
      favor: {
        nombre: 'la amnistía para los presos políticos', controversia: 1, unaVez: true, prensa: 'regalo',
        inicial: { felicidad: 6, estabilidad: -4, elite: -3 }, relaciones: { eeuu: 6, surcorea: 8, japon: 3 },
        texto: 'Se abren las puertas de los campos. Salen hombres y mujeres que llevan años sin ver un espejo. Algunos vuelven a casa; otros, a contarlo.',
        programar: [{ en: 3, titulo: 'Los que cuentan', texto: 'Un amnistiado cruza a China y da una entrevista a la prensa extranjera. Nombra a guardias, a jueces y a un ministro. El ministro pide una semana de vacaciones.', efectos: { estabilidad: -2, elite: -2 } }]
      },
      contra: { nombre: 'la anulación de la amnistía', unaVez: true, inicial: { estabilidad: 1, felicidad: -3 }, notas: ['No había ninguna amnistía que anular. Los presos siguen donde estaban.'] }
    },

    CORRUPCION: {
      nombre: 'la corrupción',
      sinParar: true, re: /\b(corrupci\w*|corrupt\w*|sobornos?|mordidas?|coimas?)\b/,
      no: /\b(diputados|jueces|congreso|asamblea|paredon|fusil\w*|ejecut\w*|ahorc\w*|encarcel\w*|carcel)\b/,
      contraRe: /\b(dej\w* de (perseguir|combatir|luchar)|perdon\w*|toler\w*|legaliz\w*|permit\w*|mirar hacia otro lado|hacer la vista gorda|ignor\w*)\b/,
      favor: {
        nombre: 'la campaña contra la corrupción', controversia: 0, prensa: 'represion',
        inicial: { felicidad: 4, elite: -8, estabilidad: 1 }, porTurno: { dinero: 2, elite: -0.6, felicidad: 0.2 },
        texto: 'Empieza la gran campaña contra la corrupción. Los primeros detenidos son, casualmente, los que menos te querían. Los que más te quieren descubren de repente una gran pasión por la honradez.',
        programar: [{ en: 3, titulo: 'El miedo en Palacio', texto: 'Los cuadros del Partido dejan de firmar nada por miedo a que sea la prueba de algo. La burocracia, que ya era lenta, se detiene.', efectos: { dinero: -4, elite: -2 } }]
      },
      contra: {
        nombre: 'la tolerancia con la corrupción', controversia: 1, prensa: 'economia',
        inicial: { elite: 6, felicidad: -3 }, porTurno: { dinero: -2, elite: 0.4, felicidad: -0.3 }, economia: { mercadoNegro: 5 },
        texto: 'Se deja claro que los regalos entre camaradas son "gestos de amistad socialista". Los cuadros lo celebran con gestos de amistad socialista de todos los tamaños.'
      }
    },

    BUROCRACIA: {
      nombre: 'la burocracia',
      re: /\b(burocra\w*|despedir (a )?(los )?funcionarios|funcionarios sobrantes|papeleo|tramites|contratar (mas )?funcionarios|ministerios? (inutiles|sobrantes))\b/,
      contraRe: /\b(contrat\w*|ampli\w*|mas funcionarios|crear (mas )?(ministerios|departamentos))\b/,
      favor: {
        nombre: 'el recorte de la burocracia', controversia: 1, prensa: 'economia',
        inicial: { elite: -5, felicidad: -2 }, porTurno: { dinero: 4, felicidad: 0.2 },
        texto: 'Se suprimen tres ministerios, doce comisiones y el Departamento de Coordinación de Departamentos. Los funcionarios despedidos se van al mercado: resulta que venden mejor que archivaban.'
      },
      contra: {
        nombre: 'la ampliación de la burocracia', controversia: 0,
        inicial: { elite: 4, felicidad: 1 }, porTurno: { dinero: -4, estabilidad: 0.2 },
        texto: 'Se crean cuatro comisiones nuevas para vigilar a las tres comisiones antiguas. Hay empleo para los hijos de los cuadros y sellos para todos.'
      }
    },

    NATALIDAD: {
      nombre: 'la natalidad',
      re: /\b(natalidad|familias? numerosas?|tener (mas )?hijos|limit\w* (los )?hijos|hijo unico|maternidad|bebes?)\b/,
      contraRe: /\b(limit\w*|prohib\w*|hijo unico|control de natalidad|reduc\w*)\b/,
      favor: {
        nombre: 'el fomento de la natalidad', controversia: 0, prensa: 'regalo',
        inicial: { felicidad: 2 }, porTurno: { dinero: -3, felicidad: 0.3 }, curvas: { felicidad: 'acostumbra' },
        texto: 'Las familias con tres hijos o más recibirán un piso en Pionyang y una medalla de "Madre Heroína". Los pisos tardan en llegar; las medallas, no.'
      },
      contra: {
        nombre: 'el límite de hijos', controversia: 2, prensa: 'libertad',
        inicial: { felicidad: -6 }, porTurno: { dinero: 1, felicidad: -0.6 },
        texto: 'Cada familia podrá tener como máximo dos hijos. Los inspectores de la unidad popular llevan la cuenta. Las abuelas llevan otra cuenta, más larga, de lo que opinan.'
      }
    },

    EMIGRACION: {
      nombre: 'la emigración',
      re: /\b(emigr\w*|salir del pais|viajar al extranjero|pasaportes?|desert\w*|fugitivos|los que huyen)\b/,
      contraRe: /\b(prohib\w*|impedir|castig\w*|persegu\w*|dispar\w*|cerr\w*|vigil\w*)\b/,
      favor: {
        nombre: 'la libertad para emigrar', controversia: 2, prensa: 'libertad',
        inicial: { felicidad: 5, estabilidad: -4, elite: -3 }, porTurno: { dinero: 1, felicidad: 0.3 }, relaciones: { eeuu: 5, surcorea: 6 },
        texto: 'Cualquiera podrá pedir pasaporte. La primera mañana hay una cola de cuatro kilómetros frente a la oficina. Los funcionarios, que también están en la cola, no abren.',
        programar: [{ en: 3, titulo: 'Los que se van', texto: 'Se van los médicos, los ingenieros y los que saben idiomas. Mandan dinero a casa desde China y Seúl, y fotos que la familia enseña con mucho cuidado.', efectos: { dinero: 4, felicidad: -2, estabilidad: -2 } }]
      },
      contra: {
        nombre: 'la persecución de los que huyen', controversia: 1, prensa: 'represion',
        inicial: { estabilidad: 2, felicidad: -3 }, porTurno: { dinero: -1, estabilidad: 0.3, felicidad: -0.3 }, relaciones: { surcorea: -3 },
        texto: 'Se refuerza la frontera con alambre, perros y la orden de disparar. Los contrabandistas suben la tarifa por cruzar el río. La demanda no baja.'
      }
    },

    TIPOS_INTERES: {
      nombre: 'los tipos de interés',
      re: /\b(tipos? de interes|interes(es)? de los prestamos|tasas? de interes|credito barato|encarecer el credito)\b/,
      contraRe: /\b(baj\w*|reduc\w*|credito barato|abarat\w*)\b/,
      favor: {
        nombre: 'la subida de los tipos de interés', controversia: 0, prensa: 'economia',
        inicial: { inflacion: -3, felicidad: -2 }, porTurno: { inflacion: -0.8, dinero: -1, felicidad: -0.2 },
        texto: 'El Banco Central sube los tipos de interés. En un país donde casi nadie tiene cuenta en el banco, la medida afecta sobre todo al Banco Central. Aun así, la gente oye "sube" y guarda los wones.'
      },
      contra: {
        nombre: 'el crédito barato', controversia: 0, prensa: 'economia',
        inicial: { felicidad: 1, elite: 2 }, porTurno: { inflacion: 0.8, dinero: 1 },
        texto: 'Se abarata el crédito. Los únicos que piden préstamos son los donju y los cuadros del Partido, que construyen pisos que venden a los cuadros del Partido.'
      }
    },

    COMBUSTIBLE: {
      nombre: 'el combustible',
      re: /\b(gasolina|combustible|diesel|gasoil|carburante)\b/,
      contraRe: /\b(sub\w* (\w+ ){0,2}precio|encarec\w*|quit\w* (el |los )?subsidi\w*|elimin\w* (el |los )?subsidi\w*|impuesto)\b/,
      favor: {
        nombre: 'la gasolina subvencionada', controversia: 0, prensa: 'regalo',
        inicial: { felicidad: 3 }, porTurno: { dinero: -4, felicidad: 0.3, inflacion: -0.2 }, curvas: { felicidad: 'acostumbra' },
        texto: 'La gasolina será barata para todos. Para todos los que tienen coche, que son los cuadros del Partido, el ejército y Kwang-ho.'
      },
      contra: {
        nombre: 'la subida de la gasolina', controversia: 1, prensa: 'impuesto',
        inicial: { felicidad: -3, inflacion: 2 }, porTurno: { dinero: 4, felicidad: -0.3, inflacion: 0.3 },
        texto: 'Sube la gasolina. Los taxis suben la tarifa, los camiones suben el arroz y Kwang-ho sube el volumen de la radio para no oír lo que dicen sus pasajeros.',
        programar: [{ en: 2, titulo: 'Los taxistas se paran', texto: 'Los taxistas de Pionyang dejan los coches aparcados "por avería mecánica colectiva". La avería dura exactamente hasta que se anuncia una bonificación.', efectos: { estabilidad: -2, felicidad: -1 } }]
      }
    },

    CAMPANA_SALUD: {
      nombre: 'la salud pública',
      re: /\b(vacun\w*|campanas? (de salud|sanitarias?|de higiene)|epidemia\w*|pandemia\w*|cuarentena\w*|hospital(es)? de campana)\b/,
      contraRe: /\b(prohib\w*|antivacun\w*|no vacunar|quit\w*)\b/,
      favor: {
        nombre: 'la campaña de vacunación', controversia: 0, prensa: 'obra',
        inicial: { dinero: -8, felicidad: 3 }, porTurno: { felicidad: 0.3, estabilidad: 0.1 },
        texto: 'Brigadas sanitarias recorren los pueblos con neveras portátiles y un generador que funciona a ratos. Los niños lloran; las madres aplauden; {ventura} duerme por primera vez en semanas.'
      },
      contra: {
        nombre: 'la prohibición de las vacunas', controversia: 1, prensa: 'absurdo',
        inicial: { felicidad: -2 }, porTurno: { felicidad: -0.5 },
        texto: 'Se declaran las vacunas "invento imperialista". {ventura} guarda las que quedan en su nevera personal, junto a una botella de soju y una carta de dimisión.'
      }
    },

    CAMPANA_PRODUCCION: {
      nombre: 'la batalla de producción',
      re: /\b(cultiv\w* mas|producir mas|aument\w* la produccion|batalla de (los )?\d+ dias|campana de (produccion|velocidad)|movilizaci\w* (de|para) (la cosecha|el campo)|mas cosechas?)\b/,
      favor: {
        nombre: 'la batalla de los 70 días', controversia: 0, unaVez: true, prensa: 'culto',
        inicial: { dinero: 8, felicidad: -4, inflacion: -2, estabilidad: 1 },
        texto: 'Empieza la "Batalla de los 70 días": todo el país, de estudiantes a jubilados, trabaja sin descanso en campos y fábricas. Los altavoces animan desde las seis de la mañana. La producción sube. El cansancio, más.',
        programar: [{ en: 3, titulo: 'Después de la batalla', texto: 'Terminan los 70 días. La cifra oficial de producción ha subido un 150%. La real, un 15%. Todo el mundo duerme dos días seguidos.', efectos: { felicidad: 2 } }]
      },
      contra: { nombre: 'el descanso nacional', unaVez: true, inicial: { felicidad: 3, dinero: -3 }, notas: ['Se decreta una semana de descanso. Nadie sabe muy bien qué hacer con ella.'] }
    },

    CASINOS: {
      nombre: 'el juego',
      re: /\b(casinos?|juegos? de azar|apuestas|loteria\w*|legaliz\w* el juego)\b/,
      contraRe: /\b(prohib\w*|cerr\w*|ilegaliz\w*|acab\w*)\b/,
      favor: {
        nombre: 'los casinos para extranjeros', controversia: 1, prensa: 'economia',
        inicial: { dinero: 5 }, porTurno: { dinero: 4, elite: 0.2 }, economia: { mercadoNegro: 3 }, relaciones: { china: 3 },
        texto: 'Se abre un casino en Rason, solo para extranjeros. Los jugadores chinos llegan en autobús, pierden en yuanes y se van contentos. Nadie pregunta de dónde sale el dinero que traen. Precisamente por eso vienen.'
      },
      contra: {
        nombre: 'el cierre de los casinos', controversia: 0, relaciones: { china: -3 },
        inicial: { dinero: -3 }, porTurno: {},
        texto: 'Se cierran los casinos. Las ruletas se reparten entre los clubes del Partido, donde se sigue jugando, pero ahora por patriotismo.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había casinos. Solo partidas de cartas en las trastiendas, que ningún decreto ha cerrado nunca.'] }
    },

    VIGILANCIA_ELITE: {
      nombre: 'la vigilancia de la élite',
      re: /\b(espi\w*|vigil\w*|pinch\w* (los )?telefonos?|investig\w*|seguir) (a )?(los |mis |a mis )?(ministros|generales|cuadros|la elite|el partido|el gabinete|mi gabinete|la cupula)\b/,
      contraRe: /\b(dej\w* de|par(ar|en|e) de|no (espiar|vigilar))\b/,
      favor: {
        nombre: 'la vigilancia de la élite', controversia: 0, prensa: 'secreto',
        inicial: { elite: -6, estabilidad: 2 }, porTurno: { dinero: -2, estabilidad: 0.3, elite: -0.3 },
        texto: 'Los teléfonos de todos los ministros tienen desde hoy un clic nuevo al descolgar. Los ministros lo oyen. Desde entonces solo hablan del tiempo, y del tiempo solo bien.'
      },
      contra: {
        nombre: 'el fin de la vigilancia a la élite', controversia: 0,
        inicial: { elite: 4 }, porTurno: {},
        texto: 'Se retiran los micrófonos de los despachos. Los ministros tardan semanas en creérselo y siguen hablando del tiempo.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['No había vigilancia especial sobre la élite. Solo la normal, que no se retira nunca.'] }
    },

    TURISMO: {
      nombre: 'el turismo',
      re: /\b(turis\w*|visitantes extranjeros|hotel(es)? para extranjeros|estacion(es)? de esqui|resorts?|abrir (\w+ ){0,2}(pais|frontera) a los (visitantes|extranjeros))\b/,
      no: /\b(basad\w* en|centrad\w* en|enfoc\w*|volcad\w* en|invert\w*|subsidi\w*|subvencion\w*)\b/,
      contraRe: /\b(prohib\w*|cerr\w*|expuls\w*|acab\w*|suspend\w*|no mas)\b/,
      favor: {
        nombre: 'la apertura al turismo', controversia: 1, prensa: 'economia',
        inicial: { dinero: -6 }, porTurno: { dinero: 4, felicidad: 0.1, estabilidad: -0.2, elite: 0.1 }, curvas: { dinero: 'madura' }, relaciones: { china: 4 },
        texto: 'Se abre el país al turismo. Cada grupo de visitantes llega con dos guías, un conductor y un señor que no dice qué hace. Visitan la estatua, el metro, una granja modelo y otra vez la estatua.',
        programar: [{ en: 3, titulo: 'El turista que se desvió', texto: 'Un turista australiano se aleja del grupo para fotografiar un mercado de verdad. Las fotos salen en internet: gente normal, vendiendo cosas normales. {sombra} lo considera un incidente de seguridad nacional.', efectos: { estabilidad: -2, elite: -1 } }]
      },
      contra: {
        nombre: 'el cierre al turismo', controversia: 0, relaciones: { china: -3 },
        inicial: { dinero: -3, estabilidad: 1 }, porTurno: {},
        texto: 'Se cierran las fronteras a los turistas. Los hoteles de Pionyang quedan vacíos, con las luces encendidas cada noche para que se vean desde el otro lado del río.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['Casi no venían turistas. Los cuatro que venían se van un poco antes.'] }
    },

    EXPORTACIONES: {
      nombre: 'las exportaciones',
      re: /\b(export\w*|vender (\w+ ){0,2}(al|en el) extranjero|vender (\w+ ){0,3}a (china|rusia|japon|corea del sur))\b/,
      no: /\b(armas?|misil\w*|bombas?|trabajadores|obreros|esclavos)\b/,
      contraRe: /\b(prohib\w*|dej\w* de|par(ar|en|e) de|no export\w*|cerr\w*|suspend\w*)\b/,
      favor: {
        nombre: 'la campaña exportadora', controversia: 0, prensa: 'economia',
        inicial: { dinero: 8, inflacion: 2 }, porTurno: { dinero: 3, inflacion: 0.4, felicidad: -0.2 }, relaciones: { china: 3 },
        texto: 'Se exporta todo lo que China quiera comprar: carbón, marisco, pelucas, setas de pino. Entran divisas; en los mercados sube el precio de lo que se ha ido.'
      },
      contra: {
        nombre: 'el cierre de las exportaciones', controversia: 0, relaciones: { china: -3 },
        inicial: { dinero: -6, inflacion: -2 }, porTurno: { dinero: -2, inflacion: -0.3 },
        texto: 'Se prohíbe sacar mercancías del país. El carbón se amontona en los puertos; los pescadores comen marisco por primera vez en años y no saben muy bien qué hacer con él.'
      }
    }
  };

  RF.TEMAS = Object.assign({}, POLITICAS, RF.TEMAS);
})(globalThis.RF = globalThis.RF || {});
