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
  function confianza(ra, ro) {
    const parte = r => {
      const [a, b] = r.ranking;
      const margen = a.prob / (a.prob + b.prob);
      return r.evidencias[a.clase] ? 0.5 + margen / 2 : margen * 0.8;
    };
    return Math.round(parte(ra) * parte(ro) * 100);
  }

  let modelo = null;

  function entrenar() {
    const acc = crearClasificador();
    const obj = crearClasificador();
    const vocabPalabras = new Set();

    for (const [id, a] of Object.entries(RF.ACCIONES)) {
      for (const f of a.frases) {
        const ps = T.palabras(f.replace('{o}', ' '));
        ps.forEach(p => vocabPalabras.add(p));
        entrenarEjemplo(acc, id, rasgos(ps));
      }
    }
    for (const [id, o] of Object.entries(RF.OBJETOS)) {
      for (const f of o.formas) {
        const ps = T.palabras(f);
        ps.forEach(p => vocabPalabras.add(p));
        entrenarEjemplo(obj, id, rasgos(ps));
      }
    }
    calcularEvidencias(acc);
    calcularEvidencias(obj);
    modelo = { acc, obj, vocabPalabras };
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
    if (objId === 'LIDER') return 'Su Excelencia';
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
    const orig = original.replace(/[.,;:!¡?¿"«»()]/g, ' ').split(/\s+/).filter(Boolean);
    const norm = orig.map(T.normalizar);
    const esAccion = norm.map(p => {
      const r = T.raiz(p);
      return !!acc.evidencia[r] || (accion && acc.cuentas[accion][r] > 0 && !T.VACIAS.has(p) && !NEGACIONES_FUERA.has(p));
    });
    const limpiar = (ws, ns) => {
      const basura = /^(que|a|de|se|y|ya|no|ahora|es|sea|sera|son|esta|estan|queda|quedan|para|por|en|hoy|todos|todas|mi|decreto|ordeno)$/;
      while (ns.length && basura.test(ns[0])) { ws.shift(); ns.shift(); }
      while (ns.length && basura.test(ns[ns.length - 1])) { ws.pop(); ns.pop(); }
      return ws.slice(0, 6).join(' ');
    };
    const ultimo = esAccion.lastIndexOf(true);
    const primero = esAccion.indexOf(true);
    if (ultimo === -1) return '';
    let t = limpiar(orig.slice(ultimo + 1), norm.slice(ultimo + 1));
    if (!t && primero > 0) t = limpiar(orig.slice(0, primero), norm.slice(0, primero));
    return t.toLowerCase();
  }

  /*
   * Devuelve una interpretación:
   *  estado: 'ok' | 'preguntar_accion' | 'preguntar_objeto' | 'confuso'
   *  accion, objeto, nombreObjeto, intensidad, confianza, negado, opciones
   */
  function interpretar(texto) {
    if (!modelo) entrenar();
    const { acc, obj, vocabPalabras } = modelo;
    const crudas = T.palabras(texto);
    const ps = crudas.map(p => T.corregir(p, vocabPalabras));
    const rs = rasgos(ps);
    const raicesTexto = new Set(ps.map(T.raiz));
    const corregidas = crudas.map((p, i) => (p !== ps[i] ? [p, ps[i]] : null)).filter(Boolean);

    const ra = clasificar(acc, rs);
    const ro = clasificar(obj, rs);

    let accion = ra.ranking[0].clase;
    const hayAccion = !!ra.evidencias[accion] || ra.ranking[0].prob >= 0.6;
    const accionDudosa = !hayAccion && ra.conocidos > 0 && ra.ranking[0].prob >= 0.3;

    // Objeto: evitar que "yo"/"mi" gane cuando hay un objeto claro.
    let objeto = ro.ranking[0].clase;
    const evidObj = ro.evidencias;
    if (objeto === 'LIDER' && evidObj.LIDER && evidObj.LIDER.every(r => r === 'mi' || r === 'yo')) {
      const otro = ro.ranking.find(p => p.clase !== 'LIDER' && evidObj[p.clase]);
      if (otro) objeto = otro.clase;
    }
    const hayObjeto = !!evidObj[objeto];

    const res = {
      texto, corregidas, intensidad: intensidad(ps, T.normalizar(texto)),
      negado: false, opciones: [],
      confianza: confianza(ra, ro)
    };

    if (!hayAccion && !hayObjeto) { res.estado = 'confuso'; return res; }

    if (!hayAccion && !accionDudosa) {
      res.estado = 'preguntar_accion';
      res.objeto = objeto;
      res.nombreObjeto = formaMostrada(objeto, raicesTexto);
      res.opciones = ['PRIVATIZAR', 'SUBSIDIAR', 'PROHIBIR', 'INVERTIR'].map(a => ({ accion: a, objeto, nombreObjeto: res.nombreObjeto }));
      return res;
    }

    // Duda entre dos acciones parecidas sin palabras claras.
    const segunda = ra.ranking[1];
    if (accionDudosa || (!ra.evidencias[accion] && segunda.prob > ra.ranking[0].prob / 1.6)) {
      res.estado = 'preguntar_accion';
    }

    if (estaNegado(ps, acc, accion) && RF.ACCIONES[accion].inversa) {
      accion = RF.ACCIONES[accion].inversa;
      res.negado = true;
    }
    res.accion = accion;

    if (hayObjeto) {
      res.objeto = objeto;
      res.nombreObjeto = formaMostrada(objeto, raicesTexto);
    } else {
      const otro = extraerOtro(texto, acc, ra.ranking[0].clase);
      if (!otro) {
        res.estado = 'preguntar_objeto';
        return res;
      }
      res.objeto = 'OTRO';
      res.nombreObjeto = otro;
    }

    if (res.estado === 'preguntar_accion') {
      res.opciones = [ra.ranking[0].clase, segunda.clase].map(a => ({ accion: a, objeto: res.objeto, nombreObjeto: res.nombreObjeto }));
      return res;
    }
    res.estado = 'ok';
    return res;
  }

  RF.interprete = { entrenar, interpretar };
})(globalThis.RF = globalThis.RF || {});
