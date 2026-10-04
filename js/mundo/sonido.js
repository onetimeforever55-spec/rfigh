/*
 * GÉNESIS · EL SONIDO
 * Sonidos sintetizados con Web Audio (no hay archivos de audio): hachazos, espadas que chocan, flechas,
 * el cuerno de guerra, campanas cuando se funda una ciudad, un arpegio cuando nace un niño y un tono grave
 * con las pestes. Empieza apagado: se enciende con el botón de la cabecera.
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO = RF.MUNDO || {};
  let ctx = null, activo = false, maestro = null;

  function preparar() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0.5; maestro.connect(ctx.destination);
    return ctx;
  }
  // Un tono con su envolvente: frecuencia (y a dónde se desliza), duración, forma de onda y volumen.
  function tono(f, dur, tipo, vol, hasta, retraso) {
    if (!activo || !ctx) return;
    const t0 = ctx.currentTime + (retraso || 0);
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(maestro); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // Un golpe de ruido filtrado (hachazo, choque, soplo de una flecha).
  function ruido(dur, frecuencia, vol, retraso, tipoFiltro) {
    if (!activo || !ctx) return;
    const t0 = ctx.currentTime + (retraso || 0), n = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(), fil = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = b; fil.type = tipoFiltro || 'bandpass'; fil.frequency.value = frecuencia; gn.gain.value = vol;
    src.connect(fil); fil.connect(gn); gn.connect(maestro); src.start(t0);
  }

  const S = {
    hacha: r => { ruido(0.06, 900, 0.25, r); tono(170, 0.08, 'triangle', 0.08, 120, r); },
    choque: r => { ruido(0.08, 3200, 0.22, r, 'highpass'); tono(1400, 0.07, 'square', 0.03, 900, r); },
    flecha: r => { ruido(0.25, 1800, 0.08, r); },
    cuerno: r => { tono(110, 0.9, 'sawtooth', 0.06, 147, r); tono(220, 0.9, 'triangle', 0.03, 294, r); },
    campana: r => { tono(880, 1.4, 'sine', 0.08, null, r); tono(1320, 1.0, 'sine', 0.04, null, r); tono(1760, 0.6, 'sine', 0.02, null, r); },
    nacer: r => { tono(660, 0.25, 'sine', 0.05, null, r); tono(880, 0.35, 'sine', 0.05, null, (r || 0) + 0.12); },
    peste: r => { tono(90, 1.4, 'sine', 0.1, 70, r); },
    obrar: r => { tono(523, 0.5, 'triangle', 0.06, null, r); tono(784, 0.6, 'triangle', 0.05, null, (r || 0) + 0.1); tono(1046, 0.8, 'sine', 0.04, null, (r || 0) + 0.2); }
  };

  // Lo que ha pasado en un turno, en sonidos repartidos a lo largo de su duración (ms).
  function turno(m, duracion, eventos) {
    if (!activo || !m || !m.vida) return;
    const d = Math.max(0.3, (duracion || 1000) / 1000), v = m.vida;
    const trabajando = v.aldeanos.filter(a => a.o === 0 && a.r && a.r.some((x, i) => i % 3 === 2 && x === 1)).length;
    for (let k = 0; k < Math.min(3, Math.ceil(trabajando / 8)); k++) S.hacha(Math.random() * d);
    const batallas = (v.muertos || []).filter(x => x[3] === 'batalla').length;
    for (let k = 0; k < Math.min(4, batallas); k++) S.choque(Math.random() * d);
    for (let k = 0; k < Math.min(3, (v.disparos || []).length); k++) S.flecha(Math.random() * d);
    if (eventos.nacimientos) S.nacer(Math.random() * d * 0.5);
    for (const e of eventos.cronica || []) {
      if (e.tipo === 'guerra') S.cuerno(0.05);
      else if (e.tipo === 'ciudad') S.campana(0.1);
      else if (e.tipo === 'plaga' || e.tipo === 'hambruna') S.peste(0.1);
    }
  }

  function alternar(encender) {
    activo = encender != null ? encender : !activo;
    if (activo) { preparar(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    return activo;
  }

  M.sonido = { alternar, turno, activo: () => activo, efecto: n => S[n] && S[n](0) };
})(globalThis.RF = globalThis.RF || {});
