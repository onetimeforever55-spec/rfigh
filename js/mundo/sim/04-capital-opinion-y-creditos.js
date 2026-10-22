  // ── GÉNESIS · EL MUNDO · Cae la capital, la opinión entre reinos y los créditos ──

  /*
   * CAE LA CAPITAL. Un reino no se reinventa en mitad del campo: si le queda otra ciudad, la corte huye allí
   * (saqueada, revuelta y con las demás ciudades pensando en irse); si no le queda ninguna, el reino cae y el
   * conquistador se queda con sus tierras.
   */
  function perderCapital(m, c, cs) {
    const dueno = civ(m, m.dueno[c.capital]), gana = dueno && dueno.viva && dueno !== c ? dueno : null;
    if (!cs.length) morir(m, c, gana);
    else if (m.vida) caidaCapital(m, c, gana, cs);
    else c.capital = cs.sort((a, b) => fertil(m, b) - fertil(m, a))[0];
  }
  function caidaCapital(m, c, gana, cs) {
    const vieja = c.capital;
    if (gana) repartirAlmacen(c, gana, 0.5);
    suceso(m, 'saqueo', vieja, gana, c, '💰 ¡' + (gana ? gana.nombre + ' saquea' : 'Saqueo de') + ' la capital de ' + c.nombre + '!');
    if (m.vida && M.vida && M.vida.saquear) M.vida.saquear(m, vieja);
    const ciudades = (m.ciudades || []).filter(x => x.civ === c.id && m.dueno[x.region] === c.id);
    if (!ciudades.length) {
      for (const i of cs) m.dueno[i] = gana ? gana.id : -1;
      morir(m, c, gana);
      return;
    }
    const x = ciudades.sort((p, q) => distancia(p.region, vieja) - distancia(q.region, vieja))[0];
    c.capital = x.region; c.mudada = vieja;
    m.ciudades = m.ciudades.filter(y => y !== x);
    c.estab = Math.max(0, c.estab - 25);
    for (const y of ciudades) if (y !== x) y.complot = (y.complot || 0) + 35;
    suceso(m, 'huye', x.region, c, gana, '🏃 La corte de ' + c.nombre + ' huye a ' + x.nombre);
    cronica(m, 'conquista', 'La corte de ' + c.nombre + ' huye a ' + x.nombre, (gana ? gana.nombre + ' saquea la capital y se lleva la mitad de los almacenes. ' : 'La capital se pierde. ') + 'El ' + titulo(c) + ' se refugia en ' + x.nombre + ', que pasa a ser la capital; las demás ciudades dudan de que el reino aguante.', c, x.region, { importante: true });
  }

  // ---------- Las relaciones entre pueblos ----------
  /*
   * LA OPINIÓN ENTRE REINOS, como en WorldBox: cada uno tiene una opinión objetivo hecha de motivos
   * concretos (compartir frontera, un enemigo común, el carácter del pueblo, el talante de los reyes, las
   * guerras recientes, los tratados) y la opinión real se acerca a ella poco a poco.
   */
  function motivos(m, a, b) {
    const out = [];
    const juntos = vecinosDe(m, a).includes(b);
    out.push(juntos ? ['comparten frontera', -25] : ['no comparten frontera', 10]);
    if (a.guerras.some(g => b.guerras.some(h => h.con === g.con)) && !enGuerra(a, b)) out.push(['enemigo común', 50]);
    out.push(a.caracter === b.caracter ? ['mismo carácter (' + M.CARACTERES[a.caracter].nombre + ')', 15] : ['costumbres distintas', -5]);
    const talante = x => (x.rey ? propio({ pacifico: 10, justo: 5, guerrero: -10, cruel: -10, loco: -15 }, x.rey.rasgo) : 0);
    if (talante(a) + talante(b)) out.push(['el talante de sus gobernantes', talante(a) + talante(b)]);
    if (aliados(m, a, b)) out.push(['son aliados', 30]);
    if ((a.plan && (a.plan.socios || []).includes(b.id)) || (b.plan && (b.plan.socios || []).includes(a.id))) out.push(['tratado de comercio', 20]);
    if (m.vida && (m.vida.rutas || []).some(r => r.tipo === 'externa' && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)))) out.push(['ruta comercial', 15]);
    if (Math.abs(a.era - b.era) >= 2) out.push(['los ven como bárbaros (otra época)', -10]);
    const t = (m.memoria || {})[Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id)];
    if (t != null && m.turno - t < 15) out.push(['guerra reciente', -Math.round(40 * (1 - (m.turno - t) / 15))]);
    if (enGuerra(a, b)) out.push(['están en guerra', -60]);
    if (b.atrocidad != null && m.turno - b.atrocidad < 300) out.push(['exterminó a un pueblo', -Math.round(60 * (1 - (m.turno - b.atrocidad) / 300))]);
    // Las deudas: a quien te prestó cuando hacía falta se le tiene aprecio; a quien no te paga, no tanto.
    for (const cr of m.creditos || []) {
      if (cr.a === a.id && cr.de === b.id) out.push(['nos prestó oro cuando hacía falta', 20]);
      if (cr.de === a.id && cr.a === b.id && (cr.atraso || 0) > 6) out.push(['no nos devuelve lo que le prestamos', -12]);
    }
    const perdon = (m.perdones || {})[b.id + '>' + a.id];
    if (perdon != null && m.turno - perdon < 200) out.push(['nos perdonó una deuda', Math.round(30 * (1 - (m.turno - perdon) / 200))]);
    return out;
  }
  const opinionObjetivo = (m, a, b) => motivos(m, a, b).reduce((k, x) => k + x[1], 0);

  /*
   * LOS CRÉDITOS ENTRE REINOS (con banco, desde el Renacimiento): van de banco central a banco central. El oro sale
   * del banco central de quien presta y entra en el tesoro de quien lo recibe (que lo gasta como quiera); se devuelve
   * a plazos, con un interés suave, al banco central que prestó (m.creditos). Mientras debe, aprecia a quien le prestó; si no paga, se enfría la cosa.
   * Se puede perdonar la deuda (y eso se recuerda). La IA presta a sus amigos en apuros.
   */
  const INTERES_CREDITO = 0.1, PLAZOS = 20;
  function deudas(m, c) { return (m.creditos || []).filter(cr => cr.a === c.id); }
  function prestar(m, de, a, oro) {
    oro = Math.round(oro);
    if (!de || !a || !de.viva || !a.viva || de === a) return { ok: false, texto: 'No hay a quién prestar.' };
    if (!(de.bancos > 0)) return { ok: false, texto: 'Para prestar a otro reino hace falta un banco (llega con el Renacimiento).' };
    if (enGuerra(de, a)) return { ok: false, texto: 'No se presta oro a un reino con el que estás en guerra.' };
    const fondo = de.banca ? de.banca.fondo : 0;
    if (oro < 5 || fondo < oro) return { ok: false, texto: 'El banco central no tiene tanto: hay ' + Math.round(fondo) + ' de oro.' + ((de.oro || 0) > oro ? ' Pasad oro del tesoro al banco central («pasad ' + oro + ' de oro al banco central»).' : '') };
    de.banca.fondo -= oro; a.oro = (a.oro || 0) + oro;
    const total = Math.round(oro * (1 + INTERES_CREDITO) * 10) / 10;
    (m.creditos = m.creditos || []).push({ de: de.id, a: a.id, prestado: oro, resta: total, cuota: Math.max(1, Math.round(total / PLAZOS * 10) / 10), desde: m.turno, atraso: 0 });
    a.rel[de.id] = (a.rel[de.id] || 0) + 15;
    if (de.jugador || a.jugador || oro >= 40) cronica(m, 'comercio', de.nombre + ' presta ' + oro + ' de oro a ' + a.nombre, a.nombre + ' lo devolverá a plazos, con un poco de interés. Mientras tanto, mira con buenos ojos a quien le ayudó.', de, a.capital);
    return { ok: true, texto: 'Vuestro banco central presta ' + oro + ' de oro a ' + a.nombre + ' (entra en su tesoro). Lo devolverá en unos ' + PLAZOS + ' plazos (' + total + ' en total). Mientras os deba, os tendrá aprecio.' };
  }
  function perdonar(m, de, a) {
    const lista = (m.creditos || []).filter(cr => cr.de === de.id && cr.a === a.id);
    if (!lista.length) return { ok: false, texto: a.nombre + ' no os debe nada.' };
    const resto = lista.reduce((k, cr) => k + cr.resta, 0);
    m.creditos = m.creditos.filter(cr => !lista.includes(cr));
    (m.perdones = m.perdones || {})[de.id + '>' + a.id] = m.turno;
    a.rel[de.id] = (a.rel[de.id] || 0) + 20;
    cronica(m, 'paz', de.nombre + ' perdona la deuda de ' + a.nombre, 'Le quedaban por pagar ' + Math.round(resto) + ' de oro. ' + a.nombre + ' no lo olvidará.', de, a.capital);
    return { ok: true, texto: 'Perdonáis a ' + a.nombre + ' los ' + Math.round(resto) + ' de oro que os debía. Os lo agradecerá durante mucho tiempo.' };
  }
  function pagarCreditos(m) {
    const lista = m.creditos || [];
    for (const cr of lista) {
      const de = civ(m, cr.de), a = civ(m, cr.a);
      if (!de || !a || !de.viva || !a.viva) { cr.fin = 1; continue; }
      if (m.turno % 2) continue;
      const q = Math.min(cr.resta, cr.cuota);
      if ((a.oro || 0) >= q + 3) { a.oro -= q; if (de.banca) de.banca.fondo += q; else de.oro = (de.oro || 0) + q; cr.resta = Math.round((cr.resta - q) * 100) / 100; cr.atraso = Math.max(0, (cr.atraso || 0) - 1); if (cr.resta <= 0.01) { cr.fin = 1; if (de.jugador || a.jugador) cronica(m, 'comercio', a.nombre + ' termina de pagar su deuda con ' + de.nombre, 'Devolvió todo lo prestado, con su interés.', a, a.capital); } }
      else cr.atraso = (cr.atraso || 0) + 1;
    }
    m.creditos = lista.filter(cr => !cr.fin);
    // La IA presta a sus amigos en apuros (sin oro y en guerra, o recién vencidos).
    if (m.turno % 12 === 5) {
      for (const de of vivas(m)) {
        if (de.jugador || !(de.bancos > 0) || !de.banca || de.banca.fondo < 50) continue;
        // (A un jugador, nunca por su cuenta: el préstamo lo pide él con «pedid un préstamo a X».)
        const necesitado = vivas(m).find(a => a !== de && !a.jugador && (a.oro || 0) < 8 && (a.guerras.length || a.estab < 40) && !enGuerra(de, a) && ((de.rel[a.id] || 0) >= 40 || aliados(m, de, a)) && !(m.creditos || []).some(cr => cr.de === de.id && cr.a === a.id));
        if (necesitado) prestar(m, de, necesitado, Math.min(40, de.banca.fondo * 0.4));
      }
    }
  }
  function diplomacia(m) {
    const lista = vivas(m);
    m.complots = (m.complots || []).filter(p => { const a = civ(m, p.de), b = civ(m, p.contra); return a && a.viva && b && b.viva; });
    for (const a of lista) {
      const vec = vecinosDe(m, a);
      for (const b of lista) {
        if (a.id >= b.id) continue;
        const juntos = vec.includes(b);
        let r = a.rel[b.id] || 0;
        r += (opinionObjetivo(m, a, b) - r) * 0.15 + (azar(m) - 0.5) * 3;
        a.rel[b.id] = b.rel[a.id] = Math.max(-100, Math.min(100, r));
        if (aliados(m, a, b)) { if (r < 0) romper(m, a, b); continue; }
        if (a.jugador || b.jugador || enGuerra(a, b)) continue;
        // Los complots: las guerras y las alianzas se traman antes de pasar (y se ven venir).
        if (r > 25 && aliadosDe(m, a).length < 2 && aliadosDe(m, b).length < 2 && azar(m) < 0.15) tramar(m, 'alianza', a, b);
        // Sin frontera por tierra, también se puede ir a la guerra por mar (si hay puertos y una ruta entre ellos).
        const porMar = !juntos && m.vida && M.vida && M.vida.porMar && M.vida.porMar(m, a, b);
        if (!juntos && !porMar) continue;
        const fa = fuerza(m, a), fb = fuerza(m, b);
        const [agresor, victima, fAg, fVi] = fa >= fb ? [a, b, fa, fb] : [b, a, fb, fa];
        const ganas = M.CARACTERES[agresor.caracter].agresion * rasgo(agresor, 'agresion') * (fAg / fVi) * (r < -30 ? 1.6 : 1) * (agresor.estab > 30 ? 1 : 0.4);
        if (!agresor.jugador && agresor.guerras.length < 2 && (r < -40 || (ganas > 2.2 && r < 10)) && azar(m) < (porMar ? 0.04 : 0.08)) { const motivo = casusBelli(m, agresor, victima, r, fAg / fVi); if (motivo) tramar(m, 'guerra', agresor, victima, motivo); }
      }
    }
    avanzarComplots(m);
  }
