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

console.log('LOS GREMIOS (Edad Media)');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(g);
  const r = S.vivas(g)[0], w = g.vida; X.gobernar(g, r.id); g.modo = 'pueblo';
  r.nivel = 4; r.nivelMax = 4; r.madera = r.piedra = 300; r.oro = 300;
  r.plan.comercioLibre = true; // (con socios: sin comercio exterior, los mercaderes ganan menos y tardan en hacerse ricos)
  X.ordenar(g, r.id, 'quiero 4 comerciantes');
  const av = []; let gremio = null, casona = null, conSueldo = false, oroDeObras = 0;
  for (let k = 0; k < 220 && !(gremio != null && casona != null && conSueldo); k++) {
    r.era = Math.max(r.era, 4); r.oro = Math.max(r.oro, 100); r.madera = Math.max(r.madera, 100); r.piedra = Math.max(r.piedra, 100);
    const n0 = (w.anuncios || []).length; S.turno(g);
    av.push(...(w.anuncios || []).slice(n0).filter(x => x.civ === r.id).map(x => x.texto));
    for (const t of Object.keys(w.privados || {})) { if (w.obra[t] === V.OBRA.gremio && gremio == null) gremio = +t; if (w.obra[t] === V.OBRA.casona && casona == null) casona = +t; }
    if (w.aldeanos.some(a => a.gremio != null && a.o === 5 && V.mercaderesDe(g, r).some(x => x.id === a.gremio))) conSueldo = true;
  }
  for (const x of av) { const q = x.match(/paga (\d+) de oro al reino/); if (q) oroDeObras += +q[1]; }
  comprobar(av.some(x => /funda un gremio de mercaderes/.test(x)) && gremio != null && /^Gremio de mercaderes /.test((w.edificios[gremio] || {}).nombre || ''), 'un comerciante que ahorró funda un gremio con su dinero (' + ((w.edificios[gremio] || {}).nombre || 'ninguno') + ')');
  comprobar(conSueldo, 'los comerciantes del gremio trabajan para el mercader');
  comprobar(casona != null && /^Casona de /.test((w.edificios[casona] || {}).nombre || ''), 'el mercader que gana lo bastante se hace su casona (' + ((w.edificios[casona] || {}).nombre || 'ninguna') + ')');
  comprobar(oroDeObras > 0, 'gremio y casona se pagan al reino: materiales y obra (' + oroDeObras + ' de oro)');
  comprobar(V.mercaderesDe(g, r).every(a => !a.emp || a.emp.neg === 'banco'), 'los mercaderes no son empresarios de un banco: el gremio es suyo');
}

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
for (let k = 0; k < 320 && !(fabrica != null && V.banquerosDe(m, c).length); k++) {
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
  // (Un reino con categoría de villa, que es lo que pide la fábrica; y un solar libre o, como en el juego cuando la ciudad está llena, un huerto.)
  c.nivelMax = Math.max(c.nivelMax || 0, 4); c.nivel = Math.max(c.nivel || 0, 3);
  const solares = S.casillas(m, c).flatMap(r => V.parcelas(m, r)).filter(t => !(v.andamios && v.andamios[t]) && !(v.privados && v.privados[t]) && !V.puedeColocar(m, c, t, 'fabrica'));
  const cap = V.centro(m, c.capital), lejos = t => Math.abs(t % v.tw - cap % v.tw) + Math.abs(Math.floor(t / v.tw) - Math.floor(cap / v.tw));
  const t = S.ordenarPor(solares.slice(), x => (v.obra[x] ? 1e6 : 0) + lejos(x))[0];
  const a = v.aldeanos.filter(x => x.c === c.id && !x.emp && (x.edad || 0) >= V.ADULTO).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0];
  if (t != null && a) {
    v.privados = v.privados || {}; v.privados[t] = { dueno: a.id, civ: c.id, tipo: 'fabrica' };
    a.emp = { neg: 'fabrica', t, monto: 40, deuda: 48, cuota: 1.6, caja: 0, banquero: null, desde: m.turno, atraso: 0 };
    (c.plan.encargos = c.plan.encargos || []).push({ t, o: V.OBRA.fabrica, clave: 'fabrica', privado: a.id });
    c.madera = 0; c.piedra = 0;
    let empezada = false; for (let k = 0; k < 30 && !empezada; k++) { a.edad = V.ADULTO + 1; c.madera = 0; c.piedra = 0; c.oro = Math.max(c.oro, 120); c.nivelMax = Math.max(c.nivelMax, 4); S.turno(m); empezada = !!((v.andamios && v.andamios[t]) || v.obra[t] === V.OBRA.fabrica); }
    if (!empezada) console.log('   (encargo: ' + JSON.stringify((c.plan.encargos || []).find(x => x.t === t)) + ', privado: ' + JSON.stringify((v.privados || {})[t]) + ', emp: ' + JSON.stringify(a.emp) + ', puede: ' + V.puedeColocar(m, c, t, 'fabrica', true) + ', constructores: ' + v.aldeanos.filter(x => x.c === c.id && x.o === 2).length + ')');
    comprobar(empezada, 'la fábrica privada se empieza sin madera ni piedra del reino (la paga su dueño)');
  } else { const k = {}; for (const t of S.casillas(m, c).flatMap(r => V.parcelas(m, r))) { const q = V.puedeColocar(m, c, t, 'fabrica') || (v.privados && v.privados[t] ? 'privado' : 'OK'); k[q] = (k[q] || 0) + 1; } console.log('   (' + JSON.stringify(k) + ', era ' + c.era + ', nivel ' + c.nivel + ')'); comprobar(false, 'hay sitio para probar la fábrica privada'); }
}
{
  // Muere un empresario: lo hereda su familia (o, sin nadie, el negocio pasa al reino).
  const e = V.empresariosDe(m, c)[0];
  const vivos = v.aldeanos.length;
  if (e) {
    const hijo = v.aldeanos.filter(b => b !== e && b.c === c.id && !b.emp && (b.edad || 0) >= V.ADULTO).sort((x, y) => (x.edad || 0) - (y.edad || 0))[0];
    if (hijo) hijo.padre = e.id;
    const negocio = e.emp;
    e.edad = 99; for (let k = 0; k < 6 && v.aldeanos.includes(e); k++) S.turno(m);
    const heredero = v.aldeanos.find(b => b.emp === negocio);
    if (v.aldeanos.includes(e) || (hijo && !heredero)) console.log('   (sigue vivo: ' + v.aldeanos.includes(e) + ', hijo en el reino: ' + (hijo && v.aldeanos.includes(hijo)) + ', hijo emp: ' + !!(hijo && hijo.emp) + ', último: ' + ((v.anuncios || []).filter(x => /🏦/.test(x.texto)).slice(-2).map(x => x.texto).join(' / ')) + ')');
    comprobar(!v.aldeanos.includes(e) && (!hijo || heredero), 'al morir un empresario, su familia hereda el negocio' + (heredero ? ' (' + heredero.nombre + ')' : ''));
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

console.log('EL PASO DE EDAD SE PAGA COMO LAS OBRAS');
{
  const e = S.crear(9, 5, { ritmo: 3 }); for (let k = 0; k < 20; k++) S.turno(e);
  const [c1, c2] = S.vivas(e), req = M.EDADES[c1.era + 1], ks = ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]);
  // Con todo: de golpe.
  for (const k of ks) c1[k] = req[k] + 5;
  S.empezarSubida(e, c1);
  comprobar(!c1.subiendo.debe && ks.every(k => Math.round(c1[k]) === 5), 'con todo el precio, se paga de golpe');
  // Con un tercio: la cuarta parte ahora y el resto poco a poco; si falta, espera; al tener, termina.
  for (const k of ks) c2[k] = Math.ceil(req[k] / 3);
  const era0 = c2.era;
  comprobar(!ks.some(k => S.puedeSubir(e, c2).falta.some(f => f.endsWith(' de ' + k))), 'para empezar basta con la cuarta parte de cada cosa');
  S.empezarSubida(e, c2);
  comprobar(c2.subiendo && c2.subiendo.debe && ks.every(k => Math.round(c2.subiendo.debe[k]) === req[k] - Math.ceil(req[k] * 0.25)), 'sin todo, paga la cuarta parte y apunta lo que falta');
  for (const k of ks) c2[k] = 0;
  const hasta0 = c2.subiendo.hasta;
  for (let k = 0; k < 6; k++) { for (const x of ks) c2[x] = 0; S.turno(e); }
  comprobar(c2.era === era0 && c2.subiendo && c2.subiendo.hasta > hasta0, 'sin material, el paso espera (no avanza de edad)');
  for (let k = 0; k < 12 && c2.era === era0; k++) { for (const x of ks) c2[x] = Math.max(c2[x] || 0, req[x]); S.turno(e); }
  comprobar(c2.era === era0 + 1, 'con material, termina de pagar y pasa de edad');
}

