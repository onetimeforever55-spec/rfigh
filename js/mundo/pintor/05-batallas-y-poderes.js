  // ── GÉNESIS · EL PINTOR · Las batallas, los nombres y los poderes del dios a la vista ──

  // ---------- Las batallas: dónde se está luchando, para que no pasen sin verse ----------
  // Se agrupan los golpes y las muertes en combate del turno por zonas de 10×10 parcelas; una batalla dura en
  // pantalla un par de turnos después del último golpe.
  let batallas = [];
  // Las langostas: una nube de puntos oscuros que barre los campos del pueblo durante unos segundos.
  const plagasVistas = new WeakSet(); let plagasAnim = [];
  function pintarPlagas(ahora, x0, y0, x1, y1) {
    plagasAnim = plagasAnim.filter(p_ => ahora - p_.inicio < 6000);
    const R = V.SUB * P;
    for (const p_ of plagasAnim) {
      const f = (ahora - p_.inicio) / 6000, a = f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1;
      for (const r of p_.regiones) {
        const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R;
        if (rx + R < x0 || ry + R < y0 || rx > x1 || ry > y1) continue;
        g.fillStyle = 'rgba(40,36,20,' + (0.8 * a).toFixed(2) + ')';
        for (let i = 0; i < 70; i++) {
          const fase = ahora / 700 + i * 2.3, cx = rx + R / 2 + Math.sin(fase + r) * R * 0.45 + Math.sin(i * 7.1) * R * 0.25, cy = ry + R / 2 + Math.cos(fase * 1.3 + i) * R * 0.35 + Math.cos(i * 3.7) * R * 0.2;
          g.fillRect(Math.round(cx), Math.round(cy), 1, 1);
        }
      }
    }
  }
  function buscarBatallas() {
    const v = m.vida, tw = v.tw, zonas = new Map(), Z = 10;
    const pon = (x, y, peso, civ) => { const k = Math.floor(x / Z) + ',' + Math.floor(y / Z); const b = zonas.get(k) || zonas.set(k, { x: 0, y: 0, n: 0, golpes: 0, muertos: 0, civs: new Set() }).get(k); b.x += x * peso; b.y += y * peso; b.n += peso; if (civ != null) b.civs.add(civ); return b; };
    const porId = new Map(v.aldeanos.map(a => [a.id, a]));
    for (const gp of v.golpes || []) { const vic = porId.get(gp[0]); pon(gp[2], gp[3], 1, vic ? vic.c : null).golpes++; }
    for (const mu of v.muertos || []) if (['batalla', 'flecha', 'obus', 'bomba', 'torre'].includes(mu[3])) pon(mu[0], mu[1], 2, mu[2]).muertos++;
    const nuevas = [];
    for (const b of zonas.values()) if (b.golpes + b.muertos * 2 >= 3) nuevas.push({ tx: b.x / b.n, ty: b.y / b.n, fuerza: b.golpes + b.muertos * 3, muertos: b.muertos, civs: [...b.civs], turno: m.turno });
    // Se juntan con las del turno anterior que están cerca (la misma batalla sigue).
    for (const viejo of batallas) if (m.turno - viejo.turno < 2 && !nuevas.some(n => Math.hypot(n.tx - viejo.tx, n.ty - viejo.ty) < Z)) nuevas.push(viejo);
    batallas = nuevas.sort((a, b) => b.fuerza - a.fuerza).slice(0, 12);
  }
  function listaBatallas() { return batallas.filter(b => m.turno - b.turno < 2); }
  function pintarBatallas(ahora, z, ox, oy, dpr) {
    if (!m || !batallas.length) return;
    // Lo que tapa el panel lateral (en el escritorio) y las barras: las flechas quedan dentro de lo visible.
    const panelAbierto = !document.body.classList.contains('sin-panel') && window.innerWidth >= 900;
    const W = cv.width - (panelAbierto ? 420 * dpr : 0), H = cv.height - (window.innerWidth < 900 ? 170 * dpr : 0), margen = 40 * dpr, arriba = 90 * dpr;
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    for (const b of listaBatallas()) {
      const wx = b.tx * P + 8, wy = b.ty * P + 8, sx = wx * z + ox, sy = wy * z + oy, viva = b.turno === m.turno, f = (ahora % 1200) / 1200;
      const dentro = sx > 0 && sy > arriba && sx < W && sy < H;
      if (dentro) {
        // Un aro rojo que late y un par de espadas cruzadas encima del combate.
        const r = (22 + Math.min(30, b.fuerza * 1.5)) * dpr * Math.max(0.7, Math.min(1.6, z / 3));
        for (const d of [0, 0.5]) { const ff = (f + d) % 1; g.strokeStyle = 'rgba(255,70,50,' + ((viva ? 0.9 : 0.4) * (1 - ff)).toFixed(2) + ')'; g.lineWidth = 4 * dpr; g.beginPath(); g.arc(sx, sy, r * (0.5 + ff * 0.8), 0, Math.PI * 2); g.stroke(); }
        espadas(sx, sy - r - 16 * dpr, 2 * dpr, viva, b);
        // Etiqueta: «BATALLA» y las bajas.
        g.font = 'bold ' + Math.round(11 * dpr) + 'px monospace'; g.textAlign = 'center';
        const txt = (viva ? '⚔ BATALLA' : 'batalla') + (b.muertos ? ' · ' + b.muertos + ' caídos' : ''), w = g.measureText(txt).width + 10 * dpr;
        g.fillStyle = 'rgba(5,7,14,0.85)'; g.fillRect(sx - w / 2, sy - r - 50 * dpr, w, 15 * dpr);
        g.fillStyle = viva ? '#ff7a66' : '#c8a090'; g.fillText(txt, sx, sy - r - 39 * dpr);
      } else {
        // Fuera de la pantalla: una flecha en el borde que apunta hacia la batalla.
        const cx = W / 2, cy = (H + arriba) / 2, ang = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((W / 2 - margen) / Math.max(1e-6, Math.abs(Math.cos(ang))), ((H - arriba) / 2 - margen) / Math.max(1e-6, Math.abs(Math.sin(ang))));
        const px_ = cx + Math.cos(ang) * k, py_ = cy + Math.sin(ang) * k;
        g.save(); g.translate(px_, py_); g.rotate(ang);
        const late = 1 + 0.15 * Math.sin(ahora / 150);
        g.scale(late, late);
        g.fillStyle = 'rgba(5,7,14,0.9)'; g.fillRect(-20 * dpr, -15 * dpr, 42 * dpr, 30 * dpr);
        g.fillStyle = viva ? '#ff5a46' : '#b05a4a';
        g.beginPath(); g.moveTo(20 * dpr, 0); g.lineTo(8 * dpr, -11 * dpr); g.lineTo(8 * dpr, 11 * dpr); g.closePath(); g.fill();
        g.restore();
        espadas(px_ - Math.cos(ang) * 6 * dpr, py_ - Math.sin(ang) * 6 * dpr, 1.2 * dpr, viva, null);
      }
    }
    function espadas(x, y, e, viva, b) {
      g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(e, e);
      if (b) { g.fillStyle = 'rgba(5,7,14,0.85)'; g.fillRect(-13, -11, 26, 22); g.fillStyle = viva ? '#ff5a46' : '#8a4a40'; g.fillRect(-13, 9, 26, 2); }
      for (const s of [1, -1]) {
        g.fillStyle = '#e8ecf4'; for (let k = -7; k <= 5; k++) g.fillRect(s * k - 1, k - 1, 2, 2);
        g.fillStyle = '#c8a040'; g.fillRect(s * 4 - 3, 4, 6, 2); g.fillStyle = '#6a4220'; g.fillRect(s * 6 - 1, 6, 2, 3);
      }
      if (b && b.civs.length) b.civs.slice(0, 2).forEach((id, i) => { g.fillStyle = color[id] || '#ccc'; g.fillRect(i ? 7 : -11, -9, 4, 4); });
      g.restore();
    }
  }
  function nombres(z, ox, oy, dpr) {
    if (cam.z < zMin() * 1.15 && S.vivas(m).length > 6) return;
    // Las ciudades, más pequeñas, cuando te acercas.
    if (cam.z >= 1.3) {
      const tc = Math.round(10 * dpr);
      g.font = '400 ' + tc + 'px "Pixelify Sans", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const x of m.ciudades || []) {
        const c = S.civ(m, x.civ);
        if (!c || !c.viva) continue;
        const wx = (x.region % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(x.region / m.W) * V.SUB * P + P * 1.6;
        const sx = ox + wx * z, sy = oy + wy * z;
        const ancho = g.measureText(x.nombre).width + 8 * dpr;
        g.fillStyle = 'rgba(13,19,34,0.7)'; g.fillRect(sx - ancho / 2, sy - tc * 0.7, ancho, tc * 1.4);
        g.fillStyle = c.color; g.fillRect(sx - ancho / 2, sy - tc * 0.7, 2 * dpr, tc * 1.4);
        g.fillStyle = '#e8e0c8'; g.fillText(x.nombre, sx, sy);
      }
    }
    // Los letreros de los gremios y de los bancos privados, de madera con letras doradas, cuando te acercas.
    if (cam.z >= 2.4 && m.vida && m.vida.privados) {
      const v = m.vida, tl = Math.round(9 * dpr);
      g.font = '600 ' + tl + 'px "Pixelify Sans", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const t of Object.keys(v.privados)) {
        if (v.obra[t] !== V.OBRA.gremio && v.obra[t] !== V.OBRA.bancopriv) continue;
        const rec = v.edificios && v.edificios[t], texto = rec && rec.nombre ? rec.nombre.replace(/^Gremio de mercaderes /, 'Gremio ') : v.obra[t] === V.OBRA.bancopriv ? 'Banco' : 'Gremio';
        const wx = (t % v.tw) * P + P / 2, wy = Math.floor(t / v.tw) * P - 3;
        const sx = ox + wx * z, sy = oy + wy * z, ancho = g.measureText(texto).width + 8 * dpr, alto = tl * 1.5;
        if (sx < -ancho || sy < -alto || sx > g.canvas.width + ancho || sy > g.canvas.height + alto) continue;
        g.fillStyle = '#3a2412'; g.fillRect(sx - ancho / 2 - dpr, sy - alto / 2 - dpr, ancho + 2 * dpr, alto + 2 * dpr);
        g.fillStyle = '#8a5a2b'; g.fillRect(sx - ancho / 2, sy - alto / 2, ancho, alto);
        g.fillStyle = '#a06a34'; g.fillRect(sx - ancho / 2, sy - alto / 2, ancho, dpr);
        g.fillStyle = '#f0c040'; g.fillText(texto, sx, sy + dpr * 0.5);
      }
    }
    const tam = Math.round(12 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of S.vivas(m)) {
      const r = c.capital, wx = (r % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(r / m.W) * V.SUB * P + P * 0.6;
      const sx = ox + wx * z, sy = oy + wy * z - 10 * dpr;
      const texto = (c.jugador ? '★ ' : '') + c.nombre + (c.guerras.length ? ' ⚔' : '');
      const anchoT = g.measureText(texto).width + 10 * dpr;
      g.fillStyle = 'rgba(13,19,34,0.82)'; g.fillRect(sx - anchoT / 2, sy - tam * 0.75, anchoT, tam * 1.5);
      g.fillStyle = c.color; g.fillRect(sx - anchoT / 2, sy + tam * 0.75 - 2 * dpr, anchoT, 2 * dpr);
      g.fillStyle = c.jugador || sel === c.id ? '#f0c05a' : '#fff6dc'; g.fillText(texto, sx, sy);
    }
  }

  function marcar(region, color) {
    if (region == null || reducido) return;
    pulso = { region, color: color || '#fff6dc', inicio: performance.now() };
  }
  function marcarPulso(ahora) {
    if (!pulso) return;
    const t = (ahora - pulso.inicio) / 1600;
    if (t >= 1) { pulso = null; return; }
    const R = V.SUB * P, x = (pulso.region % m.W) * R + R / 2, y = Math.floor(pulso.region / m.W) * R + R / 2, s = R * (0.6 + t * 2.4);
    g.strokeStyle = pulso.color; g.globalAlpha = 1 - t; g.lineWidth = 2 / cam.z * 1.5;
    g.strokeRect(x - s, y - s, s * 2, s * 2);
    g.globalAlpha = 1;
  }

  // ---------- Los poderes del dios, a la vista ----------
  const DURACION = 3200;
  const ESTILO = {
    plaga: { tinte: '#7dff6a', particula: ['#9cff7a', '#4fcf3a'], sube: true },
    hambre: { tinte: '#c9a13a', particula: ['#8a6a2a', '#d9b45a'], sube: false },
    diluvio: { tinte: '#3a8cff', particula: ['#9cc8ff', '#5aa0ff'], lluvia: true },
    terremoto: { tinte: '#8a5a2a', particula: ['#b08050', '#6a4a2a'], sube: true },
    incendio: { tinte: '#ff6a1a', particula: ['#ffd23a', '#ff5a1a', '#c8301a'], sube: true, fuego: true },
    destruir: { tinte: '#ff2a2a', particula: ['#ffe9a6', '#ff4b3a'], rayos: true, sube: true },
    matar: { tinte: '#5a0a1a', particula: ['#ff4b3a', '#2a0a10'], rayos: true },
    oro: { tinte: '#f0c05a', particula: ['#ffe17a', '#f0c05a', '#fff6dc'], lluvia: true },
    guerra: { tinte: '#ff4b3a', particula: ['#ff4b3a', '#e8ecf4'], sube: true },
    nuevo: { tinte: '#fff6dc', particula: ['#ffffff', '#f0c05a'], sube: true, haz: true },
    bueno: { tinte: '#f0c05a', particula: ['#fff6dc', '#ffe17a', '#9cff7a'], sube: true }
  };
  function efecto(tipo, ids, titulo) {
    if (!m) return;
    const regiones = new Set();
    const civs = (ids || []).map(id => S.civ(m, id)).filter(Boolean);
    for (const c of civs) {
      for (const r of S.casillas(m, c)) regiones.add(r);
      // Lo que se perdió alrededor de la capital (un terremoto, una destrucción) también se ve.
      for (let r = 0; r < m.W * m.H; r++) if (S.distancia(r, c.capital) <= 2 && S.esTierra(m, r)) regiones.add(r);
    }
    const estilo = ESTILO[tipo] ? tipo : 'bueno';
    efectos.push({ tipo: estilo, regiones: [...regiones], inicio: performance.now() });
    if (efectos.length > 6) efectos.shift();
    if (titulo) cartel = { texto: titulo, inicio: performance.now() };
    // La cámara va a mirar.
    if (civs[0] && !visible(civs[0].capital)) centrarEn(civs[0].capital);
  }
  function visible(region) {
    const { w, h } = vista(), R = V.SUB * P;
    const x = (region % m.W) * R + R / 2, y = Math.floor(region / m.W) * R + R / 2;
    return Math.abs(x - cam.x) < w / cam.z / 2 - R && Math.abs(y - cam.y) < h / cam.z / 2 - R;
  }
  const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function pintarEfectos(ahora, x0, y0, x1, y1) {
    const R = V.SUB * P;
    efectos = efectos.filter(e => ahora - e.inicio < DURACION);
    for (const e of efectos) {
      const t = (ahora - e.inicio) / DURACION, st = ESTILO[e.tipo];
      const fuerza = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      for (const r of e.regiones) {
        const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R;
        if (rx + R < x0 || ry + R < y0 || rx > x1 || ry > y1) continue;
        g.globalAlpha = 0.28 * fuerza * (0.75 + 0.25 * Math.sin(ahora / 120 + r));
        g.fillStyle = st.tinte; g.fillRect(rx, ry, R, R);
        g.globalAlpha = Math.min(1, fuerza * 1.4);
        const n = st.fuego ? 10 : 6;
        for (let k = 0; k < n; k++) {
          const sem = r * 31 + k * 7, fx = hash(sem) * R, vel = 0.5 + hash(sem + 1);
          let fy;
          if (st.lluvia) fy = ((hash(sem + 2) * R + (ahora / 6) * vel) % R);
          else if (st.sube) fy = R - ((hash(sem + 2) * R + (ahora / 14) * vel) % R);
          else fy = hash(sem + 2) * R;
          g.fillStyle = st.particula[(k + Math.floor(ahora / 90)) % st.particula.length];
          if (st.lluvia && e.tipo === 'diluvio') g.fillRect(rx + fx, ry + fy, 1, 3);
          else if (st.fuego) { const s = 1 + Math.floor(hash(sem + Math.floor(ahora / 80)) * 2); g.fillRect(rx + fx, ry + fy, s, s + 1); }
          else g.fillRect(rx + fx, ry + fy, 1, 1);
        }
      }
      // Rayos sobre la capital, un haz de luz para un pueblo nuevo.
      if ((st.rayos || st.haz) && e.regiones.length) {
        const r0 = e.regiones[0];
        for (let k = 0; k < 3; k++) {
          if (st.rayos && hash(k + Math.floor(ahora / 140)) > 0.45) continue;
          const r = e.regiones[Math.floor(hash(k * 13 + Math.floor(ahora / 400)) * e.regiones.length)] || r0;
          const cx = (r % m.W) * R + R / 2, cy = Math.floor(r / m.W) * R + R / 2;
          g.globalAlpha = fuerza;
          if (st.haz) { g.fillStyle = 'rgba(255,246,220,0.35)'; g.fillRect(cx - 4, cy - 200, 8, 200); g.fillStyle = '#fff6dc'; g.fillRect(cx - 1, cy - 200, 2, 200); break; }
          g.fillStyle = '#fff6dc';
          let x = cx, y = cy - 90;
          while (y < cy) { const nx = x + (hash(y * 3 + k + Math.floor(ahora / 140)) - 0.5) * 8; g.fillRect(Math.min(x, nx), y, Math.abs(nx - x) + 1, 1); g.fillRect(nx, y, 1, 6); x = nx; y += 6; }
          g.fillStyle = '#ff4b3a'; g.fillRect(cx - 3, cy - 1, 7, 3);
        }
      }
      g.globalAlpha = 1;
    }
  }
