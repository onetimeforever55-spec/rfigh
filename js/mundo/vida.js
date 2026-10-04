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
  const SUB = 4, TICKS = 8, MAX_ALDEANOS = 1000;
  // La vida de un aldeano, en turnos: niño hasta ADULTO, anciano desde VIEJO, y muere de viejo hacia el final.
  const ADULTO = 2, VIEJO = 18;
  const limiteVida = a => 22 + (a.id % 12) + (a.rasgos && a.rasgos.includes('longevo') ? 8 : 0);
  const esNino = a => (a.edad || 0) < ADULTO;
  const OBRA = { nada: 0, casa: 1, campo: 2, centro: 3, ruina: 4, ayuntamiento: 5, torre: 6, templo: 7, molino: 8, puerto: 9 };
  const OFICIOS = ['lenador', 'granjero', 'constructor', 'minero', 'guerrero', 'comerciante'];
  const [LENADOR, GRANJERO, CONSTRUCTOR, MINERO, GUERRERO, COMERCIANTE] = [0, 1, 2, 3, 4, 5];
  // Estados del aldeano y lo que hace en cada paso (la vista elige el dibujo con esto).
  const [LIBRE, IR, TRABAJAR, VOLVER, ESPERAR, VIAJAR] = [0, 1, 2, 3, 4, 5];
  const ACC = { andar: 0, trabajar: 1, luchar: 2, cargar: 3 };

  // Las armas de cada era: lo que lleva un guerrero si su pueblo tiene metal para forjarlas (si no, un garrote).
  const ARMAS = [
    { nombre: 'garrote', poder: 1 }, { nombre: 'lanza de bronce', poder: 1.4 }, { nombre: 'espada de hierro', poder: 1.8 }, { nombre: 'espada y escudo', poder: 2.1 },
    { nombre: 'espada y cota de malla', poder: 2.4 }, { nombre: 'arcabuz y pica', poder: 2.9 }, { nombre: 'mosquete y bayoneta', poder: 3.4 }, { nombre: 'fusil', poder: 4.1 }, { nombre: 'fusil automático', poder: 5 }
  ];
  const TIROS = ['honda', 'arco', 'arco', 'arco largo', 'ballesta', 'arcabuz', 'mosquete', 'fusil', 'fusil automático'];
  const poder = a => ARMAS[a.arma || 0].poder * (a.armadura ? 1.35 : 1) * (a.rasgos && a.rasgos.includes('fuerte') ? 1.25 : 1) * (a.rasgos && a.rasgos.includes('valiente') ? 1.1 : 1) * (a.rasgos && a.rasgos.includes('torpe') ? 0.85 : 1);
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
  // Se camina por tierra (y por los puentes); el agua se cruza nadando, y en el mar uno se puede ahogar.
  const mojada = t => t === 'agua' || t === 'bajo' || t === 'rio';
  const andable = ter => !mojada(ter);

  // ---------- Crear la vida de un mundo ----------
  function crear(m) {
    const tw = m.W * SUB, th = m.H * SUB, n = tw * th;
    const v = {
      tw, th, rng: (m.semilla ^ 0x9E3779B9) >>> 0, arbol: new Array(n).fill(0), roca: new Array(n).fill(0), obra: new Array(n).fill(0), mena: new Array(n).fill(0), cultivo: new Array(n).fill(0), camino: new Array(n).fill(0), rutas: [], animales: [], ejercitos: {}, disparos: [],
      fueBosque: new Array(m.W * m.H).fill(0), tipoVisto: m.tipo.slice(), aldeanos: [], sig: 0, centros: {}, cambios: [], avisos: {}
    };
    m.vida = v;
    const ter = terrenos(m);
    for (let t = 0; t < n; t++) {
      const r = azar(v), pa = ARBOLES[ter[t]] || 0, pr = ROCAS[ter[t]] || 0;
      if (r < pa) v.arbol[t] = azar(v) < 0.75 ? 3 : 2;
      else if (r < pa + pr) { v.roca[t] = 1 + Math.floor(azar(v) * 3); const [ph, po] = MENAS[ter[t]] || [0.04, 0.01], q = azar(v); v.mena[t] = q < po ? 2 : q < po + ph ? 1 : 0; }
    }
    for (const c of S().vivas(m)) { c.madera = c.madera || 6; c.piedra = c.piedra || 0; c.metal = c.metal || 0; c.oro = c.oro || 0; c.comida = c.comida == null ? 30 : c.comida; }
    centros(m);
    sincronizar(m);
    contar(m);
    actualizarPoblacion(m);
    return v;
  }

  // Anota un cambio de parcela con el paso en que ocurre (la vista lo aplica en ese momento).
  function cambiar(m, capa, t, valor, paso) {
    const v = m.vida;
    if (v[capa][t] === valor) return;
    v.cambios.push([capa === 'arbol' ? 0 : capa === 'roca' ? 1 : capa === 'obra' ? 2 : capa === 'cultivo' ? 4 : 5, t, v[capa][t], valor, paso]);
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
      if (c.comida == null) c.comida = 30;
      if (v.centros[c.id] === c.capital) continue;
      for (const t of plaza(m, c.capital)) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
      v.centros[c.id] = c.capital;
      // Como en WorldBox, la aldea nace con su molino: alrededor de él se siembran los primeros campos.
      const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r));
      if (!zona.some(t => v.obra[t] === OBRA.molino)) {
        const ter = terrenos(m), pl = plaza(m, c.capital);
        const t = zona.filter(x => !v.obra[x] && !pl.includes(x) && CONSTRUIBLE.has(ter[x]) && ter[x] !== 'arena').sort((p, q) => dist(m, p, pl[3]) - dist(m, q, pl[3]))[0];
        if (t != null) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.molino, 0); }
      }
    }
  }
  function plaza(m, r) { const tw = m.W * SUB, x = (r % m.W) * SUB + 1, y = (r / m.W | 0) * SUB + 1; return [y * tw + x, y * tw + x + 1, (y + 1) * tw + x, (y + 1) * tw + x + 1]; }

  // ---------- Los aldeanos de cada pueblo ----------
  const cuantos = c => Math.max(4, Math.min(60, Math.round(3 + Math.sqrt(Math.max(0, c.pob)) * 2)));

  /*
   * EL GOBERNADOR AUTOMÁTICO: cada pueblo (también el del jugador) reparte el trabajo según lo que le falta.
   * Poca madera → más leñadores; la gente cerca del límite de comida → más granjeros; faltan casas → más
   * constructores; guerra → guerreros. Las prioridades del jugador (0 a 2) pesan sobre esas necesidades.
   */
  const PRIO_OFICIO = ['madera', 'comida', 'casas', 'piedra', 'ejercito', 'riqueza'];
  const prio = (c, k) => (c.plan && c.plan.prioridad && c.plan.prioridad[k] != null ? c.plan.prioridad[k] : 1);
  const metaMadera = c => 30 + 12 * c.era;
  function reparto(c, recursos) {
    const guerra = c.guerras.length > 0;
    const lleno = c.cap ? c.pob / c.cap : 0.8;
    const p = [
      recursos.arboles ? 0.18 + 0.4 * Math.max(0, 1 - (c.madera || 0) / metaMadera(c)) : 0,
      0.22 + Math.max(0, lleno - 0.75) * 1.6 + ((c.campos || 0) < metaCampos(c) ? 0.08 : 0),
      faltanCamas(c) ? 0.2 : 0.06,
      recursos.rocas ? (c.era >= 1 ? 0.08 + ((c.piedra || 0) < 20 ? 0.06 : 0) + ((c.metal || 0) < 10 ? 0.08 : 0) : 0.04) : 0,
      guerra ? 0.6 : c.era >= 2 ? 0.07 : 0.04,
      // Un comerciante por cada ruta abierta, más o menos.
      Math.min(0.2, 0.06 * (c.rutas || 0))
    ];
    for (let i = 0; i < p.length; i++) {
      const w = prio(c, PRIO_OFICIO[i]);
      p[i] *= w === 0 ? 0.03 : w;
    }
    const suma = p.reduce((k, x) => k + x, 0) || 1;
    return p.map(x => x / suma);
  }

  // Las casas (y plazas) de un pueblo: donde nacen sus niños.
  function casasDe(m, c) {
    const v = m.vida, out = [];
    for (let t = 0; t < v.obra.length; t++) { const o = v.obra[t]; if ((o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento) && m.dueno[region(m, t)] === c.id) out.push(t); }
    return out;
  }
  function hogar(m, c, cs) {
    const v = m.vida;
    if (azar(v) < 0.4 || cs.length < 2) return c.capital;
    const suyas = (m.ciudades || []).filter(x => x.civ === c.id);
    if (suyas.length && azar(v) < 0.4) return suyas[Math.floor(azar(v) * suyas.length)].region;
    return cs[Math.floor(azar(v) * cs.length)];
  }

  /*
   * CADA ALDEANO ES UN AGENTE, como en WorldBox: tiene nombre, familia, edad, rasgos, casa e historia.
   * La población del pueblo son sus aldeanos: nacen de otros aldeanos (si hay cama, comida y tierra que los
   * sostenga) y mueren de viejos, de hambre, de peste, en la guerra o en el mar. El motor del reino lee su
   * población de ellos (cada aldeano cuenta por una familia grande: ver escala).
   */
  const RASGOS_ALDEANO = ['fuerte', 'rápido', 'sabio', 'perezoso', 'valiente', 'torpe', 'longevo', 'fértil'];
  const escala = c => 1.5 * (1 + 0.35 * c.era);
  const tiene = (a, r) => !!(a.rasgos && a.rasgos.includes(r));
  const APELLIDOS = ['ez', 'ar', 'in', 'os', 'ani', 'ov', 'eda', 'ur'];
  function nuevoAldeano(m, c, casa, edad, padre) {
    const v = m.vida, rasgos = [];
    if (azar(v) < 0.6) rasgos.push(RASGOS_ALDEANO[Math.floor(azar(v) * RASGOS_ALDEANO.length)]);
    if (azar(v) < 0.2) { const r = RASGOS_ALDEANO[Math.floor(azar(v) * RASGOS_ALDEANO.length)]; if (!rasgos.includes(r)) rasgos.push(r); }
    // Los hijos heredan a veces un rasgo de su padre o su madre.
    if (padre && padre.rasgos && padre.rasgos.length && azar(v) < 0.35 && !rasgos.includes(padre.rasgos[0])) rasgos.push(padre.rasgos[0]);
    const familia = padre ? padre.familia : M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + APELLIDOS[Math.floor(azar(v) * APELLIDOS.length)];
    const a = { id: v.sig++, c: c.id, o: GRANJERO, x: casa % v.tw, y: casa / v.tw | 0, h: region(m, casa), casa, e: LIBRE, tx: -1, ty: -1, t: 0, k: 0, q: 0, r: [], edad,
      nombre: persona(v), familia, rasgos, hijos: 0, bajas: 0, hambre: 0, padre: padre ? padre.id : null, nacio: m.anio, eraNacio: c.era };
    if (padre) padre.hijos = (padre.hijos || 0) + 1;
    v.aldeanos.push(a);
    return a;
  }

  function sincronizar(m, recursosDe, soloQuitar) {
    const v = m.vida, vivas = S().vivas(m), porCiv = {};
    v.aldeanos = v.aldeanos.filter(a => { const c = S().civ(m, a.c); return c && c.viva; });
    // Los que viven en tierra que cambia de dueño (conquista, rebelión) pasan a ser de ese pueblo.
    for (const a of v.aldeanos) {
      const d = m.dueno[a.h];
      if (d >= 0 && d !== a.c && a.colono == null) { const o = S().civ(m, d); if (o && o.viva) { a.c = d; a.o = GRANJERO; a.e = LIBRE; a.k = 0; a.arma = 0; a.armadura = 0; a.tirador = null; } }
    }
    for (const c of vivas) porCiv[c.id] = [];
    for (const a of v.aldeanos) if (porCiv[a.c]) porCiv[a.c].push(a);
    const quitar = new Set();
    let total = v.aldeanos.length;
    for (const c of vivas) {
      const cs = S().casillas(m, c), lista = porCiv[c.id];
      for (const a of lista) if (m.dueno[a.h] !== c.id && a.colono == null) a.h = hogar(m, c, cs);
      // Lo que el resto del mundo le hizo a la población desde el último turno (una peste, una batalla perdida,
      // un milagro) se cumple en los aldeanos: mueren los más viejos, o llegan familias nuevas.
      let objetivo = c.pobVida ? Math.round(lista.length * c.pob / c.pobVida) : Math.max(lista.length, 6);
      // Un pueblo que sigue en pie nunca se queda sin nadie: vuelven unas familias de las aldeas de alrededor.
      if (objetivo < 2 && !soloQuitar) objetivo = Math.max(objetivo, lista.length ? 2 : 3);
      if (objetivo < lista.length) {
        const tipo = c.guerras.length ? 'batalla' : 'vejez';
        for (const a of lista.slice().sort((x, y) => (y.edad || 0) - (x.edad || 0)).slice(0, lista.length - Math.max(1, objetivo))) { quitar.add(a); v.muertos.push([a.x, a.y, a.c, tipo, 0]); }
      } else if (objetivo > lista.length) {
        const casas = casasDe(m, c);
        for (let k = lista.length; k < Math.min(objetivo, lista.length + 30); k++) {
          const casa = casas.length ? casas[Math.floor(azar(v) * casas.length)] : centro(m, hogar(m, c, cs));
          lista.push(nuevoAldeano(m, c, casa, ADULTO + Math.floor(azar(v) * 10), null)); total++;
        }
      }
      if (soloQuitar) continue;
      // Mueren de viejos los que llegan al final de su vida (si el pueblo no se queda sin nadie).
      for (const a of lista) if (!quitar.has(a) && (a.edad || 0) > limiteVida(a) && lista.length - quitar.size > 2) { quitar.add(a); v.muertos.push([a.x, a.y, a.c, 'vejez', 0]); }
      // Nacen bebés de los adultos, si hay cama libre, comida en el granero y tierra que los sostenga.
      const vivos = lista.filter(a => !quitar.has(a));
      const camasLibres = Math.max(0, (c.camas || 6) - vivos.length);
      const tierra = !c.cap || vivos.length * escala(c) < c.cap * 1.05;
      const comida = (c.comida || 0) > vivos.length * 0.3 || vivos.length < 8;
      c.sinCama = 0;
      if (tierra && comida && total < MAX_ALDEANOS && vivos.length < 150) {
        const adultos = vivos.filter(a => (a.edad || 0) >= ADULTO && (a.edad || 0) < VIEJO && a.colono == null);
        let nacen = 0, casasCiv = null;
        for (const a of adultos) {
          if (nacen >= Math.max(2, adultos.length * 0.25)) break;
          if (azar(v) >= 0.13 * (tiene(a, 'fértil') ? 1.5 : 1)) continue;
          if (nacen >= camasLibres) { c.sinCama++; continue; }
          if (!casasCiv) casasCiv = casasDe(m, c);
          const casa = a.casa != null && [OBRA.casa, OBRA.centro, OBRA.ayuntamiento].includes(v.obra[a.casa]) ? a.casa : (casasCiv.length ? casasCiv[Math.floor(azar(v) * casasCiv.length)] : centro(m, a.h));
          const bebe = nuevoAldeano(m, c, casa, 0, a);
          lista.push(bebe); nacen++; total++;
        }
      }
    }
    if (quitar.size) v.aldeanos = v.aldeanos.filter(a => !quitar.has(a));
    // Oficios: los libres cambian de oficio para cubrir lo que falta en su pueblo.
    for (const c of vivas) {
      const lista = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && a.colono == null), p = reparto(c, recursosDe ? recursosDe[c.id] : { arboles: 1, rocas: 1 });
      const tiene = [0, 0, 0, 0, 0, 0];
      for (const a of lista) tiene[a.o]++;
      for (const a of lista) {
        // En guerra se llama a las armas a cualquiera que no vaya cargado; en paz, solo cambian los que están libres.
        const llamada = c.guerras.length && !a.k && a.o !== GUERRERO && !esNino(a);
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
          let obj = frente.sort((x, y) => S().distancia(x, enemigo.capital) - S().distancia(y, enemigo.capital))[0];
          // Como en WorldBox, se va a por las ciudades: la del enemigo (o su capital) más cercana a nuestra frontera.
          const plazas = [enemigo.capital, ...(m.ciudades || []).filter(x => x.civ === enemigo.id).map(x => x.region)];
          const cerca = plazas.map(r => [r, Math.min(...frente.map(f => S().distancia(f, r)))]).sort((p, q) => p[1] - q[1])[0];
          if (cerca && cerca[1] <= 5) obj = cerca[0];
          const nuestro = S().frontera(m, enemigo, c).sort((x, y) => S().distancia(x, obj) - S().distancia(y, obj))[0];
          e = { con: enemigo.id, obj, reunion: nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno, asedio: 0 };
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

  /*
   * LOS EDIFICIOS DE CADA PLAZA (capital y ciudades), como en WorldBox: una torre de vigilancia, un templo,
   * un molino junto a los campos (desde la Edad Media) y un puerto si hay costa. Cuestan madera y piedra.
   */
  const COSTES = { [OBRA.torre]: [6, 4], [OBRA.templo]: [8, 6], [OBRA.molino]: [3, 0], [OBRA.puerto]: [10, 0] };
  function edificioPendiente(m, a, c, ter) {
    const v = m.vida;
    const plazas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].sort((p, q) => S().distancia(p, a.h) - S().distancia(q, a.h));
    for (const r of plazas.slice(0, 3)) {
      const zona = [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)];
      const tiles = zona.flatMap(z => parcelas(m, z));
      const tiene = o => tiles.some(t => v.obra[t] === o);
      const libreEn = (lista, ok) => lista.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && ok(t)).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
      const pide = [];
      if (!tiene(OBRA.molino)) pide.push([OBRA.molino, () => libreEn(tiles, t => CULTIVABLE.has(ter[t]))]);
      if (c.era >= 1 && !tiene(OBRA.torre)) pide.push([OBRA.torre, () => libreEn(parcelas(m, r), t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && !tiene(OBRA.templo)) pide.push([OBRA.templo, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && !tiene(OBRA.puerto)) pide.push([OBRA.puerto, () => libreEn(tiles, t => ter[t] === 'arena' && [1, -1, v.tw, -v.tw].some(d => ter[t + d] === 'agua' || ter[t + d] === 'bajo'))]);
      for (const [obra, donde] of pide) {
        const coste = COSTES[obra];
        if (c.madera < coste[0] || c.piedra < coste[1]) continue;
        const t = donde();
        if (t != null) return [t, obra];
      }
    }
    return null;
  }

  /*
   * LOS BARCOS: cada puerto tiene un barco de pesca (trae comida) y, desde la Antigüedad, un mercante que
   * navega hasta el puerto de otro reino en paz y vuelve (oro para los dos).
   */
  function navegable(ter, t) { return ter[t] === 'agua' || ter[t] === 'bajo'; }
  function rutaPorMar(m, de, a, ter) {
    const v = m.vida, prev = new Map([[de, -1]]), cola = [de];
    for (let i = 0; i < cola.length && cola.length < 14000; i++) {
      const t = cola[i];
      if (t === a) break;
      const x = t % v.tw;
      for (const n of [x > 0 ? t - 1 : -1, x < v.tw - 1 ? t + 1 : -1, t - v.tw, t + v.tw]) {
        if (n < 0 || n >= ter.length || prev.has(n) || (!navegable(ter, n) && n !== a)) continue;
        prev.set(n, t); cola.push(n);
      }
    }
    if (!prev.has(a)) return null;
    const out = [a];
    while (prev.get(out[out.length - 1]) !== -1) out.push(prev.get(out[out.length - 1]));
    return out.reverse();
  }
  const aguaJunto = (m, t, ter) => [1, -1, m.vida.tw, -m.vida.tw].map(d => t + d).find(n => n >= 0 && n < ter.length && navegable(ter, n));
  let puertosDelTurno = [], travesias = {};
  function barcos(m, ter) {
    const v = m.vida;
    puertosDelTurno = [];
    for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.puerto) puertosDelTurno.push(t);
    v.barcos = (v.barcos || []).filter(b => v.obra[b.puerto] === OBRA.puerto && m.dueno[region(m, b.puerto)] === b.c);
    for (const t of puertosDelTurno) {
      const c = S().civ(m, m.dueno[region(m, t)]);
      if (!c) continue;
      const agua = aguaJunto(m, t, ter);
      if (agua == null) continue;
      for (const tipo of c.era >= 3 ? ['pesca', 'mercante'] : ['pesca']) {
        if (v.barcos.some(b => b.puerto === t && b.tipo === tipo)) continue;
        v.barcos.push({ id: v.sig++, tipo, c: c.id, puerto: t, x: agua % v.tw, y: agua / v.tw | 0, ruta: null, i: 0, vuelta: 0, r: [] });
      }
    }
  }
  function navegar(m, b, ter) {
    const v = m.vida, c = S().civ(m, b.c);
    if (!c) return;
    if (b.tipo === 'pesca') {
      // Faena cerca de su puerto: cada tanto vuelve con pescado.
      const base = aguaJunto(m, b.puerto, ter);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
        const n = (b.y + dy) * v.tw + b.x + dx;
        if (b.x + dx >= 0 && b.x + dx < v.tw && n >= 0 && n < ter.length && navegable(ter, n) && dist(m, n, base) <= 7) { b.x += dx; b.y += dy; break; }
      }
      if (azar(v) < 0.08) c.comida = (c.comida || 0) + 1;
    } else {
      if (!b.ruta) {
        if (azar(v) < 0.7) { b.r.push(b.x, b.y); return; }
        const otros = puertosDelTurno.filter(t => { if (t === b.puerto) return false; const o = S().civ(m, m.dueno[region(m, t)]); return o && o.id !== c.id && !S().enGuerra(c, o); });
        if (!otros.length) { b.r.push(b.x, b.y); return; }
        const destino = otros[Math.floor(azar(v) * otros.length)];
        const de = aguaJunto(m, b.puerto, ter), a = aguaJunto(m, destino, ter);
        // Las travesías se recuerdan (el mar no cambia): solo se calcula la primera vez.
        const clave = de + '>' + a;
        if (!(clave in travesias) || travesias.mundo !== m) { if (travesias.mundo !== m) travesias = { mundo: m }; travesias[clave] = de != null && a != null ? rutaPorMar(m, de, a, ter) : null; }
        const ruta = travesias[clave];
        if (!ruta || ruta.length < 3) { b.r.push(b.x, b.y); return; }
        b.ruta = ruta; b.i = 0; b.vuelta = 0; b.destino = destino;
      }
      b.i += b.vuelta ? -2 : 2;
      if (!b.vuelta && b.i >= b.ruta.length - 1) {
        b.i = b.ruta.length - 1; b.vuelta = 1;
        const o = S().civ(m, m.dueno[region(m, b.destino)]);
        if (o && !S().enGuerra(c, o)) { c.riqueza += 5 + c.era; o.riqueza += 4 + o.era; c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1); }
      } else if (b.vuelta && b.i <= 0) { b.i = 0; b.ruta = null; }
      const t = b.ruta ? b.ruta[Math.max(0, Math.min(b.ruta.length - 1, b.i))] : aguaJunto(m, b.puerto, ter);
      if (t != null) { b.x = t % v.tw; b.y = t / v.tw | 0; }
    }
    b.r.push(b.x, b.y);
  }

  /*
   * EL ASEDIO, como en WorldBox: si el capitán está en la plaza enemiga, sin defensores y sin torre en pie,
   * la captura avanza; al llegar a 100, la plaza y sus tierras cambian de bandera.
   */
  function asedios(m, paso) {
    const v = m.vida;
    for (const id of Object.keys(v.ejercitos)) {
      const e = v.ejercitos[id], c = S().civ(m, +id), o = S().civ(m, e.con);
      if (!c || !o || !o.viva || e.fase !== 'marcha' || e.defiende != null || m.dueno[e.obj] !== o.id) continue;
      const enRegion = a => region(m, a.y * v.tw + a.x) === e.obj;
      const nuestros = v.aldeanos.filter(a => a.c === c.id && a.o === GUERRERO && enRegion(a));
      const defensores = v.aldeanos.filter(a => a.c === o.id && a.o === GUERRERO && enRegion(a)).length;
      const capitan = nuestros.some(a => a.id === e.capitan);
      const torre = parcelas(m, e.obj).some(t => v.obra[t] === OBRA.torre);
      if (capitan && !defensores && !torre) e.asedio = Math.min(100, (e.asedio || 0) + 1.5 + 0.6 * Math.min(8, nuestros.length));
      else if (defensores) e.asedio = Math.max(0, (e.asedio || 0) - 2);
      if (e.asedio >= 100) capturar(m, c, o, e.obj, paso);
    }
  }
  function capturar(m, c, o, r, paso) {
    const v = m.vida, esCapital = o.capital === r;
    const tierras = S().casillas(m, o).filter(i => i === r || (S().distancia(i, r) <= 2 && S().distancia(i, r) < S().distancia(i, o.capital)));
    for (const i of tierras) m.dueno[i] = c.id;
    const ciudad = (m.ciudades || []).find(x => x.region === r);
    o.estab -= esCapital ? 20 : 8;
    c.victorias = (c.victorias || 0) + 3;
    S().cronica(m, 'conquista', c.nombre + (esCapital ? ' toma la capital de ' : ' conquista ') + (ciudad ? ciudad.nombre : esCapital ? o.nombre : 'una plaza de ' + o.nombre), 'Tras ' + (esCapital ? 'un largo asedio' : 'el asedio') + ', el estandarte de ' + c.nombre + ' ondea en ' + (ciudad ? ciudad.nombre : 'la plaza') + '. ' + tierras.length + ' comarcas cambian de dueño.', c, r, { importante: esCapital });
    delete v.ejercitos[c.id];
    void paso;
  }

  /*
   * LAS TORRES DE VIGILANCIA: disparan flechas a los guerreros enemigos cercanos e impiden la captura de su
   * plaza mientras estén en pie. Los guerreros que las rodean las acaban derribando.
   */
  function torres(m, paso, guerreros) {
    const v = m.vida;
    v.torres = v.torres || {};
    for (const k of Object.keys(v.torres)) {
      const t = +k;
      if (v.obra[t] !== OBRA.torre) { delete v.torres[k]; continue; }
      const c = S().civ(m, m.dueno[region(m, t)]);
      if (!c || !c.guerras.length) continue;
      const tx = t % v.tw, ty = t / v.tw | 0;
      let blanco = null, cerca = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const lista = guerreros.get((ty + dy) * v.tw + tx + dx);
        if (!lista) continue;
        for (const b of lista) if (c.guerras.some(g => g.con === b.c)) { if (!blanco) blanco = b; if (Math.abs(dx) + Math.abs(dy) <= 1) cerca++; }
      }
      if (blanco && azar(v) < 0.5) {
        v.disparos.push([tx, ty, blanco.x, blanco.y, paso, c.era >= 5 ? 1 : 0]);
        if (azar(v) < 0.22) { v.aldeanos = v.aldeanos.filter(a => a !== blanco); v.muertos.push([blanco.x, blanco.y, blanco.c, 'torre', paso]); }
      }
      if (cerca) { v.torres[k] -= cerca * 0.4; if (v.torres[k] <= 0) { cambiar(m, 'obra', t, OBRA.ruina, paso); delete v.torres[k]; } }
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

  // Búsquedas que ya fallaron este turno (para no repetirlas en cada paso): se vacía al empezar el turno.
  let memo = new Map();
  // ---------- Un turno de vida ----------
  function turno(m) {
    if (!m.vida) crear(m);
    const v = m.vida;
    memo = new Map();
    v.cambios = []; v.muertos = []; v.disparos = [];
    for (const a of v.aldeanos) a.edad = (a.edad == null ? ADULTO + (a.id % 10) : a.edad + 1);
    v.mena = v.mena || new Array(v.tw * v.th).fill(0); v.barcos = v.barcos || []; v.torres = v.torres || {}; v.ejercitos = v.ejercitos || {}; v.cultivo = v.cultivo || new Array(v.tw * v.th).fill(0); v.animales = v.animales || []; v.camino = v.camino || new Array(v.tw * v.th).fill(0); v.rutas = v.rutas || [];
    centros(m);
    let rec = recursos(m);
    sincronizar(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length })));
    rec = recursos(m);
    ejercitos(m);
    const ter = terrenos(m);
    for (const a of v.aldeanos) a.r = [a.x, a.y, a.e === TRABAJAR ? ACC.trabajar : a.k ? ACC.cargar : ACC.andar];
    barcos(m, ter);
    for (const b of v.animales) b.r = [b.x, b.y];
    for (const b of v.barcos) b.r = [b.x, b.y];
    for (let paso = 1; paso <= TICKS; paso++) {
      for (const b of v.animales) pastar(m, b, ter);
      for (const b of v.barcos) navegar(m, b, ter);
      // Dónde está cada guerrero, para que se encuentren en la frontera.
      const guerreros = new Map();
      for (const a of v.aldeanos) if (a.o === GUERRERO) { const t = a.y * v.tw + a.x; (guerreros.get(t) || guerreros.set(t, []).get(t)).push(a); }
      const muertos = new Set();
      for (const a of v.aldeanos) if (!muertos.has(a)) actuar(m, a, rec[a.c], ter, paso, guerreros, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
      torres(m, paso, guerreros);
      asedios(m, paso);
    }
    naturaleza(m, ter);
    contar(m);
    ciudades(m);
    abandonos(m);
    planificarRutas(m, terrenos(m));
    fauna(m, ter);
    comer(m);
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
    } else if (a.e === VIAJAR) {
      // El comerciante sigue su ruta tramo a tramo (el doble de rápido donde ya hay camino).
      const ru = v.rutas.find(x => x.id === a.ruta);
      if (!ru || !rutaActiva(m, ru)) a.e = LIBRE;
      else {
        acc = ACC.cargar;
        const pasos = v.camino[ru.tiles[a.i]] ? 2 : 1;
        for (let k = 0; k < pasos; k++) {
          const sig = a.i + a.dir;
          if (sig < 0 || sig >= ru.tiles.length) break;
          a.i = sig;
        }
        const t = ru.tiles[a.i];
        a.x = t % v.tw; a.y = t / v.tw | 0;
        if (a.i === 0 || a.i === ru.tiles.length - 1) {
          if (a.vuelta) { a.e = ESPERAR; a.t = 2; a.ruta = null; }
          else { a.e = TRABAJAR; a.t = 2; a.comercio = 1; }
        }
      }
    }
    if (a.ahogado) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'ahogado', paso]); return; }
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
        const g = S().civ(m, gana.c); g.victorias = (g.victorias || 0) + 1; gana.bajas = (gana.bajas || 0) + 1;
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
          if (azar(v) < 0.3 * pa / (pa + pb) * 2) { muertos.add(blanco); v.muertos.push([blanco.x, blanco.y, blanco.c, 'flecha', paso]); c.victorias = (c.victorias || 0) + 1; a.bajas = (a.bajas || 0) + 1; }
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
      if (t >= 0 && t < ter.length && andable(ter[t]) && dist(m, t, base) <= 4) { ir(a, t, v.tw, IR); a.paseo = 1; return; }
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

  // Lo más cercano a la aldea del aldeano que cumpla una condición: busca región a región, en anillos.
  function cercaDeCasa(m, a, c, rec, sirve, maxAnillo, clave) {
    const k = clave ? clave + ':' + a.h : null;
    if (k && memo.get(k) === -1) return -1;
    const r0 = cercaDeCasa2(m, a, c, rec, sirve, maxAnillo);
    if (k && r0 < 0) memo.set(k, -1);
    return r0;
  }
  function cercaDeCasa2(m, a, c, rec, sirve, maxAnillo) {
    const v = m.vida, aqui = a.y * v.tw + a.x, [hx, hy] = [a.h % m.W, Math.floor(a.h / m.W)];
    for (let anillo = 0; anillo <= maxAnillo; anillo++) {
      let mejor = -1, md = 1e9;
      for (let ry = hy - anillo; ry <= hy + anillo; ry++) for (let rx = hx - anillo; rx <= hx + anillo; rx++) {
        if (Math.max(Math.abs(rx - hx), Math.abs(ry - hy)) !== anillo || rx < 0 || ry < 0 || rx >= m.W || ry >= m.H) continue;
        const r = ry * m.W + rx, d0 = m.dueno[r];
        if (d0 >= 0 && d0 !== c.id) continue;
        for (const t of parcelas(m, r)) {
          if (!sirve(t) || rec.reservadas.has(t)) continue;
          const d = dist(m, aqui, t);
          if (d < md) { md = d; mejor = t; }
        }
      }
      if (mejor >= 0) return mejor;
    }
    return -1;
  }

  function elegirTarea(m, a, c, rec, ter) {
    const v = m.vida;
    if (esNino(a)) { pasear(m, a, ter, c); return; }
    if (a.colono != null) { ir(a, centro(m, a.colono), v.tw, IR); a.viajeColono = 1; return; }
    a.paseo = 0;
    if (a.k) { ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    let t = -1;
    if (a.o === LENADOR && c.madera < (60 + 20 * c.era) * prio(c, 'madera') * 1.5) t = cercaDeCasa(m, a, c, rec, x => v.arbol[x] >= 2, 3, 'arbol');
    else if (a.o === MINERO) {
      // Con la Edad del Bronce, los mineros buscan vetas de metal para la armería; si no, piedra.
      const faltaMetal = c.era >= 1 && (c.metal || 0) < 8 + 4 * c.era;
      if (faltaMetal && azar(v) < 0.8) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && v.mena[x] > 0, 4, 'mena');
      if (t < 0 && c.piedra < (30 + 10 * c.era) * Math.max(0.5, prio(c, 'piedra'))) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && ter[x] !== 'agua', 3, 'roca');
    }
    else if (a.o === GRANJERO) {
      a.siega = 0;
      // Primero se siega lo que está maduro; luego se aran campos nuevos si hacen falta.
      const km = 'mad:' + a.h;
      if (!memo.has(km)) memo.set(km, [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r)).filter(x => v.obra[x] === OBRA.campo));
      const maduros = memo.get(km).filter(x => v.cultivo[x] >= 3 && v.obra[x] === OBRA.campo && !rec.reservadas.has(x));
      if (maduros.length) { t = maduros[Math.floor(azar(v) * maduros.length)]; a.siega = 1; }
      else if (c.campos < metaCampos(c) && memo.get('campo:' + a.h) !== -1) { t = libre(m, a, c, rec, ter, CULTIVABLE, junto => molinoCerca(m, c, null, junto)); if (t < 0) memo.set('campo:' + a.h, -1); }
    }
    else if (a.o === CONSTRUCTOR) {
      a.obraCamino = 0; a.edificio = 0;
      // Los caminos pendientes se empiedran cuando las casas no corren prisa (o una de cada dos veces).
      const pend = (v.pendientes && v.pendientes[c.id]) || [];
      if (pend.length && (!faltanCamas(c) || azar(v) < 0.4)) {
        const aqui = a.y * v.tw + a.x;
        let md = 40;
        for (const x of pend) { if (rec.reservadas.has(x) || v.camino[x]) continue; const d = dist(m, aqui, x); if (d < md) { md = d; t = x; } }
        if (t >= 0) a.obraCamino = 1;
      }
      if (t < 0 && (azar(v) < 0.6 || !molinoCerca(m, c, a.h))) { const ed = edificioPendiente(m, a, c, ter); if (ed) { t = ed[0]; a.edificio = ed[1]; } }
      if (t < 0 && faltanCamas(c) && c.madera >= 2 && memo.get('casa:' + a.h) !== -1) { t = casaNueva(m, a, c, rec, ter); if (t < 0) memo.set('casa:' + a.h, -1); }
    }
    else if (a.o === COMERCIANTE) {
      // Elige una ruta abierta de su pueblo y sale desde su extremo: la capital propia en las rutas entre reinos.
      const rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru));
      if (rutas.length) {
        const ru = rutas[Math.floor(azar(v) * rutas.length)], aqui = a.y * v.tw + a.x;
        const desdeA = ru.tipo === 'externa' ? ru.a === c.id : dist(m, aqui, ru.tiles[0]) <= dist(m, aqui, ru.tiles[ru.tiles.length - 1]);
        a.ruta = ru.id; a.dir = desdeA ? 1 : -1; a.i = desdeA ? 0 : ru.tiles.length - 1; a.vuelta = 0; a.viaje = 1;
        t = ru.tiles[a.i];
      }
    }
    else if (a.o === GUERRERO && v.ejercitos[c.id]) {
      // En formación detrás del capitán: primero al punto de reunión, luego a por el objetivo.
      const e = v.ejercitos[c.id], base = centro(m, e.defiende != null ? e.defiende : e.fase === 'reunion' ? e.reunion : e.obj);
      const dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 3) - 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
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
  // Hacen falta casas cuando no quedan camas para los que van a nacer (como en WorldBox: se construye por necesidad).
  const faltanCamas = c => (c.sinCama || 0) > 0 || (c.camas || 0) - (c.aldeanos || 0) < 2 + Math.round(prio(c, 'casas') * 1.5);
  // Una casa nueva va siempre pegada a lo que ya hay (casas, plaza, molino, caminos), lo más cerca posible de la plaza:
  // así el pueblo crece como una mancha alrededor de su centro.
  const PEGA = new Set([OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.molino, OBRA.templo, OBRA.torre]);
  function casaNueva(m, a, c, rec, ter) {
    const v = m.vida, base = centro(m, a.h), regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 1e9;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.camino[t] || v.arbol[t] >= 2 || !CONSTRUIBLE.has(ter[t]) || rec.reservadas.has(t)) continue;
      const x = t % v.tw;
      let junto = false;
      for (const d of [-1, 1, -v.tw, v.tw, -v.tw - 1, -v.tw + 1, v.tw - 1, v.tw + 1]) { const n = t + d; if (n < 0 || n >= v.obra.length || Math.abs((n % v.tw) - x) > 1) continue; if (PEGA.has(v.obra[n]) || v.camino[n]) { junto = true; break; } }
      if (!junto) continue;
      const dd = dist(m, base, t) + azar(v) * 1.2;
      if (dd < md) { md = dd; mejor = t; }
    }
    return mejor;
  }

  // Una parcela libre cerca de casa: primero en su región, luego en las regiones propias de alrededor.
  // ¿Hay un molino cerca? (de la región de la aldea, o a 3 parcelas de una parcela concreta)
  function molinoCerca(m, c, r, t) {
    const v = m.vida;
    if (t != null) {
      const tx = t % v.tw, ty = t / v.tw | 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { if (Math.abs(dx) + Math.abs(dy) > 4) continue; const n = (ty + dy) * v.tw + tx + dx; if (n >= 0 && n < v.obra.length && v.obra[n] === OBRA.molino) return true; }
      return false;
    }
    return [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)].some(z => parcelas(m, z).some(x => v.obra[x] === OBRA.molino));
  }
  function libre(m, a, c, rec, ter, sirve, filtro) {
    const v = m.vida, base = centro(m, a.h);
    const regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 99;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.camino[t] || v.arbol[t] >= 2 || !sirve.has(ter[t]) || rec.reservadas.has(t) || (filtro && !filtro(t))) continue;
      const d = dist(m, base, t) + azar(v) * 1.5;
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Un paso hacia el destino por tierra (o en barca desde el Renacimiento).
  const enAgua = (m, ter, t) => mojada(ter[t]) && !m.vida.camino[t];
  function andar(m, a, c, ter) {
    const v = m.vida;
    if (++a.q > (a.colono != null ? 400 : 40)) return false;
    // Nadando se avanza a medio paso.
    if (enAgua(m, ter, a.y * v.tw + a.x) && !a.porCamino) { a.brazada = !a.brazada; if (a.brazada) return true; }
    const opciones = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const ahora = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y);
    let mejor = null, mv = 1e9;
    for (const [dx, dy] of opciones) {
      const x = a.x + dx, y = a.y + dy;
      if (x < 0 || y < 0 || x >= v.tw || y >= v.th) continue;
      const n = y * v.tw + x;
      // El agua solo se elige si no hay otro camino: cuesta más, y el mar abierto mucho más.
      const coste = enAgua(m, ter, n) ? (ter[n] === 'agua' ? 4 : 2) : 0;
      const d = Math.abs(a.tx - x) + Math.abs(a.ty - y) + coste + azar(v) * 0.9;
      if (d < mv) { mv = d; mejor = [x, y]; }
    }
    if (!mejor) return false;
    // Atascado detrás de agua: un paso a un lado para rodearla.
    if (mv >= ahora + 0.9 && a.q > 20) return false;
    a.x = mejor[0]; a.y = mejor[1];
    // En el mar abierto uno se puede ahogar; en un río o en la orilla, casi nunca.
    const t = a.y * v.tw + a.x;
    if (enAgua(m, ter, t) && azar(v) < (ter[t] === 'agua' ? 0.06 : ter[t] === 'bajo' ? 0.01 : 0.003)) a.ahogado = 1;
    // Por un camino se va el doble de rápido.
    if (v.camino[t] && !a.porCamino && !a.ahogado && (a.tx !== a.x || a.ty !== a.y)) { a.porCamino = 1; andar(m, a, c, ter); a.porCamino = 0; }
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
    if (a.viajeColono) { a.viajeColono = 0; if (a.colono != null) fundar(m, a, c); a.e = ESPERAR; a.t = 2; return; }
    if (a.o === COMERCIANTE && a.viaje) { a.viaje = 0; a.e = VIAJAR; return; }
    if (a.paseo) { a.e = ESPERAR; a.t = a.paseo === 2 ? 3 : 1 + Math.floor(azar(v) * 2); a.paseo = 0; return; }
    if (a.o === LENADOR) { if (v.arbol[t] >= 2) { a.e = TRABAJAR; a.t = 2; } else a.e = LIBRE; }
    else if (a.o === MINERO) { if (v.roca[t] > 0) { a.e = TRABAJAR; a.t = 3; } else a.e = LIBRE; }
    else if (a.o === GRANJERO) { if (a.siega && v.obra[t] === OBRA.campo && v.cultivo[t] >= 3) { a.e = TRABAJAR; a.t = 2; } else if (!a.siega && !v.obra[t] && v.arbol[t] < 2) { a.e = TRABAJAR; a.t = 3; } else { a.e = LIBRE; a.siega = 0; } }
    else if (a.o === CONSTRUCTOR && a.edificio) {
      if (!v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 0, paso); cambiar(m, 'obra', t, a.edificio, paso); if (a.edificio === OBRA.torre) (v.torres = v.torres || {})[t] = 12; }
      a.edificio = 0;
    }
    else if (a.o === CONSTRUCTOR && a.obraCamino) { if (!v.camino[t] && !v.obra[t]) { a.e = TRABAJAR; a.t = 1; } else { a.e = LIBRE; a.obraCamino = 0; } }
    else if (a.o === CONSTRUCTOR && a.edificio) {
      const coste = COSTES[a.edificio];
      if (!v.obra[t] && c.madera >= coste[0] && c.piedra >= coste[1]) { c.madera -= coste[0]; c.piedra -= coste[1]; a.e = TRABAJAR; a.t = 5; } else { a.e = LIBRE; a.edificio = 0; }
    }
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
    if (a.o === GRANJERO && a.siega && v.obra[t] === OBRA.campo) { cambiar(m, 'cultivo', t, 0, paso); c.comida = (c.comida || 0) + 2 + (c.molinos ? 1 : 0); a.siega = 0; }
    else if (a.o === GRANJERO && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.campo, paso); cambiar(m, 'cultivo', t, 0, paso); c.campos++; }
    else if (a.o === CONSTRUCTOR && a.obraCamino) {
      // Un tramo de camino: se quita el árbol o la roca; desde la Antigüedad se empiedra (cuesta un poco de piedra).
      if (!v.camino[t] && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 1, paso); if (c.era >= 3 && c.piedra >= 0.25) c.piedra -= 0.25; }
      a.obraCamino = 0;
    }
    else if (a.o === CONSTRUCTOR && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.casa, paso); c.casas++; }
    else if (a.o === COMERCIANTE && a.comercio) {
      // Llega la carreta: se vende, se compra, y los dos lados ganan (más si el camino está terminado).
      const ru = v.rutas.find(x => x.id === a.ruta);
      if (ru && rutaActiva(m, ru)) {
        const hecho = ru.tiles.filter(x => v.camino[x]).length / ru.tiles.length, k = 0.6 + 0.6 * hecho;
        if (ru.tipo === 'interna') { c.riqueza += (2 + 0.6 * c.era) * k; c.estab = Math.min(100, c.estab + 0.3); }
        else {
          const o = S().civ(m, ru.a === c.id ? ru.b : ru.a);
          c.riqueza += (3 + 0.8 * c.era) * k; o.riqueza += (2 + 0.6 * o.era) * k;
          c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1);
          if (o.era > c.era) c.ciencia += 3; // las ideas viajan con las mercancías
        }
        c.comerciado = (c.comerciado || 0) + 1;
        a.vuelta = 1; a.dir = -a.dir; a.e = VIAJAR; a.comercio = 0;
        return;
      }
      a.comercio = 0;
    }
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

  /*
   * CAMINOS Y RUTAS COMERCIALES. Cada ciudad se une a su capital por un camino trazado por el terreno más
   * fácil (evita el agua, las montañas y las casas, y aprovecha los caminos que ya hay); las capitales de
   * reinos vecinos que se llevan bien abren rutas entre sí; y cada ciudad tiene sus calles. Los constructores
   * empiedran los caminos parcela a parcela, y los comerciantes los recorren con su carreta.
   */
  function trazar(m, de, a, ter) {
    const v = m.vida, tw = v.tw, th = v.th;
    const [ax, ay] = [de % tw, de / tw | 0], [bx, by] = [a % tw, a / tw | 0];
    const x0 = Math.max(0, Math.min(ax, bx) - 14), x1 = Math.min(tw - 1, Math.max(ax, bx) + 14), y0 = Math.max(0, Math.min(ay, by) - 14), y1 = Math.min(th - 1, Math.max(ay, by) + 14);
    const coste = t => {
      const tr = ter[t];
      if (tr === 'agua' || tr === 'bajo') return Infinity;
      if (v.camino[t]) return 0.35;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.campo || o === OBRA.ruina) return 7;
      return (tr === 'montana' ? 5 : tr === 'pantano' ? 2.5 : tr === 'rio' ? 3 : 1) + (v.arbol[t] >= 2 ? 1 : 0) + (v.roca[t] ? 2 : 0);
    };
    const dist = new Map([[de, 0]]), prev = new Map(), abiertos = [[0, de]];
    // Dijkstra con un montículo sencillo.
    const meter = (d, t) => { abiertos.push([d, t]); let i = abiertos.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (abiertos[pa][0] <= abiertos[i][0]) break; [abiertos[pa], abiertos[i]] = [abiertos[i], abiertos[pa]]; i = pa; } };
    const sacar = () => { const top = abiertos[0], fin = abiertos.pop(); if (abiertos.length) { abiertos[0] = fin; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mn = i; if (l < abiertos.length && abiertos[l][0] < abiertos[mn][0]) mn = l; if (r < abiertos.length && abiertos[r][0] < abiertos[mn][0]) mn = r; if (mn === i) break; [abiertos[mn], abiertos[i]] = [abiertos[i], abiertos[mn]]; i = mn; } } return top; };
    abiertos.length = 0; meter(0, de);
    let vistas = 0;
    while (abiertos.length && vistas++ < 9000) {
      const [d, t] = sacar();
      if (t === a) break;
      if (d > (dist.get(t) ?? Infinity)) continue;
      const x = t % tw, y = t / tw | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const n = ny * tw + nx, c = n === a ? 1 : coste(n);
        if (c === Infinity) continue;
        const nd = d + c;
        if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, t); meter(nd, n); }
      }
    }
    if (!prev.has(a)) return null;
    const camino = [a];
    while (camino[camino.length - 1] !== de) camino.push(prev.get(camino[camino.length - 1]));
    return camino.reverse();
  }
  // Las calles de una ciudad: una cruz alrededor de la plaza.
  function calles(m, r) {
    const v = m.vida, cx = (r % m.W) * SUB + 2, cy = (r / m.W | 0) * SUB + 2, out = [];
    for (let d = -2; d <= 2; d++) { out.push(cy * v.tw + cx + d); out.push((cy + d) * v.tw + cx); }
    return [...new Set(out)].filter(t => t >= 0 && t < v.tw * v.th);
  }
  const rutaActiva = (m, ru) => { const a = S().civ(m, ru.a), b = S().civ(m, ru.b); return a && a.viva && b && b.viva && (a === b || !S().enGuerra(a, b)); };
  function planificarRutas(m, ter) {
    const v = m.vida;
    // Fuera las rutas cuyos extremos ya no valen (ciudad conquistada, capital movida, pueblo muerto).
    v.rutas = v.rutas.filter(ru => {
      const a = S().civ(m, ru.a), b = S().civ(m, ru.b);
      if (!a || !a.viva || !b || !b.viva) return false;
      if (ru.tipo === 'interna') return a.capital === ru.ra && m.dueno[ru.rb] === a.id && (m.ciudades || []).some(x => x.region === ru.rb);
      if (ru.tipo === 'externa') return a.capital === ru.ra && b.capital === ru.rb;
      return m.dueno[ru.ra] === a.id;
    });
    const hay = clave => v.rutas.some(ru => ru.clave === clave);
    let nuevas = 0;
    const abrir = (ru, de, a) => {
      if (nuevas >= 3) return;
      const tiles = trazar(m, de, a, ter);
      nuevas++;
      if (tiles && tiles.length > 2) { ru.id = v.sig++; ru.tiles = tiles; v.rutas.push(ru); return true; }
      return false;
    };
    for (const c of S().vivas(m)) {
      if (!hay('c:' + c.capital)) v.rutas.push({ id: v.sig++, clave: 'c:' + c.capital, tipo: 'calle', a: c.id, b: c.id, ra: c.capital, rb: c.capital, tiles: calles(m, c.capital) });
      for (const x of (m.ciudades || []).filter(x => x.civ === c.id)) {
        if (!hay('c:' + x.region)) v.rutas.push({ id: v.sig++, clave: 'c:' + x.region, tipo: 'calle', a: c.id, b: c.id, ra: x.region, rb: x.region, tiles: calles(m, x.region) });
        const clave = 'i:' + c.capital + ':' + x.region;
        if (!hay(clave)) abrir({ clave, tipo: 'interna', a: c.id, b: c.id, ra: c.capital, rb: x.region }, centro(m, c.capital), centro(m, x.region));
      }
    }
    // Rutas entre reinos: vecinos (o casi) en paz que se llevan bien, o con un tratado de comercio.
    const vivas = S().vivas(m);
    for (const a of vivas) for (const b of vivas) {
      if (a.id >= b.id || S().enGuerra(a, b) || S().distancia(a.capital, b.capital) > 22) continue;
      const tratado = (a.plan && (a.plan.socios || []).includes(b.id)) || (b.plan && (b.plan.socios || []).includes(a.id));
      if (!tratado && (a.rel[b.id] || 0) < 12) continue;
      const externas = c => v.rutas.filter(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)).length;
      if (!tratado && (externas(a) >= 2 || externas(b) >= 2)) continue;
      const clave = 'e:' + a.capital + ':' + b.capital;
      if (hay(clave)) continue;
      if (abrir({ clave, tipo: 'externa', a: a.id, b: b.id, ra: a.capital, rb: b.capital }, centro(m, a.capital), centro(m, b.capital)))
        S().cronica(m, 'comercio', 'Ruta comercial entre ' + a.nombre + ' y ' + b.nombre, 'Las carretas de ' + a.nombre + ' y ' + b.nombre + ' empiezan a ir y venir por un camino nuevo: sal, tela, metal y noticias.', a);
    }
    // Lo que falta por empedrar, por pueblo (en su tierra o en tierra de nadie).
    v.pendientes = {};
    for (const ru of v.rutas) {
      if (!rutaActiva(m, ru)) continue;
      for (const t of ru.tiles) {
        if (v.camino[t] || ter[t] === 'agua' || ter[t] === 'bajo') continue;
        const o = v.obra[t];
        if (o === OBRA.casa || o === OBRA.campo || o === OBRA.ruina) continue;
        const d = m.dueno[region(m, t)], quien = d >= 0 ? (d === ru.a || d === ru.b ? d : -1) : ru.a;
        if (quien >= 0) (v.pendientes[quien] = v.pendientes[quien] || []).push(t);
      }
    }
    for (const c of m.civs) c.rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru)).length;
  }

  /*
   * COMER: cada aldeano se come su ración del granero (los niños, media). Si el granero se vacía, la gente
   * pasa hambre; quien lleva tres turnos sin comer, muere. Al final, la población del reino son sus aldeanos.
   */
  function comer(m) {
    const v = m.vida, porCiv = {};
    for (const a of v.aldeanos) (porCiv[a.c] = porCiv[a.c] || []).push(a);
    const muertos = new Set();
    for (const c of S().vivas(m)) {
      const lista = porCiv[c.id] || [];
      const racion = lista.reduce((k, a) => k + (esNino(a) ? 0.15 : 0.3), 0);
      // La recolección: los adultos que no van a la guerra juntan algo de comida aunque no haya campos.
      const recogen = lista.filter(a => !esNino(a) && a.o !== GUERRERO).length * 0.1 * Math.min(1.5, S().fertil(m, c.capital) / 2);
      c.comida = (c.comida == null ? 30 : c.comida) + recogen - racion;
      if (c.comida < 0) {
        c.comida = 0;
        for (const a of lista) a.hambre = (a.hambre || 0) + 1;
        const caen = lista.filter(a => a.hambre >= 3).sort((x, y) => (y.edad || 0) - (x.edad || 0)).slice(0, Math.ceil(lista.length * 0.3));
        if (caen.length && lista.length - caen.length >= 1) {
          for (const a of caen) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'hambre', TICKS]); }
          if (m.turno - c.ultimaHambre > 6) S().cronica(m, 'hambruna', 'Hambre en ' + c.nombre, 'Los graneros de ' + c.nombre + ' están vacíos. Mueren ' + caen.length + ' aldeanos, primero los más viejos; los demás comen raíces y miran al cielo.', c);
          c.ultimaHambre = m.turno;
        }
      } else for (const a of lista) a.hambre = Math.max(0, (a.hambre || 0) - 1);
      c.comida = Math.min(c.comida, 20 + lista.length * 4);
    }
    if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    actualizarPoblacion(m);
  }
  // La población del reino (lo que usa el motor) sale de sus aldeanos.
  function actualizarPoblacion(m) {
    const v = m.vida, n = {};
    for (const a of v.aldeanos) n[a.c] = (n[a.c] || 0) + 1;
    for (const c of S().vivas(m)) { c.escalaVida = escala(c); c.pob = Math.max(0.5, (n[c.id] || 0) * c.escalaVida); c.pobVida = c.pob; c.habitantes = n[c.id] || 0; }
  }

  // ---------- Los animales: ovejas y vacas junto a las aldeas, ciervos en los bosques, peces en el agua ----------
  const HABITAT = {
    oveja: t => t === 'llanura' || t === 'sabana' || t === 'colina' || t === 'tundra',
    vaca: t => t === 'llanura' || t === 'sabana' || t === 'pantano',
    ciervo: t => t === 'bosque' || t === 'taiga' || t === 'selva' || t === 'llanura',
    pez: t => t === 'agua' || t === 'bajo'
  };
  function pastar(m, b, ter) {
    const v = m.vida;
    if (azar(v) < 0.55) {
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
      const x = b.x + dx, y = b.y + dy;
      // Los rebaños no se alejan de su aldea.
      if (x >= 0 && y >= 0 && x < v.tw && y < v.th && HABITAT[b.tipo](ter[y * v.tw + x]) && (b.casa == null || dist(m, y * v.tw + x, b.casa) <= 6)) { b.x = x; b.y = y; }
    }
    b.r.push(b.x, b.y);
  }
  function fauna(m, ter) {
    const v = m.vida;
    // Los rebaños de cada pueblo, según su tamaño (las vacas llegan con la Edad del Hierro).
    v.animales = v.animales.filter(b => b.c == null || (S().civ(m, b.c) && S().civ(m, b.c).viva));
    for (const c of S().vivas(m)) {
      const n = S().casillas(m, c).length, quiere = { oveja: Math.min(8, 1 + Math.floor(n / 5)), vaca: c.era >= 2 ? Math.min(5, Math.floor(n / 8)) : 0 };
      for (const tipo of ['oveja', 'vaca']) {
        const suyos = v.animales.filter(b => b.c === c.id && b.tipo === tipo);
        for (let k = suyos.length; k < quiere[tipo]; k++) nacer(m, ter, tipo, c);
        if (suyos.length > quiere[tipo]) v.animales = v.animales.filter(b => b !== suyos[0]);
      }
    }
    for (const [tipo, n] of [['ciervo', 22], ['pez', 26]]) {
      const hay = v.animales.filter(b => b.tipo === tipo).length;
      for (let k = hay; k < n; k++) if (!nacer(m, ter, tipo, null)) break;
    }
  }
  function nacer(m, ter, tipo, c) {
    const v = m.vida;
    for (let k = 0; k < 30; k++) {
      let t;
      if (c) { const cs = S().casillas(m, c); const r = azar(v) < 0.5 ? c.capital : cs[Math.floor(azar(v) * cs.length)]; t = parcelas(m, r)[Math.floor(azar(v) * SUB * SUB)]; }
      else t = Math.floor(azar(v) * ter.length);
      if (!HABITAT[tipo](ter[t]) || v.obra[t]) continue;
      if (tipo === 'ciervo' && m.dueno[region(m, t)] >= 0 && azar(v) < 0.8) continue;
      v.animales.push({ id: v.sig++, tipo, c: c ? c.id : null, casa: c ? t : null, x: t % v.tw, y: t / v.tw | 0, r: [] });
      return true;
    }
    return false;
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
      // El trigo crece: tierra arada, brotes, verde y dorado (listo para segar).
      if (ob === OBRA.campo && v.cultivo[t] < 3 && dueno >= 0 && azar(v) < 0.55) cambiar(m, 'cultivo', t, v.cultivo[t] + 1, 1 + Math.floor(azar(v) * TICKS));
      // Lo abandonado se arruina, y las ruinas acaban bajo la hierba.
      if (dueno < 0) {
        if ((ob === OBRA.casa || ob >= OBRA.torre) && azar(v) < 0.2) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (ob === OBRA.campo && azar(v) < 0.25) cambiar(m, 'obra', t, 0, F);
        else if (ob === OBRA.ruina && azar(v) < 0.04) cambiar(m, 'obra', t, 0, F);
      } else if (ob === OBRA.ruina && azar(v) < 0.02) cambiar(m, 'obra', t, 0, F);
      if (v.camino[t] && dueno < 0 && azar(v) < 0.01) cambiar(m, 'camino', t, 0, F);
      if (v.obra[t] || v.roca[t] || v.camino[t] || tierra === 'rio' || tierra === 'arena' || tierra === 'agua' || tierra === 'bajo') continue;
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
        x.civ = d; x.alcalde = persona(v); x.rasgo = ['leal', 'ambicioso', 'codicioso', 'tranquilo'][Math.floor(azar(v) * 4)]; x.conquistada = m.turno;
        if (ahora && antes && antes.viva) S().cronica(m, 'conquista', ahora.nombre + ' toma ' + x.nombre, 'La ciudad de ' + x.nombre + ', que era de ' + antes.nombre + ', iza ahora la bandera de ' + ahora.nombre + '. Su nuevo alcalde, ' + x.alcalde + ', promete respetar los mercados (y subir los impuestos).', ahora, x.region);
      }
      if (v.obra[t] !== OBRA.ayuntamiento) { cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS); cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS); }
    }
    colonos(m);
  }

  /*
   * Una tierra es de un reino mientras vive gente en ella o al lado. La que lleva varios turnos sin nadie
   * cerca (porque la gente se fue, murió o nunca llegó) vuelve a ser tierra de nadie.
   */
  function abandonos(m) {
    const v = m.vida;
    v.vacia = v.vacia || new Array(m.W * m.H).fill(0);
    const poblada = v.poblada || [];
    for (let r = 0; r < m.W * m.H; r++) {
      const d = m.dueno[r];
      if (d < 0) { v.vacia[r] = 0; continue; }
      const c = S().civ(m, d);
      if (!c || c.capital === r || poblada[r] || S().vecinos(r).some(w => m.dueno[w] === d && poblada[w])) { v.vacia[r] = 0; continue; }
      if (++v.vacia[r] >= 4) { m.dueno[r] = -1; v.vacia[r] = 0; }
    }
  }

  /*
   * LOS COLONOS, como en WorldBox: cuando un pueblo está lleno (sin camas o al límite de comida), tres aldeanos
   * salen andando hacia una tierra libre y fértil y fundan allí una aldea nueva, con su ayuntamiento y su molino.
   */
  function colonos(m) {
    const v = m.vida, ter = terrenos(m);
    for (const c of S().vivas(m)) {
      const enCamino = v.aldeanos.filter(a => a.c === c.id && a.colono != null);
      if (enCamino.length) continue;
      const suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
      const lleno = (c.sinCama || 0) > 0 || (c.cap && c.pob > c.cap * 0.5);
      if (!lleno || suyas >= S().maxCiudades(c) || m.turno - (c.ultimaColonia || -99) < 4) continue;
      const cs = S().casillas(m, c);
      const destino = [];
      for (let r = 0; r < m.W * m.H; r++) {
        if (m.dueno[r] >= 0 || !S().esTierra(m, r) || S().fertil(m, r) < 2 || m.tipo[r] === 'nieve') continue;
        const d = Math.min(...[c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].map(p => S().distancia(p, r)));
        if (d < 4 || d > 12) continue;
        if (S().vecinos(r).some(w => m.dueno[w] >= 0 && m.dueno[w] !== c.id)) continue;
        if (!ter[centro(m, r)] || !andable(ter[centro(m, r)])) continue;
        destino.push([r, d - S().fertil(m, r) * 0.8 + azar(v) * 2]);
      }
      if (!destino.length) continue;
      const r = destino.sort((p, q) => p[1] - q[1])[0][0];
      const elegidos = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && a.o !== GUERRERO && !a.k && a.e !== VIAJAR).slice(0, 3);
      if (elegidos.length < 2) continue;
      c.ultimaColonia = m.turno;
      for (const a of elegidos) { a.colono = r; a.e = LIBRE; a.paseo = 0; a.edificio = 0; a.obraCamino = 0; }
      void cs;
    }
  }
  // Un colono llega a su destino: si la tierra sigue libre, funda la aldea; si no, vuelve a casa.
  function fundar(m, a, c) {
    const v = m.vida, r = a.colono;
    const yaFundada = (m.ciudades || []).find(x => x.region === r && x.civ === c.id);
    if (!yaFundada && m.dueno[r] >= 0) { for (const b of v.aldeanos) if (b.colono === r && b.c === c.id) b.colono = null; return; }
    if (!yaFundada) {
      m.dueno[r] = c.id;
      for (const w of S().vecinos(r)) if (S().esTierra(m, w) && m.dueno[w] < 0 && azar(v) < 0.5) m.dueno[w] = c.id;
      const x = { region: r, nombre: nombreCiudad(m), civ: c.id, alcalde: persona(v), rasgo: ['leal', 'ambicioso', 'codicioso', 'tranquilo', 'tranquilo'][Math.floor(azar(v) * 5)], fundada: m.anio, lealtad: 40 };
      (m.ciudades = m.ciudades || []).push(x);
      const t = centro(m, r), ter = terrenos(m);
      cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS); cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS);
      const mol = parcelas(m, r).filter(q => q !== t && !v.obra[q] && CULTIVABLE.has(ter[q])).sort((p, q) => dist(m, p, t) - dist(m, q, t))[0];
      if (mol != null) { cambiar(m, 'arbol', mol, 0, TICKS); cambiar(m, 'roca', mol, 0, TICKS); cambiar(m, 'obra', mol, OBRA.molino, TICKS); }
      S().cronica(m, 'ciudad', 'Colonos de ' + c.nombre + ' fundan ' + x.nombre, 'Tres familias de ' + c.nombre + ' cargan sus cosas, caminan durante días y se asientan en tierras vírgenes. Encienden una hoguera, levantan un molino y llaman al lugar ' + x.nombre + '.', c, r);
    }
    for (const b of v.aldeanos) if (b.colono === r && b.c === c.id) { b.colono = null; b.h = r; }
  }

  // Lo que cada pueblo tiene levantado en su tierra: lo usa la capacidad (sim.js) y la ficha.
  function contar(m) {
    const v = m.vida, casas = {}, campos = {}, arboles = {}, edif = {}, camas = {};
    for (let t = 0; t < v.tw * v.th; t++) {
      const d = m.dueno[region(m, t)];
      if (d < 0) continue;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento) { casas[d] = (casas[d] || 0) + (o === OBRA.casa ? 1 : 0.5); camas[d] = (camas[d] || 0) + (o === OBRA.casa ? 3 : o === OBRA.centro ? 1.5 : 3); }
      else if (o === OBRA.campo) campos[d] = (campos[d] || 0) + 1;
      else if (o >= OBRA.torre) { const e = (edif[d] = edif[d] || {}); e[o] = (e[o] || 0) + 1; }
      if (v.arbol[t] >= 2) arboles[d] = (arboles[d] || 0) + 1;
    }
    // Las regiones pobladas (con alguna obra o camino): el reino solo se extiende junto a ellas.
    v.poblada = new Array(m.W * m.H).fill(0);
    for (let t = 0; t < v.tw * v.th; t++) if ((v.obra[t] && v.obra[t] !== OBRA.ruina) || v.camino[t]) v.poblada[region(m, t)] = 1;
    const gente = {}, guerreros = {}, armados = {}, comerciantes = {};
    for (const a of v.aldeanos) { gente[a.c] = (gente[a.c] || 0) + 1; if (a.o === GUERRERO) { guerreros[a.c] = (guerreros[a.c] || 0) + 1; if ((a.arma || 0) > 0) armados[a.c] = (armados[a.c] || 0) + 1; } if (a.o === COMERCIANTE) comerciantes[a.c] = (comerciantes[a.c] || 0) + 1; }
    for (const c of m.civs) {
      c.casas = Math.round(casas[c.id] || 0); c.campos = campos[c.id] || 0; c.arboles = arboles[c.id] || 0; c.aldeanos = gente[c.id] || 0; c.guerreros = guerreros[c.id] || 0; c.armados = armados[c.id] || 0; c.comerciantes = comerciantes[c.id] || 0; c.camas = Math.round(camas[c.id] || 0) + 2;
      const e = edif[c.id] || {}; c.torres = e[OBRA.torre] || 0; c.templos = e[OBRA.templo] || 0; c.molinos = e[OBRA.molino] || 0; c.puertos = e[OBRA.puerto] || 0;
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
    actualizarPoblacion(m);
  }

  M.vida = { SUB, TICKS, ADULTO, VIEJO, escala, anos: a => Math.round((a.edad || 0) < ADULTO ? (a.edad || 0) * 8 : 16 + ((a.edad || 0) - ADULTO) * 2.6), OBRA, OFICIOS, ACC, trazar, calles, ARMAS, TIROS, poder, reparto, crear, turno, terreno, terrenos, region, centro, parcelas, plaza, contar, tierrasPagables, pagarTierra, incendio, plantar, castigo, ajustar };
})(globalThis.RF = globalThis.RF || {});
