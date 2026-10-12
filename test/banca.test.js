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
c.plan.comercioLibre = true; // (un reino que comercia: sin comercio exterior, sus negocios ganan menos y tardan más)
c.era = 6; c.nivel = 4; c.nivelMax = 4; c.madera = c.piedra = 300; c.oro = 300;
const zona = [c.capital, ...S.vecinos(c.capital)].flatMap(r => V.parcelas(m, r));
V.encargar(m, c, zona.find(t => !V.puedeColocar(m, c, t, 'banco')), 'banco');
const sostener = () => { c.era = Math.max(c.era, 6); c.oro = Math.max(c.oro, 120); c.madera = Math.max(c.madera, 100); c.piedra = Math.max(c.piedra, 100); };
const avisos = [];
const turno = () => { const n0 = (v.anuncios || []).length; S.turno(m); avisos.push(...(v.anuncios || []).slice(n0).filter(x => x.civ === c.id && /🏦/.test(x.texto)).map(x => x.texto)); };
for (let k = 0; k < 160 && !(c.bancos > 0 && c.banca); k++) { sostener(); turno(); } // (el banco central pide ser villa: depende de lo que crezca el pueblo)

console.log('LOS GREMIOS (Edad Media)');
{
  // (Si en una partida los comerciantes mueren de viejos antes de ahorrar, se mira otra: es cuestión de suerte.)
  const probar = sd => {
    const g = S.crear(sd, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(g);
    const r = S.vivas(g)[0], w = g.vida; X.gobernar(g, r.id); g.modo = 'pueblo';
    r.nivel = 4; r.nivelMax = 4; r.madera = r.piedra = 300; r.oro = 300;
    r.plan.comercioLibre = true; // (con socios: sin comercio exterior, los mercaderes ganan menos y tardan en hacerse ricos)
    for (const o of S.vivas(g)) if (o !== r && !S.enGuerra(r, o)) X.ordenar(g, r.id, 'abrid una ruta comercial con ' + o.nombre);
    X.ordenar(g, r.id, 'quiero 4 comerciantes');
    const av = []; let gremio = null, casona = null, conSueldo = false;
    for (let k = 0; k < 220 && !(gremio != null && casona != null && conSueldo); k++) {
      r.era = Math.max(r.era, 4); r.oro = Math.max(r.oro, 100); r.madera = Math.max(r.madera, 100); r.piedra = Math.max(r.piedra, 100);
      const n0 = (w.anuncios || []).length; S.turno(g);
      av.push(...(w.anuncios || []).slice(n0).filter(x => x.civ === r.id).map(x => x.texto));
      for (const t of Object.keys(w.privados || {})) { if (w.obra[t] === V.OBRA.gremio && gremio == null) gremio = +t; if (w.obra[t] === V.OBRA.casona && casona == null) casona = +t; }
      if (w.aldeanos.some(a => a.gremio != null && a.o === 5 && V.mercaderesDe(g, r).some(x => x.id === a.gremio))) conSueldo = true;
    }
    return { g, r, w, av, gremio, casona, conSueldo, sd };
  };
  let p = null;
  for (const sd of [7, 11, 3]) { p = probar(sd); if (p.gremio != null && p.casona != null && p.conSueldo) break; }
  const { g, r, w, av, gremio, casona, conSueldo } = p; let oroDeObras = 0;
  for (const x of av) { const q = x.match(/paga (\d+) de oro al reino/); if (q) oroDeObras += +q[1]; }
  comprobar(av.some(x => /funda un gremio de mercaderes/.test(x)) && gremio != null && /^Gremio de mercaderes /.test((w.edificios[gremio] || {}).nombre || ''), 'un comerciante que ahorró funda un gremio con su dinero (' + ((w.edificios[gremio] || {}).nombre || 'ninguno') + ', semilla ' + p.sd + ')');
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
const eranGremio = new Set();
const garantias = [];
// (Hasta que haya banquero, fábrica y un primer préstamo: la fábrica puede montarla antes un rico con su dinero.)
for (let k = 0; k < 320 && !(fabrica != null && V.banquerosDe(m, c).length && avisos.some(x => /El banco de .* presta \d+ de oro a/.test(x))); k++) {
  for (const t of V.gremiosDe(m, c)) eranGremio.add(t);
  const antes = new Map(v.aldeanos.filter(x => x.c === c.id && !x.emp).map(x => [x, x.dinero || 0]));
  sostener(); turno();
  for (const [x, d] of antes) if (x.emp && x.emp.neg !== 'banco' && x.emp.desde >= m.turno - 1 && !garantias.some(g => g[0] === x)) garantias.push([x, d, x.emp.monto]);
  const emp = V.empresariosDe(m, c);
  bancos = Math.max(bancos, V.banquerosDe(m, c).length);
  if (emp.some(a => a.emp.neg !== 'banco' && a.emp.banquero == null && !V.banquerosDe(m, c).length && m.turno - a.emp.desde < 2)) sinBanquero = true;
  const t = Object.keys(v.privados || {}).find(t => v.privados[t].civ === c.id && v.obra[t] === V.OBRA.fabrica);
  if (t != null && fabrica == null) fabrica = +t;
}
comprobar(garantias.length > 0 && garantias.every(([x, d, monto]) => d >= monto * 0.25 - 0.01), 'el banquero solo presta a quien tiene ahorrada la cuarta parte (' + garantias.map(([x, d, monto]) => Math.round(d) + '/' + monto).join(', ') + ')');
const primeroBanco = avisos.findIndex(x => /se convierte en su banco/.test(x)), primerPrestamo = avisos.findIndex(x => /presta \d+ de oro a/.test(x));
const ban0 = V.banquerosDe(m, c)[0];
comprobar(bancos > 0 && primeroBanco >= 0 && ban0 && eranGremio.has(ban0.emp.sede) && v.obra[ban0.emp.sede] === V.OBRA.bancopriv, 'en la industrialización, el mercader con gremio y dinero pide un préstamo al central y su gremio se convierte en su banco (' + (avisos[primeroBanco] || 'ninguno').slice(0, 150) + ')');
comprobar(!sinBanquero && (primerPrestamo < 0 || primeroBanco < primerPrestamo), 'el banco central no presta a particulares: los préstamos a la gente llegan después, de los banqueros');
comprobar(primerPrestamo >= 0 && avisos.some(x => /El banco de .* presta \d+ de oro a/.test(x)), 'los banqueros prestan de lo suyo a vecinos que montan negocios (' + avisos.filter(x => /El banco de .* presta/.test(x)).length + ' préstamos)');
comprobar(fabrica != null && /^(Textil|Aserradero|Fundición|Conservera) /.test((v.edificios[fabrica] || {}).nombre || ''), 'un empresario levanta su fábrica, de una industria, con el nombre de su familia (' + ((v.edificios[fabrica] || {}).nombre || 'ninguna') + ')');
{
  // LOS CAPITALISTAS: su fábrica contrata obreros a sueldo, compra la materia prima al reino y vende lo que hace.
  const pv = v.privados[fabrica], due = v.aldeanos.find(x => x.id === pv.dueno), e = due && due.emp;
  const tesoro0 = c.oro;
  let obrerosMax = 0, sueldos = 0, movidos = 0, contados = true;
  for (let k = 0; k < 40; k++) {
    sostener(); c.madera = Math.max(c.madera, 200); c.metal = Math.max(c.metal || 0, 80); c.comida = Math.max(c.comida, 400);
    const obr = v.aldeanos.filter(x => x.obrero === fabrica), din = new Map(obr.map(x => [x, x.dinero || 0])), oficio = new Map(obr.map(x => [x, x.o]));
    turno();
    for (const [x, d] of din) if (v.aldeanos.includes(x) && x.obrero === fabrica) { sueldos += (x.dinero || 0) - d; if (x.o !== oficio.get(x)) movidos++; }
    obrerosMax = Math.max(obrerosMax, v.aldeanos.filter(x => x.obrero === fabrica).length);
    const n = X.cuentaOficios(m, c), adultos = v.aldeanos.filter(x => x.c === c.id && x.edad >= V.ADULTO && x.colono == null).length, enFab = v.aldeanos.filter(x => x.c === c.id && x.obrero != null && x.edad >= V.ADULTO).length;
    if (n.reduce((p, q) => p + q, 0) > adultos - enFab) contados = false;
  }
  const e2 = (v.aldeanos.find(x => x.id === pv.dueno) || {}).emp || e;
  comprobar(e2 && V.INDUSTRIAS[e2.ind] && obrerosMax >= 1, 'la fábrica es de una industria (' + (e2 && e2.ind) + ') y contrata obreros (hasta ' + obrerosMax + ')');
  comprobar(sueldos > 0, 'los obreros cobran su sueldo de la caja del patrón (' + Math.round(sueldos * 10) / 10 + ' de oro en 40 turnos)');
  comprobar(e2 && e2.hecho > 0 && e2.vendido > 0, 'produce y vende (' + (e2 && e2.hecho) + ' hechos, ' + (e2 && e2.vendido) + ' vendidos dentro, ' + (e2 && (e2.exportado || 0)) + ' fuera)');
  comprobar(movidos === 0 && contados, 'el gobernador no mueve a los obreros, y no cuentan en su antiguo oficio («¿qué hace mi gente?» los cuenta aparte)');
  const ahora = v.aldeanos.filter(x => x.c === c.id && x.obrero != null && x.edad >= V.ADULTO).length, resp = X.ordenar(m, c.id, '¿qué hace mi gente?').respuesta;
  comprobar(ahora === 0 ? !/fábricas privadas/.test(resp) : new RegExp(ahora + ' obreros? en las fábricas privadas').test(resp), '«¿qué hace mi gente?» dice cuántos trabajan en las fábricas privadas (' + ahora + ': «' + (resp.match(/\d+ obreros? en las fábricas privadas/) || ['ninguno'])[0] + '»)');
}
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
  // (De la comida, siempre queda en el granero la que necesita la gente: eso no se gasta en la edad.)
  const reserva = Math.max(4, (c2.habitantes || 0) * 0.8);
  for (const k of ks) c2[k] = Math.ceil(req[k] / 3) + (k === 'comida' ? reserva : 0);
  const era0 = c2.era;
  comprobar(!ks.some(k => S.puedeSubir(e, c2).falta.some(f => f.includes(' de ' + k))), 'para empezar basta con la cuarta parte de cada cosa');
  S.empezarSubida(e, c2);
  comprobar(c2.subiendo && c2.subiendo.debe && ks.every(k => Math.round(c2.subiendo.debe[k]) === req[k] - Math.ceil(req[k] * 0.25)), 'sin todo, paga la cuarta parte y apunta lo que falta');
  for (const k of ks) c2[k] = 0;
  const hasta0 = c2.subiendo.hasta;
  for (let k = 0; k < 6; k++) { for (const x of ks) c2[x] = 0; S.turno(e); }
  comprobar(c2.era === era0 && c2.subiendo && c2.subiendo.hasta > hasta0, 'sin material, el paso espera (no avanza de edad)');
  for (let k = 0; k < 12 && c2.era === era0; k++) { for (const x of ks) c2[x] = Math.max(c2[x] || 0, req[x]); S.turno(e); }
  comprobar(c2.era === era0 + 1, 'con material, termina de pagar y pasa de edad');
  // La comida que necesita la gente no se gasta en la edad: con el granero justo, el paso no empieza (ni lo aconseja el consejero).
  const c3 = S.vivas(e).find(x => x !== c1 && x !== c2 && !x.subiendo && M.EDADES[x.era + 1]), req3 = c3 && M.EDADES[c3.era + 1];
  if (c3 && req3.comida) {
    for (const k of ['madera', 'piedra', 'oro', 'metal']) if (req3[k]) c3[k] = req3[k] * 2;
    c3.comida = Math.max(4, (c3.habitantes || 0) * 0.8);
    const f = S.puedeSubir(e, c3).falta;
    comprobar(f.some(x => /de comida \(sin tocar la que necesita la gente\)/.test(x)), 'pagar la edad no deja a la gente sin comer: «' + f.filter(x => /comida/.test(x)).join(', ') + '»');
  } else comprobar(false, 'hace falta un tercer reino para probar la reserva de comida');
}

console.log('EL GREMIO SE CONVIERTE EN BANCO: CON LA INDUSTRIALIZACIÓN, DINERO Y UN PRÉSTAMO');
{
  // Un reino con banco central y un mercader con su gremio (puesto a mano: aquí solo se prueba la regla).
  const prep = (era, caja, fondo) => {
    const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 40; k++) S.turno(g);
    const r = S.vivas(g)[0], w = g.vida; X.gobernar(g, r.id);
    r.era = era; r.nivel = 4; r.nivelMax = 4; r.bancos = 1; r.banca = { fondo, prestado: 0, devuelto: 0, quiebras: 0, perdido: 0, abierto: g.turno };
    const zona = [r.capital, ...S.vecinos(r.capital)].flatMap(q => V.parcelas(g, q));
    const t = zona.find(x => !w.obra[x] && !V.puedeColocar(g, r, x, 'casa'));
    V.cambiar(g, 'obra', t, V.OBRA.gremio, 0);
    V.cambiar(g, 'obra', zona.find(x => x !== t && !w.obra[x] && !V.puedeColocar(g, r, x, 'casa')), V.OBRA.banco, 0); V.contar(g);
    const mer = w.aldeanos.find(x => x.c === r.id && x.edad >= 3 && x.edad < 14 && !x.fijo);
    mer.merc = { t, caja, desde: g.turno }; (w.privados = w.privados || {})[t] = { dueno: mer.id, civ: r.id, tipo: 'gremio' };
    const obrero = w.aldeanos.find(x => x.c === r.id && x !== mer && x.edad >= 3 && !x.merc); obrero.o = 5; obrero.gremio = mer.id;
    const av = [];
    for (let k = 0; k < 9; k++) { r.era = era; if (mer.merc && !mer.emp) mer.merc.caja = Math.max(mer.merc.caja, caja); const n0 = (w.anuncios || []).length; S.turno(g); av.push(...(w.anuncios || []).slice(n0).filter(x => x.civ === r.id).map(x => x.texto)); if (mer.emp) break; }
    return { g, r, w, t, mer, obrero, av };
  };
  const p5 = prep(5, 200, 200);
  comprobar(!p5.mer.emp && p5.w.obra[p5.t] === V.OBRA.gremio, 'en el Renacimiento aún no: el gremio sigue siendo gremio aunque haya dinero y banco central');
  const pobre = prep(6, 5, 200);
  comprobar(!pobre.mer.emp && pobre.w.obra[pobre.t] === V.OBRA.gremio, 'en la industrialización, sin dinero propio no hay banco: hace falta tener fortuna');
  const sinFondos = prep(6, 200, 0);
  comprobar(!sinFondos.mer.emp && sinFondos.w.obra[sinFondos.t] === V.OBRA.gremio && sinFondos.av.some(x => /pide \d+ de oro al banco central, pero no tiene fondos/.test(x)), 'con dinero pero sin fondos en el banco central, espera y lo avisa («' + (sinFondos.av.find(x => /no tiene fondos/.test(x)) || '').slice(0, 110) + '…»)');
  const ok = prep(6, 200, 200);
  // (Si el mercader muere en estos turnos, el banco lo hereda su familia: se mira al dueño del edificio.)
  const dueno = ok.w.privados && ok.w.privados[ok.t] && ok.w.aldeanos.find(a => a.id === ok.w.privados[ok.t].dueno);
  if (dueno) ok.mer = dueno;
  comprobar(ok.mer.emp && ok.mer.emp.neg === 'banco' && ok.mer.emp.deuda > 0 && ok.mer.emp.sede === ok.t && ok.w.obra[ok.t] === V.OBRA.bancopriv && /^Banco /.test((ok.w.edificios[ok.t] || {}).nombre || ''), 'con dinero y préstamo, su gremio se convierte en su banco, en el mismo sitio (' + ((ok.w.edificios[ok.t] || {}).nombre || '-') + ', debe ' + (ok.mer.emp && ok.mer.emp.deuda) + ' al central)');
  comprobar(!ok.w.aldeanos.some(x => x.gremio != null && x.gremio === ok.mer.id) && (!ok.w.aldeanos.includes(ok.obrero) || ok.obrero.gremio == null) && ok.av.some(x => /se convierte en su banco/.test(x)) && ok.g.cronica.some(x => /^Nace el Banco/.test(x.titulo)), 'los comerciantes del gremio quedan libres, se avisa y lo cuenta la crónica');
}

