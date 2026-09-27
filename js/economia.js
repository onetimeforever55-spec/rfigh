/*
 * LA ECONOMÍA
 * Cada sector tiene un peso (parte de la economía), un precio mundial que fluctúa y un dueño.
 * Cada día:
 *   1. los precios se mueven (con tendencia a volver a su valor normal)
 *   2. si hay una reconversión en marcha ("toda la economía al carbón"), el sector elegido crece y los demás encogen
 *   3. se calculan PIB, paro, inflación y contaminación
 *   4. todo eso empuja las estadísticas del país (tesoro, pueblo, salud, mundo, orden...)
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const OBJETIVO_MODELO = 52;
  const PASO_MODELO = 3;

  function nueva() {
    const sectores = {};
    for (const [id, s] of Object.entries(RF.SECTORES)) sectores[id] = { peso: s.peso, precio: s.base, dueno: s.dueno, legal: !s.ilegal };
    const eco = { sectores, defs: {}, modelo: null, pib: 0, pibAyer: 0, paro: 12, inflacion: 5, extraInflacion: 0, contaminacion: 0, alertas: {}, acum: {} };
    const c = calcular(eco);
    eco.pib = eco.pibAyer = eco.pibBase = c.pib;
    eco.empleoBase = c.empleo;
    eco.contaminacion = c.sucio * 0.35;
    return eco;
  }

  function datos(e) {
    if (!e.eco) e.eco = nueva();
    return e.eco;
  }

  function def(eco, id) { return RF.SECTORES[id] || eco.defs[id]; }

  function calcular(eco) {
    let pib = 0, empleo = 0, sucio = 0;
    for (const [id, s] of Object.entries(eco.sectores)) {
      const d = def(eco, id);
      pib += s.peso * s.precio;
      empleo += s.peso * d.empleo;
      sucio += s.peso * d.sucio;
    }
    return { pib, empleo, sucio };
  }

  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; }
  function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Suma efectos con decimales: se guardan y se aplican cuando llegan a un punto entero.
  function acumular(e, efectos, registro) {
    const eco = datos(e);
    const enteros = {};
    for (const [k, v] of Object.entries(efectos)) {
      if (!v) continue;
      eco.acum[k] = (eco.acum[k] || 0) + v;
      const n = Math.trunc(eco.acum[k]);
      if (n) { enteros[k] = n; eco.acum[k] -= n; }
    }
    RF.consejero.aplicarEfectos(e, enteros, registro);
    return enteros;
  }

  function nombreSector(eco, id) { return def(eco, id).nombre.toLowerCase(); }

  // Nuevo sector inventado por el jugador ("toda la economía basada en los calcetines").
  function sectorExotico(eco, nombre) {
    const id = 'exotico';
    eco.defs[id] = { nombre: T.mayus(nombre), detalle: 'la gran apuesta de Su Excelencia', base: 0.35, vol: 0.09, sucio: 1, empleo: 1 };
    if (!eco.sectores[id]) eco.sectores[id] = { peso: 0, precio: 0.35, dueno: 'estado', legal: true };
    return id;
  }

  /*
   * Efectos económicos de un decreto. Devuelve { efectos, notas } que el Consejero suma a los del decreto.
   */
  function aplicarDecreto(e, accion, objId, nombre) {
    const eco = datos(e);
    const efectos = {};
    const notas = [];
    const sumar = (k, v) => { efectos[k] = (efectos[k] || 0) + v; };

    if (objId === 'DINERO') {
      if (accion === 'CREAR' || accion === 'SUBSIDIAR' || accion === 'INVERTIR') {
        sumar('tesoro', 14); eco.extraInflacion += 25;
        notas.push('Las imprentas del Banco Central trabajan día y noche. En unos días, los precios empezarán a subir.');
      } else if (accion === 'PROHIBIR' || accion === 'PRIVATIZAR') {
        eco.dolarizado = true; eco.extraInflacion = 0;
        sumar('tesoro', -6); sumar('mundo', 4); sumar('pueblo', -3); sumar('cupula', 3);
        notas.push('Adiós al valdo: Valdoria usará moneda extranjera. La inflación bajará, pero ya no podrás imprimir dinero.');
      } else if (accion === 'RECORTAR' || accion === 'BAJAR_IMPUESTO') {
        eco.extraInflacion += 10;
        for (const id of ['agro', 'mineria', 'industria', 'turismo']) eco.sectores[id].precio *= 1.1;
        sumar('tesoro', 4); sumar('pueblo', -3);
        notas.push('El valdo pierde un tercio de su valor. Exportar sale más rentable; comprar pan, más caro.');
      }
      return { efectos, notas };
    }

    if (accion === 'ENFOCAR') {
      let sec = RF.SECTOR_AMPLIO[objId];
      if (!sec) sec = sectorExotico(eco, nombre);
      eco.modelo = { sector: sec, desde: e.dia };
      sumar('tesoro', -5); sumar('pueblo', -3);
      const s = eco.sectores[sec];
      if (sec === 'narco') {
        s.dueno = 'estado'; s.legal = true;
        sumar('mundo', -12); sumar('cupula', 4); sumar('orden', 2);
        notas.push('El Estado se convierte en el mayor cártel del país. Los antiguos capos ahora tienen despacho en un ministerio.');
      } else if (sec === 'carbon') { sumar('mundo', -5); sumar('cupula', 3); }
      else if (sec === 'tecnologia' || sec === 'turismo') sumar('mundo', 3);
      else if (sec === 'exotico') { sumar('mundo', -3); notas.push('Ningún economista del mundo había contemplado este modelo. Algunos piden verlo de cerca.'); }
      notas.push('La economía empieza a girar hacia ' + nombreSector(eco, sec) + ': unos ' + PASO_MODELO + ' puntos por día hasta ocupar la mitad del país. Mientras dure la reconversión, subirá el paro.');
      return { efectos, notas };
    }

    const sec = RF.SECTOR_DIRECTO[objId];
    if (!sec) return { efectos, notas };
    const s = eco.sectores[sec];
    const antes = s.peso;
    switch (accion) {
      case 'INVERTIR': case 'CREAR': s.peso += 4; break;
      case 'SUBSIDIAR': case 'OBLIGAR': s.peso += 2; break;
      case 'BAJAR_IMPUESTO': s.peso += 1.5; break;
      case 'SUBIR_IMPUESTO': s.peso = Math.max(0, s.peso - 1.5); break;
      case 'RECORTAR': s.peso = Math.max(0, s.peso - 3); break;
      case 'PRIVATIZAR': s.dueno = 'privado'; break;
      case 'NACIONALIZAR': s.dueno = 'estado'; if (sec === 'narco') s.legal = true; break;
      case 'LEGALIZAR': if (sec === 'narco') { s.legal = true; if (s.dueno === 'carteles') s.dueno = 'privado'; } break;
      case 'PROHIBIR': case 'CASTIGAR':
        s.peso = s.peso * (sec === 'narco' ? 0.6 : 0.4);
        if (sec === 'narco') { s.legal = false; s.dueno = 'carteles'; }
        break;
    }
    if (eco.modelo && eco.modelo.sector === sec && ['PROHIBIR', 'RECORTAR', 'CASTIGAR'].includes(accion)) {
      eco.modelo = null;
      notas.push('La reconversión hacia ' + nombreSector(eco, sec) + ' queda cancelada. Nadie sabe ya hacia dónde va la economía.');
    }
    const cambio = Math.round(s.peso - antes);
    if (cambio) notas.push(RF.SECTORES[sec].nombre + ': ' + (cambio > 0 ? '+' : '') + cambio + ' puntos de la economía.');
    return { efectos, notas };
  }

  // Ajustes que vienen de un evento ({ sectores: {narco: -10}, inflacion: 20, paro: -5, modelo: null }).
  function ajustar(e, a) {
    const eco = datos(e);
    for (const [id, v] of Object.entries(a.sectores || {})) if (eco.sectores[id]) eco.sectores[id].peso = Math.max(0, eco.sectores[id].peso + v);
    for (const [id, f] of Object.entries(a.multiplicar || {})) if (eco.sectores[id]) eco.sectores[id].peso *= f;
    if (a.inflacion) eco.extraInflacion += a.inflacion;
    if (a.paro) eco.paro = limitar(eco.paro + a.paro, 2, 60);
    if (a.duenos) for (const [id, d] of Object.entries(a.duenos)) if (eco.sectores[id]) eco.sectores[id].dueno = d;
    if (a.cancelarModelo) eco.modelo = null;
  }

  // Un día de economía. Devuelve el cambio del tesoro por la economía y añade noticias a res.sucesos.
  function dia(e, res) {
    const eco = datos(e);

    // 1. Precios mundiales.
    for (const [id, s] of Object.entries(eco.sectores)) {
      const d = def(eco, id);
      let objetivo = d.base;
      if (id === 'turismo') objetivo = d.base * (0.5 + e.stats.orden / 200 + e.stats.mundo / 200);
      if (id === 'narco' && s.legal && s.dueno === 'privado') objetivo = d.base * 0.75; // con competencia legal, paga menos
      s.precio = limitar(s.precio + (objetivo - s.precio) * 0.12 + gauss() * d.vol, 0.15, d.base * 3);
      // Noticias del mercado cuando el sector importa.
      if (s.peso >= 8 && id !== 'servicios') {
        const r = s.precio / d.base;
        const v = { sector: nombreSector(eco, id), Sector: def(eco, id).nombre, capital: RF.PAIS.capital };
        if (r < 0.72 && !eco.alertas[id + '_baja']) {
          eco.alertas[id + '_baja'] = true;
          res.sucesos.push({ tipo: 'mercado', titulo: def(eco, id).nombre + ' se hunde', texto: T.expandir(T.azar(RF.NOTICIAS_MERCADO.baja), v), deltas: {} });
        } else if (r > 0.9) eco.alertas[id + '_baja'] = false;
        if (r > 1.35 && !eco.alertas[id + '_sube']) {
          eco.alertas[id + '_sube'] = true;
          res.sucesos.push({ tipo: 'mercado', titulo: def(eco, id).nombre + ' se dispara', texto: T.expandir(T.azar(RF.NOTICIAS_MERCADO.sube), v), deltas: {} });
        } else if (r < 1.15) eco.alertas[id + '_sube'] = false;
      }
    }

    // 2. Reconversión.
    let enTransicion = false;
    if (eco.modelo && !eco.modelo.completado) {
      const m = eco.sectores[eco.modelo.sector];
      const total = Object.values(eco.sectores).reduce((t, s) => t + s.peso, 0);
      const mover = Math.min(PASO_MODELO, Math.max(0, (OBJETIVO_MODELO / 100) * total - m.peso));
      if (mover > 0.01) {
        const otros = Object.entries(eco.sectores).filter(([id]) => id !== eco.modelo.sector);
        const resto = otros.reduce((t, [, s]) => t + s.peso, 0) || 1;
        for (const [, s] of otros) s.peso = Math.max(0, s.peso - mover * (s.peso / resto));
        m.peso += mover;
        enTransicion = true;
      } else {
        eco.modelo.completado = true;
        const v = { sector: nombreSector(eco, eco.modelo.sector), Sector: def(eco, eco.modelo.sector).nombre };
        res.sucesos.push({ tipo: 'mercado', titulo: 'Reconversión completada', texto: T.expandir(T.azar(RF.NOTICIAS_MERCADO.modelo), v), deltas: {} });
      }
    }

    // 3. Indicadores.
    const c = calcular(eco);
    eco.pibAyer = eco.pib;
    eco.pib = c.pib;
    const paroObjetivo = limitar(12 + (eco.empleoBase - c.empleo) / 3 + (eco.pibBase - c.pib) / 4, 2, 60);
    eco.paro = limitar(eco.paro + (paroObjetivo - eco.paro) * 0.2 + (enTransicion ? 0.7 : 0), 2, 60);
    eco.extraInflacion *= 0.93;
    const inflObjetivo = (eco.dolarizado ? 2 : 5) + (eco.dolarizado ? 0 : Math.max(0, -e.ingresos - 1) * 5 + eco.extraInflacion);
    eco.inflacion = limitar(eco.inflacion + (inflObjetivo - eco.inflacion) * 0.25, 0, 500);
    eco.contaminacion = limitar(eco.contaminacion + (c.sucio * 0.35 - eco.contaminacion) * 0.15, 0, 100);

    // 4. Efectos en el país.
    const ef = {};
    const sumar = (k, v) => { ef[k] = (ef[k] || 0) + v; };
    sumar('tesoro', (c.pib - eco.pibBase) / 6);
    for (const [, s] of Object.entries(eco.sectores)) if (s.dueno === 'estado') sumar('tesoro', s.peso * s.precio * 0.05);
    const n = eco.sectores.narco;
    if (n.peso > 0.5) {
      if (n.dueno === 'estado') { sumar('mundo', -n.peso / 12); sumar('cupula', n.peso / 30); }
      else if (n.legal) { sumar('mundo', -n.peso / 20); sumar('tesoro', n.peso * 0.03); }
      else { sumar('orden', -n.peso / 12); sumar('cupula', n.peso / 25); sumar('mundo', -n.peso / 25); }
      sumar('salud', -n.peso / 30);
    }
    if (eco.paro > 28) sumar('pueblo', -1.5); else if (eco.paro > 18) sumar('pueblo', -0.6);
    if (eco.inflacion > 60) sumar('pueblo', -1.5); else if (eco.inflacion > 20) sumar('pueblo', -0.6);
    if (c.pib - eco.pibAyer > 2) sumar('pueblo', 0.5);
    if (eco.contaminacion > 70) sumar('salud', -1.5); else if (eco.contaminacion > 45) sumar('salud', -0.7);
    if (eco.contaminacion > 55) sumar('mundo', -0.5);
    const reg = {};
    acumular(e, ef, reg);
    return reg;
  }

  // Datos para la cabecera y el informe.
  function resumen(e) {
    const eco = datos(e);
    return {
      pib: Math.round((eco.pib / eco.pibBase) * 100),
      tendencia: eco.pib - eco.pibAyer,
      paro: Math.round(eco.paro),
      inflacion: Math.round(eco.inflacion),
      contaminacion: Math.round(eco.contaminacion)
    };
  }

  function barra(v, max) { const n = Math.round((v / max) * 10); return '█'.repeat(Math.min(10, n)) + '░'.repeat(Math.max(0, 10 - n)); }

  function informe(e) {
    const eco = datos(e);
    const r = resumen(e);
    const total = Object.values(eco.sectores).reduce((t, s) => t + s.peso, 0) || 1;
    const lineas = [
      'PIB ' + r.pib + ' ' + (r.tendencia > 0.5 ? '▲' : r.tendencia < -0.5 ? '▼' : '=') + '  (100 = tu llegada)',
      'Paro ' + r.paro + '% · Inflación ' + r.inflacion + '%',
      'Contaminación ' + r.contaminacion + '/100',
      eco.dolarizado ? 'Moneda: dólar (ya no puedes imprimir)' : 'Moneda: el valdo',
      eco.modelo ? 'Modelo: todo al ' + nombreSector(eco, eco.modelo.sector) : 'Modelo: economía mixta',
      eco.modelo ? (eco.modelo.completado ? '  reconversión completada' : '  reconversión en marcha') : '',
      '',
      'SECTOR          PESO PRECIO DUEÑO'
    ].filter((l, i) => l || i === 6);
    const orden = Object.entries(eco.sectores).filter(([, s]) => s.peso >= 0.5).sort((a, b) => b[1].peso - a[1].peso);
    for (const [id, s] of orden) {
      const d = def(eco, id);
      const pct = Math.round((s.peso / total) * 100);
      const precio = s.precio / d.base;
      const flecha = precio > 1.1 ? '▲' : precio < 0.9 ? '▼' : '=';
      lineas.push(d.nombre.slice(0, 15).padEnd(15) + String(pct).padStart(4) + '% ' + (precio.toFixed(2) + flecha).padStart(5) + ' ' + (RF.DUENOS[s.dueno] || s.dueno) + (id === 'narco' && !s.legal ? '*' : ''));
      lineas.push('  ' + barra(pct, 60));
    }
    if (!eco.sectores.narco.legal && eco.sectores.narco.peso >= 0.5) lineas.push('* ilegal');
    return lineas.join('\n');
  }

  RF.economia = { nueva, datos, aplicarDecreto, ajustar, dia, resumen, informe, acumular, nombreSector };
})(globalThis.RF = globalThis.RF || {});
