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
  const OBRA = { nada: 0, casa: 1, campo: 2, centro: 3, ruina: 4 };
  const OFICIOS = ['lenador', 'granjero', 'constructor', 'minero', 'guerrero'];
  const [LENADOR, GRANJERO, CONSTRUCTOR, MINERO, GUERRERO] = [0, 1, 2, 3, 4];
  // Estados del aldeano y lo que hace en cada paso (la vista elige el dibujo con esto).
  const [LIBRE, IR, TRABAJAR, VOLVER, ESPERAR] = [0, 1, 2, 3, 4];
  const ACC = { andar: 0, trabajar: 1, luchar: 2, cargar: 3 };

  // Árboles y rocas al crear el mundo, según el suelo de la parcela.
  const ARBOLES = { bosque: 0.78, colina: 0.22, llanura: 0.07, nieve: 0.14, desierto: 0.03 };
  const ROCAS = { montana: 0.45, colina: 0.12, desierto: 0.06, nieve: 0.05, llanura: 0.015, bosque: 0.02 };
  // Lo que brota solo cada turno junto a otro árbol (la naturaleza recupera lo que se deja).
  const BROTE = { bosque: 0.035, colina: 0.025, llanura: 0.006, nieve: 0.008, desierto: 0.0015 };
  const CONSTRUIBLE = new Set(['llanura', 'colina', 'bosque', 'desierto', 'nieve', 'arena']);
  const CULTIVABLE = new Set(['llanura', 'colina', 'bosque']);

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
      tw, th, rng: (m.semilla ^ 0x9E3779B9) >>> 0, arbol: new Array(n).fill(0), roca: new Array(n).fill(0), obra: new Array(n).fill(0),
      fueBosque: new Array(m.W * m.H).fill(0), tipoVisto: m.tipo.slice(), aldeanos: [], sig: 0, centros: {}, cambios: [], avisos: {}
    };
    m.vida = v;
    const ter = terrenos(m);
    for (let t = 0; t < n; t++) {
      const r = azar(v), pa = ARBOLES[ter[t]] || 0, pr = ROCAS[ter[t]] || 0;
      if (r < pa) v.arbol[t] = azar(v) < 0.75 ? 3 : 2;
      else if (r < pa + pr) v.roca[t] = 1 + Math.floor(azar(v) * 3);
    }
    for (const c of S().vivas(m)) { c.madera = c.madera || 6; c.piedra = c.piedra || 0; }
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
      if (v.centros[c.id] === c.capital) continue;
      for (const t of plaza(m, c.capital)) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
      v.centros[c.id] = c.capital;
    }
  }
  function plaza(m, r) { const tw = m.W * SUB, x = (r % m.W) * SUB + 1, y = (r / m.W | 0) * SUB + 1; return [y * tw + x, y * tw + x + 1, (y + 1) * tw + x, (y + 1) * tw + x + 1]; }

  // ---------- Los aldeanos de cada pueblo ----------
  const cuantos = c => Math.max(3, Math.min(40, Math.round(2 + Math.sqrt(Math.max(0, c.pob)) * 1.5)));

  function reparto(c, recursos) {
    const guerra = c.guerras.length > 0;
    const p = [0, 0, 0.15, c.era >= 1 ? 0.14 : 0.05, guerra ? 0.34 : c.era >= 2 ? 0.08 : 0.05];
    if (!recursos.rocas) { p[LENADOR] += p[MINERO]; p[MINERO] = 0; }
    const resto = 1 - p.reduce((a, b) => a + b, 0);
    p[LENADOR] += resto * (recursos.arboles ? 0.55 : 0); p[GRANJERO] += resto * (recursos.arboles ? 0.45 : 1);
    // Un jugador reparte los oficios a su gusto (mando.js): pesa tres veces más que la costumbre.
    const plan = c.plan && c.plan.oficios;
    if (plan) {
      // "Más X" se lleva su parte del trabajo; "menos X" lo deja casi a cero.
      const quiere = OFICIOS.map(o => (typeof plan[o] === 'number' ? plan[o] : null));
      const total = quiere.reduce((k, w) => k + (w > 0.1 ? w : 0), 0), parte = Math.min(0.9, total);
      const q = p.map((x, i) => {
        const w = quiere[i];
        if (w !== null && w <= 0.1) return w;
        return x * (1 - parte) + (w !== null ? w / total * parte : 0);
      });
      if (!recursos.arboles) q[LENADOR] = 0;
      if (!recursos.rocas) q[MINERO] = 0;
      const suma = q.reduce((k, x) => k + x, 0) || 1;
      return q.map(x => x / suma);
    }
    return p;
  }

  function hogar(m, c, cs) {
    const v = m.vida;
    if (azar(v) < 0.4 || cs.length < 2) return c.capital;
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
        if (a.e !== LIBRE && a.e !== ESPERAR && !a.paseo && !(a.o === GUERRERO && !c.guerras.length && !(c.plan && c.plan.oficios && c.plan.oficios.guerrero))) continue;
        const falta = p.map((x, i) => x * lista.length - tiene[i] + (i === a.o ? 1 : 0));
        const mejor = falta.indexOf(Math.max(...falta));
        if (mejor !== a.o && falta[mejor] - (falta[a.o] - 1) >= 1) { tiene[a.o]--; tiene[mejor]++; a.o = mejor; a.e = LIBRE; a.k = 0; a.paseo = 0; }
      }
    }
  }

  // ---------- Lo que hay al alcance de cada pueblo ----------
  function recursos(m) {
    const v = m.vida, out = {}, reservadas = new Set();
    for (const a of v.aldeanos) if (a.e === IR || a.e === TRABAJAR) reservadas.add(a.ty * v.tw + a.tx);
    for (const c of S().vivas(m)) out[c.id] = { arboles: [], rocas: [], cs: [], reservadas, enemigos: [] };
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
        for (const id of alcance[r]) { if (arbol) out[id].arboles.push(t); else if (ter[t] !== 'agua') out[id].rocas.push(t); }
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
    v.cambios = []; v.muertos = [];
    centros(m);
    let rec = recursos(m);
    sincronizar(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length })));
    rec = recursos(m);
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
    // La leña de cada día: cocinar, calentarse y, desde la Edad del Hierro, las forjas; en la era industrial, el carbón vegetal.
    for (const c of S().vivas(m)) c.madera = Math.max(0, c.madera - Math.sqrt(Math.max(0, c.pob)) * 0.18 * (1 + c.era * 0.3));
  }
  const mapa = (o, f) => { const r = {}; for (const k of Object.keys(o)) r[k] = f(o[k]); return r; };

  function actuar(m, a, rec, ter, paso, guerreros, muertos) {
    const v = m.vida, c = S().civ(m, a.c);
    let acc = a.k ? ACC.cargar : ACC.andar;
    if (!rec || !c) return;
    if (a.e === LIBRE) elegirTarea(m, a, c, rec, ter);
    if (a.e === IR || a.e === VOLVER) {
      if (a.x === a.tx && a.y === a.ty) llegar(m, a, c, rec, ter, paso);
      else if (!andar(m, a, c, ter)) { a.e = LIBRE; a.k = 0; }
    } else if (a.e === TRABAJAR) {
      acc = ACC.trabajar;
      if (--a.t <= 0) terminar(m, a, c, rec, ter, paso);
    } else if (a.e === ESPERAR) {
      if (--a.t <= 0) a.e = LIBRE;
    }
    // Los guerreros luchan contra los enemigos que encuentran a su lado.
    if (a.o === GUERRERO && c.guerras.length) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
        const rival = lista && lista.find(b => b !== a && !muertos.has(b) && c.guerras.some(g => g.con === b.c));
        if (!rival) continue;
        const o = S().civ(m, rival.c), fa = M.ERAS[c.era].fuerza, fb = M.ERAS[o.era].fuerza;
        const gana = azar(v) < fa / (fa + fb) ? a : rival, pierde = gana === a ? rival : a;
        muertos.add(pierde);
        const g = S().civ(m, gana.c); g.victorias = (g.victorias || 0) + 1;
        acc = ACC.luchar;
        break;
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
    if (a.o === LENADOR && c.madera < (60 + 20 * c.era) * (1 + 4 * ((c.plan && c.plan.oficios && c.plan.oficios.lenador) || 0))) t = cercano(m, a, rec.arboles, rec.reservadas, 16);
    else if (a.o === MINERO && c.piedra < 30 + 10 * c.era) t = cercano(m, a, rec.rocas, rec.reservadas, 16);
    else if (a.o === GRANJERO) t = c.campos < metaCampos(c) ? libre(m, a, c, rec, ter, CULTIVABLE) : -1;
    else if (a.o === CONSTRUCTOR) t = c.casas < metaCasas(c) && c.madera >= 2 ? libre(m, a, c, rec, ter, CONSTRUIBLE) : -1;
    else if (a.o === GUERRERO && rec.enemigos.length) {
      const frente = rec.enemigos[Math.floor(azar(v) * rec.enemigos.length)].frente;
      if (frente.length) t = centro(m, frente[Math.floor(azar(v) * frente.length)]) + Math.floor(azar(v) * 2) - 1;
    }
    if (t >= 0) { ir(a, t, v.tw, IR); rec.reservadas.add(t); return; }
    // Sin tarea: los granjeros cuidan un campo, los demás pasean por su aldea.
    if (a.o === GRANJERO && c.campos > 0 && azar(v) < 0.7) {
      const campos = parcelas(m, a.h).filter(x => v.obra[x] === OBRA.campo);
      if (campos.length) { ir(a, campos[Math.floor(azar(v) * campos.length)], v.tw, IR); a.paseo = 2; return; }
    }
    pasear(m, a, ter, c);
  }
  const metaCampos = c => Math.round(4 + c.pob * 0.22);
  const metaCasas = c => Math.round((2 + c.pob * 0.12) * (c.plan && c.plan.foco === 'construir' ? 1.6 : 1));

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
      if (a.o === LENADOR) c.madera += a.k; else if (a.o === MINERO) { c.piedra += a.k; c.riqueza += a.k * 0.3; }
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
    if (a.o === MINERO && v.roca[t] > 0) { a.k = 1; cambiar(m, 'roca', t, v.roca[t] - 1, paso); ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === GRANJERO && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.campo, paso); c.campos++; }
    else if (a.o === CONSTRUCTOR && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.casa, paso); c.casas++; }
    else if (a.o === GUERRERO) {
      const o = S().civ(m, m.dueno[region(m, t)]);
      if (o && c.guerras.some(g => g.con === o.id)) {
        c.victorias = (c.victorias || 0) + 0.5;
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
        if (v.obra[t] === OBRA.casa || v.obra[t] === OBRA.centro) cambiar(m, 'obra', t, OBRA.ruina, F);
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
      const base = (v.fueBosque[r] && dueno < 0) ? BROTE.bosque : BROTE[m.tipo[r]] || 0;
      if (!base) continue;
      const x = t % tw, y = t / tw | 0;
      const junto = (x > 0 && v.arbol[t - 1]) || (x < tw - 1 && v.arbol[t + 1]) || (y > 0 && v.arbol[t - tw]) || (y < v.th - 1 && v.arbol[t + tw]);
      if (azar(v) < base * (junto ? 1 : 0.12)) cambiar(m, 'arbol', t, 1, F);
    }
    // Un bosque sin árboles ya no es bosque (y deja de dar madera, aunque sí da campos).
    for (let r = 0; r < m.W * m.H; r++) {
      const tipo = m.tipo[r];
      if (tipo !== 'bosque' && !(tipo === 'llanura' && v.fueBosque[r])) continue;
      let quedan = 0;
      for (const t of parcelas(m, r)) if (v.arbol[t]) quedan++;
      if (tipo === 'bosque' && quedan <= 3) { m.tipo[r] = 'llanura'; v.fueBosque[r] = 1; v.tipoVisto[r] = 'llanura'; v.cambios.push([3, r, 'bosque', 'llanura', F]); }
      else if (tipo === 'llanura' && quedan >= 10) { m.tipo[r] = 'bosque'; v.tipoVisto[r] = 'bosque'; v.cambios.push([3, r, 'llanura', 'bosque', F]); }
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

  // Lo que cada pueblo tiene levantado en su tierra: lo usa la capacidad (sim.js) y la ficha.
  function contar(m) {
    const v = m.vida, casas = {}, campos = {}, arboles = {};
    for (let t = 0; t < v.tw * v.th; t++) {
      const d = m.dueno[region(m, t)];
      if (d < 0) continue;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.centro) casas[d] = (casas[d] || 0) + (o === OBRA.casa ? 1 : 0.5);
      else if (o === OBRA.campo) campos[d] = (campos[d] || 0) + 1;
      if (v.arbol[t] >= 2) arboles[d] = (arboles[d] || 0) + 1;
    }
    const gente = {};
    for (const a of v.aldeanos) gente[a.c] = (gente[a.c] || 0) + 1;
    for (const c of m.civs) {
      c.casas = Math.round(casas[c.id] || 0); c.campos = campos[c.id] || 0; c.arboles = arboles[c.id] || 0; c.aldeanos = gente[c.id] || 0;
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

  M.vida = { SUB, TICKS, OBRA, OFICIOS, ACC, reparto, crear, turno, terreno, terrenos, region, centro, parcelas, plaza, contar, tierrasPagables, pagarTierra, incendio, plantar, castigo, ajustar };
})(globalThis.RF = globalThis.RF || {});