console.log('LOS EDIFICIOS DE LOS MERCADERES CAMBIAN CON LAS ERAS (LOS REFORMAN LOS CONSTRUCTORES)');
{
  // Un gremio y un muelle de la Edad Media en un reino que llega a la Revolución Industrial (sin banco central: el gremio no
  // se convierte en banco, así que pasa a compañía).
  // (Un reino ya crecido, con varios constructores: en una aldea pequeña, la reforma espera a que acaben lo urgente.)
  // (Con la era forzada, cada turno son muchos años: si el dueño muere antes de la reforma, otro mercader se queda el
  // gremio, como haría su heredero; si no, la prueba dependería de cuánto vive una persona.)
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 150; k++) S.turno(g);
  const r = S.vivas(g).sort((p, q) => q.aldeanos - p.aldeanos)[0], w = g.vida; X.gobernar(g, r.id);
  const zona = [r.capital, ...S.vecinos(r.capital)].flatMap(q => V.parcelas(g, q));
  const tg = zona.find(x => !w.obra[x] && !V.puedeColocar(g, r, x, 'casa'));
  r.era = 4; V.cambiar(g, 'obra', tg, V.OBRA.gremio, 0);
  const mer = w.aldeanos.filter(x => x.c === r.id && x.edad >= 3 && x.edad < 12 && !x.fijo).sort((p, q) => p.edad - q.edad)[0];
  mer.merc = { t: tg, caja: 0, desde: g.turno }; (w.privados = w.privados || {})[tg] = { dueno: mer.id, civ: r.id, tipo: 'gremio' };
  w.edificios[tg].era = 4;
  comprobar(V.etapa(V.OBRA.gremio, 4) === 0 && V.etapa(V.OBRA.gremio, 6) === 1 && V.etapa(V.OBRA.gremio, 7) === 2 && V.etapa(V.OBRA.muelle, 5) === 1 && V.etapa(V.OBRA.muelle, 7) === 3 && V.etapa(V.OBRA.casona, 6) === 2, 'cada edificio tiene sus etapas: gremio → compañía (Revolución Industrial) → oficinas; muelle → piedra → dársena → terminal; casona → palacete → mansión');
  const av = []; let nombre = '';
  for (let k = 0; k < 250; k++) { r.era = 6; r.madera = Math.max(r.madera, 60); r.piedra = Math.max(r.piedra, 60); const n0 = (w.anuncios || []).length; S.turno(g); av.push(...(w.anuncios || []).slice(n0).filter(x => x.civ === r.id).map(x => x.texto)); const due = w.privados[tg] && w.aldeanos.find(a => a.id === w.privados[tg].dueno); nombre = (w.edificios[tg] || {}).nombre || ''; if (/^Compañía /.test(nombre)) break; if (!due) { const otro = w.aldeanos.find(x => x.c === r.id && x.edad >= 3 && x.edad < 10 && !x.fijo && !x.emp && !x.merc); if (!otro) break; otro.merc = { t: tg, caja: 0, desde: g.turno }; w.privados[tg] = { dueno: otro.id, civ: r.id, tipo: 'gremio' }; } }
  comprobar(/^Compañía /.test(nombre) && w.obra[tg] === V.OBRA.gremio, 'en la industrialización, los constructores reforman el gremio y pasa a ser una compañía (' + nombre + ')');
  comprobar(av.some(x => /se moderniza: ahora es la Compañía/.test(x)) && g.cronica.some(x => /^El fin del gremio/.test(x.titulo)), 'se avisa y la crónica cuenta el fin del gremio');
  comprobar(w.edificios[tg] && w.edificios[tg].era >= 6, 'y se dibuja con su estilo nuevo (la reforma guarda la era: ' + (w.edificios[tg] && w.edificios[tg].era) + ')');
}

