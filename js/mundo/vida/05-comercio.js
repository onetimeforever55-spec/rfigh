  // ── GÉNESIS · LA VIDA · El comercio de los mercaderes y las sedes de los bancos ──

  function comercio(m, c, impuesto) {
    const v = m.vida, mercs = mercaderesDe(m, c), porId = new Map(mercs.map(a => [a.id, a]));
    // Con plaza pública hay mercado: los tratos rinden un 10 % más. (El banco no da premio: solo trae la banca y el crédito.)
    // Lo de fuera solo se gana con reinos con los que se comercia de verdad (para el jugador, los que él abrió):
    // el comercio de dentro da el 60 %; el de fuera, el resto (entero con dos socios o más).
    const fuera = 0.6 + 0.4 * Math.min(1, sociosDe(m, c).length / 2);
    const mejor = (c.fuentes > 0 ? 1.1 : 1) * fuera;
    const enGremio = new Map(mercs.map(a => [a.id, 0]));
    for (const a of v.aldeanos) {
      if (a.c !== c.id || a.o !== COMERCIANTE || a.emp || a.merc) continue;
      const jefe = a.gremio != null ? porId.get(a.gremio) : null;
      if (jefe && jefe.merc.t != null && v.obra[jefe.merc.t] === OBRA.gremio) {
        // En el gremio: el trato lo cobra el mercader; el comerciante, su sueldo.
        const bruto = (0.45 + 0.09 * c.era) * mejor, sueldo = 0.15 + 0.03 * c.era, imp = bruto * impuesto;
        a.dinero = redondo((a.dinero || 0) + sueldo); jefe.merc.caja = redondo(jefe.merc.caja + bruto - sueldo - imp); c.oro = (c.oro || 0) + imp;
        enGremio.set(jefe.id, enGremio.get(jefe.id) + 1);
      } else {
        if (a.gremio != null && !jefe) delete a.gremio;
        // Por su cuenta (el comercio de siempre, para el reino): una pequeña comisión de cada trato.
        a.dinero = redondo((a.dinero || 0) + (0.2 + 0.05 * c.era) * mejor * (1 - impuesto));
      }
    }
    // Cada familia tiene una sola casa comercial en el reino: el jefe es el de la casa principal (o el más antiguo);
    // los demás gremios de la familia son sus sucursales (así también al heredar, o si una ciudad cambia de reino).
    const jefeCasa = new Map();
    for (const a of S().ordenarPor(mercs.slice(), x => (x.merc.de == null ? 0 : 1e13) + (x.merc.desde || 0) * 1e7 + x.id)) if (a.familia && !jefeCasa.has(a.familia)) jefeCasa.set(a.familia, a);
    for (const a of mercs) {
      const mc = a.merc;
      // El mercader también comercia; y si su gremio se perdió (lo tiraron o se quemó), puede fundar otro.
      const g = (0.4 + 0.08 * c.era) * mejor, imp = g * impuesto;
      mc.caja = redondo(mc.caja + g - imp); c.oro = (c.oro || 0) + imp;
      // Una sucursal manda lo que gana a la caja del jefe de la familia; si la casa ya no está, va por su cuenta.
      const jefe = a.familia ? jefeCasa.get(a.familia) : null;
      if (jefe && jefe !== a) { mc.de = jefe.id; jefe.merc.caja = redondo(jefe.merc.caja + mc.caja); mc.caja = 0; } else delete mc.de;
      // El letrero dice de quién es (y si es sucursal), aunque haya cambiado de manos.
      const pv = mc.t != null && v.privados && v.privados[mc.t];
      if (pv && (pv.dueno !== a.id || !pv.sucursal !== (mc.de == null))) { pv.dueno = a.id; if (mc.de != null) pv.sucursal = 1; else delete pv.sucursal; nombrarPrivado(m, mc.t, c); }
      if (mc.t != null && v.obra[mc.t] !== OBRA.gremio && !(v.andamios && v.andamios[mc.t]) && !((c.plan && c.plan.encargos) || []).some(x => x.t === mc.t)) mc.t = null;
      if (mc.casona != null && v.obra[mc.casona] === OBRA.casona && a.casa !== mc.casona) a.casa = mc.casona;
      if (a.o !== COMERCIANTE) mover(a, COMERCIANTE);
    }
    // Los comerciantes sin gremio entran en uno con plazas libres.
    if (m.turno % 3 === c.id % 3) for (const a of v.aldeanos) {
      if (a.c !== c.id || a.o !== COMERCIANTE || a.emp || a.merc || (a.gremio != null && porId.has(a.gremio))) continue;
      const jefe = mercs.find(x => x.merc.t != null && v.obra[x.merc.t] === OBRA.gremio && enGremio.get(x.id) < PLAZAS_GREMIO);
      if (!jefe) break;
      a.gremio = jefe.id; enGremio.set(jefe.id, enGremio.get(jefe.id) + 1);
    }
    if (c.era < 4 || m.turno % 8 !== c.id % 8) return;
    // Una familia con más gremios de la cuenta (por conquistas o herencias) vende su sucursal más nueva a un comerciante de ella.
    for (const [fam, jefe] of jefeCasa) {
      const suyas = mercs.filter(x => x.familia === fam && x.merc);
      if (suyas.length <= SUCURSALES + 1) continue;
      const ultima = S().ordenarPor(suyas.filter(x => x !== jefe), x => -((x.merc.desde || 0) * 1e7 + x.id))[0];
      const llenaF = f => f && mercs.filter(y => y.merc && y.familia === f).length >= SUCURSALES + 1;
      // (Primero a uno de sus comerciantes; si no, a cualquier comerciante del reino de otra familia.)
      const compra = x => x.c === c.id && x.o === COMERCIANTE && !x.merc && !x.emp && !esNino(x) && x.familia !== fam && !llenaF(x.familia), mejorDe = l => l.sort((x, y) => (y.dinero || 0) - (x.dinero || 0) || x.id - y.id)[0];
      const nuevo = ultima && (mejorDe(v.aldeanos.filter(x => x.gremio === ultima.id && compra(x))) || mejorDe(v.aldeanos.filter(compra)));
      if (!nuevo) continue;
      const mc = ultima.merc; delete ultima.merc; delete mc.de; nuevo.merc = mc; delete nuevo.gremio; mover(nuevo, COMERCIANTE); soltarMuelleSiSobra(m, c, nuevo, mc);
      for (const x of v.aldeanos) if (x.gremio === ultima.id) x.gremio = nuevo.id;
      ultima.gremio = nuevo.id; mercs.splice(mercs.indexOf(ultima), 1, nuevo);
      if (mc.t != null && v.privados && v.privados[mc.t]) { v.privados[mc.t].dueno = nuevo.id; delete v.privados[mc.t].sucursal; nombrarPrivado(m, mc.t, c); }
      anunciar(m, c, '🏪 La casa comercial ' + fam + ' tiene demasiados gremios: ' + nombreDe(nuevo) + ' se queda con la sucursal de ' + nombreDe(ultima));
      break;
    }
    // UN MERCADER NUEVO: el comerciante que más ha juntado funda su gremio (uno por ciudad como mucho). Si su familia
    // ya tiene una casa comercial, abre una sucursal de esa casa (hasta SUCURSALES por familia), no un gremio aparte.
    const ciudades = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    // Cada gremio es de la ciudad más cercana (aunque se levantara en una comarca de al lado, si el centro estaba lleno).
    const ciudadDe = t => { if (v.gremioCiudad && ciudades.includes(v.gremioCiudad[t])) return v.gremioCiudad[t]; const r = region(m, t), x = r % m.W, y = Math.floor(r / m.W); let mejor = ciudades[0], md = 1e9; for (const q of ciudades) { const d = Math.max(Math.abs(q % m.W - x), Math.abs(Math.floor(q / m.W) - y)); if (d < md) { md = d; mejor = q; } } return mejor; };
    const suyos = new Set(mercs.filter(x => x.merc.t != null).map(x => x.merc.t));
    const conGremio = new Set([...suyos].map(ciudadDe));
    // Los gremios vacíos (de quien murió sin nadie que siguiera): se venden antes de levantar otro.
    const vacios = Object.keys(v.edificios || {}).map(Number).filter(t => v.obra[t] === OBRA.gremio && !suyos.has(t) && m.dueno[region(m, t)] === c.id && !(v.privados && v.privados[t]));
    const huerfano = vacios.find(t => !conGremio.has(ciudadDe(t)));
    const libres = ciudades.filter(r => !conGremio.has(r) && !vacios.some(t => ciudadDe(t) === r));
    // Un gremio vacío en una ciudad que ya tiene el suyo sobra: el reino lo convierte en viviendas.
    // (Y si en una ciudad sin gremio activo quedan dos vacíos, sobra el segundo.)
    const sobra = vacios.find(t => conGremio.has(ciudadDe(t))) ?? vacios.find((t, i) => vacios.findIndex(q => ciudadDe(q) === ciudadDe(t)) < i);
    if (sobra != null) cambiar(m, 'obra', sobra, OBRA.casa, 0);
    if (libres.length || huerfano != null) {
      // (Aunque sea mayor: al morir, el gremio pasa a su heredero.)
      const casa = a => mercs.find(x => a.familia && x.familia === a.familia && x.merc.de == null);
      const llena = a => a.familia && mercs.filter(x => x.familia === a.familia).length > SUCURSALES;
      const cand = v.aldeanos.filter(a => a.c === c.id && a.o === COMERCIANTE && !a.emp && !a.merc && !esNino(a) && (a.dinero || 0) >= precioObra(m, 'gremio') && !llena(a)).sort((x, y) => (y.dinero || 0) - (x.dinero || 0) || x.id - y.id)[0];
      // En la primera ciudad sin gremio que tenga sitio.
      let t = null, ciudadPedida = null;
      if (cand && huerfano != null) {
        // Compra el gremio vacío al reino, a mitad de precio: no hay que levantar nada.
        const precio = Math.round(precioObra(m, 'gremio') * 5) / 10, jefe = casa(cand);
        cand.dinero -= precio; c.oro = (c.oro || 0) + precio;
        (v.privados = v.privados || {})[huerfano] = { dueno: cand.id, civ: c.id, tipo: 'gremio' }; (v.gremioCiudad = v.gremioCiudad || {})[huerfano] = ciudadDe(huerfano);
        cand.merc = { t: huerfano, caja: 0, desde: m.turno }; delete cand.gremio; mover(cand, COMERCIANTE);
        if (jefe) { cand.merc.de = jefe.id; v.privados[huerfano].sucursal = 1; }
        nombrarPrivado(m, huerfano, c);
        anunciar(m, c, '🏪 ' + nombreDe(cand) + ' compra al reino un gremio vacío' + (jefe ? ' para la casa comercial ' + cand.familia : '') + ' (paga ' + Math.round(precio) + ' de oro)');
      }
      else if (cand) for (const r of libres) { t = sitioPara(m, c, 'gremio', [r]); if (t != null) { ciudadPedida = r; break; } }
      if (cand && t != null && !cand.merc) {
        const pagado = encargarPrivado(m, c, cand, 'gremio', t, 'gremio');
        if (pagado) {
          (v.gremioCiudad = v.gremioCiudad || {})[t] = ciudadPedida;
          const jefe = casa(cand);
          cand.merc = { t, caja: 0, desde: m.turno }; delete cand.gremio; mover(cand, COMERCIANTE);
          if (jefe) {
            cand.merc.de = jefe.id; v.privados[t].sucursal = 1;
            anunciar(m, c, '🏪 ' + nombreDe(cand) + ' abre una sucursal de la casa comercial ' + cand.familia + ' (paga ' + Math.round(pagado) + ' de oro al reino por la obra; lo que gane irá a ' + nombreDe(jefe) + ', el jefe de la familia)');
          }
          else anunciar(m, c, '🏪 ' + nombreDe(cand) + ' funda un gremio de mercaderes con su dinero (paga ' + Math.round(pagado) + ' de oro al reino por la obra)');
        }
      }
    }
    // EL MUELLE: la casa comercial (su jefe) se hace un muelle con su barco mercante, uno por familia como mucho. Si hay
    // uno vacío, lo compra a mitad de precio; si no, lo levanta en la costa (materiales y obra se los paga al reino).
    if (c.era >= ERA_OBRA[OBRA.muelle]) for (const jefe of jefeCasa.values()) {
      const fam = jefe.familia, mc = jefe.merc;
      const tiene = mercs.some(x => x.familia === fam && x.merc.muelle != null && (v.obra[x.merc.muelle] === OBRA.muelle || ((c.plan && c.plan.encargos) || []).some(e => e.t === x.merc.muelle)))
        || Object.keys(v.privados || {}).some(t => { const p = v.privados[t]; if (p.tipo !== 'muelle' || p.civ !== c.id) return false; const d = v.aldeanos.find(x => x.id === p.dueno); return d && d.familia === fam; });
      if (tiene) continue;
      delete mc.muelle;
      const precio = precioObra(m, 'muelle');
      const vacio = Object.keys(v.edificios || {}).map(Number).find(t => v.obra[t] === OBRA.muelle && m.dueno[region(m, t)] === c.id && !(v.privados && v.privados[t]));
      if (vacio != null && mc.caja >= precio / 2 + 10) {
        mc.caja = redondo(mc.caja - precio / 2); c.oro = (c.oro || 0) + precio / 2; mc.muelle = vacio;
        (v.privados = v.privados || {})[vacio] = { dueno: jefe.id, civ: c.id, tipo: 'muelle' }; nombrarPrivado(m, vacio, c);
        anunciar(m, c, '⚓ La casa comercial ' + fam + ' compra al reino un muelle vacío, con su barco (paga ' + Math.round(precio / 2) + ' de oro)');
        break;
      }
      if (mc.caja < precio + 15) continue;
      const t = sitioPara(m, c, 'muelle', mc.t != null ? [region(m, mc.t)] : undefined) ?? sitioPara(m, c, 'muelle');
      if (t == null) continue;
      jefe.dinero = (jefe.dinero || 0) + mc.caja; mc.caja = 0;
      const pagado = encargarPrivado(m, c, jefe, 'muelle', t, 'muelle');
      mc.caja = jefe.dinero; jefe.dinero = 0;
      if (pagado) { mc.muelle = t; anunciar(m, c, '⚓ La casa comercial ' + fam + ' levanta su muelle, con su propio barco mercante (paga ' + Math.round(pagado) + ' de oro al reino por la obra)'); }
      break;
    }
    // LA CASONA: el mercader que ha ganado lo bastante se hace una casa grande (le compra al reino los materiales).
    for (const a of mercs) {
      const mc = a.merc;
      if (mc.casona != null || mc.caja < precioObra(m, 'casona') + 10) continue;
      // Si hay una casona vacía (su dueño murió sin familia), la compra a mitad de precio en vez de levantar otra.
      const usadas = new Set(mercs.map(x => x.merc.casona).filter(x => x != null));
      const vacia = Object.keys(v.edificios || {}).map(Number).find(t => v.obra[t] === OBRA.casona && !usadas.has(t) && m.dueno[region(m, t)] === c.id && !(v.privados && v.privados[t]));
      if (vacia != null) {
        const precio = Math.round(precioObra(m, 'casona') * 5) / 10;
        mc.caja -= precio; c.oro = (c.oro || 0) + precio; mc.casona = vacia;
        (v.privados = v.privados || {})[vacia] = { dueno: a.id, civ: c.id, tipo: 'casona' };
        nombrarPrivado(m, vacia, c);
        anunciar(m, c, '🏠 ' + nombreDe(a) + ' compra ' + (c.era >= 6 ? 'una mansión vacía' : c.era >= 5 ? 'un palacete vacío' : 'una casona vacía') + ' (paga ' + Math.round(precio) + ' de oro al reino)');
        break;
      }
      const t = sitioPara(m, c, 'casona', mc.t != null ? [region(m, mc.t)] : undefined);
      if (t == null) continue;
      a.dinero = (a.dinero || 0) + mc.caja; mc.caja = 0;
      const pagado = encargarPrivado(m, c, a, 'casona', t, 'casona');
      mc.caja = a.dinero; a.dinero = 0;
      if (pagado) { mc.casona = t; anunciar(m, c, '🏠 ' + nombreDe(a) + ' se hace ' + (c.era >= 6 ? 'una mansión' : c.era >= 5 ? 'un palacete' : 'una casona') + ' (paga ' + Math.round(pagado) + ' de oro al reino por la obra)'); }
      break;
    }
  }
  // EL BANCO DEL BANQUERO: un edificio privado (no el banco central del reino). Si hay uno vacío (su dueño quebró o
  // murió sin nadie), lo compra a mitad de precio; si no, lo levanta: le paga al reino materiales y obra con su capital.
  function sedeBanco(m, c, ban) {
    const v = m.vida, e = ban.emp;
    if (!e || e.neg !== 'banco') return;
    if (e.sede != null && (v.obra[e.sede] === OBRA.bancopriv || (v.andamios && v.andamios[e.sede]) || ((c.plan && c.plan.encargos) || []).some(x => x.t === e.sede))) return;
    delete e.sede;
    const precio = precioObra(m, 'bancopriv');
    const vacio = Object.keys(v.edificios || {}).map(Number).find(t => v.obra[t] === OBRA.bancopriv && m.dueno[region(m, t)] === c.id && !(v.privados && v.privados[t]));
    if (vacio != null && e.capital >= precio / 2 + 5) {
      e.capital = redondo(e.capital - precio / 2); c.oro = (c.oro || 0) + precio / 2; e.sede = vacio;
      (v.privados = v.privados || {})[vacio] = { dueno: ban.id, civ: c.id, tipo: 'banco' }; nombrarPrivado(m, vacio, c);
      anunciar(m, c, '🏦 ' + nombreDe(ban) + ' compra al reino un banco vacío (paga ' + Math.round(precio / 2) + ' de oro)');
      return;
    }
    if (e.capital < precio + 10) return;
    const t = sitioPara(m, c, 'bancopriv', ban.merc && ban.merc.t != null ? [region(m, ban.merc.t)] : undefined);
    if (t == null) return;
    ban.dinero = (ban.dinero || 0) + e.capital; e.capital = 0;
    const pagado = encargarPrivado(m, c, ban, 'bancopriv', t, 'banco');
    e.capital = ban.dinero; ban.dinero = 0;
    if (pagado) { e.sede = t; anunciar(m, c, '🏦 ' + nombreDe(ban) + ' levanta su banco (paga ' + Math.round(pagado) + ' de oro al reino por la obra)'); }
  }
  // EL QUE YA ES RICO monta su negocio con lo suyo (sin préstamo: el préstamo es para los que no llegan). Desde la
  // Revolución Industrial, quien tiene ahorrado todo lo que cuesta una fábrica (o una mina) la levanta: le paga la obra
  // al reino y se queda el resto para empezar. No debe nada a nadie. Valen el 4 % y el tope de fábricas.
  function montarConLoSuyo(m, c) {
    const v = m.vida, monto = 20 + 4 * c.era, obra = Math.round(monto * 0.7);
    const adultos = v.aldeanos.filter(a => a.c === c.id && !esNino(a)).length;
    const conNegocio = v.aldeanos.filter(a => a.c === c.id && a.emp).length;
    if (conNegocio >= Math.max(1, Math.floor(adultos * 0.04))) return;
    const privadas = Object.values(v.privados || {}).filter(p => p.civ === c.id && p.tipo === 'fabrica').length;
    if (privadas >= 1 + Math.floor((c.aldeanos || 0) / 60)) return;
    const rico = S().ordenarPor(v.aldeanos.filter(a => a.c === c.id && !a.emp && !a.merc && a.obrero == null && !esNino(a) && (a.edad || 0) <= VIEJO - 3 && a.o !== GUERRERO && !a.fijo && a.colono == null && a.aBordo == null && (a.dinero || 0) >= monto), x => -(x.dinero || 0) * 1000 + x.id)[0];
    if (!rico) return;
    let ind = elegirIndustria(m, c), t = sitioIndustria(m, c, ind);
    if (t == null && (ind === 'minera' || ind === 'ferrocarril' || ind === 'inmobiliaria')) { ind = 'aserradero'; t = sitioFabrica(m, c); }
    if (t == null) return;
    (v.privados = v.privados || {})[t] = { dueno: rico.id, civ: c.id, tipo: 'fabrica', ind };
    const p = c.plan = c.plan || {}; (p.encargos = p.encargos || []).push({ t, o: obraIndustria(ind), clave: claveIndustria(ind), privado: rico.id });
    c.oro = (c.oro || 0) + obra;
    rico.emp = { neg: 'fabrica', t, ind, monto: 0, deuda: 0, cuota: 0, caja: redondo((rico.dinero || 0) - obra), banquero: null, desde: m.turno, atraso: 0, propio: true };
    rico.dinero = 0; mover(rico, COMERCIANTE);
    anunciar(m, c, (ind === 'ferrocarril' ? '🚂 ' : '🏭 ') + nombreDe(rico) + ' monta ' + (QUE_MONTA[ind] || 'una fábrica') + ' con su propio dinero, sin préstamo (paga ' + obra + ' de oro al reino por la obra)');
  }
