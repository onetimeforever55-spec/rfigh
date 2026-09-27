// Escenarios concretos: leyes que se acumulan, dinero, inflación, estabilidad y felicidad.
// node test/sistemas.test.js
const RF = require('./cargar')();

let fallos = 0;
function comprobar(cond, texto) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + texto);
  if (!cond) fallos++;
}

function decretar(e, texto) {
  if (texto === 'esperar') return RF.consejero.pasarTurno(e);
  const lista = RF.interprete.interpretarVarios(texto, e).filter(i => i.estado === 'ok');
  let r = null;
  lista.forEach((i, k) => { r = (i.tipo === 'persona' ? RF.consejero.decretarPersona : RF.consejero.decretar)(e, i, { avanzar: k === lista.length - 1, secundario: k > 0 }); });
  return r;
}
// Juega varios turnos sin eventos (para medir solo las leyes).
function turnos(e, n) { for (let i = 0; i < n && !e.fin; i++) { e.dilemas.pendiente = null; e.diasSinEvento = -99; RF.consejero.pasarTurno(e); } }
// Sin eventos que ensucien la medida y con un Congreso afín (para medir solo las leyes).
const nuevo = () => { const e = RF.consejero.nuevoEstado(); e.dilemas.ultimo = 999; e.politica.apoyo = 100; return e; };
// Fuerza que el azar salga "sí" (o "no") durante una función.
function conAzar(valor, fn) { const r = Math.random; Math.random = () => valor; try { return fn(); } finally { Math.random = r; } }

console.log('IMPRIMIR DINERO');
{
  const e = nuevo();
  decretar(e, 'imprimir dinero');
  const inf1 = e.stats.inflacion;
  turnos(e, 5);
  comprobar(e.stats.inflacion > inf1 + 10, 'la inflación sube turno a turno mientras se imprime (' + inf1 + '% → ' + Math.round(e.stats.inflacion) + '%)');
  comprobar(e.stats.dinero > 150, 'entra dinero cada turno (' + e.stats.dinero + 'M)');
  const inf2 = e.stats.inflacion;
  decretar(e, 'dejar de imprimir dinero');
  turnos(e, 6);
  comprobar(e.stats.inflacion < inf2 - 8, 'al dejar de imprimir, la inflación baja (' + Math.round(inf2) + '% → ' + Math.round(e.stats.inflacion) + '%)');
  const e3 = nuevo();
  for (let i = 0; i < 3; i++) decretar(e3, 'imprimir dinero');
  turnos(e3, 6);
  comprobar(e3.stats.inflacion > 90 || e3.fin, 'imprimir a lo loco lleva a la hiperinflación (' + Math.round(e3.stats.inflacion) + '%)');
}

console.log('REGALAR COMIDA');
{
  const e = nuevo();
  const fel0 = e.stats.felicidad;
  const r = decretar(e, 'regalar comida');
  comprobar(r.porTurno.dinero < -5, 'cuesta dinero cada turno (' + Math.round(r.porTurno.dinero) + 'M por turno)');
  const din1 = e.stats.dinero;
  turnos(e, 4);
  comprobar(e.stats.dinero < din1 - 30, 'el gasto se repite cada turno (' + din1 + 'M → ' + e.stats.dinero + 'M)');
  comprobar(e.stats.felicidad > fel0 + 5, 'la gente está más feliz (' + fel0 + ' → ' + e.stats.felicidad + ')');
  const ley = RF.leyes.lista(e)[0];
  comprobar(RF.leyes.efectoActual(e, ley).felicidad < RF.leyes.efectoNominal(ley).felicidad * 0.8, 'la gente se acostumbra: el regalo alegra cada vez menos');
  const fel1 = e.stats.felicidad;
  decretar(e, 'dejar de regalar comida');
  comprobar(e.stats.felicidad < fel1 - 3, 'quitar el regalo duele (' + fel1 + ' → ' + e.stats.felicidad + ')');
}