console.log('LA COMPAÑÍA MINERA Y EL COMERCIO ENTRE LAS INDUSTRIAS DE DOS REINOS SOCIOS');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(g);
  const [r, o] = S.vivas(g), w = g.vida; X.gobernar(g, r.id); X.ordenar(g, r.id, 'abrid una ruta comercial con ' + o.nombre);
  r.era = o.era = 6;
  comprobar(V.comercian(g, r, o), 'los dos reinos comercian (ruta abierta)');
  // Una compañía minera en el reino socio, con metal en su almacén.
  const ter = V.terrenos(g), tm = S.casillas(g, o).flatMap(q => V.parcelas(g, q)).find(t => ter[t] === 'montana' && !w.obra[t]) ?? S.casillas(g, o).flatMap(q => V.parcelas(g, q)).find(t => !w.obra[t]);
  V.cambiar(g, 'obra', tm, V.OBRA.minapriv, 0);
  const minero = w.aldeanos.find(x => x.c === o.id && x.edad >= V.ADULTO && !x.emp);
  minero.emp = { neg: 'fabrica', ind: 'minera', t: tm, caja: 0, deuda: 0, stocks: { metal: 10, piedra: 0, carbon: 0 } }; (w.privados = w.privados || {})[tm] = { dueno: minero.id, civ: o.id, tipo: 'fabrica', ind: 'minera' };
  // A la fundición de tu reino le falta metal: tu reino no tiene, así que lo compra a la minera del socio.
  r.metal = 0; o.metal = 0; const caja0 = minero.emp.caja;
  const c1 = V.comprarInsumo(g, r, 'metal', 4, [o]);
  comprobar(c1.q === 4 && c1.fuera === 4 && minero.emp.caja > caja0 && minero.emp.stocks.metal === 6, 'si a tu fábrica le falta metal y tu reino no tiene, lo compra a la compañía minera del socio (4 de metal, la minera cobra ' + Math.round(minero.emp.caja - caja0) + ')');
  // Y si la minera ya no tiene, al almacén del socio, que cobra (un poco más caro, por el transporte).
  minero.emp.stocks.metal = 0; o.metal = 200; const oro0 = o.oro;
  const c2 = V.comprarInsumo(g, r, 'metal', 3, [o]);
  comprobar(c2.q === 3 && o.oro > oro0 && o.metal < 200, 'o al almacén del reino socio, que cobra el metal (' + Math.round(o.oro - oro0) + ' de oro)');
  // Al revés también: las fábricas del socio compran a tu reino lo que te sobra.
  r.metal = 300; const oroYo = r.oro; o.metal = 0;
  const c3 = V.comprarInsumo(g, o, 'metal', 3, [r]);
  comprobar(c3.q === 3 && r.oro > oroYo, 'y al revés: las fábricas del socio compran a tu reino lo que le sobra (y tu tesoro cobra ' + Math.round(r.oro - oroYo) + ')');
  // Sin ruta (o en guerra), no hay comercio entre sus industrias.
  X.ordenar(g, r.id, 'cerrad el comercio con ' + o.nombre); r.metal = 0; o.metal = 200;
  comprobar(!V.sociosDe(g, r).includes(o), 'sin ruta, el socio no aparece: sus industrias no comercian con las tuyas');
  comprobar(V.INDUSTRIAS.minera && V.INDUSTRIAS.minera.saca && V.OBRA.minapriv, 'la compañía minera saca metal, piedra y carbón de su mina (sin comprar materia prima)');
}

