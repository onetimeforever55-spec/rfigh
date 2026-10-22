  // ── GÉNESIS · EL PINTOR · Pintar el suelo, los caminos y el territorio ──

  // ---------- Pintar el suelo y las obras ----------
  let subVisto = 0;
  function mundo(nuevo, enfocar) {
    m = nuevo; regionDe = null; gente = null;
    if (!m.vida) V.crear(m);
    const v = m.vida;
    if (g && g.olvidar) { if (lienzo) g.olvidar(lienzo); if (capa) g.olvidar(capa); }
    lienzo = document.createElement('canvas'); lienzo.width = v.tw * A; lienzo.height = v.th * A; gl = lienzo.getContext('2d');
    capa = document.createElement('canvas'); capa.width = v.tw * CA; capa.height = v.th * CA; gc = capa.getContext('2d');
    subVisto = v.subsueloVer || 0;
    visto = { arbol: v.arbol.slice(), roca: v.roca.slice(), obra: v.obra.slice(), cultivo: (v.cultivo || []).slice(), camino: (v.camino || []).slice() };
    tierra = V.terrenos(m).slice();
    pend = [];
    firma = firmas();
    for (let t = 0; t < v.tw * v.th; t++) parcela(t);
    territorio();
    listo = true;
    if (enfocar !== false) enfocarInicio();
  }
  function enfocarInicio() {
    const vivas = S.vivas(m).slice().sort((a, b) => S.casillas(m, b).length - S.casillas(m, a).length);
    cam.z = Math.max(zMin(), 1.5);
    if (vivas[0]) centrarEn(vivas[0].capital); else { cam.x = ancho() / 2; cam.y = alto() / 2; }
    limitar();
  }
  function firmas() {
    const out = [];
    for (let r = 0; r < m.W * m.H; r++) { const c = m.dueno[r] >= 0 ? S.civ(m, m.dueno[r]) : null; out.push(c ? c.id + ':' + grupoEra(c.era) : '-'); }
    return out;
  }

  function parcela(t) {
    const v = m.vida, x = (t % v.tw) * A, y = Math.floor(t / v.tw) * A, ter = tierra[t], h = (Math.imul(t, 2654435761) >>> 0);
    // (Con la tarjeta gráfica, se vuelve a subir solo esta parcela y las de al lado, por si el dibujo se sale.)
    if (g && g.sucio) g.sucio(lienzo, x - A, y - A, A * 3, A * 3);
    gl.clearRect(x, y, A, A);
    gl.drawImage(ARTE().suelo(ter, h % 4), x, y);
    // Una bolsa de petróleo: manchas negras y brillantes en el suelo (hasta que se levanta el pozo).
    if (v.crudo && v.crudo[t] && !visto.obra[t]) { gl.fillStyle = 'rgba(16,14,18,0.78)'; for (const [dx, dy, w, hh] of [[3, 6, 6, 3], [5, 4, 4, 7], [9, 8, 4, 3], [2, 10, 4, 2]]) gl.fillRect(x + dx * A / 16, y + dy * A / 16, w * A / 16, hh * A / 16); gl.fillStyle = 'rgba(120,110,160,0.55)'; gl.fillRect(x + 6 * A / 16, y + 5 * A / 16, A / 16, A / 16); }
    if (visto.camino && visto.camino[t]) caminoEn(t, x, y, ter);
    // Picos solo dentro de la sierra (rodeados de montaña) y repartidos al azar, no en filas.
    else if (ter === 'montana' && !visto.obra[t]) {
      const tx = t % v.tw, dentro = ['montana', 'nieve'].includes(tierra[t - 1]) + ['montana', 'nieve'].includes(tierra[t + 1]) + ['montana', 'nieve'].includes(tierra[t - v.tw]) + ['montana', 'nieve'].includes(tierra[t + v.tw]);
      if (tx > 0 && tx < v.tw - 1 && dentro >= 3 && (h >>> 11) % 5 < (dentro === 4 ? 3 : 1)) gl.drawImage(ARTE().pico((h >>> 3) % 8), x, y);
    }
    const obra = visto.obra[t];
    if (obra) {
      const r = V.region(m, t), c = m.dueno[r] >= 0 ? S.civ(m, m.dueno[r]) : null;
      // Cada edificio se ve con el estilo de la edad en que se levantó (o de su última reforma).
      const rec = m.vida.edificios && m.vida.edificios[t], eraT = rec && !rec.ruina && rec.tipo === obra ? rec.era : c ? c.era : 0;
      const color = c ? c.color : '#9a7a5a', ge = grupoEra(eraT);
      if (obra === V.OBRA.campo) gl.drawImage(ARTE().campo((visto.cultivo && visto.cultivo[t]) || 0, t % 2, V.pausada && V.pausada(m) ? V.cultivoTipo(m, tierra, t) : 'trigo'), x, y);
      else if (obra === V.OBRA.casa) {
        // Cada casa un poco distinta: unas en espejo, con el tejado más claro u oscuro, y algunas un píxel más abajo.
        const hv = (Math.imul(t, 2246822519) >>> 0) % 4;
        const img = ARTE().casa(CASAS[ge], hv === 3 ? mezclar(color, '#000000', 0.18) : hv === 2 ? mezclar(color, '#ffffff', 0.12) : color, (h >>> 7) % 4);
        const oy = (h >>> 5) % 2;
        if (hv % 2) { gl.save(); gl.translate(x + A, y + oy); gl.scale(-1, 1); gl.drawImage(img, 0, 0); gl.restore(); } else gl.drawImage(img, x, y + oy);
      }
      else if (obra === V.OBRA.ruina) gl.drawImage(ARTE().edificio('ruina', '#888888'), x, y);
      else if (obra === V.OBRA.ayuntamiento) gl.drawImage(ARTE().edificio('ayuntamiento', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.saber) gl.drawImage(ARTE().edificio('saber', color, M.ERUDITO(eraT).tipo), x, y);
      else if (obra === V.OBRA.torre) gl.drawImage(ARTE().edificio('torre', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.cuartel) gl.drawImage(ARTE().edificio('cuartel', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.arqueria) gl.drawImage(ARTE().edificio('arqueria', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.castillo) gl.drawImage(ARTE().edificio('castillo', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.mina) gl.drawImage(ARTE().edificio('mina', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.minapriv) gl.drawImage(ARTE().edificio('minapriv', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.inmopriv) gl.drawImage(ARTE().edificio('inmopriv', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.gremio) gl.drawImage(ARTE().edificio('gremio', color, V.etapa(obra, eraT)), x, y);
      else if (obra === V.OBRA.bancopriv) gl.drawImage(ARTE().edificio('bancopriv', color, V.etapa(obra, eraT)), x, y);
      else if (obra === V.OBRA.muelle) gl.drawImage(ARTE().edificio('muelle', color, V.etapa(obra, eraT)), x, y);
      else if (obra === V.OBRA.casona) gl.drawImage(ARTE().edificio('casona', color, V.etapa(obra, eraT)), x, y);
      else if (obra === V.OBRA.petroleo) gl.drawImage(ARTE().edificio('petroleo', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.aduana) gl.drawImage(ARTE().edificio('aduana', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.campamento) gl.drawImage(ARTE().edificio('campamento', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.templo) gl.drawImage(ARTE().edificio('templo', color, eraT === 4 ? 4 : V.fase(eraT)), x, y);
      // La fábrica de un capitalista se dibuja según su industria (textil, aserradero, fundición, conservera).
      else if (obra === V.OBRA.fabrica && m.vida.privados && m.vida.privados[t] && m.vida.privados[t].ind) gl.drawImage(ARTE().edificio('fab_' + m.vida.privados[t].ind, color, V.fase(eraT)), x, y);
      // La estación de una compañía de ferrocarril, con su letrero y su locomotora.
      else if (obra === V.OBRA.estacion && m.vida.privados && m.vida.privados[t] && m.vida.privados[t].ind === 'ferrocarril') gl.drawImage(ARTE().edificio('fab_ferrocarril', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.pozo || obra === V.OBRA.granero || obra === V.OBRA.fuente || obra === V.OBRA.parque || obra === V.OBRA.palacio || (obra >= V.OBRA.central && obra <= V.OBRA.aerodromo)) gl.drawImage(ARTE().edificio(['pozo', 'granero', 'fuente', 'parque', 'palacio', 'central', 'banco', 'fabrica', 'estacion', 'hospital', 'aerodromo'][obra - V.OBRA.pozo], color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.molino) gl.drawImage(ARTE().edificio('molino', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.puerto) gl.drawImage(ARTE().edificio('puerto', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.centro) {
        // La plaza ocupa 2×2 parcelas: cada una pinta su cuarto del edificio grande.
        const lx = (t % v.tw) % V.SUB - 1, ly = Math.floor(t / v.tw) % V.SUB - 1;
        if (lx >= 0 && ly >= 0 && lx < 2 && ly < 2) gl.drawImage(ARTE().plaza(ge, color), lx * A, ly * A, A, A, x, y, A, A);
        else gl.drawImage(ARTE().edificio('ruina', '#888888'), x, y);
      }
      return;
    }
    if (visto.roca[t]) { gl.drawImage(ARTE().roca(Math.min(3, visto.roca[t]), (m.vida.mena && m.vida.mena[t]) || 0), x, y); return; }
    const a = visto.arbol[t];
    if (a) {
      const r = V.region(m, t), tipo = m.tipo[r];
      if (!v.isla) v.isla = V.islas(m);
      const variante = (t * 7) % 5;
      // En los bosques densos, una de cada tres parcelas lleva un grupo de árboles apretados.
      const denso = (h >>> 9) % 3 === 0;
      let maduro = {
        desierto: 'cactus', nieve: 'nevado3', taiga: variante === 0 ? 'nevado3' : denso ? 'pinos' : 'pino3', tundra: 'matorral', colina: 'pino3', sakura: variante === 4 ? 'roble3' : 'sakura',
        selva: variante < 2 ? 'palmera' : denso ? 'junglas' : 'jungla3', sabana: 'acacia', pantano: 'sauce', bosque: variante === 0 ? (denso ? 'pinos' : 'pino3') : denso ? 'robles' : 'roble3'
      }[tipo] || (variante === 0 ? 'pino3' : 'roble3');
      // Playas cálidas e islas: palmeras.
      if (ter === 'arena' || (v.isla[r] && tipo !== 'nieve' && tipo !== 'tundra' && tipo !== 'taiga' && tipo !== 'desierto' && variante < 4)) maduro = 'palmera';
      const nombre = a === 1 ? (tipo === 'tundra' ? 'matorral' : 'arbol1') : a === 2 ? (tipo === 'desierto' ? 'cactus' : tipo === 'tundra' ? 'matorral' : maduro === 'sakura' ? 'sakura2' : maduro === 'palmera' ? 'palmera' : 'arbol2') : maduro;
      gl.drawImage(ARTE().arbol(nombre, (h >>> 3) % 5), x, y);
      return;
    }
    // Flores, setas, helechos, piedrecitas: un adorno en una de cada tres o cuatro parcelas vacías.
    if ((h >>> 11) % 100 < (ARTE().HIERBA.has(ter) ? 34 : 14) && ter !== 'agua' && ter !== 'bajo' && ter !== 'rio' && ter !== 'montana') gl.drawImage(ARTE().adorno(ter, (h >>> 4) % 6), x, y);
  }
  // Un tramo de camino: tierra al principio, empedrado desde la Antigüedad, asfalto en la era moderna,
  // y puente de tablas sobre los ríos. Se une con los tramos vecinos y con las plazas.
  function caminoEn(t, x, y, ter) {
    const v = m.vida, tw = v.tw, c = m.dueno[V.region(m, t)] >= 0 ? S.civ(m, m.dueno[V.region(m, t)]) : null, era = c ? c.era : 0;
    const une = n => n >= 0 && n < tw * v.th && (visto.camino[n] || visto.obra[n] === V.OBRA.centro || visto.obra[n] === V.OBRA.ayuntamiento);
    const tx = t % tw;
    // Centro de 8×8 y brazos hacia los vecinos (izquierda, derecha, arriba, abajo).
    const lados = [[tx > 0 && une(t - 1), 0, 4, 4, 8], [tx < tw - 1 && une(t + 1), 12, 4, 4, 8], [une(t - tw), 4, 0, 8, 4], [une(t + tw), 4, 12, 8, 4]];
    if (ter === 'rio' && era >= 3) {
      // Puente de piedra con arcos (Antigüedad) o de acero y hormigón (era moderna).
      const acero = era >= 7;
      gl.fillStyle = acero ? '#8a8e96' : '#a8a49a'; gl.fillRect(x, y + 3, A, 10);
      gl.fillStyle = acero ? '#55585f' : '#8a867c'; gl.fillRect(x, y + 3, A, 1); gl.fillRect(x, y + 12, A, 1);
      gl.fillStyle = acero ? '#3f4248' : '#b9ad94'; gl.fillRect(x, y + 5, A, 6);
      if (acero) { gl.fillStyle = '#e8d070'; for (let k = 1; k < A; k += 4) gl.fillRect(x + k, y + 8, 2, 1); gl.fillStyle = '#c84a3a'; for (let k = 0; k < A; k += 4) { gl.fillRect(x + k, y + 1, 1, 3); gl.fillRect(x + k, y + 12, 1, 3); } gl.fillRect(x, y + 1, A, 1); }
      else { gl.fillStyle = '#6a665e'; gl.fillRect(x + 2, y + 13, 3, 2); gl.fillRect(x + 11, y + 13, 3, 2); gl.fillStyle = '#8a867c'; for (let k = 0; k < A; k += 4) gl.fillRect(x + k, y + 2, 2, 1); }
      return;
    }
    if (ter === 'rio') {
      // Puente de tablas con barandilla.
      gl.fillStyle = '#8a5a2a'; gl.fillRect(x, y + 3, A, 10);
      gl.fillStyle = '#6a4220'; for (let k = 1; k < A; k += 3) gl.fillRect(x + k, y + 3, 1, 10);
      gl.fillStyle = '#a8784a'; gl.fillRect(x, y + 3, A, 1);
      gl.fillStyle = '#3a2a1e'; gl.fillRect(x, y + 2, A, 1); gl.fillRect(x, y + 13, A, 1);
      for (let k = 0; k < A; k += 5) { gl.fillRect(x + k, y + 1, 1, 2); gl.fillRect(x + k, y + 13, 1, 2); }
      return;
    }
    // La explanada de una plaza pública o de un palacio: adoquín en anillos que siguen los de la fuente.
    let plazaEn = -1;
    for (const d of [-1, 1, -tw, tw, -tw - 1, -tw + 1, tw - 1, tw + 1]) { const n = t + d; if (n >= 0 && n < tw * v.th && Math.abs((n % tw) - tx) <= 1 && (visto.obra[n] === V.OBRA.fuente || visto.obra[n] === V.OBRA.palacio)) { plazaEn = n; break; } }
    if (plazaEn >= 0 && ter !== 'rio') {
      const cx = (plazaEn % tw) * A + 7.5, cy = Math.floor(plazaEn / tw) * A + 7.5, fase = V.fase(era), ox = tx * A, oy = Math.floor(t / tw) * A;
      for (let j = 0; j < A; j++) for (let i = 0; i < A; i++) { gl.fillStyle = ARTE().piedraPlaza(ox + i - cx, oy + j - cy, fase); gl.fillRect(x + i, y + j, 1, 1); }
      // Bordillo donde la explanada acaba (sin calle ni edificio al lado).
      const bord = '#6e6a62', libre = n => n < 0 || n >= tw * v.th || (!visto.camino[n] && !visto.obra[n]);
      if (tx > 0 && libre(t - 1)) gl.fillStyle = bord, gl.fillRect(x, y, 1, A);
      if (tx < tw - 1 && libre(t + 1)) gl.fillStyle = bord, gl.fillRect(x + A - 1, y, 1, A);
      if (libre(t - tw)) gl.fillStyle = bord, gl.fillRect(x, y, A, 1);
      if (libre(t + tw)) gl.fillStyle = bord, gl.fillRect(x, y + A - 1, A, 1);
      return;
    }
    // Calles de piedra neutra (gris, sin el color de nadie): tierra apisonada al principio, adoquín desde el
    // Bronce y asfalto en la era moderna.
    const [base, borde, marca] = era >= 7 ? ['#55585f', '#3f4248', '#e8d070'] : era >= 1 ? ['#a4a29c', '#7c7a74', '#bcbab4'] : ['#a08a6a', '#7e6a4e', '#b29c7c'];
    gl.fillStyle = borde; gl.fillRect(x + 3, y + 3, 10, 10);
    for (const [si, lx, ly, w, hh] of lados) if (si) gl.fillRect(x + lx + (w === 4 ? 0 : -1), y + ly + (hh === 4 ? 0 : -1), w + (w === 4 ? 0 : 2), hh + (hh === 4 ? 0 : 2));
    gl.fillStyle = base; gl.fillRect(x + 4, y + 4, 8, 8);
    for (const [si, lx, ly, w, hh] of lados) if (si) gl.fillRect(x + lx, y + ly, w, hh);
    gl.fillStyle = marca;
    if (era >= 7) { if (lados[0][0] || lados[1][0]) for (let k = 1; k < A; k += 4) gl.fillRect(x + k, y + 7, 2, 1); if (lados[2][0] || lados[3][0]) for (let k = 1; k < A; k += 4) gl.fillRect(x + 7, y + k, 1, 2); }
    else if (era >= 1) {
      // Adoquines: piedras claras con juntas oscuras, también en los brazos que unen con los vecinos.
      const junta = '#8a8882';
      for (let j = 4; j < 12; j += 2) for (let i = 4 + (j % 4 ? 1 : 0); i < 12; i += 3) { gl.fillStyle = marca; gl.fillRect(x + i, y + j, 2, 1); gl.fillStyle = junta; gl.fillRect(x + i + 2, y + j, 1, 1); }
      for (const [si, lx, ly, w, hh] of lados) if (si) for (let j = ly; j < ly + hh; j += 2) for (let i = lx + ((j / 2) % 2); i < lx + w; i += 3) { gl.fillStyle = marca; gl.fillRect(x + i, y + j, 2, 1); }
    }
    else { gl.fillRect(x + 6, y + 6, 1, 1); gl.fillRect(x + 9, y + 8, 1, 1); gl.fillRect(x + 5, y + 10, 1, 1); }
  }
  function vecinasPlaza(t) {
    const tw = m.vida.tw;
    for (const d of [-1, 1, -tw, tw, -tw - 1, -tw + 1, tw - 1, tw + 1]) { const n = t + d; if (n >= 0 && n < tw * m.vida.th && visto.camino[n]) parcela(n); }
  }
  function vecinasCamino(t) {
    const tw = m.vida.tw;
    for (const n of [t - 1, t + 1, t - tw, t + tw]) if (n >= 0 && n < tw * m.vida.th && visto.camino[n]) parcela(n);
  }

  // El color de cada pueblo sobre su tierra y las fronteras (rojas donde hay guerra).
  // El territorio que se ve rodea lo construido (casas, campos, caminos, plazas), como las zonas de WorldBox:
  // crece parcela a parcela según se levanta el pueblo, aunque el reino reclame regiones enteras.
  function territorio() {
    const v = m.vida, tw = v.tw, n = tw * v.th, RADIO = 3;
    // La región de cada parcela no cambia nunca: se calcula una vez.
    if (!regionDe || regionDe.length !== n) { regionDe = new Int32Array(n); for (let t = 0; t < n; t++) regionDe[t] = V.region(m, t); }
    gc.clearRect(0, 0, capa.width, capa.height);
    if (g && g.todoSucio) g.todoSucio(capa);
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    const guerra = new Set(); for (const c of S.vivas(m)) for (const x of c.guerras) guerra.add(Math.min(c.id, x.con) + ':' + Math.max(c.id, x.con));
    const zona = new Int16Array(n).fill(-1), dist = new Uint8Array(n).fill(255), cola = [];
    for (let t = 0; t < n; t++) {
      const d = m.dueno[regionDe[t]];
      if (d < 0) continue;
      const o = visto.obra[t];
      if ((o && o !== V.OBRA.ruina) || (visto.camino && visto.camino[t])) { zona[t] = d; dist[t] = 0; cola.push(t); }
    }
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], d = zona[t], x = t % tw;
      if (dist[t] >= RADIO) continue;
      for (const nb of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) {
        if (nb < 0 || nb >= n || zona[nb] >= 0 || m.dueno[regionDe[nb]] !== d) continue;
        const tr = tierra[nb];
        if (tr === 'agua' || tr === 'bajo') continue;
        zona[nb] = d; dist[nb] = dist[t] + 1; cola.push(nb);
      }
    }
    // Bordes orgánicos: cada parcela es un cuadro con las esquinas salientes cortadas en diagonal, así las escaleras
    // de parcelas se ven como líneas suaves. Se rellena por pueblo (un solo trazo por color) y luego se perfila.
    const H = CA / 2, mismo = (t, dx, dy) => { const x = t % tw + dx, y = (t / tw | 0) + dy; return x >= 0 && y >= 0 && x < tw && y < v.th ? zona[y * tw + x] : -2; };
    const formas = new Map(), lineas = new Map();
    const linea = (col, a1, b1, a2, b2) => { let l = lineas.get(col); if (!l) lineas.set(col, l = []); l.push(a1, b1, a2, b2); };
    for (let t = 0; t < n; t++) {
      const d = zona[t];
      if (d < 0 || !color[d]) continue;
      const x = (t % tw) * CA, y = Math.floor(t / tw) * CA;
      const N = mismo(t, 0, -1), S2 = mismo(t, 0, 1), O = mismo(t, -1, 0), E = mismo(t, 1, 0);
      // Una esquina se corta si los dos vecinos que la tocan son de otro (y la parcela no queda aislada en una punta).
      const cTL = N !== d && O !== d && (S2 === d || E === d), cTR = N !== d && E !== d && (S2 === d || O === d);
      const cBR = S2 !== d && E !== d && (N === d || O === d), cBL = S2 !== d && O !== d && (N === d || E === d);
      const pts = [];
      if (cTL) pts.push(x, y + H, x + H, y); else pts.push(x, y);
      if (cTR) pts.push(x + CA - H, y, x + CA, y + H); else pts.push(x + CA, y);
      if (cBR) pts.push(x + CA, y + CA - H, x + CA - H, y + CA); else pts.push(x + CA, y + CA);
      if (cBL) pts.push(x + H, y + CA, x, y + CA - H); else pts.push(x, y + CA);
      // Las calles, plazas y puentes quedan de su piedra, sin el tinte del pueblo (solo el borde marca la frontera).
      const neutra = (visto.camino && visto.camino[t]) || visto.obra[t] === V.OBRA.centro;
      if (!neutra) { let f = formas.get(d); if (!f) formas.set(d, f = []); f.push(pts); }
      // El perfil: los lados que dan a otro (más corto si la esquina está cortada) y las diagonales.
      const estilo = od => { const enGuerra = od >= 0 && guerra.has(Math.min(d, od) + ':' + Math.max(d, od)); return enGuerra ? 'G' : sel === d ? 'S' : 'C' + d; };
      if (N !== d) linea(estilo(N), x + (cTL ? H : 0), y + 0.5, x + CA - (cTR ? H : 0), y + 0.5);
      if (S2 !== d) linea(estilo(S2), x + (cBL ? H : 0), y + CA - 0.5, x + CA - (cBR ? H : 0), y + CA - 0.5);
      if (O !== d) linea(estilo(O), x + 0.5, y + (cTL ? H : 0), x + 0.5, y + CA - (cBL ? H : 0));
      if (E !== d) linea(estilo(E), x + CA - 0.5, y + (cTR ? H : 0), x + CA - 0.5, y + CA - (cBR ? H : 0));
      if (cTL) linea(estilo(N >= 0 ? N : O), x + 0.4, y + H + 0.4, x + H + 0.4, y + 0.4);
      if (cTR) linea(estilo(N >= 0 ? N : E), x + CA - H - 0.4, y + 0.4, x + CA - 0.4, y + H + 0.4);
      if (cBR) linea(estilo(S2 >= 0 ? S2 : E), x + CA - 0.4, y + CA - H - 0.4, x + CA - H - 0.4, y + CA - 0.4);
      if (cBL) linea(estilo(S2 >= 0 ? S2 : O), x + H + 0.4, y + CA - 0.4, x + 0.4, y + CA - H - 0.4);
    }
    for (const [d, lista] of formas) {
      gc.globalAlpha = sel == null ? 0.18 : sel === d ? 0.24 : 0.1;
      gc.fillStyle = color[d];
      gc.beginPath();
      for (const p of lista) { gc.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) gc.lineTo(p[i], p[i + 1]); gc.closePath(); }
      gc.fill();
    }
    gc.lineWidth = 1; gc.lineCap = 'round';
    for (const [k, l] of lineas) {
      gc.strokeStyle = k === 'G' ? '#ff4b3a' : k === 'S' ? '#fff6dc' : color[+k.slice(1)];
      gc.globalAlpha = k === 'G' || k === 'S' ? 1 : 0.9;
      gc.beginPath();
      for (let i = 0; i < l.length; i += 4) { gc.moveTo(l[i], l[i + 1]); gc.lineTo(l[i + 2], l[i + 3]); }
      gc.stroke();
    }
    gc.globalAlpha = 1;
  }
