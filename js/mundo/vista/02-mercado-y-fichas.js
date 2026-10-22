  // ── GÉNESIS · LA VISTA · Mercado, ciudades, técnica, fichas, crónica, consejo y guerra ──

  // ---------- La pestaña Mercado: precios del mundo, a qué se dedica el reino, sus socios y sus tratos ----------
  const ICONO_BIEN = new Proxy({}, { get: (o, k) => px(k) || ({ comida: '🌾', madera: '🪵', piedra: '🪨', metal: '⛓', armas: '⚔', carbon: '⚫', petroleo: '🛢', muebles: '🪑', vehiculos: '🛡', semillas: '🌰', granadas: '💣' })[k] });
  function curva(h, col) {
    if (!h || h.length < 2) return '';
    const max = Math.max(...h), min = Math.min(...h), w = 64, al = 18, sp = Math.max(0.0001, max - min);
    const pts = h.map((x, i) => Math.round(i / (h.length - 1) * w) + ',' + Math.round(al - 2 - (x - min) / sp * (al - 4))).join(' ');
    return '<svg class="curva" viewBox="0 0 ' + w + ' ' + al + '" width="' + w + '" height="' + al + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.5" shape-rendering="crispEdges"/></svg>';
  }
  function mercadoDe(c) {
    const mk = m.mercado, V = M.vida, bienes = V.bienesDe(c), nb = k => V.NOMBRE_BIEN[k] || k;
    const socios = M.vida.sociosDe(m, c);
    const tabla = '<table class="mercado"><thead><tr><th>Bien</th><th>Precio</th><th>Últimos turnos</th><th>Hay / hace falta</th></tr></thead><tbody>' + bienes.map(k => {
      const h = mk.historia[k] || [], d = h.length > 6 ? h[h.length - 1] - h[h.length - 7] : 0, base = V.PRECIO_BASE[k];
      const col = mk.precio[k] > base * 1.25 ? '#ff8a7a' : mk.precio[k] < base * 0.8 ? '#9ad08a' : '#f0c05a';
      return '<tr><td>' + ICONO_BIEN[k] + ' ' + nb(k) + '</td><td class="num" style="color:' + col + '">' + (mk.precio[k] || V.PRECIO_BASE[k]).toFixed(2) + (d > 0.02 ? ' ▲' : d < -0.02 ? ' ▼' : '') + '</td><td>' + curva(h, col) + '</td><td class="num tenue">' + mk.oferta[k] + ' / ' + mk.demanda[k] + '</td></tr>';
    }).join('') + '</tbody></table>';
    const b = c.balance || { sobra: {}, falta: {}, urg: {} };
    const sobra = bienes.filter(k => b.sobra[k] >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.floor(b.sobra[k]) + ' ' + nb(k)).join(' · ') || 'nada';
    const falta = bienes.filter(k => b.falta[k] >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.ceil(b.falta[k]) + ' ' + nb(k) + (b.urg[k] >= 1 ? ' <b class="rojo">¡urgente!</b>' : '')).join(' · ') || 'nada';
    const esp = c.especialidad, elegida = c.plan && c.plan.especialidad;
    const tratos = (mk.tratos || []).filter(x => x.vende === c.id || x.compra === c.id).slice(-6).reverse();
    const nombre = id => esc((S.civ(m, id) || { nombre: '—' }).nombre);
    const pedidos = ((c.plan && c.plan.pedidos) || []).map(x => '📦 ' + x.n + ' ' + x.que).concat(((c.plan && c.plan.ventas) || []).map(x => '🏷 ' + x.n + ' ' + x.que)).join(' · ');
    return '<div class="arbol">' +
      '<p class="arbol-ayuda">El precio de cada cosa sale de lo que hay en todo el mundo frente a lo que todos necesitan: si sobra, baja; si escasea, sube. Pero solo se compra y se vende con los reinos con los que hay ruta: sus comerciantes traen lo que os falta y se llevan lo que os sobra, a cambio de oro.</p>' +
      (mk.suceso ? '<p class="arbol-ayuda"><b>📈 ' + esc(mk.suceso.titulo) + '</b>: ' + esc(mk.suceso.k) + (mk.suceso.f > 1 ? ' más caro' : ' más barato') + ' durante ' + Math.max(1, mk.suceso.hasta - m.turno) + ' turnos más.</p>' : '') +
      (c.oferta && c.jugador ? '<div class="oferta"><b>🤝 ' + esc((S.civ(m, c.oferta.de) || {}).nombre || 'Un mercader') + '</b> ' + (c.oferta.tipo === 'venta' ? 'os ofrece ' + c.oferta.n + ' ' + ICONO_BIEN[c.oferta.que] + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro' : 'quiere comprar ' + c.oferta.n + ' ' + ICONO_BIEN[c.oferta.que] + ' ' + c.oferta.que + ' por ' + Math.round(c.oferta.oro) + ' de oro') + ' <span class="tenue">(mercado: ' + Math.round(mk.precio[c.oferta.que] * c.oferta.n) + ')</span><div class="linea"><button type="button" class="obrar mercado-orden" data-orden="acepto el trato">Aceptar</button><button type="button" class="mando sutil mercado-orden" data-orden="rechazo el trato">Rechazar</button></div></div>' : '') +
      '<div class="tec-era">Precios del mundo</div>' + tabla +
      '<div class="tec-era">' + esc(c.nombre) + ' se dedica a</div>' +
      '<p class="arbol-ayuda">' + (esp ? ICONO_BIEN[esp] + ' <b>' + esp + '</b>' + (elegida ? ' (lo mandaste tú)' : ' — reparte su trabajo según lo que le rinde, y cambia cuando otra cosa se paga mejor') : 'aún nada en especial') + '</p>' +
      (c.cartera ? '<div class="cartera">' + Object.keys(c.cartera).map(k => '<div class="cartera-fila"><span>' + ICONO_BIEN[k] + ' ' + k + '</span><span class="barra"><span style="width:' + Math.round(c.cartera[k] * 100) + '%"></span></span><b>' + Math.round(c.cartera[k] * 100) + '%</b></div>').join('') + '</div>' : '') +
      (c.rentable ? '<p class="arbol-ayuda tenue">Lo que le rinde cada cosa ahora: ' + bienes.filter(k => c.rentable[k] > 0).sort((x, y) => c.rentable[y] - c.rentable[x]).map(k => ICONO_BIEN[k] + ' ' + (c.rentable[k] * 10).toFixed(1)).join(' · ') + (c.ganado && bienes.some(k => (c.ganado[k] || 0) >= 1) ? ' · oro ganado vendiendo: ' + bienes.filter(k => (c.ganado[k] || 0) >= 1).map(k => ICONO_BIEN[k] + ' ' + Math.round(c.ganado[k])).join(' ') : '') + '</p>' : '') +
      ((c.cambiosEsp || []).length ? '<p class="arbol-ayuda tenue">Cambios: ' + c.cambiosEsp.slice(-4).reverse().map(x => (m.turno - x.t) + ' turnos atrás, de ' + x.de + ' a ' + x.a + ' (' + esc(x.motivo) + ')').join(' · ') + '</p>' : '') +
      (c.jugador ? '<div class="linea esp-botones">' + bienes.map(k => '<button type="button" class="mando sutil esp-elegir' + (esp === k ? ' activa' : '') + '" data-k="' + k + '">' + ICONO_BIEN[k] + ' ' + k + '</button>').join('') + (elegida ? '<button type="button" class="mando sutil esp-elegir" data-k="">Que elija el pueblo</button>' : '') + '</div>' : '') +
      '<p class="arbol-ayuda">Le sobra para vender: ' + sobra + '</p><p class="arbol-ayuda">Le falta: ' + falta + '</p>' +
      (pedidos ? '<p class="arbol-ayuda">En espera: ' + pedidos + '</p>' : '') +
      '<div class="tec-era">Socios</div>' +
      (socios.length ? '<ul class="edad-req">' + socios.map(o => {
        const ob = o.balance || { sobra: {}, urg: {} };
        const ofrece = bienes.filter(k => ob.sobra[k] >= 1).map(k => ICONO_BIEN[k]).join(' ') || '—', necesita = bienes.filter(k => ob.urg[k] >= 0.3).map(k => ICONO_BIEN[k]).join(' ') || '—';
        const compra = c.jugador ? bienes.filter(k => ob.sobra[k] >= 3 && b.falta[k] >= 1).slice(0, 2).map(k => '<button type="button" class="mando sutil mercado-orden" data-orden="comprad ' + Math.min(Math.ceil(b.falta[k]), Math.floor(ob.sobra[k])) + ' de ' + k + '">Comprar ' + ICONO_BIEN[k] + '</button>').join('') : '';
        return '<li><b>' + esc(o.nombre) + '</b> <span class="tenue">· le sobra ' + ofrece + ' · le falta ' + necesita + '</span> ' + compra + '</li>';
      }).join('') + '</ul>' : '<p class="tenue arbol-ayuda">Sin rutas con otros reinos: todo lo que necesite lo tiene que producir. Con buenas relaciones (o «comerciad con X») se abre una ruta y llegan las carretas.</p>') +
      '<div class="tec-era">Últimos tratos</div>' +
      (tratos.length ? '<ul class="edad-req">' + tratos.map(x => '<li>' + (x.ruta === 'mar' ? '⛵ ' : '') + (x.compra === c.id ? '🛒 Compra ' : '💰 Vende ') + x.n + ' ' + ICONO_BIEN[x.que] + ' ' + x.que + (x.compra === c.id ? ' a ' + nombre(x.vende) : ' a ' + nombre(x.compra)) + ' por <b>' + Math.round(x.oro) + '</b> 🪙 <span class="tenue">(' + (m.turno - x.t === 0 ? 'ahora' : 'hace ' + (m.turno - x.t) + ' turnos') + ')</span></li>').join('') + '</ul>' : '<p class="tenue arbol-ayuda">Ninguno todavía.</p>') +
      '</div>';
  }
  // La pestaña Ciudad: lo que el pueblo necesita y por qué, el ánimo de la gente, la estación y las obras en marcha.
  function ciudadDe(c) {
    const V = M.vida, nec = c.necesidades || [], est = m.vida.estacion;
    const ORDEN = { banco: 'abrid un banco', fabrica: 'construid una fábrica', estacion: 'construid una estación de tren', hospital: 'construid un hospital', aerodromo: 'construid un aeródromo', central: 'construid una central eléctrica', pozo: 'construid un pozo', granero: 'construid un granero', fuente: 'construid una plaza pública', parque: 'haced un parque', palacio: 'construid un palacio', templo: 'construid un templo' };
    const ESTA = ['🌱 Primavera: se siembra y los campos brotan deprisa.', '☀️ Verano: los campos maduran.', '🍂 Otoño: la gran cosecha. Es el momento de llenar el granero.', '❄️ Invierno: no crece nada, apenas se recolecta y se quema el doble de leña.'];
    const quedan = V.ESTACION_TURNOS - (m.turno % V.ESTACION_TURNOS);
    const animo = c.animo == null ? 70 : c.animo, cara = animo >= 75 ? '😊' : animo >= 50 ? '🙂' : animo >= 30 ? '😟' : '😠';
    const obras = Object.entries(m.vida.andamios || {}).filter(([, a]) => a.civ === c.id);
    const NOMBRE_OBRA = o => ({ [V.OBRA.casa]: 'casa', [V.OBRA.pozo]: 'pozo', [V.OBRA.granero]: 'granero', [V.OBRA.fuente]: 'plaza pública', [V.OBRA.parque]: 'parque', [V.OBRA.palacio]: 'palacio', [V.OBRA.central]: 'central eléctrica', [V.OBRA.banco]: 'banco', [V.OBRA.fabrica]: 'fábrica', [V.OBRA.estacion]: 'estación de tren', [V.OBRA.hospital]: 'hospital', [V.OBRA.aerodromo]: 'aeródromo', [V.OBRA.templo]: c.era === 4 ? 'iglesia' : c.era >= 5 && c.era <= 6 ? 'catedral' : 'templo', [V.OBRA.saber]: M.CASA_SABER(c.era), [V.OBRA.torre]: 'torre', [V.OBRA.molino]: 'molino', [V.OBRA.puerto]: 'puerto', [V.OBRA.cuartel]: 'cuartel', [V.OBRA.arqueria]: 'arquería', [V.OBRA.castillo]: 'castillo', [V.OBRA.aduana]: 'puesto fronterizo', [V.OBRA.petroleo]: 'pozo de petróleo', [V.OBRA.mina]: 'mina' }[o] || 'obra');
    const vistas = new Set();
    const lista = nec.filter(n => { const k = n.obra + (n.capital ? 'c' : n.region); if (vistas.has(k)) return false; vistas.add(k); return true; }).map(n => {
      const donde = n.capital ? '' : ' <span class="tenue">(en ' + esc(((m.ciudades || []).find(x => x.region === n.region) || { nombre: 'otra ciudad' }).nombre) + ')</span>';
      return '<li class="' + (n.falta ? 'no' : 'ok') + '"><b>' + (n.falta ? '✗ ' : '✓ ') + esc(n.nombre) + '</b>' + donde + ' — ' + esc(n.falta ? n.mal : n.bien) +
        (n.falta ? ' <span class="tenue">(' + (n.estab < 0 ? n.estab + ' de estabilidad' : '') + ')</span>' + (c.jugador && n.capital && ORDEN[n.obra] ? ' <button type="button" class="obrar nec-obrar" data-orden="' + ORDEN[n.obra] + '">Hacer ' + esc(n.edificio) + '</button>' : '') : '') + '</li>';
    }).join('');
    return '<div class="arbol"><p class="arbol-ayuda">' + (est >= 0 ? esc(ESTA[est]) + ' <span class="tenue">Quedan ' + quedan + ' turnos.</span>' : '') + '</p>' +
      '<p class="arbol-ayuda">' + ({ aceite: '🏮 Alumbrado: faroles de aceite en las plazas.', gas: '🕯 Alumbrado: farolas de gas victorianas por las calles.', electrico: '💡 Alumbrado eléctrico: farolas y luz en las casas.' }[c.alumbrado] || (c.era >= 7 ? '🌑 Sin luz eléctrica: hace falta una central (y ser ciudad).' : c.era >= 4 ? '🌑 Calles a oscuras: los faroles llegan al ser pueblo' + (c.era >= 6 ? ' (las farolas de gas, al ser villa)' : '') + '.' : '🔥 De noche solo hay hogueras: el alumbrado llega con la Edad Media.')) + '</p>' +
      '<p class="arbol-ayuda">' + cara + ' Ánimo de la gente: <b>' + animo + '</b>/100 <span class="barra mini"><span style="width:' + animo + '%"></span></span></p>' +
      (() => {
        // Los campos: cuántos de cada cultivo, cuántos con regadío y lo cosechado.
        const v = m.vida, ter = V.terrenos(m), cuenta = {}; let reg = 0;
        for (const r of S.casillas(m, c)) for (const t of V.parcelas(m, r)) if (v.obra[t] === V.OBRA.campo) { const k = V.cultivoTipo(m, ter, t); cuenta[k] = (cuenta[k] || 0) + 1; if (V.regadio(m, ter, t)) reg++; }
        const NOM = { trigo: '🌾 trigo', maiz: '🌽 maíz', arroz: '🍚 arroz', vina: '🍇 viña' }, tot = Object.values(cuenta).reduce((a, b) => a + b, 0);
        if (!tot) return '';
        return '<div class="tec-era">Los campos</div><p class="arbol-ayuda">' + Object.keys(cuenta).map(k => NOM[k] + ' ' + cuenta[k]).join(' · ') + ' · <b>' + reg + '</b> con regadío (junto al río rinden más)' + (c.cosechaRecord && m.turno - c.cosechaRecord < 12 ? ' · <b class="verde">¡cosecha récord!</b>' : '') + '</p><p class="arbol-ayuda tenue">Cada cultivo según la tierra: el trigo en la llanura, el maíz en la selva y la sabana (rinde más), el arroz en los pantanos y junto al agua, la viña en las colinas (menos comida, pero su vino se vende por oro).</p>';
      })() +
      '<div class="tec-era">Lo que necesita ' + esc(c.nombre) + '</div>' +
      (lista ? '<ul class="edad-req nec">' + lista + '</ul>' : '<p class="tenue arbol-ayuda">Un campamento no pide más que comida y techo. Al crecer (aldea, pueblo, villa, ciudad) pedirá granero, plaza, parque y palacio.</p>') +
      '<div class="tec-era">Obras en marcha</div>' +
      (obras.length ? '<ul class="edad-req">' + obras.map(([, a]) => '<li>🏗 ' + esc(NOMBRE_OBRA(a.o)) + ' <span class="barra mini"><span style="width:' + Math.round(100 * (1 - Math.max(0, a.falta) / a.total)) + '%"></span></span></li>').join('') + '</ul>' : '<p class="tenue arbol-ayuda">Ninguna ahora mismo.</p>') +
      '</div>';
  }
  function arbolTecnico(c) {
    const ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id;
    const eras = [...new Set(M.TECNOLOGIAS.map(t => t.era))].filter(e => e <= c.era + 1);
    const pide = c.plan && c.plan.investigar;
    // Subir de edad: requisitos con ✓/✗ y el botón (como en Age of Empires).
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1];
    let edad = '';
    if (sig) {
      const r = S.puedeSubir(m, c), precio = req ? ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => req[k] + ' ' + k).join(' · ') : '';
      const item = (ok, txt) => '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + ' ' + esc(txt) + '</li>';
      const faltaTxt = r.falta.join(' ');
      edad = '<div class="edad"><p class="tec-era">Siguiente edad: ' + esc(sig.nombre) + '</p>' + (c.subiendo ? '<p>⏫ Pasando a ' + esc(sig.con) + ': <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span> faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos' + (c.subiendo.debe ? ' <span class="tenue">· por pagar ' + Object.keys(c.subiendo.debe).map(k => Math.ceil(c.subiendo.debe[k]) + ' de ' + esc(k)).join(', ') + '</span>' : '') + '</p>' :
        '<ul class="edad-req">' + item(!/saber/.test(faltaTxt), 'Saber ' + Math.floor(c.ciencia) + ' / ' + sig.umbral + ' (lo traen tus ' + M.ERUDITO(c.era).varios + ')') +
        (sig.desde != null && !m.libre ? item(!/llegar al año/.test(faltaTxt), 'Año ' + S.anioTexto(sig.desde).replace(/(\d)\.$/, '$1')) : '') +
        (req ? item(!/ser una|ser un|un templo|un cuartel|un castillo/.test(faltaTxt), req.texto.charAt(0).toUpperCase() + req.texto.slice(1)) + item(!/ de (comida|madera|piedra|oro|metal)/.test(faltaTxt), 'Pagar ' + precio) : '') + '</ul>' +
        (c.jugador ? '<button type="button" class="obrar avanzar-edad"' + (r.ok ? '' : ' disabled') + '>Avanzar a ' + esc(sig.nombre) + '</button>' : '')) + '</div>';
    }
    return '<div class="arbol">' + edad + (c.jugador ? '<p class="tenue arbol-ayuda">Las mejoras se investigan en su edificio (el molino, el templo, el cuartel…) y no cuestan recursos: las investigan tus sabios (cuantos más, antes); lo que se paga es el paso de edad. El saber lo traen tus ' + esc(M.ERUDITO(c.era).varios) + '. Toca una para investigarla o escribe «investigad …».</p>' : '') + eras.map(e => {
      const filas = M.TECNOLOGIAS.filter(t => t.era === e).map(t => {
        const hecha = ts.includes(t.id), ahora = inv === t.id, abierta = !hecha && t.era <= c.era;
        const pct = ahora ? Math.min(100, Math.round(100 * c.investigacion.puntos / M.costeTec(t))) : 0;
        const falta = !hecha && !ahora && abierta ? S.faltaPara(m, c, t) : [];
        const precio = '<span class="tec-precio">' + esc(M.LUGARES[t.lugar] || 'la plaza') + ' · la investigan tus sabios</span>';
        const estado = hecha ? '<span class="verde">✓</span>' : ahora ? '<span class="barra mini"><span style="width:' + pct + '%"></span></span> ' + pct + ' %' : abierta ? (c.jugador ? '<button type="button" class="ejemplo tec-elegir" data-nombre="' + esc(t.nombre) + '">' + (pide === t.id ? 'siguiente' : 'investigar') + '</button>' : '<span class="tenue">pendiente</span>') : '<span class="tenue">🔒</span>';
        return '<li class="tec' + (hecha ? ' hecha' : ahora ? ' ahora' : abierta ? '' : ' cerrada') + '"><span class="tec-nombre">' + esc(t.nombre) + '</span> <span class="tenue">' + esc(t.texto) + '</span> <span class="tec-estado">' + estado + '</span>' + (hecha ? '' : '<br>' + precio + (falta.length ? ' <span class="rojo">· falta ' + esc(falta.join(', ')) + '</span>' : '')) + '</li>';
      }).join('');
      return '<p class="tec-era">' + esc(M.ERAS[e].nombre) + (e > c.era ? ' <span class="tenue">· próxima era</span>' : '') + '</p><ul class="tec-lista">' + filas + '</ul>';
    }).join('') + '</div>';
  }
  function planDe(c) {
    const p = c.plan || {}, pr = p.prioridad || {}, l = [];
    const barras = Object.keys(X.NOMBRE_RECURSO).map(k => {
      const v = pr[k] != null ? pr[k] : 1;
      return '<div class="prio"><span class="prio-nombre">' + X.NOMBRE_RECURSO[k] + '</span><span class="prio-barra" aria-hidden="true">' +
        [0.5, 1, 1.5, 2].map(x => '<i class="' + (v >= x ? 'lleno' : '') + '"></i>').join('') + '</span><span class="prio-nivel">' + X.NIVEL(v) + '</span></div>';
    }).join('');
    const rumbo = typeof p.rumbo === 'number' ? 'hacia ' + ((S.civ(m, p.rumbo) || {}).nombre || '?') : p.rumbo ? 'hacia el ' + p.rumbo : null;
    if (rumbo && p.expandir !== false) l.push(fila('Rumbo', esc(rumbo)));
    const socios = (p.socios || []).map(id => S.civ(m, id)).filter(o => o && o.viva).map(o => o.nombre);
    if (socios.length) l.push(fila('Tratados', esc(socios.join(', '))));
    const ofertas = Object.keys(m.ofertas || {}).map(Number).filter(id => S.civ(m, id) && S.enGuerra(c, S.civ(m, id)) && m.turno - m.ofertas[id] <= 15).map(id => S.civ(m, id).nombre);
    if (ofertas.length) l.push(fila('Te ofrecen paz', '<span class="rojo">' + esc(ofertas.join(', ')) + '</span>'));
    const cq = (p.cuadrillas || []).map(g => esc(g.texto) + ' <span class="tenue">' + (g.hasta ? esc(X.queda(m, c, g.hasta, VELOCIDADES[vel][0])) : 'hasta nueva orden') + '</span>');
    if (cq.length) l.push(fila('Cuadrillas', cq.join('<br>')));
    const cupos = Object.keys(p.cupos || {}).map(k => p.cupos[k].n + ' ' + X.OFICIOS_N[k] + (p.cupos[k].hasta ? ' <span class="tenue">' + esc(X.queda(m, c, p.cupos[k].hasta, VELOCIDADES[vel][0])) + '</span>' : ''));
    if (cupos.length) l.push(fila('Cupos', cupos.join(', ')));
    const n = X.cuentaOficios(m, c);
    l.push(fila('Oficios', n.map((k, i) => k + ' ' + X.OFICIOS_N[i]).join(', ')));
    return '<div class="plan"><p class="plan-titulo">Prioridades <span class="tenue">· tu pueblo se gobierna solo; cámbialas escribiendo («más madera», «menos ejército», «todo a la ciencia»)</span></p><div class="prios">' + barras + '</div>' + (l.length ? '<dl>' + l.join('') + '</dl>' : '') + '</div>';
  }

  const NOMBRES_OFICIO = { lenador: 'leñadores', granjero: 'granjeros', constructor: 'constructores', minero: 'mineros', guerrero: 'guerreros', comerciante: 'comerciantes' };
  // Lo que piensa este pueblo de los demás, de mejor a peor, con el motivo que más pesa.
  function opiniones(c) {
    const palabra = r => (r > 40 ? 'amistad' : r > 15 ? 'cordial' : r > -15 ? 'neutral' : r > -45 ? 'tensa' : 'hostil');
    const otros = S.vivas(m).filter(o => o.id !== c.id).sort((a, b) => (c.rel[b.id] || 0) - (c.rel[a.id] || 0));
    return otros.slice(0, 6).map(o => {
      const r = Math.round(c.rel[o.id] || 0), mot = S.motivos(m, c, o).slice().sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
      return '<span class="' + (r <= -45 || S.enGuerra(c, o) ? 'rojo' : '') + '">' + esc(o.nombre) + '</span> <span class="tenue">' + (S.enGuerra(c, o) ? 'en guerra' : palabra(r) + ' ' + (r > 0 ? '+' : '') + r) + (mot ? ' (' + esc(mot[0]) + ')' : '') + '</span>';
    }).join('<br>') || '<span class="tenue">no conoce a nadie</span>';
  }
  // Los complots en marcha que tocan a este pueblo, con su progreso.
  function complotsDe(c) {
    const l = (m.complots || []).filter(p => p.de === c.id || p.contra === c.id);
    return l.map(p => {
      const a = S.civ(m, p.de), b = S.civ(m, p.contra);
      const texto = p.tipo === 'guerra' ? (p.de === c.id ? 'trama una guerra contra ' + b.nombre : a.nombre + ' trama una guerra contra él') : 'negocia una alianza con ' + (p.de === c.id ? b.nombre : a.nombre);
      const porque = p.motivo ? ' <span class="tenue">(' + esc(p.motivo) + ')</span>' : '';
      return '<span class="' + (p.tipo === 'guerra' ? 'rojo' : '') + '">' + esc(texto) + '</span> <span class="barra"><span style="width:' + Math.min(100, Math.round(p.progreso)) + '%"></span></span> <span class="tenue">' + Math.min(100, Math.round(p.progreso)) + '%</span>' + porque;
    }).join('<br>');
  }
  // La banca del reino: el fondo, el interés (con botones si es tu pueblo), los empresarios y las deudas.
  function bancaDe(c) {
    const mio = tuPueblo() === c, l = [], mercs = M.vida.mercaderesDe(m, c), boton = (orden, texto, activo) => '<button type="button" class="mando sutil mercado-orden' + (activo ? ' activa' : '') + '" data-orden="' + orden + '">' + texto + '</button>';
    // Los gremios de mercaderes (desde la Edad Media).
    if (c.era >= 4) {
      const enGremio = id => m.vida.aldeanos.filter(x => x.gremio === id && x.o === 5 && x.c === c.id).length;
      // Por casas comerciales: cada familia con su gremio principal y sus sucursales.
      const casas = mercs.filter(a => a.merc.de == null).map(a => { const suc = mercs.filter(x => x.merc.de === a.id); return { a, suc, gente: enGremio(a.id) + suc.reduce((k, x) => k + enGremio(x.id), 0) }; });
      l.push(casas.length ? '🏪 ' + casas.map(({ a, suc, gente }) => 'Casa ' + esc(a.familia || a.nombre) + ' <span class="tenue">(' + esc(a.nombre) + (suc.length ? ', ' + suc.length + (suc.length > 1 ? ' sucursales' : ' sucursal') : '') + ', ' + gente + ' comerciantes, caja ' + Math.round(a.merc.caja) + (a.merc.casona != null ? ', con ' + (c.era >= 6 ? 'mansión' : c.era >= 5 ? 'palacete' : 'casona') : '') + (a.merc.muelle != null ? ', con muelle y barco' : '') + ')</span>').join(', ') : '<span class="tenue">Sin gremios aún: el comerciante que junte lo bastante fundará uno.</span>');
    }
    if (c.bancos > 0 && c.banca) {
      const b = c.banca, n = M.vida.nivelInteres(c), bancos = M.vida.banquerosDe(m, c), emp = M.vida.empresariosDe(m, c).filter(a => a.emp.neg !== 'banco');
      l.push('🏛 Banco central: <b>' + Math.round(b.fondo) + '</b> de oro <span class="tenue">· prestado ' + Math.round(b.prestado) + ', devuelto ' + Math.round(b.devuelto) + (b.quiebras ? ', ' + b.quiebras + (b.quiebras === 1 ? ' quiebra' : ' quiebras') : '') + '</span>' + (mio ? ' ' + boton('pasad 20 de oro al banco central', '+20') + ' ' + boton('sacad 20 de oro del banco central al tesoro', '−20') : ''));
      l.push('Interés <b>' + (n === 0.5 ? 'bajo' : n === 1.5 ? 'alto' : 'normal') + '</b>' + (mio ? ' ' + [[0.5, 'bajad los intereses', 'Bajo'], [1, 'intereses normales', 'Normal'], [1.5, 'subid los intereses', 'Alto']].map(([k, o, t]) => boton(o, t, k === n)).join(' ') : ''));
      l.push(bancos.length ? '🏦 ' + bancos.map(a => 'Banco ' + esc(a.nombre + ' ' + (a.familia || '')) + ' <span class="tenue">(' + Math.round(a.emp.capital) + ' de capital' + (a.emp.deuda > 0 ? ', debe al central ' + Math.round(a.emp.deuda) : '') + ')</span>').join(', ') : '<span class="tenue">Sin banqueros aún: el mercader más rico abrirá un banco cuando tenga fortuna.</span>');
      if (emp.length) l.push('🎩 ' + emp.map(a => esc(a.nombre + ' ' + (a.familia || '')) + ' <span class="tenue">(' + (a.emp.neg === 'fabrica' ? 'fábrica' : 'mercader') + (a.emp.deuda > 0 ? ', debe ' + Math.round(a.emp.deuda) : ', pagado') + ')</span>').join(', '));
    } else l.push('<span class="tenue">' + (c.era >= 5 ? 'Sin banco: hace falta una villa o ciudad (lo construyen solos o «construid un banco»).' : 'El banco llega con el Renacimiento; mientras, los comerciantes ahorran' + (c.era >= 4 ? ' y los mercaderes hacen sus gremios.' : ' (los gremios llegan con la Edad Media).')) + '</span>');
    const nombreC = id => esc((S.civ(m, id) || { nombre: '?' }).nombre);
    for (const cr of (m.creditos || []).filter(x => x.de === c.id)) l.push('Os debe ' + nombreC(cr.a) + ': ' + Math.round(cr.resta) + (mio ? ' ' + boton('perdonad la deuda de ' + nombreC(cr.a), 'Perdonar') : ''));
    for (const cr of (m.creditos || []).filter(x => x.a === c.id)) l.push('Debe a ' + nombreC(cr.de) + ': ' + Math.round(cr.resta) + ' <span class="tenue">(' + cr.cuota + ' cada dos turnos)</span>');
    return l.join('<br>');
  }
  function comercioDe(c) {
    const rutas = (m.vida.rutas || []).filter(r => r.tipo !== 'calle' && (r.a === c.id || r.b === c.id));
    if (!rutas.length) return '<span class="tenue">sin rutas todavía (llegan con las ciudades y con los vecinos amigos)</span>';
    const fuera = rutas.filter(r => r.tipo === 'externa').map(r => (S.civ(m, r.a === c.id ? r.b : r.a) || {}).nombre).filter(Boolean);
    const hecho = Math.round(100 * rutas.reduce((k, r) => k + r.tiles.filter(t => m.vida.camino[t]).length, 0) / Math.max(1, rutas.reduce((k, r) => k + r.tiles.length, 0)));
    return rutas.length + ' ruta' + (rutas.length > 1 ? 's' : '') + (fuera.length ? ' (con ' + esc(fuera.join(', ')) + ')' : ' internas') + ' <span class="tenue">· ' + (c.comerciantes || 0) + ' comerciantes con carreta · caminos al ' + hecho + '%</span>';
  }
  // Las ciudades con su lealtad (y su peor motivo); las que conspiran, en rojo con el progreso del complot.
  // La ficha de un aldeano: es un agente con su vida propia.
  const OFICIO1 = { lenador: 'leñador', granjero: 'granjero', constructor: 'constructor', minero: 'minero', guerrero: 'guerrero', comerciante: 'comerciante' };
  // ---------- La ficha de un edificio (y la de una ciudad, si es su ayuntamiento o su campamento) ----------
  const NOMBRE_TIPO = o => { const O = M.vida.OBRA; return ({ [O.casa]: 'casa', [O.molino]: 'molino', [O.templo]: 'templo', [O.saber]: 'casa del saber', [O.torre]: 'torre', [O.cuartel]: 'cuartel', [O.arqueria]: 'arquería', [O.castillo]: 'castillo', [O.puerto]: 'puerto', [O.pozo]: 'pozo', [O.granero]: 'granero', [O.fuente]: 'plaza pública', [O.parque]: 'parque', [O.palacio]: 'palacio', [O.central]: 'central eléctrica', [O.banco]: 'banco central', [O.bancopriv]: 'banco', [O.muelle]: 'muelle', [O.inmopriv]: 'oficina de una inmobiliaria', [O.minapriv]: 'mina de una compañía', [O.gremio]: 'gremio', [O.casona]: 'casona', [O.fabrica]: 'fábrica', [O.estacion]: 'estación de tren', [O.hospital]: 'hospital', [O.aerodromo]: 'aeródromo', [O.campamento]: 'campamento', [O.aduana]: 'puesto fronterizo', [O.petroleo]: 'pozo de petróleo', [O.mina]: 'mina', [O.ayuntamiento]: 'ayuntamiento', [O.centro]: 'plaza mayor', [O.ruina]: 'ruinas' })[o] || 'edificio'; };
  const hace = anio => { const d = Math.max(0, Math.round(m.anio - anio)); return d === 0 ? 'este año' : d === 1 ? 'hace 1 año' : 'hace ' + d.toLocaleString('es-ES') + ' años'; };
  const anioTxt = a => S.anioTexto(a).replace(/(\d)\.$/, '$1');
  const esNinoV = a => (a.edad || 0) < 2;
  function fichaEdificio(f) {
    const v = m.vida, t = edificioSel, o = v.obra[t], an = v.andamios && v.andamios[t], rec = v.edificios && v.edificios[t];
    if (!o && !an) { edificioSel = null; return false; }
    const r = M.vida.region(m, t), c = S.civ(m, m.dueno[r]);
    const ciudad = (m.ciudades || []).find(x => x.region === r && (o === M.vida.OBRA.ayuntamiento || o === M.vida.OBRA.campamento || (an && an.o === M.vida.OBRA.ayuntamiento)));
    if (ciudad) return fichaCiudad(f, ciudad, c, rec);
    const vecinos = o === M.vida.OBRA.casa ? v.aldeanos.filter(a => a.casa === t) : [];
    const obreros = an && v.obreros && v.obreros[t] ? v.obreros[t].map(id => v.aldeanos.find(a => a.id === id)).filter(Boolean) : [];
    // Una casa se llama por la familia que vive en ella (la más numerosa), no por quien la construyó.
    const famDe = () => { const k = {}; for (const a of vecinos) if (a.familia) k[a.familia] = (k[a.familia] || 0) + 1 + (esNinoV(a) ? 0 : 0.5); const top = Object.keys(k).sort((x, y) => k[y] - k[x] || (x < y ? -1 : 1))[0]; return top; };
    const familiaCasa = vecinos.length ? famDe() : null;
    const titulo = familiaCasa ? 'Casa de los ' + familiaCasa : rec ? rec.nombre : an ? NOMBRE_TIPO(an.o).charAt(0).toUpperCase() + NOMBRE_TIPO(an.o).slice(1) + ' en obras' : NOMBRE_TIPO(o).charAt(0).toUpperCase() + NOMBRE_TIPO(o).slice(1);
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(titulo) + '</h3><p class="subt">' + esc(NOMBRE_TIPO(an ? an.o : o)) + (c ? ' de ' + esc(c.nombre) : '') + ' · en ' + esc(M.vida.lugarDe ? M.vida.lugarDe(m, t) : '') + '</p><dl>' +
      (an ? fila('Obras', '<span class="barra"><span style="width:' + Math.round(100 * (1 - Math.max(0, an.falta) / an.total)) + '%"></span></span> ' + Math.round(100 * (1 - Math.max(0, an.falta) / an.total)) + ' %') + (obreros.length ? fila('Trabajan', esc(obreros.map(a => a.nombre + ' ' + (a.familia || '')).join(', '))) : '') : '') +
      (rec ? fila('Construido', esc(anioTxt(rec.anio)) + ' <span class="tenue">(' + hace(rec.anio) + ')</span>') + (rec.por && rec.por.length ? fila('Lo levantó', esc(rec.por.join(', '))) : '') + fila('Estilo', 'de ' + esc(M.ERAS[rec.era].con) + (c && M.vida.fase(rec.era) < M.vida.fase(c.era) ? ' <span class="tenue">(antiguo: lo reformarán)</span>' : '')) : (!an ? fila('Construido', '<span class="tenue">antes de que nadie lo apuntara</span>') : '')) +
      (o === M.vida.OBRA.mina ? fila('Da', 'piedra, metal (desde el Bronce), carbón (desde la industria) y algo de oro; más despacio que las vetas sueltas, pero nunca se agota') + fila('Mineros dentro', v.aldeanos.filter(x => x.enMina && x.tx === t % v.tw && x.ty === (t / v.tw | 0)).length) : '') +
      (o === M.vida.OBRA.petroleo ? fila('Da', '1,2 de petróleo por turno, sin que nadie lo cargue') + fila('Petróleo de ' + esc(c ? c.nombre : '—'), c ? Math.round(c.petroleo || 0) + ' en el almacén' : '—') : '') +
      ([M.vida.OBRA.fabrica, M.vida.OBRA.estacion, M.vida.OBRA.central].includes(o) && c && c.era >= 6 ? (() => { const k = o === M.vida.OBRA.fabrica ? 'fabrica' : o === M.vida.OBRA.estacion ? 'tren' : 'central'; return fila('Combustible', (M.vida.enMarcha(c, k) ? '⛽ en marcha' : '<b class="rojo">⛔ parada: no hay ' + (k === 'central' ? 'carbón ni petróleo' : 'carbón') + '</b>') + ' <span class="tenue">· gasta ' + String(M.vida.GASTO[k]).replace('.', ',') + ' de carbón por turno</span>'); })() : '') +
      (o === M.vida.OBRA.aduana ? (() => {
        const ad = (v.aduanas || {})[t] || { controles: 0, arancel: 0 }, guardias = v.aldeanos.filter(a => a.guardiaEn === t && a.c === (c && c.id));
        return fila('Control', ad.controles + ' carretas revisadas · ' + ad.arancel + ' de oro en aranceles') + fila('Guardias', guardias.length ? esc(guardias.map(a => a.nombre + ' ' + (a.familia || '')).join(', ')) : '<span class="tenue">nadie de guardia ahora</span>') + fila('En guerra', 'la barrera se cierra y sus guardias disparan a los enemigos que se acerquen');
      })() : '') +
      (vecinos.length ? fila('Viven aquí', vecinos.map(a => '<button type="button" class="enlace ver-aldeano" data-id="' + a.id + '">' + esc(a.nombre + ' ' + (a.familia || '')) + '</button> <span class="tenue">(' + M.vida.anos(a) + ')</span>').join(', ')) : o === M.vida.OBRA.casa ? fila('Viven aquí', '<span class="tenue">nadie ahora mismo</span>') : '') +
      (rec && rec.historia && rec.historia.length ? fila('Historia', rec.historia.slice(-6).map(h => esc(anioTxt(h.anio)) + ': ' + esc(h.texto)).join('<br>')) : '') +
      '</dl><div class="linea" style="margin-top:10px"><button type="button" class="mando sutil" id="volver-pueblo">Ver su pueblo</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelectorAll('.ver-aldeano').forEach(b => b.addEventListener('click', () => { edificioSel = null; aldeanoSel = +b.dataset.id; P.elegirAldeano(aldeanoSel); pintarFicha(); }));
    f.querySelector('#volver-pueblo').addEventListener('click', () => { edificioSel = null; if (c) elegir(c.id, true); });
    return true;
  }
  function fichaCiudad(f, x, c, rec) {
    const v = m.vida, vecinos = v.aldeanos.filter(a => a.c === x.civ && a.h === x.region);
    const zona = [x.region, ...S.vecinos(x.region)].filter(r => m.dueno[r] === x.civ);
    const edificios = Object.entries(v.edificios || {}).filter(([t, e]) => zona.includes(M.vida.region(m, +t)) && !e.ruina && e.tipo !== M.vida.OBRA.casa && v.obra[+t] === e.tipo).map(([, e]) => e.nombre);
    const casas = zona.flatMap(r => M.vida.parcelas(m, r)).filter(t => v.obra[t] === M.vida.OBRA.casa).length;
    const FASE = { campamento: '⛺ campamento de colonos', obras: '🏗 levantando su ayuntamiento', aldea: '🏘 aldea' };
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(x.nombre) + '</h3><p class="subt">' + esc(FASE[x.fase] || 'ciudad') + (c ? ' de ' + esc(c.nombre) : '') + '</p><dl>' +
      fila('Fundada', x.fundada != null ? esc(anioTxt(x.fundada)) + ' <span class="tenue">(' + hace(x.fundada) + ')</span>' : '<span class="tenue">hace mucho</span>') +
      (x.fundadores && x.fundadores.length ? fila('La fundaron', esc(x.fundadores.join(', ')) + (x.madre ? ' <span class="tenue">· colonos de ' + esc(x.madre) + '</span>' : '')) : x.madre ? fila('Hija de', esc(x.madre)) : '') +
      fila('Vecinos', vecinos.length + ' <span class="tenue">· ' + casas + ' casas</span>') +
      (x.fase === 'campamento' ? fila('Para ser aldea', 'necesita 6 vecinos (' + vecinos.length + ') y 2 casas (' + (x.casasCerca || 0) + '); entonces levantará su ayuntamiento') : '') +
      fila('Alcalde', esc(x.alcalde || '—') + (x.rasgo ? ' <span class="tenue">(' + esc(x.rasgo) + ')</span>' : '')) +
      (x.lealtad != null ? fila('Lealtad', Math.round(x.lealtad)) : '') +
      (edificios.length ? fila('Edificios', esc(edificios.slice(0, 8).join(' · '))) : '') +
      (x.historia && x.historia.length ? fila('Historia', x.historia.slice(-6).map(h => esc(anioTxt(h.anio)) + ': ' + esc(h.texto)).join('<br>')) : '') +
      '</dl><div class="linea" style="margin-top:10px"><button type="button" class="mando sutil" id="volver-pueblo">Ver su reino</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelector('#volver-pueblo').addEventListener('click', () => { edificioSel = null; if (c) elegir(c.id, true); });
    return true;
  }
  function fichaAldeano(f) {
    const a = m.vida.aldeanos.find(x => x.id === aldeanoSel);
    if (!a) {
      f.innerHTML = '<p class="vacio">Ese aldeano ha muerto. Toca a otro en el mapa, o un pueblo para ver cómo vive.</p>';
      aldeanoSel = null; P.elegirAldeano(null); if (P.siguiendoA() != null) P.seguir(null);
      return true;
    }
    const c = S.civ(m, a.c), ciudad = (m.ciudades || []).find(x => x.region === a.h);
    const padre = a.padre != null ? m.vida.aldeanos.find(x => x.id === a.padre) : null;
    const hijosVivos = m.vida.aldeanos.filter(x => x.padre === a.id || x.madre === a.id).length;
    const etapa = (a.edad || 0) < M.vida.ADULTO ? 'niño' : (a.edad || 0) >= M.vida.VIEJO ? 'anciano' : 'adulto';
    const oficio = (a.edad || 0) < M.vida.ADULTO ? 'juega cerca de casa' : a.colono != null ? 'colono, de camino a tierras nuevas' : (M.vida.OFICIOS[a.o] === 'erudito' ? M.ERUDITO((S.civ(m, a.c) || { era: 0 }).era).uno + (a.estudios ? ' · ' + a.estudios + ' jornadas de estudio' : '') : OFICIO1[M.vida.OFICIOS[a.o]]) + (M.vida.OFICIOS[a.o] === 'guerrero' ? (a.tirador ? ' tirador' : ' de cuerpo a cuerpo') : '');
    const siguiendo = P.siguiendoA() === a.id;
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(a.nombre + ' ' + (a.familia || '')) + '</h3>' +
      '<p class="subt">' + esc(etapa) + ' de ' + esc(c ? c.nombre : '—') + (ciudad ? ', vive en ' + esc(ciudad.nombre) : c && a.h === c.capital ? ', vive en la capital' : '') + '</p>' +
      '<dl>' + fila('Oficio', esc(oficio)) + (a.ministro ? fila('Cargo', '🏛 Ministro de economía: trabaja en el banco central y compra y vende por el reino') : '') + (a.merc && a.merc.de != null ? fila('Gremio', '🏪 Lleva una sucursal de la casa ' + esc(a.familia || '') + ' <span class="tenue">· manda lo que gana a ' + esc(((m.vida.aldeanos.find(x => x.id === a.merc.de) || {}).nombre) || 'su familia') + ', ' + m.vida.aldeanos.filter(x => x.gremio === a.id && x.o === 5).length + ' comerciantes</span>') : a.merc ? fila('Gremio', '🏪 Mercader con su gremio <span class="tenue">· caja ' + Math.round(a.merc.caja) + ', ' + m.vida.aldeanos.filter(x => x.gremio === a.id && x.o === 5).length + ' comerciantes' + (a.merc.casona != null ? ', vive en su ' + (c.era >= 6 ? 'mansión' : c.era >= 5 ? 'palacete' : 'casona') : '') + '</span>') : a.gremio != null && a.o === 5 ? fila('Gremio', 'trabaja para el gremio de ' + esc(((m.vida.aldeanos.find(x => x.id === a.gremio) || {}).familia) || '?') + ' <span class="tenue">(cobra un sueldo)</span>') : '') + (a.emp ? fila('Negocio', a.emp.neg === 'banco' ? '🏦 Banquero <span class="tenue">· ' + Math.round(a.emp.capital) + ' de capital' + (a.emp.deuda > 0 ? ', debe al banco central ' + Math.round(a.emp.deuda) : '') + '</span>' : '🎩 ' + (a.emp.neg === 'fabrica' ? 'Dueño de una fábrica' : 'Mercader') + ' <span class="tenue">· ' + (a.emp.deuda > 0 ? 'debe ' + Math.round(a.emp.deuda) + (a.emp.banquero != null ? ' a su banquero' : ' al banco central') : 'sin deudas') + ', caja ' + Math.round(a.emp.caja || 0) + '</span>') : '') + ((a.dinero || 0) >= 1 ? fila('Ahorros', Math.round(a.dinero) + ' de oro') : '') + fila('Edad', M.vida.anos(a) + ' años <span class="tenue">(nació en ' + M.ERAS[a.eraNacio != null ? a.eraNacio : c.era].con + ')</span>') +
      fila('Vida', vidaAldeano(a)) + fila('Lleva', equipoAldeano(a)) +
      fila('Rasgos', a.rasgos && a.rasgos.length ? esc(a.rasgos.join(', ')) : '<span class="tenue">ninguno especial</span>') +
      fila('Padres', (() => {
        // Padre y madre (con enlace si viven); si murieron, su nombre queda en la ficha.
        const vivo = id => id != null ? m.vida.aldeanos.find(x => x.id === id) : null, l = [];
        const ps = a.padres || (padre ? [padre.nombre + ' ' + (padre.familia || ''), null] : null);
        if (!ps) return '<span class="tenue">llegó de fuera (de los primeros pobladores)</span>';
        const dif = m.vida.difuntos || {};
        [[a.padre, ps[0]], [a.madre, ps[1]]].forEach(([id, nom]) => { if (!nom) return; const p = vivo(id), d = id != null ? dif[id] : null; l.push(p ? '<button type="button" class="enlace ver-aldeano" data-id="' + p.id + '">' + esc(nom) + '</button> <span class="tenue">(' + M.vida.anos(p) + ')</span>' : esc(nom) + ' <span class="tenue">(†' + (d ? ' a los ' + d.anos + ', de ' + esc(d.causa) : '') + ')</span>'); });
        return l.join(' y ');
      })()) +
      (a.parejaNombre ? fila('Pareja', (() => { const p = m.vida.aldeanos.find(x => x.id === a.pareja); return p ? '<button type="button" class="enlace ver-aldeano" data-id="' + p.id + '">' + esc(a.parejaNombre) + '</button>' : esc(a.parejaNombre) + ' <span class="tenue">(†)</span>'; })()) : '') +
      fila('Hijos', (a.hijos || 0) + (hijosVivos !== (a.hijos || 0) ? ' <span class="tenue">(' + hijosVivos + ' vivos)</span>' : '') + (() => { const hs = m.vida.aldeanos.filter(x => x.padre === a.id || x.madre === a.id).slice(0, 5); return hs.length ? ': ' + hs.map(h => '<button type="button" class="enlace ver-aldeano" data-id="' + h.id + '">' + esc(h.nombre) + '</button>').join(', ') : ''; })()) +
      (() => { const her = a.padre != null ? m.vida.aldeanos.filter(x => x !== a && x.padre === a.padre).length : 0; return her ? fila('Hermanos', her) : ''; })() +
      fila('Nació', (a.nacioEn ? 'en ' + esc(a.nacioEn) + ', ' : '') + (m.libre ? 'el año ' + (a.nacio != null ? a.nacio : m.anio) : esc(anioTxt(a.nacio != null ? a.nacio : m.anio)))) +
      (a.casa != null && m.vida.edificios && m.vida.edificios[a.casa] ? fila('Vive en', '<button type="button" class="enlace ver-edificio" data-t="' + a.casa + '">' + esc(m.vida.edificios[a.casa].nombre) + '</button>') : '') +
      (a.bajas ? fila('En combate', a.bajas + ' enemigos abatidos') : '') +
      fila('Hambre', a.hambre ? '<span class="rojo">' + a.hambre + ' turnos sin comer bien</span>' : 'bien alimentado') +
      (M.vida.pausada(m) && M.vida.riesgoAnual ? (() => {
        // La salud: lo que le acerca o le aleja de la muerte, y la probabilidad de no llegar al año que viene.
        const r = M.vida.riesgoAnual(m, a, c), pct = r.p * 100, f = r.salud.f;
        const estado = f <= 0.85 ? '💚 buena' : f <= 1.25 ? '💛 normal' : f <= 1.8 ? '🧡 delicada' : '❤️‍🩹 mala';
        const motivos = r.salud.motivos.sort((x, y) => Math.abs(Math.log(y[0])) - Math.abs(Math.log(x[0]))).slice(0, 4).map(([k, t]) => '<span class="' + (k > 1 ? 'rojo' : 'verde') + '">' + (k > 1 ? '▲ ' : '▼ ') + esc(t) + '</span>').join(' · ');
        return fila('Salud', estado + ' <span class="tenue">· riesgo de morir este año: ' + (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + ' %</span>' + (motivos ? '<br>' + motivos : ''));
      })() : '') +
      (M.vida.pausada(m) ? fila('Ánimo', (() => { const k = M.vida.animoDe(m, a); return (k >= 75 ? '😊 contento' : k >= 50 ? '🙂 tranquilo' : k >= 30 ? '😟 preocupado' : '😠 harto') + ' <span class="tenue">(' + k + ')</span>'; })()) + fila('Ahora', a.dormir ? (a.enCasa ? 'duerme en casa 💤' : 'vuelve a casa a dormir') : a.paseo === 2 ? 'descansa en la plaza o el parque' : esc(OFICIO1[M.vida.OFICIOS[a.o]] || 'trabaja')) : '') + '</dl>' +
      (c && c.jugador && (a.edad || 0) >= M.vida.ADULTO && a.colono == null ? '<div class="tec-era">Mándale un oficio</div><div class="linea aldeano-oficios">' + M.vida.OFICIOS.map((o, k) => '<button type="button" class="mando sutil oficio-a' + (a.o === k ? ' activa' : '') + '" data-k="' + k + '">' + esc(o === 'erudito' ? M.ERUDITO(c.era).uno : OFICIO1[o] || o) + '</button>').join('') + (a.fijo ? ' <button type="button" class="mando sutil oficio-libre" title="Que vuelva a hacer lo que el pueblo necesite">Que decida el pueblo</button>' : '') + '</div>' + (a.fijo && a.fijo.g === 'mano' ? '<p class="tenue arbol-ayuda">Hace lo que le mandaste y nadie se lo cambia.</p>' : '') : '') +
      '<div class="linea" style="margin-top:10px"><button type="button" class="mando" id="seguir">' + (siguiendo ? 'Dejar de seguir' : 'Seguir con la cámara') + '</button> <button type="button" class="mando sutil" id="volver-pueblo">Ver su pueblo</button></div>';
    f.querySelector('.muestra').style.background = c ? c.color : '#ccc';
    f.querySelector('#seguir').addEventListener('click', () => { P.seguir(siguiendo ? null : a.id); pintarFicha(); });
    f.querySelectorAll('.ver-aldeano').forEach(b => b.addEventListener('click', () => { aldeanoSel = +b.dataset.id; P.elegirAldeano(aldeanoSel); pintarFicha(); }));
    f.querySelectorAll('.ver-edificio').forEach(b => b.addEventListener('click', () => { aldeanoSel = null; P.elegirAldeano(null); edificioSel = +b.dataset.t; pintarFicha(); }));
    f.querySelectorAll('.oficio-a').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.k; if (enLinea()) { encolar({ tipo: 'oficio', civ: a.c, id: a.id, k }); responder('📡 Cambio de oficio enviado: se cumple al empezar el próximo turno.', 'bien'); } else { a.fijo = { g: 'mano', vuelve: a.o }; M.vida.mover(a, k); } pintarFicha(); }));
    const libre = f.querySelector('.oficio-libre');
    if (libre) libre.addEventListener('click', () => { delete a.fijo; a.e = 0; pintarFicha(); });
    f.querySelector('#volver-pueblo').addEventListener('click', () => { aldeanoSel = null; P.elegirAldeano(null); P.seguir(null); elegir(a.c, true); });
    return true;
  }
  function ciudadesDe(c) {
    const l = (m.ciudades || []).filter(x => x.civ === c.id);
    return l.map(x => {
      const peor = (x.motivos || []).filter(y => y[1] < 0).sort((p, q) => p[1] - q[1])[0];
      const lealtad = x.lealtad != null ? Math.round(x.lealtad) : null;
      return '<span class="' + (lealtad != null && lealtad < 0 ? 'rojo' : '') + '">' + esc(x.nombre) + '</span> <span class="tenue">alcalde ' + esc(x.alcalde) + (x.rasgo ? ' (' + esc(x.rasgo) + ')' : '') +
        (lealtad != null ? ' · lealtad ' + lealtad + (peor ? ', ' + esc(peor[0]) : '') : '') + (x.complot != null ? ' · <b class="rojo">conspira ' + Math.min(100, Math.round(x.complot)) + '%</b>' : '') + '</span>';
    }).join('<br>');
  }
  function vidaAldeano(a) {
    const max = M.vida.vidaMax(a), pv = a.pv == null ? max : Math.max(0, Math.round(a.pv)), fr = pv / max;
    return '<span class="barra"><span style="width:' + Math.round(fr * 100) + '%;background:' + (fr > 0.6 ? '#4cd060' : fr > 0.3 ? '#e8c040' : '#e04030') + '"></span></span> ' + pv + ' / ' + max + (pv < max ? ' <span class="tenue">(herido; se cura poco a poco)</span>' : '');
  }
  function equipoAldeano(a) {
    const V = M.vida, arma = V.armaDe(a, false), arm = V.ARMADURAS[a.armadura || 0] || V.ARMADURAS[0];
    const lejos = a.o === 4 && a.tirador ? V.armaDe(a, true) : null;
    return esc(arma.nombre) + ' <span class="tenue">(' + arma.dano + ' de daño' + (arma.material ? ', ' + esc(arma.material) : '') + (arma.perfora ? ', atraviesa armaduras' : '') + (arma.bloqueo ? ', el escudo para golpes' : '') + ')</span>' +
      (lejos ? ' · ' + esc(lejos.nombre) + ' <span class="tenue">(' + lejos.dano + ' de lejos)</span>' : '') +
      ' · ' + esc(arm.nombre) + (arm.reduce ? ' <span class="tenue">(−' + Math.round(arm.reduce * 100) + ' % de daño, ' + esc(arm.material) + ')</span>' : '');
  }
  function ganado(c) {
    const reses = m.vida.animales.filter(b => b.c === c.id), ovejas = reses.filter(b => b.tipo === 'oveja').length, vacas = reses.length - ovejas;
    const pastores = m.vida.aldeanos.filter(a => a.c === c.id && a.pastor != null).length, cazan = m.vida.aldeanos.filter(a => a.c === c.id && a.caza != null).length;
    if (!reses.length) return 'ninguno <span class="tenue">(hacen falta pastos libres)</span>';
    return ovejas + (ovejas === 1 ? ' oveja' : ' ovejas') + (vacas ? ', ' + vacas + (vacas === 1 ? ' vaca' : ' vacas') : '') + ' <span class="tenue">· leche, lana y carne' + (pastores ? ' · ' + pastores + ' granjeros con el rebaño' : '') + (cazan ? ' · ' + cazan + ' cazando o pescando' : '') + '</span>';
  }
  function aldeanos(c) {
    const cuenta = Object.create(null);
    for (const a of m.vida.aldeanos) if (a.c === c.id) { const o = M.vida.OFICIOS[a.o]; cuenta[o] = (cuenta[o] || 0) + 1; }
    const partes = M.vida.OFICIOS.filter(o => cuenta[o]).map(o => cuenta[o] + ' ' + (o === 'erudito' ? (cuenta[o] === 1 ? M.ERUDITO(c.era).uno : M.ERUDITO(c.era).varios) : NOMBRES_OFICIO[o]));
    const suyos = m.vida.aldeanos.filter(a => a.c === c.id), ninos = suyos.filter(a => (a.edad || 0) < M.vida.ADULTO).length, viejos = suyos.filter(a => (a.edad || 0) >= M.vida.VIEJO).length;
    const colonos = suyos.filter(a => a.colono != null).length;
    return (partes.length ? esc(partes.join(', ')) : 'ninguno') + ' <span class="tenue">· ' + ninos + ' niños, ' + viejos + ' ancianos · ' + (c.camas || 0) + ' camas' + (c.sinCama ? ' (faltan ' + c.sinCama + ')' : '') + (colonos ? ' · ' + colonos + ' colonos de camino' : '') + '</span>';
  }

  // La crónica: lo que pasa, y al tocarlo, por qué pasó, qué precedente tiene y dónde (la cámara va a mirar).
  const GRANDES = new Set(['guerra', 'paz', 'conquista', 'caida', 'revuelta', 'plaga', 'hambruna', 'sequia', 'alianza', 'nuevo_pueblo', 'fundacion', 'cronista']);
  let filtroCronica = 'todo', cuantosCronica = 20;
  const abiertos = new Set();
  function pintarCronica() {
    const ol = $('cronica');
    ol.innerHTML = '';
    const mio = tuPueblo();
    const botonMio = document.querySelector('#filtro-cronica [data-f="mio"]');
    if (botonMio) botonMio.hidden = !mio;
    if (filtroCronica === 'mio' && !mio) filtroCronica = 'todo';
    const lista = m.cronica.filter(e => filtroCronica === 'todo' ? true : filtroCronica === 'mio' ? e.civ === mio.id || e.divino : e.importante || e.divino || GRANDES.has(e.tipo) || e.tipo.startsWith('era'));
    if (!lista.length) { const li = document.createElement('li'); li.className = 'suceso vacio'; li.textContent = 'Nada todavía.'; ol.appendChild(li); }
    for (const e of lista.slice(0, cuantosCronica)) {
      const li = document.createElement('li');
      const clave = e.turno + ':' + e.titulo;
      li.className = 'suceso' + (e.divino ? ' divino' : '') + (e.importante ? ' importante' : '') + (e.tipo === 'cronista' ? ' cronista' : '') + (abiertos.has(clave) ? ' abierto' : '') + (e.porque || e.casilla != null ? ' tocable' : '') + (e.porque ? ' con-porque' : '');
      li.tabIndex = 0;
      const abrir = () => {
        if (abiertos.has(clave)) abiertos.delete(clave); else abiertos.add(clave);
        li.classList.toggle('abierto');
        if (e.casilla != null && li.classList.contains('abierto')) P.centrarEn(e.casilla, 2.5);
      };
      li.addEventListener('click', abrir);
      li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } });
      li.innerHTML = '<div class="s-cab"><span class="s-anio"></span><span class="s-punto"></span><h4 class="s-titulo"></h4></div><p class="s-texto"></p>';
      li.querySelector('.s-anio').textContent = S.anioTexto(e.anio);
      li.querySelector('.s-punto').style.background = e.color || 'transparent';
      li.querySelector('.s-titulo').textContent = e.titulo;
      li.querySelector('.s-texto').textContent = e.texto;
      if (e.porque) { const p = document.createElement('p'); p.className = 's-porque'; p.innerHTML = '<b>Por qué</b> '; p.appendChild(document.createTextNode(e.porque)); li.appendChild(p); }
      if (e.precedente) { const p = document.createElement('p'); p.className = 's-precedente'; p.innerHTML = '<b>Ya pasó</b> '; p.appendChild(document.createTextNode(e.precedente)); li.appendChild(p); }
      ol.appendChild(li);
    }
    if (lista.length > cuantosCronica && cuantosCronica < 150) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'mando sutil'; b.textContent = 'Ver más sucesos (' + (Math.min(150, lista.length) - cuantosCronica) + ')';
      b.addEventListener('click', () => { cuantosCronica += 30; pintarCronica(); });
      li.className = 'suceso mas'; li.appendChild(b); ol.appendChild(li);
    }
  }

  function pintarEjemplos() {
    const vecino = tuPueblo() && (S.vecinosDe(m, tuPueblo())[0] || S.vivas(m).find(o => o.id !== m.jugador));
    const ej = tuPueblo()
      ? ['Háganme 5 casas', 'Formad un escuadrón de 10 para guardar la capital', 'Esperad el ataque', '¡Al ataque!', 'Hagan defensas', vecino ? 'Espiad a ' + vecino.nombre : 'Espiad al vecino', 'Haced una fiesta', '5 granjeros a talar durante 2 minutos', 'Quiero 10 leñadores', 'Talad 20 árboles', 'La mitad de los mineros a construir hasta tener 30 casas', '¿Cuántos guerreros tengo?', 'Liberad las cuadrillas', 'Informe', 'Más madera', 'Más comida y casas', 'Todo a la ciencia', 'Menos ejército', 'Expandíos hacia el norte', vecino ? 'Atacad a ' + vecino.nombre : 'Atacad al vecino más débil', vecino ? 'Comerciad con ' + vecino.nombre : 'Comerciad con el más rico', 'Como antes']
      : ['Peste sobre el más grande', 'Que el más atrasado descubra la imprenta', 'Incendio en el más grande', 'Que planten bosques en el más pequeño', 'Paz para todos', 'Que aparezca un pueblo nuevo', 'Que llueva oro sobre el más pobre'];
    const cont = $('ejemplos');
    cont.innerHTML = '';
    for (const t of ej) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ejemplo'; b.textContent = t;
      b.addEventListener('click', () => { $('orden').value = t; $('orden').focus(); });
      cont.appendChild(b);
    }
  }

  // Lo que hace el botón de cada paso de la guía.
  function hacerPasoGuia(p) {
    const c = tuPueblo(); if (!c) return;
    if (p.accion === 'ficha') { (m.guia = m.guia || {}).vioFicha = 1; elegir(c.id, true); document.body.classList.remove('sin-panel'); abrirHoja('pueblos'); }
    else if (p.accion === 'corte') abrirCorte(c.id);
    else { $('orden').value = p.boton; $('orden').focus(); }
    pintarConsejo();
  }
  function pintarConsejo() {
    const c = tuPueblo(), k = c ? X.consejo(m, c.id) : null;
    // Mientras dura la guía, el consejero enseña el paso que toca (salvo que haya hambre o guerra: eso va antes).
    const p = c && X.guia ? X.guia(m) : null, urgente = c && (c.guerras.length || (c.comida || 0) < (c.habitantes || 1) * 0.15);
    $('consejo').classList.toggle('guia', !!(p && !urgente));
    if (p && !urgente) {
      $('consejo').hidden = false;
      $('consejo').querySelector('.consejo-quien').textContent = 'Primeros pasos ' + p.n + '/' + p.de;
      $('consejo-texto').textContent = p.texto;
      $('consejo-orden').textContent = p.accion === 'orden' ? '«' + p.boton + '»' : p.boton + ' ›';
      $('consejo-orden').onclick = ev => { ev.stopPropagation(); hacerPasoGuia(p); };
      return;
    }
    $('consejo').querySelector('.consejo-quien').textContent = 'Tu consejero';
    $('consejo').hidden = !k;
    if (!k) return;
    $('consejo-texto').textContent = k.texto;
    $('consejo-orden').textContent = '«' + k.orden + '»';
    $('consejo-orden').onclick = () => { $('orden').value = k.orden; $('orden').focus(); };
  }
  function vehiculosDe(c) {
    const n = {}; for (const a of m.vida ? m.vida.aldeanos : []) if (a.c === c.id && a.veh) n[a.veh] = (n[a.veh] || 0) + 1;
    const V = M.vida.VEHICULOS, partes = Object.keys(n).map(k => n[k] + ' ' + V[k].nombre + (n[k] > 1 ? (k === 'canon' ? 'es' : k === 'artilleria' ? '' : 's') : ''));
    return partes.length ? esc(partes.join(', ')) + (c.era >= 8 ? ' <span class="tenue">· aviones en guerra</span>' : '') : '<span class="tenue">' + (c.cuarteles > 0 ? 'ninguno (cuestan metal: ' + Math.floor(c.metal || 0) + ')' : 'hace falta un cuartel') + '</span>';
  }
  // El marcador de cada guerra: bajas, plazas ganadas y perdidas, qué hace el ejército y cómo va el asedio.
  const nombrePlaza = r => { const x = (m.ciudades || []).find(y => y.region === r); if (x) return x.nombre; const o = S.vivas(m).find(y => y.capital === r); return o ? 'capital de ' + o.nombre : 'una plaza'; };
  function marcadorGuerra(c, corto, max) {
    const v = m.vida, e = v && v.ejercitos && v.ejercitos[c.id];
    // Primero la guerra en que está el ejército, luego las de más bajas.
    const lista = c.guerras.slice().sort((x, y) => ((e && e.con === y.con) - (e && e.con === x.con)) || ((y.muertos || 0) + (y.matados || 0)) - ((x.muertos || 0) + (x.matados || 0))).slice(0, max || 99);
    return lista.map(g => {
      const o = S.civ(m, g.con);
      if (!o) return '';
      const nuestro = e && e.con === o.id ? e : null, suyo = v && v.ejercitos && v.ejercitos[o.id];
      const mio = (g.muertos || 0), suyos = (g.matados || 0), balance = suyos - mio + 6 * ((g.ganadas || 0) - (g.perdidas || 0)) + 2 * (g.comarcas || 0);
      const que = !nuestro ? (S.vecinosDe(m, c).includes(o) ? 'el ejército se prepara' : 'sin frontera común') :
        nuestro.defiende != null ? '🛡 defendiendo ' + esc(nuestro.defiende === c.capital ? 'la capital' : nombrePlaza(nuestro.defiende)) :
        nuestro.fase === 'reunion' ? 'reuniéndose para ir a ' + esc(nombrePlaza(nuestro.obj)) :
        '⚔ sobre ' + esc(nombrePlaza(nuestro.obj)) + (nuestro.estorbo ? ' <span class="tenue">(' + { torre: 'una torre impide el asedio: hay que derribarla', defensores: 'quedan defensores', lejos: 'el capitán aún no ha llegado' }[nuestro.estorbo] + ')</span>' : '') + (nuestro.asedio > 0 ? ' · asedio <span class="barra"><span style="width:' + Math.round(nuestro.asedio) + '%"></span></span> ' + Math.round(nuestro.asedio) + ' %' : '');
      const amenaza = suyo && suyo.con === c.id && m.dueno[suyo.obj] === c.id && suyo.fase === 'marcha' && suyo.defiende == null ? '<br><span class="rojo">⚠ Atacan ' + esc(suyo.obj === c.capital ? 'tu capital' : nombrePlaza(suyo.obj)) + (suyo.asedio > 0 ? ' (asedio ' + Math.round(suyo.asedio) + ' %)' : '') + '</span>' : '';
      return '<div class="guerra-marcador"><b>⚔ ' + esc(o.nombre) + '</b> <span class="' + (balance >= 0 ? 'verde' : 'rojo') + '">' + (balance > 0 ? 'vas ganando' : balance < 0 ? 'vas perdiendo' : 'igualados') + '</span>' +
        '<br><span class="tenue">Bajas</span> ' + mio + ' tuyas · ' + suyos + ' suyas <span class="tenue">· Plazas</span> +' + (g.ganadas || 0) + ' −' + (g.perdidas || 0) + ' <span class="tenue">· Tierras</span> ' + ((g.comarcas || 0) > 0 ? '+' : '') + (g.comarcas || 0) +
        '<br>' + que + amenaza + (corto ? '' : '<br><span class="tenue">Órdenes: «atacad ' + esc(((m.ciudades || []).find(x => x.civ === o.id) || {}).nombre || 'su capital') + '», «defended la capital», «paz con ' + esc(o.nombre) + '».</span>') + '</div>';
    }).join('');
  }
  // Las cuadrillas, cupos y metas en marcha, con lo que les queda (cuenta atrás si se dio en minutos).
  let ultimoPlanHud = '';
  function pintarCuadrillas() {
    const c = tuPueblo(), h = $('cuadrillas-hud');
    if (!h) return;
    if (m.vida) m.vida.msTurno = VELOCIDADES[vel][0];
    const p = c && c.plan, partes = [];
    if (p) {
      for (const g of p.cuadrillas || []) partes.push('⚒ ' + esc(g.texto) + ' <b>' + (g.hasta ? esc(X.queda(m, c, g.hasta, VELOCIDADES[vel][0])) : '∞') + '</b>');
      for (const k of Object.keys(p.cupos || {})) partes.push('📌 ' + p.cupos[k].n + ' ' + X.OFICIOS_N[k] + (p.cupos[k].hasta ? ' <b>' + esc(X.queda(m, c, p.cupos[k].hasta, VELOCIDADES[vel][0])) + '</b>' : ''));
      for (const t of p.temporales || []) partes.push('⏱ ' + esc(X.NOMBRE_RECURSO[t.k]) + ' ' + esc(X.NIVEL(t.puesto)) + ' <b>' + esc(X.queda(m, c, t.hasta, VELOCIDADES[vel][0])) + '</b>');
    }
    const html = partes.join('<span class="sep"> · </span>');
    if (html === ultimoPlanHud) return;
    ultimoPlanHud = html; h.innerHTML = html; h.hidden = !html;
  }
  function pintarGuerra() {
    const c = tuPueblo(), h = $('guerra-hud');
    const html = c && c.guerras.length ? marcadorGuerra(c, true, 2) + (c.guerras.length > 2 ? '<p class="tenue guerra-mas">y ' + (c.guerras.length - 2) + ' guerra' + (c.guerras.length > 3 ? 's' : '') + ' más (pestaña Ejército)</p>' : '') : '';
    h.hidden = !html;
    if (html && h.innerHTML !== html) h.innerHTML = html;
  }
  const movil = () => window.matchMedia('(max-width: 899px)').matches;
  function abrirHoja(nombre) {
    for (const b of document.querySelectorAll('.panel-pestanas .pestana')) b.classList.toggle('activa', b.dataset.panel === nombre);
    for (const h of document.querySelectorAll('.panel-hoja')) h.hidden = h.dataset.hoja !== nombre;
    document.body.classList.remove('sin-panel');
  }
  // Un aviso grande sobre el mapa durante unos segundos.
  let avisoHasta = 0;
  const avisados = new WeakSet();
  function avisoFlotante(texto, ms, region) {
    const e = $('aviso-flotante');
    e.textContent = texto + (region != null ? '  📍' : ''); e.hidden = false;
    // Si el aviso tiene sitio, al tocarlo la cámara va allí.
    e.style.pointerEvents = region != null ? 'auto' : ''; e.style.cursor = region != null ? 'pointer' : '';
    e.onclick = region != null ? () => { P.centrarEn(region, 5); e.hidden = true; } : null;
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    avisoHasta = performance.now() + (ms || 3500);
    setTimeout(() => { if (performance.now() >= avisoHasta - 50) e.hidden = true; }, ms || 3500);
  }
  function pintarTodo() { pintarCabecera(); pintarPueblos(); pintarCronica(); pintarConsejo(); pintarGuerra(); pintarCuadrillas(); pintarRetos(); pintarRecursos(); }
