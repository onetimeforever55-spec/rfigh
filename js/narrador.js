/*
 * EL NARRADOR
 * Convierte lo que pasó en bloques de texto para la consola:
 * la Gaceta Oficial, los números, la cúpula, la calle y los sucesos.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  const CONFUSOS = [
    'Tus ministros se miran entre ellos. {paredes} carraspea: "¿Podría repetirlo, Líder Supremo? Con otras palabras."',
    '{garrote} asiente muy serio, aunque no ha entendido nada. Nadie se atreve a preguntar.',
    '{cifuentes} toma nota, frunce el ceño y tacha lo que escribió. "Necesitamos algo más concreto, Líder Supremo."',
    '{sombra} apunta tus palabras en su libreta negra "por si acaso significan algo". La prensa extranjera se ríe un poco de ti.',
    'El secretario escribe el decreto, lo lee, le da la vuelta al papel y lo vuelve a leer. "¿Esto se publica así, Líder Supremo?"'
  ];

  const EJEMPLOS = ['imprimir wones', 'regalar arroz', 'vender carbón a China', 'lanzar un misil', 'crear campos de reeducación', 'abrir los mercados', 'legalizar el K-pop', 'restaurar la democracia'];

  function ayuda() {
    return [{
      tipo: 'sistema', titulo: 'CÓMO GOBERNAR',
      texto: 'Escribe un decreto con tus palabras y pulsa Decretar. El Intérprete intentará entenderlo.\n' +
        'Ejemplos: ' + EJEMPLOS.map(e => '"' + e + '"').join(', ') + '.\n' +
        'Tres barras: DIVISAS (millones de dólares en las arcas, pese a las sanciones), INFLACIÓN (lo que suben los precios cada turno) y ESTABILIDAD (si llega a 0, caes).\n' +
        'La estabilidad la sostienen tres sectores, cada uno con su sección en la historia: EJÉRCITO, PALACIO (el Partido y la élite) y POBLACIÓN. Su ánimo sube o baja con tus decretos y empuja la estabilidad cada turno. SOLO PIERDES SI LA ESTABILIDAD LLEGA A 0: un sector hundido, la quiebra, la hiperinflación o unas elecciones perdidas no te echan, pero la desploman. La represión compra estabilidad: sube la barra y el miedo calla el descontento de la gente. Escribe "estado" para verlo todo.\n' +
        'Cada decreto es una LEY que sigue actuando todos los turnos: "regalar arroz" cuesta divisas cada turno, "imprimir wones" dispara el precio del arroz, "vender carbón" da divisas cada turno pero las sanciones acechan. Las leyes se acumulan.\n' +
        'Para quitar una ley: "dejar de regalar arroz", "derogar la ley del carbón" o "derogar el último decreto".\n' +
        'Puedes firmar hasta 3 decretos a la vez: "prohibir el fútbol y subir impuestos a los ricos".\n' +
        'Cada pocos turnos surgirá un EVENTO: elige una de sus opciones antes de seguir gobernando.\n' +
        'El SISTEMA POLÍTICO también se cambia con decretos: "restaurar la democracia", "garantizar elecciones libres", "liberar la prensa", "disolver la asamblea", "proclamarme rey", "volver al juche". Cada régimen recauda, invierte y reprime distinto. En democracia, el Congreso puede bloquear leyes polémicas y hay que ganar las elecciones.\n' +
        'Lo que haces "en secreto" no pasa por ningún control, pero puede descubrirse.\n' +
        'ACCIONES EXTERIORES: "vender armas a una guerrilla africana", "financiar a los rebeldes de X", "apoyar un golpe en X", "pedir un préstamo a Rusia", "enviar trabajadores a China", "hackear bancos", "contrabandear carbón". Dan divisas o influencia, pero pueden salir mal y subir las sanciones.\n' +
        'DIPLOMACIA: Estados Unidos, China, Corea del Sur y Japón quieren cosas distintas. "negociar con Estados Unidos", "pedir ayuda a China", "visitar Seúl" o "insultar a Japón" cambian las relaciones; los misiles y la bomba también. China da comercio y petróleo; Washington decide las sanciones; el Sur manda ayuda. Escribe "diplomacia" para verlo.\n' +
        'Opcional: toca el botón IA de arriba (o escribe "ia"). Con IA, un Consejo de Estado entiende cualquier decreto, decide sus consecuencias (el juego pone las reglas y los límites) y recuerda lo que va pasando; y una crónica cuenta cada turno. Dentro de claude.ai funciona con tu cuenta; fuera, con una clave de API (OpenRouter y Gemini tienen planes gratis).\n' +
        'Comandos: "esperar" (pasar el turno sin decretar), "estado" (cómo va el país), "diplomacia" (relaciones exteriores), "sistema" (régimen e instituciones), "leyes" (tus leyes y lo que hacen cada turno), "poder" (ministros y personas), "historial", "reiniciar".\n' +
        'No hay último turno: gobiernas mientras aguantes. Cada 20 turnos hay elecciones.'
    }];
  }

  function intro(estado) {
    return [
      { tipo: 'titulo', texto: RF.PAIS.nombre.toUpperCase() },
      {
        tipo: 'gaceta', titulo: 'RODONG SINMUN · TURNO 1',
        texto: 'Tu padre ha muerto y hoy heredas la ' + RF.PAIS.nombre + ': veinticinco millones de personas, un ejército enorme, un país aislado y bajo sanciones, y un retrato tuyo que ya cuelga en cada casa aunque nadie te conoce. ' +
          'Tienes una consola y un sello. Todo lo que escribas aquí se convierte en ley, y las leyes se acumulan. ' +
          'La Asamblea Popular Suprema aplaudirá lo que firmes. El ejército, los cuadros del Partido y el pueblo decidirán si te dejan seguir.'
      },
      {
        tipo: 'radio', titulo: RF.PAIS.radio,
        texto: '¡Buenos días, camaradas! El nuevo Líder Supremo ya gobierna. El ejército está contento, el Palacio es fiel y las arcas tienen 80 millones. La población aguanta. Como siempre.'
      },
      {
        tipo: 'sistema', titulo: 'CÓMO SE JUEGA',
        texto: 'Escribe cualquier orden y pulsa Decretar: "vender carbón a China", "lanzar un misil", "prohibir los lunes", "negociar con Estados Unidos".\n' +
          'Todo se cumple, y cada ley sigue actuando cada turno. Solo pierdes si la ESTABILIDAD llega a 0.\n' +
          'Escribe "ayuda" para las reglas completas, "estado" para ver el país.'
      },
      {
        // Quién es quién: plegado, para quien quiera leerlo.
        tipo: 'detalles', titulo: 'Quién es quién',
        hijos: [
          {
            tipo: 'cupula', titulo: 'TU GABINETE',
            texto: Object.entries(RF.GABINETE).map(([id, m]) => RF.poder.ministro(estado, id).nombre + ', ' + m.cargo.toLowerCase()).join('. ') + '.'
          },
          {
            tipo: 'prensa', titulo: 'LOS DE FUERA Y LOS DE DENTRO',
            texto: 'Song Dae-ho dirige una red clandestina que reparte memorias USB con series del Sur. China compra tu carbón y te presta paciencia. La ONU prepara otra ronda de sanciones. El embajador sueco observa con cara de preocupación.'
          },
          {
            tipo: 'calle', titulo: 'EN LA CALLE',
            texto: Object.values(RF.CIUDADANOS).map(c => c.presentacion).join('\n\n')
          }
        ]
      }
    ];
  }

  // ---------- Las secciones del turno: RADIO, PALACIO, EJÉRCITO y POBLACIÓN ----------
  // Cada sector tiene un ánimo que empuja la estabilidad; la cabecera de su sección lo enseña.
  function cabecera(estado, id, res) {
    const S = RF.PAIS.sectores[id];
    const v = id === 'poblacion' ? estado.stats.felicidad : (estado.sectores || {})[id];
    const k = id === 'poblacion' ? 'felicidad' : id;
    const cambio = ((((res && res.deltas) || {})[k]) || 0) + 3 * ((((res && res.porTurno) || {})[k]) || 0);
    const flecha = cambio >= 1 ? ' ▲' : cambio <= -1 ? ' ▼' : '';
    return S.seccion + ' · ÁNIMO ' + Math.round(v) + flecha;
  }

  function radio(res, tipo) {
    const R = RF.RADIO;
    const frases = R.tipos[tipo] || R.tipos.general;
    // Corta: la frase del día y, a veces, un saludo o una despedida (nunca las dos).
    let t = T.expandir(T.azar(frases), res.vars);
    const r = Math.random();
    if (r < 0.2) t = T.azar(R.saludo) + ' ' + t;
    else if (r < 0.4) t += ' ' + T.azar(R.despedida);
    return T.expandir(t);
  }

  function lineaEjercito(estado, res) {
    const d = res.deltas || {}, pt = res.porTurno || {};
    const impacto = (d.ejercito || 0) + 3 * (pt.ejercito || 0) + 0.5 * (d.estabilidad || 0);
    const pool = impacto >= 1.5 ? RF.VOCES_EJERCITO.pos : impacto <= -1.5 ? RF.VOCES_EJERCITO.neg : RF.VOCES_EJERCITO.neu;
    return T.expandir(T.azar(pool), res.vars);
  }

  // La radio y UNA sección: la del sector al que más le ha tocado este turno (menos texto, más jugo).
  function secciones(estado, res, tipo) {
    const out = [{ tipo: 'radio', titulo: RF.PAIS.radio, texto: radio(res, tipo) }];
    const d = res.deltas || {}, pt = res.porTurno || {};
    const peso = k => Math.abs(d[k] || 0) + 3 * Math.abs(pt[k] || 0);
    const lc = lineaCiudadano(estado, res);
    const candidatos = [
      { id: 'poblacion', v: peso('felicidad') + 0.5, bloque: () => lc && { tipo: 'calle', titulo: cabecera(estado, 'poblacion', res), texto: lc.texto } },
      { id: 'ejercito', v: peso('ejercito'), bloque: () => ({ tipo: 'ejercito', titulo: cabecera(estado, 'ejercito', res), texto: lineaEjercito(estado, res) }) },
      { id: 'elite', v: peso('elite') + 0.3, bloque: () => ({ tipo: 'cupula', titulo: cabecera(estado, 'elite', res), texto: lineaMinistro(estado, res).texto }) }
    ].sort((a, b) => b.v - a.v);
    for (const c of candidatos) { const b = c.bloque(); if (b) { out.push(b); break; } }
    return out;
  }

  /*
   * Lo que se ve de un turno: lo divertido arriba y la letra pequeña plegada.
   * Visible: la Gaceta, los efectos, el Informe del Consejo, la radio y la sección, los sucesos, los eventos,
   * los cambios de régimen, las alertas graves y el final. Plegado: intérprete, notas, relaciones, leyes, causas.
   */
  const VISIBLES = new Set(['gaceta', 'efectos', 'logica', 'radio', 'cupula', 'ejercito', 'calle', 'suceso', 'dilema', 'regimen', 'fin', 'cronica', 'eco']);
  const GRAVE = /desploma|quiebra|golpe|Congreso|bloque|juicio|secreto|Nadie lo sabe/i;
  function compactar(bloques) {
    const vis = [], letra = [];
    for (const b of bloques) {
      if (b.tipo === 'amanecer') continue; // el número de turno ya está arriba
      if (b.tipo === 'efectos' && b.rotulo === 'Resultado del turno') { letra.push(b); continue; }
      if (VISIBLES.has(b.tipo) || (b.tipo === 'nota' && GRAVE.test(b.texto || '') && vis.filter(x => x.tipo === 'nota').length < 2)) vis.push(b);
      else letra.push(b);
    }
    if (letra.length) {
      const d = { tipo: 'detalles', titulo: 'Letra pequeña', hijos: letra };
      const i = vis.findIndex(b => b.tipo === 'dilema' || b.tipo === 'fin');
      vis.splice(i === -1 ? vis.length : i, 0, d);
    }
    return vis;
  }

  function lineaMinistro(estado, res) {
    const m = res.ministro;
    if (!m) return { titulo: 'EL GABINETE', texto: 'El gabinete escucha el decreto en silencio. Nadie sabe muy bien para qué sirve, pero todos aplauden.' };
    const min = RF.GABINETE[m.id];
    let texto = T.expandir(T.azar(m.delta > 0 ? min.pos : min.neg), res.vars);
    if (RF.consejero.lealtad(estado, m.id) < 30 && Math.random() < 0.6) texto += ' ' + T.expandir(T.azar(min.bajo), res.vars);
    return { titulo: RF.poder.ministro(estado, m.id).nombre.toUpperCase() + ' · ' + min.cargo.toUpperCase(), texto };
  }

  function lineaCiudadano(estado, res) {
    if (!res.ciudadano) return null;
    const id = res.ciudadano.id;
    const c = RF.CIUDADANOS[id];
    const est = estado.ciudadanos[id];
    let texto = T.expandir(T.azar(c[res.ciudadano.sentimiento]), res.vars);
    est.presentado = true; // ya se presentan todos en la introducción
    return { titulo: 'LA CALLE · ' + c.nombre.toUpperCase(), texto };
  }

  // Tipo de decreto, para elegir titulares y voces que encajen.
  function tipoDecreto(accion, objId) {
    const o = RF.consejero.objetoDe(objId);
    const E = o.esencial || 0, L = o.libertad || 0;
    if (objId === 'OTRO' || ((accion === 'PROHIBIR' || accion === 'OBLIGAR') && ['CALENDARIO', 'ROPA', 'MASCOTAS', 'AIRE'].includes(objId))) return 'absurdo';
    if (accion === 'GLORIFICAR') return 'culto';
    if (accion === 'ENFOCAR' || objId === 'DINERO') return 'economia';
    if (o.institucion) return ['ESCUADRON', 'MILICIA', 'ESPIAS'].includes(objId) ? 'represion' : 'culto';
    if (o.regimen) return o.regimen === 'DEMOCRACIA' || ['PROHIBIR', 'DEROGAR'].includes(accion) ? 'regalo' : 'libertad';
    if (o.politico) return ['LEGALIZAR', 'CREAR', 'INVERTIR'].includes(accion) ? 'regalo' : 'libertad';
    if (accion === 'CASTIGAR' && o.gente) return 'represion';
    if ((accion === 'PROHIBIR' || accion === 'OBLIGAR' || accion === 'CASTIGAR') && L >= 1) return 'libertad';
    if (['PRIVATIZAR', 'RECORTAR', 'PROHIBIR'].includes(accion) && E >= 2) return 'esencial';
    if (accion === 'SUBSIDIAR' || (accion === 'BAJAR_IMPUESTO' && o.faccion !== 'cupula') || accion === 'LEGALIZAR') return 'regalo';
    if (accion === 'SUBIR_IMPUESTO') return 'impuesto';
    if (accion === 'INVERTIR') return 'obra';
    if (accion === 'PRIVATIZAR' || accion === 'NACIONALIZAR' || accion === 'BAJAR_IMPUESTO') return 'economia';
    return 'general';
  }

  function deFuente(fuente, tipo) {
    const f = RF.PRENSA[fuente];
    return f[tipo] || f.general;
  }

  function titulares(res, tipo) {
    const lineas = [RF.PRENSA.oficial.nombre + ': ' + T.expandir(T.azar(deFuente('oficial', tipo)), res.vars)];
    const d = res.deltas;
    const pt = res.porTurno || {};
    const est = (d.estabilidad || 0) + 3 * (pt.estabilidad || 0);
    if (Math.abs(est) >= 2 || Math.random() < 0.5) lineas.push(RF.PRENSA.extranjera.nombre + ': ' + T.expandir(T.azar(deFuente('extranjera', tipo)), res.vars));
    if ((res.impacto || 0) < 0 || tipo === 'culto' || tipo === 'absurdo' || Math.random() < 0.3) lineas.push(RF.PRENSA.pirata.nombre + ': ' + T.expandir(T.azar(deFuente('pirata', tipo)), res.vars));
    return lineas.join('\n');
  }

  function vozDeLaCalle(res, tipo) {
    if (tipo === 'absurdo' && Math.random() < 0.5) return T.expandir(T.azar(RF.ABSURDO.calle), res.vars);
    const sent = (res.impacto || 0) >= 2 ? 'pos' : 'neg';
    const pool = RF.VOCES[sent][tipo] || RF.VOCES[sent].general;
    return '—' + T.expandir(T.azar(pool), res.vars) + ' — dice ' + T.azar(RF.VOCES_QUIEN) + '.';
  }

  function eco(estado, res) {
    const previos = estado.historial.slice(0, -1).slice(-6).filter(h => h.medida !== res.medida);
    if (!previos.length) return null;
    return T.expandir(T.azar(RF.ECOS), { anterior: T.azar(previos).medida });
  }

  function ambiente(estado) {
    const s = estado.stats;
    let pool = RF.AMBIENTE.normal;
    if (s.inflacion > 30) pool = RF.AMBIENTE.inflacion;
    else if (s.dinero < 0) pool = RF.AMBIENTE.tesoro;
    else if (s.estabilidad < 30) pool = Math.random() < 0.5 ? RF.AMBIENTE.ejercito : RF.AMBIENTE.orden;
    else if (s.felicidad < 30) pool = RF.AMBIENTE.pueblo;
    else if (s.felicidad > 60 && s.estabilidad > 55) pool = RF.AMBIENTE.bien;
    return T.expandir(T.azar(pool));
  }

  // Todo lo que cuenta un decreto: Gaceta, números, prensa, gabinete y calle.
  const TIPO_TRATO = { matar: 'represion', encarcelar: 'represion', exiliar: 'libertad', destituir: 'general', premiar: 'culto', liberar: 'regalo' };

  function decretoPersona(estado, interp, res) {
    const bloques = [];
    const partes = ['INTÉRPRETE › ' + RF.poder.nombreTrato(res.trato).toUpperCase() + ' + ' + res.nombreObjeto.toUpperCase()];
    if (interp.heredada) partes.push('orden heredada de la frase anterior');
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });
    bloques.push({ tipo: 'gaceta', titulo: (res.secreto ? 'ORDEN RESERVADA Nº ' : 'ORDEN EJECUTIVA Nº ') + res.numero + ' · TURNO ' + res.dia, texto: T.mayus(res.medida) + '. ' + res.especial });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, porTurno: res.porTurno });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });
    const tipo = res.secreto ? 'secreto' : TIPO_TRATO[res.trato] || 'general';
    bloques.push(...secciones(estado, res, tipo));
    return bloques;
  }

  // Cómo han cambiado las relaciones con las potencias vecinas.
  function bloqueExterior(estado, relaciones) {
    const ids = Object.keys(relaciones || {}).filter(id => relaciones[id]);
    if (!ids.length || !RF.diplomacia) return null;
    const lineas = ids.map(id => {
      const v = Math.round(RF.diplomacia.rel(estado, id));
      const d = relaciones[id];
      return RF.PAIS.relaciones[id].nombre + ': ' + (d > 0 ? '+' : '−') + Math.abs(d) + ' → ' + v + ' (' + RF.diplomacia.etiqueta(v) + ')';
    });
    return { tipo: 'exterior', titulo: 'RELACIONES EXTERIORES', texto: lineas.join('\n') };
  }

  function decretoDiplomacia(estado, interp, res) {
    const bloques = [{ tipo: 'bot', texto: 'INTÉRPRETE › DIPLOMACIA · ' + res.medida.toUpperCase() }];
    bloques.push({ tipo: 'gaceta', titulo: 'NOTA DIPLOMÁTICA Nº ' + res.numero + ' · TURNO ' + res.dia, texto: T.mayus(res.medida) + '. ' + res.especial });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, porTurno: null });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });
    const ex = bloqueExterior(estado, res.relaciones);
    if (ex) bloques.push(ex);
    bloques.push(...secciones(estado, res, res.dir === 'hostil' ? 'culto' : 'regalo'));
    return bloques;
  }

  function decreto(estado, interp, res) {
    if (res.tipo === 'persona') return decretoPersona(estado, interp, res);
    if (res.tipo === 'diplomacia') return decretoDiplomacia(estado, interp, res);
    const bloques = [];
    const partes = [interp.tema ? 'INTÉRPRETE › ' + res.medida.toUpperCase() : 'INTÉRPRETE › ' + RF.ACCIONES[res.accion].nombre.toUpperCase() + ' + ' + (res.objeto === 'OTRO' ? '"' + res.nombreObjeto + '" (desconocido)' : res.nombreObjeto.toUpperCase())];
    if (interp.confianza != null) partes.push(interp.confianza + '% seguro');
    if (interp.heredada) partes.push('acción heredada de la frase anterior');
    if (interp.negado) partes.push('negación detectada');
    if (interp.intensidad > 1) partes.push('intensidad alta');
    if (interp.intensidad < 1) partes.push('intensidad baja');
    if (interp.corregidas && interp.corregidas.length) partes.push('corregí ' + interp.corregidas.map(([a, b]) => a + '→' + b).join(', '));
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });

    const tipo = res.secreto ? 'secreto' : res.prensa || tipoDecreto(res.accion, res.objeto);
    let gaceta = T.mayus(res.medida) + '.';
    if (res.especial) gaceta += ' ' + res.especial;
    else if (res.objeto === 'OTRO') gaceta += ' ' + T.expandir(T.azar(RF.ABSURDO.gaceta), res.vars);
    const cabecera = res.bloqueada ? 'PROYECTO DE LEY Nº ' : res.secreto ? 'ORDEN RESERVADA Nº ' : 'DECRETO Nº ';
    if (res.bloqueada) gaceta += ' El proyecto llega al Congreso... y se atasca.';
    bloques.push({ tipo: 'gaceta', titulo: cabecera + res.numero + ' · TURNO ' + res.dia, texto: gaceta });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, porTurno: res.porTurno, curvas: res.curvas, nivel: res.ley && res.ley.nivel });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });

    const ex = bloqueExterior(estado, res.relaciones);
    if (ex) bloques.push(ex);
    bloques.push(...secciones(estado, res, tipo));
    if (res.cambioRegimen) bloques.push(bloqueRegimen(res.cambioRegimen));
    return bloques;
  }

  // El parte del turno: qué ha hecho cada ley vigente, la economía de fondo y el resultado.
  function parteLeyes(estado, res) {
    const lineas = [];
    const detalle = (res.leyesTurno || []).slice().sort((a, b) => Math.abs(b.efectos.dinero || 0) - Math.abs(a.efectos.dinero || 0));
    for (const l of detalle.slice(0, 8)) {
      lineas.push(T.mayus(l.nombre) + (l.nivel > 1 ? ' (nivel ' + l.nivel + ')' : ''));
      lineas.push('   ' + RF.leyes.resumenLey(l.efectos));
    }
    if (detalle.length > 8) lineas.push('… y ' + (detalle.length - 8) + ' leyes más (escribe "leyes")');
    const f = res.fondo || {};
    lineas.push('Impuestos y gastos del Estado', '   ' + RF.leyes.resumenLey({ dinero: f.dinero, estabilidad: f.estabilidad, felicidad: f.felicidad }));
    return lineas.join('\n');
  }

  // Lo que pasa al terminar el turno: el parte de las leyes, las causas, los sucesos y cómo amanece.
  function cierreDia(estado, res) {
    const bloques = [];
    bloques.push({ tipo: 'leyes', titulo: 'LEYES VIGENTES · ESTE TURNO', texto: parteLeyes(estado, res) });
    bloques.push({ tipo: 'efectos', rotulo: 'Resultado del turno', deltas: res.cambioTurno || {} });
    for (const c of res.causas || []) bloques.push({ tipo: 'nota', texto: c });
    for (const s of res.sucesos) {
      const etiqueta = { consecuencia: 'CONSECUENCIA', hito: 'HISTORIAS', umbral: 'ALERTA', azar: 'NOTICIA', escandalo: 'ESCÁNDALO', politica: 'POLÍTICA', mundo: 'EN EL PAÍS', diplomacia: 'EXTERIOR' }[s.tipo] || 'NOTICIA';
      bloques.push({ tipo: 'suceso', clase: s.tipo, titulo: etiqueta + ' · ' + s.titulo.toUpperCase(), texto: s.texto, deltas: s.deltas });
    }
    if (res.fin) return bloques.concat(final(estado));
    if (res.programadas && !res.sucesos.length) bloques.push({ tipo: 'nota', texto: 'Radio Pasillo: dicen que esto todavía va a traer cola.' });
    bloques.push({ tipo: 'amanecer', titulo: 'TURNO ' + estado.dia, texto: ambiente(estado) });
    return bloques;
  }

  function turno(estado, interp, res) {
    return decreto(estado, interp, res).concat(cierreDia(estado, res));
  }

  // Tarjeta de un dilema: el juego la dibuja con botones.
  function dilema(estado, d) {
    return {
      tipo: 'dilema', id: d.id, titulo: 'EVENTO · ' + d.titulo.toUpperCase(), texto: RF.director.texto(d, estado),
      opciones: d.opciones.map(op => ({ texto: T.expandir(op.texto), resumen: RF.director.resumen(op) }))
    };
  }

  function bloqueRegimen(cambio) {
    const a = RF.REGIMENES[cambio.a];
    return { tipo: 'regimen', titulo: 'CAMBIO DE RÉGIMEN · ' + RF.REGIMENES[cambio.de].corto + ' → ' + a.corto, texto: a.descripcion };
  }

  function decision(estado, r) {
    const bloques = [{ tipo: 'suceso', clase: 'decision', titulo: 'DECISIÓN · ' + (r.textoOpcion || T.expandir(r.opcion.texto)).toUpperCase(), texto: r.resultado, deltas: r.deltas }];
    if (r.decreto && r.decreto.porTurno) bloques.push({ tipo: 'efectos', rotulo: 'Ley aprobada', deltas: {}, porTurno: r.decreto.porTurno, curvas: r.decreto.curvas });
    const ex = bloqueExterior(estado, r.relaciones);
    if (ex) bloques.push(ex);
    if (r.cambio) bloques.push(bloqueRegimen(r.cambio));
    if (r.fin) bloques.push(...final(estado));
    return bloques;
  }

  function diplomacia(estado) {
    return [{ tipo: 'sistema', titulo: 'RELACIONES EXTERIORES', texto: RF.diplomacia.resumen(estado), mono: true }];
  }

  function sistema(estado) {
    return [{ tipo: 'sistema', titulo: 'EL SISTEMA POLÍTICO', texto: RF.politica.resumen(estado) }];
  }

  function confuso(interp) {
    return [
      { tipo: 'bot', texto: 'INTÉRPRETE › no entendí el decreto' },
      { tipo: 'cupula', titulo: 'EL GABINETE', texto: T.expandir(T.azar(CONFUSOS)) },
      { tipo: 'nota', texto: 'Prueba algo como "' + T.azar(EJEMPLOS) + '".' }
    ];
  }

  function pregunta(interp) {
    if (interp.estado === 'preguntar_objeto') {
      return {
        bloques: [
          { tipo: 'bot', texto: 'INTÉRPRETE › entendí ' + RF.ACCIONES[interp.accion].nombre.toUpperCase() + ', pero no sobre qué' },
          { tipo: 'cupula', titulo: 'EL SECRETARIO', texto: '"' + RF.ACCIONES[interp.accion].nombre + '... ¿el qué, Líder Supremo?" El secretario espera con la pluma en el aire.' }
        ],
        opciones: []
      };
    }
    const opciones = interp.estado === 'preguntar_trato'
      ? interp.opciones.map(op => ({ etiqueta: RF.poder.nombreTrato(op.trato) + ' a ' + op.nombreObjeto, interp: op }))
      : interp.opciones.map(op => ({
        etiqueta: T.mayus(RF.consejero.medida(op.accion, op.nombreObjeto)),
        interp: Object.assign({}, interp, { estado: 'ok', accion: op.accion, objeto: op.objeto, nombreObjeto: op.nombreObjeto })
      }));
    const texto = opciones.length > 2
      ? '"¿Qué hacemos con ' + interp.nombreObjeto + ', Líder Supremo?"'
      : '"Disculpe, Líder Supremo. ¿Se refiere a ' + opciones.map(o => o.etiqueta.toLowerCase()).join(' o a ') + '?"';
    return {
      bloques: [
        { tipo: 'bot', texto: 'INTÉRPRETE › tengo dudas, pregunto antes de firmar' },
        { tipo: 'cupula', titulo: 'EL SECRETARIO', texto }
      ],
      opciones
    };
  }

  function formatoStat(id, v) {
    if (id === 'dinero') return (v < 0 ? '−' : '') + Math.abs(Math.round(v)) + 'M';
    if (id === 'inflacion') return Math.round(v) + '%';
    return String(Math.round(v));
  }

  function estadoPais(estado) {
    const s = estado.stats;
    RF.consejero.asegurar(estado);
    const sec = estado.sectores, ec = estado.economia, B = RF.PAIS.barras, S = RF.PAIS.sectores;
    const fila = (n, v) => (n + '            ').slice(0, 13) + String(Math.round(v)).padStart(3) + '  ' + barra(v);
    const lineas = [
      'Régimen      ' + RF.politica.mods(estado).nombre + (estado.politica.congreso === 'libre' ? ' · Congreso: ' + Math.round(estado.politica.apoyo) + '% de apoyo' : ''),
      (B.dinero.nombre + '            ').slice(0, 13) + formatoStat('dinero', s.dinero),
      (B.inflacion.nombre + '            ').slice(0, 13) + formatoStat('inflacion', s.inflacion),
      fila(B.estabilidad.nombre, s.estabilidad),
      '',
      'Ánimo de los sectores (empujan la estabilidad; si uno se hunde, la desploma):',
      fila(S.ejercito.nombre, sec.ejercito),
      fila(S.elite.nombre, sec.elite),
      fila(S.poblacion.nombre, s.felicidad),
      'Miedo        ' + Math.round(RF.leyes.miedo(estado) * 100) + '% del descontento callado por la represión',
      '',
      'Sanciones    nivel ' + ec.sanciones + ' de 4 (' + (ec.sanciones * RF.PAIS.economia.costeSancion) + 'M por turno)',
      'Mercado negro ' + Math.round(ec.mercadoNegro) + '% de la economía'
    ];
    if (RF.diplomacia) {
      lineas.push('', 'Relaciones exteriores (escribe "diplomacia" para ver qué quiere cada uno):');
      for (const [id, P] of Object.entries(RF.PAIS.relaciones || {})) lineas.push(fila(P.nombre, RF.diplomacia.rel(estado, id)) + ' ' + RF.diplomacia.etiqueta(RF.diplomacia.rel(estado, id)));
    }
    const t = RF.leyes.lista(estado).reduce((acc, l) => { const ef = RF.leyes.efectoActual(estado, l); for (const k of Object.keys(acc)) acc[k] += ef[k] || 0; return acc; }, { dinero: 0, estabilidad: 0, felicidad: 0, inflacion: 0, ejercito: 0, elite: 0 });
    lineas.push('', 'Tus ' + RF.leyes.lista(estado).length + ' leyes suman cada turno:', '   ' + RF.leyes.resumenLey(t));
    lineas.push('Turno ' + estado.dia + ' · Decretos: ' + estado.historial.length);
    const humor = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (c.estado && c.estado !== 'libre' ? DESTINOS[c.estado] : c.animo > 25 ? 'te apoya' : c.animo < -25 ? 'te detesta' : 'desconfía'));
    lineas.push('', 'La calle:', ...humor.map(h => '  ' + h));
    return [{ tipo: 'sistema', titulo: 'INFORME DE SITUACIÓN', texto: lineas.join('\n'), mono: true }];
  }

  const DESTINOS = { muerto: 'muerto', preso: 'en la cárcel', exiliado: 'en el exilio', fuera: 'destituido', libre: 'libre', aliado: 'tu aliado' };

  function gabinete(estado) {
    const lineas = Object.entries(RF.GABINETE).map(([id, m]) => {
      const v = RF.consejero.lealtad(estado, id);
      const actitud = v >= 60 ? 'leal' : v >= 35 ? 'inquieto' : 'conspira';
      const g = RF.poder.ministro(estado, id);
      const caidos = g.caidos.map(c => c.nombre + ' (' + DESTINOS[c.destino] + ')').join(', ');
      return g.nombre + ' (' + m.cargo + '): ' + actitud + (caidos ? '\n   antes: ' + caidos : '');
    });
    const inst = RF.leyes.lista(estado).filter(l => l.institucion).map(l => '  ' + T.mayus(RF.INSTITUCIONES[l.clave].nombre) + ' · nivel ' + l.nivel + ' · desde el turno ' + l.desde);
    lineas.push('', 'Instituciones del régimen:', ...(inst.length ? inst : ['  ninguna (prueba "crear una red de espías")']));
    const per = estado.personas || {};
    lineas.push('', 'Song Dae-ho, líder de la oposición: ' + (DESTINOS[per.valiente] || 'libre'));
    const gente = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (DESTINOS[c.estado || 'libre']));
    lineas.push('La gente de a pie: ' + gente.join(' · '));
    return [{ tipo: 'sistema', titulo: 'EL PODER EN COREA DEL NORTE', texto: lineas.join('\n') }];
  }

  // Todas las leyes vigentes y lo que hacen ahora mismo cada turno.
  function leyes(estado) {
    const lista = RF.leyes.lista(estado);
    if (!lista.length) return [{ tipo: 'nota', texto: 'No hay leyes vigentes. Cada decreto que firmes se quedará aquí actuando todos los turnos.' }];
    const lineas = [];
    for (const l of lista) {
      const edad = estado.dia - l.desde;
      lineas.push(T.mayus(l.nombre) + (l.nivel > 1 ? ' (nivel ' + l.nivel + ')' : ''));
      lineas.push('   desde el turno ' + l.desde + (l.duracion ? ', dura ' + Math.max(0, l.duracion - edad) + ' turnos más' : '') + ': ' + RF.leyes.resumenLey(RF.leyes.efectoActual(estado, l)));
    }
    lineas.push('', 'Para quitar una ley: "derogar …" o "dejar de …".');
    return [{ tipo: 'sistema', titulo: 'LEYES VIGENTES', texto: lineas.join('\n') }];
  }

  function historial(estado) {
    if (!estado.historial.length) return [{ tipo: 'nota', texto: 'Todavía no has firmado ningún decreto.' }];
    return [{ tipo: 'sistema', titulo: 'ARCHIVO DE DECRETOS', texto: estado.historial.map((h, i) => 'Nº ' + (i + 1) + ' · Turno ' + h.dia + ': ' + T.mayus(h.medida)).join('\n') }];
  }

  function barra(v) { const n = Math.round(v / 10); return '█'.repeat(n) + '░'.repeat(10 - n); }

  function final(estado) {
    const f = RF.FINALES[estado.fin];
    const EPITAFIOS = {
      muerto: '{n} no llegó a ver el final de tu gobierno. En su barrio aún dejan flores cada aniversario.',
      preso: '{n} seguía en la cárcel cuando todo terminó. Salió años después, con el pelo blanco y la memoria intacta.',
      exiliado: '{n} vivió el final de tu gobierno desde el exilio. Nunca volvió a Corea del Norte.'
    };
    const epilogos = Object.entries(estado.ciudadanos).map(([id, c]) => {
      if (c.estado && c.estado !== 'libre') return T.expandir(EPITAFIOS[c.estado], { n: RF.CIUDADANOS[id].nombre });
      const tipo = c.animo > 25 ? 'bien' : c.animo < -25 ? 'mal' : 'neutro';
      return T.expandir(RF.CIUDADANOS[id].finales[tipo]);
    });
    const v = (estado.personas || {}).valiente;
    if (v === 'muerto') epilogos.push('Las plazas de medio país llevan hoy el nombre de Song Dae-ho. Ninguna lleva el tuyo.');
    else if (v === 'aliado') epilogos.push('Song Dae-ho acabó sus días como ministro de un gobierno que había jurado combatir. Nunca se lo perdonó.');
    else if (v === 'preso' || v === 'exiliado') epilogos.push('Song Dae-ho volvió a la vida pública en cuanto caíste. Ganó las siguientes elecciones.');
    const dias = estado.dia - 1;
    const s = estado.stats;
    return [
      { tipo: 'fin', titulo: 'FIN · ' + f.titulo, texto: T.expandir(f.texto) },
      { tipo: 'calle', titulo: 'QUÉ FUE DE ELLOS', texto: epilogos.join('\n\n') },
      { tipo: 'sistema', titulo: 'TU LEGADO', texto: 'Turnos en el poder: ' + dias + '. Decretos firmados: ' + estado.historial.length + '.\nDivisas ' + formatoStat('dinero', s.dinero) + ' · Inflación ' + formatoStat('inflacion', s.inflacion) + ' · Estabilidad ' + s.estabilidad + '.\nÁnimo del Ejército ' + Math.round((estado.sectores || {}).ejercito) + ' · del Palacio ' + Math.round((estado.sectores || {}).elite) + ' · de la Población ' + s.felicidad + '.\nEscribe "reiniciar" para gobernar otra vez.' }
    ];
  }

  RF.narrador = { compactar, diplomacia, bloqueExterior, secciones, cabecera, intro, turno, decreto, cierreDia, dilema, decision, tipoDecreto, confuso, pregunta, estadoPais, gabinete, leyes, sistema, historial, ayuda, final, formatoStat, EJEMPLOS };
})(globalThis.RF = globalThis.RF || {});
