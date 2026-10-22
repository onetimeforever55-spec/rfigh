  // ── GÉNESIS · LA VIDA · Sucesos del campo y del mercado, ofertas, carretas y el reparto del trabajo ──

  /*
   * EL CAMPO TIENE SORPRESAS:
   *  · plaga de langostas en verano: devoran los campos sin madurar de un pueblo (y se ven pasar);
   *  · cosecha récord en otoño (un año bueno): durante la estación cada siega rinde la mitad más, y el pueblo
   *    lo celebra con una fiesta de la cosecha en la plaza.
   */
  function sucesosDelCampo(m) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      if ((c.campos || 0) < 8) continue;
      if (v.estacion === 1 && azar(v) < 0.01 && !(c.ultimaPlaga > m.turno - 60)) {
        c.ultimaPlaga = m.turno;
        const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)];
        let n = 0;
        for (const r of zona) for (const t of parcelas(m, r)) if (v.obra[t] === OBRA.campo && v.cultivo[t] >= 1 && v.cultivo[t] < 3 && azar(v) < 0.55) { cambiar(m, 'cultivo', t, 0, 0); n++; }
        if (n) {
          (v.plagas = v.plagas || []).push({ turno: m.turno, regiones: zona });
          S().cronica(m, 'plaga', 'Langostas en ' + c.nombre, 'Una nube de langostas oscurece el cielo y baja sobre los campos de ' + c.nombre + ': en una tarde se comen ' + n + ' sembrados. Habrá que tirar del granero o comprar fuera.', c, c.capital);
          if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🦗 Las langostas devoran ' + n + ' campos' });
        }
      }
      if (v.estacion === 2 && m.turno % 12 === 0 && azar(v) < 0.18) {
        c.cosechaRecord = m.turno;
        c.plan = c.plan || {}; c.plan.ultimaFiesta = m.turno;
        S().cronica(m, 'cosecha', 'Cosecha récord en ' + c.nombre, 'El tiempo ha acompañado todo el año: los graneros de ' + c.nombre + ' no dan abasto y en la plaza se celebra la fiesta de la cosecha, con música, baile y pan recién hecho.', c, c.capital);
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🌾 ¡Cosecha récord! Fiesta en la plaza' });
      }
    }
    if (v.plagas) v.plagas = v.plagas.filter(p => m.turno - p.turno < 3);
  }
  /*
   * SUCESOS DEL MERCADO MUNDIAL (cada tanto): una sequía lejana encarece el grano, un auge de la construcción
   * sube la piedra, una guerra en otras tierras dispara las armas, una flota extranjera inunda el mercado de
   * madera… Duran unos turnos y mueven los precios para todos: quien tenga eso para vender, gana.
   */
  const SUCESOS_MERCADO = [
    { k: 'comida', f: 1.7, titulo: 'Sequía en tierras lejanas', texto: 'Las caravanas cuentan que en el otro lado del mundo no llueve: el grano se paga como nunca.' },
    { k: 'comida', f: 0.6, titulo: 'Años de abundancia en el mundo', texto: 'Todas las cosechas vienen buenas a la vez: el grano sobra y su precio se hunde.' },
    { k: 'madera', f: 0.55, titulo: 'Una flota extranjera trae madera', texto: 'Barcos de tierras desconocidas descargan troncos en todos los puertos: la madera no vale nada.' },
    { k: 'madera', f: 1.6, titulo: 'Fiebre de construir barcos', texto: 'Todos quieren barcos y casas nuevas: la madera se encarece.' },
    { k: 'piedra', f: 1.7, titulo: 'Auge de la construcción', texto: 'Ciudades de todo el mundo levantan murallas y catedrales: la piedra sube.' },
    { k: 'metal', f: 1.5, titulo: 'Se agotan las minas del sur', texto: 'Las grandes minas lejanas se inundan: el metal escasea en todos los mercados.', era: 1 },
    { k: 'metal', f: 0.65, titulo: 'Gran veta descubierta', texto: 'Una veta enorme aparece en tierras lejanas: llega metal barato por todas partes.', era: 1 },
    { k: 'armas', f: 1.8, titulo: 'Guerra en otras tierras', texto: 'Una guerra lejana se lo traga todo: las armas se pagan el doble.', era: 2 }
  ];
  function sucesosDelMercado(m) {
    const v = m.vida, mk = m.mercado, maxEra = Math.max(...S().vivas(m).map(c => c.era));
    if (mk.suceso && m.turno >= mk.suceso.hasta) mk.suceso = null;
    if (mk.suceso || azar(v) > 0.03 || m.turno < 30) return;
    const op = SUCESOS_MERCADO.filter(x => (x.era || 0) <= maxEra);
    const s_ = op[Math.floor(azar(v) * op.length)];
    mk.suceso = { k: s_.k, f: s_.f, titulo: s_.titulo, desde: m.turno, hasta: m.turno + 10 + Math.floor(azar(v) * 10) };
    S().cronica(m, 'comercio', s_.titulo, s_.texto + ' (' + s_.k + (s_.f > 1 ? ' más caro' : ' más barato') + ' durante unos turnos).', null);
    const yo = S().vivas(m).find(c => c.jugador);
    if (yo) (v.anuncios = v.anuncios || []).push({ civ: yo.id, texto: '📈 ' + s_.titulo + ': ' + s_.k + (s_.f > 1 ? ' ▲' : ' ▼') });
  }
  // Ofertas de los mercaderes de tus socios: te lo dejan barato (o te lo compran caro) si contestas a tiempo.
  function ofertasAlJugador(m) {
    const v = m.vida, mk = m.mercado, c = S().vivas(m).find(x => x.jugador);
    if (!c || !c.balance) return;
    if (c.oferta && m.turno > c.oferta.hasta) c.oferta = null;
    if (c.oferta || azar(v) > 0.1) return;
    const socios = sociosDe(m, c).filter(o => o.balance);
    if (!socios.length) return;
    const o = socios[Math.floor(azar(v) * socios.length)];
    const vende = BIENES.filter(k => o.balance.sobra[k] >= 4 && (c.balance.falta[k] >= 1 || (c[k] || 0) < objetivo(c, k) * 1.5));
    const compra = BIENES.filter(k => c.balance.sobra[k] >= 4 && o.balance.falta[k] >= 2);
    if (vende.length && (!compra.length || azar(v) < 0.5)) {
      const k = vende[Math.floor(azar(v) * vende.length)], n = Math.floor(Math.min(o.balance.sobra[k], Math.max(5, c.balance.falta[k] * 1.5), 40)), oro = Math.round(n * mk.precio[k] * 0.75 * 10) / 10;
      if (n >= 3 && (c.oro || 0) >= oro) c.oferta = { tipo: 'venta', de: o.id, que: k, n, oro, hasta: m.turno + 4 };
    } else if (compra.length) {
      const k = compra[Math.floor(azar(v) * compra.length)], n = Math.floor(Math.min(c.balance.sobra[k], Math.max(5, o.balance.falta[k]), 40)), oro = Math.round(n * mk.precio[k] * 1.35 * 10) / 10;
      if (n >= 3 && (o.oro || 0) >= oro) c.oferta = { tipo: 'compra', de: o.id, que: k, n, oro, hasta: m.turno + 4 };
    }
    if (c.oferta) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🤝 ' + o.nombre + (c.oferta.tipo === 'venta' ? ' os ofrece ' + c.oferta.n + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + '🪙' : ' quiere comprar ' + c.oferta.n + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + '🪙') });
  }
  function aceptarOferta(m, c, si) {
    const of = c.oferta, o = of && S().civ(m, of.de);
    if (!of || !o || !o.viva) return { ok: false, texto: 'No hay ningún trato sobre la mesa.' };
    c.oferta = null;
    if (!si) return { ok: true, texto: 'Rechazáis el trato con ' + o.nombre + '. Sus mercaderes se encogen de hombros.' };
    if (of.tipo === 'venta') {
      if ((c.oro || 0) < of.oro || (o[of.que] || 0) < of.n) return { ok: false, texto: 'El trato ya no se puede cerrar: ' + ((c.oro || 0) < of.oro ? 'no tenéis el oro.' : 'a ' + o.nombre + ' ya no le queda.') };
      c.oro -= of.oro; o.oro = (o.oro || 0) + of.oro; o[of.que] -= of.n; c[of.que] = (c[of.que] || 0) + of.n;
      apuntarTrato(m, { t: m.turno, vende: o.id, compra: c.id, que: of.que, n: of.n, oro: of.oro, ruta: 'externa' });
      return { ok: true, texto: 'Trato hecho: llegan ' + of.n + ' de ' + of.que + ' de ' + o.nombre + ' por ' + Math.round(of.oro) + ' de oro (más barato que en el mercado).' };
    }
    if ((c[of.que] || 0) < of.n || (o.oro || 0) < of.oro) return { ok: false, texto: 'El trato ya no se puede cerrar.' };
    c[of.que] -= of.n; o[of.que] = (o[of.que] || 0) + of.n; o.oro -= of.oro; c.oro = (c.oro || 0) + of.oro; (c.ganado = c.ganado || {})[of.que] = (c.ganado[of.que] || 0) + of.oro;
    apuntarTrato(m, { t: m.turno, vende: c.id, compra: o.id, que: of.que, n: of.n, oro: of.oro, ruta: 'externa' });
    return { ok: true, texto: 'Trato hecho: vendéis ' + of.n + ' de ' + of.que + ' a ' + o.nombre + ' por ' + Math.round(of.oro) + ' de oro (bien por encima del mercado).' };
  }
  // Un comerciante sale de casa: carga lo que al otro reino le hace falta y a su pueblo le sobra.
  const capacidad = c => Math.round((6 + 3 * c.era) * (1 + M.tec(c, 'comercio')) * (c.estaciones > 0 && enMarcha(c, 'tren') ? 2 : 1));
  // «bodega»: cuánto más carga que una carreta (un mercante lleva el triple; un vapor, cinco veces).
  const bodegaDe = c => (c.era >= 6 ? 5 : 3);
  // El reino del jugador solo comercia con lo que él diga («comprad hierro», «vended madera»), salvo que
  // mande «comerciad libremente»; los de la IA, con todo lo que les sobra y les falta.
  // Qué bienes: con sus socios, los comerciantes compran y venden solos según convenga (salvo que el jugador diga
  // «comerciad solo lo que yo diga»: entonces solo lo que mande). Con quién, siempre lo decide el jugador.
  const comercioLibre = x => !x.jugador || !(x.plan && x.plan.comercioLibre === false);
  /*
   * ¿PUEDEN COMERCIAR c Y o? Nunca en guerra. Y los dos tienen que permitirlo: un reino de la IA comercia con quien
   * quiera (salvo con quien le haya cerrado el comercio); el reino de un jugador, solo con quien él haya abierto
   * comercio («abrid una ruta comercial con X»), y nunca con quien haya
   * prohibido («cerrad el comercio con X»). Vale para las carretas, los barcos, el mercado y los mercaderes.
   */
  const permiteComercio = (c, o) => { const p = c.plan || {}; if ((p.embargo || []).includes(o.id)) return false; return !c.jugador || (p.socios || []).includes(o.id); };
  const comercian = (m, c, o) => !!(c && o && c !== o && c.viva && o.viva && !S().enGuerra(c, o) && permiteComercio(c, o) && permiteComercio(o, c));
  // Cuánto de un bien le puede vender o a c: lo que le sobra o, si c lo encargó, también de su reserva (se queda la mitad
  // de lo que necesita).
  const vendible = (m, o, c, k) => { if (!o.balance) return 0; const encargado = ((c.plan && c.plan.pedidos) || []).some(y => y.que === k); return Math.max(o.balance.sobra[k] || 0, encargado ? Math.max(0, Math.floor((o[k] || 0) - objetivo(o, k) * 0.5)) : 0); };
  // ¿Le sirve a c ir a comerciar con o? Si tiene algo encargado que o le puede vender.
  const sirveSocio = (m, c, o) => ((c.plan && c.plan.pedidos) || []).some(y => vendible(m, o, c, y.que) >= 1);
  // Lo que un reino tiene encargado de un bien y aún no ha recibido.
  const encargoDe = (c, k) => ((c.plan && c.plan.pedidos) || []).filter(y => y.que === k).reduce((q, y) => q + y.n, 0);
  const vendeBien = (x, k) => comercioLibre(x) || !!(x.plan && (x.plan.ventas || []).some(y => y.que === k));
  const compraBien = (x, k) => comercioLibre(x) || !!(x.plan && (x.plan.pedidos || []).some(y => y.que === k));
  // Con quién comercia un reino: rutas por tierra, tratados, puertos en el mismo mar y tratos recientes.
  function sociosDe(m, c) {
    const v = m.vida, ids = new Set();
    for (const ru of (v && v.rutas) || []) if (ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)) ids.add(ru.a === c.id ? ru.b : ru.a);
    for (const id of (c.plan && c.plan.socios) || []) ids.add(id);
    for (const o of S().vivas(m)) if (o.plan && (o.plan.socios || []).includes(c.id)) ids.add(o.id);
    for (const x of (m.mercado && m.mercado.tratos) || []) if (m.turno - (x.t || 0) <= 60 && (x.vende === c.id || x.compra === c.id)) ids.add(x.vende === c.id ? x.compra : x.vende);
    if ((c.puertos || 0) > 0) for (const o of S().vivas(m)) if (o.id !== c.id && !ids.has(o.id) && (o.puertos || 0) > 0 && (o.rel[c.id] || 0) >= 0 && porMar(m, c, o)) ids.add(o.id);
    ids.delete(c.id);
    return [...ids].map(id => S().civ(m, id)).filter(o => comercian(m, c, o));
  }
  function cargar(m, a, c, o, bodega) {
    const mk = m.mercado; if (!mk || !c.balance || !o.balance) return;
    const cap = Math.round(capacidad(c) * (bodega || 1));
    let mejor = null, mv = 0;
    for (const k of BIENES) {
      // Lo que el jugador puso a la venta se coloca aunque al otro no le haga mucha falta (más barato).
      if (!vendeBien(c, k) || !compraBien(o, k)) continue;
      const enVenta = c.plan && (c.plan.ventas || []).some(x => x.que === k);
      let quiere = o.balance.falta[k] || (enVenta && (o[k] || 0) < objetivo(o, k) * 2 ? Math.max(4, objetivo(o, k)) : 0);
      // A un reino de jugador solo se le lleva lo que encargó (y no más de lo que le queda por recibir).
      if (o.jugador && !comercioLibre(o)) quiere = Math.min(quiere, encargoDe(o, k));
      const q = Math.min(c.balance.sobra[k], quiere, Math.floor(c[k] || 0), k === 'vehiculos' ? 2 : k === 'armas' ? Math.ceil(cap / 3) : cap);
      if (q < 1) continue;
      const val = q * mk.precio[k] * (1 + o.balance.urg[k]);
      if (val > mv) { mv = val; mejor = [k, Math.floor(q)]; }
    }
    if (mejor) { a.carga = { que: mejor[0], n: mejor[1], de: c.id }; c[mejor[0]] -= mejor[1]; c.balance.sobra[mejor[0]] -= mejor[1]; }
  }
  // Llega a destino: vende la carga (lo que el otro pueda pagar) y, con oro de su pueblo, compra lo que falta en casa.
  function venderComprar(m, a, c, o, bodega, via) {
    const mk = m.mercado, v = m.vida; if (!mk) return;
    const tratos = [];
    if (a.carga && a.carga.de === c.id) {
      const k = a.carga.que, urg = o.balance ? o.balance.urg[k] : 0, precio = mk.precio[k] * (urg > 0 ? 1 + 0.5 * Math.min(1.6, urg) : 0.7);
      const q = Math.min(a.carga.n, Math.floor(Math.max(0, o.oro || 0) / precio), o.jugador && !comercioLibre(o) ? encargoDe(o, k) : Infinity);
      if (q > 0) {
        const oro = Math.round(q * precio * 10) / 10;
        o[k] = (o[k] || 0) + q; o.oro -= oro; c.oro = (c.oro || 0) + oro; c.comercioOro = (c.comercioOro || 0) + oro;
        (c.ganado = c.ganado || {})[k] = (c.ganado[k] || 0) + oro;
        o.importa = o.importa || {}; o.importa[k] = (o.importa[k] || 0) + q;
        quitarPedido(o, k, q); quitarVenta(c, k, q);
        tratos.push({ t: m.turno, vende: c.id, compra: o.id, que: k, n: q, oro });
        a.carga.n -= q;
      }
      if (a.carga.n <= 0) a.carga = null;
    }
    // La vuelta: lo que más prisa le corre a su pueblo y al otro le sobra, si hay oro para pagarlo.
    if (!a.carga && c.balance && o.balance) {
      const cap = Math.round(capacidad(c) * (bodega || 1));
      let mejor = null, mv = 0;
      for (const k of BIENES) {
        if (!vendeBien(o, k) || !compraBien(c, k)) continue;
        // Lo que se encargó («comprad 10 de metal»): el otro vende también de su reserva (se queda con la mitad de lo que
        // necesita), pero más caro, porque lo saca de lo suyo. Si no, solo lo que le sobra.
        const disponible = vendible(m, o, c, k);
        const precio = mk.precio[k] * (1 + 0.3 * Math.min(1.6, c.balance.urg[k])) * (disponible > (o.balance.sobra[k] || 0) ? 1.4 : 1);
        // (Del encargo, solo lo que falta por comprar: lo que ya viene de camino ya se descontó.)
        const pedido = ((c.plan && c.plan.pedidos) || []).find(y => y.que === k), resta = c.jugador && pedido ? pedido.n : Infinity;
        const q = Math.min(disponible, resta, Math.floor(o[k] || 0), c.balance.falta[k], Math.floor(Math.max(0, (c.oro || 0) * 0.6) / precio), k === 'vehiculos' ? 2 : k === 'armas' ? Math.ceil(cap / 3) : cap);
        if (q < 1 || c.balance.urg[k] < 0.25) continue;
        const val = c.balance.urg[k] * q;
        if (val > mv) { mv = val; mejor = [k, Math.floor(q), precio]; }
      }
      if (mejor) {
        const [k, q, precio] = mejor, oro = Math.round(q * precio * 10) / 10;
        o[k] -= q; o.balance.sobra[k] = Math.max(0, (o.balance.sobra[k] || 0) - q); c.oro -= oro; o.oro = (o.oro || 0) + oro; o.comercioOro = (o.comercioOro || 0) + oro;
        (o.ganado = o.ganado || {})[k] = (o.ganado[k] || 0) + oro;
        a.carga = { que: k, n: q, de: o.id, para: c.id };
        if (((c.plan && c.plan.pedidos) || []).some(y => y.que === k)) { a.carga.encargo = 1; quitarPedido(c, k, q); }
        quitarVenta(o, k, q);
        tratos.push({ t: m.turno, vende: o.id, compra: c.id, que: k, n: q, oro });
      }
    }
    const ru = via ? null : v.rutas.find(x => x.id === a.ruta);
    for (const x of tratos) { x.ruta = via || (ru ? ru.tipo : null); apuntarTrato(m, x); }
  }
  // Si muere quien lleva una carreta (de viejo, en una batalla, en un incendio…), la carga no se pierde: lo comprado
  // llega igual a su pueblo y lo que no vendió vuelve a su almacén. Se mira lo que llevaba cada uno al acabar el turno
  // anterior (v.cargas: así va igual en las dos copias de una partida en línea).
  function rescatarCargas(m) {
    const v = m.vida, vivos = new Map(v.aldeanos.map(a => [a.id, a]));
    for (const id of Object.keys(v.cargas || {})) {
      if (vivos.has(+id)) continue;
      const k = v.cargas[id], c = S().civ(m, k.c);
      if (!c || !c.viva) continue;
      descargar(m, { carga: k.carga, tipo: null, rescate: 1 }, c);
    }
    v.cargas = {};
    for (const a of v.aldeanos) if (a.carga) v.cargas[a.id] = { c: a.c, carga: Object.assign({}, a.carga) };
  }
  // De vuelta en casa: se descarga lo comprado fuera.
  function descargar(m, a, c) {
    if (!a.carga) return;
    if (a.carga.para === c.id && c.jugador && a.carga.encargo) { const o = S().civ(m, a.carga.de); (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '📦 Llegan ' + Math.round(a.carga.n) + ' de ' + (NOMBRE_BIEN[a.carga.que] || a.carga.que) + (o ? ' de ' + o.nombre : '') + (a.tipo ? ' en barco' : ' en carreta') + (a.rescate ? ' (el carretero murió en el camino, pero la carga llegó)' : '') }); }
    if (a.carga.para === c.id) { c[a.carga.que] = (c[a.carga.que] || 0) + a.carga.n; c.importa = c.importa || {}; c.importa[a.carga.que] = (c.importa[a.carga.que] || 0) + a.carga.n; if (!a.carga.encargo) quitarPedido(c, a.carga.que, a.carga.n); }
    else if (a.carga.de === c.id) c[a.carga.que] = (c[a.carga.que] || 0) + a.carga.n; // lo que no se vendió vuelve al almacén
    a.carga = null;
  }
  function quitarPedido(c, k, q) { const p = c.plan; if (!p || !p.pedidos) return; for (const x of p.pedidos) if (x.que === k && q > 0) { const d = Math.min(x.n, q); x.n -= d; q -= d; } p.pedidos = p.pedidos.filter(x => x.n > 0); }
  function quitarVenta(c, k, q) { const p = c.plan; if (!p || !p.ventas) return; for (const x of p.ventas) if (x.que === k && q > 0) { const d = Math.min(x.n, q); x.n -= d; q -= d; } p.ventas = p.ventas.filter(x => x.n > 0); }
  function apuntarTrato(m, x) {
    const v = m.vida, mk = m.mercado;
    (mk.tratos = mk.tratos || []).push(x); if (mk.tratos.length > 60) mk.tratos.shift();
    const a = S().civ(m, x.vende), b = S().civ(m, x.compra);
    if (!a || !b) return;
    // Para el jugador, un solo aviso por turno con todo lo comprado y vendido.
    for (const c of [a, b]) if (c.jugador) {
      const r = (v.resumenTratos = v.resumenTratos || {})[c.id] = v.resumenTratos[c.id] || { entra: {}, sale: {}, oro: 0 };
      if (c === b) { r.entra[x.que] = (r.entra[x.que] || 0) + x.n; r.oro -= x.oro; } else { r.sale[x.que] = (r.sale[x.que] || 0) + x.n; r.oro += x.oro; }
    }
  }
  const PRIO_OFICIO = ['madera', 'comida', 'casas', 'piedra', 'ejercito', 'riqueza', 'ciencia'];
  const prio = (c, k) => (c.plan && c.plan.prioridad && c.plan.prioridad[k] != null ? c.plan.prioridad[k] : 1);
  const metaMadera = c => 30 + 12 * c.era;
  function reparto(c, recursos) {
    const guerra = c.guerras.length > 0;
    const lleno = c.cap ? c.pob / c.cap : 0.8;
    // Lo que traen los socios cuenta como si estuviera en el almacén: quien compra fuera produce menos.
    const imp = c.importa || {}, madera = (c.madera || 0) + (imp.madera || 0) * 3, comida = (c.comida || 0) + (imp.comida || 0) * 3;
    const p = [
      recursos.arboles ? 0.18 + 0.4 * Math.max(0, 1 - madera / metaMadera(c)) : 0,
      0.22 + Math.max(0, lleno - 0.75) * 1.6 + ((c.campos || 0) < metaCampos(c) ? 0.08 : 0) + 0.4 * Math.max(0, 1 - comida / Math.max(6, (c.habitantes || 10) * 1.5)) +
        // Antes del invierno se hace acopio: en verano y otoño, más gente al campo si el granero no da para tres meses.
        (c.estacion === 1 || c.estacion === 2 ? 0.3 * Math.max(0, 1 - (c.comida || 0) / Math.max(10, (c.aldeanos || 10) * 3)) : 0),
      // (Con una obra encargada por el jugador, siempre hay alguien construyendo.)
      (faltanCamas(c) ? 0.2 : 0.06) + (c.jugador && c.plan && (c.plan.obra || (c.plan.encargos || []).length) ? 0.14 : 0),
      recursos.rocas ? (c.era >= 1 ? 0.08 + ((c.piedra || 0) < 20 ? 0.06 : 0) + ((c.metal || 0) < 10 ? 0.08 : 0) : 0.04) : 0,
      guerra ? 0.6 : c.era >= 2 ? 0.07 : 0.04,
      // Un comerciante por cada ruta abierta, más o menos.
      Math.min(0.2, 0.06 * (c.rutas || 0)),
      // Eruditos: pocos en una tribu (un chamán), más con templo, escritura y ciudades; los pueblos sabios, más.
      // (Ahora son los que investigan las mejoras: siempre hay alguno, y más cuanto más avanzado el pueblo.)
      (c.aldeanos || 0) < 8 ? 0.06 : 0.075 + 0.012 * c.era + ((c.templos || 0) > 0 ? 0.02 : 0) + (c.caracter === 'sabio' || c.caracter === 'devoto' ? 0.03 : 0)
    ];
    // La especialidad del reino: produce de más de lo suyo para venderlo, y algún comerciante más si tiene socios.
    // La cartera: cada bien en el que trabaja el reino sube el oficio que lo produce, según su peso.
    if (c.cartera && c.balance) {
      const of = { madera: 0, comida: 1, piedra: 3, metal: 3, armas: 3, carbon: 3 }, extra = [0, 0, 0, 0, 0, 0, 0];
      for (const k of Object.keys(c.cartera)) if (of[k] != null) extra[of[k]] += c.cartera[k];
      for (let i = 0; i < 4; i++) if (extra[i]) p[i] = p[i] * (1 + 0.8 * extra[i]) + 0.07 * extra[i];
      if ((c.rutas || 0) > 0) p[5] += 0.04;
    }
    // Lo que aún se debe del paso de edad se saca primero (si no, el paso espera para siempre: en una partida, 300 turnos
    // «pasando al Renacimiento» por 1 de metal, con 90 granjeros y ningún minero).
    const debe = (c.subiendo && c.subiendo.debe) || {}, debeMina = (debe.metal > 0 || debe.piedra > 0) && recursos.rocas;
    if (debeMina) p[3] += 0.35;
    if (debe.madera > 0 && recursos.arboles) p[0] += 0.25;
    if (debe.comida > 0) p[1] += 0.25;
    const faltan = faltanCamas(c), maxW = Math.max(...PRIO_OFICIO.map(k => (k ? prio(c, k) : 0)));
    for (let i = 0; i < p.length; i++) {
      // Los mineros sacan piedra, metal y carbón: pesa la mayor de las tres prioridades.
      const pr_ = (c.plan && c.plan.prioridad) || {}, w = i === 3 ? Math.max(prio(c, 'piedra'), pr_.metal != null ? pr_.metal : 0, c.era >= 6 && pr_.carbon != null ? pr_.carbon : 0) : prio(c, PRIO_OFICIO[i]);
      // Lo que el jugador pone al máximo pesa siempre, aunque el almacén esté lleno.
      if (w >= 2 && (i !== 0 || recursos.arboles) && (i !== 3 || recursos.rocas)) p[i] = Math.max(p[i], 0.25);
      // (Con hambre, la gente vuelve al campo aunque se haya mandado «menos comida»: nadie se deja morir de hambre.)
      // (Y si falta dónde dormir, se construyen casas aunque se hayan subido otras prioridades: si no, el pueblo no
      // crece nunca. En una partida, con «más ciencia, comida, piedra y madera», no había constructores: 30 vecinos
      // durante 300 turnos.)
      const wc = i === 1 && w < 0.6 && (c.comida || 0) < (c.habitantes || c.aldeanos || 10) * 2 ? 0.6
        : i === 2 && faltan && w > 0 ? Math.max(w, maxW * 0.8)
        : i === 3 && debeMina ? Math.max(w, maxW * 0.8, 0.6) : w;
      p[i] *= wc === 0 ? 0.03 : wc;
    }
    const suma = p.reduce((k, x) => k + x, 0) || 1;
    return p.map(x => x / suma);
  }

  // Las casas (y plazas) de un pueblo: donde nacen sus niños.
  function casasDe(m, c) {
    const v = m.vida, out = [];
    for (let t = 0; t < v.obra.length; t++) { const o = v.obra[t]; if ((o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento || o === OBRA.campamento) && m.dueno[region(m, t)] === c.id) out.push(t); }
    return out;
  }
  // LA MUDANZA: la capital es la ciudad grande, pero no se lo queda todo. Si tiene más de la mitad de la gente del
  // reino, una familia joven (con sus hijos) se muda a la provincia más pequeña: allí sus constructores levantan casas
  // y sus granjeros, campos. Si se queda con menos de la cuarta parte, una familia de la provincia más grande se va a la
  // capital. Y entre provincias, de la que ha crecido el doble a la que se ha quedado atrás.
  function mudanza(m, c, lista) {
    const v = m.vida, ciudades = (m.ciudades || []).filter(x => x.civ === c.id && m.dueno[x.region] === c.id).map(x => x.region);
    if (!ciudades.length) return;
    const pob = new Map([[c.capital, 0], ...ciudades.map(r => [r, 0])]);
    for (const a of lista) if (pob.has(a.h)) pob.set(a.h, pob.get(a.h) + 1);
    const total = [...pob.values()].reduce((k, x) => k + x, 0), enCapital = pob.get(c.capital);
    const orden = S().ordenarPor(ciudades.slice(), r => pob.get(r) * 1e6 + r), chica = orden[0], grande = orden[orden.length - 1];
    let de = null, a_ = null;
    if (enCapital >= 30 && enCapital > total * 0.5 && enCapital > 2 * (pob.get(chica) + 6)) { de = c.capital; a_ = chica; }
    else if (enCapital < total * 0.25 && pob.get(grande) > enCapital + 6) { de = grande; a_ = c.capital; }
    // Entre provincias: de la que ha crecido mucho a la que se ha quedado atrás.
    else if (grande !== chica && pob.get(grande) >= 30 && pob.get(grande) > 2 * (pob.get(chica) + 6)) { de = grande; a_ = chica; }
    if (de == null) return;
    const libre = a => a.h === de && a.colono == null && a.aBordo == null && !a.fijo && !a.emp && !a.merc && a.o !== GUERRERO && a.o !== ERUDITO && (a.edad || 0) >= ADULTO && (a.edad || 0) < VIEJO - 10;
    const sinObrero = !lista.some(a => a.h === a_ && a.o === CONSTRUCTOR);
    const quien = S().ordenarPor(lista.filter(libre), a => (sinObrero && a.o === CONSTRUCTOR ? 0 : 1) * 1e9 + (a.edad || 0) * 1e5 + (a.id % 1e5))[0];
    if (!quien) return;
    const pareja = lista.find(b => b.id === quien.pareja && libre(b));
    const familia = [quien, ...(pareja ? [pareja] : []), ...lista.filter(b => esNino(b) && b.h === de && (b.padre === quien.id || b.madre === quien.id))];
    // (La casa nueva se la busca el reparto de casas, en su pueblo nuevo.)
    for (const b of familia) { b.h = a_; b.casa = null; b.e = LIBRE; b.paseo = 0; }
  }
  function hogar(m, c, cs) {
    const v = m.vida;
    if (azar(v) < 0.4 || cs.length < 2) return c.capital;
    const suyas = (m.ciudades || []).filter(x => x.civ === c.id);
    if (suyas.length && azar(v) < 0.4) return suyas[Math.floor(azar(v) * suyas.length)].region;
    return cs[Math.floor(azar(v) * cs.length)];
  }
