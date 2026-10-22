  /*
   * GÉNESIS · EL ARTE
   * Los dibujos del mundo a 16×16 píxeles por parcela (32×32 las plazas), hechos con código: suelos con textura,
   * flores y adornos, árboles de cada bioma, rocas, campos, caminos y los edificios de cada era con el tejado del
   * color de su pueblo. Todo lleva sombreado (luz arriba a la izquierda) y un contorno oscuro, como WorldBox.
   * Cada dibujo se hace una vez y se guarda.
   */
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
