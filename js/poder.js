/*
 * EL PODER
 *  - Instituciones del régimen (escuadrón, milicias, espías, partido, propaganda): se crean, actúan cada día y se disuelven.
 *  - Personas: puedes eliminar, encarcelar, exiliar, destituir, premiar o liberar a ministros, gente de a pie,
 *    al líder de la oposición o al embajador. Los ministros caídos se reemplazan por sucesores.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  const NOMINAL = {
    matar: 'la eliminación de {nombre}', encarcelar: 'el encarcelamiento de {nombre}', exiliar: 'el exilio de {nombre}',
    destituir: 'la destitución de {nombre}', premiar: 'la condecoración de {nombre}', liberar: 'la liberación de {nombre}'
  };

  function iniciar(e) {
    if (!e.gabinete) {
      e.gabinete = {};
      for (const [id, m] of Object.entries(RF.GABINETE)) e.gabinete[id] = { nombre: m.nombre, corto: m.corto, caidos: [], sucesor: 0 };
    }
    if (!e.personas) e.personas = { valiente: 'libre', embajador: 'libre' };
    for (const c of Object.values(e.ciudadanos || {})) if (!c.estado) c.estado = 'libre';
    actualizarNombres(e);
    return e;
  }

  // Los textos usan {garrote}, {n_garrote}... para nombrar a quien ocupa hoy cada cargo.
  function actualizarNombres(e) {
    RF.VARS = RF.VARS || {};
    for (const [id, g] of Object.entries(e.gabinete || {})) {
      RF.VARS[id] = g.corto;
      RF.VARS['n_' + id] = g.nombre;
    }
    RF.VARS.lider = RF.PAIS.tratamiento || 'Líder Supremo';
  }

  function ministro(e, id) { iniciar(e); return e.gabinete[id]; }

  // ---------- Personas ----------
  function nombrePersona(e, id) {
    const p = RF.PERSONAS[id];
    if (p.tipo === 'ministro') return ministro(e, id).nombre;
    if (p.tipo === 'ciudadano') return RF.CIUDADANOS[id].nombre;
    return p.nombre;
  }

  // Claves con las que se reconoce a cada persona (incluye el apellido de quien ocupa hoy el cargo).
  function claves(e, id) {
    const p = RF.PERSONAS[id];
    const out = p.claves.slice();
    if (!e) return out;
    if (p.tipo === 'ministro') {
      const g = ministro(e, id);
      out.unshift(T.normalizar(g.corto));
      for (const c of g.caidos) out.push(T.normalizar(c.corto));
    }
    return out;
  }

  // Busca a una persona nombrada en el texto. Devuelve { id, viejo } (viejo = un ministro que ya cayó).
  function buscar(e, textoNorm) {
    if (e) iniciar(e);
    let mejor = null, largo = 0;
    for (const id of Object.keys(RF.PERSONAS)) {
      for (const k of claves(e, id)) {
        if (k.length > largo && new RegExp('\\b' + k + '\\b').test(textoNorm)) {
          const g = e && RF.PERSONAS[id].tipo === 'ministro' ? ministro(e, id) : null;
          const caido = g && g.caidos.find(c => T.normalizar(c.corto) === k);
          mejor = { id, caido: caido || null };
          largo = k.length;
        }
      }
    }
    return mejor;
  }

  function detectarTrato(textoNorm) {
    for (const t of RF.TRATOS) if (t.re.test(textoNorm)) return t.id;
    return null;
  }

  function estadoPersona(e, id) {
    const p = RF.PERSONAS[id];
    if (p.tipo === 'ciudadano') return e.ciudadanos[id].estado || 'libre';
    if (p.tipo === 'ministro') return 'libre';
    return e.personas[id] || 'libre';
  }

  const DESTINO = { matar: 'muerto', encarcelar: 'preso', exiliar: 'exiliado', destituir: 'fuera' };

  /*
   * Aplica un trato a una persona. Devuelve { medida, texto, efectos, notas, cadena, objetivo }.
   * No aplica los efectos: lo hace el Consejero, para contarlos en el decreto.
   */
  function tratar(e, id, trato, caido, secreto) {
    iniciar(e);
    const p = RF.PERSONAS[id];
    const out = { efectos: {}, notas: [], texto: '', animo: {}, cadena: null };
    const nombre = caido ? caido.nombre : nombrePersona(e, id);
    const vars = { nombre, Nombre: T.mayus(nombre), oa: p.oa || 'o', le: 'le' };
    out.nombre = nombre;
    out.medida = T.expandir(NOMINAL[trato], vars);

    // Un ministro que ya cayó: solo se le puede liberar o, si está vivo, poco más.
    if (caido) {
      if (caido.destino === 'muerto') { out.nulo = T.expandir(RF.TEXTO_YA.muerto, vars); return out; }
      if (trato === 'liberar' && caido.destino === 'preso') {
        caido.destino = 'libre';
        out.texto = T.expandir(T.azar(RF.TEXTOS_TRATO.ministro.liberar), vars);
        out.efectos = { mundo: 2, cupula: 2 };
        return out;
      }
      if (trato === 'matar' && caido.destino !== 'exiliado') {
        caido.destino = 'muerto';
        out.texto = T.expandir(T.azar(RF.TEXTOS_TRATO.ministro.matar), vars);
        out.efectos = { mundo: -6, cupula: -6, orden: 2 };
        return out;
      }
      out.nulo = T.expandir(RF.TEXTO_YA.fuera, vars) + ' Ahora el cargo lo ocupa ' + nombrePersona(e, id) + '.';
      return out;
    }

    const actual = estadoPersona(e, id);
    if (actual === 'muerto') { out.nulo = T.expandir(RF.TEXTO_YA.muerto, vars); return out; }
    if (actual === 'exiliado' && trato !== 'liberar') { out.nulo = T.expandir(RF.TEXTO_YA.exiliado, vars); return out; }
    if (actual === 'preso' && trato === 'encarcelar') { out.nulo = T.expandir(RF.TEXTO_YA.preso, vars); return out; }
    if (trato === 'liberar' && actual === 'libre') { out.nulo = T.expandir(RF.TEXTO_YA.libre, vars); return out; }

    const tabla = RF.EFECTOS_TRATO[p.tipo][trato];
    for (const [k, v] of Object.entries(tabla)) out.efectos[k === 'stat' ? p.stat : k] = (out.efectos[k === 'stat' ? p.stat : k] || 0) + v;

    const textos = RF.TEXTOS_TRATO[p.tipo][trato];
    out.texto = T.expandir(Array.isArray(textos) ? T.azar(textos) : textos[id], vars);

    // En secreto: parece un accidente o una desaparición. Duele menos ahora... si nadie lo descubre.
    const oculto = secreto && ['matar', 'encarcelar', 'exiliar'].includes(trato);
    if (oculto) {
      for (const k of Object.keys(out.efectos)) out.efectos[k] *= 0.3;
      out.texto = T.expandir(T.azar(RF.TEXTOS_SECRETO[trato]), vars);
      out.medida = trato === 'matar' ? 'la muerte "accidental" de ' + nombre : 'la desaparición de ' + nombre;
      out.secreto = {
        tipo: trato === 'matar' ? 'asesinato' : 'desaparicion', persona: id,
        descripcion: trato === 'matar' ? 'la muerte de ' + nombre : 'la desaparición de ' + nombre,
        gravedad: { opositor: 3, extranjero: 4, ministro: 2, ciudadano: 2 }[p.tipo] || 2
      };
    }

    if (p.tipo === 'ministro') {
      if (DESTINO[trato]) {
        const g = ministro(e, id);
        g.caidos.push({ nombre: g.nombre, corto: g.corto, destino: DESTINO[trato], dia: e.dia });
        const lista = RF.SUCESORES[id];
        const nuevo = lista[g.sucesor % lista.length];
        g.sucesor++;
        g.nombre = nuevo.nombre; g.corto = nuevo.corto;
        actualizarNombres(e);
        out.texto += ' ' + T.expandir(T.azar(RF.TEXTO_SUCESOR), { sucesor: nuevo.nombre, Sucesor: nuevo.nombre });
        out.sucesor = nuevo.nombre;
        if (trato === 'matar') out.ley = { clave: 'MIEDO', nombre: 'el miedo en Palacio', porTurno: { estabilidad: 0.6, felicidad: -0.2 }, duracion: 5 };
      }
    } else if (p.tipo === 'ciudadano') {
      const c = e.ciudadanos[id];
      const familia = { carmen: 'nico', nico: 'carmen' }[id];
      const mueve = (quien, v) => { out.animo[quien] = (out.animo[quien] || 0) + v; };
      if (trato === 'matar') {
        c.estado = 'muerto';
        out.ley = { clave: 'LUTO_' + id, nombre: 'el luto por ' + nombre, porTurno: { felicidad: -0.8, estabilidad: -0.3 }, duracion: 5 };
        for (const otro of Object.keys(e.ciudadanos)) if (otro !== id) mueve(otro, -20);
        if (familia) mueve(familia, -60);
        out.cadena = { id: 'luto_' + id, en: 2 };
      } else if (trato === 'encarcelar') {
        c.estado = 'preso'; mueve(id, -40); if (familia) mueve(familia, -35);
      } else if (trato === 'exiliar') {
        c.estado = 'exiliado'; if (familia) mueve(familia, -25);
      } else if (trato === 'liberar') {
        c.estado = 'libre'; mueve(id, 20); if (familia) mueve(familia, 25);
      } else if (trato === 'destituir') {
        mueve(id, -30);
      } else if (trato === 'premiar') {
        mueve(id, 30); if (familia) mueve(familia, 10);
      }
      for (const [quien, v] of Object.entries(out.animo)) {
        const cc = e.ciudadanos[quien];
        cc.animo = Math.max(-100, Math.min(100, cc.animo + v));
      }
    } else if (p.tipo === 'opositor') {
      const destino = { matar: 'muerto', encarcelar: 'preso', exiliar: 'exiliado', destituir: 'exiliado', premiar: 'aliado', liberar: 'libre' }[trato];
      e.personas[id] = destino;
      if (trato === 'matar') out.ley = { clave: 'MARTIR', nombre: 'el recuerdo del mártir ' + (RF.PERSONAS.valiente.nombre || 'Song Dae-ho'), porTurno: { estabilidad: -1.2, felicidad: -0.5 }, duracion: 8 };
      if (trato === 'encarcelar') out.ley = { clave: 'PRESO_POLITICO', nombre: 'Song entre rejas', porTurno: { estabilidad: -0.5, felicidad: -0.3 }, duracion: 12 };
      if (trato === 'liberar' || trato === 'matar' || trato === 'exiliar') out.derogar = ['PRESO_POLITICO'];
      out.cadena = { matar: { id: 'funeral_valiente', en: 1 }, encarcelar: { id: 'huelga_hambre', en: 3 }, exiliar: { id: 'gobierno_exilio', en: 4 }, destituir: { id: 'gobierno_exilio', en: 4 } }[trato] || null;
    } else if (p.tipo === 'extranjero' && !oculto) {
      e.personas[id] = { matar: 'muerto', encarcelar: 'preso', exiliar: 'exiliado', destituir: 'exiliado' }[trato] || e.personas[id];
      if (trato === 'matar' || trato === 'encarcelar') out.cadena = { id: 'represalias', en: 1 };
      if (trato === 'matar' || trato === 'encarcelar') out.ley = { clave: 'AISLAMIENTO', nombre: 'el aislamiento internacional', porTurno: { dinero: -8, estabilidad: -0.8 }, duracion: 12 };
      if (trato === 'exiliar' || trato === 'destituir') out.notas.push('La ONU enviará un nuevo embajador. Más frío que el anterior.');
      if (trato === 'exiliar' || trato === 'destituir') e.personas[id] = 'libre';
    }
    if (oculto && p.tipo === 'opositor') { out.ley = null; out.cadena = null; }
    return out;
  }

  // Qué tratos ofrecer cuando el jugador nombra a alguien sin decir qué hacer.
  function tratosPosibles(e, id) {
    const p = RF.PERSONAS[id];
    const est = estadoPersona(e, id);
    if (est === 'preso') return ['liberar', 'matar', 'exiliar'];
    if (p.tipo === 'ministro') return ['destituir', 'premiar', 'encarcelar'];
    if (p.tipo === 'ciudadano') return ['premiar', 'encarcelar', 'exiliar'];
    return ['premiar', 'encarcelar', 'exiliar'];
  }

  // Pone a alguien concreto en un cargo (por un evento): el anterior queda fuera.
  function nombrar(e, cargo, nombre, corto) {
    const g = ministro(e, cargo);
    g.caidos.push({ nombre: g.nombre, corto: g.corto, destino: 'fuera', dia: e.dia });
    g.nombre = nombre; g.corto = corto;
    actualizarNombres(e);
  }

  // Disuelve una institución por un evento. Devuelve true si existía.
  function disolver(e, id) {
    return !!RF.leyes.derogar(e, id);
  }

  function nombreTrato(id) { return RF.TRATOS.find(t => t.id === id).nombre; }

  RF.poder = { iniciar, actualizarNombres, buscar, detectarTrato, tratar, tratosPosibles, nombrePersona, nombreTrato, estadoPersona, ministro, nombrar, disolver, NOMINAL };
})(globalThis.RF = globalThis.RF || {});
