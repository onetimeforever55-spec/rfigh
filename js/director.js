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
    e.decisiones = (e.decisiones || 0) + 1;
    const fin = RF.consejero.comprobarFin(e);
    if (fin) e.fin = fin;
    return { dilema: d, opcion: op, textoOpcion, deltas, fin, resultado };
  }

  RF.director = { comprobar, pendiente, resolver, resumen, texto, porId };
})(globalThis.RF = globalThis.RF || {});
