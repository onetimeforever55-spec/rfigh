/*
 * GÉNESIS · LOS DATOS DEL MUNDO
 * Las eras de la historia humana real, sus inventos, el carácter de los pueblos, cómo se nombran
 * y la biblioteca de porqués: mecanismos reales con su precedente histórico, para que la crónica
 * explique cada cosa que pasa en el mundo.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO = RF.MUNDO || {};

  // Cada era: cuántos años dura un turno cuando el pueblo más avanzado está en ella, cuánta gente
  // alimenta cada casilla (cap), cuánto pesa en la guerra (fuerza) y cuánta ciencia hace falta para llegar.
  M.ERAS = [
    { nombre: 'Neolítico', con: 'el Neolítico', corto: 'NEOLÍTICO', anios: 100, aniosLento: 8, cap: 1.0, fuerza: 1.0, umbral: 0, inventos: ['la agricultura', 'la cerámica', 'el arado de madera'] },
    { nombre: 'Edad del Bronce', con: 'la Edad del Bronce', corto: 'BRONCE', desde: -3500, anios: 100, aniosLento: 25, cap: 1.35, fuerza: 1.4, umbral: 16, inventos: ['la escritura', 'la rueda', 'el bronce', 'el calendario'] },
    { nombre: 'Edad del Hierro', con: 'la Edad del Hierro', corto: 'HIERRO', desde: -1500, anios: 50, aniosLento: 25, cap: 1.7, fuerza: 2.0, umbral: 135, inventos: ['el hierro', 'el alfabeto', 'la moneda'] },
    { nombre: 'Antigüedad clásica', con: 'la Antigüedad clásica', corto: 'CLÁSICA', desde: -900, anios: 50, aniosLento: 25, cap: 2.0, fuerza: 2.6, umbral: 500, inventos: ['la filosofía', 'el acueducto', 'el derecho escrito', 'el hormigón'] },
    { nombre: 'Edad Media', con: 'la Edad Media', corto: 'MEDIEVAL', desde: 300, anios: 50, aniosLento: 20, cap: 2.3, fuerza: 3.2, umbral: 1320, inventos: ['el molino de agua', 'la brújula', 'la universidad', 'el estribo'] },
    { nombre: 'Renacimiento', con: 'el Renacimiento', corto: 'RENACIMIENTO', desde: 1350, anios: 25, aniosLento: 10, cap: 3.0, fuerza: 5.0, umbral: 2200, inventos: ['la imprenta', 'la pólvora', 'la banca', 'la carabela'] },
    { nombre: 'Revolución Industrial', con: 'la Revolución Industrial', corto: 'INDUSTRIAL', desde: 1700, anios: 15, aniosLento: 6, cap: 5.0, fuerza: 9.0, umbral: 2900, inventos: ['la máquina de vapor', 'el ferrocarril', 'la fábrica'] },
    { nombre: 'Era Moderna', con: 'la Era Moderna', corto: 'MODERNA', desde: 1850, anios: 8, aniosLento: 4, cap: 8.0, fuerza: 16, umbral: 3100, inventos: ['la electricidad', 'las vacunas', 'la radio', 'el avión'] },
    { nombre: 'Segunda Guerra Mundial', con: 'la Segunda Guerra Mundial', corto: 'II GUERRA MUNDIAL', desde: 1930, anios: 4, aniosLento: 1, cap: 12, fuerza: 30, umbral: 3300, inventos: ['la ametralladora', 'el tanque', 'el radar'] }
  ];
  // Las cuatro fases de la técnica: cada una trae sus edificios y su manera de guerrear. El techo es la
  // Segunda Guerra Mundial (fusiles, ametralladoras, tanques): no hay bomba atómica.
  M.FASES = [
    { nombre: 'Tribal', eras: [0, 1], resumen: 'chozas, molino, empalizadas, garrotes, lanzas y hondas' },
    { nombre: 'Medieval', eras: [2, 3, 4], resumen: 'cuarteles, arquerías, castillos de piedra, espadas, armaduras y arcos' },
    { nombre: 'Pólvora', eras: [5, 6], resumen: 'fortalezas abaluartadas con cañones, arcabuces y mosquetes' },
    { nombre: 'Guerras Mundiales', eras: [7, 8], resumen: 'búnkeres, nidos de ametralladoras, fusiles y tanques' }
  ];
  M.fase = era => (era <= 1 ? 0 : era <= 4 ? 1 : era <= 6 ? 2 : 3);

  /*
   * EL ÁRBOL DE LA TÉCNICA: cada era tiene sus tecnologías, que se investigan una a una (el jugador elige el orden,
   * «investigad la rueda»; la IA, según su carácter). Una era nueva solo llega cuando se han dominado todas las
   * de la anterior (y, en la historia real, cuando su fecha lo permite). Cada una cambia algo de verdad:
   *  lena/cosecha/piedra: +unidades por árbol, gavilla o roca · casa: +camas por casa · obra: obras más rápidas ·
   *  ciencia/oro/comercio: +% · ataque/defensa: +% en combate · vida: +puntos de vida · granero/ganado: +% de tope ·
   *  estab: +estabilidad · caza: más comida al cazar y pescar.
   */
  M.TECNOLOGIAS = [
    { id: 'hachas', era: 0, nombre: 'Hachas de piedra pulida', invento: 'el hacha pulida', efecto: { lena: 1 }, texto: '+1 de madera por árbol' },
    { id: 'agricultura', era: 0, nombre: 'Agricultura', invento: 'la agricultura', efecto: { cosecha: 1 }, texto: '+1 de trigo por gavilla' },
    { id: 'ceramica', era: 0, nombre: 'Cerámica', invento: 'la cerámica', efecto: { granero: 0.4 }, texto: 'graneros un 40 % más grandes' },
    { id: 'pastoreo', era: 0, nombre: 'Pastoreo', invento: 'el pastoreo', efecto: { ganado: 0.4, caza: 0.3 }, texto: 'rebaños un 40 % mayores, mejor caza' },
    { id: 'rueda', era: 1, nombre: 'La rueda', invento: 'la rueda', efecto: { comercio: 0.3, obra: 0.15 }, texto: 'comercio +30 %, obras más rápidas' },
    { id: 'escritura', era: 1, nombre: 'Escritura', invento: 'la escritura', efecto: { ciencia: 0.12 }, texto: 'investigación +12 %' },
    { id: 'bronce', era: 1, nombre: 'Fundición de bronce', invento: 'el bronce', efecto: { ataque: 0.1 }, texto: 'daño +10 %' },
    { id: 'adobe', era: 1, nombre: 'Ladrillo de adobe', invento: 'el ladrillo', efecto: { casa: 1 }, texto: '+1 cama por casa' },
    { id: 'hierro', era: 2, nombre: 'Forja de hierro', invento: 'el hierro', efecto: { ataque: 0.1, piedra: 1 }, texto: 'daño +10 %, +1 de piedra por roca' },
    { id: 'moneda', era: 2, nombre: 'La moneda', invento: 'la moneda', efecto: { oro: 0.25 }, texto: 'impuestos +25 %' },
    { id: 'arado', era: 2, nombre: 'Arado de hierro', invento: 'el arado de hierro', efecto: { cosecha: 1 }, texto: '+1 de trigo por gavilla' },
    { id: 'murallas', era: 2, nombre: 'Murallas', invento: 'las murallas', efecto: { defensa: 0.1 }, texto: 'armaduras +10 %' },
    { id: 'acueducto', era: 3, nombre: 'Acueductos', invento: 'el acueducto', efecto: { estab: 3, casa: 1 }, texto: '+3 de estabilidad, +1 cama por casa' },
    { id: 'filosofia', era: 3, nombre: 'Filosofía', invento: 'la filosofía', efecto: { ciencia: 0.15 }, texto: 'investigación +15 %' },
    { id: 'derecho', era: 3, nombre: 'Derecho escrito', invento: 'el derecho escrito', efecto: { estab: 3, oro: 0.1 }, texto: '+3 de estabilidad, impuestos +10 %' },
    { id: 'hormigon', era: 3, nombre: 'Hormigón', invento: 'el hormigón', efecto: { obra: 0.2, piedra: 1 }, texto: 'obras más rápidas, +1 de piedra por roca' },
    { id: 'molino_agua', era: 4, nombre: 'Molino de agua', invento: 'el molino de agua', efecto: { cosecha: 1 }, texto: '+1 de trigo por gavilla' },
    { id: 'universidad', era: 4, nombre: 'Universidades', invento: 'la universidad', efecto: { ciencia: 0.15 }, texto: 'investigación +15 %' },
    { id: 'estribo', era: 4, nombre: 'El estribo', invento: 'el estribo', efecto: { ataque: 0.1, vida: 10 }, texto: 'daño +10 %, +10 de vida' },
    { id: 'gremios', era: 4, nombre: 'Gremios', invento: 'los gremios', efecto: { comercio: 0.3, oro: 0.1 }, texto: 'comercio +30 %, impuestos +10 %' },
    { id: 'imprenta', era: 5, nombre: 'Imprenta', invento: 'la imprenta', efecto: { ciencia: 0.2 }, texto: 'investigación +20 %' },
    { id: 'polvora', era: 5, nombre: 'Pólvora', invento: 'la pólvora', efecto: { ataque: 0.15 }, texto: 'daño +15 %' },
    { id: 'banca', era: 5, nombre: 'Banca', invento: 'la banca', efecto: { oro: 0.3 }, texto: 'impuestos +30 %' },
    { id: 'carabela', era: 5, nombre: 'Carabela', invento: 'la carabela', efecto: { comercio: 0.3, caza: 0.3 }, texto: 'comercio +30 %, mejor pesca' },
    { id: 'vapor', era: 6, nombre: 'Máquina de vapor', invento: 'la máquina de vapor', efecto: { obra: 0.3, lena: 1 }, texto: 'obras mucho más rápidas, +1 de madera' },
    { id: 'ferrocarril', era: 6, nombre: 'Ferrocarril', invento: 'el ferrocarril', efecto: { comercio: 0.4 }, texto: 'comercio +40 %' },
    { id: 'fabrica', era: 6, nombre: 'Fábricas', invento: 'la fábrica', efecto: { piedra: 2 }, texto: '+2 de piedra y metal por roca' },
    { id: 'abonos', era: 6, nombre: 'Abonos químicos', invento: 'los abonos', efecto: { cosecha: 1, granero: 0.3 }, texto: '+1 de trigo, graneros +30 %' },
    { id: 'electricidad', era: 7, nombre: 'Electricidad', invento: 'la electricidad', efecto: { ciencia: 0.2, estab: 3 }, texto: 'investigación +20 %, +3 de estabilidad' },
    { id: 'vacunas', era: 7, nombre: 'Vacunas', invento: 'las vacunas', efecto: { vida: 15, estab: 2 }, texto: '+15 de vida, +2 de estabilidad' },
    { id: 'radio', era: 7, nombre: 'Radio', invento: 'la radio', efecto: { estab: 2, ciencia: 0.1 }, texto: '+2 de estabilidad, investigación +10 %' },
    { id: 'aviacion', era: 7, nombre: 'Aviación', invento: 'el avión', efecto: { ataque: 0.1 }, texto: 'daño +10 %' },
    { id: 'ametralladora', era: 8, nombre: 'Ametralladora', invento: 'la ametralladora', efecto: { defensa: 0.15 }, texto: 'armaduras +15 %' },
    { id: 'tanque', era: 8, nombre: 'Carro de combate', invento: 'el tanque', efecto: { ataque: 0.15 }, texto: 'daño +15 %' },
    { id: 'radar', era: 8, nombre: 'Radar', invento: 'el radar', efecto: { defensa: 0.1, estab: 2 }, texto: 'armaduras +10 %, +2 de estabilidad' }
  ];
  // Dónde se investiga cada tecnología (como en Age of Empires: cada edificio, sus mejoras) y lo que cuesta en recursos.
  const LUGAR_DE = t => { const e = t.efecto;
    if (t.id === 'carabela') return 'puerto';
    if (e.cosecha || e.granero || e.ganado) return 'molino';
    if (e.ataque || e.defensa || e.vida) return t.era >= 1 ? 'cuartel' : 'plaza';
    if (e.ciencia) return t.era >= 1 ? 'saber' : 'plaza';
    if (e.estab && t.era >= 1) return 'templo';
    return 'plaza'; };
  const BASE_COSTE = era => Math.round(18 * Math.pow(1 + era, 1.45));
  for (const t of M.TECNOLOGIAS) {
    t.lugar = LUGAR_DE(t);
    const b = BASE_COSTE(t.era), oro = t.era >= 1;
    t.precio = t.lugar === 'molino' ? { madera: Math.round(b * 0.7), oro: oro ? Math.round(b * 0.3) : 0 }
      : t.lugar === 'templo' || t.lugar === 'saber' ? { comida: Math.round(b * 0.5), oro: Math.round(b * 0.5) }
      : t.lugar === 'cuartel' ? { madera: Math.round(b * 0.5), oro: Math.round(b * 0.4), metal: t.era >= 2 ? Math.round(b * 0.1) : 0 }
      : t.lugar === 'puerto' ? { madera: Math.round(b * 0.6), oro: Math.round(b * 0.5) }
      : { comida: Math.round(b * 0.6), madera: Math.round(b * 0.5), oro: oro ? Math.round(b * 0.2) : 0 };
    // Desde la Revolución Industrial, la ciencia ya no se paga con madera (la madera queda para fabricar y
    // construir): se paga con carbón, metal y oro.
    if (t.era >= 6 && t.precio.madera) {
      const mad = t.precio.madera; delete t.precio.madera;
      t.precio.carbon = (t.precio.carbon || 0) + Math.round(mad * 0.5);
      t.precio.metal = (t.precio.metal || 0) + Math.round(mad * 0.15);
      t.precio.oro = (t.precio.oro || 0) + Math.round(mad * 0.2);
    }
    for (const k of Object.keys(t.precio)) if (!t.precio[k]) delete t.precio[k];
  }
  M.LUGARES = { saber: 'la casa del saber', plaza: 'la plaza', molino: 'el molino', templo: 'el templo', cuartel: 'el cuartel', puerto: 'el puerto' };
  /*
   * SUBIR DE EDAD, como en Age of Empires: no llega sola. Hace falta el saber acumulado (la ciencia de los
   * eruditos), su fecha (en la historia real), unos edificios o un tamaño de asentamiento, y pagar el precio;
   * luego tarda unos turnos. La IA sube sola cuando puede; el jugador lo ordena («avanzad de edad»).
   */
  M.EDADES = [
    null,
    { comida: 20, madera: 15, pide: { nivel: 1 }, texto: 'ser una aldea' },
    { comida: 35, oro: 20, pide: { nivel: 2, obra: 'templo' }, texto: 'ser un pueblo con templo' },
    { comida: 50, oro: 40, piedra: 15, pide: { nivel: 2, obra: 'cuartel' }, texto: 'tener un cuartel' },
    { comida: 70, oro: 65, piedra: 25, pide: { nivel: 3 }, texto: 'ser una villa' },
    { comida: 90, oro: 95, pide: { nivel: 3, obra: 'castillo' }, texto: 'tener un castillo' },
    { comida: 110, oro: 130, metal: 15, pide: { nivel: 3 }, texto: 'ser una villa' },
    { comida: 130, oro: 170, metal: 30, pide: { nivel: 4 }, texto: 'ser una ciudad' },
    { comida: 150, oro: 210, metal: 45, pide: { nivel: 4 }, texto: 'ser una ciudad' }
  ];
  // La casa del saber de cada época, donde estudian los eruditos.
  M.CASA_SABER = era => era <= 1 ? 'cabaña del chamán' : era <= 3 ? 'academia' : era === 4 ? 'monasterio' : era === 5 ? 'universidad' : 'laboratorio';
  // El erudito de cada época: quien guarda y busca el saber del pueblo.
  M.ERUDITO = era => era <= 1 ? { uno: 'chamán', varios: 'chamanes', tipo: 'chaman' } : era <= 3 ? { uno: 'filósofo', varios: 'filósofos', tipo: 'filosofo' } : era === 4 ? { uno: 'monje', varios: 'monjes', tipo: 'monje' } : era === 5 ? { uno: 'erudito', varios: 'eruditos', tipo: 'erudito' } : { uno: 'científico', varios: 'científicos', tipo: 'cientifico' };
  // Lo investigado por un pueblo (los mundos antiguos y los pueblos nuevos reciben todo lo de las eras que ya pasaron).
  M.tecsDe = c => {
    if (!c.tecs) c.tecs = M.TECNOLOGIAS.filter(t => t.era < (c.era || 0)).map(t => t.id);
    return c.tecs;
  };
  // La suma de un efecto en todo lo investigado (p. ej. M.tec(c, 'cosecha')).
  M.tec = (c, k) => { if (!c) return 0; let s = 0; const ts = M.tecsDe(c); for (const t of M.TECNOLOGIAS) if (t.efecto[k] && ts.includes(t.id)) s += t.efecto[k]; return s; };
  // El precio de una tecnología: lo que costaba antes llegar a la era siguiente, repartido entre sus tecnologías.
  M.costeTec = t => { const e = M.ERAS, n = M.TECNOLOGIAS.filter(x => x.era === t.era).length; const sig = e[t.era + 1] ? e[t.era + 1].umbral : e[t.era].umbral + 400; return Math.max(4, Math.round((sig - e[t.era].umbral) / n * (t.era >= 2 ? 1.4 : 1))); }; // (más caras desde el Hierro: la técnica acelera la ciencia)
  // Los niveles de un asentamiento, de campamento a ciudad, según su gente.
  M.NIVELES = [
    { nombre: 'Campamento', desde: 0, abre: 'chozas y un molino' },
    { nombre: 'Aldea', desde: 12, abre: 'torre de vigilancia y puerto' },
    { nombre: 'Pueblo', desde: 30, abre: 'templo, cuartel y arquería' },
    { nombre: 'Villa', desde: 70, abre: 'castillo' },
    { nombre: 'Ciudad', desde: 140, abre: 'todo' }
  ];
  M.nivelDe = n => { let k = 0; for (let i = 0; i < M.NIVELES.length; i++) if (n >= M.NIVELES[i].desde) k = i; return k; };

  // Lo que un dios puede regalar, y a qué era pertenece (para "que descubran la imprenta").
  M.INVENTOS = [
    [/agricultura|sembrar|cultivar/, 0, 'la agricultura'], [/ceramica|vasijas/, 0, 'la cerámica'],
    [/escritura|escribir/, 1, 'la escritura'], [/\brueda\b/, 1, 'la rueda'], [/bronce/, 1, 'el bronce'], [/calendario/, 1, 'el calendario'],
    [/hierro/, 2, 'el hierro'], [/alfabeto/, 2, 'el alfabeto'], [/moneda|dinero/, 2, 'la moneda'],
    [/filosofia/, 3, 'la filosofía'], [/acueducto/, 3, 'el acueducto'], [/derecho|leyes escritas/, 3, 'el derecho escrito'], [/hormigon|cemento/, 3, 'el hormigón'],
    [/molino/, 4, 'el molino de agua'], [/brujula/, 4, 'la brújula'], [/universidad/, 4, 'la universidad'], [/estribo/, 4, 'el estribo'],
    [/imprenta|libros/, 5, 'la imprenta'], [/polvora|canon/, 5, 'la pólvora'], [/banca|bancos/, 5, 'la banca'], [/carabela|barcos/, 5, 'la carabela'],
    [/vapor/, 6, 'la máquina de vapor'], [/ferrocarril|tren/, 6, 'el ferrocarril'], [/fabrica/, 6, 'la fábrica'],
    [/electricidad|luz electrica/, 7, 'la electricidad'], [/vacuna/, 7, 'las vacunas'], [/radio/, 7, 'la radio'], [/avion/, 7, 'el avión'], [/penicilina|antibiotico/, 7, 'la penicilina'],
    [/ametralladora/, 8, 'la ametralladora'], [/tanque|carro de combate/, 8, 'el tanque'], [/radar/, 8, 'el radar']
  ];

  // El carácter de cada pueblo cambia cómo decide: cuánto guerrea, cuánta ciencia hace, cuánto comercia.
  M.CARACTERES = {
    guerrero: { nombre: 'guerrero', fem: 'guerrera', agresion: 1.7, ciencia: 0.9, comercio: 0.8, estab: 0 },
    mercader: { nombre: 'mercader', fem: 'mercader', agresion: 0.6, ciencia: 1.05, comercio: 1.7, estab: 0 },
    devoto: { nombre: 'devoto', fem: 'devota', agresion: 1.0, ciencia: 0.85, comercio: 1.0, estab: 6 },
    sabio: { nombre: 'sabio', fem: 'sabia', agresion: 0.7, ciencia: 1.4, comercio: 1.1, estab: 0 }
  };

  M.COLORES = ['#e5533d', '#4f86e8', '#e8b13b', '#45b86a', '#a65fe0', '#e8823b', '#3cc6c6', '#e0559b', '#9bc93f', '#8a93e8', '#c9a16b', '#5fd1a0'];

  // Nombres inventados para los pueblos ("Karenia", "Tolmedor"...).
  // Los gobernantes: nombres de persona, el título según el régimen y el rasgo que marca su reinado.
  M.PERSONAS = {
    inicio: ['Ar', 'Bel', 'Cor', 'Dar', 'El', 'Fen', 'Gal', 'Har', 'Ir', 'Jor', 'Kel', 'Lur', 'Mar', 'Nor', 'Or', 'Per', 'Ral', 'Sar', 'Tor', 'Ul', 'Var', 'Yor', 'Zan', 'Ama', 'Isa', 'Ten', 'Bra'],
    fin: ['an', 'ia', 'ek', 'os', 'ina', 'ar', 'eth', 'un', 'is', 'ora', 'ald', 'ix', 'ene', 'ul', 'iro']
  };
  M.TITULOS = { tribu: 'jefe', jefatura: 'cacique', reino: 'rey', imperio: 'emperador', republica: 'cónsul', teocracia: 'sumo sacerdote', democracia: 'presidente', dictadura: 'dictador', estado_obrero: 'secretario general' };
  M.RASGOS = {
    sabio: { nombre: 'sabio', fem: 'sabia', ciencia: 1.2, estab: 2 }, guerrero: { nombre: 'guerrero', agresion: 1.6, fuerza: 1.1 },
    pacifico: { nombre: 'pacífico', agresion: 0.45, estab: 3 }, codicioso: { nombre: 'codicioso', riqueza: 1.15, estab: -4 },
    cruel: { nombre: 'cruel', estab: -6, fuerza: 1.12, agresion: 1.2 }, justo: { nombre: 'justo', estab: 6 },
    constructor: { nombre: 'constructor', riqueza: 1.05, estab: 2 }, loco: { nombre: 'loco', estab: -8, agresion: 1.4 }
  };

  M.SILABAS = {
    inicio: ['Ak', 'Bel', 'Cor', 'Dra', 'Esh', 'Far', 'Gal', 'Hel', 'Ish', 'Kar', 'Lum', 'Mar', 'Nor', 'Ost', 'Pel', 'Qan', 'Ras', 'Sar', 'Tal', 'Ur', 'Val', 'Xan', 'Yar', 'Zor', 'Tum', 'Ib', 'Ol', 'Sen', 'Mez', 'Ka', 'Tol', 'Ner', 'Ab', 'Ilu'],
    medio: ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'il', 'or', 'an', 'ur', 'es'],
    fin: ['ria', 'nia', 'dor', 'tan', 'ka', 'mia', 'lia', 'sis', 'ra', 'gon', 'thos', 'mar', 'shan', 'via', 'ta', 'kum', 'lan']
  };

  /*
   * LOS PORQUÉS DEL MUNDO: por cada tipo de suceso, mecanismos reales con su precedente histórico.
   * La crónica elige uno al azar para explicar lo que acaba de pasar.
   */
  M.PORQUES = {
    fundacion: [['Donde hay agua y tierra blanda, hay pueblos: las primeras civilizaciones nacieron junto a ríos.', 'Sumer, Egipto, el Indo y el río Amarillo crecieron, todos, junto a un río.']],
    expansion: [['Cuando la tierra da más comida de la que se come, sobran brazos para ir más lejos.', 'Los pueblos bantúes se extendieron por media África llevando la agricultura y el hierro.'], ['Cada casilla nueva es más comida, pero también más frontera que defender.', 'El Imperio romano llegó tan lejos que acabó construyendo muros: el de Adriano tiene 117 kilómetros.']],
    era: [['Los inventos se acumulan: cada uno hace posible el siguiente.', 'Sin la escritura no hay leyes escritas; sin leyes escritas no hay imperios.']],
    era_1: [['El bronce necesita cobre y estaño, que casi nunca están juntos: obliga a comerciar lejos.', 'Las rutas del estaño unían Cornualles con el Mediterráneo hace 4.000 años.'], ['La escritura se inventó para contar sacos de grano: los primeros textos son facturas.', 'Las tablillas de Uruk (3.200 a. C.) son, sobre todo, cuentas de cebada.']],
    era_2: [['El hierro abunda en casi todas partes: armas baratas para todos, y los reyes pierden el monopolio de la guerra.', 'Hacia 1177 a. C. se hundieron casi todos los reinos del bronce del Mediterráneo; los que llegaron después tenían hierro.']],
    era_3: [['Con ciudades grandes y gente que no tiene que cultivar, aparecen los filósofos y los ingenieros.', 'Atenas tuvo a Sócrates porque tenía esclavos y excedentes; Roma tuvo acueductos porque tenía legiones de ingenieros.']],
    era_4: [['Tras la caída de los grandes imperios, el poder se reparte entre señores y monasterios que guardan el saber.', 'Tras la caída de Roma, en Europa los libros sobrevivieron en los monasterios y en Bagdad se tradujo a Aristóteles.']],
    era_5: [['La imprenta abarata los libros: las ideas se copian más rápido de lo que se pueden prohibir.', 'Gutenberg imprimió su Biblia hacia 1455; en 1517, las tesis de Lutero corrieron por Europa en semanas.'], ['La pólvora vuelve inútiles los castillos: gana quien puede pagar cañones.', 'En 1453 los cañones otomanos abrieron las murallas de Constantinopla, que aguantaban desde hacía mil años.']],
    era_6: [['Una máquina hace el trabajo de cien hombres: la riqueza deja de ser la tierra y pasa a ser la fábrica.', 'Manchester pasó de pueblo a ciudad de 300.000 habitantes en sesenta años gracias al algodón y al vapor.']],
    era_7: [['La electricidad y la medicina alargan la vida: la población se dispara.', 'La humanidad tardó hasta 1804 en llegar a mil millones; en 1927 ya eran dos mil.']],
    era_8: [['La guerra se vuelve total: gana quien fabrica más fusiles, tanques y aviones.', 'En 1944 las fábricas de Estados Unidos sacaban un avión cada cinco minutos.']],
    hambruna: [['Si la población crece más deprisa que la comida, el hambre la recorta: es la trampa maltusiana.', 'Malthus lo escribió en 1798. La Gran Hambruna europea de 1315 mató a uno de cada diez.']],
    guerra: [['Las guerras empiezan por fronteras y recursos, y acaban por agotamiento.', 'La guerra de los Cien Años duró 116: se acabó cuando ninguno de los dos podía pagar otra campaña.'], ['El vecino fuerte con un vecino débil siempre encuentra un motivo.', 'Tucídides lo resumió en Melos: "los fuertes hacen lo que pueden y los débiles sufren lo que deben".']],
    conquista: [['Quien tiene mejor técnica puede vencer a muchos más: el acero contra la piedra, el cañón contra la lanza.', 'Pizarro tomó el imperio inca en 1532 con 168 hombres, caballos, acero y la viruela.'], ['Conquistar es fácil; gobernar lo conquistado es lo difícil.', 'Alejandro conquistó de Grecia a la India en once años; su imperio se partió al día siguiente de su muerte.']],
    caida: [['Ningún imperio es eterno: se hunden por dentro antes de que los derriben por fuera.', 'Roma tardó siglos en caer; en 476 el último emperador de Occidente fue depuesto casi sin ruido.']],
    revuelta: [['Cuanto más grande el reino, más lejos queda la capital de sus fronteras: las provincias dejan de obedecer.', 'El Imperio romano se dividió en dos en 395; el califato abasí acabó partido en reinos que solo le rezaban de nombre.']],
    plaga: [['Las pestes viajan con los mercaderes: cuanto más comercio, más contagio.', 'La Peste Negra llegó a Europa en 1347 en barcos genoveses desde Crimea y mató a un tercio de la población.']],
    paz: [['Las paces las firma el agotamiento más que la bondad.', 'La paz de Westfalia (1648) llegó tras treinta años de guerra que vaciaron media Alemania.']],
    comercio: [['Las ideas viajan con las mercancías: los vecinos que comercian aprenden unos de otros.', 'Por la Ruta de la Seda llegaron a Occidente el papel, la seda y, más tarde, la pólvora.']],
    revolucion: [['Hambre, impuestos e ideas nuevas: cuando se juntan las tres, cae el régimen.', 'En 1789 Francia tenía las tres: pan carísimo, un Estado en bancarrota y una imprenta llena de panfletos.']],
    unificacion: [['Unificar da un mercado grande y un solo ejército, pero borra mil costumbres locales.', 'Qin unificó China en 221 a. C.: un solo idioma escrito, una sola medida, una sola moneda... y una dinastía que duró quince años.']],
    republica: [['Cuando los ricos de la ciudad pueden más que el rey, el rey sobra.', 'Roma expulsó a su último rey en 509 a. C. y estuvo casi cinco siglos sin otro.']],
    oro: [['Mucho oro de golpe no hace rico a un pueblo: sube los precios.', 'El oro y la plata de América trajeron a España la "revolución de los precios" del siglo XVI y varias bancarrotas.']],
    terremoto: [['Un desastre natural sacude también las creencias.', 'El terremoto de Lisboa de 1755 destruyó la ciudad un día de Todos los Santos y puso a media Europa a discutir si Dios existía.']],
    diluvio: [['Las crecidas destruyen, pero dejan tierra fértil.', 'Egipto vivió milenios de las crecidas del Nilo, que cada verano dejaban limo sobre los campos.']],
    locura: [['En una monarquía, la salud del rey es la salud del Estado.', 'Carlos VI de Francia creía ser de cristal y no dejaba que nadie lo tocara; Francia perdió media guerra de los Cien Años mientras tanto.']],
    profeta: [['Una fe nueva puede unir a pueblos dispersos y lanzarlos más allá de sus fronteras.', 'El islam pasó de Arabia a Hispania y a la India en menos de un siglo.']],
    anacronismo: [['Un invento sin la sociedad que lo aproveche se queda en curiosidad.', 'Herón de Alejandría construyó una máquina de vapor en el siglo I. Se usó como juguete en los templos.']],
    nuevo_pueblo: [['Los pueblos de las estepas y los desiertos aparecen de pronto en la historia y la cambian.', 'Los mongoles de Gengis Kan pasaron de tribus enfrentadas a dominar de Corea a Hungría en cincuenta años.']],
    avance: [['Pasar de una época a otra cuesta: hace falta excedente para alimentar a quien no produce comida (sabios, escribas, artesanos) y tiempo para que lo nuevo arraigue.', 'La Revolución Neolítica tardó milenios en extenderse desde el Creciente Fértil hasta Europa.']],
    tecnica: [['Cada técnica nueva se apoya en las anteriores: sin cerámica no hay graneros, sin escritura no hay leyes, sin hierro no hay arado que rompa la tierra dura.', 'La rueda aparece en Mesopotamia hacia el 3500 a. C., primero para hacer vasijas y solo después para los carros.']],
    nivel: [['Un asentamiento crece cuando hay comida de sobra para alimentar a quien no siembra: artesanos, sacerdotes, soldados.', 'Çatalhöyük, en Anatolia, pasó de unas chozas a una aldea de miles de personas hacia el 7000 a. C.']],
    quiebra: [['Un ejército que no cobra deja de ser un ejército: desertores, saqueos, motines.', 'En 1575 los tercios españoles en Flandes, sin paga, saquearon Amberes (la «furia española»).']],
    lobos: [['Donde hay rebaños junto al bosque hay lobos: el pastor y el perro nacieron para defenderlos.', 'En la Francia del siglo XVIII, la «bestia de Gévaudan», un lobo o varios, mató a unas cien personas y movilizó al ejército del rey.']],
    sequia: [['Sin lluvia no hay cosecha ni pasto: un pueblo vive de lo que guardó en el granero.', 'Una sequía de décadas contribuyó al abandono de las grandes ciudades mayas hacia el año 900.'], ['Los malos años se encadenan: primero se pierde la cosecha, luego el ganado.', 'La Gran Hambruna de 1315-1317, tras tres veranos de lluvia y frío, mató a uno de cada diez europeos del norte.']],
    abundancia: [['Las buenas cosechas llenan los graneros y las cunas.', 'La patata y el maíz de América duplicaron la población de muchos países de Europa y de China en dos siglos.']],
    destruccion: [['Algunas civilizaciones desaparecen de golpe y dejan solo ruinas.', 'La erupción del Vesubio en el año 79 sepultó Pompeya en un día; la de Tera, siglos antes, quizá acabó con la Creta minoica.']],
    complot: [['Las guerras rara vez estallan de repente: antes se traman en las cortes, y quien las ve venir puede evitarlas.', 'El plan Schlieffen para invadir Francia por Bélgica se preparó durante casi diez años antes de 1914.']],
    alianza: [['Las alianzas se firman por miedo a un tercero más que por amistad, y arrastran a la guerra a quien las firma.', 'En 1914 una red de alianzas convirtió el asesinato de un archiduque en Sarajevo en una guerra mundial en cinco semanas.']],
    sucesion: [['En una monarquía, cada muerte del rey es una apuesta: un heredero claro trae calma; uno dudoso, guerra.', 'La guerra de Sucesión española (1701-1714) enfrentó a media Europa por quién heredaba el trono de un rey sin hijos.']],
    ciudad: [['Donde se juntan caminos, mercados y graneros nace una ciudad, y con ella gente que ya no obedece solo al rey.', 'Las ciudades italianas de la Edad Media, como Florencia o Venecia, acabaron gobernándose solas.']],
    deforestacion: [['Un pueblo que crece tala para sembrar, construir y calentarse; si tala más deprisa de lo que el bosque crece, un día se queda sin madera.', 'En la isla de Pascua talaron hasta la última palmera: sin troncos no hubo más canoas ni más moáis.'], ['Sin bosques no hay barcos ni casas: la madera fue el petróleo de la Edad Media.', 'Inglaterra taló tanto que en el siglo XVII tuvo que pasarse al carbón, y del carbón salió la máquina de vapor.']],
    incendio: [['El fuego limpia el bosque, pero se lleva también las casas y la cosecha.', 'El gran incendio de Roma del año 64 ardió seis días; Nerón culpó a los cristianos.']],
    reforestacion: [['Donde se deja de talar, el bosque vuelve antes de lo que parece.', 'Tras la Peste Negra, media Europa quedó vacía y los bosques recuperaron los campos abandonados en pocas décadas.']],
    tala: [['La madera es riqueza inmediata; el bosque perdido, una deuda que pagan los nietos.', 'Los venecianos talaron los bosques de Dalmacia para sus galeras; la costa todavía está pelada.']],
    dictadura: [['En tiempos de crisis, la gente cambia libertad por orden.', 'La República de Weimar, con la hiperinflación y el paro, acabó en manos de un dictador en 1933.']]
  };

  // Regímenes posibles y cómo se nombran.
  // Con artículo: "la república", "el imperio".
  const FEMENINOS = new Set(['tribu', 'jefatura', 'republica', 'teocracia', 'democracia', 'dictadura', 'estado_obrero']);
  // "tribu guerrera", "reino guerrero": el carácter concuerda con el régimen.
  M.conCaracter = (r, car) => M.REGIMENES[r] + ' ' + (FEMENINOS.has(r) && M.CARACTERES[car] ? M.CARACTERES[car].fem : car);
  M.conArticulo = r => (FEMENINOS.has(r) ? 'la ' : 'el ') + M.REGIMENES[r];
  M.unoDe = r => (FEMENINOS.has(r) ? 'una ' : 'un ') + M.REGIMENES[r];
  M.REGIMENES = {
    tribu: 'tribu', jefatura: 'jefatura', reino: 'reino', imperio: 'imperio', republica: 'república', teocracia: 'teocracia',
    democracia: 'democracia', dictadura: 'dictadura', estado_obrero: 'república popular'
  };
})(globalThis.RF = globalThis.RF || {});
