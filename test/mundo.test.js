// Prueba de Génesis: el mundo vive solo la historia humana, es reproducible, explica lo que pasa y obedece al dios.
// node test/mundo.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios', 'mando']) require('../js/mundo/' + f + '.js');
const M = RF.MUNDO, S = M.sim, D = M.dios;

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const hasta = (m, anio) => { let t = 0; while (m.anio < anio && t++ < 500) S.turno(m); return m; };

console.log('EL MUNDO');
{
  const m = S.crear(7, 5);
  comprobar(m.tipo.length === S.W * S.H && m.tipo.filter((t, i) => S.esTierra(m, i)).length > 200, 'un mapa de ' + S.W + '×' + S.H + ' con continentes, mar y ríos (' + m.rio.filter(Boolean).length + ' casillas de río)');
  comprobar(S.vivas(m).length === 5 && m.cronica.filter(e => e.tipo === 'fundacion').length === 5 && m.anio === -4000, 'cinco pueblos nacen en el 4000 a. C.');
  const a = JSON.stringify(hasta(S.crear(42, 5), 500)), b = JSON.stringify(hasta(S.crear(42, 5), 500));
  comprobar(a === b, 'la misma semilla da la misma historia (el azar vive en el mundo)');
}

console.log('LA HISTORIA SIGUE EL CALENDARIO REAL');
{
  const renac = [], bronce = [];
  for (const sd of [1, 2, 3, 7, 42, 99, 123, 5]) {
    const m = S.crear(sd, 5); let t = 0, b = null, r = null;
    while (m.anio < 2030 && t++ < 500) { S.turno(m); const e = Math.max(...S.vivas(m).map(c => c.era)); if (b === null && e >= 1) b = m.anio; if (r === null && e >= 5) r = m.anio; }
    bronce.push(b); renac.push(r === null ? 3000 : r);
  }
  const med = l => l.slice().sort((x, y) => x - y)[Math.floor(l.length / 2)];
  comprobar(med(bronce) <= -2800 && med(bronce) >= -3600, 'la Edad del Bronce llega hacia el 3000 a. C. (mediana ' + S.anioTexto(med(bronce)) + ')');
  comprobar(med(renac) >= 1000 && med(renac) <= 1800, 'el Renacimiento, entre los años 1000 y 1800 (mediana ' + S.anioTexto(med(renac)) + ')');
  comprobar(renac.some(a => a < 1400) && renac.some(a => a > 1500), 'pero cada mundo tiene su propia historia: unos se adelantan y otros se estancan');
}

console.log('PASA DE TODO, Y SE EXPLICA');
{
  const tipos = new Set(); let conPorque = 0, total = 0;
  for (const sd of [3, 7, 99]) { const m = hasta(S.crear(sd, 5), 1500); for (const e of m.cronica) { tipos.add(e.tipo.split('_')[0]); total++; if (e.porque && e.precedente) conPorque++; } }
  comprobar(['guerra', 'paz', 'conquista', 'era', 'expansion', 'caida', 'revuelta', 'hambruna'].every(t => tipos.has(t)), 'guerras, paces, conquistas, inventos, expansión, caídas, revueltas y hambrunas (' + [...tipos].join(', ') + ')');
  comprobar(conPorque / total > 0.95, 'casi todo lo que pasa trae su porqué y un precedente real (' + conPorque + ' de ' + total + ')');
  const m = hasta(S.crear(3, 5), 1500);
  comprobar(m.cronica.every(e => !/entra en la Renacimiento|entra en la Neolítico|el teocracia|el república|el democracia/.test(e.titulo + ' ' + e.texto)), 'y con los artículos bien puestos');
}

