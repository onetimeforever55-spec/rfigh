// Un jugador "listo" que cada turno prueba todos sus decretos y elige el que deja el país mejor
// dentro de 3 turnos (las leyes se acumulan: hay que mirar un poco hacia delante).
// Comprueba que es posible llegar a las elecciones y que no es trivial.
const RF = require('./cargar')();
const DECRETOS = [
  'esperar', 'regalar comida', 'invertir en hospitales', 'subir impuestos a los ricos', 'bajar impuestos a los trabajadores',
  'construir escuelas', 'vender cocaína', 'imprimir dinero', 'crear una red de espías', 'mano dura contra los ladrones',
  'legalizar la marihuana', 'recortar el ejército', 'subir el sueldo a los soldados', 'economía basada en el turismo',
  'derogar el último decreto', 'dejar de regalar comida', 'dejar de imprimir dinero', 'crear un ministerio de propaganda'
];

const clonar = e => JSON.parse(JSON.stringify(e));
// Un país "sano": estabilidad y felicidad altas, algo de dinero y poca inflación.
const puntuar = e => { const s = e.stats; return Math.min(s.estabilidad, s.felicidad) * 3 + (s.estabilidad + s.felicidad) / 2 + Math.max(-60, Math.min(120, s.dinero)) / 4 - s.inflacion / 2; };

function jugarDecreto(e, texto) {
  if (texto === 'esperar') { RF.consejero.pasarTurno(e); return true; }
  const lista = RF.interprete.interpretarVarios(texto, e).filter(i => i.estado === 'ok');
  let hecho = false;
  lista.forEach((i, k) => {
    const r = (i.tipo === 'persona' ? RF.consejero.decretarPersona : RF.consejero.decretar)(e, i, { avanzar: k === lista.length - 1, secundario: k > 0 });
    if (!r.nulo) hecho = true;
  });
  return hecho;
}
function resolverEventos(e) {
  let d;
  while ((d = RF.director.pendiente(e))) {
    let mejor = 0, mejorP = -Infinity;
    d.opciones.forEach((_, i) => { const p = clonar(e); RF.director.resolver(p, i); const v = p.fin ? -1e9 : puntuar(p); if (v > mejorP) { mejorP = v; mejor = i; } });
    RF.director.resolver(e, mejor);
  }
}

const finales = {};
for (let p = 0; p < 40; p++) {
  const estado = RF.consejero.nuevoEstado();
  while (!estado.fin) {
    resolverEventos(estado);
    if (estado.fin) break;
    let mejor = 'esperar', mejorP = -Infinity;
    for (const d of DECRETOS) {
      const prueba = clonar(estado);
      if (!jugarDecreto(prueba, d)) continue;
      for (let k = 0; k < 2 && !prueba.fin; k++) { prueba.dilemas.pendiente = null; RF.consejero.pasarTurno(prueba); }
      const pt = prueba.fin && !prueba.fin.startsWith('elecciones_ganadas') ? -1e9 : puntuar(prueba);
      if (pt > mejorP) { mejorP = pt; mejor = d; }
    }
    if (!jugarDecreto(estado, mejor)) RF.consejero.pasarTurno(estado);
  }
  finales[estado.fin] = (finales[estado.fin] || 0) + 1;
}
console.log('Jugador listo, finales:', finales);
const llegan = Object.entries(finales).filter(([k]) => k.startsWith('elecciones')).reduce((s, [, v]) => s + v, 0);
process.exit(llegan >= 20 ? 0 : 1);
