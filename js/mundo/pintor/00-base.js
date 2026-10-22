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
    cv = canvas;
    // Con la tarjeta gráfica (WebGL) si el aparato la tiene; si no (o con ?gpu=0 / genesis.gpu=0), el 2D de siempre.
    // (?gpu=forzar la usa aunque el WebGL sea por software: para probar.)
    let sinGpu = false, forzar = false;
    try { sinGpu = /[?&]gpu=0/.test(location.search) || (localStorage.getItem('genesis.gpu') === '0' && !/[?&]gpu=/.test(location.search)); forzar = /[?&]gpu=forzar/.test(location.search); } catch (e) { /* sin preferencia */ }
    g = null;
    if (!sinGpu && M.gpu) { try { g = M.gpu.crear(cv, forzar); } catch (e) { g = null; } }
    if (!g) g = cv.getContext('2d');
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
