/*
 * EL DIRECTOR DE EVENTOS
 * Decide cuándo salta un dilema (estilo Victoria 2):
 *  - Si hay una continuación pendiente (cadena), salta esa.
 *  - Si algo urgente está pasando (huelga, rumores de golpe...), salta a los 2 días del último evento.
 *  - Si no, más o menos cada 4 días, eligiendo entre los que encajan con la situación.
 * Mientras hay un dilema abierto, no se pueden firmar decretos.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const PRIMER_DIA = 3;
  const INTERVALO = 4;
  const INTERVALO_URGENTE = 2;
  const ENFRIAMIENTO = 10;

  function datos(e) {
    if (!e.dilemas) e.dilemas = { ultimo: 0, vistos: {}, cadena: [], pendiente: null };
    return e.dilemas;
  }

  // Los eventos programados y los que inventa el Consejo de Estado con IA (guardados en la partida).
  function porId(id, e) { return RF.DILEMAS.find(d => d.id === id) || (e && e.dilemas && e.dilemas.custom && e.dilemas.custom[id]) || null; }

  function disponible(e, d) {
    const D = datos(e);
    if (d.soloCadena) return false;
    const visto = D.vistos[d.id];
    if (visto != null && (d.unaVez || e.dia - visto < ENFRIAMIENTO)) return false;
    try { return !d.si || !!d.si(e); } catch (err) { return false; }
  }

  function elegir(lista) {
    const total = lista.reduce((s, d) => s + (d.peso || 1), 0);
    let r = Math.random() * total;
    for (const d of lista) { r -= d.peso || 1; if (r <= 0) return d; }
    return lista[lista.length - 1];
  }

  // Se llama al final de cada día. Devuelve el dilema que salta hoy, o null.
  function comprobar(e) {
    const D = datos(e);
    if (D.pendiente || e.fin) return null;
    let d = null;
    const cadena = D.cadena.find(c => c.dia <= e.dia);
    if (cadena) {
      D.cadena = D.cadena.filter(c => c !== cadena);
      d = porId(cadena.id, e);
      if (d) D.datosCadena = cadena.datos || null;
      // Una continuación que ya no tiene sentido (la persona murió, salió de la cárcel...) no salta.
      try { if (d && d.si && !d.si(e)) d = null; } catch (err) { d = null; }
    } else if (e.dia >= PRIMER_DIA) {
      const desde = e.dia - D.ultimo;
      // Con el Consejo de Estado (IA), los eventos de catálogo solo saltan si la situación los pide (urgentes):
      // los demás los inventa la IA a partir de lo que va pasando.
      const candidatos = RF.DILEMAS.filter(x => disponible(e, x) && (!e.iaActiva || x.urgente));
      const urgentes = candidatos.filter(x => x.urgente && x.si);
      if (urgentes.length && desde >= INTERVALO_URGENTE) d = elegir(urgentes);
      else if (candidatos.length && (desde >= INTERVALO || (desde === INTERVALO - 1 && Math.random() < 0.25))) d = elegir(candidatos);
    }
    if (!d) return null;
    D.pendiente = { id: d.id, dia: e.dia, datos: D.datosCadena || null };
    D.datosCadena = null;
    D.ultimo = e.dia;
    D.vistos[d.id] = e.dia;
    return d;
  }

  function pendiente(e) {
    const D = datos(e);
    return D.pendiente ? porId(D.pendiente.id, e) : null;
  }

  // Lo que el jugador ve debajo de cada opción: "Tesoro −8 · Pueblo +10 · ⚠ Traerá consecuencias".
  function resumen(op) {
    const partes = [];
    const ef = RF.consejero.convertir(op.efectos);
    if (op.economia && op.economia.inflacion) ef.inflacion = (ef.inflacion || 0) + op.economia.inflacion;
    if (op.economia && op.economia.paro) ef.felicidad = (ef.felicidad || 0) - op.economia.paro * 0.5;
    for (const s of RF.STATS) {
      const v = ef[s.id];
      if (!v) continue;
      const n = Math.round(v) || Math.sign(v);
      const bueno = s.id === 'inflacion' ? n < 0 : n > 0;
      partes.push({ texto: s.nombre + ' ' + (n > 0 ? '+' : '−') + Math.abs(n) + (s.id === 'dinero' ? 'M' : s.id === 'inflacion' ? '%' : ''), tono: bueno ? 'sube' : 'baja' });
    }
    if (op.ingresos) partes.push({ texto: (op.ingresos > 0 ? 'Ingreso fijo +' : 'Gasto fijo −') + Math.abs(op.ingresos * 3) + 'M/turno', tono: op.ingresos > 0 ? 'sube' : 'baja' });
    for (const [id, v] of Object.entries(op.animo || {})) {
      partes.push({ texto: RF.CIUDADANOS[id].nombre + (v > 0 ? ' ▲' : ' ▼'), tono: v > 0 ? 'sube' : 'baja' });
    }
    if (op.persona) partes.push({ texto: RF.poder.nombreTrato(op.persona.trato) + ': ' + (RF.PERSONAS[op.persona.id].nombre || RF.VARS['n_' + op.persona.id] || (RF.CIUDADANOS[op.persona.id] && RF.CIUDADANOS[op.persona.id].nombre)), tono: 'aviso' });
    if (op.institucion) for (const id of Object.keys(op.institucion)) partes.push({ texto: 'Disuelve ' + RF.INSTITUCIONES[id].corto, tono: 'aviso' });
    if (op.nombrar) partes.push({ texto: 'Nuevo ministro: ' + op.nombrar.nombre, tono: 'aviso' });
    if (op.economia) {
      const a = op.economia;
      if (a.multiplicar && a.multiplicar.narco) partes.push({ texto: 'Narcotráfico ▼', tono: 'aviso' });
      if (a.sectores) partes.push({ texto: 'Frena la reconversión', tono: 'aviso' });
      if (a.cancelarModelo) partes.push({ texto: 'Cancela la reconversión', tono: 'aviso' });
    }
    if (op.apoyo) partes.push({ texto: 'Apoyo en el Congreso ' + (op.apoyo > 0 ? '▲' : '▼'), tono: op.apoyo > 0 ? 'sube' : 'baja' });
    if (op.aprobar) partes.push({ texto: 'La ley se aprueba', tono: 'aviso' });
    if (op.sistema) partes.push({ texto: 'Régimen: ' + RF.REGIMENES[op.sistema].nombre, tono: 'aviso' });
    if (op.juicio) partes.push({ texto: 'Necesitas un 40% de apoyo o caes', tono: 'aviso' });
    if (op.fin) partes.push({ texto: 'Fin de tu gobierno', tono: 'baja' });
    if (op.programar || op.cadena) partes.push({ texto: '⚠ Traerá consecuencias', tono: 'aviso' });
    return partes;
  }

  // Los ajustes económicos de una opción, traducidos a las leyes vigentes.
  function ajustarEconomia(e, a, deltas) {
    const leyes = RF.leyes.lista(e);
    if (a.inflacion) RF.consejero.aplicarEfectos(e, { inflacion: a.inflacion }, deltas);
    if (a.paro) RF.consejero.aplicarEfectos(e, { felicidad: -a.paro * 0.5 }, deltas);
    if (a.multiplicar && a.multiplicar.narco) {
      const f = a.multiplicar.narco;
      for (const l of leyes.filter(l => l.clave === 'NARCO' || l.modelo === 'narco')) {
        if (f <= 0.3) RF.leyes.derogar(e, l.clave); else l.factor = (l.factor || 1) * f;
      }
    }
    if (a.sectores) for (const l of leyes.filter(l => l.clave === 'MODELO')) l.factor = (l.factor || 1) * 0.8;
    if (a.cancelarModelo) RF.leyes.derogar(e, 'MODELO');
  }

  // Un evento que salta ya mismo por lo que acaba de pasar (el Congreso bloquea una ley, un juicio político...).
  function forzar(e, id, datosEvento) {
    const D = datos(e);
    if (D.pendiente) { if (D.pendiente.id !== id && !D.cadena.some(c => c.id === id)) D.cadena.push({ id, dia: e.dia, datos: datosEvento }); return; }
    D.pendiente = { id, dia: e.dia, datos: datosEvento || null };
    D.ultimo = e.dia;
    D.vistos[id] = e.dia;
  }

  function varsEvento(e) {
    const p = e && e.dilemas && e.dilemas.pendiente;
    const extra = (p && p.datos) || {};
    return { lider: 'Líder Supremo', medida: extra.medida || 'la ley', apoyo: e && e.politica ? Math.round(e.politica.apoyo) + '%' : '' };
  }

  function texto(d, e) { return T.expandir(d.texto, varsEvento(e)); }

  // Aplica la opción elegida. Devuelve lo que pasó para que el Narrador lo cuente.
  function resolver(e, indice) {
    const D = datos(e);
    const d = pendiente(e);
    if (!d) return null;
    const op = d.opciones[indice];
    if (!op) return null;
    // El resultado se escribe antes de aplicar cambios de personas (para nombrar a quien estaba).
    let resultado = T.expandir(op.resultado || '', varsEvento(e));
    const datosEvento = (D.pendiente && D.pendiente.datos) || {};
    const textoOpcion = T.expandir(op.texto);
    const deltas = {};
    RF.consejero.aplicarEfectos(e, op.efectos, deltas);
    if (op.economia) ajustarEconomia(e, op.economia, deltas);
    for (const [id, que] of Object.entries(op.institucion || {})) if (que === 'disolver') RF.poder.disolver(e, id);
    if (op.nombrar) RF.poder.nombrar(e, op.nombrar.cargo, op.nombrar.nombre, op.nombrar.corto);
    if (op.persona) {
      const t = RF.poder.tratar(e, op.persona.id, op.persona.trato);
      if (!t.nulo) {
        RF.consejero.aplicarEfectos(e, t.efectos, deltas);
        if (t.cadena) D.cadena.push({ id: t.cadena.id, dia: e.dia + t.cadena.en });
        if (t.sucesor) resultado += ' Su puesto lo ocupa ' + t.sucesor + '.';
      }
    }
    // Un compromiso de gasto (subir salarios, pagar un préstamo...) se queda como ley vigente.
    if (op.ingresos) {
      const nombre = (op.ingresos > 0 ? 'los ingresos de "' : 'el compromiso de "') + T.expandir(op.texto).toLowerCase() + '"';
      RF.leyes.promulgar(e, { clave: 'EVENTO:' + d.id, porTurno: { dinero: op.ingresos * 3 } }, 'EVENTO', nombre);
    }
    for (const [id, v] of Object.entries(op.animo || {})) {
      const c = e.ciudadanos[id];
      if (c) c.animo = Math.max(-100, Math.min(100, c.animo + v));
    }
    // Una opción que cambia una política deroga la ley que había sobre ese tema.
    for (const objId of Object.keys(op.politica || {})) RF.leyes.derogar(e, objId);
    for (const p of op.programar || []) e.pendientes.push(Object.assign({}, p, { dia: e.dia + p.en, texto: T.expandir(p.texto) }));
    if (op.cadena) D.cadena.push({ id: op.cadena.id, dia: e.dia + op.cadena.en });
    D.pendiente = null;

    // El sistema político.
    const pol = RF.politica.iniciar(e);
    if (op.apoyo) pol.apoyo = Math.max(0, Math.min(100, pol.apoyo + op.apoyo));
    let decreto = null;
    if (op.aprobar && datosEvento.ficha && RF.consejoIA) {
      // La ley del Consejo que había bloqueado el Congreso sale adelante.
      decreto = RF.consejoIA.aprobar(e, datosEvento.ficha);
      for (const [k, v] of Object.entries(decreto.deltas)) deltas[k] = (deltas[k] || 0) + v;
    } else if (op.aprobar && datosEvento.interp) {
      // La ley que había bloqueado el Congreso sale adelante.
      decreto = RF.consejero.decretar(e, datosEvento.interp, { avanzar: false, forzar: true });
      for (const [k, v] of Object.entries(decreto.deltas)) deltas[k] = (deltas[k] || 0) + v;
    }
    let cambio = null;
    if (op.sistema) {
      const r = RF.politica.instaurar(e, op.sistema);
      if (!r.nulo) {
        RF.consejero.aplicarEfectos(e, r.efectos, deltas);
        resultado += ' ' + r.texto;
        cambio = r.cambio;
        if (r.cadena) D.cadena.push({ id: r.cadena.id, dia: e.dia + r.cadena.en });
      }
    }
    if (op.juicio) {
      // El Congreso vota. Con menos del 40% de apoyo, te destituye.
      if (pol.apoyo >= 40) {
        resultado += ' El Congreso vota: ' + Math.round(pol.apoyo) + '% te apoya. Sobrevives al juicio político, tocado pero en pie.';
        RF.consejero.aplicarEfectos(e, { estabilidad: -4 }, deltas);
        pol.apoyo = Math.max(0, pol.apoyo - 10);
      } else {
        resultado += ' El Congreso vota: solo un ' + Math.round(pol.apoyo) + '% te apoya. Quedas destituido.';
        e.fin = 'destituido';
      }
    }
    if (op.fin) e.fin = op.fin;
    e.decisiones = (e.decisiones || 0) + 1;
    // La memoria del mundo: qué decidiste y, si el evento lo trae, qué hay que recordar.
    if (RF.consejoIA) {
      RF.consejoIA.recordar(e, 'Ante "' + d.titulo + '", elegiste: ' + textoOpcion + '.');
      if (op.hecho) RF.consejoIA.recordar(e, op.hecho);
    }
    if (d.ia && D.custom) delete D.custom[d.id];
    const fin = RF.consejero.comprobarFin(e);
    if (fin) e.fin = fin;
    return { dilema: d, opcion: op, textoOpcion, deltas, fin, resultado, decreto, cambio };
  }

  RF.director = { comprobar, pendiente, resolver, resumen, texto, porId, forzar };
})(globalThis.RF = globalThis.RF || {});
