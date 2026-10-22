  // ── GÉNESIS · LA VISTA · En línea: varios jugadores en el mismo mundo ──

  // ---------- EN LÍNEA: varios jugadores en el mismo mundo ----------
  /*
   * Sin servidor propio: los navegadores se conectan directamente (WebRTC; PeerJS solo les ayuda a encontrarse).
   * El anfitrión lleva el reloj: en cada turno manda a todos las órdenes de ese turno, y cada navegador calcula el
   * mismo turno con las mismas órdenes (la simulación es reproducible), así que no hace falta mandar el mundo
   * entero cada vez. Quien entra recibe el mundo una vez, comprimido. Si un mundo se separa del del anfitrión (la
   * suma de control no cuadra), el anfitrión le vuelve a mandar el suyo.
   */
  const red = { modo: null, peer: null, conns: new Map(), conn: null, codigo: null, nombre: '', jugadores: [], cola: [], pendientes: [], esperandoMundo: false, miCiv: null };
  const enLinea = () => !!red.modo;
  const PREFIJO = 'genesis-rfigh-';
  const ordenarLocal = X.ordenar, encargarLocal = M.vida.encargar;
  // En línea, las órdenes y los encargos no se cumplen en el acto: van al turno siguiente, para todos a la vez.
  X.ordenar = function (mm, civ, texto) {
    if (enLinea() && mm === m) { encolar({ tipo: 'orden', civ, texto }); return { ok: true, acciones: [], respuesta: '📡 Orden enviada: se cumple al empezar el próximo turno.' }; }
    return ordenarLocal.apply(this, arguments);
  };
  M.vida.encargar = function (mm, c, t, clave) {
    if (enLinea() && mm === m) { encolar({ tipo: 'encargo', civ: c.id, t, clave }); return { ok: true, enviado: true }; }
    return encargarLocal.apply(this, arguments);
  };
  function encolar(x) { if (red.modo === 'anfitrion') red.cola.push(x); else if (red.modo === 'invitado') enviarAnfitrion({ t: 'accion', x }); }
  function aplicarAcciones(lista) {
    let ordenes = 0;
    for (const x of lista || []) {
      const c = S.civ(m, x.civ); if (!c) continue;
      if (x.tipo === 'orden') {
        const r = ordenarLocal(m, x.civ, x.texto); ordenes++;
        if (x.civ === m.jugador) responder(r.ok ? (r.respuesta || 'Hecho.') : (r.respuesta || 'Tu gente no entiende la orden.'), r.ok ? 'bien' : 'duda');
      } else if (x.tipo === 'encargo') encargarLocal(m, c, x.t, x.clave);
      else if (x.tipo === 'oficio') { const a = m.vida.aldeanos.find(q => q.id === x.id); if (a && a.c === x.civ) { a.fijo = { g: 'mano', vuelve: a.o }; M.vida.mover(a, x.k); } }
      else if (x.tipo === 'unirse') X.unirse(m, x.civ);
      else if (x.tipo === 'salir') c.jugador = false;
    }
    if (ordenes) M.vida.ajustar(m);
  }
  // La suma de control: lo que de verdad cuenta en la simulación (no la cámara, ni la guía, ni los retos).
  function sumaMundo(mm) {
    let s = (mm.turno * 7 + Math.round(mm.anio)) | 0;
    for (const c of mm.civs) s = (s * 31 + (c.viva ? 1 : 2) + c.era * 3 + Math.round(c.pob || 0) + Math.round(c.madera || 0) * 5 + Math.round(c.oro || 0) * 11) | 0;
    const v = mm.vida;
    if (v) { s = (s * 31 + v.aldeanos.length) | 0; for (const a of v.aldeanos) s = (s * 31 + a.x * 131 + a.y * 7 + a.o) | 0; }
    for (let i = 0; i < mm.dueno.length; i++) s = (s * 31 + mm.dueno[i]) | 0;
    return s;
  }
  // El transporte: PeerJS (de cdnjs) en internet; con ?red=local, un canal entre pestañas del mismo navegador (para probar).
  // EL TRANSPORTE. Por defecto, un servidor de mensajes (MQTT por WebSocket): cada uno se conecta al servidor y
  // el servidor reparte los mensajes, así que funciona con cualquier red (datos móviles, routers, wifis cerradas).
  // Con ?red=local, un canal entre pestañas del mismo navegador (para probar); con ?red=peer, PeerJS (directo).
  const transporte = /[?&]red=local\b/.test(location.search) ? 'local' : /[?&]red=peer\b/.test(location.search) ? 'peer' : 'servidor';
  const redLocal = transporte !== 'peer';
  // Servidores públicos y gratuitos (no hace falta cuenta). Con ?servidor=wss://… se usa otro (uno propio).
  const propio = (location.search.match(/[?&]servidor=([^&]+)/) || [])[1];
  const SERVIDORES = propio ? [decodeURIComponent(propio)] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  // Un cliente MQTT mínimo (3.1.1, calidad 0): conectar, suscribirse a mi buzón, publicar en el de otro y latir.
  function clienteMqtt(url, buzon, alMensaje) {
    return new Promise((ok, mal) => {
      const enc = new TextEncoder(), dec = new TextDecoder();
      const str = t => { const b = enc.encode(t); return [b.length >> 8, b.length & 255, ...b]; };
      const largo = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
      const paquete = (tipo, cuerpo) => new Uint8Array([tipo, ...largo(cuerpo.length), ...cuerpo]);
      let ws, latir = null, buf = new Uint8Array(0), listo = false, cerrado = false, yaConecto = false, espera = 1000;
      const conectar = () => {
        try { ws = new WebSocket(url, 'mqtt'); } catch (e) { mal(e); return; }
        ws.binaryType = 'arraybuffer';
        const t = setTimeout(() => { if (!listo) { try { ws.close(); } catch (e) { /* nada */ } if (!yaConecto) mal(new Error('el servidor no responde')); } }, 7000);
        ws.onopen = () => {
          const id = 'gen' + Math.random().toString(36).slice(2, 12);
          ws.send(paquete(0x10, [...str('MQTT'), 4, 0x02, 0, 60, ...str(id)]));
        };
        ws.onmessage = ev => {
          const nuevo = new Uint8Array(ev.data), b = new Uint8Array(buf.length + nuevo.length); b.set(buf); b.set(nuevo, buf.length); buf = b;
          for (;;) {
            if (buf.length < 2) break;
            let n = 0, mult = 1, i = 1, d;
            do { if (i >= buf.length) return; d = buf[i++]; n += (d & 127) * mult; mult *= 128; } while (d & 128);
            if (buf.length < i + n) break;
            const tipo = buf[0] >> 4, cuerpo = buf.subarray(i, i + n); buf = buf.slice(i + n);
            if (tipo === 2) ws.send(paquete(0x82, [0, 1, ...str(buzon), 0])); // CONNACK → me suscribo a mi buzón
            else if (tipo === 9) { clearTimeout(t); listo = true; yaConecto = true; espera = 1000; latir = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch (e) { /* nada */ } }, 20000); ok(api); } // SUBACK
            else if (tipo === 3) { const lt = (cuerpo[0] << 8) | cuerpo[1]; alMensaje(dec.decode(cuerpo.subarray(2 + lt))); }
          }
        };
        // Una vez conectado, si se corta, se reintenta sin parar (cada vez un poco más tarde, hasta 10 s).
        ws.onclose = () => { clearInterval(latir); listo = false; if (yaConecto && !cerrado) { setTimeout(reconectar, espera); espera = Math.min(10000, espera * 1.6); } };
        ws.onerror = () => { /* lo trata onclose */ };
      };
      // Si se corta (pantalla apagada, otra app, cambio de red), se vuelve a conectar solo, y al volver a la app.
      const reconectar = () => { if (cerrado || listo) return; buf = new Uint8Array(0); conectar(); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !listo && !cerrado) reconectar(); });
      const api = {
        publicar: (tema, texto) => { if (!listo) return false; const cuerpo = [...str(tema), ...enc.encode(texto)]; try { ws.send(paquete(0x30, cuerpo)); return true; } catch (e) { return false; } },
        cerrar: () => { cerrado = true; clearInterval(latir); try { ws.send(new Uint8Array([0xE0, 0])); ws.close(); } catch (e) { /* nada */ } },
        conectado: () => listo
      };
      conectar();
    });
  }
  // Los mensajes van en JSON (lo binario, en base64) y en trozos si son grandes (el mundo entero ocupa bastante).
  const aTexto = x => JSON.stringify(x, (k, v) => v instanceof Uint8Array ? { __b64: btoa(Array.from(v, c => String.fromCharCode(c)).join('')) } : v);
  const deTexto = t => JSON.parse(t, (k, v) => v && v.__b64 != null ? Uint8Array.from(atob(v.__b64), c => c.charCodeAt(0)) : v);
  // Un «canal» con la misma forma que el BroadcastChannel de pruebas: postMessage({ de, para, … }) y onmessage.
  async function crearCanal(base, yo, indice) {
    if (transporte === 'local') { const bc = new BroadcastChannel(base); return { postMessage: x => bc.postMessage(x), set onmessage(f) { bc.onmessage = f; }, close: () => bc.close(), servidor: null }; }
    const canal = { onmessage: null, close: () => cli && cli.cerrar() }, trozos = {};
    const llega = t => {
      let x; try { x = deTexto(t); } catch (e) { return; }
      if (x.__trozo) { const q = trozos[x.__trozo] = trozos[x.__trozo] || []; q[x.i] = x.s; const hay = q.filter(v => v != null).length; if (red.alTrozo && x.n > 1) red.alTrozo(hay, x.n); if (hay === x.n) { delete trozos[x.__trozo]; llega(q.join('')); } return; }
      if (canal.onmessage) canal.onmessage({ data: x });
    };
    const lista = indice != null && SERVIDORES[indice] ? [SERVIDORES[indice]] : SERVIDORES;
    let cli = null, error = null;
    for (const url of lista) { try { cli = await clienteMqtt(url, base + '/' + yo, llega); canal.servidor = SERVIDORES.indexOf(url); break; } catch (e) { error = e; } }
    if (!cli) throw new Error('No se puede conectar con el servidor de partidas' + (lista.length === 1 ? ' (' + nombreServidor(SERVIDORES.indexOf(lista[0])) + ')' : '') + ': ' + ((error && error.message) || 'sin respuesta') + '. Comprueba internet; si funciona, puede que esta red (wifi o datos) bloquee el servidor: prueba con la otra.');
    canal.postMessage = x => {
      const t = aTexto(x), tema = base + '/' + x.para;
      if (t.length < 60000) { cli.publicar(tema, t); return; }
      const id = Math.random().toString(36).slice(2, 10), n = Math.ceil(t.length / 60000);
      for (let i = 0; i < n; i++) cli.publicar(tema, JSON.stringify({ __trozo: id, i, n, s: t.slice(i * 60000, (i + 1) * 60000) }));
    };
    canal.conectado = () => cli.conectado();
    return canal;
  }
  function cargarPeer() {
    if (redLocal || window.Peer) return Promise.resolve();
    return new Promise((ok, mal) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js'; sc.onload = ok; sc.onerror = () => mal(new Error('sin conexión')); document.head.appendChild(sc); });
  }
  function conexionLocal(canal, yo, otro) {
    const fns = [], cierres = [];
    const c = { id: otro, enviar: d => canal.postMessage({ de: yo, para: otro, d }), al: f => fns.push(f), alCerrar: f => cierres.push(f), cerrar: () => { canal.postMessage({ de: yo, para: otro, fin: 1 }); }, _llega: d => fns.forEach(f => f(d)), _fin: () => cierres.forEach(f => f()) };
    return c;
  }
  // Servidores para atravesar routers y redes móviles: STUN de Google y, si hace falta, un TURN público (relé).
  const OPCIONES_PEER = { debug: 0, config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
  ] } };
  // Los errores de PeerJS, en cristiano (y qué hacer).
  function errorRed(e) {
    const t = (e && e.type) || '', msg = (e && e.message) || '';
    if (t === 'peer-unavailable' || /could not connect to peer/i.test(msg)) return 'No se encuentra esa partida. Revisa el código y que el anfitrión tenga el juego abierto en pantalla (si lo deja en segundo plano, el móvil corta la conexión).';
    if (t === 'unavailable-id') return 'Ese código ya está en uso. Vuelve a crear la partida.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No hay conexión con el servidor de partidas. Comprueba internet y vuelve a intentarlo.';
    if (t === 'browser-incompatible') return 'Este navegador no puede jugar online. Prueba con Chrome, Safari o Firefox actualizados.';
    return msg || 'error de conexión';
  }
  // Si el móvil corta la conexión con el servidor (pantalla apagada, otra app), el anfitrión se vuelve a dar de alta.
  function mantenerVivo(peer) {
    peer.on('disconnected', () => { setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { /* se intenta al volver */ } }, 800); });
    document.addEventListener('visibilitychange', () => { try { if (document.visibilityState === 'visible' && !peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { /* nada */ } });
  }
  function envolver(pc) { const c = { id: pc.peer, enviar: d => { try { pc.send(d); } catch (e) { /* conexión caída */ } }, al: f => pc.on('data', f), alCerrar: f => { pc.on('close', f); pc.on('error', f); }, cerrar: () => pc.close() }; return c; }
  function abrirAnfitrion(codigo, alConectar) {
    if (redLocal) return crearCanal(PREFIJO + codigo, 'anfitrion', indiceServidor(codigo)).then(canal => {
      const conns = {};
      // Un jugador que el anfitrión ya conocía (porque este volvió tras cerrarse el juego) no vuelve a llamar:
      // se le abre la conexión al llegar su primer mensaje, o al recuperar la partida (red.conectarId).
      const abrir = id => { const c = conns[id] = conexionLocal(canal, 'anfitrion', id); alConectar(c); return c; };
      red.conectarId = id => conns[id] || abrir(id);
      canal.onmessage = ev => { const x = ev.data; if (x.para !== 'anfitrion') return; if (x.abrir) { abrir(x.de); canal.postMessage({ de: 'anfitrion', para: x.de, listo: 1 }); return; } let c = conns[x.de]; if (!c && !x.fin && red.jugadores.some(j => j.id === x.de)) c = abrir(x.de); if (!c) return; if (x.fin) { c._fin(); delete conns[x.de]; } else c._llega(x.d); };
      red.peer = { destroy: () => canal.close() }; red.servidor = canal.servidor; red.canal = canal;
    });
    return new Promise((ok, mal) => {
      const peer = new window.Peer(PREFIJO + codigo, OPCIONES_PEER); red.peer = peer;
      let abierto = false;
      peer.on('open', () => { abierto = true; ok(); });
      // Una vez abierta, los errores sueltos (un invitado que no llega) no cierran la partida.
      peer.on('error', e => { if (!abierto) mal(e); else onlineEstado('Aviso de la red: ' + errorRed(e)); });
      mantenerVivo(peer);
      peer.on('connection', pc => pc.on('open', () => alConectar(envolver(pc))));
    });
  }
  // Cada jugador tiene su id guardado en el navegador (aunque el móvil cierre la app): si sale y vuelve a entrar,
  // el anfitrión sabe que es el mismo y le devuelve su reino. Para probar con pestañas (?red=local), uno por pestaña.
  function miId() {
    let id = null, alm = null;
    try { alm = transporte === 'local' ? sessionStorage : localStorage; id = alm.getItem('genesis.yo'); } catch (e) { /* sin almacenamiento */ }
    if (!id) { id = 'j' + Math.random().toString(36).slice(2, 10); try { alm.setItem('genesis.yo', id); } catch (e) { /* nada */ } }
    return id;
  }
  const nombreServidor = i => { const u = SERVIDORES[i] || ''; return /emqx/.test(u) ? 'EMQX' : /hivemq/.test(u) ? 'HiveMQ' : /mosquitto/.test(u) ? 'Mosquitto' : u.replace(/^wss?:\/\//, '').split(/[:/]/)[0] || 'local'; };
  // El estado de la conexión con el servidor, a la vista en la sala: así se sabe si falla internet o el otro.
  function pintarRedSala() {
    const e = $('sala-red'); if (!e) return;
    const c = red.canal;
    if (!c || !c.conectado) { e.textContent = ''; return; }
    e.textContent = c.conectado() ? '🟢 Conectado al servidor de partidas (' + nombreServidor(c.servidor) + ')' : '🟠 Sin conexión con el servidor: reconectando…';
  }
  function conectarA(codigo) {
    if (redLocal) {
      const yo = miId();
      return crearCanal(PREFIJO + codigo, yo, indiceServidor(codigo)).then(canal => new Promise((ok, mal) => {
        const c = conexionLocal(canal, yo, 'anfitrion');
        let hecho = false, intentos = 0;
        // Se llama al anfitrión cada 2 segundos hasta que conteste (por si estaba volviendo a la app).
        // Se llama al anfitrión cada 2 segundos hasta 3 minutos: si ha salido a otra app (a mandar el código), al volver contesta.
        const llamar = () => {
          if (hecho) return;
          if (++intentos > 90) { hecho = true; canal.close(); mal(new Error('El servidor funciona, pero la partida ' + codigo + ' no contesta. Revisa el código y que el anfitrión tenga el juego abierto en pantalla, con la sala creada.')); return; }
          if (intentos > 2) onlineEstado('✓ Conectado al servidor de partidas (' + nombreServidor(canal.servidor) + '). Buscando la partida ' + codigo + '… El anfitrión aún no contesta: si ha salido a otra app (por ejemplo, a mandar el código), en cuanto vuelva al juego entraréis. (' + Math.round(intentos * 2) + ' s)');
          canal.postMessage({ de: yo, para: 'anfitrion', abrir: 1 }); setTimeout(llamar, 2000);
        };
        red.cancelar = () => { if (hecho) return; hecho = true; canal.close(); mal(new Error('Búsqueda cancelada.')); };
        canal.onmessage = ev => { const x = ev.data; if (x.para !== yo) return; if (x.listo) { if (!hecho) { hecho = true; ok(c); } } else if (x.fin) c._fin(); else c._llega(x.d); };
        red.peer = { destroy: () => canal.close() }; red.servidor = canal.servidor; red.canal = canal;
        llamar();
      }));
    }
    // Si el anfitrión no aparece (aún está volviendo a la app, o se reconecta), se reintenta unas cuantas veces.
    return new Promise((ok, mal) => {
      const peer = new window.Peer(OPCIONES_PEER); red.peer = peer;
      let hecho = false, intentos = 0;
      const fin = (f, x) => { if (hecho) return; hecho = true; clearTimeout(t); f(x); };
      const t = setTimeout(() => fin(mal, new Error('No se encuentra esa partida. Revisa el código y que el anfitrión tenga el juego abierto en pantalla.')), 40000);
      const intentar = () => {
        if (hecho) return;
        intentos++;
        const pc = peer.connect(PREFIJO + codigo, { reliable: true });
        pc.on('open', () => fin(ok, envolver(pc)));
        pc.on('error', e => { if (!hecho) onlineEstado('Buscando la partida ' + codigo + '… (intento ' + intentos + ')'); });
      };
      peer.on('error', e => {
        // «No existe ese peer»: el anfitrión puede estar reconectándose. Se vuelve a probar dentro de 3 segundos.
        if (e && e.type === 'peer-unavailable' && intentos < 10) { onlineEstado('Buscando la partida ' + codigo + '… (intento ' + intentos + '; que el anfitrión tenga el juego abierto)'); setTimeout(intentar, 3000); return; }
        fin(mal, new Error(errorRed(e)));
      });
      peer.on('open', intentar);
    });
  }
  const comprimir = txt => typeof CompressionStream === 'function' ? new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(b => ({ gz: new Uint8Array(b) })) : Promise.resolve({ txt });
  const descomprimir = d => d.gz ? new Response(new Blob([d.gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : Promise.resolve(d.txt);
  function difundir(msg) { for (const c of red.conns.values()) c.enviar(msg); }
  function enviarAnfitrion(msg) { if (red.conn) red.conn.enviar(msg); }
  function nombreDe(civ) { const c = civ != null ? S.civ(m, civ) : null; return c ? c.nombre : '—'; }
  function onlineEstado(t) { const e = $('online-estado'); if (e) e.textContent = t || ''; }
  function pintarOnline() {
    const b = $('online-barra'); if (!b) return;
    b.hidden = !enLinea();
    // En online no se cambia de modo: ese botón sirve para salir de la partida (con un segundo toque para confirmar).
    $('cambiar-modo').disabled = false; if (!red.confirmarSalir) $('cambiar-modo').textContent = enLinea() ? 'Salir de la partida online' : 'Cambiar de modo';
    if (!enLinea()) return;
    colocarOnline();
    $('online-codigo-ver').textContent = '🌐 ' + red.codigo;
    $('online-cuantos').textContent = '👥 ' + red.jugadores.length + ' · 💬';
    $('online-jugadores').innerHTML = red.jugadores.map(j => { const c = j.civ != null ? S.civ(m, j.civ) : null; return '<li><i style="background:' + (c ? c.color : '#555') + '"></i>' + escapar(j.nombre) + (c ? ' <span class="tenue">' + escapar(c.nombre) + (c.viva ? '' : ' 💀') + '</span>' : ' <span class="tenue">eligiendo…</span>') + '</li>'; }).join('');
    for (const id of ['play', 'vel', 'nuevo', 'modo-dios']) { const e = $(id); if (e) e.disabled = red.modo === 'invitado' || (id !== 'play' && id !== 'vel' && red.modo === 'anfitrion'); }
    $('online-invitar').hidden = red.modo !== 'anfitrion';
  }
  const nuevoCodigo = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  // El código lleva al final qué servidor usa el anfitrión (2, 3 o 4), para que todos vayan al mismo.
  const indiceServidor = codigo => { const d = +String(codigo).slice(-1); return codigo.length === 6 && d >= 2 && d <= 1 + SERVIDORES.length ? d - 2 : null; };
  // El anfitrión: abre la partida con un código y espera a los demás.
  async function crearOnline() {
    red.nombre = ($('online-nombre').value || 'Anfitrión').trim().slice(0, 16);
    onlineEstado('Abriendo la sala…');
    apartarSolo(); corriendo = false; programar();
    try {
      await cargarPeer();
      // Con el servidor de mensajes, el código lleva al final qué servidor respondió (por si alguno está caído).
      const base = nuevoCodigo(); let codigo = base;
      if (transporte === 'servidor') {
        let error = null, abierto = false;
        for (let i = 0; i < SERVIDORES.length && !abierto; i++) { codigo = base + (i + 2); try { await abrirAnfitrion(codigo, nuevoInvitado); abierto = true; } catch (e) { error = e; } }
        if (!abierto) throw error || new Error('sin conexión');
      } else await abrirAnfitrion(codigo, nuevoInvitado);
      // LA SALA: antes de crear el mundo, todos esperan aquí; se ve quién está y cómo va su conexión.
      red.modo = 'anfitrion'; red.codigo = codigo; red.miCiv = null; red.sala = true;
      red.jugadores = [{ id: 'anfitrion', nombre: red.nombre, civ: null, ping: 0 }];
      corriendo = false; programar();
      onlineEstado('');
      pintarSala(); pintarOnline();
      red.latido = setInterval(latido, 2000);
      guardarOnline();
    } catch (e) { red.solo = null; corriendo = !!m.modo; programar(); onlineEstado('No se pudo abrir la partida: ' + errorRed(e)); }
  }
  function nuevoInvitado(conn) {
    red.conns.set(conn.id, conn);
    conn.al(d => mensajeAnfitrion(conn, d));
    conn.alCerrar(() => {
      if (!red.conns.has(conn.id)) return;
      red.conns.delete(conn.id);
      const j = red.jugadores.find(x => x.id === conn.id);
      red.jugadores = red.jugadores.filter(x => x.id !== conn.id);
      if (j && j.civ != null) { red.cola.push({ tipo: 'salir', civ: j.civ }); red.idos = red.idos || {}; red.idos[conn.id] = red.idos['n:' + j.nombre] = j.civ; }
      if (j) avisoFlotante('🌐 ' + j.nombre + ' ha salido' + (j.civ != null ? ': ' + nombreDe(j.civ) + ' vuelve a gobernarse solo' : ''), 4000);
      difundir({ t: 'jugadores', lista: red.jugadores }); pintarOnline();
      if (red.sala) { difundirSala(); pintarSala(); }
    });
  }
  async function mandarMundo(conn, eres, carga) {
    acabarTurno();
    const d = await comprimir(JSON.stringify(m));
    conn.enviar(Object.assign({ t: 'mundo', turno: m.turno, jugadores: red.jugadores, vel, corriendo, eres: eres != null ? eres : undefined, carga: carga ? 1 : undefined }, d));
  }
  // El latido de la sala: cada 2 segundos el anfitrión pregunta a cada uno y mide cuánto tarda en contestar.
  function latido() {
    if (red.modo !== 'anfitrion') { clearInterval(red.latido); return; }
    for (const c of red.conns.values()) c.enviar({ t: 'ping', t0: performance.now() });
    pintarRedSala(); guardarSesion();
    if (!red.sala && m.turno % 5 === 0 && m.turno !== red.guardadoEn) { red.guardadoEn = m.turno; guardarOnline(); }
    if (red.sala) { difundirSala(); pintarSala(); }
  }
  const datosSala = () => ({ t: 'sala', codigo: red.codigo, jugadores: red.jugadores.map(j => ({ nombre: j.nombre, ping: j.ping, anfitrion: j.id === 'anfitrion', perdido: j.id !== 'anfitrion' && j.visto != null && performance.now() - j.visto > 7000 })), reinos: +$('sala-reinos').value || 5, libre: $('sala-libre').checked });
  function difundirSala() { difundir(datosSala()); }
  function pintarSala(datos) {
    const el = $('sala'); if (!el) return;
    const enSala = red.sala && (red.modo === 'anfitrion' || red.modo === 'invitado');
    el.hidden = !enSala; $('online-entrada').hidden = enSala;
    // Dentro de la sala: solo la sala (sin la explicación ni «Cerrar», que dejaría ver el mundo de detrás).
    $('online-intro').hidden = enSala; $('online-cerrar-p').hidden = enSala;
    if (!enSala) return;
    const d = datos || (red.modo === 'anfitrion' ? datosSala() : red.ultimaSala) || { jugadores: [] };
    $('sala-codigo').textContent = red.codigo;
    $('sala-lista').innerHTML = d.jugadores.map(j => {
      const est = j.anfitrion ? ['bien', '👑 anfitrión'] : j.perdido ? ['mal', '⚠ sin respuesta'] : j.ping == null ? ['regular', 'conectando…'] : j.ping < 150 ? ['bien', '● ' + j.ping + ' ms'] : j.ping < 400 ? ['regular', '● ' + j.ping + ' ms'] : ['mal', '● ' + j.ping + ' ms (lenta)'];
      return '<li><span>' + esc(j.nombre) + '</span><span class="' + est[0] + '">' + est[1] + '</span></li>';
    }).join('');
    const anf = red.modo === 'anfitrion';
    $('sala-reinos').disabled = !anf; $('sala-libre').disabled = !anf;
    if (!anf && d.reinos) { $('sala-reinos').value = String(d.reinos); $('sala-libre').checked = !!d.libre; }
    $('sala-empezar').hidden = !anf;
    $('sala-espera').textContent = anf ? (d.jugadores.length < 2 ? 'Comparte el código o pulsa «Invitar». Cuando estén todos, pulsa «Empezar partida». Mantén esta pantalla abierta.' : d.jugadores.length + ' jugadores en la sala. Cada uno gobernará un reino.') : 'Estás en la sala. Esperando a que el anfitrión empiece la partida…';
  }
  // Empieza la partida: un mundo nuevo, un reino para cada jugador y el mundo para todos a la vez.
  async function empezarSala() {
    if (red.modo !== 'anfitrion' || !red.sala) return;
    const n = Math.min(10, Math.max(+$('sala-reinos').value || 5, red.jugadores.length));
    // Primero, todos a la pantalla de carga; el mundo se crea, se manda y cada uno avisa cuando lo tiene listo.
    red.sala = false; red.cargando = true; red.listos = new Set(['anfitrion']); red.mundoOnline = true;
    difundir({ t: 'carga', fase: 'crear' });
    $('online').hidden = true; $('inicio').hidden = true; corriendo = false; programar();
    mostrarCarga('Creando el mundo…', 0.08); pintarCarga();
    await new Promise(r => setTimeout(r, 60));
    m = S.crear((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, n, { libre: $('sala-libre').checked, ritmo: 3 });
    // Reparte los reinos de forma que no queden pegados: va saltando por la lista.
    const reinos = S.vivas(m), paso = Math.max(1, Math.floor(reinos.length / red.jugadores.length));
    red.jugadores.forEach((j, i) => { j.civ = reinos[(i * paso) % reinos.length].id; });
    const yo = red.jugadores[0];
    m.modo = 'pueblo'; X.gobernar(m, yo.civ);
    for (const j of red.jugadores.slice(1)) X.unirse(m, j.civ);
    red.miCiv = yo.civ; calculo = null;
    sel = yo.civ; P.mundo(m, false); P.seleccionar(sel); const c = S.civ(m, yo.civ); if (c) P.centrarEn(c.capital, 3);
    pintarModo(); pintarTodo(); pintarOnline(); pintarSala();
    mostrarCarga('Enviando el mundo a los jugadores…', 0.3);
    difundir({ t: 'jugadores', lista: red.jugadores });
    for (const j of red.jugadores.slice(1)) { const conn = red.conns.get(j.id); if (conn) await mandarMundo(conn, j.civ, true); }
    mostrarCarga('Esperando a que todos carguen el mundo…', 0.6); pintarCarga();
    // Si alguien no responde en 25 s, se empieza igual: al llegar, se pone al día solo.
    clearTimeout(red.esperaCarga); red.esperaCarga = setTimeout(arrancarPartida, 25000);
    // Y si alguien tarda (o cerró la app), el anfitrión puede empezar ya.
    clearTimeout(red.botonYa); red.botonYa = setTimeout(() => { if (red.cargando) $('carga-ya').hidden = false; }, 6000);
    revisarCarga();
  }