console.log('LA COMPAÑÍA DE FERROCARRIL Y LA FUNDICIÓN QUE HACE TANQUES Y AVIONES');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 60; k++) S.turno(g);
  const r = S.vivas(g).sort((p, q) => q.aldeanos - p.aldeanos)[0], w = g.vida, O = V.OBRA; X.gobernar(g, r.id);
  r.era = 6; r.rutas = 2; r.oro = 300; r.carbon = 100; r.metal = 100; r.petroleo = 60; r.vehiculos = 0; r.aviones = 0; r.paradas = {};
  const gente = w.aldeanos.filter(a => a.c === r.id && a.edad >= V.ADULTO && a.edad < V.VIEJO - 4 && !a.emp && !a.merc && a.obrero == null && a.o !== 5);
  for (const a of gente) a.dinero = 6;
  const libres = S.casillas(g, r).flatMap(q => V.parcelas(g, q)).filter(t => !w.obra[t]);
  // Una compañía de ferrocarril con su estación y dos ferroviarios.
  const [tf, tu] = libres, dueno = gente[0], dueno2 = gente[1];
  V.cambiar(g, 'obra', tf, O.estacion, 0); (w.privados = w.privados || {})[tf] = { dueno: dueno.id, civ: r.id, tipo: 'fabrica', ind: 'ferrocarril' };
  dueno.emp = { neg: 'fabrica', ind: 'ferrocarril', t: tf, caja: 10, deuda: 0, monto: 0, cuota: 0, desde: g.turno, atraso: 0, propio: true };
  for (const a of gente.slice(2, 4)) a.obrero = tf;
  // Una fundición con tres obreros, ya en la II Guerra Mundial y con aeródromo.
  V.cambiar(g, 'obra', tu, O.fabrica, 0); w.privados[tu] = { dueno: dueno2.id, civ: r.id, tipo: 'fabrica', ind: 'fundicion' };
  dueno2.emp = { neg: 'fabrica', ind: 'fundicion', t: tu, caja: 20, deuda: 0, monto: 0, cuota: 0, desde: g.turno, atraso: 0, propio: true };
  for (const a of gente.slice(4, 7)) a.obrero = tu;
  const caja0 = dueno.emp.caja, oro0 = r.oro;
  for (let k = 0; k < 30; k++) { g.turno++; r.era = k < 12 ? 6 : 8; r.aldeanos = 90; if (k === 12) r.vehiculos = r.aviones = 0; r.aerodromos = 1; r.paradas = {}; r.metal = Math.max(r.metal, 60); r.petroleo = Math.max(r.petroleo, 30); r.oro = Math.max(r.oro, 200); V.banca(g, r); }
  const e = dueno.emp;
  comprobar(e.viajeros > 0 && e.fletes > 0, 'la compañía de ferrocarril cobra billetes a la gente y fletes por el comercio (' + Math.round(e.viajeros) + ' en billetes, ' + Math.round(e.fletes) + ' en fletes)');
  comprobar(e.caja > caja0, 'y gana dinero aun pagando sueldos y el carbón (caja ' + caja0 + ' → ' + Math.round(e.caja) + ')');
  const f = dueno2.emp.maquinas || {};
  comprobar((f.canon || 0) + (f.artilleria || 0) > 0, 'la fundición hace cañones y artillería para el ejército antes de la II Guerra Mundial (' + JSON.stringify(f) + ')');
  comprobar(f.tanque > 0 && f.avion > 0 && r.aviones >= 1, 'y en la II Guerra Mundial, tanques y aviones (' + (f.tanque || 0) + ' tanques, ' + (f.avion || 0) + ' aviones; el reino tiene ' + r.aviones + ' aviones y ' + Math.round(r.vehiculos) + ' máquinas)');
  comprobar(r.vehiculos <= 2 + 8 - 5 + 1, 'solo hace las que su reino necesita, sin amontonarlas (' + Math.round(r.vehiculos) + ')');
}

