  // ── GÉNESIS · LA VISTA · Los números, la ficha, la corte, el arquitecto y las tropas ──

  // ---------- Los números ----------
  const habitantes = c => { const n = c.habitantes != null ? c.habitantes : (m.vida ? m.vida.aldeanos.filter(a => a.c === c.id).length : 0); return n + (n === 1 ? ' aldeano' : ' aldeanos'); };
  const pob = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' M' : Math.round(p).toLocaleString('es-ES') + ' mil');
  const era = c => M.ERAS[c.era];

  function pintarCabecera() {
    if (anioAntes == null || !corriendo) $('anio').textContent = m.libre ? 'Año ' + m.anio : S.anioTexto(m.anio);
    const maxEra = Math.max(0, ...S.vivas(m).map(c => c.era));
    $('era').textContent = M.ERAS[maxEra].nombre;
    $('play').innerHTML = corriendo ? '<span class="ico">❚❚</span><span class="txt"> Pausa</span>' : '<span class="ico">▶</span><span class="txt"> Seguir</span>';
    $('play').setAttribute('aria-pressed', corriendo ? 'false' : 'true');
    $('vel').textContent = VELOCIDADES[vel][1];
  }

  // La barra de recursos: el oro (con lo que entra y sale cada turno), la comida, la madera, la piedra, el metal,
  // la gente y las camas, el nivel del asentamiento y lo que se investiga.
  // Iconos de píxeles (arte.js) en lugar de emojis, para que la interfaz sea del mismo mundo que el mapa.
  const ICO_PX = { '🐟': 'pescado', '🍖': 'carne', '🥛': 'leche', '🍎': 'frutos', '💣': 'granadas', '🌰': 'semillas', '🪑': 'muebles', '🛡': 'vehiculos', '⚫': 'carbon', '🛢': 'petroleo', '🪙': 'oro', '🌾': 'comida', '🪵': 'madera', '🪨': 'piedra', '⛓': 'metal', '⚔': 'armas', '👥': 'gente', '🏘': 'nivel', '🔬': 'tec', '⏫': 'subir', '🌱': 'primavera', '☀️': 'verano', '🍂': 'otono', '❄️': 'invierno' };
  const px = (n, cls) => M.arte && M.arte.iconoURL ? '<img class="px' + (cls ? ' ' + cls : '') + '" alt="" src="' + M.arte.iconoURL(n) + '">' : '';
  // Al tocar la comida, de qué está hecha: grano, pescado, carne, leche y queso, frutos del bosque.
  const NOMBRE_ALIMENTO = { grano: ['🌾', 'Grano y cosecha', 'campos y molinos'], pescado: ['🐟', 'Pescado', 'barcas de pesca'], carne: ['🍖', 'Carne', 'caza y reses sacrificadas'], leche: ['🥛', 'Leche y queso', 'rebaños'], frutos: ['🍎', 'Frutos del bosque', 'recolección'] };
  function desgloseComida(ancla) {
    const c = tuPueblo() || (sel != null ? S.civ(m, sel) : null); if (!c) return;
    let caja = $('desglose-comida');
    if (caja && !caja.hidden) { caja.hidden = true; return; }
    if (!caja) { caja = document.createElement('div'); caja.id = 'desglose-comida'; caja.className = 'desglose'; document.body.appendChild(caja); caja.addEventListener('click', () => { caja.hidden = true; }); }
    const al = M.vida.desglose ? M.vida.desglose(c) : {}, total = Math.max(1e-9, c.comida || 0);
    caja.innerHTML = '<div class="desglose-tit">' + px('comida') + ' Comida de ' + esc(c.nombre) + ': ' + Math.round(c.comida || 0) + '</div>' + (M.vida.ALIMENTOS || []).map(k => {
      const q = al[k] || 0, [ico, nom, de] = NOMBRE_ALIMENTO[k], pc = Math.round(100 * q / total);
      return '<div class="desglose-fila' + (q < 0.5 ? ' tenue' : '') + '">' + px(ICO_PX[ico]) + '<span class="desglose-nom">' + nom + ' <small class="tenue">(' + de + ')</small></span><b>' + Math.round(q) + '</b><span class="desglose-barra"><i style="width:' + pc + '%"></i></span></div>';
    }).join('') + '<div class="desglose-pie tenue">Todo alimenta igual; en el mercado se vende y se compra como comida.</div>';
    const r0 = ancla.getBoundingClientRect();
    caja.style.left = Math.max(8, Math.min(window.innerWidth - 290, r0.left)) + 'px'; caja.style.top = (r0.bottom + 6) + 'px';
    caja.hidden = false;
  }
  // EL FLUJO DE RECURSOS, como en Age of Empires: los contadores suben (y bajan) poco a poco a lo largo del turno
  // en vez de saltar, y junto a cada uno se ve cuánto entra o sale por minuto (lo de los últimos turnos).
  const historialRec = {}, animRec = {};
  const RECS = ['oro', 'comida', 'madera', 'piedra', 'metal', 'carbon', 'petroleo'];
  function apuntarHistorial(c) {
    const h = historialRec[c.id] = historialRec[c.id] || [];
    if (h.length && h[h.length - 1].turno === m.turno) h.pop();
    h.push({ turno: m.turno, stock: Object.fromEntries(RECS.map(k => [k, c[k] || 0])), hecho: Object.assign({}, c.hecho || {}) });
    while (h.length > 8) h.shift();
  }
  // Por minuto de juego a la velocidad actual (a 1×, un turno son 8 segundos).
  function porMinuto(c, k, deHecho) {
    const h = historialRec[c.id]; if (!h || h.length < 2) return 0;
    const a = h[0], b = h[h.length - 1], turnos = b.turno - a.turno; if (turnos <= 0) return 0;
    const d = deHecho ? (b.hecho[k] || 0) - (a.hecho[k] || 0) : b.stock[k] - a.stock[k];
    return d / turnos * (60000 / VELOCIDADES[vel][0]);
  }
  function numeroSuave(c, k, valor) {
    const a = animRec[k] = animRec[k] || { mostrado: valor, desde: valor, hasta: valor, t0: 0, dur: 1, civ: c.id, turno: m.turno };
    if (a.civ !== c.id) Object.assign(a, { mostrado: valor, desde: valor, hasta: valor, civ: c.id });
    if (a.hasta !== valor) {
      // Al terminar un turno, el cambio se reparte a lo largo del turno siguiente; si es por una orden, en medio segundo.
      const deTurno = a.turno !== m.turno;
      Object.assign(a, { desde: a.mostrado, hasta: valor, t0: performance.now(), dur: deTurno && corriendo ? VELOCIDADES[vel][0] * 0.9 : 500, turno: m.turno });
    }
    return '<b class="rec-n" data-k="' + k + '">' + Math.round(a.mostrado) + '</b>';
  }
  function animarRecursos() {
    const ahora = performance.now();
    for (const el of document.querySelectorAll('#recursos .rec-n')) {
      const a = animRec[el.dataset.k]; if (!a) continue;
      const f = Math.min(1, (ahora - a.t0) / a.dur);
      a.mostrado = a.desde + (a.hasta - a.desde) * f;
      const t = String(Math.round(a.mostrado)); if (el.textContent !== t) el.textContent = t;
    }
  }
  const ritmo = (c, k) => { const d = porMinuto(c, k); if (Math.abs(d) < 0.5) return ''; return ' <small class="' + (d > 0 ? 'verde' : 'rojo') + '">' + (d > 0 ? '+' : '') + Math.round(d) + '/min</small>'; };
  const ritmoTexto = (c, k) => { const neto = porMinuto(c, k), entra = porMinuto(c, k, true); return ' · ' + (neto >= 0 ? '+' : '') + Math.round(neto) + ' por minuto' + (entra > 0.5 ? ' (tus aldeanos recogen ' + Math.round(entra) + '/min; el resto se va en obras, mejoras, comida o comercio)' : ''); };
  function pintarRecursos() {
    const c = tuPueblo() || (sel != null ? S.civ(m, sel) : null), el = $('recursos');
    if (!c || !c.viva) { el.hidden = true; return; }
    if (!historialRec[c.id] || historialRec[c.id][historialRec[c.id].length - 1].turno !== m.turno) apuntarHistorial(c);
    const r = Math.round;
    const oro = c.oro || 0, neto = (c.ingresos || 0) - (c.gastos || 0) - (c.mecenazgo || 0);
    const tope = r((15 + (c.aldeanos || 0) * 1.2) * (1 + M.tec(c, 'granero')));
    const inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
    const pct = inv ? Math.min(100, r(100 * c.investigacion.puntos / M.costeTec(inv))) : 0;
    const chip = (ico, valor, titulo, cls, extra) => '<span class="rec' + (cls ? ' ' + cls : '') + '" title="' + esc(titulo) + '"><i>' + (ICO_PX[ico] ? px(ICO_PX[ico]) : ico) + '</i>' + valor + (extra || '') + '</span>';
    const nivel = M.NIVELES[c.nivel || 0];
    const est = m.vida && m.vida.estacion != null && m.vida.estacion >= 0 ? m.vida.estacion : -1;
    const ESTA = [['🌱', 'Primavera', 'se siembra y los campos brotan más deprisa'], ['☀️', 'Verano', 'los campos maduran'], ['🍂', 'Otoño', 'la gran cosecha: los campos dan más y el bosque da frutos'], ['❄️', 'Invierno', 'no crece nada, apenas se recolecta y se quema el doble de leña: se vive de lo guardado']];
    const hora = m.vida && m.vida.noche ? '🌙 noche' : '';
    el.innerHTML =
      (est >= 0 ? chip(ESTA[est][0], ESTA[est][1] + (hora ? ' <small class="tenue">' + hora + '</small>' : ''), ESTA[est][1] + ': ' + ESTA[est][2] + '. Cada estación dura 12 turnos; de cada 6 turnos, uno es de noche y la gente duerme en casa.', 'estacion') : '') +
      chip('🪙', numeroSuave(c, 'oro', oro), 'Oro del tesoro: impuestos ' + (c.ingresos || 0).toFixed(1) + ' − sueldos y mantenimiento ' + (c.gastos || 0).toFixed(1) + (c.mecenazgo ? ' − ' + c.mecenazgo.toFixed(1) + ' para los sabios' : '') + ' por turno' + ritmoTexto(c, 'oro'), oro < 0 ? 'mal' : 'oro', ritmo(c, 'oro')) +
      chip('🌾', numeroSuave(c, 'comida', c.comida || 0) + '<small class="tenue">/' + tope + '</small>', 'Comida en el granero (y lo que cabe). Tócala para ver de dónde sale: grano, pescado, carne, leche y frutos' + ritmoTexto(c, 'comida'), 'comida' + ((c.comida || 0) < (c.aldeanos || 0) * 0.3 ? ' mal' : ''), ritmo(c, 'comida')) +
      chip('🪵', numeroSuave(c, 'madera', c.madera || 0), 'Madera' + ritmoTexto(c, 'madera'), '', ritmo(c, 'madera')) +
      chip('🪨', numeroSuave(c, 'piedra', c.piedra || 0), 'Piedra' + ritmoTexto(c, 'piedra'), '', ritmo(c, 'piedra')) +
      (c.era >= 1 ? chip('⛓', numeroSuave(c, 'metal', c.metal || 0), 'Metal (armas, armaduras, vehículos)' + ritmoTexto(c, 'metal') + (m.mercado ? ' · en el mercado: ' + m.mercado.precio.metal.toFixed(2) : ''), '', ritmo(c, 'metal')) : '') +
      (c.era >= 6 ? chip('⚫', numeroSuave(c, 'carbon', c.carbon || 0), 'Carbón: lo queman las fábricas, los trenes y las centrales. Sale de las vetas negras y de las minas de la montaña.' + (c.paradas && Object.keys(c.paradas).length ? ' ¡Falta! Hay cosas paradas.' : ''), c.paradas && (c.paradas.fabrica || c.paradas.tren) ? 'mal' : '', ritmo(c, 'carbon')) : '') +
      ((c.armas || 0) >= 1 ? chip('⚔', r(c.armas || 0), 'Armas en el almacén: las usa el ejército y se pueden vender («vended armas»). «Fabricad 20 fusiles» pone a la forja a hacer más.', '') : '') +
      ((c.semillas || 0) >= 1 ? chip('🌰', r(c.semillas || 0), 'Semillas de árbol: los leñadores las recogen al talar y replantan cuando escasea el bosque. Se compran y se venden en el mercado.', '') : '') +
      ((c.muebles || 0) >= 1 ? chip('🪑', r(c.muebles || 0), 'Muebles de la fábrica: la gente compra parte cada turno y el resto se exporta («vended muebles»).', '') : '') +
      ((c.granadas || 0) >= 1 ? chip('💣', r(c.granadas || 0), 'Granadas: los soldados las lanzan a trincheras y grupos enemigos. «Fabricad 30 granadas» las hace el cuartel o la fábrica; también se venden («vended granadas»).', '') : '') +
      ((c.vehiculos || 0) >= 1 ? chip('🛡', r(c.vehiculos || 0), 'Cañones, artillería o tanques en el almacén: los soldados los usan o se venden («vended cañones», «fabricad 5 cañones»).', '') : '') +
      ((c.aviones || 0) >= 1 ? chip('✈', r(c.aviones || 0), 'Aviones comprados a la fundición: en guerra salen más a bombardear (sin gastar metal); a veces el enemigo derriba alguno.', '') : '') +
      (c.era >= 7 ? chip('🛢', numeroSuave(c, 'petroleo', c.petroleo || 0), 'Petróleo: lo gastan los tanques, los aviones y las centrales sin carbón. Sale de los pozos levantados sobre las manchas negras.' + ((c.pozosPetroleo || 0) ? ' Tenéis ' + c.pozosPetroleo + (c.pozosPetroleo === 1 ? ' pozo.' : ' pozos.') : ' No tenéis pozos.'), '', ritmo(c, 'petroleo')) : '') +
      (c.era >= 1 && (c.armas || 0) >= 1 ? chip('⚔', r(c.armas || 0), 'Armas forjadas o compradas, listas para tus guerreros' + (m.mercado ? ' · en el mercado: ' + m.mercado.precio.armas.toFixed(2) : ''), '') : '') +
      chip('👥', (c.aldeanos || 0) + '<small class="tenue">/' + (c.camas || 0) + '</small>', 'Aldeanos / camas', (c.aldeanos || 0) >= (c.camas || 0) ? 'mal' : '') +
      chip('🏘', esc(nivel.nombre), nivel.nombre + (M.NIVELES[(c.nivel || 0) + 1] ? ' · a ' + M.NIVELES[(c.nivel || 0) + 1].desde + ' vecinos será ' + M.NIVELES[(c.nivel || 0) + 1].nombre.toLowerCase() + ' (' + M.NIVELES[(c.nivel || 0) + 1].abre + ')' : '')) +
      (c.subiendo ? chip('⏫', esc(M.ERAS[c.subiendo.a].nombre) + ' <span class="barra mini"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span>', 'Pasando de edad', 'oro') : M.ERAS[c.era + 1] && S.puedeSubir(m, c).ok ? chip('⏫', '¡' + esc(M.ERAS[c.era + 1].nombre) + '!', 'Podéis avanzar de edad: toca tu plaza (o 🏛) y pulsa «Avanzar»', 'oro') : '') +
      chip('🔬', inv ? esc(inv.nombre) + ' <span class="barra mini"><span style="width:' + pct + '%"></span></span>' : '<span class="tenue">' + (M.ERAS[c.era + 1] ? (m.libre || M.ERAS[c.era + 1].desde == null ? 'próxima era' : M.ERAS[c.era + 1].nombre + ' en ' + S.anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) : 'todo investigado') + '</span>', inv ? 'Investigando: ' + inv.nombre + ' (' + inv.texto + ') · ' + pct + ' %' : 'Sin nada que investigar hasta la próxima era', 'tec');
    el.hidden = false;
  }
  function pintarPueblos() {
    const lista = S.resumen(m).sort((a, b) => b.tierras - a.tierras);
    const ul = $('pueblos');
    ul.innerHTML = '';
    for (const c of lista) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pueblo' + (sel === c.id ? ' elegido' : '');
      b.setAttribute('aria-pressed', sel === c.id ? 'true' : 'false');
      b.innerHTML = '<span class="muestra"></span><span class="p-nombre"></span><span class="p-dato"></span>';
      b.querySelector('.muestra').style.background = c.color;
      b.querySelector('.p-nombre').textContent = c.nombre + (c.guerras.length ? ' ⚔' : '');
      b.querySelector('.p-dato').textContent = M.ERAS[c.era].corto + ' · ' + habitantes(c);
      b.addEventListener('click', () => elegir(sel === c.id ? null : c.id, true));
      li.appendChild(b); ul.appendChild(li);
    }
    pintarFicha();
  }

  function fila(dt, dd) { return '<div class="fila"><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function pintarFicha() {
    const f = $('ficha');
    if (edificioSel != null && fichaEdificio(f)) return;
    if (aldeanoSel != null && fichaAldeano(f)) return;
    const c = sel != null ? S.civ(m, sel) : tuPueblo();
    if (!c || !c.viva) {
      sel = null;
      f.innerHTML = '<p class="vacio">Toca un pueblo en el mapa o en la lista para ver cómo vive. Lo que escribas sin nombrar a nadie le pasará al pueblo elegido.</p>';
      return;
    }
    const cs = S.casillas(m, c), cap = S.capacidad(m, c, cs);
    const enemigos = c.guerras.map(g => S.civ(m, g.con)).filter(Boolean).map(o => o.nombre);
    const edificios = [c.saberes ? M.CASA_SABER(c.era) + (c.saberes > 1 ? ' (' + c.saberes + ')' : '') : '', c.castillos ? (c.era >= 7 ? 'fortín' : c.era >= 5 ? 'fortaleza' : c.era >= 2 ? 'castillo' : 'recinto de empalizada') : '', c.cuarteles ? 'cuartel' : '', c.arquerias ? (c.era >= 5 ? 'campo de tiro' : 'arquería') : '', c.torres ? c.torres + ' torre' + (c.torres > 1 ? 's' : '') : '', c.templos ? c.templos + ' templo' + (c.templos > 1 ? 's' : '') : '', c.molinos ? c.molinos + ' molino' + (c.molinos > 1 ? 's' : '') : '', c.puertos ? c.puertos + ' puerto' + (c.puertos > 1 ? 's' : '') + ' <span class="tenue">(' + ((m.vida.barcos || []).filter(b => b.c === c.id).length) + ' barcos)</span>' : ''].filter(Boolean).join(' · ') || '<span class="tenue">ninguno todavía</span>';
    // La ficha va por pestañas, para no enseñarlo todo de golpe.
    const pestanas = {
      resumen: ['Resumen', fila('Gobierna', esc(M.TITULOS[c.regimen] ? M.TITULOS[c.regimen].charAt(0).toUpperCase() + M.TITULOS[c.regimen].slice(1) : 'Rey') + ' ' + esc(S.nombreRey(c)) + (c.rey ? ' <span class="tenue">(' + esc(M.RASGOS[c.rey.rasgo].nombre) + ', ' + Math.round(c.rey.edad) + ' años' + (c.heredero ? '; heredero: ' + esc(c.heredero.nombre) : '') + ')</span>' : '')) +
        fila('Población', habitantes(c) + ' <span class="tenue">(la tierra da para ' + Math.round(cap / M.vida.escala(c)) + ')</span>') +
        fila('Estabilidad', '<span class="barra"><span style="width:' + Math.round(c.estab) + '%"></span></span> ' + Math.round(c.estab)) +
        fila('Riqueza', Math.round(c.riqueza)) + fila('Tierras', cs.length) +
        fila('Técnica', 'fase ' + (M.fase(c.era) + 1) + ' de 4: <b>' + esc(M.FASES[M.fase(c.era)].nombre) + '</b> <span class="tenue">(' + esc(M.FASES[M.fase(c.era)].resumen) + ')</span>') + fila('Inventos', esc(c.inventos.slice(-3).join(', ') || 'ninguno todavía')) +
        fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') +
        (ciudadesDe(c) ? fila('Ciudades', ciudadesDe(c)) : '')],
      economia: ['Economía', fila('Aldeanos', aldeanos(c)) +
        fila('Comida', Math.floor(c.comida || 0) + ' en el granero <span class="tenue">· ' + (c.campos || 0) + ' campos' + (c.efectos.some(e => e.sequia) ? ' · <b class="rojo">sequía</b>' : '') + '</span>') +
        fila('Ganado', ganado(c)) +
        fila('Madera', Math.floor(c.madera || 0) + ' <span class="tenue">· piedra ' + Math.floor(c.piedra || 0) + ' · ' + (c.arboles || 0) + ' árboles en su tierra</span>') +
        fila('Minas', Math.floor(c.metal || 0) + ' de ' + (c.era >= 6 ? 'acero' : c.era >= 2 ? 'hierro' : 'bronce') + ' <span class="tenue">· ' + Math.floor(c.oro || 0) + ' de oro</span>') +
        fila('Obras', (c.casas || 0) + ' casas') + fila('Edificios', edificios) + fila('Comercio', comercioDe(c)) + (c.era >= 2 || (m.creditos || []).some(x => x.de === c.id || x.a === c.id) ? fila('Banca', bancaDe(c)) : '')],
      ejercito: ['Ejército', fila('Ejército', (c.guerreros || 0) + ' guerreros' + (c.guerreros ? ' <span class="tenue">· ' + (c.armados || 0) + ' con ' + esc(M.vida.ARMAS[c.era].nombre) + (c.era >= 1 ? ', tiradores con ' + esc(M.vida.TIROS[c.era]) : '') + '</span>' : '')) +
        fila('Equipo', esc(M.vida.ARMAS[c.era].nombre) + ' <span class="tenue">(' + M.vida.ARMAS[c.era].dano + ' de daño, ' + esc(M.vida.ARMAS[c.era].material) + ')</span> · ' + esc(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].nombre) + ' <span class="tenue">(−' + Math.round(M.vida.ARMADURAS[M.vida.armaduraDeEra(c.era)].reduce * 100) + ' %)</span>') +
        (c.era >= 5 ? fila('Vehículos', vehiculosDe(c)) : '') +
        fila('Guerras', enemigos.length ? '<span class="rojo">' + esc(enemigos.join(', ')) + '</span>' : 'en paz') +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + (c.guerras.length ? '</dl>' + marcadorGuerra(c, !c.jugador) + '<dl>' : '')],
      diplomacia: ['Diplomacia', (S.aliadosDe(m, c).length ? fila('Aliados', esc(S.aliadosDe(m, c).map(o => o.nombre).join(', '))) : fila('Aliados', '<span class="tenue">ninguno</span>')) +
        (complotsDe(c) ? fila('Complots', complotsDe(c)) : '') + fila('Opinión', opiniones(c))]
    };
    pestanas.tecnica = ['Técnica', arbolTecnico(c)];
    if (M.vida.pausada(m)) pestanas.ciudad = ['Ciudad', ciudadDe(c)];
    if (M.vida.pausada(m) && m.mercado) pestanas.mercado = ['Mercado', mercadoDe(c)];
    if (c.jugador) pestanas.plan = ['Tu plan', planDe(c)];
    if (!pestanas[pestana]) pestana = 'resumen';
    f.innerHTML = '<h3><span class="muestra"></span>' + esc(c.nombre) + '</h3>' +
      '<p class="subt">' + esc(M.conCaracter(c.regimen, c.caracter)) + ' · ' + esc(era(c).nombre) + '</p>' +
      '<div class="pestanas" role="tablist">' + Object.keys(pestanas).map(k => '<button type="button" role="tab" class="pestana' + (k === pestana ? ' activa' : '') + '" aria-selected="' + (k === pestana) + '" data-p="' + k + '">' + pestanas[k][0] + '</button>').join('') + '</div>' +
      (pestana === 'plan' || pestana === 'tecnica' || pestana === 'ciudad' || pestana === 'mercado' ? pestanas[pestana][1] : '<dl>' + pestanas[pestana][1] + '</dl>') +
      (m.modo === 'pueblo' && !c.jugador && !enLinea() ? '<button type="button" class="mando gobernar">Gobernar este pueblo</button>' : '');
    f.querySelectorAll('.pestana').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.p; pintarFicha(); }));
    // Tocar una tecnología disponible de tu pueblo: se investiga esa (la misma orden que «investigad …»).
    f.querySelectorAll('.esp-elegir').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.k ? 'especializaos en ' + b.dataset.k : 'dejad de especializaros'); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelectorAll('.mercado-orden').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.orden); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelectorAll('.nec-obrar').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, b.dataset.orden); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    const av = f.querySelector('.avanzar-edad');
    if (av) av.addEventListener('click', () => { const r = X.ordenar(m, c.id, 'avanzad de edad'); if (r.ok) despuesDeOrden(r); pintarFicha(); });
    f.querySelectorAll('.tec-elegir').forEach(b => b.addEventListener('click', () => { const r = X.ordenar(m, c.id, 'investigad ' + b.dataset.nombre); if (r.ok) despuesDeOrden(r); pintarFicha(); }));
    f.querySelector('.muestra').style.background = c.color;
    if (c.jugador) f.querySelector('h3').insertAdjacentHTML('beforeend', ' <span class="tuyo">tu pueblo</span>');
    const b = f.querySelector('.gobernar');
    if (b) b.addEventListener('click', () => elegirModo('pueblo', c.id));
  }

  // Las prioridades de tu pueblo como barras: el pueblo se gobierna solo y esto es lo que pesa en sus decisiones.
  // El árbol de la técnica de un pueblo: lo hecho, lo que se investiga, lo que se puede elegir y lo que vendrá.
  // ---------- LA CORTE: el menú del palacio (o de la casa del jefe), como en Age of Empires ----------
  // Se abre tocando la plaza de un pueblo (o el botón 🏛). Arriba, las mejoras de la edad, cada una con su
  // botón; abajo, lo que pide la siguiente edad y el botón grande para avanzar. Hacen falta tres mejoras.
  let corteDe = null;
  const SEDE = ['Gran choza del jefe', 'Casa comunal', 'Palacio de piedra', 'Palacio', 'Castillo del rey', 'Palacio real', 'Palacio de gobierno', 'Sede del gobierno', 'Cuartel general'];
  function abrirCorte(id) { corteDe = id; if (tuPueblo() && id === tuPueblo().id) (m.guia = m.guia || {}).corte = 1; pintarCorte(); pintarConsejo(); if (movil()) document.body.classList.add('sin-panel'); }
  function cerrarCorte() { corteDe = null; $('corte').hidden = true; document.body.classList.remove('corte-abierta'); }
  function pintarCorte() {
    const el = $('corte'), c = corteDe != null ? S.civ(m, corteDe) : null;
    if (!c || !c.viva) { cerrarCorte(); return; }
    const mio = !!c.jugador, ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id, med = S.mejorasDeEdad(c);
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1], r = S.puedeSubir(m, c);
    const precioTxt = p => Object.keys(p || {}).map(k => (px(k) || '') + ' ' + p[k]).join(' ');
    const tarjeta = t => {
      const hecha = ts.includes(t.id), ahora = inv === t.id, falta = hecha || ahora ? [] : S.faltaPara(m, c, t);
      const pct = ahora ? Math.min(100, Math.round(100 * c.investigacion.puntos / M.costeTec(t))) : 0;
      const turnos = ahora ? Math.max(1, Math.ceil((M.costeTec(t) - c.investigacion.puntos) / Math.max(0.01, c.tecTurno || c.cienciaTurno || 1))) : 0;
      return '<div class="mejora' + (hecha ? ' hecha' : ahora ? ' ahora' : falta.length ? ' falta' : '') + '">' +
        '<div class="mejora-cab"><b>' + esc(t.nombre) + '</b>' + (hecha ? '<span class="verde">✓ hecha</span>' : '') + '</div>' +
        '<p class="mejora-texto">' + esc(t.texto) + '</p>' +
        (hecha ? '' : '<p class="mejora-precio"><span class="tenue">en ' + esc(M.LUGARES[t.lugar] || 'la plaza') + ' · ' + M.costeTec(t) + ' de saber · la investigan tus sabios, sin coste</span></p>') +
        (ahora ? '<div class="mejora-barra"><span class="barra"><span style="width:' + pct + '%"></span></span> ' + pct + ' % <span class="tenue">· unos ' + turnos + ' turnos</span></div>' + (() => { const d = S.porPagar(c, t), ks = Object.keys(d); return ks.length ? '<p class="' + (c.investigacion.esperaPago ? 'rojo ' : 'tenue ') + 'mejora-falta">' + (c.investigacion.esperaPago ? 'Parado: faltan recursos para seguir pagando · ' : 'Se paga poco a poco · queda ') + esc(precioTxt(d)) + '</p>' : ''; })() :
          !hecha && mio ? (falta.length ? '<p class="rojo mejora-falta">Falta: ' + esc(falta.join(', ')) + '</p>' : '') + '<button type="button" class="' + (falta.length ? 'mando sutil' : 'obrar') + ' corte-tec" data-nombre="' + esc(t.nombre) + '">' + (falta.length ? 'Apuntar para después' : 'Investigar') + '</button>' : '') +
        '</div>';
    };
    const pendientesViejas = M.TECNOLOGIAS.filter(t => t.era < c.era && !ts.includes(t.id));
    const item = (ok, txt) => '<li class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + ' ' + txt + '</li>';
    const ft = r.falta.join(' ');
    const pideEdad = sig ? '<ul class="edad-req">' +
      item(!/mejora/.test(ft), 'Mejoras de esta edad: <b>' + med.hechas + ' / ' + med.pide + '</b>') +
      item(!/saber/.test(ft), 'Saber ' + Math.floor(c.ciencia) + ' / ' + sig.umbral + ' <span class="tenue">(lo traen tus ' + esc(M.ERUDITO(c.era).varios) + ')</span>') +
      (sig.desde != null && !m.libre ? item(!/llegar al año/.test(ft), 'Llegar al año ' + esc(S.anioTexto(sig.desde).replace(/(\d)\.$/, '$1'))) : '') +
      (req ? item(!/ser una|ser un|un templo|un cuartel|un castillo/.test(ft), esc(req.texto.charAt(0).toUpperCase() + req.texto.slice(1))) + item(!/ de (comida|madera|piedra|oro|metal)/.test(ft), 'Pagar ' + ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => (px(k) || '') + ' ' + req[k]).join(' ')) : '') + '</ul>' : '';
    el.innerHTML = '<div class="corte-cab"><div><p class="corte-sede">🏛 ' + esc(SEDE[c.era] || 'La corte') + ' de ' + esc(c.nombre) + '</p><p class="corte-era">' + esc(M.ERAS[c.era].nombre) + (mio ? '' : ' <span class="tenue">· no es tu pueblo</span>') + '</p></div><button type="button" class="cerrar corte-cerrar" aria-label="Cerrar">×</button></div>' +
      '<div class="corte-cuerpo">' +
      '<p class="tec-era">' + esc(('Mejoras de ' + M.ERAS[c.era].con).replace(/ de el /, ' del ')) + ' <span class="tenue">· ' + med.hechas + ' de ' + med.lista.length + ' hechas (hacen falta ' + med.pide + ' para avanzar)</span></p>' +
      '<div class="mejoras">' + med.lista.map(tarjeta).join('') + '</div>' +
      (pendientesViejas.length ? '<details class="corte-viejas"><summary>Mejoras pendientes de edades anteriores (' + pendientesViejas.length + ')</summary><div class="mejoras">' + pendientesViejas.map(tarjeta).join('') + '</div></details>' : '') +
      (sig ? '<p class="tec-era">Siguiente edad: ' + esc(sig.nombre) + '</p>' + (c.subiendo ? '<p class="corte-subiendo">⏫ Pasando a ' + esc(sig.con) + ' <span class="barra"><span style="width:' + Math.round(100 * (m.turno - c.subiendo.desde) / Math.max(1, c.subiendo.hasta - c.subiendo.desde)) + '%"></span></span> faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos' + (c.subiendo.debe ? ' <span class="tenue">· por pagar ' + Object.keys(c.subiendo.debe).map(k => Math.ceil(c.subiendo.debe[k]) + ' de ' + esc(k)).join(', ') + (c.subiendo.espera ? ' (esperando material)' : '') + '</span>' : '') + '</p>' : pideEdad +
        (mio ? '<button type="button" class="obrar corte-avanzar"' + (r.ok ? '' : ' disabled') + '>' + (r.ok ? '⏫ Avanzar a ' + esc(sig.nombre) : 'Aún no se puede avanzar') + '</button>' +
          '<label class="corte-auto"><input type="checkbox" class="corte-auto-c"' + (c.plan && c.plan.autoEdad ? ' checked' : '') + '> Avanzar solos en cuanto se pueda</label>' : '')) : '<p class="tenue">Es la última edad.</p>') +
      '</div>';
    el.hidden = false; document.body.classList.add('corte-abierta');
    el.querySelector('.corte-cerrar').addEventListener('click', cerrarCorte);
    el.querySelectorAll('.corte-tec').forEach(b => b.addEventListener('click', () => { const res = X.ordenar(m, c.id, 'investigad ' + b.dataset.nombre); if (res.ok) despuesDeOrden(res); pintarCorte(); }));
    const av = el.querySelector('.corte-avanzar'); if (av) av.addEventListener('click', () => { const res = X.ordenar(m, c.id, 'avanzad de edad'); if (res.ok) despuesDeOrden(res); pintarCorte(); });
    const au = el.querySelector('.corte-auto-c'); if (au) au.addEventListener('change', () => { X.ordenar(m, c.id, au.checked ? 'avanzad de edad solos' : 'no avancéis de edad solos'); pintarCorte(); });
  }
  // ---------- El modo arquitecto: eliges un edificio (o calle) y tocas el mapa donde quieres que vaya ----------
  let arquiClave = null;
  const ARQUI = [['colonia', '🏕', 'Fundar pueblo'], ['casa', '🏠', 'Casa'], ['camino', '🧱', 'Calle'], ['pozo', '🪣', 'Pozo'], ['granero', '🌾', 'Granero'], ['fuente', '⛲', 'Plaza pública'], ['parque', '🌳', 'Parque'], ['templo', '⛪', 'Templo'], ['saber', '📜', 'Saber'], ['palacio', '🏰', 'Palacio'], ['central', '⚡', 'Central eléctrica'], ['banco', '🏦', 'Banco'], ['fabrica', '🏭', 'Fábrica'], ['estacion', '🚂', 'Estación de tren'], ['hospital', '🏥', 'Hospital'], ['aerodromo', '✈', 'Aeródromo'], ['petroleo', '🛢', 'Pozo de petróleo'], ['mina', '⛏', 'Mina'], ['molino', '⚙', 'Molino'], ['torre', '🗼', 'Torre'], ['puerto', '⚓', 'Puerto'], ['cuartel', '⚔', 'Cuartel'], ['arqueria', '🏹', 'Arquería'], ['castillo', '🏯', 'Castillo']];
  function abrirArquitecto() {
    const c = tuPueblo();
    if (!c) return;
    if (tropasActivas) salirTropas();
    const V = M.vida, el = $('arquitecto');
    const nombre = k => k === 'templo' ? (c.era === 4 ? 'Iglesia' : c.era >= 5 && c.era <= 6 ? 'Catedral' : 'Templo') : k === 'saber' ? M.CASA_SABER(c.era).replace(/^./, x => x.toUpperCase()) : ARQUI.find(x => x[0] === k)[2];
    const coste = k => { if (k === 'camino') return 'gratis'; if (k === 'colonia') return '3 colonos'; const q = V.COSTES[V.OBRA[k]] || [0, 0, 0]; return [q[0] ? q[0] + '🪵' : '', q[1] ? q[1] + '🪨' : '', q[2] ? q[2] + '🪙' : ''].filter(Boolean).join(' ') || 'gratis'; };
    const nec = new Set((c.necesidades || []).filter(n => n.falta).map(n => n.obra));
    el.innerHTML = '<div class="arqui-cabeza"><b>🏗 Arquitecto</b> <span class="tenue" id="arqui-ayuda">' + (arquiClave === 'colonia' ? 'Toca una tierra libre donde fundar un pueblo nuevo (al otro lado del mar, irán en barco desde tu puerto).' : arquiClave ? 'Toca el mapa donde quieras ' + esc(nombre(arquiClave).toLowerCase()) + '. Toca otra vez para quitarlo.' : 'Elige qué construir y toca tu tierra. Tus constructores lo harán por orden.') + '</span> <button type="button" class="mando sutil arqui-salir">Salir</button></div>' +
      '<div class="arqui-lista">' + ARQUI.filter(([k]) => k === 'camino' || k === 'colonia' || (V.ERA_OBRA[V.OBRA[k]] || 0) <= c.era + 1).map(([k, ico]) => {
        const nivel = V.NIVEL_OBRA[V.OBRA[k]] || 0, eraPide = V.ERA_OBRA[V.OBRA[k]] || 0;
        const bloqueo = k === 'camino' || k === 'colonia' ? null : c.era < eraPide ? M.ERAS[eraPide].corto.charAt(0) + M.ERAS[eraPide].corto.slice(1).toLowerCase() : (c.nivel || 0) < nivel ? ['aldea', 'aldea', 'pueblo', 'villa', 'ciudad'][nivel] : null;
        return '<button type="button" class="arqui-op' + (arquiClave === k ? ' activa' : '') + (nec.has(k) ? ' falta' : '') + '" data-k="' + k + '"' + (bloqueo ? ' disabled title="Hace falta: ' + bloqueo + '"' : ' title="' + esc(nombre(k) + ' · ' + coste(k) + (nec.has(k) ? ' · ¡hace falta!' : '')) + '"') + '><i>' + ico + '</i><span>' + esc(nombre(k)) + '</span><small>' + (bloqueo ? '🔒 ' + bloqueo : coste(k)) + '</small></button>';
      }).join('') + '</div>';
    el.hidden = false; $('arquitecto-btn').setAttribute('aria-pressed', 'true');
    const cab = document.querySelector('.g-cab');
    el.style.top = movil() ? '' : Math.round((cab ? cab.getBoundingClientRect().bottom : 0) + 8) + 'px';
    document.body.classList.add('arqui-abierto');
    if (movil()) { document.body.classList.add('sin-panel'); document.body.classList.remove('ordenes-abiertas'); }
    el.querySelector('.arqui-salir').addEventListener('click', salirArquitecto);
    el.querySelectorAll('.arqui-op').forEach(b => b.addEventListener('click', () => { arquiClave = arquiClave === b.dataset.k ? null : b.dataset.k; ponerArquitecto(); abrirArquitecto(); }));
  }
  function ponerArquitecto() {
    const c = tuPueblo();
    if (!arquiClave || !c) { P.arquitecto(null); return; }
    P.arquitecto({ clave: arquiClave, civ: c.id, valida: t => M.vida.puedeColocar(m, c, t, arquiClave), alColocar: t => {
      const r = M.vida.encargar(m, c, t, arquiClave), ayuda = $('arqui-ayuda');
      if (ayuda && arquiClave === 'colonia') { ayuda.textContent = r.ok ? (r.enviado ? '📡 Enviado: los colonos saldrán al empezar el próximo turno.' : r.quitado ? 'Anulado: no saldrán colonos.' : r.via && r.via.mar ? '⛵ Hecho: tres colonos irán a tu puerto, cruzarán el mar en barco y fundarán allí un pueblo.' : '🏕 Hecho: tres colonos saldrán andando a fundar allí un pueblo.') : 'No: ' + r.razon + '.'; return; }
      if (ayuda) ayuda.textContent = r.ok ? (r.quitado ? 'Quitado.' : 'Encargado: ' + ((c.plan.encargos || []).length) + ' obra' + ((c.plan.encargos || []).length === 1 ? '' : 's') + ' en cola. Toca otra vez para quitarlo.') : 'No: ' + r.razon + '.';
    } });
  }
  // ---------- El modo tropas: eliges soldados en el mapa y los mandas a un sitio (como en Age of Empires) ----------
  let tropasActivas = false;
  function pintarBarraTropas(sel) {
    const el = $('tropas-barra'), c = tuPueblo();
    if (!el || !c) return;
    const n = sel ? sel.size : P.tropasElegidas().length, total = m.vida.aldeanos.filter(a => a.c === c.id && a.o === 4).length;
    el.innerHTML = '<span class="tropas-texto">⚔ <b>' + n + '</b> de ' + total + ' soldados elegidos · ' + (n ? 'toca el mapa para mandarlos (si es tierra enemiga, atacan)' : 'arrastra sobre el mapa para elegir soldados') + '</span>' +
      '<button type="button" class="mando" data-t="todos">Todos</button><button type="button" class="mando" data-t="ninguno">Ninguno</button>' +
      '<button type="button" class="mando" data-t="auto"' + (n ? '' : ' disabled') + ' title="Que vuelvan a moverse solos con el ejército">Automático</button><button type="button" class="mando sutil" data-t="salir">Salir</button>';
    el.hidden = false;
    const cab = document.querySelector('.g-cab');
    el.style.top = movil() ? '' : Math.round((cab ? cab.getBoundingClientRect().bottom : 0) + 8) + 'px';
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.t, c2 = tuPueblo(); if (!c2) return;
      if (t === 'todos') P.elegirTropas(m.vida.aldeanos.filter(a => a.c === c2.id && a.o === 4).map(a => a.id));
      else if (t === 'ninguno') P.elegirTropas([]);
      else if (t === 'auto') { acabarTurno(); const r = X.ordenar(m, c2.id, '#tropas-libres ' + P.tropasElegidas().join(',')); if (r && r.respuesta) avisoFlotante(r.respuesta, 3000); P.elegirTropas([]); }
      else if (t === 'salir') salirTropas();
    }));
  }
  function abrirTropas() {
    const c = tuPueblo(); if (!c) return;
    if (arquiClave || !$('arquitecto').hidden) salirArquitecto();
    tropasActivas = true; $('tropas-btn').setAttribute('aria-pressed', 'true'); document.body.classList.add('tropas-abierto');
    P.modoTropas({ civ: c.id, alCambiar: sel => pintarBarraTropas(sel), alOrdenar: t => {
      const c2 = tuPueblo(), ids = P.tropasElegidas(); if (!c2 || !ids.length) return;
      acabarTurno();
      const r = X.ordenar(m, c2.id, '#tropas ' + ids.join(',') + ' ' + t);
      if (r && r.respuesta) avisoFlotante(r.respuesta, 3500);
      pintarTodo();
    } });
    pintarBarraTropas(new Set());
  }
  function salirTropas() { tropasActivas = false; P.modoTropas(null); const el = $('tropas-barra'); if (el) el.hidden = true; $('tropas-btn').setAttribute('aria-pressed', 'false'); document.body.classList.remove('tropas-abierto'); }
  function salirArquitecto() { document.body.classList.remove('arqui-abierto'); arquiClave = null; P.arquitecto(null); $('arquitecto').hidden = true; $('arquitecto-btn').setAttribute('aria-pressed', 'false'); }
