/*
 * PERSONAJES
 * El gabinete (la cúpula) y la gente de a pie que vive tus decretos.
 * Plantillas: [a|b|c] elige una opción al azar; {medida}, {objeto}, {Medida} se rellenan solos.
 */
(function (RF) {
  'use strict';

  RF.PAIS = {
    nombre: 'República de Valdoria',
    capital: 'Puerto Esperanza',
    moneda: 'valdos',
    dias: 30
  };

  // Cada ministro vigila una estadística y reacciona cuando cambia.
  RF.GABINETE = {
    garrote: {
      nombre: 'General Bruno Garrote', corto: 'Garrote', cargo: 'Ministro de Defensa', stats: ['ejercito'],
      pos: [
        'El General Garrote golpea la mesa con el puño. "[Por fin|Al fin|Ya era hora], {lider}. Así se gobierna." Esa noche los cuarteles brindan en su nombre.',
        'Garrote se ajusta las medallas. "El ejército aprueba {medida}." No sonríe, pero tampoco hace falta.',
        'En el cuartel central, los oficiales comentan {medida} con aprobación. Garrote manda una caja de puros a Palacio.'
      ],
      neg: [
        'El General Garrote escucha el anuncio sin parpadear. Después pide su coche y no vuelve a Palacio en todo el día.',
        '"Con todo respeto, {lider}," dice Garrote, "{medida} no le gusta a mis muchachos." Lo de "con todo respeto" suena a amenaza.',
        'Garrote convoca a los coroneles a una reunión "de rutina". Nadie en Palacio sabe de qué hablaron.'
      ],
      bajo: [
        'Se ven luces encendidas de madrugada en el Estado Mayor. Garrote ya no contesta sus llamadas a la primera.',
        'Un coronel joven le susurra a tu secretaria: "Cuide a Su Excelencia. Hay gente contando tanques."'
      ]
    },
    cifuentes: {
      nombre: 'Leonor Cifuentes', corto: 'Cifuentes', cargo: 'Ministra de Hacienda', stats: ['tesoro', 'cupula'],
      pos: [
        'Leonor Cifuentes repasa las cuentas y sonríe con los labios, no con los ojos. "Las familias importantes están contentas, {lider}."',
        'Cifuentes brinda con champán importado en el Club Náutico. Los empresarios la llaman "la ministra razonable".',
        '"Excelente decisión," dice Cifuentes mientras anota algo en una libreta que nunca deja ver a nadie.'
      ],
      neg: [
        'Cifuentes cierra la carpeta de golpe. "¿Sabe cuánto nos cuesta {medida}? No, claro que no lo sabe."',
        'Esa noche, Leonor Cifuentes cena con tres banqueros. En la mesa de al lado, un periodista extranjero toma notas.',
        'La ministra Cifuentes pide ver los libros contables "por si acaso". Nadie sabe qué significa ese "por si acaso".'
      ],
      bajo: [
        'Cifuentes ha abierto una cuenta en un banco suizo. Tus espías lo saben. Ella sabe que tú lo sabes.',
        'En el Club Náutico ya no se brinda por ti. Se brinda por "lo que venga después".'
      ]
    },
    sombra: {
      nombre: 'Octavio Sombra', corto: 'Sombra', cargo: 'Ministro del Interior', stats: ['orden'],
      pos: [
        'Octavio Sombra deja una carpeta sobre tu escritorio: calles tranquilas, archivos llenos. "Todo bajo control, {lider}."',
        'Sombra asiente despacio. "La gente obedece mejor cuando sabe que la estamos mirando."',
        'En el sótano del Ministerio del Interior, las máquinas de escribir no paran. Sombra está de buen humor.'
      ],
      neg: [
        'Sombra frunce el ceño. "Con {medida} las calles se van a calentar. Mis hombres no son suficientes."',
        '"Voy a necesitar más agentes," dice Sombra. "Y más celdas. Y más paciencia, {lider}."',
        'Octavio Sombra enciende un cigarro en la ventana y mira la plaza. "Esto va a traer problemas."'
      ],
      bajo: [
        'Sombra ya no te cuenta todo. Sus informes llegan tarde y con páginas arrancadas.',
        'Hay pintadas contra ti en la pared del propio Ministerio del Interior. Nadie vio nada.'
      ]
    },
    paredes: {
      nombre: 'Rolando "Rolo" Paredes', corto: 'Rolo', cargo: 'Jefe de Propaganda', stats: ['pueblo'],
      pos: [
        'Rolo Paredes ya tiene el eslogan: "¡{Medida}, la Patria lo agradece!" Los carteles se imprimen esa misma noche.',
        'En la televisión estatal, Rolo presenta {medida} con música épica y niños sonriendo. Esta vez la gente sonríe de verdad.',
        '"Esto se vende solo, {lider}," dice Rolo. Por primera vez en semanas no tiene que inventar nada.'
      ],
      neg: [
        'Rolo Paredes suda. "Puedo venderlo, {lider}. Todo se puede vender. Pero {medida} me lo pone difícil."',
        'La televisión estatal dedica tres horas a un documental sobre patos para no hablar de {medida}.',
        'Rolo manda imprimir carteles que dicen "Sacrificio es Patriotismo". Alguien les pinta bigotes antes del amanecer.'
      ],
      bajo: [
        'Ya ni la televisión estatal logra tapar los abucheos. Rolo ha empezado a hablar de ti en pasado.',
        'Rolo Paredes pide vacaciones "por salud". Tiene el pasaporte en el bolsillo.'
      ]
    },
    montiel: {
      nombre: 'Isabela Montiel', corto: 'Montiel', cargo: 'Canciller', stats: ['mundo'],
      pos: [
        'La canciller Montiel recibe llamadas de felicitación de tres embajadas. "El mundo nos mira con otros ojos, {lider}."',
        'Montiel sonríe en la cumbre regional. Por una vez nadie le pregunta por los derechos humanos.',
        'Un periódico extranjero publica: "Valdoria sorprende". Montiel lo enmarca.'
      ],
      neg: [
        'Isabela Montiel cuelga el teléfono, pálida. "Era el embajador. Dice que {medida} es un escándalo internacional."',
        'La prensa extranjera se burla de {medida}. En un programa de humor americano ya te imitan.',
        'Montiel cancela su viaje a la cumbre. "No quiero que me tiren tomates, {lider}."'
      ],
      bajo: [
        'Varios embajadores han "llamado a consultas" a sus diplomáticos. Montiel teme que la próxima llamada sea un ultimátum.',
        'Montiel te enseña un mapa con barcos de guerra. No son los tuyos.'
      ]
    },
    ventura: {
      nombre: 'Dr. Aurelio Ventura', corto: 'Ventura', cargo: 'Ministro de Salud', stats: ['salud'],
      pos: [
        'El Dr. Ventura se quita las gafas y respira hondo. "Esto va a salvar vidas, {lider}. Gracias."',
        'Ventura visita el Hospital Central y por primera vez nadie le grita en el pasillo.'
      ],
      neg: [
        'El Dr. Ventura lee el decreto dos veces. "¿Sabe cuánta gente va a enfermar con {medida}?" No espera respuesta.',
        'Ventura firma su parte de {medida} con la mano temblando. Luego va al baño a vomitar.',
        '"Voy a necesitar más camas," dice Ventura. "Y más ataúdes."'
      ],
      bajo: [
        'Los hospitales atienden en los pasillos. Ventura ha dejado de dormir y ha empezado a beber.',
        'Ventura presenta su dimisión. La rompes. Él la vuelve a escribir.'
      ]
    }
  };

  /*
   * GENTE DE A PIE: personajes recurrentes. Su "ánimo" (-100 a 100) cambia con tus decretos
   * y al cruzar ciertos límites su historia da un giro (hitos).
   */
  RF.CIUDADANOS = {
    carmen: {
      nombre: 'Doña Carmen',
      presentacion: 'Doña Carmen, 67 años, vende arepas en una esquina del barrio La Esperanza desde hace cuarenta años.',
      intereses: ['COMIDA', 'AGUA', 'AIRE', 'ENERGIA', 'VIVIENDA', 'TRABAJADORES', 'RELIGION', 'SALUD'],
      neg: [
        'Doña Carmen se entera de {medida} por la radio mientras amasa. Se queda quieta un rato largo. Luego sigue amasando, [más fuerte|con rabia|sin cantar como siempre].',
        'Hoy Doña Carmen vendió la mitad de arepas que ayer. "{Medida}," dice un cliente, y los dos miran al suelo.',
        'Doña Carmen enciende una vela en la iglesia. No pide por ella: pide por su nieto Nico, que [llegó a casa furioso|no vino a dormir|rompió un plato al oír las noticias].',
        'En la cola del mercado, Doña Carmen escucha a las vecinas hablar de {medida}. Ella calla. Ha vivido tres dictaduras y sabe cuándo callar.',
        'Doña Carmen tiene que elegir esta semana entre pagar la luz o comprar harina. Culpa a {medida}. Y a ti.'
      ],
      pos: [
        'Doña Carmen sube el volumen de la radio cuando anuncian {medida}. "Bueno, bueno," murmura. "Por fin algo."',
        'Hoy Doña Carmen regaló una arepa de más al cartero. "Día de fiesta," le dijo. Tu retrato sigue colgado en su puesto.',
        'Doña Carmen le dice a Nico que no todo lo que hace el gobierno es malo. Nico pone los ojos en blanco, pero no la contradice.'
      ],
      neu: [
        'Doña Carmen ni se entera de {medida}. Tiene cosas más importantes: el precio del maíz y la tos de su vecina.',
        'Doña Carmen oye lo de {medida} y se encoge de hombros. "Los de arriba siempre están inventando."'
      ],
      hitos: [
        { id: 'carmen_cierra', bajo: -40, texto: 'Doña Carmen ha cerrado su puesto de arepas después de cuarenta años. En la persiana ha escrito con tiza: "Gracias a Su Excelencia".', efectos: { pueblo: -3 } },
        { id: 'carmen_fan', alto: 40, texto: 'Doña Carmen ha colgado una foto tuya junto a la Virgen. Dice a sus clientas que eres "un buen muchacho, aunque un poco raro".', efectos: { pueblo: 2 } }
      ],
      finales: {
        bien: 'Doña Carmen siguió vendiendo arepas hasta los noventa años. Nunca te nombró en voz alta, pero guardó tu foto.',
        mal: 'Doña Carmen le contó a todo el que quisiera oírla lo que hiciste. Los niños del barrio aprendieron tu nombre como se aprende una palabrota.',
        neutro: 'Doña Carmen siguió en su esquina. Gobiernos iban y venían. Las arepas siempre salían igual de buenas.'
      }
    },
    nico: {
      nombre: 'Nico',
      presentacion: 'Nico, 19 años, nieto de Doña Carmen, estudia periodismo y pasa el día pegado al celular.',
      intereses: ['EDUCACION', 'INTERNET', 'PRENSA', 'DIVERSION', 'OPOSICION', 'VICIOS', 'MASCOTAS', 'LIDER', 'POLICIA'],
      neg: [
        'Nico publica un meme sobre {medida}. En una hora lo comparten diez mil personas. En dos horas, alguien del Ministerio del Interior lo guarda en una carpeta.',
        'En la universidad, Nico y sus amigos pintan una pancarta contra {medida}. [Uno se va antes de que llegue la policía|Nadie firma con su nombre real|La esconden en el techo de la cafetería].',
        'Nico discute con su abuela en la cena. "¡{Medida} es una locura!" Doña Carmen le pide que baje la voz. Las paredes son finas.',
        'Nico escribe en su diario: "Hoy decretaron {medida}. Algún día alguien va a contar esta historia."'
      ],
      pos: [
        'Nico lee lo de {medida} dos veces, buscando la trampa. No la encuentra. Le escribe a un amigo: "¿Esto es real?"',
        'Nico publica, casi a su pesar: "Ok, {medida} no está mal." Le llueven insultos de sus amigos. Y algunos "me gusta".',
        'Por primera vez, Nico no se burla de ti en la cena. Su abuela lo nota y sonríe.'
      ],
      neu: [
        'Nico ve la noticia de {medida} entre dos videos de gatos y sigue deslizando.',
        'A Nico le da igual {medida}. Esta semana tiene exámenes.'
      ],
      hitos: [
        { id: 'nico_resistencia', bajo: -40, texto: 'Nico ha dejado la universidad. Su abuela dice que "se fue al campo". Los informes de Sombra dicen que se unió a la resistencia.', efectos: { orden: -4 } },
        { id: 'nico_juventudes', alto: 40, texto: 'Nico se ha unido a las Juventudes Patrióticas. Su abuela no sabe si alegrarse o preocuparse.', efectos: { pueblo: 2, orden: 2 } }
      ],
      finales: {
        bien: 'Nico se hizo periodista y escribió tu biografía. Era sorprendentemente amable. Casi nadie la creyó.',
        mal: 'Años después, Nico escribió un libro sobre tu gobierno. Se tituló "La consola del miedo". Fue un éxito mundial.',
        neutro: 'Nico se fue a estudiar al extranjero y nunca volvió. De vez en cuando le pregunta a su abuela si "el loco ese" sigue ahí.'
      }
    },
    ramiro: {
      nombre: 'Ramiro',
      presentacion: 'Ramiro, 45 años, taxista. Escucha la radio doce horas al día y tiene opinión sobre todo.',
      intereses: ['TRANSPORTE', 'ENERGIA', 'CRIMEN', 'POLICIA', 'ARMAS', 'EXTRANJEROS', 'VICIOS', 'EMPRESAS', 'EJERCITO', 'DIVERSION'],
      neg: [
        'Ramiro apaga la radio de golpe. "{Medida}," le dice al pasajero. "Así estamos." El pasajero, por si acaso, no contesta.',
        'En la parada de taxis, Ramiro y los demás no hablan de otra cosa que {medida}. Alguien propone una huelga. Nadie dice que no.',
        'Ramiro echa cuentas en una servilleta. Con {medida}, este mes no llega. Su hija tendrá que dejar las clases de piano.',
        'Ramiro ya no pone la emisora oficial. Ahora escucha una radio pirata que habla muy mal de {medida}.'
      ],
      pos: [
        'Ramiro se lo cuenta a todos los pasajeros: "¿Oyó lo de {medida}? ¡Eso es tener pantalones!"',
        'Ramiro pega una pegatina con tu cara en el taxi. Algunos pasajeros se bajan. Él no se arrepiente.',
        'Por primera vez en meses, Ramiro silba mientras conduce. {Medida} le ha alegrado la semana.'
      ],
      neu: [
        'Ramiro comenta {medida} con un pasajero y acaban hablando de fútbol.',
        '"¿{Medida}? Mientras no toquen la gasolina, que hagan lo que quieran," dice Ramiro.'
      ],
      hitos: [
        { id: 'ramiro_huelga', bajo: -40, texto: 'Ramiro encabeza una huelga de taxistas. Puerto Esperanza amanece colapsada. Su cara sale en la radio pirata.', efectos: { tesoro: -5, orden: -4 } },
        { id: 'ramiro_fan', alto: 40, texto: 'Ramiro ha fundado el "Club de Taxistas por Su Excelencia". Tiene doce miembros y un grupo de WhatsApp muy activo.', efectos: { pueblo: 2 } }
      ],
      finales: {
        bien: 'Ramiro contó hasta el final de sus días que una vez llevó a Su Excelencia en su taxi. Era mentira, pero lo contaba muy bien.',
        mal: 'Ramiro fue de los primeros en salir a la plaza cuando todo acabó. Llevaba una bandera y el claxon pegado.',
        neutro: 'Ramiro sigue conduciendo. "Políticos," dice, y sube el volumen del fútbol.'
      }
    },
    lucia: {
      nombre: 'Lucía',
      presentacion: 'Lucía, 34 años, enfermera del Hospital Central. Hace turnos dobles y tiene dos hijos pequeños.',
      intereses: ['SALUD', 'AIRE', 'AGUA', 'EDUCACION', 'TRABAJADORES', 'COMIDA', 'VIVIENDA', 'MASCOTAS'],
      neg: [
        'Lucía termina un turno de dieciséis horas y se entera de {medida} en el autobús. Llora un poco, en silencio, contra la ventana.',
        'En el Hospital Central, Lucía ve llegar a los primeros afectados por {medida}. Anota sus nombres en una libreta. Por si algún día alguien los pregunta.',
        'Lucía mira ofertas de trabajo en el extranjero. Por la noche, cuando sus hijos duermen, rellena un formulario.',
        'Una paciente anciana le pregunta a Lucía qué significa {medida}. Lucía le arregla la almohada y no contesta.'
      ],
      pos: [
        'En el Hospital Central, las enfermeras hablan de {medida} en la sala de descanso. Lucía se permite una sonrisa cansada.',
        'Lucía le explica a su hija pequeña que {medida} es algo bueno. La niña dibuja un sol sobre el Palacio.',
        'Esta semana Lucía ha podido dormir seis horas seguidas. No sabe si es por {medida}, pero lo agradece.'
      ],
      neu: [
        'Lucía no tiene tiempo para {medida}. Tiene cuarenta pacientes y una sola máquina de oxígeno.',
        'Lucía oye lo de {medida} y sigue cambiando vendas. "Ya veremos," piensa.'
      ],
      hitos: [
        { id: 'lucia_emigra', bajo: -40, texto: 'Lucía ha emigrado con sus hijos. En el Hospital Central la despidieron con una tarta. Hay otras doce enfermeras con la maleta hecha.', efectos: { salud: -5 } },
        { id: 'lucia_premio', alto: 40, texto: 'Lucía ha recibido una medalla al mérito sanitario. En la foto oficial sale incómoda, pero orgullosa.', efectos: { salud: 2, pueblo: 1 } }
      ],
      finales: {
        bien: 'Lucía llegó a ser directora del Hospital Central. En su despacho hay una placa con tu nombre, algo torcida.',
        mal: 'Lucía declaró como testigo en el juicio contra tu gobierno. Leyó en voz alta los nombres de su libreta. Tardó tres horas.',
        neutro: 'Lucía siguió haciendo turnos dobles, con o sin ti. Los hospitales no cierran por cambios de gobierno.'
      }
    }
  };
})(globalThis.RF = globalThis.RF || {});
