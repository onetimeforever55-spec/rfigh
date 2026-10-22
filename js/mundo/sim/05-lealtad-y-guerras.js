  // ── GÉNESIS · EL MUNDO · Lealtad de las ciudades, rebeliones, complots, guerras y lo que pasa solo ──

  /*
   * LA LEALTAD DE LAS CIUDADES, como en WorldBox: cada ciudad (no la capital) tiene una lealtad hecha de
   * motivos. Si baja de cero, su alcalde conspira; si el complot llega al 100 %, la ciudad se independiza.
   */
  // Jugando (partidas pausadas) no hay tope de ciudades: un reino funda tantas como pueda pagar (los colonos se llevan
  // comida y madera); más ciudades no lo hacen más fuerte por sí solas. En el mundo libre, el de siempre: 2 + era/2.
  const maxCiudades = (c, m) => (m && M.vida && M.vida.pausada(m)) ? Infinity : 2 + Math.floor(c.era / 2) + (c.rey && c.rey.rasgo === 'constructor' ? 1 : 0);
  function motivosLealtad(m, c, x) {
    const out = [['base', 35]];
    const d = distancia(x.region, c.capital);
    if (d > 8) out.push(['lejos de la capital', -Math.round((d - 8) * 1.2)]);
    const suyas = (m.ciudades || []).filter(y => y.civ === c.id).length, tope = maxCiudades(c, m);
    if (suyas > tope) out.push(['demasiadas ciudades (' + suyas + ' de ' + tope + ')', -15 * (suyas - tope)]);
    const rey = c.rey ? propio({ justo: 10, sabio: 5, constructor: 5, cruel: -15, loco: -20, codicioso: -5 }, c.rey.rasgo) : 0;
    if (rey) out.push(['su ' + titulo(c) + ' es ' + M.RASGOS[c.rey.rasgo].nombre, rey]);
    const alcalde = propio({ leal: 15, ambicioso: -15, codicioso: -5 }, x.rasgo);
    if (alcalde) out.push(['el alcalde es ' + x.rasgo, alcalde]);
    if (anexadaHacePoco(m, x.region)) out.push(['su antiguo reino ya no existe: acepta al nuevo', 25]);
    else if (x.conquistada != null && m.turno - x.conquistada < 10) out.push(['conquistada hace poco', -Math.round(30 * (1 - (m.turno - x.conquistada) / 10))]);
    if (m.turno - c.ultimaHambre < 4) out.push(['hambre', -15]); else if ((c.comida || 0) > 20) out.push(['graneros llenos', 5]);
    out.push(['estabilidad del reino', Math.round((c.estab - 50) * 0.4)]);
    if (c.guerras.some(g => g.cansancio > 4)) out.push(['cansancio de la guerra', -10]);
    if (c.plan && c.plan.impuesto > 1) out.push(['impuestos altos', -Math.round((c.plan.impuesto - 1) * 40)]);
    if ((c.oro || 0) < 0) out.push(['arcas vacías', -10]);
    if (c.necesidades && c.necesidades.some(n => n.obra === 'palacio' && n.falta)) out.push(['el gobierno no tiene palacio', -8]);
    else if (c.palacios > 0) out.push(['la corte del palacio', 6]);
    return out;
  }
  function lealtades(m) {
    for (const x of (m.ciudades || []).slice()) {
      const c = civ(m, x.civ);
      if (!c || !c.viva || x.region === c.capital) continue;
      x.motivos = motivosLealtad(m, c, x);
      x.lealtad = x.motivos.reduce((k, y) => k + y[1], 0);
      if (x.lealtad < 0) {
        if (x.complot == null) { x.complot = 0; cronica(m, 'complot', x.alcalde + ' conspira en ' + x.nombre, 'El alcalde de ' + x.nombre + ' reúne a los notables de la ciudad: ya no quieren obedecer a ' + c.nombre + '. ' + (x.motivos.filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0] || ['', 0])[0].replace(/^./, l => l.toUpperCase()) + '.', c, x.region); }
        const antes = x.complot;
        x.complot += 10 + Math.min(20, -x.lealtad / 3);
        // Al jugador se le avisa a tiempo, con el motivo y lo que puede hacer.
        if (c.jugador && m.vida && ((antes === 0 && x.complot > 0) || (antes < 60 && x.complot >= 60))) {
          const peor = x.motivos.filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0];
          (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, region: x.region, texto: (x.complot >= 60 ? '⚠ ¡' + x.nombre + ' está a punto de independizarse! ' : '⚠ ' + x.nombre + ' conspira: ') + (peor ? peor[0] : 'no quiere obedecer') + '. ' + consejoLealtad(peor && peor[0]) });
        }
        if (x.complot >= 100) rebelarCiudad(m, c, x);
      } else if (x.lealtad >= 10) x.complot = null;
    }
  }
  // Lo que el jugador puede hacer para calmar una ciudad, según su peor motivo.
  function consejoLealtad(motivo) {
    const k = String(motivo || '');
    if (/demasiadas ciudades/.test(k)) return 'Tienes más ciudades de las que tu era aguanta: avanza de era o deja ir alguna.';
    if (/lejos/.test(k)) return 'Está lejos de la capital: un palacio, fiestas o más estabilidad ayudan.';
    if (/impuestos/.test(k)) return 'Baja los impuestos («bajad los impuestos»).';
    if (/hambre/.test(k)) return 'Que haya comida («más comida»).';
    if (/arcas/.test(k)) return 'Las arcas están vacías: guarda oro o comercia.';
    if (/palacio/.test(k)) return 'Construye un palacio.';
    if (/alcalde/.test(k)) return 'Su alcalde es ambicioso: más estabilidad (fiestas, templos) lo calma.';
    if (/guerra/.test(k)) return 'La gente está cansada de la guerra: haz la paz.';
    return 'Sube la estabilidad: fiestas («haced una fiesta»), templos o paz.';
  }
  // La ciudad se independiza con las tierras que tiene alrededor (las que están más cerca de ella que de la capital).
  function rebelarCiudad(m, c, x) {
    const cs = casillas(m, c);
    const parte = cs.filter(i => i !== c.capital && distancia(i, x.region) <= 4 && distancia(i, x.region) < distancia(i, c.capital));
    if (!parte.includes(x.region)) parte.unshift(x.region);
    if (parte.length >= cs.length) return;
    parte.splice(parte.indexOf(x.region), 1); parte.unshift(x.region);
    const nueva = nuevaCiv(m, x.region, { era: c.era, ciencia: c.ciencia * 0.9, pob: c.pob * parte.length / cs.length, riqueza: c.riqueza * 0.2, estab: 55, inventos: c.inventos.slice(), caracter: c.caracter });
    heredar(c, nueva, parte.length / cs.length);
    if (!m.civs.some(o => o !== nueva && o.nombre === x.nombre)) nueva.nombre = x.nombre;
    nueva.rey = { nombre: x.alcalde, edad: 40, rasgo: x.rasgo === 'ambicioso' ? 'guerrero' : 'justo', desde: m.anio };
    nueva.origen = c.id;
    for (const i of parte) m.dueno[i] = nueva.id;
    if (m.vida) { nueva.pob = 0.5; nueva.pobVida = null; } else c.pob -= nueva.pob;
    c.estab = Math.max(10, c.estab - 10);
    nueva.regimen = regimenPorEra(m, nueva, parte.length);
    nueva.rel[c.id] = c.rel[nueva.id] = -50;
    m.ciudades = m.ciudades.filter(y => y !== x);
    suceso(m, 'independencia', x.region, nueva, c, '🚩 ¡' + x.nombre + ' se independiza de ' + c.nombre + '!');
    cronica(m, 'revuelta', x.nombre + ' se independiza de ' + c.nombre, 'El alcalde ' + x.alcalde + ' proclama la independencia de ' + x.nombre + ' y de ' + (parte.length - 1) + ' comarcas de alrededor' + ((x.motivos || []).filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0] ? ' (' + x.motivos.filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0][0] + ')' : '') + '. ' + c.nombre + ' lo llama traición; ' + x.nombre + ', libertad.', nueva, x.region, { importante: true });
    // A veces la metrópoli no lo acepta.
    if (azar(m) < 0.5 && !c.jugador) declararGuerra(m, c, nueva, c.nombre + ' no acepta la independencia de ' + x.nombre + ' y manda a sus ejércitos a recuperarla.', true);
  }

  // Una guerra necesita un motivo (como los "casus belli" de los complots de WorldBox); sin motivo, no hay complot.
  function casusBelli(m, a, b, r, ratio) {
    if (b.origen === a.id || a.origen === b.id) return 'recuperar las tierras que se independizaron';
    if (r < -40) return 'el odio entre los dos pueblos (opinión ' + Math.round(r) + ')';
    const ambicioso = a.rey && ['guerrero', 'cruel', 'loco'].includes(a.rey.rasgo);
    if (ambicioso && ratio > 1.6 && r < 10) return 'la ambición de ' + nombreRey(a) + ', que ve débil a su vecino';
    const sinMadera = (a.madera || 0) < 5 && (a.arboles || 0) < casillas(m, a).length, sinMetal = a.era >= 1 && (a.metal || 0) < 2;
    if ((sinMadera && (b.arboles || 0) > (a.arboles || 0) * 2) || (sinMetal && (b.metal || 0) > 10)) return 'la codicia de los ' + (sinMadera ? 'bosques' : 'metales') + ' de ' + b.nombre;
    // La era del combustible: quien se queda sin petróleo (o sin carbón) mira con ganas los pozos y las minas del vecino.
    if (a.era >= 7 && (a.petroleo || 0) < 5 && (b.pozosPetroleo || 0) > 0 && ratio > 1.1 && r < 20) return 'el petróleo de ' + b.nombre + ', que ' + a.nombre + ' necesita para sus motores';
    if (a.era >= 6 && a.paradas && (a.paradas.fabrica || a.paradas.tren) && (b.carbon || 0) > 30 && ratio > 1.2 && r < 15) return 'el carbón de ' + b.nombre + ', con las fábricas de ' + a.nombre + ' paradas';
    if (ratio > 2.5 && r < 0 && azar(m) < 0.3) return 'la debilidad de ' + b.nombre;
    return null;
  }

  // Un complot nuevo (si no hay ya uno igual): lo trama el gobernante de "de" contra (o con) "contra".
  function tramar(m, tipo, de, contra, motivo) {
    m.complots = m.complots || [];
    if (m.complots.some(p => p.de === de.id && p.tipo === tipo) || m.complots.some(p => p.tipo === tipo && p.de === contra.id && p.contra === de.id)) return;
    const p = { tipo, de: de.id, contra: contra.id, progreso: 0, desde: m.turno, motivo: motivo || null };
    m.complots.push(p);
    if (tipo === 'guerra') cronica(m, 'complot', nombreRey(de) + ' trama una guerra contra ' + contra.nombre, 'En la corte de ' + de.nombre + ' se habla de mapas y de levas. El motivo: ' + (motivo || 'una afrenta que nadie recuerda bien') + '. Si nada lo impide, habrá guerra.', de);
    return p;
  }
  function avanzarComplots(m) {
    for (const p of (m.complots || []).slice()) {
      const a = civ(m, p.de), b = civ(m, p.contra), r = a.rel[b.id] || 0;
      // Se abandonan si las cosas cambian: la opinión mejora, o empeora para una alianza.
      const sigue = p.tipo === 'guerra' ? r < 25 && !aliados(m, a, b) && a.guerras.length < 2 && !enGuerra(a, b) : r > 10 && !enGuerra(a, b) && !aliados(m, a, b);
      if (!sigue) { m.complots = m.complots.filter(x => x !== p); continue; }
      p.progreso += p.tipo === 'guerra' ? 7 + 5 * rasgo(a, 'agresion') + azar(m) * 6 : 12 + azar(m) * 10;
      if (p.progreso < 100) continue;
      m.complots = m.complots.filter(x => x !== p);
      if (p.tipo === 'guerra') declararGuerra(m, a, b, a.nombre + ' declara la guerra a ' + b.nombre + '. Motivo: ' + (p.motivo || 'una vieja afrenta') + '.');
      else aliar(m, a, b);
    }
  }

  function declararGuerra(m, a, b, motivo, sinAliados) {
    if (enGuerra(a, b) || a === b) return;
    if (aliados(m, a, b)) romper(m, a, b, a.nombre + ' traiciona a su aliado ' + b.nombre + ': la alianza se rompe el mismo día que cruzan la frontera.');
    a.guerras.push({ con: b.id, desde: m.turno, cansancio: 0 });
    b.guerras.push({ con: a.id, desde: m.turno, cansancio: 0 });
    // La guerra rompe el tratado de comercio: tras la paz no se vuelve a comerciar solo (el jugador lo reabre con
    // «abrid una ruta comercial con X»; hasta entonces, cerrado aunque haya dicho «comerciad libremente»).
    for (const [x, y] of [[a, b], [b, a]]) if (x.plan) { x.plan.socios = (x.plan.socios || []).filter(id => id !== y.id); if (x.jugador) x.plan.embargo = [...new Set([...(x.plan.embargo || []), y.id])]; }
    m.complots = (m.complots || []).filter(p => !(p.tipo === 'guerra' && p.de === a.id && p.contra === b.id));
    a.rel[b.id] = b.rel[a.id] = Math.min(a.rel[b.id] || 0, -50);
    const e = cronica(m, 'guerra', 'Guerra entre ' + a.nombre + ' y ' + b.nombre, motivo || (a.nombre + ' cruza la frontera de ' + b.nombre + '. ' + elegir(m, ['Dicen que por un pozo.', 'Dicen que por un insulto a sus dioses.', 'Dicen que por unas ovejas.', 'Dicen que por un matrimonio que no se celebró.', 'Nadie recuerda ya por qué.'])), a, frontera(m, b, a)[0]);
    // Los aliados entran: los de la víctima casi siempre (para eso juraron), los del agresor a veces.
    if (!sinAliados) {
      for (const o of aliadosDe(m, b)) if (o !== a && !aliados(m, o, a) && !enGuerra(o, a) && (o.jugador || azar(m) < 0.75)) declararGuerra(m, o, a, o.nombre + ' cumple su palabra y entra en la guerra para defender a su aliado ' + b.nombre + '.', true);
      for (const o of aliadosDe(m, a)) if (o !== b && !o.jugador && !aliados(m, o, b) && !enGuerra(o, b) && azar(m) < 0.4) declararGuerra(m, o, b, o.nombre + ' se suma a la guerra de su aliado ' + a.nombre + ' contra ' + b.nombre + '.', true);
      m.ultimo = e;
    }
    return e;
  }

  function hacerPaz(m, a, b, motivo) {
    (m.memoria = m.memoria || {})[Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id)] = m.turno;
    a.guerras = a.guerras.filter(g => g.con !== b.id);
    b.guerras = b.guerras.filter(g => g.con !== a.id);
    a.rel[b.id] = b.rel[a.id] = 0;
    cronica(m, 'paz', 'Paz entre ' + a.nombre + ' y ' + b.nombre, motivo || 'Los dos ejércitos están agotados. Se firma un tratado que ninguno de los dos piensa cumplir del todo.', a);
  }

  function guerras(m, a) {
    for (const g of a.guerras.slice()) {
      const b = civ(m, g.con);
      if (!b || !b.viva) { a.guerras = a.guerras.filter(x => x !== g); continue; }
      if (a.id > b.id) continue; // cada guerra se resuelve una vez por turno
      // Las batallas que ganan los guerreros de cada bando (vida.js) inclinan la guerra.
      const batallas = ((a.victorias || 0) - (b.victorias || 0));
      a.victorias = 0; b.victorias = 0;
      const empuje = 1 + 0.25 * M.mat.tanh(batallas / 6);
      const fa = fuerza(m, a) * empuje, fb = fuerza(m, b) / empuje;
      const [gana, pierde, ratio] = fa >= fb ? [a, b, fa / fb] : [b, a, fb / fa];
      // Las batallas ganan algo de frontera cada año; las plazas se toman con asedios (vida.js).
      const k = Math.max(0, Math.min(3, Math.round(((ratio - 1) * 2 + (azar(m) - 0.4)) * 1.1)));
      // En las guerras del jugador, las plazas (capital y ciudades) solo caen por asedio: así elige a cuál ir y
      // sabe qué defender.
      const plaza = new Set(m.vida && (a.jugador || b.jugador) ? [pierde.capital, ...(m.ciudades || []).map(x => x.region)] : []);
      const fr = frontera(m, gana, pierde).filter(i => !plaza.has(i));
      const tomadas = ordenarPor(fr, () => azar(m)).slice(0, k);
      for (const i of tomadas) m.dueno[i] = gana.id;
      // (Con aldeanos y a ritmo pausado, las bajas son las de las batallas de verdad, vida.js: no se quita gente de golpe.)
      if (!(m.vida && ritmo(m) > 1)) { a.pob *= 0.975; b.pob *= 0.975; pierde.pob *= 1 - 0.02 * tomadas.length; }
      a.estab -= 1.5; b.estab -= 1.5;
      const ga = a.guerras.find(x => x.con === b.id), gb = b.guerras.find(x => x.con === a.id);
      const gg = gana.guerras.find(x => x.con === pierde.id); if (gg) gg.comarcas = (gg.comarcas || 0) + tomadas.length;
      const gp = pierde.guerras.find(x => x.con === gana.id); if (gp) gp.comarcas = (gp.comarcas || 0) - tomadas.length;
      if (ga) ga.cansancio += 1 + (pierde === a ? tomadas.length : 0) * 0.5;
      if (gb) gb.cansancio += 1 + (pierde === b ? tomadas.length : 0) * 0.5;
      if (!m.vida && tomadas.includes(pierde.capital)) {
        const quedan = casillas(m, pierde);
        if (!quedan.length || quedan.length <= 2) { for (const i of quedan) m.dueno[i] = gana.id; morir(m, pierde, gana); continue; }
        cronica(m, 'conquista', gana.nombre + ' toma la capital de ' + pierde.nombre, 'La capital de ' + pierde.nombre + ' cae tras un largo asedio. Su corte huye a otra ciudad y sigue llamándose gobierno.', gana, pierde.capital);
        pierde.estab -= 15;
      }
      if (!casillas(m, pierde).length) { morir(m, pierde, gana); continue; }
      const cansancio = Math.max(ga ? ga.cansancio : 0, gb ? gb.cansancio : 0);
      const cansados = cansancio > 6 + azar(m) * 6 || (ratio < 1.15 && cansancio > 4 && azar(m) < 0.3);
      // Con un jugador de por medio, la IA no firma sola: ofrece la paz y el jugador decide.
      const jugador = a.jugador ? a : b.jugador ? b : null;
      const otroJ = jugador ? (jugador === a ? b : a) : null;
      // El gobierno automático del jugador firma solo la paz en las guerras que no empezó él (salvo que el ejército sea su máxima prioridad).
      if (cansados && jugador && !((jugador.plan && jugador.plan.guerrasMias) || []).includes(otroJ.id) && prio(jugador, 'ejercito') < 2) {
        hacerPaz(m, a, b, 'Tu gobierno y ' + otroJ.nombre + ' firman la paz: la guerra la empezaron ellos y ya no daba para más. Si quieres seguir luchando, ordénalo.');
      } else if (cansados && jugador) {
        const otro = otroJ;
        m.ofertas = m.ofertas || {};
        if (!m.ofertas[otro.id] || m.turno - m.ofertas[otro.id] > 12) {
          m.ofertas[otro.id] = m.turno;
          cronica(m, 'paz', otro.nombre + ' te ofrece la paz', 'Llegan emisarios de ' + otro.nombre + ' con regalos y cara de cansancio. Si la quieres, escribe «acepto la paz con ' + otro.nombre + '».', otro, null, { importante: true });
        }
      } else if (cansados) hacerPaz(m, a, b);
    }
  }

  // ---------- Lo que pasa sin que nadie lo decida ----------
  function sucesosNaturales(m) {
    const lista = vivas(m);
    if (!lista.length) {
      // Si la humanidad se extingue, otro pueblo aparece en las tierras vacías.
      nuevoPueblo(m, null);
      return;
    }
    // Pestes: viajan con el comercio y se ceban con los pueblos grandes.
    if (azar(m) < 0.025) {
      const c = lista.slice().sort((a, b) => b.pob - a.pob)[Math.floor(azar(m) * Math.min(2, lista.length))];
      if (c.era >= 2) plaga(m, c, 0.2 + azar(m) * 0.15, null);
    }
    // Pueblos nuevos en tierras vacías (nómadas, colonos, refugiados).
    let libres = 0;
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve') libres++;
    // (En Génesis no aparecen pueblos de la nada: los reinos nuevos nacen de otros, por independencias y rebeliones.
    // Lo vacío lo llenan los colonos de los reinos que ya existen.)
    if (!m.vida && libres > 25 * K && lista.length < 9 && azar(m) < 0.04) nuevoPueblo(m, null);
    // Sequías: unos años sin lluvia, sin cosecha y sin pasto (vida.js los cumple en los campos y los rebaños).
    if (m.vida && azar(m) < 0.04) {
      const c = elegir(m, lista);
      if (!c.efectos.some(e => e.sequia)) {
        c.efectos.push({ sequia: true, hasta: m.turno + 3 + Math.floor(azar(m) * 4) });
        cronica(m, 'sequia', 'Sequía en ' + c.nombre, 'No llueve. El trigo se seca en los campos de ' + c.nombre + ', los pastos amarillean y las reses empiezan a morir. Habrá que vivir de lo guardado.', c);
      }
    }
    if (azar(m) < 0.02) {
      const c = elegir(m, lista);
      c.efectos.push({ comida: 1.4, hasta: m.turno + 4 });
      cronica(m, 'abundancia', 'Años de abundancia en ' + c.nombre, 'Llueve cuando debe y el sol sale cuando toca. Los graneros de ' + c.nombre + ' no dan abasto.', c);
    }
  }

  function plaga(m, c, fuerzaPlaga, texto) {
    c.pob *= 1 - fuerzaPlaga; c.estab -= 12;
    cronica(m, 'plaga', 'Peste en ' + c.nombre, texto || ('Una enfermedad nueva llega con las caravanas. Mueren unos ' + miles(c.pob * fuerzaPlaga / (1 - fuerzaPlaga)) + ' y las ciudades se vacían.'), c);
    // Se contagia a los vecinos con los que comercia.
    for (const v of vecinosDe(m, c)) if (!enGuerra(c, v) && (c.rel[v.id] || 0) > 0 && azar(m) < 0.5) {
      v.pob *= 1 - fuerzaPlaga * 0.6; v.estab -= 6;
      cronica(m, 'plaga', 'La peste llega a ' + v.nombre, 'Los mercaderes de ' + c.nombre + ' traen telas, especias y la enfermedad.', v);
    }
  }

  function nuevoPueblo(m, cerca) {
    const libres = [];
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve' && fertil(m, i) >= 1.5) libres.push(i);
    if (!libres.length) return null;
    const lista = cerca != null ? libres.sort((a, b) => distancia(a, cerca) - distancia(b, cerca)).slice(0, 5) : libres;
    const cap = elegir(m, lista);
    const maxEra = Math.max(0, ...vivas(m).map(c => c.era));
    const c = nuevaCiv(m, cap, { era: Math.max(0, maxEra - 2), ciencia: M.ERAS[Math.max(0, maxEra - 2)].umbral, caracter: azar(m) < 0.5 ? 'guerrero' : elegir(m, Object.keys(M.CARACTERES)) });
    c.regimen = regimenPorEra(m, c, 1);
    for (const v of vecinos(cap)) if (esTierra(m, v) && m.dueno[v] < 0) m.dueno[v] = c.id;
    cronica(m, 'nuevo_pueblo', 'Aparece ' + c.nombre, 'Un pueblo ' + c.caracter + ' llega de las tierras vacías y se asienta. Nadie lo esperaba; nadie lo había invitado.', c, cap, { importante: true });
    return c;
  }

  // ---------- Resumen para la vista y para la IA ----------
  function resumen(m) {
    return vivas(m).map(c => {
      const cs = casillas(m, c);
      return { id: c.id, nombre: c.nombre, color: c.color, era: c.era, eraNombre: M.ERAS[c.era].nombre, regimen: M.REGIMENES[c.regimen], caracter: c.caracter,
        pob: c.pob, estab: c.estab, riqueza: c.riqueza, tierras: cs.length, capacidad: capacidad(m, c, cs), guerras: c.guerras.map(g => civ(m, g.con)).filter(Boolean).map(o => o.nombre), inventos: c.inventos.slice(-4) };
    });
  }

  M.sim = { perderCapital, turnoPorPartes, suceso, W, H, K, TIERRA, TALADO, crear, turno, mejorasDeEdad, reservaMejora, elegirTec, ahorrando, investigar, porPagar, partePagada, pausa, aniosTurno, puedeSubir, empezarSubida, faltaPara, azar, elegir, idx, xy, vecinos, distancia, esTierra, fertil, casillas, capacidad, fuerza, vecinosDe, enGuerra, civ, vivas,
    cronica, subirEra, casusBelli, maxCiudades, motivosLealtad, aliados, aliadosDe, aliar, romper, motivos, opinionObjetivo, tramar, destinoRumbo, gobernante, nombreRey, titulo, nombrePersona, nombre, PRIORIDADES, prio, separar, morir, anticipoEdad, ordenarPor, prestar, perdonar, deudas, declararGuerra, hacerPaz, plaga, nuevoPueblo, nuevaCiv, regimenPorEra, resumen, anioTexto, miles, frontera };
