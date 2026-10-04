/*
 * GÉNESIS · LA VISTA
 * Dibuja el mapa en un canvas de píxeles, la lista de pueblos, la ficha del pueblo elegido y la crónica;
 * hace pasar el tiempo, recibe la voluntad del dios y, si se juega dentro de claude.ai, le pregunta a Claude
 * lo que el intérprete local no entiende y le pide crónicas de época.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO, S = M.sim, D = M.dios, P = M.pintor;
  const $ = id => document.getElementById(id);
  const CLAVE = 'genesis.mundo.v1';
  const VELOCIDADES = [[1100, '1×'], [380, '3×'], [110, '10×']];
  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let m = null, sel = null, corriendo = true, vel = 0, reloj = null, sample = null, ocupado = false, confirmarNuevo = false, ultimaCronista = 0;

  // ---------- Guardar y cargar (comodidad de este navegador) ----------
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(m)); } catch (e) { /* sin guardado */ } }
  function cargar() {
    try { const d = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (d && d.version === 1 && d.tipo && d.civs && d.W === S.W && d.H === S.H && d.vida) return d; } catch (e) { /* mundo corrupto */ }
    return null;
  }
  function mundoNuevo() {
    m = S.crear((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, 5);
    sel = null; ultimaCronista = 0;
    P.mundo(m); P.seleccionar(null);
  }

  // ---------- El mapa (lo dibuja pintor.js) ----------
  function marcar(e) {
    if (!e || e.casilla == null) return;
    P.marcar(e.casilla, e.divino ? '#f0c05a' : e.tipo === 'guerra' || e.tipo === 'conquista' || e.tipo === 'caida' ? '#ff4b3a' : '#fff6dc');
  }
  function elegir(id, centrar) {
    sel = id;
    P.seleccionar(sel);
    const c = sel != null ? S.civ(m, sel) : null;
    if (centrar && c) P.centrarEn(c.capital);
    pintarPueblos();
  }

  // ---------- Los números ----------
  const pob = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' M' : Math.round(p).toLocaleString('es-ES') + ' mil');
  const era = c => M.ERAS[c.era];

  function pintarCabecera() {
    $('anio').textContent = S.anioTexto(m.anio);
    const maxEra = Math.max(0, ...S.vivas(m).map(c => c.era));
    $('era').textContent = M.ERAS[maxEra].nombre;
    $('play').textContent = corriendo ? '❚❚ Pausa' : '▶ Seguir';
    $('play').setAttribute('aria-pressed', corriendo ? 'false' : 'true');
    $('vel').textContent = VELOCIDADES[vel][1];
  }

  function pintarPueblos() {
    const lista = S.resumen(m).sort((a, b) => b.tierras - a.tierras);
    const ul = $('pueblos');
    ul.innerHTML = '';
    for (const c of lista) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pueblo' + (sel === c.id ? ' elegido' : '');
      b.setAttribute('aria-pressed', sel === c.id ? 'true' : 'false');
      b.innerHTML = '<span class="muestra"></span><span class="p-nombre"></span><span class="p-dato"></span>';
      b.querySelector('.muestra').style.background = c.color;
      b.querySelector('.p-nombre').textContent = c.nombre + (c.guerras.length ? ' ⚔' : '');
      b.querySelector('.p-dato').textContent = M.ERAS[c.era].corto + ' · ' + pob(c.pob);
      b.addEventListener('click', () => elegir(sel === c.id ? null : c.id, true));
      li.appendChild(b); ul.appendChild(li);
    }
    pintarFicha();
  }

  function fila(dt, dd) { return '<div class="fila"><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function pintarFicha() {
    const f = $('ficha');
    const c = sel != null ? S.civ(m, sel) : null;
    if (!c || !c.viva) {
      sel = null;
      f.innerHTML = '<p class="vacio">Toca un pueblo en el mapa o en la lista para ver cómo vive. Lo que escribas sin nombrar a nadie le pasará al pueblo elegido.</p>';
      return;
    }
    const cs = S.casillas(m, c), cap = S.capacidad(m, c, cs);
    const enemigos = c.guerras.map(g => S.civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(c.nombre) + '</h3>' +
      '<p class="subt">' + esc(M.REGIMENES[c.regimen]) + ' ' + esc(c.caracter) + ' · ' + esc(era(c).nombre) + '</p>' +
      '<dl>' + fila('Población', pob(c.pob) + ' <span class="tenue">(la tierra da para ' + pob(cap) + ')</span>') +
      fila('Estabilidad', '<span class="barra"><span style="width:' + Math.round(c.estab) + '%"></span></span> ' + Math.round(c.estab)) +
      fila('Riqueza', Math.round(c.riqueza)) + fila('Tierras', cs.length) +
      fila('Aldeanos', aldeanos(c)) +
      fila('Madera', Math.floor(c.madera || 0) + ' <span class="tenue">· piedra ' + Math.floor(c.piedra || 0) + ' · ' + (c.arboles || 0) + ' árboles en su tierra</span>') +
      fila('Obras', (c.casas || 0) + ' casas · ' + (c.campos || 0) + ' campos') +
      fila('Inventos', esc(c.inventos.slice(-3).join(', ') || 'ninguno todavía')) +
      fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') + '</dl>';
    f.querySelector('.muestra').style.background = c.color;
  }

  const NOMBRES_OFICIO = { lenador: 'leñadores', granjero: 'granjeros', constructor: 'constructores', minero: 'mineros', guerrero: 'guerreros' };
  function aldeanos(c) {
    const cuenta = Object.create(null);
    for (const a of m.vida.aldeanos) if (a.c === c.id) { const o = M.vida.OFICIOS[a.o]; cuenta[o] = (cuenta[o] || 0) + 1; }
    const partes = M.vida.OFICIOS.filter(o => cuenta[o]).map(o => cuenta[o] + ' ' + NOMBRES_OFICIO[o]);
    return partes.length ? esc(partes.join(', ')) : 'ninguno';
  }

  function pintarCronica() {
    const ol = $('cronica');
    ol.innerHTML = '';
    for (const e of m.cronica.slice(0, 70)) {
      const li = document.createElement('li');
      li.className = 'suceso' + (e.divino ? ' divino' : '') + (e.importante ? ' importante' : '') + (e.tipo === 'cronista' ? ' cronista' : '');
      li.innerHTML = '<div class="s-cab"><span class="s-anio"></span><span class="s-punto"></span><h4 class="s-titulo"></h4></div><p class="s-texto"></p>';
      li.querySelector('.s-anio').textContent = S.anioTexto(e.anio);
      li.querySelector('.s-punto').style.background = e.color || 'transparent';
      li.querySelector('.s-titulo').textContent = e.titulo;
      li.querySelector('.s-texto').textContent = e.texto;
      if (e.porque) { const p = document.createElement('p'); p.className = 's-porque'; p.innerHTML = '<b>Por qué</b> '; p.appendChild(document.createTextNode(e.porque)); li.appendChild(p); }
      if (e.precedente) { const p = document.createElement('p'); p.className = 's-precedente'; p.innerHTML = '<b>Ya pasó</b> '; p.appendChild(document.createTextNode(e.precedente)); li.appendChild(p); }
      ol.appendChild(li);
    }
  }

  function pintarEjemplos() {
    const ej = ['Peste sobre el más grande', 'Que el más atrasado descubra la imprenta', 'Incendio en el más grande', 'Que planten bosques en el más pequeño', 'Paz para todos', 'Que aparezca un pueblo nuevo', 'Que llueva oro sobre el más pobre'];
    const cont = $('ejemplos');
    cont.innerHTML = '';
    for (const t of ej) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ejemplo'; b.textContent = t;
      b.addEventListener('click', () => { $('orden').value = t; $('orden').focus(); });
      cont.appendChild(b);
    }
  }

  function pintarTodo() { pintarCabecera(); pintarPueblos(); pintarCronica(); }

  // ---------- El tiempo ----------
  function paso() {
    const antes = m.cronica[0];
    S.turno(m);
    P.turno(m, VELOCIDADES[vel][0]);
    if (m.cronica[0] !== antes) marcar(m.cronica[0]);
    pintarTodo();
    if (m.turno % 5 === 0) guardar();
  }
  function programar() {
    clearInterval(reloj);
    if (corriendo) reloj = setInterval(paso, VELOCIDADES[vel][0]);
    pintarCabecera();
  }

  // ---------- La voluntad del dios ----------
  function responder(texto, tipo) {
    const p = $('respuesta');
    p.textContent = texto;
    p.className = 'respuesta ' + (tipo || '');
  }

  async function obrar(texto) {
    if (ocupado) return;
    const r = D.obrar(m, texto, sel);
    if (r.ok) {
      responder('Hecho. ' + r.suceso.titulo + '.', 'bien');
      P.refrescar(); marcar(r.suceso); pintarTodo(); guardar();
      return;
    }
    if (r.motivo === 'falta_quien') { responder('¿Sobre quién? Toca un pueblo en el mapa o nómbralo ("peste sobre ' + (S.vivas(m)[0] || { nombre: 'Karenia' }).nombre + '").', 'duda'); return; }
    if (r.motivo === 'faltan_dos') { responder('Para eso hacen falta dos pueblos: nómbralos, o elige uno y nombra al otro.', 'duda'); return; }
    if (!sample) { responder('Los cielos no entienden esa orden. Prueba con pestes, diluvios, sequías, terremotos, oro, inventos ("que descubran la pólvora"), guerras, paces, profetas, revoluciones o pueblos nuevos.', 'duda'); return; }
    // Lo que el intérprete no entiende, lo decide Claude (con límites).
    ocupado = true;
    const seguia = corriendo; corriendo = false; programar();
    responder('Los cielos meditan tu voluntad…', 'espera');
    try {
      let f;
      if (typeof sample.json === 'function') f = await sample.json(D.SISTEMA + '\n\n' + D.paraIA(m, texto));
      else { const res = await sample(D.SISTEMA + '\n\n' + D.paraIA(m, texto)); f = JSON.parse(String(res.text).replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
      const e = D.aplicarIA(m, f);
      if (e) { responder('Hecho. ' + e.titulo + '.', 'bien'); P.refrescar(); marcar(e); }
      else responder((f && f.pregunta) || 'Ni los cielos entienden esa orden. Dila de otra manera.', 'duda');
    } catch (err) {
      responder(err && err.code === 'rate_limited' ? 'Los cielos están saturados. Espera un poco y vuelve a intentarlo.' : 'Los cielos no responden ahora. Prueba con un poder sencillo: peste, diluvio, oro, un invento, una guerra o la paz.', 'duda');
    }
    ocupado = false; corriendo = seguia; programar();
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
  function iniciar(datos) {
    P.iniciar($('mapa'), { reducido, alClicar: region => { const d = m.dueno[region]; elegir(d >= 0 ? (sel === d ? null : d) : null, false); } });
    m = (datos && datos.mundo && datos.mundo.vida && datos.mundo.W === S.W ? datos.mundo : null) || cargar();
    if (!m) mundoNuevo(); else P.mundo(m);
    if (datos && datos.sel != null) { sel = datos.sel; P.seleccionar(sel); }
    pintarEjemplos(); pintarTodo();
    $('play').addEventListener('click', () => { corriendo = !corriendo; programar(); });
    $('vel').addEventListener('click', () => { vel = (vel + 1) % VELOCIDADES.length; programar(); });
    $('nuevo').addEventListener('click', () => {
      if (!confirmarNuevo) { confirmarNuevo = true; $('nuevo').textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { confirmarNuevo = false; $('nuevo').textContent = 'Nuevo mundo'; }, 3500); return; }
      confirmarNuevo = false; $('nuevo').textContent = 'Nuevo mundo';
      mundoNuevo(); pintarTodo(); guardar(); responder('Un mundo nuevo. Cinco pueblos acaban de aprender a sembrar.', 'bien');
    });
    $('voluntad').addEventListener('submit', ev => { ev.preventDefault(); const t = $('orden').value.trim(); if (!t) return; $('orden').value = ''; obrar(t); });
    $('zoom-mas').addEventListener('click', () => P.zoom(1.5));
    $('zoom-menos').addEventListener('click', () => P.zoom(1 / 1.5));
    $('ver-todo').addEventListener('click', () => P.verTodo());
    $('cronista').addEventListener('click', cronista);
    programar();
    if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ mundo: m, sel }));
    // Dentro de claude.ai, Claude entiende lo que el intérprete no, y escribe capítulos de la crónica.
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('sample').then(fn => { sample = fn || null; $('cronista').hidden = !sample; }).catch(() => { sample = null; });
    }
  }

  function arrancar() {
    if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(iniciar);
    else iniciar(window.claude && window.claude.hot ? window.claude.hot.data : null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})(globalThis.RF = globalThis.RF || {});
