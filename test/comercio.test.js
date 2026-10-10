// Prueba del comercio entre reinos de Génesis: tu reino (y tus mercaderes) solo comercian con quien tú abras
// comercio; si lo cierras, nadie comercia contigo (ni carretas, ni barcos, ni compras); en guerra no hay comercio;
// y los créditos del banco central a tu reino solo llegan si los pides.
// node test/comercio.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios', 'mando']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, V = M.vida, X = M.mando;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

// Gobiernas un reino desde el principio: en 200 turnos, nadie abre comercio contigo sin que tú lo digas.
const m = S.crear(7, 5, { ritmo: 3 }), v = m.vida, c = S.vivas(m)[0];
X.gobernar(m, c.id);
for (let k = 0; k < 200; k++) S.turno(m);
const o = S.vivas(m).find(x => x !== c && !S.enGuerra(c, x));
const barcosDe = (de, a) => v.barcos.filter(b => b.c === de.id && b.tipo === 'mercante' && b.destino != null && m.dueno[V.region(m, b.destino)] === a.id).length;
const rutaActivaCon = x => v.rutas.some(r => r.tipo === 'externa' && [r.a, r.b].includes(c.id) && [r.a, r.b].includes(x.id) && v.aldeanos.some(a => a.ruta === r.id && a.comercio));

console.log('SOLO CON QUIEN TÚ ABRAS COMERCIO');
{
  const socios = V.sociosDe(m, c);
  comprobar(!socios.length && S.vivas(m).filter(x => x !== c).every(x => !V.comercian(m, c, x)), 'sin abrir nada, tu reino no comercia con nadie (aunque otros quieran o tengan puerto en tu mar)');
  for (let k = 0; k < 10; k++) S.turno(m);
  comprobar(S.vivas(m).filter(x => x !== c).every(x => barcosDe(x, c) === 0), 'los barcos mercantes de otros no vienen a tu puerto sin permiso');
  const r = X.ordenar(m, c.id, 'abrid una ruta comercial con ' + o.nombre).respuesta;
  comprobar(/Tratado con/.test(r) && V.comercian(m, c, o) && V.sociosDe(m, c).includes(o), 'con «abrid una ruta comercial con X», comerciáis (' + o.nombre + ')');
  const tercero = S.vivas(m).find(x => x !== c && x !== o);
  comprobar(!tercero || !V.comercian(m, c, tercero), 'pero solo con ese reino, no con los demás');
}

console.log('CERRAR EL COMERCIO');
{
  const r = X.ordenar(m, c.id, 'cerrad el comercio con ' + o.nombre).respuesta;
  comprobar(/Cerráis el comercio con/.test(r) && !V.comercian(m, c, o) && !V.sociosDe(m, c).includes(o), '«cerrad el comercio con X» lo corta: dejáis de ser socios');
  let barcos = 0, carretas = 0;
  for (let k = 0; k < 15; k++) { S.turno(m); barcos += barcosDe(o, c) + barcosDe(c, o); if (rutaActivaCon(o) && v.rutas.some(ru => ru.tipo === 'externa' && [ru.a, ru.b].includes(o.id) && [ru.a, ru.b].includes(c.id) && V.comercian(m, c, o))) carretas++; }
  comprobar(barcos === 0 && carretas === 0, 'y ellos tampoco comercian contigo: ni barcos ni carretas (' + barcos + ', ' + carretas + ')');
  comprobar(/No comerciáis con ningún reino|no hay a quién/.test(X.ordenar(m, c.id, 'comprad 10 de piedra').respuesta) || !V.sociosDe(m, c).includes(o), 'ni se les puede comprar');
  X.ordenar(m, c.id, 'abrid una ruta comercial con ' + o.nombre);
  comprobar(V.comercian(m, c, o), 'y se puede volver a abrir');
}

