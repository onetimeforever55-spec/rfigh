  // ── GÉNESIS · EL MANDO · Aplicar las órdenes especiales y el informe de la banca ──

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
      if (a.cual === 'aviones' && !M.vida.AVIACION) { textos.push('Los aviones están desactivados por ahora, hasta que haya defensas antiaéreas. Para la guerra moderna tenéis tanques, artillería, trincheras y búnkeres en la frontera.'); return; }
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
    if (a.tipo === 'anexar') {
      if (!o || !o.viva || o.id === c.id) { textos.push('¿A quién? Di «anexionad» y el nombre del reino.'); return; }
      const ratio = S().fuerza(m, c) / Math.max(0.1, S().fuerza(m, o)), tierras = S().casillas(m, o).length, ciudades = (m.ciudades || []).filter(x => x.civ === o.id).length;
      const g = c.guerras.find(x => x.con === o.id);
      // Si está perdido (mucho más débil, casi sin tierras o agotado de la guerra), se rinde sin condiciones.
      // Ante un ejército cinco veces mayor, se rinde sin luchar.
      if ((g && (ratio > 3 || (tierras <= 3 && !ciudades) || (g.cansancio > 6 && ratio > 1.5))) || ratio > 5) {
        S().morir(m, o, c);
        if (M.vida && m.vida) M.vida.reasignar(m, c, null, true);
        an('👑 ¡' + o.nombre + ' es vuestro!', o.capital);
        textos.push(o.nombre + ' se rinde sin condiciones: el reino deja de existir y sus tierras, sus ciudades y su gente pasan a ser vuestras. Esas tierras os serán fieles: no se rebelarán enseguida.');
        return;
      }
      if (!g) { S().declararGuerra(m, c, o, 'Por orden de su gobierno, ' + c.nombre + ' declara la guerra a ' + o.nombre + ' para anexionarse todo su reino.'); p.guerrasMias = [...new Set([...(p.guerrasMias || []), o.id])]; if (M.vida && m.vida) M.vida.reasignar(m, c, null, true); }
      p.anexar = o.id; p.objetivo = o.capital; p.defender = null;
      if (v && v.ejercitos) delete v.ejercitos[c.id];
      an('👑 ¡A por todo ' + o.nombre + '!', o.capital);
      textos.push('Vuestro ejército irá a por ' + o.nombre + ' plaza por plaza, empezando por su capital, hasta que el reino deje de existir. Si en algún momento está perdido, repetid la orden y se rendirá sin condiciones.' + (ratio < 1 ? ' Ojo: ahora mismo son más fuertes que vosotros.' : ''));
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
    if (a.tipo === 'interes') {
      if (!(c.bancos > 0)) { textos.push('Aún no tenéis banco central: el edificio llega con el Renacimiento (y una villa o ciudad). «Construid un banco central».'); return; }
      p.interes = [0.5, 1, 1.5].includes(a.nivel) ? a.nivel : 1;
      an('🏦 Interés ' + (p.interes === 0.5 ? 'bajo' : p.interes === 1.5 ? 'alto' : 'normal'));
      textos.push(p.interes === 0.5 ? 'Interés bajo: el banco prestará más y a más gente, y saldrán más negocios; también habrá más quiebras.' : p.interes === 1.5 ? 'Interés alto: pocos préstamos y seguros; el banco gana más con cada uno.' : 'Interés normal: préstamos a un ritmo prudente.');
      return;
    }
    if (a.tipo === 'consulta_banca') { textos.push(informeBanca(m, c)); return; }
    if (a.tipo === 'banco_central') {
      if (!(c.bancos > 0) || !c.banca) { textos.push('Aún no tenéis banco central: «construid un banco central» (desde el Renacimiento, con una villa o ciudad).'); return; }
      const q = M.vida.moverAlBanco(c, a.al === 'tesoro' ? -Math.abs(a.oro || 30) : Math.abs(a.oro || 30));
      an(q >= 0 ? '🏦 Al banco central' : '🏦 Al tesoro');
      textos.push(q > 0 ? 'Pasáis ' + Math.round(q) + ' de oro del tesoro al banco central (ahora tiene ' + Math.round(c.banca.fondo) + '): podrá prestar más a los banqueros y a otros reinos.' : q < 0 ? 'Pasáis ' + Math.round(-q) + ' de oro del banco central al tesoro (ahora tenéis ' + Math.round(c.oro) + ' para gastar).' : 'No hay oro que mover.');
      return;
    }
    if (a.tipo === 'prestar' || a.tipo === 'perdonar' || a.tipo === 'pedir_prestamo') {
      if (!o || !o.viva) { textos.push('¿A qué reino? Nómbralo: «prestad 50 de oro a X».'); return; }
      if (a.tipo === 'prestar') { const oro = Math.max(5, Math.round(a.oro || Math.min(60, (c.oro || 0) * 0.3))); const r = S().prestar(m, c, o, oro); if (r.ok) an('🏦 Préstamo a ' + o.nombre); textos.push(r.texto); return; }
      if (a.tipo === 'perdonar') { const r = S().perdonar(m, c, o); if (r.ok) an('🤝 Deuda perdonada'); textos.push(r.texto); return; }
      // Pedir un préstamo: lo da si tiene banco y oro, y os aprecia lo bastante.
      const aprecio = o.rel[c.id] || 0;
      if (!(o.bancos > 0)) { textos.push(o.nombre + ' no tiene banco: no puede prestaros.'); return; }
      if (S().enGuerra(c, o)) { textos.push(o.nombre + ' está en guerra con vosotros: no os prestará nada.'); return; }
      if (!o.banca || o.banca.fondo < 30) { textos.push('El banco central de ' + o.nombre + ' no tiene oro para prestar (' + Math.round((o.banca || {}).fondo || 0) + ').'); return; }
      if (aprecio < 25 && !S().aliados(m, c, o)) { textos.push(o.nombre + ' no se fía lo bastante de vosotros (opinión ' + Math.round(aprecio) + '; hace falta 25 o ser aliados).'); return; }
      if ((m.creditos || []).some(cr => cr.de === o.id && cr.a === c.id)) { textos.push('Ya le debéis un préstamo a ' + o.nombre + ': primero devolvedlo.'); return; }
      const oro = Math.round(Math.min(50, o.banca.fondo * 0.5)), r = S().prestar(m, o, c, oro);
      if (r.ok) an('🏦 Préstamo de ' + o.nombre);
      textos.push(r.ok ? 'El banco central de ' + o.nombre + ' os presta ' + oro + ' de oro: entra en vuestro tesoro. Se lo devolveréis a plazos cada dos turnos, con un poco de interés.' : r.texto);
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
        if (!(c.cuarteles > 0)) {
          if (M.vida.empresariosDe(m, c).some(x => x.emp.ind === 'fundicion')) return aplicarExtra(m, c, { tipo: 'empresas', que: c.era >= 8 ? 'tanque' : c.era >= 7 ? 'artilleria' : 'canon', maq: true, n: a.n }, textos);
          textos.push('Hace falta un cuartel para fabricarlos: «construid un cuartel» (o que los haga una fundición privada).'); return;
        }
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
    // Los salarios de los obreros de las fábricas privadas (los paga su patrón): más bajos, más malestar y huelgas; más
    // altos, obreros contentos y patrones que ganan menos. (Subirlos en plena huelga la termina, abajo.)
    // Comprar o encargar a las empresas del país (la compañía minera, la fundición, el aserradero, la conservera): lo
    // fabrican o lo sacan, se lo venden al reino y el tesoro paga al recibirlo.
    // Las murallas: los constructores las levantan alrededor de cada plaza (empalizada o piedra según la edad).
    if (a.tipo === 'murallas') {
      const V = M.vida, p = (c.plan = c.plan || {});
      if (a.parar) { p.murallas = false; textos.push('Ya no se levantan más murallas salvo frente a quien esté en guerra o mal avenido con vosotros. Las que hay siguen en pie.'); return; }
      if (c.era < 1) { textos.push('Aún no sabéis levantar murallas: la empalizada llega con la Edad del Bronce.'); return; }
      p.murallas = true; V.planMuros(m, c, V.terrenos(m));
      const tramos = (c.muros || []).length, hechos = (c.muros || []).filter(t => m.vida.muro && m.vida.muro[t] > 0).length, piedra = c.era > 1;
      textos.push(tramos ? 'Los constructores levantarán ' + (piedra ? 'una muralla de piedra' : 'una empalizada de troncos') + ' alrededor de vuestras plazas, con puertas donde la cruzan los caminos (' + tramos + ' tramos; ya hay ' + hechos + '). Cada tramo cuesta 1 de ' + (piedra ? 'piedra' : 'madera') + ' (tenéis ' + Math.floor(c[piedra ? 'piedra' : 'madera'] || 0) + '). El enemigo tendrá que abrir brecha para entrar, y quien la defienda desde arriba estará a cubierto.' : 'Vuestras plazas aún son muy pequeñas para amurallarlas (hacen falta unas cuantas casas): en cuanto crezcan, se levantará.');
      return;
    }
    // Las defensas de frontera: el reino levanta torres a lo largo de la raya con los vecinos (también en paz).
    if (a.tipo === 'fortificar') {
      const V = M.vida, v = m.vida, p = (c.plan = c.plan || {});
      if (a.parar) { p.fortificar = false; textos.push('Ya no se levantan más torres en la frontera salvo frente a quien esté en guerra o mal avenido con vosotros. Las que hay siguen en pie.'); return; }
      if (c.era < 1) { textos.push('Aún no sabéis levantar torres: llegan con la Edad del Bronce.'); return; }
      const vecinos = S().vecinosDe(m, c).filter(o => o && o.viva);
      if (!vecinos.length) { textos.push('No tenéis frontera por tierra con ningún reino: no hay raya que fortificar (para la costa, «construid un puerto» y barcos de guerra).'); return; }
      p.fortificar = true;
      const regiones = new Set(vecinos.flatMap(o => S().frontera(m, o, c)));
      let hay = 0; for (const r of regiones) for (const t of V.parcelas(m, r)) if (v.obra[t] === V.OBRA.torre) hay++;
      const tope = Math.min(regiones.size, 1 + Math.floor(c.era / 2) + 3), f = V.fase(c.era);
      const tipo = ['empalizadas de troncos', 'torres de piedra', 'torres artilladas', 'búnkeres de hormigón con ametralladora'][f];
      textos.push('Fortificáis la frontera con ' + vecinos.map(o => o.nombre).join(', ') + ': los constructores levantarán ' + tipo + ' a lo largo de la raya, separadas entre sí y mejor junto a los caminos que entran (hasta ' + tope + '; ya hay ' + hay + '). Cada una cuesta 6 de madera, 4 de piedra y 4 de oro (tenéis ' + Math.floor(c.madera || 0) + ', ' + Math.floor(c.piedra || 0) + ' y ' + Math.floor(c.oro || 0) + '). Disparan a los soldados enemigos que se acercan y el enemigo tiene que derribarlas. «Dejad de fortificar la frontera» lo para.');
      return;
    }
    if (a.tipo === 'empresas') {
      const V = M.vida, I = V.INDUSTRIAS, emp = V.empresariosDe(m, c).filter(x => x.emp.neg === 'fabrica' && x.emp.ind);
      const quien = ind => emp.filter(x => x.emp.ind === ind);
      const nombreEmp = x => (m.vida.edificios[x.emp.t] || {}).nombre || (I[x.emp.ind] ? I[x.emp.ind].nombre + ' ' + (x.familia || '') : 'su empresa');
      if (a.maq) {
        if (a.que === 'avion' && !M.vida.AVIACION) { textos.push('Los aviones están desactivados por ahora, hasta que haya defensas antiaéreas. Para la guerra moderna tenéis tanques, artillería, trincheras y búnkeres en la frontera.'); return; }
        const MQ = { tanque: ['tanques', 7], avion: ['aviones', 7], artilleria: ['piezas de artillería', 7], canon: ['cañones', 5] }[a.que];
        if (c.era < MQ[1]) { textos.push('Aún no se hacen ' + MQ[0] + ': llegan con ' + (MQ[1] >= 7 ? 'la Era Moderna' : 'la pólvora (Renacimiento)') + '.'); return; }
        const fund = quien('fundicion');
        if (!fund.length) { textos.push('No tenéis ninguna fundición privada que haga ' + MQ[0] + '. La abre un capitalista (con préstamo de un banco privado o con su dinero) cuando al reino le sobra metal' + (c.cuarteles > 0 ? '; mientras, el cuartel puede: «fabricad ' + (a.n || 3) + ' ' + MQ[0] + '».' : '.')); return; }
        const n = Math.max(1, Math.min(30, a.n || 3));
        // (Los encargos van en cola: uno detrás de otro, en el orden en que se piden.)
        const cola = p.encargosMaq = (p.encargosMaq || []).filter(x => x.hechos < x.n);
        const igual = cola.find(x => x.k === a.que);
        if (igual) igual.n += n; else cola.push({ k: a.que, n, hechos: 0, desde: m.turno });
        an('🏭 Encargo a la fundición: ' + n + ' ' + MQ[0]);
        const pos = cola.findIndex(x => x.k === a.que), antes = cola.slice(0, pos).map(x => (x.n - x.hechos) + ' ' + ({ tanque: 'tanques', avion: 'aviones', canon: 'cañones', artilleria: 'piezas de artillería' }[x.k]));
        textos.push('Encargáis ' + n + ' ' + MQ[0] + ' a ' + fund.map(nombreEmp).join(' y ') + (antes.length ? ' (después de ' + antes.join(' y ') + ')' : '') + ': los hará antes que nada y os los venderá según los termine (el tesoro paga cada uno al recibirlo; necesita metal' + (a.que === 'tanque' || a.que === 'avion' ? ' y petróleo' : '') + ').' + (a.que === 'avion' && !(c.aerodromos > 0) ? ' Ojo: sin aeródromo, los aviones no tienen de dónde despegar.' : ''));
        return;
      }
      const IND = { metal: ['minera'], piedra: ['minera'], carbon: ['minera'], armas: ['fundicion'], muebles: ['aserradero'], comida: ['conservera'] }[a.que];
      const prov = emp.filter(x => IND.includes(x.emp.ind));
      if (!prov.length) { textos.push('Ninguna empresa del país hace ' + NB(a.que) + ': ' + ({ minera: 'hace falta una compañía minera', fundicion: 'hace falta una fundición', aserradero: 'hace falta un aserradero', conservera: 'hace falta una conservera' }[IND[0]]) + ', y la abre un capitalista.' + (V.sociosDe(m, c).length ? ' También podéis comprarlo fuera: «comprad ' + NB(a.que) + '».' : '')); return; }
      const n = Math.max(1, Math.min(500, a.n || 10));
      p.pedidoEmp = p.pedidoEmp || {}; p.pedidoEmp[a.que] = (p.pedidoEmp[a.que] || 0) + n;
      an('🏭 Pedido a las empresas: ' + n + ' de ' + NB(a.que));
      const precio = (m.mercado && m.mercado.precio[a.que]) || PRECIO[a.que] || 1;
      textos.push('Pedís ' + n + ' de ' + NB(a.que) + ' a ' + prov.map(nombreEmp).join(' y ') + ', a unas ' + precio.toFixed(2) + ' de oro cada una: os lo venden según lo tengan, y el tesoro paga al recibirlo (ahora tenéis ' + Math.round(c.oro || 0) + ' de oro).');
      return;
    }
    // El ministro de economía: trabaja en el banco central y compra y vende por el reino según el modo.
    if (a.tipo === 'ministro') {
      const V = M.vida, eco = p.economia, MOD = V.MODOS_ECO;
      const ministro = eco && m.vida.aldeanos.find(x => x.id === eco.ministro && x.c === c.id);
      const nom = x => x.nombre + ' ' + (x.familia || '');
      if (a.que === 'despedir') {
        if (!eco) { textos.push('No tenéis ministro de economía.'); return; }
        if (ministro) delete ministro.ministro;
        p.pedidos = (p.pedidos || []).filter(x => !x.ministro); p.ventas = (p.ventas || []).filter(x => !x.ministro);
        delete p.economia; an('🏛 Sin ministro de economía');
        textos.push('Despedís al ministro' + (ministro ? ' ' + nom(ministro) : '') + ': se anulan sus compras y ventas, y el comercio vuelve a ser solo lo que encarguéis.');
        return;
      }
      if (a.que === 'consulta') {
        if (!eco) { textos.push(c.bancos > 0 ? 'No tenéis ministro de economía: «nombrad un ministro de economía» y elegid el modo (crecimiento, economía de guerra, ahorro o equilibrio).' : 'El ministro de economía trabaja en el banco central: primero «construid un banco central» (desde el Renacimiento).'); return; }
        const ped = (p.pedidos || []).filter(x => x.ministro).map(x => x.n + ' de ' + NB(x.que)), ven = (p.ventas || []).filter(x => x.ministro).map(x => x.n + ' de ' + NB(x.que));
        textos.push('Ministro de economía: ' + (ministro ? nom(ministro) : 'aún por nombrar') + ', en modo ' + (MOD[eco.modo] || MOD.equilibrio).nombre + '. ' + (ped.length ? 'Ha encargado ' + ped.join(', ') + '. ' : 'No tiene compras pendientes. ') + (ven.length ? 'Ha puesto a la venta ' + ven.join(', ') + '. ' : '') + 'Tesoro: ' + Math.round(c.oro || 0) + ' de oro.');
        return;
      }
      if (!(c.bancos > 0)) { textos.push('El ministro de economía trabaja en el banco central, y aún no tenéis: «construid un banco central» (desde el Renacimiento).'); return; }
      const modo = a.modo || (eco && eco.modo) || 'equilibrio';
      const nuevo = !eco;
      p.economia = Object.assign(eco || {}, { modo });
      // Al nombrarlo o cambiar de modo, deshace las compras y ventas del modo anterior y trabaja enseguida.
      p.pedidos = (p.pedidos || []).filter(x => !x.ministro); p.ventas = (p.ventas || []).filter(x => !x.ministro);
      V.ministroEconomia(m, c);
      const min = m.vida.aldeanos.find(x => x.id === p.economia.ministro);
      // El modo empuja también lo que produce el pueblo.
      const pr = p.prioridad = p.prioridad || {};
      if (modo === 'guerra') pr.ejercito = Math.max(pr.ejercito || 1, 1.5); else if (modo === 'crecimiento') pr.casas = Math.max(pr.casas || 1, 1.5); else if (modo === 'ahorro') pr.riqueza = Math.max(pr.riqueza || 1, 1.5);
      const desc = { equilibrio: 'compra lo que falta y vende lo que sobra, sin más', crecimiento: 'compra madera, piedra y comida para crecer y vende las armas y máquinas de más (y se construyen más casas)', guerra: 'compra armas, metal, máquinas, granadas, petróleo y comida de reserva, y vende muebles y madera de más (y más gente al ejército)', ahorro: 'solo compra lo imprescindible, vende lo que sobra y guarda más oro en el tesoro (y se busca más riqueza)' }[modo];
      const hizo = p.economia.ultimo && p.economia.ultimo.hechos && p.economia.ultimo.hechos.length ? ' Para empezar: ' + p.economia.ultimo.hechos.slice(0, 4).join(', ') + '.' : '';
      an('🏛 ' + (nuevo ? 'Ministro de economía: ' : 'Modo de la economía: ') + (MOD[modo] || MOD.equilibrio).nombre);
      textos.push((nuevo ? (min ? nom(min) + ' es vuestro ministro de economía: trabajará en el banco central. ' : 'Se nombra un ministro de economía. ') : 'El ministro cambia de modo. ') + 'Modo ' + (MOD[modo] || MOD.equilibrio).nombre + ': ' + desc + '.' + hizo + (V.sociosDe(m, c).length ? '' : ' Ojo: sin socios no tiene con quién comerciar; abrid una ruta comercial.'));
      return;
    }
    // El parte de guerra: con quién, quién es más fuerte, cuántos soldados, máquinas y aviones, y qué conviene.
    if (a.tipo === 'consulta_guerra') {
      if (!c.guerras.length) { textos.push('Estáis en paz con todos.' + ((c.guerreros || 0) ? ' Tenéis ' + c.guerreros + ' guerreros patrullando.' : '')); return; }
      const yo = S().fuerza(m, c);
      const partes = c.guerras.map(g => { const o = S().civ(m, g.con); if (!o) return null; const el = S().fuerza(m, o), r = el > yo * 1.4 ? 'son bastante más fuertes: mejor pedir la paz' : el > yo ? 'están algo por encima' : yo > el * 1.4 ? 'les superáis con creces' : 'vais parejos'; return 'con ' + o.nombre + ' (' + (o.guerreros || 0) + ' soldados suyos), ' + r; }).filter(Boolean);
      const maq = Math.floor(c.vehiculos || 0), avi = Math.floor(c.aviones || 0);
      textos.push('En guerra ' + partes.join('; ') + '. Vosotros: ' + (c.guerreros || 0) + ' soldados' + (maq ? ', ' + maq + ' máquinas de guerra' : '') + (avi ? ', ' + avi + ' aviones' : '') + ', ' + Math.floor(c.armas || 0) + ' armas en el almacén y ' + Math.floor(c.comida || 0) + ' de comida.' + ((c.comida || 0) < (c.habitantes || 10) ? ' Ojo: con el granero tan bajo, la gente pasará hambre.' : ''));
      return;
    }
    if (a.tipo === 'salario' || (a.tipo === 'huelga' && a.ceder && !c.huelga)) {
      const sube = a.tipo === 'huelga' || a.sube !== false;
      if (c.era < 6) { textos.push('Aún no hay obreros a sueldo: llegan con las fábricas de la Revolución Industrial.'); return; }
      const antes = p.salario || 1, nuevo = Math.round(Math.max(0.6, Math.min(1.6, antes + (sube ? 0.2 : -0.2))) * 10) / 10;
      if (nuevo === antes) { textos.push(sube ? 'Los salarios ya están en lo más alto que los patrones pueden pagar.' : 'Los salarios ya están en lo más bajo: por menos, nadie trabaja.'); return; }
      p.salario = nuevo;
      an((sube ? '▲' : '▼') + ' Salarios de los obreros: ' + Math.round(nuevo * 100) + ' %');
      textos.push((sube ? 'Subís' : 'Bajáis') + ' los salarios de los obreros al ' + Math.round(nuevo * 100) + ' % de lo normal. ' + (sube ? 'Los obreros están más contentos (menos huelgas) y los patrones ganan algo menos.' : 'Los patrones ganan más, pero los obreros se quejan: más riesgo de huelga.'));
      return;
    }
    if (a.tipo === 'huelga') {
      if (!c.huelga) { textos.push(c.era >= 6 && c.fabricas > 0 ? 'Ahora no hay ninguna huelga: los obreros trabajan.' : 'Aún no tenéis fábricas ni obreros.'); return; }
      if (a.ceder) {
        const coste = Math.round(6 + 6 * (c.fabricas || 1));
        if ((c.oro || 0) < coste) { textos.push('No hay oro para subir los salarios (hacen falta ' + coste + '). Podéis reprimir la huelga, o esperar a que se acabe sola.'); return; }
        c.oro -= coste; delete c.huelga; c.estab = Math.min(100, c.estab + 6); c.huelgasN = Math.max(0, (c.huelgasN || 0) - 1); p.salario = Math.min(1.6, Math.round(((p.salario || 1) + 0.2) * 10) / 10);
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
      // Con plaza pública la fiesta luce más (+12 en vez de +9).
      const sube = a.descanso ? 5 : c.fuentes > 0 ? 12 : 9;
      p.ultimaFiesta = m.turno; c.comida -= coste; c.estab = Math.min(100, c.estab + sube);
      for (const x of adultosDe(m, c)) if (!x.fijo && !x.k && x.o !== 4) { x.e = 3; x.t = a.descanso ? 3 : 2; } // ESPERAR: dejan el trabajo un rato
      an(a.descanso ? '😴 Día de descanso' : '🎉 ¡Fiesta en la plaza!');
      textos.push((a.descanso ? 'Tu gente descansa un par de turnos' : 'Fiesta en la plaza: música, vino y ' + coste + ' de comida') + '. Estabilidad +' + sube + (!a.descanso && !(c.fuentes > 0) ? ' (con una plaza pública lucirá más)' : '') + ' (ahora ' + Math.round(c.estab) + ').');
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
  // El estado del banco y de las deudas, en pocas líneas.
  function informeBanca(m, c) {
    const l = [];
    if (c.bancos > 0 && c.banca) {
      const b = c.banca, n = M.vida.nivelInteres(c), bancos = M.vida.banquerosDe(m, c);
      l.push('Banco central: ' + Math.round(b.fondo) + ' de oro (prestado ' + Math.round(b.prestado) + ', devuelto ' + Math.round(b.devuelto) + (b.quiebras ? ', ' + b.quiebras + (b.quiebras === 1 ? ' quiebra' : ' quiebras') : '') + '). Interés ' + (n === 0.5 ? 'bajo' : n === 1.5 ? 'alto' : 'normal') + '. Solo presta a banqueros y a otros reinos.');
      l.push(bancos.length ? 'Bancos privados: ' + bancos.map(a => 'el de ' + a.nombre + ' ' + (a.familia || '') + ' (' + Math.round(a.emp.capital) + ' de capital' + (a.emp.deuda > 0 ? ', debe al central ' + Math.round(a.emp.deuda) : '') + ')').join(', ') + '.' : 'Aún no hay banqueros: el mercader más rico abrirá un banco en cuanto tenga fortuna (y el central oro que prestarle).');
    }
    // Los empresarios (con o sin banco: el que es rico monta su negocio con lo suyo), con su industria y lo que ha hecho.
    const emp = M.vida.empresariosDe(m, c).filter(a => a.emp.neg !== 'banco'), I = M.vida.INDUSTRIAS;
    const MAQ = { canon: 'cañones', artilleria: 'artillería', tanque: 'tanques', avion: 'aviones' };
    const que = e => e.neg !== 'fabrica' ? 'mercader' : e.ind === 'inmobiliaria' ? 'inmobiliaria' + (e.hechas || e.publicas ? ', ha levantado ' + [e.hechas ? e.hechas + (e.hechas === 1 ? ' casa' : ' casas') + ' de alquiler' : '', e.publicas ? e.publicas + (e.publicas === 1 ? ' edificio' : ' edificios') + ' para el reino' : ''].filter(Boolean).join(' y ') : '') : e.ind === 'ferrocarril' ? 'ferrocarril' + (e.viajeros ? ', ' + Math.round(e.viajeros + (e.fletes || 0)) + ' cobrado en billetes y fletes' : '') : e.ind && I[e.ind] ? I[e.ind].nombre.toLowerCase() + (e.maquinas ? ', ha hecho ' + Object.keys(e.maquinas).map(k => e.maquinas[k] + ' ' + MAQ[k]).join(' y ') : '') : 'fábrica';
    const pe = (c.plan && c.plan.pedidoEmp) || {}, em = ((c.plan && c.plan.encargosMaq) || []).filter(x => x.hechos < x.n);
    if (Object.keys(pe).length || em.length) l.push('Pedido a las empresas del país: ' + [...Object.keys(pe).map(k => Math.ceil(pe[k]) + ' de ' + NB(k)), ...em.map(x => (x.n - x.hechos) + ' ' + ({ tanque: 'tanques', avion: 'aviones', canon: 'cañones', artilleria: 'piezas de artillería' }[x.k]))].join(', ') + '.');
    if (emp.length) l.push('Empresarios: ' + emp.map(a => a.nombre + ' ' + (a.familia || '') + ' (' + que(a.emp) + (a.emp.propio ? ', con su dinero' : a.emp.deuda > 0 ? ', debe ' + Math.round(a.emp.deuda) : ', sin deudas') + ')').join(', ') + '.');
    if (!(c.bancos > 0 && c.banca)) l.push(c.era >= 5 ? 'Aún no tenéis banco central: «construid un banco central» (hace falta una villa o ciudad).' : 'El banco central llega con el Renacimiento. Mientras, vuestros mercaderes ahorran.');
    const mercs = M.vida.mercaderesDe(m, c);
    if (c.era >= 4) l.push(mercs.length ? 'Casas comerciales: ' + mercs.filter(a => a.merc.de == null).map(a => { const n = mercs.filter(x => x.merc.de === a.id).length; return 'la de ' + a.nombre + ' ' + (a.familia || '') + ' (' + (n ? n + (n > 1 ? ' sucursales, ' : ' sucursal, ') : '') + 'caja ' + Math.round(a.merc.caja) + ')'; }).join(', ') + '.' : 'Aún no hay gremios: el comerciante que junte lo bastante fundará uno.');
    const ricos = m.vida.aldeanos.filter(a => a.c === c.id && !a.emp && (a.dinero || 0) >= 1).sort((x, y) => y.dinero - x.dinero).slice(0, 3);
    if (ricos.length) l.push('Los más ricos: ' + ricos.map(a => a.nombre + ' ' + (a.familia || '') + ' (' + Math.round(a.dinero) + ')').join(', ') + '.');
    const debo = (m.creditos || []).filter(cr => cr.a === c.id), meDeben = (m.creditos || []).filter(cr => cr.de === c.id);
    if (meDeben.length) l.push('Os deben: ' + meDeben.map(cr => (S().civ(m, cr.a) || {}).nombre + ' ' + Math.round(cr.resta)).join(', ') + '.');
    if (debo.length) l.push('Debéis: ' + debo.map(cr => (S().civ(m, cr.de) || {}).nombre + ' ' + Math.round(cr.resta)).join(', ') + '.');
    return l.join(' ');
  }
  const TIPOS_EXTRA = ['murallas', 'fortificar', 'empresas', 'ministro', 'consulta_guerra', 'salario', 'banco_central', 'interes', 'perdonar', 'pedir_prestamo', 'prestar', 'consulta_banca', 'anexar', 'exterminio', 'reforestar', 'fabricar', 'huelga', 'reparar', 'escuadron', 'vehiculos', 'atacar', 'rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje', 'impuestos', 'fiesta', 'rezar', 'curar', 'trabajar'];
