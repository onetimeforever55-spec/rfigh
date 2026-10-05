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
  // Lo que da de comer cada bioma (y los ríos suman encima).
  const TIERRA = { llanura: 3, sabana: 2.3, bosque: 1.6, selva: 1.7, pantano: 1.3, taiga: 1.0, tundra: 0.6, colina: 1.5, montana: 0.3, desierto: 0.35, nieve: 0.2, mar: 0, costa: 0 };
  // Los bosques talados dejan otro bioma, y vuelven si se dejan crecer.
  const TALADO = { bosque: 'llanura', selva: 'sabana', taiga: 'tundra' };
  const RIO = 2.2;
  // Las prioridades de un jugador (mando.js): 0 nada, 1 normal, 2 máxima. Ciencia, riqueza y ejército
  // compiten entre sí: subir las tres a la vez no da nada, lo que cuenta es cuál pesa más que las otras.
  const PRIORIDADES = ['madera', 'comida', 'piedra', 'casas', 'ejercito', 'ciencia', 'riqueza', 'expansion'];
  const prio = (c, k) => (c.plan && c.plan.prioridad && c.plan.prioridad[k] != null ? c.plan.prioridad[k] : 1);
  function foco(c, k) {
    if (!c.plan || !c.plan.prioridad) return 1;
    const media = (prio(c, 'ciencia') + prio(c, 'riqueza') + prio(c, 'ejercito')) / 3;
    if (k === 'ciencia') return Math.max(0.4, 1 + 0.5 * (prio(c, 'ciencia') - media));
    if (k === 'riqueza') return Math.max(0.4, 1 + 0.5 * (prio(c, 'riqueza') - media));
    if (k === 'fuerza') return Math.max(0.5, 1 + 0.35 * (prio(c, 'ejercito') - media));
    return 1;
  }

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
    const n1 = ruido(m, 8), n2 = ruido(m, 4), n3 = ruido(m, 2), hum = ruido(m, 6), tem = ruido(m, 9);
    const alto = [], tipo = [], rio = new Array(W * H).fill(false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // Continentes: más tierra en el centro, mar hacia los bordes.
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      const borde = Math.max(Math.abs(dx), Math.abs(dy) * 0.9);
      alto.push(n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15 - borde * borde * 0.45);
    }
    const orden = alto.slice().sort((a, b) => a - b);
    const nivel = orden[Math.floor(orden.length * 0.47)], cima = orden[Math.floor(orden.length * 0.93)], colina = orden[Math.floor(orden.length * 0.84)];
    // Los biomas salen del clima: la temperatura baja hacia los polos y con la altura; la humedad, lejos del mar.
    const agua = alto.map(h => h < nivel);
    const cercaMar = i => { const [x, y] = xy(i); for (let r = 1; r <= 3; r++) for (const [a, b] of [[x - r, y], [x + r, y], [x, y - r], [x, y + r]]) if (a >= 0 && b >= 0 && a < W && b < H && agua[b * W + a]) return 1 - (r - 1) / 3; return 0; };
    for (let i = 0; i < W * H; i++) {
      const [x, y] = xy(i);
      const h = alto[i], lat = Math.abs(y - (H - 1) / 2) / ((H - 1) / 2);
      const t = 1.12 - Math.pow(lat, 1.5) * 1.08 - Math.max(0, h - nivel) * 0.8 + (tem(x, y) - 0.5) * 0.3;
      const u = hum(x, y) * 0.8 + cercaMar(i) * 0.25;
      if (h < nivel) tipo.push('mar');
      else if (t < 0.1) tipo.push('nieve');
      else if (h > cima) tipo.push('montana');
      else if (h > colina) tipo.push(t < 0.3 ? 'tundra' : 'colina');
      else if (t < 0.24) tipo.push(u > 0.5 ? 'taiga' : 'tundra');
      else if (t < 0.36) tipo.push(u > 0.48 ? 'taiga' : 'llanura');
      else if (t > 0.84) tipo.push(u < 0.3 ? 'desierto' : u < 0.5 ? 'sabana' : u > 0.78 && h < nivel + 0.04 ? 'pantano' : 'selva');
      else if (u < 0.26) tipo.push(t > 0.55 ? 'desierto' : 'llanura');
      else if (u > 0.74 && h < nivel + 0.035) tipo.push('pantano');
      else if (u > 0.58) tipo.push('bosque');
      else tipo.push(t > 0.62 && u < 0.4 ? 'sabana' : 'llanura');
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
    c.rey = c.rey || gobernante(m, c, 20 + Math.floor(azar(m) * 20));
    c.heredero = c.heredero || gobernante(m, c, Math.floor(azar(m) * 15));
    for (const o of m.civs) if (o.id !== id) { o.rel[id] = o.rel[id] || 0; c.rel[o.id] = c.rel[o.id] || 0; }
    return c;
  }

  // ---------- Los gobernantes ----------
  function nombrePersona(m) { const P = M.PERSONAS; return elegir(m, P.inicio) + elegir(m, P.fin); }
  function gobernante(m, c, edad) {
    const rasgos = Object.keys(M.RASGOS).filter(r => r !== 'loco' || azar(m) < 0.15);
    return { nombre: nombrePersona(m), edad, rasgo: elegir(m, rasgos), desde: m.anio };
  }
  // Busca solo claves propias: un rey «constructor» no debe dar con Object.prototype.constructor.
  const propio = (obj, k) => (Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : 0);
  const rasgo = (c, k) => { const r = c.rey && M.RASGOS[c.rey.rasgo]; return r && r[k] != null ? r[k] : (k === 'estab' ? 0 : 1); };
  const titulo = c => M.TITULOS[c.regimen] || 'rey';
  const ordinales = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  function nombreRey(c) { return c.rey ? c.rey.nombre + (ordinales[c.rey.numero || 0] || '') : '—'; }
  // Pasa el tiempo para el gobernante: envejece, muere y le sucede su heredero; si no hay heredero o el
  // reino está revuelto, llega una guerra de sucesión.
  function reinar(m, c, anios) {
    if (!c.rey) { c.rey = gobernante(m, c, 30); c.heredero = gobernante(m, c, 10); }
    c.rey.edad += anios; if (c.heredero) c.heredero.edad += anios;
    const limite = 45 + (c.rey.limite != null ? c.rey.limite : (c.rey.limite = Math.floor(azar(m) * 35)));
    if (c.rey.edad < limite) return;
    const viejo = nombreRey(c), cargo = titulo(c), detalle = anios <= 25;
    // Con turnos de un siglo pasan varios reyes en silencio; las crisis se cuentan cuando el tiempo va más despacio.
    const crisis = anios <= 50 && ((c.estab < 30 && azar(m) < 0.25) || azar(m) < 0.04);
    const sucesor = c.heredero || gobernante(m, c, 25);
    // Si el sucesor se llama como un antepasado, lleva número (Ardan II).
    c.dinastia = c.dinastia || {};
    c.dinastia[sucesor.nombre] = (c.dinastia[sucesor.nombre] || 0) + 1;
    sucesor.numero = c.dinastia[sucesor.nombre] - 1;
    sucesor.desde = m.anio;
    sucesor.limite = Math.max(0, Math.round(sucesor.edad - 45) + 6 + Math.floor(azar(m) * 25));
    c.rey = sucesor; c.heredero = gobernante(m, c, Math.floor(azar(m) * 15));
    if (crisis) {
      c.estab -= 8;
      cronica(m, 'sucesion', 'Guerra de sucesión en ' + c.nombre, 'Muere ' + (cargo === 'rey' ? 'el rey ' : 'el ' + cargo + ' ') + viejo + ' y tres pretendientes reclaman el poder. Gana ' + nombreRey(c) + ', ' + M.RASGOS[c.rey.rasgo].nombre + ', pero el reino queda partido en bandos.', c, null, { importante: true });
      const cs = casillas(m, c);
      if (cs.length >= 14 * K && azar(m) < 0.3) separar(m, c, cs);
    } else if (detalle && (c.jugador || (vivas(m).slice().sort((p, q) => q.pob - p.pob).indexOf(c) < 3 && azar(m) < 0.35))) {
      cronica(m, 'sucesion', nombreRey(c) + ' gobierna ' + c.nombre, 'Muere ' + viejo + ' a los ' + Math.round(c.rey.edad) + ' años, más o menos. Le sucede ' + nombreRey(c) + ', de quien dicen que es ' + M.RASGOS[c.rey.rasgo].nombre + '.', c);
    }
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
    return Math.max(0.1, c.pob * M.ERAS[c.era].fuerza * (0.5 + c.estab / 100) * Math.pow(car.agresion, 0.4) * (1 + Math.min(1, c.riqueza / 200)) * foco(c, 'fuerza') * rasgo(c, 'fuerza') * (c.guerreros ? 1 + 0.25 * Math.min(1, (c.armados || 0) / Math.max(3, c.guerreros)) : 1));
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
  // ---------- Las alianzas ----------
  const aliados = (m, a, b) => (m.alianzas || []).some(x => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));
  const aliadosDe = (m, c) => (m.alianzas || []).filter(x => x.a === c.id || x.b === c.id).map(x => civ(m, x.a === c.id ? x.b : x.a)).filter(o => o && o.viva);
  function aliar(m, a, b, texto) {
    if (aliados(m, a, b) || enGuerra(a, b) || a === b) return false;
    m.alianzas = (m.alianzas || []).concat([{ a: a.id, b: b.id, desde: m.anio }]);
    a.rel[b.id] = b.rel[a.id] = Math.max(a.rel[b.id] || 0, 60);
    cronica(m, 'alianza', 'Alianza entre ' + a.nombre + ' y ' + b.nombre, texto || ('Los ' + titulo(a) + 'es de ' + a.nombre + ' y ' + b.nombre + ' juran defenderse el uno al otro. Lo sellan con una boda, un banquete y una lista de enemigos comunes.'), a);
    return true;
  }
  function romper(m, a, b, motivo) {
    if (!aliados(m, a, b)) return;
    m.alianzas = m.alianzas.filter(x => !((x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id)));
    cronica(m, 'alianza', 'Se rompe la alianza entre ' + a.nombre + ' y ' + b.nombre, motivo || 'Los viejos amigos ya no se soportan: se devuelven los regalos y se retiran los embajadores.', a);
  }

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
    // Lo mismo dos veces en el mismo turno (dos colonias del mismo reino) se cuenta una sola vez.
    const igual = m.cronica.slice(0, 12).find(x => x.turno === m.turno && x.titulo === titulo);
    if (igual) return igual;
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
  function crear(semilla, numPueblos, opciones) {
    const libre = !!(opciones && opciones.libre);
    const m = { version: 1, semilla: semilla >>> 0, rng: semilla >>> 0, W, H, anio: libre ? 1 : -4000, libre, turno: 0, civs: [], sig: 0, cronica: [], dueno: new Array(W * H).fill(-1) };
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
    lealtades(m);
    sucesosNaturales(m);
    for (const c of vivas(m)) c.efectos = c.efectos.filter(e => e.hasta > m.turno);
    const maxEra = Math.max(0, ...vivas(m).map(c => c.era));
    // En el mundo libre (como WorldBox) los años pasan de uno en uno; en la historia real, al ritmo de cada era.
    const anios = m.libre ? 1 : M.ERAS[maxEra].anios;
    for (const c of vivas(m)) reinar(m, c, anios);
    m.anio += anios;
    // Al cerrar el turno, todo en orden: quien perdió su capital en una conquista de este turno se muda a su
    // mejor tierra (o cae si no le queda ninguna), y los aldeanos de pueblos que ya no existen pasan al dueño
    // de la tierra donde viven (o se dispersan si nadie la gobierna).
    for (const c of vivas(m)) {
      if (m.dueno[c.capital] === c.id) continue;
      const cs = casillas(m, c);
      if (!cs.length) morir(m, c, null); else c.capital = cs.sort((a, b) => fertil(m, b) - fertil(m, a))[0];
    }
    if (m.vida && M.vida) {
      const vivos = new Set(vivas(m).map(c => c.id));
      m.vida.aldeanos = m.vida.aldeanos.filter(a => {
        if (vivos.has(a.c)) return true;
        const d = m.dueno[a.h];
        if (d >= 0 && vivos.has(d)) { a.c = d; a.llego = m.turno; a.o = 1; a.e = 0; a.colono = null; a.arma = 0; a.armadura = 0; a.tirador = null; return true; }
        return false;
      });
      // Los pueblos nacidos en este turno (una rebelión, uno nuevo) quedan contados ya: casas, camas, gente.
      if (vivas(m).some(c => c.camas == null)) M.vida.contar(m);
    }
    return m;
  }

  function vivir(m, c) {
    const cs = casillas(m, c);
    if (!cs.length) { morir(m, c, null); return; }
    if (m.dueno[c.capital] !== c.id) c.capital = cs.sort((a, b) => fertil(m, b) - fertil(m, a))[0];
    const n = cs.length, car = M.CARACTERES[c.caracter];
    const cap = capacidad(m, c, cs);
    c.cap = cap;
    // La gente crece mientras haya comida; si se pasa, llega el hambre. (Con aldeanos, vida.js, la población
    // son ellos: nacen, comen y mueren allí.)
    if (!(m.vida && M.vida)) c.pob += c.pob * 0.14 * (1 - c.pob / cap);
    if (!(m.vida && M.vida) && c.pob > cap * 1.05) {
      // Lo que queda en los graneros (las cosechas de los granjeros, vida.js) amortigua el hambre.
      const granero = Math.min(0.4, (c.comida || 0) / 40);
      if (c.comida) c.comida = Math.max(0, c.comida - 10);
      const muertos = (c.pob - cap) * 0.6 * (1 - granero);
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
    c.riqueza *= 1 + (foco(c, 'riqueza') * rasgo(c, 'riqueza') - 1) * 0.1;
    // Ciencia: gente, estabilidad, carácter, y los inventos que se copian de vecinos más avanzados.
    const copia = enPaz.reduce((k, v) => k + Math.max(0, v.era - c.era) * 3, 0)
      // Las ideas viajan lejos: algo llega siempre del pueblo más avanzado del mundo.
      + Math.max(0, Math.max(...vivas(m).map(o => o.era)) - c.era) * 2
      // Las ciudades y las rutas comerciales son donde se juntan sabios, libros y noticias.
      + ((m.ciudades || []).filter(x => x.civ === c.id).length * 1.2 + (c.rutas || 0) * 1.5);
    // Cada era acelera la siguiente: la escritura, la imprenta y la ciencia se apoyan unas en otras.
    c.ciencia += Math.sqrt(c.pob) * 0.62 * car.ciencia * (0.4 + c.estab / 100) * (1 + 0.1 * enPaz.length) * (1 + c.era * 0.18) * foco(c, 'ciencia') * rasgo(c, 'ciencia') + copia;
    const sig = M.ERAS[c.era + 1];
    // La historia no se salta siglos: ninguna era llega antes de su fecha más temprana posible (salvo en el mundo libre).
    if (sig && c.ciencia >= sig.umbral && (m.libre || sig.desde == null || m.anio >= sig.desde)) subirEra(m, c, null);
    // Estabilidad: el carácter, el tamaño (sobreextensión), las guerras, el hambre y el desorden heredado.
    const objetivo = 62 + car.estab - Math.max(0, n / K - 22) * 0.7 - c.guerras.length * 5 - (c.pob > cap * 0.98 ? 6 : 0) + (c.riqueza > 60 ? 4 : 0) + rasgo(c, 'estab') * 0.5 + Math.min(6, (c.templos || 0) * 2) + c.efectos.reduce((k, e) => k + (e.estab || 0), 0);
    c.estab += (objetivo - c.estab) * 0.12 + (azar(m) - 0.5) * 4;
    c.estab = Math.max(0, Math.min(100, c.estab));
    // Expansión hacia tierra libre cuando sobran brazos.
    const pe = prio(c, 'expansion');
    if (pe > 0 && c.pob > cap * (0.65 - 0.1 * pe) && !(c.plan && c.plan.expandir === false)) {
      const libres = new Set();
      // Con aldeanos (vida.js), el reino solo se extiende junto a regiones donde ya vive gente.
      const poblada = m.vida && m.vida.poblada;
      for (const i of cs) if (!poblada || poblada[i]) for (const v of vecinos(i)) if (esTierra(m, v) && m.dueno[v] < 0) libres.add(v);
      // Desde el Renacimiento, también al otro lado del mar.
      if (c.era >= 5 && !libres.size) for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && vecinos(i).some(v => m.tipo[v] === 'costa') && cs.some(j => distancia(i, j) <= 13)) libres.add(i);
      // Un jugador puede marcar un rumbo: hacia un punto cardinal o hacia otro pueblo.
      const rumbo = c.plan && c.plan.rumbo != null ? destinoRumbo(m, c, c.plan.rumbo) : null;
      const tiron = i => (rumbo == null ? 0 : distancia(i, rumbo) * 0.6);
      const orden = [...libres].sort((a, b) => fertil(m, b) - fertil(m, a) + distancia(a, c.capital) * 0.15 - distancia(b, c.capital) * 0.15 + tiron(a) - tiron(b));
      // Expandirse cuesta madera (o piedra) cuando hay aldeanos que la traen (vida.js).
      const vida = m.vida && M.vida;
      const cuantas = Math.min((c.era >= 3 ? 4 : 2) + (pe >= 2 ? 1 : 0), vida ? vida.tierrasPagables(m, c) : 99);
      for (const i of orden.slice(0, cuantas)) {
        m.dueno[i] = c.id;
        if (vida) vida.pagarTierra(m, c);
        const ultramar = !cs.some(j => vecinos(i).includes(j));
        if (ultramar && !(c.ultramarDesde > m.turno - 8) && (c.ultramarDesde = m.turno)) cronica(m, 'expansion', c.nombre + ' cruza el mar', 'Sus barcos fundan una colonia en tierras lejanas. Los que ya vivían allí no han sido consultados.', c, i);
        else if (azar(m) < 0.05) cronica(m, 'expansion', c.nombre + ' se extiende', 'Los colonos de ' + c.nombre + ' talan, siembran y levantan aldeas nuevas. Ya ocupan ' + (cs.length + 1) + ' tierras.', c, i);
      }
    }
    // Revuelta: las provincias lejanas de un reino grande e inestable se separan.
    // (Las provincias ya no se separan al azar: se rebelan sus ciudades cuando pierden la lealtad; ver lealtades.)
    if (c.estab < 8 && azar(m) < 0.25) {
      const perdidas = cs.filter(i => i !== c.capital && azar(m) < 0.3);
      for (const i of perdidas) m.dueno[i] = -1;
      if (perdidas.length) cronica(m, 'caida', 'Desorden en ' + c.nombre, 'Nadie obedece a nadie. ' + perdidas.length + ' comarcas quedan abandonadas y los caminos se llenan de bandidos.', c);
    }
  }

  // El punto hacia el que tira la expansión: un borde del mapa o la capital de otro pueblo.
  function destinoRumbo(m, c, rumbo) {
    const [x, y] = xy(c.capital);
    if (rumbo === 'norte') return idx(x, 0);
    if (rumbo === 'sur') return idx(x, H - 1);
    if (rumbo === 'este') return idx(W - 1, y);
    if (rumbo === 'oeste') return idx(0, y);
    const o = civ(m, rumbo);
    return o && o.viva ? o.capital : null;
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
    // Si en las tierras rebeldes hay una ciudad, se convierte en la capital del reino nuevo y le da nombre.
    const ciudad = (m.ciudades || []).find(x => parte.includes(x.region));
    if (ciudad) { parte.splice(parte.indexOf(ciudad.region), 1); parte.unshift(ciudad.region); }
    const nueva = nuevaCiv(m, parte[0], { era: c.era, ciencia: c.ciencia * 0.9, pob: c.pob * parte.length / cs.length, riqueza: c.riqueza * 0.3, estab: 55, inventos: c.inventos.slice() });
    if (ciudad && !m.civs.some(x => x !== nueva && x.nombre === ciudad.nombre)) { nueva.nombre = ciudad.nombre; m.ciudades = m.ciudades.filter(x => x !== ciudad); }
    for (const i of parte) m.dueno[i] = nueva.id;
    // Con aldeanos (vida.js), la gente se va con su tierra: no hace falta repartir la población a mano.
    if (m.vida) { nueva.pob = 0.5; nueva.pobVida = null; } else c.pob -= nueva.pob;
    c.estab = 40;
    nueva.regimen = regimenPorEra(m, nueva, parte.length);
    nueva.rel[c.id] = -40; c.rel[nueva.id] = -40; nueva.origen = c.id;
    cronica(m, 'revuelta', 'Las provincias se rebelan', 'Las tierras lejanas de ' + c.nombre + ' dejan de obedecer a la capital y proclaman un ' + (nueva.regimen === 'republica' ? 'gobierno propio' : 'reino propio') + ': ' + nueva.nombre + '.', c, parte[0]);
  }

  function morir(m, c, quien) {
    if (!c.viva) return;
    c.viva = false; c.muerte = m.anio;
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) m.dueno[i] = quien ? quien.id : -1;
    for (const o of m.civs) o.guerras = o.guerras.filter(g => g.con !== c.id);
    c.guerras = [];
    m.alianzas = (m.alianzas || []).filter(x => x.a !== c.id && x.b !== c.id);
    cronica(m, 'caida', 'Cae ' + c.nombre, quien ? quien.nombre + ' toma la última ciudad de ' + c.nombre + '. Sus dioses pasan a ser leyendas y su lengua, unas pocas palabras en la de los vencedores.' : c.nombre + ' se deshace sin que nadie lo conquiste: sus aldeas se vacían y sus templos se llenan de hierba.', c, c.capital, { importante: true });
  }

  // ---------- Las relaciones entre pueblos ----------
  /*
   * LA OPINIÓN ENTRE REINOS, como en WorldBox: cada uno tiene una opinión objetivo hecha de motivos
   * concretos (compartir frontera, un enemigo común, el carácter del pueblo, el talante de los reyes, las
   * guerras recientes, los tratados) y la opinión real se acerca a ella poco a poco.
   */
  function motivos(m, a, b) {
    const out = [];
    const juntos = vecinosDe(m, a).includes(b);
    out.push(juntos ? ['comparten frontera', -25] : ['no comparten frontera', 10]);
    if (a.guerras.some(g => b.guerras.some(h => h.con === g.con)) && !enGuerra(a, b)) out.push(['enemigo común', 50]);
    out.push(a.caracter === b.caracter ? ['mismo carácter (' + M.CARACTERES[a.caracter].nombre + ')', 15] : ['costumbres distintas', -5]);
    const talante = x => (x.rey ? propio({ pacifico: 10, justo: 5, guerrero: -10, cruel: -10, loco: -15 }, x.rey.rasgo) : 0);
    if (talante(a) + talante(b)) out.push(['el talante de sus gobernantes', talante(a) + talante(b)]);
    if (aliados(m, a, b)) out.push(['son aliados', 30]);
    if ((a.plan && (a.plan.socios || []).includes(b.id)) || (b.plan && (b.plan.socios || []).includes(a.id))) out.push(['tratado de comercio', 20]);
    if (m.vida && (m.vida.rutas || []).some(r => r.tipo === 'externa' && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)))) out.push(['ruta comercial', 15]);
    if (Math.abs(a.era - b.era) >= 2) out.push(['los ven como bárbaros (otra época)', -10]);
    const t = (m.memoria || {})[Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id)];
    if (t != null && m.turno - t < 15) out.push(['guerra reciente', -Math.round(40 * (1 - (m.turno - t) / 15))]);
    if (enGuerra(a, b)) out.push(['están en guerra', -60]);
    return out;
  }
  const opinionObjetivo = (m, a, b) => motivos(m, a, b).reduce((k, x) => k + x[1], 0);

  function diplomacia(m) {
    const lista = vivas(m);
    m.complots = (m.complots || []).filter(p => { const a = civ(m, p.de), b = civ(m, p.contra); return a && a.viva && b && b.viva; });
    for (const a of lista) {
      const vec = vecinosDe(m, a);
      for (const b of lista) {
        if (a.id >= b.id) continue;
        const juntos = vec.includes(b);
        let r = a.rel[b.id] || 0;
        r += (opinionObjetivo(m, a, b) - r) * 0.15 + (azar(m) - 0.5) * 3;
        a.rel[b.id] = b.rel[a.id] = Math.max(-100, Math.min(100, r));
        if (aliados(m, a, b)) { if (r < 0) romper(m, a, b); continue; }
        if (a.jugador || b.jugador || enGuerra(a, b)) continue;
        // Los complots: las guerras y las alianzas se traman antes de pasar (y se ven venir).
        if (r > 25 && aliadosDe(m, a).length < 2 && aliadosDe(m, b).length < 2 && azar(m) < 0.15) tramar(m, 'alianza', a, b);
        if (!juntos) continue;
        const fa = fuerza(m, a), fb = fuerza(m, b);
        const [agresor, victima, fAg, fVi] = fa >= fb ? [a, b, fa, fb] : [b, a, fb, fa];
        const ganas = M.CARACTERES[agresor.caracter].agresion * rasgo(agresor, 'agresion') * (fAg / fVi) * (r < -30 ? 1.6 : 1) * (agresor.estab > 30 ? 1 : 0.4);
        if (!agresor.jugador && agresor.guerras.length < 2 && (r < -40 || (ganas > 2.2 && r < 10)) && azar(m) < 0.08) { const motivo = casusBelli(m, agresor, victima, r, fAg / fVi); if (motivo) tramar(m, 'guerra', agresor, victima, motivo); }
      }
    }
    avanzarComplots(m);
  }

  /*
   * LA LEALTAD DE LAS CIUDADES, como en WorldBox: cada ciudad (no la capital) tiene una lealtad hecha de
   * motivos. Si baja de cero, su alcalde conspira; si el complot llega al 100 %, la ciudad se independiza.
   */
  const maxCiudades = c => 2 + Math.floor(c.era / 2) + (c.rey && c.rey.rasgo === 'constructor' ? 1 : 0);
  function motivosLealtad(m, c, x) {
    const out = [['base', 40]];
    const d = distancia(x.region, c.capital);
    if (d > 8) out.push(['lejos de la capital', -Math.round((d - 8) * 1.2)]);
    const suyas = (m.ciudades || []).filter(y => y.civ === c.id).length;
    if (suyas > maxCiudades(c)) out.push(['demasiadas ciudades (' + suyas + ' de ' + maxCiudades(c) + ')', -15 * (suyas - maxCiudades(c))]);
    const rey = c.rey ? propio({ justo: 10, sabio: 5, constructor: 5, cruel: -15, loco: -20, codicioso: -5 }, c.rey.rasgo) : 0;
    if (rey) out.push(['su ' + titulo(c) + ' es ' + M.RASGOS[c.rey.rasgo].nombre, rey]);
    const alcalde = propio({ leal: 15, ambicioso: -15, codicioso: -5 }, x.rasgo);
    if (alcalde) out.push(['el alcalde es ' + x.rasgo, alcalde]);
    if (x.conquistada != null && m.turno - x.conquistada < 10) out.push(['conquistada hace poco', -Math.round(30 * (1 - (m.turno - x.conquistada) / 10))]);
    if (m.turno - c.ultimaHambre < 4) out.push(['hambre', -15]); else if ((c.comida || 0) > 20) out.push(['graneros llenos', 5]);
    out.push(['estabilidad del reino', Math.round((c.estab - 50) * 0.4)]);
    if (c.guerras.some(g => g.cansancio > 4)) out.push(['cansancio de la guerra', -10]);
    return out;
  }
  function lealtades(m) {
    for (const x of (m.ciudades || []).slice()) {
      const c = civ(m, x.civ);
      if (!c || !c.viva || x.region === c.capital) continue;
      x.motivos = motivosLealtad(m, c, x);
      x.lealtad = x.motivos.reduce((k, y) => k + y[1], 0);
      if (x.lealtad < 0) {
        if (x.complot == null) { x.complot = 0; cronica(m, 'complot', x.alcalde + ' conspira en ' + x.nombre, 'El alcalde de ' + x.nombre + ' reúne a los notables de la ciudad: ya no quieren obedecer a ' + c.nombre + '. ' + (x.motivos.filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0] || ['', 0])[0].replace(/^./, l => l.toUpperCase()) + '.', c, x.region); }
        x.complot += 10 + Math.min(20, -x.lealtad / 3);
        if (x.complot >= 100) rebelarCiudad(m, c, x);
      } else if (x.lealtad >= 10) x.complot = null;
    }
  }
  // La ciudad se independiza con las tierras que tiene alrededor (las que están más cerca de ella que de la capital).
  function rebelarCiudad(m, c, x) {
    const cs = casillas(m, c);
    const parte = cs.filter(i => i !== c.capital && distancia(i, x.region) <= 4 && distancia(i, x.region) < distancia(i, c.capital));
    if (!parte.includes(x.region)) parte.unshift(x.region);
    if (parte.length >= cs.length) return;
    parte.splice(parte.indexOf(x.region), 1); parte.unshift(x.region);
    const nueva = nuevaCiv(m, x.region, { era: c.era, ciencia: c.ciencia * 0.9, pob: c.pob * parte.length / cs.length, riqueza: c.riqueza * 0.2, estab: 55, inventos: c.inventos.slice(), caracter: c.caracter });
    if (!m.civs.some(o => o !== nueva && o.nombre === x.nombre)) nueva.nombre = x.nombre;
    nueva.rey = { nombre: x.alcalde, edad: 40, rasgo: x.rasgo === 'ambicioso' ? 'guerrero' : 'justo', desde: m.anio };
    nueva.origen = c.id;
    for (const i of parte) m.dueno[i] = nueva.id;
    if (m.vida) { nueva.pob = 0.5; nueva.pobVida = null; } else c.pob -= nueva.pob;
    c.estab = Math.max(10, c.estab - 10);
    nueva.regimen = regimenPorEra(m, nueva, parte.length);
    nueva.rel[c.id] = c.rel[nueva.id] = -50;
    m.ciudades = m.ciudades.filter(y => y !== x);
    cronica(m, 'revuelta', x.nombre + ' se independiza de ' + c.nombre, 'El alcalde ' + x.alcalde + ' proclama la independencia de ' + x.nombre + ' y de ' + (parte.length - 1) + ' comarcas de alrededor. ' + c.nombre + ' lo llama traición; ' + x.nombre + ', libertad.', nueva, x.region, { importante: true });
    // A veces la metrópoli no lo acepta.
    if (azar(m) < 0.5 && !c.jugador) declararGuerra(m, c, nueva, c.nombre + ' no acepta la independencia de ' + x.nombre + ' y manda a sus ejércitos a recuperarla.', true);
  }

  // Una guerra necesita un motivo (como los "casus belli" de los complots de WorldBox); sin motivo, no hay complot.
  function casusBelli(m, a, b, r, ratio) {
    if (b.origen === a.id || a.origen === b.id) return 'recuperar las tierras que se independizaron';
    if (r < -40) return 'el odio entre los dos pueblos (opinión ' + Math.round(r) + ')';
    const ambicioso = a.rey && ['guerrero', 'cruel', 'loco'].includes(a.rey.rasgo);
    if (ambicioso && ratio > 1.6 && r < 10) return 'la ambición de ' + nombreRey(a) + ', que ve débil a su vecino';
    const sinMadera = (a.madera || 0) < 5 && (a.arboles || 0) < casillas(m, a).length, sinMetal = a.era >= 1 && (a.metal || 0) < 2;
    if ((sinMadera && (b.arboles || 0) > (a.arboles || 0) * 2) || (sinMetal && (b.metal || 0) > 10)) return 'la codicia de los ' + (sinMadera ? 'bosques' : 'metales') + ' de ' + b.nombre;
    if (ratio > 2.5 && r < 0 && azar(m) < 0.3) return 'la debilidad de ' + b.nombre;
    return null;
  }

  // Un complot nuevo (si no hay ya uno igual): lo trama el gobernante de "de" contra (o con) "contra".
  function tramar(m, tipo, de, contra, motivo) {
    m.complots = m.complots || [];
    if (m.complots.some(p => p.de === de.id && p.tipo === tipo) || m.complots.some(p => p.tipo === tipo && p.de === contra.id && p.contra === de.id)) return;
    const p = { tipo, de: de.id, contra: contra.id, progreso: 0, desde: m.turno, motivo: motivo || null };
    m.complots.push(p);
    if (tipo === 'guerra') cronica(m, 'complot', nombreRey(de) + ' trama una guerra contra ' + contra.nombre, 'En la corte de ' + de.nombre + ' se habla de mapas y de levas. El motivo: ' + (motivo || 'una afrenta que nadie recuerda bien') + '. Si nada lo impide, habrá guerra.', de);
    return p;
  }
  function avanzarComplots(m) {
    for (const p of (m.complots || []).slice()) {
      const a = civ(m, p.de), b = civ(m, p.contra), r = a.rel[b.id] || 0;
      // Se abandonan si las cosas cambian: la opinión mejora, o empeora para una alianza.
      const sigue = p.tipo === 'guerra' ? r < 25 && !aliados(m, a, b) && a.guerras.length < 2 && !enGuerra(a, b) : r > 10 && !enGuerra(a, b) && !aliados(m, a, b);
      if (!sigue) { m.complots = m.complots.filter(x => x !== p); continue; }
      p.progreso += p.tipo === 'guerra' ? 7 + 5 * rasgo(a, 'agresion') + azar(m) * 6 : 12 + azar(m) * 10;
      if (p.progreso < 100) continue;
      m.complots = m.complots.filter(x => x !== p);
      if (p.tipo === 'guerra') declararGuerra(m, a, b, a.nombre + ' declara la guerra a ' + b.nombre + '. Motivo: ' + (p.motivo || 'una vieja afrenta') + '.');
      else aliar(m, a, b);
    }
  }

  function declararGuerra(m, a, b, motivo, sinAliados) {
    if (enGuerra(a, b) || a === b) return;
    if (aliados(m, a, b)) romper(m, a, b, a.nombre + ' traiciona a su aliado ' + b.nombre + ': la alianza se rompe el mismo día que cruzan la frontera.');
    a.guerras.push({ con: b.id, desde: m.turno, cansancio: 0 });
    b.guerras.push({ con: a.id, desde: m.turno, cansancio: 0 });
    m.complots = (m.complots || []).filter(p => !(p.tipo === 'guerra' && p.de === a.id && p.contra === b.id));
    a.rel[b.id] = b.rel[a.id] = Math.min(a.rel[b.id] || 0, -50);
    const e = cronica(m, 'guerra', 'Guerra entre ' + a.nombre + ' y ' + b.nombre, motivo || (a.nombre + ' cruza la frontera de ' + b.nombre + '. ' + elegir(m, ['Dicen que por un pozo.', 'Dicen que por un insulto a sus dioses.', 'Dicen que por unas ovejas.', 'Dicen que por un matrimonio que no se celebró.', 'Nadie recuerda ya por qué.'])), a, frontera(m, b, a)[0]);
    // Los aliados entran: los de la víctima casi siempre (para eso juraron), los del agresor a veces.
    if (!sinAliados) {
      for (const o of aliadosDe(m, b)) if (o !== a && !aliados(m, o, a) && !enGuerra(o, a) && (o.jugador || azar(m) < 0.75)) declararGuerra(m, o, a, o.nombre + ' cumple su palabra y entra en la guerra para defender a su aliado ' + b.nombre + '.', true);
      for (const o of aliadosDe(m, a)) if (o !== b && !o.jugador && !aliados(m, o, b) && !enGuerra(o, b) && azar(m) < 0.4) declararGuerra(m, o, b, o.nombre + ' se suma a la guerra de su aliado ' + a.nombre + ' contra ' + b.nombre + '.', true);
      m.ultimo = e;
    }
    return e;
  }

  function hacerPaz(m, a, b, motivo) {
    (m.memoria = m.memoria || {})[Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id)] = m.turno;
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
      const empuje = 1 + 0.25 * Math.tanh(batallas / 6);
      const fa = fuerza(m, a) * empuje, fb = fuerza(m, b) / empuje;
      const [gana, pierde, ratio] = fa >= fb ? [a, b, fa / fb] : [b, a, fb / fa];
      // Las batallas ganan algo de frontera cada año; las plazas se toman con asedios (vida.js).
      const k = Math.max(0, Math.min(3, Math.round(((ratio - 1) * 2 + (azar(m) - 0.4)) * 1.1)));
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
      const cansados = cansancio > 6 + azar(m) * 6 || (ratio < 1.15 && cansancio > 4 && azar(m) < 0.3);
      // Con un jugador de por medio, la IA no firma sola: ofrece la paz y el jugador decide.
      const jugador = a.jugador ? a : b.jugador ? b : null;
      const otroJ = jugador ? (jugador === a ? b : a) : null;
      // El gobierno automático del jugador firma solo la paz en las guerras que no empezó él (salvo que el ejército sea su máxima prioridad).
      if (cansados && jugador && !((jugador.plan && jugador.plan.guerrasMias) || []).includes(otroJ.id) && prio(jugador, 'ejercito') < 2) {
        hacerPaz(m, a, b, 'Tu gobierno y ' + otroJ.nombre + ' firman la paz: la guerra la empezaron ellos y ya no daba para más. Si quieres seguir luchando, ordénalo.');
      } else if (cansados && jugador) {
        const otro = otroJ;
        m.ofertas = m.ofertas || {};
        if (!m.ofertas[otro.id] || m.turno - m.ofertas[otro.id] > 12) {
          m.ofertas[otro.id] = m.turno;
          cronica(m, 'paz', otro.nombre + ' te ofrece la paz', 'Llegan emisarios de ' + otro.nombre + ' con regalos y cara de cansancio. Si la quieres, escribe «acepto la paz con ' + otro.nombre + '».', otro, null, { importante: true });
        }
      } else if (cansados) hacerPaz(m, a, b);
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
    // Sequías: unos años sin lluvia, sin cosecha y sin pasto (vida.js los cumple en los campos y los rebaños).
    if (m.vida && azar(m) < 0.04) {
      const c = elegir(m, lista);
      if (!c.efectos.some(e => e.sequia)) {
        c.efectos.push({ sequia: true, hasta: m.turno + 3 + Math.floor(azar(m) * 4) });
        cronica(m, 'sequia', 'Sequía en ' + c.nombre, 'No llueve. El trigo se seca en los campos de ' + c.nombre + ', los pastos amarillean y las reses empiezan a morir. Habrá que vivir de lo guardado.', c);
      }
    }
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

  M.sim = { W, H, K, TIERRA, TALADO, crear, turno, azar, elegir, idx, xy, vecinos, distancia, esTierra, fertil, casillas, capacidad, fuerza, vecinosDe, enGuerra, civ, vivas,
    cronica, subirEra, casusBelli, maxCiudades, motivosLealtad, aliados, aliadosDe, aliar, romper, motivos, opinionObjetivo, tramar, destinoRumbo, gobernante, nombreRey, titulo, nombrePersona, nombre, PRIORIDADES, prio, separar, morir, declararGuerra, hacerPaz, plaga, nuevoPueblo, nuevaCiv, regimenPorEra, resumen, anioTexto, miles, frontera };
})(globalThis.RF = globalThis.RF || {});
