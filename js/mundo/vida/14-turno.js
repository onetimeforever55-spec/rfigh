  // ── GÉNESIS · LA VIDA · Lo que hay al alcance de cada pueblo y un turno de vida ──

  // ---------- Lo que hay al alcance de cada pueblo ----------
  function recursos(m) {
    const v = m.vida, out = {}, reservadas = new Set();
    for (const a of v.aldeanos) if (a.e === IR || a.e === TRABAJAR) reservadas.add(a.ty * v.tw + a.tx);
    for (const c of S().vivas(m)) out[c.id] = { arboles: [], rocas: [], metales: [], carbones: [], cs: [], reservadas, enemigos: [] };
    const ter = terrenos(m);
    // Las regiones propias y las libres que tocan el territorio.
    const alcance = {};
    for (let r = 0; r < m.W * m.H; r++) {
      const d = m.dueno[r];
      if (d >= 0 && out[d]) { out[d].cs.push(r); (alcance[r] = alcance[r] || new Set()).add(d); }
      if (d < 0 && !esAgua(m.tipo[r])) for (const w of S().vecinos(r)) { const o = m.dueno[w]; if (o >= 0 && out[o]) (alcance[r] = alcance[r] || new Set()).add(o); }
    }
    for (const r of Object.keys(alcance)) {
      for (const t of parcelas(m, +r)) {
        const arbol = v.arbol[t] >= 2, roca = v.roca[t] > 0;
        if (!arbol && !roca) continue;
        for (const id of alcance[r]) { if (arbol) out[id].arboles.push(t); else if (ter[t] !== 'agua') { out[id].rocas.push(t); if (v.mena && v.mena[t] === 3) out[id].carbones.push(t); else if (v.mena && v.mena[t]) out[id].metales.push(t); } }
      }
    }
    for (const c of S().vivas(m)) {
      for (const g of c.guerras) { const o = S().civ(m, g.con); if (o && o.viva) out[c.id].enemigos.push({ id: o.id, frente: S().frontera(m, c, o) }); }
    }
    return out;
  }

  // Búsquedas que ya fallaron este turno (para no repetirlas en cada paso): se vacía al empezar el turno.
  let memo = new Map();
  // Con el ritmo pausado, nacer y envejecer van más despacio por turno al principio (cada turno son pocos años).
  const bio = m => !m.ritmo || m.ritmo <= 1 ? 1 : Math.max(0.3, Math.min(1, S().pausa(m) * 2.5));
  // ---------- Un turno de vida ----------
  // El turno se calcula por partes (un generador que cede entre paso y paso): la vista lo reparte entre varios
  // fotogramas y la imagen no se congela al cambiar de turno. turno(m) lo hace todo de una vez.
  function turno(m) { const gen = turnoPorPasos(m); while (!gen.next().done); }
  function* turnoPorPasos(m) {
    if (!m.vida) crear(m);
    const v = m.vida;
    memo = new Map();
    // Vencen las cuadrillas, cupos y prioridades con plazo que mandó el jugador.
    if (M.mando && M.mando.vencer) M.mando.vencer(m);
    v.cambios = []; v.muertos = []; v.disparos = []; v.aviones = []; v.naufragios = [];
    ambiente(m); v.golpes = []; v.ataques = [];
    // Los heridos se curan entre turnos; el pintor necesita la vida con la que empieza cada uno.
    for (const a of v.aldeanos) if (a.heridas) a.heridas = Math.max(0, a.heridas - (S().civ(m, a.c) && S().civ(m, a.c).hospitales > 0 ? 0.08 : 0.03));
    for (const a of v.aldeanos.concat(v.animales || [])) if (a.pv != null) { a.pv = Math.min(vidaMax(a), a.pv + (a.tipo ? 5 : 6)); a.pv0 = a.pv; if (a.pv >= vidaMax(a)) { a.pv = null; a.pv0 = null; } }
    // Con el ritmo pausado se envejece más despacio por turno (cada turno son menos años).
    v.bio = bio(m);
    // Y nacen menos por turno: la tribu tarda en hacerse aldea, y la aldea en hacerse pueblo.
    v.nacer = !m.ritmo || m.ritmo <= 1 ? 1 : Math.max(0.3, Math.min(1, S().pausa(m) * 2)) * 0.6;
    // En las partidas pausadas los niños crecen al mismo ritmo en años que los adultos (16 años de infancia de
    // verdad): así un padre siempre le saca al menos unos 16 años a su hijo.
    const lentoNino = pausada(m) ? 2.6 / 8 : 1;
    for (const a of v.aldeanos) a.edad = (a.edad == null ? ADULTO + (a.id % 10) : Math.round((a.edad + v.bio * ((a.edad || 0) < ADULTO ? lentoNino : 1)) * 1000) / 1000);
    // Lo que la técnica de cada pueblo da en combate.
    v.bonos = {};
    for (const c of S().vivas(m)) v.bonos[c.id] = { ataque: M.tec(c, 'ataque'), defensa: M.tec(c, 'defensa'), vida: M.tec(c, 'vida') };
    for (const a of v.aldeanos) { const b = v.bonos[a.c]; a.extraVida = b ? b.vida : 0; }
    // De noche, a casa a dormir (salvo los guerreros en guerra, las guardias y quien va de viaje); de día, a trabajar.
    const noche = esNoche(m);
    v.noche = noche; v.estacion = estacion(m);
    for (const a of v.aldeanos) {
      if (noche) {
        const c = S().civ(m, a.c);
        const fuera = !c || a.colono != null || (a.o === GUERRERO && (c.guerras.length || (a.fijo && a.fijo.guardia != null))) || (a.o === COMERCIANTE && a.e === VIAJAR) || a.casa == null || ![OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento].includes(v.obra[a.casa]);
        if (!fuera && !a.dormir) { a.dormir = 1; a.paseo = 0; a.edificioAntes = a.edificio; ir(a, a.casa, v.tw, IR); }
      } else if (a.dormir) { a.dormir = 0; a.enCasa = 0; a.e = LIBRE; a.t = 0; }
    }
    if (pausada(m)) for (const k of Object.keys(v.andamios || {})) { const an = v.andamios[k], t = +k; if (v.obra[t] || m.dueno[region(m, t)] !== an.civ) delete v.andamios[k]; }
    v.mena = v.mena || new Array(v.tw * v.th).fill(0); v.barcos = v.barcos || []; v.torres = v.torres || {};
    // Toda torre o castillo en pie tiene su guarnición (también los de mundos guardados antes).
    for (let t = 0; t < v.obra.length; t++) if ((v.obra[t] === OBRA.torre || v.obra[t] === OBRA.castillo) && v.torres[t] == null) v.torres[t] = v.obra[t] === OBRA.castillo ? 40 : 12; for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.aduana && v.torres[t] == null) v.torres[t] = 20; v.ejercitos = v.ejercitos || {}; v.cultivo = v.cultivo || new Array(v.tw * v.th).fill(0); v.animales = v.animales || []; v.camino = v.camino || new Array(v.tw * v.th).fill(0); v.rutas = v.rutas || [];
    centros(m);
    let rec = recursos(m);
    sincronizar(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length })));
    rec = recursos(m);
    v.marcadas = new Set(S().vivas(m).flatMap(c => ((c.plan && c.plan.encargos) || []).map(e => e.t)));
    ejercitos(m);
    repararDanos(m);
    const ter = terrenos(m);
    for (const a of v.aldeanos) a.r = [a.x, a.y, a.e === TRABAJAR ? ACC.trabajar : a.k ? ACC.cargar : ACC.andar];
    barcos(m, ter);
    for (const b of v.animales) b.r = [b.x, b.y];
    for (const b of v.barcos) b.r = [b.x, b.y];
    v.robadas = {}; v.mordidos = {};
    yield;
    for (let paso = 1; paso <= TICKS; paso++) {
      for (const b of v.animales) pastar(m, b, ter);
      if (v.animales.some(b => b.muerta)) v.animales = v.animales.filter(b => !b.muerta);
      lobos(m, paso);
      for (const b of v.barcos) navegar(m, b, ter, paso);
      // Dónde está cada guerrero, para que se encuentren en la frontera.
      const guerreros = new Map();
      for (const a of v.aldeanos) if (a.o === GUERRERO && a.aBordo == null) { const t = a.y * v.tw + a.x; (guerreros.get(t) || guerreros.set(t, []).get(t)).push(a); }
      const muertos = new Set();
      for (const a of v.aldeanos) if (!muertos.has(a)) actuar(m, a, rec[a.c], ter, paso, guerreros, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
      exterminio(m, paso, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
      torres(m, paso, guerreros);
      if (paso === 2) aviones(m, paso, guerreros);
      if (v.fuego && paso % 2 === 0) { const gente = new Map(); for (const a of v.aldeanos) if ((a.edad || 0) >= ADULTO) { const r = region(m, a.y * v.tw + a.x); gente.set(r, (gente.get(r) || 0) + 1); } arder(m, paso, gente); }
      asedios(m, paso);
      yield;
    }
    // Donde cae alguien en batalla queda sangre unos turnos.
    for (const [x, y, , tipo, paso] of v.muertos) if (['batalla', 'flecha', 'obus', 'bomba', 'torre'].includes(tipo)) marcar(m, y * v.tw + x, 'sangre', 3, paso || 0.1);
    naturaleza(m, ter);
    rescatarCargas(m);
    contar(m);
    yield;
    ciudades(m);
    abandonos(m);
    planificarRutas(m, terrenos(m));
    if (pausada(m)) planificarVias(m, terrenos(m));
    yield;
    fauna(m, ter);
    comer(m);
    if (pausada(m)) { subsuelo(m, ter); mercado(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length, carbones: x.carbones.length }))); }
    botarMuelles(m, ter); // (un muelle recién comprado o terminado ya tiene su barco al acabar el turno)
    // Las casas se reparten al final del turno: quien perdió la suya (un fuego, una batalla, un derribo) o acaba de nacer
    // ya tiene dónde dormir, y ninguna casa queda con más gente que camas.
    if (pausada(m)) asignarCasas(m);
    // La crónica cuenta los lobos cuando hacen daño de verdad (una vez cada tanto por pueblo).
    for (const c of S().vivas(m)) {
      const mordidos = (v.mordidos || {})[c.id] || 0;
      c.robadas = (c.robadas || 0) + ((v.robadas || {})[c.id] || 0);
      const robadas = c.robadas;
      if ((mordidos || robadas >= 2) && !(c.ultimosLobos > m.turno - 10)) {
        c.ultimosLobos = m.turno; c.robadas = 0;
        S().cronica(m, 'lobos', 'Lobos en ' + c.nombre, (robadas ? 'Los lobos bajan del bosque y se llevan ' + robadas + (robadas === 1 ? ' res' : ' reses') + ' de los rebaños de ' + c.nombre + '. ' : '') + (mordidos ? (mordidos === 1 ? 'Un aldeano no vuelve a casa. ' : mordidos + ' aldeanos no vuelven a casa. ') : '') + 'Los guerreros salen a darles caza.', c);
      }
    }
    // La leña de cada día: cocinar, calentarse y, desde la Edad del Hierro, las forjas; en la era industrial, el carbón vegetal.
    for (const c of S().vivas(m)) c.madera = Math.max(0, c.madera - Math.sqrt(Math.max(0, c.pob)) * 0.18 * (1 + c.era * 0.3) * (v.estacion === 3 ? 2 : 1));
    for (const c of S().vivas(m)) desglose(c);
  }
  const mapa = (o, f) => { const r = {}; for (const k of Object.keys(o)) r[k] = f(o[k]); return r; };

  function actuar(m, a, rec, ter, paso, guerreros, muertos) {
    const v = m.vida, c = S().civ(m, a.c);
    let acc = a.k ? ACC.cargar : ACC.andar;
    if (!rec || !c) return;
    // Embarcado en un transporte: va donde va el barco (y no pelea hasta desembarcar).
    if (a.aBordo != null) {
      const b = v.barcos.find(x => x.id === a.aBordo);
      if (b && !b.hundido) { a.x = b.x; a.y = b.y; a.e = ESPERAR; a.t = 2; a.r.push(a.x, a.y, ACC.andar); return; }
      desembarcar(m, a);
    }
    if (a.e === LIBRE) elegirTarea(m, a, c, rec, ter);
    // Un guerrero que ve a un enemigo cerca carga contra él (los tiradores se quedan a distancia y disparan).
    if (a.o === GUERRERO && c.guerras.length && !a.tirador && a.e !== TRABAJAR) {
      let cerca = null;
      for (let r = 1; r <= 4 && !cerca; r++) for (let dy = -r; dy <= r && !cerca; dy++) for (const dx of [r - Math.abs(dy), -(r - Math.abs(dy))]) {
        const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
        cerca = lista && lista.find(b => b !== a && !muertos.has(b) && c.guerras.some(g => g.con === b.c));
        if (cerca) break;
      }
      if (cerca) { a.tx = cerca.x; a.ty = cerca.y; a.e = IR; a.q = 0; a.paseo = 0; }
    }
    if (a.e === IR || a.e === VOLVER) {
      if (a.x === a.tx && a.y === a.ty) llegar(m, a, c, rec, ter, paso);
      else if (!andar(m, a, c, ter)) { a.e = LIBRE; a.k = 0; }
    } else if (a.e === TRABAJAR) {
      acc = ACC.trabajar;
      if (--a.t <= 0) terminar(m, a, c, rec, ter, paso);
    } else if (a.e === ESPERAR) {
      if (--a.t <= 0) a.e = LIBRE;
    } else if (a.e === VIAJAR) {
      // El comerciante sigue su ruta tramo a tramo (el doble de rápido donde ya hay camino).
      const ru = v.rutas.find(x => x.id === a.ruta);
      if (!ru || !rutaActiva(m, ru)) a.e = LIBRE;
      else {
        acc = ACC.cargar;
        // El comercio moderno: si la ruta tiene vía y el tren anda, la carga va en tren (lo más rápido); si no,
        // en la Era Moderna va en camión por la carretera (el doble de rápido que la carreta donde está empedrada).
        const via = ru.tipo === 'externa' && v.vias && v.vias[ru.clave], otroC = S().civ(m, ru.a === c.id ? ru.b : ru.a);
        a.enTren = !!(via && pausada(m) && ((c.estaciones > 0 && enMarcha(c, 'tren')) || (otroC && otroC.estaciones > 0 && enMarcha(otroC, 'tren'))));
        a.camion = !a.enTren && c.era >= 7 && pausada(m);
        const pasos = a.enTren ? 5 : (v.camino[ru.tiles[a.i]] ? (a.camion ? 4 : 2) : 1) * (ru.tipo === 'externa' && c.estaciones > 0 && enMarcha(c, 'tren') && pausada(m) && !a.camion ? 2 : 1);
        if (a.retenido > 0) a.retenido--;
        else for (let k = 0; k < pasos; k++) {
          const sig = a.i + a.dir;
          if (sig < 0 || sig >= ru.tiles.length) break;
          a.i = sig;
          // Al pasar junto a un puesto fronterizo, se para en la barrera.
          if (controlFronterizo(m, a, c, ru.tiles[a.i], paso)) break;
        }
        const t = ru.tiles[a.i];
        a.x = t % v.tw; a.y = t / v.tw | 0;
        if (a.i === 0 || a.i === ru.tiles.length - 1) {
          if (a.vuelta) { a.e = ESPERAR; a.t = 2; a.ruta = null; descargar(m, a, c); }
          else { a.e = TRABAJAR; a.t = 2; a.comercio = 1; }
        }
      }
    }
    if (a.ahogado) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'ahogado', paso, a]); return; }
    // Los guerreros luchan: cuerpo a cuerpo con el enemigo de al lado; los tiradores disparan desde lejos.
    if (a.o === GUERRERO && c.guerras.length) {
      const enemigo = b => b !== a && !muertos.has(b) && c.guerras.some(g => g.con === b.c);
      let rival = null, blancoG = null;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
        rival = lista && lista.find(enemigo);
        if (rival) break;
      }
      if (rival) {
        // Cuerpo a cuerpo: se cruzan golpes; el más fuerte acierta más y pega más fuerte.
        if (acierta(v, a, rival)) {
          if (golpear(v, a, rival, danoContra(v, a, rival, false), paso, a.x, a.y)) {
            muertos.add(rival); v.muertos.push([rival.x, rival.y, rival.c, 'batalla', paso, rival]); apuntarBaja(m, c.id, rival);
            c.victorias = (c.victorias || 0) + 1; a.bajas = (a.bajas || 0) + 1;
          }
        }
        acc = ACC.luchar;
      } else if (c.era >= 8 && !a.veh && (c.granadas || 0) >= 1 && (a.granadaT == null || m.turno - a.granadaT >= 3) && azar(v) < 0.3 && (blancoG = buscaGranada(v, a, guerreros, enemigo)) != null) {
        // La granada (Segunda Guerra Mundial): se lanza por encima de los sacos terreros y revienta en una casilla
        // y las de al lado. La trinchera no protege de ella.
        a.granadaT = m.turno; c.granadas -= 1;
        const bx = blancoG % v.tw, by = blancoG / v.tw | 0;
        v.disparos.push([a.x, a.y, bx, by, paso, 5, a.id]);
        a.fuego = { turno: m.turno, paso, dx: Math.sign(bx - a.x) || (a.fuego ? a.fuego.dx : 1) };
        estallido(m, c, blancoG, 1, GRANADA, paso, muertos, 'obus', a);
        acc = ACC.luchar;
        if (a.e === IR) { a.x = a.r[a.r.length - 3]; a.y = a.r[a.r.length - 2]; }
      } else if (a.tirador && c.era >= 1 && !(a.veh && VEHICULOS[a.veh].area && (paso + a.id) % 2)) {
        const alcance = a.veh ? VEHICULOS[a.veh].alcance : c.era >= 5 ? 4 : 3;
        let blanco = null;
        for (let dy = -alcance; dy <= alcance && !blanco; dy++) for (let dx = -alcance; dx <= alcance && !blanco; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > alcance || (!dx && !dy)) continue;
          const lista = guerreros.get((a.y + dy) * v.tw + a.x + dx);
          blanco = lista && lista.find(enemigo);
        }
        if (blanco && azar(v) < 0.6) {
          // Una flecha (o una bala) vuela: se dibuja en este paso.
          // Flechas incendiarias (de la Edad del Hierro a la pólvora): a veces prenden lo que hay donde caen.
          const ardiente = !a.veh && c.era >= 2 && c.era < 5 && azar(v) < 0.12;
          const obus = a.veh ? 2 : c.era >= 5 ? 1 : ardiente ? 4 : 0;
          v.disparos.push([a.x, a.y, blanco.x, blanco.y, paso, obus, a.id]);
          // El tirador se queda en posición de tiro (de pie, de rodillas o cuerpo a tierra según la época) y mirando al blanco.
          if (!a.veh) a.fuego = { turno: m.turno, paso, dx: Math.sign(blanco.x - a.x) || (a.fuego ? a.fuego.dx : 1) };
          if (ardiente) { const dx = Math.round((azar(v) - 0.5) * 2), dy = Math.round((azar(v) - 0.5) * 2); prender(m, (blanco.y + dy) * v.tw + blanco.x + dx, paso + 1, 2); }
          // El obús revienta: cráter, árboles por el suelo y, a veces, fuego.
          if (a.veh && VEHICULOS[a.veh].area) estallido(m, c, blanco.y * v.tw + blanco.x, a.veh === 'artilleria' ? 1.5 : 1, Math.round(VEHICULOS[a.veh].dano * 0.6), paso, muertos, 'obus', a);
          if (!muertos.has(blanco) && azar(v) < (a.veh ? 0.65 : 0.5) + (tieneR(a, 'sabio') ? 0.05 : 0)) {
            // La flecha llega al final del paso: el golpe se ve un poco después de soltarla.
            if (golpear(v, null, blanco, danoContra(v, a, blanco, true), paso + 0.5, a.x, a.y)) { muertos.add(blanco); v.muertos.push([blanco.x, blanco.y, blanco.c, 'flecha', paso + 0.5, blanco]); apuntarBaja(m, c.id, blanco); c.victorias = (c.victorias || 0) + 1; a.bajas = (a.bajas || 0) + 1; }
          }
          acc = ACC.luchar;
          // El tirador se para a disparar: deshace el paso de este turno si iba andando.
          if (a.e === IR) { a.x = a.r[a.r.length - 3]; a.y = a.r[a.r.length - 2]; }
        } else if (!blanco && a.veh) {
          // Sin soldados a tiro, la artillería y los tanques bombardean la torre o el castillo enemigo a su alcance.
          const alc = VEHICULOS[a.veh].alcance;
          let tt = -1;
          for (const k of Object.keys(v.torres || {})) { const u = +k; if (Math.abs(u % v.tw - a.x) + Math.abs((u / v.tw | 0) - a.y) <= alc && c.guerras.some(g => g.con === m.dueno[region(m, u)])) { tt = u; break; } }
          if (tt >= 0 && azar(v) < 0.6) {
            const bx = tt % v.tw, by = tt / v.tw | 0;
            v.disparos.push([a.x, a.y, bx, by, paso, 2, a.id]);
            v.torres[tt] -= VEHICULOS[a.veh].dano / 16;
            marcar(m, tt, 'escombros', 6, paso + 0.5);
            if (v.torres[tt] <= 0) { cambiar(m, 'obra', tt, OBRA.ruina, paso + 0.5); delete v.torres[tt]; marcar(m, tt, 'escombros', 12, paso + 0.5); }
            acc = ACC.luchar;
            if (a.e === IR) { a.x = a.r[a.r.length - 3]; a.y = a.r[a.r.length - 2]; }
          }
        }
      }
      if (muertos.has(a)) return;
    }
    a.r.push(a.x, a.y, acc);
  }