console.log('EN GUERRA NO HAY COMERCIO');
{
  S.declararGuerra(m, c, o, 'prueba');
  comprobar(S.enGuerra(c, o) && !V.comercian(m, c, o) && !V.sociosDe(m, c).includes(o), 'en guerra se para el comercio, aunque haya tratado');
  // En guerra con uno, el comercio con los demás sigue.
  const otro = S.vivas(m).find(x => x !== c && x !== o && !S.enGuerra(c, x));
  if (otro) { X.ordenar(m, c.id, 'abrid una ruta comercial con ' + otro.nombre); comprobar(V.comercian(m, c, otro) && V.sociosDe(m, c).includes(otro), 'en guerra con uno, sigues comerciando con los demás (' + otro.nombre + ')'); }
  // Y la guerra rompe el tratado: tras la paz no se vuelve a comerciar solo.
  S.hacerPaz(m, c, o, 'paz de prueba');
  comprobar(!S.enGuerra(c, o) && !V.comercian(m, c, o), 'tras la paz no se vuelve a comerciar sin que lo digas');
  X.ordenar(m, c.id, 'abrid una ruta comercial con ' + o.nombre);
  comprobar(V.comercian(m, c, o), 'hasta que vuelves a abrir la ruta');
  const a = S.vivas(m).find(x => x !== c && x !== o && !S.enGuerra(x, o)), b = o;
  if (a) { S.declararGuerra(m, a, b, 'prueba'); comprobar(!V.comercian(m, a, b), 'también entre otros dos reinos en guerra'); }
}

console.log('LOS MERCADERES Y EL COMERCIO EXTERIOR');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 150; k++) S.turno(g);
  const r = S.vivas(g).find(x => g.vida.aldeanos.some(a => a.c === x.id && a.o === 5));
  X.gobernar(g, r.id); r.plan.socios = []; r.plan.embargo = []; r.plan.comercioLibre = false;
  const coms = g.vida.aldeanos.filter(a => a.c === r.id && a.o === 5 && !a.merc && !a.emp && a.gremio == null);
  const gana = () => { const d0 = coms.map(a => a.dinero || 0); V.comercio(g, r, 0.25); const k = coms.reduce((s, a, i) => s + (a.dinero || 0) - d0[i], 0); coms.forEach((a, i) => { a.dinero = d0[i]; }); return k; };
  const solos = gana();
  const otros = S.vivas(g).filter(x => x !== r && !S.enGuerra(x, r)).slice(0, 2); r.plan.socios = otros.map(x => x.id);
  const conSocios = gana();
  comprobar(coms.length > 0 && otros.length && conSocios > solos * 1.3, 'sin socios, los comerciantes solo ganan el comercio de dentro; con socios, también el de fuera (' + solos.toFixed(2) + ' → ' + conSocios.toFixed(2) + ')');
}

console.log('QUIEN TOMA UN REINO A MITAD DE PARTIDA NO HEREDA SUS TRATADOS');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 200; k++) S.turno(g);
  const r = S.vivas(g).find(x => V.sociosDe(g, x).length > 0);
  if (r) {
    const antes = V.sociosDe(g, r).length; X.gobernar(g, r.id);
    comprobar(antes > 0 && V.sociosDe(g, r).length === 0, 'al tomarlo deja de comerciar: el comercio lo decides tú (' + antes + ' → ' + V.sociosDe(g, r).length + ' socios)');
    comprobar((g.vida.anuncios || []).some(x => x.civ === r.id && /comerciaba con/.test(x.texto)), 'y se te avisa de con quién comerciaba');
    let barcos = 0; for (let k = 0; k < 15; k++) { S.turno(g); barcos += g.vida.barcos.filter(b => b.tipo === 'mercante' && b.ruta && b.destino != null && (b.c === r.id || g.dueno[V.region(g, b.destino)] === r.id)).length; }
    comprobar(barcos === 0, 'ni sus barcos ni los de otros comercian con él sin tu orden (' + barcos + ')');
  }
}

