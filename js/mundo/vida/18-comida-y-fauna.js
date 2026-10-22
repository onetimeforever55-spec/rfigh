  // ── GÉNESIS · LA VIDA · Comer, los animales y lo que pasa solo ──

  /*
   * COMER: cada aldeano se come su ración del granero (los niños, media). Si el granero se vacía, la gente
   * pasa hambre; quien lleva tres turnos sin comer, muere. Al final, la población del reino son sus aldeanos.
   */
  // La comida tiene su origen: grano (campos y molinos), pescado (barcas), carne (caza y sacrificio), leche y
  // queso (rebaños) y frutos del bosque. Todo alimenta igual (va a c.comida); el desglose solo cuenta de dónde sale.
  const ALIMENTOS = ['grano', 'pescado', 'carne', 'leche', 'frutos'];
  function alimento(c, k, q) {
    if (!(q > 0)) return;
    c.comida = (c.comida || 0) + q;
    const al = c.alimentos = c.alimentos || {};
    al[k] = (al[k] || 0) + q;
  }
  // Lo que se come sale de todo a partes iguales; lo que entra sin origen (comercio, poderes) cuenta como grano.
  function desglose(c) {
    const al = c.alimentos = c.alimentos || {}, total = Math.max(0, c.comida || 0);
    let suma = 0; for (const k of ALIMENTOS) suma += al[k] || 0;
    if (suma > total && suma > 0) { const f = total / suma; for (const k of ALIMENTOS) al[k] = (al[k] || 0) * f; }
    else if (suma < total) al.grano = (al.grano || 0) + (total - suma);
    return al;
  }
  function comer(m) {
    const v = m.vida, porCiv = {};
    for (const a of v.aldeanos) (porCiv[a.c] = porCiv[a.c] || []).push(a);
    const muertos = new Set();
    for (const c of S().vivas(m)) {
      const lista = porCiv[c.id] || [];
      // En invierno se raciona: se come algo menos para que el granero dure hasta la primavera.
      const racion = lista.reduce((k, a) => k + (esNino(a) ? 0.15 : 0.3), 0) * (v.estacion === 3 ? 0.85 : 1);
      // La recolección: los adultos que no van a la guerra juntan algo de comida aunque no haya campos.
      const seca = c.efectos.some(e => e.sequia), fertil = Math.min(1.5, S().fertil(m, c.capital) / 2) * (seca ? 0.3 : 1);
      let recogen = lista.filter(a => !esNino(a) && a.o !== GUERRERO).length * 0.1 * fertil * (v.estacion === 3 ? 0.45 : v.estacion === 2 ? 1.3 : 1);

      if (c.comida == null) c.comida = 30;
      alimento(c, 'frutos', recogen); c.comida -= racion;
      if (c.comida < 0) {
        c.comida = 0;
        for (const a of lista) { a.hambre = (a.hambre || 0) + 1; a.desnutricion = Math.min(12, (a.desnutricion || 0) + 1); }
        const pausa = pausada(m), caen = lista.filter(a => a.hambre >= (pausa ? 3 : 2)).sort((x, y) => (y.edad || 0) - (x.edad || 0)).slice(0, Math.ceil(lista.length * (pausa ? 0.12 : 0.3)));
        if (caen.length && lista.length - caen.length >= 1) {
          for (const a of caen) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'hambre', TICKS - 0.5, a]); }
          if (m.turno - c.ultimaHambre > 6) S().cronica(m, 'hambruna', 'Hambre en ' + c.nombre, 'Los graneros de ' + c.nombre + ' están vacíos. Mueren ' + caen.length + ' aldeanos, primero los más viejos; los demás comen raíces y miran al cielo.', c);
          c.ultimaHambre = m.turno;
        }
      } else {
        // Comer poco (el granero casi vacío) también deja huella; comer bien la va borrando.
        const escaso = (c.comida || 0) < lista.length * 0.3;
        for (const a of lista) { a.hambre = Math.max(0, (a.hambre || 0) - 1); a.desnutricion = escaso ? Math.min(12, (a.desnutricion || 0) + 0.3) : Math.max(0, (a.desnutricion || 0) * 0.96 - 0.02); }
      }
      c.comida = Math.min(c.comida, topeComida(c, lista.length));
    }
    if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    actualizarPoblacion(m);
  }
  // La población del reino (lo que usa el motor) sale de sus aldeanos.
  function actualizarPoblacion(m) {
    const v = m.vida, n = {};
    for (const a of v.aldeanos) n[a.c] = (n[a.c] || 0) + 1;
    for (const c of S().vivas(m)) { c.escalaVida = escala(c); c.pob = Math.max(0.5, (n[c.id] || 0) * c.escalaVida); c.pobVida = c.pob; c.habitantes = n[c.id] || 0; }
  }

  // ---------- Los animales: ovejas y vacas junto a las aldeas, ciervos en los bosques, peces en el agua ----------
  const HABITAT = {
    oveja: t => t === 'llanura' || t === 'sabana' || t === 'colina' || t === 'tundra' || t === 'sakura',
    vaca: t => t === 'llanura' || t === 'sabana' || t === 'pantano',
    ciervo: t => t === 'bosque' || t === 'taiga' || t === 'selva' || t === 'llanura' || t === 'sakura',
    pez: t => t === 'agua' || t === 'bajo' || t === 'rio',
    lobo: t => t === 'bosque' || t === 'taiga' || t === 'tundra' || t === 'nieve' || t === 'colina' || t === 'llanura' || t === 'sabana'
  };
  const GUARIDA = t => t === 'bosque' || t === 'taiga' || t === 'tundra' || t === 'nieve';
  // Lobos y aldeanos: un lobo a veces muerde a quien anda solo (sobre todo niños); un guerrero que lo
  // tiene al lado lo mata. Los guerreros sin guerra salen a cazarlos.
  // Listas de animales por turno (se rehacen cuando cambia la lista): rebaños de cada pueblo y presas salvajes.
  let cacheAnimales = { lista: null, porCiv: null, salvajes: null };
  function indiceAnimales(v) {
    if (cacheAnimales.lista === v.animales) return cacheAnimales;
    const porCiv = new Map(), salv = [];
    for (const b of v.animales) { if (b.c != null) (porCiv.get(b.c) || porCiv.set(b.c, []).get(b.c)).push(b); else if (b.tipo === 'ciervo' || b.tipo === 'pez') salv.push(b); }
    return (cacheAnimales = { lista: v.animales, porCiv, salvajes: salv });
  }
  const rebanosDe = (v, id) => indiceAnimales(v).porCiv.get(id) || [];
  const salvajes = v => indiceAnimales(v).salvajes;
  function lobos(m, paso) {
    const v = m.vida, lista = v.animales.filter(b => b.tipo === 'lobo');
    if (!lista.length) return;
    const muertos = new Set(), cerca = v.aldeanos.filter(a => lista.some(b => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1));
    if (!cerca.length) return;
    for (const b of lista) {
      for (const a of cerca) {
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1 || muertos.has(a)) continue;
        // Pelea de verdad: el lobo muerde (si se atreve: con un guerrero o un adulto, menos) y el aldeano le
        // devuelve el golpe con lo que lleve en la mano.
        const ataca = esNino(a) ? 0.3 : a.o === GUERRERO ? 0.25 : 0.12;
        if (azar(v) < ataca && acierta(v, b, a) && golpear(v, b, a, danoContra(v, b, a, false), paso, b.x, b.y)) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'lobo', paso, a]); v.mordidos[a.c] = (v.mordidos[a.c] || 0) + 1; break; }
        if (!esNino(a) && acierta(v, a, b) && golpear(v, a, b, danoContra(v, a, b, false), paso, a.x, a.y)) { b.muerta = 1; v.muertos.push([b.x, b.y, null, 'animal', paso, b]); a.bajas = (a.bajas || 0) + 1; break; }
      }
    }
    if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    if (lista.some(b => b.muerta)) v.animales = v.animales.filter(b => !b.muerta);
  }
  function pastar(m, b, ter) {
    const v = m.vida;
    if (b.tipo === 'lobo') {
      // Los lobos rondan los rebaños: se acercan a la oveja o la vaca más cercana y a veces se la llevan.
      if (b.presa == null || azar(v) < 0.1) {
        let mejor = null, md = 10;
        for (const o of v.animales) { if ((o.tipo !== 'oveja' && o.tipo !== 'vaca') || o.muerta || (v.corralT && v.corralT[o.y * v.tw + o.x])) continue; const d = Math.abs(o.x - b.x) + Math.abs(o.y - b.y); if (d < md) { md = d; mejor = o; } }
        b.presa = mejor ? mejor.id : null;
      }
      const o = b.presa != null ? v.animales.find(x => x.id === b.presa && !x.muerta) : null;
      if (o) {
        const dx = Math.sign(o.x - b.x), dy = Math.sign(o.y - b.y), [mx, my] = dx && (!dy || azar(v) < 0.5) ? [dx, 0] : [0, dy];
        if (!(v.corralT && v.corralT[(b.y + my) * v.tw + b.x + mx]) && (HABITAT.lobo(ter[(b.y + my) * v.tw + b.x + mx]) || andable(ter[(b.y + my) * v.tw + b.x + mx]))) { b.x += mx; b.y += my; }
        if (!(v.corralT && v.corralT[o.y * v.tw + o.x]) && Math.abs(o.x - b.x) + Math.abs(o.y - b.y) <= 1 && azar(v) < 0.35 && golpear(v, b, o, danoContra(v, b, o, false), (b.r.length >> 1) || 1, b.x, b.y)) { o.muerta = 1; v.muertos.push([o.x, o.y, null, 'animal', (b.r.length >> 1) || 1, o]); b.presa = null; v.presas = (v.presas || 0) + 1; if (o.c != null) v.robadas[o.c] = (v.robadas[o.c] || 0) + 1; }
        b.r.push(b.x, b.y);
        return;
      }
    }
    const corral = b.corral != null && v.corralT ? (v.corralesId || {})[b.corral] : null;
    if (corral) {
      // En su corral: pasta dentro de la cerca; si está fuera (acaba de nacer o de llegar), va hacia ella.
      const aqui = b.y * v.tw + b.x;
      if (v.corralT[aqui] !== corral.id && (b.fuera = (b.fuera || 0) + 1) > 24) {
        // (Si no encuentra el camino —un río, una casa—, el pastor la mete en el corral.)
        const meta = corral.tiles[(b.id * 7) % corral.tiles.length]; b.x = meta % v.tw; b.y = meta / v.tw | 0; b.fuera = 0;
      }
      if (v.corralT[b.y * v.tw + b.x] === corral.id) {
        b.fuera = 0;
        if (azar(v) < 0.4) { const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)], n = (b.y + dy) * v.tw + b.x + dx; if (v.corralT[n] === corral.id) { b.x += dx; b.y += dy; } }
      } else {
        const meta = corral.tiles[(b.id * 7) % corral.tiles.length], mx = meta % v.tw, my = meta / v.tw | 0;
        const dx = Math.sign(mx - b.x), dy = Math.sign(my - b.y), [sx, sy] = dx && (!dy || azar(v) < 0.5) ? [dx, 0] : [0, dy], n = (b.y + sy) * v.tw + b.x + sx;
        if (andable(ter[n]) || HABITAT[b.tipo](ter[n])) { b.x += sx; b.y += sy; }
      }
      b.r.push(b.x, b.y);
      return;
    }
    if (azar(v) < 0.55) {
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
      const x = b.x + dx, y = b.y + dy;
      // Los rebaños no se alejan de su aldea.
      if (x >= 0 && y >= 0 && x < v.tw && y < v.th && HABITAT[b.tipo](ter[y * v.tw + x]) && (b.casa == null || dist(m, y * v.tw + x, b.casa) <= 6)) { b.x = x; b.y = y; }
    }
    b.r.push(b.x, b.y);
  }
  function fauna(m, ter) {
    const v = m.vida;
    // Los rebaños de cada pueblo, según su tamaño (las vacas llegan con la Edad del Hierro).
    v.animales = v.animales.filter(b => b.c == null || (S().civ(m, b.c) && S().civ(m, b.c).viva));
    // Cada res, a un corral de su pueblo con sitio (unas tres por casilla); si no cabe, pasta suelta cerca de casa.
    v.corralesId = {};
    for (const k of v.corrales || []) { v.corralesId[k.id] = k; k.carga = 0; }
    for (const b of v.animales) if (b.corral != null && v.corralesId[b.corral] && v.corralesId[b.corral].c === b.c) v.corralesId[b.corral].carga++; else delete b.corral;
    for (const b of v.animales) {
      if (b.corral != null || b.c == null || (b.tipo !== 'oveja' && b.tipo !== 'vaca')) continue;
      const k = (v.corrales || []).filter(x => x.c === b.c && x.carga < x.tiles.length * 3).sort((p, q) => p.carga / p.tiles.length - q.carga / q.tiles.length)[0];
      if (k) { b.corral = k.id; k.carga++; }
    }
    // Los rebaños crían si hay pastos (tierra propia sin casas, campos ni bosque) y menguan si se pierden.
    const pasto = {};
    for (let t = 0; t < ter.length; t++) { const d = m.dueno[region(m, t)]; if (d >= 0 && !v.obra[t] && v.arbol[t] < 2 && (HABITAT.oveja(ter[t]) || HABITAT.vaca(ter[t]))) pasto[d] = (pasto[d] || 0) + 1; }
    for (const c of S().vivas(m)) {
      const p = pasto[c.id] || 0, mg = 1 + M.tec(c, 'ganado'), tope = { oveja: Math.min(Math.round(24 * mg), Math.floor(p / 7 * mg)), vaca: c.era >= 1 ? Math.min(Math.round(14 * mg), Math.floor(p / 12 * mg)) : 0 };
      for (const tipo of ['oveja', 'vaca']) {
        const suyos = v.animales.filter(b => b.c === c.id && b.tipo === tipo);
        if (suyos.length < 2 && tope[tipo] >= 2) { nacer(m, ter, tipo, c); continue; } // se doman unas reses salvajes
        const crias = Math.min(2, Math.floor(suyos.length / 2), tope[tipo] - suyos.length);
        for (let k = 0; k < crias; k++) if (azar(v) < 0.3) nacer(m, ter, tipo, c, suyos[Math.floor(azar(v) * suyos.length)]);
        if (suyos.length > tope[tipo] + 1) v.animales = v.animales.filter(b => b !== suyos[0]);
      }
    }
    // Los animales salvajes crían a partir de los que quedan, hasta lo que su hábitat aguanta: si se cazan
    // todos los ciervos de una comarca, tardan en volver.
    const habitat = { ciervo: 0, pez: 0, lobo: 0 };
    for (let t = 0; t < ter.length; t += 3) { if (HABITAT.ciervo(ter[t]) && m.dueno[region(m, t)] < 0) habitat.ciervo += 3; if (HABITAT.pez(ter[t])) habitat.pez += 3; if (GUARIDA(ter[t]) && m.dueno[region(m, t)] < 0) habitat.lobo += 3; }
    const tope = { ciervo: Math.min(70, Math.floor(habitat.ciervo / 120)), pez: Math.min(60, Math.floor(habitat.pez / 250)), lobo: Math.min(16, Math.floor(habitat.lobo / 350)) };
    for (const tipo of ['ciervo', 'pez', 'lobo']) {
      const suyos = v.animales.filter(b => b.tipo === tipo);
      if (suyos.length > tope[tipo] + 2) { v.animales = v.animales.filter(b => b !== suyos[0]); continue; }
      const nacen = Math.min(tope[tipo] - suyos.length, suyos.length < 4 ? 2 : Math.ceil(suyos.length * (tipo === 'lobo' ? 0.05 : 0.1)));
      for (let k = 0; k < nacen; k++) nacer(m, ter, tipo, null, suyos.length >= 4 ? suyos[Math.floor(azar(v) * suyos.length)] : null);
    }
  }
  function nacer(m, ter, tipo, c, madre) {
    const v = m.vida;
    for (let k = 0; k < 30; k++) {
      let t;
      if (madre) t = (madre.y + Math.floor(azar(v) * 3) - 1) * v.tw + madre.x + Math.floor(azar(v) * 3) - 1;
      else if (c) { const cs = S().casillas(m, c); const r = azar(v) < 0.5 ? c.capital : cs[Math.floor(azar(v) * cs.length)]; t = parcelas(m, r)[Math.floor(azar(v) * SUB * SUB)]; }
      else t = Math.floor(azar(v) * ter.length);
      if (!HABITAT[tipo](ter[t]) || v.obra[t]) continue;
      if (tipo === 'ciervo' && m.dueno[region(m, t)] >= 0 && azar(v) < 0.8) continue;
      if (tipo === 'lobo' && !madre && (!GUARIDA(ter[t]) || m.dueno[region(m, t)] >= 0)) continue;
      if (t < 0 || t >= ter.length) continue;
      v.animales.push({ id: v.sig++, tipo, c: c ? c.id : null, casa: madre ? madre.casa : c ? t : null, x: t % v.tw, y: t / v.tw | 0, r: [] });
      return true;
    }
    return false;
  }

  // ---------- Lo que pasa solo: los árboles crecen, las ruinas se cubren, los bosques se acaban ----------
  function naturaleza(m, ter) {
    // Los hachazos de árboles que ya no están (quemados, arrancados) se olvidan.
    if (m.vida.hachazos && m.turno % 25 === 0) for (const k of Object.keys(m.vida.hachazos)) if (m.vida.arbol[+k] < 2) delete m.vida.hachazos[k];
    const v = m.vida, tw = v.tw, n = tw * v.th, F = TICKS;
    // En sequía el trigo no crece y muere una de cada cinco reses cada turno.
    const secos = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.sequia)).map(c => c.id));
    if (secos.size) v.animales = v.animales.filter(b => !(b.c != null && secos.has(b.c) && azar(v) < 0.2));
    // Las regiones que cambiaron de suelo (un terremoto las volvió desierto) pierden sus árboles y sus casas.
    for (let r = 0; r < m.W * m.H; r++) if (v.tipoVisto[r] !== m.tipo[r]) {
      const nuevo = m.tipo[r];
      if (nuevo === 'desierto' || nuevo === 'montana' || esAgua(nuevo)) for (const t of parcelas(m, r)) {
        cambiar(m, 'arbol', t, 0, F);
        if (v.obra[t] === OBRA.casa || v.obra[t] === OBRA.centro || v.obra[t] === OBRA.ayuntamiento) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (v.obra[t] === OBRA.campo) cambiar(m, 'obra', t, 0, F);
      }
      v.tipoVisto[r] = nuevo;
    }
    for (let t = 0; t < n; t++) {
      const r = region(m, t), dueno = m.dueno[r], tierra = ter[t];
      const ob = v.obra[t];
      // El trigo crece: tierra arada, brotes, verde y dorado (listo para segar).
      if (ob === OBRA.campo && v.cultivo[t] > 0 && secos.has(dueno) && azar(v) < 0.45) cambiar(m, 'cultivo', t, 0, 1 + Math.floor(azar(v) * TICKS)); // el trigo se agosta
      else if (ob === OBRA.campo && v.cultivo[t] < 3 && dueno >= 0 && !secos.has(dueno) && azar(v) < (v.estacion === 3 ? 0.1 : v.estacion === 0 ? 0.7 : 0.55)) cambiar(m, 'cultivo', t, v.cultivo[t] + 1, 1 + Math.floor(azar(v) * TICKS));
      // Lo abandonado se arruina, y las ruinas acaban bajo la hierba.
      if (dueno < 0) {
        if ((ob === OBRA.casa || ob >= OBRA.torre) && azar(v) < 0.2) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (ob === OBRA.campo && azar(v) < 0.25) cambiar(m, 'obra', t, 0, F);
        else if (ob === OBRA.ruina && azar(v) < 0.04) cambiar(m, 'obra', t, 0, F);
      } else if (ob === OBRA.ruina && azar(v) < 0.02) cambiar(m, 'obra', t, 0, F);
      if (v.camino[t] && dueno < 0 && azar(v) < 0.01) cambiar(m, 'camino', t, 0, F);
      if (v.obra[t] || v.roca[t] || v.camino[t] || esVia(v, t) || (v.trinchera && v.trinchera[t]) || (v.muro && v.muro[t] > 0) || (v.corralT && v.corralT[t]) || tierra === 'rio' || tierra === 'arena' || tierra === 'agua' || tierra === 'bajo') continue;
      const a = v.arbol[t];
      if (a === 1 || a === 2) { if (azar(v) < 0.4) cambiar(m, 'arbol', t, a + 1, F); continue; }
      if (a) continue;
      // Un bosque abandonado vuelve a crecer como bosque.
      const base = (v.fueBosque[r] && dueno < 0) ? BROTE[typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque'] : BROTE[m.tipo[r]] || 0;
      if (!base) continue;
      const x = t % tw, y = t / tw | 0;
      const junto = (x > 0 && v.arbol[t - 1]) || (x < tw - 1 && v.arbol[t + 1]) || (y > 0 && v.arbol[t - tw]) || (y < v.th - 1 && v.arbol[t + tw]);
      // (En la tierra recién quemada no brota nada hasta que la hierba ha vuelto a medias: si no, el bosque cerraba la
      // quemadura en pocos turnos. La tirada se hace igual, para no cambiar el resto de la partida.)
      const tira = azar(v), mq = v.marcas && v.marcas[t];
      if (mq && (mq[0] === MARCA.ceniza || mq[0] === MARCA.tronco || (mq[0] === MARCA.chamuscado && mq[1] - m.turno > 12))) continue;
      if (tira < base * (junto ? 1 : 0.12)) cambiar(m, 'arbol', t, 1, F);
    }
    // Un bosque sin árboles ya no es bosque (y deja de dar madera, aunque sí da campos): la selva talada
    // se queda en sabana, la taiga en tundra. Si se deja crecer, el bosque vuelve.
    const TALADO = S().TALADO;
    for (let r = 0; r < m.W * m.H; r++) {
      const tipo = m.tipo[r], original = v.fueBosque[r] ? (typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque') : null;
      if (!TALADO[tipo] && !(original && tipo === TALADO[original])) continue;
      let quedan = 0;
      for (const t of parcelas(m, r)) if (v.arbol[t]) quedan++;
      if (TALADO[tipo] && quedan <= 3) { m.tipo[r] = TALADO[tipo]; v.fueBosque[r] = tipo; v.tipoVisto[r] = m.tipo[r]; v.cambios.push([3, r, tipo, m.tipo[r], F]); }
      else if (original && tipo === TALADO[original] && quedan >= 10) { m.tipo[r] = original; v.tipoVisto[r] = original; v.cambios.push([3, r, tipo, original, F]); }
    }
    avisar(m);
  }

  // Cuando un pueblo se queda sin bosques y sin madera, la crónica lo cuenta (una vez cada tanto).
  function avisar(m) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      const cs = S().casillas(m, c);
      if (cs.length < 6) continue;
      let arboles = 0;
      for (const r of cs) for (const t of parcelas(m, r)) if (v.arbol[t] >= 2) arboles++;
      c.arboles = arboles;
      const talado = cs.filter(r => v.fueBosque[r]).length;
      if (arboles < cs.length * 0.6 && talado >= 3 && c.madera < 6 && m.turno - (v.avisos[c.id] || -99) > 25) {
        v.avisos[c.id] = m.turno;
        c.efectos.push({ estab: -5, hasta: m.turno + 5 });
        S().cronica(m, 'deforestacion', c.nombre + ' tala su último bosque', 'Los leñadores de ' + c.nombre + ' vuelven con las manos vacías: donde había bosque hay campos, pastos y tocones. Sin madera no hay casas nuevas, ni barcos, ni leña para el invierno.', c, cs.find(r => v.fueBosque[r]));
      }
    }
  }
