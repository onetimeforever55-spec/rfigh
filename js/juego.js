/*
 * EL JUEGO: conecta la consola (pantalla) con el Intérprete, el Consejero y el Narrador.
 * Guarda la partida en el propio celular para poder seguir otro día.
 */
(function (RF) {
  'use strict';
  const CLAVE = 'valdoria.partida.v1';
  const MAX_REGISTRO = 160;
  const $ = (id) => document.getElementById(id);
  const reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ATAJOS = [
    ['Prohibir…', 'Prohibir '], ['Vender…', 'Vender '], ['Regalar…', 'Regalar '],
    ['Impuestos a…', 'Subir impuestos a '], ['Mano dura…', 'Mano dura contra '], ['Legalizar…', 'Legalizar '],
    ['Invertir en…', 'Invertir en '], ['Recortar…', 'Recortar '], ['Obligar…', 'Obligar a todos a '],
    ['Estatua de mí', 'Estatua de mí'],
    ['estado', 'estado', true], ['gabinete', 'gabinete', true], ['historial', 'historial', true], ['ayuda', 'ayuda', true]
  ];

  let estado, registro = [], cola = [], escribiendo = null, actual = null, saltar = false, pendienteReinicio = false, tarjetaAbierta = null;

  // ---------- Guardado ----------
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ estado, registro: registro.slice(-MAX_REGISTRO) })); } catch (e) { /* sin guardado */ }
  }
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (d && d.estado && d.estado.version === 1) return d;
    } catch (e) { /* partida corrupta o sin acceso */ }
    return null;
  }

  // ---------- Barras del país ----------
  function montarStats() {
    $('stats').innerHTML = RF.STATS.map(s =>
      `<li class="stat" id="st-${s.id}" title="${s.nombre}">
        <div class="stat-cab"><span class="stat-nombre">${s.corto}</span><span class="stat-valor">0</span></div>
        <div class="stat-barra"><div class="stat-relleno"></div></div>
        <div class="cambio"></div>
      </li>`).join('');
  }
  function pintarStats(deltas) {
    for (const s of RF.STATS) {
      const v = estado.stats[s.id];
      const li = $('st-' + s.id);
      li.querySelector('.stat-valor').textContent = v;
      li.querySelector('.stat-relleno').style.width = v + '%';
      li.classList.toggle('bajo', v < 25);
      li.classList.toggle('medio', v >= 25 && v < 45);
      li.setAttribute('aria-label', s.nombre + ' ' + v);
      const c = li.querySelector('.cambio');
      const d = deltas && deltas[s.id];
      if (d) {
        c.textContent = (d > 0 ? '+' : '') + d;
        c.className = 'cambio visible ' + (d > 0 ? 'sube' : 'baja');
        clearTimeout(c._t);
        c._t = setTimeout(() => c.classList.remove('visible'), 4000);
      }
    }
    $('dia').textContent = 'DÍA ' + Math.min(estado.dia, RF.PAIS.dias) + '/' + RF.PAIS.dias;
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
      cont.appendChild(el('span', (clase === 'mini' ? '' : 'efecto ') + (v > 0 ? 'sube' : 'baja'), nombreStat(k) + ' ' + (v > 0 ? '+' : '−') + Math.abs(v)));
    }
    return cont;
  }

  // Crea el elemento de un bloque. Devuelve {nodo, parrafo, texto} para el efecto máquina de escribir.
  function crearBloque(b) {
    const n = el('section', 'bloque b-' + b.tipo + (b.clase ? ' ' + b.clase : '') + (b.mono ? ' mono' : ''));
    let p = null, texto = null;
    if (b.tipo === 'efectos') {
      const cont = listaDeltas(b.deltas, 'b-efectos');
      if (!cont.childNodes.length && !b.economia) cont.appendChild(el('span', 'efecto neutro', 'Sin cambios visibles'));
      if (b.economia) cont.appendChild(el('span', 'efecto ' + (b.economia > 0 ? 'sube' : 'baja'), 'Caja del día ' + (b.economia > 0 ? '+' : '−') + Math.abs(b.economia)));
      if (b.cambioIngresos) cont.appendChild(el('span', 'efecto ' + (b.cambioIngresos > 0 ? 'sube' : 'baja'), 'Ingresos diarios ' + (b.cambioIngresos > 0 ? '+' : '−') + Math.abs(b.cambioIngresos)));
      n.className = 'bloque';
      n.appendChild(cont);
      return { nodo: n };
    }
    if (b.tipo === 'dilema') return crearDilema(b, n);
    if (b.titulo) n.appendChild(el('span', 'etiqueta', b.titulo));
    if (b.tipo === 'gaceta' && b.titulo && b.titulo.indexOf('DECRETO') === 0) n.appendChild(el('span', 'sello', 'DECRETADO'));
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

  const ANIMADOS = new Set(['gaceta', 'cupula', 'calle', 'suceso', 'fin', 'dilema', 'amanecer', 'prensa']);

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
  function firmar(lista) {
    const antes = Object.assign({}, estado.stats);
    const bloques = [];
    if (lista.length > 1) bloques.push({ tipo: 'nota', texto: 'Firmas ' + lista.length + ' decretos de una sentada. El secretario se masajea la muñeca.' });
    let ultimo = null;
    lista.forEach((interp, k) => {
      const esUltimo = k === lista.length - 1;
      ultimo = RF.consejero.decretar(estado, interp, { avanzar: esUltimo, secundario: k > 0 });
      bloques.push(...RF.narrador.decreto(estado, interp, ultimo));
    });
    bloques.push(...RF.narrador.cierreDia(estado, ultimo));
    const d = RF.director.pendiente(estado);
    if (d && ultimo.dilema) bloques.push(RF.narrador.dilema(estado, d));
    mostrar(bloques, true);
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
    mostrar([{ tipo: 'eco', texto: LETRAS[i] + ') ' + d.opciones[i].texto }], false);
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
    if (/^(gabinete|ministros)$/.test(orden)) { mostrar(RF.narrador.gabinete(estado), false); return; }
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

    const lista = RF.interprete.interpretarVarios(texto);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(globalThis.RF = globalThis.RF || {});
