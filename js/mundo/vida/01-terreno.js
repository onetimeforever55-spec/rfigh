  // ── GÉNESIS · LA VIDA · El suelo de cada parcela: ríos, lagos, islas, y crear la vida de un mundo ──

  // ---------- El suelo de cada parcela ----------
  const esAgua = t => t === 'mar' || t === 'costa';
  /*
   * Las regiones son cuadradas, pero el suelo no: cada parcela mira a la región que tiene al lado de un punto
   * desplazado por un ruido suave, así las costas y los linderos entre biomas ondulan como en WorldBox. El
   * cuadrado del medio de cada región (donde va la plaza) es siempre suyo. Los ríos van de centro a centro
   * dando rodeos, y el agua que toca tierra es poco honda.
   */
  function hashR(sem, x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(sem, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function ruido(sem, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hashR(sem, x0, y0), b = hashR(sem, x0 + 1, y0), c = hashR(sem, x0, y0 + 1), d = hashR(sem, x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  const desvio = (sem, x, y) => (ruido(sem, x / 5, y / 5) - 0.5) * 2.6 + (ruido(sem + 7, x / 2, y / 2) - 0.5) * 1.1;
  function baseEn(m, tx, ty) {
    const rx0 = (tx / SUB) | 0, ry0 = (ty / SUB) | 0, lx = tx - rx0 * SUB, ly = ty - ry0 * SUB;
    let rx = rx0, ry = ry0;
    if (!(lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2)) {
      const sem = m.semilla | 0;
      rx = Math.max(0, Math.min(m.W - 1, Math.floor((tx + 0.5 + desvio(sem, tx, ty)) / SUB)));
      ry = Math.max(0, Math.min(m.H - 1, Math.floor((ty + 0.5 + desvio(sem + 101, tx, ty)) / SUB)));
    }
    const tipo = m.tipo[ry * m.W + rx];
    return tipo === 'mar' ? 'agua' : tipo === 'costa' ? 'bajo' : tipo;
  }
  // El cauce de un río entre dos puntos: pasos de una parcela, eligiendo al azar (fijo) si avanza en x o en y.
  function cauce(m, arr, tw, x0, y0, x1, y1, sem) {
    let x = x0, y = y0, k = 0;
    while (x !== x1 || y !== y1) {
      const t = y * tw + x;
      if (k > 0 && (arr[t] === 'agua' || arr[t] === 'bajo')) return;
      if (arr[t] !== 'agua' && arr[t] !== 'bajo') arr[t] = 'rio';
      const ddx = x1 - x, ddy = y1 - y, h = hashR(sem, x, y + k);
      let enX = ddx && (!ddy || h < Math.abs(ddx) / (Math.abs(ddx) + Math.abs(ddy)));
      // El cuadrado del medio de cada región (la plaza) se rodea si se puede.
      if (ddx && ddy) { const cx = enX ? x + Math.sign(ddx) : x, cy = enX ? y : y + Math.sign(ddy); if (medio(cx, cy)) enX = !enX; }
      if (enX) x += Math.sign(ddx); else y += Math.sign(ddy);
      k++;
    }
    const t = y * tw + x;
    if (arr[t] !== 'agua' && arr[t] !== 'bajo') arr[t] = 'rio';
  }
  const medio = (x, y) => { const lx = x % SUB, ly = y % SUB; return lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2; };
  // El río pasa por una esquina de cada región, nunca por su centro.
  function centroRio(m, rx, ry) { const h = hashR((m.semilla | 0) + 31, rx, ry); return [rx * SUB + (h < 0.5 ? 0 : 3), ry * SUB + ((h * 4 | 0) % 2 ? 3 : 0)]; }
  function rios(m, arr, tw) {
    const sem = (m.semilla | 0) + 57;
    for (let ry = 0; ry < m.H; ry++) for (let rx = 0; rx < m.W; rx++) {
      if (!m.rio[ry * m.W + rx] || esAgua(m.tipo[ry * m.W + rx])) continue;
      const [cx, cy] = centroRio(m, rx, ry);
      arr[cy * tw + cx] = 'rio';
      // Como al crear el mundo, el río baja hacia la región vecina más baja: un solo cauce, sin lazos.
      const r = ry * m.W + rx, sig = S().vecinos(r).sort((p, q) => m.alto[p] - m.alto[q])[0];
      if (sig == null || m.alto[sig] >= m.alto[r]) { if (sig != null) lago(m, arr, tw, cx + Math.sign(sig % m.W - rx) * 2, cy + Math.sign((sig / m.W | 0) - ry) * 2); continue; }
      const nx = sig % m.W, ny = (sig / m.W) | 0, dx = nx - rx, dy = ny - ry, agua = esAgua(m.tipo[sig]);
      // A medio camino, un punto del lindero desplazado: el río no cruza siempre por el mismo sitio.
      const h = hashR(sem, rx * 2 + dx, ry * 2 + dy), mx = dx ? (dx > 0 ? rx * SUB + SUB - 1 + (h < 0.5 ? 0 : 1) : rx * SUB - (h < 0.5 ? 0 : 1)) : cx + Math.round((h - 0.5) * 3);
      const my = dy ? (dy > 0 ? ry * SUB + SUB - 1 + (h < 0.5 ? 0 : 1) : ry * SUB - (h < 0.5 ? 0 : 1)) : cy + Math.round((h - 0.5) * 3);
      const mxx = Math.max(0, Math.min(tw - 1, mx)), myy = Math.max(0, Math.min(m.H * SUB - 1, my));
      cauce(m, arr, tw, cx, cy, mxx, myy, sem);
      if (agua) { // hasta el agua: se sigue en la misma dirección hasta tocarla
        let x = mxx, y = myy, n = 0;
        while (n++ < SUB * 2 && x >= 0 && y >= 0 && x < tw && y < m.H * SUB && arr[y * tw + x] !== 'agua' && arr[y * tw + x] !== 'bajo') { arr[y * tw + x] = 'rio'; x += dx; y += dy; }
      } else { const [ox, oy] = centroRio(m, nx, ny); cauce(m, arr, tw, mxx, myy, ox, oy, sem + 1); if (!m.rio[sig]) lago(m, arr, tw, ox + dx * 2, oy + dy * 2); }
    }
  }
  // Donde un río ya no tiene por dónde bajar, se remansa en un lago pequeño.
  function lago(m, arr, tw, cx, cy) {
    const th = m.H * SUB;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= tw || y >= th) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy) + hashR(m.semilla | 0, x, y) * 1.2;
      const lx = x % SUB, ly = y % SUB; // el cuadrado del medio de cada región queda en tierra (ahí va la plaza)
      if (d < 2.6 && !(lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2) && arr[y * tw + x] !== 'montana' && arr[y * tw + x] !== 'nieve') arr[y * tw + x] = 'bajo';
    }
  }
  function terrenosNuevos(m) {
    const tw = m.W * SUB, th = m.H * SUB, arr = new Array(tw * th);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) arr[ty * tw + tx] = baseEn(m, tx, ty);
    rios(m, arr, tw);
    const tierraFirme = x => x !== 'agua' && x !== 'bajo' && x !== 'rio';
    // La hondura del mar según lo lejos que está la tierra: poco hondo junto a la orilla, hondo mar adentro.
    const lejos = new Array(tw * th).fill(99), cola = [];
    for (let t = 0; t < tw * th; t++) if (tierraFirme(arr[t])) { lejos[t] = 0; cola.push(t); }
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], d = lejos[t] + 1, x = t % tw;
      if (d > 3) continue;
      for (const u of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) if (u >= 0 && u < tw * th && lejos[u] > d) { lejos[u] = d; cola.push(u); }
    }
    const out = arr.slice();
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const t = ty * tw + tx, a = arr[t];
      if (a === 'agua' || a === 'bajo') { out[t] = lejos[t] <= 2 + (hashR(m.semilla | 0, tx >> 1, ty >> 1) < 0.4 ? 1 : 0) ? 'bajo' : 'agua'; continue; }
      const vec = [tx > 0 ? arr[t - 1] : a, tx < tw - 1 ? arr[t + 1] : a, ty > 0 ? arr[t - tw] : a, ty < th - 1 ? arr[t + tw] : a];
      if (tierraFirme(a) && a !== 'montana' && a !== 'nieve' && vec.some(x => x === 'agua' || x === 'bajo')) out[t] = 'arena';
    }
    return out;
  }
  // El suelo solo cambia cuando cambia una región (un bosque talado, un terremoto): se guarda calculado.
  let cache = { m: null, firma: '', arr: null };
  function terrenos(m) {
    const firma = m.tipo.join(',');
    if (cache.m === m && cache.firma === firma) return cache.arr;
    const arr = terrenosNuevos(m);
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

  // Las islas: tierras pequeñas rodeadas de mar (como mucho 10 regiones).
  function islas(m) {
    const n = m.W * m.H, isla = new Array(n).fill(false), visto = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (visto[i] || !S().esTierra(m, i)) continue;
      const grupo = [i]; visto[i] = true;
      for (let k = 0; k < grupo.length && grupo.length <= 11; k++) for (const w of S().vecinos(grupo[k])) if (!visto[w] && S().esTierra(m, w)) { visto[w] = true; grupo.push(w); }
      if (grupo.length <= 10) for (const g of grupo) isla[g] = true;
      else { const cola = grupo.slice(); for (let k = 0; k < cola.length; k++) for (const w of S().vecinos(cola[k])) if (!visto[w] && S().esTierra(m, w)) { visto[w] = true; cola.push(w); } }
    }
    return isla;
  }
  // ---------- Crear la vida de un mundo ----------
  function crear(m) {
    const tw = m.W * SUB, th = m.H * SUB, n = tw * th;
    const v = {
      tw, th, rng: (m.semilla ^ 0x9E3779B9) >>> 0, arbol: new Array(n).fill(0), roca: new Array(n).fill(0), obra: new Array(n).fill(0), mena: new Array(n).fill(0), cultivo: new Array(n).fill(0), camino: new Array(n).fill(0), rutas: [], animales: [], ejercitos: {}, disparos: [],
      fueBosque: new Array(m.W * m.H).fill(0), tipoVisto: m.tipo.slice(), aldeanos: [], sig: 0, centros: {}, cambios: [], avisos: {}
    };
    m.vida = v;
    const ter = terrenos(m);
    v.isla = islas(m);
    for (let t = 0; t < n; t++) {
      // Las playas cálidas y las islas tienen palmeras.
      const rt = m.tipo[region(m, t)], calido = rt === 'selva' || rt === 'sabana' || rt === 'desierto' || v.isla[region(m, t)];
      const r = azar(v), pa = ter[t] === 'arena' ? (v.isla[region(m, t)] ? 0.32 : calido ? 0.16 : 0) : (ARBOLES[ter[t]] || 0) + (v.isla[region(m, t)] && ter[t] !== 'montana' ? 0.15 : 0), pr = ROCAS[ter[t]] || 0;
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
