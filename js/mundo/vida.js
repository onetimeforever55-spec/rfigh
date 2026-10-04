/*
 * GÉNESIS · LA VIDA
 * Cada región del mapa se parte en 4×4 parcelas con su árbol, su roca o su obra, y por ellas caminan los
 * aldeanos de cada pueblo: leñadores que talan, granjeros que siembran, constructores que levantan casas,
 * mineros que pican piedra y guerreros que marchan a la frontera cuando hay guerra.
 *
 * Lo que hacen mueve la economía: la madera y la piedra pagan las tierras nuevas y las casas, las casas y
 * los campos dan sitio a más gente, las batallas que ganan los guerreros inclinan la guerra, y un bosque
 * talado hasta el último árbol se queda en llanura.
 *
 * Todo pasa dentro del turno (TICKS pasos) con un azar propio guardado en el mundo: sigue siendo
 * reproducible. Cada aldeano guarda su recorrido del turno y cada parcela que cambia queda anotada con el
 * paso en que cambió, para que la vista lo anime sin adelantarse.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO;
  const S = () => M.sim;
  const SUB = 4, TICKS = 8, MAX_ALDEANOS = 260;
  const OBRA = { nada: 0, casa: 1, campo: 2, centro: 3, ruina: 4, ayuntamiento: 5 };
  const OFICIOS = ['lenador', 'granjero', 'constructor', 'minero', 'guerrero'];
  const [LENADOR, GRANJERO, CONSTRUCTOR, MINERO, GUERRERO] = [0, 1, 2, 3, 4];
  // Estados del aldeano y lo que hace en cada paso (la vista elige el dibujo con esto).
  const [LIBRE, IR, TRABAJAR, VOLVER, ESPERAR] = [0, 1, 2, 3, 4];
  const ACC = { andar: 0, trabajar: 1, luchar: 2, cargar: 3 };

  // Las armas de cada era: lo que lleva un guerrero si su pueblo tiene metal para forjarlas (si no, un garrote).
  const ARMAS = [
    { nombre: 'garrote', poder: 1 }, { nombre: 'lanza de bronce', poder: 1.4 }, { nombre: 'espada de hierro', poder: 1.8 }, { nombre: 'espada y escudo', poder: 2.1 },
    { nombre: 'espada y cota de malla', poder: 2.4 }, { nombre: 'arcabuz y pica', poder: 2.9 }, { nombre: 'mosquete y bayoneta', poder: 3.4 }, { nombre: 'fusil', poder: 4.1 }, { nombre: 'fusil automático', poder: 5 }
  ];
  const TIROS = ['honda', 'arco', 'arco', 'arco largo', 'ballesta', 'arcabuz', 'mosquete', 'fusil', 'fusil automático'];
  const poder = a => ARMAS[a.arma || 0].poder * (a.armadura ? 1.35 : 1);
  // Vetas: en montañas y colinas hay hierro (metal) y oro.
  const MENAS = { montana: [0.22, 0.07], colina: [0.12, 0.03], desierto: [0.05, 0.03], tundra: [0.06, 0.02] };

  // Árboles y rocas al crear el mundo, según el suelo de la parcela.
  const ARBOLES = { bosque: 0.78, selva: 0.85, taiga: 0.7, pantano: 0.32, sabana: 0.1, colina: 0.22, llanura: 0.07, tundra: 0.06, nieve: 0.1, desierto: 0.03 };
  const ROCAS = { montana: 0.45, colina: 0.12, desierto: 0.06, nieve: 0.05, tundra: 0.07, llanura: 0.015, bosque: 0.02, taiga: 0.03, sabana: 0.02 };
  // Lo que brota solo cada turno junto a otro árbol (la naturaleza recupera lo que se deja).
  const BROTE = { bosque: 0.035, selva: 0.05, taiga: 0.025, pantano: 0.015, sabana: 0.005, colina: 0.025, llanura: 0.006, tundra: 0.002, nieve: 0.004, desierto: 0.0015 };
  const CONSTRUIBLE = new Set(['llanura', 'colina', 'bosque', 'desierto', 'nieve', 'arena', 'sabana', 'selva', 'taiga', 'tundra', 'pantano']);
  const CULTIVABLE = new Set(['llanura', 'colina', 'bosque', 'sabana', 'selva']);

  function azar(v) {
    let t = (v.rng = (v.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- El suelo de cada parcela ----------
  const esAgua = t => t === 'mar' || t === 'costa';
  function aguaEn(m, rx, ry) { return rx >= 0 && ry >= 0 && rx < m.W && ry < m.H && esAgua(m.tipo[ry * m.W + rx]); }
  function uneRio(m, rx, ry) {
    if (rx < 0 || ry < 0 || rx >= m.W || ry >= m.H) return false;
    const j = ry * m.W + rx;
    return m.rio[j] || esAgua(m.tipo[j]);
  }
  // Los ríos pasan por la fila y la columna 1 de cada región y se unen con los vecinos que también son río o mar.
  function esRio(m, rx, ry, lx, ly) {
    if (lx === 1 && ly === 1) return true;
    if (ly === 1 && lx < 1) return uneRio(m, rx - 1, ry);
    if (ly === 1 && lx > 1) return uneRio(m, rx + 1, ry);
    if (lx === 1 && ly < 1) return uneRio(m, rx, ry - 1);
    if (lx === 1 && ly > 1) return uneRio(m, rx, ry + 1);
    return false;
  }
  function terreno(m, tx, ty) {
    const rx = (tx / SUB) | 0, ry = (ty / SUB) | 0, tipo = m.tipo[ry * m.W + rx];
    if (tipo === 'mar') return 'agua';
    if (tipo === 'costa') return 'bajo';
    const lx = tx - rx * SUB, ly = ty - ry * SUB;
    if (m.rio[ry * m.W + rx] && esRio(m, rx, ry, lx, ly)) return 'rio';
    if (tipo !== 'nieve' && tipo !== 'montana' &&
      ((lx === 0 && aguaEn(m, rx - 1, ry)) || (lx === SUB - 1 && aguaEn(m, rx + 1, ry)) || (ly === 0 && aguaEn(m, rx, ry - 1)) || (ly === SUB - 1 && aguaEn(m, rx, ry + 1)))) return 'arena';
    return tipo;
  }
  // El suelo solo cambia cuando cambia una región (un bosque talado, un terremoto): se guarda calculado.
  let cache = { m: null, firma: '', arr: null };
  function terrenos(m) {
    const firma = m.tipo.join(',');
    if (cache.m === m && cache.firma === firma) return cache.arr;
    const tw = m.W * SUB, th = m.H * SUB, arr = new Array(tw * th);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) arr[ty * tw + tx] = terreno(m, tx, ty);
    cache = { m, firma, arr };
    return arr;
  }
  const region = (m, t) => { const tw = m.W * SUB; return (((t / tw) | 0) / SUB | 0) * m.W + ((t % tw) / SUB | 0); };
  const centro = (m, r) => { const tw = m.W * SUB; return ((r / m.W | 0) * SUB + 2) * tw + (r % m.W) * SUB + 2; };
  const parcelas = (m, r) => {
    const tw = m.W * SUB, x0 = (r % m.W) * SUB, y0 = (r / m.W | 0) * SUB, out = [];
    for (let y = 0; y < SUB; y++) for (let x = 0; x < SUB; x++) out.push((y0 + y) * tw + x0 + x);
    return out;
  };
  const dist = (m, a, b) => { const tw = m.W * SUB; return Math.abs(a % tw - b % tw) + Math.abs((a / tw | 0) - (b / tw | 0)); };
  const andable = (ter, era) => ter !== 'agua' && (ter !== 'bajo' || era >= 5);

  // ---------- Crear la vida de un mundo ----------
  function crear(m) {
    const tw = m.W * SUB, th = m.H * SUB, n = tw * th;
    const v = {
      tw, th, rng: (m.semilla ^ 0x9E3779B9) >>> 0, arbol: new Array(n).fill(0), roca: new Array(n).fill(0), obra: new Array(n).fill(0), mena: new Array(n).fill(0), ejercitos: {}, disparos: [],
      fueBosque: new Array(m.W * m.H).fill(0), tipoVisto: m.tipo.slice(), aldeanos: [], sig: 0, centros: {}, cambios: [], avisos: {}
    };
    m.vida = v;
    const ter = terrenos(m);
    for (let t = 0; t < n; t++) {
      const r = azar(v), pa = ARBOLES[ter[t]] || 0, pr = ROCAS[ter[t]] || 0;
      if (r < pa) v.arbol[t] = azar(v) < 0.75 ? 3 : 2;
      else if (r < pa + pr) { v.roca[t] = 1 + Math.floor(azar(v) * 3); const [ph, po] = MENAS[ter[t]] || [0.04, 0.01], q = azar(v); v.mena[t] = q < po ? 2 : q < po + ph ? 1 : 0; }
    }
    for (const c of S().vivas(m)) { c.madera = c.madera || 6; c.piedra = c.piedra || 0; c.metal = c.metal || 0; c.oro = c.oro || 0; }
    centros(m);
    sincronizar(m);
    contar(m);
    return v;
  }

  // Anota un cambio de parcela con el paso en que ocurre (la vista lo aplica en ese momento).
  function cambiar(m, capa, t, valor, paso) {
    const v = m.vida;
    if (v[capa][t] === valor) return;
    v.cambios.push([capa === 'arbol' ? 0 : capa === 'roca' ? 1 : 2, t, v[capa][t], valor, paso]);
    v[capa][t] = valor;
  }

  // La plaza de cada capital: 2×2 parcelas en el centro de su región. Las capitales perdidas quedan en ruinas.
  function centros(m) {
    const v = m.vida;
    for (const id of Object.keys(v.centros)) {
      const c = S().civ(m, +id), r = v.centros[id];
      if (c && c.viva && c.capital === r) continue;
      for (const t of plaza(m, r)) if (v.obra[t] === OBRA.centro) cambiar(m, 'obra', t, OBRA.ruina, 0);
      delete v.centros[id];
    }
    for (const c of S().vivas(m)) {
      if (c.madera == null) { c.madera = 6; c.piedra = 0; c.casas = 0; c.campos = 0; }
      if (c.metal == null) { c.metal = 0; c.oro = 0; }
      if (v.centros[c.id] === c.capital) continue;
      for (const t of plaza(m, c.capital)) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
      v.centros[c.id] = c.capital;
    }
  }
  function plaza(m, r) { const tw = m.W * SUB, x = (r % m.W) * SUB + 1, y = (r / m.W | 0) * SUB + 1; return [y * tw + x, y * tw + x + 1, (y + 1) * tw + x, (y + 1) * tw + x + 1]; }

  // ---------- Los aldeanos de cada pueblo ----------
  const cuantos = c => Math.max(3, Math.min(40, Math.round(2 + Math.sqrt(Math.max(0, c.pob)) * 1.5)));

  /*
   * EL GOBERNADOR AUTOMÁTICO: cada pueblo (también el del jugador) reparte el trabajo según lo que le falta.
   * Poca madera → más leñadores; la gente cerca del límite de comida → más granjeros; faltan casas → más
   * constructores; guerra → guerreros. Las prioridades del jugador (0 a 2) pesan sobre esas necesidades.
   */
  const PRIO_OFICIO = ['madera', 'comida', 'casas', 'piedra', 'ejercito'];
  const prio = (c, k) => (c.plan && c.plan.prioridad && c.plan.prioridad[k] != null ? c.plan.prioridad[k] : 1);
  const metaMadera = c => 30 + 12 * c.era;
  function reparto(c, recursos) {
    const guerra = c.guerras.length > 0;
    const lleno = c.cap ? c.pob / c.cap : 0.8;
    const p = [
      recursos.arboles ? 0.18 + 0.4 * Math.max(0, 1 - (c.madera || 0) / metaMadera(c)) : 0,
      0.22 + Math.max(0, lleno - 0.75) * 1.6 + ((c.campos || 0) < metaCampos(c) ? 0.08 : 0),
      (c.casas || 0) < metaCasas(c) ? 0.16 : 0.06,
      recursos.rocas ? (c.era >= 1 ? 0.08 + ((c.piedra || 0) < 20 ? 0.06 : 0) : 0.04) : 0,
      guerra ? 0.6 : c.era >= 2 ? 0.07 : 0.04
    ];
    for (let i = 0; i < p.length; i++) {
      const w = prio(c, PRIO_OFICIO[i]);
      p[i] *= w === 0 ? 0.03 : w;
    }
    const suma = p.reduce((k, x) => k + x, 0) || 1;
    return p.map(x => x / suma);
  }

  function hogar(m, c, cs) {
    const v = m.vida;
    if (azar(v) < 0.4 || cs.length < 2) return c.capital;
    const suyas = (m.ciudades || []).filter(x => x.civ === c.id);
    if (suyas.length && azar(v) < 0.4) return suyas[Math.floor(azar(v) * suyas.length)].region;
    return cs[Math.floor(azar(v) * cs.length)];
  }

  function sincronizar(m, recursosDe, soloQuitar) {
    const v = m.vida, vivas = S().vivas(m), porCiv = {};
    // Los aldeanos de pueblos muertos desaparecen; los que perdieron su casa se mudan.
    v.aldeanos = v.aldeanos.filter(a => { const c = S().civ(m, a.c); return c && c.viva; });
    const deseados = {};
    let total = 0;
    for (const c of vivas) { deseados[c.id] = cuantos(c); total += deseados[c.id]; }
    const escala = total > MAX_ALDEANOS ? MAX_ALDEANOS / total : 1;
    for (const c of vivas) { deseados[c.id] = Math.max(2, Math.floor(deseados[c.id] * escala)); porCiv[c.id] = []; }
    for (const a of v.aldeanos) porCiv[a.c].push(a);
    const quitar = new Set();
    for (const c of vivas) {
      const cs = S().casillas(m, c), lista = porCiv[c.id];
      for (const a of lista) if (m.dueno[a.h] !== c.id) a.h = hogar(m, c, cs);
      // Sobran: se van los que están libres primero.
      if (lista.length > deseados[c.id]) {
        const orden = lista.slice().sort((x, y) => (x.e === LIBRE ? 0 : 1) - (y.e === LIBRE ? 0 : 1) || y.id - x.id);
        for (const a of orden.slice(0, lista.length - deseados[c.id])) quitar.add(a);
      }
      // Faltan: nacen en su aldea (unos pocos por turno: tras una peste, el pueblo tarda en recuperarse).
      const tope = !lista.length ? deseados[c.id] : soloQuitar ? lista.length : Math.min(deseados[c.id], lista.length + 3);
      for (let k = lista.length; k < tope; k++) {
        const h = hogar(m, c, cs), t = centro(m, h);
        const a = { id: v.sig++, c: c.id, o: GRANJERO, x: t % v.tw, y: t / v.tw | 0, h, e: LIBRE, tx: -1, ty: -1, t: 0, k: 0, q: 0, r: [] };
        v.aldeanos.push(a); lista.push(a);
      }
    }
    if (quitar.size) v.aldeanos = v.aldeanos.filter(a => !quitar.has(a));
    // Oficios: los libres cambian de oficio para cubrir lo que falta en su pueblo.
    for (const c of vivas) {
      const lista = v.aldeanos.filter(a => a.c === c.id), p = reparto(c, recursosDe ? recursosDe[c.id] : { arboles: 1, rocas: 1 });
      const tiene = [0, 0, 0, 0, 0];
      for (const a of lista) tiene[a.o]++;
      for (const a of lista) {
        // En guerra se llama a las armas a cualquiera que no vaya cargado; en paz, solo cambian los que están libres.
        const llamada = c.guerras.length && !a.k && a.o !== GUERRERO;
        if (!llamada && a.e !== LIBRE && a.e !== ESPERAR && !a.paseo && !(a.o === GUERRERO && !c.guerras.length && prio(c, 'ejercito') <= 1)) continue;
        const falta = p.map((x, i) => x * lista.length - tiene[i] + (i === a.o ? 1 : 0));
        const mejor = falta.indexOf(Math.max(...falta));
        if (mejor !== a.o && falta[mejor] - (falta[a.o] - 1) >= 1) { tiene[a.o]--; tiene[mejor]++; a.o = mejor; a.e = LIBRE; a.k = 0; a.paseo = 0; }
      }
    }
    equipar(m);
  }

  // La armería: los guerreros reciben el arma de su era si hay metal (y armadura si sobra); los demás, un garrote.
  function equipar(m) {
    const v = m.vida;
    for (const a of v.aldeanos) {
      if (a.o !== GUERRERO) continue;
      const c = S().civ(m, a.c);
      if (!c) continue;
      if (a.tirador == null) a.tirador = c.era >= 5 ? a.id % 3 !== 0 : a.id % 3 === 0;
      if (c.era >= 5 && !a.tirador && a.id % 3 !== 0) a.tirador = true;
      const quiere = c.era;
      if ((a.arma || 0) < quiere && (c.era === 0 || (c.metal || 0) >= 1)) { if (c.era > 0) c.metal -= 1; a.arma = quiere; }
      if (!a.armadura && c.era >= 2 && (c.metal || 0) >= 2) { c.metal -= 1; a.armadura = 1; }
    }
  }

  /*
   * LOS EJÉRCITOS: en guerra, los guerreros de un pueblo se reúnen junto a la frontera tras su capitán y
   * marchan juntos hacia una región del enemigo (la más cercana a su capital, para llegar al corazón del reino).
   */
  function ejercitos(m) {
    const v = m.vida;
    for (const id of Object.keys(v.ejercitos)) { const c = S().civ(m, +id); if (!c || !c.viva || !c.guerras.length) delete v.ejercitos[id]; }
    for (const c of S().vivas(m)) {
      if (!c.guerras.length) continue;
      const suyos = v.aldeanos.filter(a => a.c === c.id && a.o === GUERRERO);
      let e = v.ejercitos[c.id];
      const o = e && S().civ(m, e.con);
      const valido = e && o && o.viva && S().enGuerra(c, o) && m.dueno[e.obj] === o.id;
      if (!valido) {
        e = null;
        for (const g of c.guerras) {
          const enemigo = S().civ(m, g.con);
          if (!enemigo || !enemigo.viva) continue;
          const frente = S().frontera(m, c, enemigo);
          if (!frente.length) continue;
          const obj = frente.sort((x, y) => S().distancia(x, enemigo.capital) - S().distancia(y, enemigo.capital))[0];
          const nuestro = S().frontera(m, enemigo, c).sort((x, y) => S().distancia(x, obj) - S().distancia(y, obj))[0];
          e = { con: enemigo.id, obj, reunion: nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno };
          break;
        }
        if (e) v.ejercitos[c.id] = e; else { delete v.ejercitos[c.id]; continue; }
      }
      // Si un ejército enemigo ataca una de nuestras regiones, vamos a defenderla: ahí se encuentran los dos.
      for (const g of c.guerras) {
        const ee = v.ejercitos[g.con];
        if (ee && ee.con === c.id && m.dueno[ee.obj] === c.id && ee.fase === 'marcha' && e.fase === 'reunion') { e.defiende = ee.obj; e.fase = 'marcha'; }
      }
      if (e.defiende != null && m.dueno[e.defiende] !== c.id) e.defiende = null;
      e.capitan = suyos.length ? Math.min(...suyos.map(a => a.id)) : null;
      if (e.fase === 'reunion') {
        const base = centro(m, e.reunion);
        const juntos = suyos.filter(a => dist(m, a.y * v.tw + a.x, base) <= 5).length;
        if (juntos >= suyos.length * 0.5 || m.turno - e.desde >= 2) { e.fase = 'marcha'; for (const a of suyos) if (a.e === ESPERAR || a.paseo) a.e = LIBRE; }
      }
    }
  }

  // ---------- Lo que hay al alcance de cada pueblo ----------
  function recursos(m) {
    const v = m.vida, out = {}, reservadas = new Set();
    for (const a of v.aldeanos) if (a.e === IR || a.e === TRABAJAR) reservadas.add(a.ty * v.tw + a.tx);
    for (const c of S().vivas(m)) out[c.id] = { arboles: [], rocas: [], metales: [], cs: [], reservadas, enemigos: [] };
    const ter = terrenos(m);
    // Las regiones propias y las libres que tocan el territorio.
    const alcance = {};
    for (let r = 0; r < m.W * m.H; r++) {
      const d = m.dueno[r];
      if (d >= 0 && out[d]) { out[d].cs.push(r); (alcance[r] = alcance[r] || new Set()).add(d); }
      if (d < 0 && !esAgua(m.tipo[r])) for (const w of S().vecinos(r)) { const o = m.dueno[w]; if (o >= 0 && out[o]) (alcance[r] = alcance[r] || new Set()).add(o); }
    }
    for (const r of Object.keys(alcance)) {
      for (const t of parcelas(m, +r)) {
        const arbol = v.arbol[t] >= 2, roca = v.roca[t] > 0;
        if (!arbol && !roca) continue;
        for (const id of alcance[r]) { if (arbol) out[id].arboles.push(t); else if (ter[t] !== 'agua') { out[id].rocas.push(t); if (v.mena && v.mena[t]) out[id].metales.push(t); } }
      }
    }
    for (const c of S().vivas(m)) {
      for (const g of c.guerras) { const o = S().civ(m, g.con); if (o && o.viva) out[c.id].enemigos.push({ id: o.id, frente: S().frontera(m, c, o) }); }
    }
    return out;
  }

  // ---------- Un turno de vida ----------
  function turno(m) {
    if (!m.vida) crear(m);
    const v = m.vida;
    v.cambios = []; v.muertos = []; v.disparos = [];
    v.mena = v.mena || new Array(v.tw * v.th).fill(0); v.ejercitos = v.ejercitos || {};
    centros(m);
    let rec = recursos(m);
    sincronizar(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length })));
    rec = recursos(m);
    ejercitos(m);
    const ter = terrenos(m);
    for (const a of v.aldeanos) a.r = [a.x, a.y, a.e === TRABAJAR ? ACC.trabajar : a.k ? ACC.cargar : ACC.andar];
    for (let paso = 1; paso <= TICKS; paso++) {
      // Dónde está cada guerrero, para que se encuentren en la frontera.
      const guerreros = new Map();
      for (const a of v.aldeanos) if (a.o === GUERRERO) { const t = a.y * v.tw + a.x; (guerreros.get(t) || guerreros.set(t, []).get(t)).push(a); }
      const muertos = new Set();
      for (const a of v.aldeanos) if (!muertos.has(a)) actuar(m, a, rec[a.c], ter, paso, guerreros, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    }
    naturaleza(m, ter);
    contar(m);
    ciudades(m);
    // La leña de cada día: cocinar, calentarse y, desde la Edad del Hierro, las forjas; en la era industrial, el carbón vegetal.
    for (const c of S().vivas(m)) c.madera = Math.max(0, c.madera - Math.sqrt(Math.max(0, c.pob)) * 0.18 * (1 + c.era * 0.3));
  }
  const mapa = (o, f) => { const r = {}; for (const k of Object.keys(o)) r[k] = f(o[k]); return r; };

  function actuar(m, a, rec, ter, paso, guerreros, muertos) {
    const v = m.vida, c = S().civ(m, a.c);
    let acc = a.k ? ACC.cargar : ACC.andar;
    if (!rec || !c) return;
    if (a.e === LIBRE) elegirTarea(m, a, c, rec, ter);
    // Un guerrero que ve a un enemigo cerca carga contra él (los tiradores se quedan a distancia y disparan).
    if (a.o === GUERRERO && c.guerras.length && !a.tirador && a.e !== TRABAJAR) {
      let cerca = null;
      for (let r = 1; r <= 4 && !cerca; r++) for (let dy = -r; dy <= r && !cerca; dy++) for (const dx of [r - Math.abs(dy), -(r - Math.abs(dy))]) {
        const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
        cerca = lista && lista.find(b => b !== a && !muertos.has(b) && c.guerras.some(g => g.con === b.c));
        if (cerca) break;
      }
      if (cerca) { a.tx = cerca.x; a.ty = cerca.y; a.e = IR; a.q = 0; a.paseo = 0; }
    }
    if (a.e === IR || a.e === VOLVER) {
      if (a.x === a.tx && a.y === a.ty) llegar(m, a, c, rec, ter, paso);
      else if (!andar(m, a, c, ter)) { a.e = LIBRE; a.k = 0; }
    } else if (a.e === TRABAJAR) {
      acc = ACC.trabajar;
      if (--a.t <= 0) terminar(m, a, c, rec, ter, paso);
    } else if (a.e === ESPERAR) {
      if (--a.t <= 0) a.e = LIBRE;
    }
    // Los guerreros luchan: cuerpo a cuerpo con el enemigo de al lado; los tiradores disparan desde lejos.
    if (a.o === GUERRERO && c.guerras.length) {
      const enemigo = b => b !== a && !muertos.has(b) && c.guerras.some(g => g.con === b.c);
      let rival = null;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
        rival = lista && lista.find(enemigo);
        if (rival) break;
      }
      if (rival) {
        const pa = poder(a), pb = poder(rival);
        const gana = azar(v) < pa / (pa + pb) ? a : rival, pierde = gana === a ? rival : a;
        muertos.add(pierde); v.muertos.push([pierde.x, pierde.y, pierde.c, 'batalla', paso]);
        const g = S().civ(m, gana.c); g.victorias = (g.victorias || 0) + 1;
        acc = ACC.luchar;
      } else if (a.tirador && c.era >= 1) {
        const alcance = c.era >= 5 ? 4 : 3;
        let blanco = null;
        for (let dy = -alcance; dy <= alcance && !blanco; dy++) for (let dx = -alcance; dx <= alcance && !blanco; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > alcance || (!dx && !dy)) continue;
          const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
          blanco = lista && lista.find(enemigo);
        }
        if (blanco && azar(v) < 0.6) {
          // Una flecha (o una bala) vuela: se dibuja en este paso.
          v.disparos.push([a.x, a.y, blanco.x, blanco.y, paso, c.era >= 5 ? 1 : 0]);
          const pa = poder(a), pb = poder(blanco);
          if (azar(v) < 0.3 * pa / (pa + pb) * 2) { muertos.add(blanco); v.muertos.push([blanco.x, blanco.y, blanco.c, 'flecha', paso]); c.victorias = (c.victorias || 0) + 1; }
          acc = ACC.luchar;
          // El tirador se para a disparar: deshace el paso de este turno si iba andando.
          if (a.e === IR) { a.x = a.r[a.r.length - 3]; a.y = a.r[a.r.length - 2]; }
        }
      }
      if (muertos.has(a)) return;
    }
    a.r.push(a.x, a.y, acc);
  }

  function ir(a, t, tw, estado) { a.tx = t % tw; a.ty = t / tw | 0; a.e = estado; a.q = 0; }
  function pasear(m, a, ter, c) {
    const v = m.vida, base = centro(m, a.h);
    for (let k = 0; k < 6; k++) {
      const t = base + Math.round((azar(v) - 0.5) * 6) + Math.round((azar(v) - 0.5) * 6) * v.tw;
      if (t >= 0 && t < ter.length && andable(ter[t], c.era) && dist(m, t, base) <= 4) { ir(a, t, v.tw, IR); a.paseo = 1; return; }
    }
    a.e = ESPERAR; a.t = 2;
  }
  function cercano(m, a, lista, reservadas, max) {
    const v = m.vida, aqui = a.y * v.tw + a.x;
    let mejor = -1, md = max;
    const n = Math.min(14, lista.length);
    for (let k = 0; k < n; k++) {
      const t = lista[Math.floor(azar(v) * lista.length)];
      if (reservadas.has(t)) continue;
      const d = dist(m, aqui, t);
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  function elegirTarea(m, a, c, rec, ter) {
    const v = m.vida;
    a.paseo = 0;
    if (a.k) { ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    let t = -1;
    if (a.o === LENADOR && c.madera < (60 + 20 * c.era) * prio(c, 'madera') * 1.5) t = cercano(m, a, rec.arboles, rec.reservadas, 16);
    else if (a.o === MINERO) {
      // Con la Edad del Bronce, los mineros buscan vetas de metal para la armería; si no, piedra.
      const faltaMetal = c.era >= 1 && (c.metal || 0) < 8 + 4 * c.era;
      if (faltaMetal && rec.metales.length && azar(v) < 0.7) t = cercano(m, a, rec.metales, rec.reservadas, 18);
      if (t < 0 && c.piedra < (30 + 10 * c.era) * Math.max(0.5, prio(c, 'piedra'))) t = cercano(m, a, rec.rocas, rec.reservadas, 16);
    }
    else if (a.o === GRANJERO) t = c.campos < metaCampos(c) ? libre(m, a, c, rec, ter, CULTIVABLE) : -1;
    else if (a.o === CONSTRUCTOR) t = c.casas < metaCasas(c) && c.madera >= 2 ? libre(m, a, c, rec, ter, CONSTRUIBLE) : -1;
    else if (a.o === GUERRERO && v.ejercitos[c.id]) {
      // En formación detrás del capitán: primero al punto de reunión, luego a por el objetivo.
      const e = v.ejercitos[c.id], base = centro(m, e.defiende != null ? e.defiende : e.fase === 'reunion' ? e.reunion : e.obj);
      const dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 3) - 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t], c.era)) t = base;
      if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 2; return; }
    }
    if (t >= 0) { ir(a, t, v.tw, IR); rec.reservadas.add(t); return; }
    // Sin tarea: los granjeros cuidan un campo, los demás pasean por su aldea.
    if (a.o === GRANJERO && c.campos > 0 && azar(v) < 0.7) {
      const campos = parcelas(m, a.h).filter(x => v.obra[x] === OBRA.campo);
      if (campos.length) { ir(a, campos[Math.floor(azar(v) * campos.length)], v.tw, IR); a.paseo = 2; return; }
    }
    pasear(m, a, ter, c);
  }
  const metaCampos = c => Math.round((4 + c.pob * 0.22) * (0.6 + 0.4 * prio(c, 'comida')));
  const metaCasas = c => Math.round((2 + c.pob * 0.12) * (0.4 + 0.6 * prio(c, 'casas')));

  // Una parcela libre cerca de casa: primero en su región, luego en las regiones propias de alrededor.
  function libre(m, a, c, rec, ter, sirve) {
    const v = m.vida, base = centro(m, a.h);
    const regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 99;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.arbol[t] >= 2 || !sirve.has(ter[t]) || rec.reservadas.has(t)) continue;
      const d = dist(m, base, t) + azar(v) * 1.5;
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Un paso hacia el destino por tierra (o en barca desde el Renacimiento).
  function andar(m, a, c, ter) {
    const v = m.vida;
    if (++a.q > 40) return false;
    const opciones = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const ahora = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y);
    let mejor = null, mv = 1e9;
    for (const [dx, dy] of opciones) {
      const x = a.x + dx, y = a.y + dy;
      if (x < 0 || y < 0 || x >= v.tw || y >= v.th || !andable(ter[y * v.tw + x], c.era)) continue;
      const d = Math.abs(a.tx - x) + Math.abs(a.ty - y) + azar(v) * 0.9;
      if (d < mv) { mv = d; mejor = [x, y]; }
    }
    if (!mejor) return false;
    // Atascado detrás de agua: un paso a un lado para rodearla.
    if (mv >= ahora + 0.9 && a.q > 20) return false;
    a.x = mejor[0]; a.y = mejor[1];
    return true;
  }

  function llegar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    if (a.e === VOLVER) {
      // Descarga en la aldea: aquí entra la madera y la piedra en la economía del pueblo.
      if (a.o === LENADOR) c.madera += a.k;
      else if (a.o === MINERO) { if (a.kt === 1) c.metal = (c.metal || 0) + a.k; else if (a.kt === 2) { c.oro = (c.oro || 0) + a.k; c.riqueza += 6 * a.k; } else { c.piedra += a.k; c.riqueza += a.k * 0.3; } a.kt = 0; }
      a.k = 0; a.e = ESPERAR; a.t = 1;
      return;
    }
    if (a.paseo) { a.e = ESPERAR; a.t = a.paseo === 2 ? 3 : 1 + Math.floor(azar(v) * 2); a.paseo = 0; return; }
    if (a.o === LENADOR) { if (v.arbol[t] >= 2) { a.e = TRABAJAR; a.t = 2; } else a.e = LIBRE; }
    else if (a.o === MINERO) { if (v.roca[t] > 0) { a.e = TRABAJAR; a.t = 3; } else a.e = LIBRE; }
    else if (a.o === GRANJERO) { if (!v.obra[t] && v.arbol[t] < 2) { a.e = TRABAJAR; a.t = 3; } else a.e = LIBRE; }
    else if (a.o === CONSTRUCTOR) {
      const piedra = c.era >= 2 && c.piedra >= 1;
      if (!v.obra[t] && v.arbol[t] < 2 && c.madera >= (piedra ? 2 : 3)) { c.madera -= piedra ? 2 : 3; if (piedra) c.piedra -= 1; a.e = TRABAJAR; a.t = 4; } else a.e = LIBRE;
    } else if (a.o === GUERRERO) {
      // En tierra enemiga sin nadie que la defienda: saquea la aldea y empuja la frontera.
      const r = region(m, t), o = S().civ(m, m.dueno[r]);
      if (o && c.guerras.some(g => g.con === o.id)) { a.e = TRABAJAR; a.t = 2; } else a.e = LIBRE;
    }
  }

  function terminar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    if (a.o === LENADOR && v.arbol[t] >= 2) { a.k = v.arbol[t] === 3 ? 4 : 2; cambiar(m, 'arbol', t, 0, paso); ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === MINERO && v.roca[t] > 0) { a.k = 1; a.kt = v.mena[t] || 0; cambiar(m, 'roca', t, v.roca[t] - 1, paso); if (!v.roca[t]) v.mena[t] = 0; ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === GRANJERO && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.campo, paso); c.campos++; }
    else if (a.o === CONSTRUCTOR && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.casa, paso); c.casas++; }
    else if (a.o === GUERRERO) {
      const o = S().civ(m, m.dueno[region(m, t)]);
      if (o && c.guerras.some(g => g.con === o.id)) {
        // Saquear la capital enemiga (un asedio) pesa más que una aldea de frontera.
        c.victorias = (c.victorias || 0) + (region(m, t) === o.capital ? 1.5 : 0.5);
        if (v.obra[t] === OBRA.casa && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.ruina, paso);
        if (v.obra[t] === OBRA.campo && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.nada, paso);
      }
    }
    a.e = LIBRE;
  }

  // ---------- Lo que pasa solo: los árboles crecen, las ruinas se cubren, los bosques se acaban ----------
  function naturaleza(m, ter) {
    const v = m.vida, tw = v.tw, n = tw * v.th, F = TICKS;
    // Las regiones que cambiaron de suelo (un terremoto las volvió desierto) pierden sus árboles y sus casas.
    for (let r = 0; r < m.W * m.H; r++) if (v.tipoVisto[r] !== m.tipo[r]) {
      const nuevo = m.tipo[r];
      if (nuevo === 'desierto' || nuevo === 'montana' || esAgua(nuevo)) for (const t of parcelas(m, r)) {
        cambiar(m, 'arbol', t, 0, F);
        if (v.obra[t] === OBRA.casa || v.obra[t] === OBRA.centro || v.obra[t] === OBRA.ayuntamiento) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (v.obra[t] === OBRA.campo) cambiar(m, 'obra', t, 0, F);
      }
      v.tipoVisto[r] = nuevo;
    }
    for (let t = 0; t < n; t++) {
      const r = region(m, t), dueno = m.dueno[r], tierra = ter[t];
      const ob = v.obra[t];
      // Lo abandonado se arruina, y las ruinas acaban bajo la hierba.
      if (dueno < 0) {
        if (ob === OBRA.casa && azar(v) < 0.2) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (ob === OBRA.campo && azar(v) < 0.25) cambiar(m, 'obra', t, 0, F);
        else if (ob === OBRA.ruina && azar(v) < 0.04) cambiar(m, 'obra', t, 0, F);
      } else if (ob === OBRA.ruina && azar(v) < 0.02) cambiar(m, 'obra', t, 0, F);
      if (v.obra[t] || v.roca[t] || tierra === 'rio' || tierra === 'arena' || tierra === 'agua' || tierra === 'bajo') continue;
      const a = v.arbol[t];
      if (a === 1 || a === 2) { if (azar(v) < 0.4) cambiar(m, 'arbol', t, a + 1, F); continue; }
      if (a) continue;
      // Un bosque abandonado vuelve a crecer como bosque.
      const base = (v.fueBosque[r] && dueno < 0) ? BROTE[typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque'] : BROTE[m.tipo[r]] || 0;
      if (!base) continue;
      const x = t % tw, y = t / tw | 0;
      const junto = (x > 0 && v.arbol[t - 1]) || (x < tw - 1 && v.arbol[t + 1]) || (y > 0 && v.arbol[t - tw]) || (y < v.th - 1 && v.arbol[t + tw]);
      if (azar(v) < base * (junto ? 1 : 0.12)) cambiar(m, 'arbol', t, 1, F);
    }
    // Un bosque sin árboles ya no es bosque (y deja de dar madera, aunque sí da campos): la selva talada
    // se queda en sabana, la taiga en tundra. Si se deja crecer, el bosque vuelve.
    const TALADO = S().TALADO;
    for (let r = 0; r < m.W * m.H; r++) {
      const tipo = m.tipo[r], original = v.fueBosque[r] ? (typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque') : null;
      if (!TALADO[tipo] && !(original && tipo === TALADO[original])) continue;
      let quedan = 0;
      for (const t of parcelas(m, r)) if (v.arbol[t]) quedan++;
      if (TALADO[tipo] && quedan <= 3) { m.tipo[r] = TALADO[tipo]; v.fueBosque[r] = tipo; v.tipoVisto[r] = m.tipo[r]; v.cambios.push([3, r, tipo, m.tipo[r], F]); }
      else if (original && tipo === TALADO[original] && quedan >= 10) { m.tipo[r] = original; v.tipoVisto[r] = original; v.cambios.push([3, r, tipo, original, F]); }
    }
    avisar(m);
  }

  // Cuando un pueblo se queda sin bosques y sin madera, la crónica lo cuenta (una vez cada tanto).
  function avisar(m) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      const cs = S().casillas(m, c);
      if (cs.length < 6) continue;
      let arboles = 0;
      for (const r of cs) for (const t of parcelas(m, r)) if (v.arbol[t] >= 2) arboles++;
      c.arboles = arboles;
      const talado = cs.filter(r => v.fueBosque[r]).length;
      if (arboles < cs.length * 0.6 && talado >= 3 && c.madera < 6 && m.turno - (v.avisos[c.id] || -99) > 25) {
        v.avisos[c.id] = m.turno;
        c.efectos.push({ estab: -5, hasta: m.turno + 5 });
        S().cronica(m, 'deforestacion', c.nombre + ' tala su último bosque', 'Los leñadores de ' + c.nombre + ' vuelven con las manos vacías: donde había bosque hay campos, pastos y tocones. Sin madera no hay casas nuevas, ni barcos, ni leña para el invierno.', c, cs.find(r => v.fueBosque[r]));
      }
    }
  }

  /*
   * LAS CIUDADES: una región con muchas casas, lejos de la capital y de otras ciudades, se convierte en
   * ciudad con su ayuntamiento, su nombre y su alcalde. Cambian de dueño con las guerras y son las que se
   * rebelan cuando el reino se rompe (sim.js las usa en separar).
   */
  function nombreCiudad(m) {
    const v = m.vida, S2 = M.SILABAS;
    for (let k = 0; k < 20; k++) {
      const n = S2.inicio[Math.floor(azar(v) * S2.inicio.length)] + (azar(v) < 0.5 ? S2.medio[Math.floor(azar(v) * S2.medio.length)] : '') + S2.fin[Math.floor(azar(v) * S2.fin.length)];
      if (!m.civs.some(c => c.nombre === n) && !(m.ciudades || []).some(c => c.nombre === n)) return n;
    }
    return 'Villa ' + (m.ciudades || []).length;
  }
  const persona = v => M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + M.PERSONAS.fin[Math.floor(azar(v) * M.PERSONAS.fin.length)];
  function ciudades(m) {
    const v = m.vida;
    m.ciudades = m.ciudades || [];
    // Las que cambian de dueño o se abandonan.
    for (const x of m.ciudades.slice()) {
      const d = m.dueno[x.region], t = centro(m, x.region);
      if (d < 0) { if (v.obra[t] === OBRA.ayuntamiento) cambiar(m, 'obra', t, OBRA.ruina, TICKS); m.ciudades = m.ciudades.filter(y => y !== x); S().cronica(m, 'caida', x.nombre + ' queda abandonada', 'La ciudad de ' + x.nombre + ' se vacía: sus calles se llenan de hierba y sus piedras acaban en las casas de los pueblos vecinos.', null, x.region); continue; }
      if (d !== x.civ) {
        const antes = S().civ(m, x.civ), ahora = S().civ(m, d);
        x.civ = d; x.alcalde = persona(v);
        if (ahora && antes && antes.viva) S().cronica(m, 'conquista', ahora.nombre + ' toma ' + x.nombre, 'La ciudad de ' + x.nombre + ', que era de ' + antes.nombre + ', iza ahora la bandera de ' + ahora.nombre + '. Su nuevo alcalde, ' + x.alcalde + ', promete respetar los mercados (y subir los impuestos).', ahora, x.region);
      }
      if (v.obra[t] !== OBRA.ayuntamiento) { cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS); cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS); }
    }
    // Las nuevas: donde se juntan casas, lejos de la capital y de otras ciudades.
    const casasDe = {};
    for (let r = 0; r < m.W * m.H; r++) { if (m.dueno[r] < 0) continue; let n = 0; for (const t of parcelas(m, r)) if (v.obra[t] === OBRA.casa) n++; if (n) casasDe[r] = n; }
    for (const c of S().vivas(m)) {
      const cs = S().casillas(m, c), suyas = m.ciudades.filter(x => x.civ === c.id);
      if (suyas.length >= Math.floor(cs.length / 12)) continue;
      const lejos = r => S().distancia(r, c.capital) >= 5 && m.ciudades.every(x => S().distancia(r, x.region) >= 5);
      const r = cs.filter(r => (casasDe[r] || 0) >= 3 && lejos(r)).sort((a, b) => casasDe[b] - casasDe[a])[0];
      if (r == null) continue;
      const x = { region: r, nombre: nombreCiudad(m), civ: c.id, alcalde: persona(v), fundada: m.anio };
      m.ciudades.push(x);
      const t = centro(m, r);
      cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS); cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS);
      S().cronica(m, 'ciudad', 'Nace la ciudad de ' + x.nombre, 'Las aldeas de ' + c.nombre + ' han crecido tanto que ya son una ciudad: ' + x.nombre + ', con mercado, ayuntamiento y un alcalde, ' + x.alcalde + ', que se cree más importante que el ' + (S().titulo(c)) + '.', c, r);
    }
  }

  // Lo que cada pueblo tiene levantado en su tierra: lo usa la capacidad (sim.js) y la ficha.
  function contar(m) {
    const v = m.vida, casas = {}, campos = {}, arboles = {};
    for (let t = 0; t < v.tw * v.th; t++) {
      const d = m.dueno[region(m, t)];
      if (d < 0) continue;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento) casas[d] = (casas[d] || 0) + (o === OBRA.casa ? 1 : 0.5);
      else if (o === OBRA.campo) campos[d] = (campos[d] || 0) + 1;
      if (v.arbol[t] >= 2) arboles[d] = (arboles[d] || 0) + 1;
    }
    const gente = {}, guerreros = {}, armados = {};
    for (const a of v.aldeanos) { gente[a.c] = (gente[a.c] || 0) + 1; if (a.o === GUERRERO) { guerreros[a.c] = (guerreros[a.c] || 0) + 1; if ((a.arma || 0) > 0) armados[a.c] = (armados[a.c] || 0) + 1; } }
    for (const c of m.civs) {
      c.casas = Math.round(casas[c.id] || 0); c.campos = campos[c.id] || 0; c.arboles = arboles[c.id] || 0; c.aldeanos = gente[c.id] || 0; c.guerreros = guerreros[c.id] || 0; c.armados = armados[c.id] || 0;
      c.metal = c.metal || 0; c.oro = c.oro || 0;
      c.madera = c.madera || 0; c.piedra = c.piedra || 0;
    }
  }

  // ---------- Lo que cuesta una tierra nueva (sim.js) ----------
  // Tres de madera; sin madera, cuatro de piedra; y un pueblo sin árboles cerca levanta adobe: una tierra por turno.
  function tierrasPagables(m, c) {
    return Math.floor((c.madera || 0) / 3) + Math.floor((c.piedra || 0) / 4) + (c.arboles ? 0 : 1);
  }
  function pagarTierra(m, c) {
    if (c.madera >= 3) c.madera -= 3;
    else if (c.piedra >= 4) c.piedra -= 4;
  }

  // ---------- Poderes del dios sobre la vida ----------
  function incendio(m, c) {
    const v = m.vida;
    let quemados = 0;
    if (!v) return 0;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (v.arbol[t] && azar(v) < 0.75) { cambiar(m, 'arbol', t, 0, 0); quemados++; }
      if (v.obra[t] === OBRA.casa && azar(v) < 0.3) cambiar(m, 'obra', t, OBRA.ruina, 0);
      if (v.obra[t] === OBRA.campo && azar(v) < 0.4) cambiar(m, 'obra', t, 0, 0);
    }
    contar(m);
    return quemados;
  }
  function plantar(m, regiones) {
    const v = m.vida;
    let n = 0;
    if (!v) return 0;
    const ter = terrenos(m);
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.arbol[t] || !(ter[t] in ARBOLES) || azar(v) < 0.25) continue;
      cambiar(m, 'arbol', t, 3, 0); n++;
    }
    contar(m);
    return n;
  }

  /*
   * Lo que un poder del dios le hace a la tierra y a la gente en el acto: aldeanos que mueren, casas que
   * caen, campos que se secan. Devuelve cuántos aldeanos murieron y cuántas obras se perdieron.
   */
  const DANO = {
    plaga: { gente: 0.35 }, hambre: { gente: 0.2, campo: 0.6 }, diluvio: { gente: 0.15, campo: 0.45, casa: 0.2 },
    terremoto: { gente: 0.25, casa: 0.55, campo: 0.2 }, destruir: { gente: 0.7, casa: 0.75, campo: 0.6 }, matar: { gente: 0.5 },
    guerra: {}, incendio: { gente: 0.1 }
  };
  function castigo(m, c, tipo, regiones) {
    const v = m.vida, d = DANO[tipo];
    if (!v || !d || !c) return { muertos: 0, obras: 0 };
    let muertos = 0, obras = 0;
    if (d.gente) {
      const suyos = v.aldeanos.filter(a => a.c === c.id);
      const n = Math.min(suyos.length - 1, Math.round(suyos.length * d.gente));
      const fuera = new Set(suyos.sort((x, y) => x.id % 7 - y.id % 7).slice(0, Math.max(0, n)));
      v.muertos = (v.muertos || []).concat([...fuera].map(a => [a.x, a.y, c.id, tipo]));
      v.aldeanos = v.aldeanos.filter(a => !fuera.has(a));
      muertos = fuera.size;
    }
    for (const r of regiones || S().casillas(m, c)) for (const t of parcelas(m, r)) {
      const o = v.obra[t];
      if (o === OBRA.campo && d.campo && azar(v) < d.campo) { cambiar(m, 'obra', t, 0, 0); obras++; }
      else if (o === OBRA.casa && d.casa && azar(v) < d.casa) { cambiar(m, 'obra', t, OBRA.ruina, 0); obras++; }
    }
    contar(m);
    return { muertos, obras };
  }
  // Pone la vida al día tras un cambio fuera del turno: plazas nuevas, aldeanos según la población.
  function ajustar(m) {
    if (!m.vida) return;
    m.vida.cambios = m.vida.cambios || [];
    centros(m);
    sincronizar(m, null, true);
    for (const a of m.vida.aldeanos) if (!a.r || !a.r.length) a.r = [];
    contar(m);
  }

  M.vida = { SUB, TICKS, OBRA, OFICIOS, ACC, ARMAS, TIROS, poder, reparto, crear, turno, terreno, terrenos, region, centro, parcelas, plaza, contar, tierrasPagables, pagarTierra, incendio, plantar, castigo, ajustar };
})(globalThis.RF = globalThis.RF || {});