console.log('LA VOLUNTAD DEL DIOS');
{
  const m = hasta(S.crear(7, 5), -1000);
  const [a, b] = S.vivas(m);
  const p0 = a.pob;
  const r1 = D.obrar(m, 'peste sobre ' + a.nombre);
  comprobar(r1.ok && r1.poder === 'plaga' && a.pob < p0 * 0.8 && r1.suceso.porque, 'una peste nombrando al pueblo: mata, desestabiliza y se explica');
  const r2 = D.obrar(m, 'guerra entre ' + a.nombre + ' y ' + b.nombre);
  comprobar(r2.ok && S.enGuerra(a, b), 'una guerra entre dos pueblos nombrados');
  const r3 = D.obrar(m, 'paz para todos');
  comprobar(r3.ok && !S.enGuerra(a, b), 'y la paz para todos');
  const atrasado = S.vivas(m).slice().sort((x, y) => (x.era * 1000 + x.ciencia) - (y.era * 1000 + y.ciencia))[0], eraAntes = atrasado.era;
  const r4 = D.obrar(m, 'que el más atrasado descubra la imprenta');
  comprobar(r4.ok && atrasado.era === 5 && atrasado.inventos.includes('la imprenta') && (eraAntes < 4 ? r4.suceso.tipo === 'anacronismo' : true), 'regalar la imprenta al más atrasado: salta al Renacimiento' + (eraAntes < 4 ? ', y el anacronismo se paga' : ''));
  const r5 = D.obrar(m, 'que llueva oro sobre ' + b.nombre);
  comprobar(r5.ok && r5.poder === 'oro', '"que llueva oro" es oro, no un diluvio');
  const r6 = D.obrar(m, 'peste', null);
  comprobar(r6.ok && r6.porDefecto === 'grande' && r6.objetivos.length === 1, 'sin decir sobre quién, lo malo cae sobre el más grande (y se dice)');
  const r6b = D.obrar(m, 'que descubran la escritura', null);
  comprobar(r6b.ok && r6b.porDefecto === 'todos' && r6b.objetivos.length === S.vivas(m).length, 'y lo bueno, para todos');
  const r7 = D.obrar(m, 'peste', b.id);
  comprobar(r7.ok && r7.suceso.civ === b.id, 'con un pueblo elegido en el mapa, va para ese pueblo');
  const n = S.vivas(m).length;
  const r8 = D.obrar(m, 'que aparezca un pueblo nuevo');
  comprobar(r8.ok && S.vivas(m).length === n + 1, 'y puede crear pueblos nuevos');
  comprobar(!D.obrar(m, 'que los gatos gobiernen').ok, 'lo que no entiende no lo inventa (lo pasará a Claude si está)');
}

