/*
 * EL CONSEJERO
 * Toma el decreto que entendió el Intérprete, calcula sus consecuencias sobre el país,
 * programa efectos para más adelante, mueve a los personajes y decide si el juego termina.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  RF.STATS = [
    { id: 'tesoro', nombre: 'Tesoro', corto: 'TES' },
    { id: 'pueblo', nombre: 'Pueblo', corto: 'PUE' },
    { id: 'ejercito', nombre: 'Ejército', corto: 'EJÉ' },
    { id: 'cupula', nombre: 'Cúpula', corto: 'CÚP' },
    { id: 'salud', nombre: 'Salud', corto: 'SAL' },
    { id: 'orden', nombre: 'Orden', corto: 'ORD' },
    { id: 'mundo', nombre: 'Mundo', corto: 'MUN' }
  ];

  function nuevoEstado() {
    const e = estadoInicial();
    e.eco = RF.economia.nueva();
    RF.poder.iniciar(e);
    return e;
  }

  function estadoInicial() {
    const ciudadanos = {};
    for (const id of Object.keys(RF.CIUDADANOS)) ciudadanos[id] = { animo: 0, hitos: [], ultimaVez: -99 };
    return {
      version: 1,
      dia: 1,
      stats: { tesoro: 60, pueblo: 55, ejercito: 60, cupula: 60, salud: 60, orden: 60, mundo: 50 },
      ingresos: 0,
      pendientes: [],
      historial: [],
      politicas: {},
      repeticiones: {},
      ciudadanos,
      umbrales: {},
      diasSinEvento: 0,
      diasEnQuiebra: 0,
      dilemas: { ultimo: 0, vistos: {}, cadena: [], pendiente: null },
      fin: null
    };
  }

  function objetoDe(id) { return id === 'OTRO' ? RF.OBJETO_OTRO : RF.OBJETOS[id]; }

  // "la privatización del aire", "el nuevo impuesto a los ricos"...
  function medida(accion, nombreObjeto) {
    return T.expandir(RF.ACCIONES[accion].nominal, { de: T.de(nombreObjeto), a: T.a(nombreObjeto), o: nombreObjeto });
  }

  function sumar(d, k, v) { if (v) d[k] = (d[k] || 0) + v; }

  // Consecuencias generales según el tipo de acción y cómo es el objeto.
  function efectosBase(accion, o) {
    const E = o.esencial || 0, R = o.rentable || 0, L = o.libertad || 0, P = o.popular || 0;
    const d = {};
    let ingresos = 0;
    const af = (v) => { if (o.afecta) sumar(d, o.afecta, v); };
    const fac = (v) => { if (o.faccion) sumar(d, o.faccion, v); };

    switch (accion) {
      case 'PROHIBIR':
        sumar(d, 'pueblo', -(3 + 3 * E + 3 * P + 2 * L));
        sumar(d, 'mundo', -(1 + 3 * L));
        sumar(d, 'orden', 2 - 2 * Math.max(E, P));
        sumar(d, 'cupula', -2 * R); sumar(d, 'tesoro', -2 * R);
        if (o.vicio) sumar(d, 'salud', 5);
        if (o.afecta === 'salud') af(-3 * E);
        if (o.afecta === 'orden') af(4);
        fac(-20);
        break;
      case 'OBLIGAR':
        sumar(d, 'pueblo', -(4 + 3 * L) + P);
        sumar(d, 'mundo', -(2 + 2 * L));
        sumar(d, 'orden', 3);
        sumar(d, 'cupula', 2 * R); sumar(d, 'tesoro', R);
        if (o.afecta === 'salud') af(3);
        break;
      case 'PRIVATIZAR':
        sumar(d, 'tesoro', 6 + 6 * R);
        sumar(d, 'pueblo', -(3 + 6 * E));
        sumar(d, 'cupula', 6 + 3 * R);
        sumar(d, 'mundo', 3);
        if (o.afecta === 'salud') af(-4 * E);
        if (R >= 2) ingresos -= 1;
        fac(-10);
        break;
      case 'NACIONALIZAR':
        sumar(d, 'tesoro', -(4 + 2 * R));
        sumar(d, 'pueblo', 2 + 3 * E);
        sumar(d, 'cupula', -(6 + 5 * R));
        sumar(d, 'mundo', -(3 + 3 * R));
        ingresos += R;
        break;
      case 'SUBIR_IMPUESTO':
        ingresos += 1 + Math.ceil(R / 2);
        sumar(d, 'tesoro', 3 + 2 * R);
        if (o.faccion === 'cupula') { sumar(d, 'cupula', -15); sumar(d, 'pueblo', 6); }
        else if (o.vicio) { sumar(d, 'salud', 3); sumar(d, 'pueblo', -4); }
        else { sumar(d, 'pueblo', -(3 + 3 * E + 2 * P)); fac(-8); }
        if (R >= 2) sumar(d, 'mundo', -1);
        break;
      case 'BAJAR_IMPUESTO':
        ingresos -= 1 + Math.ceil(R / 2);
        sumar(d, 'tesoro', -(2 + R));
        if (o.faccion === 'cupula') { sumar(d, 'cupula', 12); sumar(d, 'pueblo', -5); sumar(d, 'mundo', 2); }
        else { sumar(d, 'pueblo', 3 + 2 * E + P); sumar(d, 'cupula', 2); fac(6); }
        break;
      case 'SUBSIDIAR':
        ingresos -= 1 + Math.ceil(E / 2);
        sumar(d, 'tesoro', -(3 + 2 * E));
        sumar(d, 'pueblo', 4 + 3 * E + 2 * P);
        sumar(d, 'cupula', -2);
        if (o.afecta === 'salud') af(3 * E);
        fac(15);
        break;
      case 'CASTIGAR':
        if (!o.gente) { // "castigar el alcohol" = una prohibición con porra
          sumar(d, 'pueblo', -(2 + 2 * P)); sumar(d, 'orden', 3); sumar(d, 'mundo', -2);
          break;
        }
        sumar(d, 'orden', 6);
        sumar(d, 'mundo', -(3 + 3 * L));
        if (o.afecta === 'orden') { sumar(d, 'pueblo', 6); sumar(d, 'mundo', -2); }
        else if (o.faccion) { fac(-25); sumar(d, 'pueblo', -4); }
        else sumar(d, 'pueblo', -(4 + 2 * L));
        if (o.faccion !== 'ejercito') sumar(d, 'ejercito', 3);
        break;
      case 'LEGALIZAR':
        if (o.gente) { sumar(d, 'pueblo', 2); sumar(d, 'orden', -4); sumar(d, 'mundo', 3 + L); fac(8); break; }
        sumar(d, 'pueblo', 2 + 3 * P + 2 * L);
        sumar(d, 'mundo', 1 + 2 * L);
        sumar(d, 'orden', o.vicio ? -3 : -1);
        if (o.vicio) { sumar(d, 'tesoro', 5); sumar(d, 'salud', -3); ingresos += 1; }
        break;
      case 'ENFOCAR':
        break; // la reconversión la calcula la economía
      case 'CREAR':
      case 'INVERTIR':
        sumar(d, 'tesoro', -(8 + 2 * E));
        sumar(d, 'pueblo', 2);
        sumar(d, 'mundo', 1);
        if (o.afecta === 'salud') af(3);
        if (o.faccion === 'ejercito') { fac(12); sumar(d, 'mundo', -4); }
        else fac(8);
        break;
      case 'RECORTAR':
        sumar(d, 'tesoro', 5 + 2 * E);
        ingresos += 1;
        sumar(d, 'pueblo', -(3 + 4 * E));
        sumar(d, 'mundo', 2);
        af(-(4 + 2 * E));
        fac(-18);
        break;
      case 'GLORIFICAR':
        sumar(d, 'tesoro', -4);
        if (o === RF.OBJETOS.LIDER) { sumar(d, 'pueblo', -3); sumar(d, 'orden', 2); sumar(d, 'cupula', 4); sumar(d, 'mundo', -4); }
        else if (o === RF.OBJETOS.CRIMEN || o === RF.OBJETOS.OPOSICION) { sumar(d, 'pueblo', -4); sumar(d, 'cupula', -6); sumar(d, 'mundo', -3); }
        else { sumar(d, 'pueblo', 1 + P); fac(12); af(4); }
        break;
    }
    // Lo desconocido siempre desconcierta un poco al mundo.
    if (o === RF.OBJETO_OTRO) sumar(d, 'mundo', -1);
    return { d, ingresos };
  }

  // Consecuencias con retraso cuando no hay una especial para esa combinación.
  function programarGenericas(accion, o, vars) {
    const E = o.esencial || 0, R = o.rentable || 0, P = o.popular || 0;
    const p = [];
    if (accion === 'PRIVATIZAR' && E >= 2)
      p.push({ en: 3, titulo: 'Mercado negro', texto: 'Surge un mercado negro de {objeto}. Quien puede pagar, paga dos veces. Quien no, se las arregla como puede.', efectos: { orden: -4, salud: o.afecta === 'salud' ? -3 : 0 } });
    if (accion === 'PROHIBIR' && (P >= 2 || o.vicio))
      p.push({ en: 3, titulo: 'Clandestinidad', texto: 'Lo de {objeto} pasa a la clandestinidad. Lo que antes era normal ahora se hace en sótanos, y los sótanos cobran entrada.', efectos: { orden: -4, cupula: 2 } });
    if (accion === 'INVERTIR' || accion === 'CREAR')
      p.push({ en: 4, titulo: 'Los frutos de la inversión', texto: 'Empiezan a notarse los resultados de {medida}. Hasta los más críticos lo reconocen en voz baja.', efectos: { pueblo: 3 + 2 * E, [o.afecta || 'tesoro']: o.afecta ? 6 : 4 }, ingresos: R >= 1 ? 1 : 0 });
    if (accion === 'RECORTAR')
      p.push({ en: 4, titulo: 'La factura del recorte', texto: 'Los efectos de {medida} llegan a la calle: servicios cerrados, colas más largas, gente más cansada.', efectos: { pueblo: -3, [o.afecta || 'orden']: -5 } });
    if (accion === 'CASTIGAR' && o.gente && o.afecta !== 'orden')
      p.push({ en: 3, titulo: 'Miedo', texto: 'El miedo se instala en Valdoria. La gente habla más bajo y mira más veces por encima del hombro.', efectos: { orden: 3, pueblo: -3 } });
    if (accion === 'NACIONALIZAR' && R >= 2)
      p.push({ en: 2, titulo: 'Fuga de capitales', texto: 'Tras {medida}, los inversores sacan su dinero del país. El valdo cae un 20% en una tarde.', efectos: { tesoro: -4, mundo: -2 } });
    return p.map(x => Object.assign({}, x, { texto: T.expandir(x.texto, vars) }));
  }

  function limitar(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function aplicarEfectos(estado, efectos, registro) {
    for (const [k, v] of Object.entries(efectos || {})) {
      if (!v || !(k in estado.stats)) continue;
      const antes = estado.stats[k];
      estado.stats[k] = limitar(antes + v);
      if (registro) registro[k] = (registro[k] || 0) + (estado.stats[k] - antes);
    }
  }

  // El personaje de a pie que protagoniza la escena: alguien a quien le importa el tema.
  function elegirCiudadano(estado, objId) {
    const ids = Object.keys(RF.CIUDADANOS).filter(id => !estado.ciudadanos[id].estado || estado.ciudadanos[id].estado === 'libre');
    if (!ids.length) return null;
    const interesados = ids.filter(id => RF.CIUDADANOS[id].intereses.includes(objId));
    const pool = interesados.length ? interesados : ids;
    pool.sort((a, b) => estado.ciudadanos[a].ultimaVez - estado.ciudadanos[b].ultimaVez);
    const candidatos = pool.slice(0, Math.min(2, pool.length));
    return T.azar(candidatos);
  }

  function elegirMinistro(deltas) {
    let mejor = null, mejorV = 0;
    for (const [id, m] of Object.entries(RF.GABINETE)) {
      for (const s of m.stats) {
        const v = Math.abs(deltas[s] || 0);
        if (v > mejorV) { mejorV = v; mejor = { id, stat: s, delta: deltas[s] }; }
      }
    }
    return mejor;
  }

  function comprobarFin(estado) {
    const s = estado.stats;
    const orden = ['ejercito', 'pueblo', 'cupula', 'mundo', 'orden', 'salud'];
    for (const k of orden) if (s[k] <= 0) return k;
    if (estado.diasEnQuiebra >= 2) return 'tesoro';
    if (estado.dia > RF.PAIS.dias) {
      if (s.pueblo >= 55) return 'elecciones_ganadas';
      if (s.orden >= 55 && s.ejercito >= 50) return 'elecciones_amanadas';
      return 'elecciones_perdidas';
    }
    return null;
  }

  /*
   * Aplica un decreto ya interpretado. Devuelve todo lo que pasó para que el Narrador lo cuente.
   */
  function decretar(estado, interp, op) {
    op = op || {};
    const accion = interp.accion;
    const objId = interp.objeto;
    const o = objetoDe(objId);
    const nombre = interp.nombreObjeto || o.nombre;
    const laMedida = medida(accion, nombre);
    const vars = { objeto: nombre, Objeto: T.mayus(nombre), medida: laMedida, Medida: T.mayus(laMedida), lider: 'Su Excelencia' };
    const clave = accion + ':' + objId;
    const especial = RF.ESPECIALES[clave];
    const res = { dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, medida: laMedida, vars, deltas: {}, sucesos: [], notas: [] };

    // 1. Efectos del decreto: los de una institución sustituyen a los generales.
    const inst = RF.poder.aplicarInstitucion(estado, accion, objId);
    const base = inst ? { d: inst.efectos, ingresos: 0 } : efectosBase(accion, o);
    const efectos = Object.assign({}, base.d);
    if (especial && especial.efectos) for (const [k, v] of Object.entries(especial.efectos)) sumar(efectos, k, v);
    const eco = RF.economia.aplicarDecreto(estado, accion, objId, nombre);
    for (const [k, v] of Object.entries(eco.efectos)) sumar(efectos, k, v);
    if (inst) res.notas.push(...inst.notas);
    res.notas.push(...eco.notas);

    // Repetir el mismo decreto cansa: cada vez hace la mitad de efecto.
    // Y lo que ya se vendió (o expropió) no se puede volver a vender.
    const rep = estado.repeticiones[clave] || 0;
    estado.repeticiones[clave] = rep + 1;
    const yaHecho = (accion === 'PRIVATIZAR' || accion === 'NACIONALIZAR') && estado.politicas[objId] === accion;
    // Varios decretos el mismo día: cada uno extra reparte la atención y pesa menos.
    const factor = interp.intensidad * (yaHecho ? 0.1 : Math.pow(0.5, rep)) * (op.secundario ? 0.75 : 1);
    for (const k of Object.keys(efectos)) efectos[k] = Math.round(efectos[k] * factor);
    if (yaHecho) res.notas.push('Eso ya estaba hecho. El decreto se archiva junto al anterior y apenas cambia nada.');
    else if (rep > 0) res.notas.push(rep === 1 ? 'Ya habías decretado algo así. La gente lo nota menos.' : 'Otra vez lo mismo. Ya casi nadie presta atención.');

    // Contradecirse tiene un precio.
    const previa = estado.politicas[objId];
    if (objId !== 'OTRO' && previa && previa !== accion && RF.ACCIONES[accion].inversa === previa) {
      sumar(efectos, 'mundo', -3); sumar(efectos, 'cupula', -4);
      res.notas.push(`Hace poco decretaste ${medida(previa, nombre)}. Ahora lo contrario. Nadie sabe ya a qué atenerse.`);
      res.contradiccion = true;
    }
    estado.politicas[objId] = accion;

    aplicarEfectos(estado, efectos, res.deltas);
    const ingresosAntes = estado.ingresos;
    estado.ingresos = Math.max(-6, Math.min(6, estado.ingresos + Math.round(base.ingresos * Math.min(1, factor))));
    res.cambioIngresos = estado.ingresos - ingresosAntes;
    if (especial && especial.texto) res.especial = T.expandir(especial.texto, vars);
    if (inst && inst.texto) res.especial = inst.texto;

    // 2. Consecuencias con retraso.
    const programadas = inst ? [] : (especial && especial.programar)
      ? especial.programar.map(p => Object.assign({}, p, { texto: T.expandir(p.texto, vars) }))
      : programarGenericas(accion, o, vars);
    for (const p of programadas) estado.pendientes.push(Object.assign({}, p, { dia: estado.dia + p.en }));
    res.programadas = programadas.length;

    estado.historial.push({ dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, medida: laMedida, texto: interp.texto });
    res.numero = estado.historial.length;

    // 3. Reacciones: un ministro y una persona de la calle.
    reacciones(estado, res, objId, o);

    // 4. Pasa el día (si es el último decreto de la jornada).
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  function reacciones(estado, res, objId, o) {
    res.ministro = elegirMinistro(res.deltas);
    const cid = elegirCiudadano(estado, objId);
    for (const c of Object.values(estado.ciudadanos)) c.animo = Math.max(-100, Math.min(100, c.animo + (res.deltas.pueblo || 0) * 0.35));
    if (!cid) { res.ciudadano = null; return; }
    const interesado = RF.CIUDADANOS[cid].intereses.includes(objId);
    const impacto = (res.deltas.pueblo || 0) + (interesado ? 0.5 * ((res.deltas.salud || 0) + (o && o.faccion === 'pueblo' ? res.deltas.pueblo || 0 : 0)) : 0);
    const c = estado.ciudadanos[cid];
    c.animo = Math.max(-100, Math.min(100, c.animo + impacto * 0.4 + (interesado ? Math.sign(impacto) * 4 : 0)));
    c.ultimaVez = estado.dia;
    res.ciudadano = { id: cid, sentimiento: impacto > 2 ? 'pos' : impacto < -2 ? 'neg' : 'neu' };
  }

  /*
   * Decreto sobre una persona: "matar a Garrote", "encarcelar a Nico", "premiar a la canciller".
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
    const efectos = {};
    for (const [k, v] of Object.entries(t.efectos)) efectos[k] = Math.round(v * factor);
    aplicarEfectos(estado, efectos, res.deltas);
    if (t.cadena) estado.dilemas.cadena.push({ id: t.cadena.id, dia: estado.dia + t.cadena.en });
    estado.historial.push({ dia: estado.dia, accion: 'PERSONA', objeto: interp.persona, nombreObjeto: t.nombre, medida: t.medida, texto: interp.texto });
    res.numero = estado.historial.length;
    const tipo = RF.PERSONAS[interp.persona].tipo;
    reacciones(estado, res, tipo === 'opositor' ? 'OPOSICION' : tipo === 'extranjero' ? 'EXTRANJEROS' : 'LIDER', null);
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  function avanzarDia(estado, res) {
    estado.dia++;
    const economia = {};
    aplicarEfectos(estado, { tesoro: estado.ingresos - 1 }, economia);
    res.economia = economia.tesoro || 0;

    // Desgaste del poder: la paciencia se agota y la euforia se enfría.
    const desgaste = { pueblo: -1 };
    for (const [k, v] of Object.entries(estado.stats)) if (v > 75) sumar(desgaste, k, -2);
    aplicarEfectos(estado, desgaste);

    // Economía (mercado, reconversión, paro, inflación...) e instituciones del régimen.
    const diario = {};
    const eco = RF.economia.dia(estado, res);
    const inst = RF.poder.dia(estado, res);
    for (const r of [eco, inst]) for (const [k, v] of Object.entries(r)) diario[k] = (diario[k] || 0) + v;
    res.economia += diario.tesoro || 0;
    delete diario.tesoro;
    res.diario = diario;

    // Consecuencias que tocan hoy.
    const hoy = estado.pendientes.filter(p => p.dia <= estado.dia);
    estado.pendientes = estado.pendientes.filter(p => p.dia > estado.dia);
    for (const p of hoy) {
      const reg = {};
      aplicarEfectos(estado, p.efectos, reg);
      if (p.ingresos) estado.ingresos = Math.max(-6, Math.min(6, estado.ingresos + p.ingresos));
      res.sucesos.push({ tipo: 'consecuencia', titulo: p.titulo, texto: p.texto, deltas: reg });
    }

    // Hitos de la gente de a pie.
    for (const [id, c] of Object.entries(estado.ciudadanos)) {
      if (c.estado && c.estado !== 'libre') continue;
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

    // Umbrales: cuando algo cae por debajo de 25.
    for (const [k, u] of Object.entries(RF.UMBRALES)) {
      if (estado.stats[k] < 25 && !estado.umbrales[k]) {
        estado.umbrales[k] = true;
        const reg = {};
        aplicarEfectos(estado, u.efectos, reg);
        if (u.ingresos) estado.ingresos = Math.max(-6, estado.ingresos + u.ingresos);
        res.sucesos.push({ tipo: 'umbral', titulo: u.titulo, texto: T.expandir(u.texto), deltas: reg });
      } else if (estado.stats[k] >= 35) {
        estado.umbrales[k] = false;
      }
    }

    // Dilemas (eventos con decisiones): el Director decide si hoy salta uno.
    const dilema = !comprobarFin(estado) && RF.director ? RF.director.comprobar(estado) : null;
    if (dilema) res.dilema = dilema.id;

    // Noticias sueltas: si lleva días tranquilo y hoy no hay dilema, mete un suceso.
    if (res.sucesos.length || dilema) estado.diasSinEvento = 0;
    else estado.diasSinEvento++;
    if (!dilema && estado.diasSinEvento >= 3 && Math.random() < 0.45) {
      const media = RF.STATS.reduce((s, x) => s + estado.stats[x.id], 0) / RF.STATS.length;
      const tono = media < 35 ? 1 : media > 60 ? -1 : 0;
      const pool = tono ? RF.AZAR.filter(e => e.tono === tono) : RF.AZAR;
      const ev = T.azar(pool);
      const reg = {};
      aplicarEfectos(estado, ev.efectos, reg);
      res.sucesos.push({ tipo: 'azar', titulo: ev.titulo, texto: T.expandir(ev.texto), deltas: reg });
      estado.diasSinEvento = 0;
    }

    estado.diasEnQuiebra = estado.stats.tesoro <= 0 ? estado.diasEnQuiebra + 1 : 0;
    if (estado.stats.tesoro <= 0 && estado.diasEnQuiebra === 1) {
      res.sucesos.push({ tipo: 'umbral', titulo: 'Al borde de la quiebra', texto: T.expandir('{cifuentes} entra sin llamar: "No queda un valdo. Si mañana seguimos así, el país quiebra."'), deltas: {} });
    }

    const fin = comprobarFin(estado);
    if (fin) { estado.fin = fin; res.fin = fin; }
  }

  RF.consejero = { nuevoEstado, decretar, decretarPersona, avanzarDia, aplicarEfectos, medida, objetoDe, comprobarFin };
})(globalThis.RF = globalThis.RF || {});
