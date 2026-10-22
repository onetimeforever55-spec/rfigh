  // ── GÉNESIS · EL PINTOR · Golpes, figuras, estaciones, andamios, corrales, murallas, trincheras, vías y tráfico ──

  // Los aldeanos: 3×5 píxeles, con el color de su pueblo y la herramienta de su oficio.
  // ---------- Golpes como en WorldBox: destello rojo y blanco, retroceso, embestida, sangre y barra de vida ----------
  const DURA_GOLPE = 0.55; // en pasos
  let indiceGolpes = { de: null, golpes: new Map(), ataques: new Map() };
  function golpesDelTurno(v) {
    if (indiceGolpes.de === v.golpes) return indiceGolpes;
    const golpes = new Map(), ataques = new Map();
    for (const gp of v.golpes || []) (golpes.get(gp[0]) || golpes.set(gp[0], []).get(gp[0])).push(gp);
    for (const at of v.ataques || []) (ataques.get(at[0]) || ataques.set(at[0], []).get(at[0])).push(at);
    return (indiceGolpes = { de: v.golpes, golpes, ataques });
  }
  // El golpe más reciente que se está viendo ahora (o null), y cuánto va de él (0 a 1).
  function golpeActivo(lista, k) {
    if (!lista) return null;
    for (let i = lista.length - 1; i >= 0; i--) { const d = (k - (lista[i][1] - 0.5)) / DURA_GOLPE; if (d >= 0 && d < 1) return [lista[i], d]; }
    return null;
  }
  // La silueta del aldeano en un color (para el destello).
  function silueta(px, py, col) {
    g.fillStyle = col;
    g.fillRect(px + 1, py, 1, 1); g.fillRect(px, py + 1, 3, 2); g.fillRect(px, py + 3, 1, 2); g.fillRect(px + 2, py + 3, 1, 2);
  }

  const ultimoOficio = new Map(), cambioVisto = new Map(), ultimaDir = new Map(), humoTiro = new Set();
  let quietos = [], gritos = [];
  // El dibujo de un aldeano (también para su caída).
  function figura(a, col, paso, alto, carga, corre) {
    const oficio = V.OFICIOS[a.o], nino = (a.edad || 0) < V.ADULTO;
    return ARTE().aldeano({
      col, oficio: nino ? 'nino' : oficio, edad: nino ? 'nino' : (a.edad || 0) >= V.VIEJO ? 'viejo' : 'adulto',
      paso: paso || 0, corre: !!corre, alto: alto || 0, carga: carga || 0,
      arma: oficio === 'guerrero' ? a.arma || 0 : 0, tirador: oficio === 'guerrero' && !!a.tirador, armadura: oficio === 'guerrero' ? a.armadura || 0 : 0,
      piel: (a.c + (a.id % 6 === 0 ? 1 : 0)) % 4, pelo: a.id % 4,
      sabio: oficio === 'erudito' ? M.ERUDITO((S.civ(m, a.c) || { era: 0 }).era).tipo : undefined,
      // Mercaderes con gremio, banqueros y empresarios con su traje: casaca y sombrero; desde la Revolución Industrial, chistera.
      // (El comerciante de siempre lleva su gorro; el mercader con gremio, el banquero y el empresario, su traje.)
      traje: nino || (!a.emp && !a.merc) ? 0 : ((S.civ(m, a.c) || { era: 0 }).era >= 6 ? 2 : 1)
    });
  }
  const durmiendo = new Set();
  function sueno(ahora, x0, y0, x1, y1) {
    if (!durmiendo.size) return;
    const v = m.vida;
    g.font = 'bold 5px monospace'; g.textAlign = 'left';
    for (const t of durmiendo) {
      const x = (t % v.tw) * P + 10, y = Math.floor(t / v.tw) * P - 1;
      if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      const f = ((ahora / 1600) + (t % 7) / 7) % 1;
      g.fillStyle = 'rgba(220,230,255,' + (0.9 * (1 - f)).toFixed(2) + ')';
      g.fillText('z', x + f * 3, y - f * 6); if (f > 0.4) g.fillText('Z', x + 2 + f * 3, y - 3 - f * 6);
    }
  }
  // Las estaciones: el otoño dora el campo, el invierno lo blanquea y nieva en todo el reino.
  let estVista = { e: null, antes: null, desde: 0 };
  function estaciones(ahora, x0, y0, x1, y1) {
    const e = m.vida.estacion;
    if (e == null || e < 0) return;
    // La estación cambia poco a poco (unos segundos de fundido), no de golpe al empezar el turno.
    if (e !== estVista.e) { estVista = { e, antes: estVista.e, desde: ahora }; }
    const fun = estVista.antes == null ? 1 : Math.min(1, (ahora - estVista.desde) / 6000);
    const cols = [[150, 230, 120, 0.05], null, [230, 140, 40, 0.11], [235, 242, 255, 0.22]];
    const capa = (c, a) => { if (c && a > 0.003) { g.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] * a).toFixed(3) + ')'; g.fillRect(x0, y0, x1 - x0, y1 - y0); } };
    if (fun < 1 && estVista.antes != null) capa(cols[estVista.antes], 1 - fun);
    capa(cols[e], fun);
    const nieva = e === 3 ? fun : estVista.antes === 3 ? 1 - fun : 0;
    if (nieva <= 0.02 || reducido) return;
    const n = Math.min(260, Math.round((x1 - x0) * (y1 - y0) / 900 * nieva));
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < n; i++) {
      const wx = x0 + ((azarV(i * 17) * (x1 - x0) + Math.sin(ahora / 800 + i) * 4) % (x1 - x0)), wy = y0 + ((azarV(i * 31) * (y1 - y0) + ahora / 45 * (0.5 + azarV(i + 3))) % (y1 - y0));
      g.fillRect(Math.floor(wx), Math.floor(wy), i % 4 ? 1 : 2, 1);
    }
  }
  // Las obras a medias: cimientos, postes y tablones; el edificio va asomando según avanza.
  function andamios(ahora, x0, y0, x1, y1) {
    const v = m.vida, an = v.andamios;
    if (!an) return;
    for (const k of Object.keys(an)) {
      const t = +k, x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      if (x + P < x0 || y + P < y0 || x > x1 || y > y1) continue;
      const o = an[k], f = 1 - Math.max(0, o.falta) / o.total, alto_ = Math.round(2 + f * 10);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 1, y + 14, 14, 2);
      g.fillStyle = '#8a8478'; g.fillRect(x + 2, y + 13, 12, 2);
      g.fillStyle = f < 0.5 ? '#b08a5a' : '#c8b494'; g.fillRect(x + 3, y + 13 - alto_, 10, alto_);
      if (f >= 0.5) { g.fillStyle = '#6a4a32'; g.fillRect(x + 6, y + 10, 3, 3); }
      g.fillStyle = '#7a5530';
      for (const px of [1, 7, 14]) g.fillRect(x + px, y + 1, 1, 13);
      for (const py of [4, 8, 12]) g.fillRect(x + 1, y + py, 14, 1);
      g.fillStyle = '#5a3c20'; g.fillRect(x + 1, y + 4, 1, 1); g.fillRect(x + 14, y + 8, 1, 1);
      if (Math.floor(ahora / 500 + t) % 9 === 0) emitir(x + 8, y + 12, 2, { v: 12, g: 40, vida: 500, cols: ['#c8b494', '#a89474'], tipo: 'solido', tam: 0.8, dy: -8, suelo: 1 });
      g.fillStyle = 'rgba(10,12,20,0.75)'; g.fillRect(x + 0.5, y - 4.5, 15, 3);
      g.fillStyle = '#ffb04a'; g.fillRect(x + 1, y - 4, Math.max(1, 14 * f), 2);
    }
  }
  const civPorId = new Map(), rutaPorId = new Map();
  // Los corrales: tierra pisada dentro y una cerca de postes y dos travesaños alrededor, con su portillo.
  function corrales(x0, y0, x1, y1) {
    const v = m.vida; if (!v.corrales || !v.corralT) return;
    const tw = v.tw;
    for (const k of v.corrales) {
      const t0 = k.tiles[0], tN = k.tiles[k.tiles.length - 1];
      const ax = (t0 % tw) * P, ay = Math.floor(t0 / tw) * P, bx = (tN % tw + 1) * P, by = (Math.floor(tN / tw) + 1) * P;
      if (bx < x0 || by < y0 || ax > x1 || ay > y1) continue;
      // Tierra pisada, a manchas.
      for (const t of k.tiles) { const x = (t % tw) * P, y = Math.floor(t / tw) * P, h = (Math.imul(t, 2654435761) >>> 0); g.fillStyle = 'rgba(120,92,56,0.32)'; g.fillRect(x + (h % 5), y + ((h >> 3) % 6), 9, 7); g.fillStyle = 'rgba(96,74,44,0.25)'; g.fillRect(x + 8 - (h >> 5) % 5, y + 7 + (h >> 7) % 4, 6, 5); }
      // La cerca: postes cada 4 píxeles y dos travesaños; el portillo, abierto en el lado de abajo.
      const cx = (ax + bx) / 2;
      const travesano = (x, y, w, h) => { g.fillStyle = '#6b4a28'; g.fillRect(x, y, w, h); };
      for (const y of [ay + 1, by - 2]) { travesano(ax, y, bx - ax, 1); travesano(ax, y + 1.2, bx - ax, 0.6); }
      for (const x of [ax + 1, bx - 2]) { travesano(x, ay, 1, by - ay); }
      g.fillStyle = '#4a3218';
      for (let x = ax; x <= bx - 1; x += 4) { g.fillRect(x, ay - 1, 1.2, 3.5); if (Math.abs(x - cx) > 3) g.fillRect(x, by - 3, 1.2, 3.5); }
      for (let y = ay; y <= by - 1; y += 4) { g.fillRect(ax, y, 1.2, 3); g.fillRect(bx - 1.2, y, 1.2, 3); }
      g.fillStyle = '#8a6438'; g.fillRect(cx - 3, by - 2, 1, 2); g.fillRect(cx + 2, by - 2, 1, 2);
    }
  }
  // Las murallas: empalizada de troncos afilados (primeras edades) o muralla de piedra con almenas; puertas de madera donde
  // la cruza un camino; con grietas y huecos si está dañada.
  function murallas(x0, y0, x1, y1) {
    const v = m.vida, W = v.muro; if (!W) return;
    const tw = v.tw, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = ty * tw + tx; if (!(W[t] > 0)) continue;
      const x = tx * P, y = ty * P, c = civPorId.get(m.dueno[V.region(m, t)]), era = c ? c.era : 1, piedra = era > 1, max = V.muroVida(c || { era: 1 }), roto = W[t] / max;
      const con = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const n = t + dx + dy * tw; return tx + dx >= 0 && tx + dx < tw && n >= 0 && n < W.length && W[n] > 0; });
      const horiz = con.some(([dx]) => dx) || !con.length, vert = con.some(([, dy]) => dy);
      const puerta = v.puerta && v.puerta[t];
      if (!piedra) {
        // Empalizada: troncos verticales con la punta afilada, en fila por donde sigue la cerca.
        const tronco = (px, py, h) => { g.fillStyle = '#7a5530'; g.fillRect(px, py + 1.5, 2.4, h - 1.5); g.fillStyle = '#9a7040'; g.fillRect(px + 0.4, py + 2, 0.8, h - 3); g.fillStyle = '#5a3c1e'; g.fillRect(px + 0.6, py, 1.2, 1.6); };
        if (horiz) { for (const [dx] of con.filter(([dx]) => dx).length ? con.filter(([dx]) => dx) : [[1, 0], [-1, 0]]) for (let q = dx > 0 ? 8 : 0; q < (dx > 0 ? 16 : 8); q += 2.6) tronco(x + q, y + 3, 10); }
        if (vert) { for (const [, dy] of con.filter(([, dy]) => dy)) for (let q = dy > 0 ? 8 : 0; q < (dy > 0 ? 16 : 8); q += 3) { g.fillStyle = '#7a5530'; g.fillRect(x + 6, y + q, 4, 2.6); g.fillStyle = '#5a3c1e'; g.fillRect(x + 6, y + q + 2.2, 4, 0.5); } }
        g.fillStyle = '#5a3c1e'; g.fillRect(x + 5.5, y + 2, 5, 3); // el poste grueso del cruce
      } else {
        // Muralla de piedra: un lienzo gris con hiladas, almenas arriba y sombra abajo.
        const tramo = (dx, dy) => {
          const rx = x + (dx > 0 ? 8 : dx < 0 ? 0 : 4), ry = y + (dy > 0 ? 8 : dy < 0 ? 0 : 3), rw = dx ? 8 : 8, rh = dy ? 8 : 9;
          g.fillStyle = '#8e8a84'; g.fillRect(rx, ry, rw, rh);
          g.fillStyle = '#a6a29a'; g.fillRect(rx, ry, rw, 1.2);
          g.fillStyle = '#6e6a64'; for (let q = 3; q < rh; q += 3) g.fillRect(rx, ry + q, rw, 0.5);
        };
        for (const [dx, dy] of con.length ? con : [[1, 0], [-1, 0]]) tramo(dx, dy);
        g.fillStyle = '#8e8a84'; g.fillRect(x + 4, y + 3, 8, 9);
        g.fillStyle = '#a6a29a'; for (let q = 0; q < 16; q += 4) if (horiz) g.fillRect(x + q, y + 1.5, 2.2, 1.8); // almenas
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + (vert && !horiz ? 12 : 0), y + 12, vert && !horiz ? 1.5 : 16, vert && !horiz ? 4 : 1.5);
      }
      if (puerta) {
        // La puerta: dos hojas de madera con herrajes bajo un arco.
        g.fillStyle = piedra ? '#5a5650' : '#4a3218'; g.fillRect(x + 4, y + 3, 8, 10);
        g.fillStyle = '#7a5a34'; g.fillRect(x + 5, y + 5, 2.8, 8); g.fillRect(x + 8.2, y + 5, 2.8, 8);
        g.fillStyle = '#3a2a1a'; g.fillRect(x + 5, y + 7, 6, 0.6); g.fillRect(x + 5, y + 10.5, 6, 0.6);
      }
      if (roto < 0.6) {
        // Dañada: grietas, y si está casi caída, un hueco con cascotes.
        g.fillStyle = 'rgba(30,24,20,0.7)'; g.fillRect(x + 6, y + 4, 1, 4); g.fillRect(x + 7, y + 7, 2, 1); g.fillRect(x + 9, y + 8, 1, 3);
        if (roto < 0.3) { g.fillStyle = piedra ? '#77736d' : '#6a4a28'; g.fillRect(x + 5, y + 3, 5, 3); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 4, y + 13, 7, 1.5); }
      }
    }
  }
  // Las trincheras de la Segunda Guerra Mundial: una zanja de tierra oscura que sigue la frontera, con sacos
  // terreros en los bordes y, delante (hacia el rival), postes y alambre de espino.
  function trincheras(x0, y0, x1, y1) {
    const v = m.vida, T = v.trinchera; if (!T) return;
    const tw = v.tw, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = ty * tw + tx; if (!T[t]) continue;
      const x = tx * P, y = ty * P, d = m.dueno[V.region(m, t)];
      const conecta = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const n = t + dx + dy * tw; return tx + dx >= 0 && tx + dx < tw && T[n]; });
      const tramo = (dx, dy) => { // de la mitad de la casilla hacia ese lado
        g.fillStyle = '#3a2a1c'; g.fillRect(x + (dx > 0 ? 6 : dx < 0 ? 0 : 5), y + (dy > 0 ? 6 : dy < 0 ? 0 : 5), dx ? 10 : 6, dy ? 10 : 6);
      };
      g.fillStyle = '#3a2a1c'; g.fillRect(x + 5, y + 5, 6, 6);
      for (const [dx, dy] of conecta) tramo(dx, dy);
      g.fillStyle = '#2a1e14'; g.fillRect(x + 6, y + 6, 4, 4);
      // Sacos terreros alrededor de la zanja.
      g.fillStyle = '#c8b078';
      for (let q = 0; q < 16; q += 3) { if (!conecta.some(([dx, dy]) => dy === -1)) g.fillRect(x + q, y + 3, 2, 1.5); if (!conecta.some(([dx, dy]) => dy === 1)) g.fillRect(x + q, y + 11.5, 2, 1.5); }
      for (let q = 0; q < 16; q += 3) { if (!conecta.some(([dx]) => dx === -1)) g.fillRect(x + 3, y + q, 1.5, 2); if (!conecta.some(([dx]) => dx === 1)) g.fillRect(x + 11.5, y + q, 1.5, 2); }
      // El alambre de espino, del lado del rival.
      if (T[t] === 2) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = t + dx + dy * tw; if (n < 0 || n >= T.length || m.dueno[V.region(m, n)] === d) continue;
          g.fillStyle = '#5a4a3a'; g.strokeStyle = '#9aa0a8'; g.lineWidth = 0.6;
          if (dx) { const xx = x + (dx > 0 ? 15 : 0.5); g.fillRect(xx - 0.5, y + 2, 1, 3); g.fillRect(xx - 0.5, y + 11, 1, 3); g.beginPath(); for (let q = 0; q <= 16; q += 2) g.lineTo(xx + (q % 4 ? 1 : -1), y + q); g.stroke(); }
          else { const yy = y + (dy > 0 ? 15 : 0.5); g.fillRect(x + 2, yy - 2, 1, 3); g.fillRect(x + 12, yy - 2, 1, 3); g.beginPath(); for (let q = 0; q <= 16; q += 2) g.lineTo(x + q, yy + (q % 4 ? 1 : -1)); g.stroke(); }
        }
      }
    }
  }
  // Las vías: su propia línea de estación a estación (no van sobre los caminos, solo los cruzan), con
  // traviesas de madera y dos raíles; en los cruces con una calle, un paso a nivel. Por cada línea va y viene
  // un tren (de vapor en la era industrial, diésel en la moderna) mientras haya carbón y paz.
  function vias(x0, y0, x1, y1, ahora) {
    const v = m.vida, tw = v.tw;
    for (const k of Object.keys(v.vias || {})) {
      const L = v.vias[k], T = L.tiles;
      for (let i = 0; i < T.length; i++) {
        const t = T[i]; if (visto.obra[t] && visto.obra[t] !== V.OBRA.campo) continue;
        const x = (t % tw) * P, y = Math.floor(t / tw) * P;
        if (x + P < x0 || y + P < y0 || x > x1 || y > y1) continue;
        const ant = T[Math.max(0, i - 1)], sig = T[Math.min(T.length - 1, i + 1)];
        const h = n => n !== t && Math.floor(n / tw) === Math.floor(t / tw), w = n => n !== t && n % tw === t % tw;
        const izq = [ant, sig].some(n => h(n) && n < t), der = [ant, sig].some(n => h(n) && n > t), arr = [ant, sig].some(n => w(n) && n < t), aba = [ant, sig].some(n => w(n) && n > t);
        const cruce = visto.camino[t];
        // Traviesas y raíles por cada lado por el que sigue la vía (así las curvas quedan unidas).
        const tramo = (hx, hy, ww, hh, horiz) => {
          g.fillStyle = '#5a3c22';
          if (horiz) for (let q = hx + 1; q < hx + ww; q += 3) g.fillRect(x + q, y + 5, 1.5, 6);
          else for (let q = hy + 1; q < hy + hh; q += 3) g.fillRect(x + 5, y + q, 6, 1.5);
          g.fillStyle = '#a8aeb8';
          if (horiz) { g.fillRect(x + hx, y + 6, ww, 1); g.fillRect(x + hx, y + 9, ww, 1); }
          else { g.fillRect(x + 6, y + hy, 1, hh); g.fillRect(x + 9, y + hy, 1, hh); }
        };
        if (izq) tramo(0, 0, 8, 0, true); if (der) tramo(8, 0, 8, 0, true);
        if (arr) tramo(0, 0, 0, 8, false); if (aba) tramo(0, 8, 0, 8, false);
        if (!izq && !der && !arr && !aba) tramo(0, 0, P, 0, true);
        if (cruce) { g.fillStyle = '#e8e4d8'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 13, y + 13, 1, 1); g.fillStyle = '#d83a32'; g.fillRect(x + 1, y + 1, 1, 2); }
      }
      // El tren de esta línea.
      const ru = rutaPorId.get(L.ru), a = ru ? civPorId.get(ru.a) : null, b = ru ? civPorId.get(ru.b) : null;
      const dueno = a && a.estaciones > 0 && a.era >= 6 ? a : b;
      const activa = ru && a && b && !(a.guerras || []).some(gg => gg.con === b.id);
      if (!dueno || !activa || !V.enMarcha(dueno, 'tren') || T.length < 4) continue;
      trenEnVia(T, ahora, dueno, k);
    }
  }
  // Un tren por su vía: la locomotora delante y dos vagones detrás, cada pieza siguiendo las curvas.
  let ultimosTrenes = [];
  function trenEnVia(T, ahora, c, k) {
    const tw = m.vida.tw, n = T.length - 1, ms = c.era >= 7 ? 160 : 240, vuelta = n * 2 * ms + 3000;
    let h = 0; for (let q = 0; q < k.length; q++) h = (h * 31 + k.charCodeAt(q)) | 0;
    const f = ((ahora + Math.abs(h) % vuelta) % vuelta);
    // Va, espera un poco en la estación y vuelve.
    const ida = f < n * ms, quieto = f >= n * ms && f < n * ms + 1500 || f >= 2 * n * ms + 1500;
    let s = ida ? f / ms : quieto ? (f < n * ms + 1500 ? n : 0) : n - (f - n * ms - 1500) / ms;
    s = Math.max(0, Math.min(n, s));
    const sentido = ida ? 1 : -1, pos = q => { const qq = Math.max(0, Math.min(n, q)), i = Math.floor(qq), j = Math.min(n, i + 1), fr = qq - i; const ax = T[i] % tw, ay = Math.floor(T[i] / tw), bx = T[j] % tw, by = Math.floor(T[j] / tw); return [(ax + (bx - ax) * fr) * P + 8, (ay + (by - ay) * fr) * P + 8, bx - ax, by - ay]; };
    const col = c.color || '#ccc';
    ultimosTrenes.push([k, pos(s)[0], pos(s)[1]]); if (ultimosTrenes.length > 12) ultimosTrenes.shift();
    for (let p = 2; p >= 0; p--) {
      const [x, y, dx, dy] = pos(s - sentido * p * 0.55), horiz = dx !== 0 || dy === 0;
      const w = horiz ? 7 : 4, hh = horiz ? 4 : 7, X = Math.round(x - w / 2), Y = Math.round(y - hh / 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, Y + hh, w, 1);
      if (p === 0) {
        g.fillStyle = c.era >= 7 ? '#c84a3a' : '#2a2e34'; g.fillRect(X, Y, w, hh);
        g.fillStyle = c.era >= 7 ? '#f0d040' : '#c8a040'; if (horiz) g.fillRect(X, Y + hh - 1, w, 0.6); else g.fillRect(X + w - 1, Y, 0.6, hh);
        g.fillStyle = 'rgba(255,240,180,0.9)'; g.fillRect(horiz ? (sentido * (dx || 1) > 0 ? X + w - 0.5 : X - 0.5) : X + 1.5, horiz ? Y + 1.5 : (sentido * dy > 0 ? Y + hh - 0.5 : Y - 0.5), 1, 1);
        if (c.era < 7 && !quieto && Math.random() < 0.3) emitir(X + w / 2, Y - 1, 1, { v: 6, g: -12, vida: 900, cols: ['#d8d8dc', '#b8b8c0', '#ffffff'], tipo: 'humo', tam: 1.4, dy: -10 });
      } else {
        g.fillStyle = p === 1 ? col : mezclar(col, '#000000', 0.25); g.fillRect(X, Y, w, hh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(X, Y, w, 0.6);
      }
    }
  }
  // El tráfico: coches por las calles de las ciudades modernas y coches de caballos en la era industrial.
  let coches = [], cochesTurno = -1;
  function trafico(ahora, x0, y0, x1, y1) {
    const v = m.vida, tw = v.tw;
    if (cochesTurno !== m.turno) {
      cochesTurno = m.turno;
      const porCiv = new Map();
      for (let t = 0; t < tw * v.th; t++) { if (!visto.camino[t]) continue; const d = m.dueno[V.region(m, t)]; const c = d >= 0 ? civPorId.get(d) : null; if (!c || c.era < 6 || (c.nivel || 0) < 3) continue; (porCiv.get(d) || porCiv.set(d, []).get(d)).push(t); }
      const vivos = coches.filter(k => visto.camino[k.t] && porCiv.has(k.civ));
      coches = vivos;
      for (const [d, lista] of porCiv) {
        const quiere = Math.min(14, Math.floor(lista.length / 10)), tiene = coches.filter(k => k.civ === d).length;
        for (let i = tiene; i < quiere; i++) { const t = lista[Math.floor(Math.random() * lista.length)]; coches.push({ civ: d, t, sig: t, desde: ahora, ant: -1, col: ['#c83a3a', '#3a6ac8', '#e8e0d0', '#2a2a2a', '#3a9a5a', '#e0b040'][i % 6] }); }
      }
    }
    for (const k of coches) {
      const c = civPorId.get(k.civ), dur = c && c.era >= 7 ? 700 : 1300;
      if (ahora - k.desde > dur) {
        k.ant = k.t; k.t = k.sig; k.desde = ahora;
        const op = [k.t - 1, k.t + 1, k.t - tw, k.t + tw].filter(n => n >= 0 && n < tw * v.th && visto.camino[n] && n !== k.ant && Math.abs((n % tw) - (k.t % tw)) <= 1);
        k.sig = op.length ? op[Math.floor(Math.random() * op.length)] : k.ant >= 0 ? k.ant : k.t;
      }
      const f = Math.min(1, (ahora - k.desde) / dur), ax = k.t % tw, ay = Math.floor(k.t / tw), bx = k.sig % tw, by = Math.floor(k.sig / tw);
      const x = (ax + (bx - ax) * f) * P + 5, y = (ay + (by - ay) * f) * P + 6 + (bx !== ax ? (bx > ax ? 1 : -1) : 0);
      if (x < x0 - 8 || y < y0 - 8 || x > x1 + 8 || y > y1 + 8) continue;
      const horiz = bx !== ax || by === ay;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 3, horiz ? 6 : 3, 1);
      if (c && c.era >= 7) {
        // Coche: carrocería del color, techo y ventanillas, faros.
        if (horiz) { g.fillStyle = k.col; g.fillRect(x, y, 6, 3); g.fillStyle = '#a8c8e8'; g.fillRect(x + 1.5, y - 1, 3, 1.2); g.fillStyle = '#1a1a1a'; g.fillRect(x + 1, y + 2.6, 1, 0.8); g.fillRect(x + 4, y + 2.6, 1, 0.8); }
        else { g.fillStyle = k.col; g.fillRect(x + 1, y - 2, 3, 6); g.fillStyle = '#a8c8e8'; g.fillRect(x + 1.5, y - 1, 2, 1.5); }
      } else {
        // Coche de caballos: el caballo delante y la caja detrás.
        const dir = bx >= ax ? 1 : -1;
        g.fillStyle = '#7a5030'; g.fillRect(x + (dir > 0 ? 4 : 0), y, 2, 2); g.fillRect(x + (dir > 0 ? 5 : 0), y - 1, 1, 1);
        g.fillStyle = '#2a2a2e'; g.fillRect(x + (dir > 0 ? 0 : 2), y - 1, 4, 3); g.fillStyle = '#c8a040'; g.fillRect(x + (dir > 0 ? 0 : 2), y - 1, 4, 0.6);
      }
    }
  }
  // Cada aldeano lleva su propio compás: va entre medio paso y casi un paso por detrás del reloj del turno (lo que
  // le falta lo saca de su recorrido del turno anterior). Así no llegan todos a la vez a cada casilla ni cambian
  // todos de tarea en el mismo instante al empezar el turno: el pueblo se mueve como gente, no a golpe de tambor.
  // (Los soldados van al compás exacto, para que los golpes y los disparos casen con quien los recibe.)
  const rVisto = new WeakMap(), rAntes = new WeakMap();
  const desfase = a => (a.o === 4 ? 0 : 0.15 + ((a.id * 0.6180339) % 1) * 0.8);
