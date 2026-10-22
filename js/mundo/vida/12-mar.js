  // ── GÉNESIS · LA VIDA · Los barcos y la marina de guerra ──

  /*
   * LOS BARCOS: cada puerto tiene un barco de pesca (trae comida) y, desde la Antigüedad, un mercante que
   * navega hasta el puerto de otro reino en paz y vuelve (oro para los dos).
   */
  function navegable(ter, t) { return ter[t] === 'agua' || ter[t] === 'bajo'; }
  // ¿Esta agua es del océano (un mar abierto que toca el borde del mapa)?
  const oceanica = (m, ter, t) => { const mr = maresDe(m, ter), id = mr.comp[t]; return id >= 0 && mr.borde.has(id) && (mr.tam[id] || 0) >= MAR_ABIERTO; };
  // El camino por agua desde t hasta el borde del mapa más cercano.
  function alBorde(m, de, ter) {
    const v = m.vida, tw = v.tw, th = v.th, prev = new Map([[de, -1]]), cola = [de];
    let fin = -1;
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i], x = t % tw, y = Math.floor(t / tw);
      if (x === 0 || y === 0 || x === tw - 1 || y === th - 1) { fin = t; break; }
      for (const n of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) if (n >= 0 && n < ter.length && !prev.has(n) && navegable(ter, n)) { prev.set(n, t); cola.push(n); }
    }
    if (fin < 0) return null;
    const out = [fin]; while (prev.get(out[out.length - 1]) !== -1) out.push(prev.get(out[out.length - 1]));
    return out.reverse();
  }
  // LA TRAVESÍA POR EL OCÉANO: entre dos mares que no se tocan dentro del mapa, el barco sale por el borde, navega por
  // alta mar (fuera del mapa, -1 en la ruta: no se ve) el tiempo que le llevaría rodear, y entra por el borde del otro.
  function rutaOceano(m, de, a, ter) {
    const directa = rutaPorMar(m, de, a, ter);
    if (directa || !oceanica(m, ter, de) || !oceanica(m, ter, a)) return directa;
    const ida = alBorde(m, de, ter), llegada = alBorde(m, a, ter);
    if (!ida || !llegada) return null;
    const tw = m.vida.tw, e1 = ida[ida.length - 1], e2 = llegada[llegada.length - 1];
    const lejos = Math.abs(e1 % tw - e2 % tw) + Math.abs(Math.floor(e1 / tw) - Math.floor(e2 / tw));
    return [...ida, ...new Array(Math.max(4, lejos)).fill(-1), ...llegada.reverse()];
  }
  function rutaPorMar(m, de, a, ter) {
    const v = m.vida, prev = new Map([[de, -1]]), cola = [de];
    for (let i = 0; i < cola.length; i++) {
      const t = cola[i];
      if (t === a) break;
      const x = t % v.tw;
      for (const n of [x > 0 ? t - 1 : -1, x < v.tw - 1 ? t + 1 : -1, t - v.tw, t + v.tw]) {
        if (n < 0 || n >= ter.length || prev.has(n) || (!navegable(ter, n) && n !== a)) continue;
        prev.set(n, t); cola.push(n);
      }
    }
    if (!prev.has(a)) return null;
    const out = [a];
    while (prev.get(out[out.length - 1]) !== -1) out.push(prev.get(out[out.length - 1]));
    return out.reverse();
  }
  // Los mares: las masas de agua navegable conectadas (un lago no lleva a ninguna parte; el mar abierto, sí).
  // Se calculan una vez y se rehacen de vez en cuando (las inundaciones y los diques cambian poco el mapa).
  let mares = { mundo: null, turno: -99, comp: null, tam: null };
  function maresDe(m, ter) {
    // Se rehace cada 50 turnos (en los mismos turnos para todos: así los jugadores en línea calculan igual).
    if (mares.mundo === m && mares.vez === Math.floor(m.turno / 50)) return mares;
    const n = ter.length, tw = m.vida.tw, comp = new Int32Array(n).fill(-1), tam = [];
    for (let t0 = 0; t0 < n; t0++) {
      if (comp[t0] >= 0 || !navegable(ter, t0)) continue;
      const id = tam.length, cola = [t0]; comp[t0] = id;
      for (let i = 0; i < cola.length; i++) { const t = cola[i], x = t % tw; for (const u of [x > 0 ? t - 1 : -1, x < tw - 1 ? t + 1 : -1, t - tw, t + tw]) if (u >= 0 && u < n && comp[u] < 0 && navegable(ter, u)) { comp[u] = id; cola.push(u); } }
      tam.push(cola.length);
    }
    // Los mares que tocan el borde del mapa son el mismo océano: por fuera del mapa, todos se juntan.
    const borde = new Set(), th = Math.floor(n / tw);
    for (let x = 0; x < tw; x++) for (const t of [x, (th - 1) * tw + x]) if (comp[t] >= 0) borde.add(comp[t]);
    for (let y = 0; y < th; y++) for (const t of [y * tw, y * tw + tw - 1]) if (comp[t] >= 0) borde.add(comp[t]);
    mares = { mundo: m, vez: Math.floor(m.turno / 50), comp, tam, borde };
    return mares;
  }
  const MAR_ABIERTO = 250; // casillas de agua para que cuente como mar (y no como lago)
  // El agua junto a una casilla: si hay varias, la del mar más grande.
  const aguaJunto = (m, t, ter) => { const mr = maresDe(m, ter); let mejor, tm = -1; for (const d of [1, -1, m.vida.tw, -m.vida.tw]) { const u = t + d; if (u >= 0 && u < ter.length && navegable(ter, u)) { const z = mr.tam[mr.comp[u]] || 0; if (z > tm) { tm = z; mejor = u; } } } return mejor; };
  const enMarAbierto = (m, t, ter) => { const mr = maresDe(m, ter), u = aguaJunto(m, t, ter); return u != null && (mr.tam[mr.comp[u]] || 0) >= MAR_ABIERTO; };
  // Dónde va el puerto: en la costa del mar abierto de su tierra, lo más cerca posible de la capital.
  function sitioPuerto(m, c, ter) {
    const v = m.vida, cap = centro(m, c.capital); let mejor = null, md = 1e9;
    for (const r of S().casillas(m, c)) for (const t of parcelas(m, r)) {
      if (v.obra[t] || v.roca[t] || v.camino[t] || ocupada(v, t) || !(ter[t] === 'arena' || CONSTRUIBLE.has(ter[t])) || navegable(ter, t) || !enMarAbierto(m, t, ter)) continue;
      const d = dist(m, t, cap); if (d < md) { md = d; mejor = t; }
    }
    return mejor;
  }
  // EL BARCO DE CADA MUELLE PRIVADO: un mercante de la casa comercial, que comercia con los socios del reino. Se bota
  // al empezar el turno y también al acabarlo (así un muelle recién comprado o terminado ya tiene su barco).
  function botarMuelles(m, ter) {
    const v = m.vida;
    for (const t of Object.keys(v.privados || {}).map(Number)) {
      const pv = v.privados[t]; if (pv.tipo !== 'muelle' || v.obra[t] !== OBRA.muelle || m.dueno[region(m, t)] !== pv.civ || v.barcos.some(b => b.puerto === t)) continue;
      const agua = aguaJunto(m, t, ter); if (agua == null) continue;
      const x = agua % v.tw, y = agua / v.tw | 0;
      v.barcos.push({ id: v.sig++, tipo: 'mercante', c: pv.civ, privado: pv.dueno, puerto: t, x, y, ruta: null, i: 0, vuelta: 0, r: [x, y] });
    }
  }
  let puertosDelTurno = [], travesias = {};
  function barcos(m, ter) {
    const v = m.vida;
    puertosDelTurno = [];
    for (let t = 0; t < v.obra.length; t++) if (v.obra[t] === OBRA.puerto) puertosDelTurno.push(t);
    // Un barco que se queda sin puerto (quemado, conquistado) devuelve su carga a su pueblo antes de desaparecer.
    // (Si el muelle pasó a otro dueño —herencia, relevo, venta—, el barco pasa con él.)
    for (const b of v.barcos || []) if (b.privado != null && v.obra[b.puerto] === OBRA.muelle && v.privados && v.privados[b.puerto] && v.privados[b.puerto].tipo === 'muelle') b.privado = v.privados[b.puerto].dueno;
    const conMuelle = b => b.privado != null && v.obra[b.puerto] === OBRA.muelle && v.privados && v.privados[b.puerto] && v.privados[b.puerto].dueno === b.privado;
    const sigue = b => (v.obra[b.puerto] === OBRA.puerto || conMuelle(b)) && m.dueno[region(m, b.puerto)] === b.c;
    for (const b of v.barcos || []) if (b.carga && !sigue(b)) { const c = S().civ(m, b.c); if (c && c.viva) descargar(m, b, c); }
    v.barcos = (v.barcos || []).filter(sigue);
    botarMuelles(m, ter);
    for (const t of puertosDelTurno) {
      const c = S().civ(m, m.dueno[region(m, t)]);
      if (!c) continue;
      const agua = aguaJunto(m, t, ter);
      if (agua == null) continue;
      // Desde el principio, cada puerto tiene su barca de pesca y su mercante (canoas en el Neolítico): para un
      // pueblo isleño el mar es el único camino para comerciar y crecer.
      for (const tipo of ['pesca', 'mercante']) {
        if (v.barcos.some(b => b.puerto === t && b.tipo === tipo)) continue;
        v.barcos.push({ id: v.sig++, tipo, c: c.id, puerto: t, x: agua % v.tw, y: agua / v.tw | 0, ruta: null, i: 0, vuelta: 0, r: [] });
      }
      // La marina de guerra: en guerra, cada puerto bota un barco de guerra de su época (galera, galeón o
      // acorazado). Cuesta madera y, desde el galeón, metal (el acorazado, también petróleo en la Era Moderna).
      const cl = claseNaval(c.era), nv = NAVAL[cl], crudo = cl === 'acorazado' && pausada(m) ? 2 : 0;
      if (c.era >= 1 && c.guerras.length && !v.barcos.some(b => b.puerto === t && b.tipo === 'guerra') && (c.madera || 0) >= nv.madera + 4 && (c.metal || 0) + (c.armas || 0) >= nv.metal && (c.petroleo || 0) >= crudo) {
        // El hierro sale del almacén de metal y, si no llega, de las armas ya forjadas.
        const deMetal = Math.min(nv.metal, Math.max(0, c.metal || 0)); c.metal -= deMetal; c.armas = (c.armas || 0) - (nv.metal - deMetal); c.madera -= nv.madera; c.petroleo = (c.petroleo || 0) - crudo;
        v.barcos.push({ id: v.sig++, tipo: 'guerra', clase: cl, c: c.id, puerto: t, x: agua % v.tw, y: agua / v.tw | 0, ruta: null, i: 0, vuelta: 0, r: [], pv: nv.pv });
        (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚓ ' + (cl === 'galera' ? 'Botada una ' : 'Botado un ') + nv.nombre });
      }
    }
    // Los hundidos se van al fondo; en paz, los barcos de guerra vuelven a puerto y se desarman; los transportes
    // sin ejército que llevar, también. El fuego se apaga al cabo de unos turnos.
    v.barcos = v.barcos.filter(b => !b.hundido && (b.pv == null || b.pv > 0) && (b.tipo !== 'guerra' || (S().civ(m, b.c) || { guerras: [] }).guerras.length) && (b.tipo !== 'transporte' || b.estado === 'vuelve' || (b.colonia ? v.expediciones && v.expediciones[b.c] && v.expediciones[b.c].barco === b.id : v.ejercitos[b.c] && v.ejercitos[b.c].mar) || v.aldeanos.some(a => a.aBordo === b.id)));
    for (const b of v.barcos) if (b.ardiendo > 0) b.ardiendo--;
  }
  // El acorazado: navega hacia el puerto enemigo más cercano y, cuando tiene a tiro soldados o edificios de la
  // costa enemiga, dispara sus cañones (los soldados enemigos con artillería y las torres le responden).
  /*
   * LA MARINA DE GUERRA, por épocas: galeras con flechas incendiarias (de la Edad del Bronce a la Edad Media),
   * galeones con cañones (del Renacimiento a la Revolución Industrial) y acorazados (Era Moderna en adelante).
   * Pelean entre ellas: la flecha incendiaria prende el casco y el barco se va quemando; el cañonazo lo revienta.
   * Sin vida, el barco se hunde (con quien lleve dentro).
   */
  const NAVAL = {
    galera: { nombre: 'galera de guerra', desde: 1, pv: 60, alcance: 4, dano: 12, disparo: 4, madera: 15, metal: 0 },
    galeon: { nombre: 'galeón', desde: 5, pv: 110, alcance: 6, dano: 26, disparo: 2, madera: 18, metal: 6 },
    acorazado: { nombre: 'acorazado', desde: 7, pv: 170, alcance: 8, dano: 44, disparo: 2, madera: 0, metal: 8 }
  };
  const claseNaval = era => (era >= 7 ? 'acorazado' : era >= 5 ? 'galeon' : 'galera');
  const PV_BARCO = { pesca: 30, mercante: 40, transporte: 60 };
  const vidaBarco = b => (b.pv != null ? b.pv : (b.pv = b.tipo === 'guerra' ? NAVAL[b.clase || 'acorazado'].pv : PV_BARCO[b.tipo] || 40));
  function hundir(m, b, paso) {
    const v = m.vida;
    if (b.hundido) return;
    b.hundido = 1; b.pv = 0;
    (v.naufragios = v.naufragios || []).push([b.x, b.y, Math.min(TICKS, paso), b.tipo, b.clase || null, b.c, b.id]);
    // Los que iban a bordo se ahogan.
    const ahogados = v.aldeanos.filter(a => a.aBordo === b.id);
    for (const a of ahogados) { a.aBordo = null; v.muertos.push([b.x, b.y, a.c, 'ahogado', Math.min(TICKS, paso), a]); }
    if (ahogados.length) v.aldeanos = v.aldeanos.filter(a => !ahogados.includes(a));
    const c = S().civ(m, b.c);
    if (c && c.jugador) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '🌊 ' + (b.tipo === 'guerra' ? ((b.clase || 'acorazado') === 'galera' ? 'Hundida una ' : 'Hundido un ') + NAVAL[b.clase || 'acorazado'].nombre : b.tipo === 'transporte' ? (b.colonia ? 'Hundido el barco de los colonos' + (ahogados.length ? ': se ahogan ' + ahogados.length : '') : 'Hundido un transporte' + (ahogados.length ? ' con ' + ahogados.length + ' soldados' : '')) : 'Hundido un barco') });
  }
  // Un paso hacia un punto del mar (el vecino navegable que más acerca).
  function acercarPorMar(m, b, x, y, ter) {
    const v = m.vida; let mejor = null, md = Math.abs(b.x - x) + Math.abs(b.y - y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = b.x + dx, ny = b.y + dy, n = ny * v.tw + nx; if (nx < 0 || nx >= v.tw || n < 0 || n >= ter.length || !navegable(ter, n)) continue; const d = Math.abs(nx - x) + Math.abs(ny - y); if (d < md) { md = d; mejor = [nx, ny]; } }
    if (mejor) { b.x = mejor[0]; b.y = mejor[1]; b.ruta = null; return true; }
    return false;
  }
  // ¿Se puede ir por mar de los puertos de a a los de b? (para las guerras y el comercio entre islas)
  function porMar(m, a, b) {
    if (!m.vida || !(a.puertos > 0) || !(b.puertos > 0)) return false;
    const ter = terrenos(m), de = puertosDelTurno.filter(t => m.dueno[region(m, t)] === a.id), a2 = puertosDelTurno.filter(t => m.dueno[region(m, t)] === b.id);
    if (travesias.mundo !== m) travesias = { mundo: m };
    for (const p of de.slice(0, 2)) for (const q of a2.slice(0, 2)) {
      const x = aguaJunto(m, p, ter), y = aguaJunto(m, q, ter); if (x == null || y == null) continue;
      const clave = 'o' + x + '>' + y; if (!(clave in travesias)) travesias[clave] = rutaOceano(m, x, y, ter);
      if (travesias[clave]) return true;
    }
    return false;
  }
  // El desembarco: desde un puerto propio, por mar, hasta la costa enemiga más cercana a su corazón.
  function planNaval(m, c, o, preferida) {
    const v = m.vida, ter = terrenos(m);
    const puertos = puertosDelTurno.filter(t => m.dueno[region(m, t)] === c.id && v.obra[t] === OBRA.puerto);
    if (!puertos.length) return null;
    if (travesias.mundo !== m) travesias = { mundo: m };
    const mr = maresDe(m, ter);
    // (Dos mares que dan al océano abierto se juntan por fuera del mapa, como para los mercantes.)
    const mismoMar = (x, y) => mr.comp[x] === mr.comp[y] || (oceanica(m, ter, x) && oceanica(m, ter, y));
    const nuestros = puertos.slice(0, 3).map(p => [p, aguaJunto(m, p, ter)]).filter(([, w]) => w != null);
    // Las tierras del enemigo, de la más cercana a su corazón a la más lejana; solo las que dan al mismo mar que
    // alguno de nuestros puertos (así no se intenta desembarcar en la orilla de un lago).
    const regiones = S().casillas(m, o).sort((p, q) => S().distancia(p, preferida != null ? preferida : o.capital) - S().distancia(q, preferida != null ? preferida : o.capital));
    let intentos = 0;
    for (const r of regiones) {
      const costa = parcelas(m, r).find(t => andable(ter[t]) && !navegable(ter, t) && aguaJunto(m, t, ter) != null && nuestros.some(([, w]) => mismoMar(w, aguaJunto(m, t, ter))));
      if (costa == null) continue;
      if (++intentos > 4) break;
      const a = aguaJunto(m, costa, ter);
      for (const [p, de] of nuestros) {
        if (!mismoMar(de, a)) continue;
        const clave = 'o' + de + '>' + a; if (!(clave in travesias)) travesias[clave] = rutaOceano(m, de, a, ter);
        const ruta = travesias[clave];
        if (ruta && ruta.length > 1) return { obj: preferida != null && m.dueno[preferida] === o.id ? preferida : r, puerto: p, de, a, tierra: costa, ruta };
      }
    }
    // (Si ninguna costa cerca de su capital sirve, se desembarca junto a uno de sus puertos: por ahí se llega seguro.)
    for (const q of puertosDelTurno.filter(t => m.dueno[region(m, t)] === o.id).slice(0, 3)) {
      const r = region(m, q), costa = parcelas(m, r).find(t => andable(ter[t]) && !navegable(ter, t) && aguaJunto(m, t, ter) != null && nuestros.some(([, w]) => mismoMar(w, aguaJunto(m, t, ter))));
      if (costa == null) continue;
      const a = aguaJunto(m, costa, ter);
      for (const [p, de] of nuestros) {
        if (!mismoMar(de, a)) continue;
        const clave = 'o' + de + '>' + a; if (!(clave in travesias)) travesias[clave] = rutaOceano(m, de, a, ter);
        const ruta = travesias[clave];
        if (ruta && ruta.length > 1) return { obj: preferida != null && m.dueno[preferida] === o.id ? preferida : r, puerto: p, de, a, tierra: costa, ruta };
      }
    }
    return null;
  }

  // El transporte: espera en el puerto a que embarque el ejército, cruza el mar y lo deja en la costa enemiga.
  function navegarTransporte(m, b, c, ter, paso) {
    const v = m.vida, e = v.ejercitos[c.id];
    if (b.estado === 'zarpa' && b.ruta) {
      b.i = Math.min(b.ruta.length - 1, b.i + 2); const t = b.ruta[b.i]; if (t < 0) { b.altaMar = 1; b.x = -20; b.y = -20; } else { b.altaMar = 0; b.x = t % v.tw; b.y = t / v.tw | 0; }
      if (b.i >= b.ruta.length - 1) {
        // Desembarco: los soldados saltan a la playa (y a las casillas de tierra de alrededor).
        const tierra = b.tierra, abordo = v.aldeanos.filter(a => a.aBordo === b.id);
        const sitios = [tierra, tierra + 1, tierra - 1, tierra + v.tw, tierra - v.tw].filter(x => x >= 0 && x < ter.length && andable(ter[x]) && !navegable(ter, x));
        abordo.forEach((a, i) => { const x = sitios[i % sitios.length] != null ? sitios[i % sitios.length] : tierra; a.aBordo = null; a.x = x % v.tw; a.y = x / v.tw | 0; a.e = LIBRE; });
        if (b.colonia) {
          // Los colonos pisan su tierra nueva y siguen andando hasta donde acamparán.
          for (const a of abordo) a.porMar = 0;
          if (v.expediciones) delete v.expediciones[c.id];
          if (c.jugador && abordo.length) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚓ ' + abordo.length + ' colonos desembarcan en tierras nuevas', region: region(m, tierra) });
        } else {
          if (e && e.mar) { e.fase = 'marcha'; e.desembarco = region(m, tierra); e.mar = null; }
          if (c.jugador && abordo.length) (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚓ ¡Desembarco! ' + abordo.length + ' soldados en la costa enemiga', region: region(m, tierra) });
        }
        b.estado = 'vuelve'; b.ruta = b.ruta.slice().reverse(); b.i = 0;
      }
    } else if (b.estado === 'vuelve' && b.ruta) {
      b.i = Math.min(b.ruta.length - 1, b.i + 2); const t = b.ruta[b.i]; if (t < 0) { b.altaMar = 1; b.x = -20; b.y = -20; } else { b.altaMar = 0; b.x = t % v.tw; b.y = t / v.tw | 0; }
      if (b.i >= b.ruta.length - 1) { b.hundido = 0; b.pv = 0; } // de vuelta en casa: se amarra (y desaparece)
    }
  }
  function navegarGuerra(m, b, c, ter, paso) {
    const v = m.vida, tw = v.tw, enemigo = o => o && c.guerras.some(g => g.con === o.id);
    const nv = NAVAL[b.clase || 'acorazado'];
    // Ardiendo: cada paso se quema un poco más (y si no queda casco, se hunde).
    if (b.ardiendo > 0) { b.pv = vidaBarco(b) - 2; if (b.pv <= 0) { hundir(m, b, paso); return; } }
    // Primero, los barcos enemigos: va a por el más cercano y, a tiro, dispara (flechas de fuego o cañonazos).
    let presa = null, dp = 15;
    for (const s2 of v.barcos) { if (s2 === b || s2.hundido || !enemigo(S().civ(m, s2.c))) continue; const d = Math.abs(s2.x - b.x) + Math.abs(s2.y - b.y); if (d < dp || (d === dp && presa && presa.tipo !== 'guerra' && s2.tipo === 'guerra')) { dp = d; presa = s2; } }
    if (presa) {
      if (dp > nv.alcance - 1) acercarPorMar(m, b, presa.x, presa.y, ter);
      if (dp <= nv.alcance && paso % 2 === 0) {
        v.disparos.push([b.x, b.y, presa.x, presa.y, paso, nv.disparo, b.id]);
        if (azar(v) < 0.65) {
          presa.pv = vidaBarco(presa) - Math.round(nv.dano * (0.8 + azar(v) * 0.4));
          if (nv.disparo === 4) presa.ardiendo = Math.max(presa.ardiendo || 0, 3);
          if (presa.pv <= 0) hundir(m, presa, paso + 0.5);
        }
      }
      return;
    }
    if (!b.ruta || b.i >= b.ruta.length - 1) {
      // Va al puerto enemigo más cercano al que se pueda llegar por mar (los de otros mares no cuentan).
      const de = b.y * tw + b.x;
      if (travesias.mundo !== m) travesias = { mundo: m };
      const blancos = puertosDelTurno.filter(t => enemigo(S().civ(m, m.dueno[region(m, t)]))).map(t => aguaJunto(m, t, ter)).filter(a => a != null && a !== de).sort((p, q) => dist(m, de, p) - dist(m, de, q)).slice(0, 3);
      b.ruta = null; b.i = 0;
      for (const a of blancos) {
        const clave = 'g' + de + '>' + a;
        if (!(clave in travesias)) travesias[clave] = rutaPorMar(m, de, a, ter);
        if (travesias[clave] && travesias[clave].length > 1) { b.ruta = travesias[clave]; break; }
      }
    }
    if (b.ruta && b.i < b.ruta.length - 1) { b.i = Math.min(b.ruta.length - 1, b.i + 1); const t = b.ruta[b.i]; b.x = t % tw; b.y = t / tw | 0; }
    else if (!b.ruta) {
      // Sin puerto enemigo a su alcance, patrulla la costa propia: así defiende de los desembarcos.
      const base = aguaJunto(m, b.puerto, ter);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
        const n = (b.y + dy) * tw + b.x + dx;
        if (b.x + dx >= 0 && b.x + dx < tw && n >= 0 && n < ter.length && navegable(ter, n) && base != null && dist(m, n, base) <= 12) { b.x += dx; b.y += dy; break; }
      }
    }
    // Los cañones: alcance 7, uno de cada dos pasos.
    if (paso % 2) return;
    const objetivos = v.aldeanos.filter(a => a.o === GUERRERO && enemigo(S().civ(m, a.c)) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 7);
    if (objetivos.length) {
      const a = objetivos[Math.floor(azar(v) * objetivos.length)];
      v.disparos.push([b.x, b.y, a.x, a.y, paso, nv.disparo, b.id]);
      if (nv.disparo === 4) { if (azar(v) < 0.5 && golpear(v, null, a, Math.round(nv.dano * (0.8 + azar(v) * 0.4)), paso + 0.5, b.x, b.y)) { v.aldeanos = v.aldeanos.filter(x => x !== a); v.muertos.push([a.x, a.y, a.c, 'flecha', paso + 0.5, a]); apuntarBaja(m, c.id, a); } }
      else if (azar(v) < 0.7) estallido(m, c, a.y * tw + a.x, 1, nv.dano, paso, null, 'acorazado', null);
      // La artillería y los tanques de la costa le devuelven el fuego.
      if (objetivos.some(x => x.veh) && azar(v) < 0.25) { b.pv = vidaBarco(b) - 20; if (b.pv <= 0) { hundir(m, b, paso); return; } }
      return;
    }
    // Sin soldados a tiro: bombardea edificios de la costa enemiga (los deja en ruinas de vez en cuando).
    if (azar(v) < 0.3) {
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const t = (b.y + dy) * tw + b.x + dx; if (t < 0 || t >= v.obra.length || Math.abs(dx) + Math.abs(dy) > 6) continue;
        const o = v.obra[t]; if (!o || o === OBRA.ruina || o === OBRA.campo || !enemigo(S().civ(m, m.dueno[region(m, t)]))) continue;
        v.disparos.push([b.x, b.y, t % tw, t / tw | 0, paso, nv.disparo, b.id]);
        if (v.torres && v.torres[t] != null && v.torres[t] > 0) { b.pv = vidaBarco(b) - 4; if (b.pv <= 0) { hundir(m, b, paso); return; } }
        if (nv.disparo === 4) { if (azar(v) < 0.4) prender(m, t, paso, 2); }
        else estallido(m, c, t, 1, nv.dano, paso, null, 'acorazado', null);
        return;
      }
    }
  }
  function navegar(m, b, ter, paso) {
    const v = m.vida, c = S().civ(m, b.c);
    if (!c) return;
    if (b.hundido) { b.r.push(b.x, b.y); return; }
    if (b.tipo !== 'guerra' && b.ardiendo > 0) { b.pv = vidaBarco(b) - 2; if (b.pv <= 0) { hundir(m, b, paso || 1); b.r.push(b.x, b.y); return; } }
    if (b.tipo === 'guerra') { navegarGuerra(m, b, c, ter, paso || 1); b.r.push(b.x, b.y); return; }
    if (b.tipo === 'transporte') { navegarTransporte(m, b, c, ter, paso || 1); b.r.push(b.x, b.y); return; }
    if (b.tipo === 'pesca') {
      // Faena cerca de su puerto: cada tanto vuelve con pescado.
      const base = aguaJunto(m, b.puerto, ter);
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(azar(v) * 4)];
        const n = (b.y + dy) * v.tw + b.x + dx;
        if (b.x + dx >= 0 && b.x + dx < v.tw && n >= 0 && n < ter.length && navegable(ter, n) && dist(m, n, base) <= 7) { b.x += dx; b.y += dy; break; }
      }
      if (azar(v) < 0.15) alimento(c, 'pescado', 1);
    } else {
      if (!b.ruta) {
        if (azar(v) < 0.45) { b.r.push(b.x, b.y); return; }
        // Solo a los puertos a los que se puede llegar por mar (mismo mar), de reinos en paz.
        const de = aguaJunto(m, b.puerto, ter), mr = maresDe(m, ter);
        const otros = puertosDelTurno.filter(t => { if (t === b.puerto) return false; const o = S().civ(m, m.dueno[region(m, t)]); if (!o || o.id === c.id || !comercian(m, c, o)) return false; const a = aguaJunto(m, t, ter); return de != null && a != null && (mr.comp[a] === mr.comp[de] || (oceanica(m, ter, a) && oceanica(m, ter, de))); });
        if (!otros.length) { b.r.push(b.x, b.y); return; }
        // Si hay algo encargado, primero a un puerto de quien lo pueda vender.
        const utiles = otros.filter(t => sirveSocio(m, c, S().civ(m, m.dueno[region(m, t)])));
        const lista = utiles.length ? utiles : otros, destino = lista[Math.floor(azar(v) * lista.length)];
        const a = aguaJunto(m, destino, ter);
        // Las travesías se recuerdan (el mar no cambia): solo se calcula la primera vez.
        const clave = 'o' + de + '>' + a;
        if (!(clave in travesias) || travesias.mundo !== m) { if (travesias.mundo !== m) travesias = { mundo: m }; travesias[clave] = rutaOceano(m, de, a, ter); }
        const ruta = travesias[clave];
        if (!ruta || ruta.length < 3) { b.r.push(b.x, b.y); return; }
        b.ruta = ruta; b.i = 0; b.vuelta = 0; b.destino = destino;
        // Como los comerciantes de tierra (y los trenes): zarpa con lo que le sobra a su pueblo y al otro le falta.
        const o = S().civ(m, m.dueno[region(m, destino)]);
        if (o && !b.carga) cargar(m, b, c, o, bodegaDe(c));
      }
      // Si a mitad de camino ya no se puede comerciar con el destino (guerra, cierre, otro dueño), da media vuelta.
      if (!b.vuelta && b.destino != null) { const o = S().civ(m, m.dueno[region(m, b.destino)]); if (!o || !comercian(m, c, o)) { b.vuelta = 1; b.destino = null; } }
      b.i += b.vuelta ? -2 : 2;
      if (!b.vuelta && b.i >= b.ruta.length - 1) {
        b.i = b.ruta.length - 1; b.vuelta = 1;
        const o = S().civ(m, m.dueno[region(m, b.destino)]);
        // En el puerto de destino vende la carga y compra lo que hace falta en casa, igual que una carreta.
        if (o && comercian(m, c, o)) {
          venderComprar(m, b, c, o, bodegaDe(c), 'mar'); c.riqueza += 2 + c.era * 0.5; o.riqueza += 2 + o.era * 0.5; c.rel[o.id] = o.rel[c.id] = Math.min(100, (c.rel[o.id] || 0) + 1);
          // El barco de un muelle privado: la casa comercial gana el flete (y paga su parte al reino).
          const dueno = b.privado != null && v.aldeanos.find(x => x.id === b.privado && x.merc);
          if (dueno) { const flete = (2 + 0.4 * c.era) * (dueno.merc.de == null ? 1 : 1), imp = flete * 0.25; dueno.merc.caja = redondo(dueno.merc.caja + flete - imp); c.oro = (c.oro || 0) + imp; }
        }
        b.destino = null; // (de vuelta a casa ya no comercia con nadie)
      } else if (b.vuelta && b.i <= 0) { b.i = 0; b.ruta = null; descargar(m, b, c); }
      const t = b.ruta ? b.ruta[Math.max(0, Math.min(b.ruta.length - 1, b.i))] : aguaJunto(m, b.puerto, ter);
      if (t != null && t < 0) { b.altaMar = 1; b.x = -20; b.y = -20; }
      else if (t != null) { b.altaMar = 0; b.x = t % v.tw; b.y = t / v.tw | 0; }
    }
    b.r.push(b.x, b.y);
  }
