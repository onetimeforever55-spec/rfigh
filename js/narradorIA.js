/*
 * EL NARRADOR CON IA (opcional)
 *
 * No decide nada ni recuerda la partida: el juego ya ha calculado todo lo que pasa en el turno.
 * Este módulo toma esos datos (el decreto, sus efectos, las leyes, los personajes, los sucesos
 * y los textos que el Narrador normal ha escrito) y le pide a Claude que los convierta en una
 * crónica bonita. Si no hay clave, falla la conexión o Claude no responde, el juego sigue con
 * su narración de siempre.
 *
 * Usa el SDK oficial de Anthropic, cargado desde jsDelivr solo cuando se activa.
 * La clave del jugador se guarda únicamente en su navegador.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const CLAVE_CONFIG = 'valdoria.ia.v1';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';

  // effort solo existe en los modelos que lo admiten; Haiku 4.5 no.
  const MODELOS = [
    { id: 'claude-opus-5', nombre: 'Claude Opus 5 · la mejor prosa', effort: 'low', fallbacks: true },
    { id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5 · más barato', effort: 'low' },
    { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5 · el más barato y rápido' }
  ];

  // Las piezas de texto que la crónica sustituye (los números y los eventos se quedan).
  const NARRATIVOS = new Set(['prensa', 'cupula', 'calle', 'amanecer']);

  let config = { activa: false, clave: '', modelo: MODELOS[0].id };
  try { Object.assign(config, JSON.parse(localStorage.getItem(CLAVE_CONFIG) || '{}')); } catch (e) { /* sin almacenamiento */ }

  function guardar(nueva) {
    Object.assign(config, nueva);
    try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config)); } catch (e) { /* sin almacenamiento */ }
  }

  function activa() { return !!(config.activa && config.clave); }
  function modelo() { return MODELOS.find(m => m.id === config.modelo) || MODELOS[0]; }

  // ---------- Qué sabe Claude del mundo (fijo: se puede cachear) ----------
  const SISTEMA = [
    'Eres el cronista de "Consola de Valdoria", un juego satírico en el que el jugador gobierna la República de Valdoria, un país caribeño ficticio, escribiendo decretos.',
    'El juego ya ha calculado todo lo que ocurre. Tu único trabajo es contar este turno como una pequeña crónica literaria, a partir de los datos que te llegan.',
    '',
    'Reglas:',
    '- Escribe en español, en segunda persona, dirigiéndote al gobernante ("tú"). La gente le llama "Su Excelencia" (o "Su Majestad" si es monarquía).',
    '- Usa SOLO los hechos de los datos: no inventes decretos, eventos, muertes ni cambios de régimen, y no contradigas ningún resultado. Puedes añadir detalles de ambiente y figurantes anónimos (una vendedora, un soldado, un taxista).',
    '- Los personajes con nombre son los que aparecen en los datos. Usa sus nombres y cargos tal como vienen.',
    '- No des cifras nuevas. Puedes mencionar una o dos cifras de los datos si ayudan, pero cuenta los efectos sobre todo con imágenes ("las arcas engordan", "en los mercados se habla bajito").',
    '- Si en los datos hay un cambio de régimen, un escándalo, una decisión en un evento o un final de partida, eso es el centro de la crónica.',
    '- Los textos que te llegan ("textos_del_juego") son un borrador: reescríbelos con mejor prosa, no los copies.',
    '- Tono: humor negro y ternura a la vez, como una novela latinoamericana sobre un dictador. Sin sermones. La violencia se sugiere, no se describe con detalle gráfico.',
    '- Formato: entre 120 y 220 palabras, de 2 a 4 párrafos cortos. Sin títulos, sin listas, sin markdown, sin comillas alrededor de todo el texto.',
    '',
    'El mundo: Valdoria vive del plátano, el petróleo y el comercio. Su capital es Puerto Esperanza; el barrio más querido es La Esperanza.',
    'La gente de a pie que aparece a menudo: Doña Carmen (67 años, vende arepas desde hace cuarenta años), su nieto Nico (19, estudiante de periodismo, siempre con el celular), Ramiro (45, taxista con opinión sobre todo) y Lucía (34, enfermera del Hospital Central con dos hijos).',
    'La oposición la lidera Ernesto Valiente. En la embajada de la Unión Atlántica, un embajador vigila con cara de preocupación.',
    'Los medios: El Patriota (periódico oficial), The Global Tribune (prensa extranjera) y Radio Libertad (radio pirata).'
  ].join('\n');

  // ---------- Los datos del turno ----------
  function redondear(o) {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) if (v) out[k] = Math.round(v * 10) / 10;
    return out;
  }

  function datosTurno(estado, bloques) {
    const s = estado.stats;
    const p = estado.politica || {};
    const hechos = [];
    const textos = [];
    for (const b of bloques) {
      if (b.tipo === 'efectos') hechos.push({ tipo: b.rotulo || 'efectos del decreto', cambios: redondear(b.deltas), cada_turno: b.porTurno ? redondear(b.porTurno) : undefined });
      else if (NARRATIVOS.has(b.tipo)) textos.push((b.titulo ? b.titulo + ': ' : '') + b.texto);
      else if (b.tipo === 'dilema') hechos.push({ tipo: 'evento pendiente de decisión', titulo: b.titulo, texto: b.texto, opciones: b.opciones.map(o => o.texto) });
      else if (b.tipo === 'bot' || b.tipo === 'eco' || b.tipo === 'sistema' || b.tipo === 'titulo') continue;
      else if (b.texto) hechos.push({ tipo: b.tipo, titulo: b.titulo || undefined, texto: b.texto, cambios: b.deltas ? redondear(b.deltas) : undefined });
    }
    return {
      turno: estado.dia,
      regimen: RF.REGIMENES && p.regimen ? RF.REGIMENES[p.regimen].nombre : 'Democracia',
      pais: { dinero_millones: s.dinero, inflacion_pct: Math.round(s.inflacion), estabilidad: s.estabilidad, felicidad: s.felicidad },
      gabinete: Object.entries(RF.GABINETE).map(([id, m]) => (estado.gabinete && estado.gabinete[id] ? estado.gabinete[id].nombre : m.nombre) + ' (' + m.cargo + ')'),
      gente: Object.entries(estado.ciudadanos || {}).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + ({ muerto: 'muerto/a', preso: 'en la cárcel', exiliado: 'en el exilio' }[c.estado] || (c.animo > 25 ? 'te apoya' : c.animo < -25 ? 'te detesta' : 'desconfía'))),
      leyes_vigentes: (estado.leyes || []).slice(-8).map(l => l.nombre),
      hechos,
      textos_del_juego: textos
    };
  }

  // ---------- Conexión ----------
  let sdk = null;
  async function cargarSDK() {
    if (!sdk) sdk = await import(/* webpackIgnore: true */ SDK_URL);
    return sdk.default || sdk;
  }

  async function cliente() {
    const Anthropic = await RF.narradorIA.cargarSDK();
    // opcionesCliente permite a las pruebas pasar un fetch simulado.
    const opciones = Object.assign({ apiKey: config.clave, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60000 }, RF.narradorIA.opcionesCliente || {});
    return { Anthropic, client: new Anthropic(opciones) };
  }

  function peticion(contenido, maxTokens) {
    const m = modelo();
    const params = {
      model: m.id,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contenido }]
    };
    if (m.effort) params.output_config = { effort: m.effort };
    // En Claude Opus 5, si un filtro de seguridad rechaza la petición, la API la repite con el modelo recomendado.
    if (m.fallbacks) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
    return params;
  }

  // Traduce los errores del SDK a algo que el jugador entienda.
  function explicar(err, Anthropic) {
    if (Anthropic && err instanceof Anthropic.AuthenticationError) return 'La clave de la API no es válida. Revísala en "ia".';
    if (Anthropic && err instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para usar este modelo. Prueba otro en "ia".';
    if (Anthropic && err instanceof Anthropic.RateLimitError) return 'Demasiadas peticiones seguidas a la API. Espera un momento.';
    if (Anthropic && err instanceof Anthropic.BadRequestError) return 'La API rechazó la petición: ' + (err.message || 'petición no válida') + '.';
    if (Anthropic && err instanceof Anthropic.APIConnectionError) return 'No se pudo conectar con la API. Si estás jugando dentro de la página de Claude, el visor bloquea las conexiones externas: abre el juego desde GitHub Pages o el archivo dist/valdoria.html.';
    if (Anthropic && err instanceof Anthropic.APIError) return 'La API respondió con un error (' + (err.status || '?') + ').';
    if (err && err.refusal) return 'El modelo prefirió no narrar este turno.';
    return 'No se pudo cargar el narrador con IA (' + (err && err.message ? err.message : 'error desconocido') + '). Si estás dentro de la página de Claude, abre el juego desde GitHub Pages o el archivo dist/valdoria.html.';
  }

  /*
   * Narra un turno. alTexto(textoAcumulado) se llama con cada trozo que llega.
   * Devuelve { texto, uso } o lanza un error con .mensaje listo para mostrar.
   */
  async function narrar(estado, bloques, alTexto) {
    let Anthropic = null;
    try {
      const c = await cliente();
      Anthropic = c.Anthropic;
      const datos = datosTurno(estado, bloques);
      const contenido = 'Datos del turno (JSON):\n' + JSON.stringify(datos) + '\n\nEscribe la crónica de este turno.';
      const params = peticion(contenido, 4000);
      const stream = params.betas ? c.client.beta.messages.stream(params) : c.client.messages.stream(params);
      let texto = '';
      stream.on('text', (delta) => { texto += delta; if (alTexto) alTexto(texto); });
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') { const e = new Error('refusal'); e.refusal = true; throw e; }
      if (!texto.trim()) throw new Error('respuesta vacía');
      return { texto: texto.trim(), uso: final.usage, modelo: final.model };
    } catch (err) {
      err.mensaje = explicar(err, Anthropic);
      throw err;
    }
  }

  // Una petición mínima para comprobar que la clave y la conexión funcionan.
  async function probar() {
    let Anthropic = null;
    try {
      const c = await cliente();
      Anthropic = c.Anthropic;
      const params = peticion('Responde solo con la palabra: Listo', 200);
      const final = await (params.betas ? c.client.beta.messages.create(params) : c.client.messages.create(params));
      if (final.stop_reason === 'refusal') return { ok: false, mensaje: 'El modelo rechazó la prueba.' };
      return { ok: true, mensaje: 'Conexión correcta con ' + final.model + '. La crónica con IA está lista.' };
    } catch (err) {
      return { ok: false, mensaje: explicar(err, Anthropic) };
    }
  }

  function textoUso(r) {
    const u = r.uso || {};
    const entrada = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const k = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
    return 'CRÓNICA IA · ' + (r.modelo || modelo().id) + ' · ' + k(entrada) + ' tokens de entrada' + (u.cache_read_input_tokens ? ' (' + k(u.cache_read_input_tokens) + ' en caché)' : '') + ' · ' + k(u.output_tokens || 0) + ' de salida';
  }

  RF.narradorIA = { MODELOS, NARRATIVOS, config: () => config, guardar, activa, modelo, datosTurno, narrar, probar, textoUso, cargarSDK, peticion, SISTEMA };
})(globalThis.RF = globalThis.RF || {});
