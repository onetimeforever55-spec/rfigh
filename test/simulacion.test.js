// Simula cientos de partidas con decretos al azar: node test/simulacion.test.js
// Comprueba que nada explota, que no quedan {huecos} sin rellenar y que todos los finales son alcanzables.
const RF = require('./cargar')();

const DECRETOS = [
  'el aire se vende', 'prohibir el fútbol', 'ejecutar a los ladrones', 'subir impuestos a los ricos', 'regalar comida',
  'estatua de mí', 'invertir en hospitales', 'legalizar la marihuana', 'cerrar internet', 'nacionalizar el petróleo',
  'despedir a los maestros', 'bajar impuestos a las empresas', 'encarcelar a los opositores', 'servicio militar obligatorio',
  'gasolina gratis', 'recortar el presupuesto del ejército', 'prohibir los calcetines', 'todos deben rezar',
  'vender el agua', 'subir el sueldo a los soldados', 'legalizar robar', 'cerrar las fronteras', 'construir escuelas',
  'prohibir el aire', 'deportar a los inmigrantes', 'que todos usen sombrero', 'homenaje a la policía', 'ya no se vende el agua'
];

const finales = {};
let errores = 0, turnos = 0;
const texto = b => [b.titulo, b.texto].filter(Boolean).join(' ');
for (let partida = 0; partida < 400; partida++) {
  const estado = RF.consejero.nuevoEstado();
  RF.narrador.intro(estado);
  while (!estado.fin) {
    const i = RF.interprete.interpretar(DECRETOS[Math.floor(Math.random() * DECRETOS.length)]);
    if (i.estado !== 'ok') continue;
    const res = RF.consejero.decretar(estado, i);
    const bloques = RF.narrador.turno(estado, i, res);
    turnos++;
    for (const b of bloques) {
      const t = texto(b);
      if (/\{\w+\}|\[[^\]]*\|/.test(t) || /undefined|NaN/.test(t)) { errores++; if (errores < 5) console.log('Hueco:', t); }
    }
    for (const v of Object.values(estado.stats)) if (!(v >= 0 && v <= 100)) { errores++; console.log('Stat fuera de rango', estado.stats); }
  }
  finales[estado.fin] = (finales[estado.fin] || 0) + 1;
}
console.log('Turnos simulados:', turnos, '· media por partida:', (turnos / 400).toFixed(1));
console.log('Finales:', finales);
console.log('Errores:', errores);
process.exit(errores ? 1 : 0);
