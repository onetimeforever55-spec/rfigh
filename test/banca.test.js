// Prueba de la banca de Génesis: el banco presta a los aldeanos (empresarios con su negocio, que lo devuelven o
// lo heredan), las fábricas privadas no cuestan materiales al reino, y los reinos se prestan oro entre ellos.
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
for (let k = 0; k < 90 && !(c.bancos > 0); k++) { sostener(); S.turno(m); }

console.log('EL BANCO');
comprobar(c.bancos > 0 && c.banca && c.banca.fondo > 0, 'con banco, el reino tiene un fondo para prestar (' + Math.round((c.banca || {}).fondo || 0) + ')');
comprobar(/Interés bajo/.test(X.ordenar(m, c.id, 'bajad los intereses').respuesta) && V.nivelInteres(c) === 0.5, '«bajad los intereses» pone el interés bajo');
comprobar(/El banco tiene/.test(X.ordenar(m, c.id, '¿cómo va el banco?').respuesta), '«¿cómo va el banco?» lo cuenta');

console.log('LOS EMPRESARIOS');
let vistos = 0, fabrica = null, maderaAntes = null;
const anuncios = [];
for (let k = 0; k < 160; k++) {
  sostener();
  const n0 = (v.anuncios || []).length; S.turno(m); anuncios.push(...(v.anuncios || []).slice(n0).filter(x => /🏦/.test(x.texto)).map(x => x.texto));
  vistos = Math.max(vistos, V.empresariosDe(m, c).length);
  const t = Object.keys(v.privados || {}).find(t => v.privados[t].civ === c.id && v.obra[t] === V.OBRA.fabrica);
  if (t != null && fabrica == null) fabrica = +t;
}
comprobar(vistos > 0 && anuncios.some(x => /El banco presta/.test(x)), 'el banco presta a aldeanos que se hacen empresarios (' + anuncios.filter(x => /presta/.test(x)).length + ' préstamos)');
comprobar(fabrica != null && /^Fábrica de /.test((v.edificios[fabrica] || {}).nombre || ''), 'un empresario levanta su fábrica y lleva su nombre (' + ((v.edificios[fabrica] || {}).nombre || 'ninguna') + ')');
comprobar(c.banca.devuelto > 0, 'los empresarios devuelven al banco (' + Math.round(c.banca.devuelto) + ' de oro)');
comprobar(V.empresariosDe(m, c).every(a => a.o === 5), 'los empresarios se dedican a su negocio (oficio de comerciante: sombrero y traje)');
{
  // Una fábrica privada no le cuesta madera ni piedra al reino al levantarla.
  const t = S.casillas(m, c).flatMap(r => V.parcelas(m, r)).find(t => !v.obra[t] && !(v.andamios && v.andamios[t]) && !V.puedeColocar(m, c, t, 'fabrica'));
  const a = v.aldeanos.find(x => x.c === c.id && !x.emp && (x.edad || 0) >= V.ADULTO);
  if (t != null && a) {
    v.privados = v.privados || {}; v.privados[t] = { dueno: a.id, civ: c.id };
    a.emp = { neg: 'fabrica', t, monto: 40, deuda: 48, cuota: 1.6, caja: 0, desde: m.turno, atraso: 0 };
    (c.plan.encargos = c.plan.encargos || []).push({ t, o: V.OBRA.fabrica, clave: 'fabrica', privado: a.id });
    c.madera = 0; c.piedra = 0;
    let empezada = false; for (let k = 0; k < 30 && !empezada; k++) { c.madera = 0; c.piedra = 0; c.oro = Math.max(c.oro, 120); S.turno(m); empezada = !!((v.andamios && v.andamios[t]) || v.obra[t] === V.OBRA.fabrica); }
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
  const oro0 = c.oro, oo0 = o.oro || 0;
  const r = X.ordenar(m, c.id, 'prestad 40 de oro a ' + o.nombre);
  comprobar(/Prestáis 40 de oro/.test(r.respuesta) && Math.round(oro0 - c.oro) === 40 && Math.round((o.oro || 0) - oo0) === 40, '«prestad 40 de oro a X» pasa el oro');
  comprobar(S.motivos(m, o, c).some(x => /nos prestó oro/.test(x[0])), 'el deudor aprecia a quien le prestó');
  o.oro = 500; const resta0 = m.creditos.find(cr => cr.a === o.id).resta;
  for (let k = 0; k < 6; k++) { c.oro = Math.max(c.oro, 120); S.turno(m); }
  const cr = (m.creditos || []).find(x => x.a === o.id);
  comprobar(cr && cr.resta < resta0, 'lo devuelve a plazos (' + resta0 + ' → ' + (cr ? cr.resta : 0) + ')');
  comprobar(/Perdonáis/.test(X.ordenar(m, c.id, 'perdonad la deuda de ' + o.nombre).respuesta) && !(m.creditos || []).some(x => x.a === o.id) && S.motivos(m, o, c).some(x => /perdonó/.test(x[0])), 'perdonar la deuda la borra y se recuerda');
  comprobar(/hace falta un banco/.test(S.prestar(m, o, c, 10).texto) || o.bancos > 0, 'sin banco no se puede prestar');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
