  // ── GÉNESIS · LA VIDA · El plan urbano, andar, llegar y terminar el trabajo ──

  /*
   * EL PLAN URBANO (partidas pausadas): cada pueblo y cada ciudad crece con orden alrededor de su plaza.
   *  · Calles en cuadrícula cada tres parcelas, alineadas con la plaza: entre ellas quedan manzanas de 2×2.
   *  · Dentro del casco (más grande cuanto más grande es el pueblo) van las casas y los edificios, nunca en
   *    mitad de una calle; las calles se empiedran a medida que tienen casas al lado.
   *  · Fuera del casco está la huerta: los campos solo se aran ahí, cerca de un molino, y cada molino da
   *    para unos diez campos; cuando hacen falta más, se levanta otro molino en el borde de la huerta.
   * v.plan marca cada parcela: 1 calle del plan, 2 solar del casco, 0 fuera.
   */
  const RADIO_CASCO = [3, 5, 6, 8, 10];
  function planUrbano(m) {
    const v = m.vida, tw = v.tw, th = v.th, plan = new Uint8Array(tw * th), centros = [];
    if (!pausada(m)) { v.plan = plan; v.centros = centros; return; }
    for (const c of S().vivas(m)) {
      const sitios = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
      for (const r of sitios) {
        const rx = (r % m.W) * SUB, ry = (r / m.W | 0) * SUB, cx = rx + 1.5, cy = ry + 1.5;
        const ciudad = r === c.capital ? null : (m.ciudades || []).find(x => x.region === r);
        const campamento = ciudad && ciudad.fase && ciudad.fase !== 'aldea';
        const vecinos = ciudad ? v.aldeanos.filter(a => a.c === c.id && a.h === r).length : 0;
        const R = campamento ? 2 : RADIO_CASCO[Math.min(4, r === c.capital ? c.nivel || 0 : M.nivelDe(vecinos))];
        centros.push({ civ: c.id, r, cx, cy, R, campamento });
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(th - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(tw - 1, Math.ceil(cx + R)); x++) {
          const t = y * tw + x;
          if (m.dueno[region(m, t)] !== c.id) continue;
          const calle = !campamento && ((((x - rx) % 3) + 3) % 3 === 0 || (((y - ry) % 3) + 3) % 3 === 0);
          // Donde ya hay un edificio (del campamento o de antes del plan), la calle se desvía: queda como solar.
          const ocupado = v.obra[t] && v.obra[t] !== OBRA.campo && v.obra[t] !== OBRA.ruina;
          plan[t] = Math.max(plan[t], calle && !ocupado ? 1 : 2);
        }
      }
    }
    v.plan = plan; v.centros = centros;
  }
  const enCasco = (m, t) => m.vida.plan && m.vida.plan[t] > 0;
  const calleDelPlan = (m, t) => m.vida.plan && m.vida.plan[t] === 1;
  function libre(m, a, c, rec, ter, sirve, filtro) {
    const v = m.vida, base = centro(m, a.h), desbrozar = pausada(m) && sirve === CULTIVABLE;
    const regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 99;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.camino[t] || ocupada(v, t) || (v.arbol[t] >= 2 && !desbrozar) || !sirve.has(ter[t]) || rec.reservadas.has(t) || (filtro && !filtro(t))) continue;
      // Con plan, la huerta se abre junto a otros campos (en bloques ordenados) y, si hace falta, se desbroza.
      const d = dist(m, base, t) + azar(v) * 1.5 + (desbrozar ? (v.arbol[t] >= 2 ? 2 : 0) - [t - 1, t + 1, t - v.tw, t + v.tw].filter(n => v.obra[n] === OBRA.campo).length * 0.8 : 0);
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Un paso hacia el destino por tierra (o en barca desde el Renacimiento).
  const enAgua = (m, ter, t) => mojada(ter[t]) && !m.vida.camino[t];
  // EL CAMINO POR TIERRA: para los viajes largos de soldados y colonos, un mapa de distancias desde el destino
  // que rodea el mar, los lagos y los bajíos (los ríos se vadean; el agua, solo por un puente). Así no se
  // meten en el agua a ahogarse: dan la vuelta por tierra. Se guardan unos pocos por turno.
  // (Se calcula hacia el centro de la comarca del destino y vale para 20 turnos: así lo comparten todos los que van
  // al mismo sitio, y cada navegador lo rehace en los mismos turnos.)
  let campos = { mundo: null, vez: -1, mapa: new Map() };
  function campoHacia(m, destino, ter) {
    const v = m.vida, t0 = centro(m, region(m, destino)), vez = Math.floor(m.turno / 20);
    if (campos.mundo !== m || campos.vez !== vez) campos = { mundo: m, vez, mapa: new Map() };
    if (campos.mapa.has(t0)) return campos.mapa.get(t0);
    if (campos.mapa.size >= 48) return null;
    const n = v.tw * v.th, d = new Int32Array(n).fill(-1), cola = new Int32Array(n);
    let ini = 0, fin = 0; d[t0] = 0; cola[fin++] = t0;
    while (ini < fin) {
      const t = cola[ini++], x = t % v.tw;
      for (const u of [x > 0 ? t - 1 : -1, x < v.tw - 1 ? t + 1 : -1, t - v.tw, t + v.tw]) {
        if (u < 0 || u >= n || d[u] >= 0 || ((ter[u] === 'agua' || ter[u] === 'bajo') && !v.camino[u])) continue;
        d[u] = d[t] + 1; cola[fin++] = u;
      }
    }
    campos.mapa.set(t0, d);
    return d;
  }
  function andar(m, a, c, ter) {
    const v = m.vida;
    // (Colonos y constructores que van a una obra lejana, como un puerto, aguantan un viaje más largo.)
    if (++a.q > (a.colono != null ? 400 : a.edificio ? 160 : 40)) return false;
    // Nadando se avanza a medio paso.
    if (enAgua(m, ter, a.y * v.tw + a.x) && !a.porCamino) { a.brazada = !a.brazada; if (a.brazada) return true; }
    const opciones = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lejos = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y);
    // Soldados y colonos que van lejos siguen el camino por tierra (si lo hay desde donde están).
    const campo = (a.o === GUERRERO || a.colono != null || a.edificio) && lejos > 5 ? campoHacia(m, a.ty * v.tw + a.tx, ter) : null;
    const porTierra = campo && campo[a.y * v.tw + a.x] > 3;
    const ahora = porTierra ? campo[a.y * v.tw + a.x] : lejos;
    let mejor = null, mv = 1e9;
    for (const [dx, dy] of opciones) {
      const x = a.x + dx, y = a.y + dy;
      if (x < 0 || y < 0 || x >= v.tw || y >= v.th) continue;
      const n = y * v.tw + x;
      let d;
      // (Una muralla ajena no se cruza; por la puerta pasa quien está en paz con su dueño. El soldado enemigo la golpea.)
      const ajeno = v.muro && v.muro[n] > 0 && m.dueno[region(m, n)] !== a.c ? S().civ(m, m.dueno[region(m, n)]) : null;
      if (ajeno && !(v.puerta && v.puerta[n] && !S().enGuerra(c, ajeno)) && !(a.o === GUERRERO && S().enGuerra(c, ajeno))) continue;
      if (porTierra) { if (campo[n] < 0) continue; d = campo[n] + azar(v) * 0.5; }
      else {
        // Un soldado no se mete en el mar ni en los bajíos (salvo por un puente).
        if (a.o === GUERRERO && (ter[n] === 'agua' || ter[n] === 'bajo') && !v.camino[n]) continue;
        // Y nadie se mete a nado en el mar hondo (solo en bajíos y ríos), salvo quien ya está en él y busca la orilla.
        if (pausada(m) && ter[n] === 'agua' && !v.camino[n] && ter[a.y * v.tw + a.x] !== 'agua') continue;
        // El agua solo se elige si no hay otro camino: cuesta más, y el mar abierto mucho más.
        const coste = enAgua(m, ter, n) ? (ter[n] === 'agua' ? 4 : 2) : 0;
        d = Math.abs(a.tx - x) + Math.abs(a.ty - y) + coste + azar(v) * 0.9;
      }
      if (d < mv) { mv = d; mejor = [x, y]; }
    }
    if (!mejor) return false;
    // Un soldado enemigo ante la muralla (o la puerta cerrada): la golpea hasta abrir brecha, en vez de pasar.
    if (v.muro && a.o === GUERRERO) {
      const n = mejor[1] * v.tw + mejor[0], dueno = v.muro[n] > 0 ? S().civ(m, m.dueno[region(m, n)]) : null;
      if (dueno && dueno.id !== a.c && S().enGuerra(c, dueno)) {
        const golpe = a.veh ? 10 : 1 + (c.era >= 5 ? 1 : 0) + (tieneR(a, 'fuerte') ? 0.5 : 0);
        v.muro[n] = Math.max(0, v.muro[n] - golpe); v.muroVer = (v.muroVer || 0) + 1;
        v.ataques.push([a.id, (a.r.length / 3 | 0) || 1, mejor[0] - a.x, mejor[1] - a.y]);
        if (!v.muro[n]) { if (v.puerta) v.puerta[n] = 0; marcar(m, n, 'escombros', 12, 1); if (c.jugador || dueno.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.jugador ? c.id : dueno.id, texto: c.jugador ? '🪓 Tus soldados abren brecha en la muralla de ' + dueno.nombre : '🧱 El enemigo abre brecha en tu muralla', region: region(m, n) }); }
        return true;
      }
    }
    // Atascado detrás de agua: un paso a un lado para rodearla.
    if (mv >= ahora + 0.9 && a.q > 20) return false;
    a.x = mejor[0]; a.y = mejor[1];
    // En el mar abierto uno se puede ahogar; en un río o en la orilla, casi nunca.
    const t = a.y * v.tw + a.x;
    // (Un soldado vadea los ríos sin peligro: va en fila y se agarran unos a otros.)
    if (enAgua(m, ter, t) && azar(v) < (ter[t] === 'agua' ? 0.06 : ter[t] === 'bajo' ? (a.o === GUERRERO ? 0.004 : 0.01) : a.o === GUERRERO ? 0 : 0.003)) a.ahogado = 1;
    // Por un camino se va el doble de rápido.
    if (v.camino[t] && !a.porCamino && !a.ahogado && (a.tx !== a.x || a.ty !== a.y)) { a.porCamino = 1; andar(m, a, c, ter); a.porCamino = 0; }
    return true;
  }

  function llegar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    if (a.e === VOLVER) {
      // Descarga en la aldea: aquí entra la madera y la piedra en la economía del pueblo.
      const h = c.hecho = c.hecho || {};
      if (a.o === LENADOR) { c.madera += a.k; h.madera = (h.madera || 0) + a.k; }
      else if (a.kt === 3) { alimento(c, 'grano', a.k); h.comida = (h.comida || 0) + a.k; a.kt = 0; } // el trigo llega al molino (o a casa)
      else if (a.o === MINERO) { if (a.kt === 1) { c.metal = (c.metal || 0) + a.k; h.metal = (h.metal || 0) + a.k; } else if (a.kt === 2) { c.oro = (c.oro || 0) + a.k; c.riqueza += 6 * a.k; h.oro = (h.oro || 0) + a.k; } else if (a.kt === 4) { c.carbon = (c.carbon || 0) + a.k; h.carbon = (h.carbon || 0) + a.k; } else { c.piedra += a.k; c.riqueza += a.k * 0.3; h.piedra = (h.piedra || 0) + a.k; } a.kt = 0; }
      a.k = 0; a.e = ESPERAR; a.t = 1;
      return;
    }
    if (a.dormir) { a.e = ESPERAR; a.t = 99; a.enCasa = 1; return; }
    if (a.viajeColono) { a.viajeColono = 0; if (a.colono != null) fundar(m, a, c); a.e = ESPERAR; a.t = 2; return; }
    if (a.o === COMERCIANTE && a.viaje) { a.viaje = 0; a.e = VIAJAR; a.pasados = []; return; }
    if (a.paseo) { a.e = ESPERAR; a.t = a.paseo === 2 ? 3 : 1 + Math.floor(azar(v) * 2); a.paseo = 0; return; }
    if (a.enFabrica) { a.e = TRABAJAR; a.t = 3; return; }
    if (a.o === ERUDITO) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === LENADOR) { if (a.plantar && !v.arbol[t] && !v.obra[t]) { a.e = TRABAJAR; a.t = 2; } else if (v.arbol[t] >= 2) { a.e = TRABAJAR; a.t = 2; } else { a.e = LIBRE; a.plantar = 0; } }
    else if (a.o === MINERO) { if (a.enMina && v.obra[t] === OBRA.mina) { a.e = TRABAJAR; a.t = 6; } else if (v.roca[t] > 0) { a.e = TRABAJAR; a.t = 3; } else if (a.cantera) { a.e = TRABAJAR; a.t = 4; } else a.e = LIBRE; }
    else if (a.o === GRANJERO && (a.pastor != null || a.caza != null)) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === GRANJERO) { if (a.siega && v.obra[t] === OBRA.campo && v.cultivo[t] >= 3) { a.e = TRABAJAR; a.t = 2; } else if (!a.siega && !v.obra[t] && v.arbol[t] < 2) { a.e = TRABAJAR; a.t = 3; } else if (!a.siega && !v.obra[t] && pausada(m) && !a.pastor && !a.caza) { a.e = TRABAJAR; a.t = 5; /* desbrozar el bosque para la huerta lleva más */ } else { a.e = LIBRE; a.siega = 0; } }
    else if (a.o === CONSTRUCTOR && a.edificio) {
      const an = v.andamios && v.andamios[t];
      if (an && an.civ === c.id) { a.e = TRABAJAR; a.t = 3; }
      else if (v.muro && v.muro[t] > 0) { a.edificio = 0; a.e = LIBRE; } // (mientras iba, ahí se levantó la muralla)
      else if (!v.obra[t] && !pausada(m)) { colocarObra(m, t, a.edificio, paso); if (a.edificio === OBRA.casa) c.casas++; if (c.plan && c.plan.encargos) c.plan.encargos = c.plan.encargos.filter(e => e.t !== t); a.edificio = 0; }
      else if ((!v.obra[t] || (v.obra[t] === OBRA.campo && SOBRE_HUERTO.has(a.edificio))) && (privada(v, t, c) || pagarAndamio(c, { coste: COSTES[a.edificio] || [0, 0, 0], pagado: 0 }, 0.25))) {
        if (v.obra[t] === OBRA.campo) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); }
        // Se paga la cuarta parte al empezar y se monta el andamio; el resto, jornada a jornada.
        cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso);
        (v.andamios = v.andamios || {})[t] = { o: a.edificio, falta: TRABAJO[a.edificio] || 4, total: TRABAJO[a.edificio] || 4, civ: c.id, coste: privada(v, t, c) ? [0, 0, 0] : COSTES[a.edificio] || [0, 0, 0], pagado: 0.25 };
        if (c.plan && c.plan.encargos) c.plan.encargos = c.plan.encargos.filter(e => e.t !== t);
        a.e = TRABAJAR; a.t = 3;
      } else a.edificio = 0;
    }
    else if (a.o === CONSTRUCTOR && a.reforma === t && v.edificios && v.edificios[t]) { a.e = TRABAJAR; a.t = 4; }
    else if (a.o === CONSTRUCTOR && a.obraCamino) { if (!v.camino[t] && !v.obra[t]) { a.e = TRABAJAR; a.t = 1; } else { a.e = LIBRE; a.obraCamino = 0; } }
    else if (a.o === CONSTRUCTOR && a.obraMuro) { if ((!v.obra[t] || v.obra[t] === OBRA.campo) && !(v.andamios && v.andamios[t]) && m.dueno[region(m, t)] === c.id) { a.e = TRABAJAR; a.t = 2; } else { a.e = LIBRE; a.obraMuro = 0; } }
    else if (a.o === CONSTRUCTOR) {
      const piedra = c.era >= 2 && c.piedra >= 1;
      if (v.obra[t] === OBRA.campo && pausada(m) && v.plan && v.plan[t] === 2) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); c.campos = Math.max(0, (c.campos || 0) - 1); }
      if (!v.obra[t] && v.arbol[t] < 2 && c.madera >= (piedra ? 2 : 3)) { c.madera -= piedra ? 2 : 3; if (piedra) c.piedra -= 1; a.e = TRABAJAR; a.t = Math.max(2, Math.round(4 * (1 - M.tec(c, 'obra')))); } else a.e = LIBRE;
    } else if (a.o === GUERRERO && a.cavar && m.dueno[region(m, t)] === c.id) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === GUERRERO) {
      // En tierra enemiga sin nadie que la defienda: saquea la aldea y empuja la frontera.
      const r = region(m, t), o = S().civ(m, m.dueno[r]);
      if (o && c.guerras.some(g => g.con === o.id)) { a.e = TRABAJAR; a.t = 2; } else a.e = LIBRE;
    }
  }

  function terminar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    // (La jornada en la fábrica: lo que hace lo cuenta la fábrica, industria().)
    if (a.enFabrica) { a.enFabrica = 0; a.e = ESPERAR; a.t = 1; return; }
    // El erudito termina su jornada de estudio: el saber entra en el pueblo (más en el templo, y más los sabios).
    if (a.o === ERUDITO) {
      const k = 1.05 * (1 + 0.15 * c.era) * (a.estudio === 3 ? 1.6 : a.estudio === 2 ? 1.25 : 1) * (tieneR(a, 'sabio') ? 1.5 : 1) * (tieneR(a, 'perezoso') ? 0.6 : 1);
      c.saber = (c.saber || 0) + k; a.estudios = (a.estudios || 0) + 1;
      a.e = ESPERAR; a.t = 1; return;
    }
    if (a.o === LENADOR && a.plantar) {
      // Planta un retoño con una semilla: en unos años será un árbol que se podrá talar.
      a.plantar = 0;
      if (!v.arbol[t] && !v.obra[t] && !v.roca[t] && !v.camino[t] && (c.semillas || 0) >= 1) { c.semillas -= 1; cambiar(m, 'arbol', t, 1, paso); c.hecho = c.hecho || {}; c.hecho.plantados = (c.hecho.plantados || 0) + 1; }
      a.e = ESPERAR; a.t = 1; return;
    }
    if (a.o === LENADOR && v.arbol[t] >= 2) {
      // Un árbol no cae de un hachazo: un árbol grande aguanta tres viajes de leña y uno joven, dos. Así los
      // bosques duran mucho más.
      const golpes = (v.hachazos = v.hachazos || {}), aguanta = v.arbol[t] === 3 ? 3 : 2;
      golpes[t] = (golpes[t] || 0) + 1;
      a.k = (v.arbol[t] === 3 ? 4 : 2) + M.tec(c, 'lena');
      if (golpes[t] < aguanta) { ir(a, centro(m, a.h), v.tw, VOLVER); return; }
      delete golpes[t];
      c.hecho = c.hecho || {}; c.hecho.arboles = (c.hecho.arboles || 0) + 1; cambiar(m, 'arbol', t, 0, paso);
      // Al talar se recogen piñas y semillas; y si el bosque escasea, se replanta el tocón con una.
      if (azar(v) < 0.45) c.semillas = (c.semillas || 0) + 1;
      if ((c.arboles || 0) < 40 && (c.semillas || 0) >= 1 && azar(v) < 0.6) { c.semillas -= 1; cambiar(m, 'arbol', t, 1, Math.min(TICKS, paso + 0.5)); }
      ir(a, centro(m, a.h), v.tw, VOLVER); return;
    }
    // De la mina sale de todo, pero poco cada vez: piedra, metal (desde el Bronce), carbón (desde la industria) y algo de oro.
    if (a.o === MINERO && a.enMina && v.obra[t] === OBRA.mina) {
      a.enMina = 0; const q = azar(v), quiere = a.mineQuiere;
      if (q < 0.06 && c.era >= 1) { a.kt = 2; a.k = 1; }
      else if (quiere === 'carbon' && c.era >= 6 && q < 0.75) { a.kt = 4; a.k = 2 + Math.floor(M.tec(c, 'piedra') / 2); }
      else if (pausada(m) && quiere === 'metal' && c.era >= 1 && q < 0.85) { a.kt = 1; a.k = 2 + (azar(v) < 0.5 ? 1 : 0) + Math.floor(M.tec(c, 'piedra')); }
      else if (pausada(m) && q < 0.3 && c.era >= 1) { a.kt = 1; a.k = 1; }
      else if (!pausada(m) && (quiere === 'metal' || q < 0.3) && c.era >= 1 && q < 0.8) { a.kt = 1; a.k = 1 + (azar(v) < 0.4 ? 1 : 0); }
      else { a.kt = 0; a.k = 2; }
      ir(a, centro(m, a.h), v.tw, VOLVER); return;
    }
    if (a.o === MINERO && a.cantera && !v.roca[t] && a.buscaCarbon) { a.cantera = 0; a.buscaCarbon = 0; a.k = 2; a.kt = azar(v) < 0.7 ? 4 : 0; if (a.kt === 4) { a.k = 2 + M.tec(c, 'piedra'); marcar(m, t, 'escombros', 1, paso); } ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === MINERO && a.cantera && !v.roca[t]) { a.cantera = 0; a.k = 2; // (Sin mina, cavar en la montaña da sobre todo piedra; metal, poco y de vez en cuando: el metal sale de las vetas y de las minas.)
const pm = pausada(m); a.kt = azar(v) < (ter[t] === 'montana' ? (a.buscaMetal ? (pm ? 0.3 : 0.7) : pm ? 0.08 : 0.25) : a.buscaMetal ? (pm ? 0.12 : 0.4) : 0) ? 1 : 0; if (a.kt === 1) { a.k = (pm ? 1 : 2) + M.tec(c, 'piedra'); marcar(m, t, 'escombros', 1, paso); } a.buscaMetal = 0; ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === MINERO && v.roca[t] > 0) { a.k = (v.mena[t] === 3 ? 3 : v.mena[t] === 1 && pausada(m) ? 2 : v.mena[t] ? 1 : 2) + M.tec(c, 'piedra'); a.kt = v.mena[t] === 3 ? 4 : v.mena[t] || 0; cambiar(m, 'roca', t, v.roca[t] - 1, paso); if (!v.roca[t]) v.mena[t] = 0; ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === GRANJERO && a.caza != null) {
      // El ciervo se caza (si sigue cerca); el pez se pesca y el banco sigue ahí casi siempre.
      const b = v.animales.find(x => x.id === a.caza), seca = c.efectos.some(e => e.sequia);
      a.caza = null;
      if (b && dist(m, t, b.y * v.tw + b.x) <= 4) {
        if (b.tipo === 'ciervo') {
          // Tres lanzadas (o tiros); si no cae, huye herido y otro día será.
          let muere = false;
          for (let q = 0; q < 3 && !muere; q++) if (azar(v) < 0.6) muere = golpear(v, a, b, Math.round((12 + c.era * 3) * (0.8 + azar(v) * 0.4) * (tieneR(a, 'fuerte') ? 1.2 : 1)), paso, a.x, a.y);
          if (muere) { v.animales = v.animales.filter(x => x !== b); v.muertos.push([b.x, b.y, null, 'animal', paso, b]); alimento(c, 'carne', 4 * (1 + M.tec(c, 'caza'))); }
        }
        else { alimento(c, 'carne', (seca ? 0.6 : 1.2) * (1 + M.tec(c, 'caza'))); if (azar(v) < 0.15) v.animales = v.animales.filter(x => x !== b); }
      }
      return;
    }
    if (a.o === GRANJERO && a.pastor != null) {
      // Leche, lana y queso de la res; si el granero está casi vacío y el rebaño es grande, se sacrifica una.
      const b = v.animales.find(x => x.id === a.pastor), hab = c.habitantes || 10;
      a.pastor = null;
      if (b && dist(m, t, b.y * v.tw + b.x) <= 4) {
        const rebano = v.animales.filter(x => x.c === c.id && x.tipo === b.tipo).length;
        if ((c.comida || 0) < hab * 0.2 && rebano > 3) { v.animales = v.animales.filter(x => x !== b); v.muertos.push([b.x, b.y, null, 'animal', paso, b]); alimento(c, 'carne', b.tipo === 'vaca' ? 9 : 5); }
        else {
          // (En el corral, un pastor ordeña y esquila a varias reses de una vez: hasta cinco, según cuántas haya.)
          const k = b.corral != null && v.corralesId && v.corralesId[b.corral] ? Math.min(5, Math.max(1, v.corralesId[b.corral].carga / 3)) : 1;
          alimento(c, 'leche', k * (b.tipo === 'vaca' ? 1.5 : 0.8) * (c.efectos.some(e => e.sequia) ? 0.4 : 1));
        }
      }
      return;
    }
    if (a.o === GRANJERO && a.siega && v.obra[t] === OBRA.campo) {
      // El trigo segado se lleva a hombros al molino más cercano (dentro de su alcance); solo allí se vuelve harina.
      cambiar(m, 'cultivo', t, 0, paso);
      if (pausada(m)) {
        const ter2 = terrenos(m), tipo = cultivoTipo(m, ter2, t), [com, oro] = RINDE[tipo], reg = regadio(m, ter2, t) ? (tipo === 'arroz' ? 1.2 : 0.7) : 0;
        const record = c.cosechaRecord && m.turno - c.cosechaRecord < 12 ? 1.5 : 1;
        a.k = (com + reg + M.tec(c, 'cosecha') + (v.estacion === 2 ? 1 : 0)) * record;
        if (oro) { c.oro = (c.oro || 0) + oro * record; c.ganado = c.ganado || {}; c.ganado.comida = (c.ganado.comida || 0) + oro * record; }
        c.cosechado = c.cosechado || {}; c.cosechado[tipo] = (c.cosechado[tipo] || 0) + a.k;
      } else a.k = 2 + M.tec(c, 'cosecha') + (v.estacion === 2 ? 1 : 0);
      a.kt = 3; a.siega = 0;
      ir(a, molinoMasCercano(m, t) ?? centro(m, a.h), v.tw, VOLVER);
      return;
    }
    else if (a.o === GRANJERO && !v.obra[t] && pausada(m) && (enCasco(m, t) || calleDelPlan(m, t) || !molinoCerca(m, c, null, t))) { /* ahí no se ara: es casco del pueblo o no hay molino cerca */ }
    else if (a.o === GRANJERO && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.campo, paso); cambiar(m, 'cultivo', t, 0, paso); c.campos++; c.hecho = c.hecho || {}; c.hecho.campos = (c.hecho.campos || 0) + 1; }
    else if (a.o === CONSTRUCTOR && a.obraMuro) {
      // Un tramo de muralla (o de empalizada): se paga al terminarlo; el campo que hubiera debajo se pierde.
      a.obraMuro = 0;
      const hp = muroVida(c), cuesta = V_FASE(c) === 0 ? ['madera', 1] : ['piedra', 1];
      v.muro = v.muro || new Array(v.tw * v.th).fill(0); v.puerta = v.puerta || new Array(v.tw * v.th).fill(0);
      const plan = new Set(c.muros || []);
      // (Una jornada da para el tramo y, si siguen pendientes, los dos de al lado por la misma raya.)
      const tramos = [t, ...[1, -1, v.tw, -v.tw].map(d => t + d).filter(n => plan.has(n) && !(v.muro[n] >= hp * 0.8))].slice(0, 3);
      for (const u of tramos) {
        if ((c[cuesta[0]] || 0) < cuesta[1] || (v.obra[u] && v.obra[u] !== OBRA.campo) || (v.andamios && v.andamios[u]) || m.dueno[region(m, u)] !== c.id) continue;
        c[cuesta[0]] -= cuesta[1];
        if (v.obra[u] === OBRA.campo) { cambiar(m, 'obra', u, 0, paso); cambiar(m, 'cultivo', u, 0, paso); c.campos = Math.max(0, (c.campos || 0) - 1); }
        if (v.arbol[u]) cambiar(m, 'arbol', u, 0, paso); if (v.roca[u]) cambiar(m, 'roca', u, 0, paso);
        v.muro[u] = hp; v.puerta[u] = v.camino[u] || esVia(v, u) ? 1 : 0; v.muroVer = (v.muroVer || 0) + 1;
      }
    }
    else if (a.o === CONSTRUCTOR && a.obraCamino) {
      // Un tramo de camino: se quita el árbol o la roca; desde la Antigüedad se empiedra (cuesta un poco de piedra).
      if (!v.camino[t] && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 1, paso); if (c.era >= 3 && c.piedra >= 0.25) c.piedra -= 0.25; }
      a.obraCamino = 0;
    }
    else if (a.o === CONSTRUCTOR && a.reforma === t && v.edificios && v.edificios[t]) {
      const rec = v.edificios[t];
      if (c.madera >= 4 && c.piedra >= 2 && etapa(rec.tipo, rec.era) < etapa(rec.tipo, c.era)) {
        c.madera -= 4; c.piedra -= 2;
        // Si es de un mercader, él le paga al reino los materiales de la reforma (de su caja).
        const pv = v.privados && v.privados[t], dueno = pv && v.aldeanos.find(x => x.id === pv.dueno);
        if (dueno) { const precio = 4 * ((m.mercado && m.mercado.precio && m.mercado.precio.madera) || 1) + 2 * ((m.mercado && m.mercado.precio && m.mercado.precio.piedra) || 1); if (dueno.merc && dueno.merc.caja >= precio) { dueno.merc.caja = redondo(dueno.merc.caja - precio); c.oro = (c.oro || 0) + precio; } else if (dueno.emp && dueno.emp.capital >= precio) { dueno.emp.capital = redondo(dueno.emp.capital - precio); c.oro = (c.oro || 0) + precio; } }
        if (v.privados && v.privados[t]) nombrarPrivado(m, t, c); // (el nombre de ahora, con su dueño de ahora)
        const antes = M.ERAS[rec.era].nombre, nombreAntes = rec.nombre;
        rec.era = c.era; rec.historia.push({ anio: m.anio, texto: 'reformado al estilo de ' + M.ERAS[c.era].con + ' por ' + a.nombre + ' (era de ' + antes + ')' });
        v.cambios.push([2, t, v.obra[t], v.obra[t], paso]); // para que se vuelva a dibujar con el estilo nuevo
        // Los edificios de los mercaderes cambian también de nombre (el gremio pasa a compañía, el muelle a dársena…).
        if (v.privados && v.privados[t]) { nombrarPrivado(m, t, c); if (rec.nombre !== nombreAntes) { anunciar(m, c, '🏢 ' + nombreAntes + ' se moderniza: ahora es ' + (/^(Compañía|Terminal|Dársena|Mansión|Palacete)/.test(rec.nombre) ? 'la ' : 'el ') + rec.nombre); if (v.obra[t] === OBRA.gremio && etapa(OBRA.gremio, rec.era) === 1) S().cronica(m, 'banca', 'El fin del gremio: nace la ' + rec.nombre, 'Con las fábricas y el ferrocarril, la casa comercial de ' + (rec.dueno || 'la familia') + ' deja atrás el gremio: ahora es una compañía, con oficinas, almacén y empleados a sueldo.', c, region(m, t)); } }
      }
      a.reforma = null;
    }
    else if (a.o === CONSTRUCTOR && a.edificio && v.andamios && v.andamios[t]) {
      // Una jornada más en el andamio; cuando se acaba, queda el edificio.
      const an = v.andamios[t];
      apuntarObrero(m, t, a);
      const avance = 1 + M.tec(c, 'obra');
      // Se paga la parte de esta jornada; sin material, se espera a que llegue.
      if (!pagarAndamio(c, an, (an.total - an.falta + avance) / an.total)) {
        an.espera = 1;
        // Si hay una obra privada esperando (esa la paga su dueño), se deja esta parada y se va a hacer aquella.
        if ((c.plan && c.plan.encargos || []).some(e => e.privado != null && e.t !== t && !rec.reservadas.has(e.t) && !(v.andamios && v.andamios[e.t]))) { a.edificio = 0; a.e = LIBRE; return; }
        a.e = TRABAJAR; a.t = 3; return;
      }
      an.espera = 0;
      an.falta -= avance;
      if (an.falta <= 0) { colocarObra(m, t, an.o, paso); delete v.andamios[t]; if (an.o === OBRA.casa) { c.casas++; c.hecho = c.hecho || {}; c.hecho.casas = (c.hecho.casas || 0) + 1; } a.edificio = 0; }
      else { a.e = TRABAJAR; a.t = 3; return; }
    }
    else if (a.o === CONSTRUCTOR && !v.obra[t] && pausada(m) && !(v.muro && v.muro[t] > 0)) {
      // La casa también lleva su andamio: la primera jornada levanta los muros; la segunda, el tejado.
      cambiar(m, 'arbol', t, 0, paso);
      (v.andamios = v.andamios || {})[t] = { o: OBRA.casa, falta: TRABAJO[OBRA.casa] - 1, total: TRABAJO[OBRA.casa], civ: c.id };
      a.edificio = OBRA.casa; a.e = TRABAJAR; a.t = 3; return;
    }
    else if (a.o === CONSTRUCTOR && !v.obra[t] && !(v.muro && v.muro[t] > 0)) { apuntarObrero(m, t, a); cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.casa, paso); c.casas++; c.hecho = c.hecho || {}; c.hecho.casas = (c.hecho.casas || 0) + 1; }
    else if (a.o === COMERCIANTE && a.comercio) {
      // Llega la carreta: se vende, se compra, y los dos lados ganan (más si el camino está terminado).
      const ru = v.rutas.find(x => x.id === a.ruta);
      if (ru && rutaActiva(m, ru)) {
        const hecho = ru.tiles.filter(x => v.camino[x]).length / ru.tiles.length, k = 0.6 + 0.6 * hecho;
        const oroRuta = (ru.tipo === 'interna' ? 0.5 : 1) * (1 + 0.15 * c.era) * k * (1 + M.tec(c, 'comercio')) * (pausada(m) && ru.tipo !== 'interna' ? 0.4 : 1);
        c.oro = (c.oro || 0) + oroRuta; c.comercioOro = (c.comercioOro || 0) + oroRuta;
        if (ru.tipo === 'interna') { c.riqueza += (2 + 0.6 * c.era) * k; c.estab = Math.min(100, c.estab + 0.3); }
        else {
          const o = S().civ(m, ru.a === c.id ? ru.b : ru.a);
          if (pausada(m) && o && o.viva) venderComprar(m, a, c, o);
          c.riqueza += (3 + 0.8 * c.era) * k; o.riqueza += (2 + 0.6 * o.era) * k;
          c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1);
          if (o.era > c.era) c.ciencia += 3; // las ideas viajan con las mercancías
        }
        c.comerciado = (c.comerciado || 0) + 1;
        a.vuelta = 1; a.dir = -a.dir; a.e = VIAJAR; a.comercio = 0; a.pasados = [];
        return;
      }
      a.comercio = 0;
    }
    else if (a.o === GUERRERO && a.cavar) {
      // Una jornada de pala: primero la zanja con sacos terreros; luego, si hay metal, el alambre de espino.
      a.cavar = 0;
      v.trinchera = v.trinchera || new Array(v.tw * v.th).fill(0);
      if (!v.trinchera[t] && !v.obra[t]) { v.trinchera[t] = 1; if (v.arbol[t]) cambiar(m, 'arbol', t, 0, paso); v.trincheraVer = (v.trincheraVer || 0) + 1; }
      else if (v.trinchera[t] === 1 && (c.metal || 0) >= 1) { c.metal -= 1; v.trinchera[t] = 2; v.trincheraVer = (v.trincheraVer || 0) + 1; }
    }
    else if (a.o === GUERRERO) {
      const o = S().civ(m, m.dueno[region(m, t)]);
      if (o && c.guerras.some(g => g.con === o.id)) {
        // Saquear la capital enemiga (un asedio) pesa más que una aldea de frontera.
        c.victorias = (c.victorias || 0) + (region(m, t) === o.capital ? 1.5 : 0.5);
        if (v.obra[t] === OBRA.casa && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.ruina, paso);
        if (v.obra[t] === OBRA.campo && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.nada, paso);
      }
    }
    a.e = LIBRE;
  }
