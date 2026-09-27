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
  'birras gratis para los chamos', 'recortar los hospitales', 'prohibir los lunes', 'subir impuestos'
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
  revisar(RF.narrador.intro(estado));
  while (!estado.fin) {
    const pend = RF.director.pendiente(estado);
    if (pend) {
      revisar([RF.narrador.dilema(estado, pend)]);
      const r = RF.director.resolver(estado, Math.floor(Math.random() * pend.opciones.length));
      revisar(RF.narrador.decision(estado, r));
      dilemas++;
      dilemasVistos[pend.id] = (dilemasVistos[pend.id] || 0) + 1;
      continue;
    }
    const lista = RF.interprete.interpretarVarios(DECRETOS[Math.floor(Math.random() * DECRETOS.length)]).filter(i => i.estado === 'ok');
    if (!lista.length) continue;
    lista.forEach((i, k) => {
      const res = RF.consejero.decretar(estado, i, { avanzar: k === lista.length - 1, secundario: k > 0 });
      revisar(RF.narrador.decreto(estado, i, res));
      if (k === lista.length - 1) revisar(RF.narrador.cierreDia(estado, res));
    });
    turnos++;
    for (const v of Object.values(estado.stats)) if (!(v >= 0 && v <= 100)) { errores++; console.log('Stat fuera de rango', estado.stats); }
  }
  finales[estado.fin] = (finales[estado.fin] || 0) + 1;
}
const nunca = RF.DILEMAS.filter(d => !dilemasVistos[d.id]).map(d => d.id);
console.log('Días simulados:', turnos, '· media por partida:', (turnos / PARTIDAS).toFixed(1), '· eventos por partida:', (dilemas / PARTIDAS).toFixed(1));
console.log('Finales:', finales);
console.log('Eventos que nunca salieron:', nunca.join(', ') || 'ninguno');
console.log('Errores:', errores);
process.exit(errores ? 1 : 0);
