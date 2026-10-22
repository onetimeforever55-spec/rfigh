  // ── GÉNESIS · EL MUNDO · La técnica que se paga, el tesoro, el paso de edad, anexiones y sucesos ──

  // ---------- La técnica: se investiga una tecnología cada vez ----------
  // El ritmo pausado (partidas nuevas): turnos de menos años en cada era. La técnica avanza en proporción, así
  // que cada era sigue llegando a su fecha; pero hay muchos más turnos para vivirla.
  const ritmo = m => m.ritmo || 1;
  const maxEraDe = m => Math.max(0, ...vivas(m).map(c => c.era));
  const aniosBase = m => m.libre ? 1 : ritmo(m) > 1 ? M.ERAS[maxEraDe(m)].aniosLento : M.ERAS[maxEraDe(m)].anios;
  // Con el ritmo pausado, el calendario no se escapa de la historia: si ya llegó la fecha de la era siguiente y
  // nadie la ha alcanzado, el tiempo casi se detiene (un año cada cuatro turnos) hasta que algún pueblo dé el paso.
  const aniosTurno = m => {
    const b = aniosBase(m);
    if (m.libre || ritmo(m) <= 1) return b;
    const sig = M.ERAS[maxEraDe(m) + 1];
    return sig && sig.desde != null && m.anio >= sig.desde ? Math.min(b, 0.25) : b;
  };
  const pausa = m => ritmo(m) > 1 && !m.libre ? aniosBase(m) / M.ERAS[maxEraDe(m)].anios : ritmo(m) > 1 ? 1 / ritmo(m) : 1;
  // ¿Se puede investigar ya? Hace falta su edificio (el molino, el templo, el cuartel…). El precio no hace falta
  // tenerlo de golpe: se va pagando poco a poco mientras se investiga (ver «investigar»).
  const EDIFICIO = { saber: c => c.saberes > 0, plaza: () => true, molino: c => c.molinos > 0, templo: c => c.templos > 0, cuartel: c => c.cuarteles > 0, puerto: c => c.puertos > 0 };
  function faltaPara(m, c, t) {
    const falta = [];
    const UN = { saber: 'una casa del saber', molino: 'un molino', templo: 'un templo', cuartel: 'un cuartel', puerto: 'un puerto', plaza: 'una plaza' };
    if (m.vida && !EDIFICIO[t.lugar || 'plaza'](c)) falta.push(UN[t.lugar || 'plaza'] || 'un ' + t.lugar);
    return falta;
  }
  // Lo pagado de cada mejora se guarda aunque se cambie de investigación: no se pierde.
  const pagadoDe = (c, id) => ((c.pagosTec = c.pagosTec || {})[id] = c.pagosTec[id] || {});
  // Lo que aún queda por pagar de una mejora, recurso a recurso.
  function porPagar(c, t) { const pg = (c.pagosTec || {})[t.id] || {}, out = {}; for (const k of Object.keys(t.precio || {})) { const q = t.precio[k] - (pg[k] || 0); if (q > 0.01) out[k] = Math.ceil(q); } return out; }
  // Qué parte del precio está pagada (de 0 a 1): la investigación no puede ir por delante de lo pagado.
  function partePagada(c, t) { const pg = (c.pagosTec || {})[t.id] || {}; let f = 1; for (const k of Object.keys(t.precio || {})) if (t.precio[k] > 0) f = Math.min(f, (pg[k] || 0) / t.precio[k]); return f; }
  // Se paga lo que hace falta para avanzar hasta la parte «hasta» (de 0 a 1), con lo que haya en el almacén
  // (sin dejar al pueblo sin comida).
  function pagarHasta(c, t, hasta) {
    const pg = pagadoDe(c, t.id);
    // Cerca de la edad siguiente se guarda lo que pide el paso de edad (salvo que el jugador no quiera).
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1];
    const guarda = req && sig && c.ciencia >= sig.umbral * 0.5 && !(c.jugador && !(c.plan && (c.plan.autoEdad || c.plan.ahorrarEdad)));
    for (const k of Object.keys(t.precio || {})) {
      const quiere = t.precio[k] * Math.min(1, hasta) - (pg[k] || 0);
      if (quiere <= 0) continue;
      const reserva = Math.max(k === 'comida' ? (c.aldeanos || 0) * 0.8 : 0, guarda ? req[k] || 0 : 0);
      const da = Math.max(0, Math.min(quiere, (c[k] || 0) - reserva));
      c[k] = (c[k] || 0) - da; pg[k] = (pg[k] || 0) + da;
    }
  }
  // ¿Está ahorrando para subir de edad? (Ya tiene el saber y la fecha: solo le falta pagar.) La IA no gasta
  // entonces en mejoras; el jugador, si lo pide («ahorrad para la edad»).
  function ahorrando(m, c) {
    if (!M.ERAS[c.era + 1] || c.subiendo || (c.jugador && !(c.plan && c.plan.ahorrarEdad))) return false;
    const sig = M.ERAS[c.era + 1];
    // Si aún le faltan las mejoras de la edad, no ahorra: las investiga (si no, se quedaría atascado para siempre).
    if (m.vida && ritmo(m) > 1) { const r = mejorasDeEdad(c); if (r.hechas < r.pide) return false; }
    return c.ciencia >= sig.umbral * 0.85 && (m.libre || sig.desde == null || m.anio >= sig.desde - aniosTurno(m) * 4);
  }
  function elegirTec(m, c) {
    if (m.vida && ahorrando(m, c) && !(c.plan && c.plan.investigar)) return null;
    const ts = M.tecsDe(c), libres = M.TECNOLOGIAS.filter(t => t.era <= c.era && !ts.includes(t.id) && !faltaPara(m, c, t).length);
    const pide = c.plan && c.plan.investigar;
    if (pide) { const t = M.TECNOLOGIAS.find(x => x.id === pide); if (t && !ts.includes(pide) && t.era <= c.era) return faltaPara(m, c, t).length ? null : pide; }
    if (!libres.length) return null;
    // La IA (y el gobernador del jugador si no elige) va según su carácter y lo que le falta.
    const gusto = t => { const e = t.efecto; let k = 0;
      if (c.caracter === 'guerrero') k += (e.ataque || 0) * 10 + (e.defensa || 0) * 8;
      if (c.caracter === 'mercader') k += (e.oro || 0) * 8 + (e.comercio || 0) * 6;
      if (c.caracter === 'sabio' || c.caracter === 'devoto') k += (e.ciencia || 0) * 10 + (e.estab || 0) * 0.5;
      if ((c.comida || 0) < (c.aldeanos || 10) * 0.6) k += (e.cosecha || 0) * 2 + (e.granero || 0) * 2;
      if (c.guerras.length) k += (e.ataque || 0) * 8 + (e.defensa || 0) * 8;
      if (c.oro < 0) k += (e.oro || 0) * 8;
      // Con el ritmo pausado, primero las mejoras que pide la edad para poder avanzar.
      if (m.vida && ritmo(m) > 1 && t.era === c.era && mejorasDeEdad(c).hechas < mejorasDeEdad(c).pide) k += 50;
      // Mejor lo que se puede ir pagando ya (con lo que hay en el almacén) que lo que dejaría a los sabios parados.
      if (m.vida) { const d = porPagar(c, t); for (const r of Object.keys(d)) if ((c[r] || 0) < d[r] * 0.25) k -= 40; }
      return k + t.era * -5 + ((c.id * 7 + M.TECNOLOGIAS.indexOf(t)) % 5) * 0.01; };
    return libres.sort((a, b) => gusto(b) - gusto(a))[0].id;
  }
  function investigar(m, c, puntos) {
    const ts = M.tecsDe(c), inv = c.investigacion = c.investigacion || { id: null, puntos: 0 };
    // Lo que se investiga mientras se espera la era siguiente no se pierde: los sabios adelantan trabajo.
    let resto = puntos + (inv.banco || 0); inv.banco = 0;
    for (let vueltas = 0; resto > 1e-9 && vueltas < 6; vueltas++) {
      if (!inv.id || ts.includes(inv.id)) {
        inv.id = elegirTec(m, c); inv.puntos = (c.puntosTec && inv.id && c.puntosTec[inv.id]) || 0;
        if (!inv.id) { inv.banco = Math.min(resto, 4000); return; }
      }
      const t = M.TECNOLOGIAS.find(x => x.id === inv.id), coste = M.costeTec(t);
      // Se paga a medida que se avanza: cada punto de saber pide su parte del precio. Sin recursos, se espera
      // (el saber de los sabios se guarda para cuando lleguen).
      if (m.vida) pagarHasta(c, t, (inv.puntos + resto) / coste);
      const tope = m.vida ? partePagada(c, t) * coste : coste;
      const pon = Math.max(0, Math.min(resto, coste - inv.puntos, tope - inv.puntos));
      if (pon <= 1e-9) {
        inv.banco = Math.min(resto, 4000); inv.esperaPago = (inv.esperaPago || 0) + 1;
        // Parados mucho tiempo por falta de recursos: se cambia a otra mejora (lo pagado se guarda), salvo que la
        // haya elegido el jugador.
        if (inv.esperaPago >= 6 && !(c.plan && c.plan.investigar === inv.id)) { (c.puntosTec = c.puntosTec || {})[inv.id] = inv.puntos; inv.id = null; inv.puntos = 0; inv.esperaPago = 0; }
        return;
      }
      inv.esperaPago = 0;
      inv.puntos += pon; resto -= pon;
      if (inv.puntos >= coste - 1e-9) {
        ts.push(t.id); c.inventos.push(t.invento); inv.id = null; inv.puntos = 0; if (c.pagosTec) delete c.pagosTec[t.id]; if (c.puntosTec) delete c.puntosTec[t.id];
        if (c.plan && c.plan.investigar === t.id) c.plan.investigar = null;
        (m.avances = m.avances || []).push({ civ: c.id, tec: t.id, turno: m.turno });
        if (m.avances.length > 40) m.avances = m.avances.slice(-40);
        if (c.jugador) cronica(m, 'tecnica', c.nombre + ' domina ' + t.invento, T(t.invento) + ' llega a ' + c.nombre + ': ' + t.texto + '.', c);
      }
    }
  }
  // El tesoro: impuestos de la gente (y comercio, en vida.js) frente a los sueldos de los soldados y el
  // mantenimiento de los edificios militares. Sin oro, la gente se enfada y los soldados desertan.
  const IMPUESTO = { tribu: 0.5, cacicazgo: 0.7, reino: 1, imperio: 1.15, teocracia: 0.9, republica: 1, democracia: 0.95, dictadura: 1.2, estado_obrero: 1.05 };
  function tesoro(m, c) {
    const adultos = c.aldeanos != null ? c.aldeanos : c.pob;
    const ingreso = adultos * 0.025 * (1 + 0.1 * c.era) * (1 + M.tec(c, 'oro')) * (IMPUESTO[c.regimen] || 1) * (c.plan && c.plan.impuesto ? c.plan.impuesto : 1);
    const gasto = (c.guerreros || 0) * 0.05 * (1 + 0.1 * c.era) + ((c.cuarteles || 0) + (c.arquerias || 0) + (c.castillos || 0)) * 0.25;
    c.oro = (c.oro == null ? 10 : c.oro) + ingreso - gasto;
    // El oro que sobra de la reserva paga sabios y escuelas: se convierte en investigación (salvo que se mande guardarlo).
    const reserva = 40 + adultos * 1.5;
    if (c.oro > reserva && !(c.plan && c.plan.guardarOro)) { const pago = (c.oro - reserva) * 0.08; c.oro -= pago; c.mecenazgo = pago; investigar(m, c, pago * 0.15 * pausa(m)); c.ciencia += pago * 0.15 * pausa(m); } else c.mecenazgo = 0;
    c.ingresos = ingreso + (c.comercioOro || 0); c.gastos = gasto; c.comercioOro = 0;
    if (c.oro < 0 && c.jugador && !(c.ultimaQuiebra > m.turno - 10)) { c.ultimaQuiebra = m.turno; cronica(m, 'quiebra', 'Las arcas de ' + c.nombre + ' están vacías', 'No hay con qué pagar a los soldados: algunos cuelgan las armas y vuelven al campo, y en las plazas se oyen quejas. Hacen falta más impuestos, comercio o minas de oro.', c); }
  }
  // ¿Puede este pueblo subir de edad? Saber (ciencia acumulada), fecha, requisitos de edificios y tamaño, y precio.
  const OBRA_CUENTA = { templo: 'templos', cuartel: 'cuarteles', castillo: 'castillos', molino: 'molinos', puerto: 'puertos' };
  function mejorasDeEdad(c) {
    const lista = M.TECNOLOGIAS.filter(t => t.era === c.era), ts = M.tecsDe(c);
    return { lista, hechas: lista.filter(t => ts.includes(t.id)).length, pide: Math.min(3, lista.length) };
  }
  // Lo que la IA guarda para la mejora de la edad más barata que le falta (con el ritmo pausado): sin esto se
  // gastaría la madera y el oro en obras y nunca juntaría el precio de la técnica.
  function reservaMejora(m, c) {
    if (!m.vida || ritmo(m) <= 1 || (c.jugador && !(c.plan && c.plan.autoEdad)) || !M.ERAS[c.era + 1]) return null;
    const r = mejorasDeEdad(c); if (r.hechas >= r.pide) return null;
    const ts = M.tecsDe(c), falta = r.lista.filter(t => !ts.includes(t.id));
    if (!falta.length) return null;
    const total = t => Object.values(t.precio || {}).reduce((a, b) => a + b, 0);
    const t = falta.sort((a, b) => total(a) - total(b))[0];
    return t.precio ? porPagar(c, t) : null;
  }
  function puedeSubir(m, c) {
    const sig = M.ERAS[c.era + 1], req = M.EDADES[c.era + 1], falta = [];
    if (!sig) return { ok: false, falta: ['no hay más edades'] };
    if (c.ciencia < sig.umbral) falta.push('saber (' + Math.floor(c.ciencia) + ' de ' + sig.umbral + ')');
    if (!m.libre && sig.desde != null && m.anio < sig.desde) falta.push('llegar al año ' + anioTexto(sig.desde).replace(/(\d)\.$/, '$1'));
    // Como en Age of Empires: antes de pasar de edad hay que haber hecho las mejoras de la edad (tres).
    if (m.vida && ritmo(m) > 1) { const r = mejorasDeEdad(c); if (r.hechas < r.pide) falta.push('investigar ' + (r.pide - r.hechas) + (r.pide - r.hechas === 1 ? ' mejora' : ' mejoras') + ' más de esta edad'); }
    if (m.vida && req) {
      if (req.pide.nivel && (c.nivel || 0) < req.pide.nivel) falta.push(['', 'ser una aldea', 'ser un pueblo', 'ser una villa', 'ser una ciudad'][req.pide.nivel]);
      if (req.pide.obra && !(c[OBRA_CUENTA[req.pide.obra]] > 0)) falta.push('un ' + req.pide.obra);
      // Como las obras: para empezar basta con la cuarta parte; el resto se paga poco a poco mientras dura el paso.
      for (const k of ['comida', 'madera', 'piedra', 'oro', 'metal']) if (req[k] && disponible(m, c, k) < anticipoEdad(req[k])) falta.push((anticipoEdad(req[k]) - Math.floor(disponible(m, c, k))) + ' de ' + k + (k === 'comida' && disponible(m, c, k) < (c[k] || 0) ? ' (sin tocar la que necesita la gente)' : ''));
    }
    return { ok: !falta.length, falta };
  }
  // EL PRECIO DEL PASO DE EDAD, como las obras: si se tiene todo, se paga de golpe; si no, una cuarta parte al
  // empezar y el resto poco a poco mientras dura el paso. Si en un turno falta, el paso espera (no se pierde lo pagado).
  const anticipoEdad = n => Math.ceil(n * 0.25);
  // Lo que se puede gastar en el paso sin dejar a la gente sin comer: del granero siempre queda una reserva.
  const disponible = (m, c, k) => (c[k] || 0) - (k === 'comida' && m.vida && ritmo(m) > 1 ? Math.max(4, (c.habitantes || 0) * 0.8) : 0);
  function empezarSubida(m, c) {
    const req = M.EDADES[c.era + 1], debe = {};
    if (m.vida && req) for (const k of ['comida', 'madera', 'piedra', 'oro', 'metal']) if (req[k]) {
      const q = disponible(m, c, k) >= req[k] ? req[k] : Math.min(anticipoEdad(req[k]), Math.max(0, Math.floor(disponible(m, c, k))));
      c[k] = (c[k] || 0) - q;
      if (q < req[k]) debe[k] = req[k] - q;
    }
    const dura = ritmo(m) > 1 ? 4 : 1;
    c.subiendo = { a: c.era + 1, desde: m.turno, hasta: m.turno + dura };
    if (Object.keys(debe).length) c.subiendo.debe = debe;
    if (c.jugador) cronica(m, 'avance', c.nombre + ' se prepara para ' + M.ERAS[c.era + 1].con, 'Los sabios de ' + c.nombre + ' ponen por escrito lo aprendido, los artesanos ensayan técnicas nuevas y el gobierno paga lo que haga falta: en unos años, otra época.', c);
  }
  function subirEra(m, c, regalo) {
    if (!M.ERAS[c.era + 1]) { c.subiendo = null; return; }
    c.era++; c.subiendo = null;
    const E = M.ERAS[c.era];
    const nuevos = E.inventos.filter(x => !c.inventos.includes(x));
    const invento = regalo || (c.inventos.length ? c.inventos[c.inventos.length - 1] : elegir(m, nuevos.length ? nuevos : E.inventos));
    if (regalo) c.inventos.push(invento);
    const antes = c.regimen;
    c.regimen = regimenPorEra(m, c, casillas(m, c).length);
    const primero = !m.civs.some(o => o !== c && o.era >= c.era);
    cronica(m, 'era_' + c.era, c.nombre + ' entra en ' + E.con, (primero ? 'Es el primer pueblo del mundo en llegar. ' : '') + T(invento) + ' cambia la vida de ' + c.nombre + (c.regimen !== antes ? '; de paso, ' + M.conArticulo(antes) + ' se convierte en ' + M.unoDe(c.regimen) : '') + '.', c, null, { importante: primero });
  }
  const T = s => s.charAt(0).toUpperCase() + s.slice(1);
  const miles = p => (p >= 1000 ? (Math.round(p / 100) / 10).toLocaleString('es-ES') + ' millones' : Math.round(p).toLocaleString('es-ES') + ' mil') + ' personas';

  // Las tierras de un reino anexionado no se rebelan enseguida: el reino vencido deja de existir (no «renace»).
  const ANEXION = 150;
  const anexadaHacePoco = (m, r) => m.anexado && m.anexado[r] != null && m.turno - m.anexado[r] < ANEXION;
  function separar(m, c, cs, porque) {
    const lejos = cs.filter(i => i !== c.capital && !anexadaHacePoco(m, i)).sort((a, b) => distancia(b, c.capital) - distancia(a, c.capital));
    const parte = lejos.slice(0, Math.max(2, Math.floor(cs.length * 0.4)));
    if (parte.length < 2) return;
    // Si en las tierras rebeldes hay una ciudad, se convierte en la capital del reino nuevo y le da nombre.
    const ciudad = (m.ciudades || []).find(x => parte.includes(x.region));
    if (ciudad) { parte.splice(parte.indexOf(ciudad.region), 1); parte.unshift(ciudad.region); }
    const nueva = nuevaCiv(m, parte[0], { era: c.era, ciencia: c.ciencia * 0.9, pob: c.pob * parte.length / cs.length, riqueza: c.riqueza * 0.3, estab: 55, inventos: c.inventos.slice() });
    heredar(c, nueva, parte.length / cs.length);
    if (ciudad && !m.civs.some(x => x !== nueva && x.nombre === ciudad.nombre)) { nueva.nombre = ciudad.nombre; m.ciudades = m.ciudades.filter(x => x !== ciudad); }
    for (const i of parte) m.dueno[i] = nueva.id;
    // Con aldeanos (vida.js), la gente se va con su tierra: no hace falta repartir la población a mano.
    if (m.vida) { nueva.pob = 0.5; nueva.pobVida = null; } else c.pob -= nueva.pob;
    c.estab = 40;
    nueva.regimen = regimenPorEra(m, nueva, parte.length);
    nueva.rel[c.id] = -40; c.rel[nueva.id] = -40; nueva.origen = c.id;
    suceso(m, 'independencia', parte[0], nueva, c, '🚩 ¡Las provincias de ' + c.nombre + ' se rebelan: nace ' + nueva.nombre + '!');
    if (c.jugador && m.vida) (m.vida.anuncios = m.vida.anuncios || []).push({ civ: c.id, region: parte[0], texto: '🚩 Tus provincias lejanas se rebelan' + (porque ? ' ' + porque : '') + ' y nace ' + nueva.nombre + '. Más estabilidad (fiestas, templos, un palacio) lo evita.' });
    cronica(m, 'revuelta', 'Las provincias se rebelan', (porque ? T(porque) + ', l' : 'L') + 'as tierras lejanas de ' + c.nombre + ' dejan de obedecer a la capital y proclaman un ' + (nueva.regimen === 'republica' ? 'gobierno propio' : 'reino propio') + ': ' + nueva.nombre + '.', c, parte[0]);
  }

  function morir(m, c, quien) {
    if (!c.viva) return;
    // Los vencedores aprenden de los vencidos: se quedan con sus sabios, sus libros y lo que sabían hacer.
    if (quien && quien.viva) {
      const ts = M.tecsDe(quien);
      for (const t of M.tecsDe(c)) { const d = M.TECNOLOGIAS.find(x => x.id === t); if (d && d.era <= quien.era && !ts.includes(t)) ts.push(t); }
      quien.ciencia += Math.max(0, c.ciencia - quien.ciencia) * 0.5;
    }
    c.viva = false; c.muerte = m.anio;
    // Anexión: el vencedor se queda con todo (tierras, ciudades y gente), y esas tierras le son fieles un tiempo.
    m.anexado = m.anexado || {};
    for (let i = 0; i < W * H; i++) if (m.dueno[i] === c.id) { m.dueno[i] = quien ? quien.id : -1; if (quien) m.anexado[i] = m.turno; }
    if (quien) for (const x of m.ciudades || []) if (x.civ === c.id || x.de === c.id) { if (x.civ === c.id) x.civ = quien.id; x.conquistada = null; x.complot = null; m.anexado[x.region] = m.turno; }
    for (const o of m.civs) o.guerras = o.guerras.filter(g => g.con !== c.id);
    c.guerras = [];
    m.alianzas = (m.alianzas || []).filter(x => x.a !== c.id && x.b !== c.id);
    suceso(m, 'caida', c.capital, quien, c, '☠ ¡Cae ' + c.nombre + '!' + (quien ? ' ' + quien.nombre + ' se queda con todo' : ''));
    cronica(m, 'caida', 'Cae ' + c.nombre, quien ? quien.nombre + ' toma la última ciudad de ' + c.nombre + '. Sus dioses pasan a ser leyendas y su lengua, unas pocas palabras en la de los vencedores.' : c.nombre + ' se deshace sin que nadie lo conquiste: sus aldeas se vacían y sus templos se llenan de hierba.', c, c.capital, { importante: true });
  }

  // Los grandes sucesos que se ven en el mapa (saqueos, independencias, caídas, exterminios): la vista los
  // dibuja donde pasan y los anuncia en grande.
  function suceso(m, tipo, region, civ, otro, texto) {
    if (!m.vida) return;
    const l = m.vida.sucesos = m.vida.sucesos || [];
    l.push({ tipo, region, civ: civ ? civ.id : null, otro: otro ? otro.id : null, texto, turno: m.turno });
    if (l.length > 24) l.splice(0, l.length - 24);
  }
  // Lo que guarda un reino en sus almacenes (para el saqueo y para la herencia de los reinos que se separan).
  const ALMACEN = ['oro', 'madera', 'piedra', 'metal', 'comida', 'armas', 'carbon', 'petroleo', 'muebles', 'vehiculos', 'semillas', 'granadas'];
  function repartirAlmacen(de, a, parte) {
    for (const k of ALMACEN) { const q = (de[k] || 0) * parte; if (q > 0) { de[k] -= q; a[k] = (a[k] || 0) + q; } }
  }
  // Un reino que nace de otro (provincias rebeldes, una ciudad independiente) se lleva lo que sabía la metrópoli
  // (todas sus técnicas, también las de la era en curso) y la parte del almacén que le toca por sus tierras.
  function heredar(c, nueva, parte) {
    nueva.tecs = M.tecsDe(c).slice();
    if (c.metal != null) repartirAlmacen(c, nueva, Math.min(0.5, parte));
  }
