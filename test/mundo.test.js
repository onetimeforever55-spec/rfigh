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
  X.ordenar(m, yo.id, 'que todos talen');
  for (let k = 0; k < 3; k++) S.turno(m);
  const lenadores = m.vida.aldeanos.filter(a => a.c === yo.id && M.vida.OFICIOS[a.o] === 'lenador').length, total = m.vida.aldeanos.filter(a => a.c === yo.id).length;
  comprobar(lenadores >= total * 0.4, '"que todos talen" pone a la mayoría a talar (' + lenadores + ' de ' + total + ')');
  const c1 = S.crear(4, 5), c2 = S.crear(4, 5);
  hasta(c1, -2000); hasta(c2, -2000);
  X.gobernar(c1, S.vivas(c1)[0].id); X.ordenar(c1, S.vivas(c1)[0].id, 'invertid en ciencia');
  for (let k = 0; k < 10; k++) { S.turno(c1); S.turno(c2); }
  comprobar(S.vivas(c1)[0].ciencia > S.vivas(c2)[0].ciencia * 1.15, 'invertir en ciencia hace avanzar más deprisa (' + Math.round(S.vivas(c2)[0].ciencia) + ' → ' + Math.round(S.vivas(c1)[0].ciencia) + ')');
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
