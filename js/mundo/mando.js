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
    comida: /\b(sembr\w*|siembr\w*|cultiv\w*|granj\w*|campos?|cosech\w*|agricult\w*|trigo|comida|alimento\w*|hambre)\b/,
    piedra: /\b(minas?|miner\w*|piedra|canteras?|picad|picar)\b/,
    casas: /\b(constru\w*|casas?|edific\w*|obras?|viviendas?|caminos?|carreteras?|calzadas?)\b/,
    ejercito: /\b(reclut\w*|ejercitos?|soldados?|guerreros?|militar\w*|milicias?|defensa|tropas?|armas)\b/,
    ciencia: /\b(cienc\w*|investig\w*|estudi\w*|sabios?|escuelas?|tecnolog\w*|universidad\w*|inventos?)\b/,
    riqueza: /\b(riqueza|oro|dinero|mercados?|negocios?|enriquec\w*|impuestos|comercio|comerciantes?|caravanas?|carretas?|mercaderes)\b/
  };
  const NOMBRE_RECURSO = { madera: 'madera', comida: 'comida', piedra: 'piedra', casas: 'casas', ejercito: 'ejército', ciencia: 'ciencia', riqueza: 'riqueza', expansion: 'expansión' };
  const NIVEL = v => (v <= 0 ? 'nada' : v <= 0.5 ? 'baja' : v <= 1 ? 'normal' : v <= 1.5 ? 'alta' : 'máxima');
  const REGIMENES = [[/\bdemocracia\b/, 'democracia', 5], [/\brepublica\b/, 'republica', 2], [/\bimperio\b|\bemperador\b/, 'imperio', 2], [/\bdictadura\b|\bdictador\b/, 'dictadura', 5], [/\bteocracia\b/, 'teocracia', 1], [/\bmonarquia\b|\breino\b|\bcorona\w*\b|\brey\b/, 'reino', 1], [/\brepublica popular\b|\bcomunis\w*\b/, 'estado_obrero', 6]];

  const PRIO_NORMAL = () => ({ madera: 1, comida: 1, piedra: 1, casas: 1, ejercito: 1, ciencia: 1, riqueza: 1, expansion: 1 });
  const plan = c => { c.plan = c.plan || { rumbo: null, socios: [], guerrasMias: [] }; c.plan.prioridad = c.plan.prioridad || PRIO_NORMAL(); c.plan.guerrasMias = c.plan.guerrasMias || []; return c.plan; };

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
  const OFICIOS_N = ['leñadores', 'granjeros', 'constructores', 'mineros', 'guerreros', 'comerciantes'];
  const OFICIO_1 = ['leñador', 'granjero', 'constructor', 'minero', 'guerrero', 'comerciante'];
  const VERBO = ['talar', 'el campo', 'construir', 'la mina', 'las armas', 'comerciar'];
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
    [-1, 'aldean\\w*|personas?|gente|hombres|mujeres|trabajador\\w*|vecinos|habitantes|tipos|curritos|peones|mios']
  ];
  const ACTIVIDAD = [
    [0, /\b(tal(a|ar|ando|en|ad|e|ara|aran)|talad\w*|cort\w* (lena|arboles|madera|troncos)|lena|madera|bosques?|arboles|troncos)\b/],
    [1, /\b(sembr\w*|siembr\w*|cultiv\w*|cosech\w*|segar|siega\w*|arar|aren|arando|campos?|granjas?|trigo|comida|alimentos?|ordenn\w*|pastore\w*|ganado|caza\w*|pesca\w*|a cazar|a pescar)\b/],
    [2, /\b(constru\w*|edific\w*|levant\w*|obras?|casas?|caminos?|viviendas?|carreteras?)\b/],
    [3, /\b(min(a|as|ar|ando|en|ad|e)|pic(ar|ad|ando|en|a)|canteras?|piedras?|metal|hierro|oro|minerales?)\b/],
    [4, /\b(luch\w*|pele\w*|combat\w*|armas|ejercito|guerra|frente|frontera|defend\w*|patrull\w*|cuartel|filas|milicia|reclut\w*)\b/],
    [5, /\b(comerci\w*|vend\w*|mercados?|caravanas?|negoci\w*)\b/]
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
    const mt = n.match(new RegExp('\\b(tal\\w*|cort\\w*|constru\\w*|levant\\w*|haced|hagan|sac\\w*|pic\\w*|junt\\w*|recog\\w*|sembr\\w*|siembr\\w*|ar\\w*)\\s+(?:otr[oa]s\\s+)?' + NUM + '\\s*(?:de |mas |nuev[oa]s )?(arboles|casas|piedras?|piedra|madera|lena|metal|hierro|oro|campos|comida|trigo)\\b'));
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
    const quiere = /\b(quiero|queremos|quisiera|necesito|necesitamos|que haya|haya|ten(ed|gamos|er|go)|pon(ed|er|gan|me)?|dejad|deja|mantened|mantener|manten|fij\w*|solo|exactamente|cupo|mas|menos|sean|seamos)\b/.test(resto) || norm(resto.replace(frase, ' ')).split(' ').filter(Boolean).length <= 1;
    if (cuanto != null && origen >= 0 && (destino == null || destino === origen) && quiere) {
      if (/\bmas\b/.test(resto)) relativo = 1; else if (/\bmenos\b/.test(resto)) relativo = -1;
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
    if (h.anio != null) return ' hasta el año ' + S().anioTexto(h.anio).replace(/\.$/, '');
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
  function cuentaOficios(m, c) { const n = [0, 0, 0, 0, 0, 0]; for (const a of adultosDe(m, c)) n[a.o]++; return n; }
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
    const nombreDe = a.de >= 0 ? OFICIOS_N[a.de] : 'aldeanos';
    if (!elegidos.length) { textos.push(a.de >= 0 ? 'No tienes ' + nombreDe + ' que puedan ir' + (a.de === 4 ? '' : '') + '.' : 'No queda gente libre para eso.'); return; }
    const id = (p.sigCuadrilla = (p.sigCuadrilla || 0) + 1);
    const texto = elegidos.length + ' ' + (elegidos.length === 1 ? (a.de >= 0 ? OFICIO_1[a.de] : 'aldeano') : nombreDe) + ' → ' + VERBO[a.a];
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
  function aplicarCupo(m, c, a, textos) {
    const p = plan(c), antes = cuentaOficios(m, c);
    const n = Math.max(0, a.relativo ? antes[a.o] + a.relativo * a.n : a.n);
    const h = plazoAbsoluto(m, c, a.hasta);
    p.cupos = p.cupos || {};
    p.cupos[a.o] = { n, hasta: h };
    M.vida.reasignar(m, c, null, true);
    const ahora = cuentaOficios(m, c);
    const total = adultosDe(m, c).length;
    (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: (ahora[a.o] >= antes[a.o] ? '▲ ' : '▼ ') + OFICIOS_N[a.o] + ' ' + antes[a.o] + ' → ' + ahora[a.o] });
    textos.push('Ahora tienes ' + ahora[a.o] + ' ' + (ahora[a.o] === 1 ? OFICIO_1[a.o] : OFICIOS_N[a.o]) + ' (antes ' + antes[a.o] + ')' + textoPlazo(m, h, a.siempre) + '.' + (ahora[a.o] < n ? ' No hay más adultos que puedan serlo (' + total + ' en total).' : '') + ' El resto del trabajo se reparte solo. Para quitar el cupo: «liberad los cupos».');
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
    M.vida.reasignar(m, c, null, true);
    const n1 = cuentaOficios(m, c)[a.o];
    (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, texto: '🎯 ' + a.n + ' ' + (a.cosa === 'arboles' ? 'árboles' : a.cosa) + ' · ' + OFICIOS_N[a.o] + ' ' + n0 + ' → ' + n1 });
    textos.push('Encargado: ' + textoPlazo(m, h).trim().replace(/^hasta /, '') + '. Los ' + OFICIOS_N[a.o] + ' pasan de ' + n0 + ' a ' + n1 + ' y, al terminar, todo vuelve a como estaba.');
  }

  // ---------- Del texto a las acciones ----------
  function entender(m, civId, texto) {
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
    const tratado = !alianza && /\b(comerci\w* con|amistad|tratado|embajad\w*|regal\w* a)\b/.test(n);
    // Preguntas: «¿cuántos leñadores tengo?», «¿cuánta madera hay?», «¿qué hace mi gente?».
    if (/\b(cuant[oa]s?|que hace mi gente|que hacen|en que trabaja\w*|reparto|oficios|cuadrillas|cupos)\b/.test(n) && !/\b(quiero|pon\w*|mand\w*|que (se )?(vayan|pongan)|quit\w*|liber\w*|cancel\w*|anul\w*|solt\w*|suelt\w*)\b/.test(n) && !/\d/.test(n.replace(/\bcuant\w*/, ''))) { const of = NOMBRE_OF.find(([o, re]) => o >= 0 && new RegExp('\\b(' + re + ')\\b').test(n)); return [{ tipo: 'consulta', o: of ? of[0] : undefined }]; }
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
      const mia = nombrada && nombrada.civ === c.id ? nombrada.region : c.capital;
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

    const expandir = /\b(expand\w*|extiend\w*|coloniz\w*|ocupa\w*|nuevas tierras|ve hacia|id hacia|avanz\w* (hacia|al)|crec\w* hacia|hacia el)\b/.test(n);
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
      if (conCuadrilla && k !== 'ciencia') continue;
      if (k === 'ejercito' && (guerra || paz) && !/\breclut/.test(n)) continue;
      if (k === 'riqueza' && tratado) continue;
      const mt = n.match(re);
      if (!mt) continue;
      const antes = n.slice(Math.max(0, mt.index - 16), mt.index);
      if (/\b(nada de|ningun\w*|cero)\b/.test(antes)) cambios[k] = { a: 0 };
      else if (/\b(menos|no|deja\w* de|sin|poca|poco)\b/.test(antes)) cambios[k] = { mas: -0.5 };
      else if (solo || /\b(maxim\w*|al maximo|toda la|todo lo que|prioridad absoluta|mucha|mucho)\b/.test(n)) cambios[k] = { a: 2 };
      else if (/\b(invert\w*|invier\w*|centra\w*|prioriz\w*|enfoca\w*|volca\w*|vuelca\w*|apuesta\w*)\b/.test(n)) cambios[k] = { a: 2 };
      else cambios[k] = { mas: 0.5 };
    }
    if (expandir && !guerra) cambios.expansion = { a: 1.5 };
    if (quieto) cambios.expansion = { a: 0 };
    if (Object.keys(cambios).length) acciones.push({ tipo: 'prioridad', cambios, solo: solo || undefined, hasta: plazoGeneral ? plazoGeneral.hasta : undefined });
    const porMar = /\b(cruz\w* el mar|ultramar|colonia|barcos?|flota|navega\w*)\b/.test(n) && !/\bpuerto\b/.test(n);
    if (porMar) acciones.push({ tipo: 'colonia' });
    // Edificios concretos: "construid un templo", "levantad murallas", "haced un puerto".
    const obra = /\b(cuartel\w*|barracon\w*|soldados nuevos)\b/.test(n) ? 'cuartel' : /\b(arqueria\w*|campo de tiro|arqueros nuevos)\b/.test(n) ? 'arqueria' : /\b(castillos?|fortalezas?|fortin\w*|bunker\w*)\b/.test(n) ? 'castillo' : /\b(templos?|iglesias?|santuarios?|altar)\b/.test(n) ? 'templo' : /\b(torres?|murallas?|muros?|defensas|fortific\w*|fuertes?)\b/.test(n) ? 'torre' : /\b(puertos?|muelles?)\b/.test(n) ? 'puerto' : /\bmolinos?\b/.test(n) ? 'molino' : null;
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
        if (a.solo) for (const k of Object.keys(pr)) if (!tocados.includes(k) && k !== 'expansion') pr[k] = Math.min(pr[k], 0.5);
        for (const k of tocados) { const ch = a.cambios[k]; pr[k] = Math.max(0, Math.min(2, ch.a != null ? ch.a : (pr[k] != null ? pr[k] : 1) + ch.mas)); }
        // Con plazo («durante 2 minutos»), al vencer vuelve cada prioridad a como estaba.
        const hp = plazoAbsoluto(m, c, a.hasta);
        if (hp) for (const k of tocados) { p.temporales = (p.temporales || []).filter(t => t.k !== k); p.temporales.push({ k, antes: previas[k] != null ? previas[k] : 1, puesto: pr[k], hasta: hp }); }
        const cuenta = () => { const n = [0, 0, 0, 0, 0, 0]; if (m.vida) for (const x of m.vida.aldeanos) if (x.c === c.id && (x.edad || 0) >= M.vida.ADULTO && x.colono == null) n[x.o]++; return n; };
        const antesOficios = cuenta();
        // La gente cambia de oficio en el acto (sin esperar al turno siguiente).
        if (M.vida && m.vida) M.vida.reasignar(m, c, null, true);
        const ahora = cuenta(), cambios = tocados.filter(k => OFICIO_DE[k] && ahora[OFICIO_DE[k][0]] !== antesOficios[OFICIO_DE[k][0]]).map(k => (ahora[OFICIO_DE[k][0]] > antesOficios[OFICIO_DE[k][0]] ? '▲ ' : '▼ ') + OFICIO_DE[k][1] + ' ' + antesOficios[OFICIO_DE[k][0]] + ' → ' + ahora[OFICIO_DE[k][0]]);
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
        const nombre = r === c.capital ? 'la capital' : nombrePlaza(m, r);
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
        textos.push('Tratado con ' + o.nombre + ': comerciaréis y os llevaréis mejor cada año.');
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
        const NOMBRE = { templo: 'un templo', torre: 'una torre de defensa', puerto: 'un puerto', molino: 'un molino', cuartel: 'un cuartel de soldados', arqueria: c.era >= 5 ? 'un campo de tiro' : 'una arquería', castillo: c.era >= 7 ? 'un fortín' : c.era >= 5 ? 'una fortaleza' : 'un castillo' };
        const COSTE = { templo: [8, 6], torre: [6, 4], puerto: [10, 0], molino: [3, 0], cuartel: [10, 6], arqueria: [10, 2], castillo: [16, 24] }[a.obra];
        if (a.obra === 'castillo' && c.era < 2) { textos.push('Los castillos de piedra llegan con la Edad del Hierro (fase medieval).'); continue; }
        if (a.obra !== 'molino' && c.era < 1) { textos.push('Aún no sabéis levantar ' + NOMBRE[a.obra] + ': hace falta llegar a la Edad del Bronce.'); continue; }
        if (M.vida && m.vida) {
          const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)].flatMap(r => M.vida.parcelas(m, r));
          if (zona.some(t => m.vida.obra[t] === M.vida.OBRA[a.obra])) { textos.push('Ya tenéis ' + NOMBRE[a.obra] + ' en la plaza de ' + c.nombre + '.'); continue; }
        }
        p.obra = a.obra;
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: '⚒ ' + NOMBRE[a.obra].replace(/^una? /, '') + ' en marcha' });
        const falta = [];
        if ((c.madera || 0) < COSTE[0]) falta.push((COSTE[0] - Math.floor(c.madera || 0)) + ' de madera');
        if ((c.piedra || 0) < COSTE[1]) falta.push((COSTE[1] - Math.floor(c.piedra || 0)) + ' de piedra');
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
  const OFICIO_DE = { madera: [0, 'leñadores'], comida: [1, 'granjeros'], casas: [2, 'constructores'], piedra: [3, 'mineros'], ejercito: [4, 'guerreros'], riqueza: [5, 'comerciantes'] };
  function repartoDe(m, c) {
    if (!M.vida || !m.vida) return null;
    const adultos = m.vida.aldeanos.filter(x => x.c === c.id && (x.edad || 0) >= M.vida.ADULTO && x.colono == null).length;
    return M.vida.reparto(c, { arboles: 1, rocas: 1 }).map(x => Math.round(x * adultos));
  }
  function oficiosNuevos(m, c, antes, tocados) {
    const ahora = repartoDe(m, c);
    if (!antes || !ahora) return ' Tu gente se reorganiza sola según eso.';
    const partes = tocados.filter(k => OFICIO_DE[k] && antes[OFICIO_DE[k][0]] !== ahora[OFICIO_DE[k][0]]).map(k => OFICIO_DE[k][1] + ' ' + antes[OFICIO_DE[k][0]] + ' → ' + ahora[OFICIO_DE[k][0]]);
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
    for (const g of c.guerras) {
      const o = S().civ(m, g.con);
      if (o && S().fuerza(m, o) > S().fuerza(m, c) * 1.4) return { texto: 'La guerra con ' + o.nombre + ' va mal: son más fuertes que vosotros.', orden: 'Paz con ' + o.nombre };
      if (o && (pr.ejercito || 1) < 1.5 && (c.guerreros || 0) < hab * 0.2) return { texto: 'Estáis en guerra con ' + o.nombre + ' y solo tenéis ' + (c.guerreros || 0) + ' guerreros.', orden: 'Más soldados' };
    }
    if (c.efectos.some(e => e.sequia) && (pr.comida || 1) < 2) return { texto: 'Hay sequía: el trigo se agosta y mueren reses. El granero tiene ' + Math.floor(c.comida || 0) + ' de comida para ' + hab + ' bocas; más gente al campo y al ganado.', orden: 'Más comida' };
    if ((c.comida || 0) < hab * 0.15 && (pr.comida || 1) < 2) return { texto: 'Los graneros están casi vacíos (' + Math.floor(c.comida || 0) + ' de comida para ' + hab + ' bocas): si se acaban, la gente muere de hambre.', orden: 'Más comida' };
    if ((c.madera || 0) < 4 && (pr.madera || 1) < 2) return { texto: 'Sin madera no se levantan casas ni se pagan tierras nuevas.', orden: 'Más madera' };
    const rebelde = (m.ciudades || []).find(x => x.civ === c.id && x.lealtad != null && x.lealtad < 0);
    if (rebelde) return { texto: rebelde.nombre + ' no es leal (' + Math.round(rebelde.lealtad) + '): pronto se rebelará. Una corte más estable o un ejército cerca la retienen.', orden: 'Más soldados' };
    if (c.sinCama > 0 && (pr.casas || 1) < 2) return { texto: 'Hay parejas que quieren tener hijos y no tienen cama: faltan casas.', orden: 'Más casas' };
    if (c.estab < 30) return { texto: 'La gente está descontenta (estabilidad ' + Math.round(c.estab) + '). La paz y un templo ayudan.', orden: S().vecinosDe(m, c).length && c.guerras.length ? 'Haced la paz' : 'Construid un templo' };
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
    '{"tipo":"regimen","a":"reino"|"imperio"|"republica"|"teocracia"|"democracia"|"dictadura","era":era_minima}; {"tipo":"colonia"} (flota al otro lado del mar, desde el Renacimiento); {"tipo":"colonos","rumbo":null|"norte"|"sur"|"este"|"oeste"|"costa"} (tres familias salen a pie a fundar una aldea); {"tipo":"construir","obra":"templo"|"torre"|"puerto"|"molino"|"cuartel"|"arqueria"|"castillo"}; {"tipo":"cuadrilla","n":numero|"todos"|0.5,"de":oficio_origen|-1,"a":oficio_destino,"hasta":plazo} (aldeanos concretos cambian de tarea; oficios: 0 leñador, 1 granjero, 2 constructor, 3 minero, 4 guerrero, 5 comerciante; -1 cualquiera); {"tipo":"cupo","o":oficio,"n":numero,"hasta":plazo} (fija cuántos hay de un oficio); {"tipo":"meta","cosa":"arboles"|"casas"|"piedra"|"madera"|"metal"|"campos"|"comida","n":numero,"o":oficio} (producir eso y volver a lo de antes); {"tipo":"liberar"} (quitar cuadrillas y cupos); plazo = null | {"ms":milisegundos} | {"turnos":n} | {"anios":n} | {"cosa":"madera"|"comida"|"piedra"|"metal"|"casas"|"arboles","n":numero,"nuevo":true_si_es_producir_n_mas}; {"tipo":"objetivo","region":r} (el ejército marcha sobre esa plaza enemiga; declara la guerra si hace falta); {"tipo":"defender","region":r} (el ejército defiende esa plaza propia; para «retirada», la capital); {"tipo":"informe"}; {"tipo":"normal"}.',
    'Responde SOLO con JSON: {"acciones":[...], "respuesta":"una o dos frases de consejero, en español, que digan qué se hace y, si la orden pedía algo imposible, por qué no"}. Sin markdown. Usa solo los id que te doy.'
  ].join('\n');
  function paraIA(m, civId, texto) {
    const c = S().civ(m, civId);
    return 'Año ' + S().anioTexto(m.anio) + '. Tu pueblo: ' + JSON.stringify({ id: c.id, nombre: c.nombre, era: M.ERAS[c.era].nombre, poblacion_miles: Math.round(c.pob), estabilidad: Math.round(c.estab), madera: Math.floor(c.madera || 0), piedra: Math.floor(c.piedra || 0), guerras_con: c.guerras.map(g => g.con), plan: c.plan || null }) +
      '\nOtros pueblos: ' + JSON.stringify(S().vivas(m).filter(o => o.id !== c.id).map(o => ({ id: o.id, nombre: o.nombre, era: M.ERAS[o.era].nombre, poblacion_miles: Math.round(o.pob), vecino: S().vecinosDe(m, c).includes(o), relacion: Math.round(c.rel[o.id] || 0) }))) +
      '\nPlazas (región, dueño): ' + JSON.stringify([...S().vivas(m).map(o => ({ region: o.capital, nombre: 'capital de ' + o.nombre, dueno: o.id })), ...(m.ciudades || []).map(x => ({ region: x.region, nombre: x.nombre, dueno: m.dueno[x.region] }))]) +
      '\n\nOrden del jugador: «' + texto + '»\n\nDevuelve solo el JSON.';
  }
  const TIPOS = new Set(['consulta', 'cuadrilla', 'cupo', 'meta', 'liberar', 'objetivo', 'defender', 'prioridad', 'expandir', 'guerra', 'paz', 'comercio', 'alianza', 'romper', 'regimen', 'colonia', 'colonos', 'construir', 'informe', 'normal']);
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
        const oficio = x => (Number.isInteger(Number(x)) && Number(x) >= -1 && Number(x) <= 5 ? Number(x) : null);
        const h = a.hasta && typeof a.hasta === 'object' ? (a.hasta.ms > 0 ? { ms: Math.min(7200000, Number(a.hasta.ms)) } : a.hasta.turnos > 0 ? { turnos: Math.min(500, Math.round(a.hasta.turnos)) } : a.hasta.anios > 0 ? { anios: Math.min(2000, Number(a.hasta.anios)) } : COSAS[a.hasta.cosa] && a.hasta.n > 0 ? { cosa: COSAS[a.hasta.cosa], n: Math.min(10000, Math.round(a.hasta.n)), nuevo: !!a.hasta.nuevo } : null) : null;
        const n = a.n === 'todos' ? 'todos' : Number(a.n) > 0 ? Math.min(500, Number(a.n)) : null;
        if (a.tipo === 'cuadrilla' && n != null && oficio(a.de) != null && oficio(a.a) >= 0) out.push({ tipo: 'cuadrilla', n, de: oficio(a.de), a: oficio(a.a), hasta: h });
        else if (a.tipo === 'cupo' && n != null && n !== 'todos' && oficio(a.o) >= 0) out.push({ tipo: 'cupo', o: oficio(a.o), n: Math.round(n), hasta: h });
        else if (a.tipo === 'meta' && n != null && n !== 'todos' && COSAS[a.cosa] && oficio(a.o) >= 0) out.push({ tipo: 'meta', cosa: COSAS[a.cosa], n: Math.round(n), o: oficio(a.o) });
      } else if (a.tipo === 'liberar' || a.tipo === 'consulta') out.push({ tipo: a.tipo });
      else if (a.tipo === 'objetivo' || a.tipo === 'defender') { if (Number.isInteger(Number(a.region)) && Number(a.region) >= 0) out.push({ tipo: a.tipo, region: Number(a.region) }); }
      else if (a.tipo === 'expandir') out.push({ tipo: 'expandir', si: a.si !== false, rumbo: ['norte', 'sur', 'este', 'oeste'].includes(a.rumbo) ? a.rumbo : Number.isFinite(Number(a.rumbo)) && a.rumbo !== null ? Number(a.rumbo) : null });
      else if (a.tipo === 'regimen') { const r = REGIMENES.find(x => x[1] === a.a); if (r) out.push({ tipo: 'regimen', a: r[1], era: r[2] }); }
      else if (['guerra', 'paz', 'comercio', 'alianza', 'romper'].includes(a.tipo)) out.push({ tipo: a.tipo, con: Number(a.con) });
      else if (a.tipo === 'colonos') out.push({ tipo: 'colonos', rumbo: ['norte', 'sur', 'este', 'oeste', 'costa'].includes(a.rumbo) ? a.rumbo : null });
      else if (a.tipo === 'construir') { if (['templo', 'torre', 'puerto', 'molino', 'cuartel', 'arqueria', 'castillo'].includes(a.obra)) out.push({ tipo: 'construir', obra: a.obra }); }
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
    return { civ: c, lista, puntos: r.puntos, extra, total: r.puntos + extra, hechos: lista.filter(x => x.hecho).length, fin: finPartida(m), puesto };
  }

  M.mando = { vencer, queda, textoPlazo, cuentaOficios, OFICIOS_N, entender, aplicar, ordenar, informe, consejo, gobernar, RETOS, evaluarRetos, estadoRetos, finPartida, SISTEMA, paraIA, aplicarIA, limpiar, NOMBRE_RECURSO, NIVEL };
})(globalThis.RF = globalThis.RF || {});
