/*
 * GÉNESIS · EL MUNDO
 * Un mapa de casillas con relieve, ríos y desiertos, y unos pocos pueblos que viven solos la historia
 * humana: crecen mientras la tierra les da de comer, se extienden, inventan, comercian, se copian los
 * inventos, guerrean, se rebelan y se hunden. Cada cosa que pasa queda en la crónica con su porqué.
 *
 * Todo es reproducible: el mundo guarda su semilla y el estado del azar, así que la misma semilla y las
 * mismas órdenes dan la misma historia.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO;
  const W = 48, H = 30;
  // El mundo se diseñó con 32×20 regiones: K escala lo que depende del tamaño (capacidad, expansión, fronteras).
  const K = (W * H) / 640;
  const TIERRA = { llanura: 3, bosque: 1.6, colina: 1.5, montana: 0.3, desierto: 0.35, nieve: 0.2, mar: 0, costa: 0 };
  const RIO = 2.2;

  // ---------- Azar con semilla (mulberry32): el estado vive en el mundo ----------
  function azar(m) {
    let t = (m.rng = (m.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const elegir = (m, l) => l[Math.floor(azar(m) * l.length)];

  const idx = (x, y) => y * W + x;
  const xy = i => [i % W, Math.floor(i / W)];
  function vecinos(i) {
    const [x, y] = xy(i), out = [];
    if (x > 0) out.push(i - 1); if (x < W - 1) out.push(i + 1);
    if (y > 0) out.push(i - W); if (y < H - 1) out.push(i + W);
    return out;
  }
  const distancia = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  const esTierra = (m, i) => m.tipo[i] !== 'mar' && m.tipo[i] !== 'costa';
  const fertil = (m, i) => (TIERRA[m.tipo[i]] || 0) + (m.rio[i] ? RIO : 0);

  // ---------- El mapa ----------
  function ruido(m, escala) {
    const gw = Math.ceil(W / escala) + 2, gh = Math.ceil(H / escala) + 2;
    const g = Array.from({ length: gw * gh }, () => azar(m));
    const suave = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = x / escala, fy = y / escala, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = suave(fx - x0), ty = suave(fy - y0);
      const v = (a, b) => g[b * gw + a];
      const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx, b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
  }

  function generarMapa(m) {
    const n1 = ruido(m, 8), n2 = ruido(m, 4), n3 = ruido(m, 2), hum = ruido(m, 6);
    const alto = [], tipo = [], rio = new Array(W * H).fill(false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // Continentes: más tierra en el centro, mar hacia los bordes.
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const borde = Math.max(Math.abs(dx), Math.abs(dy) * 0.9);
      alto.push(n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15 - borde * borde * 0.45);
    }
    const orden = alto.slice().sort((a, b) => a - b);
    const nivel = orden[Math.floor(orden.length * 0.47)], cima = orden[Math.floor(orden.length * 0.93)], colina = orden[Math.floor(orden.length * 0.8)];
    for (let i = 0; i < W * H; i++) {
      const [x, y] = xy(i);
      const h = alto[i], u = hum(x, y), lat = Math.abs(y - (H - 1) / 2) / ((H - 1) / 2);
      if (h < nivel) tipo.push('mar');
      else if (lat > 0.88) tipo.push('nieve');
      else if (h > cima) tipo.push('montana');
      else if (h > colina) tipo.push('colina');
      else if (u < 0.3 && lat < 0.55) tipo.push('desierto');
      else if (u > 0.62) tipo.push('bosque');
      else tipo.push('llanura');
    }
    for (let i = 0; i < W * H; i++) if (tipo[i] === 'mar' && vecinos(i).some(v => tipo[v] !== 'mar' && tipo[v] !== 'costa')) tipo[i] = 'costa';
    m.tipo = tipo; m.alto = alto;
    // Ríos: nacen en las montañas y bajan siempre hacia lo más bajo hasta el mar.
    const fuentes = tipo.map((t, i) => (t === 'montana' || t === 'colina' ? i : -1)).filter(i => i >= 0);
    for (let r = 0; r < 12 && fuentes.length; r++) {
      let i = fuentes.splice(Math.floor(azar(m) * fuentes.length), 1)[0];
      for (let paso = 0; paso < 60; paso++) {
        const sig = vecinos(i).sort((a, b) => alto[a] - alto[b])[0];
        if (!esTierra(m, sig) || alto[sig] >= alto[i]) break;
        rio[sig] = true; i = sig;
      }
    }
    m.rio = rio;
  }

  // ---------- Los pueblos ----------
  function nombre(m) {
    const S = M.SILABAS;
    for (let k = 0; k < 20; k++) {
      const n = elegir(m, S.inicio) + (azar(m) < 0.4 ? elegir(m, S.medio) : '') + elegir(m, S.fin);
      if (!m.civs.some(c => c.nombre === n) && n.length <= 11) return n;
    }
    return elegir(m, S.inicio) + m.sig;
  }

  function nuevaCiv(m, capital, datos) {
    const id = m.sig++;
    const usados = new Set(m.civs.filter(c => c.viva).map(c => c.color));
    const color = M.COLORES.find(c => !usados.has(c)) || elegir(m, M.COLORES);
    const c = Object.assign({
      id, nombre: nombre(m), color, capital, caracter: elegir(m, Object.keys(M.CARACTERES)), viva: true,
      pob: 6, riqueza: 10, estab: 60, ciencia: 0, era: 0, regimen: 'tribu', rel: {}, guerras: [], efectos: [], inventos: [],
      fundada: m.anio, ultimaHambre: -99
    }, datos || {});
    m.civs.push(c);
    m.dueno[capital] = id;
    for (const o of m.civs) if (o.id !== id) { o.rel[id] = o.rel[id] || 0; c.rel[o.id] = c.rel[o.id] || 0; }
    return c;
  }

  const civ = (m, id) => m.civs.find(c => c.id === id);
  const vivas = m => m.civs.filter(c => c.viva);
  const casillas = (m, c) => { const out = []; for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) out.push(i); return out; };
  function capacidad(m, c, cs) {
    let f = 0;
    for (const i of cs || casillas(m, c)) f += fertil(m, i);
    const efecto = c.efectos.reduce((k, e) => k * (e.comida || 1), 1);
    // Las casas y los campos que levantan los aldeanos (vida.js) dan sitio a más gente: una tierra sin
    // obras da un 20 % menos, una tierra bien trabajada, un 20 % más.
    const obras = m.vida ? 0.8 + 0.4 * Math.min(1, ((c.campos || 0) + (c.casas || 0) * 0.5) / ((cs || casillas(m, c)).length * 2.5)) : 1;
    return Math.max(1, f * M.ERAS[c.era].cap * 2.2 / K * efecto * obras);
  }
  function fuerza(m, c, cs) {
    const car = M.CARACTERES[c.caracter];
    return Math.max(0.1, c.pob * M.ERAS[c.era].fuerza * (0.5 + c.estab / 100) * Math.pow(car.agresion, 0.4) * (1 + Math.min(1, c.riqueza / 200)) * (cs ? 1 : 1));
  }
  function frontera(m, a, b) {
    // Casillas de b que tocan a a.
    const out = [];
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === b.id && vecinos(i).some(v => m.dueno[v] === a.id)) out.push(i);
    return out;
  }
  const vecinosDe = (m, c) => {
    const s = new Set();
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) for (const v of vecinos(i)) { const d = m.dueno[v]; if (d >= 0 && d !== c.id) s.add(d); }
    return [...s].map(id => civ(m, id)).filter(x => x && x.viva);
  };
  const enGuerra = (a, b) => a.guerras.some(g => g.con === b.id);

  function regimenPorEra(m, c, n) {
    const car = c.caracter;
    n = n / K;
    if (c.era === 0) return n < 6 ? 'tribu' : 'jefatura';
    if (c.era >= 7) return c.estab < 30 ? 'dictadura' : car === 'guerrero' && azar(m) < 0.5 ? 'dictadura' : 'democracia';
    if (c.era === 6) return car === 'mercader' || car === 'sabio' ? 'republica' : n >= 35 ? 'imperio' : 'reino';
    if (car === 'devoto' && c.era <= 4) return 'teocracia';
    if (c.era === 3 && (car === 'mercader' || car === 'sabio') && n < 25) return 'republica';
    return n >= 35 ? 'imperio' : 'reino';
  }

  // ---------- La crónica ----------
  function cronica(m, tipo, titulo, texto, c, casilla, extra) {
    const opciones = M.PORQUES[tipo] || M.PORQUES[tipo.split('_')[0]] || [];
    const p = opciones.length ? elegir(m, opciones) : null;
    const e = Object.assign({ anio: m.anio, turno: m.turno, tipo, titulo, texto, porque: p ? p[0] : null, precedente: p ? p[1] : null, civ: c ? c.id : null, color: c ? c.color : null, casilla: casilla == null ? (c ? c.capital : null) : casilla }, extra || {});
    m.cronica.unshift(e);
    if (m.cronica.length > 250) m.cronica.length = 250;
    m.ultimo = e;
    return e;
  }

  function anioTexto(a) {
    const n = Math.abs(Math.round(a));
    const s = n >= 10000 ? n.toLocaleString('es-ES') : n >= 1000 ? String(n).replace(/(\d)(\d{3})$/, '$1.$2') : String(n);
    return a < 0 ? s + ' a. C.' : s;
  }

  // ---------- Crear un mundo ----------
  function crear(semilla, numPueblos) {
    const m = { version: 1, semilla: semilla >>> 0, rng: semilla >>> 0, W, H, anio: -4000, turno: 0, civs: [], sig: 0, cronica: [], dueno: new Array(W * H).fill(-1) };
    generarMapa(m);
    // Los primeros pueblos, en tierras fértiles y lejos unos de otros (mejor junto a un río).
    const candidatas = [];
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.tipo[i] !== 'nieve' && fertil(m, i) >= 3) candidatas.push(i);
    candidatas.sort((a, b) => fertil(m, b) - fertil(m, a) + (azar(m) - 0.5));
    const elegidas = [];
    for (const i of candidatas) {
      if (elegidas.every(j => distancia(i, j) >= 12)) elegidas.push(i);
      if (elegidas.length >= (numPueblos || 5)) break;
    }
    for (const cap of elegidas) {
      const c = nuevaCiv(m, cap);
      for (const v of vecinos(cap)) if (esTierra(m, v) && m.dueno[v] < 0 && azar(m) < 0.7) m.dueno[v] = c.id;
      cronica(m, 'fundacion', 'Nace ' + c.nombre, 'Un pueblo ' + c.caracter + ' se asienta ' + (m.rio[cap] ? 'junto a un río' : 'en una llanura fértil') + ' y empieza a sembrar. Lo llamarán ' + c.nombre + '.', c);
    }
    // Los aldeanos, los árboles y las casas (vida.js), si está cargada.
    if (M.vida) M.vida.crear(m);
    return m;
  }

  // ---------- Un turno del mundo ----------
  function turno(m) {
    m.turno++;
    if (m.vida && M.vida) M.vida.turno(m);
    const lista = vivas(m);
    for (const c of lista) vivir(m, c);
    diplomacia(m);
    for (const c of vivas(m)) guerras(m, c);
    sucesosNaturales(m);
    for (const c of vivas(m)) c.efectos = c.efectos.filter(e => e.hasta > m.turno);
    const maxEra = Math.max(0, ...vivas(m).map(c => c.era));
    m.anio += M.ERAS[maxEra].anios;
    return m;
  }

  function vivir(m, c) {
    const cs = casillas(m, c);
    if (!cs.length) { morir(m, c, null); return; }
    if (m.dueno[c.capital] !== c.id) c.capital = cs.sort((a, b) => fertil(m, b) - fertil(m, a))[0];
    const n = cs.length, car = M.CARACTERES[c.caracter];
    const cap = capacidad(m, c, cs);
    // La gente crece mientras haya comida; si se pasa, llega el hambre.
    c.pob += c.pob * 0.14 * (1 - c.pob / cap);
    if (c.pob > cap * 1.05) {
      const muertos = (c.pob - cap) * 0.6;
      c.pob -= muertos; c.estab -= 6;
      if (m.turno - c.ultimaHambre > 6 && muertos > 1) {
        c.ultimaHambre = m.turno;
        cronica(m, 'hambruna', 'Hambre en ' + c.nombre, 'Hay más bocas que cosechas. Mueren unos ' + miles(muertos) + ' y los graneros del templo se vacían.', c);
      }
    }
    c.pob = Math.max(0.5, c.pob);
    const vec = vecinosDe(m, c);
    const enPaz = vec.filter(v => !enGuerra(c, v));
    // Riqueza: la tierra, el comercio con los vecinos en paz y la caja que se gasta.
    c.riqueza = c.riqueza * 0.93 + n * 0.4 * (c.era + 1) + enPaz.filter(v => (c.rel[v.id] || 0) > 10).length * 2 * car.comercio;
    // Ciencia: gente, estabilidad, carácter, y los inventos que se copian de vecinos más avanzados.
    const copia = enPaz.reduce((k, v) => k + Math.max(0, v.era - c.era) * 3, 0);
    // Cada era acelera la siguiente: la escritura, la imprenta y la ciencia se apoyan unas en otras.
    c.ciencia += Math.sqrt(c.pob) * 0.55 * car.ciencia * (0.4 + c.estab / 100) * (1 + 0.1 * enPaz.length) * (1 + c.era * 0.18) + copia;
    const sig = M.ERAS[c.era + 1];
    if (sig && c.ciencia >= sig.umbral) subirEra(m, c, null);
    // Estabilidad: el carácter, el tamaño (sobreextensión), las guerras, el hambre y el desorden heredado.
    const objetivo = 62 + car.estab - Math.max(0, n / K - 22) * 0.7 - c.guerras.length * 5 - (c.pob > cap * 0.98 ? 6 : 0) + (c.riqueza > 60 ? 4 : 0) + c.efectos.reduce((k, e) => k + (e.estab || 0), 0);
    c.estab += (objetivo - c.estab) * 0.12 + (azar(m) - 0.5) * 4;
    c.estab = Math.max(0, Math.min(100, c.estab));
    // Expansión hacia tierra libre cuando sobran brazos.
    if (c.pob > cap * 0.55) {
      const libres = new Set();
      for (const i of cs) for (const v of vecinos(i)) if (esTierra(m, v) && m.dueno[v] < 0) libres.add(v);
      // Desde el Renacimiento, también al otro lado del mar.
      if (c.era >= 5 && !libres.size) for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && vecinos(i).some(v => m.tipo[v] === 'costa') && cs.some(j => distancia(i, j) <= 13)) libres.add(i);
      const orden = [...libres].sort((a, b) => fertil(m, b) - fertil(m, a) + distancia(a, c.capital) * 0.15 - distancia(b, c.capital) * 0.15);
      // Expandirse cuesta madera (o piedra) cuando hay aldeanos que la traen (vida.js).
      const vida = m.vida && M.vida;
      const cuantas = Math.min(c.era >= 3 ? 4 : 2, vida ? vida.tierrasPagables(m, c) : 99);
      for (const i of orden.slice(0, cuantas)) {
        m.dueno[i] = c.id;
        if (vida) vida.pagarTierra(m, c);
        const ultramar = !cs.some(j => vecinos(i).includes(j));
        if (ultramar) cronica(m, 'expansion', c.nombre + ' cruza el mar', 'Sus barcos fundan una colonia en tierras lejanas. Los que ya vivían allí no han sido consultados.', c, i);
        else if (azar(m) < 0.05) cronica(m, 'expansion', c.nombre + ' se extiende', 'Los colonos de ' + c.nombre + ' talan, siembran y levantan aldeas nuevas. Ya ocupan ' + (cs.length + 1) + ' tierras.', c, i);
      }
    }
    // Revuelta: las provincias lejanas de un reino grande e inestable se separan.
    if (c.estab < 22 && n >= 8 * K && azar(m) < 0.3) separar(m, c, cs);
    else if (c.estab < 8 && azar(m) < 0.25) {
      const perdidas = cs.filter(i => i !== c.capital && azar(m) < 0.3);
      for (const i of perdidas) m.dueno[i] = -1;
      if (perdidas.length) cronica(m, 'caida', 'Desorden en ' + c.nombre, 'Nadie obedece a nadie. ' + perdidas.length + ' comarcas quedan abandonadas y los caminos se llenan de bandidos.', c);
    }
  }

  function subirEra(m, c, regalo) {
    c.era++;
    const E = M.ERAS[c.era];
    const nuevos = E.inventos.filter(x => !c.inventos.includes(x));
    const invento = regalo || elegir(m, nuevos.length ? nuevos : E.inventos);
    c.inventos.push(invento);
    const antes = c.regimen;
    c.regimen = regimenPorEra(m, c, casillas(m, c).length);
    const primero = !m.civs.some(o => o !== c && o.era >= c.era);
    cronica(m, 'era_' + c.era, c.nombre + ' entra en ' + E.con, (primero ? 'Es el primer pueblo del mundo en llegar. ' : '') + T(invento) + ' cambia la vida de ' + c.nombre + (c.regimen !== antes ? '; de paso, ' + M.conArticulo(antes) + ' se convierte en ' + M.unoDe(c.regimen) : '') + '.', c, null, { importante: primero });
  }
  const T = s => s.charAt(0).toUpperCase() + s.slice(1);
  const miles = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' millones' : Math.round(p).toLocaleString('es-ES') + ' mil') + ' personas';

  function separar(m, c, cs) {
    const lejos = cs.filter(i => i !== c.capital).sort((a, b) => distancia(b, c.capital) - distancia(a, c.capital));
    const parte = lejos.slice(0, Math.max(2, Math.floor(cs.length * 0.4)));
    if (parte.length < 2) return;
    const nueva = nuevaCiv(m, parte[0], { era: c.era, ciencia: c.ciencia * 0.9, pob: c.pob * parte.length / cs.length, riqueza: c.riqueza * 0.3, estab: 55, inventos: c.inventos.slice() });
    for (const i of parte) m.dueno[i] = nueva.id;
    c.pob -= nueva.pob; c.estab = 40;
    nueva.regimen = regimenPorEra(m, nueva, parte.length);
    nueva.rel[c.id] = -40; c.rel[nueva.id] = -40;
    cronica(m, 'revuelta', 'Las provincias se rebelan', 'Las tierras lejanas de ' + c.nombre + ' dejan de obedecer a la capital y proclaman un ' + (nueva.regimen === 'republica' ? 'gobierno propio' : 'reino propio') + ': ' + nueva.nombre + '.', c, parte[0]);
  }

  function morir(m, c, quien) {
    if (!c.viva) return;
    c.viva = false; c.muerte = m.anio;
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) m.dueno[i] = quien ? quien.id : -1;
    for (const o of m.civs) o.guerras = o.guerras.filter(g => g.con !== c.id);
    c.guerras = [];
    cronica(m, 'caida', 'Cae ' + c.nombre, quien ? quien.nombre + ' toma la última ciudad de ' + c.nombre + '. Sus dioses pasan a ser leyendas y su lengua, unas pocas palabras en la de los vencedores.' : c.nombre + ' se deshace sin que nadie lo conquiste: sus aldeas se vacían y sus templos se llenan de hierba.', c, c.capital, { importante: true });
  }

  // ---------- Las relaciones entre pueblos ----------
  function diplomacia(m) {
    const lista = vivas(m);
    for (const a of lista) {
      const vec = vecinosDe(m, a);
      for (const b of lista) {
        if (a.id >= b.id) continue;
        const juntos = vec.includes(b);
        const ca = M.CARACTERES[a.caracter], cb = M.CARACTERES[b.caracter];
        let r = a.rel[b.id] || 0;
        // La frontera roza; el comercio acerca; el tiempo cura.
        r += (juntos ? -1.2 * (ca.agresion + cb.agresion) / 2 + 0.8 * (ca.comercio + cb.comercio) / 2 : 0) - r * 0.04 + (azar(m) - 0.5) * 3;
        a.rel[b.id] = b.rel[a.id] = Math.max(-100, Math.min(100, r));
        if (!juntos) continue;
        if (!enGuerra(a, b)) {
          const fa = fuerza(m, a), fb = fuerza(m, b);
          const [agresor, victima, fAg, fVi] = fa >= fb ? [a, b, fa, fb] : [b, a, fb, fa];
          const ganas = M.CARACTERES[agresor.caracter].agresion * (fAg / fVi) * (r < -30 ? 1.6 : 1) * (agresor.estab > 30 ? 1 : 0.4);
          if (agresor.guerras.length < 2 && (r < -55 || (ganas > 2.2 && r < 10)) && azar(m) < 0.12) declararGuerra(m, agresor, victima, null);
        }
      }
    }
  }

  function declararGuerra(m, a, b, motivo) {
    if (enGuerra(a, b) || a === b) return;
    a.guerras.push({ con: b.id, desde: m.turno, cansancio: 0 });
    b.guerras.push({ con: a.id, desde: m.turno, cansancio: 0 });
    a.rel[b.id] = b.rel[a.id] = Math.min(a.rel[b.id] || 0, -50);
    cronica(m, 'guerra', 'Guerra entre ' + a.nombre + ' y ' + b.nombre, motivo || (a.nombre + ' cruza la frontera de ' + b.nombre + '. ' + elegir(m, ['Dicen que por un pozo.', 'Dicen que por un insulto a sus dioses.', 'Dicen que por unas ovejas.', 'Dicen que por un matrimonio que no se celebró.', 'Nadie recuerda ya por qué.'])), a, frontera(m, b, a)[0]);
  }

  function hacerPaz(m, a, b, motivo) {
    a.guerras = a.guerras.filter(g => g.con !== b.id);
    b.guerras = b.guerras.filter(g => g.con !== a.id);
    a.rel[b.id] = b.rel[a.id] = 0;
    cronica(m, 'paz', 'Paz entre ' + a.nombre + ' y ' + b.nombre, motivo || 'Los dos ejércitos están agotados. Se firma un tratado que ninguno de los dos piensa cumplir del todo.', a);
  }

  function guerras(m, a) {
    for (const g of a.guerras.slice()) {
      const b = civ(m, g.con);
      if (!b || !b.viva) { a.guerras = a.guerras.filter(x => x !== g); continue; }
      if (a.id > b.id) continue; // cada guerra se resuelve una vez por turno
      // Las batallas que ganan los guerreros de cada bando (vida.js) inclinan la guerra.
      const batallas = ((a.victorias || 0) - (b.victorias || 0));
      a.victorias = 0; b.victorias = 0;
      const empuje = 1 + 0.15 * Math.tanh(batallas / 4);
      const fa = fuerza(m, a) * empuje, fb = fuerza(m, b) / empuje;
      const [gana, pierde, ratio] = fa >= fb ? [a, b, fa / fb] : [b, a, fb / fa];
      const k = Math.max(0, Math.min(5, Math.round(((ratio - 1) * 2 + (azar(m) - 0.4)) * 1.5)));
      const fr = frontera(m, gana, pierde);
      const tomadas = fr.sort(() => azar(m) - 0.5).slice(0, k);
      for (const i of tomadas) m.dueno[i] = gana.id;
      a.pob *= 0.975; b.pob *= 0.975;
      pierde.pob *= 1 - 0.02 * tomadas.length;
      a.estab -= 1.5; b.estab -= 1.5;
      const ga = a.guerras.find(x => x.con === b.id), gb = b.guerras.find(x => x.con === a.id);
      if (ga) ga.cansancio += 1 + (pierde === a ? tomadas.length : 0) * 0.5;
      if (gb) gb.cansancio += 1 + (pierde === b ? tomadas.length : 0) * 0.5;
      if (tomadas.includes(pierde.capital)) {
        const quedan = casillas(m, pierde);
        if (!quedan.length || quedan.length <= 2) { for (const i of quedan) m.dueno[i] = gana.id; morir(m, pierde, gana); continue; }
        cronica(m, 'conquista', gana.nombre + ' toma la capital de ' + pierde.nombre, 'La capital de ' + pierde.nombre + ' cae tras un largo asedio. Su corte huye a otra ciudad y sigue llamándose gobierno.', gana, pierde.capital);
        pierde.estab -= 15;
      }
      if (!casillas(m, pierde).length) { morir(m, pierde, gana); continue; }
      const cansancio = Math.max(ga ? ga.cansancio : 0, gb ? gb.cansancio : 0);
      if (cansancio > 6 + azar(m) * 6 || (ratio < 1.15 && cansancio > 4 && azar(m) < 0.3)) hacerPaz(m, a, b);
    }
  }

  // ---------- Lo que pasa sin que nadie lo decida ----------
  function sucesosNaturales(m) {
    const lista = vivas(m);
    if (!lista.length) {
      // Si la humanidad se extingue, otro pueblo aparece en las tierras vacías.
      nuevoPueblo(m, null);
      return;
    }
    // Pestes: viajan con el comercio y se ceban con los pueblos grandes.
    if (azar(m) < 0.025) {
      const c = lista.slice().sort((a, b) => b.pob - a.pob)[Math.floor(azar(m) * Math.min(2, lista.length))];
      if (c.era >= 2) plaga(m, c, 0.2 + azar(m) * 0.15, null);
    }
    // Pueblos nuevos en tierras vacías (nómadas, colonos, refugiados).
    let libres = 0;
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve') libres++;
    if (libres > 25 * K && lista.length < 9 && azar(m) < 0.04) nuevoPueblo(m, null);
    if (azar(m) < 0.02) {
      const c = elegir(m, lista);
      c.efectos.push({ comida: 1.4, hasta: m.turno + 4 });
      cronica(m, 'abundancia', 'Años de abundancia en ' + c.nombre, 'Llueve cuando debe y el sol sale cuando toca. Los graneros de ' + c.nombre + ' no dan abasto.', c);
    }
  }

  function plaga(m, c, fuerzaPlaga, texto) {
    c.pob *= 1 - fuerzaPlaga; c.estab -= 12;
    cronica(m, 'plaga', 'Peste en ' + c.nombre, texto || ('Una enfermedad nueva llega con las caravanas. Mueren unos ' + miles(c.pob * fuerzaPlaga / (1 - fuerzaPlaga)) + ' y las ciudades se vacían.'), c);
    // Se contagia a los vecinos con los que comercia.
    for (const v of vecinosDe(m, c)) if (!enGuerra(c, v) && (c.rel[v.id] || 0) > 0 && azar(m) < 0.5) {
      v.pob *= 1 - fuerzaPlaga * 0.6; v.estab -= 6;
      cronica(m, 'plaga', 'La peste llega a ' + v.nombre, 'Los mercaderes de ' + c.nombre + ' traen telas, especias y la enfermedad.', v);
    }
  }

  function nuevoPueblo(m, cerca) {
    const libres = [];
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve' && fertil(m, i) >= 1.5) libres.push(i);
    if (!libres.length) return null;
    const lista = cerca != null ? libres.sort((a, b) => distancia(a, cerca) - distancia(b, cerca)).slice(0, 5) : libres;
    const cap = elegir(m, lista);
    const maxEra = Math.max(0, ...vivas(m).map(c => c.era));
    const c = nuevaCiv(m, cap, { era: Math.max(0, maxEra - 2), ciencia: M.ERAS[Math.max(0, maxEra - 2)].umbral, caracter: azar(m) < 0.5 ? 'guerrero' : elegir(m, Object.keys(M.CARACTERES)) });
    c.regimen = regimenPorEra(m, c, 1);
    for (const v of vecinos(cap)) if (esTierra(m, v) && m.dueno[v] < 0) m.dueno[v] = c.id;
    cronica(m, 'nuevo_pueblo', 'Aparece ' + c.nombre, 'Un pueblo ' + c.caracter + ' llega de las tierras vacías y se asienta. Nadie lo esperaba; nadie lo había invitado.', c, cap, { importante: true });
    return c;
  }

  // ---------- Resumen para la vista y para la IA ----------
  function resumen(m) {
    return vivas(m).map(c => {
      const cs = casillas(m, c);
      return { id: c.id, nombre: c.nombre, color: c.color, era: c.era, eraNombre: M.ERAS[c.era].nombre, regimen: M.REGIMENES[c.regimen], caracter: c.caracter,
        pob: c.pob, estab: c.estab, riqueza: c.riqueza, tierras: cs.length, capacidad: capacidad(m, c, cs), guerras: c.guerras.map(g => civ(m, g.con)).filter(Boolean).map(o => o.nombre), inventos: c.inventos.slice(-4) };
    });
  }

  M.sim = { W, H, K, TIERRA, crear, turno, azar, elegir, idx, xy, vecinos, distancia, esTierra, fertil, casillas, capacidad, fuerza, vecinosDe, enGuerra, civ, vivas,
    cronica, subirEra, separar, morir, declararGuerra, hacerPaz, plaga, nuevoPueblo, nuevaCiv, regimenPorEra, resumen, anioTexto, miles, frontera };
})(globalThis.RF = globalThis.RF || {});
