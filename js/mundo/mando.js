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

  // ¿A qué otro pueblo se refiere la orden? Por nombre o por descripción, nunca a uno mismo.
  function otro(m, c, n) {
    const lista = D().objetivos(m, n, null).filter(o => o.id !== c.id);
    return lista[0] || null;
  }
  function vecinoMasDebil(m, c) {
    return S().vecinosDe(m, c).filter(o => o.id !== c.id).sort((a, b) => S().fuerza(m, a) - S().fuerza(m, b))[0] || null;
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
    if (Object.keys(cambios).length) acciones.push({ tipo: 'prioridad', cambios, solo: solo || undefined });
    if (/\b(cruz\w* el mar|ultramar|colonia|barcos?|flota|navega\w*)\b/.test(n)) acciones.push({ tipo: 'colonia' });
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
      else if (a.tipo === 'normal') { p.prioridad = PRIO_NORMAL(); p.rumbo = null; p.expandir = true; textos.push('Todas las prioridades vuelven a normal: tu pueblo se gobierna solo, como los demás.'); }
      else if (a.tipo === 'prioridad') {
        const pr = p.prioridad, tocados = Object.keys(a.cambios);
        if (a.solo) for (const k of Object.keys(pr)) if (!tocados.includes(k) && k !== 'expansion') pr[k] = Math.min(pr[k], 0.5);
        for (const k of tocados) { const ch = a.cambios[k]; pr[k] = Math.max(0, Math.min(2, ch.a != null ? ch.a : (pr[k] != null ? pr[k] : 1) + ch.mas)); }
        textos.push('Prioridades: ' + tocados.map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k])).join(', ') + (a.solo ? ' (lo demás, baja)' : '') + '. Tu gente se reorganiza sola según eso.');
      }
      else if (a.tipo === 'expandir') {
        p.expandir = a.si; p.rumbo = a.si ? (a.rumbo == null ? null : a.rumbo) : null;
        p.prioridad.expansion = a.si ? Math.max(1, p.prioridad.expansion) : 0;
        const destino = typeof p.rumbo === 'number' ? (S().civ(m, p.rumbo) || {}).nombre : p.rumbo;
        textos.push(a.si ? 'Los colonos salen ' + (destino ? 'hacia ' + (typeof p.rumbo === 'number' ? destino : 'el ' + destino) : 'hacia las mejores tierras libres') + '. Cada tierra nueva cuesta 3 de madera (tienes ' + Math.floor(c.madera || 0) + ').' : 'Tu pueblo deja de expandirse y se queda en sus fronteras.');
      } else if (a.tipo === 'guerra') {
        if (!o || !o.viva || o.id === c.id) { textos.push('¿Contra quién? Nombra al pueblo («atacad a ' + ((S().vivas(m).find(x => x.id !== c.id) || {}).nombre || 'Karenia') + '»).'); continue; }
        if (S().enGuerra(c, o)) { textos.push('Ya estáis en guerra con ' + o.nombre + '.'); continue; }
        S().declararGuerra(m, c, o, 'Por orden de su gobierno, ' + c.nombre + ' declara la guerra a ' + o.nombre + '. Los heraldos recorren las aldeas llamando a los hombres a las armas.');
        p.guerrasMias = [...new Set([...p.guerrasMias, o.id])];
        const frontera = S().vecinosDe(m, c).includes(o);
        textos.push('¡Guerra contra ' + o.nombre + '! Tus guerreros marchan a la frontera.' + (frontera ? '' : ' Ojo: no tenéis frontera común, así que no podrán llegar hasta que la haya.'));
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
        if (c.era < a.era) { textos.push('Tu pueblo no está preparado para eso: hace falta llegar a ' + M.ERAS[a.era].con + '.'); continue; }
        if (c.regimen === a.a) { textos.push('Ya sois ' + M.unoDe(a.a) + '.'); continue; }
        const antes = c.regimen;
        c.regimen = a.a; c.estab = Math.max(0, c.estab - 15);
        if (a.a === 'republica' || a.a === 'democracia') c.ciencia += 20;
        S().cronica(m, 'revolucion', c.nombre + ' cambia de gobierno', T(M.conArticulo(antes)) + ' de ' + c.nombre + ' da paso a ' + M.unoDe(a.a) + '. Unos celebran en las plazas; otros esconden la plata.', c, null, { importante: true });
        textos.push('Proclamada ' + M.unoDe(a.a) + '. La estabilidad cae un poco mientras la gente se acostumbra.');
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

  function informe(m, c) {
    const lista = S().vivas(m).slice().sort((a, b) => S().casillas(m, b).length - S().casillas(m, a).length);
    const puesto = lista.indexOf(c) + 1, p = c.plan || {};
    const enemigos = c.guerras.map(g => S().civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    const pr = (c.plan && c.plan.prioridad) || {};
    const cambiadas = Object.keys(pr).filter(k => pr[k] !== 1).map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k]));
    return c.nombre + ', ' + M.ERAS[c.era].nombre + ': puesto ' + puesto + ' de ' + lista.length + ' en tierras (' + S().casillas(m, c).length + '), ' + Math.round(c.pob) + ' mil habitantes, estabilidad ' + Math.round(c.estab) + ', madera ' + Math.floor(c.madera || 0) + ', piedra ' + Math.floor(c.piedra || 0) + '. ' +
      (enemigos.length ? 'En guerra con ' + enemigos.join(', ') + '. ' : 'En paz. ') + (cambiadas.length ? 'Prioridades: ' + cambiadas.join(', ') + '.' : 'Todas las prioridades en normal.');
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
    '{"tipo":"regimen","a":"reino"|"imperio"|"republica"|"teocracia"|"democracia"|"dictadura","era":era_minima}; {"tipo":"colonia"}; {"tipo":"informe"}; {"tipo":"normal"}.',
    'Responde SOLO con JSON: {"acciones":[...], "respuesta":"una o dos frases de consejero, en español, que digan qué se hace y, si la orden pedía algo imposible, por qué no"}. Sin markdown. Usa solo los id que te doy.'
  ].join('\n');
  function paraIA(m, civId, texto) {
    const c = S().civ(m, civId);
    return 'Año ' + S().anioTexto(m.anio) + '. Tu pueblo: ' + JSON.stringify({ id: c.id, nombre: c.nombre, era: M.ERAS[c.era].nombre, poblacion_miles: Math.round(c.pob), estabilidad: Math.round(c.estab), madera: Math.floor(c.madera || 0), piedra: Math.floor(c.piedra || 0), guerras_con: c.guerras.map(g => g.con), plan: c.plan || null }) +
      '\nOtros pueblos: ' + JSON.stringify(S().vivas(m).filter(o => o.id !== c.id).map(o => ({ id: o.id, nombre: o.nombre, era: M.ERAS[o.era].nombre, poblacion_miles: Math.round(o.pob), vecino: S().vecinosDe(m, c).includes(o), relacion: Math.round(c.rel[o.id] || 0) }))) +
      '\n\nOrden del jugador: «' + texto + '»\n\nDevuelve solo el JSON.';
  }
  const TIPOS = new Set(['prioridad', 'expandir', 'guerra', 'paz', 'comercio', 'alianza', 'romper', 'regimen', 'colonia', 'informe', 'normal']);
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
      } else if (a.tipo === 'expandir') out.push({ tipo: 'expandir', si: a.si !== false, rumbo: ['norte', 'sur', 'este', 'oeste'].includes(a.rumbo) ? a.rumbo : Number.isFinite(Number(a.rumbo)) && a.rumbo !== null ? Number(a.rumbo) : null });
      else if (a.tipo === 'regimen') { const r = REGIMENES.find(x => x[1] === a.a); if (r) out.push({ tipo: 'regimen', a: r[1], era: r[2] }); }
      else if (['guerra', 'paz', 'comercio', 'alianza', 'romper'].includes(a.tipo)) out.push({ tipo: a.tipo, con: Number(a.con) });
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
    if (c && c.viva) { c.jugador = true; plan(c); }
    return c;
  }

  M.mando = { entender, aplicar, ordenar, informe, gobernar, SISTEMA, paraIA, aplicarIA, limpiar, NOMBRE_RECURSO, NIVEL };
})(globalThis.RF = globalThis.RF || {});
