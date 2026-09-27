// Escenarios concretos de economía, instituciones y personas: node test/sistemas.test.js
const RF = require('./cargar')();

let fallos = 0;
function comprobar(cond, texto) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + texto);
  if (!cond) fallos++;
}

// Juega una partida: el primer decreto es el del escenario y luego decretos "de relleno" sensatos.
// Los eventos se resuelven con la opción que menos daño hace, para llegar lejos.
const RELLENO = ['regalar comida', 'invertir en hospitales', 'homenaje al ejército', 'subir el sueldo a los soldados', 'construir escuelas', 'bajar impuestos a los trabajadores', 'homenaje a la policía', 'subir impuestos a los ricos'];
function jugar(inicio, dias, cadaDia) {
  const e = RF.consejero.nuevoEstado();
  const vistos = new Set();
  const decretar = texto => {
    const lista = RF.interprete.interpretarVarios(texto, e).filter(i => i.estado === 'ok');
    let ultimo = null, avanzado = false;
    lista.forEach((i, k) => {
      const op = { avanzar: k === lista.length - 1, secundario: k > 0 };
      const r = i.tipo === 'persona' ? RF.consejero.decretarPersona(e, i, op) : RF.consejero.decretar(e, i, op);
      if (r.nulo) return;
      ultimo = r; if (op.avanzar) avanzado = true;
    });
    if (ultimo && !avanzado) RF.consejero.avanzarDia(e, ultimo);
    return ultimo;
  };
  const resolver = () => {
    let d;
    while ((d = RF.director.pendiente(e))) {
      vistos.add(d.id);
      let mejor = 0, mejorP = -Infinity;
      d.opciones.forEach((_, i) => {
        const prueba = JSON.parse(JSON.stringify(e));
        RF.director.resolver(prueba, i);
        const p = prueba.fin ? -1e9 : Math.min(...Object.values(prueba.stats));
        if (p > mejorP) { mejorP = p; mejor = i; }
      });
      RF.director.resolver(e, mejor);
    }
  };
  const maximo = { narco: 0, pib: 0 };
  const medir = () => {
    maximo.narco = Math.max(maximo.narco, e.eco.sectores.narco.peso);
    maximo.pib = Math.max(maximo.pib, RF.economia.resumen(e).pib);
  };
  decretar(inicio);
  resolver();
  for (let k = 0; k < dias && !e.fin; k++) {
    decretar(cadaDia ? cadaDia(e, k) : RELLENO[k % RELLENO.length]);
    medir();
    resolver();
  }
  RF.poder.actualizarNombres(e);
  return { e, vistos, maximo };
}

function repetir(n, fn) { const out = []; for (let i = 0; i < n; i++) out.push(fn()); return out; }
const media = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
const algunaVez = (xs, id) => xs.some(x => x.vistos.has(id));

console.log('NARCOESTADO');
const narco = repetir(50, () => jugar('quiero hacer un narco estado', 14));
comprobar(media(narco, x => x.maximo.narco) > 20, 'el narcotráfico llega a ser una gran parte de la economía (máximo medio ' + media(narco, x => x.maximo.narco).toFixed(0) + ' de 100)');
comprobar(media(narco, x => x.maximo.pib) > 112, 'el PIB se dispara (máximo medio ' + media(narco, x => x.maximo.pib).toFixed(0) + ')');
comprobar(algunaVez(narco, 'dea'), 'aparece la agencia antidroga');
comprobar(algunaVez(narco, 'bloqueo_naval') || algunaVez(narco, 'adiccion'), 'aparece el bloqueo naval o la epidemia de adicción');

console.log('ECONOMÍA DEL CARBÓN');
const carbon = repetir(50, () => jugar('hacer que toda la economía sea al carbón', 14));
comprobar(media(carbon, x => x.e.eco.contaminacion) > 50, 'la contaminación sube (media ' + media(carbon, x => x.e.eco.contaminacion).toFixed(0) + ')');
comprobar(algunaVez(carbon, 'derrumbe_mina'), 'hay un derrumbe en la mina');
comprobar(algunaVez(carbon, 'cumbre_clima'), 'te acusan en la cumbre del clima');
comprobar(algunaVez(carbon, 'reconversion_protestas'), 'protestan los perdedores de la reconversión');

console.log('ESCUADRA DE REPRESIÓN');
const esc = repetir(50, () => jugar('crear una escuadra de represión', 9));
comprobar(algunaVez(esc, 'escuadron_excesos'), 'el Escuadrón comete excesos');
comprobar(algunaVez(esc, 'tigre'), 'el jefe del Escuadrón pide más poder');
const e0 = RF.consejero.nuevoEstado();
const orden0 = e0.stats.orden;
RF.consejero.decretar(e0, RF.interprete.interpretar('crear una escuadra de represión', e0));
comprobar(e0.stats.orden > orden0 && e0.instituciones.ESCUADRON, 'crear el Escuadrón sube el orden y queda activo');
RF.consejero.decretar(e0, RF.interprete.interpretar('disolver el escuadrón', e0));
comprobar(!e0.instituciones.ESCUADRON, 'disolver el Escuadrón lo elimina');

console.log('PERSONAS');
const e1 = RF.consejero.nuevoEstado();
const r1 = RF.consejero.decretarPersona(e1, RF.interprete.interpretar('matar al general Garrote', e1));
comprobar(r1.sucesor && e1.gabinete.garrote.nombre !== 'General Bruno Garrote', 'Garrote muere y lo reemplaza ' + e1.gabinete.garrote.nombre);
comprobar(RF.texto.expandir('{n_garrote}') === e1.gabinete.garrote.nombre, 'los textos ya nombran al sucesor');
const r2 = RF.consejero.decretarPersona(e1, RF.interprete.interpretar('matar a Garrote', e1));
comprobar(!!r2.nulo, 'no se puede matar dos veces a Garrote: "' + r2.nulo + '"');
const i3 = RF.interprete.interpretar('encarcelar al general', e1);
comprobar(i3.persona === 'garrote' && i3.nombreObjeto === e1.gabinete.garrote.nombre, '"el general" apunta ahora al sucesor');
RF.consejero.decretarPersona(e1, RF.interprete.interpretar('encarcelar a Nico', e1));
comprobar(e1.ciudadanos.nico.estado === 'preso' && e1.ciudadanos.carmen.animo < -20, 'Nico va a la cárcel y Doña Carmen lo sufre');
RF.consejero.decretarPersona(e1, RF.interprete.interpretar('liberar a Nico', e1));
comprobar(e1.ciudadanos.nico.estado === 'libre', 'Nico sale libre');
const e2 = RF.consejero.nuevoEstado();
const mundo0 = e2.stats.mundo;
RF.consejero.decretarPersona(e2, RF.interprete.interpretar('matar a Valiente', e2));
comprobar(e2.personas.valiente === 'muerto' && e2.stats.mundo < mundo0 - 10, 'matar a Valiente lo convierte en mártir y hunde tu imagen');
comprobar(RF.director.pendiente(e2) && RF.director.pendiente(e2).id === 'funeral_valiente', 'al día siguiente llega el dilema del funeral');

console.log('DINERO');
const infl = repetir(10, () => jugar('imprimir dinero', 8, (e, k) => (k < 4 ? 'imprimir dinero' : RELLENO[k % RELLENO.length])));
comprobar(media(infl, x => x.e.eco.inflacion) > 30, 'imprimir dinero dispara la inflación (media ' + media(infl, x => x.e.eco.inflacion).toFixed(0) + '%)');
comprobar(algunaVez(infl, 'hiperinflacion'), 'llega la hiperinflación');

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
