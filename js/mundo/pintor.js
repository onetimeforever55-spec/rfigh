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
  let cv = null, g = null, m = null, V = null, S = null, alClicar = null, alClicarAldeano = null;
  // Dónde se dibujó cada aldeano en el último fotograma (para tocarlo y para seguirlo con la cámara).
  const dibujados = new Map();
  let siguiendo = null, elegido = null;
  let lienzo = null, gl = null, capa = null, gc = null, regionDe = null, territorioPendiente = false;
  let visto = null, tierra = null, firma = [], pend = [], inicio = 0, duracion = 1000;
  let cam = { x: 0, y: 0, z: 2 }, sel = null, pulso = null, reducido = false, listo = false;
  let efectos = [], tumbas = [], cartel = null;
  const punteros = new Map();
  let arrastre = null;

  function iniciar(canvas, opciones) {
    cv = canvas; g = cv.getContext('2d');
    alClicar = (opciones && opciones.alClicar) || null;
    alClicarAldeano = (opciones && opciones.alClicarAldeano) || null;
    reducido = !!(opciones && opciones.reducido);
    S = M.sim; V = M.vida;
    entradas();
    if (window.ResizeObserver) new ResizeObserver(() => medir()).observe(cv.parentElement);
    else window.addEventListener('resize', medir);
    medir();
    requestAnimationFrame(fotograma);
  }

  function medir() {
    const caja = cv.parentElement, dpr = Math.min(2, window.devicePixelRatio || 1);
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
  function mundo(nuevo, enfocar) {
    m = nuevo; regionDe = null;
    if (!m.vida) V.crear(m);
    const v = m.vida;
    lienzo = document.createElement('canvas'); lienzo.width = v.tw * A; lienzo.height = v.th * A; gl = lienzo.getContext('2d');
    capa = document.createElement('canvas'); capa.width = v.tw * CA; capa.height = v.th * CA; gc = capa.getContext('2d');
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
    if (visto.camino && visto.camino[t]) caminoEn(t, x, y, ter);
    // Picos solo dentro de la sierra (rodeados de montaña) y repartidos al azar, no en filas.
    else if (ter === 'montana' && !visto.obra[t]) {
      const tx = t % v.tw, dentro = ['montana', 'nieve'].includes(tierra[t - 1]) + ['montana', 'nieve'].includes(tierra[t + 1]) + ['montana', 'nieve'].includes(tierra[t - v.tw]) + ['montana', 'nieve'].includes(tierra[t + v.tw]);
      if (tx > 0 && tx < v.tw - 1 && dentro >= 3 && (h >>> 11) % 5 < (dentro === 4 ? 3 : 1)) gl.drawImage(ARTE().pico((h >>> 3) % 8), x, y);
    }
    const obra = visto.obra[t];
    if (obra) {
      const r = V.region(m, t), c = m.dueno[r] >= 0 ? S.civ(m, m.dueno[r]) : null;
      const color = c ? c.color : '#9a7a5a', ge = c ? grupoEra(c.era) : 0;
      if (obra === V.OBRA.campo) gl.drawImage(ARTE().campo((visto.cultivo && visto.cultivo[t]) || 0, t % 2), x, y);
      else if (obra === V.OBRA.casa) {
        // Cada casa un poco distinta: unas en espejo, con el tejado más claro u oscuro, y algunas un píxel más abajo.
        const hv = (Math.imul(t, 2246822519) >>> 0) % 4;
        const img = ARTE().casa(CASAS[ge], hv === 3 ? mezclar(color, '#000000', 0.18) : hv === 2 ? mezclar(color, '#ffffff', 0.12) : color, (h >>> 7) % 4);
        const oy = (h >>> 5) % 2;
        if (hv % 2) { gl.save(); gl.translate(x + A, y + oy); gl.scale(-1, 1); gl.drawImage(img, 0, 0); gl.restore(); } else gl.drawImage(img, x, y + oy);
      }
      else if (obra === V.OBRA.ruina) gl.drawImage(ARTE().edificio('ruina', '#888888'), x, y);
      else if (obra === V.OBRA.ayuntamiento) gl.drawImage(ARTE().edificio('ayuntamiento', color), x, y);
      else if (obra === V.OBRA.torre) gl.drawImage(ARTE().edificio('torre', color, c ? V.fase(c.era) : 0), x, y);
      else if (obra === V.OBRA.cuartel) gl.drawImage(ARTE().edificio('cuartel', color, c ? V.fase(c.era) : 0), x, y);
      else if (obra === V.OBRA.arqueria) gl.drawImage(ARTE().edificio('arqueria', color, c ? V.fase(c.era) : 0), x, y);
      else if (obra === V.OBRA.castillo) gl.drawImage(ARTE().edificio('castillo', color, c ? V.fase(c.era) : 0), x, y);
      else if (obra === V.OBRA.templo) gl.drawImage(ARTE().edificio('templo', color), x, y);
      else if (obra === V.OBRA.molino) gl.drawImage(ARTE().edificio('molino', color), x, y);
      else if (obra === V.OBRA.puerto) gl.drawImage(ARTE().edificio('puerto', color), x, y);
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
    if (ter === 'rio') {
      // Puente de tablas con barandilla.
      gl.fillStyle = '#8a5a2a'; gl.fillRect(x, y + 3, A, 10);
      gl.fillStyle = '#6a4220'; for (let k = 1; k < A; k += 3) gl.fillRect(x + k, y + 3, 1, 10);
      gl.fillStyle = '#a8784a'; gl.fillRect(x, y + 3, A, 1);
      gl.fillStyle = '#3a2a1e'; gl.fillRect(x, y + 2, A, 1); gl.fillRect(x, y + 13, A, 1);
      for (let k = 0; k < A; k += 5) { gl.fillRect(x + k, y + 1, 1, 2); gl.fillRect(x + k, y + 13, 1, 2); }
      return;
    }
    const [base, borde, marca] = era >= 7 ? ['#55585f', '#3f4248', '#e8d070'] : era >= 3 ? ['#b9ad94', '#8a8070', '#d4cab2'] : ['#a7855a', '#86683f', '#bc9a6a'];
    gl.fillStyle = borde; gl.fillRect(x + 3, y + 3, 10, 10);
    for (const [si, lx, ly, w, hh] of lados) if (si) gl.fillRect(x + lx + (w === 4 ? 0 : -1), y + ly + (hh === 4 ? 0 : -1), w + (w === 4 ? 0 : 2), hh + (hh === 4 ? 0 : 2));
    gl.fillStyle = base; gl.fillRect(x + 4, y + 4, 8, 8);
    for (const [si, lx, ly, w, hh] of lados) if (si) gl.fillRect(x + lx, y + ly, w, hh);
    gl.fillStyle = marca;
    if (era >= 7) { if (lados[0][0] || lados[1][0]) for (let k = 1; k < A; k += 4) gl.fillRect(x + k, y + 7, 2, 1); if (lados[2][0] || lados[3][0]) for (let k = 1; k < A; k += 4) gl.fillRect(x + 7, y + k, 1, 2); }
    else if (era >= 3) { for (let j = 4; j < 12; j += 2) for (let i = 4 + (j % 4 ? 1 : 0); i < 12; i += 3) gl.fillRect(x + i, y + j, 2, 1); }
    else { gl.fillRect(x + 6, y + 6, 1, 1); gl.fillRect(x + 9, y + 8, 1, 1); gl.fillRect(x + 5, y + 10, 1, 1); }
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
      let f = formas.get(d); if (!f) formas.set(d, f = []); f.push(pts);
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
      if (capaN) { visto[capaN][ch[1]] = ch[3]; parcela(ch[1]); if (capaN === 'camino') vecinasCamino(ch[1]); }
      ch.hecho = true;
    }
    if (!quedan) pend = [];
  }
  // Compara lo pintado con el mundo (menos los cambios de este turno, que se irán aplicando) y repinta lo distinto.
  function sincronizar(cambios) {
    const v = m.vida, n = v.tw * v.th;
    aplicar(Infinity);
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
    sincronizar(m.vida.cambios || []);
    inicio = performance.now(); duracion = Math.max(80, ms || 1000);
    recogerMuertos(duracion);
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
  function recogerMuertos(dur) {
    const ahora = performance.now();
    for (const [x, y, c, tipo, paso] of (m.vida.muertos || [])) tumbas.push({ x, y, c, tipo, inicio: ahora + (paso ? (paso / V.TICKS) * (dur || 1000) : Math.random() * 500) });
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
    banderas(ahora);
    agua(ahora, x0, y0, x1, y1);
    barcos(k, ahora, x0, y0, x1, y1);
    animales(k, ahora, x0, y0, x1, y1);
    edificiosVivos(ahora, x0, y0, x1, y1);
    humo(ahora, x0, y0, x1, y1);
    aldeanos(k, ahora, x0, y0, x1, y1);
    pintarDisparos(k);
    pintarTumbas(ahora);
    pintarEfectos(ahora, x0, y0, x1, y1);
    asedios(ahora);
    nieve(ahora, x0, y0, x1, y1);
    pajaros(ahora, x0, y0, x1, y1);
    nubes(ahora, x0, y0, x1, y1);
    pintarAviones(k);
    marcarPulso(ahora);
    noche(ahora, x0, y0, x1, y1, z, ox, oy);
    g.setTransform(1, 0, 0, 1, 0, 0);
    nombres(z, ox, oy, dpr);
    pintarAnuncios(z, ox, oy, dpr, performance.now());
    pintarCartel(ahora, dpr);
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

  const ultimoOficio = new Map(), cambioVisto = new Map(), ultimaDir = new Map();
  function aldeanos(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    const ig = golpesDelTurno(v);
    dibujados.clear();
    for (const a of v.aldeanos) {
      const r = a.r;
      let px, py, acc;
      if (r && r.length >= 6) {
        const i = paso * 3, j = Math.min(r.length - 3, i + 3);
        const ax = r[i], ay = r[i + 1], bx = r[j], by = r[j + 1];
        px = (ax + (bx - ax) * f) * P + 6.5; py = (ay + (by - ay) * f) * P + 6;
        acc = r[j + 2];
        if (j === i) acc = r[i + 2];
      } else { px = a.x * P + 6.5; py = a.y * P + 6; acc = 0; }
      if (siguiendo === a.id) { cam.x = px; cam.y = py; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // Recibe un golpe: sale despedido un par de píxeles lejos de quien le pega. Pega: embiste hacia el otro.
      const recibe = golpeActivo(ig.golpes.get(a.id), k), pega = golpeActivo(ig.ataques.get(a.id), k);
      if (recibe) { const [gp, d] = recibe, emp = Math.round(2.5 * (1 - d)); px += Math.sign(a.x - gp[2]) * emp; py += Math.sign(a.y - gp[3]) * emp - (d < 0.5 ? 1 : 0); }
      if (pega) { const [at, d] = pega, emb = Math.round(2.5 * Math.sin(Math.PI * d)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
      px = Math.round(px); py = Math.round(py);
      dibujados.set(a.id, [px, py]);
      if (elegido === a.id) { const f2 = Math.floor(performance.now() / 300) % 2; g.fillStyle = '#ffd23a'; g.fillRect(px, py - 6 - f2, 3, 1); g.fillRect(px + 1, py - 5 - f2, 1, 1); g.strokeStyle = 'rgba(255,210,58,0.8)'; g.lineWidth = 0.6; g.strokeRect(px - 2.5, py - 2, 8, 8.5); }
      const anda = r && r.length >= 6 && (r[paso * 3] !== r[Math.min(r.length - 3, paso * 3 + 3)] || r[paso * 3 + 1] !== r[Math.min(r.length - 3, paso * 3 + 3) + 1]);
      const t = Math.floor(ahora / 150 + a.id) % 2;
      // En el agua (sin puente) no se camina: se nada, con la cabeza fuera y ondas alrededor.
      const tAhora = Math.floor((py + 4) / P) * v.tw + Math.floor((px + 1) / P), ta = tierra[tAhora];
      if ((ta === 'agua' || ta === 'bajo' || ta === 'rio') && !(visto.camino && visto.camino[tAhora])) {
        const brazo = Math.floor(ahora / 260 + a.id) % 2;
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
        const img = ARTE().vehiculo(a.veh, color[a.c] || '#cccccc', anda && t ? 1 : 0), EV = a.veh === 'tanque' ? 0.62 : 0.55;
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
      const alto = acc === 1 || acc === 2 ? (t ? -1 : 1) : 0;
      const img = ARTE().aldeano({
        col: color[a.c] || '#cccccc', oficio: nino ? 'nino' : oficio, edad: nino ? 'nino' : (a.edad || 0) >= V.VIEJO ? 'viejo' : 'adulto',
        paso: anda && t ? 1 : 0, alto, carga: acc === 3 ? (oficio === 'minero' ? 2 : oficio === 'granjero' ? 3 : 1) : 0,
        arma: oficio === 'guerrero' ? a.arma || 0 : 0, tirador: oficio === 'guerrero' && !!a.tirador, armadura: oficio === 'guerrero' ? a.armadura || 0 : 0,
        piel: (a.c + (a.id % 6 === 0 ? 1 : 0)) % 4, pelo: a.id % 4
      });
      // A media escala: el dibujo tiene detalle al acercarse, pero una persona mide un tercio de una casa.
      const ix = px - 1.5, iy = py - 1, EA = 0.5;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - 1, py + 5, 5, 1);
      if (oficio === 'comerciante' && !nino) {
        // La carreta va detrás del comerciante, según hacia dónde camina.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const cx = px - (dirX || (dirY ? 0 : 1)) * 6 - 1, cy = py + 1 - dirY * 5;
        g.fillStyle = '#2a1e14'; g.fillRect(cx - 0.5, cy + 0.5, 7, 4);
        g.fillStyle = '#3a2a1e'; g.fillRect(cx + 1, cy + 4, 1, 1); g.fillRect(cx + 4, cy + 4, 1, 1);
        g.fillStyle = '#9a6a3a'; g.fillRect(cx, cy + 1, 6, 3); g.fillStyle = '#7a5028'; g.fillRect(cx, cy + 3, 6, 0.5);
        g.fillStyle = '#e0c050'; g.fillRect(cx + 1, cy, 1.5, 1.5); g.fillStyle = '#c84a3a'; g.fillRect(cx + 2.5, cy, 1.5, 1.5); g.fillStyle = '#4a8ad0'; g.fillRect(cx + 4, cy, 1.5, 1.5);
      }
      g.drawImage(img, ix, iy, img.width * EA, img.height * EA);
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
      if (acc === 2 && !(a.tirador)) { const ch = Math.floor(ahora / 90 + a.id) % 4; g.fillStyle = ch % 2 ? '#fff6a0' : '#ffd23a'; g.fillRect(px + 4 + ch, py - 1 - (ch % 2), 1, 1); g.fillRect(px + 5, py + 1 + (ch % 3) - 1, 1, 1); if (ch === 0) { g.fillStyle = '#ffffff'; g.fillRect(px + 4, py, 2, 1); } }
      else if (acc === 2 && t) { g.fillStyle = '#ff4b3a'; g.fillRect(px + 4, py - 1, 1, 1); }
      if (recibe) {
        const [gp, d] = recibe;
        // Destello: rojo al recibir, luego un parpadeo blanco; y unas gotas de sangre que saltan y caen.
        g.globalAlpha = d < 0.45 ? 0.9 : d < 0.7 ? 0.65 : 0.35; g.drawImage(ARTE().tenido(img, d < 0.45 ? '#ff2a2a' : '#ffffff'), ix, iy, img.width * EA, img.height * EA); g.globalAlpha = 1;
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
      const sx = ox + wx * z, sy = oy + wy * z - (30 + 44 * t + (k - 1) * 24) * dpr;
      g.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      const ancho = g.measureText(a.texto).width + 16 * dpr;
      g.fillStyle = 'rgba(13,19,34,0.88)'; g.fillRect(sx - ancho / 2, sy - tam * 0.8, ancho, tam * 1.6);
      g.strokeStyle = a.color; g.lineWidth = 1 * dpr; g.strokeRect(sx - ancho / 2 + 0.5, sy - tam * 0.8 + 0.5, ancho - 1, tam * 1.6 - 1);
      g.fillStyle = a.color; g.fillText(a.texto, sx, sy);
    }
    g.globalAlpha = 1;
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
  function oscuridad(ahora) { if (reducido) return 0; const f = (ahora % DIA) / DIA; return Math.max(0, Math.min(1, (-Math.cos(f * Math.PI * 2) - 0.1) * 1.4)); }
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
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, ob = visto.obra[t]; if (ob === V.OBRA.casa || ob === V.OBRA.ayuntamiento || ob === V.OBRA.centro || ob === V.OBRA.templo) luces.push(t); if (luces.length > 400) break; }
    }
    const a = Math.min(1, (o - 0.3) / 0.4);
    for (const t of luces) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, parpadeo = ((t * 7 + Math.floor(ahora / 900)) % 11) === 0;
      if (parpadeo) continue;
      g.fillStyle = 'rgba(255,190,80,' + (0.16 * a).toFixed(3) + ')'; g.fillRect(x + 1, y + 7, 14, 8);
      g.fillStyle = 'rgba(255,220,120,' + (0.95 * a).toFixed(3) + ')'; g.fillRect(x + 4, y + 10, 2, 2); g.fillRect(x + 10, y + 10, 2, 2);
    }
  }

  // ---------- Edificios que se mueven: aspas de molino y banderas de torre ----------
  let especiales = [], especialesHasta = 0;
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
  function barcos(k, ahora, x0, y0, x1, y1) {
    const v = m.vida, paso = Math.min(V.TICKS - 1, Math.floor(k)), f = Math.min(1, k - paso);
    for (const b of v.barcos || []) {
      let px = b.x * P, py = b.y * P;
      if (b.r && b.r.length >= 4) { const i = paso * 2, j = Math.min(b.r.length - 2, i + 2); px = (b.r[i] + (b.r[j] - b.r[i]) * f) * P; py = (b.r[i + 1] + (b.r[j + 1] - b.r[i + 1]) * f) * P; }
      if (px < x0 - 10 || py < y0 - 10 || px > x1 + 10 || py > y1 + 10) continue;
      px = Math.round(px + 4); py = Math.round(py + 4 + Math.sin(ahora / 500 + b.id) * 0.8);
      const c = S.civ(m, b.c), color = c ? c.color : '#ccc';
      // Barcos del tamaño de una casa: se dibujan con píxeles de arte (2×2).
      const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(px - 4 + x * 2, py - 6 + y * 2, w * 2, h * 2); };
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px - 6, py + 12 + (Math.floor(ahora / 400 + b.id) % 2), 20, 1);
      if (b.tipo === 'pesca') {
        r(1, 6, 6, 2, '#6b4a2b'); r(2, 8, 4, 1, '#5a3a22'); r(1, 6, 6, 1, '#8a6a42');
        r(4, 1, 1, 5, '#3a2a1e'); r(5, 1, 2, 4, '#e8e0c8'); r(5, 2, 1, 1, color);
        r(2, 5, 1, 1, '#f0c8a0');
        if (Math.floor(ahora / 700 + b.id) % 3 === 0) { r(7, 5, 2, 1, '#c8d4dc'); r(8, 7, 1, 1, '#c8d4dc'); }
      } else {
        r(0, 7, 8, 2, '#5a3a22'); r(1, 9, 6, 1, '#3a2a1e'); r(0, 7, 8, 1, '#7a5232'); r(1, 8, 1, 1, '#2a1a10'); r(4, 8, 1, 1, '#2a1a10');
        r(3, 0, 1, 7, '#3a2a1e'); r(1, 1, 2, 5, '#f4ecd8'); r(4, 1, 3, 5, '#f4ecd8'); r(4, 3, 3, 1, color); r(1, 3, 2, 1, color);
        r(3, -1, 2, 1, color);
      }
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
  function humo(ahora, x0, y0, x1, y1) {
    if (reducido) return;
    if (ahora > chimeneasHasta) {
      chimeneasHasta = ahora + 1500; chimeneas = [];
      const v = m.vida, tx0 = Math.max(0, Math.floor(x0 / P)), ty0 = Math.max(0, Math.floor(y0 / P)), tx1 = Math.min(v.tw - 1, Math.ceil(x1 / P)), ty1 = Math.min(v.th - 1, Math.ceil(y1 / P));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if ((o === V.OBRA.casa || o === V.OBRA.ayuntamiento) && t % 5 === 0) chimeneas.push(t); if (chimeneas.length > 60) break; }
    }
    for (const t of chimeneas) {
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
    for (const b of v.animales || []) {
      let px = b.x * P + 6, py = b.y * P + 8;
      if (b.r && b.r.length >= 4) { const i = paso * 2, j = Math.min(b.r.length - 2, i + 2); px = (b.r[i] + (b.r[j] - b.r[i]) * f) * P + 6; py = (b.r[i + 1] + (b.r[j + 1] - b.r[i + 1]) * f) * P + 8; }
      if (px < x0 - 8 || py < y0 - 8 || px > x1 + 8 || py > y1 + 8) continue;
      // También los animales: retroceden y se ponen rojos al recibir un mordisco o una lanzada; el lobo embiste.
      const recibe = golpeActivo(ig.golpes.get(b.id), k), pega = golpeActivo(ig.ataques.get(b.id), k);
      if (recibe) { const [gp, d] = recibe, emp = Math.round(2.5 * (1 - d)); px += Math.sign(b.x - gp[2]) * emp; py -= d < 0.5 ? 1 : 0; }
      if (pega) { const [at, d] = pega, emb = Math.round(2.5 * Math.sin(Math.PI * d)); px += Math.sign(at[2]) * emb; py += Math.sign(at[3]) * emb; }
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

  // Bombarderos: cruzan desde su capital hasta el blanco (llegan en 1,6 pasos) y siguen de largo, con su sombra.
  function pintarAviones(k) {
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    for (const [x0, y0, x1, y1, paso, civ] of (m.vida.aviones || [])) {
      const f = (k - paso) / 1.6;
      if (f < 0 || f > 2.2) continue;
      const ax = x0 * P + 8, ay = y0 * P + 8, bx = x1 * P + 8, by = y1 * P + 8;
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, img = ARTE().avion(color[civ] || '#cccccc'), dir = bx >= ax ? 1 : -1;
      const ang = Math.atan2(by - ay, (bx - ax) || 0.01) - (dir < 0 ? Math.PI : 0);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 5, y + 14, 10, 2);
      g.save(); g.translate(x, y - 6); g.rotate(ang); if (dir < 0) g.scale(-1, 1);
      g.drawImage(img, -img.width * 0.4, -img.height * 0.4, img.width * 0.8, img.height * 0.8);
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
        else { const q = (f - 0.75) / 0.25, rr = 2 + q * 7; g.fillStyle = 'rgba(255,' + Math.round(220 - q * 120) + ',80,' + (1 - q * 0.6).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by, rr, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(90,80,70,' + (0.6 * q).toFixed(2) + ')'; g.beginPath(); g.arc(bx, by - 3 - q * 4, rr * 0.8, 0, Math.PI * 2); g.fill(); }
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
    tumbas = tumbas.filter(tb => ahora - tb.inicio < 9000);
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
      if ((tb.tipo === 'batalla' || tb.tipo === 'flecha' || tb.tipo === 'torre' || tb.tipo === 'lobo') && t < 900) {
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
      g.globalAlpha = t < 400 ? 1 : Math.max(0, 1 - (t - 400) / 8600);
      if (t < 400 && tb.tipo !== 'batalla' && tb.tipo !== 'flecha' && tb.tipo !== 'torre' && tb.tipo !== 'lobo') { g.fillStyle = '#ff4b3a'; g.fillRect(x - 1, y - 1, 6, 7); }
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
    });
    cv.addEventListener('pointermove', ev => {
      if (!punteros.has(ev.pointerId)) return;
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        const [c, d] = [...punteros.values()];
        const d1 = Math.hypot(c.x - d.x, c.y - d.y), rect = cv.getBoundingClientRect();
        if (d0 > 0) zoom(d1 / d0, (c.x + d.x) / 2 - rect.left, (c.y + d.y) / 2 - rect.top);
        return;
      }
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!arrastre) return;
      arrastre.movido = Math.max(arrastre.movido, Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y));
      cam.x = arrastre.cx - (ev.clientX - arrastre.x) / cam.z; cam.y = arrastre.cy - (ev.clientY - arrastre.y) / cam.z;
      limitar();
    });
    const soltar = ev => {
      const eraClic = arrastre && arrastre.movido < 6 && punteros.size === 1;
      punteros.delete(ev.pointerId);
      if (eraClic && ev.type === 'pointerup' && alClicar && m) {
        const rect = cv.getBoundingClientRect(), { w, h } = vista();
        const wx = cam.x + (ev.clientX - rect.left - w / 2) / cam.z, wy = cam.y + (ev.clientY - rect.top - h / 2) / cam.z;
        // ¿Has tocado a un aldeano? (el más cercano, si está a unos pocos píxeles de pantalla)
        let cerca = null, dmin = Math.max(5, 9 / cam.z);
        for (const [id, [x, y]] of dibujados) { const d = Math.hypot(x + 1.5 - wx, y + 2.5 - wy); if (d < dmin) { dmin = d; cerca = id; } }
        const R = V.SUB * P, rx = Math.floor(wx / R), ry = Math.floor(wy / R);
        if (cerca != null && alClicarAldeano) alClicarAldeano(cerca);
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

  function seleccionar(id) { sel = id; if (m) territorio(); }
  function elegirAldeano(id) { elegido = id; }
  function seguir(id) { siguiendo = id; elegido = id; if (id != null && cam.z < 2.5) cam.z = Math.min(4, Math.max(zMin(), 3)); }
  const siguiendoA = () => siguiendo;

  M.pintor = { P, anunciar, elegirAldeano, seguir, siguiendoA, iniciar, mundo, turno, refrescar, seleccionar, marcar, centrarEn, zoom, verTodo, efecto };
})(globalThis.RF = globalThis.RF || {});
