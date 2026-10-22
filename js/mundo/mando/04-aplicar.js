  // ── GÉNESIS · EL MANDO · Aplicar las acciones (igual en local que en línea) e informe ──

  // ---------- Aplicar las acciones (igual para un jugador local que para uno remoto) ----------
  function aplicar(m, civId, acciones) {
    const c = S().civ(m, civId), textos = [];
    if (!c || !c.viva) return ['Tu pueblo ya no existe.'];
    const p = plan(c);
    for (const a of acciones || []) {
      const o = a.con != null ? S().civ(m, Number(a.con)) : null;
      if (a.tipo === 'tropas' || a.tipo === 'tropas_libres') { textos.push(aplicarTropas(m, c, a)); continue; }
      if (a.tipo === 'milagro') textos.push('Eso solo puede hacerlo un dios, y aquí gobiernas un pueblo de carne y hueso. Puedes mandar a tu gente a talar, sembrar, construir, picar piedra o luchar; expandiros, declarar guerras, firmar paces y tratados, invertir en ciencia o cambiar de gobierno.');
      else if (a.tipo === 'informe') textos.push(informe(m, c));
      else if (['comercio_libre', 'edad', 'consulta_edad', 'edad_auto', 'ahorrar_edad', 'investigar', 'consulta_tec', 'comprar', 'vender', 'tesoro', 'consulta_oro', 'consulta_mercado', 'especialidad', 'oferta'].includes(a.tipo)) aplicarEconomia(m, c, a, textos);
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
        textos.push('Prioridades: ' + tocados.map(k => NOMBRE_RECURSO[k] + ' ' + NIVEL(pr[k])).join(', ') + (a.solo ? ' (lo demás, baja)' : '') + (hp ? textoPlazo(m, hp) + '; luego vuelven a como estaban' : '') + '.' + (cambios.length ? ' Ya cambian de oficio: ' + cambios.map(x => x.slice(2)).join(', ') + '.' : oficiosNuevos(m, c, antesReparto, tocados)) + (tocados.includes('comida') && pr.comida != null && pr.comida < 0.6 ? ' Ojo: si el granero baja mucho, la gente volverá al campo por su cuenta para no pasar hambre.' : ''));
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
        p.embargo = (p.embargo || []).filter(id => id !== o.id);
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
      } else if (a.tipo === 'cerrar_comercio') {
        if (!o || !o.viva || o.id === c.id) { textos.push('¿Con quién? Nombra al pueblo.'); continue; }
        p.socios = (p.socios || []).filter(id => id !== o.id);
        p.embargo = [...new Set([...(p.embargo || []), o.id])];
        o.rel[c.id] = (o.rel[c.id] || 0) - 10; c.rel[o.id] = o.rel[c.id];
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])) && m.vida.anuncios.push({ civ: c.id, texto: '⛔ Cerrado el comercio con ' + o.nombre });
        textos.push('Cerráis el comercio con ' + o.nombre + ': ni carretas, ni barcos, ni compras ni ventas, y vuestros mercaderes tampoco tratan con ellos (ellos tampoco pueden comerciar con vosotros). No les gusta. Para volver: «abrid una ruta comercial con ' + o.nombre + '».');
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
        const NOMBRE = { mina: 'una mina', petroleo: 'un pozo de petróleo', pozo: 'un pozo', granero: 'un granero', fuente: 'una plaza pública con fuente', parque: 'un parque', palacio: 'un palacio', central: 'una central eléctrica', banco: 'un banco central', fabrica: 'una fábrica', estacion: 'una estación de tren', hospital: 'un hospital', aerodromo: 'un aeródromo', saber: (/^(monasterio|laboratorio)$/.test(M.CASA_SABER(c.era)) ? 'un ' : 'una ') + M.CASA_SABER(c.era), templo: 'un templo', torre: 'una torre de defensa', puerto: 'un puerto', molino: 'un molino', cuartel: 'un cuartel de soldados', arqueria: c.era >= 5 ? 'un campo de tiro' : 'una arquería', castillo: c.era >= 7 ? 'un fortín' : c.era >= 5 ? 'una fortaleza' : 'un castillo' };
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
          const o = M.vida.OBRA[a.obra], sede = m.vida.sede || {}, lejos = Object.keys(sede).filter(t => sede[t] === c.capital).map(Number);
          if (zona.some(t => m.vida.obra[t] === o) || lejos.some(t => m.vida.obra[t] === o)) { textos.push('Ya tenéis ' + NOMBRE[a.obra] + ' en ' + c.nombre + '.'); continue; }
          if (zona.concat(lejos).some(t => m.vida.andamios && m.vida.andamios[t] && m.vida.andamios[t].o === o)) { textos.push('Ya se está construyendo ' + NOMBRE[a.obra] + ' en ' + c.nombre + ': tus constructores lo terminarán.'); continue; }
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
        const CC = M.vida.COSTE_COLONIA, suyas = (m.ciudades || []).filter(x => x.civ === c.id).length;
        if (suyas >= S().maxCiudades(c, m)) { textos.push('Tu reino ya tiene todas las ciudades que puede gobernar (' + suyas + '). Avanzad de era para poder fundar más.'); continue; }
        if (M.vida.pausada(m) && !M.vida.puedeColonia(c)) { textos.push('Los colonos necesitan ' + CC.comida + ' de comida y ' + CC.madera + ' de madera para el viaje y el primer invierno (y que quede algo de comida en casa): tenéis ' + Math.floor(c.comida || 0) + ' de comida y ' + Math.floor(c.madera || 0) + ' de madera. Saldrán en cuanto lo juntéis.'); }
        p.colonos = a.rumbo || true;
        (m.vida && (m.vida.anuncios = m.vida.anuncios || [])).push({ civ: c.id, texto: 'Colonos en camino' + (a.rumbo ? ' hacia el ' + a.rumbo : '') });
        textos.push('Tres familias recogen sus cosas y salen ' + (a.rumbo === 'costa' ? 'hacia la costa' : a.rumbo ? 'hacia el ' + a.rumbo : 'hacia la mejor tierra libre cercana') + ' a fundar una aldea. Las verás caminar por el mapa.');
      } else if (a.tipo === 'colonia') {
        if (c.era < 5) { textos.push('Aún no sabéis cruzar el mar: hace falta llegar al Renacimiento (la carabela).'); continue; }
        if ((c.madera || 0) < 15) { textos.push('Una flota cuesta 15 de madera y tienes ' + Math.floor(c.madera || 0) + '. Poned más leñadores.'); continue; }
        const cs = S().casillas(m, c);
        const libres = [];
        for (let i = 0; i < m.W * m.H; i++) if (S().esTierra(m, i) && m.dueno[i] < 0 && m.tipo[i] !== 'nieve' && S().vecinos(i).some(v => m.tipo[v] === 'costa')) libres.push(i);
        S().ordenarPor(libres, x => Math.min(...cs.map(j => S().distancia(x, j))) - S().fertil(m, x) * 2);
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
