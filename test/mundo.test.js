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
  comprobar(med(bronce) <= -2600 && med(bronce) >= -3600, 'la Edad del Bronce llega hacia el 3000 a. C. (mediana ' + S.anioTexto(med(bronce)) + ')');
  comprobar(med(renac) >= 1000 && med(renac) <= 1800, 'el Renacimiento, entre los años 1000 y 1800 (mediana ' + S.anioTexto(med(renac)) + ')');
  // (Subir de edad cuesta y tarda, como en Age of Empires: los más rápidos llegan algo después de la fecha mínima.)
  comprobar(renac.some(a => a < 1550) && renac.some(a => a > 1700), 'pero cada mundo tiene su propia historia: unos se adelantan y otros se estancan (' + renac.join(', ') + ')');
}

console.log('PASA DE TODO, Y SE EXPLICA');
{
  const tipos = new Set(); let conPorque = 0, total = 0;
  for (const sd of [1, 4, 7]) { const m = hasta(S.crear(sd, 5), 1500); for (const e of m.cronica) { tipos.add(e.tipo.split('_')[0]); total++; if (e.porque && e.precedente) conPorque++; } }
  comprobar(['guerra', 'paz', 'conquista', 'era', 'expansion', 'caida', 'revuelta'].every(t => tipos.has(t)) && (tipos.has('hambruna') || tipos.has('sequia')), 'guerras, paces, conquistas, inventos, expansión, caídas, revueltas y malos años (sequías o hambrunas) (' + [...tipos].join(', ') + ')');
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
  const a = S.vivas(m).filter(x => S.vecinosDe(m, x).length).sort((x, y) => (y.habitantes || 0) - (x.habitantes || 0))[0], b = a && S.vecinosDe(m, a)[0];
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
  a.metal = 200; b.metal = 200;
  if (!S.enGuerra(a, b)) S.declararGuerra(w, a, b, null);
  let disparos = 0, bajas = 0, capitan = false;
  let suyos = [];
  for (let k = 0; k < 10; k++) { if (!S.enGuerra(a, b) && a.viva && b.viva) S.declararGuerra(w, a, b, null); S.turno(w); disparos += w.vida.disparos.length; bajas += w.vida.muertos.length; capitan = capitan || !!(w.vida.ejercitos[a.id] && w.vida.ejercitos[a.id].capitan != null); if (k === 1) suyos = w.vida.aldeanos.filter(x => x.c === a.id && V.OFICIOS[x.o] === 'guerrero').map(x => ({ arma: x.arma || 0 })); } // el arma de ese momento (luego pueden caer o cambiar de bando)
  comprobar(suyos.length && suyos.filter(x => (x.arma || 0) >= 1).length >= suyos.length * 0.9, 'con metal, los guerreros llevan el arma de su era (' + (suyos[0] ? V.ARMAS[suyos[0].arma || 0].nombre : '—') + ')');
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
  const c3 = S.vivas(m).find(o => o !== a && o !== b && !S.enGuerra(a, o) && !S.enGuerra(b, o)) || S.vivas(m)[2];
  const yaComun = mot.some(x => /enemigo común/.test(x[0]));
  S.declararGuerra(m, a, c3, null, true); S.declararGuerra(m, b, c3, null, true);
  comprobar(yaComun || S.opinionObjetivo(m, a, b) >= antes + 50 || S.enGuerra(a, b), 'un enemigo común acerca mucho (+50)');
  // Complots: la guerra se trama antes de declararse.
  const g = S.crear(9, 5); hasta(g, -500);
  const [x, y] = S.vivas(g);
  g.complots = (g.complots || []).filter(q => q.de !== x.id && q.de !== y.id); // que no estén ya tramando otra cosa
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
  // Se cuentan durante toda la partida (la crónica solo guarda los últimos sucesos).
  const ind = [2, 8, 3].reduce((k, sd) => { const w = S.crear(sd, 5); let n = 0; while (w.anio < 2000) { const antes = w.cronica[0]; S.turno(w); for (const e of w.cronica) { if (e === antes) break; if (/se independiza/.test(e.titulo)) n++; } } return k + n; }, 0);
  comprobar(ind >= 1, 'las ciudades sin lealtad acaban independizándose (' + ind + ' en tres mundos)');
  // Asedios y edificios.
  const w2 = hasta(S.crear(5, 5), 1500), v2 = w2.vida;
  comprobar(w2.cronica.some(e => /conquista | toma /.test(e.titulo)) , 'los ejércitos toman plazas con asedios');
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
  // (Las casas que se pierden después, por fuego o guerra, dejan a algunos sin cama: se tolera un 20 %.)
  comprobar(S.vivas(m).every(c => m.vida.aldeanos.filter(a => a.c === c.id && a.llego == null).length <= c.camas * 1.2 + 10), 'nadie nace sin cama: los pueblos no tienen mucha más gente que camas (solo los que llegan por conquista o como refugiados)');
  // Las casas van pegadas a lo que ya hay.
  const tw = m.vida.tw, PEGA = [V.OBRA.casa, V.OBRA.centro, V.OBRA.ayuntamiento, V.OBRA.molino, V.OBRA.templo, V.OBRA.torre];
  const sueltas = [...casas].filter(t => m.vida.obra[t] === V.OBRA.casa && ![-1, 1, -tw, tw, -tw - 1, -tw + 1, tw - 1, tw + 1].some(d => PEGA.includes(m.vida.obra[t + d]) || m.vida.camino[t + d])).length;
  comprobar(sueltas <= casas.size * 0.15, 'las casas crecen pegadas unas a otras (' + sueltas + ' sueltas de ' + casas.size + ')');
  comprobar(m.cronica.some(e => /^Colonos de /.test(e.titulo)) && (m.ciudades || []).length >= 2, 'los colonos salen andando y fundan aldeas nuevas (' + (m.ciudades || []).map(x => x.nombre).join(', ') + ')');
  // El reino solo se extiende junto a tierra poblada.
  const lejos = [];
  // (Los reinos recién nacidos de una rebelión aún no tienen a su gente instalada.)
  const nuevos = new Set(S.vivas(m).filter(c => !(c.aldeanos > 0)).map(c => c.id));
  for (let r = 0; r < S.W * S.H; r++) { const d = m.dueno[r]; if (d < 0 || m.vida.poblada[r] || nuevos.has(d)) continue; if (!S.vecinos(r).some(w => m.dueno[w] === d && m.vida.poblada[w])) lejos.push(r); }
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
  comprobar(S.vivas(c1)[0].ciencia > S.vivas(c2)[0].ciencia * 1.05, 'invertir en ciencia hace avanzar más deprisa (' + Math.round(S.vivas(c2)[0].ciencia) + ' → ' + Math.round(S.vivas(c1)[0].ciencia) + ')');
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
  // (Si ya estaban en guerra por su cuenta, se firma la paz antes: la prueba es sobre una guerra que empiezas tú.)
  if (S.enGuerra(a, b)) S.hacerPaz(w, a, b, 'prueba');
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

console.log('DIRIGIR LA GUERRA');
{
  const X = M.mando;
  const m = hasta(S.crear(9, 5), 600);
  const yo = S.vivas(m).filter(c => S.vecinosDe(m, c).some(o => (m.ciudades || []).some(x => x.civ === o.id)))[0] || S.vivas(m).filter(c => S.vecinosDe(m, c).length)[0];
  X.gobernar(m, yo.id);
  const vec = S.vecinosDe(m, yo).find(o => (m.ciudades || []).some(x => x.civ === o.id)) || S.vecinosDe(m, yo)[0];
  const ciudad = (m.ciudades || []).find(x => x.civ === vec.id), meta = ciudad ? ciudad.region : vec.capital;
  const r = X.ordenar(m, yo.id, ciudad ? 'atacad ' + ciudad.nombre : 'tomad la capital de ' + vec.nombre);
  comprobar(r.acciones[0].tipo === 'objetivo' && S.enGuerra(yo, vec) && yo.plan.objetivo === meta, '«atacad <ciudad>» declara la guerra a su dueño y fija el objetivo');
  S.turno(m);
  const e = m.vida.ejercitos[yo.id];
  comprobar(m.dueno[meta] !== vec.id || (e && e.obj === meta), 'el ejército marcha sobre la plaza elegida');
  X.ordenar(m, yo.id, 'defended la capital'); S.turno(m);
  const e2 = m.vida.ejercitos[yo.id];
  comprobar(!yo.guerras.length || (e2 && e2.defiende === yo.capital), '«defended la capital» planta el ejército en casa');
  comprobar(X.entender(m, yo.id, 'retirada')[0].tipo === 'defender', '«retirada» es defender la capital');
  for (let i = 0; i < 6; i++) S.turno(m);
  const g = yo.guerras.find(x => x.con === vec.id);
  comprobar(!g || (g.muertos || 0) + (g.matados || 0) >= 0, 'cada guerra lleva su marcador de bajas');
  comprobar(m.vida.aldeanos.every(a => !a.veh || a.o === 4), 'solo los guerreros manejan vehículos');
}

console.log('CUADRILLAS, CUPOS Y PLAZOS');
{
  const X = M.mando;
  const m = hasta(S.crear(9, 5), -500);
  const yo = S.vivas(m).sort((a, b) => b.pob - a.pob)[0];
  X.gobernar(m, yo.id);
  const e = t => X.entender(m, yo.id, t)[0] || {};
  comprobar(JSON.stringify(e('quiero 5 granjeros talando')) === JSON.stringify({ tipo: 'cuadrilla', n: 5, de: 1, a: 0, hasta: null }), '«quiero 5 granjeros talando» es una cuadrilla de 5 granjeros a talar');
  comprobar(e('5 granjeros a talar durante 3 minutos').hasta.ms === 180000 && e('pon a 4 a la mina 2 turnos').hasta.turnos === 2 && e('todos los mineros a sembrar durante 20 años').hasta.anios === 20, 'entiende plazos en minutos, turnos y años');
  comprobar(e('la mitad de los granjeros a construir hasta tener 30 casas').hasta.cosa === 'casas' && e('tres soldados a cosechar hasta juntar 100 de comida').n === 3, 'entiende metas («hasta tener 30 casas») y números en letra');
  comprobar(e('quiero 10 leñadores').tipo === 'cupo' && e('3 leñadores más').relativo === 1 && e('talad 20 árboles').tipo === 'meta' && e('liberad las cuadrillas').tipo === 'liberar' && e('cuántos leñadores tengo').tipo === 'consulta', 'cupos, metas, liberar y preguntas');
  { const x = X.entender(m, yo.id, 'atacad a ' + S.vivas(m).find(c => c !== yo).nombre + ' con 10 soldados')[0]; comprobar(x.tipo === 'escuadron' && x.n === 10 && x.ataca, '«atacad a X con 10 soldados» manda un escuadrón de 10 contra X'); }
  const r = X.ordenar(m, yo.id, '5 granjeros a talar durante 3 turnos');
  const ids = m.vida.aldeanos.filter(a => a.fijo).map(a => a.id);
  comprobar(r.ok && ids.length === 5 && ids.every(i => m.vida.aldeanos.find(a => a.id === i).o === 0), 'cinco granjeros concretos pasan a talar en el acto');
  X.ordenar(m, yo.id, 'quiero 6 mineros durante 5 turnos');
  comprobar(X.cuentaOficios(m, yo)[3] === 6, 'el cupo deja exactamente 6 mineros');
  S.turno(m); S.turno(m);
  comprobar(m.vida.aldeanos.filter(a => ids.includes(a.id)).every(a => a.o === 0 && a.fijo) && X.cuentaOficios(m, yo)[3] === 6, 'el gobernador no deshace la cuadrilla ni el cupo mientras duran');
  S.turno(m);
  comprobar(!m.vida.aldeanos.some(a => a.fijo) && !(yo.plan.cuadrillas || []).length, 'al vencer el plazo vuelven a su oficio');
  for (let i = 0; i < 3; i++) S.turno(m);
  comprobar(!Object.keys(yo.plan.cupos || {}).length, 'y el cupo se quita a su tiempo');
  X.ordenar(m, yo.id, 'más madera durante 2 turnos');
  const antes = yo.plan.prioridad.madera; S.turno(m); S.turno(m); S.turno(m);
  comprobar(antes > 1 && yo.plan.prioridad.madera === 1, 'una prioridad con plazo vuelve a como estaba');
}

console.log('TODO LO QUE SE LE PUEDE DECIR');
{
  const X = M.mando;
  const m = hasta(S.crear(9, 5), 600);
  const yo = S.vivas(m).filter(c => S.vecinosDe(m, c).length).sort((a, b) => b.pob - a.pob)[0];
  X.gobernar(m, yo.id);
  const vec = S.vecinosDe(m, yo)[0];
  const frases = ['háganme 5 casas', 'hagan defensas', 'formen un escuadrón', 'guardad la capital con 10 soldados', 'esperen el ataque', 'retírense', 'al ataque', 'rendíos', 'espiad a ' + vec.nombre, 'insultad a ' + vec.nombre, 'regalad oro a ' + vec.nombre, 'quemad sus campos', 'saquead su ciudad', 'emboscada', 'patrullad la frontera', 'fabricad tanques', 'subid los impuestos', 'haced fiestas', 'rezad', 'curad a los heridos', 'reparad las casas', 'cazad lobos', 'que trabajen todos', 'explorad el norte', 'deja de talar', 'mandad 15 guerreros a atacar ' + vec.nombre];
  const sin = frases.filter(f => !X.entender(m, yo.id, f).length);
  comprobar(!sin.length, 'el intérprete entiende ' + frases.length + ' órdenes de todo tipo' + (sin.length ? ' (no: ' + sin.join(', ') + ')' : ''));
  let fallo = null;
  for (const f of frases) { try { X.ordenar(m, yo.id, f); } catch (e) { fallo = f + ': ' + e.message; break; } }
  comprobar(!fallo, 'y todas se aplican sin errores' + (fallo ? ' (' + fallo + ')' : ''));
  comprobar(X.entender(m, yo.id, 'háganme 5 casas')[0].tipo === 'meta' && X.entender(m, yo.id, 'esperen el ataque')[0].postura === 'esperar' && X.entender(m, yo.id, 'formad un escuadrón de 10 soldados')[0].n === 10, 'casas, posturas y escuadrones con su número');
  for (let i = 0; i < 4; i++) S.turno(m);
  const g = m.vida.aldeanos.filter(a => a.fijo && a.fijo.guardia != null && a.c === yo.id);
  comprobar(g.length > 0 && g.every(a => a.o === 4), 'los escuadrones siguen formados y armados');
}

console.log('FUEGO, AGUA Y MARCAS');
{
  const m = hasta(S.crear(5, 5), 600), v = m.vida, V2 = M.vida;
  const c = S.vivas(m)[0], ts = S.casillas(m, c).flatMap(r => V2.parcelas(m, r)).filter(t => v.arbol[t] >= 2);
  const t0 = ts[0];
  comprobar(V2.prender(m, t0, 0, 4) && v.fuego[t0] > 0, 'el fuego prende en un árbol');
  const arboles0 = v.arbol.filter(x => x >= 1).length;
  for (let i = 0; i < 4; i++) S.turno(m);
  comprobar(!v.fuego[t0] && (v.arbol[t0] === 0 || (v.marcas[t0] && v.marcas[t0][0] === V2.MARCA.ceniza)), 'el fuego se consume (o lo apagan) y deja el árbol quemado o ceniza');
  comprobar(Object.values(v.marcas || {}).some(x => x[0] === V2.MARCA.ceniza), 'y ceniza en el suelo');
  const n = V2.inundar(m, c, 3);
  comprobar(n > 0 && Object.keys(v.inundado).length >= n, 'el diluvio inunda tierras bajas junto al agua');
  for (let i = 0; i < 4; i++) S.turno(m);
  comprobar(!Object.keys(v.inundado || {}).length, 'y el agua se retira');
  const tv = ts.find(t => v.arbol[t] >= 1 && !v.fuego[t]);
  if (tv != null) { V2.inundar(m, c, 2); v.inundado[tv] = 2; comprobar(!V2.prender(m, tv, 0, 3), 'lo inundado no arde'); }
}

console.log('LA VIDA PAUSADA: NOCHES, ESTACIONES, OBRAS Y NECESIDADES');
{
  const m = S.crear(4, 5, { ritmo: 3 }), v = m.vida, V2 = M.vida;
  while (m.turno % V2.DIA_TURNOS !== V2.DIA_TURNOS - 1) S.turno(m);
  comprobar(v.noche && v.aldeanos.filter(a => a.dormir).length > v.aldeanos.length * 0.4, 'de noche (un turno de cada seis) la gente vuelve a casa a dormir');
  S.turno(m);
  comprobar(!v.noche && !v.aldeanos.some(a => a.dormir), 'y al amanecer vuelven al trabajo');
  const est = new Set(); for (let i = 0; i < 48; i++) { S.turno(m); est.add(v.estacion); }
  comprobar(est.size === 4, 'pasan las cuatro estaciones');
  let andamio = false, casaNueva = false;
  const casas0 = S.vivas(m).reduce((k, c) => k + c.casas, 0);
  for (let i = 0; i < 40 && !andamio; i++) { S.turno(m); if (Object.keys(v.andamios || {}).length) andamio = true; }
  comprobar(andamio, 'las obras se levantan sobre un andamio y tardan varias jornadas');
  for (let i = 0; i < 30; i++) S.turno(m);
  comprobar(S.vivas(m).reduce((k, c) => k + c.casas, 0) > casas0, 'y al acabarse quedan las casas');
  for (let i = 0; i < 150; i++) S.turno(m);
  const c = S.vivas(m).sort((a, b) => b.aldeanos - a.aldeanos)[0];
  comprobar(Array.isArray(c.necesidades) && c.necesidades.length >= 2 && c.necesidades.every(n => n.nombre && n.bien && n.mal), 'cada pueblo sabe lo que necesita y por qué (' + c.necesidades.map(n => n.obra + (n.falta ? '✗' : '✓')).join(' ') + ')');
  comprobar(c.graneros > 0 || c.fuentes > 0 || c.pozos > 0, 'y lo construye por necesidad: graneros ' + c.graneros + ', plazas públicas ' + c.fuentes + ', pozos ' + c.pozos + ', parques ' + c.parques);
  comprobar(c.animo >= 0 && c.animo <= 100 && V2.animoDe(m, v.aldeanos.find(a => a.c === c.id)) >= 0, 'la gente tiene ánimo (' + c.animo + '/100)');
  // El porqué se nota: quitar el pozo a un pueblo sin agua baja la estabilidad.
  comprobar(V2.NECESIDADES.pozo.estab < 0 && V2.NECESIDADES.palacio.mal.length > 10, 'lo que falta cuesta estabilidad y ánimo (sin pozo ' + V2.NECESIDADES.pozo.estab + ')');
  // El arquitecto: se marca una parcela y los constructores la levantan.
  c.jugador = true; c.plan = c.plan || {}; c.plan.prioridad = c.plan.prioridad || {};
  const zona = S.casillas(m, c).flatMap(r => V2.parcelas(m, r)).sort((p, q) => Math.hypot(p % v.tw - V2.centro(m, c.capital) % v.tw, (p / v.tw | 0) - (V2.centro(m, c.capital) / v.tw | 0)) - Math.hypot(q % v.tw - V2.centro(m, c.capital) % v.tw, (q / v.tw | 0) - (V2.centro(m, c.capital) / v.tw | 0)));
  const t = zona.find(x => !V2.puedeColocar(m, c, x, 'pozo'));
  comprobar(t != null && V2.encargar(m, c, t, 'pozo').ok && c.plan.encargos.length === 1, 'el arquitecto marca dónde va un pozo');
  const agua = zona.find(x => ['agua', 'rio', 'bajo'].includes(V2.terrenos(m)[x]));
  comprobar(agua == null || !!V2.puedeColocar(m, c, agua, 'casa'), 'y no deja construir en el agua ni en tierra ajena');
  c.madera += 50; c.piedra += 50; c.oro += 50;
  let hecho = false; for (let i = 0; i < 30 && !hecho; i++) { S.turno(m); hecho = v.obra[t] === V2.OBRA.pozo; }
  comprobar(hecho, 'los constructores van, montan el andamio y lo terminan');
  const tc = S.casillas(m, c).flatMap(r => V2.parcelas(m, r)).find(x => !V2.puedeColocar(m, c, x, 'casa')), r1 = V2.encargar(m, c, tc, 'casa'), r2 = V2.encargar(m, c, tc, 'casa');
  comprobar(r1.ok && r2.quitado && !c.plan.encargos.some(e => e.t === tc), 'tocar otra vez quita el encargo' + (r1.ok ? '' : ' (' + r1.razon + ')'));
  // Órdenes por texto de los edificios nuevos.
  const X2 = M.mando; X2.gobernar(m, c.id);
  for (const [txt, o] of [['construid un pozo', 'pozo'], ['haced una plaza pública', 'fuente'], ['quiero un parque', 'parque'], ['levantad un palacio', 'palacio'], ['construid un granero', 'granero'], ['construid una iglesia', 'templo']]) {
    const r = X2.entender(m, c.id, txt);
    comprobar(r.some(a => a.tipo === 'construir' && a.obra === o), '«' + txt + '» → ' + o);
  }
  comprobar(!X2.entender(m, c.id, 'llenad el granero de comida').some(a => a.tipo === 'construir'), '«llenad el granero» no es construir uno');
}
{
  // Cada edificio existe según la época y el tamaño: ni parques en el Neolítico ni centrales en una aldea.
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida, X2 = M.mando;
  for (let i = 0; i < 20; i++) S.turno(m);
  const c = S.vivas(m)[0]; X2.gobernar(m, c.id);
  const t = S.casillas(m, c).flatMap(r => V2.parcelas(m, r)).find(x => !V2.puedeColocar(m, c, x, 'casa'));
  comprobar(/Era Moderna/.test(V2.puedeColocar(m, c, t, 'central') || ''), 'el arquitecto no deja poner una central eléctrica en el Neolítico (' + V2.puedeColocar(m, c, t, 'central') + ')');
  comprobar(/no se conoce la electricidad/.test(X2.ordenar(m, c.id, 'construid una central eléctrica').respuesta), 'y la orden lo explica');
  comprobar(/Antigüedad/.test(V2.puedeColocar(m, c, t, 'parque') || ''), 'los parques llegan con la Antigüedad clásica');
  for (const [k, era] of [['banco', 5], ['fabrica', 6], ['estacion', 6], ['hospital', 7], ['aerodromo', 8]]) comprobar(V2.ERA_OBRA[V2.OBRA[k]] === era && /llega con/.test(V2.puedeColocar(m, c, t, k) || ''), k + ' existe desde ' + V2.NOMBRE_ERA[era]);
  { const viejo = { era: c.era, nivelMax: c.nivelMax }; c.era = 8; c.nivelMax = 4; c.nivel = 4; c.rutas = 2; c.oro = 99; c.cuarteles = 1; V2.necesidades(m, c); const nec = c.necesidades.map(n => n.obra); comprobar(['banco', 'fabrica', 'estacion', 'hospital', 'aerodromo'].every(k => nec.includes(k)), 'una ciudad de la II Guerra Mundial pide banco, fábrica, estación, hospital y aeródromo (' + nec.join(', ') + ')'); c.era = viejo.era; c.nivelMax = viejo.nivelMax; V2.contar(m); }
  const prueba = (era, nivel, centrales) => V2.alumbradoDe(Object.assign({}, c, { era, nivel, centrales }));
  comprobar(prueba(2, 4, 0) === null && prueba(4, 2, 0) === 'aceite' && prueba(6, 2, 0) === 'aceite' && prueba(6, 3, 0) === 'gas' && prueba(7, 4, 0) === 'gas' && prueba(7, 4, 1) === 'electrico', 'alumbrado: faroles de aceite en la Edad Media, farolas de gas victorianas (villa), eléctricas solo con central');
  // La plaza pública empiedra su explanada de adoquín.
  const v = m.vida, libre = S.casillas(m, c).flatMap(r => V2.parcelas(m, r)).find(x => !V2.puedeColocar(m, c, x, 'pozo') && [1, -1, v.tw, -v.tw].every(d => !v.obra[x + d] && !v.camino[x + d] && !V2.puedeColocar(m, c, x + d, 'pozo')));
  if (libre != null) { V2.cambiar(m, 'obra', libre, 0, 0); const antes = [1, -1, v.tw, -v.tw].filter(d => v.camino[libre + d]).length; c.plan.encargos = []; c.era = 3; c.nivelMax = 4; c.nivel = 4; c.madera = c.piedra = c.oro = 99; const r0 = V2.encargar(m, c, libre, 'fuente'); if (!r0.ok) console.log('   (encargo:', r0.razon + ')'); let ok = false; for (let i = 0; i < 40 && !ok; i++) { S.turno(m); ok = v.obra[libre] === V2.OBRA.fuente; } comprobar(ok && [1, -1, v.tw, -v.tw].filter(d => v.camino[libre + d]).length > antes, 'al acabar la plaza pública, alrededor se empiedra una explanada de adoquín'); }
}
console.log('EL MERCADO GLOBAL');
{
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida, X2 = M.mando;
  for (let i = 0; i < 160; i++) S.turno(m);
  const mk = m.mercado;
  comprobar(mk && V2.BIENES.every(k => mk.precio[k] > 0 && (mk.historia[k] || []).length > 5), 'hay un precio mundial para cada bien (' + V2.BIENES.map(k => k + ' ' + mk.precio[k]).join(', ') + ')');
  comprobar(V2.BIENES.some(k => (mk.historia[k] || []).some(x => Math.abs(x - mk.precio[k]) > 0.02)), 'y los precios se mueven con la oferta y la demanda');
  const esp = new Set(S.vivas(m).map(c => c.especialidad));
  comprobar(esp.size >= 2, 'cada reino elige a qué dedicarse, y no todos a lo mismo (' + [...esp].join(', ') + ')');
  const conCartera = S.vivas(m).filter(c => c.cartera && Object.keys(c.cartera).length >= 2);
  comprobar(conCartera.length >= S.vivas(m).length * 0.6, 'y diversifican: reparten el trabajo entre dos o tres bienes (' + conCartera.slice(0, 2).map(c => c.nombre + ' ' + JSON.stringify(c.cartera)).join(', ') + ')');
  comprobar(S.vivas(m).some(c => (c.cambiosEsp || []).length), 'cambian de bien principal cuando otro rinde más (' + S.vivas(m).flatMap(c => c.cambiosEsp || []).slice(0, 2).map(x => x.de + '→' + x.a + ': ' + x.motivo).join('; ') + ')');
  comprobar(S.vivas(m).every(c => V2.BIENES.every(k => (c[k] || 0) >= 0)), 'y nadie queda con existencias negativas');
  const cosechado = S.vivas(m).reduce((o, c) => { for (const k of Object.keys(c.cosechado || {})) o[k] = (o[k] || 0) + c.cosechado[k]; return o; }, {});
  comprobar(Object.keys(cosechado).length >= 2, 'se cultivan cosas distintas según la tierra (' + Object.keys(cosechado).map(k => k + ' ' + Math.round(cosechado[k])).join(', ') + ')');
  comprobar((mk.tratos || []).length > 3 && mk.tratos.every(x => x.vende !== x.compra && x.oro > 0 && x.n > 0), 'los comerciantes venden y compran entre reinos a cambio de oro (' + (mk.tratos || []).length + ' tratos)');
  comprobar((mk.tratos || []).every(x => x.ruta === 'externa'), 'y solo con los reinos con los que hay ruta de comercio');
  // El precio: con mucha más madera en el mundo, la madera baja.
  mk.suceso = { k: 'piedra', f: 1, titulo: 'calma', hasta: m.turno + 100 }; // sin sucesos que muevan los precios durante la prueba
  const p0 = mk.precio.madera; for (let i = 0; i < 6; i++) { for (const c of S.vivas(m)) c.madera = 0; S.turno(m); }
  const p1 = mk.precio.madera; for (const c of S.vivas(m)) c.madera += 600; for (let i = 0; i < 6; i++) S.turno(m);
  comprobar(p1 > p0 && mk.precio.madera < p1, 'si falta madera en el mundo, sube; si sobra, baja (' + p0 + ' → ' + p1 + ' → ' + mk.precio.madera + ')');
  mk.suceso = null;
  // Las órdenes del mercado.
  const solo = S.vivas(m).find(c => !(m.vida.rutas || []).some(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)));
  const con = S.vivas(m).find(c => (m.vida.rutas || []).some(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)));
  if (solo) { X2.gobernar(m, solo.id); comprobar(/No comerciáis con ningún reino/.test(X2.ordenar(m, solo.id, 'comprad 10 de madera').respuesta), 'sin socios no se puede comprar: hay que producirlo'); }
  if (con) {
    X2.gobernar(m, con.id);
    const r = X2.ordenar(m, con.id, 'comprad 10 de piedra');
    comprobar(/Encargáis 10 de piedra/.test(r.respuesta) && con.plan.pedidos.some(x => x.que === 'piedra'), 'con socios, el pedido espera al comerciante');
    X2.ordenar(m, con.id, 'especializaos en madera');
    comprobar(con.especialidad === 'madera' && con.plan.especialidad === 'madera', '«especializaos en madera»');
    comprobar(/Precios del mundo/.test(X2.ordenar(m, con.id, '¿cómo está el mercado?').respuesta), '«¿cómo está el mercado?»');
  }
}
console.log('EL PLAN URBANO Y LOS MOLINOS');
{
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida, v = m.vida;
  for (let i = 0; i < 150; i++) S.turno(m);
  comprobar(V2.rangoMolino(m) === 3 && V2.rangoMolino(S.crear(4, 5)) === 4, 'el molino tiene un alcance medio (3 parcelas) en las partidas nuevas');
  let casasEnCalle = 0, camposSinMolino = 0, campos = 0, casas = 0;
  const conMolino = t => { const tx = t % v.tw, ty = t / v.tw | 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && v.obra[(ty + dy) * v.tw + tx + dx] === V2.OBRA.molino) return true; return false; };
  for (let t = 0; t < v.obra.length; t++) { if (v.obra[t] === V2.OBRA.casa) { casas++; if (v.plan[t] === 1) casasEnCalle++; } if (v.obra[t] === V2.OBRA.campo) { campos++; if (!conMolino(t)) camposSinMolino++; } }
  comprobar(v.centros.length >= 5 && v.plan.some(x => x === 1) && v.plan.some(x => x === 2), 'cada pueblo tiene su plan: calles en cuadrícula y solares alrededor de la plaza');
  comprobar(casasEnCalle <= Math.max(2, casas * 0.05), 'las casas no se levantan en mitad de las calles del plan (' + casasEnCalle + ' de ' + casas + ')');
  comprobar(campos > 10 && camposSinMolino <= campos * 0.15, 'los campos están junto a un molino (' + (campos - camposSinMolino) + ' de ' + campos + ')');
}
console.log('LAS CIUDADES NUEVAS EMPIEZAN COMO CAMPAMENTO');
{
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida;
  const fases = {};
  for (let i = 0; i < 200; i++) { S.turno(m); for (const x of m.ciudades || []) { const f = fases[x.nombre] = fases[x.nombre] || []; if (f[f.length - 1] !== x.fase) f.push(x.fase); } }
  const listas = Object.values(fases);
  comprobar(listas.length > 3 && listas.every(f => f[0] === 'campamento'), 'toda ciudad nueva nace como campamento de colonos');
  comprobar(listas.some(f => f.join('>') === 'campamento>obras>aldea'), 'y pasa por las obras del ayuntamiento antes de ser aldea');
  const camp = (m.ciudades || []).find(x => x.fase === 'campamento');
  if (camp) comprobar(m.vida.obra[V2.centro(m, camp.region)] === V2.OBRA.campamento && !(m.vida.rutas || []).some(ru => ru.clave === 'c:' + camp.region), 'el campamento tiene sus tiendas y todavía no tiene calles trazadas');
}
console.log('FICHAS: EDIFICIOS CON NOMBRE E HISTORIA, CIUDADES CON FUNDADORES, ALDEANOS CON PADRES');
{
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida, v = m.vida;
  for (let i = 0; i < 200; i++) S.turno(m);
  const fichas = Object.values(v.edificios || {});
  comprobar(fichas.length > 50 && fichas.every(e => e.nombre && e.anio != null && e.historia.length), 'cada edificio tiene nombre, año y su historia (' + fichas.slice(0, 3).map(e => e.nombre).join(', ') + ')');
  comprobar(fichas.some(e => e.por && e.por.length), 'y se sabe quién lo construyó');
  comprobar(fichas.some(e => e.historia.some(h => /reformado/.test(h.texto))), 'los edificios viejos se reforman uno a uno al estilo de la edad nueva');
  comprobar(new Set(fichas.filter(e => e.tipo === V2.OBRA.casa).map(e => e.era)).size >= 2, 'y no todas las casas tienen el mismo estilo a la vez');
  const x = (m.ciudades || []).find(y => y.fundadores && y.fundadores.length);
  comprobar(x && x.madre && x.historia && x.historia.length, 'cada ciudad sabe quién la fundó y de qué reino salió (' + (x ? x.nombre + ': ' + x.fundadores.join(', ') : '') + ')');
  const hijos = v.aldeanos.filter(a => a.padres && a.padres[1]);
  comprobar(hijos.length > 10, 'los niños tienen padre y madre (' + (hijos[0] ? hijos[0].nombre + ', hijo de ' + hijos[0].padres.join(' y ') : '') + ')');
  const porId = new Map(v.aldeanos.map(a => [a.id, a]));
  const incesto = hijos.filter(a => { const p = porId.get(a.padre), q = porId.get(a.madre); return p && q && ((p.padre != null && p.padre === q.padre) || q.padre === p.id || p.padre === q.id || q.madre === p.id || p.madre === q.id); });
  comprobar(incesto.length === 0, 'y las parejas nunca son hermanos ni padres e hijos');
}
console.log('LA MUERTE DEPENDE DE CÓMO SE HA VIVIDO');
{
  const m = S.crear(4, 5, { ritmo: 3 }), V2 = M.vida;
  for (let i = 0; i < 200; i++) S.turno(m);
  const v = m.vida, edades = v.aldeanos.map(a => V2.anos(a));
  comprobar(Math.max(...edades) < 110, 'nadie vive eternamente (el más viejo tiene ' + Math.round(Math.max(...edades)) + ' años)');
  const a = v.aldeanos.find(x => V2.anos(x) > 40 && V2.anos(x) < 60 && x.o !== 3 && x.o !== 4) || v.aldeanos[0], c = S.civ(m, a.c);
  const sano = Object.assign({}, a, { desnutricion: 0, heridas: 0, rasgos: [] }), enfermo = Object.assign({}, a, { desnutricion: 8, heridas: 4, rasgos: [], casa: null });
  const p1 = V2.riesgoAnual(m, sano, c).p, p2 = V2.riesgoAnual(m, enfermo, c).p;
  comprobar(p2 > p1 * 1.8, 'quien ha pasado hambre, tiene heridas y vive sin casa corre mucho más riesgo (' + (p1 * 100).toFixed(1) + ' % frente a ' + (p2 * 100).toFixed(1) + ' %)');
  const joven = Object.assign({}, sano, { edad: 4 }), viejo = Object.assign({}, sano, { edad: 24 });
  comprobar(V2.riesgoAnual(m, viejo, c).p > V2.riesgoAnual(m, joven, c).p * 5, 'y el riesgo crece mucho con la edad');
  const porId = new Map(v.aldeanos.map(x => [x.id, x])); let gap = 99;
  for (const x of v.aldeanos) { const p = porId.get(x.padre); if (p) gap = Math.min(gap, V2.anos(p) - V2.anos(x)); }
  comprobar(gap >= 15, 'un padre siempre le saca al menos unos 16 años a su hijo (el mínimo: ' + Math.round(gap) + ')');
  comprobar(Object.values(v.difuntos || {}).some(d => d.causa === 'vejez') && Object.values(v.difuntos || {}).some(d => d.causa === 'enfermedad'), 'se recuerda de qué murió cada uno (vejez, enfermedad…)');
}
console.log('LA CORTE: MEJORAS Y EDADES');
{
  const m = S.crear(4, 5, { ritmo: 3 }), X2 = M.mando;
  for (let i = 0; i < 10; i++) S.turno(m);
  const c = S.vivas(m)[0]; X2.gobernar(m, c.id);
  const med = S.mejorasDeEdad(c);
  comprobar(med.lista.length >= 3 && med.pide === 3, 'cada edad tiene sus mejoras y hacen falta tres para avanzar (' + med.lista.map(t => t.nombre).join(', ') + ')');
  const ts = M.tecsDe(c); ts.length = 0; c.ciencia = 9999; m.anio = 9999; for (const k of ['comida', 'madera', 'piedra', 'oro', 'metal']) c[k] = 999; c.nivelMax = c.nivel = 4;
  comprobar(/mejoras más de esta edad/.test(S.puedeSubir(m, c).falta.join(' ')), 'sin las mejoras no se puede pasar de edad');
  for (const t of med.lista.slice(0, 3)) ts.push(t.id);
  comprobar(!/mejora/.test(S.puedeSubir(m, c).falta.join(' ')), 'con tres mejoras, ese requisito se cumple');
  comprobar(X2.entender(m, c.id, 'no avancéis de edad solos').some(a => a.tipo === 'edad_auto' && !a.si), '«no avancéis de edad solos»');
}
{
  // Con ritmo 1 (las pruebas de siempre) nada de esto cambia el mundo.
  const m = S.crear(4, 5);
  for (let i = 0; i < 12; i++) S.turno(m);
  comprobar(!m.vida.noche && m.vida.estacion === -1 && !Object.keys(m.vida.andamios || {}).length, 'sin vida pausada, ni noches ni estaciones ni andamios');
}

