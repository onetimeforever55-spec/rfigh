// Prueba del sistema de escenarios con el escenario por defecto (Corea del Norte, partida libre).
// node test/escenarios.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

console.log('POR DEFECTO, COREA DEL NORTE SIN FINAL');
{
  comprobar(RF.ESCENARIO.id === 'corea' && RF.PAIS.id === 'corea', 'sin elegir nada se juega Corea del Norte');
  comprobar(RF.escenario.lista().some(x => x.id === 'urss1985'), 'la URSS de 1985 está en la lista de escenarios');
  const e = RF.consejero.nuevoEstado();
  comprobar(e.escenario === 'corea' && !e.dilemas.cadena.length && RF.escenario.fecha(5) === null, 'sin calendario ni eventos históricos');
  e.dia = 200; e.dilemas.ultimo = 999;
  RF.consejero.pasarTurno(e);
  comprobar(!e.fin || e.fin !== 'victoria', 'y sin último turno');
  comprobar(RF.escenario.elegir('urss1985') === false, 'sin almacenamiento en el navegador, no se puede cambiar (y no rompe)');
  comprobar(RF.consejoIA.SISTEMA.includes('Consola de Pionyang') && RF.narradorIA.SISTEMA.includes('abuela Sun-ja'), 'las instrucciones de la IA siguen siendo las de Corea del Norte');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
