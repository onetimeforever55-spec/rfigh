/*
 * SINÓNIMOS Y JERGA
 * El Intérprete traduce estas palabras antes de pensar. Así entiende "tombos", "birras" o "banear"
 * sin tener que aprender frases nuevas. Claves sin tildes ni mayúsculas.
 */
(function (RF) {
  'use strict';

  RF.SINONIMOS = {
    // Fuerzas de seguridad
    milicos: 'militares', milico: 'militar', guachos: 'soldados', tombos: 'policias', tombo: 'policia',
    pacos: 'policias', paco: 'policia', pasma: 'policia', polis: 'policias', poli: 'policia', maderos: 'policias',
    cana: 'policia', chota: 'policia', pitufos: 'policias', cuarteles: 'militares',
    // Dinero y trabajo
    plata: 'dinero', lana: 'dinero', guita: 'dinero', pasta: 'dinero', billete: 'dinero', varo: 'dinero',
    chamba: 'trabajo', curro: 'trabajo', pega: 'trabajo', laburo: 'trabajo', laburantes: 'trabajadores',
    chambeadores: 'trabajadores', currantes: 'trabajadores', sueldito: 'sueldo', quincena: 'sueldo',
    // Bebida, vicios
    birras: 'cervezas', birra: 'cerveza', chelas: 'cervezas', chela: 'cerveza', pola: 'cerveza', polas: 'cervezas',
    guaro: 'alcohol', trago: 'alcohol', tragos: 'alcohol', copas: 'alcohol', pucho: 'cigarro', puchos: 'cigarros',
    faso: 'cigarro', porro: 'marihuana', porros: 'marihuana', mota: 'marihuana', hierba: 'marihuana', weed: 'marihuana',
    cannabis: 'marihuana', cocaina: 'drogas', perico: 'drogas', vapeo: 'tabaco', vapear: 'fumar', vapers: 'tabaco',
    // Tecnología
    celu: 'celular', celus: 'celulares', cel: 'celular', movil: 'moviles', compu: 'computadoras', compus: 'computadoras',
    ordenadores: 'computadoras', pc: 'computadoras', redes: 'redes sociales', insta: 'instagram', face: 'facebook',
    tiktoks: 'tiktok', wasap: 'whatsapp', guasap: 'whatsapp', ia: 'inteligencia artificial', chatgpt: 'inteligencia artificial',
    // Transporte
    bondi: 'autobus', bondis: 'autobuses', guagua: 'autobus', guaguas: 'autobuses', micro: 'autobus', micros: 'autobuses',
    colectivo: 'autobus', colectivos: 'autobuses', buses: 'autobuses', bus: 'autobus', camioneta: 'coches',
    auto: 'coche', autos: 'coches', nafta: 'gasolina', bencina: 'gasolina',
    // Gente
    chamos: 'jovenes', chavos: 'jovenes', pibes: 'jovenes', morros: 'jovenes', chicos: 'jovenes', cabros: 'jovenes',
    viejitos: 'jubilados', abuelos: 'jubilados', ancianos: 'jubilados', ricachones: 'ricos', pelucones: 'ricos',
    fresas: 'ricos', pijos: 'ricos', cuicos: 'ricos', chetos: 'ricos', burgueses: 'ricos', patrones: 'empresarios',
    rateros: 'ladrones', choros: 'ladrones', malandros: 'delincuentes', pandilleros: 'pandillas',
    maras: 'pandillas', mareros: 'pandillas', sicarios: 'asesinos', periodicos: 'periodicos',
    migrantes: 'inmigrantes', gringos: 'extranjeros', guiris: 'extranjeros',
    // Comida
    tortillas: 'comida', pupusas: 'comida', empanadas: 'comida', tacos: 'comida', papas: 'comida', frijoles: 'comida',
    arepa: 'arepas', morfi: 'comida', papeo: 'comida', rancho: 'comida',
    // Ocio
    fut: 'futbol', futbolito: 'futbol', fucho: 'futbol', rumba: 'fiestas', parranda: 'fiestas', perreo: 'reguetón',
    reggaeton: 'reguetón', regueton: 'reguetón', trap: 'musica', netflix: 'cine', series: 'cine', telenovelas: 'television',
    videojuego: 'videojuegos', play: 'videojuegos', fortnite: 'videojuegos', lol: 'videojuegos',
    // Verbos
    banear: 'prohibir', baneen: 'prohiban', baneo: 'prohibir', cancelar: 'prohibir', cancelen: 'prohiban',
    petar: 'prohibir', clausuren: 'cierren', encanar: 'encarcelar', enchironar: 'encarcelar', trancar: 'encarcelar',
    fusilarlos: 'fusilar', matarlos: 'matar', encerrarlos: 'encerrar', regalarles: 'regalar', quitarles: 'quitar',
    cobrarles: 'cobrar', subirles: 'subir', bajarles: 'bajar', darles: 'dar', mandarlos: 'deportar',
    privatizen: 'privatizar', privaticen: 'privatizar', nacionalicen: 'nacionalizar', expropien: 'expropiar',
    rebajar: 'bajar', rebajen: 'bajen', aumenten: 'suban', aumentar: 'subir', incrementar: 'subir',
    // Otros
    tele: 'television', diarios: 'periodicos', diario: 'periodico', cole: 'colegio', coles: 'colegios', uni: 'universidad',
    profes: 'profesores', profe: 'profesor', maestras: 'maestros', doctores: 'medicos', doctoras: 'medicos',
    hospis: 'hospitales', perritos: 'perros', gatitos: 'gatos', michis: 'gatos', lomitos: 'perros', firulais: 'perros',
    mascota: 'mascotas', iglesia: 'iglesias', pastores: 'curas', evangelicos: 'religion',
    mio: 'mi', mia: 'mi', conmigo: 'mi'
  };

  // Expresiones de varias palabras (se aplican antes que las palabras sueltas).
  RF.SINONIMOS_FRASES = [
    [/\bpena capital\b/g, 'pena de muerte'],
    [/\bmano de obra\b/g, 'trabajadores'],
    [/\bclase (obrera|trabajadora)\b/g, 'trabajadores'],
    [/\bclase alta\b/g, 'ricos'],
    [/\bel uno por ciento\b/g, 'ricos'],
    [/\bfuerzas del orden\b/g, 'policia'],
    [/\bcuerpos de seguridad\b/g, 'policia'],
    [/\bgente de la calle\b/g, 'pobres'],
    [/\bsin techo\b/g, 'pobres'],
    [/\bnueve de la manana\b/g, 'horario'],
    [/\bdia libre\b/g, 'feriados'],
    [/\bdias libres\b/g, 'feriados'],
    [/\bfin de semana\b/g, 'domingos'],
    [/\bse acabaron\b/g, 'se acabo'],
    [/\bque se jodan\b/g, 'castigar'],
    [/\ba la carcel\b/g, 'carcel para'],
    [/\bal paredon\b/g, 'fusilar a'],
    [/\bpaso libre\b/g, 'permitir'],
    [/^(ya )?no mas\b/, 'prohibir'],
    [/^basta de\b/, 'prohibir'],
    [/^abajo (con )?/, 'prohibir '],
    [/^viva\b/, 'homenaje a'],
    [/^muerte a\b/, 'ejecutar a'],
    [/\bnarco ?(estado|pais|republica|gobierno)\b/g, 'economia basada en el narcotrafico'],
    [/\bestado narco\b/g, 'economia basada en el narcotrafico'],
    [/\bescuadrones? de la muerte\b/g, 'escuadron de la muerte'],
    [/\bescuadra de represion\b/g, 'escuadra de represion'],
    [/\bdolarizar\b/g, 'prohibir el valdo'],
    [/\bdevaluar\b/g, 'recortar'],
    [/\bimprimir (mas )?(dinero|billetes|plata)\b/g, 'imprimir dinero nuevo']
  ];
})(globalThis.RF = globalThis.RF || {});
