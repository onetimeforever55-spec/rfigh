  // ── GÉNESIS · EL PINTOR · Partículas y los grandes sucesos en el mapa ──

  // ---------- Partículas: sangre, chispas, humo, fogonazos, astillas, cascotes, salpicaduras ----------
  // Todo lo que salta, cae o sube durante unos instantes. Son solo para la vista (no tocan el mundo).
  let parts = [], ultimoCuadro = 0;
  const elegirDe = l => l[(Math.random() * l.length) | 0];
  // Emite n partículas en (x, y) (píxeles del mundo). o: v (velocidad), dx/dy (empuje), g (gravedad), vida (ms),
  // cols, tam, tipo ('sangre' salpica y queda en el suelo; 'humo' sube y crece; 'chispa' brilla; 'solido' rebota).
  /*
   * LOS GRANDES SUCESOS EN EL MAPA, durante unos segundos donde pasan:
   *  · saqueo: monedas de oro y sacos que saltan de la plaza, humo y un aro dorado;
   *  · independencia: sube una bandera nueva del color del reino que nace, con confeti de su color;
   *  · caída de un reino: su bandera se derrumba entre humo negro;
   *  · exterminio: la tierra del pueblo perseguido late en rojo oscuro, con una calavera encima;
   *  · la corte que huye: polvo de carros que salen deprisa.
   */
  const vistosSuc = new WeakSet();
  let sucVivos = [];
  const COLOR_SUC = { saqueo: '#ffd23a', independencia: '#8af0a0', caida: '#ff8a7a', exterminio: '#ff6a6a', huye: '#ffe08a' };
  function sucesosMapa(ahora, x0, y0, x1, y1) {
    const v = m.vida;
    for (const su of v.sucesos || []) {
      if (vistosSuc.has(su)) continue;
      vistosSuc.add(su);
      if (m.turno - su.turno > 1 || su.region == null) continue;
      sucVivos.push({ su, inicio: ahora });
      anunciar(su.region, su.texto, COLOR_SUC[su.tipo]);
    }
    sucVivos = sucVivos.filter(e => ahora - e.inicio < 8000);
    const R = V.SUB * P;
    for (const e of sucVivos) {
      const su = e.su, t = (ahora - e.inicio) / 8000, cx = (su.region % m.W) * R + R / 2, cy = Math.floor(su.region / m.W) * R + R / 2;
      if (cx < x0 - R * 2 || cy < y0 - R * 2 || cx > x1 + R * 2 || cy > y1 + R * 2) continue;
      const civ = su.civ != null ? S.civ(m, su.civ) : null, otro = su.otro != null ? S.civ(m, su.otro) : null;
      const col = (civ && civ.color) || '#ffffff', colOtro = (otro && otro.color) || '#888888';
      // Un aro que se abre una y otra vez, del color del suceso.
      const q = ((ahora - e.inicio) % 1600) / 1600;
      g.strokeStyle = COLOR_SUC[su.tipo]; g.globalAlpha = (1 - q) * 0.7 * (1 - t); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, cy, 6 + q * R * 1.3, (6 + q * R * 1.3) * 0.6, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      if (su.tipo === 'saqueo') {
        if (t < 0.7 && Math.random() < 0.5) emitir(cx + (Math.random() - 0.5) * R, cy, 3, { v: 45, ang: -Math.PI / 2, cono: 1.6, g: 140, vida: 1300, cols: ['#ffd23a', '#ffe98a', '#c89a1a'], tipo: 'solido', tam: 1.4, tamAzar: 1 });
        if (t < 0.7 && Math.random() < 0.15) emitir(cx + (Math.random() - 0.5) * R, cy, 1, { v: 35, ang: -Math.PI / 2, cono: 1.2, g: 120, vida: 1500, cols: ['#c8a070', '#a8804a'], tipo: 'solido', tam: 3 });
        if (Math.random() < 0.25) emitir(cx + (Math.random() - 0.5) * R * 0.8, cy - 4, 1, { v: 10, g: -10, vida: 2600, cols: [HUMO_GRIS], tipo: 'humo', tam: 4, tamAzar: 1 });
        if (t < 0.6 && Math.random() < 0.35) emitir(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R * 0.6, 3, { v: 14, g: -30, vida: 600, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 1.4, tamAzar: 1 });
      } else if (su.tipo === 'independencia' || su.tipo === 'caida') {
        // La bandera: en la independencia sube y ondea; en la caída se inclina y cae.
        const cae = su.tipo === 'caida', bandera = cae ? colOtro : col;
        const sube = cae ? 1 : Math.min(1, t / 0.2), ang = cae ? Math.min(Math.PI / 2, Math.max(0, (t - 0.1) / 0.4) * Math.PI / 2) : 0;
        g.save(); g.translate(cx, cy + 6); g.rotate(ang);
        const alto = 26 * sube;
        g.fillStyle = '#3a2a1a'; g.fillRect(-1, -alto, 2, alto);
        const ola = Math.sin(ahora / 160) * 1.5;
        g.fillStyle = bandera; g.beginPath(); g.moveTo(1, -alto); g.lineTo(14, -alto + 3 + ola); g.lineTo(13, -alto + 10 + ola); g.lineTo(1, -alto + 8); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1, -alto + 6, 12, 2);
        g.restore();
        if (!cae && t < 0.6 && Math.random() < 0.5) emitir(cx, cy - 20, 4, { v: 50, g: 60, vida: 1400, cols: [col, '#ffffff', col], tipo: 'chispa', tam: 1.2, tamAzar: 1 });
        if (cae && Math.random() < 0.4) emitir(cx + (Math.random() - 0.5) * R * 0.7, cy - 2, 1, { v: 12, g: -12, vida: 3000, cols: ['rgba(30,26,24,A)', HUMO_GRIS], tipo: 'humo', tam: 5, tamAzar: 1 });
      } else if (su.tipo === 'exterminio') {
        const pulso = 0.18 + 0.12 * Math.sin(ahora / 260);
        g.fillStyle = 'rgba(120,0,0,' + (pulso * (1 - t)).toFixed(3) + ')';
        for (let r = 0; r < m.W * m.H; r++) if (m.dueno[r] === su.otro) { const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R; if (rx + R >= x0 && ry + R >= y0 && rx <= x1 && ry <= y1) g.fillRect(rx, ry, R, R); }
        // La calavera, en píxeles, flotando sobre la capital.
        const sy = cy - 24 + Math.sin(ahora / 400) * 2, k = 2;
        g.globalAlpha = 1 - t; g.fillStyle = '#f0e8dc';
        g.fillRect(cx - 3 * k, sy - 3 * k, 6 * k, 5 * k); g.fillRect(cx - 2 * k, sy + 2 * k, 4 * k, 2 * k);
        g.fillStyle = '#2a0a0a'; g.fillRect(cx - 2 * k, sy - 1 * k, 1.5 * k, 1.5 * k); g.fillRect(cx + 0.5 * k, sy - 1 * k, 1.5 * k, 1.5 * k); g.fillRect(cx - 0.5 * k, sy + 1 * k, 1 * k, 1 * k);
        g.globalAlpha = 1;
      } else if (su.tipo === 'huye' && t < 0.5 && Math.random() < 0.4) {
        emitir(cx + (Math.random() - 0.5) * R, cy + 4, 2, { v: 14, g: -4, vida: 1400, cols: [POLVO], tipo: 'humo', tam: 2.5 });
      }
    }
  }
  function emitir(x, y, n, o) {
    if (parts.length > 1400) return;
    for (let i = 0; i < n; i++) {
      const ang = o.cono != null ? o.ang + (Math.random() - 0.5) * o.cono : Math.random() * Math.PI * 2, vel = (o.v || 20) * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(ang) * vel + (o.dx || 0), vy: Math.sin(ang) * vel * (o.plano ? 0.5 : 1) + (o.dy || 0), g: o.g != null ? o.g : 70,
        t: 0, vida: (o.vida || 600) * (0.6 + Math.random() * 0.8), col: elegirDe(o.cols || ['#ffffff']), tam: (o.tam || 1) * (o.tamAzar ? 0.6 + Math.random() * 0.8 : 1), tipo: o.tipo || 'solido', suelo: y + (o.suelo != null ? o.suelo : 3 + Math.random() * 3) });
    }
  }
  function pintarParticulas(ahora) {
    const dt = Math.min(0.05, Math.max(0, (ahora - (ultimoCuadro || ahora)) / 1000)); ultimoCuadro = ahora;
    const vivas = [];
    for (const q of parts) {
      q.t += dt * 1000;
      if (q.t > q.vida) continue;
      vivas.push(q);
      const f = q.t / q.vida;
      if (q.tipo === 'humo') { q.x += (q.vx * 0.3 + 4) * dt; q.y += (q.vy * 0.3 - 9) * dt; const r = q.tam * (1 + f * 2.5); g.fillStyle = q.col.replace('A', (0.45 * (1 - f)).toFixed(2)); g.fillRect(q.x - r / 2, q.y - r / 2, r, r); continue; }
      if (!q.parado) {
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y >= q.suelo && q.vy > 0) {
          if (q.tipo === 'sangre') { q.parado = 1; q.y = q.suelo; q.tam *= 1.3; }
          else if (q.tipo === 'solido' && Math.abs(q.vy) > 8) { q.vy *= -0.35; q.vx *= 0.6; q.y = q.suelo; }
          else { q.parado = 1; q.y = q.suelo; }
        }
      }
      g.globalAlpha = q.tipo === 'chispa' ? 1 - f : q.parado ? Math.min(1, (1 - f) * 2) : 1;
      g.fillStyle = q.tipo === 'chispa' && Math.floor(q.t / 60) % 2 ? '#fff6c0' : q.col;
      g.fillRect(q.x, q.y, q.tam, q.tam * (q.parado && q.tipo === 'sangre' ? 0.6 : 1));
    }
    g.globalAlpha = 1;
    parts = vivas;
  }
  const SANGRE = ['#b01818', '#8a0e0e', '#d02a2a', '#6a0a0a'];
  const HUMO_GRIS = 'rgba(90,86,84,A)', HUMO_CLARO = 'rgba(200,200,205,A)', POLVO = 'rgba(170,150,120,A)';
  // Lo que pasa en este turno y ya se ha visto en pantalla (cada cosa suelta sus partículas una sola vez).
  let vistos = new Set();
  function eventosParticulas(k, x0, y0, x1, y1) {
    const v = m.vida, enVistaPx = (x, y) => x > x0 - 20 && y > y0 - 20 && x < x1 + 20 && y < y1 + 20;
    // Golpes: un chorro de sangre en la dirección del golpe (y chispas si chocan metales).
    for (const gp of v.golpes || []) {
      if (k < gp[1] - 0.05 || vistos.has(gp)) continue;
      vistos.add(gp);
      const pos = dibujados.get(gp[0]);
      if (!pos) continue;
      const [px, py] = pos;
      if (!enVistaPx(px, py)) continue;
      const ang = Math.atan2(py - (gp[3] * P + 6), px - (gp[2] * P + 6.5)), n = Math.min(14, 4 + Math.round(gp[4] / 4));
      emitir(px + 1.5, py + 2, n, { v: 26 + gp[4], ang, cono: 1.6, g: 90, vida: 1600, cols: SANGRE, tipo: 'sangre', tam: 0.8, tamAzar: 1, dy: -10 });
      if (gp[4] >= 12 && Math.random() < 0.6) emitir(px + 1.5, py + 1, 3, { v: 30, g: 40, vida: 260, cols: ['#ffe080', '#ffffff'], tipo: 'chispa', tam: 0.6 });
    }
    // Disparos: fogonazo y humo al salir; al llegar, polvo, astillas o una explosión.
    for (const d of v.disparos || []) {
      const [x1d, y1d, x2d, y2d, paso, tipo] = d;
      const ax = x1d * P + 8, ay = y1d * P + 7, bx = x2d * P + 8, by = y2d * P + 7;
      if (k >= paso - 1 && !vistos.has(d)) {
        vistos.add(d);
        if (enVistaPx(ax, ay)) {
          if (tipo === 1) { emitir(ax + 2, ay - 2, 4, { v: 14, g: -5, vida: 900, cols: [HUMO_CLARO], tipo: 'humo', tam: 2 }); emitir(ax + 2, ay - 1, 4, { v: 30, ang: Math.atan2(by - ay, bx - ax), cono: 0.6, g: 0, vida: 150, cols: ['#ffd23a', '#fff6a0'], tipo: 'chispa', tam: 1 }); }
          else if (tipo === 2) { emitir(ax, ay - 3, 8, { v: 18, g: -5, vida: 1400, cols: [HUMO_CLARO, HUMO_GRIS], tipo: 'humo', tam: 3 }); emitir(ax, ay - 2, 6, { v: 40, ang: Math.atan2(by - ay, bx - ax), cono: 0.7, g: 0, vida: 200, cols: ['#ff9a3a', '#ffd23a'], tipo: 'chispa', tam: 1.4 }); }
          else if (tipo === 4) emitir(ax, ay - 1, 3, { v: 10, g: 20, vida: 500, cols: ['#ff8a1e', '#ffd84a'], tipo: 'chispa', tam: 0.8 });
        }
      }
      const llega = tipo === 3 ? paso : tipo === 2 ? paso - 0.15 : paso;
      const clave = d.length + 'l';
      if (k >= llega && !(d.impacto)) {
        d.impacto = 1; void clave;
        if (!enVistaPx(bx, by)) continue;
        if (tipo === 5) {
          // La granada revienta: fogonazo pequeño, tierra que salta y un poco de humo.
          emitir(bx, by, 8, { v: 40, g: 20, vida: 260, cols: ['#ffd84a', '#ff8a1e', '#fff6c0'], tipo: 'chispa', tam: 1.2, tamAzar: 1 });
          emitir(bx, by, 8, { v: 40, g: 120, vida: 1000, cols: ['#4a3a2a', '#6a5a46', '#2a221a'], tipo: 'solido', tam: 1, tamAzar: 1, dy: -30 });
          emitir(bx, by - 2, 5, { v: 12, g: -8, vida: 1800, cols: [HUMO_GRIS], tipo: 'humo', tam: 3, tamAzar: 1 });
        } else if (tipo === 2 || tipo === 3) {

          // Explosión: bola de fuego, tierra y cascotes que vuelan, y una columna de humo negro.
          emitir(bx, by, 16, { v: 50, g: 20, vida: 380, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a', '#fff6c0'], tipo: 'chispa', tam: 1.6, tamAzar: 1 });
          emitir(bx, by, 14, { v: 55, g: 120, vida: 1400, cols: ['#4a3a2a', '#6a5a46', '#2a221a', '#7a746c'], tipo: 'solido', tam: 1.2, tamAzar: 1, dy: -40 });
          emitir(bx, by - 2, 10, { v: 16, g: -8, vida: 2600, cols: [HUMO_GRIS, 'rgba(40,36,34,A)'], tipo: 'humo', tam: 4, tamAzar: 1 });
          // (Y el polvo que levanta en el suelo, que se abre en anillo, y una columna de humo que tarda en irse.)
          emitir(bx, by + 3, 12, { v: 30, ang: 0, cono: Math.PI * 2, plano: 1, g: -2, vida: 1600, cols: [POLVO, 'rgba(150,130,104,A)'], tipo: 'humo', tam: 2.6, tamAzar: 1 });
          emitir(bx, by - 6, 4, { v: 5, g: -14, vida: 4200, cols: ['rgba(46,42,40,A)', HUMO_GRIS], tipo: 'humo', tam: 5, tamAzar: 1 });
          polvo(Math.round(by / P) * m.vida.tw + Math.round(bx / P), true);
        } else if (tipo === 1) {
          emitir(bx, by + 2, 5, { v: 22, g: 80, vida: 500, cols: ['#a89070', '#8a7458', '#c8b090'], tipo: 'solido', tam: 0.8, dy: -18 });
          emitir(bx, by + 1, 2, { v: 8, g: -4, vida: 700, cols: [POLVO], tipo: 'humo', tam: 2 });
        } else if (tipo === 4) {
          emitir(bx, by, 6, { v: 20, g: 30, vida: 700, cols: ['#ff8a1e', '#ffd84a', '#ff4b1a'], tipo: 'chispa', tam: 1 });
        } else {
          emitir(bx, by + 2, 4, { v: 16, g: 90, vida: 500, cols: ['#8a5a2b', '#c8a070', '#6b4a2b'], tipo: 'solido', tam: 0.7, dy: -14 });
        }
      }
    }
  }
