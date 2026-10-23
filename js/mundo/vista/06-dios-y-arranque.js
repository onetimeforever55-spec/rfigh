  // ── GÉNESIS · LA VISTA · La voluntad del dios, las órdenes y el arranque ──

  // ---------- La voluntad del dios ----------
  function responder(texto, tipo) {
    const p = $('respuesta');
    p.textContent = texto;
    p.className = 'respuesta ' + (tipo || '');
  }

  // Lo que tenía cada pueblo antes del poder, para contar después qué cambió.
  function foto() {
    const out = {};
    for (const c of m.civs) out[c.id] = { viva: c.viva, pob: c.pob, aldeanos: m.vida.aldeanos.filter(a => a.c === c.id).length, casas: c.casas || 0, campos: c.campos || 0, arboles: c.arboles || 0, tierras: S.casillas(m, c).length, era: c.era, guerras: c.guerras.length, riqueza: c.riqueza, madera: c.madera || 0 };
    return out;
  }
  function cambios(antes, ids, poder) {
    const partes = [];
    for (const id of ids) {
      const c = S.civ(m, id), a = antes[id];
      if (!c) continue;
      if (!a) { partes.push(c.nombre + ' aparece con ' + m.vida.aldeanos.filter(x => x.c === id).length + ' aldeanos'); continue; }
      if (a.viva && !c.viva) { partes.push(c.nombre + ' desaparece'); continue; }
      const l = [];
      const d = (n0, n1) => Math.round(n1) - Math.round(n0);
      const h0 = a.aldeanos, h1 = m.vida.aldeanos.filter(x => x.c === id).length;
      if (h0 !== h1) l.push('habitantes ' + h0 + ' → ' + h1);

      if (d(a.casas, c.casas) < 0) l.push(-d(a.casas, c.casas) + ' casas en ruinas');
      if (d(a.campos, c.campos) < 0) l.push(-d(a.campos, c.campos) + ' campos perdidos');
      const bosques = poder === 'incendio' || poder === 'bosque';
      if (bosques && d(a.arboles, c.arboles) <= -5) l.push(-d(a.arboles, c.arboles) + ' árboles menos');
      if (bosques && d(a.arboles, c.arboles) >= 5) l.push(d(a.arboles, c.arboles) + ' árboles nuevos');
      if (d(a.tierras, S.casillas(m, c).length) < 0) l.push(-d(a.tierras, S.casillas(m, c).length) + ' tierras perdidas');
      if (c.era > a.era) l.push('entra en ' + M.ERAS[c.era].con);
      if (c.guerras.length > a.guerras) l.push('en guerra');
      if (c.riqueza - a.riqueza >= 30) l.push('riqueza +' + Math.round(c.riqueza - a.riqueza));
      if (d(a.madera, c.madera) >= 10) l.push('madera +' + d(a.madera, c.madera));
      if (l.length) partes.push(c.nombre + ': ' + l.join(', '));
    }
    return partes.slice(0, 4).join('. ');
  }
  function mostrarPoder(poder, ids, suceso, antes, porDefecto) {
    M.vida.ajustar(m);
    P.refrescar();
    const nuevos = m.civs.filter(c => !antes[c.id]).map(c => c.id);
    const todos = [...new Set([...(ids || []), ...nuevos])];
    P.efecto(nuevos.length && poder === 'nuevo' ? 'nuevo' : poder, todos, suceso.titulo);
    if (M.sonido) M.sonido.efecto(poder === 'plaga' || poder === 'hambre' ? 'peste' : poder === 'guerra' ? 'cuerno' : 'obrar');
    marcar(suceso);
    const quien = porDefecto === 'todos' ? ' (para todos los pueblos)' : porDefecto === 'grande' ? ' (sobre el más grande, porque no dijiste sobre quién)' : '';
    const efectos = cambios(antes, todos, poder);
    responder('Hecho' + quien + '. ' + suceso.titulo + '.' + (efectos ? ' ' + efectos + '.' : ''), 'bien');
    pintarTodo(); guardar();
  }

  async function obrar(texto) {
    (m.guia = m.guia || {}).ordenes = (m.guia.ordenes || 0) + 1;
    if (ocupado) return;
    const antes = foto();
    if (tuPueblo()) { ordenar(texto); return; }
    const r = D.obrar(m, texto, sel);
    if (r.ok) { mostrarPoder(r.poder, r.objetivos, r.suceso, antes, r.porDefecto); return; }
    if (r.motivo === 'falta_quien') { responder('¿Sobre quién? Toca un pueblo en el mapa o nómbralo ("peste sobre ' + (S.vivas(m)[0] || { nombre: 'Karenia' }).nombre + '").', 'duda'); return; }
    if (r.motivo === 'faltan_dos') { responder('Para eso hacen falta dos pueblos: nómbralos, o elige uno y nombra al otro.', 'duda'); return; }
    if (!sample) { responder('Los cielos no entienden esa orden. Prueba con pestes, sequías, diluvios, terremotos, incendios, "mata a la mitad de X", "haz más fuerte a X", oro, inventos ("que descubran la pólvora"), bosques, guerras, paces, profetas, revoluciones o pueblos nuevos.', 'duda'); return; }
    // Lo que el intérprete no entiende, lo decide Claude (con límites).
    ocupado = true;
    const seguia = corriendo; corriendo = false; programar();
    responder('Los cielos meditan tu voluntad…', 'espera');
    try {
      let f;
      if (typeof sample.json === 'function') f = await sample.json(D.SISTEMA + '\n\n' + D.paraIA(m, texto));
      else { const res = await sample(D.SISTEMA + '\n\n' + D.paraIA(m, texto)); f = JSON.parse(String(res.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
      const e = D.aplicarIA(m, f);
      if (e) {
        const ids = (Array.isArray(f.efectos) ? f.efectos : []).map(x => (S.vivas(m).find(c => c.id === Number(x.civ) || D.norm(c.nombre) === D.norm(x.civ)) || {}).id).filter(x => x != null);
        for (const [a, b] of Array.isArray(f.guerra) ? f.guerra : []) for (const x of [a, b]) { const c = S.vivas(m).find(o => o.id === Number(x)); if (c) ids.push(c.id); }
        const malo = (Array.isArray(f.efectos) ? f.efectos : []).some(x => Number(x.poblacion) < -10);
        mostrarPoder(Array.isArray(f.guerra) && f.guerra.length ? 'guerra' : malo ? 'matar' : 'bueno', [...new Set(ids)], e, antes, null);
      }
      else responder((f && f.pregunta) || 'Ni los cielos entienden esa orden. Dila de otra manera.', 'duda');
    } catch (err) {
      responder(err && err.code === 'rate_limited' ? 'Los cielos están saturados. Espera un poco y vuelve a intentarlo.' : 'Los cielos no responden ahora. Prueba con un poder sencillo: peste, diluvio, oro, un invento, una guerra o la paz.', 'duda');
    }
    ocupado = false; corriendo = seguia; programar();
    pintarTodo(); guardar();
  }

  // Las órdenes a tu pueblo: el intérprete local, y si no entiende, Claude las traduce a las mismas acciones.
  async function ordenar(texto) {
    const yo = tuPueblo();
    if (m.vida) m.vida.msTurno = VELOCIDADES[vel][0];
    const r = X.ordenar(m, yo.id, texto);
    if (r.ok) { despuesDeOrden(r); return; }
    if (!sample) { responder('Tu gente no entiende la orden. Prueba con: háganme 5 casas, formad un escuadrón de 10, esperad el ataque, al ataque, retirada, 5 granjeros a talar durante 2 minutos, quiero 10 leñadores, talad 20 árboles, más madera, más comida, menos ejército, todo a la ciencia, nada de piedra, expandíos hacia el norte, atacad a X, haced la paz con X, comerciad con X, proclamad la república, informe, como antes.', 'duda'); return; }
    ocupado = true;
    responder('Tus consejeros discuten la orden…', 'espera');
    try {
      let f;
      if (typeof sample.json === 'function') f = await sample.json(X.SISTEMA + '\n\n' + X.paraIA(m, yo.id, texto));
      else { const res = await sample(X.SISTEMA + '\n\n' + X.paraIA(m, yo.id, texto)); f = JSON.parse(String(res.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
      const r2 = X.aplicarIA(m, yo.id, f);
      if (r2) despuesDeOrden(r2);
      else responder((f && f.respuesta) || 'Tus consejeros no saben cómo cumplir eso. Dilo de otra manera.', 'duda');
    } catch (err) {
      responder('Tus consejeros no responden ahora. Prueba con una orden sencilla: talad, construid, atacad a X, haced la paz…', 'duda');
    }
    ocupado = false;
  }
  function despuesDeOrden(r) {
    if (!enLinea()) { M.vida.ajustar(m); P.refrescar(); }
    // Lo que tu orden pone en marcha, sobre tu pueblo en el mapa.
    for (const an of (m.vida.anuncios || []).splice(0)) { const c = S.civ(m, an.civ); if (c) P.anunciar(an.region != null ? an.region : c.capital, an.texto, /[⚔✖]/.test(an.texto) ? '#ff8a7a' : /🏴/.test(an.texto) ? '#ffd76a' : null); }
    const guerra = r.acciones.find(a => a.tipo === 'guerra' && a.con != null);
    if (guerra && S.civ(m, guerra.con)) { P.efecto('guerra', [m.jugador, guerra.con], 'Guerra contra ' + S.civ(m, guerra.con).nombre); }
    const yo = tuPueblo();
    responder(r.respuesta || 'Hecho.', 'bien');
    if (yo) marcar({ casilla: yo.capital, tipo: 'orden' });
    pintarTodo(); guardar();
  }

  async function cronista() {
    if (!sample || ocupado) return;
    const nuevos = m.cronica.filter(e => e.turno > ultimaCronista && e.tipo !== 'cronista').slice(0, 16).reverse();
    if (nuevos.length < 3) { responder('Aún no ha pasado lo bastante para escribir otro capítulo. Deja correr el tiempo.', 'duda'); return; }
    ocupado = true; $('cronista').disabled = true;
    responder('El cronista moja la pluma…', 'espera');
    try {
      const datos = 'Sucesos desde ' + S.anioTexto(nuevos[0].anio) + ' hasta ' + S.anioTexto(nuevos[nuevos.length - 1].anio) + ':\n' + nuevos.map(e => '- ' + S.anioTexto(e.anio) + ': ' + e.titulo + '. ' + e.texto).join('\n');
      const r = await sample(D.CRONISTA + '\n\n' + datos, { modelTier: 'default' });
      const texto = String(r.text || '').trim();
      if (texto) {
        m.cronica.unshift({ anio: m.anio, turno: m.turno, tipo: 'cronista', titulo: 'Capítulo: de ' + S.anioTexto(nuevos[0].anio) + ' a ' + S.anioTexto(nuevos[nuevos.length - 1].anio), texto, importante: true });
        ultimaCronista = m.turno;
        responder('El cronista ha escrito un capítulo nuevo.', 'bien');
      }
    } catch (err) { responder('El cronista no responde ahora. Vuelve a intentarlo en un rato.', 'duda'); }
    ocupado = false; $('cronista').disabled = false;
    pintarCronica(); guardar();
  }

  // ---------- Arranque ----------
  /**
   * Que deslizar el dedo no saque al jugador del juego: ni tirar para recargar, ni el rebote de la página, ni el
   * zoom de la página entera (el mapa tiene el suyo), ni el gesto de «atrás» del navegador. Las listas y paneles
   * que se desplazan siguen desplazándose. Y si aun así se sale, la partida queda guardada.
   */
  function atarPantalla() {
    const desplazable = (el, dx, dy) => {
      for (; el && el !== document.body; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (Math.abs(dy) >= Math.abs(dx) && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          if ((dy > 0 && el.scrollTop > 0) || (dy < 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
        }
        if (Math.abs(dx) > Math.abs(dy) && /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
          if ((dx > 0 && el.scrollLeft > 0) || (dx < 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1)) return true;
        }
      }
      return false;
    };
    let x0 = 0, y0 = 0;
    document.addEventListener('touchstart', ev => { if (ev.touches.length === 1) { x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; } }, { passive: true });
    document.addEventListener('touchmove', ev => {
      if (ev.target && ev.target.id === 'mapa') { ev.preventDefault(); return; }
      if (ev.touches.length > 1) { ev.preventDefault(); return; }
      const t = ev.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (!desplazable(ev.target, dx, dy)) ev.preventDefault();
    }, { passive: false });
    // Safari: el pellizco sobre la página no la amplía.
    for (const g of ['gesturestart', 'gesturechange']) document.addEventListener(g, ev => ev.preventDefault(), { passive: false });
    // El gesto o el botón de «atrás» no cierra el juego: se queda en la partida. Dentro de otra página (claude.ai)
    // no se toca el historial: es el de la app que lo enseña.
    let suelto = true; try { suelto = window.self === window.top; } catch (e) { suelto = false; }
    if (suelto) try { history.pushState({ genesis: 1 }, ''); window.addEventListener('popstate', () => { try { history.pushState({ genesis: 1 }, ''); } catch (e) { /* sin historial */ } }); } catch (e) { /* sin historial */ }
    // Si se cierra o se cambia de app, se guarda antes.
    window.addEventListener('pagehide', () => { guardar(); guardarOnline(); guardarSesion(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { guardar(); guardarOnline(); guardarSesion(); } });
  }
  function iniciar(datos) {
    atarPantalla();
    // En el móvil, el consejo y la respuesta se leen enteros al tocarlos (y se vuelven a plegar).
    for (const id of ['consejo', 'respuesta']) { const e = $(id); if (e) e.addEventListener('click', ev => { if (ev.target.closest('button')) return; e.classList.toggle('entero'); }); }
    // Instalado como app (o abierto desde un servidor): se guarda para jugar sin internet.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin internet */ });
    P.iniciar($('mapa'), { reducido, alClicar: region => { aldeanoSel = null; edificioSel = null; P.elegirAldeano(null); const d = m.dueno[region]; if (tuPueblo() && d === tuPueblo().id) (m.guia = m.guia || {}).vioFicha = 1; elegir(d >= 0 ? (sel === d ? null : d) : null, false); if (sel != null) abrirHoja('pueblos'); else document.body.classList.add('sin-panel'); }, alClicarAldeano: id => { edificioSel = null; aldeanoSel = id; P.elegirAldeano(id); pintarFicha(); if (movil()) abrirHoja('pueblos'); }, alClicarEdificio: t => { if (tuPueblo() && m.dueno[M.vida.region(m, t)] === tuPueblo().id) (m.guia = m.guia || {}).vioFicha = 1; aldeanoSel = null; P.elegirAldeano(null); edificioSel = t; pintarFicha(); abrirHoja('pueblos'); }, alClicarCorte: (civ) => { elegir(civ, false); abrirCorte(civ); } });
    m = (datos && datos.mundo && datos.mundo.vida && datos.mundo.W === S.W ? datos.mundo : null) || cargar();
    if (!m) mundoNuevo(); else P.mundo(m);
    if (datos && datos.sel != null) { sel = datos.sel; P.seleccionar(sel); }
    pintarModo(); pintarTodo(); atarBarra();
    $('play').addEventListener('click', () => { corriendo = !corriendo; programar(); });
    $('vel').addEventListener('click', () => { vel = (vel + 1) % VELOCIDADES.length; programar(); });
    $('nuevo').addEventListener('click', () => {
      if (!confirmarNuevo) { confirmarNuevo = true; $('nuevo').textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { confirmarNuevo = false; $('nuevo').textContent = 'Nuevo mundo'; }, 3500); return; }
      confirmarNuevo = false; $('nuevo').textContent = 'Nuevo mundo';
      mundoNuevo(); pintarModo(); pintarTodo(); guardar(); responder('Un mundo nuevo. Cinco pueblos acaban de aprender a sembrar.', 'bien');
      pedirModo();
    });
    $('voluntad').addEventListener('submit', ev => { ev.preventDefault(); const t = $('orden').value.trim(); if (!t) return; $('orden').value = ''; obrar(t); });
    $('modo-pueblo').addEventListener('click', () => elegirModo('pueblo', sel != null && S.civ(m, sel) && S.civ(m, sel).viva ? sel : null));
    $('modo-dios').addEventListener('click', () => elegirModo('dios'));
    atarOnline();
    $('cambiar-modo').addEventListener('click', () => {
      if (!enLinea()) { pedirModo(); return; }
      if (!red.confirmarSalir) { red.confirmarSalir = true; $('cambiar-modo').textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { red.confirmarSalir = false; pintarOnline(); }, 3500); return; }
      red.confirmarSalir = false; salirOnline(false);
    });
    // La ayuda: se abre desde el menú o desde la pantalla de inicio, y se cierra con «Entendido» o tocando fuera.
    const ayuda = abrir => { $('ayuda').hidden = !abrir; };
    $('ayuda-abrir').addEventListener('click', () => ayuda(true));
    $('ayuda-inicio').addEventListener('click', () => ayuda(true));
    $('ayuda-cerrar').addEventListener('click', () => ayuda(false));
    $('ayuda').addEventListener('click', ev => { if (ev.target === $('ayuda')) ayuda(false); });
    // El sonido empieza apagado (los navegadores solo dejan sonar tras un gesto); se recuerda la preferencia.
    const pintarSonido = () => { const on = M.sonido.activo(); $('sonido').textContent = on ? '🔊 Sonido' : '🔈 Sonido'; $('sonido').setAttribute('aria-pressed', on ? 'true' : 'false'); };
    // Gráficos: con la tarjeta gráfica (WebGL) o el dibujo clásico. Se aplica al volver a abrir el juego (la partida se guarda sola).
    const pintarGraficos = () => { const b = $('graficos'); if (!b) return; const usa = M.pintor.gpu && M.pintor.gpu(); let pref = null; try { pref = localStorage.getItem('genesis.gpu'); } catch (e) { /* sin preferencia */ } const quiere = pref !== '0'; const d = M.gpu && M.gpu.disponible ? M.gpu.disponible() : { si: false }; b.disabled = !d.si && !usa; b.textContent = '🎮 Gráficos: ' + (b.disabled ? 'clásico' : (quiere ? 'tarjeta gráfica' : 'clásico') + (quiere !== !!usa ? ' (al recargar)' : '')); b.title = usa ? 'Se dibuja con la tarjeta gráfica (WebGL): menos trabajo para el procesador y la batería.' : 'Se dibuja con el dibujo clásico (2D)' + (d.si ? '.' : ': este aparato no tiene WebGL de verdad (' + (d.por || '') + ').'); };
    if ($('graficos')) { pintarGraficos(); $('graficos').addEventListener('click', () => { let pref = null; try { pref = localStorage.getItem('genesis.gpu'); localStorage.setItem('genesis.gpu', pref === '0' ? '1' : '0'); } catch (e) { /* sin guardado */ } pintarGraficos(); }); }
    $('sonido').addEventListener('click', () => { const on = M.sonido.alternar(); try { localStorage.setItem('genesis.sonido', on ? '1' : '0'); } catch (e) { /* sin guardado */ } pintarSonido(); });
    pintarSonido();
    $('zoom-mas').addEventListener('click', () => P.zoom(1.5));
    $('zoom-menos').addEventListener('click', () => P.zoom(1 / 1.5));
    $('ver-todo').addEventListener('click', () => P.verTodo());
    $('cronista').addEventListener('click', cronista);
    // La ventana de órdenes se oculta con ▾ y vuelve con «✍ Órdenes» (en el móvil, con la pestaña Órdenes de abajo).
    // El 👁 deja solo el mundo: sin cabecera, sin paneles; otro toque y vuelve todo.
    const verOrdenes = on => {
      document.body.classList.toggle('sin-ordenes', !on); $('abrir-ordenes').hidden = on;
      if (window.innerWidth < 900) { document.body.classList.toggle('ordenes-abiertas', on); return; }
      try { localStorage.setItem('genesis.ordenes', on ? '1' : '0'); } catch (e) { /* sin guardado */ }
    };
    $('cerrar-ordenes').addEventListener('click', () => verOrdenes(false));
    $('abrir-ordenes').addEventListener('click', () => { verOrdenes(true); $('orden').focus(); });
    try { if (localStorage.getItem('genesis.ordenes') === '0' && window.innerWidth >= 900) verOrdenes(false); } catch (e) { /* sin preferencia */ }
    $('limpio').addEventListener('click', () => { const on = document.body.classList.toggle('limpio'); $('limpio').setAttribute('aria-pressed', on ? 'true' : 'false'); $('limpio').textContent = on ? '👁‍🗨' : '👁'; });
    // El panel lateral (abajo en el móvil): pestañas, abrir y cerrar. En pantallas pequeñas empieza cerrado.
    const panelAbierto = abierto => { document.body.classList.toggle('sin-panel', !abierto); $('ver-panel').setAttribute('aria-expanded', abierto ? 'true' : 'false'); };
    // (En el PC, como las ventanas de WorldBox: cerrado hasta que se toca un pueblo o se abre desde la barra de abajo.)
    panelAbierto(false);
    $('ver-panel').addEventListener('click', () => panelAbierto(document.body.classList.contains('sin-panel')));
    $('cerrar-panel').addEventListener('click', () => panelAbierto(false));
    for (const b of document.querySelectorAll('.panel-pestanas .pestana')) b.addEventListener('click', () => abrirHoja(b.dataset.panel));
    // ---- El móvil: barra de abajo, menú ⋯, órdenes plegadas ----
    for (const b of document.querySelectorAll('.nav-b')) { const i = b.querySelector('i'); if (i && px('mapa')) i.innerHTML = px({ mapa: 'mapa', ordenes: 'ordenes', pueblos: 'pueblos', cronica: 'cronica', retos: 'retos' }[b.dataset.v]); }
    if (px('arqui')) $('arquitecto-btn').innerHTML = px('arqui', 'grande');
    const navActiva = () => {
      const b = document.body, abierto = !b.classList.contains('sin-panel');
      const hoja = (document.querySelector('.panel-hoja:not([hidden])') || {}).dataset;
      const v = abierto && hoja ? hoja.hoja : b.classList.contains('ordenes-abiertas') ? 'ordenes' : 'mapa';
      for (const x of document.querySelectorAll('.nav-b')) x.classList.toggle('activa', x.dataset.v === v);
      $('nav-punto').hidden = !(!$('cuadrillas-hud').hidden || !$('guerra-hud').hidden);
    };
    new MutationObserver(navActiva).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // En «Mapa», tocar la franja de abajo abre las órdenes (salvo los botones que lleva dentro).
    $('voluntad').addEventListener('click', ev => {
      const bd = document.body;
      if (!movil() || bd.classList.contains('ordenes-abiertas') || ev.target.closest('button, input')) return;
      ev.stopPropagation(); bd.classList.remove('sin-ordenes'); bd.classList.add('ordenes-abiertas'); navActiva();
    }, true);
    for (const b of document.querySelectorAll('.nav-b')) b.addEventListener('click', () => {
      const v = b.dataset.v, bd = document.body, abierto = !bd.classList.contains('sin-panel');
      bd.classList.remove('menu-abierto');
      if (v === 'mapa') { panelAbierto(false); bd.classList.remove('ordenes-abiertas'); }
      else if (v === 'ordenes') { panelAbierto(false); bd.classList.remove('sin-ordenes'); $('abrir-ordenes').hidden = true; bd.classList.toggle('ordenes-abiertas'); }
      else { bd.classList.remove('ordenes-abiertas'); if (abierto && b.classList.contains('activa')) panelAbierto(false); else { abrirHoja(v); panelAbierto(true); } }
      navActiva();
    });
    $('mas-menu').addEventListener('click', ev => { ev.stopPropagation(); const on = document.body.classList.toggle('menu-abierto'); $('mas-menu').setAttribute('aria-expanded', on ? 'true' : 'false'); });
    document.addEventListener('click', ev => { if (document.body.classList.contains('menu-abierto') && !ev.target.closest('#mas-menu')) { document.body.classList.remove('menu-abierto'); $('mas-menu').setAttribute('aria-expanded', 'false'); } });
    setInterval(navActiva, 1500);
    $('ver-ideas').addEventListener('click', () => { const e = $('ejemplos'); e.hidden = !e.hidden; $('ver-ideas').setAttribute('aria-expanded', e.hidden ? 'false' : 'true'); });
    $('tropas-btn').addEventListener('click', () => { if (tropasActivas) salirTropas(); else abrirTropas(); });
    $('fundar-btn').addEventListener('click', () => { if (arquiClave === 'colonia') salirArquitecto(); else { arquiClave = 'colonia'; ponerArquitecto(); abrirArquitecto(); } });
    $('arquitecto-btn').addEventListener('click', () => { if (arquiClave || !$('arquitecto').hidden) salirArquitecto(); else abrirArquitecto(); });
    $('ir-batalla').addEventListener('click', irABatalla);
    $('corte-btn').addEventListener('click', () => { const c = tuPueblo(); if (corteDe != null) cerrarCorte(); else if (c) abrirCorte(c.id); });
    $('recursos').addEventListener('click', ev => { const cm = ev.target.closest('.rec.comida'); if (cm) { desgloseComida(cm); return; } const ch = ev.target.closest('.rec.tec, .rec.oro'); const c = tuPueblo(); if (ch && c && (ch.classList.contains('tec') || /Avanzar|avanzar|edad/i.test(ch.title))) abrirCorte(c.id); });
    $('ir-mio').addEventListener('click', () => { const c = tuPueblo(); if (c) P.centrarEn(c.capital, 3); });
    $('marcador').addEventListener('click', () => { panelAbierto(true); abrirHoja('retos'); });
    $('fin-seguir').addEventListener('click', () => { $('fin').hidden = true; if (enLinea()) { if (!tuPueblo()) responder('Has perdido. Sigues mirando la partida: el mapa, la crónica y el chat siguen abiertos.', 'duda'); if (red.modo === 'anfitrion') { corriendo = true; programar(); } return; } if (!tuPueblo()) pedirModo('Elige otro pueblo', 'Tu pueblo ya no existe. Gobierna otro o sigue mirando como dios.'); else { corriendo = true; programar(); } });
    $('fin-nuevo').addEventListener('click', () => { $('fin').hidden = true; mundoNuevo(); pintarModo(); pintarTodo(); guardar(); pedirModo(); });
    for (const b of document.querySelectorAll('#filtro-cronica .pestana')) b.addEventListener('click', () => {
      filtroCronica = b.dataset.f;
      for (const o of document.querySelectorAll('#filtro-cronica .pestana')) o.classList.toggle('activa', o === b);
      pintarCronica();
    });
    programar();
    requestAnimationFrame(relojSuave);
    // Un mundo nuevo (o uno guardado de antes de los modos) pregunta cómo quieres jugar.
    if (leerSesion()) volverAPartida();
    else if (!m.modo && $('online').hidden) pedirModo();
    else if (m.modo === 'pueblo' && tuPueblo()) P.centrarEn(tuPueblo().capital, 3);
    if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ mundo: m, sel }));
    // Dentro de claude.ai, Claude entiende lo que el intérprete no, y escribe capítulos de la crónica.
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('sample').then(fn => { sample = fn || null; $('cronista').hidden = !sample; }).catch(() => { sample = null; });
    }
  }

  function arrancar() {
    // Cualquier toque que pueda cambiar el mundo (botones, órdenes, el mapa) llega con el turno ya terminado.
    for (const ev of ['click', 'change', 'submit']) document.addEventListener(ev, () => { if (calculo) acabarTurno(); }, true);
    precargar().then(() => {
      if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(iniciar);
      else iniciar(window.claude && window.claude.hot ? window.claude.hot.data : null);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
