/*
 * DILEMAS (eventos con decisiones, estilo Victoria 2)
 *
 * Cada dilema tiene:
 *   si(e)      condición para que pueda ocurrir (e = estado del juego). Sin "si", puede salir siempre.
 *   urgente    si se cumple la condición, salta pronto (a los 2 días del último evento) en vez de esperar 4
 *   peso       probabilidad relativa al elegir entre varios
 *   unaVez     solo ocurre una vez por partida
 *   soloCadena solo aparece como continuación de otro dilema
 *   opciones   2 o 3 respuestas. Cada una puede tener:
 *     efectos   cambios en las estadísticas          ingresos  cambio en los ingresos diarios
 *     animo     ánimo de la gente de a pie           politica  marca una política como hecha
 *     programar consecuencias con retraso            cadena    otro dilema que llega más tarde
 *     resultado lo que se cuenta después de elegir
 */
(function (RF) {
  'use strict';

  const pol = (e, obj) => e.politicas[obj];
  const hito = (e, id) => Object.values(e.ciudadanos).some(c => c.hitos.includes(id));
  const vivo = (e, id) => !e.ciudadanos[id].estado || e.ciudadanos[id].estado === 'libre';
  const sector = (e, id) => (e.eco && e.eco.sectores[id]) || { peso: 0 };
  const eco = e => e.eco || { paro: 0, inflacion: 0, contaminacion: 0, pib: 100, pibBase: 100 };
  const inst = (e, id) => e.instituciones && e.instituciones[id];
  const persona = (e, id) => (e.personas || {})[id] || 'libre';

  RF.DILEMAS = [
    // ---------- Provocados por el estado del país ----------
    {
      id: 'huelga_general', titulo: 'Huelga general', urgente: true,
      si: e => e.stats.pueblo < 38,
      texto: 'Los sindicatos han paralizado el país. No hay autobuses, no hay pan en las panaderías y en el puerto se pudren tres barcos de plátanos. En la plaza, miles de personas corean tu nombre, y no precisamente para alabarte.',
      opciones: [
        { texto: 'Negociar y subir los salarios', efectos: { tesoro: -8, pueblo: 10, cupula: -4 }, ingresos: -1, animo: { ramiro: 10, carmen: 8 }, resultado: 'Los sindicatos cantan victoria. {cifuentes} dice que el país no puede permitírselo, pero las panaderías vuelven a abrir.' },
        { texto: 'Mandar al ejército a romper la huelga', efectos: { orden: 7, pueblo: -8, ejercito: 4, mundo: -5 }, animo: { nico: -15, ramiro: -12 }, resultado: 'Los tanques despejan la plaza en veinte minutos. Las fotos de los soldados empujando a jubilados dan la vuelta al mundo.' },
        { texto: 'Declarar la huelga "fiesta nacional"', efectos: { pueblo: 3, tesoro: -6, cupula: -3 }, resultado: '{paredes} anuncia que el Gobierno "se une a la celebración". Los sindicatos no saben si han ganado o perdido. Mañana todos vuelven al trabajo, confundidos.' }
      ]
    },
    {
      id: 'garrote_tanques', titulo: 'El General pide un favor', urgente: true,
      si: e => e.stats.ejercito < 45,
      texto: 'El {n_garrote} entra en tu despacho sin llamar. Deja sobre la mesa un catálogo de tanques con varias páginas dobladas. "Mis muchachos están desmoralizados, {lider}. Un ejército sin juguetes nuevos es un ejército que piensa demasiado."',
      opciones: [
        { texto: 'Comprarle los tanques', efectos: { tesoro: -10, ejercito: 12, mundo: -2 }, resultado: 'Llegan veinte tanques de segunda mano. {garrote} los prueba personalmente atropellando un quiosco. Está feliz.' },
        { texto: 'Darle una medalla en su lugar', efectos: { ejercito: 4, tesoro: -1 }, resultado: '{garrote} acepta la medalla con una sonrisa tensa. Ya tiene cuarenta y tres. No le queda sitio en el pecho.' },
        { texto: 'Recordarle quién manda aquí', efectos: { ejercito: -8, orden: 3 }, resultado: '{garrote} se cuadra, saluda y se va sin decir palabra. Esa noche, en el cuartel, alguien rompe tu retrato "por accidente".' }
      ]
    },
    {
      id: 'rumor_golpe', titulo: 'Ruido de botas', urgente: true, unaVez: true,
      si: e => e.stats.ejercito < 30,
      texto: '{sombra} te despierta a las tres de la madrugada. Tres coroneles se han reunido en secreto en una finca del norte. Llevaban mapas del Palacio. "Puede ser una fiesta de cumpleaños," dice {sombra}. "O puede que no."',
      opciones: [
        { texto: 'Purgar a los coroneles', efectos: { ejercito: -4, orden: 6, mundo: -4 }, resultado: 'Los tres coroneles son "trasladados" a una base antártica que Valdoria no tiene. El resto del ejército toma nota.' },
        { texto: 'Duplicar el sueldo de los militares', efectos: { tesoro: -12, ejercito: 15 }, ingresos: -1, resultado: 'Los coroneles celebran la subida con una fiesta de cumpleaños. Esta vez sí era de cumpleaños.' },
        { texto: 'Dormir cada noche en un sitio distinto', efectos: { cupula: -3, orden: -2 }, cadena: { id: 'golpe_segunda', en: 4 }, resultado: 'Pasas la noche en el sofá de un primo lejano. No es digno, pero estás vivo. De momento.' }
      ]
    },
    {
      id: 'golpe_segunda', titulo: 'Los coroneles vuelven', soloCadena: true,
      texto: 'Los coroneles no se han olvidado de ti. Esta vez han hablado con {garrote}. El General te pide una "reunión a solas" en el cuartel. Sin escolta.',
      opciones: [
        { texto: 'Ir a la reunión', efectos: { ejercito: 10, cupula: -5 }, resultado: '{garrote} te recibe con café y una lista de peticiones. Firmas todas. Sales vivo, más pobre y con un general mucho más poderoso.' },
        { texto: 'Mandar a {sombra} a detener a los coroneles', efectos: { ejercito: -10, orden: 8, mundo: -3 }, resultado: '{sombra} actúa de noche. {garrote} no dice nada, pero deja de invitarte a los desfiles.' }
      ]
    },
    {
      id: 'desfalco', titulo: 'Números que no cuadran',
      si: e => e.stats.cupula > 55 && e.dia > 4,
      texto: 'Un contable joven del Ministerio de Hacienda pide verte a solas. Ha encontrado un agujero de tres millones de valdos. Todas las firmas son de {n_cifuentes}. El contable tiembla. Sabe que se ha metido en algo grande.',
      opciones: [
        { texto: 'Destituir a {cifuentes}', efectos: { cupula: -12, tesoro: 6, pueblo: 4 }, resultado: '{cifuentes} sale del Palacio escoltada, con la cabeza alta. Sus amigos del Club Náutico ya no te invitan a sus fiestas.' },
        { texto: 'Mirar hacia otro lado', efectos: { cupula: 5, tesoro: -5 }, resultado: 'El contable es trasladado a una oficina de correos en la frontera. {cifuentes} te manda una cesta de frutas.' },
        { texto: 'Pedir tu parte', efectos: { cupula: 8, tesoro: -8, mundo: -3 }, resultado: '{cifuentes} sonríe por primera vez de verdad. "Por fin nos entendemos, {lider}." Tu cuenta en el extranjero crece.' }
      ]
    },
    {
      id: 'cifuentes_conspira', titulo: 'La ministra conspira', urgente: true,
      si: e => e.stats.cupula < 35,
      texto: 'Tus espías han grabado a {n_cifuentes} en una cena con los banqueros. Hablaba de "el día después" y de "una transición ordenada". Brindaron. Tú no estabas invitado.',
      opciones: [
        { texto: 'Destituirla', efectos: { cupula: -8, orden: 3, tesoro: 3 }, resultado: '{cifuentes} se va dando un portazo. Los banqueros la contratan esa misma semana como asesora. De tus enemigos.' },
        { texto: 'Comprar su lealtad con otro ministerio', efectos: { cupula: 12, tesoro: -6 }, resultado: '{cifuentes} ahora es ministra de Hacienda y de Turismo. Promete lealtad eterna. Nadie se lo cree, pero la cena siguiente sí te invitan.' },
        { texto: 'Invitarla a cenar y que ella pruebe el postre primero', efectos: { cupula: 3, orden: 2 }, resultado: 'La cena transcurre en un silencio tenso. {cifuentes} come el postre despacio, mirándote a los ojos. No pasa nada. Esta vez.' }
      ]
    },
    {
      id: 'periodista', titulo: 'Una periodista extranjera',
      si: e => e.stats.mundo < 50,
      texto: 'Una famosa periodista extranjera ha llegado a Puerto Esperanza y pide una entrevista contigo. Su último reportaje terminó con un dictador en la cárcel. {montiel} cree que es una oportunidad. {sombra} cree que es una espía.',
      opciones: [
        { texto: 'Conceder la entrevista y ser encantador', efectos: { mundo: 7, orden: -2 }, resultado: 'Hablas dos horas de tu infancia humilde y tu amor por los gatitos. El reportaje se titula "El dictador que llora con los atardeceres". Funciona.' },
        { texto: 'Expulsarla del país', efectos: { mundo: -6, orden: 2 }, resultado: 'La periodista escribe su reportaje desde el aeropuerto. Se titula "Me echaron de Valdoria". Se vende muy bien.' },
        { texto: 'Que {paredes} la acompañe a todas partes', efectos: { mundo: 2, tesoro: -2 }, resultado: '{paredes} la lleva a una escuela modelo, un hospital modelo y un barrio modelo. Todo es de cartón. Ella se da cuenta, pero le cae bien {paredes}.' }
      ]
    },
    {
      id: 'fmi', titulo: 'Oferta del Fondo Monetario', urgente: true, unaVez: true,
      si: e => e.stats.tesoro < 30,
      texto: 'Una delegación del Fondo Monetario Internacional aterriza con maletines y trajes grises. Te ofrecen un préstamo enorme. A cambio quieren "reformas": recortes, privatizaciones y que dejes de llamarlos "buitres" en televisión.',
      opciones: [
        { texto: 'Aceptar el préstamo con sus condiciones', efectos: { tesoro: 22, pueblo: -8, mundo: 6 }, ingresos: 1, cadena: { id: 'fmi_inspectores', en: 5 }, resultado: 'El dinero llega en 48 horas. Los recortes, en 24. Doña Carmen ve cómo cierran el centro de salud de su barrio.' },
        { texto: 'Imprimir billetes', efectos: { tesoro: 14, cupula: -6 }, programar: [{ en: 3, titulo: 'Inflación', texto: 'El pan cuesta el doble que la semana pasada. Los billetes nuevos tienen tu cara, y la gente los usa para encender la cocina.', efectos: { pueblo: -7, tesoro: -4 } }], resultado: 'Las imprentas del Banco Central trabajan toda la noche. Por la mañana eres riquísimo. Por la tarde, el valdo vale la mitad.' },
        { texto: 'Vender las joyas del Palacio', efectos: { tesoro: 9, cupula: -2, pueblo: 2 }, resultado: 'Subastas la corona del último rey, tres cuadros y la vajilla de oro. Ahora comes en platos de plástico. La gente lo ve como un gesto humilde.' }
      ]
    },
    {
      id: 'fmi_inspectores', titulo: 'Llegan los inspectores', soloCadena: true,
      texto: 'Los inspectores del FMI revisan tus cuentas. Quieren ver los recortes prometidos. En la lista hay hospitales, escuelas y las pensiones de Doña Carmen.',
      opciones: [
        { texto: 'Cumplir con los recortes', efectos: { pueblo: -7, salud: -4, mundo: 5, tesoro: 5 }, animo: { carmen: -12, lucia: -12 }, resultado: 'Los inspectores se van satisfechos. Las colas en los hospitales dan la vuelta a la manzana.' },
        { texto: 'Engañar a los inspectores', efectos: { mundo: -6, tesoro: 3 }, resultado: '{paredes} monta hospitales cerrados con cartel de "cerrado por recortes" que en realidad funcionan por la puerta de atrás. Los inspectores se lo creen. Casi.' }
      ]
    },
    {
      id: 'ultimatum', titulo: 'Ultimátum internacional', urgente: true, unaVez: true,
      si: e => e.stats.mundo < 28,
      texto: 'Los embajadores de las grandes potencias te entregan una carta conjunta. Tienes una semana para liberar a los presos políticos y convocar elecciones anticipadas. Si no, "todas las opciones están sobre la mesa". {montiel} dice que en la mesa hay portaaviones.',
      opciones: [
        { texto: 'Ceder y liberar a los presos', efectos: { mundo: 12, orden: -6, ejercito: -3 }, animo: { nico: 15 }, resultado: 'Las cárceles se abren. Los liberados salen haciendo la V de victoria. Tu popularidad fuera sube; dentro, tus enemigos salen a la calle.' },
        { texto: 'Rechazarlo con un discurso patriótico', efectos: { pueblo: 6, mundo: -8 }, resultado: '"¡Valdoria no se arrodilla!" El discurso dura cuatro horas. La gente aplaude al principio y bosteza al final, pero aplaude.' },
        { texto: 'Pedir ayuda a una potencia rival', efectos: { mundo: 5, cupula: -4, tesoro: 6 }, programar: [{ en: 4, titulo: 'Asesores extranjeros', texto: 'Llegan los "asesores" de tu nuevo aliado. Hablan otro idioma, comen en Palacio y se han instalado en el mejor hotel. Nadie sabe cuándo se irán.', efectos: { ejercito: -3, cupula: -3 } }], resultado: 'Tu nuevo aliado manda un barco con víveres y un embajador que sonríe demasiado.' }
      ]
    },
    {
      id: 'epidemia', titulo: 'Brote de fiebre', urgente: true,
      si: e => e.stats.salud < 35,
      texto: '{n_ventura} trae malas noticias: una fiebre desconocida se extiende por los barrios del sur. Ya hay 300 casos. Si se sabe, habrá pánico. Si no se sabe, habrá más casos.',
      opciones: [
        { texto: 'Cuarentena total', efectos: { salud: 10, tesoro: -8, pueblo: -4 }, animo: { lucia: 10 }, resultado: 'Los barrios del sur se cierran con vallas. Lucía trabaja 20 horas al día, pero los casos empiezan a bajar.' },
        { texto: 'Ocultarlo a la población', efectos: { salud: -7, mundo: -4, orden: 2 }, animo: { lucia: -20 }, programar: [{ en: 3, titulo: 'La verdad sale a la luz', texto: 'Una enfermera filtra los datos reales de la epidemia. La gente se entera por la radio pirata de que el gobierno lo sabía.', efectos: { pueblo: -8, salud: -3 } }], resultado: '{paredes} anuncia en televisión una "ola de gripe estacional sin importancia". {ventura} se encierra en su despacho.' },
        { texto: 'Pedir ayuda internacional', efectos: { salud: 7, mundo: 3, cupula: -3 }, resultado: 'Llegan médicos extranjeros con trajes blancos. La gente les aplaude en la calle. A ti, no tanto.' }
      ]
    },
    {
      id: 'plaza_ocupada', titulo: 'La plaza ocupada', urgente: true,
      si: e => e.stats.orden < 40,
      texto: 'Miles de manifestantes han acampado en la Plaza Mayor, justo debajo de tu balcón. Tienen tiendas de campaña, una cocina comunitaria y un grupo de percusión que no para nunca. Tú no has dormido en tres días.',
      opciones: [
        { texto: 'Dialogar con los líderes', efectos: { pueblo: 5, orden: -3, cupula: -3 }, animo: { nico: 10 }, resultado: 'Te sientas con ellos en el suelo de la plaza. Son jóvenes, están cansados y tienen razón en la mitad de las cosas. Se van al día siguiente.' },
        { texto: 'Desalojar con gas lacrimógeno', efectos: { orden: 8, pueblo: -7, mundo: -5 }, animo: { nico: -20 }, resultado: 'La plaza queda vacía en una hora. El olor a gas tarda una semana en irse. El recuerdo, mucho más.' },
        { texto: 'Montar un concierto gratis al lado', efectos: { tesoro: -5, pueblo: 3, orden: 3 }, resultado: 'Contratas a la orquesta más ruidosa del país. La mitad de los manifestantes se va al concierto. La otra mitad baila. La protesta se disuelve bailando.' }
      ]
    },
    {
      id: 'aniversario', titulo: 'Aniversario del régimen',
      si: e => e.stats.pueblo > 55 && e.dia > 8, unaVez: true,
      texto: 'Se cumple un mes de tu llegada al poder (en Valdoria, un mes es mucho). {paredes} quiere celebrarlo por todo lo alto. {garrote} quiere un desfile. {cifuentes} quiere que no gastes nada.',
      opciones: [
        { texto: 'Gran desfile militar', efectos: { tesoro: -6, ejercito: 7, pueblo: 2 }, resultado: 'Pasan 60 tanques, 3 aviones y un pelotón de soldados cantando tu canción favorita. Uno de los aviones se estrella contra una estatua, pero nadie lo comenta.' },
        { texto: 'Fiesta popular con comida gratis', efectos: { tesoro: -8, pueblo: 8 }, animo: { carmen: 12 }, resultado: 'Doña Carmen hace arepas para 5.000 personas, pagadas por el Estado. Es el mejor día de su año.' },
        { texto: 'Un discurso de seis horas', efectos: { pueblo: -4, cupula: 2, orden: 2 }, resultado: 'Hablas de ti, de tu infancia, de tus sueños y de tus plantas. A la quinta hora hay gente durmiendo en el suelo de la plaza.' }
      ]
    },

    // ---------- Provocados por tus decretos ----------
    {
      id: 'contrabando_aire', titulo: 'Los contrabandistas de aire', urgente: true, unaVez: true,
      si: e => pol(e, 'AIRE') === 'PRIVATIZAR',
      texto: 'El aire embotellado se vende en cada esquina. Los contrabandistas lo traen de las montañas en camiones. {sombra} dice que ya mueve más dinero que el plátano.',
      opciones: [
        { texto: 'Legalizarlo y cobrarle impuestos', efectos: { tesoro: 7, salud: -3, cupula: 3 }, ingresos: 1, resultado: 'El aire de contrabando ahora lleva un sello oficial. Cuesta el doble, pero es legal.' },
        { texto: 'Perseguir a los contrabandistas', efectos: { orden: 5, pueblo: -5, tesoro: -3 }, resultado: 'La policía requisa diez mil botellas de aire. Nadie sabe qué hacer con ellas. Al final las abren en la plaza. Por un momento, todo el mundo respira gratis.' },
        { texto: 'Bajar la tarifa del aire', efectos: { tesoro: -6, pueblo: 7, salud: 4 }, animo: { carmen: 10, lucia: 8 }, resultado: 'La tarifa del aire baja a la mitad. Los contrabandistas se arruinan. Doña Carmen respira hondo por primera vez en semanas.' }
      ]
    },
    {
      id: 'hackers', titulo: 'Hackers de la resistencia', urgente: true, unaVez: true,
      si: e => pol(e, 'INTERNET') === 'PROHIBIR' || pol(e, 'PRENSA') === 'PROHIBIR' || pol(e, 'PRENSA') === 'CASTIGAR',
      texto: 'En mitad del noticiero de la noche, la señal de la televisión estatal se corta. Aparece un dibujo tuyo con orejas de burro y el mensaje: "LA VERDAD NO SE APAGA". Lo ha visto medio país.',
      opciones: [
        { texto: 'Devolver la libertad de comunicación', efectos: { pueblo: 6, orden: -3, mundo: 4 }, politica: { INTERNET: 'LEGALIZAR' }, animo: { nico: 15 }, resultado: 'Las antenas vuelven a encenderse. Lo primero que se hace viral es el dibujo de las orejas de burro.' },
        { texto: 'Cortar también la electricidad', efectos: { orden: 4, pueblo: -8, tesoro: -4, salud: -3 }, animo: { lucia: -15 }, resultado: 'El país entero a oscuras. Sin televisión no hay hackers. Tampoco hay hospitales funcionando.' },
        { texto: 'Contratar a los hackers', efectos: { tesoro: -5, orden: 5 }, resultado: '{sombra} los encuentra en un sótano y les ofrece un sueldo. Aceptan. Ahora trabajan para ti. Probablemente.' }
      ]
    },
    {
      id: 'multinacional', titulo: 'La multinacional contraataca', urgente: true, unaVez: true,
      si: e => pol(e, 'RECURSOS') === 'NACIONALIZAR' || pol(e, 'EMPRESAS') === 'NACIONALIZAR',
      texto: 'La multinacional que explotaba tus recursos ha demandado a Valdoria en un tribunal internacional. Exigen 800 millones. Su abogado principal fue compañero de universidad de tres presidentes extranjeros.',
      opciones: [
        { texto: 'Pagar una indemnización', efectos: { tesoro: -12, mundo: 7, cupula: 3 }, resultado: 'Pagas a plazos. {cifuentes} llora al firmar el cheque. La multinacional te manda una tarjeta de Navidad.' },
        { texto: 'Negarse en rotundo', efectos: { mundo: -8, pueblo: 6 }, programar: [{ en: 3, titulo: 'Embargo', texto: 'Un tribunal extranjero embarga dos barcos valdorianos en puertos internacionales. Los marineros no pueden volver a casa.', efectos: { tesoro: -5, mundo: -2 } }], resultado: 'Tu discurso contra "los piratas de corbata" se hace viral. En el extranjero no gusta tanto.' },
        { texto: 'Vendérselo todo a una potencia rival', efectos: { tesoro: 10, mundo: -3, cupula: 4 }, resultado: 'Una empresa estatal de otro país se queda con todo. Las cosas son iguales que antes, pero con otra bandera.' }
      ]
    },
    {
      id: 'madre_plaza', titulo: 'Una madre en la plaza', urgente: true, unaVez: true,
      si: e => pol(e, 'OPOSICION') === 'CASTIGAR' || pol(e, 'PRENSA') === 'CASTIGAR',
      texto: 'Una mujer lleva nueve días sentada frente al Palacio con la foto de su hijo, detenido por tu policía. No grita ni insulta. Solo está ahí. Cada día se sientan más mujeres a su lado. Hoy son doscientas.',
      opciones: [
        { texto: 'Liberar a su hijo', efectos: { pueblo: 5, orden: -3, mundo: 4 }, resultado: 'El chico sale de la cárcel con diez kilos menos. Su madre lo abraza frente a las cámaras. Por primera vez, la gente dice tu nombre sin rabia.' },
        { texto: 'Retirarlas de la plaza', efectos: { orden: 3, pueblo: -7, mundo: -6 }, animo: { carmen: -15, lucia: -10 }, resultado: 'La policía se las lleva a todas. Al día siguiente hay cuatrocientas.' },
        { texto: 'Ignorarlas', efectos: { pueblo: -2, mundo: -2 }, cadena: { id: 'madres_crecen', en: 4 }, resultado: 'Cierras las cortinas del despacho. Sigues oyendo el silencio.' }
      ]
    },
    {
      id: 'madres_crecen', titulo: 'Las madres de la plaza', soloCadena: true,
      texto: 'Ya son dos mil mujeres. La prensa extranjera las llama "las madres de Valdoria". Un premio internacional de derechos humanos las ha nominado. Tu nombre sale en el comunicado, y no para bien.',
      opciones: [
        { texto: 'Amnistía para los presos políticos', efectos: { pueblo: 8, mundo: 8, orden: -5, ejercito: -3 }, politica: { OPOSICION: 'LEGALIZAR' }, resultado: 'Las cárceles se abren. Las madres se levantan de la plaza despacio, como quien termina un trabajo largo.' },
        { texto: 'Acusarlas de ser agentes extranjeras', efectos: { pueblo: -8, mundo: -8, orden: 3 }, resultado: '{paredes} lo intenta en televisión. Nadie se lo cree. Hasta tu madre te llama para decirte que te pases por casa.' }
      ]
    },
    {
      id: 'rey_contrabando', titulo: 'El rey del contrabando',
      si: e => pol(e, 'VICIOS') === 'PROHIBIR' || pol(e, 'DIVERSION') === 'PROHIBIR', unaVez: true,
      texto: 'Un hombre con gafas de sol y un traje blanco espera en tu antesala. Controla todo el contrabando del país desde que prohibiste lo que prohibiste. Trae un maletín. "Un regalo, {lider}. Para que todo siga como está."',
      opciones: [
        { texto: 'Aceptar el maletín', efectos: { tesoro: 8, cupula: 3, orden: -5 }, resultado: 'El maletín tiene más dinero del que Hacienda recauda en un mes. El hombre de blanco se va silbando.' },
        { texto: 'Arrestarlo allí mismo', efectos: { orden: 6, cupula: -3, pueblo: 3 }, programar: [{ en: 3, titulo: 'La venganza del contrabando', texto: 'Arde un almacén del gobierno en el puerto. En las paredes, pintado en blanco: "Nadie es rey para siempre".', efectos: { tesoro: -5, orden: -3 } }], resultado: '{sombra} le pone las esposas. El hombre sonríe. "Esto no ha terminado," dice. Tiene razón.' },
        { texto: 'Legalizarlo todo y cobrar impuestos', efectos: { tesoro: 5, pueblo: 4, salud: -2 }, ingresos: 1, politica: { VICIOS: 'LEGALIZAR', DIVERSION: 'LEGALIZAR' }, resultado: 'El contrabando se hunde en una semana. El hombre de blanco abre una cadena de bares legales. Paga impuestos. Es lo más raro que ha pasado en Valdoria.' }
      ]
    },
    {
      id: 'estatua_rota', titulo: 'La estatua amanece rota',
      si: e => pol(e, 'LIDER') === 'GLORIFICAR' && e.stats.pueblo < 55, unaVez: true,
      texto: 'Alguien ha serrado la nariz de tu estatua de 30 metros durante la noche. La nariz, de dos toneladas, ha aparecido en la puerta de la embajada de un país vecino. Nadie sabe cómo.',
      opciones: [
        { texto: 'Detener a todo el barrio', efectos: { orden: 5, pueblo: -7, mundo: -3 }, animo: { carmen: -12, nico: -12 }, resultado: 'Detienen a 300 personas. Ninguna tiene una sierra de dos toneladas. La nariz sigue en la embajada.' },
        { texto: 'Reírte en público', efectos: { pueblo: 6, cupula: -2 }, resultado: 'Sales al balcón, te tocas la nariz y te ríes. La foto se hace viral. Por un día eres el dictador más simpático del continente.' },
        { texto: 'Construir otra estatua más grande', efectos: { tesoro: -8, pueblo: -3, cupula: 3 }, resultado: 'La nueva estatua mide 45 metros y tiene la nariz de acero reforzado. Los niños del barrio ya están haciendo apuestas.' }
      ]
    },
    {
      id: 'motin_soldados', titulo: 'Soldados sin sueldo', urgente: true, unaVez: true,
      si: e => pol(e, 'EJERCITO') === 'RECORTAR' || pol(e, 'EJERCITO') === 'CASTIGAR',
      texto: 'Una compañía entera se ha encerrado en el cuartel de San Blas. No han cobrado este mes. Exigen su sueldo "y una disculpa por escrito". Tienen dos tanques y una máquina de café.',
      opciones: [
        { texto: 'Pagarles y pedir perdón', efectos: { tesoro: -6, ejercito: 8 }, resultado: 'Firmas la disculpa. Los soldados la enmarcan. {garrote} la lee en voz alta en el comedor, con retintín.' },
        { texto: 'Rodear el cuartel con la policía', efectos: { orden: 3, ejercito: -10, mundo: -2 }, resultado: 'Policías contra soldados. Nadie dispara, pero el ejército no olvida quién mandó a los policías.' }
      ]
    },
    {
      id: 'medicos_huyen', titulo: 'Los médicos se van', urgente: true, unaVez: true,
      si: e => pol(e, 'SALUD') === 'RECORTAR' || pol(e, 'SALUD') === 'PRIVATIZAR',
      texto: 'Cien médicos han pedido el visado para irse del país este mes. {n_ventura} te enseña la lista. En ella está Lucía, del Hospital Central.',
      opciones: [
        { texto: 'Subirles el sueldo', efectos: { tesoro: -8, salud: 8 }, ingresos: -1, animo: { lucia: 20 }, resultado: 'La mitad se queda. Lucía rompe su formulario de emigración. Por ahora.' },
        { texto: 'Prohibirles salir del país', efectos: { salud: 2, mundo: -6, pueblo: -4 }, animo: { lucia: -25 }, resultado: 'Los médicos se quedan, pero trabajan con desgana y hablan mal de ti en voz baja con cada paciente.' },
        { texto: 'Traer médicos extranjeros', efectos: { tesoro: -5, salud: 5, mundo: 3 }, resultado: 'Llegan médicos de un país lejano. No hablan bien el idioma, pero curan igual.' }
      ]
    },

    // ---------- Provocados por la gente de a pie ----------
    {
      id: 'nico_detenido', titulo: 'Un joven detenido', urgente: true, unaVez: true,
      si: e => hito(e, 'nico_resistencia') && vivo(e, 'nico'),
      texto: '{sombra} deja una carpeta sobre tu mesa. Dentro hay una foto de Nico, el nieto de Doña Carmen, detenido anoche mientras pintaba un mural contra ti. "Es un pez pequeño," dice {sombra}. "Pero los peces pequeños conocen a los grandes."',
      opciones: [
        { texto: 'Liberarlo', efectos: { orden: -4, pueblo: 4 }, animo: { carmen: 20, nico: 15 }, resultado: 'Nico sale de la comisaría y abraza a su abuela. Ninguno de los dos entiende por qué. Nico sigue odiándote, pero un poco menos.' },
        { texto: 'Que sirva de ejemplo', efectos: { orden: 5, pueblo: -6, mundo: -3 }, animo: { carmen: -35, nico: -30 }, programar: [{ en: 4, titulo: 'Doña Carmen habla', texto: 'Doña Carmen aparece en la radio pirata. No insulta a nadie. Solo cuenta cómo era Nico de niño. Medio país llora escuchándola.', efectos: { pueblo: -6 } }], resultado: 'Nico es condenado a cinco años. Doña Carmen cierra su puesto para ir a verlo cada día a la cárcel.' },
        { texto: 'Ofrecerle trabajo en propaganda', efectos: { pueblo: 2, orden: 2 }, animo: { nico: -10, carmen: 5 }, resultado: 'Nico acepta, para salir. Ahora escribe eslóganes para {paredes}. Son sospechosamente irónicos, pero nadie en el ministerio lo nota.' }
      ]
    },
    {
      id: 'carmen_radio', titulo: 'La arepera de La Esperanza', urgente: true, unaVez: true,
      si: e => hito(e, 'carmen_cierra') && vivo(e, 'carmen'),
      texto: 'Doña Carmen se ha vuelto famosa sin quererlo: una foto de su persiana con el mensaje "Gracias a Su Excelencia" circula por todo el país. La gente pasa a hacerse fotos. {paredes} dice que es "un problema de imagen".',
      opciones: [
        { texto: 'Regalarle un puesto nuevo', efectos: { tesoro: -2, pueblo: 5 }, animo: { carmen: 25 }, resultado: 'Doña Carmen acepta el puesto nuevo con desconfianza. Las arepas siguen igual de buenas. En la persiana nueva no ha escrito nada. Todavía.' },
        { texto: 'Que {sombra} le haga una visita', efectos: { orden: 2, pueblo: -7, mundo: -2 }, animo: { carmen: -30, nico: -25 }, resultado: 'Dos hombres de traje pasan por el barrio. Doña Carmen borra el mensaje. La foto de la persiana borrada es aún más famosa.' },
        { texto: 'Comprar arepas en persona, con cámaras', efectos: { pueblo: 3, cupula: -1 }, animo: { carmen: 8 }, resultado: 'Doña Carmen te sirve una arepa mirándote a los ojos. No te cobra. No sabes si es un honor o un insulto.' }
      ]
    },
    {
      id: 'taxistas', titulo: 'Los taxistas bloquean el centro', urgente: true, unaVez: true,
      si: e => hito(e, 'ramiro_huelga') && vivo(e, 'ramiro'),
      texto: 'Quinientos taxis bloquean las avenidas principales de Puerto Esperanza, tocando el claxon sin parar. Al frente, subido a su capó, está Ramiro con un megáfono.',
      opciones: [
        { texto: 'Bajar el precio de la gasolina', efectos: { tesoro: -6, pueblo: 5 }, ingresos: -1, animo: { ramiro: 25 }, resultado: 'Ramiro anuncia la victoria por el megáfono. Los taxistas se van tocando el claxon, esta vez de alegría.' },
        { texto: 'Retirarles las licencias', efectos: { orden: 3, pueblo: -5, tesoro: -2 }, animo: { ramiro: -30 }, resultado: 'Los taxis se quedan en los garajes. La ciudad no tiene transporte. Los taxistas se dedican a otras cosas. Algunas, ilegales.' },
        { texto: 'Subirte al taxi de Ramiro', efectos: { pueblo: 4, mundo: 1 }, animo: { ramiro: 15 }, resultado: 'Te subes al taxi de Ramiro y das una vuelta por la ciudad escuchando sus quejas. Te cobra el viaje. Es el mejor anuncio que has hecho.' }
      ]
    },
    {
      id: 'lucia_carta', titulo: 'Carta de una enfermera', unaVez: true, urgente: true,
      si: e => e.stats.salud < 42 && e.dia > 4 && vivo(e, 'lucia'),
      texto: 'Entre la correspondencia hay una carta escrita a mano. La firma Lucía, enfermera del Hospital Central. "Excelencia: ayer murió un niño porque no teníamos oxígeno. No le pido nada para mí. Solo que venga a verlo usted mismo."',
      opciones: [
        { texto: 'Visitar el hospital y aumentar su presupuesto', efectos: { tesoro: -8, salud: 9, pueblo: 3 }, animo: { lucia: 25 }, resultado: 'Recorres los pasillos del Hospital Central. Nadie aplaude. Lucía te enseña cada cama vacía de sábanas. Firmas el presupuesto allí mismo.' },
        { texto: 'Contestar con una foto firmada', efectos: { pueblo: -2 }, animo: { lucia: -15 }, resultado: 'Lucía recibe tu foto con autógrafo. La pega en la puerta del baño del hospital.' },
        { texto: 'Pasarle la carta a {sombra}', efectos: { orden: 2, salud: -3 }, animo: { lucia: -30 }, resultado: 'Lucía recibe una visita de la policía. No la detienen. Solo le dicen que "tenga cuidado con lo que escribe". Esa noche empieza a hacer la maleta.' }
      ]
    },

    // ---------- Sucesos que pueden pasar siempre ----------
    {
      id: 'tostada', titulo: 'El milagro de la tostada', peso: 0.7, unaVez: true,
      texto: 'Una señora de Villa Mango asegura que en su tostada ha aparecido la cara de la Virgen. Hay colas de tres kilómetros para verla. Los curas están emocionados. Los panaderos, más.',
      opciones: [
        { texto: 'Declararlo milagro nacional', efectos: { pueblo: 6, mundo: -2 }, resultado: 'La tostada viaja en procesión hasta la catedral. Se instala en una urna blindada. Empieza a oler raro, pero nadie dice nada.' },
        { texto: 'Anunciar que en realidad es tu cara', efectos: { pueblo: -4, cupula: 2 }, resultado: '{paredes} lo anuncia en televisión con total seriedad. Los curas se indignan. Los humoristas tienen material para un año.' },
        { texto: 'Comerte la tostada en directo', efectos: { pueblo: -6, mundo: 3 }, resultado: 'La imagen de ti masticando la tostada sagrada da la vuelta al mundo. Te llaman "el ateo más valiente" o "el anticristo", según el país.' }
      ]
    },
    {
      id: 'resort', titulo: 'Un casino en la playa',
      si: e => e.stats.cupula > 45,
      texto: 'Un magnate extranjero quiere construir un casino-hotel de lujo en la Playa del Pueblo, la única playa pública de la capital. Promete empleo, turismo y "un pequeño porcentaje" para ti.',
      opciones: [
        { texto: 'Aceptar', efectos: { tesoro: 10, cupula: 5, pueblo: -6 }, ingresos: 1, resultado: 'La playa se cierra con una valla. Los niños de La Esperanza ven el mar a través de los barrotes. Los turistas, desde la piscina.' },
        { texto: 'Rechazar', efectos: { cupula: -5, pueblo: 4 }, resultado: 'El magnate se va a otro país. Los niños siguen bañándose gratis. {cifuentes} no te habla en dos días.' },
        { texto: 'Aceptar si lleva tu nombre', efectos: { tesoro: 6, pueblo: -3, cupula: 3 }, resultado: 'Se inaugura el "Gran Casino Su Excelencia". Tienes una suite gratis para siempre. Nunca vas, pero te hace ilusión.' }
      ]
    },
    {
      id: 'cumbre', titulo: 'Invitación a una cumbre',
      si: e => e.stats.mundo > 45,
      texto: 'Te invitan a una cumbre de presidentes en el extranjero. Estarán los más poderosos del mundo. Es una oportunidad. También es la primera vez que saldrías del país desde que llegaste al poder.',
      opciones: [
        { texto: 'Ir y dar un discurso', efectos: { mundo: 7, tesoro: -3, ejercito: -2 }, resultado: 'Tu discurso sobre "la soberanía de los pueblos pequeños" recibe una ovación. Al volver, compruebas que el Palacio sigue siendo tuyo. Suspiras aliviado.' },
        { texto: 'Mandar a la canciller {montiel}', efectos: { mundo: 3 }, resultado: '{montiel} brilla en la cumbre. Tan bien que algunos presidentes preguntan si no debería mandar ella.' },
        { texto: 'Ir y dormirte en primera fila', efectos: { mundo: -4, pueblo: 3 }, resultado: 'La foto de ti roncando junto a tres presidentes se hace viral. En Valdoria les parece gracioso. Fuera, no tanto.' }
      ]
    },
    {
      id: 'ovni', titulo: 'Luces en el cielo', peso: 0.5, unaVez: true,
      texto: 'Cientos de personas han visto luces extrañas sobre la sierra. Hay videos borrosos, testigos llorando y un pastor que asegura que se llevaron a su cabra. La cabra ha vuelto, pero rara.',
      opciones: [
        { texto: 'Anunciar que son aliados de Valdoria', efectos: { pueblo: 3, mundo: -3 }, resultado: '{paredes} anuncia que "potencias de otros mundos respaldan al gobierno". La mitad del país se ríe. La otra mitad se lo cree.' },
        { texto: 'Culpar a la oposición', efectos: { orden: 2, mundo: -2, pueblo: -1 }, resultado: '{sombra} detiene a tres astrónomos aficionados. No encuentran ninguna nave, pero sí una colección de sellos muy sospechosa.' },
        { texto: 'Crear el Ministerio de Asuntos Extraterrestres', efectos: { tesoro: -4, pueblo: 4, mundo: -1 }, resultado: 'El nuevo ministerio tiene un ministro, dos telescopios y una cabra. Es el ministerio más popular del gobierno.' }
      ]
    },
    {
      id: 'sequia', titulo: 'La gran sequía',
      si: e => e.dia > 5,
      texto: 'No llueve desde hace cuarenta días. Los embalses están bajo mínimos, las vacas adelgazan y el precio del maíz se ha triplicado. Los campesinos miran al cielo, y luego al Palacio.',
      opciones: [
        { texto: 'Racionar el agua', efectos: { pueblo: -4, orden: 2, salud: -2 }, resultado: 'Agua dos horas al día por barrio. Los ricos llenan sus piscinas con camiones cisterna. La gente lo ve.' },
        { texto: 'Traer agua en barcos', efectos: { tesoro: -10, pueblo: 5 }, resultado: 'Llegan barcos cisterna de un país vecino. Muy caro, pero los grifos vuelven a funcionar.' },
        { texto: 'Organizar una procesión para que llueva', efectos: { pueblo: 3, salud: -3 }, programar: [{ en: 2, titulo: 'Lluvia', texto: 'Dos días después de la procesión, llueve. Los curas dicen que es un milagro. Los meteorólogos dicen que era la temporada. Da igual: llueve.', efectos: { pueblo: 3, salud: 3 } }], resultado: 'Encabezas la procesión descalzo, bajo un sol de cuarenta grados. Es un gesto. Los gestos a veces funcionan.' }
      ]
    },
    {
      id: 'cancion', titulo: 'La canción de moda',
      si: e => e.dia > 4,
      texto: 'La canción más escuchada del país se llama "El Loco del Palacio". Es pegadiza, bailable y habla de ti. No bien. La cantan hasta los niños en el recreo.',
      opciones: [
        { texto: 'Prohibir la canción', efectos: { orden: 2, pueblo: -4, mundo: -2 }, programar: [{ en: 2, titulo: 'El efecto prohibición', texto: 'Desde que la prohibiste, "El Loco del Palacio" es la canción más escuchada de la historia de Valdoria. Suena en cada bus, en cada fiesta, en cada cárcel.', efectos: { pueblo: -3 } }], resultado: 'La canción queda prohibida. Las ventas de radios piratas se disparan.' },
        { texto: 'Invitar al cantante a Palacio', efectos: { pueblo: 4, cupula: -2 }, animo: { nico: 8 }, resultado: 'El cantante viene, toma champán y se hace una foto contigo. Al día siguiente saca un remix: "El Loco del Palacio (me invitó a champán)".' },
        { texto: 'Grabar una respuesta en reguetón', efectos: { pueblo: 2, mundo: -3 }, resultado: 'Tu tema "Soy el que manda (remix oficial)" se convierte en el video más visto del año. Nadie sabe si es en serio.' }
      ]
    },
    {
      id: 'terremoto', titulo: 'Terremoto en el sur', peso: 0.6,
      si: e => e.dia > 6, unaVez: true,
      texto: 'Un terremoto de magnitud 7 sacude el sur del país. Pueblos enteros de adobe se han venido abajo. Las cámaras de televisión llegan antes que la ayuda del gobierno.',
      opciones: [
        { texto: 'Ir tú mismo con las tropas', efectos: { tesoro: -8, pueblo: 7, ejercito: 3, salud: 3 }, resultado: 'Te fotografían cargando sacos de arena junto a los soldados. Es teatro, pero la ayuda llega de verdad.' },
        { texto: 'Mandar a {garrote} y quedarte en Palacio', efectos: { tesoro: -5, ejercito: 5, pueblo: -2 }, resultado: '{garrote} organiza el rescate con eficacia militar. Le aplauden a él, no a ti.' },
        { texto: 'Pedir ayuda internacional', efectos: { mundo: 4, salud: 4, cupula: 3, tesoro: 3 }, resultado: 'Llega ayuda de medio mundo. La mitad desaparece en el puerto. {cifuentes} estrena coche.' }
      ]
    },
    // ---------- Economía y mercado ----------
    {
      id: 'dea', titulo: 'Visita de la agencia antidroga', urgente: true, unaVez: true,
      si: e => sector(e, 'narco').peso >= 8,
      texto: 'Tres agentes de la agencia antidroga de la Unión Atlántica aterrizan sin avisar. Traen fotos de pistas clandestinas, de barcos cargados y de un ministro tuyo saludando a un capo en una boda. Quieren nombres.',
      opciones: [
        { texto: 'Extraditar a los grandes capos', efectos: { mundo: 9, cupula: -7, orden: -3 }, economia: { multiplicar: { narco: 0.6 } }, resultado: 'Los capos salen esposados en un avión militar. Los que se quedan juran venganza. El negocio cae, pero no desaparece.' },
        { texto: 'Negarse: "Valdoria es soberana"', efectos: { mundo: -9, pueblo: 3 }, programar: [{ en: 3, titulo: 'Sanciones antidroga', texto: 'La Unión Atlántica congela las cuentas de tus bancos y veta los barcos valdorianos en sus puertos.', efectos: { tesoro: -8, mundo: -3 } }], resultado: 'Los agentes se van con las fotos. Tu discurso sobre la soberanía nacional gusta mucho en la calle y nada fuera.' },
        { texto: 'Ofrecerles una parte del negocio', efectos: { tesoro: 5, mundo: -4, cupula: 4 }, resultado: 'Uno de los agentes acepta. Los otros dos no. Ahora tienes un aliado dentro de la agencia y dos enemigos jurados.' }
      ]
    },
    {
      id: 'guerra_carteles', titulo: 'Guerra de cárteles', urgente: true,
      si: e => sector(e, 'narco').peso >= 6 && sector(e, 'narco').dueno === 'carteles',
      texto: 'Dos cárteles se disputan las rutas del puerto. Anoche hubo tiroteos en tres barrios. En La Esperanza, los niños ya no salen a jugar a la calle.',
      opciones: [
        { texto: 'Apoyar al cártel más fuerte', efectos: { orden: 5, cupula: 4, mundo: -5 }, resultado: 'Con tu ayuda, el Cártel del Puerto se impone en una semana. Los tiroteos paran. Ahora hay un solo jefe, y te debe un favor.' },
        { texto: 'Sacar el ejército a las calles', efectos: { orden: 6, ejercito: 3, tesoro: -5, pueblo: -3 }, economia: { multiplicar: { narco: 0.8 } }, resultado: 'Tanquetas en cada esquina. La violencia baja, las quejas suben. Los cárteles se esconden y esperan.' },
        { texto: 'Negociar una tregua', efectos: { orden: 3, tesoro: -3, cupula: 3, mundo: -2 }, resultado: 'Los dos jefes se reúnen en tu finca de la playa. Se reparten las rutas sobre un mapa, entre gambas y whisky. Tú sirves el hielo.' }
      ]
    },
    {
      id: 'bloqueo_naval', titulo: 'Bloqueo naval', urgente: true, unaVez: true,
      si: e => sector(e, 'narco').peso >= 22 && e.stats.mundo < 35,
      texto: 'La flota de la Unión Atlántica bloquea tus puertos. Ningún barco entra ni sale. El comunicado es claro: "Hasta que Valdoria deje de ser un narcoestado".',
      opciones: [
        { texto: 'Rendirse y desmantelar el negocio', efectos: { mundo: 15, tesoro: -10, cupula: -8 }, economia: { multiplicar: { narco: 0.2 }, cancelarModelo: true, paro: 6 }, resultado: 'Quemas los laboratorios delante de las cámaras. El humo se ve desde los barcos. El bloqueo se levanta; la economía, no.' },
        { texto: 'Resistir: "¡Ni un paso atrás!"', efectos: { pueblo: 4, mundo: -10, tesoro: -8, salud: -3 }, resultado: 'Racionamiento, colas y discursos. El bloqueo sigue. Los contrabandistas, irónicamente, siguen entrando.' },
        { texto: 'Vender las rutas a una potencia rival', efectos: { tesoro: 12, mundo: -4, ejercito: -3 }, resultado: 'Una potencia rival rompe el bloqueo con un portaaviones y se queda con las rutas. Ya no eres un narcoestado: eres su narcoestado.' }
      ]
    },
    {
      id: 'adiccion', titulo: 'La epidemia silenciosa', unaVez: true, urgente: true,
      si: e => sector(e, 'narco').peso >= 14,
      texto: 'La droga que exportas también se queda. En los barrios pobres hay jóvenes consumidos en cada portal. {ventura} te trae los datos: se han triplicado las muertes por sobredosis.',
      opciones: [
        { texto: 'Abrir clínicas de desintoxicación', efectos: { tesoro: -6, salud: 6, pueblo: 2 }, animo: { lucia: 8 }, resultado: 'Las clínicas se llenan el primer día. {ventura} dice que harían falta diez veces más.' },
        { texto: 'Mano dura contra los consumidores', efectos: { orden: 3, pueblo: -5, salud: -2, mundo: -2 }, animo: { nico: -10 }, resultado: 'Las cárceles se llenan de chicos de dieciocho años. Los que venden, siguen fuera.' },
        { texto: 'Mirar hacia otro lado', efectos: { salud: -6, pueblo: -2 }, resultado: 'Nadie en Palacio vuelve a hablar del tema. En los barrios no se habla de otra cosa.' }
      ]
    },
    {
      id: 'derrumbe_mina', titulo: 'Derrumbe en la mina', urgente: true, unaVez: true,
      si: e => sector(e, 'carbon').peso >= 14,
      texto: 'Se ha derrumbado una galería en la mina de carbón de El Hoyo. Hay 43 mineros atrapados a 300 metros de profundidad. Las familias esperan en la boca de la mina con linternas.',
      opciones: [
        { texto: 'Rescate a cualquier precio', efectos: { tesoro: -7, pueblo: 6, mundo: 3 }, resultado: 'Tras seis días sacan a 41 mineros con vida. Las imágenes dan la vuelta al mundo. Te fotografías abrazando al último.' },
        { texto: 'Culpar a los mineros de imprudencia', efectos: { pueblo: -7, cupula: 3 }, animo: { ramiro: -10, carmen: -10 }, resultado: 'Los dueños de la mina te lo agradecen con una cena. En El Hoyo, tu retrato aparece colgado boca abajo.' },
        { texto: 'Cerrar la mina y dar pensiones a las familias', efectos: { tesoro: -5, pueblo: 3 }, economia: { sectores: { carbon: -4 } }, resultado: 'La mina se cierra para siempre. Las familias reciben pensiones. El carbón del país baja un poco.' }
      ]
    },
    {
      id: 'cumbre_clima', titulo: 'Acusado en la cumbre del clima', urgente: true,
      si: e => eco(e).contaminacion >= 52, unaVez: true,
      texto: 'En la cumbre mundial del clima, Valdoria aparece en la lista de los diez países más contaminantes por habitante. Una activista de quince años te señala con el dedo desde el escenario.',
      opciones: [
        { texto: 'Prometer una transición verde', efectos: { mundo: 7, cupula: -4, tesoro: -3 }, economia: { sectores: { carbon: -3, tecnologia: 2 } }, resultado: 'Anuncias un plan verde con mucha foto y poco presupuesto. El mundo aplaude, con reservas.' },
        { texto: 'Decir que el cambio climático es un invento', efectos: { mundo: -7, pueblo: 2, cupula: 3 }, resultado: 'Tu discurso se hace viral en los peores foros de internet. Te invitan a tres congresos que prefieres no mencionar.' },
        { texto: 'Vender "bonos de carbono" a países ricos', efectos: { tesoro: 7, mundo: -2 }, resultado: 'Vendes a los países ricos el derecho a contaminar en tu nombre. Es legal, es rentable y no tiene ningún sentido.' }
      ]
    },
    {
      id: 'paro_masivo', titulo: 'Las colas del paro', urgente: true,
      si: e => eco(e).paro >= 24,
      texto: 'Uno de cada cuatro valdorianos no tiene trabajo. Las colas de la oficina de empleo dan la vuelta a la manzana desde la madrugada. Alguien vende sitios en la cola.',
      opciones: [
        { texto: 'Gran plan de obras públicas', efectos: { tesoro: -9, pueblo: 4 }, economia: { paro: -7 }, ingresos: -1, resultado: 'Carreteras, puentes y una rotonda con tu estatua en medio. Hay trabajo para todos durante un tiempo.' },
        { texto: 'Animar a la gente a emigrar', efectos: { pueblo: -3, tesoro: 3, salud: -2 }, economia: { paro: -5 }, resultado: 'Abres una oficina de "movilidad internacional". En un mes se van cincuenta mil personas. Las remesas empiezan a llegar.' },
        { texto: 'Culpar a los extranjeros', efectos: { pueblo: 2, mundo: -6, orden: -2 }, resultado: '{paredes} lanza una campaña: "Valdoria para los valdorianos". Los extranjeros se van. El paro sigue exactamente igual.' }
      ]
    },
    {
      id: 'hiperinflacion', titulo: 'Hiperinflación', urgente: true,
      si: e => eco(e).inflacion >= 45,
      texto: 'Los precios suben cada día. Un café cuesta por la tarde el doble que por la mañana. La gente cobra el sueldo y corre al supermercado antes de que valga menos.',
      opciones: [
        { texto: 'Crear una moneda nueva', efectos: { tesoro: -5, mundo: 2, pueblo: -2 }, economia: { inflacion: -40 }, resultado: 'Nace el "nuevo valdo", que vale mil valdos viejos. Tiene tu cara. La gente lo acepta con resignación.' },
        { texto: 'Congelar todos los precios', efectos: { pueblo: 4, cupula: -5 }, economia: { inflacion: -15 }, programar: [{ en: 3, titulo: 'Estanterías vacías', texto: 'Con los precios congelados, nadie quiere vender. Los supermercados están vacíos y el mercado negro, lleno.', efectos: { pueblo: -5, orden: -3 } }], resultado: 'Los precios se congelan por decreto. Las estanterías, poco después, también.' },
        { texto: 'Culpar a los especuladores', efectos: { pueblo: 3, cupula: -6, orden: 2 }, resultado: '{sombra} detiene a veinte comerciantes "por especular". La inflación no se entera y sigue subiendo.' }
      ]
    },
    {
      id: 'boom', titulo: 'Boom económico', unaVez: true,
      si: e => eco(e).pib >= eco(e).pibBase * 1.15,
      texto: 'La economía crece como nunca. Hay grúas en cada barrio, los restaurantes están llenos y {cifuentes} sonríe en las reuniones. La pregunta es qué hacer con tanto dinero.',
      opciones: [
        { texto: 'Ahorrarlo para tiempos peores', efectos: { tesoro: 10, pueblo: -2 }, resultado: '{cifuentes} guarda el dinero en un fondo soberano. Los economistas te felicitan. La gente pregunta dónde está su parte.' },
        { texto: 'Repartirlo en ayudas', efectos: { pueblo: 7, tesoro: -3 }, animo: { carmen: 10, lucia: 8 }, resultado: 'Cheques para cada familia, becas y pensiones más altas. Durante un mes, Valdoria es un país feliz.' },
        { texto: 'Construir el estadio más grande del continente', efectos: { pueblo: 3, tesoro: -6, cupula: 4, mundo: 2 }, resultado: 'El Estadio Su Excelencia tendrá 120.000 asientos. Valdoria tiene 3 millones de habitantes y ningún equipo en primera.' }
      ]
    },
    {
      id: 'reconversion_protestas', titulo: 'Los perdedores de la reconversión', unaVez: true,
      si: e => e.eco && e.eco.modelo && !e.eco.modelo.completado && e.dia - e.eco.modelo.desde >= 3,
      texto: 'La reconversión económica avanza y deja atrás a miles de trabajadores de los sectores que encogen. Los sindicatos marchan hacia el Palacio con sus herramientas en alto.',
      opciones: [
        { texto: 'Pagar indemnizaciones', efectos: { tesoro: -8, pueblo: 5 }, economia: { paro: -3 }, resultado: 'Los cheques llegan tarde, pero llegan. Los sindicatos aceptan, a regañadientes.' },
        { texto: 'Acelerar: "El futuro no espera"', efectos: { pueblo: -5, cupula: 3 }, economia: { paro: 3 }, resultado: 'Tu discurso sobre "los sacrificios necesarios" se emite en todas las cadenas. Los despedidos lo ven en los bares.' },
        { texto: 'Dar marcha atrás', efectos: { pueblo: 4, mundo: -2, cupula: -3 }, economia: { cancelarModelo: true }, resultado: 'Cancelas la reconversión. La economía queda a medio camino entre lo que era y lo que iba a ser.' }
      ]
    },

    // ---------- Instituciones del régimen ----------
    {
      id: 'escuadron_excesos', titulo: 'El Escuadrón se pasa de la raya', urgente: true, unaVez: true,
      si: e => inst(e, 'ESCUADRON') && e.dia - inst(e, 'ESCUADRON').desde >= 2,
      texto: 'Anoche, una camioneta del Escuadrón disparó contra un coche que no se detuvo en un control. Dentro iban un estudiante de medicina y su madre. Solo ella sobrevivió. El video está en todas partes.',
      opciones: [
        { texto: 'Encubrirlo: "Eran terroristas"', efectos: { orden: 2, pueblo: -7, mundo: -7 }, animo: { lucia: -15, nico: -15 }, resultado: '{paredes} lo intenta en televisión. La madre sale en la radio pirata con la foto de su hijo con la bata blanca. Nadie cree a {paredes}.' },
        { texto: 'Juzgar a los culpables', efectos: { pueblo: 4, orden: -3, mundo: 3 }, resultado: 'Tres agentes del Escuadrón son condenados. El resto del Escuadrón te mira distinto desde entonces.' },
        { texto: 'Disolver el Escuadrón', efectos: { pueblo: 5, mundo: 6, orden: -4 }, institucion: { ESCUADRON: 'disolver' }, resultado: 'El Escuadrón entrega las armas en una ceremonia tensa. Algunas armas no aparecen.' }
      ]
    },
    {
      id: 'tigre', titulo: 'El Tigre quiere más', unaVez: true,
      si: e => inst(e, 'ESCUADRON') && e.dia - inst(e, 'ESCUADRON').desde >= 6,
      texto: 'El jefe del Escuadrón, un comandante al que todos llaman "El Tigre", pide audiencia. Quiere ser ministro del Interior. "{sombra} es blando, {lider}. Yo no."',
      opciones: [
        { texto: 'Darle el ministerio', efectos: { orden: 7, mundo: -6, cupula: -4 }, nombrar: { cargo: 'sombra', nombre: 'Comandante "El Tigre" Robles', corto: 'Robles' }, resultado: '{sombra} recoge sus cosas en silencio. El Tigre se sienta en su silla antes de que termine.' },
        { texto: 'Negarse y recordarle su lugar', efectos: { orden: -3 }, programar: [{ en: 4, titulo: 'El Tigre se aleja', texto: 'El Tigre ya no recibe órdenes de Palacio con la misma rapidez. Sus hombres pintan un tigre en las camionetas, no tu cara.', efectos: { orden: -3, ejercito: -2 } }], resultado: 'El Tigre sonríe, saluda y se va. No has ganado un aliado.' },
        { texto: 'Hacerlo desaparecer', efectos: { orden: -2, mundo: 2, cupula: 2 }, resultado: 'El Tigre no vuelve de su última patrulla. El Escuadrón recibe un jefe nuevo, mucho más obediente y mucho más asustado.' }
      ]
    },
    {
      id: 'milicias_ejercito', titulo: 'Milicias contra soldados', urgente: true, unaVez: true,
      si: e => inst(e, 'MILICIA') && e.stats.ejercito < 50,
      texto: 'Una patrulla de las Milicias y otra del ejército se han enfrentado a tiros en un control de carretera. Hay dos muertos. {n_garrote} exige que desarmes a "esos aficionados con brazalete".',
      opciones: [
        { texto: 'Desarmar a las Milicias', efectos: { ejercito: 8, pueblo: -3 }, institucion: { MILICIA: 'disolver' }, resultado: 'Las Milicias entregan los fusiles. Algunos milicianos lloran. {garrote} ni los mira.' },
        { texto: 'Poner a las Milicias bajo el ejército', efectos: { ejercito: 5, orden: 2 }, resultado: 'Las Milicias pasan a obedecer a {garrote}. Ahora él tiene más hombres que nunca. Esperemos que te siga queriendo.' },
        { texto: 'Dar la razón a las Milicias', efectos: { ejercito: -9, pueblo: 3, orden: 2 }, resultado: 'Las Milicias celebran en los barrios. En los cuarteles no se celebra nada.' }
      ]
    },
    {
      id: 'complot', titulo: 'Tus espías descubren un complot', urgente: true, unaVez: true,
      si: e => inst(e, 'ESPIAS') && (e.stats.ejercito < 38 || e.stats.cupula < 38),
      texto: 'La Dirección de Inteligencia te entrega una carpeta roja: grabaciones, fotos y una lista de doce nombres que planean "sustituirte". Tres de ellos se sientan a tu mesa cada lunes.',
      opciones: [
        { texto: 'Detenerlos a todos esta noche', efectos: { ejercito: 6, cupula: 6, orden: 3, mundo: -5 }, resultado: 'Doce detenciones antes del amanecer. El resto del poder entiende el mensaje. Nadie vuelve a conspirar. Durante un tiempo.' },
        { texto: 'Vigilarlos y esperar', efectos: { orden: 2 }, resultado: 'Dejas que sigan conspirando mientras escuchas cada palabra. Es agotador, pero aprendes mucho.' },
        { texto: 'Chantajearlos para que te sirvan', efectos: { cupula: 8, ejercito: 3, pueblo: -1 }, resultado: 'Cada uno recibe una copia de su carpeta y una sonrisa tuya. Ahora son los más leales del país.' }
      ]
    },

    // ---------- Personas ----------
    {
      id: 'valiente_mitin', titulo: 'El mitin de Valiente',
      si: e => persona(e, 'valiente') === 'libre' && e.dia > 3,
      texto: 'Ernesto Valiente, líder de la oposición, convoca un mitin en el Parque Central. Esperan a cien mil personas. En Palacio, {sombra} pide permiso para "tomar medidas".',
      opciones: [
        { texto: 'Permitir el mitin', efectos: { pueblo: 3, mundo: 3, orden: -3 }, resultado: 'Valiente habla dos horas. Critica todo lo que haces, pero sin llamar a la violencia. El mundo toma nota de tu "tolerancia".' },
        { texto: 'Prohibirlo', efectos: { orden: 2, pueblo: -5, mundo: -4 }, resultado: 'El parque amanece vallado. Valiente da el discurso desde un balcón cercano, con un megáfono. Se oye igual.' },
        { texto: 'Detener a Valiente', efectos: {}, persona: { id: 'valiente', trato: 'encarcelar' }, resultado: 'Los agentes suben al escenario en mitad del discurso. Valiente no se resiste. Levanta las manos esposadas hacia la multitud.' }
      ]
    },
    {
      id: 'funeral_valiente', titulo: 'El funeral de Valiente', soloCadena: true,
      texto: 'El funeral de Ernesto Valiente es mañana. Medio país quiere ir. Las embajadas han pedido "garantías de seguridad". {sombra} dice que si se permite, será la manifestación más grande de la historia de Valdoria.',
      opciones: [
        { texto: 'Permitir el funeral', efectos: { pueblo: 3, orden: -7, mundo: 3 }, resultado: 'Un millón de personas acompaña el ataúd en silencio. Nadie grita tu nombre. No hace falta.' },
        { texto: 'Prohibirlo y enterrarlo en secreto', efectos: { orden: 4, pueblo: -10, mundo: -8 }, programar: [{ en: 3, titulo: 'La tumba sin nombre', texto: 'Alguien encuentra la tumba sin nombre de Valiente. En una noche se llena de flores. {sombra} manda retirarlas; a la mañana siguiente hay el doble.', efectos: { pueblo: -4 } }], resultado: 'Lo entierras de madrugada, sin familia ni flores. Es la peor decisión que se puede tomar con un mártir, y la tomas.' },
        { texto: 'Asistir tú mismo, de luto', efectos: { pueblo: -4, mundo: 2, cupula: -3 }, resultado: 'Llegas con gafas oscuras y una corona de flores. La multitud se aparta en silencio. Alguien escupe cerca de tus zapatos.' }
      ]
    },
    {
      id: 'huelga_hambre', titulo: 'Huelga de hambre', soloCadena: true,
      texto: 'Ernesto Valiente lleva tres días sin comer en su celda. Dice que no probará bocado hasta que convoques elecciones libres. Cada día, más gente se une a su huelga en las plazas.',
      opciones: [
        { texto: 'Liberarlo', efectos: {}, persona: { id: 'valiente', trato: 'liberar' }, resultado: 'Valiente sale de la cárcel en camilla, débil pero sonriendo. Es más fuerte que nunca.' },
        { texto: 'Alimentarlo a la fuerza', efectos: { orden: 2, mundo: -7, pueblo: -4 }, resultado: 'Las imágenes filtradas de la alimentación forzosa son insoportables de ver. Todo el mundo las ve.' },
        { texto: 'Dejarlo seguir', efectos: { pueblo: -3, mundo: -3 }, cadena: { id: 'huelga_hambre_fin', en: 4 }, resultado: 'Das orden de no hacer nada. En su celda, Valiente sigue escribiendo cartas que alguien saca de la cárcel cada noche.' }
      ]
    },
    {
      id: 'huelga_hambre_fin', titulo: 'Valiente se apaga', soloCadena: true,
      si: e => persona(e, 'valiente') === 'preso',
      texto: 'El médico de la prisión dice que a Ernesto Valiente le quedan horas. La plaza del Palacio está llena de gente con velas y en silencio.',
      opciones: [
        { texto: 'Liberarlo in extremis', efectos: { pueblo: 2 }, persona: { id: 'valiente', trato: 'liberar' }, resultado: 'Una ambulancia se lo lleva entre aplausos. Sobrevive. Tú, políticamente, un poco menos.' },
        { texto: 'Dejarlo morir', efectos: {}, persona: { id: 'valiente', trato: 'matar' }, resultado: 'Ernesto Valiente muere al amanecer. En la plaza, alguien empieza a cantar el himno nacional. Luego lo canta todo el mundo.' }
      ]
    },
    {
      id: 'gobierno_exilio', titulo: 'Un gobierno en el exilio', soloCadena: true,
      texto: 'Desde la capital de un país vecino, Ernesto Valiente anuncia un "Gobierno Legítimo de Valdoria en el exilio". Tres países ya lo reconocen. Su discurso se escucha cada noche en la radio pirata.',
      opciones: [
        { texto: 'Pedir su extradición', efectos: { mundo: -4 }, resultado: 'El país vecino rechaza la petición y le pone escolta a Valiente. Ahora está más protegido que tú.' },
        { texto: 'Invitarlo a volver con garantías', efectos: { pueblo: 5, mundo: 5, orden: -3 }, persona: { id: 'valiente', trato: 'liberar' }, resultado: 'Valiente vuelve entre multitudes. Promete "oposición firme pero pacífica". Veremos cuánto dura la paz.' },
        { texto: 'Ignorarlo', efectos: { pueblo: -2, mundo: -3 }, resultado: 'Haces como si no existiera. Él hace todo lo posible para que no lo consigas.' }
      ]
    },
    {
      id: 'represalias', titulo: 'La Unión Atlántica exige culpables', soloCadena: true,
      texto: 'La Unión Atlántica ha movilizado su flota y exige la entrega inmediata de los responsables de lo ocurrido con su embajador. Plazo: 48 horas. {montiel} tiene el teléfono en una mano y un pañuelo en la otra.',
      opciones: [
        { texto: 'Entregar al ministro del Interior como culpable', efectos: { mundo: 12, orden: -5 }, persona: { id: 'sombra', trato: 'exiliar' }, resultado: '{sombra} es entregado en la frontera con una bolsa de papel en la cabeza. Nadie te cree del todo, pero la crisis se enfría.' },
        { texto: 'Culpar a la oposición', efectos: { mundo: -6, pueblo: -3, orden: 2 }, resultado: 'Nadie en el mundo se lo cree. Dentro del país, tampoco.' },
        { texto: 'Romper relaciones y prepararse', efectos: { mundo: -10, pueblo: 4, tesoro: -6, ejercito: 3 }, resultado: 'Expulsas a todos los diplomáticos de la Unión Atlántica. El país se prepara para lo peor mientras tú das discursos sobre la soberanía.' }
      ]
    },
    {
      id: 'luto_nico', titulo: 'Doña Carmen frente al Palacio', soloCadena: true,
      si: e => vivo(e, 'carmen'),
      texto: 'Doña Carmen se ha sentado frente a la puerta del Palacio con una foto de Nico. No dice nada. No se mueve. Lleva ahí desde las seis de la mañana. Los guardias no saben qué hacer.',
      opciones: [
        { texto: 'Recibirla y pedirle perdón', efectos: { pueblo: 3, cupula: -2 }, animo: { carmen: 10 }, resultado: 'La recibes en tu despacho. Ella te mira a los ojos durante un minuto entero, se levanta y se va sin decir nada.' },
        { texto: 'Que la retiren', efectos: { pueblo: -7, mundo: -4, orden: 2 }, resultado: 'Dos guardias la levantan con cuidado. Pesa muy poco. La foto de ese momento es la más vista del año.' },
        { texto: 'Ignorarla', efectos: { pueblo: -3 }, resultado: 'Doña Carmen vuelve cada día a la misma hora. Cada día hay más gente sentada a su lado.' }
      ]
    },
    {
      id: 'luto_carmen', titulo: 'El entierro de Doña Carmen', soloCadena: true,
      texto: 'El barrio de La Esperanza entierra a Doña Carmen. Van todos sus clientes de cuarenta años, que son casi toda la ciudad. Nico camina delante del ataúd. No llora. Mira hacia el Palacio.',
      opciones: [
        { texto: 'Enviar una corona de flores oficial', efectos: { pueblo: -3 }, animo: { nico: -10 }, resultado: 'Nico coge la corona oficial y la tira al río delante de todos.' },
        { texto: 'Prohibir el entierro multitudinario', efectos: { orden: 3, pueblo: -8, mundo: -3 }, animo: { nico: -30 }, resultado: 'La policía disuelve el cortejo. El ataúd de Doña Carmen queda en mitad de la calle unos minutos. Nadie en Valdoria lo olvidará.' },
        { texto: 'No hacer nada', efectos: { pueblo: -2 }, resultado: 'El entierro dura todo el día. Las arepas del barrio, esa semana, se venden con un lazo negro.' }
      ]
    },
    {
      id: 'luto_ramiro', titulo: 'Los taxistas en duelo', soloCadena: true,
      texto: 'Cinco mil taxis acompañan el entierro de Ramiro. La ciudad entera se paraliza. Sus compañeros han pintado en los capós: "¿Quién mató a Ramiro?".',
      opciones: [
        { texto: 'Abrir una investigación (falsa)', efectos: { pueblo: 1, mundo: 1 }, resultado: 'La investigación concluye en tres días que Ramiro "se suicidó quemando su propio taxi". Nadie se lo cree.' },
        { texto: 'Retirar las licencias de los que protestan', efectos: { orden: 2, pueblo: -6, tesoro: -2 }, resultado: 'La ciudad se queda sin taxis. Y sin paciencia.' }
      ]
    },
    {
      id: 'luto_lucia', titulo: 'Las batas blancas', soloCadena: true,
      texto: 'Todas las enfermeras del país han dejado de trabajar durante una hora en memoria de Lucía. En la puerta de cada hospital hay una bata blanca colgada con su nombre.',
      opciones: [
        { texto: 'Subir el sueldo a las enfermeras', efectos: { tesoro: -6, salud: 5, pueblo: 3 }, resultado: 'Suben los sueldos. Nadie da las gracias. Las batas siguen colgadas.' },
        { texto: 'Descontarles la hora del sueldo', efectos: { salud: -6, pueblo: -6 }, resultado: 'Esa noche, doscientas enfermeras piden el visado para irse del país.' }
      ]
    }
  ];
})(globalThis.RF = globalThis.RF || {});
