  // ── GÉNESIS · EL PINTOR · La cámara, la entrada y los planos del arquitecto ──

  // ---------- La cámara ----------
  // Centra la cámara en una parcela concreta (tx, ty) y acerca.
  function centrarEnParcela(tx, ty, acercar) {
    if (!m) return;
    cam.x = tx * P + P / 2; cam.y = ty * P + P / 2;
    if (acercar) cam.z = Math.max(cam.z, acercar);
    limitar();
  }
  function centrarEn(region, acercar) {
    if (!m) return;
    const R = V.SUB * P;
    cam.x = (region % m.W) * R + R / 2; cam.y = Math.floor(region / m.W) * R + R / 2;
    if (acercar) cam.z = Math.max(cam.z, acercar);
    else if (cam.z < 1) cam.z = Math.max(zMin(), 1.5);
    limitar();
  }
  function zoom(factor, sx, sy) {
    if (!m) return;
    const { w, h } = vista();
    const px = sx == null ? w / 2 : sx, py = sy == null ? h / 2 : sy;
    const wx = cam.x + (px - w / 2) / cam.z, wy = cam.y + (py - h / 2) / cam.z;
    cam.z *= factor; limitar();
    cam.x = wx - (px - w / 2) / cam.z; cam.y = wy - (py - h / 2) / cam.z; limitar();
  }
  function verTodo() { cam.z = zMin(); limitar(); }

  function entradas() {
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', ev => {
      siguiendo = null;
      cv.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (punteros.size === 1) arrastre = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, movido: 0 };
      else arrastre = null;
      caja = tropas && punteros.size === 1 && (ev.pointerType !== 'mouse' || ev.button === 0) ? { x0: ev.clientX, y0: ev.clientY, x1: ev.clientX, y1: ev.clientY } : null;
      if (punteros.size > 1) caja = null;
    });
    cv.addEventListener('contextmenu', ev => { if (tropas) ev.preventDefault(); });
    cv.addEventListener('pointermove', ev => {
      if (arqui) { const rect = cv.getBoundingClientRect(), { w, h } = vista(); arqui.wx = cam.x + (ev.clientX - rect.left - w / 2) / cam.z; arqui.wy = cam.y + (ev.clientY - rect.top - h / 2) / cam.z; }
      if (!punteros.has(ev.pointerId)) return;
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        const [c, d] = [...punteros.values()];
        const d1 = Math.hypot(c.x - d.x, c.y - d.y), rect = cv.getBoundingClientRect();
        if (d0 > 0) zoom(d1 / d0, (c.x + d.x) / 2 - rect.left, (c.y + d.y) / 2 - rect.top);
        // (En el modo tropas, con dos dedos también se mueve la cámara.)
        if (tropas) { cam.x -= ((c.x + d.x) - (a.x + b.x)) / 2 / cam.z; cam.y -= ((c.y + d.y) - (a.y + b.y)) / 2 / cam.z; limitar(); }
        return;
      }
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!arrastre) return;
      arrastre.movido = Math.max(arrastre.movido, Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y));
      if (caja) { caja.x1 = ev.clientX; caja.y1 = ev.clientY; return; }
      cam.x = arrastre.cx - (ev.clientX - arrastre.x) / cam.z; cam.y = arrastre.cy - (ev.clientY - arrastre.y) / cam.z;
      limitar();
    });
    const soltar = ev => {
      const eraClic = arrastre && arrastre.movido < 6 && punteros.size === 1;
      // Modo tropas: un recuadro elige soldados; un toque elige uno o los manda a ese sitio.
      if (tropas && m && ev.type === 'pointerup' && punteros.size === 1 && (caja || eraClic)) {
        punteros.delete(ev.pointerId); arrastre = null;
        const rect = cv.getBoundingClientRect(), { w, h } = vista();
        const aMundo = (sx, sy) => [cam.x + (sx - rect.left - w / 2) / cam.z, cam.y + (sy - rect.top - h / 2) / cam.z];
        const mios = id => { const a = m.vida.aldeanos.find(x => x.id === id); return a && a.c === tropas.civ && a.o === 4; };
        if (caja && !eraClic) {
          const [ax, ay] = aMundo(Math.min(caja.x0, caja.x1), Math.min(caja.y0, caja.y1)), [bx, by] = aMundo(Math.max(caja.x0, caja.x1), Math.max(caja.y0, caja.y1));
          tropas.sel = new Set(); for (const [id, [x, y]] of dibujados) if (x >= ax - 2 && x <= bx + 2 && y >= ay - 4 && y <= by + 2 && mios(id)) tropas.sel.add(id);
        } else {
          const [wx, wy] = aMundo(ev.clientX, ev.clientY);
          let cerca = null, dmin = Math.max(5, 9 / cam.z);
          for (const [id, [x, y]] of dibujados) { const d = Math.hypot(x + 1.5 - wx, y + 2.5 - wy); if (d < dmin && mios(id)) { dmin = d; cerca = id; } }
          if (cerca != null) { if (tropas.sel.has(cerca)) tropas.sel.delete(cerca); else tropas.sel.add(cerca); }
          else if (tropas.sel.size) { const tx = Math.floor(wx / P), ty = Math.floor(wy / P); if (tx >= 0 && ty >= 0 && tx < m.vida.tw && ty < m.vida.th) { tropas.alOrdenar && tropas.alOrdenar(ty * m.vida.tw + tx); marcarDestino(ty * m.vida.tw + tx); } }
        }
        caja = null;
        if (tropas.alCambiar) tropas.alCambiar(tropas.sel);
        return;
      }
      caja = null;
      punteros.delete(ev.pointerId);
      if (eraClic && ev.type === 'pointerup' && alClicar && m) {
        const rect = cv.getBoundingClientRect(), { w, h } = vista();
        const wx = cam.x + (ev.clientX - rect.left - w / 2) / cam.z, wy = cam.y + (ev.clientY - rect.top - h / 2) / cam.z;
        // ¿Has tocado a un aldeano? (el más cercano, si está a unos pocos píxeles de pantalla)
        let cerca = null, dmin = Math.max(5, 9 / cam.z);
        for (const [id, [x, y]] of dibujados) { const d = Math.hypot(x + 1.5 - wx, y + 2.5 - wy); if (d < dmin) { dmin = d; cerca = id; } }
        const R = V.SUB * P, rx = Math.floor(wx / R), ry = Math.floor(wy / R);
        if (arqui) { const tx = Math.floor(wx / P), ty = Math.floor(wy / P); arqui.wx = wx; arqui.wy = wy; if (tx >= 0 && ty >= 0 && tx < m.vida.tw && ty < m.vida.th) arqui.alColocar(ty * m.vida.tw + tx); }
        else if (cerca != null && alClicarAldeano) alClicarAldeano(cerca);
        else if ((() => {
          // Tocar un edificio: la plaza del rey abre la corte; cualquier otro, su ficha (y el ayuntamiento, la de su ciudad).
          const tx = Math.floor(wx / P), ty = Math.floor(wy / P), t = ty * m.vida.tw + tx;
          if (tx < 0 || ty < 0 || tx >= m.vida.tw || ty >= m.vida.th) return false;
          const o = visto.obra[t], d = m.dueno[V.region(m, t)];
          if (alClicarCorte && (o === V.OBRA.centro || o === V.OBRA.palacio) && d >= 0) { alClicarCorte(d, t); return true; }
          if (alClicarEdificio && ((o && o !== V.OBRA.campo) || (m.vida.andamios && m.vida.andamios[t]))) { alClicarEdificio(t); return true; }
          return false;
        })()) { /* edificio */ }
        else if (rx >= 0 && ry >= 0 && rx < m.W && ry < m.H) alClicar(ry * m.W + rx);
      }
      if (punteros.size === 1) { const [p] = [...punteros.values()]; arrastre = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, movido: 99 }; }
      else if (!punteros.size) arrastre = null;
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener('wheel', ev => {
      ev.preventDefault();
      const rect = cv.getBoundingClientRect();
      zoom(Math.exp(-ev.deltaY * 0.0015), ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });
  }

  // El modo arquitecto: { clave, civ, valida(t) → razón o null, alColocar(t) }; null para salir.
  let arqui = null;
  function arquitecto(o) { arqui = o ? Object.assign({ wx: -1, wy: -1 }, o) : null; }
  function dibujoDe(clave, c) {
    const color = c ? c.color : '#cccccc', fase = c ? V.fase(c.era) : 0;
    if (clave === 'colonia') return ARTE().edificio('campamento', color, fase);
    if (clave === 'casa') return ARTE().casa(CASAS[c ? grupoEra(c.era) : 0], color, 0);
    if (clave === 'templo') return ARTE().edificio('templo', color, c && c.era === 4 ? 4 : fase);
    if (clave === 'saber') return ARTE().edificio('saber', color, M.ERUDITO(c ? c.era : 0).tipo);
    if (['banco', 'fabrica', 'estacion', 'hospital', 'aerodromo', 'central', 'aduana', 'petroleo', 'mina'].includes(clave)) return ARTE().edificio(clave, color, Math.max(2, fase));
    return ARTE().edificio(clave, color, fase);
  }
  function planos(ahora) {
    const v = m.vida, parpadeo = 0.45 + 0.2 * Math.sin(ahora / 260);
    const c = arqui ? S.civ(m, arqui.civ) : S.vivas(m).find(x => x.jugador);
    if (!c) return;
    // Lo encargado: el edificio en transparente con un marco de trazos; las calles por empedrar, en gris.
    g.save(); g.setLineDash([2, 1.5]); g.lineWidth = 0.8;
    for (const e of (c.plan && c.plan.encargos) || []) {
      const x = (e.t % v.tw) * P, y = Math.floor(e.t / v.tw) * P;
      g.globalAlpha = parpadeo; g.drawImage(dibujoDe(e.clave, c), x, y, P, P); g.globalAlpha = 1;
      g.strokeStyle = '#ffd76a'; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
    }
    // El sitio elegido para fundar un pueblo: el campamento en transparente, con su marco.
    if (c.plan && typeof c.plan.colonos === 'number') { const t = V.centro(m, c.plan.colonos), x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P; g.globalAlpha = parpadeo; g.drawImage(dibujoDe('colonia', c), x, y, P, P); g.globalAlpha = 1; g.strokeStyle = '#ffd76a'; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1); }
    if (arqui) for (const t of (v.pendientes && v.pendientes[c.id]) || []) { const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P; g.fillStyle = 'rgba(190,190,184,' + (parpadeo * 0.8).toFixed(2) + ')'; g.fillRect(x + 1, y + 1, P - 2, P - 2); }
    g.restore();
    if (!arqui || arqui.wx < 0) return;
    const tx = Math.floor(arqui.wx / P), ty = Math.floor(arqui.wy / P), t = ty * v.tw + tx;
    if (tx < 0 || ty < 0 || tx >= v.tw || ty >= v.th) return;
    const no = arqui.valida(t), x = tx * P, y = ty * P;
    g.globalAlpha = 0.75;
    if (arqui.clave === 'camino') { g.fillStyle = '#b4b2ac'; g.fillRect(x, y, P, P); } else g.drawImage(dibujoDe(arqui.clave, c), x, y, P, P);
    g.globalAlpha = 1;
    g.fillStyle = no ? 'rgba(255,60,40,0.35)' : 'rgba(80,255,120,0.25)'; g.fillRect(x, y, P, P);
    g.strokeStyle = no ? '#ff5a4a' : '#7aff9a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
    if (no) { const f = Math.max(2.5, 11 / cam.z); g.font = 'bold ' + f.toFixed(1) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.75)'; const w = g.measureText(no).width + f; g.fillRect(x + 8 - w / 2, y - f * 1.7, w, f * 1.4); g.fillStyle = '#ffd0c8'; g.fillText(no, x + 8, y - f * 0.6); }
  }
  function seleccionar(id) { sel = id; if (m) territorio(); }
  function elegirAldeano(id) { elegido = id; }
  function seguir(id) { siguiendo = id; elegido = id; if (id != null && cam.z < 2.5) cam.z = Math.min(4, Math.max(zMin(), 3)); }
  const siguiendoA = () => siguiendo;

  M.pintor = { gpu: () => !!(g && g.gpu), camara: () => ({ x: cam.x, y: cam.y, z: cam.z }), dibujados: () => [...dibujados], modoTropas, tropasElegidas: () => (tropas ? [...tropas.sel] : []), elegirTropas: ids => { if (tropas) { tropas.sel = new Set(ids); if (tropas.alCambiar) tropas.alCambiar(tropas.sel); } }, trenes: () => ultimosTrenes.slice(), P, centrarEnParcela, batallas: () => (m ? listaBatallas() : []), arquitecto, anunciar, elegirAldeano, seguir, siguiendoA, iniciar, mundo, turno, refrescar, seleccionar, marcar, centrarEn, zoom, verTodo, efecto };
