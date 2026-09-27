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

  function porId(id) { return RF.DILEMAS.find(d => d.id === id); }

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
      d = porId(cadena.id);
      // Una continuación que ya no tiene sentido (la persona murió, salió de la cárcel...) no salta.
      try { if (d && d.si && !d.si(e)) d = null; } catch (err) { d = null; }
    } else if (e.dia >= PRIMER_DIA) {
      const desde = e.dia - D.ultimo;
      const candidatos = RF.DILEMAS.filter(x => disponible(e, x));
      const urgentes = candidatos.filter(x => x.urgente && x.si);
      if (urgentes.length && desde >= INTERVALO_URGENTE) d = elegir(urgentes);
      else if (candidatos.length && (desde >= INTERVALO || (desde === INTERVALO - 1 && Math.random() < 0.25))) d = elegir(candidatos);
    }
    if (!d) return null;
    D.pendiente = { id: d.id, dia: e.dia };
    D.ultimo = e.dia;
    D.vistos[d.id] = e.dia;
    return d;
  }

  function pendiente(e) {
    const D = datos(e);
    return D.pendiente ? porId(D.pendiente.id) : null;
  }

  // Lo que el jugador ve debajo de cada opción: "Tesoro −8 · Pueblo +10 · ⚠ Traerá consecuencias".
  function resumen(op) {
    const partes = [];
    for (const s of RF.STATS) {
      const v = op.efectos && op.efectos[s.id];
      if (v) partes.push({ texto: s.nombre + ' ' + (v > 0 ? '+' : '−') + Math.abs(v), tono: v > 0 ? 'sube' : 'baja' });
    }
    if (op.ingresos) partes.push({ texto: 'Ingresos ' + (op.ingresos > 0 ? '+' : '−') + Math.abs(op.ingresos) + '/día', tono: op.ingresos > 0 ? 'sube' : 'baja' });
    for (const [id, v] of Object.entries(op.animo || {})) {
      partes.push({ texto: RF.CIUDADANOS[id].nombre + (v > 0 ? ' ▲' : ' ▼'), tono: v > 0 ? 'sube' : 'baja' });
    }
    if (op.persona) partes.push({ texto: RF.poder.nombreTrato(op.persona.trato) + ': ' + (RF.PERSONAS[op.persona.id].nombre || RF.VARS['n_' + op.persona.id] || RF.CIUDADANOS[op.persona.id] && RF.CIUDADANOS[op.persona.id].nombre), tono: 'aviso' });
    if (op.institucion) for (const [id, que] of Object.entries(op.institucion)) partes.push({ texto: (que === 'disolver' ? 'Disuelve ' : 'Crea ') + RF.INSTITUCIONES[id].corto, tono: 'aviso' });
    if (op.nombrar) partes.push({ texto: 'Nuevo ministro: ' + op.nombrar.nombre, tono: 'aviso' });
    if (op.economia) {
      const a = op.economia;
      if (a.inflacion) partes.push({ texto: 'Inflación ' + (a.inflacion > 0 ? '▲' : '▼'), tono: a.inflacion > 0 ? 'baja' : 'sube' });
      if (a.paro) partes.push({ texto: 'Paro ' + (a.paro > 0 ? '▲' : '▼'), tono: a.paro > 0 ? 'baja' : 'sube' });
      for (const [id, v] of Object.entries(a.sectores || {})) partes.push({ texto: RF.SECTORES[id].nombre + (v > 0 ? ' ▲' : ' ▼'), tono: 'aviso' });
      for (const [id, f] of Object.entries(a.multiplicar || {})) partes.push({ texto: RF.SECTORES[id].nombre + (f > 1 ? ' ▲' : ' ▼'), tono: 'aviso' });
      if (a.cancelarModelo) partes.push({ texto: 'Cancela la reconversión', tono: 'aviso' });
    }
    if (op.programar || op.cadena) partes.push({ texto: '⚠ Traerá consecuencias', tono: 'aviso' });
    return partes;
  }

  function texto(d) { return T.expandir(d.texto, { lider: 'Su Excelencia' }); }

  // Aplica la opción elegida. Devuelve lo que pasó para que el Narrador lo cuente.
  function resolver(e, indice) {
    const D = datos(e);
    const d = pendiente(e);
    if (!d) return null;
    const op = d.opciones[indice];
    if (!op) return null;
    // El resultado se escribe antes de aplicar cambios de personas (para nombrar a quien estaba).
    let resultado = T.expandir(op.resultado || '', { lider: 'Su Excelencia' });
    const textoOpcion = T.expandir(op.texto);
    const deltas = {};
    RF.consejero.aplicarEfectos(e, op.efectos, deltas);
    if (op.economia) RF.economia.ajustar(e, op.economia);
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
    if (op.ingresos) e.ingresos = Math.max(-6, Math.min(6, e.ingresos + op.ingresos));
    for (const [id, v] of Object.entries(op.animo || {})) {
      const c = e.ciudadanos[id];
      if (c) c.animo = Math.max(-100, Math.min(100, c.animo + v));
    }
    if (op.politica) Object.assign(e.politicas, op.politica);
    for (const p of op.programar || []) e.pendientes.push(Object.assign({}, p, { dia: e.dia + p.en, texto: T.expandir(p.texto) }));
    if (op.cadena) D.cadena.push({ id: op.cadena.id, dia: e.dia + op.cadena.en });
    D.pendiente = null;
    e.decisiones = (e.decisiones || 0) + 1;
    const fin = RF.consejero.comprobarFin(e);
    if (fin) e.fin = fin;
    return { dilema: d, opcion: op, textoOpcion, deltas, fin, resultado };
  }

  RF.director = { comprobar, pendiente, resolver, resumen, texto, porId };
})(globalThis.RF = globalThis.RF || {});
