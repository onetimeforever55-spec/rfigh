  /*
   * GÉNESIS · LA VISTA
   * Dibuja el mapa en un canvas de píxeles, la lista de pueblos, la ficha del pueblo elegido y la crónica;
   * hace pasar el tiempo, recibe la voluntad del dios y, si se juega dentro de claude.ai, le pregunta a Claude
   * lo que el intérprete local no entiende y le pide crónicas de época.
   */
  'use strict';
  const M = RF.MUNDO, S = M.sim, D = M.dios, P = M.pintor, X = M.mando;
  const $ = id => document.getElementById(id);
  const CLAVE = 'genesis.mundo.v1';
  // Como en WorldBox, el tiempo pasa despacio: a 1×, cada turno dura más de tres segundos.
  // La velocidad original es lenta, como en WorldBox: se ve a cada aldeano ir y venir. Las otras aceleran.
  const VELOCIDADES = [[8000, '1×'], [4000, '2×'], [1600, '5×'], [500, '15×']];
  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let aldeanoSel = null, edificioSel = null, pestana = 'resumen';
  let m = null, sel = null, corriendo = true, vel = 0, reloj = null, sample = null, ocupado = false, confirmarNuevo = false, ultimaCronista = 0;

  // ---------- Guardar y cargar (comodidad de este navegador) ----------
  // La partida se guarda comprimida (gzip del navegador, en base64): ocupa unas diez veces menos y cabe de sobra
  // en el almacén del navegador aunque el mundo crezca. Sin compresión disponible, se guarda tal cual.
  let guardando = false, guardadaAntes = null;
  const aB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const deB64 = t => { const s = atob(t), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  function escribir(texto) {
    try { localStorage.setItem(CLAVE, texto); return true; }
    catch (e) { try { localStorage.removeItem(CLAVE); localStorage.setItem(CLAVE, texto); return true; } catch (e2) { return false; } }
  }
  function guardar() {
    acabarTurno();
    if (!m || guardando || enLinea()) return; // las partidas online no pisan la guardada en solitario
    let json; try { json = JSON.stringify(m); } catch (e) { return; }
    if (typeof CompressionStream !== 'function') { escribir(json); return; }
    guardando = true;
    new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
      .then(buf => { if (!escribir('gz:' + aB64(buf))) escribir(json); })
      .catch(() => escribir(json))
      .finally(() => { guardando = false; });
  }
  // Al arrancar, se descomprime la partida guardada (si la hay) antes de montar el juego.
  function precargar() {
    let t = null; try { t = localStorage.getItem(CLAVE); } catch (e) { /* sin guardado */ }
    if (!t || t.slice(0, 3) !== 'gz:' || typeof DecompressionStream !== 'function') { guardadaAntes = t; return Promise.resolve(); }
    return new Response(new Blob([deB64(t.slice(3))]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      .then(j => { guardadaAntes = j; }).catch(() => { guardadaAntes = null; });
  }
  function cargar() {
    try { const d = JSON.parse(guardadaAntes || 'null'); if (d && d.version === 1 && d.tipo && d.civs && d.W === S.W && d.H === S.H && d.vida) return d; } catch (e) { /* mundo corrupto */ }
    return null;
  }
  // Cuántos reinos tiene un mundo nuevo (5, 8 o 10): se elige en la pantalla de inicio y se recuerda.
  function reinosElegidos() { let n = 5; try { n = +(localStorage.getItem('genesis.reinos') || 5); } catch (e) { /* sin preferencia */ } return [5, 8, 10].includes(n) ? n : 5; }
  function mundoNuevo() {
    let libre = false;
    try { libre = localStorage.getItem('genesis.libre') === '1'; } catch (e) { /* sin preferencia */ }
    // Las partidas nuevas van a ritmo pausado: de tribu a ciudad en unos diez minutos a 1×, no en dos.
    m = S.crear((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, reinosElegidos(), { libre, ritmo: 3 });
    sel = null; ultimaCronista = 0;
    P.mundo(m); P.seleccionar(null);
  }

  // ---------- El modo de juego: dios de todos o gobernante de un pueblo ----------
  const modoPueblo = () => m.modo === 'pueblo' && m.jugador != null;
  const tuPueblo = () => { const c = modoPueblo() ? S.civ(m, m.jugador) : null; return c && c.viva ? c : null; };
  function pedirModo(titulo, texto) {
    if (enLinea()) return; // en online no hay menú de modo: cada uno tiene su reino (o mira)
    $('inicio-titulo').textContent = titulo || '¿Cómo quieres jugar?';
    $('inicio-texto').textContent = texto || 'Puedes gobernar un solo pueblo con tus órdenes mientras los demás viven a su aire, o ser el dios de todos.';
    $('mundo-libre').checked = !!m.libre;
    $('num-reinos').value = String(reinosElegidos());
    $('inicio').hidden = false;
    corriendo = false; programar();
  }
  function elegirModo(modo, civId) {
    // En línea, quien se une pide un pueblo al anfitrión (si está libre, es suyo).
    // En online cada uno tiene un solo reino para toda la partida: si cae, ha perdido (puede seguir mirando).
    if (enLinea() && red.miCiv != null) { $('inicio').hidden = true; responder(tuPueblo() ? 'En una partida online no se cambia de reino: gobiernas ' + tuPueblo().nombre + ' hasta el final.' : 'Tu reino ha caído: en online, quien pierde no vuelve a jugar. Puedes seguir mirando cómo acaba la partida.', 'duda'); return; }
    if (red.modo === 'invitado') { $('inicio').hidden = true; responder('En online el reino se reparte al azar al entrar: no se elige.', 'duda'); return; }
    if (red.modo === 'anfitrion' && modo !== 'pueblo') { $('inicio').hidden = true; responder('En una partida online solo se juega gobernando un pueblo.', 'duda'); return; }
    $('inicio').hidden = true;
    // El mundo libre se puede activar en cualquier momento: desde ahora, los años pasan de uno en uno.
    const libre = $('mundo-libre').checked;
    try { localStorage.setItem('genesis.libre', libre ? '1' : '0'); } catch (e) { /* sin guardado */ }
    // Si se pidió otro número de reinos y el mundo acaba de empezar, se crea uno nuevo con esos reinos.
    const nReinos = +$('num-reinos').value || 5;
    try { localStorage.setItem('genesis.reinos', String(nReinos)); } catch (e) { /* sin guardado */ }
    if (m.turno < 3 && m.civs.length !== nReinos && red.modo !== 'invitado') { mundoNuevo(); }
    if (libre && !m.libre) { m.libre = true; if (m.anio < 1) m.anio = 1; }
    else if (!libre && m.libre) { m.libre = false; if (m.turno < 3) m.anio = -4000; } // un mundo recién creado vuelve al calendario histórico desde el principio
    m.modo = modo;
    if (modo === 'pueblo') {
      // Si no se elige uno, te toca un pueblo al azar entre los que tienen sitio para crecer.
      const lista = S.vivas(m).slice().sort((a, b) => S.casillas(m, a).length - S.casillas(m, b).length);
      const c = (civId != null && S.civ(m, civId)) || lista[Math.floor(lista.length / 2)];
      X.gobernar(m, c ? c.id : null);
      sel = m.jugador; P.seleccionar(sel);
      if (c) P.centrarEn(c.capital, 3);
      responder(c ? 'Gobiernas ' + c.nombre + '. Tu pueblo se gobierna solo, como los demás: tú decides qué le importa más (madera, comida, piedra, casas, ejército, ciencia, riqueza, expansión) y las grandes decisiones (guerra, paz, tratados, gobierno).' : '', 'bien');
    } else {
      X.gobernar(m, null);
      responder('Eres el dios de este mundo. Escribe lo que quieras que pase.', 'bien');
    }
    pintarModo(); pintarTodo(); guardar();
    corriendo = true; programar();
  }
  function pintarModo() {
    const c = tuPueblo();
    $('etiqueta-orden').textContent = c ? 'Tus órdenes a ' + c.nombre : 'Tu voluntad';
    $('boton-orden').textContent = c ? 'Ordenar' : 'Obrar';
    $('orden').placeholder = movil() ? (c ? 'Escribe una orden…' : 'Escribe un poder…') : c ? '5 granjeros a talar 2 minutos, quiero 10 leñadores, atacad a…' : 'Peste sobre el más grande, que descubran la pólvora…';
    $('voluntad').classList.toggle('es-pueblo', !!c);
    $('ir-mio').hidden = !c;
    $('arquitecto-btn').hidden = !c || !M.vida.pausada(m);
    $('fundar-btn').hidden = !c || !M.vida.pausada(m);
    $('tropas-btn').hidden = !c;
    if (!c && tropasActivas) salirTropas();
    $('corte-btn').hidden = !c;
    if ((!c || !M.vida.pausada(m)) && arquiClave) salirArquitecto();
    pintarEjemplos();
  }

  // ---------- El mapa (lo dibuja pintor.js) ----------
  function marcar(e) {
    if (!e || e.casilla == null) return;
    P.marcar(e.casilla, e.divino ? '#f0c05a' : e.tipo === 'guerra' || e.tipo === 'conquista' || e.tipo === 'caida' ? '#ff4b3a' : '#fff6dc');
  }
  function elegir(id, centrar) {
    sel = id; edificioSel = null;
    P.seleccionar(sel);
    const c = sel != null ? S.civ(m, sel) : null;
    if (centrar && c) P.centrarEn(c.capital);
    pintarPueblos(); if (m.guia) pintarConsejo();
  }
