/*
 * EL NARRADOR
 * Convierte lo que pasó en bloques de texto para la consola:
 * la Gaceta Oficial, los números, la cúpula, la calle y los sucesos.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  const CONFUSOS = [
    'Tus ministros se miran entre ellos. {paredes} carraspea: "¿Podría repetirlo, Excelencia? Con otras palabras."',
    '{garrote} asiente muy serio, aunque no ha entendido nada. Nadie se atreve a preguntar.',
    '{cifuentes} toma nota, frunce el ceño y tacha lo que escribió. "Necesitamos algo más concreto, Excelencia."',
    '{sombra} apunta tus palabras en su libreta negra "por si acaso significan algo". La prensa extranjera se ríe un poco de ti.',
    'El secretario escribe el decreto, lo lee, le da la vuelta al papel y lo vuelve a leer. "¿Esto se publica así, Excelencia?"'
  ];

  const EJEMPLOS = ['imprimir dinero', 'regalar comida', 'vender el aire', 'vender cocaína', 'subir impuestos a los ricos', 'crear una escuadra de represión', 'invertir en hospitales', 'dejar de imprimir dinero'];

  function ayuda() {
    return [{
      tipo: 'sistema', titulo: 'CÓMO GOBERNAR',
      texto: 'Escribe un decreto con tus palabras y pulsa Decretar. El Intérprete intentará entenderlo.\n' +
        'Ejemplos: ' + EJEMPLOS.map(e => '"' + e + '"').join(', ') + '.\n' +
        'Cuatro cosas importan: DINERO, INFLACIÓN, ESTABILIDAD y FELICIDAD. Si la estabilidad o la felicidad llegan a 0, caes.\n' +
        'Cada decreto es una LEY que sigue actuando todos los turnos: "regalar comida" cuesta dinero cada turno, "imprimir dinero" sube la inflación cada turno, "vender el aire" da dinero cada turno pero amarga a la gente. Las leyes se acumulan.\n' +
        'Para quitar una ley: "dejar de regalar comida", "derogar la ley del aire" o "derogar el último decreto".\n' +
        'Puedes firmar hasta 3 decretos a la vez: "prohibir el fútbol y subir impuestos a los ricos".\n' +
        'Cada pocos turnos surgirá un EVENTO: elige una de sus opciones antes de seguir gobernando.\n' +
        'El SISTEMA POLÍTICO también se cambia con decretos: "disuelvo el congreso", "comprar a los diputados", "controlar los jueces", "suspender las elecciones", "proclamarme rey", "restaurar la democracia". Cada régimen recauda, invierte y reprime distinto.\n' +
        'En democracia, el Congreso puede bloquear leyes polémicas. Lo que haces "en secreto" no pasa por el Congreso, pero puede descubrirse.\n' +
        'Opcional: toca el botón IA de arriba (o escribe "ia"). Con IA, un Consejo de Estado entiende cualquier decreto, decide sus consecuencias (el juego pone las reglas y los límites) y recuerda lo que va pasando; y una crónica cuenta cada turno. Dentro de claude.ai funciona con tu cuenta; fuera, con una clave de API (OpenRouter y Gemini tienen planes gratis).\n' +
        'Comandos: "esperar" (pasar el turno sin decretar), "estado" (cómo va el país), "sistema" (régimen e instituciones), "leyes" (tus leyes y lo que hacen cada turno), "poder" (ministros y personas), "historial", "reiniciar".\n' +
        'Sobrevive ' + RF.PAIS.dias + ' turnos hasta las elecciones.'
    }];
  }

  function intro(estado) {
    return [
      { tipo: 'titulo', texto: RF.PAIS.nombre.toUpperCase() },
      {
        tipo: 'gaceta', titulo: 'GACETA OFICIAL · TURNO 1',
        texto: 'Anoche ganaste las elecciones por un margen mínimo y hoy juras como Presidente de ' + RF.PAIS.nombre + ', una democracia joven y frágil. ' +
          'Tienes una consola, un sello y ' + RF.PAIS.dias + ' turnos hasta las próximas elecciones. Todo lo que escribas aquí se convierte en ley, y las leyes se acumulan. ' +
          'El Congreso, los jueces y la prensa te vigilan... de momento.'
      },
      {
        tipo: 'cupula', titulo: 'TU GABINETE',
        texto: Object.entries(RF.GABINETE).map(([id, m]) => RF.poder.ministro(estado, id).nombre + ', ' + m.cargo.toLowerCase()).join('. ') + '.'
      },
      {
        tipo: 'prensa', titulo: 'LA OPOSICIÓN Y EL MUNDO',
        texto: 'Ernesto Valiente, líder de la oposición, ya ha convocado a sus seguidores. El embajador de la Unión Atlántica observa desde su embajada con cara de preocupación.\n' +
          'Las arcas tienen 100 millones de valdos, la inflación está en el 4% y el país está razonablemente tranquilo. De momento.'
      },
      {
        tipo: 'calle', titulo: 'MIENTRAS TANTO, EN LA CALLE',
        texto: Object.values(RF.CIUDADANOS).map(c => c.presentacion).join(' ')
      }
    ].concat(ayuda());
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
    if (!est.presentado) { texto = c.presentacion + ' ' + texto; est.presentado = true; }
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
    bloques.push({ tipo: 'prensa', titulo: 'TITULARES', texto: titulares(res, tipo) });
    const lm = lineaMinistro(estado, res);
    bloques.push({ tipo: 'cupula', titulo: lm.titulo, texto: lm.texto });
    const lc = lineaCiudadano(estado, res);
    if (lc) bloques.push({ tipo: 'calle', titulo: lc.titulo, texto: lc.texto + (Math.random() < 0.6 ? '\n\n' + vozDeLaCalle(res, tipo) : '') });
    return bloques;
  }

  function decreto(estado, interp, res) {
    if (res.tipo === 'persona') return decretoPersona(estado, interp, res);
    const bloques = [];
    const partes = ['INTÉRPRETE › ' + RF.ACCIONES[res.accion].nombre.toUpperCase() + ' + ' + (res.objeto === 'OTRO' ? '"' + res.nombreObjeto + '" (desconocido)' : res.nombreObjeto.toUpperCase())];
    if (interp.confianza != null) partes.push(interp.confianza + '% seguro');
    if (interp.heredada) partes.push('acción heredada de la frase anterior');
    if (interp.negado) partes.push('negación detectada');
    if (interp.intensidad > 1) partes.push('intensidad alta');
    if (interp.intensidad < 1) partes.push('intensidad baja');
    if (interp.corregidas && interp.corregidas.length) partes.push('corregí ' + interp.corregidas.map(([a, b]) => a + '→' + b).join(', '));
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });

    const tipo = res.secreto ? 'secreto' : tipoDecreto(res.accion, res.objeto);
    let gaceta = T.mayus(res.medida) + '.';
    if (res.especial) gaceta += ' ' + res.especial;
    else if (res.objeto === 'OTRO') gaceta += ' ' + T.expandir(T.azar(RF.ABSURDO.gaceta), res.vars);
    const cabecera = res.bloqueada ? 'PROYECTO DE LEY Nº ' : res.secreto ? 'ORDEN RESERVADA Nº ' : 'DECRETO Nº ';
    if (res.bloqueada) gaceta += ' El proyecto llega al Congreso... y se atasca.';
    bloques.push({ tipo: 'gaceta', titulo: cabecera + res.numero + ' · TURNO ' + res.dia, texto: gaceta });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, porTurno: res.porTurno, curvas: res.curvas, nivel: res.ley && res.ley.nivel });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });

    bloques.push({ tipo: 'prensa', titulo: 'TITULARES', texto: titulares(res, tipo) });
    const lm = lineaMinistro(estado, res);
    bloques.push({ tipo: 'cupula', titulo: lm.titulo, texto: lm.texto });
    const lc = lineaCiudadano(estado, res);
    if (lc) {
      let calle = lc.texto;
      if (Math.random() < 0.6) calle += '\n\n' + vozDeLaCalle(res, tipo);
      bloques.push({ tipo: 'calle', titulo: lc.titulo, texto: calle });
    }
    if (Math.random() < 0.3) { const e = eco(estado, res); if (e) bloques.push({ tipo: 'nota', texto: e }); }
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
      const etiqueta = { consecuencia: 'CONSECUENCIA', hito: 'HISTORIAS', umbral: 'ALERTA', azar: 'NOTICIA', escandalo: 'ESCÁNDALO', politica: 'POLÍTICA', mundo: 'EN EL PAÍS' }[s.tipo] || 'NOTICIA';
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
    if (r.cambio) bloques.push(bloqueRegimen(r.cambio));
    if (r.fin) bloques.push(...final(estado));
    return bloques;
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
          { tipo: 'cupula', titulo: 'EL SECRETARIO', texto: '"' + RF.ACCIONES[interp.accion].nombre + '... ¿el qué, Excelencia?" El secretario espera con la pluma en el aire.' }
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
      ? '"¿Qué hacemos con ' + interp.nombreObjeto + ', Excelencia?"'
      : '"Disculpe, Excelencia. ¿Se refiere a ' + opciones.map(o => o.etiqueta.toLowerCase()).join(' o a ') + '?"';
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
    const lineas = [
      'Régimen      ' + RF.politica.mods(estado).nombre + (estado.politica.congreso === 'libre' ? ' · Congreso: ' + Math.round(estado.politica.apoyo) + '% de apoyo' : ''),
      'Dinero       ' + formatoStat('dinero', s.dinero),
      'Inflación    ' + formatoStat('inflacion', s.inflacion),
      'Estabilidad  ' + String(s.estabilidad).padStart(3) + '  ' + barra(s.estabilidad),
      'Felicidad    ' + String(s.felicidad).padStart(3) + '  ' + barra(s.felicidad)
    ];
    const t = RF.leyes.lista(estado).reduce((acc, l) => { const ef = RF.leyes.efectoActual(estado, l); for (const k of Object.keys(acc)) acc[k] += ef[k] || 0; return acc; }, { dinero: 0, estabilidad: 0, felicidad: 0, inflacion: 0 });
    lineas.push('', 'Tus ' + RF.leyes.lista(estado).length + ' leyes suman cada turno:', '   ' + RF.leyes.resumenLey(t));
    lineas.push('Turno ' + Math.min(estado.dia, RF.PAIS.dias) + ' de ' + RF.PAIS.dias + ' · Decretos: ' + estado.historial.length);
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
    lineas.push('', 'Ernesto Valiente, líder de la oposición: ' + (DESTINOS[per.valiente] || 'libre'));
    const gente = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (DESTINOS[c.estado || 'libre']));
    lineas.push('La gente de a pie: ' + gente.join(' · '));
    return [{ tipo: 'sistema', titulo: 'EL PODER EN VALDORIA', texto: lineas.join('\n') }];
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
      exiliado: '{n} vivió el final de tu gobierno desde el exilio. Nunca volvió a Valdoria.'
    };
    const epilogos = Object.entries(estado.ciudadanos).map(([id, c]) => {
      if (c.estado && c.estado !== 'libre') return T.expandir(EPITAFIOS[c.estado], { n: RF.CIUDADANOS[id].nombre });
      const tipo = c.animo > 25 ? 'bien' : c.animo < -25 ? 'mal' : 'neutro';
      return T.expandir(RF.CIUDADANOS[id].finales[tipo]);
    });
    const v = (estado.personas || {}).valiente;
    if (v === 'muerto') epilogos.push('Las plazas de medio país llevan hoy el nombre de Ernesto Valiente. Ninguna lleva el tuyo.');
    else if (v === 'aliado') epilogos.push('Ernesto Valiente acabó sus días como ministro de un gobierno que había jurado combatir. Nunca se lo perdonó.');
    else if (v === 'preso' || v === 'exiliado') epilogos.push('Ernesto Valiente volvió a la vida pública en cuanto caíste. Ganó las siguientes elecciones.');
    const dias = Math.min(estado.dia, RF.PAIS.dias + 1) - 1;
    const s = estado.stats;
    return [
      { tipo: 'fin', titulo: 'FIN · ' + f.titulo, texto: T.expandir(f.texto) },
      { tipo: 'calle', titulo: 'QUÉ FUE DE ELLOS', texto: epilogos.join('\n\n') },
      { tipo: 'sistema', titulo: 'TU LEGADO', texto: 'Turnos en el poder: ' + dias + '. Decretos firmados: ' + estado.historial.length + '.\nDinero ' + formatoStat('dinero', s.dinero) + ' · Inflación ' + formatoStat('inflacion', s.inflacion) + ' · Estabilidad ' + s.estabilidad + ' · Felicidad ' + s.felicidad + '.\nEscribe "reiniciar" para gobernar otra vez.' }
    ];
  }

  RF.narrador = { intro, turno, decreto, cierreDia, dilema, decision, tipoDecreto, confuso, pregunta, estadoPais, gabinete, leyes, sistema, historial, ayuda, final, formatoStat, EJEMPLOS };
})(globalThis.RF = globalThis.RF || {});
