  // ── GÉNESIS · LA VIDA · Los edificios de cada plaza: alumbrado, necesidades, cultivos y el arquitecto ──

  /*
   * LOS EDIFICIOS DE CADA PLAZA (capital y ciudades), como en WorldBox: una torre de vigilancia, un templo,
   * un molino junto a los campos (desde la Edad Media) y un puerto si hay costa. Cuestan madera y piedra.
   */
  // Madera, piedra y oro de cada edificio; y el nivel de asentamiento que hace falta (aldea, pueblo, villa).
  const COSTES = { [OBRA.casa]: [2, 0, 0], [OBRA.saber]: [6, 2, 0], [OBRA.torre]: [6, 4, 4], [OBRA.templo]: [8, 6, 10], [OBRA.molino]: [3, 0, 0], [OBRA.puerto]: [10, 0, 8], [OBRA.cuartel]: [10, 6, 12], [OBRA.arqueria]: [10, 2, 8], [OBRA.castillo]: [16, 24, 30], [OBRA.pozo]: [2, 4, 0], [OBRA.granero]: [8, 2, 0], [OBRA.fuente]: [2, 8, 4], [OBRA.parque]: [4, 2, 6], [OBRA.palacio]: [20, 30, 40], [OBRA.central]: [10, 30, 45], [OBRA.banco]: [6, 14, 20], [OBRA.fabrica]: [14, 20, 25], [OBRA.estacion]: [16, 14, 20], [OBRA.hospital]: [10, 16, 20], [OBRA.aerodromo]: [12, 24, 30], [OBRA.aduana]: [6, 10, 8], [OBRA.petroleo]: [8, 10, 12], [OBRA.mina]: [8, 2, 2] };
  const TRABAJO = { [OBRA.casa]: 2, [OBRA.saber]: 4, [OBRA.torre]: 4, [OBRA.templo]: 6, [OBRA.molino]: 3, [OBRA.puerto]: 4, [OBRA.cuartel]: 5, [OBRA.arqueria]: 4, [OBRA.castillo]: 12, [OBRA.pozo]: 2, [OBRA.granero]: 3, [OBRA.fuente]: 4, [OBRA.parque]: 3, [OBRA.palacio]: 14, [OBRA.central]: 10, [OBRA.banco]: 6, [OBRA.fabrica]: 8, [OBRA.estacion]: 7, [OBRA.hospital]: 6, [OBRA.aerodromo]: 8, [OBRA.ayuntamiento]: 6, [OBRA.aduana]: 4, [OBRA.petroleo]: 5, [OBRA.mina]: 5 };
  const NIVEL_OBRA = { [OBRA.saber]: 1, [OBRA.torre]: 1, [OBRA.puerto]: 0, [OBRA.templo]: 2, [OBRA.cuartel]: 2, [OBRA.arqueria]: 2, [OBRA.castillo]: 3, [OBRA.molino]: 0, [OBRA.pozo]: 0, [OBRA.granero]: 1, [OBRA.fuente]: 2, [OBRA.parque]: 3, [OBRA.palacio]: 4, [OBRA.central]: 4, [OBRA.banco]: 3, [OBRA.fabrica]: 3, [OBRA.estacion]: 3, [OBRA.hospital]: 3, [OBRA.aerodromo]: 3, [OBRA.aduana]: 2, [OBRA.petroleo]: 1, [OBRA.mina]: 0 };
  // Desde qué edad existe cada edificio: no hay parques en el Neolítico ni centrales eléctricas en una aldea.
  const ERA_OBRA = { [OBRA.torre]: 1, [OBRA.templo]: 1, [OBRA.puerto]: 0, [OBRA.cuartel]: 1, [OBRA.arqueria]: 1, [OBRA.castillo]: 2, [OBRA.fuente]: 1, [OBRA.palacio]: 1, [OBRA.parque]: 3, [OBRA.central]: 7, [OBRA.banco]: 5, [OBRA.fabrica]: 6, [OBRA.estacion]: 6, [OBRA.hospital]: 7, [OBRA.aerodromo]: 7, [OBRA.aduana]: 6, [OBRA.petroleo]: 7, [OBRA.mina]: 1 };
  // El gremio de mercaderes (desde la Edad Media) y la casona del mercader rico (palacete en el Renacimiento,
  // mansión desde la Revolución Industrial): los paga su dueño, comprándole al reino la madera y la piedra.
  COSTES[OBRA.gremio] = [12, 6, 6]; TRABAJO[OBRA.gremio] = 7; NIVEL_OBRA[OBRA.gremio] = 2; ERA_OBRA[OBRA.gremio] = 4;
  COSTES[OBRA.casona] = [10, 8, 4]; TRABAJO[OBRA.casona] = 6; NIVEL_OBRA[OBRA.casona] = 2; ERA_OBRA[OBRA.casona] = 4;
  // La mina de una compañía minera (Revolución Industrial): la abre un capitalista en la montaña, con sus obreros.
  COSTES[OBRA.minapriv] = [6, 6, 4]; TRABAJO[OBRA.minapriv] = 6; NIVEL_OBRA[OBRA.minapriv] = 2; ERA_OBRA[OBRA.minapriv] = 6;
  COSTES[OBRA.inmopriv] = [8, 8, 6]; TRABAJO[OBRA.inmopriv] = 7; NIVEL_OBRA[OBRA.inmopriv] = 3; ERA_OBRA[OBRA.inmopriv] = 7;
  COSTES[OBRA.muelle] = [12, 4, 6]; TRABAJO[OBRA.muelle] = 5; NIVEL_OBRA[OBRA.muelle] = 2; ERA_OBRA[OBRA.muelle] = 4;
  COSTES[OBRA.bancopriv] = [8, 10, 6]; TRABAJO[OBRA.bancopriv] = 6; NIVEL_OBRA[OBRA.bancopriv] = 2; ERA_OBRA[OBRA.bancopriv] = 6;
  const NOMBRE_ERA = ['el Neolítico', 'la Edad del Bronce', 'la Edad del Hierro', 'la Antigüedad clásica', 'la Edad Media', 'el Renacimiento', 'la Revolución Industrial', 'la Era Moderna', 'la II Guerra Mundial'];
  /*
   * EL ALUMBRADO de las calles, según la época y lo que haya (no se construye: llega con el progreso):
   *  · faroles de aceite en las plazas de la Edad Media y el Renacimiento (de pueblo para arriba);
   *  · farolas de gas victorianas por las calles en la Revolución Industrial (de villa para arriba);
   *  · farolas eléctricas en la Era Moderna, pero solo donde hay una central eléctrica (que pide ser ciudad).
   */
  function alumbradoDe(c) {
    if (!c || !c.viva) return null;
    const n = c.nivel || 0;
    if (c.era >= 7 && (c.centrales || 0) > 0 && enMarcha(c, 'central')) return 'electrico';
    if (c.era >= 6 && n >= 3) return 'gas';
    if (c.era >= 4 && n >= 2) return 'aceite';
    return null;
  }
  // Lo que cabe en los graneros: un poco en cada casa y mucho más en cada granero de verdad.
  const topeComida = (c, n) => (15 + n * (c.estacion != null && c.estacion >= 0 ? 2 : 1.2) + (c.graneros || 0) * (40 + n)) * (1 + M.tec(c, 'granero'));
  /*
   * LAS NECESIDADES: cada edificio público existe porque hace falta, y se nota tanto tenerlo como no.
   *  · Pozo: una plaza lejos de río, lago o mar no tiene agua; nacen menos niños y enferma más gente.
   *  · Granero: cuando el grano ya no cabe, se pudre; con el invierno cerca, guardar es sobrevivir.
   *  · Plaza pública (con fuente): un pueblo necesita dónde reunirse, hacer mercado y fiestas.
   *  · Parque: una villa apretada de casas necesita aire y sombra; sin él la gente vive peor.
   *  · Palacio: una ciudad necesita una sede del gobierno; sin ella las ciudades obedecen menos.
   *  · Templo (luego iglesia y catedral): la fe de un pueblo de la Edad del Bronce en adelante.
   */
  const NECESIDADES = {
    pozo: { nombre: 'Agua', edificio: 'un pozo', bien: 'hay agua cerca para beber y apagar fuegos', mal: 'no hay río ni lago cerca: el agua se trae de lejos, nacen menos niños y se enferma más', estab: -3, animo: -12 },
    granero: { nombre: 'Granero', edificio: 'un granero', bien: 'el grano se guarda para el invierno', mal: 'el grano ya no cabe y se pudre; en invierno no habrá de qué vivir', estab: -1, animo: -6 },
    fuente: { nombre: 'Plaza pública', edificio: 'una plaza pública con fuente', bien: 'hay dónde reunirse, hacer mercado y fiestas', mal: 'un pueblo tan grande no tiene dónde reunirse: la gente se siente sola y desconfía', estab: -3, animo: -8 },
    parque: { nombre: 'Parque', edificio: 'un parque', bien: 'aire, sombra y juegos para los niños', mal: 'tantas casas juntas sin un árbol: se vive apretado y triste', estab: -2, animo: -8 },
    palacio: { nombre: 'Sede del gobierno', edificio: 'un palacio', bien: 'el gobierno tiene una sede digna y las ciudades lo respetan', mal: 'una ciudad gobernada desde una choza: las demás ciudades obedecen menos', estab: -3, animo: -4 },
    central: { nombre: 'Electricidad', edificio: 'una central eléctrica', bien: 'hay luz en las casas, farolas eléctricas y fuerza para los talleres', mal: 'una ciudad moderna a oscuras: sin electricidad no hay farolas eléctricas ni luz en las casas', estab: -3, animo: -6 },
    banco: { nombre: 'Banca', edificio: 'un banco central', bien: 'hay banco central: presta a los banqueros, que dan crédito a la gente', mal: 'sin banco no hay banca: ni banco central ni banqueros que presten', estab: 0, animo: 0 },
    fabrica: { nombre: 'Industria', edificio: 'una fábrica', bien: 'se fabrica en serie: más armas y la madera sobrante se vende hecha mueble', mal: 'todo se hace a mano en talleres: sin fábrica, la ciudad se queda atrás', estab: -2, animo: -3 },
    estacion: { nombre: 'Ferrocarril', edificio: 'una estación de tren', bien: 'el tren lleva el doble de carga y llega antes', mal: 'las mercancías siguen yendo en carreta: sin estación no llega el tren', estab: -1, animo: -2 },
    hospital: { nombre: 'Sanidad', edificio: 'un hospital', bien: 'los heridos se curan y la gente vive más años', mal: 'sin hospital, las heridas y las epidemias se llevan a mucha gente', estab: -3, animo: -6 },
    aerodromo: { nombre: 'Aviación', edificio: 'un aeródromo', bien: 'los aviones tienen de dónde despegar', mal: 'en plena guerra moderna, sin aeródromo no despega ni un avión', estab: -1, animo: 0 },
    templo: { nombre: 'Fe', edificio: 'un templo', bien: 'hay dónde rezar y enterrar a los muertos', mal: 'no hay dónde rezar: la gente teme a los dioses', estab: -2, animo: -6 }
  };
  const PUBLICAS = new Set([OBRA.pozo, OBRA.granero, OBRA.fuente, OBRA.parque, OBRA.palacio, OBRA.templo, OBRA.central, OBRA.banco, OBRA.fabrica, OBRA.estacion, OBRA.hospital, OBRA.aerodromo]);
  // Lo que se puede levantar sobre un huerto cuando no queda solar: las obras públicas y los edificios de los ricos.
  const SOBRE_HUERTO = new Set([...PUBLICAS, OBRA.gremio, OBRA.casona, OBRA.bancopriv, OBRA.inmopriv]);
  const AGUAS = new Set(['rio', 'agua', 'bajo', 'lago']);
  /*
   * LOS CULTIVOS según la tierra: trigo en la llanura, maíz en la selva y la sabana, arroz en los pantanos y
   * junto al agua caliente, viñas en las colinas. Cada uno rinde distinto, y el campo junto a un río o un lago
   * (a dos parcelas) tiene regadío y da más. Las viñas dan menos comida pero su vino se vende por oro.
   */
  function regadio(m, ter, t) {
    const tw = m.vida.tw, x0 = t % tw;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const u = t + dy * tw + dx; if (u >= 0 && u < ter.length && Math.abs((u % tw) - x0) <= 2 && AGUAS.has(ter[u])) return true; }
    return false;
  }
  function cultivoTipo(m, ter, t) {
    const tipo = ter[t], reg = regadio(m, ter, t);
    if (tipo === 'pantano' || (reg && (tipo === 'selva' || tipo === 'sakura'))) return 'arroz';
    if (tipo === 'selva' || tipo === 'sabana') return 'maiz';
    if (tipo === 'colina' || (tipo === 'desierto' && !reg)) return 'vina';
    return 'trigo';
  }
  const RINDE = { trigo: [2, 0], maiz: [2.5, 0], arroz: [2.2, 0], vina: [1, 0.9] };
  function hayAgua(m, ter, t) {
    const v = m.vida, x0 = t % v.tw, y0 = t / v.tw | 0;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < v.tw && y < v.th && AGUAS.has(ter[y * v.tw + x])) return true; }
    return false;
  }
  // Calcula qué le falta a cada pueblo (en la capital y en sus ciudades) y lo que eso le cuesta.
  function necesidades(m, c) {
    const v = m.vida, ter = terrenos(m), out = [];
    c.estacion = v.estacion;
    if (!pausada(m) || !c.viva) { c.necesidades = out; c.bienestar = 0; c.animo = 70; return out; }
    const nivel = c.nivel || 0, tope = topeComida(c, c.aldeanos || 0);
    const plazas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].slice(0, 4);
    for (const r of plazas) {
      const zona = [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)], tiles = zona.flatMap(z => parcelas(m, z));
      const hay = o => tiles.some(t => v.obra[t] === OBRA[o]) || enSede(m, r, OBRA[o]), cap = r === c.capital;
      const pon = (obra, falta, extra) => out.push(Object.assign({ obra, region: r, capital: cap, falta, tiene: hay(obra) }, NECESIDADES[obra], extra || {}));
      if (!hayAgua(m, ter, centro(m, r))) pon('pozo', !hay('pozo'), { urgente: 1 });
      if (cap && nivel >= 1) pon('granero', !hay('granero') && ((c.comida || 0) >= tope * 0.8 || (v.estacion === 2 && (c.comida || 0) >= tope * 0.5)), { urgente: v.estacion === 2 });
      if (cap && c.era >= 1) pon('templo', !hay('templo'));
      if (nivel >= 2 && (cap || nivel >= 3) && c.era >= ERA_OBRA[OBRA.fuente]) pon('fuente', !hay('fuente'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.parque]) pon('parque', !hay('parque'));
      if (cap && nivel >= 4 && c.era >= ERA_OBRA[OBRA.palacio]) pon('palacio', !hay('palacio'));
      if (cap && nivel >= 4 && c.era >= ERA_OBRA[OBRA.central]) pon('central', !hay('central'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.banco] && ((c.oro || 0) > 50 || (c.rutas || 0) >= 2)) pon('banco', !hay('banco'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.fabrica]) pon('fabrica', !hay('fabrica'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.estacion] && (c.rutas || 0) >= 1) pon('estacion', !hay('estacion'));
      if (nivel >= 3 && (cap || nivel >= 4) && c.era >= ERA_OBRA[OBRA.hospital]) pon('hospital', !hay('hospital'));
      if (AVIACION && cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.aerodromo] && (c.guerras.length || c.cuarteles > 0)) pon('aerodromo', !hay('aerodromo'));
    }
    c.necesidades = out;
    // Cada carencia cuenta una vez (la de la capital entera; la de otra ciudad, la mitad).
    const faltan = [], vistas = new Set();
    for (const n of out.filter(x => x.falta).sort((x, y) => y.capital - x.capital)) { if (vistas.has(n.obra)) continue; vistas.add(n.obra); faltan.push(n.capital ? n : Object.assign({}, n, { estab: n.estab / 2, animo: n.animo / 2 })); }
    c.bienestar = faltan.reduce((k, n) => k + n.estab, 0) + Math.min(7, out.filter(n => n.tiene).length * 1);
    // El ánimo de la gente (0-100): comida, casa, guerra, invierno y lo que falta en el pueblo.
    let animo = 66 + faltan.reduce((k, n) => k + n.animo, 0) + Math.min(14, out.filter(n => n.tiene).length * 2.5);
    if ((c.comida || 0) < (c.aldeanos || 0) * 0.15) animo -= 20;
    if (c.sinCama) animo -= 6;
    if (c.guerras && c.guerras.length) animo -= 8;
    if (v.estacion === 3 && (c.madera || 0) < 3) animo -= 12;
    // Calles alumbradas: se sale de noche sin miedo.
    c.alumbrado = alumbradoDe(c);
    if (c.alumbrado) animo += c.alumbrado === 'electrico' ? 6 : c.alumbrado === 'gas' ? 4 : 2;
    // Una fiesta se nota más con una plaza donde celebrarla.
    if (c.plan && c.plan.ultimaFiesta != null && m.turno - c.plan.ultimaFiesta <= 2) animo += c.fuentes > 0 ? 15 : 10;
    if (c.plan && c.plan.impuesto > 1) animo -= Math.round((c.plan.impuesto - 1) * 25);
    c.animo = Math.max(0, Math.min(100, Math.round(animo)));
    return out;
  }
  // El ánimo de cada aldeano: el del pueblo, más lo suyo (casa propia, hambre, oficio, edad, carácter).
  function animoDe(m, a) {
    const c = S().civ(m, a.c);
    if (!c) return 50;
    let k = c.animo == null ? 70 : c.animo;
    const v = m.vida;
    if (a.casa == null || ![OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento].includes(v.obra[a.casa])) k -= 10;
    if (a.o === GUERRERO && c.guerras.length) k -= 6;
    if (tiene(a, 'perezoso')) k += 4; if (tiene(a, 'valiente') && c.guerras.length) k += 6;
    k += ((a.id * 37) % 11) - 5;
    return Math.max(0, Math.min(100, Math.round(k)));
  }
  /*
   * EL ARQUITECTO: el jugador toca el mapa y deja encargado dónde va cada edificio (c.plan.encargos) o cada calle
   * (v.pendientes). Los constructores los hacen por orden, en cuanto haya con qué pagarlos.
   */
  const EDIFICABLES = ['casa', 'pozo', 'granero', 'fuente', 'parque', 'palacio', 'central', 'banco', 'fabrica', 'estacion', 'hospital', 'aerodromo', 'templo', 'saber', 'molino', 'torre', 'puerto', 'cuartel', 'arqueria', 'castillo', 'petroleo', 'mina'];
  // «marcado»: el encargo ya lo dejó el jugador; su plano manda sobre las calles que el pueblo planee después.
  function puedeColocar(m, c, t, clave, marcado) {
    const v = m.vida, ter = terrenos(m);
    if (!c || !c.viva) return 'no tienes pueblo';
    if (t < 0 || t >= v.tw * v.th) return 'fuera del mapa';
    if (clave === 'colonia') return razonColonia(m, c, region(m, t));
    if (m.dueno[region(m, t)] !== c.id) return 'esa tierra no es tuya';
    if (clave === 'camino') return v.camino[t] ? 'ya hay calle' : v.obra[t] && v.obra[t] !== OBRA.campo ? 'hay un edificio' : andable(ter[t]) || ter[t] === 'rio' ? null : 'ahí no se puede';
    const o = OBRA[clave];
    if (!o) return 'no se sabe construir eso';
    if (v.obra[t] && !(v.obra[t] === OBRA.campo && SOBRE_HUERTO.has(o))) return 'ya hay algo construido';
    if (v.andamios && v.andamios[t]) return 'ya hay una obra';
    if (v.camino[t]) return 'es una calle';
    if (esVia(v, t)) return 'por ahí pasa la vía del tren';
    if (v.trinchera && v.trinchera[t]) return 'ahí hay una trinchera';
    if (v.muro && v.muro[t] > 0) return 'ahí está la muralla';
    if (v.corralT && v.corralT[t]) return 'ahí está el corral del ganado';
    if (!marcado && pausada(m) && v.plan && v.plan[t] === 1) return 'ahí va una calle del plano';
    if (o === OBRA.mina || o === OBRA.minapriv) { if (ter[t] !== 'montana') return 'la mina solo se abre en la montaña'; }
    else if (o === OBRA.puerto || o === OBRA.muelle ? !((ter[t] === 'arena' || CONSTRUIBLE.has(ter[t])) && !navegable(ter, t) && [1, -1, v.tw, -v.tw].some(d => ter[t + d] === 'agua' || ter[t + d] === 'bajo')) : !CONSTRUIBLE.has(ter[t])) return o === OBRA.puerto ? 'el puerto va en la arena, junto al mar' : 'ahí no se puede construir';
    if (c.era < (ERA_OBRA[o] || 0)) return 'aún no existe: llega con ' + NOMBRE_ERA[ERA_OBRA[o]];
    if (o === OBRA.petroleo && !(v.crudo && v.crudo[t])) return 'ahí no hay petróleo: busca las manchas negras';
    if ((c.nivel || 0) < (NIVEL_OBRA[o] || 0)) return 'hace falta ser ' + ['un campamento', 'una aldea', 'un pueblo', 'una villa', 'una ciudad'][NIVEL_OBRA[o]];
    return null;
  }
  // Deja (o quita, si ya estaba) un encargo del arquitecto en esa parcela.
  function encargar(m, c, t, clave) {
    const v = m.vida, p = c.plan = c.plan || {};
    p.encargos = p.encargos || [];
    // «Fundar pueblo»: el sitio exacto donde irán los colonos (otra vez en el mismo sitio, se anula).
    if (clave === 'colonia') {
      const r = region(m, t);
      if (p.colonos === r) { p.colonos = null; return { ok: true, quitado: true }; }
      const no = puedeColocar(m, c, t, clave); if (no) return { ok: false, razon: no };
      p.colonos = r; return { ok: true, colonia: true, via: viaColonia(m, c, r, false) };
    }
    const i = p.encargos.findIndex(e => e.t === t);
    if (i >= 0) { p.encargos.splice(i, 1); return { ok: true, quitado: true }; }
    if (clave === 'camino') {
      const pend = (v.pendientes = v.pendientes || {})[c.id] = v.pendientes[c.id] || [];
      const j = pend.indexOf(t);
      if (j >= 0) { pend.splice(j, 1); return { ok: true, quitado: true }; }
      const no = puedeColocar(m, c, t, clave); if (no) return { ok: false, razon: no };
      pend.unshift(t); return { ok: true };
    }
    const no = puedeColocar(m, c, t, clave);
    if (no) return { ok: false, razon: no };
    p.encargos.push({ t, o: OBRA[clave], clave });
    return { ok: true };
  }
  function colocarObra(m, t, o, paso) {
    const v = m.vida;
    cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 0, paso); cambiar(m, 'obra', t, o, paso);
    if (o === OBRA.torre) (v.torres = v.torres || {})[t] = 12;
    if (o === OBRA.castillo) (v.torres = v.torres || {})[t] = 40;
    if (o === OBRA.aduana) (v.torres = v.torres || {})[t] = 20;
    // Alrededor de la plaza pública y del palacio se empiedra una explanada de adoquín (lo libre que haya).
    if (o === OBRA.fuente || o === OBRA.palacio) {
      const ter = terrenos(m), tx = t % v.tw;
      for (const d of [-1, 1, -v.tw, v.tw, -v.tw - 1, -v.tw + 1, v.tw - 1, v.tw + 1]) {
        const u = t + d, ux = u % v.tw;
        if (u < 0 || u >= v.tw * v.th || Math.abs(ux - tx) > 1 || v.obra[u] || v.camino[u] || v.roca[u] || !CONSTRUIBLE.has(ter[u]) || (v.andamios && v.andamios[u])) continue;
        cambiar(m, 'arbol', u, 0, paso); cambiar(m, 'camino', u, 1, paso);
      }
    }
  }
  // LAS OBRAS SE PAGAN POCO A POCO (partidas pausadas): al empezar, una cuarta parte; el resto, a medida que los
  // constructores avanzan en el andamio. Sin material, la obra espera (no se pierde lo hecho).
  function pagarAndamio(c, an, hasta) {
    if (!an.coste) return true;
    const ya = an.pagado || 0, f = Math.min(1, hasta);
    if (f <= ya + 1e-9) return true;
    const d = f - ya, q = [an.coste[0] * d, an.coste[1] * d, (an.coste[2] || 0) * d];
    if (c.madera < q[0] || c.piedra < q[1] || (c.oro || 0) < q[2]) return false;
    c.madera -= q[0]; c.piedra -= q[1]; c.oro = (c.oro || 0) - q[2]; an.pagado = f;
    return true;
  }
  // Una obra privada (la fábrica de un empresario) la paga su dueño con su préstamo, no el reino.
  const privada = (v, t, c) => !!(v.privados && v.privados[t] && v.privados[t].civ === c.id);
  function pagarObra(c, o) {
    const coste = COSTES[o] || [0, 0, 0];
    if (c.madera < coste[0] || c.piedra < coste[1] || (c.oro || 0) < (coste[2] || 0)) return false;
    c.madera -= coste[0]; c.piedra -= coste[1]; c.oro = (c.oro || 0) - (coste[2] || 0);
    return true;
  }
  // La plaza más expuesta (la que tiene otro reino más cerca); si no hay vecinos, la capital.
  function plazaFronteriza(m, c, r, plazas) {
    const todas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    const peligro = p => { let d = 99; for (let q = 0; q < m.W * m.H; q++) if (m.dueno[q] >= 0 && m.dueno[q] !== c.id) d = Math.min(d, S().distancia(p, q)); return d; };
    const clave = 'frontera:' + c.id;
    if (!memo.has(clave)) memo.set(clave, todas.slice().sort((p, q) => peligro(p) - peligro(q))[0]);
    return memo.get(clave) === r;
  }
  /**
   * LOS PASOS FRONTERIZOS: dónde sale cada carretera de comercio (ruta externa) de la tierra de un reino.
   * Es la última parcela suya del camino antes de pisar tierra ajena. Allí, en la era moderna, se levanta
   * un puesto fronterizo pegado a la carretera.
   */
  // Un comerciante pasa junto a un puesto fronterizo: le paran a revisar la carga (y, si es de otro reino, paga).
  function controlFronterizo(m, a, c, t, paso) {
    const v = m.vida, tw = v.tw, tx = t % tw, ty = t / tw | 0;
    for (const o of S().vivas(m)) for (const pf of o.aduanas || []) {
      if (Math.abs(pf % tw - tx) > 1 || Math.abs((pf / tw | 0) - ty) > 1) continue;
      a.pasados = a.pasados || [];
      if (a.pasados.includes(pf)) continue;
      a.pasados.push(pf);
      // Se para en la barrera mientras le revisan la carga; si el puesto es de otro reino, paga el arancel.
      a.retenido = 2; a.controlEn = pf;
      const reg = (v.aduanas = v.aduanas || {})[pf] = v.aduanas[pf] || { controles: 0, arancel: 0 };
      reg.controles++;
      if (o.id !== c.id) { const paga = Math.min(1, Math.max(0, c.oro || 0)); c.oro -= paga; o.oro = (o.oro || 0) + paga; reg.arancel += paga; }
      return true;
    }
    return false;
  }
  function pasosFronterizos(m, c) {
    const v = m.vida, out = [];
    for (const ru of v.rutas) {
      if (ru.tipo !== 'externa' || (ru.a !== c.id && ru.b !== c.id) || !rutaActiva(m, ru)) continue;
      const tl = ru.tiles, suyo = t => m.dueno[region(m, t)] === c.id;
      for (let i = 0; i + 1 < tl.length; i++) {
        if (suyo(tl[i]) && !suyo(tl[i + 1])) out.push({ t: tl[i], ruta: ru.id, i, dir: 1 });
        else if (!suyo(tl[i]) && suyo(tl[i + 1])) out.push({ t: tl[i + 1], ruta: ru.id, i: i + 1, dir: -1 });
      }
    }
    return out;
  }
  // El primer paso de la frontera que aún no tiene puesto (con el sitio libre donde levantarlo, junto a la carretera).
  function pasoSinPuesto(m, c, ter) {
    const v = m.vida, tw = v.tw, pasos = pasosFronterizos(m, c);
    // Uno por paso: si la raya se mueve, el puesto viejo sigue sirviendo hasta que lo pierdan.
    if ((c.aduanas || []).length >= pasos.length) return null;
    for (const p of pasos) {
      const px = p.t % tw, py = p.t / tw | 0;
      let hay = false;
      for (let dy = -4; dy <= 4 && !hay; dy++) for (let dx = -4; dx <= 4; dx++) { const u = (py + dy) * tw + px + dx; if (u >= 0 && u < v.obra.length && m.dueno[region(m, u)] === c.id && (v.obra[u] === OBRA.aduana || (v.andamios && v.andamios[u] && v.andamios[u].o === OBRA.aduana))) { hay = true; break; } }
      if (hay) continue;
      const ru = v.rutas.find(x => x.id === p.ruta), enRuta = new Set(ru.tiles);
      let sitio = null;
      // Pegado al camino, en las últimas parcelas propias antes de la raya.
      for (let k = 0; k < 4 && sitio == null; k++) {
        const base = ru.tiles[p.i - p.dir * k];
        if (base == null || m.dueno[region(m, base)] !== c.id) break;
        const bx = base % tw;
        for (const d of [-tw, tw, -1, 1, -tw - 1, -tw + 1, tw - 1, tw + 1]) {
          const u = base + d;
          if (u < 0 || u >= v.obra.length || Math.abs((u % tw) - bx) > 1 || enRuta.has(u)) continue;
          if (v.obra[u] || v.roca[u] || v.camino[u] || calleDelPlan(m, u) || !CONSTRUIBLE.has(ter[u]) || m.dueno[region(m, u)] !== c.id || (v.andamios && v.andamios[u])) continue;
          sitio = u; break;
        }
      }
      if (sitio != null) return Object.assign({ sitio }, p);
    }
    return null;
  }
