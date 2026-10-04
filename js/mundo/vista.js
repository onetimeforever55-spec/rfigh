/*
 * GÉNESIS · LA VISTA
 * Dibuja el mapa en un canvas de píxeles, la lista de pueblos, la ficha del pueblo elegido y la crónica;
 * hace pasar el tiempo, recibe la voluntad del dios y, si se juega dentro de claude.ai, le pregunta a Claude
 * lo que el intérprete local no entiende y le pide crónicas de época.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO, S = M.sim, D = M.dios, P = M.pintor, X = M.mando;
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

  // ---------- El modo de juego: dios de todos o gobernante de un pueblo ----------
  const modoPueblo = () => m.modo === 'pueblo' && m.jugador != null;
  const tuPueblo = () => { const c = modoPueblo() ? S.civ(m, m.jugador) : null; return c && c.viva ? c : null; };
  function pedirModo(titulo, texto) {
    $('inicio-titulo').textContent = titulo || '¿Cómo quieres jugar?';
    $('inicio-texto').textContent = texto || 'Puedes gobernar un solo pueblo con tus órdenes mientras los demás viven a su aire, o ser el dios de todos.';
    $('inicio').hidden = false;
    corriendo = false; programar();
  }
  function elegirModo(modo, civId) {
    $('inicio').hidden = true;
    m.modo = modo;
    if (modo === 'pueblo') {
      // Si no se elige uno, te toca un pueblo al azar entre los que tienen sitio para crecer.
      const lista = S.vivas(m).slice().sort((a, b) => S.casillas(m, a).length - S.casillas(m, b).length);
      const c = (civId != null && S.civ(m, civId)) || lista[Math.floor(lista.length / 2)];
      X.gobernar(m, c ? c.id : null);
      sel = m.jugador; P.seleccionar(sel);
      if (c) P.centrarEn(c.capital);
      responder(c ? 'Gobiernas ' + c.nombre + '. Dale órdenes a tu gente: talar, sembrar, construir, expandirse, guerra o paz con los vecinos, ciencia, comercio… Los demás pueblos viven a su aire.' : '', 'bien');
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
    $('orden').placeholder = c ? 'Talad el bosque, construid casas, expandíos hacia el norte, atacad a…' : 'Peste sobre el más grande, que descubran la pólvora…';
    $('voluntad').classList.toggle('es-pueblo', !!c);
    pintarEjemplos();
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
    const c = sel != null ? S.civ(m, sel) : tuPueblo();
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
      fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') + '</dl>' +
      (c.jugador ? planDe(c) : '') +
      (m.modo === 'pueblo' && !c.jugador ? '<button type="button" class="mando gobernar">Gobernar este pueblo</button>' : '');
    f.querySelector('.muestra').style.background = c.color;
    if (c.jugador) f.querySelector('h3').insertAdjacentHTML('beforeend', ' <span class="tuyo">tu pueblo</span>');
    const b = f.querySelector('.gobernar');
    if (b) b.addEventListener('click', () => elegirModo('pueblo', c.id));
  }

  const FOCO = { ciencia: 'ciencia', crecer: 'crecer', comercio: 'riqueza y comercio', ejercito: 'ejército', construir: 'construir' };
  function planDe(c) {
    const p = c.plan || {}, l = [];
    l.push(fila('Foco', p.foco ? FOCO[p.foco] : 'ninguno (cada uno a lo suyo)'));
    const of = p.oficios ? Object.keys(p.oficios).filter(k => p.oficios[k] > 0.1).map(k => NOMBRES_OFICIO[k]) : [];
    if (of.length) l.push(fila('Prioridad', 'más ' + esc(of.join(', '))));
    const rumbo = typeof p.rumbo === 'number' ? 'hacia ' + ((S.civ(m, p.rumbo) || {}).nombre || '?') : p.rumbo ? 'hacia el ' + p.rumbo : 'a las mejores tierras';
    l.push(fila('Expansión', p.expandir === false ? 'parada' : esc(rumbo)));
    const socios = (p.socios || []).map(id => S.civ(m, id)).filter(o => o && o.viva).map(o => o.nombre);
    if (socios.length) l.push(fila('Tratados', esc(socios.join(', '))));
    const ofertas = Object.keys(m.ofertas || {}).map(Number).filter(id => S.enGuerra(c, S.civ(m, id) || { id: -1, guerras: [] }) && m.turno - m.ofertas[id] <= 15).map(id => S.civ(m, id).nombre);
    if (ofertas.length) l.push(fila('Te ofrecen paz', '<span class="rojo">' + esc(ofertas.join(', ')) + '</span>'));
    return '<dl class="plan">' + l.join('') + '</dl>';
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
    const vecino = tuPueblo() && (S.vecinosDe(m, tuPueblo())[0] || S.vivas(m).find(o => o.id !== m.jugador));
    const ej = tuPueblo()
      ? ['Informe', 'Talad el bosque y construid casas', 'Expandíos hacia el norte', 'Invertid en ciencia', 'Reclutad un ejército', vecino ? 'Atacad a ' + vecino.nombre : 'Atacad al vecino más débil', vecino ? 'Comerciad con ' + vecino.nombre : 'Comerciad con el más rico', 'Como antes']
      : ['Peste sobre el más grande', 'Que el más atrasado descubra la imprenta', 'Incendio en el más grande', 'Que planten bosques en el más pequeño', 'Paz para todos', 'Que aparezca un pueblo nuevo', 'Que llueva oro sobre el más pobre'];
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
    const antes = m.cronica[0], yo = tuPueblo(), guerrasAntes = yo ? yo.guerras.map(g => g.con) : [];
    S.turno(m);
    P.turno(m, VELOCIDADES[vel][0]);
    if (m.cronica[0] !== antes) marcar(m.cronica[0]);
    if (yo) avisos(yo, guerrasAntes, antes);
    pintarTodo();
    if (m.turno % 5 === 0) guardar();
  }
  // Lo que le pasa a tu pueblo mientras corre el tiempo: guerras que te declaran, paces que te ofrecen, tu caída.
  function avisos(yo, guerrasAntes, ultimo) {
    if (!yo.viva) {
      pintarModo();
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
      if (Math.abs(c.pob - a.pob) >= Math.max(0.5, a.pob * 0.02)) l.push('población ' + pob(a.pob) + ' → ' + pob(c.pob));
      const muertos = a.aldeanos - m.vida.aldeanos.filter(x => x.c === id).length;
      if (muertos > 0) l.push(muertos + ' aldeanos muertos');
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
    marcar(suceso);
    const quien = porDefecto === 'todos' ? ' (para todos los pueblos)' : porDefecto === 'grande' ? ' (sobre el más grande, porque no dijiste sobre quién)' : '';
    const efectos = cambios(antes, todos, poder);
    responder('Hecho' + quien + '. ' + suceso.titulo + '.' + (efectos ? ' ' + efectos + '.' : ''), 'bien');
    pintarTodo(); guardar();
  }

  async function obrar(texto) {
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
    const r = X.ordenar(m, yo.id, texto);
    if (r.ok) { despuesDeOrden(r); return; }
    if (!sample) { responder('Tu gente no entiende la orden. Prueba con: talad, sembrad, construid casas, picad piedra, reclutad un ejército, expandíos hacia el norte, atacad a X, haced la paz con X, comerciad con X, invertid en ciencia, proclamad la república, informe.', 'duda'); return; }
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
    M.vida.ajustar(m); P.refrescar();
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
  function iniciar(datos) {
    P.iniciar($('mapa'), { reducido, alClicar: region => { const d = m.dueno[region]; elegir(d >= 0 ? (sel === d ? null : d) : null, false); } });
    m = (datos && datos.mundo && datos.mundo.vida && datos.mundo.W === S.W ? datos.mundo : null) || cargar();
    if (!m) mundoNuevo(); else P.mundo(m);
    if (datos && datos.sel != null) { sel = datos.sel; P.seleccionar(sel); }
    pintarModo(); pintarTodo();
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
    $('cambiar-modo').addEventListener('click', () => pedirModo());
    $('zoom-mas').addEventListener('click', () => P.zoom(1.5));
    $('zoom-menos').addEventListener('click', () => P.zoom(1 / 1.5));
    $('ver-todo').addEventListener('click', () => P.verTodo());
    $('cronista').addEventListener('click', cronista);
    programar();
    // Un mundo nuevo (o uno guardado de antes de los modos) pregunta cómo quieres jugar.
    if (!m.modo) pedirModo();
    else if (m.modo === 'pueblo' && tuPueblo()) P.centrarEn(tuPueblo().capital);
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
