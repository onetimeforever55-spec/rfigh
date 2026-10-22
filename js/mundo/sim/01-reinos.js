  // ── GÉNESIS · EL MUNDO · Los pueblos, sus gobernantes, alianzas y fronteras ──

  // ---------- Los pueblos ----------
  function nombre(m) {
    const S = M.SILABAS;
    for (let k = 0; k < 20; k++) {
      const n = elegir(m, S.inicio) + (azar(m) < 0.4 ? elegir(m, S.medio) : '') + elegir(m, S.fin);
      if (!m.civs.some(c => c.nombre === n) && n.length <= 11) return n;
    }
    return elegir(m, S.inicio) + m.sig;
  }

  function nuevaCiv(m, capital, datos) {
    const id = m.sig++;
    const usados = new Set(m.civs.filter(c => c.viva).map(c => c.color));
    const color = M.COLORES.find(c => !usados.has(c)) || elegir(m, M.COLORES);
    const c = Object.assign({
      id, nombre: nombre(m), color, capital, caracter: elegir(m, Object.keys(M.CARACTERES)), viva: true,
      pob: 6, riqueza: 10, estab: 60, ciencia: 0, era: 0, regimen: 'tribu', rel: {}, guerras: [], efectos: [], inventos: [],
      fundada: m.anio, ultimaHambre: -99
    }, datos || {});
    m.civs.push(c);
    m.dueno[capital] = id;
    c.rey = c.rey || gobernante(m, c, 20 + Math.floor(azar(m) * 20));
    c.heredero = c.heredero || gobernante(m, c, Math.floor(azar(m) * 15));
    for (const o of m.civs) if (o.id !== id) { o.rel[id] = o.rel[id] || 0; c.rel[o.id] = c.rel[o.id] || 0; }
    return c;
  }

  // ---------- Los gobernantes ----------
  function nombrePersona(m) { const P = M.PERSONAS; return elegir(m, P.inicio) + elegir(m, P.fin); }
  function gobernante(m, c, edad) {
    const rasgos = Object.keys(M.RASGOS).filter(r => r !== 'loco' || azar(m) < 0.15);
    return { nombre: nombrePersona(m), edad, rasgo: elegir(m, rasgos), desde: m.anio };
  }
  // Busca solo claves propias: un rey «constructor» no debe dar con Object.prototype.constructor.
  const propio = (obj, k) => (Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : 0);
  const rasgo = (c, k) => { const r = c.rey && M.RASGOS[c.rey.rasgo]; return r && r[k] != null ? r[k] : (k === 'estab' ? 0 : 1); };
  const titulo = c => M.TITULOS[c.regimen] || 'rey';
  const ordinales = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  function nombreRey(c) { return c.rey ? c.rey.nombre + (ordinales[c.rey.numero || 0] || '') : '—'; }
  // Pasa el tiempo para el gobernante: envejece, muere y le sucede su heredero; si no hay heredero o el
  // reino está revuelto, llega una guerra de sucesión.
  function reinar(m, c, anios) {
    if (!c.rey) { c.rey = gobernante(m, c, 30); c.heredero = gobernante(m, c, 10); }
    c.rey.edad += anios; if (c.heredero) c.heredero.edad += anios;
    const limite = 45 + (c.rey.limite != null ? c.rey.limite : (c.rey.limite = Math.floor(azar(m) * 35)));
    if (c.rey.edad < limite) return;
    const viejo = nombreRey(c), cargo = titulo(c), detalle = anios <= 25;
    // Con turnos de un siglo pasan varios reyes en silencio; las crisis se cuentan cuando el tiempo va más despacio.
    const crisis = anios <= 50 && ((c.estab < 30 && azar(m) < 0.25) || azar(m) < 0.04);
    const sucesor = c.heredero || gobernante(m, c, 25);
    // Si el sucesor se llama como un antepasado, lleva número (Ardan II).
    c.dinastia = c.dinastia || {};
    c.dinastia[sucesor.nombre] = (c.dinastia[sucesor.nombre] || 0) + 1;
    sucesor.numero = c.dinastia[sucesor.nombre] - 1;
    sucesor.desde = m.anio;
    sucesor.limite = Math.max(0, Math.round(sucesor.edad - 45) + 6 + Math.floor(azar(m) * 25));
    c.rey = sucesor; c.heredero = gobernante(m, c, Math.floor(azar(m) * 15));
    if (crisis) {
      c.estab -= 8;
      cronica(m, 'sucesion', 'Guerra de sucesión en ' + c.nombre, 'Muere ' + (cargo === 'rey' ? 'el rey ' : 'el ' + cargo + ' ') + viejo + ' y tres pretendientes reclaman el poder. Gana ' + nombreRey(c) + ', ' + M.RASGOS[c.rey.rasgo].nombre + ', pero el reino queda partido en bandos.', c, null, { importante: true });
      const cs = casillas(m, c);
      // Las provincias solo se separan si el reino ya estaba revuelto (y aun así no siempre).
      // (Con el ritmo rápido de siglos por turno, las crisis rompen reinos como siempre.)
      if (cs.length >= 14 * K && azar(m) < (ritmo(m) <= 1 ? 0.3 : c.estab < 35 ? 0.25 : 0.06)) separar(m, c, cs, 'tras la guerra de sucesión');
    // (Con las partidas pausadas cambian de jefe cada pocos turnos: al jugador se le cuenta de vez en cuando, no siempre.)
    } else if (detalle && ((c.jugador && (ritmo(m) <= 1 || m.turno - (c.sucesionContada || -99) >= 25)) || (!c.jugador && vivas(m).slice().sort((p, q) => q.pob - p.pob).indexOf(c) < 3 && azar(m) < 0.35))) {
      if (c.jugador) c.sucesionContada = m.turno;
      cronica(m, 'sucesion', nombreRey(c) + ' gobierna ' + c.nombre, 'Muere ' + viejo + ' a los ' + Math.round(c.rey.edad) + ' años, más o menos. Le sucede ' + nombreRey(c) + ', de quien dicen que es ' + M.RASGOS[c.rey.rasgo].nombre + '.', c);
    }
  }

  // Buscar un pueblo por su número se hace miles de veces por turno: un índice (que se rehace si cambia la lista).
  const indiceCivs = new WeakMap();
  const civ = (m, id) => {
    let e = indiceCivs.get(m.civs);
    if (!e || e.n !== m.civs.length) { e = { n: m.civs.length, mapa: new Map(m.civs.map(c => [c.id, c])) }; indiceCivs.set(m.civs, e); }
    return e.mapa.get(id);
  };
  const vivas = m => m.civs.filter(c => c.viva);
  const casillas = (m, c) => { const out = []; for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) out.push(i); return out; };
  function capacidad(m, c, cs) {
    let f = 0;
    for (const i of cs || casillas(m, c)) f += fertil(m, i);
    const efecto = c.efectos.reduce((k, e) => k * (e.comida || 1), 1);
    // Las casas y los campos que levantan los aldeanos (vida.js) dan sitio a más gente: una tierra sin
    // obras da un 20 % menos, una tierra bien trabajada, un 20 % más.
    const obras = m.vida ? 0.8 + 0.4 * Math.min(1, ((c.campos || 0) + (c.casas || 0) * 0.5) / ((cs || casillas(m, c)).length * 2.5)) : 1;
    return Math.max(1, f * M.ERAS[c.era].cap * 2.2 / K * efecto * obras);
  }
  function fuerza(m, c, cs) {
    const car = M.CARACTERES[c.caracter];
    return Math.max(0.1, c.pob * M.ERAS[c.era].fuerza * (0.5 + c.estab / 100) * M.mat.pow(car.agresion, 0.4) * (1 + Math.min(1, c.riqueza / 200)) * foco(c, 'fuerza') * rasgo(c, 'fuerza') * (c.guerreros ? 1 + 0.25 * Math.min(1, (c.armados || 0) / Math.max(3, c.guerreros)) : 1));
  }
  function frontera(m, a, b) {
    // Casillas de b que tocan a a.
    const out = [];
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === b.id && vecinos(i).some(v => m.dueno[v] === a.id)) out.push(i);
    return out;
  }
  const vecinosDe = (m, c) => {
    const s = new Set();
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) for (const v of vecinos(i)) { const d = m.dueno[v]; if (d >= 0 && d !== c.id) s.add(d); }
    return [...s].map(id => civ(m, id)).filter(x => x && x.viva);
  };
  const enGuerra = (a, b) => a.guerras.some(g => g.con === b.id);
  // ---------- Las alianzas ----------
  const aliados = (m, a, b) => (m.alianzas || []).some(x => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));
  const aliadosDe = (m, c) => (m.alianzas || []).filter(x => x.a === c.id || x.b === c.id).map(x => civ(m, x.a === c.id ? x.b : x.a)).filter(o => o && o.viva);
  function aliar(m, a, b, texto) {
    if (aliados(m, a, b) || enGuerra(a, b) || a === b) return false;
    m.alianzas = (m.alianzas || []).concat([{ a: a.id, b: b.id, desde: m.anio }]);
    a.rel[b.id] = b.rel[a.id] = Math.max(a.rel[b.id] || 0, 60);
    cronica(m, 'alianza', 'Alianza entre ' + a.nombre + ' y ' + b.nombre, texto || ('Los ' + titulo(a) + 'es de ' + a.nombre + ' y ' + b.nombre + ' juran defenderse el uno al otro. Lo sellan con una boda, un banquete y una lista de enemigos comunes.'), a);
    return true;
  }
  function romper(m, a, b, motivo) {
    if (!aliados(m, a, b)) return;
    m.alianzas = m.alianzas.filter(x => !((x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id)));
    cronica(m, 'alianza', 'Se rompe la alianza entre ' + a.nombre + ' y ' + b.nombre, motivo || 'Los viejos amigos ya no se soportan: se devuelven los regalos y se retiran los embajadores.', a);
  }

  function regimenPorEra(m, c, n) {
    const car = c.caracter;
    n = n / K;
    if (c.era === 0) return n < 6 ? 'tribu' : 'jefatura';
    if (c.era >= 7) return c.estab < 30 ? 'dictadura' : car === 'guerrero' && azar(m) < 0.5 ? 'dictadura' : 'democracia';
    if (c.era === 6) return car === 'mercader' || car === 'sabio' ? 'republica' : n >= 35 ? 'imperio' : 'reino';
    if (car === 'devoto' && c.era <= 4) return 'teocracia';
    if (c.era === 3 && (car === 'mercader' || car === 'sabio') && n < 25) return 'republica';
    return n >= 35 ? 'imperio' : 'reino';
  }
