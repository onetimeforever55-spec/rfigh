/*
 * GÉNESIS · EL ARTE
 * Los dibujos del mundo a 16×16 píxeles por parcela (32×32 las plazas), hechos con código: suelos con textura,
 * flores y adornos, árboles de cada bioma, rocas, campos, caminos y los edificios de cada era con el tejado del
 * color de su pueblo. Todo lleva sombreado (luz arriba a la izquierda) y un contorno oscuro, como WorldBox.
 * Cada dibujo se hace una vez y se guarda.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO = RF.MUNDO || {};
  const T = 16;

  // ---------- Colores ----------
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => '#' + ((1 << 24) | (Math.max(0, Math.min(255, Math.round(r))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(b)))).toString(16).slice(1);
  const mezcla = (a, b, t) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t); };
  const oscuro = (c, t) => mezcla(c, '#000000', t);
  const claro = (c, t) => mezcla(c, '#ffffff', t);

  // ---------- Una hoja de píxeles (con contorno) que se convierte en lienzo ----------
  function hoja(w, h) {
    const d = new Array(w * h).fill(null);
    const H = {
      w, h, d,
      p(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h && c) d[y * w + x] = c; },
      g(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? d[y * w + x] : null; },
      r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) H.p(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c); },
      // Un disco sombreado: la luz viene de arriba a la izquierda.
      disco(cx, cy, r, c, sombra) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy > r * r) continue;
          if (!sombra) { H.p(x, y, c); continue; }
          const l = (dx + dy) / (r * 1.4);
          H.p(x, y, l < -0.45 ? claro(c, 0.28) : l < 0.05 ? c : l < 0.5 ? oscuro(c, 0.18) : oscuro(c, 0.34));
        }
      },
      // Contorno: cada hueco junto a un píxel pintado se pinta con ese color muy oscurecido.
      contorno(t, soloAbajo) {
        const nuevo = d.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (d[y * w + x]) continue;
          const vec = soloAbajo ? [[0, -1]] : [[0, -1], [0, 1], [-1, 0], [1, 0]];
          for (const [dx, dy] of vec) { const c = H.g(x + dx, y + dy); if (c && c !== 'S') { nuevo[y * w + x] = oscuro(c, t == null ? 0.62 : t); break; } }
        }
        for (let i = 0; i < d.length; i++) d[i] = nuevo[i];
      },
      espejo() { for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) { const a = d[y * w + x]; d[y * w + x] = d[y * w + w - 1 - x]; d[y * w + w - 1 - x] = a; } },
      lienzo() {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'), img = g.createImageData(w, h);
        for (let i = 0; i < d.length; i++) {
          const col = d[i];
          if (!col) continue;
          let a = 255, cc = col;
          if (col.length === 9) { a = parseInt(col.slice(7), 16); cc = col.slice(0, 7); }
          const [r, gg, b] = rgb(cc); img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
        }
        g.putImageData(img, 0, 0);
        return c;
      }
    };
    return H;
  }
  // Azar fijo a partir de una semilla (el mismo dibujo siempre).
  function azar(sem) { let s = (sem * 2654435761 + 1013904223) >>> 0; return () => { s = (Math.imul(s ^ (s >>> 13), 1274126177) + 0x9E3779B9) >>> 0; return s / 4294967296; }; }
  const cache = new Map();
  const guardado = (clave, hacer) => { if (!cache.has(clave)) cache.set(clave, hacer()); return cache.get(clave); };

  // ---------- Suelos ----------
  const SUELO = {
    llanura: ['#6aa84f', '#7dbb5a', '#579343'], bosque: ['#4c8a3e', '#5b9b49', '#3f7835'], colina: ['#93a35a', '#a8b46a', '#7d8c4c'],
    montana: ['#8a8790', '#a6a3ac', '#6c6a73'], desierto: ['#e0c88c', '#ecd8a0', '#c9ae74'], nieve: ['#eef3f7', '#ffffff', '#d2dce6'],
    arena: ['#e8d49c', '#f3e3b0', '#d4be84'], selva: ['#3a8a3a', '#4c9e46', '#2c752e'], sabana: ['#bdb35a', '#cdc56c', '#a69d4a'],
    pantano: ['#4f6e48', '#5f8055', '#405c3c'], taiga: ['#4c7457', '#5b8466', '#3f644a'], tundra: ['#9aa694', '#aeb8a8', '#87927f'],
    sakura: ['#7cb860', '#8cc870', '#6aa452'], agua: ['#1f4f8a', '#2a5f9c', '#1a4478'], bajo: ['#2f6eab', '#3e82c0', '#285f97'], rio: ['#3f8ad2', '#5aa0e2', '#357bc0']
  };
  const HIERBA = new Set(['llanura', 'bosque', 'colina', 'sabana', 'selva', 'taiga', 'pantano', 'sakura']);
  function suelo(tipo, v) {
    return guardado('s' + tipo + v, () => {
      const [base, cl, os] = SUELO[tipo] || SUELO.llanura, H = hoja(T, T), r = azar(tipo.length * 131 + v * 17 + 7);
      // Manchas suaves de dos tonos (bloques de 2×2) y motas sueltas: textura sin cuadrícula.
      for (let y = 0; y < T; y += 2) for (let x = 0; x < T; x += 2) { const q = r(); H.r(x, y, 2, 2, q < 0.18 ? os : q > 0.84 ? cl : base); }
      for (let k = 0; k < 14; k++) H.p(r() * T, r() * T, r() < 0.5 ? cl : os);
      if (HIERBA.has(tipo)) for (let k = 0; k < 7; k++) { const x = r() * T | 0, y = 1 + (r() * (T - 2) | 0); H.p(x, y, claro(cl, 0.15)); H.p(x, y + 1, os); }
      if (tipo === 'agua' || tipo === 'bajo') for (let k = 0; k < 3; k++) { const x = r() * 10 | 0, y = 2 + (r() * 12 | 0); H.r(x, y, 3 + (r() * 3 | 0), 1, claro(cl, 0.2)); }
      if (tipo === 'rio') for (let k = 0; k < 4; k++) { const x = r() * 12 | 0, y = r() * 16 | 0; H.r(x, y, 3, 1, claro(cl, 0.3)); }
      if (tipo === 'desierto' || tipo === 'arena') for (let k = 0; k < 2; k++) { const y = 3 + (r() * 10 | 0), x = r() * 8 | 0; H.r(x, y, 5, 1, os); H.r(x + 1, y - 1, 3, 1, cl); }
      if (tipo === 'pantano') { const x = 2 + (r() * 8 | 0), y = 3 + (r() * 8 | 0); H.r(x, y, 5, 3, '#3a6460'); H.r(x + 1, y + 1, 3, 1, '#5a8c88'); H.r(x + 4, y - 1, 1, 2, '#6a8a3a'); }
      if (tipo === 'tundra') for (let k = 0; k < 2; k++) { const x = r() * 12 | 0, y = r() * 13 | 0; H.r(x, y, 3, 2, '#e8eef2'); H.p(x + 3, y + 1, '#e8eef2'); }
      if (tipo === 'nieve') for (let k = 0; k < 4; k++) H.p(r() * T, r() * T, '#c4d0dc');
      if (tipo === 'montana') {
        // Roca suelta: peñascos redondeados con luz y sombra y alguna grieta en diagonal (sin rayas que se repitan).
        for (let k = 0; k < 3; k++) H.disco(2 + r() * 12, 2 + r() * 12, 1.4 + r() * 1.3, r() < 0.5 ? base : cl, true);
        for (let k = 0; k < 2; k++) { let x = r() * 14 | 0, y = r() * 12 | 0; for (let q = 0; q < 3; q++) { H.p(x, y, os); x += r() < 0.5 ? 1 : 0; y++; } }
      }
      return H.lienzo();
    });
  }

  // ---------- Picos de montaña: tamaño, sitio y nieve distintos en cada uno ----------
  function pico(v) {
    return guardado('pico' + v, () => {
      const H = hoja(T, T), r = azar(v * 53 + 11), alto = 9 + (r() * 5 | 0), cx = 5 + (r() * 6 | 0), base = 15, top = base - alto, nieve = 2 + (r() * 3 | 0);
      const ancho = 0.55 + r() * 0.25;
      for (let y = top; y <= base; y++) {
        const half = Math.round((y - top) * ancho + (y > top + 2 ? (r() < 0.3 ? 1 : 0) : 0));
        for (let x = cx - half; x <= cx + half; x++) {
          const luz = x < cx, cumbre = y < top + nieve + (luz ? 1 : 0);
          H.p(x, y, cumbre ? (luz ? '#f4f8fb' : '#d4dce6') : luz ? (x < cx - half + 2 ? '#c2c0c8' : '#a6a3ac') : (x > cx + half - 2 ? '#5c5a63' : '#77757e'));
        }
      }
      // Un segundo pico más bajo al lado, a veces.
      if (r() < 0.5) {
        const c2 = cx + (r() < 0.5 ? -4 : 4), t2 = top + 4 + (r() * 2 | 0);
        for (let y = t2; y <= base; y++) { const half = Math.round((y - t2) * 0.6); for (let x = c2 - half; x <= c2 + half; x++) if (!H.g(x, y)) H.p(x, y, x < c2 ? (y < t2 + 2 ? '#eef3f7' : '#9a98a2') : (y < t2 + 2 ? '#cfd6e0' : '#6c6a73')); }
      }
      H.contorno(0.45, true);
      return H.lienzo();
    });
  }

  // ---------- Flores y adornos sobre la hierba ----------
  const FLORES = ['#ffffff', '#ffd23a', '#ff5a5a', '#ff8ad0', '#7aa8ff', '#c08aff', '#ff9a3a'];
  function adorno(tipo, v) {
    return guardado('a' + tipo + v, () => {
      const H = hoja(T, T), r = azar(v * 97 + tipo.length * 13 + 5);
      if (tipo === 'sakura') {
        // Pétalos caídos de los cerezos: motas rosas y blancas por el suelo.
        for (let k = 0; k < 9; k++) H.p(1 + r() * 14, 1 + r() * 14, ['#ffc4dc', '#ff9ec4', '#fff0f6'][(r() * 3) | 0]);
        if (r() < 0.5) { const x = 3 + (r() * 10 | 0), y = 4 + (r() * 9 | 0); H.p(x, y, '#ff8ab8'); H.p(x - 1, y, '#ffb4d0'); H.p(x + 1, y, '#ffb4d0'); H.p(x, y - 1, '#ffb4d0'); H.p(x, y + 1, '#ffb4d0'); H.p(x, y, '#ffe066'); }
      } else if (tipo === 'llanura' || tipo === 'colina' || tipo === 'sabana' || (tipo === 'bosque' && v % 3 === 0)) {
        // Un ramillete: flores de cruz con el centro amarillo, o margaritas sueltas, y alguna hoja.
        const color = FLORES[(r() * FLORES.length) | 0], n = 2 + (r() * 3 | 0);
        for (let k = 0; k < n; k++) {
          const x = 2 + (r() * 12 | 0), y = 2 + (r() * 12 | 0);
          H.p(x, y + 1, '#3f7a30'); H.p(x - 1, y + 1, '#4f9a3a');
          if (r() < 0.6) { H.p(x, y - 1, color); H.p(x - 1, y, color); H.p(x + 1, y, color); H.p(x, y + 1, color); H.p(x, y, '#ffe066'); }
          else H.p(x, y, color);
        }
      } else if (tipo === 'bosque' || tipo === 'taiga') {
        // Setas: sombrero rojo con motas blancas, o pardas.
        const x = 3 + (r() * 9 | 0), y = 5 + (r() * 8 | 0), roja = r() < 0.6;
        H.r(x, y + 2, 1, 2, '#efe6d0'); H.r(x - 1, y, 3, 2, roja ? '#d8343a' : '#9a6a3a'); H.p(x - 2, y + 1, roja ? '#b02a2e' : '#7a5230'); H.p(x + 2, y + 1, roja ? '#b02a2e' : '#7a5230');
        if (roja) { H.p(x - 1, y, '#ffffff'); H.p(x + 1, y + 1, '#ffffff'); }
        if (r() < 0.5) { const x2 = x + 3, y2 = y + 2; H.p(x2, y2 + 1, '#efe6d0'); H.r(x2 - 1, y2, 3, 1, roja ? '#d8343a' : '#9a6a3a'); }
        H.contorno(0.5, true);
      } else if (tipo === 'selva') {
        // Helechos.
        const x = 4 + (r() * 8 | 0), y = 9 + (r() * 4 | 0);
        for (let k = -3; k <= 3; k++) { H.p(x + k, y - Math.abs(k) / 2, '#5ab84a'); H.p(x + k, y + 1 - Math.abs(k) / 2, '#2f7a2e'); }
        H.p(x, y - 2, '#7ad05a');
      } else if (tipo === 'desierto' || tipo === 'arena') {
        // Piedrecitas y, a veces, una hierba seca.
        for (let k = 0; k < 2; k++) { const x = 2 + (r() * 12 | 0), y = 3 + (r() * 11 | 0); H.r(x, y, 2, 1, '#a89878'); H.p(x, y - 1, '#c8b898'); }
        if (r() < 0.4) { const x = 3 + (r() * 10 | 0), y = 6 + (r() * 7 | 0); H.p(x, y, '#a08a40'); H.p(x - 1, y - 1, '#b8a050'); H.p(x + 1, y - 1, '#b8a050'); H.p(x, y - 2, '#c8b060'); }
      } else if (tipo === 'tundra' || tipo === 'nieve') {
        const x = 3 + (r() * 10 | 0), y = 6 + (r() * 7 | 0);
        H.p(x, y, '#8aa080'); H.p(x - 1, y - 1, '#a0b494'); H.p(x + 1, y - 1, '#a0b494'); H.p(x, y - 2, '#7a9070');
      } else if (tipo === 'pantano') {
        // Juncos con su espiga.
        const x = 3 + (r() * 10 | 0), y = 6 + (r() * 6 | 0);
        for (let k = 0; k < 3; k++) { H.r(x + k * 2, y - k % 2, 1, 5, '#5a8a3a'); H.r(x + k * 2, y - 2 - k % 2, 1, 2, '#7a4a2a'); }
      }
      return H.lienzo();
    });
  }

  // ---------- Árboles ----------
  // Un tronco de dos tonos.
  const tronco = (H, x, y, w, h, c) => { H.r(x, y, w, h, c || '#7a5232'); H.r(x + w - 1, y, 1, h, oscuro(c || '#7a5232', 0.3)); };
  function copa(H, discos, c) { for (const [cx, cy, r] of discos) H.disco(cx, cy, r, c, false); for (const [cx, cy, r] of discos) H.disco(cx, cy, r - 0.01, c, true); }
  function arbol(nombre, v) {
    return guardado('t' + nombre + v, () => {
      const H = hoja(T, T), r = azar(v * 31 + nombre.length);
      if (nombre === 'roble3') {
        tronco(H, 7, 10, 2, 6);
        H.p(6, 15, '#6a4628'); H.p(9, 15, '#5a3a22');
        const c = ['#3f8a3e', '#4a9640', '#3a8040', '#56a048', '#468c3a'][v];
        copa(H, [[8, 6.5, 5.6], [4.6, 8, 3.6], [11.4, 8, 3.6], [8, 3.6, 3.4]], c);
        // Variantes: con manzanas rojas o con flor blanca.
        if (v === 4) for (let k = 0; k < 4; k++) H.p(4 + r() * 8, 4 + r() * 6, '#e03a3a');
        if (v === 3) for (let k = 0; k < 5; k++) H.p(4 + r() * 8, 2 + r() * 7, '#fff0f4');
        for (let k = 0; k < 3; k++) H.p(5 + r() * 4, 3 + r() * 3, claro(c, 0.45));
      } else if (nombre === 'pino3' || nombre === 'nevado3') {
        tronco(H, 7, 12, 2, 4, '#6a4628');
        const c = v % 2 ? '#2e7a4a' : '#2a6e44', nieve = nombre === 'nevado3';
        // Tres pisos de ramas, cada uno más ancho; luz a la izquierda, sombra a la derecha.
        for (const [top, alto, ancho] of [[1, 5, 3], [4, 5, 5], [7, 6, 7]]) {
          for (let y = 0; y < alto; y++) {
            const half = Math.round((y + 1) / alto * ancho);
            for (let x = 8 - half; x < 8 + half; x++) H.p(x, top + y, x < 7 ? claro(c, 0.12) : x > 8 ? oscuro(c, 0.2) : c);
            if (nieve && y === 0) H.r(8 - half, top + y, half * 2, 1, '#f4f8fb');
            if (nieve && y === alto - 1) { H.p(8 - half, top + y, '#e8eef4'); H.p(8 - half + 1, top + y, '#e8eef4'); }
          }
        }
        if (nieve) H.p(8, 0, '#f4f8fb'); else H.p(7, 1, claro(c, 0.3));
      } else if (nombre === 'palmera') {
        // Tronco curvado con anillos, hojas que caen en arco y cocos.
        for (let y = 5; y < 16; y++) { const x = 8 + Math.round(Math.sin((y - 5) / 11 * 1.6) * 1.5); H.p(x, y, y % 2 ? '#a07a48' : '#8a6438'); H.p(x + 1, y, '#6a4a2a'); }
        const hojas = [[-6, 1], [-4, -2], [0, -4], [4, -2], [6, 1]];
        for (const [dx, dy] of hojas) for (let k = 0; k <= 6; k++) { const f = k / 6, x = 8 + dx * f, y = 5 + dy * f + (f * f) * 3; H.p(x, y, k < 3 ? '#3a9a3a' : '#2e8030'); H.p(x, y + 1, '#24682a'); }
        H.p(8, 6, '#6a4022'); H.p(10, 6, '#6a4022'); H.p(9, 7, '#5a3418');
      } else if (nombre === 'jungla3') {
        tronco(H, 6, 10, 3, 6, '#6a4a2a');
        const c = '#2a7a30';
        copa(H, [[8, 6, 6.5], [3.5, 8, 3.5], [12.5, 7.5, 3.5]], c);
        // Lianas que cuelgan.
        for (let k = 0; k < 3; k++) { const x = 3 + (r() * 10 | 0); for (let y = 9; y < 13 + (k % 2); y++) H.p(x, y, '#1e5a22'); }
        for (let k = 0; k < 2; k++) H.p(5 + r() * 6, 3 + r() * 4, '#ff7a3a');
      } else if (nombre === 'acacia') {
        // Tronco fino que se abre y una copa plana como un paraguas.
        H.r(8, 8, 1, 8, '#6a4a2a'); H.p(7, 7, '#6a4a2a'); H.p(6, 6, '#6a4a2a'); H.p(9, 7, '#6a4a2a'); H.p(10, 6, '#6a4a2a');
        for (let y = 2; y < 7; y++) { const half = y < 3 ? 4 : y < 6 ? 7 : 5; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, y < 3 ? '#a8b44a' : y < 5 ? '#8a9a38' : '#6e7c2c'); }
      } else if (nombre === 'sauce') {
        tronco(H, 7, 9, 2, 7, '#6a5032');
        copa(H, [[8, 6, 5.5]], '#5a8a42');
        // Ramas que caen como cortinas.
        for (let x = 3; x <= 13; x += 2) for (let y = 6; y < 13 - Math.abs(x - 8) / 2; y++) H.p(x, y, y % 3 ? '#4a7a36' : '#6a9a4a');
      } else if (nombre === 'matorral') {
        copa(H, [[8, 11, 4], [5, 12, 2.6], [11, 12, 2.6]], '#6f7d5a');
        if (v % 2) { H.p(7, 10, '#c03a5a'); H.p(10, 11, '#c03a5a'); }
      } else if (nombre === 'cactus') {
        // Saguaro con brazos y una raya clara.
        H.r(7, 3, 3, 13, '#4a9a3a'); H.r(7, 3, 1, 13, '#6ac04a'); H.r(9, 3, 1, 13, '#2e7a2e');
        H.r(3, 7, 2, 4, '#4a9a3a'); H.r(3, 10, 4, 2, '#4a9a3a'); H.p(3, 7, '#6ac04a');
        H.r(11, 5, 2, 4, '#4a9a3a'); H.r(10, 8, 3, 2, '#4a9a3a'); H.p(12, 5, '#6ac04a');
        if (v % 3 === 0) { H.p(8, 2, '#ff6ab0'); H.p(7, 2, '#ff9ad0'); }
      } else if (nombre === 'sakura') {
        // Cerezo en flor: tronco oscuro y retorcido, copa rosa en nubes, pétalos que caen.
        H.r(7, 10, 2, 6, '#5a3428'); H.p(6, 9, '#5a3428'); H.p(9, 8, '#5a3428'); H.p(10, 7, '#5a3428'); H.p(5, 8, '#5a3428'); H.r(8, 10, 1, 6, '#3e2218');
        const rosa = ['#f7a8c8', '#f4b6d2', '#f29abe', '#f8c0d8', '#ee90b8'][v];
        copa(H, [[8, 5.5, 4.6], [4.4, 7, 3.2], [11.6, 6.6, 3.4], [7, 2.8, 2.8]], rosa);
        for (let k = 0; k < 6; k++) H.p(3 + r() * 10, 2 + r() * 8, '#fff2f8');
        for (let k = 0; k < 3; k++) H.p(2 + r() * 12, 11 + r() * 4, '#ffc4dc');
      } else if (nombre === 'sakura2') {
        H.r(8, 11, 1, 5, '#5a3428'); H.p(7, 11, '#5a3428');
        copa(H, [[8, 8.5, 3.4], [6, 10, 2], [10.2, 9.6, 2]], '#f6aed0');
        H.p(7, 7, '#fff2f8'); H.p(9, 9, '#fff2f8');
      } else if (nombre === 'robles') {
        // Bosque denso: tres copas apretadas en una sola parcela.
        tronco(H, 3, 12, 2, 4); tronco(H, 11, 11, 2, 5); tronco(H, 7, 13, 2, 3);
        const c = ['#3f8a3e', '#4a9640', '#3a8040', '#468c3a', '#3c8238'][v];
        copa(H, [[4, 8, 3.6], [12, 7, 3.8]], oscuro(c, 0.08)); copa(H, [[8, 9.5, 4]], c);
        for (let k = 0; k < 3; k++) H.p(3 + r() * 10, 5 + r() * 5, claro(c, 0.4));
      } else if (nombre === 'pinos') {
        for (const [cx, base, alto] of [[4, 15, 10], [11, 15, 12], [8, 16, 9]]) {
          H.r(cx, base - 2, 1, 2, '#6a4628');
          for (let y = 0; y < alto; y++) { const half = Math.max(1, Math.round((y + 1) / alto * 3.4)); for (let x = cx - half + 1; x <= cx + half - 1; x++) H.p(x, base - 2 - alto + y, x < cx ? '#3a8a54' : x > cx ? '#225e3c' : '#2e7a4a'); }
        }
      } else if (nombre === 'junglas') {
        tronco(H, 3, 12, 2, 4, '#6a4a2a'); tronco(H, 11, 12, 2, 4, '#6a4a2a');
        copa(H, [[4, 7, 4.4], [12, 6.5, 4.2], [8, 9, 4.6], [8, 3.5, 3.4]], '#2a7a30');
        for (let k = 0; k < 4; k++) { const x = 2 + (r() * 12 | 0); for (let y = 11; y < 14; y++) H.p(x, y, '#1e5a22'); }
      } else if (nombre === 'arbol2') {
        tronco(H, 7, 11, 2, 5);
        copa(H, [[8, 8, 3.6], [6, 9.5, 2.2], [10, 9.5, 2.2]], '#4a9640');
      } else if (nombre === 'arbol1') {
        H.r(8, 12, 1, 4, '#6a4a2a');
        H.p(7, 11, '#5aa848'); H.p(9, 11, '#5aa848'); H.p(8, 10, '#6ab858'); H.p(6, 12, '#4a9640'); H.p(10, 12, '#4a9640');
      }
      H.contorno();
      if (r() < 0.5 && nombre !== 'arbol1') H.espejo();
      return H.lienzo();
    });
  }

  // ---------- Rocas (con vetas de hierro o de oro) ----------
  function roca(n, mena) {
    return guardado('r' + n + ':' + mena, () => {
      const H = hoja(T, T), c = '#8a8a96';
      if (n >= 3) { H.disco(6, 10, 4.6, c, true); H.disco(11, 11.5, 3.2, c, true); }
      else if (n === 2) { H.disco(8, 11, 4, c, true); }
      else H.disco(8, 12, 2.6, c, true);
      H.contorno();
      if (mena) { const col = mena === 3 ? '#1a1a1e' : mena === 2 ? '#ffd23a' : '#d0703a'; for (const [x, y] of mena === 3 ? [[4, 10], [5, 9], [6, 10], [7, 11], [6, 12], [8, 9], [9, 10], [10, 11], [11, 12], [8, 12], [12, 11], [10, 13]] : [[5, 9], [7, 11], [9, 10], [11, 12]]) if (H.g(x, y) && H.g(x, y) !== null) H.p(x, y, col); }
      return H.lienzo();
    });
  }

  // ---------- Campos de trigo ----------
  function campo(fase, v, tipo) {
    if (tipo && tipo !== 'trigo') return campoDe(tipo, fase, v);
    return guardado('c' + fase + v, () => {
      const H = hoja(T, T);
      H.r(0, 0, T, T, '#8a6a3c');
      for (let y = 1; y < T; y += 3) { H.r(0, y, T, 1, '#6e5230'); H.r(0, y + 1, T, 1, '#9a7a48'); }
      if (fase >= 1) for (let y = 1; y < T; y += 3) for (let x = (y + v) % 2; x < T; x += 2) {
        if (fase === 1) H.p(x, y, '#8fc35a');
        else if (fase === 2) { H.p(x, y, '#5f9e3a'); H.p(x, y - 1, '#7ab84a'); }
        else { H.p(x, y, '#c8a03a'); H.p(x, y - 1, '#e8c850'); H.p(x, y - 2, x % 4 ? '#f8e080' : '#e0b840'); }
      }
      H.r(0, T - 1, T, 1, '#5a4024');
      return H.lienzo();
    });
  }

  // Maíz (selva y sabana), arroz (pantanos y junto al agua) y viñas (colinas), cada uno con sus fases.
  function campoDe(tipo, fase, v) {
    return guardado('c' + tipo + fase + v, () => {
      const H = hoja(T, T);
      if (tipo === 'arroz') {
        // Bancales anegados: agua entre los caballones y matas verdes que se doran.
        H.r(0, 0, T, T, '#6a7a4a');
        for (let y = 1; y < T; y += 4) { H.r(0, y, T, 2, '#4a7a9a'); H.r(0, y, T, 1, '#6a9ab8'); H.r(0, y + 2, T, 1, '#7a6a3a'); }
        if (fase >= 1) for (let y = 0; y < T; y += 4) for (let x = (y / 4 + v) % 2; x < T; x += 2) { H.p(x, y + 1, fase === 3 ? '#c8c060' : fase === 2 ? '#5aa040' : '#8fd060'); if (fase >= 2) H.p(x, y, fase === 3 ? '#e0d070' : '#7ac050'); }
        H.r(0, T - 1, T, 1, '#4a5a30');
        return H.lienzo();
      }
      H.r(0, 0, T, T, '#8a6a3c');
      for (let y = 1; y < T; y += 3) { H.r(0, y, T, 1, '#6e5230'); H.r(0, y + 1, T, 1, '#9a7a48'); }
      if (tipo === 'maiz') {
        // Matas altas de maíz en hileras, con mazorcas amarillas y penachos al madurar.
        if (fase >= 1) for (let x = 1 + v % 2; x < T; x += 3) for (let y = 2; y < T; y += 5) {
          const alto = fase === 1 ? 1 : fase === 2 ? 3 : 4;
          for (let k = 0; k < alto; k++) H.p(x, y - k + 1, fase === 3 ? '#7a9a3a' : '#4a9a3a');
          if (fase >= 2) { H.p(x - 1, y, '#6ab84a'); H.p(x + 1, y - 1, '#6ab84a'); }
          if (fase === 3) { H.p(x + 1, y, '#f0c840'); H.p(x, y - alto + 1, '#c89a5a'); }
        }
      } else {
        // Viña: espalderas de estacas con sarmientos, hojas y racimos morados al final del verano.
        for (let y = 2; y < T; y += 4) { H.r(0, y + 1, T, 1, '#7a5530'); for (let x = 1; x < T; x += 5) H.r(x, y - 1, 1, 3, '#5a3a20'); }
        if (fase >= 1) for (let y = 2; y < T; y += 4) for (let x = (v + y) % 2; x < T; x += 2) {
          H.p(x, y, fase === 1 ? '#8fc35a' : '#4a8a3a'); if (fase >= 2) H.p(x, y - 1, '#5a9a3a');
          if (fase === 3 && x % 4 === 1) { H.p(x, y + 1, '#7a3a8a'); H.p(x + 1, y + 1, '#5a2a6a'); H.p(x, y + 2, '#6a2a7a'); }
        }
      }
      H.r(0, T - 1, T, 1, '#5a4024');
      return H.lienzo();
    });
  }

  // ---------- Edificios ----------
  const PARED = '#e8d8b4', MADERA = '#7a5232', PIEDRA = '#a8a49a', CRISTAL = '#4a6a9a', LUZ = '#ffe08a';
  // Un tejado a dos aguas: tejas en filas, la mitad izquierda iluminada.
  function tejado(H, x0, x1, top, base, col) {
    for (let y = top; y <= base; y++) {
      const inset = Math.round((base - y) * ((x1 - x0) / 2) / (base - top + 1) * 0.5);
      for (let x = x0 + inset; x <= x1 - inset; x++) {
        const izq = x < (x0 + x1) / 2;
        let c = izq ? claro(col, 0.08) : oscuro(col, 0.14);
        if ((y - top) % 2 === 1) c = oscuro(c, 0.12);
        H.p(x, y, c);
      }
    }
    for (let x = x0 + Math.round((x1 - x0) / 4); x <= x1 - Math.round((x1 - x0) / 4); x++) H.p(x, top, claro(col, 0.3));
  }
  function ventana(H, x, y, luz) { H.r(x, y, 2, 2, luz ? LUZ : CRISTAL); H.p(x, y, luz ? '#fff4c0' : '#7a9aca'); }
  function casa(estilo, col, v) {
    return guardado('h' + estilo + col + v, () => {
      const H = hoja(T, T);
      if (estilo === 'choza') {
        // Choza redonda de barro con techo de paja cónico (la paja, del color del pueblo).
        for (let y = 9; y < 15; y++) for (let x = 3; x < 13; x++) { const dx = (x + 0.5 - 8) / 5; if (dx * dx < 1) H.p(x, y, x < 7 ? '#c8a070' : x > 10 ? '#9a7448' : '#b08a5a'); }
        H.r(7, 11, 2, 4, '#4a3020');
        const paja = mezcla(col, '#d8b060', 0.45);
        for (let y = 2; y < 11; y++) { const half = Math.round((y - 1) * 0.72); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 === 0 ? oscuro(paja, 0.2) : x < 8 ? claro(paja, 0.1) : oscuro(paja, 0.08)); }
        H.p(7, 1, oscuro(paja, 0.3)); H.p(8, 1, oscuro(paja, 0.3));
      } else if (estilo === 'casa') {
        // Casa de madera y piedra con tejado de tejas, chimenea, puerta y ventana.
        H.r(2, 8, 12, 7, PARED); H.r(2, 8, 1, 7, MADERA); H.r(13, 8, 1, 7, MADERA); H.r(2, 14, 12, 1, oscuro(PARED, 0.2));
        H.r(7, 10, 2, 5, '#6a4024'); H.p(8, 12, '#d8b060');
        ventana(H, 4, 10, v % 2 === 0); ventana(H, 10, 10, v % 3 === 0);
        H.r(11, 2, 2, 4, '#8a8690'); H.r(11, 2, 2, 1, '#5a5860');
        tejado(H, 1, 14, 3, 8, col);
      } else if (estilo === 'entramado') {
        // Dos plantas de entramado de madera, ventanas en las dos, tejado alto.
        H.r(2, 6, 12, 9, '#f0e6d0');
        for (const x of [2, 7, 8, 13]) H.r(x, 6, 1, 9, '#5a3a22');
        H.r(2, 10, 12, 1, '#5a3a22'); H.r(2, 6, 12, 1, '#5a3a22');
        for (let k = 0; k < 4; k++) { H.p(3 + k, 7 + k * 0.75, '#5a3a22'); H.p(12 - k, 7 + k * 0.75, '#5a3a22'); }
        ventana(H, 4, 11, v % 2 === 0); ventana(H, 10, 11, false); ventana(H, 10, 7, v % 3 === 0);
        H.r(7, 12, 2, 3, '#6a4024');
        tejado(H, 1, 14, 0, 6, col);
      } else {
        // Bloque de pisos: hormigón, rejilla de ventanas (algunas encendidas) y una franja del color del pueblo.
        H.r(2, 2, 12, 13, '#b8bcc4'); H.r(2, 2, 1, 13, '#d4d8de'); H.r(13, 2, 1, 13, '#8a8e96');
        H.r(2, 1, 12, 2, col); H.r(2, 1, 12, 1, claro(col, 0.25));
        const r = azar(v + 3);
        for (let y = 4; y < 12; y += 3) for (let x = 4; x < 12; x += 3) ventana(H, x, y, r() < 0.3);
        H.r(7, 12, 2, 3, '#4a4e58');
      }
      H.contorno();
      return H.lienzo();
    });
  }
  function edificio(nombre, col, fase) {
    fase = fase || 0;
    return guardado('e' + nombre + col + fase, () => {
      const H = hoja(T, T);
      if (nombre === 'torre' && fase !== 1) return torreDeFase(H, fase, col);
      if (nombre === 'cuartel') return cuartel(H, fase, col);
      if (nombre === 'arqueria') return arqueria(H, fase, col);
      if (nombre === 'castillo') return castillo(H, fase, col);
      if (nombre === 'saber') return casaSaber(H, fase, col);
      if (nombre === 'pozo') return pozo(H, fase, col);
      if (nombre === 'granero') return granero(H, fase, col);
      if (nombre === 'fuente') return fuente(H, fase, col);
      if (nombre === 'parque') return parque(H, fase, col);
      if (nombre === 'palacio') return palacio(H, fase, col);
      if (nombre === 'central') return central(H, fase, col);
      if (nombre === 'banco') return banco(H, fase, col);
      if (nombre === 'campamento') return campamento(H, fase, col);
      if (nombre === 'fabrica') return fabrica(H, fase, col);
      if (nombre === 'estacion') return estacion(H, fase, col);
      if (nombre === 'hospital') return hospital(H, fase, col);
      if (nombre === 'aerodromo') return aerodromo(H, fase, col);
      if (nombre === 'aduana') return aduana(H, fase, col);
      if (nombre === 'petroleo') return pozoPetroleo(H, fase, col);
      if (nombre === 'mina') return mina(H, fase, col);
      if (nombre === 'templo' && fase === 4) return iglesia(H, col);
      if (nombre === 'templo' && fase !== 1) return temploDeFase(H, fase, col);
      if (nombre === 'molino' && fase !== 1) return molinoDeFase(H, fase, col);
      if (nombre === 'puerto' && fase !== 1) return puertoDeFase(H, fase, col);
      if (nombre === 'ayuntamiento' && fase !== 1) return ayuntamientoDeFase(H, fase, col);
      if (nombre === 'ayuntamiento') {
        H.r(1, 8, 14, 7, '#e0d0a8'); H.r(1, 14, 14, 1, '#a89a7a');
        for (const x of [2, 5, 10, 13]) H.r(x, 9, 1, 5, '#f4ecd8');
        H.r(7, 10, 2, 5, '#5a3a22'); ventana(H, 3, 10, true); ventana(H, 11, 10, true);
        tejado(H, 0, 15, 4, 8, col);
        H.r(7, 0, 2, 4, '#c8b890'); H.p(7, 1, '#e0b040'); H.p(8, 1, '#e0b040');
      } else if (nombre === 'torre') {
        // Torre de piedra almenada con aspillera y puerta.
        H.r(4, 3, 8, 12, PIEDRA); H.r(4, 3, 2, 12, claro(PIEDRA, 0.18)); H.r(10, 3, 2, 12, oscuro(PIEDRA, 0.2));
        for (let y = 5; y < 15; y += 3) for (let x = 4; x < 12; x += 4) H.r(x + (y % 2) * 2, y, 2, 1, oscuro(PIEDRA, 0.12));
        for (const x of [3, 6, 9, 12]) H.r(x, 1, 2, 2, PIEDRA);
        H.r(3, 3, 10, 1, oscuro(PIEDRA, 0.25));
        H.r(7, 6, 1, 3, '#2a2a30'); H.r(7, 12, 2, 3, '#4a3020');
        H.r(4, 14, 2, 1, '#5a8a3a');
      } else if (nombre === 'templo') {
        // Templo de columnas blancas con frontón del color del pueblo.
        H.r(1, 13, 14, 2, '#d8d0bc'); H.r(2, 12, 12, 1, '#e8e0cc');
        for (const x of [3, 6, 9, 12]) { H.r(x, 7, 2, 5, '#f4f0e4'); H.p(x + 1, 7, '#c8c0ac'); }
        H.r(2, 6, 12, 1, '#e8e0cc');
        for (let y = 2; y < 6; y++) { const half = Math.round((y - 1) * 1.8); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.1)); }
        H.p(7, 4, '#ffe08a'); H.p(8, 4, '#ffe08a');
      } else if (nombre === 'molino') {
        // El cuerpo del molino (las aspas giran aparte).
        for (let y = 5; y < 15; y++) { const half = 2 + Math.round((y - 5) * 0.3); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 7 ? '#f4ecd8' : x > 9 ? '#c8b898' : '#e8dcc0'); }
        H.r(7, 11, 2, 4, '#5a3a22'); ventana(H, 7, 7, false);
        for (let y = 1; y < 6; y++) { const half = Math.round(y * 0.8) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.15)); }
      } else if (nombre === 'puerto') {
        // Muelle de tablas sobre pilotes, con un barril y un rollo de cuerda.
        H.r(0, 5, 16, 6, '#9a6a3a');
        for (let x = 1; x < 16; x += 3) H.r(x, 5, 1, 6, '#7a5028');
        H.r(0, 5, 16, 1, '#b88a52');
        for (const x of [1, 7, 13]) H.r(x, 11, 2, 3, '#5a3a22');
        H.r(10, 2, 3, 4, '#8a5a2a'); H.r(10, 3, 3, 1, '#4a4a52'); H.r(3, 3, 3, 2, '#c8b07a'); H.p(4, 3, '#8a7040');
      } else if (nombre === 'ruina') {
        H.r(2, 8, 3, 6, PIEDRA); H.r(2, 6, 2, 2, PIEDRA); H.r(10, 9, 4, 5, PIEDRA); H.r(12, 7, 2, 2, PIEDRA);
        for (const [x, y] of [[6, 13], [7, 12], [8, 13], [5, 14], [9, 14]]) H.p(x, y, oscuro(PIEDRA, 0.15));
        H.r(3, 13, 2, 1, '#5a8a3a'); H.p(11, 8, '#5a8a3a'); H.p(12, 13, '#6a9a4a');
      }
      H.contorno();
      return H.lienzo();
    });
  }
  // Torres según la fase: empalizada de troncos (tribal), piedra (medieval), torre artillada (pólvora), búnker con ametralladora.
  // ---------- La casa del saber de cada época (donde estudian los eruditos) ----------
  function casaSaber(H, tipo, col) {
    if (tipo === 'chaman' || tipo === 0) {
      // Tienda de pieles del chamán, un tótem pintado y una hoguera con humo.
      for (let y = 4; y < 15; y++) { const half = Math.round((y - 3) * 0.55); for (let x = 6 - half; x <= 6 + half; x++) H.p(x, y, x < 6 ? '#c8a070' : '#a07a4a'); }
      for (let y = 4; y < 15; y += 3) H.p(6, y, '#6a4a2a'); H.r(5, 11, 2, 4, '#3a2416'); H.p(6, 3, '#6a4a2a'); H.p(5, 2, '#6a4a2a'); H.p(7, 2, '#6a4a2a');
      H.r(12, 3, 2, 12, '#8a5a32'); H.r(12, 3, 2, 2, col); H.r(11, 5, 4, 1, '#c83a2a'); H.r(12, 7, 2, 2, '#f0c040'); H.p(12, 7, '#1a1a1a'); H.p(13, 10, '#3a8ad0');
      H.r(9, 13, 3, 1, '#5a3a22'); H.p(10, 12, '#ff8a1e'); H.p(9, 12, '#ffd84a'); H.p(10, 11, '#ffd84a');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'filosofo') {
      // Academia: pórtico de columnas, escalones, un banco de piedra y rollos.
      H.r(1, 13, 14, 2, '#d8d0bc'); H.r(2, 12, 12, 1, '#e8e0cc');
      for (const x of [2, 5, 8, 11]) { H.r(x, 6, 2, 6, '#f4f0e4'); H.p(x, 6, '#c8c0ac'); }
      H.r(1, 4, 14, 2, '#e8e0cc'); H.r(1, 4, 14, 1, col); H.r(3, 2, 10, 2, '#e8e0cc');
      H.r(6, 9, 4, 1, '#efe2b8'); H.p(13, 11, '#efe2b8');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'monje') {
      // Monasterio: muros de piedra, tejado, campanario con su campana y una ventana de arco.
      H.r(1, 7, 10, 8, PIEDRA); H.r(1, 7, 1, 8, claro(PIEDRA, 0.15)); tejado(H, 0, 11, 3, 7, oscuro(col, 0.1));
      H.r(11, 2, 4, 13, oscuro(PIEDRA, 0.05)); H.r(11, 2, 4, 1, oscuro(col, 0.2)); H.r(12, 4, 2, 2, '#2a2a30'); H.p(12, 5, '#e0b040'); H.p(13, 5, '#e0b040');
      H.r(12, 0, 2, 2, oscuro(col, 0.2)); H.p(12, -1 + 1, '#e0c060');
      H.r(4, 10, 2, 3, '#2a2a30'); H.p(4, 9, '#2a2a30'); H.p(5, 9, '#2a2a30'); H.r(8, 11, 2, 4, '#4a3020');
      H.contorno(); return H.lienzo();
    }
    if (tipo === 'erudito') {
      // Universidad: fachada clara con cúpula, reloj y ventanales.
      H.r(1, 8, 14, 7, '#e8dcc4'); H.r(1, 14, 14, 1, '#b8a888');
      for (const x of [2, 5, 10, 13]) ventana(H, x, 10, true);
      H.r(7, 11, 2, 4, '#5a3a22');
      for (let y = 2; y < 8; y++) { const half = Math.round(Math.sqrt(Math.max(0, 9 - (y - 7) * (y - 7) * 0.25)) * 1.4); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.15) : oscuro(col, 0.12)); }
      H.r(7, 0, 2, 2, '#e0b040'); H.r(7, 5, 2, 2, '#f4f4f4'); H.p(8, 6, '#2a2a2a');
      H.contorno(); return H.lienzo();
    }
    // Laboratorio y observatorio: ladrillo, chimenea humeante y cúpula con telescopio.
    H.r(1, 7, 10, 8, '#a0503a'); for (let y = 8; y < 15; y += 2) for (let x = 1 + (y % 4 ? 0 : 1); x < 11; x += 3) H.p(x, y, '#8a3e2a');
    H.r(2, 9, 2, 2, LUZ); H.r(6, 9, 2, 2, LUZ); H.r(4, 12, 2, 3, '#3a2a2a'); H.r(2, 4, 2, 3, '#6a3a2a');
    H.r(10, 9, 5, 6, '#c8ccd4'); for (let y = 4; y < 9; y++) { const half = Math.round(Math.sqrt(Math.max(0, 6.25 - (y - 9) * (y - 9) * 0.25))); for (let x = 12 - half; x <= 12 + half; x++) H.p(x, y, '#e4e8ee'); }
    H.r(12, 2, 1, 4, '#3a3a44'); H.p(13, 2, '#3a3a44'); H.p(12, 6, col);
    H.contorno(); return H.lienzo();
  }
  /*
   * El adoquín de las plazas: piedras en anillos alrededor del centro de la plaza (dx, dy en píxeles de arte
   * desde el centro), con juntas oscuras y piedras de tres tonos. Lo usan la fuente y las parcelas de su
   * explanada, así el dibujo sigue sin cortes de una parcela a otra.
   */
  const LOSAS = [['#b8a888', '#a8987a', '#c4b494', '#8a7a5e'], ['#b4aea2', '#a29c90', '#c4beb2', '#7e786e'], ['#c8bca8', '#b8ac98', '#d6ccb8', '#8e8474'], ['#c4c4c0', '#b0b0ac', '#d4d4d0', '#8c8c88']];
  function piedraPlaza(dx, dy, fase) {
    const L = LOSAS[Math.max(0, Math.min(3, fase))], d = Math.sqrt(dx * dx + dy * dy);
    const anillo = Math.floor(d / 2.6), fr = d / 2.6 - anillo;
    if (anillo === 0) return L[2];
    const n = Math.max(6, anillo * 7), ang = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * n + (anillo % 2) * 0.5, seg = Math.floor(ang), fs = ang - seg;
    if (fr < 0.26 || fs < 0.13) return L[3];
    const h = ((anillo * 73856093) ^ (seg * 19349663)) >>> 0;
    return L[h % 3];
  }
  // ---------- Los edificios públicos (cada uno con su porqué en vida.js), de cada fase ----------
  function pozo(H, fase, col) {
    if (fase === 3) {
      // Depósito de agua sobre patas de hierro, con su escalera y un grifo abajo.
      for (const x of [3, 12]) H.r(x, 7, 1, 8, '#6a6a72'); H.r(5, 9, 1, 6, '#5a5a62'); H.r(10, 9, 1, 6, '#5a5a62');
      for (let y = 8; y < 15; y += 2) H.r(3, y, 10, 1, '#7a7a82');
      H.r(2, 1, 12, 6, '#b8c4cc'); H.r(2, 1, 12, 1, '#dce4ea'); H.r(2, 6, 12, 1, '#8a949c'); H.r(5, 3, 6, 2, col);
      H.r(7, 13, 2, 2, '#3a7ac8'); H.contorno(); return H.lienzo();
    }
    // Brocal de piedra, cubo y (desde la Edad Media) un tejadillo con su torno.
    H.r(3, 10, 10, 5, PIEDRA); H.r(3, 10, 10, 1, claro(PIEDRA, 0.2)); for (let x = 4; x < 13; x += 3) H.p(x, 12, oscuro(PIEDRA, 0.15)); H.r(4, 10, 8, 1, '#2a5a9a'); H.p(6, 10, '#6aa0e0');
    if (fase === 0) { H.r(2, 6, 1, 5, MADERA); H.r(13, 6, 1, 5, MADERA); H.r(2, 6, 12, 1, MADERA); H.r(8, 7, 1, 3, '#c8b494'); H.r(7, 9, 3, 2, '#8a5a32'); }
    else { H.r(3, 4, 1, 7, MADERA); H.r(12, 4, 1, 7, MADERA); tejado(H, 1, 14, 1, 4, fase === 2 ? oscuro(col, 0.1) : '#a0603a'); H.r(4, 6, 8, 1, '#5a3a20'); H.r(8, 7, 1, 2, '#c8b494'); H.r(7, 8, 3, 2, '#6a6a72'); H.p(13, 6, '#5a3a20'); }
    H.p(14, 14, '#4a8a3a'); H.p(1, 14, '#5a9a4a');
    H.contorno(); return H.lienzo();
  }
  function granero(H, fase, col) {
    if (fase === 0) {
      // Silo de barro sobre pilotes, con su techo de paja y una escalera.
      for (const x of [4, 7, 10]) H.r(x, 12, 1, 3, MADERA);
      H.r(3, 6, 9, 6, '#b8905a'); H.r(3, 6, 1, 6, '#d0a870'); H.r(6, 8, 2, 2, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8); tejado(H, 2, 12, 2, 6, paja);
      for (let y = 8; y < 15; y += 2) H.p(13, y, MADERA); H.r(12, 7, 1, 8, '#6a4a2a'); H.r(14, 7, 1, 8, '#6a4a2a');
      H.contorno(); return H.lienzo();
    }
    if (fase === 3) {
      // Silos de metal y una nave.
      for (const x of [2, 7]) { H.r(x, 3, 5, 12, '#c8ccd4'); H.r(x, 3, 1, 12, '#e4e8ee'); H.r(x + 4, 3, 1, 12, '#9aa0aa'); for (let y = 5; y < 15; y += 3) H.r(x, y, 5, 1, '#aab0ba'); H.r(x, 2, 5, 1, '#9aa0aa'); H.p(x + 2, 1, '#9aa0aa'); }
      H.r(12, 8, 3, 7, col); H.r(12, 8, 3, 1, claro(col, 0.25)); H.contorno(); return H.lienzo();
    }
    // Granero de tablones (medieval) o de piedra (pólvora), con portón de cruz y gavillas.
    const pared = fase === 2 ? PIEDRA : '#a0603a';
    H.r(2, 7, 12, 8, pared); H.r(2, 7, 1, 8, claro(pared, 0.15)); H.r(13, 7, 1, 8, oscuro(pared, 0.2));
    if (fase !== 2) for (let x = 4; x < 13; x += 3) H.r(x, 8, 1, 7, oscuro(pared, 0.15));
    tejado(H, 1, 14, 2, 7, fase === 2 ? oscuro(col, 0.1) : '#6a4a32');
    H.r(6, 10, 4, 5, '#5a3a20'); for (let k = 0; k < 4; k++) { H.p(6 + k, 10 + k, '#e8d8b4'); H.p(9 - k, 10 + k, '#e8d8b4'); }
    H.r(7, 4, 2, 2, '#2a2a30'); H.p(1, 13, '#e0c060'); H.p(1, 14, '#c8a040'); H.p(14, 14, '#e0c060');
    H.contorno(); return H.lienzo();
  }
  function fuente(H, fase, col) {
    // Plaza pública: adoquín en anillos alrededor de una fuente (pilón de piedra, taza con surtidor, estatua
    // con surtidor; en la era moderna, una fuente de hormigón con chorros). Bancos y macetas con flores.
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) H.p(x, y, piedraPlaza(x - 7.5, y - 7.5, fase));
    const borde = fase === 3 ? '#e4e4e0' : fase === 0 ? '#9a8e76' : '#d8d0bc';
    H.disco(7.5, 8, 5.4, oscuro(borde, 0.25)); H.disco(7.5, 7.6, 5, borde, true); H.disco(7.5, 7.8, 3.9, '#2a6ab0'); H.disco(6.8, 7.1, 1.7, '#5a9ae0');
    H.p(9, 9, '#8ac4f4'); H.p(5, 8, '#8ac4f4');
    if (fase === 0) { H.r(7, 6, 2, 3, '#8a867c'); H.p(7, 5, '#bcd8f0'); }
    else if (fase === 3) { H.r(6, 6, 4, 3, '#d8d8d4'); H.p(7, 3, '#e8f4ff'); H.p(8, 2, '#ffffff'); H.p(6, 4, '#bcd8f0'); H.p(9, 4, '#bcd8f0'); H.p(5, 5, '#bcd8f0'); H.p(10, 5, '#bcd8f0'); }
    else {
      H.r(7, 5, 2, 4, '#e0d8c8'); H.r(6, 5, 4, 1, '#f0ece0'); H.p(7, 4, '#c8c0b0');
      if (fase === 2) { H.r(7, 1, 2, 3, '#b8a060'); H.p(7, 1, '#d8c080'); }
      H.p(7, 2 + (fase === 2 ? -1 : 1), '#ffffff'); H.p(6, 3, '#bcd8f0'); H.p(9, 3, '#bcd8f0'); H.p(5, 4, '#bcd8f0'); H.p(10, 4, '#bcd8f0');
    }
    // Macetas con flores en las esquinas y un banco.
    for (const [x, y] of [[0, 0], [14, 0]]) { H.r(x, y + 1, 2, 1, '#a0583a'); H.p(x, y, '#ff5a7a'); H.p(x + 1, y, '#ffd84a'); }
    H.r(1, 14, 4, 1, MADERA); H.p(1, 15, oscuro(MADERA, 0.25)); H.p(4, 15, oscuro(MADERA, 0.25));
    H.r(11, 14, 4, 1, MADERA); H.p(11, 15, oscuro(MADERA, 0.25)); H.p(14, 15, oscuro(MADERA, 0.25));
    H.p(15, 15, col);
    return H.lienzo();
  }
  // El campamento de los colonos: dos tiendas (de pieles al principio, de lona con el color del pueblo después),
  // la hoguera con sus piedras, un montón de leña y el banderín. En la era industrial y moderna, carros y casetas.
  function campamento(H, fase, col) {
    const lona = fase === 0 ? '#c8a070' : mezcla(col, '#e8e0cc', 0.55), sombra = oscuro(lona, 0.25);
    for (const [x0, y0, w] of [[1, 3, 6], [8, 6, 6]]) {
      for (let y = 0; y < w; y++) { const half = Math.round(y * 0.6); for (let x = -half; x <= half; x++) H.p(x0 + 3 + x, y0 + y, x < 0 ? lona : sombra); }
      H.p(x0 + 3, y0 - 1, MADERA); H.r(x0 + 3, y0 + w - 3, 1, 3, '#2a1a10');
    }
    H.disco(5, 12.5, 2, '#7a7a74'); H.p(5, 12, '#ff8a1e'); H.p(4, 12, '#ffd84a'); H.p(5, 11, '#ffd84a'); H.p(6, 12, '#ff5a1e');
    H.r(10, 13, 4, 1, '#7a4a24'); H.r(11, 12, 3, 1, '#8a5a2a'); H.p(10, 13, '#c89a62'); H.p(11, 12, '#c89a62');
    H.r(14, 1, 1, 6, MADERA); H.r(15, 1, 1, 2, col);
    if (fase >= 2) { H.r(0, 13, 3, 2, '#7a5530'); H.p(0, 15, '#2a2a2a'); H.p(2, 15, '#2a2a2a'); }
    H.contorno(); return H.lienzo();
  }
  // El banco (Renacimiento en adelante): fachada de piedra con columnas, frontón, escalinata y la moneda dorada.
  function banco(H, fase, col) {
    const muro = fase >= 3 ? '#e4e4de' : '#e0d4b8';
    H.r(1, 6, 14, 9, muro); H.r(1, 14, 14, 1, oscuro(muro, 0.25)); H.r(0, 15, 16, 1, oscuro(muro, 0.35));
    for (let y = 1; y < 6; y++) H.r(8 - y * 1.4, y, Math.round(y * 2.8), 1, y === 5 ? oscuro(muro, 0.15) : muro);
    H.p(8, 1, oscuro(col, 0.1)); H.r(7, 3, 2, 2, '#e0b040'); H.p(7, 3, '#fff0a0');
    for (const x of [2, 5, 10, 13]) { H.r(x, 7, 1, 7, '#fafaf2'); H.p(x, 7, oscuro(muro, 0.1)); }
    H.r(7, 9, 2, 5, '#4a3020'); H.r(7, 8, 2, 1, '#e0b040');
    H.p(3, 10, CRISTAL); H.p(4, 10, CRISTAL); H.p(11, 10, CRISTAL); H.p(12, 10, CRISTAL);
    H.contorno(); return H.lienzo();
  }
  // La fábrica (Revolución Industrial): nave de ladrillo con tejado de dientes de sierra, ventanales y una chimenea alta.
  function fabrica(H, fase, col) {
    const lad = fase >= 3 ? '#8a8e96' : '#a0503a', jun = oscuro(lad, 0.15);
    H.r(0, 8, 13, 7, lad); for (let y = 9; y < 15; y += 2) for (let x = (y % 4 ? 0 : 1); x < 13; x += 3) H.p(x, y, jun);
    for (const x0 of [0, 4, 8]) for (let k = 0; k < 4; k++) { H.r(x0 + k, 7 - k, 1, k + 1, k === 3 ? '#a8c0d0' : oscuro(lad, 0.25)); }
    for (const x of [1, 5, 9]) H.r(x, 10, 2, 2, LUZ);
    H.r(13, 1, 3, 14, '#7a3a2a'); H.r(13, 1, 3, 1, '#3a2a2a'); for (let y = 3; y < 15; y += 3) H.r(13, y, 3, 1, '#5a2a1e');
    H.r(4, 12, 3, 3, '#3a2a2a'); H.p(12, 14, col);
    H.contorno(); return H.lienzo();
  }
  // La estación de tren: edificio con reloj, marquesina sobre el andén y las vías delante.
  function estacion(H, fase, col) {
    const muro = fase >= 3 ? '#d8d4cc' : '#c8a878';
    H.r(2, 3, 12, 7, muro); tejado(H, 1, 14, 0, 3, oscuro(col, 0.2)); H.r(6, 0, 4, 1, oscuro(col, 0.3));
    H.disco(8, 5, 1.8, '#f4f4ec'); H.p(8, 5, '#2a2a2a'); H.p(8, 4, '#2a2a2a');
    for (const x of [3, 11]) H.r(x, 6, 2, 3, CRISTAL);
    H.r(0, 9, 16, 1, '#5a5e66'); for (const x of [1, 7, 14]) H.r(x, 10, 1, 2, '#5a5e66'); H.r(0, 10, 16, 2, null);
    H.r(0, 12, 16, 1, '#c8c4ba');
    for (let x = 0; x < 16; x += 2) H.r(x, 13, 1, 3, '#7a5530'); H.r(0, 13, 16, 1, '#8a8e96'); H.r(0, 15, 16, 1, '#8a8e96');
    H.contorno(); return H.lienzo();
  }
  // El hospital: edificio blanco de varias plantas con la cruz roja, ventanas y una ambulancia (o un carro) en la puerta.
  function hospital(H, fase, col) {
    H.r(1, 3, 14, 12, '#f0f0ec'); H.r(1, 3, 14, 1, '#d8d8d4'); H.r(14, 4, 1, 11, '#c8c8c4');
    for (const y of [5, 8]) for (const x of [2, 5, 10, 13]) H.r(x, y, 1, 2, CRISTAL);
    H.r(7, 4, 2, 6, '#e03a3a'); H.r(5, 6, 6, 2, '#e03a3a');
    H.r(6, 11, 4, 4, '#a8c8d8'); H.r(7, 11, 2, 4, '#88a8b8');
    if (fase >= 3) { H.r(11, 12, 4, 3, '#f8f8f4'); H.p(12, 12, '#e03a3a'); H.p(11, 15, '#2a2a2a'); H.p(14, 15, '#2a2a2a'); }
    H.p(1, 2, col);
    H.contorno(); return H.lienzo();
  }
  // El puesto fronterizo: garita con tejadillo y ventanuco, la barrera a franjas rojas y blancas cruzando la
  // carretera y la bandera del reino; en la era moderna, de hormigón con sacos terreros.
  function aduana(H, fase, col) {
    const muro = fase >= 3 ? '#b8b4ac' : '#a87a4a', tejado = fase >= 3 ? '#6a6e74' : '#7a3a2a';
    H.r(2, 6, 6, 8, muro); H.r(1, 5, 8, 1, tejado); H.r(2, 4, 6, 1, tejado); H.r(7, 7, 1, 7, oscuro(muro, 0.2));
    H.r(3, 7, 3, 2, CRISTAL); H.r(4, 11, 2, 3, '#4a3a2a');
    for (let x = 8; x < 16; x++) H.p(x, 10, ((x >> 1) % 2) ? '#f4f0e8' : '#d83a32');
    H.r(8, 9, 1, 5, '#4a4a4a'); H.r(15, 11, 1, 3, '#4a4a4a');
    H.r(1, 0, 1, 5, '#5a5a5a'); H.r(2, 0, 3, 2, col);
    if (fase >= 3) { H.r(9, 13, 3, 2, '#c8b078'); H.r(10, 12, 2, 1, '#b8a068'); }
    H.contorno(); return H.lienzo();
  }
  // La mina: la boca de la galería en la ladera, con su marco de vigas (o de hierro en la era industrial),
  // los raíles de las vagonetas, una vagoneta con mineral y el montón de escombro.
  function mina(H, fase, col) {
    H.r(0, 4, 16, 12, '#8a8478'); H.r(0, 4, 16, 1, '#a8a294'); for (let k = 0; k < 9; k++) H.p((k * 7) % 16, 5 + (k * 5) % 9, '#6a6458');
    H.r(4, 6, 8, 8, '#1a1612'); H.r(5, 7, 6, 7, '#0e0c0a');
    const viga = fase >= 2 ? '#5a5e66' : '#6a4a2a';
    H.r(3, 6, 1, 9, viga); H.r(12, 6, 1, 9, viga); H.r(3, 5, 10, 1, viga); H.p(8, 4, col); H.r(8, 2, 1, 2, '#3a3a3a'); H.r(9, 2, 2, 1, col);
    H.r(5, 14, 6, 1, '#7a7e86'); H.r(5, 15, 6, 1, '#5a3c22');
    H.r(9, 11, 4, 3, '#4a4e56'); H.r(9, 11, 4, 1, '#6a6e76'); H.p(10, 10, '#d0703a'); H.p(11, 10, fase >= 2 ? '#1a1a1e' : '#a3a1aa'); H.p(12, 10, '#ffd23a');
    H.p(9, 14, '#1e1e22'); H.p(12, 14, '#1e1e22');
    H.r(13, 12, 3, 3, '#7a7468'); H.p(14, 11, '#8a8478');
    if (fase >= 1) { H.p(2, 7, '#ffe08a'); H.p(2, 8, '#c8a050'); }
    H.contorno(); return H.lienzo();
  }
  // El pozo de petróleo: el balancín de hierro (la cabeza de caballo) sobre su torre, el tanque de crudo y
  // la mancha negra del suelo.
  function pozoPetroleo(H, fase, col) {
    H.r(1, 13, 14, 2, '#2a2420'); H.r(3, 12, 8, 1, '#3a302a');
    H.r(4, 7, 1, 6, '#5a5e66'); H.r(8, 7, 1, 6, '#5a5e66'); H.r(5, 9, 3, 1, '#4a4e56'); H.r(6, 6, 1, 1, '#6a6e76');
    H.r(1, 5, 11, 1, '#3a3e46'); H.r(1, 4, 2, 4, '#3a3e46'); H.r(2, 8, 1, 4, '#5a5e66');
    H.r(10, 5, 2, 3, '#c8402a'); H.r(11, 8, 1, 4, '#5a5e66');
    H.r(12, 8, 3, 5, '#a8acb4'); H.r(12, 8, 3, 1, '#c8ccd4'); H.p(13, 10, col);
    H.contorno(); return H.lienzo();
  }
  // El aeródromo: pista de hormigón con marcas, un hangar de chapa abovedado, un avión y la manga de viento.
  function aerodromo(H, fase, col) {
    H.r(0, 9, 16, 7, '#6a6e74'); for (let x = 1; x < 16; x += 4) H.r(x, 12, 2, 1, '#f0f0e8');
    for (let y = 2; y < 9; y++) { const w = Math.round(Math.sqrt(Math.max(0, 36 - (y - 8) * (y - 8))) ); H.r(7 - w, y, w * 2, 1, y % 2 ? '#9aa4ae' : '#8a949e'); }
    H.r(5, 6, 4, 3, '#2a2e34');
    H.r(10, 13, 5, 1, '#5a6a4a'); H.r(12, 11, 1, 4, '#5a6a4a'); H.r(11, 14, 3, 1, '#5a6a4a'); H.p(15, 13, col);
    H.r(14, 2, 1, 7, '#c8c8c8'); H.r(15, 2, 1, 2, '#ff7a30'); H.p(15, 4, '#ffffff');
    H.contorno(); return H.lienzo();
  }
  // La central eléctrica (Era Moderna, solo en ciudades): nave de ladrillo con ventanales, dos chimeneas
  // altas a franjas, el transformador y un poste de alta tensión.
  function central(H, fase, col) {
    H.r(1, 7, 10, 8, '#9a4a36'); for (let y = 8; y < 15; y += 2) for (let x = 1 + (y % 4 ? 0 : 1); x < 11; x += 3) H.p(x, y, '#843c2a');
    H.r(1, 6, 10, 1, '#6a3022'); for (const x of [2, 5, 8]) { H.r(x, 9, 2, 3, '#e8e0a0'); H.p(x, 9, '#fff4c0'); H.p(x + 1, 11, '#c8b070'); }
    for (const [x, h] of [[3, 7], [7, 9]]) { H.r(x, 6 - h, 2, h, '#c8c4bc'); for (let y = 6 - h; y < 6; y += 3) H.r(x, y, 2, 1, '#c84a3a'); H.r(x - 0, 5 - h, 2, 1, '#5a5a5a'); }
    H.r(11, 10, 4, 5, '#7a7e86'); H.r(11, 10, 4, 1, '#9aa0aa'); for (let x = 11; x < 15; x += 2) H.r(x, 11, 1, 3, '#5a5e66'); H.p(13, 12, '#f0d040');
    H.r(13, 1, 1, 9, '#5a5e66'); H.r(11, 2, 5, 1, '#5a5e66'); H.p(11, 3, '#c8ccd4'); H.p(15, 3, '#c8ccd4'); H.r(12, 4, 3, 1, '#5a5e66');
    H.p(14, 9, col);
    H.contorno(); return H.lienzo();
  }
  function parque(H, fase, col) {
    // Parque: césped, un sendero de tierra, árboles redondos, flores de colores, un banco y un estanque.
    H.r(0, 0, 16, 16, '#5aa040'); for (let k = 0; k < 18; k++) H.p((k * 7) % 16, (k * 11) % 16, '#6ab450');
    for (let k = 0; k < 16; k++) { const y = Math.round(8 + Math.sin(k / 2.4) * 2); H.r(k, y, 1, 2, fase === 3 ? '#d4d0c8' : '#c8a878'); }
    H.disco(12, 12.5, 2.6, '#3a7ac8'); H.p(11, 12, '#7ab4ec');
    for (const [x, y, r] of [[3.5, 3.5, 3], [12, 3, 2.6], [3, 13, 2.2]]) { H.r(Math.round(x) - 1, Math.round(y) + 1, 1, 3, '#6a4a2a'); H.disco(x, y, r, '#3a8a30', true); }
    for (const [x, y, c] of [[7, 4, '#ff5a7a'], [8, 5, '#ffd84a'], [6, 5, '#ffffff'], [9, 3, '#c86ae8'], [7, 13, '#ff8a3a'], [8, 14, '#ffd84a']]) H.p(x, y, c);
    H.r(8, 11, 3, 1, MADERA); H.p(8, 12, oscuro(MADERA, 0.2)); H.p(10, 12, oscuro(MADERA, 0.2));
    if (fase >= 2) { H.r(14, 6, 1, 4, '#3a3a40'); H.p(14, 5, LUZ); }
    H.p(15, 0, col);
    return H.lienzo();
  }
  function palacio(H, fase, col) {
    if (fase === 0) {
      // Gran casa del jefe: tronco tallado, techo alto de paja, pieles y estandarte.
      H.r(1, 8, 14, 7, '#9a6a3a'); for (let x = 1; x < 15; x += 2) H.r(x, 8, 1, 7, '#8a5a2a');
      tejado(H, 0, 15, 2, 8, mezcla(col, '#d8b060', 0.7)); H.r(6, 10, 4, 5, '#3a2416'); H.r(7, 9, 2, 1, col);
      H.r(14, 0, 1, 8, MADERA); H.r(12, 0, 2, 3, col); H.p(2, 12, '#e8d8b4'); H.p(13, 12, '#e8d8b4');
      H.contorno(); return H.lienzo();
    }
    if (fase === 3) {
      // Palacio de gobierno moderno: fachada blanca, columnata, cúpula de cristal y banderas.
      H.r(0, 7, 16, 8, '#ecece6'); H.r(0, 14, 16, 1, '#b8b8b2'); for (let x = 1; x < 16; x += 2) H.r(x, 9, 1, 5, '#fafaf6');
      H.r(4, 5, 8, 2, '#dcdcd6'); for (let y = 1; y < 5; y++) { const half = Math.round(Math.sqrt(16 - (y - 5) * (y - 5)) ); H.r(8 - half, y, half * 2, 1, y < 3 ? '#a8c8e8' : '#88a8c8'); }
      H.r(7, 11, 2, 4, '#3a3a40'); H.r(0, 1, 1, 6, '#5a5a62'); H.r(1, 1, 3, 2, col); H.r(15, 1, 1, 6, '#5a5a62'); H.r(12, 1, 3, 2, col);
      H.contorno(); return H.lienzo();
    }
    // Palacio de piedra: cuerpo central con frontón, dos alas con torrecillas, escalinata y estandartes.
    const muro = fase === 2 ? '#e4d8bc' : PIEDRA;
    H.r(0, 7, 16, 8, muro); H.r(0, 7, 16, 1, claro(muro, 0.15)); H.r(0, 14, 16, 1, oscuro(muro, 0.2));
    H.r(0, 3, 3, 5, muro); H.r(13, 3, 3, 5, muro); tejado(H, 0, 2, 0, 3, oscuro(col, 0.1)); tejado(H, 13, 15, 0, 3, oscuro(col, 0.1));
    tejado(H, 3, 12, 3, 7, col);
    for (const x of [1, 4, 10, 13]) ventana(H, x, 9, fase === 2);
    H.r(6, 9, 4, 6, '#4a3020'); H.r(6, 9, 4, 1, '#e0b040'); H.r(5, 14, 6, 1, '#d8d0bc');
    H.r(7, 1, 2, 3, '#e0b040'); H.p(7, 0, col); H.p(8, 0, col);
    H.contorno(); return H.lienzo();
  }
  // Iglesia románica de la Edad Media: nave de piedra, ábside, campanario cuadrado y una cruz.
  function iglesia(H, col) {
    H.r(1, 8, 10, 7, PIEDRA); H.r(1, 8, 1, 7, claro(PIEDRA, 0.15)); tejado(H, 0, 11, 4, 8, oscuro(col, 0.25));
    H.r(11, 3, 4, 12, oscuro(PIEDRA, 0.04)); H.r(14, 3, 1, 12, oscuro(PIEDRA, 0.2)); H.r(11, 2, 4, 1, oscuro(col, 0.25));
    H.r(12, 5, 2, 2, '#2a2a30'); H.p(12, 6, '#e0b040'); H.r(13, 0, 1, 2, '#e0c060'); H.p(12, 1, '#e0c060'); H.p(14, 1, '#e0c060');
    H.r(4, 11, 3, 4, '#3a2a1e'); H.p(4, 10, '#3a2a1e'); H.p(6, 10, '#3a2a1e'); H.p(5, 9, '#3a2a1e');
    H.r(8, 10, 1, 2, CRISTAL); H.r(2, 10, 1, 2, CRISTAL); H.r(12, 9, 2, 2, CRISTAL);
    H.contorno(); return H.lienzo();
  }
  // ---------- Templo, molino, puerto y ayuntamiento de cada fase (0 tribal, 2 pólvora, 3 moderna) ----------
  function temploDeFase(H, fase, col) {
    if (fase === 0) {
      // Círculo de menhires con un altar y una ofrenda.
      for (const [x, y, h] of [[2, 8, 6], [5, 6, 7], [10, 6, 7], [13, 8, 6], [7, 11, 3]]) { H.r(x, y + 7 - h, 2, h, '#9a968c'); H.p(x, y + 7 - h, '#b8b4aa'); }
      H.r(6, 12, 4, 2, '#8a867c'); H.p(7, 11, col); H.p(8, 11, '#ffd84a');
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Catedral con rosetón, arcos y una aguja alta.
      H.r(2, 6, 12, 9, PIEDRA); H.r(2, 6, 1, 9, claro(PIEDRA, 0.15)); H.r(13, 6, 1, 9, oscuro(PIEDRA, 0.2));
      H.r(6, 0, 4, 6, PIEDRA); H.p(7, 0, oscuro(col, 0.1)); H.p(8, 0, oscuro(col, 0.1)); for (let y = 1; y < 4; y++) H.r(7, y, 2, 1, oscuro(PIEDRA, 0.1));
      H.r(7, 8, 2, 2, col); H.p(7, 8, claro(col, 0.3)); H.r(7, 11, 2, 4, '#3a2a1e'); H.p(7, 10, '#3a2a1e'); H.p(8, 10, '#3a2a1e');
      for (const x of [3, 11]) { H.r(x, 9, 2, 3, CRISTAL); H.p(x, 8, CRISTAL); }
      tejado(H, 1, 6, 4, 7, oscuro(col, 0.15)); tejado(H, 10, 15, 4, 7, oscuro(col, 0.15));
      H.contorno(); return H.lienzo();
    }
    // Iglesia moderna: hormigón claro, torre de campanas fina, vidriera alargada.
    H.r(2, 7, 9, 8, '#dcdcd8'); H.r(2, 7, 9, 1, '#f0f0ec'); H.r(4, 9, 1, 5, col); H.r(6, 9, 1, 5, claro(col, 0.2)); H.r(8, 9, 1, 5, col);
    H.r(12, 1, 3, 14, '#c8c8c4'); H.r(12, 3, 3, 1, '#9a9a96'); H.p(13, 0, '#e0b040'); H.r(13, 5, 1, 2, '#2a2a30');
    H.contorno(); return H.lienzo();
  }
  function molinoDeFase(H, fase, col) {
    if (fase === 0) {
      // Granero de barro con techo de paja y una piedra de moler.
      H.r(3, 8, 10, 7, '#b08a5a'); H.r(3, 8, 1, 7, '#c8a070'); H.r(7, 11, 2, 4, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8);
      for (let y = 3; y < 9; y++) { const half = Math.round((y - 2) * 1.1) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? paja : oscuro(paja, 0.2)); }
      H.r(12, 12, 3, 2, '#8a867c'); H.p(13, 11, '#a8a49a'); H.p(13, 12, '#e8d080');
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Molino de ladrillo, más alto, con galería de madera (las aspas giran aparte).
      for (let y = 4; y < 15; y++) { const half = 2 + Math.round((y - 4) * 0.35); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? '#a0503a' : '#8a3e2a'); }
      H.r(4, 9, 8, 1, '#6a4a2a'); H.r(7, 11, 2, 4, '#3a2a1e'); ventana(H, 7, 6, true);
      for (let y = 1; y < 5; y++) { const half = Math.round(y * 0.8) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(col, 0.1) : oscuro(col, 0.15)); }
      H.contorno(); return H.lienzo();
    }
    // Silos de grano y una nave: metal y hormigón.
    for (const x0 of [2, 7]) { H.r(x0, 3, 4, 12, '#c8ccd4'); H.r(x0, 3, 1, 12, '#e4e8ee'); H.r(x0 + 3, 3, 1, 12, '#9aa0aa'); H.r(x0, 2, 4, 1, '#9aa0aa'); for (let y = 5; y < 15; y += 3) H.r(x0, y, 4, 1, '#aab0ba'); }
    H.r(11, 9, 4, 6, '#8a8e96'); H.r(11, 8, 4, 1, col); H.r(12, 11, 2, 4, '#3a3e48');
    H.contorno(); return H.lienzo();
  }
  function puertoDeFase(H, fase, col) {
    if (fase === 0) {
      // Embarcadero de troncos atados y una canoa varada.
      H.r(1, 7, 9, 3, '#8a5a2b'); for (let x = 1; x < 10; x += 2) H.p(x, 8, '#6a4220');
      for (const x of [2, 8]) H.r(x, 10, 1, 3, '#5a3a22');
      H.r(9, 12, 6, 2, '#7a4a22'); H.r(10, 12, 4, 1, '#5a3418'); H.p(14, 11, '#7a4a22'); H.p(11, 11, col);
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Muelle de piedra con una grúa de madera y fardos.
      H.r(0, 6, 16, 6, PIEDRA); for (let x = 0; x < 16; x += 3) H.r(x, 9, 2, 1, oscuro(PIEDRA, 0.12)); H.r(0, 6, 16, 1, claro(PIEDRA, 0.15));
      H.r(11, 0, 1, 6, '#5a3a22'); H.r(8, 0, 4, 1, '#5a3a22'); H.r(8, 1, 1, 3, '#c8c0a8');
      H.r(3, 3, 3, 3, '#c8a060'); H.r(3, 4, 3, 1, '#8a6a3a'); H.r(6, 4, 2, 2, '#8a5a2a');
      H.contorno(); return H.lienzo();
    }
    // Dársena de hormigón con grúa metálica y contenedores.
    H.r(0, 7, 16, 6, '#a8acb4'); H.r(0, 7, 16, 1, '#c8ccd4'); H.r(0, 12, 16, 1, '#7a7e86');
    H.r(12, 0, 1, 7, '#e0a030'); H.r(7, 0, 6, 1, '#e0a030'); H.r(8, 1, 1, 2, '#3a3a44');
    H.r(2, 4, 4, 3, col); H.r(2, 4, 4, 1, claro(col, 0.25)); H.r(6, 5, 4, 2, '#3a7a5a'); H.r(6, 5, 4, 1, '#5a9a7a');
    H.contorno(); return H.lienzo();
  }
  function ayuntamientoDeFase(H, fase, col) {
    if (fase === 0) {
      // Casa comunal: una choza alargada grande, con postes tallados en la entrada.
      H.r(1, 9, 14, 6, '#b08a5a'); H.r(1, 9, 14, 1, '#c8a070'); H.r(7, 11, 2, 4, '#4a3020');
      const paja = mezcla(col, '#d8b060', 0.8);
      for (let y = 3; y < 10; y++) { const half = Math.round((y - 2) * 1.05) + 1; for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, (x + y) % 3 ? paja : oscuro(paja, 0.2)); }
      H.r(5, 10, 1, 5, '#8a5a32'); H.r(10, 10, 1, 5, '#8a5a32'); H.p(5, 9, col); H.p(10, 9, col);
      H.contorno(); return H.lienzo();
    }
    if (fase === 2) {
      // Ayuntamiento con torre del reloj y balcón.
      H.r(1, 8, 14, 7, '#e8d4b0'); H.r(1, 14, 14, 1, '#b0a080'); for (const x of [2, 12]) ventana(H, x, 10, true);
      H.r(5, 9, 6, 1, '#6a4a2a'); H.r(7, 11, 2, 4, '#5a3a22');
      tejado(H, 0, 15, 5, 8, col);
      H.r(6, 0, 4, 6, '#e8d4b0'); H.r(7, 2, 2, 2, '#f8f8f0'); H.p(8, 3, '#2a2a2a'); H.p(7, 0, oscuro(col, 0.2)); H.p(8, 0, oscuro(col, 0.2));
      H.contorno(); return H.lienzo();
    }
    // Edificio de gobierno moderno: columnas, escalinata, bandera.
    H.r(1, 6, 14, 9, '#d8d8d4'); H.r(1, 6, 14, 1, '#f0f0ec'); for (const x of [2, 5, 8, 11, 14]) H.r(x, 7, 1, 7, '#f4f4f0');
    H.r(0, 14, 16, 1, '#a8a8a4'); H.r(7, 10, 2, 4, '#3a3e48');
    H.r(8, 0, 1, 6, '#5a5a62'); H.r(9, 0, 4, 3, col);
    H.contorno(); return H.lienzo();
  }
  function torreDeFase(H, fase, col) {
    if (fase === 0) {
      for (let x = 3; x < 13; x += 2) { H.r(x, 4, 2, 11, '#8a5a2b'); H.r(x + 1, 4, 1, 11, '#6a4220'); H.p(x, 3, '#a8784a'); }
      H.r(3, 7, 10, 1, '#5a3a1e'); H.r(3, 11, 10, 1, '#5a3a1e'); H.r(6, 1, 4, 3, '#8a5a2b'); H.r(6, 0, 4, 1, col);
    } else if (fase === 2) {
      H.r(3, 5, 10, 10, '#b0a48a'); H.r(3, 5, 2, 10, '#c8bca0'); H.r(11, 5, 2, 10, '#8a7e66');
      for (const x of [2, 6, 10]) H.r(x, 3, 3, 2, '#b0a48a');
      H.r(6, 7, 4, 2, '#2a2a30'); H.r(9, 7, 4, 1, '#3a3a40'); H.p(12, 7, '#1a1a20');
      H.r(7, 12, 2, 3, '#4a3020'); H.r(3, 4, 10, 1, col);
    } else {
      // Búnker de hormigón semienterrado con su tronera y una ametralladora.
      H.r(1, 8, 14, 7, '#7a7e74'); H.r(2, 7, 12, 1, '#8a8e84'); H.r(1, 8, 14, 1, '#9a9e94'); H.r(1, 14, 14, 1, '#5a5e56');
      H.r(4, 10, 8, 2, '#1e2022'); H.r(10, 10, 4, 1, '#3a3a40'); H.p(14, 10, '#2a2a2e');
      for (const [x, y] of [[0, 12], [15, 13], [2, 6], [13, 6]]) H.p(x, y, '#c8b07a');
      H.r(7, 5, 1, 2, '#4a4a40'); H.r(8, 5, 3, 1, col);
    }
    H.contorno();
    return H.lienzo();
  }
  // Cuartel de soldados: barracón con armas en la puerta y el estandarte; de hormigón en la última fase.
  function cuartel(H, fase, col) {
    const pared = fase >= 3 ? '#9a9a8a' : fase === 2 ? '#c8a878' : fase === 1 ? '#a8a49a' : '#a07a48';
    H.r(1, 7, 14, 8, pared); H.r(1, 7, 2, 8, claro(pared, 0.15)); H.r(13, 7, 2, 8, oscuro(pared, 0.2));
    if (fase >= 3) { H.r(1, 5, 14, 2, '#6a6e64'); H.r(1, 5, 14, 1, col); }
    else tejado(H, 0, 15, 3, 7, col);
    H.r(6, 10, 4, 5, '#3a2a1e'); H.r(6, 10, 4, 1, '#2a1e14');
    // Las armas apoyadas junto a la puerta: lanzas, espadas o fusiles.
    const arma = fase === 0 ? '#c8a050' : fase === 1 ? '#dfe4ec' : '#3a3a40';
    for (const x of [3, 4, 11, 12]) { H.r(x, 9, 1, 6, fase >= 2 ? '#5a3a1e' : '#7a5232'); H.p(x, 8, arma); }
    H.r(14, 1, 1, 7, '#3a2a1e'); H.r(11, 1, 3, 2, col);
    H.contorno();
    return H.lienzo();
  }
  // Arquería: campo de tiro con dianas (luego de mosqueteros, con sacos terreros en la última fase).
  function arqueria(H, fase, col) {
    H.r(0, 9, 16, 6, fase >= 3 ? '#8a8e74' : '#9a8a5a'); H.r(0, 9, 16, 1, oscuro('#9a8a5a', 0.2));
    // Cobertizo.
    H.r(1, 4, 6, 6, fase >= 2 ? '#a8a49a' : '#a07a48'); tejado(H, 0, 7, 1, 4, col); H.r(3, 7, 2, 3, '#3a2a1e');
    // Dianas.
    for (const [x, y] of [[10, 5], [13, 9]]) {
      if (fase >= 3) { H.r(x - 1, y, 4, 3, '#c8b07a'); H.r(x - 1, y, 4, 1, '#a8905a'); }
      else { H.r(x, y + 3, 1, 3, '#6a4a2a'); H.disco(x + 0.5, y + 1.5, 2.1, '#f4ecd8'); H.disco(x + 0.5, y + 1.5, 1.3, '#d83a3a'); H.p(x, y + 1, '#f4ecd8'); }
    }
    H.contorno();
    return H.lienzo();
  }
  // El castillo de frontera: torre del homenaje de piedra (medieval), fortaleza abaluartada con cañón (pólvora),
  // fortín de hormigón con alambradas (guerras mundiales). En la fase tribal, un recinto de empalizada.
  function castillo(H, fase, col) {
    if (fase === 0) {
      // Recinto tribal: una choza grande tras una empalizada de estacas puntiagudas, con su estandarte.
      for (let y = 2; y < 9; y++) { const half = Math.round((y - 1) * 0.75); for (let x = 8 - half; x < 8 + half; x++) H.p(x, y, x < 8 ? claro(mezcla(col, '#d8b060', 0.45), 0.08) : oscuro(mezcla(col, '#d8b060', 0.45), 0.1)); }
      H.r(5, 8, 6, 3, '#b08a5a'); H.r(7, 9, 2, 2, '#4a3020');
      for (let x = 0; x < 16; x += 2) { H.r(x, 10, 1, 5, '#8a5a2b'); H.r(x + 1, 10, 1, 5, '#6a4220'); H.p(x, 9, '#a8784a'); }
      H.r(0, 12, 16, 1, '#5a3a1e');
      H.r(14, 1, 1, 9, '#5a3a1e'); H.r(15, 1, 1, 3, col);
    } else if (fase === 1) {
      const P = '#a8a49a';
      H.r(1, 6, 14, 9, P); for (let x = 1; x < 15; x += 3) H.r(x, 4, 2, 2, P);
      H.r(5, 1, 6, 8, claro(P, 0.08)); for (const x of [5, 8]) H.r(x, 0, 2, 1, P); H.r(9, 1, 2, 8, oscuro(P, 0.18));
      H.r(6, 11, 4, 4, '#3a2a1e'); for (let x = 7; x < 10; x += 2) H.r(x, 11, 1, 4, '#5a4030');
      ventana(H, 7, 3, true); H.r(13, 0, 1, 4, '#3a2a1e'); H.r(14, 0, 2, 2, col); H.r(1, 6, 14, 1, oscuro(P, 0.2));
    } else if (fase === 2) {
      // Baluarte en estrella de piedra baja, con un cañón asomando.
      for (let y = 3; y < 15; y++) { const half = y < 9 ? y - 2 : 15 - y; for (let x = 8 - half - 1; x <= 8 + half; x++) H.p(x, y, y < 5 ? '#c8bca0' : (x + y) % 5 ? '#b0a48a' : '#9a8e74'); }
      H.r(6, 7, 4, 3, '#5a5248'); H.r(9, 8, 4, 1, '#2a2a30'); H.p(13, 8, '#1a1a20');
      H.r(8, 0, 1, 4, '#3a2a1e'); H.r(9, 0, 3, 2, col);
    } else {
      H.r(2, 6, 12, 8, '#7a7e74'); H.r(2, 6, 12, 1, '#9a9e94'); H.r(2, 13, 12, 1, '#5a5e56');
      H.r(4, 9, 3, 1, '#1e2022'); H.r(9, 9, 3, 1, '#1e2022'); H.r(6, 3, 4, 3, '#6a6e64'); H.r(6, 3, 4, 1, col);
      for (let x = 0; x < 16; x += 2) { H.p(x, 15, '#5a5a5a'); H.p(x + 1, 14, '#5a5a5a'); }
    }
    H.contorno();
    return H.lienzo();
  }
  // La plaza de cada capital (32×32): gran casa comunal, castillo, palacio o edificio moderno.
  function plaza(ge, col) {
    return guardado('p' + ge + col, () => {
      const H = hoja(32, 32);
      if (ge === 0) {
        // Gran casa comunal con techo de paja del color del pueblo, hoguera y tótem con estandarte.
        H.r(4, 16, 24, 12, '#b08a5a'); H.r(4, 16, 3, 12, '#c8a070'); H.r(25, 16, 3, 12, '#8a6a42');
        for (let x = 6; x < 26; x += 4) H.r(x, 17, 1, 11, '#8a6438');
        H.r(14, 20, 4, 8, '#4a3020');
        const paja = mezcla(col, '#d8b060', 0.4);
        for (let y = 4; y < 18; y++) { const half = Math.round((y - 2) * 1.0); for (let x = 16 - half; x < 16 + half; x++) H.p(x, y, (x + y) % 3 === 0 ? oscuro(paja, 0.2) : x < 16 ? claro(paja, 0.1) : oscuro(paja, 0.1)); }
        H.r(27, 6, 1, 22, '#6a4a2a'); H.r(28, 6, 4, 3, col); H.p(29, 7, '#fff6dc');
        H.r(1, 28, 4, 2, '#5a3a22'); H.p(2, 27, '#ff9a3a'); H.p(3, 26, '#ffd23a'); H.p(2, 26, '#ff6a2a');
      } else if (ge === 1) {
        // Castillo: muralla de piedra con cuatro torres almenadas, torre del homenaje con tejado del color del pueblo.
        const P = PIEDRA;
        H.r(2, 12, 28, 18, P); H.r(2, 12, 28, 2, oscuro(P, 0.18));
        for (let x = 2; x < 30; x += 3) H.r(x, 10, 2, 2, P);
        for (const tx of [0, 25]) { H.r(tx, 6, 7, 24, claro(P, 0.06)); H.r(tx + 5, 6, 2, 24, oscuro(P, 0.2)); for (let x = tx; x < tx + 7; x += 2) H.r(x, 4, 1, 2, P); H.r(tx + 3, 12, 1, 3, '#2a2a30'); }
        H.r(10, 4, 12, 14, claro(P, 0.08)); H.r(19, 4, 3, 14, oscuro(P, 0.18));
        tejado(H, 9, 22, 0, 5, col);
        H.r(13, 22, 6, 8, '#3a2a1e'); H.r(13, 22, 6, 1, '#2a1e14'); for (let x = 14; x < 19; x += 2) H.r(x, 23, 1, 7, '#5a4030');
        ventana(H, 12, 8, true); ventana(H, 18, 8, true);
        for (const fx of [3, 28]) { H.r(fx, 0, 1, 4, '#3a2a1e'); H.r(fx + 1, 0, 3, 2, col); }
        for (let y = 14; y < 30; y += 3) for (let x = 7; x < 25; x += 5) if (x < 13 || x > 18) H.r(x + (y % 2) * 2, y, 2, 1, oscuro(P, 0.1));
      } else if (ge === 2) {
        // Palacio con cúpula dorada, alas con tejado del color del pueblo, columnas y escalinata.
        H.r(1, 14, 30, 14, '#efe4cc'); H.r(1, 14, 30, 1, '#d8ccb0');
        for (let x = 3; x < 30; x += 3) { H.r(x, 16, 1, 10, '#ffffff'); H.p(x, 16, '#d8ccb0'); }
        tejado(H, 0, 12, 9, 14, col); tejado(H, 19, 31, 9, 14, col);
        H.disco(16, 10, 6, '#e8b840', true); H.r(10, 10, 13, 5, '#efe4cc'); H.r(15, 2, 2, 3, '#e8b840'); H.p(15, 1, '#fff0a0');
        for (let k = 0; k < 4; k++) H.r(10 - k, 27 + k, 12 + k * 2, 1, k % 2 ? '#d8d0bc' : '#e8e0cc');
        H.r(14, 20, 4, 7, '#6a4024'); ventana(H, 5, 18, true); ventana(H, 25, 18, true); ventana(H, 10, 18, false); ventana(H, 20, 18, false);
      } else {
        // Edificio moderno: rascacielos de cristal con franjas del color del pueblo y un edificio de gobierno.
        H.r(14, 1, 12, 28, '#5a7aa8'); H.r(14, 1, 2, 28, '#8aaad0'); H.r(24, 1, 2, 28, '#3a5a88');
        for (let y = 3; y < 28; y += 3) H.r(14, y, 12, 1, oscuro('#5a7aa8', 0.25));
        for (let y = 2; y < 28; y += 6) H.r(14, y, 12, 1, col);
        const r = azar(ge + 11);
        for (let y = 4; y < 27; y += 3) for (let x = 16; x < 24; x += 2) if (r() < 0.3) H.p(x, y, LUZ);
        H.r(1, 16, 14, 13, '#d8d4cc'); H.r(1, 15, 14, 2, col); for (let x = 3; x < 14; x += 3) H.r(x, 18, 1, 9, '#f4f0e8');
        H.r(6, 24, 4, 5, '#4a4e58'); H.r(19, 0, 1, 2, '#c8c8d0'); H.p(19, 0, '#ff4a3a');
      }
      H.contorno();
      return H.lienzo();
    });
  }

  // ---------- Aldeanos (12×14, los pies abajo en el centro) ----------
  // o: oficio; edad: 'nino' | 'adulto' | 'viejo'; paso: 0/1 (piernas); alto: -1/0/1 (herramienta arriba o abajo);
  // carga: lleva troncos o piedras; arma, tirador, armadura: los guerreros. pelo: 0..3.
  const PIEL = ['#f0c8a0', '#d8a878', '#b07a50', '#8a5a3a'], PELO = ['#3a2418', '#1e1a1a', '#c89a4a', '#7a3a1e'];
  const MAT = ['#a3a9b5', '#8a5a32', '#c89a3a', '#8a909c', '#cfd6e2', '#b8c0cc', '#6a7a5a'];
  /*
   * EL TIRADOR EN COMBATE: posturas de tiro, mirando a la derecha (el pintor lo voltea si el blanco está a la
   * izquierda). 'apunta': de pie con el arma al hombro (honda, pólvora temprana); 'rodilla': rodilla en tierra
   * (arcabuz, espingarda); 'tierra': cuerpo a tierra (fusil moderno); 'arco': tensando el arco (tenso = cuerda
   * atrás, con la flecha). Devuelve el dibujo y dónde está la boca del arma, para el fogonazo.
   */
  const BOCA = { apunta: [15, 7], rodilla: [15, 9], tierra: [15, 10], arco: [13, 7] };
  function tiradorEnPose(o) {
    const clave = 'tp' + [o.col, o.pose, o.tenso ? 1 : 0, o.arma, o.armadura, o.piel, o.pelo].join(':');
    return guardado(clave, () => {
      const H = hoja(16, 14), piel = PIEL[o.piel || 0], pelo = PELO[o.pelo || 0], arm = o.armadura ? MAT[o.armadura] : null;
      const unif = (o.arma || 0) >= 6 ? ((o.arma || 0) >= 7 ? mezcla(o.col, '#4a4a3a', 0.4) : o.col) : null;
      const ropa = unif || arm || o.col, pierna = unif ? oscuro(unif, 0.3) : '#4a3a2e', fuego = (o.arma || 0) >= 5, culata = '#7a4a22', canon = '#3a3a44';
      const casco = (x, y) => {
        if (unif) { const c_ = o.arma >= 7 ? oscuro(unif, 0.25) : oscuro(unif, 0.55); H.r(x - 1, y - 1, 5, 2, c_); H.r(x - 2, y, 7, 1, oscuro(c_, 0.2)); }
        else if (fuego) { H.r(x - 1, y - 1, 5, 2, o.arma >= 7 ? '#5a6a4a' : '#2a2a3a'); H.r(x - 2, y, 7, 1, o.arma >= 7 ? '#4a5a3a' : '#1a1a2a'); }
        else if ((o.arma || 0) >= 1) { H.r(x - 1, y - 1, 5, 2, '#4a7a3a'); H.p(x - 1, y + 1, '#4a7a3a'); }
        else { H.r(x, y - 1, 3, 1, pelo); H.p(x - 1, y, pelo); }
      };
      const cabeza = (x, y) => { H.r(x, y, 3, 4, piel); H.r(x + 2, y, 1, 4, oscuro(piel, 0.12)); H.p(x + 2, y + 2, '#2a1e1a'); H.r(x, y - 1, 3, 1, pelo); casco(x, y); };
      const torso = (x, y, w, h) => { H.r(x, y, w, h, ropa); H.r(x, y, w, 1, claro(ropa, 0.15)); if (arm && !unif) H.r(x + Math.floor(w / 2), y, 1, h, o.col); H.r(x, y + h - 1, w, 1, oscuro(ropa, 0.3)); };
      if (o.pose === 'tierra') {
        // Tumbado boca abajo: piernas atrás, el cuerpo pegado al suelo, la cabeza alzada y el fusil al frente.
        H.r(0, 12, 4, 1, pierna); H.p(0, 11, '#2a1e14'); H.p(1, 13, '#2a1e14');
        torso(3, 11, 6, 2);
        H.p(9, 12, ropa); H.p(10, 12, piel);
        cabeza(9, 8);
        H.r(8, 10, 3, 1, culata); H.r(11, 10, 5, 1, canon); H.p(10, 11, culata);
      } else if (o.pose === 'rodilla') {
        // Rodilla en tierra: una pierna doblada con la rodilla en el suelo, la otra delante; el arma al hombro.
        H.r(3, 12, 3, 1, pierna); H.p(2, 12, '#2a1e14');
        H.r(6, 11, 2, 1, pierna); H.r(7, 12, 1, 1, pierna); H.p(7, 13, '#2a1e14');
        torso(4, 8, 5, 4);
        cabeza(5, 4);
        H.p(9, 9, ropa); H.p(10, 9, piel); H.p(8, 10, piel);
        H.r(7, 9, 3, 1, culata); H.r(10, 9, 6, 1, canon); if (o.arma === 6) H.p(15, 8, '#dfe4ec');
      } else if (o.pose === 'arco') {
        // Tensando el arco: brazo delantero estirado con el arco, el de atrás tira de la cuerda (y suelta).
        H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        torso(4, 7, 5, 4);
        cabeza(5, 3);
        H.r(9, 7, 2, 1, ropa); H.p(11, 7, piel);
        for (const [x, y] of [[11, 3], [12, 4], [12, 5], [12, 6], [12, 7], [12, 8], [12, 9], [12, 10], [11, 11]]) H.p(x, y, '#8a5a2b');
        const cuerda = o.tenso ? 8 : 11;
        H.p(11, 4, '#e8e0c8'); H.p(11, 10, '#e8e0c8'); for (let y = 5; y <= 9; y++) H.p(y === 7 ? cuerda : Math.round(11 + (cuerda - 11) * (1 - Math.abs(y - 7) / 3)), y, '#e8e0c8');
        if (o.tenso) { H.r(8, 7, 6, 1, '#c8a050'); H.p(14, 7, '#cfd6e2'); H.p(8, 7, piel); }
      } else {
        // De pie apuntando: el arma al hombro y los dos brazos al frente.
        H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        torso(4, 7, 5, 4);
        cabeza(5, 3);
        H.p(9, 8, ropa); H.p(10, 8, piel); H.p(8, 9, piel);
        if (fuego) { H.r(7, 7, 3, 1, culata); H.r(10, 7, 6, 1, canon); }
        else { H.r(9, 6, 1, 3, '#7a5232'); H.p(10, 5, '#c8b07a'); H.p(10, 7, '#a3a1aa'); }
      }
      H.contorno(0.6);
      return H.lienzo();
    });
  }
  function aldeano(o) {
    const clave = 'v' + [o.col, o.oficio, o.edad, o.paso, o.corre ? 1 : 0, o.alto, o.carga, o.arma, o.tirador ? 1 : 0, o.armadura, o.piel, o.pelo, o.sabio || ''].join(':');
    return guardado(clave, () => {
      const H = hoja(12, 14), piel = PIEL[o.piel || 0], pelo = o.edad === 'viejo' ? '#e8e8ec' : PELO[o.pelo || 0];
      if (o.edad === 'nino') {
        // Niño: más bajito y cabezón.
        const pn = o.paso || 0; H.p(pn === 1 ? 4 : 5, 12, '#3a2a1e'); H.p(pn === 3 ? 8 : pn === 1 ? 7 : 6 + (pn === 0 ? 1 : 0), 12, '#3a2a1e');
        H.r(5, 9, 3, 3, o.col); H.p(7, 10, oscuro(o.col, 0.2));
        H.r(5, 6, 3, 3, piel); H.p(7, 7, '#2a1e1a'); H.r(5, 5, 3, 1, pelo); H.p(4, 6, pelo);
        H.contorno(0.6);
        return H.lienzo();
      }
      const guerrero = o.oficio === 'guerrero', arm = guerrero && o.armadura ? MAT[o.armadura] : null;
      // Desde la Revolución Industrial el soldado viste uniforme del color de su reino: vistoso con la espingarda,
      // apagado (de campaña) en la era moderna y la Segunda Guerra Mundial.
      const unif = guerrero && (o.arma || 0) >= 6 ? ((o.arma || 0) >= 7 ? mezcla(o.col, '#4a4a3a', 0.4) : o.col) : null;
      // Piernas (al andar, una adelantada) y zapatos.
      // Piernas: quieto, o un ciclo de cuatro tiempos al andar (zancada, cruce, zancada con la otra, cruce);
      // al correr, la zancada es más larga y la rodilla sube. La pierna de delante va un poco más oscura.
      const pierna = unif ? oscuro(unif, 0.3) : '#4a3a2e', lejana = unif ? oscuro(unif, 0.45) : '#3a2e24', zapato = '#2a1e14', pn = o.paso || 0, larga = o.corre ? 1 : 0;
      const pie = (x, y, col) => { H.p(x, y - 1, col); H.p(x, y, zapato); };
      if (pn === 0) { H.r(5, 11, 1, 2, pierna); H.r(7, 11, 1, 2, pierna); H.p(5, 12, zapato); H.p(7, 12, zapato); }
      else if (pn === 1 || pn === 3) {
        // Zancada: una pierna atrás y la otra delante (se alternan cuál va cerca).
        const atras = pn === 1 ? lejana : pierna, delante = pn === 1 ? pierna : lejana;
        H.p(5, 11, atras); H.p(7, 11, delante); pie(4 - larga, 12, atras); pie(8 + larga, 12, delante);
      } else {
        // Cruce: las piernas pasan una junto a otra; la que va en el aire, con la rodilla doblada.
        const apoyo = pn === 2 ? pierna : lejana, aire = pn === 2 ? lejana : pierna;
        H.r(6, 11, 1, 2, apoyo); H.p(6, 12, zapato); H.p(7, 11, aire); H.p(7 + larga, 12 - larga, aire);
      }
      // Cuerpo con la ropa del color del pueblo (o la armadura con un tabardo del color del pueblo), cinturón.
      const ropa = unif || arm || o.col;
      H.r(4, 7, 5, 4, ropa); H.r(4, 7, 1, 4, claro(ropa, 0.15)); H.r(8, 7, 1, 4, oscuro(ropa, 0.2));
      if (arm && !unif) H.r(6, 7, 1, 4, o.col);
      H.r(4, 10, 5, 1, oscuro(ropa, 0.35));
      // Correajes: bandolera blanca y botones dorados con la espingarda; cinturón y tirantes de cuero en la era moderna.
      if (unif && (o.arma || 0) === 6) { H.p(4, 7, '#f0ece0'); H.p(5, 8, '#f0ece0'); H.p(6, 9, '#f0ece0'); H.r(4, 10, 5, 1, '#f0ece0'); H.p(7, 7, '#c8a050'); H.p(7, 8, '#c8a050'); }
      else if (unif) { H.r(4, 10, 5, 1, '#3a2a1a'); H.p(5, 7, '#3a2a1a'); H.p(5, 8, '#3a2a1a'); H.p(6, 10, '#c8a050'); }
      // Brazos: balancean al andar (el de atrás siempre; el de delante solo si no lleva nada en la mano).
      const mano = !!(o.carga || ['lenador', 'minero', 'granjero', 'constructor'].includes(o.oficio) || guerrero);
      const vaivenAtras = pn === 1 ? -1 : pn === 3 ? 1 : 0, vaivenDelante = mano ? 0 : -vaivenAtras;
      H.p(3, 8, ropa); H.p(3 + (vaivenAtras > 0 ? 0 : vaivenAtras), 9 + (vaivenAtras > 0 ? 1 : 0), piel);
      H.p(9, 8, ropa); H.p(9 + (vaivenDelante < 0 ? 1 : 0), 9 + (vaivenDelante > 0 ? 1 : 0), piel);
      // Cabeza, ojo y pelo.
      H.r(5, 3, 3, 4, piel); H.r(7, 3, 1, 4, oscuro(piel, 0.12)); H.p(7, 5, '#2a1e1a');
      H.r(5, 2, 3, 1, pelo); H.p(4, 3, pelo); H.p(5, 3, pelo);
      // Sombreros y cascos según el oficio.
      if (o.oficio === 'granjero') { H.r(3, 2, 7, 1, '#e2c25a'); H.r(5, 1, 3, 1, '#d0b048'); }
      else if (o.oficio === 'minero') { H.r(4, 1, 5, 2, '#c8a03a'); H.p(7, 2, '#fff4a0'); }
      else if (o.oficio === 'comerciante') { H.r(4, 1, 5, 2, '#7a3a1a'); H.r(3, 2, 7, 1, '#5a2a12'); }
      else if (o.oficio === 'constructor') { H.r(4, 1, 5, 2, '#e8a030'); }
      else if (unif) { const casco = (o.arma || 0) >= 7 ? oscuro(unif, 0.25) : oscuro(unif, 0.55); if ((o.arma || 0) >= 7) { H.r(4, 1, 5, 2, casco); H.r(3, 2, 7, 1, oscuro(casco, 0.2)); H.p(5, 1, claro(casco, 0.15)); } else { H.r(5, 0, 3, 3, casco); H.r(4, 2, 5, 1, oscuro(casco, 0.3)); H.p(6, 0, '#e8d8a0'); } }
      else if (guerrero && o.arma >= 2 && !(o.tirador && o.arma >= 5)) { H.r(4, 1, 5, 2, o.arma >= 4 ? '#cfd6e2' : '#8a909c'); H.p(6, 3, o.arma >= 4 ? '#cfd6e2' : '#8a909c'); H.p(6, 0, o.col); }
      else if (guerrero && o.tirador && o.arma >= 1 && o.arma < 5) { H.r(4, 1, 5, 2, '#4a7a3a'); H.p(4, 3, '#4a7a3a'); }
      else if (guerrero && o.arma >= 5) { H.r(4, 1, 5, 2, o.arma >= 7 ? '#5a6a4a' : '#2a2a3a'); H.r(3, 2, 7, 1, o.arma >= 7 ? '#4a5a3a' : '#1a1a2a'); }
      // Lo que lleva en la mano (a la derecha), que sube y baja al trabajar.
      const a = o.alto || 0;
      if (o.carga === 3) { H.r(9, 4, 3, 7, '#e0b840'); H.r(9, 4, 3, 2, '#f8e080'); H.r(9, 8, 3, 1, '#8a6a2a'); H.p(10, 3, '#f8e080'); H.p(9, 11, '#c8a030'); H.p(11, 11, '#c8a030'); }
      else if (o.carga) { const c = o.carga === 2 ? '#9a98a2' : '#8a5a2b'; H.r(4, 0, 5, 2, c); H.r(4, 0, 5, 1, claro(c, 0.2)); }
      else if (o.oficio === 'lenador') { H.r(10, 5 + a, 1, 6, '#7a5232'); H.r(10, 5 + a, 2, 2, '#c8ccd6'); }
      else if (o.oficio === 'minero') { H.r(10, 6 + a, 1, 5, '#7a5232'); H.r(9, 5 + a, 3, 1, '#a3a1aa'); }
      else if (o.oficio === 'granjero') { H.r(10, 4 + a, 1, 8, '#7a5232'); H.r(10, 11 + a, 2, 1, '#9aa0aa'); }
      else if (o.oficio === 'constructor') { H.r(10, 6 + a, 1, 4, '#7a5232'); H.r(9, 5 + a, 3, 2, '#5e5e68'); }
      else if (guerrero) {
        const arma = o.arma || 0;
        // La espingarda (Revolución Industrial): el rifle largo de culata de madera, cañón muy largo y bayoneta.
        if (o.tirador && arma === 6) { for (let k = 0; k < 9; k++) H.p(4 + k, 10 - Math.floor(k * 0.75), k < 3 ? '#7a4a22' : '#3a3a44'); H.p(13, 3, '#dfe4ec'); H.p(14, 2, '#dfe4ec'); }
        else if (o.tirador && arma >= 5) { for (let k = 0; k < 6; k++) H.p(6 + k, 9 - Math.floor(k * 0.8), k < 2 ? '#5a3a1e' : '#3a3a44'); }
        else if (o.tirador && arma >= 1) { for (let y = 4; y <= 11; y++) H.p(10 + (y > 5 && y < 10 ? 1 : 0), y, '#8a5a2b'); H.r(10, 5, 1, 6, '#e8e0c8'); H.r(2, 7, 1, 4, '#7a5232'); H.p(2, 6, '#e8e0c8'); }
        else if (arma === 0) { H.r(10, 5 + a, 1, 6, '#6b4a2b'); H.r(10, 4 + a, 2, 2, '#5a3a20'); }
        else if (arma === 1) { H.r(10, 0 + a, 1, 12, '#7a5232'); H.r(10, -1 + a, 1, 2, '#d8b060'); }
        else if (arma === 6) { H.r(10, 7, 1, 5, '#7a4a22'); H.r(10, 2, 1, 5, '#3a3a44'); H.p(11, 10, '#7a4a22'); H.r(10, 0, 1, 2, '#dfe4ec'); H.p(9, 6, '#5a5a62'); }
        else if (arma >= 5) { H.r(10, 1, 1, 11, '#5a3a1e'); H.p(10, 0, '#cfd6e2'); }
        else {
          H.r(10, 3 + a, 1, 6, arma >= 4 ? '#eef1f6' : '#c8ccd6'); H.p(10, 2 + a, '#ffffff'); H.r(9, 8 + a, 3, 1, '#c8a050'); H.p(10, 9 + a, '#6a4a2a');
          if (arma >= 3) { H.r(1, 7, 3, 4, o.col); H.p(2, 8, claro(o.col, 0.4)); H.r(1, 7, 3, 1, '#c8a050'); }
        }
      }
      // El erudito de cada época, con su ropa larga, su tocado y lo que lleva en la mano.
      if (o.oficio === 'erudito') {
        const tipo = o.sabio || 'chaman', a2 = o.alto || 0;
        const tunica = { chaman: '#8a5a32', filosofo: '#eeeae0', monje: '#6a4a30', erudito: '#3a2a4a', cientifico: '#f2f2f4' }[tipo];
        // Ropa larga hasta los pies (tapa las piernas), con el color del pueblo en un detalle.
        H.r(4, 7, 5, 5, tunica); H.r(4, 7, 1, 5, claro(tunica, 0.12)); H.r(8, 7, 1, 5, oscuro(tunica, 0.18)); H.r(3, 11, 7, 1, oscuro(tunica, 0.1));
        H.p(5, 12, '#2a1e14'); H.p(7, 12, '#2a1e14');
        H.p(3, 8, tunica); H.p(9, 8, tunica);
        if (tipo === 'chaman') {
          // Flecos de cuero, pinturas en la cara, un tocado de plumas y un bastón con un hueso.
          for (let x = 4; x <= 8; x += 2) H.p(x, 11, '#5a3a1e');
          H.p(6, 6, '#c83a2a'); H.r(4, 2, 5, 1, o.col);
          H.p(4, 1, '#e04030'); H.p(5, 0, '#f0c040'); H.p(6, 0, '#3a8ad0'); H.p(7, 0, '#f0c040'); H.p(8, 1, '#e04030');
          H.r(10, 2 + a2, 1, 10, '#6b4a2b'); H.p(10, 1 + a2, '#e8e0c8'); H.p(11, 1 + a2, '#e8e0c8'); H.p(11, 3 + a2, '#e04030');
        } else if (tipo === 'filosofo') {
          // Toga blanca con banda del color del pueblo, barba gris y un rollo de pergamino.
          for (let k = 0; k < 4; k++) H.p(4 + k, 7 + k, o.col);
          H.r(5, 6, 3, 2, '#c8c8d0'); H.p(5, 2, piel); H.p(6, 2, piel);
          H.r(9, 7 + a2, 3, 3, '#efe2b8'); H.p(9, 7 + a2, '#c8b080'); H.p(11, 9 + a2, '#c8b080');
        } else if (tipo === 'monje') {
          // Hábito pardo con capucha, cordón y un libro.
          H.r(4, 2, 5, 1, '#5a3a22'); H.p(4, 3, '#5a3a22'); H.p(4, 4, '#5a3a22'); H.p(4, 5, '#5a3a22'); H.p(8, 3, '#5a3a22'); H.p(8, 4, '#5a3a22');
          H.r(4, 9, 5, 1, '#d8c890'); H.p(6, 10, '#d8c890');
          H.r(9, 8 + a2, 3, 3, '#7a2a1a'); H.r(9, 8 + a2, 3, 1, '#f0e8d0'); H.p(10, 9 + a2, '#e0c060');
        } else if (tipo === 'erudito') {
          // Toga oscura, birrete negro, cuello blanco y una pluma.
          H.r(4, 1, 5, 2, '#1a1a22'); H.p(8, 1, '#2a2a3a');
          H.r(5, 7, 3, 1, '#f0f0f0'); H.p(6, 8, o.col);
          H.r(9, 8 + a2, 3, 3, '#3a5a8a'); H.p(10, 6 + a2, '#f4f4f4'); H.p(11, 5 + a2, '#f4f4f4');
        } else {
          // Bata blanca abierta (camisa del color del pueblo), gafas y un matraz con algo verde.
          H.r(6, 7, 1, 4, o.col); H.p(6, 5, '#2a2a2a'); H.p(5, 5, '#2a2a2a');
          H.p(10, 7 + a2, '#cfe8f0'); H.r(9, 8 + a2, 3, 3, '#cfe8f0'); H.r(9, 9 + a2, 3, 2, '#5ac05a'); H.p(10, 9 + a2, '#9af09a');
        }
      }
      H.contorno(0.68);
      return H.lienzo();
    });
  }
  // El mismo dibujo teñido (para el destello rojo o blanco al recibir un golpe).
  function tenido(img, color) {
    return guardado('tinte' + color + img.__id, () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  let sigId = 0;
  const conId = img => { if (img.__id == null) img.__id = ++sigId; return img; };

  // ---------- Vehículos de guerra (mirando a la derecha; el pintor los voltea) ----------
  function vehiculo(tipo, col, paso) {
    return guardado('veh' + tipo + col + paso, () => {
      if (tipo === 'tanque') {
        const H = hoja(16, 11), cuerpo = mezcla(col, '#5a6040', 0.55);
        H.r(1, 7, 14, 3, '#2a2a26'); for (let x = 2; x < 15; x += 2) H.p(x + (paso ? 1 : 0), 8, '#55554c'); // orugas
        for (let x = 2; x < 15; x += 3) H.disco(x + 0.5, 8.5, 1, '#3a3a34');
        H.r(1, 5, 14, 2, cuerpo); H.r(2, 4, 12, 1, claro(cuerpo, 0.15));
        H.r(4, 2, 7, 2, cuerpo); H.r(5, 1, 5, 1, claro(cuerpo, 0.2)); // torreta
        H.r(11, 2, 5, 1, '#3a3a34'); // cañón
        H.p(6, 3, col); H.p(7, 3, col);
        H.contorno();
        return H.lienzo();
      }
      // Cañón de campaña o artillería: tubo largo sobre dos ruedas y un afuste.
      const H = hoja(16, 10), pesado = tipo === 'artilleria';
      H.r(1, 6, 7, 1, '#6b4a2b'); // afuste
      H.disco(8.5, 6.5, 2.4, '#5a3a22', true); H.p(8, 6, '#c8a060');
      H.r(6, 3, pesado ? 10 : 8, 2, pesado ? '#4a4e44' : '#3a3a3a'); H.r(6, 3, pesado ? 10 : 8, 1, pesado ? '#6a7060' : '#5a5a5a');
      if (pesado) H.r(3, 2, 4, 3, mezcla(col, '#5a6040', 0.6)); // escudo
      H.p(2, 5, col);
      H.contorno();
      return H.lienzo();
    });
  }
  // El avión de cada época: biplano (Era Moderna) o bombardero de dos motores (II Guerra Mundial).
  function avion(col, bombardero) {
    return guardado('avion' + col + (bombardero ? 'b' : ''), () => {
      const H = hoja(16, 9), cuerpo = mezcla(col, '#7a8070', 0.5);
      H.r(2, 4, 12, 2, cuerpo); H.r(13, 4, 2, 2, claro(cuerpo, 0.15)); H.p(15, 4, '#2a2a2a'); H.p(15, 5, '#2a2a2a'); // fuselaje y hélice
      if (bombardero) {
        H.r(5, 0, 4, 9, oscuro(cuerpo, 0.12)); H.r(5, 0, 4, 1, claro(cuerpo, 0.1)); // alas largas
        H.r(9, 1, 2, 1, '#3a3a34'); H.r(9, 7, 2, 1, '#3a3a34'); // dos motores
        H.p(6, 5, '#2a2a26'); H.p(7, 5, '#2a2a26'); // bombas bajo el vientre
      } else {
        H.r(6, 1, 3, 7, oscuro(cuerpo, 0.12)); H.r(6, 1, 3, 1, claro(cuerpo, 0.1)); // alas
        H.p(6, 3, '#4a3a2a'); H.p(8, 6, '#4a3a2a'); // los montantes del biplano
      }
      H.r(1, 2, 2, 2, oscuro(cuerpo, 0.12)); H.r(1, 6, 2, 1, oscuro(cuerpo, 0.12)); // cola
      H.p(11, 4, '#a8d8f0'); H.p(7, 3, col); H.p(7, 6, col);
      H.contorno();
      return H.lienzo();
    });
  }

  // ---------- Barcos de cada época (de pesca y mercantes), mirando a la derecha ----------
  function barco(tipo, fase, col) {
    return guardado('barco' + tipo + fase + col, () => {
      const H = hoja(20, 16);
      if (tipo === 'guerra' && fase === 'galera') { // galera de guerra: casco oscuro, espolón, escudos, remos y vela del reino
        H.r(1, 10, 17, 3, '#4a3020'); H.r(1, 10, 17, 1, '#6a4a2a'); H.r(2, 13, 15, 1, '#2a1a10'); H.r(18, 11, 2, 1, '#8a7a5a'); H.p(0, 9, '#4a3020');
        for (let x = 3; x < 17; x += 3) { H.r(x, 9, 2, 2, col); H.p(x, 9, '#e8d8a0'); H.p(x, 13, '#8a6a42'); H.p(x - 1, 14, '#8a6a42'); }
        H.r(9, 1, 1, 8, '#2a1a10'); H.r(5, 2, 9, 6, col); H.r(5, 2, 9, 1, '#1a1a1a'); H.r(5, 7, 9, 1, '#1a1a1a'); H.r(8, 4, 3, 2, '#e8d8a0');
      } else if (tipo === 'guerra' && fase === 'galeon') { // galeón de guerra: tres palos, troneras con cañones y banderas del reino
        H.r(1, 10, 18, 4, '#3a2416'); H.r(1, 10, 18, 1, '#6a4422'); H.r(14, 6, 5, 4, '#3a2416'); H.r(1, 7, 4, 3, '#3a2416'); H.r(1, 12, 18, 1, col);
        for (let x = 3; x < 17; x += 3) { H.p(x, 11, '#0a0a0a'); H.p(x + 1, 11, '#5a5a62'); }
        for (const [x, h] of [[5, 7], [9, 9], [13, 7]]) { H.r(x, 10 - h, 1, h, '#2a1a10'); H.r(x - 2, 11 - h, 5, h - 4, '#e8e0cc'); H.r(x - 2, 11 - h, 5, 1, '#1a1a1a'); }
        H.r(9, 0, 3, 1, col); H.r(13, 2, 2, 1, col); H.r(5, 2, 2, 1, col);
      } else if (tipo === 'guerra') { // acorazado: casco gris de hierro, dos torretas con cañones, puente y chimenea
        H.r(0, 10, 20, 4, '#5a626e'); H.r(0, 10, 20, 1, '#7a828e'); H.r(1, 14, 18, 1, '#3a4048'); H.r(0, 12, 20, 1, col);
        H.r(7, 6, 6, 4, '#6a727e'); H.r(8, 4, 3, 2, '#7a828e'); H.p(9, 5, CRISTAL); H.r(11, 3, 2, 3, '#3a3a40');
        for (const x of [2, 15]) { H.r(x, 8, 3, 2, '#4a525e'); } H.r(0, 8, 2, 1, '#2a2e34'); H.r(18, 8, 2, 1, '#2a2e34');
        H.p(9, 2, col);
      } else if (tipo === 'pesca') {
        if (fase === 0) { // canoa con un pescador y su remo
          H.r(3, 11, 13, 2, '#7a4a22'); H.r(4, 13, 11, 1, '#5a3418'); H.r(3, 11, 13, 1, '#9a6a3a'); H.p(2, 10, '#7a4a22'); H.p(16, 10, '#7a4a22');
          H.r(9, 8, 2, 3, col); H.r(9, 6, 2, 2, '#e8b890'); H.r(12, 7, 1, 6, '#6b4a2b'); H.r(12, 12, 2, 2, '#6b4a2b');
        } else if (fase <= 1) { // barca de vela latina
          H.r(3, 11, 13, 2, '#6b4a2b'); H.r(4, 13, 11, 1, '#5a3a22'); H.r(3, 11, 13, 1, '#8a6a42');
          H.r(9, 2, 1, 9, '#3a2a1e'); for (let y = 2; y < 10; y++) H.r(10, y, Math.round((y - 1) * 0.7), 1, '#e8e0c8'); H.p(11, 5, col); H.r(5, 9, 2, 2, '#e8b890');
        } else if (fase === 2) { // pesquero de dos velas
          H.r(2, 11, 16, 3, '#5a3a22'); H.r(2, 11, 16, 1, '#8a6a42'); H.r(3, 14, 14, 1, '#3a2a1e');
          for (const [x, h] of [[6, 8], [12, 9]]) { H.r(x, 11 - h, 1, h, '#3a2a1e'); H.r(x + 1, 12 - h, 3, h - 2, '#f0e8d4'); H.r(x + 1, 13 - h, 3, 1, col); }
        } else { // arrastrero de motor con chimenea
          H.r(1, 10, 18, 4, '#3a4a6a'); H.r(1, 10, 18, 1, '#5a6a8a'); H.r(2, 14, 16, 1, '#2a3248'); H.r(1, 12, 18, 1, col);
          H.r(5, 6, 6, 4, '#e8e8e4'); H.r(6, 7, 1, 1, CRISTAL); H.r(8, 7, 1, 1, CRISTAL); H.r(12, 4, 2, 6, '#2a2a2a'); H.r(12, 4, 2, 1, col); H.r(15, 3, 1, 7, '#5a5a62');
        }
      } else {
        if (fase === 0) { // balsa de troncos con una vela de piel y fardos
          H.r(2, 11, 15, 2, '#8a5a2b'); for (let x = 2; x < 17; x += 3) H.p(x, 12, '#6a4220'); H.r(3, 13, 13, 1, '#5a3418');
          H.r(9, 3, 1, 8, '#5a3a22'); H.r(6, 4, 6, 5, '#c8a070'); H.r(6, 6, 6, 1, col); H.r(4, 9, 3, 2, '#c8b07a'); H.r(13, 9, 2, 2, '#a07a4a');
        } else if (fase <= 1) { // galera: remos y vela cuadrada
          H.r(1, 10, 18, 3, '#6b4a2b'); H.r(1, 10, 18, 1, '#9a6a3a'); H.r(2, 13, 16, 1, '#4a3020'); H.p(0, 9, '#6b4a2b'); H.p(19, 8, '#6b4a2b');
          for (let x = 3; x < 17; x += 3) { H.p(x, 13, '#8a6a42'); H.p(x - 1, 14, '#8a6a42'); }
          H.r(9, 1, 1, 9, '#3a2a1e'); H.r(5, 2, 9, 6, '#e8dcc0'); H.r(5, 4, 9, 1, col); H.r(5, 6, 9, 1, col);
        } else if (fase === 2) { // galeón de tres palos
          H.r(1, 10, 18, 4, '#5a3a22'); H.r(1, 10, 18, 1, '#8a5a2a'); H.r(14, 7, 5, 3, '#5a3a22'); H.r(1, 8, 4, 2, '#5a3a22');
          for (let x = 3; x < 17; x += 3) H.p(x, 12, '#2a1a10');
          for (const [x, h] of [[5, 7], [9, 9], [13, 7]]) { H.r(x, 10 - h, 1, h, '#3a2a1e'); H.r(x - 2, 11 - h, 5, h - 4, '#f4ecd8'); H.r(x - 2, 12 - h, 5, 1, col); }
          H.r(9, 0, 2, 1, col);
        } else { // vapor: casco de hierro, chimeneas y humo
          H.r(0, 9, 20, 5, '#2a2e38'); H.r(0, 9, 20, 1, '#4a4e58'); H.r(0, 12, 20, 1, '#a03a2a');
          H.r(4, 5, 11, 4, '#e8e8e4'); for (let x = 5; x < 14; x += 2) H.p(x, 6, CRISTAL);
          for (const x of [7, 11]) { H.r(x, 1, 2, 4, col); H.r(x, 1, 2, 1, '#1a1a1a'); }
        }
      }
      H.contorno();
      return H.lienzo();
    });
  }

  // ---------- Iconos de la interfaz (12×12 píxeles, con contorno): recursos, estaciones y secciones ----------
  const ICONOS = {
    pescado: H => { H.r(2, 5, 7, 3, '#7aa8c8'); H.r(3, 4, 5, 1, '#9ac4e0'); H.r(3, 8, 5, 1, '#5a88a8'); H.r(9, 4, 2, 1, '#5a88a8'); H.r(9, 8, 2, 1, '#5a88a8'); H.p(10, 5, '#5a88a8'); H.p(10, 7, '#5a88a8'); H.p(3, 5, '#1a1a1a'); H.r(5, 6, 3, 1, '#c8e0f0'); },
    carne: H => { H.r(3, 3, 6, 6, '#c84a3a'); H.r(4, 2, 4, 1, '#c84a3a'); H.r(4, 9, 3, 1, '#a83a2a'); H.r(4, 4, 3, 2, '#e87a6a'); H.r(8, 8, 2, 1, '#f0e8dc'); H.r(9, 9, 2, 2, '#f0e8dc'); H.p(11, 10, '#f0e8dc'); },
    leche: H => { H.r(4, 3, 4, 1, '#c8c8d0'); H.r(3, 4, 6, 7, '#f4f4f8'); H.r(3, 4, 1, 7, '#d8d8e0'); H.r(4, 6, 4, 2, '#7aa8e0'); H.r(5, 1, 2, 2, '#d8d8e0'); },
    frutos: H => { H.r(3, 5, 4, 4, '#d83a3a'); H.p(4, 6, '#f08a7a'); H.r(7, 4, 3, 3, '#8a3ac8'); H.r(6, 8, 3, 3, '#e8a83a'); H.p(5, 4, '#4a8a3a'); H.p(6, 3, '#4a8a3a'); },
    granadas: H => { H.r(3, 4, 6, 7, '#3e4a2a'); H.r(4, 3, 4, 9, '#3e4a2a'); H.r(4, 5, 4, 1, '#56643a'); H.r(4, 8, 4, 1, '#56643a'); H.r(5, 1, 2, 2, '#8a8a90'); H.r(7, 1, 3, 1, '#8a8a90'); H.p(9, 2, '#c8c8d0'); H.p(4, 4, '#6a7a48'); },
    semillas: H => { H.r(3, 3, 6, 7, '#c8a86a'); H.r(3, 3, 6, 1, '#e0c890'); H.r(4, 2, 4, 1, '#a8885a'); H.p(5, 1, '#6a4a2a'); for (const [x, y] of [[4, 6], [6, 5], [7, 7], [5, 8]]) H.p(x, y, '#7a5a2a'); H.p(8, 1, '#4a9a3a'); H.p(9, 0, '#5ab04a'); H.p(7, 0, '#5ab04a'); },
    muebles: H => { H.r(2, 2, 2, 9, '#8a5a2a'); H.r(2, 6, 7, 2, '#a8743a'); H.r(7, 8, 2, 3, '#8a5a2a'); H.r(2, 6, 7, 1, '#c89a5a'); H.r(2, 2, 2, 1, '#c89a5a'); },
    vehiculos: H => { H.r(1, 6, 10, 3, '#5a6a4a'); H.r(3, 4, 5, 2, '#6a7a5a'); H.r(8, 4, 4, 1, '#3a3a40'); H.r(1, 9, 10, 2, '#2a2a2e'); for (const x of [2, 5, 8]) H.p(x, 10, '#8a8a90'); },
    carbon: H => { H.disco(4.5, 7.5, 3.2, '#2a2a30', true); H.disco(8, 6, 3.4, '#1e1e24', true); H.disco(7, 9, 2.6, '#34343c', true); H.p(7, 4, '#6a6a76'); H.p(4, 6, '#5a5a66'); H.p(9, 8, '#5a5a66'); },
    petroleo: H => { H.r(3, 2, 7, 9, '#2a3a5a'); H.r(3, 2, 7, 1, '#4a5a7a'); H.r(3, 10, 7, 1, '#1a2a4a'); H.r(3, 5, 7, 1, '#c8402a'); H.r(5, 1, 3, 1, '#5a6a8a'); H.p(4, 3, '#7a8aaa'); },
    oro: H => { H.disco(6, 6, 5, '#f0c040', true); H.disco(6, 6, 3.4, '#e0a820'); H.r(5, 3, 2, 6, '#fff0a0'); H.r(5, 3, 1, 6, '#b07818'); },
    comida: H => { for (const [x0, x1] of [[3, 5], [6, 6], [9, 7]]) for (let y = 2; y < 11; y++) H.p(Math.round(x0 + (x1 - x0) * (y - 2) / 8), y, '#c89a30'); for (const [x, y] of [[3, 2], [2, 3], [4, 3], [6, 1], [5, 2], [7, 2], [9, 2], [8, 3], [10, 3], [3, 4], [6, 3], [9, 4]]) H.p(x, y, '#f0d070'); H.r(4, 8, 5, 1, '#8a5a2a'); },
    madera: H => { H.r(1, 4, 9, 5, '#8a5a2a'); H.r(1, 4, 9, 1, '#a8743a'); H.r(2, 6, 6, 1, '#6a4220'); H.disco(9.5, 6.5, 2.7, '#d8a868'); H.p(9, 6, '#b08048'); H.p(10, 7, '#b08048'); },
    piedra: H => { H.disco(7, 7, 4.2, '#a8a49a', true); H.disco(3.6, 8.4, 2.6, '#8a867c', true); H.p(6, 5, '#d0ccc2'); },
    metal: H => { for (let y = 5; y < 10; y++) H.r(2 + (9 - y) * 0 + (y === 5 ? 2 : y === 6 ? 1 : 0), y, 8 - (y === 5 ? 4 : y === 6 ? 2 : 0) + (y > 6 ? 1 : 0), 1, y === 5 ? '#e0e8f0' : y < 8 ? '#a8b2be' : '#7a8490'); H.r(3, 4, 4, 1, '#c8d0d8'); },
    armas: H => { for (let k = 0; k < 7; k++) { H.p(3 + k, 8 - k, '#e0e4ec'); H.p(4 + k, 8 - k, '#9aa0aa'); } H.p(10, 1, '#ffffff'); H.r(1, 8, 4, 1, '#c8a040'); H.p(3, 7, '#c8a040'); H.p(3, 9, '#c8a040'); H.r(1, 10, 2, 1, '#6a4220'); H.p(2, 9, '#6a4220'); },
    gente: H => { H.disco(6, 3.5, 2.2, '#f0c8a0'); H.r(4, 2, 4, 1, '#5a3a20'); H.r(3, 6, 6, 4, '#4a8ad0'); H.r(3, 6, 6, 1, '#6aa8e8'); H.r(4, 10, 1, 2, '#3a3a48'); H.r(7, 10, 1, 2, '#3a3a48'); },
    nivel: H => { H.r(2, 6, 8, 5, '#e8d8b4'); for (let y = 1; y < 6; y++) H.r(6 - y, y + 1, y * 2, 1, '#c84a3a'); H.r(5, 8, 2, 3, '#6a4220'); H.p(3, 7, '#4a6a9a'); H.p(8, 7, '#4a6a9a'); },
    tec: H => { H.r(5, 1, 2, 4, '#c8d8e8'); for (let y = 5; y < 11; y++) { const w = Math.min(4, y - 4); H.r(6 - w, y, w * 2, 1, y > 7 ? '#5ac8a0' : '#c8d8e8'); } H.p(4, 9, '#9af0d0'); H.r(4, 0, 4, 1, '#8a6a4a'); },
    subir: H => { for (let y = 1; y < 7; y++) H.r(6 - (y - 1), y, (y - 1) * 2 + 1, 1, '#f0c040'); H.r(4, 7, 3, 4, '#f0c040'); H.p(5, 2, '#fff0a0'); },
    primavera: H => { for (const [x, y] of [[6, 2], [3, 5], [9, 5], [4, 8], [8, 8]]) H.disco(x, y, 1.9, '#ff8ab0'); H.disco(6, 5.6, 1.6, '#ffd84a'); H.r(6, 9, 1, 3, '#4a9a3a'); },
    verano: H => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; H.p(Math.round(6 + Math.cos(a) * 5), Math.round(6 + Math.sin(a) * 5), '#ffb030'); } H.disco(6, 6, 3.3, '#ffd84a', true); },
    otono: H => { for (let y = 1; y < 10; y++) { const w = Math.round(Math.sin((y / 9) * Math.PI) * 4); H.r(6 - w, y, w * 2 + 1, 1, y < 5 ? '#f08a30' : '#d0601e'); } H.r(6, 2, 1, 9, '#8a3a1a'); H.p(6, 11, '#6a4220'); },
    invierno: H => { for (let k = -4; k <= 4; k++) { H.p(6 + k, 6, '#e8f4ff'); H.p(6, 6 + k, '#e8f4ff'); if (Math.abs(k) < 4) { H.p(6 + k, 6 + k, '#bcd8f0'); H.p(6 + k, 6 - k, '#bcd8f0'); } } H.p(6, 6, '#ffffff'); },
    noche: H => { H.disco(6, 6, 4.5, '#f0e0a0', true); H.disco(8, 4.5, 3.6, null); for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const dx = x + 0.5 - 8.2, dy = y + 0.5 - 4.4; if (dx * dx + dy * dy < 12) H.d[y * 12 + x] = null; } },
    mapa: H => { H.r(1, 2, 10, 8, '#5aa040'); H.r(1, 2, 3, 8, '#4a8ad0'); H.r(7, 2, 1, 8, '#3a7a30'); H.r(4, 2, 1, 8, '#2a6aa8'); H.p(9, 5, '#c84a3a'); H.p(8, 6, '#c84a3a'); H.p(10, 6, '#c84a3a'); H.p(9, 7, '#c84a3a'); },
    ordenes: H => { H.r(2, 9, 8, 2, '#e8dcc0'); for (let k = 0; k < 7; k++) { H.p(3 + k, 8 - k, '#f4f0e4'); H.p(4 + k, 8 - k, '#c8c0ac'); } H.p(10, 1, '#ffffff'); H.p(3, 8, '#2a2a3a'); H.p(2, 9, '#2a2a3a'); },
    pueblos: H => { H.r(1, 6, 5, 5, '#e8d8b4'); for (let y = 2; y < 6; y++) H.r(3.5 - (y - 2), y, (y - 2) * 2 + 1, 1, '#c84a3a'); H.r(6, 5, 5, 6, '#d8c8a4'); for (let y = 1; y < 5; y++) H.r(8.5 - (y - 1), y, (y - 1) * 2 + 1, 1, '#4a8ad0'); H.p(3, 9, '#6a4220'); H.p(8, 9, '#6a4220'); },
    cronica: H => { H.r(2, 2, 8, 8, '#efe2b8'); H.r(1, 1, 10, 2, '#d8c890'); H.r(1, 9, 10, 2, '#d8c890'); for (const y of [4, 6, 8]) H.r(3, y, 6, 1, '#9a8a6a'); },
    retos: H => { H.r(3, 1, 6, 5, '#f0c040'); H.r(3, 1, 2, 5, '#ffe080'); H.p(2, 2, '#f0c040'); H.p(9, 2, '#f0c040'); H.p(1, 3, '#f0c040'); H.p(10, 3, '#f0c040'); H.r(5, 6, 2, 2, '#c89020'); H.r(3, 8, 6, 2, '#8a5a2a'); },
    mas: H => { for (const x of [2, 5, 8]) H.r(x, 5, 2, 2, '#e8e0cc'); },
    arqui: H => { H.r(2, 9, 8, 2, '#a8a49a'); H.r(4, 6, 4, 3, '#c8a878'); H.r(3, 2, 1, 7, '#7a5530'); H.r(8, 2, 1, 7, '#7a5530'); H.r(3, 4, 6, 1, '#7a5530'); H.r(9, 1, 1, 4, '#f0c040'); H.r(9, 1, 3, 1, '#f0c040'); }
  };
  function icono(nombre) {
    return guardado('ico' + nombre, () => { const H = hoja(12, 12); (ICONOS[nombre] || ICONOS.mas)(H); H.contorno(0.75); return H.lienzo(); });
  }
  const iconoURL = nombre => guardado('icourl' + nombre, () => icono(nombre).toDataURL());
  M.arte = { tiradorEnPose, BOCA, T, icono, iconoURL, ICONOS, piedraPlaza, pico, barco, vehiculo: (t, c, p) => conId(vehiculo(t, c, p)), avion, aldeano: o => conId(aldeano(o)), tenido, suelo, adorno, arbol, roca, campo, casa, edificio, plaza, mezcla, oscuro, claro, hoja, HIERBA };
})(globalThis.RF = globalThis.RF || {});
