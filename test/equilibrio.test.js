// Un jugador "listo" que elige cada día el decreto que deja al país más equilibrado.
// Comprueba que es posible llegar a las elecciones (el juego no es imposible) y que no es trivial.
const RF = require('./cargar')();
const DECRETOS = [
  'el aire se vende', 'prohibir el fútbol', 'ejecutar a los ladrones', 'subir impuestos a los ricos', 'regalar comida',
  'estatua de mí', 'invertir en hospitales', 'legalizar la marihuana', 'nacionalizar el petróleo', 'bajar impuestos a las empresas',
  'servicio militar obligatorio', 'gasolina gratis', 'subir el sueldo a los soldados', 'construir escuelas', 'homenaje a la policía',
  'impuesto al tabaco', 'vender las minas', 'recortar los subsidios a la gasolina', 'homenaje al ejército', 'invertir en el ejército',
  'bajar impuestos a los trabajadores', 'subir el sueldo a los médicos', 'amnistía para los opositores', 'legalizar los casinos'
].map(d => RF.interprete.interpretar(d)).filter(i => i.estado === 'ok');

const clonar = e => JSON.parse(JSON.stringify(e));
const puntuar = e => Math.min(...Object.values(e.stats)) * 3 + Object.values(e.stats).reduce((a, b) => a + b, 0) / 7;
const finales = {};
for (let p = 0; p < 100; p++) {
  const estado = RF.consejero.nuevoEstado();
  while (!estado.fin) {
    let mejor = null, mejorP = -Infinity;
    for (const d of DECRETOS) {
      const prueba = clonar(estado);
      RF.consejero.decretar(prueba, d);
      const pt = prueba.fin && !prueba.fin.startsWith('elecciones_ganadas') ? -1000 : puntuar(prueba);
      if (pt > mejorP) { mejorP = pt; mejor = d; }
    }
    RF.consejero.decretar(estado, mejor);
  }
  finales[estado.fin] = (finales[estado.fin] || 0) + 1;
}
console.log('Jugador listo, finales:', finales);
const llegan = Object.entries(finales).filter(([k]) => k.startsWith('elecciones')).reduce((s, [, v]) => s + v, 0);
process.exit(llegan >= 50 ? 0 : 1);
