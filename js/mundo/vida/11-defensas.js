  // ── GÉNESIS · LA VIDA · Trincheras, murallas, corrales, defensas de frontera y qué edificio toca ──

  /*
   * LAS TRINCHERAS (Segunda Guerra Mundial): los soldados cavan una zanja con sacos terreros a lo largo de la
   * frontera con los vecinos en guerra o mal avenidos, y le ponen alambre de espino delante. Quien está dentro
   * es más difícil de alcanzar y recibe menos daño; en guerra, los soldados sin otra orden ocupan las trincheras.
   * v.trinchera[t]: 1 cavada, 2 con alambre.
   */
  const MAX_TRINCHERA = 70;
  function planTrincheras(m, c, ter) {
    const v = m.vida, tw = v.tw;
    if (c.era < 8) { c.trincheraPlan = []; return; }
    if (c.trincheraPlan && m.turno - (c.trincheraTurno || -99) < 10) return;
    c.trincheraTurno = m.turno;
    const rivales = S().vecinosDe(m, c).filter(o => o && o.viva && (S().enGuerra(c, o) || (c.rel[o.id] || 0) < 15));
    const cap = centro(m, c.capital), out = [];
    for (const o of rivales) for (const r of S().frontera(m, o, c)) for (const t of parcelas(m, r)) {
      const tx = t % tw;
      if (ter[t] === 'agua' || ter[t] === 'bajo' || ter[t] === 'montana' || (v.obra[t] && v.obra[t] !== OBRA.campo) || v.camino[t] || esVia(v, t)) continue;
      // Pegada a la raya: una casilla vecina es ya del rival.
      if (![t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < v.obra.length && Math.abs(n % tw - tx) <= 1 && m.dueno[region(m, n)] === o.id)) continue;
      out.push(t);
    }
    // Primero los tramos frente a quien está en guerra, y los más cercanos a la capital.
    const guerra = t => rivales.some(o => S().enGuerra(c, o) && [t - 1, t + 1, t - tw, t + tw].some(n => m.dueno[region(m, n)] === o.id)) ? 0 : 1;
    c.trincheraPlan = [...new Set(out)].sort((p, q) => guerra(p) - guerra(q) || dist(m, p, cap) - dist(m, q, cap)).slice(0, MAX_TRINCHERA);
  }
  const enTrinchera = (v, a) => cubierto(v, a.y * v.tw + a.x);
  /*
   * LAS MURALLAS: alrededor del casco de cada plaza (capital y ciudades), una empalizada de troncos en las primeras
   * edades y una muralla de piedra después, con puertas donde la cruzan los caminos. Se levanta frente a vecinos en
   * guerra o mal avenidos, en cuanto la plaza es una aldea (o si el jugador manda «levantad murallas»). La hacen los
   * constructores, tramo a tramo (madera la empalizada, piedra la muralla), y la reparan. El enemigo no la cruza: la
   * golpea hasta abrir brecha (los tanques y los obuses, mucho más rápido); quien está sobre ella está a cubierto.
   * v.muro[t]: la vida del tramo (0, nada); v.puerta[t]: 1 si es una puerta; c.muros: las casillas de cada reino por levantar.
   */
  const V_FASE = c => (c.era <= 1 ? 0 : 1);
  const muroVida = c => (c.era <= 1 ? 25 : c.era <= 4 ? 50 : 70);
  function planMuros(m, c, ter) {
    const v = m.vida, tw = v.tw, p = c.plan || {};
    delete v.muroPlan; // (de partidas de antes: ya no se usa)
    // (Un camino que cruza un tramo ya levantado lo convierte en puerta.)
    if (v.muro && v.puerta) for (const t of c.muros || []) if (v.muro[t] > 0 && !v.puerta[t] && (v.camino[t] || esVia(v, t))) { v.puerta[t] = 1; v.muroVer = (v.muroVer || 0) + 1; }
    const rivales = S().vecinosDe(m, c).filter(o => o && o.viva && (S().enGuerra(c, o) || (c.rel[o.id] || 0) < -10));
    if (c.era < 1 || (!rivales.length && !p.murallas && !c.guerras.length)) { c.muros = []; return; }
    const plazas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    const out = [];
    for (const r of plazas) {
      const cen = centro(m, r), cx = cen % tw, cy = cen / tw | 0;
      // El casco: las obras (no los campos) a menos de diez casillas de la plaza, en tierra propia.
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= tw || y >= v.th) continue;
        const t = y * tw + x, o = v.obra[t];
        if (!o || o === OBRA.campo || o === OBRA.ruina || m.dueno[region(m, t)] !== c.id) continue;
        n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (n < 5) continue;
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      if (2 * (x1 - x0 + y1 - y0) > 96) continue; // (una ciudad enorme: no se amuralla entera)
      for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) out.push(y * tw + x);
      for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) out.push(y * tw + x);
    }
    c.muros = [];
    for (const t of out) {
      if (t < 0 || t >= ter.length || m.dueno[region(m, t)] !== c.id) continue;
      // (El agua y la montaña ya cierran solas; una casa en la raya deja un hueco.)
      if (!(v.muro && v.muro[t] > 0) && (!andable(ter[t]) || ter[t] === 'agua' || ter[t] === 'bajo' || ter[t] === 'montana' || (v.obra[t] && v.obra[t] !== OBRA.campo) || (v.andamios && v.andamios[t]) || (v.trinchera && v.trinchera[t]) || (v.corralT && v.corralT[t]))) continue;
      c.muros.push(t);
    }
  }
  // El tramo de muralla más cercano por levantar o reparar (si hay con qué pagarlo).
  function muroPendiente(m, a, c, rec) {
    const v = m.vida, lista = c.muros || [];
    if (!lista.length) return null;
    const k = V_FASE(c) === 0 ? 'madera' : 'piedra';
    // (Ahorrando para la edad siguiente, la muralla espera, salvo en guerra o si la mandó el jugador.)
    const res = !c.guerras.length && !(c.plan && c.plan.murallas) ? S().reservaMejora(m, c) : null;
    if ((c[k] || 0) - ((res && res[k]) || 0) < (k === 'madera' ? 4 : 3)) return null;
    const hp = muroVida(c), aqui = a.y * v.tw + a.x;
    let mejor = null, md = 1e9;
    for (const t of lista) {
      if (rec.reservadas.has(t) || (v.muro && v.muro[t] >= hp * 0.8)) continue;
      if ((v.obra[t] && v.obra[t] !== OBRA.campo) || (v.andamios && v.andamios[t])) continue;
      const d = dist(m, aqui, t); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  /*
   * LOS CORRALES: el ganado (ovejas y vacas) de cada plaza vive en un corral cercado junto al pueblo, no suelto por el
   * campo. Cuesta 4 de madera; caben unas tres reses por casilla y, si el pueblo crece, se levanta otro. Dentro, los
   * lobos no entran. v.corralT[t]: el número del corral; v.corrales: { id, c, r, tiles }.
   */
  function planCorrales(m, c, ter) {
    const v = m.vida, tw = v.tw;
    v.corrales = v.corrales || []; v.corralT = v.corralT || new Array(tw * v.th).fill(0);
    // Los corrales en tierra que ya no es de su pueblo se deshacen.
    for (const k of v.corrales.slice()) if (k.c === c.id && m.dueno[region(m, k.tiles[0])] !== c.id) { for (const t of k.tiles) v.corralT[t] = 0; v.corrales = v.corrales.filter(x => x !== k); v.corralVer = (v.corralVer || 0) + 1; }
    const reses = v.animales.filter(b => b.c === c.id && (b.tipo === 'oveja' || b.tipo === 'vaca')).length;
    const mios = v.corrales.filter(k => k.c === c.id), sitio = mios.reduce((n, k) => n + k.tiles.length * 3, 0);
    if (reses < 2 || sitio >= reses || (c.madera || 0) < 6) return;
    const plazas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].sort((p, q) => mios.filter(k => k.r === p).length - mios.filter(k => k.r === q).length);
    const falta = reses - sitio, [W, H] = falta > 50 ? [6, 4] : falta > 30 ? [5, 4] : [4, 3];
    for (const r of plazas) {
      const cen = centro(m, r), cx = cen % tw, cy = cen / tw | 0;
      const libre = t => t >= 0 && t < ter.length && andable(ter[t]) && ter[t] !== 'arena' && ter[t] !== 'montana' && !v.obra[t] && !v.camino[t] && !v.roca[t] && !esVia(v, t) && !(v.trinchera && v.trinchera[t]) && !(v.muro && v.muro[t] > 0) && !v.corralT[t] && !enCasco(m, t) && !(v.marcadas && v.marcadas.has(t)) && m.dueno[region(m, t)] === c.id;
      // (Lo más cerca posible del pueblo; si no cabe el grande, uno de 3×3.)
      let mejor = null, md = 1e9;
      for (const [w, h] of [[W, H], [3, 3]]) {
        for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
          const d = Math.abs(dx) + Math.abs(dy); if (d < 4 || d >= md) continue;
          const x = cx + dx, y = cy + dy; if (x < 1 || y < 1 || x + w >= tw || y + h >= v.th) continue;
          let ok = true; for (let j = 0; j < h && ok; j++) for (let i = 0; i < w && ok; i++) ok = libre((y + j) * tw + x + i);
          if (ok) { md = d; mejor = [x, y, w, h]; }
        }
        if (mejor) break;
      }
      if (!mejor) continue;
      const [, , Wc, Hc] = mejor;
      const tiles = []; for (let j = 0; j < Hc; j++) for (let i = 0; i < Wc; i++) tiles.push((mejor[1] + j) * tw + mejor[0] + i);
      const k = { id: v.sig++, c: c.id, r, tiles };
      // (Los árboles de dentro se talan para la cerca.)
      for (const t of tiles) { v.corralT[t] = k.id; if (v.arbol[t]) cambiar(m, 'arbol', t, 0, 1); }
      v.corrales.push(k); c.madera -= 4; v.corralVer = (v.corralVer || 0) + 1;
      if (c.jugador && mios.length === 0) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🐑 El pueblo levanta un corral cercado para el ganado', region: r });
      return planCorrales(m, c, ter); // (y otro, si aún no cabe todo el rebaño y hay madera)
    }
  }
  function sitioMina(m, c, ter) {
    const v = m.vida, cap = centro(m, c.capital);
    // (Tampoco pegada a la mina de una compañía, abierta o encargada.)
    const otras = Object.keys(v.privados || {}).filter(t => v.privados[t].ind === 'minera').map(Number);
    let mejor = null, md = 1e9;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (ter[t] !== 'montana' || v.obra[t] || v.roca[t] || v.arbol[t] >= 2 || v.camino[t] || ocupada(v, t) || (v.andamios && v.andamios[t])) continue;
      if ((c.minasT || []).some(u => dist(m, u, t) < 6) || otras.some(u => dist(m, u, t) < 6)) continue;
      const d = dist(m, t, cap) - (ter[t] === 'montana' ? 2 : 0); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  /*
   * LAS DEFENSAS DE FRONTERA: frente a un vecino en guerra o mal avenido (o si el jugador manda «fortificad la
   * frontera»), el reino levanta torres a lo largo de la raya —empalizada, torre de piedra, torre artillada o búnker,
   * según la época—, separadas entre sí y mejor junto a los caminos que entran. Más torres con las edades.
   */
  function sitioDefensa(m, c, ter) {
    const v = m.vida, tw = v.tw, p = c.plan || {};
    const vecinos = S().vecinosDe(m, c).filter(o => o && o.viva);
    const rivales = vecinos.filter(o => S().enGuerra(c, o) || (c.rel[o.id] || 0) < 15 || p.fortificar);
    if (!rivales.length || c.era < 1) return null;
    const regiones = new Set(rivales.flatMap(o => S().frontera(m, o, c)));
    if (!regiones.size) return null;
    const defensa = t => v.obra[t] === OBRA.torre || v.obra[t] === OBRA.castillo || v.obra[t] === OBRA.aduana || (v.andamios && v.andamios[t] && v.andamios[t].o === OBRA.torre);
    const puestas = [];
    for (const r of regiones) for (const t of parcelas(m, r)) if (defensa(t)) puestas.push(t);
    const tope = Math.min(regiones.size, 1 + Math.floor(c.era / 2) + (p.fortificar ? 3 : 0));
    if (puestas.filter(t => v.obra[t] === OBRA.torre || (v.andamios && v.andamios[t])).length >= tope) return null;
    const cerca = (t, d) => { const x = t % tw, y = t / tw | 0; for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) { const u = (y + j) * tw + x + i; if (u >= 0 && u < v.obra.length && defensa(u)) return true; } return false; };
    const deRival = u => { const d = m.dueno[region(m, u)]; return rivales.some(o => o.id === d); };
    const guerra = u => { const d = m.dueno[region(m, u)]; return rivales.some(o => o.id === d && S().enGuerra(c, o)); };
    let mejor = null, mp = -1e9;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (!CONSTRUIBLE.has(ter[t]) || v.obra[t] || v.roca[t] || v.camino[t] || ocupada(v, t) || (v.andamios && v.andamios[t]) || cerca(t, 5)) continue;
      // A dos o tres casillas de la raya (no encima): mirando al rival.
      const x = t % tw, y = t / tw | 0; let raya = 9, enGuerra = false, caminos = 0;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const u = (y + j) * tw + x + i; if (u < 0 || u >= v.obra.length) continue; if (deRival(u)) { raya = Math.min(raya, Math.max(Math.abs(i), Math.abs(j))); if (guerra(u)) enGuerra = true; } if (v.camino[u]) caminos++; }
      if (raya < 2 || raya > 4) continue;
      const pt = (enGuerra ? 20 : 0) + Math.min(6, caminos) * 2 - Math.abs(raya - 3) * 3 - dist(m, t, centro(m, c.capital)) * 0.05;
      if (pt > mp) { mp = pt; mejor = t; }
    }
    return mejor;
  }
  function sitioPetroleo(m, c, ter) {
    const v = m.vida;
    if (!v.crudo) return null;
    const cap = centro(m, c.capital);
    let mejor = null, md = 1e9;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (!v.crudo[t] || v.obra[t] || v.roca[t] || v.camino[t] || ocupada(v, t) || !CONSTRUIBLE.has(ter[t]) || (v.andamios && v.andamios[t])) continue;
      // Uno por bolsa: si ya hay un pozo pegado, esa bolsa está tomada.
      if ([1, -1, v.tw, -v.tw, v.tw + 1, v.tw - 1, -v.tw + 1, -v.tw - 1].some(d => v.obra[t + d] === OBRA.petroleo)) continue;
      const d = dist(m, t, cap); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  // Las obras de una ciudad que, por falta de sitio, se levantaron en una comarca de al lado (v.sede[t] = la ciudad).
  const LEJOS_OK = new Set([OBRA.inmopriv, OBRA.pozo, OBRA.granero, OBRA.fuente, OBRA.parque, OBRA.palacio, OBRA.central, OBRA.banco, OBRA.fabrica, OBRA.estacion, OBRA.hospital, OBRA.aerodromo, OBRA.templo, OBRA.saber, OBRA.cuartel, OBRA.arqueria, OBRA.castillo]);
  const CLAVE_OBRA = Object.fromEntries(Object.entries(OBRA).map(([k, o]) => [o, k]));
  function enSede(m, r, o) {
    const sd = m.vida.sede; if (!sd) return false;
    for (const t in sd) if (sd[t] === r && (m.vida.obra[t] === o || (m.vida.andamios && m.vida.andamios[t] && m.vida.andamios[t].o === o))) return true;
    return false;
  }
  function edificioPendiente(m, a, c, ter) {
    const v = m.vida;
    // Con un encargo del jugador pendiente, la madera y la piedra se guardan para él (en la capital).
    const plazas = c.plan && c.plan.obra ? [c.capital] : [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].sort((p, q) => S().distancia(p, a.h) - S().distancia(q, a.h));
    // La torre de la frontera frente a un vecino hostil (relación por debajo de -20): una cada pocos turnos, la pida la
    // plaza que la pida (si no, en un reino con varias ciudades siempre hay antes un molino o un pozo y nunca se levanta).
    if (pausada(m) && c.era >= 1 && !(c.plan && c.plan.obra) && !(c.enCurso && c.enCurso.fronteraT > m.turno - 6) && S().vecinosDe(m, c).some(o => o && o.viva && (c.rel[o.id] || 0) < -20)) {
      const cs = COSTES[OBRA.torre], res = S().reservaMejora(m, c) || {};
      if (c.madera - (res.madera || 0) >= cs[0] && c.piedra - (res.piedra || 0) >= cs[1] && (c.oro || 0) - (res.oro || 0) >= cs[2] && (c.nivel || 0) >= (NIVEL_OBRA[OBRA.torre] || 0)) {
        const sd = sitioDefensa(m, c, ter);
        if (sd != null) { (c.enCurso = c.enCurso || {}).fronteraT = m.turno; return [sd, OBRA.torre]; }
      }
    }
    for (const r of plazas.slice(0, 3)) {
      const zona = [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)];
      const tiles = zona.flatMap(z => parcelas(m, z));
      const tiene = o => tiles.some(t => v.obra[t] === o || (v.andamios && v.andamios[t] && v.andamios[t].o === o)) || enSede(m, r, o);
      const libreEn = (lista, ok) => lista.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && !calleDelPlan(m, t) && ok(t)).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
      // El sitio de un molino nuevo: tierra de cultivo fuera del casco, lejos de los otros molinos, lo más cerca posible del pueblo.
      const sitioMolino = () => tiles.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && CULTIVABLE.has(ter[t]) && !enCasco(m, t) && !tiles.some(u => v.obra[u] === OBRA.molino && dist(m, u, t) < rangoMolino(m) * 2 - 1)).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
      const pide = [];
      if (!tiene(OBRA.molino)) pide.push([OBRA.molino, () => (pausada(m) ? sitioMolino() : null) || libreEn(tiles, t => CULTIVABLE.has(ter[t]))]);
      else if (pausada(m) && c.campos < metaCampos(c) && !(c.enCurso && c.enCurso[OBRA.molino] > m.turno - 8) && tiles.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && CULTIVABLE.has(ter[t]) && !enCasco(m, t) && molinoCerca(m, c, null, t)).length < 3) {
        // Los molinos que hay ya no dan para más campos: otro en el borde de la huerta.
        pide.unshift([OBRA.molino, sitioMolino]);
      }
      if (c.era >= 1 && !tiene(OBRA.torre)) pide.push([OBRA.torre, () => libreEn(parcelas(m, r), t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && !tiene(OBRA.templo)) pide.push([OBRA.templo, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // La casa del saber (cabaña del chamán, academia, monasterio, universidad, laboratorio): donde estudian los eruditos.
      if (!tiene(OBRA.saber) && (r === c.capital || c.era >= 3)) pide.push([OBRA.saber, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // Lo militar, según la fase: cuartel de soldados y arquería en la capital desde el Bronce, y un castillo
      // (luego fortaleza o búnker) en una plaza de frontera desde la Edad del Hierro.
      if (c.era >= 1 && r === c.capital && !(c.cuarteles > 0) && !tiene(OBRA.cuartel)) pide.push([OBRA.cuartel, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && r === c.capital && !(c.arquerias > 0) && !tiene(OBRA.arqueria)) pide.push([OBRA.arqueria, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 2 && !(c.castillos > 0) && (plazaFronteriza(m, c, r, plazas) || (c.plan && c.plan.obra === 'castillo' && r === c.capital))) pide.push([OBRA.castillo, () => libreEn(parcelas(m, r), t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // El control fronterizo (desde la Revolución Industrial): un puesto con barrera y guardias donde cada
      // carretera de comercio sale de su tierra.
      if (r === c.capital && c.era >= ERA_OBRA[OBRA.aduana]) { const pf = pasoSinPuesto(m, c, ter); if (pf) pide.push([OBRA.aduana, () => pf.sitio]); }
      // Las torres de la frontera, frente a los rivales (en guerra, antes que casi todo).
      if (r === c.capital && c.era >= 1 && m.turno % 2 === c.id % 2) { const sd = sitioDefensa(m, c, ter); if (sd != null) pide.splice(Math.min(c.guerras.length || (c.plan && c.plan.fortificar) ? 1 : 3, pide.length), 0, [OBRA.torre, () => sd]); }
      // La mina: en la montaña más cercana (solo ahí), una galería que no se agota (pero da poco a poco).
      // (Una más cada dos edades, hasta cuatro: la mina es de donde sale el metal de verdad.)
      if (r === c.capital && c.era >= ERA_OBRA[OBRA.mina] && (c.minas || 0) < (pausada(m) ? Math.min(4, 1 + Math.floor(c.era / 2)) : 1 + (c.era >= 4 ? 1 : 0)) && (c.aldeanos || 0) >= 12) {
        const sm = sitioMina(m, c, ter); if (sm != null) pide.push([OBRA.mina, () => sm]);
      }
      // El pozo de petróleo: sobre una bolsa de crudo de su tierra (uno por bolsa, hasta tres), si le hace falta o lo vende.
      if (r === c.capital && pausada(m) && c.era >= ERA_OBRA[OBRA.petroleo] && v.crudo && (c.pozosPetroleo || 0) < 3 && ((c.petroleo || 0) < objetivo(c, 'petroleo') * 1.5 || (c.cartera && c.cartera.petroleo))) {
        const sitio = sitioPetroleo(m, c, ter);
        if (sitio != null) pide.unshift([OBRA.petroleo, () => sitio]);
      }
      // El puerto, en el mar abierto (en un lago no lleva a ninguna parte): uno por reino, y otro en cada ciudad de costa.
      // El primero va justo detrás del molino: da pescado y abre el comercio y las rutas por mar (y no espera al ahorro).
      if (!tiene(OBRA.puerto) && (r === c.capital ? !(c.puertos > 0) : true)) { const sp = r === c.capital ? sitioPuerto(m, c, ter) : libreEn(tiles, t => (ter[t] === 'arena' || CONSTRUIBLE.has(ter[t])) && !navegable(ter, t) && enMarAbierto(m, t, ter)); if (sp != null) pide.splice(r === c.capital ? Math.min(1, pide.length) : pide.length, 0, [OBRA.puerto, () => sp]); }
      // Lo que la gente necesita de verdad (agua, sitio para el grano, una plaza, un parque, un palacio), según el pueblo.
      if (pausada(m)) for (const n of (c.necesidades || [])) if (n.falta && n.region === r && !tiene(OBRA[n.obra]) && !pide.some(x => x[0] === OBRA[n.obra])) {
        const o = OBRA[n.obra];
        // Si la ciudad ya está llena, la obra pública se levanta sobre la huerta más cercana al centro.
        const huerta = lista => lista.filter(t => v.obra[t] === OBRA.campo && !v.camino[t]).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
        pide.splice(n.urgente ? 0 : Math.min(pide.length, 1), 0, [o, () => libreEn(o === OBRA.fuente || o === OBRA.palacio ? parcelas(m, r) : tiles, t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t])) || huerta(parcelas(m, r)) || huerta(tiles)]);
      }
      // Lo que pide la edad siguiente (un templo, un cuartel, un castillo) se levanta en la capital, y antes que nada.
      const pideEdad = M.EDADES[c.era + 1] && M.EDADES[c.era + 1].pide.obra ? OBRA[M.EDADES[c.era + 1].pide.obra] : null;
      const cuentaDe = { [OBRA.templo]: 'templos', [OBRA.cuartel]: 'cuarteles', [OBRA.castillo]: 'castillos' };
      if (pideEdad && r === c.capital && !(c[cuentaDe[pideEdad]] > 0) && !tiene(pideEdad) && !pide.some(x => x[0] === pideEdad) && (pideEdad !== OBRA.castillo || c.era >= 2)) pide.unshift([pideEdad, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      else if (pideEdad && r === c.capital) { const i = pide.findIndex(x => x[0] === pideEdad); if (i > 0) pide.unshift(pide.splice(i, 1)[0]); }
      // Lo que pidió el jugador va primero; cuando ya está hecho en la plaza, se olvida el encargo.
      const encargo = c.plan && c.plan.obra ? OBRA[c.plan.obra] : null;
      // (Terminado de verdad: con el andamio puesto aún no está hecho, y el encargo sigue en pie hasta acabarlo.)
      const hecho = o => tiles.some(t => v.obra[t] === o) || [...Object.keys(v.sede || {})].some(t => v.sede[t] === r && v.obra[t] === o);
      if (encargo && r === c.capital && tiene(encargo) && !hecho(encargo)) { const i = pide.findIndex(x => x[0] === encargo); if (i >= 0) pide.splice(i, 1); }
      else if (encargo && r === c.capital && hecho(encargo)) {
        const NOMBRES = { [OBRA.pozo]: 'El pozo', [OBRA.granero]: 'El granero', [OBRA.fuente]: 'La plaza pública', [OBRA.parque]: 'El parque', [OBRA.palacio]: 'El palacio', [OBRA.central]: 'La central eléctrica', [OBRA.banco]: 'El banco central', [OBRA.fabrica]: 'La fábrica', [OBRA.estacion]: 'La estación de tren', [OBRA.hospital]: 'El hospital', [OBRA.aerodromo]: 'El aeródromo', [OBRA.saber]: 'La casa del saber', [OBRA.templo]: 'El templo', [OBRA.torre]: 'La torre', [OBRA.puerto]: 'El puerto', [OBRA.molino]: 'El molino', [OBRA.cuartel]: 'El cuartel', [OBRA.arqueria]: 'La arquería', [OBRA.castillo]: 'El castillo', [OBRA.aduana]: 'El puesto fronterizo', [OBRA.petroleo]: 'El pozo de petróleo', [OBRA.mina]: 'La mina' };
        S().cronica(m, 'obra', (NOMBRES[encargo] || 'La obra') + ' de ' + c.nombre + (encargo === OBRA.torre || encargo === OBRA.arqueria || encargo === OBRA.fuente || encargo === OBRA.central || encargo === OBRA.fabrica || encargo === OBRA.estacion ? ' está terminada' : ' está terminado'), 'Los constructores de ' + c.nombre + ' terminan lo que su gobierno les encargó y lo celebran con una fiesta en la plaza.', c);
        c.plan.obra = null;
      }
      else if (encargo && r === c.capital) {
        if (!pide.some(x => x[0] === encargo)) { const huerta = lista => lista.filter(t => v.obra[t] === OBRA.campo && !v.camino[t]).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0]; pide.push([encargo, () => libreEn(encargo === OBRA.fuente || encargo === OBRA.palacio ? parcelas(m, r) : tiles, t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t])) || (PUBLICAS.has(encargo) ? huerta(tiles) : null)]); }
        const solo = pide.filter(x => x[0] === encargo || x[0] === OBRA.molino); pide.length = 0; pide.push(...solo.sort((x, y) => (y[0] === encargo) - (x[0] === encargo))); }
      for (const [obra, donde] of pide) {
        // Si otro constructor ya va a levantar este edificio, no se empieza otro igual.
        if (c.enCurso && c.enCurso[obra] > m.turno - 3) continue;
        const coste = COSTES[obra];
        // Lo que se guarda para la mejora de la edad no se gasta en obras (salvo en el molino, que da de comer, y en
        // los pozos y las minas, que dan lo que hace falta para todo lo demás).
        const res = obra === OBRA.molino || obra === OBRA.petroleo || obra === OBRA.mina || obra === OBRA.puerto ? null : S().reservaMejora(m, c), rs = k => (res && res[k]) || 0;
        if (c.madera - rs('madera') < coste[0] || c.piedra - rs('piedra') < coste[1] || (c.oro || 0) - rs('oro') < (coste[2] || 0) || (c.nivel || 0) < (NIVEL_OBRA[obra] || 0)) continue;
        // Ahorrando para la edad, solo se levanta lo que la edad pide (o lo que mandó el jugador).
        const pideEdad = M.EDADES[c.era + 1] && M.EDADES[c.era + 1].pide.obra && OBRA[M.EDADES[c.era + 1].pide.obra] === obra;
        const necesaria = (c.necesidades || []).some(n => n.falta && OBRA[n.obra] === obra);
        // (Los pozos de petróleo y las minas no esperan: dan lo que hace falta para todo lo demás.)
        if (S().ahorrando(m, c) && (coste[2] || 0) > 0 && !pideEdad && !necesaria && obra !== OBRA.petroleo && obra !== OBRA.mina && obra !== OBRA.puerto && !(obra === OBRA.torre && (c.guerras.length || (c.plan && c.plan.fortificar))) && !(c.plan && c.plan.obra && OBRA[c.plan.obra] === obra)) continue;
        let t = donde();
        // Ciudad llena: las obras públicas se levantan más lejos (hasta dos comarcas), y siguen siendo de esta ciudad.
        if (t == null && pausada(m) && LEJOS_OK.has(obra)) { t = sitioPara(m, c, CLAVE_OBRA[obra], [r]); if (t != null) (v.sede = v.sede || {})[t] = r; }
        if (t != null) { if (obra !== OBRA.molino || pausada(m)) (c.enCurso = c.enCurso || {})[obra] = m.turno; return [t, obra]; }
      }
    }
    return null;
  }
