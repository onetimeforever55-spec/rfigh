/*
 * GÉNESIS · EL PINTOR
 * Dibuja el mundo como un juego de píxeles visto desde arriba: cada parcela de 16×16 píxeles (arte.js) con su suelo,
 * sus árboles, sus rocas, sus campos y sus casas (con el tejado del color de su pueblo y el estilo de su
 * era), y encima los aldeanos andando, talando, sembrando y luchando.
 *
 * El suelo y las obras se pintan una vez en un lienzo grande y solo se retocan las parcelas que cambian;
 * cada fotograma se recorta lo que ve la cámara (arrastrar, rueda, pellizco y botones) y se dibujan los
 * aldeanos interpolando su recorrido del turno.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO;
  // A: píxeles de arte por parcela (el suelo, las casas y los árboles); P: píxeles del mundo por parcela.
  // Las personas, los animales, los barcos y las flechas se dibujan a la escala fina P, así que una persona
  // queda mucho más pequeña que una casa, como en WorldBox.
  const A = 16, E = 1, P = A * E;
  // La capa de territorio (colores de los reinos) va a menos resolución: ahorra memoria y no hace falta más.
  const CA = 8;
  const ARTE = () => M.arte;

  function mezclar(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = k => Math.round(((pa >> k) & 255) * (1 - t) + ((pb >> k) & 255) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }

  const grupoEra = era => (era <= 1 ? 0 : era <= 4 ? 1 : era <= 6 ? 2 : 3);
  const CASAS = ['choza', 'casa', 'entramado', 'bloque'];

  // ---------- Estado ----------
  let cv = null, g = null, m = null, V = null, S = null, alClicar = null, alClicarAldeano = null, alClicarCorte = null, alClicarEdificio = null;
  // Dónde se dibujó cada aldeano en el último fotograma (para tocarlo y para seguirlo con la cámara).
  const dibujados = new Map();
  let siguiendo = null, elegido = null;
  let lienzo = null, gl = null, capa = null, gc = null, regionDe = null, territorioPendiente = false;
  let visto = null, tierra = null, firma = [], pend = [], inicio = 0, duracion = 1000;
  let cam = { x: 0, y: 0, z: 2 }, sel = null, pulso = null, reducido = false, listo = false;
  let efectos = [], tumbas = [], cartel = null;
  const punteros = new Map();
  let arrastre = null;
  // EL MODO TROPAS (como en Age of Empires): { civ, sel: Set de ids, alCambiar(sel), alOrdenar(t) }; null para salir.
  // Arrastrar con un dedo (o con el botón izquierdo) dibuja un recuadro que elige a tus soldados; tocar el mapa
  // los manda allí. Con dos dedos (o con el botón derecho) se mueve la cámara.
  let tropas = null, caja = null;
  function modoTropas(o) { tropas = o ? Object.assign({ sel: new Set() }, o) : null; caja = null; }

  function iniciar(canvas, opciones) {
    cv = canvas; g = cv.getContext('2d');
    alClicar = (opciones && opciones.alClicar) || null;
    alClicarAldeano = (opciones && opciones.alClicarAldeano) || null;
    alClicarCorte = (opciones && opciones.alClicarCorte) || null;
    alClicarEdificio = (opciones && opciones.alClicarEdificio) || null;
    reducido = !!(opciones && opciones.reducido);
    S = M.sim; V = M.vida;
    entradas();
    if (window.ResizeObserver) new ResizeObserver(() => medir()).observe(cv.parentElement);
    else window.addEventListener('resize', medir);
    medir();
    requestAnimationFrame(fotograma);
  }

  // EL MODO LIGERO: si el aparato no llega a unos 30 fotogramas por segundo, se pinta a menos resolución y se
  // quitan los adornos (huellas, humo, gestos, polvo, pájaros, nubes, tráfico); si luego va sobrado, vuelven.
  let ligero = false, mediaFotograma = 16, ultimoFotograma = 0, cambioLigero = 0;
  function medirRitmo(ahora) {
    const d = ultimoFotograma ? Math.min(250, ahora - ultimoFotograma) : 16; ultimoFotograma = ahora;
    mediaFotograma = mediaFotograma * 0.95 + d * 0.05;
    if (ahora - cambioLigero < 4000) return;
    if (!ligero && mediaFotograma > 36) { ligero = true; cambioLigero = ahora; medir(); }
    else if (ligero && mediaFotograma < 18) { ligero = false; cambioLigero = ahora; medir(); }
  }
  function medir() {
    const caja = cv.parentElement, dpr = ligero ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, caja.clientWidth), h = Math.max(200, caja.clientHeight);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    limitar();
  }
  const vista = () => { const dpr = cv.width / Math.max(1, cv.clientWidth); return { w: cv.width / dpr, h: cv.height / dpr, dpr }; };
  const ancho = () => (m ? m.vida.tw * P : 1), alto = () => (m ? m.vida.th * P : 1);
  const zMin = () => { const { w, h } = vista(); return Math.min(w / ancho(), h / alto()); };
  function limitar() {
    if (!m) return;
    const { w, h } = vista();
    cam.z = Math.max(zMin(), Math.min(8, cam.z));
    const mx = w / cam.z / 2, my = h / cam.z / 2;
    cam.x = ancho() <= w / cam.z ? ancho() / 2 : Math.max(mx, Math.min(ancho() - mx, cam.x));
    cam.y = alto() <= h / cam.z ? alto() / 2 : Math.max(my, Math.min(alto() - my, cam.y));
  }

  // ---------- Pintar el suelo y las obras ----------
  let subVisto = 0;
  function mundo(nuevo, enfocar) {
    m = nuevo; regionDe = null; gente = null;
    if (!m.vida) V.crear(m);
    const v = m.vida;
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
      else if (obra === V.OBRA.gremio) gl.drawImage(ARTE().edificio('gremio', color, 0), x, y);
      else if (obra === V.OBRA.casona) gl.drawImage(ARTE().edificio('casona', color, eraT >= 6 ? 2 : eraT >= 5 ? 1 : 0), x, y);
      else if (obra === V.OBRA.petroleo) gl.drawImage(ARTE().edificio('petroleo', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.aduana) gl.drawImage(ARTE().edificio('aduana', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.campamento) gl.drawImage(ARTE().edificio('campamento', color, V.fase(eraT)), x, y);
      else if (obra === V.OBRA.templo) gl.drawImage(ARTE().edificio('templo', color, eraT === 4 ? 4 : V.fase(eraT)), x, y);
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


  // ---------- Un turno nuevo: dejar al día lo pintado y preparar la animación ----------
  function aplicar(hasta) {
    let quedan = 0;
    for (const ch of pend) {
      if (ch[4] > hasta || ch.hecho) { if (!ch.hecho) quedan++; continue; }
      const capaN = ch[0] === 0 ? 'arbol' : ch[0] === 1 ? 'roca' : ch[0] === 2 ? 'obra' : ch[0] === 4 ? 'cultivo' : ch[0] === 5 ? 'camino' : null;
      if (capaN) { if (capaN === 'obra' && ch[3] === V.OBRA.ruina && ch[2] && ch[4] > 0) polvo(ch[1], true); visto[capaN][ch[1]] = ch[3]; parcela(ch[1]); if (capaN === 'camino') vecinasCamino(ch[1]); if (capaN === 'obra' && [V.OBRA.fuente, V.OBRA.palacio].some(o => o === ch[3] || o === ch[2])) vecinasPlaza(ch[1]); }
      ch.hecho = true;
    }
    if (!quedan) pend = [];
  }
  // Compara lo pintado con el mundo (menos los cambios de este turno, que se irán aplicando) y repinta lo distinto.
  function sincronizar(cambios) {
    const v = m.vida, n = v.tw * v.th;
    aplicar(Infinity);
    // Se ha descubierto carbón o petróleo: se repinta todo una vez (las vetas negras y las manchas de crudo).
    if ((v.subsueloVer || 0) !== subVisto) { subVisto = v.subsueloVer || 0; for (let t = 0; t < n; t++) parcela(t); }
    const antes = { arbol: v.arbol.slice(), roca: v.roca.slice(), obra: v.obra.slice(), cultivo: (v.cultivo || []).slice(), camino: (v.camino || []).slice() };
    for (let k = cambios.length - 1; k >= 0; k--) { const [c, t, a] = cambios[k]; if (c <= 2 || c === 4 || c === 5) antes[c === 0 ? 'arbol' : c === 1 ? 'roca' : c === 2 ? 'obra' : c === 4 ? 'cultivo' : 'camino'][t] = a; }
    const ter = V.terrenos(m), nf = firmas(), cambiadas = new Set(), caminosTocados = [];
    for (let r = 0; r < nf.length; r++) if (nf[r] !== firma[r]) cambiadas.add(r);
    firma = nf;
    for (let t = 0; t < n; t++) {
      let distinto = false;
      if (ter[t] !== tierra[t]) { tierra[t] = ter[t]; distinto = true; }
      for (const c of ['arbol', 'roca', 'obra', 'cultivo', 'camino']) if ((visto[c][t] || 0) !== (antes[c][t] || 0)) { visto[c][t] = antes[c][t]; distinto = true; if (c === 'camino') caminosTocados.push(t); }
      if (!distinto && visto.obra[t] && visto.obra[t] !== V.OBRA.campo && cambiadas.has(V.region(m, t))) distinto = true;
      if (distinto) parcela(t);
    }
    for (const t of caminosTocados) vecinasCamino(t);
    pend = cambios.map(c => c.slice());
  }
  function turno(mundoActual, ms) {
    if (mundoActual !== m || !listo) { mundo(mundoActual); }
    // El recorrido del turno anterior de cada aldeano: cada uno va con su propio desfase (ver aldeanos()).
    for (const a of m.vida.aldeanos) { const r0 = rVisto.get(a); if (r0 && r0 !== a.r) rAntes.set(a, r0); rVisto.set(a, a.r); }
    // Lo que se dibuja es el recorrido de este turno, aunque el siguiente ya se esté calculando por partes.
    for (const b of (m.vida.animales || []).concat(m.vida.barcos || [])) rVisto.set(b, b.r);
    sincronizar(m.vida.cambios || []);
    gente = m.vida.aldeanos.slice();
    inicio = performance.now(); duracion = Math.max(80, ms || 1000);
    vistos = new Set();
    recogerMuertos(duracion);
    for (const n of m.vida.naufragios || []) naufragios.push({ n, inicio: performance.now() + (n[2] / V.TICKS) * duracion, color: (S.civ(m, n[5]) || {}).color || '#ccc', era: (S.civ(m, n[5]) || { era: 0 }).era });
    buscarBatallas();
    for (const p_ of m.vida.plagas || []) if (p_.turno === m.turno && !plagasVistas.has(p_)) { plagasVistas.add(p_); plagasAnim.push({ regiones: p_.regiones, inicio: performance.now() }); }
    // El territorio se repinta en el fotograma siguiente: así el cálculo del turno no se junta en un solo tirón.
    if (!territorioPendiente) { territorioPendiente = true; setTimeout(() => { territorioPendiente = false; if (m && listo) territorio(); }, 16); }
  }
  // Tras un poder del dios (fuera del turno): todo al día, sin animación.
  function refrescar() {
    if (!m) return;
    sincronizar([]);
    territorio();
    recogerMuertos();
  }
  // Quien muere durante el turno sigue en pie (y peleando) hasta el paso en que cae; luego, su caída.
  let caidos = [];
  // La gente tal como estaba al empezar el turno que se ve: mientras se anima, el siguiente ya se calcula por partes,
  // y quien muera en él no debe esfumarse antes de tiempo (se le ve hasta el final y luego cae en su turno).
  let gente = null;
  function recogerMuertos(dur) {
    const ahora = performance.now();
    caidos = [];
    for (const [x, y, c, tipo, paso, quien] of (m.vida.muertos || [])) {
      if (quien && paso) caidos.push({ a: quien, paso, animal: tipo === 'animal' });
      tumbas.push({ x, y, c, tipo, quien: quien || null, inicio: ahora + (paso ? (paso / V.TICKS) * (dur || 1000) : Math.random() * 500) });
    }
    m.vida.muertos = [];
    if (tumbas.length > 400) tumbas = tumbas.slice(-400);
  }

  // ---------- Cada fotograma ----------
  function progreso() {
    if (reducido) return V.TICKS;
    return Math.max(0, Math.min(1, (performance.now() - inicio) / duracion)) * V.TICKS;
  }
  function fotograma(ahora) {
    requestAnimationFrame(fotograma);
    if (!m || !listo) return;
    medirRitmo(ahora);
    const k = progreso();
    if (pend.length) aplicar(Math.floor(k));
    const { w, h, dpr } = vista();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b1830'; g.fillRect(0, 0, cv.width, cv.height);
    const temblor = efectos.find(e => e.tipo === 'terremoto' && ahora - e.inicio < 1400);
    const sacudir = temblor && !reducido ? (Math.sin(ahora / 22) * 5 + Math.sin(ahora / 37) * 3) * dpr * (1 - (ahora - temblor.inicio) / 1400) : 0;
    const z = cam.z * dpr, ox = cv.width / 2 - cam.x * z + sacudir, oy = cv.height / 2 - cam.y * z - sacudir * 0.6;
    g.imageSmoothingEnabled = false;
    g.setTransform(z, 0, 0, z, ox, oy);
    // Solo lo que se ve.
    const x0 = Math.max(0, Math.floor(cam.x - w / cam.z / 2) - P), y0 = Math.max(0, Math.floor(cam.y - h / cam.z / 2) - P);
    const x1 = Math.min(ancho(), Math.ceil(cam.x + w / cam.z / 2) + P), y1 = Math.min(alto(), Math.ceil(cam.y + h / cam.z / 2) + P);
    // El suelo y las obras están pintados a escala de arte (A): se amplían al mundo (P).
    g.drawImage(lienzo, x0 / E, y0 / E, (x1 - x0) / E, (y1 - y0) / E, x0, y0, x1 - x0, y1 - y0);
    const ec = P / CA;
    g.drawImage(capa, x0 / ec, y0 / ec, (x1 - x0) / ec, (y1 - y0) / ec, x0, y0, x1 - x0, y1 - y0);
    if (!ligero) huellas(k, ahora, x0, y0, x1, y1);
    banderas(ahora);
    agua(ahora, x0, y0, x1, y1);
    barcos(k, ahora, x0, y0, x1, y1);
    pintarNaufragios(ahora);
    animales(k, ahora, x0, y0, x1, y1);
    edificiosVivos(ahora, x0, y0, x1, y1);
    danados(ahora, x0, y0, x1, y1);
    if (civPorId.size) { vias(x0, y0, x1, y1, ahora); trincheras(x0, y0, x1, y1); if (!reducido && !ligero) trafico(ahora, x0, y0, x1, y1); }
    andamios(ahora, x0, y0, x1, y1);
    progresos(x0, y0, x1, y1);
    if (!ligero) humo(ahora, x0, y0, x1, y1);
    aldeanos(k, ahora, x0, y0, x1, y1);
    pintarDisparos(k);
    eventosParticulas(k, x0, y0, x1, y1);
    llamas(k, ahora, x0, y0, x1, y1);
    sucesosMapa(ahora, x0, y0, x1, y1);
    pintarParticulas(ahora);
    if (plagasAnim.length) pintarPlagas(ahora, x0, y0, x1, y1);
    if (!ligero) { gestos(k, ahora); pintarPolvo(ahora); }
    pintarTumbas(ahora);
    pintarEfectos(ahora, x0, y0, x1, y1);
    asedios(ahora);
    nieve(ahora, x0, y0, x1, y1);
    estaciones(ahora, x0, y0, x1, y1);
    if (!ligero) { pajaros(ahora, x0, y0, x1, y1); nubes(ahora, x0, y0, x1, y1); }
    pintarAviones(k);
    marcarPulso(ahora);
    planos(ahora);
    noche(ahora, x0, y0, x1, y1, z, ox, oy);
    farolas(ahora, x0, y0, x1, y1);
    if (!ligero) sueno(ahora, x0, y0, x1, y1);
    resplandor(k, ahora, x0, y0, x1, y1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    nombres(z, ox, oy, dpr);
    pintarBatallas(ahora, z, ox, oy, dpr);
    avisoCorte(ahora, z, ox, oy, dpr);
    pintarAnuncios(z, ox, oy, dpr, performance.now());
    pintarCartel(ahora, dpr);
    if (tropas) pintarTropas(ahora, z, ox, oy, dpr);
  }
  // El recuadro de selección y la bandera del sitio al que van las tropas.
  let destino = null;
  function marcarDestino(t) { destino = { t, desde: performance.now() }; }
  function pintarTropas(ahora, z, ox, oy, dpr) {
    if (caja) { const rect = cv.getBoundingClientRect(); const x = (Math.min(caja.x0, caja.x1) - rect.left) * dpr, y = (Math.min(caja.y0, caja.y1) - rect.top) * dpr, w = Math.abs(caja.x1 - caja.x0) * dpr, h = Math.abs(caja.y1 - caja.y0) * dpr; g.fillStyle = 'rgba(109,255,122,0.12)'; g.fillRect(x, y, w, h); g.strokeStyle = '#6dff7a'; g.lineWidth = 1.5 * dpr; g.strokeRect(x, y, w, h); }
    if (destino && ahora - destino.desde < 1600) {
      const v = m.vida, x = ((destino.t % v.tw) * P + P / 2) * z + ox, y = (Math.floor(destino.t / v.tw) * P + P / 2) * z + oy, f = (ahora - destino.desde) / 1600;
      g.strokeStyle = 'rgba(109,255,122,' + (1 - f).toFixed(2) + ')'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, (6 + 14 * f) * dpr, 0, Math.PI * 2); g.stroke();
    }
  }

  function banderas(ahora) {
    const fase = Math.floor(ahora / 260) % 2;
    for (const c of S.vivas(m)) {
      // El gobernante pasea delante de su palacio, con capa del color de su pueblo y corona.
      const R = V.SUB * P, rx = (c.capital % m.W) * R, ry = Math.floor(c.capital / m.W) * R;
      const kx = Math.round(rx + R / 2 - 1 + Math.sin(ahora / 1100 + c.id) * 8), ky = ry + P * 3 + 4;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(kx - 1, ky + 6, 5, 1);
      g.fillStyle = '#3a2a1e'; g.fillRect(kx, ky + 4, 1, 2); g.fillRect(kx + 2, ky + 4, 1, 2);
      g.fillStyle = c.color; g.fillRect(kx - 1, ky + 1, 5, 4);
      g.fillStyle = '#f0c8a0'; g.fillRect(kx + 1, ky, 1, 1);
      g.fillStyle = '#ffd23a'; g.fillRect(kx, ky - 1, 3, 1); g.fillRect(kx + (fase ? 0 : 2), ky - 2, 1, 1);
      const r = c.capital, x = (r % m.W) * V.SUB * P + P + 2, y = Math.floor(r / m.W) * V.SUB * P + P - 12;
      g.fillStyle = '#3a2a1e'; g.fillRect(x, y, 1, 14);
      g.fillStyle = c.color; g.fillRect(x + 1, y, 7, 5);
      g.fillStyle = mezclar(c.color, '#000000', 0.3); g.fillRect(x + 6, y + (fase ? 1 : 0), 2, 4);
    }
  }

  // Los aldeanos: 3×5 píxeles, con el color de su pueblo y la herramienta de su oficio.
  // ---------- Golpes como en WorldBox: destello rojo y blanco, retroceso, embestida, sangre y barra de vida ----------
  const DURA_GOLPE = 0.55; // en pasos
  let indiceGolpes = { de: null, golpes: new Map(), ataques: new Map() };
  function golpesDelTurno(v) {
    if (indiceGolpes.de === v.golpes) return indiceGolpes;
    const golpes = new Map(), ataques = new Map();
    for (const gp of v.golpes || []) (golpes.get(gp[0]) || golpes.set(gp[0], []).get(gp[0])).push(gp);
    for (const at of v.ataques || []) (ataques.get(at[0]) || ataques.set(at[0], []).get(at[0])).push(at);
    return (indiceGolpes = { de: v.golpes, golpes, ataques });
  }
  // El golpe más reciente que se está viendo ahora (o null), y cuánto va de él (0 a 1).
  function golpeActivo(lista, k) {
    if (!lista) return null;
    for (let i = lista.length - 1; i >= 0; i--) { const d = (k - (lista[i][1] - 0.5)) / DURA_GOLPE; if (d >= 0 && d < 1) return [lista[i], d]; }
    return null;
  }
  // La silueta del aldeano en un color (para el destello).
  function silueta(px, py, col) {
    g.fillStyle = col;
    g.fillRect(px + 1, py, 1, 1); g.fillRect(px, py + 1, 3, 2); g.fillRect(px, py + 3, 1, 2); g.fillRect(px + 2, py + 3, 1, 2);
  }

  const ultimoOficio = new Map(), cambioVisto = new Map(), ultimaDir = new Map(), humoTiro = new Set();
  let quietos = [], gritos = [];
  // El dibujo de un aldeano (también para su caída).
  function figura(a, col, paso, alto, carga, corre) {
    const oficio = V.OFICIOS[a.o], nino = (a.edad || 0) < V.ADULTO;
    return ARTE().aldeano({
      col, oficio: nino ? 'nino' : oficio, edad: nino ? 'nino' : (a.edad || 0) >= V.VIEJO ? 'viejo' : 'adulto',
      paso: paso || 0, corre: !!corre, alto: alto || 0, carga: carga || 0,
      arma: oficio === 'guerrero' ? a.arma || 0 : 0, tirador: oficio === 'guerrero' && !!a.tirador, armadura: oficio === 'guerrero' ? a.armadura || 0 : 0,
      piel: (a.c + (a.id % 6 === 0 ? 1 : 0)) % 4, pelo: a.id % 4,
      sabio: oficio === 'erudito' ? M.ERUDITO((S.civ(m, a.c) || { era: 0 }).era).tipo : undefined,
      // Mercaderes con gremio, banqueros y empresarios con su traje: casaca y sombrero; desde la Revolución Industrial, chistera.
      // (El comerciante de siempre lleva su gorro; el mercader con gremio, el banquero y el empresario, su traje.)
      traje: nino || (!a.emp && !a.merc) ? 0 : ((S.civ(m, a.c) || { era: 0 }).era >= 6 ? 2 : 1)
    });
  }
  const durmiendo = new Set();
  function sueno(ahora, x0, y0, x1, y1) {
    if (!durmiendo.size) return;
    const v = m.vida;
    g.font = 'bold 5px monospace'; g.textAlign = 'left';
    for (const t of durmiendo) {
      const x = (t % v.tw) * P + 10, y = Math.floor(t / v.tw) * P - 1;
      if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      const f = ((ahora / 1600) + (t % 7) / 7) % 1;
      g.fillStyle = 'rgba(220,230,255,' + (0.9 * (1 - f)).toFixed(2) + ')';
      g.fillText('z', x + f * 3, y - f * 6); if (f > 0.4) g.fillText('Z', x + 2 + f * 3, y - 3 - f * 6);
    }
  }
  // Las estaciones: el otoño dora el campo, el invierno lo blanquea y nieva en todo el reino.
  let estVista = { e: null, antes: null, desde: 0 };
  function estaciones(ahora, x0, y0, x1, y1) {
    const e = m.vida.estacion;
    if (e == null || e < 0) return;
    // La estación cambia poco a poco (unos segundos de fundido), no de golpe al empezar el turno.
    if (e !== estVista.e) { estVista = { e, antes: estVista.e, desde: ahora }; }
    const fun = estVista.antes == null ? 1 : Math.min(1, (ahora - estVista.desde) / 6000);
    const cols = [[150, 230, 120, 0.05], null, [230, 140, 40, 0.11], [235, 242, 255, 0.22]];
    const capa = (c, a) => { if (c && a > 0.003) { g.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] * a).toFixed(3) + ')'; g.fillRect(x0, y0, x1 - x0, y1 - y0); } };
    if (fun < 1 && estVista.antes != null) capa(cols[estVista.antes], 1 - fun);
    capa(cols[e], fun);
    const nieva = e === 3 ? fun : estVista.antes === 3 ? 1 - fun : 0;
    if (nieva <= 0.02 || reducido) return;
    const n = Math.min(260, Math.round((x1 - x0) * (y1 - y0) / 900 * nieva));
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < n; i++) {
      const wx = x0 + ((azarV(i * 17) * (x1 - x0) + Math.sin(ahora / 800 + i) * 4) % (x1 - x0)), wy = y0 + ((azarV(i * 31) * (y1 - y0) + ahora / 45 * (0.5 + azarV(i + 3))) % (y1 - y0));
      g.fillRect(Math.floor(wx), Math.floor(wy), i % 4 ? 1 : 2, 1);
    }
  }
  // Las obras a medias: cimientos, postes y tablones; el edificio va asomando según avanza.
  function andamios(ahora, x0, y0, x1, y1) {
    const v = m.vida, an = v.andamios;
    if (!an) return;
    for (const k of Object.keys(an)) {
      const t = +k, x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      if (x + P < x0 || y + P < y0 || x > x1 || y > y1) continue;
      const o = an[k], f = 1 - Math.max(0, o.falta) / o.total, alto_ = Math.round(2 + f * 10);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 1, y + 14, 14, 2);
      g.fillStyle = '#8a8478'; g.fillRect(x + 2, y + 13, 12, 2);
      g.fillStyle = f < 0.5 ? '#b08a5a' : '#c8b494'; g.fillRect(x + 3, y + 13 - alto_, 10, alto_);
      if (f >= 0.5) { g.fillStyle = '#6a4a32'; g.fillRect(x + 6, y + 10, 3, 3); }
      g.fillStyle = '#7a5530';
      for (const px of [1, 7, 14]) g.fillRect(x + px, y + 1, 1, 13);
      for (const py of [4, 8, 12]) g.fillRect(x + 1, y + py, 14, 1);
      g.fillStyle = '#5a3c20'; g.fillRect(x + 1, y + 4, 1, 1); g.fillRect(x + 14, y + 8, 1, 1);
      if (Math.floor(ahora / 500 + t) % 9 === 0) emitir(x + 8, y + 12, 2, { v: 12, g: 40, vida: 500, cols: ['#c8b494', '#a89474'], tipo: 'solido', tam: 0.8, dy: -8, suelo: 1 });
      g.fillStyle = 'rgba(10,12,20,0.75)'; g.fillRect(x + 0.5, y - 4.5, 15, 3);
      g.fillStyle = '#ffb04a'; g.fillRect(x + 1, y - 4, Math.max(1, 14 * f), 2);
    }
  }
  const civPorId = new Map(), rutaPorId = new Map();
  // Las trincheras de la Segunda Guerra Mundial: una zanja de tierra oscura que sigue la frontera, con sacos
  // terreros en los bordes y, delante (hacia el rival), postes y alambre de espino.
  function trincheras(x0, y0, x1, y1) {
    const v = m.vida, T = v.trinchera; if (!T) return;
    const tw = v.tw, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = ty * tw + tx; if (!T[t]) continue;
      const x = tx * P, y = ty * P, d = m.dueno[V.region(m, t)];
      const conecta = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const n = t + dx + dy * tw; return tx + dx >= 0 && tx + dx < tw && T[n]; });
      const tramo = (dx, dy) => { // de la mitad de la casilla hacia ese lado
        g.fillStyle = '#3a2a1c'; g.fillRect(x + (dx > 0 ? 6 : dx < 0 ? 0 : 5), y + (dy > 0 ? 6 : dy < 0 ? 0 : 5), dx ? 10 : 6, dy ? 10 : 6);
      };
      g.fillStyle = '#3a2a1c'; g.fillRect(x + 5, y + 5, 6, 6);
      for (const [dx, dy] of conecta) tramo(dx, dy);
      g.fillStyle = '#2a1e14'; g.fillRect(x + 6, y + 6, 4, 4);
      // Sacos terreros alrededor de la zanja.
      g.fillStyle = '#c8b078';
      for (let q = 0; q < 16; q += 3) { if (!conecta.some(([dx, dy]) => dy === -1)) g.fillRect(x + q, y + 3, 2, 1.5); if (!conecta.some(([dx, dy]) => dy === 1)) g.fillRect(x + q, y + 11.5, 2, 1.5); }
      for (let q = 0; q < 16; q += 3) { if (!conecta.some(([dx]) => dx === -1)) g.fillRect(x + 3, y + q, 1.5, 2); if (!conecta.some(([dx]) => dx === 1)) g.fillRect(x + 11.5, y + q, 1.5, 2); }
      // El alambre de espino, del lado del rival.
      if (T[t] === 2) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = t + dx + dy * tw; if (n < 0 || n >= T.length || m.dueno[V.region(m, n)] === d) continue;
          g.fillStyle = '#5a4a3a'; g.strokeStyle = '#9aa0a8'; g.lineWidth = 0.6;
          if (dx) { const xx = x + (dx > 0 ? 15 : 0.5); g.fillRect(xx - 0.5, y + 2, 1, 3); g.fillRect(xx - 0.5, y + 11, 1, 3); g.beginPath(); for (let q = 0; q <= 16; q += 2) g.lineTo(xx + (q % 4 ? 1 : -1), y + q); g.stroke(); }
          else { const yy = y + (dy > 0 ? 15 : 0.5); g.fillRect(x + 2, yy - 2, 1, 3); g.fillRect(x + 12, yy - 2, 1, 3); g.beginPath(); for (let q = 0; q <= 16; q += 2) g.lineTo(x + q, yy + (q % 4 ? 1 : -1)); g.stroke(); }
        }
      }
    }
  }
  // Las vías: su propia línea de estación a estación (no van sobre los caminos, solo los cruzan), con
  // traviesas de madera y dos raíles; en los cruces con una calle, un paso a nivel. Por cada línea va y viene
  // un tren (de vapor en la era industrial, diésel en la moderna) mientras haya carbón y paz.
  function vias(x0, y0, x1, y1, ahora) {
    const v = m.vida, tw = v.tw;
    for (const k of Object.keys(v.vias || {})) {
      const L = v.vias[k], T = L.tiles;
      for (let i = 0; i < T.length; i++) {
        const t = T[i]; if (visto.obra[t] && visto.obra[t] !== V.OBRA.campo) continue;
        const x = (t % tw) * P, y = Math.floor(t / tw) * P;
        if (x + P < x0 || y + P < y0 || x > x1 || y > y1) continue;
        const ant = T[Math.max(0, i - 1)], sig = T[Math.min(T.length - 1, i + 1)];
        const h = n => n !== t && Math.floor(n / tw) === Math.floor(t / tw), w = n => n !== t && n % tw === t % tw;
        const izq = [ant, sig].some(n => h(n) && n < t), der = [ant, sig].some(n => h(n) && n > t), arr = [ant, sig].some(n => w(n) && n < t), aba = [ant, sig].some(n => w(n) && n > t);
        const cruce = visto.camino[t];
        // Traviesas y raíles por cada lado por el que sigue la vía (así las curvas quedan unidas).
        const tramo = (hx, hy, ww, hh, horiz) => {
          g.fillStyle = '#5a3c22';
          if (horiz) for (let q = hx + 1; q < hx + ww; q += 3) g.fillRect(x + q, y + 5, 1.5, 6);
          else for (let q = hy + 1; q < hy + hh; q += 3) g.fillRect(x + 5, y + q, 6, 1.5);
          g.fillStyle = '#a8aeb8';
          if (horiz) { g.fillRect(x + hx, y + 6, ww, 1); g.fillRect(x + hx, y + 9, ww, 1); }
          else { g.fillRect(x + 6, y + hy, 1, hh); g.fillRect(x + 9, y + hy, 1, hh); }
        };
        if (izq) tramo(0, 0, 8, 0, true); if (der) tramo(8, 0, 8, 0, true);
        if (arr) tramo(0, 0, 0, 8, false); if (aba) tramo(0, 8, 0, 8, false);
        if (!izq && !der && !arr && !aba) tramo(0, 0, P, 0, true);
        if (cruce) { g.fillStyle = '#e8e4d8'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 13, y + 13, 1, 1); g.fillStyle = '#d83a32'; g.fillRect(x + 1, y + 1, 1, 2); }
      }
      // El tren de esta línea.
      const ru = rutaPorId.get(L.ru), a = ru ? civPorId.get(ru.a) : null, b = ru ? civPorId.get(ru.b) : null;
      const dueno = a && a.estaciones > 0 && a.era >= 6 ? a : b;
      const activa = ru && a && b && !(a.guerras || []).some(gg => gg.con === b.id);
      if (!dueno || !activa || !V.enMarcha(dueno, 'tren') || T.length < 4) continue;
      trenEnVia(T, ahora, dueno, k);
    }
  }
  // Un tren por su vía: la locomotora delante y dos vagones detrás, cada pieza siguiendo las curvas.
  let ultimosTrenes = [];
  function trenEnVia(T, ahora, c, k) {
    const tw = m.vida.tw, n = T.length - 1, ms = c.era >= 7 ? 160 : 240, vuelta = n * 2 * ms + 3000;
    let h = 0; for (let q = 0; q < k.length; q++) h = (h * 31 + k.charCodeAt(q)) | 0;
    const f = ((ahora + Math.abs(h) % vuelta) % vuelta);
    // Va, espera un poco en la estación y vuelve.
    const ida = f < n * ms, quieto = f >= n * ms && f < n * ms + 1500 || f >= 2 * n * ms + 1500;
    let s = ida ? f / ms : quieto ? (f < n * ms + 1500 ? n : 0) : n - (f - n * ms - 1500) / ms;
    s = Math.max(0, Math.min(n, s));
    const sentido = ida ? 1 : -1, pos = q => { const qq = Math.max(0, Math.min(n, q)), i = Math.floor(qq), j = Math.min(n, i + 1), fr = qq - i; const ax = T[i] % tw, ay = Math.floor(T[i] / tw), bx = T[j] % tw, by = Math.floor(T[j] / tw); return [(ax + (bx - ax) * fr) * P + 8, (ay + (by - ay) * fr) * P + 8, bx - ax, by - ay]; };
    const col = c.color || '#ccc';
    ultimosTrenes.push([k, pos(s)[0], pos(s)[1]]); if (ultimosTrenes.length > 12) ultimosTrenes.shift();
    for (let p = 2; p >= 0; p--) {
      const [x, y, dx, dy] = pos(s - sentido * p * 0.55), horiz = dx !== 0 || dy === 0;
      const w = horiz ? 7 : 4, hh = horiz ? 4 : 7, X = Math.round(x - w / 2), Y = Math.round(y - hh / 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, Y + hh, w, 1);
      if (p === 0) {
        g.fillStyle = c.era >= 7 ? '#c84a3a' : '#2a2e34'; g.fillRect(X, Y, w, hh);
        g.fillStyle = c.era >= 7 ? '#f0d040' : '#c8a040'; if (horiz) g.fillRect(X, Y + hh - 1, w, 0.6); else g.fillRect(X + w - 1, Y, 0.6, hh);
        g.fillStyle = 'rgba(255,240,180,0.9)'; g.fillRect(horiz ? (sentido * (dx || 1) > 0 ? X + w - 0.5 : X - 0.5) : X + 1.5, horiz ? Y + 1.5 : (sentido * dy > 0 ? Y + hh - 0.5 : Y - 0.5), 1, 1);
        if (c.era < 7 && !quieto && Math.random() < 0.3) emitir(X + w / 2, Y - 1, 1, { v: 6, g: -12, vida: 900, cols: ['#d8d8dc', '#b8b8c0', '#ffffff'], tipo: 'humo', tam: 1.4, dy: -10 });
      } else {
        g.fillStyle = p === 1 ? col : mezclar(col, '#000000', 0.25); g.fillRect(X, Y, w, hh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(X, Y, w, 0.6);
      }
    }
  }
  // El tráfico: coches por las calles de las ciudades modernas y coches de caballos en la era industrial.
  let coches = [], cochesTurno = -1;
  function trafico(ahora, x0, y0, x1, y1) {
    const v = m.vida, tw = v.tw;
    if (cochesTurno !== m.turno) {
      cochesTurno = m.turno;
      const porCiv = new Map();
      for (let t = 0; t < tw * v.th; t++) { if (!visto.camino[t]) continue; const d = m.dueno[V.region(m, t)]; const c = d >= 0 ? civPorId.get(d) : null; if (!c || c.era < 6 || (c.nivel || 0) < 3) continue; (porCiv.get(d) || porCiv.set(d, []).get(d)).push(t); }
      const vivos = coches.filter(k => visto.camino[k.t] && porCiv.has(k.civ));
      coches = vivos;
      for (const [d, lista] of porCiv) {
        const quiere = Math.min(14, Math.floor(lista.length / 10)), tiene = coches.filter(k => k.civ === d).length;
        for (let i = tiene; i < quiere; i++) { const t = lista[Math.floor(Math.random() * lista.length)]; coches.push({ civ: d, t, sig: t, desde: ahora, ant: -1, col: ['#c83a3a', '#3a6ac8', '#e8e0d0', '#2a2a2a', '#3a9a5a', '#e0b040'][i % 6] }); }
      }
    }
    for (const k of coches) {
      const c = civPorId.get(k.civ), dur = c && c.era >= 7 ? 700 : 1300;
      if (ahora - k.desde > dur) {
        k.ant = k.t; k.t = k.sig; k.desde = ahora;
        const op = [k.t - 1, k.t + 1, k.t - tw, k.t + tw].filter(n => n >= 0 && n < tw * v.th && visto.camino[n] && n !== k.ant && Math.abs((n % tw) - (k.t % tw)) <= 1);
        k.sig = op.length ? op[Math.floor(Math.random() * op.length)] : k.ant >= 0 ? k.ant : k.t;
      }
      const f = Math.min(1, (ahora - k.desde) / dur), ax = k.t % tw, ay = Math.floor(k.t / tw), bx = k.sig % tw, by = Math.floor(k.sig / tw);
      const x = (ax + (bx - ax) * f) * P + 5, y = (ay + (by - ay) * f) * P + 6 + (bx !== ax ? (bx > ax ? 1 : -1) : 0);
      if (x < x0 - 8 || y < y0 - 8 || x > x1 + 8 || y > y1 + 8) continue;
      const horiz = bx !== ax || by === ay;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 3, horiz ? 6 : 3, 1);
      if (c && c.era >= 7) {
        // Coche: carrocería del color, techo y ventanillas, faros.
        if (horiz) { g.fillStyle = k.col; g.fillRect(x, y, 6, 3); g.fillStyle = '#a8c8e8'; g.fillRect(x + 1.5, y - 1, 3, 1.2); g.fillStyle = '#1a1a1a'; g.fillRect(x + 1, y + 2.6, 1, 0.8); g.fillRect(x + 4, y + 2.6, 1, 0.8); }
        else { g.fillStyle = k.col; g.fillRect(x + 1, y - 2, 3, 6); g.fillStyle = '#a8c8e8'; g.fillRect(x + 1.5, y - 1, 2, 1.5); }
      } else {
        // Coche de caballos: el caballo delante y la caja detrás.
        const dir = bx >= ax ? 1 : -1;
        g.fillStyle = '#7a5030'; g.fillRect(x + (dir > 0 ? 4 : 0), y, 2, 2); g.fillRect(x + (dir > 0 ? 5 : 0), y - 1, 1, 1);
        g.fillStyle = '#2a2a2e'; g.fillRect(x + (dir > 0 ? 0 : 2), y - 1, 4, 3); g.fillStyle = '#c8a040'; g.fillRect(x + (dir > 0 ? 0 : 2), y - 1, 4, 0.6);
      }
    }
  }
  // Cada aldeano lleva su propio compás: va entre medio paso y casi un paso por detrás del reloj del turno (lo que
  // le falta lo saca de su recorrido del turno anterior). Así no llegan todos a la vez a cada casilla ni cambian
  // todos de tarea en el mismo instante al empezar el turno: el pueblo se mueve como gente, no a golpe de tambor.
  // (Los soldados van al compás exacto, para que los golpes y los disparos casen con quien los recibe.)
  const rVisto = new WeakMap(), rAntes = new WeakMap();
  const desfase = a => (a.o === 4 ? 0 : 0.15 + ((a.id * 0.6180339) % 1) * 0.8);
  function aldeanos(k, ahora, x0, y0, x1, y1) {
    civPorId.clear(); for (const c of m.civs) civPorId.set(c.id, c);
    rutaPorId.clear(); for (const ru of m.vida.rutas || []) rutaPorId.set(ru.id, ru);
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    const ig = golpesDelTurno(v);
    dibujados.clear(); quietos = []; gritos = []; durmiendo.clear();
    const fiesta = new Set(), hambre = new Set();
    for (const c of S.vivas(m)) { if (c.plan && c.plan.ultimaFiesta != null && m.turno - c.plan.ultimaFiesta <= 1) fiesta.add(c.id); if ((c.comida || 0) < (c.aldeanos || 0) * 0.15) hambre.add(c.id); }
    const vivos = gente || v.aldeanos, todos = caidos.length ? vivos.concat(caidos.filter(x => !x.animal && k < x.paso).map(x => x.a)) : vivos;
    for (const a of todos) {
      if (a.aBordo != null) continue; // va en un transporte: se le ve en cubierta
      let r = rVisto.get(a) || a.r, kk = k - desfase(a);
      if (kk < 0) { const r0 = rAntes.get(a); if (r0 && r0.length >= 6 && r && r0[r0.length - 3] === r[0] && r0[r0.length - 2] === r[1]) { r = r0; kk += V.TICKS; } else kk = 0; }
      const paso = Math.min(V.TICKS - 1, Math.floor(kk)), f = Math.min(1, kk - paso);
      let px, py, acc;
      if (r && r.length >= 6) {
        const i = paso * 3, j = Math.min(r.length - 3, i + 3);
        const ax = r[i], ay = r[i + 1], bx = r[j], by = r[j + 1];
        px = (ax + (bx - ax) * f) * P + 6.5; py = (ay + (by - ay) * f) * P + 6;
        acc = r[j + 2];
        if (j === i) acc = r[i + 2];
      } else { px = a.x * P + 6.5; py = a.y * P + 6; acc = 0; }
      if (siguiendo === a.id) { cam.x = px; cam.y = py; }
      // Quien duerme y ya llegó a casa no se ve: solo sale el «zZ» sobre el tejado.
      if (a.dormir && a.casa != null && Math.floor((py - 6) / P) * v.tw + Math.floor((px - 6.5) / P) === a.casa) { durmiendo.add(a.casa); continue; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // Recibe un golpe: sale despedido un par de píxeles lejos de quien le pega. Pega: embiste hacia el otro.
      const recibe = golpeActivo(ig.golpes.get(a.id), k), pega = golpeActivo(ig.ataques.get(a.id), k);
      // Retroceso al recibir (sale despedido y vuelve frenando) y embestida al pegar: curvas suaves, no saltos.
      if (recibe) { const [gp, d] = recibe, emp = 2.5 * (1 - d) * (1 - d); px += Math.sign(a.x - gp[2]) * emp; py += Math.sign(a.y - gp[3]) * emp - Math.sin(Math.PI * Math.min(1, d * 2)); }
      if (pega) { const [at, d] = pega, emb = 2.2 * Math.sin(Math.PI * Math.min(1, d * 1.25)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
      // A medio píxel (un píxel del dibujo): el movimiento es continuo y no va a saltos de casilla.
      px = Math.round(px * 2) / 2; py = Math.round(py * 2) / 2;
      dibujados.set(a.id, [px, py]);
      // Modo tropas: un aro verde bajo cada soldado elegido.
      if (tropas && tropas.sel.has(a.id)) { g.strokeStyle = '#6dff7a'; g.lineWidth = 1; g.beginPath(); g.ellipse(px + 1.5, py + 5.5, 4.5, 2, 0, 0, Math.PI * 2); g.stroke(); }
      if (elegido === a.id) { const f2 = Math.floor(performance.now() / 300) % 2; g.fillStyle = '#ffd23a'; g.fillRect(px, py - 6 - f2, 3, 1); g.fillRect(px + 1, py - 5 - f2, 1, 1); g.strokeStyle = 'rgba(255,210,58,0.8)'; g.lineWidth = 0.6; g.strokeRect(px - 2.5, py - 2, 8, 8.5); }
      const anda = r && r.length >= 6 && (r[paso * 3] !== r[Math.min(r.length - 3, paso * 3 + 3)] || r[paso * 3 + 1] !== r[Math.min(r.length - 3, paso * 3 + 3) + 1]);
      const t = Math.floor(ahora / 150 + a.id) % 2;
      // En el agua (sin puente) no se camina: se nada, con la cabeza fuera y ondas alrededor.
      const tAhora = Math.floor((py + 4) / P) * v.tw + Math.floor((px + 1) / P), ta = tierra[tAhora];
      if (((ta === 'agua' || ta === 'bajo' || ta === 'rio') && !(visto.camino && visto.camino[tAhora])) || (v.inundado && v.inundado[tAhora])) {
        const brazo = Math.floor(ahora / 260 + a.id) % 2;
        if (Math.random() < 0.035) emitir(px + 1.5, py + 4, 3, { v: 10, g: 60, vida: 450, cols: ['#e8f4ff', '#a8d0f0', '#ffffff'], tipo: 'solido', tam: 0.7, dy: -14, suelo: 1 });
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(px - 2 - brazo, py + 4, 7 + brazo * 2, 1); g.fillRect(px - 1, py + 5, 5, 1);
        g.fillStyle = color[a.c] || '#cccccc'; g.fillRect(px, py + 3, 3, 1);
        g.fillStyle = '#f0c8a0'; g.fillRect(px + 1, py + 2, 1, 1); g.fillRect(brazo ? px - 1 : px + 3, py + 3 - brazo, 1, 1);
        continue;
      }
      // Tanques y cañones: el vehículo mira hacia donde va (o hacia el enemigo al que dispara).
      if (a.veh) {
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dir = r && r.length >= 6 && r[j] !== r[i] ? Math.sign(r[j] - r[i]) : pega ? Math.sign(pega[0][2]) || 1 : (ultimaDir.get(a.id) || 1);
        ultimaDir.set(a.id, dir);
        // A buen tamaño: un tanque ocupa casi una parcela; un cañón, más que un soldado.
        const img = ARTE().vehiculo(a.veh, color[a.c] || '#cccccc', anda && t ? 1 : 0), EV = a.veh === 'tanque' ? 1 : a.veh === 'artilleria' ? 0.95 : 0.85;
        const w = img.width * EV, h = img.height * EV, vx = px + 1.5 - w / 2, vy = py + 6 - h;
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(vx + 1, py + 5.5, w - 2, 1);
        g.save(); if (dir < 0) { g.translate(vx * 2 + w, 0); g.scale(-1, 1); }
        g.drawImage(img, vx, vy, w, h);
        if (recibe) { g.globalAlpha = recibe[1] < 0.45 ? 0.85 : 0.4; g.drawImage(ARTE().tenido(img, recibe[1] < 0.45 ? '#ff2a2a' : '#ffffff'), vx, vy, w, h); g.globalAlpha = 1; }
        g.restore();
        if (acc === 2) { const fx = dir > 0 ? vx + w : vx - 2; g.fillStyle = Math.floor(ahora / 80) % 2 ? '#fff6a0' : '#ff9a3a'; g.fillRect(fx, vy + (a.veh === 'tanque' ? 1 : 1.5), 2, 1.5); g.fillStyle = 'rgba(200,200,200,0.5)'; g.fillRect(fx - dir, vy - 1, 2, 1); }
        const ej = m.vida.ejercitos && m.vida.ejercitos[a.c];
        if (ej && ej.capitan === a.id) { g.fillStyle = '#2a1e14'; g.fillRect(px - 1, py - 8, 1, 10); g.fillStyle = color[a.c] || '#ccc'; g.fillRect(px, py - 8, 6, 4); }
        if (a.pv0 != null) {
          const max = V.vidaMax(a); let pv = a.pv0;
          for (const gp of ig.golpes.get(a.id) || []) if (k >= gp[1] - 0.5) pv -= gp[4];
          if (pv < max) { const fr = Math.max(0, pv / max); g.fillStyle = 'rgba(40,10,10,0.75)'; g.fillRect(vx, vy - 2, w, 1); g.fillStyle = fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030'; g.fillRect(vx, vy - 2, Math.max(1, w * fr), 1); }
        }
        continue;
      }
      // El aldeano: un dibujo de 12×14 con contorno (arte.js), según su oficio, edad, equipo y lo que hace.
      const oficio = V.OFICIOS[a.o], nino = (a.edad || 0) < V.ADULTO;
      // El ciclo de andar va con lo que avanza (cuatro tiempos por casilla, más deprisa si corre por el camino),
      // el trabajo sube y baja la herramienta en tres tiempos, y el golpe cuerpo a cuerpo es alzar, bajar y golpear.
      let fase = 0, corre = false, sube = 0;
      if (anda && r) {
        const i0 = paso * 3, j0 = Math.min(r.length - 3, i0 + 3), tramo = Math.abs(r[j0] - r[i0]) + Math.abs(r[j0 + 1] - r[i0 + 1]);
        corre = oficio === 'guerrero' && (tramo >= 2 || (acc === 2 && !a.tirador));
        fase = 1 + (Math.floor((paso + f) * 4 * Math.max(1, tramo)) + (a.id & 3)) % 4;
        if (fase === 2 || fase === 4) sube = corre ? 1 : 0.5;
      }
      const alto = pega && oficio === 'guerrero' && !a.tirador ? (pega[1] < 0.35 ? -1 : pega[1] < 0.6 ? 0 : 1)
        : acc === 1 || acc === 2 ? [-1, 0, 1, 0][Math.floor(ahora / 210 + a.id) % 4] : 0;
      // Mira hacia donde va (o hacia quien golpea).
      let mira = ultimaDir.get(a.id) || 1;
      if (r && r.length >= 6) { const i0 = paso * 3, j0 = Math.min(r.length - 3, i0 + 3), dx0 = r[j0] - r[i0]; if (dx0) mira = Math.sign(dx0); }
      if (pega && pega[0][2]) mira = Math.sign(pega[0][2]);
      ultimaDir.set(a.id, mira);
      // En plena batalla, el tirador que acaba de disparar no anda: se pone en posición de tiro (de pie con la
      // honda, tensando el arco, de rodillas con el arcabuz o la espingarda, cuerpo a tierra con el fusil
      // moderno), mira al blanco y, al soltar, sale el fogonazo y el arma retrocede.
      const cv_ = oficio === 'guerrero' && a.tirador && !nino && a.fuego && m.turno - a.fuego.turno <= 1 && !anda ? civPorId.get(a.c) : null;
      const pose = cv_ && cv_.guerras && cv_.guerras.length ? (cv_.era >= 7 ? 'tierra' : cv_.era >= 5 ? 'rodilla' : (a.arma || 0) >= 1 ? 'arco' : 'apunta') : null;
      let suelta = null;
      if (pose) for (const d of v.disparos || []) if (d[6] === a.id && k >= d[4] - 1.6 && k < d[4] - 0.7) { suelta = k >= d[4] - 1 ? (k - (d[4] - 1)) / 0.3 : -1; break; }
      const dirTiro = pose ? (a.fuego.dx || 1) : 1;
      const img = pose ? ARTE().tiradorEnPose({ col: color[a.c] || '#cccccc', pose, tenso: pose === 'arco' && !(suelta != null && suelta >= 0), arma: a.arma || 0, armadura: a.armadura || 0, piel: (a.c + (a.id % 6 === 0 ? 1 : 0)) % 4, pelo: a.id % 4 })
        : figura(a, color[a.c] || '#cccccc', fase, alto, acc === 3 ? (oficio === 'minero' ? 2 : oficio === 'granjero' ? 3 : 1) : 0, corre);
      // A media escala: el dibujo tiene detalle al acercarse, pero una persona mide un tercio de una casa.
      const ix = px - 1.5, iy = py - 1, EA = 0.5;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - 1, py + 5, 5, 1);
      // El comerciante que va en tren no se ve por la carretera: su carga viaja en los vagones.
      if (oficio === 'comerciante' && !nino && a.enTren && a.e === 5) continue;
      if (oficio === 'comerciante' && !nino && a.camion && a.e === 5) {
        // El camión de la Era Moderna: cabina del color del reino, caja de carga y ruedas; con humo del tubo.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const d = dirX || (dirY ? 0 : 1), cx = px - 3, cy = py;
        const col = color[a.c] || '#ccc';
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx, cy + 5, 9, 1);
        g.fillStyle = '#d8d0b8'; g.fillRect(d >= 0 ? cx : cx + 3, cy, 6, 4); g.fillStyle = '#b8b0a0'; g.fillRect(d >= 0 ? cx : cx + 3, cy + 3, 6, 1);
        g.fillStyle = col; g.fillRect(d >= 0 ? cx + 6 : cx, cy + 1, 3, 3); g.fillStyle = '#a8d0e8'; g.fillRect(d >= 0 ? cx + 7 : cx, cy + 1, 1.5, 1.2);
        g.fillStyle = '#1e1e22'; for (const wx of [1, 4, 7]) g.fillRect(cx + wx, cy + 4, 1.4, 1.4);
        if (Math.random() < 0.08) emitir(d >= 0 ? cx - 0.5 : cx + 9.5, cy + 3, 1, { v: 4, g: -6, vida: 700, cols: ['#8a8a90', '#a8a8b0'], tipo: 'humo', tam: 1 });
        continue;
      }
      if (oficio === 'comerciante' && !nino) {
        // La carreta va detrás del comerciante, según hacia dónde camina.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const cx = px - (dirX || (dirY ? 0 : 1)) * 6 - 1, cy = py + 1 - dirY * 5;
        g.fillStyle = '#2a1e14'; g.fillRect(cx - 0.5, cy + 0.5, 7, 4);
        g.fillStyle = '#3a2a1e'; g.fillRect(cx + 1, cy + 4, 1, 1); g.fillRect(cx + 4, cy + 4, 1, 1);
        g.fillStyle = '#9a6a3a'; g.fillRect(cx, cy + 1, 6, 3); g.fillStyle = '#7a5028'; g.fillRect(cx, cy + 3, 6, 0.5);
        // Lo que lleva se ve: sacos de grano, troncos, piedras, lingotes o un fardo de armas; vacía, unas cajas.
        const cg = a.carga && a.carga.que;
        if (cg === 'comida') { g.fillStyle = '#e8d08a'; g.fillRect(cx + 0.5, cy - 0.5, 2, 2); g.fillRect(cx + 3, cy - 1, 2, 2.5); g.fillStyle = '#c8a050'; g.fillRect(cx + 1, cy - 0.5, 1, 0.5); g.fillRect(cx + 3.5, cy - 1, 1, 0.5); }
        else if (cg === 'madera') { g.fillStyle = '#7a4a24'; g.fillRect(cx, cy - 1, 6, 1); g.fillRect(cx + 0.5, cy, 5, 1); g.fillStyle = '#c89a62'; g.fillRect(cx, cy - 1, 0.6, 1); g.fillRect(cx + 0.5, cy, 0.6, 1); }
        else if (cg === 'piedra') { g.fillStyle = '#a8a49a'; g.fillRect(cx + 0.5, cy - 1, 2, 2); g.fillRect(cx + 3, cy - 0.5, 2.5, 1.5); g.fillStyle = '#7e7a72'; g.fillRect(cx + 2, cy, 1, 1); }
        else if (cg === 'metal') { g.fillStyle = '#9aa4b0'; g.fillRect(cx + 0.5, cy - 0.5, 2.5, 1); g.fillRect(cx + 3, cy - 0.5, 2.5, 1); g.fillStyle = '#d0d8e0'; g.fillRect(cx + 1, cy - 1, 4, 0.5); }
        else if (cg === 'armas') { g.fillStyle = '#d0d4dc'; g.fillRect(cx, cy - 1.5, 6, 0.6); g.fillRect(cx + 1, cy - 0.5, 5, 0.6); g.fillStyle = '#6a4220'; g.fillRect(cx + 4.5, cy - 1.8, 1, 1.4); }
        else { g.fillStyle = '#e0c050'; g.fillRect(cx + 1, cy, 1.5, 1.5); g.fillStyle = '#c84a3a'; g.fillRect(cx + 2.5, cy, 1.5, 1.5); g.fillStyle = '#4a8ad0'; g.fillRect(cx + 4, cy, 1.5, 1.5); }
      }
      // En fiesta, la gente que no trabaja baila (da saltitos al ritmo).
      const baila = fiesta.has(a.c) && acc === 0 && !anda && Math.sin(ahora / 140 + a.id) > 0.3;
      // Dentro de la trinchera solo asoma de cintura para arriba.
      const enZanja = oficio === 'guerrero' && !anda && v.trinchera && v.trinchera[Math.floor(py / P) * v.tw + Math.floor(px / P)];
      if (enZanja) { g.save(); g.beginPath(); g.rect(px - 8, py - 12, 18, 17); g.clip(); g.translate(0, 1.5); }
      if (pose) {
        // Retroceso al disparar (medio píxel hacia atrás) y el dibujo volteado si el blanco está a la izquierda.
        // El retroceso: un golpe hacia atrás al disparar que vuelve suave.
        const atras = suelta != null && suelta >= 0 && pose !== 'arco' ? -0.5 * (1 - suelta) * dirTiro : 0;
        g.save(); if (dirTiro < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(img, ix + atras * dirTiro, iy, img.width * EA, img.height * EA);
        g.restore();
        if (suelta != null && suelta >= 0 && pose !== 'arco') {
          const [bx_, by_] = ARTE().BOCA[pose], fx = dirTiro > 0 ? ix + bx_ * EA : 2 * (px + 1.5) - (ix + bx_ * EA), fy = iy + by_ * EA;
          // Fogonazo en estrella que se apaga deprisa: naranja, amarillo y el centro blanco.
          const fl = 1 - suelta, ox = dirTiro > 0 ? 0 : -1;
          g.globalAlpha = Math.max(0, fl);
          g.fillStyle = '#ff9a3a'; g.fillRect(fx + ox * 3, fy - 1, 3, 2);
          g.fillStyle = '#ffd23a'; g.fillRect(fx + ox * 2.5 + (dirTiro > 0 ? 0.5 : 0), fy - 1.5, 2, 3); g.fillRect(fx + (dirTiro > 0 ? 2.5 : -3.5), fy - 0.5, 1, 1);
          g.fillStyle = '#fff6c0'; g.fillRect(fx + (dirTiro > 0 ? 0.5 : -1.5), fy - 0.5, 1, 1);
          g.globalAlpha = 1;
          const clave_ = a.id + ':' + m.turno + ':' + Math.floor(k);
          if (!humoTiro.has(clave_)) { humoTiro.add(clave_); if (humoTiro.size > 400) humoTiro.clear(); emitir(fx + dirTiro, fy, 3, { v: 8, g: -6, vida: 900, cols: ['#e8e8ec', '#c8c8d0'], tipo: 'humo', tam: 1.4 }); }
        }
      }
      else {
        // Volteado si va hacia la izquierda; el balanceo del paso sube el cuerpo medio píxel.
        g.save(); if (mira < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(img, ix, iy - (baila ? 1 : 0) - sube, img.width * EA, img.height * EA);
        g.restore();
      }
      if (enZanja) g.restore();
      // Partículas del trabajo: astillas, lascas, terrones, polvo de obra, y la chispa de una idea.
      if (acc === 1 && !nino && Math.random() < 0.07) {
        const hx = px + 4.5, hy = py + 3;
        if (oficio === 'lenador') emitir(hx, hy, 3, { v: 18, g: 90, vida: 600, cols: ['#c8a070', '#8a5a2b', '#e0c090'], tipo: 'solido', tam: 0.7, dy: -16 });
        else if (oficio === 'minero') emitir(hx, hy, 3, { v: 20, g: 100, vida: 550, cols: ['#9a98a2', '#c8c4cc', '#6a6870'], tipo: 'solido', tam: 0.7, dy: -18 });
        else if (oficio === 'granjero') emitir(hx, hy + 2, 2, { v: 12, g: 90, vida: 500, cols: ['#6a4a2a', '#8a6a3a', '#e0c050'], tipo: 'solido', tam: 0.7, dy: -12 });
        else if (oficio === 'constructor') { emitir(hx, hy + 2, 2, { v: 6, g: -4, vida: 900, cols: [POLVO], tipo: 'humo', tam: 2 }); if (Math.random() < 0.4) emitir(hx, hy - 1, 2, { v: 18, g: 40, vida: 200, cols: ['#ffe080'], tipo: 'chispa', tam: 0.6 }); }
        else if (oficio === 'erudito') emitir(px + 1.5, py - 3, 1, { v: 4, g: -14, vida: 900, cols: ['#ffe080', '#bfe0ff'], tipo: 'chispa', tam: 0.8 });
      }
      // Chispas del choque de armas cuerpo a cuerpo, y el polvo de los que cargan.
      if (acc === 2 && !a.tirador && Math.random() < 0.12) emitir(px + 4.5, py + 1, 3, { v: 30, g: 50, vida: 220, cols: ['#fff6a0', '#ffd23a', '#ffffff'], tipo: 'chispa', tam: 0.6 });
      if (anda && oficio === 'guerrero' && Math.random() < 0.025) emitir(px + 1.5, py + 6, 2, { v: 5, g: -2, vida: 700, cols: [POLVO], tipo: 'humo', tam: 1.6 });
      // Para los gestos: quién está quieto (charla, juega, baila) y quién grita al cargar.
      if (!anda && acc === 0 && !a.veh) quietos.push({ a, px, py, oficio, nino, fiesta: fiesta.has(a.c), hambre: hambre.has(a.c) });
      else if (acc === 2 && oficio === 'guerrero' && !a.tirador) gritos.push({ a, px, py });
      else if (acc === 1 && oficio === 'erudito') quietos.push({ a, px, py, oficio, nino, piensa: true });
      // Quien acaba de cambiar de oficio (por tu orden) lleva un destello dorado un par de segundos.
      const antes = ultimoOficio.get(a.id);
      if (antes != null && antes !== a.o) cambioVisto.set(a.id, ahora);
      ultimoOficio.set(a.id, a.o);
      const dc = ahora - (cambioVisto.get(a.id) || -1e9);
      if (dc < 2600) { const sube = Math.round(dc / 400); g.fillStyle = Math.floor(dc / 150) % 2 ? '#fff4b0' : '#ffd23a'; g.fillRect(px + 1, py - 4 - sube, 1, 3); g.fillRect(px, py - 3 - sube, 3, 1); }
      if (oficio === 'guerrero' && !nino) {
        const ej = m.vida.ejercitos && m.vida.ejercitos[a.c], col = color[a.c] || '#ccc';
        if (ej && ej.capitan === a.id) { g.fillStyle = '#2a1e14'; g.fillRect(px - 1, py - 8, 1, 13); g.fillStyle = col; g.fillRect(px, py - 8, 6, 4); g.fillStyle = '#fff6dc'; g.fillRect(px + 2, py - 7, 2, 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py - 5, 6, 0.5); }
      }
      // El tajo: un arco blanco delante de quien golpea cuerpo a cuerpo.
      if (pega && !a.tirador && oficio === 'guerrero') {
        const [at, d] = pega, dx = Math.sign(at[2]) || 1, dy = Math.sign(at[3]);
        g.strokeStyle = 'rgba(255,255,240,' + (0.9 * (1 - d)).toFixed(2) + ')'; g.lineWidth = 0.8;
        const cx = px + 1.5 + dx * 3, cy = py + 2 + dy * 2, ang = Math.atan2(dy, dx);
        g.beginPath(); g.arc(cx, cy, 3.2, ang - 1.2 + d * 0.6, ang + 0.2 + d * 1.2); g.stroke();
      }
      if (acc === 2 && !(a.tirador)) { const ch = Math.floor(ahora / 90 + a.id) % 4; g.fillStyle = ch % 2 ? '#fff6a0' : '#ffd23a'; g.fillRect(px + 4 + ch, py - 1 - (ch % 2), 1, 1); g.fillRect(px + 5, py + 1 + (ch % 3) - 1, 1, 1); if (ch === 0) { g.fillStyle = '#ffffff'; g.fillRect(px + 4, py, 2, 1); } }
      else if (acc === 2 && t) { g.fillStyle = '#ff4b3a'; g.fillRect(px + 4, py - 1, 1, 1); }
      if (recibe) {
        const [gp, d] = recibe;
        // Destello: rojo al recibir, luego un parpadeo blanco; y unas gotas de sangre que saltan y caen.
        g.globalAlpha = d < 0.45 ? 0.9 : d < 0.7 ? 0.65 : 0.35;
        g.save(); if ((pose ? dirTiro : mira) < 0) { g.translate(2 * (px + 1.5), 0); g.scale(-1, 1); }
        g.drawImage(ARTE().tenido(img, d < 0.45 ? '#ff2a2a' : '#ffffff'), ix, iy, img.width * EA, img.height * EA); g.restore(); g.globalAlpha = 1;
        const sx = Math.sign(a.x - gp[2]) || 1;
        g.fillStyle = '#b01818';
        for (let q = 0; q < 3; q++) { const vx = sx * (1.5 + q * 1.2), vy = -3 + q; g.fillRect(Math.round(px + 1 + vx * d * 3), Math.round(py + 2 + vy * d * 3 + 7 * d * d), 1, 1); }
      }
      // Barra de vida sobre los heridos (la vida que les queda en este momento del turno).
      if (a.pv0 != null && oficio === 'guerrero') {
        const max = V.vidaMax(a);
        let pv = a.pv0;
        for (const gp of ig.golpes.get(a.id) || []) if (k >= gp[1] - 0.5) pv -= gp[4];
        if (pv < max) {
          const fr = Math.max(0, pv / max), ancho = 5;
          g.fillStyle = 'rgba(40,10,10,0.75)'; g.fillRect(px - 1, py - 3, ancho, 1);
          g.fillStyle = fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030'; g.fillRect(px - 1, py - 3, Math.max(1, Math.round(ancho * fr)), 1);
        }
      }
    }
  }

  // Textos que suben sobre un pueblo cuando le das una orden («▲ leñadores 7 → 12»).
  let anuncios = [];
  function anunciar(region, texto, color) { anuncios.push({ region, texto, color: color || '#ffe08a', inicio: performance.now() }); if (anuncios.length > 6) anuncios.shift(); }
  function pintarAnuncios(z, ox, oy, dpr, ahora) {
    anuncios = anuncios.filter(a => ahora - a.inicio < 4200);
    if (!anuncios.length) return;
    const tam = Math.round(14 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const porRegion = {};
    for (const a of anuncios) {
      const k = porRegion[a.region] = (porRegion[a.region] || 0) + 1, t = (ahora - a.inicio) / 4200;
      const wx = (a.region % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(a.region / m.W) * V.SUB * P;
      let sx = ox + wx * z;
      const sy = oy + wy * z - (30 + 44 * t + (k - 1) * 24) * dpr;
      g.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      // El cartel no se mete bajo los botones de la derecha (en el móvil) ni se sale de la pantalla: si no cabe,
      // la letra se encoge un poco.
      const izq = 8 * dpr, der = g.canvas.width - (window.innerWidth < 900 ? 66 : 8) * dpr, hueco = der - izq;
      let ancho = g.measureText(a.texto).width + 16 * dpr;
      if (ancho > hueco) { const t2 = Math.max(9 * dpr, Math.floor(tam * hueco / ancho)); g.font = '600 ' + t2 + 'px "Pixelify Sans", "Courier New", monospace'; ancho = g.measureText(a.texto).width + 16 * dpr; }
      sx = Math.max(izq + ancho / 2, Math.min(der - ancho / 2, sx));
      g.fillStyle = 'rgba(13,19,34,0.88)'; g.fillRect(sx - ancho / 2, sy - tam * 0.8, ancho, tam * 1.6);
      g.strokeStyle = a.color; g.lineWidth = 1 * dpr; g.strokeRect(sx - ancho / 2 + 0.5, sy - tam * 0.8 + 0.5, ancho - 1, tam * 1.6 - 1);
      g.fillStyle = a.color; g.fillText(a.texto, sx, sy);
      g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    }
    g.globalAlpha = 1;
  }
  // Sobre la plaza de tu pueblo, una señal que salta cuando la corte te necesita: ⏫ si puedes pasar de edad,
  // ? si tus sabios no tienen nada que investigar. Se toca la plaza para abrir el menú.
  let corteAviso = null, corteTurno = -1;
  function avisoCorte(ahora, z, ox, oy, dpr) {
    const c = m && S.vivas(m).find(x => x.jugador);
    if (!c) return;
    if (corteTurno !== m.turno) {
      corteTurno = m.turno;
      const r = S.puedeSubir(m, c), libres = M.TECNOLOGIAS.filter(t => t.era <= c.era && !M.tecsDe(c).includes(t.id));
      corteAviso = c.subiendo ? null : r.ok ? '⏫' : (!c.investigacion || !c.investigacion.id) && libres.length ? '?' : null;
    }
    if (!corteAviso) return;
    const pl = V.plaza(m, c.capital), t = pl && pl.length ? pl[0] : V.centro(m, c.capital);
    const sx = ((t % m.vida.tw) * P + P) * z + ox, sy = (Math.floor(t / m.vida.tw) * P - 6) * z + oy - 18 * dpr + Math.round(Math.sin(ahora / 200) * 3 * dpr);
    const w = 26 * dpr;
    g.fillStyle = '#05070e'; g.fillRect(sx - w / 2 - 2 * dpr, sy - w / 2 - 2 * dpr, w + 4 * dpr, w + 4 * dpr);
    g.fillStyle = corteAviso === '⏫' ? '#f0c05a' : '#7ab8ff'; g.fillRect(sx - w / 2, sy - w / 2, w, w);
    g.fillStyle = '#05070e'; g.font = 'bold ' + Math.round(16 * dpr) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(corteAviso === '⏫' ? '▲' : '?', sx, sy + 1 * dpr); g.textBaseline = 'alphabetic';
  }
  // ---------- Las batallas: dónde se está luchando, para que no pasen sin verse ----------
  // Se agrupan los golpes y las muertes en combate del turno por zonas de 10×10 parcelas; una batalla dura en
  // pantalla un par de turnos después del último golpe.
  let batallas = [];
  // Las langostas: una nube de puntos oscuros que barre los campos del pueblo durante unos segundos.
  const plagasVistas = new WeakSet(); let plagasAnim = [];
  function pintarPlagas(ahora, x0, y0, x1, y1) {
    plagasAnim = plagasAnim.filter(p_ => ahora - p_.inicio < 6000);
    const R = V.SUB * P;
    for (const p_ of plagasAnim) {
      const f = (ahora - p_.inicio) / 6000, a = f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1;
      for (const r of p_.regiones) {
        const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R;
        if (rx + R < x0 || ry + R < y0 || rx > x1 || ry > y1) continue;
        g.fillStyle = 'rgba(40,36,20,' + (0.8 * a).toFixed(2) + ')';
        for (let i = 0; i < 70; i++) {
          const fase = ahora / 700 + i * 2.3, cx = rx + R / 2 + Math.sin(fase + r) * R * 0.45 + Math.sin(i * 7.1) * R * 0.25, cy = ry + R / 2 + Math.cos(fase * 1.3 + i) * R * 0.35 + Math.cos(i * 3.7) * R * 0.2;
          g.fillRect(Math.round(cx), Math.round(cy), 1, 1);
        }
      }
    }
  }
  function buscarBatallas() {
    const v = m.vida, tw = v.tw, zonas = new Map(), Z = 10;
    const pon = (x, y, peso, civ) => { const k = Math.floor(x / Z) + ',' + Math.floor(y / Z); const b = zonas.get(k) || zonas.set(k, { x: 0, y: 0, n: 0, golpes: 0, muertos: 0, civs: new Set() }).get(k); b.x += x * peso; b.y += y * peso; b.n += peso; if (civ != null) b.civs.add(civ); return b; };
    const porId = new Map(v.aldeanos.map(a => [a.id, a]));
    for (const gp of v.golpes || []) { const vic = porId.get(gp[0]); pon(gp[2], gp[3], 1, vic ? vic.c : null).golpes++; }
    for (const mu of v.muertos || []) if (['batalla', 'flecha', 'obus', 'bomba', 'torre'].includes(mu[3])) pon(mu[0], mu[1], 2, mu[2]).muertos++;
    const nuevas = [];
    for (const b of zonas.values()) if (b.golpes + b.muertos * 2 >= 3) nuevas.push({ tx: b.x / b.n, ty: b.y / b.n, fuerza: b.golpes + b.muertos * 3, muertos: b.muertos, civs: [...b.civs], turno: m.turno });
    // Se juntan con las del turno anterior que están cerca (la misma batalla sigue).
    for (const viejo of batallas) if (m.turno - viejo.turno < 2 && !nuevas.some(n => Math.hypot(n.tx - viejo.tx, n.ty - viejo.ty) < Z)) nuevas.push(viejo);
    batallas = nuevas.sort((a, b) => b.fuerza - a.fuerza).slice(0, 12);
  }
  function listaBatallas() { return batallas.filter(b => m.turno - b.turno < 2); }
  function pintarBatallas(ahora, z, ox, oy, dpr) {
    if (!m || !batallas.length) return;
    // Lo que tapa el panel lateral (en el escritorio) y las barras: las flechas quedan dentro de lo visible.
    const panelAbierto = !document.body.classList.contains('sin-panel') && window.innerWidth >= 900;
    const W = cv.width - (panelAbierto ? 420 * dpr : 0), H = cv.height - (window.innerWidth < 900 ? 170 * dpr : 0), margen = 40 * dpr, arriba = 90 * dpr;
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    for (const b of listaBatallas()) {
      const wx = b.tx * P + 8, wy = b.ty * P + 8, sx = wx * z + ox, sy = wy * z + oy, viva = b.turno === m.turno, f = (ahora % 1200) / 1200;
      const dentro = sx > 0 && sy > arriba && sx < W && sy < H;
      if (dentro) {
        // Un aro rojo que late y un par de espadas cruzadas encima del combate.
        const r = (22 + Math.min(30, b.fuerza * 1.5)) * dpr * Math.max(0.7, Math.min(1.6, z / 3));
        for (const d of [0, 0.5]) { const ff = (f + d) % 1; g.strokeStyle = 'rgba(255,70,50,' + ((viva ? 0.9 : 0.4) * (1 - ff)).toFixed(2) + ')'; g.lineWidth = 4 * dpr; g.beginPath(); g.arc(sx, sy, r * (0.5 + ff * 0.8), 0, Math.PI * 2); g.stroke(); }
        espadas(sx, sy - r - 16 * dpr, 2 * dpr, viva, b);
        // Etiqueta: «BATALLA» y las bajas.
        g.font = 'bold ' + Math.round(11 * dpr) + 'px monospace'; g.textAlign = 'center';
        const txt = (viva ? '⚔ BATALLA' : 'batalla') + (b.muertos ? ' · ' + b.muertos + ' caídos' : ''), w = g.measureText(txt).width + 10 * dpr;
        g.fillStyle = 'rgba(5,7,14,0.85)'; g.fillRect(sx - w / 2, sy - r - 50 * dpr, w, 15 * dpr);
        g.fillStyle = viva ? '#ff7a66' : '#c8a090'; g.fillText(txt, sx, sy - r - 39 * dpr);
      } else {
        // Fuera de la pantalla: una flecha en el borde que apunta hacia la batalla.
        const cx = W / 2, cy = (H + arriba) / 2, ang = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((W / 2 - margen) / Math.max(1e-6, Math.abs(Math.cos(ang))), ((H - arriba) / 2 - margen) / Math.max(1e-6, Math.abs(Math.sin(ang))));
        const px_ = cx + Math.cos(ang) * k, py_ = cy + Math.sin(ang) * k;
        g.save(); g.translate(px_, py_); g.rotate(ang);
        const late = 1 + 0.15 * Math.sin(ahora / 150);
        g.scale(late, late);
        g.fillStyle = 'rgba(5,7,14,0.9)'; g.fillRect(-20 * dpr, -15 * dpr, 42 * dpr, 30 * dpr);
        g.fillStyle = viva ? '#ff5a46' : '#b05a4a';
        g.beginPath(); g.moveTo(20 * dpr, 0); g.lineTo(8 * dpr, -11 * dpr); g.lineTo(8 * dpr, 11 * dpr); g.closePath(); g.fill();
        g.restore();
        espadas(px_ - Math.cos(ang) * 6 * dpr, py_ - Math.sin(ang) * 6 * dpr, 1.2 * dpr, viva, null);
      }
    }
    function espadas(x, y, e, viva, b) {
      g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(e, e);
      if (b) { g.fillStyle = 'rgba(5,7,14,0.85)'; g.fillRect(-13, -11, 26, 22); g.fillStyle = viva ? '#ff5a46' : '#8a4a40'; g.fillRect(-13, 9, 26, 2); }
      for (const s of [1, -1]) {
        g.fillStyle = '#e8ecf4'; for (let k = -7; k <= 5; k++) g.fillRect(s * k - 1, k - 1, 2, 2);
        g.fillStyle = '#c8a040'; g.fillRect(s * 4 - 3, 4, 6, 2); g.fillStyle = '#6a4220'; g.fillRect(s * 6 - 1, 6, 2, 3);
      }
      if (b && b.civs.length) b.civs.slice(0, 2).forEach((id, i) => { g.fillStyle = color[id] || '#ccc'; g.fillRect(i ? 7 : -11, -9, 4, 4); });
      g.restore();
    }
  }
  function nombres(z, ox, oy, dpr) {
    if (cam.z < zMin() * 1.15 && S.vivas(m).length > 6) return;
    // Las ciudades, más pequeñas, cuando te acercas.
    if (cam.z >= 1.3) {
      const tc = Math.round(10 * dpr);
      g.font = '400 ' + tc + 'px "Pixelify Sans", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const x of m.ciudades || []) {
        const c = S.civ(m, x.civ);
        if (!c || !c.viva) continue;
        const wx = (x.region % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(x.region / m.W) * V.SUB * P + P * 1.6;
        const sx = ox + wx * z, sy = oy + wy * z;
        const ancho = g.measureText(x.nombre).width + 8 * dpr;
        g.fillStyle = 'rgba(13,19,34,0.7)'; g.fillRect(sx - ancho / 2, sy - tc * 0.7, ancho, tc * 1.4);
        g.fillStyle = c.color; g.fillRect(sx - ancho / 2, sy - tc * 0.7, 2 * dpr, tc * 1.4);
        g.fillStyle = '#e8e0c8'; g.fillText(x.nombre, sx, sy);
      }
    }
    // Los letreros de los gremios, de madera con letras doradas, cuando te acercas.
    if (cam.z >= 2.4 && m.vida && m.vida.privados) {
      const v = m.vida, tl = Math.round(9 * dpr);
      g.font = '600 ' + tl + 'px "Pixelify Sans", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const t of Object.keys(v.privados)) {
        if (v.obra[t] !== V.OBRA.gremio) continue;
        const rec = v.edificios && v.edificios[t], texto = rec && rec.nombre ? rec.nombre.replace(/^Gremio de mercaderes /, 'Gremio ') : 'Gremio';
        const wx = (t % v.tw) * P + P / 2, wy = Math.floor(t / v.tw) * P - 3;
        const sx = ox + wx * z, sy = oy + wy * z, ancho = g.measureText(texto).width + 8 * dpr, alto = tl * 1.5;
        if (sx < -ancho || sy < -alto || sx > g.canvas.width + ancho || sy > g.canvas.height + alto) continue;
        g.fillStyle = '#3a2412'; g.fillRect(sx - ancho / 2 - dpr, sy - alto / 2 - dpr, ancho + 2 * dpr, alto + 2 * dpr);
        g.fillStyle = '#8a5a2b'; g.fillRect(sx - ancho / 2, sy - alto / 2, ancho, alto);
        g.fillStyle = '#a06a34'; g.fillRect(sx - ancho / 2, sy - alto / 2, ancho, dpr);
        g.fillStyle = '#f0c040'; g.fillText(texto, sx, sy + dpr * 0.5);
      }
    }
    const tam = Math.round(12 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of S.vivas(m)) {
      const r = c.capital, wx = (r % m.W) * V.SUB * P + V.SUB * P / 2, wy = Math.floor(r / m.W) * V.SUB * P + P * 0.6;
      const sx = ox + wx * z, sy = oy + wy * z - 10 * dpr;
      const texto = (c.jugador ? '★ ' : '') + c.nombre + (c.guerras.length ? ' ⚔' : '');
      const anchoT = g.measureText(texto).width + 10 * dpr;
      g.fillStyle = 'rgba(13,19,34,0.82)'; g.fillRect(sx - anchoT / 2, sy - tam * 0.75, anchoT, tam * 1.5);
      g.fillStyle = c.color; g.fillRect(sx - anchoT / 2, sy + tam * 0.75 - 2 * dpr, anchoT, 2 * dpr);
      g.fillStyle = c.jugador || sel === c.id ? '#f0c05a' : '#fff6dc'; g.fillText(texto, sx, sy);
    }
  }

  function marcar(region, color) {
    if (region == null || reducido) return;
    pulso = { region, color: color || '#fff6dc', inicio: performance.now() };
  }
  function marcarPulso(ahora) {
    if (!pulso) return;
    const t = (ahora - pulso.inicio) / 1600;
    if (t >= 1) { pulso = null; return; }
    const R = V.SUB * P, x = (pulso.region % m.W) * R + R / 2, y = Math.floor(pulso.region / m.W) * R + R / 2, s = R * (0.6 + t * 2.4);
    g.strokeStyle = pulso.color; g.globalAlpha = 1 - t; g.lineWidth = 2 / cam.z * 1.5;
    g.strokeRect(x - s, y - s, s * 2, s * 2);
    g.globalAlpha = 1;
  }

  // ---------- Los poderes del dios, a la vista ----------
  const DURACION = 3200;
  const ESTILO = {
    plaga: { tinte: '#7dff6a', particula: ['#9cff7a', '#4fcf3a'], sube: true },
    hambre: { tinte: '#c9a13a', particula: ['#8a6a2a', '#d9b45a'], sube: false },
    diluvio: { tinte: '#3a8cff', particula: ['#9cc8ff', '#5aa0ff'], lluvia: true },
    terremoto: { tinte: '#8a5a2a', particula: ['#b08050', '#6a4a2a'], sube: true },
    incendio: { tinte: '#ff6a1a', particula: ['#ffd23a', '#ff5a1a', '#c8301a'], sube: true, fuego: true },
    destruir: { tinte: '#ff2a2a', particula: ['#ffe9a6', '#ff4b3a'], rayos: true, sube: true },
    matar: { tinte: '#5a0a1a', particula: ['#ff4b3a', '#2a0a10'], rayos: true },
    oro: { tinte: '#f0c05a', particula: ['#ffe17a', '#f0c05a', '#fff6dc'], lluvia: true },
    guerra: { tinte: '#ff4b3a', particula: ['#ff4b3a', '#e8ecf4'], sube: true },
    nuevo: { tinte: '#fff6dc', particula: ['#ffffff', '#f0c05a'], sube: true, haz: true },
    bueno: { tinte: '#f0c05a', particula: ['#fff6dc', '#ffe17a', '#9cff7a'], sube: true }
  };
  function efecto(tipo, ids, titulo) {
    if (!m) return;
    const regiones = new Set();
    const civs = (ids || []).map(id => S.civ(m, id)).filter(Boolean);
    for (const c of civs) {
      for (const r of S.casillas(m, c)) regiones.add(r);
      // Lo que se perdió alrededor de la capital (un terremoto, una destrucción) también se ve.
      for (let r = 0; r < m.W * m.H; r++) if (S.distancia(r, c.capital) <= 2 && S.esTierra(m, r)) regiones.add(r);
    }
    const estilo = ESTILO[tipo] ? tipo : 'bueno';
    efectos.push({ tipo: estilo, regiones: [...regiones], inicio: performance.now() });
    if (efectos.length > 6) efectos.shift();
    if (titulo) cartel = { texto: titulo, inicio: performance.now() };
    // La cámara va a mirar.
    if (civs[0] && !visible(civs[0].capital)) centrarEn(civs[0].capital);
  }
  function visible(region) {
    const { w, h } = vista(), R = V.SUB * P;
    const x = (region % m.W) * R + R / 2, y = Math.floor(region / m.W) * R + R / 2;
    return Math.abs(x - cam.x) < w / cam.z / 2 - R && Math.abs(y - cam.y) < h / cam.z / 2 - R;
  }
  const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function pintarEfectos(ahora, x0, y0, x1, y1) {
    const R = V.SUB * P;
    efectos = efectos.filter(e => ahora - e.inicio < DURACION);
    for (const e of efectos) {
      const t = (ahora - e.inicio) / DURACION, st = ESTILO[e.tipo];
      const fuerza = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      for (const r of e.regiones) {
        const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R;
        if (rx + R < x0 || ry + R < y0 || rx > x1 || ry > y1) continue;
        g.globalAlpha = 0.28 * fuerza * (0.75 + 0.25 * Math.sin(ahora / 120 + r));
        g.fillStyle = st.tinte; g.fillRect(rx, ry, R, R);
        g.globalAlpha = Math.min(1, fuerza * 1.4);
        const n = st.fuego ? 10 : 6;
        for (let k = 0; k < n; k++) {
          const sem = r * 31 + k * 7, fx = hash(sem) * R, vel = 0.5 + hash(sem + 1);
          let fy;
          if (st.lluvia) fy = ((hash(sem + 2) * R + (ahora / 6) * vel) % R);
          else if (st.sube) fy = R - ((hash(sem + 2) * R + (ahora / 14) * vel) % R);
          else fy = hash(sem + 2) * R;
          g.fillStyle = st.particula[(k + Math.floor(ahora / 90)) % st.particula.length];
          if (st.lluvia && e.tipo === 'diluvio') g.fillRect(rx + fx, ry + fy, 1, 3);
          else if (st.fuego) { const s = 1 + Math.floor(hash(sem + Math.floor(ahora / 80)) * 2); g.fillRect(rx + fx, ry + fy, s, s + 1); }
          else g.fillRect(rx + fx, ry + fy, 1, 1);
        }
      }
      // Rayos sobre la capital, un haz de luz para un pueblo nuevo.
      if ((st.rayos || st.haz) && e.regiones.length) {
        const r0 = e.regiones[0];
        for (let k = 0; k < 3; k++) {
          if (st.rayos && hash(k + Math.floor(ahora / 140)) > 0.45) continue;
          const r = e.regiones[Math.floor(hash(k * 13 + Math.floor(ahora / 400)) * e.regiones.length)] || r0;
          const cx = (r % m.W) * R + R / 2, cy = Math.floor(r / m.W) * R + R / 2;
          g.globalAlpha = fuerza;
          if (st.haz) { g.fillStyle = 'rgba(255,246,220,0.35)'; g.fillRect(cx - 4, cy - 200, 8, 200); g.fillStyle = '#fff6dc'; g.fillRect(cx - 1, cy - 200, 2, 200); break; }
          g.fillStyle = '#fff6dc';
          let x = cx, y = cy - 90;
          while (y < cy) { const nx = x + (hash(y * 3 + k + Math.floor(ahora / 140)) - 0.5) * 8; g.fillRect(Math.min(x, nx), y, Math.abs(nx - x) + 1, 1); g.fillRect(nx, y, 1, 6); x = nx; y += 6; }
          g.fillStyle = '#ff4b3a'; g.fillRect(cx - 3, cy - 1, 7, 3);
        }
      }
      g.globalAlpha = 1;
    }
  }
  // ---------- El día y la noche: cada minuto y medio cae la noche y se encienden las ventanas ----------
  const DIA = 90000;
  let luces = [], lucesHasta = 0;
  // En las partidas pausadas la noche va con los turnos (el sexto de cada día); si no, con el reloj.
  function oscuridad(ahora) {
    if (reducido) return 0;
    if (m && V.pausada && V.pausada(m)) {
      const h = (m.turno % V.DIA_TURNOS) + Math.min(1, progreso() / V.TICKS), d = Math.min(Math.abs(h - 5.5), Math.abs(h + 0.5));
      return Math.max(0, Math.min(1, (1.15 - d) / 0.6));
    }
    const f = (ahora % DIA) / DIA; return Math.max(0, Math.min(1, (-Math.cos(f * Math.PI * 2) - 0.1) * 1.4)); }
  function noche(ahora, x0, y0, x1, y1, z, ox, oy) {
    ahora = performance.now();
    const o = oscuridad(ahora);
    if (o <= 0.02) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(10,16,48,' + (0.42 * o).toFixed(3) + ')'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(z, 0, 0, z, ox, oy);
    if (o < 0.3) return;
    const v = m.vida;
    if (ahora > lucesHasta) {
      lucesHasta = ahora + 1200; luces = [];
      const tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, ob = visto.obra[t]; if (ob === V.OBRA.casa || ob === V.OBRA.ayuntamiento || ob === V.OBRA.centro || ob === V.OBRA.templo || ob === V.OBRA.saber || ob === V.OBRA.campamento || ob === V.OBRA.palacio || ob === V.OBRA.fuente || (ob >= V.OBRA.central && ob <= V.OBRA.aerodromo)) luces.push(t); if (luces.length > 400) break; }
    }
    const a = Math.min(1, (o - 0.3) / 0.4);
    for (const t of luces) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, parpadeo = ((t * 7 + Math.floor(ahora / 900)) % 11) === 0;
      if (parpadeo) continue;
      // Con electricidad la luz de las ventanas es blanca; con aceite o gas, amarilla.
      const du = m.dueno[V.region(m, t)], cv_ = du >= 0 ? S.civ(m, du) : null, elec = cv_ && cv_.alumbrado === 'electrico';
      g.fillStyle = (elec ? 'rgba(220,230,255,' : 'rgba(255,190,80,') + (0.16 * a).toFixed(3) + ')'; g.fillRect(x + 1, y + 7, 14, 8);
      g.fillStyle = (elec ? 'rgba(245,248,255,' : 'rgba(255,220,120,') + (0.95 * a).toFixed(3) + ')'; g.fillRect(x + 4, y + 10, 2, 2); g.fillRect(x + 10, y + 10, 2, 2);
    }
  }

  // ---------- Las farolas de cada época, a lo largo de las calles (y su luz por la noche) ----------
  let farolasLista = [], farolasTurno = -1;
  function listaFarolas() {
    const v = m.vida, tw = v.tw, out = [], OB = V.OBRA;
    const junto = (t, set) => [t - 1, t + 1, t - tw, t + tw].some(n => n >= 0 && n < tw * v.th && set.has(visto.obra[n]));
    const PLAZAS = new Set([OB.fuente, OB.centro, OB.palacio, OB.ayuntamiento, OB.templo]), CASAS_ = new Set([OB.casa, OB.fuente, OB.centro, OB.palacio, OB.ayuntamiento, OB.templo, OB.saber, OB.granero, OB.parque, OB.central]);
    for (let t = 0; t < tw * v.th && out.length < 900; t++) {
      if (!visto.camino[t]) continue;
      const d = m.dueno[V.region(m, t)]; if (d < 0) continue;
      const c = S.civ(m, d), tipo = c && c.alumbrado; if (!tipo) continue;
      const h = (Math.imul(t, 2654435761) >>> 0) % 7;
      if (tipo === 'aceite' ? (junto(t, PLAZAS) && h < 3) : (junto(t, CASAS_) && h < 2) || (junto(t, PLAZAS) && h < 4)) out.push([t, tipo]);
    }
    return out;
  }
  function farolas(ahora, x0, y0, x1, y1) {
    if (farolasTurno !== m.turno) { farolasTurno = m.turno; farolasLista = listaFarolas(); }
    if (!farolasLista.length) return;
    const v = m.vida, o = oscuridad(ahora), luz = o > 0.25;
    for (const [t, tipo] of farolasLista) {
      const x = (t % v.tw) * P + 13, y = Math.floor(t / v.tw) * P + 2;
      if (x < x0 - 12 || y < y0 - 12 || x > x1 + 12 || y > y1 + 12) continue;
      if (luz) {
        const col = tipo === 'electrico' ? '235,240,255' : tipo === 'gas' ? '255,205,110' : '255,170,70', rr = tipo === 'electrico' ? 14 : tipo === 'gas' ? 10 : 7, lx = tipo === 'electrico' ? x - 4.5 : x + 0.5;
        const gr = g.createRadialGradient(lx, y + 2, 0, lx, y + 6, rr);
        gr.addColorStop(0, 'rgba(' + col + ',' + (0.42 * o).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.fillRect(lx - rr, y - rr + 4, rr * 2 + 1, rr * 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 12, 3, 1);
      if (tipo === 'electrico') {
        // Farola moderna: báculo gris con brazo curvo y luminaria.
        g.fillStyle = '#3a3e46'; g.fillRect(x + 1, y + 1, 1, 11);
        g.fillStyle = '#b4b8c0'; g.fillRect(x, y, 1, 12); g.fillRect(x - 3, y - 1, 4, 1); g.fillRect(x - 4, y, 1, 1);
        g.fillStyle = '#5a5e66'; g.fillRect(x - 6, y, 3, 1); g.fillRect(x - 1, y + 11, 3, 1);
        g.fillStyle = luz ? '#ffffff' : '#dce2ea'; g.fillRect(x - 6, y + 1, 3, 1);
        if (luz) { g.fillStyle = 'rgba(235,240,255,' + (0.18 * o).toFixed(3) + ')'; g.beginPath(); g.moveTo(x - 6, y + 2); g.lineTo(x - 3, y + 2); g.lineTo(x + 1, y + 13); g.lineTo(x - 10, y + 13); g.fill(); }
      } else if (tipo === 'gas') {
        // Farola victoriana de hierro: pie con basa, columna fina, farol de cuatro cristales y remate.
        g.fillStyle = '#1e2026'; g.fillRect(x, y + 3, 1, 9); g.fillRect(x - 1, y + 10, 3, 2); g.fillRect(x - 1, y + 5, 3, 1);
        g.fillStyle = '#1e2026'; g.fillRect(x - 1, y - 1, 3, 1); g.fillRect(x, y - 2, 1, 1); g.fillRect(x - 1, y + 2, 3, 1);
        g.fillStyle = luz ? '#ffe49a' : '#b8c4c4'; g.fillRect(x - 1, y, 3, 2);
        if (luz) { g.fillStyle = '#fff6d0'; g.fillRect(x, y, 1, 1); }
      } else {
        // Farol de aceite colgado de un poste de madera.
        g.fillStyle = '#5a3c20'; g.fillRect(x, y + 1, 1, 11); g.fillRect(x - 2, y + 1, 2, 1);
        g.fillStyle = '#2a2a2a'; g.fillRect(x - 3, y + 2, 2, 1);
        g.fillStyle = luz ? (Math.floor(ahora / 140 + t) % 5 ? '#ffb040' : '#ffd070') : '#8a7a5a'; g.fillRect(x - 3, y + 3, 2, 2);
      }
    }
  }
  // ---------- Edificios que se mueven: aspas de molino y banderas de torre ----------
  let especiales = [], especialesHasta = 0;
  // Los edificios tocados por obuses, granadas o bombas: tizne, grietas, un boquete y humo que sube.
  function danados(ahora, x0, y0, x1, y1) {
    const v = m.vida, d = v.danoObra; if (!d) return;
    for (const k in d) {
      const t = +k, x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      if (x + P < x0 || y + P < y0 || x > x1 || y > y1 || !v.obra[t] || v.obra[t] === V.OBRA.ruina) continue;
      const res = V.RESISTE[v.obra[t]] || 100, q = Math.min(1, d[k] / res), h = n => hash(t * 7 + n);
      g.fillStyle = 'rgba(30,24,20,' + (0.18 + q * 0.3).toFixed(2) + ')';
      for (let n = 0; n < 2 + Math.round(q * 4); n++) g.fillRect(x + 2 + h(n) * 10, y + 2 + h(n + 5) * 10, 3 + h(n + 9) * 3, 2 + h(n + 13) * 2);
      g.fillStyle = 'rgba(20,16,14,0.85)';
      for (let n = 0; n < 1 + Math.round(q * 3); n++) { let cx = x + 3 + h(n + 20) * 10, cy = y + 3 + h(n + 30) * 6; for (let s2 = 0; s2 < 4; s2++) { g.fillRect(Math.round(cx), Math.round(cy), 1, 1); cx += h(n * 4 + s2) > 0.5 ? 1 : -1; cy += 1; } }
      if (q > 0.45) { g.fillStyle = '#1a1412'; g.fillRect(x + 5 + h(40) * 5, y + 4 + h(41) * 5, 3, 2); }
      if (q > 0.3) { const f = ((ahora / 1400) + h(50)) % 1; g.fillStyle = 'rgba(70,64,60,' + (0.45 * (1 - f)).toFixed(2) + ')'; g.fillRect(x + 6 + f * 3, y + 2 - f * 12, 3 + f * 3, 3 + f * 2); }
    }
  }
  function edificiosVivos(ahora, x0, y0, x1, y1) {
    const v = m.vida;
    if (ahora > especialesHasta) {
      especialesHasta = ahora + 1000; especiales = [];
      const tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if (o === V.OBRA.molino || o === V.OBRA.torre || o === V.OBRA.castillo) especiales.push(t); }
    }
    const fase = ahora / 400;
    for (const t of especiales) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, o = visto.obra[t];
      const dueno = S.civ(m, m.dueno[V.region(m, t)]), fd = dueno ? V.fase(dueno.era) : 1;
      if (o === V.OBRA.molino && (fd === 0 || fd === 3)) continue; // el granero tribal y los silos no tienen aspas
      if (o === V.OBRA.molino) {
        // Cuatro aspas que giran.
        const cx = x + 8, cy = y + 6;
        for (let k = 0; k < 4; k++) { const ang = fase + k * Math.PI / 2; for (let d = 1; d <= 8; d++) { g.fillStyle = d > 3 ? '#f0e6cc' : '#7a5232'; g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), d > 3 ? 2 : 1, d > 3 ? 2 : 1); } }
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 1, cy - 1, 2, 2);
      } else if (o === V.OBRA.castillo) {
        // En guerra, los arqueros se asoman a las almenas (y tensan el arco por turnos).
        const c = S.civ(m, m.dueno[V.region(m, t)]);
        if (!c || !c.guerras.length) continue;
        for (const [ax, ay] of [[3, 3], [7, 0], [11, 3]]) {
          const tensa = Math.floor(ahora / 350 + ax) % 2;
          g.fillStyle = '#1e1a24'; g.fillRect(x + ax - 0.5, y + ay - 0.5, 3, 3.5);
          g.fillStyle = c.color; g.fillRect(x + ax, y + ay + 1.5, 2, 1.5);
          g.fillStyle = '#f0c8a0'; g.fillRect(x + ax + 0.5, y + ay, 1, 1.5);
          g.fillStyle = '#8a5a2b'; g.fillRect(x + ax + 2 + (tensa ? 0.5 : 0), y + ay - 0.5, 0.5, 3);
        }
      } else {
        const c = S.civ(m, m.dueno[V.region(m, t)]);
        if (!c) continue;
        g.fillStyle = '#3a2a1e'; g.fillRect(x + 8, y - 6, 1, 7);
        g.fillStyle = c.color; g.fillRect(x + 9, y - 6 + (Math.floor(ahora / 300) % 2), 5, 3);
      }
    }
  }
  // Los barcos, interpolando su travesía del turno.
  // Los naufragios: el barco escora, se hunde entre burbujas y astillas, y deja unos restos flotando.
  let naufragios = [];
  function pintarNaufragios(ahora) {
    naufragios = naufragios.filter(x => ahora - x.inicio < 4500);
    for (const x of naufragios) {
      const t = (ahora - x.inicio) / 4500; if (t < 0) continue;
      const [nx, ny, , tipo, clase] = x.n, px = nx * P + 4, py = ny * P + 4;
      if (!x.salpico) { x.salpico = 1; emitir(px + 10, py + 8, 14, { v: 30, g: 60, vida: 1200, cols: ['#e8f4ff', '#a8d0f0', '#ffffff'], tipo: 'solido', tam: 1, tamAzar: 1, dy: -25 }); emitir(px + 10, py + 6, 8, { v: 20, g: 50, vida: 1600, cols: ['#6a4a2a', '#4a3020', '#8a6a42'], tipo: 'solido', tam: 1.2, tamAzar: 1, dy: -18 }); }
      const img = tipo === 'guerra' ? ARTE().barco('guerra', clase || 'acorazado', x.color) : ARTE().barco(tipo === 'pesca' ? 'pesca' : 'mercante', x.era >= 6 ? 3 : grupoEra(x.era), x.color);
      const baja = Math.min(1, t * 1.4);
      g.save(); g.beginPath(); g.rect(px - 8, py - 12, 40, 26); g.clip();
      g.translate(px + 10, py + 10 + baja * 14); g.rotate(baja * 0.5); g.globalAlpha = 1 - Math.max(0, t - 0.6) * 2.5;
      g.drawImage(img, -10, -16); g.restore(); g.globalAlpha = 1;
      if (Math.random() < 0.4 * (1 - t)) emitir(px + 6 + Math.random() * 10, py + 12, 1, { v: 6, g: -20, vida: 700, cols: ['rgba(230,245,255,A)'], tipo: 'humo', tam: 1.5 });
      if (t > 0.6) { g.fillStyle = 'rgba(90,60,30,' + (1 - t).toFixed(2) + ')'; g.fillRect(px + 4, py + 12, 3, 1); g.fillRect(px + 12, py + 13, 4, 1); }
    }
  }
  function barcos(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    for (const b of v.barcos || []) {
      if (b.hundido) continue; // lo dibuja el naufragio
      const br = rVisto.get(b) || b.r;
      let px = b.x * P, py = b.y * P;
      if (br && br.length >= 4) { const i = paso * 2, j = Math.min(br.length - 2, i + 2); px = (br[i] + (br[j] - br[i]) * f) * P; py = (br[i + 1] + (br[j + 1] - br[i + 1]) * f) * P; }
      if (px < x0 - 10 || py < y0 - 10 || px > x1 + 10 || py > y1 + 10) continue;
      px = Math.round(px + 4); py = Math.round(py + 4 + Math.sin(ahora / 500 + b.id) * 0.8);
      const c = S.civ(m, b.c), color = c ? c.color : '#ccc';
      // Barcos de su época (canoa, vela, galeón, vapor), del tamaño de una casa.
      const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(px - 4 + x * 2, py - 6 + y * 2, w * 2, h * 2); };
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px - 6, py + 12 + (Math.floor(ahora / 400 + b.id) % 2), 20, 1);
      // Desde la Revolución Industrial, los mercantes ya son vapores; en guerra, los acorazados.
      const fb = c ? (c.era >= 6 && b.tipo !== 'pesca' ? 3 : grupoEra(c.era)) : 1;
      const img = b.tipo === 'guerra' ? ARTE().barco('guerra', b.clase || 'acorazado', color) : ARTE().barco(b.tipo === 'pesca' ? 'pesca' : 'mercante', fb, color);
      const ida = br && br.length >= 4 ? Math.sign(br[Math.min(br.length - 2, paso * 2 + 2)] - br[paso * 2]) : 0;
      const izq = ida < 0 || (!ida && (b.izq || false)); if (ida) b.izq = ida < 0;
      g.save(); if (izq) { g.translate(px * 2 + 12, 0); g.scale(-1, 1); }
      g.drawImage(img, px - 4, py - 6);
      g.restore();
      // El transporte lleva a los soldados en cubierta (cabezas con el casco del color de su reino); el de colonos, gente con sombrero.
      if (b.tipo === 'transporte') { const n = Math.min(6, v.aldeanos.filter(a => a.aBordo === b.id).length); for (let q = 0; q < n; q++) { const cx = px + (izq ? 10 - q * 2.5 : -1 + q * 2.5), cy = py + 1 - (q % 2); g.fillStyle = '#f0c8a0'; g.fillRect(cx, cy + 1, 2, 2); g.fillStyle = b.colonia ? (q % 2 ? '#8a5a2b' : '#c9a066') : color; g.fillRect(cx, cy, 2, 1.2); } }
      // Ardiendo (flechas incendiarias) o tocado: llamas y humo negro; con poca vida, una columna de humo.
      const pvMax = b.tipo === 'guerra' ? (V.NAVAL[b.clase || 'acorazado'] || { pv: 120 }).pv : 40;
      if (b.ardiendo > 0 && Math.random() < 0.6) { emitir(px + 4 + Math.random() * 12, py + 2 + Math.random() * 4, 2, { v: 10, g: -30, vida: 500, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 1.4, tamAzar: 1 }); }
      if ((b.ardiendo > 0 || (b.pv != null && b.pv < pvMax * 0.5)) && Math.random() < 0.3) emitir(px + 8, py - 2, 1, { v: 8, g: -10, vida: 2200, cols: ['rgba(30,26,24,A)', 'rgba(70,64,60,A)'], tipo: 'humo', tam: 4, tamAzar: 1 });
      // El mercante lleva su carga a la vista en cubierta: fardos del color de lo que transporta.
      if (b.tipo === 'mercante' && b.carga) {
        const COL = { comida: '#e8d08a', madera: '#8a5a2c', piedra: '#a8a49a', metal: '#b8c4d0', armas: '#6a6a74', carbon: '#2a2a2e', petroleo: '#3a3020', muebles: '#c8925a', vehiculos: '#5a6a4a', semillas: '#c8a86a', granadas: '#3e4a2a' };
        const cc = COL[b.carga.que] || '#c8a070', n = Math.min(4, 2 + Math.floor(b.carga.n / 15));
        for (let q = 0; q < n; q++) { const cx = px + (izq ? 9 - q * 4 : -1 + q * 4), cy = py + 2 - (q % 2); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(cx - 0.5, cy - 0.5, 4, 4); g.fillStyle = cc; g.fillRect(cx, cy, 3, 3); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx, cy, 3, 0.7); }
      }
      // Humo de los vapores y arrastreros.
      if (c && fb === 3) { for (let q = 0; q < 3; q++) { const f = ((ahora / 1200) + q / 3) % 1; g.fillStyle = 'rgba(80,80,80,' + (0.5 * (1 - f)).toFixed(2) + ')'; g.fillRect(px + (izq ? 6 : 4) + (b.tipo === 'pesca' ? 4 : 0) - f * 6 * (izq ? -1 : 1), py - 6 - f * 10, 2 + f * 3, 2 + f * 3); } }
      if (b.tipo === 'pesca' && Math.floor(ahora / 700 + b.id) % 3 === 0) { r(8, 5, 2, 1, '#c8d4dc'); }
    }
  }
  // Las plazas sitiadas: espadas cruzadas y el porcentaje de captura.
  function asedios(ahora) {
    const v = m.vida, R = V.SUB * P;
    for (const id of Object.keys(v.ejercitos || {})) {
      const e = v.ejercitos[id];
      if (!e.asedio || e.asedio <= 0) continue;
      const x = (e.obj % m.W) * R + R / 2, y = Math.floor(e.obj / m.W) * R - 2;
      const c = S.civ(m, +id);
      g.fillStyle = 'rgba(13,19,34,0.85)'; g.fillRect(x - 9, y - 9, 18, 11);
      g.fillStyle = '#e8ecf4';
      for (let d = 0; d < 5; d++) { g.fillRect(x - 6 + d, y - 7 + d, 1, 1); g.fillRect(x - 2 - d, y - 7 + d, 1, 1); }
      g.fillStyle = '#7a5232'; g.fillRect(x - 7, y - 2, 2, 1); g.fillRect(x - 3, y - 2, 2, 1);
      g.fillStyle = '#2a3550'; g.fillRect(x, y - 6, 8, 3);
      g.fillStyle = c ? c.color : '#ff4b3a'; g.fillRect(x, y - 6, Math.round(8 * e.asedio / 100), 3);
      if (Math.floor(ahora / 400) % 2) { g.fillStyle = '#ff4b3a'; g.fillRect(x - 9, y + 2, 18, 1); }
      // La plaza sitiada arde: llamas y humo sobre algunas casas.
      let ardiendo = 0;
      for (const t of V.parcelas(m, e.obj)) {
        const ob = visto.obra[t];
        if (ardiendo >= Math.ceil(e.asedio / 30) || !(ob === V.OBRA.casa || ob === V.OBRA.ayuntamiento || ob === V.OBRA.centro)) continue;
        ardiendo++;
        const fx = (t % v.tw) * P, fy = Math.floor(t / v.tw) * P;
        for (let k = 0; k < 7; k++) {
          const f = ((ahora / 500) + k / 7) % 1, cx = fx + 3 + ((k * 5 + t) % 10);
          g.fillStyle = f < 0.4 ? '#ffd23a' : f < 0.7 ? '#ff7a1a' : '#c8301a';
          g.fillRect(Math.round(cx + Math.sin(ahora / 120 + k) * 1.5), Math.round(fy + 8 - f * 10), 2, 2);
          g.fillStyle = 'rgba(70,70,80,' + (0.45 * (1 - f)).toFixed(2) + ')';
          g.fillRect(Math.round(cx - 1 + Math.sin(f * 4 + k) * 3), Math.round(fy - 2 - f * 18), 3, 3);
        }
      }
    }
  }

  // ---------- El ambiente: lo que se mueve aunque nadie lo mande ----------
  const azarV = n => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  const tierraEn = (wx, wy) => { const v = m.vida, tx = Math.floor(wx / P), ty = Math.floor(wy / P); return tx >= 0 && ty >= 0 && tx < v.tw && ty < v.th ? tierra[ty * v.tw + tx] : null; };
  // Destellos sobre el agua y espuma en la orilla.
  function agua(ahora, x0, y0, x1, y1) {
    const cuadro = Math.floor(ahora / 140), n = Math.min(260, Math.round((x1 - x0) * (y1 - y0) / 900));
    for (let i = 0; i < n; i++) {
      const wx = x0 + azarV(i * 7919 + cuadro * 31) * (x1 - x0), wy = y0 + azarV(i * 104729 + cuadro * 17) * (y1 - y0);
      const t = tierraEn(wx, wy);
      if (t === 'agua' || t === 'bajo') { g.fillStyle = i % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(170,215,255,0.5)'; g.fillRect(Math.floor(wx), Math.floor(wy), i % 4 ? 1 : 2, 1); }
      else if (t === 'arena' && i % 2) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(Math.floor(wx), Math.floor(wy), 1, 1); }
    }
  }
  // Humo de las chimeneas: unas cuantas casas a la vista echan humo.
  let chimeneas = [], chimeneasHasta = 0;
  let piquetes = [];
  function humo(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    if (ahora > chimeneasHasta) {
      chimeneasHasta = ahora + 1500; chimeneas = []; piquetes = [];
      const v = m.vida, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if (((o === V.OBRA.casa || o === V.OBRA.ayuntamiento) && t % 5 === 0) || o === V.OBRA.campamento) chimeneas.push(t); else if (o === V.OBRA.central || o === V.OBRA.fabrica) { const dc = m.dueno[V.region(m, t)], cc = dc >= 0 ? S.civ(m, dc) : null; if (V.enMarcha(cc, o === V.OBRA.central ? 'central' : 'fabrica')) chimeneas.push(-t - 1); else if (o === V.OBRA.fabrica && cc && cc.huelga) piquetes.push(t); } if (chimeneas.length > 60) break; }
    }
    // Fábricas en huelga: una bandera roja que ondea sobre el tejado y un piquete en la puerta.
    for (const t of piquetes) {
      const bx = (t % m.vida.tw) * P, by = Math.floor(t / m.vida.tw) * P, ond = Math.floor(ahora / 300) % 2;
      g.fillStyle = '#3a3a3a'; g.fillRect(bx + 3, by - 8, 1, 10);
      g.fillStyle = '#d82a2a'; g.fillRect(bx + 4, by - 8, 5, 3); g.fillRect(bx + 4 + 5, by - 8 + ond, 1, 2);
      for (const [dx, col] of [[2, '#5a4a7a'], [6, '#7a4a3a'], [10, '#4a5a7a']]) { g.fillStyle = col; g.fillRect(bx + dx, by + P - 4, 2, 3); g.fillStyle = '#e8b890'; g.fillRect(bx + dx, by + P - 6, 2, 2); if ((Math.floor(ahora / 400) + dx) % 2) { g.fillStyle = '#e8b890'; g.fillRect(bx + dx + 1, by + P - 8, 1, 2); } }
    }
    for (const tt of chimeneas) {
      // Las dos chimeneas de la central echan mucho más humo, y más oscuro.
      if (tt < 0) {
        const t = -tt - 1, bx = (t % m.vida.tw) * P, by = Math.floor(t / m.vida.tw) * P;
        for (const [cx, cy] of [[bx + 4, by - 2], [bx + 8, by - 4]]) for (let k = 0; k < 5; k++) {
          const f = ((ahora / 2000 + k / 5 + cx / 13) % 1);
          g.fillStyle = 'rgba(150,150,158,' + (0.6 * (1 - f)).toFixed(2) + ')';
          const r = 1 + f * 3; g.fillRect(Math.round(cx + f * 6 + Math.sin(f * 5) * 1.5 - r / 2), Math.round(cy - f * 14 - r / 2), Math.ceil(r), Math.ceil(r));
        }
        continue;
      }
      const t = tt;
      const x = (t % m.vida.tw) * P + 10, y = Math.floor(t / m.vida.tw) * P + 2;
      for (let k = 0; k < 3; k++) {
        const f = ((ahora / 2400 + k / 3 + (t % 7) / 7) % 1);
        g.fillStyle = 'rgba(210,210,215,' + (0.45 * (1 - f)).toFixed(2) + ')';
        g.fillRect(Math.round(x + Math.sin(f * 6 + t) * 1.5), Math.round(y - 1 - f * 9), f > 0.5 ? 2 : 1, f > 0.5 ? 2 : 1);
      }
    }
  }
  // Nieve que cae sobre las tierras frías.
  function nieve(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    const n = Math.min(220, Math.round((x1 - x0) * (y1 - y0) / 1100));
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < n; i++) {
      const wx = x0 + ((azarV(i * 13) * (x1 - x0) + Math.sin(ahora / 900 + i) * 3) % (x1 - x0)), wy = y0 + ((azarV(i * 29) * (y1 - y0) + ahora / 40 * (0.5 + azarV(i))) % (y1 - y0));
      const t = tierraEn(wx, wy);
      if (t === 'nieve' || t === 'tundra' || (t === 'taiga' && i % 3 === 0)) g.fillRect(Math.floor(wx), Math.floor(wy), 1, 1);
    }
  }
  // Bandadas de pájaros que cruzan el mapa.
  function pajaros(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    for (let f = 0; f < 3; f++) {
      const ancho = ancho_(), alto_ = alto(), vel = 0.012 + f * 0.004;
      const bx = ((ahora * vel + azarV(f * 97) * ancho) % (ancho + 120)) - 60, by = azarV(f * 31 + Math.floor((ahora * vel) / (ancho + 120))) * alto_;
      if (bx < x0 - 20 || bx > x1 + 20 || by < y0 - 20 || by > y1 + 20) continue;
      const aleteo = Math.floor(ahora / 180 + f) % 2;
      g.fillStyle = 'rgba(30,30,40,0.75)';
      for (let i = 0; i < 5; i++) {
        const px = Math.round(bx - Math.abs(i - 2) * 4), py = Math.round(by + (i - 2) * 3);
        g.fillRect(px - 1, py - aleteo, 1, 1); g.fillRect(px, py, 1, 1); g.fillRect(px + 1, py - aleteo, 1, 1);
      }
    }
  }
  const ancho_ = () => ancho();
  // Nubes que pasan, con su sombra en el suelo: pixel art blando hecho de círculos, sombreado por abajo.
  const cacheNubes = [];
  function nube(i, sombra) {
    const clave = i * 2 + (sombra ? 1 : 0);
    if (cacheNubes[clave]) return cacheNubes[clave];
    const w = 28 + (i * 7) % 14, h = 12 + (i * 3) % 5, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), bolas = [];
    let s = 977 * (i + 1);
    const r = () => { s = (Math.imul(s ^ (s >>> 13), 1274126177) + 0x9E3779B9) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 6; k++) bolas.push([4 + r() * (w - 8), h * 0.45 + (r() - 0.5) * h * 0.3, 2.5 + r() * h * 0.33]);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let dentro = false, alto = 1;
      for (const [bx, by, br] of bolas) { const d = Math.hypot(xx - bx, (yy - by) * 1.3); if (d < br) { dentro = true; alto = Math.min(alto, (yy - (by - br)) / (2 * br)); } }
      if (!dentro && yy >= h * 0.55 && yy < h * 0.8 && xx > 3 && xx < w - 3) dentro = true, alto = 0.9;
      if (!dentro) continue;
      x.fillStyle = sombra ? '#000' : alto < 0.35 ? '#ffffff' : alto < 0.75 ? '#eef2f7' : '#cdd5e0';
      x.fillRect(xx, yy, 1, 1);
    }
    return (cacheNubes[clave] = c);
  }
  function nubes(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    const W2 = ancho(), H2 = alto();
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < 7; i++) {
      const esc = 3 + azarV(i * 13) * 1.5, img = nube(i % 5), w = img.width * esc, h = img.height * esc;
      const cx = ((azarV(i * 7) * W2 + ahora * (0.004 + azarV(i) * 0.004)) % (W2 + w * 2)) - w, cy = azarV(i * 5) * H2;
      if (cx + w < x0 - 30 || cx > x1 + 60 || cy + h < y0 - 30 || cy > y1 + 60) continue;
      g.globalAlpha = 0.13; g.drawImage(nube(i % 5, true), Math.round(cx + 24), Math.round(cy + 40), w, h);
      g.globalAlpha = 0.72; g.drawImage(img, Math.round(cx), Math.round(cy), w, h);
    }
    g.globalAlpha = 1;
  }
  // Los animales, interpolando su paseo del turno.
  function animales(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    const ig = golpesDelTurno(v);
    const todos = caidos.length ? (v.animales || []).concat(caidos.filter(x => x.animal && k < x.paso && !(v.animales || []).includes(x.a)).map(x => x.a)) : (v.animales || []);
    for (const b of todos) {
      const br = rVisto.get(b) || b.r;
      let px = b.x * P + 6, py = b.y * P + 8;
      if (br && br.length >= 4) { const i = paso * 2, j = Math.min(br.length - 2, i + 2); px = (br[i] + (br[j] - br[i]) * f) * P + 6; py = (br[i + 1] + (br[j + 1] - br[i + 1]) * f) * P + 8; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // También los animales: retroceden y se ponen rojos al recibir un mordisco o una lanzada; el lobo embiste.
      const recibe = golpeActivo(ig.golpes.get(b.id), k), pega = golpeActivo(ig.ataques.get(b.id), k);
      if (recibe) { const [gp, d] = recibe, emp = Math.round(2.5 * (1 - d)); px += Math.sign(b.x - gp[2]) * emp; py -= d < 0.5 ? 1 : 0; }
      if (pega) { const [at, d] = pega, emb = 2.2 * Math.sin(Math.PI * Math.min(1, d * 1.25)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
      px = Math.round(px); py = Math.round(py);
      if (recibe && b.tipo !== 'pez') { const d = recibe[1]; g.globalAlpha = d < 0.45 ? 0.9 : 0.5; g.fillStyle = d < 0.45 ? '#ff2a2a' : '#ffffff'; g.fillRect(px - 1, py - 1, 6, 4); g.globalAlpha = 1; g.fillStyle = '#b01818'; g.fillRect(Math.round(px + 2 + 3 * d), Math.round(py - 2 + 6 * d * d), 1, 1); }
      const pata = Math.floor(ahora / 220 + b.id) % 2;
      if (b.tipo === 'pez') {
        const fase = (ahora / 2600 + b.id * 0.37) % 1;
        if (fase < 0.14) { const s2 = fase / 0.14; g.fillStyle = '#d8e4ee'; g.fillRect(px + Math.round(s2 * 4), py - Math.round(Math.sin(s2 * Math.PI) * 5), 2, 1); }
        else if (fase < 0.22) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px + 3, py, 3, 1); g.fillRect(px + 4, py - 1, 1, 1); }
        continue;
      }
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px - 1, py + 3, b.tipo === 'vaca' ? 6 : 5, 1);
      if (b.tipo === 'oveja') {
        g.fillStyle = '#3a3030'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 2, py + 2, 1, 2 - pata);
        g.fillStyle = '#f4f2ea'; g.fillRect(px - 1, py, 4, 2); g.fillStyle = '#3a3030'; g.fillRect(px + 3, py, 1, 1);
      } else if (b.tipo === 'vaca') {
        g.fillStyle = '#3a3030'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 3, py + 2, 1, 2 - pata);
        g.fillStyle = '#f4f2ea'; g.fillRect(px - 1, py, 5, 2); g.fillStyle = '#6b4a2b'; g.fillRect(px, py, 2, 1); g.fillStyle = '#d9a090'; g.fillRect(px + 4, py, 1, 1);
      } else if (b.tipo === 'lobo') {
        // Lobo gris, más bajo y alargado, con orejas de punta y cola caída.
        g.fillStyle = '#3a3a40'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 3, py + 2, 1, 2 - pata);
        g.fillStyle = '#7a7a84'; g.fillRect(px - 1, py, 5, 2); g.fillRect(px + 4, py - 1, 2, 2);
        g.fillStyle = '#4a4a52'; g.fillRect(px + 4, py - 2, 1, 1); g.fillRect(px - 2, py + 1, 1, 2);
        g.fillStyle = '#e8d070'; g.fillRect(px + 5, py - 1, 1, 1);
      } else if (b.tipo === 'ciervo') {
        g.fillStyle = '#5a3a22'; g.fillRect(px, py + 2, 1, 1 + pata); g.fillRect(px + 2, py + 2, 1, 2 - pata);
        g.fillStyle = '#9a6a3a'; g.fillRect(px - 1, py, 4, 2); g.fillRect(px + 3, py - 1, 1, 1);
        g.fillStyle = '#d8c8a0'; g.fillRect(px + 3, py - 3, 1, 2); g.fillRect(px + 4, py - 3, 1, 1);
      }
    }
  }


  // Lo que se investiga y la subida de edad, con su barra sobre el edificio (o la plaza), como en Age of Empires.
  function progresos(x0, y0, x1, y1) {
    const v = m.vida;
    for (const c of S.vivas(m)) {
      const barras = [];
      const inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
      if (inv) {
        const obraL = { saber: V.OBRA.saber, molino: V.OBRA.molino, templo: V.OBRA.templo, cuartel: V.OBRA.cuartel, puerto: V.OBRA.puerto }[inv.lugar];
        let t = null;
        if (obraL) for (const r of [c.capital, ...S.vecinos(c.capital)]) { for (const x of V.parcelas(m, r)) if (visto.obra[x] === obraL) { t = x; break; } if (t != null) break; }
        if (t == null) t = V.plaza(m, c.capital)[0];
        barras.push([t, Math.min(1, c.investigacion.puntos / M.costeTec(inv)), '#7ab8ff']);
      }
      if (c.subiendo) barras.push([V.plaza(m, c.capital)[1], (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde), '#ffd76a']);
      for (const [t, f, col] of barras) {
        const x = (t % v.tw) * P + 1, y = Math.floor(t / v.tw) * P - 4;
        if (x + 16 < x0 || y + 6 < y0 || x > x1 || y > y1) continue;
        g.fillStyle = 'rgba(10,12,20,0.75)'; g.fillRect(x - 0.5, y - 0.5, 15, 3);
        g.fillStyle = col; g.fillRect(x, y, Math.max(1, 14 * Math.max(0, Math.min(1, f))), 2);
      }
    }
  }

  // ---------- Gestos: charlas, risas, saludos, amores, discusiones, juegos, bailes, gritos de guerra ----------
  // Los que están quietos cerca de otro de su pueblo hablan entre ellos, como en WorldBox. Cada pareja tiene su
  // «conversación» unos segundos (según quiénes son y la hora), con un bocadillo y algún gesto con la mano.
  function bocadillo(x, y, dibujo, borde) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 0.5, y + 0.5, 9, 6);
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y, 9, 6); g.fillRect(x, y - 0.5, 7, 7); g.fillRect(x + 1, y + 6, 2, 1); g.fillRect(x + 1, y + 7, 1, 1);
    if (borde) { g.fillStyle = borde; g.fillRect(x - 1, y, 9, 0.5); }
    dibujo(x, y);
  }
  const DIBUJOS = {
    charla: (x, y) => { g.fillStyle = '#3a3a44'; g.fillRect(x + 1, y + 3, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + 5, y + 3, 1, 1); },
    risa: (x, y) => { g.fillStyle = '#c8682a'; g.fillRect(x + 1, y + 1, 1, 3); g.fillRect(x + 2, y + 3, 1, 1); g.fillRect(x + 4, y + 2, 2, 1); g.fillRect(x + 4, y + 3, 1, 1); g.fillRect(x + 5, y + 3, 1, 1); },
    amor: (x, y) => { g.fillStyle = '#e8304a'; g.fillRect(x + 1, y + 1, 2, 2); g.fillRect(x + 4, y + 1, 2, 2); g.fillRect(x + 1, y + 2, 5, 2); g.fillRect(x + 2, y + 4, 3, 1); g.fillRect(x + 3, y + 5, 1, 1); },
    moneda: (x, y) => { g.fillStyle = '#e0b030'; g.fillRect(x + 2, y + 1, 3, 5); g.fillRect(x + 1, y + 2, 5, 3); g.fillStyle = '#fff4a0'; g.fillRect(x + 3, y + 2, 1, 2); },
    enfado: (x, y) => { g.fillStyle = '#d02a2a'; g.fillRect(x + 3, y + 1, 1, 3); g.fillRect(x + 3, y + 5, 1, 1); g.fillRect(x + 5, y + 1, 1, 3); g.fillRect(x + 5, y + 5, 1, 1); },
    nota: (x, y) => { g.fillStyle = '#2a2a3a'; g.fillRect(x + 4, y + 1, 1, 4); g.fillRect(x + 5, y + 1, 1, 1); g.fillRect(x + 6, y + 2, 1, 1); g.fillRect(x + 2, y + 4, 2, 2); },
    idea: (x, y) => { g.fillStyle = '#ffd23a'; g.fillRect(x + 2, y + 1, 3, 3); g.fillRect(x + 1, y + 2, 5, 1); g.fillStyle = '#8a8a8a'; g.fillRect(x + 3, y + 4, 1, 2); },
    libro: (x, y) => { g.fillStyle = '#7a2a1a'; g.fillRect(x + 1, y + 2, 5, 3); g.fillStyle = '#f0e8d0'; g.fillRect(x + 1, y + 2, 2, 2); g.fillRect(x + 4, y + 2, 2, 2); },
    triste: (x, y) => { g.fillStyle = '#5a7aba'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 2, y + 4, 3, 1); g.fillRect(x + 1, y + 5, 1, 1); g.fillRect(x + 5, y + 5, 1, 1); },
    grito: (x, y) => { g.fillStyle = '#d02a2a'; g.fillRect(x + 3, y + 1, 1, 3); g.fillRect(x + 3, y + 5, 1, 1); },
    pregunta: (x, y) => { g.fillStyle = '#3a5a9a'; g.fillRect(x + 2, y + 1, 3, 1); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + 3, y + 5, 1, 1); }
  };
  function gestos(k, ahora) {
    if (cam.z < 1.6) return; // de lejos no se distinguen
    const slot = Math.floor(ahora / 4200), dentro = (ahora % 4200) / 4200;
    const usado = new Set(), cubo = new Map();
    for (const q of quietos) { const key = Math.floor(q.px / 14) + ',' + Math.floor(q.py / 14); (cubo.get(key) || cubo.set(key, []).get(key)).push(q); }
    let n = 0;
    for (const q of quietos) {
      if (usado.has(q) || n > Math.round(6 + cam.z * 2)) continue;
      // Los eruditos que estudian piensan solos: una bombilla o un libro.
      if (q.piensa) { if (hash(q.a.id * 7 + slot) < 0.35 && dentro < 0.6) { bocadillo(q.px + 2, q.py - 9, hash(q.a.id + slot) < 0.5 ? DIBUJOS.idea : DIBUJOS.libro); n++; } continue; }
      // Con hambre, alguno se lamenta solo.
      if (q.hambre && hash(q.a.id * 3 + slot) < 0.15 && dentro < 0.5) { bocadillo(q.px + 2, q.py - 9, DIBUJOS.triste); usado.add(q); n++; continue; }
      const cx = Math.floor(q.px / 14), cy = Math.floor(q.py / 14);
      let otro = null;
      for (let dy = -1; dy <= 1 && !otro; dy++) for (let dx = -1; dx <= 1 && !otro; dx++) for (const o of cubo.get((cx + dx) + ',' + (cy + dy)) || []) if (o !== q && !usado.has(o) && !o.piensa && o.a.c === q.a.c && Math.abs(o.px - q.px) + Math.abs(o.py - q.py) <= 22) { otro = o; break; }
      if (!otro) continue;
      usado.add(q); usado.add(otro);
      const par = Math.min(q.a.id, otro.a.id) * 31 + Math.max(q.a.id, otro.a.id), h = hash(par + slot * 7);
      if (h > 0.5 || dentro > 0.8) continue; // no todos hablan todo el rato
      n++;
      // Los niños juegan a la pelota.
      if (q.nino && otro.nino) {
        const f = (ahora / 500) % 2, ida = f < 1 ? f : 2 - f, bx = q.px + 1.5 + (otro.px - q.px) * ida, by = q.py + 4 + (otro.py - q.py) * ida - Math.sin(ida * Math.PI) * 4;
        g.fillStyle = '#e04030'; g.fillRect(bx, by, 1.5, 1.5); g.fillStyle = '#ffffff'; g.fillRect(bx, by, 0.6, 0.6);
        continue;
      }
      // Qué se dicen: según quiénes son y cómo va su pueblo.
      const comerciante = q.oficio === 'comerciante' || otro.oficio === 'comerciante';
      const tipo = q.fiesta ? 'nota' : comerciante && h < 0.25 ? 'moneda' : h < 0.06 && !q.nino && !otro.nino ? 'amor' : h < 0.14 ? 'enfado' : h < 0.28 ? 'risa' : h < 0.36 ? 'pregunta' : h < 0.46 ? 'saludo' : 'charla';
      const habla = Math.floor(ahora / 1100 + par) % 2 ? q : otro, escucha = habla === q ? otro : q;
      if (tipo === 'saludo') {
        // Se saludan con la mano: el brazo sube y baja.
        for (const w of [q, otro]) { const arriba = Math.floor(ahora / 180 + w.a.id) % 2; g.fillStyle = '#e8b890'; g.fillRect(w.px + 3.5, w.py + (arriba ? -0.5 : 0.5), 1, 1); g.fillRect(w.px + 3, w.py + 1, 1, 1); }
        continue;
      }
      bocadillo(habla.px + 2, habla.py - 9, DIBUJOS[tipo], tipo === 'enfado' ? '#d02a2a' : null);
      // El que habla gesticula (brazo arriba); el que escucha asiente.
      g.fillStyle = '#e8b890';
      if (Math.floor(ahora / 220) % 2) g.fillRect(habla.px + 3.5, habla.py, 1, 1);
      if (tipo === 'amor' && Math.random() < 0.02) emitir(escucha.px + 1.5, escucha.py - 2, 1, { v: 3, g: -10, vida: 1200, cols: ['#e8304a', '#ff8aa0'], tipo: 'chispa', tam: 1 });
      if (tipo === 'nota' && Math.random() < 0.04) emitir(habla.px + 3, habla.py - 3, 1, { v: 6, g: -12, vida: 1100, cols: ['#2a2a3a', '#4a4a6a'], tipo: 'chispa', tam: 1 });
    }
    // Los que cargan en la batalla gritan.
    for (const w of gritos) { if (n > 60) break; if (hash(w.a.id + slot * 13) < 0.25 && dentro < 0.45) { bocadillo(w.px + 2, w.py - 9, DIBUJOS.grito, '#d02a2a'); n++; } }
  }
  // ---------- Partículas: sangre, chispas, humo, fogonazos, astillas, cascotes, salpicaduras ----------
  // Todo lo que salta, cae o sube durante unos instantes. Son solo para la vista (no tocan el mundo).
  let parts = [], ultimoCuadro = 0;
  const elegirDe = l => l[(Math.random() * l.length) | 0];
  // Emite n partículas en (x, y) (píxeles del mundo). o: v (velocidad), dx/dy (empuje), g (gravedad), vida (ms),
  // cols, tam, tipo ('sangre' salpica y queda en el suelo; 'humo' sube y crece; 'chispa' brilla; 'solido' rebota).
  /*
   * LOS GRANDES SUCESOS EN EL MAPA, durante unos segundos donde pasan:
   *  · saqueo: monedas de oro y sacos que saltan de la plaza, humo y un aro dorado;
   *  · independencia: sube una bandera nueva del color del reino que nace, con confeti de su color;
   *  · caída de un reino: su bandera se derrumba entre humo negro;
   *  · exterminio: la tierra del pueblo perseguido late en rojo oscuro, con una calavera encima;
   *  · la corte que huye: polvo de carros que salen deprisa.
   */
  const vistosSuc = new WeakSet();
  let sucVivos = [];
  const COLOR_SUC = { saqueo: '#ffd23a', independencia: '#8af0a0', caida: '#ff8a7a', exterminio: '#ff6a6a', huye: '#ffe08a' };
  function sucesosMapa(ahora, x0, y0, x1, y1) {
    const v = m.vida;
    for (const su of v.sucesos || []) {
      if (vistosSuc.has(su)) continue;
      vistosSuc.add(su);
      if (m.turno - su.turno > 1 || su.region == null) continue;
      sucVivos.push({ su, inicio: ahora });
      anunciar(su.region, su.texto, COLOR_SUC[su.tipo]);
    }
    sucVivos = sucVivos.filter(e => ahora - e.inicio < 8000);
    const R = V.SUB * P;
    for (const e of sucVivos) {
      const su = e.su, t = (ahora - e.inicio) / 8000, cx = (su.region % m.W) * R + R / 2, cy = Math.floor(su.region / m.W) * R + R / 2;
      if (cx < x0 - R * 2 || cy < y0 - R * 2 || cx > x1 + R * 2 || cy > y1 + R * 2) continue;
      const civ = su.civ != null ? S.civ(m, su.civ) : null, otro = su.otro != null ? S.civ(m, su.otro) : null;
      const col = (civ && civ.color) || '#ffffff', colOtro = (otro && otro.color) || '#888888';
      // Un aro que se abre una y otra vez, del color del suceso.
      const q = ((ahora - e.inicio) % 1600) / 1600;
      g.strokeStyle = COLOR_SUC[su.tipo]; g.globalAlpha = (1 - q) * 0.7 * (1 - t); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, cy, 6 + q * R * 1.3, (6 + q * R * 1.3) * 0.6, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      if (su.tipo === 'saqueo') {
        if (t < 0.7 && Math.random() < 0.5) emitir(cx + (Math.random() - 0.5) * R, cy, 3, { v: 45, ang: -Math.PI / 2, cono: 1.6, g: 140, vida: 1300, cols: ['#ffd23a', '#ffe98a', '#c89a1a'], tipo: 'solido', tam: 1.4, tamAzar: 1 });
        if (t < 0.7 && Math.random() < 0.15) emitir(cx + (Math.random() - 0.5) * R, cy, 1, { v: 35, ang: -Math.PI / 2, cono: 1.2, g: 120, vida: 1500, cols: ['#c8a070', '#a8804a'], tipo: 'solido', tam: 3 });
        if (Math.random() < 0.25) emitir(cx + (Math.random() - 0.5) * R * 0.8, cy - 4, 1, { v: 10, g: -10, vida: 2600, cols: [HUMO_GRIS], tipo: 'humo', tam: 4, tamAzar: 1 });
        if (t < 0.6 && Math.random() < 0.35) emitir(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R * 0.6, 3, { v: 14, g: -30, vida: 600, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 1.4, tamAzar: 1 });
      } else if (su.tipo === 'independencia' || su.tipo === 'caida') {
        // La bandera: en la independencia sube y ondea; en la caída se inclina y cae.
        const cae = su.tipo === 'caida', bandera = cae ? colOtro : col;
        const sube = cae ? 1 : Math.min(1, t / 0.2), ang = cae ? Math.min(Math.PI / 2, Math.max(0, (t - 0.1) / 0.4) * Math.PI / 2) : 0;
        g.save(); g.translate(cx, cy + 6); g.rotate(ang);
        const alto = 26 * sube;
        g.fillStyle = '#3a2a1a'; g.fillRect(-1, -alto, 2, alto);
        const ola = Math.sin(ahora / 160) * 1.5;
        g.fillStyle = bandera; g.beginPath(); g.moveTo(1, -alto); g.lineTo(14, -alto + 3 + ola); g.lineTo(13, -alto + 10 + ola); g.lineTo(1, -alto + 8); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1, -alto + 6, 12, 2);
        g.restore();
        if (!cae && t < 0.6 && Math.random() < 0.5) emitir(cx, cy - 20, 4, { v: 50, g: 60, vida: 1400, cols: [col, '#ffffff', col], tipo: 'chispa', tam: 1.2, tamAzar: 1 });
        if (cae && Math.random() < 0.4) emitir(cx + (Math.random() - 0.5) * R * 0.7, cy - 2, 1, { v: 12, g: -12, vida: 3000, cols: ['rgba(30,26,24,A)', HUMO_GRIS], tipo: 'humo', tam: 5, tamAzar: 1 });
      } else if (su.tipo === 'exterminio') {
        const pulso = 0.18 + 0.12 * Math.sin(ahora / 260);
        g.fillStyle = 'rgba(120,0,0,' + (pulso * (1 - t)).toFixed(3) + ')';
        for (let r = 0; r < m.W * m.H; r++) if (m.dueno[r] === su.otro) { const rx = (r % m.W) * R, ry = Math.floor(r / m.W) * R; if (rx + R >= x0 && ry + R >= y0 && rx <= x1 && ry <= y1) g.fillRect(rx, ry, R, R); }
        // La calavera, en píxeles, flotando sobre la capital.
        const sy = cy - 24 + Math.sin(ahora / 400) * 2, k = 2;
        g.globalAlpha = 1 - t; g.fillStyle = '#f0e8dc';
        g.fillRect(cx - 3 * k, sy - 3 * k, 6 * k, 5 * k); g.fillRect(cx - 2 * k, sy + 2 * k, 4 * k, 2 * k);
        g.fillStyle = '#2a0a0a'; g.fillRect(cx - 2 * k, sy - 1 * k, 1.5 * k, 1.5 * k); g.fillRect(cx + 0.5 * k, sy - 1 * k, 1.5 * k, 1.5 * k); g.fillRect(cx - 0.5 * k, sy + 1 * k, 1 * k, 1 * k);
        g.globalAlpha = 1;
      } else if (su.tipo === 'huye' && t < 0.5 && Math.random() < 0.4) {
        emitir(cx + (Math.random() - 0.5) * R, cy + 4, 2, { v: 14, g: -4, vida: 1400, cols: [POLVO], tipo: 'humo', tam: 2.5 });
      }
    }
  }
  function emitir(x, y, n, o) {
    if (parts.length > 1400) return;
    for (let i = 0; i < n; i++) {
      const ang = o.cono != null ? o.ang + (Math.random() - 0.5) * o.cono : Math.random() * Math.PI * 2, vel = (o.v || 20) * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(ang) * vel + (o.dx || 0), vy: Math.sin(ang) * vel * (o.plano ? 0.5 : 1) + (o.dy || 0), g: o.g != null ? o.g : 70,
        t: 0, vida: (o.vida || 600) * (0.6 + Math.random() * 0.8), col: elegirDe(o.cols || ['#ffffff']), tam: (o.tam || 1) * (o.tamAzar ? 0.6 + Math.random() * 0.8 : 1), tipo: o.tipo || 'solido', suelo: y + (o.suelo != null ? o.suelo : 3 + Math.random() * 3) });
    }
  }
  function pintarParticulas(ahora) {
    const dt = Math.min(0.05, Math.max(0, (ahora - (ultimoCuadro || ahora)) / 1000)); ultimoCuadro = ahora;
    const vivas = [];
    for (const q of parts) {
      q.t += dt * 1000;
      if (q.t > q.vida) continue;
      vivas.push(q);
      const f = q.t / q.vida;
      if (q.tipo === 'humo') { q.x += (q.vx * 0.3 + 4) * dt; q.y += (q.vy * 0.3 - 9) * dt; const r = q.tam * (1 + f * 2.5); g.fillStyle = q.col.replace('A', (0.45 * (1 - f)).toFixed(2)); g.fillRect(q.x - r / 2, q.y - r / 2, r, r); continue; }
      if (!q.parado) {
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y >= q.suelo && q.vy > 0) {
          if (q.tipo === 'sangre') { q.parado = 1; q.y = q.suelo; q.tam *= 1.3; }
          else if (q.tipo === 'solido' && Math.abs(q.vy) > 8) { q.vy *= -0.35; q.vx *= 0.6; q.y = q.suelo; }
          else { q.parado = 1; q.y = q.suelo; }
        }
      }
      g.globalAlpha = q.tipo === 'chispa' ? 1 - f : q.parado ? Math.min(1, (1 - f) * 2) : 1;
      g.fillStyle = q.tipo === 'chispa' && Math.floor(q.t / 60) % 2 ? '#fff6c0' : q.col;
      g.fillRect(q.x, q.y, q.tam, q.tam * (q.parado && q.tipo === 'sangre' ? 0.6 : 1));
    }
    g.globalAlpha = 1;
    parts = vivas;
  }
  const SANGRE = ['#b01818', '#8a0e0e', '#d02a2a', '#6a0a0a'];
  const HUMO_GRIS = 'rgba(90,86,84,A)', HUMO_CLARO = 'rgba(200,200,205,A)', POLVO = 'rgba(170,150,120,A)';
  // Lo que pasa en este turno y ya se ha visto en pantalla (cada cosa suelta sus partículas una sola vez).
  let vistos = new Set();
  function eventosParticulas(k, x0, y0, x1, y1) {
    const v = m.vida, enVistaPx = (x, y) => x > x0 - 20 && y > y0 - 20 && x < x1 + 20 && y < y1 + 20;
    // Golpes: un chorro de sangre en la dirección del golpe (y chispas si chocan metales).
    for (const gp of v.golpes || []) {
      if (k < gp[1] - 0.05 || vistos.has(gp)) continue;
      vistos.add(gp);
      const pos = dibujados.get(gp[0]);
      if (!pos) continue;
      const [px, py] = pos;
      if (!enVistaPx(px, py)) continue;
      const ang = Math.atan2(py - (gp[3] * P + 6), px - (gp[2] * P + 6.5)), n = Math.min(14, 4 + Math.round(gp[4] / 4));
      emitir(px + 1.5, py + 2, n, { v: 26 + gp[4], ang, cono: 1.6, g: 90, vida: 1600, cols: SANGRE, tipo: 'sangre', tam: 0.8, tamAzar: 1, dy: -10 });
      if (gp[4] >= 12 && Math.random() < 0.6) emitir(px + 1.5, py + 1, 3, { v: 30, g: 40, vida: 260, cols: ['#ffe080', '#ffffff'], tipo: 'chispa', tam: 0.6 });
    }
    // Disparos: fogonazo y humo al salir; al llegar, polvo, astillas o una explosión.
    for (const d of v.disparos || []) {
      const [x1d, y1d, x2d, y2d, paso, tipo] = d;
      const ax = x1d * P + 8, ay = y1d * P + 7, bx = x2d * P + 8, by = y2d * P + 7;
      if (k >= paso - 1 && !vistos.has(d)) {
        vistos.add(d);
        if (enVistaPx(ax, ay)) {
          if (tipo === 1) { emitir(ax + 2, ay - 2, 4, { v: 14, g: -5, vida: 900, cols: [HUMO_CLARO], tipo: 'humo', tam: 2 }); emitir(ax + 2, ay - 1, 4, { v: 30, ang: Math.atan2(by - ay, bx - ax), cono: 0.6, g: 0, vida: 150, cols: ['#ffd23a', '#fff6a0'], tipo: 'chispa', tam: 1 }); }
          else if (tipo === 2) { emitir(ax, ay - 3, 8, { v: 18, g: -5, vida: 1400, cols: [HUMO_CLARO, HUMO_GRIS], tipo: 'humo', tam: 3 }); emitir(ax, ay - 2, 6, { v: 40, ang: Math.atan2(by - ay, bx - ax), cono: 0.7, g: 0, vida: 200, cols: ['#ff9a3a', '#ffd23a'], tipo: 'chispa', tam: 1.4 }); }
          else if (tipo === 4) emitir(ax, ay - 1, 3, { v: 10, g: 20, vida: 500, cols: ['#ff8a1e', '#ffd84a'], tipo: 'chispa', tam: 0.8 });
        }
      }
      const llega = tipo === 3 ? paso : tipo === 2 ? paso - 0.15 : paso;
      const clave = d.length + 'l';
      if (k >= llega && !(d.impacto)) {
        d.impacto = 1; void clave;
        if (!enVistaPx(bx, by)) continue;
        if (tipo === 5) {
          // La granada revienta: fogonazo pequeño, tierra que salta y un poco de humo.
          emitir(bx, by, 8, { v: 40, g: 20, vida: 260, cols: ['#ffd84a', '#ff8a1e', '#fff6c0'], tipo: 'chispa', tam: 1.2, tamAzar: 1 });
          emitir(bx, by, 8, { v: 40, g: 120, vida: 1000, cols: ['#4a3a2a', '#6a5a46', '#2a221a'], tipo: 'solido', tam: 1, tamAzar: 1, dy: -30 });
          emitir(bx, by - 2, 5, { v: 12, g: -8, vida: 1800, cols: [HUMO_GRIS], tipo: 'humo', tam: 3, tamAzar: 1 });
        } else if (tipo === 2 || tipo === 3) {

          // Explosión: bola de fuego, tierra y cascotes que vuelan, y una columna de humo negro.
          emitir(bx, by, 16, { v: 50, g: 20, vida: 380, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a', '#fff6c0'], tipo: 'chispa', tam: 1.6, tamAzar: 1 });
          emitir(bx, by, 14, { v: 55, g: 120, vida: 1400, cols: ['#4a3a2a', '#6a5a46', '#2a221a', '#7a746c'], tipo: 'solido', tam: 1.2, tamAzar: 1, dy: -40 });
          emitir(bx, by - 2, 10, { v: 16, g: -8, vida: 2600, cols: [HUMO_GRIS, 'rgba(40,36,34,A)'], tipo: 'humo', tam: 4, tamAzar: 1 });
        } else if (tipo === 1) {
          emitir(bx, by + 2, 5, { v: 22, g: 80, vida: 500, cols: ['#a89070', '#8a7458', '#c8b090'], tipo: 'solido', tam: 0.8, dy: -18 });
          emitir(bx, by + 1, 2, { v: 8, g: -4, vida: 700, cols: [POLVO], tipo: 'humo', tam: 2 });
        } else if (tipo === 4) {
          emitir(bx, by, 6, { v: 20, g: 30, vida: 700, cols: ['#ff8a1e', '#ffd84a', '#ff4b1a'], tipo: 'chispa', tam: 1 });
        } else {
          emitir(bx, by + 2, 4, { v: 16, g: 90, vida: 500, cols: ['#8a5a2b', '#c8a070', '#6b4a2b'], tipo: 'solido', tam: 0.7, dy: -14 });
        }
      }
    }
  }

  // ---------- Fuego, agua y marcas del suelo ----------
  const enVista = (t, x0, y0, x1, y1) => { const x = (t % m.vida.tw) * P, y = Math.floor(t / m.vida.tw) * P; return x + P >= x0 && y + P >= y0 && x <= x1 && y <= y1; };
  // Ceniza, cráteres, sangre y escombros (debajo de todo lo que se mueve), y el agua de las inundaciones.
  function huellas(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, mk = v.marcas || {}, desde = v.marcasPaso || {};
    for (const key of Object.keys(mk)) {
      const t = +key;
      if (desde[t] != null && k < desde[t]) continue;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, tipo = mk[key][0], h = q => hash(t * 13 + q);
      const quedan = mk[key][1] - m.turno, desv = Math.max(0.35, Math.min(1, quedan / 4));
      g.globalAlpha = desv;
      if (tipo === 1) {
        // Ceniza: una mancha gris oscura irregular con tocones y alguna brasa al principio.
        g.fillStyle = 'rgba(40,36,34,0.55)';
        for (let q = 0; q < 7; q++) g.fillRect(x + 1 + h(q) * 11, y + 2 + h(q + 9) * 11, 3 + h(q + 3) * 3, 2 + h(q + 5) * 3);
        g.fillStyle = 'rgba(110,104,98,0.6)'; for (let q = 0; q < 5; q++) g.fillRect(x + h(q + 20) * 15, y + h(q + 30) * 15, 1, 1);
        if (h(40) < 0.5) { g.fillStyle = '#2a201a'; g.fillRect(x + 6, y + 8, 3, 3); g.fillStyle = '#3a2c22'; g.fillRect(x + 6, y + 7, 3, 1); }
        if (quedan > 6 && Math.floor(ahora / 300 + t) % 3 === 0) { g.fillStyle = '#ff7a2a'; g.fillRect(x + 4 + h(50) * 8, y + 5 + h(51) * 8, 1, 1); }
      } else if (tipo === 2) {
        // Cráter: un hoyo oscuro con borde de tierra removida y terrones alrededor.
        g.fillStyle = 'rgba(90,64,40,0.85)'; g.beginPath(); g.ellipse(x + 8, y + 9, 7.5, 5.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(36,26,18,0.95)'; g.beginPath(); g.ellipse(x + 8, y + 9.5, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(20,14,10,0.9)'; g.beginPath(); g.ellipse(x + 8, y + 10, 2.6, 1.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7a5a36'; for (let q = 0; q < 8; q++) { const a = h(q) * Math.PI * 2, r = 8 + h(q + 8) * 3; g.fillRect(x + 8 + Math.cos(a) * r, y + 9 + Math.sin(a) * r * 0.75, 1 + (q % 2), 1); }
        if (quedan > 10) { g.fillStyle = 'rgba(80,80,80,' + (0.25 + 0.15 * Math.sin(ahora / 300 + t)).toFixed(2) + ')'; g.fillRect(x + 6, y + 3 - (ahora / 200 + t) % 4, 3, 2); }
      } else if (tipo === 3) {
        // Sangre: unas salpicaduras de rojo oscuro.
        g.fillStyle = 'rgba(120,14,14,0.75)';
        g.fillRect(x + 5 + h(1) * 5, y + 8 + h(2) * 4, 3, 2); g.fillRect(x + 4 + h(3) * 7, y + 7 + h(4) * 5, 1, 1); g.fillRect(x + 7 + h(5) * 5, y + 10 + h(6) * 3, 2, 1);
        g.fillStyle = 'rgba(80,6,6,0.8)'; g.fillRect(x + 6 + h(7) * 4, y + 9 + h(8) * 3, 1, 1);
      } else if (tipo === 4) {
        // Escombros: piedras, vigas y tejas por el suelo.
        for (let q = 0; q < 9; q++) { g.fillStyle = ['#7a746c', '#5a544c', '#6b4a2b', '#9a8a78', '#a04a3a'][q % 5]; g.fillRect(x + h(q) * 14, y + 4 + h(q + 11) * 11, 1 + (h(q + 22) < 0.4 ? 1 : 0), 1); }
      }
    }
    g.globalAlpha = 1;
    // El agua desbordada: azul turbio con brillos que se mueven.
    const inund = v.inundado || {};
    for (const key of Object.keys(inund)) {
      const t = +key;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, tw = v.tw;
      // El borde del agua se redondea donde acaba la inundación (charcos con orilla, no cuadros).
      const n = !inund[t - tw], s2 = !inund[t + tw], o = !inund[t - 1], e = !inund[t + 1];
      g.fillStyle = 'rgba(52,118,186,0.6)';
      g.beginPath();
      if (g.roundRect) g.roundRect(x + (o ? 1 : 0), y + (n ? 1 : 0), P - (o ? 1 : 0) - (e ? 1 : 0), P - (n ? 1 : 0) - (s2 ? 1 : 0), [n && o ? 6 : 0, n && e ? 6 : 0, s2 && e ? 6 : 0, s2 && o ? 6 : 0]);
      else g.rect(x, y, P, P);
      g.fill();
      g.fillStyle = 'rgba(120,80,40,0.25)'; g.fillRect(x + 3, y + 6, 4, 2); // barro arrastrado
      g.fillStyle = 'rgba(210,235,250,0.55)';
      const f = (ahora / 500 + t * 0.37) % 1;
      g.fillRect(x + 2 + f * 8, y + 4, 4, 1); g.fillRect(x + 9 - f * 6, y + 11, 3, 1);
      if (n) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 3, y + 1, P - 6, 1); }
    }
  }
  // Las llamas de este turno: arden desde el paso en que prenden hasta que se apagan, con humo y pavesas.
  function llamas(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, ll = v.llamas || {};
    for (const key of Object.keys(ll)) {
      const t = +key, [ini, fin] = ll[key];
      if (k < ini || k > fin + 2) continue;
      if (!enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P;
      const vivo = k < fin, apaga = vivo ? Math.min(1, (k - ini) * 2 + 0.3) : Math.max(0, 1 - (k - fin) / 2);
      // Humo: bocanadas grises que suben y se van a un lado.
      for (let q = 0; q < 4; q++) {
        const f = ((ahora / 1400 + q / 4 + hash(t + q) * 0.3) % 1);
        g.fillStyle = 'rgba(' + (vivo ? '70,66,64' : '110,108,106') + ',' + ((1 - f) * 0.45 * (vivo ? 1 : apaga)).toFixed(2) + ')';
        const r = 2 + f * 4;
        g.fillRect(x + 6 + f * 6 + Math.sin(ahora / 400 + q) * 1.5 - r / 2, y + 2 - f * 22 - r / 2, r, r);
      }
      if (!vivo) continue;
      // Brasas en la base y llamas: lenguas afiladas que bailan, rojas abajo, naranjas y amarillas en la punta.
      g.fillStyle = 'rgba(120,24,10,0.7)'; g.beginPath(); g.ellipse(x + 8, y + 13.5, 6.5, 2, 0, 0, Math.PI * 2); g.fill();
      for (let q = 0; q < 5; q++) {
        const ph = ahora / (85 + q * 19) + t + q * 1.7;
        const alto = (4 + 5 * Math.abs(Math.sin(ph)) + hash(t * 3 + q) * 4) * apaga * (q === 2 ? 1.35 : q === 0 || q === 4 ? 0.7 : 1);
        const cx = x + 2.5 + q * 2.8 + Math.sin(ph * 0.7) * 0.8, base = y + 14, ladeo = Math.sin(ph * 1.3) * 1.2;
        const lengua = (col, w, h0) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - w, base); g.quadraticCurveTo(cx - w * 0.8, base - h0 * 0.6, cx + ladeo, base - h0); g.quadraticCurveTo(cx + w * 0.8, base - h0 * 0.6, cx + w, base); g.closePath(); g.fill(); };
        lengua('#d0301c', 2.2, alto); lengua('#ff8a1e', 1.6, alto * 0.75); lengua('#ffd84a', 0.9, alto * 0.45);
      }
      g.fillStyle = 'rgba(255,248,210,0.9)'; g.fillRect(x + 7, y + 12, 2, 1);
      if (Math.random() < 0.06) emitir(x + 4 + Math.random() * 8, y + 6, 1, { v: 6, g: -30, vida: 1300, cols: ['#ffd84a', '#ff8a1e', '#ff4b1a'], tipo: 'chispa', tam: 0.8 });
      if (Math.random() < 0.03) emitir(x + 8, y + 2, 1, { v: 4, g: -6, vida: 2200, cols: [HUMO_GRIS], tipo: 'humo', tam: 3 });
      // Pavesas que suben.
      for (let q = 0; q < 3; q++) { const f = (ahora / 700 + q / 3 + hash(t + q * 5)) % 1; g.fillStyle = f < 0.5 ? '#ffd84a' : '#ff6a1a'; g.fillRect(x + 4 + hash(t + q) * 8 + Math.sin(ahora / 200 + q) * 2, y + 6 - f * 16, 1, 1); }
    }
  }
  // Después de la noche: el resplandor del fuego ilumina alrededor (se ve mucho mejor a oscuras).
  function resplandor(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, ll = v.llamas || {}, o = oscuridad(performance.now());
    const claves = Object.keys(ll);
    if (!claves.length) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const key of claves) {
      const t = +key, [ini, fin] = ll[key];
      if (k < ini || k >= fin || !enVista(t, x0, y0, x1, y1)) continue;
      const x = (t % v.tw) * P + 8, y = Math.floor(t / v.tw) * P + 9, r = 14 + 2 * Math.sin(ahora / 120 + t);
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(255,140,40,' + (0.22 + 0.3 * o).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }
  // Polvo de los derrumbes y cascotes que saltan con las explosiones.
  let polvos = [];
  function polvo(t, fuerte) { polvos.push({ t, inicio: performance.now(), fuerte: !!fuerte }); if (polvos.length > 120) polvos = polvos.slice(-120); }
  function pintarPolvo(ahora) {
    polvos = polvos.filter(p => ahora - p.inicio < 1400);
    for (const p of polvos) {
      const f = (ahora - p.inicio) / 1400, x = (p.t % m.vida.tw) * P + 8, y = Math.floor(p.t / m.vida.tw) * P + 10;
      g.fillStyle = 'rgba(170,150,120,' + (0.5 * (1 - f)).toFixed(2) + ')';
      const r = 4 + f * (p.fuerte ? 14 : 9);
      g.beginPath(); g.ellipse(x, y - f * 4, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,80,70,' + (1 - f).toFixed(2) + ')';
      for (let q = 0; q < (p.fuerte ? 8 : 4); q++) { const a = hash(p.t + q) * Math.PI * 2, vel = 6 + hash(p.t * 7 + q) * 10; g.fillRect(x + Math.cos(a) * vel * f, y - 10 * f + 18 * f * f + Math.sin(a) * vel * f * 0.6, 1, 1); }
    }
  }

  // Aviones: cruzan desde su aeródromo hasta el blanco (llegan en V.VUELO pasos), sueltan las bombas y siguen de
  // largo, con su sombra en el suelo. Biplanos en la Era Moderna; bombarderos en la II Guerra Mundial.
  function pintarAviones(k) {
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    for (const [x0, y0, x1, y1, paso, civ, bomb] of (m.vida.aviones || [])) {
      const f = (k - paso) / (V.VUELO || 1.6);
      if (f < 0 || f > 1.9) continue;
      const ax = x0 * P + 8, ay = y0 * P + 8, bx = x1 * P + 8, by = y1 * P + 8;
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, img = ARTE().avion(color[civ] || '#cccccc', bomb), dir = bx >= ax ? 1 : -1;
      const ang = Math.atan2(by - ay, (bx - ax) || 0.01) - (dir < 0 ? Math.PI : 0);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 8, y + 16, 16, 3);
      g.save(); g.translate(x, y - 8); g.rotate(ang); if (dir < 0) g.scale(-1, 1);
      g.drawImage(img, -img.width * 0.65, -img.height * 0.65, img.width * 1.3, img.height * 1.3);
      g.restore();
    }
  }

  // Flechas y balas: vuelan durante el paso en que se dispararon.
  function pintarDisparos(k) {
    const lista = m.vida.disparos || [];
    for (const [x1, y1, x2, y2, paso, bala] of lista) {
      const f = k - (paso - 1);
      if (f < 0 || f > 1) continue;
      const ax = x1 * P + 8, ay = y1 * P + 7, bx = x2 * P + 8, by = y2 * P + 7;
      if (bala === 3) {
        // Bomba de avión: cae en vertical y revienta.
        if (f < 0.75) { const yb = ay - 40 + 40 * (f / 0.75); g.fillStyle = '#2a2a2a'; g.fillRect(Math.round(bx - 0.5), Math.round(yb), 2, 3); }
        else { const q = (f - 0.75) / 0.25, rr = 2 + q * 7;
          // Onda expansiva y cascotes que saltan.
          g.strokeStyle = 'rgba(255,240,200,' + (0.6 * (1 - q)).toFixed(2) + ')'; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by, 4 + q * 16, (4 + q * 16) * 0.6, 0, 0, Math.PI * 2); g.stroke();
          g.fillStyle = '#4a3a2a'; for (let d = 0; d < 7; d++) { const a = hash(Math.round(bx) * 31 + d) * Math.PI * 2, vel = 10 + hash(Math.round(by) + d) * 12; g.fillRect(bx + Math.cos(a) * vel * q, by - 14 * q + 10 * q * q + Math.sin(a) * vel * q * 0.5, 1, 1); } g.fillStyle = 'rgba(255,' + Math.round(220 - q * 120) + ',80,' + (1 - q * 0.6).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(90,80,70,' + (0.6 * q).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by - 3 - q * 4, rr * 0.8, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      if (bala === 4) {
        // Flecha incendiaria: arco, punta en llamas y estela de humo.
        const arcoF = Math.min(14, Math.hypot(bx - ax, by - ay) * 0.25);
        const posF = q => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * arcoF];
        const [fx, fy] = posF(f);
        for (let d = 1; d <= 5; d++) { const [sx, sy] = posF(Math.max(0, f - d * 0.04)); g.fillStyle = 'rgba(120,110,100,' + (0.35 - d * 0.06).toFixed(2) + ')'; g.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 1); }
        g.fillStyle = '#6b4a2b'; g.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 1);
        g.fillStyle = Math.floor(performance.now() / 70) % 2 ? '#ffd84a' : '#ff6a1a'; g.fillRect(Math.round(fx) + 1, Math.round(fy) - 1, 2, 2);
        continue;
      }
      if (bala === 5) {
        // Granada: vuela en arco dando vueltas y revienta al caer.
        const arcoG = Math.min(18, Math.hypot(bx - ax, by - ay) * 0.5), q = Math.min(1, f / 0.8);
        const gx = ax + (bx - ax) * q, gy = ay - 4 + (by - ay + 4) * q - Math.sin(q * Math.PI) * arcoG;
        if (f < 0.8) { const gira = Math.floor(f * 10) % 2; g.fillStyle = '#3e4a2a'; g.fillRect(Math.round(gx), Math.round(gy), gira ? 2 : 1, gira ? 1 : 2); g.fillStyle = '#5c6a3a'; g.fillRect(Math.round(gx), Math.round(gy), 1, 1); }
        else { const e = (f - 0.8) / 0.2, rr = 1.5 + e * 5; g.fillStyle = 'rgba(255,' + Math.round(230 - e * 110) + ',80,' + (1 - e * 0.6).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      if (bala === 2) {
        // Obús: vuela en arco alto y explota al llegar.
        const arcoO = Math.min(30, Math.hypot(bx - ax, by - ay) * 0.45), q = Math.min(1, f / 0.85);
        const ox = ax + (bx - ax) * q, oy = ay + (by - ay) * q - Math.sin(q * Math.PI) * arcoO;
        if (f < 0.2) { g.fillStyle = 'rgba(230,230,230,' + (0.7 - f * 3).toFixed(2) + ')'; g.fillRect(ax - 1, ay - 5 - f * 12, 5, 4); }
        if (f < 0.85) { g.fillStyle = '#1e1e1e'; g.fillRect(Math.round(ox), Math.round(oy), 2, 2); }
        else { const e = (f - 0.85) / 0.15, rr = 2 + e * 6; g.fillStyle = 'rgba(255,' + Math.round(200 - e * 100) + ',60,' + (1 - e * 0.5).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      const arco = bala ? 0 : Math.min(14, Math.hypot(bx - ax, by - ay) * 0.25);
      const pos = q => [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * arco];
      const [x, y] = pos(f), [xa, ya] = pos(Math.max(0, f - 0.08));
      const ang = Math.atan2(y - ya, x - xa), cx = Math.cos(ang), cy = Math.sin(ang);
      if (bala) {
        if (f < 0.3) { g.fillStyle = '#ffd23a'; g.fillRect(ax + 2, ay - 2, 3, 3); g.fillStyle = 'rgba(220,220,230,' + (0.7 - f * 2).toFixed(2) + ')'; g.fillRect(ax + 1, ay - 6 - f * 10, 4, 3); }
        g.fillStyle = 'rgba(255,240,160,0.5)'; for (let d = 1; d <= 4; d++) g.fillRect(Math.round(x - cx * d), Math.round(y - cy * d), 1, 1);
        g.fillStyle = '#fff6a0'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
      } else {
        // La flecha: astil, punta y plumas, apuntando hacia donde vuela, con una estela tenue.
        g.fillStyle = 'rgba(255,255,255,0.25)'; for (let d = 6; d <= 10; d++) g.fillRect(Math.round(x - cx * d), Math.round(y - cy * d), 1, 1);
        g.fillStyle = '#6b4a2b'; for (let d = -3; d <= 2; d++) g.fillRect(Math.round(x + cx * d), Math.round(y + cy * d), 1, 1);
        g.fillStyle = '#e8ecf4'; g.fillRect(Math.round(x + cx * 3), Math.round(y + cy * 3), 2, 2);
        g.fillStyle = '#f4f4f4'; g.fillRect(Math.round(x - cx * 4), Math.round(y - cy * 4 - 1), 1, 1); g.fillRect(Math.round(x - cx * 4), Math.round(y - cy * 4 + 1), 1, 1);
      }
    }
  }

  // Donde muere un aldeano queda una cruz un rato.
  function pintarTumbas(ahora) {
    tumbas = tumbas.filter(tb => ahora - tb.inicio < (tb.quien ? 11600 : 9000));
    for (const tb of tumbas) {
      const t = ahora - tb.inicio;
      if (t < 0) continue;
      const x = tb.x * P + 6, y = tb.y * P + 5;
      if (tb.tipo === 'ahogado') {
        // Se hunde: unas burbujas que suben y se apagan, y un remolino.
        if (t > 3500) continue;
        g.globalAlpha = Math.max(0, 1 - t / 3500);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let k = 0; k < 4; k++) { const f = ((t / 900) + k / 4) % 1; g.fillRect(Math.round(x + 1 + Math.sin(k * 2 + t / 300) * 2), Math.round(y + 4 - f * 9), k % 2 ? 1 : 2, k % 2 ? 1 : 2); }
        g.fillRect(x - 2, y + 5, 7, 1);
        g.globalAlpha = 1;
        continue;
      }
      if (tb.tipo === 'animal') {
        // El animal cae de lado y queda tendido un momento.
        if (t > 2600 || !tb.quien) continue;
        const b = tb.quien, col = { oveja: '#eeeae0', vaca: '#6b4a2b', ciervo: '#9a6a3a', lobo: '#7a7a82' }[b.tipo] || '#999';
        if (b.tipo === 'pez') continue;
        g.globalAlpha = t < 1800 ? 1 : 1 - (t - 1800) / 800;
        const ax = tb.x * P + 6, ay = tb.y * P + 9, cae = Math.min(1, t / 220);
        if (t < 260) { g.fillStyle = '#ff2a2a'; g.fillRect(ax - 1, ay - 2 + cae * 2, 6, 4); }
        else {
          g.fillStyle = 'rgba(110,10,10,' + Math.min(0.7, (t - 260) / 900).toFixed(2) + ')'; g.beginPath(); g.ellipse(ax + 2, ay + 3, 2 + Math.min(3, t / 500), 1.2 + Math.min(1, t / 900), 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = col; g.fillRect(ax - 1, ay, 6, 3);
          g.fillStyle = '#3a2a1e'; g.fillRect(ax, ay - 1, 1, 1); g.fillRect(ax + 3, ay - 1, 1, 1); g.fillRect(ax + 5, ay + 1, 1, 1);
        }
        g.globalAlpha = 1;
        continue;
      }
      if (!tb.estallo && tb.quien && ['batalla', 'flecha', 'torre', 'lobo', 'obus', 'bomba'].includes(tb.tipo)) { tb.estallo = 1; emitir(tb.x * P + 8, tb.y * P + 9, 14, { v: 34, g: 100, vida: 1800, cols: SANGRE, tipo: 'sangre', tam: 0.9, tamAzar: 1, dy: -22 }); }
      if (tb.quien && t < 2600 && !['ahogado', 'vejez', 'hambre', 'peste', 'plaga'].includes(tb.tipo)) {
        // Cae como en WorldBox: destello rojo, se ladea y queda tendido con un charco de sangre; luego se desvanece.
        const a = tb.quien, civ = m.civs.find(c => c.id === tb.c), col = civ ? civ.color : '#cccccc';
        const img = a.veh ? ARTE().vehiculo(a.veh, col, 0) : figura(a, col, 0, 0, 0), EA = a.veh ? 0.85 : 0.5;
        const w = img.width * EA, h = img.height * EA, cx = tb.x * P + 8, cy = tb.y * P + 12;
        const giro = Math.min(1, t / 260) * Math.PI / 2 * ((a.id % 2) ? 1 : -1);
        if (t > 200 && !a.veh) { g.fillStyle = 'rgba(120,10,10,' + Math.min(0.7, (t - 200) / 700).toFixed(2) + ')'; g.beginPath(); g.ellipse(cx, cy + 1, 2 + Math.min(4, t / 350), 1.2 + Math.min(1.5, t / 700), 0, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = t < 1800 ? 1 : 1 - (t - 1800) / 800;
        g.save(); g.translate(cx, cy);
        if (a.veh) {
          // El vehículo destrozado: se ennegrece y humea.
          g.drawImage(img, -w / 2, -h, w, h);
          g.globalAlpha *= Math.min(0.75, t / 400); g.drawImage(ARTE().tenido(img, '#1a1612'), -w / 2, -h, w, h);
        } else {
          g.rotate(giro);
          g.drawImage(img, -w / 2, -h, w, h);
          if (t < 300) { g.globalAlpha = t < 150 ? 0.9 : 0.5; g.drawImage(ARTE().tenido(img, t < 150 ? '#ff2a2a' : '#ffffff'), -w / 2, -h, w, h); }
          else { g.globalAlpha *= Math.min(0.45, (t - 300) / 1500); g.drawImage(ARTE().tenido(img, '#2a2026'), -w / 2, -h, w, h); }
        }
        g.restore(); g.globalAlpha = 1;
        if (a.veh) { for (let q = 0; q < 3; q++) { const f = ((t / 900) + q / 3) % 1; g.fillStyle = 'rgba(60,56,54,' + (0.5 * (1 - f)).toFixed(2) + ')'; g.fillRect(cx - 1 + f * 4, cy - 6 - f * 14, 2 + f * 3, 2 + f * 3); } }
        if (tb.tipo === 'fuego' && t < 1500) { g.fillStyle = Math.floor(t / 80) % 2 ? '#ff8a1e' : '#ffd84a'; g.fillRect(cx - 2, cy - 4, 2, 3); g.fillRect(cx + 1, cy - 3, 1, 2); }
        if (t < 2600) continue;
      }
      if ((tb.tipo === 'batalla' || tb.tipo === 'flecha' || tb.tipo === 'torre' || tb.tipo === 'lobo') && t < 900 && !tb.quien) {
        // Cae de lado: el cuerpo tendido, en rojo al principio, que se desvanece antes de que aparezca la cruz.
        const civ = m.civs.find(c => c.id === tb.c), col = civ ? civ.color : '#cccccc';
        g.globalAlpha = t < 600 ? 1 : 1 - (t - 600) / 300;
        const cae = Math.min(1, t / 160);
        if (cae < 1) { silueta(x, y - 1 + Math.round(cae * 3), t < 120 ? '#ff2a2a' : col); }
        else {
          g.fillStyle = '#1e1a24'; g.fillRect(x - 2.5, y + 2.5, 8, 3);
          g.fillStyle = t < 300 ? '#ff4b4b' : col; g.fillRect(x - 1, y + 3, 4, 2);
          g.fillStyle = '#f0c8a0'; g.fillRect(x + 3, y + 3, 1.5, 2);
          g.fillStyle = '#4a3a2e'; g.fillRect(x - 2, y + 3, 1, 2);
          g.fillStyle = '#9a1414'; g.fillRect(x, y + 5.5, 3, 0.5);
        }
        g.globalAlpha = 1;
        if (t < 600) continue;
      }
      if (tb.quien && tb.tipo === 'ahogado') continue;
      g.globalAlpha = t < 400 ? 1 : Math.max(0, 1 - (t - 400) / 8600);
      if (t < 400 && !tb.quien && tb.tipo !== 'batalla' && tb.tipo !== 'flecha' && tb.tipo !== 'torre' && tb.tipo !== 'lobo') { g.fillStyle = '#ff4b3a'; g.fillRect(x - 1, y - 1, 6, 7); }
      g.fillStyle = '#d8d8e0'; g.fillRect(x + 1, y, 1, 5); g.fillRect(x, y + 1, 3, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 5, 3, 1);
    }
    g.globalAlpha = 1;
  }
  function pintarCartel(ahora, dpr) {
    if (!cartel) return;
    const t = (ahora - cartel.inicio) / 3500;
    if (t >= 1) { cartel = null; return; }
    const tam = Math.round(20 * dpr);
    g.font = '600 ' + tam + 'px "Pixelify Sans", "Courier New", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ancho = Math.min(cv.width - 24 * dpr, g.measureText(cartel.texto).width + 32 * dpr), x = cv.width / 2, y = 34 * dpr;
    g.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
    g.fillStyle = 'rgba(13,19,34,0.9)'; g.fillRect(x - ancho / 2, y - tam, ancho, tam * 2);
    g.fillStyle = '#f0c05a'; g.fillRect(x - ancho / 2, y + tam - 3 * dpr, ancho, 3 * dpr);
    g.fillText(cartel.texto, x, y, ancho - 16 * dpr);
    g.globalAlpha = 1;
  }

  // ---------- La cámara ----------
  // Centra la cámara en una parcela concreta (tx, ty) y acerca.
  function centrarEnParcela(tx, ty, acercar) {
    if (!m) return;
    cam.x = tx * P + P / 2; cam.y = ty * P + P / 2;
    if (acercar) cam.z = Math.max(cam.z, acercar);
    limitar();
  }
  function centrarEn(region, acercar) {
    if (!m) return;
    const R = V.SUB * P;
    cam.x = (region % m.W) * R + R / 2; cam.y = Math.floor(region / m.W) * R + R / 2;
    if (acercar) cam.z = Math.max(cam.z, acercar);
    else if (cam.z < 1) cam.z = Math.max(zMin(), 1.5);
    limitar();
  }
  function zoom(factor, sx, sy) {
    if (!m) return;
    const { w, h } = vista();
    const px = sx == null ? w / 2 : sx, py = sy == null ? h / 2 : sy;
    const wx = cam.x + (px - w / 2) / cam.z, wy = cam.y + (py - h / 2) / cam.z;
    cam.z *= factor; limitar();
    cam.x = wx - (px - w / 2) / cam.z; cam.y = wy - (py - h / 2) / cam.z; limitar();
  }
  function verTodo() { cam.z = zMin(); limitar(); }

  function entradas() {
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', ev => {
      siguiendo = null;
      cv.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (punteros.size === 1) arrastre = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, movido: 0 };
      else arrastre = null;
      caja = tropas && punteros.size === 1 && (ev.pointerType !== 'mouse' || ev.button === 0) ? { x0: ev.clientX, y0: ev.clientY, x1: ev.clientX, y1: ev.clientY } : null;
      if (punteros.size > 1) caja = null;
    });
    cv.addEventListener('contextmenu', ev => { if (tropas) ev.preventDefault(); });
    cv.addEventListener('pointermove', ev => {
      if (arqui) { const rect = cv.getBoundingClientRect(), { w, h } = vista(); arqui.wx = cam.x + (ev.clientX - rect.left - w / 2) / cam.z; arqui.wy = cam.y + (ev.clientY - rect.top - h / 2) / cam.z; }
      if (!punteros.has(ev.pointerId)) return;
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        const [c, d] = [...punteros.values()];
        const d1 = Math.hypot(c.x - d.x, c.y - d.y), rect = cv.getBoundingClientRect();
        if (d0 > 0) zoom(d1 / d0, (c.x + d.x) / 2 - rect.left, (c.y + d.y) / 2 - rect.top);
        // (En el modo tropas, con dos dedos también se mueve la cámara.)
        if (tropas) { cam.x -= ((c.x + d.x) - (a.x + b.x)) / 2 / cam.z; cam.y -= ((c.y + d.y) - (a.y + b.y)) / 2 / cam.z; limitar(); }
        return;
      }
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!arrastre) return;
      arrastre.movido = Math.max(arrastre.movido, Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y));
      if (caja) { caja.x1 = ev.clientX; caja.y1 = ev.clientY; return; }
      cam.x = arrastre.cx - (ev.clientX - arrastre.x) / cam.z; cam.y = arrastre.cy - (ev.clientY - arrastre.y) / cam.z;
      limitar();
    });
    const soltar = ev => {
      const eraClic = arrastre && arrastre.movido < 6 && punteros.size === 1;
      // Modo tropas: un recuadro elige soldados; un toque elige uno o los manda a ese sitio.
      if (tropas && m && ev.type === 'pointerup' && punteros.size === 1 && (caja || eraClic)) {
        punteros.delete(ev.pointerId); arrastre = null;
        const rect = cv.getBoundingClientRect(), { w, h } = vista();
        const aMundo = (sx, sy) => [cam.x + (sx - rect.left - w / 2) / cam.z, cam.y + (sy - rect.top - h / 2) / cam.z];
        const mios = id => { const a = m.vida.aldeanos.find(x => x.id === id); return a && a.c === tropas.civ && a.o === 4; };
        if (caja && !eraClic) {
          const [ax, ay] = aMundo(Math.min(caja.x0, caja.x1), Math.min(caja.y0, caja.y1)), [bx, by] = aMundo(Math.max(caja.x0, caja.x1), Math.max(caja.y0, caja.y1));
          tropas.sel = new Set(); for (const [id, [x, y]] of dibujados) if (x >= ax - 2 && x <= bx + 2 && y >= ay - 4 && y <= by + 2 && mios(id)) tropas.sel.add(id);
        } else {
          const [wx, wy] = aMundo(ev.clientX, ev.clientY);
          let cerca = null, dmin = Math.max(5, 9 / cam.z);
          for (const [id, [x, y]] of dibujados) { const d = Math.hypot(x + 1.5 - wx, y + 2.5 - wy); if (d < dmin && mios(id)) { dmin = d; cerca = id; } }
          if (cerca != null) { if (tropas.sel.has(cerca)) tropas.sel.delete(cerca); else tropas.sel.add(cerca); }
          else if (tropas.sel.size) { const tx = Math.floor(wx / P), ty = Math.floor(wy / P); if (tx >= 0 && ty >= 0 && tx < m.vida.tw && ty < m.vida.th) { tropas.alOrdenar && tropas.alOrdenar(ty * m.vida.tw + tx); marcarDestino(ty * m.vida.tw + tx); } }
        }
        caja = null;
        if (tropas.alCambiar) tropas.alCambiar(tropas.sel);
        return;
      }
      caja = null;
      punteros.delete(ev.pointerId);
      if (eraClic && ev.type === 'pointerup' && alClicar && m) {
        const rect = cv.getBoundingClientRect(), { w, h } = vista();
        const wx = cam.x + (ev.clientX - rect.left - w / 2) / cam.z, wy = cam.y + (ev.clientY - rect.top - h / 2) / cam.z;
        // ¿Has tocado a un aldeano? (el más cercano, si está a unos pocos píxeles de pantalla)
        let cerca = null, dmin = Math.max(5, 9 / cam.z);
        for (const [id, [x, y]] of dibujados) { const d = Math.hypot(x + 1.5 - wx, y + 2.5 - wy); if (d < dmin) { dmin = d; cerca = id; } }
        const R = V.SUB * P, rx = Math.floor(wx / R), ry = Math.floor(wy / R);
        if (arqui) { const tx = Math.floor(wx / P), ty = Math.floor(wy / P); arqui.wx = wx; arqui.wy = wy; if (tx >= 0 && ty >= 0 && tx < m.vida.tw && ty < m.vida.th) arqui.alColocar(ty * m.vida.tw + tx); }
        else if (cerca != null && alClicarAldeano) alClicarAldeano(cerca);
        else if ((() => {
          // Tocar un edificio: la plaza del rey abre la corte; cualquier otro, su ficha (y el ayuntamiento, la de su ciudad).
          const tx = Math.floor(wx / P), ty = Math.floor(wy / P), t = ty * m.vida.tw + tx;
          if (tx < 0 || ty < 0 || tx >= m.vida.tw || ty >= m.vida.th) return false;
          const o = visto.obra[t], d = m.dueno[V.region(m, t)];
          if (alClicarCorte && (o === V.OBRA.centro || o === V.OBRA.palacio) && d >= 0) { alClicarCorte(d, t); return true; }
          if (alClicarEdificio && ((o && o !== V.OBRA.campo) || (m.vida.andamios && m.vida.andamios[t]))) { alClicarEdificio(t); return true; }
          return false;
        })()) { /* edificio */ }
        else if (rx >= 0 && ry >= 0 && rx < m.W && ry < m.H) alClicar(ry * m.W + rx);
      }
      if (punteros.size === 1) { const [p] = [...punteros.values()]; arrastre = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, movido: 99 }; }
      else if (!punteros.size) arrastre = null;
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener('wheel', ev => {
      ev.preventDefault();
      const rect = cv.getBoundingClientRect();
      zoom(Math.exp(-ev.deltaY * 0.0015), ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });
  }

  // El modo arquitecto: { clave, civ, valida(t) → razón o null, alColocar(t) }; null para salir.
  let arqui = null;
  function arquitecto(o) { arqui = o ? Object.assign({ wx: -1, wy: -1 }, o) : null; }
  function dibujoDe(clave, c) {
    const color = c ? c.color : '#cccccc', fase = c ? V.fase(c.era) : 0;
    if (clave === 'colonia') return ARTE().edificio('campamento', color, fase);
    if (clave === 'casa') return ARTE().casa(CASAS[c ? grupoEra(c.era) : 0], color, 0);
    if (clave === 'templo') return ARTE().edificio('templo', color, c && c.era === 4 ? 4 : fase);
    if (clave === 'saber') return ARTE().edificio('saber', color, M.ERUDITO(c ? c.era : 0).tipo);
    if (['banco', 'fabrica', 'estacion', 'hospital', 'aerodromo', 'central', 'aduana', 'petroleo', 'mina'].includes(clave)) return ARTE().edificio(clave, color, Math.max(2, fase));
    return ARTE().edificio(clave, color, fase);
  }
  function planos(ahora) {
    const v = m.vida, parpadeo = 0.45 + 0.2 * Math.sin(ahora / 260);
    const c = arqui ? S.civ(m, arqui.civ) : S.vivas(m).find(x => x.jugador);
    if (!c) return;
    // Lo encargado: el edificio en transparente con un marco de trazos; las calles por empedrar, en gris.
    g.save(); g.setLineDash([2, 1.5]); g.lineWidth = 0.8;
    for (const e of (c.plan && c.plan.encargos) || []) {
      const x = (e.t % v.tw) * P, y = Math.floor(e.t / v.tw) * P;
      g.globalAlpha = parpadeo; g.drawImage(dibujoDe(e.clave, c), x, y, P, P); g.globalAlpha = 1;
      g.strokeStyle = '#ffd76a'; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
    }
    // El sitio elegido para fundar un pueblo: el campamento en transparente, con su marco.
    if (c.plan && typeof c.plan.colonos === 'number') { const t = V.centro(m, c.plan.colonos), x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P; g.globalAlpha = parpadeo; g.drawImage(dibujoDe('colonia', c), x, y, P, P); g.globalAlpha = 1; g.strokeStyle = '#ffd76a'; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1); }
    if (arqui) for (const t of (v.pendientes && v.pendientes[c.id]) || []) { const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P; g.fillStyle = 'rgba(190,190,184,' + (parpadeo * 0.8).toFixed(2) + ')'; g.fillRect(x + 1, y + 1, P - 2, P - 2); }
    g.restore();
    if (!arqui || arqui.wx < 0) return;
    const tx = Math.floor(arqui.wx / P), ty = Math.floor(arqui.wy / P), t = ty * v.tw + tx;
    if (tx < 0 || ty < 0 || tx >= v.tw || ty >= v.th) return;
    const no = arqui.valida(t), x = tx * P, y = ty * P;
    g.globalAlpha = 0.75;
    if (arqui.clave === 'camino') { g.fillStyle = '#b4b2ac'; g.fillRect(x, y, P, P); } else g.drawImage(dibujoDe(arqui.clave, c), x, y, P, P);
    g.globalAlpha = 1;
    g.fillStyle = no ? 'rgba(255,60,40,0.35)' : 'rgba(80,255,120,0.25)'; g.fillRect(x, y, P, P);
    g.strokeStyle = no ? '#ff5a4a' : '#7aff9a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
    if (no) { const f = Math.max(2.5, 11 / cam.z); g.font = 'bold ' + f.toFixed(1) + 'px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.75)'; const w = g.measureText(no).width + f; g.fillRect(x + 8 - w / 2, y - f * 1.7, w, f * 1.4); g.fillStyle = '#ffd0c8'; g.fillText(no, x + 8, y - f * 0.6); }
  }
  function seleccionar(id) { sel = id; if (m) territorio(); }
  function elegirAldeano(id) { elegido = id; }
  function seguir(id) { siguiendo = id; elegido = id; if (id != null && cam.z < 2.5) cam.z = Math.min(4, Math.max(zMin(), 3)); }
  const siguiendoA = () => siguiendo;

  M.pintor = { camara: () => ({ x: cam.x, y: cam.y, z: cam.z }), dibujados: () => [...dibujados], modoTropas, tropasElegidas: () => (tropas ? [...tropas.sel] : []), elegirTropas: ids => { if (tropas) { tropas.sel = new Set(ids); if (tropas.alCambiar) tropas.alCambiar(tropas.sel); } }, trenes: () => ultimosTrenes.slice(), P, centrarEnParcela, batallas: () => (m ? listaBatallas() : []), arquitecto, anunciar, elegirAldeano, seguir, siguiendoA, iniciar, mundo, turno, refrescar, seleccionar, marcar, centrarEn, zoom, verTodo, efecto };
})(globalThis.RF = globalThis.RF || {});
