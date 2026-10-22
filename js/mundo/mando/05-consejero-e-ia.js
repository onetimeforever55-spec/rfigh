  // ── GÉNESIS · EL MANDO · El consejero y lo que traduce Claude ──

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
    if ((c.comida || 0) < hab * 0.15) {
      const vacio = 'Los graneros están casi vacíos (' + Math.floor(c.comida || 0) + ' de comida para ' + hab + ' bocas): si se acaban, la gente muere de hambre.';
      const cupos = (c.plan && c.plan.cupos) || {}, conCupo = Object.keys(cupos).filter(k => +k !== 1 && cupos[k] && cupos[k].n > 0);
      if (conCupo.length && hab < 40) return { texto: vacio + ' Además, tus cupos de oficio (' + conCupo.map(k => cupos[k].n + ' ' + (OFICIOS_N[k] || 'de un oficio')).join(', ') + ') quitan gente del campo.', orden: 'Liberad los cupos' };
      if (Object.keys(pr).some(k => k !== 'comida' && k !== 'expansion' && pr[k] > 1.2)) return { texto: vacio + ' Ahora mismo lo primero es comer: lo demás puede esperar.', orden: 'Todo a la comida' };
      if ((pr.comida || 1) < 2) return { texto: vacio, orden: 'Más comida' };
    }
    if ((c.madera || 0) < 4 && (pr.madera || 1) < 2) return { texto: 'Sin madera no se levantan casas ni se pagan tierras nuevas.', orden: 'Más madera' };
    const rebelde = (m.ciudades || []).find(x => x.civ === c.id && x.lealtad != null && x.lealtad < 0);
    if (rebelde) return { texto: rebelde.nombre + ' no es leal (' + Math.round(rebelde.lealtad) + '): pronto se rebelará. Una corte más estable o un ejército cerca la retienen.', orden: 'Más soldados' };
    if (c.sinCama > 0 && (pr.casas || 1) < 2) return { texto: 'Hay parejas que quieren tener hijos y no tienen cama: faltan casas.', orden: 'Más casas' };
    // Lo que le falta al pueblo (agua, granero, plaza, parque, palacio): con su porqué y la orden para hacerlo.
    const ORDEN = { pozo: 'Construid un pozo', granero: 'Construid un granero', fuente: 'Construid una plaza pública', parque: 'Haced un parque', palacio: 'Construid un palacio', central: 'Construid una central eléctrica', banco: 'Abrid un banco', fabrica: 'Construid una fábrica', estacion: 'Construid una estación de tren', hospital: 'Construid un hospital', aerodromo: 'Construid un aeródromo', templo: 'Construid un templo' };
    const cabe = x => !M.vida || ((c.nivel || 0) >= (M.vida.NIVEL_OBRA[M.vida.OBRA[x.obra]] || 0) && c.era >= (M.vida.ERA_OBRA[M.vida.OBRA[x.obra]] || 0));
    const falta = !(c.plan && c.plan.obra) && (c.necesidades || []).find(x => x.falta && x.capital !== false && ORDEN[x.obra] && cabe(x));
    if (falta) return { texto: falta.nombre + ': ' + falta.mal + '. Hace falta ' + falta.edificio + '.', orden: ORDEN[falta.obra] };
    if (c.estab < 30) return { texto: 'La gente está descontenta (estabilidad ' + Math.round(c.estab) + '). La paz y un templo ayudan.', orden: S().vecinosDe(m, c).length && c.guerras.length ? 'Haced la paz' : cabe({ obra: 'templo' }) && !(c.templos > 0) ? 'Construid un templo' : 'Haced una fiesta' };
    if (M.ERAS[c.era + 1] && !c.subiendo && S().puedeSubir(m, c).ok) return { texto: '¡Podéis pasar a ' + M.ERAS[c.era + 1].con + '! Tenéis las mejoras, el saber, los edificios y con qué pagarlo. Toca tu plaza (o 🏛) y pulsa «Avanzar».', orden: 'Avanzad de edad' };
    if (M.ERAS[c.era + 1] && !c.subiendo && !(c.plan && c.plan.ahorrarEdad) && S().ahorrando(Object.assign({}, m), Object.assign({}, c, { jugador: false })) && !S().puedeSubir(m, c).ok && S().puedeSubir(m, c).falta.every(x => /de (comida|madera|piedra|oro|metal)( \(.*\))?$/.test(x))) return { texto: 'Para ' + M.ERAS[c.era + 1].con + ' solo os falta pagar: ' + S().puedeSubir(m, c).falta.join(', ') + '.', orden: 'Ahorrad para la edad' };
    if ((c.oro || 0) < 0) return { texto: 'Las arcas están vacías: los soldados no cobran y desertan, y la gente se queja.', orden: (c.plan && c.plan.impuesto || 1) < 1.5 ? 'Subid los impuestos' : 'Vended madera' };
    const porInvestigar = M.TECNOLOGIAS.filter(t => t.era <= c.era && !M.tecsDe(c).includes(t.id)).sort((p, q) => M.costeTec(p) - M.costeTec(q));
    // (Primero lo que se puede empezar ya; si todo pide un edificio que falta, el consejo es levantarlo.)
    const yaSe = porInvestigar.filter(t => !S().faltaPara(m, c, t).length);
    if (c.investigacion && !c.investigacion.id && porInvestigar.length && !yaSe.length) {
      const LUGAR = { saber: ['una casa del saber', 'Construid una casa del saber'], molino: ['un molino', 'Construid un molino'], templo: ['un templo', 'Construid un templo'], cuartel: ['un cuartel', 'Construid un cuartel'], puerto: ['un puerto', 'Construid un puerto'] };
      const l = porInvestigar.map(t => t.lugar).find(x => LUGAR[x] && cabe({ obra: x }));
      if (l && !(c.plan && c.plan.obra)) return { texto: 'Tus sabios no pueden seguir: ' + porInvestigar.filter(t => t.lugar === l).map(t => t.nombre.toLowerCase()).slice(0, 3).join(', ') + ' se investiga en ' + LUGAR[l][0] + ', y no tenéis.', orden: LUGAR[l][1] };
    }
    if (c.investigacion && !c.investigacion.id && yaSe.length) return { texto: 'Tus sabios esperan saber qué investigar. Lo más a mano: ' + yaSe.slice(0, 3).map(t => t.nombre.toLowerCase() + ' (' + t.texto + ')').join('; ') + '.', orden: 'Investigad ' + yaSe[0].nombre.toLowerCase() };
    if (c.plan && c.plan.obra) return { texto: 'Tus constructores esperan madera y piedra para el encargo (' + c.plan.obra + ').', orden: 'Más piedra' };
    const sig = M.ERAS[c.era + 1];
    if (sig && (pr.ciencia || 1) < 1.5 && (c.comida || 0) >= hab * 0.8) return { texto: 'Todo en orden. Si invertís en saber, llegaréis antes ' + aEra(sig.con) + '.', orden: 'Más ciencia' };
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
    '{"tipo":"anexar","con":id} (conquistar o anexionarse un reino entero); {"tipo":"comercio_libre","si":true|false} (que los comerciantes comercien solos o solo lo que se mande);',
    '{"tipo":"guerra","con":id}; {"tipo":"paz","con":id}; {"tipo":"comercio","con":id}; {"tipo":"alianza","con":id}; {"tipo":"romper","con":id} (romper una alianza);',
    '{"tipo":"ministro","que":"nombrar"|"modo"|"despedir"|"consulta","modo":"equilibrio"|"crecimiento"|"guerra"|"ahorro"} (el ministro de economía, en el banco central, compra lo que falta y vende lo que sobra según el modo);',
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
  const TIPOS = new Set(['cerrar_comercio', 'banco_central', 'interes', 'perdonar', 'pedir_prestamo', 'prestar', 'consulta_banca', 'anexar', 'comercio_libre', 'exterminio', 'oferta', 'consulta_mercado', 'especialidad', 'edad', 'consulta_edad', 'edad_auto', 'ahorrar_edad', 'investigar', 'consulta_tec', 'comprar', 'vender', 'tesoro', 'consulta_oro', 'reparar', 'escuadron', 'vehiculos', 'atacar', 'rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje', 'impuestos', 'fiesta', 'rezar', 'curar', 'trabajar', 'consulta', 'cuadrilla', 'cupo', 'meta', 'liberar', 'objetivo', 'defender', 'prioridad', 'expandir', 'guerra', 'paz', 'comercio', 'alianza', 'romper', 'regimen', 'colonia', 'colonos', 'construir', 'informe', 'normal']);
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
        if (a.tipo === 'salario') x.sube = a.sube !== false;
        if (a.tipo === 'fortificar' && a.parar) x.parar = true;
        if (a.tipo === 'murallas' && a.parar) x.parar = true;
        if (a.tipo === 'empresas') { const ok = ['tanque', 'avion', 'canon', 'artilleria', 'metal', 'armas', 'muebles', 'comida', 'piedra', 'carbon']; x.que = ok.includes(a.que) ? a.que : 'metal'; x.maq = ['tanque', 'avion', 'canon', 'artilleria'].includes(x.que); x.n = Number(a.n) > 0 ? Math.min(200, Math.round(Number(a.n))) : null; }
        if (a.tipo === 'ministro') { x.que = ['nombrar', 'modo', 'despedir', 'consulta'].includes(a.que) ? a.que : 'consulta'; if (['equilibrio', 'crecimiento', 'guerra', 'ahorro'].includes(a.modo)) x.modo = a.modo; }
        if (a.tipo === 'fiesta' && a.descanso) x.descanso = true;
        if (a.tipo === 'huelga') x.ceder = a.ceder !== false;
        if (a.tipo === 'fabricar') { x.que = ['muebles', 'vehiculos', 'granadas'].includes(a.que) ? a.que : 'armas'; x.n = Math.max(1, Math.min(500, Math.round(Number(a.n) || 20))); }
        if (['anexar', 'rendicion', 'espiar', 'insultar', 'regalo', 'sabotaje'].includes(a.tipo) && x.con == null) continue;
        out.push(x);
      }
      else if (a.tipo === 'objetivo' || a.tipo === 'defender') { if (Number.isInteger(Number(a.region)) && Number(a.region) >= 0) out.push({ tipo: a.tipo, region: Number(a.region) }); }
      else if (a.tipo === 'expandir') out.push({ tipo: 'expandir', si: a.si !== false, rumbo: ['norte', 'sur', 'este', 'oeste'].includes(a.rumbo) ? a.rumbo : Number.isFinite(Number(a.rumbo)) && a.rumbo !== null ? Number(a.rumbo) : null });
      else if (a.tipo === 'regimen') { const r = REGIMENES.find(x => x[1] === a.a); if (r) out.push({ tipo: 'regimen', a: r[1], era: r[2] }); }
      else if (['guerra', 'paz', 'comercio', 'cerrar_comercio', 'alianza', 'romper'].includes(a.tipo)) out.push({ tipo: a.tipo, con: Number(a.con) });
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