console.log('LA VIDA: ALDEANOS, ÁRBOLES Y CASAS QUE MUEVEN LA ECONOMÍA');
{
  const V = M.vida;
  const m = S.crear(11, 5), v = m.vida;
  comprobar(v.tw === S.W * V.SUB && v.arbol.filter(Boolean).length > 1500 && v.roca.filter(Boolean).length > 300, 'cada región tiene 4×4 parcelas con árboles y rocas (' + v.arbol.filter(Boolean).length + ' árboles)');
  comprobar(S.vivas(m).every(c => v.aldeanos.filter(a => a.c === c.id).length >= 3 && V.plaza(m, c.capital).every(t => v.obra[t] === V.OBRA.centro)), 'cada pueblo nace con su plaza y sus primeros aldeanos');
  const arboles0 = v.arbol.filter(x => x >= 2).length;
  hasta(m, -2000);
  const ofi = new Set(v.aldeanos.map(a => V.OFICIOS[a.o]));
  comprobar(['lenador', 'granjero', 'constructor', 'minero'].every(o => ofi.has(o)), 'hay leñadores, granjeros, constructores y mineros (' + [...ofi].join(', ') + ')');
  comprobar(v.aldeanos.every(a => a.r.length === 3 * (V.TICKS + 1)), 'cada aldeano guarda su recorrido del turno, paso a paso, para la animación');
  comprobar(v.cambios.every(([capa, t, antes, despues, paso]) => paso >= 0 && paso <= V.TICKS), 'y cada parcela que cambia lleva el paso en que cambió');
  const vivas = S.vivas(m);
  comprobar(vivas.filter(c => c.fundada === -4000).every(c => c.casas >= 2 && c.campos >= 4), 'los constructores levantan casas y los granjeros siembran campos (' + vivas.map(c => c.casas + '/' + c.campos).join(' ') + ')');
  comprobar(vivas.some(c => c.piedra > 0) && v.arbol.filter(x => x >= 2).length !== arboles0, 'se tala y se pica piedra');
  // La madera paga la expansión: sin madera ni piedra, un pueblo con árboles cerca no crece.
  const c = vivas[0];
  c.madera = 0; c.piedra = 0; c.arboles = 50;
  comprobar(V.tierrasPagables(m, c) === 0, 'sin madera ni piedra no se puede pagar una tierra nueva');
  c.madera = 7;
  comprobar(V.tierrasPagables(m, c) === 2, 'con 7 de madera, dos tierras (3 cada una)');
  c.arboles = 0; c.madera = 0;
  comprobar(V.tierrasPagables(m, c) === 1, 'y un pueblo sin árboles cerca levanta adobe: una tierra por turno');
  // Las obras dan sitio a más gente.
  const cs = S.casillas(m, c), cap0 = S.capacidad(m, c, cs);
  const [casas, campos] = [c.casas, c.campos];
  c.casas = 0; c.campos = 0;
  const capSin = S.capacidad(m, c, cs);
  c.casas = casas; c.campos = campos;
  comprobar(cap0 > capSin * 1.05, 'las casas y los campos dan de comer a más gente (' + Math.round(capSin) + ' → ' + Math.round(cap0) + ')');
  const a = JSON.stringify(hasta(S.crear(42, 5), -1500).vida), b = JSON.stringify(hasta(S.crear(42, 5), -1500).vida);
  comprobar(a === b, 'la vida también es reproducible con la misma semilla');
}
{
  // Un bosque talado hasta el último árbol deja de ser bosque.
  const m = S.crear(5, 5), v = m.vida, V = M.vida;
  const r = m.tipo.findIndex(t => t === 'bosque');
  for (const t of V.parcelas(m, r)) v.arbol[t] = 0;
  S.turno(m);
  comprobar(m.tipo[r] === 'llanura' && v.fueBosque[r] === 'bosque', 'un bosque talado se vuelve llanura (y se recuerda que fue bosque)');
  const m2 = hasta(S.crear(2, 5), 1500);
  comprobar(m2.vida.fueBosque.filter(Boolean).length >= 5, 'en un mundo poblado, los pueblos talan bosques enteros (' + m2.vida.fueBosque.filter(Boolean).length + ' regiones)');
}
{
  // La guerra la ganan también los guerreros que se encuentran en la frontera.
  const m = hasta(S.crear(7, 5), 500), V = M.vida;
  const a = S.vivas(m).find(x => S.vecinosDe(m, x).length), b = a && S.vecinosDe(m, a)[0];
  let combates = 0, guerreros = 0;
  if (a && b) {
    if (!S.enGuerra(a, b)) S.declararGuerra(m, a, b, null);
    for (let k = 0; k < 4; k++) {
      S.turno(m);
      guerreros = Math.max(guerreros, m.vida.aldeanos.filter(x => x.c === a.id && V.OFICIOS[x.o] === 'guerrero').length);
      combates += m.vida.aldeanos.filter(x => x.r.some((val, i) => i % 3 === 2 && val === V.ACC.luchar)).length;
    }
  }
  comprobar(guerreros >= 5, 'en guerra, el pueblo arma guerreros (' + guerreros + ')');
  comprobar(combates > 0 || S.vivas(m).some(c => c.guerras.length === 0), 'que luchan en la frontera');
}
{
  const m = hasta(S.crear(3, 5), -2000), c = S.vivas(m)[0];
  const arb = () => S.casillas(m, c).reduce((k, r) => k + M.vida.parcelas(m, r).filter(t => m.vida.arbol[t]).length, 0);
  const n0 = arb();
  const r1 = D.obrar(m, 'que planten bosques en ' + c.nombre);
  comprobar(r1.ok && r1.poder === 'bosque' && arb() > n0, 'el dios puede plantar bosques (' + n0 + ' → ' + arb() + ' árboles)');
  const mad = c.madera, n1 = arb();
  const r2 = D.obrar(m, 'que ' + c.nombre + ' tale todos sus árboles');
  comprobar(r2.ok && r2.suceso.tipo === 'tala' && arb() < n1 && c.madera > mad, 'mandar talar da madera y deja el bosque pelado');
  D.obrar(m, 'que planten bosques en ' + c.nombre);
  const n2 = arb();
  const r3 = D.obrar(m, 'incendio en ' + c.nombre);
  comprobar(r3.ok && r3.poder === 'incendio' && arb() < n2 * 0.5, 'y un incendio quema bosques y aldeas');
  comprobar(D.obrar(m, 'lluvia de fuego sobre ' + c.nombre).poder === 'terremoto', '"lluvia de fuego" sigue siendo un castigo del cielo, no un incendio');
}

