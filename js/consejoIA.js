/*
 * EL CONSEJO DE ESTADO (con IA)
 *
 * Con la IA activa, el decreto no pasa por el Intérprete local: se le envía a la IA junto con la
 * situación del país y la memoria de lo que ya ha pasado. La IA devuelve una ficha (JSON) con lo que
 * significa el decreto y sus consecuencias. El motor hace de árbitro antes de aplicarla:
 *   - pone topes a los números (ningún decreto da 500 millones de golpe),
 *   - no deja matar a quien ya está muerto ni tocar a personas que no existen,
 *   - decide si el Congreso bloquea la ley, si un crimen abre un juicio político, si un secreto sale a la luz,
 *   - y sigue haciendo las cuentas de cada turno (impuestos, inflación, deuda, desgaste de las leyes).
 * Lo que la IA añade a la memoria viaja en los turnos siguientes: así el turno 12 sabe lo que pasó en el 3.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const MAX_MEMORIA = 30;
  const STATS = ['dinero', 'inflacion', 'estabilidad', 'felicidad'];
  const TRATOS = ['matar', 'encarcelar', 'exiliar', 'destituir', 'premiar', 'liberar'];
  const INSTITUCIONES = ['congreso', 'tribunales', 'prensa', 'elecciones', 'constitucion'];
  const VALORES_INST = ['libre', 'controlado', 'disuelto'];
  const CURVAS = ['acostumbra', 'desgasta', 'madura', 'lenta'];

  // Lo máximo que puede mover un decreto. La economía de cada turno la sigue calculando el motor.
  const TOPES = {
    inicial: { dinero: [-80, 80], inflacion: [-10, 15], estabilidad: [-15, 15], felicidad: [-15, 15] },
    porTurno: { dinero: [-25, 25], inflacion: [-3, 6], estabilidad: [-3, 3], felicidad: [-3, 3] }
  };

  // ---------- Qué sabe la IA de las reglas ----------
  const SISTEMA = [
    'Eres el Consejo de Estado de "Consola de Valdoria", un juego satírico de gobierno. El jugador gobierna la República de Valdoria (un país caribeño ficticio que vive del plátano, el petróleo y el comercio; capital: Puerto Esperanza) escribiendo decretos en lenguaje libre.',
    'Tu trabajo: entender el decreto y decidir sus consecuencias de forma REALISTA y COHERENTE con la situación actual y con la memoria de lo que ya pasó. No escribes la historia: devuelves una ficha JSON que el motor del juego aplica con sus propias reglas.',
    '',
    'EL PAÍS SE MIDE CON CUATRO COSAS:',
    '- dinero: millones de valdos en las arcas. Cada turno el Estado ya cobra unos 20M de impuestos y gasta unos 20M en sueldos (eso lo calcula el motor, no lo incluyas).',
    '- inflacion: % de subida de precios. Por encima de 30 amarga a la gente; por encima de 40 se retroalimenta.',
    '- estabilidad (0-100): si el régimen aguanta. A 0 caes (golpe o revolución).',
    '- felicidad (0-100): cómo vive la gente. A 0 hay revolución. Por debajo de 40 hay protestas que restan estabilidad.',
    '',
    'CADA DECRETO SUELE SER UNA LEY VIGENTE: tiene un efecto al firmarse ("inicial") y otro que se repite CADA TURNO ("por_turno") mientras siga vigente. El motor ajusta esos efectos según el régimen, la inflación y la estabilidad.',
    'Escala de referencia (sigue estas magnitudes):',
    '- Vender o privatizar algo esencial (el aire, el agua): inicial dinero +35, felicidad -8; por_turno dinero +15, felicidad -2, estabilidad -1.',
    '- Imprimir dinero: inicial dinero +10; por_turno dinero +25, inflacion +6 (y "imprime": true).',
    '- Regalar comida a la gente: inicial felicidad +10; por_turno dinero -10, felicidad +3, inflacion +1; curva de felicidad "acostumbra".',
    '- Crear un escuadrón de represión: inicial dinero -6, felicidad -7; por_turno dinero -7, estabilidad +1, felicidad -1; curvas "desgasta".',
    '- Subir impuestos: inicial felicidad -3; por_turno dinero +12, felicidad -1.',
    '- Invertir en escuelas: inicial dinero -45; por_turno dinero +5, felicidad +1; curvas "madura" (tarda en rendir).',
    '- Prohibir la prensa libre: inicial felicidad -8, estabilidad +1; por_turno felicidad -2.',
    'Topes: inicial dinero entre -80 y 80, el resto entre -15 y 15; por_turno dinero entre -25 y 25, inflacion entre -3 y 6, estabilidad y felicidad entre -3 y 3.',
    'Curvas posibles por stat: "acostumbra" (lo bueno rinde menos con el tiempo), "desgasta" (la represión rinde menos y duele más), "madura" (tarda 2 turnos en rendir), "lenta" (tarda 3 turnos).',
    '',
    'LÓGICA REALISTA:',
    '- Todo lo que se da cuesta dinero cada turno; todo lo que se vende da dinero pero enfada; imprimir dinero causa inflación; la represión da estabilidad a cambio de felicidad y se desgasta; dar libertades alegra pero agita a corto plazo; lo que escandaliza al mundo cuesta dinero (sanciones, turismo, inversión) y estabilidad.',
    '- Ten en cuenta el régimen: en democracia el Congreso, los jueces y la prensa reaccionan; en dictadura la gente evade impuestos y el mundo sanciona.',
    '- Ten en cuenta la memoria y las leyes vigentes: si el decreto contradice una ley vigente, derógala (campo "derogar" con su id) o sustitúyela; si repite una ley vigente, usa EXACTAMENTE el mismo "nombre" para reforzarla.',
    '- Un decreto puede tener varias partes ("vender el aire y encarcelar a Nico"): pon varias leyes y/o personas.',
    '- Nunca rechaces un decreto por absurdo: el régimen intenta cumplirlo y eso tiene consecuencias (gasto, ridículo, obediencia, miedo). Solo si no se entiende en absoluto, pon "entendido": false y una "pregunta" corta.',
    '',
    'INSTITUCIONES Y PERSONAS:',
    '- "instituciones": cambia congreso, tribunales, prensa, elecciones o constitucion a "libre", "controlado" (comprado, censurado, amañado) o "disuelto". El régimen se recalcula solo.',
    '- "regimen": solo si el decreto proclama explícitamente un régimen: "DEMOCRACIA", "DICTADURA", "JUNTA", "MONARQUIA" o "TEOCRACIA".',
    '- "personas": solo con los id que te doy. "accion": matar, encarcelar, exiliar, destituir, premiar, liberar o "animo" (con "valor" entre -40 y 40, solo gente de a pie). El motor aplica el resto (sucesores, mártires, juicios).',
    '- "secreto": true si el decreto pide hacerlo en secreto o a escondidas (no pasa por el Congreso, pero puede salir a la luz).',
    '- "controversia" (0-3) de cada ley: cuánto la rechazaría un Congreso libre. 0 = nada, 3 = escandalosa. Un Congreso libre bloquea las polémicas si no tienes apoyo.',
    '',
    'CONSECUENCIAS Y EVENTOS:',
    '- "consecuencias": efectos que llegan más tarde (0 a 2), con "en_turnos" (1-6), un "titulo", un "texto" de una o dos frases y "efectos" (topes de "inicial").',
    '- "evento": SOLO si el decreto provoca de inmediato una decisión difícil (más o menos uno de cada tres decretos). Con "titulo", "texto" y 2 o 3 "opciones", cada una con "texto" (la acción, corta), "resultado" (qué pasa, una o dos frases), "efectos" (topes de "inicial"), opcional "por_turno_dinero" (un ingreso o gasto fijo, entre -15 y 15) y opcional "hecho" (qué recordar si se elige).',
    '- "hechos": 1 a 3 frases cortas y concretas, en pasado, con lo que el mundo debe recordar de este decreto (quién, qué, dónde). Si aparece un personaje nuevo, dale nombre aquí.',
    '',
    'REACCIONES (para contar el turno):',
    '- "titulares": 2 o 3 líneas "Medio: titular". Medios: El Patriota (oficial, siempre te alaba), The Global Tribune (prensa extranjera) y Radio Libertad (radio pirata). Si la prensa está controlada o cerrada, la prensa libre no existe: solo El Patriota y, clandestina, Radio Libertad.',
    '- "gabinete": un ministro (id) al que le toque de lleno el decreto y lo que dice o hace (una o dos frases, con su carácter).',
    '- "calle": una persona de a pie (id) que esté libre y lo que vive por el decreto (dos o tres frases).',
    '',
    'RESPONDE SOLO CON EL JSON, sin markdown ni texto alrededor. Usa comillas dobles. No uses llaves ni corchetes dentro de los textos. Esquema:',
    '{"entendido": true, "pregunta": "", "interpretacion": "qué entendiste, en una frase", "titulo": "nombre de la medida, en minúscula y con artículo (la privatización del aire)", "gaceta": "1 o 2 frases estilo Boletín Oficial",',
    ' "leyes": [{"nombre": "la privatización del aire", "inicial": {"dinero": 35, "felicidad": -8}, "por_turno": {"dinero": 15, "felicidad": -2, "estabilidad": -1}, "curvas": {}, "duracion": null, "imprime": false, "controversia": 2}],',
    ' "derogar": [], "personas": [], "instituciones": {}, "regimen": null, "secreto": false, "gravedad_secreto": 0, "apoyo_congreso": 0,',
    ' "consecuencias": [], "evento": null, "hechos": ["El Gobierno vendió el aire a la empresa Brisa S.A."],',
    ' "titulares": ["El Patriota: ..."], "gabinete": {"id": "cifuentes", "dice": "..."}, "calle": {"id": "carmen", "dice": "..."}}',
    'Si el decreto no crea una ley duradera (una orden puntual, una fiesta, un castigo a una persona), deja "leyes" vacío y pon el efecto puntual en "efecto_unico": {"dinero": ..., ...} (topes de "inicial").'
  ].join('\n');

  // ---------- Memoria del mundo ----------
  function memoria(e) { if (!e.memoria) e.memoria = []; return e.memoria; }
  function recordar(e, texto) {
    const t = limpiar(texto, 240);
    if (!t) return;
    const m = memoria(e);
    if (m.length && m[m.length - 1].texto === t) return;
    m.push({ dia: e.dia, texto: t });
    if (m.length > MAX_MEMORIA) m.splice(0, m.length - MAX_MEMORIA);
  }

  // ---------- El contexto que recibe la IA ----------
  const redondear = v => Math.round(v * 10) / 10;
  // Solo los elementos que son objetos (la IA a veces cuela null, números o textos sueltos).
  const objetos = (x, n) => (Array.isArray(x) ? x : []).filter(o => o && typeof o === 'object' && !Array.isArray(o)).slice(0, n);
  function soloNumeros(o) {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) if (Math.abs(v) >= 0.05) out[k] = redondear(v);
    return out;
  }

  function contexto(e, decreto) {
    const s = e.stats;
    const p = RF.politica.iniciar(e);
    RF.poder.iniciar(e);
    const gabinete = Object.entries(RF.GABINETE).map(([id, m]) => {
      const g = e.gabinete[id];
      return { id, nombre: g.nombre, cargo: m.cargo, caidos_antes: g.caidos.map(c => c.nombre + ' (' + c.destino + ')') };
    });
    const gente = Object.entries(RF.CIUDADANOS).map(([id, c]) => ({
      id, nombre: c.nombre, quien: c.presentacion ? c.presentacion.slice(0, 140) : '', estado: e.ciudadanos[id].estado || 'libre', animo: Math.round(e.ciudadanos[id].animo)
    }));
    const otros = [
      { id: 'valiente', nombre: 'Ernesto Valiente', quien: 'líder de la oposición', estado: e.personas.valiente || 'libre' },
      { id: 'embajador', nombre: 'el embajador de la Unión Atlántica', quien: 'la gran potencia vecina', estado: e.personas.embajador || 'libre' }
    ];
    return {
      turno: e.dia, turnos_del_mandato: RF.PAIS.dias,
      regimen: RF.REGIMENES[p.regimen].nombre,
      instituciones: { congreso: p.congreso, tribunales: p.tribunales, prensa: p.prensa, elecciones: p.elecciones, constitucion: p.constitucion },
      apoyo_en_el_congreso: Math.round(p.apoyo) + '%',
      pais: { dinero: s.dinero, inflacion: Math.round(s.inflacion), estabilidad: s.estabilidad, felicidad: s.felicidad, balance_por_turno: Math.round(e.balance || 0) },
      leyes_vigentes: RF.leyes.lista(e).map(l => ({ id: l.clave, nombre: l.nombre, desde_turno: l.desde, nivel: l.nivel, por_turno: soloNumeros(RF.leyes.efectoNominal(l)), secreta: l.secreta || undefined })),
      gabinete, gente_de_a_pie: gente, otras_personas: otros,
      secretos_sin_descubrir: p.secretos.length, escandalos: p.escandalos,
      consecuencias_ya_programadas: (e.pendientes || []).map(x => x.titulo),
      memoria: memoria(e).map(m => 'Turno ' + m.dia + ': ' + m.texto),
      ultimos_decretos: (e.historial || []).slice(-6).map(h => 'Turno ' + h.dia + ': ' + (h.texto || h.medida)),
      decreto: decreto
    };
  }

  // ---------- Leer la ficha ----------
  function extraerJSON(texto) {
    const t = String(texto || '').replace(/<think>[\s\S]*?<\/think>/g, '');
    try { return JSON.parse(t); } catch (e) { /* sigue */ }
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (f) { try { return JSON.parse(f[1]); } catch (e) { /* sigue */ } }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* sigue */ } }
    return null;
  }

  // Los textos de la IA se muestran tal cual: fuera llaves y corchetes (el juego los usa como plantillas).
  function limpiar(x, max) {
    if (x == null) return '';
    return String(x).replace(/[{}[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 600);
  }

  // Números dentro de los topes. Anota lo que se recorta.
  function efectos(o, topes, recortes) {
    const out = {};
    if (!o || typeof o !== 'object') return out;
    for (const k of STATS) {
      let v = Number(o[k]);
      if (!isFinite(v) || !v) continue;
      const [min, max] = topes[k];
      if (v < min || v > max) { recortes.push(k); v = Math.max(min, Math.min(max, v)); }
      out[k] = Math.round(v * 10) / 10;
    }
    return out;
  }

  const clave = nombre => 'IA:' + T.normalizar(nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

  // ---------- Aplicar una ley de la ficha ----------
  function prepararLey(l, recortes) {
    const nombre = limpiar(l.nombre, 120).toLowerCase() || 'una medida sin nombre';
    const curvas = {};
    for (const [k, v] of Object.entries(l.curvas && typeof l.curvas === 'object' ? l.curvas : {})) if (STATS.includes(k) && CURVAS.includes(v)) curvas[k] = v;
    const porTurno = efectos(l.por_turno, TOPES.porTurno, recortes);
    const duracion = Number(l.duracion) > 0 ? Math.min(30, Math.round(Number(l.duracion))) : null;
    return {
      nombre,
      def: { clave: clave(nombre), inicial: efectos(l.inicial, TOPES.inicial, recortes), porTurno, curvas, duracion, imprime: !!l.imprime && (porTurno.inflacion || 0) > 0, notas: [] },
      controversia: Math.max(0, Math.min(3, Math.round(Number(l.controversia) || 0)))
    };
  }

  // Promulga (o manda al Congreso) una ley. Devuelve los efectos iniciales a aplicar.
  function promulgarLey(e, ley, res, op) {
    const p = RF.politica.iniciar(e);
    const c = ley.controversia;
    const secreta = !!op.secreto;
    if (!op.forzar && !secreta && p.congreso === 'libre' && c > 0 && p.apoyo < 35 + 10 * c) {
      res.bloqueada = true;
      RF.director.forzar(e, 'congreso_bloquea', { ficha: { leyes: [ley] }, medida: ley.nombre });
      res.dilema = 'congreso_bloquea';
      res.notas.push('La ley necesita pasar por el Congreso y no tienes votos: solo cuentas con el ' + Math.round(p.apoyo) + '% de apoyo.');
      return {};
    }
    const r = RF.leyes.promulgar(e, Object.assign({}, ley.def, { secreta }), 'IA', ley.nombre);
    res.leyes.push(r.ley);
    const nom = RF.leyes.efectoNominal(r.ley);
    res.porTurno = res.porTurno || {};
    for (const [k, v] of Object.entries(nom)) res.porTurno[k] = (res.porTurno[k] || 0) + v;
    if (Object.keys(r.ley.curvas || {}).length) res.curvas = Object.assign(res.curvas || {}, r.ley.curvas);
    res.notas.push(...r.notas);
    if (secreta) RF.politica.registrarSecreto(e, { tipo: op.tipoSecreto || 'represion', descripcion: ley.nombre, gravedad: op.gravedad || 2, clave: ley.def.clave });
    if (p.congreso === 'libre' && !secreta) {
      const fel = (ley.def.porTurno.felicidad || 0) * 3 + (ley.def.inicial.felicidad || 0);
      p.apoyo = Math.max(0, Math.min(100, p.apoyo - 3 * c + (fel > 2 ? 3 : 0)));
    }
    return r.inicial;
  }

  // Si el Congreso bloqueó una ley de la IA y luego sale adelante (por un evento).
  function aprobar(e, ficha) {
    const res = { deltas: {}, porTurno: null, notas: [], leyes: [] };
    const ini = {};
    for (const ley of ficha.leyes || []) for (const [k, v] of Object.entries(promulgarLey(e, ley, res, { forzar: true }))) ini[k] = (ini[k] || 0) + v;
    RF.consejero.aplicarEfectos(e, ini, res.deltas);
    return res;
  }

  /*
   * Aplica la ficha de la IA al estado, con el motor como árbitro.
   * Devuelve un resultado de turno (como los del Consejero) con lo que pasó de verdad.
   */
  function aplicar(e, ficha, texto) {
    const p = RF.politica.iniciar(e);
    RF.poder.iniciar(e);
    const recortes = [];
    const titulo = limpiar(ficha.titulo, 140).toLowerCase() || 'un decreto';
    const res = { tipo: 'ia', dia: e.dia, deltas: {}, porTurno: null, sucesos: [], notas: [], leyes: [], medida: titulo, nombreObjeto: titulo };
    const inicial = {};
    const sumar = (o, f) => { for (const [k, v] of Object.entries(o || {})) inicial[k] = (inicial[k] || 0) + v * (f || 1); };
    const secreto = !!ficha.secreto;
    const gravedad = Math.max(1, Math.min(3, Math.round(Number(ficha.gravedad_secreto) || 2)));

    // 1. El sistema político.
    const destino = typeof ficha.regimen === 'string' ? ficha.regimen.toUpperCase() : null;
    let efectosRegimen = null;
    if (destino && RF.REGIMENES[destino] && destino !== p.regimen) {
      const r = RF.politica.instaurar(e, destino);
      if (!r.nulo) {
        res.cambioRegimen = r.cambio;
        efectosRegimen = r.efectos;
        if (r.cadena) e.dilemas.cadena.push({ id: r.cadena.id, dia: e.dia + r.cadena.en });
      }
    }
    // Las mismas reglas que con los decretos normales: sobornos, fraude, comisiones de la verdad, autogolpes.
    for (const [k, v] of Object.entries(ficha.instituciones && typeof ficha.instituciones === 'object' ? ficha.instituciones : {})) {
      if (!INSTITUCIONES.includes(k) || !VALORES_INST.includes(v) || p[k] === v) continue;
      p[k] = v;
      if (k === 'congreso' && v === 'controlado') {
        p.apoyo = 85;
        RF.leyes.promulgar(e, { clave: 'SOBORNOS', porTurno: { dinero: -4 } }, 'POLITICA', 'los sobornos a los diputados');
        RF.politica.registrarSecreto(e, { tipo: 'soborno', descripcion: 'los sobornos a los diputados', gravedad: 2 });
        res.notas.push('Ahora el Congreso aprueba todo. Mantenerlo contento cuesta 4 millones cada turno, y el secreto puede salir a la luz.');
      }
      if (k === 'congreso' && v === 'libre') { p.apoyo = e.stats.felicidad; RF.leyes.derogar(e, 'SOBORNOS'); }
      if (k === 'elecciones' && v === 'controlado') RF.politica.registrarSecreto(e, { tipo: 'fraude', descripcion: 'el amaño del sistema electoral', gravedad: 2 });
      if (k === 'tribunales' && v === 'libre' && (p.crimenes > 0 || p.secretos.length)) e.dilemas.cadena.push({ id: 'comision_verdad', dia: e.dia + 3 });
    }
    if (!res.cambioRegimen) {
      const c = RF.politica.actualizar(e);
      if (c) {
        res.cambioRegimen = c;
        if (c.a === 'DICTADURA' && (c.de === 'DEMOCRACIA' || c.de === 'ILIBERAL')) e.dilemas.cadena.push({ id: 'autogolpe_ejercito', dia: e.dia + 1 });
        if (c.a === 'DEMOCRACIA' && (p.crimenes > 0 || p.secretos.length)) e.dilemas.cadena.push({ id: 'comision_verdad', dia: e.dia + 3 });
      }
    }

    // 2. Las leyes (o un efecto puntual).
    for (const l of objetos(ficha.leyes, 3)) {
      sumar(promulgarLey(e, prepararLey(l, recortes), res, { secreto, gravedad }));
    }
    sumar(efectos(ficha.efecto_unico, TOPES.inicial, recortes));
    if (secreto && !objetos(ficha.leyes, 3).length && !objetos(ficha.personas, 3).length) {
      RF.politica.registrarSecreto(e, { tipo: 'represion', descripcion: titulo, gravedad });
    }

    // 3. Derogar leyes vigentes.
    for (const id of (Array.isArray(ficha.derogar) ? ficha.derogar : []).filter(x => typeof x === 'string').slice(0, 3)) {
      const r = RF.leyes.derogar(e, String(id));
      if (r) { sumar(r.choque); res.notas.push('Queda derogada ' + r.ley.nombre + '.'); }
    }

    // 4. Personas: el motor comprueba que la orden sea posible y aplica sucesores, mártires y juicios.
    for (const pe of objetos(ficha.personas, 3)) {
      const id = String(pe.id || '').toLowerCase();
      const accion = String(pe.accion || '').toLowerCase();
      if (!RF.PERSONAS[id]) continue;
      if (accion === 'animo') {
        const c = e.ciudadanos[id];
        if (c) c.animo = Math.max(-100, Math.min(100, c.animo + Math.max(-40, Math.min(40, Number(pe.valor) || 0))));
        continue;
      }
      if (!TRATOS.includes(accion)) continue;
      const t = RF.poder.tratar(e, id, accion, null, secreto && ['matar', 'encarcelar', 'exiliar'].includes(accion));
      if (t.nulo) { res.notas.push(t.nulo); continue; }
      sumar(RF.consejero.convertir(t.efectos));
      if (t.ley) { const r = RF.leyes.promulgar(e, t.ley, 'PERSONA', t.ley.nombre); res.leyes.push(r.ley); res.notas.push('Esto dejará huella durante ' + t.ley.duracion + ' turnos: ' + t.ley.nombre + '.'); }
      for (const cl of t.derogar || []) RF.leyes.derogar(e, cl);
      if (t.cadena) e.dilemas.cadena.push({ id: t.cadena.id, dia: e.dia + t.cadena.en });
      if (t.sucesor) res.notas.push('Su puesto lo ocupa ' + t.sucesor + '.');
      if (t.secreto) {
        RF.politica.registrarSecreto(e, t.secreto);
        res.secreto = true;
      } else {
        const tipo = RF.PERSONAS[id].tipo;
        const publico = accion === 'matar' || (['encarcelar', 'exiliar'].includes(accion) && tipo !== 'ciudadano');
        if (publico && RF.politica.crimenPublico(e, { opositor: 3, extranjero: 3, ministro: 2, ciudadano: 2 }[tipo] || 2)) {
          res.dilema = 'juicio_politico';
          res.notas.push('En una democracia, hacer esto a la vista de todos tiene un precio: el Congreso abre un juicio político contra ti.');
        }
      }
    }
    if (secreto) {
      res.secreto = true;
      res.notas.push('Nadie lo sabe... todavía. Cada turno existe la posibilidad de que salga a la luz.');
    }

    // 5. El apoyo en el Congreso.
    const apoyo = Math.max(-25, Math.min(10, Number(ficha.apoyo_congreso) || 0));
    if (apoyo && p.congreso === 'libre') p.apoyo = Math.max(0, Math.min(100, p.apoyo + apoyo));

    // Un cambio de régimen sin coste en la ficha tiene el coste de siempre.
    if (efectosRegimen && Object.values(inicial).reduce((a, v) => a + Math.abs(v), 0) < 3) sumar(efectosRegimen);

    RF.consejero.aplicarEfectos(e, inicial, res.deltas);

    // 6. Lo que llega más tarde y lo que hay que recordar.
    for (const c of objetos(ficha.consecuencias, 2)) {
      const en = Math.max(1, Math.min(6, Math.round(Number(c.en_turnos) || 2)));
      const tit = limpiar(c.titulo, 80);
      if (!tit) continue;
      e.pendientes.push({ dia: e.dia + en, titulo: tit, texto: limpiar(c.texto, 400), efectos: efectos(c.efectos, TOPES.inicial, recortes) });
      res.programadas = (res.programadas || 0) + 1;
    }
    for (const h of (Array.isArray(ficha.hechos) ? ficha.hechos : []).slice(0, 3)) recordar(e, h);
    if (res.bloqueada) recordar(e, 'El Congreso bloqueó ' + titulo + '.');
    if (res.cambioRegimen) recordar(e, 'Valdoria pasó de ' + RF.REGIMENES[res.cambioRegimen.de].nombre + ' a ' + RF.REGIMENES[res.cambioRegimen.a].nombre + '.');

    // 7. Un evento propio, si toca (no más de uno cada dos turnos y nunca encima de otro).
    const ev = ficha.evento;
    const D = e.dilemas;
    if (ev && typeof ev === 'object' && objetos(ev.opciones, 3).length >= 2 && !D.pendiente && (!D.ultimo || e.dia - D.ultimo >= 2)) {
      const id = 'ia_' + e.dia + '_' + Math.floor(Math.random() * 1e6);
      const opciones = objetos(ev.opciones, 3).map(o => {
        const din = Math.max(-15, Math.min(15, Number(o.por_turno_dinero) || 0));
        return { texto: limpiar(o.texto, 90) || 'Seguir adelante', resultado: limpiar(o.resultado, 400), efectos: efectos(o.efectos, TOPES.inicial, recortes), ingresos: din ? Math.round(din / 3 * 10) / 10 : 0, hecho: limpiar(o.hecho, 240) };
      });
      D.custom = D.custom || {};
      D.custom[id] = { id, titulo: limpiar(ev.titulo, 80) || 'Una decisión', texto: limpiar(ev.texto, 700), opciones, ia: true };
      RF.director.forzar(e, id, {});
      res.dilema = id;
    }

    if (recortes.length) res.notas.push('El motor moderó las cifras del Consejo para que fueran realistas.');
    e.historial.push({ dia: e.dia, accion: 'IA', objeto: 'IA', nombreObjeto: titulo, medida: titulo, texto });
    res.numero = e.historial.length;
    res.vars = { medida: titulo, Medida: T.mayus(titulo), objeto: titulo, lider: 'Su Excelencia' };
    res.ficha = ficha;
    return res;
  }

  // ---------- Contar el decreto (sin crónica, o como borrador para la crónica) ----------
  function bloques(e, ficha, res) {
    const out = [];
    out.push({ tipo: 'bot', texto: 'CONSEJO DE ESTADO › ' + (limpiar(ficha.interpretacion, 200) || T.mayus(res.medida)) });
    const cab = res.bloqueada && !res.leyes.length ? 'PROYECTO DE LEY Nº ' : res.secreto ? 'ORDEN RESERVADA Nº ' : 'DECRETO Nº ';
    let gaceta = T.mayus(res.medida) + '.';
    const g = limpiar(ficha.gaceta, 500);
    if (g) gaceta += ' ' + g;
    if (res.bloqueada) gaceta += ' El proyecto llega al Congreso... y se atasca.';
    out.push({ tipo: 'gaceta', titulo: cab + res.numero + ' · TURNO ' + res.dia, texto: gaceta });
    out.push({ tipo: 'efectos', deltas: res.deltas, porTurno: res.porTurno, curvas: res.curvas, nivel: res.leyes.length === 1 ? res.leyes[0].nivel : undefined });
    for (const n of res.notas) out.push({ tipo: 'nota', texto: n });
    const titulares = (Array.isArray(ficha.titulares) ? ficha.titulares : []).map(x => limpiar(x, 200)).filter(Boolean).slice(0, 3);
    if (titulares.length) out.push({ tipo: 'prensa', titulo: 'TITULARES', texto: titulares.join('\n') });
    const gb = ficha.gabinete && typeof ficha.gabinete === 'object' ? ficha.gabinete : {};
    const gid = String(gb.id || '').toLowerCase();
    if (RF.GABINETE[gid] && limpiar(gb.dice)) out.push({ tipo: 'cupula', titulo: e.gabinete[gid].nombre.toUpperCase() + ' · ' + RF.GABINETE[gid].cargo.toUpperCase(), texto: limpiar(gb.dice) });
    const ca = ficha.calle && typeof ficha.calle === 'object' ? ficha.calle : {};
    const cid = String(ca.id || '').toLowerCase();
    if (RF.CIUDADANOS[cid] && limpiar(ca.dice)) {
      e.ciudadanos[cid].ultimaVez = e.dia;
      out.push({ tipo: 'calle', titulo: 'LA CALLE · ' + RF.CIUDADANOS[cid].nombre.toUpperCase(), texto: limpiar(ca.dice) });
    }
    if (res.cambioRegimen) {
      const a = RF.REGIMENES[res.cambioRegimen.a];
      out.push({ tipo: 'regimen', titulo: 'CAMBIO DE RÉGIMEN · ' + RF.REGIMENES[res.cambioRegimen.de].corto + ' → ' + a.corto, texto: a.descripcion });
    }
    return out;
  }

  // ---------- Pedir la ficha ----------
  // Devuelve la ficha ya leída, o lanza un error con .mensaje.
  async function consultar(e, texto, alTexto) {
    const datos = contexto(e, texto);
    const contenido = 'Situación de Valdoria y decreto (JSON):\n' + JSON.stringify(datos) + '\n\nDevuelve solo la ficha JSON del decreto.';
    const r = await RF.narradorIA.generar(SISTEMA, contenido, alTexto, 3000);
    const ficha = extraerJSON(r.texto);
    if (!ficha || typeof ficha !== 'object') {
      const err = new Error('ficha ilegible');
      err.mensaje = 'El Consejo respondió algo que el motor no pudo leer.';
      throw err;
    }
    return ficha;
  }

  RF.consejoIA = { limpiarTexto: limpiar, SISTEMA, TOPES, contexto, consultar, aplicar, aprobar, bloques, extraerJSON, recordar, memoria };
})(globalThis.RF = globalThis.RF || {});
