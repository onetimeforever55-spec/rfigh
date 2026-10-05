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
  const VELOCIDADES = [[3400, '1×'], [1200, '3×'], [400, '10×']];
  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let aldeanoSel = null, pestana = 'resumen';
  let m = null, sel = null, corriendo = true, vel = 0, reloj = null, sample = null, ocupado = false, confirmarNuevo = false, ultimaCronista = 0;

  // ---------- Guardar y cargar (comodidad de este navegador) ----------
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(m)); } catch (e) { /* sin guardado */ } }
  function cargar() {
    try { const d = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (d && d.version === 1 && d.tipo && d.civs && d.W === S.W && d.H === S.H && d.vida) return d; } catch (e) { /* mundo corrupto */ }
    return null;
  }
  function mundoNuevo() {
    let libre = false;
    try { libre = localStorage.getItem('genesis.libre') === '1'; } catch (e) { /* sin preferencia */ }
    // Las partidas nuevas van a ritmo pausado: de tribu a ciudad en unos diez minutos a 1×, no en dos.
    m = S.crear((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, 5, { libre, ritmo: 3 });
    sel = null; ultimaCronista = 0;
    P.mundo(m); P.seleccionar(null);
  }

  // ---------- El modo de juego: dios de todos o gobernante de un pueblo ----------
  const modoPueblo = () => m.modo === 'pueblo' && m.jugador != null;
  const tuPueblo = () => { const c = modoPueblo() ? S.civ(m, m.jugador) : null; return c && c.viva ? c : null; };
  function pedirModo(titulo, texto) {
    $('inicio-titulo').textContent = titulo || '¿Cómo quieres jugar?';
    $('inicio-texto').textContent = texto || 'Puedes gobernar un solo pueblo con tus órdenes mientras los demás viven a su aire, o ser el dios de todos.';
    $('mundo-libre').checked = !!m.libre;
    $('inicio').hidden = false;
    corriendo = false; programar();
  }
  function elegirModo(modo, civId) {
    $('inicio').hidden = true;
    // El mundo libre se puede activar en cualquier momento: desde ahora, los años pasan de uno en uno.
    const libre = $('mundo-libre').checked;
    try { localStorage.setItem('genesis.libre', libre ? '1' : '0'); } catch (e) { /* sin guardado */ }
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
    $('orden').placeholder = c ? '5 granjeros a talar 2 minutos, quiero 10 leñadores, atacad a…' : 'Peste sobre el más grande, que descubran la pólvora…';
    $('voluntad').classList.toggle('es-pueblo', !!c);
    $('ir-mio').hidden = !c;
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
  const habitantes = c => { const n = c.habitantes != null ? c.habitantes : (m.vida ? m.vida.aldeanos.filter(a => a.c === c.id).length : 0); return n + (n === 1 ? ' aldeano' : ' aldeanos'); };
  const pob = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' M' : Math.round(p).toLocaleString('es-ES') + ' mil');
  const era = c => M.ERAS[c.era];

  function pintarCabecera() {
    if (anioAntes == null || !corriendo) $('anio').textContent = m.libre ? 'Año ' + m.anio : S.anioTexto(m.anio);
    const maxEra = Math.max(0, ...S.vivas(m).map(c => c.era));
    $('era').textContent = M.ERAS[maxEra].nombre;
    $('play').textContent = corriendo ? '❚❚ Pausa' : '▶ Seguir';
    $('play').setAttribute('aria-pressed', corriendo ? 'false' : 'true');
    $('vel').textContent = VELOCIDADES[vel][1];
  }

  // La barra de recursos: el oro (con lo que entra y sale cada turno), la comida, la madera, la piedra, el metal,
  // la gente y las camas, el nivel del asentamiento y lo que se investiga.
  const recursoAntes = {};
  function pintarRecursos() {
    const c = tuPueblo() || (sel != null ? S.civ(m, sel) : null), el = $('recursos');
    if (!c || !c.viva) { el.hidden = true; return; }
    const r = Math.round, delta = (k, x) => { const d = recursoAntes[c.id + k] != null ? x - recursoAntes[c.id + k] : 0; recursoAntes[c.id + k] = x; return d; };
    const oro = c.oro || 0, neto = (c.ingresos || 0) - (c.gastos || 0) - (c.mecenazgo || 0);
    const tope = r((15 + (c.aldeanos || 0) * 1.2) * (1 + M.tec(c, 'granero')));
    const inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
    const pct = inv ? Math.min(100, r(100 * c.investigacion.puntos / M.costeTec(inv))) : 0;
    const chip = (ico, valor, titulo, cls, extra) => '<span class="rec' + (cls ? ' ' + cls : '') + '" title="' + esc(titulo) + '"><i>' + ico + '</i>' + valor + (extra || '') + '</span>';
    const sig = (d, dec) => { if (!d || Math.abs(d) < 0.05) return ''; const t = (d > 0 ? '+' : '') + (dec ? d.toFixed(1) : r(d)); return ' <small class="' + (d > 0 ? 'verde' : 'rojo') + '">' + t + '</small>'; };
    const dC = delta('comida', c.comida || 0), dM = delta('madera', c.madera || 0), dP = delta('piedra', c.piedra || 0), dMe = delta('metal', c.metal || 0);
    const nivel = M.NIVELES[c.nivel || 0];
    el.innerHTML =
      chip('🪙', r(oro), 'Oro del tesoro: impuestos ' + (c.ingresos || 0).toFixed(1) + ' − sueldos y mantenimiento ' + (c.gastos || 0).toFixed(1) + (c.mecenazgo ? ' − ' + c.mecenazgo.toFixed(1) + ' para los sabios' : '') + ' por turno', oro < 0 ? 'mal' : 'oro', sig(neto, true)) +
      chip('🌾', r(c.comida || 0) + '<small class="tenue">/' + tope + '</small>', 'Comida en el granero (y lo que cabe)', (c.comida || 0) < (c.aldeanos || 0) * 0.3 ? 'mal' : '', sig(dC)) +
      chip('🪵', r(c.madera || 0), 'Madera', '', sig(dM)) +
      chip('🪨', r(c.piedra || 0), 'Piedra', '', sig(dP)) +
      (c.era >= 1 ? chip('⛓', r(c.metal || 0), 'Metal (armas, armaduras, vehículos)', '', sig(dMe)) : '') +
      chip('👥', (c.aldeanos || 0) + '<small class="tenue">/' + (c.camas || 0) + '</small>', 'Aldeanos / camas', (c.aldeanos || 0) >= (c.camas || 0) ? 'mal' : '') +
      chip('🏘', esc(nivel.nombre), nivel.nombre + (M.NIVELES[(c.nivel || 0) + 1] ? ' · a ' + M.NIVELES[(c.nivel || 0) + 1].desde + ' vecinos será ' + M.NIVELES[(c.nivel || 0) + 1].nombre.toLowerCase() + ' (' + M.NIVELES[(c.nivel || 0) + 1].abre + ')' : '')) +
      (c.subiendo ? chip('⏫', esc(M.ERAS[c.subiendo.a].nombre) + ' <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span>', 'Pasando de edad', 'oro') : M.ERAS[c.era + 1] && S.puedeSubir(m, c).ok ? chip('⏫', '¡' + esc(M.ERAS[c.era + 1].nombre) + '!', 'Podéis avanzar de edad: «avanzad de edad» o el botón de la pestaña Técnica', 'oro') : '') +
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
    if (aldeanoSel != null && fichaAldeano(f)) return;
    const c = sel != null ? S.civ(m, sel) : tuPueblo();
    if (!c || !c.viva) {
      sel = null;
      f.innerHTML = '<p class="vacio">Toca un pueblo en el mapa o en la lista para ver cómo vive. Lo que escribas sin nombrar a nadie le pasará al pueblo elegido.</p>';
      return;
    }
    const cs = S.casillas(m, c), cap = S.capacidad(m, c, cs);
    const enemigos = c.guerras.map(g => S.civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    const edificios = [c.castillos ? (c.era >= 7 ? 'fortín' : c.era >= 5 ? 'fortaleza' : c.era >= 2 ? 'castillo' : 'recinto de empalizada') : '', c.cuarteles ? 'cuartel' : '', c.arquerias ? (c.era >= 5 ? 'campo de tiro' : 'arquería') : '', c.torres ? c.torres + ' torre' + (c.torres > 1 ? 's' : '') : '', c.templos ? c.templos + ' templo' + (c.templos > 1 ? 's' : '') : '', c.molinos ? c.molinos + ' molino' + (c.molinos > 1 ? 's' : '') : '', c.puertos ? c.puertos + ' puerto' + (c.puertos > 1 ? 's' : '') + ' <span class="tenue">(' + ((m.vida.barcos || []).filter(b => b.c === c.id).length) + ' barcos)</span>' : ''].filter(Boolean).join(' · ') || '<span class="tenue">ninguno todavía</span>';
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
        fila('Obras', (c.casas || 0) + ' casas') + fila('Edificios', edificios) + fila('Comercio', comercioDe(c))],
      ejercito: ['Ejército', fila('Ejército', (c.guerreros || 0) + ' guerreros' + (c.guerreros ? ' <span class="tenue">· ' + (c.armados || 0) + ' con ' + esc(M.vida.ARMAS[c.era].nombre) + (c.era >= 1 ? ', tiradores con ' + esc(M.vida.TIROS[c.era]) : '') + '</span>' : '')) +
        fila('Equipo', esc(M.vida.ARMAS[c.era].nombre) + ' <span class="tenue">(' + M.vida.ARMAS[c.era].dano + ' de daño, ' + esc(M.vida.ARMAS[c.era].material) + ')</span> · ' + esc(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].nombre) + ' <span class="tenue">(−' + Math.round(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].reduce * 100) + ' %)</span>') +
        (c.era >= 5 ? fila('Vehículos', vehiculosDe(c)) : '') +
        fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + (c.guerras.length ? '</dl>' + marcadorGuerra(c, !c.jugador) + '<dl>' : '')],
      diplomacia: ['Diplomacia', (S.aliadosDe(m, c).length ? fila('Aliados', esc(S.aliadosDe(m, c).map(o => o.nombre).join(', '))) : fila('Aliados', '<span class="tenue">ninguno</span>')) +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + fila('Opinión', opiniones(c))]
    };
    pestanas.tecnica = ['Técnica', arbolTecnico(c)];
    if (c.jugador) pestanas.plan = ['Tu plan', planDe(c)];
    if (!pestanas[pestana]) pestana = 'resumen';
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(c.nombre) + '</h3>' +
      '<p class="subt">' + esc(M.conCaracter(c.regimen, c.caracter)) + ' · ' + esc(era(c).nombre) + '</p>' +
      '<div class="pestanas" role="tablist">' + Object.keys(pestanas).map(k => '<button type="button" role="tab" class="pestana' + (k === pestana ? ' activa' : '') + '" aria-selected="' + (k === pestana) + '" data-p="' + k + '">' + pestanas[k][0] + '</button>').join('') + '</div>' +
      (pestana === 'plan' || pestana === 'tecnica' ? pestanas[pestana][1] : '<dl>' + pestanas[pestana][1] + '</dl>') +
      (m.modo === 'pueblo' && !c.jugador ? '<button type="button" class="mando gobernar">Gobernar este pueblo</button>' : '');
    f.querySelectorAll('.pestana').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.p; pintarFicha(); }));
    // Tocar una tecnología disponible de tu pueblo: se investiga esa (la misma orden que «investigad …»).
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
      edad = '<div class="edad"><p class="tec-era">Siguiente edad: ' + esc(sig.nombre) + '</p>' + (c.subiendo ? '<p>⏫ Pasando a ' + esc(sig.con) + ': <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span> faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos</p>' :
        '<ul class="edad-req">' + item(!/saber/.test(faltaTxt), 'Saber ' + Math.floor(c.ciencia) + ' / ' + sig.umbral + ' (lo traen tus ' + M.ERUDITO(c.era).varios + ')') +
        (sig.desde != null && !m.libre ? item(!/llegar al año/.test(faltaTxt), 'Año ' + S.anioTexto(sig.desde).replace(/(\d)\.$/, '$1')) : '') +
        (req ? item(!/ser una|ser un|un templo|un cuartel|un castillo/.test(faltaTxt), req.texto.charAt(0).toUpperCase() + req.texto.slice(1)) + item(!/ de (comida|madera|piedra|oro|metal)/.test(faltaTxt), 'Pagar ' + precio) : '') + '</ul>' +
        (c.jugador ? '<button type="button" class="obrar avanzar-edad"' + (r.ok ? '' : ' disabled') + '>Avanzar a ' + esc(sig.nombre) + '</button>' : '')) + '</div>';
    }
    return '<div class="arbol">' + edad + (c.jugador ? '<p class="tenue arbol-ayuda">Las mejoras se investigan en su edificio (el molino, el templo, el cuartel…) y se pagan al empezar; el saber lo traen tus ' + esc(M.ERUDITO(c.era).varios) + '. Toca una para investigarla o escribe «investigad …».</p>' : '') + eras.map(e => {
      const filas = M.TECNOLOGIAS.filter(t => t.era === e).map(t => {
        const hecha = ts.includes(t.id), ahora = inv === t.id, abierta = !hecha && t.era <= c.era;
        const pct = ahora ? Math.min(100, Math.round(100 * c.investigacion.puntos / M.costeTec(t))) : 0;
        const falta = !hecha && !ahora && abierta ? S.faltaPara(m, c, t) : [];
        const precio = '<span class="tec-precio">' + esc(M.LUGARES[t.lugar] || 'la plaza') + ' · ' + Object.keys(t.precio || {}).map(k => t.precio[k] + ' ' + k).join(', ') + '</span>';
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
  function fichaAldeano(f) {
    const a = m.vida.aldeanos.find(x => x.id === aldeanoSel);
    if (!a) {
      f.innerHTML = '<p class="vacio">Ese aldeano ha muerto. Toca a otro en el mapa, o un pueblo para ver cómo vive.</p>';
      aldeanoSel = null; P.elegirAldeano(null); if (P.siguiendoA() != null) P.seguir(null);
      return true;
    }
    const c = S.civ(m, a.c), ciudad = (m.ciudades || []).find(x => x.region === a.h);
    const padre = a.padre != null ? m.vida.aldeanos.find(x => x.id === a.padre) : null;
    const hijosVivos = m.vida.aldeanos.filter(x => x.padre === a.id).length;
    const etapa = (a.edad || 0) < M.vida.ADULTO ? 'niño' : (a.edad || 0) >= M.vida.VIEJO ? 'anciano' : 'adulto';
    const oficio = (a.edad || 0) < M.vida.ADULTO ? 'juega cerca de casa' : a.colono != null ? 'colono, de camino a tierras nuevas' : (M.vida.OFICIOS[a.o] === 'erudito' ? M.ERUDITO((S.civ(m, a.c) || { era: 0 }).era).uno + (a.estudios ? ' · ' + a.estudios + ' jornadas de estudio' : '') : OFICIO1[M.vida.OFICIOS[a.o]]) + (M.vida.OFICIOS[a.o] === 'guerrero' ? (a.tirador ? ' tirador' : ' de cuerpo a cuerpo') : '');
    const siguiendo = P.siguiendoA() === a.id;
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(a.nombre + ' ' + (a.familia || '')) + '</h3>' +
      '<p class="subt">' + esc(etapa) + ' de ' + esc(c ? c.nombre : '—') + (ciudad ? ', vive en ' + esc(ciudad.nombre) : c && a.h === c.capital ? ', vive en la capital' : '') + '</p>' +
      '<dl>' + fila('Oficio', esc(oficio)) + fila('Edad', M.vida.anos(a) + ' años <span class="tenue">(nació ' + (m.libre ? 'el año ' + (a.nacio != null ? a.nacio : m.anio) : 'en ' + M.ERAS[a.eraNacio != null ? a.eraNacio : c.era].con) + ')</span>') +
      fila('Vida', vidaAldeano(a)) + fila('Lleva', equipoAldeano(a)) +
      fila('Rasgos', a.rasgos && a.rasgos.length ? esc(a.rasgos.join(', ')) : '<span class="tenue">ninguno especial</span>') +
      fila('Familia', (padre ? 'hijo de ' + esc(padre.nombre) + ' · ' : '') + (a.hijos || 0) + ((a.hijos || 0) === 1 ? ' hijo' : ' hijos') + (hijosVivos !== (a.hijos || 0) ? ' <span class="tenue">(' + hijosVivos + ' vivos)</span>' : '')) +
      (a.bajas ? fila('En combate', a.bajas + ' enemigos abatidos') : '') +
      fila('Hambre', a.hambre ? '<span class="rojo">' + a.hambre + ' turnos sin comer bien</span>' : 'bien alimentado') + '</dl>' +
      '<div class="linea" style="margin-top:10px"><button type="button" class="mando" id="seguir">' + (siguiendo ? 'Dejar de seguir' : 'Seguir con la cámara') + '</button> <button type="button" class="mando sutil" id="volver-pueblo">Ver su pueblo</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelector('#seguir').addEventListener('click', () => { P.seguir(siguiendo ? null : a.id); pintarFicha(); });
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

  function pintarConsejo() {
    const c = tuPueblo(), k = c ? X.consejo(m, c.id) : null;
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
  function abrirHoja(nombre) {
    for (const b of document.querySelectorAll('.panel-pestanas .pestana')) b.classList.toggle('activa', b.dataset.panel === nombre);
    for (const h of document.querySelectorAll('.panel-hoja')) h.hidden = h.dataset.hoja !== nombre;
    document.body.classList.remove('sin-panel');
  }
  // Un aviso grande sobre el mapa durante unos segundos.
  let avisoHasta = 0;
  function avisoFlotante(texto, ms) {
    const e = $('aviso-flotante');
    e.textContent = texto; e.hidden = false;
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
    window.genesis = { mundo: () => m, aldeano: id => { aldeanoSel = id; P.elegirAldeano(id); pintarFicha(); } };
    if (!m || anioAntes == null) return;
    if (performance.now() - (relojSuave.ult || 0) > 500) { relojSuave.ult = performance.now(); pintarCuadrillas(); }
    const f = corriendo ? Math.min(1, (performance.now() - inicioTurno) / VELOCIDADES[vel][0]) : 1;
    const anio = Math.round(anioAntes + (m.anio - anioAntes) * f);
    const texto = m.libre ? 'Año ' + anio : S.anioTexto(anio);
    if ($('anio').textContent !== texto) $('anio').textContent = texto;
  }
  function paso() {
    anioAntes = m.anio; inicioTurno = performance.now();
    const antes = m.cronica[0], yo = tuPueblo(), guerrasAntes = yo ? yo.guerras.map(g => g.con) : [], sigAntes = m.vida ? m.vida.sig : 0;
    S.turno(m);
    P.turno(m, VELOCIDADES[vel][0]);
    // Los paneles, los retos y el guardado van después, en otro fotograma (menos tirón al cambiar de turno).
    setTimeout(() => despuesDelTurno(antes, yo, guerrasAntes, sigAntes), 40);
  }
  function despuesDelTurno(antes, yo, guerrasAntes, sigAntes) {
    // Avisos del turno sobre el mapa (plazas ganadas, cuadrillas que terminan) y en la línea de respuesta.
    for (const an of (m.vida.anuncios || []).splice(0)) { const c = S.civ(m, an.civ); if (c && (!m.jugador || an.civ === m.jugador || an.region != null)) P.anunciar(an.region != null ? an.region : c.capital, an.texto, /[⚔✖]/.test(an.texto) ? '#ff8a7a' : /🏴/.test(an.texto) ? '#ffd76a' : null); }
    for (const av of (m.avisosPlan || []).splice(0)) if (av.civ === m.jugador) responder(av.texto, 'bien');
    if (m.cronica[0] !== antes) marcar(m.cronica[0]);
    if (M.sonido && M.sonido.activo()) {
      const nuevos = []; for (const e of m.cronica) { if (e === antes) break; nuevos.push(e); }
      M.sonido.turno(m, VELOCIDADES[vel][0], { cronica: nuevos, nacimientos: m.vida.aldeanos.some(a => a.id >= sigAntes && a.edad === 0) });
    }
    if (yo || m.retos) retosDelTurno(antes);
    if (yo) avisos(yo, guerrasAntes, antes);
    pintarTodo();
    if (m.turno % 5 === 0) guardar();
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
  function mostrarFin(e) {
    corriendo = false; programar();
    $('fin-titulo').textContent = e.civ.viva ? 'Fin de la partida: ' + e.civ.nombre + ' llega a ' + (m.libre ? 'su año ' + m.anio : '1945') : e.civ.nombre + ' ha caído';
    $('fin-texto').innerHTML = '<b class="retos-total">' + e.total.toLocaleString('es-ES') + ' puntos</b><br><span class="tenue">' + e.puntos + ' de retos (' + e.hechos + ' de ' + e.lista.length + ')' + (e.civ.viva ? ' + ' + e.extra + ' por tu gente y tu tierra · puesto ' + e.puesto + ' de ' + S.vivas(m).length + ' en tierras' : '') + '</span>';
    $('fin-retos').innerHTML = '<p class="tenue">' + e.lista.filter(x => x.hecho).map(x => '★ ' + esc(x.nombre)).join(' · ') + '</p>';
    $('fin').hidden = false;
  }
  function pintarRetos() {
    const e = X.estadoRetos(m), mk = $('marcador');
    mk.hidden = !e;
    if (!e) { $('retos').innerHTML = '<p class="vacio">Los retos son para quien gobierna un pueblo. Elige «Cambiar de modo» → «Gobernar un pueblo».</p>'; return; }
    mk.innerHTML = '★ <b>' + e.total.toLocaleString('es-ES') + '</b> <span>' + e.hechos + '/' + e.lista.length + ' retos</span>';
    $('retos').innerHTML = '<div class="retos-cab"><span class="retos-total">' + e.total.toLocaleString('es-ES') + ' puntos</span><br><span class="tenue">' + e.puntos + ' de retos + ' + e.extra + ' por tu gente y tu tierra. La partida termina en ' + (m.libre ? 'el año 400' : '1945') + '.</span></div>' +
      e.lista.map(x => '<div class="reto' + (x.hecho ? ' hecho' : !e.civ.viva ? ' fallado' : '') + '"><div class="reto-cab"><span class="reto-nombre">' + (x.hecho ? '★ ' : '') + esc(x.nombre) + '</span><span class="reto-puntos">+' + x.puntos + '</span></div><p class="reto-texto">' + esc(x.texto) + (x.hecho ? ' <b>Cumplido en ' + esc(m.libre ? 'el año ' + x.cuando : S.anioTexto(x.cuando)) + '.</b>' : '') + '</p>' +
        (x.hecho ? '' : '<span class="barra"><span style="width:' + Math.round(x.avance * 100) + '%"></span></span> <span class="tenue">' + Math.min(x.v, x.meta) + ' / ' + x.meta + '</span>') + '</div>').join('');
  }
  // Lo que le pasa a tu pueblo mientras corre el tiempo: guerras que te declaran, paces que te ofrecen, tu caída.
  function avisos(yo, guerrasAntes, ultimo) {
    if (!yo.viva) {
      pintarModo();
      if (!$('fin').hidden) return; // primero se ve la puntuación; al seguir, se elige otro pueblo
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
    M.vida.ajustar(m); P.refrescar();
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
  function iniciar(datos) {
    P.iniciar($('mapa'), { reducido, alClicar: region => { aldeanoSel = null; P.elegirAldeano(null); const d = m.dueno[region]; elegir(d >= 0 ? (sel === d ? null : d) : null, false); }, alClicarAldeano: id => { aldeanoSel = id; P.elegirAldeano(id); pintarFicha(); } });
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
    // El sonido empieza apagado (los navegadores solo dejan sonar tras un gesto); se recuerda la preferencia.
    const pintarSonido = () => { const on = M.sonido.activo(); $('sonido').textContent = on ? '🔊 Sonido' : '🔈 Sonido'; $('sonido').setAttribute('aria-pressed', on ? 'true' : 'false'); };
    $('sonido').addEventListener('click', () => { const on = M.sonido.alternar(); try { localStorage.setItem('genesis.sonido', on ? '1' : '0'); } catch (e) { /* sin guardado */ } pintarSonido(); });
    pintarSonido();
    $('zoom-mas').addEventListener('click', () => P.zoom(1.5));
    $('zoom-menos').addEventListener('click', () => P.zoom(1 / 1.5));
    $('ver-todo').addEventListener('click', () => P.verTodo());
    $('cronista').addEventListener('click', cronista);
    // El panel lateral (abajo en el móvil): pestañas, abrir y cerrar. En pantallas pequeñas empieza cerrado.
    const panelAbierto = abierto => { document.body.classList.toggle('sin-panel', !abierto); $('ver-panel').setAttribute('aria-expanded', abierto ? 'true' : 'false'); };
    panelAbierto(window.innerWidth >= 900);
    $('ver-panel').addEventListener('click', () => panelAbierto(document.body.classList.contains('sin-panel')));
    $('cerrar-panel').addEventListener('click', () => panelAbierto(false));
    for (const b of document.querySelectorAll('.panel-pestanas .pestana')) b.addEventListener('click', () => abrirHoja(b.dataset.panel));
    $('ver-ideas').addEventListener('click', () => { const e = $('ejemplos'); e.hidden = !e.hidden; $('ver-ideas').setAttribute('aria-expanded', e.hidden ? 'false' : 'true'); });
    $('ir-mio').addEventListener('click', () => { const c = tuPueblo(); if (c) P.centrarEn(c.capital, 3); });
    $('marcador').addEventListener('click', () => { panelAbierto(true); abrirHoja('retos'); });
    $('fin-seguir').addEventListener('click', () => { $('fin').hidden = true; if (!tuPueblo()) pedirModo('Elige otro pueblo', 'Tu pueblo ya no existe. Gobierna otro o sigue mirando como dios.'); else { corriendo = true; programar(); } });
    $('fin-nuevo').addEventListener('click', () => { $('fin').hidden = true; mundoNuevo(); pintarModo(); pintarTodo(); guardar(); pedirModo(); });
    for (const b of document.querySelectorAll('#filtro-cronica .pestana')) b.addEventListener('click', () => {
      filtroCronica = b.dataset.f;
      for (const o of document.querySelectorAll('#filtro-cronica .pestana')) o.classList.toggle('activa', o === b);
      pintarCronica();
    });
    programar();
    requestAnimationFrame(relojSuave);
    // Un mundo nuevo (o uno guardado de antes de los modos) pregunta cómo quieres jugar.
    if (!m.modo) pedirModo();
    else if (m.modo === 'pueblo' && tuPueblo()) P.centrarEn(tuPueblo().capital, 3);
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
