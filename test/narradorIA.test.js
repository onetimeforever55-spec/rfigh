// Prueba del narrador con IA usando el SDK oficial y respuestas simuladas (no gasta dinero ni necesita clave).
// node test/narradorIA.test.js
let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { console.log('Narrador IA: se omite (instala las dependencias con "npm install")'); process.exit(0); }
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

  console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
  process.exit(fallos ? 1 : 0);
})();
