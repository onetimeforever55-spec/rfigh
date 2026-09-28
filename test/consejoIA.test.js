// Prueba del Consejo de Estado con IA: el motor como árbitro de las fichas que devuelve la IA.
// No llama a ninguna IA: usa fichas escritas a mano (buenas, exageradas y rotas).
// node test/consejoIA.test.js
const RF = require('./cargar')();
const C = RF.consejoIA;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = () => { const e = RF.consejero.nuevoEstado(); e.politica.apoyo = 100; e.iaActiva = true; e.dilemas.ultimo = -99; return e; };
const turno = (e, ficha, texto) => { const res = C.aplicar(e, ficha, texto || 'decreto'); RF.consejero.avanzarDia(e, res); return res; };
const sinHuecos = bl => bl.every(b => !/\{|\}|undefined|NaN|\[object/.test((b.titulo || '') + (b.texto || '')));

const AIRE = {
  entendido: true, interpretacion: 'Vender el aire a una empresa privada', titulo: 'la privatización del aire',
  gaceta: 'Se concede a Brisa S.A. la explotación del aire nacional.',
  leyes: [{ nombre: 'la privatización del aire', inicial: { dinero: 35, felicidad: -8 }, por_turno: { dinero: 15, felicidad: -2, estabilidad: -1 }, curvas: {}, controversia: 2 }],
  hechos: ['El Gobierno vendió el aire a la empresa Brisa S.A.'],
  titulares: ['El Patriota: «El aire, por fin, vale algo»', 'Radio Libertad: «Nos cobran por respirar»'],
  gabinete: { id: 'cifuentes', dice: 'Cifuentes sonríe: las cuentas cuadran.' },
  calle: { id: 'carmen', dice: 'Doña Carmen abre la ventana con miedo.' }
};

console.log('UNA LEY NORMAL');
{
  const e = nuevo();
  const d0 = e.stats.dinero;
  const res = C.aplicar(e, AIRE, 'vender el aire');
  comprobar(e.leyes.length === 1 && e.leyes[0].nombre === 'la privatización del aire' && e.leyes[0].accion === 'IA', 'la ley queda vigente');
  comprobar(e.stats.dinero === d0 + 35 && res.deltas.felicidad === -8, 'aplica el efecto inicial: dinero +35, felicidad −8');
  comprobar(res.porTurno.dinero === 15 && res.porTurno.felicidad === -2, 'informa de lo que hará cada turno');
  comprobar(C.memoria(e).some(m => /Brisa/.test(m.texto)), 'recuerda el hecho en la memoria del mundo');
  const bl = C.bloques(e, AIRE, res);
  comprobar(['bot', 'gaceta', 'efectos', 'prensa', 'cupula', 'calle'].every(t => bl.some(b => b.tipo === t)) && sinHuecos(bl), 'cuenta gaceta, efectos, titulares, gabinete y calle sin huecos');
  const d1 = e.stats.dinero;
  RF.consejero.avanzarDia(e, res);
  RF.consejero.avanzarDia(e, { sucesos: [] });
  comprobar(RF.leyes.turno(e).detalle.some(l => l.nombre === 'la privatización del aire' && l.efectos.dinero > 0), 'la ley sigue actuando en los turnos siguientes');
  C.aplicar(e, AIRE, 'vender más aire');
  comprobar(e.leyes.length === 1 && e.leyes[0].nivel === 2, 'repetir el mismo nombre refuerza la ley (nivel 2)');
  const ctx = C.contexto(e, 'otro decreto');
  comprobar(ctx.leyes_vigentes[0].id === e.leyes[0].clave && ctx.memoria.length >= 1 && ctx.decreto === 'otro decreto', 'el contexto lleva leyes (con id), memoria y el decreto');
  comprobar(d1 > 0, 'sin errores de cálculo');
}

console.log('EL MOTOR PONE TOPES');
{
  const e = nuevo();
  const res = C.aplicar(e, { titulo: 'el maná del cielo', leyes: [{ nombre: 'el maná', inicial: { dinero: 5000, felicidad: 90 }, por_turno: { dinero: 300, inflacion: -50 }, controversia: 0 }] });
  comprobar(res.deltas.dinero === 80 && res.deltas.felicidad === 15, 'el efecto inicial se recorta a +80M y +15');
  comprobar(e.leyes[0].porTurno.dinero === 25 && e.leyes[0].porTurno.inflacion === -3, 'el efecto por turno se recorta (+25M, −3 de inflación)');
  comprobar(res.notas.some(n => /moderó/.test(n)), 'avisa de que moderó las cifras');
}

console.log('PERSONAS');
{
  const e = nuevo();
  const res = C.aplicar(e, { titulo: 'la caída del general', personas: [{ id: 'garrote', accion: 'destituir' }] });
  comprobar(e.gabinete.garrote.nombre !== 'General Bruno Garrote' && res.notas.some(n => /Su puesto lo ocupa/.test(n)), 'un ministro destituido tiene sucesor');
  C.aplicar(e, { titulo: 'x', personas: [{ id: 'nico', accion: 'encarcelar' }] });
  comprobar(e.ciudadanos.nico.estado === 'preso', 'Nico queda en la cárcel');
  const r2 = C.aplicar(e, { titulo: 'x', personas: [{ id: 'nico', accion: 'encarcelar' }] });
  comprobar(r2.notas.some(n => /ya est/i.test(n)), 'no se puede encarcelar a quien ya está preso: "' + r2.notas[0] + '"');
  const antes = e.ciudadanos.carmen.animo;
  const r3 = C.aplicar(e, { titulo: 'x', personas: [{ id: 'fantasma', accion: 'matar' }, { id: 'carmen', accion: 'animo', valor: -500 }] });
  comprobar(Math.round(e.ciudadanos.carmen.animo - antes) === Math.max(-40, -100 - antes) && !r3.notas.length, 'ignora personas que no existen y recorta el cambio de ánimo a −40');
  const e2 = nuevo();
  e2.politica.apoyo = 50;
  const r4 = C.aplicar(e2, { titulo: 'la eliminación de Valiente', personas: [{ id: 'valiente', accion: 'matar' }] });
  comprobar(e2.personas.valiente === 'muerto' && r4.dilema === 'juicio_politico' && RF.director.pendiente(e2).id === 'juicio_politico', 'matar a Valiente a la vista de todos en democracia abre un juicio político');
  const e3 = nuevo();
  const r5 = C.aplicar(e3, { titulo: 'un accidente', secreto: true, personas: [{ id: 'valiente', accion: 'matar' }] });
  comprobar(e3.personas.valiente === 'muerto' && !r5.dilema && e3.politica.secretos.length === 1, 'en secreto no hay juicio, pero queda un secreto que puede salir');
}

console.log('EL CONGRESO');
{
  const e = nuevo();
  e.politica.apoyo = 30;
  const ficha = { titulo: 'el escuadrón de la muerte', leyes: [{ nombre: 'el escuadrón de la muerte', inicial: { felicidad: -7 }, por_turno: { estabilidad: 1, felicidad: -1, dinero: -7 }, controversia: 3 }] };
  const res = C.aplicar(e, ficha);
  comprobar(res.bloqueada && !e.leyes.length && RF.director.pendiente(e).id === 'congreso_bloquea', 'una ley polémica sin votos se bloquea y salta el evento del Congreso');
  const d = RF.director.pendiente(e);
  const i = d.opciones.findIndex(o => o.aprobar);
  const r = RF.director.resolver(e, i);
  comprobar(e.leyes.some(l => l.nombre === 'el escuadrón de la muerte') && r.decreto, 'si se aprueba en el evento, la ley entra en vigor');
  const e2 = nuevo();
  e2.politica.apoyo = 30;
  C.aplicar(e2, Object.assign({}, ficha, { secreto: true }));
  comprobar(e2.leyes.length === 1 && e2.leyes[0].secreta && e2.politica.secretos.length === 1, 'en secreto no pasa por el Congreso (pero es un secreto)');
}

console.log('RÉGIMEN E INSTITUCIONES');
{
  const e = nuevo();
  const res = turno(e, { titulo: 'la disolución del Congreso', instituciones: { congreso: 'disuelto', prensa: 'inventado' }, efecto_unico: { estabilidad: -6, felicidad: -8 } });
  comprobar(e.politica.congreso === 'disuelto' && e.politica.prensa === 'libre' && e.politica.regimen === 'DICTADURA' && res.cambioRegimen, 'disolver el Congreso lleva a la dictadura (y descarta valores inventados)');
  comprobar(e.dilemas.cadena.some(c => c.id === 'autogolpe_ejercito') || RF.director.pendiente(e), 'un autogolpe trae la reacción del ejército');
  comprobar(C.memoria(e).some(m => /Dictadura/.test(m.texto)), 'recuerda el cambio de régimen');
  const e2 = nuevo();
  const d0 = e2.stats.dinero;
  C.aplicar(e2, { titulo: 'mi coronación', regimen: 'MONARQUIA' });
  comprobar(e2.politica.regimen === 'MONARQUIA' && e2.stats.dinero < d0, 'proclamarse rey cambia el régimen y, si la ficha no pone coste, cuesta lo de siempre');
  const e3 = nuevo();
  C.aplicar(e3, { titulo: 'comprar diputados', instituciones: { congreso: 'controlado' } });
  comprobar(e3.politica.apoyo === 85 && e3.leyes.some(l => l.clave === 'SOBORNOS') && e3.politica.secretos.length === 1, 'comprar el Congreso: 85% de apoyo, sobornos cada turno y un secreto');
}

console.log('DEROGAR');
{
  const e = nuevo();
  C.aplicar(e, AIRE);
  const id = e.leyes[0].clave;
  const res = C.aplicar(e, { titulo: 'devolver el aire', derogar: [id, 'NO_EXISTE'] });
  comprobar(!e.leyes.length && res.notas.some(n => /derogada/.test(n)), 'deroga la ley vigente por su id (e ignora las que no existen)');
}

console.log('EVENTOS Y CONSECUENCIAS DE LA IA');
{
  const e = nuevo();
  const res = C.aplicar(e, Object.assign({}, AIRE, {
    evento: { titulo: 'Los contrabandistas de aire', texto: 'En La Esperanza venden aire en botellas de ron.', opciones: [
      { texto: 'Legalizar el aire embotellado', resultado: 'Brisa S.A. protesta.', efectos: { dinero: 5, felicidad: 3 }, hecho: 'Se legalizó el aire embotellado.' },
      { texto: 'Perseguir a los contrabandistas', resultado: 'La policía requisa botellas.', efectos: { estabilidad: 50 }, por_turno_dinero: -6 }
    ] },
    consecuencias: [{ en_turnos: 2, titulo: 'Asma en los barrios', texto: 'Los hospitales se llenan de niños con asma.', efectos: { felicidad: -4 } }]
  }));
  const d = RF.director.pendiente(e);
  comprobar(d && d.ia && d.opciones.length === 2 && res.dilema === d.id, 'la IA crea un evento propio con opciones');
  const tarjeta = RF.narrador.dilema(e, d);
  comprobar(sinHuecos([tarjeta]) && tarjeta.opciones[1].resumen.some(p => /Gasto fijo/.test(p.texto)), 'la tarjeta se dibuja con sus efectos (incluido el gasto fijo)');
  comprobar(d.opciones[1].efectos.estabilidad === 15, 'los efectos de las opciones también tienen tope');
  RF.director.resolver(e, 0);
  comprobar(!RF.director.pendiente(e) && !e.dilemas.custom[d.id] && C.memoria(e).some(m => /embotellado/.test(m.texto)) && C.memoria(e).some(m => /elegiste/.test(m.texto)), 'al decidir, se recuerda la elección y el hecho, y el evento se borra');
  RF.consejero.avanzarDia(e, res);
  const r2 = { sucesos: [] };
  RF.consejero.avanzarDia(e, r2);
  comprobar(r2.sucesos.some(s => s.titulo === 'Asma en los barrios'), 'la consecuencia llega a los dos turnos');
  const e2 = nuevo();
  e2.dilemas.ultimo = e2.dia; // acaba de haber uno
  C.aplicar(e2, Object.assign({}, AIRE, { evento: { titulo: 'x', texto: 'y', opciones: [{ texto: 'a' }, { texto: 'b' }] } }));
  comprobar(!RF.director.pendiente(e2), 'no hay eventos de la IA si acaba de haber otro');
  comprobar(JSON.parse(JSON.stringify(e)).dilemas && true, 'la partida se puede guardar (todo son datos)');
}

console.log('FICHAS ROTAS');
{
  const e = nuevo();
  let ok = true;
  try {
    for (const f of [{}, { leyes: 'no' }, { leyes: [null, 5, { nombre: '{mal}', inicial: 'x', por_turno: { dinero: 'mucho' }, curvas: { dinero: 'rara' } }] }, { personas: [null, {}], instituciones: 7, derogar: 'x', consecuencias: [{}], evento: { opciones: [] }, hechos: [null, ''] }]) {
      const res = C.aplicar(e, f, 'x');
      const bl = C.bloques(e, f, res);
      RF.consejero.avanzarDia(e, res);
      if (!sinHuecos(bl)) ok = false;
    }
  } catch (err) { ok = false; console.log(err); }
  comprobar(ok, 'fichas vacías o con tipos raros no rompen el juego ni dejan huecos en el texto');
  comprobar(!e.leyes.some(l => /[{}]/.test(l.nombre)), 'los textos de la IA no cuelan llaves de plantilla');
}

console.log('NOMBRES PROPIOS');
{
  const e = nuevo();
  const res = C.aplicar(e, { titulo: 'La concesión del aire a Brisa S.A.', leyes: [{ nombre: 'La concesión del aire a Brisa S.A.', por_turno: { dinero: 5 } }] });
  comprobar(res.medida === 'la concesión del aire a Brisa S.A.' && e.leyes[0].nombre === 'la concesión del aire a Brisa S.A.', 'solo pasa a minúscula la primera letra: "' + res.medida + '"');
}

console.log('UN TURNO SIN DECRETOS (EL PAÍS SIGUE SU CURSO)');
{
  const e = nuevo();
  C.aplicar(e, AIRE);
  const leyes = e.leyes.length;
  const reg = e.politica.congreso;
  const res = { tipo: 'espera', dia: e.dia, deltas: {}, sucesos: [], notas: [] };
  const d0 = e.stats.felicidad;
  C.aplicarMundo(e, {
    titulo: 'La huelga de los respiradores', gaceta: 'Los vendedores de aire embotellado cortan la avenida principal.',
    efecto_unico: { felicidad: -4, estabilidad: -2 },
    leyes: [{ nombre: 'algo que no debe pasar', por_turno: { dinero: 20 } }], instituciones: { congreso: 'disuelto' }, regimen: 'MONARQUIA',
    personas: [{ id: 'valiente', accion: 'matar' }, { id: 'ramiro', accion: 'animo', valor: 15 }],
    hechos: ['Los vendedores de aire embotellado se organizaron en un sindicato.'],
    consecuencias: [{ en_turnos: 1, titulo: 'Avenida cortada', texto: 'El tráfico colapsa.', efectos: { dinero: -3 } }]
  }, res);
  comprobar(res.sucesos.length === 1 && res.sucesos[0].tipo === 'mundo' && res.sucesos[0].titulo === 'La huelga de los respiradores', 'lo que pasa aparece como suceso "EN EL PAÍS"');
  comprobar(e.stats.felicidad === d0 - 4, 'aplica sus efectos');
  comprobar(e.leyes.length === leyes && e.politica.congreso === reg && e.politica.regimen === 'DEMOCRACIA' && e.personas.valiente === 'libre', 'no crea leyes ni cambia instituciones, régimen o personas: el gobierno no hizo nada');
  comprobar(e.ciudadanos.ramiro.animo === 15 && e.pendientes.some(p => p.titulo === 'Avenida cortada') && C.memoria(e).some(m => /sindicato/.test(m.texto)), 'sí cambia ánimos, programa consecuencias y recuerda');
  RF.consejero.avanzarDia(e, res);
  const bl = RF.narrador.cierreDia(e, res);
  comprobar(bl.some(b => b.tipo === 'suceso' && /EN EL PAÍS/.test(b.titulo)) && sinHuecos(bl), 'se cuenta en el cierre del turno');
  comprobar(C.contexto(e, 'x').turnos_sin_evento >= 1, 'el contexto dice cuántos turnos llevan sin evento');
}

console.log('COHERENCIA ABSURDA');
{
  comprobar(/AL PIE DE LA LETRA/.test(C.SISTEMA) && /prohibir los lunes/.test(C.SISTEMA) && /"logica"/.test(C.SISTEMA), 'el Consejo sabe que debe cumplir lo absurdo con lógica impecable (con ejemplos)');
  const e = nuevo();
  const f = { titulo: 'la abolición de los lunes', logica: ['Paso 1: después del domingo viene el martes.', 'Paso 2: las nóminas pierden un día {raro}.', null, 'Paso 3: aparece un mercado negro de lunes.', 'Paso 4: x', 'Paso 5: sobra'],
    efecto_unico: { dinero: -5 }, hechos: ['Desde el turno 1, la semana tiene seis días: después del domingo viene el martes.'] };
  const res = C.aplicar(e, f);
  const inf = C.bloques(e, f, res).find(b => b.tipo === 'logica');
  comprobar(inf && inf.texto.split('\n').length === 4 && !/[{}]/.test(inf.texto), 'muestra el informe con los pasos del razonamiento (máximo 4, limpios)');
  comprobar(C.memoria(e).some(m => /seis días/.test(m.texto)), 'la regla absurda queda en la memoria como realidad del juego');
}

console.log('LEER LA RESPUESTA DE LA IA');
comprobar(C.extraerJSON('{"a":1}').a === 1, 'JSON limpio');
comprobar(C.extraerJSON('```json\n{"a":2}\n```').a === 2, 'JSON dentro de un bloque de código');
comprobar(C.extraerJSON('Aquí tienes: {"a":3} ¡Suerte!').a === 3, 'JSON con texto alrededor');
comprobar(C.extraerJSON('<think>{"no":1}</think>{"a":4}').a === 4, 'ignora el "pensamiento" del modelo');
comprobar(C.extraerJSON('nada') === null, 'devuelve null si no hay JSON');

(async () => {
  console.log('CONSULTAR (IA SIMULADA)');
  const e = nuevo();
  let pedido = null;
  RF.narradorIA.generar = async (sistema, contenido) => { pedido = { sistema, contenido }; return { texto: 'Claro: ' + JSON.stringify(AIRE) }; };
  const ficha = await C.consultar(e, 'que el aire se venda');
  comprobar(ficha.titulo === 'la privatización del aire', 'devuelve la ficha leída');
  comprobar(/Consejo de Estado/.test(pedido.sistema) && pedido.contenido.includes('"decreto":"que el aire se venda"'), 'envía las reglas y la situación con el decreto');
  RF.narradorIA.generar = async () => ({ texto: 'no sé' });
  const err = await C.consultar(e, 'x').catch(x => x);
  comprobar(/no pudo leer/.test(err.mensaje), 'si la respuesta no es una ficha, lo dice (y el juego usa el intérprete local)');

  RF.narradorIA.generar = async (sistema, contenido) => { pedido = { sistema, contenido }; return { texto: JSON.stringify({ titulo: 'x', gaceta: 'y' }) }; };
  const fm = await C.consultarMundo(e);
  comprobar(fm.titulo === 'x' && /NO firma ningún decreto/.test(pedido.contenido), 'al esperar, pregunta qué pasa en el país sin decreto');

  console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
  process.exit(fallos ? 1 : 0);
})();
