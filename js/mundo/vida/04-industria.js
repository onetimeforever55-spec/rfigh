  // ── GÉNESIS · LA VIDA · Las industrias, la materia prima, los sueldos, negocios privados, quiebras y herencias ──

  /*
   * EL COMERCIO Y LA BANCA, como en la vida real:
   *  · LOS COMERCIANTES existen desde siempre (el comercio primitivo del reino): trabajan para el reino y se quedan
   *    una pequeña comisión de cada trato (a.dinero).
   *  · EL MERCADER (desde la Edad Media): el comerciante que junta lo bastante funda un GREMIO con su dinero
   *    (OBRA.gremio, uno por ciudad como mucho; le compra al reino la madera y la piedra). Los comerciantes del
   *    gremio (a.gremio) trabajan para él: siguen siendo del reino, cobran un sueldo y ahorran más; él se queda
   *    las ganancias (a.merc.caja) y paga impuestos. Con ellas se hace su CASONA (palacete en el Renacimiento,
   *    mansión desde la Revolución Industrial), que también le compra al reino.
   *  · EL BANCO CENTRAL (del reino, con el edificio del banco, desde el Renacimiento): c.banca.fondo. Al abrir se
   *    lleva una parte del tesoro (los impuestos de entonces) y luego cada turno un poco más; el jugador puede pasar
   *    oro entre el tesoro y el banco central. Fija el interés (c.plan.interes) y SOLO PRESTA A BANQUEROS.
   *  · LOS BANQUEROS: el mercader más rico (de los que tienen gremio), con su fortuna y un préstamo del banco central, abre su banco privado
   *    (a.emp.neg = 'banco'). Presta de lo suyo (a.emp.capital) a los vecinos que quieren montar un negocio, a un
   *    interés algo mayor que el del central: de esa diferencia vive. Devuelve al central a plazos.
   *  · LOS EMPRESARIOS: con el préstamo del banquero (a.emp.banquero) montan su negocio: un mercader con su carreta o,
   *    desde la Revolución Industrial, una fábrica que se levanta con su dinero (v.privados[t]), sin madera ni piedra
   *    del reino. Los que trabajan allí siguen siendo del reino. Pagan impuestos y devuelven al banquero.
   *  · Si un empresario no puede pagar en mucho tiempo, quiebra y el banquero pierde lo que faltaba (su fábrica pasa
   *    al reino). Si quiebra un banquero, el banco central pierde lo que le debía y se queda con sus préstamos.
   *    Si muere uno de ellos, lo hereda su familia; sin nadie, pasa al reino.
   *  El interés: bajo = más préstamos y negocios, y más quiebras; alto = pocos, seguros, y la banca gana más.
   */
  const TIPO_INTERES = n => (n <= 0.5 ? 0.05 : n >= 1.5 ? 0.18 : 0.1);
  const nivelInteres = c => (c.plan && c.plan.interes) || 1;
  const empresariosDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.emp);
  /*
   * LAS INDUSTRIAS (desde la Revolución Industrial): la fábrica de un capitalista (un empresario con préstamo de su banquero)
   * es de un tipo, con su edificio: compra la materia prima al almacén del reino (lo que le sobra, a precio de mercado),
   * contrata obreros (aldeanos que dejan su oficio y cobran un sueldo de su caja) y vende lo que hace: a la gente del
   * reino, al reino si le falta (armas, conservas) y a los reinos con los que se comercia. Gana si vende más caro de lo
   * que le cuestan la materia prima y los sueldos; paga impuestos sobre lo que gana; si pierde, despide y acaba quebrando.
   */
  const INDUSTRIAS = {
    textil: { nombre: 'Textil', gasta: 'lana', hace: 'tela', precio: 1.7, rinde: 0.7 },
    aserradero: { nombre: 'Aserradero', gasta: 'madera', por: 2, hace: 'muebles', rinde: 0.8 },
    fundicion: { nombre: 'Fundición', gasta: 'metal', por: 1, hace: 'armas', rinde: 0.45 },
    conservera: { nombre: 'Conservera', gasta: 'comida', por: 2, hace: 'conservas', precio: 1.6, rinde: 0.8 },
    // La compañía minera no compra materia prima: saca de su mina metal y piedra (y carbón desde la Revolución
    // Industrial) y lo vende a su reino, a los socios y a las fábricas de los dos lados.
    minera: { nombre: 'Minera', saca: { metal: 0.4, piedra: 0.6, carbon: 0.3 }, rinde: 0.5 },
    // La compañía de ferrocarril: su estación es la estación de tren del reino (los trenes andan con ella), pero es suya:
    // cobra los billetes a la gente y los fletes del comercio, y paga al reino el carbón que queman sus trenes.
    ferrocarril: { nombre: 'Ferrocarril', tren: true, rinde: 0 },
    // La inmobiliaria (Era Moderna): desde su oficina, sus albañiles levantan las casas que faltan (la gente le paga un
    // alquiler) y los edificios que el pueblo necesita (se los cobra al tesoro). Compra ella los materiales.
    inmobiliaria: { nombre: 'Inmobiliaria', obra: true, rinde: 0 }
  };
  const ES_INDUSTRIA = new Set([OBRA.fabrica, OBRA.minapriv, OBRA.estacion, OBRA.inmopriv]);
  const obraIndustria = ind => (ind === 'minera' ? OBRA.minapriv : ind === 'ferrocarril' ? OBRA.estacion : ind === 'inmobiliaria' ? OBRA.inmopriv : OBRA.fabrica);
  const claveIndustria = ind => (ind === 'minera' ? 'minapriv' : ind === 'ferrocarril' ? 'estacion' : ind === 'inmobiliaria' ? 'inmopriv' : 'fabrica');
  const suEdificio = e => (e.ind === 'ferrocarril' ? 'su estación' : e.ind === 'minera' ? 'su mina' : e.ind === 'inmobiliaria' ? 'su oficina' : 'su fábrica');
  const QUE_MONTA = { textil: 'una fábrica textil', aserradero: 'un aserradero', fundicion: 'una fundición', conservera: 'una conservera', minera: 'una compañía minera', ferrocarril: 'una compañía de ferrocarril', inmobiliaria: 'una inmobiliaria' };
  // LA FUNDICIÓN TAMBIÉN HACE LAS MÁQUINAS DE GUERRA: cañones (desde la pólvora), artillería (Era Moderna), tanques y aviones
  // (II Guerra Mundial y Era Moderna), según la era, y solo por encargo: cuando su reino (o un socio) los necesita y puede
  // pagarlos. Gasta metal (y petróleo los tanques y los aviones), que compra como la demás materia prima.
  // LA AVIACIÓN, apagada por ahora (faltan las defensas antiaéreas): no despegan aviones, la fundición no los hace y las
  // ciudades no piden aeródromo. Para volver a ponerla, true.
  const AVIACION = false;
  const MAQUINA = { canon: { metal: 4, petroleo: 0, nombre: 'cañón', un: 'un cañón' }, artilleria: { metal: 5, petroleo: 0, nombre: 'pieza de artillería', un: 'una pieza de artillería' }, tanque: { metal: 8, petroleo: 3, nombre: 'tanque', un: 'un tanque' }, avion: { metal: 4, petroleo: 2, nombre: 'avión', un: 'un avión' } };
  const maquinaDeEra = era => (era >= 8 ? 'tanque' : era >= 7 ? 'artilleria' : 'canon');
  function pideMaquina(m, o) {
    if (!o || o.era < 5) return null;
    const guerra = o.guerras && o.guerras.length;
    if (AVIACION && o.era >= 7 && (o.aerodromos > 0 || !pausada(m)) && (o.aviones || 0) < (guerra ? 3 : 1)) return 'avion';
    if ((o.vehiculos || 0) < (guerra ? 2 + o.era - 5 : 1)) return maquinaDeEra(o.era);
    return null;
  }
  // Las compañías mineras de un reino (con su mina abierta).
  const minerasDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.emp && a.emp.neg === 'fabrica' && a.emp.ind === 'minera' && m.vida.obra[a.emp.t] === OBRA.minapriv);
  /*
   * COMPRAR MATERIA PRIMA: primero lo que le sobra al reino; luego a las compañías mineras del reino; y si falta, a los
   * reinos con los que se comercia (a su almacén y a sus mineras), un poco más caro por el transporte. Cada vendedor
   * cobra lo suyo. Así las fábricas de dos reinos socios se compran y se venden entre ellas.
   */
  function comprarInsumo(m, c, k, q, socios) {
    const pr = (m.mercado && m.mercado.precio[k]) || PRECIO_BASE[k];
    let falta = q, coste = 0, fuera = 0;
    const deReino = (o, f) => { const sobra = Math.max(0, (o[k] || 0) - objetivo(o, k) * 0.6), x = Math.min(falta, sobra); if (x > 0) { o[k] -= x; o.oro = (o.oro || 0) + x * pr * f; coste += x * pr * f; falta -= x; if (o !== c) fuera += x; } };
    const deMineras = (o, f) => { for (const mi of minerasDe(m, o)) { if (falta <= 0) break; const st = mi.emp.stocks || {}, x = Math.min(falta, st[k] || 0); if (x > 0) { st[k] = redondo(st[k] - x); mi.emp.caja = redondo(mi.emp.caja + x * pr * f); mi.emp.vendidoFab = redondo((mi.emp.vendidoFab || 0) + x); coste += x * pr * f; falta -= x; if (o !== c) fuera += x; } } };
    deReino(c, 1); if (falta > 0) deMineras(c, 1);
    for (const o of socios) { if (falta <= 0.05) break; deMineras(o, 1.1); if (falta > 0) deReino(o, 1.1); }
    return { q: redondo(q - falta), coste, fuera };
  }
  const PLAZAS_FABRICA = 4;
  /*
   * EL SUELDO DE LA GENTE (desde la Edad Media): cada adulto que trabaja para el reino (granjeros, leñadores, mineros,
   * constructores, soldados y eruditos) se queda una parte de lo que produce: un sueldo pequeño, menor cuanto más altos
   * son los impuestos. Los comerciantes tienen su comisión, y los obreros de gremios y fábricas, el sueldo de su patrón.
   * Cada uno gasta según su carácter (unos casi todo, otros ahorran); lo que gastan compra lo que hacen las fábricas
   * privadas. Con lo ahorrado se puede pedir un préstamo y hacerse capitalista.
   */
  const ERA_SUELDO = 4, GASTA = [0.01, 0.04, 0.08, 0.12, 0.16];
  const cobraSueldo = a => !esNino(a) && !a.merc && !a.emp && a.obrero == null && a.gremio == null && a.o !== COMERCIANTE && a.colono == null;
  function sueldos(m, c, impuesto) {
    const v = m.vida, base = (0.06 + 0.012 * c.era) * (1 - impuesto), quieren = [];
    for (const a of v.aldeanos) {
      if (a.c !== c.id) continue;
      if (cobraSueldo(a)) a.dinero = redondo((a.dinero || 0) + base);
      // Lo que cada uno querría gastar este turno (lo que pasa de un colchón de 5, según su carácter).
      if (!a.emp && !a.merc && !esNino(a) && (a.dinero || 0) > 5) quieren.push([a, Math.min(0.15, ((a.dinero || 0) - 5) * GASTA[a.id % 5])]);
    }
    return { quieren, total: quieren.reduce((k, x) => k + x[1], 0), gastado: 0 };
  }
  // Lo que la gente gastó de verdad (lo que había en las fábricas): sale de sus ahorros, en proporción.
  function cobrarGasto(p) { if (!p || !p.total || !p.gastado) return; const f = Math.min(1, p.gastado / p.total); for (const [a, g] of p.quieren) a.dinero = redondo(a.dinero - g * f); }
  const ovejasDe = (m, c) => m.vida.animales.filter(b => b.c === c.id && b.tipo === 'oveja').length;
  // Qué industria monta un capitalista: la de lo que más le sobra al reino (y mejor una que aún no haya).
  function elegirIndustria(m, c) {
    const v = m.vida, hay = new Set(Object.values(v.privados || {}).filter(p => p.civ === c.id && p.ind).map(p => p.ind));
    const sobra = k => (c[k] || 0) - objetivo(c, k);
    const falta = k => Math.max(0, objetivo(c, k) - (c[k] || 0));
    // (Lo que sobra cuenta hasta un tope: si no, con mucha comida de sobra todo serían conserveras.)
    const tope = x => Math.min(25, x);
    const guerra = c.guerras && c.guerras.length, maquinas = c.era >= 5 && !hay.has('fundicion') ? 6 + (guerra ? 12 : 0) + (c.era >= 7 ? 6 : 0) : 0;
    const puntos = { textil: tope(ovejasDe(m, c) * 1.5 - 4), aserradero: tope(sobra('madera') / 2), fundicion: tope(sobra('metal') * 2) + maquinas, conservera: tope(sobra('comida') / 4),
      // (La minera, al revés que las demás: se monta donde falta metal o piedra, si hay montaña libre.)
      minera: sitioMina(m, c, terrenos(m)) != null ? falta('metal') * 1.5 + falta('piedra') / 3 + (c.era >= 6 ? falta('carbon') : 0) - 2 : -1e9,
      // (El ferrocarril, si el reino comercia y tiene gente que viaje: uno por reino, y mejor si aún no hay estación.)
      // (La inmobiliaria, en la Era Moderna, si al pueblo le faltan casas o edificios: una por reino.)
      inmobiliaria: c.era >= 7 && (c.aldeanos || 0) >= 60 && !hay.has('inmobiliaria') ? Math.min(30, 10 + (faltanCamas(c) ? 10 : 0) + (c.necesidades || []).filter(n => n.falta && OBRA_INMO.has(n.obra)).length * 4) : -1e9,
      ferrocarril: c.era >= 6 && (c.aldeanos || 0) >= 50 && (c.rutas || 0) + sociosDe(m, c).length >= 1 && !hay.has('ferrocarril') ? Math.min(30, 14 + (c.rutas || 0) * 3 + sociosDe(m, c).length * 2 - (c.estaciones || 0) * 5) : -1e9 };
    let mejor = 'aserradero', mp = -1e9;
    for (const k of Object.keys(INDUSTRIAS)) { if ((k === 'ferrocarril' || k === 'inmobiliaria') && hay.has(k)) continue; const p = puntos[k] * (hay.has(k) ? 0.4 : 1) - (hay.has(k) ? 5 : 0); if (p > mp) { mp = p; mejor = k; } }
    return mejor;
  }
  const precioDe = (m, c, I) => I.precio ? Math.round(I.precio * (1 + 0.12 * Math.max(0, c.era - 6)) * 100) / 100 : ((m.mercado && m.mercado.precio[I.hace]) || PRECIO_BASE[I.hace]);
  // Quién entra a trabajar en una fábrica: un adulto sin negocio ni encargo, del oficio que más gente tiene.
  function candidatoObrero(m, c) {
    const v = m.vida, l = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && (a.edad || 0) <= VIEJO - 4 && !a.emp && !a.merc && a.gremio == null && a.obrero == null && !a.fijo && a.colono == null && a.aBordo == null && a.o !== GUERRERO && a.o !== ERUDITO && a.o !== COMERCIANTE);
    if (!l.length) return null;
    const n = [0, 0, 0, 0, 0, 0, 0]; for (const a of l) n[a.o]++;
    return S().ordenarPor(l.slice(), a => -n[a.o] * 1e7 + a.id)[0];
  }
  // Un turno de la fábrica: sueldos, producción, ventas y contratos. Devuelve lo que gana (antes de impuestos).
  // La fundición, por encargo: cada obrero avanza un poco la máquina; cuando está, se la vende a su reino o a un socio
  // que la necesite (y pueda pagarla). Primero se busca comprador, luego se compra el metal: nunca se amontonan.
  // Lo que el reino tiene pedido a sus empresas de una cosa, y apuntar lo que le llega.
  const pedidoEmp = (c, k) => (c.plan && c.plan.pedidoEmp && c.plan.pedidoEmp[k]) || 0;
  function servidoEmp(m, c, k, q, a) {
    const p = c.plan; if (!p || !p.pedidoEmp || !p.pedidoEmp[k]) return;
    p.pedidoEmp[k] = Math.max(0, Math.round((p.pedidoEmp[k] - q) * 10) / 10);
    if (p.pedidoEmp[k] < 0.5) { delete p.pedidoEmp[k]; anunciar(m, c, '🏭 Las empresas del país entregan el pedido de ' + (NOMBRE_BIEN[k] || k) + (a ? ' (lo último, ' + nombreDe(a) + ')' : '')); }
  }
  function maquinas(m, c, a, e, socios, obreros) {
    let ingreso = 0, gasto = 0;
    e.taller = redondo((e.taller || 0) + obreros.length * 0.12 * fuerza(c));
    if (e.taller < 1) return { ingreso, gasto };
    const enc = c.plan && (c.plan.encargosMaq || []).find(x => x.hechos < x.n) || null;
    for (const o of [c, ...socios.slice(0, 3)]) {
      // (Lo que el reino encargó a la fundición va antes que nada.)
      const k = o === c && enc ? enc.k : pideMaquina(m, o); if (!k) continue;
      const Q = MAQUINA[k], pm = (m.mercado && m.mercado.precio.metal) || PRECIO_BASE.metal, pp = (m.mercado && m.mercado.precio.petroleo) || PRECIO_BASE.petroleo;
      const precio = Math.round(((m.mercado && m.mercado.precio.vehiculos) || PRECIO_BASE.vehiculos) * (k === 'avion' ? 1.3 : k === 'tanque' ? 1.15 : 0.8) * (o === c ? 1 : 1.05));
      if ((o.oro || 0) < precio + 10 || (e.caja || 0) + 0 < Q.metal * pm * 0.5 - 20) continue;
      const met = comprarInsumo(m, c, 'metal', Q.metal, socios); gasto += met.coste;
      const pet = Q.petroleo ? comprarInsumo(m, c, 'petroleo', Q.petroleo, socios) : { q: 0, coste: 0 }; gasto += pet.coste;
      if (met.q < Q.metal - 0.05 || pet.q < Q.petroleo - 0.05) { if (!(e.avisoMaquina > m.turno - 40)) { e.avisoMaquina = m.turno; anunciar(m, c, '🏭 ' + ((m.vida.edificios[e.t] || {}).nombre || 'La fundición') + ' no puede hacer ' + Q.un + ': le falta ' + (met.q < Q.metal - 0.05 ? 'metal' : 'petróleo')); } break; }
      o.oro -= precio; ingreso += precio; e.taller = redondo(e.taller - 1);
      if (k === 'avion') o.aviones = (o.aviones || 0) + 1; else o.vehiculos = (o.vehiculos || 0) + 1;
      const hechas = e.maquinas = e.maquinas || {}; hechas[k] = (hechas[k] || 0) + 1;
      if (o === c) e.alReino = redondo((e.alReino || 0) + 1); else e.exportado = redondo((e.exportado || 0) + 1);
      if (o === c && enc && k === enc.k) { enc.hechos++; if (enc.hechos >= enc.n) { anunciar(m, c, '🏭 ' + ((m.vida.edificios[e.t] || {}).nombre || 'La fundición') + ' entrega el encargo: ' + enc.n + ' ' + ({ tanque: 'tanques', avion: 'aviones', canon: 'cañones', artilleria: 'piezas de artillería' }[k]) + ' para el reino'); c.plan.encargosMaq = c.plan.encargosMaq.filter(x => x !== enc); } }
      if (hechas[k] === 1) anunciar(m, c, (k === 'avion' ? '✈ ' : '🛡 ') + ((m.vida.edificios[e.t] || {}).nombre || 'La fundición') + ' entrega ' + (k === 'artilleria' ? 'su primera pieza de artillería' : 'su primer ' + Q.nombre) + (o === c ? ' al ejército' : ' a ' + o.nombre) + ' (' + precio + ' de oro)');
      break;
    }
    return { ingreso, gasto };
  }
  // LA COMPAÑÍA DE FERROCARRIL: con sus ferroviarios, cobra los billetes de la gente (de lo que gasta) y los fletes de lo
  // que el reino comercia (rutas y socios; los socios pagan su parte), y paga al reino el carbón de sus trenes. Sin
  // carbón, los trenes se paran y no cobra nada.
  function ferrocarril(m, c, a, e, socios, pueblo, obreros, sueldo, gasto) {
    const v = m.vida, t = e.t;
    let ingreso = 0;
    const listo = v.obra[t] === OBRA.estacion, anda = listo && enMarcha(c, 'tren') && obreros.length > 0;
    if (anda) {
      const pc = (m.mercado && m.mercado.precio.carbon) || PRECIO_BASE.carbon, carbon = GASTO.tren * pc;
      c.oro = (c.oro || 0) + carbon; gasto += carbon;
      const fuerzaTren = Math.min(1, 0.55 + 0.15 * obreros.length) * (1 + 0.1 * Math.max(0, c.era - 6));
      const billetes = Math.min(pueblo ? Math.max(0, pueblo.total - pueblo.gastado) : 1e9, Math.min(1.8, (c.aldeanos || 0) * 0.01) * fuerzaTren);
      if (pueblo) pueblo.gastado += billetes;
      const flete = Math.min(Math.max(0, (c.oro || 0) - 5), 0.24 * Math.min(6, (c.rutas || 0) + socios.length) * fuerzaTren);
      c.oro -= flete;
      let deSocios = 0;
      for (const o of socios.slice(0, 3)) { const x = 0.12 * fuerzaTren; if ((o.oro || 0) > x + 10) { o.oro -= x; deSocios += x; } }
      ingreso = billetes + flete + deSocios;
      e.viajeros = redondo((e.viajeros || 0) + billetes); e.fletes = redondo((e.fletes || 0) + flete + deSocios); e.vendido = redondo((e.vendido || 0) + ingreso);
    }
    // Contrata ferroviarios según el comercio (de 1 a 3) si puede pagarlos; si pierde mucho, despide.
    const quiere = 1 + ((c.rutas || 0) >= 2 ? 1 : 0) + (socios.length >= 2 ? 1 : 0);
    if (listo && m.turno % 3 === a.id % 3) {
      if (obreros.length > 1 && (e.caja < -sueldo * 6 || obreros.length > quiere || e.ultimo < -0.3)) { const x = obreros[obreros.length - 1]; delete x.obrero; x.e = LIBRE; }
      else if (obreros.length < quiere && (e.caja >= sueldo * 4 || obreros.length < 1)) {
        const x = candidatoObrero(m, c);
        if (x) { x.obrero = t; x.e = LIBRE; x.paseo = 0; if (!e.contratados) anunciar(m, c, '🚂 ' + ((v.edificios[t] || {}).nombre || 'La compañía de ferrocarril') + ' contrata a sus primeros ferroviarios (' + sueldo + ' de oro de sueldo)'); e.contratados = (e.contratados || 0) + 1; }
      }
    }
    e.ultimo = redondo(ingreso - gasto);
    return ingreso - gasto;
  }
  // LA INMOBILIARIA: cada vez, una obra. Primero lo que el pueblo necesita y el tesoro puede pagar (pozo, granero,
  // plaza, parque, hospital, central); si no, casas donde falten camas. Compra los materiales, pone el andamio y sus
  // albañiles la levantan. El edificio público se lo cobra al reino al entregarlo; las casas son suyas y la gente le
  // paga un alquiler (de lo que gasta). Sin obra, se queda con un albañil.
  const OBRA_INMO = new Set(['pozo', 'granero', 'fuente', 'parque', 'hospital', 'central']);
  function inmobiliaria(m, c, a, e, socios, pueblo, obreros, sueldo, gasto) {
    const v = m.vida, t = e.t, listo = v.obra[t] === OBRA.inmopriv;
    let ingreso = 0;
    // El alquiler de sus casas (las que siguen en pie y en el reino).
    const casas = Object.keys(v.alquiler || {}).filter(k => v.alquiler[k] === t && v.obra[+k] === OBRA.casa && m.dueno[region(m, +k)] === c.id);
    for (const k of Object.keys(v.alquiler || {})) if (v.alquiler[k] === t && v.obra[+k] !== OBRA.casa) delete v.alquiler[k];
    if (casas.length) {
      const renta = Math.min(pueblo ? Math.max(0, pueblo.total - pueblo.gastado) : 1e9, casas.length * 0.07 * (1 + 0.1 * Math.max(0, c.era - 7)));
      if (pueblo) pueblo.gastado += renta;
      ingreso += renta; e.alquileres = redondo((e.alquileres || 0) + renta);
    }
    e.casas = casas.length;
    // La obra en marcha.
    let pr = e.proy;
    if (pr && (v.obra[pr.t] === pr.o || m.dueno[region(m, pr.t)] !== c.id || (!v.andamios || !v.andamios[pr.t]) && pr.empezada)) {
      if (v.obra[pr.t] === pr.o) {
        if (pr.o === OBRA.casa) { (v.alquiler = v.alquiler || {})[pr.t] = t; e.hechas = (e.hechas || 0) + 1; if (!e.avisoCasa) { e.avisoCasa = 1; anunciar(m, c, '🏗 ' + ((v.edificios[t] || {}).nombre || 'La inmobiliaria') + ' termina su primer bloque de viviendas: la gente que vive allí le paga un alquiler'); } }
        else { const paga = Math.min(pr.precio, Math.max(0, c.oro || 0)); c.oro -= paga; ingreso += paga; e.publicas = (e.publicas || 0) + 1; anunciar(m, c, '🏗 ' + ((v.edificios[t] || {}).nombre || 'La inmobiliaria') + ' entrega ' + (NECESIDADES[pr.clave] ? NECESIDADES[pr.clave].edificio : 'un edificio') + ' al reino (cobra ' + Math.round(paga) + ' de oro)'); }
      }
      pr = e.proy = null;
    }
    if (listo && !pr && obreros.length) {
      // Elegir la siguiente: lo que el pueblo necesita (si el tesoro llega), o casas.
      const empezadas = new Set(Object.keys(v.andamios || {}).filter(k => v.andamios[k].civ === c.id).map(k => v.andamios[k].o));
      const nec = (c.necesidades || []).find(n => n.falta && OBRA_INMO.has(n.obra) && !empezadas.has(OBRA[n.obra]) && c.era >= (ERA_OBRA[OBRA[n.obra]] || 0) && !((c.plan && c.plan.encargos) || []).some(x => x.o === OBRA[n.obra]));
      const precioDeObra = clave => Math.round(precioObra(m, clave) * 1.3);
      // (Casas: donde faltan camas, y también por adelantado si quedan pocas libres, como hace un promotor; como mucho
      // una suya por cada cinco vecinos.)
      const promover = (c.camas || 0) - (c.aldeanos || 0) < 10 && casas.length < (c.aldeanos || 0) / 5;
      let clave = nec && (c.oro || 0) >= precioDeObra(nec.obra) + 15 ? nec.obra : faltanCamas(c) || promover ? 'casa' : null;
      // (El edificio que pide una ciudad va en esa ciudad, o queda apuntado como suyo: si no, la ciudad lo seguiría
      // pidiendo y la inmobiliaria levantaría uno tras otro.)
      const sitio = clave === 'casa' ? sitioPara(m, c, 'casa') : clave ? sitioPara(m, c, clave, [nec.region]) : null;
      if (sitio != null && clave !== 'casa') (v.sede = v.sede || {})[sitio] = nec.region;
      if (sitio != null) {
        const o = OBRA[clave], cs = COSTES[o] || [2, 0, 0];
        const md = comprarInsumo(m, c, 'madera', cs[0], socios), pd = cs[1] ? comprarInsumo(m, c, 'piedra', cs[1], socios) : { q: 0, coste: 0 };
        gasto += md.coste + pd.coste;
        if (md.q >= cs[0] - 0.05 && pd.q >= (cs[1] || 0) - 0.05) {
          cambiar(m, 'arbol', sitio, 0, 0);
          (v.andamios = v.andamios || {})[sitio] = { o, falta: TRABAJO[o] || 2, total: TRABAJO[o] || 2, civ: c.id, coste: [0, 0, 0], inmo: t };
          pr = e.proy = { t: sitio, o, clave, precio: clave === 'casa' ? 0 : precioDeObra(clave), empezada: 1 };
        }
      }
    }
    // Sus albañiles trabajan en la obra (más deprisa con las técnicas de construcción).
    if (pr && v.andamios && v.andamios[pr.t] && obreros.length) {
      const an = v.andamios[pr.t];
      an.falta -= obreros.length * 0.35 * (1 + M.tec(c, 'obra'));
      if (an.falta <= 0) { colocarObra(m, pr.t, an.o, 0); delete v.andamios[pr.t]; if (an.o === OBRA.casa) c.casas = (c.casas || 0) + 1; }
    }
    // Contrata albañiles si tiene obra (hasta 4) y puede pagarlos; sin obra, se queda con uno.
    const quiere = pr ? PLAZAS_FABRICA : 1;
    if (listo && m.turno % 3 === a.id % 3) {
      if (obreros.length > 1 && (e.caja < -sueldo * 6 || obreros.length > quiere)) { const x = obreros[obreros.length - 1]; delete x.obrero; x.e = LIBRE; }
      else if (obreros.length < quiere && (e.caja >= sueldo * 4 || obreros.length < 1)) {
        const x = candidatoObrero(m, c);
        if (x) { x.obrero = t; x.e = LIBRE; x.paseo = 0; if (!e.contratados) anunciar(m, c, '🏗 ' + ((v.edificios[t] || {}).nombre || 'La inmobiliaria') + ' contrata a sus primeros albañiles (' + sueldo + ' de oro de sueldo)'); e.contratados = (e.contratados || 0) + 1; }
      }
    }
    e.ultimo = redondo(ingreso - gasto);
    return ingreso - gasto;
  }
  function industria(m, c, a, e, socios, pueblo) {
    const v = m.vida, t = e.t;
    // (Si la fábrica perdió su ficha de dueño, se le vuelve a poner: el edificio y el negocio siguen siendo suyos.)
    if (!(v.privados && v.privados[t])) { (v.privados = v.privados || {})[t] = { dueno: a.id, civ: c.id, tipo: 'fabrica', ind: INDUSTRIAS[e.ind] ? e.ind : undefined }; nombrarPrivado(m, t, c); }
    const pv = v.privados[t];
    if (!INDUSTRIAS[e.ind]) { e.ind = (pv && INDUSTRIAS[pv.ind]) ? pv.ind : v.obra[t] === OBRA.minapriv ? 'minera' : (x => (x === 'minera' ? 'aserradero' : x))(elegirIndustria(m, c)); if (pv) { pv.ind = e.ind; nombrarPrivado(m, t, c); } }
    const I = INDUSTRIAS[e.ind], obreros = v.aldeanos.filter(x => x.obrero === t), sueldo = Math.round((0.15 + 0.03 * c.era) * (c.plan && c.plan.salario ? c.plan.salario : 1) * 100) / 100;
    let gasto = 0, ingreso = 0, falta = null;
    for (const o of obreros) { o.dinero = redondo((o.dinero || 0) + sueldo); gasto += sueldo; }
    e.stock = e.stock || 0;
    if (I.tren) return ferrocarril(m, c, a, e, socios, pueblo, obreros, sueldo, gasto);
    if (I.obra) return inmobiliaria(m, c, a, e, socios, pueblo, obreros, sueldo, gasto);
    // Producción: cada obrero hace un poco (más con la central eléctrica), si hay materia prima y el almacén no está lleno.
    if (obreros.length && enMarcha(c, 'fabrica') && e.stock < 12) {
      let q = obreros.length * I.rinde * fuerza(c);
      if (I.gasta === 'lana') { const lana = ovejasDe(m, c) * 0.35; if (lana < q) { q = lana; if (q < 0.3) falta = 'ovejas para la lana'; } }
      else if (I.saca) {
        // La mina: saca de lo suyo (no compra nada); cada obrero, un poco de cada cosa.
        const st = e.stocks = e.stocks || {}; q = 0;
        for (const k of Object.keys(I.saca)) { if (k === 'carbon' && c.era < 6) continue; const x = Math.floor(obreros.length * I.saca[k] * fuerza(c) * 10) / 10; st[k] = redondo((st[k] || 0) + x); q += x; }
      }
      else {
        // La materia prima: del reino, de las mineras y, si falta, de los socios (comprarInsumo).
        const r = comprarInsumo(m, c, I.gasta, Math.floor(q * I.por * 10) / 10, socios);
        gasto += r.coste; e.importado = redondo((e.importado || 0) + r.fuera);
        q = r.q / I.por;
        if (q < 0.3) falta = I.gasta === 'comida' ? 'comida que le sobre al reino ni a los socios' : I.gasta;
      }
      q = Math.floor(q * 10) / 10; e.stock = redondo(e.stock + q); e.hecho = redondo((e.hecho || 0) + q);
    }
    if (falta && !(e.avisoParada > m.turno - 30)) { e.avisoParada = m.turno; anunciar(m, c, '🏭 ' + ((v.edificios[t] || {}).nombre || 'La fábrica') + ' está parada: no hay ' + falta + ' que comprar' + (I.gasta !== 'lana' ? ' («comprad ' + I.gasta + '»)' : '')); }
    if (I.saca) {
      // La minera vende al reino lo que le falta (lo paga el tesoro) y a los socios que lo necesiten (lo pagan ellos); el
      // resto se lo compran las fábricas (de aquí y de los socios). Si se le amontona, despide.
      const st = e.stocks = e.stocks || {};
      for (const o of [c, ...socios.slice(0, 3)]) for (const k of Object.keys(st)) {
        // (Lo que el reino le pide a sus empresas cuenta como lo que necesita.)
        const pedido = o === c ? pedidoEmp(c, k) : 0;
        const pr = ((m.mercado && m.mercado.precio[k]) || PRECIO_BASE[k]) * (o === c ? 1 : 1.05), necesita = Math.max(0, objetivo(o, k) * 0.9 - (o[k] || 0), pedido);
        const x = Math.floor(Math.min(st[k], necesita, Math.max(0, (o.oro || 0) - 5) / pr) * 10) / 10;
        if (x > 0) { o.oro -= x * pr; o[k] = (o[k] || 0) + x; st[k] = redondo(st[k] - x); ingreso += x * pr; if (o === c) { e.alReino = redondo((e.alReino || 0) + x); if (pedido) servidoEmp(m, c, k, x, a); } else e.exportado = redondo((e.exportado || 0) + x); }
      }
      e.stock = redondo(Object.values(st).reduce((p, q) => p + q, 0));
      // (Lo que cobró de las fábricas ya entró en su caja al venderles: comprarInsumo.)
      const hayVenta = Object.keys(st).some(k => objetivo(c, k) > (c[k] || 0)) || socios.length;
      if (m.turno % 3 === a.id % 3) {
        if (obreros.length > 1 && e.stock > 20) { const x = obreros[obreros.length - 1]; delete x.obrero; x.e = LIBRE; }
        else if (obreros.length < PLAZAS_FABRICA && e.stock < 10 && hayVenta && (e.caja >= sueldo * 4 || obreros.length < 2)) { const x = candidatoObrero(m, c); if (x) { x.obrero = t; x.e = LIBRE; x.paseo = 0; if (!e.contratados) anunciar(m, c, '⛏ ' + ((v.edificios[t] || {}).nombre || 'La mina') + ' contrata a sus primeros mineros (' + sueldo + ' de oro de sueldo)'); e.contratados = (e.contratados || 0) + 1; } }
      }
      e.ultimo = redondo(ingreso - gasto);
      return ingreso - gasto;
    }
    // Ventas: a la gente del reino (según cuántos son), al reino si le falta y a los socios.
    const precio = precioDe(m, c, I);
    // (La gente compra con su sueldo: si no tiene dinero, la fábrica vende poco dentro.)
    const dentro = pueblo ? Math.min(e.stock, Math.max(0, pueblo.total - pueblo.gastado) / precio) : Math.min(e.stock, Math.max(0.4, (c.aldeanos || 0) * 0.012));
    if (pueblo) pueblo.gastado += dentro * precio;
    ingreso += dentro * precio; e.stock = redondo(e.stock - dentro); e.vendido = redondo((e.vendido || 0) + dentro);
    if (e.stock > 0.4 && (I.hace === 'armas' || I.hace === 'conservas')) {
      const necesita = I.hace === 'armas' ? Math.max(0, objetivo(c, 'armas') - (c.armas || 0)) : (c.comida || 0) < (c.habitantes || 10) * 0.6 ? e.stock : 0;
      const q = Math.min(e.stock, necesita, Math.floor(Math.max(0, c.oro || 0) / precio));
      if (q > 0) { c.oro -= q * precio; ingreso += q * precio; e.stock = redondo(e.stock - q); if (I.hace === 'armas') c.armas = (c.armas || 0) + q; else alimento(c, 'carne', q * 2); e.alReino = redondo((e.alReino || 0) + q); }
    }
    // Lo que el reino le ha pedido a las empresas del país («comprad 10 de armas a mis empresas»).
    { const kb = I.hace === 'conservas' ? 'comida' : I.hace, ped = pedidoEmp(c, kb);
      if (ped > 0 && e.stock > 0.3) {
        const q = Math.floor(Math.min(e.stock, kb === 'comida' ? ped / 2 : ped, Math.max(0, (c.oro || 0) - 5) / precio) * 10) / 10;
        if (q > 0) { c.oro -= q * precio; ingreso += q * precio; e.stock = redondo(e.stock - q); if (kb === 'comida') alimento(c, 'carne', q * 2); else c[kb] = (c[kb] || 0) + q; e.alReino = redondo((e.alReino || 0) + q); servidoEmp(m, c, kb, kb === 'comida' ? q * 2 : q, a); }
      } }
    for (const o of socios.slice(0, 3)) {
      if (e.stock < 0.5) break;
      const q = Math.min(e.stock, 1.5), pago = q * precio * 0.95;
      if ((o.oro || 0) < pago + 5) continue;
      o.oro -= pago; ingreso += pago; e.stock = redondo(e.stock - q); e.exportado = redondo((e.exportado || 0) + q);
      if (I.hace === 'armas' || I.hace === 'muebles') o[I.hace] = (o[I.hace] || 0) + q;
    }
    if (I.hace === 'armas' && obreros.length && c.era >= 5 && enMarcha(c, 'fabrica')) { const r = maquinas(m, c, a, e, socios, obreros); ingreso += r.ingreso; gasto += r.gasto; }
    // Contrata los que necesita para lo que puede vender (a la gente, al reino y a los socios) y si tiene con qué pagar;
    // si le falta materia prima, se le acumula lo hecho o pierde dinero, despide.
    const vendible = (pueblo ? Math.max(0.4, pueblo.total / Math.max(1, pueblo.fabricas || 1) / precio) : Math.max(0.4, (c.aldeanos || 0) * 0.012)) + Math.min(3, socios.length) * 1.5 + (I.hace === 'armas' ? Math.max(0, objetivo(c, 'armas') - (c.armas || 0)) / 4 : 0);
    const quiere = Math.max(1, Math.min(PLAZAS_FABRICA, Math.ceil(vendible / (I.rinde * fuerza(c)))));
    if (m.turno % 3 === a.id % 3) {
      if (obreros.length > 1 && (falta || obreros.length > quiere)) { const x = obreros[obreros.length - 1]; delete x.obrero; x.e = LIBRE; }
      else if (obreros.length < quiere && e.stock < 6 && !falta && (e.caja >= sueldo * 4 || obreros.length < 2)) {
        const x = candidatoObrero(m, c);
        if (x) { x.obrero = t; x.e = LIBRE; x.paseo = 0; if (!e.contratados) anunciar(m, c, '🏭 ' + ((v.edificios[t] || {}).nombre || 'La fábrica') + ' contrata a sus primeros obreros (' + sueldo + ' de oro de sueldo)'); e.contratados = (e.contratados || 0) + 1; }
      } else if (obreros.length && (e.caja < -sueldo * 6 || (e.stock >= 12 && obreros.length > 1))) { const x = obreros[obreros.length - 1]; delete x.obrero; x.e = LIBRE; }
    }
    e.ultimo = redondo(ingreso - gasto);
    return ingreso - gasto;
  }
  const ERA_BANQUERO = 6; // los bancos privados nacen con la industrialización (de un gremio que se convierte)
  const banquerosDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.emp && a.emp.neg === 'banco');
  const nombreDe = a => a.nombre + ' ' + (a.familia || '');
  const anunciar = (m, c, t) => (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: t });
  function sitioPara(m, c, clave, regiones) {
    const v = m.vida;
    regiones = regiones || [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    // Primero en la ciudad; si está llena, en las tierras del reino de alrededor.
    const anillo1 = [...new Set(regiones.flatMap(r => S().vecinos(r)))].filter(r => m.dueno[r] === c.id && !regiones.includes(r));
    const anillo2 = [...new Set(anillo1.flatMap(r => S().vecinos(r)))].filter(r => m.dueno[r] === c.id && !regiones.includes(r) && !anillo1.includes(r));
    const lista = [...regiones, ...anillo1, ...anillo2];
    const reservadas = new Set([...((c.plan && c.plan.encargos) || []).map(x => x.t), ...Object.keys(v.privados || {}).map(Number)]);
    for (const r of lista) for (const t of parcelas(m, r)) if (!reservadas.has(t) && !v.obra[t] && !(v.andamios && v.andamios[t]) && !puedeColocar(m, c, t, clave)) return t;
    // Sin solar libre, como las obras del reino: sobre un huerto (el dueño se lo compra al reino con la obra).
    for (const r of lista) for (const t of parcelas(m, r)) if (!reservadas.has(t) && v.obra[t] === OBRA.campo && !(v.andamios && v.andamios[t]) && !puedeColocar(m, c, t, clave)) return t;
    return null;
  }
  const sitioFabrica = (m, c) => sitioPara(m, c, 'fabrica');
  const sitioIndustria = (m, c, ind) => (ind === 'minera' ? sitioMina(m, c, terrenos(m)) : ind === 'ferrocarril' ? sitioPara(m, c, 'estacion') : ind === 'inmobiliaria' ? sitioPara(m, c, 'inmopriv') : sitioFabrica(m, c));
  // Un edificio privado que el dueño paga comprándole al reino los materiales (a precio de mercado) y la mano de obra.
  function precioObra(m, clave) {
    const o = OBRA[clave], coste = COSTES[o], pr = (m.mercado && m.mercado.precio) || PRECIO_BASE;
    return Math.round((coste[0] * (pr.madera || PRECIO_BASE.madera) + coste[1] * (pr.piedra || PRECIO_BASE.piedra) + (coste[2] || 0) + (TRABAJO[o] || 4)) * 10) / 10;
  }
  function encargarPrivado(m, c, a, clave, t, tipo) {
    const v = m.vida, o = OBRA[clave], coste = COSTES[o], precio = precioObra(m, clave);
    if ((a.dinero || 0) < precio || c.madera < coste[0] || c.piedra < coste[1]) return 0;
    a.dinero -= precio; c.oro = (c.oro || 0) + precio; c.madera -= coste[0]; c.piedra -= coste[1];
    (v.privados = v.privados || {})[t] = { dueno: a.id, civ: c.id, tipo };
    const p = c.plan = c.plan || {}; (p.encargos = p.encargos || []).push({ t, o, clave, privado: a.id });
    return precio;
  }
  // Un negocio privado que se acaba antes de empezar la obra: su encargo se borra (nadie la iba a pagar).
  function olvidarPrivado(m, c, t) {
    const v = m.vida;
    if (t == null) return;
    if (v.privados) delete v.privados[t];
    if (c && c.plan && c.plan.encargos) c.plan.encargos = c.plan.encargos.filter(x => !(x.t === t && x.privado != null));
    // (Sus obreros, si los tenía, vuelven en el acto a su oficio.)
    for (const x of v.aldeanos) if (x.obrero === t) { delete x.obrero; x.enFabrica = 0; x.e = LIBRE; }
  }
  // Quien prestó a un empresario: su banquero, o el banco central si el banquero ya no está.
  const acreedor = (m, e) => (e.banquero != null ? m.vida.aldeanos.find(x => x.id === e.banquero && x.emp && x.emp.neg === 'banco') : null);
  // Los préstamos de un banquero que ya no está pasan al banco central.
  function prestamosAlCentral(m, c, idBanquero) {
    for (const x of empresariosDe(m, c)) if (x.emp.banquero === idBanquero) x.emp.banquero = null;
  }
  // Un negocio que se queda sin quien lo lleve (el heredero ya tiene el suyo): pasa al reino, como sin herederos.
  function cerrarNegocio(m, c, a, e) {
    const v = m.vida;
    if (e.neg === 'banco') { if (c.banca && e.deuda > 0) c.banca.perdido = (c.banca.perdido || 0) + e.deuda; prestamosAlCentral(m, c, a.id); }
    else { const ban = acreedor(m, e); if (e.deuda > 0) { if (ban) ban.emp.perdido = (ban.emp.perdido || 0) + e.deuda; else if (c.banca) c.banca.perdido = (c.banca.perdido || 0) + e.deuda; } }
    const t = e.neg === 'banco' ? e.sede : e.t;
    if (t != null && v.privados && v.privados[t] && v.privados[t].dueno === a.id) olvidarPrivado(m, c, t);
    anunciar(m, c, '🏦 ' + nombreDe(a) + ' muere y su heredero ya tiene su propio negocio: ' + (e.neg === 'banco' ? 'el banco central se queda con sus préstamos' : e.neg === 'fabrica' ? 'su fábrica pasa al reino' : 'el negocio se cierra'));
  }
  function quiebra(m, c, a, porque) {
    const v = m.vida, e = a.emp, b = c.banca;
    if (e.neg === 'banco') {
      if (b && e.deuda > 0) { b.perdido = (b.perdido || 0) + e.deuda; b.quiebras = (b.quiebras || 0) + 1; }
      prestamosAlCentral(m, c, a.id);
      anunciar(m, c, '🏦 Quiebra el banco de ' + nombreDe(a) + (porque ? ' (' + porque + ')' : '') + ': el banco central se queda con sus préstamos.');
    } else {
      const ban = acreedor(m, e);
      if (e.deuda > 0) { if (ban) ban.emp.perdido = (ban.emp.perdido || 0) + e.deuda; else if (b) b.perdido = (b.perdido || 0) + e.deuda; }
      if (b) b.quiebras = (b.quiebras || 0) + 1;
      olvidarPrivado(m, c, e.t);
      anunciar(m, c, '🏦 ' + nombreDe(a) + ' quiebra' + (porque ? ' (' + porque + ')' : '') + (e.neg === 'fabrica' ? ': ' + suEdificio(e) + ' pasa al reino.' : '.'));
    }
    delete a.emp;
  }
  // Muere un banquero, un empresario o un mercader: su negocio (y lo que debe), su gremio, su casona y sus ahorros
  // los hereda un hijo o su pareja; si no hay nadie, pasan al reino (y los préstamos de un banquero, al banco central).
  // Un muelle por familia: si quien recibe un gremio (al heredar, de relevo o comprado) ya tiene muelle en su familia,
  // el que venía con el gremio queda vacío (lo comprará otra casa).
  function soltarMuelleSiSobra(m, c, h, mc) {
    const v = m.vida;
    if (!h || !mc || mc.muelle == null) return;
    const ya = v.aldeanos.some(x => x !== h && x.merc && x.merc !== mc && x.c === h.c && x.familia && x.familia === h.familia && x.merc.muelle != null && v.obra[x.merc.muelle] === OBRA.muelle);
    if (ya) { olvidarPrivado(m, c, mc.muelle); delete mc.muelle; }
  }
  function heredar(m, a, quitar) {
    const v = m.vida, c = S().civ(m, a.c), e = a.emp, mc = a.merc;
    const familia = v.aldeanos.filter(b => b !== a && b.c === a.c && !b.emp && !b.merc && !esNino(b) && !(quitar && quitar.has(b)) && (b.padre === a.id || b.madre === a.id || b.id === a.pareja || b.pareja === a.id));
    const hijo = familia.filter(b => b.padre === a.id || b.madre === a.id).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0], b = hijo || familia[0];
    delete a.emp; delete a.merc;
    // Sin heredero, la sucursal más antigua pasa a ser la casa de la familia (y las otras le mandan a ella).
    if (!b) { const suc = v.aldeanos.filter(x => x.merc && x.merc.de === a.id); if (suc.length) { delete suc[0].merc.de; for (const x of suc.slice(1)) x.merc.de = suc[0].id; } }
    // Sin familia, el gremio no se queda vacío: se lo queda el comerciante del gremio que más ha ahorrado.
    const llena = b && mc && b.familia && b.familia !== a.familia && v.aldeanos.filter(x => x.merc && x.c === a.c && x.familia === b.familia).length >= SUCURSALES + 1;
    const relevo = (!b || llena) && mc && !e && c ? v.aldeanos.filter(x => x.gremio === a.id && x !== a && x.c === a.c && !x.emp && !x.merc && !esNino(x) && !(quitar && quitar.has(x)) && !(x.familia && v.aldeanos.filter(y => y.merc && y.c === a.c && y.familia === x.familia).length >= SUCURSALES + 1)).sort((x, y) => (y.dinero || 0) - (x.dinero || 0) || x.id - y.id)[0] : null;
    if (relevo) {
      relevo.merc = mc; delete mc.de; delete relevo.gremio; mover(relevo, COMERCIANTE); soltarMuelleSiSobra(m, c, relevo, mc);
      if (v.privados) for (const t of Object.keys(v.privados)) if (v.privados[t].dueno === a.id) { if (v.privados[t].tipo === 'gremio' || v.privados[t].tipo === 'casona' || v.privados[t].tipo === 'muelle') { v.privados[t].dueno = relevo.id; delete v.privados[t].sucursal; nombrarPrivado(m, +t, c); } else olvidarPrivado(m, c, +t); }
      for (const x of v.aldeanos) { if (x.gremio === a.id) x.gremio = relevo.id; if (x.merc && x.merc.de === a.id) delete x.merc.de; }
      if (b) { b.dinero = redondo((b.dinero || 0) + (a.dinero || 0)); a.dinero = 0; }
      anunciar(m, c, '🏪 Muere ' + nombreDe(a) + (b ? ': su familia ya tiene casa comercial llena, así que ' : ' sin familia: ') + nombreDe(relevo) + ', comerciante de su gremio, se queda con el negocio');
      return;
    }
    if (b && c && llena) {
      // El heredero es de otra familia que ya tiene la casa comercial llena: se queda con el dinero (y el banco o el
      // negocio, si los había), pero el gremio pasa a un comerciante de otra familia; si no hay nadie, queda vacío.
      const otro = v.aldeanos.filter(x => x.gremio === a.id && x !== a && x !== b && x.c === a.c && !x.emp && !x.merc && !esNino(x) && !(quitar && quitar.has(x)) && !(x.familia && v.aldeanos.filter(y => y.merc && y.c === a.c && y.familia === x.familia).length >= SUCURSALES + 1)).sort((x, y) => (y.dinero || 0) - (x.dinero || 0) || x.id - y.id)[0];
      if (e) { if (b.emp && b.emp !== e) cerrarNegocio(m, c, a, e); else b.emp = e; }
      b.dinero = redondo((b.dinero || 0) + (a.dinero || 0)); a.dinero = 0; if (e) mover(b, COMERCIANTE);
      if (otro) { otro.merc = mc; delete mc.de; delete otro.gremio; mover(otro, COMERCIANTE); soltarMuelleSiSobra(m, c, otro, mc); }
      else if (mc && mc.muelle != null) { olvidarPrivado(m, c, mc.muelle); delete mc.muelle; }
      if (v.privados) for (const t of Object.keys(v.privados)) if (v.privados[t].dueno === a.id) {
        const tipo = v.privados[t].tipo;
        if (tipo === 'gremio' || tipo === 'casona' || tipo === 'muelle') { if (otro) { v.privados[t].dueno = otro.id; delete v.privados[t].sucursal; nombrarPrivado(m, +t, c); } else olvidarPrivado(m, c, +t); }
        else v.privados[t].dueno = b.id;
      }
      for (const x of v.aldeanos) { if (x.gremio === a.id) { if (otro) x.gremio = otro.id; else delete x.gremio; } if (x.emp && x.emp.banquero === a.id) x.emp.banquero = b.id; if (x.merc && x.merc.de === a.id) delete x.merc.de; }
      anunciar(m, c, '🏪 Muere ' + nombreDe(a) + ': ' + nombreDe(b) + ' hereda ' + (e && e.neg === 'banco' ? 'el banco y ' : e ? 'el negocio y ' : '') + 'su dinero, pero su familia ya tiene la casa comercial llena: ' + (otro ? 'el gremio se lo queda ' + nombreDe(otro) : 'el gremio queda vacío y el reino lo venderá'));
      return;
    }
    if (b && c) {
      if (e) { if (b.emp && b.emp !== e) cerrarNegocio(m, c, a, e); else b.emp = e; }
      if (mc) { b.merc = mc; soltarMuelleSiSobra(m, c, b, mc); }
      b.dinero = (b.dinero || 0) + (a.dinero || 0); a.dinero = 0; mover(b, COMERCIANTE);
      if (v.privados) for (const t of Object.keys(v.privados)) if (v.privados[t].dueno === a.id) v.privados[t].dueno = b.id;
      for (const x of v.aldeanos) { if (x.gremio === a.id) x.gremio = b.id; if (x.emp && x.emp.banquero === a.id) x.emp.banquero = b.id; if (x.merc && x.merc.de === a.id) x.merc.de = b.id; }
      anunciar(m, c, (e ? '🏦 ' : '🏪 ') + nombreDe(b) + ' hereda ' + (e && e.neg === 'banco' ? 'el banco' : e ? 'el negocio' : 'el gremio') + ' de ' + nombreDe(a) + (hijo ? '' : ', su pareja') + (e && e.deuda > 0 ? ' (y su deuda)' : ''));
    } else if (c) {
      if (e && e.neg === 'banco') { if (c.banca && e.deuda > 0) c.banca.perdido = (c.banca.perdido || 0) + e.deuda; prestamosAlCentral(m, c, a.id); }
      else if (e) { const ban = acreedor(m, e); if (e.deuda > 0) { if (ban) ban.emp.perdido = (ban.emp.perdido || 0) + e.deuda; else if (c.banca) c.banca.perdido = (c.banca.perdido || 0) + e.deuda; } }
      if (v.privados) for (const t of Object.keys(v.privados)) if (v.privados[t].dueno === a.id) olvidarPrivado(m, c, +t);
      for (const x of v.aldeanos) if (x.gremio === a.id) delete x.gremio;
      anunciar(m, c, '🏦 Muere ' + nombreDe(a) + ' sin herederos' + (e && e.neg === 'fabrica' ? ': ' + suEdificio(e) + ' pasa al reino.' : e && e.neg === 'banco' ? ': el banco central se queda con sus préstamos.' : mc ? ': su gremio y su casa pasan al reino.' : '.'));
    }
  }
  // Los ahorros de quien muere pasan a sus hijos (al más joven de los adultos) o a su pareja.
  function legar(m, a, quitar) {
    const v = m.vida;
    const familia = v.aldeanos.filter(b => b !== a && b.c === a.c && !esNino(b) && !(quitar && quitar.has(b)) && (b.padre === a.id || b.madre === a.id || b.id === a.pareja || b.pareja === a.id));
    const b = familia.filter(x => x.padre === a.id || x.madre === a.id).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0] || familia[0];
    if (b) b.dinero = Math.round(((b.dinero || 0) + a.dinero) * 100) / 100;
    // El hijo de un comerciante con ahorros sigue con el oficio de su padre (así el dinero de la familia acaba en un gremio).
    if (b && a.o === COMERCIANTE && a.dinero >= 3 && pausada(m) && b.o !== COMERCIANTE && !b.emp && !b.merc && !b.fijo && b.obrero == null && b.colono == null && b.aBordo == null && (b.edad || 0) < VIEJO) mover(b, COMERCIANTE);
    a.dinero = 0;
  }
  // Pasar oro entre el tesoro y el banco central (orden del jugador; la IA lo hace sola).
  function moverAlBanco(c, cantidad) {
    const b = c.banca; if (!b) return 0;
    const q = cantidad > 0 ? Math.min(cantidad, Math.max(0, c.oro || 0)) : -Math.min(-cantidad, Math.max(0, b.fondo));
    c.oro = (c.oro || 0) - q; b.fondo += q;
    return q;
  }
  // LOS COMERCIANTES, LOS MERCADERES Y SUS GREMIOS (cada turno, cuentas sencillas).
  const SUCURSALES = 3, PLAZAS_GREMIO = 4;
  const mercaderesDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.merc);
  const gremiosDe = (m, c) => Object.keys(m.vida.privados || {}).filter(t => m.vida.privados[t].civ === c.id && m.vida.privados[t].tipo === 'gremio' && m.vida.obra[t] === OBRA.gremio).map(Number);
  const redondo = x => Math.round(x * 100) / 100;
