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

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo bien.');
process.exitCode = fallos ? 1 : 0;