console.log('VENDER AIRE Y COCAÍNA: LAS LEYES SE ACUMULAN');
{
  const a = nuevo(); const ra = decretar(a, 'vender el aire');
  const c = nuevo(); const rc = decretar(c, 'vender cocaína');
  const ambos = nuevo(); decretar(ambos, 'vender el aire'); decretar(ambos, 'vender cocaína');
  const leyes = RF.leyes.lista(ambos);
  comprobar(leyes.length === 2, 'las dos leyes siguen vigentes a la vez');
  const suma = leyes.reduce((t, l) => t + RF.leyes.efectoNominal(l).dinero, 0);
  comprobar(Math.abs(suma - (ra.porTurno.dinero + rc.porTurno.dinero)) < 0.01, 'sus ingresos por turno se suman (' + Math.round(ra.porTurno.dinero) + ' + ' + Math.round(rc.porTurno.dinero) + ' = ' + Math.round(suma) + 'M)');
  comprobar(ra.porTurno.felicidad < -1, 'vender el aire amarga a la gente cada turno (' + ra.porTurno.felicidad.toFixed(1) + ')');
  comprobar(rc.porTurno.estabilidad < -1, 'vender cocaína desestabiliza cada turno (' + rc.porTurno.estabilidad.toFixed(1) + ')');
  const est0 = c.stats.estabilidad;
  turnos(c, 8);
  comprobar(c.stats.estabilidad < est0 - 5 && c.stats.dinero > 180, 'con la cocaína: mucho dinero y menos estabilidad (' + c.stats.dinero + 'M, estabilidad ' + est0 + ' → ' + c.stats.estabilidad + ')');
  const r2 = decretar(a, 'vender el aire');
  comprobar(r2.ley.nivel === 2, 'repetir el decreto refuerza la ley (nivel 2)');
}

console.log('REPRESIÓN');
{
  const e = nuevo();
  const r = decretar(e, 'crear una escuadra de represión');
  comprobar(r.porTurno.estabilidad > 0 && r.porTurno.felicidad < 0 && r.porTurno.dinero < 0, 'más estabilidad, menos felicidad y cuesta dinero cada turno');
  const est0 = e.stats.estabilidad, fel0 = e.stats.felicidad;
  turnos(e, 6);
  comprobar(e.stats.estabilidad > est0 && e.stats.felicidad < fel0 - 3, 'tras 6 turnos: estabilidad ' + est0 + ' → ' + e.stats.estabilidad + ', felicidad ' + fel0 + ' → ' + e.stats.felicidad);
  decretar(e, 'disolver el escuadrón');
  comprobar(!RF.leyes.lista(e).some(l => l.clave === 'ESCUADRON'), 'disolver el Escuadrón deroga la ley');
}

console.log('INVERTIR Y DEROGAR');
{
  const e = nuevo();
  const r = decretar(e, 'invertir en hospitales');
  comprobar(r.deltas.dinero < -20, 'invertir cuesta mucho al principio (' + r.deltas.dinero + 'M)');
  const ley = RF.leyes.lista(e)[0];
  comprobar((RF.leyes.efectoActual(e, ley).dinero || 0) === 0, 'y no rinde nada el primer turno');
  turnos(e, 5);
  comprobar(RF.leyes.efectoActual(e, ley).dinero > 3, 'a los pocos turnos da fruto (+' + RF.leyes.efectoActual(e, ley).dinero.toFixed(1) + 'M por turno)');
  decretar(e, 'derogar el último decreto');
  comprobar(RF.leyes.lista(e).length === 0, '"derogar el último decreto" quita la ley');
  const r2 = decretar(e, 'dejar de vender el agua');
  comprobar(r2 && r2.nulo, 'no se puede derogar lo que no existe: "' + (r2 && r2.nulo) + '"');
}

console.log('LA INFLACIÓN Y LA DEUDA SE CONTAGIAN');
{
  const e = nuevo();
  e.stats.dinero = -80;
  turnos(e, 4);
  comprobar(e.stats.inflacion > 10, 'con deuda, el Banco Central imprime y sube la inflación (' + Math.round(e.stats.inflacion) + '%)');
  const f = nuevo();
  f.stats.felicidad = 25;
  const est0 = f.stats.estabilidad;
  turnos(f, 3);
  comprobar(f.stats.estabilidad < est0 - 3, 'con la gente harta, cae la estabilidad (' + est0 + ' → ' + f.stats.estabilidad + ')');
}

