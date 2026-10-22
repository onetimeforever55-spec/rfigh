  // ── GÉNESIS · LA VIDA · Cada familia en su casa, el recuento, las tierras y los poderes del dios ──

  /*
   * CADA FAMILIA EN SU CASA: las casas tienen camas (3, más con la técnica; la casona 5; el ayuntamiento y el
   * campamento 3; el centro del pueblo 2) y cada aldeano vive en una de verdad: allí duerme y allí se le ve
   * volver de noche. Se conserva la casa si cabe; si no, va con su pareja o sus padres; y si no, a la casa con
   * sitio más cercana a su pueblo. Si no queda sitio en ninguna, vive sin casa (duerme fuera, y se le nota en el ánimo).
   */
  const VIVIENDA = new Set([OBRA.casa, OBRA.casona, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento]);
  function camasDe(v, t, extra) { const o = v.obra[t]; return o === OBRA.casa ? 3 + Math.round(extra || 0) : o === OBRA.casona ? 5 : o === OBRA.centro ? 2 : 3; }
  function asignarCasas(m) {
    // (Las viviendas se leen del mapa cada vez: así dos copias del mundo, en dos navegadores, reparten igual.)
    const v = m.vida, todas = {};
    for (let t = 0; t < v.obra.length; t++) if (VIVIENDA.has(v.obra[t])) { const d = m.dueno[region(m, t)]; if (d >= 0) (todas[d] = todas[d] || []).push(t); }
    const porCiv = {};
    // (Los que van embarcados o de colonos no se mueven de casa, pero guardan su cama: así no vuelven a una casa llena.)
    const fuera = a => a.colono != null || a.aBordo != null, ausentes = {};
    for (const a of v.aldeanos) if (!fuera(a)) (porCiv[a.c] = porCiv[a.c] || []).push(a); else if (a.casa != null) (ausentes[a.c] = ausentes[a.c] || []).push(a.casa);
    for (const c of S().vivas(m)) {
      const lista = porCiv[c.id]; if (!lista) continue;
      const extra = M.tec(c, 'casa'), cap = new Map();
      for (const t of todas[c.id] || []) if (VIVIENDA.has(v.obra[t]) && m.dueno[region(m, t)] === c.id) cap.set(t, camasDe(v, t, extra));
      const ocupa = new Map(), porId = new Map(lista.map(a => [a.id, a]));
      for (const t of ausentes[c.id] || []) if (cap.has(t)) ocupa.set(t, (ocupa.get(t) || 0) + 1);
      const hay = t => t != null && cap.has(t) && (ocupa.get(t) || 0) < cap.get(t);
      const entra = (a, t) => { a.casa = t; ocupa.set(t, (ocupa.get(t) || 0) + 1); };
      // Primero los adultos (los niños van con ellos), y siempre en el mismo orden.
      const orden = S().ordenarPor(lista.slice(), a => (esNino(a) ? 1e9 : 0) + a.id);
      // El mercader con casona vive en ella.
      const ya = new Set();
      for (const a of orden) if (a.merc && a.merc.casona != null && v.obra[a.merc.casona] === OBRA.casona && hay(a.merc.casona)) { entra(a, a.merc.casona); ya.add(a); }
      const sinCasa = [];
      for (const a of orden) { if (ya.has(a)) continue; if (hay(a.casa)) entra(a, a.casa); else sinCasa.push(a); }
      if (!sinCasa.length) continue;
      // Las casas con sitio, por comarca.
      const libres = new Map();
      for (const [t, k] of cap) if ((ocupa.get(t) || 0) < k) { const r = region(m, t); if (!libres.has(r)) libres.set(r, []); libres.get(r).push(t); }
      const tomar = r => { const l = libres.get(r); if (!l) return null; while (l.length && !hay(l[0])) l.shift(); if (!l.length) { libres.delete(r); return null; } return l[0]; };
      for (const a of sinCasa) {
        const pareja = a.pareja != null ? porId.get(a.pareja) : null, padre = esNino(a) ? porId.get(a.padre) || porId.get(a.madre) : null;
        let t = pareja && hay(pareja.casa) ? pareja.casa : padre && hay(padre.casa) ? padre.casa : null;
        if (t == null) t = tomar(a.h);
        if (t == null) for (const r of S().vecinos(a.h)) { t = tomar(r); if (t != null) break; }
        if (t == null && libres.size) { let md = 1e9; for (const r of libres.keys()) { const d = S().distancia(r, a.h); if (d < md) { const x = tomar(r); if (x != null) { md = d; t = x; } } } }
        if (t != null) entra(a, t); else a.casa = null;
      }
      juntarFamilias(orden, porId, hay, ocupa, entra);
    }
  }
  // Las parejas viven juntas, y los niños con sus padres: si en la casa de uno hay sitio, el otro se muda allí;
  // si las dos están llenas, se cambia la casa con un vecino que no tenga allí a su familia.
  function juntarFamilias(orden, porId, hay, ocupa, entra) {
    const vecinos = new Map();
    for (const a of orden) if (a.casa != null) { if (!vecinos.has(a.casa)) vecinos.set(a.casa, []); vecinos.get(a.casa).push(a); }
    const quitar = a => { const l = vecinos.get(a.casa); if (l) l.splice(l.indexOf(a), 1); };
    const poner = (a, t) => { a.casa = t; if (!vecinos.has(t)) vecinos.set(t, []); vecinos.get(t).push(a); };
    const mudar = (a, t) => { if (a.casa != null) { ocupa.set(a.casa, (ocupa.get(a.casa) || 1) - 1); quitar(a); } entra(a, t); poner(a, t); };
    const suelto = (x, t) => !x.merc && !(vecinos.get(t) || []).some(y => y !== x && (y.id === x.pareja || y.padre === x.id || y.madre === x.id || x.padre === y.id || x.madre === y.id));
    const cambiar = (a, t) => { const x = (vecinos.get(t) || []).find(y => !esNino(y) && suelto(y, t)); if (!x || a.casa == null) return false; const ta = a.casa; quitar(a); quitar(x); poner(a, t); poner(x, ta); return true; };
    const fija = a => a.merc && a.casa === a.merc.casona;
    for (const a of orden) {
      const b = a.pareja != null ? porId.get(a.pareja) : null;
      if (!b || esNino(a) || a.casa === b.casa || a.id > b.id) continue;
      if (a.casa != null && hay(a.casa) && !fija(b)) mudar(b, a.casa);
      else if (b.casa != null && hay(b.casa) && !fija(a)) mudar(a, b.casa);
      else if (b.casa != null && !fija(a) && cambiar(a, b.casa)) continue;
      else if (a.casa != null && !fija(b)) cambiar(b, a.casa);
    }
    for (const a of orden) {
      if (!esNino(a)) continue;
      const p = porId.get(a.padre) || porId.get(a.madre);
      if (!p || p.casa == null || p.casa === a.casa) continue;
      if (hay(p.casa)) mudar(a, p.casa); else cambiar(a, p.casa);
    }
  }

  // Lo que cada pueblo tiene levantado en su tierra: lo usa la capacidad (sim.js) y la ficha.
  function contar(m) {
    const v = m.vida, casas = {}, campos = {}, arboles = {}, edif = {}, camas = {}, masCamas = {}, ocio = {}, aduanas = {}, minasT = {};
    for (const c of m.civs) masCamas[c.id] = M.tec(c, 'casa');
    for (let t = 0; t < v.tw * v.th; t++) {
      const d = m.dueno[region(m, t)];
      if (d < 0) continue;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.casona || o === OBRA.centro || o === OBRA.ayuntamiento || o === OBRA.campamento) { casas[d] = (casas[d] || 0) + (o === OBRA.casa || o === OBRA.casona ? 1 : 0.5); camas[d] = (camas[d] || 0) + (o === OBRA.casa ? 3 + (masCamas[d] || 0) : o === OBRA.casona ? 5 : o === OBRA.centro ? 1.5 : 3); }
      else if (o === OBRA.campo) campos[d] = (campos[d] || 0) + 1;
      else if (o >= OBRA.torre) { const e = (edif[d] = edif[d] || {}); e[o] = (e[o] || 0) + 1; if (o === OBRA.aduana) (aduanas[d] = aduanas[d] || []).push(t); if (o === OBRA.mina) (minasT[d] = minasT[d] || []).push(t); if (o === OBRA.fuente || o === OBRA.parque) (ocio[d] = ocio[d] || []).push(t); }
      if (v.arbol[t] >= 2) arboles[d] = (arboles[d] || 0) + 1;
    }
    v.ocio = ocio;
    // Las regiones pobladas (con alguna obra o camino): el reino solo se extiende junto a ellas.
    v.poblada = new Array(m.W * m.H).fill(0);
    for (let t = 0; t < v.tw * v.th; t++) if ((v.obra[t] && v.obra[t] !== OBRA.ruina) || v.camino[t]) v.poblada[region(m, t)] = 1;
    const gente = {}, guerreros = {}, armados = {}, comerciantes = {};
    for (const a of v.aldeanos) { gente[a.c] = (gente[a.c] || 0) + 1; if (a.o === GUERRERO) { guerreros[a.c] = (guerreros[a.c] || 0) + 1; if ((a.arma || 0) > 0) armados[a.c] = (armados[a.c] || 0) + 1; } if (a.o === COMERCIANTE) comerciantes[a.c] = (comerciantes[a.c] || 0) + 1; }
    for (const c of m.civs) {
      c.casas = Math.round(casas[c.id] || 0); c.campos = campos[c.id] || 0; c.arboles = arboles[c.id] || 0; c.aldeanos = gente[c.id] || 0; c.guerreros = guerreros[c.id] || 0; c.armados = armados[c.id] || 0; c.comerciantes = comerciantes[c.id] || 0; c.camas = Math.round(camas[c.id] || 0) + 2;
      const e = edif[c.id] || {}; c.torres = e[OBRA.torre] || 0; c.cuarteles = e[OBRA.cuartel] || 0; c.arquerias = e[OBRA.arqueria] || 0; c.castillos = e[OBRA.castillo] || 0; c.templos = e[OBRA.templo] || 0; c.saberes = e[OBRA.saber] || 0; c.molinos = e[OBRA.molino] || 0; c.puertos = e[OBRA.puerto] || 0;
      c.metal = c.metal || 0; c.oro = c.oro == null ? 10 : c.oro;
      c.madera = c.madera || 0; c.piedra = c.piedra || 0;
      // El nivel del asentamiento (campamento, aldea, pueblo, villa, ciudad), que abre edificios nuevos.
      if (c.viva) {
        const n = M.nivelDe(c.aldeanos || 0);
        if (c.nivelMax == null) c.nivelMax = n;
        if (n > c.nivelMax) {
          c.nivelMax = n;
          const N = M.NIVELES[n];
          (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '★ ' + c.nombre + ' ya es ' + (n === 1 ? 'una aldea' : n === 2 ? 'un pueblo' : n === 3 ? 'una villa' : 'una ciudad') });
          if (c.jugador || n >= 3) S().cronica(m, 'nivel', c.nombre + ' ya es ' + (n === 1 ? 'una aldea' : n === 2 ? 'un pueblo' : n === 3 ? 'una villa' : 'una ciudad'), 'Con ' + c.aldeanos + ' vecinos, lo que fue un campamento de chozas tiene ahora nombre de ' + N.nombre.toLowerCase() + '. Se pueden levantar: ' + N.abre + '.', c, c.capital);
        }
        c.nivel = Math.max(n, Math.min(c.nivelMax, n + 1));
      }
      c.pozos = e[OBRA.pozo] || 0; c.graneros = e[OBRA.granero] || 0; c.fuentes = e[OBRA.fuente] || 0; c.parques = e[OBRA.parque] || 0; c.palacios = e[OBRA.palacio] || 0; c.centrales = e[OBRA.central] || 0; c.bancos = e[OBRA.banco] || 0; c.fabricas = e[OBRA.fabrica] || 0; c.estaciones = e[OBRA.estacion] || 0; c.hospitales = e[OBRA.hospital] || 0; c.aduanas = aduanas[c.id] || []; c.pozosPetroleo = e[OBRA.petroleo] || 0; c.minasT = minasT[c.id] || []; c.minas = c.minasT.length; c.aerodromos = e[OBRA.aerodromo] || 0;
      necesidades(m, c);
      if (c.viva) planTrincheras(m, c, terrenos(m));
      if (c.viva && pausada(m) && m.turno % 3 === c.id % 3) { planMuros(m, c, terrenos(m)); planCorrales(m, c, terrenos(m)); }
    }
    planUrbano(m);
    // Las fichas de edificios que ya no existen (ruinas viejas o solares reconstruidos) se olvidan al cabo de un
    // tiempo, y cada historia guarda solo lo último: la partida guardada no crece sin fin.
    if (v.edificios && m.turno % 25 === 0) for (const k of Object.keys(v.edificios)) {
      const e = v.edificios[k];
      if (e.historia && e.historia.length > 8) e.historia = e.historia.slice(-8);
      const sigue = v.obra[+k] === e.tipo && e.ruina == null;
      if (sigue) delete e.fin; else if (e.fin == null) e.fin = m.turno; else if (m.turno - e.fin > 200) delete v.edificios[k];
    }
  }

  // ---------- Lo que cuesta una tierra nueva (sim.js) ----------
  // Tres de madera; sin madera, cuatro de piedra; y un pueblo sin árboles cerca levanta adobe: una tierra por turno.
  function tierrasPagables(m, c) {
    return Math.floor((c.madera || 0) / 3) + (c.plan && c.plan.obra ? 0 : Math.floor((c.piedra || 0) / 4)) + (c.arboles ? 0 : 1);
  }
  function pagarTierra(m, c) {
    if (c.madera >= 3) c.madera -= 3;
    else if (c.piedra >= 4 && !(c.plan && c.plan.obra)) c.piedra -= 4;
  }

  // ---------- Poderes del dios sobre la vida ----------
  function incendio(m, c) {
    const v = m.vida;
    let quemados = 0;
    if (!v) return 0;
    // Además de lo que arde en el acto, quedan focos que siguen quemando y saltando los turnos siguientes.
    const cs = S().casillas(m, c);
    for (let k = 0; k < 14 && cs.length; k++) { const r = cs[Math.floor(azar(v) * cs.length)], ts = parcelas(m, r).filter(t => ardible(v, t)); if (ts.length) prender(m, ts[Math.floor(azar(v) * ts.length)], 0, 5); }
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (v.arbol[t] && azar(v) < 0.75) { cambiar(m, 'arbol', t, 0, 0); marcar(m, t, 'ceniza', 8); quemados++; }
      if (v.obra[t] === OBRA.casa && azar(v) < 0.3) cambiar(m, 'obra', t, OBRA.ruina, 0);
      if (v.obra[t] === OBRA.campo && azar(v) < 0.4) cambiar(m, 'obra', t, 0, 0);
    }
    contar(m);
    return quemados;
  }
  function plantar(m, regiones) {
    const v = m.vida;
    let n = 0;
    if (!v) return 0;
    const ter = terrenos(m);
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.arbol[t] || !(ter[t] in ARBOLES) || azar(v) < 0.25) continue;
      cambiar(m, 'arbol', t, 3, 0); n++;
    }
    contar(m);
    return n;
  }

  /*
   * Lo que un poder del dios le hace a la tierra y a la gente en el acto: aldeanos que mueren, casas que
   * caen, campos que se secan. Devuelve cuántos aldeanos murieron y cuántas obras se perdieron.
   */
  const DANO = {
    plaga: { gente: 0.35 }, hambre: { gente: 0.2, campo: 0.6 }, diluvio: { gente: 0.15, campo: 0.45, casa: 0.2 },
    terremoto: { gente: 0.25, casa: 0.55, campo: 0.2 }, destruir: { gente: 0.7, casa: 0.75, campo: 0.6 }, matar: { gente: 0.5 },
    guerra: {}, incendio: { gente: 0.1 }
  };
  function castigo(m, c, tipo, regiones) {
    const v = m.vida, d = DANO[tipo];
    if (!v || !d || !c) return { muertos: 0, obras: 0 };
    let muertos = 0, obras = 0;
    if (d.gente) {
      const suyos = v.aldeanos.filter(a => a.c === c.id);
      const n = Math.min(suyos.length - 1, Math.round(suyos.length * d.gente));
      const fuera = new Set(suyos.sort((x, y) => x.id % 7 - y.id % 7).slice(0, Math.max(0, n)));
      v.muertos = (v.muertos || []).concat([...fuera].map(a => [a.x, a.y, c.id, tipo]));
      v.aldeanos = v.aldeanos.filter(a => !fuera.has(a));
      muertos = fuera.size;
    }
    for (const r of regiones || S().casillas(m, c)) for (const t of parcelas(m, r)) {
      const o = v.obra[t];
      if (o === OBRA.campo && d.campo && azar(v) < d.campo) { cambiar(m, 'obra', t, 0, 0); obras++; }
      else if (o === OBRA.casa && d.casa && azar(v) < d.casa) { cambiar(m, 'obra', t, OBRA.ruina, 0); obras++; }
    }
    contar(m);
    return { muertos, obras };
  }
  // Pone la vida al día tras un cambio fuera del turno: plazas nuevas, aldeanos según la población.
  function ajustar(m) {
    if (!m.vida) return;
    m.vida.cambios = m.vida.cambios || [];
    centros(m);
    sincronizar(m, null, true);
    for (const a of m.vida.aldeanos) if (!a.r || !a.r.length) a.r = [];
    contar(m);
    actualizarPoblacion(m);
  }

  M.vida = { planMuros, planCorrales, muroVida, AVIACION, MODOS_ECO, ministroEconomia, INDUSTRIAS, minerasDe, comprarInsumo, etapa, porMar, vendible, comercian, permiteComercio, asignarCasas, camasDe, fuerza, comarcasConPozo, banca, comercio, mercaderesDe, gremiosDe, empresariosDe, banquerosDe, moverAlBanco, TIPO_INTERES, nivelInteres, VUELO, sociosDe, comercioLibre, razonColonia, viaColonia, masaDe, sitioPuerto, enMarAbierto, NAVAL, claseNaval, porMar, planNaval, ALIMENTOS, alimento, desglose, turnoPorPasos, SUB, TICKS, ADULTO, VIEJO, escala, anos: a => Math.round((a.edad || 0) < ADULTO ? (a.edad || 0) * 8 : 16 + ((a.edad || 0) - ADULTO) * 2.6), OBRA, RANGO_MOLINO, rangoMolino, planUrbano, fase, OFICIOS, ACC, trazar, calles, islas, reasignar, ERUDITO, salud, riesgoAnual, registrar, nombreEdificio, lugarDe, cultivoTipo, regadio, RINDE, aceptarOferta, BIENES, PRECIO_BASE, NOMBRE_BIEN, objetivo, balance, mercado, ERA_OBRA, NOMBRE_ERA, saquear, planTrincheras, MAX_TRINCHERA, sitioDefensa, COSTE_COLONIA, puedeColonia, danoContra, GRANADA, buscaGranada, estallido, RESISTE, sitioMina, abrirRuta, TIRO, planificarVias, esVia, pasosFronterizos, pasoSinPuesto, subsuelo, quemar, huelgas, enMarcha, contaminacion, bienesDe, sitioPetroleo, GASTO, alumbradoDe, EDIFICABLES, puedeColocar, encargar, COSTES, NIVEL_OBRA, NECESIDADES, necesidades, edificioPendiente, animoDe, topeComida, pausada, esNoche, estacion, ESTACIONES, DIA_TURNOS, ESTACION_TURNOS, mover, cambiar, prender, inundar, marcar, MARCA, ARMAS, TIROS, ARMADURAS, VEHICULOS, armaduraDeEra, armaDe, poder, vidaMax, reparto, crear, turno, terrenos, region, centro, parcelas, plaza, contar, tierrasPagables, pagarTierra, incendio, plantar, castigo, ajustar };
