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
  // Lo que puede mover una ficha: las tres barras, la población (felicidad) y los sectores.
  const STATS = ['dinero', 'inflacion', 'estabilidad', 'felicidad', 'ejercito', 'elite'];
  const TRATOS = ['matar', 'encarcelar', 'exiliar', 'destituir', 'premiar', 'liberar'];
  const INSTITUCIONES = ['congreso', 'tribunales', 'prensa', 'elecciones', 'constitucion'];
  const VALORES_INST = ['libre', 'controlado', 'disuelto'];
  const CURVAS = ['acostumbra', 'desgasta', 'madura', 'lenta'];

  // Lo máximo que puede mover un decreto. La economía de cada turno la sigue calculando el motor.
  const TOPES = {
    inicial: { dinero: [-80, 80], inflacion: [-10, 15], estabilidad: [-15, 15], felicidad: [-15, 15], ejercito: [-20, 20], elite: [-20, 20] },
    porTurno: { dinero: [-25, 25], inflacion: [-3, 6], estabilidad: [-3, 3], felicidad: [-3, 3], ejercito: [-3, 3], elite: [-3, 3] }
  };

  // ---------- Qué sabe la IA de las reglas ----------
  const SISTEMA = [
    'Eres el Consejo de Estado de "Consola de Pionyang", un juego satírico de gobierno. El jugador es el Líder Supremo de Corea del Norte (la República Popular Democrática de Corea): acaba de heredar el poder de su padre y gobierna escribiendo decretos en lenguaje libre. Es sátira: no nombres a ningún líder real; habla de "tu padre" y de "tu abuelo, el Presidente Eterno".',
    'EL PAÍS REAL (úsalo para que las consecuencias tengan sentido):',
    ...RF.PAIS.contexto.map(l => '- ' + l),
    'Conceptos que el motor entiende:',
    ...Object.values(RF.PAIS.conceptos).map(l => '- ' + l),
    'Tu trabajo: entender el decreto y decidir sus consecuencias de forma REALISTA y COHERENTE con la situación actual y con la memoria de lo que ya pasó. No escribes la historia: devuelves una ficha JSON que el motor del juego aplica con sus propias reglas.',
    '',
    'EL PAÍS SE MIDE ASÍ (en el JSON usa siempre estas claves):',
    '- dinero = DIVISAS: millones de dólares en las arcas. Cada turno el motor ya cobra impuestos (menos lo que se escapa por el mercado negro), paga sueldos y resta las sanciones: sin buscar divisas, el país se arruina.',
    '- inflacion = INFLACIÓN: % que suben los precios cada turno (el arroz en el mercado, el won). Por encima de 30 hay hambre; por encima de 40 se retroalimenta.',
    '- estabilidad = ESTABILIDAD del régimen (0-100). A 0 caes. Cada turno la empujan los tres sectores.',
    'LOS TRES SECTORES (ánimo 0-100; cada uno tiene su sección en la historia y empuja la estabilidad; si uno se hunde, la desploma. Solo se pierde con la estabilidad a 0. La represión da estabilidad artificial: sube la barra y el miedo calla el descontento):',
    '- ejercito = el EJÉRCITO: generales, oficiales y soldados. Les gustan los misiles, las medallas, las raciones y el dinero; odian los recortes, las purgas, las milicias rivales y cobrar tarde. Hundido, empuja al golpe.',
    '- elite = el PALACIO: el Partido y la élite. Les gustan los lujos, los sobornos del mercado negro y que no se toque su poder; odian las sanciones, las purgas y perder privilegios. Hundido, conspira.',
    '- felicidad = la POBLACIÓN: cómo aguanta la gente (comida, apagones, miedo, mercado). Por debajo de 40 resta estabilidad (menos si hay represión).',
    'DIPLOMACIA (campo "relaciones" de la ficha, opcional): cambios en la relación (0-100) con las potencias vecinas, de -25 a +25 cada una: {"eeuu": ..., "china": ..., "surcorea": ..., "japon": ...}. Lo que quiere y teme cada una viene en "diplomacia". Sé coherente con sus intereses: China quiere estabilidad y odia las pruebas que atraen barcos americanos; Estados Unidos quiere desnuclearización y castiga los misiles con sanciones; el Sur premia los gestos de acercamiento y teme la artillería; Japón exige a los secuestrados y odia los misiles sobre su territorio. Cada turno el motor aplica sus consecuencias: China da comercio y, si se enfada, corta el petróleo; Estados Unidos sube o baja las sanciones; el Sur manda ayuda. Si el decreto desmantela o reconstruye el arsenal nuclear, pon "arsenal": false o true.',
    'ECONOMÍA (campo "economia" de la ficha, opcional): {"sanciones": de -2 a +2 (cambia el nivel de sanciones, 0-4), "mercado_negro": de -40 a +40 (puntos del % de economía que va por el jangmadang)}. Los misiles y la bomba suben sanciones; la diplomacia y el desarme las bajan; legalizar mercados reduce el mercado negro (pasa a pagar impuestos); perseguirlo también lo reduce pero trae hambre.',
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
    '- Los temas graves (esclavitud, trabajo infantil, guerra, tortura, campos, bomba atómica, quitar derechos) se cumplen en el juego, pero con consecuencias graves y realistas: dan poder o dinero a corto plazo y traen sanciones, bloqueos, fugas, huelgas, resistencia y escándalos. Muy polémicos (controversia 3). La violencia se sugiere, nunca se describe con detalle.',
    '- Ten en cuenta el régimen: en democracia el Congreso, los jueces y la prensa reaccionan; en dictadura la gente evade impuestos y el mundo sanciona.',
    '- Ten en cuenta la memoria y las leyes vigentes: si el decreto contradice una ley vigente, derógala (campo "derogar" con su id) o sustitúyela; si repite una ley vigente, usa EXACTAMENTE el mismo "nombre" para reforzarla.',
    '- Un decreto puede tener varias partes ("vender el aire y encarcelar a Chol-su"): pon varias leyes y/o personas.',
    '- Nunca rechaces un decreto por absurdo. Solo si no se entiende en absoluto, pon "entendido": false y una "pregunta" corta.',
    '',
    'COHERENCIA ABSURDA (lo más importante del juego):',
    '- Toma cada decreto AL PIE DE LA LETRA y cúmplelo con total seriedad burocrática, por estúpido que sea. El humor no sale de chistes, sino de seguir la lógica hasta el final con cara de póquer.',
    '- Pregúntate, en orden: ¿cómo lo aplica el Estado de verdad (qué organismo, qué funcionarios, qué formulario, qué castigo)? ¿Quién gana dinero con ello? ¿Quién hace la trampa y cómo? ¿Qué efecto secundario lógico nadie previó? Ese último paso es el mejor.',
    '- Ejemplo: "prohibir los lunes". El Estado no puede borrar un día, así que decreta que después del domingo viene el martes. Las nóminas semanales pierden un día de trabajo (dinero −); los empresarios exigen trabajar el domingo; los calendarios importados son ilegales; aparece un mercado negro de "lunes" (reuniones clandestinas de oficina); los nacidos en lunes piden un cumpleaños nuevo. Hechos: "Desde el turno 3, en Corea del Norte la semana tiene seis días: después del domingo viene el martes."',
    '- Ejemplo: "que las palomas sean policías". El Ministerio de Seguridad del Estado les da placa y salario (dinero − por turno); nadie sabe cómo detienen; las estatuas quedan "bajo protección"; los que dan de comer a las palomas son acusados de soborno; la delincuencia no cambia, pero las multas por "desacato a agente" se disparan.',
    '- Ejemplo: "nombrar ministro de economía a un perro". Se nombra de verdad (dale nombre al perro en "hechos"); firma con la pata; los mercados reaccionan (estabilidad −, dinero −); Pak, humillada, trama algo; a la semana el perro tiene asesores y un despacho con sofá.',
    '- Una vez establecida, la regla absurda ES LA REALIDAD DEL JUEGO: guárdala en "hechos" con detalles concretos y respétala en todos los turnos siguientes (si los lunes no existen, nadie queda "el lunes"; si el perro es ministro, sigue siéndolo hasta que lo destituyan).',
    '- Los números siguen siendo realistas: lo absurdo cuesta lo que costaría aplicarlo (funcionarios, uniformes, multas, reimprimir calendarios) y cambia la vida de la gente según su lógica. No infles los efectos por ser gracioso.',
    '- En "logica" pon de 2 a 4 pasos de esa cadena, cortos y en orden, como un informe de un funcionario muy serio ("Paso 1: …"). El jugador los lee: que se vea la lógica impecable del disparate.',
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
    '- "evento": SOLO si el decreto provoca de inmediato una decisión difícil (más o menos uno de cada tres decretos). Con "titulo", "texto" y 2 o 3 "opciones", cada una con "texto" (la acción, corta), "resultado" (qué pasa, una o dos frases), "efectos" (topes de "inicial"), opcional "por_turno_dinero" (un ingreso o gasto fijo, entre -15 y 15), opcional "relaciones" (como el campo de la ficha, de -20 a 20) y opcional "sanciones" (-1 o 1) y opcional "hecho" (qué recordar si se elige).',
    '- Si "turnos_sin_evento" es 4 o más, propón un evento aunque el decreto sea tranquilo: el país no se queda quieto.',
    '- "hechos": 1 a 3 frases cortas y concretas, en pasado, con lo que el mundo debe recordar de este decreto (quién, qué, dónde). Si aparece un personaje nuevo, dale nombre aquí.',
    '',
    'REACCIONES (para contar el turno por secciones; tono de la saga Tropico: sátira alegre, frases cortas y secas, propaganda ridícula, burocracia absurda, sin sermones):',
    '- "radio": el locutor de Radio Pionyang anuncia el decreto con entusiasmo de propaganda y lo vende como una victoria aunque sea un desastre (una o dos frases, con un remate gracioso).',
    '- "gabinete": un ministro (id) al que le toque de lleno el decreto y lo que dice o hace (una frase, con su carácter). Es la sección PALACIO.',
    '- "ejercito": {"dice": "..."} cómo lo reciben los cuarteles, los generales o los soldados (una frase). Es la sección EJÉRCITO.',
    '- "calle": una persona de a pie (id) que esté libre y lo que vive por el decreto en su día a día (una o dos frases). Es la sección POBLACIÓN.',
    '',
    'RESPONDE SOLO CON EL JSON, sin markdown ni texto alrededor. Usa comillas dobles. No uses llaves ni corchetes dentro de los textos. Esquema:',
    '{"entendido": true, "pregunta": "", "interpretacion": "qué entendiste, en una frase", "logica": ["Paso 1: cómo lo aplica el Estado", "Paso 2: quién gana y quién hace la trampa", "Paso 3: el efecto secundario que nadie previó"], "titulo": "nombre de la medida, en minúscula y con artículo (la privatización del aire)", "gaceta": "1 o 2 frases estilo Boletín Oficial",',
    ' "leyes": [{"nombre": "la privatización del aire", "inicial": {"dinero": 35, "felicidad": -8}, "por_turno": {"dinero": 15, "felicidad": -2, "estabilidad": -1}, "curvas": {}, "duracion": null, "imprime": false, "controversia": 2}],',
    ' "derogar": [], "personas": [], "instituciones": {}, "regimen": null, "secreto": false, "gravedad_secreto": 0, "apoyo_congreso": 0,',
    ' "consecuencias": [], "evento": null, "hechos": ["El Gobierno vendió el aire a la empresa Brisa S.A."],',
    ' "economia": {}, "relaciones": {}, "radio": "¡Buenos días, camaradas! ...", "gabinete": {"id": "cifuentes", "dice": "..."}, "ejercito": {"dice": "..."}, "calle": {"id": "carmen", "dice": "..."}}',
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
      { id: 'valiente', nombre: 'Song Dae-ho', quien: 'líder de la oposición', estado: e.personas.valiente || 'libre' },
      { id: 'embajador', nombre: 'el embajador sueco', quien: 'la gran potencia vecina', estado: e.personas.embajador || 'libre' }
    ];
    return {
      turno: e.dia,
      regimen: RF.REGIMENES[p.regimen].nombre,
      instituciones: { congreso: p.congreso, tribunales: p.tribunales, prensa: p.prensa, elecciones: p.elecciones, constitucion: p.constitucion },
      apoyo_en_el_congreso: Math.round(p.apoyo) + '%',
      pais: { dinero: s.dinero, inflacion: Math.round(s.inflacion), estabilidad: s.estabilidad, balance_por_turno: Math.round(e.balance || 0) },
      sectores: { ejercito: Math.round(RF.consejero.asegurar(e).sectores.ejercito), elite: Math.round(e.sectores.elite), felicidad: s.felicidad },
      economia: { sanciones: e.economia.sanciones + ' de 4', mercado_negro: Math.round(e.economia.mercadoNegro) + '%' },
      diplomacia: RF.diplomacia ? RF.diplomacia.paraIA(e) : undefined,
      leyes_vigentes: RF.leyes.lista(e).map(l => ({ id: l.clave, nombre: l.nombre, desde_turno: l.desde, nivel: l.nivel, por_turno: soloNumeros(RF.leyes.efectoNominal(l)), secreta: l.secreta || undefined })),
      gabinete, gente_de_a_pie: gente, otras_personas: otros,
      secretos_sin_descubrir: p.secretos.length, escandalos: p.escandalos,
      turnos_sin_evento: e.dilemas && e.dilemas.ultimo ? e.dia - e.dilemas.ultimo : e.dia,
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

  // "La privatización del aire de Brisa S.A." → "la privatización del aire de Brisa S.A." (sin romper nombres propios).
  const minuscula = t => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const clave = nombre => 'IA:' + T.normalizar(nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

  // ---------- Aplicar una ley de la ficha ----------
  function prepararLey(l, recortes) {
    const nombre = minuscula(limpiar(l.nombre, 120)) || 'una medida sin nombre';
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

  // Relaciones con las potencias (con tope ±25 cada una) y el arsenal nuclear.
  function aplicarRelaciones(e, ficha, res) {
    if (!RF.diplomacia) return;
    const r = ficha.relaciones && typeof ficha.relaciones === 'object' ? ficha.relaciones : {};
    const cambios = {};
    for (const id of Object.keys(RF.PAIS.relaciones || {})) {
      const v = Math.max(-25, Math.min(25, Math.round(Number(r[id]) || 0)));
      if (v) cambios[id] = v;
    }
    const hecho = RF.diplomacia.ajustar(e, cambios, res.notas);
    if (Object.keys(hecho).length) res.relaciones = Object.assign(res.relaciones || {}, hecho);
    if (typeof ficha.arsenal === 'boolean') RF.diplomacia.iniciar(e).arsenal = ficha.arsenal;
  }

  // Consecuencias que llegan más tarde (las cuenta el motor cuando toca).
  function programar(e, ficha, res, recortes) {
    for (const c of objetos(ficha.consecuencias, 2)) {
      const en = Math.max(1, Math.min(6, Math.round(Number(c.en_turnos) || 2)));
      const tit = limpiar(c.titulo, 80);
      if (!tit) continue;
      e.pendientes.push({ dia: e.dia + en, titulo: tit, texto: limpiar(c.texto, 400), efectos: efectos(c.efectos, TOPES.inicial, recortes) });
      res.programadas = (res.programadas || 0) + 1;
    }
  }

  function relacionesOpcion(r) {
    const out = {};
    if (!r || typeof r !== 'object') return out;
    for (const id of Object.keys(RF.PAIS.relaciones || {})) { const v = Math.max(-20, Math.min(20, Math.round(Number(r[id]) || 0))); if (v) out[id] = v; }
    return out;
  }

  // Un evento propio de la IA: no más de uno cada dos turnos y nunca encima de otro.
  function crearEvento(e, ev, res, recortes) {
    const D = e.dilemas;
    if (ev && typeof ev === 'object' && objetos(ev.opciones, 3).length >= 2 && !D.pendiente && (!D.ultimo || e.dia - D.ultimo >= 2)) {
      const id = 'ia_' + e.dia + '_' + Math.floor(Math.random() * 1e6);
      const opciones = objetos(ev.opciones, 3).map(o => {
        const din = Math.max(-15, Math.min(15, Number(o.por_turno_dinero) || 0));
        return { texto: limpiar(o.texto, 90) || 'Seguir adelante', resultado: limpiar(o.resultado, 400), efectos: efectos(o.efectos, TOPES.inicial, recortes), ingresos: din ? Math.round(din / 3 * 10) / 10 : 0, hecho: limpiar(o.hecho, 240), relaciones: relacionesOpcion(o.relaciones), sanciones: Math.max(-1, Math.min(1, Math.round(Number(o.sanciones) || 0))) };
      });
      D.custom = D.custom || {};
      D.custom[id] = { id, titulo: limpiar(ev.titulo, 80) || 'Una decisión', texto: limpiar(ev.texto, 700), opciones, ia: true };
      RF.director.forzar(e, id, {});
      res.dilema = id;
    }
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
    const titulo = minuscula(limpiar(ficha.titulo, 140)) || 'un decreto';
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

    // La economía: sanciones y mercado negro (con topes).
    const ecf = ficha.economia && typeof ficha.economia === 'object' ? ficha.economia : {};
    const dSan = Math.max(-2, Math.min(2, Math.round(Number(ecf.sanciones) || 0)));
    const dMer = Math.max(-40, Math.min(40, Math.round(Number(ecf.mercado_negro) || 0)));
    if (dSan || dMer) RF.consejero.ajustarEconomia(e, { sanciones: dSan, mercadoNegro: dMer }, res.notas);
    aplicarRelaciones(e, ficha, res);

    // 6. Lo que llega más tarde y lo que hay que recordar.
    programar(e, ficha, res, recortes);
    for (const h of (Array.isArray(ficha.hechos) ? ficha.hechos : []).slice(0, 3)) recordar(e, h);
    if (res.bloqueada) recordar(e, 'El Congreso bloqueó ' + titulo + '.');
    if (res.cambioRegimen) recordar(e, 'Corea del Norte pasó de ' + RF.REGIMENES[res.cambioRegimen.de].nombre + ' a ' + RF.REGIMENES[res.cambioRegimen.a].nombre + '.');

    // 7. Un evento propio, si toca.
    crearEvento(e, ficha.evento, res, recortes);

    if (recortes.length) res.notas.push('El motor moderó las cifras del Consejo para que fueran realistas.');
    e.historial.push({ dia: e.dia, accion: 'IA', objeto: 'IA', nombreObjeto: titulo, medida: titulo, texto });
    res.numero = e.historial.length;
    res.vars = { medida: titulo, Medida: T.mayus(titulo), objeto: titulo, lider: 'Líder Supremo' };
    res.ficha = ficha;
    return res;
  }

  // ---------- Contar el decreto (sin crónica, o como borrador para la crónica) ----------
  function bloques(e, ficha, res) {
    const out = [];
    out.push({ tipo: 'bot', texto: 'CONSEJO DE ESTADO › ' + (limpiar(ficha.interpretacion, 200) || T.mayus(res.medida)) });
    const pasos = (Array.isArray(ficha.logica) ? ficha.logica : []).map(x => limpiar(x, 220)).filter(Boolean).slice(0, 4);
    if (pasos.length) out.push({ tipo: 'logica', titulo: 'INFORME DEL CONSEJO', texto: pasos.join('\n') });
    const cab = res.bloqueada && !res.leyes.length ? 'PROYECTO DE LEY Nº ' : res.secreto ? 'ORDEN RESERVADA Nº ' : 'DECRETO Nº ';
    let gaceta = T.mayus(res.medida) + '.';
    const g = limpiar(ficha.gaceta, 500);
    if (g) gaceta += ' ' + g;
    if (res.bloqueada) gaceta += ' El proyecto llega al Congreso... y se atasca.';
    out.push({ tipo: 'gaceta', titulo: cab + res.numero + ' · TURNO ' + res.dia, texto: gaceta });
    out.push({ tipo: 'efectos', deltas: res.deltas, porTurno: res.porTurno, curvas: res.curvas, nivel: res.leyes.length === 1 ? res.leyes[0].nivel : undefined });
    for (const n of res.notas) out.push({ tipo: 'nota', texto: n });
    out.push(...reacciones(e, ficha, res));
    if (res.cambioRegimen) {
      const a = RF.REGIMENES[res.cambioRegimen.a];
      out.push({ tipo: 'regimen', titulo: 'CAMBIO DE RÉGIMEN · ' + RF.REGIMENES[res.cambioRegimen.de].corto + ' → ' + a.corto, texto: a.descripcion });
    }
    return out;
  }

  // Las secciones del turno (RADIO, PALACIO, EJÉRCITO, POBLACIÓN): el borrador que la crónica reescribe.
  function reacciones(e, ficha, res) {
    const out = [];
    const cab = id => RF.narrador.cabecera(e, id, res);
    const radio = limpiar(ficha.radio, 400) || (Array.isArray(ficha.titulares) ? ficha.titulares : []).map(x => limpiar(x, 200)).filter(Boolean).slice(0, 2).join(' ');
    if (radio) out.push({ tipo: 'radio', titulo: RF.PAIS.radio, texto: radio });
    const gb = ficha.gabinete && typeof ficha.gabinete === 'object' ? ficha.gabinete : {};
    const gid = String(gb.id || '').toLowerCase();
    if (RF.GABINETE[gid] && limpiar(gb.dice)) out.push({ tipo: 'cupula', titulo: cab('elite'), texto: limpiar(gb.dice) });
    const ej = ficha.ejercito && typeof ficha.ejercito === 'object' ? ficha.ejercito : {};
    if (limpiar(ej.dice)) out.push({ tipo: 'ejercito', titulo: cab('ejercito'), texto: limpiar(ej.dice) });
    const ca = ficha.calle && typeof ficha.calle === 'object' ? ficha.calle : {};
    const cid = String(ca.id || '').toLowerCase();
    if (RF.CIUDADANOS[cid] && limpiar(ca.dice) && (e.ciudadanos[cid].estado || 'libre') === 'libre') {
      e.ciudadanos[cid].ultimaVez = e.dia;
      out.push({ tipo: 'calle', titulo: cab('poblacion'), texto: limpiar(ca.dice) });
    }
    return out;
  }

  // ---------- Pedir la ficha ----------
  // Devuelve la ficha ya leída, o lanza un error con .mensaje.
  async function consultar(e, texto, alTexto) {
    const datos = contexto(e, texto);
    const contenido = 'Situación de Corea del Norte y decreto (JSON):\n' + JSON.stringify(datos) + '\n\nDevuelve solo la ficha JSON del decreto.';
    const r = await RF.narradorIA.generar(SISTEMA, contenido, alTexto, 3000);
    const ficha = extraerJSON(r.texto);
    if (!ficha || typeof ficha !== 'object') {
      const err = new Error('ficha ilegible');
      err.mensaje = 'El Consejo respondió algo que el motor no pudo leer.';
      throw err;
    }
    return ficha;
  }

  // ---------- Un turno sin decretos: el país sigue su curso ----------
  const MUNDO = 'Este turno el jugador NO firma ningún decreto: espera. Decide qué pasa en Corea del Norte por su propia inercia, como consecuencia lógica de las leyes vigentes, la memoria y la situación: la oposición se mueve, un ministro conspira, un sector protesta o prospera, el extranjero reacciona, algo que se sembró antes da fruto. Si hay leyes o hechos absurdos vigentes, lo que pase debe seguir su lógica (el siguiente paso lógico del disparate). Debe ser UNA cosa concreta, no un resumen. En la ficha: "titulo" es el nombre de lo que pasa ("la huelga de los estibadores"), "gaceta" lo cuenta en dos o tres frases, "efecto_unico" sus efectos (topes de "inicial"), y puedes usar "personas" solo con "accion": "animo", "consecuencias", "evento", "hechos", "radio", "gabinete", "ejercito", "calle", "economia" y "relaciones" (las potencias también se mueven solas: una cumbre, una amenaza, un barco de ayuda). NO uses "leyes", "derogar", "instituciones" ni "regimen": el gobierno no ha hecho nada.';

  async function consultarMundo(e, alTexto) {
    const contenido = 'Situación de Corea del Norte (JSON):\n' + JSON.stringify(contexto(e, '(ninguno: el jugador espera)')) + '\n\n' + MUNDO + '\n\nDevuelve solo la ficha JSON.';
    const r = await RF.narradorIA.generar(SISTEMA, contenido, alTexto, 2500);
    const ficha = extraerJSON(r.texto);
    if (!ficha || typeof ficha !== 'object') {
      const err = new Error('ficha ilegible');
      err.mensaje = 'El Consejo respondió algo que el motor no pudo leer.';
      throw err;
    }
    return ficha;
  }

  // Aplica lo que pasa solo. El gobierno no ha decidido nada: sin leyes, ni instituciones, ni tratos a personas.
  function aplicarMundo(e, ficha, res) {
    const recortes = [];
    const titulo = limpiar(ficha.titulo, 100);
    const deltas = {};
    RF.consejero.aplicarEfectos(e, efectos(ficha.efecto_unico, TOPES.inicial, recortes), deltas);
    for (const pe of objetos(ficha.personas, 3)) {
      const c = e.ciudadanos[String(pe.id || '').toLowerCase()];
      if (c && String(pe.accion).toLowerCase() === 'animo') c.animo = Math.max(-100, Math.min(100, c.animo + Math.max(-40, Math.min(40, Number(pe.valor) || 0))));
    }
    const texto = limpiar(ficha.gaceta, 600);
    if (titulo && texto) res.sucesos.push({ tipo: 'mundo', titulo, texto, deltas });
    programar(e, ficha, res, recortes);
    crearEvento(e, ficha.evento, res, recortes);
    aplicarRelaciones(e, ficha, res);
    for (const h of (Array.isArray(ficha.hechos) ? ficha.hechos : []).slice(0, 3)) recordar(e, h);
    res.ficha = ficha;
    return res;
  }

  RF.consejoIA = { consultarMundo, aplicarMundo, reacciones, limpiarTexto: limpiar, SISTEMA, TOPES, contexto, consultar, aplicar, aprobar, bloques, extraerJSON, recordar, memoria };
})(globalThis.RF = globalThis.RF || {});