console.log('LA INMOBILIARIA: CONSTRUYE LO QUE EL PUEBLO NECESITA Y CASAS DE ALQUILER');
{
  const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 120; k++) S.turno(g);
  const r = S.vivas(g).sort((p, q) => q.aldeanos - p.aldeanos)[0], w = g.vida, O = V.OBRA; X.gobernar(g, r.id);
  r.era = 7; r.oro = 400; r.madera = r.piedra = 200; r.paradas = {};
  const gente = w.aldeanos.filter(a => a.c === r.id && a.edad >= V.ADULTO && a.edad < V.VIEJO - 4 && !a.emp && !a.merc && a.obrero == null && a.o !== 5);
  for (const a of gente) a.dinero = 8;
  const zona = [r.capital, ...S.vecinos(r.capital)].flatMap(q => V.parcelas(g, q)).filter(t => !w.obra[t]);
  const ti = zona[zona.length - 1], dueno = gente[0];
  V.cambiar(g, 'obra', ti, O.inmopriv, 0); (w.privados = w.privados || {})[ti] = { dueno: dueno.id, civ: r.id, tipo: 'fabrica', ind: 'inmobiliaria' };
  dueno.emp = { neg: 'fabrica', ind: 'inmobiliaria', t: ti, caja: 30, deuda: 0, monto: 0, cuota: 0, desde: g.turno, atraso: 0, propio: true };
  for (const a of gente.slice(1, 4)) a.obrero = ti;
  // La capital pide un pozo y el tesoro puede pagarlo.
  let entregado = null;
  for (let k = 0; k < 40 && !entregado; k++) {
    g.turno++; r.era = 7; r.paradas = {}; r.necesidades = [{ obra: 'pozo', falta: true, region: r.capital }];
    V.banca(g, r);
    const t = Object.keys(w.sede || {}).find(t => w.obra[t] === O.pozo && w.sede[t] === r.capital); if (t && (dueno.emp.publicas || 0) > 0) entregado = +t;
  }
  const aviso = (w.anuncios || []).map(x => x.texto).find(x => /entrega un pozo al reino \(cobra \d+/.test(x));
  comprobar(entregado != null && aviso, 'levanta el pozo que pide la capital, se lo cobra al tesoro y cuenta como de esa ciudad («' + (aviso || '').slice(2) + '»)');
  // Luego, casas donde faltan camas: la gente le paga alquiler.
  r.necesidades = []; let casa = false;
  for (let k = 0; k < 40; k++) { g.turno++; r.era = 7; r.paradas = {}; r.necesidades = []; r.sinCama = 4; V.banca(g, r); if ((dueno.emp.alquileres || 0) > 0) { casa = true; break; } }
  comprobar(casa && (dueno.emp.hechas || 0) >= 1 && Object.values(w.alquiler || {}).includes(ti), 'y donde faltan camas levanta casas suyas, por las que la gente le paga alquiler (' + (dueno.emp.hechas || 0) + ' casas, ' + (dueno.emp.alquileres || 0).toFixed(2) + ' cobrado)');
  comprobar(V.INDUSTRIAS.inmobiliaria && V.OBRA.inmopriv && V.ERA_OBRA[V.OBRA.inmopriv] === 7, 'la inmobiliaria llega con la Era Moderna, con su oficina');
}