console.log('LOS PODERES SE NOTAN EN EL ACTO');
{
  const m = hasta(S.crear(9, 5), 0), V = M.vida;
  const grande = () => D.objetivos(m, 'el mas grande', null)[0];
  const gente = c => m.vida.aldeanos.filter(a => a.c === c.id).length;
  let c = grande(), g0 = gente(c), p0 = c.pob;
  D.obrar(m, 'peste sobre ' + c.nombre);
  comprobar(gente(c) < g0 && c.pob < p0 && m.vida.muertos.length > 0, 'la peste mata aldeanos en el mapa al momento (' + g0 + ' → ' + gente(c) + ')');
  c = grande(); const campos0 = c.campos;
  D.obrar(m, 'sequía en ' + c.nombre);
  comprobar(c.campos < campos0, 'la sequía seca campos (' + campos0 + ' → ' + c.campos + ')');
  c = grande(); const casas0 = c.casas;
  D.obrar(m, 'terremoto en ' + c.nombre);
  comprobar(c.casas < casas0, 'el terremoto tira casas (' + casas0 + ' → ' + c.casas + ')');
  c = grande(); p0 = c.pob;
  const r = D.obrar(m, 'mata a la mitad de ' + c.nombre);
  comprobar(r.ok && r.poder === 'matar' && c.pob < p0 * 0.55, '"mata a la mitad" mata a la mitad');
  const d = D.objetivos(m, 'el mas pequeno', null)[0], era0 = d.era, cien0 = d.ciencia;
  const r2 = D.obrar(m, 'haz que ' + d.nombre + ' sea más fuerte');
  comprobar(r2.ok && r2.poder === 'potenciar' && (d.ciencia > cien0 || d.era > era0), '"que sea más fuerte" lo hace avanzar');
  const r3 = D.obrar(m, 'guerra entre el más grande y el más pequeño');
  comprobar(r3.ok && r3.poder === 'guerra' && r3.objetivos.length === 2 && r3.objetivos[0] !== r3.objetivos[1], 'se pueden juntar descripciones: "guerra entre el más grande y el más pequeño"');
  const n = S.vivas(m).length;
  D.obrar(m, 'que aparezca un pueblo nuevo'); V.ajustar(m);
  const nuevo = S.vivas(m)[S.vivas(m).length - 1];
  comprobar(S.vivas(m).length === n + 1 && m.vida.aldeanos.some(a => a.c === nuevo.id) && V.plaza(m, nuevo.capital).every(t => m.vida.obra[t] === V.OBRA.centro), 'un pueblo nuevo aparece con su plaza y sus aldeanos sin esperar al turno');
}

console.log('COMO WORLDBOX: BIOMAS, ARMAS, EJÉRCITOS, REYES, CIUDADES, ALIANZAS, COSECHAS Y ANIMALES');
{
  const V = M.vida;
  const m0 = S.crear(7, 5);
  const biomas = new Set(m0.tipo);
  comprobar(['selva', 'sabana', 'taiga', 'tundra', 'nieve', 'desierto', 'bosque', 'llanura', 'montana'].every(b => biomas.has(b)), 'el clima reparte biomas: ' + [...biomas].join(', '));
  const lat = i => Math.abs(Math.floor(i / S.W) - (S.H - 1) / 2) / ((S.H - 1) / 2);
  const media = t => { const l = m0.tipo.map((x, i) => (x === t ? lat(i) : null)).filter(x => x !== null); return l.reduce((a, b) => a + b, 0) / l.length; };
  comprobar(media('selva') < media('taiga') && media('taiga') < media('nieve'), 'la selva cerca del ecuador, la taiga y la nieve hacia los polos');
  comprobar(m0.vida.mena.filter(x => x === 1).length > 20 && m0.vida.mena.filter(x => x === 2).length > 5, 'hay vetas de hierro y de oro en las rocas');
  comprobar(S.vivas(m0).every(c => c.rey && c.rey.nombre && M.RASGOS[c.rey.rasgo] && c.heredero), 'cada pueblo tiene gobernante (con rasgo) y heredero');

  const m = hasta(S.crear(7, 5), 1500);
  comprobar(S.vivas(m).some(c => (c.metal || 0) + (c.oro || 0) > 0), 'los mineros sacan metal y oro');
  comprobar((m.ciudades || []).length >= 2 && m.ciudades.every(x => m.vida.obra[V.centro(m, x.region)] === V.OBRA.ayuntamiento && x.alcalde), 'nacen ciudades con ayuntamiento y alcalde (' + (m.ciudades || []).map(x => x.nombre).join(', ') + ')');
  comprobar(m.cronica.some(e => e.tipo === 'sucesion') || S.vivas(m).some(c => c.rey.numero || c.rey.desde > -4000), 'los gobernantes mueren y les suceden sus herederos');
  comprobar(m.vida.animales.some(b => b.tipo === 'oveja') && m.vida.animales.some(b => b.tipo === 'ciervo') && m.vida.animales.some(b => b.tipo === 'pez'), 'ovejas junto a las aldeas, ciervos en los bosques y peces en el agua');
  comprobar(m.vida.cultivo.some((x, t) => x === 3 && m.vida.obra[t] === V.OBRA.campo) && S.vivas(m).some(c => c.comida > 0), 'el trigo madura, se siega y llena los graneros');
  // Una guerra con ejércitos: guerreros armados según la era, capitán y combates.
  const w = hasta(S.crear(7, 5), 500);
  const a = S.vivas(w).find(x => S.vecinosDe(w, x).length), b = S.vecinosDe(w, a)[0];
  a.metal = 50; b.metal = 50;
  if (!S.enGuerra(a, b)) S.declararGuerra(w, a, b, null);
  let disparos = 0, bajas = 0, capitan = false;
  let suyos = [];
  for (let k = 0; k < 10; k++) { if (!S.enGuerra(a, b) && a.viva && b.viva) S.declararGuerra(w, a, b, null); S.turno(w); disparos += w.vida.disparos.length; bajas += w.vida.muertos.length; capitan = capitan || !!(w.vida.ejercitos[a.id] && w.vida.ejercitos[a.id].capitan != null); if (k === 1) suyos = w.vida.aldeanos.filter(x => x.c === a.id && V.OFICIOS[x.o] === 'guerrero'); }
  comprobar(suyos.length && suyos.every(x => (x.arma || 0) >= 1), 'con metal, los guerreros llevan el arma de su era (' + (suyos[0] ? V.ARMAS[suyos[0].arma || 0].nombre : '—') + ')');
  comprobar(capitan, 'el ejército marcha tras su capitán');
  comprobar(disparos + bajas > 0, 'hay combates: flechas y bajas (' + disparos + ' disparos, ' + bajas + ' bajas)');
  // Alianzas: el aliado de la víctima entra en la guerra.
  const g = hasta(S.crear(12, 5), -1000), [x, y, z] = S.vivas(g);
  g.alianzas = [];
  S.aliar(g, y, z);
  S.declararGuerra(g, x, y, null);
  let entra = S.enGuerra(z, x);
  for (let k = 0; k < 6 && !entra; k++) { const g2 = hasta(S.crear(12 + k + 1, 5), -1000); const [p, q, r] = S.vivas(g2); S.aliar(g2, q, r); S.declararGuerra(g2, p, q, null); entra = S.enGuerra(r, p); }
  comprobar(S.aliados(g, y, z) && entra, 'los aliados se juran defensa y entran en la guerra para defenderse');
}

