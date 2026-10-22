  /*
   * GÉNESIS · EL MUNDO
   * Un mapa de casillas con relieve, ríos y desiertos, y unos pocos pueblos que viven solos la historia
   * humana: crecen mientras la tierra les da de comer, se extienden, inventan, comercian, se copian los
   * inventos, guerrean, se rebelan y se hunden. Cada cosa que pasa queda en la crónica con su porqué.
   *
   * Todo es reproducible: el mundo guarda su semilla y el estado del azar, así que la misma semilla y las
   * mismas órdenes dan la misma historia.
   */
  'use strict';
  const M = RF.MUNDO;
  const W = 48, H = 30;
  // El mundo se diseñó con 32×20 regiones: K escala lo que depende del tamaño (capacidad, expansión, fronteras).
  const K = (W * H) / 640;
  // Lo que da de comer cada bioma (y los ríos suman encima).
  const TIERRA = { llanura: 3, sabana: 2.3, bosque: 1.6, sakura: 2.2, selva: 1.7, pantano: 1.3, taiga: 1.0, tundra: 0.6, colina: 1.5, montana: 0.3, desierto: 0.35, nieve: 0.2, mar: 0, costa: 0 };
  // Los bosques talados dejan otro bioma, y vuelven si se dejan crecer.
  const TALADO = { bosque: 'llanura', selva: 'sabana', taiga: 'tundra', sakura: 'llanura' };
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
  // Ordenar por una clave calculada una vez por elemento (y en el mismo orden): da lo mismo en todos los navegadores.
  // Un comparador con azar dentro, o con restas de varias cosas, depende de cómo ordene cada navegador.
  function ordenarPor(lista, clave) {
    const k = lista.map((x, i) => [clave(x), i, x]);
    k.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    for (let i = 0; i < k.length; i++) lista[i] = k[i][2];
    return lista;
  }
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

  // Un ruido suave sin gastar el azar del mundo (así añadir el cerezal no cambia el resto de la historia).
  function manchaSakura(m, x, y) {
    const h = (a, b) => { let k = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(m.semilla | 0, 362437)) >>> 0; k = Math.imul(k ^ (k >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    const fx = x / 5, fy = y / 5, x0 = Math.floor(fx), y0 = Math.floor(fy), sx = fx - x0, sy = fy - y0;
    const a = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx, b = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
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
      // Bosques de cerezos (sakura): manchas templadas y húmedas, sobre todo junto a las colinas.
      else if (u > 0.5 && t > 0.42 && t < 0.7 && manchaSakura(m, x, y) > 0.66) tipo.push('sakura');
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