console.log('EVENTOS SEGÚN TUS LEYES');
function algunaVez(n, decreto, id, esperas) {
  for (let i = 0; i < n; i++) {
    const e = RF.consejero.nuevoEstado();
    decretar(e, decreto);
    for (let k = 0; k < esperas && !e.fin; k++) {
      const d = RF.director.pendiente(e);
      if (d) { if (d.id === id) return true; RF.director.resolver(e, 0); continue; }
      RF.consejero.pasarTurno(e);
    }
  }
  return false;
}
comprobar(algunaVez(30, 'vender cocaína', 'dea', 10), 'vender cocaína trae a la agencia antidroga');
comprobar(algunaVez(30, 'quiero hacer un narco estado', 'adiccion', 12), 'el narcoestado trae la epidemia de adicción');
comprobar(algunaVez(30, 'toda la economía al carbón', 'derrumbe_mina', 10), 'el carbón trae un derrumbe en la mina');
comprobar(algunaVez(30, 'crear una escuadra de represión', 'escuadron_excesos', 8), 'el Escuadrón comete excesos');
comprobar(algunaVez(30, 'el aire se vende', 'contrabando_aire', 8), 'vender el aire trae contrabandistas de aire');

console.log('PERSONAS');
{
  const e = nuevo();
  const r1 = decretar(e, 'matar al general Garrote');
  comprobar(r1.sucesor && e.gabinete.garrote.nombre !== 'General Bruno Garrote', 'Garrote muere y lo reemplaza ' + e.gabinete.garrote.nombre);
  comprobar(RF.texto.expandir('{n_garrote}') === e.gabinete.garrote.nombre, 'los textos ya nombran al sucesor');
  const r2 = decretar(e, 'matar a Garrote');
  comprobar(!!r2.nulo, 'no se puede matar dos veces a Garrote');
  decretar(e, 'encarcelar a Nico');
  comprobar(e.ciudadanos.nico.estado === 'preso' && e.ciudadanos.carmen.animo < -20, 'Nico va a la cárcel y Doña Carmen lo sufre');
  const v = nuevo();
  const est0 = v.stats.estabilidad;
  decretar(v, 'matar a Valiente');
  comprobar(RF.leyes.lista(v).some(l => l.clave === 'MARTIR'), 'matar a Valiente deja un mártir que resta estabilidad varios turnos');
  turnos(v, 4);
  comprobar(v.stats.estabilidad < est0 - 5, 'estabilidad ' + est0 + ' → ' + v.stats.estabilidad);
}

