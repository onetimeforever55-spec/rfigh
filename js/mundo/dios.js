/*
 * GÉNESIS · LA VOLUNTAD DIVINA
 * El jugador es un dios que escribe lo que quiere: "peste sobre Karenia", "que el más atrasado descubra
 * la imprenta", "guerra entre Tolmedor y Ishan", "diluvio en el norte", "que aparezca un pueblo nuevo".
 * Este módulo entiende la orden (a quién va dirigida y qué poder es), la cumple en el mundo y la deja en la
 * crónica con su porqué. Lo que no entiende se lo pasa a Claude, si está disponible (ver vista.js).
 */
(function (RF) {
  'use strict';
  const M = RF.MUNDO, S = () => M.sim;
  const T = t => t.charAt(0).toUpperCase() + t.slice(1);
  // Lo que el poder hace en el acto a los aldeanos, las casas y los campos (vida.js), si está cargada.
  const dano = (m, c, tipo, regiones) => (M.vida && m.vida ? M.vida.castigo(m, c, tipo, regiones) : null);
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- ¿A quién? ----------
  function objetivos(m, n, seleccion) {
    const vivas = S().vivas(m);
    const porNombre = vivas.map(c => ({ c, pos: n.indexOf(norm(c.nombre)) })).filter(x => x.pos >= 0).sort((a, b) => a.pos - b.pos).map(x => x.c);
    if (/\b(todos|todo el mundo|toda la humanidad|el mundo entero|la humanidad|todas partes|cada pueblo)\b/.test(n) && !porNombre.length) return vivas;
    const tam = c => S().casillas(m, c).length;
    const orden = (f, desc) => vivas.slice().sort((a, b) => (desc ? f(b) - f(a) : f(a) - f(b)));
    const pos = c => S().xy(c.capital);
    // Cada descripción ("el más grande", "el del norte"...) señala a un pueblo; se pueden juntar varias.
    const DESCRIPCIONES = [
      [/\b(mas grande|mas poderoso|mas fuerte|imperio mayor|el mayor|mas poblado)\b/, () => orden(c => S().fuerza(m, c) + tam(c), true)],
      [/\b(mas pequeno|mas debil|mas chico|el menor)\b/, () => orden(tam)],
      [/\b(mas atrasado|mas primitivo|mas pobre)\b/, () => orden(c => c.era * 1000 + c.ciencia)],
      [/\b(mas avanzado|mas sabio|mas rico)\b/, () => orden(c => c.era * 1000 + c.ciencia, true)],
      [/\b(del norte|al norte|en el norte|nortenos?|septentrional)\b/, () => orden(c => pos(c)[1])],
      [/\b(del sur|al sur|en el sur|surenos?|meridional)\b/, () => orden(c => pos(c)[1], true)],
      [/\b(del este|al este|en el este|oriente|oriental)\b/, () => orden(c => pos(c)[0], true)],
      [/\b(del oeste|al oeste|en el oeste|occidente|occidental|poniente)\b/, () => orden(c => pos(c)[0])]
    ];
    const hallados = porNombre.map(c => ({ c, pos: n.indexOf(norm(c.nombre)) }));
    for (const [re, f] of DESCRIPCIONES) {
      const mt = n.match(re);
      if (!mt) continue;
      const c = f().find(x => !hallados.some(h => h.c === x));
      if (c) hallados.push({ c, pos: mt.index });
    }
    if (/\b(mas belicoso|mas guerrero|los guerreros)\b/.test(n)) for (const c of vivas.filter(c => c.caracter === 'guerrero').slice(0, 2)) if (!hallados.some(h => h.c === c)) hallados.push({ c, pos: 999 });
    if (hallados.length) return hallados.sort((a, b) => a.pos - b.pos).map(h => h.c);
    if (seleccion != null) { const c = S().civ(m, seleccion); if (c && c.viva) return [c]; }
    return [];
  }

  // ---------- Los poderes ----------
  // Cada poder: cómo se reconoce, cuántos objetivos necesita y qué hace. Devuelve el suceso de la crónica.
  const PODERES = [
    {
      id: 'guerra', re: /\b(guerra|ataque|ataquen|invada|invadan|conquiste|conquisten|luchen|peleen|se enfrenten|batalla)\b/, minimo: 2,
      hacer: (m, cs) => { S().declararGuerra(m, cs[0], cs[1], 'Una voz que nadie más oye le susurra al rey de ' + cs[0].nombre + ' que ' + cs[1].nombre + ' trama algo. A la mañana siguiente, sus ejércitos cruzan la frontera.'); return m.ultimo; }
    },
    {
      id: 'paz', re: /\b(paz|tregua|armisticio|reconcili\w*|dejen de pelear|amistad)\b/, minimo: 1,
      hacer: (m, cs) => {
        let hecho = null;
        for (const a of cs) for (const g of a.guerras.slice()) { const b = S().civ(m, g.con); if (b && (cs.length === 1 || cs.includes(b))) { S().hacerPaz(m, a, b, 'Un sueño idéntico visita la misma noche a los dos reyes: ven sus ciudades en ruinas. Al amanecer, firman la paz.'); hecho = m.ultimo; } }
        for (const a of cs) for (const b of cs) if (a.id < b.id) { a.rel[b.id] = b.rel[a.id] = Math.max(a.rel[b.id] || 0, 40); }
        return hecho || S().cronica(m, 'paz', 'Una paz bendecida', 'Los pueblos elegidos sienten de pronto un cariño inexplicable por sus vecinos. Los mercaderes lo aprovechan antes que nadie.', cs[0]);
      }
    },
    {
      id: 'unificar', re: /\b(unif\w*|fusion\w*|se unan|unanse|unir|juntar|un solo pueblo|un solo reino)\b/, minimo: 2,
      hacer: (m, cs) => {
        const [mayor, ...resto] = cs.slice().sort((a, b) => S().casillas(m, b).length - S().casillas(m, a).length);
        for (const c of resto) { for (const i of S().casillas(m, c)) m.dueno[i] = mayor.id; mayor.pob += c.pob; mayor.ciencia = Math.max(mayor.ciencia, c.ciencia); mayor.era = Math.max(mayor.era, c.era); c.viva = false; c.muerte = m.anio; }
        for (const o of m.civs) o.guerras = o.guerras.filter(g => !resto.some(c => c.id === g.con));
        mayor.estab = Math.max(25, mayor.estab - 15);
        mayor.regimen = S().regimenPorEra(m, mayor, S().casillas(m, mayor).length);
        return S().cronica(m, 'unificacion', 'Nace un solo pueblo', resto.map(c => c.nombre).join(' y ') + ' se unen a ' + mayor.nombre + ' por voluntad de los cielos. Hay un solo rey, una sola moneda y mil quejas en diez lenguas distintas.', mayor, null, { importante: true });
      }
    },
    {
      id: 'invento', re: /\b(descubr\w*|invent\w*|regal\w*|ensen\w*|aprend\w*|den |dale |darle|conozcan|tengan)\b/, minimo: 1, invento: true,
      hacer: (m, cs, n) => {
        const inv = M.INVENTOS.find(([re]) => re.test(n));
        if (!inv) return null;
        const [, era, nombre] = inv;
        let e = null;
        for (const c of cs) {
          const salto = era - c.era;
          if (salto <= 0) { c.ciencia += 40; e = S().cronica(m, 'era', c.nombre + ' ya conocía ' + nombre, 'Los sabios de ' + c.nombre + ' reciben la revelación con educación y un poco de aburrimiento: ' + nombre + ' ya la usaban. Aun así, la perfeccionan.', c); continue; }
          // Un salto de más de una era: el invento llega, pero la sociedad no está preparada.
          while (c.era < era - 1) { c.era++; c.inventos.push(M.ERAS[c.era].inventos[0]); }
          c.ciencia = Math.max(c.ciencia, M.ERAS[era].umbral);
          S().subirEra(m, c, nombre);
          if (salto >= 2) {
            c.estab -= 10 * (salto - 1);
            e = S().cronica(m, 'anacronismo', nombre.charAt(0).toUpperCase() + nombre.slice(1) + ' en ' + c.nombre, 'Un pueblo que ayer vivía en ' + M.ERAS[era - salto].con + ' amanece con ' + nombre + '. Nadie sabe muy bien qué hacer con ' + (nombre.startsWith('las ') || nombre.startsWith('los ') ? 'ellos' : 'ello') + ', y los sacerdotes lo declaran obra del demonio o de los dioses, según el día.', c);
          } else e = m.ultimo;
          if (era === 8) for (const o of S().vivas(m)) if (o !== c) o.rel[c.id] = c.rel[o.id] = Math.min((o.rel[c.id] || 0), -20);
        }
        return e;
      }
    },
    {
      id: 'plaga', re: /\b(plaga|peste|epidemia|enfermedad|virus|viruela|colera|lepra|pandemia|gripe)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { dano(m, c, 'plaga'); S().plaga(m, c, 0.3, 'Una peste cae del cielo sobre ' + c.nombre + ' como castigo divino. Los sacerdotes rezan; los médicos sangran a los enfermos; los dos tienen el mismo éxito.'); e = m.cronica.find(x => x.civ === c.id); } return e; }
    },
    {
      id: 'hambre', re: /\b(hambruna|hambre|sequia|langosta\w*|malas cosechas|que no llueva)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { c.efectos.push({ comida: 0.55, estab: -6, hasta: m.turno + 4 }); c.estab -= 8; c.pob *= 0.85; dano(m, c, 'hambre'); e = S().cronica(m, 'hambruna', 'Sequía en ' + c.nombre, 'Durante años no cae una gota sobre ' + c.nombre + '. Los ríos bajan, los campos se agrietan y los profetas del fin del mundo hacen su agosto.', c); } return e; }
    },
    {
      id: 'oro', re: /\b(oro|plata|tesoro|riquezas|diamantes|joyas|dinero del cielo)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { c.riqueza += 150; c.efectos.push({ estab: -4, hasta: m.turno + 6 }); c.ciencia *= 0.97; e = S().cronica(m, 'oro', 'Llueve oro sobre ' + c.nombre, 'Aparecen vetas de oro en las montañas de ' + c.nombre + '. Los nobles se compran sedas; los artesanos, que ya no hacen falta, se compran nada. Los precios suben y suben.', c); } return e; }
    },
    {
      id: 'diluvio', re: /\b(diluvio|inundaci\w*|tsunami|maremoto|crecida|lluvia torrencial|que llueva)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { c.pob *= 0.82; c.estab -= 8; dano(m, c, 'diluvio'); c.efectos.push({ comida: 1.35, hasta: m.turno + 6 }); e = S().cronica(m, 'diluvio', 'Diluvio sobre ' + c.nombre, 'Llueve cuarenta días. Las aguas se llevan aldeas, puentes y algún templo. Cuando bajan, dejan los campos cubiertos de un barro negro y fértil.', c); } return e; }
    },
    {
      id: 'terremoto', re: /\b(terremoto|seismo|sismo|volcan|erupcion|meteor\w*|asteroide|rayo|fuego del cielo|lluvia de fuego|cometa)\b/, minimo: 1,
      hacer: (m, cs, n) => {
        let e = null;
        for (const c of cs) {
          const cs2 = S().casillas(m, c).sort((a, b) => S().distancia(a, c.capital) - S().distancia(b, c.capital));
          const destruidas = cs2.slice(0, /meteor|asteroide|cometa/.test(n) ? 4 : 2);
          dano(m, c, 'terremoto', cs2.slice(0, 8));
          for (const i of destruidas) if (i !== c.capital || destruidas.length < cs2.length) { m.dueno[i] = -1; if (m.tipo[i] !== 'montana') m.tipo[i] = 'desierto'; }
          c.pob *= 0.75; c.estab -= 15;
          if (!S().casillas(m, c).length) { S().morir(m, c, null); e = m.ultimo; continue; }
          e = S().cronica(m, 'terremoto', (/volcan|erupcion/.test(n) ? 'Erupción en ' : /meteor|asteroide|cometa/.test(n) ? 'Cae una estrella sobre ' : 'Terremoto en ') + c.nombre, 'La tierra se abre bajo la capital de ' + c.nombre + '. Donde había campos queda ceniza; donde había templos, la pregunta de qué han hecho para merecerlo.', c, destruidas[0]);
        }
        return e;
      }
    },
    {
      id: 'incendio', re: /\b(incendi\w*|fuego|quem\w*|arda|ardan|llamas)\b/, minimo: 1,
      hacer: (m, cs) => {
        let e = null;
        for (const c of cs) {
          const n = M.vida ? M.vida.incendio(m, c) : 0;
          c.pob *= 0.93; c.estab -= 8;
          e = S().cronica(m, 'incendio', 'Arde ' + c.nombre, 'Un fuego que nadie sabe quién encendió corre por los bosques y las aldeas de ' + c.nombre + (n ? ': se lleva unos ' + n + ' árboles, graneros y tejados.' : '.') + ' Los leñadores, por una vez, no tienen trabajo.', c);
        }
        return e;
      }
    },
    {
      id: 'bosque', re: /\b(bosques?|arbol\w*|selvas?|plant\w*|reforest\w*)\b/, minimo: 1,
      hacer: (m, cs, n) => {
        let e = null;
        const talar = /\b(tal\w*|cort\w*|derrib\w*)\b/.test(n);
        for (const c of cs) {
          const regiones = S().casillas(m, c);
          if (talar) {
            let troncos = 0;
            const v = m.vida;
            if (v) for (const r of regiones) for (const t of M.vida.parcelas(m, r)) if (v.arbol[t] >= 2 && S().azar(m) < 0.8) { v.cambios.push([0, t, v.arbol[t], 0, 0]); v.arbol[t] = 0; troncos++; }
            c.madera = (c.madera || 0) + troncos * 2; c.riqueza += troncos * 0.2;
            if (M.vida) M.vida.contar(m);
            e = S().cronica(m, 'tala', c.nombre + ' tala sus bosques', 'Por orden de los cielos, ' + c.nombre + ' corta ' + (troncos ? 'unos ' + troncos + ' árboles' : 'los pocos árboles que le quedaban') + '. Hay madera para barcos, casas y hogueras durante años; lo que no habrá es sombra.', c);
          } else {
            const n2 = M.vida ? M.vida.plantar(m, regiones) : 0;
            c.estab += 3;
            e = S().cronica(m, 'reforestacion', 'Brotan bosques en ' + c.nombre, 'De la noche a la mañana crecen ' + (n2 ? 'unos ' + n2 + ' árboles' : 'árboles') + ' en las tierras de ' + c.nombre + '. Los leñadores no se lo creen; los granjeros, tampoco, pero por otros motivos.', c);
          }
        }
        return e;
      }
    },
    {
      id: 'bendicion', re: /\b(bendi\w*|cosecha|abundancia|fertil\w*|prosper\w*|riqueza de tierras|que crezca|que florezca|salud)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { c.efectos.push({ comida: 1.6, estab: 5, hasta: m.turno + 8 }); c.estab += 8; e = S().cronica(m, 'abundancia', 'Los cielos bendicen a ' + c.nombre, 'Las cosechas se doblan, las vacas paren gemelos y los niños nacen sanos. En ' + c.nombre + ' se levantan templos nuevos para dar las gracias, por si acaso.', c); } return e; }
    },
    {
      id: 'locura', re: /\b(rey|reina|lider|gobernante|emperador|faraon|jefe)\b.*\b(loco|locura|enloquezca|muera|muerte|enferme|se vuelva)\b|\b(loco|locura|enloquezca|muera)\b.*\b(rey|reina|lider|gobernante|emperador|faraon|jefe)\b/, minimo: 1,
      hacer: (m, cs, n) => {
        let e = null;
        for (const c of cs) {
          c.estab -= 25;
          const loco = /loc|enloquezca/.test(n);
          e = S().cronica(m, 'locura', loco ? 'El gobernante de ' + c.nombre + ' enloquece' : 'Muere el gobernante de ' + c.nombre, loco ? 'Un día anuncia que es de cristal y no deja que nadie lo toque. Al siguiente nombra general a su caballo. La corte se divide entre los que le siguen la corriente y los que afilan cuchillos.' : 'Muere sin heredero claro. Tres primos, dos generales y una viuda reclaman el trono a la vez.', c);
          if (S().casillas(m, c).length >= 8 && S().azar(m) < 0.6) S().separar(m, c, S().casillas(m, c));
        }
        return e;
      }
    },
    {
      id: 'profeta', re: /\b(profeta|religion|dios nuevo|nueva fe|mesias|iglesia|culto|que crean en mi|adoren|me adoren)\b/, minimo: 1,
      hacer: (m, cs) => {
        let e = null;
        for (const c of cs) {
          c.caracter = 'devoto'; c.estab = Math.min(100, c.estab + 15); c.ciencia *= 0.92;
          if (c.era >= 1 && c.era <= 4) c.regimen = 'teocracia';
          for (const v of S().vivas(m)) if (v !== c && v.caracter !== 'devoto') v.rel[c.id] = c.rel[v.id] = (v.rel[c.id] || 0) - 20;
          e = S().cronica(m, 'profeta', 'Un profeta en ' + c.nombre, 'Un pastor baja del monte diciendo que ha hablado contigo. Lo curioso es que es verdad. En una generación, todo ' + c.nombre + ' reza en tu nombre, y mira con desconfianza a los vecinos que no lo hacen.', c, null, { importante: true });
        }
        return e;
      }
    },
    {
      id: 'regimen', re: /\b(revoluci\w*|republica|democracia|dictadura|imperio|monarquia|teocracia|derroquen|caiga el rey|tiran\w*)\b/, minimo: 1,
      hacer: (m, cs, n) => {
        let e = null;
        for (const c of cs) {
          const destino = /democracia/.test(n) ? (c.era >= 5 ? 'democracia' : 'republica') : /republica|revoluci|derroquen|caiga el rey/.test(n) ? 'republica' : /dictadura|tiran/.test(n) ? 'dictadura' : /imperio/.test(n) ? 'imperio' : /teocracia/.test(n) ? 'teocracia' : 'reino';
          const antes = c.regimen;
          c.regimen = destino; c.estab -= 12;
          if (destino === 'republica' || destino === 'democracia') { c.ciencia += 30; c.caracter = c.caracter === 'guerrero' ? 'mercader' : c.caracter; }
          if (destino === 'dictadura') c.caracter = 'guerrero';
          e = S().cronica(m, destino === 'dictadura' ? 'dictadura' : destino === 'republica' || destino === 'democracia' ? 'revolucion' : 'revolucion', 'Revolución en ' + c.nombre, T(M.conArticulo(antes)) + ' de ' + c.nombre + ' cae: el pueblo asalta el palacio y proclama ' + M.unoDe(destino) + '. Los antiguos nobles descubren que el exilio también tiene su encanto.', c, null, { importante: true });
        }
        return e;
      }
    },
    {
      id: 'nuevo', re: /\b(nuevo pueblo|nueva tribu|crea\w* (un|una) (pueblo|tribu|civilizacion|reino)|que aparezca|nazca|nomadas|barbaros|que surja)\b/, minimo: 0,
      hacer: (m, cs) => { const c = S().nuevoPueblo(m, cs[0] ? cs[0].capital : null); return c ? m.ultimo : S().cronica(m, 'nuevo_pueblo', 'No queda sitio', 'Buscas tierra libre para un pueblo nuevo, pero no queda ni un valle sin dueño.', null); }
    },
    {
      id: 'matar', re: /\b(mata\w*|masacr\w*|que mueran?|muera la mitad|genocid\w*|asesin\w*|diezm\w*|extermin\w* a la mitad)\b/, minimo: 1,
      hacer: (m, cs) => {
        let e = null;
        for (const c of cs) {
          const r = dano(m, c, 'matar');
          c.pob *= 0.5; c.estab -= 20;
          e = S().cronica(m, 'plaga', 'La mano de los cielos cae sobre ' + c.nombre, 'Muere la mitad de ' + c.nombre + ' en una sola noche' + (r && r.muertos ? ': ' + r.muertos + ' aldeanos no vuelven a casa' : '') + '. Los que quedan no saben si rezar más o rezar menos.', c, null, { importante: true });
        }
        return e;
      }
    },
    {
      id: 'potenciar', re: /\b(mas fuertes?|poderos\w*|fortalec\w*|tecnologia|avanc\w*|avanz\w*|progres\w*|ayud\w*|crezca|que prospere|mejor\w*|ensen\w*)\b/, minimo: 1,
      hacer: (m, cs) => {
        let e = null;
        for (const c of cs) {
          const sig = M.ERAS[c.era + 1];
          if (sig) c.ciencia += (sig.umbral - M.ERAS[c.era].umbral) * 0.5 + 10;
          if (sig && c.ciencia >= sig.umbral) S().subirEra(m, c, null);
          c.estab = Math.min(100, c.estab + 10); c.riqueza += 60; c.pob *= 1.1; c.madera = (c.madera || 0) + 30; c.piedra = (c.piedra || 0) + 10;
          e = S().cronica(m, 'abundancia', 'Los cielos favorecen a ' + c.nombre, 'Los sabios de ' + c.nombre + ' tienen ideas, los herreros aciertan con el temple y los graneros se llenan. Los vecinos empiezan a mirarlos con envidia.', c);
        }
        return e;
      }
    },
    {
      id: 'destruir', re: /\b(destru\w*|aniquil\w*|borra\w*|extermin\w*|elimin\w*|arrasa\w*|que desaparezca)\b/, minimo: 1,
      hacer: (m, cs) => { let e = null; for (const c of cs) { dano(m, c, 'destruir'); for (const i of S().casillas(m, c)) if (S().azar(m) < 0.7) m.dueno[i] = -1; c.pob *= 0.3; c.estab = 10; if (!S().casillas(m, c).length) S().morir(m, c, null); else S().cronica(m, 'destruccion', 'La ira de los cielos sobre ' + c.nombre, 'Fuego, agua y tierra se ponen de acuerdo por una vez. De ' + c.nombre + ' quedan unas pocas aldeas y un miedo que durará generaciones.', c, null, { importante: true }); e = m.ultimo; } return e; }
    }
  ];

  /*
   * Cumple una orden divina. Devuelve { ok, suceso } si la entendió, o { ok: false, motivo } si no
   * (falta a quién, o no se reconoce el poder: entonces la vista puede preguntarle a Claude).
   */
  const BUENOS = new Set(['paz', 'invento', 'bendicion', 'potenciar', 'bosque', 'oro', 'profeta']);
  function obrar(m, texto, seleccion) {
    const n = norm(texto);
    if (!n) return { ok: false, motivo: 'vacio' };
    for (const P of PODERES) {
      if (!P.re.test(n)) continue;
      if (P.invento && !M.INVENTOS.some(([re]) => re.test(n))) continue;
      let cs = objetivos(m, n, seleccion);
      if (P.minimo === 2 && cs.length === 1 && seleccion != null && cs[0].id !== seleccion) cs = [S().civ(m, seleccion), cs[0]].filter(c => c && c.viva);
      // Sin nombrar a nadie ni tener un pueblo elegido: lo bueno es para todos, lo malo cae sobre el más grande.
      let porDefecto = null;
      if (!cs.length && P.minimo === 1 && S().vivas(m).length) {
        if (BUENOS.has(P.id)) { cs = S().vivas(m); porDefecto = 'todos'; }
        else { cs = objetivos(m, 'el mas grande', null); porDefecto = 'grande'; }
      }
      if (cs.length < P.minimo) return { ok: false, motivo: P.minimo === 2 ? 'faltan_dos' : 'falta_quien', poder: P.id };
      const suceso = P.hacer(m, cs, n);
      if (!suceso) continue;
      suceso.divino = true;
      return { ok: true, poder: P.id, suceso, objetivos: cs.map(c => c.id), porDefecto };
    }
    return { ok: false, motivo: 'no_entiendo' };
  }

  // ---------- Lo que decida Claude, con límites ----------
  const tope = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  function aplicarIA(m, f) {
    if (!f || f.entendido === false) return null;
    const vivas = S().vivas(m);
    const porId = id => vivas.find(c => c.id === Number(id) || norm(c.nombre) === norm(id));
    for (const ef of Array.isArray(f.efectos) ? f.efectos.slice(0, 8) : []) {
      const c = porId(ef.civ);
      if (!c) continue;
      if (ef.poblacion) c.pob *= 1 + tope(ef.poblacion, -60, 60) / 100;
      if (ef.estabilidad) c.estab = tope(c.estab + tope(ef.estabilidad, -40, 40), 0, 100);
      if (ef.riqueza) c.riqueza = Math.max(0, c.riqueza + tope(ef.riqueza, -150, 150));
      if (ef.ciencia) c.ciencia = Math.max(0, c.ciencia + tope(ef.ciencia, -200, 400));
      if (ef.era) { const objetivo = tope(c.era + Math.round(tope(ef.era, -1, 2)), 0, M.ERAS.length - 1); while (c.era < objetivo) S().subirEra(m, c, null); if (objetivo < c.era) c.era = objetivo; }
      if (ef.regimen && M.REGIMENES[ef.regimen]) c.regimen = ef.regimen;
      if (ef.caracter && M.CARACTERES[ef.caracter]) c.caracter = ef.caracter;
      if (ef.comida) c.efectos.push({ comida: tope(1 + ef.comida / 100, 0.3, 2), hasta: m.turno + 5 });
    }
    for (const [a, b] of Array.isArray(f.guerra) ? f.guerra.slice(0, 3) : []) { const x = porId(a), y = porId(b); if (x && y && x !== y) S().declararGuerra(m, x, y, null); }
    for (const [a, b] of Array.isArray(f.paz) ? f.paz.slice(0, 3) : []) { const x = porId(a), y = porId(b); if (x && y && S().enGuerra(x, y)) S().hacerPaz(m, x, y, null); }
    if (f.nuevo_pueblo) S().nuevoPueblo(m, null);
    const c = porId((f.efectos && f.efectos[0] && f.efectos[0].civ) || -1);
    const e = S().cronica(m, 'divino', String(f.titulo || 'La voluntad de los cielos').slice(0, 80), String(f.texto || '').slice(0, 600), c || null, null, { divino: true, porque: f.porque ? String(f.porque).slice(0, 300) : null, precedente: f.precedente ? String(f.precedente).slice(0, 300) : null, importante: true });
    return e;
  }

  const SISTEMA = [
    'Eres el Destino en "Génesis", un juego en el que el jugador es un dios que observa un mundo de pueblos inventados que viven la historia humana real (de la Edad de Piedra a la era atómica) y que interviene escribiendo lo que quiere que pase.',
    'Te llega el mundo (los pueblos con su id, era, población en miles, estabilidad 0-100, régimen, carácter y guerras) y la voluntad del dios. Cúmplela de forma coherente con la época de cada pueblo y con la historia real: si pide algo anacrónico, llega, pero la sociedad no sabe usarlo del todo.',
    'Responde SOLO con un JSON: {"entendido": true, "titulo": "titular corto", "texto": "dos o tres frases en tono de crónica satírica de historia, en pasado o presente", "porque": "el mecanismo real que explica las consecuencias, en una frase", "precedente": "un hecho histórico real parecido, en una frase", "efectos": [{"civ": id, "poblacion": % (-60 a 60), "estabilidad": (-40 a 40), "riqueza": (-150 a 150), "ciencia": (-200 a 400), "era": (-1 a 2), "comida": % (-70 a 100), "regimen": null|"tribu"|"jefatura"|"reino"|"imperio"|"republica"|"teocracia"|"democracia"|"dictadura", "caracter": null|"guerrero"|"mercader"|"devoto"|"sabio"}], "guerra": [[id, id]], "paz": [[id, id]], "nuevo_pueblo": false}.',
    'Si la voluntad no se entiende en absoluto, pon "entendido": false. Sin markdown. Usa solo los id que te doy.'
  ].join('\n');

  function paraIA(m, texto) {
    return 'Año ' + S().anioTexto(m.anio) + '. Pueblos: ' + JSON.stringify(S().resumen(m).map(c => ({ id: c.id, nombre: c.nombre, era: c.eraNombre, poblacion_miles: Math.round(c.pob), estabilidad: Math.round(c.estab), regimen: c.regimen, caracter: c.caracter, tierras: c.tierras, guerras_con: c.guerras }))) +
      '\nÚltimos sucesos: ' + m.cronica.slice(0, 6).map(e => S().anioTexto(e.anio) + ' ' + e.titulo).join('; ') + '\n\nVoluntad del dios: «' + texto + '»\n\nDevuelve solo el JSON.';
  }

  const CRONISTA = 'Eres el cronista de "Génesis", un mundo de pueblos inventados que viven la historia humana real. Escribe un párrafo de historia (80-130 palabras), con el tono de un manual de historia escrito por alguien con mucho sentido del humor y ninguna paciencia con los reyes. Resume la época a partir de los sucesos que te dan, une causas y consecuencias y termina con una frase que dé que pensar. Sin títulos, sin listas, sin markdown. No inventes sucesos que no estén en los datos.';

  M.dios = { obrar, objetivos, aplicarIA, SISTEMA, paraIA, CRONISTA, norm, PODERES };
})(globalThis.RF = globalThis.RF || {});
