// Prueba de la banca de Génesis: los mercaderes ahorran; el banco central (del reino) solo presta a banqueros; los
// banqueros prestan de lo suyo a empresarios (que lo devuelven o lo heredan); las fábricas privadas no cuestan
// materiales al reino; y los reinos se prestan oro de banco central a banco central.
// node test/banca.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios', 'mando']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, V = M.vida, X = M.mando;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

// Un reino de la Revolución Industrial con banco (encargado y levantado por sus constructores).
const m = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(m);
const c = S.vivas(m)[0], v = m.vida; X.gobernar(m, c.id);
c.era = 6; c.nivel = 4; c.nivelMax = 4; c.madera = c.piedra = 300; c.oro = 300;
const zona = [c.capital, ...S.vecinos(c.capital)].flatMap(r => V.parcelas(m, r));
V.encargar(m, c, zona.find(t => !V.puedeColocar(m, c, t, 'banco')), 'banco');
const sostener = () => { c.era = Math.max(c.era, 6); c.oro = Math.max(c.oro, 120); c.madera = Math.max(c.madera, 100); c.piedra = Math.max(c.piedra, 100); };
const avisos = [];
const turno = () => { const n0 = (v.anuncios || []).length; S.turno(m); avisos.push(...(v.anuncios || []).slice(n0).filter(x => x.civ === c.id && /🏦/.test(x.texto)).map(x => x.texto)); };
for (let k = 0; k < 90 && !(c.bancos > 0 && c.banca); k++) { sostener(); turno(); }

console.log('EL BANCO CENTRAL');
const ahorros = v.aldeanos.filter(a => a.c === c.id && (a.dinero || 0) > 0).length;
comprobar(ahorros > 0, 'antes del banco, los mercaderes ya han ahorrado (' + ahorros + ' con dinero)');
comprobar(c.bancos > 0 && c.banca && c.banca.fondo > 0 && avisos.some(x => /Abre el banco central/.test(x)), 'el banco central abre con oro del tesoro (' + Math.round((c.banca || {}).fondo || 0) + ')');
{
  const f0 = c.banca.fondo, o0 = c.oro;
  const r = X.ordenar(m, c.id, 'pasad 20 de oro al banco central');
  comprobar(/Pasáis 20 de oro del tesoro al banco central/.test(r.respuesta) && Math.round(c.banca.fondo - f0) === 20 && Math.round(o0 - c.oro) === 20, '«pasad 20 de oro al banco central» mueve el oro del tesoro');
  const r2 = X.ordenar(m, c.id, 'sacad 10 de oro del banco central al tesoro');
  comprobar(/del banco central al tesoro/.test(r2.respuesta) && Math.round(c.banca.fondo - f0) === 10, 'y «sacad 10 del banco central al tesoro», al revés');
}
comprobar(/Interés bajo/.test(X.ordenar(m, c.id, 'bajad los intereses').respuesta) && V.nivelInteres(c) === 0.5, '«bajad los intereses» pone el interés bajo');
comprobar(/Banco central:/.test(X.ordenar(m, c.id, '¿cómo va el banco?').respuesta), '«¿cómo va el banco?» lo cuenta');