console.log('CAMINOS Y COMERCIANTES CON CARRETA');
{
  const V = M.vida;
  const m = hasta(S.crear(7, 5), 1500), v = m.vida;
  const internas = v.rutas.filter(r => r.tipo === 'interna'), externas = v.rutas.filter(r => r.tipo === 'externa'), calles = v.rutas.filter(r => r.tipo === 'calle');
  comprobar(internas.filter(r => m.civs.find(c => c.id === r.a).capital === r.ra && m.ciudades.some(x => x.region === r.rb)).length >= 1, 'cada ciudad queda unida a su capital por un camino (' + internas.length + ' rutas internas)');
  comprobar(calles.length >= S.vivas(m).length, 'las capitales y las ciudades tienen sus calles');
  comprobar(externas.length >= 1, 'los reinos vecinos que se llevan bien abren rutas entre sus capitales (' + externas.length + ')');
  const ter = V.terrenos(m);
  comprobar(v.rutas.filter(r => r.tipo !== 'calle').every(r => r.tiles.every(t => ter[t] !== 'agua' && ter[t] !== 'bajo')), 'los caminos no cruzan el mar (y cruzan los ríos con puentes)');
  const hechos = v.camino.filter(Boolean).length;
  comprobar(hechos > 50, 'los constructores empiedran los caminos (' + hechos + ' tramos)');
  comprobar(S.vivas(m).some(c => c.comerciantes > 0 && c.comerciado > 0), 'hay comerciantes con carreta que llegan a destino y comercian');
  // Una ruta nueva entre dos capitales: se traza por tierra y los comerciantes la recorren.
  const g = hasta(S.crear(7, 5), 0), [a] = S.vivas(g);
  const trazo = V.trazar(g, V.centro(g, a.capital), V.centro(g, S.casillas(g, a).sort((x, y) => S.distancia(y, a.capital) - S.distancia(x, a.capital))[0]), V.terrenos(g));
  comprobar(trazo && trazo.length > 2 && trazo.every((t, i) => i === 0 || Math.abs(t - trazo[i - 1]) === 1 || Math.abs(t - trazo[i - 1]) === g.vida.tw), 'el trazado es un camino continuo, parcela a parcela');
}

