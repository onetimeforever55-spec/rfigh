/*
 * GÉNESIS · EL DIBUJO CON LA TARJETA GRÁFICA (WebGL)
 * Un contexto que se comporta como el 2D del navegador (fillRect, drawImage, caminos, textos, transformaciones)
 * pero lo manda todo a la tarjeta gráfica en lotes: miles de rectángulos y sprites en unas pocas llamadas, en vez
 * de una por cada uno. El pintor no cambia: dibuja igual que antes, sobre este contexto.
 *
 *  · Los sprites pequeños (aldeanos, árboles, casas…) se suben una vez a un atlas: varias texturas grandes con
 *    muchos dibujos dentro, así casi todo se dibuja sin cambiar de textura.
 *  · Los lienzos grandes (el suelo con las obras, la capa de territorio) se trocean en texturas de 2048 y solo se
 *    vuelven a subir los trozos que el pintor marca como cambiados (sucio()).
 *  · Los caminos (círculos, elipses, líneas, curvas) se convierten en triángulos; los textos se rasterizan una vez
 *    y se guardan; los degradados radiales (luces, fuego) se dibujan como anillos de colores.
 * Si el aparato no tiene WebGL, crear() devuelve null y el pintor sigue con el contexto 2D de siempre.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO = RF.MUNDO || {};

  const VS = 'attribute vec2 p;attribute vec2 t;attribute vec4 c;uniform vec2 r;varying vec2 vt;varying vec4 vc;' +
    'void main(){vt=t;vc=c;gl_Position=vec4(p.x/r.x*2.0-1.0,1.0-p.y/r.y*2.0,0.0,1.0);}';
  const FS = 'precision mediump float;uniform sampler2D s;varying vec2 vt;varying vec4 vc;' +
    'void main(){gl_FragColor=vt.x<0.0?vc:texture2D(s,vt)*vc;}';
  const PAGINA = 2048, TROZO = 2048, GRANDE = 512, MAX_QUADS = 16384, MAX_TEXTOS = 600;

  // Colores CSS → [r, g, b, a] (0–1), con un lienzo de 1×1 para lo que no sea #hex ni rgb().
  const colores = new Map();
  let parseador = null;
  function color(css) {
    let c = colores.get(css);
    if (c) return c;
    const s = String(css).trim();
    if (s[0] === '#') {
      const h = s.slice(1), n = h.length;
      const x = n <= 4 ? h.split('').map(d => parseInt(d + d, 16)) : [0, 2, 4, 6].filter(i => i < n).map(i => parseInt(h.slice(i, i + 2), 16));
      c = [x[0] / 255, x[1] / 255, x[2] / 255, x.length > 3 ? x[3] / 255 : 1];
    } else {
      const m = /^rgba?\(([^)]+)\)$/i.exec(s);
      if (m) { const p = m[1].split(',').map(v => parseFloat(v)); c = [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1]; }
      else {
        if (!parseador) parseador = document.createElement('canvas').getContext('2d');
        parseador.fillStyle = '#000'; parseador.fillStyle = s;
        c = parseador.fillStyle === s ? [0, 0, 0, 1] : color(parseador.fillStyle);
      }
    }
    if (colores.size > 4000) colores.clear();
    colores.set(css, c);
    return c;
  }

  // ¿El WebGL de este aparato es de verdad (tarjeta gráfica) o simulado con el procesador? Simulado va más lento que el 2D.
  function deSoftware(gl) {
    try { const ext = gl.getExtension('WEBGL_debug_renderer_info'), r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(r) ? r : null; } catch (e) { return null; }
  }
  // Se prueba en un lienzo aparte: un lienzo que ya tiene WebGL no puede volver al 2D.
  function disponible() {
    try { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return { si: false, por: 'sin WebGL' }; const sw = deSoftware(gl); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return sw ? { si: false, por: 'WebGL por software (' + sw + ')' } : { si: true }; } catch (e) { return { si: false, por: 'error' }; }
  }
  function crear(canvas, forzar) {
    if (!forzar && !disponible().si) return null;
    let gl = null;
    try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    // Si el sistema le quita la tarjeta gráfica a la página (en el móvil, al ir a otra app con poca memoria), las texturas se
    // pierden: al devolverla, el juego se vuelve a abrir (la partida está guardada).
    canvas.addEventListener('webglcontextlost', ev => ev.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => { try { location.reload(); } catch (e) { /* nada */ } });
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'p'); gl.bindAttribLocation(prog, 1, 't'); gl.bindAttribLocation(prog, 2, 'c');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'r');
    gl.uniform1i(gl.getUniformLocation(prog, 's'), 0);
    // Cada vértice: x, y, u, v (float) y el color (4 bytes): 20 bytes.
    const buf = new ArrayBuffer(MAX_QUADS * 6 * 20), f32 = new Float32Array(buf), u32 = new Uint32Array(buf);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const pagina = Math.min(PAGINA, maxTex), trozo = Math.min(TROZO, maxTex);

    let n = 0, texActual = null, ancho = 0, alto = 0, aditivo = false, recorte = null;
    const nuevaTextura = (w, h) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      texActual = null; // (se ha cambiado la textura enlazada: el lote siguiente la vuelve a enlazar)
      return t;
    };
    function volcar() {
      if (!n) return;
      if (texActual) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texActual); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(buf, 0, n * 20));
      gl.drawArrays(gl.TRIANGLES, 0, n);
      n = 0;
    }
    function usar(tex) {
      if (tex === texActual) return;
      // (Los rectángulos de color no usan textura: no obligan a volcar el lote.)
      volcar(); texActual = tex;
    }
    const empaqueta = (r, g, b, a) => ((Math.round(a * 255) << 24) | (Math.round(b * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(r * 255)) >>> 0;
    // Un vértice ya en píxeles de pantalla.
    function vert(x, y, u, v, col) { const i = n * 5; f32[i] = x; f32[i + 1] = y; f32[i + 2] = u; f32[i + 3] = v; u32[i + 4] = col; n++; }
    function cabe(v) { if (n + v > MAX_QUADS * 6) volcar(); }
    // Un cuadrilátero con la transformación actual (esquinas del rectángulo x,y,w,h).
    function quad(x, y, w, h, u0, v0, u1, v1, col) {
      cabe(6);
      const [a, b, c, d, e, f] = st.m;
      const x0 = a * x + c * y + e, y0 = b * x + d * y + f;
      const x1 = a * (x + w) + c * y + e, y1 = b * (x + w) + d * y + f;
      const x2 = a * x + c * (y + h) + e, y2 = b * x + d * (y + h) + f;
      const x3 = x1 + x2 - x0, y3 = y1 + y2 - y0;
      vert(x0, y0, u0, v0, col); vert(x1, y1, u1, v0, col); vert(x2, y2, u0, v1, col);
      vert(x2, y2, u0, v1, col); vert(x1, y1, u1, v0, col); vert(x3, y3, u1, v1, col);
    }
    const triangulo = (ax, ay, bx, by, cx, cy, col) => { cabe(3); vert(ax, ay, -1, -1, col); vert(bx, by, -1, -1, col); vert(cx, cy, -1, -1, col); };

    // ---------- El atlas de sprites pequeños ----------
    const paginas = [], enAtlas = new WeakMap();
    function alAtlas(img) {
      let e = enAtlas.get(img);
      if (e) return e;
      const w = img.width, h = img.height;
      if (!w || !h) return null;
      let pg = paginas[paginas.length - 1];
      const sitio = p => {
        if (p.x + w + 1 > pagina) { p.x = 1; p.y += p.fila + 1; p.fila = 0; }
        if (p.y + h + 1 > pagina) return null;
        const r = { x: p.x, y: p.y }; p.x += w + 1; p.fila = Math.max(p.fila, h); return r;
      };
      let r = pg && sitio(pg);
      if (!r) { pg = { tex: nuevaTextura(pagina, pagina), x: 1, y: 1, fila: 0 }; paginas.push(pg); r = sitio(pg); }
      if (!r) return null;
      volcar(); gl.bindTexture(gl.TEXTURE_2D, pg.tex); texActual = null;
      try { gl.texSubImage2D(gl.TEXTURE_2D, 0, r.x, r.y, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (err) { return null; }
      e = { tex: pg.tex, u: r.x / pagina, v: r.y / pagina, du: w / pagina, dv: h / pagina, w, h };
      enAtlas.set(img, e);
      return e;
    }

    // ---------- Los lienzos grandes, a trozos ----------
    const grandes = new Map(); // canvas → { trozos: [[tex, x, y, w, h]], sucio: [[x,y,w,h]] | 'todo' }
    let copia = null;
    function trozosDe(img) {
      let e = grandes.get(img);
      if (!e) {
        e = { trozos: [], sucio: 'todo' };
        for (let y = 0; y < img.height; y += trozo) for (let x = 0; x < img.width; x += trozo) {
          const w = Math.min(trozo, img.width - x), h = Math.min(trozo, img.height - y);
          e.trozos.push({ tex: nuevaTextura(w, h), x, y, w, h });
        }
        grandes.set(img, e);
      }
      if (e.sucio) subir(img, e);
      return e;
    }
    // Junta las zonas cambiadas que se tocan (las parcelas de una obra, un camino…) en rectángulos más grandes.
    function juntar(zonas) {
      const out = [];
      for (const z of zonas) {
        let r = z.slice(), unida = true;
        while (unida) {
          unida = false;
          for (let i = 0; i < out.length; i++) {
            const o = out[i];
            if (r[0] <= o[0] + o[2] && o[0] <= r[0] + r[2] && r[1] <= o[1] + o[3] && o[1] <= r[1] + r[3]) {
              const x0 = Math.min(r[0], o[0]), y0 = Math.min(r[1], o[1]);
              r = [x0, y0, Math.max(r[0] + r[2], o[0] + o[2]) - x0, Math.max(r[1] + r[3], o[1] + o[3]) - y0];
              out.splice(i, 1); unida = true; break;
            }
          }
        }
        out.push(r);
      }
      return out;
    }
    function subir(img, e) {
      volcar();
      const zonas = e.sucio === 'todo' ? [[0, 0, img.width, img.height]] : juntar(e.sucio);
      e.sucio = null;
      if (!copia) copia = document.createElement('canvas');
      for (const t of e.trozos) {
        for (const [zx, zy, zw, zh] of zonas) {
          const x0 = Math.max(t.x, Math.floor(zx)), y0 = Math.max(t.y, Math.floor(zy)), x1 = Math.min(t.x + t.w, Math.ceil(zx + zw)), y1 = Math.min(t.y + t.h, Math.ceil(zy + zh));
          if (x1 <= x0 || y1 <= y0) continue;
          const w = x1 - x0, h = y1 - y0;
          gl.bindTexture(gl.TEXTURE_2D, t.tex);
          // (Se copia el trozo cambiado a un lienzo de su tamaño y se sube ese lienzo tal cual: sin leer los píxeles
          // de vuelta al procesador, que es lentísimo.)
          if (copia.width !== w || copia.height !== h) { copia.width = w; copia.height = h; }
          const cg = copia.getContext('2d'); cg.clearRect(0, 0, w, h); cg.drawImage(img, x0, y0, w, h, 0, 0, w, h);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, x0 - t.x, y0 - t.y, gl.RGBA, gl.UNSIGNED_BYTE, copia);
        }
      }
      texActual = null;
    }

    // ---------- Los textos (rasterizados una vez y guardados) ----------
    const textos = new Map();
    let medidor = null;
    const medir = () => { if (!medidor) medidor = document.createElement('canvas').getContext('2d'); medidor.font = st.font; return medidor; };
    function texto(str, x, y, relleno) {
      const esc = Math.max(0.5, Math.round(Math.hypot(st.m[0], st.m[1]) * 2) / 2);
      const clave = st.font + '|' + (relleno ? st.fill : st.stroke) + '|' + st.lw + '|' + st.align + '|' + st.base + '|' + esc + '|' + str;
      let e = textos.get(clave);
      if (!e) {
        const mm = medir(), w = Math.ceil(mm.measureText(str).width) + 4, px = parseFloat(/(\d+(\.\d+)?)px/.exec(st.font) ? /(\d+(\.\d+)?)px/.exec(st.font)[1] : 10), h = Math.ceil(px * 2) + 4;
        const c = document.createElement('canvas'); c.width = Math.ceil(w * esc); c.height = Math.ceil(h * esc);
        const g = c.getContext('2d'); g.scale(esc, esc); g.font = st.font; g.textAlign = st.align; g.textBaseline = st.base;
        const ax = st.align === 'center' ? w / 2 : st.align === 'right' || st.align === 'end' ? w - 2 : 2, ay = h / 2;
        if (relleno) { g.fillStyle = typeof st.fill === 'string' ? st.fill : '#fff'; g.fillText(str, ax, ay); }
        else { g.strokeStyle = typeof st.stroke === 'string' ? st.stroke : '#000'; g.lineWidth = st.lw; g.strokeText(str, ax, ay); }
        const tex = nuevaTextura(c.width, c.height); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c);
        e = { tex, w, h, ax, ay };
        if (textos.size >= MAX_TEXTOS) { const [k, viejo] = textos.entries().next().value; textos.delete(k); volcar(); gl.deleteTexture(viejo.tex); texActual = null; }
      } else textos.delete(clave);
      textos.set(clave, e); // (al final: los más usados no se borran)
      usar(e.tex);
      const a = st.alpha;
      quad(x - e.ax, y - e.ay, e.w, e.h, 0, 0, 1, 1, empaqueta(a, a, a, a));
    }

    // ---------- Caminos: se guardan ya transformados, en píxeles de pantalla ----------
    let sub = [], camino = [];
    const punto = (x, y) => { const [a, b, c, d, e, f] = st.m; return [a * x + c * y + e, b * x + d * y + f]; };
    const escala = () => Math.sqrt(Math.abs(st.m[0] * st.m[3] - st.m[1] * st.m[2])) || 1;
    function nuevoSub() { sub = []; camino.push(sub); return sub; }
    function arco(cx, cy, rx, ry, rot, a0, a1, ccw) {
      let da = a1 - a0;
      if (ccw) { if (da > 0) da = da % (Math.PI * 2) - Math.PI * 2; if (da === 0 && a0 !== a1) da = -Math.PI * 2; }
      else { if (da < 0) da = da % (Math.PI * 2) + Math.PI * 2; }
      if (Math.abs(da) > Math.PI * 2) da = Math.sign(da) * Math.PI * 2;
      const pasos = Math.max(6, Math.min(48, Math.ceil(Math.abs(da) / (Math.PI * 2) * Math.max(rx, ry) * escala() * 1.2)));
      const cr = Math.cos(rot), sr = Math.sin(rot);
      if (!sub) nuevoSub();
      for (let i = 0; i <= pasos; i++) {
        const t = a0 + da * i / pasos, px = Math.cos(t) * rx, py = Math.sin(t) * ry;
        sub.push(punto(cx + px * cr - py * sr, cy + px * sr + py * cr));
      }
    }
    function rellenar() {
      const relleno = st.fill;
      if (relleno && relleno.radial) return degradado(relleno);
      const [r, g, b, a0] = color(relleno), a = a0 * st.alpha, col = empaqueta(r * a, g * a, b * a, a);
      for (const s of camino) {
        if (s.length < 3) continue;
        const [x0, y0] = s[0];
        for (let i = 1; i < s.length - 1; i++) triangulo(x0, y0, s[i][0], s[i][1], s[i + 1][0], s[i + 1][1], col);
      }
    }
    function trazar() {
      const [r, g, b, a0] = color(typeof st.stroke === 'string' ? st.stroke : '#000'), a = a0 * st.alpha, col = empaqueta(r * a, g * a, b * a, a);
      const w = Math.max(0.6, st.lw * escala()) / 2, guion = st.dash && st.dash.length ? st.dash.map(d => d * escala()) : null;
      const seg = (ax, ay, bx, by) => {
        const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (!l) return;
        const nx = -dy / l * w, ny = dx / l * w;
        triangulo(ax + nx, ay + ny, bx + nx, by + ny, ax - nx, ay - ny, col); triangulo(ax - nx, ay - ny, bx + nx, by + ny, bx - nx, by - ny, col);
      };
      for (const s of camino) {
        const pts = s.cerrado && s.length > 1 ? s.concat([s[0]]) : s;
        if (!guion) { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); continue; }
        // Línea discontinua: se recorre el camino alternando trazo y hueco.
        let k = 0, resto = guion[0], pinta = true;
        for (let i = 0; i < pts.length - 1; i++) {
          let [ax, ay] = pts[i]; const [bx, by] = pts[i + 1]; let l = Math.hypot(bx - ax, by - ay);
          while (l > 0) {
            const paso = Math.min(resto, l), t = paso / l, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
            if (pinta) seg(ax, ay, cx, cy);
            ax = cx; ay = cy; l -= paso; resto -= paso;
            if (resto <= 1e-6) { k = (k + 1) % guion.length; resto = guion[k]; pinta = !pinta; }
          }
        }
      }
    }
    // Un degradado radial (luces, fuego): anillos de colores alrededor de su centro.
    function degradado(gr) {
      const [cx, cy] = punto(gr.x1, gr.y1), R = gr.r1 * escala(), paradas = gr.paradas.slice().sort((p, q) => p[0] - q[0]);
      if (!paradas.length || R <= 0) return;
      const pasos = Math.max(12, Math.min(40, Math.ceil(R * 0.8)));
      const colDe = (pc) => { const [r, g, b, a0] = color(pc), a = a0 * st.alpha; return empaqueta(r * a, g * a, b * a, a); };
      const anillos = [[0, paradas[0][1]], ...paradas, [1, paradas[paradas.length - 1][1]]];
      for (let k = 0; k < anillos.length - 1; k++) {
        const r0 = anillos[k][0] * R, r1 = anillos[k + 1][0] * R; if (r1 <= r0) continue;
        const c0 = colDe(anillos[k][1]), c1 = colDe(anillos[k + 1][1]);
        for (let i = 0; i < pasos; i++) {
          const t0 = i / pasos * Math.PI * 2, t1 = (i + 1) / pasos * Math.PI * 2;
          const a = [cx + Math.cos(t0) * r0, cy + Math.sin(t0) * r0], b = [cx + Math.cos(t1) * r0, cy + Math.sin(t1) * r0];
          const c = [cx + Math.cos(t0) * r1, cy + Math.sin(t0) * r1], d = [cx + Math.cos(t1) * r1, cy + Math.sin(t1) * r1];
          cabe(6);
          vert(a[0], a[1], -1, -1, c0); vert(b[0], b[1], -1, -1, c0); vert(c[0], c[1], -1, -1, c1);
          vert(c[0], c[1], -1, -1, c1); vert(b[0], b[1], -1, -1, c0); vert(d[0], d[1], -1, -1, c1);
        }
      }
    }

    // ---------- El estado (como el del contexto 2D: save/restore) ----------
    let st = { m: [1, 0, 0, 1, 0, 0], alpha: 1, fill: '#000', stroke: '#000', lw: 1, font: '10px sans-serif', align: 'start', base: 'alphabetic', comp: 'source-over', clip: null, dash: null };
    const pila = [];
    const copiar = s => Object.assign({}, s, { m: s.m.slice(), dash: s.dash && s.dash.slice() });
    function aplicarModo() {
      const ad = st.comp === 'lighter';
      if (ad !== aditivo) { volcar(); aditivo = ad; gl.blendFunc(gl.ONE, ad ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
      const rc = st.clip;
      if ((rc && rc.join()) !== (recorte && recorte.join())) {
        volcar(); recorte = rc;
        if (rc) { gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(rc[0]), Math.floor(alto - rc[3]), Math.max(0, Math.ceil(rc[2] - rc[0])), Math.max(0, Math.ceil(rc[3] - rc[1]))); }
        else gl.disable(gl.SCISSOR_TEST);
      }
    }
    function preparar() {
      if (canvas.width !== ancho || canvas.height !== alto) { volcar(); ancho = canvas.width; alto = canvas.height; gl.viewport(0, 0, ancho, alto); gl.uniform2f(uRes, ancho, alto); recorte = null; gl.disable(gl.SCISSOR_TEST); aplicarModo(); }
    }

    const ctx = {
      canvas, gpu: true,
      get fillStyle() { return st.fill; }, set fillStyle(v) { st.fill = v; },
      get strokeStyle() { return st.stroke; }, set strokeStyle(v) { st.stroke = v; },
      get globalAlpha() { return st.alpha; }, set globalAlpha(v) { st.alpha = Math.max(0, Math.min(1, +v || 0)); },
      get lineWidth() { return st.lw; }, set lineWidth(v) { st.lw = +v || 1; },
      get font() { return st.font; }, set font(v) { st.font = v; },
      get textAlign() { return st.align; }, set textAlign(v) { st.align = v; },
      get textBaseline() { return st.base; }, set textBaseline(v) { st.base = v; },
      get globalCompositeOperation() { return st.comp; }, set globalCompositeOperation(v) { st.comp = v; aplicarModo(); },
      imageSmoothingEnabled: false, lineCap: 'butt', lineJoin: 'miter',
      save() { pila.push(copiar(st)); },
      restore() { if (pila.length) { st = pila.pop(); aplicarModo(); } },
      setTransform(a, b, c, d, e, f) { if (typeof a === 'object' && a) { ({ a, b, c, d, e, f } = a); } st.m = [a, b, c, d, e, f]; },
      resetTransform() { st.m = [1, 0, 0, 1, 0, 0]; },
      transform(a, b, c, d, e, f) { const [A, B, C, D, E, F] = st.m; st.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]; },
      translate(x, y) { const m = st.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
      scale(x, y) { const m = st.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
      rotate(t) { const c = Math.cos(t), s = Math.sin(t), [a, b, cc, d] = st.m; st.m[0] = a * c + cc * s; st.m[1] = b * c + d * s; st.m[2] = -a * s + cc * c; st.m[3] = -b * s + d * c; },
      setLineDash(l) { st.dash = l && l.length ? l.slice() : null; },
      getLineDash() { return st.dash ? st.dash.slice() : []; },
      fillRect(x, y, w, h) {
        preparar();
        const f = st.fill;
        if (f && f.radial) { degradado(f); return; }
        const [r, g, b, a0] = color(f), a = a0 * st.alpha;
        if (a <= 0) return;
        quad(x, y, w, h, -1, -1, -1, -1, empaqueta(r * a, g * a, b * a, a));
      },
      clearRect(x, y, w, h) {
        // (Solo se usa para borrar todo el lienzo: se pinta del color de fondo.)
        preparar(); const s = st.fill, al = st.alpha; st.fill = '#000'; st.alpha = 1; this.fillRect(x, y, w, h); st.fill = s; st.alpha = al;
      },
      strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.stroke(); },
      drawImage(img, a, b, c, d, e, f, g2, h2) {
        preparar();
        if (!img || !img.width || !img.height) return;
        let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
        if (e === undefined) { dx = a; dy = b; dw = c === undefined ? img.width : c; dh = d === undefined ? img.height : d; }
        else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g2; dh = h2; }
        if (sw <= 0 || sh <= 0 || st.alpha <= 0) return;
        const al = st.alpha, col = empaqueta(al, al, al, al);
        if (img.width > GRANDE || img.height > GRANDE) {
          // Un lienzo grande: cada trozo que toque el recorte de origen.
          const t = trozosDe(img), kx = dw / sw, ky = dh / sh;
          for (const p of t.trozos) {
            const x0 = Math.max(sx, p.x), y0 = Math.max(sy, p.y), x1 = Math.min(sx + sw, p.x + p.w), y1 = Math.min(sy + sh, p.y + p.h);
            if (x1 <= x0 || y1 <= y0) continue;
            usar(p.tex);
            quad(dx + (x0 - sx) * kx, dy + (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky, (x0 - p.x) / p.w, (y0 - p.y) / p.h, (x1 - p.x) / p.w, (y1 - p.y) / p.h, col);
          }
          return;
        }
        const e2 = alAtlas(img);
        if (!e2) return;
        usar(e2.tex);
        quad(dx, dy, dw, dh, e2.u + sx / e2.w * e2.du, e2.v + sy / e2.h * e2.dv, e2.u + (sx + sw) / e2.w * e2.du, e2.v + (sy + sh) / e2.h * e2.dv, col);
      },
      beginPath() { camino = []; sub = null; },
      moveTo(x, y) { nuevoSub().push(punto(x, y)); },
      lineTo(x, y) { if (!sub) nuevoSub(); sub.push(punto(x, y)); },
      closePath() { if (sub && sub.length) { sub.cerrado = true; const p0 = sub[0]; nuevoSub().push(p0); } },
      rect(x, y, w, h) { const s = nuevoSub(); s.push(punto(x, y), punto(x + w, y), punto(x + w, y + h), punto(x, y + h)); s.cerrado = true; sub = null; },
      roundRect(x, y, w, h, r) {
        const rr = Array.isArray(r) ? r : [r || 0]; const [tl, tr, br, bl] = rr.length === 1 ? [rr[0], rr[0], rr[0], rr[0]] : rr.length === 2 ? [rr[0], rr[1], rr[0], rr[1]] : rr.length === 3 ? [rr[0], rr[1], rr[2], rr[1]] : rr;
        nuevoSub();
        const esquina = (cx, cy, rad, a0) => { if (rad > 0) arco(cx, cy, rad, rad, 0, a0, a0 + Math.PI / 2, false); else sub.push(punto(cx, cy)); };
        esquina(x + tl, y + tl, tl, Math.PI); esquina(x + w - tr, y + tr, tr, -Math.PI / 2); esquina(x + w - br, y + h - br, br, 0); esquina(x + bl, y + h - bl, bl, Math.PI / 2);
        sub.cerrado = true; sub = null;
      },
      arc(x, y, r, a0, a1, ccw) { arco(x, y, r, r, 0, a0, a1, !!ccw); },
      ellipse(x, y, rx, ry, rot, a0, a1, ccw) { arco(x, y, rx, ry, rot || 0, a0, a1, !!ccw); },
      quadraticCurveTo(cx, cy, x, y) {
        if (!sub || !sub.length) { this.moveTo(x, y); return; }
        // (El punto de partida, ya transformado: se deshace con la inversa para interpolar en el mismo espacio.)
        const [p0x, p0y] = sub[sub.length - 1], [c1x, c1y] = punto(cx, cy), [p1x, p1y] = punto(x, y);
        for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; sub.push([u * u * p0x + 2 * u * t * c1x + t * t * p1x, u * u * p0y + 2 * u * t * c1y + t * t * p1y]); }
      },
      fill() { preparar(); rellenar(); },
      stroke() { preparar(); trazar(); },
      clip() {
        // (Solo recortes rectangulares, que es lo que usa el pintor: la caja del camino.)
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const s of camino) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        if (x0 === Infinity) return;
        const c = st.clip; st.clip = c ? [Math.max(c[0], x0), Math.max(c[1], y0), Math.min(c[2], x1), Math.min(c[3], y1)] : [x0, y0, x1, y1];
        aplicarModo();
      },
      fillText(t, x, y) { preparar(); texto(String(t), x, y, true); },
      strokeText(t, x, y) { preparar(); texto(String(t), x, y, false); },
      measureText(t) { return medir().measureText(t); },
      createRadialGradient(x0, y0, r0, x1, y1, r1) { const gr = { radial: true, x0, y0, r0, x1, y1, r1, paradas: [] }; gr.addColorStop = (o, c) => gr.paradas.push([o, c]); return gr; },
      createLinearGradient() { const gr = { paradas: [] }; gr.addColorStop = (o, c) => gr.paradas.push([o, c]); return '#888'; },
      // Lo propio de este contexto: marcar trozos cambiados de un lienzo grande, olvidarlo, y terminar el fotograma.
      sucio(img, x, y, w, h) { const e = grandes.get(img); if (!e || e.sucio === 'todo') return; (e.sucio = e.sucio || []).push([x, y, w, h]); if (e.sucio.length > 400) e.sucio = 'todo'; },
      todoSucio(img) { const e = grandes.get(img); if (e) e.sucio = 'todo'; },
      olvidar(img) { const e = grandes.get(img); if (!e) return; volcar(); for (const t of e.trozos) gl.deleteTexture(t.tex); grandes.delete(img); texActual = null; },
      fin() { volcar(); },
      perdido: () => gl.isContextLost(),
      info: () => ({ paginas: paginas.length, grandes: grandes.size, textos: textos.size, maxTex })
    };
    return ctx;
  }

  M.gpu = { crear, disponible };
})(globalThis.RF = globalThis.RF || {});
