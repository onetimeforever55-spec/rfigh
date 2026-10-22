  // ── GÉNESIS · LA VIDA · El gobernador automático, el mercado global y la cartera de cada reino ──

  // ---------- Los aldeanos de cada pueblo ----------
  const cuantos = c => Math.max(4, Math.min(60, Math.round(3 + Math.sqrt(Math.max(0, c.pob)) * 2)));

  /*
   * EL GOBERNADOR AUTOMÁTICO: cada pueblo (también el del jugador) reparte el trabajo según lo que le falta.
   * Poca madera → más leñadores; la gente cerca del límite de comida → más granjeros; faltan casas → más
   * constructores; guerra → guerreros. Las prioridades del jugador (0 a 2) pesan sobre esas necesidades.
   */
  /*
   * EL MERCADO GLOBAL (partidas pausadas).
   *  · Cada bien (comida, madera, piedra, metal y armas) tiene un precio mundial que sale de lo que hay en todos
   *    los graneros y almacenes frente a lo que todos necesitan: si sobra madera en el mundo, la madera baja;
   *    si escasea, se encarece.
   *  · Cada reino elige qué producir según su tierra, su carácter y los precios (su especialidad), y produce
   *    de más para vender.
   *  · Pero solo se compra y se vende con quien se comercia de verdad: los comerciantes van por las rutas entre
   *    reinos con la carreta cargada de lo que al otro le falta, lo venden a precio de mercado (más caro si es
   *    urgente) y vuelven con lo que falta en casa, pagado con oro. Quien tiene socios puede esperar al
   *    comerciante en vez de producirlo todo; quien no, tiene que hacerlo él.
   */
  // Todo lo que se produce o se fabrica se puede vender: las materias primas, las armas que hace la forja,
  // los muebles de la fábrica y los vehículos de guerra (cañones, artillería, tanques) que salen del cuartel.
  const BIENES = ['comida', 'madera', 'piedra', 'metal', 'armas', 'carbon', 'petroleo', 'muebles', 'vehiculos', 'semillas', 'granadas'];
  const PRECIO_BASE = { comida: 0.5, madera: 0.6, piedra: 0.9, metal: 2.5, armas: 6, carbon: 1.4, petroleo: 3.2, muebles: 2.4, vehiculos: 30, semillas: 0.35, granadas: 1.6 };
  const NOMBRE_BIEN = { comida: 'comida', madera: 'madera', piedra: 'piedra', metal: 'metal', armas: 'armas', carbon: 'carbón', petroleo: 'petróleo', muebles: 'muebles', vehiculos: 'cañones y tanques', semillas: 'semillas de árbol', granadas: 'granadas' };
  // Los bienes que un reino conoce: las armas desde el Bronce, el carbón desde la industria, el petróleo en la Era Moderna.
  const bienesDe = c => BIENES.filter(k => (k !== 'armas' || c.era >= 1) && (k !== 'carbon' || c.era >= 6) && (k !== 'petroleo' || c.era >= 7) && (k !== 'muebles' || c.era >= 6) && (k !== 'vehiculos' || c.era >= 5) && (k !== 'granadas' || c.era >= 8));
  const tanquesDe = (m, c) => m.vida.aldeanos.filter(a => a.c === c.id && a.veh === 'tanque').length;
  // Lo que un reino quiere tener de cada cosa.
  function objetivo(c, k) {
    const n = c.aldeanos || 0;
    if (k === 'comida') return Math.max(8, n * 3);
    if (k === 'madera') return metaMadera(c);
    if (k === 'piedra') return c.era >= 1 ? 20 + 10 * c.era : 6;
    if (k === 'metal') return c.era >= 1 ? 6 + Math.round((c.guerreros || 0) * 0.6) + 2 * c.era : 0;
    if (k === 'armas') return c.era >= 1 ? Math.max(0, (c.guerreros || 0) - (c.armados || 0)) + (c.guerras && c.guerras.length ? 6 : 0) : 0;
    if (k === 'carbon') return c.era >= 6 ? 4 + Math.round(((c.fabricas || 0) * GASTO.fabrica + (c.estaciones || 0) * GASTO.tren + (c.centrales || 0) * GASTO.central) * 15) : 0;
    // Los muebles los quieren las casas de las ciudades industriales; los vehículos, los cuarteles (sobre todo en guerra).
    // Semillas de árbol: las que hacen falta para replantar (más si el bosque cercano escasea).
    if (k === 'semillas') return 6 + Math.max(0, 20 - Math.round((c.arboles || 0) / 6));
    if (k === 'muebles') return c.era >= 6 ? Math.round((c.casas || 0) * 0.2) : 0;
    if (k === 'vehiculos') return c.era >= 5 && c.cuarteles > 0 ? (c.guerras && c.guerras.length ? 4 : 1) : 0;
    // Las granadas: unas cuantas por soldado, muchas más en guerra.
    if (k === 'granadas') return c.era >= 8 ? Math.round((c.guerreros || 0) * (c.guerras && c.guerras.length ? 3 : 1)) + 6 : 0;
    if (k === 'petroleo') return c.era >= 7 ? 6 + (c.aerodromos || 0) * 8 + (c.era >= 8 ? 10 + (c.guerras && c.guerras.length ? 12 : 0) : 0) : 0;
    return 0;
  }
  // Lo que le sobra, lo que le falta y cuánta prisa le corre (0 nada, 1 mucha, 2 desesperado).
  function balance(m, c) {
    const out = { sobra: {}, falta: {}, urg: {} }, p = c.plan || {};
    for (const k of BIENES) {
      const ob = objetivo(c, k), hay = c[k] || 0;
      const venta = (p.ventas || []).filter(x => x.que === k).reduce((q, x) => q + x.n, 0);
      out.sobra[k] = Math.max(0, hay - ob * ((c.cartera && c.cartera[k]) ? 1.05 : 1.35)) + Math.min(hay, venta);
      out.falta[k] = Math.max(0, ob - hay);
      out.urg[k] = ob > 0 ? Math.min(1, out.falta[k] / ob) : 0;
      if (k === 'comida' && hay < n0(c) * 0.6) out.urg[k] = 1.6;
      if (k === 'armas' && c.guerras && c.guerras.length && out.falta[k] > 0) out.urg[k] = Math.max(out.urg[k], 1.2);
      const pedido = (p.pedidos || []).filter(x => x.que === k).reduce((q, x) => q + x.n, 0);
      if (pedido > 0) { out.falta[k] = Math.max(out.falta[k], pedido); out.urg[k] = Math.max(out.urg[k], 1.5); }
    }
    return out;
  }
  const n0 = c => c.aldeanos || 0;
  // Qué le conviene producir: lo que su tierra da, lo que su carácter prefiere y lo que mejor se paga.
  function aptitudes(m, c, recursos) {
    return {
      comida: 0.6 + Math.min(1.2, (c.campos || 0) / Math.max(4, metaCampos(c))) * (S().fertil(m, c.capital) / 2),
      madera: recursos && recursos.arboles ? 0.4 + Math.min(1.2, recursos.arboles / 30) : 0,
      piedra: recursos && recursos.rocas ? 0.3 + Math.min(1, recursos.rocas / 25) : 0,
      metal: c.era >= 1 && recursos && recursos.rocas ? 0.3 + Math.min(1, recursos.rocas / 30) : 0,
      armas: c.era >= 1 && c.cuarteles > 0 ? 0.5 + Math.min(0.8, (c.metal || 0) / 40) : 0,
      carbon: c.era >= 6 && recursos && recursos.carbones ? 0.4 + Math.min(1.2, recursos.carbones / 12) : 0,
      petroleo: c.era >= 7 && (c.pozosPetroleo || 0) > 0 ? 0.7 + 0.35 * c.pozosPetroleo : 0,
      semillas: recursos && recursos.arboles ? 0.15 + Math.min(0.6, recursos.arboles / 90) : 0,
      muebles: c.era >= 6 && (c.fabricas || 0) > 0 ? 0.5 + 0.3 * c.fabricas : 0,
      vehiculos: c.era >= 5 && c.cuarteles > 0 ? 0.3 + Math.min(0.8, (c.metal || 0) / 60) : 0,
      granadas: c.era >= 8 && (c.cuarteles > 0 || c.fabricas > 0) ? 0.35 + Math.min(0.7, (c.metal || 0) / 50) : 0
    };
  }
  /*
   * LA CARTERA DE CADA REINO: no se casa con un solo bien. Cada seis turnos mira qué le rinde de verdad:
   *  · lo que su tierra da mejor que la de los demás (ventaja comparativa) y lo que le gusta por carácter;
   *  · el precio de hoy y hacia dónde va (si sube, apetece; si se hunde, no);
   *  · el oro que de verdad le ha dado venderlo últimamente;
   *  · si ya hay muchos reinos en lo mismo (el mercado se va a llenar y el precio caerá);
   *  · si tiene el almacén a rebosar sin poder venderlo (eso ya no rinde).
   * Reparte su trabajo entre sus dos o tres bienes más rentables, y solo cambia de bien principal cuando otro
   * rinde claramente más (cambiar de oficio cuesta), y entonces lo cuenta la crónica.
   */
  const GUSTO = { guerrero: { armas: 0.6, metal: 0.3 }, mercader: { madera: 0.2, metal: 0.3 }, agricola: { comida: 0.5 }, constructor: { piedra: 0.5, madera: 0.2 }, sabio: {}, devoto: { comida: 0.2 } };
  function rentabilidades(m, c, recursos, media, cuantos) {
    const mk = m.mercado, out = {};
    const bruto = aptitudes(m, c, recursos), gusto = GUSTO[c.caracter] || {};
    for (const k of BIENES) {
      if (bruto[k] <= 0) { out[k] = 0; continue; }
      const apt = bruto[k] / Math.max(0.2, (media && media[k]) || bruto[k]) * Math.sqrt(bruto[k]);
      const h = (mk && mk.historia[k]) || [], precio = mk ? mk.precio[k] / PRECIO_BASE[k] : 1;
      const tendencia = h.length > 6 ? Math.max(-0.4, Math.min(0.4, (h[h.length - 1] - h[h.length - 7]) / Math.max(0.01, h[h.length - 7]))) : 0;
      const ganado = ((c.ganado || {})[k] || 0) / Math.max(5, (c.aldeanos || 10) * 0.3);
      const otros = Math.max(0, ((cuantos || {})[k] || 0) - (c.especialidad === k ? 1 : 0));
      const lleno = (c[k] || 0) > objetivo(c, k) * 3 + 10 ? 0.6 : 1;
      out[k] = apt * Math.sqrt(precio) * (1 + tendencia) * (1 + Math.min(1, ganado)) * (1 + (gusto[k] || 0)) * lleno / (1 + 0.18 * otros);
    }
    return out;
  }
  function evaluarCartera(m, c, recursos, media, cuantos) {
    const v = m.vida, p = c.plan || {};
    c.rentable = rentabilidades(m, c, recursos, media, cuantos);
    if (p.especialidad) { c.cartera = { [p.especialidad]: 1 }; c.especialidad = p.especialidad; return; }
    const orden = BIENES.filter(k => c.rentable[k] > 0).map(k => [k, c.rentable[k] * (0.92 + azar(v) * 0.16)]).sort((a, b) => b[1] - a[1]);
    if (!orden.length) { c.cartera = { comida: 1 }; c.especialidad = 'comida'; return; }
    // Solo se cambia de bien principal si el nuevo rinde al menos un 25 % más que el de ahora.
    let principal = orden[0][0];
    const actual = c.especialidad && c.rentable[c.especialidad] > 0 ? c.especialidad : null;
    if (actual && principal !== actual && (orden[0][1] < c.rentable[actual] * 1.25 || m.turno - ((c.cambiosEsp || []).slice(-1)[0] || { t: -99 }).t < 24)) principal = actual;
    const top = [principal, ...orden.map(x => x[0]).filter(k => k !== principal)].slice(0, 3);
    const pesos = top.map((k, i) => Math.max(0.01, c.rentable[k]) * (i === 0 ? 1.6 : 1));
    const suma = pesos.reduce((a, b) => a + b, 0);
    c.cartera = {}; top.forEach((k, i) => { c.cartera[k] = Math.round(pesos[i] / suma * 100) / 100; });
    if (actual && principal !== actual) {
      const motivo = (c.ganado && (c.ganado[principal] || 0) > (c.ganado[actual] || 0)) ? 'le da más oro' : (m.mercado && m.mercado.precio[principal] / PRECIO_BASE[principal] > m.mercado.precio[actual] / PRECIO_BASE[actual]) ? 'se paga mejor' : 'su tierra rinde más en eso';
      (c.cambiosEsp = c.cambiosEsp || []).push({ t: m.turno, de: actual, a: principal, motivo });
      if (c.cambiosEsp.length > 8) c.cambiosEsp.shift();
      if (c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚖ Tu pueblo se pasa a ' + NOMBRE_BIEN[principal] + ': ' + motivo });
      else if (azar(v) < 0.35) S().cronica(m, 'comercio', c.nombre + ' deja ' + (actual === 'armas' ? 'las armas' : 'la ' + NOMBRE_BIEN[actual]) + ' por ' + (principal === 'armas' ? 'las armas' : 'la ' + NOMBRE_BIEN[principal]), 'Los mercaderes de ' + c.nombre + ' ya no sacan lo de antes con ' + NOMBRE_BIEN[actual] + ': ' + NOMBRE_BIEN[principal] + ' ' + motivo + '. Talleres y campos cambian de oficio.', c);
    }
    c.especialidad = principal;
  }
