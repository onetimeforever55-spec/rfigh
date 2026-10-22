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
  'use strict';
  const M = RF.MUNDO;
  const S = () => M.sim;
  const SUB = 4, TICKS = 8, MAX_ALDEANOS = 1600;
  // La vida de un aldeano, en turnos: niño hasta ADULTO, anciano desde VIEJO, y muere de viejo hacia el final.
  const ADULTO = 2, VIEJO = 18;
  const limiteVida = a => 22 + (a.id % 12) + (a.rasgos && a.rasgos.includes('longevo') ? 8 : 0);
  const esNino = a => (a.edad || 0) < ADULTO;
  const OBRA = { nada: 0, casa: 1, campo: 2, centro: 3, ruina: 4, ayuntamiento: 5, torre: 6, templo: 7, molino: 8, puerto: 9, cuartel: 10, arqueria: 11, castillo: 12, saber: 13, pozo: 14, granero: 15, fuente: 16, parque: 17, palacio: 18, central: 19, banco: 20, fabrica: 21, estacion: 22, hospital: 23, aerodromo: 24, campamento: 25, aduana: 26, petroleo: 27, mina: 28, gremio: 29, casona: 30, bancopriv: 31, muelle: 32, minapriv: 33, inmopriv: 34 };
  // Hasta dónde llegan los campos de un molino (parcelas): más allá no se ara.
  const RANGO_MOLINO = 4;
  // En las partidas pausadas el molino alcanza menos (un rango medio): hacen falta varios molinos repartidos
  // por la huerta, y sin molino cerca no hay tierra que arar.
  const rangoMolino = m => ((m.ritmo || 1) > 1 && !m.sinVidaPausada ? 3 : RANGO_MOLINO);
  const CAMPOS_POR_MOLINO = 10;
  const fase = era => (era <= 1 ? 0 : era <= 4 ? 1 : era <= 6 ? 2 : 3);
  // Los edificios de los mercaderes cambian en sus propias eras (no con las fases generales): el gremio pasa a compañía con
  // la industrialización y a sede de oficinas en la Era Moderna; el banco privado, a torre; el muelle, de madera a piedra,
  // dársena y terminal; la casona, a palacete y mansión. ETAPAS: las eras en que cambian.
  const ETAPAS = { 29: [6, 7], 31: [6, 7], 32: [5, 6, 7], 30: [5, 6] }; // gremio, bancopriv, muelle, casona
  const etapa = (o, era) => { const l = ETAPAS[o]; if (!l) return fase(era); let k = 0; for (const e of l) if (era >= e) k++; return k; };
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
    tanque: { nombre: 'tanque', vida: 520, blindaje: 0.8, dano: 62, perfora: 0.85, alcance: 4, metal: 8, era: 7 }
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
    const zanja = cubierto(v, vic.y * v.tw + vic.x) ? 0.6 : 1;
    return Math.max(1, Math.round(d * zanja * (1 - reduce * (1 - (arma.perfora || 0)))));
  }
  // A cubierto: en una trinchera o sobre una muralla (o empalizada) en pie.
  const cubierto = (v, t) => !!((v.trinchera && v.trinchera[t]) || (v.muro && v.muro[t] > 0));
  // ¿Acierta? Los rápidos aciertan más, los torpes menos, y un escudo para algunos golpes.
  const acierta = (v, at, vic) => azar(v) < 0.62 + (tieneR(at, 'rapido') || tieneR(at, 'rápido') ? 0.1 : 0) - (tieneR(at, 'torpe') ? 0.1 : 0) - ((vic.o === GUERRERO && ARMAS[vic.arma || 0].bloqueo) || 0) - (cubierto(v, vic.y * v.tw + vic.x) ? 0.2 : 0);
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
  // La electricidad mueve las máquinas: con una central en marcha, la forja y las fábricas sacan un 50 % más.
  const fuerza = c => (c.era >= 7 && (c.centrales || 0) > 0 && enMarcha(c, 'central') ? 1.5 : 1);
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
    // (Los salarios de los obreros: por debajo de lo normal dan malestar; por encima, lo calman.)
    const sal = (c.plan && c.plan.salario) || 1;
    const malestar = Math.max(0, (40 - c.estab) / 40) + (imp > 1.2 ? 0.35 : 0) + contaminacion(c) * 0.8 + ((c.comida || 0) < hab * 0.3 ? 0.35 : 0) + (sal < 1 ? (1 - sal) * 1.5 : -(sal - 1) * 0.5);
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
