// Prueba de la diplomacia: relaciones con las potencias, sus intereses y sus consecuencias.
// node test/diplomacia.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = () => { const e = RF.consejero.nuevoEstado(); e.dilemas.ultimo = 999; return e; };
const decretar = (e, t) => RF.consejero.decretar(e, RF.interprete.interpretar(t, e));
const rel = (e, id) => RF.diplomacia.rel(e, id);
const sinHuecos = bl => bl.every(b => !/\{|\}|undefined|NaN|\[object/.test((b.titulo || '') + (b.texto || '')));

console.log('SE ENTIENDEN LOS DECRETOS DIPLOMÁTICOS');
for (const [t, pais, dir] of [['negociar con Estados Unidos', 'eeuu', 'amistad'], ['pedir ayuda a China', 'china', 'amistad'], ['visitar Seúl', 'surcorea', 'amistad'],
  ['insultar a Japón', 'japon', 'hostil'], ['amenazar a Washington', 'eeuu', 'hostil'], ['hacer las paces con Corea del Sur', 'surcorea', 'amistad']]) {
  const i = RF.interprete.interpretar(t, nuevo());
  comprobar(i.tipo === 'diplomacia' && i.pais === pais && i.dir === dir, '"' + t + '" → ' + i.pais + ' ' + i.dir);
}
for (const [t, tema] of [['declarar la guerra a Japón', 'GUERRA'], ['lanzar un misil a Japón', 'MISILES']]) {
  const i = RF.interprete.interpretar(t, nuevo());
  comprobar(i.tema === tema, '"' + t + '" sigue siendo ' + tema);
}
comprobar(RF.interprete.interpretar('prohibir las series del sur', nuevo()).tipo !== 'diplomacia', '"prohibir las series del sur" no es diplomacia');

console.log('GESTOS Y CONSECUENCIAS');
{
  const e = nuevo();
  const r0 = rel(e, 'eeuu'), c0 = rel(e, 'china'), ej0 = e.sectores.ejercito;
  const res = decretar(e, 'negociar con Estados Unidos');
  comprobar(rel(e, 'eeuu') > r0 && rel(e, 'china') < c0 + 1 && e.sectores.ejercito < ej0, 'acercarse a EE. UU. lo mejora, pone celosa a China y no gusta a los generales');
  const bl = RF.narrador.decreto(e, {}, res);
  comprobar(bl.some(b => b.tipo === 'exterior') && bl.some(b => b.tipo === 'gaceta' && /NOTA DIPLOMÁTICA/.test(b.titulo)) && sinHuecos(bl), 'se cuenta con nota diplomática y relaciones exteriores, sin huecos');
  const e2 = nuevo(); e2.diplomacia.relaciones.china = 90;
  const g = RF.diplomacia.gesto(e2, 'china', 'amistad');
  comprobar(g.relaciones.china < 12 && g.notas.length, 'con relaciones ya buenas, cada gesto rinde menos');
}
{
  const e = nuevo();
  const j0 = rel(e, 'japon');
  decretar(e, 'lanzar un misil a Japón');
  comprobar(j0 >= 15 && rel(e, 'japon') <= 3 && e.economia.sanciones >= 3, 'un misil apuntando a Japón enfada mucho a Japón y sube las sanciones');
}
{
  const e = nuevo();
  comprobar(e.diplomacia.arsenal === true, 'se empieza con el arsenal nuclear heredado');
  const res = decretar(e, 'desmantelar las armas nucleares');
  comprobar(!e.diplomacia.arsenal && e.economia.sanciones === 0 && rel(e, 'eeuu') >= 40 && !res.notas.some(n => /no tenía/.test(n)), 'desmantelarlo alivia sanciones y mejora la relación con EE. UU. (' + Math.round(rel(e, 'eeuu')) + ')');
}

console.log('CADA TURNO');
{
  const e = nuevo(); e.diplomacia.relaciones.china = 10;
  const res = RF.consejero.pasarTurno(e);
  comprobar(res.causas.some(c => /oleoducto/.test(c)) && res.exterior.inflacion > 0 && res.exterior.dinero < 0, 'con China enfadada, se corta el petróleo: suben los precios y bajan las divisas');
  const f = nuevo(); f.diplomacia.relaciones.china = 90;
  comprobar(RF.consejero.pasarTurno(f).exterior.dinero > 3, 'con China aliada, el comercio da divisas');
  const s = nuevo(); s.diplomacia.relaciones.surcorea = 70;
  comprobar(RF.consejero.pasarTurno(s).causas.some(c => /ayuda humanitaria/.test(c)), 'con buenas relaciones, el Sur manda ayuda');
  const u = nuevo(); u.diplomacia.relaciones.eeuu = 5;
  const r = Math.random; Math.random = () => 0; RF.consejero.pasarTurno(u); Math.random = r;
  comprobar(u.economia.sanciones === 3, 'con EE. UU. hostil, Washington puede endurecer las sanciones');
  const d = nuevo(); d.diplomacia.relaciones.eeuu = 90;
  RF.consejero.pasarTurno(d);
  comprobar(rel(d, 'eeuu') < 90, 'las relaciones vuelven poco a poco a su punto de partida');
}

console.log('EVENTOS');
{
  const e = nuevo(); e.dia = 6;
  RF.director.forzar(e, 'oferta_washington', {});
  const d = RF.director.pendiente(e);
  const tarjeta = RF.narrador.dilema(e, d);
  comprobar(sinHuecos([tarjeta]) && tarjeta.opciones[0].resumen.some(p => /Estados Unidos ▲/.test(p.texto)) && tarjeta.opciones[0].resumen.some(p => /Sanciones ▼/.test(p.texto)), 'la oferta de Washington enseña sus consecuencias diplomáticas');
  const r = RF.director.resolver(e, 0);
  comprobar(!e.diplomacia.arsenal && e.economia.sanciones === 0 && e.sectores.ejercito < 65 && r.relaciones.eeuu > 0, 'aceptarla: adiós arsenal y sanciones, los generales se enfadan');
  const bl = RF.narrador.decision(e, r);
  comprobar(bl.some(b => b.tipo === 'exterior') && sinHuecos(bl), 'la decisión muestra cómo cambian las relaciones');
  const f = nuevo(); f.dia = 6;
  RF.director.forzar(f, 'oferta_washington', {});
  RF.director.resolver(f, 1);
  const trampa = f.pendientes.find(p => p.titulo === 'Washington lo descubre');
  comprobar(f.diplomacia.arsenal && trampa && trampa.relaciones.eeuu < 0 && trampa.sanciones > 0, 'fingir que aceptas: sigues con el arsenal... y dentro de unos turnos te descubren');
  for (let k = 0; k < 5; k++) { f.dilemas.pendiente = null; RF.consejero.pasarTurno(f); }
  comprobar(f.economia.sanciones >= 3, 'cuando te descubren, las sanciones vuelven con fuerza (nivel ' + f.economia.sanciones + ')');
}
for (const id of ['presion_china', 'mano_seul', 'secuestrados_japon', 'cumbre_eeuu']) {
  const e = nuevo(); e.dia = 8;
  RF.director.forzar(e, id, {});
  const d = RF.director.pendiente(e);
  let ok = sinHuecos([RF.narrador.dilema(e, d)]);
  d.opciones.forEach((_, i) => { const x = JSON.parse(JSON.stringify(e)); RF.director.resolver(x, i); });
  const r = RF.director.resolver(e, 0);
  ok = ok && sinHuecos(RF.narrador.decision(e, r));
  comprobar(ok, 'el evento "' + d.titulo + '" funciona con todas sus opciones');
}
{
  const e = nuevo(); e.diplomacia.relaciones.china = 30; e.dia = 6;
  comprobar(RF.DILEMAS.find(d => d.id === 'presion_china').si(e), 'si China está molesta, puede presionar');
  e.diplomacia.relaciones.surcorea = 20;
  comprobar(!RF.DILEMAS.find(d => d.id === 'mano_seul').si(e), 'si el Sur está resentido, no tiende la mano');
}

console.log('CAMBIOS DE RÉGIMEN CON PADRINO');
{
  const e = nuevo(); const u0 = rel(e, 'eeuu');
  const r = decretar(e, 'instaurar la democracia con ayuda de Estados Unidos');
  const f = nuevo();
  decretar(f, 'restaurar la democracia');
  comprobar(e.politica.regimen === 'DEMOCRACIA' && r.relaciones.eeuu > 0 && rel(e, 'eeuu') > rel(f, 'eeuu') && rel(e, 'china') < rel(f, 'china'), '"con ayuda de Estados Unidos" cambia el régimen, y Washington lo agradece más (y Pekín menos)');
  const g = nuevo();
  decretar(g, 'proclamarme rey con el apoyo de China');
  comprobar(g.politica.regimen === 'MONARQUIA' && rel(g, 'china') > 58, 'proclamarse rey con el apoyo de China también funciona');
}

console.log('EL MOTOR ARBITRA LA IA');
{
  const e = nuevo();
  const res = RF.consejoIA.aplicar(e, { titulo: 'un regalo a Pekín', relaciones: { china: 80, eeuu: -3, marte: 10 }, arsenal: false });
  comprobar(res.relaciones.china === 25 && res.relaciones.eeuu === -3 && !e.diplomacia.relaciones.marte && !e.diplomacia.arsenal, 'la IA puede mover relaciones (con tope ±25) y el arsenal, pero no inventar países');
  comprobar(/diplomacia/.test(JSON.stringify(RF.consejoIA.contexto(e, 'x'))) && /DIPLOMACIA/.test(RF.consejoIA.SISTEMA), 'la IA recibe qué quiere y teme cada potencia');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