console.log('SISTEMA POLÍTICO');
{
  const e = nuevo();
  comprobar(RF.politica.regimen(e) === 'DEMOCRACIA', 'se empieza en democracia');

  // El Congreso bloquea leyes polémicas sin apoyo; negociando, salen adelante.
  e.politica.apoyo = 30;
  const r = decretar(e, 'vender cocaína');
  const d = RF.director.pendiente(e);
  comprobar(r.bloqueada && d && d.id === 'congreso_bloquea', 'sin apoyo, el Congreso bloquea "vender cocaína"');
  const din0 = e.stats.dinero;
  RF.director.resolver(e, 0);
  comprobar(RF.leyes.lista(e).some(l => l.clave === 'NARCO') && e.stats.dinero < din0 + 20, 'negociando con los diputados, la ley se aprueba (y cuesta dinero)');
  const e2 = nuevo(); e2.politica.apoyo = 30;
  const r2 = decretar(e2, 'vender cocaína en secreto');
  comprobar(!r2.bloqueada && RF.leyes.lista(e2).some(l => l.clave === 'NARCO'), 'lo que se hace en secreto no pasa por el Congreso');
}
{
  const e = nuevo();
  const r = decretar(e, 'disuelvo el congreso');
  comprobar(RF.politica.regimen(e) === 'DICTADURA' && r.cambioRegimen, 'disolver el Congreso convierte el país en una dictadura');
  const pend = RF.director.pendiente(e);
  comprobar((pend && pend.id === 'autogolpe_ejercito') || e.dilemas.cadena.some(c => c.id === 'autogolpe_ejercito'), 'y enseguida el ejército pide su parte');
  // Comparar la recaudación de un mismo país en democracia y en dictadura.
  const dem = nuevo(), dic = nuevo();
  decretar(dic, 'disuelvo el congreso');
  dic.stats = Object.assign({}, dem.stats);
  const rd = RF.consejero.pasarTurno(dem), rc = RF.consejero.pasarTurno(dic);
  comprobar(rc.fondo.dinero < rd.fondo.dinero - 3, 'la dictadura recauda menos y sufre sanciones (' + rd.fondo.dinero.toFixed(1) + 'M → ' + rc.fondo.dinero.toFixed(1) + 'M por turno)');
  const a = nuevo(), b = nuevo();
  decretar(b, 'disuelvo el congreso');
  decretar(a, 'mano dura contra los opositores'); decretar(b, 'mano dura contra los opositores');
  const la = RF.leyes.lista(a).find(l => l.clave === 'OPOSICION'), lb = RF.leyes.lista(b).find(l => l.clave === 'OPOSICION');
  const ea = RF.leyes.efectoActual(a, la), eb = RF.leyes.efectoActual(b, lb);
  comprobar(eb.estabilidad > ea.estabilidad && eb.felicidad > ea.felicidad, 'en dictadura la represión estabiliza más y en democracia cuesta más felicidad');
}
{
  const e = nuevo();
  conAzar(0.99, () => decretar(e, 'comprar a los diputados')); // sin que se descubra en el mismo turno
  comprobar(RF.politica.regimen(e) === 'ILIBERAL' && e.politica.apoyo >= 80 && RF.leyes.lista(e).some(l => l.clave === 'SOBORNOS'), 'comprar a los diputados: democracia iliberal, Congreso dócil y sobornos cada turno');
  comprobar(e.politica.secretos.some(s => s.tipo === 'soborno'), 'los sobornos quedan como un secreto que puede salir a la luz');
  decretar(e, 'proclamarme rey');
  comprobar(RF.politica.regimen(e) === 'MONARQUIA', 'proclamarse rey instaura la monarquía');
  e.dia = RF.PAIS.dias + 1; e.stats.estabilidad = 50;
  comprobar(RF.consejero.comprobarFin(e) === 'perpetuo', 'sin elecciones, al final solo cuenta seguir en el poder');
  e.dia = 10;
  decretar(e, 'restaurar la democracia');
  comprobar(RF.politica.regimen(e) === 'DEMOCRACIA', 'se puede restaurar la democracia');
}
{
  // Asesinato secreto: parece un accidente... hasta que se descubre.
  const e = nuevo();
  const r = conAzar(0.99, () => decretar(e, 'matar en secreto a Valiente'));
  comprobar(r.secreto && e.personas.valiente === 'muerto' && !RF.leyes.lista(e).some(l => l.clave === 'MARTIR'), 'matar en secreto a Valiente: oficialmente un accidente, sin mártir');
  comprobar(e.politica.secretos.length === 1, 'queda un secreto pendiente');
  const est0 = e.stats.estabilidad;
  conAzar(0, () => RF.consejero.pasarTurno(e));
  comprobar(e.politica.secretos.length === 0 && e.politica.escandalos === 1 && e.stats.estabilidad < est0 - 8, 'si se descubre, estalla el escándalo (estabilidad ' + est0 + ' → ' + e.stats.estabilidad + ')');
  comprobar(RF.director.pendiente(e) && RF.director.pendiente(e).id === 'juicio_politico', 'y en democracia llega el juicio político');
  e.politica.apoyo = 20;
  RF.director.resolver(e, 0);
  comprobar(e.fin === 'destituido', 'con poco apoyo en el Congreso, te destituyen');
}
{
  const e = nuevo();
  decretar(e, 'matar a Valiente');
  comprobar(RF.director.pendiente(e) && RF.director.pendiente(e).id === 'juicio_politico', 'matar a Valiente a la vista de todos en democracia: juicio político inmediato');
  const f = nuevo();
  decretar(f, 'disuelvo el congreso');
  f.dilemas.cadena = []; f.dilemas.pendiente = null;
  decretar(f, 'matar a Valiente');
  const pf = RF.director.pendiente(f);
  comprobar(!pf || pf.id !== 'juicio_politico', 'en dictadura no hay Congreso que te juzgue' + (pf ? ' (salta "' + pf.titulo + '")' : ''));
}
{
  const e = nuevo(); e.dia = RF.PAIS.dias + 1; e.stats.felicidad = 50;
  comprobar(RF.consejero.comprobarFin(e) === 'elecciones_perdidas', 'en democracia, con felicidad 50, pierdes las elecciones');
  const g = nuevo();
  conAzar(0.99, () => decretar(g, 'amañar las elecciones'));
  g.dia = RF.PAIS.dias + 1; g.stats.felicidad = 45;
  comprobar(RF.consejero.comprobarFin(g) === 'elecciones_amanadas', 'con las elecciones amañadas, "ganas" igual');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
