// Prueba de la biblioteca de conceptos: ajustan las consecuencias según la situación y explican el porqué.
// node test/conceptos.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = (stats) => { const e = RF.consejero.nuevoEstado(); e.dilemas.ultimo = 999; Object.assign(e.stats, stats || {}); return e; };
const decretar = (e, t) => { const i = RF.interprete.interpretar(t, e); return (i.tipo === 'persona' ? RF.consejero.decretarPersona : RF.consejero.decretar)(e, i, { avanzar: false }); };

console.log('LA BIBLIOTECA');
comprobar(RF.CONCEPTOS.length >= 35, RF.CONCEPTOS.length + ' conceptos');
const areas = new Set(RF.CONCEPTOS.map(k => k.area));
comprobar(['economia', 'sociedad', 'politica', 'exterior', 'historia'].every(a => areas.has(a)), 'de economía, sociedad, política, exterior e historia');
comprobar(RF.CONCEPTOS.every(k => k.id && k.nombre && k.idea && typeof k.cuando === 'function' && typeof k.porque === 'function'), 'todos tienen nombre, idea, cuándo y porqué');
comprobar(RF.CONCEPTOS.filter(k => k.area === 'historia').every(k => !k.ajuste), 'los precedentes históricos solo explican, no cambian números');

console.log('AJUSTAN SEGÚN LA SITUACIÓN');
{
  const a = nuevo({ inflacion: 5 }), b = nuevo({ inflacion: 30 });
  const ra = decretar(a, 'imprimir dinero'), rb = decretar(b, 'imprimir dinero');
  comprobar((rb.deltas.inflacion || 0) > (ra.deltas.inflacion || 0) && rb.conceptos.includes('confianza_moneda'), 'imprimir con la inflación ya alta la dispara más: nadie confía en el won');
  const c = nuevo(), m0 = c.economia.mercadoNegro;
  const rc = decretar(c, 'prohibir la cerveza');
  comprobar(c.economia.mercadoNegro > m0 && /jangmadang/.test(rc.porque[0].texto), 'prohibir algo que la gente quiere hace crecer el mercado negro');
  const d = nuevo();
  const rd = decretar(d, 'subir impuestos a los ricos');
  comprobar(rd.ley.factor < 1 && rd.conceptos.includes('recaudacion_informal'), 'con mucho mercado negro, los impuestos recaudan menos');
  const f = nuevo({ dinero: -20 });
  const rf = decretar(f, 'construir escuelas');
  comprobar((rf.deltas.inflacion || 0) > 0 && rf.conceptos.includes('deficit_monetizado'), 'gastar con las arcas vacías acaba imprimiendo');
  const g = nuevo(); const el0 = g.sectores.elite;
  decretar(g, 'destituir a Pak');
  comprobar(g.sectores.elite < el0, 'una purga pone nerviosa a la élite');
}

console.log('EXPLICAN EL PORQUÉ');
for (const t of ['imprimir dinero', 'prohibir la cerveza', 'privatizar el agua', 'congelar los precios', 'liberar los precios', 'repartir las tierras a los campesinos', 'colectivizar la agricultura', 'cambiar los billetes', 'crear cartillas de racionamiento', 'abolir el songbun', 'lanzar un misil', 'crear una escuadra de represión']) {
  const r = decretar(nuevo(), t);
  const ok = r.porque && r.porque.length >= 1 && r.porque.length <= 2 && r.porque.every(p => p.texto && !/[{}]|undefined/.test(p.texto) && p.texto.split(/\s+/).length <= 30);
  comprobar(ok, '"' + t + '": ' + (r.porque || []).map(p => p.nombre).join(' + '));
}
{
  const e = nuevo();
  const i = RF.interprete.interpretar('lanzar un misil', e);
  const r = RF.consejero.decretar(e, i);
  const bl = RF.narrador.compactar(RF.narrador.decreto(e, i, r).concat(RF.narrador.cierreDia(e, r)));
  comprobar(bl.some(b => b.tipo === 'porque' && b.titulo === 'POR QUÉ'), 'el bloque POR QUÉ se ve en el turno (no va a la letra pequeña)');
}

console.log('POLÍTICAS NUEVAS');
{
  const e = nuevo();
  decretar(e, 'abolir el songbun');
  comprobar(e.politica.regimen === 'JUCHE' && e.leyes.some(l => l.clave === 'TEMA:SONGBUN'), 'abolir el songbun no abole el régimen Juche');
  comprobar(RF.interprete.interpretar('quitar tres ceros al won', e).dir === 'favor', '"quitar tres ceros al won" es una reforma monetaria');
  comprobar(RF.interprete.interpretar('cambiar la moneda al bitcoin', e).tema === 'BITCOIN', '"cambiar la moneda al bitcoin" sigue siendo bitcoin');
  const p = nuevo(), m0 = p.economia.mercadoNegro;
  decretar(p, 'congelar los precios');
  comprobar(p.economia.mercadoNegro > m0 && p.pendientes.some(x => x.titulo === 'Las tiendas vacías'), 'congelar precios: más mercado negro y, después, tiendas vacías');
}

console.log('LA IA RAZONA CON LA MISMA BIBLIOTECA');
{
  comprobar(RF.CONCEPTOS.every(k => RF.consejoIA.SISTEMA.includes(k.nombre)), 'el Consejo recibe todos los conceptos');
  const e = nuevo();
  const f = { titulo: 'la impresión de wones', porque: ['Dinero sin respaldo: hay más wones pero el mismo arroz.', 'Como Zimbabue en 2008.', 'sobra'] };
  const res = RF.consejoIA.aplicar(e, f);
  const b = RF.consejoIA.bloques(e, f, res).find(x => x.tipo === 'porque');
  comprobar(b && b.texto.split('\n').length === 2, 'y explica sus consecuencias en un POR QUÉ (máximo 2 líneas)');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
