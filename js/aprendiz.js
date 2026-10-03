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
      if (Array.isArray(d)) for (const x of d) { const et = validar(x); if (et && x.texto) propios.push(Object.assign(completar(x.texto, et, x.origen || 'ia', x.efectos), { revisada: !!x.revisada })); }
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
    const c = Object.assign({ texto: x.texto, origen: x.origen, t: Date.now() }, x.etiqueta);
    if (x.efectos) c.efectos = x.efectos;
    if (x.revisada) c.revisada = true;
    return c;
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
        const l = Object.assign(completar(x.texto, et, x.origen || 'ia', x.efectos), { revisada: !!x.revisada });
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
      localStorage.setItem(CLAVE, JSON.stringify(propios.map(x => Object.assign({ texto: x.texto, origen: x.origen }, x.etiqueta, x.efectos ? { efectos: x.efectos } : {}, x.revisada ? { revisada: true } : {}))));
    } catch (e) { /* sin memoria en este navegador */ }
  }

  function completar(texto, etiqueta, origen, efectos) {
    return { texto, n: T.normalizar(texto), r: raices(texto), etiqueta, origen, efectos: limpiarEfectos(efectos) };
  }

  // ---------- Las mecánicas: los números que la IA dio a cada tipo de decreto ----------
  const STATS = ['dinero', 'inflacion', 'estabilidad', 'felicidad', 'ejercito', 'elite'];
  // Cuánto puede mover lo aprendido un número del motor, como mucho (por si la IA exagera).
  const LIMITE = { inicial: { dinero: 20, otro: 5 }, porTurno: { dinero: 6, inflacion: 1.5, otro: 1 } };

  function limpiarEfectos(ef) {
    if (!ef || typeof ef !== 'object') return null;
    const topes = RF.consejoIA ? RF.consejoIA.TOPES : null;
    const out = {};
    for (const parte of ['inicial', 'porTurno']) {
      const src = ef[parte];
      if (!src || typeof src !== 'object') continue;
      const lim = topes ? topes[parte] : null;
      const d = {};
      for (const k of STATS) {
        const v = Number(src[k]);
        if (!isFinite(v) || !src[k]) continue;
        d[k] = lim ? Math.max(lim[k][0], Math.min(lim[k][1], v)) : v;
      }
      if (Object.keys(d).length) out[parte] = d;
    }
    return Object.keys(out).length ? out : null;
  }

  // Los números de una ficha de la IA: la ley (efecto al firmar y cada turno) o el efecto único.
  function efectosDeFicha(ficha) {
    const ley = Array.isArray(ficha.leyes) && ficha.leyes[0];
    if (ley) return limpiarEfectos({ inicial: ley.inicial, porTurno: ley.por_turno });
    if (ficha.efecto_unico) return limpiarEfectos({ inicial: ficha.efecto_unico });
    return null;
  }

  function claveDe(et) {
    return et.tema ? 'T:' + et.tema + ':' + et.dir : 'A:' + et.accion + ':' + et.objeto;
  }

  // La media de lo que la IA decidió para decretos de este tipo.
  function mecanica(clave) {
    const con = todos().filter(x => x.efectos && claveDe(x.etiqueta) === clave);
    if (!con.length) return null;
    const media = { inicial: {}, porTurno: {} };
    for (const parte of ['inicial', 'porTurno']) {
      for (const k of STATS) {
        const vs = con.map(x => x.efectos[parte] && x.efectos[parte][k]).filter(v => typeof v === 'number');
        if (vs.length) media[parte][k] = vs.reduce((a, b) => a + b, 0) / vs.length;
      }
    }
    return { media, n: con.length };
  }

  /*
   * Ajusta los números de una ley del motor hacia lo que la IA suele decidir para ese tipo de decreto.
   * Con 1 decisión de la IA pesa un 25%; con 3 o más, un 60% como mucho. Nunca mueve un número más
   * allá de LIMITE, y solo toca lo que la IA mencionó (lo que calló no cuenta como cero).
   */
  function ajustarDef(def, interp) {
    if (!def || def.derogar || !interp || interp.objeto === 'OTRO') return null;
    const et = interp.tema ? { tema: interp.tema, dir: interp.dir || 'favor' } : { accion: interp.accion, objeto: interp.objeto };
    const m = mecanica(claveDe(et));
    if (!m) return null;
    const peso = Math.min(0.6, 0.25 * m.n);
    const cambios = [];
    for (const parte of ['inicial', 'porTurno']) {
      const aprendida = m.media[parte];
      if (!Object.keys(aprendida).length) continue;
      if (parte === 'porTurno' && def.unaVez) continue;
      const nuevo = Object.assign({}, def[parte] || {});
      for (const [k, v] of Object.entries(aprendida)) {
        const antes = nuevo[k] || 0;
        const lim = LIMITE[parte][k] || LIMITE[parte].otro;
        const d = Math.max(-lim, Math.min(lim, (v - antes) * peso));
        if (Math.abs(d) < 0.05) continue;
        nuevo[k] = Math.round((antes + d) * 100) / 100;
        cambios.push({ parte, stat: k, antes, despues: nuevo[k] });
      }
      def[parte] = nuevo;
    }
    return cambios.length ? { n: m.n, peso, cambios } : null;
  }

  let base = null;
  function todos() {
    // Las lecciones de fábrica: las generales y las del país de la partida (su vocabulario: "glásnost", "Afganistán"...).
    if (!base) base = (RF.APRENDIDOS || []).concat((RF.APRENDIDOS_PAIS || {})[RF.PAIS.id] || []).map(([texto, et]) => { const v = validar(et); return v && completar(texto, v, 'base'); }).filter(Boolean);
    // Las lecciones de fábrica están revisadas: mandan sobre una guardada con el mismo texto.
    const deFabrica = new Set(base.map(x => x.n));
    return base.concat(cargar().filter(x => !deFabrica.has(x.n)));
  }

  // Guarda un ejemplo. Devuelve true si es nuevo (o corrige uno anterior).
  function aprender(texto, etiqueta, origen, diferir, efectos) {
    const et = validar(etiqueta);
    if (!et || !texto || texto.length > 160) return false;
    cargar();
    const n = T.normalizar(texto);
    const previo = propios.findIndex(x => x.n === n);
    if (previo >= 0) {
      if (JSON.stringify(propios[previo].etiqueta) === JSON.stringify(et)) {
        // La misma lección otra vez: si trae números nuevos, se actualizan (la IA vuelve a decidir).
        const ef = limpiarEfectos(efectos);
        if (ef) { propios[previo].efectos = ef; guardar(); subir(propios[previo]); }
        return false;
      }
      propios.splice(previo, 1);
    }
    const nueva = completar(texto, et, origen || 'ia', efectos);
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
    return aprender(texto, et, 'ia', false, efectosDeFicha(ficha)) ? et : null;
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
    'Solo decretos de una orden (no varias a la vez) y sin personas concretas. ' +
    'Pon también sus números como los decidiría el Consejo: "inicial" (al firmar) y "por_turno" (mientras siga vigente), con las claves dinero (millones de divisas), inflacion, estabilidad, felicidad (la población), ejercito y elite. ' +
    'Escala: vender el agua da inicial dinero +35 y felicidad -8, por_turno dinero +15 y felicidad -2; regalar comida da inicial felicidad +10, por_turno dinero -10 y felicidad +3; invertir en escuelas cuesta inicial dinero -45 y da por_turno felicidad +1. Topes: inicial dinero ±80 y el resto ±15; por_turno dinero ±25, inflacion de -3 a 6, el resto ±3.\n\n';

  async function examen(n, estado, alTexto) {
    n = Math.max(5, Math.min(30, n || 15));
    const contenido = EXAMEN + listas() + '\n\nDevuelve SOLO un JSON: {"decretos": [{"texto": "...", "tema": "...", "dir": "favor", "conceptos": [], "inicial": {}, "por_turno": {}}, {"texto": "...", "accion": "...", "objeto": "...", "conceptos": [], "inicial": {}, "por_turno": {}}]} con ' + n + ' decretos.';
    const r = await RF.narradorIA.generar('Responde solo con JSON válido, sin markdown.', contenido, alTexto, 4000);
    const d = RF.consejoIA.extraerJSON(r.texto);
    const lista = (d && Array.isArray(d.decretos) ? d.decretos : []).filter(x => x && typeof x.texto === 'string' && validar(x));
    if (!lista.length) {
      const err = new Error('examen ilegible');
      err.mensaje = 'El profesor respondió algo que el bot no pudo leer.';
      throw err;
    }
    const res = { total: lista.length, antes: 0, despues: 0, aprendidos: [], numeros: 0 };
    for (const x of lista) if (acierta(x.texto, x, estado)) res.antes++;
    for (const x of lista) {
      const sabia = acierta(x.texto, x, estado);
      const ef = limpiarEfectos({ inicial: x.inicial, porTurno: x.por_turno });
      if (ef) res.numeros++;
      // Se guarda lo que falló, y también lo que trae números o conceptos: enseña mecánicas.
      if ((!sabia || ef || (x.conceptos || []).length) && aprender(x.texto, x, 'entreno', true, ef) && !sabia) res.aprendidos.push({ texto: x.texto, etiqueta: validar(x) });
    }
    RF.interprete.entrenar();
    for (const x of lista) if (acierta(x.texto, x, estado)) res.despues++;
    return res;
  }

  // ---------- La revisión: la IA relee lo aprendido y corrige lo que esté mal ----------
  const REVISION = 'Eres el revisor del intérprete local de un juego satírico de gobierno de Corea del Norte. Otra IA le enseñó estas lecciones: cada una es un decreto escrito por el jugador y cómo debe entenderlo el bot. ' +
    'Algunas están mal: la dirección al revés (abolir en vez de imponer, abrir en vez de cerrar), un tema que no corresponde o conceptos que no explican nada de ese decreto. ' +
    'Lee cada una con cuidado, pensando en qué quiso decir el jugador. Corrige SOLO las que estén mal; deja en paz las que estén bien.\n\n';

  async function revisar(alTexto) {
    const pendientes = cargar().map((x, i) => ({ x, i })).filter(({ x }) => !x.revisada).slice(0, 40);
    if (!pendientes.length) return { revisadas: 0, correcciones: [], borradas: [] };
    const lineas = pendientes.map(({ x }, k) => k + '. "' + x.texto + '" = ' + JSON.stringify(x.etiqueta) + ' (' + describir(x.etiqueta) + ')');
    const contenido = REVISION + listas() + '\n\nLECCIONES:\n' + lineas.join('\n') +
      '\n\nDevuelve SOLO un JSON: {"correcciones": [{"n": 0, "tema": "...", "dir": "favor", "conceptos": [], "motivo": "corto"}, {"n": 3, "accion": "...", "objeto": "...", "conceptos": [], "motivo": "corto"}], "borrar": [{"n": 5, "motivo": "no se entiende o no es un decreto"}]}. Si todas están bien, listas vacías.';
    const r = await RF.narradorIA.generar('Responde solo con JSON válido, sin markdown.', contenido, alTexto, 3000);
    const d = RF.consejoIA.extraerJSON(r.texto);
    if (!d || typeof d !== 'object') {
      const err = new Error('revisión ilegible');
      err.mensaje = 'El revisor respondió algo que el bot no pudo leer.';
      throw err;
    }
    const res = { revisadas: pendientes.length, correcciones: [], borradas: [] };
    const quitar = new Set();
    for (const b of Array.isArray(d.borrar) ? d.borrar : []) {
      const p = pendientes[b && b.n];
      if (p) { quitar.add(p.x); res.borradas.push({ texto: p.x.texto, motivo: String(b.motivo || '').slice(0, 120) }); }
    }
    for (const c of Array.isArray(d.correcciones) ? d.correcciones : []) {
      const p = pendientes[c && c.n];
      const et = p && !quitar.has(p.x) && validar(c);
      if (!et || JSON.stringify(et) === JSON.stringify(p.x.etiqueta)) continue;
      res.correcciones.push({ texto: p.x.texto, antes: p.x.etiqueta, despues: et, motivo: String(c.motivo || '').slice(0, 120) });
      p.x.etiqueta = et;
    }
    for (const { x } of pendientes) {
      if (quitar.has(x)) { if (nube) nube.collection(COLECCION).doc(idDe(x.n)).delete().catch(() => {}); continue; }
      x.revisada = true;
      subir(x);
    }
    propios = propios.filter(x => !quitar.has(x));
    guardar();
    if (RF.interprete) RF.interprete.entrenar();
    return res;
  }

  function resumen() {
    const p = cargar();
    const cuenta = o => p.filter(x => x.origen === o).length;
    return { base: todos().length - p.length, ia: cuenta('ia'), entreno: cuenta('entreno'), sinRevisar: p.filter(x => !x.revisada).length, ultimos: p.slice(-5).reverse(), nube: !!nube,
      mecanicas: new Set(todos().filter(x => x.efectos).map(x => claveDe(x.etiqueta))).size };
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

  RF.aprendiz = { revisar, ajustarDef, mecanica, claveDe, efectosDeFicha, conectar, idDe, recargar, aprender, recordar, deFicha, todos, examen, resumen, olvidar, exportar, describir, acierta, validar, listas, similitud, raices };
})(globalThis.RF = globalThis.RF || {});
