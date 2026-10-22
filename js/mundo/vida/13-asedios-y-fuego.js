  // ── GÉNESIS · LA VIDA · El asedio, el fuego y el agua, los aviones y las torres ──

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
  // El saqueo se ve en el suelo: casas tiznadas y reventadas, ceniza y escombros por las calles.
  function saquear(m, r) {
    const v = m.vida, ts = parcelas(m, r).concat(S().vecinos(r).filter(x => m.dueno[x] === m.dueno[r]).flatMap(x => parcelas(m, x)));
    // Las casas quedan tiznadas y reventadas (no arrasadas: el saqueador quiere el botín, no la ciudad).
    const casas = ts.filter(t => v.obra[t] === OBRA.casa);
    v.danoObra = v.danoObra || {};
    for (let k = 0; k < Math.min(4, casas.length); k++) { const t = casas[Math.floor(azar(v) * casas.length)]; v.danoObra[t] = Math.max(v.danoObra[t] || 0, 40); marcar(m, t, 'ceniza', 8, 0); }
    for (let k = 0; k < 6; k++) { const t = ts[Math.floor(azar(v) * ts.length)]; if (t != null && !v.obra[t]) marcar(m, t, 'escombros', 10, 0); }
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
    // Tomar una ciudad (no la capital: esa la saquea la caída de la corte) también es saquearla.
    if (!esCapital && ciudad) {
      for (const k of ['oro', 'comida', 'metal', 'armas']) { const q = (o[k] || 0) * 0.2; if (q > 0) { o[k] -= q; c[k] = (c[k] || 0) + q; } }
      saquear(m, r);
      S().suceso(m, 'saqueo', r, c, o, '💰 ¡' + c.nombre + ' saquea ' + ciudad.nombre + '!');
    }
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
  // (El árbol quemado queda en pie: tronco negro sin ramas sobre la ceniza; al cabo de un tiempo rebrota o cae. Y la
  // tierra quemada no vuelve a ser hierba de golpe: queda chamuscada y la hierba sale poco a poco.)
  const MARCA = { ceniza: 1, crater: 2, sangre: 3, escombros: 4, tronco: 5, chamuscado: 6 };
  const SUELO_QUEMADO = new Set([1, 5, 6]);
  const ardible = (v, t) => v.arbol[t] >= 1 || (v.obra[t] && v.obra[t] !== OBRA.ruina && v.obra[t] !== OBRA.puerto);
  function marcar(m, t, tipo, turnos, paso, dato) {
    const v = m.vida, mk = v.marcas = v.marcas || {};
    const ya = mk[t];
    if (ya && ya[0] === MARCA.crater && tipo !== 'crater') return;
    mk[t] = dato != null ? [MARCA[tipo], m.turno + turnos, dato] : [MARCA[tipo], m.turno + turnos];
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
    const v = m.vida, tam = v.arbol[t] || 0;
    if (tam >= 1) cambiar(m, 'arbol', t, 0, paso);
    const o = v.obra[t];
    if (o === OBRA.campo) { cambiar(m, 'obra', t, 0, paso); cambiar(m, 'cultivo', t, 0, paso); }
    else if (o && o !== OBRA.ruina) {
      cambiar(m, 'obra', t, OBRA.ruina, paso);
      if (v.torres && v.torres[t] != null) delete v.torres[t];
      marcar(m, t, 'escombros', 10, paso);
    }
    // Donde había un árbol queda su tronco quemado (con su ceniza alrededor); si no, solo la ceniza.
    if (tam >= 1 && !(o && o !== OBRA.campo)) marcar(m, t, 'tronco', 30, paso, tam); else marcar(m, t, 'ceniza', 8, paso);
  }
  // Un paso del fuego: arde, salta, quema a quien esté dentro, y la gente lo apaga.
  let pozosVistos = { m: null, turno: -1, set: null };
  function comarcasConPozo(m) {
    if (pozosVistos.m === m && pozosVistos.turno === m.turno) return pozosVistos.set;
    const v = m.vida, set = new Set();
    for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.pozo) { const r = region(m, t); set.add(r); for (const n of S().vecinos(r)) set.add(n); }
    pozosVistos = { m, turno: m.turno, set };
    return set;
  }
  function arder(m, paso, gente) {
    const v = m.vida;
    if (!v.fuego) return;
    const claves = Object.keys(v.fuego);
    if (!claves.length) return;
    const ter = terrenos(m), tw = v.tw, mucho = claves.length > 500, conPozo = comarcasConPozo(m);
    const humedo = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.comida > 1.2 && e.hasta > m.turno)).map(c => c.id)); // diluvio reciente
    const seco = new Set(S().vivas(m).filter(c => c.efectos.some(e => e.sequia)).map(c => c.id));
    const nuevos = [];
    for (const k of claves) {
      const t = +k, r = region(m, t), dueno = m.dueno[r];
      if (!ardible(v, t) || (v.inundado && v.inundado[t]) || humedo.has(dueno)) { apagar(m, t, paso); continue; }
      // Los vecinos acuden con cubos: cuanta más gente en la comarca, antes se apaga (en sequía, peor).
      // Con un pozo cerca (en la comarca o al lado), hay agua a mano: los cubos van y vienen el doble de rápido.
      const cubos = Math.min(0.3, 0.012 * (gente.get(r) || 0)) * (seco.has(dueno) ? 0.5 : 1) * (conPozo.has(r) ? 2 : 1);
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
    // Las marcas se borran con el tiempo. La ceniza y el tronco quemado dejan tierra chamuscada (y la hierba vuelve
    // poco a poco); el tronco, cuatro de cada diez veces, rebrota en un arbolito. (Sin tirar dados: así no cambia nada más.)
    const terM = terrenos(m);
    for (const k of Object.keys(v.marcas || {})) {
      const mk = v.marcas[k]; if (mk[1] > m.turno) continue;
      const t = +k, tipo = mk[0];
      delete v.marcas[k];
      if (tipo !== MARCA.ceniza && tipo !== MARCA.tronco) continue;
      if (v.obra[t] || v.arbol[t] || v.camino[t]) continue;
      const rebrota = tipo === MARCA.tronco && (ARBOLES[terM[t]] || 0) > 0.05 && ((t * 2654435761 + m.turno * 40503) >>> 0) % 100 < 40;
      if (rebrota) cambiar(m, 'arbol', t, 1, 0);
      else v.marcas[k] = [MARCA.chamuscado, m.turno + 24];
    }
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
    if (!AVIACION) return;
    for (const c of S().vivas(m)) {
      // Desde la Era Moderna (biplanos) y en la II Guerra Mundial (bombarderos), con un aeródromo y combustible.
      // (Con aviones comprados a la fundición no gasta metal y salen más; si no, los improvisa con 2 de metal.)
      const flota = Math.floor(c.aviones || 0);
      if (c.era < 7 || !c.guerras.length || (!flota && (c.metal || 0) < 2) || azar(v) > 0.7 || (pausada(m) && (!(c.aerodromos > 0) || (c.petroleo || 0) + (c.carbon || 0) < 2))) continue;
      if (pausada(m)) { if ((c.petroleo || 0) >= 2) c.petroleo -= 2; else c.carbon -= 2; }
      const e = v.ejercitos[c.id];
      const hacia = e ? centro(m, e.defiende != null ? e.defiende : e.obj) : null;
      const enemigo = b => c.guerras.some(g => g.con === b.c);
      // Primero, los soldados enemigos cerca del frente; si no, cualquiera; y si no hay soldados, sus ciudades.
      let blancos = v.aldeanos.filter(b => b.o === GUERRERO && enemigo(b) && (hacia == null || dist(m, b.y * v.tw + b.x, hacia) <= 14));
      if (!blancos.length) blancos = v.aldeanos.filter(b => b.o === GUERRERO && enemigo(b));
      if (!blancos.length) for (const g of c.guerras) { const o = S().civ(m, g.con); if (!o || !o.viva) continue; const t = centro(m, o.capital); blancos = parcelas(m, o.capital).filter(u => v.obra[u] && v.obra[u] !== OBRA.ruina).map(u => ({ x: u % v.tw, y: u / v.tw | 0 })); if (!blancos.length) blancos = [{ x: t % v.tw, y: t / v.tw | 0 }]; break; }
      if (!blancos.length) continue;
      if (!flota) c.metal -= 2;
      const base = (v.obra || []).findIndex((o, t) => o === OBRA.aerodromo && m.dueno[region(m, t)] === c.id);
      const cap = base >= 0 ? base : centro(m, c.capital), cx = cap % v.tw, cy = cap / v.tw | 0;
      const pasadas = Math.min(3 + Math.min(2, flota), 1 + Math.floor(blancos.length / 10) + (c.era >= 8 ? 1 : 0) + Math.min(2, flota));
      // (La defensa enemiga a veces derriba uno.)
      if (flota && azar(v) < 0.12) { c.aviones = flota - 1; if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '✈ El enemigo derriba uno de nuestros aviones (quedan ' + c.aviones + ')' }); }
      for (let q = 0; q < pasadas; q++) {
        const b = blancos[Math.floor(azar(v) * blancos.length)];
        v.aviones.push([cx, cy, b.x, b.y, paso + q * 0.7, c.id, c.era >= 8 ? 1 : 0]);
        // Las bombas caen cuando el avión llega sobre el blanco (tarda unos tres pasos en cruzar).
        const cae = paso + q * 0.7 + VUELO;
        for (let k = 0; k < (c.era >= 8 ? 3 : 2); k++) {
          const bx = b.x + Math.round((azar(v) - 0.5) * 3), by = b.y + Math.round((azar(v) - 0.5) * 3);
          v.disparos.push([bx, by - 5, bx, by, cae - 1 + k * 0.15, 3]);
          // La bomba arrasa lo que hay: cráter, casas en ruinas, árboles arrancados y fuego.
          const tb = by * v.tw + bx;
          if (tb >= 0 && tb < v.obra.length) estallido(m, c, tb, 1.5, c.era >= 8 ? 70 : 45, cae, null, 'bomba', null);
        }
      }
      if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '✈ Despegan ' + pasadas + (pasadas === 1 ? ' avión' : ' aviones') + ' a bombardear al enemigo' });
    }
  }
  const VUELO = 3;


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
        for (const b of lista) if (c.guerras.some(g => g.con === b.c)) { blancos.push(b); if (Math.abs(dx) + Math.abs(dy) <= 1) cerca += b.veh === 'tanque' ? 4 : 1; }
      }
      if (blancos.length) {
        // Los arqueros de las almenas: el castillo suelta varias flechas por paso (la torre, una o dos), cada una a
        // un blanco; desde la pólvora, además, su cañón o su ametralladora.
        const f = fase(c.era), arm = b => b.veh ? { reduce: VEHICULOS[b.veh].blindaje || 0 } : ARMADURAS[b.armadura || 0] || ARMADURAS[0];
        const disparo = (b, tiro, bala) => {
          v.disparos.push([tx, ty, b.x, b.y, paso, bala ? 1 : 0]);
          if (azar(v) < (enTrinchera(v, b) ? 0.3 : 0.5) && golpear(v, null, b, Math.max(1, Math.round(tiro.dano * (0.8 + azar(v) * 0.4) * (enTrinchera(v, b) ? 0.6 : 1) * (1 - arm(b).reduce * (1 - (tiro.perfora || 0))))), paso + 0.5, tx, ty)) {
            v.aldeanos = v.aldeanos.filter(a => a !== b); v.muertos.push([b.x, b.y, b.c, 'torre', paso + 0.5, b]); apuntarBaja(m, c.id, b);
            const i = blancos.indexOf(b); if (i >= 0) blancos.splice(i, 1);
          }
        };
        // Desde la pólvora, los defensores de las almenas ya no tiran flechas: disparan arcabuces, mosquetes y
        // rifles (balas con fogonazo y humo); en la Era Moderna, fusiles de repetición.
        const fuego = f >= 2, flechas = castillo ? 2 + (f >= 3 ? 1 : 0) : 1 + (f >= 3 ? 1 : 0);
        const flecha = fuego ? { dano: (castillo ? 30 : 24) + (f >= 3 ? 8 : 0), perfora: f >= 3 ? 0.65 : 0.5 } : { dano: castillo ? 14 : 11, perfora: f >= 1 ? 0.1 : 0 };
        for (let q = 0; q < flechas && blancos.length; q++) if (azar(v) < 0.7) disparo(blancos[Math.floor(azar(v) * blancos.length)], flecha, fuego);
        if (f >= 2 && blancos.length && azar(v) < (castillo ? 0.45 : 0.25)) disparo(blancos[0], f === 2 ? { dano: castillo ? 40 : 30, perfora: 0.6 } : { dano: castillo ? 48 : 40, perfora: 0.7 }, true);
      }
      if (cerca) { v.torres[k] -= cerca * 0.4; if (v.torres[k] <= 0) { cambiar(m, 'obra', t, OBRA.ruina, paso); delete v.torres[k]; } }
    }
  }
