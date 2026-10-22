  // ── GÉNESIS · EL PINTOR · Fuego, huellas, polvo, aviones, disparos, tumbas y carteles ──

  // ---------- Fuego, agua y marcas del suelo ----------
  const enVista = (t, x0, y0, x1, y1) => { const x = (t % m.vida.tw) * P, y = Math.floor(t / m.vida.tw) * P; return x + P >= x0 && y + P >= y0 && x <= x1 && y <= y1; };
  // Ceniza, cráteres, sangre y escombros (debajo de todo lo que se mueve), y el agua de las inundaciones.
  function huellas(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, mk = v.marcas || {}, desde = v.marcasPaso || {};
    for (const key of Object.keys(mk)) {
      const t = +key;
      if (desde[t] != null && k < desde[t]) continue;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, tipo = mk[key][0], h = q => hash(t * 13 + q);
      const quedan = mk[key][1] - m.turno, desv = Math.max(0.35, Math.min(1, quedan / 4));
      g.globalAlpha = desv;
      if (tipo === 1) {
        // Ceniza: una mancha gris oscura irregular con tocones y alguna brasa al principio.
        g.fillStyle = 'rgba(40,36,34,0.55)';
        for (let q = 0; q < 7; q++) g.fillRect(x + 1 + h(q) * 11, y + 2 + h(q + 9) * 11, 3 + h(q + 3) * 3, 2 + h(q + 5) * 3);
        g.fillStyle = 'rgba(110,104,98,0.6)'; for (let q = 0; q < 5; q++) g.fillRect(x + h(q + 20) * 15, y + h(q + 30) * 15, 1, 1);
        if (h(40) < 0.5) { g.fillStyle = '#2a201a'; g.fillRect(x + 6, y + 8, 3, 3); g.fillStyle = '#3a2c22'; g.fillRect(x + 6, y + 7, 3, 1); }
        if (quedan > 6 && Math.floor(ahora / 300 + t) % 3 === 0) { g.fillStyle = '#ff7a2a'; g.fillRect(x + 4 + h(50) * 8, y + 5 + h(51) * 8, 1, 1); }
      } else if (tipo === 2) {
        // Cráter: un hoyo oscuro con borde de tierra removida y terrones alrededor.
        g.fillStyle = 'rgba(90,64,40,0.85)'; g.beginPath(); g.ellipse(x + 8, y + 9, 7.5, 5.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(36,26,18,0.95)'; g.beginPath(); g.ellipse(x + 8, y + 9.5, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(20,14,10,0.9)'; g.beginPath(); g.ellipse(x + 8, y + 10, 2.6, 1.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7a5a36'; for (let q = 0; q < 8; q++) { const a = h(q) * Math.PI * 2, r = 8 + h(q + 8) * 3; g.fillRect(x + 8 + Math.cos(a) * r, y + 9 + Math.sin(a) * r * 0.75, 1 + (q % 2), 1); }
        if (quedan > 10) { g.fillStyle = 'rgba(80,80,80,' + (0.25 + 0.15 * Math.sin(ahora / 300 + t)).toFixed(2) + ')'; g.fillRect(x + 6, y + 3 - (ahora / 200 + t) % 4, 3, 2); }
      } else if (tipo === 3) {
        // Sangre: unas salpicaduras de rojo oscuro.
        g.fillStyle = 'rgba(120,14,14,0.75)';
        g.fillRect(x + 5 + h(1) * 5, y + 8 + h(2) * 4, 3, 2); g.fillRect(x + 4 + h(3) * 7, y + 7 + h(4) * 5, 1, 1); g.fillRect(x + 7 + h(5) * 5, y + 10 + h(6) * 3, 2, 1);
        g.fillStyle = 'rgba(80,6,6,0.8)'; g.fillRect(x + 6 + h(7) * 4, y + 9 + h(8) * 3, 1, 1);
      } else if (tipo === 5) {
        // El árbol quemado: ceniza alrededor y el tronco negro, sin hojas, con dos o tres ramas peladas (más alto cuanto
        // más grande era el árbol). Recién apagado echa un hilo de humo y le quedan brasas. Si lo partió una
        // explosión, solo queda el tocón astillado.
        g.globalAlpha = Math.max(0.5, desv);
        // (La ceniza tapa casi toda la parcela: suelo gris oscuro con motas, sin hierba ni flores.)
        g.fillStyle = 'rgba(52,46,42,0.7)'; g.beginPath(); g.ellipse(x + 8, y + 10, 7.5, 5.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(30,26,24,0.6)';
        for (let q = 0; q < 6; q++) g.fillRect(x + 1 + h(q) * 12, y + 5 + h(q + 9) * 9, 2 + h(q + 3) * 3, 2);
        g.fillStyle = 'rgba(120,112,104,0.7)'; for (let q = 0; q < 5; q++) g.fillRect(x + 2 + h(q + 20) * 12, y + 6 + h(q + 30) * 8, 1, 1);
        const tam = mk[key][2] || 2, cx = x + 7 + Math.round(h(60) * 2), base = y + 13;
        if (tam < 0) {
          g.fillStyle = '#2a221c'; g.fillRect(cx, base - 3, 3, 3);
          g.fillStyle = '#3a2e24'; g.fillRect(cx, base - 4, 1, 1); g.fillRect(cx + 2, base - 5, 1, 2);
          g.fillStyle = '#c8b08a'; g.fillRect(cx + 1, base - 3, 1, 1);
        } else {
          const alto = tam >= 3 ? 11 : tam === 2 ? 8 : 5;
          g.fillStyle = '#1e1a18'; g.fillRect(cx, base - alto, 2, alto);
          g.fillStyle = '#2e2622'; g.fillRect(cx + 1, base - alto + 1, 1, alto - 1);
          // Las ramas peladas: tramos de un píxel hacia arriba y a los lados.
          g.fillStyle = '#1e1a18';
          const ramas = tam >= 3 ? 3 : tam === 2 ? 2 : 1;
          for (let q = 0; q < ramas; q++) {
            const yy = base - alto + 2 + q * 3, lado = (q + Math.round(h(70) * 2)) % 2 ? 1 : -1;
            for (let p = 1; p <= 3; p++) g.fillRect(cx + (lado > 0 ? 1 + p : -p), yy - p + 1, 1, 1);
          }
          if (quedan > 14 && Math.floor(ahora / 250 + t) % 4 === 0) { g.fillStyle = '#ff7a2a'; g.fillRect(cx + (h(80) < 0.5 ? 0 : 1), base - 2 - Math.round(h(81) * (alto - 3)), 1, 1); }
          if (quedan > 16 && Math.random() < 0.04) emitir(cx + 1, base - alto, 1, { v: 4, g: -10, vida: 1800, cols: ['rgba(60,56,54,A)', HUMO_GRIS], tipo: 'humo', tam: 1.6 });
        }
      } else if (tipo === 6) {
        // Tierra chamuscada: una mancha parda que se va aclarando, con brotes verdes que salen poco a poco.
        const cura = Math.max(0, Math.min(1, 1 - quedan / 24));
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(78,60,44,' + (0.6 * (1 - cura * 0.75)).toFixed(2) + ')'; g.beginPath(); g.ellipse(x + 8, y + 9, 7.5, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(60,46,34,' + (0.4 * (1 - cura)).toFixed(2) + ')';
        for (let q = 0; q < 6; q++) g.fillRect(x + 1 + h(q) * 10, y + 2 + h(q + 9) * 10, 4 + h(q + 3) * 3, 3 + h(q + 5) * 2);
        g.fillStyle = '#5a9a3a';
        const brotes = Math.round(cura * 9);
        for (let q = 0; q < brotes; q++) { const bx = x + 1 + Math.round(h(q + 40) * 13), by = y + 2 + Math.round(h(q + 50) * 12); g.fillRect(bx, by, 1, 1); if (q % 3 === 0) g.fillRect(bx, by - 1, 1, 1); }
      } else if (tipo === 4) {
        // Escombros: piedras, vigas y tejas por el suelo.
        for (let q = 0; q < 9; q++) { g.fillStyle = ['#7a746c', '#5a544c', '#6b4a2b', '#9a8a78', '#a04a3a'][q % 5]; g.fillRect(x + h(q) * 14, y + 4 + h(q + 11) * 11, 1 + (h(q + 22) < 0.4 ? 1 : 0), 1); }
      }
    }
    g.globalAlpha = 1;
    // El agua desbordada: azul turbio con brillos que se mueven.
    const inund = v.inundado || {};
    for (const key of Object.keys(inund)) {
      const t = +key;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, tw = v.tw;
      // El borde del agua se redondea donde acaba la inundación (charcos con orilla, no cuadros).
      const n = !inund[t - tw], s2 = !inund[t + tw], o = !inund[t - 1], e = !inund[t + 1];
      g.fillStyle = 'rgba(52,118,186,0.6)';
      g.beginPath();
      if (g.roundRect) g.roundRect(x + (o ? 1 : 0), y + (n ? 1 : 0), P - (o ? 1 : 0) - (e ? 1 : 0), P - (n ? 1 : 0) - (s2 ? 1 : 0), [n && o ? 6 : 0, n && e ? 6 : 0, s2 && e ? 6 : 0, s2 && o ? 6 : 0]);
      else g.rect(x, y, P, P);
      g.fill();
      g.fillStyle = 'rgba(120,80,40,0.25)'; g.fillRect(x + 3, y + 6, 4, 2); // barro arrastrado
      g.fillStyle = 'rgba(210,235,250,0.55)';
      const f = (ahora / 500 + t * 0.37) % 1;
      g.fillRect(x + 2 + f * 8, y + 4, 4, 1); g.fillRect(x + 9 - f * 6, y + 11, 3, 1);
      if (n) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 3, y + 1, P - 6, 1); }
    }
  }
  // Las llamas de este turno: arden desde el paso en que prenden hasta que se apagan, con humo y pavesas.
  function llamas(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, ll = v.llamas || {};
    for (const key of Object.keys(ll)) {
      const t = +key, [ini, fin] = ll[key];
      if (k < ini || k > fin + 2) continue;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      const vivo = k < fin, apaga = vivo ? Math.min(1, (k - ini) * 2 + 0.3) : Math.max(0, 1 - (k - fin) / 2);
      // Humo: bocanadas grises que suben y se van a un lado.
      for (let q = 0; q < 4; q++) {
        const f = ((ahora / 1400 + q / 4 + hash(t + q) * 0.3) % 1);
        g.fillStyle = 'rgba(' + (vivo ? '70,66,64' : '110,108,106') + ',' + ((1 - f) * 0.45 * (vivo ? 1 : apaga)).toFixed(2) + ')';
        const r = 2 + f * 4;
        g.fillRect(x + 6 + f * 6 + Math.sin(ahora / 400 + q) * 1.5 - r / 2, y + 2 - f * 22 - r / 2, r, r);
      }
      if (!vivo) continue;
      // Brasas en la base y llamas: lenguas afiladas que bailan, rojas abajo, naranjas y amarillas en la punta.
      g.fillStyle = 'rgba(120,24,10,0.7)'; g.beginPath(); g.ellipse(x + 8, y + 13.5, 6.5, 2, 0, 0, Math.PI * 2); g.fill();
      for (let q = 0; q < 5; q++) {
        const ph = ahora / (85 + q * 19) + t + q * 1.7;
        const alto = (4 + 5 * Math.abs(Math.sin(ph)) + hash(t * 3 + q) * 4) * apaga * (q === 2 ? 1.35 : q === 0 || q === 4 ? 0.7 : 1);
        const cx = x + 2.5 + q * 2.8 + Math.sin(ph * 0.7) * 0.8, base = y + 14, ladeo = Math.sin(ph * 1.3) * 1.2;
        const lengua = (col, w, h0) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - w, base); g.quadraticCurveTo(cx - w * 0.8, base - h0 * 0.6, cx + ladeo, base - h0); g.quadraticCurveTo(cx + w * 0.8, base - h0 * 0.6, cx + w, base); g.closePath(); g.fill(); };
        lengua('#d0301c', 2.2, alto); lengua('#ff8a1e', 1.6, alto * 0.75); lengua('#ffd84a', 0.9, alto * 0.45);
      }
      g.fillStyle = 'rgba(255,248,210,0.9)'; g.fillRect(x + 7, y + 12, 2, 1);
      if (Math.random() < 0.06) emitir(x + 4 + Math.random() * 8, y + 6, 1, { v: 6, g: -30, vida: 1300, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 0.8 });
      if (Math.random() < 0.03) emitir(x + 8, y + 2, 1, { v: 4, g: -6, vida: 2200, cols: [HUMO_GRIS], tipo: 'humo', tam: 3 });
      // Pavesas que suben.
      for (let q = 0; q < 3; q++) { const f = (ahora / 700 + q / 3 + hash(t + q * 5)) % 1; g.fillStyle = f < 0.5 ? '#ffd84a' : '#ff6a1a'; g.fillRect(x + 4 + hash(t + q) * 8 + Math.sin(ahora / 200 + q) * 2, y + 6 - f * 16, 1, 1); }
    }
  }
  // Después de la noche: el resplandor del fuego ilumina alrededor (se ve mucho mejor a oscuras).
  function resplandor(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, ll = v.llamas || {}, o = oscuridad(performance.now());
    const claves = Object.keys(ll);
    if (!claves.length) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const key of claves) {
      const t = +key, [ini, fin] = ll[key];
      if (k < ini || k >= fin || !enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P + 8, y = Math.floor(t / v.tw) * P + 9, r = 14 + 2 * Math.sin(ahora / 120 + t);
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(255,140,40,' + (0.22 + 0.3 * o).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }
  // Polvo de los derrumbes y cascotes que saltan con las explosiones.
  let polvos = [];
  function polvo(t, fuerte) { polvos.push({ t, inicio: performance.now(), fuerte: !!fuerte }); if (polvos.length > 120) polvos = polvos.slice(-120); }
  function pintarPolvo(ahora) {
    polvos = polvos.filter(p => ahora - p.inicio < 1400);
    for (const p of polvos) {
      const f = (ahora - p.inicio) / 1400, x = (p.t % m.vida.tw) * P + 8, y = Math.floor(p.t / m.vida.tw) * P + 10;
      g.fillStyle = 'rgba(170,150,120,' + (0.5 * (1 - f)).toFixed(2) + ')';
      const r = 4 + f * (p.fuerte ? 14 : 9);
      g.beginPath(); g.ellipse(x, y - f * 4, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,80,70,' + (1 - f).toFixed(2) + ')';
      for (let q = 0; q < (p.fuerte ? 8 : 4); q++) { const a = hash(p.t + q) * Math.PI * 2, vel = 6 + hash(p.t * 7 + q) * 10; g.fillRect(x + Math.cos(a) * vel * f, y - 10 * f + 18 * f * f + Math.sin(a) * vel * f * 0.6, 1, 1); }
    }
  }

  // Aviones: cruzan desde su aeródromo hasta el blanco (llegan en V.VUELO pasos), sueltan las bombas y siguen de
  // largo, con su sombra en el suelo. Biplanos en la Era Moderna; bombarderos en la II Guerra Mundial.
  function pintarAviones(k) {
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    for (const [x0, y0, x1, y1, paso, civ, bomb] of (m.vida.aviones || [])) {
      const f = (k - paso) / (V.VUELO || 1.6);
      if (f < 0 || f > 1.9) continue;
      const ax = x0 * P + 8, ay = y0 * P + 8, bx = x1 * P + 8, by = y1 * P + 8;
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, img = ARTE().avion(color[civ] || '#cccccc', bomb), dir = bx >= ax ? 1 : -1;
      const ang = Math.atan2(by - ay, (bx - ax) || 0.01) - (dir < 0 ? Math.PI : 0);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 8, y + 16, 16, 3);
      g.save(); g.translate(x, y - 8); g.rotate(ang); if (dir < 0) g.scale(-1, 1);
      g.drawImage(img, -img.width * 0.65, -img.height * 0.65, img.width * 1.3, img.height * 1.3);
      g.restore();
    }
  }

  // Flechas y balas: vuelan durante el paso en que se dispararon.
  function pintarDisparos(k) {
    const lista = m.vida.disparos || [];
    for (const [x1, y1, x2, y2, paso, bala] of lista) {
      const f = k - (paso - 1);
      if (f < 0 || f > 1) continue;
      const ax = x1 * P + 8, ay = y1 * P + 7, bx = x2 * P + 8, by = y2 * P + 7;
      if (bala === 3) {
        // Bomba de avión: cae en vertical y revienta.
        if (f < 0.75) { const yb = ay - 40 + 40 * (f / 0.75); g.fillStyle = '#2a2a2a'; g.fillRect(Math.round(bx - 0.5), Math.round(yb), 2, 3); }
        else { const q = (f - 0.75) / 0.25, rr = 2 + q * 7;
          // Onda expansiva y cascotes que saltan.
          g.strokeStyle = 'rgba(255,240,200,' + (0.6 * (1 - q)).toFixed(2) + ')'; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by, 4 + q * 16, (4 + q * 16) * 0.6, 0, 0, Math.PI * 2); g.stroke();
          g.fillStyle = '#4a3a2a'; for (let d = 0; d < 7; d++) { const a = hash(Math.round(bx) * 31 + d) * Math.PI * 2, vel = 10 + hash(Math.round(by) + d) * 12; g.fillRect(bx + Math.cos(a) * vel * q, by - 14 * q + 10 * q * q + Math.sin(a) * vel * q * 0.5, 1, 1); } g.fillStyle = 'rgba(255,' + Math.round(220 - q * 120) + ',80,' + (1 - q * 0.6).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(90,80,70,' + (0.6 * q).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by - 3 - q * 4, rr * 0.8, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      if (bala === 4) {
        // Flecha incendiaria: arco, punta en llamas y estela de humo.
        const arcoF = Math.min(14, Math.hypot(bx - ax, by - ay) * 0.25);
        const posF = q => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * arcoF];
        const [fx, fy] = posF(f);
        for (let d = 1; d <= 5; d++) { const [sx, sy] = posF(Math.max(0, f - d * 0.04)); g.fillStyle = 'rgba(120,110,100,' + (0.35 - d * 0.06).toFixed(2) + ')'; g.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 1); }
        g.fillStyle = '#6b4a2b'; g.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1);
        g.fillStyle = Math.floor(performance.now() / 70) % 2 ? '#ffd84a' : '#ff6a1a'; g.fillRect(Math.round(fx) + 1, Math.round(fy) - 1, 2, 2);
        continue;
      }
      if (bala === 5) {
        // Granada: vuela en arco dando vueltas y revienta al caer.
        const arcoG = Math.min(18, Math.hypot(bx - ax, by - ay) * 0.5), q = Math.min(1, f / 0.8);
        const gx = ax + (bx - ax) * q, gy = ay - 4 + (by - ay + 4) * q - Math.sin(q * Math.PI) * arcoG;
        if (f < 0.8) { const gira = Math.floor(f * 10) % 2; g.fillStyle = '#3e4a2a'; g.fillRect(Math.round(gx), Math.round(gy), gira ? 2 : 1, gira ? 1 : 2); g.fillStyle = '#5c6a3a'; g.fillRect(Math.round(gx), Math.round(gy), 1, 1); }
        else { const e = (f - 0.8) / 0.2, rr = 1.5 + e * 5; g.fillStyle = 'rgba(255,' + Math.round(230 - e * 110) + ',80,' + (1 - e * 0.6).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      if (bala === 2) {
        // Obús: vuela en arco alto y explota al llegar.
        const arcoO = Math.min(30, Math.hypot(bx - ax, by - ay) * 0.45), q = Math.min(1, f / 0.85);
        const ox = ax + (bx - ax) * q, oy = ay + (by - ay) * q - Math.sin(q * Math.PI) * arcoO;
        if (f < 0.2) { g.fillStyle = 'rgba(230,230,230,' + (0.7 - f * 3).toFixed(2) + ')'; g.fillRect(ax - 1, ay - 5 - f * 12, 5, 4); }
        if (f < 0.85) { g.fillStyle = '#1e1e1e'; g.fillRect(Math.round(ox), Math.round(oy), 2, 2); }
        else { const e = (f - 0.85) / 0.15, rr = 2 + e * 6; g.fillStyle = 'rgba(255,' + Math.round(200 - e * 100) + ',60,' + (1 - e * 0.5).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      const arco = bala ? 0 : Math.min(14, Math.hypot(bx - ax, by - ay) * 0.25);
      const pos = q => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * arco];
      const [x, y] = pos(f), [xa, ya] = pos(Math.max(0, f - 0.08));
      const ang = Math.atan2(y - ya, x - xa), cx = Math.cos(ang), cy = Math.sin(ang);
      if (bala) {
        if (f < 0.3) { g.fillStyle = '#ffd23a'; g.fillRect(ax + 2, ay - 2, 3, 3); g.fillStyle = 'rgba(220,220,230,' + (0.7 - f * 2).toFixed(2) + ')'; g.fillRect(ax + 1, ay - 6 - f * 10, 4, 3); }
        g.fillStyle = 'rgba(255,240,160,0.5)'; for (let d = 1; d <= 4; d++) g.fillRect(Math.round(x - cx * d), Math.round(y - cy * d), 1, 1);
        g.fillStyle = '#fff6a0'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
      } else {
        // La flecha: astil, punta y plumas, apuntando hacia donde vuela, con una estela tenue.
        g.fillStyle = 'rgba(255,255,255,0.25)'; for (let d = 6; d <= 10; d++) g.fillRect(Math.round(x - cx * d), Math.round(y - cy * d), 1, 1);
        g.fillStyle = '#6b4a2b'; for (let d = -3; d <= 2; d++) g.fillRect(Math.round(x + cx * d), Math.round(y + cy * d), 1, 1);
        g.fillStyle = '#e8ecf4'; g.fillRect(Math.round(x + cx * 3), Math.round(y + cy * 3), 2, 2);
        g.fillStyle = '#f4f4f4'; g.fillRect(Math.round(x - cx * 4), Math.round(y - cy * 4 - 1), 1, 1); g.fillRect(Math.round(x - cx * 4), Math.round(y - cy * 4 + 1), 1, 1);
      }
    }
  }

  // Donde muere un aldeano queda una cruz un rato.
  function pintarTumbas(ahora) {
    tumbas = tumbas.filter(tb => ahora - tb.inicio < (tb.quien ? 11600 : 9000));
    for (const tb of tumbas) {
      const t = ahora - tb.inicio;
      if (t < 0) continue;
      const x = tb.x * P + 6, y = tb.y * P + 5;
      if (tb.tipo === 'ahogado') {
        // Se hunde: unas burbujas que suben y se apagan, y un remolino.
        if (t > 3500) continue;
        g.globalAlpha = Math.max(0, 1 - t / 3500);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let k = 0; k < 4; k++) { const f = ((t / 900) + k / 4) % 1; g.fillRect(Math.round(x + 1 + Math.sin(k * 2 + t / 300) * 2), Math.round(y + 4 - f * 9), k % 2 ? 1 : 2, k % 2 ? 1 : 2); }
        g.fillRect(x - 2, y + 5, 7, 1);
        g.globalAlpha = 1;
        continue;
      }
      if (tb.tipo === 'animal') {
        // El animal cae de lado y queda tendido un momento.
        if (t > 2600 || !tb.quien) continue;
        const b = tb.quien, col = { oveja: '#eeeae0', vaca: '#6b4a2b', ciervo: '#9a6a3a', lobo: '#7a7a82' }[b.tipo] || '#999';
        if (b.tipo === 'pez') continue;
        g.globalAlpha = t < 1800 ? 1 : 1 - (t - 1800) / 800;
        const ax = tb.x * P + 6, ay = tb.y * P + 9, cae = Math.min(1, t / 220);
        if (t < 260) { g.fillStyle = '#ff2a2a'; g.fillRect(ax - 1, ay - 2 + cae * 2, 6, 4); }
        else {
          g.fillStyle = 'rgba(110,10,10,' + Math.min(0.7, (t - 260) / 900).toFixed(2) + ')'; g.beginPath(); g.ellipse(ax + 2, ay + 3, 2 + Math.min(3, t / 500), 1.2 + Math.min(1, t / 900), 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = col; g.fillRect(ax - 1, ay, 6, 3);
          g.fillStyle = '#3a2a1e'; g.fillRect(ax, ay - 1, 1, 1); g.fillRect(ax + 3, ay - 1, 1, 1); g.fillRect(ax + 5, ay + 1, 1, 1);
        }
        g.globalAlpha = 1;
        continue;
      }
      if (!tb.estallo && tb.quien && ['batalla', 'flecha', 'torre', 'lobo', 'obus', 'bomba'].includes(tb.tipo)) { tb.estallo = 1; emitir(tb.x * P + 8, tb.y * P + 9, 14, { v: 34, g: 100, vida: 1800, cols: SANGRE, tipo: 'sangre', tam: 0.9, tamAzar: 1, dy: -22 }); }
      if (tb.quien && t < 2600 && !['ahogado', 'vejez', 'hambre', 'peste', 'plaga'].includes(tb.tipo)) {
        // Cae como en WorldBox: destello rojo, se ladea y queda tendido con un charco de sangre; luego se desvanece.
        const a = tb.quien, civ = m.civs.find(c => c.id === tb.c), col = civ ? civ.color : '#cccccc';
        const img = a.veh ? ARTE().vehiculo(a.veh, col, 0) : figura(a, col, 0, 0, 0), EA = a.veh ? 0.85 : 0.5;
        const w = img.width * EA, h = img.height * EA, cx = tb.x * P + 8, cy = tb.y * P + 12;
        const giro = Math.min(1, t / 260) * Math.PI / 2 * ((a.id % 2) ? 1 : -1);
        if (t > 200 && !a.veh) { g.fillStyle = 'rgba(120,10,10,' + Math.min(0.7, (t - 200) / 700).toFixed(2) + ')'; g.beginPath(); g.ellipse(cx, cy + 1, 2 + Math.min(4, t / 350), 1.2 + Math.min(1.5, t / 700), 0, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = t < 1800 ? 1 : 1 - (t - 1800) / 800;
        g.save(); g.translate(cx, cy);
        if (a.veh) {
          // El vehículo destrozado: se ennegrece y humea.
          g.drawImage(img, -w / 2, -h, w, h);
          g.globalAlpha *= Math.min(0.75, t / 400); g.drawImage(ARTE().tenido(img, '#1a1612'), -w / 2, -h, w, h);
        } else {
          g.rotate(giro);
          g.drawImage(img, -w / 2, -h, w, h);
          if (t < 300) { g.globalAlpha = t < 150 ? 0.9 : 0.5; g.drawImage(ARTE().tenido(img, t < 150 ? '#ff2a2a' : '#ffffff'), -w / 2, -h, w, h); }
          else { g.globalAlpha *= Math.min(0.45, (t - 300) / 1500); g.drawImage(ARTE().tenido(img, '#2a2026'), -w / 2, -h, w, h); }
        }
        g.restore(); g.globalAlpha = 1;
        if (a.veh) { for (let q = 0; q < 3; q++) { const f = ((t / 900) + q / 3) % 1; g.fillStyle = 'rgba(60,56,54,' + (0.5 * (1 - f)).toFixed(2) + ')'; g.fillRect(cx - 1 + f * 4, cy - 6 - f * 14, 2 + f * 3, 2 + f * 3); } }
        if (tb.tipo === 'fuego' && t < 1500) { g.fillStyle = Math.floor(t / 80) % 2 ? '#ff8a1e' : '#ffd84a'; g.fillRect(cx - 2, cy - 4, 2, 3); g.fillRect(cx + 1, cy - 3, 1, 2); }
        if (t < 2600) continue;
      }
      if ((tb.tipo === 'batalla' || tb.tipo === 'flecha' || tb.tipo === 'torre' || tb.tipo === 'lobo') && t < 900 && !tb.quien) {
        // Cae de lado: el cuerpo tendido, en rojo al principio, que se desvanece antes de que aparezca la cruz.
        const civ = m.civs.find(c => c.id === tb.c), col = civ ? civ.color : '#cccccc';
        g.globalAlpha = t < 600 ? 1 : 1 - (t - 600) / 300;
        const cae = Math.min(1, t / 160);
        if (cae < 1) { silueta(x, y - 1 + Math.round(cae * 3), t < 120 ? '#ff2a2a' : col); }
        else {
          g.fillStyle = '#1e1a24'; g.fillRect(x - 2.5, y + 2.5, 8, 3);
          g.fillStyle = t < 300 ? '#ff4b4b' : col; g.fillRect(x - 1, y + 3, 4, 2);
          g.fillStyle = '#f0c8a0'; g.fillRect(x + 3, y + 3, 1.5, 2);
          g.fillStyle = '#4a3a2e'; g.fillRect(x - 2, y + 3, 1, 2);
          g.fillStyle = '#9a1414'; g.fillRect(x, y + 5.5, 3, 0.5);
        }
        g.globalAlpha = 1;
        if (t < 600) continue;
      }
      if (tb.quien && tb.tipo === 'ahogado') continue;
      g.globalAlpha = t < 400 ? 1 : Math.max(0, 1 - (t - 400) / 8600);
      if (t < 400 && !tb.quien && tb.tipo !== 'batalla' && tb.tipo !== 'flecha' && tb.tipo !== 'torre' && tb.tipo !== 'lobo') { g.fillStyle = '#ff4b3a'; g.fillRect(x - 1, y - 1, 6, 7); }
      g.fillStyle = '#d8d8e0'; g.fillRect(x + 1, y, 1, 5); g.fillRect(x, y + 1, 3, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 5, 3, 1);
    }
    g.globalAlpha = 1;
  }
  function pintarCartel(ahora, dpr) {
    if (!cartel) return;
    const t = (ahora - cartel.inicio) / 3500;
    if (t >= 1) { cartel = null; return; }
    const tam = Math.round(20 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ancho = Math.min(cv.width - 24 * dpr, g.measureText(cartel.texto).width + 32 * dpr), x = cv.width / 2, y = 34 * dpr;
    g.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
    g.fillStyle = 'rgba(13,19,34,0.9)'; g.fillRect(x - ancho / 2, y - tam, ancho, tam * 2);
    g.fillStyle = '#f0c05a'; g.fillRect(x - ancho / 2, y + tam - 3 * dpr, ancho, 3 * dpr);
    g.fillText(cartel.texto, x, y, ancho - 16 * dpr);
    g.globalAlpha = 1;
  }