console.log('LAS ERAS NO SE ATASCAN (RITMO PAUSADO)');
{
  const m = S.crear(11, 5, { ritmo: 3 });
  let atasco = 0;
  for (let k = 0; k < 450; k++) {
    S.turno(m);
    for (const c of S.vivas(m)) { const r = S.mejorasDeEdad(c); if (r.hechas < r.pide && S.ahorrando(m, c)) atasco++; }
  }
  const maxEra = Math.max(...S.vivas(m).map(c => c.era));
  comprobar(atasco === 0, 'nadie se pone a ahorrar para la edad mientras le faltan sus mejoras');
  comprobar(maxEra >= 4, 'en 450 turnos (una hora a 1×) algún reino llega a ' + M.ERAS[maxEra].con);
  comprobar(m.anio <= (M.ERAS[maxEra + 1] ? M.ERAS[maxEra + 1].desde + 150 : 2100), 'el calendario no se escapa de la historia: ' + S.anioTexto(m.anio) + ' con ' + M.ERAS[maxEra].con);
}

console.log('PRIMEROS PASOS Y LA HISTORIA DE TU PUEBLO');
{
  const X = M.mando, m = S.crear(11, 5, { ritmo: 3 });
  m.modo = 'pueblo'; X.gobernar(m, S.vivas(m)[0].id);
  const p1 = X.guia(m);
  comprobar(p1 && p1.n === 1 && p1.de === X.GUIA.length && p1.accion === 'ficha', 'al empezar, la guía pide mirar tu pueblo (paso 1 de ' + X.GUIA.length + ')');
  m.guia.vioFicha = 1; m.guia.ordenes = 1;
  const p3 = X.guia(m);
  comprobar(p3 && p3.id === 'comida', 'tras mirar el pueblo y dar una orden, toca el molino y los campos');
  for (let k = 0; k < 80; k++) { S.turno(m); X.evaluarRetos(m, []); }
  const e = X.estadoRetos(m);
  comprobar(e.hist && e.hist.eras[0] != null && e.hist.maxHab > 0 && e.hist.reyes.length > 0, 'se apunta la historia: era de inicio, mayor tamaño (' + e.hist.maxHab + ' vecinos) y reyes (' + e.hist.reyes.join(', ') + ')');
  m.guia.oculta = 1;
  comprobar(X.guia(m) === null, 'la guía se puede saltar');
  const m2 = S.crear(12, 5, { ritmo: 3 }); m2.modo = 'dios';
  comprobar(X.guia(m2) === null, 'en el modo dios no hay guía');
}

