/*
 * EL JUEGO: conecta la consola (pantalla) con el Intérprete, el Consejero y el Narrador.
 * Guarda la partida en el propio celular para poder seguir otro día.
 */
(function (RF) {
  'use strict';
  const CLAVE = 'valdoria.partida.v2';
  const MAX_REGISTRO = 160;
  const $ = (id) => document.getElementById(id);
  const reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ATAJOS = [
    ['Imprimir dinero', 'imprimir dinero'], ['Regalar…', 'Regalar '], ['Vender…', 'Vender '],
    ['Subir impuestos a…', 'Subir impuestos a '], ['Bajar impuestos a…', 'Bajar impuestos a '], ['Invertir en…', 'Invertir en '],
    ['Recortar…', 'Recortar '], ['Represión contra…', 'Mano dura contra '], ['Prohibir…', 'Prohibir '], ['Legalizar…', 'Legalizar '],
    ['Economía al…', 'Que toda la economía sea de '], ['Crear…', 'Crear '], ['Derogar…', 'Derogar '],
    ['Disolver…', 'Disolver '], ['Controlar…', 'Controlar '], ['En secreto…', 'En secreto '],
    ['esperar', 'esperar', true], ['estado', 'estado', true], ['sistema', 'sistema', true], ['leyes', 'leyes', true], ['poder', 'poder', true], ['historial', 'historial', true], ['ayuda', 'ayuda', true]
  ];

  let estado, registro = [], cola = [], escribiendo = null, actual = null, saltar = false, pendienteReinicio = false, tarjetaAbierta = null;

  // ---------- Guardado ----------
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ estado, registro: registro.slice(-MAX_REGISTRO) })); } catch (e) { /* sin guardado */ }
  }
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (d && d.estado && d.estado.version === 2) return d;
    } catch (e) { /* partida corrupta o sin acceso */ }
    return null;
  }

  // ---------- Los cuatro indicadores ----------
  // Dinero puede ser negativo (deuda); en la inflación, subir es malo.
  function nivelStat(id, v) {
    if (id === 'dinero') return v < 0 ? 'bajo' : v < 40 ? 'medio' : '';
    if (id === 'inflacion') return v > 30 ? 'bajo' : v > 12 ? 'medio' : '';
    return v < 25 ? 'bajo' : v < 45 ? 'medio' : '';
  }
  function anchoBarra(id, v) {
    if (id === 'dinero') return Math.max(0, Math.min(100, (v / 300) * 100));
    if (id === 'inflacion') return Math.max(0, Math.min(100, v));
    return v;
  }
  function textoDelta(id, d) {
    const n = (d > 0 ? '+' : '−') + Math.abs(d);
    return id === 'dinero' ? n + 'M' : id === 'inflacion' ? n + '%' : n;
  }
  function esBueno(id, d) { return id === 'inflacion' ? d < 0 : d > 0; }

  function montarStats() {
    $('stats').innerHTML = RF.STATS.map(s =>
      `<li class="stat" id="st-${s.id}" title="${s.nombre}">
        <span class="stat-nombre">${s.corto}</span>
        <span class="stat-valor">0</span>
        <div class="stat-barra"><div class="stat-relleno"></div></div>
        <div class="cambio"></div>
      </li>`).join('');
  }
  function pintarStats(deltas) {
    for (const s of RF.STATS) {
      const v = estado.stats[s.id];
      const li = $('st-' + s.id);
      li.querySelector('.stat-valor').textContent = RF.narrador.formatoStat(s.id, v);
      li.querySelector('.stat-relleno').style.width = anchoBarra(s.id, v) + '%';
      const nivel = nivelStat(s.id, v);
      li.classList.toggle('bajo', nivel === 'bajo');
      li.classList.toggle('medio', nivel === 'medio');
      li.setAttribute('aria-label', s.nombre + ' ' + RF.narrador.formatoStat(s.id, v));
      const c = li.querySelector('.cambio');
      const d = deltas && deltas[s.id];
      if (d) {
        c.textContent = textoDelta(s.id, d);
        c.className = 'cambio visible ' + (esBueno(s.id, d) ? 'sube' : 'baja');
        clearTimeout(c._t);
        c._t = setTimeout(() => c.classList.remove('visible'), 4000);
      }
    }
    $('dia').textContent = 'TURNO ' + Math.min(estado.dia, RF.PAIS.dias) + '/' + RF.PAIS.dias;
    const reg = RF.politica.regimen(estado);
    $('regimen').textContent = RF.REGIMENES[reg].corto;
    $('regimen').className = 'regimen r-' + reg.toLowerCase();
    const n = RF.leyes.lista(estado).length;
    const bal = Math.round(estado.balance || 0);
    $('ticker').textContent = 'BALANCE ' + (bal >= 0 ? '+' : '−') + Math.abs(bal) + 'M POR TURNO · ' + n + (n === 1 ? ' LEY VIGENTE' : ' LEYES VIGENTES') + ' ›';
    $('ticker').classList.toggle('alerta', bal < 0);
  }

  // ---------- Registro (la historia) ----------
  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function nombreStat(id) { return RF.STATS.find(s => s.id === id).nombre; }

  function listaDeltas(deltas, clase) {
    const cont = el('div', clase);
    const orden = RF.STATS.map(s => s.id).filter(k => deltas && deltas[k]);
    for (const k of orden) {
      const v = deltas[k];
      cont.appendChild(el('span', (clase === 'mini' ? '' : 'efecto ') + (esBueno(k, v) ? 'sube' : 'baja'), nombreStat(k) + ' ' + textoDelta(k, v)));
    }
    return cont;
  }

  // "Cada turno: +15M · Felicidad −3.1": lo que la ley seguirá haciendo.
  function filaPorTurno(pt, curvas, nivel) {
    const fila = el('div', 'b-efectos por-turno');
    fila.appendChild(el('span', 'efecto neutro', nivel > 1 ? 'Cada turno (nivel ' + nivel + ')' : 'Cada turno'));
    for (const s of RF.STATS) {
      const v = pt[s.id];
      if (!v || Math.abs(v) < 0.05) continue;
      const n = s.id === 'dinero' ? Math.round(v) : Math.round(v * 10) / 10;
      if (!n) continue;
      const txt = (n > 0 ? '+' : '−') + Math.abs(n) + (s.id === 'dinero' ? 'M' : '');
      cont(fila, el('span', 'efecto ' + (esBueno(s.id, n) ? 'sube' : 'baja'), s.nombre + ' ' + txt));
    }
    const c = curvas || {};
    if (Object.values(c).includes('madura') || Object.values(c).includes('lenta')) cont(fila, el('span', 'efecto neutro', 'tarda unos turnos en rendir'));
    if (c.felicidad === 'acostumbra') cont(fila, el('span', 'efecto neutro', 'la gente se acostumbrará'));
    if (c.estabilidad === 'desgasta') cont(fila, el('span', 'efecto neutro', 'rinde menos con el tiempo'));
    return fila;
  }
  function cont(padre, hijo) { padre.appendChild(hijo); }

  // Crea el elemento de un bloque. Devuelve {nodo, parrafo, texto} para el efecto máquina de escribir.
  function crearBloque(b) {
    const n = el('section', 'bloque b-' + b.tipo + (b.clase ? ' ' + b.clase : '') + (b.mono ? ' mono' : ''));
    let p = null, texto = null;
    if (b.tipo === 'efectos') {
      const fila = listaDeltas(b.deltas, 'b-efectos');
      fila.insertBefore(el('span', 'efecto neutro', b.rotulo || 'Ahora'), fila.firstChild);
      if (fila.childNodes.length === 1) fila.appendChild(el('span', 'efecto neutro', 'sin cambios'));
      n.className = 'bloque b-efectos-grupo';
      n.appendChild(fila);
      if (b.porTurno && Object.values(b.porTurno).some(v => Math.abs(v) >= 0.05)) n.appendChild(filaPorTurno(b.porTurno, b.curvas, b.nivel));
      return { nodo: n };
    }
    if (b.tipo === 'dilema') return crearDilema(b, n);
    if (b.tipo === 'cronica') {
      n.appendChild(el('span', 'etiqueta', b.titulo || 'CRÓNICA'));
      const pc = el('p', b.terminada ? '' : 'cursor', b.texto || '');
      n.appendChild(pc);
      nodosCronica.set(b, pc);
      return { nodo: n };
    }
    if (b.titulo) n.appendChild(el('span', 'etiqueta', b.titulo));
    if (b.tipo === 'gaceta' && b.titulo) {
      const sello = b.titulo.indexOf('DECRETO') === 0 ? 'DECRETADO' : b.titulo.indexOf('ORDEN RESERVADA') === 0 ? 'SECRETO' : b.titulo.indexOf('PROYECTO') === 0 ? 'BLOQUEADO' : null;
      if (sello) n.appendChild(el('span', 'sello', sello));
    }
    if (b.texto != null) {
      p = el('p');
      n.appendChild(p);
      texto = b.texto;
    }
    if (b.tipo === 'suceso' && b.deltas && Object.keys(b.deltas).some(k => b.deltas[k])) n.appendChild(listaDeltas(b.deltas, 'mini'));
    return { nodo: n, parrafo: p, texto };
  }

  const LETRAS = ['A', 'B', 'C'];

  // Tarjeta de evento con sus opciones. Solo se puede pulsar si es el evento abierto ahora mismo.
  function crearDilema(b, n) {
    n.appendChild(el('span', 'etiqueta', b.titulo));
    const p = el('p');
    n.appendChild(p);
    const cont = el('div', 'dilema-opciones');
    const pend = RF.director.pendiente(estado);
    const abierto = b.elegida == null && pend && pend.id === b.id;
    b.opciones.forEach((op, i) => {
      const boton = el('button', 'dilema-op' + (b.elegida === i ? ' elegida' : ''));
      boton.type = 'button';
      boton.disabled = !abierto;
      const linea = el('span', 'op-texto');
      linea.appendChild(el('span', 'op-letra', LETRAS[i] + ')'));
      linea.appendChild(document.createTextNode(op.texto));
      boton.appendChild(linea);
      const efectos = el('span', 'op-efectos');
      for (const r of op.resumen) efectos.appendChild(el('span', r.tono, r.texto));
      boton.appendChild(efectos);
      boton.addEventListener('click', () => elegirOpcion(i));
      cont.appendChild(boton);
    });
    n.appendChild(cont);
    if (abierto) tarjetaAbierta = { b, cont };
    return { nodo: n, parrafo: p, texto: b.texto };
  }

  const ANIMADOS = new Set(['gaceta', 'cupula', 'calle', 'suceso', 'fin', 'dilema', 'amanecer', 'prensa', 'regimen']);

  function mostrar(bloques, animar) {
    for (const b of bloques) {
      registro.push(b);
      cola.push({ b, animar: animar && !reducirMovimiento && ANIMADOS.has(b.tipo) });
    }
    if (registro.length > MAX_REGISTRO * 1.5) registro = registro.slice(-MAX_REGISTRO);
    if (!escribiendo) siguiente();
  }

  function alFondo() { const r = $('registro'); r.scrollTop = r.scrollHeight; }

  function siguiente() {
    let item;
    while ((item = cola.shift())) {
      const { nodo, parrafo, texto } = crearBloque(item.b);
      $('registro').appendChild(nodo);
      if (!parrafo || !item.animar || saltar) { if (parrafo) parrafo.textContent = texto; continue; }
      let i = 0;
      actual = { parrafo, texto };
      parrafo.classList.add('cursor');
      const paso = () => {
        i = saltar ? texto.length : Math.min(texto.length, i + 4);
        parrafo.textContent = texto.slice(0, i);
        alFondo();
        if (i < texto.length) escribiendo = requestAnimationFrame(paso);
        else { parrafo.classList.remove('cursor'); actual = null; escribiendo = setTimeout(siguiente, saltar ? 0 : 180); }
      };
      escribiendo = requestAnimationFrame(paso);
      return;
    }
    alFondo();
    escribiendo = null;
    saltar = false;
  }

  // Termina de golpe todo lo que se estaba escribiendo.
  function vaciar() {
    if (escribiendo) { clearTimeout(escribiendo); cancelAnimationFrame(escribiendo); }
    if (actual) { actual.parrafo.textContent = actual.texto; actual.parrafo.classList.remove('cursor'); actual = null; }
    while (cola.length) {
      const { nodo, parrafo, texto } = crearBloque(cola.shift().b);
      if (parrafo) parrafo.textContent = texto;
      $('registro').appendChild(nodo);
    }
    escribiendo = null;
    saltar = false;
    alFondo();
  }

  function mostrarOpciones(opciones) {
    const cont = el('div', 'bloque opciones');
    for (const op of opciones) {
      const b = el('button', 'opcion', op.etiqueta);
      b.type = 'button';
      b.addEventListener('click', () => {
        cont.querySelectorAll('button').forEach(x => { x.disabled = true; });
        b.classList.add('elegida');
        vaciar();
        firmar([op.interp]);
      });
      cont.appendChild(b);
    }
    const esperar = () => { if (escribiendo || cola.length) setTimeout(esperar, 100); else { $('registro').appendChild(cont); alFondo(); } };
    esperar();
  }

  // ---------- Turno ----------
  function cambios(antes) {
    const c = {};
    for (const k of Object.keys(antes)) c[k] = estado.stats[k] - antes[k];
    return c;
  }

  // Firma uno o varios decretos (el mismo día) y cuenta lo que pasa.
  // ---------- Crónica con IA ----------
  const nodosCronica = new WeakMap();
  let iaPausada = false; // si la conexión falla (por ejemplo, dentro del visor de Claude), no se reintenta en esta sesión

  function pintarCronica(b) {
    const pc = nodosCronica.get(b);
    if (!pc) return;
    pc.textContent = b.texto;
    pc.classList.toggle('cursor', !b.terminada);
    alFondo();
  }

  // Muestra los bloques de un turno. Con la IA activa, los textos narrativos se sustituyen por una crónica.
  function publicarTurno(bloques) {
    const N = RF.narradorIA.NARRATIVOS;
    const narrativos = bloques.filter(b => N.has(b.tipo));
    if (!RF.narradorIA.activa() || iaPausada || !narrativos.length) { mostrar(bloques, true); return; }
    const cronica = { tipo: 'cronica', titulo: 'CRÓNICA', texto: '' };
    const resto = bloques.filter(b => !N.has(b.tipo));
    const i = resto.findIndex(b => b.tipo === 'dilema' || b.tipo === 'fin');
    resto.splice(i === -1 ? resto.length : i, 0, cronica);
    mostrar(resto, true);
    RF.narradorIA.narrar(estado, bloques, (t) => { cronica.texto = t; pintarCronica(cronica); })
      .then(r => {
        cronica.texto = r.texto;
        cronica.terminada = true;
        pintarCronica(cronica);
        mostrar([{ tipo: 'bot', texto: RF.narradorIA.textoUso(r) }], false);
        guardar();
      })
      .catch(err => {
        // Si algo falla, se quita la crónica y se cuenta el turno con la narración normal.
        registro = registro.filter(b => b !== cronica);
        const pc = nodosCronica.get(cronica);
        if (pc && pc.parentNode) pc.parentNode.remove();
        cola = cola.filter(x => x.b !== cronica);
        const conexion = /conectar|cargar/.test(err.mensaje || '');
        if (conexion) { iaPausada = true; pintarBotonIA(); }
        mostrar([{ tipo: 'nota', texto: (err.mensaje || 'La IA no respondió.') + (conexion ? ' Desactivo la IA durante esta sesión.' : '') + ' El turno sigue con la narración normal.' }].concat(narrativos), true);
        guardar();
      });
  }

  // ---------- El cuadro de la IA: se pega la clave y el juego reconoce el proveedor ----------
  let modalIA = null, volverFoco = null;

  function pintarBotonIA() {
    const b = $('boton-ia');
    if (!b) return;
    const on = RF.narradorIA.activa() && !iaPausada;
    b.classList.toggle('on', on);
    b.textContent = on ? 'IA ●' : 'IA';
    b.setAttribute('aria-label', on ? 'Narrador con IA: activado' : 'Narrador con IA: desactivado');
  }

  function cerrarIA() {
    if (!modalIA || modalIA.hidden) return;
    modalIA.hidden = true;
    pintarBotonIA();
    if (volverFoco) volverFoco.focus();
  }

  function construirIA() {
    const NI = RF.narradorIA;
    const fondo = el('div', 'modal-ia'); fondo.hidden = true;
    const caja = el('div', 'caja-ia');
    caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true'); caja.setAttribute('aria-labelledby', 'titulo-ia');
    const cab = el('div', 'cab-ia');
    const tit = el('h2', '', 'NARRADOR CON IA'); tit.id = 'titulo-ia';
    const cerrar = el('button', 'cerrar-ia', '✕'); cerrar.type = 'button'; cerrar.setAttribute('aria-label', 'Cerrar');
    cab.append(tit, cerrar);
    const intro = el('p', 'intro-ia', 'Pega tu clave de API y la IA convertirá lo que pasa cada turno en una crónica. No decide nada: el juego ya lo ha calculado todo.');

    const form = el('form', 'form-ia');
    const lab1 = el('label', '', 'Tu clave de API'); lab1.htmlFor = 'ia-clave';
    const filaClave = el('div', 'fila-clave');
    const clave = el('input'); clave.id = 'ia-clave'; clave.type = 'password'; clave.autocomplete = 'off'; clave.spellcheck = false;
    clave.placeholder = 'Pega aquí tu clave (sk-or-…, AIza…, sk-ant-…)';
    const ver = el('button', 'chip', 'ver'); ver.type = 'button'; ver.setAttribute('aria-label', 'Mostrar u ocultar la clave');
    filaClave.append(clave, ver);
    const detectado = el('p', 'detectado-ia');
    const lab2 = el('label', '', 'Modelo'); lab2.htmlFor = 'ia-modelo';
    const sel = el('select'); sel.id = 'ia-modelo';
    const fila = el('label', 'fila-ia');
    const chk = el('input'); chk.type = 'checkbox'; chk.id = 'ia-activa';
    fila.append(chk, document.createTextNode(' Contar cada turno con la IA'));
    const botones = el('div', 'botones-ia');
    const bGuardar = el('button', 'chip guardar-ia', 'Guardar'); bGuardar.type = 'submit';
    const bProbar = el('button', 'chip', 'Probar'); bProbar.type = 'button';
    const bBorrar = el('button', 'chip cmd', 'Borrar clave'); bBorrar.type = 'button';
    botones.append(bGuardar, bProbar, bBorrar);
    form.append(lab1, filaClave, detectado, lab2, sel, fila, botones);
    const estadoIA = el('p', 'estado-ia'); estadoIA.setAttribute('aria-live', 'polite');
    const guia = el('details', 'guia-ia');
    guia.append(el('summary', '', '¿Dónde consigo una clave?'));
    for (const t of [
      'Gratis: OpenRouter (openrouter.ai → Keys). El juego elige solo un modelo gratis.',
      'Gratis: Google Gemini (aistudio.google.com → Get API key).',
      'Gratis: Groq (console.groq.com → API Keys).',
      'De pago, la mejor prosa: Claude (console.anthropic.com → API Keys).'
    ]) guia.append(el('p', '', t));
    const aviso = el('p', 'aviso-ia', 'La clave se guarda solo en este navegador. No compartas el juego con la clave puesta. Dentro de la página de Claude no funciona (bloquea conexiones externas): usa GitHub Pages o el archivo dist/valdoria.html.');
    caja.append(cab, intro, form, estadoIA, guia, aviso);
    fondo.appendChild(caja);
    document.body.appendChild(fondo);

    // Qué proveedor es y qué modelos ofrecer.
    let proveedorVisto = null, cargando = 0;
    const opcion = (valor, texto, elegido) => { const o = el('option', '', texto); o.value = valor; o.selected = !!elegido; sel.appendChild(o); };
    async function alCambiarClave() {
      const c = NI.config();
      const p = NI.detectar(clave.value);
      if (p === proveedorVisto && sel.options.length) return;
      proveedorVisto = p;
      sel.textContent = '';
      if (!clave.value.trim()) { detectado.textContent = ''; sel.disabled = true; opcion('', '—'); return; }
      if (!p) { detectado.textContent = 'No reconozco esta clave. Sirven las de OpenRouter, Gemini, Groq o Claude.'; detectado.className = 'detectado-ia mal'; sel.disabled = true; opcion('', '—'); return; }
      const info = NI.PROVEEDORES[p];
      detectado.className = 'detectado-ia';
      detectado.textContent = '✓ ' + info.nombre + (info.soloGratis ? ' · solo modelos gratis' : '');
      sel.disabled = false;
      const mismo = c.proveedor === p || (!c.proveedor && NI.detectar(c.clave) === p);
      if (p === 'anthropic') { for (const m of NI.MODELOS) opcion(m.id, m.nombre, mismo && m.id === c.modelo); return; }
      const fijo = mismo && c.modelo && !c.auto;
      opcion('', 'Automático' + (info.modelo ? ' (' + info.modelo + ')' : ' · uno gratis'), !fijo);
      if (fijo) opcion(c.modelo, c.modelo, true);
      // Se pide la lista de modelos al proveedor con la clave escrita (sin guardarla todavía).
      const yo = ++cargando;
      let lista = [];
      try { lista = await NI.listarModelos(clave.value.trim(), p); } catch (e) { /* sin lista: queda "automático" */ }
      if (yo !== cargando) return;
      for (const id of lista.sort()) if (!(fijo && id === c.modelo)) opcion(id, id);
      if (lista.length) detectado.textContent += ' · ' + lista.length + ' modelos';
    }
    clave.addEventListener('input', alCambiarClave);
    ver.addEventListener('click', () => { clave.type = clave.type === 'password' ? 'text' : 'password'; ver.textContent = clave.type === 'password' ? 'ver' : 'ocultar'; });

    const leer = () => ({ clave: clave.value.trim(), proveedor: NI.detectar(clave.value) || '', modelo: sel.value, auto: !sel.value, activa: chk.checked });
    const describir = () => NI.PROVEEDORES[NI.proveedor()].nombre + (NI.modelo().id ? ' · ' + NI.modelo().nombre : '');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = leer();
      if (v.clave && !v.proveedor) { estadoIA.textContent = 'No reconozco esa clave.'; return; }
      if (v.activa && !v.clave) { estadoIA.textContent = 'Falta la clave para activar la IA.'; return; }
      NI.guardar(v);
      iaPausada = false;
      pintarBotonIA();
      if (NI.activa()) { estadoIA.textContent = 'Guardado. El próximo turno lo cuenta ' + describir() + '.'; setTimeout(cerrarIA, 900); }
      else estadoIA.textContent = 'Guardado. La IA está apagada: sigue la narración normal.';
    });
    bProbar.addEventListener('click', async () => {
      const v = leer();
      if (!v.clave) { estadoIA.textContent = 'Pega primero tu clave.'; return; }
      if (!v.proveedor) { estadoIA.textContent = 'No reconozco esa clave.'; return; }
      NI.guardar(Object.assign(v, { activa: NI.config().activa }));
      estadoIA.textContent = 'Probando…';
      bProbar.disabled = true;
      const r = await NI.probar();
      bProbar.disabled = false;
      estadoIA.textContent = r.mensaje;
      if (r.ok) { iaPausada = false; if (NI.modelo().id && ![...sel.options].some(o => o.value === NI.modelo().id)) opcion(NI.modelo().id, NI.modelo().id, true); }
    });
    bBorrar.addEventListener('click', () => {
      NI.guardar({ clave: '', activa: false, proveedor: '', modelo: '' });
      clave.value = ''; chk.checked = false; proveedorVisto = undefined; alCambiarClave();
      pintarBotonIA();
      estadoIA.textContent = 'Clave borrada de este navegador.';
    });
    cerrar.addEventListener('click', cerrarIA);
    fondo.addEventListener('click', (ev) => { if (ev.target === fondo) cerrarIA(); });
    fondo.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarIA(); });

    fondo.abrir = () => {
      const c = NI.config();
      clave.value = c.clave || ''; clave.type = 'password'; ver.textContent = 'ver';
      chk.checked = !!c.activa || !c.clave; // con la primera clave, la IA se activa sola
      proveedorVisto = undefined; alCambiarClave();
      estadoIA.textContent = NI.activa() ? (iaPausada ? 'En pausa por un error de conexión. Pulsa Guardar para reintentar.' : 'Activa con ' + describir() + '.') : 'Apagada: el juego usa su narración normal.';
    };
    return fondo;
  }

  function mostrarConfigIA() {
    if (!modalIA) modalIA = construirIA();
    volverFoco = document.activeElement;
    modalIA.abrir();
    modalIA.hidden = false;
    const c = modalIA.querySelector('#ia-clave');
    setTimeout(() => (c.value ? modalIA.querySelector('.guardar-ia') : c).focus(), 30);
  }

  function firmar(lista) {
    const antes = Object.assign({}, estado.stats);
    const bloques = [];
    if (lista.length > 1) bloques.push({ tipo: 'nota', texto: 'Firmas ' + lista.length + ' decretos de una sentada. El secretario se masajea la muñeca.' });
    let ultimo = null, validos = 0, avanzado = false;
    lista.forEach((interp, k) => {
      const esUltimo = k === lista.length - 1;
      const op = { avanzar: esUltimo, secundario: validos > 0 };
      const res = interp.tipo === 'persona' ? RF.consejero.decretarPersona(estado, interp, op) : RF.consejero.decretar(estado, interp, op);
      // Una orden imposible ("matar a alguien que ya está muerto") no cuenta como decreto.
      if (res.nulo) { bloques.push({ tipo: 'nota', texto: res.nulo }); return; }
      validos++;
      ultimo = res;
      if (esUltimo) avanzado = true;
      bloques.push(...RF.narrador.decreto(estado, interp, res));
    });
    if (!ultimo) { mostrar(bloques, false); guardar(); return; }
    if (!avanzado) RF.consejero.avanzarDia(estado, ultimo);
    bloques.push(...RF.narrador.cierreDia(estado, ultimo));
    // Si ha saltado un evento (o el Congreso ha bloqueado la ley), su tarjeta va al final.
    const d = RF.director.pendiente(estado);
    if (d) bloques.push(RF.narrador.dilema(estado, d));
    publicarTurno(bloques);
    pintarStats(cambios(antes));
    actualizarConsola();
    guardar();
  }

  // Un turno sin decretos nuevos: las leyes vigentes siguen actuando.
  function esperar() {
    const antes = Object.assign({}, estado.stats);
    const res = RF.consejero.pasarTurno(estado);
    const bloques = [{ tipo: 'nota', texto: 'No firmas nada este turno. Dejas que tus leyes trabajen.' }].concat(RF.narrador.cierreDia(estado, res));
    const d = RF.director.pendiente(estado);
    if (d && res.dilema) bloques.push(RF.narrador.dilema(estado, d));
    publicarTurno(bloques);
    pintarStats(cambios(antes));
    actualizarConsola();
    guardar();
  }

  function elegirOpcion(i) {
    const d = RF.director.pendiente(estado);
    if (!d || !d.opciones[i] || !tarjetaAbierta) return;
    vaciar();
    tarjetaAbierta.b.elegida = i;
    tarjetaAbierta.cont.querySelectorAll('button').forEach((x, k) => { x.disabled = true; x.classList.toggle('elegida', k === i); });
    tarjetaAbierta = null;
    const antes = Object.assign({}, estado.stats);
    const r = RF.director.resolver(estado, i);
    mostrar([{ tipo: 'eco', texto: LETRAS[i] + ') ' + RF.texto.expandir(d.opciones[i].texto) }], false);
    mostrar(RF.narrador.decision(estado, r), true);
    pintarStats(cambios(antes));
    actualizarConsola();
    guardar();
  }

  // Mientras hay un evento abierto, la consola lo recuerda.
  function actualizarConsola() {
    const d = RF.director.pendiente(estado);
    $('consola').classList.toggle('aviso-pendiente', !!d);
    $('decreto').placeholder = d ? 'Elige A, B o C en el evento…' : estado.fin ? 'Escribe "reiniciar"…' : 'Escribe tu decreto…';
  }

  function reiniciar() {
    estado = RF.consejero.nuevoEstado();
    vaciar();
    tarjetaAbierta = null;
    registro = [];
    $('registro').innerHTML = '';
    pintarStats();
    mostrar(RF.narrador.intro(estado), false);
    actualizarConsola();
    guardar();
  }

  function procesar(entrada) {
    const texto = entrada.trim();
    if (!texto) return;
    const orden = RF.texto.normalizar(texto);
    mostrar([{ tipo: 'eco', texto }], false);

    if (pendienteReinicio) {
      pendienteReinicio = false;
      if (/^(si|s|confirmar|reiniciar)$/.test(orden)) { reiniciar(); return; }
      mostrar([{ tipo: 'nota', texto: 'Seguimos gobernando.' }], false);
      return;
    }
    if (/^(reiniciar|reset|nueva partida|empezar de nuevo)$/.test(orden)) {
      if (estado.fin) { reiniciar(); return; }
      pendienteReinicio = true;
      mostrar([{ tipo: 'nota', texto: '¿Seguro que quieres abandonar el poder y empezar de cero? Escribe "sí" para confirmar.' }], false);
      return;
    }
    if (/^(ayuda|help|\?)$/.test(orden)) { mostrar(RF.narrador.ayuda(), false); return; }
    if (/^(estado|informe|situacion)$/.test(orden)) { mostrar(RF.narrador.estadoPais(estado), false); return; }
    if (/^(ia|api|clave|configurar ia|narrador ia|cronica)$/.test(orden)) { mostrarConfigIA(); return; }
    if (/^(sistema|regimen|politica|congreso|sistema politico)$/.test(orden)) { mostrar(RF.narrador.sistema(estado), false); return; }
    if (/^(gabinete|ministros|poder|instituciones)$/.test(orden)) { mostrar(RF.narrador.gabinete(estado), false); return; }
    if (/^(leyes|ley|leyes vigentes|economia|mercado|balance)$/.test(orden)) { mostrar(RF.narrador.leyes(estado), false); return; }
    if (/^(historial|decretos|archivo)$/.test(orden)) { mostrar(RF.narrador.historial(estado), false); return; }

    if (estado.fin) {
      mostrar([{ tipo: 'nota', texto: 'Tu gobierno ha terminado. Escribe "reiniciar" para empezar otra partida.' }], false);
      return;
    }

    const pend = RF.director.pendiente(estado);
    if (pend) {
      const m = orden.match(/^(?:opcion )?([1-3]|[abc])\)?$/);
      if (m) { const i = /\d/.test(m[1]) ? +m[1] - 1 : 'abc'.indexOf(m[1]); if (i < pend.opciones.length) { elegirOpcion(i); return; } }
      mostrar([{ tipo: 'nota', texto: 'Antes de firmar nada más, decide qué hacer con el evento "' + pend.titulo + '". Pulsa una opción o escribe A, B o C.' }], false);
      return;
    }

    if (/^(esperar|espera|pasar|pasar turno|siguiente turno|siguiente|no hacer nada|nada)$/.test(orden)) { esperar(); return; }

    const lista = RF.interprete.interpretarVarios(texto, estado);
    if (lista.length > 1) { firmar(lista); return; }
    const interp = lista[0];
    if (interp.estado === 'ok') { firmar([interp]); return; }
    if (interp.estado === 'confuso') { mostrar(RF.narrador.confuso(interp), true); guardar(); return; }
    const q = RF.narrador.pregunta(interp);
    mostrar(q.bloques, true);
    if (q.opciones.length) mostrarOpciones(q.opciones);
    guardar();
  }

  // ---------- Controles ----------
  function montarAtajos() {
    const cont = $('chips');
    for (const [etiqueta, valor, esComando] of ATAJOS) {
      const b = el('button', 'chip' + (esComando ? ' cmd' : ''), etiqueta);
      b.type = 'button';
      b.addEventListener('click', () => {
        const input = $('decreto');
        if (esComando || !valor.endsWith(' ')) { vaciar(); procesar(valor); return; }
        input.value = valor;
        input.focus();
        try { input.setSelectionRange(valor.length, valor.length); } catch (e) { /* algunos navegadores no lo permiten */ }
      });
      cont.appendChild(b);
    }
  }

  function iniciar() {
    RF.interprete.entrenar();
    montarStats();
    montarAtajos();

    const guardada = cargar();
    if (guardada) {
      estado = guardada.estado;
      RF.poder.iniciar(estado);
      registro = [];
      mostrar(guardada.registro, false);
      mostrar([{ tipo: 'nota', texto: 'Partida recuperada. Bienvenido de vuelta a Palacio, Excelencia.' }], false);
      // Si había un evento abierto y su tarjeta no quedó en el registro, se vuelve a mostrar.
      const d = RF.director.pendiente(estado);
      if (d && !tarjetaAbierta) mostrar([RF.narrador.dilema(estado, d)], false);
      pintarStats();
      actualizarConsola();
    } else {
      reiniciar();
    }

    $('consola').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('decreto');
      const v = input.value;
      input.value = '';
      vaciar();
      procesar(v);
    });
    // Tocar la historia acelera el texto.
    $('registro').addEventListener('click', (e) => { if (!e.target.closest('button')) saltar = true; });
    $('ticker').addEventListener('click', () => { vaciar(); procesar('leyes'); });
    $('regimen').addEventListener('click', () => { vaciar(); procesar('sistema'); });
    $('boton-ia').addEventListener('click', mostrarConfigIA);
    pintarBotonIA();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(globalThis.RF = globalThis.RF || {});
