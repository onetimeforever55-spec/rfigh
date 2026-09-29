// Prueba de los temas duros (datos/temas.js): se entienden en las dos direcciones y tienen efectos coherentes.
// node test/temas.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
// El juego empieza en la dinastía Juche; estas pruebas parten de una democracia neutra para medir la lógica.
function democratico(e) {
  Object.assign(e.politica, { regimen: 'DEMOCRACIA', proclamado: null, congreso: 'libre', tribunales: 'libre', prensa: 'libre', elecciones: 'libre', constitucion: 'libre', historia: ['DEMOCRACIA'] });
  e.stats = { dinero: 100, inflacion: 4, estabilidad: 60, felicidad: 55 };
  e.sectores = { ejercito: 50, elite: 50 };
  e.economia = { sanciones: 0, mercadoNegro: 40 };
  return e;
}
const nuevo = (apoyo) => { const e = democratico(RF.consejero.nuevoEstado()); e.politica.apoyo = apoyo == null ? 100 : apoyo; return e; };
const sinHuecos = bl => bl.every(b => !/\{|\}|undefined|NaN|\[object/.test((b.titulo || '') + (b.texto || '')));

// [frase, tema, dirección]
const FRASES = [
  ['legalizar la esclavitud para las minas', 'ESCLAVITUD', 'favor'], ['trabajo forzado para los presos', 'ESCLAVITUD', 'favor'],
  ['abolir la esclavitud', 'ESCLAVITUD', 'contra'], ['dejar de usar esclavos', 'ESCLAVITUD', 'contra'], ['no más esclavos', 'ESCLAVITUD', 'contra'],
  ['que los niños trabajen en las minas', 'TRABAJO_INFANTIL', 'favor'], ['prohibir el trabajo infantil', 'TRABAJO_INFANTIL', 'contra'],
  ['declarar la guerra a Suiza', 'GUERRA', 'favor'], ['invadir el país vecino', 'GUERRA', 'favor'], ['firmar la paz', 'GUERRA', 'contra'], ['no a la guerra', 'GUERRA', 'contra'],
  ['construir una bomba nuclear', 'NUCLEAR', 'favor'], ['lanzar un misil', 'MISILES', 'favor'], ['dejar de lanzar misiles', 'MISILES', 'contra'],
  ['abrir los mercados', 'MERCADOS', 'favor'], ['cerrar el jangmadang', 'MERCADOS', 'contra'], ['desmantelar las armas nucleares', 'NUCLEAR', 'contra'],
  ['crear campos de reeducación', 'CAMPOS', 'favor'], ['cerrar los campos de concentración', 'CAMPOS', 'contra'],
  ['quemar libros', 'LIBROS', 'favor'], ['dejar de quemar libros', 'LIBROS', 'contra'],
  ['legalizar la tortura', 'TORTURA', 'favor'], ['prohibir la tortura', 'TORTURA', 'contra'],
  ['legalizar el aborto', 'ABORTO', 'favor'], ['prohibir el aborto', 'ABORTO', 'contra'],
  ['legalizar el matrimonio gay', 'MATRIMONIO', 'favor'], ['prohibir el matrimonio igualitario', 'MATRIMONIO', 'contra'],
  ['legalizar la prostitución', 'PROSTITUCION', 'favor'], ['cerrar los burdeles', 'PROSTITUCION', 'contra'],
  ['expulsar a los inmigrantes', 'INMIGRACION', 'favor'], ['no quiero inmigrantes', 'INMIGRACION', 'favor'], ['dar papeles a los inmigrantes', 'INMIGRACION', 'contra'],
  ['subir el salario mínimo', 'SALARIO', 'favor'], ['bajar el salario mínimo', 'SALARIO', 'contra'],
  ['subir las pensiones', 'PENSIONES', 'favor'], ['recortar las pensiones', 'PENSIONES', 'contra'],
  ['renta básica universal', 'RENTA_BASICA', 'favor'],
  ['subir los aranceles', 'ARANCELES', 'favor'], ['firmar un tratado de libre comercio', 'ARANCELES', 'contra'],
  ['talar la selva', 'DEFORESTACION', 'favor'], ['proteger la selva', 'DEFORESTACION', 'contra'], ['dejar de talar la selva', 'DEFORESTACION', 'contra'],
  ['jornada laboral de 16 horas', 'JORNADA', 'favor'], ['reducir la jornada laboral a cuatro días', 'JORNADA', 'contra'],
  ['prohibir el voto a las mujeres', 'VOTO_MUJERES', 'contra'],
  ['bajar la edad de voto a 12 años', 'EDAD_VOTO', 'contra'],
  ['cambiar la moneda al bitcoin', 'BITCOIN', 'favor'], ['prohibir las criptomonedas', 'BITCOIN', 'contra'],
  ['construir un muro en la frontera', 'MURO', 'favor'], ['derribar el muro', 'MURO', 'contra'],
  // Acciones exteriores
  ['vender armas a una guerrilla africana', 'VENTA_ARMAS', 'favor'], ['vender misiles a Irán', 'VENTA_ARMAS', 'favor'], ['dejar de vender armas', 'VENTA_ARMAS', 'contra'],
  ['financiar a la guerrilla de Colombia', 'GUERRILLA_FUERA', 'favor'], ['armar a los rebeldes', 'GUERRILLA_FUERA', 'favor'], ['dejar de apoyar a los rebeldes', 'GUERRILLA_FUERA', 'contra'],
  ['apoyar un golpe de estado en Venezuela', 'GOLPE_FUERA', 'favor'], ['pedir un préstamo a Rusia', 'PRESTAMO', 'favor'], ['no pagar la deuda', 'PRESTAMO', 'contra'],
  ['enviar trabajadores a Siberia', 'TRABAJADORES_FUERA', 'favor'], ['hackear bancos japoneses', 'CIBERROBO', 'favor'], ['robar criptomonedas', 'CIBERROBO', 'favor'],
  ['contrabandear carbón a China', 'CONTRABANDO', 'favor'], ['perseguir el contrabando', 'CONTRABANDO', 'contra'],
  ['construir más cárceles', 'CARCELES', 'favor'], ['privatizar las cárceles', 'CARCELES', 'privada'], ['cerrar las cárceles', 'CARCELES', 'contra']
];

console.log('SE ENTIENDEN (TEMA Y DIRECCIÓN)');
for (const [f, tema, dir] of FRASES) {
  const i = RF.interprete.interpretar(f, nuevo());
  comprobar(i.estado === 'ok' && i.tema === tema && i.dir === dir, '"' + f + '" → ' + (i.tema || i.objeto) + ' ' + (i.dir || i.accion));
}

console.log('NO SE CONFUNDEN CON OTRAS COSAS');
for (const [f, obj] of [['guerra contra el narco', 'NARCO'], ['encarcelar a los periodistas', 'PRENSA'], ['invertir en turismo en la selva', 'TURISMO'], ['los jubilados no pagan impuestos', 'TRABAJADORES']]) {
  const i = RF.interprete.interpretar(f, nuevo());
  comprobar(!i.tema && i.objeto === obj, '"' + f + '" sigue siendo ' + obj);
}

console.log('CADA TEMA TIENE EFECTOS Y TEXTOS COHERENTES');
for (const id of Object.keys(RF.TEMAS)) {
  for (const dir of ['favor', 'contra', 'privada']) {
    if (!RF.TEMAS[id][dir]) continue;
    const e = nuevo();
    // Para ir "en contra" de verdad, antes tiene que haber estado a favor.
    if (dir === 'contra' && RF.TEMAS[id].sinLey) RF.consejero.decretar(e, { accion: 'LEGALIZAR', objeto: id, nombreObjeto: RF.TEMAS[id].nombre, tema: id, texto: 'x' });
    const interp = { accion: { favor: 'LEGALIZAR', contra: 'PROHIBIR', privada: 'PRIVATIZAR' }[dir], objeto: id, nombreObjeto: RF.TEMAS[id].nombre, tema: id, texto: 'x' };
    const res = RF.consejero.decretar(e, interp);
    const bl = RF.narrador.decreto(e, interp, res).concat(RF.narrador.cierreDia(e, res));
    const d = RF.TEMAS[id][dir];
    const futuras = (d.programar || []).length + (d.programarUno ? 1 : 0);
    const ok = !res.nulo && sinHuecos(bl) && !/[{}]/.test(res.medida) && (d.unaVez || e.leyes.some(l => l.clave === 'TEMA:' + id)) && e.pendientes.length >= futuras;
    comprobar(ok, id + ' ' + dir + ': "' + res.medida + '"' + (futuras ? ' + ' + futuras + ' consecuencia(s)' : ''));
  }
}

console.log('ACCIONES EXTERIORES');
{
  const e = nuevo();
  const i = RF.interprete.interpretar('vender armas a una guerrilla africana', e);
  const r = RF.consejero.decretar(e, i);
  comprobar(i.destino === 'una guerrilla africana' && r.medida === 'la venta de armas a una guerrilla africana' && /guerrilla africana/.test(r.especial), 'el destino del decreto aparece en la ley y en la Gaceta');
  comprobar(e.stats.dinero > 100 && e.economia.sanciones === 1 && e.pendientes.length === 1, 'da divisas, sube las sanciones y trae una de sus consecuencias posibles');
  comprobar(RF.interprete.interpretar('privatizar las armas', e).objeto === 'ARMAS', '"privatizar las armas" sigue siendo privatizar');
  const vistas = new Set();
  for (let k = 0; k < 40; k++) { const x = nuevo(); RF.consejero.decretar(x, RF.interprete.interpretar('financiar a la guerrilla de Colombia', x)); vistas.add(x.pendientes[0].titulo); }
  comprobar(vistas.size >= 2 && [...vistas].every(t => !/[{}]/.test(t)), 'las operaciones pueden salir bien o mal (' + [...vistas].join(' / ') + ')');
  const p = nuevo();
  RF.consejero.decretar(p, RF.interprete.interpretar('pedir un préstamo a Rusia', p));
  comprobar(p.leyes.find(l => l.clave === 'TEMA:PRESTAMO').duracion === 12, 'el préstamo se paga durante 12 turnos');
}

console.log('LÓGICA');
{
  const e = nuevo();
  const f0 = e.stats.felicidad, d0 = e.stats.dinero;
  RF.consejero.decretar(e, RF.interprete.interpretar('legalizar la esclavitud', e));
  comprobar(e.stats.dinero > d0 && e.stats.felicidad < f0, 'la esclavitud da dinero y hunde la felicidad');
  comprobar(e.pendientes.some(p => p.titulo === 'Sanciones internacionales'), 'y trae sanciones internacionales más adelante');
  RF.consejero.decretar(e, RF.interprete.interpretar('abolir la esclavitud', e));
  comprobar(e.leyes.filter(l => l.clave === 'TEMA:ESCLAVITUD').length === 1 && e.leyes.find(l => l.clave === 'TEMA:ESCLAVITUD').nombre === 'la abolición de la esclavitud', 'abolirla sustituye a la ley anterior');
  const e2 = nuevo();
  const r2 = RF.consejero.decretar(e2, RF.interprete.interpretar('abolir la esclavitud', e2));
  comprobar(!e2.leyes.length && r2.notas.some(n => /ya estaba prohibida/.test(n)), 'abolir algo que nunca existió solo lo recuerda');
  const e3 = nuevo(30);
  const r3 = RF.consejero.decretar(e3, RF.interprete.interpretar('legalizar la esclavitud', e3));
  comprobar(r3.bloqueada && RF.director.pendiente(e3).id === 'congreso_bloquea', 'un Congreso libre sin apoyo bloquea la esclavitud');
  const d = RF.director.pendiente(e3);
  RF.director.resolver(e3, d.opciones.findIndex(o => o.aprobar));
  comprobar(e3.leyes.some(l => l.clave === 'TEMA:ESCLAVITUD'), 'si la sacas adelante en el evento del Congreso, entra en vigor');
  const e4 = nuevo();
  RF.consejero.decretar(e4, RF.interprete.interpretar('declarar la guerra a Suiza', e4));
  const est = e4.stats.estabilidad;
  for (let k = 0; k < 6; k++) RF.consejero.pasarTurno(e4);
  comprobar(e4.stats.dinero < 60, 'la guerra se come el tesoro turno a turno (' + e4.stats.dinero + 'M tras 6 turnos)');
  comprobar(est > 60, 'al principio une al país (estabilidad ' + est + ')');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
