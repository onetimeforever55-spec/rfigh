/*
 * EVENTOS
 *  ESPECIALES  combinaciones acción+objeto con consecuencias propias (se suman a las generales)
 *  UMBRALES    lo que pasa cuando una estadística cae demasiado
 *  AZAR        sucesos que el Director de Historia mete para dar ritmo
 *  FINALES     cómo termina tu gobierno
 * "en" es a cuántos días vista ocurre una consecuencia programada.
 */
(function (RF) {
  'use strict';

  RF.ESPECIALES = {
    'PRIVATIZAR:AIRE': {
      efectos: { tesoro: 6, cupula: 4, pueblo: -4, mundo: -6 },
      texto: 'Se instalan medidores de respiración en cada hogar. Tarifa básica: 3 wones por hora. Los asmáticos pagan tarifa premium.',
      programar: [
        { en: 2, titulo: 'Aire embotellado', texto: 'Aparece un mercado negro de aire embotellado en Sadong. Las botellas se venden en la puerta de las escuelas, "sabor montaña".', efectos: { orden: -6, cupula: 3 } },
        { en: 4, titulo: 'Los que no pueden pagar', texto: 'Los hospitales reciben a los primeros ciudadanos que dejaron de "respirar oficialmente" por no pagar. Nadie sabe cómo contarlos en las estadísticas.', efectos: { salud: -8, pueblo: -6, mundo: -5 } }
      ]
    },
    'PROHIBIR:AIRE': {
      efectos: { pueblo: -10, orden: -6, mundo: -10 },
      texto: 'Respirar queda prohibido en todo el territorio. La población sigue respirando, pero ahora a escondidas y con culpa.'
    },
    'NACIONALIZAR:AIRE': {
      efectos: { mundo: -3 },
      texto: 'El aire pasa a ser propiedad del Estado. De momento es gratis. La palabra "de momento" preocupa a todo el mundo.'
    },
    'PRIVATIZAR:AGUA': {
      texto: 'Una empresa del cuñado de {cifuentes} gana la concesión del agua. Casualidad.',
      programar: [{ en: 3, titulo: 'Pozos clandestinos', texto: 'En los barrios pobres se cavan pozos a escondidas. El agua sale turbia. Los niños enferman.', efectos: { salud: -6, orden: -3 } }]
    },
    'PRIVATIZAR:RECURSOS': {
      efectos: { pueblo: -3 },
      texto: 'Una multinacional compra la concesión por una fracción de su valor. {cifuentes} estrena reloj.',
      programar: [{ en: 3, titulo: 'Ríos de colores', texto: 'Los ríos cerca de las minas bajan naranjas. Los pescadores protestan con peces muertos frente a Palacio.', efectos: { salud: -5, pueblo: -4, mundo: -3 } }]
    },
    'PRIVATIZAR:SALUD': {
      programar: [{ en: 3, titulo: 'Hospitales de lujo', texto: 'Los hospitales privatizados reabren con alfombra roja y precios en dólares. En la puerta, una fila de gente que no puede entrar.', efectos: { salud: -7, pueblo: -4, cupula: 3 } }]
    },
    'PROHIBIR:INTERNET': {
      efectos: { orden: 4, mundo: -6, tesoro: -4 },
      texto: 'Se apagan las antenas a medianoche. En los cibercafés, la gente mira pantallas negras como quien mira un pozo.',
      programar: [{ en: 3, titulo: 'Antenas piratas', texto: 'Aparecen antenas piratas en las azoteas. {sombra} calcula que hay una cada tres manzanas.', efectos: { orden: -5, pueblo: -2 } }]
    },
    'PROHIBIR:DIVERSION': {
      texto: 'El Estadio Nacional se cierra con candado. Los niños juegan con latas en la calle, mirando a los lados.',
      programar: [{ en: 2, titulo: 'El partido clandestino', texto: 'La policía interrumpe un partido de fútbol clandestino en un garaje. Había 400 personas. Y dos policías jugando.', efectos: { orden: -4, pueblo: -3 } }]
    },
    'PROHIBIR:VICIOS': {
      programar: [{ en: 3, titulo: 'Contrabando', texto: 'El contrabando florece en la frontera. Los contrabandistas mandan un regalo a Palacio para agradecer el negocio.', efectos: { orden: -6, cupula: 4, tesoro: -2 } }]
    },
    'PROHIBIR:MASCOTAS': {
      efectos: { pueblo: -6 },
      texto: 'Los perros de Corea del Norte pasan a la clandestinidad. En muchas casas, el armario ladra.'
    },
    'PROHIBIR:LIDER': {
      efectos: { cupula: -8, mundo: -6, orden: -5 },
      texto: 'El Líder Supremo se prohíbe a sí mismo. Los juristas pasan la noche discutiendo si el país sigue teniendo gobierno.'
    },
    'PROHIBIR:RELIGION': {
      programar: [{ en: 3, titulo: 'Misas en los sótanos', texto: 'Se celebran misas clandestinas en sótanos y garajes. Los curas usan bigote falso.', efectos: { pueblo: -4, orden: -3 } }]
    },
    'CASTIGAR:OPOSICION': {
      texto: 'Las furgonetas negras hacen tres viajes esa noche. A la mañana siguiente, varias sillas del Parlamento están vacías.',
      programar: [{ en: 3, titulo: 'Mártires', texto: 'Las fotos de los detenidos aparecen pegadas en las paredes con la palabra "¿DÓNDE ESTÁN?". Las arrancan. Vuelven a aparecer.', efectos: { pueblo: -6, mundo: -5 } }]
    },
    'CASTIGAR:CRIMEN': {
      efectos: { orden: 5, pueblo: 3 },
      texto: 'Las cárceles se llenan en una semana. Algunos detenidos incluso eran delincuentes.',
      programar: [{ en: 4, titulo: 'Motín en La Roca', texto: 'Motín en la prisión de La Roca: caben 800 presos y hay 3.000. Los amotinados piden colchones y una entrevista contigo.', efectos: { orden: -5, tesoro: -3 } }]
    },
    'CASTIGAR:PRENSA': {
      efectos: { mundo: -8 },
      texto: 'Los corresponsales extranjeros hacen las maletas. El último en irse deja un artículo programado para publicarse al llegar a casa.'
    },
    'NACIONALIZAR:EMPRESAS': {
      programar: [{ en: 2, titulo: 'Fuga de capitales', texto: 'Los millonarios huyen con maletas llenas. En el aeropuerto hay tanto tráfico de jets privados que se forma un atasco en el aire.', efectos: { tesoro: -6, mundo: -4 } }]
    },
    'NACIONALIZAR:RECURSOS': {
      programar: [{ en: 2, titulo: 'Ofertas misteriosas', texto: 'Tres potencias extranjeras ofrecen "ayuda técnica" para explotar tu petróleo. {montiel} dice que la ayuda viene con portaaviones.', efectos: { mundo: -4, tesoro: 4 } }]
    },
    'NACIONALIZAR:EXTRANJEROS': {
      efectos: { mundo: 8, pueblo: 2 },
      texto: 'Todos los extranjeros reciben la nacionalidad norcoreana, la quieran o no. Un turista japonés descubre que ahora debe hacer el servicio militar.'
    },
    'OBLIGAR:EJERCITO': {
      efectos: { ejercito: 8, pueblo: -6, tesoro: -3 },
      texto: 'Servicio militar obligatorio desde los 16 años. Los cuarteles se llenan de adolescentes que no saben atarse las botas.'
    },
    'OBLIGAR:RELIGION': {
      efectos: { mundo: -4 },
      texto: 'Misa obligatoria los domingos. Los curas están encantados. Los ateos rezan en silencio, por si acaso.'
    },
    'SUBSIDIAR:EJERCITO': {
      texto: 'Los soldados cobran doble este mes. Los tanques brillan como nunca.'
    },
    'SUBSIDIAR:COMIDA': {
      programar: [{ en: 5, titulo: 'Las colas', texto: 'La comida subsidiada escasea. Las colas en los mercados dan la vuelta a la manzana. Alguien vende su puesto en la cola.', efectos: { tesoro: -3, orden: -2 } }]
    },
    'RECORTAR:EJERCITO': {
      efectos: { ejercito: -10 },
      programar: [{ en: 3, titulo: 'Ruido de sables', texto: 'Los oficiales se quejan de que los tanques no tienen gasolina. Algunos tanques, sin embargo, se han movido de sitio.', efectos: { ejercito: -5 } }]
    },
    'GLORIFICAR:LIDER': {
      texto: 'Se inaugura una estatua tuya de 30 metros en la Plaza Mayor. La nariz ha salido un poco grande.',
      programar: [{ en: 3, titulo: 'La estatua', texto: 'Amanece la estatua con un bigote pintado y un cartel que dice "¿Y el pan?". Tardan dos días en limpiarla.', efectos: { pueblo: -2, orden: -2 } }]
    },
    'LEGALIZAR:VICIOS': {
      efectos: { tesoro: 4 },
      texto: 'Se abren dispensarios estatales. Hacienda cobra impuesto por cada gramo y por cada botella.'
    },
    'LEGALIZAR:CRIMEN': {
      efectos: { orden: -12, pueblo: -6 },
      texto: 'Robar pasa a ser legal. Los ladrones, desconcertados, fundan un sindicato para no perder su identidad profesional.'
    },
    'LEGALIZAR:ARMAS': {
      efectos: { orden: -6, ejercito: -3 },
      texto: 'Las armerías abren 24 horas. Kwang-ho se compra una "por si acaso" y la guarda en la guantera del taxi.'
    },
    'INVERTIR:SALUD': {
      texto: 'Se anuncian tres hospitales nuevos. De momento hay tres carteles y una primera piedra.'
    }
  };

  // Alertas: cuando algo cruza una línea roja ocurre esto (una vez, hasta que se recupere).
  RF.UMBRALES = [
    { id: 'cacerolazo', stat: 'felicidad', bajo: 25, titulo: 'Aplausos tibios', texto: 'En el desfile de hoy, la multitud aplaude medio segundo tarde. En Corea del Norte eso es un grito. Tus guardaespaldas lo notan. Tú también.', efectos: { estabilidad: -4 } },
    { id: 'sables', stat: 'estabilidad', bajo: 25, titulo: 'Ruido de sables', texto: 'Tres generales dejan de ir a las cacerías de {garrote}. En el ejército, eso significa algo. Los tanques cambian de sitio por las noches.', efectos: { estabilidad: -2 } },
    { id: 'arcas', stat: 'dinero', bajo: 0, titulo: 'Arcas vacías', texto: 'Hacienda no puede pagar los sueldos de los funcionarios. Los maestros cobran en vales de gasolina y los policías, en promesas.', efectos: { felicidad: -3, estabilidad: -2 } },
    { id: 'precios', stat: 'inflacion', alto: 25, titulo: 'Precios por las nubes', texto: 'El pan cuesta cada semana más. En el mercado, los precios del arroz se cambian dos veces al día. La gente compra por miedo a que mañana cueste más.', efectos: { felicidad: -3 } },
    { id: 'hiper', stat: 'inflacion', alto: 100, titulo: 'Hiperinflación', texto: 'Los billetes ya no valen el papel en el que están impresos. La gente paga el café con huevos y el alquiler con gallinas. Los niños juegan con fajos de wones.', efectos: { felicidad: -6, estabilidad: -5 } }
  ];

  // Eventos del Director de Historia. tono: +1 bueno para ti, -1 malo.
  RF.AZAR = [
    { tono: -1, titulo: 'Terremoto', texto: 'Un terremoto sacude el sur del país. Las casas de adobe caen; el Palacio ni se mueve.', efectos: { salud: -6, tesoro: -6 } },
    { tono: 1, titulo: '¡Petróleo!', texto: 'Un campesino encuentra petróleo mientras cavaba un pozo. Le das una medalla y le quitas el terreno.', efectos: { tesoro: 10, mundo: 2 } },
    { tono: -1, titulo: 'Escándalo familiar', texto: 'Tu sobrino choca un coche oficial contra una fuente, borracho y en calzoncillos. El video se hace viral.', efectos: { pueblo: -5 } },
    { tono: 1, titulo: 'Gloria deportiva', texto: 'La selección gana la Copa Regional. El país entero sale a la calle. Durante una semana, nadie se acuerda de sus problemas.', efectos: { pueblo: 8 } },
    { tono: 1, titulo: 'Visita estelar', texto: 'Un cantante famoso da un concierto en la capital y se hace una foto contigo. No sabía quién eras.', efectos: { pueblo: 3, mundo: 3 } },
    { tono: -1, titulo: 'Sequía', texto: 'No llueve desde hace dos meses. Las cosechas se secan y el precio del maíz se dispara.', efectos: { salud: -3, tesoro: -4, pueblo: -2 } },
    { tono: -1, titulo: 'Filtración', texto: 'Unos hackers publican tus mensajes privados. Lo peor no son los secretos de Estado: son tus audios cantando boleros.', efectos: { mundo: -4, pueblo: -3 } },
    { tono: 1, titulo: 'Cumbre internacional', texto: 'Corea del Norte es elegida sede de una cumbre regional. {montiel} está feliz. Los presidentes vecinos alaban tu buffet.', efectos: { mundo: 6 } },
    { tono: -1, titulo: 'Plaga de palomas', texto: 'Una plaga de palomas invade la capital. {paredes} culpa a un país vecino. El país vecino dice que no tiene palomas.', efectos: { salud: -2, orden: -2 } },
    { tono: -1, titulo: 'Crisis del carbón', texto: 'China deja de comprar carbón "por motivos técnicos". Tu principal exportación se amontona en el puerto de Nampo.', efectos: { tesoro: -6 } },
    { tono: 1, titulo: 'Remesas récord', texto: 'Los norcoreanos que emigraron envían más dinero que nunca. Irónicamente, tu mejor política económica es que la gente se vaya.', efectos: { tesoro: 6 } },
    { tono: 1, titulo: 'Rumor de tu muerte', texto: 'Corre el rumor de que has muerto. Sales al balcón a saludar y la gente, por la sorpresa, aplaude.', efectos: { pueblo: 3, orden: 2 } },
    { tono: -1, titulo: 'Huracán', texto: 'Un huracán arrasa la costa. La ayuda internacional llega, pero la mitad desaparece en el puerto.', efectos: { salud: -4, tesoro: -5, cupula: 3 } },
    { tono: 1, titulo: 'Premio inesperado', texto: 'Una revista extranjera te nombra "Líder más fotogénico del año". {paredes} lo manda imprimir en todas las escuelas.', efectos: { mundo: 3, pueblo: 1 } }
  ];

  RF.FINALES = {
    pueblo: { titulo: 'REVOLUCIÓN', texto: 'La plaza se llena, luego las calles, luego los pasillos de Palacio. Escapas por un túnel secreto que resulta llevar a la cocina. Te reconoce un cocinero. Tu gobierno termina con un delantal puesto y las manos en alto.' },
    ejercito: { titulo: 'GOLPE DE ESTADO', texto: 'A las cuatro de la madrugada, los tanques rodean Palacio. El {n_garrote} aparece en la televisión delante de tu retrato, que alguien ya ha descolgado a medias.' },
    cupula: { titulo: 'TRAICIÓN EN PALACIO', texto: 'La cena de gala tenía un postre especial solo para ti. {n_cifuentes} brinda "por la estabilidad" mientras te desplomas sobre la tarta.' },
    tesoro: { titulo: 'BANCARROTA', texto: 'Corea del Norte no puede pagar ni la luz del Palacio. Los acreedores internacionales toman el control del país. Te ofrecen un puesto de asesor, sin sueldo.' },
    salud: { titulo: 'COLAPSO SANITARIO', texto: 'La epidemia llega a Palacio. Tus ministros huyen. Pasas tus últimos días de gobierno en cuarentena, hablando con tu propio retrato.' },
    orden: { titulo: 'ANARQUÍA', texto: 'Nadie obedece a nadie. Cada barrio tiene su propio presidente. En tu despacho han montado un mercadillo. Alguien vende tu sillón.' },
    mundo: { titulo: 'INTERVENCIÓN EXTRANJERA', texto: 'Una coalición internacional desembarca "para restaurar la democracia". Te detienen en pijama. La foto da la vuelta al mundo.' },
    elecciones_ganadas: { titulo: 'REELECCIÓN LIMPIA', texto: 'Al final de tu mandato convocas elecciones. Nadie se lo cree, pero ganas. Limpiamente. La oposición pide un recuento y, para su sorpresa, vuelves a ganar.' },
    elecciones_amanadas: { titulo: 'REELECCIÓN CON EL 99,7%', texto: 'Convocas elecciones. {sombra} se encarga del conteo. Ganas con el 99,7% de los votos, incluidos los de varios muertos y un perro. El mundo protesta un rato y luego se olvida.' },
    hiperinflacion: { titulo: 'COLAPSO DEL WON', texto: 'La inflación supera el mil por ciento. Nadie acepta wones: ni los soldados, ni los panaderos, ni tu cocinero. Una mañana llegas a Palacio y la guardia se ha ido a trabajar a otra parte. Tu gobierno termina sin un solo disparo, simplemente porque ya nadie cobra por obedecerte.' },
    destituido: { titulo: 'DESTITUIDO', texto: 'El Congreso vota tu destitución. {n_sombra} te acompaña hasta la puerta del Palacio con una caja de cartón con tus cosas: la banda presidencial no entra. Una semana después, un juez te cita a declarar. Luego otro. Luego todos.' },
    dimision: { titulo: 'DIMISIÓN', texto: 'Dimites en un mensaje de tres minutos, sin mirar a cámara. Te vas a una casa de campo con vistas al mar y un abogado muy caro. En Corea del Norte, algunos te echarán de menos. La mayoría, no.' },
    perpetuo: { titulo: 'EL PODER SIN FIN', texto: 'Treinta turnos después sigues en el Palacio. No hubo elecciones, ni nadie se atreve ya a pedirlas. Los niños que nacieron con tu llegada no conocen otra cara en los billetes. Has ganado, si a esto se le puede llamar ganar.' },
    elecciones_perdidas: { titulo: 'DERROTA EN LAS URNAS', texto: 'Convocas elecciones convencido de ganar. Pierdes por goleada. Te vas al exilio con tres maletas y la estatua de 30 metros, que no cabe en el avión.' }
  };
})(globalThis.RF = globalThis.RF || {});
