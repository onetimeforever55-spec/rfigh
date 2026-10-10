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

  // ---------- Los números ----------
  const habitantes = c => { const n = c.habitantes != null ? c.habitantes : (m.vida ? m.vida.aldeanos.filter(a => a.c === c.id).length : 0); return n + (n === 1 ? ' aldeano' : ' aldeanos'); };
  const pob = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' M' : Math.round(p).toLocaleString('es-ES') + ' mil');
  const era = c => M.ERAS[c.era];

  function pintarCabecera() {
    if (anioAntes == null || !corriendo) $('anio').textContent = m.libre ? 'Año ' + m.anio : S.anioTexto(m.anio);
    const maxEra = Math.max(0, ...S.vivas(m).map(c => c.era));
    $('era').textContent = M.ERAS[maxEra].nombre;
    $('play').innerHTML = corriendo ? '<span class="ico">❚❚</span><span class="txt"> Pausa</span>' : '<span class="ico">▶</span><span class="txt"> Seguir</span>';
    $('play').setAttribute('aria-pressed', corriendo ? 'false' : 'true');
    $('vel').textContent = VELOCIDADES[vel][1];
  }

  // La barra de recursos: el oro (con lo que entra y sale cada turno), la comida, la madera, la piedra, el metal,
  // la gente y las camas, el nivel del asentamiento y lo que se investiga.
  // Iconos de píxeles (arte.js) en lugar de emojis, para que la interfaz sea del mismo mundo que el mapa.
  const ICO_PX = { '🐟': 'pescado', '🍖': 'carne', '🥛': 'leche', '🍎': 'frutos', '💣': 'granadas', '🌰': 'semillas', '🪑': 'muebles', '🛡': 'vehiculos', '⚫': 'carbon', '🛢': 'petroleo', '🪙': 'oro', '🌾': 'comida', '🪵': 'madera', '🪨': 'piedra', '⛓': 'metal', '⚔': 'armas', '👥': 'gente', '🏘': 'nivel', '🔬': 'tec', '⏫': 'subir', '🌱': 'primavera', '☀️': 'verano', '🍂': 'otono', '❄️': 'invierno' };
  const px = (n, cls) => M.arte && M.arte.iconoURL ? '<img class="px' + (cls ? ' ' + cls : '') + '" alt="" src="' + M.arte.iconoURL(n) + '">' : '';
  // Al tocar la comida, de qué está hecha: grano, pescado, carne, leche y queso, frutos del bosque.
  const NOMBRE_ALIMENTO = { grano: ['🌾', 'Grano y cosecha', 'campos y molinos'], pescado: ['🐟', 'Pescado', 'barcas de pesca'], carne: ['🍖', 'Carne', 'caza y reses sacrificadas'], leche: ['🥛', 'Leche y queso', 'rebaños'], frutos: ['🍎', 'Frutos del bosque', 'recolección'] };
  function desgloseComida(ancla) {
    const c = tuPueblo() || (sel != null ? S.civ(m, sel) : null); if (!c) return;
    let caja = $('desglose-comida');
    if (caja && !caja.hidden) { caja.hidden = true; return; }
    if (!caja) { caja = document.createElement('div'); caja.id = 'desglose-comida'; caja.className = 'desglose'; document.body.appendChild(caja); caja.addEventListener('click', () => { caja.hidden = true; }); }
    const al = M.vida.desglose ? M.vida.desglose(c) : {}, total = Math.max(1e-9, c.comida || 0);
    caja.innerHTML = '<div class="desglose-tit">' + px('comida') + ' Comida de ' + esc(c.nombre) + ': ' + Math.round(c.comida || 0) + '</div>' + (M.vida.ALIMENTOS || []).map(k => {
      const q = al[k] || 0, [ico, nom, de] = NOMBRE_ALIMENTO[k], pc = Math.round(100 * q / total);
      return '<div class="desglose-fila' + (q < 0.5 ? ' tenue' : '') + '">' + px(ICO_PX[ico]) + '<span class="desglose-nom">' + nom + ' <small class="tenue">(' + de + ')</small></span><b>' + Math.round(q) + '</b><span class="desglose-barra"><i style="width:' + pc + '%"></i></span></div>';
    }).join('') + '<div class="desglose-pie tenue">Todo alimenta igual; en el mercado se vende y se compra como comida.</div>';
    const r0 = ancla.getBoundingClientRect();
    caja.style.left = Math.max(8, Math.min(window.innerWidth - 290, r0.left)) + 'px'; caja.style.top = (r0.bottom + 6) + 'px';
    caja.hidden = false;
  }
  // EL FLUJO DE RECURSOS, como en Age of Empires: los contadores suben (y bajan) poco a poco a lo largo del turno
  // en vez de saltar, y junto a cada uno se ve cuánto entra o sale por minuto (lo de los últimos turnos).
  const historialRec = {}, animRec = {};
  const RECS = ['oro', 'comida', 'madera', 'piedra', 'metal', 'carbon', 'petroleo'];
  function apuntarHistorial(c) {
    const h = historialRec[c.id] = historialRec[c.id] || [];
    if (h.length && h[h.length - 1].turno === m.turno) h.pop();
    h.push({ turno: m.turno, stock: Object.fromEntries(RECS.map(k => [k, c[k] || 0])), hecho: Object.assign({}, c.hecho || {}) });
    while (h.length > 8) h.shift();
  }
  // Por minuto de juego a la velocidad actual (a 1×, un turno son 8 segundos).
  function porMinuto(c, k, deHecho) {
    const h = historialRec[c.id]; if (!h || h.length < 2) return 0;
    const a = h[0], b = h[h.length - 1], turnos = b.turno - a.turno; if (turnos <= 0) return 0;
    const d = deHecho ? (b.hecho[k] || 0) - (a.hecho[k] || 0) : b.stock[k] - a.stock[k];
    return d / turnos * (60000 / VELOCIDADES[vel][0]);
  }
  function numeroSuave(c, k, valor) {
    const a = animRec[k] = animRec[k] || { mostrado: valor, desde: valor, hasta: valor, t0: 0, dur: 1, civ: c.id, turno: m.turno };
    if (a.civ !== c.id) Object.assign(a, { mostrado: valor, desde: valor, hasta: valor, civ: c.id });
    if (a.hasta !== valor) {
      // Al terminar un turno, el cambio se reparte a lo largo del turno siguiente; si es por una orden, en medio segundo.
      const deTurno = a.turno !== m.turno;
      Object.assign(a, { desde: a.mostrado, hasta: valor, t0: performance.now(), dur: deTurno && corriendo ? VELOCIDADES[vel][0] * 0.9 : 500, turno: m.turno });
    }
    return '<b class="rec-n" data-k="' + k + '">' + Math.round(a.mostrado) + '</b>';
  }
  function animarRecursos() {
    const ahora = performance.now();
    for (const el of document.querySelectorAll('#recursos .rec-n')) {
      const a = animRec[el.dataset.k]; if (!a) continue;
      const f = Math.min(1, (ahora - a.t0) / a.dur);
      a.mostrado = a.desde + (a.hasta - a.desde) * f;
      const t = String(Math.round(a.mostrado)); if (el.textContent !== t) el.textContent = t;
    }
  }
  const ritmo = (c, k) => { const d = porMinuto(c, k); if (Math.abs(d) < 0.5) return ''; return ' <small class="' + (d > 0 ? 'verde' : 'rojo') + '">' + (d > 0 ? '+' : '') + Math.round(d) + '/min</small>'; };
  const ritmoTexto = (c, k) => { const neto = porMinuto(c, k), entra = porMinuto(c, k, true); return ' · ' + (neto >= 0 ? '+' : '') + Math.round(neto) + ' por minuto' + (entra > 0.5 ? ' (tus aldeanos recogen ' + Math.round(entra) + '/min; el resto se va en obras, mejoras, comida o comercio)' : ''); };
  function pintarRecursos() {
    const c = tuPueblo() || (sel != null ? S.civ(m, sel) : null), el = $('recursos');
    if (!c || !c.viva) { el.hidden = true; return; }
    if (!historialRec[c.id] || historialRec[c.id][historialRec[c.id].length - 1].turno !== m.turno) apuntarHistorial(c);
    const r = Math.round;
    const oro = c.oro || 0, neto = (c.ingresos || 0) - (c.gastos || 0) - (c.mecenazgo || 0);
    const tope = r((15 + (c.aldeanos || 0) * 1.2) * (1 + M.tec(c, 'granero')));
    const inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
    const pct = inv ? Math.min(100, r(100 * c.investigacion.puntos / M.costeTec(inv))) : 0;
    const chip = (ico, valor, titulo, cls, extra) => '<span class="rec' + (cls ? ' ' + cls : '') + '" title="' + esc(titulo) + '"><i>' + (ICO_PX[ico] ? px(ICO_PX[ico]) : ico) + '</i>' + valor + (extra || '') + '</span>';
    const nivel = M.NIVELES[c.nivel || 0];
    const est = m.vida && m.vida.estacion != null && m.vida.estacion >= 0 ? m.vida.estacion : -1;
    const ESTA = [['🌱', 'Primavera', 'se siembra y los campos brotan más deprisa'], ['☀️', 'Verano', 'los campos maduran'], ['🍂', 'Otoño', 'la gran cosecha: los campos dan más y el bosque da frutos'], ['❄️', 'Invierno', 'no crece nada, apenas se recolecta y se quema el doble de leña: se vive de lo guardado']];
    const hora = m.vida && m.vida.noche ? '🌙 noche' : '';
    el.innerHTML =
      (est >= 0 ? chip(ESTA[est][0], ESTA[est][1] + (hora ? ' <small class="tenue">' + hora + '</small>' : ''), ESTA[est][1] + ': ' + ESTA[est][2] + '. Cada estación dura 12 turnos; de cada 6 turnos, uno es de noche y la gente duerme en casa.', 'estacion') : '') +
      chip('🪙', numeroSuave(c, 'oro', oro), 'Oro del tesoro: impuestos ' + (c.ingresos || 0).toFixed(1) + ' − sueldos y mantenimiento ' + (c.gastos || 0).toFixed(1) + (c.mecenazgo ? ' − ' + c.mecenazgo.toFixed(1) + ' para los sabios' : '') + ' por turno' + ritmoTexto(c, 'oro'), oro < 0 ? 'mal' : 'oro', ritmo(c, 'oro')) +
      chip('🌾', numeroSuave(c, 'comida', c.comida || 0) + '<small class="tenue">/' + tope + '</small>', 'Comida en el granero (y lo que cabe). Tócala para ver de dónde sale: grano, pescado, carne, leche y frutos' + ritmoTexto(c, 'comida'), 'comida' + ((c.comida || 0) < (c.aldeanos || 0) * 0.3 ? ' mal' : ''), ritmo(c, 'comida')) +
      chip('🪵', numeroSuave(c, 'madera', c.madera || 0), 'Madera' + ritmoTexto(c, 'madera'), '', ritmo(c, 'madera')) +
      chip('🪨', numeroSuave(c, 'piedra', c.piedra || 0), 'Piedra' + ritmoTexto(c, 'piedra'), '', ritmo(c, 'piedra')) +
      (c.era >= 1 ? chip('⛓', numeroSuave(c, 'metal', c.metal || 0), 'Metal (armas, armaduras, vehículos)' + ritmoTexto(c, 'metal') + (m.mercado ? ' · en el mercado: ' + m.mercado.precio.metal.toFixed(2) : ''), '', ritmo(c, 'metal')) : '') +
      (c.era >= 6 ? chip('⚫', numeroSuave(c, 'carbon', c.carbon || 0), 'Carbón: lo queman las fábricas, los trenes y las centrales. Sale de las vetas negras y de las minas de la montaña.' + (c.paradas && Object.keys(c.paradas).length ? ' ¡Falta! Hay cosas paradas.' : ''), c.paradas && (c.paradas.fabrica || c.paradas.tren) ? 'mal' : '', ritmo(c, 'carbon')) : '') +
      ((c.armas || 0) >= 1 ? chip('⚔', r(c.armas || 0), 'Armas en el almacén: las usa el ejército y se pueden vender («vended armas»). «Fabricad 20 fusiles» pone a la forja a hacer más.', '') : '') +
      ((c.semillas || 0) >= 1 ? chip('🌰', r(c.semillas || 0), 'Semillas de árbol: los leñadores las recogen al talar y replantan cuando escasea el bosque. Se compran y se venden en el mercado.', '') : '') +
      ((c.muebles || 0) >= 1 ? chip('🪑', r(c.muebles || 0), 'Muebles de la fábrica: la gente compra parte cada turno y el resto se exporta («vended muebles»).', '') : '') +
      ((c.granadas || 0) >= 1 ? chip('💣', r(c.granadas || 0), 'Granadas: los soldados las lanzan a trincheras y grupos enemigos. «Fabricad 30 granadas» las hace el cuartel o la fábrica; también se venden («vended granadas»).', '') : '') +
      ((c.vehiculos || 0) >= 1 ? chip('🛡', r(c.vehiculos || 0), 'Cañones, artillería o tanques en el almacén: los soldados los usan o se venden («vended cañones», «fabricad 5 cañones»).', '') : '') +
      (c.era >= 7 ? chip('🛢', numeroSuave(c, 'petroleo', c.petroleo || 0), 'Petróleo: lo gastan los tanques, los aviones y las centrales sin carbón. Sale de los pozos levantados sobre las manchas negras.' + ((c.pozosPetroleo || 0) ? ' Tenéis ' + c.pozosPetroleo + (c.pozosPetroleo === 1 ? ' pozo.' : ' pozos.') : ' No tenéis pozos.'), '', ritmo(c, 'petroleo')) : '') +
      (c.era >= 1 && (c.armas || 0) >= 1 ? chip('⚔', r(c.armas || 0), 'Armas forjadas o compradas, listas para tus guerreros' + (m.mercado ? ' · en el mercado: ' + m.mercado.precio.armas.toFixed(2) : ''), '') : '') +
      chip('👥', (c.aldeanos || 0) + '<small class="tenue">/' + (c.camas || 0) + '</small>', 'Aldeanos / camas', (c.aldeanos || 0) >= (c.camas || 0) ? 'mal' : '') +
      chip('🏘', esc(nivel.nombre), nivel.nombre + (M.NIVELES[(c.nivel || 0) + 1] ? ' · a ' + M.NIVELES[(c.nivel || 0) + 1].desde + ' vecinos será ' + M.NIVELES[(c.nivel || 0) + 1].nombre.toLowerCase() + ' (' + M.NIVELES[(c.nivel || 0) + 1].abre + ')' : '')) +
      (c.subiendo ? chip('⏫', esc(M.ERAS[c.subiendo.a].nombre) + ' <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span>', 'Pasando de edad', 'oro') : M.ERAS[c.era + 1] && S.puedeSubir(m, c).ok ? chip('⏫', '¡' + esc(M.ERAS[c.era + 1].nombre) + '!', 'Podéis avanzar de edad: toca tu plaza (o 🏛) y pulsa «Avanzar»', 'oro') : '') +
      chip('🔬', inv ? esc(inv.nombre) + ' <span class="barra mini"><span style="width:' + pct + '%"></span></span>' : '<span class="tenue">' + (M.ERAS[c.era + 1] ? (m.libre || M.ERAS[c.era + 1].desde == null ? 'próxima era' : M.ERAS[c.era + 1].nombre + ' en ' + S.anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) : 'todo investigado') + '</span>', inv ? 'Investigando: ' + inv.nombre + ' (' + inv.texto + ') · ' + pct + ' %' : 'Sin nada que investigar hasta la próxima era', 'tec');
    el.hidden = false;
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
      b.querySelector('.p-dato').textContent = M.ERAS[c.era].corto + ' · ' + habitantes(c);
      b.addEventListener('click', () => elegir(sel === c.id ? null : c.id, true));
      li.appendChild(b); ul.appendChild(li);
    }
    pintarFicha();
  }

  function fila(dt, dd) { return '<div class="fila"><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function pintarFicha() {
    const f = $('ficha');
    if (edificioSel != null && fichaEdificio(f)) return;
    if (aldeanoSel != null && fichaAldeano(f)) return;
    const c = sel != null ? S.civ(m, sel) : tuPueblo();
    if (!c || !c.viva) {
      sel = null;
      f.innerHTML = '<p class="vacio">Toca un pueblo en el mapa o en la lista para ver cómo vive. Lo que escribas sin nombrar a nadie le pasará al pueblo elegido.</p>';
      return;
    }
    const cs = S.casillas(m, c), cap = S.capacidad(m, c, cs);
    const enemigos = c.guerras.map(g => S.civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    const edificios = [c.saberes ? M.CASA_SABER(c.era) + (c.saberes > 1 ? ' (' + c.saberes + ')' : '') : '', c.castillos ? (c.era >= 7 ? 'fortín' : c.era >= 5 ? 'fortaleza' : c.era >= 2 ? 'castillo' : 'recinto de empalizada') : '', c.cuarteles ? 'cuartel' : '', c.arquerias ? (c.era >= 5 ? 'campo de tiro' : 'arquería') : '', c.torres ? c.torres + ' torre' + (c.torres > 1 ? 's' : '') : '', c.templos ? c.templos + ' templo' + (c.templos > 1 ? 's' : '') : '', c.molinos ? c.molinos + ' molino' + (c.molinos > 1 ? 's' : '') : '', c.puertos ? c.puertos + ' puerto' + (c.puertos > 1 ? 's' : '') + ' <span class="tenue">(' + ((m.vida.barcos || []).filter(b => b.c === c.id).length) + ' barcos)</span>' : ''].filter(Boolean).join(' · ') || '<span class="tenue">ninguno todavía</span>';
    // La ficha va por pestañas, para no enseñarlo todo de golpe.
    const pestanas = {
      resumen: ['Resumen', fila('Gobierna', esc(M.TITULOS[c.regimen] ? M.TITULOS[c.regimen].charAt(0).toUpperCase() + M.TITULOS[c.regimen].slice(1) : 'Rey') + ' ' + esc(S.nombreRey(c)) + (c.rey ? ' <span class="tenue">(' + esc(M.RASGOS[c.rey.rasgo].nombre) + ', ' + Math.round(c.rey.edad) + ' años' + (c.heredero ? '; heredero: ' + esc(c.heredero.nombre) : '') + ')</span>' : '')) +
        fila('Población', habitantes(c) + ' <span class="tenue">(la tierra da para ' + Math.round(cap / M.vida.escala(c)) + ')</span>') +
        fila('Estabilidad', '<span class="barra"><span style="width:' + Math.round(c.estab) + '%"></span></span> ' + Math.round(c.estab)) +
        fila('Riqueza', Math.round(c.riqueza)) + fila('Tierras', cs.length) +
        fila('Técnica', 'fase ' + (M.fase(c.era) + 1) + ' de 4: <b>' + esc(M.FASES[M.fase(c.era)].nombre) + '</b> <span class="tenue">(' + esc(M.FASES[M.fase(c.era)].resumen) + ')</span>') + fila('Inventos', esc(c.inventos.slice(-3).join(', ') || 'ninguno todavía')) +
        fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') +
        (ciudadesDe(c) ? fila('Ciudades', ciudadesDe(c)) : '')],
      economia: ['Economía', fila('Aldeanos', aldeanos(c)) +
        fila('Comida', Math.floor(c.comida || 0) + ' en el granero <span class="tenue">· ' + (c.campos || 0) + ' campos' + (c.efectos.some(e => e.sequia) ? ' · <b class="rojo">sequía</b>' : '') + '</span>') +
        fila('Ganado', ganado(c)) +
        fila('Madera', Math.floor(c.madera || 0) + ' <span class="tenue">· piedra ' + Math.floor(c.piedra || 0) + ' · ' + (c.arboles || 0) + ' árboles en su tierra</span>') +
        fila('Minas', Math.floor(c.metal || 0) + ' de ' + (c.era >= 6 ? 'acero' : c.era >= 2 ? 'hierro' : 'bronce') + ' <span class="tenue">· ' + Math.floor(c.oro || 0) + ' de oro</span>') +
        fila('Obras', (c.casas || 0) + ' casas') + fila('Edificios', edificios) + fila('Comercio', comercioDe(c)) + (c.era >= 2 || (m.creditos || []).some(x => x.de === c.id || x.a === c.id) ? fila('Banca', bancaDe(c)) : '')],
      ejercito: ['Ejército', fila('Ejército', (c.guerreros || 0) + ' guerreros' + (c.guerreros ? ' <span class="tenue">· ' + (c.armados || 0) + ' con ' + esc(M.vida.ARMAS[c.era].nombre) + (c.era >= 1 ? ', tiradores con ' + esc(M.vida.TIROS[c.era]) : '') + '</span>' : '')) +
        fila('Equipo', esc(M.vida.ARMAS[c.era].nombre) + ' <span class="tenue">(' + M.vida.ARMAS[c.era].dano + ' de daño, ' + esc(M.vida.ARMAS[c.era].material) + ')</span> · ' + esc(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].nombre) + ' <span class="tenue">(−' + Math.round(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].reduce * 100) + ' %)</span>') +
        (c.era >= 5 ? fila('Vehículos', vehiculosDe(c)) : '') +
        fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + (c.guerras.length ? '</dl>' + marcadorGuerra(c, !c.jugador) + '<dl>' : '')],
      diplomacia: ['Diplomacia', (S.aliadosDe(m, c).length ? fila('Aliados', esc(S.aliadosDe(m, c).map(o => o.nombre).join(', '))) : fila('Aliados', '<span class="tenue">ninguno</span>')) +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + fila('Opinión', opiniones(c))]
    };
    pestanas.tecnica = ['Técnica', arbolTecnico(c)];
    if (M.vida.pausada(m)) pestanas.ciudad = ['Ciudad', ciudadDe(c)];
    if (M.vida.pausada(m) && m.mercado) pestanas.mercado = ['Mercado', mercadoDe(c)];
    if (c.jugador) pestanas.plan = ['Tu plan', planDe(c)];
    if (!pestanas[pestana]) pestana = 'resumen';
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(c.nombre) + '</h3>' +
      '<p class="subt">' + esc(M.conCaracter(c.regimen, c.caracter)) + ' · ' + esc(era(c).nombre) + '</p>' +
      '<div class="pestanas" role="tablist">' + Object.keys(pestanas).map(k => '<button type="button" role="tab" class="pestana' + (k === pestana ? ' activa' : '') + '" aria-selected="' + (k === pestana) + '" data-p="' + k + '">' + pestanas[k][0] + '</button>').join('') + '</div>' +
      (pestana === 'plan' || pestana === 'tecnica' || pestana === 'ciudad' || pestana === 'mercado' ? pestanas[pestana][1] : '<dl>' + pestanas[pestana][1] + '</dl>') +
      (m.modo === 'pueblo' && !c.jugador && !enLinea() ? '<button type="button" class="mando gobernar">Gobernar este pueblo</button>' : '');
    f.querySelectorAll('.pestana').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.p; pintarFicha(); }));
    // Tocar una tecnología disponible de tu pueblo: se investiga esa (la misma orden que «investigad …»).
    f.querySelectorAll('.esp-elegir').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.k ? 'especializaos en ' + b.dataset.k : 'dejad de especializaros'); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelectorAll('.mercado-orden').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.orden); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelectorAll('.nec-obrar').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.orden); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    const av = f.querySelector('.avanzar-edad');
    if (av) av.addEventListener('click', () => { const r = X.ordenar(m, c.id, 'avanzad de edad'); if (r.ok) despuesDeOrden(r); pintarFicha(); });
    f.querySelectorAll('.tec-elegir').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, 'investigad ' + b.dataset.nombre); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelector('.muestra').style.background = c.color;
    if (c.jugador) f.querySelector('h3').insertAdjacentHTML('beforeend', ' <span class="tuyo">tu pueblo</span>');
    const b = f.querySelector('.gobernar');
    if (b) b.addEventListener('click', () => elegirModo('pueblo', c.id));
  }

  // Las prioridades de tu pueblo como barras: el pueblo se gobierna solo y esto es lo que pesa en sus decisiones.
  // El árbol de la técnica de un pueblo: lo hecho, lo que se investiga, lo que se puede elegir y lo que vendrá.
  // ---------- LA CORTE: el menú del palacio (o de la casa del jefe), como en Age of Empires ----------
  // Se abre tocando la plaza de un pueblo (o el botón 🏛). Arriba, las mejoras de la edad, cada una con su
  // botón; abajo, lo que pide la siguiente edad y el botón grande para avanzar. Hacen falta tres mejoras.
  let corteDe = null;
  const SEDE = ['Gran choza del jefe', 'Casa comunal', 'Palacio de piedra', 'Palacio', 'Castillo del rey', 'Palacio real', 'Palacio de gobierno', 'Sede del gobierno', 'Cuartel general'];
  function abrirCorte(id) { corteDe = id; if (tuPueblo() && id === tuPueblo().id) (m.guia = m.guia || {}).corte = 1; pintarCorte(); pintarConsejo(); if (movil()) document.body.classList.add('sin-panel'); }
  function cerrarCorte() { corteDe = null; $('corte').hidden = true; document.body.classList.remove('corte-abierta'); }
  function pintarCorte() {
    const el = $('corte'), c = corteDe != null ? S.civ(m, corteDe) : null;
    if (!c || !c.viva) { cerrarCorte(); return; }
    const mio = !!c.jugador, ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id, med = S.mejorasDeEdad(c);
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1], r = S.puedeSubir(m, c);
    const precioTxt = p => Object.keys(p || {}).map(k => (px(k) || '') + ' ' + p[k]).join(' ');
    const tarjeta = t => {
      const hecha = ts.includes(t.id), ahora = inv === t.id, falta = hecha || ahora ? [] : S.faltaPara(m, c, t);
      const pct = ahora ? Math.min(100, Math.round(100 * c.investigacion.puntos / M.costeTec(t))) : 0;
      const turnos = ahora ? Math.max(1, Math.ceil((M.costeTec(t) - c.investigacion.puntos) / Math.max(0.01, c.tecTurno || c.cienciaTurno || 1))) : 0;
      return '<div class="mejora' + (hecha ? ' hecha' : ahora ? ' ahora' : falta.length ? ' falta' : '') + '">' +
        '<div class="mejora-cab"><b>' + esc(t.nombre) + '</b>' + (hecha ? '<span class="verde">✓ hecha</span>' : '') + '</div>' +
        '<p class="mejora-texto">' + esc(t.texto) + '</p>' +
        (hecha ? '' : '<p class="mejora-precio"><span class="tenue">en ' + esc(M.LUGARES[t.lugar] || 'la plaza') + ' · ' + M.costeTec(t) + ' de saber · la investigan tus sabios, sin coste</span></p>') +
        (ahora ? '<div class="mejora-barra"><span class="barra"><span style="width:' + pct + '%"></span></span> ' + pct + ' % <span class="tenue">· unos ' + turnos + ' turnos</span></div>' + (() => { const d = S.porPagar(c, t), ks = Object.keys(d); return ks.length ? '<p class="' + (c.investigacion.esperaPago ? 'rojo ' : 'tenue ') + 'mejora-falta">' + (c.investigacion.esperaPago ? 'Parado: faltan recursos para seguir pagando · ' : 'Se paga poco a poco · queda ') + esc(precioTxt(d)) + '</p>' : ''; })() :
          !hecha && mio ? (falta.length ? '<p class="rojo mejora-falta">Falta: ' + esc(falta.join(', ')) + '</p>' : '') + '<button type="button" class="' + (falta.length ? 'mando sutil' : 'obrar') + ' corte-tec" data-nombre="' + esc(t.nombre) + '">' + (falta.length ? 'Apuntar para después' : 'Investigar') + '</button>' : '') +
        '</div>';
    };
    const pendientesViejas = M.TECNOLOGIAS.filter(t => t.era < c.era && !ts.includes(t.id));
    const item = (ok, txt) => '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + ' ' + txt + '</li>';
    const ft = r.falta.join(' ');
    const pideEdad = sig ? '<ul class="edad-req">' +
      item(!/mejora/.test(ft), 'Mejoras de esta edad: <b>' + med.hechas + ' / ' + med.pide + '</b>') +
      item(!/saber/.test(ft), 'Saber ' + Math.floor(c.ciencia) + ' / ' + sig.umbral + ' <span class="tenue">(lo traen tus ' + esc(M.ERUDITO(c.era).varios) + ')</span>') +
      (sig.desde != null && !m.libre ? item(!/llegar al año/.test(ft), 'Llegar al año ' + esc(S.anioTexto(sig.desde).replace(/(\d)\.$/, '$1'))) : '') +
      (req ? item(!/ser una|ser un|un templo|un cuartel|un castillo/.test(ft), esc(req.texto.charAt(0).toUpperCase() + req.texto.slice(1))) + item(!/ de (comida|madera|piedra|oro|metal)/.test(ft), 'Pagar ' + ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => (px(k) || '') + ' ' + req[k]).join(' ')) : '') + '</ul>' : '';
    el.innerHTML = '<div class="corte-cab"><div><p class="corte-sede">🏛 ' + esc(SEDE[c.era] || 'La corte') + ' de ' + esc(c.nombre) + '</p><p class="corte-era">' + esc(M.ERAS[c.era].nombre) + (mio ? '' : ' <span class="tenue">· no es tu pueblo</span>') + '</p></div><button type="button" class="cerrar corte-cerrar" aria-label="Cerrar">×</button></div>' +
      '<div class="corte-cuerpo">' +
      '<p class="tec-era">' + esc(('Mejoras de ' + M.ERAS[c.era].con).replace(/ de el /, ' del ')) + ' <span class="tenue">· ' + med.hechas + ' de ' + med.lista.length + ' hechas (hacen falta ' + med.pide + ' para avanzar)</span></p>' +
      '<div class="mejoras">' + med.lista.map(tarjeta).join('') + '</div>' +
      (pendientesViejas.length ? '<details class="corte-viejas"><summary>Mejoras pendientes de edades anteriores (' + pendientesViejas.length + ')</summary><div class="mejoras">' + pendientesViejas.map(tarjeta).join('') + '</div></details>' : '') +
      (sig ? '<p class="tec-era">Siguiente edad: ' + esc(sig.nombre) + '</p>' + (c.subiendo ? '<p class="corte-subiendo">⏫ Pasando a ' + esc(sig.con) + ' <span class="barra"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span> faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos' + (c.subiendo.debe ? ' <span class="tenue">· por pagar ' + Object.keys(c.subiendo.debe).map(k => Math.ceil(c.subiendo.debe[k]) + ' de ' + esc(k)).join(', ') + (c.subiendo.espera ? ' (esperando material)' : '') + '</span>' : '') + '</p>' : pideEdad +
        (mio ? '<button type="button" class="obrar corte-avanzar"' + (r.ok ? '' : ' disabled') + '>' + (r.ok ? '⏫ Avanzar a ' + esc(sig.nombre) : 'Aún no se puede avanzar') + '</button>' +
          '<label class="corte-auto"><input type="checkbox" class="corte-auto-c"' + (c.plan && c.plan.autoEdad ? ' checked' : '') + '> Avanzar solos en cuanto se pueda</label>' : '')) : '<p class="tenue">Es la última edad.</p>') +
      '</div>';
    el.hidden = false; document.body.classList.add('corte-abierta');
    el.querySelector('.corte-cerrar').addEventListener('click', cerrarCorte);
    el.querySelectorAll('.corte-tec').forEach(b => b.addEventListener('click', () => { const res = X.ordenar(m, c.id, 'investigad ' + b.dataset.nombre); if (res.ok) despuesDeOrden(res); pintarCorte(); }));
    const av = el.querySelector('.corte-avanzar'); if (av) av.addEventListener('click', () => { const res = X.ordenar(m, c.id, 'avanzad de edad'); if (res.ok) despuesDeOrden(res); pintarCorte(); });
    const au = el.querySelector('.corte-auto-c'); if (au) au.addEventListener('change', () => { X.ordenar(m, c.id, au.checked ? 'avanzad de edad solos' : 'no avancéis de edad solos'); pintarCorte(); });
  }
  // ---------- El modo arquitecto: eliges un edificio (o calle) y tocas el mapa donde quieres que vaya ----------
  let arquiClave = null;
  const ARQUI = [['colonia', '🏕', 'Fundar pueblo'], ['casa', '🏠', 'Casa'], ['camino', '🧱', 'Calle'], ['pozo', '🪣', 'Pozo'], ['granero', '🌾', 'Granero'], ['fuente', '⛲', 'Plaza pública'], ['parque', '🌳', 'Parque'], ['templo', '⛪', 'Templo'], ['saber', '📜', 'Saber'], ['palacio', '🏰', 'Palacio'], ['central', '⚡', 'Central eléctrica'], ['banco', '🏦', 'Banco'], ['fabrica', '🏭', 'Fábrica'], ['estacion', '🚂', 'Estación de tren'], ['hospital', '🏥', 'Hospital'], ['aerodromo', '✈', 'Aeródromo'], ['petroleo', '🛢', 'Pozo de petróleo'], ['mina', '⛏', 'Mina'], ['molino', '⚙', 'Molino'], ['torre', '🗼', 'Torre'], ['puerto', '⚓', 'Puerto'], ['cuartel', '⚔', 'Cuartel'], ['arqueria', '🏹', 'Arquería'], ['castillo', '🏯', 'Castillo']];
  function abrirArquitecto() {
    const c = tuPueblo();
    if (!c) return;
    if (tropasActivas) salirTropas();
    const V = M.vida, el = $('arquitecto');
    const nombre = k => k === 'templo' ? (c.era === 4 ? 'Iglesia' : c.era >= 5 && c.era <= 6 ? 'Catedral' : 'Templo') : k === 'saber' ? M.CASA_SABER(c.era).replace(/^./, x => x.toUpperCase()) : ARQUI.find(x => x[0] === k)[2];
    const coste = k => { if (k === 'camino') return 'gratis'; if (k === 'colonia') return '3 colonos'; const q = V.COSTES[V.OBRA[k]] || [0, 0, 0]; return [q[0] ? q[0] + '🪵' : '', q[1] ? q[1] + '🪨' : '', q[2] ? q[2] + '🪙' : ''].filter(Boolean).join(' ') || 'gratis'; };
    const nec = new Set((c.necesidades || []).filter(n => n.falta).map(n => n.obra));
    el.innerHTML = '<div class="arqui-cabeza"><b>🏗 Arquitecto</b> <span class="tenue" id="arqui-ayuda">' + (arquiClave === 'colonia' ? 'Toca una tierra libre donde fundar un pueblo nuevo (al otro lado del mar, irán en barco desde tu puerto).' : arquiClave ? 'Toca el mapa donde quieras ' + esc(nombre(arquiClave).toLowerCase()) + '. Toca otra vez para quitarlo.' : 'Elige qué construir y toca tu tierra. Tus constructores lo harán por orden.') + '</span> <button type="button" class="mando sutil arqui-salir">Salir</button></div>' +
      '<div class="arqui-lista">' + ARQUI.filter(([k]) => k === 'camino' || k === 'colonia' || (V.ERA_OBRA[V.OBRA[k]] || 0) <= c.era + 1).map(([k, ico]) => {
        const nivel = V.NIVEL_OBRA[V.OBRA[k]] || 0, eraPide = V.ERA_OBRA[V.OBRA[k]] || 0;
        const bloqueo = k === 'camino' || k === 'colonia' ? null : c.era < eraPide ? M.ERAS[eraPide].corto.charAt(0) + M.ERAS[eraPide].corto.slice(1).toLowerCase() : (c.nivel || 0) < nivel ? ['aldea', 'aldea', 'pueblo', 'villa', 'ciudad'][nivel] : null;
        return '<button type="button" class="arqui-op' + (arquiClave === k ? ' activa' : '') + (nec.has(k) ? ' falta' : '') + '" data-k="' + k + '"' + (bloqueo ? ' disabled title="Hace falta: ' + bloqueo + '"' : ' title="' + esc(nombre(k) + ' · ' + coste(k) + (nec.has(k) ? ' · ¡hace falta!' : '')) + '"') + '><i>' + ico + '</i><span>' + esc(nombre(k)) + '</span><small>' + (bloqueo ? '🔒 ' + bloqueo : coste(k)) + '</small></button>';
      }).join('') + '</div>';
    el.hidden = false; $('arquitecto-btn').setAttribute('aria-pressed', 'true');
    const cab = document.querySelector('.g-cab');
    el.style.top = movil() ? '' : Math.round((cab ? cab.getBoundingClientRect().bottom : 0) + 8) + 'px';
    document.body.classList.add('arqui-abierto');
    if (movil()) { document.body.classList.add('sin-panel'); document.body.classList.remove('ordenes-abiertas'); }
    el.querySelector('.arqui-salir').addEventListener('click', salirArquitecto);
    el.querySelectorAll('.arqui-op').forEach(b => b.addEventListener('click', () => { arquiClave = arquiClave === b.dataset.k ? null : b.dataset.k; ponerArquitecto(); abrirArquitecto(); }));
  }
  function ponerArquitecto() {
    const c = tuPueblo();
    if (!arquiClave || !c) { P.arquitecto(null); return; }
    P.arquitecto({ clave: arquiClave, civ: c.id, valida: t => M.vida.puedeColocar(m, c, t, arquiClave), alColocar: t => {
      const r = M.vida.encargar(m, c, t, arquiClave), ayuda = $('arqui-ayuda');
      if (ayuda && arquiClave === 'colonia') { ayuda.textContent = r.ok ? (r.enviado ? '📡 Enviado: los colonos saldrán al empezar el próximo turno.' : r.quitado ? 'Anulado: no saldrán colonos.' : r.via && r.via.mar ? '⛵ Hecho: tres colonos irán a tu puerto, cruzarán el mar en barco y fundarán allí un pueblo.' : '🏕 Hecho: tres colonos saldrán andando a fundar allí un pueblo.') : 'No: ' + r.razon + '.'; return; }
      if (ayuda) ayuda.textContent = r.ok ? (r.quitado ? 'Quitado.' : 'Encargado: ' + ((c.plan.encargos || []).length) + ' obra' + ((c.plan.encargos || []).length === 1 ? '' : 's') + ' en cola. Toca otra vez para quitarlo.') : 'No: ' + r.razon + '.';
    } });
  }
  // ---------- El modo tropas: eliges soldados en el mapa y los mandas a un sitio (como en Age of Empires) ----------
  let tropasActivas = false;
  function pintarBarraTropas(sel) {
    const el = $('tropas-barra'), c = tuPueblo();
    if (!el || !c) return;
    const n = sel ? sel.size : P.tropasElegidas().length, total = m.vida.aldeanos.filter(a => a.c === c.id && a.o === 4).length;
    el.innerHTML = '<span class="tropas-texto">⚔ <b>' + n + '</b> de ' + total + ' soldados elegidos · ' + (n ? 'toca el mapa para mandarlos (si es tierra enemiga, atacan)' : 'arrastra sobre el mapa para elegir soldados') + '</span>' +
      '<button type="button" class="mando" data-t="todos">Todos</button><button type="button" class="mando" data-t="ninguno">Ninguno</button>' +
      '<button type="button" class="mando" data-t="auto"' + (n ? '' : ' disabled') + ' title="Que vuelvan a moverse solos con el ejército">Automático</button><button type="button" class="mando sutil" data-t="salir">Salir</button>';
    el.hidden = false;
    const cab = document.querySelector('.g-cab');
    el.style.top = movil() ? '' : Math.round((cab ? cab.getBoundingClientRect().bottom : 0) + 8) + 'px';
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.t, c2 = tuPueblo(); if (!c2) return;
      if (t === 'todos') P.elegirTropas(m.vida.aldeanos.filter(a => a.c === c2.id && a.o === 4).map(a => a.id));
      else if (t === 'ninguno') P.elegirTropas([]);
      else if (t === 'auto') { acabarTurno(); const r = X.ordenar(m, c2.id, '#tropas-libres ' + P.tropasElegidas().join(',')); if (r && r.respuesta) avisoFlotante(r.respuesta, 3000); P.elegirTropas([]); }
      else if (t === 'salir') salirTropas();
    }));
  }
  function abrirTropas() {
    const c = tuPueblo(); if (!c) return;
    if (arquiClave || !$('arquitecto').hidden) salirArquitecto();
    tropasActivas = true; $('tropas-btn').setAttribute('aria-pressed', 'true'); document.body.classList.add('tropas-abierto');
    P.modoTropas({ civ: c.id, alCambiar: sel => pintarBarraTropas(sel), alOrdenar: t => {
      const c2 = tuPueblo(), ids = P.tropasElegidas(); if (!c2 || !ids.length) return;
      acabarTurno();
      const r = X.ordenar(m, c2.id, '#tropas ' + ids.join(',') + ' ' + t);
      if (r && r.respuesta) avisoFlotante(r.respuesta, 3500);
      pintarTodo();
    } });
    pintarBarraTropas(new Set());
  }
  function salirTropas() { tropasActivas = false; P.modoTropas(null); const el = $('tropas-barra'); if (el) el.hidden = true; $('tropas-btn').setAttribute('aria-pressed', 'false'); document.body.classList.remove('tropas-abierto'); }
  function salirArquitecto() { document.body.classList.remove('arqui-abierto'); arquiClave = null; P.arquitecto(null); $('arquitecto').hidden = true; $('arquitecto-btn').setAttribute('aria-pressed', 'false'); }
  // ---------- La pestaña Mercado: precios del mundo, a qué se dedica el reino, sus socios y sus tratos ----------
  const ICONO_BIEN = new Proxy({}, { get: (o, k) => px(k) || ({ comida: '🌾', madera: '🪵', piedra: '🪨', metal: '⛓', armas: '⚔', carbon: '⚫', petroleo: '🛢', muebles: '🪑', vehiculos: '🛡', semillas: '🌰', granadas: '💣' })[k] });
  function curva(h, col) {
    if (!h || h.length < 2) return '';
    const max = Math.max(...h), min = Math.min(...h), w = 64, al = 18, sp = Math.max(0.0001, max - min);
    const pts = h.map((x, i) => Math.round(i / (h.length - 1) * w) + ',' + Math.round(al - 2 - (x - min) / sp * (al - 4))).join(' ');
    return '<svg class="curva" viewBox="0 0 ' + w + ' ' + al + '" width="' + w + '" height="' + al + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.5" shape-rendering="crispEdges"/></svg>';
  }
  function mercadoDe(c) {
    const mk = m.mercado, V = M.vida, bienes = V.bienesDe(c), nb = k => V.NOMBRE_BIEN[k] || k;
    const socios = M.vida.sociosDe(m, c);
    const tabla = '<table class="mercado"><thead><tr><th>Bien</th><th>Precio</th><th>Últimos turnos</th><th>Hay / hace falta</th></tr></thead><tbody>' + bienes.map(k => {
      const h = mk.historia[k] || [], d = h.length > 6 ? h[h.length - 1] - h[h.length - 7] : 0, base = V.PRECIO_BASE[k];
      const col = mk.precio[k] > base * 1.25 ? '#ff8a7a' : mk.precio[k] < base * 0.8 ? '#9ad08a' : '#f0c05a';
      return '<tr><td>' + ICONO_BIEN[k] + ' ' + nb(k) + '</td><td class="num" style="color:' + col + '">' + (mk.precio[k] || V.PRECIO_BASE[k]).toFixed(2) + (d > 0.02 ? ' ▲' : d < -0.02 ? ' ▼' : '') + '</td><td>' + curva(h, col) + '</td><td class="num tenue">' + mk.oferta[k] + ' / ' + mk.demanda[k] + '</td></tr>';
    }).join('') + '</tbody></table>';
    const b = c.balance || { sobra: {}, falta: {}, urg: {} };
    const sobra = bienes.filter(k => b.sobra[k] >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.floor(b.sobra[k]) + ' ' + nb(k)).join(' · ') || 'nada';
    const falta = bienes.filter(k => b.falta[k] >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.ceil(b.falta[k]) + ' ' + nb(k) + (b.urg[k] >= 1 ? ' <b class="rojo">¡urgente!</b>' : '')).join(' · ') || 'nada';
    const esp = c.especialidad, elegida = c.plan && c.plan.especialidad;
    const tratos = (mk.tratos || []).filter(x => x.vende === c.id || x.compra === c.id).slice(-6).reverse();
    const nombre = id => esc((S.civ(m, id) || { nombre: '—' }).nombre);
    const pedidos = ((c.plan && c.plan.pedidos) || []).map(x => '📦 ' + x.n + ' ' + x.que).concat(((c.plan && c.plan.ventas) || []).map(x => '🏷 ' + x.n + ' ' + x.que)).join(' · ');
    return '<div class="arbol">' +
      '<p class="arbol-ayuda">El precio de cada cosa sale de lo que hay en todo el mundo frente a lo que todos necesitan: si sobra, baja; si escasea, sube. Pero solo se compra y se vende con los reinos con los que hay ruta: sus comerciantes traen lo que os falta y se llevan lo que os sobra, a cambio de oro.</p>' +
      (mk.suceso ? '<p class="arbol-ayuda"><b>📈 ' + esc(mk.suceso.titulo) + '</b>: ' + esc(mk.suceso.k) + (mk.suceso.f > 1 ? ' más caro' : ' más barato') + ' durante ' + Math.max(1, mk.suceso.hasta - m.turno) + ' turnos más.</p>' : '') +
      (c.oferta && c.jugador ? '<div class="oferta"><b>🤝 ' + esc((S.civ(m, c.oferta.de) || {}).nombre || 'Un mercader') + '</b> ' + (c.oferta.tipo === 'venta' ? 'os ofrece ' + c.oferta.n + ' ' + ICONO_BIEN[c.oferta.que] + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro' : 'quiere comprar ' + c.oferta.n + ' ' + ICONO_BIEN[c.oferta.que] + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro') + ' <span class="tenue">(mercado: ' + Math.round(mk.precio[c.oferta.que] * c.oferta.n) + ')</span><div class="linea"><button type="button" class="obrar mercado-orden" data-orden="acepto el trato">Aceptar</button><button type="button" class="mando sutil mercado-orden" data-orden="rechazo el trato">Rechazar</button></div></div>' : '') +
      '<div class="tec-era">Precios del mundo</div>' + tabla +
      '<div class="tec-era">' + esc(c.nombre) + ' se dedica a</div>' +
      '<p class="arbol-ayuda">' + (esp ? ICONO_BIEN[esp] + ' <b>' + esp + '</b>' + (elegida ? ' (lo mandaste tú)' : ' — reparte su trabajo según lo que le rinde, y cambia cuando otra cosa se paga mejor') : 'aún nada en especial') + '</p>' +
      (c.cartera ? '<div class="cartera">' + Object.keys(c.cartera).map(k => '<div class="cartera-fila"><span>' + ICONO_BIEN[k] + ' ' + k + '</span><span class="barra"><span style="width:' + Math.round(c.cartera[k] * 100) + '%"></span></span><b>' + Math.round(c.cartera[k] * 100) + '%</b></div>').join('') + '</div>' : '') +
      (c.rentable ? '<p class="arbol-ayuda tenue">Lo que le rinde cada cosa ahora: ' + bienes.filter(k => c.rentable[k] > 0).sort((x, y) => c.rentable[y] - c.rentable[x]).map(k => ICONO_BIEN[k] + ' ' + (c.rentable[k] * 10).toFixed(1)).join(' · ') + (c.ganado && bienes.some(k => (c.ganado[k] || 0) >= 1) ? ' · oro ganado vendiendo: ' + bienes.filter(k => (c.ganado[k] || 0) >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.round(c.ganado[k])).join(' ') : '') + '</p>' : '') +
      ((c.cambiosEsp || []).length ? '<p class="arbol-ayuda tenue">Cambios: ' + c.cambiosEsp.slice(-4).reverse().map(x => (m.turno - x.t) + ' turnos atrás, de ' + x.de + ' a ' + x.a + ' (' + esc(x.motivo) + ')').join(' · ') + '</p>' : '') +
      (c.jugador ? '<div class="linea esp-botones">' + bienes.map(k => '<button type="button" class="mando sutil esp-elegir' + (esp === k ? ' activa' : '') + '" data-k="' + k + '">' + ICONO_BIEN[k] + ' ' + k + '</button>').join('') + (elegida ? '<button type="button" class="mando sutil esp-elegir" data-k="">Que elija el pueblo</button>' : '') + '</div>' : '') +
      '<p class="arbol-ayuda">Le sobra para vender: ' + sobra + '</p><p class="arbol-ayuda">Le falta: ' + falta + '</p>' +
      (pedidos ? '<p class="arbol-ayuda">En espera: ' + pedidos + '</p>' : '') +
      '<div class="tec-era">Socios</div>' +
      (socios.length ? '<ul class="edad-req">' + socios.map(o => {
        const ob = o.balance || { sobra: {}, urg: {} };
        const ofrece = bienes.filter(k => ob.sobra[k] >= 1).map(k => ICONO_BIEN[k]).join(' ') || '—', necesita = bienes.filter(k => ob.urg[k] >= 0.3).map(k => ICONO_BIEN[k]).join(' ') || '—';
        const compra = c.jugador ? bienes.filter(k => ob.sobra[k] >= 3 && b.falta[k] >= 1).slice(0, 2).map(k => '<button type="button" class="mando sutil mercado-orden" data-orden="comprad ' + Math.min(Math.ceil(b.falta[k]), Math.floor(ob.sobra[k])) + ' de ' + k + '">Comprar ' + ICONO_BIEN[k] + '</button>').join('') : '';
        return '<li><b>' + esc(o.nombre) + '</b> <span class="tenue">· le sobra ' + ofrece + ' · le falta ' + necesita + '</span> ' + compra + '</li>';
      }).join('') + '</ul>' : '<p class="tenue arbol-ayuda">Sin rutas con otros reinos: todo lo que necesite lo tiene que producir. Con buenas relaciones (o «comerciad con X») se abre una ruta y llegan las carretas.</p>') +
      '<div class="tec-era">Últimos tratos</div>' +
      (tratos.length ? '<ul class="edad-req">' + tratos.map(x => '<li>' + (x.ruta === 'mar' ? '⛵ ' : '') + (x.compra === c.id ? '🛒 Compra ' : '💰 Vende ') + x.n + ' ' + ICONO_BIEN[x.que] + ' ' + x.que + (x.compra === c.id ? ' a ' + nombre(x.vende) : ' a ' + nombre(x.compra)) + ' por <b>' + Math.round(x.oro) + '</b> 🪙 <span class="tenue">(' + (m.turno - x.t === 0 ? 'ahora' : 'hace ' + (m.turno - x.t) + ' turnos') + ')</span></li>').join('') + '</ul>' : '<p class="tenue arbol-ayuda">Ninguno todavía.</p>') +
      '</div>';
  }
  // La pestaña Ciudad: lo que el pueblo necesita y por qué, el ánimo de la gente, la estación y las obras en marcha.
  function ciudadDe(c) {
    const V = M.vida, nec = c.necesidades || [], est = m.vida.estacion;
    const ORDEN = { banco: 'abrid un banco', fabrica: 'construid una fábrica', estacion: 'construid una estación de tren', hospital: 'construid un hospital', aerodromo: 'construid un aeródromo', central: 'construid una central eléctrica', pozo: 'construid un pozo', granero: 'construid un granero', fuente: 'construid una plaza pública', parque: 'haced un parque', palacio: 'construid un palacio', templo: 'construid un templo' };
    const ESTA = ['🌱 Primavera: se siembra y los campos brotan deprisa.', '☀️ Verano: los campos maduran.', '🍂 Otoño: la gran cosecha. Es el momento de llenar el granero.', '❄️ Invierno: no crece nada, apenas se recolecta y se quema el doble de leña.'];
    const quedan = V.ESTACION_TURNOS - (m.turno % V.ESTACION_TURNOS);
    const animo = c.animo == null ? 70 : c.animo, cara = animo >= 75 ? '😊' : animo >= 50 ? '🙂' : animo >= 30 ? '😟' : '😠';
    const obras = Object.entries(m.vida.andamios || {}).filter(([, a]) => a.civ === c.id);
    const NOMBRE_OBRA = o => ({ [V.OBRA.casa]: 'casa', [V.OBRA.pozo]: 'pozo', [V.OBRA.granero]: 'granero', [V.OBRA.fuente]: 'plaza pública', [V.OBRA.parque]: 'parque', [V.OBRA.palacio]: 'palacio', [V.OBRA.central]: 'central eléctrica', [V.OBRA.banco]: 'banco', [V.OBRA.fabrica]: 'fábrica', [V.OBRA.estacion]: 'estación de tren', [V.OBRA.hospital]: 'hospital', [V.OBRA.aerodromo]: 'aeródromo', [V.OBRA.templo]: c.era === 4 ? 'iglesia' : c.era >= 5 && c.era <= 6 ? 'catedral' : 'templo', [V.OBRA.saber]: M.CASA_SABER(c.era), [V.OBRA.torre]: 'torre', [V.OBRA.molino]: 'molino', [V.OBRA.puerto]: 'puerto', [V.OBRA.cuartel]: 'cuartel', [V.OBRA.arqueria]: 'arquería', [V.OBRA.castillo]: 'castillo', [V.OBRA.aduana]: 'puesto fronterizo', [V.OBRA.petroleo]: 'pozo de petróleo', [V.OBRA.mina]: 'mina' }[o] || 'obra');
    const vistas = new Set();
    const lista = nec.filter(n => { const k = n.obra + (n.capital ? 'c' : n.region); if (vistas.has(k)) return false; vistas.add(k); return true; }).map(n => {
      const donde = n.capital ? '' : ' <span class="tenue">(en ' + esc(((m.ciudades || []).find(x => x.region === n.region) || { nombre: 'otra ciudad' }).nombre) + ')</span>';
      return '<li class="' + (n.falta ? 'no' : 'ok') + '"><b>' + (n.falta ? '✗ ' : '✓ ') + esc(n.nombre) + '</b>' + donde + ' — ' + esc(n.falta ? n.mal : n.bien) +
        (n.falta ? ' <span class="tenue">(' + (n.estab < 0 ? n.estab + ' de estabilidad' : '') + ')</span>' + (c.jugador && n.capital && ORDEN[n.obra] ? ' <button type="button" class="obrar nec-obrar" data-orden="' + ORDEN[n.obra] + '">Hacer ' + esc(n.edificio) + '</button>' : '') : '') + '</li>';
    }).join('');
    return '<div class="arbol"><p class="arbol-ayuda">' + (est >= 0 ? esc(ESTA[est]) + ' <span class="tenue">Quedan ' + quedan + ' turnos.</span>' : '') + '</p>' +
      '<p class="arbol-ayuda">' + ({ aceite: '🏮 Alumbrado: faroles de aceite en las plazas.', gas: '🕯 Alumbrado: farolas de gas victorianas por las calles.', electrico: '💡 Alumbrado eléctrico: farolas y luz en las casas.' }[c.alumbrado] || (c.era >= 7 ? '🌑 Sin luz eléctrica: hace falta una central (y ser ciudad).' : c.era >= 4 ? '🌑 Calles a oscuras: los faroles llegan al ser pueblo' + (c.era >= 6 ? ' (las farolas de gas, al ser villa)' : '') + '.' : '🔥 De noche solo hay hogueras: el alumbrado llega con la Edad Media.')) + '</p>' +
      '<p class="arbol-ayuda">' + cara + ' Ánimo de la gente: <b>' + animo + '</b>/100 <span class="barra mini"><span style="width:' + animo + '%"></span></span></p>' +
      (() => {
        // Los campos: cuántos de cada cultivo, cuántos con regadío y lo cosechado.
        const v = m.vida, ter = V.terrenos(m), cuenta = {}; let reg = 0;
        for (const r of S.casillas(m, c)) for (const t of V.parcelas(m, r)) if (v.obra[t] === V.OBRA.campo) { const k = V.cultivoTipo(m, ter, t); cuenta[k] = (cuenta[k] || 0) + 1; if (V.regadio(m, ter, t)) reg++; }
        const NOM = { trigo: '🌾 trigo', maiz: '🌽 maíz', arroz: '🍚 arroz', vina: '🍇 viña' }, tot = Object.values(cuenta).reduce((a, b) => a + b, 0);
        if (!tot) return '';
        return '<div class="tec-era">Los campos</div><p class="arbol-ayuda">' + Object.keys(cuenta).map(k => NOM[k] + ' ' + cuenta[k]).join(' · ') + ' · <b>' + reg + '</b> con regadío (junto al río rinden más)' + (c.cosechaRecord && m.turno - c.cosechaRecord < 12 ? ' · <b class="verde">¡cosecha récord!</b>' : '') + '</p><p class="arbol-ayuda tenue">Cada cultivo según la tierra: el trigo en la llanura, el maíz en la selva y la sabana (rinde más), el arroz en los pantanos y junto al agua, la viña en las colinas (menos comida, pero su vino se vende por oro).</p>';
      })() +
      '<div class="tec-era">Lo que necesita ' + esc(c.nombre) + '</div>' +
      (lista ? '<ul class="edad-req nec">' + lista + '</ul>' : '<p class="tenue arbol-ayuda">Un campamento no pide más que comida y techo. Al crecer (aldea, pueblo, villa, ciudad) pedirá granero, plaza, parque y palacio.</p>') +
      '<div class="tec-era">Obras en marcha</div>' +
      (obras.length ? '<ul class="edad-req">' + obras.map(([, a]) => '<li>🏗 ' + esc(NOMBRE_OBRA(a.o)) + ' <span class="barra mini"><span style="width:' + Math.round(100 * (1 - Math.max(0, a.falta) / a.total)) + '%"></span></span></li>').join('') + '</ul>' : '<p class="tenue arbol-ayuda">Ninguna ahora mismo.</p>') +
      '</div>';
  }
  function arbolTecnico(c) {
    const ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id;
    const eras = [...new Set(M.TECNOLOGIAS.map(t => t.era))].filter(e => e <= c.era + 1);
    const pide = c.plan && c.plan.investigar;
    // Subir de edad: requisitos con ✓/✗ y el botón (como en Age of Empires).
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1];
    let edad = '';
    if (sig) {
      const r = S.puedeSubir(m, c), precio = req ? ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => req[k] + ' ' + k).join(' · ') : '';
      const item = (ok, txt) => '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + ' ' + esc(txt) + '</li>';
      const faltaTxt = r.falta.join(' ');
      edad = '<div class="edad"><p class="tec-era">Siguiente edad: ' + esc(sig.nombre) + '</p>' + (c.subiendo ? '<p>⏫ Pasando a ' + esc(sig.con) + ': <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span> faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos' + (c.subiendo.debe ? ' <span class="tenue">· por pagar ' + Object.keys(c.subiendo.debe).map(k => Math.ceil(c.subiendo.debe[k]) + ' de ' + esc(k)).join(', ') + '</span>' : '') + '</p>' :
        '<ul class="edad-req">' + item(!/saber/.test(faltaTxt), 'Saber ' + Math.floor(c.ciencia) + ' / ' + sig.umbral + ' (lo traen tus ' + M.ERUDITO(c.era).varios + ')') +
        (sig.desde != null && !m.libre ? item(!/llegar al año/.test(faltaTxt), 'Año ' + S.anioTexto(sig.desde).replace(/(\d)\.$/, '$1')) : '') +
        (req ? item(!/ser una|ser un|un templo|un cuartel|un castillo/.test(faltaTxt), req.texto.charAt(0).toUpperCase() + req.texto.slice(1)) + item(!/ de (comida|madera|piedra|oro|metal)/.test(faltaTxt), 'Pagar ' + precio) : '') + '</ul>' +
        (c.jugador ? '<button type="button" class="obrar avanzar-edad"' + (r.ok ? '' : ' disabled') + '>Avanzar a ' + esc(sig.nombre) + '</button>' : '')) + '</div>';
    }
    return '<div class="arbol">' + edad + (c.jugador ? '<p class="tenue arbol-ayuda">Las mejoras se investigan en su edificio (el molino, el templo, el cuartel…) y no cuestan recursos: las investigan tus sabios (cuantos más, antes); lo que se paga es el paso de edad. El saber lo traen tus ' + esc(M.ERUDITO(c.era).varios) + '. Toca una para investigarla o escribe «investigad …».</p>' : '') + eras.map(e => {
      const filas = M.TECNOLOGIAS.filter(t => t.era === e).map(t => {
        const hecha = ts.includes(t.id), ahora = inv === t.id, abierta = !hecha && t.era <= c.era;
        const pct = ahora ? Math.min(100, Math.round(100 * c.investigacion.puntos / M.costeTec(t))) : 0;
        const falta = !hecha && !ahora && abierta ? S.faltaPara(m, c, t) : [];
        const precio = '<span class="tec-precio">' + esc(M.LUGARES[t.lugar] || 'la plaza') + ' · la investigan tus sabios</span>';
        const estado = hecha ? '<span class="verde">✓</span>' : ahora ? '<span class="barra mini"><span style="width:' + pct + '%"></span></span> ' + pct + ' %' : abierta ? (c.jugador ? '<button type="button" class="ejemplo tec-elegir" data-nombre="' + esc(t.nombre) + '">' + (pide === t.id ? 'siguiente' : 'investigar') + '</button>' : '<span class="tenue">pendiente</span>') : '<span class="tenue">🔒</span>';
        return '<li class="tec' + (hecha ? ' hecha' : ahora ? ' ahora' : abierta ? '' : ' cerrada') + '"><span class="tec-nombre">' + esc(t.nombre) + '</span> <span class="tenue">' + esc(t.texto) + '</span> <span class="tec-estado">' + estado + '</span>' + (hecha ? '' : '<br>' + precio + (falta.length ? ' <span class="rojo">· falta ' + esc(falta.join(', ')) + '</span>' : '')) + '</li>';
      }).join('');
      return '<p class="tec-era">' + esc(M.ERAS[e].nombre) + (e > c.era ? ' <span class="tenue">· próxima era</span>' : '') + '</p><ul class="tec-lista">' + filas + '</ul>';
    }).join('') + '</div>';
  }
  function planDe(c) {
    const p = c.plan || {}, pr = p.prioridad || {}, l = [];
    const barras = Object.keys(X.NOMBRE_RECURSO).map(k => {
      const v = pr[k] != null ? pr[k] : 1;
      return '<div class="prio"><span class="prio-nombre">' + X.NOMBRE_RECURSO[k] + '</span><span class="prio-barra" aria-hidden="true">' +
        [0.5, 1, 1.5, 2].map(x => '<i class="' + (v >= x ? 'lleno' : '') + '"></i>').join('') + '</span><span class="prio-nivel">' + X.NIVEL(v) + '</span></div>';
    }).join('');
    const rumbo = typeof p.rumbo === 'number' ? 'hacia ' + ((S.civ(m, p.rumbo) || {}).nombre || '?') : p.rumbo ? 'hacia el ' + p.rumbo : null;
    if (rumbo && p.expandir !== false) l.push(fila('Rumbo', esc(rumbo)));
    const socios = (p.socios || []).map(id => S.civ(m, id)).filter(o => o && o.viva).map(o => o.nombre);
    if (socios.length) l.push(fila('Tratados', esc(socios.join(', '))));
    const ofertas = Object.keys(m.ofertas || {}).map(Number).filter(id => S.civ(m, id) && S.enGuerra(c, S.civ(m, id)) && m.turno - m.ofertas[id] <= 15).map(id => S.civ(m, id).nombre);
    if (ofertas.length) l.push(fila('Te ofrecen paz', '<span class="rojo">' + esc(ofertas.join(', ')) + '</span>'));
    const cq = (p.cuadrillas || []).map(g => esc(g.texto) + ' <span class="tenue">' + (g.hasta ? esc(X.queda(m, c, g.hasta, VELOCIDADES[vel][0])) : 'hasta nueva orden') + '</span>');
    if (cq.length) l.push(fila('Cuadrillas', cq.join('<br>')));
    const cupos = Object.keys(p.cupos || {}).map(k => p.cupos[k].n + ' ' + X.OFICIOS_N[k] + (p.cupos[k].hasta ? ' <span class="tenue">' + esc(X.queda(m, c, p.cupos[k].hasta, VELOCIDADES[vel][0])) + '</span>' : ''));
    if (cupos.length) l.push(fila('Cupos', cupos.join(', ')));
    const n = X.cuentaOficios(m, c);
    l.push(fila('Oficios', n.map((k, i) => k + ' ' + X.OFICIOS_N[i]).join(', ')));
    return '<div class="plan"><p class="plan-titulo">Prioridades <span class="tenue">· tu pueblo se gobierna solo; cámbialas escribiendo («más madera», «menos ejército», «todo a la ciencia»)</span></p><div class="prios">' + barras + '</div>' + (l.length ? '<dl>' + l.join('') + '</dl>' : '') + '</div>';
  }

  const NOMBRES_OFICIO = { lenador: 'leñadores', granjero: 'granjeros', constructor: 'constructores', minero: 'mineros', guerrero: 'guerreros', comerciante: 'comerciantes' };
  // Lo que piensa este pueblo de los demás, de mejor a peor, con el motivo que más pesa.
  function opiniones(c) {
    const palabra = r => (r > 40 ? 'amistad' : r > 15 ? 'cordial' : r > -15 ? 'neutral' : r > -45 ? 'tensa' : 'hostil');
    const otros = S.vivas(m).filter(o => o.id !== c.id).sort((a, b) => (c.rel[b.id] || 0) - (c.rel[a.id] || 0));
    return otros.slice(0, 6).map(o => {
      const r = Math.round(c.rel[o.id] || 0), mot = S.motivos(m, c, o).slice().sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
      return '<span class="' + (r <= -45 || S.enGuerra(c, o) ? 'rojo' : '') + '">' + esc(o.nombre) + '</span> <span class="tenue">' + (S.enGuerra(c, o) ? 'en guerra' : palabra(r) + ' ' + (r > 0 ? '+' : '') + r) + (mot ? ' (' + esc(mot[0]) + ')' : '') + '</span>';
    }).join('<br>') || '<span class="tenue">no conoce a nadie</span>';
  }
  // Los complots en marcha que tocan a este pueblo, con su progreso.
  function complotsDe(c) {
    const l = (m.complots || []).filter(p => p.de === c.id || p.contra === c.id);
    return l.map(p => {
      const a = S.civ(m, p.de), b = S.civ(m, p.contra);
      const texto = p.tipo === 'guerra' ? (p.de === c.id ? 'trama una guerra contra ' + b.nombre : a.nombre + ' trama una guerra contra él') : 'negocia una alianza con ' + (p.de === c.id ? b.nombre : a.nombre);
      const porque = p.motivo ? ' <span class="tenue">(' + esc(p.motivo) + ')</span>' : '';
      return '<span class="' + (p.tipo === 'guerra' ? 'rojo' : '') + '">' + esc(texto) + '</span> <span class="barra"><span style="width:' + Math.min(100, Math.round(p.progreso)) + '%"></span></span> <span class="tenue">' + Math.min(100, Math.round(p.progreso)) + '%</span>' + porque;
    }).join('<br>');
  }
  // La banca del reino: el fondo, el interés (con botones si es tu pueblo), los empresarios y las deudas.
  function bancaDe(c) {
    const mio = tuPueblo() === c, l = [], mercs = M.vida.mercaderesDe(m, c), boton = (orden, texto, activo) => '<button type="button" class="mando sutil mercado-orden' + (activo ? ' activa' : '') + '" data-orden="' + orden + '">' + texto + '</button>';
    // Los gremios de mercaderes (desde la Edad Media).
    if (c.era >= 4) {
      const enGremio = id => m.vida.aldeanos.filter(x => x.gremio === id && x.o === 5 && x.c === c.id).length;
      // Por casas comerciales: cada familia con su gremio principal y sus sucursales.
      const casas = mercs.filter(a => a.merc.de == null).map(a => { const suc = mercs.filter(x => x.merc.de === a.id); return { a, suc, gente: enGremio(a.id) + suc.reduce((k, x) => k + enGremio(x.id), 0) }; });
      l.push(casas.length ? '🏪 ' + casas.map(({ a, suc, gente }) => 'Casa ' + esc(a.familia || a.nombre) + ' <span class="tenue">(' + esc(a.nombre) + (suc.length ? ', ' + suc.length + (suc.length > 1 ? ' sucursales' : ' sucursal') : '') + ', ' + gente + ' comerciantes, caja ' + Math.round(a.merc.caja) + (a.merc.casona != null ? ', con ' + (c.era >= 6 ? 'mansión' : c.era >= 5 ? 'palacete' : 'casona') : '') + (a.merc.muelle != null ? ', con muelle y barco' : '') + ')</span>').join(', ') : '<span class="tenue">Sin gremios aún: el comerciante que junte lo bastante fundará uno.</span>');
    }
    if (c.bancos > 0 && c.banca) {
      const b = c.banca, n = M.vida.nivelInteres(c), bancos = M.vida.banquerosDe(m, c), emp = M.vida.empresariosDe(m, c).filter(a => a.emp.neg !== 'banco');
      l.push('🏛 Banco central: <b>' + Math.round(b.fondo) + '</b> de oro <span class="tenue">· prestado ' + Math.round(b.prestado) + ', devuelto ' + Math.round(b.devuelto) + (b.quiebras ? ', ' + b.quiebras + (b.quiebras === 1 ? ' quiebra' : ' quiebras') : '') + '</span>' + (mio ? ' ' + boton('pasad 20 de oro al banco central', '+20') + ' ' + boton('sacad 20 de oro del banco central al tesoro', '−20') : ''));
      l.push('Interés <b>' + (n === 0.5 ? 'bajo' : n === 1.5 ? 'alto' : 'normal') + '</b>' + (mio ? ' ' + [[0.5, 'bajad los intereses', 'Bajo'], [1, 'intereses normales', 'Normal'], [1.5, 'subid los intereses', 'Alto']].map(([k, o, t]) => boton(o, t, k === n)).join(' ') : ''));
      l.push(bancos.length ? '🏦 ' + bancos.map(a => 'Banco ' + esc(a.nombre + ' ' + (a.familia || '')) + ' <span class="tenue">(' + Math.round(a.emp.capital) + ' de capital' + (a.emp.deuda > 0 ? ', debe al central ' + Math.round(a.emp.deuda) : '') + ')</span>').join(', ') : '<span class="tenue">Sin banqueros aún: el mercader más rico abrirá un banco cuando tenga fortuna.</span>');
      if (emp.length) l.push('🎩 ' + emp.map(a => esc(a.nombre + ' ' + (a.familia || '')) + ' <span class="tenue">(' + (a.emp.neg === 'fabrica' ? 'fábrica' : 'mercader') + (a.emp.deuda > 0 ? ', debe ' + Math.round(a.emp.deuda) : ', pagado') + ')</span>').join(', '));
    } else l.push('<span class="tenue">' + (c.era >= 5 ? 'Sin banco: hace falta una villa o ciudad (lo construyen solos o «construid un banco»).' : 'El banco llega con el Renacimiento; mientras, los comerciantes ahorran' + (c.era >= 4 ? ' y los mercaderes hacen sus gremios.' : ' (los gremios llegan con la Edad Media).')) + '</span>');
    const nombreC = id => esc((S.civ(m, id) || { nombre: '?' }).nombre);
    for (const cr of (m.creditos || []).filter(x => x.de === c.id)) l.push('Os debe ' + nombreC(cr.a) + ': ' + Math.round(cr.resta) + (mio ? ' ' + boton('perdonad la deuda de ' + nombreC(cr.a), 'Perdonar') : ''));
    for (const cr of (m.creditos || []).filter(x => x.a === c.id)) l.push('Debe a ' + nombreC(cr.de) + ': ' + Math.round(cr.resta) + ' <span class="tenue">(' + cr.cuota + ' cada dos turnos)</span>');
    return l.join('<br>');
  }
  function comercioDe(c) {
    const rutas = (m.vida.rutas || []).filter(r => r.tipo !== 'calle' && (r.a === c.id || r.b === c.id));
    if (!rutas.length) return '<span class="tenue">sin rutas todavía (llegan con las ciudades y con los vecinos amigos)</span>';
    const fuera = rutas.filter(r => r.tipo === 'externa').map(r => (S.civ(m, r.a === c.id ? r.b : r.a) || {}).nombre).filter(Boolean);
    const hecho = Math.round(100 * rutas.reduce((k, r) => k + r.tiles.filter(t => m.vida.camino[t]).length, 0) / Math.max(1, rutas.reduce((k, r) => k + r.tiles.length, 0)));
    return rutas.length + ' ruta' + (rutas.length > 1 ? 's' : '') + (fuera.length ? ' (con ' + esc(fuera.join(', ')) + ')' : ' internas') + ' <span class="tenue">· ' + (c.comerciantes || 0) + ' comerciantes con carreta · caminos al ' + hecho + '%</span>';
  }
  // Las ciudades con su lealtad (y su peor motivo); las que conspiran, en rojo con el progreso del complot.
  // La ficha de un aldeano: es un agente con su vida propia.
  const OFICIO1 = { lenador: 'leñador', granjero: 'granjero', constructor: 'constructor', minero: 'minero', guerrero: 'guerrero', comerciante: 'comerciante' };
  // ---------- La ficha de un edificio (y la de una ciudad, si es su ayuntamiento o su campamento) ----------
  const NOMBRE_TIPO = o => { const O = M.vida.OBRA; return ({ [O.casa]: 'casa', [O.molino]: 'molino', [O.templo]: 'templo', [O.saber]: 'casa del saber', [O.torre]: 'torre', [O.cuartel]: 'cuartel', [O.arqueria]: 'arquería', [O.castillo]: 'castillo', [O.puerto]: 'puerto', [O.pozo]: 'pozo', [O.granero]: 'granero', [O.fuente]: 'plaza pública', [O.parque]: 'parque', [O.palacio]: 'palacio', [O.central]: 'central eléctrica', [O.banco]: 'banco central', [O.bancopriv]: 'banco', [O.muelle]: 'muelle', [O.gremio]: 'gremio', [O.casona]: 'casona', [O.fabrica]: 'fábrica', [O.estacion]: 'estación de tren', [O.hospital]: 'hospital', [O.aerodromo]: 'aeródromo', [O.campamento]: 'campamento', [O.aduana]: 'puesto fronterizo', [O.petroleo]: 'pozo de petróleo', [O.mina]: 'mina', [O.ayuntamiento]: 'ayuntamiento', [O.centro]: 'plaza mayor', [O.ruina]: 'ruinas' })[o] || 'edificio'; };
  const hace = anio => { const d = Math.max(0, Math.round(m.anio - anio)); return d === 0 ? 'este año' : d === 1 ? 'hace 1 año' : 'hace ' + d.toLocaleString('es-ES') + ' años'; };
  const anioTxt = a => S.anioTexto(a).replace(/(\d)\.$/, '$1');
  const esNinoV = a => (a.edad || 0) < 2;
  function fichaEdificio(f) {
    const v = m.vida, t = edificioSel, o = v.obra[t], an = v.andamios && v.andamios[t], rec = v.edificios && v.edificios[t];
    if (!o && !an) { edificioSel = null; return false; }
    const r = M.vida.region(m, t), c = S.civ(m, m.dueno[r]);
    const ciudad = (m.ciudades || []).find(x => x.region === r && (o === M.vida.OBRA.ayuntamiento || o === M.vida.OBRA.campamento || (an && an.o === M.vida.OBRA.ayuntamiento)));
    if (ciudad) return fichaCiudad(f, ciudad, c, rec);
    const vecinos = o === M.vida.OBRA.casa ? v.aldeanos.filter(a => a.casa === t) : [];
    const obreros = an && v.obreros && v.obreros[t] ? v.obreros[t].map(id => v.aldeanos.find(a => a.id === id)).filter(Boolean) : [];
    // Una casa se llama por la familia que vive en ella (la más numerosa), no por quien la construyó.
    const famDe = () => { const k = {}; for (const a of vecinos) if (a.familia) k[a.familia] = (k[a.familia] || 0) + 1 + (esNinoV(a) ? 0 : 0.5); const top = Object.keys(k).sort((x, y) => k[y] - k[x] || (x < y ? -1 : 1))[0]; return top; };
    const familiaCasa = vecinos.length ? famDe() : null;
    const titulo = familiaCasa ? 'Casa de los ' + familiaCasa : rec ? rec.nombre : an ? NOMBRE_TIPO(an.o).charAt(0).toUpperCase() + NOMBRE_TIPO(an.o).slice(1) + ' en obras' : NOMBRE_TIPO(o).charAt(0).toUpperCase() + NOMBRE_TIPO(o).slice(1);
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(titulo) + '</h3><p class="subt">' + esc(NOMBRE_TIPO(an ? an.o : o)) + (c ? ' de ' + esc(c.nombre) : '') + ' · en ' + esc(M.vida.lugarDe ? M.vida.lugarDe(m, t) : '') + '</p><dl>' +
      (an ? fila('Obras', '<span class="barra"><span style="width:' + Math.round(100 * (1 - Math.max(0, an.falta) / an.total)) + '%"></span></span> ' + Math.round(100 * (1 - Math.max(0, an.falta) / an.total)) + ' %') + (obreros.length ? fila('Trabajan', esc(obreros.map(a => a.nombre + ' ' + (a.familia || '')).join(', '))) : '') : '') +
      (rec ? fila('Construido', esc(anioTxt(rec.anio)) + ' <span class="tenue">(' + hace(rec.anio) + ')</span>') + (rec.por && rec.por.length ? fila('Lo levantó', esc(rec.por.join(', '))) : '') + fila('Estilo', 'de ' + esc(M.ERAS[rec.era].con) + (c && M.vida.fase(rec.era) < M.vida.fase(c.era) ? ' <span class="tenue">(antiguo: lo reformarán)</span>' : '')) : (!an ? fila('Construido', '<span class="tenue">antes de que nadie lo apuntara</span>') : '')) +
      (o === M.vida.OBRA.mina ? fila('Da', 'piedra, metal (desde el Bronce), carbón (desde la industria) y algo de oro; más despacio que las vetas sueltas, pero nunca se agota') + fila('Mineros dentro', v.aldeanos.filter(x => x.enMina && x.tx === t % v.tw && x.ty === (t / v.tw | 0)).length) : '') +
      (o === M.vida.OBRA.petroleo ? fila('Da', '1,2 de petróleo por turno, sin que nadie lo cargue') + fila('Petróleo de ' + esc(c ? c.nombre : '—'), c ? Math.round(c.petroleo || 0) + ' en el almacén' : '—') : '') +
      ([M.vida.OBRA.fabrica, M.vida.OBRA.estacion, M.vida.OBRA.central].includes(o) && c && c.era >= 6 ? (() => { const k = o === M.vida.OBRA.fabrica ? 'fabrica' : o === M.vida.OBRA.estacion ? 'tren' : 'central'; return fila('Combustible', (M.vida.enMarcha(c, k) ? '⛽ en marcha' : '<b class="rojo">⛔ parada: no hay ' + (k === 'central' ? 'carbón ni petróleo' : 'carbón') + '</b>') + ' <span class="tenue">· gasta ' + String(M.vida.GASTO[k]).replace('.', ',') + ' de carbón por turno</span>'); })() : '') +
      (o === M.vida.OBRA.aduana ? (() => {
        const ad = (v.aduanas || {})[t] || { controles: 0, arancel: 0 }, guardias = v.aldeanos.filter(a => a.guardiaEn === t && a.c === (c && c.id));
        return fila('Control', ad.controles + ' carretas revisadas · ' + ad.arancel + ' de oro en aranceles') + fila('Guardias', guardias.length ? esc(guardias.map(a => a.nombre + ' ' + (a.familia || '')).join(', ')) : '<span class="tenue">nadie de guardia ahora</span>') + fila('En guerra', 'la barrera se cierra y sus guardias disparan a los enemigos que se acerquen');
      })() : '') +
      (vecinos.length ? fila('Viven aquí', vecinos.map(a => '<button type="button" class="enlace ver-aldeano" data-id="' + a.id + '">' + esc(a.nombre + ' ' + (a.familia || '')) + '</button> <span class="tenue">(' + M.vida.anos(a) + ')</span>').join(', ')) : o === M.vida.OBRA.casa ? fila('Viven aquí', '<span class="tenue">nadie ahora mismo</span>') : '') +
      (rec && rec.historia && rec.historia.length ? fila('Historia', rec.historia.slice(-6).map(h => esc(anioTxt(h.anio)) + ': ' + esc(h.texto)).join('<br>')) : '') +
      '</dl><div class="linea" style="margin-top:10px"><button type="button" class="mando sutil" id="volver-pueblo">Ver su pueblo</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelectorAll('.ver-aldeano').forEach(b => b.addEventListener('click', () => { edificioSel = null; aldeanoSel = +b.dataset.id; P.elegirAldeano(aldeanoSel); pintarFicha(); }));
    f.querySelector('#volver-pueblo').addEventListener('click', () => { edificioSel = null; if (c) elegir(c.id, true); });
    return true;
  }
  function fichaCiudad(f, x, c, rec) {
    const v = m.vida, vecinos = v.aldeanos.filter(a => a.c === x.civ && a.h === x.region);
    const zona = [x.region, ...S.vecinos(x.region)].filter(r => m.dueno[r] === x.civ);
    const edificios = Object.entries(v.edificios || {}).filter(([t, e]) => zona.includes(M.vida.region(m, +t)) && !e.ruina && e.tipo !== M.vida.OBRA.casa && v.obra[+t] === e.tipo).map(([, e]) => e.nombre);
    const casas = zona.flatMap(r => M.vida.parcelas(m, r)).filter(t => v.obra[t] === M.vida.OBRA.casa).length;
    const FASE = { campamento: '⛺ campamento de colonos', obras: '🏗 levantando su ayuntamiento', aldea: '🏘 aldea' };
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(x.nombre) + '</h3><p class="subt">' + esc(FASE[x.fase] || 'ciudad') + (c ? ' de ' + esc(c.nombre) : '') + '</p><dl>' +
      fila('Fundada', x.fundada != null ? esc(anioTxt(x.fundada)) + ' <span class="tenue">(' + hace(x.fundada) + ')</span>' : '<span class="tenue">hace mucho</span>') +
      (x.fundadores && x.fundadores.length ? fila('La fundaron', esc(x.fundadores.join(', ')) + (x.madre ? ' <span class="tenue">· colonos de ' + esc(x.madre) + '</span>' : '')) : x.madre ? fila('Hija de', esc(x.madre)) : '') +
      fila('Vecinos', vecinos.length + ' <span class="tenue">· ' + casas + ' casas</span>') +
      (x.fase === 'campamento' ? fila('Para ser aldea', 'necesita 6 vecinos (' + vecinos.length + ') y 2 casas (' + (x.casasCerca || 0) + '); entonces levantará su ayuntamiento') : '') +
      fila('Alcalde', esc(x.alcalde || '—') + (x.rasgo ? ' <span class="tenue">(' + esc(x.rasgo) + ')</span>' : '')) +
      (x.lealtad != null ? fila('Lealtad', Math.round(x.lealtad)) : '') +
      (edificios.length ? fila('Edificios', esc(edificios.slice(0, 8).join(' · '))) : '') +
      (x.historia && x.historia.length ? fila('Historia', x.historia.slice(-6).map(h => esc(anioTxt(h.anio)) + ': ' + esc(h.texto)).join('<br>')) : '') +
      '</dl><div class="linea" style="margin-top:10px"><button type="button" class="mando sutil" id="volver-pueblo">Ver su reino</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelector('#volver-pueblo').addEventListener('click', () => { edificioSel = null; if (c) elegir(c.id, true); });
    return true;
  }
  function fichaAldeano(f) {
    const a = m.vida.aldeanos.find(x => x.id === aldeanoSel);
    if (!a) {
      f.innerHTML = '<p class="vacio">Ese aldeano ha muerto. Toca a otro en el mapa, o un pueblo para ver cómo vive.</p>';
      aldeanoSel = null; P.elegirAldeano(null); if (P.siguiendoA() != null) P.seguir(null);
      return true;
    }
    const c = S.civ(m, a.c), ciudad = (m.ciudades || []).find(x => x.region === a.h);
    const padre = a.padre != null ? m.vida.aldeanos.find(x => x.id === a.padre) : null;
    const hijosVivos = m.vida.aldeanos.filter(x => x.padre === a.id || x.madre === a.id).length;
    const etapa = (a.edad || 0) < M.vida.ADULTO ? 'niño' : (a.edad || 0) >= M.vida.VIEJO ? 'anciano' : 'adulto';
    const oficio = (a.edad || 0) < M.vida.ADULTO ? 'juega cerca de casa' : a.colono != null ? 'colono, de camino a tierras nuevas' : (M.vida.OFICIOS[a.o] === 'erudito' ? M.ERUDITO((S.civ(m, a.c) || { era: 0 }).era).uno + (a.estudios ? ' · ' + a.estudios + ' jornadas de estudio' : '') : OFICIO1[M.vida.OFICIOS[a.o]]) + (M.vida.OFICIOS[a.o] === 'guerrero' ? (a.tirador ? ' tirador' : ' de cuerpo a cuerpo') : '');
    const siguiendo = P.siguiendoA() === a.id;
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(a.nombre + ' ' + (a.familia || '')) + '</h3>' +
      '<p class="subt">' + esc(etapa) + ' de ' + esc(c ? c.nombre : '—') + (ciudad ? ', vive en ' + esc(ciudad.nombre) : c && a.h === c.capital ? ', vive en la capital' : '') + '</p>' +
      '<dl>' + fila('Oficio', esc(oficio)) + (a.merc && a.merc.de != null ? fila('Gremio', '🏪 Lleva una sucursal de la casa ' + esc(a.familia || '') + ' <span class="tenue">· manda lo que gana a ' + esc(((m.vida.aldeanos.find(x => x.id === a.merc.de) || {}).nombre) || 'su familia') + ', ' + m.vida.aldeanos.filter(x => x.gremio === a.id && x.o === 5).length + ' comerciantes</span>') : a.merc ? fila('Gremio', '🏪 Mercader con su gremio <span class="tenue">· caja ' + Math.round(a.merc.caja) + ', ' + m.vida.aldeanos.filter(x => x.gremio === a.id && x.o === 5).length + ' comerciantes' + (a.merc.casona != null ? ', vive en su ' + (c.era >= 6 ? 'mansión' : c.era >= 5 ? 'palacete' : 'casona') : '') + '</span>') : a.gremio != null && a.o === 5 ? fila('Gremio', 'trabaja para el gremio de ' + esc(((m.vida.aldeanos.find(x => x.id === a.gremio) || {}).familia) || '?') + ' <span class="tenue">(cobra un sueldo)</span>') : '') + (a.emp ? fila('Negocio', a.emp.neg === 'banco' ? '🏦 Banquero <span class="tenue">· ' + Math.round(a.emp.capital) + ' de capital' + (a.emp.deuda > 0 ? ', debe al banco central ' + Math.round(a.emp.deuda) : '') + '</span>' : '🎩 ' + (a.emp.neg === 'fabrica' ? 'Dueño de una fábrica' : 'Mercader') + ' <span class="tenue">· ' + (a.emp.deuda > 0 ? 'debe ' + Math.round(a.emp.deuda) + (a.emp.banquero != null ? ' a su banquero' : ' al banco central') : 'sin deudas') + ', caja ' + Math.round(a.emp.caja || 0) + '</span>') : '') + ((a.dinero || 0) >= 1 ? fila('Ahorros', Math.round(a.dinero) + ' de oro') : '') + fila('Edad', M.vida.anos(a) + ' años <span class="tenue">(nació en ' + M.ERAS[a.eraNacio != null ? a.eraNacio : c.era].con + ')</span>') +
      fila('Vida', vidaAldeano(a)) + fila('Lleva', equipoAldeano(a)) +
      fila('Rasgos', a.rasgos && a.rasgos.length ? esc(a.rasgos.join(', ')) : '<span class="tenue">ninguno especial</span>') +
      fila('Padres', (() => {
        // Padre y madre (con enlace si viven); si murieron, su nombre queda en la ficha.
        const vivo = id => id != null ? m.vida.aldeanos.find(x => x.id === id) : null, l = [];
        const ps = a.padres || (padre ? [padre.nombre + ' ' + (padre.familia || ''), null] : null);
        if (!ps) return '<span class="tenue">llegó de fuera (de los primeros pobladores)</span>';
        const dif = m.vida.difuntos || {};
        [[a.padre, ps[0]], [a.madre, ps[1]]].forEach(([id, nom]) => { if (!nom) return; const p = vivo(id), d = id != null ? dif[id] : null; l.push(p ? '<button type="button" class="enlace ver-aldeano" data-id="' + p.id + '">' + esc(nom) + '</button> <span class="tenue">(' + M.vida.anos(p) + ')</span>' : esc(nom) + ' <span class="tenue">(†' + (d ? ' a los ' + d.anos + ', de ' + esc(d.causa) : '') + ')</span>'); });
        return l.join(' y ');
      })()) +
      (a.parejaNombre ? fila('Pareja', (() => { const p = m.vida.aldeanos.find(x => x.id === a.pareja); return p ? '<button type="button" class="enlace ver-aldeano" data-id="' + p.id + '">' + esc(a.parejaNombre) + '</button>' : esc(a.parejaNombre) + ' <span class="tenue">(†)</span>'; })()) : '') +
      fila('Hijos', (a.hijos || 0) + (hijosVivos !== (a.hijos || 0) ? ' <span class="tenue">(' + hijosVivos + ' vivos)</span>' : '') + (() => { const hs = m.vida.aldeanos.filter(x => x.padre === a.id || x.madre === a.id).slice(0, 5); return hs.length ? ': ' + hs.map(h => '<button type="button" class="enlace ver-aldeano" data-id="' + h.id + '">' + esc(h.nombre) + '</button>').join(', ') : ''; })()) +
      (() => { const her = a.padre != null ? m.vida.aldeanos.filter(x => x !== a && x.padre === a.padre).length : 0; return her ? fila('Hermanos', her) : ''; })() +
      fila('Nació', (a.nacioEn ? 'en ' + esc(a.nacioEn) + ', ' : '') + (m.libre ? 'el año ' + (a.nacio != null ? a.nacio : m.anio) : esc(anioTxt(a.nacio != null ? a.nacio : m.anio)))) +
      (a.casa != null && m.vida.edificios && m.vida.edificios[a.casa] ? fila('Vive en', '<button type="button" class="enlace ver-edificio" data-t="' + a.casa + '">' + esc(m.vida.edificios[a.casa].nombre) + '</button>') : '') +
      (a.bajas ? fila('En combate', a.bajas + ' enemigos abatidos') : '') +
      fila('Hambre', a.hambre ? '<span class="rojo">' + a.hambre + ' turnos sin comer bien</span>' : 'bien alimentado') +
      (M.vida.pausada(m) && M.vida.riesgoAnual ? (() => {
        // La salud: lo que le acerca o le aleja de la muerte, y la probabilidad de no llegar al año que viene.
        const r = M.vida.riesgoAnual(m, a, c), pct = r.p * 100, f = r.salud.f;
        const estado = f <= 0.85 ? '💚 buena' : f <= 1.25 ? '💛 normal' : f <= 1.8 ? '🧡 delicada' : '❤️‍🩹 mala';
        const motivos = r.salud.motivos.sort((x, y) => Math.abs(Math.log(y[0])) - Math.abs(Math.log(x[0]))).slice(0, 4).map(([k, t]) => '<span class="' + (k > 1 ? 'rojo' : 'verde') + '">' + (k > 1 ? '▲ ' : '▼ ') + esc(t) + '</span>').join(' · ');
        return fila('Salud', estado + ' <span class="tenue">· riesgo de morir este año: ' + (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + ' %</span>' + (motivos ? '<br>' + motivos : ''));
      })() : '') +
      (M.vida.pausada(m) ? fila('Ánimo', (() => { const k = M.vida.animoDe(m, a); return (k >= 75 ? '😊 contento' : k >= 50 ? '🙂 tranquilo' : k >= 30 ? '😟 preocupado' : '😠 harto') + ' <span class="tenue">(' + k + ')</span>'; })()) + fila('Ahora', a.dormir ? (a.enCasa ? 'duerme en casa 💤' : 'vuelve a casa a dormir') : a.paseo === 2 ? 'descansa en la plaza o el parque' : esc(OFICIO1[M.vida.OFICIOS[a.o]] || 'trabaja')) : '') + '</dl>' +
      (c && c.jugador && (a.edad || 0) >= M.vida.ADULTO && a.colono == null ? '<div class="tec-era">Mándale un oficio</div><div class="linea aldeano-oficios">' + M.vida.OFICIOS.map((o, k) => '<button type="button" class="mando sutil oficio-a' + (a.o === k ? ' activa' : '') + '" data-k="' + k + '">' + esc(o === 'erudito' ? M.ERUDITO(c.era).uno : OFICIO1[o] || o) + '</button>').join('') + (a.fijo ? ' <button type="button" class="mando sutil oficio-libre" title="Que vuelva a hacer lo que el pueblo necesite">Que decida el pueblo</button>' : '') + '</div>' + (a.fijo && a.fijo.g === 'mano' ? '<p class="tenue arbol-ayuda">Hace lo que le mandaste y nadie se lo cambia.</p>' : '') : '') +
      '<div class="linea" style="margin-top:10px"><button type="button" class="mando" id="seguir">' + (siguiendo ? 'Dejar de seguir' : 'Seguir con la cámara') + '</button> <button type="button" class="mando sutil" id="volver-pueblo">Ver su pueblo</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelector('#seguir').addEventListener('click', () => { P.seguir(siguiendo ? null : a.id); pintarFicha(); });
    f.querySelectorAll('.ver-aldeano').forEach(b => b.addEventListener('click', () => { aldeanoSel = +b.dataset.id; P.elegirAldeano(aldeanoSel); pintarFicha(); }));
    f.querySelectorAll('.ver-edificio').forEach(b => b.addEventListener('click', () => { aldeanoSel = null; P.elegirAldeano(null); edificioSel = +b.dataset.t; pintarFicha(); }));
    f.querySelectorAll('.oficio-a').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.k; if (enLinea()) { encolar({ tipo: 'oficio', civ: a.c, id: a.id, k }); responder('📡 Cambio de oficio enviado: se cumple al empezar el próximo turno.', 'bien'); } else { a.fijo = { g: 'mano', vuelve: a.o }; M.vida.mover(a, k); } pintarFicha(); }));
    const libre = f.querySelector('.oficio-libre');
    if (libre) libre.addEventListener('click', () => { delete a.fijo; a.e = 0; pintarFicha(); });
    f.querySelector('#volver-pueblo').addEventListener('click', () => { aldeanoSel = null; P.elegirAldeano(null); P.seguir(null); elegir(a.c, true); });
    return true;
  }
  function ciudadesDe(c) {
    const l = (m.ciudades || []).filter(x => x.civ === c.id);
    return l.map(x => {
      const peor = (x.motivos || []).filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0];
      const lealtad = x.lealtad != null ? Math.round(x.lealtad) : null;
      return '<span class="' + (lealtad != null && lealtad < 0 ? 'rojo' : '') + '">' + esc(x.nombre) + '</span> <span class="tenue">alcalde ' + esc(x.alcalde) + (x.rasgo ? ' (' + esc(x.rasgo) + ')' : '') +
        (lealtad != null ? ' · lealtad ' + lealtad + (peor ? ', ' + esc(peor[0]) : '') : '') + (x.complot != null ? ' · <b class="rojo">conspira ' + Math.min(100, Math.round(x.complot)) + '%</b>' : '') + '</span>';
    }).join('<br>');
  }
  function vidaAldeano(a) {
    const max = M.vida.vidaMax(a), pv = a.pv == null ? max : Math.max(0, Math.round(a.pv)), fr = pv / max;
    return '<span class="barra"><span style="width:' + Math.round(fr * 100) + '%;background:' + (fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030') + '"></span></span> ' + pv + ' / ' + max + (pv < max ? ' <span class="tenue">(herido; se cura poco a poco)</span>' : '');
  }
  function equipoAldeano(a) {
    const V = M.vida, arma = V.armaDe(a, false), arm = V.ARMADURAS[a.armadura || 0] || V.ARMADURAS[0];
    const lejos = a.o === 4 && a.tirador ? V.armaDe(a, true) : null;
    return esc(arma.nombre) + ' <span class="tenue">(' + arma.dano + ' de daño' + (arma.material ? ', ' + esc(arma.material) : '') + (arma.perfora ? ', atraviesa armaduras' : '') + (arma.bloqueo ? ', el escudo para golpes' : '') + ')</span>' +
      (lejos ? ' · ' + esc(lejos.nombre) + ' <span class="tenue">(' + lejos.dano + ' de lejos)</span>' : '') +
      ' · ' + esc(arm.nombre) + (arm.reduce ? ' <span class="tenue">(−' + Math.round(arm.reduce * 100) + ' % de daño, ' + esc(arm.material) + ')</span>' : '');
  }
  function ganado(c) {
    const reses = m.vida.animales.filter(b => b.c === c.id), ovejas = reses.filter(b => b.tipo === 'oveja').length, vacas = reses.length - ovejas;
    const pastores = m.vida.aldeanos.filter(a => a.c === c.id && a.pastor != null).length, cazan = m.vida.aldeanos.filter(a => a.c === c.id && a.caza != null).length;
    if (!reses.length) return 'ninguno <span class="tenue">(hacen falta pastos libres)</span>';
    return ovejas + (ovejas === 1 ? ' oveja' : ' ovejas') + (vacas ? ', ' + vacas + (vacas === 1 ? ' vaca' : ' vacas') : '') + ' <span class="tenue">· leche, lana y carne' + (pastores ? ' · ' + pastores + ' granjeros con el rebaño' : '') + (cazan ? ' · ' + cazan + ' cazando o pescando' : '') + '</span>';
  }
  function aldeanos(c) {
    const cuenta = Object.create(null);
    for (const a of m.vida.aldeanos) if (a.c === c.id) { const o = M.vida.OFICIOS[a.o]; cuenta[o] = (cuenta[o] || 0) + 1; }
    const partes = M.vida.OFICIOS.filter(o => cuenta[o]).map(o => cuenta[o] + ' ' + (o === 'erudito' ? (cuenta[o] === 1 ? M.ERUDITO(c.era).uno : M.ERUDITO(c.era).varios) : NOMBRES_OFICIO[o]));
    const suyos = m.vida.aldeanos.filter(a => a.c === c.id), ninos = suyos.filter(a => (a.edad || 0) < M.vida.ADULTO).length, viejos = suyos.filter(a => (a.edad || 0) >= M.vida.VIEJO).length;
    const colonos = suyos.filter(a => a.colono != null).length;
    return (partes.length ? esc(partes.join(', ')) : 'ninguno') + ' <span class="tenue">· ' + ninos + ' niños, ' + viejos + ' ancianos · ' + (c.camas || 0) + ' camas' + (c.sinCama ? ' (faltan ' + c.sinCama + ')' : '') + (colonos ? ' · ' + colonos + ' colonos de camino' : '') + '</span>';
  }

  // La crónica: lo que pasa, y al tocarlo, por qué pasó, qué precedente tiene y dónde (la cámara va a mirar).
  const GRANDES = new Set(['guerra', 'paz', 'conquista', 'caida', 'revuelta', 'plaga', 'hambruna', 'sequia', 'alianza', 'nuevo_pueblo', 'fundacion', 'cronista']);
  let filtroCronica = 'todo', cuantosCronica = 20;
  const abiertos = new Set();
  function pintarCronica() {
    const ol = $('cronica');
    ol.innerHTML = '';
    const mio = tuPueblo();
    const botonMio = document.querySelector('#filtro-cronica [data-f="mio"]');
    if (botonMio) botonMio.hidden = !mio;
    if (filtroCronica === 'mio' && !mio) filtroCronica = 'todo';
    const lista = m.cronica.filter(e => filtroCronica === 'todo' ? true : filtroCronica === 'mio' ? e.civ === mio.id || e.divino : e.importante || e.divino || GRANDES.has(e.tipo) || e.tipo.startsWith('era'));
    if (!lista.length) { const li = document.createElement('li'); li.className = 'suceso vacio'; li.textContent = 'Nada todavía.'; ol.appendChild(li); }
    for (const e of lista.slice(0, cuantosCronica)) {
      const li = document.createElement('li');
      const clave = e.turno + ':' + e.titulo;
      li.className = 'suceso' + (e.divino ? ' divino' : '') + (e.importante ? ' importante' : '') + (e.tipo === 'cronista' ? ' cronista' : '') + (abiertos.has(clave) ? ' abierto' : '') + (e.porque || e.casilla != null ? ' tocable' : '') + (e.porque ? ' con-porque' : '');
      li.tabIndex = 0;
      const abrir = () => {
        if (abiertos.has(clave)) abiertos.delete(clave); else abiertos.add(clave);
        li.classList.toggle('abierto');
        if (e.casilla != null && li.classList.contains('abierto')) P.centrarEn(e.casilla, 2.5);
      };
      li.addEventListener('click', abrir);
      li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } });
      li.innerHTML = '<div class="s-cab"><span class="s-anio"></span><span class="s-punto"></span><h4 class="s-titulo"></h4></div><p class="s-texto"></p>';
      li.querySelector('.s-anio').textContent = S.anioTexto(e.anio);
      li.querySelector('.s-punto').style.background = e.color || 'transparent';
      li.querySelector('.s-titulo').textContent = e.titulo;
      li.querySelector('.s-texto').textContent = e.texto;
      if (e.porque) { const p = document.createElement('p'); p.className = 's-porque'; p.innerHTML = '<b>Por qué</b> '; p.appendChild(document.createTextNode(e.porque)); li.appendChild(p); }
      if (e.precedente) { const p = document.createElement('p'); p.className = 's-precedente'; p.innerHTML = '<b>Ya pasó</b> '; p.appendChild(document.createTextNode(e.precedente)); li.appendChild(p); }
      ol.appendChild(li);
    }
    if (lista.length > cuantosCronica && cuantosCronica < 150) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'mando sutil'; b.textContent = 'Ver más sucesos (' + (Math.min(150, lista.length) - cuantosCronica) + ')';
      b.addEventListener('click', () => { cuantosCronica += 30; pintarCronica(); });
      li.className = 'suceso mas'; li.appendChild(b); ol.appendChild(li);
    }
  }

  function pintarEjemplos() {
    const vecino = tuPueblo() && (S.vecinosDe(m, tuPueblo())[0] || S.vivas(m).find(o => o.id !== m.jugador));
    const ej = tuPueblo()
      ? ['Háganme 5 casas', 'Formad un escuadrón de 10 para guardar la capital', 'Esperad el ataque', '¡Al ataque!', 'Hagan defensas', vecino ? 'Espiad a ' + vecino.nombre : 'Espiad al vecino', 'Haced una fiesta', '5 granjeros a talar durante 2 minutos', 'Quiero 10 leñadores', 'Talad 20 árboles', 'La mitad de los mineros a construir hasta tener 30 casas', '¿Cuántos guerreros tengo?', 'Liberad las cuadrillas', 'Informe', 'Más madera', 'Más comida y casas', 'Todo a la ciencia', 'Menos ejército', 'Expandíos hacia el norte', vecino ? 'Atacad a ' + vecino.nombre : 'Atacad al vecino más débil', vecino ? 'Comerciad con ' + vecino.nombre : 'Comerciad con el más rico', 'Como antes']
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

  // Lo que hace el botón de cada paso de la guía.
  function hacerPasoGuia(p) {
    const c = tuPueblo(); if (!c) return;
    if (p.accion === 'ficha') { (m.guia = m.guia || {}).vioFicha = 1; elegir(c.id, true); document.body.classList.remove('sin-panel'); abrirHoja('pueblos'); }
    else if (p.accion === 'corte') abrirCorte(c.id);
    else { $('orden').value = p.boton; $('orden').focus(); }
    pintarConsejo();
  }
  function pintarConsejo() {
    const c = tuPueblo(), k = c ? X.consejo(m, c.id) : null;
    // Mientras dura la guía, el consejero enseña el paso que toca (salvo que haya hambre o guerra: eso va antes).
    const p = c && X.guia ? X.guia(m) : null, urgente = c && (c.guerras.length || (c.comida || 0) < (c.habitantes || 1) * 0.15);
    $('consejo').classList.toggle('guia', !!(p && !urgente));
    if (p && !urgente) {
      $('consejo').hidden = false;
      $('consejo').querySelector('.consejo-quien').textContent = 'Primeros pasos ' + p.n + '/' + p.de;
      $('consejo-texto').textContent = p.texto;
      $('consejo-orden').textContent = p.accion === 'orden' ? '«' + p.boton + '»' : p.boton + ' ›';
      $('consejo-orden').onclick = ev => { ev.stopPropagation(); hacerPasoGuia(p); };
      return;
    }
    $('consejo').querySelector('.consejo-quien').textContent = 'Tu consejero';
    $('consejo').hidden = !k;
    if (!k) return;
    $('consejo-texto').textContent = k.texto;
    $('consejo-orden').textContent = '«' + k.orden + '»';
    $('consejo-orden').onclick = () => { $('orden').value = k.orden; $('orden').focus(); };
  }
  function vehiculosDe(c) {
    const n = {}; for (const a of m.vida ? m.vida.aldeanos : []) if (a.c === c.id && a.veh) n[a.veh] = (n[a.veh] || 0) + 1;
    const V = M.vida.VEHICULOS, partes = Object.keys(n).map(k => n[k] + ' ' + V[k].nombre + (n[k] > 1 ? (k === 'canon' ? 'es' : k === 'artilleria' ? '' : 's') : ''));
    return partes.length ? esc(partes.join(', ')) + (c.era >= 8 ? ' <span class="tenue">· aviones en guerra</span>' : '') : '<span class="tenue">' + (c.cuarteles > 0 ? 'ninguno (cuestan metal: ' + Math.floor(c.metal || 0) + ')' : 'hace falta un cuartel') + '</span>';
  }
  // El marcador de cada guerra: bajas, plazas ganadas y perdidas, qué hace el ejército y cómo va el asedio.
  const nombrePlaza = r => { const x = (m.ciudades || []).find(y => y.region === r); if (x) return x.nombre; const o = S.vivas(m).find(y => y.capital === r); return o ? 'capital de ' + o.nombre : 'una plaza'; };
  function marcadorGuerra(c, corto, max) {
    const v = m.vida, e = v && v.ejercitos && v.ejercitos[c.id];
    // Primero la guerra en que está el ejército, luego las de más bajas.
    const lista = c.guerras.slice().sort((x, y) => ((e && e.con === y.con) - (e && e.con === x.con)) || ((y.muertos || 0) + (y.matados || 0)) - ((x.muertos || 0) + (x.matados || 0))).slice(0, max || 99);
    return lista.map(g => {
      const o = S.civ(m, g.con);
      if (!o) return '';
      const nuestro = e && e.con === o.id ? e : null, suyo = v && v.ejercitos && v.ejercitos[o.id];
      const mio = (g.muertos || 0), suyos = (g.matados || 0), balance = suyos - mio + 6 * ((g.ganadas || 0) - (g.perdidas || 0)) + 2 * (g.comarcas || 0);
      const que = !nuestro ? (S.vecinosDe(m, c).includes(o) ? 'el ejército se prepara' : 'sin frontera común') :
        nuestro.defiende != null ? '🛡 defendiendo ' + esc(nuestro.defiende === c.capital ? 'la capital' : nombrePlaza(nuestro.defiende)) :
        nuestro.fase === 'reunion' ? 'reuniéndose para ir a ' + esc(nombrePlaza(nuestro.obj)) :
        '⚔ sobre ' + esc(nombrePlaza(nuestro.obj)) + (nuestro.estorbo ? ' <span class="tenue">(' + { torre: 'una torre impide el asedio: hay que derribarla', defensores: 'quedan defensores', lejos: 'el capitán aún no ha llegado' }[nuestro.estorbo] + ')</span>' : '') + (nuestro.asedio > 0 ? ' · asedio <span class="barra"><span style="width:' + Math.round(nuestro.asedio) + '%"></span></span> ' + Math.round(nuestro.asedio) + ' %' : '');
      const amenaza = suyo && suyo.con === c.id && m.dueno[suyo.obj] === c.id && suyo.fase === 'marcha' && suyo.defiende == null ? '<br><span class="rojo">⚠ Atacan ' + esc(suyo.obj === c.capital ? 'tu capital' : nombrePlaza(suyo.obj)) + (suyo.asedio > 0 ? ' (asedio ' + Math.round(suyo.asedio) + ' %)' : '') + '</span>' : '';
      return '<div class="guerra-marcador"><b>⚔ ' + esc(o.nombre) + '</b> <span class="' + (balance >= 0 ? 'verde' : 'rojo') + '">' + (balance > 0 ? 'vas ganando' : balance < 0 ? 'vas perdiendo' : 'igualados') + '</span>' +
        '<br><span class="tenue">Bajas</span> ' + mio + ' tuyas · ' + suyos + ' suyas <span class="tenue">· Plazas</span> +' + (g.ganadas || 0) + ' −' + (g.perdidas || 0) + ' <span class="tenue">· Tierras</span> ' + ((g.comarcas || 0) > 0 ? '+' : '') + (g.comarcas || 0) +
        '<br>' + que + amenaza + (corto ? '' : '<br><span class="tenue">Órdenes: «atacad ' + esc(((m.ciudades || []).find(x => x.civ === o.id) || {}).nombre || 'su capital') + '», «defended la capital», «paz con ' + esc(o.nombre) + '».</span>') + '</div>';
    }).join('');
  }
  // Las cuadrillas, cupos y metas en marcha, con lo que les queda (cuenta atrás si se dio en minutos).
  let ultimoPlanHud = '';
  function pintarCuadrillas() {
    const c = tuPueblo(), h = $('cuadrillas-hud');
    if (!h) return;
    if (m.vida) m.vida.msTurno = VELOCIDADES[vel][0];
    const p = c && c.plan, partes = [];
    if (p) {
      for (const g of p.cuadrillas || []) partes.push('⚒ ' + esc(g.texto) + ' <b>' + (g.hasta ? esc(X.queda(m, c, g.hasta, VELOCIDADES[vel][0])) : '∞') + '</b>');
      for (const k of Object.keys(p.cupos || {})) partes.push('📌 ' + p.cupos[k].n + ' ' + X.OFICIOS_N[k] + (p.cupos[k].hasta ? ' <b>' + esc(X.queda(m, c, p.cupos[k].hasta, VELOCIDADES[vel][0])) + '</b>' : ''));
      for (const t of p.temporales || []) partes.push('⏱ ' + esc(X.NOMBRE_RECURSO[t.k]) + ' ' + esc(X.NIVEL(t.puesto)) + ' <b>' + esc(X.queda(m, c, t.hasta, VELOCIDADES[vel][0])) + '</b>');
    }
    const html = partes.join('<span class="sep"> · </span>');
    if (html === ultimoPlanHud) return;
    ultimoPlanHud = html; h.innerHTML = html; h.hidden = !html;
  }
  function pintarGuerra() {
    const c = tuPueblo(), h = $('guerra-hud');
    const html = c && c.guerras.length ? marcadorGuerra(c, true, 2) + (c.guerras.length > 2 ? '<p class="tenue guerra-mas">y ' + (c.guerras.length - 2) + ' guerra' + (c.guerras.length > 3 ? 's' : '') + ' más (pestaña Ejército)</p>' : '') : '';
    h.hidden = !html;
    if (html && h.innerHTML !== html) h.innerHTML = html;
  }
  const movil = () => window.matchMedia('(max-width: 899px)').matches;
  function abrirHoja(nombre) {
    for (const b of document.querySelectorAll('.panel-pestanas .pestana')) b.classList.toggle('activa', b.dataset.panel === nombre);
    for (const h of document.querySelectorAll('.panel-hoja')) h.hidden = h.dataset.hoja !== nombre;
    document.body.classList.remove('sin-panel');
  }
  // Un aviso grande sobre el mapa durante unos segundos.
  let avisoHasta = 0;
  const avisados = new WeakSet();
  function avisoFlotante(texto, ms, region) {
    const e = $('aviso-flotante');
    e.textContent = texto + (region != null ? '  📍' : ''); e.hidden = false;
    // Si el aviso tiene sitio, al tocarlo la cámara va allí.
    e.style.pointerEvents = region != null ? 'auto' : ''; e.style.cursor = region != null ? 'pointer' : '';
    e.onclick = region != null ? () => { P.centrarEn(region, 5); e.hidden = true; } : null;
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    avisoHasta = performance.now() + (ms || 3500);
    setTimeout(() => { if (performance.now() >= avisoHasta - 50) e.hidden = true; }, ms || 3500);
  }
  function pintarTodo() { pintarCabecera(); pintarPueblos(); pintarCronica(); pintarConsejo(); pintarGuerra(); pintarCuadrillas(); pintarRetos(); pintarRecursos(); }

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
    P.iniciar($('mapa'), { reducido, alClicar: region => { aldeanoSel = null; edificioSel = null; P.elegirAldeano(null); const d = m.dueno[region]; if (tuPueblo() && d === tuPueblo().id) (m.guia = m.guia || {}).vioFicha = 1; elegir(d >= 0 ? (sel === d ? null : d) : null, false); if (movil()) { if (sel != null) abrirHoja('pueblos'); else document.body.classList.add('sin-panel'); } }, alClicarAldeano: id => { edificioSel = null; aldeanoSel = id; P.elegirAldeano(id); pintarFicha(); if (movil()) abrirHoja('pueblos'); }, alClicarEdificio: t => { if (tuPueblo() && m.dueno[M.vida.region(m, t)] === tuPueblo().id) (m.guia = m.guia || {}).vioFicha = 1; aldeanoSel = null; P.elegirAldeano(null); edificioSel = t; pintarFicha(); abrirHoja('pueblos'); }, alClicarCorte: (civ) => { elegir(civ, false); abrirCorte(civ); } });
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
    panelAbierto(window.innerWidth >= 900);
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
})(globalThis.RF = globalThis.RF || {});
