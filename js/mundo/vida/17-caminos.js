  // ── GÉNESIS · LA VIDA · Caminos, vías del tren y rutas comerciales a petición ──

  /*
   * CAMINOS Y RUTAS COMERCIALES. Cada ciudad se une a su capital por un camino trazado por el terreno más
   * fácil (evita el agua, las montañas y las casas, y aprovecha los caminos que ya hay); las capitales de
   * reinos vecinos que se llevan bien abren rutas entre sí; y cada ciudad tiene sus calles. Los constructores
   * empiedran los caminos parcela a parcela, y los comerciantes los recorren con su carreta.
   */
  /*
   * LAS VÍAS DEL TREN: una línea propia de estación a estación (o hasta la plaza del otro reino si no tiene),
   * aparte de los caminos: cruza las calles en pasos a nivel pero no va por encima de ellas, rodea los
   * edificios y prefiere el llano (los túneles y los puentes salen caros). Por ella circula un tren cada rato.
   * Nadie construye encima: si un edificio la corta, se vuelve a trazar.
   */
  const esVia = (v, t) => !!(v.via && v.via[t]);
  // Casillas que no se pueden usar para construir ni sembrar: la vía del tren y las trincheras.
  // Ocupada para las obras que el pueblo decide solo: vía, trinchera o parcela que el jugador ya marcó para otra cosa.
  const ocupada = (v, t) => esVia(v, t) || !!(v.trinchera && v.trinchera[t]) || !!(v.muro && v.muro[t] > 0) || !!(v.corralT && v.corralT[t]) || !!(v.marcadas && v.marcadas.has(t));
  const BOSQUE_PLANTABLE = new Set(['bosque', 'selva', 'taiga', 'sakura', 'llanura', 'colina', 'sabana', 'pantano', 'tundra', 'nieve']);
  function planificarVias(m, ter) {
    const v = m.vida, tw = v.tw;
    v.vias = v.vias || {};
    const estacionDe = c => { const cap = centro(m, c.capital); let mejor = null, md = 1e9; for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) if (v.obra[t] === OBRA.estacion) { const d = dist(m, t, cap); if (d < md) { md = d; mejor = t; } } return mejor; };
    const quedan = new Set();
    let nuevas = 0;
    for (const ru of v.rutas) {
      if (ru.tipo !== 'externa' || !rutaActiva(m, ru)) continue;
      const a = S().civ(m, ru.a), b = S().civ(m, ru.b);
      const ea = a && a.era >= 6 && a.estaciones > 0 ? estacionDe(a) : null, eb = b && b.era >= 6 && b.estaciones > 0 ? estacionDe(b) : null;
      if (ea == null && eb == null) continue;
      const de = ea != null ? ea : centro(m, a.capital), hasta = eb != null ? eb : centro(m, b.capital);
      const k = ru.clave, viejo = v.vias[k];
      quedan.add(k);
      // Sigue valiendo si va entre las mismas estaciones y nada la ha cortado.
      if (viejo && viejo.de === de && viejo.a === hasta && viejo.tiles.every((t, i) => i === 0 || i === viejo.tiles.length - 1 || (!v.obra[t] || v.obra[t] === OBRA.campo) && !(ter[t] === 'agua' || ter[t] === 'bajo'))) continue;
      if (nuevas >= 2) continue;
      nuevas++;
      costeVia.v = v; costeVia.ter = ter; costeVia.de = de; costeVia.a = hasta;
      const tiles = trazar(m, de, hasta, ter, true);
      if (tiles && tiles.length > 3) v.vias[k] = { de, a: hasta, tiles, ru: ru.id, desde: m.turno };
      else delete v.vias[k];
    }
    for (const k of Object.keys(v.vias)) if (!quedan.has(k)) delete v.vias[k];
    v.via = new Array(tw * v.th).fill(0);
    // Por donde pasa la vía se tala el bosque y se aparta la piedra.
    for (const k of Object.keys(v.vias)) for (const t of v.vias[k].tiles) if (!v.obra[t] || v.obra[t] === OBRA.campo) { v.via[t] = 1; if (v.arbol[t]) cambiar(m, 'arbol', t, 0, 0); if (v.roca[t]) cambiar(m, 'roca', t, 0, 0); }
  }
  function costeVia(t) {
    const { v, ter } = costeVia, tr = ter[t];
    if (tr === 'agua' || tr === 'bajo') return Infinity;
    const o = v.obra[t];
    if (o && o !== OBRA.campo) return t === costeVia.de || t === costeVia.a ? 1 : Infinity;
    if (v.camino[t]) return 6;
    if (v.via && v.via[t]) return 0.6;
    if (v.plan && v.plan[t] === 1) return 7;
    if (v.plan && v.plan[t] === 2) return 5;
    return (tr === 'montana' ? 9 : tr === 'rio' ? 5 : tr === 'pantano' ? 3 : o === OBRA.campo ? 3 : 1) + (v.arbol[t] >= 2 ? 0.5 : 0) + (v.roca[t] ? 1 : 0);
  }
  function trazar(m, de, a, ter, via, lejos) {
    const v = m.vida, tw = v.tw, th = v.th, mg = lejos ? 40 : 14;
    const [ax, ay] = [de % tw, de / tw | 0], [bx, by] = [a % tw, a / tw | 0];
    const x0 = Math.max(0, Math.min(ax, bx) - mg), x1 = Math.min(tw - 1, Math.max(ax, bx) + mg), y0 = Math.max(0, Math.min(ay, by) - mg), y1 = Math.min(th - 1, Math.max(ay, by) + mg);
    const coste = via ? costeVia : t => {
      const tr = ter[t];
      if (tr === 'agua' || tr === 'bajo') return Infinity;
      if (v.camino[t]) return 0.35;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.campo || o === OBRA.ruina) return 7;
      // Dentro de un pueblo, los caminos van por las calles del plan y no cruzan los solares.
      if (v.plan && v.plan[t] === 1) return 0.6;
      if (v.plan && v.plan[t] === 2) return 4;
      return (tr === 'montana' ? 5 : tr === 'pantano' ? 2.5 : tr === 'rio' ? 3 : 1) + (v.arbol[t] >= 2 ? 1 : 0) + (v.roca[t] ? 2 : 0);
    };
    const dist = new Map([[de, 0]]), prev = new Map(), abiertos = [[0, de]];
    // Dijkstra con un montículo sencillo.
    const meter = (d, t) => { abiertos.push([d, t]); let i = abiertos.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (abiertos[pa][0] <= abiertos[i][0]) break; [abiertos[pa], abiertos[i]] = [abiertos[i], abiertos[pa]]; i = pa; } };
    const sacar = () => { const top = abiertos[0], fin = abiertos.pop(); if (abiertos.length) { abiertos[0] = fin; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mn = i; if (l < abiertos.length && abiertos[l][0] < abiertos[mn][0]) mn = l; if (r < abiertos.length && abiertos[r][0] < abiertos[mn][0]) mn = r; if (mn === i) break; [abiertos[mn], abiertos[i]] = [abiertos[i], abiertos[mn]]; i = mn; } } return top; };
    abiertos.length = 0; meter(0, de);
    let vistas = 0;
    while (abiertos.length && vistas++ < (lejos ? 40000 : 9000)) {
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
    const v = m.vida;
    if (pausada(m)) {
      // Con plan: la calle que rodea la plaza (el primer anillo de la cuadrícula).
      const rx = (r % m.W) * SUB, ry = (r / m.W | 0) * SUB, out = [];
      for (let k = 0; k <= 3; k++) { out.push(ry * v.tw + rx + k, (ry + 3) * v.tw + rx + k, (ry + k) * v.tw + rx, (ry + k) * v.tw + rx + 3); }
      return [...new Set(out)].filter(t => t >= 0 && t < v.tw * v.th);
    }
    const cx = (r % m.W) * SUB + 2, cy = (r / m.W | 0) * SUB + 2, out = [];
    for (let d = -2; d <= 2; d++) { out.push(cy * v.tw + cx + d); out.push((cy + d) * v.tw + cx); }
    return [...new Set(out)].filter(t => t >= 0 && t < v.tw * v.th);
  }
  // (Una ruta entre dos reinos solo funciona si comercian: en guerra o sin permiso, las carretas no salen ni venden.)
  const rutaActiva = (m, ru) => { const a = S().civ(m, ru.a), b = S().civ(m, ru.b); return a && a.viva && b && b.viva && (a === b || comercian(m, a, b)); };
  /*
   * ABRIR UNA RUTA A PETICIÓN («abrid una ruta comercial con X»): se traza en el acto la carretera entre las dos
   * capitales, por lejos que estén, y los constructores de los dos reinos empiezan a empedrarla. Si no hay
   * camino por tierra (un mar en medio), se dice: entonces el comercio va en barco, de puerto a puerto.
   */
  function abrirRuta(m, c, o) {
    const v = m.vida, ter = terrenos(m);
    const [a, b] = c.id < o.id ? [c, o] : [o, c], clave = 'e:' + a.capital + ':' + b.capital;
    const hay = v.rutas.find(ru => ru.clave === clave);
    if (hay) { hay.pedida = 1; return { ok: true, ya: true, n: hay.tiles.length, empedrado: hay.tiles.filter(t => v.camino[t]).length }; }
    const tiles = trazar(m, centro(m, a.capital), centro(m, b.capital), ter, false, true);
    if (!tiles || tiles.length < 3) {
      const puertos = [c, o].every(x => (x.puertos || 0) > 0);
      return { ok: false, mar: true, puertos };
    }
    const ru = { id: v.sig++, clave, tipo: 'externa', a: a.id, b: b.id, ra: a.capital, rb: b.capital, tiles, pedida: 1 };
    v.rutas.push(ru);
    S().cronica(m, 'comercio', 'Carretera entre ' + a.nombre + ' y ' + b.nombre, 'Se abre una ruta de comercio entre ' + a.nombre + ' y ' + b.nombre + ' (' + tiles.length + ' leguas de camino). Los constructores de los dos reinos empiezan a empedrarla y los comerciantes ya cargan las carretas.', c);
    return { ok: true, n: tiles.length, empedrado: tiles.filter(t => v.camino[t]).length };
  }
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
        if (!hay('c:' + x.region) && !(pausada(m) && x.fase && x.fase !== 'aldea')) v.rutas.push({ id: v.sig++, clave: 'c:' + x.region, tipo: 'calle', a: c.id, b: c.id, ra: x.region, rb: x.region, tiles: calles(m, x.region) });
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
      // El reino del jugador no abre rutas por su cuenta (ni se las abren otros): se le avisa de quién quiere comerciar con él.
      const jug = !comercian(m, a, b) && [a, b].find(x => x.jugador && !permiteComercio(x, x === a ? b : a) && !((x.plan && x.plan.embargo) || []).includes((x === a ? b : a).id));
      if (!comercian(m, a, b) && !jug) continue;
      if (jug) {
        const otro = jug === a ? b : a, p = jug.plan = jug.plan || {};
        if (m.turno - ((p.propuestas || {})[otro.id] || -99) >= 40) { (p.propuestas = p.propuestas || {})[otro.id] = m.turno; (v.anuncios = v.anuncios || []).push({ civ: jug.id, region: otro.capital, texto: '🤝 ' + otro.nombre + ' quiere comerciar: di «abrid una ruta comercial con ' + otro.nombre + '»' }); }
        continue;
      }
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
        // Lo empiedra el dueño de la tierra; en tierra de nadie o de un tercer reino en paz, el que la pidió (o el primero).
        const d = m.dueno[region(m, t)], tercero = d >= 0 && d !== ru.a && d !== ru.b, ca = S().civ(m, ru.a), cd = tercero ? S().civ(m, d) : null;
        const quien = d >= 0 && !tercero ? d : tercero ? (cd && ca && !S().enGuerra(ca, cd) ? ru.a : -1) : ru.a;
        if (quien >= 0) (v.pendientes[quien] = v.pendientes[quien] || []).push(t);
      }
    }
    // Las calles del plan se empiedran a medida que tienen casas o edificios al lado (de dentro afuera).
    if (pausada(m) && v.plan) {
      const tw = v.tw;
      for (const ce of v.centros || []) {
        const lista = (v.pendientes[ce.civ] = v.pendientes[ce.civ] || []), ya = new Set(lista), nuevas = [];
        for (let y = Math.max(0, Math.floor(ce.cy - ce.R)); y <= Math.min(v.th - 1, Math.ceil(ce.cy + ce.R)); y++) for (let x = Math.max(0, Math.floor(ce.cx - ce.R)); x <= Math.min(tw - 1, Math.ceil(ce.cx + ce.R)); x++) {
          const t = y * tw + x;
          if (v.plan[t] !== 1 || v.camino[t] || v.obra[t] || ya.has(t) || !andable(ter[t])) continue;
          if ([t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < v.obra.length && v.obra[n] && v.obra[n] !== OBRA.campo && v.obra[n] !== OBRA.ruina)) nuevas.push([M.mat.hypot(x - ce.cx, y - ce.cy), t]);
        }
        nuevas.sort((p, q) => p[0] - q[0]);
        for (const [, t] of nuevas.slice(0, 12)) lista.push(t);
      }
    }
    for (const c of m.civs) c.rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru)).length;
  }
