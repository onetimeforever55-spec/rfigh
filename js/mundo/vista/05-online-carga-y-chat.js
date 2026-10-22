  // ── GÉNESIS · LA VISTA · La carga online, el chat y la partida persistente ──

  // ---------- La pantalla de carga online ----------
  function mostrarCarga(texto, avance) {
    $('carga').hidden = false; $('carga-texto').textContent = texto;
    if (avance != null) $('carga-relleno').style.width = Math.round(Math.max(0, Math.min(1, avance)) * 100) + '%';
  }
  function ocultarCarga() { $('carga').hidden = true; $('carga-ya').hidden = true; clearTimeout(red.botonYa); red.alTrozo = null; }
  // Quién tiene ya el mundo cargado (lo ve el anfitrión y se lo manda a todos).
  function pintarCarga(lista) {
    const l = lista || red.jugadores.map(j => ({ nombre: j.nombre, listo: !!(red.listos && red.listos.has(j.id)), anfitrion: j.id === 'anfitrion' }));
    $('carga-lista').innerHTML = l.map(j => '<li><span>' + escapar(j.nombre) + (j.anfitrion ? ' 👑' : '') + '</span><span class="' + (j.listo ? 'listo">✓ listo' : 'espera">cargando…') + '</span></li>').join('');
  }
  function revisarCarga() {
    if (red.modo !== 'anfitrion' || !red.cargando) return;
    const lista = red.jugadores.map(j => ({ nombre: j.nombre, listo: red.listos.has(j.id), anfitrion: j.id === 'anfitrion' }));
    const hechos = lista.filter(j => j.listo).length;
    pintarCarga(lista); difundir({ t: 'carga', fase: 'espera', lista });
    mostrarCarga(hechos < lista.length ? 'Esperando a que todos carguen el mundo… (' + hechos + ' de ' + lista.length + ')' : '¡Todos listos!', 0.6 + 0.4 * hechos / lista.length);
    if (hechos === lista.length) { clearTimeout(red.esperaCarga); red.esperaCarga = setTimeout(arrancarPartida, 500); }
  }
  // La salida: el anfitrión avisa a todos y arranca el reloj; cada uno quita la pantalla de carga a la vez.
  function arrancarPartida() {
    if (red.modo !== 'anfitrion' || !red.cargando) return;
    red.cargando = false; clearTimeout(red.esperaCarga);
    difundir({ t: 'arranca' });
    guardarOnline();
    ocultarCarga(); corriendo = true; programar(); pintarTodo();
    responder('¡Empieza la partida! Gobiernas ' + nombreDe(red.miCiv) + '. Tus órdenes se cumplen al empezar cada turno, a la vez que las de los demás.', 'bien');
  }
  // Alguien entra con un id nuevo pero con el nombre de un jugador que lleva rato sin responder (cambió de navegador
  // o se le cerró la pestaña): es él, y recupera su plaza y su reino en vez de quedarse con dos.
  function recuperarPlaza(conn, nombre) {
    nombre = String(nombre || 'Jugador').slice(0, 16);
    const j = red.jugadores.find(x => x.id !== 'anfitrion' && x.nombre === nombre && (x.visto == null || performance.now() - x.visto > 12000));
    if (!j) return null;
    const viejo = red.conns.get(j.id);
    red.conns.delete(j.id); j.id = conn.id; j.visto = performance.now();
    if (viejo && viejo !== conn) try { viejo.cerrar(); } catch (e) { /* ya no está */ }
    return j;
  }
  function mensajeAnfitrion(conn, d) {
    if (!d || typeof d !== 'object') return;
    let j = red.jugadores.find(x => x.id === conn.id);
    if (d.t === 'hola' && !j) j = recuperarPlaza(conn, d.nombre);
    if (d.t === 'pong' && j) { j.ping = Math.max(1, Math.round(performance.now() - (d.t0 || 0))); j.visto = performance.now(); return; }
    if (d.t === 'hola' && red.sala) { if (!j) red.jugadores.push({ id: conn.id, nombre: String(d.nombre || 'Jugador').slice(0, 16), civ: null, ping: null, visto: performance.now() }); difundirSala(); pintarSala(); avisoFlotante('🌐 Entra en la sala ' + String(d.nombre || 'un jugador').slice(0, 16), 3000); return; }
    if (d.t === 'hola') {
      if (!j) {
        // Si ya jugó en esta partida y salió, recupera su reino de antes (si nadie lo ha cogido).
        const nombre = String(d.nombre || 'Jugador').slice(0, 16), idos = red.idos || {};
        const antes = idos[conn.id] != null ? idos[conn.id] : idos['n:' + nombre];
        const c = antes != null ? S.civ(m, antes) : null;
        const libre = c && c.viva && !red.jugadores.some(x => x.civ === c.id);
        // Si su reino cayó mientras estaba fuera, sigue siendo el suyo: ha perdido y entra a mirar.
        j = { id: conn.id, nombre, civ: libre || (c && !c.viva) ? c.id : null, visto: performance.now() };
        red.jugadores.push(j);
        if (libre) red.cola.push({ tipo: 'unirse', civ: c.id });
        // Si es nuevo, le toca un reino libre al azar (en online no se elige); si no queda ninguno, mira.
        if (j.civ == null) {
          const libres = S.vivas(m).filter(x => !red.jugadores.some(y => y.civ === x.id));
          const otro = libres[Math.floor(Math.random() * libres.length)];
          if (otro) { j.civ = otro.id; red.cola.push({ tipo: 'unirse', civ: otro.id }); }
        }
      }
      mandarMundo(conn, j.civ, red.cargando); difundir({ t: 'jugadores', lista: red.jugadores }); pintarOnline(); avisoFlotante('🌐 Entra ' + String(d.nombre || 'un jugador').slice(0, 16), 3500); }
    else if (d.t === 'pideMundo') { if (!red.sala) mandarMundo(conn, null, red.cargando); }
    else if (d.t === 'listo' && j) { if (red.listos) red.listos.add(j.id); revisarCarga(); }
    else if (d.t === 'elijo') {
      // Sin elegir, le toca un pueblo libre al azar (de los que no gobierna nadie).
      const libres = S.vivas(m).filter(x => !red.jugadores.some(y => y.civ === x.id));
      const c = d.civ != null ? S.civ(m, d.civ) : libres[Math.floor(Math.random() * libres.length)] || null;
      const ocupado = !c || !c.viva || red.jugadores.some(x => x.civ === c.id && x.id !== conn.id);
      if (!j || j.civ != null) return; // ya tiene (o tuvo) reino: en online no se cambia
      if (ocupado) { conn.enviar({ t: 'ocupado' }); return; }
      j.civ = c.id; red.cola.push({ tipo: 'unirse', civ: c.id });
      conn.enviar({ t: 'eres', civ: c.id }); difundir({ t: 'jugadores', lista: red.jugadores }); pintarOnline();
    }
    else if (d.t === 'accion' && d.x && j && d.x.civ === j.civ) red.cola.push(d.x);
    else if (d.t === 'chat' && j) { const msg = { t: 'chat', de: j.nombre, texto: String(d.texto || '').slice(0, 140) }; difundir(msg); chat(msg); }
  }
  // Quien se une: entra con el código, recibe el mundo y elige pueblo.
  async function unirseOnline() {
    const codigo = ($('online-codigo').value || '').trim().toUpperCase();
    if (codigo.length < 4) { onlineEstado('Escribe el código que te ha dado el anfitrión.'); return; }
    if (red.uniendo) return;
    red.uniendo = true; red.cancelar = null; $('online-entrar').textContent = 'Cancelar';
    red.nombre = ($('online-nombre').value || 'Jugador').trim().slice(0, 16);
    onlineEstado('Buscando la partida ' + codigo + '…');
    try {
      await cargarPeer();
      apartarSolo();
      const conn = await conectarA(codigo);
      acabarTurno();
      red.modo = 'invitado'; red.codigo = codigo; red.conn = conn; red.esperandoMundo = true; red.pendientes = [];
      corriendo = true; programar();
      conn.al(d => mensajeInvitado(d));
      conn.alCerrar(() => { if (red.modo !== 'invitado') return; salirOnline(true); avisoFlotante('🌐 El anfitrión cerró la partida.', 6000); });
      conn.enviar({ t: 'hola', nombre: red.nombre });
      // Si el anfitrión deja de dar señales (su móvil en segundo plano, sin cobertura), se avisa; al volver, sigue.
      red.ultimoAnfitrion = performance.now(); clearInterval(red.vigia);
      red.vigia = setInterval(() => {
        if (red.modo !== 'invitado') { clearInterval(red.vigia); return; }
        pintarRedSala(); guardarSesion();
        const callado = performance.now() - red.ultimoAnfitrion > 9000;
        if (callado && !red.avisadoCallado) { red.avisadoCallado = true; avisoFlotante('⏳ El anfitrión no responde (¿ha salido del juego?). La partida sigue cuando vuelva.', 6000); onlineEstado('Esperando al anfitrión…'); }
        else if (!callado && red.avisadoCallado) { red.avisadoCallado = false; avisoFlotante('🌐 El anfitrión ha vuelto', 2500); onlineEstado(''); }
      }, 3000);
      red.sala = true; pintarSala({ jugadores: [{ nombre: red.nombre, ping: null }] });
      onlineEstado('Conectado con el anfitrión.');
      guardarSesion();
    } catch (e) { red.modo = null; red.solo = null; borrarSesion(); try { if (red.peer) red.peer.destroy(); } catch (x) { /* nada */ } onlineEstado(errorRed(e)); } finally { red.uniendo = false; red.cancelar = null; $('online-entrar').textContent = 'Unirse'; }
  }
  async function mensajeInvitado(d) {
    if (!d || typeof d !== 'object') return;
    red.ultimoAnfitrion = performance.now();
    if (d.t === 'ping') { enviarAnfitrion({ t: 'pong', t0: d.t0 }); return; }
    if (d.t === 'sala') { red.sala = true; red.ultimaSala = d; red.esperandoMundo = false; pintarSala(d); return; }
    if (d.t === 'carga') {
      if (red.sala || red.cargandoInv) {
        red.sala = false; red.cargandoInv = true; pintarSala(); $('online').hidden = true; $('inicio').hidden = true;
        if (d.fase === 'crear') { mostrarCarga('El anfitrión está creando el mundo…', 0.08); red.alTrozo = (k, n) => mostrarCarga('Recibiendo el mundo… ' + Math.round(100 * k / n) + '%', 0.1 + 0.5 * k / n); }
        if (d.lista) { pintarCarga(d.lista); const yo = d.lista.filter(j => j.listo).length; if (red.mundoOnline) mostrarCarga('Mundo cargado. Esperando a los demás… (' + yo + ' de ' + d.lista.length + ')', 0.6 + 0.4 * yo / d.lista.length); }
      }
      return;
    }
    if (d.t === 'arranca') {
      red.cargandoInv = false; ocultarCarga(); $('online').hidden = true; $('inicio').hidden = true;
      const c = S.civ(m, red.miCiv); if (c) P.centrarEn(c.capital, 3);
      responder('¡Empieza la partida! Gobiernas ' + nombreDe(red.miCiv) + '. Tus órdenes se cumplen al empezar cada turno, a la vez que las de los demás.', 'bien');
      return;
    }
    if (d.t === 'mundo') {
      if (d.eres != null) red.miCiv = d.eres;
      red.sala = false; pintarSala();
      if (d.carga) { red.cargandoInv = true; $('online').hidden = true; mostrarCarga('Cargando el mundo…', 0.62); }
      const txt = await descomprimir(d);
      const nuevo = JSON.parse(txt);
      // Los retos son de cada jugador: al recibir el mundo del anfitrión (que trae los suyos) se guardan los propios.
      // (Solo si ya estaba en esta partida online: los retos del solitario no se mezclan con los del online.)
      const yaEstaba = !!red.mundoOnline;
      const misRetos = red.mundoOnline && m && m.retos && red.miCiv != null && m.retos.civ === red.miCiv ? m.retos : null;
      red.mundoOnline = true;
      calculo = null; m = nuevo;
      if (red.miCiv != null) m.retos = misRetos || { civ: red.miCiv, hechos: {}, puntos: 0, conquistas: 0, desde: m.turno }; vel = d.vel || 0; corriendo = true;
      m.jugador = red.miCiv; m.modo = 'pueblo'; m.guia = { oculta: 1 };
      // Al recibir otra vez el mundo (para ponerse al día), la cámara se queda donde estaba: no salta a otro reino.
      P.mundo(m, !yaEstaba && red.miCiv == null); if (red.miCiv != null) { sel = red.miCiv; P.seleccionar(sel); }
      if (!yaEstaba && red.miCiv != null && !d.carga) { const c0 = S.civ(m, red.miCiv); if (c0 && c0.viva) P.centrarEn(c0.capital, 3); }
      red.jugadores = d.jugadores || [];
      red.esperandoMundo = false;
      red.pendientes = red.pendientes.filter(x => x.n > m.turno).sort((a, b) => a.n - b.n);
      pintarModo(); pintarTodo(); pintarOnline();
      $('online').hidden = true; $('inicio').hidden = true;
      // En la carga del principio, se avisa al anfitrión y se espera a su señal para empezar todos a la vez.
      if (d.carga) { enviarAnfitrion({ t: 'listo' }); mostrarCarga('Mundo cargado. Esperando a los demás…', 0.8); if (red.pendientes.length && !calculo) turnoRecibido(red.pendientes.shift()); return; }
      if (d.eres != null) { const c = S.civ(m, d.eres); if (!m.retos || m.retos.civ !== d.eres) m.retos = { civ: d.eres, hechos: {}, puntos: 0, conquistas: 0, desde: m.turno }; if (c && !c.viva) responder(c.nombre + ' cayó mientras estabas fuera: has perdido. Puedes seguir mirando la partida.', 'duda'); else if (c && !yaEstaba) P.centrarEn(c.capital, 3); if (c && c.viva && !yaEstaba) responder('¡Empieza la partida! Gobiernas ' + nombreDe(d.eres) + '. Tus órdenes se cumplen al empezar cada turno, a la vez que las de los demás.', 'bien'); }
      if (red.miCiv == null && !red.avisadoMirar) { red.avisadoMirar = true; responder('Todos los reinos tienen dueño: miras la partida como observador.', 'duda'); }
      if (red.pendientes.length && !calculo) turnoRecibido(red.pendientes.shift());
    }
    else if (d.t === 'turno') { if (!red.sala) turnoRecibido(d); }
    else if (d.t === 'eres') {
      red.miCiv = d.civ; m.jugador = d.civ; m.modo = 'pueblo'; sel = d.civ; P.seleccionar(sel);
      if (!m.retos || m.retos.civ !== d.civ) m.retos = { civ: d.civ, hechos: {}, puntos: 0, conquistas: 0, desde: m.turno };
      const c = S.civ(m, d.civ); if (c) P.centrarEn(c.capital, 3);
      responder('Gobiernas ' + nombreDe(d.civ) + ' en una partida online. Tus órdenes se cumplen al empezar cada turno, a la vez que las de los demás.', 'bien');
      pintarModo(); pintarTodo(); pintarOnline();
    }
    else if (d.t === 'ocupado') responder('Ese reino ya tiene dueño.', 'duda');
    else if (d.t === 'jugadores') { red.jugadores = d.lista || []; pintarOnline(); }
    else if (d.t === 'estado') { corriendo = !!d.corriendo; vel = d.vel || 0; pintarCabecera(); if (!d.corriendo && !red.cargandoInv) avisoFlotante('⏸ El anfitrión ha pausado la partida', 2500); }
    else if (d.t === 'chat') chat(d);
  }
  function turnoRecibido(msg) {
    if (red.modo !== 'invitado') return;
    if (red.esperandoMundo || calculo) { red.pendientes.push(msg); return; }
    if (msg.n <= m.turno) return;
    if (msg.n !== m.turno + 1 || msg.suma !== sumaMundo(m)) { red.esperandoMundo = true; red.pendientes = []; enviarAnfitrion({ t: 'pideMundo' }); return; }
    vel = msg.vel || 0;
    empezarTurno(msg);
  }
  // ---------- El chat online ----------
  // Una pestañita arriba a la izquierda: cerrada, los mensajes nuevos salen como burbujas que se apagan solas;
  // abierta, se ven los jugadores, los últimos mensajes y dónde escribir.
  function escapar(t) { return String(t).replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]); }
  // En el móvil, la columna de botones de la cámara va justo entre la cabecera y las órdenes (si no cabe, en dos columnas).
  function colocarCamara() {
    const cab = document.querySelector('.g-cab'), vol = document.querySelector('.g-voluntad'), cam = document.querySelector('.camara'); if (!cab || !vol || !cam) return;
    const caja = cam.offsetParent ? cam.offsetParent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const v = vol.getBoundingClientRect(), abajo = v.height && getComputedStyle(vol).display !== 'none' ? caja.bottom - v.top + 8 : 16;
    document.documentElement.style.setProperty('--cam-arriba', Math.round(cab.getBoundingClientRect().bottom - caja.top + 8) + 'px');
    document.documentElement.style.setProperty('--cam-abajo', Math.round(Math.max(16, abajo)) + 'px');
  }
  function colocarOnline() {
    const cab = document.querySelector('.g-cab'), b = $('online-barra'); if (!cab || !b) return;
    b.style.setProperty('--online-top', Math.round(cab.getBoundingClientRect().bottom + 8) + 'px');
  }
  function colorDe(nombre) { const j = red.jugadores.find(x => x.nombre === nombre); const c = j && j.civ != null ? S.civ(m, j.civ) : null; return c ? c.color : 'var(--oro)'; }
  function lineaChat(d) { return '<b style="color:' + colorDe(d.de) + '">' + escapar(d.de) + ':</b> ' + escapar(d.texto); }
  function chat(d) {
    red.mensajes = (red.mensajes || []).concat([d]).slice(-60);
    const log = $('online-log'), abajo = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
    const v = log.querySelector('.online-vacio'); if (v) v.remove();
    const p = document.createElement('p'); p.className = 'online-linea'; p.innerHTML = lineaChat(d); log.appendChild(p);
    while (log.children.length > 60) log.firstChild.remove();
    if (abajo) log.scrollTop = log.scrollHeight;
    if (!$('online-caja').hidden) return;
    red.sinLeer = (red.sinLeer || 0) + 1;
    const n = $('online-nuevos'); n.hidden = false; n.textContent = red.sinLeer > 9 ? '9+' : String(red.sinLeer);
    const bs = $('online-burbujas'), bu = document.createElement('div'); bu.className = 'online-burbuja'; bu.innerHTML = lineaChat(d); bs.appendChild(bu);
    while (bs.children.length > 3) bs.firstChild.remove();
    setTimeout(() => bu.classList.add('se-va'), 6000); setTimeout(() => bu.remove(), 6700);
  }
  function abrirChat(abrir) {
    const caja = $('online-caja'); caja.hidden = !abrir; $('online-chip').setAttribute('aria-expanded', String(abrir));
    if (!abrir) return;
    red.sinLeer = 0; $('online-nuevos').hidden = true; $('online-burbujas').textContent = '';
    const log = $('online-log'); log.scrollTop = log.scrollHeight;
    if (!movil()) $('online-msg').focus();
  }
  function chat0() { $('online-log').innerHTML = '<p class="online-vacio">Aún no hay mensajes.</p>'; $('online-burbujas').textContent = ''; red.mensajes = []; red.sinLeer = 0; $('online-nuevos').hidden = true; abrirChat(false); }
  // ---------- La partida online, persistente ----------
  // Cada uno recuerda en qué partida está (código y papel): si el móvil cierra el juego, al volver se reconecta solo.
  // El anfitrión, además, guarda aparte el mundo online y la sala: al volver la reabre con el mismo código.
  const SESION = 'genesis.sesion', ONLINE = 'genesis.online';
  function guardarSesion() {
    if (!enLinea()) return;
    try { localStorage.setItem(SESION, JSON.stringify({ rol: red.modo, codigo: red.codigo, nombre: red.nombre, t: Date.now() })); } catch (e) { /* sin guardado */ }
  }
  function leerSesion() { try { const s = JSON.parse(localStorage.getItem(SESION) || 'null'); if (s && s.codigo && Date.now() - s.t < 30 * 60e3) return s; if (s) borrarSesion(); return null; } catch (e) { return null; } }
  function borrarSesion() { try { localStorage.removeItem(SESION); localStorage.removeItem(ONLINE); } catch (e) { /* nada */ } }
  let guardandoOnline = false;
  function guardarOnline() {
    if (red.modo !== 'anfitrion' || guardandoOnline) return;
    guardarSesion();
    acabarTurno();
    let json; try { json = JSON.stringify({ codigo: red.codigo, sala: red.sala || red.cargando, jugadores: red.jugadores.map(j => ({ id: j.id, nombre: j.nombre, civ: j.civ })), idos: red.idos || null, miCiv: red.miCiv, vel, reinos: $('sala-reinos').value, libre: $('sala-libre').checked, mundo: red.sala || red.cargando ? null : m }); } catch (e) { return; }
    const poner = t => { try { localStorage.setItem(ONLINE, t); } catch (e) { /* sin sitio */ } };
    if (typeof CompressionStream !== 'function') { poner(json); return; }
    guardandoOnline = true;
    new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
      .then(buf => poner('gz:' + aB64(buf))).catch(() => poner(json)).finally(() => { guardandoOnline = false; });
  }
  async function leerOnline() {
    let t = null; try { t = localStorage.getItem(ONLINE); } catch (e) { return null; }
    if (!t) return null;
    try {
      if (t.slice(0, 3) === 'gz:') t = await new Response(new Blob([deB64(t.slice(3))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      return JSON.parse(t);
    } catch (e) { return null; }
  }
  // Al abrir el juego: si estabas en una partida online, se pregunta si vuelves a ella o la dejas.
  function volverAPartida() {
    const ses = leerSesion(); if (!ses || enLinea()) return;
    $('inicio').hidden = true; $('online').hidden = false;
    $('online-entrada').hidden = true; $('online-intro').hidden = true; $('online-volver').hidden = false;
    $('online-volver-texto').textContent = 'Tienes una partida online a medias (' + ses.codigo + (ses.rol === 'anfitrion' ? ', la creaste tú' : '') + '). ¿Vuelves a ella?';
    const fin = () => { $('online-volver').hidden = true; $('online-entrada').hidden = false; $('online-intro').hidden = false; };
    $('online-volver-si').onclick = () => { fin(); reanudarPartida(ses); };
    $('online-volver-no').onclick = () => { fin(); borrarSesion(); $('online').hidden = true; pedirModo('Has dejado la partida online', 'Elige cómo jugar, o «🌐 Jugar online» para entrar en otra partida.'); };
  }
  async function reanudarPartida(ses) {
    if (enLinea()) return;
    $('online-nombre').value = ses.nombre || '';
    if (ses.rol === 'invitado') { $('online-codigo').value = ses.codigo; onlineEstado('Volviendo a tu partida online ' + ses.codigo + '…'); unirseOnline(); return; }
    const d = await leerOnline();
    if (!d || d.codigo !== ses.codigo) { borrarSesion(); $('online').hidden = true; if (!m.modo) pedirModo(); return; }
    onlineEstado('Reabriendo tu partida ' + ses.codigo + '…');
    apartarSolo(); corriendo = false; programar();
    try {
      await cargarPeer();
      await abrirAnfitrion(ses.codigo, nuevoInvitado);
      red.modo = 'anfitrion'; red.codigo = ses.codigo; red.nombre = ses.nombre || 'Anfitrión'; red.miCiv = d.miCiv; red.idos = d.idos || null;
      red.jugadores = d.jugadores.map(j => Object.assign({ ping: j.id === 'anfitrion' ? 0 : null }, j));
      if (d.reinos) $('sala-reinos').value = d.reinos; $('sala-libre').checked = !!d.libre;
      red.latido = setInterval(latido, 2000);
      if (d.sala || !d.mundo) {
        red.sala = true; onlineEstado(''); pintarSala(); pintarOnline();
        for (const j of red.jugadores) if (j.id !== 'anfitrion') red.conectarId(j.id);
        difundirSala();
      } else {
        red.sala = false; red.mundoOnline = true; calculo = null; m = d.mundo; vel = d.vel || 0;
        m.jugador = red.miCiv; m.modo = 'pueblo'; sel = red.miCiv; P.mundo(m, false); P.seleccionar(sel); if (tuPueblo()) P.centrarEn(tuPueblo().capital, 3);
        $('online').hidden = true; pintarModo(); pintarTodo(); pintarOnline();
        // A cada jugador se le manda el mundo tal como lo tiene el anfitrión, y se sigue desde ahí.
        for (const j of red.jugadores) if (j.id !== 'anfitrion') { const c = red.conectarId(j.id); await mandarMundo(c, j.civ); }
        difundir({ t: 'jugadores', lista: red.jugadores });
        corriendo = true; programar();
        responder('Has vuelto a tu partida online ' + red.codigo + '. Sigue donde se quedó.', 'bien');
      }
      guardarSesion();
    } catch (e) { red.solo = null; corriendo = !!m.modo; programar(); onlineEstado('No se pudo reabrir la partida: ' + errorRed(e)); }
  }
  // La partida en solitario se aparta al entrar en una online (con sus retos y su mundo) y se recupera al salir.
  function apartarSolo() {
    if (enLinea() || red.solo) return;
    acabarTurno(); guardar();
    try { red.solo = { json: JSON.stringify(m), sel, vel }; } catch (e) { red.solo = null; }
  }
  function volverASolo() {
    const s = red.solo; red.solo = null;
    let vuelto = null; try { vuelto = s ? JSON.parse(s.json) : null; } catch (e) { vuelto = null; }
    calculo = null;
    if (vuelto) { m = vuelto; vel = s.vel || 0; P.mundo(m, !(m.modo === 'pueblo' && m.jugador != null)); sel = s.sel != null ? s.sel : m.jugador; P.seleccionar(sel); if (tuPueblo()) P.centrarEn(tuPueblo().capital, 3); }
    else mundoNuevo();
    corriendo = !!m.modo; programar(); pintarModo(); pintarTodo();
    if (!m.modo) pedirModo();
    return !!vuelto;
  }
  function salirOnline(silencioso) {
    const era = red.modo;
    if (era === 'anfitrion') { for (const c of red.conns.values()) c.cerrar(); }
    else if (era === 'invitado' && red.conn) red.conn.cerrar();
    try { if (red.peer) red.peer.destroy(); } catch (e) { /* ya cerrado */ }
    clearInterval(red.latido); clearInterval(red.vigia); clearTimeout(red.esperaCarga); chat0(); ocultarCarga(); borrarSesion();
    red.cargando = false; red.cargandoInv = false; red.mundoOnline = false; red.listos = null;
    Object.assign(red, { avisadoMirar: false, canal: null, modo: null, peer: null, conns: new Map(), conn: null, codigo: null, jugadores: [], cola: [], pendientes: [], esperandoMundo: false, sala: false, ultimaSala: null, miCiv: null, idos: null });
    pintarSala();
    for (const id of ['play', 'vel', 'nuevo', 'modo-dios']) { const e = $(id); if (e) e.disabled = false; }
    pintarOnline();
    $('online').hidden = true; $('fin').hidden = true;
    const habia = volverASolo();
    // Siempre al menú principal, explicando dónde estás: así no parece que te haya mandado a otra partida.
    pedirModo('Has salido de la partida online', habia ? 'Detrás está tu partida en solitario, tal como la dejaste: elige cómo seguir con ella, o vuelve a «🌐 Jugar online» para entrar en otra.' : 'Elige cómo jugar en solitario, o vuelve a «🌐 Jugar online» para entrar en otra partida.');
  }
  function atarOnline() {
    const n = $('online-nombre'); try { n.value = localStorage.getItem('genesis.nombre') || ''; } catch (e) { /* sin preferencia */ }
    n.addEventListener('change', () => { try { localStorage.setItem('genesis.nombre', n.value.trim()); } catch (e) { /* sin guardado */ } });
    $('modo-online').addEventListener('click', () => { $('inicio').hidden = true; $('online').hidden = false; onlineEstado(enLinea() && !red.sala ? 'Ya estás en una partida (código ' + red.codigo + ').' : ''); pintarSala(); });
    $('online-cerrar').addEventListener('click', () => { $('online').hidden = true; });
    $('online-crear').addEventListener('click', () => { if (!enLinea()) crearOnline(); });
    $('online-entrar').addEventListener('click', () => { if (red.uniendo) { if (red.cancelar) red.cancelar(); } else if (!enLinea()) unirseOnline(); });
    $('online-salir').addEventListener('click', () => salirOnline(false));
    $('sala-empezar').addEventListener('click', () => empezarSala());
    $('sala-salir').addEventListener('click', () => salirOnline(true));
    $('sala-invitar').addEventListener('click', () => $('online-invitar').click());
    for (const id of ['sala-reinos', 'sala-libre']) $(id).addEventListener('change', () => { if (red.modo === 'anfitrion' && red.sala) difundirSala(); });
    // Invitar: un enlace al juego que ya trae el código (se comparte o se copia).
    $('online-invitar').addEventListener('click', async () => {
      const url = location.href.split('#')[0] + '#unirse=' + red.codigo, texto = '¡Juega conmigo a Génesis! Código: ' + red.codigo;
      try { if (navigator.share) { await navigator.share({ title: 'Génesis', text: texto, url }); return; } } catch (e) { /* cancelado */ }
      try { await navigator.clipboard.writeText(texto + ' ' + url); avisoFlotante('🔗 Enlace copiado: pégalo a tus amigos', 3500); } catch (e) { avisoFlotante('Código: ' + red.codigo, 5000); }
    });
    $('carga-ya').addEventListener('click', arrancarPartida);
    $('online-chip').addEventListener('click', () => abrirChat($('online-caja').hidden));
    $('online-ocultar').addEventListener('click', () => abrirChat(false));
    $('online-msg').addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); abrirChat(false); } });
    window.addEventListener('resize', colocarOnline);
    window.addEventListener('resize', colocarCamara);
    if (window.ResizeObserver) { const ro = new ResizeObserver(colocarCamara); for (const sel of ['.g-cab', '.g-voluntad']) { const e = document.querySelector(sel); if (e) ro.observe(e); } }
    colocarCamara();
    $('online-chat').addEventListener('submit', ev => { ev.preventDefault(); const t = $('online-msg').value.trim(); if (!t) return; $('online-msg').value = ''; if (red.modo === 'anfitrion') { const msg = { t: 'chat', de: red.nombre, texto: t.slice(0, 140) }; difundir(msg); chat(msg); } else enviarAnfitrion({ t: 'chat', texto: t }); });
    // Abrir el juego con #unirse=CODIGO (un enlace que comparte el anfitrión) rellena el código.
    const invitacion = () => { const h = location.hash.match(/unirse=([A-Z0-9]{4,8})/i); if (h && !enLinea()) { $('online-codigo').value = h[1].toUpperCase(); $('inicio').hidden = true; $('online').hidden = false; } };
    invitacion(); window.addEventListener('hashchange', invitacion);
    window.genesis = Object.assign(window.genesis || {}, { red: () => ({ modo: red.modo, codigo: red.codigo, jugadores: red.jugadores, miCiv: red.miCiv, turno: m.turno, suma: sumaMundo(m) }) });
  }

  function programar() {
    clearInterval(reloj);
    if (corriendo) reloj = setInterval(paso, VELOCIDADES[vel][0]);
    if (red.modo === 'anfitrion') difundir({ t: 'estado', corriendo, vel });
    pintarCabecera();
  }
