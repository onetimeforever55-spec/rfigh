/*
 * EL NARRADOR
 * Convierte lo que pasó en bloques de texto para la consola:
 * la Gaceta Oficial, los números, la cúpula, la calle y los sucesos.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  const CONFUSOS = [
    'Tus ministros se miran entre ellos. Rolo carraspea: "¿Podría repetirlo, Excelencia? Con otras palabras."',
    'Garrote asiente muy serio, aunque no ha entendido nada. Nadie se atreve a preguntar.',
    'Cifuentes toma nota, frunce el ceño y tacha lo que escribió. "Necesitamos algo más concreto, Excelencia."',
    'Sombra apunta tus palabras en su libreta negra "por si acaso significan algo". La prensa extranjera se ríe un poco de ti.',
    'El secretario escribe el decreto, lo lee, le da la vuelta al papel y lo vuelve a leer. "¿Esto se publica así, Excelencia?"'
  ];

  const EJEMPLOS = ['prohibir el fútbol', 'el aire se vende', 'subir impuestos a los ricos', 'regalar comida', 'mano dura contra los ladrones', 'estatua de mí', 'invertir en hospitales', 'legalizar la marihuana'];

  function ayuda() {
    return [{
      tipo: 'sistema', titulo: 'CÓMO GOBERNAR',
      texto: 'Escribe un decreto con tus palabras y pulsa Decretar. El Intérprete intentará entenderlo.\n' +
        'Ejemplos: ' + EJEMPLOS.map(e => '"' + e + '"').join(', ') + '.\n' +
        'Puedes firmar hasta 3 decretos a la vez: "prohibir el fútbol y subir impuestos a los ricos".\n' +
        'Cada pocos días surgirá un EVENTO: elige una de sus opciones antes de seguir gobernando.\n' +
        'Comandos: "estado" (cómo va el país), "gabinete" (tus ministros), "historial" (tus decretos), "reiniciar" (empezar de cero).\n' +
        'Sobrevive ' + RF.PAIS.dias + ' días. Si alguna barra llega a 0, caes.'
    }];
  }

  function intro(estado) {
    return [
      { tipo: 'titulo', texto: RF.PAIS.nombre.toUpperCase() },
      {
        tipo: 'gaceta', titulo: 'GACETA OFICIAL · DÍA 1',
        texto: 'Anoche, tras "un proceso democrático muy rápido", te convertiste en el Líder Supremo de ' + RF.PAIS.nombre + '. ' +
          'Tienes una consola, un sello y ' + RF.PAIS.dias + ' días hasta las elecciones prometidas. Todo lo que escribas aquí se convierte en ley.'
      },
      {
        tipo: 'cupula', titulo: 'TU GABINETE',
        texto: Object.values(RF.GABINETE).map(m => m.nombre + ', ' + m.cargo.toLowerCase()).join('. ') + '.'
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
    if (estado.stats[m.stat] < 30 && Math.random() < 0.6) texto += ' ' + T.expandir(T.azar(min.bajo), res.vars);
    return { titulo: min.nombre.toUpperCase() + ' · ' + min.cargo.toUpperCase(), texto };
  }

  function lineaCiudadano(estado, res) {
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
    if (Math.abs(d.mundo || 0) >= 2 || Math.random() < 0.5) lineas.push(RF.PRENSA.extranjera.nombre + ': ' + T.expandir(T.azar(deFuente('extranjera', tipo)), res.vars));
    if ((d.pueblo || 0) < 0 || tipo === 'culto' || tipo === 'absurdo' || Math.random() < 0.3) lineas.push(RF.PRENSA.pirata.nombre + ': ' + T.expandir(T.azar(deFuente('pirata', tipo)), res.vars));
    return lineas.join('\n');
  }

  function vozDeLaCalle(res, tipo) {
    if (tipo === 'absurdo' && Math.random() < 0.5) return T.expandir(T.azar(RF.ABSURDO.calle), res.vars);
    const sent = (res.deltas.pueblo || 0) >= 2 ? 'pos' : 'neg';
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
    const peor = RF.STATS.map(x => x.id).sort((a, b) => s[a] - s[b])[0];
    const media = RF.STATS.reduce((t, x) => t + s[x.id], 0) / RF.STATS.length;
    const pool = s[peor] < 30 ? RF.AMBIENTE[peor] : media > 60 ? RF.AMBIENTE.bien : RF.AMBIENTE.normal;
    return T.azar(pool);
  }

  // Todo lo que cuenta un decreto: Gaceta, números, prensa, gabinete y calle.
  function decreto(estado, interp, res) {
    const bloques = [];
    const partes = ['INTÉRPRETE › ' + RF.ACCIONES[res.accion].nombre.toUpperCase() + ' + ' + (res.objeto === 'OTRO' ? '"' + res.nombreObjeto + '" (desconocido)' : res.nombreObjeto.toUpperCase())];
    if (interp.confianza != null) partes.push(interp.confianza + '% seguro');
    if (interp.heredada) partes.push('acción heredada de la frase anterior');
    if (interp.negado) partes.push('negación detectada');
    if (interp.intensidad > 1) partes.push('intensidad alta');
    if (interp.intensidad < 1) partes.push('intensidad baja');
    if (interp.corregidas && interp.corregidas.length) partes.push('corregí ' + interp.corregidas.map(([a, b]) => a + '→' + b).join(', '));
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });

    const tipo = tipoDecreto(res.accion, res.objeto);
    let gaceta = T.mayus(res.medida) + '.';
    if (res.especial) gaceta += ' ' + res.especial;
    else if (res.objeto === 'OTRO') gaceta += ' ' + T.expandir(T.azar(RF.ABSURDO.gaceta), res.vars);
    bloques.push({ tipo: 'gaceta', titulo: 'DECRETO Nº ' + res.numero + ' · DÍA ' + res.dia, texto: gaceta });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, cambioIngresos: res.cambioIngresos });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });

    bloques.push({ tipo: 'prensa', titulo: 'TITULARES', texto: titulares(res, tipo) });
    const lm = lineaMinistro(estado, res);
    bloques.push({ tipo: 'cupula', titulo: lm.titulo, texto: lm.texto });
    const lc = lineaCiudadano(estado, res);
    let calle = lc.texto;
    if (Math.random() < 0.6) calle += '\n\n' + vozDeLaCalle(res, tipo);
    bloques.push({ tipo: 'calle', titulo: lc.titulo, texto: calle });
    if (Math.random() < 0.3) { const e = eco(estado, res); if (e) bloques.push({ tipo: 'nota', texto: e }); }
    return bloques;
  }

  // Lo que pasa al terminar el día: caja, consecuencias, sucesos y cómo amanece mañana.
  function cierreDia(estado, res) {
    const bloques = [];
    if (res.economia) bloques.push({ tipo: 'efectos', deltas: {}, economia: res.economia, ingresos: estado.ingresos });
    for (const s of res.sucesos) {
      const etiqueta = { consecuencia: 'CONSECUENCIA', hito: 'HISTORIAS', umbral: 'ALERTA', azar: 'NOTICIA' }[s.tipo];
      bloques.push({ tipo: 'suceso', clase: s.tipo, titulo: etiqueta + ' · ' + s.titulo.toUpperCase(), texto: s.texto, deltas: s.deltas });
    }
    if (res.fin) return bloques.concat(final(estado));
    if (res.programadas && !res.sucesos.length) bloques.push({ tipo: 'nota', texto: 'Radio Pasillo: dicen que esto todavía va a traer cola.' });
    bloques.push({ tipo: 'amanecer', titulo: 'DÍA ' + estado.dia, texto: ambiente(estado) });
    return bloques;
  }

  function turno(estado, interp, res) {
    return decreto(estado, interp, res).concat(cierreDia(estado, res));
  }

  // Tarjeta de un dilema: el juego la dibuja con botones.
  function dilema(estado, d) {
    return {
      tipo: 'dilema', id: d.id, titulo: 'EVENTO · ' + d.titulo.toUpperCase(), texto: RF.director.texto(d),
      opciones: d.opciones.map(op => ({ texto: op.texto, resumen: RF.director.resumen(op) }))
    };
  }

  function decision(estado, r) {
    const bloques = [{ tipo: 'suceso', clase: 'decision', titulo: 'DECISIÓN · ' + r.opcion.texto.toUpperCase(), texto: r.resultado, deltas: r.deltas }];
    if (r.fin) bloques.push(...final(estado));
    return bloques;
  }

  function confuso(interp) {
    return [
      { tipo: 'bot', texto: 'INTÉRPRETE › no entendí el decreto' },
      { tipo: 'cupula', titulo: 'EL GABINETE', texto: T.azar(CONFUSOS) },
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
    const opciones = interp.opciones.map(op => ({
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

  function estadoPais(estado) {
    const lineas = RF.STATS.map(s => s.nombre.padEnd(9, ' ') + String(estado.stats[s.id]).padStart(3, ' ') + '  ' + barra(estado.stats[s.id]));
    const ing = estado.ingresos - 1;
    lineas.push('Balance diario del tesoro: ' + (ing > 0 ? '+' : '') + ing);
    lineas.push('Día ' + Math.min(estado.dia, RF.PAIS.dias) + ' de ' + RF.PAIS.dias + ' · Decretos firmados: ' + estado.historial.length);
    const humor = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (c.animo > 25 ? 'te apoya' : c.animo < -25 ? 'te detesta' : 'desconfía'));
    lineas.push('', 'La calle:', ...humor.map(h => '  ' + h));
    return [{ tipo: 'sistema', titulo: 'INFORME DE SITUACIÓN', texto: lineas.join('\n'), mono: true }];
  }

  function gabinete(estado) {
    const lineas = Object.values(RF.GABINETE).map(m => {
      const v = Math.round(m.stats.reduce((s, k) => s + estado.stats[k], 0) / m.stats.length);
      const actitud = v >= 60 ? 'leal' : v >= 35 ? 'inquieto' : 'conspira';
      return m.nombre + ' (' + m.cargo + '): ' + actitud;
    });
    return [{ tipo: 'sistema', titulo: 'TU GABINETE', texto: lineas.join('\n') }];
  }

  function historial(estado) {
    if (!estado.historial.length) return [{ tipo: 'nota', texto: 'Todavía no has firmado ningún decreto.' }];
    return [{ tipo: 'sistema', titulo: 'ARCHIVO DE DECRETOS', texto: estado.historial.map((h, i) => 'Nº ' + (i + 1) + ' · Día ' + h.dia + ': ' + T.mayus(h.medida)).join('\n') }];
  }

  function barra(v) { const n = Math.round(v / 10); return '█'.repeat(n) + '░'.repeat(10 - n); }

  function final(estado) {
    const f = RF.FINALES[estado.fin];
    const epilogos = Object.entries(estado.ciudadanos).map(([id, c]) => {
      const tipo = c.animo > 25 ? 'bien' : c.animo < -25 ? 'mal' : 'neutro';
      return RF.CIUDADANOS[id].finales[tipo];
    });
    const dias = Math.min(estado.dia, RF.PAIS.dias + 1) - 1;
    return [
      { tipo: 'fin', titulo: 'FIN · ' + f.titulo, texto: f.texto },
      { tipo: 'calle', titulo: 'QUÉ FUE DE ELLOS', texto: epilogos.join('\n\n') },
      { tipo: 'sistema', titulo: 'TU LEGADO', texto: 'Días en el poder: ' + dias + '. Decretos firmados: ' + estado.historial.length + '.\nEscribe "reiniciar" para gobernar otra vez.' }
    ];
  }

  RF.narrador = { intro, turno, decreto, cierreDia, dilema, decision, tipoDecreto, confuso, pregunta, estadoPais, gabinete, historial, ayuda, final, EJEMPLOS };
})(globalThis.RF = globalThis.RF || {});
