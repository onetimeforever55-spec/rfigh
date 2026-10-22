  // ── GÉNESIS · EL PINTOR · Los aldeanos y los anuncios ──

  function aldeanos(k, ahora, x0, y0, x1, y1) {
    civPorId.clear(); for (const c of m.civs) civPorId.set(c.id, c);
    rutaPorId.clear(); for (const ru of m.vida.rutas || []) rutaPorId.set(ru.id, ru);
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    const ig = golpesDelTurno(v);
    dibujados.clear(); quietos = []; gritos = []; durmiendo.clear();
    const fiesta = new Set(), hambre = new Set();
    for (const c of S.vivas(m)) { if (c.plan && c.plan.ultimaFiesta != null && m.turno - c.plan.ultimaFiesta <= 1) fiesta.add(c.id); if ((c.comida || 0) < (c.aldeanos || 0) * 0.15) hambre.add(c.id); }
    const vivos = gente || v.aldeanos, todos = caidos.length ? vivos.concat(caidos.filter(x => !x.animal && k < x.paso).map(x => x.a)) : vivos;
    for (const a of todos) {
      if (a.aBordo != null) continue; // va en un transporte: se le ve en cubierta
      let r = rVisto.get(a) || a.r, kk = k - desfase(a);
      if (kk < 0) { const r0 = rAntes.get(a); if (r0 && r0.length >= 6 && r && r0[r0.length - 3] === r[0] && r0[r0.length - 2] === r[1]) { r = r0; kk += V.TICKS; } else kk = 0; }
      const paso = Math.min(V.TICKS - 1, Math.floor(kk)), f = Math.min(1, kk - paso);
      let px, py, acc;
      if (r && r.length >= 6) {
        const i = paso * 3, j = Math.min(r.length - 3, i + 3);
        const ax = r[i], ay = r[i + 1], bx = r[j], by = r[j + 1];
        px = (ax + (bx - ax) * f) * P + 6.5; py = (ay + (by - ay) * f) * P + 6;
        acc = r[j + 2];
        if (j === i) acc = r[i + 2];
      } else { px = a.x * P + 6.5; py = a.y * P + 6; acc = 0; }
      if (siguiendo === a.id) { cam.x = px; cam.y = py; }
      // Quien duerme y ya llegó a casa no se ve: solo sale el «zZ» sobre el tejado.
      if (a.dormir && a.casa != null && Math.floor((py - 6) / P) * v.tw + Math.floor((px - 6.5) / P) === a.casa) { durmiendo.add(a.casa); continue; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // Recibe un golpe: sale despedido un par de píxeles lejos de quien le pega. Pega: embiste hacia el otro.
      const recibe = golpeActivo(ig.golpes.get(a.id), k), pega = golpeActivo(ig.ataques.get(a.id), k);
      // Retroceso al recibir (sale despedido y vuelve frenando) y embestida al pegar: curvas suaves, no saltos.
      if (recibe) { const [gp, d] = recibe, emp = 2.5 * (1 - d) * (1 - d); px += Math.sign(a.x - gp[2]) * emp; py += Math.sign(a.y - gp[3]) * emp - Math.sin(Math.PI * Math.min(1, d * 2)); }
      if (pega) { const [at, d] = pega, emb = 2.2 * Math.sin(Math.PI * Math.min(1, d * 1.25)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
      // A medio píxel (un píxel del dibujo): el movimiento es continuo y no va a saltos de casilla.
      px = Math.round(px * 2) / 2; py = Math.round(py * 2) / 2;
      dibujados.set(a.id, [px, py]);
      // Modo tropas: un aro verde bajo cada soldado elegido.
      if (tropas && tropas.sel.has(a.id)) { g.strokeStyle = '#6dff7a'; g.lineWidth = 1; g.beginPath(); g.ellipse(px + 1.5, py + 5.5, 4.5, 2, 0, 0, Math.PI * 2); g.stroke(); }
      if (elegido === a.id) { const f2 = Math.floor(performance.now() / 300) % 2; g.fillStyle = '#ffd23a'; g.fillRect(px, py - 6 - f2, 3, 1); g.fillRect(px + 1, py - 5 - f2, 1, 1); g.strokeStyle = 'rgba(255,210,58,0.8)'; g.lineWidth = 0.6; g.strokeRect(px - 2.5, py - 2, 8, 8.5); }
      const anda = r && r.length >= 6 && (r[paso * 3] !== r[Math.min(r.length - 3, paso * 3 + 3)] || r[paso * 3 + 1] !== r[Math.min(r.length - 3, paso * 3 + 3) + 1]);
      const t = Math.floor(ahora / 150 + a.id) % 2;
      // En el agua (sin puente) no se camina: se nada, con la cabeza fuera y ondas alrededor.
      const tAhora = Math.floor((py + 4) / P) * v.tw + Math.floor((px + 1) / P), ta = tierra[tAhora];
      if (((ta === 'agua' || ta === 'bajo' || ta === 'rio') && !(visto.camino && visto.camino[tAhora])) || (v.inundado && v.inundado[tAhora])) {
        const brazo = Math.floor(ahora / 260 + a.id) % 2;
        if (Math.random() < 0.035) emitir(px + 1.5, py + 4, 3, { v: 10, g: 60, vida: 450, cols: ['#e8f4ff', '#a8d0f0', '#ffffff'], tipo: 'solido', tam: 0.7, dy: -14, suelo: 1 });
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(px - 2 - brazo, py + 4, 7 + brazo * 2, 1); g.fillRect(px - 1, py + 5, 5, 1);
        g.fillStyle = color[a.c] || '#cccccc'; g.fillRect(px, py + 3, 3, 1);
        g.fillStyle = '#f0c8a0'; g.fillRect(px + 1, py + 2, 1, 1); g.fillRect(brazo ? px - 1 : px + 3, py + 3 - brazo, 1, 1);
        continue;
      }
      // Tanques y cañones: el vehículo mira hacia donde va (o hacia el enemigo al que dispara).
      if (a.veh) {
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dir = r && r.length >= 6 && r[j] !== r[i] ? Math.sign(r[j] - r[i]) : pega ? Math.sign(pega[0][2]) || 1 : (ultimaDir.get(a.id) || 1);
        ultimaDir.set(a.id, dir);
        // A buen tamaño: un tanque ocupa casi una parcela; un cañón, más que un soldado.
        const img = ARTE().vehiculo(a.veh, color[a.c] || '#cccccc', anda && t ? 1 : 0), EV = a.veh === 'tanque' ? 1 : a.veh === 'artilleria' ? 0.95 : 0.85;
        const w = img.width * EV, h = img.height * EV, vx = px + 1.5 - w / 2, vy = py + 6 - h;
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(vx + 1, py + 5.5, w - 2, 1);
        g.save(); if (dir < 0) { g.translate(vx * 2 + w, 0); g.scale(-1, 1); }
        g.drawImage(img, vx, vy, w, h);
        if (recibe) { g.globalAlpha = recibe[1] < 0.45 ? 0.85 : 0.4; g.drawImage(ARTE().tenido(img, recibe[1] < 0.45 ? '#ff2a2a' : '#ffffff'), vx, vy, w, h); g.globalAlpha = 1; }
        g.restore();
        if (acc === 2) { const fx = dir > 0 ? vx + w : vx - 2; g.fillStyle = Math.floor(ahora / 80) % 2 ? '#fff6a0' : '#ff9a3a'; g.fillRect(fx, vy + (a.veh === 'tanque' ? 1 : 1.5), 2, 1.5); g.fillStyle = 'rgba(200,200,200,0.5)'; g.fillRect(fx - dir, vy - 1, 2, 1); }
        const ej = m.vida.ejercitos && m.vida.ejercitos[a.c];
        if (ej && ej.capitan === a.id) { g.fillStyle = '#2a1e14'; g.fillRect(px - 1, py - 8, 1, 10); g.fillStyle = color[a.c] || '#ccc'; g.fillRect(px, py - 8, 6, 4); }
        if (a.pv0 != null) {
          const max = V.vidaMax(a); let pv = a.pv0;
          for (const gp of ig.golpes.get(a.id) || []) if (k >= gp[1] - 0.5) pv -= gp[4];
          if (pv < max) { const fr = Math.max(0, pv / max); g.fillStyle = 'rgba(40,10,10,0.75)'; g.fillRect(vx, vy - 2, w, 1); g.fillStyle = fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030'; g.fillRect(vx, vy - 2, Math.max(1, w * fr), 1); }
        }
        continue;
      }
      // El aldeano: un dibujo de 12×14 con contorno (arte.js), según su oficio, edad, equipo y lo que hace.
      const oficio = V.OFICIOS[a.o], nino = (a.edad || 0) < V.ADULTO;
      // El ciclo de andar va con lo que avanza (cuatro tiempos por casilla, más deprisa si corre por el camino),
      // el trabajo sube y baja la herramienta en tres tiempos, y el golpe cuerpo a cuerpo es alzar, bajar y golpear.
      let fase = 0, corre = false, sube = 0;
      if (anda && r) {
        const i0 = paso * 3, j0 = Math.min(r.length - 3, i0 + 3), tramo = Math.abs(r[j0] - r[i0]) + Math.abs(r[j0 + 1] - r[i0 + 1]);
        corre = oficio === 'guerrero' && (tramo >= 2 || (acc === 2 && !a.tirador));
        fase = 1 + (Math.floor((paso + f) * 4 * Math.max(1, tramo)) + (a.id & 3)) % 4;
        if (fase === 2 || fase === 4) sube = corre ? 1 : 0.5;
      }
      const alto = pega && oficio === 'guerrero' && !a.tirador ? (pega[1] < 0.35 ? -1 : pega[1] < 0.6 ? 0 : 1)
        : acc === 1 || acc === 2 ? [-1, 0, 1, 0][Math.floor(ahora / 210 + a.id) % 4] : 0;
      // Mira hacia donde va (o hacia quien golpea).
      let mira = ultimaDir.get(a.id) || 1;
      if (r && r.length >= 6) { const i0 = paso * 3, j0 = Math.min(r.length - 3, i0 + 3), dx0 = r[j0] - r[i0]; if (dx0) mira = Math.sign(dx0); }
      if (pega && pega[0][2]) mira = Math.sign(pega[0][2]);
      ultimaDir.set(a.id, mira);
      // En plena batalla, el tirador que acaba de disparar no anda: se pone en posición de tiro (de pie con la
      // honda, tensando el arco, de rodillas con el arcabuz o la espingarda, cuerpo a tierra con el fusil
      // moderno), mira al blanco y, al soltar, sale el fogonazo y el arma retrocede.
      const cv_ = oficio === 'guerrero' && a.tirador && !nino && a.fuego && m.turno - a.fuego.turno <= 1 && !anda ? civPorId.get(a.c) : null;
      const pose = cv_ && cv_.guerras && cv_.guerras.length ? (cv_.era >= 7 ? 'tierra' : cv_.era >= 5 ? 'rodilla' : (a.arma || 0) >= 1 ? 'arco' : 'apunta') : null;
      let suelta = null;
      if (pose) for (const d of v.disparos || []) if (d[6] === a.id && k >= d[4] - 1.6 && k < d[4] - 0.7) { suelta = k >= d[4] - 1 ? (k - (d[4] - 1)) / 0.3 : -1; break; }
      const dirTiro = pose ? (a.fuego.dx || 1) : 1;
      const img = pose ? ARTE().tiradorEnPose({ col: color[a.c] || '#cccccc', pose, tenso: pose === 'arco' && !(suelta != null && suelta >= 0), arma: a.arma || 0, armadura: a.armadura || 0, piel: (a.c + (a.id % 6 === 0 ? 1 : 0)) % 4, pelo: a.id % 4 })
        : figura(a, color[a.c] || '#cccccc', fase, alto, acc === 3 ? (oficio === 'minero' ? 2 : oficio === 'granjero' ? 3 : 1) : 0, corre);
      // A media escala: el dibujo tiene detalle al acercarse, pero una persona mide un tercio de una casa.
      const ix = px - 1.5, iy = py - 1, EA = 0.5;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - 1, py + 5, 5, 1);
      // El comerciante que va en tren no se ve por la carretera: su carga viaja en los vagones.
      if (oficio === 'comerciante' && !nino && a.enTren && a.e === 5) continue;
      if (oficio === 'comerciante' && !nino && a.camion && a.e === 5) {
        // El camión de la Era Moderna: cabina del color del reino, caja de carga y ruedas; con humo del tubo.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const d = dirX || (dirY ? 0 : 1), cx = px - 3, cy = py;
        const col = color[a.c] || '#ccc';
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx, cy + 5, 9, 1);
        g.fillStyle = '#d8d0b8'; g.fillRect(d >= 0 ? cx : cx + 3, cy, 6, 4); g.fillStyle = '#b8b0a0'; g.fillRect(d >= 0 ? cx : cx + 3, cy + 3, 6, 1);
        g.fillStyle = col; g.fillRect(d >= 0 ? cx + 6 : cx, cy + 1, 3, 3); g.fillStyle = '#a8d0e8'; g.fillRect(d >= 0 ? cx + 7 : cx, cy + 1, 1.5, 1.2);
        g.fillStyle = '#1e1e22'; for (const wx of [1, 4, 7]) g.fillRect(cx + wx, cy + 4, 1.4, 1.4);
        if (Math.random() < 0.08) emitir(d >= 0 ? cx - 0.5 : cx + 9.5, cy + 3, 1, { v: 4, g: -6, vida: 700, cols: ['#8a8a90', '#a8a8b0'], tipo: 'humo', tam: 1 });
        continue;
      }
      if (oficio === 'comerciante' && !nino) {
        // La carreta va detrás del comerciante, según hacia dónde camina.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const cx = px - (dirX || (dirY ? 0 : 1)) * 6 - 1, cy = py + 1 - dirY * 5;
        g.fillStyle = '#2a1e14'; g.fillRect(cx - 0.5, cy + 0.5, 7, 4);
        g.fillStyle = '#3a2a1e'; g.fillRect(cx + 1, cy + 4, 1, 1); g.fillRect(cx + 4, cy + 4, 1, 1);
        g.fillStyle = '#9a6a3a'; g.fillRect(cx, cy + 1, 6, 3); g.fillStyle = '#7a5028'; g.fillRect(cx, cy + 3, 6, 0.5);
        // Lo que lleva se ve: sacos de grano, troncos, piedras, lingotes o un fardo de armas; vacía, unas cajas.
        const cg = a.carga && a.carga.que;
        if (cg === 'comida') { g.fillStyle = '#e8d08a'; g.fillRect(cx + 0.5, cy - 0.5, 2, 2); g.fillRect(cx + 3, cy - 1, 2, 2.5); g.fillStyle = '#c8a050'; g.fillRect(cx + 1, cy - 0.5, 1, 0.5); g.fillRect(cx + 3.5, cy - 1, 1, 0.5); }
        else if (cg === 'madera') { g.fillStyle = '#7a4a24'; g.fillRect(cx, cy - 1, 6, 1); g.fillRect(cx + 0.5, cy, 5, 1); g.fillStyle = '#c89a62'; g.fillRect(cx, cy - 1, 0.6, 1); g.fillRect(cx + 0.5, cy, 0.6, 1); }
        else if (cg === 'piedra') { g.fillStyle = '#a8a49a'; g.fillRect(cx + 0.5, cy - 1, 2, 2); g.fillRect(cx + 3, cy - 0.5, 2.5, 1.5); g.fillStyle = '#7e7a72'; g.fillRect(cx + 2, cy, 1, 1); }
        else if (cg === 'metal') { g.fillStyle = '#9aa4b0'; g.fillRect(cx + 0.5, cy - 0.5, 2.5, 1); g.fillRect(cx + 3, cy - 0.5, 2.5, 1); g.fillStyle = '#d0d8e0'; g.fillRect(cx + 1, cy - 1, 4, 0.5); }
        else if (cg === 'armas') { g.fillStyle = '#d0d4dc'; g.fillRect(cx, cy - 1.5, 6, 0.6); g.fillRect(cx + 1, cy - 0.5, 5, 0.6); g.fillStyle = '#6a4220'; g.fillRect(cx + 4.5, cy - 1.8, 1, 1.4); }
        else { g.fillStyle = '#e0c050'; g.fillRect(cx + 1, cy, 1.5, 1.5); g.fillStyle = '#c84a3a'; g.fillRect(cx + 2.5, cy, 1.5, 1.5); g.fillStyle = '#4a8ad0'; g.fillRect(cx + 4, cy, 1.5, 1.5); }
      }
      // En fiesta, la gente que no trabaja baila (da saltitos al ritmo).
      const baila = fiesta.has(a.c) && acc === 0 && !anda && Math.sin(ahora / 140 + a.id) > 0.3;
      // Dentro de la trinchera solo asoma de cintura para arriba.
      const enZanja = oficio === 'guerrero' && !anda && v.trinchera && v.trinchera[Math.floor(py / P) * v.tw + Math.floor(px / P)];
      if (enZanja) { g.save(); g.beginPath(); g.rect(px - 8, py - 12, 18, 17); g.clip(); g.translate(0, 1.5); }
      if (pose) {
        // Retroceso al disparar (medio píxel hacia atrás) y el dibujo volteado si el blanco está a la izquierda.
        // El retroceso: un golpe hacia atrás al disparar que vuelve suave.
        const atras = suelta != null && suelta >= 0 && pose !== 'arco' ? -0.5 * (1 - suelta) * dirTiro : 0;
        g.save(); if (dirTiro < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(img, ix + atras * dirTiro, iy, img.width * EA, img.height * EA);
        g.restore();
        if (suelta != null && suelta >= 0 && pose !== 'arco') {
          const [bx_, by_] = ARTE().BOCA[pose], fx = dirTiro > 0 ? ix + bx_ * EA : 2 * (px + 1.5) - (ix + bx_ * EA), fy = iy + by_ * EA;
          // Fogonazo en estrella que se apaga deprisa: naranja, amarillo y el centro blanco.
          const fl = 1 - suelta, ox = dirTiro > 0 ? 0 : -1;
          g.globalAlpha = Math.max(0, fl);
          g.fillStyle = '#ff9a3a'; g.fillRect(fx + ox * 3, fy - 1, 3, 2);
          g.fillStyle = '#ffd23a'; g.fillRect(fx + ox * 2.5 + (dirTiro > 0 ? 0.5 : 0), fy - 1.5, 2, 3); g.fillRect(fx + (dirTiro > 0 ? 2.5 : -3.5), fy - 0.5, 1, 1);
          g.fillStyle = '#fff6c0'; g.fillRect(fx + (dirTiro > 0 ? 0.5 : -1.5), fy - 0.5, 1, 1);
          g.globalAlpha = 1;
          const clave_ = a.id + ':' + m.turno + ':' + Math.floor(k);
          if (!humoTiro.has(clave_)) { humoTiro.add(clave_); if (humoTiro.size > 400) humoTiro.clear(); emitir(fx + dirTiro, fy, 3, { v: 8, g: -6, vida: 900, cols: ['#e8e8ec', '#c8c8d0'], tipo: 'humo', tam: 1.4 }); }
        }
      }
      else {
        // Volteado si va hacia la izquierda; el balanceo del paso sube el cuerpo medio píxel.
        g.save(); if (mira < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(img, ix, iy - (baila ? 1 : 0) - sube, img.width * EA, img.height * EA);
        g.restore();
      }
      if (enZanja) g.restore();
      // Partículas del trabajo: astillas, lascas, terrones, polvo de obra, y la chispa de una idea.
      if (acc === 1 && !nino && Math.random() < 0.07) {
        const hx = px + 4.5, hy = py + 3;
        if (oficio === 'lenador') emitir(hx, hy, 3, { v: 18, g: 90, vida: 600, cols: ['#c8a070', '#8a5a2b', '#e0c090'], tipo: 'solido', tam: 0.7, dy: -16 });
        else if (oficio === 'minero') emitir(hx, hy, 3, { v: 20, g: 100, vida: 550, cols: ['#9a98a2', '#c8c4cc', '#6a6870'], tipo: 'solido', tam: 0.7, dy: -18 });
        else if (oficio === 'granjero') emitir(hx, hy + 2, 2, { v: 12, g: 90, vida: 500, cols: ['#6a4a2a', '#8a6a3a', '#e0c050'], tipo: 'solido', tam: 0.7, dy: -12 });
        else if (oficio === 'constructor') { emitir(hx, hy + 2, 2, { v: 6, g: -4, vida: 900, cols: [POLVO], tipo: 'humo', tam: 2 }); if (Math.random() < 0.4) emitir(hx, hy - 1, 2, { v: 18, g: 40, vida: 200, cols: ['#ffe080'], tipo: 'chispa', tam: 0.6 }); }
        else if (oficio === 'erudito') emitir(px + 1.5, py - 3, 1, { v: 4, g: -14, vida: 900, cols: ['#ffe080', '#bfe0ff'], tipo: 'chispa', tam: 0.8 });
      }
      // Chispas del choque de armas cuerpo a cuerpo, y el polvo de los que cargan.
      if (acc === 2 && !a.tirador && Math.random() < 0.12) emitir(px + 4.5, py + 1, 3, { v: 30, g: 50, vida: 220, cols: ['#fff6a0', '#ffd23a', '#ffffff'], tipo: 'chispa', tam: 0.6 });
      if (anda && oficio === 'guerrero' && Math.random() < 0.025) emitir(px + 1.5, py + 6, 2, { v: 5, g: -2, vida: 700, cols: [POLVO], tipo: 'humo', tam: 1.6 });
      // Para los gestos: quién está quieto (charla, juega, baila) y quién grita al cargar.
      if (!anda && acc === 0 && !a.veh) quietos.push({ a, px, py, oficio, nino, fiesta: fiesta.has(a.c), hambre: hambre.has(a.c) });
      else if (acc === 2 && oficio === 'guerrero' && !a.tirador) gritos.push({ a, px, py });
      else if (acc === 1 && oficio === 'erudito') quietos.push({ a, px, py, oficio, nino, piensa: true });
      // Quien acaba de cambiar de oficio (por tu orden) lleva un destello dorado un par de segundos.
      const antes = ultimoOficio.get(a.id);
      if (antes != null && antes !== a.o) cambioVisto.set(a.id, ahora);
      ultimoOficio.set(a.id, a.o);
      const dc = ahora - (cambioVisto.get(a.id) || -1e9);
      if (dc < 2600) { const sube = Math.round(dc / 400); g.fillStyle = Math.floor(dc / 150) % 2 ? '#fff4b0' : '#ffd23a'; g.fillRect(px + 1, py - 4 - sube, 1, 3); g.fillRect(px, py - 3 - sube, 3, 1); }
      if (oficio === 'guerrero' && !nino) {
        const ej = m.vida.ejercitos && m.vida.ejercitos[a.c], col = color[a.c] || '#ccc';
        if (ej && ej.capitan === a.id) { g.fillStyle = '#2a1e14'; g.fillRect(px - 1, py - 8, 1, 13); g.fillStyle = col; g.fillRect(px, py - 8, 6, 4); g.fillStyle = '#fff6dc'; g.fillRect(px + 2, py - 7, 2, 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py - 5, 6, 0.5); }
      }
      // El tajo: un arco blanco delante de quien golpea cuerpo a cuerpo.
      if (pega && !a.tirador && oficio === 'guerrero') {
        const [at, d] = pega, dx = Math.sign(at[2]) || 1, dy = Math.sign(at[3]);
        g.strokeStyle = 'rgba(255,255,240,' + (0.9 * (1 - d)).toFixed(2) + ')'; g.lineWidth = 0.8;
        const cx = px + 1.5 + dx * 3, cy = py + 2 + dy * 2, ang = Math.atan2(dy, dx);
        g.beginPath(); g.arc(cx, cy, 3.2, ang - 1.2 + d * 0.6, ang + 0.2 + d * 1.2); g.stroke();
      }
      if (acc === 2 && !(a.tirador)) { const ch = Math.floor(ahora / 90 + a.id) % 4; g.fillStyle = ch % 2 ? '#fff6a0' : '#ffd23a'; g.fillRect(px + 4 + ch, py - 1 - (ch % 2), 1, 1); g.fillRect(px + 5, py + 1 + (ch % 3) - 1, 1, 1); if (ch === 0) { g.fillStyle = '#ffffff'; g.fillRect(px + 4, py, 2, 1); } }
      else if (acc === 2 && t) { g.fillStyle = '#ff4b3a'; g.fillRect(px + 4, py - 1, 1, 1); }
      if (recibe) {
        const [gp, d] = recibe;
        // Destello: rojo al recibir, luego un parpadeo blanco; y unas gotas de sangre que saltan y caen.
        g.globalAlpha = d < 0.45 ? 0.9 : d < 0.7 ? 0.65 : 0.35;
        g.save(); if ((pose ? dirTiro : mira) < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(ARTE().tenido(img, d < 0.45 ? '#ff2a2a' : '#ffffff'), ix, iy, img.width * EA, img.height * EA); g.restore(); g.globalAlpha = 1;
        const sx = Math.sign(a.x - gp[2]) || 1;
        g.fillStyle = '#b01818';
        for (let q = 0; q < 3; q++) { const vx = sx * (1.5 + q * 1.2), vy = -3 + q; g.fillRect(Math.round(px + 1 + vx * d * 3), Math.round(py + 2 + vy * d * 3 + 7 * d * d), 1, 1); }
      }
      // Barra de vida sobre los heridos (la vida que les queda en este momento del turno).
      if (a.pv0 != null && oficio === 'guerrero') {
        const max = V.vidaMax(a);
        let pv = a.pv0;
        for (const gp of ig.golpes.get(a.id) || []) if (k >= gp[1] - 0.5) pv -= gp[4];
        if (pv < max) {
          const fr = Math.max(0, pv / max), ancho = 5;
          g.fillStyle = 'rgba(40,10,10,0.75)'; g.fillRect(px - 1, py - 3, ancho, 1);
          g.fillStyle = fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030'; g.fillRect(px - 1, py - 3, Math.max(1, Math.round(ancho * fr)), 1);
        }
      }
    }
  }

  // Textos que suben sobre un pueblo cuando le das una orden («▲ leñadores 7 → 12»).
  let anuncios = [];
  function anunciar(region, texto, color) { anuncios.push({ region, texto, color: color || '#ffe08a', inicio: performance.now() }); if (anuncios.length > 6) anuncios.shift(); }
  function pintarAnuncios(z, ox, oy, dpr, ahora) {
    anuncios = anuncios.filter(a => ahora - a.inicio < 4200);
    if (!anuncios.length) return;
    const tam = Math.round(14 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const porRegion = {};
    for (const a of anuncios) {
      const k = porRegion[a.region] = (porRegion[a.region] || 0) + 1, t = (ahora - a.inicio) / 4200;
      const wx = (a.region % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(a.region / m.W) * V.SUB * P;
      let sx = ox + wx * z;
      const sy = oy + wy * z - (30 + 44 * t + (k - 1) * 24) * dpr;
      g.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      // El cartel no se mete bajo los botones de la derecha (en el móvil) ni se sale de la pantalla: si no cabe,
      // la letra se encoge un poco.
      const izq = 8 * dpr, der = g.canvas.width - (window.innerWidth < 900 ? 66 : 8) * dpr, hueco = der - izq;
      let ancho = g.measureText(a.texto).width + 16 * dpr;
      if (ancho > hueco) { const t2 = Math.max(9 * dpr, Math.floor(tam * hueco / ancho)); g.font = '600 ' + t2 + 'px "Pixelify Sans", "Courier New", monospace'; ancho = g.measureText(a.texto).width + 16 * dpr; }
      sx = Math.max(izq + ancho / 2, Math.min(der - ancho / 2, sx));
      g.fillStyle = 'rgba(13,19,34,0.88)'; g.fillRect(sx - ancho / 2, sy - tam * 0.8, ancho, tam * 1.6);
      g.strokeStyle = a.color; g.lineWidth = 1 * dpr; g.strokeRect(sx - ancho / 2 + 0.5, sy - tam * 0.8 + 0.5, ancho - 1, tam * 1.6 - 1);
      g.fillStyle = a.color; g.fillText(a.texto, sx, sy);
      g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    }
    g.globalAlpha = 1;
  }
  // Sobre la plaza de tu pueblo, una señal que salta cuando la corte te necesita: ⏫ si puedes pasar de edad,
  // ? si tus sabios no tienen nada que investigar. Se toca la plaza para abrir el menú.
  let corteAviso = null, corteTurno = -1;
  function avisoCorte(ahora, z, ox, oy, dpr) {
    const c = m && S.vivas(m).find(x => x.jugador);
    if (!c) return;
    if (corteTurno !== m.turno) {
      corteTurno = m.turno;
      const r = S.puedeSubir(m, c), libres = M.TECNOLOGIAS.filter(t => t.era <= c.era && !M.tecsDe(c).includes(t.id));
      corteAviso = c.subiendo ? null : r.ok ? '⏫' : (!c.investigacion || !c.investigacion.id) && libres.length ? '?' : null;
    }
    if (!corteAviso) return;
    const pl = V.plaza(m, c.capital), t = pl && pl.length ? pl[0] : V.centro(m, c.capital);
    const sx = ((t % m.vida.tw) * P + P) * z + ox, sy = (Math.floor(t / m.vida.tw) * P - 6) * z + oy - 18 * dpr + Math.round(Math.sin(ahora / 200) * 3 * dpr);
    const w = 26 * dpr;
    g.fillStyle = '#05070e'; g.fillRect(sx - w / 2 - 2 * dpr, sy - w / 2 - 2 * dpr, w + 4 * dpr, w + 4 * dpr);
    g.fillStyle = corteAviso === '⏫' ? '#f0c05a' : '#7ab8ff'; g.fillRect(sx - w / 2, sy - w / 2, w, w);
    g.fillStyle = '#05070e'; g.font = 'bold ' + Math.round(16 * dpr) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(corteAviso === '⏫' ? '▲' : '?', sx, sy + 1 * dpr); g.textBaseline = 'alphabetic';
  }
