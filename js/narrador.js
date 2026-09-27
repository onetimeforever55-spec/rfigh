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

  const EJEMPLOS = ['prohibir el fútbol', 'el aire se vende', 'subir impuestos a los ricos', 'regalar comida', 'mano dura contra los ladrones', 'estatua de mí', 'invertir en hospitales', 'legalizar la marihuana'];

  function ayuda() {
    return [{
      tipo: 'sistema', titulo: 'CÓMO GOBERNAR',
      texto: 'Escribe un decreto con tus palabras y pulsa Decretar. El Intérprete intentará entenderlo.\n' +
        'Ejemplos: ' + EJEMPLOS.map(e => '"' + e + '"').join(', ') + '.\n' +
        'Puedes firmar hasta 3 decretos a la vez: "prohibir el fútbol y subir impuestos a los ricos".\n' +
        'Economía: "hacer un narcoestado", "toda la economía al carbón", "imprimir dinero", "nacionalizar el petróleo".\n' +
        'Poder: "crear una escuadra de represión", "fundar un partido único", "destituir a Cifuentes", "encarcelar a Valiente".\n' +
        'Cada pocos días surgirá un EVENTO: elige una de sus opciones antes de seguir gobernando.\n' +
        'Comandos: "estado" (cómo va el país), "economía" (el mercado), "poder" (ministros, instituciones y personas), "historial", "reiniciar".\n' +
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
        texto: Object.entries(RF.GABINETE).map(([id, m]) => RF.poder.ministro(estado, id).nombre + ', ' + m.cargo.toLowerCase()).join('. ') + '.'
      },
      {
        tipo: 'prensa', titulo: 'LA OPOSICIÓN Y EL MUNDO',
        texto: 'Ernesto Valiente, líder de la oposición, ya ha convocado a sus seguidores. El embajador de la Unión Atlántica observa desde su embajada con cara de preocupación.\n' +
          'La economía vive del plátano, el petróleo y el comercio. Escribe "economía" para ver el mercado.'
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
    return T.expandir(T.azar(pool));
  }

  // Todo lo que cuenta un decreto: Gaceta, números, prensa, gabinete y calle.
  const TIPO_TRATO = { matar: 'represion', encarcelar: 'represion', exiliar: 'libertad', destituir: 'general', premiar: 'culto', liberar: 'regalo' };

  function decretoPersona(estado, interp, res) {
    const bloques = [];
    const partes = ['INTÉRPRETE › ' + RF.poder.nombreTrato(res.trato).toUpperCase() + ' + ' + res.nombreObjeto.toUpperCase()];
    if (interp.heredada) partes.push('orden heredada de la frase anterior');
    bloques.push({ tipo: 'bot', texto: partes.join(' · ') });
    bloques.push({ tipo: 'gaceta', titulo: 'ORDEN EJECUTIVA Nº ' + res.numero + ' · DÍA ' + res.dia, texto: T.mayus(res.medida) + '. ' + res.especial });
    bloques.push({ tipo: 'efectos', deltas: res.deltas });
    for (const nota of res.notas) bloques.push({ tipo: 'nota', texto: nota });
    const tipo = TIPO_TRATO[res.trato] || 'general';
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
    if (lc) {
      let calle = lc.texto;
      if (Math.random() < 0.6) calle += '\n\n' + vozDeLaCalle(res, tipo);
      bloques.push({ tipo: 'calle', titulo: lc.titulo, texto: calle });
    }
    if (Math.random() < 0.3) { const e = eco(estado, res); if (e) bloques.push({ tipo: 'nota', texto: e }); }
    return bloques;
  }

  // Lo que pasa al terminar el día: caja, consecuencias, sucesos y cómo amanece mañana.
  function cierreDia(estado, res) {
    const bloques = [];
    const diario = res.diario || {};
    if (res.economia || Object.keys(diario).some(k => diario[k])) bloques.push({ tipo: 'efectos', rotulo: 'Fin del día', deltas: diario, economia: res.economia });
    for (const s of res.sucesos) {
      const etiqueta = { consecuencia: 'CONSECUENCIA', hito: 'HISTORIAS', umbral: 'ALERTA', azar: 'NOTICIA', mercado: 'MERCADO', institucion: 'RÉGIMEN' }[s.tipo];
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
      opciones: d.opciones.map(op => ({ texto: T.expandir(op.texto), resumen: RF.director.resumen(op) }))
    };
  }

  function decision(estado, r) {
    const bloques = [{ tipo: 'suceso', clase: 'decision', titulo: 'DECISIÓN · ' + (r.textoOpcion || T.expandir(r.opcion.texto)).toUpperCase(), texto: r.resultado, deltas: r.deltas }];
    if (r.fin) bloques.push(...final(estado));
    return bloques;
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

  function estadoPais(estado) {
    const lineas = RF.STATS.map(s => s.nombre.padEnd(9, ' ') + String(estado.stats[s.id]).padStart(3, ' ') + '  ' + barra(estado.stats[s.id]));
    const ing = estado.ingresos - 1;
    lineas.push('Balance diario del tesoro: ' + (ing > 0 ? '+' : '') + ing);
    lineas.push('Día ' + Math.min(estado.dia, RF.PAIS.dias) + ' de ' + RF.PAIS.dias + ' · Decretos firmados: ' + estado.historial.length);
    const humor = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (c.estado && c.estado !== 'libre' ? DESTINOS[c.estado] : c.animo > 25 ? 'te apoya' : c.animo < -25 ? 'te detesta' : 'desconfía'));
    const r = RF.economia.resumen(estado);
    lineas.push('Economía: PIB ' + r.pib + ' · paro ' + r.paro + '% · inflación ' + r.inflacion + '% (escribe "economía")');
    lineas.push('', 'La calle:', ...humor.map(h => '  ' + h));
    return [{ tipo: 'sistema', titulo: 'INFORME DE SITUACIÓN', texto: lineas.join('\n'), mono: true }];
  }

  const DESTINOS = { muerto: 'muerto', preso: 'en la cárcel', exiliado: 'en el exilio', fuera: 'destituido', libre: 'libre', aliado: 'tu aliado' };

  function gabinete(estado) {
    const lineas = Object.entries(RF.GABINETE).map(([id, m]) => {
      const v = Math.round(m.stats.reduce((s, k) => s + estado.stats[k], 0) / m.stats.length);
      const actitud = v >= 60 ? 'leal' : v >= 35 ? 'inquieto' : 'conspira';
      const g = RF.poder.ministro(estado, id);
      const caidos = g.caidos.map(c => c.nombre + ' (' + DESTINOS[c.destino] + ')').join(', ');
      return g.nombre + ' (' + m.cargo + '): ' + actitud + (caidos ? '\n   antes: ' + caidos : '');
    });
    const inst = Object.entries(estado.instituciones || {}).map(([id, i]) => '  ' + T.mayus(RF.INSTITUCIONES[id].nombre) + ' · nivel ' + i.nivel + ' · desde el día ' + i.desde);
    lineas.push('', 'Instituciones del régimen:', ...(inst.length ? inst : ['  ninguna (prueba "crear una red de espías")']));
    const per = estado.personas || {};
    lineas.push('', 'Ernesto Valiente, líder de la oposición: ' + (DESTINOS[per.valiente] || 'libre'));
    const gente = Object.entries(estado.ciudadanos).map(([id, c]) => RF.CIUDADANOS[id].nombre + ': ' + (DESTINOS[c.estado || 'libre']));
    lineas.push('La gente de a pie: ' + gente.join(' · '));
    return [{ tipo: 'sistema', titulo: 'EL PODER EN VALDORIA', texto: lineas.join('\n') }];
  }

  function economia(estado) {
    return [{ tipo: 'sistema', titulo: 'EL MERCADO DE VALDORIA', texto: RF.economia.informe(estado), mono: true }];
  }

  function historial(estado) {
    if (!estado.historial.length) return [{ tipo: 'nota', texto: 'Todavía no has firmado ningún decreto.' }];
    return [{ tipo: 'sistema', titulo: 'ARCHIVO DE DECRETOS', texto: estado.historial.map((h, i) => 'Nº ' + (i + 1) + ' · Día ' + h.dia + ': ' + T.mayus(h.medida)).join('\n') }];
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
    return [
      { tipo: 'fin', titulo: 'FIN · ' + f.titulo, texto: T.expandir(f.texto) },
      { tipo: 'calle', titulo: 'QUÉ FUE DE ELLOS', texto: epilogos.join('\n\n') },
      { tipo: 'sistema', titulo: 'TU LEGADO', texto: 'Días en el poder: ' + dias + '. Decretos firmados: ' + estado.historial.length + '.\nEscribe "reiniciar" para gobernar otra vez.' }
    ];
  }

  RF.narrador = { intro, turno, decreto, cierreDia, dilema, decision, tipoDecreto, confuso, pregunta, estadoPais, gabinete, economia, historial, ayuda, final, EJEMPLOS };
})(globalThis.RF = globalThis.RF || {});
