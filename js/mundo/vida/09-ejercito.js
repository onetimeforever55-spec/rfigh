  // ── GÉNESIS · LA VIDA · Los ejércitos y el frente ──

  /*
   * LOS EJÉRCITOS: en guerra, los guerreros de un pueblo se reúnen junto a la frontera tras su capitán y
   * marchan juntos hacia una región del enemigo (la más cercana a su capital, para llegar al corazón del reino).
   */
  function ejercitos(m) {
    const v = m.vida;
    // Las zanjas rápidas de un ejército que esperaba: sin guerra, a los pocos turnos se rellenan.
    if (v.zanjas) for (const k of Object.keys(v.zanjas)) {
      const t = +k, o = S().civ(m, m.dueno[region(m, t)]);
      if ((!o || !o.guerras.length) && m.turno - v.zanjas[k] > 6) { if (v.trinchera && v.trinchera[t] === 1) { v.trinchera[t] = 0; v.trincheraVer = (v.trincheraVer || 0) + 1; } delete v.zanjas[k]; }
    }
    for (const id of Object.keys(v.ejercitos)) { const c = S().civ(m, +id); if (!c || !c.viva || !c.guerras.length) delete v.ejercitos[id]; }
    for (const c of S().vivas(m)) {
      if (!c.guerras.length) continue;
      const suyos = v.aldeanos.filter(a => a.c === c.id && a.o === GUERRERO);
      let e = v.ejercitos[c.id];
      const o = e && S().civ(m, e.con);
      // Las órdenes del jugador: «atacad X» fija el objetivo; «defended X» planta el ejército en casa.
      const p = c.plan || {};
      // «Anexionad X»: cuando cae una plaza, el ejército sigue con la siguiente (la más cercana) hasta que el reino desaparece.
      if (p.anexar != null) {
        const x = S().civ(m, p.anexar);
        if (!x || !x.viva || !S().enGuerra(c, x)) { if (x && !x.viva && c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '👑 ' + x.nombre + ' ya no existe: todo es vuestro' }); p.anexar = null; }
        else if (p.objetivo == null || m.dueno[p.objetivo] !== x.id) {
          const plazasX = [x.capital, ...(m.ciudades || []).filter(y => y.civ === x.id).map(y => y.region)];
          const base = S().casillas(m, c);
          p.objetivo = plazasX.sort((a1, b1) => Math.min(...base.map(r => S().distancia(r, a1))) - Math.min(...base.map(r => S().distancia(r, b1))))[0];
        }
      }
      const dueObj = p.objetivo != null ? S().civ(m, m.dueno[p.objetivo]) : null;
      const mandado = dueObj && dueObj.viva && dueObj.id !== c.id && S().enGuerra(c, dueObj) ? dueObj : null;
      if (p.objetivo != null && !mandado && !(dueObj && dueObj.id !== c.id && !S().enGuerra(c, dueObj))) p.objetivo = null;
      // Una travesía sin barco (lo hundieron) o sin nadie a bordo se da por perdida: el ejército vuelve a planear.
      if (e && e.fase === 'travesia' && !v.barcos.some(b => b.tipo === 'transporte' && !b.colonia && b.c === c.id && b.estado === 'zarpa' && !b.hundido) && !suyos.some(a => a.aBordo != null)) { e.fase = 'perdida'; e.mar = null; }
      const valido = e && o && o.viva && S().enGuerra(c, o) && (m.dueno[e.obj] === o.id || e.fase === 'travesia') && e.fase !== 'perdida' && (!mandado || e.obj === p.objetivo || e.fase === 'travesia');
      // Soldados ya desembarcados en tierra enemiga: siguen la guerra desde la playa (no vuelven a casa a embarcar).
      const enTierra = suyos.filter(a => a.aBordo == null).map(a => region(m, a.y * v.tw + a.x));
      const cabeza = !valido && !mandado && e && e.desembarco != null ? (() => { const o2 = S().civ(m, e.con); if (!o2 || !o2.viva || !S().enGuerra(c, o2)) return null; const cerca = S().casillas(m, o2).filter(r => enTierra.some(q => S().distancia(q, r) <= 4)).sort((p2, q2) => S().distancia(p2, o2.capital) - S().distancia(q2, o2.capital))[0]; return cerca != null ? { o2, r: cerca } : null; })() : null;
      if (cabeza) { e = { con: cabeza.o2.id, obj: cabeza.r, reunion: e.desembarco, fase: 'marcha', desde: m.turno, asedio: 0, desembarco: e.desembarco }; v.ejercitos[c.id] = e; }
      else if (!valido && mandado) {
        const nuestro = S().frontera(m, mandado, c).sort((x, y) => S().distancia(x, p.objetivo) - S().distancia(y, p.objetivo))[0];
        // Sin frontera con ellos (otra isla, otro continente): se va por mar.
        const mar = nuestro == null ? planNaval(m, c, mandado, p.objetivo) : null;
        e = { con: mandado.id, obj: mar ? mar.obj : p.objetivo, reunion: mar ? region(m, mar.puerto) : nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno, asedio: 0, mar };
        v.ejercitos[c.id] = e;
      } else if (!valido) {
        e = null;
        for (const g of c.guerras) {
          const enemigo = S().civ(m, g.con);
          if (!enemigo || !enemigo.viva) continue;
          const frente = S().frontera(m, c, enemigo);
          if (!frente.length) continue;
          let obj = frente.sort((x, y) => S().distancia(x, enemigo.capital) - S().distancia(y, enemigo.capital))[0];
          // Como en WorldBox, se va a por las ciudades: la del enemigo (o su capital) más cercana a nuestra frontera.
          const plazas = [enemigo.capital, ...(m.ciudades || []).filter(x => x.civ === enemigo.id).map(x => x.region)];
          const cerca = plazas.map(r => [r, Math.min(...frente.map(f => S().distancia(f, r)))]).sort((p, q) => p[1] - q[1])[0];
          if (cerca && cerca[1] <= 5) obj = cerca[0];
          const nuestro = S().frontera(m, enemigo, c).sort((x, y) => S().distancia(x, obj) - S().distancia(y, obj))[0];
          e = { con: enemigo.id, obj, reunion: nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno, asedio: 0 };
          break;
        }
        // Sin frontera por tierra con ningún enemigo: la guerra va por mar (embarcar, cruzar y desembarcar).
        if (!e && p.defender == null) for (const g of c.guerras) {
          const enemigo = S().civ(m, g.con); if (!enemigo || !enemigo.viva) continue;
          const mar = planNaval(m, c, enemigo, null);
          if (mar) { e = { con: enemigo.id, obj: mar.obj, reunion: region(m, mar.puerto), fase: 'reunion', desde: m.turno, asedio: 0, mar }; break; }
        }
        // Sin frente con el enemigo, la orden «defended X» aún reúne al ejército en casa.
        if (!e && p.defender != null && m.dueno[p.defender] === c.id && c.guerras.length) e = { con: c.guerras[0].con, obj: p.defender, reunion: p.defender, fase: 'marcha', desde: m.turno, asedio: 0, defiende: p.defender };
        if (e) v.ejercitos[c.id] = e; else { delete v.ejercitos[c.id]; continue; }
      }
      // Si un ejército enemigo ataca una de nuestras regiones, vamos a defenderla: ahí se encuentran los dos.
      for (const g of c.guerras) {
        const ee = v.ejercitos[g.con];
        if (!mandado && ee && ee.con === c.id && m.dueno[ee.obj] === c.id && ee.fase === 'marcha' && e.fase === 'reunion') { e.defiende = ee.obj; e.fase = 'marcha'; }
      }
      if (p.defender != null) { if (m.dueno[p.defender] === c.id) { e.defiende = p.defender; e.fase = 'marcha'; } else p.defender = null; }
      if (e.defiende != null && m.dueno[e.defiende] !== c.id) e.defiende = null;
      e.capitan = suyos.length ? Math.min(...suyos.map(a => a.id)) : null;
      if (e.fase === 'marcha' && e.defiende == null) frente(m, c, e, suyos);
      if (e.fase === 'reunion' && e.mar) {
        // Por mar: el transporte espera en el puerto; cuando el ejército está reunido (o al cabo de unos turnos), embarca.
        let tr = v.barcos.find(b => b.tipo === 'transporte' && !b.colonia && b.c === c.id && !b.hundido && b.estado === 'espera');
        if (!tr) { tr = { id: v.sig++, tipo: 'transporte', c: c.id, puerto: e.mar.puerto, x: e.mar.de % v.tw, y: e.mar.de / v.tw | 0, ruta: e.mar.ruta, i: 0, vuelta: 0, r: [], pv: PV_BARCO.transporte, estado: 'espera', tierra: e.mar.tierra }; v.barcos.push(tr); }
        const base = centro(m, e.reunion);
        const cerca = suyos.filter(a => dist(m, a.y * v.tw + a.x, base) <= 7);
        if (cerca.length && (cerca.length >= Math.max(suyos.length * 0.7, Math.min(4, suyos.length)) || m.turno - e.desde >= 7)) {
          for (const a of cerca.slice(0, 24)) { a.aBordo = tr.id; a.x = tr.x; a.y = tr.y; a.e = ESPERAR; a.t = 2; }
          tr.estado = 'zarpa'; tr.ruta = e.mar.ruta; tr.i = 0; e.fase = 'travesia';
          if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⛵ ' + Math.min(24, cerca.length) + ' soldados embarcan hacia ' + S().civ(m, e.con).nombre, region: e.reunion });
        }
      } else if (e.fase === 'reunion') {
        const base = centro(m, e.reunion);
        const juntos = suyos.filter(a => dist(m, a.y * v.tw + a.x, base) <= 5).length;
        if (juntos >= suyos.length * 0.7 || m.turno - e.desde >= 5) { e.fase = 'marcha'; e.frente = base; e.esperaT = m.turno; for (const a of suyos) if (a.e === ESPERAR || a.paseo) a.e = LIBRE; }
      }
    }
  }

  /*
   * EL FRENTE: el ejército no va cada uno por su lado; avanza en bloque hacia el objetivo, unas casillas cada vez,
   * cuando casi todos han llegado. Si hay una torre o un castillo enemigo en pie, se para fuera de su alcance
   * (e.linea) hasta estar todos juntos y, si trae artillería o tanques, deja que la bombardeen antes de cargar.
   */
  // Hacia dónde mira un ejército: el eje (x o y) y el sentido hacia su objetivo, o hacia el enemigo que viene a por la
  // plaza que defiende. [sx, 0] mira por x; [0, sy] por y.
  function haciaEnemigo(m, c, e) {
    const v = m.vida, tw = v.tw;
    let de = e.frente != null ? e.frente : centro(m, e.reunion != null ? e.reunion : e.obj), a = centro(m, e.obj);
    if (e.defiende != null) {
      de = centro(m, e.defiende);
      const ee = c.guerras.map(g => v.ejercitos[g.con]).find(x => x && x.obj === e.defiende);
      a = ee ? (ee.frente != null ? ee.frente : centro(m, ee.reunion != null ? ee.reunion : ee.obj)) : de;
    }
    const dx = a % tw - de % tw, dy = (a / tw | 0) - (de / tw | 0);
    if (!dx && !dy) return [0, 1];
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  }
  function frente(m, c, e, suyos) {
    const v = m.vida, tw = v.tw, obj = centro(m, e.obj);
    if (e.frente == null) { e.frente = suyos.length ? suyos[0].y * tw + suyos[0].x : obj; e.esperaT = m.turno; }
    const enTierra = suyos.filter(a => a.aBordo == null);
    if (!enTierra.length) return;
    const fx = e.frente % tw, fy = e.frente / tw | 0, ox = obj % tw, oy = obj / tw | 0;
    // (El grupo del frente: los refuerzos que aún esperan en el punto de reunión no cuentan.)
    const activos = enTierra.filter(a => Math.abs(a.x - fx) + Math.abs(a.y - fy) <= 14), grupo = activos.length ? activos : enTierra;
    const juntos = grupo.filter(a => Math.abs(a.x - fx) + Math.abs(a.y - fy) <= 4).length / grupo.length;
    // Las torres enemigas cerca del camino: su alcance, más el ancho de la formación de margen.
    // (Las de la plaza y las que hay de camino: las torres de frontera que el ejército se encuentra al avanzar.)
    const fuertes = Object.keys(v.torres || {}).map(Number).filter(u => c.guerras.some(g => g.con === m.dueno[region(m, u)]) && (Math.abs(u % tw - ox) + Math.abs((u / tw | 0) - oy) <= 8 || Math.max(Math.abs(u % tw - fx), Math.abs((u / tw | 0) - fy)) <= 10));
    const alcance = u => (v.obra[u] === OBRA.castillo ? 6 : 4) + 3, lejosDe = (x, y) => fuertes.every(u => Math.max(Math.abs(u % tw - x), Math.abs((u / tw | 0) - y)) > alcance(u)); // (la torre tira en un cuadrado)
    const pesados = enTierra.some(a => a.veh);
    const espera = m.turno - (e.esperaT || m.turno);
    // Los refuerzos que van llegando esperan en el punto de reunión y salen hacia el frente en grupo (de tres o más):
    // de uno en uno, por tierra enemiga, las torres los van matando.
    if (e.reunion != null) {
      const rc = centro(m, e.reunion), rx = rc % tw, ry = rc / tw | 0;
      const enReunion = enTierra.filter(a => Math.abs(a.x - rx) + Math.abs(a.y - ry) <= 6 && Math.abs(a.x - fx) + Math.abs(a.y - fy) > 12).length;
      if (enReunion >= 3) e.ola = m.turno;
    }
    // La torre más cercana: el blanco de la artillería y los tanques mientras la infantería espera.
    e.blancoT = fuertes.length ? fuertes.sort((p, q) => Math.abs(p % tw - fx) + Math.abs((p / tw | 0) - fy) - Math.abs(q % tw - fx) - Math.abs((q / tw | 0) - fy))[0] : null;
    e.blancoR = e.blancoT != null ? (v.obra[e.blancoT] === OBRA.castillo ? 6 : 4) : 0;
    // Una carga que se queda sin gente (los refuerzos llegan de uno en uno) se repliega a la línea: nadie va solo contra la torre.
    if (e.carga && fuertes.length && e.lineaT != null && m.turno - (e.cargaT || 0) >= 3 && grupo.length < 4) {
      e.carga = false; e.linea = true; e.frente = e.lineaT; e.esperaT = m.turno;
      if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '↩ Quedan pocos soldados: se repliegan fuera del alcance de la torre a esperar refuerzos', region: e.obj });
      return;
    }
    // Cae la torre contra la que cargaban: siguen avanzando (y si hay otra en el camino, otra vez a la línea).
    if (e.carga && e.cargaContra != null && v.torres[e.cargaContra] == null) { e.carga = false; e.cargaContra = null; e.linea = false; e.esperaT = m.turno; }
    if (e.carga || (!fuertes.length && Math.abs(fx - ox) + Math.abs(fy - oy) <= 3)) { e.frente = e.carga && e.cargaContra != null ? e.cargaContra : obj; e.linea = false; return; }
    const d = Math.max(1, Math.abs(ox - fx) + Math.abs(oy - fy)), k = Math.min(4, d);
    const nx = Math.round(fx + (ox - fx) * k / d), ny = Math.round(fy + (oy - fy) * k / d);
    e.dir = Math.sign(oy - fy) || 1;
    // (Si el frente ya está a tiro de una torre, no esperan ahí a juntarse: primero, salir de su alcance.)
    const aTiro = fuertes.length && !lejosDe(fx, fy);
    if (!aTiro && juntos < 0.65 && espera < 6) return;
    // Un paso de cuatro casillas hacia el objetivo (sin meterse en el agua).
    if (fuertes.length && (aTiro || !lejosDe(nx, ny))) {
      // En la línea, fuera de su alcance: esperan a estar todos y, con artillería o tanques, a que la bombardeen.
      if (!e.linea || aTiro) {
        // Si ya están a tiro (el punto de reunión queda cerca de la torre), la línea retrocede hasta salir de su alcance.
        if (!lejosDe(fx, fy)) {
          const ter = terrenos(m);
          // (La casilla segura más cercana, en tierra; entre las de igual distancia, la más lejos del objetivo.)
          let mejor = -1, md = 1e9;
          for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) {
            const bx = fx + dx, by = fy + dy, bt = by * tw + bx;
            if (bx < 0 || by < 0 || bx >= tw || by >= v.th || ter[bt] === 'agua' || ter[bt] === 'bajo' || ter[bt] === 'montana' || !lejosDe(bx, by)) continue;
            const dd = Math.abs(dx) + Math.abs(dy) - (Math.abs(bx - ox) + Math.abs(by - oy)) * 0.01;
            if (dd < md) { md = dd; mejor = bt; }
          }
          if (mejor >= 0) e.frente = mejor;
          // (Sin ningún sitio a salvo cerca, esperar debajo es lo peor: si son bastantes, al asalto ya.)
          else if (grupo.length >= 4) { e.carga = true; e.cargaT = m.turno; e.linea = false; e.cargaContra = e.blancoT; e.frente = e.blancoT; return; }
        }
        const nueva = !e.linea; e.linea = true; e.lineaT = e.frente; if (!nueva) return; e.esperaT = m.turno; if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🛡 El ejército se para fuera del alcance de la torre enemiga y se agrupa' + (pesados ? '; la artillería la bombardea' : '') + (c.era >= 8 ? ' (cavan trincheras)' : ''), region: e.obj }); return; }
      const lista = juntos >= 0.8 && (!pesados || espera >= 6);
      if (grupo.length >= 4 && (lista || espera >= 12)) { e.carga = true; e.cargaT = m.turno; e.linea = false; e.cargaContra = e.blancoT; e.frente = e.blancoT != null ? e.blancoT : obj; if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚔ ¡Al asalto! El ejército carga todo junto contra la torre', region: e.obj }); }
      return;
    }
    const nt = ny * tw + nx, ter = terrenos(m)[nt];
    e.frente = ter === 'agua' || ter === 'bajo' ? obj : nt; e.esperaT = m.turno; e.linea = false;
  }