console.log('LA INDUSTRIA PRIVADA VENDE FUERA SOLO A QUIEN TÚ DEJES');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 150; k++) S.turno(g);
  const r = S.vivas(g)[0]; X.gobernar(g, r.id); r.plan.socios = []; r.plan.embargo = []; r.plan.comercioLibre = false;
  r.era = Math.max(r.era, 5); r.bancos = 1; r.banca = r.banca || { fondo: 100, prestado: 0, devuelto: 0, perdido: 0 };
  const a = g.vida.aldeanos.find(x => x.c === r.id && !x.emp && !x.merc && (x.edad || 0) >= V.ADULTO);
  a.emp = { neg: 'mercader', caja: 0, deuda: 0, cuota: 0, banquero: null, desde: g.turno, atraso: 0 };
  const caja = () => { const c0 = a.emp.caja; const o0 = r.oro; V.banca(g, r); const d = a.emp.caja - c0; a.emp.caja = c0; r.oro = o0; return d; };
  const solo = caja();
  r.plan.socios = S.vivas(g).filter(x => x !== r && !S.enGuerra(x, r)).slice(0, 2).map(x => x.id);
  const conSocios = caja();
  comprobar(conSocios > solo * 1.3, 'sin socios, un empresario solo vende dentro; con los reinos que abras, también fuera (' + solo.toFixed(2) + ' → ' + conSocios.toFixed(2) + ')');
}

console.log('COMPRAR LO QUE TIENE OTRO REINO (AUNQUE NO LE SOBRE)');
{
  const g = S.crear(5, 6, { ritmo: 3 }), yo = S.vivas(g)[0]; X.gobernar(g, yo.id);
  for (let k = 0; k < 300; k++) S.turno(g);
  // Un socio al que se llega por carretera (la ruta se abre y se traza en el acto).
  let socio = null;
  for (const o of S.vivas(g).filter(o => o !== yo && !S.enGuerra(yo, o))) { const t = X.ordenar(g, yo.id, 'abrid una ruta comercial con ' + o.nombre).respuesta; if (/carretera|Ya teníais ruta/.test(t)) { socio = o; break; } X.ordenar(g, yo.id, 'cerrad el comercio con ' + o.nombre); }
  socio.metal = Math.max(socio.metal || 0, 40);
  const r = X.ordenar(g, yo.id, 'comprad 10 de hierro').respuesta;
  let compradas = 0, llegan = 0;
  for (let k = 0; k < 40; k++) { socio.metal = Math.max(socio.metal || 0, 40); yo.oro = Math.max(yo.oro || 0, 300); g.vida.anuncios = []; S.turno(g); llegan += (g.vida.anuncios || []).filter(x => x.civ === yo.id && /📦 Llegan \d+ de metal/.test(x.texto)).length; compradas += ((g.mercado && g.mercado.tratos) || []).filter(x => x.t === g.turno && x.compra === yo.id && x.que === 'metal').reduce((q, x) => q + x.n, 0); }
  comprobar(/Os lo pueden vender/.test(r) && r.includes(socio.nombre), 'al encargarlo, el consejero dice quién lo tiene y cómo llega (' + r.slice(r.indexOf('Os lo'), r.indexOf('Os lo') + 60) + '…)');
  comprobar(compradas >= 5 && compradas <= 12, 'y vuestros comerciantes lo traen, aunque al otro no le sobre (lo vende de su reserva, más caro), y solo lo encargado (' + compradas + ' de 10)');
  comprobar(llegan > 0, 'y se avisa cuando llega (' + llegan + ' avisos «📦 Llegan … de metal»)');
}

console.log('LOS CRÉDITOS A TU REINO, SOLO SI LOS PIDES');
{
  const g = S.crear(5, 5, { ritmo: 3 }); for (let k = 0; k < 220; k++) S.turno(g);
  const yo = S.vivas(g)[0]; X.gobernar(g, yo.id);
  for (const x of S.vivas(g)) if (x !== yo) { x.bancos = Math.max(x.bancos || 0, 1); x.banca = x.banca || { fondo: 0, prestado: 0, devuelto: 0, perdido: 0 }; x.banca.fondo = 200; x.rel[yo.id] = 90; }
  let recibidos = 0;
  for (let k = 0; k < 30; k++) { yo.oro = 0; yo.estab = 30; S.turno(g); recibidos += (g.creditos || []).filter(cr => cr.a === yo.id).length; }
  comprobar(recibidos === 0, 'aunque vayas mal, nadie le presta a tu reino por su cuenta (' + recibidos + ')');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
