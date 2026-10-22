  // ── GÉNESIS · EL MANDO · Elegir pueblo, la guía de los primeros pasos y los retos ──

  // ---------- Elegir pueblo ----------
  // En línea: otro jugador toma un pueblo (sin quitárselo a los demás jugadores).
  // Quien toma un reino a mitad de partida no hereda sus tratados: el comercio lo decide él. Se le avisa de con quién
  // comerciaba el reino, por si quiere seguir («abrid una ruta comercial con X»).
  function heredarTratados(m, c) {
    if (c.jugador || !m.vida) return;
    const p = plan(c), antes = new Set(p.socios || []);
    for (const ru of m.vida.rutas || []) if (ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)) antes.add(ru.a === c.id ? ru.b : ru.a);
    p.socios = []; delete p.comercioLibre;
    const nombres = [...antes].map(id => S().civ(m, id)).filter(o => o && o.viva && !S().enGuerra(c, o)).map(o => o.nombre);
    if (nombres.length) (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '🤝 Tu reino comerciaba con ' + nombres.join(', ') + ': para seguir, di «abrid una ruta comercial con ' + nombres[0] + '»' });
  }
  function unirse(m, civId) { const c = S().civ(m, civId); if (c && c.viva) { heredarTratados(m, c); c.jugador = true; plan(c); } return c; }
  function gobernar(m, civId) {
    const c = civId != null ? S().civ(m, civId) : null;
    if (c && c.viva) heredarTratados(m, c);
    for (const x of m.civs) { x.jugador = false; }
    m.jugador = c && c.viva ? c.id : null;
    if (c && c.viva) { c.jugador = true; plan(c); if (!m.retos || m.retos.civ !== c.id) m.retos = { civ: c.id, hechos: {}, puntos: 0, conquistas: 0, desde: m.turno }; }
    return c;
  }

  // ---------- Los primeros pasos: una guía corta para quien empieza a gobernar ----------
  // Cada paso se comprueba solo; los que el pueblo ya cumple por su cuenta se saltan. Al acabar, se apaga.
  const GUIA = [
    { id: 'ficha', texto: 'Toca tu tierra o una casa de tu pueblo en el mapa para ver quién vive ahí y qué le falta.', boton: 'Ver mi pueblo', accion: 'ficha', hecho: m => !!m.guia.vioFicha },
    { id: 'orden', texto: 'Escribe tu primera orden abajo, como hablarías. Por ejemplo, pide casas: con camas nacen más niños.', boton: 'Haced 3 casas', accion: 'orden', hecho: m => (m.guia.ordenes || 0) > 0 },
    { id: 'comida', texto: 'Sin molino no hay tierra de cultivo. Que levanten un molino y siembren al menos 3 campos.', boton: 'Más comida', accion: 'orden', hecho: (m, c) => (c.molinos || 0) > 0 && (c.campos || 0) >= 3 },
    { id: 'corte', texto: 'Abre la corte (🏛 a la derecha, o toca tu plaza): ahí eliges qué investigan tus sabios.', boton: 'Abrir la corte', accion: 'corte', hecho: m => !!m.guia.corte },
    { id: 'mejoras', texto: 'Para pasar de edad hacen falta 3 mejoras de la edad actual. Elígelas en la corte y paga lo que piden.', boton: 'Abrir la corte', accion: 'corte', hecho: (m, c) => c.era > 0 || S().mejorasDeEdad(c).hechas >= S().mejorasDeEdad(c).pide },
    { id: 'edad', texto: 'Ya casi: cuando tengas el saber y lo que pide la edad, pulsa «Avanzar» en la corte para llegar a la Edad del Bronce.', boton: 'Abrir la corte', accion: 'corte', hecho: (m, c) => c.era > 0 }
  ];
  // El paso que toca ahora (o null si la guía terminó, se ocultó o no se gobierna ningún pueblo).
  function guia(m) {
    const c = m.jugador != null ? S().civ(m, m.jugador) : null;
    if (!c || !c.viva || m.modo !== 'pueblo') return null;
    const g = m.guia = m.guia || {};
    if (g.oculta || g.fin) return null;
    const i = GUIA.findIndex(x => !x.hecho(m, c));
    if (i < 0) { g.fin = m.anio; return null; }
    return Object.assign({ n: i + 1, de: GUIA.length }, GUIA[i]);
  }

  // ---------- Los retos del modo pueblo: metas con puntos, y el fin de la partida ----------
  const ciudadesDe = (m, c) => (m.ciudades || []).filter(x => x.civ === c.id).length;
  const RETOS = [
    { id: 'gente30', nombre: 'Una aldea de verdad', texto: 'Llega a 30 aldeanos.', puntos: 100, prog: (m, c) => [c.habitantes || 0, 30] },
    { id: 'bronce', nombre: 'La Edad del Bronce', texto: 'Entra en la Edad del Bronce.', puntos: 100, prog: (m, c) => [c.era, 1] },
    { id: 'ciudad', nombre: 'Tu primera ciudad', texto: 'Que tus colonos funden una ciudad.', puntos: 150, prog: (m, c) => [ciudadesDe(m, c), 1] },
    { id: 'granero', nombre: 'Graneros llenos', texto: 'Junta 100 de comida en el granero.', puntos: 100, prog: (m, c) => [Math.floor(c.comida || 0), 100] },
    { id: 'medieval', nombre: 'Fase medieval', texto: 'Llega a la Edad del Hierro.', puntos: 200, prog: (m, c) => [c.era, 2] },
    { id: 'castillo', nombre: 'Un castillo', texto: 'Levanta un castillo en tu frontera («construid un castillo»).', puntos: 200, prog: (m, c) => [c.castillos || 0, 1] },
    { id: 'conquista', nombre: 'Conquistador', texto: 'Toma una ciudad o una capital enemiga.', puntos: 300, prog: m => [m.retos.conquistas || 0, 1] },
    { id: 'gente100', nombre: 'Una gran ciudad', texto: 'Llega a 100 aldeanos.', puntos: 250, prog: (m, c) => [c.habitantes || 0, 100] },
    { id: 'tierras40', nombre: 'Un reino grande', texto: 'Gobierna 40 tierras.', puntos: 300, prog: (m, c) => [S().casillas(m, c).length, 40] },
    { id: 'polvora', nombre: 'La pólvora', texto: 'Llega al Renacimiento.', puntos: 300, prog: (m, c) => [c.era, 5] },
    { id: 'primero', nombre: 'A la cabeza del mundo', texto: 'Sé el pueblo con más tierras.', puntos: 400, prog: (m, c) => [S().vivas(m).every(o => o === c || S().casillas(m, o).length < S().casillas(m, c).length) ? 1 : 0, 1] },
    { id: 'moderna', nombre: 'La última fase', texto: 'Llega a la Era Moderna.', puntos: 500, prog: (m, c) => [c.era, 7] },
    { id: 'sobrevivir', nombre: 'Hasta el final', texto: 'Que tu pueblo siga en pie al terminar la partida.', puntos: 500, prog: (m, c) => [c.viva && finPartida(m) ? 1 : 0, 1] }
  ];
  // La partida termina en 1945 (o a los 400 años en el mundo libre).
  const finPartida = m => (m.libre ? m.anio >= 400 : m.anio >= 1945);
  // Comprueba los retos tras un turno; devuelve los que se acaban de cumplir.
  function evaluarRetos(m, nuevos) {
    const r = m.retos, c = r ? S().civ(m, r.civ) : null;
    if (!r || !c) return [];
    for (const e of nuevos || []) if (e.tipo === 'conquista' && e.civ === c.id) r.conquistas = (r.conquistas || 0) + 1;
    const cumplidos = [];
    if (!c.viva) return cumplidos;
    // La historia de tu pueblo, para contarla al final: cuándo llegó a cada era, su mayor tamaño, sus guerras y sus reyes.
    const h = r.hist = r.hist || { eras: {}, maxHab: 0, maxTierras: 0, enemigos: [], reyes: [], ciudades: 0, desde: m.anio };
    if (h.eras[c.era] == null) h.eras[c.era] = m.anio;
    h.maxHab = Math.max(h.maxHab, c.habitantes || 0); h.maxTierras = Math.max(h.maxTierras, S().casillas(m, c).length);
    h.ciudades = Math.max(h.ciudades, ciudadesDe(m, c));
    for (const g of c.guerras) { const o = S().civ(m, g.con); if (o && !h.enemigos.includes(o.nombre)) h.enemigos.push(o.nombre); }
    const rey = S().nombreRey ? S().nombreRey(c) : null;
    if (rey && rey !== '—' && h.reyes[h.reyes.length - 1] !== rey) { h.reyes.push(rey); if (h.reyes.length > 12) h.reyes.splice(1, 1); }
    for (const x of RETOS) {
      if (r.hechos[x.id] != null) continue;
      const [v, meta] = x.prog(m, c);
      if (v >= meta) { r.hechos[x.id] = m.anio; r.puntos += x.puntos; cumplidos.push(x); }
    }
    return cumplidos;
  }
  function estadoRetos(m) {
    const r = m.retos, c = r ? S().civ(m, r.civ) : null;
    if (!r || !c) return null;
    const lista = RETOS.map(x => { const [v, meta] = c.viva ? x.prog(m, c) : [0, 1]; return { id: x.id, nombre: x.nombre, texto: x.texto, puntos: x.puntos, hecho: r.hechos[x.id] != null, cuando: r.hechos[x.id], avance: Math.max(0, Math.min(1, v / meta)), v, meta }; });
    // La puntuación final suma los retos, la gente y la tierra que tengas.
    const extra = c.viva ? (c.habitantes || 0) + S().casillas(m, c).length * 5 : 0;
    const puesto = c.viva ? S().vivas(m).slice().sort((a, b) => S().casillas(m, b).length - S().casillas(m, a).length).indexOf(c) + 1 : null;
    return { civ: c, lista, puntos: r.puntos, extra, total: r.puntos + extra, hechos: lista.filter(x => x.hecho).length, fin: finPartida(m), puesto, hist: r.hist || null, conquistas: r.conquistas || 0 };
  }

  M.mando = { unirse, GUIA, guia, vencer, queda, textoPlazo, cuentaOficios, OFICIOS_N, entender, aplicar, ordenar, informe, consejo, gobernar, RETOS, evaluarRetos, estadoRetos, finPartida, SISTEMA, paraIA, aplicarIA, limpiar, NOMBRE_RECURSO, NIVEL };
