/*
 * EL CONSEJERO
 * El país se mide con cuatro cosas:
 *   DINERO       millones de wones en las arcas (puede quedar en negativo: deuda)
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

  // Las tres barras de arriba (los nombres vienen del país) y la población, que no tiene barra:
  // es el ánimo de la gente y se ve en su sección del texto.
  const B = RF.PAIS.barras, SEC = RF.PAIS.sectores;
  RF.STATS = [
    { id: 'dinero', nombre: B.dinero.nombre, corto: B.dinero.corto, formato: 'dinero' },
    { id: 'inflacion', nombre: B.inflacion.nombre, corto: B.inflacion.corto, formato: 'pct' },
    { id: 'estabilidad', nombre: B.estabilidad.nombre, corto: B.estabilidad.corto, formato: 'barra' },
    { id: 'felicidad', nombre: SEC.poblacion.nombre, corto: SEC.poblacion.nombre.toUpperCase(), formato: 'barra', oculta: true }
  ];
  // Sectores con ánimo propio (0-100) que empujan la estabilidad cada turno. La población usa "felicidad".
  RF.SECTORES = [
    { id: 'ejercito', nombre: SEC.ejercito.nombre },
    { id: 'elite', nombre: SEC.elite.nombre }
  ];
  const ES_SECTOR = new Set(['ejercito', 'elite']);

  function nuevoEstado() {
    const ciudadanos = {};
    for (const id of Object.keys(RF.CIUDADANOS)) ciudadanos[id] = { animo: 0, hitos: [], ultimaVez: -99, estado: 'libre' };
    const e = {
      version: 2,
      dia: 1,
      pais: RF.PAIS.id,
      stats: Object.assign({}, RF.PAIS.inicio.stats),
      sectores: Object.assign({}, RF.PAIS.inicio.sectores),
      economia: Object.assign({}, RF.PAIS.inicio.economia),
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
    RF.politica.iniciar(e);
    if (RF.diplomacia) RF.diplomacia.iniciar(e);
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
   * tesoro → dinero · pueblo y salud → felicidad (la población) · orden → estabilidad · ejército → ánimo del ejército
   * cúpula → ánimo del Palacio · mundo → estabilidad y dinero
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
        // El ejército y la cúpula son sectores con ánimo propio: su ánimo empuja la estabilidad cada turno.
        case 'ejercito': sumar(d, 'ejercito', v); break;
        case 'cupula': case 'elite': sumar(d, 'elite', v); break;
        case 'mundo': sumar(d, 'estabilidad', v * 0.25); sumar(d, 'dinero', v * 0.8); break;
        case 'dinero': case 'inflacion': case 'estabilidad': case 'felicidad': sumar(d, k, v); break;
        case 'poblacion': sumar(d, 'felicidad', v); break;
      }
    }
    return d;
  }

  const LIMITES = { dinero: [-999, 9999], inflacion: [0, 5000], estabilidad: [0, 100], felicidad: [0, 100], ejercito: [0, 100], elite: [0, 100] };

  // Sectores y economía de partidas guardadas antes de que existieran.
  function asegurar(estado) {
    if (!estado.sectores) estado.sectores = Object.assign({}, RF.PAIS.inicio.sectores);
    if (!estado.economia) estado.economia = Object.assign({}, RF.PAIS.inicio.economia);
    return estado;
  }

  // Sanciones (0-4) y mercado negro (0-100): los cambian los decretos, los eventos y la IA.
  function ajustarEconomia(estado, cambios, notas) {
    const ec = asegurar(estado).economia;
    if (cambios.sanciones) {
      const antes = ec.sanciones;
      ec.sanciones = Math.max(0, Math.min(4, ec.sanciones + Math.round(cambios.sanciones)));
      if (notas && ec.sanciones !== antes) notas.push(ec.sanciones > antes ? 'Suben las sanciones internacionales (nivel ' + ec.sanciones + ' de 4): costarán divisas cada turno.' : 'Se alivian las sanciones (nivel ' + ec.sanciones + ' de 4).');
    }
    if (cambios.mercadoNegro) {
      ec.mercadoNegro = Math.max(0, Math.min(100, ec.mercadoNegro + cambios.mercadoNegro));
      if (notas) notas.push('El mercado negro pasa a mover el ' + Math.round(ec.mercadoNegro) + '% de la economía.');
    }
  }

  // Aplica efectos (acepta los nombres antiguos). Los decimales se acumulan hasta sumar un punto entero.
  function aplicarEfectos(estado, efectos, registro) {
    const ef = convertir(efectos);
    if (!estado.acum) estado.acum = {};
    asegurar(estado);
    for (const [k, v] of Object.entries(ef)) {
      const donde = ES_SECTOR.has(k) ? estado.sectores : k in estado.stats ? estado.stats : null;
      if (!donde) continue;
      estado.acum[k] = (estado.acum[k] || 0) + v;
      const n = Math.trunc(estado.acum[k]);
      if (!n) continue;
      estado.acum[k] -= n;
      const antes = donde[k];
      donde[k] = Math.max(LIMITES[k][0], Math.min(LIMITES[k][1], antes + n));
      if (registro) registro[k] = (registro[k] || 0) + (donde[k] - antes);
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
    if (interp.tipo === 'diplomacia') return decretarDiplomacia(estado, interp, op);
    const antesRel = RF.diplomacia ? Object.assign({}, RF.diplomacia.iniciar(estado).relaciones) : null;
    const accion = interp.accion;
    const objId = interp.objeto;
    const o = objetoDe(objId);
    const nombre = interp.nombreObjeto || o.nombre;
    let laMedida = medida(accion, nombre);
    const res = { tipo: 'decreto', dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, deltas: {}, porTurno: null, sucesos: [], notas: [] };
    const inicial = {};

    // El sistema político: disolver el Congreso, comprar jueces, proclamarse rey...
    const pol = RF.politica.decreto(estado, accion, objId, nombre);
    let def = null;
    if (pol) {
      if (pol.nulo) { res.nulo = pol.nulo; return res; }
      laMedida = pol.medida;
      Object.assign(inicial, pol.efectos);
      res.especial = pol.texto;
      res.notas.push(...(pol.notas || []));
      res.cambioRegimen = pol.cambio || null;
      res.politico = true;
      if (pol.ley) { const pl = RF.leyes.promulgar(estado, pol.ley, 'POLITICA', pol.ley.nombre); res.ley = pl.ley; res.porTurno = RF.leyes.efectoNominal(pl.ley); }
      if (pol.secreto) RF.politica.registrarSecreto(estado, pol.secreto);
      if (pol.cadena) estado.dilemas.cadena.push({ id: pol.cadena.id, dia: estado.dia + pol.cadena.en });
    } else {
      def = RF.TEMAS && RF.TEMAS[objId] ? RF.leyes.definirTema(estado, objId, accion) : RF.leyes.definir(accion, objId, nombre);
      if (def && def.nombre) laMedida = def.nombre;
    }
    if (pol) {
      res.politico = true;
    } else if (!def) {
      res.notas.push('Este decreto no cambia nada que se pueda medir. Queda en la Gaceta como curiosidad.');
    } else if (def.derogar) {
      const r = RF.leyes.derogar(estado, def.derogar);
      if (!r) { res.nulo = def.derogar === 'ULTIMA' ? 'No hay ninguna ley vigente que derogar.' : 'No hay ninguna ley vigente sobre ' + nombre + ' que derogar.'; return res; }
      laMedida = 'la derogación de ' + r.ley.nombre;
      Object.assign(inicial, r.choque);
      res.derogada = r.ley.nombre;
      if (r.choque.felicidad < 0) res.notas.push('Quitar lo que se había dado duele: la gente lo vive como una pérdida.');
      if (r.choque.felicidad > 0) res.notas.push('La gente respira aliviada.');
      const lat = RF.politica.efectoLateral(estado, 'DEROGAR', r.ley.clave);
      if (lat) res.cambioRegimen = lat;
    } else if (def.unaVez) {
      Object.assign(inicial, def.inicial);
      res.notas.push(...def.notas);
      if (def.economia) ajustarEconomia(estado, def.economia, res.notas);
      if (def.relaciones && RF.diplomacia) res.relaciones = RF.diplomacia.ajustar(estado, def.relaciones, res.notas);
    } else if (!op.forzar && RF.politica.bloquea(estado, def, accion, objId, interp)) {
      // En democracia, el Congreso puede tumbar una ley polémica si no tienes votos.
      res.bloqueada = true;
      RF.director.forzar(estado, 'congreso_bloquea', { interp: Object.assign({}, interp), medida: laMedida });
      res.dilema = 'congreso_bloquea';
      res.notas.push('La ley necesita pasar por el Congreso y no tienes votos: solo cuentas con el ' + Math.round(estado.politica.apoyo) + '% de apoyo.');
    } else {
      // Represión en secreto: la gente no sabe lo que pasa (todavía).
      if (interp.secreto && accion === 'CASTIGAR' && o.gente) {
        if (def.porTurno.felicidad) def.porTurno.felicidad *= 0.4;
        if (def.inicial.felicidad) def.inicial.felicidad *= 0.3;
        def.secreta = true;
        laMedida = 'la persecución secreta ' + T.de(nombre);
        RF.politica.registrarSecreto(estado, { tipo: 'represion', descripcion: laMedida, gravedad: 3, clave: def.clave });
        res.secreto = true;
        res.notas.push('Nadie lo sabe... todavía. Cada turno existe la posibilidad de que salga a la luz.');
      }
      const p = RF.leyes.promulgar(estado, def, accion, laMedida);
      Object.assign(inicial, p.inicial);
      res.ley = p.ley;
      res.porTurno = RF.leyes.efectoNominal(p.ley);
      res.curvas = p.ley.curvas;
      res.notas.push(...p.notas, ...def.notas);
      if (p.sustituye && RF.ACCIONES[accion].inversa === p.sustituye.accion) sumar(inicial, 'estabilidad', -1);
      if (def.texto) res.especial = def.texto;
      // Lo que traen los temas duros más adelante (sanciones, fugas, inundaciones...).
      for (const pr of def.programar || []) estado.pendientes.push({ dia: estado.dia + pr.en, titulo: pr.titulo, texto: T.expandir(pr.texto), efectos: pr.efectos });
      if ((def.programar || []).length) res.programadas = def.programar.length;
      if (def.economia) ajustarEconomia(estado, def.economia, res.notas);
      if (def.relaciones && RF.diplomacia) res.relaciones = RF.diplomacia.ajustar(estado, def.relaciones, res.notas);
      RF.politica.tras(estado, def, accion, objId);
      const lat = RF.politica.efectoLateral(estado, accion, objId);
      if (lat) res.cambioRegimen = lat;
    }
    res.medida = laMedida;
    if (def && def.prensa) res.prensa = def.prensa;
    // Un cambio de régimen con padrino extranjero: el padrino lo agradece; sus rivales, no tanto.
    if (interp.padrino && res.cambioRegimen && RF.diplomacia) {
      const pad = interp.padrino, P = RF.PAIS.relaciones[pad];
      const cambios = { [pad]: 12 };
      if (pad !== 'china') cambios.china = -6; else cambios.eeuu = -6;
      RF.diplomacia.ajustar(estado, cambios, res.notas);
      res.notas.push('Lo haces con el apoyo de ' + P.nombre + ': en su capital lo celebran como un éxito propio. ' + (pad !== 'china' ? 'En Pekín, no tanto.' : 'En Washington, no tanto.'));
      aplicarEfectos(estado, pad === 'eeuu' ? { dinero: 10, ejercito: -4 } : { dinero: 5 }, res.deltas);
    }
    // El arsenal nuclear, y el país contra el que apunta un misil o una guerra ("lanzar un misil a Japón").
    if (RF.diplomacia && interp.tema && !res.bloqueada) {
      const D = RF.diplomacia.iniciar(estado);
      if (interp.tema === 'NUCLEAR') D.arsenal = accion !== 'PROHIBIR';
      const blanco = ['MISILES', 'GUERRA', 'NUCLEAR'].includes(interp.tema) && accion !== 'PROHIBIR' && RF.diplomacia.objetivo(T.normalizar(interp.texto || ''));
      if (blanco) {
        const extra = RF.diplomacia.ajustar(estado, { [blanco]: interp.tema === 'GUERRA' ? -25 : -12 }, res.notas);
        res.relaciones = Object.assign(res.relaciones || {}, { [blanco]: ((res.relaciones || {})[blanco] || 0) + (extra[blanco] || 0) });
      }
    }
    res.vars = { objeto: nombre, Objeto: T.mayus(nombre), medida: laMedida, Medida: T.mayus(laMedida), lider: 'Líder Supremo' };

    // Combinaciones con historia propia ("vender el aire").
    const especial = !res.derogada && RF.ESPECIALES[accion + ':' + objId];
    if (especial) {
      for (const [k, v] of Object.entries(convertir(especial.efectos))) sumar(inicial, k, v);
      if (especial.texto && !res.especial) res.especial = T.expandir(especial.texto, res.vars);
      for (const p of especial.programar || []) estado.pendientes.push(Object.assign({}, p, { texto: T.expandir(p.texto, res.vars), dia: estado.dia + p.en }));
      res.programadas = (especial.programar || []).length;
    }

    // Decretos sobre algo que el juego no conoce: el Estado los cumple con una lógica absurda pero coherente.
    const grupo = { PROHIBIR: 'prohibir', CASTIGAR: 'prohibir', OBLIGAR: 'obligar', CREAR: 'crear', INVERTIR: 'crear', GLORIFICAR: 'crear', SUBSIDIAR: 'crear', LEGALIZAR: 'crear', ENFOCAR: 'crear', PRIVATIZAR: 'vender', SUBIR_IMPUESTO: 'impuesto' }[accion];
    const logica = (objId === 'OTRO' || ['CALENDARIO', 'ROPA', 'MASCOTAS'].includes(objId)) && !especial && !res.derogada && !res.bloqueada && def && !def.derogar && RF.ABSURDO.logica[grupo];
    if (logica) {
      if (!res.especial) res.especial = T.expandir(T.azar(logica.gaceta), res.vars);
      const c = T.azar(logica.consecuencias);
      estado.pendientes.push({ dia: estado.dia + c.en, titulo: T.expandir(c.titulo, res.vars), texto: T.expandir(T.azar(c.textos), res.vars), efectos: c.efectos });
      res.programadas = 1;
    }

    const factor = op.secundario ? 0.75 : 1;
    for (const k of Object.keys(inicial)) inicial[k] *= factor;
    aplicarEfectos(estado, inicial, res.deltas);

    // Lo que ha cambiado en las relaciones exteriores con este decreto (venga de donde venga).
    if (antesRel) {
      const ahora = estado.diplomacia.relaciones, dif = {};
      for (const k of Object.keys(ahora)) { const d = Math.round(ahora[k] - antesRel[k]); if (d) dif[k] = d; }
      res.relaciones = Object.keys(dif).length ? dif : null;
    }
    estado.historial.push({ dia: estado.dia, accion, objeto: objId, nombreObjeto: nombre, medida: laMedida, texto: interp.texto });
    res.numero = estado.historial.length;
    reacciones(estado, res, objId);
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  /*
   * Decreto sobre una persona: "matar a Jang", "encarcelar a Chol-su", "premiar a la canciller".
   * Algunos dejan huella varios turnos (un mártir, el miedo en Palacio, el luto de un barrio).
   */
  function decretarPersona(estado, interp, op) {
    op = op || {};
    const t = RF.poder.tratar(estado, interp.persona, interp.trato, interp.caido, interp.secreto);
    const res = { dia: estado.dia, tipo: 'persona', persona: interp.persona, trato: interp.trato, deltas: {}, sucesos: [], notas: t.notas.slice(), vars: { lider: 'Líder Supremo' } };
    if (t.nulo) { res.nulo = t.nulo; return res; }
    res.medida = t.medida;
    res.nombreObjeto = t.nombre;
    res.vars = { objeto: t.nombre, Objeto: t.nombre, medida: t.medida, Medida: T.mayus(t.medida), lider: 'Líder Supremo' };
    res.especial = t.texto;
    res.sucesor = t.sucesor || null;
    // En democracia, un crimen a la vista de todos pesa más.
    const tipoPersona = RF.PERSONAS[interp.persona].tipo;
    const publico = !t.secreto && (interp.trato === 'matar' || (['encarcelar', 'exiliar'].includes(interp.trato) && tipoPersona !== 'ciudadano'));
    const factor = (op.secundario ? 0.75 : 1) * (publico && RF.politica.esDemocracia(estado) ? 1.3 : 1);
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
    if (t.secreto) {
      RF.politica.registrarSecreto(estado, t.secreto);
      res.secreto = true;
      res.notas.push('Oficialmente fue un accidente. Cada turno existe la posibilidad de que se descubra la verdad.');
    } else if (publico) {
      const gravedad = { opositor: 3, extranjero: 3, ministro: 2, ciudadano: 2 }[tipoPersona] || 2;
      if (RF.politica.crimenPublico(estado, gravedad)) {
        res.dilema = 'juicio_politico';
        res.notas.push('En una democracia, hacer esto a la vista de todos tiene un precio: el Congreso abre un juicio político contra ti.');
      }
    }
    if (t.cadena) estado.dilemas.cadena.push({ id: t.cadena.id, dia: estado.dia + t.cadena.en });
    estado.historial.push({ dia: estado.dia, accion: 'PERSONA', objeto: interp.persona, nombreObjeto: t.nombre, medida: t.medida, texto: interp.texto });
    res.numero = estado.historial.length;
    const tipo = RF.PERSONAS[interp.persona].tipo;
    reacciones(estado, res, tipo === 'opositor' ? 'OPOSICION' : tipo === 'extranjero' ? 'EXTRANJEROS' : 'LIDER');
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  /*
   * Un gesto diplomático: "negociar con Estados Unidos", "insultar a Japón", "pedir ayuda a China".
   * Cambia relaciones (y a veces divisas, precios o el ánimo del ejército) y queda en el historial.
   */
  function decretarDiplomacia(estado, interp, op) {
    const g = RF.diplomacia.gesto(estado, interp.pais, interp.dir);
    const nombre = RF.PAIS.relaciones[interp.pais].nombre;
    const res = { tipo: 'diplomacia', dia: estado.dia, pais: interp.pais, dir: interp.dir, deltas: {}, porTurno: null, sucesos: [], notas: g.notas.slice(),
      medida: g.medida, nombreObjeto: nombre, especial: g.texto };
    res.vars = { objeto: nombre, Objeto: nombre, medida: g.medida, Medida: T.mayus(g.medida), lider: 'Líder Supremo' };
    const efectos = convertir(g.efectos);
    if (op.secundario) for (const k of Object.keys(efectos)) efectos[k] *= 0.75;
    aplicarEfectos(estado, efectos, res.deltas);
    res.relaciones = RF.diplomacia.ajustar(estado, g.relaciones, res.notas);
    if (g.sanciones) ajustarEconomia(estado, { sanciones: g.sanciones }, res.notas);
    estado.historial.push({ dia: estado.dia, accion: 'DIPLOMACIA', objeto: interp.pais, nombreObjeto: nombre, medida: g.medida, texto: interp.texto });
    res.numero = estado.historial.length;
    reacciones(estado, res, 'EXTRANJEROS');
    if (op.avanzar !== false) avanzarDia(estado, res);
    return res;
  }

  // Pasa un turno: leyes vigentes, economía, consecuencias, personajes, alertas y eventos.
  function avanzarDia(estado, res) {
    const s = estado.stats;
    asegurar(estado);
    const sec = estado.sectores, ec = estado.economia, P = RF.PAIS.economia;
    estado.dia++;

    // 1. Todas las leyes vigentes actúan.
    const L = RF.leyes.turno(estado);
    res.leyesTurno = L.detalle;

    // 2. La economía de fondo y cómo se afectan las cuatro cosas entre sí.
    const m = RF.politica.mods(estado);
    // Lo que va por el mercado negro no paga impuestos; las sanciones cuestan divisas cada turno.
    const ingresos = P.ingresos * (1 - ec.mercadoNegro / 200) * m.recaudacion * Math.max(0.5, Math.min(1.3, 0.6 + s.estabilidad / 150)) * Math.max(0.4, 1 - s.inflacion / 250);
    const gastos = P.gastos * (1 + s.inflacion / 100);
    const sanciones = ec.sanciones * P.costeSancion;
    const miedo = RF.leyes.miedo(estado);
    const crisis = { total: 0, lista: [] };
    const golpe = (v, t) => { crisis.total += v; crisis.lista.push(t); };
    if (sec.ejercito <= 10) golpe((11 - sec.ejercito) * 0.6, 'El ejército está al borde del golpe: los cuarteles no obedecen y la estabilidad se desploma.');
    if (sec.elite <= 10) golpe((11 - sec.elite) * 0.5, 'El Palacio conspira abiertamente: la estabilidad se desploma.');
    if (s.felicidad <= 10) golpe((11 - s.felicidad) * 0.6 * (1 - miedo), 'La población está en las calles' + (miedo > 0.3 ? ', aunque el miedo contiene a muchos' : '') + ': la estabilidad se desploma.');
    if (s.inflacion >= 200) golpe(Math.min(8, (s.inflacion - 150) / 60), 'Hiperinflación: nadie acepta wones y el Estado no puede pagar a nadie.');
    if (estado.diasEnQuiebra >= 1) golpe(4 + 2 * estado.diasEnQuiebra, 'Quiebra: no hay con qué pagar a soldados ni funcionarios.');
    res.miedo = miedo;
    const deuda = s.dinero < 0;
    const presion = L.total.inflacion + (deuda ? Math.min(12, -s.dinero / 15) : 0) + Math.max(0, s.inflacion - 40) * 0.12;
    const nuevaInflacion = Math.max(0, s.inflacion * 0.8 + 0.8 + presion);
    const fondo = {
      dinero: ingresos - gastos + m.dineroTurno - sanciones,
      // El mercado negro ayuda a la gente a sobrevivir cuando el Estado no llega.
      felicidad: -Math.max(0, s.inflacion - 8) / 18 + (50 - s.felicidad) * 0.04 + m.felicidadTurno + (ec.mercadoNegro - 40) / 100,
      // La estabilidad depende de los tres sectores: la población, el ejército y el Palacio.
      // El miedo (la represión) tapa el descontento de la gente: estabilidad artificial.
      estabilidad: (m.estabilidadBase - s.estabilidad) * 0.03
        + (s.felicidad < 40 ? -(40 - s.felicidad) / 8 * (1 - miedo) : s.felicidad > 70 ? 0.5 : 0)
        + (sec.ejercito - 50) * 0.04 + (sec.elite - 50) * 0.03
        + (s.inflacion > 30 ? -(s.inflacion - 30) / 20 : 0)
        + (deuda ? -1 : 0) + (s.dinero < -100 ? -2 : 0)
        // Crisis: ya no terminan la partida por sí solas, pero hunden la estabilidad hasta que caes.
        - crisis.total,
      // Los sectores vuelven poco a poco a su punto de equilibrio. Sin sueldo, el ejército se enfada;
      // sin lujos importados, la élite también. Los cuadros viven de los sobornos del mercado negro.
      ejercito: (50 - sec.ejercito) * 0.04 + (deuda ? -1.5 : 0) + (s.inflacion > 30 ? -0.5 : 0) + (RF.politica.regimen(estado) === 'JUNTA' ? 0.5 : 0),
      elite: (50 - sec.elite) * 0.04 + (deuda ? -0.5 : 0) - ec.sanciones * 0.2 + (ec.mercadoNegro > 50 ? 0.3 : 0)
    };
    res.fondo = fondo;
    res.causas = [];
    if (deuda) res.causas.push('Hay deuda: el Banco Central imprime para pagarla (más inflación) y los soldados y funcionarios cobran tarde.');
    if (sanciones) res.causas.push('Sanciones de nivel ' + ec.sanciones + ': cuestan ' + Math.round(sanciones * 10) / 10 + 'M de divisas cada turno y la élite se queda sin lujos.');
    if (sec.ejercito < 30) res.causas.push('El ejército está descontento: resta estabilidad cada turno. Si se hunde, empujará al golpe.');
    if (sec.elite < 30) res.causas.push('En Palacio se conspira: la élite resta estabilidad cada turno. Si se hunde, te traicionarán.');
    if (s.inflacion > 30) res.causas.push('La inflación del ' + Math.round(s.inflacion) + '% encarece todo y amarga a la gente.');
    if (s.felicidad < 40) res.causas.push(miedo >= 0.3 ? 'La población no aguanta más, pero la represión la mantiene callada: el descontento apenas resta estabilidad.' : 'La población no aguanta más: el descontento resta estabilidad cada turno.');
    res.causas.push(...crisis.lista);
    if (s.inflacion > 40) res.causas.push('Los precios se retroalimentan: todos suben precios porque esperan que suban.');

    // Las potencias vecinas: comercio con China, petróleo, ayuda del Sur, sanciones de Washington.
    const ext = RF.diplomacia ? RF.diplomacia.turno(estado, res) : { dinero: 0, inflacion: 0, felicidad: 0, elite: 0 };
    res.exterior = ext;
    const cambio = {
      dinero: fondo.dinero + L.total.dinero + ext.dinero,
      inflacion: nuevaInflacion - s.inflacion + ext.inflacion,
      felicidad: fondo.felicidad + L.total.felicidad + ext.felicidad,
      estabilidad: fondo.estabilidad + L.total.estabilidad,
      ejercito: fondo.ejercito + (L.total.ejercito || 0),
      elite: fondo.elite + (L.total.elite || 0) + ext.elite
    };
    res.cambioTurno = {};
    aplicarEfectos(estado, cambio, res.cambioTurno);
    res.balance = cambio.dinero;
    estado.balance = cambio.dinero;
    for (const c of Object.values(estado.ciudadanos)) c.animo = Math.max(-100, Math.min(100, c.animo + (res.cambioTurno.felicidad || 0) * 0.8));

    if (estado.politica.regimen !== 'DEMOCRACIA') res.causas.push(m.nombre + ': recaudación ' + Math.round(m.recaudacion * 100) + '%, ' + (m.dineroTurno < 0 ? 'sanciones y gastos del régimen ' + m.dineroTurno + 'M' : 'sin ayudas del exterior') + ', población ' + (m.felicidadTurno >= 0 ? '+' : '') + m.felicidadTurno + ' por turno.');

    // El sistema político: el Congreso, los secretos que salen a la luz, las legislativas.
    RF.politica.turno(estado, res);

    // 3. Consecuencias programadas que tocan hoy.
    const hoy = estado.pendientes.filter(p => p.dia <= estado.dia);
    estado.pendientes = estado.pendientes.filter(p => p.dia > estado.dia);
    for (const p of hoy) {
      const reg = {};
      aplicarEfectos(estado, p.efectos, reg);
      if (p.sanciones) ajustarEconomia(estado, { sanciones: p.sanciones });
      if (p.relaciones && RF.diplomacia) RF.diplomacia.ajustar(estado, p.relaciones);
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
      const v = u.stat in s ? s[u.stat] : estado.sectores[u.stat];
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
    else if (RF.director.pendiente(estado)) res.dilema = RF.director.pendiente(estado).id;
    if (res.sucesos.length || dilema) estado.diasSinEvento = 0;
    else estado.diasSinEvento++;
    // Las noticias sueltas al azar no pintan nada cuando la IA lleva la historia.
    if (!dilema && !estado.iaActiva && estado.diasSinEvento >= 4 && Math.random() < 0.4) {
      const ev = T.azar(RF.AZAR);
      const reg = {};
      aplicarEfectos(estado, ev.efectos, reg);
      res.sucesos.push({ tipo: 'azar', titulo: ev.titulo, texto: T.expandir(ev.texto), deltas: reg });
      estado.diasSinEvento = 0;
    }

    // 7. Quiebra y fin.
    estado.diasEnQuiebra = s.dinero <= -150 ? estado.diasEnQuiebra + 1 : 0;
    if (estado.diasEnQuiebra === 1) {
      res.sucesos.push({ tipo: 'umbral', titulo: 'Al borde de la quiebra', texto: T.expandir('{cifuentes} entra sin llamar: "Debemos más de 150 millones y nadie nos presta. Cada turno así nos hunde un poco más."'), deltas: {} });
    }
    const fin = comprobarFin(estado);
    if (fin) { estado.fin = fin; res.fin = fin; }

    // Lo importante del turno pasa a la memoria del mundo (la usa el Consejo de Estado con IA).
    if (RF.consejoIA) {
      for (const x of res.sucesos) {
        if (['consecuencia', 'escandalo', 'hito', 'politica'].includes(x.tipo)) RF.consejoIA.recordar(estado, x.titulo + ': ' + String(x.texto).split(/(?<=\.)\s/)[0]);
      }
    }
  }

  // Pasar el turno sin firmar nada: las leyes siguen trabajando.
  function pasarTurno(estado) {
    const res = { tipo: 'espera', dia: estado.dia, deltas: {}, sucesos: [], notas: [] };
    avanzarDia(estado, res);
    return res;
  }

  function comprobarFin(estado) {
    const s = estado.stats;
    if (estado.fin) return estado.fin;
    // Solo se cae cuando la estabilidad llega a 0. Quién te tumba depende del sector más enfadado.
    if (s.estabilidad <= 0) {
      const sec = estado.sectores || {};
      const peor = [['pueblo', s.felicidad], ['ejercito', sec.ejercito == null ? 50 : sec.ejercito], ['cupula', sec.elite == null ? 50 : sec.elite]].sort((a, b) => a[1] - b[1])[0][0];
      return s.dinero <= -150 ? 'tesoro' : s.inflacion >= 500 ? 'hiperinflacion' : peor;
    }
    return null;
  }

  RF.consejero = { asegurar, ajustarEconomia, nuevoEstado, decretar, decretarPersona, pasarTurno, avanzarDia, aplicarEfectos, convertir, medida, objetoDe, comprobarFin, lealtad };
})(globalThis.RF = globalThis.RF || {});
