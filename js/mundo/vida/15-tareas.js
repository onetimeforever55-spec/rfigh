  // ── GÉNESIS · LA VIDA · El exterminio, las explosiones y elegir la tarea de cada aldeano ──

  /*
   * EL EXTERMINIO (orden del jugador): los soldados de un reino con esa orden matan también a los civiles del
   * pueblo enemigo que tengan a mano y van a buscar a los que vean cerca. Con la guerra terminada, se acaba.
   */
  function exterminio(m, paso, muertos) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      const p = c.plan; if (!p || p.exterminio == null) continue;
      const o = S().civ(m, p.exterminio);
      if (!o || !o.viva || !S().enGuerra(c, o)) {
        if (o && !o.viva) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '☠ No queda nadie de ' + o.nombre });
        if (o && o.viva) o.exterminadoPor = null;
        p.exterminio = null; continue;
      }
      const victimas = new Map();
      for (const b of v.aldeanos) if (b.c === o.id && b.o !== GUERRERO && !muertos.has(b)) { const t = b.y * v.tw + b.x; (victimas.get(t) || victimas.set(t, []).get(t)).push(b); }
      if (!victimas.size) continue;
      for (const a of v.aldeanos) {
        if (a.c !== c.id || a.o !== GUERRERO || muertos.has(a)) continue;
        const alcance = a.tirador && c.era >= 5 ? 3 : 1;
        let b = null;
        for (let dy = -alcance; dy <= alcance && !b; dy++) for (let dx = -alcance; dx <= alcance && !b; dx++) {
          const l = victimas.get((a.y + dy) * v.tw + a.x + dx); b = l && l.find(x => !muertos.has(x));
        }
        if (b) {
          if (azar(v) < 0.8) { muertos.add(b); v.muertos.push([b.x, b.y, b.c, 'batalla', paso, b]); c.exterminados = (c.exterminados || 0) + 1; if (alcance > 1) v.disparos.push([a.x, a.y, b.x, b.y, paso, 1, a.id]); }
        } else if ((paso === 1 || paso === 5) && a.e !== IR) {
          // Va a por el civil más cercano que tenga a la vista.
          let mejor = null, dm = 14;
          for (const [t, l] of victimas) { if (!l.length) continue; const d = Math.abs(t % v.tw - a.x) + Math.abs((t / v.tw | 0) - a.y); if (d < dm) { dm = d; mejor = t; } }
          if (mejor != null) ir(a, mejor, v.tw, IR);
        }
      }
    }
  }

  /*
   * LAS EXPLOSIONES (obuses, granadas, bombas, cañonazos de los barcos): todo lo que hay alrededor sufre.
   * La gente (soldados o no, de cualquier otro pueblo) se lleva metralla; los edificios acumulan daño hasta caer
   * en ruinas; el suelo queda con cráter, el camino reventado, la trinchera hundida, los árboles por el suelo y
   * los campos arrasados; a veces prende fuego. «radio» 1 = la casilla y sus cuatro vecinas; 1.5 = el 3×3.
   */
  const RESISTE = { [OBRA.casa]: 60, [OBRA.campo]: 25, [OBRA.torre]: 160, [OBRA.castillo]: 240, [OBRA.palacio]: 180, [OBRA.templo]: 140, [OBRA.cuartel]: 130, [OBRA.ayuntamiento]: 150 };
  function estallido(m, c, t0, radio, fuerza, paso, muertos, tipo, atacante) {
    const v = m.vida, tw = v.tw, x0 = t0 % tw, y0 = t0 / tw | 0, R = Math.ceil(radio), cae = Math.min(TICKS, paso);
    const casillas = new Map();
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = radio >= 1.5 ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.abs(dx) + Math.abs(dy);
      if (d > R || x0 + dx < 0 || x0 + dx >= tw || y0 + dy < 0 || y0 + dy >= v.th) continue;
      casillas.set((y0 + dy) * tw + x0 + dx, d ? 0.5 : 1);
    }
    // La gente: metralla para todos los que no son del pueblo que dispara.
    let bajas = 0;
    for (const b of v.aldeanos) {
      const f = casillas.get(b.y * tw + b.x);
      if (!f || b.c === c.id || (muertos && muertos.has(b)) || b.muerta) continue;
      const arm = b.veh ? VEHICULOS[b.veh].blindaje || 0 : (ARMADURAS[b.armadura || 0] || ARMADURAS[0]).reduce * 0.4;
      const dano = Math.max(1, Math.round(fuerza * f * (0.8 + azar(v) * 0.4) * (1 - arm)));
      if (golpear(v, null, b, dano, paso + 0.5, x0, y0)) {
        b.muerta = 1; if (muertos) muertos.add(b);
        v.muertos.push([b.x, b.y, b.c, tipo, paso + 0.5, b]); apuntarBaja(m, c.id, b); bajas++;
        if (b.o === GUERRERO) c.victorias = (c.victorias || 0) + 1;
        if (atacante) atacante.bajas = (atacante.bajas || 0) + 1;
      }
    }
    if (!muertos && bajas) v.aldeanos = v.aldeanos.filter(b => !b.muerta);
    // Lo construido y el suelo.
    v.danoObra = v.danoObra || {};
    for (const [t, f] of casillas) {
      const golpe = fuerza * f * (0.6 + azar(v) * 0.8), o = v.obra[t];
      if (f === 1 || azar(v) < 0.4) marcar(m, t, 'crater', Math.max(3, Math.round(fuerza / 8 * f)), cae);
      if (v.arbol[t] >= 1 && azar(v) < 0.5 * f + fuerza / 300) { cambiar(m, 'arbol', t, 0, cae); marcar(m, t, 'tronco', 16, cae, -1); }
      if (v.camino[t] && !o && azar(v) < fuerza * f / 160) cambiar(m, 'camino', t, 0, cae);
      if (v.trinchera && v.trinchera[t] && azar(v) < fuerza * f / 120) { v.trinchera[t]--; v.trincheraVer = (v.trincheraVer || 0) + 1; }
      if (v.muro && v.muro[t] > 0) { v.muro[t] = Math.max(0, v.muro[t] - golpe / 3); if (!v.muro[t]) { if (v.puerta) v.puerta[t] = 0; marcar(m, t, 'escombros', 12, cae); } v.muroVer = (v.muroVer || 0) + 1; }
      if (o && o !== OBRA.ruina && o !== OBRA.centro) {
        if (o === OBRA.campo) { if (azar(v) < golpe / RESISTE[OBRA.campo]) cambiar(m, 'obra', t, 0, cae); }
        else if (v.torres && v.torres[t] != null) { v.torres[t] -= golpe / 6; if (v.torres[t] <= 0) { cambiar(m, 'obra', t, OBRA.ruina, cae); delete v.torres[t]; marcar(m, t, 'escombros', 12, cae); } }
        else {
          v.danoObra[t] = (v.danoObra[t] || 0) + golpe;
          if (v.danoObra[t] >= (RESISTE[o] || 100)) { cambiar(m, 'obra', t, OBRA.ruina, cae); marcar(m, t, 'escombros', 12, cae); delete v.danoObra[t]; }
        }
      }
      if (azar(v) < fuerza * f / 260) prender(m, t, cae, 2);
    }
    return bajas;
  }
  // Los edificios dañados se arreglan poco a poco en paz (los constructores tapan los boquetes).
  function repararDanos(m) {
    const v = m.vida, d = v.danoObra; if (!d) return;
    for (const k of Object.keys(d)) {
      const t = +k, c = S().civ(m, m.dueno[region(m, t)]);
      if (!v.obra[t] || v.obra[t] === OBRA.ruina) { delete d[k]; continue; }
      d[k] -= c && !c.guerras.length ? 6 : 1.5;
      if (d[k] <= 0) delete d[k];
    }
  }

  // La granada: el daño en la casilla donde cae (la mitad en las de al lado).
  const GRANADA = 60;
  // Dónde lanzarla: a 2–4 casillas, mejor a una trinchera enemiga o adonde haya más enemigos juntos.
  function buscaGranada(v, a, guerreros, enemigo) {
    let mejor = null, nota = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < 2 || d > 4) continue;
      const t = (a.y + dy) * v.tw + a.x + dx, l = guerreros.get(t);
      if (!l) continue;
      const n = l.filter(enemigo).length;
      if (!n) continue;
      const pt = n + (v.trinchera && v.trinchera[t] ? 2 : 0);
      if (pt > nota) { nota = pt; mejor = t; }
    }
    return mejor;
  }

  function ir(a, t, tw, estado) { a.tx = t % tw; a.ty = t / tw | 0; a.e = estado; a.q = 0; }
  function pasear(m, a, ter, c) {
    const v = m.vida, base = centro(m, a.h);
    // En el rato libre se va a la plaza pública o al parque, si hay uno cerca: allí se charla y juegan los niños.
    const ocio = v.ocio && v.ocio[a.c];
    if (ocio && ocio.length && azar(v) < 0.55) {
      const aqui = a.y * v.tw + a.x, t = ocio.reduce((b, x) => (dist(m, aqui, x) < dist(m, aqui, b) ? x : b), ocio[0]);
      if (dist(m, aqui, t) <= 14) {
        const u = t + [1, -1, v.tw, -v.tw, 0][Math.floor(azar(v) * 5)];
        if (u >= 0 && u < ter.length && andable(ter[u])) { ir(a, u, v.tw, IR); a.paseo = 2; return; }
      }
    }
    for (let k = 0; k < 6; k++) {
      const t = base + Math.round((azar(v) - 0.5) * 6) + Math.round((azar(v) - 0.5) * 6) * v.tw;
      if (t >= 0 && t < ter.length && andable(ter[t]) && dist(m, t, base) <= 4) { ir(a, t, v.tw, IR); a.paseo = 1; return; }
    }
    a.e = ESPERAR; a.t = 2;
  }
  function cercano(m, a, lista, reservadas, max) {
    const v = m.vida, aqui = a.y * v.tw + a.x;
    let mejor = -1, md = max;
    const n = Math.min(14, lista.length);
    for (let k = 0; k < n; k++) {
      const t = lista[Math.floor(azar(v) * lista.length)];
      if (reservadas.has(t)) continue;
      const d = dist(m, aqui, t);
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Lo más cercano a la aldea del aldeano que cumpla una condición: busca región a región, en anillos.
  function cercaDeCasa(m, a, c, rec, sirve, maxAnillo, clave) {
    const k = clave ? clave + ':' + a.h : null;
    if (k && memo.get(k) === -1) return -1;
    const r0 = cercaDeCasa2(m, a, c, rec, sirve, maxAnillo);
    if (k && r0 < 0) memo.set(k, -1);
    return r0;
  }
  function cercaDeCasa2(m, a, c, rec, sirve, maxAnillo) {
    const v = m.vida, aqui = a.y * v.tw + a.x, [hx, hy] = [a.h % m.W, Math.floor(a.h / m.W)];
    for (let anillo = 0; anillo <= maxAnillo; anillo++) {
      let mejor = -1, md = 1e9;
      for (let ry = hy - anillo; ry <= hy + anillo; ry++) for (let rx = hx - anillo; rx <= hx + anillo; rx++) {
        if (Math.max(Math.abs(rx - hx), Math.abs(ry - hy)) !== anillo || rx < 0 || ry < 0 || rx >= m.W || ry >= m.H) continue;
        const r = ry * m.W + rx, d0 = m.dueno[r];
        if (d0 >= 0 && d0 !== c.id) continue;
        for (const t of parcelas(m, r)) {
          if (!sirve(t) || rec.reservadas.has(t)) continue;
          const d = dist(m, aqui, t);
          if (d < md) { md = d; mejor = t; }
        }
      }
      if (mejor >= 0) return mejor;
    }
    return -1;
  }

  function elegirTarea(m, a, c, rec, ter) {
    const v = m.vida;
    if (a.dormir) { if (a.x === a.casa % v.tw && a.y === (a.casa / v.tw | 0)) { a.e = ESPERAR; a.t = 99; a.enCasa = 1; } else ir(a, a.casa, v.tw, IR); return; }
    if (esNino(a)) { pasear(m, a, ter, c); return; }
    if (a.colono != null) {
      // Los que cruzan el mar van primero al puerto, a esperar el barco.
      if (a.porMar) { const x = v.expediciones && v.expediciones[a.c]; if (x && x.r === a.colono) { ir(a, x.puerto, v.tw, IR); a.paseo = 2; return; } a.porMar = 0; }
      ir(a, centro(m, a.colono), v.tw, IR); a.viajeColono = 1; return;
    }
    a.paseo = 0;
    // El obrero va a su fábrica a trabajar su jornada.
    // El ministro de economía trabaja en el banco central.
    if (a.ministro) { const tb = c.bancoT; if (tb != null && v.obra[tb] === OBRA.banco) { a.k = 0; ir(a, tb, v.tw, IR); a.enFabrica = 1; return; } }
    if (a.obrero != null) {
      if (ES_INDUSTRIA.has(v.obra[a.obrero])) {
        // (Los albañiles de una inmobiliaria van a su obra, no a la oficina.)
        const pv = v.obra[a.obrero] === OBRA.inmopriv && v.privados && v.privados[a.obrero], due = pv && v.aldeanos.find(x => x.id === pv.dueno), pr = due && due.emp && due.emp.proy;
        a.k = 0; ir(a, pr && v.andamios && v.andamios[pr.t] ? pr.t : a.obrero, v.tw, IR); a.enFabrica = 1; return;
      }
      delete a.obrero;
    }
    if (a.k) { ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    let t = -1;
    if (a.o === LENADOR && c.madera < (60 + 20 * c.era) * prio(c, 'madera') * 1.5) {
      t = cercaDeCasa(m, a, c, rec, x => v.arbol[x] >= 2, 3, 'arbol');
      // Talado el bosque de alrededor, el leñador va más lejos (hasta 8 comarcas) antes que quedarse de brazos cruzados.
      if (t < 0) t = cercaDeCasa(m, a, c, rec, x => v.arbol[x] >= 2, 8, 'arbolLejos');
    }
    // El leñador también planta: si no queda bosque que talar cerca, o si el bosque escasea (con semillas).
    const reforesta = c.plan && c.plan.reforestar > m.turno;
    if (a.o === LENADOR && (c.semillas || 0) >= 1 && (t < 0 || (reforesta && azar(v) < 0.75) || ((c.arboles || 0) < 30 && azar(v) < 0.3))) {
      const p = libre(m, a, c, rec, ter, BOSQUE_PLANTABLE, x => !enCasco(m, x) && !calleDelPlan(m, x) && !(v.plan && v.plan[x] === 2) && !v.cultivo[x]);
      if (p >= 0) { t = p; a.plantar = 1; }
    }
    else if (a.o === MINERO) {
      // Con la Edad del Bronce, los mineros buscan vetas de metal para la armería; si no, piedra.
      const vendeMetal = pausada(m) && c.cartera && (c.cartera.metal || c.cartera.armas);
      const faltaMetal = c.era >= 1 && ((c.metal || 0) < 8 + 4 * c.era || (vendeMetal && (c.metal || 0) < 60) || (prio(c, 'metal') > 1 && (c.metal || 0) < 150));
      a.buscaMetal = 0;
      // Si el jugador pide piedra (o un edificio que la necesita), las vetas pasan a segundo plano.
      const quierePiedra = (prio(c, 'piedra') > 1 && prio(c, 'piedra') >= prio(c, 'metal')) || (c.plan && c.plan.obra && (COSTES[OBRA[c.plan.obra]] || [0, 0])[1] > c.piedra);
      // En la era industrial, el carbón: primero las vetas negras, y si no, una mina de carbón en la montaña.
      const vendeCarbon = pausada(m) && c.cartera && c.cartera.carbon;
      const faltaCarbon = c.era >= 6 && ((c.carbon || 0) < objetivo(c, 'carbon') || (vendeCarbon && (c.carbon || 0) < 80) || (prio(c, 'carbon') > 1 && (c.carbon || 0) < 150));
      a.buscaCarbon = 0;
      if (faltaCarbon && azar(v) < (quierePiedra ? 0.25 : 0.55)) { t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && v.mena[x] === 3, 5, 'carbon'); }
      if (t < 0 && faltaCarbon && pausada(m) && azar(v) < 0.5) { t = cercaDeCasa(m, a, c, rec, x => ter[x] === 'montana' && !v.obra[x] && !v.arbol[x] && !v.roca[x], 5, 'mina'); if (t >= 0) { a.cantera = 1; a.buscaCarbon = 1; } }
      if (t < 0 && faltaMetal && azar(v) < (quierePiedra ? 0.2 : 0.8)) { t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && (v.mena[x] === 1 || v.mena[x] === 2), 4, 'mena'); }
      const faltaPiedra = c.piedra < (30 + 10 * c.era) * Math.max(0.5, prio(c, 'piedra'));
      if (!a.buscaCarbon) a.cantera = 0;
      // Agotadas las vetas sueltas, una mina en la montaña sigue dando metal a quien lo necesita o lo vende.
      if (t < 0 && faltaMetal && pausada(m) && azar(v) < (quierePiedra ? 0.3 : 0.85)) { t = cercaDeCasa(m, a, c, rec, x => ter[x] === 'montana' && !v.obra[x] && !v.arbol[x] && !v.roca[x], 5, 'mina'); if (t >= 0) { a.cantera = 1; a.buscaMetal = 1; } }
      if (t < 0 && faltaPiedra) { t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && ter[x] !== 'agua', 3, 'roca'); }
      // Sin vetas ni piedras sueltas cerca (o al azar, para no depender solo de ellas), a la mina: nunca se agota.
      a.enMina = 0;
      if ((c.minasT || []).length && (t < 0 || azar(v) < 0.25) && (faltaPiedra || faltaMetal || faltaCarbon)) {
        const aqui = a.y * v.tw + a.x, mt = c.minasT.slice().sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0];
        if (mt != null) { t = mt; a.enMina = 1; a.cantera = 0; a.buscaCarbon = 0; a.mineQuiere = faltaCarbon ? 'carbon' : faltaMetal ? 'metal' : 'piedra'; }
      }
      // Sin piedras sueltas cerca, se abre una cantera en la montaña o la colina: más lejos, pero no se acaba.
      if (t < 0 && (faltaPiedra || faltaMetal)) { t = cercaDeCasa(m, a, c, rec, x => (ter[x] === 'montana' || ter[x] === 'colina') && !v.obra[x] && !v.arbol[x] && !v.roca[x], 3, 'cantera'); if (t >= 0) a.cantera = 1; }
      // Como el leñador: sin nada cerca (ni vetas, ni mina, ni cantera), van más lejos, hasta 8 comarcas, antes que quedarse parados.
      if (t < 0 && faltaCarbon) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && v.mena[x] === 3, 8, 'carbonLejos');
      if (t < 0 && faltaMetal) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && (v.mena[x] === 1 || v.mena[x] === 2), 8, 'menaLejos');
      if (t < 0 && faltaPiedra) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && ter[x] !== 'agua', 8, 'rocaLejos');
    }
    else if (a.o === GRANJERO) {
      a.siega = 0;
      // Primero se siega lo que está maduro; luego se aran campos nuevos si hacen falta.
      const km = 'mad:' + a.h;
      if (!memo.has(km)) memo.set(km, [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r)).filter(x => v.obra[x] === OBRA.campo));
      const maduros = memo.get(km).filter(x => v.cultivo[x] >= 3 && v.obra[x] === OBRA.campo && !rec.reservadas.has(x));
      if (maduros.length) { t = maduros[Math.floor(azar(v) * maduros.length)]; a.siega = 1; }
      else if (c.campos < metaCampos(c) && memo.get('campo:' + a.h) !== -1) { t = libre(m, a, c, rec, ter, CULTIVABLE, junto => !enCasco(m, junto) && molinoCerca(m, c, null, junto)); if (t < 0) { memo.set('campo:' + a.h, -1); c.sinCampo = m.turno; } }
      // Sin campo que segar ni que arar, el granjero hace de pastor: va a ordeñar o esquilar una res del pueblo.
      a.pastor = null;
      if (t < 0) {
        const aqui = a.y * v.tw + a.x;
        let mejor = null, md = 30;
        // (Como mucho tres pastores por corral a la vez: cada uno atiende a varias reses.)
        const enCorral = memo.get('pastores:' + c.id + ':' + m.turno) || {}; memo.set('pastores:' + c.id + ':' + m.turno, enCorral);
        for (const b of rebanosDe(v, c.id)) {
          if (b.atendido === m.turno || (b.corral != null && (enCorral[b.corral] || 0) >= 3)) continue;
          const d = dist(m, aqui, b.y * v.tw + b.x);
          if (d < md) { md = d; mejor = b; }
        }
        if (mejor) { mejor.atendido = m.turno; a.pastor = mejor.id; t = mejor.y * v.tw + mejor.x; if (mejor.corral != null) enCorral[mejor.corral] = (enCorral[mejor.corral] || 0) + 1; }
      }
      // Ni campo ni rebaño: a cazar ciervos al bosque o a pescar desde la orilla.
      a.caza = null;
      if (t < 0) {
        const aqui = a.y * v.tw + a.x;
        let mejor = null, md = 26, donde = -1;
        for (const b of salvajes(v)) {
          if (b.atendido === m.turno || b.muerta) continue;
          const bt = b.y * v.tw + b.x, d = dist(m, aqui, bt);
          if (d >= md) continue;
          let destino = bt;
          if (b.tipo === 'pez') { destino = -1; for (const dd of [1, -1, v.tw, -v.tw, 2, -2, 2 * v.tw, -2 * v.tw]) { const n = bt + dd; if (n >= 0 && n < ter.length && andable(ter[n])) { destino = n; break; } } }
          if (destino < 0) continue;
          md = d; mejor = b; donde = destino;
        }
        if (mejor) { mejor.atendido = m.turno; a.caza = mejor.id; t = donde; }
      }
    }
    else if (a.o === CONSTRUCTOR) {
      a.obraCamino = 0; a.edificio = 0; a.obraMuro = 0;
      // Antes que nada, un edificio privado ya pagado que nadie ha empezado: uno va a poner el andamio (luego los demás
      // ayudan, como en cualquier obra a medias). Si no, en un reino grande siempre hay alguna obra a medias cerca y la
      // fábrica de un capitalista se quedaba esperando para siempre.
      // (Va el constructor más cercano: si va uno de la otra punta del reino, se hace de noche o le sale otra cosa por
      // el camino y la obra no empieza nunca. Si en veinte turnos no ha ido nadie, va cualquiera.)
      const aqui0 = a.y * v.tw + a.x;
      const cerca = e => { if (e.desde == null) e.desde = m.turno; if (m.turno - e.desde > 20) return true; const k = 'privCerca:' + c.id + ':' + e.t; if (!memo.has(k)) { let md = 1e9; for (const x of v.aldeanos) if (x.c === c.id && x.o === CONSTRUCTOR && x.x >= 0) md = Math.min(md, dist(m, x.y * v.tw + x.x, e.t)); memo.set(k, md); } return dist(m, aqui0, e.t) <= memo.get(k) + 6; };
      const privadaSinEmpezar = pausada(m) && ((c.plan && c.plan.encargos) || []).find(e => e.privado != null && !rec.reservadas.has(e.t) && !(v.andamios && v.andamios[e.t]) && !v.obra[e.t] && cerca(e) && !puedeColocar(m, c, e.t, e.clave, true));
      if (privadaSinEmpezar) { a.edificio = privadaSinEmpezar.o; ir(a, privadaSinEmpezar.t, v.tw, IR); rec.reservadas.add(privadaSinEmpezar.t); return; }
      // Lo primero, las obras a medias del pueblo: se va a ayudar a la más cercana.
      if (pausada(m) && v.andamios) {
        let mejor = -1, md = 40;
        // (Una obra parada por falta de material no retiene al constructor si hay una privada, ya pagada, esperando.)
        const privadaEspera = (c.plan && c.plan.encargos || []).some(e => e.privado != null && !rec.reservadas.has(e.t) && !(v.andamios && v.andamios[e.t]));
        for (const k of Object.keys(v.andamios)) { const an = v.andamios[k]; if (an.civ !== c.id || (an.espera && privadaEspera)) continue; const d = dist(m, a.y * v.tw + a.x, +k); if (d < md) { md = d; mejor = +k; } }
        if (mejor >= 0) { a.edificio = v.andamios[mejor].o; ir(a, mejor, v.tw, IR); rec.reservadas.add(mejor); return; }
      }
      // Las reformas: un edificio de una edad pasada se pone al día (tejado nuevo, piedra, ladrillo…), uno a uno.
      a.reforma = null;
      if (pausada(m) && v.edificios && azar(v) < 0.25 && c.madera >= 4 && c.piedra >= 2) {
        const zona = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
        let mejor = -1, md = 1e9;
        for (const r of zona) for (const u of parcelas(m, r)) {
          const rec = v.edificios[u];
          if (!rec || rec.ruina || v.obra[u] !== rec.tipo || etapa(rec.tipo, rec.era) >= etapa(rec.tipo, c.era) || SIN_REFORMA.has(rec.tipo)) continue;
          if (rec.reformando > m.turno - 3 || rec.turno > m.turno - 4) continue;
          // (Los edificios de los mercaderes van primero: la casa comercial se paga su reforma.)
          const d = dist(m, a.y * v.tw + a.x, u) + rec.era * 3 - (v.privados && v.privados[u] ? 25 : 0);
          if (d < md) { md = d; mejor = u; }
        }
        if (mejor >= 0 && md < 60) { v.edificios[mejor].reformando = m.turno; a.reforma = mejor; ir(a, mejor, v.tw, IR); rec.reservadas.add(mejor); return; }
      }
      // Después, lo que el arquitecto (el jugador) dejó marcado en el mapa, por orden, si hay con qué pagarlo.
      const encargos = c.plan && c.plan.encargos;
      if (encargos && encargos.length) {
        for (let i = 0; i < encargos.length; i++) {
          const e = encargos[i];
          const no = puedeColocar(m, c, e.t, e.clave, true);
          // Si lo que falta es tamaño o época, el encargo espera; si la parcela ya no vale, se olvida.
          if (no) { if (!/hace falta ser|llega con/.test(no)) encargos.splice(i--, 1); continue; }
          if (rec.reservadas.has(e.t)) continue;
          const coste = privada(v, e.t, c) ? [0, 0, 0] : COSTES[e.o] || [0, 0, 0];
          if (c.madera < coste[0] || c.piedra < coste[1] || (c.oro || 0) < (coste[2] || 0)) { const pr = c.plan.prioridad; if (pr) { if (c.madera < coste[0]) pr.madera = Math.max(pr.madera || 1, 1.5); if (c.piedra < coste[1]) pr.piedra = Math.max(pr.piedra || 1, 1.5); } continue; }
          a.edificio = e.o; ir(a, e.t, v.tw, IR); rec.reservadas.add(e.t); return;
        }
      }
      // Los caminos pendientes se empiedran cuando las casas no corren prisa (o una de cada dos veces).
      const pend = (v.pendientes && v.pendientes[c.id]) || [];
      // La carretera que pidió el jugador («abrid una ruta comercial con X») corre más prisa.
      const urge = pend.length && v.rutas.some(ru => ru.pedida && (ru.a === c.id || ru.b === c.id));
      // (Con caminos pendientes, la mitad de las veces se mira antes si hace falta un edificio: si no, un reino con
      // un solo constructor se pasa la vida empedrando y nunca levanta su puerto o su templo.)
      let yaMirado = false;
      // (Y lo que mandó construir el jugador va siempre antes que empedrar, aunque la carretera también la pidiera él.)
      const mandada = pausada(m) && c.plan && c.plan.obra;
      // (Aunque la carretera la pidiera el jugador, una de cada tres veces se mira antes: si no, con muchas rutas
      // abiertas y un solo constructor, el templo o la casa del saber no llegan nunca y el reino no sube de edad.)
      if (pend.length && (mandada || azar(v) < (urge ? 0.35 : 0.5))) { yaMirado = true; const ed = edificioPendiente(m, a, c, ter); if (ed) { t = ed[0]; a.edificio = ed[1]; } }
      if (t < 0 && pend.length && (!faltanCamas(c) || azar(v) < (urge ? 0.75 : 0.4))) {
        const aqui = a.y * v.tw + a.x;
        // Se empiedra de dentro afuera: el tramo sin hacer más cercano, aunque la carretera vaya muy lejos.
        let md = 160;
        for (const x of pend) { if (rec.reservadas.has(x) || v.camino[x]) continue; const d = dist(m, aqui, x); if (d < md) { md = d; t = x; } }
        if (t >= 0) a.obraCamino = 1;
      }
      if (t < 0 && !yaMirado && (azar(v) < 0.6 || !molinoCerca(m, c, a.h))) { const ed = edificioPendiente(m, a, c, ter); if (ed) { t = ed[0]; a.edificio = ed[1]; } }
      const reserva = c.plan && c.plan.obra ? (COSTES[OBRA[c.plan.obra]] || [0])[0] : 0; // la madera del encargo del jugador no se gasta en casas
      // La muralla: en guerra va antes que las casas; si no, cuando no hay otra cosa (y uno de cada tres constructores).
      const tramoMuro = () => { const mt = muroPendiente(m, a, c, rec); if (mt != null) { t = mt; a.obraMuro = 1; rec.reservadas.add(mt); } };
      if (t < 0 && pausada(m) && c.guerras.length) tramoMuro();
      if (t < 0 && faltanCamas(c) && c.madera >= 2 + reserva && memo.get('casa:' + a.h) !== -1) { t = casaNueva(m, a, c, rec, ter); if (t < 0) memo.set('casa:' + a.h, -1); }
      if (t < 0 && pausada(m) && (a.id % 2 === 0 || (c.plan && c.plan.murallas))) tramoMuro();
    }
    else if (a.o === COMERCIANTE) {
      // Elige una ruta abierta de su pueblo y sale desde su extremo: la capital propia en las rutas entre reinos.
      const rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru));
      if (rutas.length) {
        // Si hay algo encargado, primero la ruta hasta quien lo pueda vender.
        const utiles = rutas.filter(ru => ru.tipo === 'externa' && sirveSocio(m, c, S().civ(m, ru.a === c.id ? ru.b : ru.a)));
        const lista = utiles.length && azar(v) < 0.7 ? utiles : rutas;
        const ru = lista[Math.floor(azar(v) * lista.length)], aqui = a.y * v.tw + a.x;
        const desdeA = ru.tipo === 'externa' ? ru.a === c.id : dist(m, aqui, ru.tiles[0]) <= dist(m, aqui, ru.tiles[ru.tiles.length - 1]);
        a.ruta = ru.id; a.dir = desdeA ? 1 : -1; a.i = desdeA ? 0 : ru.tiles.length - 1; a.vuelta = 0; a.viaje = 1;
        t = ru.tiles[a.i];
        if (pausada(m) && ru.tipo === 'externa' && !a.carga) { const o = S().civ(m, ru.a === c.id ? ru.b : ru.a); if (o && o.viva) cargar(m, a, c, o); }
      }
    }
    else if (a.o === ERUDITO) {
      // Al templo (si hay) o a la plaza, a estudiar, enseñar, rezar u observar el cielo.
      // Primero la casa del saber; si no hay, el templo; si no, la plaza.
      let sitios = [], donde = 0;
      for (const [obra, nivel] of [[OBRA.saber, 3], [OBRA.templo, 2]]) {
        for (const r of [a.h, c.capital, ...S().vecinos(a.h)]) for (const x of parcelas(m, r)) if (v.obra[x] === obra && m.dueno[region(m, x)] === c.id) sitios.push(x);
        if (sitios.length) { donde = nivel; break; }
      }
      const base = sitios.length ? sitios[a.id % sitios.length] : centro(m, c.capital);
      const dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 2) + 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      a.estudio = donde || 1;
    }
    else if (a.o === GUERRERO && a.fijo && a.fijo.guardia != null) {
      // Un escuadrón con misión: monta guardia en su plaza (o marcha sobre la plaza enemiga que le mandaron).
      // (Las tropas del jugador, al punto exacto que tocó y en formación.)
      const base = a.fijo.punto != null ? a.fijo.punto : centro(m, a.fijo.guardia), dx = a.fijo.dx != null ? a.fijo.dx : (a.id % 3) - 1, dy = a.fijo.dy != null ? a.fijo.dy : (Math.floor(a.id / 3) % 3) - 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 2; return; }
    }
    else if (a.o === GUERRERO && v.ejercitos[c.id]) {
      // En formación detrás del capitán: primero al punto de reunión, luego a por el objetivo.
      const e = v.ejercitos[c.id];
      let base = e.defiende != null ? centro(m, e.defiende) : e.fase === 'reunion' ? centro(m, e.reunion) : e.frente != null ? e.frente : centro(m, e.obj);
      // (Un refuerzo lejos del frente va antes al punto de reunión, y sale con su grupo.)
      if (e.fase === 'marcha' && e.defiende == null && e.reunion != null && e.frente != null && dist(m, a.y * v.tw + a.x, e.frente) > 12 && !(e.ola != null && m.turno - e.ola <= 8)) base = centro(m, e.reunion);
      else if (e.linea && a.veh && e.blancoT != null && e.defiende == null) {
        // Mientras la infantería espera en la línea, el tanque (blindado) va a por la torre, y el cañón o la
        // artillería se pone justo fuera de su alcance, en línea recta, para bombardearla.
        const bx = e.blancoT % v.tw, by = e.blancoT / v.tw | 0, fx = e.frente % v.tw, fy = e.frente / v.tw | 0, R = e.blancoR + 1;
        base = a.veh === 'tanque' ? e.blancoT + (Math.sign(fy - by) || 1) * v.tw : Math.abs(fx - bx) >= Math.abs(fy - by) ? by * v.tw + bx + (Math.sign(fx - bx) || 1) * R : (by + (Math.sign(fy - by) || 1) * R) * v.tw + bx;
        if (base < 0 || base >= ter.length || !andable(ter[base])) base = e.frente;
      }
      // En formación, mirando al enemigo: delante los de cuerpo a cuerpo, detrás los tiradores y al fondo los tanques
      // y la artillería; a lo ancho, siete por fila.
      const suelto = e.linea && a.veh && e.blancoT != null;
      const [ex, ey] = haciaEnemigo(m, c, e), papel = a.veh ? -2 : a.tirador ? 0 : 1, ancho = (a.id % 7) - 3, fila = papel - (((a.id / 7) | 0) % 2);
      const dx = suelto ? 0 : ex ? fila * ex : ancho, dy = suelto ? 0 : ex ? ancho : fila * (ey || 1);
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      if (a.x === t % v.tw && a.y === (t / v.tw | 0)) {
        // Esperando (en la línea frente a una torre o defendiendo una plaza), desde la pólvora cavan una zanja rápida
        // con parapeto donde esperan; sin enemigos cerca, en unos turnos se rellena.
        if ((e.linea || e.defiende != null) && c.era >= 5 && !v.obra[t] && !(v.muro && v.muro[t]) && ter[t] !== 'agua' && ter[t] !== 'bajo' && ter[t] !== 'montana') {
          v.trinchera = v.trinchera || new Array(v.tw * v.th).fill(0);
          if (!v.trinchera[t]) { v.trinchera[t] = 1; v.trincheraVer = (v.trincheraVer || 0) + 1; (v.zanjas = v.zanjas || {})[t] = m.turno; }
        }
        a.e = ESPERAR; a.t = 2; return;
      }
    }
    else if (a.o === GUERRERO && c.era >= 8 && (c.trincheraPlan || []).length && (a.id % 2 === 0 || c.guerras.length)) {
      // En la Segunda Guerra Mundial: cavar la trinchera (y ponerle alambre); en guerra, ocuparla y esperar.
      v.trinchera = v.trinchera || new Array(v.tw * v.th).fill(0);
      const aqui = a.y * v.tw + a.x, plan = c.trincheraPlan;
      const pendiente = plan.filter(x => (v.trinchera[x] || 0) < 2 && !rec.reservadas.has(x)).sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0];
      const ocupar = c.guerras.length ? plan.filter(x => v.trinchera[x] && !rec.reservadas.has(x)).sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0] : null;
      if (ocupar != null && (a.id % 3 !== 0 || pendiente == null)) {
        if (aqui === ocupar) { a.e = ESPERAR; a.t = 3; return; }
        t = ocupar; a.cavar = 0;
      } else if (pendiente != null) { t = pendiente; a.cavar = 1; }
    }
    else if (a.o === GUERRERO && !c.guerras.length && (c.aduanas || []).length && a.id % 3 === 0) {
      // En paz, uno de cada tres soldados hace la guardia en un puesto fronterizo: de pie junto a la barrera.
      const pf = c.aduanas[(a.id / 3 | 0) % c.aduanas.length], lado = (a.id / 3 | 0) % 2 ? 1 : -1;
      t = pf + lado;
      if (t < 0 || t >= ter.length || !andable(ter[t]) || v.obra[t]) t = pf + lado * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = -1;
      else if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 3; a.guardiaEn = pf; return; }
    }
    else if (a.o === GUERRERO && !c.guerras.length) {
      // En paz, los guerreros salen a cazar los lobos que rondan su tierra.
      let md = 22;
      for (const b of v.animales) { if (b.tipo !== 'lobo') continue; const d = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); if (d < md && m.dueno[region(m, b.y * v.tw + b.x)] === c.id || d < 8) { md = d; t = b.y * v.tw + b.x; } }
    }
    if (t >= 0) { ir(a, t, v.tw, IR); rec.reservadas.add(t); return; }
    // Sin tarea: los granjeros cuidan un campo, los demás pasean por su aldea.
    if (a.o === GRANJERO && c.campos > 0 && azar(v) < 0.7) {
      const campos = parcelas(m, a.h).filter(x => v.obra[x] === OBRA.campo);
      if (campos.length) { ir(a, campos[Math.floor(azar(v) * campos.length)], v.tw, IR); a.paseo = 2; return; }
    }
    pasear(m, a, ter, c);
  }
  const metaCampos = c => Math.round((4 + (c.habitantes != null ? c.habitantes : c.pob / escala(c)) * 0.55) * (0.6 + 0.4 * prio(c, 'comida')));
  // Hacen falta casas cuando no quedan camas para los que van a nacer (como en WorldBox: se construye por necesidad).
  const faltanCamas = c => (c.sinCama || 0) > 0 || !!(c.plan && (c.plan.temporales || []).some(t => t.hasta && t.hasta.cosa === 'casas')) || (c.camas || 0) - (c.aldeanos || 0) < 2 + Math.round(prio(c, 'casas') * 1.5);
  // Una casa nueva va siempre pegada a lo que ya hay (casas, plaza, molino, caminos), lo más cerca posible de la plaza:
  // así el pueblo crece como una mancha alrededor de su centro.
  const PEGA = new Set([OBRA.campamento, OBRA.saber, OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.molino, OBRA.templo, OBRA.torre, OBRA.cuartel, OBRA.arqueria, OBRA.castillo]);
  function casaNueva(m, a, c, rec, ter) {
    const v = m.vida, base = centro(m, a.h), regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 1e9;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      const plano = pausada(m) && v.plan && v.centros && v.centros.length;
      const huertaVieja = plano && v.obra[t] === OBRA.campo && v.plan[t] === 2;
      if ((v.obra[t] && !huertaVieja) || v.roca[t] || v.camino[t] || ocupada(v, t) || v.arbol[t] >= 2 || !CONSTRUIBLE.has(ter[t]) || rec.reservadas.has(t)) continue;
      if (plano && v.plan[t] !== 2) continue; // solo en los solares del casco
      const x = t % v.tw;
      let junto = false;
      if (plano) for (const d of [-1, 1, -v.tw, v.tw]) if (v.plan[t + d] === 1) { junto = true; break; }
      for (const d of [-1, 1, -v.tw, v.tw, -v.tw - 1, -v.tw + 1, v.tw - 1, v.tw + 1]) { const n = t + d; if (n < 0 || n >= v.obra.length || Math.abs((n % v.tw) - x) > 1) continue; if (PEGA.has(v.obra[n]) || v.camino[n]) { junto = true; break; } }
      if (!junto) continue;
      // Distancia redonda (no en rombo), un sesgo fijo por parcela y ganas de arrimarse a otras casas:
      // el pueblo crece como una mancha irregular, con callejas y huecos, no en filas.
      const ty = t / v.tw | 0, bx = base % v.tw, by = base / v.tw | 0;
      let vecinas = 0;
      for (const d of [-1, 1, -v.tw, v.tw]) if (v.obra[t + d] === OBRA.casa) vecinas++;
      const sesgo = ((Math.imul(t, 2654435761) >>> 0) % 1000) / 1000;
      const dd = plano
        // Con plan: lo más cerca de la plaza, junto a la calle, rellenando manzanas (y la huerta vieja, solo si no hay otra cosa).
        ? M.mat.hypot(x - bx, ty - by) + (huertaVieja ? 2.5 : 0) - Math.min(2, vecinas) * 0.6 + azar(v) * 0.8
        : M.mat.hypot(x - bx, ty - by) * (0.75 + sesgo * 0.5) + [0, -0.4, 0.8, 2.5, 4][vecinas] + azar(v) * 3;
      if (dd < md) { md = dd; mejor = t; }
    }
    return mejor;
  }

  // Una parcela libre cerca de casa: primero en su región, luego en las regiones propias de alrededor.
  // ¿Hay un molino cerca? (de la región de la aldea, o a 3 parcelas de una parcela concreta)
  function molinoMasCercano(m, t) {
    const v = m.vida, tx = t % v.tw, ty = t / v.tw | 0;
    let mejor = null, md = 99;
    const R = rangoMolino(m);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const n = (ty + dy) * v.tw + tx + dx, d = Math.abs(dx) + Math.abs(dy);
      if (d <= R && n >= 0 && n < v.obra.length && v.obra[n] === OBRA.molino && d < md) { md = d; mejor = n; }
    }
    return mejor;
  }
  function molinoCerca(m, c, r, t) {
    const v = m.vida;
    if (t != null) {
      const tx = t % v.tw, ty = t / v.tw | 0;
      const R = rangoMolino(m);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > R) continue;
        const n = (ty + dy) * v.tw + tx + dx;
        if (n >= 0 && n < v.obra.length && v.obra[n] === OBRA.molino) {
          // Cada molino muele lo de unos pocos campos: lleno, ya no deja arar más a su alrededor.
          if (pausada(m) && camposDeMolino(m, n) >= CAMPOS_POR_MOLINO) continue;
          return true;
        }
      }
      return false;
    }
    return [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)].some(z => parcelas(m, z).some(x => v.obra[x] === OBRA.molino));
  }
  function camposDeMolino(m, t) {
    const v = m.vida, tx = t % v.tw, ty = t / v.tw | 0, R = rangoMolino(m);
    let n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { if (Math.abs(dx) + Math.abs(dy) > R) continue; const u = (ty + dy) * v.tw + tx + dx; if (u >= 0 && u < v.obra.length && v.obra[u] === OBRA.campo) n++; }
    return n;
  }
