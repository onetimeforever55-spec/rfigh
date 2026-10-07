/*
 * GÉNESIS · EL MANDO DE UN PUEBLO
 * En el modo "Gobernar un pueblo" no eres un dios: eres quien manda en un solo pueblo y lo gobiernas
 * escribiendo órdenes ("talad el bosque", "construid casas", "expandíos hacia el norte", "atacad a
 * Karenia", "haced la paz con Ishan", "invertid en ciencia", "proclamad la república"). Los demás pueblos
 * siguen solos, como siempre.
 *
 * Cada orden se traduce a ACCIONES pequeñas y serializables ({ tipo: 'guerra', con: 3 }...). Así, un día,
 * en multijugador, cada jugador enviará sus acciones y todos los mundos las aplicarán igual, en el mismo
 * turno (el mundo es reproducible).
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO, S = () => M.sim, D = () => M.dios;
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // Cada cosa a la que el jugador puede dar más o menos importancia, y cómo se nombra al escribir.
  const RECURSOS = {
    madera: /\b(tala\w*|tale\w*|talen|talad|talar|lena\w*|madera|arboles?|bosques?|troncos?)\b/,
    comida: /\b(pesc\w*|orden\w*|ganado|ovejas?|vacas?|cri(ad|en|ar)|rebanos?|pastore\w*|caz(ad|en|ar)|sembr\w*|siembr\w*|cultiv\w*|granj\w*|campos?|cosech\w*|agricult\w*|trigo|comida|alimento\w*|hambre)\b/,
    piedra: /\b(minas?|miner\w*|piedras?|canteras?|picad|picar)\b/,
    metal: /\b(hierro|metal\w*|vetas?|menas?|minerales?|cobre|estano|bronce para)\b/,
    carbon: /\b(carbon\w*|hulla)\b/,
    casas: /\b(constru\w*|casas?|edific\w*|obras?|viviendas?|caminos?|carreteras?|calzadas?)\b/,
    ejercito: /\b(reclut\w*|ejercitos?|soldados?|guerreros?|militar\w*|milicias?|defensa|tropas?|armas)\b/,
    ciencia: /\b(cienc\w*|investig\w*|estudi\w*|sabios?|chaman\w*|filosof\w*|monjes?|erudit\w*|cientific\w*|sacerdot\w*|druid\w*|escuelas?|tecnolog\w*|universidad\w*|inventos?)\b/,
    riqueza: /\b(riqueza|oro|dinero|mercados?|negocios?|enriquec\w*|impuestos|comercio|comerciantes?|caravanas?|carretas?|mercaderes)\b/
  };
  const NB = k => (M.vida && M.vida.NOMBRE_BIEN && M.vida.NOMBRE_BIEN[k]) || k;
  const NOMBRE_RECURSO = { metal: 'metal', carbon: 'carbón', madera: 'madera', comida: 'comida', piedra: 'piedra', casas: 'casas', ejercito: 'ejército', ciencia: 'ciencia', riqueza: 'riqueza', expansion: 'expansión' };
  const NIVEL = v => (v <= 0 ? 'nada' : v <= 0.5 ? 'baja' : v <= 1 ? 'normal' : v <= 1.5 ? 'alta' : 'máxima');
  const REGIMENES = [[/\bdemocracia\b/, 'democracia', 5], [/\brepublica\b/, 'republica', 2], [/\bimperio\b|\bemperador\b/, 'imperio', 2], [/\bdictadura\b|\bdictador\b/, 'dictadura', 5], [/\bteocracia\b/, 'teocracia', 1], [/\bmonarquia\b|\breino\b|\bcorona\w*\b|\brey\b/, 'reino', 1], [/\brepublica popular\b|\bcomunis\w*\b/, 'estado_obrero', 6]];

  const PRIO_NORMAL = () => ({ madera: 1, comida: 1, piedra: 1, casas: 1, ejercito: 1, ciencia: 1, riqueza: 1, expansion: 1 });
  const plan = c => { c.plan = c.plan || { rumbo: null, socios: [], guerrasMias: [] }; c.plan.prioridad = c.plan.prioridad || PRIO_NORMAL(); c.plan.guerrasMias = c.plan.guerrasMias || []; return c.plan; };

  // El nombre de un sitio: una ciudad, una capital, o (si es tierra propia sin plaza) «la frontera».
  const nombreSitio = (m, c, r) => r === c.capital ? 'la capital' : (m.ciudades || []).some(y => y.region === r) || S().vivas(m).some(y => y.capital === r) ? nombrePlaza(m, r) : m.dueno[r] === c.id ? 'la frontera' : nombrePlaza(m, r);
  const nombrePlaza = (m, r) => { const x = (m.ciudades || []).find(y => y.region === r); if (x) return x.nombre; const o = S().vivas(m).find(y => y.capital === r); return o ? 'la capital de ' + o.nombre : 'la plaza enemiga'; };
  // ¿A qué otro pueblo se refiere la orden? Por nombre o por descripción, nunca a uno mismo.
  function otro(m, c, n) {
    const lista = D().objetivos(m, n, null).filter(o => o.id !== c.id);
    return lista[0] || null;
  }
  function vecinoMasDebil(m, c) {
    return S().vecinosDe(m, c).filter(o => o.id !== c.id).sort((a, b) => S().fuerza(m, a) - S().fuerza(m, b))[0] || null;
  }


  // ---------- Cuadrillas: órdenes con número, oficio y tiempo ----------
  // «5 granjeros a talar durante 3 minutos», «quiero 10 leñadores», «la mitad de los mineros a construir hasta
  // tener 20 casas», «todos los soldados a sembrar 2 años». Se cumplen con aldeanos concretos.
  const OFICIOS_N = ['leñadores', 'granjeros', 'constructores', 'mineros', 'guerreros', 'comerciantes', 'eruditos'];
  const OFICIO_1 = ['leñador', 'granjero', 'constructor', 'minero', 'guerrero', 'comerciante', 'erudito'];
  const VERBO = ['talar', 'el campo', 'construir', 'la mina', 'las armas', 'comerciar', 'estudiar'];
  const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, docena: 12, par: 2 };
  const NUM = '(\\d+(?:[.,]\\d+)?|' + Object.keys(NUMEROS).join('|') + '|media docena|una docena|un par|medio|media)';
  const numero = t => { if (t == null) return null; t = t.trim(); if (/^\d/.test(t)) return parseFloat(t.replace(',', '.')); if (t === 'media docena') return 6; if (t === 'una docena') return 12; if (t === 'un par') return 2; if (t === 'medio' || t === 'media') return 0.5; return NUMEROS[t] != null ? NUMEROS[t] : null; };
  const NOMBRE_OF = [
    [0, 'lenador\\w*|talador\\w*|hacher\\w*|lenatero\\w*'],
    [1, 'granjer\\w*|campesin\\w*|agricultor\\w*|labrador\\w*|pastor\\w*|cazador\\w*|pescador\\w*'],
    [2, 'constructor\\w*|albanil\\w*|obrer\\w*|carpinter\\w*|arquitect\\w*'],
    [3, 'miner\\w*|canter\\w*|picapedrer\\w*|herrer\\w*'],
    [4, 'guerrer\\w*|soldad\\w*|tropas?|arquer\\w*|milician\\w*|reclutas?|caballer\\w*|tanquistas?|artiller\\w*'],
    [5, 'comerciant\\w*|mercader\\w*|tender\\w*|buhoner\\w*'],
    [6, 'erudit\\w*|sabios?|chaman\\w*|filosof\\w*|monjes?|frailes?|sacerdot\\w*|cientific\\w*|druid\\w*|escribas?|maestros?|investigador\\w*'],
    [-1, 'aldean\\w*|personas?|gente|hombres|mujeres|trabajador\\w*|vecinos|habitantes|tipos|curritos|peones|mios']
  ];
  const ACTIVIDAD = [
    [0, /\b(tal(a|ar|ando|en|ad|e|ara|aran)|talad\w*|cort\w* (lena|arboles|madera|troncos)|lena|madera|bosques?|arboles|troncos)\b/],
    [1, /\b(sembr\w*|siembr\w*|cultiv\w*|cosech\w*|segar|siega\w*|arar|aren|arando|campos?|granjas?|trigo|comida|alimentos?|ordenn\w*|pastore\w*|ganado|caza\w*|pesca\w*|a cazar|a pescar)\b/],
    [2, /\b(constru\w*|edific\w*|levant\w*|obras?|casas?|caminos?|viviendas?|carreteras?)\b/],
    [3, /\b(min(a|as|ar|ando|en|ad|e)|pic(ar|ad|ando|en|a)|canteras?|piedras?|metal|hierro|oro|minerales?)\b/],
    [4, /\b(luch\w*|pele\w*|combat\w*|armas|ejercito|guerra|frente|frontera|defend\w*|patrull\w*|cuartel|filas|milicia|reclut\w*)\b/],
    [5, /\b(comerci\w*|vend\w*|mercados?|caravanas?|negoci\w*)\b/],
    [6, /\b(estudi\w*|investig\w*|rez(ar|en|ad)|ensen\w*|aprend\w*|escrib\w*|medit\w*|pens\w*|templo|biblioteca|observ\w* (el cielo|las estrellas))\b/]
  ];
  // El plazo: tiempo real (minutos o segundos, que se pasan a turnos a la velocidad actual), turnos, años, o una meta.
  const COSAS = { madera: 'madera', lena: 'madera', comida: 'comida', trigo: 'comida', alimento: 'comida', alimentos: 'comida', piedra: 'piedra', piedras: 'piedra', metal: 'metal', hierro: 'metal', oro: 'oro', casas: 'casas', casa: 'casas', campos: 'campos', campo: 'campos', arboles: 'arboles', arbol: 'arboles', guerreros: 'guerreros', soldados: 'guerreros' };
  function plazo(n) {
    const sinNum = '(?:un|una)?';
    let mt = n.match(new RegExp('\\b(?:durante|por|en|los proximos|las proximas|unos|unas|dentro de|a lo largo de)?\\s*' + NUM + '\\s*(segundos?|seg|s|minutos?|min|mins|horas?|turnos?|anos?|siglos?|decadas?)\\b'));
    if (!mt) { const m2 = n.match(/\b(?:durante|por|en)\s+(?:un|una)\s+(minuto|hora|turno|ano|siglo|decada|rato|ratito|momento)\b/) || n.match(/\b(un rato|un ratito|un momento|un tiempo)\b/); if (m2) mt = [m2[0], '1', m2[1].replace(/^un /, '')]; }
    void sinNum;
    if (mt) {
      const k = numero(mt[1]) || 1, u = mt[2];
      let hasta;
      if (/^(segundo|seg|s)/.test(u)) hasta = { ms: k * 1000 };
      else if (/^min/.test(u)) hasta = { ms: k * 60000 };
      else if (/^hora/.test(u)) hasta = { ms: k * 3600000 };
      else if (/^turno/.test(u)) hasta = { turnos: Math.round(k) };
      else if (/^ano/.test(u)) hasta = { anios: k };
      else if (/^decada/.test(u)) hasta = { anios: k * 10 };
      else if (/^siglo/.test(u)) hasta = { anios: k * 100 };
      else hasta = { turnos: /momento|ratito/.test(u) ? 2 : 4 };
      return { hasta, quitar: mt[0] };
    }
    // Una meta: «hasta tener 100 de madera», «hasta que haya 20 casas», «hasta talar 30 árboles», «hasta juntar 50 de piedra».
    const meta = n.match(new RegExp('\\bhasta (?:que )?(?:tener|tengamos|tengais|juntar|juntemos|reunir|haya|hayan|conseguir|consigamos|llegar a|lleguemos a|alcanzar|talar|talen|construir|construyan|levantar|sembrar|siembren|picar|sacar)?\\s*(?:los |las )?' + NUM + '\\s*(?:de )?(\\w+)'));
    if (meta && COSAS[meta[2]]) {
      const cosa = COSAS[meta[2]], producir = /\b(talar|talen|construir|construyan|levantar|sembrar|siembren|picar|sacar)\b/.test(meta[0]);
      return { hasta: { cosa, n: numero(meta[1]), nuevo: producir || cosa === 'arboles' }, quitar: meta[0] };
    }
    if (/\b(para siempre|hasta nuevo aviso|hasta que (yo )?(lo )?diga|de ahora en adelante|desde ahora|siempre)\b/.test(n)) return { hasta: null, siempre: true, quitar: '' };
    return null;
  }
  // «talad 20 árboles», «construid 5 casas», «sacad 30 de piedra»: una meta de producción sin cifra de gente.
  function metaDirecta(n) {
    const mt = n.match(new RegExp('\\b(tal\\w*|cort\\w*|constru\\w*|levant\\w*|hac\\w*|hag\\w*|quiero|queremos|necesit\\w*|edific\\w*|sac\\w*|pic\\w*|junt\\w*|recog\\w*|sembr\\w*|siembr\\w*|ar\\w*)\\s+(?:otr[oa]s\\s+)?' + NUM + '\\s*(?:de |mas |nuev[oa]s )?(arboles|casas|piedras?|piedra|madera|lena|metal|hierro|oro|campos|comida|trigo)\\b'));
    if (!mt) return null;
    const cosa = COSAS[mt[3]], n2 = numero(mt[2]);
    const oficio = { arboles: 0, madera: 0, casas: 2, piedra: 3, metal: 3, oro: 3, campos: 1, comida: 1 }[cosa];
    return { cosa, n: n2, oficio };
  }
  function cuadrilla(m, c, n) {
    const pl = plazo(n);
    let resto = pl && pl.quitar ? n.replace(pl.quitar, ' ') : n;
    const hasta = pl ? pl.hasta : null, siempre = pl && pl.siempre;
    if (/\b(liber\w*|soltad|suelt\w*|disuelv\w*|disolv\w*|cancel\w*|anul\w*|que vuelvan|volved a vuestros? oficios?|quita\w* (los )?cupos?|sin cupos?|deja\w* (de )?mandar)\b/.test(resto)) return [{ tipo: 'liberar' }];
    // ¿Cuántos y de qué oficio salen? «5 granjeros», «todos los mineros», «la mitad de los soldados», «3 de los leñadores».
    let cuanto = null, origen = null, frase = '', relativo = 0;
    for (const [o, re] of NOMBRE_OF) {
      const mt = resto.match(new RegExp('\\b(?:(todos|todas) (?:los |las |mis )?|(?:^|que |(?:manda|pon|envia|lleva|dile a)\\w* (?:a )?)(los|las|mis|nuestros) (?=(?:' + re + ') (?:a|al|que|para|se)\\b)|(la mitad|un tercio|un cuarto) de (?:los |las |mis )?|' + NUM + ' (?:de (?:los |las |mis |nuestros |nuestras ))?(?:\\w+ )?)(' + re + ')\\b'));
      if (mt) {
        frase = mt[0]; origen = o;
        cuanto = mt[1] || mt[2] ? 'todos' : mt[3] ? { 'la mitad': 0.5, 'un tercio': 1 / 3, 'un cuarto': 0.25 }[mt[3]] : numero(mt[4]);
        if (typeof cuanto === 'number' && cuanto < 1 && !mt[3]) cuanto = null;
        if (cuanto != null) break;
      }
    }
    if (cuanto == null) {
      // Sin oficio: «pon a 5 a talar», «8 a la mina», «manda 6 a construir».
      const mt = resto.match(new RegExp('\\b' + NUM + ' (?:mas )?(?:a |al |para |que |se pongan a |se vayan a )'));
      if (mt && numero(mt[1]) >= 1) { cuanto = numero(mt[1]); origen = -1; frase = mt[0]; }
    }
    const despues = cuanto != null ? resto.replace(frase, ' ') : resto;
    let destino = null;
    for (const [o, re] of ACTIVIDAD) if (re.test(despues)) { destino = o; break; }
    // «Quiero 10 leñadores»: un cupo fijo de ese oficio (sin actividad distinta).
    const quiere = /\b(quiero|queremos|quisiera|necesito|necesitamos|que haya|haya|ten(ed|gamos|er|go)|pon(ed|er|gan|me)?|dejad|deja|mantened|mantener|manten|fij\w*|solo|exactamente|cupo|mas|menos|sean|seamos|reclut\w*|alist\w*|mand\w*|envi\w*|llam\w* a)\b/.test(resto) || norm(resto.replace(frase, ' ')).split(' ').filter(Boolean).length <= 1;
    if (cuanto != null && origen >= 0 && (destino == null || destino === origen) && quiere) {
      if (/\b(mas|reclut\w*|alist\w*)\b/.test(resto)) relativo = 1; else if (/\bmenos\b/.test(resto)) relativo = -1;
      if (cuanto === 'todos') return [];
      const n2 = typeof cuanto === 'number' && cuanto < 1 ? null : Math.round(cuanto);
      if (n2 == null) return [];
      return [{ tipo: 'cupo', o: origen, n: n2, relativo: relativo || undefined, hasta, siempre: siempre || undefined }];
    }
    if (cuanto != null && destino != null && destino !== origen) return [{ tipo: 'cuadrilla', n: cuanto, de: origen, a: destino, hasta, siempre: siempre || undefined }];
    // «talad 20 árboles», «construid 5 casas»: la gente de ese oficio sube hasta cumplirlo.
    const md = metaDirecta(resto);
    if (md && md.n >= 1) return [{ tipo: 'meta', cosa: md.cosa, n: Math.round(md.n), o: md.oficio }];
    // «más leñadores durante 2 minutos», «todo a la ciencia 30 segundos»: prioridades con plazo (las pone el resto del intérprete).
    if (pl && pl.hasta) return [{ tipo: 'plazo', hasta: pl.hasta, quitar: pl.quitar }];
    return [];
  }
  // El plazo de una acción, en absoluto (turno o año del mundo, o una meta con su punto de partida).
  function plazoAbsoluto(m, c, h) {
    if (!h) return null;
    if (h.ms) { const ms = (m.vida && m.vida.msTurno) || 3400; return { turno: m.turno + Math.max(1, Math.round(h.ms / ms)), ms: h.ms }; }
    if (h.turnos) return { turno: m.turno + Math.max(1, h.turnos) };
    if (h.anios) return { anio: m.anio + Math.max(1, Math.round(h.anios)) };
    if (h.cosa) { const base = h.nuevo ? ((c.hecho || {})[h.cosa] || 0) : 0; return { cosa: h.cosa, n: h.n, nuevo: !!h.nuevo, base }; }
    return null;
  }
  const valorDe = (c, cosa) => cosa === 'casas' ? (c.casas || 0) : cosa === 'campos' ? (c.campos || 0) : cosa === 'arboles' ? ((c.hecho || {}).arboles || 0) : cosa === 'guerreros' ? (c.guerreros || 0) : Math.floor(c[cosa] || 0);
  function vencido(m, c, h) {
    if (!h) return false;
    if (h.turno != null) return m.turno >= h.turno;
    if (h.anio != null) return m.anio >= h.anio;
    if (h.cosa) return h.nuevo ? ((c.hecho || {})[h.cosa] || 0) - h.base >= h.n : valorDe(c, h.cosa) >= h.n;
    return false;
  }
  function textoPlazo(m, h, siempre) {
    if (!h) return siempre ? ' hasta nueva orden' : '';
    if (h.ms) { const s2 = Math.round(h.ms / 1000); return ' durante ' + (s2 >= 60 ? (s2 % 60 ? (s2 / 60).toFixed(1).replace('.', ',') : s2 / 60) + ' min' : s2 + ' s') + ' (' + (h.turno - m.turno) + ' turnos a esta velocidad)'; }
    if (h.turno != null) return ' durante ' + (h.turno - m.turno) + ' turno' + (h.turno - m.turno === 1 ? '' : 's');
    if (h.anio != null) return ' hasta el año ' + S().anioTexto(h.anio).replace(/(\d)\.$/, '$1');
    if (h.cosa) return h.nuevo ? ' hasta ' + ({ arboles: 'talar ', casas: 'levantar ', campos: 'sembrar ' }[h.cosa] || 'sacar ') + h.n + ' ' + (h.cosa === 'arboles' ? 'árboles' : h.cosa === 'casas' ? 'casas' : h.cosa === 'campos' ? 'campos' : 'de ' + h.cosa) : ' hasta tener ' + h.n + ' ' + (['casas', 'campos', 'guerreros'].includes(h.cosa) ? h.cosa : 'de ' + h.cosa);
    return '';
  }
  // Lo que queda de un plazo, para enseñarlo (en tiempo real si se dio en minutos).
  function queda(m, c, h, msTurno) {
    if (!h) return '';
    if (h.turno != null) { const t = Math.max(0, h.turno - m.turno); if (h.ms) { const s2 = Math.round(t * (msTurno || 3400) / 1000); return Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0'); } return t + ' turno' + (t === 1 ? '' : 's'); }
    if (h.anio != null) return 'hasta ' + S().anioTexto(h.anio);
    if (h.cosa) { const ya = h.nuevo ? ((c.hecho || {})[h.cosa] || 0) - h.base : valorDe(c, h.cosa); return Math.min(h.n, ya) + '/' + h.n + ' ' + (h.cosa === 'arboles' ? 'árboles' : h.cosa); }
    return '';
  }
  const adultosDe = (m, c) => (m.vida ? m.vida.aldeanos.filter(a => a.c === c.id && (a.edad || 0) >= M.vida.ADULTO && a.colono == null) : []);
  function cuentaOficios(m, c) { const n = [0, 0, 0, 0, 0, 0, 0]; for (const a of adultosDe(m, c)) n[a.o]++; return n; }
  // Vencer lo que tenía plazo (al empezar cada turno): las cuadrillas vuelven a su oficio, los cupos se quitan,
  // las prioridades vuelven a como estaban. Cada cosa se anuncia sobre el pueblo.
  function vencer(m) {
    if (!m.vida) return;
    for (const c of S().vivas(m)) {
      const p = c.plan;
      if (!p) continue;
      const an = t => (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: t });
      for (const g of (p.cuadrillas || []).slice()) {
        const suyos = m.vida.aldeanos.filter(a => a.fijo && a.fijo.g === g.id);
        if (!suyos.length) { p.cuadrillas = p.cuadrillas.filter(x => x !== g); continue; }
        if (!vencido(m, c, g.hasta)) continue;
        for (const a of suyos) { const vuelve = a.fijo.vuelve; delete a.fijo; M.vida.mover(a, vuelve); }
        p.cuadrillas = p.cuadrillas.filter(x => x !== g);
        an('⏱ ' + g.texto + ': vuelven a su oficio');
        if (c.jugador) (m.avisosPlan = m.avisosPlan || []).push({ civ: c.id, texto: 'La cuadrilla de ' + g.texto + ' ha terminado y vuelve a su oficio.' });
      }
      for (const k of Object.keys(p.cupos || {})) {
        const q = p.cupos[k];
        if (q.hasta && vencido(m, c, q.hasta)) { delete p.cupos[k]; an('⏱ Se acaba el cupo de ' + OFICIOS_N[k]); if (c.jugador) (m.avisosPlan = m.avisosPlan || []).push({ civ: c.id, texto: 'Se acaba el cupo de ' + q.n + ' ' + OFICIOS_N[k] + ': el pueblo vuelve a repartir el trabajo solo.' }); }
      }
      for (const t of (p.temporales || []).slice()) {
        if (!vencido(m, c, t.hasta)) continue;
        if (p.prioridad && p.prioridad[t.k] === t.puesto) p.prioridad[t.k] = t.antes;
        p.temporales = p.temporales.filter(x => x !== t);
        an('⏱ ' + NOMBRE_RECURSO[t.k] + ' vuelve a ' + NIVEL(t.antes));
      }
    }
  }
  function consulta(m, c, o) {
    const n = cuentaOficios(m, c), p = plan(c);
    if (o != null && o >= 0) {
      const enCq = (p.cuadrillas || []).filter(g => g.a === o).reduce((k, g) => k + g.n, 0);
      return 'Tienes ' + n[o] + ' ' + (n[o] === 1 ? OFICIO_1[o] : OFICIOS_N[o]) + (enCq ? ' (' + enCq + ' en cuadrillas)' : '') + (p.cupos && p.cupos[o] ? ', con cupo de ' + p.cupos[o].n : '') + ' de ' + adultosDe(m, c).length + ' adultos.' + (o === 4 && c.guerras.length ? ' Estáis en guerra.' : '');
    }
    const partes = n.map((k, i) => k + ' ' + (k === 1 ? OFICIO_1[i] : OFICIOS_N[i]) + (p.cupos && p.cupos[i] ? ' (cupo ' + p.cupos[i].n + ')' : ''));
    const cq = (p.cuadrillas || []).map(g => g.texto + (g.hasta ? ' (' + queda(m, c, g.hasta, m.vida.msTurno) + ')' : ''));
    return 'Tu gente: ' + partes.join(', ') + ' (' + adultosDe(m, c).length + ' adultos). Graneros: ' + Math.floor(c.comida || 0) + ' de comida, ' + Math.floor(c.madera || 0) + ' de madera, ' + Math.floor(c.piedra || 0) + ' de piedra, ' + Math.floor(c.metal || 0) + ' de metal. ' + (cq.length ? 'Cuadrillas: ' + cq.join('; ') + '.' : 'Sin cuadrillas.');
  }
  function aplicarCuadrilla(m, c, a, textos) {
    const p = plan(c);
    const h = plazoAbsoluto(m, c, a.hasta);
    const disponibles = adultosDe(m, c).filter(x => !x.fijo && x.o !== a.a && !(a.a === 4 && (x.edad || 0) >= M.vida.VIEJO));
    let fuente;
    if (a.de >= 0) fuente = disponibles.filter(x => x.o === a.de);
    else {
      // Sin decir de qué oficio: de los que más hay (sin vaciar el ejército en guerra).
      const n = cuentaOficios(m, c);
      fuente = disponibles.filter(x => !(x.o === 4 && c.guerras.length)).sort((x, y) => n[y.o] - n[x.o]);
    }
    fuente.sort((x, y) => (x.k ? 1 : 0) - (y.k ? 1 : 0));
    const quiero = a.n === 'todos' ? fuente.length : a.n < 1 ? Math.round(fuente.length * a.n) : Math.round(a.n);
    const elegidos = fuente.slice(0, Math.max(0, quiero));
    const nombreDe = a.de >= 0 ? nombreOf(c, a.de, true) : 'aldeanos';
    if (!elegidos.length) { textos.push(a.de >= 0 ? 'No tienes ' + nombreDe + ' que puedan ir' + (a.de === 4 ? '' : '') + '.' : 'No queda gente libre para eso.'); return; }
    const id = (p.sigCuadrilla = (p.sigCuadrilla || 0) + 1);
    const texto = elegidos.length + ' ' + (elegidos.length === 1 ? (a.de >= 0 ? nombreOf(c, a.de, false) : 'aldeano') : nombreDe) + ' → ' + VERBO[a.a];
    for (const x of elegidos) { x.fijo = { g: id, vuelve: x.o }; M.vida.mover(x, a.a); }
    // Sin plazo, la cuadrilla se queda así hasta nueva orden (el gobernador no la deshace).
    (p.cuadrillas = p.cuadrillas || []).push({ id, n: elegidos.length, de: a.de, a: a.a, hasta: h, texto });
    (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '⚒ ' + texto + (h ? ' (' + queda(m, c, h, m.vida.msTurno) + ')' : '') });
    const avisos = [];
    if (a.a === 0 && !(c.arboles > 0)) avisos.push(' Ojo: en vuestras tierras no quedan árboles.');
    if (a.a === 3 && c.era < 1 && !(c.piedra > 0)) avisos.push(' Ojo: buscarán piedra en montañas y colinas.');
    if (a.a === 4 && !c.guerras.length) avisos.push(' En paz, los guerreros patrullan y cazan lobos.');
    if (a.a === 5 && !(c.rutas > 0)) avisos.push(' Ojo: sin rutas comerciales no tienen adónde ir.');
    const faltan = quiero - elegidos.length;
    textos.push('Hecho: ' + elegidos.length + ' ' + (elegidos.length === 1 ? (a.de >= 0 ? OFICIO_1[a.de] : 'aldeano') : nombreDe) + ' dejan lo que hacían y se ponen a ' + VERBO[a.a].replace(/^(el|la|las) /, 'trabajar en $1 ').replace('trabajar en las armas', 'empuñar las armas') + textoPlazo(m, h, !h) + '.' + (faltan > 0 ? ' (Solo había ' + elegidos.length + '.)' : '') + (h ? ' Luego vuelven a su oficio.' : ' Se quedan así hasta que digas «liberad las cuadrillas» (o pon un plazo: «durante 3 minutos»).') + avisos.join(''));
  }
  // El nombre de un oficio en la época de ese pueblo (el erudito es chamán, filósofo, monje…).
  const nombreOf = (c, i, varios) => i === 6 ? (varios ? M.ERUDITO(c.era).varios : M.ERUDITO(c.era).uno) : varios ? OFICIOS_N[i] : OFICIO_1[i];
  function aplicarCupo(m, c, a, textos) {
    const p = plan(c), antes = cuentaOficios(m, c);
    const n = Math.max(0, a.relativo ? antes[a.o] + a.relativo * a.n : a.n);
    const h = plazoAbsoluto(m, c, a.hasta);
    p.cupos = p.cupos || {};
    p.cupos[a.o] = { n, hasta: h };
    M.vida.reasignar(m, c, null, true);
    const ahora = cuentaOficios(m, c);
    const total = adultosDe(m, c).length;
    (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: (ahora[a.o] >= antes[a.o] ? '▲ ' : '▼ ') + nombreOf(c, a.o, true) + ' ' + antes[a.o] + ' → ' + ahora[a.o] });
    textos.push('Ahora tienes ' + ahora[a.o] + ' ' + nombreOf(c, a.o, ahora[a.o] !== 1) + ' (antes ' + antes[a.o] + ')' + textoPlazo(m, h, a.siempre) + '.' + (ahora[a.o] < n ? ' No hay más adultos que puedan serlo (' + total + ' en total).' : '') + ' El resto del trabajo se reparte solo. Para quitar el cupo: «liberad los cupos».');
  }
  function aplicarMeta(m, c, a, textos) {
    // La gente del oficio sube al máximo hasta producir lo pedido; luego vuelve a como estaba.
    const p = plan(c), k = ['madera', 'comida', 'casas', 'piedra'][a.o] || 'madera';
    const h = plazoAbsoluto(m, c, { cosa: a.cosa, n: a.n, nuevo: true });
    // Un cupo de ese oficio no deja crecer la cuadrilla: se quita.
    if (p.cupos && p.cupos[a.o]) delete p.cupos[a.o];
    const antes = p.prioridad[k];
    p.prioridad[k] = 2;
    (p.temporales = p.temporales || []).push({ k, antes, puesto: 2, hasta: h });
    const n0 = cuentaOficios(m, c)[a.o];
    // Y una cuadrilla de refuerzo mientras dura: más gente de ese oficio (sin pasar de dos quintos del pueblo).
    const refuerzo = Math.max(0, Math.min(Math.ceil(a.n / 2), Math.floor(adultosDe(m, c).length * 0.4) - n0, 12));
    if (refuerzo) aplicarCuadrilla(m, c, { n: refuerzo, de: -1, a: a.o, hasta: { cosa: a.cosa, n: a.n, nuevo: true } }, []);
    M.vida.reasignar(m, c, null, true);
    const n1 = cuentaOficios(m, c)[a.o];
    (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '🎯 ' + a.n + ' ' + (a.cosa === 'arboles' ? 'árboles' : a.cosa) + ' · ' + OFICIOS_N[a.o] + ' ' + n0 + ' → ' + n1 });
    textos.push('Encargado: ' + textoPlazo(m, h).trim().replace(/^hasta /, '') + '. Los ' + OFICIOS_N[a.o] + ' pasan de ' + n0 + ' a ' + n1 + ' y, al terminar, todo vuelve a como estaba.');
  }


  // ---------- Más órdenes: escuadrones, posturas de guerra, diplomacia menuda, el ánimo del pueblo ----------
  const sinTildes = n => n;
  // Una región propia que se nombra en la orden: una ciudad suya, «la capital», «la frontera».
  function regionPropia(m, c, n) {
    const ciudad = (m.ciudades || []).find(x => x.civ === c.id && n.includes(norm(x.nombre)));
    if (ciudad) return ciudad.region;
    if (/\bfrontera\b/.test(n)) {
      const enemigos = c.guerras.map(g => S().civ(m, g.con)).filter(Boolean), otros = enemigos.length ? enemigos : S().vecinosDe(m, c);
      const fr = otros.flatMap(o => S().frontera(m, o, c));
      if (fr.length) return fr.sort((x, y) => S().distancia(x, c.capital) - S().distancia(y, c.capital))[0];
    }
    if (/\b(capital|casa|corte|palacio|plaza)\b/.test(n)) return c.capital;
    return null;
  }
  function plazaEnemiga(m, c, n) {
    const ciudad = (m.ciudades || []).find(x => x.civ !== c.id && n.includes(norm(x.nombre)));
    if (ciudad) return ciudad.region;
    const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null);
    if (!o) return null;
    if (/\bcapital\b/.test(n)) return o.capital;
    // «su ciudad», «la ciudad enemiga»: la plaza suya más cercana a nosotros.
    const plazas = [o.capital, ...(m.ciudades || []).filter(x => x.civ === o.id).map(x => x.region)];
    return plazas.sort((x, y) => S().distancia(x, c.capital) - S().distancia(y, c.capital))[0];
  }
  function extras(m, c, n) {
    void sinTildes;
    // La cifra de gente: «10 soldados», «de 10», o una cifra en dígitos (no «un escuadrón»).
    const numero1 = (() => {
      const mt = n.match(new RegExp('\\b' + NUM + ' (?:soldad|guerrer|arquer|hombres|tanques|tropas|tirador|aldean|personas)')) || n.match(new RegExp('\\bde ' + NUM + '\\b(?! (?:segundos?|minutos?|turnos?|anos?))')) || n.match(/\b(\d+)\b(?! (?:segundos?|minutos?|min|turnos?|anos?|siglos?|horas?))/);
      return mt ? numero(mt[1]) : null;
    })();
    const o = otro(m, c, n);
    // Escuadrones: «formad un escuadrón de 10», «escuadrón de arqueros», «guardad la capital con 10 soldados»,
    // «10 soldados a defender Olota», «patrullad la frontera».
    const soldados = /\b(soldad\w*|guerrer\w*|arquer\w*|tropas?|hombres|tanques?)\b/;
    const escuadron = /\b(escuadr\w*|pelot\w*|patrull\w*|destacamento|batallon\w*|compania|guardia|grupo de (soldados|guerreros|arqueros)|centinelas?)\b/.test(n) ||
      (/\b(guard\w*|vigil\w*|proteg\w*|defend\w*|custodi\w*|atac\w*|ataq\w*|asalt\w*|tom(ad|en|ar)|sitia\w*|asedi\w*)\b/.test(n) && numero1 >= 1 && soldados.test(n));
    if (escuadron) {
      const arma = /\b(arquer\w*|tirador\w*|honder\w*|fusiler\w*|ballester\w*)\b/.test(n) ? 'arqueros' : /\btanques?\b/.test(n) ? 'tanques' : null;
      const ataca = /\b(ataq\w*|atac\w*|asalt\w*|tom\w*|asedi\w*|sitia\w*|saque[aoe]\w*)\b/.test(n) ? plazaEnemiga(m, c, n) : null;
      const region = ataca != null ? ataca : regionPropia(m, c, n) != null ? regionPropia(m, c, n) : (/\b(patrull\w*|vigil\w*|guard\w*)\b/.test(n) ? regionPropia(m, c, 'frontera') : null);
      return [{ tipo: 'escuadron', n: numero1 >= 1 ? Math.round(numero1) : arma === 'tanques' ? 3 : 8, arma, region, ataca: ataca != null || undefined }];
    }
    // «Entrenad arqueros», «más arqueros»: sin arquería se construye; con ella, un escuadrón de arqueros.
    if (/\b(entren\w*|form\w*|prepar\w*|mas|quiero|necesit\w*|reclut\w*)\b/.test(n) && /\b(arquer\w*|tirador\w*|ballester\w*)\b/.test(n)) {
      if (!(c.arquerias > 0)) return [{ tipo: 'construir', obra: 'arqueria' }];
      return [{ tipo: 'escuadron', n: numero1 >= 1 ? Math.round(numero1) : 6, arma: 'arqueros', region: null }];
    }
    // Reforestar: «plantad árboles», «reforestad el bosque»: los leñadores plantan con las semillas que haya.
    if (/\b(plant\w*|reforest\w*|repobl\w*|sembr\w* arboles|siembr\w* arboles)\b/.test(n) && /\b(arbol\w*|bosques?|pinos?|retonos?|semillas?|reforest\w*|repobl\w*)\b/.test(n)) return [{ tipo: 'reforestar' }];
    // Fabricar armas: «fabricad 20 fusiles», «forjad espadas», «producid armas de fuego»; y muebles en la fábrica.
    const verboFab = /\b(fabric\w*|forj\w*|produc\w*|manufactur\w*|hac\w*|hag\w*|elabor\w*)\b/.test(n) && !/\b(compr\w*|vend\w*|export\w*|import\w*)\b/.test(n);
    if (verboFab && /\b(armas?|armamento|fusiles?|rifles?|espingardas?|mosquetes?|arcabuces?|escopetas?|carabinas?|pistolas?|ametralladoras?|espadas?|lanzas?|hachas de guerra|municion\w*|balas)\b/.test(n) && !/\b(tanques?|blindados?|canon\w*|artilleri\w*|aviones?)\b/.test(n))
      return [{ tipo: 'fabricar', que: 'armas', n: numero1 >= 1 ? Math.round(numero1) : 20 }];
    if (verboFab && /\b(granadas?|bombas de mano)\b/.test(n)) return [{ tipo: 'fabricar', que: 'granadas', n: numero1 >= 1 ? Math.round(numero1) : 30 }];
    if (verboFab && /\b(muebles?|mobiliario|sillas|mesas|bienes|manufacturas?|productos)\b/.test(n)) return [{ tipo: 'fabricar', que: 'muebles', n: numero1 >= 1 ? Math.round(numero1) : 20 }];
    // «Fabricad 5 tanques», «haced 3 cañones»: el cuartel los hace para el almacén (se usan o se venden).
    if (verboFab && numero1 >= 1 && /\b(tanques?|blindados?|canon\w*|artilleri\w*|vehiculos?)\b/.test(n)) return [{ tipo: 'fabricar', que: 'vehiculos', n: Math.round(numero1) }];
    // Vehículos: «fabricad tanques», «haced cañones», «quiero aviones».
    const veh = /\b(tanques?|blindados?|carros de combate)\b/.test(n) ? 'tanque' : /\b(canon\w*|artilleri\w*|obuses|morteros?|bombardas?)\b/.test(n) ? 'artilleria' : /\b(aviones?|bombarder\w*|cazas|aviacion)\b/.test(n) ? 'aviones' : null;
    if (veh && /\b(fabric\w*|constru\w*|hac\w*|hag\w*|produc\w*|quiero|necesit\w*|mas|arm\w*|compr\w*|dame|dadme)\b/.test(n)) return [{ tipo: 'vehiculos', cual: veh }];
    // Posturas: esperar el ataque, emboscada, al ataque, alto.
    if (/\b(esper\w* (el |al |un |a |a que )?(ataque|enemigo|invasion|asalto|que ataquen|que vengan|que lleguen)|aguant\w*|a la defensiva|posicion defensiva|atrincher\w*|cavad trincheras|trincheras?)\b/.test(n))
      return [{ tipo: 'defender', region: regionPropia(m, c, n) != null ? regionPropia(m, c, n) : c.capital, postura: 'esperar' }];
    if (/\b(emboscad\w*|tend\w* una trampa|escond\w*)\b/.test(n)) { const r = regionPropia(m, c, n + ' frontera'); return [{ tipo: 'defender', region: r != null ? r : c.capital, postura: 'emboscada' }]; }
    if (/\b(al ataque|ataquen ya|atacad ya|avanz\w*|carg\w*|adelante|a la carga|ofensiva|a por ellos|contraatac\w*|a muerte|sin piedad)\b/.test(n) && !o && !(m.ciudades || []).some(x => n.includes(norm(x.nombre)))) return [{ tipo: 'atacar' }];
    if (/^(alto|parad|deteneos|quietos|alto el fuego|cese el fuego|parad la guerra|deteneos ya)$/.test(n)) return c.guerras.length ? [{ tipo: 'defender', region: c.capital, postura: 'alto' }] : [{ tipo: 'fiesta', descanso: true }];
    if (/\b(rendi\w*|rinda\w*|rendicion|capitul\w*|rindete|rendid|nos rendimos|bandera blanca)\b/.test(n)) return [{ tipo: 'rendicion', con: o ? o.id : (c.guerras[0] ? c.guerras[0].con : null) }];
    // Diplomacia menuda: espiar, insultar, regalar; y la guerra sucia: quemar sus campos, saquear.
    if (/\b(espi\w*|infiltr\w*|reconocimiento|averigu\w*|investig\w* (a|al|sobre))\b/.test(n) && (o || c.guerras.length)) return [{ tipo: 'espiar', con: o ? o.id : c.guerras[0].con }];
    if (/\b(insult\w*|provoc\w*|amenaz\w*|humill\w*|burl\w*|ofend\w*|desafi\w*)\b/.test(n) && o) return [{ tipo: 'insultar', con: o.id }];
    if (/\b(regal\w*|obsequi\w*|tribut\w*|soborn\w*|don\w* (oro|riqueza)|envi\w* (oro|regalos?|presentes?)|pag\w* a)\b/.test(n) && o) return [{ tipo: 'regalo', con: o.id }];
    // El exterminio: «exterminad a la gente de X», «genocidio en X». Los soldados matan también a los civiles.
    if (/\b(extermin\w*|genocid\w*|aniquil\w*|limpieza etnica|pasad a cuchillo|matad a todos|matad a toda|que no quede nadie)\b/.test(n)) {
      if (/\b(parad|deten\w*|dejad de|basta|cancel\w*|perdon\w*|piedad|clemencia|suspend\w*)\b/.test(n)) return [{ tipo: 'exterminio', parar: true }];
      return [{ tipo: 'exterminio', con: o ? o.id : c.guerras.length ? c.guerras[0].con : null }];
    }
    if (/\b(quem\w*|incendi\w*|arras\w*|sabote\w*|envenen\w*|destru\w* sus|talad sus|robad)\b/.test(n) && /\b(sus|enemig\w*|de \w+|su)\b/.test(n)) return [{ tipo: 'sabotaje', con: o ? o.id : c.guerras.length ? c.guerras[0].con : null }];
    if (/\b(saque[aoe]\w*|pillad\w*|asedi\w*|sitia\w*|asalt\w*)\b/.test(n)) { const r = plazaEnemiga(m, c, n); return r != null ? [{ tipo: 'objetivo', region: r }] : [{ tipo: 'atacar' }]; }
    // Cazar lobos: unos cuantos salen armados a por ellos (3 turnos).
    if (/\b(caz\w*|mat\w*|ahuyent\w*) (a )?(los )?lobos?\b/.test(n)) return [{ tipo: 'cuadrilla', n: numero1 >= 1 ? Math.round(numero1) : 4, de: -1, a: 4, hasta: { turnos: 3 } }];
    // Reparar: las ruinas propias vuelven a ser casas (y se apaga lo que arda).
    if (/\b(repar\w*|reconstru\w*|restaur\w*|apag\w*|extingu\w*|arregl\w* las casas|levant\w* las ruinas)\b/.test(n)) return [{ tipo: 'reparar' }];
    // El pueblo: impuestos, fiestas, rezar, curar, trabajar todos.
    if (/\bimpuestos?|tributos?|diezmo\b/.test(n) && !o) return [{ tipo: 'impuestos', sube: !/\b(baj\w*|quit\w*|elimin\w*|reduc\w*|perdon\w*|menos)\b/.test(n) }];
    if (/\b(fiesta\w*|festej\w*|celebr\w*|banquete\w*|feria|carnaval|descans\w*|vacaciones|dia libre|que nadie trabaje|tomaos un respiro)\b/.test(n)) return [{ tipo: 'fiesta', descanso: /\b(descans\w*|vacaciones|dia libre|nadie trabaje|respiro)\b/.test(n) || undefined }];
    // Las huelgas obreras: ceder (subir salarios, negociar) o reprimir.
    if (/\b(huelg\w*|obreros|sindicat\w*|salarios?|sueldos? de los obreros|jornales?)\b/.test(n)) {
      if (/\b(reprim\w*|aplast\w*|disolv\w*|disuelv\w*|cargad|policia|porras|ejercito contra|soldados contra|esquiroles|despedid)\b/.test(n)) return [{ tipo: 'huelga', ceder: false }];
      if (/\b(sub\w*|aument\w*|pag\w*|negoci\w*|acuerdo|ced\w*|dad\w* lo que piden|mejor\w*|escuch\w*)\b/.test(n)) return [{ tipo: 'huelga', ceder: true }];
    }
    if (/\b(rez\w*|orad|oren|plegarias?|misa|ofrendas?|sacrifici\w*|culto|procesion\w*|oracion\w*)\b/.test(n)) return [{ tipo: 'rezar' }];
    if (/\b(cur\w*|san(ad|en) a|heridos|medic\w*|hospital\w*|curanderos?)\b/.test(n)) return [{ tipo: 'curar' }];
    if (/\b(que trabajen todos|todos a trabajar|a trabajar|manos a la obra|nadie ocioso|no os quedeis quietos|a currar|espabil\w*)\b/.test(n)) return [{ tipo: 'trabajar' }];
    // «Quiero un ejército de 30».
    const ej = n.match(new RegExp('\\bejercito de ' + NUM));
    if (ej && numero(ej[1]) >= 1) return [{ tipo: 'cupo', o: 4, n: Math.round(numero(ej[1])) }];
    return null;
  }
  function economia(m, c, n) {
    // Subir de edad: «avanzad de edad», «pasad a la Edad del Hierro», «¿qué nos falta para la próxima edad?».
    const edad = /\b(edad|era|epoca)\b/.test(n);
    if (edad && /\b(que (nos )?falta|que necesit\w*|requisitos|cuando (llega|podemos)|como (llegamos|pasamos))\b/.test(n)) return [{ tipo: 'consulta_edad' }];
    if (edad && /\b(solos?|automatic\w*|cuando pueda\w*|por su cuenta)\b/.test(n) && /\b(avan[zc]\w*|sub\w*|pas\w*)\b/.test(n)) return [{ tipo: 'edad_auto', si: !/\b(no|nunca|dejad de)\b/.test(n) }];
    if (edad && /\b(ahorr\w*|guard\w*|junt\w*)\b/.test(n)) return [{ tipo: 'ahorrar_edad', si: !/\b(no|dejad de)\b/.test(n) }];
    if (edad && /\b(avanz\w*|sub\w*|pas\w*|entr\w*|lleg\w*|adelant\w*|cambi\w*|ir a|vamos a)\b/.test(n)) return [{ tipo: 'edad' }];
    // Una tecnología por su nombre (o por lo que da): «investigad la rueda», «quiero la imprenta», «estudiad el hierro».
    const quiereTec = /\b(investig\w*|estudi\w*|descubr\w*|invent\w*|desarroll\w*|aprend\w*|quiero|queremos|centr\w* en|prioriz\w*)\b/.test(n);
    const tec = M.TECNOLOGIAS.find(t => n.includes(norm(t.nombre))) || M.TECNOLOGIAS.find(t => n.includes(norm(t.invento).replace(/^(el|la|los|las) /, ''))) || M.TECNOLOGIAS.find(t => new RegExp('\\b' + t.id.replace('_', ' ') + '\\b').test(n));
    if (tec && quiereTec) return [{ tipo: 'investigar', id: tec.id }];
    if (/\b(que investig\w*|que (podemos )?investigar|que estudi\w*|tecnolog\w*|tecnica|arbol)\b/.test(n) && /\b(que|cual|cuales|lista|ver|como va|como van)\b/.test(n)) return [{ tipo: 'consulta_tec' }];
    // El tesoro.
    const cosa = n.match(/\b(madera|lena|comida|trigo|grano|alimentos?|piedras?|metal|hierro|armas?|espadas|lanzas|fusiles|armamento|carbon|hulla|petroleo|crudo|gasolina|combustible|muebles?|mobiliario|tanques?|blindados?|vehiculos?|canones|canon|obuses|artilleria|granadas?|semillas?|retonos?|plantones?)\b/);
    const BIEN = { semilla: 'semillas', retono: 'semillas', retonos: 'semillas', planton: 'semillas', plantones: 'semillas', mueble: 'muebles', mobiliario: 'muebles', tanque: 'vehiculos', tanques: 'vehiculos', blindado: 'vehiculos', blindados: 'vehiculos', vehiculo: 'vehiculos', canones: 'vehiculos', canon: 'vehiculos', obuses: 'vehiculos', artilleria: 'vehiculos', granada: 'granadas', hulla: 'carbon', crudo: 'petroleo', gasolina: 'petroleo', combustible: 'carbon', lena: 'madera', trigo: 'comida', grano: 'comida', alimento: 'comida', alimentos: 'comida', piedras: 'piedra', hierro: 'metal', arma: 'armas', espadas: 'armas', lanzas: 'armas', fusiles: 'armas', armamento: 'armas' };
    // Las ofertas de los mercaderes: «acepto el trato», «rechazad la oferta».
    if (/\b(trato|oferta|propuesta del mercader)\b/.test(n) && /\b(acept\w*|cerr\w*|hecho|vale|de acuerdo|si|rechaz\w*|no|nada)\b/.test(n) && !/\bpaz\b/.test(n)) return [{ tipo: 'oferta', si: !/\b(rechaz\w*|no|nada)\b/.test(n) }];
    // El mercado: «¿cómo está el mercado?», «precios», «especializaos en madera», «producid armas para vender».
    if (/\b(mercado|precios?|cuanto (vale|valen|cuesta|cuestan))\b/.test(n) && !/\b(compr\w*|vend\w*)\b/.test(n)) return [{ tipo: 'consulta_mercado' }];
    if (/\b(especializ\w*|dedica\w* a|dedicaos|vivid de|nuestro negocio)\b/.test(n) || (/\bpara vender\b/.test(n) && cosa)) {
      if (!cosa && /\b(no|dejad de|quita\w*|como querais|lo que querais)\b/.test(n)) return [{ tipo: 'especialidad', que: null }];
      if (cosa) return [{ tipo: 'especialidad', que: BIEN[cosa[1]] || cosa[1] }];
    }
    if (/\b(compr\w*|adquir\w*|import\w*)\b/.test(n) && cosa) { const mt = n.match(new RegExp('\\b' + NUM + '\\b')); return [{ tipo: 'comprar', que: BIEN[cosa[1]] || cosa[1], n: mt ? Math.round(numero(mt[1]) || 0) : null }]; }
    if (/\b(vend\w*|export\w*)\b/.test(n) && cosa) { const mt = n.match(new RegExp('\\b' + NUM + '\\b')); return [{ tipo: 'vender', que: BIEN[cosa[1]] || cosa[1], n: mt ? Math.round(numero(mt[1]) || 0) : null }]; }
    if (/\b(guard\w*|ahorr\w*|no gast\w*|reserv\w*) (el |todo el |nuestro )?(oro|dinero|tesoro)\b/.test(n)) return [{ tipo: 'tesoro', guardar: true }];
    if (/\b(invert\w*|gast\w*|usad|usa|financ\w*|pag\w*) (el |todo el )?(oro|dinero|tesoro)\b/.test(n) || /\b(mecenazgo|becas|pagad a los sabios)\b/.test(n)) return [{ tipo: 'tesoro', guardar: false }];
    if (/\b(cuanto oro|cuanto dinero|tesoro|arcas|presupuesto|cuentas|ingresos|gastos)\b/.test(n) && !/\b(sub\w*|baj\w*)\b/.test(n)) return [{ tipo: 'consulta_oro' }];
    return null;
  }
  const PRECIO = { madera: 0.6, comida: 0.5, piedra: 0.9, metal: 2.5, armas: 6, carbon: 1.4, petroleo: 3.2, muebles: 2.4, vehiculos: 30, semillas: 0.35, granadas: 1.6 };
  // Con quién comercia de verdad un pueblo: los del otro lado de sus rutas entre reinos.
  const sociosDe = (m, c) => [...new Set(((m.vida && m.vida.rutas) || []).filter(ru => ru.tipo === 'externa' && (ru.a === c.id || ru.b === c.id)).map(ru => (ru.a === c.id ? ru.b : ru.a)))].map(id => S().civ(m, id)).filter(o => o && o.viva && !S().enGuerra(c, o));
  function aplicarEconomia(m, c, a, textos) {
    const p = plan(c), v = m.vida, an = t => v && (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: t });
    const mk = m.mercado, pausa = M.vida && M.vida.pausada(m);
    if (a.tipo === 'oferta') { const r = M.vida.aceptarOferta(m, c, a.si); textos.push(r.texto); if (r.ok && a.si) an('🤝 Trato cerrado'); return; }
    if (a.tipo === 'consulta_mercado') {
      if (!mk) { textos.push('Aún no hay mercado entre los reinos.'); return; }
      const fl = k => { const h = mk.historia[k] || []; const d = h.length > 6 ? h[h.length - 1] - h[h.length - 7] : 0; return d > 0.02 ? ' ▲' : d < -0.02 ? ' ▼' : ''; };
      const socios = sociosDe(m, c);
      textos.push('Precios del mundo: ' + M.vida.bienesDe(c).map(k => M.vida.NOMBRE_BIEN[k] + ' ' + (mk.precio[k] || M.vida.PRECIO_BASE[k]).toFixed(2) + fl(k)).join(' · ') + '. ' + (socios.length ? 'Comerciáis con ' + socios.map(o => o.nombre + (o.balance ? ' (le falta ' + (M.vida.BIENES.filter(k => o.balance.urg[k] > 0.3).join(', ') || 'poco') + ')' : '')).join(', ') + '.' : 'No comerciáis con nadie: sin una ruta con otro reino, todo lo tenéis que producir vosotros («comerciad con X»).') + (c.especialidad ? ' Vuestra especialidad: ' + c.especialidad + '.' : ''));
      return;
    }
    if (a.tipo === 'especialidad') {
      p.especialidad = a.que || null;
      if (a.que) c.especialidad = a.que;
      textos.push(a.que ? 'Tu pueblo se dedicará sobre todo a ' + (a.que === 'armas' ? 'forjar armas (hace falta cuartel y metal)' : a.que === 'muebles' ? 'fabricar muebles (hace falta fábrica y madera)' : a.que === 'vehiculos' ? 'fabricar vehículos de guerra (hace falta cuartel y metal)' : a.que === 'comida' ? 'cultivar y criar ganado' : a.que === 'madera' ? 'talar' : 'sacar ' + NB(a.que)) + ', y lo que sobre lo venderán vuestros comerciantes a quien lo necesite.' + (sociosDe(m, c).length ? '' : ' Ojo: sin rutas con otros reinos no tendréis a quién venderlo.') : 'Tu pueblo vuelve a elegir solo a qué dedicarse, según su tierra y los precios.');
      return;
    }
    if ((a.tipo === 'comprar' || a.tipo === 'vender') && pausa) {
      // Solo se compra y se vende con un reino con el que se comercia: el pedido lo trae (o lo lleva) la carreta.
      if (!PRECIO[a.que]) { textos.push('Eso no se compra ni se vende.'); return; }
      const socios = sociosDe(m, c), precio = mk ? mk.precio[a.que] : PRECIO[a.que];
      if (!socios.length) { textos.push('No comerciáis con ningún reino: no hay a quién ' + (a.tipo === 'comprar' ? 'comprar' : 'vender') + '. Abrid una («abrid una ruta comercial con X») o producidlo vosotros.'); return; }
      const nq = a.n || (a.tipo === 'comprar' ? Math.max(5, Math.floor((c.oro || 0) * 0.5 / precio)) : Math.floor((c[a.que] || 0) * 0.5));
      if (nq <= 0) { textos.push(a.tipo === 'comprar' ? 'No hay oro para comprar ' + NB(a.que) + '.' : 'No tenéis ' + NB(a.que) + ' que vender.'); return; }
      const lista = a.tipo === 'comprar' ? (p.pedidos = p.pedidos || []) : (p.ventas = p.ventas || []);
      lista.push({ que: a.que, n: nq, desde: m.turno });
      const tienen = socios.filter(o => o.balance && (a.tipo === 'comprar' ? o.balance.sobra[a.que] >= 1 : o.balance.falta[a.que] >= 1));
      an((a.tipo === 'comprar' ? '📦 Pedido: ' : '🏷 A la venta: ') + nq + ' ' + NB(a.que));
      textos.push(a.tipo === 'comprar' ? 'Encargáis ' + nq + ' de ' + NB(a.que) + ' a unas ' + precio.toFixed(2) + ' de oro cada una (' + Math.round(nq * precio) + ' en total, más si corre prisa). ' + (tienen.length ? 'A ' + tienen.map(o => o.nombre).join(' y ') + ' le sobra: vuestros comerciantes lo traerán en la próxima carreta.' : 'Ahora a vuestros socios no les sobra; en cuanto tengan, llegará. Mientras, quizá convenga producirlo.') : 'Ponéis a la venta ' + nq + ' de ' + NB(a.que) + ' (unas ' + precio.toFixed(2) + ' de oro cada una). ' + (tienen.length ? 'A ' + tienen.map(o => o.nombre).join(' y ') + ' le hace falta: la carreta saldrá cargada.' : 'Ahora ningún socio lo necesita; se venderá cuando lo pidan.'));
      return;
    }
    if (a.tipo === 'edad' || a.tipo === 'consulta_edad') {
      const sig = M.ERAS[c.era + 1];
      if (!sig) { textos.push('Ya estáis en la última edad.'); return; }
      if (c.subiendo) { textos.push('Ya estáis pasando a ' + sig.con + ': faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos.'); return; }
      const r = S().puedeSubir(m, c), req = M.EDADES[c.era + 1];
      const precio = req ? ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => req[k] + ' de ' + k).join(', ') : '';
      if (a.tipo === 'edad' && r.ok) {
        S().empezarSubida(m, c);
        an('⏫ Hacia ' + sig.nombre);
        textos.push('¡Adelante! Pagáis ' + precio + ' y empieza el paso a ' + sig.con + ' (' + (c.subiendo.hasta - m.turno) + ' turnos). Cuando termine, llegan sus armas, edificios y técnicas.');
        return;
      }
      textos.push((a.tipo === 'edad' ? 'Aún no podéis pasar a ' + sig.con + '. ' : 'Para pasar a ' + sig.con + ' hace falta: saber ' + sig.umbral + (sig.desde != null && !m.libre ? ', llegar al año ' + S().anioTexto(sig.desde).replace(/(\d)\.$/, '$1') : '') + (req ? ', ' + req.texto + ' y pagar ' + precio : '') + '. ') + (r.falta.length ? 'Os falta: ' + r.falta.join(', ') + '.' : '¡Lo tenéis todo! Decid «avanzad de edad».') + (r.falta.some(x => /saber/.test(x)) ? ' El saber lo traen tus ' + M.ERUDITO(c.era).varios + ': «más ' + M.ERUDITO(c.era).varios + '».' : ''));
      return;
    }
    if (a.tipo === 'edad_auto') { p.autoEdad = !!a.si; textos.push(a.si ? 'Tu gobierno pasará de edad solo en cuanto se pueda.' : 'Pasar de edad volverá a ser decisión tuya («avanzad de edad»).'); return; }
    if (a.tipo === 'ahorrar_edad') { p.ahorrarEdad = !!a.si; textos.push(a.si ? 'Se ahorra para la próxima edad: cuando tengáis el saber, no se gastará oro en mejoras ni edificios que no pida la edad.' : 'Se deja de ahorrar: el oro vuelve a gastarse en mejoras y edificios.'); return; }
    if (a.tipo === 'investigar') {
      const t = M.TECNOLOGIAS.find(x => x.id === a.id);
      if (!t) { textos.push('No conozco esa tecnología.'); return; }
      const ts = M.tecsDe(c);
      if (ts.includes(t.id)) { textos.push('Ya domináis ' + t.nombre.toLowerCase() + '.'); return; }
      if (t.era > c.era) { const faltan = M.TECNOLOGIAS.filter(x => x.era <= c.era && !ts.includes(x.id)); textos.push(t.nombre + ' es ' + ('de ' + M.ERAS[t.era].con).replace(/^de el /, 'del ') + '. Antes hay que dominar lo de ahora' + (faltan.length ? ': ' + faltan.map(x => x.nombre.toLowerCase()).join(', ') : '') + (m.libre || !M.ERAS[c.era + 1] || M.ERAS[c.era + 1].desde == null ? '' : ', y la nueva era no llega antes de ' + S().anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) + '.'); return; }
      const falta = S().faltaPara(m, c, t), inv = c.investigacion = c.investigacion || { id: null, puntos: 0 };
      if (falta.length && inv.id !== t.id) { p.investigar = t.id; textos.push(t.nombre + ' se investiga en ' + (M.LUGARES[t.lugar] || 'la plaza') + ' y cuesta ' + Object.keys(t.precio).map(k => t.precio[k] + ' de ' + k).join(', ') + '. Os falta: ' + falta.join(', ') + '. Queda apuntada: empezará en cuanto se pueda.'); return; }
      p.investigar = t.id;
      // Lo que llevaba la investigación anterior no se pierde del todo: la mitad pasa a la nueva.
      if (inv.id !== t.id) { inv.puntos = 0; inv.id = t.id; for (const k of Object.keys(t.precio || {})) c[k] = (c[k] || 0) - t.precio[k]; }
      an('🔬 Investigando: ' + t.nombre);
      textos.push('Tus ' + M.ERUDITO(c.era).varios + ' se ponen con ' + t.nombre.toLowerCase() + ' en ' + (M.LUGARES[t.lugar] || 'la plaza') + ' (' + t.texto + '; pagado: ' + Object.keys(t.precio).map(k => t.precio[k] + ' de ' + k).join(', ') + '). Cuesta ' + M.costeTec(t) + ' de ciencia; con lo de ahora, unos ' + Math.max(1, Math.ceil((M.costeTec(t) - inv.puntos) / Math.max(0.01, (c.cienciaTurno || 1)))) + ' turnos. Más ciencia: más gente, estabilidad, ciudades, rutas y oro para los sabios.');
      return;
    }
    if (a.tipo === 'consulta_tec') {
      const ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
      const libres = M.TECNOLOGIAS.filter(t => t.era <= c.era && !ts.includes(t.id));
      textos.push((inv ? 'Investigáis ' + inv.nombre.toLowerCase() + ' (' + Math.round(100 * c.investigacion.puntos / M.costeTec(inv)) + ' %). ' : '') + (libres.length ? 'Podéis investigar: ' + libres.map(t => t.nombre + ' (' + t.texto + ')').join('; ') + '.' : 'Domináis todo lo de ' + M.ERAS[c.era].con + (M.ERAS[c.era + 1] ? '; la próxima era llegará ' + (m.libre || M.ERAS[c.era + 1].desde == null ? 'enseguida' : 'en ' + S().anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) : '') + '.') + ' Dominadas: ' + ts.length + ' de ' + M.TECNOLOGIAS.length + '.');
      return;
    }
    if (a.tipo === 'comprar' || a.tipo === 'vender') {
      const precio = PRECIO[a.que];
      if (!precio) { textos.push('Eso no se compra ni se vende.'); return; }
      if (a.tipo === 'comprar') {
        const max = Math.floor((c.oro || 0) / precio), n = Math.min(a.n || Math.floor(max * 0.5), max);
        if (n <= 0) { textos.push('No hay oro para comprar ' + NB(a.que) + ' (cada unidad cuesta ' + precio + ').'); return; }
        c.oro -= n * precio; c[a.que] = (c[a.que] || 0) + n;
        an('🪙 −' + Math.round(n * precio) + ' · +' + n + ' ' + NB(a.que));
        textos.push('Los mercaderes traen ' + n + ' de ' + NB(a.que) + ' por ' + Math.round(n * precio) + ' de oro. Quedan ' + Math.round(c.oro) + '.');
      } else {
        const tiene = Math.floor(c[a.que] || 0), n = Math.min(a.n || Math.floor(tiene * 0.5), tiene);
        if (n <= 0) { textos.push('No tenéis ' + NB(a.que) + ' que vender.'); return; }
        const gana = Math.round(n * precio * 0.6);
        c[a.que] -= n; c.oro = (c.oro || 0) + gana;
        an('🪙 +' + gana + ' · −' + n + ' ' + a.que);
        textos.push('Vendéis ' + n + ' de ' + a.que + ' por ' + gana + ' de oro (los mercaderes compran barato). Tesoro: ' + Math.round(c.oro) + '.');
      }
      return;
    }
    if (a.tipo === 'tesoro') {
      p.guardarOro = !!a.guardar;
      textos.push(a.guardar ? 'El tesoro se guarda: el oro que sobre ya no irá a pagar sabios y escuelas.' : 'El oro que sobre de la reserva pagará sabios, escuelas y bibliotecas: más investigación.');
      return;
    }
    if (a.tipo === 'consulta_oro') {
      textos.push('Tesoro: ' + Math.round(c.oro || 0) + ' de oro. Por turno entran ' + (c.ingresos || 0).toFixed(1) + ' (impuestos y comercio) y salen ' + (c.gastos || 0).toFixed(1) + ' (sueldos de ' + (c.guerreros || 0) + ' soldados y mantenimiento)' + (c.mecenazgo ? ', y ' + c.mecenazgo.toFixed(1) + ' van a los sabios' : '') + '. Los edificios cuestan oro; sin oro, los soldados desertan.');
    }
  }
  function aplicarExtra(m, c, a, textos) {
    const p = plan(c), v = m.vida, an = (t, r) => (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: t, region: r });
    const o = a.con != null ? S().civ(m, Number(a.con)) : null;
    const nombreR = r => nombreSitio(m, c, r);
    if (a.tipo === 'escuadron') {
      const disp = adultosDe(m, c).filter(x => !x.fijo && (x.edad || 0) < M.vida.VIEJO);
      // Primero los guerreros que ya hay; si no llegan, se llama a otros.
      disp.sort((x, y) => (y.o === 4) - (x.o === 4) || (x.k ? 1 : 0) - (y.k ? 1 : 0));
      const elegidos = disp.slice(0, a.n);
      if (!elegidos.length) { textos.push('No queda gente para formar un escuadrón.'); return; }
      const id = (p.sigCuadrilla = (p.sigCuadrilla || 0) + 1), k = (p.sigEscuadron = (p.sigEscuadron || 0) + 1);
      for (const x of elegidos) {
        x.fijo = { g: id, vuelve: x.o, guardia: a.region != null ? a.region : undefined };
        if (x.o !== 4) M.vida.mover(x, 4);
        if (a.arma === 'arqueros' && c.arquerias > 0) x.tirador = true;
        if (a.arma === 'tanques' && c.era >= 8 && c.cuarteles > 0 && (c.metal || 0) >= 10) { c.metal -= 10; x.veh = 'tanque'; x.tirador = true; x.pv = x.pv0 = M.vida.VEHICULOS.tanque.vida; }
      }
      const nTanques = elegidos.filter(x => x.veh === 'tanque').length;
      // Un escuadrón que va a por una plaza enemiga declara la guerra si hace falta.
      const dueno = a.ataca ? S().civ(m, m.dueno[a.region]) : null;
      const declara = dueno && dueno.id !== c.id && !S().enGuerra(c, dueno);
      if (declara) { S().declararGuerra(m, c, dueno, 'Por orden de su gobierno, ' + c.nombre + ' declara la guerra a ' + dueno.nombre + ' y manda un escuadrón contra ' + nombrePlaza(m, a.region) + '.'); p.guerrasMias = [...new Set([...(p.guerrasMias || []), dueno.id])]; }
      const que = a.arma === 'arqueros' ? 'arqueros' : a.arma === 'tanques' ? 'tanques' : 'soldados';
      const mision = a.region == null ? '' : a.ataca ? ' → ataca ' + nombreR(a.region) : ' → guarda ' + nombreR(a.region);
      const texto = 'Escuadrón ' + k + ' (' + elegidos.length + ' ' + que + ')' + mision;
      (p.cuadrillas = p.cuadrillas || []).push({ id, n: elegidos.length, de: -1, a: 4, hasta: null, texto, escuadron: k, region: a.region });
      an('⚑ ' + texto, a.region);
      const avisos = [];
      if (a.arma === 'arqueros' && !(c.arquerias > 0)) avisos.push(' Sin arquería no hay arcos: luchan cuerpo a cuerpo hasta que la construyáis («construid una arquería»).');
      if (a.arma === 'tanques' && nTanques < elegidos.length) avisos.push(c.era < 8 ? ' Los tanques llegan con la Segunda Guerra Mundial: de momento van a pie.' : ' Solo había metal para ' + nTanques + ' tanque' + (nTanques === 1 ? '' : 's') + ' (cada uno cuesta 10).');
      if (declara) avisos.push(' ¡Guerra contra ' + dueno.nombre + '!');
      textos.push('Formado el escuadrón ' + k + ': ' + elegidos.length + ' ' + que + (a.region != null ? (a.ataca ? ' marchan sobre ' : ' montan guardia en ') + nombreR(a.region) : ' bajo tu mando') + '. No se mueven de ahí hasta que digas «liberad las cuadrillas».' + avisos.join(''));
      return;
    }
    if (a.tipo === 'vehiculos') {
      if (a.cual === 'aviones') { textos.push(c.era >= 8 ? 'Tus bombarderos ya despegan solos en cada guerra si hay metal (3 por salida) y un cuartel. Metal: ' + Math.floor(c.metal || 0) + '.' + (c.guerras.length ? '' : ' Ahora estáis en paz.') : 'Los aviones llegan con la Segunda Guerra Mundial.'); if (c.era >= 8) p.prioridad.piedra = Math.max(p.prioridad.piedra, 1.5); return; }
      const era = a.cual === 'tanque' ? 8 : 5;
      if (c.era < era) { textos.push(a.cual === 'tanque' ? 'Los tanques llegan con la Segunda Guerra Mundial.' : 'Los cañones llegan con la pólvora.'); return; }
      if (!(c.cuarteles > 0)) { textos.push('Hace falta un cuartel para fabricarlos: «construid un cuartel».'); return; }
      p.vehiculos = a.cual; p.prioridad.piedra = Math.max(p.prioridad.piedra, 1.5);
      an('⚙ Fábrica de ' + (a.cual === 'tanque' ? 'tanques' : 'cañones'));
      textos.push('El cuartel se pone a fabricar ' + (a.cual === 'tanque' ? 'tanques (10 de metal cada uno)' : 'piezas de artillería (' + (c.era >= 7 ? 5 : 4) + ' de metal)') + ': uno de cada tres soldados tendrá uno. Metal: ' + Math.floor(c.metal || 0) + '; los mineros buscarán más.');
      return;
    }
    if (a.tipo === 'atacar') {
      if (!c.guerras.length) { const ob = vecinoMasDebil(m, c); textos.push('No estáis en guerra con nadie. Di contra quién: «atacad a ' + (ob ? ob.nombre : 'X') + '».'); return; }
      p.defender = null;
      const e = v.ejercitos && v.ejercitos[c.id]; if (e) { e.defiende = null; e.fase = 'marcha'; }
      M.vida.reasignar(m, c, null, true);
      an('⚔ ¡Al ataque!');
      textos.push('¡Al ataque! Tus guerreros dejan de esperar y marchan ' + (e ? 'sobre ' + nombrePlaza(m, e.obj) : 'contra ' + S().civ(m, c.guerras[0].con).nombre) + '.');
      return;
    }
    if (a.tipo === 'rendicion') {
      if (!o || !S().enGuerra(c, o)) { textos.push(o ? 'No estáis en guerra con ' + o.nombre + '.' : 'No estáis en guerra con nadie.'); return; }
      // Rendirse: paz segura, pero el vencedor se queda con tierras de la frontera y parte del oro.
      const fr = S().frontera(m, o, c).filter(r => r !== c.capital && !(m.ciudades || []).some(x => x.region === r)).slice(0, 3);
      for (const r of fr) m.dueno[r] = o.id;
      const oro = Math.round((c.riqueza || 0) * 0.25); c.riqueza -= oro; o.riqueza += oro; c.estab -= 6;
      S().hacerPaz(m, c, o, c.nombre + ' se rinde ante ' + o.nombre + '. Entrega ' + fr.length + ' comarcas de la frontera y un tributo de ' + oro + ' de oro.');
      an('🏳 Rendición ante ' + o.nombre);
      textos.push('Te rindes ante ' + o.nombre + ': hay paz, pero pierdes ' + fr.length + ' comarcas de la frontera y ' + oro + ' de oro. La gente está abatida.');
      return;
    }
    if (a.tipo === 'espiar') {
      if (!o) { textos.push('¿A quién? «Espiad a X».'); return; }
      const suyos = v.aldeanos.filter(x => x.c === o.id), g = suyos.filter(x => x.o === 4), e = v.ejercitos && v.ejercitos[o.id];
      const vehs = g.filter(x => x.veh).length;
      const mira = e && e.con === c.id ? (m.dueno[e.obj] === c.id ? ' ¡Su ejército va a por ' + nombreR(e.obj) + '!' : '') : '';
      const plan2 = (m.complots || []).find(x => x.de === o.id && x.contra === c.id);
      c.estab -= 0; o.rel[c.id] = (o.rel[c.id] || 0) - (S().azar(m) < 0.2 ? 15 : 0);
      textos.push('Tus espías vuelven de ' + o.nombre + ': ' + suyos.length + ' aldeanos, ' + g.length + ' guerreros' + (vehs ? ' (' + vehs + ' con vehículos)' : '') + ', ' + M.ERAS[o.era].nombre + ', ' + Math.floor(o.metal || 0) + ' de metal, ' + Math.floor(o.comida || 0) + ' de comida' + (o.torres ? '' : '') + '. ' + (S().fuerza(m, o) > S().fuerza(m, c) ? 'Son más fuertes que vosotros.' : 'Sois más fuertes que ellos.') + mira + (plan2 ? ' Traman algo contra vosotros (' + Math.round(plan2.progreso || 0) + ' %).' : '') + (o.guerras.length ? ' Están en guerra con ' + o.guerras.map(x => (S().civ(m, x.con) || {}).nombre).filter(Boolean).join(', ') + '.' : ''));
      return;
    }
    if (a.tipo === 'insultar') {
      o.rel[c.id] = (o.rel[c.id] || 0) - 25; c.rel[o.id] = (c.rel[o.id] || 0) - 10;
      const ira = S().azar(m) < 0.15 + (o.rel[c.id] < -60 ? 0.3 : 0) && !S().enGuerra(c, o);
      if (ira) S().declararGuerra(m, o, c, o.nombre + ' no perdona el insulto de ' + c.nombre + ' y le declara la guerra.');
      an('😠 Insulto a ' + o.nombre);
      textos.push('Tus heraldos insultan a ' + o.nombre + '. Su opinión de vosotros cae a ' + Math.round(o.rel[c.id]) + '.' + (ira ? ' ¡Os declaran la guerra!' : ''));
      return;
    }
    if (a.tipo === 'regalo') {
      const oro = Math.max(5, Math.round((c.oro || 0) * 0.2));
      if ((c.oro || 0) < 5) { textos.push('No tenéis oro que regalar.'); return; }
      c.oro -= oro; o.oro = (o.oro || 0) + oro; o.rel[c.id] = (o.rel[c.id] || 0) + 20 + Math.round(oro / 20);
      an('🎁 Regalo a ' + o.nombre);
      textos.push('Enviáis ' + oro + ' de oro a ' + o.nombre + '. Su opinión de vosotros sube a ' + Math.round(o.rel[c.id]) + '.' + (S().enGuerra(c, o) ? ' Quizá acepten antes la paz.' : ''));
      if (S().enGuerra(c, o)) { const g = o.guerras.find(x => x.con === c.id); if (g) g.cansancio += 2; }
      return;
    }
    if (a.tipo === 'exterminio') {
      if (a.parar) {
        if (p.exterminio == null) { textos.push('No hay ninguna orden de exterminio que parar.'); return; }
        const o = S().civ(m, p.exterminio); if (o) o.exterminadoPor = null; p.exterminio = null;
        textos.push('Los soldados vuelven a respetar a los civiles. El mundo no olvidará tan pronto lo que pasó.');
        return;
      }
      if (!o) { textos.push('¿A qué pueblo? Di el nombre del reino: «exterminad a la gente de Nombre».'); return; }
      if (o.id === c.id) { textos.push('Tus soldados se niegan a matar a su propia gente.'); return; }
      if (!S().enGuerra(c, o)) S().declararGuerra(m, c, o, c.nombre + ' declara la guerra a ' + o.nombre + ' con la intención de no dejar a nadie con vida.');
      p.exterminio = o.id; o.exterminadoPor = c.id; c.atrocidad = m.turno;
      p.guerrasMias = [...new Set([...(p.guerrasMias || []), o.id])]; if (p.objetivo == null) p.objetivo = o.capital;
      c.estab = Math.max(0, c.estab - 10); o.rel[c.id] = -100;
      for (const x of S().vivas(m)) if (x !== c && x !== o) x.rel[c.id] = (x.rel[c.id] || 0) - 40;
      an('☠ Orden de exterminio contra ' + o.nombre, o.capital);
      S().suceso(m, 'exterminio', o.capital, c, o, '☠ ¡' + c.nombre + ' ordena exterminar a ' + o.nombre + '!');
      S().cronica(m, 'guerra', c.nombre + ' ordena exterminar a ' + o.nombre, 'Los soldados de ' + c.nombre + ' tienen orden de matar a todo el que sea de ' + o.nombre + ', con o sin armas. Las noticias corren y los demás reinos miran a ' + c.nombre + ' con horror.', c, o.capital, { importante: true });
      textos.push('Orden dada: tus soldados matarán también a los civiles de ' + o.nombre + ' que encuentren, y la gente de las tierras que conquistes no se quedará a vivir contigo. Todos los reinos os odiarán (−40 de opinión) y tu pueblo pierde estabilidad. Para pararlo: «parad el exterminio».');
      return;
    }
    if (a.tipo === 'sabotaje') {
      if (!o || !S().enGuerra(c, o)) { textos.push('Solo en guerra: ' + (o ? 'no estáis en guerra con ' + o.nombre : 'no estáis en guerra') + '.'); return; }
      // Sus campos de la frontera arden: pierden comida y cosecha.
      const fr = S().frontera(m, c, o).slice(0, 4);
      let quemados = 0;
      for (const r of fr) for (const t of M.vida.parcelas(m, r)) if ((v.obra[t] === M.vida.OBRA.campo || v.arbol[t] >= 2) && S().azar(m) < 0.5) { if (M.vida.prender(m, t, 0, 4)) quemados++; }
      o.comida = Math.max(0, (o.comida || 0) * 0.7); o.rel[c.id] = (o.rel[c.id] || 0) - 15; c.estab -= 2;
      const g = o.guerras.find(x => x.con === c.id); if (g) g.cansancio += 1.5;
      an('🔥 Campos de ' + o.nombre + ' en llamas', fr[0]);
      S().cronica(m, 'guerra', c.nombre + ' quema los campos de ' + o.nombre, 'Partidas de ' + c.nombre + ' cruzan la frontera de noche y prenden fuego a ' + quemados + ' campos y arboledas. El hambre será otra arma de esta guerra.', c, fr[0]);
      textos.push('Tus partidas prenden fuego en ' + quemados + ' campos y arboledas de ' + o.nombre + ' en la frontera: lo verás arder y extenderse. Su granero pierde un tercio y se cansarán antes de la guerra.');
      return;
    }
    if (a.tipo === 'impuestos') {
      p.ultimoImpuesto = m.turno;
      // Los impuestos se quedan donde los pongas: más oro cada turno a cambio de estabilidad (o al revés).
      p.impuesto = Math.max(0.5, Math.min(1.75, Math.round(((p.impuesto || 1) + (a.sube ? 0.25 : -0.25)) * 100) / 100));
      const nivelI = p.impuesto >= 1.5 ? 'muy altos' : p.impuesto > 1 ? 'altos' : p.impuesto < 0.75 ? 'muy bajos' : p.impuesto < 1 ? 'bajos' : 'normales';
      an(a.sube ? '💰 Impuestos ' + nivelI : '🙂 Impuestos ' + nivelI);
      textos.push('Impuestos ' + nivelI + ' (×' + p.impuesto + '): ' + (a.sube ? 'entra más oro cada turno, pero la gente está menos contenta.' : 'la gente está más contenta y entra menos oro.') + ' Para volver a lo normal, súbelos o bájalos otra vez.');
      return;
    }
    if (a.tipo === 'reforestar') {
      p.reforestar = m.turno + 24;
      const sem = Math.floor(c.semillas || 0);
      an('🌱 A replantar el bosque');
      textos.push('Los leñadores dedican los próximos turnos a plantar retoños' + (sem ? ' (tenéis ' + sem + ' semillas de árbol).' : ', pero no tenéis semillas: se recogen al talar, o se compran en el mercado («comprad semillas»).') + ' Cada retoño tarda unos años en ser un árbol que se pueda talar.');
      return;
    }
    if (a.tipo === 'fabricar') {
      const V = M.vida;
      if (a.que === 'vehiculos') {
        if (c.era < 5) { textos.push('Los cañones llegan con la pólvora (Renacimiento); antes no hay vehículos de guerra que fabricar.'); return; }
        if (!(c.cuarteles > 0)) { textos.push('Hace falta un cuartel para fabricarlos: «construid un cuartel».'); return; }
        const t = c.era >= 8 ? 'tanques (10 de metal y 3 de petróleo cada uno)' : c.era >= 7 ? 'piezas de artillería (5 de metal)' : 'cañones (4 de metal)';
        p.fabricar = { que: 'vehiculos', n: Math.max(1, Math.min(60, a.n || 3)), hechos: 0, desde: m.turno };
        an('⚙ Fabricando ' + p.fabricar.n + ' vehículos de guerra');
        textos.push('El cuartel fabricará ' + p.fabricar.n + ' ' + t + ', uno cada dos turnos, y los guardará en el almacén: vuestros soldados los usarán, o los podéis vender («vended tanques»).');
        return;
      }
      if (a.que === 'granadas') {
        if (c.era < 8) { textos.push('Las granadas de mano llegan con la Segunda Guerra Mundial.'); return; }
        if (!(c.cuarteles > 0) && !(c.fabricas > 0)) { textos.push('Hace falta un cuartel o una fábrica para hacer granadas.'); return; }
        p.fabricar = { que: 'granadas', n: Math.max(1, Math.min(600, a.n || 30)), hechos: 0, desde: m.turno };
        an('⚒ Fabricando ' + p.fabricar.n + ' granadas');
        textos.push((c.cuarteles > 0 && c.fabricas > 0 ? 'El cuartel y las fábricas harán ' : c.fabricas > 0 ? 'Las fábricas harán ' : 'El cuartel hará ') + p.fabricar.n + ' granadas (3 por cada pieza de metal; tenéis ' + Math.floor(c.metal || 0) + '). Los soldados las lanzan a las trincheras y a los grupos enemigos, y también se venden («vended granadas»).');
        return;
      }
      if (a.que === 'armas') {
        if (c.era < 1) { textos.push('En ' + M.ERAS[c.era].con + ' no hay metal que forjar: las armas son palos y piedras. Llegad a la Edad del Bronce.'); return; }
        if (!(c.cuarteles > 0) && !(c.fabricas > 0)) { textos.push('Para fabricar armas hace falta una forja: «construid un cuartel» (o una fábrica, desde la Revolución Industrial).'); return; }
        const nombre = V && V.ARMAS ? V.ARMAS[Math.min(c.era, V.ARMAS.length - 1)].nombre + ' para la tropa, ' + V.TIROS[Math.min(c.era, V.TIROS.length - 1)] + ' para los tiradores' : 'armas';
        p.fabricar = { que: 'armas', n: Math.max(1, Math.min(500, a.n || 20)), hechos: 0, desde: m.turno };
        an('⚒ Fabricando ' + p.fabricar.n + ' armas');
        textos.push('Las forjas' + (c.fabricas > 0 ? ' y las fábricas' : '') + ' fabricarán ' + p.fabricar.n + ' armas de vuestra época (' + nombre + '), a 1 de metal cada una: tenéis ' + Math.floor(c.metal || 0) + ' de metal. ' + (c.fabricas > 0 ? 'Con fábrica salen muchas más por turno.' : 'Con una fábrica (Revolución Industrial) irían mucho más deprisa.') + ' Las que sobren se pueden vender en el mercado.');
      } else {
        if (!(c.fabricas > 0)) { textos.push('Los muebles y las manufacturas se hacen en una fábrica: «construid una fábrica» (desde la Revolución Industrial).'); return; }
        p.fabricar = { que: 'muebles', n: Math.max(1, Math.min(500, a.n || 20)), hechos: 0, desde: m.turno };
        an('🏭 Fabricando ' + p.fabricar.n + ' lotes de muebles');
        textos.push('Las fábricas convertirán vuestra madera en ' + p.fabricar.n + ' lotes de muebles (2 de madera cada uno), que se venden por oro.');
      }
      return;
    }
    if (a.tipo === 'huelga') {
      if (!c.huelga) { textos.push(c.era >= 6 && c.fabricas > 0 ? 'Ahora no hay ninguna huelga: los obreros trabajan.' : 'Aún no tenéis fábricas ni obreros.'); return; }
      if (a.ceder) {
        const coste = Math.round(6 + 6 * (c.fabricas || 1));
        if ((c.oro || 0) < coste) { textos.push('No hay oro para subir los salarios (hacen falta ' + coste + '). Podéis reprimir la huelga, o esperar a que se acabe sola.'); return; }
        c.oro -= coste; delete c.huelga; c.estab = Math.min(100, c.estab + 6); c.huelgasN = Math.max(0, (c.huelgasN || 0) - 1);
        an('🤝 Salarios subidos: fin de la huelga');
        textos.push('Subís los salarios (' + coste + ' de oro). Los obreros vuelven a las fábricas contentos: estabilidad +6.');
      } else {
        delete c.huelga; c.estab = Math.max(0, c.estab - 10); c.huelgasN = (c.huelgasN || 0) + 1;
        an('⚠ Huelga reprimida');
        textos.push('Los soldados disuelven la huelga y las fábricas vuelven a funcionar, pero la gente no lo olvida: estabilidad −10. Si esto se repite, puede acabar en revolución.');
      }
      return;
    }
    if (a.tipo === 'fiesta') {
      if (p.ultimaFiesta != null && m.turno - p.ultimaFiesta < 3) { textos.push('Aún les dura la resaca de la última fiesta.'); return; }
      const coste = Math.round(Math.max(3, adultosDe(m, c).length * 0.3));
      if ((c.comida || 0) < coste) { textos.push('No hay comida para una fiesta (hace falta ' + coste + ').'); return; }
      p.ultimaFiesta = m.turno; c.comida -= coste; c.estab = Math.min(100, c.estab + (a.descanso ? 5 : 9));
      for (const x of adultosDe(m, c)) if (!x.fijo && !x.k && x.o !== 4) { x.e = 3; x.t = a.descanso ? 3 : 2; } // ESPERAR: dejan el trabajo un rato
      an(a.descanso ? '😴 Día de descanso' : '🎉 ¡Fiesta en la plaza!');
      textos.push((a.descanso ? 'Tu gente descansa un par de turnos' : 'Fiesta en la plaza: música, vino y ' + coste + ' de comida') + '. Estabilidad +' + (a.descanso ? 5 : 9) + ' (ahora ' + Math.round(c.estab) + ').');
      return;
    }
    if (a.tipo === 'rezar') {
      const templo = c.templos > 0 || (v && v.obra.some((x, t) => x === M.vida.OBRA.templo && m.dueno[M.vida.region(m, t)] === c.id));
      if (p.ultimoRezo != null && m.turno - p.ultimoRezo < 3) { textos.push('Ya rezaron hace poco.'); return; }
      p.ultimoRezo = m.turno; c.estab = Math.min(100, c.estab + (templo ? 6 : 3));
      an('🙏 Plegarias');
      textos.push('Tu pueblo reza' + (templo ? ' en el templo' : ' al aire libre (con un templo serviría más)') + '. Estabilidad +' + (templo ? 6 : 3) + '. Los dioses, como siempre, no dicen nada.');
      return;
    }
    if (a.tipo === 'curar') {
      const heridos = v.aldeanos.filter(x => x.c === c.id && x.pv != null && x.pv < M.vida.vidaMax(x));
      const coste = Math.ceil(heridos.length * 0.5);
      if (!heridos.length) { textos.push('No hay heridos.'); return; }
      if ((c.comida || 0) < coste) { textos.push('Faltan comida y vendas para curar a ' + heridos.length + ' heridos (hacen falta ' + coste + ' de comida).'); return; }
      c.comida -= coste;
      for (const x of heridos) { x.pv = null; x.pv0 = null; }
      an('✚ ' + heridos.length + ' curados');
      textos.push('Los curanderos atienden a ' + heridos.length + ' heridos, que vuelven como nuevos (' + coste + ' de comida).');
      return;
    }
    if (a.tipo === 'reparar') {
      const ruinas = [];
      for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === M.vida.OBRA.ruina && m.dueno[M.vida.region(m, t)] === c.id) ruinas.push(t);
      if (!ruinas.length) { textos.push('No hay casas en ruinas ni fuego en tu tierra.'); return; }
      const puede = Math.min(ruinas.length, Math.floor((c.madera || 0) / 3));
      if (!puede) { textos.push('Hay ' + ruinas.length + ' ruinas, pero no hay madera para levantarlas (3 cada una).'); p.prioridad.madera = Math.max(p.prioridad.madera, 1.5); return; }
      for (const t of ruinas.slice(0, puede)) M.vida.cambiar(m, 'obra', t, M.vida.OBRA.casa, 0);
      c.madera -= puede * 3; c.casas = (c.casas || 0) + puede;
      an('🔨 ' + puede + ' casas reparadas');
      textos.push('Tus constructores apagan las brasas y levantan ' + puede + ' casa' + (puede === 1 ? '' : 's') + ' de las ruinas (' + puede * 3 + ' de madera).' + (puede < ruinas.length ? ' Quedan ' + (ruinas.length - puede) + ' ruinas: falta madera.' : ''));
      return;
    }
    if (a.tipo === 'trabajar') {
      let n = 0;
      for (const x of adultosDe(m, c)) if (x.paseo || x.e === 3) { x.paseo = 0; x.e = 0; n++; }
      M.vida.reasignar(m, c, null, true);
      an('⚒ ¡A trabajar!');
      textos.push('¡Manos a la obra! ' + (n ? n + ' que estaban parados vuelven al trabajo.' : 'Todos estaban ya trabajando.'));
    }
  }
  const TIPOS_EXTRA = ['exterminio', 'reforestar', 'fabricar', 'huelga', 'reparar', 'escuadron', 'vehiculos', 'atacar', 'rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje', 'impuestos', 'fiesta', 'rezar', 'curar', 'trabajar'];

  // ---------- Del texto a las acciones ----------
  /*
   * ÓRDENES COMPUESTAS: «busquen hierro y saquen madera», «haced 3 casas y talad 10 árboles», «más comida,
   * menos soldados y construid un templo». Se parte la frase por las comas y las «y» que separan verbos, se
   * entiende cada trozo y se juntan las acciones (las prioridades se suman en una sola). Si un trozo suelto no
   * se entiende («quiero piedra y metal» → «metal»), se le pone delante el verbo del primero. Solo se usa el
   * resultado partido si dice más que la frase entera; si no, vale lo de siempre.
   */
  function entender(m, civId, texto) {
    const entera = entenderUna(m, civId, texto);
    const trozos = String(texto || '').split(/\s*(?:[,;]|\by luego\b|\by despues\b|\by después\b|\by tambien\b|\by también\b|\bademas\b|\bademás\b|\by\b|\be\b(?=\s+[a-záéíóú]))\s*/i).map(x => x.trim()).filter(Boolean);
    if (trozos.length < 2) return entera;
    // Palabras sueltas que no son órdenes (nombres de reinos, «a Velmora y Karenia»): mejor no partir.
    const verbo = (trozos[0].match(/^\S+/) || [''])[0];
    const partes = [];
    for (const t of trozos) {
      let r = entenderUna(m, civId, t);
      const vacia = !r || !r.length || r.every(x => x.tipo === 'informe');
      if (vacia && t !== trozos[0]) r = entenderUna(m, civId, verbo + ' ' + t);
      if (!r || !r.length || r.every(x => x.tipo === 'informe')) return entera;
      if (r.some(x => ['milagro', 'normal'].includes(x.tipo))) return entera;
      partes.push(r);
    }
    // Se juntan: las prioridades en una; lo demás, cada acción una vez.
    const out = [], visto = new Set();
    let pr = null;
    for (const r of partes) for (const x of r) {
      if (x.tipo === 'prioridad') {
        if (!pr) { pr = { tipo: 'prioridad', cambios: {} }; out.push(pr); }
        Object.assign(pr.cambios, x.cambios);
        if (x.solo) pr.solo = true; if (x.hasta) pr.hasta = x.hasta;
        continue;
      }
      const k = JSON.stringify(x); if (visto.has(k)) continue; visto.add(k); out.push(x);
    }
    // ¿Dice más que la frase entera? (más acciones, o más prioridades tocadas).
    const peso = l => (l || []).reduce((s, x) => s + (x.tipo === 'prioridad' ? Object.keys(x.cambios).length : 1), 0);
    return peso(out) > peso(entera) ? out : entera;
  }
  function entenderUna(m, civId, texto) {
    const c = S().civ(m, civId), n = norm(texto), acciones = [];
    if (!c || !c.viva || !n) return acciones;
    // Aquí no hay milagros: eres quien manda en un pueblo, no un dios.
    if (/\b(peste|plaga|diluvio|terremoto|llueva|lluvia de|milagro|rayos?|meteorito|que mueran|maldic\w*|bendic\w*|que aparezca)\b/.test(n)) return [{ tipo: 'milagro' }];
    if (/\b(informe|como vamos|como estamos|estado|situacion|que tal|resumen)\b/.test(n)) acciones.push({ tipo: 'informe' });
    if (/\b(como antes|lo de siempre|normal|equilibr\w*|a vuestro aire|libres?)\b/.test(n)) { acciones.push({ tipo: 'normal' }); return acciones; }

    const guerra = /\b(ataca\w*|atacar|invad\w*|conquist\w*|declar\w* la guerra|guerra (a|con|contra)|marcha\w* (sobre|contra)|asedi\w*|a por)\b/.test(n);
    const paz = /\b(paz|tregua|armisticio|acepto|aceptamos)\b/.test(n);
    const alianza = /\b(alianza|alia\w*|pacto de defensa)\b/.test(n) && !/\brompe\w*\b/.test(n);
    const romperAl = /\brompe\w* (la )?alianza\b/.test(n);
    const tratado = !alianza && /\b(comerci\w* con|amistad|tratado|embajad\w*|regal\w* a|rutas? (comercial\w* |de comercio )?(con|hasta|a|hacia)|carretera\w* (con|hasta|a|hacia)|camino\w* (hasta|hacia)|abr\w* (una )?ruta)\b/.test(n);
    // Preguntas: «¿cuántos leñadores tengo?», «¿cuánta madera hay?», «¿qué hace mi gente?».
    if (/\b(cuant[oa]s?|que hace mi gente|que hacen|en que trabaja\w*|reparto|oficios|cuadrillas|cupos)\b/.test(n) && !/\b(oro|dinero|tesoro|arcas|investig\w*|tecnolog\w*)\b/.test(n) && !/\b(quiero|pon\w*|mand\w*|que (se )?(vayan|pongan)|quit\w*|liber\w*|cancel\w*|anul\w*|solt\w*|suelt\w*)\b/.test(n) && !/\d/.test(n.replace(/\bcuant\w*/, ''))) { const of = NOMBRE_OF.find(([o, re]) => o >= 0 && new RegExp('\\b(' + re + ')\\b').test(n)); return [{ tipo: 'consulta', o: of ? of[0] : undefined }]; }
    // La técnica y el tesoro: «investigad la rueda», «¿qué investigamos?», «comprad 20 de madera», «guardad el oro».
    { const ec = economia(m, c, n); if (ec) return acciones.concat(ec); }
    // Escuadrones, posturas de guerra, diplomacia menuda y el ánimo del pueblo.
    { const ex = extras(m, c, n); if (ex) return acciones.concat(ex); }
    // Órdenes con número, oficio y tiempo (cuadrillas, cupos, metas); si traen plazo, también sirve para las prioridades.
    let plazoGeneral = null, conCuadrilla = false;
    {
      const cq = cuadrilla(m, c, n);
      if (cq.length && cq[0].tipo !== 'plazo') { acciones.push(...cq); conCuadrilla = true; }
      else if (cq.length) plazoGeneral = cq[0];
    }
    // Dirigir la guerra: «atacad Velmora», «tomad la capital de Karenia», «defended la capital», «retirada».
    const plazas = [...(m.ciudades || []).map(x => ({ region: x.region, civ: x.civ, nombre: x.nombre })), ...S().vivas(m).map(o => ({ region: o.capital, civ: o.id, nombre: o.nombre, capital: true }))];
    const nombrada = plazas.filter(x => !x.capital && n.includes(norm(x.nombre)))[0];
    const defender = /\b(defend\w*|defensa de|proteg\w*|guarece\w*|resist\w*)\b/.test(n);
    const retirada = /\b(retir\w*|repleg\w*|volved a casa|vuelvan a casa|retroced\w*)\b/.test(n);
    const tomar = /\b(toma\w*|asalt\w*|captur\w*)\b/.test(n);
    if (retirada || (defender && !guerra)) {
      const propia = regionPropia(m, c, n);
      const mia = nombrada && nombrada.civ === c.id ? nombrada.region : propia != null ? propia : c.capital;
      acciones.push({ tipo: 'defender', region: mia });
      return acciones;
    }
    if ((guerra || tomar) && (nombrada && nombrada.civ !== c.id || /\bcapital\b/.test(n))) {
      let r = nombrada && nombrada.civ !== c.id ? nombrada.region : null;
      if (r == null) { const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null) || vecinoMasDebil(m, c); if (o) r = o.capital; }
      if (r != null) { acciones.push({ tipo: 'objetivo', region: r }); return acciones; }
    }
    if (guerra) { const o = (/\b(mas debil|mas pequeno|el vecino|vecinos?)\b/.test(n) && vecinoMasDebil(m, c)) || otro(m, c, n) || vecinoMasDebil(m, c); acciones.push({ tipo: 'guerra', con: o ? o.id : null }); }
    else if (paz) { const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null); acciones.push({ tipo: 'paz', con: o ? o.id : null }); }
    else if (romperAl) { const o = otro(m, c, n); acciones.push({ tipo: 'romper', con: o ? o.id : null }); }
    else if (alianza) { const o = otro(m, c, n); acciones.push({ tipo: 'alianza', con: o ? o.id : null }); }
    else if (tratado) { const o = otro(m, c, n); acciones.push({ tipo: 'comercio', con: o ? o.id : null }); }

    for (const [re, regimen, era] of REGIMENES) if (/\b(proclam\w*|revoluc\w*|instaur\w*|cambi\w* a|seamos|convert\w* en|hazte|haz\w* una?|coron\w*)\b/.test(n) && re.test(n)) { acciones.push({ tipo: 'regimen', a: regimen, era }); break; }

    const expandir = /\b(explor\w*|expand\w*|extiend\w*|coloniz\w*|ocupa\w*|nuevas tierras|ve hacia|id hacia|avanz\w* (hacia|al)|crec\w* hacia|hacia el)\b/.test(n);
    const quieto = /\b(no (os|te|nos) expand\w*|deja\w* de expandi\w*|quiet\w*|no crezc\w*|parad de crecer)\b/.test(n);
    if (quieto) acciones.push({ tipo: 'expandir', si: false });
    else if (expandir && !guerra) {
      const rumbo = /\bnorte\b/.test(n) ? 'norte' : /\bsur\b/.test(n) ? 'sur' : /\b(este|oriente)\b/.test(n) ? 'este' : /\b(oeste|poniente|occidente)\b/.test(n) ? 'oeste' : null;
      const o = rumbo ? null : otro(m, c, n);
      acciones.push({ tipo: 'expandir', si: true, rumbo: rumbo || (o ? o.id : null) });
    }

    // Prioridades: "más madera", "talad", "menos soldados", "todo a la ciencia", "nada de piedra".
    const cambios = {};
    const solo = /\b(solo|todo a|todos a|todo el mundo a|que todos)\b/.test(n);
    for (const [k, re] of Object.entries(RECURSOS)) {
      if (conCuadrilla && (k !== 'ciencia' || acciones.some(x => x.o === 6 || x.a === 6))) continue;
      if (k === 'ejercito' && (guerra || paz) && !/\breclut/.test(n)) continue;
      if (k === 'riqueza' && tratado) continue;
      const mt = n.match(re);
      if (!mt) continue;
      const antes = n.slice(Math.max(0, mt.index - 16), mt.index);
      if (/\b(nada de|ningun\w*|cero|deja\w* de|dejen de|basta de|parad de|paren de|no mas)\b/.test(antes) || (/\bno\s*$/.test(antes) && /\bmas\b/.test(n.slice(mt.index)))) cambios[k] = { a: 0 };
      else if (/\b(menos|no|deja\w* de|sin|poca|poco)\b/.test(antes)) cambios[k] = { mas: -0.5 };
      else if (solo || /\b(maxim\w*|al maximo|toda la|todo lo que|prioridad absoluta|mucha|mucho)\b/.test(n)) cambios[k] = { a: 2 };
      else if (/\b(invert\w*|invier\w*|centra\w*|prioriz\w*|enfoca\w*|volca\w*|vuelca\w*|apuesta\w*)\b/.test(n)) cambios[k] = { a: 2 };
      else cambios[k] = { mas: 0.5 };
    }
    if (expandir && !guerra) cambios.expansion = { a: 1.5 };
    if (quieto) cambios.expansion = { a: 0 };
    // «carretera hasta X» es comercio, no obras en el pueblo.
    if (tratado && cambios.casas && !/\b(casas?|viviendas?|edific\w*)\b/.test(n)) delete cambios.casas;
    if (Object.keys(cambios).length) acciones.push({ tipo: 'prioridad', cambios, solo: solo || undefined, hasta: plazoGeneral ? plazoGeneral.hasta : undefined });
    const porMar = /\b(cruz\w* el mar|ultramar|colonia|barcos?|flota|navega\w*)\b/.test(n) && !/\bpuerto\b/.test(n);
    if (porMar) acciones.push({ tipo: 'colonia' });
    // Edificios concretos: "construid un templo", "levantad murallas", "haced un puerto".
    const levantar = /\b(constru\w*|levant\w*|haz|haced|hagan|hagamos|haga|pon\w*|edific\w*|quiero|queremos|necesit\w*|abr\w*|hace falta|falta)\b/.test(n);
    const publica = !levantar ? null : /\b(pozos? de petroleo|petroleo|crudo|torres? de perforacion|refineria\w*)\b/.test(n) ? 'petroleo' : /\b(minas?|galerias?|pozos? miner\w*|socavon\w*)\b/.test(n) && !/\b(mineros?)\b/.test(n) ? 'mina' : /\b(plaza publica|plaza mayor|plazas publicas|fuentes?|plaza con fuente)\b/.test(n) ? 'fuente' : /\b(pozos?|aljibes?|deposito de agua|agua potable)\b/.test(n) ? 'pozo' : /\b(graneros?|silos?|almacen\w*|despensa)\b/.test(n) ? 'granero' : /\b(parques?|jardin\w*|zonas? verdes?)\b/.test(n) ? 'parque' : /\b(palacios?|corte|sede del gobierno|casa del rey)\b/.test(n) ? 'palacio' : /\b(central\w*( electrica| de energia| termica)?|planta de energia|planta electrica|electricidad|luz electrica)\b/.test(n) ? 'central' : /\b(bancos?|banca)\b/.test(n) ? 'banco' : /\b(fabricas?|industria\w*|talleres)\b/.test(n) ? 'fabrica' : /\b(estacion\w*( de tren)?|ferrocarril\w*|trenes|tren|vias del tren)\b/.test(n) ? 'estacion' : /\b(hospital\w*|clinica\w*|sanatorio)\b/.test(n) ? 'hospital' : /\b(aerodromo\w*|aeropuerto\w*|base aerea|pista de aterrizaje)\b/.test(n) ? 'aerodromo' : null;
    const obra = publica || (/\b(casa del saber|academias?|monasterios?|abadias?|universidad\w*|laboratorios?|observatorios?|escuelas?|bibliotecas?|cabana del chaman|choza del chaman)\b/.test(n) ? 'saber' : /\b(cuartel\w*|barracon\w*|soldados nuevos)\b/.test(n) ? 'cuartel' : /\b(arqueria\w*|campo de tiro|arqueros nuevos)\b/.test(n) ? 'arqueria' : /\b(castillos?|fortalezas?|fortin\w*|bunker\w*)\b/.test(n) ? 'castillo' : /\b(templos?|iglesias?|santuarios?|altar)\b/.test(n) ? 'templo' : /\b(torres?|murallas?|muros?|defensas|fortific\w*|fuertes?)\b/.test(n) ? 'torre' : /\b(puertos?|muelles?)\b/.test(n) ? 'puerto' : /\bmolinos?\b/.test(n) ? 'molino' : null);
    if (obra && !guerra) {
      acciones.push({ tipo: 'construir', obra });
      const pr = acciones.find(x => x.tipo === 'prioridad');
      if (pr) { delete pr.cambios.casas; if (obra === 'torre') delete pr.cambios.ejercito; if (!Object.keys(pr.cambios).length) acciones.splice(acciones.indexOf(pr), 1); }
    }
    // Colonos por tierra: "mandad colonos al sur", "fundad una aldea nueva".
    if (!porMar && !guerra && /\b(colonos?|fund\w*|nuevas? (ciudad|aldea|pueblo)\w*|otra (ciudad|aldea)|asentamiento\w*)\b/.test(n)) {
      const rumbo = /\bnorte\b/.test(n) ? 'norte' : /\bsur\b/.test(n) ? 'sur' : /\b(este|oriente)\b/.test(n) ? 'este' : /\b(oeste|poniente|occidente)\b/.test(n) ? 'oeste' : /\b(costa|mar|playa)\b/.test(n) ? 'costa' : null;
      acciones.push({ tipo: 'colonos', rumbo });
      const ex = acciones.find(x => x.tipo === 'expandir'); if (ex) acciones.splice(acciones.indexOf(ex), 1);
    }
    // Más gente: hacen falta comida y camas.
    if (/\b(hijos|ninos|bebes|familias|natalidad|mas gente|que crezca|crezca la poblacion|mas poblacion)\b/.test(n)) {
      let pr = acciones.find(x => x.tipo === 'prioridad');
      if (!pr) acciones.push(pr = { tipo: 'prioridad', cambios: {} });
      pr.cambios.comida = pr.cambios.comida || { mas: 0.5 }; pr.cambios.casas = pr.cambios.casas || { mas: 0.5 };
    }
    return acciones;
  }

  // ---------- Aplicar las acciones (igual para un jugador local que para uno remoto) ----------
  function aplicar(m, civId, acciones) {
    const c = S().civ(m, civId), textos = [];
    if (!c || !c.viva) return ['Tu pueblo ya no existe.'];
    const p = plan(c);
    for (const a of acciones || []) {
      const o = a.con != null ? S().civ(m, Number(a.con)) : null;
      if (a.tipo === 'milagro') textos.push('Eso solo puede hacerlo un dios, y aquí gobiernas un pueblo de carne y hueso. Puedes mandar a tu gente a talar, sembrar, construir, picar piedra o luchar; expandiros, declarar guerras, firmar paces y tratados, invertir en ciencia o cambiar de gobierno.');
      else if (a.tipo === 'informe') textos.push(informe(m, c));
      else if (['edad', 'consulta_edad', 'edad_auto', 'ahorrar_edad', 'investigar', 'consulta_tec', 'comprar', 'vender', 'tesoro', 'consulta_oro', 'consulta_mercado', 'especialidad', 'oferta'].includes(a.tipo)) aplicarEconomia(m, c, a, textos);
      else if (TIPOS_EXTRA.includes(a.tipo)) aplicarExtra(m, c, a, textos);
      else if (a.tipo === 'consulta') textos.push(consulta(m, c, a.o));
      else if (a.tipo === 'cuadrilla') aplicarCuadrilla(m, c, a, textos);
      else if (a.tipo === 'cupo') aplicarCupo(m, c, a, textos);
      else if (a.tipo === 'meta') aplicarMeta(m, c, a, textos);
      else if (a.tipo === 'liberar') {
        const nC = (p.cuadrillas || []).length, nQ = Object.keys(p.cupos || {}).length;
        for (const x of adultosDe(m, c)) if (x.fijo) { const vuelve = x.fijo.vuelve; delete x.fijo; M.vida.mover(x, vuelve); }
        p.cuadrillas = []; p.cupos = {};
        M.vida.reasignar(m, c, null, true);
        (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: 'Cada uno a su oficio' });
        textos.push(nC || nQ ? 'Hecho: ' + (nC ? nC + ' cuadrilla' + (nC > 1 ? 's' : '') + ' vuelve' + (nC > 1 ? 'n' : '') + ' a su oficio' : '') + (nC && nQ ? ' y ' : '') + (nQ ? 'se quitan ' + nQ + ' cupo' + (nQ > 1 ? 's' : '') : '') + '. El pueblo reparte el trabajo solo.' : 'No había cuadrillas ni cupos: el pueblo ya reparte el trabajo solo.');
      }
      else if (a.tipo === 'normal') { p.prioridad = PRIO_NORMAL(); p.rumbo = null; p.expandir = true; p.objetivo = null; p.defender = null; p.cupos = {}; p.cuadrillas = []; p.temporales = []; if (m.vida) for (const x of m.vida.aldeanos) if (x.c === c.id && x.fijo) { const vuelve = x.fijo.vuelve; delete x.fijo; M.vida.mover(x, vuelve); } if (M.vida && m.vida) M.vida.reasignar(m, c, null, true); (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: 'Todo vuelve a la normalidad' }); textos.push('Todas las prioridades vuelven a normal: tu pueblo se gobierna solo, como los demás.'); }
      else if (a.tipo === 'prioridad') {
        const pr = p.prioridad, tocados = Object.keys(a.cambios), antesReparto = repartoDe(m, c), previas = Object.assign({}, pr);
        if (a.solo) for (const k of new Set([...Object.keys(pr), 'madera', 'comida', 'piedra', 'casas', 'ejercito', 'riqueza', 'ciencia'])) if (!tocados.includes(k) && k !== 'expansion') pr[k] = Math.min(pr[k] != null ? pr[k] : 1, 0.3);
        for (const k of tocados) { const ch = a.cambios[k]; pr[k] = Math.max(0, Math.min(2, ch.a != null ? ch.a : (pr[k] != null ? pr[k] : 1) + ch.mas)); }
        // Con plazo («durante 2 minutos»), al vencer vuelve cada prioridad a como estaba.
        const hp = plazoAbsoluto(m, c, a.hasta);
        if (hp) for (const k of tocados) { p.temporales = (p.temporales || []).filter(t => t.k !== k); p.temporales.push({ k, antes: previas[k] != null ? previas[k] : 1, puesto: pr[k], hasta: hp }); }
        const cuenta = () => { const n = [0, 0, 0, 0, 0, 0, 0]; if (m.vida) for (const x of m.vida.aldeanos) if (x.c === c.id && (x.edad || 0) >= M.vida.ADULTO && x.colono == null) n[x.o]++; return n; };
        const antesOficios = cuenta();
        // La gente cambia de oficio en el acto (sin esperar al turno siguiente).
        if (M.vida && m.vida) M.vida.reasignar(m, c, null, true);
        const ahora = cuenta(), cambios = tocados.filter(k => OFICIO_DE[k] && ahora[OFICIO_DE[k][0]] !== antesOficios[OFICIO_DE[k][0]]).map(k => (ahora[OFICIO_DE[k][0]] > antesOficios[OFICIO_DE[k][0]] ? '▲ ' : '▼ ') + (OFICIO_DE[k][0] === 6 ? M.ERUDITO(c.era).varios : OFICIO_DE[k][1]) + ' ' + antesOficios[OFICIO_DE[k][0]] + ' → ' + ahora[OFICIO_DE[k][0]]);
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: cambios.length ? cambios.join('  ') : 'Prioridades: ' + tocados.map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k])).join(', ') });
        textos.push('Prioridades: ' + tocados.map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k])).join(', ') + (a.solo ? ' (lo demás, baja)' : '') + (hp ? textoPlazo(m, hp) + '; luego vuelven a como estaban' : '') + '.' + (cambios.length ? ' Ya cambian de oficio: ' + cambios.map(x => x.slice(2)).join(', ') + '.' : oficiosNuevos(m, c, antesReparto, tocados)));
      }
      else if (a.tipo === 'expandir') {
        p.expandir = a.si; p.rumbo = a.si ? (a.rumbo == null ? null : a.rumbo) : null;
        p.prioridad.expansion = a.si ? Math.max(1, p.prioridad.expansion) : 0;
        const destino = typeof p.rumbo === 'number' ? (S().civ(m, p.rumbo) || {}).nombre : p.rumbo;
        textos.push(a.si ? 'Los colonos salen ' + (destino ? 'hacia ' + (typeof p.rumbo === 'number' ? destino : 'el ' + destino) : 'hacia las mejores tierras libres') + '. Cada tierra nueva cuesta 3 de madera (tienes ' + Math.floor(c.madera || 0) + ').' : 'Tu pueblo deja de expandirse y se queda en sus fronteras.');
      } else if (a.tipo === 'guerra') {
        if (!o || !o.viva || o.id === c.id) { textos.push('¿Contra quién? Nombra al pueblo («atacad a ' + ((S().vivas(m).find(x => x.id !== c.id) || {}).nombre || 'Karenia') + '»).'); continue; }
        if (S().enGuerra(c, o)) {
          const estaban = p.defender != null; p.defender = null;
          if (estaban) { const e = m.vida && m.vida.ejercitos && m.vida.ejercitos[c.id]; if (e) e.defiende = null; (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '⚔ ¡Al ataque!' }); }
          textos.push('Ya estáis en guerra con ' + o.nombre + '.' + (estaban ? ' Tus guerreros dejan de defender y vuelven al ataque.' : ' Para elegir a qué ciudad van, di «atacad» y su nombre.'));
          continue;
        }
        S().declararGuerra(m, c, o, 'Por orden de su gobierno, ' + c.nombre + ' declara la guerra a ' + o.nombre + '. Los heraldos recorren las aldeas llamando a los hombres a las armas.');
        p.guerrasMias = [...new Set([...p.guerrasMias, o.id])]; p.defender = null;
        if (M.vida && m.vida) M.vida.reasignar(m, c, null, true);
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: '⚔ ¡Guerra contra ' + o.nombre + '!' });
        const frontera = S().vecinosDe(m, c).includes(o);
        textos.push('¡Guerra contra ' + o.nombre + '! Tus guerreros marchan a la frontera.' + (frontera ? '' : ' Ojo: no tenéis frontera común, así que no podrán llegar hasta que la haya.'));
      } else if (a.tipo === 'objetivo') {
        const r = Number(a.region), d = S().civ(m, m.dueno[r]);
        if (!d || !d.viva || d.id === c.id) { textos.push('Esa plaza ya es vuestra o no pertenece a nadie.'); continue; }
        const nombre = nombrePlaza(m, r);
        if (!S().enGuerra(c, d)) {
          S().declararGuerra(m, c, d, 'Por orden de su gobierno, ' + c.nombre + ' declara la guerra a ' + d.nombre + ' y marcha sobre ' + nombre + '.');
          p.guerrasMias = [...new Set([...p.guerrasMias, d.id])];
          if (M.vida && m.vida) M.vida.reasignar(m, c, null, true);
        }
        p.objetivo = r; p.defender = null;
        if (m.vida && m.vida.ejercitos) delete m.vida.ejercitos[c.id];
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: '⚔ ¡A por ' + nombre + '!', region: r });
        const frontera = S().vecinosDe(m, c).includes(d);
        textos.push('Tu ejército se reúne en la frontera y marcha sobre ' + nombre + ' (' + d.nombre + '). Si llega el capitán y no quedan defensores ni torres, empezará el asedio.' + (frontera ? '' : ' Ojo: no tenéis frontera común con ' + d.nombre + '.'));
      } else if (a.tipo === 'defender') {
        const r = Number(a.region);
        p.defender = r; p.objetivo = null;
        const e = m.vida && m.vida.ejercitos && m.vida.ejercitos[c.id];
        if (e) { e.defiende = r; e.fase = 'marcha'; e.asedio = 0; }
        const nombre = nombreSitio(m, c, r);
        if (a.postura) { const T2 = { esperar: '🛡 Esperan el ataque en ' + nombre, emboscada: '🌿 Emboscada en ' + nombre, alto: '✋ ¡Alto! Todos a ' + nombre }; (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: T2[a.postura], region: r }); textos.push({ esperar: 'Tus guerreros se atrincheran en ' + nombre + ' y esperan al enemigo; no atacarán hasta que digas «al ataque».', emboscada: 'Tus guerreros se esconden en ' + nombre + ' y esperan a que el enemigo pase por ahí. Di «al ataque» para salir.', alto: 'Alto: tus guerreros dejan de avanzar y vuelven a ' + nombre + '. La guerra sigue; para acabarla, «haced la paz».' }[a.postura]); continue; }
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: '🛡 ¡Defended ' + nombre + '!', region: r });
        textos.push(c.guerras.length ? 'Tus guerreros vuelven a ' + nombre + ' y la defienden hasta nueva orden. Cuando quieras atacar, di «atacad» y el nombre de una ciudad.' : 'No estáis en guerra, pero si llega una, tus guerreros se quedarán defendiendo ' + nombre + '.');
      } else if (a.tipo === 'paz') {
        if (!o || !S().enGuerra(c, o)) { textos.push(o ? 'No estáis en guerra con ' + o.nombre + '.' : 'No estás en guerra con nadie.'); continue; }
        const g = o.guerras.find(x => x.con === c.id), oferta = m.ofertas && m.ofertas[o.id] != null && m.turno - m.ofertas[o.id] <= 15;
        const ratio = S().fuerza(m, c) / Math.max(0.1, S().fuerza(m, o));
        // La IA acepta si te la ofreció, si está agotada o si le va mal; si va ganando, la rechaza.
        const acepta = oferta || (g && g.cansancio > 3) || ratio > 1.3 || S().azar(m) < 0.25;
        if (acepta) { S().hacerPaz(m, c, o, c.nombre + ' y ' + o.nombre + ' firman la paz. Los soldados vuelven a casa a tiempo para la cosecha.'); if (m.ofertas) delete m.ofertas[o.id]; textos.push(o.nombre + ' acepta la paz.'); }
        else { textos.push(o.nombre + ' rechaza la paz: cree que va ganando. Vuelve a intentarlo cuando esté más cansado de la guerra.'); o.rel[c.id] = (o.rel[c.id] || 0) - 5; }
      } else if (a.tipo === 'comercio') {
        if (!o || !o.viva || o.id === c.id) { textos.push('¿Con quién? Nombra al pueblo.'); continue; }
        if (S().enGuerra(c, o)) { textos.push('Primero haced la paz con ' + o.nombre + '.'); continue; }
        if ((o.rel[c.id] || 0) < -40) { textos.push(o.nombre + ' expulsa a tus embajadores: os odian demasiado. Mejorad las cosas poco a poco.'); o.rel[c.id] = (o.rel[c.id] || 0) + 5; c.rel[o.id] = o.rel[c.id]; continue; }
        p.socios = [...new Set([...(p.socios || []), o.id])];
        c.rel[o.id] = o.rel[c.id] = Math.min(100, (o.rel[c.id] || 0) + 25);
        S().cronica(m, 'comercio', 'Tratado entre ' + c.nombre + ' y ' + o.nombre, 'Los embajadores de ' + c.nombre + ' vuelven con un tratado: caravanas, regalos y la promesa de no atacarse. Mientras dure.', c);
        // La carretera se traza ya, y los constructores la empiedran; los comerciantes salen en cuanto haya ruta.
        const ru = M.vida && m.vida && M.vida.abrirRuta ? M.vida.abrirRuta(m, c, o) : null;
        if (ru && ru.ok) {
          (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '🛣 Ruta comercial con ' + o.nombre });
          textos.push('Tratado con ' + o.nombre + '. ' + (ru.ya ? 'Ya teníais ruta (' + ru.empedrado + ' de ' + ru.n + ' tramos empedrados): ahora va con prioridad.' : 'Se abre una carretera de ' + ru.n + ' tramos hasta su capital: vuestros constructores empiezan a empedrarla y los comerciantes ya salen con las carretas.'));
        } else if (ru && ru.mar) textos.push('Tratado con ' + o.nombre + ', pero no hay camino por tierra hasta ellos. ' + (ru.puertos ? 'El comercio irá en barco, de puerto a puerto.' : 'Haced un puerto (y ellos también) para comerciar por mar.'));
        else textos.push('Tratado con ' + o.nombre + ': comerciaréis y os llevaréis mejor cada año.');
      } else if (a.tipo === 'alianza') {
        if (!o || !o.viva || o.id === c.id) { textos.push('¿Con quién? Nombra al pueblo.'); continue; }
        if (S().aliados(m, c, o)) { textos.push('Ya sois aliados de ' + o.nombre + '.'); continue; }
        if (S().enGuerra(c, o)) { textos.push('Primero haced la paz con ' + o.nombre + '.'); continue; }
        // Aceptan si os llevan bien (un tratado de comercio ayuda) y no tienen ya demasiados aliados.
        if ((o.rel[c.id] || 0) < 30 || S().aliadosDe(m, o).length >= 2) { textos.push(o.nombre + ' no se fía todavía (opinión ' + Math.round(o.rel[c.id] || 0) + '). Firmad antes un tratado de comercio y dejad pasar el tiempo.'); continue; }
        S().aliar(m, c, o, c.nombre + ' y ' + o.nombre + ' firman una alianza: si alguien ataca a uno, el otro irá a la guerra.');
        textos.push('Alianza con ' + o.nombre + '. Si os atacan, vendrán en vuestra ayuda; y tu gobierno irá a defenderlos a ellos.');
      } else if (a.tipo === 'romper') {
        if (!o || !S().aliados(m, c, o)) { textos.push('No tenéis alianza con ' + (o ? o.nombre : 'ese pueblo') + '.'); continue; }
        S().romper(m, c, o, c.nombre + ' rompe su alianza con ' + o.nombre + '.');
        textos.push('Alianza rota con ' + o.nombre + '. No les va a gustar.');
        o.rel[c.id] = c.rel[o.id] = (o.rel[c.id] || 0) - 30;
      } else if (a.tipo === 'regimen') {
        if (c.era < a.era) { textos.push('Tu pueblo no está preparado para eso: hace falta llegar ' + aEra(M.ERAS[a.era].con) + '.'); continue; }
        if (c.regimen === a.a) { textos.push('Ya sois ' + M.unoDe(a.a) + '.'); continue; }
        const antes = c.regimen;
        c.regimen = a.a; c.estab = Math.max(0, c.estab - 15);
        if (a.a === 'republica' || a.a === 'democracia') c.ciencia += 20;
        S().cronica(m, 'revolucion', c.nombre + ' cambia de gobierno', T(M.conArticulo(antes)) + ' de ' + c.nombre + ' da paso a ' + M.unoDe(a.a) + '. Unos celebran en las plazas; otros esconden la plata.', c, null, { importante: true });
        textos.push('Proclamada ' + M.unoDe(a.a) + '. La estabilidad cae un poco mientras la gente se acostumbra.');
      } else if (a.tipo === 'construir') {
        const NOMBRE = { mina: 'una mina', petroleo: 'un pozo de petróleo', pozo: 'un pozo', granero: 'un granero', fuente: 'una plaza pública con fuente', parque: 'un parque', palacio: 'un palacio', central: 'una central eléctrica', banco: 'un banco', fabrica: 'una fábrica', estacion: 'una estación de tren', hospital: 'un hospital', aerodromo: 'un aeródromo', saber: (/^(monasterio|laboratorio)$/.test(M.CASA_SABER(c.era)) ? 'un ' : 'una ') + M.CASA_SABER(c.era), templo: 'un templo', torre: 'una torre de defensa', puerto: 'un puerto', molino: 'un molino', cuartel: 'un cuartel de soldados', arqueria: c.era >= 5 ? 'un campo de tiro' : 'una arquería', castillo: c.era >= 7 ? 'un fortín' : c.era >= 5 ? 'una fortaleza' : 'un castillo' };
        const COSTE = M.vida ? M.vida.COSTES[M.vida.OBRA[a.obra]] : [0, 0, 0];
        const NIVEL_PIDE = M.vida ? M.vida.NIVEL_OBRA[M.vida.OBRA[a.obra]] || 0 : 0;
        const eraPide = M.vida ? M.vida.ERA_OBRA[M.vida.OBRA[a.obra]] || 0 : 0;
        if (c.era < eraPide) { textos.push(a.obra === 'central' ? '¿Una central eléctrica en ' + M.ERAS[c.era].con + '? Aún no se conoce la electricidad: llega con ' + M.vida.NOMBRE_ERA[eraPide] + '.' : 'Nadie ha visto aún ' + NOMBRE[a.obra] + ': llega con ' + M.vida.NOMBRE_ERA[eraPide] + '.'); continue; }
        if ((c.nivel || 0) < NIVEL_PIDE) { textos.push('Para levantar ' + NOMBRE[a.obra] + ' tu asentamiento tiene que ser al menos ' + (NIVEL_PIDE === 1 ? 'una aldea' : NIVEL_PIDE === 2 ? 'un pueblo' : NIVEL_PIDE === 3 ? 'una villa' : 'una ciudad') + ' (' + M.NIVELES[NIVEL_PIDE].desde + ' vecinos; ahora ' + (c.aldeanos || 0) + '). Más casas y comida: más gente.'); continue; }
        // La mina va en la montaña más cercana de su tierra (solo en la montaña: lo valioso escasea).
        if (a.obra === 'mina' && M.vida && m.vida) {
          if (c.era < 1) { textos.push('Las minas de galería llegan con la Edad del Bronce: antes se recoge la piedra suelta.'); continue; }
          const t = M.vida.sitioMina(m, c, M.vida.terrenos(m));
          if (t == null) { textos.push('No tenéis montañas libres donde abrir una mina. Ganad tierra con sierra, o comprad la piedra y el metal en el mercado.'); continue; }
          const r = M.vida.encargar(m, c, t, 'mina');
          textos.push(r.ok ? 'Encargada una mina en la montaña más cercana. Dará piedra, metal, carbón y algo de oro poco a poco, sin agotarse nunca.' : 'No se puede: ' + r.razon + '.');
          continue;
        }
        // El pozo de petróleo va donde hay crudo (las manchas negras de su tierra), no junto a la plaza.
        if (a.obra === 'petroleo' && M.vida && m.vida) {
          if (!m.vida.crudo) { textos.push('Aún nadie sabe dónde hay petróleo: las bolsas de crudo se descubren en la Era Moderna.'); continue; }
          const t = M.vida.sitioPetroleo(m, c, M.vida.terrenos(m));
          if (t == null) { textos.push('No hay petróleo libre en vuestra tierra: buscad manchas negras en el mapa, compradlo en el mercado o ganad tierras que lo tengan.'); continue; }
          const r = M.vida.encargar(m, c, t, 'petroleo');
          textos.push(r.ok ? 'Encargado un pozo de petróleo sobre la mancha de crudo más cercana a la capital. Dará petróleo cada turno.' : 'No se puede: ' + r.razon + '.');
          continue;
        }
        if (M.vida && m.vida) {
          const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)].flatMap(r => M.vida.parcelas(m, r));
          if (zona.some(t => m.vida.obra[t] === M.vida.OBRA[a.obra])) { textos.push('Ya tenéis ' + NOMBRE[a.obra] + ' en ' + c.nombre + '.'); continue; }
        }
        p.obra = a.obra;
        // El porqué: si de verdad hace falta, el pueblo lo agradece; si no, se dice para qué sirve.
        const nec = M.vida && M.vida.NECESIDADES[a.obra], falt = nec && (c.necesidades || []).find(x => x.obra === a.obra && x.falta);
        if (nec) textos.push(falt ? 'Hace falta: ' + nec.mal + '.' : 'Sirve para que ' + nec.bien + '.');
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: '⚒ ' + NOMBRE[a.obra].replace(/^una? /, '') + ' en marcha' });
        const falta = [];
        if ((c.madera || 0) < COSTE[0]) falta.push((COSTE[0] - Math.floor(c.madera || 0)) + ' de madera');
        if ((c.piedra || 0) < COSTE[1]) falta.push((COSTE[1] - Math.floor(c.piedra || 0)) + ' de piedra');
        if ((c.oro || 0) < COSTE[2]) falta.push((COSTE[2] - Math.floor(c.oro || 0)) + ' de oro');
        if (falta.length) { if ((c.madera || 0) < COSTE[0]) p.prioridad.madera = Math.max(p.prioridad.madera, 1.5); if ((c.piedra || 0) < COSTE[1]) p.prioridad.piedra = Math.max(p.prioridad.piedra, 1.5); }
        textos.push('Tus constructores levantarán ' + NOMBRE[a.obra] + ' en la plaza ' + (falta.length ? 'en cuanto junten lo que falta (' + falta.join(' y ') + '); mientras, más gente a por ello.' : 'ya: tenéis la madera y la piedra.') + (a.obra === 'puerto' ? ' Necesita costa junto a la plaza.' : ''));
      } else if (a.tipo === 'colonos') {
        const suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
        if (suyas >= S().maxCiudades(c)) { textos.push('Tu reino ya tiene todas las ciudades que puede gobernar (' + suyas + '). Avanzad de era para poder fundar más.'); continue; }
        p.colonos = a.rumbo || true;
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: 'Colonos en camino' + (a.rumbo ? ' hacia el ' + a.rumbo : '') });
        textos.push('Tres familias recogen sus cosas y salen ' + (a.rumbo === 'costa' ? 'hacia la costa' : a.rumbo ? 'hacia el ' + a.rumbo : 'hacia la mejor tierra libre cercana') + ' a fundar una aldea. Las verás caminar por el mapa.');
      } else if (a.tipo === 'colonia') {
        if (c.era < 5) { textos.push('Aún no sabéis cruzar el mar: hace falta llegar al Renacimiento (la carabela).'); continue; }
        if ((c.madera || 0) < 15) { textos.push('Una flota cuesta 15 de madera y tienes ' + Math.floor(c.madera || 0) + '. Poned más leñadores.'); continue; }
        const cs = S().casillas(m, c);
        const libres = [];
        for (let i = 0; i < m.W * m.H; i++) if (S().esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve' && S().vecinos(i).some(v => m.tipo[v] === 'costa')) libres.push(i);
        libres.sort((x, y) => Math.min(...cs.map(j => S().distancia(x, j))) - Math.min(...cs.map(j => S().distancia(y, j))) - (S().fertil(m, x) - S().fertil(m, y)) * 2);
        const destino = libres[0];
        if (destino == null) { textos.push('No queda costa libre en el mundo que colonizar.'); continue; }
        c.madera -= 15;
        m.dueno[destino] = c.id;
        for (const v of S().vecinos(destino)) if (S().esTierra(m, v) && m.dueno[v] < 0) m.dueno[v] = c.id;
        S().cronica(m, 'expansion', c.nombre + ' funda una colonia', 'Por orden de su gobierno, una flota de ' + c.nombre + ' cruza el mar y planta su bandera en una costa lejana.', c, destino);
        textos.push('Tu flota funda una colonia al otro lado del mar.');
      }
    }
    if (M.vida && m.vida) M.vida.contar(m);
    return textos;
  }
  const T = s => s.charAt(0).toUpperCase() + s.slice(1);
  const aEra = con => (con.startsWith('el ') ? 'al ' + con.slice(3) : 'a ' + con); // «al Renacimiento», «a la Edad Media»
  // Cuánta gente hay en cada oficio según el gobernador automático, para decir qué cambia con una orden.
  const OFICIO_DE = { ciencia: [6, 'eruditos'], madera: [0, 'leñadores'], comida: [1, 'granjeros'], casas: [2, 'constructores'], piedra: [3, 'mineros'], metal: [3, 'mineros'], carbon: [3, 'mineros'], ejercito: [4, 'guerreros'], riqueza: [5, 'comerciantes'] };
  function repartoDe(m, c) {
    if (!M.vida || !m.vida) return null;
    const adultos = m.vida.aldeanos.filter(x => x.c === c.id && (x.edad || 0) >= M.vida.ADULTO && x.colono == null).length;
    return M.vida.reparto(c, { arboles: 1, rocas: 1 }).map(x => Math.round(x * adultos));
  }
  function oficiosNuevos(m, c, antes, tocados) {
    const ahora = repartoDe(m, c);
    if (!antes || !ahora) return ' Tu gente se reorganiza sola según eso.';
    const partes = tocados.filter(k => OFICIO_DE[k] && antes[OFICIO_DE[k][0]] !== ahora[OFICIO_DE[k][0]]).map(k => (OFICIO_DE[k][0] === 6 ? M.ERUDITO(c.era).varios : OFICIO_DE[k][1]) + ' ' + antes[OFICIO_DE[k][0]] + ' → ' + ahora[OFICIO_DE[k][0]]);
    return partes.length ? ' Irán cambiando de oficio: ' + partes.join(', ') + '.' : ' Tu gente se reorganiza sola según eso.';
  }

  function informe(m, c) {
    const lista = S().vivas(m).slice().sort((a, b) => S().casillas(m, b).length - S().casillas(m, a).length);
    const puesto = lista.indexOf(c) + 1, p = c.plan || {};
    const enemigos = c.guerras.map(g => S().civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    const pr = (c.plan && c.plan.prioridad) || {};
    const cambiadas = Object.keys(pr).filter(k => pr[k] !== 1).map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k]));
    return c.nombre + ', ' + M.ERAS[c.era].nombre + ': puesto ' + puesto + ' de ' + lista.length + ' en tierras (' + S().casillas(m, c).length + '), ' + (c.habitantes != null ? c.habitantes + ' aldeanos' : Math.round(c.pob) + ' mil habitantes') + ', estabilidad ' + Math.round(c.estab) + ', madera ' + Math.floor(c.madera || 0) + ', piedra ' + Math.floor(c.piedra || 0) + '. ' +
      (enemigos.length ? 'En guerra con ' + enemigos.join(', ') + '. ' : 'En paz. ') + (cambiadas.length ? 'Prioridades: ' + cambiadas.join(', ') + '.' : 'Todas las prioridades en normal.');
  }

  // ---------- El consejero: lo más urgente de tu pueblo ahora mismo, y la orden que lo arregla ----------
  function consejo(m, civId) {
    const c = S().civ(m, civId);
    if (!c || !c.viva) return null;
    const pr = (c.plan && c.plan.prioridad) || {}, hab = c.habitantes || 1;
    const oferta = m.ofertas && Object.keys(m.ofertas).map(Number).find(id => m.turno - m.ofertas[id] <= 12 && S().civ(m, id) && S().enGuerra(c, S().civ(m, id)));
    if (oferta != null) { const o = S().civ(m, oferta); return { texto: o.nombre + ' te ofrece la paz.', orden: 'Paz con ' + o.nombre }; }
    if (c.oferta && m.turno <= c.oferta.hasta) { const o = S().civ(m, c.oferta.de), pm = m.mercado ? m.mercado.precio[c.oferta.que] : 0; return { texto: (o ? o.nombre : 'Un mercader') + (c.oferta.tipo === 'venta' ? ' os ofrece ' + c.oferta.n + ' de ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro (en el mercado costaría ' + Math.round(pm * c.oferta.n) + ')' : ' quiere comprar ' + c.oferta.n + ' de ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro (en el mercado sacaríais ' + Math.round(pm * c.oferta.n) + ')') + '. Vale ' + (c.oferta.hasta - m.turno + 1) + ' turnos.', orden: 'Acepto el trato' }; }
    for (const g of c.guerras) {
      const o = S().civ(m, g.con);
      if (o && S().fuerza(m, o) > S().fuerza(m, c) * 1.4) return { texto: 'La guerra con ' + o.nombre + ' va mal: son más fuertes que vosotros.', orden: 'Paz con ' + o.nombre };
      if (o && (pr.ejercito || 1) < 1.5 && (c.guerreros || 0) < hab * 0.2) return { texto: 'Estáis en guerra con ' + o.nombre + ' y solo tenéis ' + (c.guerreros || 0) + ' guerreros.', orden: 'Más soldados' };
    }
    if (c.huelga) return { texto: 'Los obreros están en huelga: las fábricas no producen y el descontento crece. Subirles el sueldo cuesta oro; reprimirlos acaba la huelga, pero la gente se enfada más.', orden: 'Subid los salarios' };
    if (c.efectos.some(e => e.sequia) && (pr.comida || 1) < 2) return { texto: 'Hay sequía: el trigo se agosta y mueren reses. El granero tiene ' + Math.floor(c.comida || 0) + ' de comida para ' + hab + ' bocas; más gente al campo y al ganado.', orden: 'Más comida' };
    if ((c.comida || 0) < hab * 0.15 && (pr.comida || 1) < 2) return { texto: 'Los graneros están casi vacíos (' + Math.floor(c.comida || 0) + ' de comida para ' + hab + ' bocas): si se acaban, la gente muere de hambre.', orden: 'Más comida' };
    if ((c.madera || 0) < 4 && (pr.madera || 1) < 2) return { texto: 'Sin madera no se levantan casas ni se pagan tierras nuevas.', orden: 'Más madera' };
    const rebelde = (m.ciudades || []).find(x => x.civ === c.id && x.lealtad != null && x.lealtad < 0);
    if (rebelde) return { texto: rebelde.nombre + ' no es leal (' + Math.round(rebelde.lealtad) + '): pronto se rebelará. Una corte más estable o un ejército cerca la retienen.', orden: 'Más soldados' };
    if (c.sinCama > 0 && (pr.casas || 1) < 2) return { texto: 'Hay parejas que quieren tener hijos y no tienen cama: faltan casas.', orden: 'Más casas' };
    // Lo que le falta al pueblo (agua, granero, plaza, parque, palacio): con su porqué y la orden para hacerlo.
    const ORDEN = { pozo: 'Construid un pozo', granero: 'Construid un granero', fuente: 'Construid una plaza pública', parque: 'Haced un parque', palacio: 'Construid un palacio', central: 'Construid una central eléctrica', banco: 'Abrid un banco', fabrica: 'Construid una fábrica', estacion: 'Construid una estación de tren', hospital: 'Construid un hospital', aerodromo: 'Construid un aeródromo', templo: 'Construid un templo' };
    const falta = !(c.plan && c.plan.obra) && (c.necesidades || []).find(x => x.falta && x.capital !== false && ORDEN[x.obra]);
    if (falta) return { texto: falta.nombre + ': ' + falta.mal + '. Hace falta ' + falta.edificio + '.', orden: ORDEN[falta.obra] };
    if (c.estab < 30) return { texto: 'La gente está descontenta (estabilidad ' + Math.round(c.estab) + '). La paz y un templo ayudan.', orden: S().vecinosDe(m, c).length && c.guerras.length ? 'Haced la paz' : 'Construid un templo' };
    if (M.ERAS[c.era + 1] && !c.subiendo && S().puedeSubir(m, c).ok) return { texto: '¡Podéis pasar a ' + M.ERAS[c.era + 1].con + '! Tenéis las mejoras, el saber, los edificios y con qué pagarlo. Toca tu plaza (o 🏛) y pulsa «Avanzar».', orden: 'Avanzad de edad' };
    if (M.ERAS[c.era + 1] && !c.subiendo && S().ahorrando(Object.assign({}, m), Object.assign({}, c, { jugador: false })) && !S().puedeSubir(m, c).ok && S().puedeSubir(m, c).falta.every(x => /de (comida|madera|piedra|oro|metal)$/.test(x))) return { texto: 'Para ' + M.ERAS[c.era + 1].con + ' solo os falta pagar: ' + S().puedeSubir(m, c).falta.join(', ') + '.', orden: 'Ahorrad para la edad' };
    if ((c.oro || 0) < 0) return { texto: 'Las arcas están vacías: los soldados no cobran y desertan, y la gente se queja.', orden: (c.plan && c.plan.impuesto || 1) < 1.5 ? 'Subid los impuestos' : 'Vended madera' };
    if (c.investigacion && !c.investigacion.id && M.TECNOLOGIAS.some(t => t.era <= c.era && !M.tecsDe(c).includes(t.id))) return { texto: 'Tus sabios esperan saber qué investigar.', orden: '¿Qué investigamos?' };
    if (c.plan && c.plan.obra) return { texto: 'Tus constructores esperan madera y piedra para el encargo (' + c.plan.obra + ').', orden: 'Más piedra' };
    const sig = M.ERAS[c.era + 1];
    if (sig && (pr.ciencia || 1) < 1.5) return { texto: 'Todo en orden. Si invertís en saber, llegaréis antes ' + aEra(sig.con) + '.', orden: 'Todo a la ciencia' };
    return { texto: 'Todo en orden. Tu pueblo trabaja solo; tú decides las grandes cosas.', orden: 'Informe' };
  }

  function ordenar(m, civId, texto) {
    const acciones = entender(m, civId, texto);
    if (!acciones.length) return { ok: false, acciones };
    const textos = aplicar(m, civId, acciones);
    m.registro = (m.registro || []).concat([{ turno: m.turno, civ: civId, acciones }]).slice(-200);
    return { ok: true, acciones, respuesta: textos.join(' ') };
  }

  // ---------- Lo que no entienda el intérprete, lo traduce Claude a las mismas acciones ----------
  const SISTEMA = [
    'Eres el consejero de un pueblo en "Génesis", un juego de estrategia por texto en un mundo que vive la historia humana real. El jugador gobierna SOLO su pueblo y te da órdenes en lenguaje natural.',
    'Traduce la orden a acciones de esta lista y nada más (no puedes hacer milagros ni afectar directamente a otros pueblos):',
    'El pueblo se gobierna solo (reparte el trabajo según lo que le falta); el jugador cambia la IMPORTANCIA de cada cosa:',
    '{"tipo":"prioridad","cambios":{"madera"|"comida"|"piedra"|"casas"|"ejercito"|"ciencia"|"riqueza"|"expansion": {"a": 0|0.5|1|1.5|2} o {"mas": -0.5|0.5}}} (0 nada, 1 normal, 2 máxima; solo las que cambien);',
    '{"tipo":"expandir","si":true|false,"rumbo":null|"norte"|"sur"|"este"|"oeste"|id_de_pueblo};',
    '{"tipo":"guerra","con":id}; {"tipo":"paz","con":id}; {"tipo":"comercio","con":id}; {"tipo":"alianza","con":id}; {"tipo":"romper","con":id} (romper una alianza);',
    '{"tipo":"regimen","a":"reino"|"imperio"|"republica"|"teocracia"|"democracia"|"dictadura","era":era_minima}; {"tipo":"colonia"} (flota al otro lado del mar, desde el Renacimiento); {"tipo":"colonos","rumbo":null|"norte"|"sur"|"este"|"oeste"|"costa"} (tres familias salen a pie a fundar una aldea); {"tipo":"construir","obra":"saber"|"templo"|"torre"|"puerto"|"molino"|"cuartel"|"arqueria"|"castillo"|"pozo"|"granero"|"fuente"|"parque"|"palacio"|"central"|"banco"|"fabrica"|"estacion"|"hospital"|"aerodromo"|"petroleo"|"mina"} (mina = galería, solo en la montaña, que da piedra, metal, carbón y algo de oro sin agotarse; petroleo = pozo de petróleo, en la Era Moderna y sobre una bolsa de crudo; banco desde el Renacimiento; fábrica y estación de tren desde la Revolución Industrial; hospital desde la Era Moderna; aeródromo en la II Guerra Mundial; fuente = plaza pública; central = central eléctrica, solo en la Era Moderna y en ciudades; templo = iglesia o catedral según la era; saber = la casa de los eruditos: cabaña del chamán, academia, monasterio, universidad o laboratorio); {"tipo":"cuadrilla","n":numero|"todos"|0.5,"de":oficio_origen|-1,"a":oficio_destino,"hasta":plazo} (aldeanos concretos cambian de tarea; oficios: 0 leñador, 1 granjero, 2 constructor, 3 minero, 4 guerrero, 5 comerciante, 6 erudito (chamán, filósofo, monje, científico); -1 cualquiera); {"tipo":"cupo","o":oficio,"n":numero,"hasta":plazo} (fija cuántos hay de un oficio); {"tipo":"meta","cosa":"arboles"|"casas"|"piedra"|"madera"|"metal"|"campos"|"comida","n":numero,"o":oficio} (producir eso y volver a lo de antes); {"tipo":"liberar"} (quitar cuadrillas y cupos); {"tipo":"investigar","id":"hachas|agricultura|ceramica|pastoreo|rueda|escritura|bronce|adobe|hierro|moneda|arado|murallas|acueducto|filosofia|derecho|hormigon|molino_agua|universidad|estribo|gremios|imprenta|polvora|banca|carabela|vapor|ferrocarril|fabrica|abonos|electricidad|vacunas|radio|aviacion|ametralladora|tanque|radar"}; {"tipo":"consulta_tec"}; {"tipo":"comprar"|"vender","que":"madera"|"comida"|"piedra"|"metal"|"armas"|"carbon"|"petroleo"|"muebles"|"vehiculos"|"semillas"|"granadas","n":numero|null} (solo con reinos con los que hay ruta de comercio: el comerciante lo trae o lo lleva); {"tipo":"especialidad","que":"madera"|"comida"|"piedra"|"metal"|"armas"|"carbon"|"petroleo"|"muebles"|"vehiculos"|null} (a qué se dedica el pueblo para vender); {"tipo":"consulta_mercado"}; {"tipo":"oferta","si":bool} (aceptar o rechazar el trato que ofrece un mercader); {"tipo":"tesoro","guardar":true|false} (guardar el oro o invertirlo en ciencia); {"tipo":"consulta_oro"}; {"tipo":"edad"} (pasar a la edad siguiente, como en Age of Empires: cuesta recursos y pide edificios); {"tipo":"consulta_edad"} (qué falta para la próxima edad); {"tipo":"edad_auto","si":bool}; {"tipo":"ahorrar_edad","si":bool}; {"tipo":"escuadron","n":numero,"arma":null|"arqueros"|"tanques","region":r|null,"ataca":true_si_va_contra_plaza_enemiga} (grupo de soldados con misión: guardar una plaza propia o atacar una enemiga); {"tipo":"vehiculos","cual":"tanque"|"artilleria"|"aviones"}; {"tipo":"atacar"} (salir al ataque en la guerra actual); {"tipo":"defender","region":r,"postura":"esperar"|"emboscada"|"alto"}; {"tipo":"rendicion","con":id}; {"tipo":"espiar","con":id}; {"tipo":"insultar","con":id}; {"tipo":"regalo","con":id}; {"tipo":"sabotaje","con":id} (quemar sus campos en guerra); {"tipo":"exterminio","con":id,"parar":bool} (los soldados matan también a los civiles de ese pueblo; parar:true lo cancela); {"tipo":"impuestos","sube":true|false}; {"tipo":"fiesta","descanso":true|false}; {"tipo":"reforestar"} (los leñadores plantan árboles con las semillas); {"tipo":"fabricar","que":"armas"|"muebles"|"vehiculos"|"granadas","n":numero} (fabricar armas de la época en la forja o la fábrica, o muebles con la madera en la fábrica); {"tipo":"huelga","ceder":true|false} (huelga obrera: subir salarios o reprimirla); {"tipo":"rezar"}; {"tipo":"curar"}; {"tipo":"trabajar"}; plazo = null | {"ms":milisegundos} | {"turnos":n} | {"anios":n} | {"cosa":"madera"|"comida"|"piedra"|"metal"|"casas"|"arboles","n":numero,"nuevo":true_si_es_producir_n_mas}; {"tipo":"objetivo","region":r} (el ejército marcha sobre esa plaza enemiga; declara la guerra si hace falta); {"tipo":"defender","region":r} (el ejército defiende esa plaza propia; para «retirada», la capital); {"tipo":"informe"}; {"tipo":"normal"}.',
    'Responde SOLO con JSON: {"acciones":[...], "respuesta":"una o dos frases de consejero, en español, que digan qué se hace y, si la orden pedía algo imposible, por qué no"}. Sin markdown. Usa solo los id que te doy.'
  ].join('\n');
  function paraIA(m, civId, texto) {
    const c = S().civ(m, civId);
    return 'Año ' + S().anioTexto(m.anio) + '. Tu pueblo: ' + JSON.stringify({ id: c.id, nombre: c.nombre, era: M.ERAS[c.era].nombre, poblacion_miles: Math.round(c.pob), estabilidad: Math.round(c.estab), madera: Math.floor(c.madera || 0), piedra: Math.floor(c.piedra || 0), guerras_con: c.guerras.map(g => g.con), plan: c.plan || null }) +
      '\nOtros pueblos: ' + JSON.stringify(S().vivas(m).filter(o => o.id !== c.id).map(o => ({ id: o.id, nombre: o.nombre, era: M.ERAS[o.era].nombre, poblacion_miles: Math.round(o.pob), vecino: S().vecinosDe(m, c).includes(o), relacion: Math.round(c.rel[o.id] || 0) }))) +
      '\nPlazas (región, dueño): ' + JSON.stringify([...S().vivas(m).map(o => ({ region: o.capital, nombre: 'capital de ' + o.nombre, dueno: o.id })), ...(m.ciudades || []).map(x => ({ region: x.region, nombre: x.nombre, dueno: m.dueno[x.region] }))]) +
      '\n\nOrden del jugador: «' + texto + '»\n\nDevuelve solo el JSON.';
  }
  const TIPOS = new Set(['exterminio', 'oferta', 'consulta_mercado', 'especialidad', 'edad', 'consulta_edad', 'edad_auto', 'ahorrar_edad', 'investigar', 'consulta_tec', 'comprar', 'vender', 'tesoro', 'consulta_oro', 'reparar', 'escuadron', 'vehiculos', 'atacar', 'rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje', 'impuestos', 'fiesta', 'rezar', 'curar', 'trabajar', 'consulta', 'cuadrilla', 'cupo', 'meta', 'liberar', 'objetivo', 'defender', 'prioridad', 'expandir', 'guerra', 'paz', 'comercio', 'alianza', 'romper', 'regimen', 'colonia', 'colonos', 'construir', 'informe', 'normal']);
  // Lo que venga de Claude se filtra: solo acciones conocidas, con valores dentro de lo permitido.
  function limpiar(acciones) {
    const out = [];
    for (const a of Array.isArray(acciones) ? acciones.slice(0, 6) : []) {
      if (!a || !TIPOS.has(a.tipo)) continue;
      if (a.tipo === 'prioridad') {
        const cambios = {};
        for (const k of Object.keys(NOMBRE_RECURSO)) {
          const ch = a.cambios && a.cambios[k];
          if (!ch) continue;
          if (ch.a != null && Number.isFinite(Number(ch.a))) cambios[k] = { a: Math.max(0, Math.min(2, Math.round(Number(ch.a) * 2) / 2)) };
          else if (ch.mas != null && Number.isFinite(Number(ch.mas))) cambios[k] = { mas: Number(ch.mas) > 0 ? 0.5 : -0.5 };
        }
        if (Object.keys(cambios).length) out.push({ tipo: 'prioridad', cambios });
      } else if (a.tipo === 'cuadrilla' || a.tipo === 'cupo' || a.tipo === 'meta') {
        const oficio = x => (Number.isInteger(Number(x)) && Number(x) >= -1 && Number(x) <= 6 ? Number(x) : null);
        const h = a.hasta && typeof a.hasta === 'object' ? (a.hasta.ms > 0 ? { ms: Math.min(7200000, Number(a.hasta.ms)) } : a.hasta.turnos > 0 ? { turnos: Math.min(500, Math.round(a.hasta.turnos)) } : a.hasta.anios > 0 ? { anios: Math.min(2000, Number(a.hasta.anios)) } : COSAS[a.hasta.cosa] && a.hasta.n > 0 ? { cosa: COSAS[a.hasta.cosa], n: Math.min(10000, Math.round(a.hasta.n)), nuevo: !!a.hasta.nuevo } : null) : null;
        const n = a.n === 'todos' ? 'todos' : Number(a.n) > 0 ? Math.min(500, Number(a.n)) : null;
        if (a.tipo === 'cuadrilla' && n != null && oficio(a.de) != null && oficio(a.a) >= 0) out.push({ tipo: 'cuadrilla', n, de: oficio(a.de), a: oficio(a.a), hasta: h });
        else if (a.tipo === 'cupo' && n != null && n !== 'todos' && oficio(a.o) >= 0) out.push({ tipo: 'cupo', o: oficio(a.o), n: Math.round(n), hasta: h });
        else if (a.tipo === 'meta' && n != null && n !== 'todos' && COSAS[a.cosa] && oficio(a.o) >= 0) out.push({ tipo: 'meta', cosa: COSAS[a.cosa], n: Math.round(n), o: oficio(a.o) });
      } else if (['liberar', 'consulta', 'consulta_tec', 'consulta_oro', 'edad', 'consulta_edad'].includes(a.tipo)) out.push({ tipo: a.tipo });
      else if (a.tipo === 'edad_auto' || a.tipo === 'ahorrar_edad') out.push({ tipo: a.tipo, si: a.si !== false });
      else if (a.tipo === 'investigar') { if (M.TECNOLOGIAS.some(t => t.id === a.id)) out.push({ tipo: 'investigar', id: a.id }); }
      else if (a.tipo === 'especialidad') out.push({ tipo: 'especialidad', que: PRECIO[a.que] ? a.que : null });
      else if (a.tipo === 'consulta_mercado') out.push({ tipo: 'consulta_mercado' });
      else if (a.tipo === 'oferta') out.push({ tipo: 'oferta', si: a.si !== false });
      else if (a.tipo === 'comprar' || a.tipo === 'vender') { if (PRECIO[a.que]) out.push({ tipo: a.tipo, que: a.que, n: Number(a.n) > 0 ? Math.min(1000, Math.round(Number(a.n))) : null }); }
      else if (a.tipo === 'tesoro') out.push({ tipo: 'tesoro', guardar: !!a.guardar });
      else if (TIPOS_EXTRA.includes(a.tipo)) {
        const x = { tipo: a.tipo };
        if (a.con != null && Number.isInteger(Number(a.con))) x.con = Number(a.con);
        if (a.tipo === 'escuadron') { x.n = Math.max(1, Math.min(200, Math.round(Number(a.n) || 8))); x.arma = ['arqueros', 'tanques'].includes(a.arma) ? a.arma : null; x.region = Number.isInteger(Number(a.region)) && a.region !== null ? Number(a.region) : null; if (a.ataca) x.ataca = true; }
        if (a.tipo === 'vehiculos') x.cual = ['tanque', 'artilleria', 'aviones'].includes(a.cual) ? a.cual : 'artilleria';
        if (a.tipo === 'impuestos') x.sube = a.sube !== false;
        if (a.tipo === 'fiesta' && a.descanso) x.descanso = true;
        if (a.tipo === 'huelga') x.ceder = a.ceder !== false;
        if (a.tipo === 'fabricar') { x.que = ['muebles', 'vehiculos', 'granadas'].includes(a.que) ? a.que : 'armas'; x.n = Math.max(1, Math.min(500, Math.round(Number(a.n) || 20))); }
        if (['rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje'].includes(a.tipo) && x.con == null) continue;
        out.push(x);
      }
      else if (a.tipo === 'objetivo' || a.tipo === 'defender') { if (Number.isInteger(Number(a.region)) && Number(a.region) >= 0) out.push({ tipo: a.tipo, region: Number(a.region) }); }
      else if (a.tipo === 'expandir') out.push({ tipo: 'expandir', si: a.si !== false, rumbo: ['norte', 'sur', 'este', 'oeste'].includes(a.rumbo) ? a.rumbo : Number.isFinite(Number(a.rumbo)) && a.rumbo !== null ? Number(a.rumbo) : null });
      else if (a.tipo === 'regimen') { const r = REGIMENES.find(x => x[1] === a.a); if (r) out.push({ tipo: 'regimen', a: r[1], era: r[2] }); }
      else if (['guerra', 'paz', 'comercio', 'alianza', 'romper'].includes(a.tipo)) out.push({ tipo: a.tipo, con: Number(a.con) });
      else if (a.tipo === 'colonos') out.push({ tipo: 'colonos', rumbo: ['norte', 'sur', 'este', 'oeste', 'costa'].includes(a.rumbo) ? a.rumbo : null });
      else if (a.tipo === 'construir') { if (['saber', 'templo', 'torre', 'puerto', 'molino', 'cuartel', 'arqueria', 'castillo', 'pozo', 'granero', 'fuente', 'parque', 'palacio', 'central', 'banco', 'fabrica', 'estacion', 'hospital', 'aerodromo', 'petroleo', 'mina'].includes(a.obra)) out.push({ tipo: 'construir', obra: a.obra }); }
      else out.push({ tipo: a.tipo });
    }
    return out;
  }
  function aplicarIA(m, civId, f) {
    const acciones = limpiar(f && f.acciones);
    if (!acciones.length) return null;
    const textos = aplicar(m, civId, acciones);
    m.registro = (m.registro || []).concat([{ turno: m.turno, civ: civId, acciones }]).slice(-200);
    return { ok: true, acciones, respuesta: (f.respuesta ? String(f.respuesta).slice(0, 300) + ' ' : '') + textos.filter(t => !/^¿/.test(t)).join(' ') };
  }

  // ---------- Elegir pueblo ----------
  function gobernar(m, civId) {
    for (const c of m.civs) { c.jugador = false; }
    const c = civId != null ? S().civ(m, civId) : null;
    m.jugador = c && c.viva ? c.id : null;
    if (c && c.viva) { c.jugador = true; plan(c); if (!m.retos || m.retos.civ !== c.id) m.retos = { civ: c.id, hechos: {}, puntos: 0, conquistas: 0, desde: m.turno }; }
    return c;
  }

  // ---------- Los primeros pasos: una guía corta para quien empieza a gobernar ----------
  // Cada paso se comprueba solo; los que el pueblo ya cumple por su cuenta se saltan. Al acabar, se apaga.
  const GUIA = [
    { id: 'ficha', texto: 'Toca tu tierra o una casa de tu pueblo en el mapa para ver quién vive ahí y qué le falta.', boton: 'Ver mi pueblo', accion: 'ficha', hecho: m => !!m.guia.vioFicha },
    { id: 'orden', texto: 'Escribe tu primera orden abajo, como hablarías. Por ejemplo, pide casas: con camas nacen más niños.', boton: 'Haced 3 casas', accion: 'orden', hecho: m => (m.guia.ordenes || 0) > 0 },
    { id: 'comida', texto: 'Sin molino no hay tierra de cultivo. Que levanten un molino y siembren al menos 3 campos.', boton: 'Más comida', accion: 'orden', hecho: (m, c) => (c.molinos || 0) > 0 && (c.campos || 0) >= 3 },
    { id: 'corte', texto: 'Abre la corte (🏛 a la derecha, o toca tu plaza): ahí eliges qué investigan tus sabios.', boton: 'Abrir la corte', accion: 'corte', hecho: m => !!m.guia.corte },
    { id: 'mejoras', texto: 'Para pasar de edad hacen falta 3 mejoras de la edad actual. Elígelas en la corte y paga lo que piden.', boton: 'Abrir la corte', accion: 'corte', hecho: (m, c) => c.era > 0 || S().mejorasDeEdad(c).hechas >= S().mejorasDeEdad(c).pide },
    { id: 'edad', texto: 'Ya casi: cuando tengas el saber y lo que pide la edad, pulsa «Avanzar» en la corte para llegar a la Edad del Bronce.', boton: 'Abrir la corte', accion: 'corte', hecho: (m, c) => c.era > 0 }
  ];
  // El paso que toca ahora (o null si la guía terminó, se ocultó o no se gobierna ningún pueblo).
  function guia(m) {
    const c = m.jugador != null ? S().civ(m, m.jugador) : null;
    if (!c || !c.viva || m.modo !== 'pueblo') return null;
    const g = m.guia = m.guia || {};
    if (g.oculta || g.fin) return null;
    const i = GUIA.findIndex(x => !x.hecho(m, c));
    if (i < 0) { g.fin = m.anio; return null; }
    return Object.assign({ n: i + 1, de: GUIA.length }, GUIA[i]);
  }

  // ---------- Los retos del modo pueblo: metas con puntos, y el fin de la partida ----------
  const ciudadesDe = (m, c) => (m.ciudades || []).filter(x => x.civ === c.id).length;
  const RETOS = [
    { id: 'gente30', nombre: 'Una aldea de verdad', texto: 'Llega a 30 aldeanos.', puntos: 100, prog: (m, c) => [c.habitantes || 0, 30] },
    { id: 'bronce', nombre: 'La Edad del Bronce', texto: 'Entra en la Edad del Bronce.', puntos: 100, prog: (m, c) => [c.era, 1] },
    { id: 'ciudad', nombre: 'Tu primera ciudad', texto: 'Que tus colonos funden una ciudad.', puntos: 150, prog: (m, c) => [ciudadesDe(m, c), 1] },
    { id: 'granero', nombre: 'Graneros llenos', texto: 'Junta 100 de comida en el granero.', puntos: 100, prog: (m, c) => [Math.floor(c.comida || 0), 100] },
    { id: 'medieval', nombre: 'Fase medieval', texto: 'Llega a la Edad del Hierro.', puntos: 200, prog: (m, c) => [c.era, 2] },
    { id: 'castillo', nombre: 'Un castillo', texto: 'Levanta un castillo en tu frontera («construid un castillo»).', puntos: 200, prog: (m, c) => [c.castillos || 0, 1] },
    { id: 'conquista', nombre: 'Conquistador', texto: 'Toma una ciudad o una capital enemiga.', puntos: 300, prog: m => [m.retos.conquistas || 0, 1] },
    { id: 'gente100', nombre: 'Una gran ciudad', texto: 'Llega a 100 aldeanos.', puntos: 250, prog: (m, c) => [c.habitantes || 0, 100] },
    { id: 'tierras40', nombre: 'Un reino grande', texto: 'Gobierna 40 tierras.', puntos: 300, prog: (m, c) => [S().casillas(m, c).length, 40] },
    { id: 'polvora', nombre: 'La pólvora', texto: 'Llega al Renacimiento.', puntos: 300, prog: (m, c) => [c.era, 5] },
    { id: 'primero', nombre: 'A la cabeza del mundo', texto: 'Sé el pueblo con más tierras.', puntos: 400, prog: (m, c) => [S().vivas(m).every(o => o === c || S().casillas(m, o).length < S().casillas(m, c).length) ? 1 : 0, 1] },
    { id: 'moderna', nombre: 'La última fase', texto: 'Llega a la Era Moderna.', puntos: 500, prog: (m, c) => [c.era, 7] },
    { id: 'sobrevivir', nombre: 'Hasta el final', texto: 'Que tu pueblo siga en pie al terminar la partida.', puntos: 500, prog: (m, c) => [c.viva && finPartida(m) ? 1 : 0, 1] }
  ];
  // La partida termina en 1945 (o a los 400 años en el mundo libre).
  const finPartida = m => (m.libre ? m.anio >= 400 : m.anio >= 1945);
  // Comprueba los retos tras un turno; devuelve los que se acaban de cumplir.
  function evaluarRetos(m, nuevos) {
    const r = m.retos, c = r ? S().civ(m, r.civ) : null;
    if (!r || !c) return [];
    for (const e of nuevos || []) if (e.tipo === 'conquista' && e.civ === c.id) r.conquistas = (r.conquistas || 0) + 1;
    const cumplidos = [];
    if (!c.viva) return cumplidos;
    // La historia de tu pueblo, para contarla al final: cuándo llegó a cada era, su mayor tamaño, sus guerras y sus reyes.
    const h = r.hist = r.hist || { eras: {}, maxHab: 0, maxTierras: 0, enemigos: [], reyes: [], ciudades: 0, desde: m.anio };
    if (h.eras[c.era] == null) h.eras[c.era] = m.anio;
    h.maxHab = Math.max(h.maxHab, c.habitantes || 0); h.maxTierras = Math.max(h.maxTierras, S().casillas(m, c).length);
    h.ciudades = Math.max(h.ciudades, ciudadesDe(m, c));
    for (const g of c.guerras) { const o = S().civ(m, g.con); if (o && !h.enemigos.includes(o.nombre)) h.enemigos.push(o.nombre); }
    const rey = S().nombreRey ? S().nombreRey(c) : null;
    if (rey && rey !== '—' && h.reyes[h.reyes.length - 1] !== rey) { h.reyes.push(rey); if (h.reyes.length > 12) h.reyes.splice(1, 1); }
    for (const x of RETOS) {
      if (r.hechos[x.id] != null) continue;
      const [v, meta] = x.prog(m, c);
      if (v >= meta) { r.hechos[x.id] = m.anio; r.puntos += x.puntos; cumplidos.push(x); }
    }
    return cumplidos;
  }
  function estadoRetos(m) {
    const r = m.retos, c = r ? S().civ(m, r.civ) : null;
    if (!r || !c) return null;
    const lista = RETOS.map(x => { const [v, meta] = c.viva ? x.prog(m, c) : [0, 1]; return { id: x.id, nombre: x.nombre, texto: x.texto, puntos: x.puntos, hecho: r.hechos[x.id] != null, cuando: r.hechos[x.id], avance: Math.max(0, Math.min(1, v / meta)), v, meta }; });
    // La puntuación final suma los retos, la gente y la tierra que tengas.
    const extra = c.viva ? (c.habitantes || 0) + S().casillas(m, c).length * 5 : 0;
    const puesto = c.viva ? S().vivas(m).slice().sort((a, b) => S().casillas(m, b).length - S().casillas(m, a).length).indexOf(c) + 1 : null;
    return { civ: c, lista, puntos: r.puntos, extra, total: r.puntos + extra, hechos: lista.filter(x => x.hecho).length, fin: finPartida(m), puesto, hist: r.hist || null, conquistas: r.conquistas || 0 };
  }

  M.mando = { GUIA, guia, vencer, queda, textoPlazo, cuentaOficios, OFICIOS_N, entender, aplicar, ordenar, informe, consejo, gobernar, RETOS, evaluarRetos, estadoRetos, finPartida, SISTEMA, paraIA, aplicarIA, limpiar, NOMBRE_RECURSO, NIVEL };
})(globalThis.RF = globalThis.RF || {});
