// Prueba de Génesis: el mundo vive solo la historia humana, es reproducible, explica lo que pasa y obedece al dios.
// node test/mundo.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'dios']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, D = M.dios;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const hasta = (m, anio) => { let t = 0; while (m.anio < anio && t++ < 500) S.turno(m); return m; };

console.log('EL MUNDO');
{
  const m = S.crear(7, 5);
  comprobar(m.tipo.length === S.W * S.H && m.tipo.filter((t, i) => S.esTierra(m, i)).length > 200, 'un mapa de ' + S.W + '×' + S.H + ' con continentes, mar y ríos (' + m.rio.filter(Boolean).length + ' casillas de río)');
  comprobar(S.vivas(m).length === 5 && m.cronica.filter(e => e.tipo === 'fundacion').length === 5 && m.anio === -4000, 'cinco pueblos nacen en el 4000 a. C.');
  const a = JSON.stringify(hasta(S.crear(42, 5), 500)), b = JSON.stringify(hasta(S.crear(42, 5), 500));
  comprobar(a === b, 'la misma semilla da la misma historia (el azar vive en el mundo)');
}

console.log('LA HISTORIA SIGUE EL CALENDARIO REAL');
{
  const renac = [], bronce = [];
  for (const sd of [1, 2, 3, 7, 42, 99, 123, 5]) {
    const m = S.crear(sd, 5); let t = 0, b = null, r = null;
    while (m.anio < 2030 && t++ < 500) { S.turno(m); const e = Math.max(...S.vivas(m).map(c => c.era)); if (b === null && e >= 1) b = m.anio; if (r === null && e >= 5) r = m.anio; }
    bronce.push(b); renac.push(r === null ? 3000 : r);
  }
  const med = l => l.slice().sort((x, y) => x - y)[Math.floor(l.length / 2)];
  comprobar(med(bronce) <= -2800 && med(bronce) >= -3600, 'la Edad del Bronce llega hacia el 3000 a. C. (mediana ' + S.anioTexto(med(bronce)) + ')');
  comprobar(med(renac) >= 1000 && med(renac) <= 1800, 'el Renacimiento, entre los años 1000 y 1800 (mediana ' + S.anioTexto(med(renac)) + ')');
  comprobar(renac.some(a => a < 1400) && renac.some(a => a > 1500), 'pero cada mundo tiene su propia historia: unos se adelantan y otros se estancan');
}

console.log('PASA DE TODO, Y SE EXPLICA');
{
  const tipos = new Set(); let conPorque = 0, total = 0;
  for (const sd of [3, 7, 99]) { const m = hasta(S.crear(sd, 5), 1500); for (const e of m.cronica) { tipos.add(e.tipo.split('_')[0]); total++; if (e.porque && e.precedente) conPorque++; } }
  comprobar(['guerra', 'paz', 'conquista', 'era', 'expansion', 'caida', 'revuelta', 'hambruna'].every(t => tipos.has(t)), 'guerras, paces, conquistas, inventos, expansión, caídas, revueltas y hambrunas (' + [...tipos].join(', ') + ')');
  comprobar(conPorque / total > 0.95, 'casi todo lo que pasa trae su porqué y un precedente real (' + conPorque + ' de ' + total + ')');
  const m = hasta(S.crear(3, 5), 1500);
  comprobar(m.cronica.every(e => !/entra en la Renacimiento|entra en la Neolítico|el teocracia|el república|el democracia/.test(e.titulo + ' ' + e.texto)), 'y con los artículos bien puestos');
}

console.log('LA VOLUNTAD DEL DIOS');
{
  const m = hasta(S.crear(7, 5), -1000);
  const [a, b] = S.vivas(m);
  const p0 = a.pob;
  const r1 = D.obrar(m, 'peste sobre ' + a.nombre);
  comprobar(r1.ok && r1.poder === 'plaga' && a.pob < p0 * 0.8 && r1.suceso.porque, 'una peste nombrando al pueblo: mata, desestabiliza y se explica');
  const r2 = D.obrar(m, 'guerra entre ' + a.nombre + ' y ' + b.nombre);
  comprobar(r2.ok && S.enGuerra(a, b), 'una guerra entre dos pueblos nombrados');
  const r3 = D.obrar(m, 'paz para todos');
  comprobar(r3.ok && !S.enGuerra(a, b), 'y la paz para todos');
  const atrasado = S.vivas(m).slice().sort((x, y) => x.era - y.era)[0], eraAntes = atrasado.era;
  const r4 = D.obrar(m, 'que el más atrasado descubra la imprenta');
  comprobar(r4.ok && atrasado.era === 5 && atrasado.inventos.includes('la imprenta') && (eraAntes < 4 ? r4.suceso.tipo === 'anacronismo' : true), 'regalar la imprenta al más atrasado: salta al Renacimiento' + (eraAntes < 4 ? ', y el anacronismo se paga' : ''));
  const r5 = D.obrar(m, 'que llueva oro sobre ' + b.nombre);
  comprobar(r5.ok && r5.poder === 'oro', '"que llueva oro" es oro, no un diluvio');
  const r6 = D.obrar(m, 'peste', null);
  comprobar(!r6.ok && r6.motivo === 'falta_quien', 'sin saber sobre quién, pregunta');
  const r7 = D.obrar(m, 'peste', b.id);
  comprobar(r7.ok && r7.suceso.civ === b.id, 'con un pueblo elegido en el mapa, va para ese pueblo');
  const n = S.vivas(m).length;
  const r8 = D.obrar(m, 'que aparezca un pueblo nuevo');
  comprobar(r8.ok && S.vivas(m).length === n + 1, 'y puede crear pueblos nuevos');
  comprobar(!D.obrar(m, 'que los gatos gobiernen').ok, 'lo que no entiende no lo inventa (lo pasará a Claude si está)');
}

console.log('LO QUE DECIDA CLAUDE, CON LÍMITES');
{
  const m = hasta(S.crear(7, 5), -1000);
  const c = S.vivas(m)[0], p0 = c.pob, era0 = c.era;
  const e = D.aplicarIA(m, { entendido: true, titulo: 'Los gatos toman el poder', texto: 'Un gato se sienta en el trono y nadie se atreve a quitarlo.', porque: 'La legitimidad es lo que la gente cree.', precedente: 'Calígula quiso hacer cónsul a su caballo.', efectos: [{ civ: c.id, poblacion: 900, estabilidad: -300, era: 9, regimen: 'monarquia_felina' }] });
  comprobar(e && e.divino && e.porque && c.pob <= p0 * 1.6 + 0.01 && c.estab >= 0 && c.era <= era0 + 2, 'los efectos se recortan (población +60% como mucho, dos eras como mucho, estabilidad dentro de 0-100)');
  comprobar(c.regimen !== 'monarquia_felina', 'y un régimen que no existe se ignora');
  comprobar(D.aplicarIA(m, { entendido: false }) === null, 'si Claude no lo entiende, no pasa nada');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
