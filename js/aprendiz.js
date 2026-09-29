/*
 * EL APRENDIZ
 * El intérprete local aprende de la IA. Cada vez que el Consejo con IA entiende un decreto, devuelve
 * también su "clave": cómo lo clasificaría el bot local (acción + objeto, o tema + dirección) y qué
 * conceptos de la biblioteca explican sus consecuencias. El aprendiz la guarda y la usa de dos formas:
 *   - como EJEMPLO: se añade a los clasificadores Naive Bayes, que se reentrenan con él (y sus palabras
 *     entran en el vocabulario, para que el corrector no las "arregle");
 *   - como RECUERDO: si luego se escribe un decreto igual o muy parecido, se entiende igual que lo
 *     entendió la IA, con sus mismos conceptos, aunque la IA esté apagada.
 * El comando "entrenar" le pone un examen: la IA inventa decretos variados, el bot intenta entenderlos,
 * y los que falla se aprenden.
 * Dónde vive lo aprendido: dentro de claude.ai, en la base de datos del juego (colección "lecciones"),
 * que sobrevive a otros dispositivos y a borrar el navegador, y que Claude puede leer y revisar sin que
 * nadie le pegue nada; fuera de claude.ai (o si no está disponible), en este navegador (localStorage).
 * datos/aprendidos.js trae una base ya enseñada y revisada.
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const CLAVE = 'pionyang-aprendiz-v1';
  const MAX = 600;
  const SIMILAR = 0.65;
  const NIEGAN = new Set(['no', 'nunca', 'jamas', 'nadie', 'ningun', 'ninguna', 'sin']);

  const COLECCION = 'lecciones';
  let propios = null; // lo aprendido (copia local; la base de datos manda cuando la hay)
  let nube = null;    // la base de datos del juego en claude.ai, o null

  function raices(texto) {
    return new Set(T.palabras(T.normalizar(texto)).filter(p => !T.VACIAS.has(p) || NIEGAN.has(p)).map(T.raiz));
  }

  function similitud(a, b) {
    if (!a.size || !b.size) return 0;
    let comun = 0;
    for (const r of a) if (b.has(r)) comun++;
    return comun / (a.size + b.size - comun);
  }

  // Una etiqueta solo vale si usa las piezas que el motor conoce.
  function validar(et) {
    if (!et || typeof et !== 'object') return null;
    const up = x => (typeof x === 'string' ? x.trim().toUpperCase() : '');
    const conceptos = (Array.isArray(et.conceptos) ? et.conceptos : [])
      .filter(id => typeof id === 'string' && (RF.CONCEPTOS || []).some(k => k.id === id)).slice(0, 3);
    const tema = up(et.tema);
    if (tema && RF.TEMAS && RF.TEMAS[tema]) {
      const dir = et.dir === 'contra' ? 'contra' : et.dir === 'privada' && RF.TEMAS[tema].privada ? 'privada' : 'favor';
      return { tema, dir, conceptos };
    }
    const accion = up(et.accion), objeto = up(et.objeto);
    if (RF.ACCIONES[accion] && RF.OBJETOS[objeto] && !['OTRO', 'ULTIMA'].includes(objeto)) return { accion, objeto, conceptos };
    return null;
  }

  function cargar() {
    if (propios) return propios;
    propios = [];
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      if (Array.isArray(d)) for (const x of d) { const et = validar(x); if (et && x.texto) propios.push(completar(x.texto, et, x.origen || 'ia')); }
    } catch (e) { /* sin memoria en este navegador */ }
    return propios;
  }

  // El id de una lección en la base de datos: un resumen corto de su texto normalizado.
  function idDe(n) {
    let h = 2166136261;
    for (let i = 0; i < n.length; i++) { h ^= n.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'l-' + (h >>> 0).toString(36) + '-' + n.length;
  }

  function cuerpo(x) {
    return Object.assign({ texto: x.texto, origen: x.origen, t: Date.now() }, x.etiqueta);
  }

  function subir(x) {
    if (!nube) return;
    nube.collection(COLECCION).doc(idDe(x.n)).set(cuerpo(x)).catch(() => { /* queda en la copia local */ });
  }

  // Dentro de claude.ai: trae las lecciones de la base de datos y sube las que solo estaban en este
  // navegador. Devuelve cuántas lecciones hay en la nube, o null si no hay base de datos.
  async function conectar() {
    try {
      if (!globalThis.claude || typeof globalThis.claude.use !== 'function') return null;
      const db = await globalThis.claude.use('db');
      if (!db) return null;
      const snap = await db.collection(COLECCION).limit(MAX).get();
      nube = db;
      cargar();
      const enNube = new Set();
      for (const d of snap.docs) {
        const x = d.data() || {};
        const et = validar(x);
        if (!et || typeof x.texto !== 'string') continue;
        const l = completar(x.texto, et, x.origen || 'ia');
        enNube.add(l.n);
        const i = propios.findIndex(p => p.n === l.n);
        if (i >= 0) propios[i] = l; else propios.push(l); // la nube manda (Claude puede haberla corregido)
      }
      for (const x of propios) if (!enNube.has(x.n)) await nube.collection(COLECCION).doc(idDe(x.n)).set(cuerpo(x)).catch(() => {});
      guardar();
      if (RF.interprete) RF.interprete.entrenar();
      return propios.length;
    } catch (e) {
      nube = null;
      return null;
    }
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(propios.map(x => Object.assign({ texto: x.texto, origen: x.origen }, x.etiqueta))));
    } catch (e) { /* sin memoria en este navegador */ }
  }

  function completar(texto, etiqueta, origen) {
    return { texto, n: T.normalizar(texto), r: raices(texto), etiqueta, origen };
  }

  let base = null;
  function todos() {
    if (!base) base = (RF.APRENDIDOS || []).map(([texto, et]) => { const v = validar(et); return v && completar(texto, v, 'base'); }).filter(Boolean);
    // Las lecciones de fábrica están revisadas: mandan sobre una guardada con el mismo texto.
    const deFabrica = new Set(base.map(x => x.n));
    return base.concat(cargar().filter(x => !deFabrica.has(x.n)));
  }

  // Guarda un ejemplo. Devuelve true si es nuevo (o corrige uno anterior).
  function aprender(texto, etiqueta, origen, diferir) {
    const et = validar(etiqueta);
    if (!et || !texto || texto.length > 160) return false;
    cargar();
    const n = T.normalizar(texto);
    const previo = propios.findIndex(x => x.n === n);
    if (previo >= 0) {
      if (JSON.stringify(propios[previo].etiqueta) === JSON.stringify(et)) return false;
      propios.splice(previo, 1);
    }
    const nueva = completar(texto, et, origen || 'ia');
    propios.push(nueva);
    if (propios.length > MAX) propios.splice(0, propios.length - MAX);
    guardar();
    subir(nueva);
    if (RF.interprete && !diferir) RF.interprete.entrenar();
    return true;
  }

  // El recuerdo más parecido a un decreto (o null).
  function recordar(texto, minimo) {
    const n = T.normalizar(texto), r = raices(texto);
    let mejor = null, sim = 0;
    for (const x of todos()) {
      const s = x.n === n ? 1 : similitud(r, x.r);
      if (s > sim) { sim = s; mejor = x; }
    }
    return mejor && sim >= (minimo || SIMILAR) ? { ejemplo: mejor, sim } : null;
  }

  // Lo que la IA entendió de un decreto (su ficha) se convierte en lección para el bot.
  function deFicha(texto, ficha) {
    if (!ficha || ficha.entendido === false || !ficha.clave) return null;
    const leyes = Array.isArray(ficha.leyes) ? ficha.leyes.length : 0;
    const personas = Array.isArray(ficha.personas) ? ficha.personas.length : 0;
    if (leyes > 1 || personas) return null; // varias órdenes a la vez: no es un buen ejemplo
    const et = validar(ficha.clave);
    if (!et) return null;
    return aprender(texto, et, 'ia') ? et : null;
  }

  function describir(et) {
    if (et.tema) return RF.TEMAS[et.tema].nombre + (et.dir === 'contra' ? ' (en contra)' : et.dir === 'privada' ? ' (privatizar)' : '');
    return RF.ACCIONES[et.accion].nombre.toLowerCase() + ' ' + RF.OBJETOS[et.objeto].nombre;
  }

  // ¿El bot entiende ya este decreto como dice la etiqueta?
  function acierta(texto, etiqueta, estado) {
    const et = validar(etiqueta);
    if (!et) return null;
    const i = RF.interprete.interpretar(texto, estado);
    if (i.estado !== 'ok') return false;
    if (et.tema) return i.tema === et.tema && i.dir === et.dir;
    return !i.tema && i.accion === et.accion && i.objeto === et.objeto;
  }

  // ---------- El examen: la IA inventa decretos, el bot los intenta, los fallos se aprenden ----------
  function listas() {
    return [
      'ACCIONES: ' + Object.entries(RF.ACCIONES).map(([id, a]) => id + ' (' + a.nombre.toLowerCase() + ')').join(', '),
      'OBJETOS: ' + Object.keys(RF.OBJETOS).filter(id => !['OTRO', 'ULTIMA'].includes(id)).join(', '),
      'TEMAS (políticas con reglas propias; si el decreto encaja en uno, usa "tema" y "dir" en vez de acción y objeto): ' +
        Object.entries(RF.TEMAS).map(([id, t]) => id + ' (' + t.nombre + ')').join(', '),
      'CONCEPTOS (ids): ' + (RF.CONCEPTOS || []).filter(k => k.area !== 'historia').map(k => k.id).join(', ')
    ].join('\n');
  }

  const EXAMEN = 'Eres el profesor del intérprete local de un juego satírico de gobierno de Corea del Norte en español. El jugador escribe decretos en lenguaje libre. ' +
    'Inventa decretos VARIADOS como los escribiría un jugador real: frases cortas y largas, coloquiales, con jerga de España y de Latinoamérica, alguna falta de ortografía, órdenes absurdas, economía, sociedad, ejército, exterior. ' +
    'Evita repetir los ejemplos obvios; busca formas de decirlo que un bot sencillo no entendería. Para cada uno pon su clave: o bien "tema" + "dir" ("favor" o "contra"), o bien "accion" + "objeto", y de 0 a 2 "conceptos" de la lista que expliquen sus consecuencias. ' +
    'Solo decretos de una orden (no varias a la vez) y sin personas concretas.\n\n';

  async function examen(n, estado, alTexto) {
    n = Math.max(5, Math.min(30, n || 15));
    const contenido = EXAMEN + listas() + '\n\nDevuelve SOLO un JSON: {"decretos": [{"texto": "...", "tema": "...", "dir": "favor", "conceptos": []}, {"texto": "...", "accion": "...", "objeto": "...", "conceptos": []}]} con ' + n + ' decretos.';
    const r = await RF.narradorIA.generar('Responde solo con JSON válido, sin markdown.', contenido, alTexto, 4000);
    const d = RF.consejoIA.extraerJSON(r.texto);
    const lista = (d && Array.isArray(d.decretos) ? d.decretos : []).filter(x => x && typeof x.texto === 'string' && validar(x));
    if (!lista.length) {
      const err = new Error('examen ilegible');
      err.mensaje = 'El profesor respondió algo que el bot no pudo leer.';
      throw err;
    }
    const res = { total: lista.length, antes: 0, despues: 0, aprendidos: [] };
    for (const x of lista) if (acierta(x.texto, x, estado)) res.antes++;
    for (const x of lista) {
      const sabia = acierta(x.texto, x, estado);
      if ((!sabia || (x.conceptos || []).length) && aprender(x.texto, x, 'entreno', true) && !sabia) res.aprendidos.push({ texto: x.texto, etiqueta: validar(x) });
    }
    RF.interprete.entrenar();
    for (const x of lista) if (acierta(x.texto, x, estado)) res.despues++;
    return res;
  }

  function resumen() {
    const p = cargar();
    const cuenta = o => p.filter(x => x.origen === o).length;
    return { base: todos().length - p.length, ia: cuenta('ia'), entreno: cuenta('entreno'), ultimos: p.slice(-5).reverse(), nube: !!nube };
  }

  function olvidar() {
    if (nube) for (const x of cargar()) nube.collection(COLECCION).doc(idDe(x.n)).delete().catch(() => {});
    propios = [];
    guardar();
    if (RF.interprete) RF.interprete.entrenar();
  }

  function exportar() {
    return JSON.stringify(cargar().map(x => [x.texto, x.etiqueta]));
  }

  function recargar() { base = null; if (RF.interprete) RF.interprete.entrenar(); }

  RF.aprendiz = { conectar, idDe, recargar, aprender, recordar, deFicha, todos, examen, resumen, olvidar, exportar, describir, acierta, validar, listas, similitud, raices };
})(globalThis.RF = globalThis.RF || {});