console.log('LOS GREMIOS SALEN SOLOS EN UNA PARTIDA NORMAL');
{
  // Sin ayudas: aunque la capital esté llena de calles y casas, el gremio busca sitio (otra ciudad, más lejos o un huerto).
  const n = S.crear(3, 6, { ritmo: 3 });
  for (let k = 0; k < 420; k++) S.turno(n);
  const conGremio = S.vivas(n).filter(c => V.gremiosDe(n, c).length > 0);
  comprobar(conGremio.length >= 2, 'en la Edad Media los comerciantes ricos fundan gremios por su cuenta (' + conGremio.length + ' reinos con gremio)');
  // LAS CASAS COMERCIALES: el pariente de un mercader no funda un gremio aparte, abre una sucursal de la casa.
  const avisos2 = [];
  for (let k = 0; k < 220; k++) { const n0 = (n.vida.anuncios || []).length; S.turno(n); avisos2.push(...(n.vida.anuncios || []).slice(n0).map(x => x.texto)); }
  const mercs = S.vivas(n).flatMap(c => V.mercaderesDe(n, c)), suc = mercs.filter(a => a.merc.de != null);
  comprobar(suc.length > 0 && avisos2.some(x => /abre una sucursal de la casa comercial/.test(x)), 'los parientes abren sucursales de la casa de la familia (' + suc.length + ' sucursales)');
  comprobar(suc.every(a => { const j = mercs.find(x => x.id === a.merc.de); return j && j.familia === a.familia && j.merc.de == null && a.merc.caja === 0; }), 'lo que gana cada sucursal sube a la caja del jefe de la familia');
  comprobar(S.vivas(n).every(c => { const jefes = V.mercaderesDe(n, c).filter(a => a.merc.de == null).map(a => a.familia); return jefes.length === new Set(jefes).size; }), 'cada familia tiene una sola casa comercial en su reino');
  // Ni gremios de más ni vacíos que se acumulen: uno por ciudad como mucho, y ninguna familia con más de 4.
  const cuenta = S.vivas(n).map(c => { let g = 0; for (let t = 0; t < n.vida.obra.length; t++) if (n.vida.obra[t] === V.OBRA.gremio && n.dueno[V.region(n, t)] === c.id) g++; return { g, ciudades: 1 + (n.ciudades || []).filter(x => x.civ === c.id).length }; });
  comprobar(cuenta.every(x => x.g <= x.ciudades), 'como mucho un gremio por ciudad (' + cuenta.map(x => x.g + '/' + x.ciudades).join(', ') + ')');
  const porFamilia = S.vivas(n).flatMap(c => { const f = {}; for (const a of V.mercaderesDe(n, c)) f[a.familia] = (f[a.familia] || 0) + 1; return Object.values(f); });
  comprobar(porFamilia.every(k => k <= 4), 'ninguna familia tiene más de una casa y 3 sucursales (máximo ' + Math.max(0, ...porFamilia) + ')');
  // LAS PROVINCIAS: también crecen (familias que se mudan desde la capital) y, si están llenas, sus obras van al lado.
  const prov = S.vivas(n).filter(c => (n.ciudades || []).some(x => x.civ === c.id)).map(c => { const l = n.vida.aldeanos.filter(a => a.c === c.id), cs = (n.ciudades || []).filter(x => x.civ === c.id).map(x => x.region); return { cap: l.filter(a => a.h === c.capital).length, prov: cs.reduce((k, r) => k + l.filter(a => a.h === r).length, 0) / cs.length }; });
  const capMedia = prov.reduce((k, x) => k + x.cap, 0) / prov.length, provMedia = prov.reduce((k, x) => k + x.prov, 0) / prov.length;
  comprobar(provMedia >= capMedia * 0.2, 'las provincias también tienen gente: no se queda todo en la capital (capital ' + Math.round(capMedia) + ', provincia ' + Math.round(provMedia) + ' de media)');
  comprobar(Object.keys(n.vida.sede || {}).length > 0, 'con la ciudad llena, sus obras públicas se levantan en las tierras de al lado (' + Object.keys(n.vida.sede || {}).length + ')');
  // EL BANCO CENTRAL (del reino) Y LOS BANCOS PRIVADOS (de cada banquero, con su edificio).
  const O = V.OBRA, edif = Object.keys(n.vida.edificios || {}).map(Number);
  const central = edif.find(t => n.vida.obra[t] === O.banco), privados = edif.filter(t => n.vida.obra[t] === O.bancopriv);
  comprobar(central != null && /^Banco central de /.test(n.vida.edificios[central].nombre), 'el banco del reino es el banco central (' + (central != null ? n.vida.edificios[central].nombre : 'ninguno') + ')');
  const bq = S.vivas(n).flatMap(c => V.banquerosDe(n, c)), conSede = bq.filter(a => a.emp.sede != null && n.vida.obra[a.emp.sede] === O.bancopriv);
  comprobar(privados.length > 0 && conSede.length >= bq.length * 0.6 && conSede.every(a => /^Banco /.test((n.vida.edificios[a.emp.sede] || {}).nombre || '') && !/central/.test(n.vida.edificios[a.emp.sede].nombre)), 'cada banquero levanta su propio banco, con su nombre (' + conSede.length + ' de ' + bq.length + ': ' + (conSede[0] ? n.vida.edificios[conSede[0].emp.sede].nombre : '-') + ')');
  const sucNombre = Object.keys(n.vida.privados || {}).filter(t => n.vida.privados[t].sucursal && n.vida.obra[t] === V.OBRA.gremio).map(t => (n.vida.edificios[t] || {}).nombre);
  comprobar(!sucNombre.length || sucNombre.every(x => / \(sucursal\)$/.test(x || '')), 'el letrero de la sucursal lo dice (' + (sucNombre[0] || 'aún sin terminar') + ')');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
