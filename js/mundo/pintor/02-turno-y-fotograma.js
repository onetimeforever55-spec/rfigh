  // ── GÉNESIS · EL PINTOR · Un turno nuevo y cada fotograma ──

  // ---------- Un turno nuevo: dejar al día lo pintado y preparar la animación ----------
  function aplicar(hasta) {
    let quedan = 0;
    for (const ch of pend) {
      if (ch[4] > hasta || ch.hecho) { if (!ch.hecho) quedan++; continue; }
      const capaN = ch[0] === 0 ? 'arbol' : ch[0] === 1 ? 'roca' : ch[0] === 2 ? 'obra' : ch[0] === 4 ? 'cultivo' : ch[0] === 5 ? 'camino' : null;
      if (capaN) { if (capaN === 'obra' && ch[3] === V.OBRA.ruina && ch[2] && ch[4] > 0) polvo(ch[1], true); visto[capaN][ch[1]] = ch[3]; parcela(ch[1]); if (capaN === 'camino') vecinasCamino(ch[1]); if (capaN === 'obra' && [V.OBRA.fuente, V.OBRA.palacio].some(o => o === ch[3] || o === ch[2])) vecinasPlaza(ch[1]); }
      ch.hecho = true;
    }
    if (!quedan) pend = [];
  }
  // Compara lo pintado con el mundo (menos los cambios de este turno, que se irán aplicando) y repinta lo distinto.
  function sincronizar(cambios) {
    const v = m.vida, n = v.tw * v.th;
    aplicar(Infinity);
    // Se ha descubierto carbón o petróleo: se repinta todo una vez (las vetas negras y las manchas de crudo).
    if ((v.subsueloVer || 0) !== subVisto) { subVisto = v.subsueloVer || 0; for (let t = 0; t < n; t++) parcela(t); }
    const antes = { arbol: v.arbol.slice(), roca: v.roca.slice(), obra: v.obra.slice(), cultivo: (v.cultivo || []).slice(), camino: (v.camino || []).slice() };
    for (let k = cambios.length - 1; k >= 0; k--) { const [c, t, a] = cambios[k]; if (c <= 2 || c === 4 || c === 5) antes[c === 0 ? 'arbol' : c === 1 ? 'roca' : c === 2 ? 'obra' : c === 4 ? 'cultivo' : 'camino'][t] = a; }
    const ter = V.terrenos(m), nf = firmas(), cambiadas = new Set(), caminosTocados = [];
    for (let r = 0; r < nf.length; r++) if (nf[r] !== firma[r]) cambiadas.add(r);
    firma = nf;
    for (let t = 0; t < n; t++) {
      let distinto = false;
      if (ter[t] !== tierra[t]) { tierra[t] = ter[t]; distinto = true; }
      for (const c of ['arbol', 'roca', 'obra', 'cultivo', 'camino']) if ((visto[c][t] || 0) !== (antes[c][t] || 0)) { visto[c][t] = antes[c][t]; distinto = true; if (c === 'camino') caminosTocados.push(t); }
      if (!distinto && visto.obra[t] && visto.obra[t] !== V.OBRA.campo && cambiadas.has(V.region(m, t))) distinto = true;
      if (distinto) parcela(t);
    }
    for (const t of caminosTocados) vecinasCamino(t);
    pend = cambios.map(c => c.slice());
  }
  function turno(mundoActual, ms) {
    if (mundoActual !== m || !listo) { mundo(mundoActual); }
    // El recorrido del turno anterior de cada aldeano: cada uno va con su propio desfase (ver aldeanos()).
    for (const a of m.vida.aldeanos) { const r0 = rVisto.get(a); if (r0 && r0 !== a.r) rAntes.set(a, r0); rVisto.set(a, a.r); }
    // Lo que se dibuja es el recorrido de este turno, aunque el siguiente ya se esté calculando por partes.
    for (const b of (m.vida.animales || []).concat(m.vida.barcos || [])) rVisto.set(b, b.r);
    sincronizar(m.vida.cambios || []);
    gente = m.vida.aldeanos.slice();
    inicio = performance.now(); duracion = Math.max(80, ms || 1000);
    vistos = new Set();
    recogerMuertos(duracion);
    for (const n of m.vida.naufragios || []) naufragios.push({ n, inicio: performance.now() + (n[2] / V.TICKS) * duracion, color: (S.civ(m, n[5]) || {}).color || '#ccc', era: (S.civ(m, n[5]) || { era: 0 }).era });
    buscarBatallas();
    for (const p_ of m.vida.plagas || []) if (p_.turno === m.turno && !plagasVistas.has(p_)) { plagasVistas.add(p_); plagasAnim.push({ regiones: p_.regiones, inicio: performance.now() }); }
    // El territorio se repinta en el fotograma siguiente: así el cálculo del turno no se junta en un solo tirón.
    if (!territorioPendiente) { territorioPendiente = true; setTimeout(() => { territorioPendiente = false; if (m && listo) territorio(); }, 16); }
  }
  // Tras un poder del dios (fuera del turno): todo al día, sin animación.
  function refrescar() {
    if (!m) return;
    sincronizar([]);
    territorio();
    recogerMuertos();
  }
  // Quien muere durante el turno sigue en pie (y peleando) hasta el paso en que cae; luego, su caída.
  let caidos = [];
  // La gente tal como estaba al empezar el turno que se ve: mientras se anima, el siguiente ya se calcula por partes,
  // y quien muera en él no debe esfumarse antes de tiempo (se le ve hasta el final y luego cae en su turno).
  let gente = null;
  function recogerMuertos(dur) {
    const ahora = performance.now();
    caidos = [];
    for (const [x, y, c, tipo, paso, quien] of (m.vida.muertos || [])) {
      if (quien && paso) caidos.push({ a: quien, paso, animal: tipo === 'animal' });
      tumbas.push({ x, y, c, tipo, quien: quien || null, inicio: ahora + (paso ? (paso / V.TICKS) * (dur || 1000) : Math.random() * 500) });
    }
    m.vida.muertos = [];
    if (tumbas.length > 400) tumbas = tumbas.slice(-400);
  }

  // ---------- Cada fotograma ----------
  function progreso() {
    if (reducido) return V.TICKS;
    return Math.max(0, Math.min(1, (performance.now() - inicio) / duracion)) * V.TICKS;
  }
  function fotograma(ahora) {
    requestAnimationFrame(fotograma);
    // (Con la tarjeta gráfica, lo dibujado se manda en lotes: al terminar el fotograma se manda lo que quede.)
    try { dibujarFotograma(ahora); } finally { if (g && g.fin) g.fin(); }
  }
  function dibujarFotograma(ahora) {
    if (!m || !listo) return;
    medirRitmo(ahora);
    const k = progreso();
    if (pend.length) aplicar(Math.floor(k));
    const { w, h, dpr } = vista();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b1830'; g.fillRect(0, 0, cv.width, cv.height);
    const temblor = efectos.find(e => e.tipo === 'terremoto' && ahora - e.inicio < 1400);
    const sacudir = temblor && !reducido ? (Math.sin(ahora / 22) * 5 + Math.sin(ahora / 37) * 3) * dpr * (1 - (ahora - temblor.inicio) / 1400) : 0;
    const z = cam.z * dpr, ox = cv.width / 2 - cam.x * z + sacudir, oy = cv.height / 2 - cam.y * z - sacudir * 0.6;
    g.imageSmoothingEnabled = false;
    g.setTransform(z, 0, 0, z, ox, oy);
    // Solo lo que se ve.
    const x0 = Math.max(0, Math.floor(cam.x - w / cam.z / 2) - P), y0 = Math.max(0, Math.floor(cam.y - h / cam.z / 2) - P);
    const x1 = Math.min(ancho(), Math.ceil(cam.x + w / cam.z / 2) + P), y1 = Math.min(alto(), Math.ceil(cam.y + h / cam.z / 2) + P);
    // El suelo y las obras están pintados a escala de arte (A): se amplían al mundo (P).
    g.drawImage(lienzo, x0 / E, y0 / E, (x1 - x0) / E, (y1 - y0) / E, x0, y0, x1 - x0, y1 - y0);
    const ec = P / CA;
    g.drawImage(capa, x0 / ec, y0 / ec, (x1 - x0) / ec, (y1 - y0) / ec, x0, y0, x1 - x0, y1 - y0);
    if (!ligero) huellas(k, ahora, x0, y0, x1, y1);
    banderas(ahora);
    agua(ahora, x0, y0, x1, y1);
    barcos(k, ahora, x0, y0, x1, y1);
    pintarNaufragios(ahora);
    animales(k, ahora, x0, y0, x1, y1);
    edificiosVivos(ahora, x0, y0, x1, y1);
    danados(ahora, x0, y0, x1, y1);
    if (civPorId.size) { vias(x0, y0, x1, y1, ahora); trincheras(x0, y0, x1, y1); corrales(x0, y0, x1, y1); murallas(x0, y0, x1, y1); if (!reducido && !ligero) trafico(ahora, x0, y0, x1, y1); }
    andamios(ahora, x0, y0, x1, y1);
    progresos(x0, y0, x1, y1);
    if (!ligero) humo(ahora, x0, y0, x1, y1);
    aldeanos(k, ahora, x0, y0, x1, y1);
    pintarDisparos(k);
    eventosParticulas(k, x0, y0, x1, y1);
    llamas(k, ahora, x0, y0, x1, y1);
    sucesosMapa(ahora, x0, y0, x1, y1);
    pintarParticulas(ahora);
    if (plagasAnim.length) pintarPlagas(ahora, x0, y0, x1, y1);
    if (!ligero) { gestos(k, ahora); pintarPolvo(ahora); }
    pintarTumbas(ahora);
    pintarEfectos(ahora, x0, y0, x1, y1);
    asedios(ahora);
    nieve(ahora, x0, y0, x1, y1);
    estaciones(ahora, x0, y0, x1, y1);
    if (!ligero) { pajaros(ahora, x0, y0, x1, y1); nubes(ahora, x0, y0, x1, y1); }
    pintarAviones(k);
    marcarPulso(ahora);
    planos(ahora);
    noche(ahora, x0, y0, x1, y1, z, ox, oy);
    farolas(ahora, x0, y0, x1, y1);
    if (!ligero) sueno(ahora, x0, y0, x1, y1);
    resplandor(k, ahora, x0, y0, x1, y1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    nombres(z, ox, oy, dpr);
    pintarBatallas(ahora, z, ox, oy, dpr);
    avisoCorte(ahora, z, ox, oy, dpr);
    pintarAnuncios(z, ox, oy, dpr, performance.now());
    pintarCartel(ahora, dpr);
    if (tropas) pintarTropas(ahora, z, ox, oy, dpr);
  }
  // El recuadro de selección y la bandera del sitio al que van las tropas.
  let destino = null;
  function marcarDestino(t) { destino = { t, desde: performance.now() }; }
  function pintarTropas(ahora, z, ox, oy, dpr) {
    if (caja) { const rect = cv.getBoundingClientRect(); const x = (Math.min(caja.x0, caja.x1) - rect.left) * dpr, y = (Math.min(caja.y0, caja.y1) - rect.top) * dpr, w = Math.abs(caja.x1 - caja.x0) * dpr, h = Math.abs(caja.y1 - caja.y0) * dpr; g.fillStyle = 'rgba(109,255,122,0.12)'; g.fillRect(x, y, w, h); g.strokeStyle = '#6dff7a'; g.lineWidth = 1.5 * dpr; g.strokeRect(x, y, w, h); }
    if (destino && ahora - destino.desde < 1600) {
      const v = m.vida, x = ((destino.t % v.tw) * P + P / 2) * z + ox, y = (Math.floor(destino.t / v.tw) * P + P / 2) * z + oy, f = (ahora - destino.desde) / 1600;
      g.strokeStyle = 'rgba(109,255,122,' + (1 - f).toFixed(2) + ')'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, (6 + 14 * f) * dpr, 0, Math.PI * 2); g.stroke();
    }
  }

  function banderas(ahora) {
    const fase = Math.floor(ahora / 260) % 2;
    for (const c of S.vivas(m)) {
      // El gobernante pasea delante de su palacio, con capa del color de su pueblo y corona.
      const R = V.SUB * P, rx = (c.capital % m.W) * R, ry = Math.floor(c.capital / m.W) * R;
      const kx = Math.round(rx + R / 2 - 1 + Math.sin(ahora / 1100 + c.id) * 8), ky = ry + P * 3 + 4;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(kx - 1, ky + 6, 5, 1);
      g.fillStyle = '#3a2a1e'; g.fillRect(kx, ky + 4, 1, 2); g.fillRect(kx + 2, ky + 4, 1, 2);
      g.fillStyle = c.color; g.fillRect(kx - 1, ky + 1, 5, 4);
      g.fillStyle = '#f0c8a0'; g.fillRect(kx + 1, ky, 1, 1);
      g.fillStyle = '#ffd23a'; g.fillRect(kx, ky - 1, 3, 1); g.fillRect(kx + (fase ? 0 : 2), ky - 2, 1, 1);
      const r = c.capital, x = (r % m.W) * V.SUB * P + P + 2, y = Math.floor(r / m.W) * V.SUB * P + P - 12;
      g.fillStyle = '#3a2a1e'; g.fillRect(x, y, 1, 14);
      g.fillStyle = c.color; g.fillRect(x + 1, y, 7, 5);
      g.fillStyle = mezclar(c.color, '#000000', 0.3); g.fillRect(x + 6, y + (fase ? 1 : 0), 2, 4);
    }
  }
