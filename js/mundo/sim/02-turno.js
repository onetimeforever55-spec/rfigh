  // ── GÉNESIS · EL MUNDO · La crónica, crear el mundo y el turno de cada reino ──

  // ---------- La crónica ----------
  function cronica(m, tipo, titulo, texto, c, casilla, extra) {
    const opciones = M.PORQUES[tipo] || M.PORQUES[tipo.split('_')[0]] || [];
    const p = opciones.length ? elegir(m, opciones) : null;
    // Lo mismo dos veces en el mismo turno (dos colonias del mismo reino) se cuenta una sola vez.
    const igual = m.cronica.slice(0, 12).find(x => x.turno === m.turno && x.titulo === titulo);
    if (igual) return igual;
    const e = Object.assign({ anio: m.anio, turno: m.turno, tipo, titulo, texto, porque: p ? p[0] : null, precedente: p ? p[1] : null, civ: c ? c.id : null, color: c ? c.color : null, casilla: casilla == null ? (c ? c.capital : null) : casilla }, extra || {});
    m.cronica.unshift(e);
    if (m.cronica.length > 250) m.cronica.length = 250;
    m.ultimo = e;
    return e;
  }

  function anioTexto(a) {
    const n = Math.abs(Math.round(a));
    const s = n >= 10000 ? n.toLocaleString('es-ES') : n >= 1000 ? String(n).replace(/(\d)(\d{3})$/, '$1.$2') : String(n);
    return a < 0 ? s + ' a. C.' : s;
  }

  // ---------- Crear un mundo ----------
  function crear(semilla, numPueblos, opciones) {
    const libre = !!(opciones && opciones.libre);
    const m = { version: 1, semilla: semilla >>> 0, rng: semilla >>> 0, W, H, anio: libre ? 1 : -4000, libre, ritmo: (opciones && opciones.ritmo) || 1, turno: 0, civs: [], sig: 0, cronica: [], dueno: new Array(W * H).fill(-1) };
    generarMapa(m);
    // Los primeros pueblos, en tierras fértiles y lejos unos de otros (mejor junto a un río).
    const candidatas = [];
    for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.tipo[i] !== 'nieve' && fertil(m, i) >= 3) candidatas.push(i);
    ordenarPor(candidatas, i => -fertil(m, i) + azar(m) * 0.7);
    // Lejos unos de otros; con muchos pueblos (hasta 10), se acepta que nazcan algo más cerca.
    const elegidas = [];
    for (const sep of [12, 10, 8, 6]) {
      for (const i of candidatas) {
        if (elegidas.length >= (numPueblos || 5)) break;
        if (!elegidas.includes(i) && elegidas.every(j => distancia(i, j) >= sep)) elegidas.push(i);
      }
      if (elegidas.length >= (numPueblos || 5)) break;
    }
    for (const cap of elegidas) {
      const c = nuevaCiv(m, cap);
      for (const v of vecinos(cap)) if (esTierra(m, v) && m.dueno[v] < 0 && azar(m) < 0.7) m.dueno[v] = c.id;
      cronica(m, 'fundacion', 'Nace ' + c.nombre, 'Un pueblo ' + c.caracter + ' se asienta ' + (m.rio[cap] ? 'junto a un río' : 'en una llanura fértil') + ' y empieza a sembrar. Lo llamarán ' + c.nombre + '.', c);
    }
    // Los aldeanos, los árboles y las casas (vida.js), si está cargada.
    if (M.vida) M.vida.crear(m);
    return m;
  }

  // ---------- Un turno del mundo ----------
  function turno(m) { const gen = turnoPorPartes(m); while (!gen.next().done); return m; }
  // El mismo turno, por partes: cede el control entre trozo y trozo (para repartirlo entre fotogramas).
  function* turnoPorPartes(m) {
    m.turno++;
    if (m.vida && M.vida && M.vida.turnoPorPasos) yield* M.vida.turnoPorPasos(m); else if (m.vida && M.vida) M.vida.turno(m);
    yield;
    const lista = vivas(m);
    for (const c of lista) vivir(m, c);
    diplomacia(m);
    pagarCreditos(m);
    for (const c of vivas(m)) guerras(m, c);
    lealtades(m);
    sucesosNaturales(m);
    for (const c of vivas(m)) c.efectos = c.efectos.filter(e => e.hasta > m.turno);
    const maxEra = Math.max(0, ...vivas(m).map(c => c.era));
    // En el mundo libre (como WorldBox) los años pasan de uno en uno; en la historia real, al ritmo de cada era.
    const anios = aniosTurno(m); void maxEra;
    for (const c of vivas(m)) reinar(m, c, anios);
    m.anio += anios;
    // Al cerrar el turno, todo en orden: quien perdió su capital en una conquista de este turno se muda a su
    // mejor tierra (o cae si no le queda ninguna), y los aldeanos de pueblos que ya no existen pasan al dueño
    // de la tierra donde viven (o se dispersan si nadie la gobierna).
    for (const c of vivas(m)) {
      if (m.dueno[c.capital] === c.id) continue;
      perderCapital(m, c, casillas(m, c));
    }
    if (m.vida && M.vida) {
      const vivos = new Set(vivas(m).map(c => c.id));
      m.vida.aldeanos = m.vida.aldeanos.filter(a => {
        if (vivos.has(a.c)) return true;
        const d = m.dueno[a.h], muerta = civ(m, a.c);
        // Los supervivientes de un pueblo exterminado no se quedan a vivir con su verdugo.
        if (muerta && muerta.exterminadoPor != null && muerta.exterminadoPor === d) return false;
        if (d >= 0 && vivos.has(d)) { a.c = d; a.llego = m.turno; a.o = 1; a.e = 0; a.colono = null; a.arma = 0; a.armadura = 0; a.tirador = null; return true; }
        return false;
      });
      // Los pueblos nacidos en este turno (una rebelión, uno nuevo) quedan contados ya: casas, camas, gente.
      if (vivas(m).some(c => c.camas == null)) M.vida.contar(m);
    }
    return m;
  }

  function vivir(m, c) {
    const cs = casillas(m, c);
    if (!cs.length) { morir(m, c, null); return; }
    if (m.dueno[c.capital] !== c.id) { perderCapital(m, c, cs); if (!c.viva) return; }
    const n = cs.length, car = M.CARACTERES[c.caracter];
    const cap = capacidad(m, c, cs);
    c.cap = cap;
    // La gente crece mientras haya comida; si se pasa, llega el hambre. (Con aldeanos, vida.js, la población
    // son ellos: nacen, comen y mueren allí.)
    if (!(m.vida && M.vida)) c.pob += c.pob * 0.14 * (1 - c.pob / cap);
    if (!(m.vida && M.vida) && c.pob > cap * 1.05) {
      // Lo que queda en los graneros (las cosechas de los granjeros, vida.js) amortigua el hambre.
      const granero = Math.min(0.4, (c.comida || 0) / 40);
      if (c.comida) c.comida = Math.max(0, c.comida - 10);
      const muertos = (c.pob - cap) * 0.6 * (1 - granero);
      c.pob -= muertos; c.estab -= 6;
      if (m.turno - c.ultimaHambre > 6 && muertos > 1) {
        c.ultimaHambre = m.turno;
        cronica(m, 'hambruna', 'Hambre en ' + c.nombre, 'Hay más bocas que cosechas. Mueren unos ' + miles(muertos) + ' y los graneros del templo se vacían.', c);
      }
    }
    c.pob = Math.max(0.5, c.pob);
    const vec = vecinosDe(m, c);
    const enPaz = vec.filter(v => !enGuerra(c, v));
    // Riqueza: la tierra, el comercio con los vecinos en paz y la caja que se gasta.
    c.riqueza = c.riqueza * 0.93 + n * 0.4 * (c.era + 1) + enPaz.filter(v => (c.rel[v.id] || 0) > 10).length * 2 * car.comercio;
    c.riqueza *= 1 + (foco(c, 'riqueza') * rasgo(c, 'riqueza') - 1) * 0.1;
    // Ciencia: gente, estabilidad, carácter, y los inventos que se copian de vecinos más avanzados.
    const copia = enPaz.reduce((k, v) => k + Math.max(0, v.era - c.era) * 3, 0)
      // Las ideas viajan lejos: algo llega siempre del pueblo más avanzado del mundo.
      + Math.max(0, Math.max(...vivas(m).map(o => o.era)) - c.era) * 2
      // Las ciudades y las rutas comerciales son donde se juntan sabios, libros y noticias.
      + ((m.ciudades || []).filter(x => x.civ === c.id).length * 1.2 + (c.rutas || 0) * 1.5);
    // Cada era acelera la siguiente: la escritura, la imprenta y la ciencia se apoyan unas en otras.
    // Con el ritmo pausado (partidas nuevas), la técnica avanza más despacio por turno: hay tiempo de vivir cada era.
    // Con aldeanos, buena parte del saber lo traen los eruditos (chamanes, filósofos, monjes, científicos) que
    // estudian en el templo o en la plaza (vida.js, c.saber); el resto, la gente y lo que llega de fuera.
    const deLaGente = m.vida && M.vida ? 0.9 : 1, eruditos = m.vida && M.vida ? (c.saber || 0) : 0; c.saber = 0;
    // El saber del pueblo (lo que cuenta para pasar de era) sale de todo; las mejoras las investigan sobre todo los
    // sabios: sin ellos, la técnica apenas avanza (lo que llega de la gente y de fuera, una tercera parte).
    const mult = (1 + M.tec(c, 'ciencia')) * pausa(m), resto = deLaGente * (Math.sqrt(c.pob) * 0.62 * car.ciencia * (0.4 + c.estab / 100) * (1 + 0.1 * enPaz.length) * (1 + c.era * 0.18) * foco(c, 'ciencia') * rasgo(c, 'ciencia') + copia);
    const ganancia = (resto + eruditos) * mult;
    c.cienciaTurno = ganancia; c.tecTurno = (m.vida && M.vida ? resto * 0.35 + eruditos * 2.2 : resto + eruditos) * mult;
    c.ciencia += ganancia;
    investigar(m, c, c.tecTurno);
    // Subir de edad (como en Age of Empires): cuando se cumple todo, la IA empieza sola; el jugador lo ordena.
    if (c.subiendo) {
      const su = c.subiendo;
      if (su.debe) {
        // Se paga lo que toca este turno (lo que falta, repartido en los turnos que quedan); si no llega, el paso espera.
        const quedan = Math.max(1, su.hasta - m.turno);
        let falta = false;
        for (const k of Object.keys(su.debe)) {
          const q = Math.min(su.debe[k], Math.ceil(su.debe[k] / quedan));
          if (disponible(m, c, k) >= q) { c[k] -= q; su.debe[k] -= q; if (su.debe[k] <= 0) delete su.debe[k]; } else falta = true;
        }
        if (!Object.keys(su.debe).length) delete su.debe;
        if (falta) { su.hasta++; su.espera = (su.espera || 0) + 1; }
      }
      if (!su.debe && m.turno >= su.hasta) { c.subiendo = null; subirEra(m, c, null); }
    }
    else if (M.ERAS[c.era + 1] && (!c.jugador || (c.plan && c.plan.autoEdad)) && puedeSubir(m, c).ok) empezarSubida(m, c);
    tesoro(m, c);
    // Estabilidad: el carácter, el tamaño (sobreextensión), las guerras, el hambre y el desorden heredado.
    const objetivo = 62 + car.estab - Math.max(0, n / K - 22) * 0.7 - c.guerras.length * 5 - (c.pob > cap * 0.98 ? 6 : 0) + (c.riqueza > 60 ? 4 : 0) + rasgo(c, 'estab') * 0.5 + Math.min(6, (c.templos || 0) * 2) + M.tec(c, 'estab') + (c.bienestar || 0) + (c.oro < 0 ? -6 : 0) - ((c.plan && c.plan.impuesto) || 1) * 16 + 16 + c.efectos.reduce((k, e) => k + (e.estab || 0), 0);
    c.estab += (objetivo - c.estab) * 0.12 + (azar(m) - 0.5) * 4;
    c.estab = Math.max(0, Math.min(100, c.estab));
    // Expansión hacia tierra libre cuando sobran brazos.
    const pe = prio(c, 'expansion');
    if (pe > 0 && c.pob > cap * (0.65 - 0.1 * pe) && !(c.plan && c.plan.expandir === false)) {
      const libres = new Set();
      // Con aldeanos (vida.js), el reino solo se extiende junto a regiones donde ya vive gente.
      const poblada = m.vida && m.vida.poblada;
      for (const i of cs) if (!poblada || poblada[i]) for (const v of vecinos(i)) if (esTierra(m, v) && m.dueno[v] < 0) libres.add(v);
      // Desde el Renacimiento, también al otro lado del mar.
      if (c.era >= 5 && !libres.size) for (let i = 0; i < W * H; i++) if (esTierra(m, i) && m.dueno[i] < 0 && vecinos(i).some(v => m.tipo[v] === 'costa') && cs.some(j => distancia(i, j) <= 13)) libres.add(i);
      // Un jugador puede marcar un rumbo: hacia un punto cardinal o hacia otro pueblo.
      const rumbo = c.plan && c.plan.rumbo != null ? destinoRumbo(m, c, c.plan.rumbo) : null;
      const tiron = i => (rumbo == null ? 0 : distancia(i, rumbo) * 0.6);
      const orden = ordenarPor([...libres], i => -fertil(m, i) + distancia(i, c.capital) * 0.15 + tiron(i));
      // Expandirse cuesta madera (o piedra) cuando hay aldeanos que la traen (vida.js).
      const vida = m.vida && M.vida;
      const cuantas = Math.min((c.era >= 3 ? 4 : 2) + (pe >= 2 ? 1 : 0), vida ? vida.tierrasPagables(m, c) : 99);
      for (const i of orden.slice(0, cuantas)) {
        m.dueno[i] = c.id;
        if (vida) vida.pagarTierra(m, c);
        const ultramar = !cs.some(j => vecinos(i).includes(j));
        if (ultramar && !(c.ultramarDesde > m.turno - 8) && (c.ultramarDesde = m.turno)) cronica(m, 'expansion', c.nombre + ' cruza el mar', 'Sus barcos fundan una colonia en tierras lejanas. Los que ya vivían allí no han sido consultados.', c, i);
        else if (azar(m) < 0.05) cronica(m, 'expansion', c.nombre + ' se extiende', 'Los colonos de ' + c.nombre + ' talan, siembran y levantan aldeas nuevas. Ya ocupan ' + (cs.length + 1) + ' tierras.', c, i);
      }
    }
    // Revuelta: las provincias lejanas de un reino grande e inestable se separan.
    // (Las provincias ya no se separan al azar: se rebelan sus ciudades cuando pierden la lealtad; ver lealtades.)
    if (c.estab < 8 && azar(m) < 0.25) {
      const perdidas = cs.filter(i => i !== c.capital && azar(m) < 0.3);
      for (const i of perdidas) m.dueno[i] = -1;
      if (perdidas.length) cronica(m, 'caida', 'Desorden en ' + c.nombre, 'Nadie obedece a nadie. ' + perdidas.length + ' comarcas quedan abandonadas y los caminos se llenan de bandidos.', c);
    }
  }

  // El punto hacia el que tira la expansión: un borde del mapa o la capital de otro pueblo.
  function destinoRumbo(m, c, rumbo) {
    const [x, y] = xy(c.capital);
    if (rumbo === 'norte') return idx(x, 0);
    if (rumbo === 'sur') return idx(x, H - 1);
    if (rumbo === 'este') return idx(W - 1, y);
    if (rumbo === 'oeste') return idx(0, y);
    const o = civ(m, rumbo);
    return o && o.viva ? o.capital : null;
  }
