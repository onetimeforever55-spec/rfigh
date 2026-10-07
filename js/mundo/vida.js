/*
 * GÉNESIS · LA VIDA
 * Cada región del mapa se parte en 4×4 parcelas con su árbol, su roca o su obra, y por ellas caminan los
 * aldeanos de cada pueblo: leñadores que talan, granjeros que siembran, constructores que levantan casas,
 * mineros que pican piedra y guerreros que marchan a la frontera cuando hay guerra.
 *
 * Lo que hacen mueve la economía: la madera y la piedra pagan las tierras nuevas y las casas, las casas y
 * los campos dan sitio a más gente, las batallas que ganan los guerreros inclinan la guerra, y un bosque
 * talado hasta el último árbol se queda en llanura.
 *
 * Todo pasa dentro del turno (TICKS pasos) con un azar propio guardado en el mundo: sigue siendo
 * reproducible. Cada aldeano guarda su recorrido del turno y cada parcela que cambia queda anotada con el
 * paso en que cambió, para que la vista lo anime sin adelantarse.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO;
  const S = () => M.sim;
  const SUB = 4, TICKS = 8, MAX_ALDEANOS = 1600;
  // La vida de un aldeano, en turnos: niño hasta ADULTO, anciano desde VIEJO, y muere de viejo hacia el final.
  const ADULTO = 2, VIEJO = 18;
  const limiteVida = a => 22 + (a.id % 12) + (a.rasgos && a.rasgos.includes('longevo') ? 8 : 0);
  const esNino = a => (a.edad || 0) < ADULTO;
  const OBRA = { nada: 0, casa: 1, campo: 2, centro: 3, ruina: 4, ayuntamiento: 5, torre: 6, templo: 7, molino: 8, puerto: 9, cuartel: 10, arqueria: 11, castillo: 12, saber: 13, pozo: 14, granero: 15, fuente: 16, parque: 17, palacio: 18, central: 19, banco: 20, fabrica: 21, estacion: 22, hospital: 23, aerodromo: 24, campamento: 25, aduana: 26, petroleo: 27, mina: 28 };
  // Hasta dónde llegan los campos de un molino (parcelas): más allá no se ara.
  const RANGO_MOLINO = 4;
  // En las partidas pausadas el molino alcanza menos (un rango medio): hacen falta varios molinos repartidos
  // por la huerta, y sin molino cerca no hay tierra que arar.
  const rangoMolino = m => ((m.ritmo || 1) > 1 && !m.sinVidaPausada ? 3 : RANGO_MOLINO);
  const CAMPOS_POR_MOLINO = 10;
  const fase = era => (era <= 1 ? 0 : era <= 4 ? 1 : era <= 6 ? 2 : 3);
  /*
   * LA VIDA PAUSADA (partidas nuevas, m.ritmo > 1): días y noches, estaciones y obras que tardan.
   *  · Un día son 6 turnos; el último es de noche: la gente vuelve a casa, las calles se vacían y se duerme.
   *  · Una estación son 12 turnos (dos días): primavera (se siembra y brota), verano, otoño (la gran cosecha)
   *    e invierno (no crece nada, se vive del granero y se quema el doble de leña).
   *  · Cada obra se levanta sobre un andamio en varias jornadas; varios constructores pueden ayudar.
   */
  const pausada = m => (m.ritmo || 1) > 1 && !m.sinVidaPausada;
  const DIA_TURNOS = 6, ESTACION_TURNOS = 12;
  const esNoche = m => pausada(m) && m.turno % DIA_TURNOS === DIA_TURNOS - 1;
  const estacion = m => (pausada(m) ? Math.floor(m.turno / ESTACION_TURNOS) % 4 : -1);
  const ESTACIONES = ['primavera', 'verano', 'otoño', 'invierno'];
  // Jornadas de trabajo que necesita cada obra (un constructor hace una por visita).
  const OFICIOS = ['lenador', 'granjero', 'constructor', 'minero', 'guerrero', 'comerciante', 'erudito'];
  // El erudito (chamán, filósofo, monje, erudito, científico según la época) estudia en el templo o la plaza: trae el saber.
  const [LENADOR, GRANJERO, CONSTRUCTOR, MINERO, GUERRERO, COMERCIANTE, ERUDITO] = [0, 1, 2, 3, 4, 5, 6];
  // Estados del aldeano y lo que hace en cada paso (la vista elige el dibujo con esto).
  const [LIBRE, IR, TRABAJAR, VOLVER, ESPERAR, VIAJAR] = [0, 1, 2, 3, 4, 5];
  const ACC = { andar: 0, trabajar: 1, luchar: 2, cargar: 3 };

  // Las armas de cada era: lo que lleva un guerrero si su pueblo tiene metal para forjarlas (si no, un garrote).
  /*
   * ARMAS Y ARMADURAS (como en WorldBox): cada arma hace un daño según su material y cada armadura quita una
   * parte del golpe según el suyo. Las armas de fuego atraviesan parte de la armadura; el escudo para golpes.
   * El índice del arma es la era en que se forja (el pintor dibuja cada una).
   */
  const ARMAS = [
    { nombre: 'garrote', material: 'madera', dano: 8 }, { nombre: 'lanza de bronce', material: 'bronce', dano: 12 },
    { nombre: 'espada de hierro', material: 'hierro', dano: 16 }, { nombre: 'espada y escudo', material: 'hierro', dano: 17, bloqueo: 0.15 },
    { nombre: 'espada de acero y escudo', material: 'acero', dano: 22, bloqueo: 0.15 }, { nombre: 'arcabuz y pica', material: 'pólvora', dano: 28, perfora: 0.5 },
    { nombre: 'espingarda con bayoneta', material: 'pólvora', dano: 35, perfora: 0.55 }, { nombre: 'fusil', material: 'pólvora', dano: 40, perfora: 0.6 },
    { nombre: 'fusil automático', material: 'pólvora', dano: 48, perfora: 0.7 }
  ];
  const TIROS = ['honda', 'arco', 'arco', 'arco largo', 'ballesta', 'arcabuz', 'espingarda', 'fusil', 'fusil automático'];
  const TIRO = [{ dano: 6 }, { dano: 9 }, { dano: 10 }, { dano: 12 }, { dano: 15, perfora: 0.3 }, { dano: 26, perfora: 0.5 }, { dano: 33, perfora: 0.55 }, { dano: 38, perfora: 0.6 }, { dano: 45, perfora: 0.7 }];
  const ARMADURAS = [
    { nombre: 'sin armadura', material: null, reduce: 0 }, { nombre: 'jubón de cuero', material: 'cuero', reduce: 0.15 },
    { nombre: 'peto de bronce', material: 'bronce', reduce: 0.25 }, { nombre: 'cota de malla', material: 'hierro', reduce: 0.35 },
    { nombre: 'armadura de placas', material: 'acero', reduce: 0.45 }, { nombre: 'coraza', material: 'acero', reduce: 0.3 },
    { nombre: 'casco y uniforme', material: 'acero y tela', reduce: 0.15 }
  ];
  // Los vehículos de guerra: cañones desde la pólvora, artillería pesada en la era moderna y tanques en la II Guerra
  // Mundial. Salen del cuartel y cuestan metal; disparan de lejos y el obús hace daño en una zona.
  const VEHICULOS = {
    canon: { nombre: 'cañón de campaña', vida: 100, dano: 42, perfora: 0.6, alcance: 6, metal: 4, area: true, era: 5 },
    artilleria: { nombre: 'artillería', vida: 115, dano: 58, perfora: 0.7, alcance: 7, metal: 5, area: true, era: 7 },
    tanque: { nombre: 'tanque', vida: 330, blindaje: 0.7, dano: 62, perfora: 0.85, alcance: 4, metal: 10, era: 8 }
  };
  // La armadura de cada era (con la pólvora las placas ya no sirven y se aligeran).
  const armaduraDeEra = era => (era <= 0 ? 1 : era === 1 ? 2 : era <= 3 ? 3 : era === 4 ? 4 : era <= 6 ? 5 : 6);
  // Lo que pega quien no es guerrero: su herramienta.
  const HERRAMIENTA = { 0: { nombre: 'hacha', dano: 9 }, 1: { nombre: 'azada', dano: 6 }, 2: { nombre: 'martillo', dano: 7 }, 3: { nombre: 'pico', dano: 8 }, 5: { nombre: 'cuchillo', dano: 5 }, 6: { nombre: 'bastón', dano: 4 } };
  const tieneR = (a, r) => !!(a.rasgos && a.rasgos.includes(r));
  // Puntos de vida de todos: aldeanos (según edad, rasgos y oficio: el soldado está curtido) y animales.
  // Van holgados para que una batalla dure varios turnos de golpes y no se acabe en dos tajos.
  const VIDA_ANIMAL = { oveja: 25, vaca: 50, ciervo: 35, lobo: 55, pez: 10 };
  const vidaMax = a => (a.extraVida || 0) * (a.tipo || a.veh ? 0 : 1) + (a.veh ? VEHICULOS[a.veh].vida : a.tipo ? VIDA_ANIMAL[a.tipo] || 30 : ((a.edad || 0) < ADULTO ? 30 : (a.edad || 0) >= VIEJO ? 60 : 85) + (tieneR(a, 'fuerte') ? 20 : 0) + (a.o === GUERRERO ? 15 : 0));
  // El arma con que pega alguien (de lejos, la del tirador).
  function armaDe(a, lejos) {
    if (a.tipo === 'lobo') return { nombre: 'colmillos', dano: 14 };
    if (a.veh) return VEHICULOS[a.veh];
    if (a.o === GUERRERO) return lejos && a.tirador ? Object.assign({ nombre: TIROS[a.arma || 0] }, TIRO[a.arma || 0]) : ARMAS[a.arma || 0];
    return HERRAMIENTA[a.o] || { nombre: 'puños', dano: 4 };
  }
  // El daño de un golpe que acierta: el del arma (con algo de azar y los rasgos), menos lo que para la armadura.
  function danoContra(v, at, vic, lejos) {
    const arma = armaDe(at, lejos), arm = vic.veh ? { reduce: VEHICULOS[vic.veh].blindaje || 0 } : ARMADURAS[vic.armadura || 0] || ARMADURAS[0];
    const bo = v.bonos || {}, bAt = bo[at.c] || {}, bVic = bo[vic.c] || {};
    const reduce = Math.min(0.85, arm.reduce * (1 + (bVic.defensa || 0)));
    const d = (1 + (bAt.ataque || 0)) * arma.dano * (0.8 + azar(v) * 0.4) * (tieneR(at, 'fuerte') ? 1.2 : 1) * (tieneR(at, 'torpe') ? 0.85 : 1) * (tieneR(at, 'valiente') ? 1.1 : 1);
    // Dentro de una trinchera, los sacos terreros paran buena parte del golpe.
    const zanja = v.trinchera && v.trinchera[vic.y * v.tw + vic.x] ? 0.6 : 1;
    return Math.max(1, Math.round(d * zanja * (1 - reduce * (1 - (arma.perfora || 0)))));
  }
  // ¿Acierta? Los rápidos aciertan más, los torpes menos, y un escudo para algunos golpes.
  const acierta = (v, at, vic) => azar(v) < 0.62 + (tieneR(at, 'rapido') || tieneR(at, 'rápido') ? 0.1 : 0) - (tieneR(at, 'torpe') ? 0.1 : 0) - ((vic.o === GUERRERO && ARMAS[vic.arma || 0].bloqueo) || 0) - (v.trinchera && v.trinchera[vic.y * v.tw + vic.x] ? 0.2 : 0);
  // Un golpe: resta vida, se anota para que el pintor lo enseñe (destello rojo, retroceso, sangre) y dice si mata.
  function golpear(v, atacante, victima, dano, paso, ax, ay) {
    if (victima.pv == null) victima.pv = vidaMax(victima);
    if (victima.pv0 == null) victima.pv0 = victima.pv;
    victima.pv -= dano;
    // Un golpe fuerte deja una herida que tarda en curar (cuenta para su salud).
    if (!victima.tipo && victima.pv > 0 && dano >= vidaMax(victima) * 0.3) victima.heridas = Math.min(8, (victima.heridas || 0) + 1);
    v.golpes.push([victima.id, paso, ax, ay, dano]);
    if (atacante) v.ataques.push([atacante.id, paso, victima.x - atacante.x, victima.y - atacante.y]);
    return victima.pv <= 0;
  }
  // El marcador de cada guerra: bajas de cada lado y plazas ganadas o perdidas (en la entrada de guerra de cada pueblo).
  function apuntarBaja(m, civMata, muerto) {
    const vic = S().civ(m, muerto.c), mata = S().civ(m, civMata);
    const gv = vic && vic.guerras.find(g => g.con === civMata), gm = mata && mata.guerras.find(g => g.con === muerto.c);
    if (gv) gv.muertos = (gv.muertos || 0) + 1;
    if (gm) gm.matados = (gm.matados || 0) + 1;
  }
  const poder = a => armaDe(a).dano / 8 * (1 + (a.veh ? VEHICULOS[a.veh].blindaje || 0 : (ARMADURAS[a.armadura || 0] || ARMADURAS[0]).reduce));
  // Vetas: en montañas y colinas hay hierro (metal) y oro.
  const MENAS = { montana: [0.22, 0.07], colina: [0.12, 0.03], desierto: [0.05, 0.03], tundra: [0.06, 0.02] };
  /*
   * EL COMBUSTIBLE (desde la Revolución Industrial).
   *  · Carbón: con la máquina de vapor se descubre en las rocas de montañas, colinas, tundras y bosques fríos
   *    (vetas negras, mena 3). Lo sacan los mineros, también en minas abiertas en la montaña.
   *  · Petróleo: en la Era Moderna se descubren bolsas bajo desiertos, pantanos, tundras y costas. Allí se
   *    levanta un pozo de petróleo, que da crudo cada turno sin que nadie tenga que cargarlo.
   *  · Lo gastan las fábricas, los trenes y las centrales eléctricas (carbón; la central quema petróleo si no
   *    hay carbón), los tanques y los aviones (petróleo). Sin combustible, se paran: la fábrica no produce,
   *    el tren no corre, la luz eléctrica se apaga y los tanques no salen del cuartel.
   *  · Los dos se compran y se venden en el mercado global, y quien no tiene puede ir a la guerra por ellos.
   */
  const CARBON = { montana: 0.4, colina: 0.32, tundra: 0.25, taiga: 0.2, bosque: 0.1, pantano: 0.12, llanura: 0.05, nieve: 0.15 };
  const CRUDO = { desierto: 0.02, pantano: 0.02, tundra: 0.012, arena: 0.012, sabana: 0.006, llanura: 0.004, nieve: 0.006 };
  const GASTO = { fabrica: 0.4, tren: 0.3, central: 0.5 };
  const enMarcha = (c, k) => !(c && ((c.paradas && c.paradas[k]) || (k === 'fabrica' && c.huelga)));
  // Lo sucio que está el aire (0 limpio; 0,6 como mucho): fábricas y centrales que funcionan, menos lo que limpian los parques.
  const contaminacion = c => c && c.era >= 6 ? Math.max(0, Math.min(0.6, (enMarcha(c, 'fabrica') ? (c.fabricas || 0) * 0.12 : 0) + (enMarcha(c, 'central') ? (c.centrales || 0) * 0.15 : 0) + (enMarcha(c, 'tren') ? (c.estaciones || 0) * 0.04 : 0) - (c.parques || 0) * 0.1)) : 0;
  // Se descubre lo que hay bajo tierra cuando alguien llega a la era que sabe usarlo (una vez por mundo).
  function subsuelo(m, ter) {
    const v = m.vida, maxEra = Math.max(0, ...S().vivas(m).map(c => c.era));
    if (maxEra >= 6 && !v.carbonVisto) {
      v.carbonVisto = m.anio; v.subsueloVer = (v.subsueloVer || 0) + 1;
      for (let t = 0; t < v.roca.length; t++) if (v.roca[t] > 0 && !v.mena[t] && azar(v) < (CARBON[ter[t]] || 0)) v.mena[t] = 3;
      const c = S().vivas(m).find(x => x.era >= 6);
      S().cronica(m, 'tecnica', 'El carbón mueve el mundo', 'Las máquinas de vapor tienen hambre: las rocas negras de las montañas, que antes nadie quería, valen ahora más que la piedra. Empieza la carrera del carbón.', c);
    }
    if (maxEra >= 7 && !v.crudo) {
      v.crudo = new Array(v.tw * v.th).fill(0); v.subsueloVer = (v.subsueloVer || 0) + 1;
      for (let t = 0; t < v.crudo.length; t++) {
        if (!(azar(v) < (CRUDO[ter[t]] || 0))) continue;
        const tx = t % v.tw;
        for (const d of [0, 1, -1, v.tw, -v.tw]) { const u = t + d; if (u >= 0 && u < v.crudo.length && Math.abs(u % v.tw - tx) <= 1 && CONSTRUIBLE.has(ter[u])) v.crudo[u] = 1; }
      }
      const c = S().vivas(m).find(x => x.era >= 7);
      S().cronica(m, 'tecnica', 'El oro negro', 'Bajo los desiertos y los pantanos hay petróleo: quien lo tenga moverá los motores, los tanques y los aviones. Las bolsas de crudo salen ya en el mapa.', c);
    }
  }
  /*
   * LOS OBREROS: con las fábricas nacen los obreros, y con ellos las huelgas. Si la gente está descontenta
   * (poca estabilidad, impuestos altos, hambre, el aire sucio de las fábricas), los obreros paran: las fábricas
   * no producen y la estabilidad baja hasta que se arregla (subir los salarios cuesta oro; reprimir la huelga
   * la acaba, pero la gente no lo olvida). Tras varias huelgas, si el pueblo está muy descontento, estalla
   * una revolución que cambia el régimen.
   */
  function huelgas(m, c) {
    if (c.era < 6 || !(c.fabricas > 0)) { if (c.huelga) delete c.huelga; return; }
    const v = m.vida;
    if (c.huelga) {
      c.estab = Math.max(0, c.estab - 0.6);
      if (m.turno >= c.huelga.hasta) { delete c.huelga; (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🏭 Termina la huelga: los obreros vuelven a las fábricas' }); }
      return;
    }
    if (c.ultimaHuelga != null && m.turno - c.ultimaHuelga < 20) return;
    const hab = c.habitantes || c.aldeanos || 1, imp = (c.plan && c.plan.impuesto) || 1;
    const malestar = Math.max(0, (40 - c.estab) / 40) + (imp > 1.2 ? 0.35 : 0) + contaminacion(c) * 0.8 + ((c.comida || 0) < hab * 0.3 ? 0.35 : 0);
    const freno = c.regimen === 'dictadura' ? 0.5 : c.regimen === 'estado_obrero' ? 0.6 : 1;
    if (!(malestar > 0.15 && azar(v) < 0.05 * malestar * freno)) return;
    c.ultimaHuelga = m.turno; c.huelgasN = (c.huelgasN || 0) + 1;
    // La revolución: tras varias huelgas, con el pueblo muy descontento.
    if (c.huelgasN >= 3 && c.estab < 22) {
      const antes = c.regimen, nuevo = c.regimen === 'estado_obrero' ? 'democracia' : azar(v) < 0.45 ? 'estado_obrero' : c.regimen === 'democracia' ? 'dictadura' : 'democracia';
      c.regimen = nuevo; c.estab = 45; c.huelgasN = 0;
      if (S().gobernante) c.rey = S().gobernante(m, c, 35 + Math.floor(azar(v) * 20));
      S().cronica(m, 'revolucion', 'Revolución en ' + c.nombre, 'Los obreros de las fábricas toman las calles con banderas rojas y cantos. ' + T(M.conArticulo ? M.conArticulo(antes) : antes) + ' cae y nace ' + (M.unoDe ? M.unoDe(nuevo) : nuevo) + '. Al frente, ' + S().nombreRey(c) + '.', c, null, { importante: true });
      (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '✊ ¡Revolución! Ahora ' + (M.unoDe ? M.unoDe(nuevo) : nuevo) });
      return;
    }
    c.huelga = { desde: m.turno, hasta: m.turno + 8 };
    const motivo = c.estab < 40 ? 'la gente está harta' : imp > 1.2 ? 'los impuestos son muy altos' : contaminacion(c) > 0.2 ? 'el humo de las fábricas enferma a sus familias' : 'el pan no llega para todos';
    (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '✊ Huelga en las fábricas: ' + motivo });
    S().cronica(m, 'revuelta', 'Huelga obrera en ' + c.nombre, 'Las fábricas se paran: los obreros dicen que ' + motivo + '. Piden mejores salarios. Mientras dure, no se produce nada y el descontento crece.' + (c.jugador ? ' Puedes «subir los salarios» (cuesta oro) o «reprimir la huelga».' : ''), c);
  }
  const T = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
  // Cada turno, cada reino quema el combustible de sus fábricas, trenes y centrales; lo que no puede pagar se para.
  function quemar(m, c) {
    const antes = Object.assign({}, c.paradas || {}), par = c.paradas = {};
    if (c.era < 6) return;
    c.carbon = c.carbon || 0; c.petroleo = c.petroleo || 0;
    for (const [k, n] of [['central', c.centrales || 0], ['tren', c.estaciones || 0], ['fabrica', c.fabricas || 0]]) {
      if (!n) continue;
      const q = GASTO[k] * n;
      if (c.carbon >= q) c.carbon -= q;
      else if (k === 'central' && c.petroleo >= q) c.petroleo -= q;
      else par[k] = 1;
    }
    c.carbon = Math.round(c.carbon * 100) / 100; c.petroleo = Math.round(c.petroleo * 100) / 100;
    // Se avisa cuando algo se para (o vuelve a andar), una vez.
    const NOMBRE = { fabrica: 'las fábricas', tren: 'los trenes', central: 'la luz eléctrica' };
    for (const k of Object.keys(NOMBRE)) {
      if (par[k] && !antes[k]) { (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '⛽ Sin ' + (k === 'central' ? 'carbón ni petróleo' : 'carbón') + ': se paran ' + NOMBRE[k] }); if (c.jugador) S().cronica(m, 'quiebra', 'Se paran ' + NOMBRE[k] + ' de ' + c.nombre, 'No queda ' + (k === 'central' ? 'carbón ni petróleo' : 'carbón') + ' que quemar. Hay que sacarlo de las minas, comprarlo en el mercado o quitárselo a quien lo tenga.', c); }
      else if (!par[k] && antes[k]) (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '⛽ Vuelven a andar ' + NOMBRE[k] });
    }
  }

  // Árboles y rocas al crear el mundo, según el suelo de la parcela.
  const ARBOLES = { bosque: 0.9, selva: 0.93, taiga: 0.82, sakura: 0.62, pantano: 0.32, sabana: 0.1, colina: 0.22, llanura: 0.07, tundra: 0.06, nieve: 0.1, desierto: 0.03 };
  const ROCAS = { sakura: 0.02, montana: 0.3, colina: 0.12, desierto: 0.06, nieve: 0.05, tundra: 0.07, llanura: 0.015, bosque: 0.02, taiga: 0.03, sabana: 0.02 };
  // Lo que brota solo cada turno junto a otro árbol (la naturaleza recupera lo que se deja).
  const BROTE = { sakura: 0.03, bosque: 0.035, selva: 0.05, taiga: 0.025, pantano: 0.015, sabana: 0.005, colina: 0.025, llanura: 0.006, tundra: 0.002, nieve: 0.004, desierto: 0.0015 };
  const CONSTRUIBLE = new Set(['sakura', 'llanura', 'colina', 'bosque', 'desierto', 'nieve', 'arena', 'sabana', 'selva', 'taiga', 'tundra', 'pantano']);
  const CULTIVABLE = new Set(['llanura', 'colina', 'bosque', 'sabana', 'selva', 'sakura']);

  function azar(v) {
    let t = (v.rng = (v.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- El suelo de cada parcela ----------
  const esAgua = t => t === 'mar' || t === 'costa';
  /*
   * Las regiones son cuadradas, pero el suelo no: cada parcela mira a la región que tiene al lado de un punto
   * desplazado por un ruido suave, así las costas y los linderos entre biomas ondulan como en WorldBox. El
   * cuadrado del medio de cada región (donde va la plaza) es siempre suyo. Los ríos van de centro a centro
   * dando rodeos, y el agua que toca tierra es poco honda.
   */
  function hashR(sem, x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(sem, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function ruido(sem, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hashR(sem, x0, y0), b = hashR(sem, x0 + 1, y0), c = hashR(sem, x0, y0 + 1), d = hashR(sem, x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  const desvio = (sem, x, y) => (ruido(sem, x / 5, y / 5) - 0.5) * 2.6 + (ruido(sem + 7, x / 2, y / 2) - 0.5) * 1.1;
  function baseEn(m, tx, ty) {
    const rx0 = (tx / SUB) | 0, ry0 = (ty / SUB) | 0, lx = tx - rx0 * SUB, ly = ty - ry0 * SUB;
    let rx = rx0, ry = ry0;
    if (!(lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2)) {
      const sem = m.semilla | 0;
      rx = Math.max(0, Math.min(m.W - 1, Math.floor((tx + 0.5 + desvio(sem, tx, ty)) / SUB)));
      ry = Math.max(0, Math.min(m.H - 1, Math.floor((ty + 0.5 + desvio(sem + 101, tx, ty)) / SUB)));
    }
    const tipo = m.tipo[ry * m.W + rx];
    return tipo === 'mar' ? 'agua' : tipo === 'costa' ? 'bajo' : tipo;
  }
  // El cauce de un río entre dos puntos: pasos de una parcela, eligiendo al azar (fijo) si avanza en x o en y.
  function cauce(m, arr, tw, x0, y0, x1, y1, sem) {
    let x = x0, y = y0, k = 0;
    while (x !== x1 || y !== y1) {
      const t = y * tw + x;
      if (k > 0 && (arr[t] === 'agua' || arr[t] === 'bajo')) return;
      if (arr[t] !== 'agua' && arr[t] !== 'bajo') arr[t] = 'rio';
      const ddx = x1 - x, ddy = y1 - y, h = hashR(sem, x, y + k);
      let enX = ddx && (!ddy || h < Math.abs(ddx) / (Math.abs(ddx) + Math.abs(ddy)));
      // El cuadrado del medio de cada región (la plaza) se rodea si se puede.
      if (ddx && ddy) { const cx = enX ? x + Math.sign(ddx) : x, cy = enX ? y : y + Math.sign(ddy); if (medio(cx, cy)) enX = !enX; }
      if (enX) x += Math.sign(ddx); else y += Math.sign(ddy);
      k++;
    }
    const t = y * tw + x;
    if (arr[t] !== 'agua' && arr[t] !== 'bajo') arr[t] = 'rio';
  }
  const medio = (x, y) => { const lx = x % SUB, ly = y % SUB; return lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2; };
  // El río pasa por una esquina de cada región, nunca por su centro.
  function centroRio(m, rx, ry) { const h = hashR((m.semilla | 0) + 31, rx, ry); return [rx * SUB + (h < 0.5 ? 0 : 3), ry * SUB + ((h * 4 | 0) % 2 ? 3 : 0)]; }
  function rios(m, arr, tw) {
    const sem = (m.semilla | 0) + 57;
    for (let ry = 0; ry < m.H; ry++) for (let rx = 0; rx < m.W; rx++) {
      if (!m.rio[ry * m.W + rx] || esAgua(m.tipo[ry * m.W + rx])) continue;
      const [cx, cy] = centroRio(m, rx, ry);
      arr[cy * tw + cx] = 'rio';
      // Como al crear el mundo, el río baja hacia la región vecina más baja: un solo cauce, sin lazos.
      const r = ry * m.W + rx, sig = S().vecinos(r).sort((p, q) => m.alto[p] - m.alto[q])[0];
      if (sig == null || m.alto[sig] >= m.alto[r]) { if (sig != null) lago(m, arr, tw, cx + Math.sign(sig % m.W - rx) * 2, cy + Math.sign((sig / m.W | 0) - ry) * 2); continue; }
      const nx = sig % m.W, ny = (sig / m.W) | 0, dx = nx - rx, dy = ny - ry, agua = esAgua(m.tipo[sig]);
      // A medio camino, un punto del lindero desplazado: el río no cruza siempre por el mismo sitio.
      const h = hashR(sem, rx * 2 + dx, ry * 2 + dy), mx = dx ? (dx > 0 ? rx * SUB + SUB - 1 + (h < 0.5 ? 0 : 1) : rx * SUB - (h < 0.5 ? 0 : 1)) : cx + Math.round((h - 0.5) * 3);
      const my = dy ? (dy > 0 ? ry * SUB + SUB - 1 + (h < 0.5 ? 0 : 1) : ry * SUB - (h < 0.5 ? 0 : 1)) : cy + Math.round((h - 0.5) * 3);
      const mxx = Math.max(0, Math.min(tw - 1, mx)), myy = Math.max(0, Math.min(m.H * SUB - 1, my));
      cauce(m, arr, tw, cx, cy, mxx, myy, sem);
      if (agua) { // hasta el agua: se sigue en la misma dirección hasta tocarla
        let x = mxx, y = myy, n = 0;
        while (n++ < SUB * 2 && x >= 0 && y >= 0 && x < tw && y < m.H * SUB && arr[y * tw + x] !== 'agua' && arr[y * tw + x] !== 'bajo') { arr[y * tw + x] = 'rio'; x += dx; y += dy; }
      } else { const [ox, oy] = centroRio(m, nx, ny); cauce(m, arr, tw, mxx, myy, ox, oy, sem + 1); if (!m.rio[sig]) lago(m, arr, tw, ox + dx * 2, oy + dy * 2); }
    }
  }
  // Donde un río ya no tiene por dónde bajar, se remansa en un lago pequeño.
  function lago(m, arr, tw, cx, cy) {
    const th = m.H * SUB;
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= tw || y >= th) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy) + hashR(m.semilla | 0, x, y) * 1.2;
      const lx = x % SUB, ly = y % SUB; // el cuadrado del medio de cada región queda en tierra (ahí va la plaza)
      if (d < 2.6 && !(lx >= 1 && lx <= 2 && ly >= 1 && ly <= 2) && arr[y * tw + x] !== 'montana' && arr[y * tw + x] !== 'nieve') arr[y * tw + x] = 'bajo';
    }
  }
  function terrenosNuevos(m) {
    const tw = m.W * SUB, th = m.H * SUB, arr = new Array(tw * th);
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) arr[ty * tw + tx] = baseEn(m, tx, ty);
    rios(m, arr, tw);
    const tierraFirme = x => x !== 'agua' && x !== 'bajo' && x !== 'rio';
    // La hondura del mar según lo lejos que está la tierra: poco hondo junto a la orilla, hondo mar adentro.
    const lejos = new Array(tw * th).fill(99), cola = [];
    for (let t = 0; t < tw * th; t++) if (tierraFirme(arr[t])) { lejos[t] = 0; cola.push(t); }
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], d = lejos[t] + 1, x = t % tw;
      if (d > 3) continue;
      for (const u of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) if (u >= 0 && u < tw * th && lejos[u] > d) { lejos[u] = d; cola.push(u); }
    }
    const out = arr.slice();
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const t = ty * tw + tx, a = arr[t];
      if (a === 'agua' || a === 'bajo') { out[t] = lejos[t] <= 2 + (hashR(m.semilla | 0, tx >> 1, ty >> 1) < 0.4 ? 1 : 0) ? 'bajo' : 'agua'; continue; }
      const vec = [tx > 0 ? arr[t - 1] : a, tx < tw - 1 ? arr[t + 1] : a, ty > 0 ? arr[t - tw] : a, ty < th - 1 ? arr[t + tw] : a];
      if (tierraFirme(a) && a !== 'montana' && a !== 'nieve' && vec.some(x => x === 'agua' || x === 'bajo')) out[t] = 'arena';
    }
    return out;
  }
  // El suelo solo cambia cuando cambia una región (un bosque talado, un terremoto): se guarda calculado.
  let cache = { m: null, firma: '', arr: null };
  function terrenos(m) {
    const firma = m.tipo.join(',');
    if (cache.m === m && cache.firma === firma) return cache.arr;
    const arr = terrenosNuevos(m);
    cache = { m, firma, arr };
    return arr;
  }
  const region = (m, t) => { const tw = m.W * SUB; return (((t / tw) | 0) / SUB | 0) * m.W + ((t % tw) / SUB | 0); };
  const centro = (m, r) => { const tw = m.W * SUB; return ((r / m.W | 0) * SUB + 2) * tw + (r % m.W) * SUB + 2; };
  const parcelas = (m, r) => {
    const tw = m.W * SUB, x0 = (r % m.W) * SUB, y0 = (r / m.W | 0) * SUB, out = [];
    for (let y = 0; y < SUB; y++) for (let x = 0; x < SUB; x++) out.push((y0 + y) * tw + x0 + x);
    return out;
  };
  const dist = (m, a, b) => { const tw = m.W * SUB; return Math.abs(a % tw - b % tw) + Math.abs((a / tw | 0) - (b / tw | 0)); };
  // Se camina por tierra (y por los puentes); el agua se cruza nadando, y en el mar uno se puede ahogar.
  const mojada = t => t === 'agua' || t === 'bajo' || t === 'rio';
  const andable = ter => !mojada(ter);

  // Las islas: tierras pequeñas rodeadas de mar (como mucho 10 regiones).
  function islas(m) {
    const n = m.W * m.H, isla = new Array(n).fill(false), visto = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (visto[i] || !S().esTierra(m, i)) continue;
      const grupo = [i]; visto[i] = true;
      for (let k = 0; k < grupo.length && grupo.length <= 11; k++) for (const w of S().vecinos(grupo[k])) if (!visto[w] && S().esTierra(m, w)) { visto[w] = true; grupo.push(w); }
      if (grupo.length <= 10) for (const g of grupo) isla[g] = true;
      else { const cola = grupo.slice(); for (let k = 0; k < cola.length; k++) for (const w of S().vecinos(cola[k])) if (!visto[w] && S().esTierra(m, w)) { visto[w] = true; cola.push(w); } }
    }
    return isla;
  }
  // ---------- Crear la vida de un mundo ----------
  function crear(m) {
    const tw = m.W * SUB, th = m.H * SUB, n = tw * th;
    const v = {
      tw, th, rng: (m.semilla ^ 0x9E3779B9) >>> 0, arbol: new Array(n).fill(0), roca: new Array(n).fill(0), obra: new Array(n).fill(0), mena: new Array(n).fill(0), cultivo: new Array(n).fill(0), camino: new Array(n).fill(0), rutas: [], animales: [], ejercitos: {}, disparos: [],
      fueBosque: new Array(m.W * m.H).fill(0), tipoVisto: m.tipo.slice(), aldeanos: [], sig: 0, centros: {}, cambios: [], avisos: {}
    };
    m.vida = v;
    const ter = terrenos(m);
    v.isla = islas(m);
    for (let t = 0; t < n; t++) {
      // Las playas cálidas y las islas tienen palmeras.
      const rt = m.tipo[region(m, t)], calido = rt === 'selva' || rt === 'sabana' || rt === 'desierto' || v.isla[region(m, t)];
      const r = azar(v), pa = ter[t] === 'arena' ? (v.isla[region(m, t)] ? 0.32 : calido ? 0.16 : 0) : (ARBOLES[ter[t]] || 0) + (v.isla[region(m, t)] && ter[t] !== 'montana' ? 0.15 : 0), pr = ROCAS[ter[t]] || 0;
      if (r < pa) v.arbol[t] = azar(v) < 0.75 ? 3 : 2;
      else if (r < pa + pr) { v.roca[t] = 1 + Math.floor(azar(v) * 3); const [ph, po] = MENAS[ter[t]] || [0.04, 0.01], q = azar(v); v.mena[t] = q < po ? 2 : q < po + ph ? 1 : 0; }
    }
    for (const c of S().vivas(m)) { c.madera = c.madera || 6; c.piedra = c.piedra || 0; c.metal = c.metal || 0; c.oro = c.oro || 0; c.comida = c.comida == null ? 30 : c.comida; }
    centros(m);
    sincronizar(m);
    contar(m);
    actualizarPoblacion(m);
    return v;
  }

  // Anota un cambio de parcela con el paso en que ocurre (la vista lo aplica en ese momento).
  function cambiar(m, capa, t, valor, paso) {
    const v = m.vida;
    if (v[capa][t] === valor) return;
    v.cambios.push([capa === 'arbol' ? 0 : capa === 'roca' ? 1 : capa === 'obra' ? 2 : capa === 'cultivo' ? 4 : 5, t, v[capa][t], valor, paso]);
    v[capa][t] = valor;
    if (capa === 'obra' && pausada(m)) registrar(m, t, valor);
  }
  /*
   * LA FICHA DE CADA EDIFICIO (partidas pausadas): v.edificios[t] = { tipo, nombre, anio, era, civ, por, historia }.
   *  · Tiene nombre propio («Casa de los Arnez», «Molino del Arroyo», «Iglesia de San Teodo»…).
   *  · Recuerda el año en que se levantó, quién lo construyó y en qué edad: se ve con el estilo de esa edad,
   *    y no cambia de golpe cuando el reino avanza; lo reforman los constructores poco a poco.
   *  · Si se arruina o se derriba, queda escrito en su historia (o desaparece la ficha).
   */
  const DIOSES = ['Anu', 'Tamar', 'Belo', 'Ishara', 'Dagán', 'Nera', 'Ormo', 'Sefa', 'Kalu', 'Aret'];
  const LUGARES_ = ['del Arroyo', 'Viejo', 'de la Loma', 'del Cerro', 'Nuevo', 'de la Vega', 'del Prado', 'de los Álamos', 'del Río', 'de la Fuente'];
  const de = (v, l) => l[Math.floor(azar(v) * l.length)];
  function lugarDe(m, t) {
    const r = region(m, t), x = (m.ciudades || []).find(y => y.region === r || S().vecinos(y.region).includes(r));
    const c = S().civ(m, m.dueno[r]);
    return x ? x.nombre : c ? c.nombre : 'la llanura';
  }
  function nombreEdificio(m, o, t, obreros) {
    const v = m.vida, c = S().civ(m, m.dueno[region(m, t)]), era = c ? c.era : 0, sitio = lugarDe(m, t);
    const fam = obreros && obreros.length ? obreros[0].familia : M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + APELLIDOS[Math.floor(azar(v) * APELLIDOS.length)];
    const santo = persona(v);
    switch (o) {
      case OBRA.casa: return 'Casa de los ' + fam;
      case OBRA.molino: return 'Molino ' + de(v, LUGARES_);
      case OBRA.templo: return era <= 1 ? 'Santuario de ' + de(v, DIOSES) : era <= 3 ? 'Templo de ' + de(v, DIOSES) : era === 4 ? 'Iglesia de San ' + santo : era <= 6 ? 'Catedral de Santa ' + santo : 'Parroquia de San ' + santo;
      case OBRA.saber: return M.CASA_SABER(era).charAt(0).toUpperCase() + M.CASA_SABER(era).slice(1) + ' de ' + santo;
      case OBRA.torre: return 'Torre ' + de(v, ['del Vigía', 'del Norte', 'del Sur', 'Vieja', 'del Río', 'de la Frontera', 'del Alba']);
      case OBRA.cuartel: return 'Cuartel de ' + sitio;
      case OBRA.arqueria: return 'Arquería de ' + sitio;
      case OBRA.castillo: return 'Castillo de ' + sitio;
      case OBRA.puerto: return 'Puerto de ' + sitio;
      case OBRA.pozo: return 'Pozo ' + de(v, ['de la Plaza', 'del Agua Dulce', 'Viejo', 'de los ' + fam, 'Hondo']);
      case OBRA.granero: return 'Granero ' + de(v, ['Grande', 'de la Cosecha', 'de los ' + fam, 'del Común']);
      case OBRA.fuente: return 'Plaza de ' + santo;
      case OBRA.parque: return 'Parque de ' + santo;
      case OBRA.palacio: return 'Palacio de ' + (c ? c.nombre : sitio);
      case OBRA.central: return 'Central eléctrica de ' + sitio;
      case OBRA.banco: return 'Banco ' + fam;
      case OBRA.fabrica: return 'Fábrica ' + fam + ' e Hijos';
      case OBRA.estacion: return 'Estación de ' + sitio;
      case OBRA.hospital: return 'Hospital de San ' + santo;
      case OBRA.aerodromo: return 'Aeródromo de ' + sitio;
      case OBRA.campamento: return 'Campamento de ' + sitio;
      case OBRA.aduana: return 'Puesto fronterizo de ' + sitio;
      case OBRA.mina: return 'Mina ' + de(v, ['de ' + sitio, 'La Esperanza', 'del Cerro', 'Honda', 'de San ' + santo, 'Vieja', 'de los ' + fam]);
      case OBRA.petroleo: return 'Pozo de petróleo ' + de(v, ['Esperanza', 'Negro', 'de ' + sitio, 'del Llano', 'Número 1', 'de los ' + fam]);
      case OBRA.ayuntamiento: return 'Ayuntamiento de ' + sitio;
      case OBRA.centro: return 'Plaza mayor de ' + (c ? c.nombre : sitio);
      default: return 'Edificio de ' + sitio;
    }
  }
  function registrar(m, t, o) {
    const v = m.vida;
    v.edificios = v.edificios || {};
    const rec = v.edificios[t];
    if (!o || o === OBRA.campo) { delete v.edificios[t]; return; }
    if (o === OBRA.ruina) { if (rec) { rec.ruina = m.anio; rec.historia.push({ anio: m.anio, texto: 'quedó en ruinas' }); } return; }
    if (rec && rec.tipo === o && !rec.ruina) return;
    const c = S().civ(m, m.dueno[region(m, t)]), obreros = (v.obreros && v.obreros[t]) || [];
    const porQuien = obreros.map(id => v.aldeanos.find(a => a.id === id)).filter(Boolean);
    v.edificios[t] = { tipo: o, nombre: nombreEdificio(m, o, t, porQuien), anio: m.anio, turno: m.turno, era: c ? c.era : 0, civ: c ? c.id : -1, por: porQuien.slice(0, 4).map(a => a.nombre + ' ' + (a.familia || '')), historia: [{ anio: m.anio, texto: rec && rec.ruina ? 'reconstruido sobre las ruinas' : 'construido' }] };
    if (v.obreros) delete v.obreros[t];
  }
  const SIN_REFORMA = new Set([OBRA.campamento, OBRA.centro, OBRA.campo, OBRA.ruina]);
  function apuntarObrero(m, t, a) { const v = m.vida; v.obreros = v.obreros || {}; const l = v.obreros[t] = v.obreros[t] || []; if (!l.includes(a.id)) l.push(a.id); }

  // La plaza de cada capital: 2×2 parcelas en el centro de su región. Las capitales perdidas quedan en ruinas.
  function centros(m) {
    const v = m.vida;
    for (const id of Object.keys(v.centros)) {
      const c = S().civ(m, +id), r = v.centros[id];
      if (c && c.viva && c.capital === r) continue;
      for (const t of plaza(m, r)) if (v.obra[t] === OBRA.centro) cambiar(m, 'obra', t, OBRA.ruina, 0);
      delete v.centros[id];
    }
    for (const c of S().vivas(m)) {
      if (c.madera == null) { c.madera = 6; c.piedra = 0; c.casas = 0; c.campos = 0; }
      if (c.metal == null) { c.metal = 0; c.oro = 0; }
      if (c.comida == null) c.comida = 30;
      if (v.centros[c.id] === c.capital) continue;
      // La corte que huye a otra ciudad se instala en lo que ya hay: no brota una plaza nueva ni un molino.
      if (c.mudada != null) {
        for (const t of plaza(m, c.capital)) if (!v.obra[t] && !v.camino[t]) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
        v.centros[c.id] = c.capital; c.mudada = null;
        continue;
      }
      for (const t of plaza(m, c.capital)) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
      v.centros[c.id] = c.capital;
      // Como en WorldBox, la aldea nace con su molino: alrededor de él se siembran los primeros campos.
      const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r));
      if (!zona.some(t => v.obra[t] === OBRA.molino)) {
        const ter = terrenos(m), pl = plaza(m, c.capital);
        const t = zona.filter(x => !v.obra[x] && !pl.includes(x) && CONSTRUIBLE.has(ter[x]) && ter[x] !== 'arena').sort((p, q) => dist(m, p, pl[3]) - dist(m, q, pl[3]))[0];
        if (t != null) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.molino, 0); }
      }
    }
  }
  function plaza(m, r) { const tw = m.W * SUB, x = (r % m.W) * SUB + 1, y = (r / m.W | 0) * SUB + 1; return [y * tw + x, y * tw + x + 1, (y + 1) * tw + x, (y + 1) * tw + x + 1]; }

  // ---------- Los aldeanos de cada pueblo ----------
  const cuantos = c => Math.max(4, Math.min(60, Math.round(3 + Math.sqrt(Math.max(0, c.pob)) * 2)));

  /*
   * EL GOBERNADOR AUTOMÁTICO: cada pueblo (también el del jugador) reparte el trabajo según lo que le falta.
   * Poca madera → más leñadores; la gente cerca del límite de comida → más granjeros; faltan casas → más
   * constructores; guerra → guerreros. Las prioridades del jugador (0 a 2) pesan sobre esas necesidades.
   */
  /*
   * EL MERCADO GLOBAL (partidas pausadas).
   *  · Cada bien (comida, madera, piedra, metal y armas) tiene un precio mundial que sale de lo que hay en todos
   *    los graneros y almacenes frente a lo que todos necesitan: si sobra madera en el mundo, la madera baja;
   *    si escasea, se encarece.
   *  · Cada reino elige qué producir según su tierra, su carácter y los precios (su especialidad), y produce
   *    de más para vender.
   *  · Pero solo se compra y se vende con quien se comercia de verdad: los comerciantes van por las rutas entre
   *    reinos con la carreta cargada de lo que al otro le falta, lo venden a precio de mercado (más caro si es
   *    urgente) y vuelven con lo que falta en casa, pagado con oro. Quien tiene socios puede esperar al
   *    comerciante en vez de producirlo todo; quien no, tiene que hacerlo él.
   */
  // Todo lo que se produce o se fabrica se puede vender: las materias primas, las armas que hace la forja,
  // los muebles de la fábrica y los vehículos de guerra (cañones, artillería, tanques) que salen del cuartel.
  const BIENES = ['comida', 'madera', 'piedra', 'metal', 'armas', 'carbon', 'petroleo', 'muebles', 'vehiculos', 'semillas'];
  const PRECIO_BASE = { comida: 0.5, madera: 0.6, piedra: 0.9, metal: 2.5, armas: 6, carbon: 1.4, petroleo: 3.2, muebles: 2.4, vehiculos: 30, semillas: 0.35 };
  const NOMBRE_BIEN = { comida: 'comida', madera: 'madera', piedra: 'piedra', metal: 'metal', armas: 'armas', carbon: 'carbón', petroleo: 'petróleo', muebles: 'muebles', vehiculos: 'vehículos de guerra', semillas: 'semillas de árbol' };
  // Los bienes que un reino conoce: las armas desde el Bronce, el carbón desde la industria, el petróleo en la Era Moderna.
  const bienesDe = c => BIENES.filter(k => (k !== 'armas' || c.era >= 1) && (k !== 'carbon' || c.era >= 6) && (k !== 'petroleo' || c.era >= 7) && (k !== 'muebles' || c.era >= 6) && (k !== 'vehiculos' || c.era >= 5));
  const tanquesDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.veh === 'tanque').length;
  // Lo que un reino quiere tener de cada cosa.
  function objetivo(c, k) {
    const n = c.aldeanos || 0;
    if (k === 'comida') return Math.max(8, n * 3);
    if (k === 'madera') return metaMadera(c);
    if (k === 'piedra') return c.era >= 1 ? 20 + 10 * c.era : 6;
    if (k === 'metal') return c.era >= 1 ? 6 + Math.round((c.guerreros || 0) * 0.6) + 2 * c.era : 0;
    if (k === 'armas') return c.era >= 1 ? Math.max(0, (c.guerreros || 0) - (c.armados || 0)) + (c.guerras && c.guerras.length ? 6 : 0) : 0;
    if (k === 'carbon') return c.era >= 6 ? 4 + Math.round(((c.fabricas || 0) * GASTO.fabrica + (c.estaciones || 0) * GASTO.tren + (c.centrales || 0) * GASTO.central) * 15) : 0;
    // Los muebles los quieren las casas de las ciudades industriales; los vehículos, los cuarteles (sobre todo en guerra).
    // Semillas de árbol: las que hacen falta para replantar (más si el bosque cercano escasea).
    if (k === 'semillas') return 6 + Math.max(0, 20 - Math.round((c.arboles || 0) / 6));
    if (k === 'muebles') return c.era >= 6 ? Math.round((c.casas || 0) * 0.2) : 0;
    if (k === 'vehiculos') return c.era >= 5 && c.cuarteles > 0 ? (c.guerras && c.guerras.length ? 4 : 1) : 0;
    if (k === 'petroleo') return c.era >= 7 ? 6 + (c.aerodromos || 0) * 8 + (c.era >= 8 ? 10 + (c.guerras && c.guerras.length ? 12 : 0) : 0) : 0;
    return 0;
  }
  // Lo que le sobra, lo que le falta y cuánta prisa le corre (0 nada, 1 mucha, 2 desesperado).
  function balance(m, c) {
    const out = { sobra: {}, falta: {}, urg: {} }, p = c.plan || {};
    for (const k of BIENES) {
      const ob = objetivo(c, k), hay = c[k] || 0;
      const venta = (p.ventas || []).filter(x => x.que === k).reduce((q, x) => q + x.n, 0);
      out.sobra[k] = Math.max(0, hay - ob * ((c.cartera && c.cartera[k]) ? 1.05 : 1.35)) + Math.min(hay, venta);
      out.falta[k] = Math.max(0, ob - hay);
      out.urg[k] = ob > 0 ? Math.min(1, out.falta[k] / ob) : 0;
      if (k === 'comida' && hay < n0(c) * 0.6) out.urg[k] = 1.6;
      if (k === 'armas' && c.guerras && c.guerras.length && out.falta[k] > 0) out.urg[k] = Math.max(out.urg[k], 1.2);
      const pedido = (p.pedidos || []).filter(x => x.que === k).reduce((q, x) => q + x.n, 0);
      if (pedido > 0) { out.falta[k] = Math.max(out.falta[k], pedido); out.urg[k] = Math.max(out.urg[k], 1.5); }
    }
    return out;
  }
  const n0 = c => c.aldeanos || 0;
  // Qué le conviene producir: lo que su tierra da, lo que su carácter prefiere y lo que mejor se paga.
  function aptitudes(m, c, recursos) {
    return {
      comida: 0.6 + Math.min(1.2, (c.campos || 0) / Math.max(4, metaCampos(c))) * (S().fertil(m, c.capital) / 2),
      madera: recursos && recursos.arboles ? 0.4 + Math.min(1.2, recursos.arboles / 30) : 0,
      piedra: recursos && recursos.rocas ? 0.3 + Math.min(1, recursos.rocas / 25) : 0,
      metal: c.era >= 1 && recursos && recursos.rocas ? 0.3 + Math.min(1, recursos.rocas / 30) : 0,
      armas: c.era >= 1 && c.cuarteles > 0 ? 0.5 + Math.min(0.8, (c.metal || 0) / 40) : 0,
      carbon: c.era >= 6 && recursos && recursos.carbones ? 0.4 + Math.min(1.2, recursos.carbones / 12) : 0,
      petroleo: c.era >= 7 && (c.pozosPetroleo || 0) > 0 ? 0.7 + 0.35 * c.pozosPetroleo : 0,
      semillas: recursos && recursos.arboles ? 0.15 + Math.min(0.6, recursos.arboles / 90) : 0,
      muebles: c.era >= 6 && (c.fabricas || 0) > 0 ? 0.5 + 0.3 * c.fabricas : 0,
      vehiculos: c.era >= 5 && c.cuarteles > 0 ? 0.3 + Math.min(0.8, (c.metal || 0) / 60) : 0
    };
  }
  /*
   * LA CARTERA DE CADA REINO: no se casa con un solo bien. Cada seis turnos mira qué le rinde de verdad:
   *  · lo que su tierra da mejor que la de los demás (ventaja comparativa) y lo que le gusta por carácter;
   *  · el precio de hoy y hacia dónde va (si sube, apetece; si se hunde, no);
   *  · el oro que de verdad le ha dado venderlo últimamente;
   *  · si ya hay muchos reinos en lo mismo (el mercado se va a llenar y el precio caerá);
   *  · si tiene el almacén a rebosar sin poder venderlo (eso ya no rinde).
   * Reparte su trabajo entre sus dos o tres bienes más rentables, y solo cambia de bien principal cuando otro
   * rinde claramente más (cambiar de oficio cuesta), y entonces lo cuenta la crónica.
   */
  const GUSTO = { guerrero: { armas: 0.6, metal: 0.3 }, mercader: { madera: 0.2, metal: 0.3 }, agricola: { comida: 0.5 }, constructor: { piedra: 0.5, madera: 0.2 }, sabio: {}, devoto: { comida: 0.2 } };
  function rentabilidades(m, c, recursos, media, cuantos) {
    const mk = m.mercado, out = {};
    const bruto = aptitudes(m, c, recursos), gusto = GUSTO[c.caracter] || {};
    for (const k of BIENES) {
      if (bruto[k] <= 0) { out[k] = 0; continue; }
      const apt = bruto[k] / Math.max(0.2, (media && media[k]) || bruto[k]) * Math.sqrt(bruto[k]);
      const h = (mk && mk.historia[k]) || [], precio = mk ? mk.precio[k] / PRECIO_BASE[k] : 1;
      const tendencia = h.length > 6 ? Math.max(-0.4, Math.min(0.4, (h[h.length - 1] - h[h.length - 7]) / Math.max(0.01, h[h.length - 7]))) : 0;
      const ganado = ((c.ganado || {})[k] || 0) / Math.max(5, (c.aldeanos || 10) * 0.3);
      const otros = Math.max(0, ((cuantos || {})[k] || 0) - (c.especialidad === k ? 1 : 0));
      const lleno = (c[k] || 0) > objetivo(c, k) * 3 + 10 ? 0.6 : 1;
      out[k] = apt * Math.sqrt(precio) * (1 + tendencia) * (1 + Math.min(1, ganado)) * (1 + (gusto[k] || 0)) * lleno / (1 + 0.18 * otros);
    }
    return out;
  }
  function evaluarCartera(m, c, recursos, media, cuantos) {
    const v = m.vida, p = c.plan || {};
    c.rentable = rentabilidades(m, c, recursos, media, cuantos);
    if (p.especialidad) { c.cartera = { [p.especialidad]: 1 }; c.especialidad = p.especialidad; return; }
    const orden = BIENES.filter(k => c.rentable[k] > 0).map(k => [k, c.rentable[k] * (0.92 + azar(v) * 0.16)]).sort((a, b) => b[1] - a[1]);
    if (!orden.length) { c.cartera = { comida: 1 }; c.especialidad = 'comida'; return; }
    // Solo se cambia de bien principal si el nuevo rinde al menos un 25 % más que el de ahora.
    let principal = orden[0][0];
    const actual = c.especialidad && c.rentable[c.especialidad] > 0 ? c.especialidad : null;
    if (actual && principal !== actual && (orden[0][1] < c.rentable[actual] * 1.25 || m.turno - ((c.cambiosEsp || []).slice(-1)[0] || { t: -99 }).t < 24)) principal = actual;
    const top = [principal, ...orden.map(x => x[0]).filter(k => k !== principal)].slice(0, 3);
    const pesos = top.map((k, i) => Math.max(0.01, c.rentable[k]) * (i === 0 ? 1.6 : 1));
    const suma = pesos.reduce((a, b) => a + b, 0);
    c.cartera = {}; top.forEach((k, i) => { c.cartera[k] = Math.round(pesos[i] / suma * 100) / 100; });
    if (actual && principal !== actual) {
      const motivo = (c.ganado && (c.ganado[principal] || 0) > (c.ganado[actual] || 0)) ? 'le da más oro' : (m.mercado && m.mercado.precio[principal] / PRECIO_BASE[principal] > m.mercado.precio[actual] / PRECIO_BASE[actual]) ? 'se paga mejor' : 'su tierra rinde más en eso';
      (c.cambiosEsp = c.cambiosEsp || []).push({ t: m.turno, de: actual, a: principal, motivo });
      if (c.cambiosEsp.length > 8) c.cambiosEsp.shift();
      if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚖ Tu pueblo se pasa a ' + NOMBRE_BIEN[principal] + ': ' + motivo });
      else if (azar(v) < 0.35) S().cronica(m, 'comercio', c.nombre + ' deja ' + (actual === 'armas' ? 'las armas' : 'la ' + NOMBRE_BIEN[actual]) + ' por ' + (principal === 'armas' ? 'las armas' : 'la ' + NOMBRE_BIEN[principal]), 'Los mercaderes de ' + c.nombre + ' ya no sacan lo de antes con ' + NOMBRE_BIEN[actual] + ': ' + NOMBRE_BIEN[principal] + ' ' + motivo + '. Talleres y campos cambian de oficio.', c);
    }
    c.especialidad = principal;
  }
  function mercado(m, recursosDe) {
    const v = m.vida, vivas = S().vivas(m);
    const mk = m.mercado = m.mercado || { precio: Object.assign({}, PRECIO_BASE), historia: {}, oferta: {}, demanda: {} };
    for (const k of BIENES) {
      let of = 0, de = 0;
      for (const c of vivas) { of += c[k] || 0; de += objetivo(c, k); }
      mk.oferta[k] = Math.round(of); mk.demanda[k] = Math.round(de);
      if (mk.precio[k] == null) mk.precio[k] = PRECIO_BASE[k];
      const nuevo = PRECIO_BASE[k] * Math.pow(Math.max(0.3, Math.min(3, (de + 5) / (of + 5))), 0.7) * (mk.suceso && mk.suceso.k === k ? mk.suceso.f : 1);
      mk.precio[k] = Math.round((mk.precio[k] * 0.75 + nuevo * 0.25) * 100) / 100;
      const h = mk.historia[k] = mk.historia[k] || [];
      h.push(mk.precio[k]); if (h.length > 30) h.shift();
    }
    const media = {}, cuantos = {};
    for (const c of vivas) if (c.especialidad) cuantos[c.especialidad] = (cuantos[c.especialidad] || 0) + 1;
    for (const c of vivas) { const ap = aptitudes(m, c, recursosDe && recursosDe[c.id]); for (const k of BIENES) media[k] = (media[k] || 0) + ap[k] / vivas.length; }
    for (const id of Object.keys(v.resumenTratos || {})) {
      const r = v.resumenTratos[id], lista = Object.keys(r.entra).map(k => '+' + r.entra[k] + ' ' + k).concat(Object.keys(r.sale).map(k => '−' + r.sale[k] + ' ' + k));
      if (lista.length) (v.anuncios = v.anuncios || []).push({ civ: +id, texto: '⚖ Mercado: ' + lista.join(', ') + ' (' + (r.oro >= 0 ? '+' : '−') + Math.abs(Math.round(r.oro)) + '🪙)' });
    }
    v.resumenTratos = {};
    sucesosDelCampo(m);
    sucesosDelMercado(m);
    ofertasAlJugador(m);
    for (const c of vivas) {
      // El combustible: los pozos dan crudo; fábricas, trenes y centrales queman lo que haya.
      if ((c.pozosPetroleo || 0) > 0 && c.era >= 7) c.petroleo = (c.petroleo || 0) + 1.2 * c.pozosPetroleo;
      quemar(m, c);
      huelgas(m, c);
      c.balance = balance(m, c);
      c.ganado = c.ganado || {};
      for (const k of BIENES) c.ganado[k] = (c.ganado[k] || 0) * 0.93;
      if (c.especialidad == null || !c.cartera || m.turno % 6 === c.id % 6 || (c.plan && c.plan.especialidad && c.plan.especialidad !== c.especialidad)) evaluarCartera(m, c, recursosDe && recursosDe[c.id], media, cuantos);
      // La forja: quien se dedica a las armas (o tiene metal de sobra y cuartel) convierte metal en armas.
      const reserva = reservaAcorazado(v, c);
      if (c.era >= 1 && c.cuarteles > 0 && ((c.cartera && c.cartera.armas) || c.balance.sobra.metal > 8)) {
        const q = Math.min(c.cartera && c.cartera.armas ? Math.max(1, Math.round(3 * c.cartera.armas * 1.6)) : 1, Math.floor(Math.max(0, (c.metal || 0) - 2 - reserva)));
        if (q > 0) { c.metal -= q; c.armas = (c.armas || 0) + q; }
      }
      // Lo que mandó fabricar el jugador: armas (1 de metal cada una; 2 por turno en la forja del cuartel y 4 más
      // por cada fábrica en marcha) o muebles (2 de madera cada lote, que se vende por oro).
      const fab = c.plan && c.plan.fabricar;
      if (fab && fab.n > fab.hechos && fab.que !== 'vehiculos') {
        const ritmo = (c.cuarteles > 0 ? 2 : 0) + (enMarcha(c, 'fabrica') ? 4 * (c.fabricas || 0) : 0);
        const q = Math.min(ritmo, fab.n - fab.hechos, fab.que === 'armas' ? Math.floor(c.metal || 0) : Math.floor((c.madera || 0) / 2));
        if (fab.que === 'vehiculos') { /* los hace el cuartel, más abajo */ }
        else if (q > 0) { if (fab.que === 'armas') { c.metal -= q; c.armas = (c.armas || 0) + q; } else { c.madera -= q * 2; c.muebles = (c.muebles || 0) + q; } fab.hechos += q; }
        if (fab.hechos >= fab.n) { (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: (fab.que === 'armas' ? '⚒ Hechas ' : '🏭 Hechos ') + fab.n + (fab.que === 'armas' ? ' armas' : ' lotes de muebles') }); c.plan.fabricar = null; }
        else if (!q && m.turno - fab.desde > 3 && !fab.avisado) { fab.avisado = 1; (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: fab.que === 'armas' ? '⚒ Sin metal para las armas: haced minas o compradlo' : '🏭 Sin madera para los muebles' }); }
      }
      // El banco: el oro guardado da un pequeño interés.
      if (c.bancos > 0 && (c.oro || 0) > 0) c.oro += Math.min(2 + c.bancos, c.oro * 0.012);
      // La fábrica: forja en serie (sin cuartel) y convierte la madera que sobra en muebles que se venden por oro.
      if (c.fabricas > 0 && enMarcha(c, 'fabrica')) {
        const q = Math.min(2 * c.fabricas, Math.floor(Math.max(0, (c.metal || 0) - 4 - reserva)));
        if (q > 0 && (c.cartera && (c.cartera.armas || c.cartera.metal) || c.guerras.length)) { c.metal -= q; c.armas = (c.armas || 0) + q; }
        const mad = Math.min(4 * c.fabricas, Math.floor(Math.max(0, (c.madera || 0) - objetivo(c, 'madera') * 1.2) / 2));
        if (mad > 0) { c.madera -= mad * 2; c.muebles = (c.muebles || 0) + mad; }
      }
      // El mercado interior: la gente compra cada turno parte de los muebles del almacén (lo demás se exporta).
      if ((c.muebles || 0) > 0) {
        const q = Math.min(c.muebles, Math.max(1, Math.round((c.casas || 0) * 0.05)), Math.max(0, c.muebles - (c.plan && (c.plan.ventas || []).some(x => x.que === 'muebles') ? 1e9 : 0)));
        if (q > 0) { const oro = q * (m.mercado ? m.mercado.precio.muebles || PRECIO_BASE.muebles : PRECIO_BASE.muebles) * 0.6; c.muebles -= q; c.oro = (c.oro || 0) + oro; c.ganado = c.ganado || {}; c.ganado.muebles = (c.ganado.muebles || 0) + oro; }
      }
      // El cuartel fabrica vehículos de guerra para el almacén si se dedica a ello (o se lo mandan): uno cada dos turnos.
      if (c.era >= 5 && c.cuarteles > 0 && ((c.cartera && c.cartera.vehiculos) || (c.plan && c.plan.fabricar && c.plan.fabricar.que === 'vehiculos')) && m.turno % 2 === 0) {
        const t = c.era >= 8 ? 'tanque' : c.era >= 7 ? 'artilleria' : 'canon', cm = VEHICULOS[t].metal, cp = t === 'tanque' ? 3 : 0;
        if ((c.metal || 0) >= cm + 4 && (c.petroleo || 0) >= cp) { c.metal -= cm; c.petroleo = (c.petroleo || 0) - cp; c.vehiculos = (c.vehiculos || 0) + 1; const f = c.plan && c.plan.fabricar; if (f && f.que === 'vehiculos') { f.hechos++; if (f.hechos >= f.n) { (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚙ Hechos ' + f.n + ' vehículos de guerra' }); c.plan.fabricar = null; } } }
      }
      // Los pedidos y las ventas que nadie atiende en 40 turnos se olvidan.
      if (c.plan) for (const l of ['pedidos', 'ventas']) if (c.plan[l]) c.plan[l] = c.plan[l].filter(x => m.turno - (x.desde || 0) < 40);
      // Lo importado se olvida poco a poco (sirve para saber cuánto puede fiarse de sus socios).
      c.importa = c.importa || {};
      for (const k of BIENES) c.importa[k] = (c.importa[k] || 0) * 0.9;
    }
  }
  /*
   * EL CAMPO TIENE SORPRESAS:
   *  · plaga de langostas en verano: devoran los campos sin madurar de un pueblo (y se ven pasar);
   *  · cosecha récord en otoño (un año bueno): durante la estación cada siega rinde la mitad más, y el pueblo
   *    lo celebra con una fiesta de la cosecha en la plaza.
   */
  function sucesosDelCampo(m) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      if ((c.campos || 0) < 8) continue;
      if (v.estacion === 1 && azar(v) < 0.01 && !(c.ultimaPlaga > m.turno - 60)) {
        c.ultimaPlaga = m.turno;
        const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)];
        let n = 0;
        for (const r of zona) for (const t of parcelas(m, r)) if (v.obra[t] === OBRA.campo && v.cultivo[t] >= 1 && v.cultivo[t] < 3 && azar(v) < 0.55) { cambiar(m, 'cultivo', t, 0, 0); n++; }
        if (n) {
          (v.plagas = v.plagas || []).push({ turno: m.turno, regiones: zona });
          S().cronica(m, 'plaga', 'Langostas en ' + c.nombre, 'Una nube de langostas oscurece el cielo y baja sobre los campos de ' + c.nombre + ': en una tarde se comen ' + n + ' sembrados. Habrá que tirar del granero o comprar fuera.', c, c.capital);
          if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🦗 Las langostas devoran ' + n + ' campos' });
        }
      }
      if (v.estacion === 2 && m.turno % 12 === 0 && azar(v) < 0.18) {
        c.cosechaRecord = m.turno;
        c.plan = c.plan || {}; c.plan.ultimaFiesta = m.turno;
        S().cronica(m, 'cosecha', 'Cosecha récord en ' + c.nombre, 'El tiempo ha acompañado todo el año: los graneros de ' + c.nombre + ' no dan abasto y en la plaza se celebra la fiesta de la cosecha, con música, baile y pan recién hecho.', c, c.capital);
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🌾 ¡Cosecha récord! Fiesta en la plaza' });
      }
    }
    if (v.plagas) v.plagas = v.plagas.filter(p => m.turno - p.turno < 3);
  }
  /*
   * SUCESOS DEL MERCADO MUNDIAL (cada tanto): una sequía lejana encarece el grano, un auge de la construcción
   * sube la piedra, una guerra en otras tierras dispara las armas, una flota extranjera inunda el mercado de
   * madera… Duran unos turnos y mueven los precios para todos: quien tenga eso para vender, gana.
   */
  const SUCESOS_MERCADO = [
    { k: 'comida', f: 1.7, titulo: 'Sequía en tierras lejanas', texto: 'Las caravanas cuentan que en el otro lado del mundo no llueve: el grano se paga como nunca.' },
    { k: 'comida', f: 0.6, titulo: 'Años de abundancia en el mundo', texto: 'Todas las cosechas vienen buenas a la vez: el grano sobra y su precio se hunde.' },
    { k: 'madera', f: 0.55, titulo: 'Una flota extranjera trae madera', texto: 'Barcos de tierras desconocidas descargan troncos en todos los puertos: la madera no vale nada.' },
    { k: 'madera', f: 1.6, titulo: 'Fiebre de construir barcos', texto: 'Todos quieren barcos y casas nuevas: la madera se encarece.' },
    { k: 'piedra', f: 1.7, titulo: 'Auge de la construcción', texto: 'Ciudades de todo el mundo levantan murallas y catedrales: la piedra sube.' },
    { k: 'metal', f: 1.5, titulo: 'Se agotan las minas del sur', texto: 'Las grandes minas lejanas se inundan: el metal escasea en todos los mercados.', era: 1 },
    { k: 'metal', f: 0.65, titulo: 'Gran veta descubierta', texto: 'Una veta enorme aparece en tierras lejanas: llega metal barato por todas partes.', era: 1 },
    { k: 'armas', f: 1.8, titulo: 'Guerra en otras tierras', texto: 'Una guerra lejana se lo traga todo: las armas se pagan el doble.', era: 2 }
  ];
  function sucesosDelMercado(m) {
    const v = m.vida, mk = m.mercado, maxEra = Math.max(...S().vivas(m).map(c => c.era));
    if (mk.suceso && m.turno >= mk.suceso.hasta) mk.suceso = null;
    if (mk.suceso || azar(v) > 0.03 || m.turno < 30) return;
    const op = SUCESOS_MERCADO.filter(x => (x.era || 0) <= maxEra);
    const s_ = op[Math.floor(azar(v) * op.length)];
    mk.suceso = { k: s_.k, f: s_.f, titulo: s_.titulo, desde: m.turno, hasta: m.turno + 10 + Math.floor(azar(v) * 10) };
    S().cronica(m, 'comercio', s_.titulo, s_.texto + ' (' + s_.k + (s_.f > 1 ? ' más caro' : ' más barato') + ' durante unos turnos).', null);
    const yo = S().vivas(m).find(c => c.jugador);
    if (yo) (v.anuncios = v.anuncios || []).push({ civ: yo.id, texto: '📈 ' + s_.titulo + ': ' + s_.k + (s_.f > 1 ? ' ▲' : ' ▼') });
  }
  // Ofertas de los mercaderes de tus socios: te lo dejan barato (o te lo compran caro) si contestas a tiempo.
  function ofertasAlJugador(m) {
    const v = m.vida, mk = m.mercado, c = S().vivas(m).find(x => x.jugador);
    if (!c || !c.balance) return;
    if (c.oferta && m.turno > c.oferta.hasta) c.oferta = null;
    if (c.oferta || azar(v) > 0.1) return;
    const socios = [...new Set(v.rutas.filter(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)).map(ru => (ru.a === c.id ? ru.b : ru.a)))].map(id => S().civ(m, id)).filter(o => o && o.viva && o.balance && !S().enGuerra(c, o));
    if (!socios.length) return;
    const o = socios[Math.floor(azar(v) * socios.length)];
    const vende = BIENES.filter(k => o.balance.sobra[k] >= 4 && (c.balance.falta[k] >= 1 || (c[k] || 0) < objetivo(c, k) * 1.5));
    const compra = BIENES.filter(k => c.balance.sobra[k] >= 4 && o.balance.falta[k] >= 2);
    if (vende.length && (!compra.length || azar(v) < 0.5)) {
      const k = vende[Math.floor(azar(v) * vende.length)], n = Math.floor(Math.min(o.balance.sobra[k], Math.max(5, c.balance.falta[k] * 1.5), 40)), oro = Math.round(n * mk.precio[k] * 0.75 * 10) / 10;
      if (n >= 3 && (c.oro || 0) >= oro) c.oferta = { tipo: 'venta', de: o.id, que: k, n, oro, hasta: m.turno + 4 };
    } else if (compra.length) {
      const k = compra[Math.floor(azar(v) * compra.length)], n = Math.floor(Math.min(c.balance.sobra[k], Math.max(5, o.balance.falta[k]), 40)), oro = Math.round(n * mk.precio[k] * 1.35 * 10) / 10;
      if (n >= 3 && (o.oro || 0) >= oro) c.oferta = { tipo: 'compra', de: o.id, que: k, n, oro, hasta: m.turno + 4 };
    }
    if (c.oferta) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🤝 ' + o.nombre + (c.oferta.tipo === 'venta' ? ' os ofrece ' + c.oferta.n + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + '🪙' : ' quiere comprar ' + c.oferta.n + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + '🪙') });
  }
  function aceptarOferta(m, c, si) {
    const of = c.oferta, o = of && S().civ(m, of.de);
    if (!of || !o || !o.viva) return { ok: false, texto: 'No hay ningún trato sobre la mesa.' };
    c.oferta = null;
    if (!si) return { ok: true, texto: 'Rechazáis el trato con ' + o.nombre + '. Sus mercaderes se encogen de hombros.' };
    if (of.tipo === 'venta') {
      if ((c.oro || 0) < of.oro || (o[of.que] || 0) < of.n) return { ok: false, texto: 'El trato ya no se puede cerrar: ' + ((c.oro || 0) < of.oro ? 'no tenéis el oro.' : 'a ' + o.nombre + ' ya no le queda.') };
      c.oro -= of.oro; o.oro = (o.oro || 0) + of.oro; o[of.que] -= of.n; c[of.que] = (c[of.que] || 0) + of.n;
      apuntarTrato(m, { t: m.turno, vende: o.id, compra: c.id, que: of.que, n: of.n, oro: of.oro, ruta: 'externa' });
      return { ok: true, texto: 'Trato hecho: llegan ' + of.n + ' de ' + of.que + ' de ' + o.nombre + ' por ' + Math.round(of.oro) + ' de oro (más barato que en el mercado).' };
    }
    if ((c[of.que] || 0) < of.n || (o.oro || 0) < of.oro) return { ok: false, texto: 'El trato ya no se puede cerrar.' };
    c[of.que] -= of.n; o[of.que] = (o[of.que] || 0) + of.n; o.oro -= of.oro; c.oro = (c.oro || 0) + of.oro; (c.ganado = c.ganado || {})[of.que] = (c.ganado[of.que] || 0) + of.oro;
    apuntarTrato(m, { t: m.turno, vende: c.id, compra: o.id, que: of.que, n: of.n, oro: of.oro, ruta: 'externa' });
    return { ok: true, texto: 'Trato hecho: vendéis ' + of.n + ' de ' + of.que + ' a ' + o.nombre + ' por ' + Math.round(of.oro) + ' de oro (bien por encima del mercado).' };
  }
  // Un comerciante sale de casa: carga lo que al otro reino le hace falta y a su pueblo le sobra.
  const capacidad = c => Math.round((6 + 3 * c.era) * (1 + M.tec(c, 'comercio')) * (c.estaciones > 0 && enMarcha(c, 'tren') ? 2 : 1));
  function cargar(m, a, c, o) {
    const mk = m.mercado; if (!mk || !c.balance || !o.balance) return;
    const cap = capacidad(c);
    let mejor = null, mv = 0;
    for (const k of BIENES) {
      // Lo que el jugador puso a la venta se coloca aunque al otro no le haga mucha falta (más barato).
      const enVenta = c.plan && (c.plan.ventas || []).some(x => x.que === k), quiere = o.balance.falta[k] || (enVenta && (o[k] || 0) < objetivo(o, k) * 2 ? Math.max(4, objetivo(o, k)) : 0);
      const q = Math.min(c.balance.sobra[k], quiere, Math.floor(c[k] || 0), k === 'vehiculos' ? 2 : k === 'armas' ? Math.ceil(cap / 3) : cap);
      if (q < 1) continue;
      const val = q * mk.precio[k] * (1 + o.balance.urg[k]);
      if (val > mv) { mv = val; mejor = [k, Math.floor(q)]; }
    }
    if (mejor) { a.carga = { que: mejor[0], n: mejor[1], de: c.id }; c[mejor[0]] -= mejor[1]; c.balance.sobra[mejor[0]] -= mejor[1]; }
  }
  // Llega a destino: vende la carga (lo que el otro pueda pagar) y, con oro de su pueblo, compra lo que falta en casa.
  function venderComprar(m, a, c, o) {
    const mk = m.mercado, v = m.vida; if (!mk) return;
    const tratos = [];
    if (a.carga && a.carga.de === c.id) {
      const k = a.carga.que, urg = o.balance ? o.balance.urg[k] : 0, precio = mk.precio[k] * (urg > 0 ? 1 + 0.5 * Math.min(1.6, urg) : 0.7);
      const q = Math.min(a.carga.n, Math.floor(Math.max(0, o.oro || 0) / precio));
      if (q > 0) {
        const oro = Math.round(q * precio * 10) / 10;
        o[k] = (o[k] || 0) + q; o.oro -= oro; c.oro = (c.oro || 0) + oro; c.comercioOro = (c.comercioOro || 0) + oro;
        (c.ganado = c.ganado || {})[k] = (c.ganado[k] || 0) + oro;
        o.importa = o.importa || {}; o.importa[k] = (o.importa[k] || 0) + q;
        quitarPedido(o, k, q); quitarVenta(c, k, q);
        tratos.push({ t: m.turno, vende: c.id, compra: o.id, que: k, n: q, oro });
        a.carga.n -= q;
      }
      if (a.carga.n <= 0) a.carga = null;
    }
    // La vuelta: lo que más prisa le corre a su pueblo y al otro le sobra, si hay oro para pagarlo.
    if (!a.carga && c.balance && o.balance) {
      const cap = capacidad(c);
      let mejor = null, mv = 0;
      for (const k of BIENES) {
        const precio = mk.precio[k] * (1 + 0.3 * Math.min(1.6, c.balance.urg[k]));
        const q = Math.min(o.balance.sobra[k], Math.floor(o[k] || 0), c.balance.falta[k], Math.floor(Math.max(0, (c.oro || 0) * 0.6) / precio), k === 'vehiculos' ? 2 : k === 'armas' ? Math.ceil(cap / 3) : cap);
        if (q < 1 || c.balance.urg[k] < 0.25) continue;
        const val = c.balance.urg[k] * q;
        if (val > mv) { mv = val; mejor = [k, Math.floor(q), precio]; }
      }
      if (mejor) {
        const [k, q, precio] = mejor, oro = Math.round(q * precio * 10) / 10;
        o[k] -= q; o.balance.sobra[k] -= q; c.oro -= oro; o.oro = (o.oro || 0) + oro; o.comercioOro = (o.comercioOro || 0) + oro;
        (o.ganado = o.ganado || {})[k] = (o.ganado[k] || 0) + oro;
        a.carga = { que: k, n: q, de: o.id, para: c.id };
        quitarVenta(o, k, q);
        tratos.push({ t: m.turno, vende: o.id, compra: c.id, que: k, n: q, oro });
      }
    }
    const ru = v.rutas.find(x => x.id === a.ruta);
    for (const x of tratos) { x.ruta = ru ? ru.tipo : null; apuntarTrato(m, x); }
  }
  // De vuelta en casa: se descarga lo comprado fuera.
  function descargar(m, a, c) {
    if (!a.carga) return;
    if (a.carga.para === c.id) { c[a.carga.que] = (c[a.carga.que] || 0) + a.carga.n; c.importa = c.importa || {}; c.importa[a.carga.que] = (c.importa[a.carga.que] || 0) + a.carga.n; quitarPedido(c, a.carga.que, a.carga.n); }
    else if (a.carga.de === c.id) c[a.carga.que] = (c[a.carga.que] || 0) + a.carga.n; // lo que no se vendió vuelve al almacén
    a.carga = null;
  }
  function quitarPedido(c, k, q) { const p = c.plan; if (!p || !p.pedidos) return; for (const x of p.pedidos) if (x.que === k && q > 0) { const d = Math.min(x.n, q); x.n -= d; q -= d; } p.pedidos = p.pedidos.filter(x => x.n > 0); }
  function quitarVenta(c, k, q) { const p = c.plan; if (!p || !p.ventas) return; for (const x of p.ventas) if (x.que === k && q > 0) { const d = Math.min(x.n, q); x.n -= d; q -= d; } p.ventas = p.ventas.filter(x => x.n > 0); }
  function apuntarTrato(m, x) {
    const v = m.vida, mk = m.mercado;
    (mk.tratos = mk.tratos || []).push(x); if (mk.tratos.length > 60) mk.tratos.shift();
    const a = S().civ(m, x.vende), b = S().civ(m, x.compra);
    if (!a || !b) return;
    // Para el jugador, un solo aviso por turno con todo lo comprado y vendido.
    for (const c of [a, b]) if (c.jugador) {
      const r = (v.resumenTratos = v.resumenTratos || {})[c.id] = v.resumenTratos[c.id] || { entra: {}, sale: {}, oro: 0 };
      if (c === b) { r.entra[x.que] = (r.entra[x.que] || 0) + x.n; r.oro -= x.oro; } else { r.sale[x.que] = (r.sale[x.que] || 0) + x.n; r.oro += x.oro; }
    }
  }
  const PRIO_OFICIO = ['madera', 'comida', 'casas', 'piedra', 'ejercito', 'riqueza', 'ciencia'];
  const prio = (c, k) => (c.plan && c.plan.prioridad && c.plan.prioridad[k] != null ? c.plan.prioridad[k] : 1);
  const metaMadera = c => 30 + 12 * c.era;
  function reparto(c, recursos) {
    const guerra = c.guerras.length > 0;
    const lleno = c.cap ? c.pob / c.cap : 0.8;
    // Lo que traen los socios cuenta como si estuviera en el almacén: quien compra fuera produce menos.
    const imp = c.importa || {}, madera = (c.madera || 0) + (imp.madera || 0) * 3, comida = (c.comida || 0) + (imp.comida || 0) * 3;
    const p = [
      recursos.arboles ? 0.18 + 0.4 * Math.max(0, 1 - madera / metaMadera(c)) : 0,
      0.22 + Math.max(0, lleno - 0.75) * 1.6 + ((c.campos || 0) < metaCampos(c) ? 0.08 : 0) + 0.4 * Math.max(0, 1 - comida / Math.max(6, (c.habitantes || 10) * 1.5)) +
        // Antes del invierno se hace acopio: en verano y otoño, más gente al campo si el granero no da para tres meses.
        (c.estacion === 1 || c.estacion === 2 ? 0.3 * Math.max(0, 1 - (c.comida || 0) / Math.max(10, (c.aldeanos || 10) * 3)) : 0),
      faltanCamas(c) ? 0.2 : 0.06,
      recursos.rocas ? (c.era >= 1 ? 0.08 + ((c.piedra || 0) < 20 ? 0.06 : 0) + ((c.metal || 0) < 10 ? 0.08 : 0) : 0.04) : 0,
      guerra ? 0.6 : c.era >= 2 ? 0.07 : 0.04,
      // Un comerciante por cada ruta abierta, más o menos.
      Math.min(0.2, 0.06 * (c.rutas || 0)),
      // Eruditos: pocos en una tribu (un chamán), más con templo, escritura y ciudades; los pueblos sabios, más.
      (c.aldeanos || 0) < 8 ? 0.02 : 0.045 + 0.01 * c.era + ((c.templos || 0) > 0 ? 0.02 : 0) + (c.caracter === 'sabio' || c.caracter === 'devoto' ? 0.025 : 0)
    ];
    // La especialidad del reino: produce de más de lo suyo para venderlo, y algún comerciante más si tiene socios.
    // La cartera: cada bien en el que trabaja el reino sube el oficio que lo produce, según su peso.
    if (c.cartera && c.balance) {
      const of = { madera: 0, comida: 1, piedra: 3, metal: 3, armas: 3, carbon: 3 }, extra = [0, 0, 0, 0, 0, 0, 0];
      for (const k of Object.keys(c.cartera)) if (of[k] != null) extra[of[k]] += c.cartera[k];
      for (let i = 0; i < 4; i++) if (extra[i]) p[i] = p[i] * (1 + 0.8 * extra[i]) + 0.07 * extra[i];
      if ((c.rutas || 0) > 0) p[5] += 0.04;
    }
    for (let i = 0; i < p.length; i++) {
      // Los mineros sacan piedra, metal y carbón: pesa la mayor de las tres prioridades.
      const pr_ = (c.plan && c.plan.prioridad) || {}, w = i === 3 ? Math.max(prio(c, 'piedra'), pr_.metal != null ? pr_.metal : 0, c.era >= 6 && pr_.carbon != null ? pr_.carbon : 0) : prio(c, PRIO_OFICIO[i]);
      // Lo que el jugador pone al máximo pesa siempre, aunque el almacén esté lleno.
      if (w >= 2 && (i !== 0 || recursos.arboles) && (i !== 3 || recursos.rocas)) p[i] = Math.max(p[i], 0.25);
      p[i] *= w === 0 ? 0.03 : w;
    }
    const suma = p.reduce((k, x) => k + x, 0) || 1;
    return p.map(x => x / suma);
  }

  // Las casas (y plazas) de un pueblo: donde nacen sus niños.
  function casasDe(m, c) {
    const v = m.vida, out = [];
    for (let t = 0; t < v.obra.length; t++) { const o = v.obra[t]; if ((o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento || o === OBRA.campamento) && m.dueno[region(m, t)] === c.id) out.push(t); }
    return out;
  }
  function hogar(m, c, cs) {
    const v = m.vida;
    if (azar(v) < 0.4 || cs.length < 2) return c.capital;
    const suyas = (m.ciudades || []).filter(x => x.civ === c.id);
    if (suyas.length && azar(v) < 0.4) return suyas[Math.floor(azar(v) * suyas.length)].region;
    return cs[Math.floor(azar(v) * cs.length)];
  }

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
    const base = anos < 5 ? 0.012 * Math.max(0.3, 1 - 0.09 * era) : 0.0003 * Math.max(0.35, 1 - 0.07 * era) * Math.exp(0.08 * anos);
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
      // Lo que el resto del mundo le hizo a la población desde el último turno (una peste, una batalla perdida,
      // un milagro) se cumple en los aldeanos: mueren los más viejos, o llegan familias nuevas.
      let objetivo = c.pobVida ? Math.round(lista.length * c.pob / c.pobVida) : Math.max(lista.length, 6);
      // Un pueblo que sigue en pie nunca se queda sin nadie: vuelven unas familias de las aldeas de alrededor.
      if (objetivo < 2 && !soloQuitar) objetivo = Math.max(objetivo, lista.length ? 2 : 3);
      if (objetivo < lista.length) {
        const tipo = c.guerras.length ? 'batalla' : 'vejez';
        for (const a of lista.slice().sort((x, y) => (y.edad || 0) - (x.edad || 0)).slice(0, lista.length - Math.max(1, objetivo))) { quitar.add(a); v.muertos.push([a.x, a.y, a.c, tipo, 0]); }
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
          const p = 1 - Math.pow(1 - riesgoAnual(m, a, c).p, dy);
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
    if (quitar.size) v.aldeanos = v.aldeanos.filter(a => !quitar.has(a));
    // Oficios: los libres cambian de oficio para cubrir lo que falta en su pueblo.
    for (const c of vivas) reasignar(m, c, recursosDe ? recursosDe[c.id] : null, false);
    equipar(m);
  }
  // Reparte los oficios de un pueblo. Con «ya» (una orden del jugador), cambian en el acto todos los que no
  // vayan cargados, no solo los que estaban libres: la orden se ve obedecer enseguida.
  // Cambia de oficio a un aldeano (quien deja las armas, las entrega).
  function mover(a, k) {
    if (a.o === GUERRERO && k !== GUERRERO) { a.arma = 0; a.armadura = 0; a.tirador = null; delete a.veh; if (a.pv != null) { a.pv = Math.min(a.pv, vidaMax(a)); a.pv0 = a.pv; } }
    a.o = k; a.e = LIBRE; a.k = 0; a.kt = 0; a.paseo = 0; a.tx = -1; a.ty = -1; a.pastor = null; a.caza = null; a.cantera = 0; a.siega = 0;
  }
  // Las órdenes concretas del jugador mandan sobre el gobernador automático:
  //  · CUADRILLAS: aldeanos con un encargo fijo (a.fijo) que nadie les cambia hasta que vence;
  //  · CUPOS: «quiero 10 leñadores» fija cuántos hay de un oficio (c.plan.cupos), el resto se reparte solo.
  function reasignar(m, c, recursos, ya) {
    const v = m.vida;
    const todos = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && a.colono == null);
    const cupos = (c.plan && c.plan.cupos) || {};
    const conCupo = i => cupos[i] != null;
    const tiene = [0, 0, 0, 0, 0, 0, 0];
    for (const a of todos) tiene[a.o]++;
    const libres = todos.filter(a => !a.fijo);
    let p = reparto(c, recursos || { arboles: 1, rocas: 1 });
    // Los oficios con cupo salen del reparto automático; lo demás se reparte en proporción.
    if (Object.keys(cupos).length) { p = p.map((x, i) => (conCupo(i) ? 0 : x)); const sum = p.reduce((k, x) => k + x, 0) || 1; p = p.map(x => x / sum); }
    const fuera = libres.filter(a => !conCupo(a.o)).length;
    // 1. Cumplir los cupos: quitar a los que sobran y traer a los que faltan (primero de lo que más sobra).
    for (const k of Object.keys(cupos).map(Number)) {
      const meta = Math.max(0, Math.min(cupos[k].n, todos.length));
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
        candidatos.sort((x, y) => (tiene[y.o] - p[y.o] * fuera) - (tiene[x.o] - p[x.o] * fuera) || (x.k ? 1 : 0) - (y.k ? 1 : 0));
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
      if (a.o !== GUERRERO) { if (a.veh) { delete a.veh; a.pv = Math.min(a.pv || 0, vidaMax(a)); a.pv0 = a.pv; } continue; }
      const c = S().civ(m, a.c);
      if (!c) continue;
      if (a.tirador == null) a.tirador = c.era >= 5 ? a.id % 3 !== 0 : a.id % 3 === 0;
      if (c.era >= 5 && !a.tirador && a.id % 3 !== 0) a.tirador = true;
      // Sin arquería no hay tiradores (salvo los honderos de la fase tribal); sin cuartel, nadie pasa de la lanza.
      if (a.tirador && c.era >= 1 && !(c.arquerias > 0)) a.tirador = false;
      // Del cuartel salen también los vehículos: uno de cada siete guerreros sirve una pieza de artillería y, en la
      // II Guerra Mundial, uno de cada seis conduce un tanque (si hay metal para fabricarlos).
      if (c.cuarteles > 0 && c.era >= 5) {
        // Si el jugador mandó fabricarlos, uno de cada tres.
        const pide = c.plan && c.plan.vehiculos;
        const quiereV = c.era >= 8 && (a.id % 6 === 1 || (pide === 'tanque' && a.id % 3 === 0)) ? 'tanque' : (a.id % 7 === 3 || (pide === 'artilleria' && a.id % 3 === 2)) ? (c.era >= 7 ? 'artilleria' : 'canon') : null;
        const crudo = quiereV === 'tanque' && pausada(m) ? 3 : 0;
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

  /*
   * LOS EJÉRCITOS: en guerra, los guerreros de un pueblo se reúnen junto a la frontera tras su capitán y
   * marchan juntos hacia una región del enemigo (la más cercana a su capital, para llegar al corazón del reino).
   */
  function ejercitos(m) {
    const v = m.vida;
    for (const id of Object.keys(v.ejercitos)) { const c = S().civ(m, +id); if (!c || !c.viva || !c.guerras.length) delete v.ejercitos[id]; }
    for (const c of S().vivas(m)) {
      if (!c.guerras.length) continue;
      const suyos = v.aldeanos.filter(a => a.c === c.id && a.o === GUERRERO);
      let e = v.ejercitos[c.id];
      const o = e && S().civ(m, e.con);
      // Las órdenes del jugador: «atacad X» fija el objetivo; «defended X» planta el ejército en casa.
      const p = c.plan || {};
      const dueObj = p.objetivo != null ? S().civ(m, m.dueno[p.objetivo]) : null;
      const mandado = dueObj && dueObj.viva && dueObj.id !== c.id && S().enGuerra(c, dueObj) ? dueObj : null;
      if (p.objetivo != null && !mandado && !(dueObj && dueObj.id !== c.id && !S().enGuerra(c, dueObj))) p.objetivo = null;
      const valido = e && o && o.viva && S().enGuerra(c, o) && m.dueno[e.obj] === o.id && (!mandado || e.obj === p.objetivo);
      if (!valido && mandado) {
        const nuestro = S().frontera(m, mandado, c).sort((x, y) => S().distancia(x, p.objetivo) - S().distancia(y, p.objetivo))[0];
        e = { con: mandado.id, obj: p.objetivo, reunion: nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno, asedio: 0 };
        v.ejercitos[c.id] = e;
      } else if (!valido) {
        e = null;
        for (const g of c.guerras) {
          const enemigo = S().civ(m, g.con);
          if (!enemigo || !enemigo.viva) continue;
          const frente = S().frontera(m, c, enemigo);
          if (!frente.length) continue;
          let obj = frente.sort((x, y) => S().distancia(x, enemigo.capital) - S().distancia(y, enemigo.capital))[0];
          // Como en WorldBox, se va a por las ciudades: la del enemigo (o su capital) más cercana a nuestra frontera.
          const plazas = [enemigo.capital, ...(m.ciudades || []).filter(x => x.civ === enemigo.id).map(x => x.region)];
          const cerca = plazas.map(r => [r, Math.min(...frente.map(f => S().distancia(f, r)))]).sort((p, q) => p[1] - q[1])[0];
          if (cerca && cerca[1] <= 5) obj = cerca[0];
          const nuestro = S().frontera(m, enemigo, c).sort((x, y) => S().distancia(x, obj) - S().distancia(y, obj))[0];
          e = { con: enemigo.id, obj, reunion: nuestro != null ? nuestro : c.capital, fase: 'reunion', desde: m.turno, asedio: 0 };
          break;
        }
        // Sin frente con el enemigo, la orden «defended X» aún reúne al ejército en casa.
        if (!e && p.defender != null && m.dueno[p.defender] === c.id && c.guerras.length) e = { con: c.guerras[0].con, obj: p.defender, reunion: p.defender, fase: 'marcha', desde: m.turno, asedio: 0, defiende: p.defender };
        if (e) v.ejercitos[c.id] = e; else { delete v.ejercitos[c.id]; continue; }
      }
      // Si un ejército enemigo ataca una de nuestras regiones, vamos a defenderla: ahí se encuentran los dos.
      for (const g of c.guerras) {
        const ee = v.ejercitos[g.con];
        if (!mandado && ee && ee.con === c.id && m.dueno[ee.obj] === c.id && ee.fase === 'marcha' && e.fase === 'reunion') { e.defiende = ee.obj; e.fase = 'marcha'; }
      }
      if (p.defender != null) { if (m.dueno[p.defender] === c.id) { e.defiende = p.defender; e.fase = 'marcha'; } else p.defender = null; }
      if (e.defiende != null && m.dueno[e.defiende] !== c.id) e.defiende = null;
      e.capitan = suyos.length ? Math.min(...suyos.map(a => a.id)) : null;
      if (e.fase === 'reunion') {
        const base = centro(m, e.reunion);
        const juntos = suyos.filter(a => dist(m, a.y * v.tw + a.x, base) <= 5).length;
        if (juntos >= suyos.length * 0.5 || m.turno - e.desde >= 2) { e.fase = 'marcha'; for (const a of suyos) if (a.e === ESPERAR || a.paseo) a.e = LIBRE; }
      }
    }
  }

  /*
   * LOS EDIFICIOS DE CADA PLAZA (capital y ciudades), como en WorldBox: una torre de vigilancia, un templo,
   * un molino junto a los campos (desde la Edad Media) y un puerto si hay costa. Cuestan madera y piedra.
   */
  // Madera, piedra y oro de cada edificio; y el nivel de asentamiento que hace falta (aldea, pueblo, villa).
  const COSTES = { [OBRA.casa]: [2, 0, 0], [OBRA.saber]: [6, 2, 0], [OBRA.torre]: [6, 4, 4], [OBRA.templo]: [8, 6, 10], [OBRA.molino]: [3, 0, 0], [OBRA.puerto]: [10, 0, 8], [OBRA.cuartel]: [10, 6, 12], [OBRA.arqueria]: [10, 2, 8], [OBRA.castillo]: [16, 24, 30], [OBRA.pozo]: [2, 4, 0], [OBRA.granero]: [8, 2, 0], [OBRA.fuente]: [2, 8, 4], [OBRA.parque]: [4, 2, 6], [OBRA.palacio]: [20, 30, 40], [OBRA.central]: [10, 30, 45], [OBRA.banco]: [6, 14, 20], [OBRA.fabrica]: [14, 20, 25], [OBRA.estacion]: [16, 14, 20], [OBRA.hospital]: [10, 16, 20], [OBRA.aerodromo]: [12, 24, 30], [OBRA.aduana]: [6, 10, 8], [OBRA.petroleo]: [8, 10, 12], [OBRA.mina]: [8, 2, 2] };
  const TRABAJO = { [OBRA.casa]: 2, [OBRA.saber]: 4, [OBRA.torre]: 4, [OBRA.templo]: 6, [OBRA.molino]: 3, [OBRA.puerto]: 4, [OBRA.cuartel]: 5, [OBRA.arqueria]: 4, [OBRA.castillo]: 12, [OBRA.pozo]: 2, [OBRA.granero]: 3, [OBRA.fuente]: 4, [OBRA.parque]: 3, [OBRA.palacio]: 14, [OBRA.central]: 10, [OBRA.banco]: 6, [OBRA.fabrica]: 8, [OBRA.estacion]: 7, [OBRA.hospital]: 6, [OBRA.aerodromo]: 8, [OBRA.ayuntamiento]: 6, [OBRA.aduana]: 4, [OBRA.petroleo]: 5, [OBRA.mina]: 5 };
  const NIVEL_OBRA = { [OBRA.saber]: 1, [OBRA.torre]: 1, [OBRA.puerto]: 1, [OBRA.templo]: 2, [OBRA.cuartel]: 2, [OBRA.arqueria]: 2, [OBRA.castillo]: 3, [OBRA.molino]: 0, [OBRA.pozo]: 0, [OBRA.granero]: 1, [OBRA.fuente]: 2, [OBRA.parque]: 3, [OBRA.palacio]: 4, [OBRA.central]: 4, [OBRA.banco]: 3, [OBRA.fabrica]: 3, [OBRA.estacion]: 3, [OBRA.hospital]: 3, [OBRA.aerodromo]: 4, [OBRA.aduana]: 2, [OBRA.petroleo]: 1, [OBRA.mina]: 0 };
  // Desde qué edad existe cada edificio: no hay parques en el Neolítico ni centrales eléctricas en una aldea.
  const ERA_OBRA = { [OBRA.torre]: 1, [OBRA.templo]: 1, [OBRA.puerto]: 1, [OBRA.cuartel]: 1, [OBRA.arqueria]: 1, [OBRA.castillo]: 2, [OBRA.fuente]: 1, [OBRA.palacio]: 1, [OBRA.parque]: 3, [OBRA.central]: 7, [OBRA.banco]: 5, [OBRA.fabrica]: 6, [OBRA.estacion]: 6, [OBRA.hospital]: 7, [OBRA.aerodromo]: 8, [OBRA.aduana]: 6, [OBRA.petroleo]: 7, [OBRA.mina]: 1 };
  const NOMBRE_ERA = ['el Neolítico', 'la Edad del Bronce', 'la Edad del Hierro', 'la Antigüedad clásica', 'la Edad Media', 'el Renacimiento', 'la Revolución Industrial', 'la Era Moderna', 'la II Guerra Mundial'];
  /*
   * EL ALUMBRADO de las calles, según la época y lo que haya (no se construye: llega con el progreso):
   *  · faroles de aceite en las plazas de la Edad Media y el Renacimiento (de pueblo para arriba);
   *  · farolas de gas victorianas por las calles en la Revolución Industrial (de villa para arriba);
   *  · farolas eléctricas en la Era Moderna, pero solo donde hay una central eléctrica (que pide ser ciudad).
   */
  function alumbradoDe(c) {
    if (!c || !c.viva) return null;
    const n = c.nivel || 0;
    if (c.era >= 7 && (c.centrales || 0) > 0 && enMarcha(c, 'central')) return 'electrico';
    if (c.era >= 6 && n >= 3) return 'gas';
    if (c.era >= 4 && n >= 2) return 'aceite';
    return null;
  }
  // Lo que cabe en los graneros: un poco en cada casa y mucho más en cada granero de verdad.
  const topeComida = (c, n) => (15 + n * (c.estacion != null && c.estacion >= 0 ? 2 : 1.2) + (c.graneros || 0) * (40 + n)) * (1 + M.tec(c, 'granero'));
  /*
   * LAS NECESIDADES: cada edificio público existe porque hace falta, y se nota tanto tenerlo como no.
   *  · Pozo: una plaza lejos de río, lago o mar no tiene agua; nacen menos niños y enferma más gente.
   *  · Granero: cuando el grano ya no cabe, se pudre; con el invierno cerca, guardar es sobrevivir.
   *  · Plaza pública (con fuente): un pueblo necesita dónde reunirse, hacer mercado y fiestas.
   *  · Parque: una villa apretada de casas necesita aire y sombra; sin él la gente vive peor.
   *  · Palacio: una ciudad necesita una sede del gobierno; sin ella las ciudades obedecen menos.
   *  · Templo (luego iglesia y catedral): la fe de un pueblo de la Edad del Bronce en adelante.
   */
  const NECESIDADES = {
    pozo: { nombre: 'Agua', edificio: 'un pozo', bien: 'hay agua cerca para beber y apagar fuegos', mal: 'no hay río ni lago cerca: el agua se trae de lejos, nacen menos niños y se enferma más', estab: -3, animo: -12 },
    granero: { nombre: 'Granero', edificio: 'un granero', bien: 'el grano se guarda para el invierno', mal: 'el grano ya no cabe y se pudre; en invierno no habrá de qué vivir', estab: -1, animo: -6 },
    fuente: { nombre: 'Plaza pública', edificio: 'una plaza pública con fuente', bien: 'hay dónde reunirse, hacer mercado y fiestas', mal: 'un pueblo tan grande no tiene dónde reunirse: la gente se siente sola y desconfía', estab: -3, animo: -8 },
    parque: { nombre: 'Parque', edificio: 'un parque', bien: 'aire, sombra y juegos para los niños', mal: 'tantas casas juntas sin un árbol: se vive apretado y triste', estab: -2, animo: -8 },
    palacio: { nombre: 'Sede del gobierno', edificio: 'un palacio', bien: 'el gobierno tiene una sede digna y las ciudades lo respetan', mal: 'una ciudad gobernada desde una choza: las demás ciudades obedecen menos', estab: -3, animo: -4 },
    central: { nombre: 'Electricidad', edificio: 'una central eléctrica', bien: 'hay luz en las casas, farolas eléctricas y fuerza para los talleres', mal: 'una ciudad moderna a oscuras: sin electricidad no hay farolas eléctricas ni luz en las casas', estab: -3, animo: -6 },
    banco: { nombre: 'Banca', edificio: 'un banco', bien: 'el oro da intereses y los mercaderes cobran mejor', mal: 'el oro se guarda en cofres: sin banco no hay préstamos ni intereses', estab: -1, animo: -2 },
    fabrica: { nombre: 'Industria', edificio: 'una fábrica', bien: 'se fabrica en serie: más armas y la madera sobrante se vende hecha mueble', mal: 'todo se hace a mano en talleres: sin fábrica, la ciudad se queda atrás', estab: -2, animo: -3 },
    estacion: { nombre: 'Ferrocarril', edificio: 'una estación de tren', bien: 'el tren lleva el doble de carga y llega antes', mal: 'las mercancías siguen yendo en carreta: sin estación no llega el tren', estab: -1, animo: -2 },
    hospital: { nombre: 'Sanidad', edificio: 'un hospital', bien: 'los heridos se curan y la gente vive más años', mal: 'sin hospital, las heridas y las epidemias se llevan a mucha gente', estab: -3, animo: -6 },
    aerodromo: { nombre: 'Aviación', edificio: 'un aeródromo', bien: 'los aviones tienen de dónde despegar', mal: 'en plena guerra moderna, sin aeródromo no despega ni un avión', estab: -1, animo: 0 },
    templo: { nombre: 'Fe', edificio: 'un templo', bien: 'hay dónde rezar y enterrar a los muertos', mal: 'no hay dónde rezar: la gente teme a los dioses', estab: -2, animo: -6 }
  };
  const PUBLICAS = new Set([OBRA.pozo, OBRA.granero, OBRA.fuente, OBRA.parque, OBRA.palacio, OBRA.templo, OBRA.central, OBRA.banco, OBRA.fabrica, OBRA.estacion, OBRA.hospital, OBRA.aerodromo]);
  const AGUAS = new Set(['rio', 'agua', 'bajo', 'lago']);
  /*
   * LOS CULTIVOS según la tierra: trigo en la llanura, maíz en la selva y la sabana, arroz en los pantanos y
   * junto al agua caliente, viñas en las colinas. Cada uno rinde distinto, y el campo junto a un río o un lago
   * (a dos parcelas) tiene regadío y da más. Las viñas dan menos comida pero su vino se vende por oro.
   */
  function regadio(m, ter, t) {
    const tw = m.vida.tw, x0 = t % tw;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const u = t + dy * tw + dx; if (u >= 0 && u < ter.length && Math.abs((u % tw) - x0) <= 2 && AGUAS.has(ter[u])) return true; }
    return false;
  }
  function cultivoTipo(m, ter, t) {
    const tipo = ter[t], reg = regadio(m, ter, t);
    if (tipo === 'pantano' || (reg && (tipo === 'selva' || tipo === 'sakura'))) return 'arroz';
    if (tipo === 'selva' || tipo === 'sabana') return 'maiz';
    if (tipo === 'colina' || (tipo === 'desierto' && !reg)) return 'vina';
    return 'trigo';
  }
  const RINDE = { trigo: [2, 0], maiz: [2.5, 0], arroz: [2.2, 0], vina: [1, 0.9] };
  function hayAgua(m, ter, t) {
    const v = m.vida, x0 = t % v.tw, y0 = t / v.tw | 0;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < v.tw && y < v.th && AGUAS.has(ter[y * v.tw + x])) return true; }
    return false;
  }
  // Calcula qué le falta a cada pueblo (en la capital y en sus ciudades) y lo que eso le cuesta.
  function necesidades(m, c) {
    const v = m.vida, ter = terrenos(m), out = [];
    c.estacion = v.estacion;
    if (!pausada(m) || !c.viva) { c.necesidades = out; c.bienestar = 0; c.animo = 70; return out; }
    const nivel = c.nivel || 0, tope = topeComida(c, c.aldeanos || 0);
    const plazas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].slice(0, 4);
    for (const r of plazas) {
      const zona = [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)], tiles = zona.flatMap(z => parcelas(m, z));
      const hay = o => tiles.some(t => v.obra[t] === OBRA[o]), cap = r === c.capital;
      const pon = (obra, falta, extra) => out.push(Object.assign({ obra, region: r, capital: cap, falta, tiene: hay(obra) }, NECESIDADES[obra], extra || {}));
      if (!hayAgua(m, ter, centro(m, r))) pon('pozo', !hay('pozo'), { urgente: 1 });
      if (cap && nivel >= 1) pon('granero', !hay('granero') && ((c.comida || 0) >= tope * 0.8 || (v.estacion === 2 && (c.comida || 0) >= tope * 0.5)), { urgente: v.estacion === 2 });
      if (cap && c.era >= 1) pon('templo', !hay('templo'));
      if (nivel >= 2 && (cap || nivel >= 3) && c.era >= ERA_OBRA[OBRA.fuente]) pon('fuente', !hay('fuente'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.parque]) pon('parque', !hay('parque'));
      if (cap && nivel >= 4 && c.era >= ERA_OBRA[OBRA.palacio]) pon('palacio', !hay('palacio'));
      if (cap && nivel >= 4 && c.era >= ERA_OBRA[OBRA.central]) pon('central', !hay('central'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.banco] && ((c.oro || 0) > 50 || (c.rutas || 0) >= 2)) pon('banco', !hay('banco'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.fabrica]) pon('fabrica', !hay('fabrica'));
      if (cap && nivel >= 3 && c.era >= ERA_OBRA[OBRA.estacion] && (c.rutas || 0) >= 1) pon('estacion', !hay('estacion'));
      if (nivel >= 3 && (cap || nivel >= 4) && c.era >= ERA_OBRA[OBRA.hospital]) pon('hospital', !hay('hospital'));
      if (cap && nivel >= 4 && c.era >= ERA_OBRA[OBRA.aerodromo] && (c.guerras.length || c.cuarteles > 0)) pon('aerodromo', !hay('aerodromo'));
    }
    c.necesidades = out;
    // Cada carencia cuenta una vez (la de la capital entera; la de otra ciudad, la mitad).
    const faltan = [], vistas = new Set();
    for (const n of out.filter(x => x.falta).sort((x, y) => y.capital - x.capital)) { if (vistas.has(n.obra)) continue; vistas.add(n.obra); faltan.push(n.capital ? n : Object.assign({}, n, { estab: n.estab / 2, animo: n.animo / 2 })); }
    c.bienestar = faltan.reduce((k, n) => k + n.estab, 0) + Math.min(7, out.filter(n => n.tiene).length * 1);
    // El ánimo de la gente (0-100): comida, casa, guerra, invierno y lo que falta en el pueblo.
    let animo = 66 + faltan.reduce((k, n) => k + n.animo, 0) + Math.min(14, out.filter(n => n.tiene).length * 2.5);
    if ((c.comida || 0) < (c.aldeanos || 0) * 0.15) animo -= 20;
    if (c.sinCama) animo -= 6;
    if (c.guerras && c.guerras.length) animo -= 8;
    if (v.estacion === 3 && (c.madera || 0) < 3) animo -= 12;
    // Calles alumbradas: se sale de noche sin miedo.
    c.alumbrado = alumbradoDe(c);
    if (c.alumbrado) animo += c.alumbrado === 'electrico' ? 6 : c.alumbrado === 'gas' ? 4 : 2;
    if (c.plan && c.plan.ultimaFiesta != null && m.turno - c.plan.ultimaFiesta <= 2) animo += 10;
    if (c.plan && c.plan.impuesto > 1) animo -= Math.round((c.plan.impuesto - 1) * 25);
    c.animo = Math.max(0, Math.min(100, Math.round(animo)));
    return out;
  }
  // El ánimo de cada aldeano: el del pueblo, más lo suyo (casa propia, hambre, oficio, edad, carácter).
  function animoDe(m, a) {
    const c = S().civ(m, a.c);
    if (!c) return 50;
    let k = c.animo == null ? 70 : c.animo;
    const v = m.vida;
    if (a.casa == null || ![OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.campamento].includes(v.obra[a.casa])) k -= 10;
    if (a.o === GUERRERO && c.guerras.length) k -= 6;
    if (tiene(a, 'perezoso')) k += 4; if (tiene(a, 'valiente') && c.guerras.length) k += 6;
    k += ((a.id * 37) % 11) - 5;
    return Math.max(0, Math.min(100, Math.round(k)));
  }
  /*
   * EL ARQUITECTO: el jugador toca el mapa y deja encargado dónde va cada edificio (c.plan.encargos) o cada calle
   * (v.pendientes). Los constructores los hacen por orden, en cuanto haya con qué pagarlos.
   */
  const EDIFICABLES = ['casa', 'pozo', 'granero', 'fuente', 'parque', 'palacio', 'central', 'banco', 'fabrica', 'estacion', 'hospital', 'aerodromo', 'templo', 'saber', 'molino', 'torre', 'puerto', 'cuartel', 'arqueria', 'castillo', 'petroleo', 'mina'];
  // «marcado»: el encargo ya lo dejó el jugador; su plano manda sobre las calles que el pueblo planee después.
  function puedeColocar(m, c, t, clave, marcado) {
    const v = m.vida, ter = terrenos(m);
    if (!c || !c.viva) return 'no tienes pueblo';
    if (t < 0 || t >= v.tw * v.th) return 'fuera del mapa';
    if (m.dueno[region(m, t)] !== c.id) return 'esa tierra no es tuya';
    if (clave === 'camino') return v.camino[t] ? 'ya hay calle' : v.obra[t] && v.obra[t] !== OBRA.campo ? 'hay un edificio' : andable(ter[t]) || ter[t] === 'rio' ? null : 'ahí no se puede';
    const o = OBRA[clave];
    if (!o) return 'no se sabe construir eso';
    if (v.obra[t] && !(v.obra[t] === OBRA.campo && PUBLICAS.has(o))) return 'ya hay algo construido';
    if (v.andamios && v.andamios[t]) return 'ya hay una obra';
    if (v.camino[t]) return 'es una calle';
    if (esVia(v, t)) return 'por ahí pasa la vía del tren';
    if (v.trinchera && v.trinchera[t]) return 'ahí hay una trinchera';
    if (!marcado && pausada(m) && v.plan && v.plan[t] === 1) return 'ahí va una calle del plano';
    if (o === OBRA.mina) { if (ter[t] !== 'montana') return 'la mina solo se abre en la montaña'; }
    else if (o === OBRA.puerto ? !(ter[t] === 'arena' && [1, -1, v.tw, -v.tw].some(d => ter[t + d] === 'agua' || ter[t + d] === 'bajo')) : !CONSTRUIBLE.has(ter[t])) return o === OBRA.puerto ? 'el puerto va en la arena, junto al mar' : 'ahí no se puede construir';
    if (c.era < (ERA_OBRA[o] || 0)) return 'aún no existe: llega con ' + NOMBRE_ERA[ERA_OBRA[o]];
    if (o === OBRA.petroleo && !(v.crudo && v.crudo[t])) return 'ahí no hay petróleo: busca las manchas negras';
    if ((c.nivel || 0) < (NIVEL_OBRA[o] || 0)) return 'hace falta ser ' + ['un campamento', 'una aldea', 'un pueblo', 'una villa', 'una ciudad'][NIVEL_OBRA[o]];
    return null;
  }
  // Deja (o quita, si ya estaba) un encargo del arquitecto en esa parcela.
  function encargar(m, c, t, clave) {
    const v = m.vida, p = c.plan = c.plan || {};
    p.encargos = p.encargos || [];
    const i = p.encargos.findIndex(e => e.t === t);
    if (i >= 0) { p.encargos.splice(i, 1); return { ok: true, quitado: true }; }
    if (clave === 'camino') {
      const pend = (v.pendientes = v.pendientes || {})[c.id] = v.pendientes[c.id] || [];
      const j = pend.indexOf(t);
      if (j >= 0) { pend.splice(j, 1); return { ok: true, quitado: true }; }
      const no = puedeColocar(m, c, t, clave); if (no) return { ok: false, razon: no };
      pend.unshift(t); return { ok: true };
    }
    const no = puedeColocar(m, c, t, clave);
    if (no) return { ok: false, razon: no };
    p.encargos.push({ t, o: OBRA[clave], clave });
    return { ok: true };
  }
  function colocarObra(m, t, o, paso) {
    const v = m.vida;
    cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 0, paso); cambiar(m, 'obra', t, o, paso);
    if (o === OBRA.torre) (v.torres = v.torres || {})[t] = 12;
    if (o === OBRA.castillo) (v.torres = v.torres || {})[t] = 40;
    if (o === OBRA.aduana) (v.torres = v.torres || {})[t] = 20;
    // Alrededor de la plaza pública y del palacio se empiedra una explanada de adoquín (lo libre que haya).
    if (o === OBRA.fuente || o === OBRA.palacio) {
      const ter = terrenos(m), tx = t % v.tw;
      for (const d of [-1, 1, -v.tw, v.tw, -v.tw - 1, -v.tw + 1, v.tw - 1, v.tw + 1]) {
        const u = t + d, ux = u % v.tw;
        if (u < 0 || u >= v.tw * v.th || Math.abs(ux - tx) > 1 || v.obra[u] || v.camino[u] || v.roca[u] || !CONSTRUIBLE.has(ter[u]) || (v.andamios && v.andamios[u])) continue;
        cambiar(m, 'arbol', u, 0, paso); cambiar(m, 'camino', u, 1, paso);
      }
    }
  }
  function pagarObra(c, o) {
    const coste = COSTES[o] || [0, 0, 0];
    if (c.madera < coste[0] || c.piedra < coste[1] || (c.oro || 0) < (coste[2] || 0)) return false;
    c.madera -= coste[0]; c.piedra -= coste[1]; c.oro = (c.oro || 0) - (coste[2] || 0);
    return true;
  }
  // La plaza más expuesta (la que tiene otro reino más cerca); si no hay vecinos, la capital.
  function plazaFronteriza(m, c, r, plazas) {
    const todas = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    const peligro = p => { let d = 99; for (let q = 0; q < m.W * m.H; q++) if (m.dueno[q] >= 0 && m.dueno[q] !== c.id) d = Math.min(d, S().distancia(p, q)); return d; };
    const clave = 'frontera:' + c.id;
    if (!memo.has(clave)) memo.set(clave, todas.slice().sort((p, q) => peligro(p) - peligro(q))[0]);
    return memo.get(clave) === r;
  }
  /**
   * LOS PASOS FRONTERIZOS: dónde sale cada carretera de comercio (ruta externa) de la tierra de un reino.
   * Es la última parcela suya del camino antes de pisar tierra ajena. Allí, en la era moderna, se levanta
   * un puesto fronterizo pegado a la carretera.
   */
  // Un comerciante pasa junto a un puesto fronterizo: le paran a revisar la carga (y, si es de otro reino, paga).
  function controlFronterizo(m, a, c, t, paso) {
    const v = m.vida, tw = v.tw, tx = t % tw, ty = t / tw | 0;
    for (const o of S().vivas(m)) for (const pf of o.aduanas || []) {
      if (Math.abs(pf % tw - tx) > 1 || Math.abs((pf / tw | 0) - ty) > 1) continue;
      a.pasados = a.pasados || [];
      if (a.pasados.includes(pf)) continue;
      a.pasados.push(pf);
      // Se para en la barrera mientras le revisan la carga; si el puesto es de otro reino, paga el arancel.
      a.retenido = 2; a.controlEn = pf;
      const reg = (v.aduanas = v.aduanas || {})[pf] = v.aduanas[pf] || { controles: 0, arancel: 0 };
      reg.controles++;
      if (o.id !== c.id) { const paga = Math.min(1, Math.max(0, c.oro || 0)); c.oro -= paga; o.oro = (o.oro || 0) + paga; reg.arancel += paga; }
      return true;
    }
    return false;
  }
  function pasosFronterizos(m, c) {
    const v = m.vida, out = [];
    for (const ru of v.rutas) {
      if (ru.tipo !== 'externa' || (ru.a !== c.id && ru.b !== c.id) || !rutaActiva(m, ru)) continue;
      const tl = ru.tiles, suyo = t => m.dueno[region(m, t)] === c.id;
      for (let i = 0; i + 1 < tl.length; i++) {
        if (suyo(tl[i]) && !suyo(tl[i + 1])) out.push({ t: tl[i], ruta: ru.id, i, dir: 1 });
        else if (!suyo(tl[i]) && suyo(tl[i + 1])) out.push({ t: tl[i + 1], ruta: ru.id, i: i + 1, dir: -1 });
      }
    }
    return out;
  }
  // El primer paso de la frontera que aún no tiene puesto (con el sitio libre donde levantarlo, junto a la carretera).
  function pasoSinPuesto(m, c, ter) {
    const v = m.vida, tw = v.tw, pasos = pasosFronterizos(m, c);
    // Uno por paso: si la raya se mueve, el puesto viejo sigue sirviendo hasta que lo pierdan.
    if ((c.aduanas || []).length >= pasos.length) return null;
    for (const p of pasos) {
      const px = p.t % tw, py = p.t / tw | 0;
      let hay = false;
      for (let dy = -4; dy <= 4 && !hay; dy++) for (let dx = -4; dx <= 4; dx++) { const u = (py + dy) * tw + px + dx; if (u >= 0 && u < v.obra.length && m.dueno[region(m, u)] === c.id && (v.obra[u] === OBRA.aduana || (v.andamios && v.andamios[u] && v.andamios[u].o === OBRA.aduana))) { hay = true; break; } }
      if (hay) continue;
      const ru = v.rutas.find(x => x.id === p.ruta), enRuta = new Set(ru.tiles);
      let sitio = null;
      // Pegado al camino, en las últimas parcelas propias antes de la raya.
      for (let k = 0; k < 4 && sitio == null; k++) {
        const base = ru.tiles[p.i - p.dir * k];
        if (base == null || m.dueno[region(m, base)] !== c.id) break;
        const bx = base % tw;
        for (const d of [-tw, tw, -1, 1, -tw - 1, -tw + 1, tw - 1, tw + 1]) {
          const u = base + d;
          if (u < 0 || u >= v.obra.length || Math.abs((u % tw) - bx) > 1 || enRuta.has(u)) continue;
          if (v.obra[u] || v.roca[u] || v.camino[u] || calleDelPlan(m, u) || !CONSTRUIBLE.has(ter[u]) || m.dueno[region(m, u)] !== c.id || (v.andamios && v.andamios[u])) continue;
          sitio = u; break;
        }
      }
      if (sitio != null) return Object.assign({ sitio }, p);
    }
    return null;
  }
  /*
   * LAS TRINCHERAS (Segunda Guerra Mundial): los soldados cavan una zanja con sacos terreros a lo largo de la
   * frontera con los vecinos en guerra o mal avenidos, y le ponen alambre de espino delante. Quien está dentro
   * es más difícil de alcanzar y recibe menos daño; en guerra, los soldados sin otra orden ocupan las trincheras.
   * v.trinchera[t]: 1 cavada, 2 con alambre.
   */
  const MAX_TRINCHERA = 70;
  function planTrincheras(m, c, ter) {
    const v = m.vida, tw = v.tw;
    if (c.era < 8) { c.trincheraPlan = []; return; }
    if (c.trincheraPlan && m.turno - (c.trincheraTurno || -99) < 10) return;
    c.trincheraTurno = m.turno;
    const rivales = S().vecinosDe(m, c).filter(o => o && o.viva && (S().enGuerra(c, o) || (c.rel[o.id] || 0) < 15));
    const cap = centro(m, c.capital), out = [];
    for (const o of rivales) for (const r of S().frontera(m, o, c)) for (const t of parcelas(m, r)) {
      const tx = t % tw;
      if (ter[t] === 'agua' || ter[t] === 'bajo' || ter[t] === 'montana' || (v.obra[t] && v.obra[t] !== OBRA.campo) || v.camino[t] || esVia(v, t)) continue;
      // Pegada a la raya: una casilla vecina es ya del rival.
      if (![t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < v.obra.length && Math.abs(n % tw - tx) <= 1 && m.dueno[region(m, n)] === o.id)) continue;
      out.push(t);
    }
    // Primero los tramos frente a quien está en guerra, y los más cercanos a la capital.
    const guerra = t => rivales.some(o => S().enGuerra(c, o) && [t - 1, t + 1, t - tw, t + tw].some(n => m.dueno[region(m, n)] === o.id)) ? 0 : 1;
    c.trincheraPlan = [...new Set(out)].sort((p, q) => guerra(p) - guerra(q) || dist(m, p, cap) - dist(m, q, cap)).slice(0, MAX_TRINCHERA);
  }
  const enTrinchera = (v, a) => !!(v.trinchera && v.trinchera[a.y * v.tw + a.x]);
  function sitioMina(m, c, ter) {
    const v = m.vida, cap = centro(m, c.capital);
    let mejor = null, md = 1e9;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (ter[t] !== 'montana' || v.obra[t] || v.roca[t] || v.arbol[t] >= 2 || v.camino[t] || ocupada(v, t) || (v.andamios && v.andamios[t])) continue;
      if ((c.minasT || []).some(u => dist(m, u, t) < 6)) continue;
      const d = dist(m, t, cap) - (ter[t] === 'montana' ? 2 : 0); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  function sitioPetroleo(m, c, ter) {
    const v = m.vida;
    if (!v.crudo) return null;
    const cap = centro(m, c.capital);
    let mejor = null, md = 1e9;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (!v.crudo[t] || v.obra[t] || v.roca[t] || v.camino[t] || !CONSTRUIBLE.has(ter[t]) || (v.andamios && v.andamios[t])) continue;
      // Uno por bolsa: si ya hay un pozo pegado, esa bolsa está tomada.
      if ([1, -1, v.tw, -v.tw, v.tw + 1, v.tw - 1, -v.tw + 1, -v.tw - 1].some(d => v.obra[t + d] === OBRA.petroleo)) continue;
      const d = dist(m, t, cap); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  function edificioPendiente(m, a, c, ter) {
    const v = m.vida;
    // Con un encargo del jugador pendiente, la madera y la piedra se guardan para él (en la capital).
    const plazas = c.plan && c.plan.obra ? [c.capital] : [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].sort((p, q) => S().distancia(p, a.h) - S().distancia(q, a.h));
    for (const r of plazas.slice(0, 3)) {
      const zona = [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)];
      const tiles = zona.flatMap(z => parcelas(m, z));
      const tiene = o => tiles.some(t => v.obra[t] === o || (v.andamios && v.andamios[t] && v.andamios[t].o === o));
      const libreEn = (lista, ok) => lista.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && !calleDelPlan(m, t) && ok(t)).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
      // El sitio de un molino nuevo: tierra de cultivo fuera del casco, lejos de los otros molinos, lo más cerca posible del pueblo.
      const sitioMolino = () => tiles.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && CULTIVABLE.has(ter[t]) && !enCasco(m, t) && !tiles.some(u => v.obra[u] === OBRA.molino && dist(m, u, t) < rangoMolino(m) * 2 - 1)).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
      const pide = [];
      if (!tiene(OBRA.molino)) pide.push([OBRA.molino, () => (pausada(m) ? sitioMolino() : null) || libreEn(tiles, t => CULTIVABLE.has(ter[t]))]);
      else if (pausada(m) && c.campos < metaCampos(c) && !(c.enCurso && c.enCurso[OBRA.molino] > m.turno - 8) && tiles.filter(t => !v.obra[t] && !v.roca[t] && !v.camino[t] && !ocupada(v, t) && CULTIVABLE.has(ter[t]) && !enCasco(m, t) && molinoCerca(m, c, null, t)).length < 3) {
        // Los molinos que hay ya no dan para más campos: otro en el borde de la huerta.
        pide.unshift([OBRA.molino, sitioMolino]);
      }
      if (c.era >= 1 && !tiene(OBRA.torre)) pide.push([OBRA.torre, () => libreEn(parcelas(m, r), t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && !tiene(OBRA.templo)) pide.push([OBRA.templo, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // La casa del saber (cabaña del chamán, academia, monasterio, universidad, laboratorio): donde estudian los eruditos.
      if (!tiene(OBRA.saber) && (r === c.capital || c.era >= 3)) pide.push([OBRA.saber, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // Lo militar, según la fase: cuartel de soldados y arquería en la capital desde el Bronce, y un castillo
      // (luego fortaleza o búnker) en una plaza de frontera desde la Edad del Hierro.
      if (c.era >= 1 && r === c.capital && !(c.cuarteles > 0) && !tiene(OBRA.cuartel)) pide.push([OBRA.cuartel, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 1 && r === c.capital && !(c.arquerias > 0) && !tiene(OBRA.arqueria)) pide.push([OBRA.arqueria, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      if (c.era >= 2 && !(c.castillos > 0) && (plazaFronteriza(m, c, r, plazas) || (c.plan && c.plan.obra === 'castillo' && r === c.capital))) pide.push([OBRA.castillo, () => libreEn(parcelas(m, r), t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      // El control fronterizo (desde la Revolución Industrial): un puesto con barrera y guardias donde cada
      // carretera de comercio sale de su tierra.
      if (r === c.capital && c.era >= ERA_OBRA[OBRA.aduana]) { const pf = pasoSinPuesto(m, c, ter); if (pf) pide.push([OBRA.aduana, () => pf.sitio]); }
      // La mina: en la montaña más cercana (solo ahí), una galería que no se agota (pero da poco a poco).
      if (r === c.capital && c.era >= ERA_OBRA[OBRA.mina] && (c.minas || 0) < 1 + (c.era >= 4 ? 1 : 0) && (c.aldeanos || 0) >= 12) {
        const sm = sitioMina(m, c, ter); if (sm != null) pide.push([OBRA.mina, () => sm]);
      }
      // El pozo de petróleo: sobre una bolsa de crudo de su tierra (uno por bolsa, hasta tres), si le hace falta o lo vende.
      if (r === c.capital && pausada(m) && c.era >= ERA_OBRA[OBRA.petroleo] && v.crudo && (c.pozosPetroleo || 0) < 3 && ((c.petroleo || 0) < objetivo(c, 'petroleo') * 1.5 || (c.cartera && c.cartera.petroleo))) {
        const sitio = sitioPetroleo(m, c, ter);
        if (sitio != null) pide.unshift([OBRA.petroleo, () => sitio]);
      }
      if (c.era >= 1 && !tiene(OBRA.puerto)) pide.push([OBRA.puerto, () => libreEn(tiles, t => ter[t] === 'arena' && [1, -1, v.tw, -v.tw].some(d => ter[t + d] === 'agua' || ter[t + d] === 'bajo'))]);
      // Lo que la gente necesita de verdad (agua, sitio para el grano, una plaza, un parque, un palacio), según el pueblo.
      if (pausada(m)) for (const n of (c.necesidades || [])) if (n.falta && n.region === r && !tiene(OBRA[n.obra]) && !pide.some(x => x[0] === OBRA[n.obra])) {
        const o = OBRA[n.obra];
        // Si la ciudad ya está llena, la obra pública se levanta sobre la huerta más cercana al centro.
        const huerta = lista => lista.filter(t => v.obra[t] === OBRA.campo && !v.camino[t]).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0];
        pide.splice(n.urgente ? 0 : Math.min(pide.length, 1), 0, [o, () => libreEn(o === OBRA.fuente || o === OBRA.palacio ? parcelas(m, r) : tiles, t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t])) || huerta(parcelas(m, r)) || huerta(tiles)]);
      }
      // Lo que pide la edad siguiente (un templo, un cuartel, un castillo) se levanta en la capital, y antes que nada.
      const pideEdad = M.EDADES[c.era + 1] && M.EDADES[c.era + 1].pide.obra ? OBRA[M.EDADES[c.era + 1].pide.obra] : null;
      const cuentaDe = { [OBRA.templo]: 'templos', [OBRA.cuartel]: 'cuarteles', [OBRA.castillo]: 'castillos' };
      if (pideEdad && r === c.capital && !(c[cuentaDe[pideEdad]] > 0) && !tiene(pideEdad) && !pide.some(x => x[0] === pideEdad) && (pideEdad !== OBRA.castillo || c.era >= 2)) pide.unshift([pideEdad, () => libreEn(tiles, t => CONSTRUIBLE.has(ter[t]))]);
      else if (pideEdad && r === c.capital) { const i = pide.findIndex(x => x[0] === pideEdad); if (i > 0) pide.unshift(pide.splice(i, 1)[0]); }
      // Lo que pidió el jugador va primero; cuando ya está hecho en la plaza, se olvida el encargo.
      const encargo = c.plan && c.plan.obra ? OBRA[c.plan.obra] : null;
      if (encargo && r === c.capital && tiene(encargo)) {
        const NOMBRES = { [OBRA.pozo]: 'El pozo', [OBRA.granero]: 'El granero', [OBRA.fuente]: 'La plaza pública', [OBRA.parque]: 'El parque', [OBRA.palacio]: 'El palacio', [OBRA.central]: 'La central eléctrica', [OBRA.banco]: 'El banco', [OBRA.fabrica]: 'La fábrica', [OBRA.estacion]: 'La estación de tren', [OBRA.hospital]: 'El hospital', [OBRA.aerodromo]: 'El aeródromo', [OBRA.saber]: 'La casa del saber', [OBRA.templo]: 'El templo', [OBRA.torre]: 'La torre', [OBRA.puerto]: 'El puerto', [OBRA.molino]: 'El molino', [OBRA.cuartel]: 'El cuartel', [OBRA.arqueria]: 'La arquería', [OBRA.castillo]: 'El castillo', [OBRA.aduana]: 'El puesto fronterizo', [OBRA.petroleo]: 'El pozo de petróleo', [OBRA.mina]: 'La mina' };
        S().cronica(m, 'obra', (NOMBRES[encargo] || 'La obra') + ' de ' + c.nombre + (encargo === OBRA.torre || encargo === OBRA.arqueria || encargo === OBRA.fuente || encargo === OBRA.central || encargo === OBRA.fabrica || encargo === OBRA.estacion ? ' está terminada' : ' está terminado'), 'Los constructores de ' + c.nombre + ' terminan lo que su gobierno les encargó y lo celebran con una fiesta en la plaza.', c);
        c.plan.obra = null;
      }
      else if (encargo && r === c.capital) {
        if (!pide.some(x => x[0] === encargo)) { const huerta = lista => lista.filter(t => v.obra[t] === OBRA.campo && !v.camino[t]).sort((p, q) => dist(m, p, centro(m, r)) - dist(m, q, centro(m, r)))[0]; pide.push([encargo, () => libreEn(encargo === OBRA.fuente || encargo === OBRA.palacio ? parcelas(m, r) : tiles, t => CONSTRUIBLE.has(ter[t])) || libreEn(tiles, t => CONSTRUIBLE.has(ter[t])) || (PUBLICAS.has(encargo) ? huerta(tiles) : null)]); }
        const solo = pide.filter(x => x[0] === encargo || x[0] === OBRA.molino); pide.length = 0; pide.push(...solo.sort((x, y) => (y[0] === encargo) - (x[0] === encargo))); }
      for (const [obra, donde] of pide) {
        // Si otro constructor ya va a levantar este edificio, no se empieza otro igual.
        if (c.enCurso && c.enCurso[obra] > m.turno - 3) continue;
        const coste = COSTES[obra];
        // Lo que se guarda para la mejora de la edad no se gasta en obras (salvo en el molino, que da de comer).
        const res = obra === OBRA.molino ? null : S().reservaMejora(m, c), rs = k => (res && res[k]) || 0;
        if (c.madera - rs('madera') < coste[0] || c.piedra - rs('piedra') < coste[1] || (c.oro || 0) - rs('oro') < (coste[2] || 0) || (c.nivel || 0) < (NIVEL_OBRA[obra] || 0)) continue;
        // Ahorrando para la edad, solo se levanta lo que la edad pide (o lo que mandó el jugador).
        const pideEdad = M.EDADES[c.era + 1] && M.EDADES[c.era + 1].pide.obra && OBRA[M.EDADES[c.era + 1].pide.obra] === obra;
        const necesaria = (c.necesidades || []).some(n => n.falta && OBRA[n.obra] === obra);
        if (S().ahorrando(m, c) && (coste[2] || 0) > 0 && !pideEdad && !necesaria && !(c.plan && c.plan.obra && OBRA[c.plan.obra] === obra)) continue;
        const t = donde();
        if (t != null) { if (obra !== OBRA.molino || pausada(m)) (c.enCurso = c.enCurso || {})[obra] = m.turno; return [t, obra]; }
      }
    }
    return null;
  }

  /*
   * LOS BARCOS: cada puerto tiene un barco de pesca (trae comida) y, desde la Antigüedad, un mercante que
   * navega hasta el puerto de otro reino en paz y vuelve (oro para los dos).
   */
  function navegable(ter, t) { return ter[t] === 'agua' || ter[t] === 'bajo'; }
  function rutaPorMar(m, de, a, ter) {
    const v = m.vida, prev = new Map([[de, -1]]), cola = [de];
    for (let i = 0; i < cola.length && cola.length < 14000; i++) {
      const t = cola[i];
      if (t === a) break;
      const x = t % v.tw;
      for (const n of [x > 0 ? t - 1 : -1, x < v.tw - 1 ? t + 1 : -1, t - v.tw, t + v.tw]) {
        if (n < 0 || n >= ter.length || prev.has(n) || (!navegable(ter, n) && n !== a)) continue;
        prev.set(n, t); cola.push(n);
      }
    }
    if (!prev.has(a)) return null;
    const out = [a];
    while (prev.get(out[out.length - 1]) !== -1) out.push(prev.get(out[out.length - 1]));
    return out.reverse();
  }
  const aguaJunto = (m, t, ter) => [1, -1, m.vida.tw, -m.vida.tw].map(d => t + d).find(n => n >= 0 && n < ter.length && navegable(ter, n));
  let puertosDelTurno = [], travesias = {};
  function barcos(m, ter) {
    const v = m.vida;
    puertosDelTurno = [];
    for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.puerto) puertosDelTurno.push(t);
    v.barcos = (v.barcos || []).filter(b => v.obra[b.puerto] === OBRA.puerto && m.dueno[region(m, b.puerto)] === b.c);
    for (const t of puertosDelTurno) {
      const c = S().civ(m, m.dueno[region(m, t)]);
      if (!c) continue;
      const agua = aguaJunto(m, t, ter);
      if (agua == null) continue;
      for (const tipo of c.era >= 3 ? ['pesca', 'mercante'] : ['pesca']) {
        if (v.barcos.some(b => b.puerto === t && b.tipo === tipo)) continue;
        v.barcos.push({ id: v.sig++, tipo, c: c.id, puerto: t, x: agua % v.tw, y: agua / v.tw | 0, ruta: null, i: 0, vuelta: 0, r: [] });
      }
      // La marina de guerra (desde la Revolución Industrial): en guerra, cada puerto con cuartel bota un
      // acorazado. Cuesta metal (y petróleo en la Era Moderna) y bombardea la costa del enemigo.
      const crudo = c.era >= 7 && pausada(m) ? 2 : 0;
      if (c.era >= 6 && c.guerras.length && c.cuarteles > 0 && !v.barcos.some(b => b.puerto === t && b.tipo === 'guerra') && (c.metal || 0) + (c.armas || 0) >= 8 && (c.petroleo || 0) >= crudo) {
        // El hierro sale del almacén de metal y, si no llega, de las armas ya forjadas.
        const deMetal = Math.min(8, Math.max(0, c.metal || 0)); c.metal -= deMetal; c.armas -= 8 - deMetal; c.petroleo = (c.petroleo || 0) - crudo;
        v.barcos.push({ id: v.sig++, tipo: 'guerra', c: c.id, puerto: t, x: agua % v.tw, y: agua / v.tw | 0, ruta: null, i: 0, vuelta: 0, r: [], pv: 120 });
        (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚓ Botado un acorazado' });
      }
    }
    // En paz, los acorazados vuelven a puerto y se desarman.
    v.barcos = v.barcos.filter(b => b.tipo !== 'guerra' || ((S().civ(m, b.c) || { guerras: [] }).guerras.length && (b.pv == null || b.pv > 0)));
  }
  // El acorazado: navega hacia el puerto enemigo más cercano y, cuando tiene a tiro soldados o edificios de la
  // costa enemiga, dispara sus cañones (los soldados enemigos con artillería y las torres le responden).
  function navegarGuerra(m, b, c, ter, paso) {
    const v = m.vida, tw = v.tw, enemigo = o => o && c.guerras.some(g => g.con === o.id);
    if (!b.ruta || b.i >= b.ruta.length - 1) {
      // Va al puerto enemigo más cercano al que se pueda llegar por mar (los de otros mares no cuentan).
      const de = b.y * tw + b.x;
      if (travesias.mundo !== m) travesias = { mundo: m };
      const blancos = puertosDelTurno.filter(t => enemigo(S().civ(m, m.dueno[region(m, t)]))).map(t => aguaJunto(m, t, ter)).filter(a => a != null && a !== de).sort((p, q) => dist(m, de, p) - dist(m, de, q)).slice(0, 3);
      b.ruta = null; b.i = 0;
      for (const a of blancos) {
        const clave = 'g' + de + '>' + a;
        if (!(clave in travesias)) travesias[clave] = rutaPorMar(m, de, a, ter);
        if (travesias[clave] && travesias[clave].length > 1) { b.ruta = travesias[clave]; break; }
      }
    }
    if (b.ruta && b.i < b.ruta.length - 1) { b.i = Math.min(b.ruta.length - 1, b.i + 1); const t = b.ruta[b.i]; b.x = t % tw; b.y = t / tw | 0; }
    else if (!b.ruta) {
      // Sin puerto enemigo a su alcance, patrulla la costa propia: así defiende de los desembarcos.
      const base = aguaJunto(m, b.puerto, ter);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
        const n = (b.y + dy) * tw + b.x + dx;
        if (b.x + dx >= 0 && b.x + dx < tw && n >= 0 && n < ter.length && navegable(ter, n) && base != null && dist(m, n, base) <= 12) { b.x += dx; b.y += dy; break; }
      }
    }
    // Los cañones: alcance 7, uno de cada dos pasos.
    if (paso % 2) return;
    const objetivos = v.aldeanos.filter(a => a.o === GUERRERO && enemigo(S().civ(m, a.c)) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 7);
    if (objetivos.length) {
      const a = objetivos[Math.floor(azar(v) * objetivos.length)];
      v.disparos.push([b.x, b.y, a.x, a.y, paso, 1]);
      const d = Math.max(1, Math.round(48 * (0.8 + azar(v) * 0.4) * (1 - (ARMADURAS[a.armadura || 0] || ARMADURAS[0]).reduce * 0.3)));
      if (azar(v) < 0.55 && golpear(v, null, a, d, paso + 0.5, b.x, b.y)) { v.aldeanos = v.aldeanos.filter(x => x !== a); v.muertos.push([a.x, a.y, a.c, 'acorazado', paso + 0.5, a]); apuntarBaja(m, c.id, a); }
      // La artillería y los tanques de la costa le devuelven el fuego.
      if (objetivos.some(x => x.veh) && azar(v) < 0.25) b.pv -= 20;
      return;
    }
    // Sin soldados a tiro: bombardea edificios de la costa enemiga (los deja en ruinas de vez en cuando).
    if (azar(v) < 0.3) {
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const t = (b.y + dy) * tw + b.x + dx; if (t < 0 || t >= v.obra.length || Math.abs(dx) + Math.abs(dy) > 6) continue;
        const o = v.obra[t]; if (!o || o === OBRA.ruina || o === OBRA.campo || !enemigo(S().civ(m, m.dueno[region(m, t)]))) continue;
        v.disparos.push([b.x, b.y, t % tw, t / tw | 0, paso, 1]);
        if (v.torres && v.torres[t] != null) { v.torres[t] -= 6; if (v.torres[t] <= 0) { cambiar(m, 'obra', t, OBRA.ruina, paso); delete v.torres[t]; } else b.pv -= 4; }
        else if (azar(v) < 0.2) { cambiar(m, 'obra', t, OBRA.ruina, paso); marcar(m, t, 'escombros', 10, paso); }
        return;
      }
    }
  }
  function navegar(m, b, ter, paso) {
    const v = m.vida, c = S().civ(m, b.c);
    if (!c) return;
    if (b.tipo === 'guerra') { navegarGuerra(m, b, c, ter, paso || 1); b.r.push(b.x, b.y); return; }
    if (b.tipo === 'pesca') {
      // Faena cerca de su puerto: cada tanto vuelve con pescado.
      const base = aguaJunto(m, b.puerto, ter);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
        const n = (b.y + dy) * v.tw + b.x + dx;
        if (b.x + dx >= 0 && b.x + dx < v.tw && n >= 0 && n < ter.length && navegable(ter, n) && dist(m, n, base) <= 7) { b.x += dx; b.y += dy; break; }
      }
      if (azar(v) < 0.15) c.comida = (c.comida || 0) + 1;
    } else {
      if (!b.ruta) {
        if (azar(v) < 0.7) { b.r.push(b.x, b.y); return; }
        const otros = puertosDelTurno.filter(t => { if (t === b.puerto) return false; const o = S().civ(m, m.dueno[region(m, t)]); return o && o.id !== c.id && !S().enGuerra(c, o); });
        if (!otros.length) { b.r.push(b.x, b.y); return; }
        const destino = otros[Math.floor(azar(v) * otros.length)];
        const de = aguaJunto(m, b.puerto, ter), a = aguaJunto(m, destino, ter);
        // Las travesías se recuerdan (el mar no cambia): solo se calcula la primera vez.
        const clave = de + '>' + a;
        if (!(clave in travesias) || travesias.mundo !== m) { if (travesias.mundo !== m) travesias = { mundo: m }; travesias[clave] = de != null && a != null ? rutaPorMar(m, de, a, ter) : null; }
        const ruta = travesias[clave];
        if (!ruta || ruta.length < 3) { b.r.push(b.x, b.y); return; }
        b.ruta = ruta; b.i = 0; b.vuelta = 0; b.destino = destino;
      }
      b.i += b.vuelta ? -2 : 2;
      if (!b.vuelta && b.i >= b.ruta.length - 1) {
        b.i = b.ruta.length - 1; b.vuelta = 1;
        const o = S().civ(m, m.dueno[region(m, b.destino)]);
        if (o && !S().enGuerra(c, o)) { c.riqueza += 5 + c.era; o.riqueza += 4 + o.era; c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1); }
      } else if (b.vuelta && b.i <= 0) { b.i = 0; b.ruta = null; }
      const t = b.ruta ? b.ruta[Math.max(0, Math.min(b.ruta.length - 1, b.i))] : aguaJunto(m, b.puerto, ter);
      if (t != null) { b.x = t % v.tw; b.y = t / v.tw | 0; }
    }
    b.r.push(b.x, b.y);
  }

  /*
   * EL ASEDIO, como en WorldBox: si el capitán está en la plaza enemiga, sin defensores y sin torre en pie,
   * la captura avanza; al llegar a 100, la plaza y sus tierras cambian de bandera.
   */
  function asedios(m, paso) {
    const v = m.vida;
    for (const id of Object.keys(v.ejercitos)) {
      const e = v.ejercitos[id], c = S().civ(m, +id), o = S().civ(m, e.con);
      if (!c || !o || !o.viva || e.fase !== 'marcha' || e.defiende != null || m.dueno[e.obj] !== o.id) continue;
      const enRegion = a => region(m, a.y * v.tw + a.x) === e.obj;
      const nuestros = v.aldeanos.filter(a => a.c === c.id && a.o === GUERRERO && enRegion(a));
      const defensores = v.aldeanos.filter(a => a.c === o.id && a.o === GUERRERO && enRegion(a)).length;
      const capitan = nuestros.some(a => a.id === e.capitan);
      const torre = parcelas(m, e.obj).some(t => v.obra[t] === OBRA.torre || v.obra[t] === OBRA.castillo);
      e.estorbo = torre ? 'torre' : defensores ? 'defensores' : !capitan ? 'lejos' : null;
      if (capitan && !defensores && !torre) e.asedio = Math.min(100, (e.asedio || 0) + 1.5 + 0.6 * Math.min(8, nuestros.length));
      else if (defensores) e.asedio = Math.max(0, (e.asedio || 0) - 2);
      if (e.asedio >= 100) capturar(m, c, o, e.obj, paso);
    }
  }
  function capturar(m, c, o, r, paso) {
    const v = m.vida, esCapital = o.capital === r;
    const tierras = S().casillas(m, o).filter(i => i === r || (S().distancia(i, r) <= 2 && S().distancia(i, r) < S().distancia(i, o.capital)));
    for (const i of tierras) m.dueno[i] = c.id;
    const ciudad = (m.ciudades || []).find(x => x.region === r);
    o.estab -= esCapital ? 20 : 8;
    c.victorias = (c.victorias || 0) + 3;
    const gc = c.guerras.find(g => g.con === o.id), go = o.guerras.find(g => g.con === c.id);
    if (gc) { gc.ganadas = (gc.ganadas || 0) + 1; gc.comarcas = (gc.comarcas || 0) + tierras.length; }
    if (go) { go.perdidas = (go.perdidas || 0) + 1; go.comarcas = (go.comarcas || 0) - tierras.length; }
    if (c.plan && c.plan.objetivo === r) c.plan.objetivo = null;
    (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🏴 ¡' + (ciudad ? ciudad.nombre : esCapital ? 'La capital de ' + o.nombre : 'La plaza') + ' es nuestra!', region: r });
    (v.anuncios = v.anuncios || []).push({ civ: o.id, texto: '✖ Perdemos ' + (ciudad ? ciudad.nombre : esCapital ? 'la capital' : 'una plaza'), region: r });
    S().cronica(m, 'conquista', c.nombre + (esCapital ? ' toma la capital de ' : ' conquista ') + (ciudad ? ciudad.nombre : esCapital ? o.nombre : 'una plaza de ' + o.nombre), 'Tras ' + (esCapital ? 'un largo asedio' : 'el asedio') + ', el estandarte de ' + c.nombre + ' ondea en ' + (ciudad ? ciudad.nombre : 'la plaza') + '. ' + tierras.length + ' comarcas cambian de dueño.', c, r, { importante: esCapital });
    delete v.ejercitos[c.id];
    void paso;
  }


  /*
   * EL FUEGO, EL AGUA Y LAS MARCAS DEL SUELO, como en WorldBox: el fuego prende en árboles, casas y campos
   * (flechas incendiarias, obuses, bombas, incendios, sequías, sabotajes), salta a lo de al lado y, al apagarse,
   * deja ceniza, tocones y ruinas. La gente de la aldea lo apaga; el agua y las inundaciones lo paran.
   * Las bombas dejan cráteres; las batallas, sangre; los derrumbes, escombros. Todo se va borrando con el tiempo.
   */
  const MARCA = { ceniza: 1, crater: 2, sangre: 3, escombros: 4 };
  const ardible = (v, t) => v.arbol[t] >= 1 || (v.obra[t] && v.obra[t] !== OBRA.ruina && v.obra[t] !== OBRA.puerto);
  function marcar(m, t, tipo, turnos, paso) {
    const v = m.vida, mk = v.marcas = v.marcas || {};
    const ya = mk[t];
    if (ya && ya[0] === MARCA.crater && tipo !== 'crater') return;
    mk[t] = [MARCA[tipo], m.turno + turnos];
    // El paso del turno en que aparece (la vista la enseña en ese momento).
    if (paso) (v.marcasPaso = v.marcasPaso || {})[t] = paso;
  }
  function prender(m, t, paso, fuerza) {
    const v = m.vida, ter = terrenos(m);
    if (t < 0 || t >= ter.length || mojada(ter[t]) || !ardible(v, t)) return false;
    v.fuego = v.fuego || {}; v.inundado = v.inundado || {};
    if (v.fuego[t] || v.inundado[t]) return false;
    v.fuego[t] = (fuerza || 3) + Math.floor(azar(v) * 3) + (v.obra[t] === OBRA.casa ? 2 : 0);
    (v.llamas = v.llamas || {})[t] = [paso || 0, TICKS + 1];
    return true;
  }
  function apagar(m, t, paso) {
    const v = m.vida;
    delete v.fuego[t];
    if (v.llamas && v.llamas[t]) v.llamas[t][1] = paso;
  }
  // Lo que deja el fuego al consumirse.
  function quemado(m, t, paso) {
    const v = m.vida;
    if (v.arbol[t] >= 1) cambiar(m, 'arbol', t, 0, paso);
    const o = v.obra[t];
    if (o === OBRA.campo) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); }
    else if (o && o !== OBRA.ruina) {
      cambiar(m, 'obra', t, OBRA.ruina, paso);
      if (v.torres && v.torres[t] != null) delete v.torres[t];
      marcar(m, t, 'escombros', 10, paso);
    }
    marcar(m, t, 'ceniza', 8, paso);
  }
  // Un paso del fuego: arde, salta, quema a quien esté dentro, y la gente lo apaga.
  function arder(m, paso, gente) {
    const v = m.vida;
    if (!v.fuego) return;
    const claves = Object.keys(v.fuego);
    if (!claves.length) return;
    const ter = terrenos(m), tw = v.tw, mucho = claves.length > 500;
    const humedo = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.comida > 1.2 && e.hasta > m.turno)).map(c => c.id)); // diluvio reciente
    const seco = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.sequia)).map(c => c.id));
    const nuevos = [];
    for (const k of claves) {
      const t = +k, r = region(m, t), dueno = m.dueno[r];
      if (!ardible(v, t) || (v.inundado && v.inundado[t]) || humedo.has(dueno)) { apagar(m, t, paso); continue; }
      // Los vecinos acuden con cubos: cuanta más gente en la comarca, antes se apaga (en sequía, peor).
      const cubos = Math.min(0.3, 0.012 * (gente.get(r) || 0)) * (seco.has(dueno) ? 0.5 : 1);
      if (azar(v) < cubos) { apagar(m, t, paso); marcar(m, t, 'ceniza', 3); continue; }
      v.fuego[t]--;
      if (v.fuego[t] <= 0) { apagar(m, t, paso); quemado(m, t, paso); continue; }
      if (mucho) continue;
      const x = t % tw;
      for (const nb of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) {
        if (nb < 0 || nb >= ter.length || v.fuego[nb] || !ardible(v, nb)) continue;
        const d = m.dueno[region(m, nb)];
        const p = (v.arbol[nb] >= 1 ? 0.27 : v.obra[nb] === OBRA.campo ? 0.2 : 0.14) * (seco.has(d) ? 1.8 : 1) * (ter[nb] === 'selva' || ter[nb] === 'pantano' ? 0.5 : ter[nb] === 'sabana' || ter[nb] === 'desierto' ? 1.4 : 1);
        if (azar(v) < p) nuevos.push(nb);
      }
    }
    for (const t of nuevos) prender(m, t, paso, 2);
    // Quien está en una parcela en llamas se quema.
    for (const a of v.aldeanos) {
      const t = a.y * tw + a.x;
      if (v.fuego[t] && azar(v) < 0.6 && golpear(v, null, a, 7 + Math.floor(azar(v) * 6), paso + 0.3, a.x, a.y - 1)) {
        a.quemado = 1; v.muertos.push([a.x, a.y, a.c, 'fuego', paso + 0.3, a]);
      }
    }
    if (v.aldeanos.some(a => a.quemado)) v.aldeanos = v.aldeanos.filter(a => !a.quemado);
  }
  // Inundaciones: el agua sube por las tierras bajas junto a ríos y costas; ahoga campos, tumba casas y apaga fuegos.
  function inundar(m, c, turnos) {
    const v = m.vida, ter = terrenos(m), tw = v.tw;
    v.inundado = v.inundado || {};
    const regiones = new Set(S().casillas(m, c));
    const dist = new Map(), cola = [];
    for (let t = 0; t < ter.length; t++) if ((ter[t] === 'rio' || ter[t] === 'bajo') && regiones.has(region(m, t))) { dist.set(t, 0); cola.push(t); }
    let n = 0;
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], d = dist.get(t), x = t % tw;
      if (d >= 2) continue;
      for (const nb of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) {
        if (nb < 0 || nb >= ter.length || dist.has(nb) || mojada(ter[nb]) || ter[nb] === 'montana' || ter[nb] === 'colina' || !regiones.has(region(m, nb))) continue;
        if (azar(v) > 0.8) continue;
        dist.set(nb, d + 1); cola.push(nb);
        v.inundado[nb] = turnos; n++;
        if (v.fuego && v.fuego[nb]) apagar(m, nb, 0);
        if (v.obra[nb] === OBRA.campo && azar(v) < 0.6) { cambiar(m, 'obra', nb, 0, 0); cambiar(m, 'cultivo', nb, 0, 0); }
        else if (v.obra[nb] === OBRA.casa && azar(v) < 0.2) { cambiar(m, 'obra', nb, OBRA.ruina, 0); marcar(m, nb, 'escombros', 10); }
      }
    }
    return n;
  }
  // Al empezar el turno: se secan las inundaciones, se borran las marcas viejas y, en sequía, arde algún bosque.
  function ambiente(m) {
    const v = m.vida;
    v.llamas = {}; v.marcasPaso = {};
    for (const k of Object.keys(v.fuego || {})) v.llamas[k] = [0, TICKS + 1];
    for (const k of Object.keys(v.inundado || {})) if (--v.inundado[k] <= 0) delete v.inundado[k];
    for (const k of Object.keys(v.marcas || {})) if (v.marcas[k][1] <= m.turno) delete v.marcas[k];
    for (const c of S().vivas(m)) {
      if (!c.efectos.some(e => e.sequia) || azar(v) > 0.25) continue;
      const cs = S().casillas(m, c), r = cs[Math.floor(azar(v) * cs.length)];
      const ts = r != null ? parcelas(m, r).filter(t => v.arbol[t] >= 2) : [];
      if (ts.length && prender(m, ts[Math.floor(azar(v) * ts.length)], 1, 4)) {
        if (!(c.ultimoIncendio > m.turno - 8)) { c.ultimoIncendio = m.turno; S().cronica(m, 'incendio', 'Fuego en los bosques de ' + c.nombre, 'La sequía lo ha dejado todo como yesca: un rayo, una brasa mal apagada, y el monte arde. Los aldeanos salen con cubos y ramas.', c, r); }
      }
    }
  }

  /*
   * LOS AVIONES (II Guerra Mundial): un pueblo en guerra con metal manda bombarderos sobre el ejército enemigo.
   * Cruzan el mapa desde su capital y sueltan bombas que hieren a todos los guerreros de alrededor.
   */
  function aviones(m, paso, guerreros) {
    const v = m.vida;
    v.aviones = [];
    for (const c of S().vivas(m)) {
      if (c.era < 8 || !c.guerras.length || !(c.cuarteles > 0) || (c.metal || 0) < 3 || azar(v) > 0.6 || (pausada(m) && (!(c.aerodromos > 0) || (c.petroleo || 0) < 2))) continue;
      if (pausada(m)) c.petroleo -= 2;
      const e = v.ejercitos[c.id];
      const hacia = e ? centro(m, e.defiende != null ? e.defiende : e.obj) : null;
      const blancos = v.aldeanos.filter(b => b.o === GUERRERO && c.guerras.some(g => g.con === b.c) && (hacia == null || dist(m, b.y * v.tw + b.x, hacia) <= 14));
      if (!blancos.length) continue;
      c.metal -= 3;
      const cap = centro(m, c.capital), cx = cap % v.tw, cy = cap / v.tw | 0;
      const pasadas = Math.min(2, 1 + Math.floor(blancos.length / 12));
      for (let q = 0; q < pasadas; q++) {
        const b = blancos[Math.floor(azar(v) * blancos.length)];
        v.aviones.push([cx, cy, b.x, b.y, paso + q * 0.7, c.id]);
        // Las bombas caen un poco después de que el avión llegue sobre el blanco.
        const cae = paso + q * 0.7 + 1.6;
        for (let k = 0; k < 3; k++) {
          const bx = b.x + Math.round((azar(v) - 0.5) * 3), by = b.y + Math.round((azar(v) - 0.5) * 3);
          v.disparos.push([bx, by - 5, bx, by, cae - 1 + k * 0.15, 3]);
          // La bomba arrasa lo que hay: cráter, casas en ruinas, árboles arrancados y fuego.
          const tb = by * v.tw + bx;
          if (tb >= 0 && tb < v.obra.length) {
            marcar(m, tb, 'crater', 14, cae);
            if (v.arbol[tb] >= 1) cambiar(m, 'arbol', tb, 0, cae);
            if (v.obra[tb] && v.obra[tb] !== OBRA.ruina && v.obra[tb] !== OBRA.centro) { cambiar(m, 'obra', tb, OBRA.ruina, cae); marcar(m, tb, 'escombros', 12, cae); if (v.torres && v.torres[tb] != null) delete v.torres[tb]; }
            if (azar(v) < 0.55) for (const d of [0, 1, -1, v.tw]) prender(m, tb + d, Math.min(TICKS, Math.ceil(cae)), 3);
          }
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const o of guerreros.get((by + dy) * v.tw + bx + dx) || []) {
            if (!c.guerras.some(g => g.con === o.c) || !v.aldeanos.includes(o) || azar(v) > 0.55) continue;
            const arm = o.veh ? VEHICULOS[o.veh].blindaje || 0 : (ARMADURAS[o.armadura || 0] || ARMADURAS[0]).reduce;
            if (golpear(v, null, o, Math.round(55 * (0.8 + azar(v) * 0.4) * (1 - arm * 0.4)), cae, bx, by)) {
              v.aldeanos = v.aldeanos.filter(x => x !== o); v.muertos.push([o.x, o.y, o.c, 'bomba', cae, o]); apuntarBaja(m, c.id, o); c.victorias = (c.victorias || 0) + 1;
            }
          }
        }
      }
    }
  }

  /*
   * LAS TORRES DE VIGILANCIA: disparan flechas a los guerreros enemigos cercanos e impiden la captura de su
   * plaza mientras estén en pie. Los guerreros que las rodean las acaban derribando.
   */
  function torres(m, paso, guerreros) {
    const v = m.vida;
    v.torres = v.torres || {};
    for (const k of Object.keys(v.torres)) {
      const t = +k;
      const castillo = v.obra[t] === OBRA.castillo;
      const aduana = v.obra[t] === OBRA.aduana;
      if (v.obra[t] !== OBRA.torre && !castillo && !aduana) { delete v.torres[k]; continue; }
      const c = S().civ(m, m.dueno[region(m, t)]);
      if (!c || !c.guerras.length) continue;
      const tx = t % v.tw, ty = t / v.tw | 0, alcance = castillo ? 6 : 4;
      const blancos = [];
      let cerca = 0;
      for (let dy = -alcance; dy <= alcance; dy++) for (let dx = -alcance; dx <= alcance; dx++) {
        const lista = guerreros.get((ty + dy) * v.tw + tx + dx);
        if (!lista) continue;
        for (const b of lista) if (c.guerras.some(g => g.con === b.c)) { blancos.push(b); if (Math.abs(dx) + Math.abs(dy) <= 1) cerca++; }
      }
      if (blancos.length) {
        // Los arqueros de las almenas: el castillo suelta varias flechas por paso (la torre, una o dos), cada una a
        // un blanco; desde la pólvora, además, su cañón o su ametralladora.
        const f = fase(c.era), arm = b => ARMADURAS[b.armadura || 0] || ARMADURAS[0];
        const disparo = (b, tiro, bala) => {
          v.disparos.push([tx, ty, b.x, b.y, paso, bala ? 1 : 0]);
          if (azar(v) < 0.5 && golpear(v, null, b, Math.max(1, Math.round(tiro.dano * (0.8 + azar(v) * 0.4) * (1 - arm(b).reduce * (1 - (tiro.perfora || 0))))), paso + 0.5, tx, ty)) {
            v.aldeanos = v.aldeanos.filter(a => a !== b); v.muertos.push([b.x, b.y, b.c, 'torre', paso + 0.5, b]); apuntarBaja(m, c.id, b);
            const i = blancos.indexOf(b); if (i >= 0) blancos.splice(i, 1);
          }
        };
        // Desde la pólvora, los defensores de las almenas ya no tiran flechas: disparan arcabuces, mosquetes y
        // rifles (balas con fogonazo y humo); en la Era Moderna, fusiles de repetición.
        const fuego = f >= 2, flechas = castillo ? 3 : 1 + (f >= 1 ? 1 : 0) + (f >= 3 ? 1 : 0);
        const flecha = fuego ? { dano: (castillo ? 30 : 24) + (f >= 3 ? 8 : 0), perfora: f >= 3 ? 0.65 : 0.5 } : { dano: castillo ? 14 : 11, perfora: f >= 1 ? 0.1 : 0 };
        for (let q = 0; q < flechas && blancos.length; q++) if (azar(v) < 0.7) disparo(blancos[Math.floor(azar(v) * blancos.length)], flecha, fuego);
        if (f >= 2 && blancos.length && azar(v) < (castillo ? 0.6 : 0.35)) disparo(blancos[0], f === 2 ? { dano: castillo ? 40 : 30, perfora: 0.6 } : { dano: castillo ? 48 : 40, perfora: 0.7 }, true);
      }
      if (cerca) { v.torres[k] -= cerca * 0.4; if (v.torres[k] <= 0) { cambiar(m, 'obra', t, OBRA.ruina, paso); delete v.torres[k]; } }
    }
  }

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
  function turno(m) {
    if (!m.vida) crear(m);
    const v = m.vida;
    memo = new Map();
    // Vencen las cuadrillas, cupos y prioridades con plazo que mandó el jugador.
    if (M.mando && M.mando.vencer) M.mando.vencer(m);
    v.cambios = []; v.muertos = []; v.disparos = []; v.aviones = [];
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
    ejercitos(m);
    const ter = terrenos(m);
    for (const a of v.aldeanos) a.r = [a.x, a.y, a.e === TRABAJAR ? ACC.trabajar : a.k ? ACC.cargar : ACC.andar];
    barcos(m, ter);
    for (const b of v.animales) b.r = [b.x, b.y];
    for (const b of v.barcos) b.r = [b.x, b.y];
    v.robadas = {}; v.mordidos = {};
    for (let paso = 1; paso <= TICKS; paso++) {
      for (const b of v.animales) pastar(m, b, ter);
      if (v.animales.some(b => b.muerta)) v.animales = v.animales.filter(b => !b.muerta);
      lobos(m, paso);
      for (const b of v.barcos) navegar(m, b, ter, paso);
      // Dónde está cada guerrero, para que se encuentren en la frontera.
      const guerreros = new Map();
      for (const a of v.aldeanos) if (a.o === GUERRERO) { const t = a.y * v.tw + a.x; (guerreros.get(t) || guerreros.set(t, []).get(t)).push(a); }
      const muertos = new Set();
      for (const a of v.aldeanos) if (!muertos.has(a)) actuar(m, a, rec[a.c], ter, paso, guerreros, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
      exterminio(m, paso, muertos);
      if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
      torres(m, paso, guerreros);
      if (paso === 2) aviones(m, paso, guerreros);
      if (v.fuego && paso % 2 === 0) { const gente = new Map(); for (const a of v.aldeanos) if ((a.edad || 0) >= ADULTO) { const r = region(m, a.y * v.tw + a.x); gente.set(r, (gente.get(r) || 0) + 1); } arder(m, paso, gente); }
      asedios(m, paso);
    }
    // Donde cae alguien en batalla queda sangre unos turnos.
    for (const [x, y, , tipo, paso] of v.muertos) if (['batalla', 'flecha', 'obus', 'bomba', 'torre'].includes(tipo)) marcar(m, y * v.tw + x, 'sangre', 3, paso || 0.1);
    naturaleza(m, ter);
    contar(m);
    ciudades(m);
    abandonos(m);
    planificarRutas(m, terrenos(m));
    if (pausada(m)) planificarVias(m, terrenos(m));
    fauna(m, ter);
    comer(m);
    if (pausada(m)) { subsuelo(m, ter); mercado(m, mapa(rec, x => ({ arboles: x.arboles.length, rocas: x.rocas.length, carbones: x.carbones.length }))); }
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
  }
  const mapa = (o, f) => { const r = {}; for (const k of Object.keys(o)) r[k] = f(o[k]); return r; };

  function actuar(m, a, rec, ter, paso, guerreros, muertos) {
    const v = m.vida, c = S().civ(m, a.c);
    let acc = a.k ? ACC.cargar : ACC.andar;
    if (!rec || !c) return;
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
      let rival = null;
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
          if (a.veh && VEHICULOS[a.veh].area) { const tb = blanco.y * v.tw + blanco.x; marcar(m, tb, 'crater', 6, paso + 1); if (v.arbol[tb] >= 1 && azar(v) < 0.5) cambiar(m, 'arbol', tb, 0, paso + 1); if (v.obra[tb] && v.obra[tb] !== OBRA.ruina && v.obra[tb] !== OBRA.centro && azar(v) < 0.3) { cambiar(m, 'obra', tb, OBRA.ruina, paso + 1); marcar(m, tb, 'escombros', 10, paso + 1); } if (azar(v) < 0.25) prender(m, tb, paso + 1, 2); }
          // El obús revienta en una zona: hiere a los enemigos de alrededor del blanco.
          if (a.veh && VEHICULOS[a.veh].area) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const otros = guerreros.get((blanco.y + dy) * v.tw + blanco.x + dx);
            for (const b of otros || []) if (enemigo(b) && azar(v) < 0.6 && golpear(v, null, b, Math.round(danoContra(v, a, b, true) * 0.5), paso + 0.5, blanco.x, blanco.y)) { muertos.add(b); v.muertos.push([b.x, b.y, b.c, 'obus', paso + 0.5, b]); apuntarBaja(m, c.id, b); c.victorias = (c.victorias || 0) + 1; a.bajas = (a.bajas || 0) + 1; }
          }
          if (azar(v) < (a.veh ? 0.65 : 0.5) + (tieneR(a, 'sabio') ? 0.05 : 0)) {
            // La flecha llega al final del paso: el golpe se ve un poco después de soltarla.
            if (golpear(v, null, blanco, danoContra(v, a, blanco, true), paso + 0.5, a.x, a.y)) { muertos.add(blanco); v.muertos.push([blanco.x, blanco.y, blanco.c, 'flecha', paso + 0.5, blanco]); apuntarBaja(m, c.id, blanco); c.victorias = (c.victorias || 0) + 1; a.bajas = (a.bajas || 0) + 1; }
          }
          acc = ACC.luchar;
          // El tirador se para a disparar: deshace el paso de este turno si iba andando.
          if (a.e === IR) { a.x = a.r[a.r.length - 3]; a.y = a.r[a.r.length - 2]; }
        }
      }
      if (muertos.has(a)) return;
    }
    a.r.push(a.x, a.y, acc);
  }

  /*
   * EL EXTERMINIO (orden del jugador): los soldados de un reino con esa orden matan también a los civiles del
   * pueblo enemigo que tengan a mano y van a buscar a los que vean cerca. Con la guerra terminada, se acaba.
   */
  function exterminio(m, paso, muertos) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      const p = c.plan; if (!p || p.exterminio == null) continue;
      const o = S().civ(m, p.exterminio);
      if (!o || !o.viva || !S().enGuerra(c, o)) {
        if (o && !o.viva) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '☠ No queda nadie de ' + o.nombre });
        if (o && o.viva) o.exterminadoPor = null;
        p.exterminio = null; continue;
      }
      const victimas = new Map();
      for (const b of v.aldeanos) if (b.c === o.id && b.o !== GUERRERO && !muertos.has(b)) { const t = b.y * v.tw + b.x; (victimas.get(t) || victimas.set(t, []).get(t)).push(b); }
      if (!victimas.size) continue;
      for (const a of v.aldeanos) {
        if (a.c !== c.id || a.o !== GUERRERO || muertos.has(a)) continue;
        const alcance = a.tirador && c.era >= 5 ? 3 : 1;
        let b = null;
        for (let dy = -alcance; dy <= alcance && !b; dy++) for (let dx = -alcance; dx <= alcance && !b; dx++) {
          const l = victimas.get((a.y + dy) * v.tw + a.x + dx); b = l && l.find(x => !muertos.has(x));
        }
        if (b) {
          if (azar(v) < 0.8) { muertos.add(b); v.muertos.push([b.x, b.y, b.c, 'batalla', paso, b]); c.exterminados = (c.exterminados || 0) + 1; if (alcance > 1) v.disparos.push([a.x, a.y, b.x, b.y, paso, 1, a.id]); }
        } else if ((paso === 1 || paso === 5) && a.e !== IR) {
          // Va a por el civil más cercano que tenga a la vista.
          let mejor = null, dm = 14;
          for (const [t, l] of victimas) { if (!l.length) continue; const d = Math.abs(t % v.tw - a.x) + Math.abs((t / v.tw | 0) - a.y); if (d < dm) { dm = d; mejor = t; } }
          if (mejor != null) ir(a, mejor, v.tw, IR);
        }
      }
    }
  }

  function ir(a, t, tw, estado) { a.tx = t % tw; a.ty = t / tw | 0; a.e = estado; a.q = 0; }
  function pasear(m, a, ter, c) {
    const v = m.vida, base = centro(m, a.h);
    // En el rato libre se va a la plaza pública o al parque, si hay uno cerca: allí se charla y juegan los niños.
    const ocio = v.ocio && v.ocio[a.c];
    if (ocio && ocio.length && azar(v) < 0.55) {
      const aqui = a.y * v.tw + a.x, t = ocio.reduce((b, x) => (dist(m, aqui, x) < dist(m, aqui, b) ? x : b), ocio[0]);
      if (dist(m, aqui, t) <= 14) {
        const u = t + [1, -1, v.tw, -v.tw, 0][Math.floor(azar(v) * 5)];
        if (u >= 0 && u < ter.length && andable(ter[u])) { ir(a, u, v.tw, IR); a.paseo = 2; return; }
      }
    }
    for (let k = 0; k < 6; k++) {
      const t = base + Math.round((azar(v) - 0.5) * 6) + Math.round((azar(v) - 0.5) * 6) * v.tw;
      if (t >= 0 && t < ter.length && andable(ter[t]) && dist(m, t, base) <= 4) { ir(a, t, v.tw, IR); a.paseo = 1; return; }
    }
    a.e = ESPERAR; a.t = 2;
  }
  function cercano(m, a, lista, reservadas, max) {
    const v = m.vida, aqui = a.y * v.tw + a.x;
    let mejor = -1, md = max;
    const n = Math.min(14, lista.length);
    for (let k = 0; k < n; k++) {
      const t = lista[Math.floor(azar(v) * lista.length)];
      if (reservadas.has(t)) continue;
      const d = dist(m, aqui, t);
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Lo más cercano a la aldea del aldeano que cumpla una condición: busca región a región, en anillos.
  function cercaDeCasa(m, a, c, rec, sirve, maxAnillo, clave) {
    const k = clave ? clave + ':' + a.h : null;
    if (k && memo.get(k) === -1) return -1;
    const r0 = cercaDeCasa2(m, a, c, rec, sirve, maxAnillo);
    if (k && r0 < 0) memo.set(k, -1);
    return r0;
  }
  function cercaDeCasa2(m, a, c, rec, sirve, maxAnillo) {
    const v = m.vida, aqui = a.y * v.tw + a.x, [hx, hy] = [a.h % m.W, Math.floor(a.h / m.W)];
    for (let anillo = 0; anillo <= maxAnillo; anillo++) {
      let mejor = -1, md = 1e9;
      for (let ry = hy - anillo; ry <= hy + anillo; ry++) for (let rx = hx - anillo; rx <= hx + anillo; rx++) {
        if (Math.max(Math.abs(rx - hx), Math.abs(ry - hy)) !== anillo || rx < 0 || ry < 0 || rx >= m.W || ry >= m.H) continue;
        const r = ry * m.W + rx, d0 = m.dueno[r];
        if (d0 >= 0 && d0 !== c.id) continue;
        for (const t of parcelas(m, r)) {
          if (!sirve(t) || rec.reservadas.has(t)) continue;
          const d = dist(m, aqui, t);
          if (d < md) { md = d; mejor = t; }
        }
      }
      if (mejor >= 0) return mejor;
    }
    return -1;
  }

  function elegirTarea(m, a, c, rec, ter) {
    const v = m.vida;
    if (a.dormir) { if (a.x === a.casa % v.tw && a.y === (a.casa / v.tw | 0)) { a.e = ESPERAR; a.t = 99; a.enCasa = 1; } else ir(a, a.casa, v.tw, IR); return; }
    if (esNino(a)) { pasear(m, a, ter, c); return; }
    if (a.colono != null) { ir(a, centro(m, a.colono), v.tw, IR); a.viajeColono = 1; return; }
    a.paseo = 0;
    if (a.k) { ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    let t = -1;
    if (a.o === LENADOR && c.madera < (60 + 20 * c.era) * prio(c, 'madera') * 1.5) t = cercaDeCasa(m, a, c, rec, x => v.arbol[x] >= 2, 3, 'arbol');
    // El leñador también planta: si no queda bosque que talar cerca, o si el bosque escasea (con semillas).
    const reforesta = c.plan && c.plan.reforestar > m.turno;
    if (a.o === LENADOR && (c.semillas || 0) >= 1 && (t < 0 || (reforesta && azar(v) < 0.75) || ((c.arboles || 0) < 30 && azar(v) < 0.3))) {
      const p = libre(m, a, c, rec, ter, BOSQUE_PLANTABLE, x => !enCasco(m, x) && !calleDelPlan(m, x) && !(v.plan && v.plan[x] === 2) && !v.cultivo[x]);
      if (p >= 0) { t = p; a.plantar = 1; }
    }
    else if (a.o === MINERO) {
      // Con la Edad del Bronce, los mineros buscan vetas de metal para la armería; si no, piedra.
      const vendeMetal = pausada(m) && c.cartera && (c.cartera.metal || c.cartera.armas);
      const faltaMetal = c.era >= 1 && ((c.metal || 0) < 8 + 4 * c.era || (vendeMetal && (c.metal || 0) < 60) || (prio(c, 'metal') > 1 && (c.metal || 0) < 150));
      a.buscaMetal = 0;
      // Si el jugador pide piedra (o un edificio que la necesita), las vetas pasan a segundo plano.
      const quierePiedra = (prio(c, 'piedra') > 1 && prio(c, 'piedra') >= prio(c, 'metal')) || (c.plan && c.plan.obra && (COSTES[OBRA[c.plan.obra]] || [0, 0])[1] > c.piedra);
      // En la era industrial, el carbón: primero las vetas negras, y si no, una mina de carbón en la montaña.
      const vendeCarbon = pausada(m) && c.cartera && c.cartera.carbon;
      const faltaCarbon = c.era >= 6 && ((c.carbon || 0) < objetivo(c, 'carbon') || (vendeCarbon && (c.carbon || 0) < 80) || (prio(c, 'carbon') > 1 && (c.carbon || 0) < 150));
      a.buscaCarbon = 0;
      if (faltaCarbon && azar(v) < (quierePiedra ? 0.25 : 0.55)) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && v.mena[x] === 3, 5, 'carbon');
      if (t < 0 && faltaCarbon && pausada(m) && azar(v) < 0.5) { t = cercaDeCasa(m, a, c, rec, x => ter[x] === 'montana' && !v.obra[x] && !v.arbol[x] && !v.roca[x], 5, 'mina'); if (t >= 0) { a.cantera = 1; a.buscaCarbon = 1; } }
      if (t < 0 && faltaMetal && azar(v) < (quierePiedra ? 0.2 : 0.8)) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && (v.mena[x] === 1 || v.mena[x] === 2), 4, 'mena');
      const faltaPiedra = c.piedra < (30 + 10 * c.era) * Math.max(0.5, prio(c, 'piedra'));
      if (!a.buscaCarbon) a.cantera = 0;
      // Agotadas las vetas sueltas, una mina en la montaña sigue dando metal a quien lo necesita o lo vende.
      if (t < 0 && faltaMetal && pausada(m) && azar(v) < (quierePiedra ? 0.3 : 0.85)) { t = cercaDeCasa(m, a, c, rec, x => ter[x] === 'montana' && !v.obra[x] && !v.arbol[x] && !v.roca[x], 5, 'mina'); if (t >= 0) { a.cantera = 1; a.buscaMetal = 1; } }
      if (t < 0 && faltaPiedra) t = cercaDeCasa(m, a, c, rec, x => v.roca[x] > 0 && ter[x] !== 'agua', 3, 'roca');
      // Sin vetas ni piedras sueltas cerca (o al azar, para no depender solo de ellas), a la mina: nunca se agota.
      a.enMina = 0;
      if ((c.minasT || []).length && (t < 0 || azar(v) < 0.25) && (faltaPiedra || faltaMetal || faltaCarbon)) {
        const aqui = a.y * v.tw + a.x, mt = c.minasT.slice().sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0];
        if (mt != null) { t = mt; a.enMina = 1; a.cantera = 0; a.buscaCarbon = 0; a.mineQuiere = faltaCarbon ? 'carbon' : faltaMetal ? 'metal' : 'piedra'; }
      }
      // Sin piedras sueltas cerca, se abre una cantera en la montaña o la colina: más lejos, pero no se acaba.
      if (t < 0 && (faltaPiedra || faltaMetal)) { t = cercaDeCasa(m, a, c, rec, x => (ter[x] === 'montana' || ter[x] === 'colina') && !v.obra[x] && !v.arbol[x] && !v.roca[x], 3, 'cantera'); if (t >= 0) a.cantera = 1; }
    }
    else if (a.o === GRANJERO) {
      a.siega = 0;
      // Primero se siega lo que está maduro; luego se aran campos nuevos si hacen falta.
      const km = 'mad:' + a.h;
      if (!memo.has(km)) memo.set(km, [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r)).filter(x => v.obra[x] === OBRA.campo));
      const maduros = memo.get(km).filter(x => v.cultivo[x] >= 3 && v.obra[x] === OBRA.campo && !rec.reservadas.has(x));
      if (maduros.length) { t = maduros[Math.floor(azar(v) * maduros.length)]; a.siega = 1; }
      else if (c.campos < metaCampos(c) && memo.get('campo:' + a.h) !== -1) { t = libre(m, a, c, rec, ter, CULTIVABLE, junto => !enCasco(m, junto) && molinoCerca(m, c, null, junto)); if (t < 0) { memo.set('campo:' + a.h, -1); c.sinCampo = m.turno; } }
      // Sin campo que segar ni que arar, el granjero hace de pastor: va a ordeñar o esquilar una res del pueblo.
      a.pastor = null;
      if (t < 0) {
        const aqui = a.y * v.tw + a.x;
        let mejor = null, md = 30;
        for (const b of rebanosDe(v, c.id)) {
          if (b.atendido === m.turno) continue;
          const d = dist(m, aqui, b.y * v.tw + b.x);
          if (d < md) { md = d; mejor = b; }
        }
        if (mejor) { mejor.atendido = m.turno; a.pastor = mejor.id; t = mejor.y * v.tw + mejor.x; }
      }
      // Ni campo ni rebaño: a cazar ciervos al bosque o a pescar desde la orilla.
      a.caza = null;
      if (t < 0) {
        const aqui = a.y * v.tw + a.x;
        let mejor = null, md = 26, donde = -1;
        for (const b of salvajes(v)) {
          if (b.atendido === m.turno || b.muerta) continue;
          const bt = b.y * v.tw + b.x, d = dist(m, aqui, bt);
          if (d >= md) continue;
          let destino = bt;
          if (b.tipo === 'pez') { destino = -1; for (const dd of [1, -1, v.tw, -v.tw, 2, -2, 2 * v.tw, -2 * v.tw]) { const n = bt + dd; if (n >= 0 && n < ter.length && andable(ter[n])) { destino = n; break; } } }
          if (destino < 0) continue;
          md = d; mejor = b; donde = destino;
        }
        if (mejor) { mejor.atendido = m.turno; a.caza = mejor.id; t = donde; }
      }
    }
    else if (a.o === CONSTRUCTOR) {
      a.obraCamino = 0; a.edificio = 0;
      // Lo primero, las obras a medias del pueblo: se va a ayudar a la más cercana.
      if (pausada(m) && v.andamios) {
        let mejor = -1, md = 40;
        for (const k of Object.keys(v.andamios)) { const an = v.andamios[k]; if (an.civ !== c.id) continue; const d = dist(m, a.y * v.tw + a.x, +k); if (d < md) { md = d; mejor = +k; } }
        if (mejor >= 0) { a.edificio = v.andamios[mejor].o; ir(a, mejor, v.tw, IR); rec.reservadas.add(mejor); return; }
      }
      // Las reformas: un edificio de una edad pasada se pone al día (tejado nuevo, piedra, ladrillo…), uno a uno.
      a.reforma = null;
      if (pausada(m) && v.edificios && azar(v) < 0.25 && c.madera >= 4 && c.piedra >= 2) {
        const zona = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
        let mejor = -1, md = 1e9;
        for (const r of zona) for (const u of parcelas(m, r)) {
          const rec = v.edificios[u];
          if (!rec || rec.ruina || v.obra[u] !== rec.tipo || fase(rec.era) >= fase(c.era) || SIN_REFORMA.has(rec.tipo)) continue;
          if (rec.reformando > m.turno - 3 || rec.turno > m.turno - 4) continue;
          const d = dist(m, a.y * v.tw + a.x, u) + rec.era * 3;
          if (d < md) { md = d; mejor = u; }
        }
        if (mejor >= 0 && md < 60) { v.edificios[mejor].reformando = m.turno; a.reforma = mejor; ir(a, mejor, v.tw, IR); rec.reservadas.add(mejor); return; }
      }
      // Después, lo que el arquitecto (el jugador) dejó marcado en el mapa, por orden, si hay con qué pagarlo.
      const encargos = c.plan && c.plan.encargos;
      if (encargos && encargos.length) {
        for (let i = 0; i < encargos.length; i++) {
          const e = encargos[i];
          const no = puedeColocar(m, c, e.t, e.clave, true);
          // Si lo que falta es tamaño o época, el encargo espera; si la parcela ya no vale, se olvida.
          if (no) { if (!/hace falta ser|llega con/.test(no)) encargos.splice(i--, 1); continue; }
          if (rec.reservadas.has(e.t)) continue;
          const coste = COSTES[e.o] || [0, 0, 0];
          if (c.madera < coste[0] || c.piedra < coste[1] || (c.oro || 0) < (coste[2] || 0)) { const pr = c.plan.prioridad; if (pr) { if (c.madera < coste[0]) pr.madera = Math.max(pr.madera || 1, 1.5); if (c.piedra < coste[1]) pr.piedra = Math.max(pr.piedra || 1, 1.5); } continue; }
          a.edificio = e.o; ir(a, e.t, v.tw, IR); rec.reservadas.add(e.t); return;
        }
      }
      // Los caminos pendientes se empiedran cuando las casas no corren prisa (o una de cada dos veces).
      const pend = (v.pendientes && v.pendientes[c.id]) || [];
      if (pend.length && (!faltanCamas(c) || azar(v) < 0.4)) {
        const aqui = a.y * v.tw + a.x;
        // Se empiedra de dentro afuera: el tramo sin hacer más cercano, aunque la carretera vaya muy lejos.
        let md = 160;
        for (const x of pend) { if (rec.reservadas.has(x) || v.camino[x]) continue; const d = dist(m, aqui, x); if (d < md) { md = d; t = x; } }
        if (t >= 0) a.obraCamino = 1;
      }
      if (t < 0 && (azar(v) < 0.6 || !molinoCerca(m, c, a.h))) { const ed = edificioPendiente(m, a, c, ter); if (ed) { t = ed[0]; a.edificio = ed[1]; } }
      const reserva = c.plan && c.plan.obra ? (COSTES[OBRA[c.plan.obra]] || [0])[0] : 0; // la madera del encargo del jugador no se gasta en casas
      if (t < 0 && faltanCamas(c) && c.madera >= 2 + reserva && memo.get('casa:' + a.h) !== -1) { t = casaNueva(m, a, c, rec, ter); if (t < 0) memo.set('casa:' + a.h, -1); }
    }
    else if (a.o === COMERCIANTE) {
      // Elige una ruta abierta de su pueblo y sale desde su extremo: la capital propia en las rutas entre reinos.
      const rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru));
      if (rutas.length) {
        const ru = rutas[Math.floor(azar(v) * rutas.length)], aqui = a.y * v.tw + a.x;
        const desdeA = ru.tipo === 'externa' ? ru.a === c.id : dist(m, aqui, ru.tiles[0]) <= dist(m, aqui, ru.tiles[ru.tiles.length - 1]);
        a.ruta = ru.id; a.dir = desdeA ? 1 : -1; a.i = desdeA ? 0 : ru.tiles.length - 1; a.vuelta = 0; a.viaje = 1;
        t = ru.tiles[a.i];
        if (pausada(m) && ru.tipo === 'externa' && !a.carga) { const o = S().civ(m, ru.a === c.id ? ru.b : ru.a); if (o && o.viva) cargar(m, a, c, o); }
      }
    }
    else if (a.o === ERUDITO) {
      // Al templo (si hay) o a la plaza, a estudiar, enseñar, rezar u observar el cielo.
      // Primero la casa del saber; si no hay, el templo; si no, la plaza.
      let sitios = [], donde = 0;
      for (const [obra, nivel] of [[OBRA.saber, 3], [OBRA.templo, 2]]) {
        for (const r of [a.h, c.capital, ...S().vecinos(a.h)]) for (const x of parcelas(m, r)) if (v.obra[x] === obra && m.dueno[region(m, x)] === c.id) sitios.push(x);
        if (sitios.length) { donde = nivel; break; }
      }
      const base = sitios.length ? sitios[a.id % sitios.length] : centro(m, c.capital);
      const dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 2) + 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      a.estudio = donde || 1;
    }
    else if (a.o === GUERRERO && a.fijo && a.fijo.guardia != null) {
      // Un escuadrón con misión: monta guardia en su plaza (o marcha sobre la plaza enemiga que le mandaron).
      const base = centro(m, a.fijo.guardia), dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 3) - 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 2; return; }
    }
    else if (a.o === GUERRERO && v.ejercitos[c.id]) {
      // En formación detrás del capitán: primero al punto de reunión, luego a por el objetivo.
      const e = v.ejercitos[c.id], base = centro(m, e.defiende != null ? e.defiende : e.fase === 'reunion' ? e.reunion : e.obj);
      const dx = (a.id % 3) - 1, dy = (Math.floor(a.id / 3) % 3) - 1;
      t = base + dx + dy * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = base;
      if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 2; return; }
    }
    else if (a.o === GUERRERO && c.era >= 8 && (c.trincheraPlan || []).length && (a.id % 2 === 0 || c.guerras.length)) {
      // En la Segunda Guerra Mundial: cavar la trinchera (y ponerle alambre); en guerra, ocuparla y esperar.
      v.trinchera = v.trinchera || new Array(v.tw * v.th).fill(0);
      const aqui = a.y * v.tw + a.x, plan = c.trincheraPlan;
      const pendiente = plan.filter(x => (v.trinchera[x] || 0) < 2 && !rec.reservadas.has(x)).sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0];
      const ocupar = c.guerras.length ? plan.filter(x => v.trinchera[x] && !rec.reservadas.has(x)).sort((p, q) => dist(m, p, aqui) - dist(m, q, aqui))[0] : null;
      if (ocupar != null && (a.id % 3 !== 0 || pendiente == null)) {
        if (aqui === ocupar) { a.e = ESPERAR; a.t = 3; return; }
        t = ocupar; a.cavar = 0;
      } else if (pendiente != null) { t = pendiente; a.cavar = 1; }
    }
    else if (a.o === GUERRERO && !c.guerras.length && (c.aduanas || []).length && a.id % 3 === 0) {
      // En paz, uno de cada tres soldados hace la guardia en un puesto fronterizo: de pie junto a la barrera.
      const pf = c.aduanas[(a.id / 3 | 0) % c.aduanas.length], lado = (a.id / 3 | 0) % 2 ? 1 : -1;
      t = pf + lado;
      if (t < 0 || t >= ter.length || !andable(ter[t]) || v.obra[t]) t = pf + lado * v.tw;
      if (t < 0 || t >= ter.length || !andable(ter[t])) t = -1;
      else if (a.x === t % v.tw && a.y === (t / v.tw | 0)) { a.e = ESPERAR; a.t = 3; a.guardiaEn = pf; return; }
    }
    else if (a.o === GUERRERO && !c.guerras.length) {
      // En paz, los guerreros salen a cazar los lobos que rondan su tierra.
      let md = 22;
      for (const b of v.animales) { if (b.tipo !== 'lobo') continue; const d = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); if (d < md && m.dueno[region(m, b.y * v.tw + b.x)] === c.id || d < 8) { md = d; t = b.y * v.tw + b.x; } }
    }
    if (t >= 0) { ir(a, t, v.tw, IR); rec.reservadas.add(t); return; }
    // Sin tarea: los granjeros cuidan un campo, los demás pasean por su aldea.
    if (a.o === GRANJERO && c.campos > 0 && azar(v) < 0.7) {
      const campos = parcelas(m, a.h).filter(x => v.obra[x] === OBRA.campo);
      if (campos.length) { ir(a, campos[Math.floor(azar(v) * campos.length)], v.tw, IR); a.paseo = 2; return; }
    }
    pasear(m, a, ter, c);
  }
  const metaCampos = c => Math.round((4 + (c.habitantes != null ? c.habitantes : c.pob / escala(c)) * 0.55) * (0.6 + 0.4 * prio(c, 'comida')));
  // Hacen falta casas cuando no quedan camas para los que van a nacer (como en WorldBox: se construye por necesidad).
  const faltanCamas = c => (c.sinCama || 0) > 0 || !!(c.plan && (c.plan.temporales || []).some(t => t.hasta && t.hasta.cosa === 'casas')) || (c.camas || 0) - (c.aldeanos || 0) < 2 + Math.round(prio(c, 'casas') * 1.5);
  // Una casa nueva va siempre pegada a lo que ya hay (casas, plaza, molino, caminos), lo más cerca posible de la plaza:
  // así el pueblo crece como una mancha alrededor de su centro.
  const PEGA = new Set([OBRA.campamento, OBRA.saber, OBRA.casa, OBRA.centro, OBRA.ayuntamiento, OBRA.molino, OBRA.templo, OBRA.torre, OBRA.cuartel, OBRA.arqueria, OBRA.castillo]);
  function casaNueva(m, a, c, rec, ter) {
    const v = m.vida, base = centro(m, a.h), regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 1e9;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      const plano = pausada(m) && v.plan && v.centros && v.centros.length;
      const huertaVieja = plano && v.obra[t] === OBRA.campo && v.plan[t] === 2;
      if ((v.obra[t] && !huertaVieja) || v.roca[t] || v.camino[t] || ocupada(v, t) || v.arbol[t] >= 2 || !CONSTRUIBLE.has(ter[t]) || rec.reservadas.has(t)) continue;
      if (plano && v.plan[t] !== 2) continue; // solo en los solares del casco
      const x = t % v.tw;
      let junto = false;
      if (plano) for (const d of [-1, 1, -v.tw, v.tw]) if (v.plan[t + d] === 1) { junto = true; break; }
      for (const d of [-1, 1, -v.tw, v.tw, -v.tw - 1, -v.tw + 1, v.tw - 1, v.tw + 1]) { const n = t + d; if (n < 0 || n >= v.obra.length || Math.abs((n % v.tw) - x) > 1) continue; if (PEGA.has(v.obra[n]) || v.camino[n]) { junto = true; break; } }
      if (!junto) continue;
      // Distancia redonda (no en rombo), un sesgo fijo por parcela y ganas de arrimarse a otras casas:
      // el pueblo crece como una mancha irregular, con callejas y huecos, no en filas.
      const ty = t / v.tw | 0, bx = base % v.tw, by = base / v.tw | 0;
      let vecinas = 0;
      for (const d of [-1, 1, -v.tw, v.tw]) if (v.obra[t + d] === OBRA.casa) vecinas++;
      const sesgo = ((Math.imul(t, 2654435761) >>> 0) % 1000) / 1000;
      const dd = plano
        // Con plan: lo más cerca de la plaza, junto a la calle, rellenando manzanas (y la huerta vieja, solo si no hay otra cosa).
        ? Math.hypot(x - bx, ty - by) + (huertaVieja ? 2.5 : 0) - Math.min(2, vecinas) * 0.6 + azar(v) * 0.8
        : Math.hypot(x - bx, ty - by) * (0.75 + sesgo * 0.5) + [0, -0.4, 0.8, 2.5, 4][vecinas] + azar(v) * 3;
      if (dd < md) { md = dd; mejor = t; }
    }
    return mejor;
  }

  // Una parcela libre cerca de casa: primero en su región, luego en las regiones propias de alrededor.
  // ¿Hay un molino cerca? (de la región de la aldea, o a 3 parcelas de una parcela concreta)
  function molinoMasCercano(m, t) {
    const v = m.vida, tx = t % v.tw, ty = t / v.tw | 0;
    let mejor = null, md = 99;
    const R = rangoMolino(m);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const n = (ty + dy) * v.tw + tx + dx, d = Math.abs(dx) + Math.abs(dy);
      if (d <= R && n >= 0 && n < v.obra.length && v.obra[n] === OBRA.molino && d < md) { md = d; mejor = n; }
    }
    return mejor;
  }
  function molinoCerca(m, c, r, t) {
    const v = m.vida;
    if (t != null) {
      const tx = t % v.tw, ty = t / v.tw | 0;
      const R = rangoMolino(m);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > R) continue;
        const n = (ty + dy) * v.tw + tx + dx;
        if (n >= 0 && n < v.obra.length && v.obra[n] === OBRA.molino) {
          // Cada molino muele lo de unos pocos campos: lleno, ya no deja arar más a su alrededor.
          if (pausada(m) && camposDeMolino(m, n) >= CAMPOS_POR_MOLINO) continue;
          return true;
        }
      }
      return false;
    }
    return [r, ...S().vecinos(r).filter(w => m.dueno[w] === c.id)].some(z => parcelas(m, z).some(x => v.obra[x] === OBRA.molino));
  }
  function camposDeMolino(m, t) {
    const v = m.vida, tx = t % v.tw, ty = t / v.tw | 0, R = rangoMolino(m);
    let n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { if (Math.abs(dx) + Math.abs(dy) > R) continue; const u = (ty + dy) * v.tw + tx + dx; if (u >= 0 && u < v.obra.length && v.obra[u] === OBRA.campo) n++; }
    return n;
  }
  /*
   * EL PLAN URBANO (partidas pausadas): cada pueblo y cada ciudad crece con orden alrededor de su plaza.
   *  · Calles en cuadrícula cada tres parcelas, alineadas con la plaza: entre ellas quedan manzanas de 2×2.
   *  · Dentro del casco (más grande cuanto más grande es el pueblo) van las casas y los edificios, nunca en
   *    mitad de una calle; las calles se empiedran a medida que tienen casas al lado.
   *  · Fuera del casco está la huerta: los campos solo se aran ahí, cerca de un molino, y cada molino da
   *    para unos diez campos; cuando hacen falta más, se levanta otro molino en el borde de la huerta.
   * v.plan marca cada parcela: 1 calle del plan, 2 solar del casco, 0 fuera.
   */
  const RADIO_CASCO = [3, 5, 6, 8, 10];
  function planUrbano(m) {
    const v = m.vida, tw = v.tw, th = v.th, plan = new Uint8Array(tw * th), centros = [];
    if (!pausada(m)) { v.plan = plan; v.centros = centros; return; }
    for (const c of S().vivas(m)) {
      const sitios = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
      for (const r of sitios) {
        const rx = (r % m.W) * SUB, ry = (r / m.W | 0) * SUB, cx = rx + 1.5, cy = ry + 1.5;
        const ciudad = r === c.capital ? null : (m.ciudades || []).find(x => x.region === r);
        const campamento = ciudad && ciudad.fase && ciudad.fase !== 'aldea';
        const vecinos = ciudad ? v.aldeanos.filter(a => a.c === c.id && a.h === r).length : 0;
        const R = campamento ? 2 : RADIO_CASCO[Math.min(4, r === c.capital ? c.nivel || 0 : M.nivelDe(vecinos))];
        centros.push({ civ: c.id, r, cx, cy, R, campamento });
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(th - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(tw - 1, Math.ceil(cx + R)); x++) {
          const t = y * tw + x;
          if (m.dueno[region(m, t)] !== c.id) continue;
          const calle = !campamento && ((((x - rx) % 3) + 3) % 3 === 0 || (((y - ry) % 3) + 3) % 3 === 0);
          // Donde ya hay un edificio (del campamento o de antes del plan), la calle se desvía: queda como solar.
          const ocupado = v.obra[t] && v.obra[t] !== OBRA.campo && v.obra[t] !== OBRA.ruina;
          plan[t] = Math.max(plan[t], calle && !ocupado ? 1 : 2);
        }
      }
    }
    v.plan = plan; v.centros = centros;
  }
  const enCasco = (m, t) => m.vida.plan && m.vida.plan[t] > 0;
  const calleDelPlan = (m, t) => m.vida.plan && m.vida.plan[t] === 1;
  function libre(m, a, c, rec, ter, sirve, filtro) {
    const v = m.vida, base = centro(m, a.h), desbrozar = pausada(m) && sirve === CULTIVABLE;
    const regiones = [a.h, ...S().vecinos(a.h).filter(r => m.dueno[r] === c.id)];
    let mejor = -1, md = 99;
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.camino[t] || ocupada(v, t) || (v.arbol[t] >= 2 && !desbrozar) || !sirve.has(ter[t]) || rec.reservadas.has(t) || (filtro && !filtro(t))) continue;
      // Con plan, la huerta se abre junto a otros campos (en bloques ordenados) y, si hace falta, se desbroza.
      const d = dist(m, base, t) + azar(v) * 1.5 + (desbrozar ? (v.arbol[t] >= 2 ? 2 : 0) - [t - 1, t + 1, t - v.tw, t + v.tw].filter(n => v.obra[n] === OBRA.campo).length * 0.8 : 0);
      if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }

  // Un paso hacia el destino por tierra (o en barca desde el Renacimiento).
  const enAgua = (m, ter, t) => mojada(ter[t]) && !m.vida.camino[t];
  function andar(m, a, c, ter) {
    const v = m.vida;
    if (++a.q > (a.colono != null ? 400 : 40)) return false;
    // Nadando se avanza a medio paso.
    if (enAgua(m, ter, a.y * v.tw + a.x) && !a.porCamino) { a.brazada = !a.brazada; if (a.brazada) return true; }
    const opciones = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const ahora = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y);
    let mejor = null, mv = 1e9;
    for (const [dx, dy] of opciones) {
      const x = a.x + dx, y = a.y + dy;
      if (x < 0 || y < 0 || x >= v.tw || y >= v.th) continue;
      const n = y * v.tw + x;
      // El agua solo se elige si no hay otro camino: cuesta más, y el mar abierto mucho más.
      const coste = enAgua(m, ter, n) ? (ter[n] === 'agua' ? 4 : 2) : 0;
      const d = Math.abs(a.tx - x) + Math.abs(a.ty - y) + coste + azar(v) * 0.9;
      if (d < mv) { mv = d; mejor = [x, y]; }
    }
    if (!mejor) return false;
    // Atascado detrás de agua: un paso a un lado para rodearla.
    if (mv >= ahora + 0.9 && a.q > 20) return false;
    a.x = mejor[0]; a.y = mejor[1];
    // En el mar abierto uno se puede ahogar; en un río o en la orilla, casi nunca.
    const t = a.y * v.tw + a.x;
    if (enAgua(m, ter, t) && azar(v) < (ter[t] === 'agua' ? 0.06 : ter[t] === 'bajo' ? 0.01 : 0.003)) a.ahogado = 1;
    // Por un camino se va el doble de rápido.
    if (v.camino[t] && !a.porCamino && !a.ahogado && (a.tx !== a.x || a.ty !== a.y)) { a.porCamino = 1; andar(m, a, c, ter); a.porCamino = 0; }
    return true;
  }

  function llegar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    if (a.e === VOLVER) {
      // Descarga en la aldea: aquí entra la madera y la piedra en la economía del pueblo.
      const h = c.hecho = c.hecho || {};
      if (a.o === LENADOR) { c.madera += a.k; h.madera = (h.madera || 0) + a.k; }
      else if (a.kt === 3) { c.comida = (c.comida || 0) + a.k; h.comida = (h.comida || 0) + a.k; a.kt = 0; } // el trigo llega al molino (o a casa)
      else if (a.o === MINERO) { if (a.kt === 1) { c.metal = (c.metal || 0) + a.k; h.metal = (h.metal || 0) + a.k; } else if (a.kt === 2) { c.oro = (c.oro || 0) + a.k; c.riqueza += 6 * a.k; h.oro = (h.oro || 0) + a.k; } else if (a.kt === 4) { c.carbon = (c.carbon || 0) + a.k; h.carbon = (h.carbon || 0) + a.k; } else { c.piedra += a.k; c.riqueza += a.k * 0.3; h.piedra = (h.piedra || 0) + a.k; } a.kt = 0; }
      a.k = 0; a.e = ESPERAR; a.t = 1;
      return;
    }
    if (a.dormir) { a.e = ESPERAR; a.t = 99; a.enCasa = 1; return; }
    if (a.viajeColono) { a.viajeColono = 0; if (a.colono != null) fundar(m, a, c); a.e = ESPERAR; a.t = 2; return; }
    if (a.o === COMERCIANTE && a.viaje) { a.viaje = 0; a.e = VIAJAR; a.pasados = []; return; }
    if (a.paseo) { a.e = ESPERAR; a.t = a.paseo === 2 ? 3 : 1 + Math.floor(azar(v) * 2); a.paseo = 0; return; }
    if (a.o === ERUDITO) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === LENADOR) { if (a.plantar && !v.arbol[t] && !v.obra[t]) { a.e = TRABAJAR; a.t = 2; } else if (v.arbol[t] >= 2) { a.e = TRABAJAR; a.t = 2; } else { a.e = LIBRE; a.plantar = 0; } }
    else if (a.o === MINERO) { if (a.enMina && v.obra[t] === OBRA.mina) { a.e = TRABAJAR; a.t = 6; } else if (v.roca[t] > 0) { a.e = TRABAJAR; a.t = 3; } else if (a.cantera) { a.e = TRABAJAR; a.t = 4; } else a.e = LIBRE; }
    else if (a.o === GRANJERO && (a.pastor != null || a.caza != null)) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === GRANJERO) { if (a.siega && v.obra[t] === OBRA.campo && v.cultivo[t] >= 3) { a.e = TRABAJAR; a.t = 2; } else if (!a.siega && !v.obra[t] && v.arbol[t] < 2) { a.e = TRABAJAR; a.t = 3; } else if (!a.siega && !v.obra[t] && pausada(m) && !a.pastor && !a.caza) { a.e = TRABAJAR; a.t = 5; /* desbrozar el bosque para la huerta lleva más */ } else { a.e = LIBRE; a.siega = 0; } }
    else if (a.o === CONSTRUCTOR && a.edificio) {
      const an = v.andamios && v.andamios[t];
      if (an && an.civ === c.id) { a.e = TRABAJAR; a.t = 3; }
      else if (!v.obra[t] && !pausada(m)) { colocarObra(m, t, a.edificio, paso); if (a.edificio === OBRA.casa) c.casas++; if (c.plan && c.plan.encargos) c.plan.encargos = c.plan.encargos.filter(e => e.t !== t); a.edificio = 0; }
      else if ((!v.obra[t] || (v.obra[t] === OBRA.campo && PUBLICAS.has(a.edificio))) && pagarObra(c, a.edificio)) {
        if (v.obra[t] === OBRA.campo) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); }
        // Se paga al empezar y se monta el andamio; la obra avanza jornada a jornada.
        cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso);
        (v.andamios = v.andamios || {})[t] = { o: a.edificio, falta: TRABAJO[a.edificio] || 4, total: TRABAJO[a.edificio] || 4, civ: c.id };
        if (c.plan && c.plan.encargos) c.plan.encargos = c.plan.encargos.filter(e => e.t !== t);
        a.e = TRABAJAR; a.t = 3;
      } else a.edificio = 0;
    }
    else if (a.o === CONSTRUCTOR && a.reforma === t && v.edificios && v.edificios[t]) { a.e = TRABAJAR; a.t = 4; }
    else if (a.o === CONSTRUCTOR && a.obraCamino) { if (!v.camino[t] && !v.obra[t]) { a.e = TRABAJAR; a.t = 1; } else { a.e = LIBRE; a.obraCamino = 0; } }
    else if (a.o === CONSTRUCTOR) {
      const piedra = c.era >= 2 && c.piedra >= 1;
      if (v.obra[t] === OBRA.campo && pausada(m) && v.plan && v.plan[t] === 2) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); c.campos = Math.max(0, (c.campos || 0) - 1); }
      if (!v.obra[t] && v.arbol[t] < 2 && c.madera >= (piedra ? 2 : 3)) { c.madera -= piedra ? 2 : 3; if (piedra) c.piedra -= 1; a.e = TRABAJAR; a.t = Math.max(2, Math.round(4 * (1 - M.tec(c, 'obra')))); } else a.e = LIBRE;
    } else if (a.o === GUERRERO && a.cavar && m.dueno[region(m, t)] === c.id) { a.e = TRABAJAR; a.t = 3; }
    else if (a.o === GUERRERO) {
      // En tierra enemiga sin nadie que la defienda: saquea la aldea y empuja la frontera.
      const r = region(m, t), o = S().civ(m, m.dueno[r]);
      if (o && c.guerras.some(g => g.con === o.id)) { a.e = TRABAJAR; a.t = 2; } else a.e = LIBRE;
    }
  }

  function terminar(m, a, c, rec, ter, paso) {
    const v = m.vida, t = a.ty * v.tw + a.tx;
    // El erudito termina su jornada de estudio: el saber entra en el pueblo (más en el templo, y más los sabios).
    if (a.o === ERUDITO) {
      const k = 1.05 * (1 + 0.15 * c.era) * (a.estudio === 3 ? 1.6 : a.estudio === 2 ? 1.25 : 1) * (tieneR(a, 'sabio') ? 1.5 : 1) * (tieneR(a, 'perezoso') ? 0.6 : 1);
      c.saber = (c.saber || 0) + k; a.estudios = (a.estudios || 0) + 1;
      a.e = ESPERAR; a.t = 1; return;
    }
    if (a.o === LENADOR && a.plantar) {
      // Planta un retoño con una semilla: en unos años será un árbol que se podrá talar.
      a.plantar = 0;
      if (!v.arbol[t] && !v.obra[t] && !v.roca[t] && !v.camino[t] && (c.semillas || 0) >= 1) { c.semillas -= 1; cambiar(m, 'arbol', t, 1, paso); c.hecho = c.hecho || {}; c.hecho.plantados = (c.hecho.plantados || 0) + 1; }
      a.e = ESPERAR; a.t = 1; return;
    }
    if (a.o === LENADOR && v.arbol[t] >= 2) {
      c.hecho = c.hecho || {}; c.hecho.arboles = (c.hecho.arboles || 0) + 1; a.k = (v.arbol[t] === 3 ? 4 : 2) + M.tec(c, 'lena'); cambiar(m, 'arbol', t, 0, paso);
      // Al talar se recogen piñas y semillas; y si el bosque escasea, se replanta el tocón con una.
      if (azar(v) < 0.45) c.semillas = (c.semillas || 0) + 1;
      if ((c.arboles || 0) < 40 && (c.semillas || 0) >= 1 && azar(v) < 0.6) { c.semillas -= 1; cambiar(m, 'arbol', t, 1, Math.min(TICKS, paso + 0.5)); }
      ir(a, centro(m, a.h), v.tw, VOLVER); return;
    }
    // De la mina sale de todo, pero poco cada vez: piedra, metal (desde el Bronce), carbón (desde la industria) y algo de oro.
    if (a.o === MINERO && a.enMina && v.obra[t] === OBRA.mina) {
      a.enMina = 0; const q = azar(v), quiere = a.mineQuiere;
      if (q < 0.06 && c.era >= 1) { a.kt = 2; a.k = 1; }
      else if (quiere === 'carbon' && c.era >= 6 && q < 0.75) { a.kt = 4; a.k = 2 + Math.floor(M.tec(c, 'piedra') / 2); }
      else if ((quiere === 'metal' || q < 0.3) && c.era >= 1 && q < 0.8) { a.kt = 1; a.k = 1 + (azar(v) < 0.4 ? 1 : 0); }
      else { a.kt = 0; a.k = 2; }
      ir(a, centro(m, a.h), v.tw, VOLVER); return;
    }
    if (a.o === MINERO && a.cantera && !v.roca[t] && a.buscaCarbon) { a.cantera = 0; a.buscaCarbon = 0; a.k = 2; a.kt = azar(v) < 0.7 ? 4 : 0; if (a.kt === 4) { a.k = 2 + M.tec(c, 'piedra'); marcar(m, t, 'escombros', 1, paso); } ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === MINERO && a.cantera && !v.roca[t]) { a.cantera = 0; a.k = 2; a.kt = azar(v) < (ter[t] === 'montana' ? (a.buscaMetal ? 0.7 : 0.25) : a.buscaMetal ? 0.4 : 0) ? 1 : 0; if (a.kt === 1) { a.k = 2 + M.tec(c, 'piedra'); marcar(m, t, 'escombros', 1, paso); } a.buscaMetal = 0; ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === MINERO && v.roca[t] > 0) { a.k = (v.mena[t] === 3 ? 3 : v.mena[t] ? 1 : 2) + M.tec(c, 'piedra'); a.kt = v.mena[t] === 3 ? 4 : v.mena[t] || 0; cambiar(m, 'roca', t, v.roca[t] - 1, paso); if (!v.roca[t]) v.mena[t] = 0; ir(a, centro(m, a.h), v.tw, VOLVER); return; }
    if (a.o === GRANJERO && a.caza != null) {
      // El ciervo se caza (si sigue cerca); el pez se pesca y el banco sigue ahí casi siempre.
      const b = v.animales.find(x => x.id === a.caza), seca = c.efectos.some(e => e.sequia);
      a.caza = null;
      if (b && dist(m, t, b.y * v.tw + b.x) <= 4) {
        if (b.tipo === 'ciervo') {
          // Tres lanzadas (o tiros); si no cae, huye herido y otro día será.
          let muere = false;
          for (let q = 0; q < 3 && !muere; q++) if (azar(v) < 0.6) muere = golpear(v, a, b, Math.round((12 + c.era * 3) * (0.8 + azar(v) * 0.4) * (tieneR(a, 'fuerte') ? 1.2 : 1)), paso, a.x, a.y);
          if (muere) { v.animales = v.animales.filter(x => x !== b); v.muertos.push([b.x, b.y, null, 'animal', paso, b]); c.comida = (c.comida || 0) + 4 * (1 + M.tec(c, 'caza')); }
        }
        else { c.comida = (c.comida || 0) + (seca ? 0.6 : 1.2) * (1 + M.tec(c, 'caza')); if (azar(v) < 0.15) v.animales = v.animales.filter(x => x !== b); }
      }
      return;
    }
    if (a.o === GRANJERO && a.pastor != null) {
      // Leche, lana y queso de la res; si el granero está casi vacío y el rebaño es grande, se sacrifica una.
      const b = v.animales.find(x => x.id === a.pastor), hab = c.habitantes || 10;
      a.pastor = null;
      if (b && dist(m, t, b.y * v.tw + b.x) <= 4) {
        const rebano = v.animales.filter(x => x.c === c.id && x.tipo === b.tipo).length;
        if ((c.comida || 0) < hab * 0.2 && rebano > 3) { v.animales = v.animales.filter(x => x !== b); v.muertos.push([b.x, b.y, null, 'animal', paso, b]); c.comida = (c.comida || 0) + (b.tipo === 'vaca' ? 9 : 5); }
        else c.comida = (c.comida || 0) + (b.tipo === 'vaca' ? 1.5 : 0.8) * (c.efectos.some(e => e.sequia) ? 0.4 : 1);
      }
      return;
    }
    if (a.o === GRANJERO && a.siega && v.obra[t] === OBRA.campo) {
      // El trigo segado se lleva a hombros al molino más cercano (dentro de su alcance); solo allí se vuelve harina.
      cambiar(m, 'cultivo', t, 0, paso);
      if (pausada(m)) {
        const ter2 = terrenos(m), tipo = cultivoTipo(m, ter2, t), [com, oro] = RINDE[tipo], reg = regadio(m, ter2, t) ? (tipo === 'arroz' ? 1.2 : 0.7) : 0;
        const record = c.cosechaRecord && m.turno - c.cosechaRecord < 12 ? 1.5 : 1;
        a.k = (com + reg + M.tec(c, 'cosecha') + (v.estacion === 2 ? 1 : 0)) * record;
        if (oro) { c.oro = (c.oro || 0) + oro * record; c.ganado = c.ganado || {}; c.ganado.comida = (c.ganado.comida || 0) + oro * record; }
        c.cosechado = c.cosechado || {}; c.cosechado[tipo] = (c.cosechado[tipo] || 0) + a.k;
      } else a.k = 2 + M.tec(c, 'cosecha') + (v.estacion === 2 ? 1 : 0);
      a.kt = 3; a.siega = 0;
      ir(a, molinoMasCercano(m, t) ?? centro(m, a.h), v.tw, VOLVER);
      return;
    }
    else if (a.o === GRANJERO && !v.obra[t] && pausada(m) && (enCasco(m, t) || calleDelPlan(m, t) || !molinoCerca(m, c, null, t))) { /* ahí no se ara: es casco del pueblo o no hay molino cerca */ }
    else if (a.o === GRANJERO && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.campo, paso); cambiar(m, 'cultivo', t, 0, paso); c.campos++; c.hecho = c.hecho || {}; c.hecho.campos = (c.hecho.campos || 0) + 1; }
    else if (a.o === CONSTRUCTOR && a.obraCamino) {
      // Un tramo de camino: se quita el árbol o la roca; desde la Antigüedad se empiedra (cuesta un poco de piedra).
      if (!v.camino[t] && !v.obra[t]) { cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'roca', t, 0, paso); cambiar(m, 'camino', t, 1, paso); if (c.era >= 3 && c.piedra >= 0.25) c.piedra -= 0.25; }
      a.obraCamino = 0;
    }
    else if (a.o === CONSTRUCTOR && a.reforma === t && v.edificios && v.edificios[t]) {
      const rec = v.edificios[t];
      if (c.madera >= 4 && c.piedra >= 2 && fase(rec.era) < fase(c.era)) {
        c.madera -= 4; c.piedra -= 2;
        const antes = M.ERAS[rec.era].nombre;
        rec.era = c.era; rec.historia.push({ anio: m.anio, texto: 'reformado al estilo de ' + M.ERAS[c.era].con + ' por ' + a.nombre + ' (era de ' + antes + ')' });
        v.cambios.push([2, t, v.obra[t], v.obra[t], paso]); // para que se vuelva a dibujar con el estilo nuevo
      }
      a.reforma = null;
    }
    else if (a.o === CONSTRUCTOR && a.edificio && v.andamios && v.andamios[t]) {
      // Una jornada más en el andamio; cuando se acaba, queda el edificio.
      const an = v.andamios[t];
      apuntarObrero(m, t, a);
      an.falta -= 1 + M.tec(c, 'obra');
      if (an.falta <= 0) { colocarObra(m, t, an.o, paso); delete v.andamios[t]; if (an.o === OBRA.casa) { c.casas++; c.hecho = c.hecho || {}; c.hecho.casas = (c.hecho.casas || 0) + 1; } a.edificio = 0; }
      else { a.e = TRABAJAR; a.t = 3; return; }
    }
    else if (a.o === CONSTRUCTOR && !v.obra[t] && pausada(m)) {
      // La casa también lleva su andamio: la primera jornada levanta los muros; la segunda, el tejado.
      cambiar(m, 'arbol', t, 0, paso);
      (v.andamios = v.andamios || {})[t] = { o: OBRA.casa, falta: TRABAJO[OBRA.casa] - 1, total: TRABAJO[OBRA.casa], civ: c.id };
      a.edificio = OBRA.casa; a.e = TRABAJAR; a.t = 3; return;
    }
    else if (a.o === CONSTRUCTOR && !v.obra[t]) { apuntarObrero(m, t, a); cambiar(m, 'arbol', t, 0, paso); cambiar(m, 'obra', t, OBRA.casa, paso); c.casas++; c.hecho = c.hecho || {}; c.hecho.casas = (c.hecho.casas || 0) + 1; }
    else if (a.o === COMERCIANTE && a.comercio) {
      // Llega la carreta: se vende, se compra, y los dos lados ganan (más si el camino está terminado).
      const ru = v.rutas.find(x => x.id === a.ruta);
      if (ru && rutaActiva(m, ru)) {
        const hecho = ru.tiles.filter(x => v.camino[x]).length / ru.tiles.length, k = 0.6 + 0.6 * hecho;
        const oroRuta = (ru.tipo === 'interna' ? 0.5 : 1) * (1 + 0.15 * c.era) * k * (1 + M.tec(c, 'comercio')) * (pausada(m) && ru.tipo !== 'interna' ? 0.4 : 1);
        c.oro = (c.oro || 0) + oroRuta; c.comercioOro = (c.comercioOro || 0) + oroRuta;
        if (ru.tipo === 'interna') { c.riqueza += (2 + 0.6 * c.era) * k; c.estab = Math.min(100, c.estab + 0.3); }
        else {
          const o = S().civ(m, ru.a === c.id ? ru.b : ru.a);
          if (pausada(m) && o && o.viva) venderComprar(m, a, c, o);
          c.riqueza += (3 + 0.8 * c.era) * k; o.riqueza += (2 + 0.6 * o.era) * k;
          c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1);
          if (o.era > c.era) c.ciencia += 3; // las ideas viajan con las mercancías
        }
        c.comerciado = (c.comerciado || 0) + 1;
        a.vuelta = 1; a.dir = -a.dir; a.e = VIAJAR; a.comercio = 0; a.pasados = [];
        return;
      }
      a.comercio = 0;
    }
    else if (a.o === GUERRERO && a.cavar) {
      // Una jornada de pala: primero la zanja con sacos terreros; luego, si hay metal, el alambre de espino.
      a.cavar = 0;
      v.trinchera = v.trinchera || new Array(v.tw * v.th).fill(0);
      if (!v.trinchera[t] && !v.obra[t]) { v.trinchera[t] = 1; if (v.arbol[t]) cambiar(m, 'arbol', t, 0, paso); v.trincheraVer = (v.trincheraVer || 0) + 1; }
      else if (v.trinchera[t] === 1 && (c.metal || 0) >= 1) { c.metal -= 1; v.trinchera[t] = 2; v.trincheraVer = (v.trincheraVer || 0) + 1; }
    }
    else if (a.o === GUERRERO) {
      const o = S().civ(m, m.dueno[region(m, t)]);
      if (o && c.guerras.some(g => g.con === o.id)) {
        // Saquear la capital enemiga (un asedio) pesa más que una aldea de frontera.
        c.victorias = (c.victorias || 0) + (region(m, t) === o.capital ? 1.5 : 0.5);
        if (v.obra[t] === OBRA.casa && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.ruina, paso);
        if (v.obra[t] === OBRA.campo && azar(v) < 0.5) cambiar(m, 'obra', t, OBRA.nada, paso);
      }
    }
    a.e = LIBRE;
  }

  /*
   * CAMINOS Y RUTAS COMERCIALES. Cada ciudad se une a su capital por un camino trazado por el terreno más
   * fácil (evita el agua, las montañas y las casas, y aprovecha los caminos que ya hay); las capitales de
   * reinos vecinos que se llevan bien abren rutas entre sí; y cada ciudad tiene sus calles. Los constructores
   * empiedran los caminos parcela a parcela, y los comerciantes los recorren con su carreta.
   */
  /*
   * LAS VÍAS DEL TREN: una línea propia de estación a estación (o hasta la plaza del otro reino si no tiene),
   * aparte de los caminos: cruza las calles en pasos a nivel pero no va por encima de ellas, rodea los
   * edificios y prefiere el llano (los túneles y los puentes salen caros). Por ella circula un tren cada rato.
   * Nadie construye encima: si un edificio la corta, se vuelve a trazar.
   */
  const esVia = (v, t) => !!(v.via && v.via[t]);
  // Casillas que no se pueden usar para construir ni sembrar: la vía del tren y las trincheras.
  const ocupada = (v, t) => esVia(v, t) || !!(v.trinchera && v.trinchera[t]);
  const BOSQUE_PLANTABLE = new Set(['bosque', 'selva', 'taiga', 'sakura', 'llanura', 'colina', 'sabana', 'pantano', 'tundra', 'nieve']);
  function planificarVias(m, ter) {
    const v = m.vida, tw = v.tw;
    v.vias = v.vias || {};
    const estacionDe = c => { const cap = centro(m, c.capital); let mejor = null, md = 1e9; for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) if (v.obra[t] === OBRA.estacion) { const d = dist(m, t, cap); if (d < md) { md = d; mejor = t; } } return mejor; };
    const quedan = new Set();
    let nuevas = 0;
    for (const ru of v.rutas) {
      if (ru.tipo !== 'externa' || !rutaActiva(m, ru)) continue;
      const a = S().civ(m, ru.a), b = S().civ(m, ru.b);
      const ea = a && a.era >= 6 && a.estaciones > 0 ? estacionDe(a) : null, eb = b && b.era >= 6 && b.estaciones > 0 ? estacionDe(b) : null;
      if (ea == null && eb == null) continue;
      const de = ea != null ? ea : centro(m, a.capital), hasta = eb != null ? eb : centro(m, b.capital);
      const k = ru.clave, viejo = v.vias[k];
      quedan.add(k);
      // Sigue valiendo si va entre las mismas estaciones y nada la ha cortado.
      if (viejo && viejo.de === de && viejo.a === hasta && viejo.tiles.every((t, i) => i === 0 || i === viejo.tiles.length - 1 || (!v.obra[t] || v.obra[t] === OBRA.campo) && !(ter[t] === 'agua' || ter[t] === 'bajo'))) continue;
      if (nuevas >= 2) continue;
      nuevas++;
      costeVia.v = v; costeVia.ter = ter; costeVia.de = de; costeVia.a = hasta;
      const tiles = trazar(m, de, hasta, ter, true);
      if (tiles && tiles.length > 3) v.vias[k] = { de, a: hasta, tiles, ru: ru.id, desde: m.turno };
      else delete v.vias[k];
    }
    for (const k of Object.keys(v.vias)) if (!quedan.has(k)) delete v.vias[k];
    v.via = new Array(tw * v.th).fill(0);
    // Por donde pasa la vía se tala el bosque y se aparta la piedra.
    for (const k of Object.keys(v.vias)) for (const t of v.vias[k].tiles) if (!v.obra[t] || v.obra[t] === OBRA.campo) { v.via[t] = 1; if (v.arbol[t]) cambiar(m, 'arbol', t, 0, 0); if (v.roca[t]) cambiar(m, 'roca', t, 0, 0); }
  }
  function costeVia(t) {
    const { v, ter } = costeVia, tr = ter[t];
    if (tr === 'agua' || tr === 'bajo') return Infinity;
    const o = v.obra[t];
    if (o && o !== OBRA.campo) return t === costeVia.de || t === costeVia.a ? 1 : Infinity;
    if (v.camino[t]) return 6;
    if (v.via && v.via[t]) return 0.6;
    if (v.plan && v.plan[t] === 1) return 7;
    if (v.plan && v.plan[t] === 2) return 5;
    return (tr === 'montana' ? 9 : tr === 'rio' ? 5 : tr === 'pantano' ? 3 : o === OBRA.campo ? 3 : 1) + (v.arbol[t] >= 2 ? 0.5 : 0) + (v.roca[t] ? 1 : 0);
  }
  function trazar(m, de, a, ter, via, lejos) {
    const v = m.vida, tw = v.tw, th = v.th, mg = lejos ? 40 : 14;
    const [ax, ay] = [de % tw, de / tw | 0], [bx, by] = [a % tw, a / tw | 0];
    const x0 = Math.max(0, Math.min(ax, bx) - mg), x1 = Math.min(tw - 1, Math.max(ax, bx) + mg), y0 = Math.max(0, Math.min(ay, by) - mg), y1 = Math.min(th - 1, Math.max(ay, by) + mg);
    const coste = via ? costeVia : t => {
      const tr = ter[t];
      if (tr === 'agua' || tr === 'bajo') return Infinity;
      if (v.camino[t]) return 0.35;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.campo || o === OBRA.ruina) return 7;
      // Dentro de un pueblo, los caminos van por las calles del plan y no cruzan los solares.
      if (v.plan && v.plan[t] === 1) return 0.6;
      if (v.plan && v.plan[t] === 2) return 4;
      return (tr === 'montana' ? 5 : tr === 'pantano' ? 2.5 : tr === 'rio' ? 3 : 1) + (v.arbol[t] >= 2 ? 1 : 0) + (v.roca[t] ? 2 : 0);
    };
    const dist = new Map([[de, 0]]), prev = new Map(), abiertos = [[0, de]];
    // Dijkstra con un montículo sencillo.
    const meter = (d, t) => { abiertos.push([d, t]); let i = abiertos.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (abiertos[pa][0] <= abiertos[i][0]) break; [abiertos[pa], abiertos[i]] = [abiertos[i], abiertos[pa]]; i = pa; } };
    const sacar = () => { const top = abiertos[0], fin = abiertos.pop(); if (abiertos.length) { abiertos[0] = fin; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mn = i; if (l < abiertos.length && abiertos[l][0] < abiertos[mn][0]) mn = l; if (r < abiertos.length && abiertos[r][0] < abiertos[mn][0]) mn = r; if (mn === i) break; [abiertos[mn], abiertos[i]] = [abiertos[i], abiertos[mn]]; i = mn; } } return top; };
    abiertos.length = 0; meter(0, de);
    let vistas = 0;
    while (abiertos.length && vistas++ < (lejos ? 40000 : 9000)) {
      const [d, t] = sacar();
      if (t === a) break;
      if (d > (dist.get(t) ?? Infinity)) continue;
      const x = t % tw, y = t / tw | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const n = ny * tw + nx, c = n === a ? 1 : coste(n);
        if (c === Infinity) continue;
        const nd = d + c;
        if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, t); meter(nd, n); }
      }
    }
    if (!prev.has(a)) return null;
    const camino = [a];
    while (camino[camino.length - 1] !== de) camino.push(prev.get(camino[camino.length - 1]));
    return camino.reverse();
  }
  // Las calles de una ciudad: una cruz alrededor de la plaza.
  function calles(m, r) {
    const v = m.vida;
    if (pausada(m)) {
      // Con plan: la calle que rodea la plaza (el primer anillo de la cuadrícula).
      const rx = (r % m.W) * SUB, ry = (r / m.W | 0) * SUB, out = [];
      for (let k = 0; k <= 3; k++) { out.push(ry * v.tw + rx + k, (ry + 3) * v.tw + rx + k, (ry + k) * v.tw + rx, (ry + k) * v.tw + rx + 3); }
      return [...new Set(out)].filter(t => t >= 0 && t < v.tw * v.th);
    }
    const cx = (r % m.W) * SUB + 2, cy = (r / m.W | 0) * SUB + 2, out = [];
    for (let d = -2; d <= 2; d++) { out.push(cy * v.tw + cx + d); out.push((cy + d) * v.tw + cx); }
    return [...new Set(out)].filter(t => t >= 0 && t < v.tw * v.th);
  }
  const rutaActiva = (m, ru) => { const a = S().civ(m, ru.a), b = S().civ(m, ru.b); return a && a.viva && b && b.viva && (a === b || !S().enGuerra(a, b)); };
  /*
   * ABRIR UNA RUTA A PETICIÓN («abrid una ruta comercial con X»): se traza en el acto la carretera entre las dos
   * capitales, por lejos que estén, y los constructores de los dos reinos empiezan a empedrarla. Si no hay
   * camino por tierra (un mar en medio), se dice: entonces el comercio va en barco, de puerto a puerto.
   */
  function abrirRuta(m, c, o) {
    const v = m.vida, ter = terrenos(m);
    const [a, b] = c.id < o.id ? [c, o] : [o, c], clave = 'e:' + a.capital + ':' + b.capital;
    const hay = v.rutas.find(ru => ru.clave === clave);
    if (hay) { hay.pedida = 1; return { ok: true, ya: true, n: hay.tiles.length, empedrado: hay.tiles.filter(t => v.camino[t]).length }; }
    const tiles = trazar(m, centro(m, a.capital), centro(m, b.capital), ter, false, true);
    if (!tiles || tiles.length < 3) {
      const puertos = [c, o].every(x => (x.puertos || 0) > 0);
      return { ok: false, mar: true, puertos };
    }
    const ru = { id: v.sig++, clave, tipo: 'externa', a: a.id, b: b.id, ra: a.capital, rb: b.capital, tiles, pedida: 1 };
    v.rutas.push(ru);
    S().cronica(m, 'comercio', 'Carretera entre ' + a.nombre + ' y ' + b.nombre, 'Se abre una ruta de comercio entre ' + a.nombre + ' y ' + b.nombre + ' (' + tiles.length + ' leguas de camino). Los constructores de los dos reinos empiezan a empedrarla y los comerciantes ya cargan las carretas.', c);
    return { ok: true, n: tiles.length, empedrado: tiles.filter(t => v.camino[t]).length };
  }
  function planificarRutas(m, ter) {
    const v = m.vida;
    // Fuera las rutas cuyos extremos ya no valen (ciudad conquistada, capital movida, pueblo muerto).
    v.rutas = v.rutas.filter(ru => {
      const a = S().civ(m, ru.a), b = S().civ(m, ru.b);
      if (!a || !a.viva || !b || !b.viva) return false;
      if (ru.tipo === 'interna') return a.capital === ru.ra && m.dueno[ru.rb] === a.id && (m.ciudades || []).some(x => x.region === ru.rb);
      if (ru.tipo === 'externa') return a.capital === ru.ra && b.capital === ru.rb;
      return m.dueno[ru.ra] === a.id;
    });
    const hay = clave => v.rutas.some(ru => ru.clave === clave);
    let nuevas = 0;
    const abrir = (ru, de, a) => {
      if (nuevas >= 3) return;
      const tiles = trazar(m, de, a, ter);
      nuevas++;
      if (tiles && tiles.length > 2) { ru.id = v.sig++; ru.tiles = tiles; v.rutas.push(ru); return true; }
      return false;
    };
    for (const c of S().vivas(m)) {
      if (!hay('c:' + c.capital)) v.rutas.push({ id: v.sig++, clave: 'c:' + c.capital, tipo: 'calle', a: c.id, b: c.id, ra: c.capital, rb: c.capital, tiles: calles(m, c.capital) });
      for (const x of (m.ciudades || []).filter(x => x.civ === c.id)) {
        if (!hay('c:' + x.region) && !(pausada(m) && x.fase && x.fase !== 'aldea')) v.rutas.push({ id: v.sig++, clave: 'c:' + x.region, tipo: 'calle', a: c.id, b: c.id, ra: x.region, rb: x.region, tiles: calles(m, x.region) });
        const clave = 'i:' + c.capital + ':' + x.region;
        if (!hay(clave)) abrir({ clave, tipo: 'interna', a: c.id, b: c.id, ra: c.capital, rb: x.region }, centro(m, c.capital), centro(m, x.region));
      }
    }
    // Rutas entre reinos: vecinos (o casi) en paz que se llevan bien, o con un tratado de comercio.
    const vivas = S().vivas(m);
    for (const a of vivas) for (const b of vivas) {
      if (a.id >= b.id || S().enGuerra(a, b) || S().distancia(a.capital, b.capital) > 22) continue;
      const tratado = (a.plan && (a.plan.socios || []).includes(b.id)) || (b.plan && (b.plan.socios || []).includes(a.id));
      if (!tratado && (a.rel[b.id] || 0) < 12) continue;
      const externas = c => v.rutas.filter(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)).length;
      if (!tratado && (externas(a) >= 2 || externas(b) >= 2)) continue;
      const clave = 'e:' + a.capital + ':' + b.capital;
      if (hay(clave)) continue;
      if (abrir({ clave, tipo: 'externa', a: a.id, b: b.id, ra: a.capital, rb: b.capital }, centro(m, a.capital), centro(m, b.capital)))
        S().cronica(m, 'comercio', 'Ruta comercial entre ' + a.nombre + ' y ' + b.nombre, 'Las carretas de ' + a.nombre + ' y ' + b.nombre + ' empiezan a ir y venir por un camino nuevo: sal, tela, metal y noticias.', a);
    }
    // Lo que falta por empedrar, por pueblo (en su tierra o en tierra de nadie).
    v.pendientes = {};
    for (const ru of v.rutas) {
      if (!rutaActiva(m, ru)) continue;
      for (const t of ru.tiles) {
        if (v.camino[t] || ter[t] === 'agua' || ter[t] === 'bajo') continue;
        const o = v.obra[t];
        if (o === OBRA.casa || o === OBRA.campo || o === OBRA.ruina) continue;
        // Lo empiedra el dueño de la tierra; en tierra de nadie o de un tercer reino en paz, el que la pidió (o el primero).
        const d = m.dueno[region(m, t)], tercero = d >= 0 && d !== ru.a && d !== ru.b, ca = S().civ(m, ru.a), cd = tercero ? S().civ(m, d) : null;
        const quien = d >= 0 && !tercero ? d : tercero ? (cd && ca && !S().enGuerra(ca, cd) ? ru.a : -1) : ru.a;
        if (quien >= 0) (v.pendientes[quien] = v.pendientes[quien] || []).push(t);
      }
    }
    // Las calles del plan se empiedran a medida que tienen casas o edificios al lado (de dentro afuera).
    if (pausada(m) && v.plan) {
      const tw = v.tw;
      for (const ce of v.centros || []) {
        const lista = (v.pendientes[ce.civ] = v.pendientes[ce.civ] || []), ya = new Set(lista), nuevas = [];
        for (let y = Math.max(0, Math.floor(ce.cy - ce.R)); y <= Math.min(v.th - 1, Math.ceil(ce.cy + ce.R)); y++) for (let x = Math.max(0, Math.floor(ce.cx - ce.R)); x <= Math.min(tw - 1, Math.ceil(ce.cx + ce.R)); x++) {
          const t = y * tw + x;
          if (v.plan[t] !== 1 || v.camino[t] || v.obra[t] || ya.has(t) || !andable(ter[t])) continue;
          if ([t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < v.obra.length && v.obra[n] && v.obra[n] !== OBRA.campo && v.obra[n] !== OBRA.ruina)) nuevas.push([Math.hypot(x - ce.cx, y - ce.cy), t]);
        }
        nuevas.sort((p, q) => p[0] - q[0]);
        for (const [, t] of nuevas.slice(0, 12)) lista.push(t);
      }
    }
    for (const c of m.civs) c.rutas = v.rutas.filter(ru => ru.tipo !== 'calle' && (ru.a === c.id || ru.b === c.id) && rutaActiva(m, ru)).length;
  }

  /*
   * COMER: cada aldeano se come su ración del granero (los niños, media). Si el granero se vacía, la gente
   * pasa hambre; quien lleva tres turnos sin comer, muere. Al final, la población del reino son sus aldeanos.
   */
  function comer(m) {
    const v = m.vida, porCiv = {};
    for (const a of v.aldeanos) (porCiv[a.c] = porCiv[a.c] || []).push(a);
    const muertos = new Set();
    for (const c of S().vivas(m)) {
      const lista = porCiv[c.id] || [];
      // En invierno se raciona: se come algo menos para que el granero dure hasta la primavera.
      const racion = lista.reduce((k, a) => k + (esNino(a) ? 0.15 : 0.3), 0) * (v.estacion === 3 ? 0.85 : 1);
      // La recolección: los adultos que no van a la guerra juntan algo de comida aunque no haya campos.
      const seca = c.efectos.some(e => e.sequia), fertil = Math.min(1.5, S().fertil(m, c.capital) / 2) * (seca ? 0.3 : 1);
      let recogen = lista.filter(a => !esNino(a) && a.o !== GUERRERO).length * 0.1 * fertil * (v.estacion === 3 ? 0.45 : v.estacion === 2 ? 1.3 : 1);

      c.comida = (c.comida == null ? 30 : c.comida) + recogen - racion;
      if (c.comida < 0) {
        c.comida = 0;
        for (const a of lista) { a.hambre = (a.hambre || 0) + 1; a.desnutricion = Math.min(12, (a.desnutricion || 0) + 1); }
        const pausa = pausada(m), caen = lista.filter(a => a.hambre >= (pausa ? 3 : 2)).sort((x, y) => (y.edad || 0) - (x.edad || 0)).slice(0, Math.ceil(lista.length * (pausa ? 0.12 : 0.3)));
        if (caen.length && lista.length - caen.length >= 1) {
          for (const a of caen) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'hambre', TICKS - 0.5, a]); }
          if (m.turno - c.ultimaHambre > 6) S().cronica(m, 'hambruna', 'Hambre en ' + c.nombre, 'Los graneros de ' + c.nombre + ' están vacíos. Mueren ' + caen.length + ' aldeanos, primero los más viejos; los demás comen raíces y miran al cielo.', c);
          c.ultimaHambre = m.turno;
        }
      } else {
        // Comer poco (el granero casi vacío) también deja huella; comer bien la va borrando.
        const escaso = (c.comida || 0) < lista.length * 0.3;
        for (const a of lista) { a.hambre = Math.max(0, (a.hambre || 0) - 1); a.desnutricion = escaso ? Math.min(12, (a.desnutricion || 0) + 0.3) : Math.max(0, (a.desnutricion || 0) * 0.96 - 0.02); }
      }
      c.comida = Math.min(c.comida, topeComida(c, lista.length));
    }
    if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    actualizarPoblacion(m);
  }
  // La población del reino (lo que usa el motor) sale de sus aldeanos.
  function actualizarPoblacion(m) {
    const v = m.vida, n = {};
    for (const a of v.aldeanos) n[a.c] = (n[a.c] || 0) + 1;
    for (const c of S().vivas(m)) { c.escalaVida = escala(c); c.pob = Math.max(0.5, (n[c.id] || 0) * c.escalaVida); c.pobVida = c.pob; c.habitantes = n[c.id] || 0; }
  }

  // ---------- Los animales: ovejas y vacas junto a las aldeas, ciervos en los bosques, peces en el agua ----------
  const HABITAT = {
    oveja: t => t === 'llanura' || t === 'sabana' || t === 'colina' || t === 'tundra' || t === 'sakura',
    vaca: t => t === 'llanura' || t === 'sabana' || t === 'pantano',
    ciervo: t => t === 'bosque' || t === 'taiga' || t === 'selva' || t === 'llanura' || t === 'sakura',
    pez: t => t === 'agua' || t === 'bajo' || t === 'rio',
    lobo: t => t === 'bosque' || t === 'taiga' || t === 'tundra' || t === 'nieve' || t === 'colina' || t === 'llanura' || t === 'sabana'
  };
  const GUARIDA = t => t === 'bosque' || t === 'taiga' || t === 'tundra' || t === 'nieve';
  // Lobos y aldeanos: un lobo a veces muerde a quien anda solo (sobre todo niños); un guerrero que lo
  // tiene al lado lo mata. Los guerreros sin guerra salen a cazarlos.
  // Listas de animales por turno (se rehacen cuando cambia la lista): rebaños de cada pueblo y presas salvajes.
  let cacheAnimales = { lista: null, porCiv: null, salvajes: null };
  function indiceAnimales(v) {
    if (cacheAnimales.lista === v.animales) return cacheAnimales;
    const porCiv = new Map(), salv = [];
    for (const b of v.animales) { if (b.c != null) (porCiv.get(b.c) || porCiv.set(b.c, []).get(b.c)).push(b); else if (b.tipo === 'ciervo' || b.tipo === 'pez') salv.push(b); }
    return (cacheAnimales = { lista: v.animales, porCiv, salvajes: salv });
  }
  const rebanosDe = (v, id) => indiceAnimales(v).porCiv.get(id) || [];
  const salvajes = v => indiceAnimales(v).salvajes;
  function lobos(m, paso) {
    const v = m.vida, lista = v.animales.filter(b => b.tipo === 'lobo');
    if (!lista.length) return;
    const muertos = new Set(), cerca = v.aldeanos.filter(a => lista.some(b => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1));
    if (!cerca.length) return;
    for (const b of lista) {
      for (const a of cerca) {
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1 || muertos.has(a)) continue;
        // Pelea de verdad: el lobo muerde (si se atreve: con un guerrero o un adulto, menos) y el aldeano le
        // devuelve el golpe con lo que lleve en la mano.
        const ataca = esNino(a) ? 0.3 : a.o === GUERRERO ? 0.25 : 0.12;
        if (azar(v) < ataca && acierta(v, b, a) && golpear(v, b, a, danoContra(v, b, a, false), paso, b.x, b.y)) { muertos.add(a); v.muertos.push([a.x, a.y, a.c, 'lobo', paso, a]); v.mordidos[a.c] = (v.mordidos[a.c] || 0) + 1; break; }
        if (!esNino(a) && acierta(v, a, b) && golpear(v, a, b, danoContra(v, a, b, false), paso, a.x, a.y)) { b.muerta = 1; v.muertos.push([b.x, b.y, null, 'animal', paso, b]); a.bajas = (a.bajas || 0) + 1; break; }
      }
    }
    if (muertos.size) v.aldeanos = v.aldeanos.filter(a => !muertos.has(a));
    if (lista.some(b => b.muerta)) v.animales = v.animales.filter(b => !b.muerta);
  }
  function pastar(m, b, ter) {
    const v = m.vida;
    if (b.tipo === 'lobo') {
      // Los lobos rondan los rebaños: se acercan a la oveja o la vaca más cercana y a veces se la llevan.
      if (b.presa == null || azar(v) < 0.1) {
        let mejor = null, md = 10;
        for (const o of v.animales) { if ((o.tipo !== 'oveja' && o.tipo !== 'vaca') || o.muerta) continue; const d = Math.abs(o.x - b.x) + Math.abs(o.y - b.y); if (d < md) { md = d; mejor = o; } }
        b.presa = mejor ? mejor.id : null;
      }
      const o = b.presa != null ? v.animales.find(x => x.id === b.presa && !x.muerta) : null;
      if (o) {
        const dx = Math.sign(o.x - b.x), dy = Math.sign(o.y - b.y), [mx, my] = dx && (!dy || azar(v) < 0.5) ? [dx, 0] : [0, dy];
        if (HABITAT.lobo(ter[(b.y + my) * v.tw + b.x + mx]) || andable(ter[(b.y + my) * v.tw + b.x + mx])) { b.x += mx; b.y += my; }
        if (Math.abs(o.x - b.x) + Math.abs(o.y - b.y) <= 1 && azar(v) < 0.35 && golpear(v, b, o, danoContra(v, b, o, false), (b.r.length >> 1) || 1, b.x, b.y)) { o.muerta = 1; v.muertos.push([o.x, o.y, null, 'animal', (b.r.length >> 1) || 1, o]); b.presa = null; v.presas = (v.presas || 0) + 1; if (o.c != null) v.robadas[o.c] = (v.robadas[o.c] || 0) + 1; }
        b.r.push(b.x, b.y);
        return;
      }
    }
    if (azar(v) < 0.55) {
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
      const x = b.x + dx, y = b.y + dy;
      // Los rebaños no se alejan de su aldea.
      if (x >= 0 && y >= 0 && x < v.tw && y < v.th && HABITAT[b.tipo](ter[y * v.tw + x]) && (b.casa == null || dist(m, y * v.tw + x, b.casa) <= 6)) { b.x = x; b.y = y; }
    }
    b.r.push(b.x, b.y);
  }
  function fauna(m, ter) {
    const v = m.vida;
    // Los rebaños de cada pueblo, según su tamaño (las vacas llegan con la Edad del Hierro).
    v.animales = v.animales.filter(b => b.c == null || (S().civ(m, b.c) && S().civ(m, b.c).viva));
    // Los rebaños crían si hay pastos (tierra propia sin casas, campos ni bosque) y menguan si se pierden.
    const pasto = {};
    for (let t = 0; t < ter.length; t++) { const d = m.dueno[region(m, t)]; if (d >= 0 && !v.obra[t] && v.arbol[t] < 2 && (HABITAT.oveja(ter[t]) || HABITAT.vaca(ter[t]))) pasto[d] = (pasto[d] || 0) + 1; }
    for (const c of S().vivas(m)) {
      const p = pasto[c.id] || 0, mg = 1 + M.tec(c, 'ganado'), tope = { oveja: Math.min(Math.round(24 * mg), Math.floor(p / 7 * mg)), vaca: c.era >= 1 ? Math.min(Math.round(14 * mg), Math.floor(p / 12 * mg)) : 0 };
      for (const tipo of ['oveja', 'vaca']) {
        const suyos = v.animales.filter(b => b.c === c.id && b.tipo === tipo);
        if (suyos.length < 2 && tope[tipo] >= 2) { nacer(m, ter, tipo, c); continue; } // se doman unas reses salvajes
        const crias = Math.min(2, Math.floor(suyos.length / 2), tope[tipo] - suyos.length);
        for (let k = 0; k < crias; k++) if (azar(v) < 0.3) nacer(m, ter, tipo, c, suyos[Math.floor(azar(v) * suyos.length)]);
        if (suyos.length > tope[tipo] + 1) v.animales = v.animales.filter(b => b !== suyos[0]);
      }
    }
    // Los animales salvajes crían a partir de los que quedan, hasta lo que su hábitat aguanta: si se cazan
    // todos los ciervos de una comarca, tardan en volver.
    const habitat = { ciervo: 0, pez: 0, lobo: 0 };
    for (let t = 0; t < ter.length; t += 3) { if (HABITAT.ciervo(ter[t]) && m.dueno[region(m, t)] < 0) habitat.ciervo += 3; if (HABITAT.pez(ter[t])) habitat.pez += 3; if (GUARIDA(ter[t]) && m.dueno[region(m, t)] < 0) habitat.lobo += 3; }
    const tope = { ciervo: Math.min(70, Math.floor(habitat.ciervo / 120)), pez: Math.min(60, Math.floor(habitat.pez / 250)), lobo: Math.min(16, Math.floor(habitat.lobo / 350)) };
    for (const tipo of ['ciervo', 'pez', 'lobo']) {
      const suyos = v.animales.filter(b => b.tipo === tipo);
      if (suyos.length > tope[tipo] + 2) { v.animales = v.animales.filter(b => b !== suyos[0]); continue; }
      const nacen = Math.min(tope[tipo] - suyos.length, suyos.length < 4 ? 2 : Math.ceil(suyos.length * (tipo === 'lobo' ? 0.05 : 0.1)));
      for (let k = 0; k < nacen; k++) nacer(m, ter, tipo, null, suyos.length >= 4 ? suyos[Math.floor(azar(v) * suyos.length)] : null);
    }
  }
  function nacer(m, ter, tipo, c, madre) {
    const v = m.vida;
    for (let k = 0; k < 30; k++) {
      let t;
      if (madre) t = (madre.y + Math.floor(azar(v) * 3) - 1) * v.tw + madre.x + Math.floor(azar(v) * 3) - 1;
      else if (c) { const cs = S().casillas(m, c); const r = azar(v) < 0.5 ? c.capital : cs[Math.floor(azar(v) * cs.length)]; t = parcelas(m, r)[Math.floor(azar(v) * SUB * SUB)]; }
      else t = Math.floor(azar(v) * ter.length);
      if (!HABITAT[tipo](ter[t]) || v.obra[t]) continue;
      if (tipo === 'ciervo' && m.dueno[region(m, t)] >= 0 && azar(v) < 0.8) continue;
      if (tipo === 'lobo' && !madre && (!GUARIDA(ter[t]) || m.dueno[region(m, t)] >= 0)) continue;
      if (t < 0 || t >= ter.length) continue;
      v.animales.push({ id: v.sig++, tipo, c: c ? c.id : null, casa: madre ? madre.casa : c ? t : null, x: t % v.tw, y: t / v.tw | 0, r: [] });
      return true;
    }
    return false;
  }

  // ---------- Lo que pasa solo: los árboles crecen, las ruinas se cubren, los bosques se acaban ----------
  function naturaleza(m, ter) {
    const v = m.vida, tw = v.tw, n = tw * v.th, F = TICKS;
    // En sequía el trigo no crece y muere una de cada cinco reses cada turno.
    const secos = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.sequia)).map(c => c.id));
    if (secos.size) v.animales = v.animales.filter(b => !(b.c != null && secos.has(b.c) && azar(v) < 0.2));
    // Las regiones que cambiaron de suelo (un terremoto las volvió desierto) pierden sus árboles y sus casas.
    for (let r = 0; r < m.W * m.H; r++) if (v.tipoVisto[r] !== m.tipo[r]) {
      const nuevo = m.tipo[r];
      if (nuevo === 'desierto' || nuevo === 'montana' || esAgua(nuevo)) for (const t of parcelas(m, r)) {
        cambiar(m, 'arbol', t, 0, F);
        if (v.obra[t] === OBRA.casa || v.obra[t] === OBRA.centro || v.obra[t] === OBRA.ayuntamiento) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (v.obra[t] === OBRA.campo) cambiar(m, 'obra', t, 0, F);
      }
      v.tipoVisto[r] = nuevo;
    }
    for (let t = 0; t < n; t++) {
      const r = region(m, t), dueno = m.dueno[r], tierra = ter[t];
      const ob = v.obra[t];
      // El trigo crece: tierra arada, brotes, verde y dorado (listo para segar).
      if (ob === OBRA.campo && v.cultivo[t] > 0 && secos.has(dueno) && azar(v) < 0.45) cambiar(m, 'cultivo', t, 0, 1 + Math.floor(azar(v) * TICKS)); // el trigo se agosta
      else if (ob === OBRA.campo && v.cultivo[t] < 3 && dueno >= 0 && !secos.has(dueno) && azar(v) < (v.estacion === 3 ? 0.1 : v.estacion === 0 ? 0.7 : 0.55)) cambiar(m, 'cultivo', t, v.cultivo[t] + 1, 1 + Math.floor(azar(v) * TICKS));
      // Lo abandonado se arruina, y las ruinas acaban bajo la hierba.
      if (dueno < 0) {
        if ((ob === OBRA.casa || ob >= OBRA.torre) && azar(v) < 0.2) cambiar(m, 'obra', t, OBRA.ruina, F);
        else if (ob === OBRA.campo && azar(v) < 0.25) cambiar(m, 'obra', t, 0, F);
        else if (ob === OBRA.ruina && azar(v) < 0.04) cambiar(m, 'obra', t, 0, F);
      } else if (ob === OBRA.ruina && azar(v) < 0.02) cambiar(m, 'obra', t, 0, F);
      if (v.camino[t] && dueno < 0 && azar(v) < 0.01) cambiar(m, 'camino', t, 0, F);
      if (v.obra[t] || v.roca[t] || v.camino[t] || esVia(v, t) || (v.trinchera && v.trinchera[t]) || tierra === 'rio' || tierra === 'arena' || tierra === 'agua' || tierra === 'bajo') continue;
      const a = v.arbol[t];
      if (a === 1 || a === 2) { if (azar(v) < 0.4) cambiar(m, 'arbol', t, a + 1, F); continue; }
      if (a) continue;
      // Un bosque abandonado vuelve a crecer como bosque.
      const base = (v.fueBosque[r] && dueno < 0) ? BROTE[typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque'] : BROTE[m.tipo[r]] || 0;
      if (!base) continue;
      const x = t % tw, y = t / tw | 0;
      const junto = (x > 0 && v.arbol[t - 1]) || (x < tw - 1 && v.arbol[t + 1]) || (y > 0 && v.arbol[t - tw]) || (y < v.th - 1 && v.arbol[t + tw]);
      if (azar(v) < base * (junto ? 1 : 0.12)) cambiar(m, 'arbol', t, 1, F);
    }
    // Un bosque sin árboles ya no es bosque (y deja de dar madera, aunque sí da campos): la selva talada
    // se queda en sabana, la taiga en tundra. Si se deja crecer, el bosque vuelve.
    const TALADO = S().TALADO;
    for (let r = 0; r < m.W * m.H; r++) {
      const tipo = m.tipo[r], original = v.fueBosque[r] ? (typeof v.fueBosque[r] === 'string' ? v.fueBosque[r] : 'bosque') : null;
      if (!TALADO[tipo] && !(original && tipo === TALADO[original])) continue;
      let quedan = 0;
      for (const t of parcelas(m, r)) if (v.arbol[t]) quedan++;
      if (TALADO[tipo] && quedan <= 3) { m.tipo[r] = TALADO[tipo]; v.fueBosque[r] = tipo; v.tipoVisto[r] = m.tipo[r]; v.cambios.push([3, r, tipo, m.tipo[r], F]); }
      else if (original && tipo === TALADO[original] && quedan >= 10) { m.tipo[r] = original; v.tipoVisto[r] = original; v.cambios.push([3, r, tipo, original, F]); }
    }
    avisar(m);
  }

  // Cuando un pueblo se queda sin bosques y sin madera, la crónica lo cuenta (una vez cada tanto).
  function avisar(m) {
    const v = m.vida;
    for (const c of S().vivas(m)) {
      const cs = S().casillas(m, c);
      if (cs.length < 6) continue;
      let arboles = 0;
      for (const r of cs) for (const t of parcelas(m, r)) if (v.arbol[t] >= 2) arboles++;
      c.arboles = arboles;
      const talado = cs.filter(r => v.fueBosque[r]).length;
      if (arboles < cs.length * 0.6 && talado >= 3 && c.madera < 6 && m.turno - (v.avisos[c.id] || -99) > 25) {
        v.avisos[c.id] = m.turno;
        c.efectos.push({ estab: -5, hasta: m.turno + 5 });
        S().cronica(m, 'deforestacion', c.nombre + ' tala su último bosque', 'Los leñadores de ' + c.nombre + ' vuelven con las manos vacías: donde había bosque hay campos, pastos y tocones. Sin madera no hay casas nuevas, ni barcos, ni leña para el invierno.', c, cs.find(r => v.fueBosque[r]));
      }
    }
  }

  /*
   * LAS CIUDADES: una región con muchas casas, lejos de la capital y de otras ciudades, se convierte en
   * ciudad con su ayuntamiento, su nombre y su alcalde. Cambian de dueño con las guerras y son las que se
   * rebelan cuando el reino se rompe (sim.js las usa en separar).
   */
  function nombreCiudad(m) {
    const v = m.vida, S2 = M.SILABAS;
    for (let k = 0; k < 20; k++) {
      const n = S2.inicio[Math.floor(azar(v) * S2.inicio.length)] + (azar(v) < 0.5 ? S2.medio[Math.floor(azar(v) * S2.medio.length)] : '') + S2.fin[Math.floor(azar(v) * S2.fin.length)];
      if (!m.civs.some(c => c.nombre === n) && !(m.ciudades || []).some(c => c.nombre === n)) return n;
    }
    return 'Villa ' + (m.ciudades || []).length;
  }
  const persona = v => M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + M.PERSONAS.fin[Math.floor(azar(v) * M.PERSONAS.fin.length)];
  function ciudades(m) {
    const v = m.vida;
    m.ciudades = m.ciudades || [];
    // Las que cambian de dueño o se abandonan.
    for (const x of m.ciudades.slice()) {
      const d = m.dueno[x.region], t = centro(m, x.region);
      if (d < 0) { if (v.obra[t] === OBRA.ayuntamiento) cambiar(m, 'obra', t, OBRA.ruina, TICKS); m.ciudades = m.ciudades.filter(y => y !== x); S().cronica(m, 'caida', x.nombre + ' queda abandonada', 'La ciudad de ' + x.nombre + ' se vacía: sus calles se llenan de hierba y sus piedras acaban en las casas de los pueblos vecinos.', null, x.region); continue; }
      if (d !== x.civ) {
        const antes = S().civ(m, x.civ), ahora = S().civ(m, d);
        x.civ = d; x.alcalde = persona(v); x.rasgo = ['leal', 'ambicioso', 'codicioso', 'tranquilo'][Math.floor(azar(v) * 4)]; x.conquistada = m.turno;
        (x.historia = x.historia || []).push({ anio: m.anio, texto: 'conquistada por ' + ((S().civ(m, d) || {}).nombre || '?') });
        if (ahora && antes && antes.viva) S().cronica(m, 'conquista', ahora.nombre + ' toma ' + x.nombre, 'La ciudad de ' + x.nombre + ', que era de ' + antes.nombre + ', iza ahora la bandera de ' + ahora.nombre + '. Su nuevo alcalde, ' + x.alcalde + ', promete respetar los mercados (y subir los impuestos).', ahora, x.region);
      }
      if (pausada(m) && x.fase && x.fase !== 'aldea') { faseCiudad(m, x, t); continue; }
      if (v.obra[t] !== OBRA.ayuntamiento) { cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS); cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS); }
    }
    colonos(m);
  }

  /*
   * LAS FASES DE UNA CIUDAD NUEVA (partidas pausadas):
   *  · campamento: tiendas y hoguera donde acampan los colonos;
   *  · en obras: con seis vecinos y dos casas alrededor, se levanta el ayuntamiento sobre un andamio
   *    (lo construyen los constructores del reino y, poco a poco, los propios vecinos);
   *  · aldea: con el ayuntamiento acabado, ya es un pueblo de verdad, con su plaza y su plano de calles.
   */
  function faseCiudad(m, x, t) {
    const v = m.vida, c = S().civ(m, x.civ);
    if (!c) return;
    const vecinos = v.aldeanos.filter(a => a.c === c.id && a.h === x.region && a.colono == null).length;
    const casas = [x.region, ...S().vecinos(x.region)].filter(r => m.dueno[r] === c.id).flatMap(r => parcelas(m, r)).filter(u => v.obra[u] === OBRA.casa && dist(m, u, t) <= 6).length;
    x.vecinos = vecinos; x.casasCerca = casas;
    // Mientras es campamento, cada pocos turnos se muda alguien de la capital (se le ve llegar andando).
    if (vecinos < 10 && m.turno % 3 === x.region % 3 && v.aldeanos.filter(a => a.c === c.id && a.colono === x.region).length < 2) {
      const sitio = v.aldeanos.filter(a => a.c === c.id && a.h === c.capital && (a.edad || 0) >= ADULTO && (a.edad || 0) < VIEJO && a.o !== GUERRERO && a.colono == null && !a.fijo);
      if (sitio.length > 6) { const a = sitio[Math.floor(azar(v) * sitio.length)]; a.colono = x.region; a.e = LIBRE; a.paseo = 0; a.edificio = 0; a.obraCamino = 0; if (a.o !== CONSTRUCTOR && casas < 2 && azar(v) < 0.5) mover(a, CONSTRUCTOR); }
    }
    if (x.fase === 'campamento') {
      if (!v.obra[t] && !(v.andamios && v.andamios[t])) cambiar(m, 'obra', t, OBRA.campamento, TICKS);
      if (vecinos >= 6 && casas >= 2) {
        x.fase = 'obras'; (x.historia = x.historia || []).push({ anio: m.anio, texto: 'empieza a levantar su ayuntamiento' });
        cambiar(m, 'obra', t, 0, TICKS);
        (v.andamios = v.andamios || {})[t] = { o: OBRA.ayuntamiento, falta: TRABAJO[OBRA.ayuntamiento], total: TRABAJO[OBRA.ayuntamiento], civ: c.id };
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: x.region, texto: '🏗 ' + x.nombre + ' levanta su ayuntamiento' });
      }
    } else if (x.fase === 'obras') {
      const an = v.andamios && v.andamios[t];
      if (v.obra[t] === OBRA.ayuntamiento) {
        x.fase = 'aldea'; (x.historia = x.historia || []).push({ anio: m.anio, texto: 'ya es una aldea, con ayuntamiento' });
        S().cronica(m, 'ciudad', x.nombre + ' ya es una aldea', 'El campamento de ' + x.nombre + ' tiene ya casas, vecinos y un ayuntamiento recién acabado. Lo que eran tiendas junto a una hoguera es ahora una aldea de ' + c.nombre + '.', c, x.region);
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: x.region, texto: '★ ' + x.nombre + ' ya es una aldea' });
      } else if (!an) {
        (v.andamios = v.andamios || {})[t] = { o: OBRA.ayuntamiento, falta: TRABAJO[OBRA.ayuntamiento], total: TRABAJO[OBRA.ayuntamiento], civ: c.id };
      } else {
        // Los vecinos también arriman el hombro (despacio), por si no llega ningún constructor.
        an.falta -= 0.08 * Math.min(8, vecinos);
        if (an.falta <= 0) { colocarObra(m, t, OBRA.ayuntamiento, TICKS); delete v.andamios[t]; }
      }
    }
  }

  /*
   * Una tierra es de un reino mientras vive gente en ella o al lado. La que lleva varios turnos sin nadie
   * cerca (porque la gente se fue, murió o nunca llegó) vuelve a ser tierra de nadie.
   */
  function abandonos(m) {
    const v = m.vida;
    v.vacia = v.vacia || new Array(m.W * m.H).fill(0);
    const poblada = v.poblada || [];
    for (let r = 0; r < m.W * m.H; r++) {
      const d = m.dueno[r];
      if (d < 0) { v.vacia[r] = 0; continue; }
      const c = S().civ(m, d);
      if (!c || c.capital === r || poblada[r] || S().vecinos(r).some(w => m.dueno[w] === d && poblada[w])) { v.vacia[r] = 0; continue; }
      if (++v.vacia[r] >= 4) { m.dueno[r] = -1; v.vacia[r] = 0; }
    }
  }

  /*
   * LOS COLONOS, como en WorldBox: cuando un pueblo está lleno (sin camas o al límite de comida), tres aldeanos
   * salen andando hacia una tierra libre y fértil y fundan allí una aldea nueva, con su ayuntamiento y su molino.
   */
  function colonos(m) {
    const v = m.vida, ter = terrenos(m);
    for (const c of S().vivas(m)) {
      const enCamino = v.aldeanos.filter(a => a.c === c.id && a.colono != null);
      if (enCamino.length) continue;
      const suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
      const lleno = (c.sinCama || 0) > 0 || (c.cap && c.pob > c.cap * 0.5);
      // El jugador puede mandar colonos aunque el pueblo no esté lleno (y hacia donde diga).
      const pedido = c.plan && c.plan.colonos;
      if ((!lleno && !pedido) || suyas >= S().maxCiudades(c) || m.turno - (c.ultimaColonia || -99) < (pedido ? 1 : 4)) continue;
      const cs = S().casillas(m, c);
      const destino = [];
      for (let r = 0; r < m.W * m.H; r++) {
        if (m.dueno[r] >= 0 || !S().esTierra(m, r) || S().fertil(m, r) < 2 || m.tipo[r] === 'nieve') continue;
        const d = Math.min(...[c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)].map(p => S().distancia(p, r)));
        if (d < 4 || d > 12) continue;
        if (S().vecinos(r).some(w => m.dueno[w] >= 0 && m.dueno[w] !== c.id)) continue;
        if (!ter[centro(m, r)] || !andable(ter[centro(m, r)])) continue;
        const rx = r % m.W - c.capital % m.W, ry = Math.floor(r / m.W) - Math.floor(c.capital / m.W);
        const fuera = pedido === 'norte' ? ry >= 0 : pedido === 'sur' ? ry <= 0 : pedido === 'este' ? rx <= 0 : pedido === 'oeste' ? rx >= 0 : pedido === 'costa' ? !S().vecinos(r).some(w => m.tipo[w] === 'costa' || m.tipo[w] === 'mar') : false;
        destino.push([r, d - S().fertil(m, r) * 0.8 + azar(v) * 2 + (fuera ? 30 : 0)]);
      }
      if (!destino.length) continue;
      const r = destino.sort((p, q) => p[1] - q[1])[0][0];
      const elegidos = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && a.o !== GUERRERO && !a.k && a.e !== VIAJAR).slice(0, 3);
      if (elegidos.length < 2) continue;
      c.ultimaColonia = m.turno;
      if (pedido) c.plan.colonos = null;
      for (const a of elegidos) { a.colono = r; a.e = LIBRE; a.paseo = 0; a.edificio = 0; a.obraCamino = 0; }
      void cs;
    }
  }
  // Un colono llega a su destino: si la tierra sigue libre, funda la aldea; si no, vuelve a casa.
  function fundar(m, a, c) {
    const v = m.vida, r = a.colono;
    const yaFundada = (m.ciudades || []).find(x => x.region === r && x.civ === c.id);
    if (!yaFundada && m.dueno[r] >= 0) { for (const b of v.aldeanos) if (b.colono === r && b.c === c.id) b.colono = null; return; }
    if (!yaFundada) {
      m.dueno[r] = c.id;
      for (const w of S().vecinos(r)) if (S().esTierra(m, w) && m.dueno[w] < 0 && azar(v) < 0.5) m.dueno[w] = c.id;
      const x = { region: r, nombre: nombreCiudad(m), civ: c.id, alcalde: persona(v), rasgo: ['leal', 'ambicioso', 'codicioso', 'tranquilo', 'tranquilo'][Math.floor(azar(v) * 5)], fundada: m.anio, lealtad: 40,
        madre: c.nombre, fundadores: v.aldeanos.filter(b => b.colono === r && b.c === c.id).map(b => b.nombre + ' ' + (b.familia || '')), historia: [{ anio: m.anio, texto: 'fundada como campamento por colonos de ' + c.nombre }] };
      (m.ciudades = m.ciudades || []).push(x);
      const t = centro(m, r), ter = terrenos(m);
      cambiar(m, 'arbol', t, 0, TICKS); cambiar(m, 'roca', t, 0, TICKS);
      if (pausada(m)) {
        // Primero un campamento: tiendas, una hoguera y la leña. El ayuntamiento llegará cuando haya gente y casas.
        x.fase = 'campamento'; x.desde = m.turno;
        cambiar(m, 'obra', t, OBRA.campamento, TICKS);
        S().cronica(m, 'ciudad', 'Colonos de ' + c.nombre + ' acampan en ' + x.nombre, 'Tres familias de ' + c.nombre + ' cargan sus cosas, caminan durante días y plantan sus tiendas en tierras vírgenes. Encienden una hoguera y llaman al lugar ' + x.nombre + '. Si prospera, algún día será una aldea.', c, r);
      } else {
        cambiar(m, 'obra', t, OBRA.ayuntamiento, TICKS);
        const mol = parcelas(m, r).filter(q => q !== t && !v.obra[q] && CULTIVABLE.has(ter[q])).sort((p, q) => dist(m, p, t) - dist(m, q, t))[0];
        if (mol != null) { cambiar(m, 'arbol', mol, 0, TICKS); cambiar(m, 'roca', mol, 0, TICKS); cambiar(m, 'obra', mol, OBRA.molino, TICKS); }
        S().cronica(m, 'ciudad', 'Colonos de ' + c.nombre + ' fundan ' + x.nombre, 'Tres familias de ' + c.nombre + ' cargan sus cosas, caminan durante días y se asientan en tierras vírgenes. Encienden una hoguera, levantan un molino y llaman al lugar ' + x.nombre + '.', c, r);
      }
    }
    for (const b of v.aldeanos) if (b.colono === r && b.c === c.id) { b.colono = null; b.h = r; }
  }

  // Lo que cada pueblo tiene levantado en su tierra: lo usa la capacidad (sim.js) y la ficha.
  function contar(m) {
    const v = m.vida, casas = {}, campos = {}, arboles = {}, edif = {}, camas = {}, masCamas = {}, ocio = {}, aduanas = {}, minasT = {};
    for (const c of m.civs) masCamas[c.id] = M.tec(c, 'casa');
    for (let t = 0; t < v.tw * v.th; t++) {
      const d = m.dueno[region(m, t)];
      if (d < 0) continue;
      const o = v.obra[t];
      if (o === OBRA.casa || o === OBRA.centro || o === OBRA.ayuntamiento || o === OBRA.campamento) { casas[d] = (casas[d] || 0) + (o === OBRA.casa ? 1 : 0.5); camas[d] = (camas[d] || 0) + (o === OBRA.casa ? 3 + (masCamas[d] || 0) : o === OBRA.centro ? 1.5 : 3); }
      else if (o === OBRA.campo) campos[d] = (campos[d] || 0) + 1;
      else if (o >= OBRA.torre) { const e = (edif[d] = edif[d] || {}); e[o] = (e[o] || 0) + 1; if (o === OBRA.aduana) (aduanas[d] = aduanas[d] || []).push(t); if (o === OBRA.mina) (minasT[d] = minasT[d] || []).push(t); if (o === OBRA.fuente || o === OBRA.parque) (ocio[d] = ocio[d] || []).push(t); }
      if (v.arbol[t] >= 2) arboles[d] = (arboles[d] || 0) + 1;
    }
    v.ocio = ocio;
    // Las regiones pobladas (con alguna obra o camino): el reino solo se extiende junto a ellas.
    v.poblada = new Array(m.W * m.H).fill(0);
    for (let t = 0; t < v.tw * v.th; t++) if ((v.obra[t] && v.obra[t] !== OBRA.ruina) || v.camino[t]) v.poblada[region(m, t)] = 1;
    const gente = {}, guerreros = {}, armados = {}, comerciantes = {};
    for (const a of v.aldeanos) { gente[a.c] = (gente[a.c] || 0) + 1; if (a.o === GUERRERO) { guerreros[a.c] = (guerreros[a.c] || 0) + 1; if ((a.arma || 0) > 0) armados[a.c] = (armados[a.c] || 0) + 1; } if (a.o === COMERCIANTE) comerciantes[a.c] = (comerciantes[a.c] || 0) + 1; }
    for (const c of m.civs) {
      c.casas = Math.round(casas[c.id] || 0); c.campos = campos[c.id] || 0; c.arboles = arboles[c.id] || 0; c.aldeanos = gente[c.id] || 0; c.guerreros = guerreros[c.id] || 0; c.armados = armados[c.id] || 0; c.comerciantes = comerciantes[c.id] || 0; c.camas = Math.round(camas[c.id] || 0) + 2;
      const e = edif[c.id] || {}; c.torres = e[OBRA.torre] || 0; c.cuarteles = e[OBRA.cuartel] || 0; c.arquerias = e[OBRA.arqueria] || 0; c.castillos = e[OBRA.castillo] || 0; c.templos = e[OBRA.templo] || 0; c.saberes = e[OBRA.saber] || 0; c.molinos = e[OBRA.molino] || 0; c.puertos = e[OBRA.puerto] || 0;
      c.metal = c.metal || 0; c.oro = c.oro == null ? 10 : c.oro;
      c.madera = c.madera || 0; c.piedra = c.piedra || 0;
      // El nivel del asentamiento (campamento, aldea, pueblo, villa, ciudad), que abre edificios nuevos.
      if (c.viva) {
        const n = M.nivelDe(c.aldeanos || 0);
        if (c.nivelMax == null) c.nivelMax = n;
        if (n > c.nivelMax) {
          c.nivelMax = n;
          const N = M.NIVELES[n];
          (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '★ ' + c.nombre + ' ya es ' + (n === 1 ? 'una aldea' : n === 2 ? 'un pueblo' : n === 3 ? 'una villa' : 'una ciudad') });
          if (c.jugador || n >= 3) S().cronica(m, 'nivel', c.nombre + ' ya es ' + (n === 1 ? 'una aldea' : n === 2 ? 'un pueblo' : n === 3 ? 'una villa' : 'una ciudad'), 'Con ' + c.aldeanos + ' vecinos, lo que fue un campamento de chozas tiene ahora nombre de ' + N.nombre.toLowerCase() + '. Se pueden levantar: ' + N.abre + '.', c, c.capital);
        }
        c.nivel = Math.max(n, Math.min(c.nivelMax, n + 1));
      }
      c.pozos = e[OBRA.pozo] || 0; c.graneros = e[OBRA.granero] || 0; c.fuentes = e[OBRA.fuente] || 0; c.parques = e[OBRA.parque] || 0; c.palacios = e[OBRA.palacio] || 0; c.centrales = e[OBRA.central] || 0; c.bancos = e[OBRA.banco] || 0; c.fabricas = e[OBRA.fabrica] || 0; c.estaciones = e[OBRA.estacion] || 0; c.hospitales = e[OBRA.hospital] || 0; c.aduanas = aduanas[c.id] || []; c.pozosPetroleo = e[OBRA.petroleo] || 0; c.minasT = minasT[c.id] || []; c.minas = c.minasT.length; c.aerodromos = e[OBRA.aerodromo] || 0;
      necesidades(m, c);
      if (c.viva) planTrincheras(m, c, terrenos(m));
    }
    planUrbano(m);
    // Las fichas de edificios que ya no existen (ruinas viejas o solares reconstruidos) se olvidan al cabo de un
    // tiempo, y cada historia guarda solo lo último: la partida guardada no crece sin fin.
    if (v.edificios && m.turno % 25 === 0) for (const k of Object.keys(v.edificios)) {
      const e = v.edificios[k];
      if (e.historia && e.historia.length > 8) e.historia = e.historia.slice(-8);
      const sigue = v.obra[+k] === e.tipo && e.ruina == null;
      if (sigue) delete e.fin; else if (e.fin == null) e.fin = m.turno; else if (m.turno - e.fin > 200) delete v.edificios[k];
    }
  }

  // ---------- Lo que cuesta una tierra nueva (sim.js) ----------
  // Tres de madera; sin madera, cuatro de piedra; y un pueblo sin árboles cerca levanta adobe: una tierra por turno.
  function tierrasPagables(m, c) {
    return Math.floor((c.madera || 0) / 3) + (c.plan && c.plan.obra ? 0 : Math.floor((c.piedra || 0) / 4)) + (c.arboles ? 0 : 1);
  }
  function pagarTierra(m, c) {
    if (c.madera >= 3) c.madera -= 3;
    else if (c.piedra >= 4 && !(c.plan && c.plan.obra)) c.piedra -= 4;
  }

  // ---------- Poderes del dios sobre la vida ----------
  function incendio(m, c) {
    const v = m.vida;
    let quemados = 0;
    if (!v) return 0;
    // Además de lo que arde en el acto, quedan focos que siguen quemando y saltando los turnos siguientes.
    const cs = S().casillas(m, c);
    for (let k = 0; k < 14 && cs.length; k++) { const r = cs[Math.floor(azar(v) * cs.length)], ts = parcelas(m, r).filter(t => ardible(v, t)); if (ts.length) prender(m, ts[Math.floor(azar(v) * ts.length)], 0, 5); }
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (v.arbol[t] && azar(v) < 0.75) { cambiar(m, 'arbol', t, 0, 0); marcar(m, t, 'ceniza', 8); quemados++; }
      if (v.obra[t] === OBRA.casa && azar(v) < 0.3) cambiar(m, 'obra', t, OBRA.ruina, 0);
      if (v.obra[t] === OBRA.campo && azar(v) < 0.4) cambiar(m, 'obra', t, 0, 0);
    }
    contar(m);
    return quemados;
  }
  function plantar(m, regiones) {
    const v = m.vida;
    let n = 0;
    if (!v) return 0;
    const ter = terrenos(m);
    for (const r of regiones) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.arbol[t] || !(ter[t] in ARBOLES) || azar(v) < 0.25) continue;
      cambiar(m, 'arbol', t, 3, 0); n++;
    }
    contar(m);
    return n;
  }

  /*
   * Lo que un poder del dios le hace a la tierra y a la gente en el acto: aldeanos que mueren, casas que
   * caen, campos que se secan. Devuelve cuántos aldeanos murieron y cuántas obras se perdieron.
   */
  const DANO = {
    plaga: { gente: 0.35 }, hambre: { gente: 0.2, campo: 0.6 }, diluvio: { gente: 0.15, campo: 0.45, casa: 0.2 },
    terremoto: { gente: 0.25, casa: 0.55, campo: 0.2 }, destruir: { gente: 0.7, casa: 0.75, campo: 0.6 }, matar: { gente: 0.5 },
    guerra: {}, incendio: { gente: 0.1 }
  };
  function castigo(m, c, tipo, regiones) {
    const v = m.vida, d = DANO[tipo];
    if (!v || !d || !c) return { muertos: 0, obras: 0 };
    let muertos = 0, obras = 0;
    if (d.gente) {
      const suyos = v.aldeanos.filter(a => a.c === c.id);
      const n = Math.min(suyos.length - 1, Math.round(suyos.length * d.gente));
      const fuera = new Set(suyos.sort((x, y) => x.id % 7 - y.id % 7).slice(0, Math.max(0, n)));
      v.muertos = (v.muertos || []).concat([...fuera].map(a => [a.x, a.y, c.id, tipo]));
      v.aldeanos = v.aldeanos.filter(a => !fuera.has(a));
      muertos = fuera.size;
    }
    for (const r of regiones || S().casillas(m, c)) for (const t of parcelas(m, r)) {
      const o = v.obra[t];
      if (o === OBRA.campo && d.campo && azar(v) < d.campo) { cambiar(m, 'obra', t, 0, 0); obras++; }
      else if (o === OBRA.casa && d.casa && azar(v) < d.casa) { cambiar(m, 'obra', t, OBRA.ruina, 0); obras++; }
    }
    contar(m);
    return { muertos, obras };
  }
  // Pone la vida al día tras un cambio fuera del turno: plazas nuevas, aldeanos según la población.
  function ajustar(m) {
    if (!m.vida) return;
    m.vida.cambios = m.vida.cambios || [];
    centros(m);
    sincronizar(m, null, true);
    for (const a of m.vida.aldeanos) if (!a.r || !a.r.length) a.r = [];
    contar(m);
    actualizarPoblacion(m);
  }

  M.vida = { SUB, TICKS, ADULTO, VIEJO, escala, anos: a => Math.round((a.edad || 0) < ADULTO ? (a.edad || 0) * 8 : 16 + ((a.edad || 0) - ADULTO) * 2.6), OBRA, RANGO_MOLINO, rangoMolino, planUrbano, fase, OFICIOS, ACC, trazar, calles, islas, reasignar, ERUDITO, salud, riesgoAnual, registrar, nombreEdificio, lugarDe, cultivoTipo, regadio, RINDE, aceptarOferta, BIENES, PRECIO_BASE, NOMBRE_BIEN, objetivo, balance, mercado, ERA_OBRA, NOMBRE_ERA, planTrincheras, MAX_TRINCHERA, danoContra, sitioMina, abrirRuta, TIRO, planificarVias, esVia, pasosFronterizos, pasoSinPuesto, subsuelo, quemar, huelgas, enMarcha, contaminacion, bienesDe, sitioPetroleo, GASTO, alumbradoDe, EDIFICABLES, puedeColocar, encargar, COSTES, NIVEL_OBRA, NECESIDADES, necesidades, edificioPendiente, animoDe, topeComida, pausada, esNoche, estacion, ESTACIONES, DIA_TURNOS, ESTACION_TURNOS, mover, cambiar, prender, inundar, marcar, MARCA, ARMAS, TIROS, ARMADURAS, VEHICULOS, armaduraDeEra, armaDe, poder, vidaMax, reparto, crear, turno, terrenos, region, centro, parcelas, plaza, contar, tierrasPagables, pagarTierra, incendio, plantar, castigo, ajustar };
})(globalThis.RF = globalThis.RF || {});
