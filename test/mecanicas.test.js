// Prueba de las mecánicas de fondo del país: el déficit que se imprime, el suelo de la deuda, la caja del
// Líder, las sanciones que se aprenden a esquivar y el padrino que no deja caer al régimen.
// node test/mecanicas.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = (stats) => {
  const e = RF.consejero.nuevoEstado(); e.dilemas.ultimo = 999; e.dilemas.pendiente = null;
  Object.assign(e.stats, stats || {});
  return e;
};
const turno = e => { e.dilemas.ultimo = e.dia + 999; return RF.consejero.pasarTurno(e); };

console.log('SIN CRÉDITO, EL DÉFICIT SE IMPRIME');
{
  const a = nuevo({ dinero: 0 }), b = nuevo({ dinero: -100 });
  const rb = turno(b); turno(a);
  comprobar(b.stats.inflacion > a.stats.inflacion + 3, 'con deuda sube más la inflación (' + Math.round(a.stats.inflacion) + '% → ' + Math.round(b.stats.inflacion) + '%)');
  comprobar(rb.causas.some(c => /imprime/.test(c)), 'y se explica: el Banco Central imprime para tapar el agujero');
  comprobar(b.stats.dinero > -100, 'la deuda no crece sola: se va tapando con la imprenta (' + Math.round(b.stats.dinero) + 'M)');
}

console.log('LA DEUDA TIENE SUELO');
{
  const e = nuevo({ dinero: -600 });
  const ej = e.sectores.ejercito;
  const r = turno(e);
  comprobar(e.stats.dinero >= RF.PAIS.economia.suelo, 'no se puede deber más de ' + (-RF.PAIS.economia.suelo) + 'M sin nadie que preste (' + Math.round(e.stats.dinero) + 'M)');
  comprobar(r.impago && e.sectores.ejercito < ej, 'lo que falta se queda sin pagar: el ejército cobra en vales y se enfada');
}

console.log('LA CAJA DEL LÍDER');
{
  // Los decimales se acumulan de un turno a otro: se compara a lo largo de cinco.
  const a = nuevo({ dinero: 120 }), b = nuevo({ dinero: 600 });
  const rb = turno(b); turno(a);
  for (let i = 0; i < 4; i++) { turno(a); turno(b); }
  comprobar(rb.causas.some(c => /Oficina 39/.test(c)), 'las reservas grandes atraen a la Oficina 39');
  comprobar(b.stats.dinero < 600 && b.sectores.elite > a.sectores.elite, 'se escapa dinero (' + Math.round(b.stats.dinero) + 'M tras 5 turnos) y la élite sale ganando (' + a.sectores.elite + ' → ' + b.sectores.elite + ')');
  const c = nuevo({ dinero: 120, inflacion: 20 }), d = nuevo({ dinero: 20, inflacion: 20 });
  for (let i = 0; i < 5; i++) { turno(c); turno(d); }
  comprobar(c.stats.inflacion < d.stats.inflacion, 'unas reservas sólidas respaldan el won: frenan la inflación');
}

console.log('LAS SANCIONES SE APRENDEN A ESQUIVAR');
{
  const e = nuevo(); e.economia.sanciones = 4;
  const r1 = turno(e);
  for (let i = 0; i < 25; i++) turno(e);
  comprobar(e.economia.adaptacion === RF.PAIS.economia.adaptacionSanciones, 'con sanciones duras, el contrabando se organiza hasta esquivar el ' + Math.round(e.economia.adaptacion * 100) + '% de su coste');
  const r2 = turno(e);
  const coste = r => Number((r.causas.find(c => /^Sanciones/.test(c)) || '').match(/cuestan ([\d.]+)M/)[1]);
  comprobar(coste(r2) < coste(r1), 'las sanciones cuestan menos con el tiempo (' + coste(r1) + 'M → ' + coste(r2) + 'M por turno)');
  e.economia.sanciones = 0;
  const antes = e.economia.adaptacion;
  turno(e);
  comprobar(e.economia.adaptacion < antes, 'y si se levantan, las redes se oxidan');
}

console.log('CHINA NO TE DEJA CAER');
{
  const e = nuevo({ estabilidad: 12 }); e.diplomacia = e.diplomacia || RF.diplomacia.iniciar(e); RF.diplomacia.iniciar(e).relaciones.china = 55;
  const r = turno(e);
  const s = r.sucesos.find(x => x.titulo === 'China no te deja caer');
  comprobar(s && e.economia.rescates === 1, 'al borde del colapso, Pekín manda petróleo y arroz');
  comprobar(s && /cincuenta años/.test(s.texto), 'a cambio de una mina o un puerto');
  const r2 = turno(e);
  comprobar(!r2.sucesos.some(x => x.titulo === 'China no te deja caer'), 'no rescata cada turno');
  const libre = nuevo({ estabilidad: 60 }), atado = nuevo({ estabilidad: 60 }); atado.economia.rescates = 3;
  RF.diplomacia.iniciar(libre).relaciones.china = RF.diplomacia.iniciar(atado).relaciones.china = 55;
  turno(libre); turno(atado);
  comprobar(atado.stats.dinero < libre.stats.dinero - 2, 'cada rescate se paga cada turno: minas y puertos que ya no son tuyos');
  const roto = nuevo({ estabilidad: 12 }); RF.diplomacia.iniciar(roto).relaciones.china = 2;
  const r3 = turno(roto);
  comprobar(!r3.sucesos.some(x => x.titulo === 'China no te deja caer'), 'con la relación rota del todo, no viene nadie');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
