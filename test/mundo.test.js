// Prueba de Génesis: el mundo vive solo la historia humana, es reproducible, explica lo que pasa y obedece al dios.
// node test/mundo.test.js
global.RF = global.RF || {};
for (const f of ['datos', 'sim', 'vida', 'dios']) require('../js/mundo/' + f + '.js');
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
  comprobar(!r6.ok && r6.motivo === 'falta_quien', 'sin saber sobre quién, pregunta');
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
  comprobar(vivas.every(c => c.casas >= 2 && c.campos >= 4), 'los constructores levantan casas y los granjeros siembran campos (' + vivas.map(c => c.casas + '/' + c.campos).join(' ') + ')');
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
  comprobar(m.tipo[r] === 'llanura' && v.fueBosque[r] === 1, 'un bosque talado se vuelve llanura (y se recuerda que fue bosque)');
  const m2 = hasta(S.crear(2, 5), 1500);
  comprobar(m2.vida.fueBosque.filter(Boolean).length >= 10, 'en un mundo poblado, los pueblos talan bosques enteros (' + m2.vida.fueBosque.filter(Boolean).length + ' regiones)');
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
