  // ── GÉNESIS · EL PINTOR · El ambiente: agua, humo, nieve, pájaros, nubes, animales y gestos ──

  // ---------- El ambiente: lo que se mueve aunque nadie lo mande ----------
  const azarV = n => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  const tierraEn = (wx, wy) => { const v = m.vida, tx = Math.floor(wx / P), ty = Math.floor(wy / P); return tx >= 0 && ty >= 0 && tx < v.tw && ty < v.th ? tierra[ty * v.tw + tx] : null; };
  // Destellos sobre el agua y espuma en la orilla.
  function agua(ahora, x0, y0, x1, y1) {
    const cuadro = Math.floor(ahora / 140), n = Math.min(260, Math.round((x1 - x0) * (y1 - y0) / 900));
    for (let i = 0; i < n; i++) {
      const wx = x0 + azarV(i * 7919 + cuadro * 31) * (x1 - x0), wy = y0 + azarV(i * 104729 + cuadro * 17) * (y1 - y0);
      const t = tierraEn(wx, wy);
      if (t === 'agua' || t === 'bajo') { g.fillStyle = i % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(170,215,255,0.5)'; g.fillRect(Math.floor(wx), Math.floor(wy), i % 4 ? 1 : 2, 1); }
      else if (t === 'arena' && i % 2) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(Math.floor(wx), Math.floor(wy), 1, 1); }
    }
  }
  // Humo de las chimeneas: unas cuantas casas a la vista echan humo.
  let chimeneas = [], chimeneasHasta = 0;
  let piquetes = [];
  function humo(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    if (ahora > chimeneasHasta) {
      chimeneasHasta = ahora + 1500; chimeneas = []; piquetes = [];
      const v = m.vida, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if (((o === V.OBRA.casa || o === V.OBRA.ayuntamiento) && t % 5 === 0) || o === V.OBRA.campamento) chimeneas.push(t); else if (o === V.OBRA.central || o === V.OBRA.fabrica) { const dc = m.dueno[V.region(m, t)], cc = dc >= 0 ? S.civ(m, dc) : null; if (V.enMarcha(cc, o === V.OBRA.central ? 'central' : 'fabrica')) chimeneas.push(-t - 1); else if (o === V.OBRA.fabrica && cc && cc.huelga) piquetes.push(t); } if (chimeneas.length > 60) break; }
    }
    // Fábricas en huelga: una bandera roja que ondea sobre el tejado y un piquete en la puerta.
    for (const t of piquetes) {
      const bx = (t % m.vida.tw) * P, by = Math.floor(t / m.vida.tw) * P, ond = Math.floor(ahora / 300) % 2;
      g.fillStyle = '#3a3a3a'; g.fillRect(bx + 3, by - 8, 1, 10);
      g.fillStyle = '#d82a2a'; g.fillRect(bx + 4, by - 8, 5, 3); g.fillRect(bx + 4 + 5, by - 8 + ond, 1, 2);
      for (const [dx, col] of [[2, '#5a4a7a'], [6, '#7a4a3a'], [10, '#4a5a7a']]) { g.fillStyle = col; g.fillRect(bx + dx, by + P - 4, 2, 3); g.fillStyle = '#e8b890'; g.fillRect(bx + dx, by + P - 6, 2, 2); if ((Math.floor(ahora / 400) + dx) % 2) { g.fillStyle = '#e8b890'; g.fillRect(bx + dx + 1, by + P - 8, 1, 2); } }
    }
    for (const tt of chimeneas) {
      // Las dos chimeneas de la central echan mucho más humo, y más oscuro.
      if (tt < 0) {
        const t = -tt - 1, bx = (t % m.vida.tw) * P, by = Math.floor(t / m.vida.tw) * P;
        for (const [cx, cy] of [[bx + 4, by - 2], [bx + 8, by - 4]]) for (let k = 0; k < 5; k++) {
          const f = ((ahora / 2000 + k / 5 + cx / 13) % 1);
          g.fillStyle = 'rgba(150,150,158,' + (0.6 * (1 - f)).toFixed(2) + ')';
          const r = 1 + f * 3; g.fillRect(Math.round(cx + f * 6 + Math.sin(f * 5) * 1.5 - r / 2), Math.round(cy - f * 14 - r / 2), Math.ceil(r), Math.ceil(r));
        }
        continue;
      }
      const t = tt;
      const x = (t % m.vida.tw) * P + 10, y = Math.floor(t / m.vida.tw) * P + 2;
      for (let k = 0; k < 3; k++) {
        const f = ((ahora / 2400 + k / 3 + (t % 7) / 7) % 1);
        g.fillStyle = 'rgba(210,210,215,' + (0.45 * (1 - f)).toFixed(2) + ')';
        g.fillRect(Math.round(x + Math.sin(f * 6 + t) * 1.5), Math.round(y - 1 - f * 9), f > 0.5 ? 2 : 1, f > 0.5 ? 2 : 1);
      }
    }
  }
  // Nieve que cae sobre las tierras frías.
  function nieve(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    const n = Math.min(220, Math.round((x1 - x0) * (y1 - y0) / 1100));
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < n; i++) {
      const wx = x0 + ((azarV(i * 13) * (x1 - x0) + Math.sin(ahora / 900 + i) * 3) % (x1 - x0)), wy = y0 + ((azarV(i * 29) * (y1 - y0) + ahora / 40 * (0.5 + azarV(i))) % (y1 - y0));
      const t = tierraEn(wx, wy);
      if (t === 'nieve' || t === 'tundra' || (t === 'taiga' && i % 3 === 0)) g.fillRect(Math.floor(wx), Math.floor(wy), 1, 1);
    }
  }
  // Bandadas de pájaros que cruzan el mapa.
  function pajaros(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    for (let f = 0; f < 3; f++) {
      const ancho = ancho_(), alto_ = alto(), vel = 0.012 + f * 0.004;
      const bx = ((ahora * vel + azarV(f * 97) * ancho) % (ancho + 120)) - 60, by = azarV(f * 31 + Math.floor((ahora * vel) / (ancho + 120))) * alto_;
      if (bx < x0 - 20 || bx > x1 + 20 || by < y0 - 20 || by > y1 + 20) continue;
      const aleteo = Math.floor(ahora / 180 + f) % 2;
      g.fillStyle = 'rgba(30,30,40,0.75)';
      for (let i = 0; i < 5; i++) {
        const px = Math.round(bx - Math.abs(i - 2) * 4), py = Math.round(by + (i - 2) * 3);
        g.fillRect(px - 1, py - aleteo, 1, 1); g.fillRect(px, py, 1, 1); g.fillRect(px + 1, py - aleteo, 1, 1);
      }
    }
  }
  const ancho_ = () => ancho();
  // Nubes que pasan, con su sombra en el suelo: pixel art blando hecho de círculos, sombreado por abajo.
  const cacheNubes = [];
  function nube(i, sombra) {
    const clave = i * 2 + (sombra ? 1 : 0);
    if (cacheNubes[clave]) return cacheNubes[clave];
    const w = 28 + (i * 7) % 14, h = 12 + (i * 3) % 5, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), bolas = [];
    let s = 977 * (i + 1);
    const r = () => { s = (Math.imul(s ^ (s >>> 13), 1274126177) + 0x9E3779B9) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 6; k++) bolas.push([4 + r() * (w - 8), h * 0.45 + (r() - 0.5) * h * 0.3, 2.5 + r() * h * 0.33]);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let dentro = false, alto = 1;
      for (const [bx, by, br] of bolas) { const d = Math.hypot(xx - bx, (yy - by) * 1.3); if (d < br) { dentro = true; alto = Math.min(alto, (yy - (by - br)) / (2 * br)); } }
      if (!dentro && yy >= h * 0.55 && yy < h * 0.8 && xx > 3 && xx < w - 3) dentro = true, alto = 0.9;
      if (!dentro) continue;
      x.fillStyle = sombra ? '#000' : alto < 0.35 ? '#ffffff' : alto < 0.75 ? '#eef2f7' : '#cdd5e0';
      x.fillRect(xx, yy, 1, 1);
    }
    return (cacheNubes[clave] = c);
  }
  function nubes(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    const W2 = ancho(), H2 = alto();
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < 7; i++) {
      const esc = 3 + azarV(i * 13) * 1.5, img = nube(i % 5), w = img.width * esc, h = img.height * esc;
      const cx = ((azarV(i * 7) * W2 + ahora * (0.004 + azarV(i) * 0.004)) % (W2 + w * 2)) - w, cy = azarV(i * 5) * H2;
      if (cx + w < x0 - 30 || cx > x1 + 60 || cy + h < y0 - 30 || cy > y1 + 60) continue;
      g.globalAlpha = 0.13; g.drawImage(nube(i % 5, true), Math.round(cx + 24), Math.round(cy + 40), w, h);
      g.globalAlpha = 0.72; g.drawImage(img, Math.round(cx), Math.round(cy), w, h);
    }
    g.globalAlpha = 1;
  }
  // Los animales, interpolando su paseo del turno.
  function animales(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    const ig = golpesDelTurno(v);
    const todos = caidos.length ? (v.animales || []).concat(caidos.filter(x => x.animal && k < x.paso && !(v.animales || []).includes(x.a)).map(x => x.a)) : (v.animales || []);
    for (const b of todos) {
      const br = rVisto.get(b) || b.r;
      let px = b.x * P + 6, py = b.y * P + 8;
      if (br && br.length >= 4) { const i = paso * 2, j = Math.min(br.length - 2, i + 2); px = (br[i] + (br[j] - br[i]) * f) * P + 6; py = (br[i + 1] + (br[j + 1] - br[i + 1]) * f) * P + 8; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // También los animales: retroceden y se ponen rojos al recibir un mordisco o una lanzada; el lobo embiste.
      const recibe = golpeActivo(ig.golpes.get(b.id), k), pega = golpeActivo(ig.ataques.get(b.id), k);
      if (recibe) { const [gp, d] = recibe, emp = Math.round(2.5 * (1 - d)); px += Math.sign(b.x - gp[2]) * emp; py -= d < 0.5 ? 1 : 0; }
      if (pega) { const [at, d] = pega, emb = 2.2 * Math.sin(Math.PI * Math.min(1, d * 1.25)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
      px = Math.round(px); py = Math.round(py);
      if (recibe && b.tipo !== 'pez') { const d = recibe[1]; g.globalAlpha = d < 0.45 ? 0.9 : 0.5; g.fillStyle = d < 0.45 ? '#ff2a2a' : '#ffffff'; g.fillRect(px - 1, py - 1, 6, 4); g.globalAlpha = 1; g.fillStyle = '#b01818'; g.fillRect(Math.round(px + 2 + 3 * d), Math.round(py - 2 + 6 * d * d), 1, 1); }
      const pata = Math.floor(ahora / 220 + b.id) % 2;
      if (b.tipo === 'pez') {
        const fase = (ahora / 2600 + b.id * 0.37) % 1;
        if (fase < 0.14) { const s2 = fase / 0.14; g.fillStyle = '#d8e4ee'; g.fillRect(px + Math.round(s2 * 4), py - Math.round(Math.sin(s2 * Math.PI) * 5), 2, 1); }
        else if (fase < 0.22) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px + 3, py, 3, 1); g.fillRect(px + 4, py - 1, 1, 1); }
        continue;
      }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px - 1, py + 3, b.tipo === 'vaca' ? 6 : 5, 1);
      if (b.tipo === 'oveja') {
        g.fillStyle = '#3a3030'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 2, py + 2, 1, 2 - pata);
        g.fillStyle = '#f4f2ea'; g.fillRect(px - 1, py, 4, 2); g.fillStyle = '#3a3030'; g.fillRect(px + 3, py, 1, 1);
      } else if (b.tipo === 'vaca') {
        g.fillStyle = '#3a3030'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 3, py + 2, 1, 2 - pata);
        g.fillStyle = '#f4f2ea'; g.fillRect(px - 1, py, 5, 2); g.fillStyle = '#6b4a2b'; g.fillRect(px, py, 2, 1); g.fillStyle = '#d9a090'; g.fillRect(px + 4, py, 1, 1);
      } else if (b.tipo === 'lobo') {
        // Lobo gris, más bajo y alargado, con orejas de punta y cola caída.
        g.fillStyle = '#3a3a40'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 3, py + 2, 1, 2 - pata);
        g.fillStyle = '#7a7a84'; g.fillRect(px - 1, py, 5, 2); g.fillRect(px + 4, py - 1, 2, 2);
        g.fillStyle = '#4a4a52'; g.fillRect(px + 4, py - 2, 1, 1); g.fillRect(px - 2, py + 1, 1, 2);
        g.fillStyle = '#e8d070'; g.fillRect(px + 5, py - 1, 1, 1);
      } else if (b.tipo === 'ciervo') {
        g.fillStyle = '#5a3a22'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 2, py + 2, 1, 2 - pata);
        g.fillStyle = '#9a6a3a'; g.fillRect(px - 1, py, 4, 2); g.fillRect(px + 3, py - 1, 1, 1);
        g.fillStyle = '#d8c8a0'; g.fillRect(px + 3, py - 3, 1, 2); g.fillRect(px + 4, py - 3, 1, 1);
      }
    }
  }


  // Lo que se investiga y la subida de edad, con su barra sobre el edificio (o la plaza), como en Age of Empires.
  function progresos(x0, y0, x1, y1) {
    const v = m.vida;
    for (const c of S.vivas(m)) {
      const barras = [];
      const inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
      if (inv) {
        const obraL = { saber: V.OBRA.saber, molino: V.OBRA.molino, templo: V.OBRA.templo, cuartel: V.OBRA.cuartel, puerto: V.OBRA.puerto }[inv.lugar];
        let t = null;
        if (obraL) for (const r of [c.capital, ...S.vecinos(c.capital)]) { for (const x of V.parcelas(m, r)) if (visto.obra[x] === obraL) { t = x; break; } if (t != null) break; }
        if (t == null) t = V.plaza(m, c.capital)[0];
        barras.push([t, Math.min(1, c.investigacion.puntos / M.costeTec(inv)), '#7ab8ff']);
      }
      if (c.subiendo) barras.push([V.plaza(m, c.capital)[1], (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde), '#ffd76a']);
      for (const [t, f, col] of barras) {
        const x = (t % v.tw) * P + 1, y = Math.floor(t / v.tw) * P - 4;
        if (x + 16 < x0 || y + 6 < y0 || x > x1 || y > y1) continue;
        g.fillStyle = 'rgba(10,12,20,0.75)'; g.fillRect(x - 0.5, y - 0.5, 15, 3);
        g.fillStyle = col; g.fillRect(x, y, Math.max(1, 14 * Math.max(0, Math.min(1, f))), 2);
      }
    }
  }

  // ---------- Gestos: charlas, risas, saludos, amores, discusiones, juegos, bailes, gritos de guerra ----------
  // Los que están quietos cerca de otro de su pueblo hablan entre ellos, como en WorldBox. Cada pareja tiene su
  // «conversación» unos segundos (según quiénes son y la hora), con un bocadillo y algún gesto con la mano.
  function bocadillo(x, y, dibujo, borde) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 0.5, y + 0.5, 9, 6);
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y, 9, 6); g.fillRect(x, y - 0.5, 7, 7); g.fillRect(x + 1, y + 6, 2, 1); g.fillRect(x + 1, y + 7, 1, 1);
    if (borde) { g.fillStyle = borde; g.fillRect(x - 1, y, 9, 0.5); }
    dibujo(x, y);
  }
  const DIBUJOS = {
    charla: (x, y) => { g.fillStyle = '#3a3a44'; g.fillRect(x + 1, y + 3, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + 5, y + 3, 1, 1); },
    risa: (x, y) => { g.fillStyle = '#c8682a'; g.fillRect(x + 1, y + 1, 1, 3); g.fillRect(x + 2, y + 3, 1, 1); g.fillRect(x + 4, y + 2, 2, 1); g.fillRect(x + 4, y + 3, 1, 1); g.fillRect(x + 5, y + 3, 1, 1); },
    amor: (x, y) => { g.fillStyle = '#e8304a'; g.fillRect(x + 1, y + 1, 2, 2); g.fillRect(x + 4, y + 1, 2, 2); g.fillRect(x + 1, y + 2, 5, 2); g.fillRect(x + 2, y + 4, 3, 1); g.fillRect(x + 3, y + 5, 1, 1); },
    moneda: (x, y) => { g.fillStyle = '#e0b030'; g.fillRect(x + 2, y + 1, 3, 5); g.fillRect(x + 1, y + 2, 5, 3); g.fillStyle = '#fff4a0'; g.fillRect(x + 3, y + 2, 1, 2); },
    enfado: (x, y) => { g.fillStyle = '#d02a2a'; g.fillRect(x + 3, y + 1, 1, 3); g.fillRect(x + 3, y + 5, 1, 1); g.fillRect(x + 5, y + 1, 1, 3); g.fillRect(x + 5, y + 5, 1, 1); },
    nota: (x, y) => { g.fillStyle = '#2a2a3a'; g.fillRect(x + 4, y + 1, 1, 4); g.fillRect(x + 5, y + 1, 1, 1); g.fillRect(x + 6, y + 2, 1, 1); g.fillRect(x + 2, y + 4, 2, 2); },
    idea: (x, y) => { g.fillStyle = '#ffd23a'; g.fillRect(x + 2, y + 1, 3, 3); g.fillRect(x + 1, y + 2, 5, 1); g.fillStyle = '#8a8a8a'; g.fillRect(x + 3, y + 4, 1, 2); },
    libro: (x, y) => { g.fillStyle = '#7a2a1a'; g.fillRect(x + 1, y + 2, 5, 3); g.fillStyle = '#f0e8d0'; g.fillRect(x + 1, y + 2, 2, 2); g.fillRect(x + 4, y + 2, 2, 2); },
    triste: (x, y) => { g.fillStyle = '#5a7aba'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 2, y + 4, 3, 1); g.fillRect(x + 1, y + 5, 1, 1); g.fillRect(x + 5, y + 5, 1, 1); },
    grito: (x, y) => { g.fillStyle = '#d02a2a'; g.fillRect(x + 3, y + 1, 1, 3); g.fillRect(x + 3, y + 5, 1, 1); },
    pregunta: (x, y) => { g.fillStyle = '#3a5a9a'; g.fillRect(x + 2, y + 1, 3, 1); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + 3, y + 5, 1, 1); }
  };
  function gestos(k, ahora) {
    if (cam.z < 1.6) return; // de lejos no se distinguen
    const slot = Math.floor(ahora / 4200), dentro = (ahora % 4200) / 4200;
    const usado = new Set(), cubo = new Map();
    for (const q of quietos) { const key = Math.floor(q.px / 14) + ',' + Math.floor(q.py / 14); (cubo.get(key) || cubo.set(key, []).get(key)).push(q); }
    let n = 0;
    for (const q of quietos) {
      if (usado.has(q) || n > Math.round(6 + cam.z * 2)) continue;
      // Los eruditos que estudian piensan solos: una bombilla o un libro.
      if (q.piensa) { if (hash(q.a.id * 7 + slot) < 0.35 && dentro < 0.6) { bocadillo(q.px + 2, q.py - 9, hash(q.a.id + slot) < 0.5 ? DIBUJOS.idea : DIBUJOS.libro); n++; } continue; }
      // Con hambre, alguno se lamenta solo.
      if (q.hambre && hash(q.a.id * 3 + slot) < 0.15 && dentro < 0.5) { bocadillo(q.px + 2, q.py - 9, DIBUJOS.triste); usado.add(q); n++; continue; }
      const cx = Math.floor(q.px / 14), cy = Math.floor(q.py / 14);
      let otro = null;
      for (let dy = -1; dy <= 1 && !otro; dy++) for (let dx = -1; dx <= 1 && !otro; dx++) for (const o of cubo.get((cx + dx) + ',' + (cy + dy)) || []) if (o !== q && !usado.has(o) && !o.piensa && o.a.c === q.a.c && Math.abs(o.px - q.px) + Math.abs(o.py - q.py) <= 22) { otro = o; break; }
      if (!otro) continue;
      usado.add(q); usado.add(otro);
      const par = Math.min(q.a.id, otro.a.id) * 31 + Math.max(q.a.id, otro.a.id), h = hash(par + slot * 7);
      if (h > 0.5 || dentro > 0.8) continue; // no todos hablan todo el rato
      n++;
      // Los niños juegan a la pelota.
      if (q.nino && otro.nino) {
        const f = (ahora / 500) % 2, ida = f < 1 ? f : 2 - f, bx = q.px + 1.5 + (otro.px - q.px) * ida, by = q.py + 4 + (otro.py - q.py) * ida - Math.sin(ida * Math.PI) * 4;
        g.fillStyle = '#e04030'; g.fillRect(bx, by, 1.5, 1.5); g.fillStyle = '#ffffff'; g.fillRect(bx, by, 0.6, 0.6);
        continue;
      }
      // Qué se dicen: según quiénes son y cómo va su pueblo.
      const comerciante = q.oficio === 'comerciante' || otro.oficio === 'comerciante';
      const tipo = q.fiesta ? 'nota' : comerciante && h < 0.25 ? 'moneda' : h < 0.06 && !q.nino && !otro.nino ? 'amor' : h < 0.14 ? 'enfado' : h < 0.28 ? 'risa' : h < 0.36 ? 'pregunta' : h < 0.46 ? 'saludo' : 'charla';
      const habla = Math.floor(ahora / 1100 + par) % 2 ? q : otro, escucha = habla === q ? otro : q;
      if (tipo === 'saludo') {
        // Se saludan con la mano: el brazo sube y baja.
        for (const w of [q, otro]) { const arriba = Math.floor(ahora / 180 + w.a.id) % 2; g.fillStyle = '#e8b890'; g.fillRect(w.px + 3.5, w.py + (arriba ? -0.5 : 0.5), 1, 1); g.fillRect(w.px + 3, w.py + 1, 1, 1); }
        continue;
      }
      bocadillo(habla.px + 2, habla.py - 9, DIBUJOS[tipo], tipo === 'enfado' ? '#d02a2a' : null);
      // El que habla gesticula (brazo arriba); el que escucha asiente.
      g.fillStyle = '#e8b890';
      if (Math.floor(ahora / 220) % 2) g.fillRect(habla.px + 3.5, habla.py, 1, 1);
      if (tipo === 'amor' && Math.random() < 0.02) emitir(escucha.px + 1.5, escucha.py - 2, 1, { v: 3, g: -10, vida: 1200, cols: ['#e8304a', '#ff8aa0'], tipo: 'chispa', tam: 1 });
      if (tipo === 'nota' && Math.random() < 0.04) emitir(habla.px + 3, habla.py - 3, 1, { v: 6, g: -12, vida: 1100, cols: ['#2a2a3a', '#4a4a6a'], tipo: 'chispa', tam: 1 });
    }
    // Los que cargan en la batalla gritan.
    for (const w of gritos) { if (n > 60) break; if (hash(w.a.id + slot * 13) < 0.25 && dentro < 0.45) { bocadillo(w.px + 2, w.py - 9, DIBUJOS.grito, '#d02a2a'); n++; } }
  }
