// Prueba de Génesis: partidas jugadas como un jugador de verdad (solo órdenes de texto, sin tocar el almacén), siguiendo
// al consejero. Sale de lo que pasó al jugarlas: el consejero mandaba «todo a la ciencia» a un pueblo de seis, un cupo
// dejaba el campo sin gente, pagar la edad se comía la comida, los encargos se quedaban esperando para siempre, la gente
// cruzaba el mar a nado, y la guerra quitaba aldeanos de golpe sin batalla.
// node test/partida.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios', 'mando']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, V = M.vida, X = M.mando, O = V.OBRA;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };

// Juega como una persona: cada 4 turnos, lo que dice el consejero; a los 20, tres comerciantes; abre comercio de vez en cuando.
function jugar(semilla, turnos, cada) {
  const m = S.crear(semilla, 5, { ritmo: 3 }); m.modo = 'pueblo';
  const yo = S.vivas(m)[0]; X.gobernar(m, yo.id);
  const w = m.vida, nota = { agua: 0, sinCasa: 0, minAdultos: 99, ordenes: {} };
  for (let k = 0; k < turnos && yo.viva; k++) {
    if (k % 4 === 0) { const cj = X.consejo(m, yo.id); if (cj && cj.orden && !['Informe', 'Acepto el trato'].includes(cj.orden)) { X.ordenar(m, yo.id, cj.orden); nota.ordenes[cj.orden] = (nota.ordenes[cj.orden] || 0) + 1; } }
    if (k === 20) X.ordenar(m, yo.id, 'quiero 3 comerciantes');
    if (k % 60 === 30) { const o = S.vivas(m).find(x => x !== yo && !S.enGuerra(yo, x) && !(yo.plan.socios || []).includes(x.id)); if (o) X.ordenar(m, yo.id, 'abrid una ruta comercial con ' + o.nombre); }
    S.turno(m);
    if (cada) cada(m, yo, k);
    const ter = V.terrenos(m);
    for (const a of w.aldeanos) {
      if (a.aBordo == null && ter[a.y * w.tw + a.x] === 'agua' && !w.camino[a.y * w.tw + a.x]) nota.agua++;
      if (a.casa != null && a.colono == null && a.aBordo == null && ![O.casa, O.casona, O.centro, O.ayuntamiento, O.campamento].includes(w.obra[a.casa])) nota.sinCasa++;
    }
    if (k > 40) nota.minAdultos = Math.min(nota.minAdultos, w.aldeanos.filter(a => a.c === yo.id && a.edad >= 2).length);
  }
  return { m, yo, nota };
}

console.log('UN PUEBLO PEQUEÑO QUE SIGUE AL CONSEJERO NO SE MUERE DE HAMBRE');
{
  // (En esta partida, antes: «todo a la ciencia» con seis vecinos, tres comerciantes por cupo y el paso de edad pagado con
  // la comida del granero. De 11 aldeanos quedó 1 durante 300 turnos.)
  const { yo, m, nota } = jugar(2026, 140);
  comprobar(nota.minAdultos >= 4, 'nunca se queda casi sin gente (como poco ' + nota.minAdultos + ' adultos)');
  comprobar(!nota.ordenes['Todo a la ciencia'], 'el consejero no manda «todo a la ciencia» (deja la comida al mínimo)');
  comprobar(m.vida.aldeanos.filter(a => a.c === yo.id).length >= 10 && yo.era >= 1, 'y crece: ' + m.vida.aldeanos.filter(a => a.c === yo.id).length + ' aldeanos, ' + M.ERAS[yo.era].nombre);
  comprobar(nota.agua === 0, 'nadie cruza el mar hondo a nado (' + nota.agua + ')');
  comprobar(nota.sinCasa === 0, 'nadie sigue viviendo en una casa que ya no está (' + nota.sinCasa + ')');
}

console.log('LO QUE SE ENCARGA SE CONSTRUYE, Y LA PARTIDA AVANZA');
{
  // (En esta partida, antes: el único constructor se pasaba la vida empedrando las carreteras de comercio y el templo y la
  // casa del saber nunca se levantaban; el consejero repetía «más piedra» y «investigad escritura», y no salía del Bronce.)
  let encargadoDesde = null, maxEspera = 0;
  const { yo, nota } = jugar(12345, 260, (m, c, k) => { if (c.plan.obra) { if (encargadoDesde == null) encargadoDesde = k; maxEspera = Math.max(maxEspera, k - encargadoDesde); } else encargadoDesde = null; });
  comprobar(yo.era >= 2, 'en 260 turnos pasa del Bronce (' + M.ERAS[yo.era].nombre + ')');
  comprobar(maxEspera <= 45, 'ningún encargo se queda esperando para siempre (como mucho ' + maxEspera + ' turnos)');
  comprobar((nota.ordenes['Más piedra'] || 0) < 15, 'el consejero no repite «más piedra» sin motivo (' + (nota.ordenes['Más piedra'] || 0) + ' veces)');
  comprobar(!Object.keys(nota.ordenes).some(o => /investigamos/.test(o)), 'y dice qué investigar en vez de preguntarlo');
}

