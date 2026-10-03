/*
 * LA URSS, 1985
 * El segundo país del juego, y su escenario: marzo de 1985, el Politburó acaba de elegirte Secretario General.
 * Objetivo: que la Unión Soviética siga existiendo en diciembre de 1991, el mes en que se disolvió de verdad.
 *
 *   RF.PAISES.urss        el perfil del país (como el de Corea del Norte en paises.js)
 *   RF.PAQUETES.urss()    cambia ministros, gente de a pie, eventos, radio y finales (solo si se juega este escenario)
 *   RF.ESCENARIOS.urss1985  fechas, objetivo, lo que la historia tiene preparado y lo que pasó de verdad
 *
 * Los personajes del juego son inventados (es sátira); los hechos históricos del resumen final son reales.
 */
(function (RF) {
  'use strict';

  // ---------------------------------------------------------------- EL PAÍS
  RF.PAISES.urss = {
    id: 'urss',
    nombre: 'Unión de Repúblicas Socialistas Soviéticas', corto: 'la URSS', marca: 'URSS', juego: 'Consola del Kremlin',
    capital: 'Moscú', moneda: 'rublos', gentilicio: 'soviéticos', lider: 'el Secretario General', tratamiento: 'camarada Secretario General',
    radio: 'RADIO MOSCÚ',
    // Los primeros botones rápidos de la consola.
    atajos: [['Abrir la prensa', 'abrir la prensa'], ['Legalizar cooperativas', 'legalizar las cooperativas'], ['Salir de Afganistán', 'retirar las tropas de Afganistán'], ['Vender gas a Alemania', 'vender gas a Alemania']],

    barras: {
      dinero: { nombre: 'Divisas', corto: 'DIVISAS', ayuda: 'millones de dólares de las ventas de petróleo y gas a Occidente' },
      inflacion: { nombre: 'Inflación', corto: 'INFLACIÓN', ayuda: 'lo que suben los precios cada turno (en las tiendas del Estado no suben: se vacían)' },
      estabilidad: { nombre: 'Estabilidad', corto: 'ESTABILIDAD', ayuda: 'si la Unión aguanta: a 0, se acabó' }
    },

    sectores: {
      ejercito: { nombre: 'Ejército Rojo', seccion: 'EJÉRCITO', quien: 'el Ejército Rojo: los mariscales, el complejo militar-industrial y cinco millones de soldados, cien mil de ellos en Afganistán', fin: 'ejercito' },
      elite: { nombre: 'Politburó', seccion: 'POLITBURÓ', quien: 'la nomenklatura: el Politburó, los secretarios regionales del Partido y sus dachas', fin: 'cupula' },
      poblacion: { nombre: 'Pueblo', seccion: 'PUEBLO', quien: 'la gente de a pie: colas, cupones, vodka y chistes en voz baja', fin: 'pueblo' }
    },

    inicio: {
      stats: { dinero: 110, inflacion: 2, estabilidad: 68, felicidad: 42 },
      sectores: { ejercito: 72, elite: 70 },
      regimen: 'PARTIDO',
      instituciones: { congreso: 'controlado', tribunales: 'controlado', prensa: 'controlado', elecciones: 'controlado', constitucion: 'controlado' },
      apoyo: 99,
      economia: { sanciones: 1, mercadoNegro: 25 },
      arsenal: true
    },

    relaciones: {
      eeuu: {
        nombre: 'Estados Unidos', inicio: 20, base: 25,
        quiere: 'reducir los misiles nucleares, que salgas de Afganistán y que dejes salir a los disidentes',
        teme: 'los misiles SS-20 y una guerra nuclear por accidente',
        claves: /\b(estados unidos|eeuu|ee uu|usa|washington|norteamerica\w*|americanos?|yanquis?|la casa blanca|reagan)\b/,
        gestos: {
          amistad: { medida: 'el deshielo con Washington', relaciones: { eeuu: 12, europa: 6, china: -2 }, efectos: { ejercito: -4, elite: -2 },
            textos: ['Propones a Washington una cumbre "sin agenda y con vodka". La Casa Blanca acepta la cumbre y rechaza el vodka. Los mariscales rechazan las dos cosas.', 'Mandas al ballet Bolshói de gira por Estados Unidos. Ningún bailarín pide asilo, lo cual es noticia en sí mismo. {sombra} cuenta las cabezas dos veces en el aeropuerto.'] },
          hostil: { medida: 'el pulso con Washington', relaciones: { eeuu: -15, europa: -6 }, efectos: { ejercito: 5, dinero: -6 },
            textos: ['Desplegáis otra batería de misiles en Alemania Oriental. Washington responde con otra en Alemania Occidental. Los alemanes de los dos lados empiezan a construirse sótanos.', 'Pravda dedica la portada a llamar a Washington "nido de halcones belicistas". En Washington lo enmarcan. En el Pentágono, lo usan para pedir más presupuesto.'] }
        }
      },
      europa: {
        nombre: 'Europa Occidental', inicio: 35, base: 38, comercio: 0.12,
        quiere: 'comprarte gas y petróleo, menos misiles apuntando a sus ciudades y, en Bonn, una Alemania unida algún día',
        teme: 'los tanques del Pacto de Varsovia cruzando el Elba',
        claves: /\b(europa occidental|europeos?|alemania occidental|alemania federal|bonn|francia|paris|reino unido|londres|thatcher|la cee|el mercado comun)\b/,
        gestos: {
          amistad: { medida: 'la mano tendida a Europa', relaciones: { europa: 14, eeuu: 3, este: -3 }, efectos: { dinero: 6, elite: -2 },
            textos: ['Hablas en Estrasburgo de "una casa común europea". Los europeos aplauden sin saber muy bien quién paga la casa. El gasoducto, de momento, lo pagan ellos.', 'Firmas con Bonn un contrato de gas a veinte años. Los alemanes llevan tuberías, tú llevas gas, y los dos fingís que no hay un muro en medio.'] },
          hostil: { medida: 'la amenaza a Europa', relaciones: { europa: -16, eeuu: -5 }, efectos: { ejercito: 4, dinero: -5 },
            textos: ['Haces maniobras con veinte divisiones a cincuenta kilómetros de la frontera alemana. En Bonn suben las ventas de mapas de carreteras hacia Portugal.', 'Cortas el gas a Europa "por un problema técnico en Siberia". El problema técnico dura exactamente hasta que París retira una declaración.'] }
        }
      },
      china: {
        nombre: 'China', inicio: 28, base: 32, comercio: 0.05,
        quiere: 'que quites los "tres obstáculos": tus tropas en Afganistán, las divisiones en su frontera y el apoyo a Vietnam en Camboya',
        teme: 'quedar rodeada por la URSS, al norte y al sur',
        claves: /\b(china|chinos?|pekin|beijing)\b/,
        gestos: {
          amistad: { medida: 'la reconciliación con Pekín', relaciones: { china: 14, eeuu: -2 }, efectos: { dinero: 4, ejercito: -3 },
            textos: ['Retiras dos divisiones de la frontera del Amur. Pekín responde con una delegación, un banquete de catorce platos y un recordatorio amable de los otros dos obstáculos.', 'Viajas a Pekín: es la primera cumbre chino-soviética en treinta años. En la plaza de Tiananmén, unos estudiantes te aplauden. A los dirigentes chinos eso no les hace ninguna gracia.'] },
          hostil: { medida: 'el choque con Pekín', relaciones: { china: -16 }, efectos: { ejercito: 4, dinero: -4 },
            textos: ['Refuerzas la frontera del río Ussuri con tres divisiones más. Pekín publica un editorial sobre el "socialimperialismo soviético" de nueve mil palabras. Nadie lo lee entero, pero todos lo entienden.', 'Llamas "revisionistas" a los dirigentes chinos en un pleno. Ellos te llaman "revisionista" en el suyo. Los dos lo decís en serio.'] }
        }
      },
      este: {
        nombre: 'Europa del Este', inicio: 62, base: 52, comercio: 0.04,
        quiere: 'petróleo barato de Moscú, menos tutela y que sus gobiernos puedan hacer reformas sin pedir permiso',
        teme: 'que Moscú mande los tanques, como en Budapest en 1956 y en Praga en 1968',
        claves: /\b(europa del este|pacto de varsovia|polonia|varsovia|hungria|budapest|checoslovaquia|praga|alemania oriental|la rda|berlin este|rumania|bulgaria|los satelites|comecon)\b/,
        gestos: {
          amistad: { medida: 'la libertad para Europa del Este', relaciones: { este: 14, europa: 6, eeuu: 4 }, efectos: { elite: -4, ejercito: -3 },
            textos: ['Anuncias que cada país del Pacto "elegirá su propio camino". En Varsovia y Budapest se brinda. En Berlín Este, el viejo dirigente pide una aspirina y un mapa.', 'Dejas de mandar asesores soviéticos a Praga. Los checos lo celebran con cerveza; los asesores, con una carta de queja al Comité Central.'] },
          hostil: { medida: 'la mano dura con Europa del Este', relaciones: { este: -16, europa: -8, eeuu: -6 }, efectos: { ejercito: 4, estabilidad: 1 },
            textos: ['Recuerdas a los gobiernos del Pacto, en una reunión a puerta cerrada, que los tanques siguen teniendo gasolina. Nadie toma notas, pero todos se acuerdan.', 'Subes el precio del petróleo que vendes a Polonia. En Gdansk, los obreros de los astilleros sacan las pancartas que tenían guardadas desde 1981.'] }
        }
      }
    },

    economia: {
      ingresos: 41,          // impuestos, beneficios de las empresas del Estado y petrodólares
      gastos: 33,            // sueldos, subsidios a los precios, Afganistán y la carrera de armamentos
      costeSancion: 1.2,     // el embargo tecnológico de Occidente (COCOM) y la carrera de armamentos
      sinCredito: false,     // los bancos occidentales sí prestan (y la deuda externa crece)
      suelo: -300,
      cajaLider: { nombre: 'los privilegios de la nomenklatura', umbral: 200, fuga: 0.06 },
      adaptacionSanciones: 0.2,
      padrino: null,
      socio: 'los países del Comecon',
      exporta: ['petróleo y gas (a Occidente, por divisas)', 'armas', 'oro y diamantes', 'madera'],
      importa: ['trigo de Estados Unidos y Canadá', 'maquinaria occidental', 'vaqueros y cintas de casete (de contrabando)']
    },

    conceptos: {
      plan: 'El Gosplán: un plan quinquenal fija cuánto produce cada fábrica y a qué precio. Los directores cumplen la cuota en toneladas, no en utilidad: zapatos de un solo número, lámparas de media tonelada.',
      escasez: 'Escasez y colas: los precios están congelados, así que la inflación no se ve en las etiquetas sino en las estanterías vacías y en el dinero ahorrado que no se puede gastar.',
      petroleo: 'Petrodólares: las divisas dependen del petróleo. En 1986 su precio se hundió a la mitad y con él los ingresos del Estado.',
      blat: 'El blat: los favores y contactos con los que se consigue lo que no hay en las tiendas. La economía sumergida y los cooperativistas.',
      nomenklatura: 'La nomenklatura: los cargos del Partido, con sus dachas, sus tiendas especiales y sus coches negros. Cualquier reforma les quita algo.',
      nacionalidades: 'Quince repúblicas: los bálticos, el Cáucaso y Ucrania tienen sus propias lenguas y memorias. Si se les deja hablar, piden más; si se les aplasta, también.',
      glasnost: 'Transparencia (glásnost) y reestructuración (perestroika): abrir la prensa y reformar la economía para salvar el sistema, con el riesgo de que se hunda.',
      afganistan: 'Afganistán: desde 1979, cien mil soldados en una guerra que no se puede ganar. Cuesta dinero, vidas y prestigio; los veteranos (afgantsy) vuelven amargados.',
      pacto: 'El Pacto de Varsovia: los países satélite del Este, sostenidos por el petróleo barato soviético y por el recuerdo de los tanques.'
    },

    ia: {
      consejo: 'Eres el Consejo de Estado de "Consola del Kremlin", un juego satírico de gobierno. El jugador es el nuevo Secretario General del Partido Comunista de la Unión Soviética, elegido en marzo de 1985 tras la muerte de tres líderes ancianos en tres años, y gobierna escribiendo decretos en lenguaje libre. Es sátira: el jugador no tiene nombre (no lo llames Gorbachov) y los ministros son inventados; los hechos y personajes históricos del mundo exterior pueden aparecer.',
      dinero: '- dinero = DIVISAS: millones de dólares, sobre todo del petróleo y el gas que se vende a Occidente. Cada turno el motor cobra impuestos, paga sueldos, subsidios a los precios y la carrera de armamentos, y resta el embargo tecnológico. Los bancos occidentales prestan, pero la deuda sube la inflación. Por encima de 200, la nomenklatura se queda una parte en privilegios.',
      diplomacia: 'DIPLOMACIA (campo "relaciones" de la ficha, opcional): cambios en la relación (0-100) con las potencias, de -25 a +25 cada una: {"eeuu": ..., "europa": ..., "china": ..., "este": ...} ("europa" es Europa Occidental; "este" son los países del Pacto de Varsovia). Sé coherente con sus intereses: Estados Unidos quiere reducir misiles, que salgas de Afganistán y derechos humanos; Europa Occidental quiere gas, desarme y, Bonn, la unidad alemana; China quiere que quites sus "tres obstáculos" (Afganistán, la frontera, Camboya); Europa del Este quiere petróleo barato y menos tutela, y teme los tanques. Estados Unidos sube o baja el embargo; Europa compra gas. Si el decreto desmantela o reconstruye el arsenal nuclear, pon "arsenal": false o true.',
      economia: 'ECONOMÍA (campo "economia" de la ficha, opcional): {"sanciones": de -2 a +2 (el embargo tecnológico occidental, 0-4), "mercado_negro": de -40 a +40 (puntos del % de economía sumergida: blat, especuladores, cooperativas)}. La carrera de armamentos y la represión suben el embargo; el desarme y la apertura lo bajan; legalizar cooperativas y mercados reduce la economía sumergida (pasa a pagar impuestos); perseguirla vacía aún más las tiendas.',
      cronista: 'Eres el cronista de "Consola del Kremlin", un juego satírico en el que el jugador es el nuevo Secretario General de la Unión Soviética, elegido en marzo de 1985, y gobierna escribiendo decretos. Es sátira: no lo llames por ningún nombre real; los ministros son inventados.',
      tratamiento: '- Segunda persona: te diriges al gobernante ("tú"). Le llaman "camarada Secretario General".',
      mundo: [
        'El mundo: la URSS de los años ochenta. Colas en las tiendas, cupones, vodka, chistes en voz baja, militares en Afganistán, petróleo que se vende a Occidente, una nomenklatura con dachas y tiendas especiales. Pravda y Radio Moscú cuentan lo que conviene; la Voz de América y la BBC se escuchan de noche.',
        'Los indicadores: DIVISAS (dinero), INFLACIÓN, ESTABILIDAD; y el ánimo de tres sectores: EJÉRCITO (el Ejército Rojo), POLITBURÓ (el Partido y la nomenklatura) y PUEBLO.',
        'La gente de a pie: la abuela Zina (71 años, jubilada de Moscú que se pasa el día en las colas con su bolsa de malla "por si acaso"), su nieto Sasha (20, estudiante en Leningrado, rock en cintas copiadas y sueños de vaqueros), Kolia (45, minero del Kuzbass, en Siberia) y Olga (31, enfermera en Kiev).',
        'Fuera: Estados Unidos (el rival), Europa Occidental (compra gas), China (rival comunista) y Europa del Este (los satélites del Pacto de Varsovia). Si algo de diplomacia pasa en el turno, puede aparecer en POLITBURÓ (la ministra de Exteriores) o en la RADIO.',
        'Borís Volkónov, el jefe del Partido en Moscú, es un populista que te critica en los plenos. El embajador americano observa con prismáticos. Medios: Pravda (oficial), Radio Moscú (oficial) y Radio Libertad (desde Múnich, de noche).'
      ]
    },

    contexto: [
      'La URSS real en 1985: quince repúblicas, 280 millones de personas, una superpotencia nuclear con la economía estancada desde los años setenta. Tres secretarios generales ancianos murieron entre 1982 y 1985.',
      'Economía: planificación central (Gosplán), precios congelados, escasez y colas, una economía sumergida (blat, especuladores) y una gran dependencia de las divisas del petróleo. En 1986 el precio del petróleo se hundió. La campaña antialcohol de 1985 hundió los ingresos del Estado.',
      'Política: el Partido Comunista es el único; el Politburó decide; el KGB vigila. La glásnost (1986) abrió la prensa; la perestroika (1987) intentó reformar la economía; en 1989 hubo las primeras elecciones semilibres. Las repúblicas bálticas, el Cáucaso y Ucrania pidieron más autonomía y luego la independencia.',
      'Exterior: guerra en Afganistán desde 1979; carrera de armamentos con Estados Unidos; cumbres de desarme (Ginebra 1985, Reikiavik 1986, tratado INF 1987); el Pacto de Varsovia se deshizo en 1989 y el Muro de Berlín cayó sin que Moscú interviniera.',
      'Poder: el Ejército y el KGB son los dos pilares que pueden dar un golpe (lo intentaron en agosto de 1991); el Politburó puede destituir al Secretario General (lo hizo con Jruschov en 1964); el pueblo vota con los pies en las colas y, desde 1989, en las huelgas mineras.'
    ],

    // Lo que es de Corea del Norte en los textos generales del juego, cambiado por lo soviético.
    reemplazos: [
      [/\bPyongyang\b|\bPionyang\b/g, 'Moscú'], [/Corea del Norte/g, 'la URSS'], [/norcoreanos/g, 'soviéticos'], [/norcoreanas/g, 'soviéticas'], [/norcoreano/g, 'soviético'], [/norcoreana/g, 'soviética'],
      [/\bwones\b/g, 'rublos'], [/\byuanes\b/g, 'dólares'], [/\bel won\b/g, 'el rublo'], [/\bwon\b/g, 'rublo'], [/\bjangmadang\b/g, 'mercado negro'], [/Rodong Sinmun/g, 'Pravda'], [/Radio Pionyang/g, 'Radio Moscú'],
      [/Líder Supremo/g, 'Secretario General'], [/Asamblea Popular Suprema/g, 'Sóviet Supremo'], [/el Partido de la Patria/g, 'el Partido Comunista'], [/\bsoju\b/g, 'vodka'],
      [/la abuela Sun-ja/g, 'la abuela Zina'], [/La abuela Sun-ja/g, 'La abuela Zina'], [/Sun-ja/g, 'Zina'], [/Chol-su/g, 'Sasha'], [/Kwang-ho/g, 'Kolia'], [/Eun-hee/g, 'Olga'], [/Song Dae-ho/g, 'Volkónov'],
      [/memorias? USB/g, 'cintas de casete'], [/series del Sur/g, 'películas occidentales'], [/K-pop/g, 'rock occidental'], [/\bChina compra tu carbón\b/g, 'Europa compra tu gas']
    ],

    intro: () => ({
      periodico: 'PRAVDA',
      texto: 'Tres secretarios generales han muerto en tres años y el Politburó ya no sabe dónde guardar las coronas de flores. Hoy, por sorpresa, elige al más joven: tú. ' +
        'Heredas una superpotencia con misiles para destruir el mundo varias veces y tiendas sin jabón; cien mil soldados en Afganistán; petróleo que vale cada vez menos; y quince repúblicas que llevan setenta años calladas. ' +
        'Tienes una consola y un sello. Lo que firmes se cumple y se acumula. El Ejército Rojo, el Politburó y el pueblo decidirán si llegas a 1992.',
      radio: '¡Buenos días, camaradas! El Politburó, por unanimidad y con mucha prisa, ha elegido nuevo Secretario General. Las arcas tienen 110 millones en divisas, el ejército está firme y el pueblo, en la cola. Como siempre.',
      comoSeJuega: 'Escribe cualquier orden y pulsa Decretar: "abrir la prensa", "legalizar las cooperativas", "retirar las tropas de Afganistán", "vender gas a Alemania", "negociar con Estados Unidos", "prohibir el vodka".\n' +
        'Cada ley sigue actuando cada turno, y cada turno son tres meses. La historia también se mueve sola: Chernóbil, el petróleo, el Muro... y tú decides qué hacer cuando llegue.\n' +
        'Pierdes si la ESTABILIDAD llega a 0. Ganas si la Unión sigue en pie en diciembre de 1991.',
      fuera: 'Borís Volkónov, el jefe del Partido en Moscú, sueña con tu sillón y critica en los plenos que vas demasiado despacio (o demasiado deprisa, según el día). Washington te llama "el imperio del mal". Europa te compra el gas. China te mira de reojo. En Varsovia, Budapest y Praga esperan a ver qué haces. El embajador americano observa con prismáticos desde su balcón.'
    })
  };

  // ---------------------------------------------------------------- LO QUE EL BOT YA SABE DE LA URSS
  // El vocabulario de la época, enseñado al intérprete local (ver aprendiz.js).
  RF.APRENDIDOS_PAIS = RF.APRENDIDOS_PAIS || {};
  RF.APRENDIDOS_PAIS.urss = [
    ['abrir la prensa', { accion: 'LEGALIZAR', objeto: 'PRENSA' }],
    ['glasnost', { accion: 'LEGALIZAR', objeto: 'PRENSA', conceptos: ['censura_ceguera'] }],
    ['glásnost', { accion: 'LEGALIZAR', objeto: 'PRENSA', conceptos: ['censura_ceguera'] }],
    ['transparencia informativa', { accion: 'LEGALIZAR', objeto: 'PRENSA' }],
    ['perestroika', { tema: 'MERCADOS', dir: 'favor', conceptos: ['formalizar_mercado'] }],
    ['reestructurar la economía', { tema: 'MERCADOS', dir: 'favor' }],
    ['legalizar las cooperativas', { tema: 'MERCADOS', dir: 'favor', conceptos: ['formalizar_mercado'] }],
    ['permitir las cooperativas privadas', { tema: 'MERCADOS', dir: 'favor' }],
    ['abolir el gosplan', { tema: 'MERCADOS', dir: 'favor' }],
    ['prohibir el vodka', { accion: 'PROHIBIR', objeto: 'VICIOS' }],
    ['campaña antialcohol', { accion: 'PROHIBIR', objeto: 'VICIOS' }],
    ['vodka gratis', { accion: 'SUBSIDIAR', objeto: 'VICIOS' }],
    ['retirar las tropas de afganistán', { tema: 'GUERRA', dir: 'contra', conceptos: ['guerra_cara'] }],
    ['salir de afganistán', { tema: 'GUERRA', dir: 'contra', conceptos: ['guerra_cara'] }],
    ['mandar más tropas a afganistán', { tema: 'GUERRA', dir: 'favor', conceptos: ['guerra_cara'] }],
    ['vender petróleo a europa', { tema: 'EXPORTACIONES', dir: 'favor' }],
    ['vender gas a alemania', { tema: 'EXPORTACIONES', dir: 'favor' }],
    ['exportar gas a europa', { tema: 'EXPORTACIONES', dir: 'favor' }],
    ['vender gas a europa', { tema: 'EXPORTACIONES', dir: 'favor' }],
    ['sacar las tropas de afganistán', { tema: 'GUERRA', dir: 'contra', conceptos: ['guerra_cara'] }],
    ['acabar la guerra de afganistán', { tema: 'GUERRA', dir: 'contra', conceptos: ['guerra_cara'] }],
    ['construir un gasoducto a europa', { tema: 'INFRAESTRUCTURA', dir: 'favor', conceptos: ['obras_publicas'] }],
    ['comprar trigo a estados unidos', { tema: 'COMERCIO_EXTERIOR', dir: 'favor', conceptos: ['ventaja_comparativa'] }],
    ['comprar trigo a canadá', { tema: 'COMERCIO_EXTERIOR', dir: 'favor' }],
    ['desmantelar los misiles ss-20', { tema: 'MISILES', dir: 'contra' }],
    ['recortar el presupuesto militar', { accion: 'RECORTAR', objeto: 'EJERCITO', conceptos: ['soldado_no_siembra'] }],
    ['liberar a los disidentes', { tema: 'AMNISTIA', dir: 'favor', conceptos: ['liberalizar_peligro'] }],
    ['rehabilitar a las víctimas de stalin', { tema: 'AMNISTIA', dir: 'favor' }],
    ['elecciones libres al sóviet supremo', { accion: 'LEGALIZAR', objeto: 'ELECCIONES' }],
    ['reabrir las iglesias', { accion: 'LEGALIZAR', objeto: 'RELIGION', conceptos: ['lealtad_rival'] }],
    ['permitir viajar al extranjero', { tema: 'EMIGRACION', dir: 'favor', conceptos: ['salida_voz'] }],
    ['subir el precio del pan', { tema: 'CONTROL_PRECIOS', dir: 'contra' }],
    ['cerrar el kgb', { accion: 'PROHIBIR', objeto: 'ESPIAS' }],
    ['más poder para el kgb', { accion: 'INVERTIR', objeto: 'ESPIAS', conceptos: ['dilema_dictador'] }],
    ['purgar el politburó', { accion: 'CASTIGAR', objeto: 'PARTIDO' }]
  ];

  // ---------------------------------------------------------------- EL PAQUETE
  RF.PAQUETES = RF.PAQUETES || {};
  RF.PAQUETES.urss = function () {
    RF.VARS = {
      garrote: 'Grómov', n_garrote: 'Mariscal Dmitri Grómov', cifuentes: 'Orlova', n_cifuentes: 'Valentina Orlova',
      sombra: 'Sávin', n_sombra: 'Víktor Sávin', paredes: 'Lapin', n_paredes: 'Yegor Lapin',
      montiel: 'Kovaliova', n_montiel: 'Irina Kovaliova', ventura: 'Bélov', n_ventura: 'Dr. Arkadi Bélov', lider: 'camarada Secretario General'
    };

    RF.GABINETE = {
      garrote: {
        nombre: 'Mariscal Dmitri Grómov', corto: 'Grómov', cargo: 'Ministro de Defensa',
        pos: ['El {n_garrote} golpea la mesa del Politburó con el puño y las medallas tintinean. "Así se gobierna una superpotencia, {lider}."', '{garrote} manda una caja de coñac armenio al Kremlin. En la tarjeta pone: "De parte de cinco millones de soldados".', 'En el Estado Mayor comentan {medida} con aprobación. {garrote} se permite media sonrisa, que en un mariscal soviético es casi una carcajada.'],
        neg: ['El {n_garrote} escucha {medida} sin parpadear. Después pide su Chaika y se va a Kúbinka a ver tanques, que no le llevan la contraria.', '"Con todo respeto, {lider}," dice {garrote}, "{medida} no se lo explico yo a los muchachos que vuelven de Kabul."', '{garrote} convoca a los jefes de los distritos militares a una reunión "de planificación". Nadie en el Kremlin sabe qué planifican.'],
        bajo: ['Hay luces encendidas de madrugada en el Ministerio de Defensa. {garrote} ya no contesta el teléfono rojo a la primera.', 'Un coronel joven le susurra a tu secretario: "Cuide al camarada Secretario General. Hay gente contando divisiones."']
      },
      cifuentes: {
        nombre: 'Valentina Orlova', corto: 'Orlova', cargo: 'Presidenta del Gosplán',
        pos: ['{n_cifuentes} repasa los números del plan y por una vez no suspira. "Los secretarios regionales están contentos, {lider}."', '{cifuentes} brinda en la dacha del Comité Central. Los de la nomenklatura la llaman "la camarada razonable".', '"Lo incluiré en el plan quinquenal," dice {cifuentes}, y anota algo en una libreta que nunca deja ver a nadie.'],
        neg: ['{cifuentes} cierra la carpeta del plan. "¿Sabe cuántos rublos nos cuesta {medida}? No, claro que no. Nadie lo sabe. Ese es el problema."', 'Esa noche, {n_cifuentes} cena con tres directores de fábrica. Hablan de cuotas, de primas y, en voz más baja, de ti.', '{n_cifuentes} pide revisar las cifras del plan "por si acaso". En el Gosplán, "por si acaso" significa que alguien va a perder su dacha.'],
        bajo: ['{cifuentes} ha empezado a guardar dólares en una caja de zapatos. El KGB lo sabe. Ella sabe que tú lo sabes.', 'En las dachas del Comité Central ya no se brinda por ti. Se brinda por "el próximo pleno".']
      },
      sombra: {
        nombre: 'Víktor Sávin', corto: 'Sávin', cargo: 'Presidente del KGB',
        pos: ['{n_sombra} asiente despacio. "Una decisión sensata, {lider}. Mis informes así lo reflejarán." Nadie sabe a quién manda esos informes.', '{sombra} sonríe por primera vez en el año. En la Lubianka, eso se comenta durante semanas.'],
        neg: ['{sombra} abre su carpeta negra y apunta algo. Cuando le preguntas qué, contesta: "El tiempo, {lider}. Apunto el tiempo."', '"{Medida} va a dar mucho trabajo a mis hombres," dice {n_sombra}. No suena a queja.', 'Esa noche hay más coches negros de lo habitual aparcados delante de la Lubianka.'],
        bajo: ['Tu línea de teléfono hace un clic nuevo al descolgar. {sombra} jura que es una avería.', 'Un funcionario del KGB te entrega, sin que nadie se lo pida, un informe sobre tu propia seguridad. Tiene cuarenta páginas y ninguna conclusión.']
      },
      paredes: {
        nombre: 'Yegor Lapin', corto: 'Lapin', cargo: 'Secretario de Ideología',
        pos: ['{n_paredes} ya tiene el titular de Pravda para mañana: "{Medida}: el pueblo soviético lo pedía". Lo escribió antes de que firmaras.', '{paredes} manda imprimir un millón de carteles sobre {medida}. Faltará papel higiénico un mes, pero los carteles son preciosos.'],
        neg: ['{paredes} lee el decreto y se queda pálido. "¿Y cómo explico esto en Pravda, {lider}? Siempre dijimos lo contrario."', '"{Medida}," repite {paredes} en voz baja, como quien busca la palabra para llamarlo victoria. No la encuentra.', '{n_paredes} convoca a los redactores de Pravda. Salen de la reunión con cuatro versiones distintas de lo que ha pasado.'],
        bajo: ['{paredes} ha dejado de escribir los discursos con entusiasmo. Ahora los escribe con exactitud, que es peor.', 'En Pravda, tu foto sale cada vez más pequeña. {paredes} dice que es por ahorrar tinta.']
      },
      montiel: {
        nombre: 'Irina Kovaliova', corto: 'Kovaliova', cargo: 'Ministra de Asuntos Exteriores',
        pos: ['{n_montiel} sonríe: "En Ginebra van a tener que tomarnos en serio, {lider}."', '{montiel} llama a tres embajadores en una mañana. Por primera vez en años, todos le devuelven la llamada.'],
        neg: ['{montiel} se frota las sienes. "¿Y qué le digo yo ahora a Washington? ¿Que fue un malentendido? Otra vez no."', '{n_montiel} cancela su viaje a Bonn. Los alemanes preguntan si es por el tiempo. No es por el tiempo.', '"Los embajadores van a pedir explicaciones," dice {montiel}. "Y esta vez no tengo ninguna."'],
        bajo: ['{montiel} pasa más tiempo en las embajadas extranjeras que en su despacho. {sombra} lleva la cuenta.', 'La ministra de Exteriores ha pedido "unas vacaciones en Viena". Sola. Con tres maletas.']
      },
      ventura: {
        nombre: 'Dr. Arkadi Bélov', corto: 'Bélov', cargo: 'Ministro de Sanidad',
        pos: ['{n_ventura} se quita las gafas y respira hondo. "Esto va a salvar vidas, {lider}. Y algunas de ellas, de borrachos."', '{ventura} visita el hospital central de Moscú y, por primera vez, hay sábanas en todas las camas. Las han traído esa mañana, pero hay.'],
        neg: ['{n_ventura} lee el decreto dos veces. "¿Sabe cuánta gente va a enfermar con {medida}?" No espera respuesta.', '"Voy a necesitar más camas," dice {ventura}. "Y más jeringuillas. Ahora mismo hervimos las que tenemos."', '{ventura} firma su parte de {medida} con la mano temblando. Luego se sirve algo que no es agua.'],
        bajo: ['Los hospitales atienden en los pasillos. {ventura} ha dejado de dormir.', '{ventura} presenta su dimisión. La rompes. Él la vuelve a escribir, a máquina y con copia.']
      }
    };

    RF.CIUDADANOS = {
      carmen: {
        nombre: 'Abuela Zina',
        presentacion: 'La abuela Zina, 71 años, jubilada de Moscú, se pasa el día en las colas con su bolsa de malla "por si acaso". Sobrevivió a la guerra en la retaguardia, trabajando en una fábrica de proyectiles, y no tira ni un cupón.',
        intereses: ['COMIDA', 'AGUA', 'ENERGIA', 'VIVIENDA', 'VICIOS', 'RELIGION', 'SALUD', 'TRABAJADORES'],
        neg: ['La abuela Zina se entera de {medida} en la cola del pan. Se queda callada un rato largo. Luego dice: "En la guerra, al menos, sabíamos quién era el enemigo."', 'Hoy la abuela Zina ha hecho cuatro horas de cola para nada. Culpa a {medida}. En voz baja, que la vecina es del Partido.', 'La abuela Zina esconde azúcar y fósforos debajo de la cama. No pide nada para ella: todo es para su nieto Sasha, que [ha vuelto de Leningrado sin abrigo|no escribe desde hace un mes|se ha dejado el pelo largo].', 'En la cola, las vecinas hablan de {medida}. La abuela Zina calla. Ha vivido a Stalin y sabe cuándo callar.', 'La abuela Zina tiene que elegir esta semana entre pagar al carnicero "por debajo del mostrador" o comprar medicinas. Culpa a {medida}. En silencio.'],
        pos: ['La abuela Zina sube el volumen de la radio cuando anuncian {medida}. "Bueno, bueno," murmura. "Por fin alguien con cabeza."', 'Hoy la abuela Zina le regala un caramelo al vigilante del portal. "Día de fiesta," le dice. Él no sabe qué fiesta es, pero se lo come.', 'La abuela Zina le dice a Sasha por teléfono que no todo lo que hace el Partido es malo. Sasha suspira, pero no la contradice.'],
        neu: ['La abuela Zina ni se entera de {medida}. Tiene cosas más importantes: hoy han traído salchichón a la tienda de la esquina.', 'La abuela Zina oye lo de {medida} y se encoge de hombros. "Los de arriba siempre están inventando."'],
        hitos: [
          { id: 'zina_cola', bajo: -40, texto: 'La abuela Zina se ha plantado delante del Gastronom con un cartel escrito a mano: "Setenta años esperando". La policía no sabe si detenerla o ponerse a la cola.', efectos: { pueblo: -3 } },
          { id: 'zina_fan', alto: 40, texto: 'La abuela Zina ha colgado tu foto junto a la de su marido, que murió en Berlín en 1945. Dice que tienes "cara de buen chico, aunque hablas demasiado".', efectos: { pueblo: 2 } }
        ],
        finales: { bien: 'La abuela Zina vivió hasta los noventa y seis. Guardó tu foto junto a la de su marido.', mal: 'La abuela Zina le contó a todo el que quiso oírla lo que hiciste. Los niños del barrio aprendieron tu nombre como se aprende una palabrota.', neutro: 'La abuela Zina siguió haciendo colas. Los secretarios generales iban y venían. Las colas, no.' }
      },
      nico: {
        nombre: 'Sasha',
        presentacion: 'Sasha, 20 años, nieto de la abuela Zina, estudia Física en Leningrado, copia cintas de rock en un magnetófono de su padre y sueña con unos vaqueros americanos de verdad.',
        intereses: ['EDUCACION', 'PRENSA', 'DIVERSION', 'OPOSICION', 'VICIOS', 'ROPA', 'TECNOLOGIA', 'LIDER', 'POLICIA', 'EJERCITO'],
        neg: ['Sasha copia {medida} en una hoja y la pasa en clase con un dibujo burlón. Antes del recreo, alguien del KGB ya tiene una copia.', 'Sasha y sus amigos escriben una pintada contra {medida} en un muro de Leningrado: "Queremos cambios", como la canción. [Uno se va antes de que llegue la milicia|Nadie firma].', 'Sasha discute con su abuela por teléfono. "¡{Medida} es una locura!" La abuela Zina cuelga: las líneas tienen oídos.', 'Sasha escribe en su diario, en clave: "Hoy decretaron {medida}. Algún día alguien contará esta historia."'],
        pos: ['Sasha lee lo de {medida} dos veces, buscando la trampa. No la encuentra. Se lo cuenta a un amigo en susurros: "¿Esto va en serio?"', 'Sasha admite, casi a su pesar: "Vale, {medida} no está mal." En la residencia lo miran raro. Alguno asiente.', 'Sasha pone en su habitación un póster de la portada de Pravda con {medida}. Al lado del de un grupo de rock. Es la primera vez que comparten pared.'],
        neu: ['Sasha oye lo de {medida} entre dos canciones copiadas y sigue grabando la cinta.', 'A Sasha le da igual {medida}. Esta semana tiene examen de comunismo científico.'],
        hitos: [
          { id: 'sasha_informal', bajo: -40, texto: 'Sasha ha dejado la universidad y toca en un grupo que da conciertos en sótanos. Sus canciones hablan de ti. No para bien.', efectos: { pueblo: -2, orden: -1 } },
          { id: 'sasha_komsomol', alto: 40, texto: 'Sasha se ha hecho del Komsomol "para cambiar las cosas desde dentro". Su abuela no sabe si alegrarse.', efectos: { pueblo: 2 } }
        ],
        finales: { bien: 'Sasha llegó a ser físico en un instituto de Moscú. Contaba a sus alumnos que vio la historia cambiar "en directo, por la radio".', mal: 'Años después, Sasha escribió desde Berlín un libro sobre tu gobierno. Se tituló "El último plan quinquenal". Se vendió mucho.', neutro: 'Sasha acabó vendiendo vaqueros en un mercadillo. Le fue mejor que con la Física.' }
      },
      ramiro: {
        nombre: 'Kolia',
        presentacion: 'Kolia, 45 años, minero del carbón en el Kuzbass, en Siberia. Baja al pozo cada día por un sueldo que no encuentra en qué gastar. En la mina no hay jabón para ducharse.',
        intereses: ['TRABAJADORES', 'CARBON', 'ENERGIA', 'COMIDA', 'VICIOS', 'VIVIENDA', 'INDUSTRIA', 'EMPRESAS'],
        neg: ['Kolia se entera de {medida} al salir del pozo, negro de carbón. En las duchas no hay jabón. "Y encima esto," dice.', 'En la cantina de la mina se habla de {medida}. Kolia golpea la mesa: "Que vengan aquí abajo los del Gosplán."', 'Kolia escribe una carta a Pravda sobre {medida}. No se la publican. Escribe otra. Tampoco.', 'Kolia hace números con su mujer: con {medida} el sueldo da para lo mismo, pero en la tienda hay menos. "¿Para qué cobramos?", pregunta ella.'],
        pos: ['Kolia brinda por {medida} en la cantina. Con té, que el vodka está racionado. Pero brinda.', '"Por fin uno que se acuerda de los que bajamos al pozo," dice Kolia. Sus compañeros asienten con la cabeza negra de carbón.', 'Kolia lleva a sus hijos al cine para celebrar {medida}. Ponen una película soviética sobre tractores. Los niños se duermen felices.'],
        neu: ['Kolia oye lo de {medida} en la radio de la mina y vuelve a bajar. Allí abajo no llegan los decretos.', 'A Kolia le da igual {medida}. Le preocupa más el grisú.'],
        hitos: [
          { id: 'kolia_huelga', bajo: -40, texto: 'Kolia y diez mil mineros se sientan en la plaza de Mezhdurechensk. Piden jabón, carne y que se vayan los jefes del Partido. Por este orden.', efectos: { pueblo: -3, tesoro: -3 } },
          { id: 'kolia_heroe', alto: 40, texto: 'Kolia ha sido nombrado Héroe del Trabajo Socialista. Lleva la medalla a la mina, debajo del mono.', efectos: { pueblo: 2 } }
        ],
        finales: { bien: 'Kolia se jubiló con una pensión que alcanzaba. Se compró una dacha pequeña y plantó patatas.', mal: 'Kolia lideró la huelga minera más grande de la historia soviética. Su foto, negro de carbón, dio la vuelta al mundo.', neutro: 'Kolia siguió bajando al pozo. Los secretarios generales cambiaban; la mina, no.' }
      },
      lucia: {
        nombre: 'Olga',
        presentacion: 'Olga, 31 años, enfermera en un hospital de Kiev. Hierve las jeringuillas porque no hay desechables y guarda en el bolso un rosario de su abuela que nadie debe ver.',
        intereses: ['SALUD', 'AGUA', 'AMBIENTE', 'ENERGIA', 'RELIGION', 'EDUCACION', 'TRABAJADORES', 'COMIDA'],
        neg: ['Olga se entera de {medida} en el turno de noche. Mira las camas del pasillo y no dice nada. No hace falta.', 'Olga escribe una carta a su hermana en Lvov sobre {medida}. Le dice que en el hospital ya no hay ni algodón.', 'Hoy Olga ha tenido que elegir a qué paciente le da el último antibiótico. Culpa a {medida}.', 'Olga ve lo de {medida} en el telediario de la sala de espera. Una paciente anciana se santigua. Olga, sin que nadie la vea, también.'],
        pos: ['Olga se entera de {medida} y, por primera vez en meses, llega al turno sonriendo.', '"Esto ayudará," le dice Olga a una paciente, y se lo cree.', 'En la sala de enfermeras, Olga recorta la noticia de {medida} y la pega en la pared, junto al calendario de vacunas.'],
        neu: ['Olga está demasiado cansada para enterarse de {medida}. Lleva dieciséis horas de turno.', 'Olga oye hablar de {medida} y piensa en sus pacientes. No ve qué tiene que ver con ellos.'],
        hitos: [
          { id: 'olga_rukh', bajo: -40, texto: 'Olga se ha unido a un grupo de Kiev que pide la verdad sobre la salud de los niños y, en voz más baja, otras cosas para Ucrania.', efectos: { pueblo: -2, salud: -1 } },
          { id: 'olga_jefa', alto: 40, texto: 'Olga ha sido nombrada jefa de enfermería. Lo primero que pide son jeringuillas. Llegan. Es un milagro soviético.', efectos: { salud: 2 } }
        ],
        finales: { bien: 'Olga llegó a dirigir un hospital en Kiev. En su despacho colgó tu foto, al lado del rosario.', mal: 'Olga dio testimonio sobre los hospitales de tu época ante una comisión internacional. Su declaración duró seis horas.', neutro: 'Olga siguió en el hospital. Las jeringuillas, a veces, llegaban.' }
      }
    };

    // Cómo se nombra a cada uno en un decreto ("destituir al mariscal", "encarcelar a Volkónov").
    Object.assign(RF.PERSONAS, {
      garrote: { tipo: 'ministro', stat: 'ejercito', claves: ['el mariscal', 'al mariscal', 'del mariscal', 'ministro de defensa', 'jefe del ejercito', 'gromov', 'dmitri gromov'] },
      cifuentes: { tipo: 'ministro', stat: 'cupula', claves: ['presidenta del gosplan', 'la del gosplan', 'jefa del gosplan', 'ministra de economia', 'orlova', 'valentina orlova'] },
      sombra: { tipo: 'ministro', stat: 'orden', claves: ['jefe del kgb', 'presidente del kgb', 'el del kgb', 'savin', 'viktor savin'] },
      paredes: { tipo: 'ministro', stat: 'pueblo', claves: ['secretario de ideologia', 'jefe de propaganda', 'ideologo', 'lapin', 'yegor lapin'] },
      montiel: { tipo: 'ministro', stat: 'mundo', claves: ['ministra de exteriores', 'ministro de exteriores', 'canciller', 'kovaliova', 'irina kovaliova'] },
      ventura: { tipo: 'ministro', stat: 'salud', claves: ['ministro de sanidad', 'ministro de salud', 'belov', 'arkadi belov'] },
      carmen: { tipo: 'ciudadano', oa: 'a', claves: ['abuela zina', 'la abuela', 'zina', 'la jubilada'] },
      nico: { tipo: 'ciudadano', oa: 'o', claves: ['sasha', 'el nieto de la abuela', 'el estudiante'] },
      ramiro: { tipo: 'ciudadano', oa: 'o', claves: ['kolia', 'el minero'] },
      lucia: { tipo: 'ciudadano', oa: 'a', claves: ['olga', 'la enfermera'] },
      valiente: { tipo: 'opositor', oa: 'o', nombre: 'Borís Volkónov', claves: ['volkonov', 'boris volkonov', 'el jefe del partido en moscu', 'el rival', 'el populista', 'lider de la oposicion', 'los disidentes', 'el disidente'] },
      embajador: { tipo: 'extranjero', oa: 'o', nombre: 'el embajador americano', claves: ['el embajador americano', 'el embajador', 'embajador', 'la embajada'] }
    });

    RF.SUCESORES = {
      garrote: [{ nombre: 'Mariscal Serguéi Akímov', corto: 'Akímov' }, { nombre: 'General Pável Lébedev', corto: 'Lébedev' }, { nombre: 'General Oleg Varénnikov', corto: 'Varénnikov' }],
      cifuentes: [{ nombre: 'Nikolái Pávlov', corto: 'Pávlov' }, { nombre: 'Tamara Sítnikova', corto: 'Sítnikova' }, { nombre: 'Lev Abalkin', corto: 'Abalkin' }],
      sombra: [{ nombre: 'Anatoli Kriúchkin', corto: 'Kriúchkin' }, { nombre: 'Gueorgui Tsvígun', corto: 'Tsvígun' }, { nombre: 'Coronel Iván Zhúkov', corto: 'Zhúkov' }],
      paredes: [{ nombre: 'Mijaíl Suslin', corto: 'Suslin' }, { nombre: 'Aleksandr Yákovlev', corto: 'Yákovlev' }, { nombre: 'Nina Andréieva', corto: 'Andréieva' }],
      montiel: [{ nombre: 'Andréi Gromiko', corto: 'Gromiko' }, { nombre: 'Eduard Shevardin', corto: 'Shevardin' }, { nombre: 'Ludmila Bessmértnaia', corto: 'Bessmértnaia' }],
      ventura: [{ nombre: 'Dra. Yelena Chazova', corto: 'Chazova' }, { nombre: 'Dr. Borís Petrovski', corto: 'Petrovski' }, { nombre: 'Dra. Irina Denísova', corto: 'Denísova' }]
    };

    // Los eventos de Corea del Norte no sirven aquí; se quedan los que necesita el sistema político.
    const comunes = ['congreso_bloquea', 'juicio_politico', 'autogolpe_ejercito', 'presion_democratica', 'comision_verdad'];
    RF.DILEMAS = RF.DILEMAS.filter(d => comunes.includes(d.id)).concat(DILEMAS);

    RF.UMBRALES = [
      { id: 'cacerolazo', stat: 'felicidad', bajo: 25, titulo: 'Colas que murmuran', texto: 'En la cola del Gastronom ya no se cuentan chistes sobre ti: se cuentan quejas, en voz alta. La milicia pasa de largo. Ella también hace cola.', efectos: { orden: -2 } },
      { id: 'sables', stat: 'ejercito', bajo: 25, titulo: 'Ruido de sables', texto: 'Tres mariscales dejan de ir a las cacerías de {garrote}. En el Ejército Rojo eso significa algo. Las divisiones de la región de Moscú hacen "maniobras".', efectos: { orden: -2 } },
      { id: 'conjura', stat: 'elite', bajo: 25, titulo: 'Conjura en el Politburó', texto: 'Cuatro miembros del Politburó cenan juntos en una dacha sin invitarte. Al día siguiente, los cuatro te sonríen demasiado. {sombra} toma nota. ¿Para quién?', efectos: { orden: -2 } },
      { id: 'arcas', stat: 'dinero', bajo: 0, titulo: 'Arcas vacías', texto: 'El Banco Estatal no tiene divisas para pagar el trigo que llega de Canadá. Los barcos esperan en el puerto de Odesa. {cifuentes} pide un préstamo a un banco alemán y no se lo cuenta a Pravda.', efectos: { orden: -2 } },
      { id: 'precios', stat: 'inflacion', alto: 25, titulo: 'El rublo de madera', texto: 'En el mercado negro, un dólar cuesta diez veces más que en el cambio oficial. La gente llama al rublo "de madera". Los que pueden, guardan latas de carne en vez de billetes.', efectos: { pueblo: -3 } },
      { id: 'hiper', stat: 'inflacion', alto: 100, titulo: 'Hiperinflación', texto: 'Los rublos ya no valen el papel en el que están impresos. La gente paga en vodka, en cigarrillos Marlboro y en favores.', efectos: { pueblo: -6, orden: -4 } }
    ];

    RF.AZAR = [
      { tono: 1, titulo: 'Oro en el hockey', texto: 'La selección soviética gana el Mundial de hockey sobre hielo. Durante una semana, nadie hace cola de mal humor.', efectos: { pueblo: 6 } },
      { tono: 1, titulo: 'La estación Mir', texto: 'Se lanza el primer módulo de la estación espacial Mir. Pravda le dedica ocho páginas. En la tienda sigue sin haber pasta de dientes, pero hay un cosmonauta en órbita.', efectos: { pueblo: 3, mundo: 3 } },
      { tono: -1, titulo: 'Mala cosecha', texto: 'Llueve en agosto en Ucrania y no llueve en julio en Kazajistán. La cosecha es mala. Hay que comprar más trigo a Canadá, con divisas que no sobran.', efectos: { tesoro: -6, pueblo: -2 } },
      { tono: -1, titulo: 'Sin jabón', texto: 'Se acaba el jabón en media Unión. El Gosplán descubre que la fábrica que lo hace lleva tres años cumpliendo el plan en toneladas... de cajas vacías.', efectos: { pueblo: -4 } },
      { tono: 1, titulo: 'El campeón de ajedrez', texto: 'Un soviético gana el campeonato mundial de ajedrez. El otro finalista también es soviético. Pravda celebra las dos cosas.', efectos: { pueblo: 3, mundo: 2 } },
      { tono: -1, titulo: 'El chiste del día', texto: 'Corre un chiste nuevo sobre ti: "¿Qué es un minuto de silencio en el Kremlin? Un pleno sin el Secretario General". {sombra} quiere saber quién lo inventó. Lo sabe media Moscú.', efectos: { pueblo: -1, cupula: -1 } },
      { tono: -1, titulo: 'Un Cessna en la Plaza Roja', texto: 'Un joven alemán vuela en avioneta desde Finlandia y aterriza junto a la Plaza Roja. La defensa aérea más grande del mundo no lo ha visto. {garrote} tiene que dar explicaciones; tú puedes aprovechar para jubilar a unos cuantos generales.', efectos: { ejercito: -5, mundo: 1 } },
      { tono: 1, titulo: 'Récord de producción', texto: 'Una fábrica de Sverdlovsk supera el plan en un 300%. Fabrica tornillos que nadie necesita, pero muchos.', efectos: { tesoro: 2, pueblo: 1 } },
      { tono: -1, titulo: 'Terremoto en Armenia', texto: 'Un terremoto arrasa el norte de Armenia. Los edificios nuevos se caen y los viejos aguantan: los constructores ahorraron cemento para cumplir el plan. Por primera vez se acepta ayuda extranjera.', efectos: { salud: -6, tesoro: -6, mundo: 3 } },
      { tono: 1, titulo: 'Medallero olímpico', texto: 'La URSS gana más medallas que nadie en los Juegos Olímpicos de Seúl. El himno suena tantas veces que la orquesta coreana se lo aprende de memoria.', efectos: { pueblo: 5, mundo: 2 } }
    ];

    Object.assign(RF.FINALES, {
      pueblo: { titulo: 'LA UNIÓN SE DESHACE', texto: 'Primero los bálticos, luego el Cáucaso, luego Ucrania. Las repúblicas se van una tras otra y en el Kremlin solo queda tu despacho. Una noche de diciembre, la bandera roja baja de la cúpula. Nadie la iza otra vez.' },
      ejercito: { titulo: 'GOLPE DE AGOSTO', texto: 'Estás de vacaciones en Crimea cuando te cortan el teléfono. En Moscú, los tanques rodean el Sóviet Supremo y la televisión emite "El lago de los cisnes" en bucle. El {n_garrote} anuncia que estás "enfermo". Te enteras por la radio.' },
      cupula: { titulo: 'EL PLENO TE DESTITUYE', texto: 'Te llaman de vacaciones para un pleno "urgente". Al llegar, el Politburó ya ha votado: "por motivos de salud", te jubilan. Como a Jruschov en 1964. Te dejan una dacha y una pensión. Y un guardia en la puerta, por si acaso.' },
      tesoro: { titulo: 'BANCARROTA', texto: 'La Unión Soviética no puede pagar ni el trigo que se come. Los bancos occidentales cierran el grifo y los barcos se dan la vuelta en Odesa. El rublo se convierte en una curiosidad para coleccionistas.' },
      hiperinflacion: { titulo: 'EL RUBLO DE PAPEL', texto: 'La inflación supera el mil por ciento. Nadie acepta rublos: ni los soldados, ni los mineros, ni tu chófer. Una mañana el Kremlin paga los sueldos en latas de carne.' }
    });

    RF.RADIO = {
      saludo: ['¡Buenos días, Unión Soviética! Aquí Radio Moscú, que retransmite en ochenta idiomas lo mismo en todos.', '¡Arriba, camaradas! Radio Moscú con las noticias que ya conocíais, ahora con coro del Ejército Rojo.', 'Radio Moscú informa, y Radio Moscú no se equivoca. Lo dice Pravda, que lo leyó en Radio Moscú.', 'Son las ocho en punto en Moscú, y en el resto de los once husos horarios de la patria, a otra hora pero con el mismo entusiasmo.'],
      tipos: {
        general: ['{Medida}. Los camaradas que no estén de acuerdo pueden escribir al Comité Central. La dirección es Siberia.', 'Entra en vigor {medida}. El plan quinquenal ya lo preveía, aunque nadie lo supiera.'],
        regalo: ['{Medida}. Es gratis. Bueno, lo pagáis vosotros, pero con cariño socialista.', '¡{Medida}! Recogedlo en la ventanilla número tres. La cola empieza en la ventanilla número uno.'],
        impuesto: ['{Medida}. No es un impuesto: es una contribución voluntaria al socialismo, obligatoria.', '{Medida}. Recordad que cada rublo que pagáis se convierte en un misil que os protege. Del rublo.'],
        represion: ['{Medida}. Si oís un coche negro esta noche, no os preocupéis: probablemente no es para vosotros.', '{Medida}. El KGB informa de que sabe lo que estáis pensando. Siga pensándolo, camarada, pero más bajo.'],
        libertad: ['{Medida}. Sois libres de estar de acuerdo.', '{Medida}. La libertad de expresión sigue intacta: podéis expresar vuestra gratitud en cualquier momento.'],
        economia: ['{Medida}. Los economistas occidentales no lo entienden. Buena señal: nunca entendieron el plan.', 'Tras {medida}, el rublo se mantiene firme. Firme, lo que se dice firme, como un poste.'],
        esencial: ['{Medida}. Quien pase hambre puede consolarse sabiendo que es un hambre planificada.', '{Medida}. Os recordamos que la nieve sigue siendo gratis. De momento.'],
        obra: ['{Medida}: la obra más grande de la historia de la humanidad, según el ingeniero que la proyectó, que es su cuñado.', '¡Empiezan las obras de {medida}! Estarán listas en el próximo plan quinquenal. O en el siguiente.'],
        culto: ['{Medida}. El Secretario General no quería, pero el Politburó insistió. El Politburó insiste mucho cuando se le pide.', '{Medida}. Esta noche habrá fuegos artificiales en la Plaza Roja. Traed vuestro propio abrigo.'],
        absurdo: ['{Medida}. Nuestros científicos de Novosibirsk llevaban años esperando esta medida. Nos lo acaban de decir, muy nerviosos.', '{Medida}. Quien se ría será invitado a explicar el chiste en la Lubianka.'],
        secreto: ['Hoy no ha pasado nada. Repetimos: absolutamente nada. Seguimos con el parte meteorológico: nieve, como siempre.', 'Radio Moscú no tiene ninguna información sobre ese asunto, ni sobre ningún otro, y esa información es falsa.']
      },
      despedida: ['Y ahora, música: el Coro del Ejército Rojo canta "Kalinka" por cuarta vez esta mañana.', 'Os dejamos con el himno de la Unión. Es obligatorio escucharlo de pie. Sí, también en la cola.']
    };

    RF.VOCES_EJERCITO = {
      pos: ['En el Estado Mayor, {garrote} manda repartir coñac armenio. Los mariscales brindan por ti. Tres veces, por si acaso.', 'Los oficiales del distrito militar de Moscú aplauden al oír {medida}. Aplauden mejor que el Sóviet Supremo, y eso ya es decir.', '{garrote} se pone una medalla nueva para celebrar {medida}. Ya tiene tantas que suena al andar.'],
      neg: ['En los cuarteles de Kabul, los soldados oyen lo de {medida} por la radio y se miran. Un teniente apunta quién habla más de la cuenta. Otro teniente apunta al primero.', '{garrote} escucha lo de {medida} sin pestañear. Luego pide los planos del Kremlin "para revisar la seguridad".', 'Los reclutas de la guarnición de Alemania llevan tres semanas comiendo kasha. Con {medida} ya no se la comen con la misma disciplina.'],
      neu: ['En los cuarteles, {medida} se lee en la formación de la mañana. Los soldados asienten a la vez, como les enseñaron.', 'El Ejército Rojo toma nota de {medida}. El Ejército Rojo siempre toma nota. Es lo que más miedo da del Ejército Rojo.']
    };

    if (RF.PRENSA && RF.PRENSA.oficial) RF.PRENSA.oficial.nombre = 'Pravda';
  };

  // ---------------------------------------------------------------- LOS EVENTOS
  const marca = (e, k) => !!(e.marcas && e.marcas[k]);
  const DILEMAS = [
    // --- La historia: llegan en su fecha, decidas lo que decidas antes ---
    {
      id: 'h_antialcohol', titulo: 'El país bebe', soloCadena: true,
      texto: 'Mayo de 1985. Las estadísticas que nadie publica dicen que el soviético medio bebe más de un litro de vodka a la semana, que la esperanza de vida de los hombres baja y que media fábrica llega tarde los lunes. {n_ventura} propone una campaña contra el alcohol. {cifuentes} recuerda, en voz muy baja, que el vodka es la cuarta parte de lo que recauda el Estado.',
      opciones: [
        { texto: 'Campaña antialcohol: menos vodka, más zumo', efectos: { dinero: -12, felicidad: -6, estabilidad: 1 }, ingresosFijos: -3, marca: { antialcohol: true },
          programar: [{ en: 2, titulo: 'El samogón', texto: 'Desaparece el azúcar de las tiendas: todo el mundo destila en casa. Las viñas de Crimea y Moldavia se arrancan para cumplir la campaña. El Estado pierde el impuesto y la gente sigue bebiendo, pero peor.', efectos: { felicidad: -3, dinero: -4 }, economia: { mercadoNegro: 6 } }],
          resultado: 'Se cierran la mitad de las licorerías y se bautiza al Secretario General, a sus espaldas, como "el secretario mineral". Las bodas se celebran con zumo. Los invitados traen su propia botella en el abrigo.' },
        { texto: 'Subir el precio del vodka, sin campañas', efectos: { dinero: 6, felicidad: -3 }, economia: { mercadoNegro: 3 },
          resultado: 'El vodka sube un 25%. La gente bebe un poco menos y paga bastante más. Las arcas lo agradecen; las colas, no tanto.' },
        { texto: 'Dejarlo estar: el vodka paga los misiles', efectos: { dinero: 3, felicidad: 2, estabilidad: -1 },
          resultado: 'El vodka sigue corriendo y el Estado sigue cobrando. {ventura} manda su informe al archivo, en la carpeta de "pendientes", que ocupa ya tres armarios.' }
      ]
    },
    {
      id: 'h_chernobil', titulo: 'Explosión en Chernóbil', soloCadena: true,
      texto: '26 de abril de 1986, 1:23 de la madrugada. El reactor número 4 de la central de Chernóbil, en Ucrania, ha explotado durante una prueba. El director dice que "la situación está bajo control". Los bomberos están en el tejado sin protección. A tres kilómetros, en Prípiat, cincuenta mil personas duermen. Suecia acaba de detectar radiación en sus centrales y pregunta qué pasa.',
      opciones: [
        { texto: 'Ocultarlo: "un incidente menor"', efectos: { estabilidad: 2, felicidad: -6, dinero: -12 }, relaciones: { europa: -14, eeuu: -8 }, animo: { lucia: -25 }, marca: { chernobil: 'ocultar' },
          programar: [{ en: 1, titulo: 'La nube', texto: 'La nube radiactiva cruza Bielorrusia, Polonia y Escandinavia. El 1 de mayo, en Kiev, se celebra el desfile como si nada, con niños en primera fila. Cuando se sabe, ya nadie cree a Pravda.', efectos: { felicidad: -6, estabilidad: -4 }, relaciones: { europa: -6 } }],
          resultado: 'Pravda da la noticia en cuatro líneas, en la página tres. Prípiat no se evacúa hasta treinta y seis horas después. En Kiev, Olga ve llegar a los primeros bomberos con la piel quemada.' },
        { texto: 'Evacuar y contarlo todo', efectos: { estabilidad: -3, felicidad: 2, dinero: -18, elite: -4 }, relaciones: { europa: 10, eeuu: 6 }, animo: { lucia: 15 }, marca: { chernobil: 'verdad' },
          resultado: 'Se evacúa Prípiat esa misma mañana y la televisión cuenta lo que pasa. Es la primera vez que el Kremlin reconoce un desastre en directo. El Politburó está horrorizado; el mundo, sorprendido.' },
        { texto: 'Contarlo y pedir ayuda a Occidente', efectos: { estabilidad: -4, dinero: -8, ejercito: -4, elite: -5 }, relaciones: { europa: 16, eeuu: 10, este: 4 }, animo: { lucia: 10 }, marca: { chernobil: 'ayuda' },
          resultado: 'Llegan médicos americanos y robots alemanes que se estropean con la radiación. Los soldados soviéticos ("biorrobots") limpian el tejado a paladas, noventa segundos cada uno. El ejército no perdona la humillación.' }
      ]
    },
    {
      id: 'h_reikiavik', titulo: 'La cumbre de Reikiavik', soloCadena: true,
      texto: 'Octubre de 1986. Washington acepta reunirse en Reikiavik, en una casa de madera junto al mar. Sobre la mesa, algo que nadie se esperaba: eliminar todos los misiles nucleares en diez años. El problema es la "guerra de las galaxias": el escudo antimisiles que Washington no quiere tocar. {garrote} no quiere tocar nada.',
      opciones: [
        { texto: 'Desarme total, aunque sigan con su escudo', efectos: { dinero: 15, ejercito: -12, estabilidad: -2 }, relaciones: { eeuu: 20, europa: 12, china: 4 }, sanciones: -1, marca: { reikiavik: 'desarme' },
          resultado: 'Firmas lo que nadie en el Kremlin se atrevía ni a pensar. El presupuesto militar se puede recortar por fin; los mariscales, en cambio, te pueden recortar a ti.' },
        { texto: 'Todo o nada: sin escudo no hay trato', efectos: { ejercito: 3 }, relaciones: { eeuu: -4, europa: -2 }, marca: { reikiavik: 'todo_o_nada' },
          programar: [{ en: 3, titulo: 'Los euromisiles', texto: 'Un año después, de la cumbre fallida sale algo más pequeño: un tratado para quitar los misiles de alcance medio de Europa. Washington lo firma; los mariscales lo toleran.', efectos: { dinero: 6, ejercito: -3 }, relaciones: { eeuu: 10, europa: 8 } }],
          resultado: 'La cumbre acaba sin acuerdo y con cara de funeral. Pero los dos os habéis mirado a los ojos, y eso, en plena Guerra Fría, es casi un tratado.' },
        { texto: 'No ir: la URSS no negocia con presión', efectos: { ejercito: 6, dinero: -8 }, relaciones: { eeuu: -12, europa: -8 }, marca: { reikiavik: 'no' },
          resultado: 'La silla soviética se queda vacía en Reikiavik. Los islandeses se comen el bufé. La carrera de armamentos sigue, y la pagas tú.' }
      ]
    },
    {
      id: 'h_afganistan', titulo: 'La herida abierta', soloCadena: true,
      texto: 'Marzo de 1987. Siete años en Afganistán: cien mil soldados, miles de muertos, ataúdes de zinc que llegan de noche a pueblos de toda la Unión. Los guerrilleros tienen misiles americanos que derriban los helicópteros. {garrote} pide más tropas para "acabar el trabajo". {montiel} pide un calendario de retirada. Las madres de los soldados piden a sus hijos.',
      opciones: [
        { texto: 'Retirada total, con fecha', efectos: { dinero: 10, ejercito: -10, felicidad: 6 }, relaciones: { eeuu: 12, china: 14, europa: 6 }, marca: { afganistan: 'retirada' },
          resultado: 'Anuncias la retirada. El último soldado cruzará el puente sobre el Amu Daria sin mirar atrás. Los veteranos vuelven sin desfile y con muchas preguntas.' },
        { texto: 'Mandar más tropas y acabar la guerra', efectos: { dinero: -16, ejercito: 8, felicidad: -6 }, relaciones: { eeuu: -12, china: -10 }, ingresos: -2, marca: { afganistan: 'escalada' },
          programar: [{ en: 3, titulo: 'Los ataúdes de zinc', texto: 'La guerra no se acaba. Los ataúdes siguen llegando de noche. En Leningrado, las madres de soldados se manifiestan con fotos de sus hijos. La milicia no se atreve a disolverlas.', efectos: { felicidad: -5, estabilidad: -3 } }],
          resultado: 'Llegan treinta mil soldados más. Los guerrilleros se retiran a las montañas y vuelven en cuanto los soldados se van. Como hace siete años. Como hace un siglo con los británicos.' },
        { texto: 'Quedarse, sin más ni menos', efectos: { dinero: -6, felicidad: -3 }, ingresos: -1, marca: { afganistan: 'quedarse' },
          resultado: 'Ni más ni menos: la guerra sigue como estaba, que es la forma más cara de no decidir.' }
      ]
    },
    {
      id: 'h_volkonov', titulo: 'El pleno de octubre', soloCadena: true,
      texto: 'Octubre de 1987. En el pleno del Comité Central, Borís Volkónov, el jefe del Partido en Moscú, se levanta sin pedir la palabra. Dice que las reformas van demasiado despacio, que la nomenklatura sigue con sus privilegios y que tú te estás rodeando de aduladores. Se hace un silencio de iglesia. Todos te miran.',
      opciones: [
        { texto: 'Humillarlo y destituirlo', efectos: { elite: 8, felicidad: -4 }, persona: { id: 'valiente', trato: 'destituir' }, marca: { volkonov: 'destituido' },
          programar: [{ en: 4, titulo: 'El regreso de Volkónov', texto: 'Volkónov, destituido, se ha convertido en un héroe: la gente lo para por la calle, los mineros lo aplauden. Se presenta a las elecciones y arrasa en Moscú.', efectos: { estabilidad: -4, elite: -3 } }],
          resultado: 'El pleno lo despedaza por turnos, como manda la tradición. Volkónov acaba en un hospital y luego en un despacho sin ventanas. Los moscovitas, que antes lo ignoraban, empiezan a quererlo.' },
        { texto: 'Darle la razón y acelerar las reformas', efectos: { elite: -8, felicidad: 5, estabilidad: -2 }, marca: { volkonov: 'aliado' },
          resultado: 'Le das la razón delante de todos. El Politburó no te lo perdonará; Volkónov tampoco: ahora tiene que estar de acuerdo contigo, y eso le quita el papel.' },
        { texto: 'Ignorarlo: que hable', efectos: { elite: 2 }, marca: { volkonov: 'ignorado' },
          resultado: 'Dejas que acabe y pasas al siguiente punto del orden del día: la producción de remolacha. Volkónov se sienta, rojo. Alguien en la sala aplaude, solo una vez, y se calla.' }
      ]
    },
    {
      id: 'h_karabaj', titulo: 'Las montañas negras', soloCadena: true,
      texto: 'Febrero de 1988. El Karabaj, una región de mayoría armenia dentro de Azerbaiyán, vota pedir su paso a Armenia. En Ereván se manifiestan un millón de personas; en Sumgait, en Azerbaiyán, hay pogromos. Es la primera vez en setenta años que dos repúblicas soviéticas se enfrentan. Las demás miran.',
      opciones: [
        { texto: 'Mandar tropas y estado de excepción', efectos: { estabilidad: 3, felicidad: -4, ejercito: 3 }, relaciones: { europa: -4, eeuu: -4 }, marca: { karabaj: 'tropas' },
          resultado: 'Los tanques entran en Bakú y en Ereván. Se acaban los pogromos y empieza el rencor. En los bálticos toman nota: así responde Moscú.' },
        { texto: 'Negociar con las dos repúblicas', efectos: { estabilidad: -3, elite: -2 }, marca: { karabaj: 'negociar' },
          resultado: 'Abres una comisión. Los armenios dicen que es poco; los azeríes, que es demasiado. La comisión se reúne mucho y decide poco, que es lo que hacen las comisiones.' },
        { texto: 'Dejar que voten su destino', efectos: { estabilidad: -6, felicidad: 2, elite: -5 }, relaciones: { europa: 4 }, marca: { karabaj: 'votar' },
          resultado: 'Dejas que el Karabaj decida. Azerbaiyán se siente traicionada; y en Tallin, Riga y Vilna alguien pregunta: "¿Y nosotros también podemos votar?"' }
      ]
    },
    {
      id: 'h_elecciones89', titulo: 'Las primeras elecciones', soloCadena: true,
      texto: 'Marzo de 1989. Toca elegir el nuevo Congreso de Diputados del Pueblo. Por primera vez desde 1917, podría haber varios candidatos por escaño. El Politburó quiere listas cerradas "para evitar sorpresas". Volkónov quiere presentarse en Moscú. Los reformistas quieren televisión en directo.',
      opciones: [
        { texto: 'Elecciones semilibres, como prometiste', efectos: { felicidad: 8, elite: -8, estabilidad: -3 }, relaciones: { eeuu: 8, europa: 10 }, marca: { elecciones: 'libres' },
          programar: [{ en: 1, titulo: 'El país en directo', texto: 'Las sesiones del Congreso se televisan. Las fábricas se paran para verlas. Un diputado de Siberia acusa al KGB en directo. Media Unión deja de trabajar para oírlo.', efectos: { felicidad: 4, dinero: -5, elite: -3 } }],
          resultado: 'Treinta y ocho secretarios regionales del Partido pierden su escaño ante candidatos que nadie conocía. Volkónov gana en Moscú con el 89%. El Politburó te mira como se mira a quien ha abierto una ventana en invierno.' },
        { texto: 'Listas del Partido, sin sorpresas', efectos: { elite: 6, felicidad: -6 }, relaciones: { europa: -6, eeuu: -4 }, marca: { elecciones: 'amanadas' },
          resultado: 'Gana el Partido, como siempre, con el 99%. Nadie se lo cree, como siempre. Pero esta vez la gente lo dice en voz alta en la cola.' }
      ]
    },
    {
      id: 'h_mineros', titulo: 'Los mineros se sientan', soloCadena: true,
      texto: 'Julio de 1989. En Mezhdurechensk, en el Kuzbass, los mineros salen del pozo y no vuelven a bajar. En dos semanas hay medio millón en huelga, de Siberia al Donbass. Piden jabón, carne, pensiones y que se vayan los jefes del Partido. Kolia está en la primera fila, negro de carbón.',
      opciones: [
        { texto: 'Darles lo que piden', efectos: { dinero: -16, felicidad: 6, elite: -4 }, ingresos: -2, animo: { ramiro: 25 }, marca: { mineros: 'ceder' },
          resultado: 'Mandas jabón, carne y una comisión. Los mineros vuelven al pozo. El resto de los obreros de la Unión toma nota: la huelga funciona.' },
        { texto: 'Mandar a la milicia', efectos: { estabilidad: 2, felicidad: -8, ejercito: -3 }, animo: { ramiro: -30 }, relaciones: { europa: -6, eeuu: -6 }, marca: { mineros: 'reprimir' },
          resultado: 'La milicia llega a Mezhdurechensk y se encuentra con diez mil mineros sentados en silencio. Nadie da la orden de cargar. Al tercer día, la milicia se va. Los mineros, no.' },
        { texto: 'Dejar que las minas sean de los mineros', efectos: { dinero: -6, felicidad: 4, elite: -6 }, economia: { mercadoNegro: -4 }, animo: { ramiro: 15 }, marca: { mineros: 'autogestion' },
          resultado: 'Las minas pasan a cooperativas de los propios mineros. Venden carbón por su cuenta, algunas a Japón. El Gosplán pierde el control de su primer gran sector.' }
      ]
    },
    {
      id: 'h_muro', titulo: 'El Muro', soloCadena: true,
      texto: '9 de noviembre de 1989, noche. En Berlín Este, un portavoz se equivoca en una rueda de prensa y dice que se puede cruzar la frontera "inmediatamente". Miles de personas se agolpan en los puestos fronterizos. Los guardias llaman a Moscú. En Alemania Oriental hay trescientos ochenta mil soldados soviéticos esperando órdenes.',
      opciones: [
        { texto: 'No intervenir: que decidan los alemanes', efectos: { ejercito: -8, elite: -6, felicidad: 3 }, relaciones: { europa: 20, eeuu: 15, este: 10 }, sanciones: -1, marca: { muro: 'dejar' },
          resultado: 'Los soldados soviéticos se quedan en sus cuarteles. A medianoche, los berlineses suben al Muro con martillos y champán. Los mariscales lo ven por televisión, en silencio, como quien ve hundirse su barco.' },
        { texto: 'Mandar los tanques, como en Praga', efectos: { ejercito: 8, estabilidad: 2, dinero: -20, felicidad: -6 }, relaciones: { europa: -25, eeuu: -25, este: -25, china: 4 }, sanciones: 2, marca: { muro: 'tanques' },
          programar: [{ en: 2, titulo: 'El mundo se cierra', texto: 'Occidente corta los créditos y el comercio de gas. Los bancos alemanes reclaman sus préstamos. En Polonia, Hungría y Checoslovaquia la gente sale a la calle de todos modos.', efectos: { dinero: -12, estabilidad: -4 } }],
          resultado: 'Los tanques avanzan hacia la Puerta de Brandeburgo. Las imágenes dan la vuelta al mundo. El Muro sigue en pie, y la Guerra Fría vuelve a helarse de golpe.' },
        { texto: 'Negociar la unidad alemana a cambio de dinero', efectos: { dinero: 25, ejercito: -6, elite: -3 }, relaciones: { europa: 18, eeuu: 10, este: 6 }, marca: { muro: 'negociar' },
          resultado: 'Dejas caer el Muro y, al día siguiente, llamas a Bonn. Los alemanes pagarán miles de millones de marcos por la retirada de tus tropas y por sus cuarteles. Te llaman pragmático; tus mariscales, otra cosa.' }
      ]
    },
    {
      id: 'h_balticos', titulo: 'Los bálticos se van', soloCadena: true,
      texto: 'Marzo de 1990. Lituania declara su independencia. Estonia y Letonia preparan lo mismo. Hace siete meses, dos millones de personas formaron una cadena humana de seiscientos kilómetros de Tallin a Vilna. {garrote} tiene un plan para "restablecer el orden constitucional". {montiel} tiene una lista de las capitales que romperán relaciones si lo usas.',
      opciones: [
        { texto: 'Dejarlos ir, con un tratado', efectos: { estabilidad: -6, ejercito: -6, elite: -6 }, relaciones: { europa: 15, eeuu: 15 }, marca: { balticos: 'fuera' },
          resultado: 'Firmas su salida. Las tres banderas suben en Tallin, Riga y Vilna. En Kiev, en Tiflis y en Alma Atá alguien toma nota.' },
        { texto: 'Bloqueo económico hasta que se lo piensen', efectos: { estabilidad: 2, dinero: -6 }, relaciones: { europa: -8, eeuu: -10 }, marca: { balticos: 'bloqueo' },
          programar: [{ en: 2, titulo: 'El bloqueo se agota', texto: 'Lituania aguanta el bloqueo con leña y orgullo. Los demás bálticos se solidarizan. El bloqueo se levanta sin que nadie haya cedido, salvo tu prestigio.', efectos: { estabilidad: -3 } }],
          resultado: 'Cortas el petróleo y el gas a Lituania. Los lituanos van en bicicleta al Parlamento. La foto da la vuelta al mundo.' },
        { texto: 'Mandar a las tropas especiales', efectos: { estabilidad: 3, felicidad: -6, ejercito: 4 }, relaciones: { europa: -16, eeuu: -16 }, sanciones: 1, marca: { balticos: 'tropas' },
          programar: [{ en: 1, titulo: 'La torre de televisión', texto: 'En Vilna, las tropas toman la torre de televisión. Hay catorce muertos. La gente forma cadenas humanas alrededor del Parlamento. Nadie se va a casa.', efectos: { felicidad: -6, estabilidad: -6, elite: -3 } }],
          resultado: 'Los paracaidistas aterrizan en Vilna. "El orden constitucional se ha restablecido", anuncia Pravda. El orden, en cambio, no se ha enterado.' }
      ]
    },
    {
      id: 'h_golpe', titulo: 'Agosto de 1991', soloCadena: true,
      texto: '18 de agosto de 1991. Estás de vacaciones en Crimea. A las cinco de la tarde, una delegación llega sin avisar: el jefe del KGB, dos mariscales y el vicepresidente. Te piden que firmes un estado de excepción o que dimitas "por motivos de salud". El teléfono está cortado. En Moscú, los tanques se preparan.',
      opciones: [
        { texto: 'Negarte en redondo y esperar', efectos: { ejercito: -10, elite: -8, felicidad: 6, estabilidad: -6 }, marca: { golpe: 'resistir' },
          programar: [{ en: 1, titulo: 'Tres días', texto: 'En Moscú, la gente rodea el Parlamento con barricadas de trolebuses. Los tanques no disparan. Al tercer día, los golpistas se rinden. Vuelves a Moscú, pero el país ya no es el mismo: el que paró los tanques fue el pueblo, no tú.', efectos: { estabilidad: -4, felicidad: 5, elite: -6 } }],
          resultado: 'Dices que no. Te dejan encerrado en la dacha con tu familia y una radio de onda corta. Escuchas la BBC para saber qué pasa en tu propio país.' },
        { texto: 'Firmar el estado de excepción', efectos: { ejercito: 10, estabilidad: 4, felicidad: -10 }, relaciones: { europa: -20, eeuu: -20 }, sanciones: 2, marca: { golpe: 'firmar' },
          programar: [{ en: 1, titulo: 'El orden de los tanques', texto: 'Hay toque de queda en Moscú y Leningrado. Las repúblicas que ya hablaban de independencia la declaran esa misma semana. Occidente cierra el grifo.', efectos: { estabilidad: -6, dinero: -15 } }],
          resultado: 'Firmas. Los tanques entran en Moscú y la televisión emite "El lago de los cisnes". El orden se impone, de momento. Ahora gobiernas con los que te encerraron.' },
        { texto: 'Adelantarte: detener a los conspiradores', efectos: { ejercito: -6, elite: -4, estabilidad: 3 }, persona: { id: 'sombra', trato: 'encarcelar' }, marca: { golpe: 'adelantarse' },
          resultado: 'Tu guardia personal, la única que aún te es leal, detiene a la delegación en el porche. El jefe del KGB pide un abogado. En la URSS no hay costumbre, pero se le busca uno.' }
      ]
    },

    // --- Lo que puede pasar en cualquier momento ---
    {
      id: 'u_cooperativas', titulo: 'Los cooperativistas', peso: 1, unaVez: true,
      si: e => e.dia >= 6,
      texto: 'En Moscú ha abierto un restaurante privado, con manteles y camareros que sonríen. Se llama "cooperativa" para no llamarse "empresa". Hay cola para entrar y cola para denunciarlo. {cifuentes} quiere cerrarlo; {paredes} quiere saber dónde comen sus redactores.',
      opciones: [
        { texto: 'Legalizar las cooperativas', efectos: { dinero: 6, felicidad: 4, elite: -4 }, economia: { mercadoNegro: -8 }, resultado: 'En un año hay cien mil cooperativas: restaurantes, talleres, vaqueros cosidos en garajes. También los primeros millonarios soviéticos, y la primera mafia.' },
        { texto: 'Cerrarlo: eso es capitalismo', efectos: { elite: 3, felicidad: -3 }, economia: { mercadoNegro: 4 }, resultado: 'Se cierra el restaurante. El cocinero abre otro en su casa, sin manteles y sin pagar impuestos.' }
      ]
    },
    {
      id: 'u_vaqueros', titulo: 'La fiebre de los vaqueros', peso: 1, unaVez: true,
      si: e => e.dia >= 3,
      texto: 'Unos vaqueros americanos de verdad cuestan en el mercado negro dos meses de sueldo. Los estudiantes de Leningrado hacen cola delante de los hoteles para comprárselos a los turistas finlandeses. {sombra} quiere detener a los revendedores; {cifuentes} propone fabricarlos.',
      opciones: [
        { texto: 'Fabricar vaqueros soviéticos', efectos: { dinero: -6, felicidad: 3 }, animo: { nico: 8 }, resultado: 'La fábrica Bolshevichka produce vaqueros "Vérjovina". Son de color gris, pican y destiñen en la primera lavadora. Se agotan en dos horas.' },
        { texto: 'Detener a los revendedores', efectos: { estabilidad: 1, felicidad: -3 }, animo: { nico: -12 }, resultado: 'Detienen a trescientos estudiantes con bolsas de vaqueros. Al día siguiente, los vaqueros cuestan el doble.' },
        { texto: 'Importarlos con divisas', efectos: { dinero: -10, felicidad: 5 }, animo: { nico: 12 }, resultado: 'Llegan cien mil vaqueros de Turquía. Duran una semana en las tiendas y diez años en las fotos de familia.' }
      ]
    },
    {
      id: 'u_general_afgano', titulo: 'Los afgantsy', urgente: true, peso: 1.2,
      si: e => e.dia >= 6 && e.sectores.ejercito < 35,
      texto: 'Un grupo de veteranos de Afganistán, con sus medallas y sus muletas, se planta delante del Ministerio de Defensa. Piden pisos, pensiones y que alguien les explique para qué fueron. Detrás de ellos, sin medallas, hay unos cuantos coroneles de paisano.',
      opciones: [
        { texto: 'Pisos y pensiones para los veteranos', efectos: { dinero: -12, ejercito: 8, felicidad: 2 }, ingresos: -1, resultado: 'Se construyen bloques de pisos para veteranos en las afueras de cada ciudad. Tardan tres años y tienen goteras, pero tienen nombre: "Calle de los Internacionalistas".' },
        { texto: 'Recibirlos y darles medallas', efectos: { ejercito: 3, dinero: -2 }, resultado: 'Les das medallas nuevas. Los veteranos las guardan con las otras. Ya pesan más que las muletas.' },
        { texto: 'Dispersarlos', efectos: { ejercito: -8, estabilidad: 1 }, resultado: 'La milicia los dispersa con cuidado: nadie quiere la foto de un policía empujando a un hombre sin piernas. La foto sale igual.' }
      ]
    },
    {
      id: 'u_pleno', titulo: 'Se convoca un pleno', urgente: true, peso: 1.2, unaVez: true,
      si: e => e.dia >= 5 && e.sectores.elite < 35,
      texto: 'Te enteras de que varios miembros del Politburó han pedido convocar un pleno extraordinario del Comité Central. El orden del día dice "asuntos organizativos". En 1964, con Jruschov, también decía "asuntos organizativos".',
      opciones: [
        { texto: 'Repartir cargos y dachas', efectos: { dinero: -10, elite: 12, felicidad: -2 }, resultado: 'Hay ascensos, dachas en el mar Negro y coches nuevos. El pleno se desconvoca "por falta de asuntos". La nomenklatura vuelve a quererte, a su manera.' },
        { texto: 'Adelantarte y jubilar a los conspiradores', efectos: { elite: -4, estabilidad: 2 }, resultado: 'Cinco miembros del Politburó se jubilan "por motivos de salud" la misma semana. Están todos estupendamente.' },
        { texto: 'Enfrentarlos en el pleno', efectos: { elite: -6, felicidad: 3, estabilidad: -2 }, resultado: 'Vas al pleno y hablas tres horas sin papeles. Ganas la votación por cuatro votos. Te sobran los aplausos y te faltan amigos.' }
      ]
    },
    {
      id: 'u_samizdat', titulo: 'El samizdat', peso: 1,
      si: e => e.dia >= 3,
      texto: 'Circula por Moscú, mecanografiada en papel de cebolla, una novela prohibida: cada lector hace cinco copias y las pasa. {sombra} ha encontrado una en el despacho de un viceministro. {paredes} confiesa, en voz baja, que él ya la ha leído.',
      opciones: [
        { texto: 'Publicarla en una revista oficial', efectos: { felicidad: 4, elite: -3 }, animo: { nico: 10 }, resultado: 'La revista Novy Mir la publica por entregas. La tirada se agota en un día. Los que ya la habían leído a escondidas descubren que en papel bueno pierde algo de gracia.' },
        { texto: 'Perseguir a los copistas', efectos: { estabilidad: 1, felicidad: -3 }, animo: { nico: -10 }, resultado: 'Se detiene a doce mecanógrafas. La novela se copia ahora en máquinas más silenciosas.' }
      ]
    },
    {
      id: 'u_pan', titulo: 'Sin pan en la capital', urgente: true, peso: 1,
      si: e => e.dia >= 4 && e.stats.felicidad < 35,
      texto: 'Un rumor recorre Moscú: va a faltar el pan. No es verdad, pero la gente compra el doble y entonces es verdad. En las panaderías hay colas desde las cinco de la mañana. La abuela Zina lleva tres horas en una.',
      opciones: [
        { texto: 'Abrir las reservas del Estado', efectos: { dinero: -10, felicidad: 5 }, animo: { carmen: 12 }, resultado: 'Se abren los almacenes y las panaderías se llenan. El rumor se apaga en dos días. En los almacenes, de paso, aparecen toneladas de carne que nadie sabía que había.' },
        { texto: 'Racionar con cupones', efectos: { felicidad: -3, estabilidad: 2 }, animo: { carmen: -5 }, resultado: 'Se reparten cupones de pan por primera vez desde la guerra. La abuela Zina los guarda en la misma caja que los de 1943.' }
      ]
    },
    {
      id: 'u_petroleo_sube', titulo: 'El petróleo sube', peso: 0.8, unaVez: true,
      si: e => e.dia >= 12,
      texto: 'Una guerra en el golfo Pérsico dispara el precio del petróleo. Por primera vez en años, a la URSS le llueven divisas. {cifuentes} quiere guardarlas; {garrote} sabe en qué gastarlas; la abuela Zina querría jabón.',
      opciones: [
        { texto: 'Importar comida y jabón', efectos: { dinero: 10, felicidad: 6 }, animo: { carmen: 10 }, resultado: 'Llegan barcos con pollo americano, que la gente llama "las patas de Bush". Hay jabón en las tiendas durante tres meses enteros.' },
        { texto: 'Guardarlas para pagar deudas', efectos: { dinero: 22, elite: 2 }, resultado: 'Las divisas van a pagar a los bancos alemanes. Las tiendas siguen igual de vacías, pero ahora con las cuentas en orden.' },
        { texto: 'Modernizar el ejército', efectos: { dinero: 8, ejercito: 8 }, resultado: 'El ejército estrena helicópteros. {garrote} te invita a probar uno. Declinas.' }
      ]
    }
  ];

  // ---------------------------------------------------------------- EL ESCENARIO
  RF.ESCENARIOS = RF.ESCENARIOS || {};
  RF.ESCENARIOS.urss1985 = {
    id: 'urss1985', pais: 'urss', nombre: 'La URSS, 1985', subtitulo: 'Salvar la Unión',
    resumen: 'Marzo de 1985: el Politburó te elige Secretario General de una superpotencia estancada. Objetivo: que la Unión Soviética siga existiendo en diciembre de 1991.',
    calendario: { anio: 1985, mes: 2, mesesPorTurno: 3 },
    turnos: 27,
    objetivo: {
      texto: 'Que la Unión Soviética siga existiendo en diciembre de 1991, el mes en que se disolvió de verdad: llega al final con la estabilidad por encima de 15 y sin perder más que las repúblicas bálticas.',
      evaluar: e => {
        const balticos = marca(e, 'balticos') && e.marcas.balticos === 'fuera';
        const reformas = (e.politica && e.politica.prensa === 'libre') || (e.marcas && e.marcas.elecciones === 'libres');
        const hierro = e.marcas && (e.marcas.muro === 'tanques' || e.marcas.golpe === 'firmar' || e.marcas.balticos === 'tropas');
        if (e.stats.estabilidad < 15) return { ganado: false, titulo: 'LA UNIÓN SE DESHACE', texto: 'Llegas a diciembre de 1991, pero la Unión ya no se sostiene: la estabilidad está por los suelos y las repúblicas firman, una tras otra, su salida. La bandera roja baja de la cúpula del Kremlin. Has durado lo mismo que la historia; no has podido cambiarla.' };
        if (hierro) return { ganado: true, titulo: 'LA URSS DE HIERRO', texto: 'Diciembre de 1991: la bandera roja sigue en el Kremlin. La Unión aguanta, sostenida por los tanques y el miedo, más pobre y más sola que nunca. Has cambiado la historia; el mundo no sabe si alegrarse.' + (balticos ? ' Solo los bálticos se fueron.' : '') };
        if (reformas) return { ganado: true, titulo: 'UNA UNIÓN DISTINTA', texto: 'Diciembre de 1991: la Unión Soviética sigue existiendo, pero ya no se parece a la de 1985. Hay prensa que critica, diputados que votan en contra y colas que protestan. Has conseguido lo que no consiguió nadie: reformarla sin que se rompiera.' + (balticos ? ' Los bálticos se fueron con un tratado; las otras doce repúblicas siguen.' : '') };
        return { ganado: true, titulo: 'LA UNIÓN AGUANTA', texto: 'Diciembre de 1991: la bandera roja sigue en el Kremlin. La Unión aguanta, sin grandes reformas y sin grandes desastres, como un viejo tractor que sigue arrancando. Has cambiado la historia; ahora toca seguir tirando.' + (balticos ? ' Solo los bálticos se fueron.' : '') };
      }
    },
    historia: [
      { turno: 2, dilema: 'h_antialcohol' },
      { turno: 4, noticia: { titulo: 'El petróleo se hunde', texto: 'Arabia Saudí abre el grifo y el precio del petróleo cae a la mitad en unos meses. Las divisas que pagaban el trigo, las máquinas y los misiles se evaporan. {cifuentes} entra en tu despacho con una gráfica que baja como una escalera.', efectos: { dinero: -15 }, ingresos: -6 } },
      { turno: 5, dilema: 'h_chernobil' },
      { turno: 7, dilema: 'h_reikiavik' },
      { turno: 9, dilema: 'h_afganistan' },
      { turno: 11, dilema: 'h_volkonov' },
      { turno: 12, dilema: 'h_karabaj' },
      { turno: 17, dilema: 'h_elecciones89' },
      { turno: 18, dilema: 'h_mineros' },
      { turno: 19, dilema: 'h_muro' },
      { turno: 21, dilema: 'h_balticos' },
      { turno: 26, dilema: 'h_golpe' }
    ],
    real: 'En la historia real, el Secretario General elegido en marzo de 1985 fue Mijaíl Gorbachov. Lanzó la campaña antialcohol (1985), tardó días en reconocer Chernóbil (1986), abrió la prensa con la glásnost, rozó el desarme total en Reikiavik (1986) y firmó el tratado de los euromisiles (1987), sacó las tropas de Afganistán (1989), convocó las primeras elecciones semilibres (1989) y dejó caer el Muro de Berlín sin disparar un tiro. La economía se hundió con el petróleo, los bálticos se fueron, el golpe de agosto de 1991 fracasó en tres días y, el 25 de diciembre de 1991, Gorbachov dimitió. La Unión Soviética dejó de existir al día siguiente.',
    comparar: e => {
      const m = e.marcas || {}, out = [];
      const prensa = e.politica && e.politica.prensa === 'libre';
      out.push(prensa ? '• Abriste la prensa, como la glásnost de 1986.' : '• Mantuviste la censura; Gorbachov la abrió en 1986.');
      if (m.antialcohol) out.push('• Hiciste la campaña antialcohol, igual que en 1985: el Estado perdió el impuesto y floreció el samogón.');
      else out.push('• No hiciste la campaña antialcohol que en 1985 vació las arcas.');
      if (m.chernobil) out.push(m.chernobil === 'ocultar' ? '• Ocultaste Chernóbil, como el Kremlin real los primeros días.' : '• Contaste la verdad de Chernóbil enseguida; el Kremlin real tardó días.');
      if (m.afganistan) out.push(m.afganistan === 'retirada' ? '• Sacaste las tropas de Afganistán, como en 1989.' : '• Te quedaste en Afganistán; la URSS real salió en 1989.');
      if (m.muro) out.push(m.muro === 'tanques' ? '• Mandaste los tanques a Berlín; en 1989 Moscú no movió un soldado.' : '• Dejaste caer el Muro, como en 1989.' + (m.muro === 'negociar' ? ' Y además cobraste por ello.' : ''));
      if (m.balticos) out.push(m.balticos === 'fuera' ? '• Dejaste ir a los bálticos con un tratado; en la realidad se fueron a la fuerza en 1991.' : '• Intentaste retener a los bálticos, como en Vilna en enero de 1991.');
      if (m.golpe) out.push(m.golpe === 'firmar' ? '• Firmaste el estado de excepción que Gorbachov se negó a firmar.' : m.golpe === 'adelantarse' ? '• Te adelantaste al golpe de agosto; Gorbachov no lo vio venir.' : '• Te negaste a firmar, como Gorbachov en Foros.');
      if (e.leyes.some(l => /MERCADOS|EMPRESAS/.test(l.clave || '')) || e.economia.mercadoNegro < 15) out.push('• Liberalizaste la economía más que la perestroika, que se quedó a medias.');
      out.push('• Terminas con ' + Math.round(e.stats.dinero) + 'M en divisas y una inflación del ' + Math.round(e.stats.inflacion) + '%. La URSS real acabó sin divisas y con el rublo hundido.');
      return out;
    }
  };
})(globalThis.RF = globalThis.RF || {});
