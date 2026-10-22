  // ── GÉNESIS · LA VISTA · El tiempo, las batallas, los retos y el final ──

  // ---------- El tiempo ----------
  // El año del reloj avanza poco a poco durante el turno, en vez de saltar.
  let anioAntes = null, inicioTurno = 0;
  function relojSuave() {
    requestAnimationFrame(relojSuave);
    // Para depurar desde la consola: genesis.mundo() devuelve el mundo vivo.
    window.genesis = Object.assign(window.genesis || {}, { mundo: () => m, aldeano: id => { edificioSel = null; aldeanoSel = id; P.elegirAldeano(id); pintarFicha(); }, edificio: t => { aldeanoSel = null; edificioSel = t; pintarFicha(); } });
    if (!m || anioAntes == null) return;
    animarRecursos();
    if (performance.now() - (relojSuave.ult || 0) > 500) { relojSuave.ult = performance.now(); pintarCuadrillas(); }
    const f = corriendo ? Math.min(1, (performance.now() - inicioTurno) / VELOCIDADES[vel][0]) : 1;
    const anio = Math.round(anioAntes + (m.anio - anioAntes) * f);
    const texto = m.libre ? 'Año ' + anio : S.anioTexto(anio);
    if ($('anio').textContent !== texto) $('anio').textContent = texto;
  }
  // El turno se calcula a trozos (unos milisegundos cada vez, entre fotograma y fotograma): la imagen no se
  // congela al cambiar de turno, y la gente que aún termina su último paso sigue andando mientras tanto.
  let calculo = null;
  function paso() {
    if (calculo || red.modo === 'invitado') return;
    if (red.modo === 'anfitrion' && red.sala) return; // en la sala aún no hay partida: no corre ni se manda nada
    // En línea, el anfitrión lleva el reloj: manda a todos las órdenes del turno y lo calcula como los demás.
    if (red.modo === 'anfitrion') { const msg = { t: 'turno', n: m.turno + 1, acc: red.cola.splice(0), ms: VELOCIDADES[vel][0], vel, suma: sumaMundo(m) }; difundir(msg); empezarTurno(msg); return; }
    empezarTurno(null);
  }
  function empezarTurno(msg) {
    if (msg) { if (m.vida) m.vida.msTurno = msg.ms; aplicarAcciones(msg.acc); }
    const antes = m.cronica[0], yo = tuPueblo(), guerrasAntes = yo ? yo.guerras.map(g => g.con) : [], sigAntes = m.vida ? m.vida.sig : 0;
    calculo = { gen: S.turnoPorPartes ? S.turnoPorPartes(m) : null, antes, yo, guerrasAntes, sigAntes, anio: m.anio, mundo: m };
    if (!calculo.gen) { S.turno(m); terminarCalculo(); return; }
    seguirCalculo();
  }
  function seguirCalculo() {
    const c = calculo;
    if (!c) return;
    if (c.mundo !== m) { calculo = null; return; }
    const t0 = performance.now();
    while (performance.now() - t0 < 7) if (c.gen.next().done) { terminarCalculo(); return; }
    setTimeout(seguirCalculo, 4);
  }
  function terminarCalculo() {
    const c = calculo; calculo = null;
    anioAntes = c.anio; inicioTurno = performance.now();
    P.turno(m, VELOCIDADES[vel][0]);
    // Los paneles, los retos y el guardado van después, en otro fotograma (menos tirón al cambiar de turno).
    setTimeout(() => despuesDelTurno(c.antes, c.yo, c.guerrasAntes, c.sigAntes), 40);
    if (red.modo === 'invitado' && red.pendientes.length) setTimeout(() => turnoRecibido(red.pendientes.shift()), 0);
  }
  // Antes de tocar el mundo (una orden, un poder, guardar), el turno a medias se termina de una vez.
  function acabarTurno() { const c = calculo; if (c && c.mundo === m) { while (!c.gen.next().done); terminarCalculo(); } else calculo = null; }
  // Las batallas: el botón ⚔ lleva a la mayor (y, pulsando otra vez, a la siguiente); si lucha tu pueblo, se avisa.
  let batallaVista = 0, ultimaBatallaAvisada = -99;
  const regionDeBatalla = b => Math.floor(b.ty / M.vida.SUB) * m.W + Math.floor(b.tx / M.vida.SUB);
  function avisarBatallas() {
    const bs = P.batallas ? P.batallas() : [];
    $('ir-batalla').hidden = !bs.length;
    $('ir-batalla').classList.toggle('viva', bs.some(b => b.turno === m.turno));
    const mia = m.jugador != null && bs.find(b => b.turno === m.turno && b.civs.includes(m.jugador));
    if (mia && m.turno - ultimaBatallaAvisada > 4) {
      ultimaBatallaAvisada = m.turno;
      const otros = mia.civs.filter(id => id !== m.jugador).map(id => (S.civ(m, id) || {}).nombre).filter(Boolean);
      avisoFlotante('⚔ ¡Batalla' + (otros.length ? ' contra ' + otros.join(' y ') : '') + '! Toca ⚔ para verla', 3500);
    }
  }
  function irABatalla() {
    const bs = P.batallas ? P.batallas() : [];
    if (!bs.length) return;
    batallaVista = (batallaVista + 1) % bs.length;
    if (P.centrarEnParcela) P.centrarEnParcela(bs[batallaVista].tx, bs[batallaVista].ty, 5); else P.centrarEn(regionDeBatalla(bs[batallaVista]), 5);
    if (movil()) document.body.classList.add('sin-panel');
  }
  function despuesDelTurno(antes, yo, guerrasAntes, sigAntes) {
    // Avisos del turno sobre el mapa (plazas ganadas, cuadrillas que terminan) y en la línea de respuesta.
    for (const an of (m.vida.anuncios || []).splice(0)) { const c = S.civ(m, an.civ); if (c && (!m.jugador || an.civ === m.jugador || an.region != null)) P.anunciar(an.region != null ? an.region : c.capital, an.texto, /[⚔✖]/.test(an.texto) ? '#ff8a7a' : /🏴/.test(an.texto) ? '#ffd76a' : null); }
    for (const av of (m.avisosPlan || []).splice(0)) if (av.civ === m.jugador) responder(av.texto, 'bien');
    // Los grandes sucesos del turno (saqueos, independencias, caídas, exterminios), en grande arriba: primero los
    // que tocan a tu pueblo, y si no, el más gordo del mundo.
    const PESO = { caida: 5, saqueo: 4, independencia: 3, exterminio: 3, huye: 1 };
    const sucs = (m.vida.sucesos || []).filter(su => !avisados.has(su) && m.turno - su.turno <= 1);
    for (const su of m.vida.sucesos || []) avisados.add(su);
    if (sucs.length) {
      const mio = su => m.jugador != null && (su.civ === m.jugador || su.otro === m.jugador);
      const top = sucs.slice().sort((a, b) => (mio(b) ? 10 : 0) + PESO[b.tipo] - (mio(a) ? 10 : 0) - PESO[a.tipo])[0];
      avisoFlotante(top.texto, 5000, top.region);
      if (M.sonido && M.sonido.activo()) M.sonido.efecto(top.tipo === 'independencia' ? 'campana' : top.tipo === 'huye' ? 'cuerno' : 'peste');
      if (top.tipo === 'saqueo' || top.tipo === 'caida') setTimeout(() => M.sonido && M.sonido.activo() && M.sonido.efecto('cuerno'), 250);
    }
    if (m.cronica[0] !== antes) marcar(m.cronica[0]);
    if (M.sonido && M.sonido.activo()) {
      const nuevos = []; for (const e of m.cronica) { if (e === antes) break; nuevos.push(e); }
      M.sonido.turno(m, VELOCIDADES[vel][0], { cronica: nuevos, nacimientos: m.vida.aldeanos.some(a => a.id >= sigAntes && a.edad === 0) });
    }
    if (yo || m.retos) retosDelTurno(antes);
    if (yo) avisos(yo, guerrasAntes, antes);
    avisarBatallas();
    if (corteDe != null) pintarCorte();
    pintarTodo();
    if (m.turno % 2 === 0) guardar();
  }
  // ---------- Retos: lo que cumples, el marcador y el fin de la partida ----------
  function retosDelTurno(ultimo) {
    const nuevos = []; for (const e of m.cronica) { if (e === ultimo) break; nuevos.push(e); }
    const hechos = X.evaluarRetos(m, nuevos);
    if (hechos.length) {
      avisoFlotante('★ Reto cumplido: ' + hechos.map(x => x.nombre + ' (+' + x.puntos + ')').join(' · '), 4500);
      if (M.sonido && M.sonido.activo()) M.sonido.efecto('campana');
    }
    const e = X.estadoRetos(m);
    if (e && !m.retos.terminada && (e.fin || !e.civ.viva)) { m.retos.terminada = true; mostrarFin(e); }
  }
  // La historia de tu pueblo, en pocas líneas: de dónde vino, cada era con su año, su mayor tamaño, sus guerras y sus reyes.
  function historiaFinal(e) {
    const h = e.hist; if (!h) return '';
    const anio = a => m.libre ? 'el año ' + Math.round(a) : S.anioTexto(a);
    const eras = Object.keys(h.eras).map(Number).sort((a, b) => a - b).filter(k => k > 0).map(k => esc(M.ERAS[k].nombre) + ' <span class="tenue">(' + esc(anio(h.eras[k])) + ')</span>');
    const filas = [
      'Empezó en ' + esc(anio(h.desde)) + ' como un campamento de chozas.',
      eras.length ? 'Recorrió ' + eras.join(' → ') + '.' : 'No llegó a salir de ' + esc(M.ERAS[0].con) + '.',
      'En su mejor momento tuvo <b>' + h.maxHab + '</b> vecinos y <b>' + h.maxTierras + '</b> tierras' + (h.ciudades ? ', con ' + h.ciudades + (h.ciudades === 1 ? ' ciudad hija' : ' ciudades hijas') : '') + '.',
      h.enemigos.length ? 'Luchó contra ' + esc(h.enemigos.slice(0, 6).join(', ')) + (h.enemigos.length > 6 ? ' y ' + (h.enemigos.length - 6) + ' más' : '') + (e.conquistas ? ', y conquistó ' + e.conquistas + (e.conquistas === 1 ? ' plaza' : ' plazas') : '') + '.' : 'Vivió sin guerras: nadie le declaró la guerra ni la declaró.',
      h.reyes.length ? 'La gobernaron ' + esc(h.reyes.slice(0, 5).join(', ')) + (h.reyes.length > 5 ? '… hasta ' + esc(h.reyes[h.reyes.length - 1]) : '') + '.' : ''
    ].filter(Boolean);
    return '<div class="fin-historia"><h3>La historia de ' + esc(e.civ.nombre) + '</h3>' + filas.map(f => '<p>' + f + '</p>').join('') + '</div>';
  }
  function mostrarFin(e) {
    // En online el reloj lo lleva el anfitrión: su derrota no para la partida de los demás.
    if (!enLinea()) { corriendo = false; programar(); }
    $('fin-nuevo').hidden = enLinea(); $('fin-seguir').textContent = enLinea() && !e.civ.viva ? 'Seguir mirando' : 'Seguir jugando';
    $('fin-titulo').textContent = e.civ.viva ? 'Fin de la partida: ' + e.civ.nombre + ' llega a ' + (m.libre ? 'su año ' + m.anio : '1945') : e.civ.nombre + ' ha caído';
    $('fin-texto').innerHTML = '<b class="retos-total">' + e.total.toLocaleString('es-ES') + ' puntos</b><br><span class="tenue">' + e.puntos + ' de retos (' + e.hechos + ' de ' + e.lista.length + ')' + (e.civ.viva ? ' + ' + e.extra + ' por tu gente y tu tierra · puesto ' + e.puesto + ' de ' + S.vivas(m).length + ' en tierras' : '') + '</span>';
    $('fin-retos').innerHTML = '<p class="tenue">' + e.lista.filter(x => x.hecho).map(x => '★ ' + esc(x.nombre)).join(' · ') + '</p>' + historiaFinal(e);
    $('fin').hidden = false;
  }
  function pintarRetos() {
    const e = X.estadoRetos(m), mk = $('marcador');
    mk.hidden = !e;
    if (!e) { $('retos').innerHTML = '<p class="vacio">Los retos son para quien gobierna un pueblo. Elige «Cambiar de modo» → «Gobernar un pueblo».</p>'; return; }
    mk.innerHTML = '★ <b>' + e.total.toLocaleString('es-ES') + '</b> <span>' + e.hechos + '/' + e.lista.length + ' retos</span>';
    const pg = X.guia(m), c = tuPueblo();
    const guiaHtml = pg && c ? '<div class="reto guia-lista"><div class="reto-cab"><span class="reto-nombre">Primeros pasos</span><button type="button" class="mando sutil" id="saltar-guia">Saltar la guía</button></div>' +
      X.GUIA.map((x, i) => '<p class="reto-texto">' + (x.hecho(m, c) ? '✓ ' : i + 1 === pg.n ? '▶ ' : '· ') + esc(x.texto) + '</p>').join('') + '</div>' : '';
    $('retos').innerHTML = guiaHtml + '<div class="retos-cab"><span class="retos-total">' + e.total.toLocaleString('es-ES') + ' puntos</span><br><span class="tenue">' + e.puntos + ' de retos + ' + e.extra + ' por tu gente y tu tierra. La partida termina en ' + (m.libre ? 'el año 400' : '1945') + '.</span></div>' +
      e.lista.map(x => '<div class="reto' + (x.hecho ? ' hecho' : !e.civ.viva ? ' fallado' : '') + '"><div class="reto-cab"><span class="reto-nombre">' + (x.hecho ? '★ ' : '') + esc(x.nombre) + '</span><span class="reto-puntos">+' + x.puntos + '</span></div><p class="reto-texto">' + esc(x.texto) + (x.hecho ? ' <b>Cumplido en ' + esc(m.libre ? 'el año ' + x.cuando : S.anioTexto(x.cuando)) + '.</b>' : '') + '</p>' +
        (x.hecho ? '' : '<span class="barra"><span style="width:' + Math.round(x.avance * 100) + '%"></span></span> <span class="tenue">' + Math.min(x.v, x.meta) + ' / ' + x.meta + '</span>') + '</div>').join('');
    const sg = $('saltar-guia'); if (sg) sg.addEventListener('click', () => { (m.guia = m.guia || {}).oculta = 1; pintarRetos(); pintarConsejo(); guardar(); });
  }
  // Lo que le pasa a tu pueblo mientras corre el tiempo: guerras que te declaran, paces que te ofrecen, tu caída.
  function avisos(yo, guerrasAntes, ultimo) {
    if (!yo.viva) {
      pintarModo();
      if (!$('fin').hidden) return; // primero se ve la puntuación; al seguir, se elige otro pueblo
      if (enLinea()) { responder(yo.nombre + ' ha caído: has perdido. Puedes seguir mirando cómo acaba la partida.', 'duda'); return; }
      pedirModo('Tu pueblo ha caído', yo.nombre + ' ya no existe. Puedes gobernar otro pueblo (te toca uno al azar, o elige uno en la lista y pulsa «Gobernar este pueblo») o seguir mirando como dios.');
      return;
    }
    const nuevas = yo.guerras.filter(g => !guerrasAntes.includes(g.con)).map(g => S.civ(m, g.con)).filter(Boolean);
    if (nuevas.length) { responder('¡' + nuevas.map(o => o.nombre).join(' y ') + ' te declara la guerra! Reclutad un ejército o pedid la paz.', 'duda'); return; }
    const recientes = [];
    for (const e of m.cronica) { if (e === ultimo) break; recientes.push(e); }
    const oferta = recientes.find(e => / te ofrece la paz$/.test(e.titulo));
    if (oferta) responder(oferta.titulo + '. Escribe «acepto la paz con ' + oferta.titulo.replace(/ te ofrece la paz$/, '') + '» si la quieres.', 'duda');
  }