console.log('BANQUEROS Y EMPRESARIOS');
let fabrica = null, sinBanquero = false, bancos = 0;
for (let k = 0; k < 200; k++) {
  sostener(); turno();
  const emp = V.empresariosDe(m, c);
  bancos = Math.max(bancos, V.banquerosDe(m, c).length);
  if (emp.some(a => a.emp.neg !== 'banco' && a.emp.banquero == null && !V.banquerosDe(m, c).length && m.turno - a.emp.desde < 2)) sinBanquero = true;
  const t = Object.keys(v.privados || {}).find(t => v.privados[t].civ === c.id && v.obra[t] === V.OBRA.fabrica);
  if (t != null && fabrica == null) fabrica = +t;
}
const primeroBanco = avisos.findIndex(x => /abre su banco/.test(x)), primerPrestamo = avisos.findIndex(x => /presta \d+ de oro a/.test(x));
comprobar(bancos > 0 && primeroBanco >= 0, 'un mercader rico abre su banco con su fortuna y un préstamo del central');
comprobar(!sinBanquero && (primerPrestamo < 0 || primeroBanco < primerPrestamo), 'el banco central no presta a particulares: los préstamos a la gente llegan después, de los banqueros');
comprobar(primerPrestamo >= 0 && avisos.some(x => /El banco de .* presta \d+ de oro a/.test(x)), 'los banqueros prestan de lo suyo a vecinos que montan negocios (' + avisos.filter(x => /El banco de .* presta/.test(x)).length + ' préstamos)');
comprobar(fabrica != null && /^Fábrica de /.test((v.edificios[fabrica] || {}).nombre || ''), 'un empresario levanta su fábrica y lleva su nombre (' + ((v.edificios[fabrica] || {}).nombre || 'ninguna') + ')');
const cobrado = V.banquerosDe(m, c).reduce((k, a) => k + (a.emp.cobrado || 0), 0);
comprobar(cobrado > 0 || c.banca.devuelto > 0, 'los empresarios devuelven a su banquero y el banquero al central (cobrado ' + Math.round(cobrado) + ', devuelto al central ' + Math.round(c.banca.devuelto) + ')');
comprobar(V.empresariosDe(m, c).every(a => a.o === 5), 'banqueros y empresarios se dedican a su negocio (oficio de comerciante: sombrero y traje)');
{
  // Una fábrica privada no le cuesta madera ni piedra al reino al levantarla.
  const t = S.casillas(m, c).flatMap(r => V.parcelas(m, r)).find(t => !v.obra[t] && !(v.andamios && v.andamios[t]) && !V.puedeColocar(m, c, t, 'fabrica'));
  const a = v.aldeanos.filter(x => x.c === c.id && !x.emp && (x.edad || 0) >= V.ADULTO).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0];
  if (t != null && a) {
    v.privados = v.privados || {}; v.privados[t] = { dueno: a.id, civ: c.id };
    a.emp = { neg: 'fabrica', t, monto: 40, deuda: 48, cuota: 1.6, caja: 0, banquero: null, desde: m.turno, atraso: 0 };
    (c.plan.encargos = c.plan.encargos || []).push({ t, o: V.OBRA.fabrica, clave: 'fabrica', privado: a.id });
    c.madera = 0; c.piedra = 0;
    let empezada = false; for (let k = 0; k < 30 && !empezada; k++) { c.madera = 0; c.piedra = 0; c.oro = Math.max(c.oro, 120); S.turno(m); empezada = !!((v.andamios && v.andamios[t]) || v.obra[t] === V.OBRA.fabrica); }
    if (!empezada) console.log('   (encargo: ' + JSON.stringify((c.plan.encargos || []).find(x => x.t === t)) + ', privado: ' + JSON.stringify((v.privados || {})[t]) + ', emp: ' + JSON.stringify(a.emp) + ', puede: ' + V.puedeColocar(m, c, t, 'fabrica', true) + ', constructores: ' + v.aldeanos.filter(x => x.c === c.id && x.o === 2).length + ')');
    comprobar(empezada, 'la fábrica privada se empieza sin madera ni piedra del reino (la paga su dueño)');
  } else comprobar(false, 'hay sitio para probar la fábrica privada');
}
{
  // Muere un empresario: lo hereda su familia (o, sin nadie, el negocio pasa al reino).
  const e = V.empresariosDe(m, c)[0];
  const vivos = v.aldeanos.length;
  if (e) {
    const hijo = v.aldeanos.filter(b => b !== e && b.c === c.id && !b.emp && (b.edad || 0) >= V.ADULTO).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0];
    if (hijo) hijo.padre = e.id;
    e.edad = 99; for (let k = 0; k < 6 && v.aldeanos.includes(e); k++) S.turno(m);
    if (v.aldeanos.includes(e) || (hijo && !hijo.emp)) console.log('   (sigue vivo: ' + v.aldeanos.includes(e) + ', hijo en el reino: ' + (hijo && v.aldeanos.includes(hijo)) + ', hijo emp: ' + !!(hijo && hijo.emp) + ', último: ' + ((v.anuncios || []).filter(x => /🏦/.test(x.texto)).slice(-2).map(x => x.texto).join(' / ')) + ')');
    comprobar(!v.aldeanos.includes(e) && (!hijo || hijo.emp), 'al morir un empresario, su hijo hereda el negocio' + (hijo ? ' (' + hijo.nombre + ')' : ''));
  }
  comprobar(vivos > 0, 'el reino sigue vivo');
}

console.log('LOS CRÉDITOS ENTRE REINOS');
{
  const o = S.vivas(m).find(x => x !== c && !S.enGuerra(c, x));
  c.banca.fondo = Math.max(c.banca.fondo, 60);
  const f0 = c.banca.fondo, oro0 = c.oro, oo0 = o.oro || 0;
  const r = X.ordenar(m, c.id, 'prestad 40 de oro a ' + o.nombre);
  comprobar(/presta 40 de oro/.test(r.respuesta) && Math.round(f0 - c.banca.fondo) === 40 && Math.round(c.oro - oro0) === 0 && Math.round((o.oro || 0) - oo0) === 40, '«prestad 40 de oro a X»: sale del banco central y entra en el tesoro del otro');
  comprobar(S.motivos(m, o, c).some(x => /nos prestó oro/.test(x[0])), 'el deudor aprecia a quien le prestó');
  o.oro = 500; const resta0 = m.creditos.find(cr => cr.a === o.id).resta;
  const f1 = c.banca.fondo;
  for (let k = 0; k < 6; k++) { c.oro = Math.max(c.oro, 120); S.turno(m); }
  const cr = (m.creditos || []).find(x => x.a === o.id);
  comprobar(cr && cr.resta < resta0, 'lo devuelve a plazos al banco central (' + resta0 + ' → ' + (cr ? cr.resta : 0) + ')');
  comprobar(/Perdonáis/.test(X.ordenar(m, c.id, 'perdonad la deuda de ' + o.nombre).respuesta) && !(m.creditos || []).some(x => x.a === o.id) && S.motivos(m, o, c).some(x => /perdonó/.test(x[0])), 'perdonar la deuda la borra y se recuerda');
  comprobar(/hace falta un banco/.test(S.prestar(m, o, c, 10).texto) || o.bancos > 0, 'sin banco no se puede prestar');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
