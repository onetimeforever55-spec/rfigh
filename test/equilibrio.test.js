// Un jugador "listo" que cada turno prueba todos sus decretos y elige el que deja el país mejor
// dentro de 3 turnos (las leyes se acumulan: hay que mirar un poco hacia delante).
// El juego no tiene final: comprueba que se puede sobrevivir 60 turnos en Corea del Norte (y que no es trivial).
const RF = require('./cargar')();
const DECRETOS = [
  'esperar', 'regalar comida', 'invertir en hospitales', 'subir impuestos a los ricos', 'bajar impuestos a los trabajadores',
  'construir escuelas', 'vender cocaína', 'imprimir dinero', 'crear una red de espías', 'mano dura contra los ladrones',
  'legalizar la marihuana', 'recortar el ejército', 'subir el sueldo a los soldados', 'economía basada en el turismo',
  'derogar el último decreto', 'dejar de regalar comida', 'dejar de imprimir dinero', 'crear un ministerio de propaganda',
  'vender carbón a China', 'regalar arroz', 'bajar impuestos a los ricos', 'abrir los mercados', 'lanzar un misil'
];
const TURNOS = 60;

const clonar = e => JSON.parse(JSON.stringify(e));
// Un país "sano": estabilidad y sectores (ejército, Palacio, población) altos, algo de dinero y poca inflación.
const puntuar = e => {
  const s = e.stats, sec = e.sectores;
  const peor = Math.min(s.estabilidad, s.felicidad, sec.ejercito, sec.elite);
  return peor * 3 + (s.estabilidad + s.felicidad + sec.ejercito + sec.elite) / 4 + Math.max(-60, Math.min(120, s.dinero)) / 4 - s.inflacion / 2;
};

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
  while (!estado.fin && estado.dia <= TURNOS) {
    resolverEventos(estado);
    if (estado.fin) break;
    let mejor = 'esperar', mejorP = -Infinity;
    for (const d of DECRETOS) {
      const prueba = clonar(estado);
      if (!jugarDecreto(prueba, d)) continue;
      for (let k = 0; k < 2 && !prueba.fin; k++) { prueba.dilemas.pendiente = null; RF.consejero.pasarTurno(prueba); }
      const pt = prueba.fin ? -1e9 : puntuar(prueba);
      if (pt > mejorP) { mejorP = pt; mejor = d; }
    }
    if (!jugarDecreto(estado, mejor)) RF.consejero.pasarTurno(estado);
  }
  const f = estado.fin || 'sigue_en_el_poder';
  finales[f] = (finales[f] || 0) + 1;
}
console.log('Jugador listo, a los ' + TURNOS + ' turnos:', finales);
process.exit((finales.sigue_en_el_poder || 0) >= 20 ? 0 : 1);
