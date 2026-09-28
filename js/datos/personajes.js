/*
 * PERSONAJES
 * El gabinete (la cúpula) y la gente de a pie que vive tus decretos.
 * Plantillas: [a|b|c] elige una opción al azar; {medida}, {objeto}, {Medida} se rellenan solos.
 */
(function (RF) {
  'use strict';

  RF.PAIS = {
    nombre: 'República Popular Democrática de Corea',
    corto: 'Corea del Norte',
    capital: 'Pionyang',
    moneda: 'wones'
  };

  // Cada ministro vigila una estadística y reacciona cuando cambia.
  RF.GABINETE = {
    garrote: {
      nombre: 'Mariscal Jang Tae-bok', corto: 'Jang', cargo: 'Ministro de Defensa del Pueblo',
      pos: [
        'El {n_garrote} golpea la mesa con el puño. "[Por fin|Al fin|Ya era hora], {lider}. Así se gobierna." Esa noche los cuarteles brindan en su nombre.',
        '{garrote} se ajusta las medallas. "El ejército aprueba {medida}." No sonríe, pero tampoco hace falta.',
        'En el cuartel central, los oficiales comentan {medida} con aprobación. {garrote} manda una caja de puros a Palacio.'
      ],
      neg: [
        'El {n_garrote} escucha el anuncio sin parpadear. Después pide su coche y no vuelve a Palacio en todo el día.',
        '"Con todo respeto, {lider}," dice {garrote}, "{medida} no le gusta a mis muchachos." Lo de "con todo respeto" suena a amenaza.',
        '{garrote} convoca a los coroneles a una reunión "de rutina". Nadie en Palacio sabe de qué hablaron.'
      ],
      bajo: [
        'Se ven luces encendidas de madrugada en el Estado Mayor. {garrote} ya no contesta sus llamadas a la primera.',
        'Un coronel joven le susurra a tu secretaria: "Cuide al Líder Supremo. Hay gente contando tanques."'
      ]
    },
    cifuentes: {
      nombre: 'Pak Mi-ran', corto: 'Pak', cargo: 'Ministra de Finanzas',
      pos: [
        '{n_cifuentes} repasa las cuentas y sonríe con los labios, no con los ojos. "Las familias importantes están contentas, {lider}."',
        '{cifuentes} brinda con champán importado en el club del Comité Central. Los cuadros del Partido la llaman "la ministra razonable".',
        '"Excelente decisión," dice {cifuentes} mientras anota algo en una libreta que nunca deja ver a nadie.'
      ],
      neg: [
        '{cifuentes} cierra la carpeta de golpe. "¿Sabe cuánto nos cuesta {medida}? No, claro que no lo sabe."',
        'Esa noche, {n_cifuentes} cena con tres comerciantes chinos. En la mesa de al lado, un periodista extranjero toma notas.',
        '{n_cifuentes} pide ver los libros contables "por si acaso". Nadie sabe qué significa ese "por si acaso".'
      ],
      bajo: [
        '{cifuentes} ha abierto una cuenta en un banco suizo. Tus espías lo saben. Ella sabe que tú lo sabes.',
        'En el club del Comité Central ya no se brinda por ti. Se brinda por "lo que venga después".'
      ]
    },
    sombra: {
      nombre: 'Ryu Chang-sok', corto: 'Ryu', cargo: 'Ministro de Seguridad del Estado',
      pos: [
        '{n_sombra} deja una carpeta sobre tu escritorio: calles tranquilas, archivos llenos. "Todo bajo control, {lider}."',
        '{sombra} asiente despacio. "La gente obedece mejor cuando sabe que la estamos mirando."',
        'En el sótano del Ministerio de Seguridad del Estado, las máquinas de escribir no paran. {sombra} está de buen humor.'
      ],
      neg: [
        '{sombra} frunce el ceño. "Con {medida} las calles se van a calentar. Mis hombres no son suficientes."',
        '"Voy a necesitar más agentes," dice {sombra}. "Y más celdas. Y más paciencia, {lider}."',
        '{n_sombra} enciende un cigarro en la ventana y mira la plaza. "Esto va a traer problemas."'
      ],
      bajo: [
        '{sombra} ya no te cuenta todo. Sus informes llegan tarde y con páginas arrancadas.',
        'Hay pintadas contra ti en la pared del propio Ministerio de Seguridad del Estado. Nadie vio nada.'
      ]
    },
    paredes: {
      nombre: 'Kang Myong-dal', corto: 'Kang', cargo: 'Jefe de Propaganda y Agitación',
      pos: [
        '{n_paredes} ya tiene el eslogan: "¡{Medida}, la Patria lo agradece!" Los carteles se imprimen esa misma noche.',
        'En la televisión estatal, {paredes} presenta {medida} con música épica y niños sonriendo. Esta vez la gente sonríe de verdad.',
        '"Esto se vende solo, {lider}," dice {paredes}. Por primera vez en semanas no tiene que inventar nada.'
      ],
      neg: [
        '{n_paredes} suda. "Puedo venderlo, {lider}. Todo se puede vender. Pero {medida} me lo pone difícil."',
        'La televisión estatal dedica tres horas a un documental sobre patos para no hablar de {medida}.',
        '{paredes} manda imprimir carteles que dicen "Sacrificio es Patriotismo". Alguien les pinta bigotes antes del amanecer.'
      ],
      bajo: [
        'Ya ni la televisión estatal logra tapar los abucheos. {paredes} ha empezado a hablar de ti en pasado.',
        '{n_paredes} pide vacaciones "por salud". Tiene el pasaporte en el bolsillo.'
      ]
    },
    montiel: {
      nombre: 'Ri Song-mi', corto: 'Ri', cargo: 'Ministra de Exteriores',
      pos: [
        'La ministra {montiel} recibe llamadas de felicitación de tres embajadas. "El mundo nos mira con otros ojos, {lider}."',
        '{montiel} sonríe en la cumbre regional. Por una vez nadie le pregunta por los derechos humanos.',
        'Un periódico extranjero publica: "Corea del Norte sorprende". {montiel} lo enmarca.'
      ],
      neg: [
        '{n_montiel} cuelga el teléfono, pálida. "Era el embajador. Dice que {medida} es un escándalo internacional. Hasta Pekín ha llamado."',
        'La prensa extranjera se burla de {medida}. En un programa de humor americano ya te imitan.',
        '{montiel} cancela su viaje a la cumbre. "No quiero que me tiren tomates, {lider}."'
      ],
      bajo: [
        'Varios embajadores han "llamado a consultas" a sus diplomáticos. {montiel} teme que la próxima llamada sea un ultimátum.',
        '{montiel} te enseña un mapa con barcos de guerra. No son los tuyos.'
      ]
    },
    ventura: {
      nombre: 'Dr. Yun Jae-hyon', corto: 'Yun', cargo: 'Ministro de Salud Pública',
      pos: [
        '{n_ventura} se quita las gafas y respira hondo. "Esto va a salvar vidas, {lider}. Gracias."',
        '{ventura} visita el Hospital Central y por primera vez nadie le grita en el pasillo.'
      ],
      neg: [
        '{n_ventura} lee el decreto dos veces. "¿Sabe cuánta gente va a enfermar con {medida}?" No espera respuesta.',
        '{ventura} firma su parte de {medida} con la mano temblando. Luego va al baño a vomitar.',
        '"Voy a necesitar más camas," dice {ventura}. "Y más ataúdes."'
      ],
      bajo: [
        'Los hospitales atienden en los pasillos. {ventura} ha dejado de dormir y ha empezado a beber.',
        '{ventura} presenta su dimisión. La rompes. Él la vuelve a escribir.'
      ]
    }
  };

  /*
   * GENTE DE A PIE: personajes recurrentes. Su "ánimo" (-100 a 100) cambia con tus decretos
   * y al cruzar ciertos límites su historia da un giro (hitos).
   */
  RF.CIUDADANOS = {
    carmen: {
      nombre: 'Abuela Sun-ja',
      presentacion: 'La abuela Sun-ja, 67 años, vende tortitas de maíz en el jangmadang, el mercado negro que todo el mundo usa y nadie nombra. Sobrevivió a la gran hambruna de los noventa y no tira ni una miga.',
      intereses: ['COMIDA', 'AGUA', 'AIRE', 'ENERGIA', 'VIVIENDA', 'TRABAJADORES', 'RELIGION', 'SALUD'],
      neg: [
        'La abuela Sun-ja se entera de {medida} por el altavoz del barrio mientras amasa. Se queda quieta un rato largo. Luego sigue amasando, [más fuerte|con rabia|sin tararear como siempre].',
        'Hoy la abuela Sun-ja vendió la mitad de tortitas que ayer. "{Medida}," dice un cliente, y los dos miran al suelo.',
        'La abuela Sun-ja esconde un saco de arroz bajo el suelo de la cocina. No pide nada para ella: todo es para su nieto Chol-su, que [llegó a casa furioso|no vino a dormir|rompió un cuenco al oír el altavoz].',
        'En la cola del mercado, la abuela Sun-ja escucha a las vecinas hablar de {medida}. Ella calla. Ha vivido tres líderes y sabe cuándo callar.',
        'La abuela Sun-ja tiene que elegir esta semana entre pagar el soborno al inspector del mercado o comprar harina. Culpa a {medida}. En silencio.'
      ],
      pos: [
        'La abuela Sun-ja sube el volumen de la radio (la única emisora que sintoniza) cuando anuncian {medida}. "Bueno, bueno," murmura. "Por fin algo."',
        'Hoy la abuela Sun-ja regaló una tortita de más al vigilante del barrio. "Día de fiesta," le dijo. Tu retrato sigue limpio en su pared, como manda la ley, pero hoy lo limpia con ganas.',
        'La abuela Sun-ja le dice a Chol-su que no todo lo que hace el Partido es malo. Chol-su pone los ojos en blanco, pero no la contradice.'
      ],
      neu: [
        'La abuela Sun-ja ni se entera de {medida}. Tiene cosas más importantes: el precio del maíz y la tos de su vecina.',
        'La abuela Sun-ja oye lo de {medida} y se encoge de hombros. "Los de arriba siempre están inventando."'
      ],
      hitos: [
        { id: 'carmen_cierra', bajo: -40, texto: 'La abuela Sun-ja ha cerrado su puesto del mercado después de veinte años. En la lona ha dejado escrito con carbón: "Gracias al Líder Supremo".', efectos: { pueblo: -3 } },
        { id: 'carmen_fan', alto: 40, texto: 'La abuela Sun-ja ha puesto flores frescas bajo tu retrato. Dice a sus clientas que eres "un buen muchacho, aunque un poco raro".', efectos: { pueblo: 2 } }
      ],
      finales: {
        bien: 'La abuela Sun-ja siguió vendiendo tortitas hasta los noventa años. Nunca te nombró en voz alta, pero guardó tu foto.',
        mal: 'La abuela Sun-ja le contó a todo el que quisiera oírla lo que hiciste. Los niños del barrio aprendieron tu nombre como se aprende una palabrota.',
        neutro: 'La abuela Sun-ja siguió en su esquina del mercado. Los líderes iban y venían. Las tortitas siempre salían igual de buenas.'
      }
    },
    nico: {
      nombre: 'Chol-su',
      presentacion: 'Chol-su, 19 años, nieto de la abuela Sun-ja, estudia en la Universidad Kim Chaek y escucha K-pop del Sur a escondidas en una memoria USB que cabe en una costura del pantalón.',
      intereses: ['EDUCACION', 'INTERNET', 'PRENSA', 'DIVERSION', 'OPOSICION', 'VICIOS', 'MASCOTAS', 'LIDER', 'POLICIA'],
      neg: [
        'Chol-su copia {medida} en una hoja y la pasa en clase con un dibujo burlón. Antes del recreo, alguien del Ministerio de Seguridad del Estado ya tiene una fotocopia.',
        'Chol-su y sus amigos escriben una pintada contra {medida} en un muro de la universidad. [Uno se va antes de que llegue la patrulla|Nadie firma con su nombre real|La tapan con un cartel del Partido antes del amanecer].',
        'Chol-su discute con su abuela en la cena. "¡{Medida} es una locura!" La abuela Sun-ja le tapa la boca. Las paredes son finas y el vecino es jefe de la unidad popular.',
        'Chol-su escribe en su diario, en clave: "Hoy decretaron {medida}. Algún día alguien va a contar esta historia."'
      ],
      pos: [
        'Chol-su lee lo de {medida} dos veces, buscando la trampa. No la encuentra. Se lo cuenta a un amigo en susurros: "¿Esto es real?"',
        'Chol-su admite, casi a su pesar: "Vale, {medida} no está mal." Sus amigos lo miran raro. Alguno asiente.',
        'Por primera vez, Chol-su no se burla de ti en la cena. Su abuela lo nota y sonríe.'
      ],
      neu: [
        'Chol-su oye lo de {medida} por el altavoz entre dos canciones prohibidas y sigue escuchando la USB.',
        'A Chol-su le da igual {medida}. Esta semana tiene exámenes de ideología Juche.'
      ],
      hitos: [
        { id: 'nico_resistencia', bajo: -40, texto: 'Chol-su no ha vuelto a la universidad. Su abuela dice que "se fue al campo". Los informes de {sombra} dicen que cruzó el río Tumen hacia China.', efectos: { orden: -4 } },
        { id: 'nico_juventudes', alto: 40, texto: 'Chol-su se ha unido a la Liga de la Juventud Socialista y lleva la insignia con orgullo. Su abuela no sabe si alegrarse o preocuparse.', efectos: { pueblo: 2, orden: 2 } }
      ],
      finales: {
        bien: 'Chol-su llegó a trabajar en la agencia oficial de noticias y escribió tu biografía. Era sorprendentemente amable. Casi nadie la creyó.',
        mal: 'Años después, Chol-su escribió desde Seúl un libro sobre tu gobierno. Se tituló "La consola del miedo". Fue un éxito mundial.',
        neutro: 'Chol-su acabó trabajando en una fábrica de Hamhung. De vez en cuando le pregunta a su abuela, en voz muy baja, si "el loco ese" sigue ahí.'
      }
    },
    ramiro: {
      nombre: 'Kwang-ho',
      presentacion: 'Kwang-ho, 45 años, taxista de Pionyang: uno de los pocos que tiene coche. Escucha la radio oficial doce horas al día y tiene opinión sobre todo, aunque solo la dice dentro del taxi.',
      intereses: ['TRANSPORTE', 'ENERGIA', 'CRIMEN', 'POLICIA', 'ARMAS', 'EXTRANJEROS', 'VICIOS', 'EMPRESAS', 'EJERCITO', 'DIVERSION'],
      neg: [
        'Kwang-ho apaga la radio de golpe. "{Medida}," le dice al pasajero. "Así estamos." El pasajero, por si acaso, no contesta.',
        'En la parada de taxis, Kwang-ho y los demás no hablan de otra cosa que {medida}. En voz baja. Alguien propone "trabajar despacio". Nadie dice que no.',
        'Kwang-ho echa cuentas en el reverso de un folleto del Partido. Con {medida}, este mes no llega. Su hija tendrá que dejar las clases de acordeón.',
        'Kwang-ho ya no pone solo la emisora oficial. De madrugada sintoniza una radio del Sur que habla muy mal de {medida}.'
      ],
      pos: [
        'Kwang-ho se lo cuenta a todos los pasajeros: "¿Oyó lo de {medida}? ¡Eso es tener carácter!"',
        'Kwang-ho pega una pegatina con tu cara en el salpicadero, junto a las de tu padre y tu abuelo. Algunos pasajeros se inclinan al subir.',
        'Por primera vez en meses, Kwang-ho silba mientras conduce. {Medida} le ha alegrado la semana.'
      ],
      neu: [
        'Kwang-ho comenta {medida} con un pasajero y acaban hablando de fútbol.',
        '"¿{Medida}? Mientras no toquen la gasolina del mercado negro, que hagan lo que quieran," dice Kwang-ho.'
      ],
      hitos: [
        { id: 'ramiro_huelga', bajo: -40, texto: 'Kwang-ho y otros taxistas dejan los coches aparcados "por avería" el mismo día. Pionyang amanece sin taxis. Nadie lo llama huelga; todo el mundo sabe lo que es.', efectos: { tesoro: -5, orden: -4 } },
        { id: 'ramiro_fan', alto: 40, texto: 'Kwang-ho ha fundado el "Grupo de Estudio de los Taxistas sobre las Enseñanzas del Líder Supremo". Tiene doce miembros y se reúne los miércoles.', efectos: { pueblo: 2 } }
      ],
      finales: {
        bien: 'Kwang-ho contó hasta el final de sus días que una vez llevó al Líder Supremo en su taxi. Era mentira, pero lo contaba muy bien.',
        mal: 'Kwang-ho fue de los primeros en salir a la plaza Kim Il-sung cuando todo acabó. Llevaba una bandera y el claxon pegado.',
        neutro: 'Kwang-ho sigue conduciendo. "Políticos," dice, y sube el volumen del fútbol.'
      }
    },
    lucia: {
      nombre: 'Eun-hee',
      presentacion: 'Eun-hee, 34 años, enfermera del Hospital Central de Pionyang. Hace turnos dobles, esteriliza las jeringas en una olla y tiene dos hijos pequeños.',
      intereses: ['SALUD', 'AIRE', 'AGUA', 'EDUCACION', 'TRABAJADORES', 'COMIDA', 'VIVIENDA', 'MASCOTAS'],
      neg: [
        'Eun-hee termina un turno de dieciséis horas y se entera de {medida} por el altavoz del autobús. Llora un poco, en silencio, contra la ventana.',
        'En el Hospital Central, Eun-hee ve llegar a los primeros afectados por {medida}. Anota sus nombres en una libreta que esconde en el forro del abrigo.',
        'Eun-hee piensa en su prima, que cruzó a China hace años. Por la noche, cuando sus hijos duermen, mira el mapa del río.',
        'Una paciente anciana le pregunta a Eun-hee qué significa {medida}. Eun-hee le arregla la almohada y no contesta.'
      ],
      pos: [
        'En el Hospital Central, las enfermeras hablan de {medida} en la sala de descanso. Eun-hee se permite una sonrisa cansada.',
        'Eun-hee le explica a su hija pequeña que {medida} es algo bueno. La niña dibuja un sol sobre el Palacio del Sol de Kumsusan.',
        'Esta semana Eun-hee ha podido dormir seis horas seguidas. No sabe si es por {medida}, pero lo agradece.'
      ],
      neu: [
        'Eun-hee no tiene tiempo para {medida}. Tiene cuarenta pacientes y una sola máquina de oxígeno, y hoy hay apagón.',
        'Eun-hee oye lo de {medida} y sigue cambiando vendas. "Ya veremos," piensa.'
      ],
      hitos: [
        { id: 'lucia_emigra', bajo: -40, texto: 'Eun-hee ha desaparecido con sus hijos. En el Hospital Central nadie pregunta. Dicen que alguien vio a una mujer con dos niños cerca del río Yalu.', efectos: { salud: -5 } },
        { id: 'lucia_premio', alto: 40, texto: 'Eun-hee ha recibido la medalla de Heroína del Trabajo. En la foto oficial sale incómoda, pero orgullosa.', efectos: { salud: 2, pueblo: 1 } }
      ],
      finales: {
        bien: 'Eun-hee llegó a ser directora del Hospital Central. En su despacho hay un retrato tuyo, algo torcido.',
        mal: 'Eun-hee declaró como testigo en el juicio contra tu gobierno. Leyó en voz alta los nombres de su libreta. Tardó tres horas.',
        neutro: 'Eun-hee siguió haciendo turnos dobles, con o sin ti. Los hospitales no cierran por cambios de líder.'
      }
    }
  };
})(globalThis.RF = globalThis.RF || {});