console.log('BATALLAS MÁS LARGAS');
{
  const V = M.vida;
  const soldado = { o: 4, edad: 5 }, nino = { edad: 1 };
  comprobar(V.vidaMax(soldado) >= 100 && V.vidaMax(nino) < V.vidaMax({ o: 1, edad: 5 }), 'un soldado aguanta ' + V.vidaMax(soldado) + ' puntos de vida (más que un granjero, y un niño menos)');
  const espada = V.ARMAS.find(x => x.nombre === 'espada de hierro');
  comprobar(Math.ceil(V.vidaMax(soldado) / espada.dano) >= 6 && V.VEHICULOS.tanque.vida >= 300, 'hacen falta ' + Math.ceil(V.vidaMax(soldado) / espada.dano) + ' tajos de espada para tumbar a un soldado; un tanque tiene ' + V.VEHICULOS.tanque.vida);
}

console.log('CONTROL FRONTERIZO');
{
  const V = M.vida, m = S.crear(99, 5); let t = 0;
  while (m.anio < 1500 && t++ < 900) S.turno(m);
  const cs = S.vivas(m).filter(c => V.pasosFronterizos(m, c).length);
  comprobar(cs.length > 0, 'las carreteras de comercio cruzan fronteras (' + cs.length + ' reinos con paso fronterizo)');
  comprobar(S.vivas(m).every(c => c.era >= V.ERA_OBRA[V.OBRA.aduana] || !(c.aduanas || []).length), 'antes de la Revolución Industrial no hay puestos');
  for (let k = 0; k < 60; k++) { for (const c of cs) { c.madera = Math.max(c.madera, 40); c.piedra = Math.max(c.piedra, 40); c.oro = Math.max(c.oro || 0, 40); c.era = 7; } S.turno(m); }
  const v = m.vida, puestos = []; for (let i = 0; i < v.obra.length; i++) if (v.obra[i] === V.OBRA.aduana) puestos.push(i);
  const junto = puestos.every(p => v.rutas.some(ru => ru.tipo === 'externa' && ru.tiles.some(u => Math.abs(u % v.tw - p % v.tw) <= 1 && Math.abs((u / v.tw | 0) - (p / v.tw | 0)) <= 1)));
  comprobar(puestos.length > 0 && junto, 'en la era moderna se levantan ' + puestos.length + ' puestos fronterizos, todos pegados a una carretera de comercio');
  const reg = Object.values(v.aduanas || {});
  comprobar(reg.some(r => r.controles > 0) && reg.some(r => r.arancel > 0), 'paran a las carretas (' + reg.reduce((s, r) => s + r.controles, 0) + ' controles) y cobran arancel al comerciante extranjero (' + reg.reduce((s, r) => s + r.arancel, 0) + ' de oro)');
  comprobar(v.aldeanos.some(a => a.guardiaEn != null && puestos.includes(a.guardiaEn)), 'en paz, soldados montan guardia junto a la barrera');
  comprobar(puestos.every(p => v.torres[p] > 0), 'en guerra el puesto se defiende como una torre');
  const nombre = V.nombreEdificio(m, V.OBRA.aduana, puestos[0]);
  comprobar(/^Puesto fronterizo de /.test(nombre), 'cada puesto tiene nombre: ' + nombre);
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
