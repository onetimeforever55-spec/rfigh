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

  // ¿El decreto va sobre una persona concreta? ("matar a Garrote", "premiar a la canciller")
  function interpretarPersona(texto, crudas, ra, estado, corregidas, k) {
    if (!RF.poder) return null;
    const norm = crudas.join(' ');
    const persona = RF.poder.buscar(estado, norm);
    if (!persona) return null;
    let trato = RF.poder.detectarTrato(T.normalizar(texto) + ' ' + norm);
    const accion = ra.ranking[0].clase;
    if (!trato && ra.evidencias[accion] && TRATO_DE_ACCION[accion]) trato = accion === 'CASTIGAR' && k > 1 ? 'matar' : TRATO_DE_ACCION[accion];
    const base = { texto, corregidas, tipo: 'persona', persona: persona.id, caido: persona.caido, intensidad: 1, opciones: [], confianza: 90 };
    const nombre = persona.caido ? persona.caido.nombre : estado ? RF.poder.nombrePersona(estado, persona.id) : persona.id;
    if (trato) return Object.assign(base, { estado: 'ok', trato, nombreObjeto: nombre });
    // Nombrado, pero sin decir qué hacer: si hay otra acción clara, no era un decreto sobre la persona.
    if (ra.evidencias[accion]) return null;
    const tratos = estado ? RF.poder.tratosPosibles(estado, persona.id) : ['destituir', 'premiar', 'encarcelar'];
    return Object.assign(base, { estado: 'preguntar_trato', nombreObjeto: nombre, opciones: tratos.map(t => Object.assign({}, base, { estado: 'ok', trato: t, nombreObjeto: nombre })) });
  }

  function interpretar(texto, estado) {
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
      res.sinAccion = true;
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
      // Objeto desconocido ("los calcetines"), para todos ("subir impuestos") o falta el objeto.
      const otro = extraerOtro(texto, acc, ra.ranking[0].clase);
      const paraTodos = /\b(todos|todo el mundo|gente|pueblo|poblacion|ciudadanos|valdorianos|nadie)\b/.test(T.normalizar(texto));
      if (otro) {
        res.objeto = 'OTRO';
        res.nombreObjeto = otro;
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

  RF.interprete = { entrenar, interpretar, interpretarVarios };
})(globalThis.RF = globalThis.RF || {});
