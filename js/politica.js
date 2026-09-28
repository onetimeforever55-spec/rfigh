/*
 * EL SISTEMA POLÍTICO
 *
 * El régimen se deduce del estado de cinco instituciones: Congreso, tribunales, prensa, elecciones y Constitución.
 *   - Todas libres                               → Democracia
 *   - Alguna controlada (comprada, amañada...)   → Democracia iliberal
 *   - Congreso disuelto, elecciones suspendidas
 *     o Constitución abolida                     → Dictadura
 *   - Monarquía, teocracia y junta militar se proclaman con un decreto.
 *
 * En democracia el Congreso puede bloquear leyes polémicas si no tienes apoyo suficiente.
 * Lo que se hace en secreto no pasa por el Congreso, pero cada turno puede salir a la luz
 * (más probable con prensa y jueces libres). Un escándalo en democracia puede acabar en juicio político.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const INSTITUCIONES = ['congreso', 'tribunales', 'prensa', 'elecciones', 'constitucion'];
  const POSITIVAS = ['CREAR', 'INVERTIR', 'GLORIFICAR', 'OBLIGAR', 'LEGALIZAR', 'SUBSIDIAR', 'ENFOCAR', 'NACIONALIZAR'];
  const ABOLIR = ['PROHIBIR', 'DEROGAR'];
  const SOMETER = ['CONTROLAR', 'CASTIGAR', 'RECORTAR', 'PRIVATIZAR'];

  function iniciar(e) {
    if (!e.politica) {
      e.politica = {
        regimen: 'DEMOCRACIA', proclamado: null, desde: 1,
        congreso: 'libre', tribunales: 'libre', prensa: 'libre', elecciones: 'libre', constitucion: 'libre',
        apoyo: 55, secretos: [], escandalos: 0, crimenes: 0, legislativas: false, historia: ['DEMOCRACIA']
      };
    }
    return e.politica;
  }

  function calcular(p) {
    if (p.proclamado) return p.proclamado;
    if (p.congreso === 'disuelto' || p.elecciones === 'disuelto' || p.constitucion === 'disuelto') return 'DICTADURA';
    if (INSTITUCIONES.some(k => p[k] !== 'libre')) return 'ILIBERAL';
    return 'DEMOCRACIA';
  }

  function regimen(e) { return iniciar(e).regimen; }
  function mods(e) { return RF.REGIMENES[regimen(e)]; }
  function esDemocracia(e) { const r = regimen(e); return r === 'DEMOCRACIA' || r === 'ILIBERAL'; }

  // Recalcula el régimen. Devuelve { de, a } si ha cambiado.
  function actualizar(e) {
    const p = iniciar(e);
    const nuevo = calcular(p);
    if (nuevo === p.regimen) return null;
    const cambio = { de: p.regimen, a: nuevo };
    p.regimen = nuevo;
    p.desde = e.dia;
    p.historia.push(nuevo);
    return cambio;
  }

  function textoCambio(a) { return T.expandir(T.azar(RF.TEXTOS_REGIMEN[a])); }

  // ---------- Decretos sobre el sistema político ----------

  const EFECTOS_INSTITUCION = {
    congreso: {
      disuelto: { efectos: { estabilidad: -8, felicidad: -10, dinero: -15 }, texto: 'Disuelves el Congreso. Los diputados se enteran por la radio.' },
      controlado: { efectos: { dinero: -30 }, texto: 'Maletines, cenas y promesas de embajadas. En una sola noche, cuarenta diputados descubren que siempre estuvieron de acuerdo contigo.' },
      libre: { efectos: { felicidad: 6, estabilidad: -3, dinero: 8 }, texto: 'El Congreso vuelve a reunirse con libertad. Su primer acto es pedirte explicaciones.' }
    },
    tribunales: {
      disuelto: { efectos: { estabilidad: -4, felicidad: -6, dinero: -5 }, texto: 'Cierras el Tribunal Supremo. Los jueces salen con sus togas en bolsas de plástico. A partir de hoy, la justicia la imparte tu despacho.' },
      controlado: { efectos: { dinero: -10, felicidad: -3 }, texto: 'Jubilas por sorpresa a los jueces del Supremo y nombras a tu antiguo abogado, a tu cuñado y a un señor que te cae bien.' },
      libre: { efectos: { felicidad: 4, estabilidad: -2 }, texto: 'Devuelves la independencia a los jueces. Algunos ya están abriendo carpetas con tu nombre.' }
    },
    prensa: {
      disuelto: { efectos: { felicidad: -6, estabilidad: 1 }, texto: 'Cierras los periódicos independientes. Los quioscos solo venden la prensa oficial y crucigramas.' },
      controlado: { efectos: { dinero: -12, felicidad: -2 }, texto: 'Tus amigos empresarios compran los principales periódicos y canales. Los editoriales se vuelven sorprendentemente amables contigo.' },
      libre: { efectos: { felicidad: 4, estabilidad: -2 }, texto: 'La prensa vuelve a ser libre. Al día siguiente, todas las portadas hablan de ti. Ninguna bien.' }
    },
    elecciones: {
      disuelto: { efectos: { felicidad: -10, estabilidad: -5, dinero: -10 }, texto: 'Suspendes las elecciones "hasta que se den las condiciones". Las urnas se guardan en un almacén del ejército.' },
      controlado: { efectos: { dinero: -8 }, texto: 'El consejo electoral recibe instrucciones discretas: censos creativos, colegios que abren tarde en los barrios críticos y un programa informático muy obediente.' },
      libre: { efectos: { felicidad: 6, estabilidad: -2 }, texto: 'Garantizas elecciones libres, con observadores internacionales. Nadie sabe si lo haces por convicción o por miedo.' }
    },
    constitucion: {
      disuelto: { efectos: { felicidad: -8, estabilidad: -4, dinero: -10 }, texto: 'Suspendes la Constitución. Las garantías ciudadanas quedan "en pausa". Nadie te explica dónde está el botón para quitar la pausa.' },
      controlado: { efectos: { felicidad: -4, estabilidad: 2 }, texto: 'Reformas la Constitución: reelección indefinida y un par de artículos que solo entiende tu abogado.' },
      libre: { efectos: { felicidad: 4 }, texto: 'Restauras la Constitución original, con todas sus garantías. Los estudiantes de Derecho lo celebran con una fiesta muy aburrida.' }
    }
  };

  // Efectos al instaurar un régimen de golpe.
  const INSTAURAR = {
    DEMOCRACIA: { efectos: { felicidad: 8, estabilidad: -4, dinero: 10 }, instituciones: { congreso: 'libre', tribunales: 'libre', prensa: 'libre', elecciones: 'libre', constitucion: 'libre' } },
    DICTADURA: { efectos: { estabilidad: -8, felicidad: -10, dinero: -15 }, instituciones: { congreso: 'disuelto', elecciones: 'disuelto' } },
    JUNTA: { efectos: { estabilidad: 6, felicidad: -8, dinero: -10 }, instituciones: { congreso: 'disuelto', elecciones: 'disuelto', prensa: 'controlado' } },
    MONARQUIA: { efectos: { dinero: -25, felicidad: -4, estabilidad: 2 }, instituciones: { congreso: 'disuelto', elecciones: 'disuelto' } },
    TEOCRACIA: { efectos: { dinero: -8, felicidad: -3, estabilidad: 4 }, instituciones: { congreso: 'controlado', tribunales: 'controlado', elecciones: 'disuelto' } }
  };

  // Cambia de régimen por decreto o por un evento. Devuelve lo que pasó.
  function instaurar(e, destino) {
    const p = iniciar(e);
    if (p.regimen === destino) return { nulo: 'Valdoria ya es una ' + RF.REGIMENES[destino].nombre.toLowerCase() + '.' };
    const d = INSTAURAR[destino];
    const de = p.regimen;
    p.proclamado = ['JUNTA', 'MONARQUIA', 'TEOCRACIA'].includes(destino) ? destino : null;
    Object.assign(p, d.instituciones);
    if (destino === 'DEMOCRACIA') { p.apoyo = e.stats.felicidad; RF.leyes.derogar(e, 'SOBORNOS'); }
    const cambio = actualizar(e) || { de, a: destino };
    const out = { efectos: Object.assign({}, d.efectos), texto: textoCambio(destino), cambio, notas: [] };
    if (destino === 'DEMOCRACIA' && (p.crimenes > 0 || p.secretos.length)) out.cadena = { id: 'comision_verdad', en: 3 };
    if ((destino === 'DICTADURA' || destino === 'JUNTA') && (de === 'DEMOCRACIA' || de === 'ILIBERAL')) out.cadena = { id: 'autogolpe_ejercito', en: 1 };
    out.notas.push(RF.REGIMENES[destino].descripcion);
    return out;
  }

  /*
   * Decretos sobre el sistema: "disuelvo el Congreso", "comprar a los diputados", "proclamarme rey"...
   * Devuelve null si el decreto no es político.
   */
  function decreto(e, accion, objId, nombre) {
    const o = RF.OBJETOS[objId];
    if (!o) return null;
    const p = iniciar(e);

    // Regímenes: instaurar o abolir.
    if (o.regimen) {
      let destino;
      if (ABOLIR.includes(accion) || accion === 'CASTIGAR' || accion === 'RECORTAR') destino = o.regimen === 'DEMOCRACIA' ? 'DICTADURA' : 'DEMOCRACIA';
      else destino = o.regimen;
      const r = instaurar(e, destino);
      r.medida = destino === 'DEMOCRACIA' ? 'la restauración de la democracia' : 'la instauración de ' + (destino === 'DICTADURA' ? 'la dictadura' : RF.OBJETOS[destino].nombre);
      return r;
    }

    // Prensa: solo "controlar/comprar la prensa" es político; prohibirla o perseguirla sigue siendo una ley.
    const clave = o.politico || (objId === 'PRENSA' && accion === 'CONTROLAR' ? 'prensa' : null);
    if (!clave) return null;

    let nuevo;
    if (ABOLIR.includes(accion)) nuevo = 'disuelto';
    else if (SOMETER.includes(accion)) nuevo = 'controlado';
    else if (POSITIVAS.includes(accion)) nuevo = 'libre';
    else return null;

    const verbos = { disuelto: { congreso: 'la disolución', tribunales: 'el cierre', prensa: 'el cierre', elecciones: 'la suspensión', constitucion: 'la suspensión' }, controlado: { congreso: 'la compra', tribunales: 'el control', prensa: 'la compra', elecciones: 'el amaño', constitucion: 'la reforma' }, libre: { congreso: 'la restauración', tribunales: 'la independencia', prensa: 'la libertad', elecciones: 'la garantía', constitucion: 'la restauración' } };
    const medida = verbos[nuevo][clave] + ' ' + T.de(RF.OBJETOS[{ congreso: 'CONGRESO', tribunales: 'TRIBUNALES', prensa: 'PRENSA', elecciones: 'ELECCIONES', constitucion: 'CONSTITUCION' }[clave]].nombre);
    if (p[clave] === nuevo) return { nulo: T.mayus(nombre) + ' ya está así: ' + RF.ESTADOS_INSTITUCION[clave][nuevo] + '.', medida };

    const def = EFECTOS_INSTITUCION[clave][nuevo];
    p[clave] = nuevo;
    const out = { medida, efectos: Object.assign({}, def.efectos), texto: def.texto, notas: [] };

    if (clave === 'congreso' && nuevo === 'controlado') {
      p.apoyo = 85;
      out.ley = { clave: 'SOBORNOS', nombre: 'los sobornos a los diputados', porTurno: { dinero: -4 } };
      out.secreto = { tipo: 'soborno', descripcion: 'los sobornos a los diputados', gravedad: 2 };
      out.notas.push('Ahora el Congreso aprueba todo. Mantenerlo contento cuesta 4 millones cada turno, y el secreto puede salir a la luz.');
    }
    if (clave === 'congreso' && nuevo === 'libre') { p.apoyo = e.stats.felicidad; RF.leyes.derogar(e, 'SOBORNOS'); }
    if (clave === 'elecciones' && nuevo === 'controlado') out.secreto = { tipo: 'fraude', descripcion: 'el amaño del sistema electoral', gravedad: 2 };
    if (clave === 'tribunales' && nuevo === 'libre' && (p.crimenes > 0 || p.secretos.length)) out.cadena = { id: 'comision_verdad', en: 3 };

    const cambio = actualizar(e);
    if (cambio) {
      out.cambio = cambio;
      out.texto += ' ' + textoCambio(cambio.a);
      out.notas.push(RF.REGIMENES[cambio.a].descripcion);
      if ((cambio.a === 'DICTADURA') && (cambio.de === 'DEMOCRACIA' || cambio.de === 'ILIBERAL')) out.cadena = { id: 'autogolpe_ejercito', en: 1 };
      if (cambio.a === 'DEMOCRACIA' && (p.crimenes > 0 || p.secretos.length)) out.cadena = { id: 'comision_verdad', en: 3 };
    }
    return out;
  }

  // Prohibir o perseguir a la prensa también cambia su estado (además de la ley).
  function efectoLateral(e, accion, objId) {
    if (objId !== 'PRENSA') return null;
    const p = iniciar(e);
    if (accion === 'PROHIBIR' || accion === 'CASTIGAR') p.prensa = accion === 'PROHIBIR' ? 'disuelto' : 'controlado';
    else if (accion === 'LEGALIZAR' || accion === 'DEROGAR' || accion === 'INVERTIR') p.prensa = 'libre';
    else return null;
    return actualizar(e);
  }

  // ---------- El Congreso ----------

  // Qué polémica es una ley (0 = nada, 3 = mucho).
  function controversia(def, accion, objId) {
    if (def && def.controversia != null) return def.controversia;
    const o = RF.OBJETOS[objId] || RF.OBJETO_OTRO;
    if (['ESCUADRON', 'ESPIAS', 'MILICIA'].includes(objId)) return 3;
    if (objId === 'NARCO' || (accion === 'ENFOCAR' && RF.SECTOR_AMPLIO[objId] === 'narco')) return 3;
    if (accion === 'CASTIGAR' && o.gente && o.afecta !== 'orden') return 3;
    if (accion === 'PROHIBIR' && (o.libertad || 0) >= 2) return 2;
    const pt = def.porTurno || {}, ini = def.inicial || {};
    if ((pt.felicidad || 0) <= -1.5 || (ini.felicidad || 0) <= -8) return 2;
    if (def.imprime || (accion === 'SUBIR_IMPUESTO' && objId === 'GENERAL') || ['PARTIDO', 'PROPAGANDA'].includes(objId)) return 1;
    return 0;
  }

  // ¿El Congreso bloquea esta ley? Solo si es libre, la ley es polémica y no tienes votos. Lo secreto no pasa por el Congreso.
  function bloquea(e, def, accion, objId, interp) {
    const p = iniciar(e);
    if (p.congreso !== 'libre' || (interp && interp.secreto) || !def || def.derogar || def.unaVez) return false;
    const c = controversia(def, accion, objId);
    return c > 0 && p.apoyo < 35 + 10 * c;
  }

  // Cada ley aprobada mueve el apoyo en el Congreso.
  function tras(e, def, accion, objId) {
    const p = iniciar(e);
    if (p.congreso !== 'libre' || !def) return;
    const c = controversia(def, accion, objId);
    const fel = ((def.porTurno || {}).felicidad || 0) * 3 + ((def.inicial || {}).felicidad || 0);
    p.apoyo = Math.max(0, Math.min(100, p.apoyo - 3 * c + (fel > 2 ? 3 : 0)));
  }

  // ---------- Secretos y escándalos ----------

  function registrarSecreto(e, s) {
    iniciar(e).secretos.push(Object.assign({ dia: e.dia }, s));
  }

  // Probabilidad de que un secreto salga a la luz este turno.
  function riesgo(e) {
    const p = iniciar(e);
    const prensa = { libre: 1.6, controlado: 0.6, disuelto: 0.3 }[p.prensa];
    const jueces = { libre: 1.4, controlado: 0.6, disuelto: 0.4 }[p.tribunales];
    const espias = RF.leyes.lista(e).some(l => l.clave === 'ESPIAS') ? 0.6 : 1;
    return 0.07 * prensa * jueces * espias;
  }

  const TEXTO_ESCANDALO = {
    asesinato: ['Un periodista publica pruebas: {descripcion} no fue un accidente. Hay grabaciones, transferencias y un testigo protegido. El país entero sabe ya quién dio la orden.', 'Un policía arrepentido lo cuenta todo en televisión: {descripcion} fue una ejecución ordenada desde Palacio.'],
    desaparicion: ['Aparecen documentos que prueban que {descripcion} fue obra de tus agentes. Las madres de los desaparecidos llenan la plaza.'],
    represion: ['Unos campesinos encuentran una fosa común en las afueras de la capital. Los cuerpos son de opositores "desaparecidos". Las fotos dan la vuelta al mundo.'],
    soborno: ['Se filtran vídeos de diputados contando fajos de billetes en un hotel. En todos aparece el mismo maletín. El maletín es tuyo.'],
    fraude: ['Un informático del consejo electoral confiesa el fraude y entrega los registros a la prensa extranjera.']
  };

  function escandalo(e, s, res) {
    const p = iniciar(e);
    const g = s.gravedad || 2;
    const reg = {};
    RF.consejero.aplicarEfectos(e, { estabilidad: -4 * g, felicidad: -3 * g, dinero: -4 * g }, reg);
    p.apoyo = Math.max(0, p.apoyo - 15 * g);
    p.escandalos++;
    // La represión secreta pasa a doler lo que tenía que doler.
    if (s.clave) { const ley = RF.leyes.lista(e).find(l => l.clave === s.clave); if (ley && ley.secreta) { ley.secreta = false; ley.porTurno.felicidad = (ley.porTurno.felicidad || 0) / 0.4; } }
    if (s.persona === 'valiente') {
      RF.leyes.promulgar(e, { clave: 'MARTIR', porTurno: { estabilidad: -1.2, felicidad: -0.5 }, duracion: 8 }, 'PERSONA', 'el recuerdo del mártir Valiente');
    }
    res.sucesos.push({ tipo: 'escandalo', titulo: 'Escándalo', texto: T.expandir(T.azar(TEXTO_ESCANDALO[s.tipo] || TEXTO_ESCANDALO.asesinato), { descripcion: s.descripcion }), deltas: reg });
    if (p.congreso === 'libre' && p.tribunales !== 'controlado' && esDemocracia(e)) RF.director.forzar(e, 'juicio_politico', {});
  }

  // Un crimen a la vista de todos, en democracia, también es un escándalo (aunque sin sorpresa).
  function crimenPublico(e, gravedad) {
    const p = iniciar(e);
    p.crimenes++;
    if (!esDemocracia(e)) return false;
    p.apoyo = Math.max(0, p.apoyo - 15 * gravedad);
    if (p.congreso === 'libre' && p.tribunales !== 'controlado') { RF.director.forzar(e, 'juicio_politico', {}); return true; }
    return false;
  }

  // ---------- Cada turno ----------
  function turno(e, res) {
    const p = iniciar(e);
    // El Congreso se mueve con el humor de la calle.
    if (p.congreso === 'libre') p.apoyo += (e.stats.felicidad - p.apoyo) * 0.15;

    // Los secretos pueden salir a la luz. A los 8 turnos quedan enterrados.
    const r = riesgo(e);
    for (const s of p.secretos.slice()) {
      if (e.dia - s.dia > 8) { p.secretos.splice(p.secretos.indexOf(s), 1); continue; }
      if (Math.random() < r) { p.secretos.splice(p.secretos.indexOf(s), 1); p.crimenes++; escandalo(e, s, res); }
    }

    // Elecciones legislativas a mitad de mandato.
    if (!p.legislativas && e.dia >= 15 && p.congreso !== 'disuelto' && esDemocracia(e)) {
      p.legislativas = true;
      const amanadas = p.elecciones === 'controlado';
      const apoyo = Math.round(Math.min(95, e.stats.felicidad + (amanadas ? 20 : 0)));
      if (p.congreso === 'libre') p.apoyo = apoyo;
      res.sucesos.push({
        tipo: 'politica', titulo: 'Elecciones legislativas',
        texto: 'Valdoria renueva el Congreso a mitad de mandato. ' + (amanadas ? 'Con el sistema electoral "ajustado", tu partido' : 'Tu partido') + ' obtiene el ' + apoyo + '% de los escaños. ' + (apoyo >= 50 ? 'Tienes mayoría para gobernar.' : 'Sin mayoría, el Congreso te lo pondrá difícil.'),
        deltas: {}
      });
    }
  }

  function resumen(e) {
    const p = iniciar(e);
    const m = mods(e);
    const f = v => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
    const lineas = [
      'Régimen: ' + m.nombre + ' (desde el turno ' + p.desde + ')',
      m.descripcion,
      '',
      'Congreso      ' + RF.ESTADOS_INSTITUCION.congreso[p.congreso] + (p.congreso === 'libre' ? ' · tu apoyo: ' + Math.round(p.apoyo) + '%' : ''),
      'Tribunales    ' + RF.ESTADOS_INSTITUCION.tribunales[p.tribunales],
      'Prensa        ' + RF.ESTADOS_INSTITUCION.prensa[p.prensa],
      'Elecciones    ' + RF.ESTADOS_INSTITUCION.elecciones[p.elecciones],
      'Constitución  ' + RF.ESTADOS_INSTITUCION.constitucion[p.constitucion],
      '',
      'Efectos del régimen:',
      '  Recaudación ' + f(m.recaudacion) + ' · Inversión ' + f(m.inversion),
      '  Felicidad ' + (m.felicidadTurno >= 0 ? '+' : '−') + Math.abs(m.felicidadTurno) + '/turno · Exterior ' + (m.dineroTurno >= 0 ? '+' : '−') + Math.abs(m.dineroTurno) + 'M/turno',
      '  Represión: estabilidad ×' + m.represionEstab + ', felicidad ×' + m.represionFel,
      '  Elecciones al final: ' + (m.elecciones === 'libres' ? 'libres (tienes que ganarlas)' : m.elecciones === 'amanables' ? 'sí, pero se pueden amañar' : 'no hay: solo tienes que seguir en el poder')
    ];
    if (p.secretos.length) lineas.push('', 'Secretos que podrían salir a la luz: ' + p.secretos.length + ' (riesgo por turno: ' + Math.round(riesgo(e) * 100) + '% cada uno)');
    if (p.escandalos) lineas.push('Escándalos que ya estallaron: ' + p.escandalos);
    return lineas.join('\n');
  }

  RF.politica = { iniciar, regimen, mods, esDemocracia, decreto, efectoLateral, instaurar, bloquea, tras, controversia, registrarSecreto, crimenPublico, turno, riesgo, resumen, actualizar };
})(globalThis.RF = globalThis.RF || {});
