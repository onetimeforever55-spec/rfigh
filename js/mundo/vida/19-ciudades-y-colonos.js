  // ── GÉNESIS · LA VIDA · Las ciudades, sus fases, abandonos, colonos y expediciones ──

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
        x.de = x.civ; x.civ = d; x.alcalde = persona(v); x.rasgo = ['leal', 'ambicioso', 'codicioso', 'tranquilo'][Math.floor(azar(v) * 4)]; x.conquistada = m.turno;
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
      if (sitio.length > 6) { const a = sitio[Math.floor(azar(v) * sitio.length)]; a.colono = x.region; if (a.obrero != null) { delete a.obrero; a.enFabrica = 0; } a.e = LIBRE; a.paseo = 0; a.edificio = 0; a.obraCamino = 0; if (a.o !== CONSTRUCTOR && casas < 2 && azar(v) < 0.5) mover(a, CONSTRUCTOR); }
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
    const v = m.vida, ter = terrenos(m), masa = masaDe(m);
    expediciones(m);
    for (const c of S().vivas(m)) {
      const enCamino = v.aldeanos.filter(a => a.c === c.id && a.colono != null);
      if (v.expediciones && v.expediciones[c.id]) continue;
      if (enCamino.length) {
        // Si otro reino se queda antes la tierra a la que iban (y no es una ciudad suya que crece), vuelven a casa.
        const r0 = enCamino[0].colono;
        if (m.dueno[r0] >= 0 && m.dueno[r0] !== c.id && !(m.ciudades || []).some(x => x.region === r0 && x.civ === c.id)) {
          for (const a of enCamino) if (a.colono === r0) { a.colono = null; a.porMar = 0; }
          if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: r0, texto: '🏕 ' + ((S().civ(m, m.dueno[r0]) || {}).nombre || 'Otro reino') + ' se quedó esa tierra antes de que llegaran tus colonos' });
        }
        continue;
      }
      const suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
      const lleno = (c.sinCama || 0) > 0 || (c.cap && c.pob > c.cap * 0.5);
      // El jugador puede mandar colonos aunque el pueblo no esté lleno (y hacia donde diga, o al sitio exacto
      // que haya tocado en el mapa con «Fundar pueblo»).
      const pedido = c.plan && c.plan.colonos;
      const sitio = typeof pedido === 'number' ? pedido : null;
      if (sitio != null) {
        const no = razonColonia(m, c, sitio);
        if (no) { c.plan.colonos = null; if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: sitio, texto: '🏕 No se puede fundar allí: ' + no }); continue; }
      }
      // (Lo que se llevan los colonos para el viaje y el primer invierno: sin eso, no salen.)
      if ((!lleno && !pedido) || suyas >= S().maxCiudades(c, m) || (pausada(m) && !puedeColonia(c)) || m.turno - (c.ultimaColonia || -99) < (pedido ? 1 : 4)) continue;
      // Sin tope de ciudades, pero la IA no funda otra hasta que las que tiene ya tienen vecinos (ocho o más):
      // un reino no se desparrama en campamentos. (El jugador funda cuando quiere, si tiene con qué.)
      if (pausada(m) && !pedido && !c.jugador) {
        const mias = (m.ciudades || []).filter(x => x.civ === c.id);
        const vecinos = x => v.aldeanos.reduce((n, a) => n + (a.c === c.id && a.h === x.region ? 1 : 0), 0);
        if (m.turno - (c.ultimaColonia || -99) < 6 || mias.some(x => vecinos(x) < 8)) continue;
      }
      const propias = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
      const conPuerto = (c.puertos || 0) > 0;
      const destino = [];
      if (sitio != null) destino.push([sitio, 0]);
      else for (let r = 0; r < m.W * m.H; r++) {
        if (m.dueno[r] >= 0 || !S().esTierra(m, r) || S().fertil(m, r) < 2 || m.tipo[r] === 'nieve') continue;
        if (S().vecinos(r).some(w => m.dueno[w] >= 0 && m.dueno[w] !== c.id)) continue;
        if (!ter[centro(m, r)] || !andable(ter[centro(m, r)])) continue;
        // Andando solo se llega a la misma tierra (continente o isla); al otro lado del mar, en barco desde un puerto.
        const andando = propias.some(p => masa[p] === masa[r]);
        const d = Math.min(...propias.map(p => S().distancia(p, r)));
        if (andando ? d < 4 || d > 12 : !conPuerto || d < 3 || d > 26 || !S().vecinos(r).some(w => m.tipo[w] === 'costa' || m.tipo[w] === 'mar')) continue;
        const rx = r % m.W - c.capital % m.W, ry = Math.floor(r / m.W) - Math.floor(c.capital / m.W);
        const fuera = pedido === 'norte' ? ry >= 0 : pedido === 'sur' ? ry <= 0 : pedido === 'este' ? rx <= 0 : pedido === 'oeste' ? rx >= 0 : pedido === 'costa' ? !S().vecinos(r).some(w => m.tipo[w] === 'costa' || m.tipo[w] === 'mar') : false;
        destino.push([r, (andando ? d : 4 + d * 0.6) - S().fertil(m, r) * 0.8 + azar(v) * 2 + (fuera ? 30 : 0)]);
      }
      if (!destino.length) continue;
      destino.sort((p, q) => p[1] - q[1]);
      let r = null, via = null;
      for (const [q] of destino.slice(0, 4)) { const w = viaColonia(m, c, q, true); if (w) { r = q; via = w; break; } }
      if (via == null) { if (sitio != null) c.plan.colonos = null; continue; }
      // Por mar hace falta un barco: cuesta algo de madera.
      if (via.mar && (c.madera || 0) < 8) continue;
      const deTierra = via.mar ? masa[region(m, via.mar.puerto)] : masa[r];
      // Salen los adultos más jóvenes (los que aguantan el viaje y tendrán hijos en la tierra nueva).
      const elegidos = v.aldeanos.filter(a => a.c === c.id && !esNino(a) && (a.edad || 0) < VIEJO && a.o !== GUERRERO && !a.k && a.e !== VIAJAR && a.aBordo == null && masa[region(m, a.y * v.tw + a.x)] === deTierra).sort((x, y) => (x.edad || 0) - (y.edad || 0)).slice(0, 3);
      if (elegidos.length < 2) continue;
      c.ultimaColonia = m.turno; if (pausada(m)) { c.comida -= COSTE_COLONIA.comida; c.madera -= COSTE_COLONIA.madera; }
      if (pedido) c.plan.colonos = null;
      for (const a of elegidos) { if (a.obrero != null) { delete a.obrero; a.enFabrica = 0; } // (quien se va de colono deja la fábrica)
        a.colono = r; a.e = LIBRE; a.paseo = 0; a.edificio = 0; a.obraCamino = 0; if (via.mar) a.porMar = 1; }
      if (via.mar) {
        c.madera -= 8;
        (v.expediciones = v.expediciones || {})[c.id] = Object.assign({ r, fase: 'reunion', desde: m.turno }, via.mar);
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: region(m, via.mar.puerto), texto: '⛵ ' + elegidos.length + ' colonos van al puerto para cruzar el mar' });
      } else if (c.jugador && sitio != null) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: r, texto: '🏕 ' + elegidos.length + ' colonos salen a fundar un pueblo' });
    }
  }
  // Las masas de tierra (continentes e islas), por región: a una tierra de otra masa solo se llega en barco.
  let masas = { mundo: null, vez: -1, id: null };
  function masaDe(m) {
    const vez = Math.floor(m.turno / 50);
    if (masas.mundo === m && masas.vez === vez) return masas.id;
    const n = m.W * m.H, id = new Int32Array(n).fill(-1); let k = 0;
    for (let i = 0; i < n; i++) {
      if (id[i] >= 0 || !S().esTierra(m, i)) continue;
      const cola = [i]; id[i] = k;
      for (let j = 0; j < cola.length; j++) for (const w of S().vecinos(cola[j])) if (id[w] < 0 && S().esTierra(m, w)) { id[w] = k; cola.push(w); }
      k++;
    }
    masas = { mundo: m, vez, id };
    return id;
  }
  const puertosDe = (m, c) => { const v = m.vida, out = []; for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.puerto && m.dueno[region(m, t)] === c.id) out.push(t); return out; };
  // Cómo se llega a fundar en la región r: { tierra } andando, { mar } en barco (con la ruta si conRuta), o null.
  function viaColonia(m, c, r, conRuta) {
    const masa = masaDe(m), ter = terrenos(m);
    const propias = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    const origen = propias.find(p => masa[p] === masa[r]);
    if (origen != null) return { tierra: origen };
    const costa = parcelas(m, r).find(t => andable(ter[t]) && !navegable(ter, t) && aguaJunto(m, t, ter) != null);
    if (costa == null) return null;
    const mr = maresDe(m, ter), a = aguaJunto(m, costa, ter);
    const puertos = puertosDe(m, c).map(t => [t, aguaJunto(m, t, ter)]).filter(([, w]) => w != null && mr.comp[w] === mr.comp[a]).sort((p, q) => dist(m, p[0], costa) - dist(m, q[0], costa));
    if (!puertos.length) return null;
    if (!conRuta) return { mar: true };
    if (travesias.mundo !== m) travesias = { mundo: m };
    for (const [p, de] of puertos.slice(0, 2)) {
      const clave = de + '>' + a; if (!(clave in travesias)) travesias[clave] = rutaPorMar(m, de, a, ter);
      const ruta = travesias[clave];
      if (ruta && ruta.length > 1) return { mar: { puerto: p, de, a, tierra: costa, ruta } };
    }
    return null;
  }
  // Por qué no se puede fundar un pueblo en la región r (o null si se puede): lo usa el botón «Fundar pueblo».
  function razonColonia(m, c, r) {
    const ter = terrenos(m);
    if (!c || !c.viva) return 'no tienes pueblo';
    if (r < 0 || r >= m.W * m.H || !S().esTierra(m, r)) return 'eso es agua';
    if (m.dueno[r] === c.id) return 'esa tierra ya es tuya';
    if (m.dueno[r] >= 0) return 'esa tierra es de ' + ((S().civ(m, m.dueno[r]) || {}).nombre || 'otro reino');
    if (m.tipo[r] === 'nieve') return 'hace demasiado frío para vivir';
    if (S().fertil(m, r) < 1) return 'tierra yerma: no daría de comer';
    if (!ter[centro(m, r)] || !andable(ter[centro(m, r)])) return 'ahí no se puede acampar';
    if (S().vecinos(r).some(w => m.dueno[w] >= 0 && m.dueno[w] !== c.id)) return 'demasiado cerca de otro reino';
    const propias = [c.capital, ...(m.ciudades || []).filter(x => x.civ === c.id).map(x => x.region)];
    const lejos = Math.min(...propias.map(p => S().distancia(p, r)));
    if (lejos < 3) return 'demasiado cerca de tus pueblos';
    const andando = propias.some(p => masaDe(m)[p] === masaDe(m)[r]);
    if (lejos > (andando ? 14 : 28)) return 'demasiado lejos ' + (andando ? 'para ir andando' : 'para cruzar el mar') + ' (' + lejos + ' tierras; como mucho ' + (andando ? 14 : 28) + ')';
    const suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
    if (suyas >= S().maxCiudades(c, m)) return 'ya tienes ' + suyas + ' ciudades (en esta era, como mucho ' + S().maxCiudades(c, m) + ')';
    if (pausada(m) && !puedeColonia(c)) return 'los colonos necesitan ' + COSTE_COLONIA.comida + ' de comida y ' + COSTE_COLONIA.madera + ' de madera para el viaje (tenéis ' + Math.floor(c.comida || 0) + ' y ' + Math.floor(c.madera || 0) + ')';
    const via = viaColonia(m, c, r, false);
    if (!via) return (c.puertos || 0) > 0 ? 'no se llega: ningún puerto tuyo da a ese mar' : 'está al otro lado del mar: hace falta un puerto';
    return null;
  }
  // Los colonos que cruzan el mar: se reúnen en el puerto, embarcan en un barco, cruzan y desembarcan en la costa;
  // de ahí siguen andando hasta su tierra nueva. Si hunden el barco, se ahogan.
  // La tierra más cercana a una casilla (para quien se queda sin barco en el mar): en espiral, hasta 40 casillas.
  // Lo que se llevan tres familias que salen a fundar una aldea (sin tope de ciudades: solo hace falta esto).
  const COSTE_COLONIA = { comida: 20, madera: 10 };
  const puedeColonia = c => (c.comida || 0) >= COSTE_COLONIA.comida + 10 && (c.madera || 0) >= COSTE_COLONIA.madera;
  function tierraCerca(m, x0, y0) {
    const v = m.vida, ter = terrenos(m);
    for (let r = 0; r <= 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= v.tw || y >= v.th) continue;
      const t = y * v.tw + x; if (ter[t] !== 'agua' && ter[t] !== 'bajo') return t;
    }
    return null;
  }
  // Bajar a alguien de un barco: nunca en alta mar, sino en la tierra más cercana.
  function desembarcar(m, a) {
    const v = m.vida, ter = terrenos(m), t0 = a.y * v.tw + a.x;
    a.aBordo = null; a.e = LIBRE;
    // (Si el barco iba por alta mar, fuera del mapa, vuelve a su casa o a la capital de su reino.)
    if (a.x < 0 || a.y < 0 || a.x >= v.tw || a.y >= v.th) { const c = S().civ(m, a.c), t = a.casa != null ? a.casa : c && c.capital != null ? centro(m, c.capital) : null; if (t != null) { a.x = t % v.tw; a.y = t / v.tw | 0; } return; }
    if (ter[t0] === 'agua' || ter[t0] === 'bajo') { const t = tierraCerca(m, a.x, a.y); if (t != null) { a.x = t % v.tw; a.y = t / v.tw | 0; } }
  }
  function expediciones(m) {
    const v = m.vida;
    if (!v.expediciones) return;
    for (const id of Object.keys(v.expediciones)) {
      const x = v.expediciones[id], c = S().civ(m, +id);
      const gente = v.aldeanos.filter(a => a.c === +id && a.colono === x.r);
      const barco = v.barcos.find(b => b.id === x.barco && !b.hundido);
      const cancelar = () => { for (const a of gente) { a.colono = null; a.porMar = 0; if (a.aBordo != null) desembarcar(m, a); } if (barco) barco.pv = 0; delete v.expediciones[id]; };
      // (Ya en el mar, perder el puerto de salida no la cancela: el barco sigue su viaje.)
      if (!c || !c.viva || !gente.length || (x.fase !== 'travesia' && ((m.dueno[x.r] >= 0 && x.fase === 'reunion') || v.obra[x.puerto] !== OBRA.puerto || m.dueno[region(m, x.puerto)] !== +id))) { cancelar(); continue; }
      if (x.fase === 'travesia') { if (!barco) { for (const a of gente) if (a.aBordo == null) { a.colono = null; a.porMar = 0; } delete v.expediciones[id]; } continue; }
      // En el puerto espera el barco; los que ya han llegado suben a bordo.
      let b = barco;
      if (!b) { b = { id: v.sig++, tipo: 'transporte', colonia: 1, c: +id, puerto: x.puerto, x: x.de % v.tw, y: x.de / v.tw | 0, ruta: x.ruta, i: 0, vuelta: 0, r: [], pv: PV_BARCO.transporte, estado: 'espera', tierra: x.tierra }; v.barcos.push(b); x.barco = b.id; }
      for (const a of gente) if (a.aBordo == null && dist(m, a.y * v.tw + a.x, x.puerto) <= 3) { a.aBordo = b.id; a.x = b.x; a.y = b.y; a.e = ESPERAR; a.t = 2; }
      const aBordo = gente.filter(a => a.aBordo === b.id).length;
      if (aBordo && (aBordo === gente.length || m.turno - x.desde >= 8)) {
        // Los rezagados se quedan en casa.
        for (const a of gente) if (a.aBordo == null) { a.colono = null; a.porMar = 0; }
        b.estado = 'zarpa'; b.ruta = x.ruta; b.i = 0; x.fase = 'travesia';
        if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: region(m, x.puerto), texto: '⛵ Zarpa un barco con ' + aBordo + ' colonos' });
      } else if (!aBordo && m.turno - x.desde > 20) cancelar();
    }
  }
  // Un colono llega a su destino: si la tierra sigue libre, funda la aldea; si no, vuelve a casa.
  function fundar(m, a, c) {
    const v = m.vida, r = a.colono;
    const yaFundada = (m.ciudades || []).find(x => x.region === r && x.civ === c.id);
    // Si mientras iban la tierra pasó a otro reino, vuelven; si pasó a ser suya (su reino creció hasta allí), fundan igual.
    if (!yaFundada && m.dueno[r] >= 0 && m.dueno[r] !== c.id) { for (const b of v.aldeanos) if (b.colono === r && b.c === c.id) b.colono = null; if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, region: r, texto: '🏕 ' + ((S().civ(m, m.dueno[r]) || {}).nombre || 'Otro reino') + ' se quedó esa tierra antes de que llegaran tus colonos' }); return; }
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
