// Simula cientos de partidas con decretos al azar: node test/simulacion.test.js
// Comprueba que nada explota, que no quedan {huecos} sin rellenar, que los eventos saltan
// y que los finales son alcanzables.
const RF = require('./cargar')();

const DECRETOS = [
  'el aire se vende', 'prohibir el fútbol', 'ejecutar a los ladrones', 'subir impuestos a los ricos', 'regalar comida',
  'estatua de mí', 'invertir en hospitales', 'legalizar la marihuana', 'cerrar internet', 'nacionalizar el petróleo',
  'despedir a los maestros', 'bajar impuestos a las empresas', 'encarcelar a los opositores', 'servicio militar obligatorio',
  'gasolina gratis', 'recortar el presupuesto del ejército', 'prohibir los calcetines', 'todos deben rezar',
  'vender el agua', 'subir el sueldo a los soldados', 'legalizar robar', 'cerrar las fronteras', 'construir escuelas',
  'prohibir el aire', 'deportar a los inmigrantes', 'que todos usen sombrero', 'homenaje a la policía', 'ya no se vende el agua',
  'prohibir el fútbol y la música', 'subir impuestos a los ricos y regalar comida a los pobres', 'banear a los tombos',
  'birras gratis para los chamos', 'recortar los hospitales', 'prohibir los lunes', 'subir impuestos',
  // Economía, instituciones y personas
  'quiero hacer un narco estado', 'toda la economía al carbón', 'economía basada en el turismo', 'que toda la economía sea de calcetines',
  'imprimir dinero', 'dolarizar', 'devaluar el valdo', 'invertir en la industria', 'nacionalizar el petróleo', 'prohibir el narcotráfico',
  'crear una escuadra de represión', 'fundar un partido único', 'crear una red de espías', 'crear milicias populares',
  'crear un ministerio de propaganda', 'disolver el escuadrón', 'matar al general', 'encarcelar a Chol-su', 'liberar a Chol-su',
  'destituir a la ministra de hacienda', 'premiar a la canciller', 'exiliar al líder de la oposición', 'matar a Song Dae-ho',
  'expulsar al embajador', 'matar al embajador', 'fusilar a la abuela Sun-ja', 'regalarle un taxi a Kwang-ho', 'matar a Jang y a Ryu',
  // Leyes que se acumulan y se derogan
  'vender cocaína', 'dejar de imprimir dinero', 'ya no se regala comida', 'derogar el último decreto', 'derogar la ley del aire',
  'esperar', 'esperar', 'esperar',
  // Sistema político
  'disuelvo el congreso', 'comprar a los diputados', 'controlar los jueces', 'suspender las elecciones', 'amañar las elecciones',
  'reelección indefinida', 'proclamarme rey', 'instaurar una teocracia', 'ley marcial', 'restaurar la democracia',
  'asesino contrincantes secretamente', 'matar en secreto a Song Dae-ho', 'que parezca un accidente lo de Pak', 'comprar la prensa'
];

const finales = {};
const dilemasVistos = {};
let errores = 0, turnos = 0, dilemas = 0;
const texto = b => [b.titulo, b.texto].concat((b.opciones || []).map(o => o.texto + ' ' + o.resumen.map(r => r.texto).join(' '))).filter(Boolean).join(' ');
const revisar = bloques => {
  for (const b of bloques) {
    const t = texto(b);
    if (/\{\w+\}|\[[^\]]*\|/.test(t) || /undefined|NaN|\[object/.test(t)) { errores++; if (errores < 6) console.log('Hueco:', t); }
  }
};
const PARTIDAS = 400;
for (let partida = 0; partida < PARTIDAS; partida++) {
  const estado = RF.consejero.nuevoEstado();
  let nulos = 0;
  revisar(RF.narrador.intro(estado));
  while (!estado.fin && estado.dia <= 60) { // el juego no tiene final: se juegan 60 turnos como mucho
    const pend = RF.director.pendiente(estado);
    if (pend) {
      revisar([RF.narrador.dilema(estado, pend)]);
      const r = RF.director.resolver(estado, Math.floor(Math.random() * pend.opciones.length));
      revisar(RF.narrador.decision(estado, r));
      dilemas++;
      dilemasVistos[pend.id] = (dilemasVistos[pend.id] || 0) + 1;
      continue;
    }
    const elegido = DECRETOS[Math.floor(Math.random() * DECRETOS.length)];
    if (elegido === 'esperar') {
      const res = RF.consejero.pasarTurno(estado);
      revisar(RF.narrador.cierreDia(estado, res));
      turnos++;
      continue;
    }
    const lista = RF.interprete.interpretarVarios(elegido, estado).filter(i => i.estado === 'ok');
    if (!lista.length) continue;
    let ultimo = null, avanzado = false;
    lista.forEach((i, k) => {
      const op = { avanzar: k === lista.length - 1, secundario: k > 0 };
      const res = i.tipo === 'persona' ? RF.consejero.decretarPersona(estado, i, op) : RF.consejero.decretar(estado, i, op);
      if (res.nulo) { revisar([{ texto: res.nulo }]); return; }
      ultimo = res;
      if (op.avanzar) avanzado = true;
      revisar(RF.narrador.decreto(estado, i, res));
    });
    if (!ultimo) { nulos++; if (nulos > 50) break; continue; }
    if (!avanzado) RF.consejero.avanzarDia(estado, ultimo);
    revisar(RF.narrador.cierreDia(estado, ultimo));
    revisar(RF.narrador.leyes(estado).concat(RF.narrador.gabinete(estado), RF.narrador.estadoPais(estado), RF.narrador.sistema(estado)));
    turnos++;
    const st = estado.stats;
    if (!(st.estabilidad >= 0 && st.estabilidad <= 100 && st.felicidad >= 0 && st.felicidad <= 100 && st.inflacion >= 0 && Number.isFinite(st.dinero))) { errores++; console.log('Indicador fuera de rango', st); }
  }
  finales[estado.fin || 'sin terminar'] = (finales[estado.fin || 'sin terminar'] || 0) + 1;
}
const nunca = RF.DILEMAS.filter(d => !dilemasVistos[d.id]).map(d => d.id);
console.log('Eventos distintos vistos:', Object.keys(dilemasVistos).length + '/' + RF.DILEMAS.length);
console.log('Días simulados:', turnos, '· media por partida:', (turnos / PARTIDAS).toFixed(1), '· eventos por partida:', (dilemas / PARTIDAS).toFixed(1));
console.log('Finales:', finales);
console.log('Eventos que nunca salieron:', nunca.join(', ') || 'ninguno');
console.log('Errores:', errores);
process.exit(errores ? 1 : 0);
