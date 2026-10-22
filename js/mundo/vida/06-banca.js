  // ── GÉNESIS · LA VIDA · El ministro de economía, la banca y el mercado mundial ──

  /*
   * EL MINISTRO DE ECONOMÍA (con el banco central): un erudito que trabaja en el banco y, cada pocos turnos, encarga lo que
   * le falta al reino y pone a la venta lo que le sobra (son pedidos y ventas como los del jugador, marcados como
   * suyos: los llevan las carretas y los barcos a los socios). Cuánto quiere de cada cosa depende del modo:
   *  · equilibrio: lo normal; · crecimiento: madera, piedra y comida para crecer, y vende armas y máquinas de más;
   *  · guerra: armas, metal, máquinas, granadas, petróleo y comida de reserva, y vende muebles y madera de más;
   *  · ahorro: solo compra lo imprescindible, vende lo que sobra y guarda más oro.
   */
  const MODOS_ECO = {
    equilibrio: { nombre: 'equilibrio', peso: {}, guarda: 0.3 },
    crecimiento: { nombre: 'crecimiento', peso: { madera: 1.5, piedra: 1.5, comida: 1.3, metal: 1.1, armas: 0.6, vehiculos: 0.4, granadas: 0.4, muebles: 0.8 }, guarda: 0.2 },
    guerra: { nombre: 'economía de guerra', peso: { armas: 2, metal: 1.6, vehiculos: 2, granadas: 2, petroleo: 1.6, comida: 1.4, carbon: 1.3, madera: 0.8, muebles: 0.4 }, guarda: 0.15 },
    ahorro: { nombre: 'ahorro', peso: { madera: 0.9, piedra: 0.9, metal: 0.9, armas: 0.8, muebles: 0.6, vehiculos: 0.6, granadas: 0.6 }, guarda: 0.6, compraBajo: 0.5, vendeSobre: 1.3 }
  };
  const BIENES_MINISTRO = ['comida', 'madera', 'piedra', 'metal', 'armas', 'carbon', 'petroleo', 'muebles', 'vehiculos', 'granadas'];
  function ministroEconomia(m, c) {
    const v = m.vida, eco = c.plan.economia, M_ = MODOS_ECO[eco.modo] || MODOS_ECO.equilibrio;
    // Sin banco central no hay ministerio; si el ministro murió o se fue, entra otro.
    let min = v.aldeanos.find(a => a.id === eco.ministro && a.c === c.id);
    if (!(c.bancos > 0)) { if (min) delete min.ministro; return; }
    if (!min) {
      const otro = S().ordenarPor(v.aldeanos.filter(a => a.c === c.id && !esNino(a) && (a.edad || 0) <= VIEJO - 3 && !a.emp && !a.merc && a.obrero == null && a.colono == null && a.o !== GUERRERO), a => (a.o === ERUDITO ? 0 : 1000) + (a.edad || 0) + a.id / 1e6)[0];
      if (!otro) return;
      const antes = eco.ministro != null; eco.ministro = otro.id; otro.ministro = 1; mover(otro, ERUDITO);
      if (antes) anunciar(m, c, '🏛 ' + nombreDe(otro) + ' es el nuevo ministro de economía (' + M_.nombre + ')');
      min = otro;
    }
    min.ministro = 1;
    if (!sociosDe(m, c).length) { if (!(eco.avisoSinSocios > m.turno - 40)) { eco.avisoSinSocios = m.turno; anunciar(m, c, '🏛 El ministro ' + nombreDe(min) + ' no tiene con quién comerciar: abrid una ruta comercial'); } return; }
    const p = c.plan, mk = m.mercado; if (!mk) return;
    p.pedidos = (p.pedidos || []).filter(x => !(x.ministro && m.turno - x.desde > 24));
    p.ventas = (p.ventas || []).filter(x => !(x.ministro && m.turno - x.desde > 24));
    // El oro que puede gastar: lo que pasa de su reserva (más alta en modo ahorro).
    let presupuesto = Math.max(0, (c.oro || 0) - Math.max(15, (c.oro || 0) * M_.guarda) - p.pedidos.filter(x => x.ministro).reduce((q, x) => q + x.n * (mk.precio[x.que] || 1), 0));
    const hechos = [];
    // Primero lo que más falta (por lo que le cuesta al reino no tenerlo).
    const falta = k => { const meta = objetivo(c, k) * (M_.peso[k] || 1); return meta > 0 ? 1 - (c[k] || 0) / meta : 0; };
    for (const k of S().ordenarPor(BIENES_MINISTRO.slice(), k => -falta(k))) {
      if ((k === 'carbon' && c.era < 6) || (k === 'petroleo' && c.era < 7) || (k === 'vehiculos' && c.era < 5) || (k === 'granadas' && c.era < 8)) continue;
      const meta = objetivo(c, k) * (M_.peso[k] || 1), tiene = c[k] || 0, precio = mk.precio[k] || PRECIO_BASE[k] || 1;
      if (meta <= 0) continue;
      const ped = p.pedidos.filter(x => x.que === k).reduce((q, x) => q + x.n, 0), ven = p.ventas.filter(x => x.que === k).reduce((q, x) => q + x.n, 0);
      // (Un pedido y una venta por cosa: si ya tiene uno suyo, lo pone al día en vez de añadir otro.)
      const suyoP = p.pedidos.find(x => x.ministro && x.que === k), suyoV = p.ventas.find(x => x.ministro && x.que === k);
      const pedOtros = ped - (suyoP ? suyoP.n : 0), venOtros = ven - (suyoV ? suyoV.n : 0);
      if (tiene + pedOtros < meta * (M_.compraBajo || 0.7)) {
        const n = Math.min(Math.ceil(meta - tiene - pedOtros), Math.floor((presupuesto + (suyoP ? suyoP.n * precio : 0)) / precio));
        if (suyoV) p.ventas = p.ventas.filter(x => x !== suyoV);
        if (n >= 1) { if (suyoP) { presupuesto -= (n - suyoP.n) * precio; suyoP.n = n; } else { p.pedidos.push({ que: k, n, desde: m.turno, ministro: 1 }); presupuesto -= n * precio; } hechos.push('compra ' + n + ' de ' + (NOMBRE_BIEN[k] || k)); }
      } else if (tiene - venOtros > meta * (M_.vendeSobre || 1.6) && !pedOtros) {
        const n = Math.floor(tiene - venOtros - meta * 1.2);
        if (suyoP) p.pedidos = p.pedidos.filter(x => x !== suyoP);
        if (n >= 2) { if (suyoV) suyoV.n = n; else p.ventas.push({ que: k, n, desde: m.turno, ministro: 1 }); hechos.push('vende ' + n + ' de ' + (NOMBRE_BIEN[k] || k)); }
      } else {
        // Ya está bien de eso: se retira lo que tenía puesto.
        if (suyoP && tiene >= meta) p.pedidos = p.pedidos.filter(x => x !== suyoP);
        if (suyoV && tiene <= meta * 1.2) p.ventas = p.ventas.filter(x => x !== suyoV);
      }
    }
    eco.ultimo = { turno: m.turno, hechos };
    if (hechos.length && !(eco.avisoUltimo > m.turno - 12)) { eco.avisoUltimo = m.turno; anunciar(m, c, '🏛 El ministro ' + nombreDe(min) + ' (' + M_.nombre + '): ' + hechos.slice(0, 3).join(', ')); }
  }
  function banca(m, c) {
    const v = m.vida;
    // (Dónde está su banco central: allí trabaja el ministro de economía.)
    if (c.bancoT == null || v.obra[c.bancoT] !== OBRA.banco || m.dueno[region(m, c.bancoT)] !== c.id) { c.bancoT = null; if (c.bancos > 0) for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.banco && m.dueno[region(m, t)] === c.id) { c.bancoT = t; break; } }
    // Los negocios privados de quien ya no está (murió, se fue o el reino perdió la tierra) pasan al reino.
    if (v.privados) for (const t of Object.keys(v.privados)) { const p = v.privados[t], a = v.aldeanos.find(x => x.id === p.dueno); if (p.civ === c.id && (!a || (p.tipo === 'gremio' || p.tipo === 'muelle' ? !a.merc : p.tipo === 'casona' ? false : !a.emp) || a.c !== c.id || m.dueno[region(m, +t)] !== c.id)) olvidarPrivado(m, c, +t); }
    // Un muelle por familia, pase lo que pase (herencias, relevos, ventas): si una familia acaba con dos, se queda el primero
    // y los demás quedan vacíos para que los compre otra casa.
    if (v.privados) {
      const visto = new Set();
      for (const t of Object.keys(v.privados).map(Number).sort((p, q) => p - q)) {
        const p = v.privados[t]; if (p.tipo !== 'muelle' || p.civ !== c.id) continue;
        const a = v.aldeanos.find(x => x.id === p.dueno), k = a && (a.familia || 'id' + a.id);
        if (!k) continue;
        if (visto.has(k)) { olvidarPrivado(m, c, t); if (a.merc && a.merc.muelle === t) delete a.merc.muelle; } else { visto.add(k); if (a.merc) a.merc.muelle = t; }
      }
    }
    const impuesto = Math.min(0.6, 0.25 * ((c.plan && c.plan.impuesto) || 1));
    comercio(m, c, impuesto);
    // Los sueldos de la gente (con banco o sin él), y lo que quiere gastar: se lo compra a las fábricas privadas.
    const pueblo = pausada(m) && c.era >= ERA_SUELDO ? sueldos(m, c, impuesto) : null;
    if (pueblo) pueblo.fabricas = empresariosDe(m, c).filter(a => a.emp.neg === 'fabrica' && a.emp.ind !== 'minera' && v.obra[a.emp.t] === OBRA.fabrica).length;
    // LOS NEGOCIOS (con banco o sin él: el que montó su fábrica con su dinero no depende del banco).
    const negocios = (b, nivel) => {
      // LOS EMPRESARIOS: su negocio les da; pagan impuestos y devuelven a su banquero (o al central).
      // Venden dentro (el 60 %) y fuera, pero solo a los reinos con los que se comercia (para el jugador, los que él abrió):
      // así decides si tu industria privada beneficia o no a otro reino.
      const sociosFab = sociosDe(m, c), fueraE = 0.6 + 0.4 * Math.min(1, sociosFab.length / 2);
      for (const a of empresariosDe(m, c)) {
        const e = a.emp; if (e.neg === 'banco') continue;
        let bruto = 0;
        if (e.neg === 'fabrica') {
          // Mientras se levanta no da nada; si la tiraron o se perdió, el negocio se acaba.
          const encargada = e.t != null && ((c.plan && c.plan.encargos) || []).some(x => x.t === e.t);
          // (Si su obra lleva 60 turnos encargada y nadie la ha empezado —un solar al que los constructores no llegan—,
          // el dueño la cambia de sitio.)
          if (encargada && !(v.andamios && v.andamios[e.t]) && !v.obra[e.t]) {
            e.esperaObra = (e.esperaObra || 0) + 1;
            if (e.esperaObra > 60) {
              const viejo = e.t, pv = v.privados && v.privados[viejo];
              delete v.privados[viejo]; c.plan.encargos = c.plan.encargos.filter(x => x.t !== viejo);
              let nuevo = sitioIndustria(m, c, e.ind);
              e.esperaObra = 0;
              // (Si vuelve a salir el mismo sitio —la montaña más cercana, para una mina—, monta otra industria en un solar normal.)
              if ((nuevo == null || nuevo === viejo) && e.ind !== 'aserradero') { nuevo = sitioFabrica(m, c); if (nuevo != null) { e.ind = 'aserradero'; if (pv) pv.ind = 'aserradero'; } }
              if (nuevo != null && nuevo !== viejo) {
                v.privados[nuevo] = pv || { dueno: a.id, civ: c.id, tipo: 'fabrica', ind: e.ind }; v.privados[nuevo].dueno = a.id;
                c.plan.encargos.push({ t: nuevo, o: obraIndustria(e.ind), clave: claveIndustria(e.ind), privado: a.id }); e.t = nuevo;
              } else { v.privados[viejo] = pv; c.plan.encargos.push({ t: viejo, o: obraIndustria(e.ind), clave: claveIndustria(e.ind), privado: a.id }); }
              continue;
            }
          } else e.esperaObra = 0;
          if (e.t == null || (!encargada && !(v.andamios && v.andamios[e.t]) && !ES_INDUSTRIA.has(v.obra[e.t]))) { quiebra(m, c, a, e.ind === 'minera' ? 'perdió su mina' : 'perdió su fábrica'); continue; }
          if (ES_INDUSTRIA.has(v.obra[e.t])) {
            // (Ya no cobra del tesoro: gana lo que vende menos lo que paga; paga impuestos solo sobre lo que gana.)
            const neto = industria(m, c, a, e, sociosFab, pueblo), imp = Math.max(0, neto) * impuesto;
            c.oro = (c.oro || 0) + imp; e.caja = redondo(e.caja + neto - imp); e.impuestos = (e.impuestos || 0) + imp;
            if (e.caja < -30 && !(e.deuda > 0)) { quiebra(m, c, a, 'perdía dinero'); continue; }
          }
        } else bruto = (1 + c.era * 0.25) * fueraE;
        // Un mal año para el negocio, de vez en cuando (más si el dinero fue barato); no antes de abrir.
        if (bruto > 0 && azar(v) < (nivel <= 0.5 ? 0.03 : 0.012)) e.caja -= 6 + c.era;
        const imp = bruto * impuesto;
        c.oro = (c.oro || 0) + imp; e.caja += bruto - imp; e.impuestos = (e.impuestos || 0) + imp;
        // (Mientras la fábrica se levanta, el préstamo espera: se empieza a pagar cuando produce.)
        if (e.deuda > 0 && !(e.neg === 'fabrica' && !ES_INDUSTRIA.has(v.obra[e.t]))) {
          // (Si no llega a la cuota entera, paga lo que tiene; solo es un retraso si no llega ni a la mitad.)
          const cuota = Math.min(e.deuda, e.cuota), q = Math.min(cuota, Math.max(0, Math.floor(e.caja * 100) / 100)), ban = acreedor(m, e);
          if (q > 0) {
            e.caja -= q; e.deuda = Math.round((e.deuda - q) * 100) / 100;
            if (q >= cuota * 0.5) e.atraso = Math.max(0, (e.atraso || 0) - 1); else if ((e.atraso = (e.atraso || 0) + 1) > 24) { if (ban) { ban.emp.capital += q; } else if (b) { b.fondo += q; } quiebra(m, c, a, 'no podía pagar'); continue; }
            if (ban) { ban.emp.capital += q; ban.emp.cobrado = (ban.emp.cobrado || 0) + q; } else if (b) { b.fondo += q; b.devuelto += q; }
            if (e.deuda <= 0.01) { e.deuda = 0; anunciar(m, c, '🏦 ' + nombreDe(a) + ' ha devuelto su préstamo' + (ban ? ' al banco de ' + nombreDe(ban) : '')); }
          } else if ((e.atraso = (e.atraso || 0) + 1) > 24) quiebra(m, c, a, 'no podía pagar');
        }
        if (a.emp && a.o !== COMERCIANTE) mover(a, COMERCIANTE);
      }
      cobrarGasto(pueblo);
    };
    // Quien trabajaba en una fábrica que ya no está (quebró, se quemó, cambió de dueño o de reino) vuelve a su oficio
    // (también en los reinos sin banco central, que salen antes de esta función).
    for (const x of v.aldeanos) if (x.obrero != null && x.c === c.id) { const pv = v.privados && v.privados[x.obrero], d = pv && v.aldeanos.find(y => y.id === pv.dueno); if (!ES_INDUSTRIA.has(v.obra[x.obrero]) || !d || !d.emp || d.emp.t !== x.obrero || m.dueno[region(m, x.obrero)] !== c.id) { delete x.obrero; x.e = LIBRE; } }
    if (pausada(m) && c.jugador && c.plan && c.plan.economia && m.turno % 3 === c.id % 3) ministroEconomia(m, c);
    if (pausada(m) && c.era >= 6 && m.turno % 8 === (c.id + 4) % 8) montarConLoSuyo(m, c);
    if (!(c.bancos > 0) || c.era < 5) { negocios(null, 1); return; }
    // EL BANCO CENTRAL: al abrir se lleva una parte del tesoro; luego, cada turno, un poco de los impuestos.
    let b = c.banca;
    if (!b) { b = c.banca = { fondo: 0, prestado: 0, devuelto: 0, quiebras: 0, perdido: 0, abierto: m.turno }; moverAlBanco(c, Math.min(40, Math.max(0, (c.oro || 0) * 0.3))); anunciar(m, c, '🏦 Abre el banco central de ' + c.nombre + ' con ' + Math.round(b.fondo) + ' de oro del tesoro: prestará a los banqueros'); }
    if ((c.oro || 0) > 30) moverAlBanco(c, 0.3 * c.bancos);
    // La IA reparte sola entre el tesoro y el banco central.
    if (!c.jugador) { if ((c.oro || 0) > 100 && b.fondo < 80) moverAlBanco(c, 10); else if ((c.oro || 0) < 5 && b.fondo > 30) moverAlBanco(c, -15); }
    const nivel = nivelInteres(c), tipo = TIPO_INTERES(nivel);
    // LOS BANQUEROS: devuelven al central de lo suyo; si no pueden en mucho tiempo, quiebran.
    for (const a of banquerosDe(m, c)) {
      const e = a.emp;
      if (e.deuda > 0) {
        const q = Math.min(e.deuda, e.cuota);
        if (e.capital >= q + 2) { e.capital -= q; e.deuda = Math.round((e.deuda - q) * 100) / 100; b.fondo += q; b.devuelto += q; e.atraso = Math.max(0, (e.atraso || 0) - 1); if (e.deuda <= 0.01) { e.deuda = 0; anunciar(m, c, '🏦 El banco de ' + nombreDe(a) + ' ha devuelto todo al banco central'); } }
        else if ((e.atraso = (e.atraso || 0) + 1) > 30) { quiebra(m, c, a, 'sin dinero para pagar al banco central'); continue; }
      }
      if (a.o !== COMERCIANTE) mover(a, COMERCIANTE);
    }
    negocios(b, nivel);
    const libres = () => v.aldeanos.filter(a => a.c === c.id && !a.emp && !a.merc && a.obrero == null && !esNino(a) && (a.edad || 0) <= VIEJO - (pausada(m) ? 3 : 7) && a.o !== GUERRERO && a.o !== ERUDITO && !a.fijo && a.colono == null && a.aBordo == null);
    // UN BANQUERO NUEVO (desde la Revolución Industrial): el jefe de una casa comercial con gremio y dinero propio pide un
    // préstamo al banco central; si se lo dan, su GREMIO SE CONVIERTE EN SU BANCO (el mismo edificio, reformado: paga al
    // reino la obra). No llega con la era: hace falta el dinero y el préstamo. Sin banco central, o sin fondos, espera.
    const banqueros = banquerosDe(m, c), maxBancos = Math.min(3, 1 + Math.floor((m.ciudades || []).filter(x => x.civ === c.id).length / 2));
    const montoBanco = 25 + 5 * c.era, reforma = Math.round(precioObra(m, 'bancopriv') * 5) / 10, pide = montoBanco * 0.6 + reforma;
    // (También cuenta para el 4 %: el primer banco del reino siempre puede abrir; los demás, si cabe otro capitalista.)
    const tope4 = Math.max(1, Math.floor(v.aldeanos.filter(a => a.c === c.id && !esNino(a)).length * 0.04));
    if (c.era >= ERA_BANQUERO && m.turno % 8 === c.id % 8 && banqueros.length < maxBancos && (!banqueros.length || empresariosDe(m, c).length < tope4)) {
      const fortuna = a => a.merc.caja + (a.dinero || 0);
      // (Un banco por familia: si alguien de la casa ya es banquero, su gremio sigue siendo gremio.)
      const conBanco = new Set(banqueros.map(a => a.familia).filter(Boolean));
      const conGremio = mercaderesDe(m, c).filter(a => !a.emp && a.merc.de == null && a.merc.t != null && v.obra[a.merc.t] === OBRA.gremio && !(a.familia && conBanco.has(a.familia)));
      const rico = conGremio.filter(a => fortuna(a) >= pide).sort((x, y) => fortuna(y) - fortuna(x) || x.id - y.id)[0];
      if (rico && b.fondo < montoBanco) {
        if (!(rico.merc.pidioBanco > m.turno - 40)) { rico.merc.pidioBanco = m.turno; anunciar(m, c, '🏦 ' + nombreDe(rico) + ' quiere convertir su gremio en banco y pide ' + montoBanco + ' de oro al banco central, pero no tiene fondos (tiene ' + Math.round(b.fondo) + '): «pasad oro al banco central»'); }
      } else if (rico) {
        const deuda = Math.round(montoBanco * (1 + tipo * 2) * 10) / 10, t = rico.merc.t;
        let dinero = fortuna(rico) - reforma; rico.merc.caja = 0; rico.dinero = 0; c.oro = (c.oro || 0) + reforma;
        rico.emp = { neg: 'banco', capital: Math.round((dinero + montoBanco) * 10) / 10, deuda, cuota: Math.max(0.8, Math.round(deuda / 30 * 10) / 10), desde: m.turno, atraso: 0, prestado: 0, cobrado: 0, perdido: 0, sede: t };
        b.fondo -= montoBanco; b.prestado += montoBanco; mover(rico, COMERCIANTE);
        // El edificio: el gremio pasa a ser su banco; los comerciantes del gremio quedan libres (entran en otro).
        cambiar(m, 'obra', t, OBRA.bancopriv, 0);
        (v.privados = v.privados || {})[t] = { dueno: rico.id, civ: c.id, tipo: 'banco' };
        if (v.gremioCiudad) delete v.gremioCiudad[t];
        rico.merc.t = null;
        for (const x of v.aldeanos) if (x.gremio === rico.id) delete x.gremio;
        nombrarPrivado(m, t, c);
        anunciar(m, c, '🏦 El gremio de los ' + (rico.familia || nombreDe(rico)) + ' se convierte en su banco: ' + nombreDe(rico) + ' pone ' + Math.round(dinero) + ' de su fortuna, el banco central le presta ' + montoBanco + ' y paga ' + Math.round(reforma) + ' al reino por la reforma');
        S().cronica(m, 'banca', 'Nace el ' + ((v.edificios[t] || {}).nombre || 'banco') + ' en ' + c.nombre, 'La casa comercial de los ' + (rico.familia || nombreDe(rico)) + ' cierra el gremio y abre un banco en el mismo edificio: con su fortuna y un préstamo del banco central, ahora presta a quien quiere montar un negocio.', c, region(m, t));
      }
    }
    // Cada banquero tiene (o se levanta) su banco: un edificio suyo, pagado con su capital.
    if (m.turno % 8 === c.id % 8) for (const ban of banquerosDe(m, c)) sedeBanco(m, c, ban);
    // LOS BANQUEROS PRESTAN, de lo suyo, a vecinos que quieren montar un negocio (a un interés algo mayor).
    // Como mucho, el 4 % de los adultos tiene negocio propio (capitalistas: banqueros, empresarios y sus fábricas).
    const adultos = v.aldeanos.filter(a => a.c === c.id && !esNino(a)).length, topeCapitalistas = Math.max(1, Math.floor(adultos * 0.04));
    const max = Math.min(topeCapitalistas - banquerosDe(m, c).length, 1 + c.bancos + Math.floor((c.aldeanos || 0) / 40) + (nivel <= 0.5 ? 1 : 0) - (nivel >= 1.5 ? 1 : 0));
    for (const ban of banquerosDe(m, c)) {
      if (m.turno % 6 !== ban.id % 6) continue;
      const monto = 20 + 4 * c.era;
      if (empresariosDe(m, c).filter(a => a.emp.neg !== 'banco').length >= max || ban.emp.capital < monto + 5) continue;
      if (azar(v) > (nivel <= 0.5 ? 0.85 : nivel >= 1.5 ? 0.3 : 0.55) * (impuesto > 0.32 ? 0.5 : 1)) continue;
      // El banquero solo presta a quien tiene ahorrado al menos la cuarta parte (es su garantía): el que más ahorró, primero.
      const garantia = monto * 0.25;
      const cand = libres().filter(a => (a.dinero || 0) >= garantia || !pausada(m)); if (!cand.length) continue;
      const a = pausada(m) ? S().ordenarPor(cand.slice(), x => -(x.dinero || 0) * 1000 + x.id)[0] : (() => { const merc = cand.filter(a => a.o === COMERCIANTE); return (merc.length ? merc : cand)[Math.floor(azar(v) * (merc.length || cand.length))]; })();
      const privadas = Object.values(v.privados || {}).filter(p => p.civ === c.id && (p.tipo || 'fabrica') === 'fabrica').length;
      let neg = 'mercader', t = null;
      let ind = null;
      if (c.era >= 6 && privadas < 1 + Math.floor((c.aldeanos || 0) / 60)) {
        // La industria de lo que más le conviene al reino; la minera va en la montaña, las demás donde haya sitio.
        ind = elegirIndustria(m, c);
        t = sitioIndustria(m, c, ind);
        if (t == null && (ind === 'minera' || ind === 'ferrocarril' || ind === 'inmobiliaria')) { ind = 'aserradero'; t = sitioFabrica(m, c); }
        if (t != null) neg = 'fabrica';
      }
      if (neg === 'fabrica') {
        (v.privados = v.privados || {})[t] = { dueno: a.id, civ: c.id, tipo: 'fabrica', ind };
        const p = c.plan = c.plan || {}; (p.encargos = p.encargos || []).push({ t, o: obraIndustria(ind), clave: claveIndustria(ind), privado: a.id });
      }
      const deuda = Math.round(monto * (1 + (tipo + 0.05) * 2) * 10) / 10;
      // (El capitalista guarda una parte del préstamo para los primeros sueldos y la materia prima.)
      a.emp = { neg, t, monto, deuda, cuota: Math.max(0.8, Math.round(deuda / 30 * 10) / 10), caja: (a.dinero || 0) + (neg === 'fabrica' ? Math.round(monto * 0.3) : 0), banquero: ban.id, desde: m.turno, atraso: 0 };
      if (neg === 'fabrica') a.emp.ind = v.privados[t].ind;
      a.dinero = 0; ban.emp.capital -= monto; ban.emp.prestado += monto;
      mover(a, COMERCIANTE);
      anunciar(m, c, '🏦 El banco de ' + nombreDe(ban) + ' presta ' + monto + ' de oro a ' + nombreDe(a) + (neg === 'fabrica' ? (a.emp.ind === 'minera' ? ': abrirá una compañía minera en la montaña' : a.emp.ind === 'ferrocarril' ? ': abrirá una compañía de ferrocarril con su estación' : ': levantará ' + (QUE_MONTA[a.emp.ind] || 'una fábrica') + ' con su dinero') : ': se hace mercader'));
    }
  }
  function mercado(m, recursosDe) {
    const v = m.vida, vivas = S().vivas(m);
    const mk = m.mercado = m.mercado || { precio: Object.assign({}, PRECIO_BASE), historia: {}, oferta: {}, demanda: {} };
    for (const k of BIENES) {
      let of = 0, de = 0;
      for (const c of vivas) { of += c[k] || 0; de += objetivo(c, k); }
      mk.oferta[k] = Math.round(of); mk.demanda[k] = Math.round(de);
      if (mk.precio[k] == null) mk.precio[k] = PRECIO_BASE[k];
      const nuevo = PRECIO_BASE[k] * M.mat.pow(Math.max(0.3, Math.min(3, (de + 5) / (of + 5))), 0.7) * (mk.suceso && mk.suceso.k === k ? mk.suceso.f : 1);
      mk.precio[k] = Math.round((mk.precio[k] * 0.75 + nuevo * 0.25) * 100) / 100;
      const h = mk.historia[k] = mk.historia[k] || [];
      h.push(mk.precio[k]); if (h.length > 30) h.shift();
    }
    const media = {}, cuantos = {};
    for (const c of vivas) if (c.especialidad) cuantos[c.especialidad] = (cuantos[c.especialidad] || 0) + 1;
    for (const c of vivas) { const ap = aptitudes(m, c, recursosDe && recursosDe[c.id]); for (const k of BIENES) media[k] = (media[k] || 0) + ap[k] / vivas.length; }
    for (const id of Object.keys(v.resumenTratos || {})) {
      const r = v.resumenTratos[id], lista = Object.keys(r.entra).map(k => '+' + r.entra[k] + ' ' + k).concat(Object.keys(r.sale).map(k => '−' + r.sale[k] + ' ' + k));
      if (lista.length) (v.anuncios = v.anuncios || []).push({ civ: +id, texto: '⚖ Mercado: ' + lista.join(', ') + ' (' + (r.oro >= 0 ? '+' : '−') + Math.abs(Math.round(r.oro)) + '🪙)' });
    }
    v.resumenTratos = {};
    sucesosDelCampo(m);
    sucesosDelMercado(m);
    // (Ya no hay ofertas sueltas que aceptar: con los socios, el comercio va solo, según convenga.)
    for (const c of vivas) {
      // El combustible: los pozos dan crudo; fábricas, trenes y centrales queman lo que haya.
      if ((c.pozosPetroleo || 0) > 0 && c.era >= 7) c.petroleo = (c.petroleo || 0) + 1.2 * c.pozosPetroleo;
      quemar(m, c);
      huelgas(m, c);
      c.balance = balance(m, c);
      c.ganado = c.ganado || {};
      for (const k of BIENES) c.ganado[k] = (c.ganado[k] || 0) * 0.93;
      if (c.especialidad == null || !c.cartera || m.turno % 6 === c.id % 6 || (c.plan && c.plan.especialidad && c.plan.especialidad !== c.especialidad)) evaluarCartera(m, c, recursosDe && recursosDe[c.id], media, cuantos);
      // La forja: quien se dedica a las armas (o tiene metal de sobra y cuartel) convierte metal en armas.
      const reserva = reservaAcorazado(v, c);
      if (c.era >= 1 && c.cuarteles > 0 && ((c.cartera && c.cartera.armas) || c.balance.sobra.metal > 8)) {
        const q = Math.min(c.cartera && c.cartera.armas ? Math.max(1, Math.round(3 * c.cartera.armas * 1.6)) : 1, Math.floor(Math.max(0, (c.metal || 0) - 2 - reserva)));
        if (q > 0) { c.metal -= q; c.armas = (c.armas || 0) + q; }
      }
      // Lo que mandó fabricar el jugador: armas (1 de metal cada una; 2 por turno en la forja del cuartel y 4 más
      // por cada fábrica en marcha) o muebles (2 de madera cada lote, que se vende por oro).
      const fab = c.plan && c.plan.fabricar;
      if (fab && fab.n > fab.hechos && fab.que !== 'vehiculos') {
        const ritmo = Math.round(((c.cuarteles > 0 ? 2 : 0) + (enMarcha(c, 'fabrica') ? 4 * (c.fabricas || 0) : 0)) * fuerza(c));
        const q = Math.min(fab.que === 'granadas' ? ritmo * 3 : ritmo, fab.n - fab.hechos, fab.que === 'armas' ? Math.floor(c.metal || 0) : fab.que === 'granadas' ? Math.floor(c.metal || 0) * 3 : Math.floor((c.madera || 0) / 2));
        if (fab.que === 'vehiculos') { /* los hace el cuartel, más abajo */ }
        else if (q > 0) { if (fab.que === 'armas') { c.metal -= q; c.armas = (c.armas || 0) + q; } else if (fab.que === 'granadas') { c.metal -= Math.ceil(q / 3); c.granadas = (c.granadas || 0) + q; } else { c.madera -= q * 2; c.muebles = (c.muebles || 0) + q; } fab.hechos += q; }
        if (fab.hechos >= fab.n) { (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: (fab.que === 'muebles' ? '🏭 Hechos ' : '⚒ Hechas ') + fab.n + (fab.que === 'armas' ? ' armas' : fab.que === 'granadas' ? ' granadas' : ' lotes de muebles') }); c.plan.fabricar = null; }
        else if (!q && m.turno - fab.desde > 3 && !fab.avisado) { fab.avisado = 1; (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: fab.que !== 'muebles' ? '⚒ Sin metal para ' + (fab.que === 'granadas' ? 'las granadas' : 'las armas') + ': haced minas o compradlo' : '🏭 Sin madera para los muebles' }); }
      }
      banca(m, c);
      // La fábrica: forja en serie (sin cuartel) y convierte la madera que sobra en muebles que se venden por oro.
      const fabReino = Math.max(0, (c.fabricas || 0) - Object.keys(v.privados || {}).filter(t => v.privados[t].civ === c.id && v.privados[t].tipo === 'fabrica' && v.privados[t].ind !== 'minera' && v.obra[t] === OBRA.fabrica).length);
      if (fabReino > 0 && enMarcha(c, 'fabrica')) {
        const q = Math.min(Math.round(2 * fabReino * fuerza(c)), Math.floor(Math.max(0, (c.metal || 0) - 4 - reserva)));
        if (q > 0 && (c.cartera && (c.cartera.armas || c.cartera.metal) || c.guerras.length)) { c.metal -= q; c.armas = (c.armas || 0) + q; }
        const mad = Math.min(Math.round(4 * fabReino * fuerza(c)), Math.floor(Math.max(0, (c.madera || 0) - objetivo(c, 'madera') * 1.2) / 2));
        if (mad > 0) { c.madera -= mad * 2; c.muebles = (c.muebles || 0) + mad; }
      }
      // El mercado interior: la gente compra cada turno parte de los muebles del almacén (lo demás se exporta).
      if ((c.muebles || 0) > 0) {
        const q = Math.min(c.muebles, Math.max(1, Math.round((c.casas || 0) * 0.05)), Math.max(0, c.muebles - (c.plan && (c.plan.ventas || []).some(x => x.que === 'muebles') ? 1e9 : 0)));
        if (q > 0) { const oro = q * (m.mercado ? m.mercado.precio.muebles || PRECIO_BASE.muebles : PRECIO_BASE.muebles) * 0.6; c.muebles -= q; c.oro = (c.oro || 0) + oro; c.ganado = c.ganado || {}; c.ganado.muebles = (c.ganado.muebles || 0) + oro; }
      }
      // El cuartel fabrica vehículos de guerra para el almacén si se dedica a ello (o se lo mandan): uno cada dos turnos.
      if (c.era >= 5 && c.cuarteles > 0 && ((c.cartera && c.cartera.vehiculos) || (c.plan && c.plan.fabricar && c.plan.fabricar.que === 'vehiculos')) && m.turno % 2 === 0) {
        const t = c.era >= 8 ? 'tanque' : c.era >= 7 ? 'artilleria' : 'canon', cm = VEHICULOS[t].metal, cp = t === 'tanque' ? 3 : 0;
        if ((c.metal || 0) >= cm + 4 && (c.petroleo || 0) >= cp) { c.metal -= cm; c.petroleo = (c.petroleo || 0) - cp; c.vehiculos = (c.vehiculos || 0) + 1; const f = c.plan && c.plan.fabricar; if (f && f.que === 'vehiculos') { f.hechos++; if (f.hechos >= f.n) { (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚙ Hechos ' + f.n + ' vehículos de guerra' }); c.plan.fabricar = null; } } }
      }
      // Las granadas (Segunda Guerra Mundial): la forja del cuartel y las fábricas hacen 3 con cada pieza de metal,
      // hasta tener las que pide el ejército (o más, si el reino vive de venderlas).
      if (c.era >= 8 && !(c.plan && c.plan.fabricar) && (c.cuarteles > 0 || (c.fabricas > 0 && enMarcha(c, 'fabrica')))) {
        const quiere = objetivo(c, 'granadas') * (c.cartera && c.cartera.granadas ? 2.5 : 1) - (c.granadas || 0);
        const lotes = Math.min(Math.ceil(Math.max(0, quiere) / 3), (c.cuarteles > 0 ? 2 : 0) + (enMarcha(c, 'fabrica') ? 2 * (c.fabricas || 0) : 0), Math.floor(Math.max(0, (c.metal || 0) - 14 - reserva)));
        if (lotes > 0) { c.metal -= lotes; c.granadas = (c.granadas || 0) + lotes * 3; }
      }
      // Los pedidos y las ventas que nadie atiende en 40 turnos se olvidan.
      if (c.plan) for (const l of ['pedidos', 'ventas']) if (c.plan[l]) c.plan[l] = c.plan[l].filter(x => m.turno - (x.desde || 0) < 40);
      // Lo importado se olvida poco a poco (sirve para saber cuánto puede fiarse de sus socios).
      c.importa = c.importa || {};
      for (const k of BIENES) c.importa[k] = (c.importa[k] || 0) * 0.9;
    }
  }
