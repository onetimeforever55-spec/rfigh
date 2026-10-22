  // ── GÉNESIS · LA VIDA · Cambiar parcelas, la ficha de cada edificio, nombres, plazas y centros ──

  // Anota un cambio de parcela con el paso en que ocurre (la vista lo aplica en ese momento).
  function cambiar(m, capa, t, valor, paso) {
    const v = m.vida;
    if (v[capa][t] === valor) return;
    v.cambios.push([capa === 'arbol' ? 0 : capa === 'roca' ? 1 : capa === 'obra' ? 2 : capa === 'cultivo' ? 4 : 5, t, v[capa][t], valor, paso]);
    v[capa][t] = valor;
    // (Lo que se construye o se planta encima borra la ceniza, el tronco quemado y la tierra chamuscada.)
    if (valor && (capa === 'obra' || capa === 'arbol') && v.marcas && v.marcas[t] && SUELO_QUEMADO.has(v.marcas[t][0])) delete v.marcas[t];
    if (capa === 'obra' && pausada(m)) registrar(m, t, valor);
    // (Y un edificio nunca comparte casilla con la muralla: si quedaba un tramo debajo, desaparece.)
    if (capa === 'obra' && valor && valor !== OBRA.campo && valor !== OBRA.ruina && v.muro && v.muro[t] > 0) { v.muro[t] = 0; if (v.puerta) v.puerta[t] = 0; v.muroVer = (v.muroVer || 0) + 1; }
  }
  /*
   * LA FICHA DE CADA EDIFICIO (partidas pausadas): v.edificios[t] = { tipo, nombre, anio, era, civ, por, historia }.
   *  · Tiene nombre propio («Casa de los Arnez», «Molino del Arroyo», «Iglesia de San Teodo»…).
   *  · Recuerda el año en que se levantó, quién lo construyó y en qué edad: se ve con el estilo de esa edad,
   *    y no cambia de golpe cuando el reino avanza; lo reforman los constructores poco a poco.
   *  · Si se arruina o se derriba, queda escrito en su historia (o desaparece la ficha).
   */
  const DIOSES = ['Anu', 'Tamar', 'Belo', 'Ishara', 'Dagán', 'Nera', 'Ormo', 'Sefa', 'Kalu', 'Aret'];
  const LUGARES_ = ['del Arroyo', 'Viejo', 'de la Loma', 'del Cerro', 'Nuevo', 'de la Vega', 'del Prado', 'de los Álamos', 'del Río', 'de la Fuente'];
  const de = (v, l) => l[Math.floor(azar(v) * l.length)];
  function lugarDe(m, t) {
    const r = region(m, t), x = (m.ciudades || []).find(y => y.region === r || S().vecinos(y.region).includes(r));
    const c = S().civ(m, m.dueno[r]);
    return x ? x.nombre : c ? c.nombre : 'la llanura';
  }
  function nombreEdificio(m, o, t, obreros) {
    const v = m.vida, c = S().civ(m, m.dueno[region(m, t)]), era = c ? c.era : 0, sitio = lugarDe(m, t);
    const fam = obreros && obreros.length ? obreros[0].familia : M.PERSONAS.inicio[Math.floor(azar(v) * M.PERSONAS.inicio.length)] + APELLIDOS[Math.floor(azar(v) * APELLIDOS.length)];
    const santo = persona(v);
    switch (o) {
      case OBRA.casa: return 'Casa de los ' + fam;
      case OBRA.molino: return 'Molino ' + de(v, LUGARES_);
      case OBRA.templo: return era <= 1 ? 'Santuario de ' + de(v, DIOSES) : era <= 3 ? 'Templo de ' + de(v, DIOSES) : era === 4 ? 'Iglesia de San ' + santo : era <= 6 ? 'Catedral de Santa ' + santo : 'Parroquia de San ' + santo;
      case OBRA.saber: return M.CASA_SABER(era).charAt(0).toUpperCase() + M.CASA_SABER(era).slice(1) + ' de ' + santo;
      case OBRA.torre: return 'Torre ' + de(v, ['del Vigía', 'del Norte', 'del Sur', 'Vieja', 'del Río', 'de la Frontera', 'del Alba']);
      case OBRA.cuartel: return 'Cuartel de ' + sitio;
      case OBRA.arqueria: return 'Arquería de ' + sitio;
      case OBRA.castillo: return 'Castillo de ' + sitio;
      case OBRA.puerto: return 'Puerto de ' + sitio;
      case OBRA.pozo: return 'Pozo ' + de(v, ['de la Plaza', 'del Agua Dulce', 'Viejo', 'de los ' + fam, 'Hondo']);
      case OBRA.granero: return 'Granero ' + de(v, ['Grande', 'de la Cosecha', 'de los ' + fam, 'del Común']);
      case OBRA.fuente: return 'Plaza de ' + santo;
      case OBRA.parque: return 'Parque de ' + santo;
      case OBRA.palacio: return 'Palacio de ' + (c ? c.nombre : sitio);
      case OBRA.central: return 'Central eléctrica de ' + sitio;
      case OBRA.banco: return 'Banco central de ' + (c ? c.nombre : sitio);
      case OBRA.fabrica: return 'Fábrica ' + fam + ' e Hijos';
      case OBRA.estacion: return 'Estación de ' + sitio;
      case OBRA.hospital: return 'Hospital de San ' + santo;
      case OBRA.aerodromo: return 'Aeródromo de ' + sitio;
      case OBRA.campamento: return 'Campamento de ' + sitio;
      case OBRA.aduana: return 'Puesto fronterizo de ' + sitio;
      case OBRA.minapriv: case OBRA.mina: return 'Mina ' + de(v, ['de ' + sitio, 'La Esperanza', 'del Cerro', 'Honda', 'de San ' + santo, 'Vieja', 'de los ' + fam]);
      case OBRA.petroleo: return 'Pozo de petróleo ' + de(v, ['Esperanza', 'Negro', 'de ' + sitio, 'del Llano', 'Número 1', 'de los ' + fam]);
      case OBRA.ayuntamiento: return 'Ayuntamiento de ' + sitio;
      case OBRA.centro: return 'Plaza mayor de ' + (c ? c.nombre : sitio);
      default: return 'Edificio de ' + sitio;
    }
  }
  function registrar(m, t, o) {
    const v = m.vida;
    v.edificios = v.edificios || {};
    const rec = v.edificios[t];
    if (!o || o === OBRA.campo) { delete v.edificios[t]; return; }
    if (o === OBRA.ruina) { if (rec) { rec.ruina = m.anio; rec.historia.push({ anio: m.anio, texto: 'quedó en ruinas' }); } return; }
    if (rec && rec.tipo === o && !rec.ruina) return;
    const c = S().civ(m, m.dueno[region(m, t)]), obreros = (v.obreros && v.obreros[t]) || [];
    const porQuien = obreros.map(id => v.aldeanos.find(a => a.id === id)).filter(Boolean);
    v.edificios[t] = { tipo: o, nombre: nombreEdificio(m, o, t, porQuien), anio: m.anio, turno: m.turno, era: c ? c.era : 0, civ: c ? c.id : -1, por: porQuien.slice(0, 4).map(a => a.nombre + ' ' + (a.familia || '')), historia: [{ anio: m.anio, texto: rec && rec.ruina ? 'reconstruido sobre las ruinas' : 'construido' }] };
    if (v.obreros) delete v.obreros[t];
    // Los edificios privados llevan el nombre de su dueño.
    nombrarPrivado(m, t, c);
  }
  function nombrarPrivado(m, t, c) {
    const v = m.vida, o = v.obra[t], pv = v.privados && v.privados[t], duenio = pv && v.aldeanos.find(x => x.id === pv.dueno);
    if (!duenio || !v.edificios[t]) return;
    // (El nombre va con el estilo del edificio: cambia cuando los constructores lo reforman, no de golpe con la era.)
    const era = v.edificios[t].era != null ? v.edificios[t].era : c ? c.era : 0, quien = duenio.nombre + ' ' + (duenio.familia || ''), fam = duenio.familia || duenio.nombre;
    const etM = etapa(OBRA.muelle, era);
    v.edificios[t].nombre = o === OBRA.gremio ? (etapa(OBRA.gremio, era) >= 1 ? 'Compañía ' + fam : 'Gremio de mercaderes ' + fam) + (pv.sucursal ? ' (sucursal)' : '') : o === OBRA.bancopriv ? 'Banco ' + fam : o === OBRA.muelle ? (etM >= 3 ? 'Terminal de los ' : etM >= 2 ? 'Dársena de los ' : 'Muelle de los ') + fam : o === OBRA.casona ? (era >= 6 ? 'Mansión' : era >= 5 ? 'Palacete' : 'Casona') + ' de ' + quien : INDUSTRIAS[pv.ind] ? (pv.ind === 'minera' ? 'Compañía minera ' : pv.ind === 'ferrocarril' ? 'Ferrocarriles ' : INDUSTRIAS[pv.ind].nombre + ' ') + fam : 'Fábrica de ' + quien;
    v.edificios[t].dueno = quien;
  }
  const SIN_REFORMA = new Set([OBRA.campamento, OBRA.centro, OBRA.campo, OBRA.ruina]);
  function apuntarObrero(m, t, a) { const v = m.vida; v.obreros = v.obreros || {}; const l = v.obreros[t] = v.obreros[t] || []; if (!l.includes(a.id)) l.push(a.id); }

  // La plaza de cada capital: 2×2 parcelas en el centro de su región. Las capitales perdidas quedan en ruinas.
  function centros(m) {
    const v = m.vida;
    for (const id of Object.keys(v.centros)) {
      const c = S().civ(m, +id), r = v.centros[id];
      if (c && c.viva && c.capital === r) continue;
      for (const t of plaza(m, r)) if (v.obra[t] === OBRA.centro) cambiar(m, 'obra', t, OBRA.ruina, 0);
      delete v.centros[id];
    }
    for (const c of S().vivas(m)) {
      if (c.madera == null) { c.madera = 6; c.piedra = 0; c.casas = 0; c.campos = 0; }
      if (c.metal == null) { c.metal = 0; c.oro = 0; }
      if (c.comida == null) c.comida = 30;
      if (v.centros[c.id] === c.capital) continue;
      // La corte que huye a otra ciudad se instala en lo que ya hay: no brota una plaza nueva ni un molino.
      if (c.mudada != null) {
        for (const t of plaza(m, c.capital)) if (!v.obra[t] && !v.camino[t]) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
        v.centros[c.id] = c.capital; c.mudada = null;
        continue;
      }
      for (const t of plaza(m, c.capital)) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.centro, 0); }
      v.centros[c.id] = c.capital;
      // Como en WorldBox, la aldea nace con su molino: alrededor de él se siembran los primeros campos.
      const zona = [c.capital, ...S().vecinos(c.capital).filter(r => m.dueno[r] === c.id)].flatMap(r => parcelas(m, r));
      if (!zona.some(t => v.obra[t] === OBRA.molino)) {
        const ter = terrenos(m), pl = plaza(m, c.capital);
        const t = zona.filter(x => !v.obra[x] && !pl.includes(x) && CONSTRUIBLE.has(ter[x]) && ter[x] !== 'arena').sort((p, q) => dist(m, p, pl[3]) - dist(m, q, pl[3]))[0];
        if (t != null) { cambiar(m, 'arbol', t, 0, 0); cambiar(m, 'roca', t, 0, 0); cambiar(m, 'obra', t, OBRA.molino, 0); }
      }
    }
  }
  function plaza(m, r) { const tw = m.W * SUB, x = (r % m.W) * SUB + 1, y = (r / m.W | 0) * SUB + 1; return [y * tw + x, y * tw + x + 1, (y + 1) * tw + x, (y + 1) * tw + x + 1]; }
