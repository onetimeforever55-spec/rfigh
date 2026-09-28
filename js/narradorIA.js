/*
 * EL NARRADOR CON IA (opcional)
 *
 * No decide nada ni recuerda la partida: el juego ya ha calculado todo lo que pasa en el turno.
 * Este módulo toma esos datos (el decreto, sus efectos, las leyes, los personajes, los sucesos
 * y los textos que el Narrador normal ha escrito) y le pide a Claude que los convierta en una
 * crónica bonita. Si no hay clave, falla la conexión o la IA no responde, el juego sigue con
 * su narración de siempre.
 *
 * Fuentes: tu propia cuenta de Claude cuando el juego se abre dentro de claude.ai (sin clave),
 * Claude por API (con el SDK oficial de Anthropic, cargado desde jsDelivr solo cuando se usa)
 * y los que hablan el formato de OpenAI (OpenRouter, Gemini, Groq), por fetch. El proveedor se
 * reconoce por la forma de la clave. La clave del jugador se guarda únicamente en su navegador.
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

  // Los proveedores que hablan el formato de OpenAI. "modelo" es el que se usa si el jugador no elige.
  const PROVEEDORES = {
    cuenta: { nombre: 'Claude (tu cuenta de claude.ai)' }, // sin clave: solo dentro de claude.ai
    anthropic: { nombre: 'Claude (Anthropic)', clave: /^sk-ant-/, ejemplo: 'sk-ant-…' },
    openrouter: { nombre: 'OpenRouter', clave: /^sk-or-/, ejemplo: 'sk-or-…', base: 'https://openrouter.ai/api/v1', soloGratis: true },
    gemini: { nombre: 'Google Gemini', clave: /^AIza/, ejemplo: 'AIza…', base: 'https://generativelanguage.googleapis.com/v1beta/openai', modelo: 'gemini-2.5-flash' },
    groq: { nombre: 'Groq', clave: /^gsk_/, ejemplo: 'gsk_…', base: 'https://api.groq.com/openai/v1', modelo: 'llama-3.3-70b-versatile' }
  };

  function detectar(clave) {
    for (const [id, p] of Object.entries(PROVEEDORES)) if (p.clave && p.clave.test((clave || '').trim())) return id;
    return null;
  }

  // Las piezas de texto que la crónica sustituye (los números y los eventos se quedan).
  const NARRATIVOS = new Set(['prensa', 'cupula', 'calle', 'amanecer']);

  let config = { activa: false, clave: '', proveedor: '', modelo: '' };
  try { Object.assign(config, JSON.parse(localStorage.getItem(CLAVE_CONFIG) || '{}')); } catch (e) { /* sin almacenamiento */ }

  function guardar(nueva) {
    Object.assign(config, nueva);
    try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config)); } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Tu cuenta de Claude (solo dentro de claude.ai) ----------
  // Los niveles de modelo que ofrece claude.ai a las páginas.
  const NIVELES = [
    { id: 'default', nombre: 'Normal · buena prosa' },
    { id: 'quick', nombre: 'Rápido · al instante' },
    { id: 'complex', nombre: 'El mejor · más lento' }
  ];
  let cuentaFn = null, cuentaLista = false;
  const cuentaPromesa = (async () => {
    try {
      if (!globalThis.claude || typeof globalThis.claude.use !== 'function') return null;
      cuentaFn = await globalThis.claude.use('sample');
    } catch (e) { cuentaFn = null; }
    return cuentaFn;
  })().finally(() => { cuentaLista = true; });
  // true / false; o null mientras claude.ai no ha respondido.
  function cuentaDisponible() { return cuentaFn ? true : cuentaLista ? false : null; }

  function activa() {
    if (proveedor() === 'cuenta') return !!config.activa && cuentaDisponible() !== false;
    return !!(config.activa && config.clave);
  }
  function proveedor() { return config.proveedor || detectar(config.clave) || 'anthropic'; }
  // El modelo en uso. En Claude es una ficha de MODELOS; en los demás, el nombre que dé el proveedor.
  function modelo() {
    if (proveedor() === 'cuenta') { const n = NIVELES.find(x => x.id === config.nivel) || NIVELES[0]; return { id: n.id, nombre: n.nombre.split(' · ')[0] }; }
    if (proveedor() === 'anthropic') return MODELOS.find(m => m.id === config.modelo) || MODELOS[0];
    const id = config.modelo || PROVEEDORES[proveedor()].modelo || '';
    return { id, nombre: id || 'automático' };
  }

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
    '- "memoria_del_mundo" es lo que ya pasó en turnos anteriores: úsala para dar continuidad (volver a un personaje, a un lugar, a una consecuencia), sin repetirla entera.',
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
      memoria_del_mundo: (estado.memoria || []).slice(-10).map(m => 'Turno ' + m.dia + ': ' + m.texto),
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

  function peticion(contenido, maxTokens, sistema) {
    const m = modelo();
    const params = {
      model: m.id,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: sistema || SISTEMA, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contenido }]
    };
    if (m.effort) params.output_config = { effort: m.effort };
    // En Claude Opus 5, si un filtro de seguridad rechaza la petición, la API la repite con el modelo recomendado.
    if (m.fallbacks) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
    return params;
  }

  // Traduce los errores del SDK a algo que el jugador entienda.
  function explicar(err, Anthropic) {
    if (Anthropic && err instanceof Anthropic.AuthenticationError) return 'La clave de la API no es válida. Revísala en el botón IA.';
    if (Anthropic && err instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para usar este modelo. Prueba otro en el botón IA.';
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
  function contenidoTurno(estado, bloques) {
    return 'Datos del turno (JSON):\n' + JSON.stringify(datosTurno(estado, bloques)) + '\n\nEscribe la crónica de este turno.';
  }

  async function generarClaude(sistema, contenido, alTexto, maxTokens) {
    let Anthropic = null;
    try {
      const c = await cliente();
      Anthropic = c.Anthropic;
      const params = peticion(contenido, maxTokens || 4000, sistema);
      const stream = params.betas ? c.client.beta.messages.stream(params) : c.client.messages.stream(params);
      let texto = '';
      stream.on('text', (delta) => { texto += delta; if (alTexto) alTexto(texto); });
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') { const e = new Error('refusal'); e.refusal = true; throw e; }
      if (!texto.trim()) throw new Error('respuesta vacía');
      const u = final.usage || {};
      return { texto: texto.trim(), uso: { entrada: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), cache: u.cache_read_input_tokens || 0, salida: u.output_tokens || 0 }, modelo: final.model };
    } catch (err) {
      err.mensaje = explicar(err, Anthropic);
      throw err;
    }
  }

  // Una petición mínima para comprobar que la clave y la conexión funcionan.
  async function probarClaude() {
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

  // ---------- Proveedores con formato OpenAI (OpenRouter, Gemini, Groq) ----------
  function cabeceras(clave, prov) {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (clave || config.clave) };
    if ((prov || proveedor()) === 'openrouter') h['X-Title'] = 'Consola de Valdoria';
    return h;
  }

  function errorHTTP(status, detalle) {
    const e = new Error(detalle || ('HTTP ' + status));
    e.status = status;
    return e;
  }

  function explicarCompatible(err) {
    const p = PROVEEDORES[proveedor()].nombre;
    if (err.refusal) return 'El modelo prefirió no narrar este turno.';
    if (err.status === 401 || err.status === 403) return 'La clave de ' + p + ' no es válida o no tiene permiso. Revísala en el botón IA.';
    if (err.status === 429) return p + ' dice que has llegado al límite de peticiones (en los modelos gratis es bajo). Espera un rato o elige otro modelo en el botón IA.';
    if (err.status === 402) return p + ' pide saldo para este modelo. Elige uno gratis en el botón IA.';
    if (err.status === 400 || err.status === 404) return p + ' no aceptó el modelo "' + modelo().id + '"' + (err.message ? ' (' + err.message.slice(0, 120) + ')' : '') + '. Elige otro en el botón IA.';
    if (err.status) return p + ' respondió con un error (' + err.status + ').';
    if (err instanceof TypeError) return 'No se pudo conectar con ' + p + '. Si estás jugando dentro de la página de Claude, el visor bloquea las conexiones externas: abre el juego desde GitHub Pages o el archivo dist/valdoria.html.';
    return 'La IA falló (' + (err.message || 'error desconocido') + ').';
  }

  async function leerError(r) {
    let detalle = '';
    try { const j = await r.json(); detalle = (j.error && (j.error.message || j.error)) || j.message || ''; if (Array.isArray(j) && j[0] && j[0].error) detalle = j[0].error.message; } catch (e) { /* sin cuerpo */ }
    return errorHTTP(r.status, typeof detalle === 'string' ? detalle : JSON.stringify(detalle));
  }

  // Los modelos del proveedor (por defecto, el de la clave guardada). En OpenRouter, solo los gratis.
  async function listarModelos(clave, prov) {
    prov = prov || proveedor();
    const p = PROVEEDORES[prov];
    if (!p.base) return [];
    const r = await fetch(p.base + '/models', { headers: cabeceras(clave, prov) });
    if (!r.ok) throw await leerError(r);
    const j = await r.json();
    let lista = (j.data || j.models || []).map(m => ({ id: String(m.id || m.name || '').replace(/^models\//, ''), gratis: /:free$/.test(m.id || '') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0), contexto: m.context_length || 0 }));
    lista = lista.filter(m => m.id && !/embed|whisper|tts|guard|image|vision-only|audio|imagen|veo|aqa/i.test(m.id));
    if (p.soloGratis) lista = lista.filter(m => m.gratis);
    return lista.map(m => m.id);
  }

  // Si no hay modelo elegido, se escoge uno: en OpenRouter, el gratis que mejor escribe de los conocidos.
  const PREFERIDOS = [/deepseek.*(v3|chat)/i, /llama-3\.3-70b/i, /gemini/i, /qwen.*(72|235|max)/i, /mistral.*(medium|large|small-3)/i, /llama/i, /qwen/i];
  async function asegurarModelo() {
    if (proveedor() === 'anthropic' || modelo().id) return modelo().id;
    const lista = await listarModelos();
    if (!lista.length) throw errorHTTP(404, 'no hay modelos gratis disponibles ahora mismo');
    const elegido = PREFERIDOS.map(re => lista.find(id => re.test(id) && !/r1|think|reason/i.test(id))).find(Boolean) || lista[0];
    guardar({ modelo: elegido, auto: true });
    return elegido;
  }

  function cuerpo(contenido, maxTokens, stream, sistema) {
    return JSON.stringify({
      model: modelo().id,
      messages: [{ role: 'system', content: sistema || SISTEMA }, { role: 'user', content: contenido }],
      max_tokens: maxTokens,
      temperature: 0.9,
      stream
    });
  }

  // Algunos modelos gratis piensan en voz alta dentro de <think>…</think>: eso no es crónica.
  const limpiar = t => t.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, '');

  async function generarCompatible(sistema, contenido, alTexto, maxTokens) {
    try {
      await asegurarModelo();
      const r = await fetch(PROVEEDORES[proveedor()].base + '/chat/completions', { method: 'POST', headers: cabeceras(), body: cuerpo(contenido, maxTokens || 1500, true, sistema) });
      if (!r.ok) throw await leerError(r);
      const lector = r.body.getReader();
      const dec = new TextDecoder();
      let pendiente = '', bruto = '', uso = null, fin = null, modeloReal = null;
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        pendiente += dec.decode(value, { stream: true });
        const lineas = pendiente.split('\n');
        pendiente = lineas.pop();
        for (const linea of lineas) {
          if (!linea.startsWith('data:')) continue; // comentarios como ": OPENROUTER PROCESSING"
          const dato = linea.slice(5).trim();
          if (!dato || dato === '[DONE]') continue;
          let j; try { j = JSON.parse(dato); } catch (e) { continue; }
          if (j.error) throw errorHTTP(j.error.code || 500, j.error.message);
          if (j.usage) uso = j.usage;
          if (j.model) modeloReal = j.model;
          const c = j.choices && j.choices[0];
          if (!c) continue;
          if (c.finish_reason) fin = c.finish_reason;
          const trozo = c.delta && c.delta.content;
          if (trozo) { bruto += trozo; if (alTexto) alTexto(limpiar(bruto)); }
        }
      }
      if (fin === 'content_filter') { const e = new Error('refusal'); e.refusal = true; throw e; }
      const texto = limpiar(bruto).trim();
      if (!texto) throw new Error('respuesta vacía');
      return { texto, uso: uso ? { entrada: uso.prompt_tokens || 0, cache: (uso.prompt_tokens_details && uso.prompt_tokens_details.cached_tokens) || 0, salida: uso.completion_tokens || 0 } : null, modelo: modeloReal || modelo().id };
    } catch (err) {
      err.mensaje = explicarCompatible(err);
      // Si el modelo lo eligió el juego y ya no está (los gratis cambian), el próximo turno se elige otro.
      if ((err.status === 400 || err.status === 404) && config.auto) { guardar({ modelo: '' }); err.mensaje += ' El próximo turno probaré con otro modelo gratis.'; }
      throw err;
    }
  }

  async function probarCompatible() {
    try {
      await asegurarModelo();
      const r = await fetch(PROVEEDORES[proveedor()].base + '/chat/completions', { method: 'POST', headers: cabeceras(), body: cuerpo('Responde solo con la palabra: Listo', 300, false) });
      if (!r.ok) throw await leerError(r);
      const j = await r.json();
      if (j.error) throw errorHTTP(j.error.code || 500, j.error.message);
      return { ok: true, mensaje: 'Conexión correcta con ' + PROVEEDORES[proveedor()].nombre + ' (' + (j.model || modelo().id) + '). La crónica con IA está lista.' };
    } catch (err) {
      return { ok: false, mensaje: explicarCompatible(err) };
    }
  }

  // ---------- Con tu cuenta de Claude ----------
  // Los errores que significan "aquí no se puede": se pausa la IA para no insistir.
  const CUENTA_NO = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
  function explicarCuenta(e) {
    const c = e && e.code;
    if (c === 'not_granted') return 'No diste permiso para que Claude narre desde esta página.';
    if (CUENTA_NO.has(c)) return 'Claude no está disponible para esta página ahora mismo.';
    if (c === 'unavailable') return 'Tu cuenta de Claude solo funciona abriendo el juego dentro de claude.ai.';
    if (c === 'rate_limited') return 'Has llegado al límite de uso de tu plan de Claude (o hay demasiadas peticiones seguidas). Prueba más tarde.';
    if (c === 'session_expired') return 'Tu sesión de claude.ai ha caducado: vuelve a iniciar sesión.';
    if (c === 'refused') return 'Claude prefirió no narrar este turno.';
    if (c === 'prompt_too_large') return 'Los datos del turno son demasiado largos para Claude.';
    return 'Claude no pudo terminar la crónica (' + (c || 'error') + ').';
  }

  async function llamarCuenta(texto, opciones) {
    const fn = cuentaFn || await cuentaPromesa;
    if (!fn) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
    return fn(texto, opciones);
  }

  async function generarCuenta(sistema, contenido, alTexto) {
    try {
      // Aquí no hay "system": las reglas van delante de los datos.
      const r = await llamarCuenta((sistema || SISTEMA) + '\n\n---\n\n' + contenido, {
        modelTier: modelo().id,
        onText: ({ text }) => { if (alTexto) alTexto(text); }
      });
      const n = NIVELES.find(x => x.id === r.modelTierApplied);
      return { texto: r.text.trim(), uso: null, modelo: 'tu cuenta de Claude · ' + (n ? n.nombre.split(' · ')[0].toLowerCase() : r.modelTierApplied || modelo().id) + (r.truncated ? ' · cortada' : '') };
    } catch (e) {
      const err = e instanceof Error ? e : Object.assign(new Error(e && e.message || 'error'), e);
      err.mensaje = explicarCuenta(err);
      err.pausar = CUENTA_NO.has(err.code) || err.code === 'unavailable';
      throw err;
    }
  }

  async function probarCuenta() {
    try {
      const r = await llamarCuenta('Responde solo con la palabra: Listo', { modelTier: 'quick', cache: false });
      return { ok: !!r.text, mensaje: 'Conexión correcta con tu cuenta de Claude. La crónica con IA está lista.' };
    } catch (e) {
      return { ok: false, mensaje: explicarCuenta(e) };
    }
  }

  // ---------- Lo que usa el juego ----------
  // Pide un texto a la IA configurada (con sus reglas y los datos). Lanza un error con .mensaje si falla.
  function generar(sistema, contenido, alTexto, maxTokens) {
    const p = proveedor();
    return p === 'cuenta' ? generarCuenta(sistema, contenido, alTexto) : p === 'anthropic' ? generarClaude(sistema, contenido, alTexto, maxTokens) : generarCompatible(sistema, contenido, alTexto, maxTokens);
  }
  function narrar(estado, bloques, alTexto) {
    return generar(SISTEMA, contenidoTurno(estado, bloques) + ' Responde solo con la crónica.', alTexto);
  }
  function probar() { const p = proveedor(); return p === 'cuenta' ? probarCuenta() : p === 'anthropic' ? probarClaude() : probarCompatible(); }

  function textoUso(r) {
    const u = r.uso;
    const k = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
    const cab = 'CRÓNICA IA · ' + (r.modelo || modelo().id);
    if (!u) return cab;
    return cab + ' · ' + k(u.entrada) + ' tokens de entrada' + (u.cache ? ' (' + k(u.cache) + ' en caché)' : '') + ' · ' + k(u.salida) + ' de salida';
  }

  RF.narradorIA = { MODELOS, NIVELES, cuentaDisponible, cuentaPromesa, PROVEEDORES, NARRATIVOS, config: () => config, guardar, activa, proveedor, detectar, modelo, listarModelos, datosTurno, narrar, probar, textoUso, cargarSDK, peticion, generar, SISTEMA };
})(globalThis.RF = globalThis.RF || {});
