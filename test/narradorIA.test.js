// Prueba del narrador con IA usando el SDK oficial y respuestas simuladas (no gasta dinero ni necesita clave).
// node test/narradorIA.test.js
let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { console.log('Narrador IA: se omite (instala las dependencias con "npm install")'); process.exit(0); }
// claude.ai simulado: la página puede pedirle texto a Claude con la cuenta del jugador.
let alSample = null, ultimoSample = null;
async function sampleFalso(input, opciones) { ultimoSample = { input, opciones }; return alSample(input, opciones); }
globalThis.claude = { use: async (nombre) => (nombre === 'sample' ? sampleFalso : null) };
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

// Una respuesta en streaming como la que devuelve la API.
function sse(trozos, stopReason) {
  const eventos = [
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 800 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ...trozos.map(t => ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }]),
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: stopReason || 'end_turn', stop_sequence: null }, usage: { output_tokens: 240 } }],
    ['message_stop', { type: 'message_stop' }]
  ];
  const cuerpo = eventos.map(([ev, d]) => 'event: ' + ev + '\ndata: ' + JSON.stringify(d) + '\n\n').join('');
  return new Response(cuerpo, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

let ultima = null;
function simular(respuesta) {
  RF.narradorIA.opcionesCliente = {
    fetch: async (url, init) => {
      ultima = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
      if (respuesta instanceof Error) throw respuesta;
      return typeof respuesta === 'function' ? respuesta() : respuesta;
    },
    maxRetries: 0
  };
}
RF.narradorIA.cargarSDK = async () => Anthropic.default || Anthropic;

(async () => {
  const e = RF.consejero.nuevoEstado();
  e.politica.apoyo = 100;
  const i = RF.interprete.interpretar('vender el aire', e);
  const res = RF.consejero.decretar(e, i);
  const bloques = RF.narrador.decreto(e, i, res).concat(RF.narrador.cierreDia(e, res));

  console.log('DATOS DEL TURNO');
  const datos = RF.narradorIA.datosTurno(e, bloques);
  comprobar(datos.hechos.some(h => h.texto && /privatización del aire/i.test(h.texto)), 'incluyen el decreto de la Gaceta');
  comprobar(datos.hechos.some(h => h.cada_turno && h.cada_turno.dinero > 0), 'incluyen los efectos por turno de la ley');
  comprobar(datos.textos_del_juego.length >= 2, 'incluyen los textos narrativos como borrador');
  comprobar(datos.gabinete.length === 6 && datos.pais.dinero_millones === e.stats.dinero, 'incluyen el gabinete y los indicadores');

  console.log('PETICIÓN CON CLAUDE OPUS 5');
  RF.narradorIA.guardar({ activa: true, clave: 'sk-ant-prueba', modelo: 'claude-opus-5' });
  simular(() => sse(['Amanece en Puerto Esperanza ', 'y el aire, por primera vez, ', 'tiene precio.']));
  const trozos = [];
  const r = await RF.narradorIA.narrar(e, bloques, t => trozos.push(t));
  comprobar(ultima.url.includes('/v1/messages') && ultima.body.stream === true, 'usa el endpoint de mensajes en streaming');
  comprobar(ultima.body.model === 'claude-opus-5' && ultima.body.output_config.effort === 'low', 'modelo claude-opus-5 con effort bajo');
  comprobar(ultima.body.fallbacks === 'default' && (ultima.headers.get('anthropic-beta') || '').includes('server-side-fallback-2026-07-01'), 'activa los fallbacks del servidor ante rechazos');
  comprobar(ultima.body.system[0].cache_control && ultima.body.system[0].text.includes('Valdoria'), 'el contexto del mundo va en el system, marcado para caché');
  comprobar(ultima.headers.get('x-api-key') === 'sk-ant-prueba', 'envía la clave del jugador');
  comprobar(ultima.body.messages[0].content.includes('"hechos"'), 'envía los datos del turno');
  comprobar(trozos.length === 3 && r.texto === 'Amanece en Puerto Esperanza y el aire, por primera vez, tiene precio.', 'el texto llega por trozos y se une bien');
  comprobar(/2\.0k tokens de entrada \(800 en caché\)/.test(RF.narradorIA.textoUso(r)) && /240 de salida/.test(RF.narradorIA.textoUso(r)), 'informa del consumo: ' + RF.narradorIA.textoUso(r));

  console.log('PETICIÓN CON HAIKU 4.5');
  RF.narradorIA.guardar({ modelo: 'claude-haiku-4-5' });
  simular(() => sse(['Texto.']));
  await RF.narradorIA.narrar(e, bloques);
  comprobar(ultima.body.model === 'claude-haiku-4-5' && !ultima.body.output_config && !ultima.body.fallbacks, 'Haiku va sin effort ni fallbacks (no los admite)');

  console.log('ERRORES');
  RF.narradorIA.guardar({ modelo: 'claude-opus-5' });
  simular(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
  let err = await RF.narradorIA.narrar(e, bloques).catch(x => x);
  comprobar(/clave/.test(err.mensaje || ''), 'clave mala: "' + err.mensaje + '"');
  simular(new TypeError('Failed to fetch'));
  err = await RF.narradorIA.narrar(e, bloques).catch(x => x);
  comprobar(/conectar/.test(err.mensaje || ''), 'sin conexión: "' + err.mensaje + '"');
  simular(() => sse([''], 'refusal'));
  err = await RF.narradorIA.narrar(e, bloques).catch(x => x);
  comprobar(/prefirió no narrar/.test(err.mensaje || ''), 'rechazo del modelo: "' + err.mensaje + '"');
  simular(() => new Response(JSON.stringify({ id: 'msg_2', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: 'Listo' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  const prueba = await RF.narradorIA.probar();
  comprobar(prueba.ok && /claude-opus-5/.test(prueba.mensaje) && ultima.body.stream !== true, 'el botón "Probar" hace una petición corta: "' + prueba.mensaje + '"');

  console.log('PROVEEDORES POR LA CLAVE');
  const NI = RF.narradorIA;
  comprobar(NI.detectar('sk-or-v1-abc') === 'openrouter' && NI.detectar('AIzaSyX') === 'gemini' && NI.detectar('gsk_123') === 'groq' && NI.detectar(' sk-ant-api03 ') === 'anthropic' && NI.detectar('hola') === null, 'reconoce OpenRouter, Gemini, Groq y Claude');

  console.log('OPENROUTER (GRATIS)');
  const peticiones = [];
  let chat = null;
  globalThis.fetch = async (url, init) => {
    peticiones.push({ url: String(url), init });
    if (String(url).endsWith('/models')) {
      return new Response(JSON.stringify({ data: [
        { id: 'anthropic/claude-opus-5', pricing: { prompt: '0.000015', completion: '0.00007' } },
        { id: 'deepseek/deepseek-r1:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'qwen/qwen3-8b:free', pricing: { prompt: '0', completion: '0' } }
      ] }), { status: 200 });
    }
    return chat();
  };
  const sseOA = (trozos, extra) => {
    const lineas = [': OPENROUTER PROCESSING', ''];
    trozos.forEach(t => lineas.push('data: ' + JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', choices: [{ delta: { content: t }, finish_reason: null }] }), ''));
    lineas.push('data: ' + JSON.stringify(Object.assign({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1800, completion_tokens: 210 } }, extra || {})), '', 'data: [DONE]', '');
    const texto = lineas.join('\n');
    // Se parte en trozos raros para comprobar que las líneas cortadas se unen bien.
    const enc = new TextEncoder().encode(texto);
    return new Response(new ReadableStream({ start(c) { for (let i = 0; i < enc.length; i += 37) c.enqueue(enc.slice(i, i + 37)); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  NI.guardar({ clave: 'sk-or-v1-prueba', proveedor: 'openrouter', modelo: '', activa: true });
  comprobar((await NI.listarModelos()).join() === 'deepseek/deepseek-r1:free,meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-8b:free', 'lista solo los modelos gratis');
  chat = () => sseOA(['<think>mmm</think>', 'La ciudad ', 'huele a aire embotellado. ', 'Ramiro cobra el doble.']);
  peticiones.length = 0;
  const trozosOA = [];
  const r2 = await NI.narrar(e, bloques, t => trozosOA.push(t));
  const cuerpoOA = JSON.parse(peticiones.find(x => x.url.endsWith('/chat/completions')).init.body);
  comprobar(NI.config().modelo === 'meta-llama/llama-3.3-70b-instruct:free', 'elige solo un modelo gratis que escribe bien (sin los que "piensan"): ' + NI.config().modelo);
  comprobar(peticiones.some(x => x.url === 'https://openrouter.ai/api/v1/chat/completions') && cuerpoOA.stream === true && cuerpoOA.messages[0].role === 'system' && cuerpoOA.messages[1].content.includes('"hechos"'), 'pide la crónica a OpenRouter en streaming con el contexto y los datos');
  comprobar(peticiones[peticiones.length - 1].init.headers.Authorization === 'Bearer sk-or-v1-prueba', 'envía la clave del jugador');
  comprobar(r2.texto === 'La ciudad huele a aire embotellado. Ramiro cobra el doble.' && !trozosOA.some(t => /think/.test(t)), 'une el texto y quita el "pensamiento" del modelo');
  comprobar(NI.textoUso(r2) === 'CRÓNICA IA · meta-llama/llama-3.3-70b-instruct:free · 1.8k tokens de entrada · 210 de salida', 'informa del consumo: ' + NI.textoUso(r2));
  chat = () => new Response(JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day' } }), { status: 429 });
  err = await NI.narrar(e, bloques).catch(x => x);
  comprobar(/límite/.test(err.mensaje), 'límite gratis agotado: "' + err.mensaje + '"');
  chat = () => new Response(JSON.stringify({ error: { message: 'No endpoints found' } }), { status: 404 });
  err = await NI.narrar(e, bloques).catch(x => x);
  comprobar(/no aceptó el modelo/.test(err.mensaje), 'modelo que ya no existe: "' + err.mensaje.slice(0, 80) + '…"');
  comprobar(NI.config().modelo === '' && /probaré con otro/.test(err.mensaje), 'si el modelo lo eligió el juego, el próximo turno elige otro');
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  err = await NI.narrar(e, bloques).catch(x => x);
  comprobar(/conectar/.test(err.mensaje), 'sin conexión (el juego pausa la IA): "' + err.mensaje.slice(0, 60) + '…"');

  console.log('GEMINI');
  NI.guardar({ clave: 'AIzaPrueba', proveedor: 'gemini', modelo: '' });
  peticiones.length = 0;
  globalThis.fetch = async (url, init) => { peticiones.push({ url: String(url), init }); return new Response(JSON.stringify({ model: 'gemini-2.5-flash', choices: [{ message: { content: 'Listo' }, finish_reason: 'stop' }] }), { status: 200 }); };
  const pg = await NI.probar();
  comprobar(pg.ok && peticiones[0].url === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' && JSON.parse(peticiones[0].init.body).model === 'gemini-2.5-flash', 'usa el modelo por defecto de Gemini: "' + pg.mensaje + '"');

  console.log('CON TU CUENTA DE CLAUDE (DENTRO DE CLAUDE.AI)');
  await NI.cuentaPromesa;
  comprobar(NI.cuentaDisponible() === true, 'detecta que está dentro de claude.ai');
  NI.guardar({ proveedor: 'cuenta', nivel: 'default', activa: true, clave: '' });
  comprobar(NI.activa() && NI.detectar('') === null, 'se activa sin clave');
  alSample = async (input, o) => { o.onText({ text: 'La ciudad ', delta: 'La ciudad ' }); o.onText({ text: 'La ciudad amanece cara.', delta: 'amanece cara.' }); return { text: 'La ciudad amanece cara.', truncated: false, modelTierApplied: 'default' }; };
  const trozosC = [];
  const rc = await NI.narrar(e, bloques, t => trozosC.push(t));
  comprobar(typeof ultimoSample.input === 'string' && ultimoSample.input.startsWith('Eres el cronista') && ultimoSample.input.includes('"hechos"'), 'le envía las reglas del cronista y los datos del turno');
  comprobar(ultimoSample.opciones.modelTier === 'default' && typeof ultimoSample.opciones.onText === 'function', 'pide el nivel elegido y el texto en directo');
  comprobar(rc.texto === 'La ciudad amanece cara.' && trozosC.join('|') === 'La ciudad |La ciudad amanece cara.', 'el texto llega en directo');
  comprobar(NI.textoUso(rc) === 'CRÓNICA IA · tu cuenta de Claude · normal', 'línea de uso: ' + NI.textoUso(rc));
  alSample = async () => { throw { code: 'rate_limited', message: 'limit' }; };
  err = await NI.narrar(e, bloques).catch(x => x);
  comprobar(/límite de uso/.test(err.mensaje) && !err.pausar, 'límite del plan: avisa y lo reintenta el turno siguiente');
  alSample = async () => { throw { code: 'not_granted', message: 'no' }; };
  err = await NI.narrar(e, bloques).catch(x => x);
  comprobar(/permiso/.test(err.mensaje) && err.pausar === true, 'sin permiso: se pausa la IA y sigue la narración normal');
  alSample = async (i, o) => ({ text: 'Listo', truncated: false, modelTierApplied: 'quick' });
  const pc = await NI.probar();
  comprobar(pc.ok && ultimoSample.opciones.modelTier === 'quick' && ultimoSample.opciones.cache === false, 'el botón Probar hace una petición rápida');

  console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
  process.exit(fallos ? 1 : 0);
})();