console.log('EL CONSEJERO NO PIDE LO QUE NO SE PUEDE HACER');
{
  const m = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 30; k++) S.turno(m);
  const c = S.vivas(m)[0]; X.gobernar(m, c.id);
  // Un pueblo que aún no es pueblo (menos de 30) no puede tener templo: el consejero no se lo pide.
  c.nivel = 1; c.estab = 20; c.templos = 0; c.necesidades = [{ obra: 'templo', falta: true, nombre: 'Templo', mal: 'no hay templo', edificio: 'un templo' }];
  const r = X.consejo(m, c.id);
  comprobar(r && r.orden !== 'Construid un templo', 'con una aldea pequeña y descontenta, no aconseja un templo que no cabe («' + (r && r.orden) + '»)');
  // Sin casa del saber, lo que se investiga allí no se puede empezar: el consejo es levantarla.
  const t = M.TECNOLOGIAS.find(x => x.lugar === 'saber' && x.era <= Math.max(1, c.era));
  if (t) {
    c.era = Math.max(c.era, t.era); c.estab = 70; c.necesidades = []; c.saberes = 0; c.nivel = 2; c.comida = 999; c.madera = c.piedra = 99; c.plan.obra = null;
    c.investigacion = { id: null, puntos: 0 }; for (const x of M.TECNOLOGIAS.filter(x => x.era <= c.era && x.lugar !== 'saber')) (c.tecs = c.tecs || []).includes(x.id) || M.tecsDe(c).includes(x.id) || c.tecs.push(x.id);
    const r2 = X.ordenar(m, c.id, 'investigad ' + t.nombre.toLowerCase()).respuesta;
    comprobar(/una casa del saber: «construid una casa del saber»/.test(r2) && !/cuesta  /.test(r2), 'al pedir algo que se investiga en la casa del saber, dice que falta y cómo hacerla («' + r2.slice(0, 140) + '…»)');
  }
}

console.log('EN LA GUERRA LOS ALDEANOS MUEREN LUCHANDO, NO DE GOLPE');
{
  const m = S.crear(11, 5, { ritmo: 3 }); for (let k = 0; k < 150; k++) S.turno(m);
  const [a, b] = S.vivas(m).sort((p, q) => q.aldeanos - p.aldeanos);
  S.declararGuerra(m, a, b, 'prueba');
  let deGolpe = 0;
  for (let k = 0; k < 20 && S.enGuerra(a, b); k++) { S.turno(m); deGolpe += (m.vida.muertos || []).filter(q => (q[2] === a.id || q[2] === b.id) && q[3] === 'batalla' && q.length === 5).length; }
  comprobar(deGolpe === 0, 'ninguna baja «de guerra» sin pelea: las bajas son las de las batallas (' + deGolpe + ' quitadas de golpe)');
}

console.log('NADIE SE QUEDA EN ALTA MAR SI SU BARCO DESAPARECE');
{
  // (En una partida, el barco de unos colonos desapareció a mitad de travesía y los soltó en el mar: se ahogaron nadando.)
  const m = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 30; k++) S.turno(m);
  const w = m.vida, ter = V.terrenos(m);
  const a = w.aldeanos.find(x => x.edad >= V.ADULTO && x.o !== 4);
  let mar = null;
  for (let t = 0; t < ter.length && mar == null; t++) if (ter[t] === 'agua') { const x = t % w.tw, y = t / w.tw | 0; let cerca = false; for (let d = 3; d <= 8 && !cerca; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const u = (y + dy) * w.tw + x + dx; if (ter[u] && ter[u] !== 'agua' && ter[u] !== 'bajo') cerca = true; } if (cerca) mar = t; }
  a.x = mar % w.tw; a.y = mar / w.tw | 0; a.aBordo = 987654321; a.colono = null;
  S.turno(m);
  const donde = ter[a.y * w.tw + a.x];
  comprobar(a.aBordo == null && donde !== 'agua', 'baja a la tierra más cercana, no al agua honda (' + donde + ')');
}

console.log('EL FUEGO DEJA TRONCOS QUEMADOS Y TIERRA CHAMUSCADA QUE SE RECUPERA');
{
  const m = S.crear(7, 5, { ritmo: 3 }); for (let k = 0; k < 5; k++) S.turno(m);
  const w = m.vida, ter = V.terrenos(m);
  // Un bosquecillo lejos de los pueblos: se le prende fuego.
  const arboles = []; for (let t = 0; t < w.arbol.length && arboles.length < 12; t++) if (w.arbol[t] >= 2 && !w.obra[t] && m.dueno[V.region(m, t)] < 0 && ter[t] !== 'agua') arboles.push(t);
  for (const t of arboles) V.prender(m, t, 0, 3);
  let troncos = 0; for (let k = 0; k < 12; k++) { S.turno(m); troncos = Math.max(troncos, arboles.filter(t => w.marcas && w.marcas[t] && w.marcas[t][0] === V.MARCA.tronco).length); }
  comprobar(troncos >= arboles.length * 0.6, 'los árboles quemados quedan en pie, como troncos negros sin hojas (' + troncos + ' de ' + arboles.length + ')');
  const tq = arboles.find(t => w.marcas && w.marcas[t] && w.marcas[t][0] === V.MARCA.tronco);
  if (tq != null) w.marcas[tq][1] = m.turno + 1;
  for (let k = 0; k < 40; k++) S.turno(m);
  const luego = arboles.map(t => w.arbol[t] >= 1 ? 'brota' : w.marcas && w.marcas[t] && w.marcas[t][0] === V.MARCA.chamuscado ? 'chamuscado' : 'otro');
  comprobar(luego.some(x => x === 'brota') && luego.some(x => x === 'chamuscado' || x === 'brota'), 'después, unos rebrotan y donde no, queda tierra chamuscada que se recupera (' + ['brota', 'chamuscado', 'otro'].map(k => k + ' ' + luego.filter(x => x === k).length).join(', ') + ')');
  const tc = arboles.find(t => !w.arbol[t] && !w.obra[t]);
  if (tc != null) { w.marcas[tc] = [V.MARCA.tronco, m.turno + 20, 3]; V.cambiar(m, 'obra', tc, V.OBRA.casa, 0); }
  comprobar(tc == null || !w.marcas[tc], 'y lo que se construye encima borra el tronco y la ceniza');
}

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo bien.');
process.exitCode = fallos ? 1 : 0;
