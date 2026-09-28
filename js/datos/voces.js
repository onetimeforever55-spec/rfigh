/*
 * VOCES: todo lo que hace que la historia suene viva.
 *  PRENSA     titulares del periódico oficial, la prensa extranjera y la radio pirata
 *  VOCES      gente anónima de la calle opinando
 *  AMBIENTE   cómo amanece el país según cómo va
 *  ABSURDO    reacciones a decretos sobre cosas raras ("prohibir los calcetines")
 *  ECOS       recuerdos de decretos anteriores
 * Cada decreto se clasifica en un "tipo" (ver narrador.js): esencial, libertad, represion, regalo,
 * impuesto, culto, absurdo, economia, obra, general.
 * Variables: {Medida} {medida} {objeto} {Objeto} {lider} {pais} {capital} {anterior}
 */
(function (RF) {
  'use strict';

  RF.PRENSA = {
    oficial: {
      nombre: 'El Patriota',
      esencial: ['«{Medida}: una reforma valiente que el pueblo sabrá agradecer»', '«Expertos confirman: {objeto} funcionará mejor que nunca»', '«Su Excelencia moderniza {objeto} con visión de futuro»'],
      libertad: ['«{Medida}: orden y paz para las familias valdorianas»', '«El pueblo respira tranquilo tras {medida}»', '«Por fin: {medida}. Las madres lo agradecen»'],
      represion: ['«Mano firme contra quienes amenazan la patria»', '«{Medida}: la seguridad es lo primero»', '«Ciudadanos de bien celebran {medida}»'],
      regalo: ['«¡Gracias, Excelencia! {Medida} llena de alegría los hogares»', '«{Medida}: el líder que cuida de su pueblo»', '«Lágrimas de felicidad en los barrios tras {medida}»'],
      impuesto: ['«{Medida}: todos aportan a la grandeza nacional»', '«Contribuir es amar a la patria»', '«Nuevo impuesto patriótico recibido con entusiasmo»'],
      culto: ['«La nación entera celebra {medida}»', '«{Medida}: un homenaje merecido»', '«Los niños ya cantan la nueva canción del homenaje»'],
      absurdo: ['«{Medida}: una idea adelantada a su tiempo»', '«Otros países ya estudian copiar {medida}»', '«Científicos aplauden {medida}, aunque no saben por qué»'],
      economia: ['«{Medida} traerá prosperidad, afirma el gobierno»', '«Los mercados celebran {medida}»', '«{Medida}: Valdoria entra en el siglo XXI»'],
      obra: ['«{Medida}: la patria construye su futuro»', '«Primera piedra de una nueva era»', '«{Medida}: obra histórica del líder»'],
      secreto: ['«Trágico suceso: {Objeto} nos deja»', '«El Gobierno lamenta profundamente lo ocurrido y pide respeto para las familias»', '«Las autoridades descartan cualquier indicio de delito»'],
      general: ['«Su Excelencia decreta y el país avanza»', '«{Medida}: otro acierto del gobierno»', '«Un decreto histórico: {medida}»']
    },
    extranjera: {
      nombre: 'The Global Tribune',
      esencial: ['"Valdoria: el dictador que puso precio a {objeto}"', '"Alarma humanitaria en Valdoria tras {medida}"', '"Las ONG denuncian {medida}"'],
      libertad: ['"Valdoria se cierra al mundo: {medida}"', '"Otro paso hacia el autoritarismo en Valdoria"', '"La comunidad internacional condena {medida}"'],
      represion: ['"Represión en Valdoria: {medida}"', '"Amnistía Internacional pide explicaciones a Valdoria"', '"Valdoria, cada día más parecido a una cárcel"'],
      regalo: ['"Populismo tropical: {medida}"', '"Economistas advierten del coste de {medida}"', '"Valdoria gasta lo que no tiene"'],
      impuesto: ['"Valdoria sube la presión fiscal"', '"Inversores preocupados por {medida}"', '"Fuga de capitales en Valdoria tras {medida}"'],
      culto: ['"El culto a la personalidad llega a un nuevo nivel en Valdoria"', '"Valdoria: {medida}. Sí, en serio"', '"El ego más grande del Caribe"'],
      absurdo: ['"Los decretos más extraños del año: Valdoria gana otra vez"', '"¿Qué está pasando en Valdoria? Ahora: {medida}"', '"Humor involuntario: {medida}"'],
      economia: ['"Valdoria cambia las reglas del juego: {medida}"', '"Los mercados reaccionan a {medida}"', '"Giro económico en Valdoria"'],
      obra: ['"Valdoria invierte: ¿propaganda o progreso?"', '"Obras en Valdoria: a ver cuánto dura"', '"Un raro acierto en Valdoria"'],
      secreto: ['"Extrañas circunstancias en Valdoria: ¿accidente o algo más?"', '"Organizaciones internacionales piden una investigación independiente en Valdoria"', '"Demasiadas casualidades en Valdoria"'],
      general: ['"Otro día, otro decreto en Valdoria"', '"Valdoria: {medida}"', '"El impredecible líder de Valdoria vuelve a sorprender"']
    },
    pirata: {
      nombre: 'Radio Libertad',
      esencial: ['"Hoy nos quitan {objeto}. Mañana, ¿qué? ¿El suelo que pisamos?"', '"Compañeros: {medida} no es un error, es un robo."', '"Si no puedes pagar {objeto}, ya sabes quién tiene la culpa."'],
      libertad: ['"Nos quieren callados. Esta radio no se calla."', '"{Medida}. Apunten la fecha: la vamos a recordar."', '"Nos prohíben {objeto}. Lo que no pueden prohibirnos es pensar."'],
      represion: ['"Hoy se llevaron a más vecinos. Decid sus nombres en voz alta."', '"{Medida}: primero vinieron por ellos. Después vendrán por nosotros."', '"El miedo es su única política."'],
      regalo: ['"Nos dan migajas para que no veamos el pastel."', '"{Medida}. Bien. Ahora, ¿quién paga la fiesta?"', '"Aceptamos el regalo. No aceptamos al que lo regala."'],
      impuesto: ['"Más impuestos y el Palacio sigue con champán."', '"Pagamos más para tener menos."', '"{Medida}: adivinen de qué bolsillo sale."'],
      culto: ['"El emperador está desnudo. Y ahora encima tiene estatua."', '"{Medida}. No sabemos si reír o llorar. Hoy reímos."', '"Mientras él se homenajea, los hospitales no tienen gasas."'],
      absurdo: ['"El loco del Palacio ataca de nuevo: {medida}."', '"Ni nosotros podríamos inventar esto: {medida}."', '"Última hora: el gobierno ha perdido la cabeza. Otra vez."'],
      economia: ['"Venden la patria a trozos. Hoy tocó {objeto}."', '"{Medida}: los de siempre se hacen más ricos."', '"Que alguien le explique al Palacio para qué sirve un país."'],
      obra: ['"Prometen obras. Ya veremos el cartel y la primera piedra, como siempre."', '"{Medida}: ojalá sea verdad. No nos lo creemos."', '"Mucha foto, poca obra."'],
      secreto: ['"¿Accidente? En este país nadie se cree ya los accidentes."', '"Si nos pasa algo, que conste: no fue un accidente."', '"Otro que molestaba. Otro que ya no está."'],
      general: ['"Otro decreto, otra excusa."', '"{Medida}. Seguimos resistiendo."', '"El Palacio decide, el pueblo sufre."']
    }
  };

  // Quién habla en la calle (se combina al azar).
  RF.VOCES_QUIEN = [
    'una vendedora del mercado', 'un jubilado en la cola del banco', 'una estudiante en el metro', 'un albañil en su descanso',
    'una maestra de primaria', 'un camarero del centro', 'una madre a la salida del colegio', 'un pescador del puerto',
    'un policía fuera de servicio', 'una abuela en la parada del autobús', 'un chico repartiendo pizzas', 'una peluquera de La Esperanza',
    'un cura de barrio', 'un vendedor de lotería', 'una médica de guardia', 'un campesino llegado a la capital'
  ];

  RF.VOCES = {
    neg: {
      esencial: ['"¿Y ahora cómo vivimos? ¿Del aire? Ah, no, que ese también lo cobran."', '"Mi madre me decía que los pobres siempre pagamos. No sabía cuánta razón tenía."', '"Con {medida} no llegamos a fin de mes. Ni a mitad."'],
      libertad: ['"Yo no me meto en política. Pero ahora la política se mete conmigo."', '"Mejor no digo nada. Nunca se sabe quién escucha."', '"Lo de {objeto} era lo único que nos quedaba."'],
      represion: ['"A mi vecino se lo llevaron de noche. Nadie sabe dónde está."', '"Ahora hay que tener cuidado hasta con lo que uno piensa."', '"Dicen que es contra los malos. Siempre dicen eso."'],
      impuesto: ['"¿Más impuestos? ¿Y qué me dan a cambio? ¿Otro discurso?"', '"Ya no me queda nada que me puedan cobrar."', '"El sueldo baja y los impuestos suben. Magia valdoriana."'],
      culto: ['"Con lo que cuesta eso se arreglaba el hospital."', '"Mis hijos preguntan quién es ese señor de las estatuas. No sé qué decirles."', '"Otro homenaje. Qué bonito. Qué hambre."'],
      absurdo: ['"¿{Medida}? ¿En serio? ¿Eso es lo que nos preocupaba?"', '"Ya no sé si reír o emigrar."', '"Mi abuela vivió tres dictaduras y dice que esta es la más rara."'],
      general: ['"Cada día una cosa nueva, y cada cosa peor."', '"Aguantaremos. Siempre aguantamos."', '"No sé adónde vamos, pero no me gusta el camino."']
    },
    pos: {
      regalo: ['"¡Por fin algo para nosotros! Aunque sea una vez."', '"No voy a decir que lo quiero, pero hoy como mejor."', '"{Medida}. Mira, eso sí está bien."'],
      represion: ['"Ya era hora. Aquí no se podía salir de noche."', '"Mano dura, eso es lo que hacía falta."', '"Yo no tengo nada que esconder, así que me parece bien."'],
      obra: ['"Si de verdad lo construyen, voto por él. Si hubiera elecciones, claro."', '"Mi hijo podrá estudiar cerca de casa. No es poco."', '"Ojalá no sea solo el cartel."'],
      impuesto: ['"¿A los ricos? Ya les tocaba."', '"Que paguen los que tienen. Por una vez."', '"Me alegro. Que sientan lo que sentimos nosotros."'],
      general: ['"Mira, algo bueno. Me lo apunto en el calendario, por lo raro."', '"No soy de aplaudir al gobierno, pero esto está bien."', '"Por una vez, el Palacio acierta."']
    }
  };

  // Cómo amanece el país. Se elige por la estadística más baja (si es preocupante) o por el ánimo general.
  RF.AMBIENTE = {
    pueblo: ['Amanece con pintadas nuevas en las paredes del centro. Los barrenderos ya no se molestan en borrarlas.', 'En los mercados se habla bajito y se mira mucho al Palacio.', 'Las cacerolas de anoche aún resuenan en la cabeza de los vecinos.'],
    ejercito: ['Hay más movimiento del habitual en los cuarteles. Nadie da explicaciones.', 'Un tanque aparca frente al Palacio "por mantenimiento". Nadie se lo cree.', '{garrote} ha cancelado el desayuno semanal contigo. Por segunda vez.'],
    cupula: ['Los coches de lujo del Club Náutico salen de madrugada rumbo al aeropuerto.', 'En Palacio, los ministros se callan cuando entras en la sala.', 'Alguien ha cambiado la cerradura de tu despacho. Dicen que fue el conserje.'],
    tesoro: ['Los funcionarios hacen cola frente a Hacienda para cobrar. La cola no avanza.', 'El valdo amanece otra vez por los suelos. Las casas de cambio cierran antes de abrir.', 'En Palacio se ha cortado el aire acondicionado para ahorrar. Hace un calor insoportable.'],
    salud: ['En la puerta del Hospital Central, la fila empieza de madrugada.', 'Las farmacias cuelgan el cartel de "no hay". Otra vez.', 'Se oye toser en todas las colas del país.'],
    orden: ['Anoche ardieron dos contenedores y una patrulla de policía. Nadie vio nada.', 'Las tiendas del centro amanecen con rejas nuevas.', 'En los barrios del sur mandan otros, y todo el mundo lo sabe.'],
    mundo: ['Otra embajada anuncia que reduce su personal "por precaución".', 'Los vuelos internacionales llegan casi vacíos.', 'En el puerto, los barcos extranjeros pasan de largo.'],
    inflacion: ['Los precios de las pizarras de los mercados se borran y se reescriben antes del mediodía.', 'En la cola del pan, alguien paga con un fajo de billetes atado con una goma. Nadie se sorprende.', 'Las tiendas cierran a la hora de comer para cambiar las etiquetas.'],
    bien: ['Amanece soleado en Puerto Esperanza. Los vendedores cantan mientras montan sus puestos.', 'Hay niños jugando en la plaza y nadie los manda a casa.', 'Un día tranquilo. En Valdoria, eso ya es noticia.'],
    normal: ['Amanece en Puerto Esperanza. El país sigue, como siempre, esperando al siguiente decreto.', 'Otro día en Valdoria. El café está caro y los rumores, baratos.', 'Los periódicos del día llegan al Palacio. Nadie en la calle los lee.']
  };

  // Decretos sobre cosas que el bot no conoce.
  RF.ABSURDO = {
    gaceta: [
      'Los juristas del Estado pasan la noche buscando en el diccionario qué es exactamente «{objeto}».',
      'Es la primera ley de la historia de Valdoria que menciona «{objeto}». Los historiadores están emocionados.',
      'El texto oficial ocupa una sola línea. Los abogados ya discuten si incluye a «{objeto}» de color azul.',
      'La policía recibe instrucciones de «vigilar el asunto de {objeto}». Nadie sabe muy bien cómo.'
    ],
    calle: [
      'En la calle, la gente se mira sin saber si reír o preocuparse. Al final, se ríe. Por si acaso, en voz baja.',
      'Por la tarde ya hay memes, canciones y un baile sobre {medida}. Nico ha publicado cinco.',
      'En La Esperanza nadie sabía que {objeto} fuera un problema nacional. Ahora todos tienen opinión.',
      'Doña Carmen dice que en sus tiempos también hubo un presidente así. Duró poco.'
    ]
  };

  /*
   * LÓGICA ABSURDA: cuando el decreto trata de algo que el juego no conoce ("prohibir los lunes",
   * "obligar a caminar hacia atrás", "vender la luna"), el Estado lo cumple con toda seriedad.
   * Cada tipo de orden tiene su mecanismo burocrático y una consecuencia que llega más tarde
   * siguiendo esa misma lógica (quien hace la ley hace la trampa; quien la vigila, cobra).
   */
  RF.ABSURDO.logica = {
    prohibir: {
      gaceta: [
        'Se crea la Brigada Especial contra {objeto}: cuarenta agentes, dos coches y ningún protocolo. Su primer informe pide más presupuesto para entender qué están persiguiendo.',
        'El Código Penal gana un artículo nuevo, el 666 bis. Los jueces piden por escrito una definición de {objeto}. Se les responde que «se sabe cuando se ve».',
        'La policía instala controles en las entradas de la capital para detectar {objeto}. Nadie sabe qué buscar, así que se requisa todo lo sospechoso: paraguas, gallinas, un acordeón.'
      ],
      consecuencias: [
        { en: 2, titulo: 'El mercado negro de {objeto}', textos: ['En el puerto ya se vende {objeto} de contrabando, a precio de oro. Los agentes de la Brigada son los mejores clientes.', 'Un bar clandestino de La Esperanza ofrece {objeto} en la trastienda. Hay cola. Hay contraseña. La contraseña es tu nombre.'], efectos: { estabilidad: -2, dinero: -3 } },
        { en: 3, titulo: 'El resquicio legal', textos: ['Un abogado descubre que el decreto no dice nada de {objeto} «en diminutivo». Media ciudad se acoge a la excepción.', 'Los tribunales se llenan de recursos: ¿es delito {objeto} sin querer? ¿Y en sueños? El Supremo lleva tres días deliberando.'], efectos: { estabilidad: -2, felicidad: 2 } }
      ]
    },
    obligar: {
      gaceta: [
        'Se crea la Inspección Nacional de {objeto}. Todo ciudadano deberá llevar encima el certificado de cumplimiento, sellado y con foto.',
        'Los funcionarios reciben un cursillo de dos horas sobre {objeto}. Suspenden todos. El examen se repite hasta que aprueban todos.',
        'A partir de hoy, cada ventanilla del Estado exige demostrar {objeto} antes de atender. Las colas dan la vuelta a la manzana.'
      ],
      consecuencias: [
        { en: 2, titulo: 'Certificados falsos', textos: ['En el mercado venden certificados falsos de {objeto} por cinco valdos. Los auténticos cuestan veinte y tardan un mes.', 'Un primo de {cifuentes} monta una academia de {objeto} con título oficial. Tiene cuatro mil alumnos y ningún profesor.'], efectos: { dinero: -3, felicidad: -1 } },
        { en: 3, titulo: 'Los primeros multados', textos: ['La primera multa por no cumplir con {objeto} se la ponen a una monja. La foto da la vuelta al mundo.', 'Un pueblo entero del interior se declara «incapaz» de cumplir con {objeto}. {sombra} manda a un inspector. El inspector no vuelve.'], efectos: { estabilidad: -2, felicidad: -2 } }
      ]
    },
    crear: {
      gaceta: [
        'Nace el Instituto Nacional de {objeto}, con director, vicedirector, coche oficial y un logo que costó más que el edificio.',
        'Se inaugura con banda de música el primer {objeto} oficial de la República. {paredes} corta la cinta. La cinta es lo único que funciona.',
        'Un decreto de catorce páginas regula {objeto} hasta el último detalle. La página nueve contradice a la página tres.'
      ],
      consecuencias: [
        { en: 3, titulo: 'Turismo del absurdo', textos: ['Llegan turistas extranjeros a ver {objeto} con sus propios ojos. Compran camisetas y se van riendo. El dinero, al menos, es real.', 'Un documental extranjero sobre {objeto} en Valdoria se vuelve viral. Llegan mochileros. Algunos se quedan.'], efectos: { dinero: 5, estabilidad: -1 } },
        { en: 2, titulo: 'La contrata', textos: ['La empresa que construye {objeto} resulta ser del cuñado de {cifuentes}. El presupuesto ya se ha triplicado.', 'Se descubre que {objeto} no existe todavía, pero ya tiene doscientos empleados cobrando.'], efectos: { dinero: -6 } }
      ]
    },
    vender: {
      gaceta: [
        'Se adjudica {objeto} a la empresa Valdoria Futuro S.A., fundada ayer por la tarde. Su dirección fiscal es un buzón en el puerto.',
        'Se subasta {objeto} en el Palacio. Solo se presenta un comprador. Gana la subasta con una oferta de doce valdos y un apretón de manos.'
      ],
      consecuencias: [
        { en: 2, titulo: 'El dueño cobra', textos: ['El nuevo dueño de {objeto} empieza a cobrar a quien lo use, lo mire o lo mencione. Nadie sabía que se usaba. Ahora todo el mundo lo necesita.', 'Los dueños de {objeto} demandan al Estado por «uso indebido» de {objeto} en los actos oficiales.'], efectos: { felicidad: -3, dinero: 2 } }
      ]
    },
    impuesto: {
      gaceta: [
        'Se crea el Impuesto sobre {objeto}. Hacienda imprime un formulario de nueve páginas para declararlo.',
        'Cada ciudadano deberá declarar cuánto tiene de {objeto}. Hacienda no sabe cómo medirlo, pero ya ha contratado a doscientos medidores.'
      ],
      consecuencias: [
        { en: 2, titulo: 'La evasión', textos: ['Todo el mundo declara cero en la casilla de {objeto}. Lo que haya se esconde bajo la cama, en el jardín, en casa de la suegra. Hacienda contrata perros adiestrados.', 'Las familias ricas trasladan su {objeto} a una isla del Caribe con mejor régimen fiscal.'], efectos: { dinero: -3, estabilidad: -1 } }
      ]
    }
  };

  // Recuerdos: la gente no olvida tus decretos anteriores.
  RF.ECOS = [
    'En el mercado todavía se habla de {anterior}.',
    'Algunos dicen que esto es peor que {anterior}. Otros, que es la continuación.',
    '{paredes} intenta que la gente olvide {anterior} con este nuevo decreto. No funciona del todo.',
    'Hay quien guarda los recortes de prensa de {anterior}, "para cuando haya juicio".',
    'Los vendedores de camisetas ya estampan {anterior} y esto en la misma prenda: "Yo sobreviví a los dos".'
  ];
})(globalThis.RF = globalThis.RF || {});
