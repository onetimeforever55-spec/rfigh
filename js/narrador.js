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

  function turno(estado, interp, res) {
    const n = estado.historial.length;
    const bloques = [];
    const partes = ['INTÉRPRETE › ' + RF.ACCIONES[res.accion].nombre.toUpperCase() + ' + ' + (res.objeto === 'OTRO' ? '"' + res.nombreObjeto + '" (desconocido)' : res.nombreObjeto.toUpperCase())];
    if (interp.confianza != null) partes.push(interp.confianza + '% seguro');
    if (interp.negado) partes.push('negación detectada');
    if (interp.intensidad > 1) partes.push('intensidad alta');
    if (interp.intensidad < 1) partes.push('intensidad baja');
    if (interp.corregidas && interp.corregidas.length) partes.push('corregí ' + interp.corregidas.map(([a, b]) => a + '→' + b).join(', '));
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });

    let gaceta = T.mayus(res.medida) + '.';
    if (res.especial) gaceta += ' ' + res.especial;
    bloques.push({ tipo: 'gaceta', titulo: 'DECRETO Nº ' + n + ' · DÍA ' + res.dia, texto: gaceta });
    bloques.push({ tipo: 'efectos', deltas: res.deltas, economia: res.economia, cambioIngresos: res.cambioIngresos, ingresos: estado.ingresos });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });

    const lm = lineaMinistro(estado, res);
    bloques.push({ tipo: 'cupula', titulo: lm.titulo, texto: lm.texto });
    const lc = lineaCiudadano(estado, res);
    bloques.push({ tipo: 'calle', titulo: lc.titulo, texto: lc.texto });

    for (const s of res.sucesos) {
      const etiqueta = { consecuencia: 'CONSECUENCIA', hito: 'HISTORIAS', umbral: 'ALERTA', azar: 'NOTICIA' }[s.tipo];
      bloques.push({ tipo: 'suceso', clase: s.tipo, titulo: etiqueta + ' · ' + s.titulo.toUpperCase(), texto: s.texto, deltas: s.deltas });
    }
    if (res.fin) bloques.push(...final(estado));
    else if (res.programadas) bloques.push({ tipo: 'nota', texto: 'Radio Pasillo: dicen que esto todavía va a traer cola.' });
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

  RF.narrador = { intro, turno, confuso, pregunta, estadoPais, gabinete, historial, ayuda, final, EJEMPLOS };
})(globalThis.RF = globalThis.RF || {});