console.log('EL SUELDO DE LA GENTE, EL AHORRO Y QUIÉN PUEDE SER CAPITALISTA');
{
  // Dos copias del mismo reino en la Edad Media: una con impuestos normales y otra con impuestos altos.
  const prep = imp => { const g = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 120; k++) S.turno(g); const r = S.vivas(g).sort((p, q) => q.aldeanos - p.aldeanos)[0]; X.gobernar(g, r.id); r.plan.impuesto = imp; return { g, r }; };
  // (Se mide turno a turno, con quien sigue vivo: con la era forzada cada turno son muchos años y la gente envejece deprisa.
  // Y solo el sueldo: se les deja sin dinero antes del turno, así no gastan y lo que se ve es lo que cobran.)
  const mide = ({ g, r }) => { let suma = 0, n = 0; for (let k = 0; k < 20; k++) { r.era = Math.max(r.era, 4); const gente = g.vida.aldeanos.filter(a => a.c === r.id && a.edad >= V.ADULTO && a.o !== 5 && !a.merc && !a.emp && a.obrero == null); for (const a of gente) a.dinero = 0; const d0 = new Map(gente.map(a => [a, 0])); S.turno(g); for (const a of gente) if (g.vida.aldeanos.includes(a) && a.c === r.id) { suma += (a.dinero || 0) - d0.get(a); n++; } } return suma / Math.max(1, n) * 20; };
  const normal = mide(prep(1)), altos = mide(prep(2));
  comprobar(normal > 0.5, 'desde la Edad Media, granjeros, leñadores, mineros, constructores, soldados y eruditos cobran un sueldo de lo que producen (' + normal.toFixed(2) + ' de oro cada uno en 20 turnos)');
  comprobar(altos < normal * 0.85, 'con impuestos altos, la gente cobra menos (' + altos.toFixed(2) + ' frente a ' + normal.toFixed(2) + ')');
  // Unos gastan casi todo y otros ahorran: con el tiempo, los ahorradores juntan bastante.
  const { g, r } = prep(1); for (let k = 0; k < 150; k++) { r.era = Math.max(r.era, 4); S.turno(g); }
  const din = g.vida.aldeanos.filter(a => a.c === r.id && a.edad >= V.ADULTO && !a.merc && !a.emp).map(a => a.dinero || 0).sort((p, q) => p - q);
  comprobar(din[din.length - 1] > 11 && din[din.length >> 1] < din[din.length - 1] / 3, 'cada uno gasta según su carácter: unos ahorran mucho y la mayoría poco (mediana ' + (din[din.length >> 1] || 0).toFixed(1) + ', el que más ' + (din[din.length - 1] || 0).toFixed(1) + ')');
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
  // (Y se mira cada turno que nadie abra un negocio nuevo si el reino ya pasa del 4 % de capitalistas. Dentro del turno
  // los adultos cambian (niños que crecen, gente que muere), así que se mide con el mayor de los dos topes; y el primer
  // banco del reino siempre puede abrir.)
  let sobreTope = 0, abiertos = 0;
  for (let k = 0; k < 220; k++) {
    const antes = new Map(S.vivas(n).map(c => { const ad = n.vida.aldeanos.filter(a => a.c === c.id && a.edad >= V.ADULTO).length; return [c.id, { tope: Math.max(1, Math.floor(ad * 0.04)), ya: n.vida.aldeanos.filter(a => a.c === c.id && a.emp).length }]; }));
    const n0 = (n.vida.anuncios || []).length; S.turno(n); avisos2.push(...(n.vida.anuncios || []).slice(n0).map(x => x.texto));
    for (const a of n.vida.aldeanos) if (a.emp && a.emp.desde === n.turno && antes.has(a.c)) { abiertos++; const x = antes.get(a.c), ahora = Math.max(1, Math.floor(n.vida.aldeanos.filter(b => b.c === a.c && b.edad >= V.ADULTO).length * 0.04)); if (x.ya > Math.max(x.tope, ahora) && !(a.emp.neg === 'banco' && V.banquerosDe(n, S.civ(n, a.c)).length === 1)) sobreTope++; }
  }
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
  // LOS CAPITALISTAS: como mucho el 4 % de los adultos (y algo de holgura: los que heredan o la gente que muere).
  const topes = S.vivas(n).map(c => { const ad = n.vida.aldeanos.filter(a => a.c === c.id && a.edad >= V.ADULTO).length; return { emp: V.empresariosDe(n, c).filter(a => a.emp.neg !== 'banco').length, ban: V.banquerosDe(n, c).length, tope: Math.max(1, Math.floor(ad * 0.04)) }; });
  comprobar(abiertos > 0 && sobreTope === 0, 'nadie abre un negocio nuevo si ya hay un 4 % de capitalistas (' + abiertos + ' negocios abiertos, ' + sobreTope + ' pasado el tope; ahora ' + topes.map(x => (x.emp + x.ban) + '/' + x.tope).join(', ') + ', que puede pasarse si baja la población)');
  // EL QUE YA ES RICO monta su negocio con lo suyo: sin préstamo ni deuda (el préstamo es para los que no llegan).
  const propios = S.vivas(n).flatMap(c => n.vida.aldeanos.filter(a => a.c === c.id && a.emp && a.emp.propio));
  const montados = avisos2.filter(x => /con su propio dinero, sin préstamo/.test(x));
  comprobar(montados.length > 0, 'los vecinos ricos montan su fábrica o su mina con su dinero, sin préstamo (' + montados.length + ': «' + (montados[0] || '').slice(0, 90) + '»)');
  comprobar(propios.every(a => a.emp.banquero == null && !(a.emp.deuda > 0) && !(a.emp.monto > 0)), 'y no deben nada a ningún banco (' + propios.length + ' negocios propios ahora)');
  // LOS MUELLES PRIVADOS: uno por familia como mucho, con su barco mercante.
  const muelles = edif.filter(t => n.vida.obra[t] === O.muelle && n.vida.privados && n.vida.privados[t]);
  const porFam = {}; for (const t of muelles) { const d = n.vida.aldeanos.find(a => a.id === n.vida.privados[t].dueno); if (d) { const k = d.c + ':' + d.familia; porFam[k] = (porFam[k] || 0) + 1; } }
  comprobar(muelles.length > 0 && Object.values(porFam).every(k => k === 1), 'las casas comerciales levantan su muelle, uno por familia como mucho (' + muelles.length + ' muelles: ' + JSON.stringify(porFam) + ')');
  comprobar(muelles.every(t => n.vida.barcos.some(b => b.puerto === t && b.privado === n.vida.privados[t].dueno)), 'y cada muelle tiene su barco mercante');
  comprobar(muelles.every(t => /^(Muelle|Dársena|Terminal) de los /.test((n.vida.edificios[t] || {}).nombre || '')), 'que lleva el nombre de la familia (y cambia con las eras: muelle, dársena, terminal) (' + ((n.vida.edificios[muelles[0]] || {}).nombre || '-') + ')');
  const sucNombre = Object.keys(n.vida.privados || {}).filter(t => n.vida.privados[t].sucursal && n.vida.obra[t] === V.OBRA.gremio).map(t => (n.vida.edificios[t] || {}).nombre);
  comprobar(!sucNombre.length || sucNombre.every(x => / \(sucursal\)$/.test(x || '')), 'el letrero de la sucursal lo dice (' + (sucNombre[0] || 'aún sin terminar') + ')');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
