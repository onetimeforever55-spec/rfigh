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
  // El gobierno de tu pueblo hace solo lo que haría cualquier reino (ahorrar y pasar de edad en cuanto se puede);
  // si prefieres decidirlo tú: «no paséis de edad solos».
  const plan = c => { c.plan = c.plan || { rumbo: null, socios: [], guerrasMias: [] }; c.plan.prioridad = c.plan.prioridad || PRIO_NORMAL(); c.plan.guerrasMias = c.plan.guerrasMias || []; if (c.plan.autoEdad == null) c.plan.autoEdad = true; if (c.plan.ahorrarEdad == null) c.plan.ahorrarEdad = true; return c.plan; };

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
    [4, 'guerrer\\w*|soldad\\w*|tropas?|arquer(?:os?|as?)|milician\\w*|reclutas?|caballer\\w*|tanquistas?|artiller\\w*'],
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
  // (Los obreros de las fábricas privadas no cuentan en su antiguo oficio: trabajan para su patrón.)
  function cuentaOficios(m, c) { const n = [0, 0, 0, 0, 0, 0, 0]; for (const a of adultosDe(m, c)) if (a.obrero == null) n[a.o]++; return n; }
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
    const obreros = adultosDe(m, c).filter(a => a.obrero != null).length;
    if (obreros) partes.push(obreros + (obreros === 1 ? ' obrero' : ' obreros') + ' en las fábricas privadas');
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
