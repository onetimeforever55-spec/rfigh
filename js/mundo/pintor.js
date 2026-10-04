/*
 * GÉNESIS · EL PINTOR
 * Dibuja el mundo como un juego de píxeles visto desde arriba: cada parcela de 8×8 píxeles con su suelo,
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
  const A = 8, E = 2, P = A * E;

  // ---------- Sprites: cada letra es un color; el punto, transparente ----------
  const PALETA = {
    g: '#2f6b34', G: '#3f8a3e', h: '#6cb85a', t: '#6b4a2b', p: '#1f5a3a', P: '#2e7a4a', n: '#f4f8fb', c: '#4f9a4a', C: '#7cc36a',
    r: '#5e5e68', R: '#8a8a96', H: '#b9b9c4', s: '#8f8a80', S: '#b7b0a2', w: '#e3d3b0', W: '#c2ad86', d: '#5a3a22', k: '#2a3550',
    b: '#7a5232', J: '#24702f', j: '#1a5a25', a: '#7d8a2e', A: '#9aa83a', u: '#6f7d5a', U: '#8a9a6e', e: '#4d7a3a', E: '#6a9a48', y: '#f0c05a', m: '#9aa1ad', M: '#c6ccd6', o: '#6d6f78', l: '#ffe9a6', f: '#e0a040'
  };
  const SPRITES = {
    roble3: ['..gGGg..', '.gGGhGg.', 'gGGhGGGg', 'gGGGGGhg', 'ggGGGGgg', '.gggggg.', '...tt...', '...tt...'],
    pino3: ['...pp...', '..pPPp..', '..pPPp..', '.pPPPPp.', '.pPPPPp.', 'pPPPPPPp', '...tt...', '...tt...'],
    nevado3: ['...nn...', '..pnPp..', '..pPPp..', '.nPPnPp.', '.pPPPPp.', 'nPPPPPnp', '...tt...', '...tt...'],
    arbol2: ['........', '........', '...gg...', '..gGhg..', '..gGGg..', '...gg...', '...t....', '...t....'],
    arbol1: ['........', '........', '........', '........', '...g....', '..gGg...', '...t....', '........'],
    palmera: ['.hG..Gh.', 'GGGhGGGG', 'G.GttG.G', '...tt...', '...t....', '....t...', '....t...', '...tt...'],
    jungla3: ['.JJjJJ..', 'JjJJJjJ.', 'JJJhJJJJ', 'jJJJJJjJ', '.JjJJJJ.', '..JttJ..', '...tt...', '...tt...'],
    acacia: ['........', '.aAAAAa.', 'aAAhAAAa', '..ttt...', '....t...', '...t....', '...t....', '........'],
    sauce: ['..eEEe..', '.eEhEEe.', 'eEeEEeEe', 'e.ettE.e', 'e..tt..e', '...tt...', '........', '........'],
    matorral: ['........', '........', '........', '...uu...', '..uUuu..', '.uUUuUu.', '..uuuu..', '........'],
    cactus: ['........', '...c....', '.c.cC...', '.ccc.c..', '...ccC..', '...c....', '...c....', '........'],
    roca3: ['........', '..rRR...', '.rRHRRr.', 'rRHRRRRr', 'rRRRRRRr', '.rrrrrr.', '........', '........'],
    roca2: ['........', '........', '...rR...', '..rHRr..', '.rRRRRr.', '..rrrr..', '........', '........'],
    roca1: ['........', '........', '........', '...rR...', '..rRRr..', '...rr...', '........', '........'],
    ayuntamiento: ['...yy...', '...XX...', '..XXXX..', '.XXXXXX.', 'xXXXXXXx', '.wkwwkw.', '.wwddww.', '.wwddww.'],
    torre: ['.s.s.s..', '.sssss..', '..sks...', '..sSs...', '..sks...', '..sSs...', '.sssss..', '.sSdSs..'],
    templo: ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.wSwSwS.', '.wSwSwS.', '.wSwdwS.', 'SSSSSSSS'],
    molino: ['........', '........', '...XX...', '..XXXX..', '..wwww..', '..wkww..', '..wwdw..', '..wwww..'],
    puerto: ['........', '........', 'bbbbbbbb', 'tbtbtbtb', 'bbbbbbbb', '.t...t..', '.t...t..', '........'],
    ruina: ['........', '........', '.s...S..', '.S..sS..', '.sS.sS..', 'sSsSs.s.', '........', '........'],
    choza: ['...XX...', '..XXXX..', '.XXxxXX.', 'XXXXXXXX', '.wwwwww.', '.wwddww.', '.wwddww.', '........'],
    casa: ['........', '..XXXX..', '.XXXXXX.', 'xXXXXXXx', '.wwwwww.', '.wkwwdw.', '.wwwwdw.', '........'],
    entramado: ['..XXXX..', '.XXXXXX.', 'xXXXXXXx', '.wbwwbw.', '.wkwbkw.', '.wbwwbw.', '.wkwdbw.', '........'],
    bloque: ['.xxxxxx.', '.MkMkMk.', '.MMMMMM.', '.MkMkMk.', '.MMMMMM.', '.MkMdMk.', '.MMMMMM.', '........'],
    centro0: ['................', '................', '.......XX.......', '......XXXX......', '.....XXXXXX.....', '....XXXXXXXX....', '...XXXXxxXXXX...', '..XXXXXXXXXXXX..', '.XXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXX', '.wwwwwwwwwwwwww.', '.wwwwwwddwwwwww.', '.wkwwwwddwwwwkw.', '.wwwwwwddwwwwww.', '................', '................'],
    centro1: ['s.s.........s.s.', 'sss.........sss.', 'sSs..s.s.s..sSs.', 'sss..sssss..sss.', 'sSs..sSSSs..sSs.', 'ssssssssssssssss', 'sSSSSSSSSSSSSSSs', 'sSkSSSSSSSSSSkSs', 'sSSSSSSSSSSSSSSs', 'sSSSSSXXXXSSSSSs', 'sSSSSXXXXXXSSSSs', 'sSSSSSddddSSSSSs', 'sSkSSSddddSSSkSs', 'sSSSSSddddSSSSSs', 'ssssssddddssssss', '................'],
    centro2: ['.......yy.......', '......XXXX......', '.....XXXXXX.....', '.....XXXXXX.....', '..XX.wwwwww.XX..', '.XXXXwkwwkwXXXX.', '.wwwwwwwwwwwwww.', '.wkwkwkwwkwkwkw.', '.wwwwwwwwwwwwww.', '.wkwkwkwwkwkwkw.', '.wwwwwwwwwwwwww.', '.wkwkwwddwwkwkw.', '.wwwwwwddwwwwww.', 'wwwwwwwddwwwwwww', 'SSSSSSSSSSSSSSSS', '................'],
    centro3: ['....MM..........', '...MMMM.....MM..', '...MkMM....MMMM.', '...MMMM....MkkM.', '...MkMM....MMMM.', '.MMMMMM....MkkM.', '.MkMkMMMM..MMMM.', '.MMMMMMMMM.MkkM.', '.MkMkMkMkM.MMMM.', '.MMMMMMMMMMMMMMM', '.MkMkMkMkMkMkkMM', '.MMMMMMMMMMMMMMM', '.MkMkMkddMkMkkMM', '.MMMMMMMdMMMMMMM', 'oooooooooooooooo', '................']
  };
  const cacheSprites = {};
  function sprite(nombre, tejado) {
    const clave = nombre + (tejado || '');
    if (cacheSprites[clave]) return cacheSprites[clave];
    const filas = SPRITES[nombre], w = filas[0].length, h = filas.length;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const pal = Object.assign({}, PALETA, tejado ? { X: tejado, x: mezclar(tejado, '#000000', 0.35) } : { X: '#b5763a', x: '#8a5426' });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = (filas[y][x] || '.'); if (ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }
    return (cacheSprites[clave] = c);
  }
  function mezclar(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = k => Math.round(((pa >> k) & 255) * (1 - t) + ((pb >> k) & 255) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }

  // El suelo: un color base con motas, en cuatro variantes para que no se vea la cuadrícula.
  const SUELO = {
    llanura: ['#6fa34f', '#7fb35a', '#5f9444'], bosque: ['#4f8a3f', '#5d9a49', '#437a36'], colina: ['#9c9a5c', '#aeab6a', '#87864e'],
    montana: ['#85838c', '#a3a1aa', '#6c6a73'], desierto: ['#dcc48a', '#e8d49c', '#c9ae74'], nieve: ['#e9eef2', '#ffffff', '#cfd8e0'],
    arena: ['#e6d29a', '#f1e0ac', '#d4bd82'], selva: ['#3d8a38', '#4c9c44', '#2f7a2e'], sabana: ['#b9b25c', '#c9c26c', '#a49d4c'],
    pantano: ['#4d6b47', '#5b7b52', '#3f5a3b'], taiga: ['#4e7458', '#5c8466', '#41654b'], tundra: ['#9ba596', '#adb6a8', '#8a9485'], agua: ['#1d4a82', '#24578f', '#183f72'], bajo: ['#2d6aa6', '#3a7bb8', '#255d94'], rio: ['#3d86d0', '#5a9de0', '#3377bf']
  };
  const cacheSuelo = {};
  function suelo(tipo, variante) {
    const clave = tipo + variante;
    if (cacheSuelo[clave]) return cacheSuelo[clave];
    const [base, claro, oscuro] = SUELO[tipo] || SUELO.llanura;
    const c = document.createElement('canvas'); c.width = A; c.height = A;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, A, A);
    let s = (variante + 1) * 2654435761 + tipo.length * 97;
    const r = () => { s = (Math.imul(s ^ (s >>> 13), 1274126177) + 0x9E3779B9) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 7; k++) { g.fillStyle = r() < 0.5 ? claro : oscuro; g.fillRect(Math.floor(r() * A), Math.floor(r() * A), 1, 1); }
    if (tipo === 'agua' || tipo === 'bajo') { g.fillStyle = claro; const y = Math.floor(r() * 6) + 1, x = Math.floor(r() * 5); g.fillRect(x, y, 3, 1); }
    if (tipo === 'pantano') { g.fillStyle = '#2f5a5a'; g.fillRect(1 + Math.floor(r() * 3), 2 + Math.floor(r() * 3), 3, 2); g.fillStyle = '#4f8080'; g.fillRect(2, 3, 1, 1); }
    if (tipo === 'tundra') { g.fillStyle = '#e9eef2'; g.fillRect(Math.floor(r() * 6), Math.floor(r() * 6), 2, 1); }
    if (tipo === 'montana' && variante < 2) {
      // Roca con grietas: no todas las parcelas tienen pico, así la cordillera no parece una cuadrícula.
      g.fillStyle = '#6c6a73'; g.fillRect(1 + variante * 3, 2, 1, 3); g.fillRect(2 + variante * 3, 5, 2, 1);
      g.fillStyle = '#a3a1aa'; g.fillRect(5 - variante * 3, 1, 2, 1);
    } else if (tipo === 'montana') {
      // Un pico con la cumbre nevada en cada parcela de montaña.
      const pico = variante % 2 ? ['....n...', '...nRr..', '..RRHRr.', '.RRRRHRr', 'RRrRRRRr', 'rRRRrRRr', 'rrRRRRrr', 'rrrrrrrr'] : ['...n....', '..nRr...', '.RHRRr..', '.RRHRRr.', 'RRRRRRrr', 'rRrRRRRr', 'rrRRrRrr', 'rrrrrrrr'];
      const col = { n: '#f4f8fb', R: '#8a8a96', H: '#b9b9c4', r: '#5e5e68' };
      for (let yy = 0; yy < A; yy++) for (let xx = 0; xx < A; xx++) { const ch = pico[yy][xx]; if (ch !== '.') { g.fillStyle = col[ch]; g.fillRect(xx, yy, 1, 1); } }
    }
    return (cacheSuelo[clave] = c);
  }

  const grupoEra = era => (era <= 1 ? 0 : era <= 4 ? 1 : era <= 6 ? 2 : 3);
  const CASAS = ['choza', 'casa', 'entramado', 'bloque'];

  // ---------- Estado ----------
  let cv = null, g = null, m = null, V = null, S = null, alClicar = null, alClicarAldeano = null;
  // Dónde se dibujó cada aldeano en el último fotograma (para tocarlo y para seguirlo con la cámara).
  const dibujados = new Map();
  let siguiendo = null, elegido = null;
  let lienzo = null, gl = null, capa = null, gc = null;
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
    m = nuevo;
    if (!m.vida) V.crear(m);
    const v = m.vida;
    lienzo = document.createElement('canvas'); lienzo.width = v.tw * A; lienzo.height = v.th * A; gl = lienzo.getContext('2d');
    capa = document.createElement('canvas'); capa.width = lienzo.width; capa.height = lienzo.height; gc = capa.getContext('2d');
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
    const v = m.vida, x = (t % v.tw) * A, y = Math.floor(t / v.tw) * A, ter = tierra[t];
    gl.drawImage(suelo(ter, ((t * 2654435761) >>> 0) % 4), x, y);
    if (visto.camino && visto.camino[t]) caminoEn(t, x, y, ter);
    const obra = visto.obra[t];
    if (obra) {
      const r = V.region(m, t), c = m.dueno[r] >= 0 ? S.civ(m, m.dueno[r]) : null;
      const color = c ? c.color : '#9a7a5a', ge = c ? grupoEra(c.era) : 0;
      if (obra === V.OBRA.campo) campo(x, y, t);
      else if (obra === V.OBRA.casa) {
        // Cada casa un poco distinta: unas en espejo y con el tejado algo más oscuro.
        const h = (Math.imul(t, 2246822519) >>> 0) % 4;
        const img = sprite(CASAS[ge], h === 3 ? mezclar(color, '#000000', 0.18) : h === 2 ? mezclar(color, '#ffffff', 0.12) : color);
        // Y algunas un píxel más abajo (la última fila del dibujo está vacía): las filas dejan de ser rectas.
        const oy = ((Math.imul(t, 2654435761) >>> 0) >> 5) % 2;
        if (h % 2) { gl.save(); gl.translate(x + A, y + oy); gl.scale(-1, 1); gl.drawImage(img, 0, 0); gl.restore(); } else gl.drawImage(img, x, y + oy);
      }
      else if (obra === V.OBRA.ruina) gl.drawImage(sprite('ruina'), x, y);
      else if (obra === V.OBRA.ayuntamiento) gl.drawImage(sprite('ayuntamiento', color), x, y);
      else if (obra === V.OBRA.torre) gl.drawImage(sprite('torre'), x, y);
      else if (obra === V.OBRA.templo) gl.drawImage(sprite('templo', '#e8e0c8'), x, y);
      else if (obra === V.OBRA.molino) gl.drawImage(sprite('molino', color), x, y);
      else if (obra === V.OBRA.puerto) gl.drawImage(sprite('puerto'), x, y);
      else if (obra === V.OBRA.centro) {
        // La plaza ocupa 2×2 parcelas: cada una pinta su cuarto del edificio grande.
        const lx = (t % v.tw) % V.SUB - 1, ly = Math.floor(t / v.tw) % V.SUB - 1;
        if (lx >= 0 && ly >= 0 && lx < 2 && ly < 2) gl.drawImage(sprite('centro' + ge, color), lx * A, ly * A, A, A, x, y, A, A);
        else gl.drawImage(sprite('ruina'), x, y);
      }
      return;
    }
    if (visto.roca[t]) {
      gl.drawImage(sprite('roca' + Math.min(3, visto.roca[t])), x, y);
      // Las vetas: motas rojizas de hierro o doradas de oro sobre la roca.
      const mena = m.vida.mena && m.vida.mena[t];
      if (mena) { gl.fillStyle = mena === 2 ? '#ffd23a' : '#c8643a'; gl.fillRect(x + 3, y + 3, 1, 1); gl.fillRect(x + 5, y + 4, 1, 1); if (visto.roca[t] > 1) gl.fillRect(x + 2, y + 4, 1, 1); }
      return;
    }
    const a = visto.arbol[t];
    if (a) {
      const tipo = m.tipo[V.region(m, t)];
      const variante = (t * 7) % 5;
      const maduro = {
        desierto: 'cactus', nieve: 'nevado3', taiga: variante === 0 ? 'nevado3' : 'pino3', tundra: 'matorral', colina: 'pino3',
        selva: variante < 2 ? 'palmera' : 'jungla3', sabana: 'acacia', pantano: 'sauce', bosque: variante === 0 ? 'pino3' : 'roble3'
      }[tipo] || (variante === 0 ? 'pino3' : 'roble3');
      const nombre = a === 1 ? (tipo === 'tundra' ? 'matorral' : 'arbol1') : a === 2 ? (tipo === 'desierto' ? 'cactus' : tipo === 'tundra' ? 'matorral' : 'arbol2') : maduro;
      gl.drawImage(sprite(nombre), x, y);
    }
  }
  // Un tramo de camino: tierra al principio, empedrado desde la Antigüedad, asfalto en la era moderna,
  // y puente de tablas sobre los ríos. Se une con los tramos vecinos y con las plazas.
  function caminoEn(t, x, y, ter) {
    const v = m.vida, tw = v.tw, c = m.dueno[V.region(m, t)] >= 0 ? S.civ(m, m.dueno[V.region(m, t)]) : null, era = c ? c.era : 0;
    const une = n => n >= 0 && n < tw * v.th && (visto.camino[n] || visto.obra[n] === V.OBRA.centro || visto.obra[n] === V.OBRA.ayuntamiento);
    const tx = t % tw;
    const lados = [[tx > 0 && une(t - 1), 0, 2, 2, 4], [tx < tw - 1 && une(t + 1), 6, 2, 2, 4], [une(t - tw), 2, 0, 4, 2], [une(t + tw), 2, 6, 4, 2]];
    if (ter === 'rio') {
      gl.fillStyle = '#7a5232'; gl.fillRect(x, y + 1, A, 6); gl.fillStyle = '#5a3a22'; for (let k = 1; k < A; k += 2) gl.fillRect(x + k, y + 1, 1, 6);
      gl.fillStyle = '#3a2a1e'; gl.fillRect(x, y + 1, A, 1); gl.fillRect(x, y + 6, A, 1);
      return;
    }
    const [base, borde, marca] = era >= 7 ? ['#55585f', '#3f4248', '#e8d070'] : era >= 3 ? ['#b9ad94', '#948a74', '#d4cab2'] : ['#a7855a', '#8a6a42', '#b8966a'];
    gl.fillStyle = borde; gl.fillRect(x + 1, y + 1, 6, 6);
    for (const [si, lx, ly, w, h] of lados) if (si) gl.fillRect(x + lx, y + ly, w, h);
    gl.fillStyle = base; gl.fillRect(x + 2, y + 2, 4, 4);
    for (const [si, lx, ly, w, h] of lados) if (si) gl.fillRect(x + lx + (w === 2 ? 0 : 0), y + ly, w, h);
    gl.fillStyle = marca;
    if (era >= 7) { if (lados[0][0] || lados[1][0]) gl.fillRect(x + 1, y + 4, 2, 1); if (lados[2][0] || lados[3][0]) gl.fillRect(x + 4, y + 1, 1, 2); }
    else { gl.fillRect(x + 3, y + 3, 1, 1); gl.fillRect(x + 5, y + 4, 1, 1); if (era >= 3) gl.fillRect(x + 2, y + 5, 1, 1); }
  }
  function vecinasCamino(t) {
    const tw = m.vida.tw;
    for (const n of [t - 1, t + 1, t - tw, t + tw]) if (n >= 0 && n < tw * m.vida.th && visto.camino[n]) parcela(n);
  }

  // El campo según cómo va el trigo: tierra arada, brotes, verde y dorado (listo para segar).
  function campo(x, y, t) {
    const fase = (visto.cultivo && visto.cultivo[t]) || 0;
    gl.fillStyle = '#86653a'; gl.fillRect(x, y, A, A);
    gl.fillStyle = '#6e5230';
    for (let k = 1; k < A; k += 2) gl.fillRect(x, y + k, A, 1);
    if (fase >= 1) {
      gl.fillStyle = fase === 1 ? '#8fc35a' : fase === 2 ? '#5f9e3a' : '#e0c050';
      for (let k = 0; k < A; k += 2) for (let j = (k / 2) % 2; j < A; j += 2) gl.fillRect(x + j, y + k - (fase >= 2 ? 1 : 0), 1, fase >= 2 ? 2 : 1);
      if (fase === 3) { gl.fillStyle = '#f4dc7a'; for (let k = 0; k < A; k += 4) gl.fillRect(x + ((k + t) % 5), y + k, 1, 1); }
    }
    gl.fillStyle = 'rgba(0,0,0,0.18)'; gl.fillRect(x, y + A - 1, A, 1);
  }

  // El color de cada pueblo sobre su tierra y las fronteras (rojas donde hay guerra).
  // El territorio que se ve rodea lo construido (casas, campos, caminos, plazas), como las zonas de WorldBox:
  // crece parcela a parcela según se levanta el pueblo, aunque el reino reclame regiones enteras.
  function territorio() {
    const v = m.vida, tw = v.tw, n = tw * v.th, RADIO = 3;
    gc.clearRect(0, 0, capa.width, capa.height);
    const color = {}; for (const c of m.civs) color[c.id] = c.color;
    const guerra = new Set(); for (const c of S.vivas(m)) for (const x of c.guerras) guerra.add(Math.min(c.id, x.con) + ':' + Math.max(c.id, x.con));
    const zona = new Int16Array(n).fill(-1), dist = new Uint8Array(n).fill(255), cola = [];
    for (let t = 0; t < n; t++) {
      const d = m.dueno[V.region(m, t)];
      if (d < 0) continue;
      const o = visto.obra[t];
      if ((o && o !== V.OBRA.ruina) || (visto.camino && visto.camino[t])) { zona[t] = d; dist[t] = 0; cola.push(t); }
    }
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], d = zona[t], x = t % tw;
      if (dist[t] >= RADIO) continue;
      for (const nb of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) {
        if (nb < 0 || nb >= n || zona[nb] >= 0 || m.dueno[V.region(m, nb)] !== d) continue;
        const tr = tierra[nb];
        if (tr === 'agua' || tr === 'bajo') continue;
        zona[nb] = d; dist[nb] = dist[t] + 1; cola.push(nb);
      }
    }
    for (let t = 0; t < n; t++) {
      const d = zona[t];
      if (d < 0 || !color[d]) continue;
      const x = (t % tw) * A, y = Math.floor(t / tw) * A;
      gc.globalAlpha = sel == null ? 0.18 : sel === d ? 0.24 : 0.1;
      gc.fillStyle = color[d]; gc.fillRect(x, y, A, A);
      gc.globalAlpha = 1;
      const tx = t % tw;
      const lados = [[tx > 0 ? t - 1 : -1, x, y, 1, A], [tx < tw - 1 ? t + 1 : -1, x + A - 1, y, 1, A], [t - tw, x, y, A, 1], [t + tw < n ? t + tw : -1, x, y + A - 1, A, 1]];
      for (const [o, rx, ry, rw, rh] of lados) {
        const od = o >= 0 ? zona[o] : -2;
        if (od === d) continue;
        const enGuerra = od >= 0 && guerra.has(Math.min(d, od) + ':' + Math.max(d, od));
        gc.fillStyle = enGuerra ? '#ff4b3a' : sel === d ? '#fff6dc' : color[d];
        gc.globalAlpha = enGuerra || sel === d ? 1 : 0.9;
        gc.fillRect(rx, ry, rw, rh);
        gc.globalAlpha = 1;
      }
    }
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
    territorio();
    inicio = performance.now(); duracion = Math.max(80, ms || 1000);
    recogerMuertos(duracion);
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
    g.drawImage(capa, x0 / E, y0 / E, (x1 - x0) / E, (y1 - y0) / E, x0, y0, x1 - x0, y1 - y0);
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
    marcarPulso(ahora);
    noche(ahora, x0, y0, x1, y1, z, ox, oy);
    g.setTransform(1, 0, 0, 1, 0, 0);
    nombres(z, ox, oy, dpr);
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
      if (elegido === a.id) { const f2 = Math.floor(performance.now() / 300) % 2; g.fillStyle = '#ffd23a'; g.fillRect(px, py - 5 - f2, 3, 1); g.fillRect(px + 1, py - 4 - f2, 1, 1); g.strokeStyle = 'rgba(255,210,58,0.8)'; g.lineWidth = 0.6; g.strokeRect(px - 2.5, py - 1.5, 8, 9); }
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
      // Los niños: más pequeños, sin herramienta, corretean cerca de casa.
      if ((a.edad || 0) < V.ADULTO) {
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px, py + 5, 3, 1);
        g.fillStyle = '#3a2a1e'; g.fillRect(px + (anda && t ? 1 : 0), py + 4, 1, 1); g.fillRect(px + 2, py + 4, 1, 1);
        g.fillStyle = color[a.c] || '#cccccc'; g.fillRect(px, py + 3, 3, 1);
        g.fillStyle = '#f0c8a0'; g.fillRect(px + 1, py + 2, 1, 1);
        continue;
      }
      // Piernas, cuerpo y cabeza.
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px - 1, py + 5, 5, 1);
      g.fillStyle = '#3a2a1e';
      if (anda && t) { g.fillRect(px, py + 3, 1, 2); g.fillRect(px + 2, py + 3, 1, 1); } else { g.fillRect(px, py + 3, 1, 2); g.fillRect(px + 2, py + 3, 1, 2); }
      g.fillStyle = color[a.c] || '#cccccc'; g.fillRect(px, py + 1, 3, 2);
      const oficio = V.OFICIOS[a.o];
      g.fillStyle = oficio === 'guerrero' ? '#9aa0aa' : oficio === 'granjero' ? '#e2c25a' : '#f0c8a0';
      g.fillRect(px + 1, py, 1, 1);
      // Los ancianos, con el pelo blanco.
      if ((a.edad || 0) >= V.VIEJO && oficio !== 'guerrero') { g.fillStyle = '#e8e8ec'; g.fillRect(px + 1, py, 1, 1); g.fillRect(px, py, 1, 1); }
      // La herramienta: arriba y abajo cuando trabaja.
      const alto = acc === 1 || acc === 2 ? (t ? -1 : 1) : 0;
      if (acc === 3) { g.fillStyle = oficio === 'minero' ? '#a3a1aa' : '#8a5a2b'; g.fillRect(px - 1, py - 1, 5, 1); }
      else if (oficio === 'comerciante') {
        // La carreta va detrás del comerciante, según hacia dónde camina.
        const i = paso * 3, j = r ? Math.min(r.length - 3, i + 3) : 0;
        const dirX = r && r.length >= 6 ? Math.sign(r[j] - r[i]) : 0, dirY = r && r.length >= 6 ? Math.sign(r[j + 1] - r[i + 1]) : 0;
        const cx = px - (dirX || (dirY ? 0 : 1)) * 6 - 1, cy = py + 1 - dirY * 5;
        g.fillStyle = '#3a2a1e'; g.fillRect(cx + 1, cy + 4, 1, 1); g.fillRect(cx + 4, cy + 4, 1, 1);
        g.fillStyle = '#8a5a2b'; g.fillRect(cx, cy + 1, 6, 3);
        g.fillStyle = '#e0c050'; g.fillRect(cx + 1, cy, 2, 1); g.fillStyle = '#c84a3a'; g.fillRect(cx + 3, cy, 1, 1); g.fillStyle = '#4a8ad0'; g.fillRect(cx + 4, cy, 1, 1);
        g.fillStyle = '#6b4a2b'; g.fillRect(cx + (dirX > 0 ? 6 : -1), cy + 2, 1, 1);
        g.fillStyle = '#7a3a1a'; g.fillRect(px, py - 1, 3, 1);
      }
      else if (oficio === 'lenador') { g.fillStyle = '#7a5232'; g.fillRect(px + 3, py + alto, 1, 3); g.fillStyle = '#c8ccd6'; g.fillRect(px + 3, py + alto, 2, 1); }
      else if (oficio === 'minero') { g.fillStyle = '#7a5232'; g.fillRect(px + 3, py + 1 + alto, 1, 2); g.fillStyle = '#a3a1aa'; g.fillRect(px + 2, py + alto, 3, 1); }
      else if (oficio === 'granjero') { g.fillStyle = '#7a5232'; g.fillRect(px + 3, py + alto, 1, 4); g.fillStyle = '#9aa0aa'; g.fillRect(px + 3, py + 3 + alto, 2, 1); }
      else if (oficio === 'constructor') { g.fillStyle = '#7a5232'; g.fillRect(px + 3, py + 1 + alto, 1, 2); g.fillStyle = '#5e5e68'; g.fillRect(px + 3, py + alto, 2, 1); }
      else if (oficio === 'guerrero') {
        // Cada clase de soldado se reconoce: espadachín con escudo, lancero, arquero con capucha y arco,
        // tirador con arcabuz o fusil. El capitán lleva el estandarte.
        const arma = a.arma || 0, col = color[a.c] || '#ccc';
        // La armadura, del color de su material: cuero, bronce, hierro, acero.
        if (a.armadura) { g.fillStyle = ['#a3a9b5', '#8a5a32', '#c89a3a', '#8a909c', '#cfd6e2', '#b8c0cc', '#6a7a5a'][a.armadura] || '#a3a9b5'; g.fillRect(px, py + 1, 3, 2); g.fillStyle = col; g.fillRect(px + 1, py + 2, 1, 1); }
        if (a.tirador && arma >= 5) {
          g.fillStyle = arma >= 7 ? '#5a6a4a' : '#2a2a3a'; g.fillRect(px, py - 1, 3, 1);
          g.fillStyle = '#3a2a1e'; g.fillRect(px + 2, py + 2, 2, 1); g.fillRect(px + 4, py + 1, 2, 1); g.fillRect(px + 6, py, 1, 1);
          g.fillStyle = '#9aa0aa'; g.fillRect(px + 7, py - 1, 1, 1);
        } else if (a.tirador && arma >= 1) {
          g.fillStyle = '#4a7a3a'; g.fillRect(px, py - 1, 3, 1); g.fillRect(px + 1, py - 2, 1, 1);
          g.fillStyle = '#7a5232'; g.fillRect(px - 1, py, 1, 3);
          g.fillStyle = '#8a5a2b'; g.fillRect(px + 4, py - 1, 1, 1); g.fillRect(px + 5, py, 1, 3); g.fillRect(px + 4, py + 3, 1, 1);
          g.fillStyle = '#e8e0c8'; g.fillRect(px + 4, py, 1, 3);
          if (acc === 2) { g.fillStyle = '#6b4a2b'; g.fillRect(px + 3, py + 1, 3, 1); }
        } else if (arma === 0) {
          g.fillStyle = '#6b4a2b'; g.fillRect(px + 3, py - 1 + alto, 1, 4); g.fillRect(px + 3, py - 2 + alto, 2, 2);
        } else if (arma === 1) {
          g.fillStyle = '#7a5232'; g.fillRect(px + 3, py - 4 + alto, 1, 9);
          g.fillStyle = '#d8b060'; g.fillRect(px + 3, py - 6 + alto, 1, 2);
        } else {
          g.fillStyle = '#8a8f9a'; g.fillRect(px, py - 1, 3, 1); g.fillStyle = col; g.fillRect(px + 1, py - 2, 1, 1);
          g.fillStyle = '#eef1f6'; g.fillRect(px + 4, py - 3 + alto, 1, 5); g.fillStyle = '#c8a050'; g.fillRect(px + 3, py + 1 + alto, 3, 1);
          g.fillStyle = col; g.fillRect(px - 3, py, 2, 4); g.fillStyle = '#f4ecd8'; g.fillRect(px - 3, py + 1, 1, 1);
        }
        const ej = m.vida.ejercitos && m.vida.ejercitos[a.c];
        if (ej && ej.capitan === a.id) { g.fillStyle = '#3a2a1e'; g.fillRect(px - 1, py - 9, 1, 10); g.fillStyle = col; g.fillRect(px, py - 9, 6, 4); g.fillStyle = '#fff6dc'; g.fillRect(px + 2, py - 8, 2, 2); }
      }
      if (acc === 2 && !(a.tirador)) { const ch = Math.floor(ahora / 90 + a.id) % 4; g.fillStyle = ch % 2 ? '#fff6a0' : '#ffd23a'; g.fillRect(px + 4 + ch, py - 1 - (ch % 2), 1, 1); g.fillRect(px + 5, py + 1 + (ch % 3) - 1, 1, 1); if (ch === 0) { g.fillStyle = '#ffffff'; g.fillRect(px + 4, py, 2, 1); } }
      else if (acc === 2 && t) { g.fillStyle = '#ff4b3a'; g.fillRect(px + 4, py - 1, 1, 1); }
      if (recibe) {
        const [gp, d] = recibe;
        // Destello: rojo al recibir, luego un parpadeo blanco; y unas gotas de sangre que saltan y caen.
        g.globalAlpha = d < 0.45 ? 0.9 : d < 0.7 ? 0.65 : 0.35; silueta(px, py, d < 0.45 ? '#ff2a2a' : '#ffffff'); g.globalAlpha = 1;
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
          g.fillStyle = 'rgba(40,10,10,0.7)'; g.fillRect(px - 1, py - 3, ancho, 1);
          g.fillStyle = fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030'; g.fillRect(px - 1, py - 3, Math.max(1, Math.round(ancho * fr)), 1);
        }
      }
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
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const t = ty * v.tw + tx, o = visto.obra[t]; if (o === V.OBRA.molino || o === V.OBRA.torre) especiales.push(t); }
    }
    const fase = ahora / 400;
    for (const t of especiales) {
      const x = (t % v.tw) * P, y = Math.floor(t / v.tw) * P, o = visto.obra[t];
      if (o === V.OBRA.molino) {
        // Cuatro aspas que giran.
        const cx = x + 8, cy = y + 6;
        for (let k = 0; k < 4; k++) { const ang = fase + k * Math.PI / 2; for (let d = 1; d <= 8; d++) { g.fillStyle = d > 3 ? '#f0e6cc' : '#7a5232'; g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), d > 3 ? 2 : 1, d > 3 ? 2 : 1); } }
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 1, cy - 1, 2, 2);
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

  // Flechas y balas: vuelan durante el paso en que se dispararon.
  function pintarDisparos(k) {
    const lista = m.vida.disparos || [];
    for (const [x1, y1, x2, y2, paso, bala] of lista) {
      const f = k - (paso - 1);
      if (f < 0 || f > 1) continue;
      const ax = x1 * P + 8, ay = y1 * P + 7, bx = x2 * P + 8, by = y2 * P + 7;
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
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 2, y + 5, 7, 1);
          g.fillStyle = t < 300 ? '#ff4b4b' : col; g.fillRect(x - 1, y + 3, 4, 2);
          g.fillStyle = '#f0c8a0'; g.fillRect(x + 3, y + 3, 1, 1);
          g.fillStyle = '#3a2a1e'; g.fillRect(x - 2, y + 4, 1, 1);
          g.fillStyle = '#9a1414'; g.fillRect(x, y + 5, 3, 1);
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

  M.pintor = { P, elegirAldeano, seguir, siguiendoA, iniciar, mundo, turno, refrescar, seleccionar, marcar, centrarEn, zoom, verTodo, efecto, SPRITES };
})(globalThis.RF = globalThis.RF || {});
