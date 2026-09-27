/*
 * EL CONSEJERO
 * El país se mide con cuatro cosas:
 *   DINERO       millones de valdos en las arcas (puede quedar en negativo: deuda)
 *   INFLACIÓN    cuánto suben los precios (%)
 *   ESTABILIDAD  si el régimen aguanta (0 = caes)
 *   FELICIDAD    cómo vive la gente (0 = revolución)
 *
 * Cada decreto se convierte en una ley vigente que actúa todos los turnos (ver leyes.js).
 * Además, cada turno, las cuatro cosas se afectan entre sí con una lógica realista:
 *   - El Estado cobra impuestos y paga sueldos. Sin estabilidad se recauda menos.
 *   - La inflación encarece los gastos, se come los ingresos y amarga a la gente.
 *   - Si hay deuda, se paga imprimiendo: más inflación. Y los funcionarios sin cobrar desestabilizan.
 *   - La inflación alta se retroalimenta (la gente espera que suba y sube).
 *   - Con poca felicidad hay protestas: baja la estabilidad.
 *   - Sin leyes que lo empujen, todo tiende poco a poco a la normalidad.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  RF.STATS = [
    { id: 'dinero', nombre: 'Dinero', corto: 'DINERO', formato: 'dinero' },
    { id: 'inflacion', nombre: 'Inflación', corto: 'INFLACIÓN', formato: 'pct' },
    { id: 'estabilidad', nombre: 'Estabilidad', corto: 'ESTABILIDAD', formato: 'barra' },
    { id: 'felicidad', nombre: 'Felicidad', corto: 'FELICIDAD', formato: 'barra' }
  ];

  const INGRESOS_BASE = 20; // impuestos normales por turno (millones)
  const GASTOS_BASE = 20;   // sueldos y servicios del Estado por turno (millones)

  function nuevoEstado() {
    const ciudadanos = {};
    for (const id of Object.keys(RF.CIUDADANOS)) ciudadanos[id] = { animo: 0, hitos: [], ultimaVez: -99, estado: 'libre' };
    const e = {
      version: 2,
      dia: 1,
      stats: { dinero: 100, inflacion: 4, estabilidad: 60, felicidad: 55 },
      acum: {},
      leyes: [],
      pendientes: [],
      historial: [],
      ciudadanos,
      umbrales: {},
      diasSinEvento: 0,
      diasEnQuiebra: 0,
      dilemas: { ultimo: 0, vistos: {}, cadena: [], pendiente: null },
      fin: null
    };
    RF.poder.iniciar(e);
    return e;
  }

  function objetoDe(id) { return id === 'OTRO' || !RF.OBJETOS[id] ? RF.OBJETO_OTRO : RF.OBJETOS[id]; }

  // "la privatización del aire", "el nuevo impuesto a los ricos"...
  function medida(accion, nombreObjeto) {
    return T.expandir(RF.ACCIONES[accion].nominal, { de: T.de(nombreObjeto), a: T.a(nombreObjeto), o: nombreObjeto });
  }

  function sumar(d, k, v) { if (v) d[k] = (d[k] || 0) + v; }

  /*
   * Traduce efectos escritos con las estadísticas antiguas (eventos, sucesos, personas) a las cuatro nuevas.
   * tesoro → dinero · pueblo y salud → felicidad · orden, ejército, cúpula y mundo → estabilidad (el mundo también cuesta dinero)
   */
  function convertir(ef) {
    const d = {};
    for (const [k, v] of Object.entries(ef || {})) {
      if (!v) continue;
      switch (k) {
        case 'tesoro': sumar(d, 'dinero', v * 2); break;
        case 'pueblo': sumar(d, 'felicidad', v); break;
        case 'salud': sumar(d, 'felicidad', v * 0.5); break;
        case 'orden': sumar(d, 'estabilidad', v * 0.6); break;
        case 'ejercito': sumar(d, 'estabilidad', v * 0.4); break;
        case 'cupula': sumar(d, 'estabilidad', v * 0.35); break;
        case 'mundo': sumar(d, 'estabilidad', v * 0.25); sumar(d, 'dinero', v * 0.8); break;
        case 'dinero': case 'inflacion': case 'estabilidad': case 'felicidad': sumar(d, k, v); break;
      }
    }
    return d;
  }

  const LIMITES = { dinero: [-999, 9999], inflacion: [0, 5000], estabilidad: [0, 100], felicidad: [0, 100] };

  // Aplica efectos (acepta los nombres antiguos). Los decimales se acumulan hasta sumar un punto entero.
  function aplicarEfectos(estado, efectos, registro) {
    const ef = convertir(efectos);
    if (!estado.acum) estado.acum = {};
    for (const [k, v] of Object.entries(ef)) {
      if (!(k in estado.stats)) continue;
      estado.acum[k] = (estado.acum[k] || 0) + v;
      const n = Math.trunc(estado.acum[k]);
      if (!n) continue;
      estado.acum[k] -= n;
      const antes = estado.stats[k];
      estado.stats[k] = Math.max(LIMITES[k][0], Math.min(LIMITES[k][1], antes + n));
      if (registro) registro[k] = (registro[k] || 0) + (estado.stats[k] - antes);
    }
  }

  // Qué tal le va a cada ministro con la situación (0-100).
  function lealtad(e, id) {
    const s = e.stats;
    switch (id) {
      case 'cifuentes': return Math.max(0, Math.min(100, 50 + s.dinero / 4 - s.inflacion / 2));
      case 'paredes': case 'ventura': return s.felicidad;
      default: return s.estabilidad;
    }
  }

  const MILITAR = ['EJERCITO', 'ESCUADRON', 'MILICIA', 'ARMAS', 'POLICIA'];
  const SANITARIO = ['SALUD', 'AIRE', 'AGUA', 'COMIDA', 'AMBIENTE', 'VICIOS'];
  const EXTERIOR = ['EXTRANJEROS', 'NARCO', 'RECURSOS', 'TURISMO'];

  // El ministro que reacciona: el de lo que más cambia (contando lo que la ley hará en los próximos turnos).
  function elegirMinistro(res, objId) {
    const total = k => (res.deltas[k] || 0) + 4 * ((res.porTurno || {})[k] || 0);
    const cand = [
      { id: 'cifuentes', v: total('dinero') / 3 - total('inflacion') },
      { id: MILITAR.includes(objId) ? 'garrote' : 'sombra', v: total('estabilidad') },
      { id: 'paredes', v: total('felicidad') }
    ];
    if (SANITARIO.includes(objId)) cand.push({ id: 'ventura', v: total('felicidad') * 1.1 });
    if (EXTERIOR.includes(objId)) cand.push({ id: 'montiel', v: total('estabilidad') * 1.1 });
    let mejor = null;
    for (const c of cand) if (Math.abs(c.v) >= 1 && (!mejor || Math.abs(c.v) > Math.abs(mejor.v))) mejor = c;
    return mejor ? { id: mejor.id, delta: mejor.v } : null;
  }

  function elegirCiudadano(estado, objId) {
    const ids = Object.keys(RF.CIUDADANOS).filter(id => estado.ciudadanos[id].estado === 'libre');
    if (!ids.length) return null;
    const interesados = ids.filter(id => RF.CIUDADANOS[id].intereses.includes(objId));
    const pool = interesados.length ? interesados : ids;
    pool.sort((a, b) => estado.ciudadanos[a].ultimaVez - estado.ciudadanos[b].ultimaVez);
    return T.azar(pool.slice(0, Math.min(2, pool.length)));
  }

  // Un ministro y una persona de la calle reaccionan. La calle mira sobre todo la felicidad.
  function reacciones(estado, res, objId) {
    res.ministro = elegirMinistro(res, objId);
    const impacto = (res.deltas.felicidad || 0) + 3 * ((res.porTurno || {}).felicidad || 0);
    res.impacto = impacto;
    const cid = elegirCiudadano(estado, objId);
    if (!cid) { res.ciudadano = null; return; }
    const interesado = RF.CIUDADANOS[cid].intereses.includes(objId);
    const c = estado.ciudadanos[cid];
    c.animo = Math.max(-100, Math.min(100, c.animo + impacto * (interesado ? 1.5 : 0.8)));
    c.ultimaVez = estado.dia;
    res.ciudadano = { id: cid, sentimiento: impacto > 2 ? 'pos' : impacto < -2 ? 'neg' : 'neu' };
  }

  /*
   * Firma un decreto ya interpretado. Devuelve todo lo que pasó para que el Narrador lo cuente.
   */
  function decretar(estado, interp, op) {
    op = op || {};
    const accion = interp.accion;
    const objId = interp.objeto;
    const o = objetoDe(objId);
    const nombre = interp.nombreObjeto || o.nombre;
    let laMedida = medida(accion, nombre);
    const res = { tipo: 'decreto', dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, deltas: {}, porTurno: null, sucesos: [], notas: [] };
    const inicial = {};

    const def = RF.leyes.definir(accion, objId, nombre);
    if (def && def.nombre) laMedida = def.nombre;
    if (!def) {
      res.notas.push('Este decreto no cambia nada que se pueda medir. Queda en la Gaceta como curiosidad.');
    } else if (def.derogar) {
      const r = RF.leyes.derogar(estado, def.derogar);
      if (!r) { res.nulo = def.derogar === 'ULTIMA' ? 'No hay ninguna ley vigente que derogar.' : 'No hay ninguna ley vigente sobre ' + nombre + ' que derogar.'; return res; }
      laMedida = 'la derogación de ' + r.ley.nombre;
      Object.assign(inicial, r.choque);
      res.derogada = r.ley.nombre;
      if (r.choque.felicidad < 0) res.notas.push('Quitar lo que se había dado duele: la gente lo vive como una pérdida.');
      if (r.choque.felicidad > 0) res.notas.push('La gente respira aliviada.');
    } else if (def.unaVez) {
      Object.assign(inicial, def.inicial);
      res.notas.push(...def.notas);
    } else {
      const p = RF.leyes.promulgar(estado, def, accion, laMedida);
      Object.assign(inicial, p.inicial);
      res.ley = p.ley;
      res.porTurno = RF.leyes.efectoNominal(p.ley);
      res.curvas = p.ley.curvas;
      res.notas.push(...p.notas, ...def.notas);
      if (p.sustituye && RF.ACCIONES[accion].inversa === p.sustituye.accion) sumar(inicial, 'estabilidad', -1);
      if (def.texto) res.especial = def.texto;
    }
    res.medida = laMedida;
    res.vars = { objeto: nombre, Objeto: T.mayus(nombre), medida: laMedida, Medida: T.mayus(laMedida), lider: 'Su Excelencia' };

    // Combinaciones con historia propia ("vender el aire").
    const especial = !res.derogada && RF.ESPECIALES[accion + ':' + objId];
    if (especial) {
      for (const [k, v] of Object.entries(convertir(especial.efectos))) sumar(inicial, k, v);
      if (especial.texto && !res.especial) res.especial = T.expandir(especial.texto, res.vars);
      for (const p of especial.programar || []) estado.pendientes.push(Object.assign({}, p, { texto: T.expandir(p.texto, res.vars), dia: estado.dia + p.en }));
      res.programadas = (especial.programar || []).length;
    }

    const factor = op.secundario ? 0.75 : 1;
    for (const k of Object.keys(inicial)) inicial[k] *= factor;
    aplicarEfectos(estado, inicial, res.deltas);

    estado.historial.push({ dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, medida: laMedida, texto: interp.texto });
    res.numero = estado.historial.length;
    reacciones(estado, res, objId);
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  /*
   * Decreto sobre una persona: "matar a Garrote", "encarcelar a Nico", "premiar a la canciller".
   * Algunos dejan huella varios turnos (un mártir, el miedo en Palacio, el luto de un barrio).
   */
  function decretarPersona(estado, interp, op) {
    op = op || {};
    const t = RF.poder.tratar(estado, interp.persona, interp.trato, interp.caido);
    const res = { dia: estado.dia, tipo: 'persona', persona: interp.persona, trato: interp.trato, deltas: {}, sucesos: [], notas: t.notas.slice(), vars: { lider: 'Su Excelencia' } };
    if (t.nulo) { res.nulo = t.nulo; return res; }
    res.medida = t.medida;
    res.nombreObjeto = t.nombre;
    res.vars = { objeto: t.nombre, Objeto: t.nombre, medida: t.medida, Medida: T.mayus(t.medida), lider: 'Su Excelencia' };
    res.especial = t.texto;
    res.sucesor = t.sucesor || null;
    const factor = op.secundario ? 0.75 : 1;
    const efectos = convertir(t.efectos);
    for (const k of Object.keys(efectos)) efectos[k] *= factor;
    aplicarEfectos(estado, efectos, res.deltas);
    if (t.ley) {
      const p = RF.leyes.promulgar(estado, t.ley, 'PERSONA', t.ley.nombre);
      res.ley = p.ley;
      res.porTurno = RF.leyes.efectoNominal(p.ley);
      res.notas.push('Esto dejará huella durante ' + t.ley.duracion + ' turnos: ' + t.ley.nombre + '.');
    }
    for (const clave of t.derogar || []) RF.leyes.derogar(estado, clave);
    if (t.cadena) estado.dilemas.cadena.push({ id: t.cadena.id, dia: estado.dia + t.cadena.en });
    estado.historial.push({ dia: estado.dia, accion: 'PERSONA', objeto: interp.persona, nombreObjeto: t.nombre, medida: t.medida, texto: interp.texto });
    res.numero = estado.historial.length;
    const tipo = RF.PERSONAS[interp.persona].tipo;
    reacciones(estado, res, tipo === 'opositor' ? 'OPOSICION' : tipo === 'extranjero' ? 'EXTRANJEROS' : 'LIDER');
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  // Pasa un turno: leyes vigentes, economía, consecuencias, personajes, alertas y eventos.
  function avanzarDia(estado, res) {
    const s = estado.stats;
    estado.dia++;

    // 1. Todas las leyes vigentes actúan.
    const L = RF.leyes.turno(estado);
    res.leyesTurno = L.detalle;

    // 2. La economía de fondo y cómo se afectan las cuatro cosas entre sí.
    const ingresos = INGRESOS_BASE * Math.max(0.5, Math.min(1.3, 0.6 + s.estabilidad / 150)) * Math.max(0.4, 1 - s.inflacion / 250);
    const gastos = GASTOS_BASE * (1 + s.inflacion / 100);
    const deuda = s.dinero < 0;
    const presion = L.total.inflacion + (deuda ? Math.min(12, -s.dinero / 15) : 0) + Math.max(0, s.inflacion - 40) * 0.12;
    const nuevaInflacion = Math.max(0, s.inflacion * 0.8 + 0.8 + presion);
    const fondo = {
      dinero: ingresos - gastos,
      felicidad: -Math.max(0, s.inflacion - 8) / 18 + (50 - s.felicidad) * 0.04,
      estabilidad: (50 - s.estabilidad) * 0.03
        + (s.felicidad < 40 ? -(40 - s.felicidad) / 8 : s.felicidad > 70 ? 0.5 : 0)
        + (s.inflacion > 30 ? -(s.inflacion - 30) / 20 : 0)
        + (deuda ? -1 : 0) + (s.dinero < -100 ? -2 : 0)
    };
    res.fondo = fondo;
    res.causas = [];
    if (deuda) res.causas.push('Hay deuda: el Banco Central imprime para pagarla (más inflación) y los funcionarios cobran tarde.');
    if (s.inflacion > 30) res.causas.push('La inflación del ' + Math.round(s.inflacion) + '% encarece todo y amarga a la gente.');
    if (s.felicidad < 40) res.causas.push('La gente está harta: las protestas restan estabilidad cada turno.');
    if (s.inflacion > 40) res.causas.push('Los precios se retroalimentan: todos suben precios porque esperan que suban.');

    const cambio = {
      dinero: fondo.dinero + L.total.dinero,
      inflacion: nuevaInflacion - s.inflacion,
      felicidad: fondo.felicidad + L.total.felicidad,
      estabilidad: fondo.estabilidad + L.total.estabilidad
    };
    res.cambioTurno = {};
    aplicarEfectos(estado, cambio, res.cambioTurno);
    res.balance = cambio.dinero;
    estado.balance = cambio.dinero;
    for (const c of Object.values(estado.ciudadanos)) c.animo = Math.max(-100, Math.min(100, c.animo + (res.cambioTurno.felicidad || 0) * 0.8));

    // 3. Consecuencias programadas que tocan hoy.
    const hoy = estado.pendientes.filter(p => p.dia <= estado.dia);
    estado.pendientes = estado.pendientes.filter(p => p.dia > estado.dia);
    for (const p of hoy) {
      const reg = {};
      aplicarEfectos(estado, p.efectos, reg);
      res.sucesos.push({ tipo: 'consecuencia', titulo: p.titulo, texto: T.expandir(p.texto), deltas: reg });
    }

    // 4. La gente de a pie.
    for (const [id, c] of Object.entries(estado.ciudadanos)) {
      if (c.estado !== 'libre') continue;
      for (const h of RF.CIUDADANOS[id].hitos) {
        if (c.hitos.includes(h.id)) continue;
        if ((h.bajo != null && c.animo <= h.bajo) || (h.alto != null && c.animo >= h.alto)) {
          c.hitos.push(h.id);
          const reg = {};
          aplicarEfectos(estado, h.efectos, reg);
          res.sucesos.push({ tipo: 'hito', titulo: RF.CIUDADANOS[id].nombre, texto: T.expandir(h.texto), deltas: reg });
        }
      }
    }

    // 5. Alertas cuando algo cruza una línea roja.
    for (const u of RF.UMBRALES) {
      const v = s[u.stat];
      const cruza = u.bajo != null ? v < u.bajo : v > u.alto;
      const vuelve = u.bajo != null ? v >= u.bajo + 10 : v <= u.alto * 0.7;
      if (cruza && !estado.umbrales[u.id]) {
        estado.umbrales[u.id] = true;
        const reg = {};
        aplicarEfectos(estado, u.efectos, reg);
        res.sucesos.push({ tipo: 'umbral', titulo: u.titulo, texto: T.expandir(u.texto), deltas: reg });
      } else if (vuelve) estado.umbrales[u.id] = false;
    }

    // 6. Eventos con decisiones y noticias sueltas.
    const dilema = !comprobarFin(estado) && RF.director ? RF.director.comprobar(estado) : null;
    if (dilema) res.dilema = dilema.id;
    if (res.sucesos.length || dilema) estado.diasSinEvento = 0;
    else estado.diasSinEvento++;
    if (!dilema && estado.diasSinEvento >= 4 && Math.random() < 0.4) {
      const ev = T.azar(RF.AZAR);
      const reg = {};
      aplicarEfectos(estado, ev.efectos, reg);
      res.sucesos.push({ tipo: 'azar', titulo: ev.titulo, texto: T.expandir(ev.texto), deltas: reg });
      estado.diasSinEvento = 0;
    }

    // 7. Quiebra y fin.
    estado.diasEnQuiebra = s.dinero <= -150 ? estado.diasEnQuiebra + 1 : 0;
    if (estado.diasEnQuiebra === 1) {
      res.sucesos.push({ tipo: 'umbral', titulo: 'Al borde de la quiebra', texto: T.expandir('{cifuentes} entra sin llamar: "Debemos más de 150 millones y nadie nos presta. Si el turno que viene seguimos así, el país quiebra."'), deltas: {} });
    }
    const fin = comprobarFin(estado);
    if (fin) { estado.fin = fin; res.fin = fin; }
  }

  // Pasar el turno sin firmar nada: las leyes siguen trabajando.
  function pasarTurno(estado) {
    const res = { tipo: 'espera', dia: estado.dia, deltas: {}, sucesos: [], notas: [] };
    avanzarDia(estado, res);
    return res;
  }

  function comprobarFin(estado) {
    const s = estado.stats;
    if (s.estabilidad <= 0) return s.felicidad < 30 ? 'pueblo' : 'ejercito';
    if (s.felicidad <= 0) return 'pueblo';
    if (s.inflacion >= 1000) return 'hiperinflacion';
    if (estado.diasEnQuiebra >= 2) return 'tesoro';
    if (estado.dia > RF.PAIS.dias) {
      if (s.felicidad >= 55) return 'elecciones_ganadas';
      if (s.estabilidad >= 60) return 'elecciones_amanadas';
      return 'elecciones_perdidas';
    }
    return null;
  }

  RF.consejero = { nuevoEstado, decretar, decretarPersona, pasarTurno, avanzarDia, aplicarEfectos, convertir, medida, objetoDe, comprobarFin, lealtad };
})(globalThis.RF = globalThis.RF || {});