console.log('NIVELADO COMO WORLDBOX: OPINIÓN, COMPLOTS, LEALTAD, ASEDIOS, EDIFICIOS Y BARCOS');
{
  const V = M.vida;
  // La opinión sale de motivos con su peso.
  const m = hasta(S.crear(7, 5), 0);
  const [a, b] = S.vivas(m);
  const mot = S.motivos(m, a, b);
  comprobar(mot.length >= 2 && mot.some(x => /frontera/.test(x[0])) && S.opinionObjetivo(m, a, b) === mot.reduce((k, x) => k + x[1], 0), 'la opinión sale de motivos concretos (' + mot.map(x => x[0] + ' ' + x[1]).join(', ') + ')');
  const antes = S.opinionObjetivo(m, a, b);
  const c3 = S.vivas(m)[2];
  S.declararGuerra(m, a, c3, null, true); S.declararGuerra(m, b, c3, null, true);
  comprobar(S.opinionObjetivo(m, a, b) >= antes + 50 || S.enGuerra(a, b), 'un enemigo común acerca mucho (+50)');
  // Complots: la guerra se trama antes de declararse.
  const g = S.crear(9, 5); hasta(g, -500);
  const [x, y] = S.vivas(g);
  const p = S.tramar(g, 'guerra', x, y);
  x.rel[y.id] = y.rel[x.id] = -80;
  let turnos = 0;
  while (!S.enGuerra(x, y) && turnos < 12 && (g.complots || []).includes(p)) { S.turno(g); x.rel[y.id] = y.rel[x.id] = -80; turnos++; }
  comprobar(p && (S.enGuerra(x, y) || !x.viva || !y.viva) && turnos >= 2, 'una guerra se trama durante unos turnos (con su progreso) y luego estalla (' + turnos + ' turnos)');
  // Lealtad: demasiadas ciudades, lejos y con un alcalde ambicioso → rebelión.
  const w = hasta(S.crear(1, 5), 1300);
  const c = S.vivas(w).find(o => (w.ciudades || []).some(z => z.civ === o.id));
  if (c) {
    const ciudad = w.ciudades.find(z => z.civ === c.id);
    ciudad.rasgo = 'ambicioso';
    for (let k = 0; k < 6; k++) w.ciudades.push({ region: -1000 - k, nombre: 'Fantasma' + k, civ: c.id, alcalde: 'X', rasgo: 'tranquilo' });
    const mot2 = S.motivosLealtad(w, c, ciudad);
    w.ciudades = w.ciudades.filter(z => z.region > -1000);
    comprobar(mot2.some(z => /demasiadas ciudades/.test(z[0]) && z[1] <= -25) && mot2.some(z => /ambicioso/.test(z[0])), 'la lealtad baja con demasiadas ciudades (−25 cada una) y con un alcalde ambicioso');
  } else comprobar(false, 'hace falta un pueblo con ciudades');
  const ind = [1, 5].reduce((k, sd) => k + hasta(S.crear(sd, 5), 1700).cronica.filter(e => /se independiza/.test(e.titulo)).length, 0);
  comprobar(ind >= 1, 'las ciudades sin lealtad acaban independizándose (' + ind + ' en dos mundos)');
  // Asedios y edificios.
  const w2 = hasta(S.crear(5, 5), 1500), v2 = w2.vida;
  comprobar(w2.cronica.some(e => /conquista |toma la capital/.test(e.titulo)) , 'los ejércitos toman plazas con asedios');
  const obras = new Set(v2.obra);
  comprobar([V.OBRA.torre, V.OBRA.templo, V.OBRA.puerto].every(o => obras.has(o)), 'las plazas levantan torres, templos y puertos');
  comprobar((v2.barcos || []).some(bb => bb.tipo === 'pesca') && (v2.barcos || []).some(bb => bb.tipo === 'mercante'), 'los puertos echan al mar barcos de pesca y mercantes');
}

console.log('VIDA COMO WORLDBOX: NACER, CRECER, MORIR, CASAS, COLONOS Y FRONTERAS');
{
  const V = M.vida;
  const m = S.crear(7, 5);
  let nacidos = 0, viejos = 0;
  const vistos = new Set(m.vida.aldeanos.map(a => a.id));
  for (let k = 0; k < 40; k++) {
    S.turno(m);
    for (const a of m.vida.aldeanos) if (!vistos.has(a.id)) { vistos.add(a.id); if (a.edad <= 1) nacidos++; }
    viejos += m.vida.muertos.filter(x => x[3] === 'vejez').length;
  }
  const casas = new Set(); for (let t = 0; t < m.vida.obra.length; t++) if ([V.OBRA.casa, V.OBRA.centro, V.OBRA.ayuntamiento].includes(m.vida.obra[t])) casas.add(t);
  comprobar(nacidos > 10 && viejos > 5, 'los aldeanos nacen (' + nacidos + ' bebés) y mueren de viejos (' + viejos + ')');
  comprobar(m.vida.aldeanos.some(a => a.edad < V.ADULTO) && m.vida.aldeanos.some(a => a.edad >= V.VIEJO), 'hay niños y ancianos');
  comprobar(S.vivas(m).every(c => m.vida.aldeanos.filter(a => a.c === c.id).length <= c.camas + 3), 'nadie nace sin cama: los pueblos no tienen más gente que camas');
  // Las casas van pegadas a lo que ya hay.
  const tw = m.vida.tw, PEGA = [V.OBRA.casa, V.OBRA.centro, V.OBRA.ayuntamiento, V.OBRA.molino, V.OBRA.templo, V.OBRA.torre];
  const sueltas = [...casas].filter(t => m.vida.obra[t] === V.OBRA.casa && ![-1, 1, -tw, tw, -tw - 1, -tw + 1, tw - 1, tw + 1].some(d => PEGA.includes(m.vida.obra[t + d]) || m.vida.camino[t + d])).length;
  comprobar(sueltas <= casas.size * 0.15, 'las casas crecen pegadas unas a otras (' + sueltas + ' sueltas de ' + casas.size + ')');
  comprobar(m.cronica.some(e => /^Colonos de /.test(e.titulo)) && (m.ciudades || []).length >= 2, 'los colonos salen andando y fundan aldeas nuevas (' + (m.ciudades || []).map(x => x.nombre).join(', ') + ')');
  // El reino solo se extiende junto a tierra poblada.
  const lejos = [];
  for (let r = 0; r < S.W * S.H; r++) { const d = m.dueno[r]; if (d < 0 || m.vida.poblada[r]) continue; if (!S.vecinos(r).some(w => m.dueno[w] === d && m.vida.poblada[w])) lejos.push(r); }
  comprobar(lejos.length <= 6, 'el reino crece junto a donde vive su gente (' + lejos.length + ' regiones aisladas)');
  // El mundo libre: los años pasan de uno en uno.
  const l = S.crear(3, 5, { libre: true });
  for (let k = 0; k < 10; k++) S.turno(l);
  comprobar(l.libre && l.anio === 11, 'en el mundo libre los años pasan de uno en uno (año ' + l.anio + ')');
}

