/*
 * EL INTÉRPRETE
 * Un pequeño bot que entiende decretos escritos libremente.
 *
 * Usa dos clasificadores Naive Bayes (uno para la ACCIÓN y otro para el OBJETO)
 * entrenados con las frases de ejemplo de acciones.js y objetos.js.
 * Además corrige faltas de ortografía, detecta negaciones ("ya no se vende...")
 * e intensidad ("subir MUCHO los impuestos").
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const ALFA = 0.5;
  const NEGACIONES_FUERA = new Set(['no', 'nunca', 'jamas', 'ya', 'nadie']);

  const FUERTES = new Set(['mucho', 'muchisimo', 'muchos', 'doble', 'duplicar', 'triple', 'triplicar', 'totalmente',
    'completamente', 'absolutamente', 'ejecutar', 'fusilar', 'matar', 'muerte', 'exterminar', 'radical', 'brutal',
    'masivo', 'masivamente', 'enorme', 'extremo', 'terminantemente', 'aplastar']);
  const SUAVES = new Set(['poco', 'poquito', 'ligeramente', 'algo', 'levemente', 'moderado', 'moderadamente',
    'simbolico', 'temporalmente', 'leve', 'tantito']);

  // Convierte un texto en rasgos: raíces de palabras con significado + pares de raíces.
  function rasgos(palabras) {
    const utiles = palabras.filter(p => !T.VACIAS.has(p));
    const raices = utiles.map(T.raiz);
    const out = raices.slice();
    // La palabra exacta también cuenta ("impuesto" no es igual que "impuestos").
    utiles.forEach((p, i) => { if (p !== raices[i]) out.push('=' + p); });
    for (let i = 0; i < raices.length - 1; i++) out.push(raices[i] + '_' + raices[i + 1]);
    return out;
  }

  function crearClasificador() {
    return { cuentas: {}, totales: {}, vocab: new Set(), clases: [] };
  }

  function entrenarEjemplo(clf, clase, rs) {
    if (!clf.cuentas[clase]) { clf.cuentas[clase] = {}; clf.totales[clase] = 0; clf.clases.push(clase); }
    for (const r of rs) {
      clf.cuentas[clase][r] = (clf.cuentas[clase][r] || 0) + 1;
      clf.totales[clase]++;
      clf.vocab.add(r);
    }
  }

  // Un rasgo es "evidencia" de una clase si aparece sobre todo en esa clase.
  function calcularEvidencias(clf) {
    clf.evidencia = {};
    for (const r of clf.vocab) {
      if (r.includes('_')) continue;
      let suma = 0, mejor = null, mejorF = 0;
      for (const c of clf.clases) {
        const f = (clf.cuentas[c][r] || 0) / clf.totales[c];
        suma += f;
        if (f > mejorF) { mejorF = f; mejor = c; }
      }
      if (suma > 0 && mejorF / suma >= 0.6) clf.evidencia[r] = mejor;
    }
  }

  function clasificar(clf, rs) {
    const conocidos = rs.filter(r => clf.vocab.has(r));
    const V = clf.vocab.size;
    const puntos = clf.clases.map(c => {
      let lp = 0;
      for (const r of conocidos) lp += Math.log(((clf.cuentas[c][r] || 0) + ALFA) / (clf.totales[c] + ALFA * V));
      return { clase: c, lp };
    });
    const max = Math.max(...puntos.map(p => p.lp));
    let suma = 0;
    for (const p of puntos) { p.prob = Math.exp(p.lp - max); suma += p.prob; }
    for (const p of puntos) p.prob /= suma;
    puntos.sort((x, y) => y.prob - x.prob);
    const evid = {};
    for (const r of conocidos) if (clf.evidencia[r]) (evid[clf.evidencia[r]] = evid[clf.evidencia[r]] || []).push(r);
    return { ranking: puntos, evidencias: evid, conocidos: conocidos.length };
  }

  // Seguridad del bot: margen frente a la segunda opción, y si hubo palabras claras.
  // Lo aprendido decide por votos: cada palabra que la IA enseñó señala una clase; gana la que tiene
  // más palabras a favor, si no hay empate.
  function aprendido(clf, rs) {
    if (!clf) return null;
    const votos = Object.entries(clasificar(clf, rs).evidencias).map(([c, l]) => [c, new Set(l.map(r => r.replace('=', ''))).size]).sort((x, y) => y[1] - x[1]);
    if (!votos.length || (votos[1] && votos[1][1] === votos[0][1])) return null;
    return votos[0][0];
  }

  // Un tema aprendido solo cuenta si lo señala una palabra que el bot de fábrica no conocía ("Afganistán", "glásnost").
  function temaAprendido(m, rs) {
    if (!m.temaL) return null;
    const r = clasificar(m.temaL, rs);
    const c = r.ranking[0].clase, ev = r.evidencias[c] || [];
    const nuevas = ev.filter(f => !f.includes('_') && !m.conocidas.has(f.replace('=', '')));
    const rival = Object.entries(r.evidencias).some(([k, l]) => k !== c && l.length >= ev.length);
    return nuevas.length && !rival && RF.TEMAS[c] ? c : null;
  }

  // La dirección de un tema aprendido: las palabras del propio tema ("prohibir", "acabar con"...) o, si no las hay,
  // lo que dicen las lecciones de ese tema que comparten palabras con el decreto.
  function direccionAprendida(tema, n, raices) {
    const t = RF.TEMAS[tema];
    if ((t.contraRe || RF.CONTRA).test(n) || (!t.sinParar && RF.PARAR.test(n))) return 'contra';
    const votos = { favor: 0, contra: 0, privada: 0 };
    for (const x of RF.aprendiz ? RF.aprendiz.todos() : []) {
      if (x.etiqueta.tema !== tema) continue;
      let comun = 0;
      for (const r of x.r) if (raices.has(r)) comun++;
      votos[x.etiqueta.dir] += comun;
    }
    return votos.contra > votos.favor ? 'contra' : 'favor';
  }

  function confianza(ra, ro) {
    const parte = r => {
      const [a, b] = r.ranking;
      const margen = a.prob / (a.prob + b.prob);
      return r.evidencias[a.clase] ? 0.5 + margen / 2 : margen * 0.8;
    };
    return Math.round(parte(ra) * parte(ro) * 100);
  }

  let modelo = null;

  // Traduce jerga y sinónimos ("tombos" → "policias") a palabras que el bot conoce.
  function sinonimo(p) {
    return RF.SINONIMOS && Object.prototype.hasOwnProperty.call(RF.SINONIMOS, p) ? RF.SINONIMOS[p] : null;
  }

  function traducir(texto) {
    let n = T.normalizar(texto);
    for (const [re, rep] of RF.SINONIMOS_FRASES || []) n = n.replace(re, rep);
    const out = [];
    for (const p of n.split(' ')) {
      const s = sinonimo(p);
      if (s) out.push(...T.palabras(s)); else if (p) out.push(p);
    }
    return out;
  }

  function entrenar() {
    const acc = crearClasificador();
    const obj = crearClasificador();
    const vocabPalabras = new Set();

    for (const [id, a] of Object.entries(RF.ACCIONES)) {
      for (const f of a.frases) {
        const ps = traducir(f.replace('{o}', ' '));
        ps.forEach(p => vocabPalabras.add(p));
        entrenarEjemplo(acc, id, rasgos(ps));
      }
    }
    for (const [id, o] of Object.entries(RF.OBJETOS)) {
      for (const f of o.formas) {
        const ps = traducir(f);
        ps.forEach(p => vocabPalabras.add(p));
        entrenarEjemplo(obj, id, rasgos(ps));
      }
    }
    // Lo que el bot ha aprendido de la IA va a un segundo par de clasificadores, aparte: solo deciden
    // cuando los de fábrica no tienen ninguna palabra clara. Así lo aprendido amplía lo que entiende
    // sin mover nada de lo que ya entendía. Sus palabras entran en el vocabulario (para que el
    // corrector no convierta "soju" en otra cosa).
    // Los verbos que ya conoce ("subir", "prohibir") no votan por un objeto: "subir el billete del metro"
    // no debe enseñarle que "subir" significa el transporte.
    const accL = crearClasificador(), objL = crearClasificador(), temaL = crearClasificador();
    const deAccion = new Set(acc.vocab), deObjeto = new Set(obj.vocab);
    const sin = (rs, ajeno) => rs.filter(r => r.split('_').every(p => !ajeno.has(p)));
    for (const x of RF.aprendiz ? RF.aprendiz.todos() : []) {
      const ps = traducir(x.texto);
      ps.forEach(p => vocabPalabras.add(p));
      const rs = rasgos(ps);
      // Los temas aprendidos ("retirar las tropas de Afganistán" = la paz) enseñan su vocabulario propio.
      if (x.etiqueta.tema) { entrenarEjemplo(temaL, x.etiqueta.tema, rs); continue; }
      entrenarEjemplo(accL, x.etiqueta.accion, rs);
      entrenarEjemplo(objL, x.etiqueta.objeto, sin(rs, deAccion));
    }
    if (accL.clases.length > 1) calcularEvidencias(accL);
    if (objL.clases.length > 1) calcularEvidencias(objL);
    if (temaL.clases.length > 1) calcularEvidencias(temaL);
    calcularEvidencias(acc);
    calcularEvidencias(obj);
    modelo = { acc, obj, vocabPalabras, accL: accL.clases.length > 1 ? accL : null, objL: objL.clases.length > 1 ? objL : null,
      temaL: temaL.clases.length > 1 ? temaL : null, conocidas: new Set([...deAccion, ...deObjeto]) };
    return modelo;
  }

  function intensidad(ps, textoNorm) {
    let k = 1;
    if (ps.some(p => FUERTES.has(p))) k = 1.5;
    if (ps.some(p => SUAVES.has(p)) || /\bun poco\b/.test(textoNorm)) k = 0.6;
    const pct = textoNorm.match(/(\d+)\s*%/);
    if (pct) { const n = +pct[1]; k = n >= 50 ? 1.5 : n <= 10 ? 0.6 : 1; }
    return k;
  }

  // ¿Hay una negación justo antes de la palabra que marca la acción?
  function estaNegado(ps, clf, accion) {
    for (let i = 0; i < ps.length; i++) {
      const r = T.raiz(ps[i]);
      if (clf.evidencia[r] !== accion || NEGACIONES_FUERA.has(ps[i])) continue;
      for (let j = Math.max(0, i - 3); j < i; j++) {
        // "no pagan impuestos" ya significa bajar impuestos: la negación es parte de la frase aprendida.
        if (T.NEGACIONES.has(ps[j]) && !clf.cuentas[accion][T.raiz(ps[j]) + '_' + r]) return true;
      }
    }
    return false;
  }

  // Elige la forma del objeto que mejor encaja con lo que escribió el jugador ("el reguetón").
  function formaMostrada(objId, raicesTexto) {
    const o = RF.OBJETOS[objId];
    if (objId === 'LIDER') return 'el Líder Supremo';
    if (o.institucion) return o.nombre;
    let mejor = o.nombre, mejorN = 0;
    for (const f of o.formas) {
      const rf = T.palabras(f).filter(p => !T.VACIAS.has(p)).map(T.raiz);
      const n = rf.filter(r => raicesTexto.has(r)).length;
      if (n > mejorN) { mejor = f; mejorN = n; }
    }
    return mejor;
  }

  // Si el objeto es desconocido ("los calcetines"), rescatamos el texto original.
  function extraerOtro(original, acc, accion) {
    // Trabajamos sobre el texto traducido, pero recuperamos las tildes que escribió el jugador.
    const conTildes = {};
    for (const w of original.replace(/[.,;:!¡?¿"«»()]/g, ' ').split(/\s+/).filter(Boolean)) conTildes[T.normalizar(w)] = w.toLowerCase();
    const norm = traducir(original);
    const orig = norm.map(p => conTildes[p] || p);
    const esAccion = norm.map(p => {
      const r = T.raiz(p);
      return !!acc.evidencia[r] || (accion && acc.cuentas[accion][r] > 0 && !T.VACIAS.has(p) && !NEGACIONES_FUERA.has(p));
    });
    const limpiar = (ws, ns) => {
      const basura = /^(que|a|de|se|y|ya|no|ahora|es|sea|sera|son|esta|estan|queda|quedan|para|por|en|hoy|todos|todas|mi|decreto|ordeno)$/;
      while (ns.length && basura.test(ns[0])) { ws.shift(); ns.shift(); }
      while (ns.length && basura.test(ns[ns.length - 1])) { ws.pop(); ns.pop(); }
      // Si solo quedan palabras vacías ("la gente"), no hay objeto propio.
      if (ns.every(p => T.VACIAS.has(p))) return '';
      return ws.slice(0, 6).join(' ');
    };
    const ultimo = esAccion.lastIndexOf(true);
    const primero = esAccion.indexOf(true);
    if (ultimo === -1) return '';
    let t = limpiar(orig.slice(ultimo + 1), norm.slice(ultimo + 1));
    if (!t && primero > 0) t = limpiar(orig.slice(0, primero), norm.slice(0, primero));
    return t;
  }

  /*
   * Devuelve una interpretación:
   *  estado: 'ok' | 'preguntar_accion' | 'preguntar_objeto' | 'confuso'
   *  accion, objeto, nombreObjeto, intensidad, confianza, negado, opciones
   */
  // Qué hacer con una persona según la acción que entendió el clasificador.
  const TRATO_DE_ACCION = { CASTIGAR: 'encarcelar', PROHIBIR: 'exiliar', RECORTAR: 'destituir', GLORIFICAR: 'premiar', SUBSIDIAR: 'premiar', INVERTIR: 'premiar', LEGALIZAR: 'liberar' };

  // ¿El decreto va sobre una persona concreta? ("matar a Jang", "premiar a la canciller")
  function interpretarPersona(texto, crudas, ra, estado, corregidas, k) {
    if (!RF.poder) return null;
    const norm = crudas.join(' ');
    const persona = RF.poder.buscar(estado, norm);
    if (!persona) return null;
    let trato = RF.poder.detectarTrato(T.normalizar(texto) + ' ' + norm);
    const secreto = RF.SECRETO ? RF.SECRETO.test(T.normalizar(texto)) : false;
    if (!trato && secreto && /accidente|desaparec/.test(T.normalizar(texto))) trato = 'matar';
    const accion = ra.ranking[0].clase;
    if (!trato && ra.evidencias[accion] && TRATO_DE_ACCION[accion]) trato = accion === 'CASTIGAR' && k > 1 ? 'matar' : TRATO_DE_ACCION[accion];
    const base = { texto, corregidas, tipo: 'persona', persona: persona.id, caido: persona.caido, intensidad: 1, opciones: [], confianza: 90, secreto };
    const nombre = persona.caido ? persona.caido.nombre : estado ? RF.poder.nombrePersona(estado, persona.id) : persona.id;
    if (trato) return Object.assign(base, { estado: 'ok', trato, nombreObjeto: nombre });
    // Nombrado, pero sin decir qué hacer: si hay otra acción clara, no era un decreto sobre la persona.
    if (ra.evidencias[accion]) return null;
    const tratos = estado ? RF.poder.tratosPosibles(estado, persona.id) : ['destituir', 'premiar', 'encarcelar'];
    return Object.assign(base, { estado: 'preguntar_trato', nombreObjeto: nombre, opciones: tratos.map(t => Object.assign({}, base, { estado: 'ok', trato: t, nombreObjeto: nombre })) });
  }

  // Devuelve { tema, accion, objeto, nombreObjeto } si el decreto trata de un tema duro (ver datos/temas.js).
  function detectarTema(n) {
    for (const [id, t] of Object.entries(RF.TEMAS || {})) {
      if (!t.re.test(n) || (t.no && t.no.test(n))) continue;
      const contra = (t.contraRe || RF.CONTRA).test(n) || (!t.sinParar && RF.PARAR.test(n));
      const dir = t.privatizar && t.privatizar.test(n) && t.privada ? 'privada' : contra ? 'contra' : 'favor';
      return { tema: id, dir, accion: { favor: 'LEGALIZAR', contra: 'PROHIBIR', privada: 'PRIVATIZAR' }[dir], objeto: id, nombreObjeto: t.nombre };
    }
    return null;
  }

  // Si el decreto nombra a una potencia sin ser un gesto diplomático ("instaurar la democracia con Estados Unidos"), se apunta como padrino.
  function interpretar(texto, estado) {
    const r = interpretarBase(texto, estado);
    if (r && r.tipo !== 'diplomacia' && RF.diplomacia) {
      const p = RF.diplomacia.buscar(T.normalizar(texto));
      if (p) r.padrino = p;
    }
    return r;
  }

  /*
   * Primero, lo aprendido de la IA: un decreto que la IA ya entendió (o uno casi igual) se entiende igual.
   * Un recuerdo parecido solo manda si el bot no lo entiende por sí solo o si el parecido es muy alto;
   * los temas reconocidos por su forma siguen mandando sobre los recuerdos aproximados.
   */
  function interpretarBase(texto, estado) {
    const rec = RF.aprendiz && RF.aprendiz.recordar(texto);
    if (rec && rec.sim >= 0.99) return desdeRecuerdo(texto, rec);
    const r = interpretarModelo(texto, estado);
    if (!rec || r.tipo === 'persona' || r.tipo === 'diplomacia' || (r.estado === 'ok' && r.tema)) return r;
    if (r.estado !== 'ok' || rec.sim >= 0.85 || (rec.sim >= 0.7 && comparteNueva(rec.ejemplo, texto))) return desdeRecuerdo(texto, rec);
    return r;
  }

  // ¿El decreto y el recuerdo comparten una palabra que el bot de fábrica no conocía ("Europa", "Afganistán")?
  function comparteNueva(ejemplo, texto) {
    if (!modelo) entrenar();
    const raices = new Set(traducir(texto).map(T.raiz));
    for (const r of ejemplo.r) if (raices.has(r) && !modelo.conocidas.has(r)) return true;
    return false;
  }

  function desdeRecuerdo(texto, rec) {
    const et = rec.ejemplo.etiqueta, n = T.normalizar(texto), ps = traducir(texto);
    const res = {
      texto, corregidas: [], intensidad: intensidad(ps, n), negado: false, opciones: [], estado: 'ok',
      confianza: Math.round(60 + 35 * rec.sim), secreto: RF.SECRETO ? RF.SECRETO.test(n) : false,
      aprendido: { sim: rec.sim, origen: rec.ejemplo.origen, de: rec.ejemplo.texto }, conceptosExtra: et.conceptos || []
    };
    if (et.tema) {
      const t = RF.TEMAS[et.tema];
      Object.assign(res, { tema: et.tema, dir: et.dir, accion: { favor: 'LEGALIZAR', contra: 'PROHIBIR', privada: 'PRIVATIZAR' }[et.dir], objeto: et.tema, nombreObjeto: t.nombre });
      if (t.destinoRe) {
        const m = t.destinoRe.exec(texto.trim().replace(/[.!¡?¿]+$/, ''));
        res.destino = m ? m[1].trim().replace(/\s+/g, ' ') : t.destino;
      }
    } else {
      Object.assign(res, { accion: et.accion, objeto: et.objeto, nombreObjeto: formaMostrada(et.objeto, new Set(ps.map(T.raiz))) });
    }
    return res;
  }

  function interpretarModelo(texto, estado) {
    if (!modelo) entrenar();
    const { acc, obj, vocabPalabras } = modelo;
    const crudas = traducir(texto);
    const ps = crudas.map(p => T.corregir(p, vocabPalabras)).flatMap(p => (sinonimo(p) ? T.palabras(sinonimo(p)) : [p]));
    const rs = rasgos(ps);
    const raicesTexto = new Set(ps.map(T.raiz));
    const corregidas = T.palabras(texto).map(p => [p, T.corregir(p, vocabPalabras)]).filter(([a, b]) => a !== b && !sinonimo(a));

    const ra = clasificar(acc, rs);
    const personal = interpretarPersona(texto, crudas, ra, estado, corregidas, intensidad(ps, T.normalizar(texto)));
    if (personal) return personal;
    // Temas duros (la esclavitud, la guerra, el aborto...): se reconocen por su forma y tienen sus propias reglas.
    const tema = detectarTema(T.normalizar(texto));
    // Diplomacia: un gesto hacia (o contra) una potencia vecina, si no es un tema duro ("declarar la guerra a Japón").
    // Un cambio de régimen "con ayuda de Estados Unidos" es un cambio de régimen con padrino, no un gesto diplomático.
    const nTexto = T.normalizar(texto);
    const regimen = /\b(democracia|democratic\w*|dictadura|monarquia|rey|reina|juche|junta|teocracia|elecciones libres)\b/.test(nTexto);
    const padrino = RF.diplomacia && RF.diplomacia.buscar(nTexto);
    const dip = !tema && !regimen && RF.diplomacia && RF.diplomacia.detectar(nTexto);
    if (dip) {
      return { texto, corregidas, intensidad: 1, negado: false, opciones: [], confianza: 90, estado: 'ok', tipo: 'diplomacia', pais: dip.pais, dir: dip.dir,
        nombreObjeto: RF.PAIS.relaciones[dip.pais].nombre, accion: 'DIPLOMACIA', objeto: dip.pais };
    }
    if (tema) {
      // A quién va dirigida una acción exterior ("vender armas a una guerrilla africana").
      const t = RF.TEMAS[tema.tema];
      if (t.destinoRe) {
        const m = t.destinoRe.exec(texto.trim().replace(/[.!¡?¿]+$/, ''));
        tema.destino = m ? m[1].trim().replace(/\s+/g, ' ') : t.destino;
      }
      return Object.assign({
        texto, corregidas, intensidad: 1, negado: false, opciones: [], confianza: 92, estado: 'ok',
        secreto: RF.SECRETO ? RF.SECRETO.test(T.normalizar(texto)) : false
      }, tema);
    }
    const ro = clasificar(obj, rs);

    // Si la favorita no tiene ninguna palabra clara pero otra sí ("ya no se regala comida"), gana la que la tiene.
    const conPalabras = ra.ranking.find(p => ra.evidencias[p.clase]);
    if (!ra.evidencias[ra.ranking[0].clase] && conPalabras) {
      ra.ranking.splice(ra.ranking.indexOf(conPalabras), 1);
      ra.ranking.unshift(conPalabras);
    }
    // Sin palabra clara de fábrica para la acción o el objeto: ¿hay una palabra nueva que la IA enseñó para un tema?
    if (!ra.evidencias[ra.ranking[0].clase] || !ro.evidencias[ro.ranking[0].clase]) {
      const tema = temaAprendido(modelo, rs);
      if (tema) {
        const dir = direccionAprendida(tema, T.normalizar(texto), new Set(ps.map(T.raiz)));
        return { texto, corregidas, intensidad: intensidad(ps, T.normalizar(texto)), negado: false, opciones: [], confianza: 70, estado: 'ok',
          secreto: RF.SECRETO ? RF.SECRETO.test(T.normalizar(texto)) : false, aprendido: { origen: 'palabras' },
          tema, dir, accion: { favor: 'LEGALIZAR', contra: 'PROHIBIR', privada: 'PRIVATIZAR' }[dir], objeto: tema, nombreObjeto: RF.TEMAS[tema].nombre };
      }
    }
    let accion = ra.ranking[0].clase;
    let hayAccion = !!ra.evidencias[accion] || ra.ranking[0].prob >= 0.6;
    let accionDudosa = !hayAccion && ra.conocidos > 0 && ra.ranking[0].prob >= 0.3;
    // Sin palabra clara de fábrica: lo aprendido de la IA.
    const aprendida = !hayAccion && aprendido(modelo.accL, rs);
    if (aprendida) { accion = aprendida; hayAccion = true; accionDudosa = false; }

    // Objeto: evitar que "yo"/"mi" gane cuando hay un objeto claro.
    let objeto = ro.ranking[0].clase;
    const evidObj = ro.evidencias;
    if (objeto === 'LIDER' && evidObj.LIDER && evidObj.LIDER.every(r => r === 'mi' || r === 'yo')) {
      const otro = ro.ranking.find(p => p.clase !== 'LIDER' && evidObj[p.clase]);
      if (otro) objeto = otro.clase;
    }
    let hayObjeto = !!evidObj[objeto];
    const objAprendido = !hayObjeto && aprendido(modelo.objL, rs);
    if (objAprendido) { objeto = objAprendido; hayObjeto = true; }

    const res = {
      texto, corregidas, intensidad: intensidad(ps, T.normalizar(texto)),
      secreto: RF.SECRETO ? RF.SECRETO.test(T.normalizar(texto)) : false,
      negado: false, opciones: [],
      confianza: confianza(ra, ro)
    };
    if (aprendida || objAprendido) res.aprendido = { origen: 'palabras' };

    if (!hayAccion && !hayObjeto) { res.estado = 'confuso'; return res; }

    if (!hayAccion && !accionDudosa) {
      res.estado = 'preguntar_accion';
      res.sinAccion = true;
      res.objeto = objeto;
      res.nombreObjeto = formaMostrada(objeto, raicesTexto);
      res.opciones = ['PRIVATIZAR', 'SUBSIDIAR', 'PROHIBIR', 'INVERTIR'].map(a => ({ accion: a, objeto, nombreObjeto: res.nombreObjeto }));
      return res;
    }

    // Duda entre dos acciones parecidas sin palabras claras.
    const segunda = ra.ranking[1];
    if (!aprendida && (accionDudosa || (!ra.evidencias[accion] && segunda.prob > ra.ranking[0].prob / 1.6))) {
      res.estado = 'preguntar_accion';
    }

    if (!aprendida && estaNegado(ps, acc, accion) && RF.ACCIONES[accion].inversa) {
      accion = RF.ACCIONES[accion].inversa;
      res.negado = true;
    }
    res.accion = accion;

    if (hayObjeto) {
      res.objeto = objeto;
      res.nombreObjeto = formaMostrada(objeto, raicesTexto);
    } else {
      // Objeto desconocido ("los calcetines"), para todos ("subir impuestos") o falta el objeto.
      const otro = extraerOtro(texto, acc, ra.ranking[0].clase);
      const paraTodos = /\b(todos|todo el mundo|gente|pueblo|poblacion|ciudadanos|norcoreanos|nadie)\b/.test(T.normalizar(texto));
      if (otro) {
        res.objeto = 'OTRO';
        res.nombreObjeto = otro;
      } else if (accion === 'DEROGAR') {
        res.objeto = 'ULTIMA';
        res.nombreObjeto = 'el último decreto';
      } else if (accion === 'SUBIR_IMPUESTO' || accion === 'BAJAR_IMPUESTO' || paraTodos) {
        res.objeto = 'GENERAL';
        res.nombreObjeto = RF.OBJETOS.GENERAL.nombre;
      } else {
        res.estado = 'preguntar_objeto';
        return res;
      }
    }

    if (res.estado === 'preguntar_accion') {
      res.opciones = [ra.ranking[0].clase, segunda.clase].map(a => ({ accion: a, objeto: res.objeto, nombreObjeto: res.nombreObjeto }));
      return res;
    }
    res.estado = 'ok';
    return res;
  }

  /*
   * Varios decretos en una frase: "prohibir el fútbol y subir impuestos a los ricos".
   * Si una parte solo nombra un objeto ("prohibir el fútbol y la música"), hereda la acción anterior.
   * Devuelve una lista de interpretaciones (máximo 3).
   */
  const SEPARADOR = /\s*[,;]\s*|\s+(?:y|e|ademas|además|tambien|también|luego|despues|después)\s+/i;
  const RELLENO = /^(y|e|ademas|además|tambien|también|luego|despues|después|que)\s+/i;

  function interpretarVarios(texto, estado) {
    // Una frase que la IA ya enseñó entera no se trocea.
    const rec = RF.aprendiz && RF.aprendiz.recordar(texto, 0.99);
    if (rec) return [interpretar(texto, estado)];
    const partes = texto.split(SEPARADOR).map(p => p.replace(RELLENO, '').trim()).filter(Boolean);
    if (partes.length <= 1) return [interpretar(texto, estado)];
    const grupos = [];
    for (const parte of partes) {
      const r = interpretar(parte, estado);
      const previo = grupos[grupos.length - 1];
      if (r.estado === 'ok') grupos.push({ texto: parte, r });
      else if (r.estado === 'preguntar_trato' && previo && previo.r.tipo === 'persona') {
        grupos.push({ texto: parte, r: Object.assign({}, r, { estado: 'ok', trato: previo.r.trato, heredada: true, opciones: [] }) });
      }
      else if (r.sinAccion && previo && previo.r.estado === 'ok') {
        grupos.push({ texto: parte, r: Object.assign({}, r, { estado: 'ok', accion: previo.r.accion, intensidad: previo.r.intensidad, negado: previo.r.negado, heredada: true, opciones: [] }) });
      } else if (previo) {
        previo.texto += ' y ' + parte;
        previo.r = interpretar(previo.texto, estado);
      } else grupos.push({ texto: parte, r });
    }
    if (grupos.length === 1) return [grupos[0].r];
    if (grupos.some(g => g.r.estado !== 'ok')) return [interpretar(texto, estado)];
    return grupos.slice(0, 3).map(g => Object.assign(g.r, { texto: g.texto }));
  }

  RF.interprete = { entrenar, interpretar, interpretarVarios, modelo: () => modelo, rasgos, traducir, clasificar };
})(globalThis.RF = globalThis.RF || {});
