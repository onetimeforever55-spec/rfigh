  // ── GÉNESIS · EL PINTOR · El día y la noche, las farolas, edificios que se mueven, barcos y asedios ──

  // ---------- El día y la noche: cada minuto y medio cae la noche y se encienden las ventanas ----------
  const DIA = 90000;
  let luces = [], lucesHasta = 0;
  // En las partidas pausadas la noche va con los turnos (el sexto de cada día); si no, con el reloj.
  function oscuridad(ahora) {
    if (reducido) return 0;
    if (m && V.pausada && V.pausada(m)) {
      const h = (m.turno % V.DIA_TURNOS) + Math.min(1, progreso() / V.TICKS), d = Math.min(Math.abs(h - 5.5), Math.abs(h + 0.5));
      return Math.max(0, Math.min(1, (1.15 - d) / 0.6));
    }
    const f = (ahora % DIA) / DIA; return Math.max(0, Math.min(1, (-Math.cos(f * Math.PI * 2) - 0.1) * 1.4)); }
  function noche(ahora, x0, y0, x1, y1, z, ox, oy) {
    ahora = performance.now();
    const o = oscuridad(ahora);
    if (o <= 0.02) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(10,16,48,' + (0.42 * o).toFixed(3) + ')'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(z, 0, 0, z, ox, oy);
    if (o < 0.3) return;
    const v = m.vida;
    if (ahora > lucesHasta) {
      lucesHasta = ahora + 1200; luces = [];
      const tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, ob = visto.obra[t]; if (ob === V.OBRA.casa || ob === V.OBRA.ayuntamiento || ob === V.OBRA.centro || ob === V.OBRA.templo || ob === V.OBRA.saber || ob === V.OBRA.campamento || ob === V.OBRA.palacio || ob === V.OBRA.fuente || (ob >= V.OBRA.central && ob <= V.OBRA.aerodromo)) luces.push(t); if (luces.length > 400) break; }
    }
    const a = Math.min(1, (o - 0.3) / 0.4);
    for (const t of luces) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, parpadeo = ((t * 7 + Math.floor(ahora / 900)) % 11) === 0;
      if (parpadeo) continue;
      // Con electricidad la luz de las ventanas es blanca; con aceite o gas, amarilla.
      const du = m.dueno[V.region(m, t)], cv_ = du >= 0 ? S.civ(m, du) : null, elec = cv_ && cv_.alumbrado === 'electrico';
      g.fillStyle = (elec ? 'rgba(220,230,255,' : 'rgba(255,190,80,') + (0.16 * a).toFixed(3) + ')'; g.fillRect(x + 1, y + 7, 14, 8);
      g.fillStyle = (elec ? 'rgba(245,248,255,' : 'rgba(255,220,120,') + (0.95 * a).toFixed(3) + ')'; g.fillRect(x + 4, y + 10, 2, 2); g.fillRect(x + 10, y + 10, 2, 2);
    }
  }

  // ---------- Las farolas de cada época, a lo largo de las calles (y su luz por la noche) ----------
  let farolasLista = [], farolasTurno = -1;
  function listaFarolas() {
    const v = m.vida, tw = v.tw, out = [], OB = V.OBRA;
    const junto = (t, set) => [t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < tw * v.th && set.has(visto.obra[n]));
    const PLAZAS = new Set([OB.fuente, OB.centro, OB.palacio, OB.ayuntamiento, OB.templo]), CASAS_ = new Set([OB.casa, OB.fuente, OB.centro, OB.palacio, OB.ayuntamiento, OB.templo, OB.saber, OB.granero, OB.parque, OB.central]);
    for (let t = 0; t < tw * v.th && out.length < 900; t++) {
      if (!visto.camino[t]) continue;
      const d = m.dueno[V.region(m, t)]; if (d < 0) continue;
      const c = S.civ(m, d), tipo = c && c.alumbrado; if (!tipo) continue;
      const h = (Math.imul(t, 2654435761) >>> 0) % 7;
      if (tipo === 'aceite' ? (junto(t, PLAZAS) && h < 3) : (junto(t, CASAS_) && h < 2) || (junto(t, PLAZAS) && h < 4)) out.push([t, tipo]);
    }
    return out;
  }
  function farolas(ahora, x0, y0, x1, y1) {
    if (farolasTurno !== m.turno) { farolasTurno = m.turno; farolasLista = listaFarolas(); }
    if (!farolasLista.length) return;
    const v = m.vida, o = oscuridad(ahora), luz = o > 0.25;
    for (const [t, tipo] of farolasLista) {
      const x = (t % v.tw) * P + 13, y = Math.floor(t / v.tw) * P + 2;
      if (x < x0 - 12 || y < y0 - 12 || x > x1 + 12 || y > y1 + 12) continue;
      if (luz) {
        const col = tipo === 'electrico' ? '235,240,255' : tipo === 'gas' ? '255,205,110' : '255,170,70', rr = tipo === 'electrico' ? 14 : tipo === 'gas' ? 10 : 7, lx = tipo === 'electrico' ? x - 4.5 : x + 0.5;
        const gr = g.createRadialGradient(lx, y + 2, 0, lx, y + 6, rr);
        gr.addColorStop(0, 'rgba(' + col + ',' + (0.42 * o).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.fillRect(lx - rr, y - rr + 4, rr * 2 + 1, rr * 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 12, 3, 1);
      if (tipo === 'electrico') {
        // Farola moderna: báculo gris con brazo curvo y luminaria.
        g.fillStyle = '#3a3e46'; g.fillRect(x + 1, y + 1, 1, 11);
        g.fillStyle = '#b4b8c0'; g.fillRect(x, y, 1, 12); g.fillRect(x - 3, y - 1, 4, 1); g.fillRect(x - 4, y, 1, 1);
        g.fillStyle = '#5a5e66'; g.fillRect(x - 6, y, 3, 1); g.fillRect(x - 1, y + 11, 3, 1);
        g.fillStyle = luz ? '#ffffff' : '#dce2ea'; g.fillRect(x - 6, y + 1, 3, 1);
        if (luz) { g.fillStyle = 'rgba(235,240,255,' + (0.18 * o).toFixed(3) + ')'; g.beginPath(); g.moveTo(x - 6, y + 2); g.lineTo(x - 3, y + 2); g.lineTo(x + 1, y + 13); g.lineTo(x - 10, y + 13); g.fill(); }
      } else if (tipo === 'gas') {
        // Farola victoriana de hierro: pie con basa, columna fina, farol de cuatro cristales y remate.
        g.fillStyle = '#1e2026'; g.fillRect(x, y + 3, 1, 9); g.fillRect(x - 1, y + 10, 3, 2); g.fillRect(x - 1, y + 5, 3, 1);
        g.fillStyle = '#1e2026'; g.fillRect(x - 1, y - 1, 3, 1); g.fillRect(x, y - 2, 1, 1); g.fillRect(x - 1, y + 2, 3, 1);
        g.fillStyle = luz ? '#ffe49a' : '#b8c4c4'; g.fillRect(x - 1, y, 3, 2);
        if (luz) { g.fillStyle = '#fff6d0'; g.fillRect(x, y, 1, 1); }
      } else {
        // Farol de aceite colgado de un poste de madera.
        g.fillStyle = '#5a3c20'; g.fillRect(x, y + 1, 1, 11); g.fillRect(x - 2, y + 1, 2, 1);
        g.fillStyle = '#2a2a2a'; g.fillRect(x - 3, y + 2, 2, 1);
        g.fillStyle = luz ? (Math.floor(ahora / 140 + t) % 5 ? '#ffb040' : '#ffd070') : '#8a7a5a'; g.fillRect(x - 3, y + 3, 2, 2);
      }
    }
  }
  // ---------- Edificios que se mueven: aspas de molino y banderas de torre ----------
  let especiales = [], especialesHasta = 0;
  // Los edificios tocados por obuses, granadas o bombas: tizne, grietas, un boquete y humo que sube.
  function danados(ahora, x0, y0, x1, y1) {
    const v = m.vida, d = v.danoObra; if (!d) return;
    for (const k in d) {
      const t = +k, x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      if (x + P < x0 || y + P < y0 || x > x1 || y > y1 || !v.obra[t] || v.obra[t] === V.OBRA.ruina) continue;
      const res = V.RESISTE[v.obra[t]] || 100, q = Math.min(1, d[k] / res), h = n => hash(t * 7 + n);
      g.fillStyle = 'rgba(30,24,20,' + (0.18 + q * 0.3).toFixed(2) + ')';
      for (let n = 0; n < 2 + Math.round(q * 4); n++) g.fillRect(x + 2 + h(n) * 10, y + 2 + h(n + 5) * 10, 3 + h(n + 9) * 3, 2 + h(n + 13) * 2);
      g.fillStyle = 'rgba(20,16,14,0.85)';
      for (let n = 0; n < 1 + Math.round(q * 3); n++) { let cx = x + 3 + h(n + 20) * 10, cy = y + 3 + h(n + 30) * 6; for (let s2 = 0; s2 < 4; s2++) { g.fillRect(Math.round(cx), Math.round(cy), 1, 1); cx += h(n * 4 + s2) > 0.5 ? 1 : -1; cy += 1; } }
      if (q > 0.45) { g.fillStyle = '#1a1412'; g.fillRect(x + 5 + h(40) * 5, y + 4 + h(41) * 5, 3, 2); }
      if (q > 0.3) { const f = ((ahora / 1400) + h(50)) % 1; g.fillStyle = 'rgba(70,64,60,' + (0.45 * (1 - f)).toFixed(2) + ')'; g.fillRect(x + 6 + f * 3, y + 2 - f * 12, 3 + f * 3, 3 + f * 2); }
    }
  }
  function edificiosVivos(ahora, x0, y0, x1, y1) {
    const v = m.vida;
    if (ahora > especialesHasta) {
      especialesHasta = ahora + 1000; especiales = [];
      const tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if (o === V.OBRA.molino || o === V.OBRA.torre || o === V.OBRA.castillo) especiales.push(t); }
    }
    const fase = ahora / 400;
    for (const t of especiales) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, o = visto.obra[t];
      const dueno = S.civ(m, m.dueno[V.region(m, t)]), fd = dueno ? V.fase(dueno.era) : 1;
      if (o === V.OBRA.molino && (fd === 0 || fd === 3)) continue; // el granero tribal y los silos no tienen aspas
      if (o === V.OBRA.molino) {
        // Cuatro aspas que giran.
        const cx = x + 8, cy = y + 6;
        for (let k = 0; k < 4; k++) { const ang = fase + k * Math.PI / 2; for (let d = 1; d <= 8; d++) { g.fillStyle = d > 3 ? '#f0e6cc' : '#7a5232'; g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), d > 3 ? 2 : 1, d > 3 ? 2 : 1); } }
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 1, cy - 1, 2, 2);
      } else if (o === V.OBRA.castillo) {
        // En guerra, los arqueros se asoman a las almenas (y tensan el arco por turnos).
        const c = S.civ(m, m.dueno[V.region(m, t)]);
        if (!c || !c.guerras.length) continue;
        for (const [ax, ay] of [[3, 3], [7, 0], [11, 3]]) {
          const tensa = Math.floor(ahora / 350 + ax) % 2;
          g.fillStyle = '#1e1a24'; g.fillRect(x + ax - 0.5, y + ay - 0.5, 3, 3.5);
          g.fillStyle = c.color; g.fillRect(x + ax, y + ay + 1.5, 2, 1.5);
          g.fillStyle = '#f0c8a0'; g.fillRect(x + ax + 0.5, y + ay, 1, 1.5);
          g.fillStyle = '#8a5a2b'; g.fillRect(x + ax + 2 + (tensa ? 0.5 : 0), y + ay - 0.5, 0.5, 3);
        }
      } else {
        const c = S.civ(m, m.dueno[V.region(m, t)]);
        if (!c) continue;
        g.fillStyle = '#3a2a1e'; g.fillRect(x + 8, y - 6, 1, 7);
        g.fillStyle = c.color; g.fillRect(x + 9, y - 6 + (Math.floor(ahora / 300) % 2), 5, 3);
      }
    }
  }
  // Los barcos, interpolando su travesía del turno.
  // Los naufragios: el barco escora, se hunde entre burbujas y astillas, y deja unos restos flotando.
  let naufragios = [];
  function pintarNaufragios(ahora) {
    naufragios = naufragios.filter(x => ahora - x.inicio < 4500);
    for (const x of naufragios) {
      const t = (ahora - x.inicio) / 4500; if (t < 0) continue;
      const [nx, ny, , tipo, clase] = x.n, px = nx * P + 4, py = ny * P + 4;
      if (!x.salpico) { x.salpico = 1; emitir(px + 10, py + 8, 14, { v: 30, g: 60, vida: 1200, cols: ['#e8f4ff', '#a8d0f0', '#ffffff'], tipo: 'solido', tam: 1, tamAzar: 1, dy: -25 }); emitir(px + 10, py + 6, 8, { v: 20, g: 50, vida: 1600, cols: ['#6a4a2a', '#4a3020', '#8a6a42'], tipo: 'solido', tam: 1.2, tamAzar: 1, dy: -18 }); }
      const img = tipo === 'guerra' ? ARTE().barco('guerra', clase || 'acorazado', x.color) : ARTE().barco(tipo === 'pesca' ? 'pesca' : 'mercante', x.era >= 6 ? 3 : grupoEra(x.era), x.color);
      const baja = Math.min(1, t * 1.4);
      g.save(); g.beginPath(); g.rect(px - 8, py - 12, 40, 26); g.clip();
      g.translate(px + 10, py + 10 + baja * 14); g.rotate(baja * 0.5); g.globalAlpha = 1 - Math.max(0, t - 0.6) * 2.5;
      g.drawImage(img, -10, -16); g.restore(); g.globalAlpha = 1;
      if (Math.random() < 0.4 * (1 - t)) emitir(px + 6 + Math.random() * 10, py + 12, 1, { v: 6, g: -20, vida: 700, cols: ['rgba(230,245,255,A)'], tipo: 'humo', tam: 1.5 });
      if (t > 0.6) { g.fillStyle = 'rgba(90,60,30,' + (1 - t).toFixed(2) + ')'; g.fillRect(px + 4, py + 12, 3, 1); g.fillRect(px + 12, py + 13, 4, 1); }
    }
  }
  function barcos(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    for (const b of v.barcos || []) {
      if (b.hundido) continue; // lo dibuja el naufragio
      const br = rVisto.get(b) || b.r;
      // En alta mar (fuera del mapa, entre dos mares) no se ve.
      if (b.x < 0 || (br && br.length >= 4 && (br[Math.min(br.length - 2, paso * 2)] < 0 || br[Math.min(br.length - 2, paso * 2 + 2)] < 0))) continue;
      let px = b.x * P, py = b.y * P;
      if (br && br.length >= 4) { const i = paso * 2, j = Math.min(br.length - 2, i + 2); px = (br[i] + (br[j] - br[i]) * f) * P; py = (br[i + 1] + (br[j + 1] - br[i + 1]) * f) * P; }
      if (px < x0 - 10 || py < y0 - 10 || px > x1 + 10 || py > y1 + 10) continue;
      px = Math.round(px + 4); py = Math.round(py + 4 + Math.sin(ahora / 500 + b.id) * 0.8);
      const c = S.civ(m, b.c), color = c ? c.color : '#ccc';
      // Barcos de su época (canoa, vela, galeón, vapor), del tamaño de una casa.
      const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(px - 4 + x * 2, py - 6 + y * 2, w * 2, h * 2); };
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px - 6, py + 12 + (Math.floor(ahora / 400 + b.id) % 2), 20, 1);
      // Desde la Revolución Industrial, los mercantes ya son vapores; en guerra, los acorazados.
      const fb = c ? (c.era >= 6 && b.tipo !== 'pesca' ? 3 : grupoEra(c.era)) : 1;
      const img = b.tipo === 'guerra' ? ARTE().barco('guerra', b.clase || 'acorazado', color) : ARTE().barco(b.tipo === 'pesca' ? 'pesca' : 'mercante', fb, color);
      const ida = br && br.length >= 4 ? Math.sign(br[Math.min(br.length - 2, paso * 2 + 2)] - br[paso * 2]) : 0;
      const izq = ida < 0 || (!ida && (b.izq || false)); if (ida) b.izq = ida < 0;
      g.save(); if (izq) { g.translate(px * 2 + 12, 0); g.scale(-1, 1); }
      g.drawImage(img, px - 4, py - 6);
      g.restore();
      // El transporte lleva a los soldados en cubierta (cabezas con el casco del color de su reino); el de colonos, gente con sombrero.
      if (b.tipo === 'transporte') { const n = Math.min(6, v.aldeanos.filter(a => a.aBordo === b.id).length); for (let q = 0; q < n; q++) { const cx = px + (izq ? 10 - q * 2.5 : -1 + q * 2.5), cy = py + 1 - (q % 2); g.fillStyle = '#f0c8a0'; g.fillRect(cx, cy + 1, 2, 2); g.fillStyle = b.colonia ? (q % 2 ? '#8a5a2b' : '#c9a066') : color; g.fillRect(cx, cy, 2, 1.2); } }
      // Ardiendo (flechas incendiarias) o tocado: llamas y humo negro; con poca vida, una columna de humo.
      const pvMax = b.tipo === 'guerra' ? (V.NAVAL[b.clase || 'acorazado'] || { pv: 120 }).pv : 40;
      if (b.ardiendo > 0 && Math.random() < 0.6) { emitir(px + 4 + Math.random() * 12, py + 2 + Math.random() * 4, 2, { v: 10, g: -30, vida: 500, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 1.4, tamAzar: 1 }); }
      if ((b.ardiendo > 0 || (b.pv != null && b.pv < pvMax * 0.5)) && Math.random() < 0.3) emitir(px + 8, py - 2, 1, { v: 8, g: -10, vida: 2200, cols: ['rgba(30,26,24,A)', 'rgba(70,64,60,A)'], tipo: 'humo', tam: 4, tamAzar: 1 });
      // El mercante lleva su carga a la vista en cubierta: fardos del color de lo que transporta.
      if (b.tipo === 'mercante' && b.carga) {
        const COL = { comida: '#e8d08a', madera: '#8a5a2c', piedra: '#a8a49a', metal: '#b8c4d0', armas: '#6a6a74', carbon: '#2a2a2e', petroleo: '#3a3020', muebles: '#c8925a', vehiculos: '#5a6a4a', semillas: '#c8a86a', granadas: '#3e4a2a' };
        const cc = COL[b.carga.que] || '#c8a070', n = Math.min(4, 2 + Math.floor(b.carga.n / 15));
        for (let q = 0; q < n; q++) { const cx = px + (izq ? 9 - q * 4 : -1 + q * 4), cy = py + 2 - (q % 2); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(cx - 0.5, cy - 0.5, 4, 4); g.fillStyle = cc; g.fillRect(cx, cy, 3, 3); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx, cy, 3, 0.7); }
      }
      // Humo de los vapores y arrastreros.
      if (c && fb === 3) { for (let q = 0; q < 3; q++) { const f = ((ahora / 1200) + q / 3) % 1; g.fillStyle = 'rgba(80,80,80,' + (0.5 * (1 - f)).toFixed(2) + ')'; g.fillRect(px + (izq ? 6 : 4) + (b.tipo === 'pesca' ? 4 : 0) - f * 6 * (izq ? -1 : 1), py - 6 - f * 10, 2 + f * 3, 2 + f * 3); } }
      if (b.tipo === 'pesca' && Math.floor(ahora / 700 + b.id) % 3 === 0) { r(8, 5, 2, 1, '#c8d4dc'); }
    }
  }
  // Las plazas sitiadas: espadas cruzadas y el porcentaje de captura.
  function asedios(ahora) {
    const v = m.vida, R = V.SUB * P;
    for (const id of Object.keys(v.ejercitos || {})) {
      const e = v.ejercitos[id];
      if (!e.asedio || e.asedio <= 0) continue;
      const x = (e.obj % m.W) * R + R / 2, y = Math.floor(e.obj / m.W) * R - 2;
      const c = S.civ(m, +id);
      g.fillStyle = 'rgba(13,19,34,0.85)'; g.fillRect(x - 9, y - 9, 18, 11);
      g.fillStyle = '#e8ecf4';
      for (let d = 0; d < 5; d++) { g.fillRect(x - 6 + d, y - 7 + d, 1, 1); g.fillRect(x - 2 - d, y - 7 + d, 1, 1); }
      g.fillStyle = '#7a5232'; g.fillRect(x - 7, y - 2, 2, 1); g.fillRect(x - 3, y - 2, 2, 1);
      g.fillStyle = '#2a3550'; g.fillRect(x, y - 6, 8, 3);
      g.fillStyle = c ? c.color : '#ff4b3a'; g.fillRect(x, y - 6, Math.round(8 * e.asedio / 100), 3);
      if (Math.floor(ahora / 400) % 2) { g.fillStyle = '#ff4b3a'; g.fillRect(x - 9, y + 2, 18, 1); }
      // La plaza sitiada arde: llamas y humo sobre algunas casas.
      let ardiendo = 0;
      for (const t of V.parcelas(m, e.obj)) {
        const ob = visto.obra[t];
        if (ardiendo >= Math.ceil(e.asedio / 30) || !(ob === V.OBRA.casa || ob === V.OBRA.ayuntamiento || ob === V.OBRA.centro)) continue;
        ardiendo++;
        const fx = (t % v.tw) * P, fy = Math.floor(t / v.tw) * P;
        for (let k = 0; k < 7; k++) {
          const f = ((ahora / 500) + k / 7) % 1, cx = fx + 3 + ((k * 5 + t) % 10);
          g.fillStyle = f < 0.4 ? '#ffd23a' : f < 0.7 ? '#ff7a1a' : '#c8301a';
          g.fillRect(Math.round(cx + Math.sin(ahora / 120 + k) * 1.5), Math.round(fy + 8 - f * 10), 2, 2);
          g.fillStyle = 'rgba(70,70,80,' + (0.45 * (1 - f)).toFixed(2) + ')';
          g.fillRect(Math.round(cx - 1 + Math.sin(f * 4 + k) * 3), Math.round(fy - 2 - f * 18), 3, 3);
        }
      }
    }
  }
