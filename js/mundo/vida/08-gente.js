  // ── GÉNESIS · LA VIDA · Cada aldeano es un agente: casas, salud, nacer, oficios y equipo ──

  /*
   * CADA ALDEANO ES UN AGENTE, como en WorldBox: tiene nombre, familia, edad, rasgos, casa e historia.
   * La población del pueblo son sus aldeanos: nacen de otros aldeanos (si hay cama, comida y tierra que los
   * sostenga) y mueren de viejos, de hambre, de peste, en la guerra o en el mar. El motor del reino lee su
   * población de ellos (cada aldeano cuenta por una familia grande: ver escala).
   */
  const RASGOS_ALDEANO = ['fuerte', 'rápido', 'sabio', 'perezoso', 'valiente', 'torpe', 'longevo', 'fértil'];
  const escala = c => 1.2 * (1 + 0.15 * c.era);
  const tiene = (a, r) => !!(a.rasgos && a.rasgos.includes(r));
  const APELLIDOS = ['ez', 'ar', 'in', 'os', 'ani', 'ov', 'eda', 'ur'];
  /*
   * LA SALUD DE CADA ALDEANO (partidas pausadas): la probabilidad de morir cada año sale de su edad (cada vez
   * mayor, como en la vida real) multiplicada por cómo ha vivido:
   *  · hambre: cada temporada mal comida deja huella (se va borrando si después come bien);
   *  · heridas de guerra que no terminan de curar;
   *  · vivir sin casa, un oficio duro (mina, guerra), un ánimo por los suelos, un invierno sin leña;
   *  · y a favor: un hospital, las técnicas de salud (vacunas…), la edad de su reino, ser longevo o fuerte.
   */
  function salud(m, a, c) {
    const v = m.vida, motivos = [];
    let f = 1;
    const pon = (k, txt) => { f *= k; motivos.push([k, txt]); };
    const desn = a.desnutricion || 0;
    if (desn >= 1) pon(1 + Math.min(1.5, desn * 0.12), desn >= 6 ? 'ha pasado mucha hambre' : 'ha pasado hambre');
    if ((a.heridas || 0) >= 1) pon(1 + Math.min(1, a.heridas * 0.12), a.heridas >= 3 ? 'muchas heridas de guerra' : 'heridas de guerra');
    if (a.casa == null || ![OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento].includes(v.obra[a.casa])) pon(1.3, 'vive sin casa');
    else if (v.obra[a.casa] === OBRA.campamento) pon(1.15, 'vive en una tienda');
    if (a.o === MINERO && !esNino(a)) pon(1.2, 'trabajo duro en la mina');
    if (a.o === GUERRERO && !esNino(a)) pon(1.12, 'vida de soldado');
    if (a.o === ERUDITO && !esNino(a)) pon(0.9, 'vida tranquila de estudio');
    if (c) {
      const animo = animoDe(m, a);
      if (animo < 30) pon(1.25, 'está harto de la vida');
      else if (animo > 75) pon(0.9, 'es feliz');
      if (v.estacion === 3 && (c.madera || 0) < 3) pon(1.35, 'invierno sin leña');
      // El humo: cada fábrica y cada central encendidas ensucian el aire de la ciudad; los parques lo limpian.
      const humo = contaminacion(c);
      if (humo >= 0.05) pon(1 + humo, humo >= 0.3 ? 'el aire sucio de las fábricas' : 'algo de humo de las fábricas');
      if (c.hospitales > 0) pon(0.7, 'hay hospital');
      const tec = M.tec(c, 'vida'); if (tec > 0) pon(Math.max(0.6, 1 - tec / 40), 'medicina de su época');
    }
    if (tiene(a, 'longevo')) pon(0.6, 'es longevo');
    if (tiene(a, 'fuerte')) pon(0.85, 'es fuerte');
    return { f, motivos };
  }
  function riesgoAnual(m, a, c) {
    const anos = M.vida.anos(a), era = c ? c.era : 0, s_ = salud(m, a, c);
    // Mortalidad de Gompertz: muy baja de joven, se dobla cada ~8 años de vejez; mejora con las edades.
    const base = anos < 5 ? 0.012 * Math.max(0.3, 1 - 0.09 * era) : 0.0003 * Math.max(0.35, 1 - 0.07 * era) * M.mat.exp(0.08 * anos);
    return { p: Math.min(0.9, base * s_.f), salud: s_, anos };
  }
  // Lo que queda escrito de quien muere (para la ficha de sus hijos y de su casa).
  function recordarMuerte(m, a, c) {
    const v = m.vida;
    (v.difuntos = v.difuntos || {})[a.id] = { nombre: a.nombre + ' ' + (a.familia || ''), anos: Math.round(M.vida.anos(a)), anio: m.anio, causa: a.causa || 'vejez' };
    const ids = Object.keys(v.difuntos); if (ids.length > 400) delete v.difuntos[ids[0]];
  }
  function nuevoAldeano(m, c, casa, edad, padre) {
    const v = m.vida, rasgos = [];
    if (azar(v) < 0.6) rasgos.push(RASGOS_ALDEANO[Math.floor(azar(v) * RASGOS_ALDEANO.length)]);
    if (azar(v) < 0.2) { const r = RASGOS_ALDEANO[Math.floor(azar(v) * RASGOS_ALDEANO.length)]; if (!rasgos.includes(r)) rasgos.push(r); }
    // Los hijos heredan a veces un rasgo de su padre o su madre.
    if (padre && padre.rasgos && padre.rasgos.length && azar(v) < 0.35 && !rasgos.includes(padre.rasgos[0])) rasgos.push(padre.rasgos[0]);
    const familia = padre ? padre.familia : M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + APELLIDOS[Math.floor(azar(v) * APELLIDOS.length)];
    // La otra mitad de la pareja: si el padre no tiene, la encuentra entre los adultos solteros de su pueblo.
    let pareja = null;
    if (padre) {
      pareja = padre.pareja != null ? v.aldeanos.find(b => b.id === padre.pareja) : null;
      if (!pareja) {
        // Nada de casarse con la familia: se busca a alguien de otro apellido (si no hay, de cualquiera que no sea pariente cercano).
        const candidatos = v.aldeanos.filter(b => b !== padre && b.c === padre.c && b.pareja == null && (b.edad || 0) >= ADULTO && (b.edad || 0) < VIEJO && b.padre !== padre.id && b.madre !== padre.id && padre.padre !== b.id && padre.madre !== b.id && !(b.padre != null && b.padre === padre.padre));
        // Primero alguien de otra familia del mismo pueblo; si no, de otra familia de otro pueblo del reino (y se muda);
        // solo si no queda nadie más, de la misma familia.
        const aqui = candidatos.filter(b => b.h === padre.h && b.familia !== padre.familia), fuera = candidatos.filter(b => b.h !== padre.h && b.familia !== padre.familia);
        const libres = aqui.length ? aqui : fuera.length ? fuera : candidatos.filter(b => b.h === padre.h);
        pareja = libres.length ? libres[Math.floor(azar(v) * libres.length)] : null;
        if (pareja && pareja.h !== padre.h) { pareja.h = padre.h; pareja.casa = padre.casa; }
        if (pareja) { padre.pareja = pareja.id; pareja.pareja = padre.id; padre.parejaNombre = pareja.nombre + ' ' + (pareja.familia || ''); pareja.parejaNombre = padre.nombre + ' ' + (padre.familia || ''); }
      }
    }
    const a = { id: v.sig++, c: c.id, o: GRANJERO, x: casa % v.tw, y: casa / v.tw | 0, h: region(m, casa), casa, e: LIBRE, tx: -1, ty: -1, t: 0, k: 0, q: 0, r: [], edad,
      nombre: persona(v), familia, rasgos, hijos: 0, bajas: 0, hambre: 0, padre: padre ? padre.id : null, madre: pareja ? pareja.id : null,
      padres: padre ? [padre.nombre + ' ' + (padre.familia || ''), pareja ? pareja.nombre + ' ' + (pareja.familia || '') : null] : null, nacio: m.anio, eraNacio: c.era, nacioEn: padre ? lugarDe(m, casa) : null };
    if (padre) padre.hijos = (padre.hijos || 0) + 1;
    if (pareja) pareja.hijos = (pareja.hijos || 0) + 1;
    v.aldeanos.push(a);
    return a;
  }

  function sincronizar(m, recursosDe, soloQuitar) {
    const v = m.vida, vivas = S().vivas(m), porCiv = {};
    v.aldeanos = v.aldeanos.filter(a => { const c = S().civ(m, a.c); return c && c.viva; });
    // Los que viven en tierra que cambia de dueño (conquista, rebelión) pasan a ser de ese pueblo.
    for (const a of v.aldeanos) {
      const d = m.dueno[a.h];
      if (d >= 0 && d !== a.c && a.colono == null) { const o = S().civ(m, d); if (o && o.viva) { a.c = d; a.llego = m.turno; delete a.fijo; delete a.veh; a.o = GRANJERO; a.e = LIBRE; a.k = 0; a.arma = 0; a.armadura = 0; a.tirador = null; } }
    }
    for (const c of vivas) porCiv[c.id] = [];
    for (const a of v.aldeanos) if (porCiv[a.c]) porCiv[a.c].push(a);
    const quitar = new Set();
    let total = v.aldeanos.length;
    for (const c of vivas) {
      const cs = S().casillas(m, c), lista = porCiv[c.id];
      for (const a of lista) if (m.dueno[a.h] !== c.id && a.colono == null) a.h = hogar(m, c, cs);
      if (pausada(m) && !soloQuitar && m.turno % 3 === c.id % 3) mudanza(m, c, lista);
      // Lo que el resto del mundo le hizo a la población desde el último turno (una peste, una batalla perdida,
      // un milagro) se cumple en los aldeanos: mueren los más viejos, o llegan familias nuevas.
      let objetivo = c.pobVida ? Math.round(lista.length * c.pob / c.pobVida) : Math.max(lista.length, 6);
      // Un pueblo que sigue en pie nunca se queda sin nadie: vuelven unas familias de las aldeas de alrededor.
      if (objetivo < 2 && !soloQuitar) objetivo = Math.max(objetivo, lista.length ? 2 : 3);
      if (objetivo < lista.length) {
        const tipo = c.guerras.length ? 'batalla' : 'vejez';
        // (Los que van embarcados y los colonos que van a fundar, los últimos: las bajas caen antes entre los de casa.)
        const lejos = a => (a.aBordo != null || a.colono != null || a.emp || a.veh) ? 1 : 0;
        for (const a of lista.slice().sort((x, y) => (lejos(x) - lejos(y)) || (y.edad || 0) - (x.edad || 0)).slice(0, lista.length - Math.max(1, objetivo))) { quitar.add(a); v.muertos.push([a.x, a.y, a.c, tipo, 0]); }
      } else if (objetivo > lista.length) {
        // Los que llegan también necesitan cama (salvo un pueblo que casi no tiene a nadie).
        objetivo = Math.max(Math.min(objetivo, (c.camas || 6) + 5), Math.min(objetivo, 6));
        const casas = casasDe(m, c);
        for (let k = lista.length; k < Math.min(objetivo, lista.length + 30); k++) {
          const casa = casas.length ? casas[Math.floor(azar(v) * casas.length)] : centro(m, hogar(m, c, cs));
          lista.push(nuevoAldeano(m, c, casa, ADULTO + Math.floor(azar(v) * 10), null)); total++;
        }
      }
      if (soloQuitar) continue;
      // Mueren de viejos los que llegan al final de su vida (si el pueblo no se queda sin nadie).
      if (pausada(m)) {
        // En las partidas pausadas no hay edad fija: cada año hay una probabilidad de morir que crece con la edad
        // y con cómo ha vivido cada uno (ver salud()).
        let quedan = lista.filter(x => !quitar.has(x)).length;
        for (const a of lista) {
          const anos = M.vida.anos(a), antes = a.anosVistos != null ? a.anosVistos : anos;
          a.anosVistos = anos;
          const dy = Math.max(0, anos - antes);
          if (!dy || quitar.has(a) || quedan <= 2) continue;
          // (Los colonos de viaje van en grupo y bien provistos: no los mata dormir al raso.)
          const p = 1 - M.mat.pow(1 - riesgoAnual(m, a, c).p * (a.colono != null ? 0.25 : 1), dy);
          if (azar(v) < p) { quitar.add(a); quedan--; a.causa = anos >= 55 ? 'vejez' : esNino(a) ? 'enfermedad de niño' : 'enfermedad'; v.muertos.push([a.x, a.y, a.c, anos >= 55 ? 'vejez' : 'enfermedad', 0]); recordarMuerte(m, a, c); }
        }
      } else {
        const hosp = 0;
        for (const a of lista) if (!quitar.has(a) && (a.edad || 0) > limiteVida(a) + hosp && lista.length - quitar.size > 2) { quitar.add(a); v.muertos.push([a.x, a.y, a.c, 'vejez', 0]); }
      }
      // Nacen bebés de los adultos, si hay cama libre, comida en el granero y tierra que los sostenga.
      const vivos = lista.filter(a => !quitar.has(a));
      const camasLibres = Math.max(0, (c.camas || 6) - vivos.length);
      const tierra = !c.cap || vivos.length * escala(c) < c.cap * 1.05;
      const comida = (c.comida || 0) > vivos.length * 0.2 || vivos.length < 8;
      c.sinCama = 0;
      // Un pueblo de viejos, sin nadie en edad de tener hijos, recibe parejas jóvenes de las aldeas de alrededor.
      const fertiles = vivos.filter(a => (a.edad || 0) >= ADULTO && (a.edad || 0) < VIEJO).length;
      if (fertiles < Math.max(2, vivos.length * 0.15) && camasLibres >= 2 && (c.comida || 0) > 4 && total < MAX_ALDEANOS) {
        const casas = casasDe(m, c);
        for (let k = 0; k < 2; k++) { const b = nuevoAldeano(m, c, casas.length ? casas[Math.floor(azar(v) * casas.length)] : centro(m, hogar(m, c, cs)), ADULTO + 1 + Math.floor(azar(v) * 3), null); lista.push(b); vivos.push(b); total++; }
      }
      if (tierra && comida && total < MAX_ALDEANOS && vivos.length < 260) {
        const adultos = vivos.filter(a => (a.edad || 0) >= ADULTO && (a.edad || 0) < VIEJO && a.colono == null);
        let nacen = 0, casasCiv = null;
        // Sin agua cerca nacen menos niños; con parque y plaza, algo más (la gente está a gusto).
        const nec = c.necesidades || [], agua = (nec.some(n => n.obra === 'pozo' && n.falta) ? 0.6 : 1) * (c.animo != null ? 0.8 + c.animo / 250 : 1);
        for (const a of adultos) {
          if (nacen >= Math.max(2, adultos.length * 0.25)) break;
          // Con la infancia larga (partidas pausadas) las familias tienen más hijos, como antes de la medicina moderna.
          if (azar(v) >= (camasLibres > vivos.length * 0.3 ? 0.2 : 0.13) * (tiene(a, 'fértil') ? 1.5 : 1) * (v.nacer || 1) * agua * (pausada(m) ? 1.15 : 1)) continue;
          if (nacen >= camasLibres) { c.sinCama++; continue; }
          if (!casasCiv) casasCiv = casasDe(m, c);
          // El hijo nace donde viven sus padres (en la colonia, si viven allí).
          const enColonia = pausada(m) && a.h !== c.capital && (m.ciudades || []).some(x => x.region === a.h);
          const casa = a.casa != null && [OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento].includes(v.obra[a.casa]) ? a.casa : enColonia ? centro(m, a.h) : (casasCiv.length ? casasCiv[Math.floor(azar(v) * casasCiv.length)] : centro(m, a.h));
          const bebe = nuevoAldeano(m, c, casa, 0, a);
          lista.push(bebe); nacen++; total++;
        }
      }
    }
    for (const a of quitar) { if (a.emp || a.merc) heredar(m, a, quitar); else if ((a.dinero || 0) >= 1) legar(m, a, quitar); }
    // El tanque o el cañón no envejece: si su tripulante muere de viejo o de enfermedad, vuelve al cuartel para otro.
    for (const a of quitar) if (a.veh) { const c = S().civ(m, a.c); if (c && c.viva) c.vehiculos = (c.vehiculos || 0) + 1; }
    if (quitar.size) v.aldeanos = v.aldeanos.filter(a => !quitar.has(a));
    // Oficios: los libres cambian de oficio para cubrir lo que falta en su pueblo.
    for (const c of vivas) reasignar(m, c, recursosDe ? recursosDe[c.id] : null, false);
    equipar(m);
  }
  // Reparte los oficios de un pueblo. Con «ya» (una orden del jugador), cambian en el acto todos los que no
  // vayan cargados, no solo los que estaban libres: la orden se ve obedecer enseguida.
  // Cambia de oficio a un aldeano (quien deja las armas, las entrega).
  function mover(a, k) {
    if (a.obrero != null) { delete a.obrero; a.enFabrica = 0; } // (quien cambia de oficio deja la fábrica)
    if (a.o === GUERRERO && k !== GUERRERO) { a.arma = 0; a.armadura = 0; a.tirador = null; if (a.veh) a.vehSuelto = 1; delete a.veh; if (a.pv != null) { a.pv = Math.min(a.pv, vidaMax(a)); a.pv0 = a.pv; } }
    a.o = k; a.e = LIBRE; a.k = 0; a.kt = 0; a.paseo = 0; a.tx = -1; a.ty = -1; a.pastor = null; a.caza = null; a.cantera = 0; a.siega = 0;
  }
  // Las órdenes concretas del jugador mandan sobre el gobernador automático:
  //  · CUADRILLAS: aldeanos con un encargo fijo (a.fijo) que nadie les cambia hasta que vence;
  //  · CUPOS: «quiero 10 leñadores» fija cuántos hay de un oficio (c.plan.cupos), el resto se reparte solo.
  function reasignar(m, c, recursos, ya) {
    const v = m.vida;
    // (Los obreros de las fábricas privadas trabajan para su patrón: el gobernador no los mueve.)
    const todos = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && a.colono == null && a.aBordo == null && a.obrero == null);
    const cupos = (c.plan && c.plan.cupos) || {};
    const conCupo = i => cupos[i] != null;
    const tiene = [0, 0, 0, 0, 0, 0, 0];
    for (const a of todos) tiene[a.o]++;
    const libres = todos.filter(a => !a.fijo && !a.emp && !a.merc && !a.ministro);
    let p = reparto(c, recursos || { arboles: 1, rocas: 1 });
    // Los oficios con cupo salen del reparto automático; lo demás se reparte en proporción.
    if (Object.keys(cupos).length) { p = p.map((x, i) => (conCupo(i) ? 0 : x)); const sum = p.reduce((k, x) => k + x, 0) || 1; p = p.map(x => x / sum); }
    const fuera = libres.filter(a => !conCupo(a.o)).length;
    // 1. Cumplir los cupos: quitar a los que sobran y traer a los que faltan (primero de lo que más sobra).
    // (Si la comida no da ni para unos turnos, un cupo que no da de comer no se lleva a todos: el 40 % sigue en el campo.
    // Antes solo se miraba con el granero casi vacío, y entonces ya era tarde: «quiero 8 soldados» con seis vecinos los
    // hacía soldados a todos y el pueblo moría de hambre en quince turnos.)
    const hambre = pausada(m) && (c.comida || 0) < Math.max(6, (c.aldeanos || todos.length) * 3);
    for (const k of Object.keys(cupos).map(Number)) {
      let meta = Math.max(0, Math.min(cupos[k].n, todos.length));
      if (hambre && k !== GRANJERO && meta > todos.length - Math.ceil(todos.length * 0.4)) {
        meta = Math.max(0, todos.length - Math.ceil(todos.length * 0.4));
        if (c.jugador && !(c.avisoCupoHambre > m.turno - 20)) { c.avisoCupoHambre = m.turno; (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '🌾 Con el granero vacío, el cupo de ' + ['leñadores', 'granjeros', 'constructores', 'mineros', 'guerreros', 'comerciantes', 'eruditos'][k] + ' espera: hace falta gente en el campo' }); }
      }
      const orden = l => l.sort((x, y) => (x.k ? 1 : 0) - (y.k ? 1 : 0));
      for (const a of orden(libres.filter(a => a.o === k))) {
        if (tiene[k] <= meta) break;
        const falta = p.map((x, i) => (conCupo(i) ? -1e9 : x * fuera - tiene[i]));
        const mejor = falta.indexOf(Math.max(...falta));
        tiene[k]--; tiene[mejor]++; mover(a, mejor);
      }
      if (tiene[k] < meta) {
        const viejoNo = a => !(k === GUERRERO && (a.edad || 0) >= VIEJO);
        const candidatos = orden(libres.filter(a => a.o !== k && !conCupo(a.o) && viejoNo(a)));
        // (Primero los adultos jóvenes: un oficio nuevo es para años, no para quien está a punto de morir de viejo.)
        const anciano = a => ((a.edad || 0) >= VIEJO ? 1 : 0);
        candidatos.sort((x, y) => anciano(x) - anciano(y) || (tiene[y.o] - p[y.o] * fuera) - (tiene[x.o] - p[x.o] * fuera) || (x.k ? 1 : 0) - (y.k ? 1 : 0));
        for (const a of candidatos) { if (tiene[k] >= meta) break; tiene[a.o]--; tiene[k]++; mover(a, k); }
      }
    }
    // Sin oro para pagarles, algunos soldados cuelgan las armas.
    if ((c.oro || 0) < 0 && !c.guerras.length) for (const a of libres) if (a.o === GUERRERO && !a.k && azar(v) < 0.15) { tiene[GUERRERO]--; tiene[GRANJERO]++; mover(a, GRANJERO); }
    // 2. El reparto automático, con los que no tienen encargo ni oficio con cupo.
    for (const a of libres) {
      if (conCupo(a.o)) continue;
      // En guerra se llama a las armas a cualquiera que no vaya cargado; en paz, solo cambian los que están libres.
      // Los ancianos dejan las armas y vuelven al campo; nadie los llama a filas.
      const viejo = (a.edad || 0) >= VIEJO;
      if (viejo && a.o === GUERRERO) { tiene[GUERRERO]--; tiene[GRANJERO]++; mover(a, GRANJERO); continue; }
      const llamada = c.guerras.length && !a.k && a.o !== GUERRERO && a.o !== ERUDITO && !viejo && !conCupo(GUERRERO);
      if (!llamada && !(ya && !a.k) && a.e !== LIBRE && a.e !== ESPERAR && !a.paseo && !(a.o === GUERRERO && !c.guerras.length && prio(c, 'ejercito') <= 1)) continue;
      const falta = p.map((x, i) => (conCupo(i) || (viejo && i === GUERRERO) ? -1e9 : x * fuera - tiene[i] + (i === a.o ? 1 : 0)));
      const mejor = falta.indexOf(Math.max(...falta));
      if (mejor !== a.o && falta[mejor] - (falta[a.o] - 1) >= 1) { tiene[a.o]--; tiene[mejor]++; mover(a, mejor); }
    }
  }

  // La armería: los guerreros reciben el arma de su era si hay metal (y armadura si sobra); los demás, un garrote.
  // En guerra, un reino con puerto y cuartel sin acorazado guarda el hierro del barco antes de forjar o equipar.
  const reservaAcorazado = (v, c) => c.era >= 6 && c.guerras.length && (c.puertos || 0) > 0 && c.cuarteles > 0 && !(v.barcos || []).some(b => b.c === c.id && b.tipo === 'guerra') ? 8 : 0;
  function equipar(m) {
    const v = m.vida;
    for (const a of v.aldeanos) {
      if (a.o !== GUERRERO) { if (a.veh || a.vehSuelto) { const c = S().civ(m, a.c); if (c) c.vehiculos = (c.vehiculos || 0) + 1; delete a.vehSuelto; } if (a.veh) { delete a.veh; a.pv = Math.min(a.pv || 0, vidaMax(a)); a.pv0 = a.pv; } continue; }
      const c = S().civ(m, a.c);
      if (!c) continue;
      if (a.tirador == null) a.tirador = c.era >= 5 ? a.id % 3 !== 0 : a.id % 3 === 0;
      if (c.era >= 5 && !a.tirador && a.id % 3 !== 0) a.tirador = true;
      // Sin arquería no hay tiradores (salvo los honderos de la fase tribal); sin cuartel, nadie pasa de la lanza.
      if (a.tirador && c.era >= 1 && !(c.arquerias > 0)) a.tirador = false;
      // Del cuartel salen también los vehículos: uno de cada siete guerreros sirve una pieza de artillería y, en la
      // Era Moderna, uno de cada seis conduce un tanque (si hay metal para fabricarlos; en la II Guerra Mundial, también gasolina).
      if (c.cuarteles > 0 && c.era >= 5) {
        // Si el jugador mandó fabricarlos, uno de cada tres.
        const pide = c.plan && c.plan.vehiculos;
        const quiereV = c.era >= VEHICULOS.tanque.era && (a.id % 6 === 1 || (pide === 'tanque' && a.id % 3 === 0)) ? 'tanque' : (a.id % 5 === 3 || (pide === 'artilleria' && a.id % 3 === 2)) ? (c.era >= 7 ? 'artilleria' : 'canon') : null;
        const crudo = quiereV === 'tanque' && pausada(m) && c.era >= 8 ? 2 : 0;
        // Primero se usan los vehículos del almacén (fabricados o comprados); si no hay, se hace uno con metal.
        if (quiereV && a.veh !== quiereV && (c.vehiculos || 0) >= 1) { c.vehiculos -= 1; a.veh = quiereV; a.tirador = true; a.pv = a.pv0 = VEHICULOS[quiereV].vida; }
        else if (quiereV && a.veh !== quiereV && (c.metal || 0) >= VEHICULOS[quiereV].metal + reservaAcorazado(v, c) && (c.petroleo || 0) >= crudo) { c.metal -= VEHICULOS[quiereV].metal; c.petroleo = (c.petroleo || 0) - crudo; a.veh = quiereV; a.tirador = true; a.pv = a.pv0 = VEHICULOS[quiereV].vida; }
      }
      if (a.veh) { a.tirador = true; continue; }
      const quiere = c.cuarteles > 0 || c.era <= 1 ? c.era : Math.min(c.era, 1);
      // Primero las armas forjadas (propias o compradas); si no hay, se forjan con metal.
      if ((a.arma || 0) < quiere && (c.era === 0 || (c.armas || 0) >= 1 || (c.metal || 0) >= 1 + reservaAcorazado(v, c))) { if (c.era > 0) { if ((c.armas || 0) >= 1) c.armas -= 1; else c.metal -= 1; } a.arma = quiere; }
      // La armadura de su era: el cuero sale del ganado; el bronce, el hierro y el acero, de la armería.
      const arm = armaduraDeEra(c.era);
      if ((a.armadura || 0) !== arm) {
        if (arm === 1) { if (v.animales.some(b => b.c === c.id)) a.armadura = 1; }
        else if ((c.metal || 0) >= 2 + reservaAcorazado(v, c)) { c.metal -= 1; a.armadura = arm; }
      }
    }
  }