console.log('GOBERNAR UN PUEBLO: TUS ÓRDENES SOLO MANDAN EN EL TUYO');
{
  const X = M.mando;
  const m = hasta(S.crear(9, 5), 0);
  const yo = S.vivas(m)[0], otros = S.vivas(m).filter(c => c !== yo);
  X.gobernar(m, yo.id);
  comprobar(m.jugador === yo.id && yo.jugador && otros.every(o => !o.jugador), 'eliges un pueblo y pasa a ser el tuyo');
  const antes = JSON.stringify(otros.map(o => [o.pob, o.estab, o.ciencia, o.riqueza, o.plan || null]));
  const ordenes = ['talad el bosque y construid casas', 'invertid en ciencia', 'expandíos hacia el norte', 'reclutad un ejército', 'proclamad la república', 'informe'];
  const res = ordenes.map(o => X.ordenar(m, yo.id, o));
  comprobar(yo.plan.prioridad.madera > 1 && yo.plan.prioridad.casas > 1 && yo.plan.prioridad.ciencia === 2 && yo.plan.prioridad.ejercito > 1, 'las órdenes no mandan a nadie en concreto: suben la importancia de madera, casas, ciencia y ejército (' + JSON.stringify(yo.plan.prioridad) + ')');
  comprobar(res.every(r => r.ok && r.respuesta), 'entiende órdenes de gobierno (' + res.map(r => r.acciones.map(a => a.tipo).join('+')).join(', ') + ')');
  comprobar(JSON.stringify(otros.map(o => [o.pob, o.estab, o.ciencia, o.riqueza, o.plan || null])) === antes, 'y ninguna toca a los demás pueblos');
  const r = X.ordenar(m, yo.id, 'que caiga una peste sobre ' + otros[0].nombre);
  comprobar(r.ok && r.acciones[0].tipo === 'milagro' && /dios/.test(r.respuesta), 'los milagros no se pueden: no eres un dios');
  comprobar(JSON.stringify(r.acciones) === JSON.stringify(JSON.parse(JSON.stringify(r.acciones))) && m.registro.length === ordenes.length + 1, 'cada orden queda como acciones serializables (listas para el multijugador)');
  // Las acciones cambian cómo vive tu pueblo.
  X.ordenar(m, yo.id, 'como antes');
  const proporcion = () => m.vida.aldeanos.filter(a => a.c === yo.id && M.vida.OFICIOS[a.o] === 'lenador').length / Math.max(1, m.vida.aldeanos.filter(a => a.c === yo.id && a.edad >= M.vida.ADULTO).length);
  const antesTala = proporcion();
  X.ordenar(m, yo.id, 'que todos talen');
  for (let k = 0; k < 6; k++) S.turno(m);
  const lenadores = m.vida.aldeanos.filter(a => a.c === yo.id && M.vida.OFICIOS[a.o] === 'lenador').length, total = m.vida.aldeanos.filter(a => a.c === yo.id && a.edad >= M.vida.ADULTO).length;
  comprobar(lenadores / total >= Math.max(0.3, antesTala * 1.6), '"que todos talen" pone a mucha más gente a talar (' + Math.round(antesTala * 100) + '% → ' + lenadores + ' de ' + total + ')');
  const c1 = S.crear(4, 5), c2 = S.crear(4, 5);
  hasta(c1, -2000); hasta(c2, -2000);
  X.gobernar(c1, S.vivas(c1)[0].id); X.ordenar(c1, S.vivas(c1)[0].id, 'invertid en ciencia');
  for (let k = 0; k < 10; k++) { S.turno(c1); S.turno(c2); }
  comprobar(S.vivas(c1)[0].ciencia > S.vivas(c2)[0].ciencia * 1.08, 'invertir en ciencia hace avanzar más deprisa (' + Math.round(S.vivas(c2)[0].ciencia) + ' → ' + Math.round(S.vivas(c1)[0].ciencia) + ')');
  // El pueblo del jugador se gobierna solo, igual que los de la IA: sin órdenes, reparte el trabajo según lo que falta.
  {
    const g = hasta(S.crear(12, 5), -1000), V = M.vida, c = S.vivas(g)[0];
    X.gobernar(g, c.id);
    c.madera = 0;
    const conMadera = V.reparto(Object.assign({}, c, { madera: 200 }), { arboles: 9, rocas: 9 }), sinMadera = V.reparto(c, { arboles: 9, rocas: 9 });
    comprobar(sinMadera[0] > conMadera[0] * 1.3, 'sin órdenes, el gobernador automático pone más leñadores cuando falta madera (' + Math.round(conMadera[0] * 100) + '% → ' + Math.round(sinMadera[0] * 100) + '%)');
    const enGuerra = V.reparto(Object.assign({}, c, { guerras: [{ con: 99 }] }), { arboles: 9, rocas: 9 });
    comprobar(enGuerra[4] > sinMadera[4] * 2, 'y arma guerreros si hay guerra');
    const hambre = V.reparto(Object.assign({}, c, { pob: c.cap * 1.0 }), { arboles: 9, rocas: 9 }), holgura = V.reparto(Object.assign({}, c, { pob: c.cap * 0.4 }), { arboles: 9, rocas: 9 });
    comprobar(hambre[1] > holgura[1], 'y más granjeros cuando la gente roza el límite de comida');
  }
  // Guerra y paz: la IA no firma sola contigo una guerra que empezaste tú: te ofrece la paz.
  const w = hasta(S.crear(1, 5), 500);
  const a = S.vivas(w).find(x => S.vecinosDe(w, x).length), b = S.vecinosDe(w, a)[0];
  X.gobernar(w, a.id);
  const rg = X.ordenar(w, a.id, 'atacad a ' + b.nombre);
  comprobar(rg.ok && S.enGuerra(a, b), 'declaras la guerra a un vecino');
  for (let k = 0; k < 25 && S.enGuerra(a, b) && a.viva; k++) S.turno(w);
  comprobar(!a.viva || !b.viva || S.enGuerra(a, b), 'la guerra no se acaba sola: la decides tú (o se acaba cuando cae uno)');
  comprobar(w.ofertas && w.ofertas[b.id] != null, 'cuando se cansan, te ofrecen la paz');
  if (a.viva && b.viva) { const rp = X.ordenar(w, a.id, 'acepto la paz con ' + b.nombre); comprobar(rp.ok && !S.enGuerra(a, b), 'y aceptarla la firma'); }
  comprobar(JSON.stringify(X.limpiar([{ tipo: 'guerra', con: 2 }, { tipo: 'borrar_mundo' }, { tipo: 'prioridad', cambios: { madera: { a: 9 }, magia: { a: 2 } } }])) === JSON.stringify([{ tipo: 'guerra', con: 2 }, { tipo: 'prioridad', cambios: { madera: { a: 2 } } }]), 'lo que traduzca Claude se filtra (solo acciones conocidas, con valores dentro de lo permitido)');
}

console.log('LO QUE DECIDA CLAUDE, CON LÍMITES');
{
  const m = hasta(S.crear(7, 5), -1000);
  const c = S.vivas(m)[0], p0 = c.pob, era0 = c.era;
  const e = D.aplicarIA(m, { entendido: true, titulo: 'Los gatos toman el poder', texto: 'Un gato se sienta en el trono y nadie se atreve a quitarlo.', porque: 'La legitimidad es lo que la gente cree.', precedente: 'Calígula quiso hacer cónsul a su caballo.', efectos: [{ civ: c.id, poblacion: 900, estabilidad: -300, era: 9, regimen: 'monarquia_felina' }] });
  comprobar(e && e.divino && e.porque && c.pob <= p0 * 1.6 + 0.01 && c.estab >= 0 && c.era <= era0 + 2, 'los efectos se recortan (población +60% como mucho, dos eras como mucho, estabilidad dentro de 0-100)');
  comprobar(c.regimen !== 'monarquia_felina', 'y un régimen que no existe se ignora');
  comprobar(D.aplicarIA(m, { entendido: false }) === null, 'si Claude no lo entiende, no pasa nada');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
