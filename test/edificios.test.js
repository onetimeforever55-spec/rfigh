// Prueba de los edificios de Génesis: cada familia vive en una casa de verdad (con sus camas), y lo que promete
// cada edificio funciona: la plaza (el mercado) mejora lo que ganan los mercaderes (el banco no da premios), la central da fuerza a las
// fábricas, la plaza hace mejores las fiestas y el pozo ayuda a apagar los fuegos.
// node test/edificios.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios', 'mando']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, V = M.vida, X = M.mando, O = V.OBRA;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

console.log('CADA FAMILIA EN SU CASA');
const m = S.crear(3, 6, { ritmo: 3 }), v = m.vida;
for (let k = 0; k < 300; k++) S.turno(m);
{
  const gente = v.aldeanos.filter(a => a.colono == null && a.aBordo == null);
  const enCasa = gente.filter(a => a.casa != null && [O.casa, O.casona, O.centro, O.ayuntamiento, O.campamento].includes(v.obra[a.casa]));
  const enCasaDeVerdad = gente.filter(a => a.casa != null && (v.obra[a.casa] === O.casa || v.obra[a.casa] === O.casona));
  comprobar(enCasa.length >= gente.length * 0.95, 'casi todos tienen dónde vivir (' + enCasa.length + ' de ' + gente.length + ')');
  comprobar(enCasaDeVerdad.length >= gente.length * 0.6, 'la mayoría vive en una casa de verdad, no en la plaza (' + enCasaDeVerdad.length + ')');
  const porCasa = new Map(); for (const a of enCasa) porCasa.set(a.casa, (porCasa.get(a.casa) || 0) + 1);
  const extra = c => M.tec(c, 'casa');
  const pasadas = [...porCasa].filter(([t, n]) => { const c = S.civ(m, m.dueno[V.region(m, t)]); return c && n > V.camasDe(v, t, extra(c)); });
  comprobar(!pasadas.length, 'ninguna casa tiene más gente que camas (' + pasadas.length + ' pasadas)');
  const parejas = gente.filter(a => a.pareja != null && a.id < a.pareja).map(a => [a, gente.find(b => b.id === a.pareja)]).filter(([, b]) => b);
  const juntas = parejas.filter(([a, b]) => a.casa === b.casa).length;
  comprobar(parejas.length > 0 && juntas >= parejas.length * 0.7, 'las parejas viven juntas (' + juntas + ' de ' + parejas.length + ')');
  // La ficha de una casa dice quién vive en ella.
  const unaCasa = [...porCasa.keys()].find(t => v.obra[t] === O.casa);
  comprobar(unaCasa != null && v.aldeanos.some(a => a.casa === unaCasa), 'cada casa tiene sus vecinos');
}
{
  // De noche se vuelve a su casa (no a la plaza).
  let vuelven = 0, total = 0;
  for (let k = 0; k < 8; k++) { S.turno(m); for (const a of v.aldeanos) if (a.dormir && a.casa != null && v.obra[a.casa] === O.casa) { total++; if (a.tx === a.casa % v.tw && a.ty === Math.floor(a.casa / v.tw)) vuelven++; } }
  comprobar(total > 0 && vuelven >= total * 0.8, 'de noche cada uno vuelve a dormir a su casa (' + vuelven + ' de ' + total + ')');
}

console.log('LA PLAZA ES MERCADO; EL BANCO NO DA PREMIOS');
{
  const c = S.vivas(m).find(x => v.aldeanos.some(a => a.c === x.id && a.o === 5));
  const coms = v.aldeanos.filter(a => a.c === c.id && a.o === 5 && !a.merc && !a.emp && a.gremio == null);
  const gana = (bancos, fuentes) => { const b0 = c.bancos, f0 = c.fuentes, d0 = coms.map(a => a.dinero || 0); c.bancos = bancos; c.fuentes = fuentes; V.comercio(m, c, 0.25); const g = coms.reduce((k, a, i) => k + (a.dinero || 0) - d0[i], 0); coms.forEach((a, i) => { a.dinero = d0[i]; }); c.bancos = b0; c.fuentes = f0; return g; };
  const nada = gana(0, 0), conBanco = gana(1, 0), conPlaza = gana(0, 1);
  comprobar(coms.length > 0 && Math.abs(conBanco - nada) < 1e-9, 'el banco no da premios: los comerciantes ganan lo mismo con o sin él (' + nada.toFixed(2) + ' → ' + conBanco.toFixed(2) + ')');
  comprobar(conPlaza > nada * 1.05, 'con plaza pública hay mercado: también ganan más (' + nada.toFixed(2) + ' → ' + conPlaza.toFixed(2) + ')');
}

console.log('LA CENTRAL DA FUERZA A LAS FÁBRICAS');
{
  const c = S.vivas(m)[0], antes = { era: c.era, centrales: c.centrales, carbon: c.carbon, petroleo: c.petroleo };
  c.era = 7; c.centrales = 0;
  const sin = V.fuerza(c);
  c.centrales = 1; c.carbon = 500; c.petroleo = 500;
  const con = V.fuerza(c);
  Object.assign(c, antes);
  comprobar(sin === 1 && con === 1.5, 'con una central en marcha, la forja y las fábricas sacan un 50 % más (' + sin + ' → ' + con + ')');
}

console.log('LA PLAZA HACE MEJORES LAS FIESTAS');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(g);
  const c = S.vivas(g)[0]; X.gobernar(g, c.id);
  const fiesta = plaza => { c.fuentes = plaza; c.plan.ultimaFiesta = null; c.comida = 500; c.estab = 50; X.ordenar(g, c.id, 'haced una fiesta'); return c.estab - 50; };
  const sin = fiesta(0), con = fiesta(1);
  comprobar(con > sin, 'una fiesta con plaza pública sube más la estabilidad (+' + sin + ' → +' + con + ')');
}

console.log('EL POZO AYUDA A APAGAR LOS FUEGOS');
{
  const t = v.obra.findIndex(o => o === O.pozo);
  if (t < 0) comprobar(true, '(no hay ningún pozo en este mundo: nada que comprobar)');
  else {
    const r = V.region(m, t), set = V.comarcasConPozo(m);
    comprobar(set.has(r) && S.vecinos(r).every(n => set.has(n)), 'la comarca del pozo y las de al lado tienen agua a mano para los cubos');
  }
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
