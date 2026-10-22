  // ── GÉNESIS · EL MANDO · El modo tropas y del texto a las acciones ──

  // ---------- El modo tropas: seleccionas soldados y los mandas a un sitio, como en Age of Empires ----------
  /*
   * Los soldados elegidos van al punto tocado (en formación) y se quedan allí: pelean solos con lo que se les
   * acerque y, si el punto es de un enemigo, van a por él (y el resto del ejército también apunta a esa plaza).
   * Si el punto es de un reino con el que hay paz, se le declara la guerra. «Liberar» los devuelve a lo automático.
   */
  function aplicarTropas(m, c, a) {
    const v = m.vida, p = plan(c);
    if (!v) return '';
    const ids = new Set(a.ids || []);
    const suyos = v.aldeanos.filter(x => ids.has(x.id) && x.c === c.id && x.o === 4);
    if (!suyos.length) return 'No hay soldados tuyos en la selección.';
    if (a.tipo === 'tropas_libres') {
      for (const x of suyos) if (x.fijo && x.fijo.rts) delete x.fijo;
      (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: '⚔ ' + suyos.length + ' soldados vuelven a lo automático' });
      return suyos.length + ' soldados vuelven a moverse solos con el ejército.';
    }
    const t = a.t; if (t == null || t < 0 || t >= v.tw * v.th) return 'Ese sitio está fuera del mapa.';
    const r = M.vida.region(m, t), d = S().civ(m, m.dueno[r]);
    let texto = '';
    if (d && d.id !== c.id) {
      if (!S().enGuerra(c, d)) { S().declararGuerra(m, c, d, 'Por orden de su gobierno, ' + c.nombre + ' manda sus tropas contra ' + d.nombre + '.'); p.guerrasMias = [...new Set([...(p.guerrasMias || []), d.id])]; texto = '¡Guerra contra ' + d.nombre + '! '; }
      // El resto del ejército también va a por esa plaza.
      p.objetivo = r; p.defender = null;
      if (v.ejercitos) delete v.ejercitos[c.id];
    }
    const ancho = Math.ceil(Math.sqrt(suyos.length));
    suyos.forEach((x, k) => { x.fijo = { rts: 1, g: 'rts', vuelve: 4, guardia: r, punto: t, dx: (k % ancho) - (ancho >> 1), dy: Math.floor(k / ancho) - (ancho >> 1) }; x.e = 0; });
    (v.anuncios = v.anuncios || []).push({ civ: c.id, region: r, texto: (d && d.id !== c.id ? '⚔ ¡Al ataque! ' : '🚩 ') + suyos.length + ' soldados ' + (d && d.id !== c.id ? 'contra ' + d.nombre : 'en marcha') });
    return texto + suyos.length + ' soldados van ' + (d && d.id !== c.id ? 'a atacar a ' + d.nombre : d && d.id === c.id ? 'a defender ese sitio' : 'a ese sitio') + '.';
  }

  // ---------- Del texto a las acciones ----------
  /*
   * ÓRDENES COMPUESTAS: «busquen hierro y saquen madera», «haced 3 casas y talad 10 árboles», «más comida,
   * menos soldados y construid un templo». Se parte la frase por las comas y las «y» que separan verbos, se
   * entiende cada trozo y se juntan las acciones (las prioridades se suman en una sola). Si un trozo suelto no
   * se entiende («quiero piedra y metal» → «metal»), se le pone delante el verbo del primero. Solo se usa el
   * resultado partido si dice más que la frase entera; si no, vale lo de siempre.
   */
  function entender(m, civId, texto) {
    // Las órdenes del modo tropas (las manda la vista al tocar el mapa): «#tropas 12,15,18 4096» o «#tropas-libres 12,15».
    const tr = String(texto || '').trim().match(/^#tropas(-libres)? ([\d,]+)(?: (\d+))?$/);
    if (tr) return [{ tipo: tr[1] ? 'tropas_libres' : 'tropas', ids: tr[2].split(',').map(Number).filter(n => n >= 0).slice(0, 400), t: tr[3] != null ? +tr[3] : null }];
    const entera = entenderUna(m, civId, texto);
    const trozos = String(texto || '').split(/\s*(?:[,;]|\by luego\b|\by despues\b|\by después\b|\by tambien\b|\by también\b|\bademas\b|\bademás\b|\by\b|\be\b(?=\s+[a-záéíóú]))\s*/i).map(x => x.trim()).filter(Boolean);
    if (trozos.length < 2) return entera;
    // Palabras sueltas que no son órdenes (nombres de reinos, «a Velmora y Karenia»): mejor no partir.
    const verbo = (trozos[0].match(/^\S+/) || [''])[0];
    const partes = [];
    for (const t of trozos) {
      let r = entenderUna(m, civId, t);
      const vacia = !r || !r.length || r.every(x => x.tipo === 'informe');
      if (vacia && t !== trozos[0]) r = entenderUna(m, civId, verbo + ' ' + t);
      if (!r || !r.length || r.every(x => x.tipo === 'informe')) return entera;
      if (r.some(x => ['milagro', 'normal'].includes(x.tipo))) return entera;
      partes.push(r);
    }
    // Se juntan: las prioridades en una; lo demás, cada acción una vez.
    const out = [], visto = new Set();
    let pr = null;
    for (const r of partes) for (const x of r) {
      if (x.tipo === 'prioridad') {
        if (!pr) { pr = { tipo: 'prioridad', cambios: {} }; out.push(pr); }
        Object.assign(pr.cambios, x.cambios);
        if (x.solo) pr.solo = true; if (x.hasta) pr.hasta = x.hasta;
        continue;
      }
      const k = JSON.stringify(x); if (visto.has(k)) continue; visto.add(k); out.push(x);
    }
    // ¿Dice más que la frase entera? (más acciones, o más prioridades tocadas).
    const peso = l => (l || []).reduce((s, x) => s + (x.tipo === 'prioridad' ? Object.keys(x.cambios).length : 1), 0);
    return peso(out) > peso(entera) ? out : entera;
  }
  function entenderUna(m, civId, texto) {
    const c = S().civ(m, civId), n = norm(texto), acciones = [];
    if (!c || !c.viva || !n) return acciones;
    // Aquí no hay milagros: eres quien manda en un pueblo, no un dios.
    if (/\b(peste|plaga|diluvio|terremoto|llueva|lluvia de|milagro|rayos?|meteorito|que mueran|maldic\w*|bendic\w*|que aparezca)\b/.test(n)) return [{ tipo: 'milagro' }];
    // «Levantad murallas», «poned una empalizada», «amurallad la ciudad»: la muralla alrededor de cada plaza.
    if (/\b(murallas?|empalizadas?|amurall\w*|muros?|cerca de troncos|estacada)\b/.test(n) && !/\b(fronteras?|raya)\b/.test(n))
      return [{ tipo: 'murallas', parar: /\b(dejad|deja|basta|no hagais|no construyais|parad|quitad)\b/.test(n) }];
    // «Fortificad la frontera», «poned torres en la frontera», «búnkeres en la raya»: torres a lo largo de la frontera.
    if (/\b(fronteras?|raya|limites?|lindes?)\b/.test(n) && /\b(defens\w*|defend\w*|fortific\w*|torres?|atalayas?|bunker\w*|fortin\w*|fuertes?|murallas?|muros?|proteg\w*|blind\w*|vigil\w*)\b/.test(n) && !/\b(patrull\w*|soldados|guerreros|escuadron\w*|aduanas?|puestos?)\b/.test(n))
      return [{ tipo: 'fortificar', parar: /\b(dejad|deja|basta|no hagais|no construyais|parad)\b/.test(n) }];
    // Comprar o encargar a las empresas del país: «comprad 10 de hierro a mis empresas», «encargad a la fundición 3 tanques».
    // (Antes que nada: «fundición» se tomaba por «fundar» una aldea y «empresas» por comprar a otro reino.)
    {
      const aEmp = /\b(mis|nuestras?|del pais|del reino|privadas?|nacionales?) (empresas?|fabricas?|industrias?|compan\w*|fundicion\w*|mineras?)\b/.test(n) || /\b(empresas?|industria privada|capitalistas?|fundicion\w*|compania minera|companias? mineras?|minera privada|aserradero|conservera)\b/.test(n);
      if (aEmp && /\b(compr\w*|encarg\w*|pedi\w*|pide\w*|haced|hacer|hagan|fabric\w*|produc\w*|quiero|queremos|necesit\w*|traed|dadme|que nos (vendan|den))\b/.test(n)) {
        const maq = /\btanques?\b/.test(n) ? 'tanque' : /\b(aviones?|avion|bombarderos?)\b/.test(n) ? 'avion' : /\bcanones?\b/.test(n) ? 'canon' : /\bartilleria\b/.test(n) ? 'artilleria' : null;
        const bien = /\b(hierro|metal\w*|acero)\b/.test(n) ? 'metal' : /\barmas?\b/.test(n) ? 'armas' : /\bmuebles?\b/.test(n) ? 'muebles' : /\b(comida|conservas?|alimentos?|latas?)\b/.test(n) ? 'comida' : /\bpiedras?\b/.test(n) ? 'piedra' : /\bcarbon\b/.test(n) ? 'carbon' : null;
        const mt = n.match(new RegExp('\\b' + NUM + '\\b'));
        if (maq || bien) return [{ tipo: 'empresas', que: maq || bien, maq: !!maq, n: mt ? Math.max(1, Math.round(numero(mt[1]) || 0)) : null }];
      }
    }
    if (/\b(como va|como van|que tal (va|van)|parte de guerra|como esta el frente|como vamos en)\b/.test(n) && /\b(guerras?|frente|batallas?|contienda)\b/.test(n)) return [{ tipo: 'consulta_guerra' }];
    // El ministro de economía: nombrarlo, su modo, despedirlo y su informe (antes que «equilibrado», que es otra orden).
    if (/\bministr\w*\b/.test(n) || /\beconomia\b/.test(n) || /\bmodo (crecimiento|guerra|ahorro|austeridad|equilibr\w*)\b/.test(n)) {
      const modo = /\bguerra\b/.test(n) ? 'guerra' : /\b(crecimiento|crecer|desarroll\w*|expansion)\b/.test(n) ? 'crecimiento' : /\b(ahorr\w*|austeridad|austera|recort\w*)\b/.test(n) ? 'ahorro' : /\b(equilibr\w*|normal|mixta)\b/.test(n) ? 'equilibrio' : null;
      if (/\b(despedi\w*|ces\w*|quit\w*|destitu\w*|echad|fuera)\b/.test(n) && /\bministr/.test(n)) return [{ tipo: 'ministro', que: 'despedir' }];
      if (/\b(como va|como van|que tal|informe|como anda|como esta)\b/.test(n) && !modo) return [{ tipo: 'ministro', que: 'consulta' }];
      if (modo) return [{ tipo: 'ministro', que: 'modo', modo }];
      if (/\bministr/.test(n)) return [{ tipo: 'ministro', que: 'nombrar' }];
    }
    if (/\b(informe|como vamos|como estamos|estado|situacion|que tal|resumen)\b/.test(n)) acciones.push({ tipo: 'informe' });
    if (/\b(como antes|lo de siempre|normal|equilibr\w*|a vuestro aire|libres?)\b/.test(n)) { acciones.push({ tipo: 'normal' }); return acciones; }

    const guerra = /\b(ataca\w*|atacar|invad\w*|conquist\w*|declar\w* la guerra|guerra (a|con|contra)|marcha\w* (sobre|contra)|asedi\w*|a por)\b/.test(n);
    const paz = /\b(paz|tregua|armisticio|acepto|aceptamos)\b/.test(n);
    const alianza = /\b(alianza|alia\w*|pacto de defensa)\b/.test(n) && !/\brompe\w*\b/.test(n);
    const romperAl = /\brompe\w* (la )?alianza\b/.test(n);
    // Cerrar el comercio con un reino: ni carretas, ni barcos, ni mercaderes, ni compras y ventas.
    const cerrarCom = /\b(cerr\w*|cort\w*|prohib\w*|suspend\w*|romp\w*|cancel\w*|bloque\w*) (el |la |las |los |todo el )?(comercio|rutas?( comercial\w*| de comercio)?|tratado( comercial| de comercio)?|tratos)\b|\b(dej\w*|par\w*) de comerciar\b|\bno comerci\w* (mas )?con\b|\bembargo\b/.test(n);
    const tratado = !alianza && !cerrarCom && /\b(comerci\w* con|amistad|tratado|embajad\w*|regal\w* a|rutas? (comercial\w* |de comercio )?(con|hasta|a|hacia)|carretera\w* (con|hasta|a|hacia)|camino\w* (hasta|hacia)|abr\w* (una )?ruta)\b/.test(n);
    // Preguntas: «¿cuántos leñadores tengo?», «¿cuánta madera hay?», «¿qué hace mi gente?».
    if (/\b(cuant[oa]s?|que hace mi gente|que hacen|en que trabaja\w*|reparto|oficios|cuadrillas|cupos)\b/.test(n) && !/\b(oro|dinero|tesoro|arcas|investig\w*|tecnolog\w*)\b/.test(n) && !/\b(quiero|pon\w*|mand\w*|que (se )?(vayan|pongan)|quit\w*|liber\w*|cancel\w*|anul\w*|solt\w*|suelt\w*)\b/.test(n) && !/\d/.test(n.replace(/\bcuant\w*/, ''))) { const of = NOMBRE_OF.find(([o, re]) => o >= 0 && new RegExp('\\b(' + re + ')\\b').test(n)); return [{ tipo: 'consulta', o: of ? of[0] : undefined }]; }
    // La técnica y el tesoro: «investigad la rueda», «¿qué investigamos?», «comprad 20 de madera», «guardad el oro».
    // (Lo del banco va antes: «sacad 10 del banco central al tesoro» no es una pregunta sobre el tesoro.)
    if (/\b(banco|banca|interes\w*|prestamos?|deudas?)\b/.test(n)) { const ex = extras(m, c, n); if (ex) return acciones.concat(ex); }
    { const ec = economia(m, c, n); if (ec) return acciones.concat(ec); }
    // Escuadrones, posturas de guerra, diplomacia menuda y el ánimo del pueblo.
    { const ex = extras(m, c, n); if (ex) return acciones.concat(ex); }
    // Órdenes con número, oficio y tiempo (cuadrillas, cupos, metas); si traen plazo, también sirve para las prioridades.
    let plazoGeneral = null, conCuadrilla = false;
    {
      const cq = cuadrilla(m, c, n);
      if (cq.length && cq[0].tipo !== 'plazo') { acciones.push(...cq); conCuadrilla = true; }
      else if (cq.length) plazoGeneral = cq[0];
    }
    // Dirigir la guerra: «atacad Velmora», «tomad la capital de Karenia», «defended la capital», «retirada».
    const plazas = [...(m.ciudades || []).map(x => ({ region: x.region, civ: x.civ, nombre: x.nombre })), ...S().vivas(m).map(o => ({ region: o.capital, civ: o.id, nombre: o.nombre, capital: true }))];
    const nombrada = plazas.filter(x => !x.capital && n.includes(norm(x.nombre)))[0];
    const defender = /\b(defend\w*|defensa de|proteg\w*|guarece\w*|resist\w*)\b/.test(n);
    const retirada = /\b(retir\w*|repleg\w*|volved a casa|vuelvan a casa|retroced\w*)\b/.test(n);
    const tomar = /\b(toma\w*|asalt\w*|captur\w*)\b/.test(n);
    if (retirada || (defender && !guerra)) {
      const propia = regionPropia(m, c, n);
      const mia = nombrada && nombrada.civ === c.id ? nombrada.region : propia != null ? propia : c.capital;
      acciones.push({ tipo: 'defender', region: mia });
      return acciones;
    }
    if ((guerra || tomar) && (nombrada && nombrada.civ !== c.id || /\bcapital\b/.test(n))) {
      let r = nombrada && nombrada.civ !== c.id ? nombrada.region : null;
      if (r == null) { const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null) || vecinoMasDebil(m, c); if (o) r = o.capital; }
      if (r != null) { acciones.push({ tipo: 'objetivo', region: r }); return acciones; }
    }
    if (guerra) { const o = (/\b(mas debil|mas pequeno|el vecino|vecinos?)\b/.test(n) && vecinoMasDebil(m, c)) || otro(m, c, n) || vecinoMasDebil(m, c); acciones.push({ tipo: 'guerra', con: o ? o.id : null }); }
    else if (paz) { const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null); acciones.push({ tipo: 'paz', con: o ? o.id : null }); }
    else if (romperAl) { const o = otro(m, c, n); acciones.push({ tipo: 'romper', con: o ? o.id : null }); }
    else if (cerrarCom) { const o = otro(m, c, n); acciones.push({ tipo: 'cerrar_comercio', con: o ? o.id : null }); }
    else if (alianza) { const o = otro(m, c, n); acciones.push({ tipo: 'alianza', con: o ? o.id : null }); }
    else if (tratado) { const o = otro(m, c, n); acciones.push({ tipo: 'comercio', con: o ? o.id : null }); }

    for (const [re, regimen, era] of REGIMENES) if (/\b(proclam\w*|revoluc\w*|instaur\w*|cambi\w* a|seamos|convert\w* en|hazte|haz\w* una?|coron\w*|queremos (ser )?una?|quiero (ser )?una?|que sea una?|establec\w*|implant\w*)\b/.test(n) && re.test(n)) { acciones.push({ tipo: 'regimen', a: regimen, era }); break; }

    const expandir = /\b(explor\w*|expand\w*|extiend\w*|coloniz\w*|ocupa\w*|nuevas tierras|ve hacia|id hacia|avanz\w* (hacia|al)|crec\w* hacia|hacia el)\b/.test(n);
    const quieto = /\b(no (os|te|nos) expand\w*|deja\w* de expandi\w*|quiet\w*|no crezc\w*|parad de crecer)\b/.test(n);
    if (quieto) acciones.push({ tipo: 'expandir', si: false });
    else if (expandir && !guerra) {
      const rumbo = /\bnorte\b/.test(n) ? 'norte' : /\bsur\b/.test(n) ? 'sur' : /\b(este|oriente)\b/.test(n) ? 'este' : /\b(oeste|poniente|occidente)\b/.test(n) ? 'oeste' : null;
      const o = rumbo ? null : otro(m, c, n);
      acciones.push({ tipo: 'expandir', si: true, rumbo: rumbo || (o ? o.id : null) });
    }

    // Prioridades: "más madera", "talad", "menos soldados", "todo a la ciencia", "nada de piedra".
    const cambios = {};
    const solo = /\b(solo|todo a|todos a|todo el mundo a|que todos)\b/.test(n);
    for (const [k, re] of Object.entries(RECURSOS)) {
      if (conCuadrilla && (k !== 'ciencia' || acciones.some(x => x.o === 6 || x.a === 6))) continue;
      if (k === 'ejercito' && (guerra || paz) && !/\breclut/.test(n)) continue;
      if (k === 'riqueza' && (tratado || cerrarCom)) continue;
      const mt = n.match(re);
      if (!mt) continue;
      const antes = n.slice(Math.max(0, mt.index - 16), mt.index);
      if (/\b(nada de|ningun\w*|cero|deja\w* de|dejen de|basta de|parad de|paren de|no mas)\b/.test(antes) || (/\bno\s*$/.test(antes) && /\bmas\b/.test(n.slice(mt.index)))) cambios[k] = { a: 0 };
      else if (/\b(menos|no|deja\w* de|sin|poca|poco)\b/.test(antes)) cambios[k] = { mas: -0.5 };
      else if (solo || /\b(maxim\w*|al maximo|toda la|todo lo que|prioridad absoluta|mucha|mucho)\b/.test(n)) cambios[k] = { a: 2 };
      else if (/\b(invert\w*|invier\w*|centra\w*|prioriz\w*|enfoca\w*|volca\w*|vuelca\w*|apuesta\w*)\b/.test(n)) cambios[k] = { a: 2 };
      else cambios[k] = { mas: 0.5 };
    }
    if (expandir && !guerra) cambios.expansion = { a: 1.5 };
    if (quieto) cambios.expansion = { a: 0 };
    // «carretera hasta X» es comercio, no obras en el pueblo.
    if (tratado && cambios.casas && !/\b(casas?|viviendas?|edific\w*)\b/.test(n)) delete cambios.casas;
    if (Object.keys(cambios).length) acciones.push({ tipo: 'prioridad', cambios, solo: solo || undefined, hasta: plazoGeneral ? plazoGeneral.hasta : undefined });
    const porMar = /\b(cruz\w* el mar|ultramar|colonia|barcos?|flota|navega\w*)\b/.test(n) && !/\bpuerto\b/.test(n);
    if (porMar) acciones.push({ tipo: 'colonia' });
    // Edificios concretos: "construid un templo", "levantad murallas", "haced un puerto".
    const levantar = /\b(constru\w*|levant\w*|haz|haced|hagan|hagamos|haga|pon\w*|edific\w*|quiero|queremos|necesit\w*|abr\w*|hace falta|falta)\b/.test(n);
    const publica = !levantar ? null : /\b(pozos? de petroleo|petroleo|crudo|torres? de perforacion|refineria\w*)\b/.test(n) ? 'petroleo' : /\b(minas?|galerias?|pozos? miner\w*|socavon\w*)\b/.test(n) && !/\b(mineros?)\b/.test(n) ? 'mina' : /\b(plaza publica|plaza mayor|plazas publicas|fuentes?|plaza con fuente)\b/.test(n) ? 'fuente' : /\b(pozos?|aljibes?|deposito de agua|agua potable)\b/.test(n) ? 'pozo' : /\b(graneros?|silos?|almacen\w*|despensa)\b/.test(n) ? 'granero' : /\b(parques?|jardin\w*|zonas? verdes?)\b/.test(n) ? 'parque' : /\b(palacios?|corte|sede del gobierno|casa del rey)\b/.test(n) ? 'palacio' : /\b(central\w*( electrica| de energia| termica)?|planta de energia|planta electrica|electricidad|luz electrica)\b/.test(n) && !/\bbancos? central\b/.test(n) ? 'central' : /\b(bancos?|banca)\b/.test(n) ? 'banco' : /\b(fabricas?|industria\w*|talleres)\b/.test(n) ? 'fabrica' : /\b(estacion\w*( de tren)?|ferrocarril\w*|trenes|tren|vias del tren)\b/.test(n) ? 'estacion' : /\b(hospital\w*|clinica\w*|sanatorio)\b/.test(n) ? 'hospital' : /\b(aerodromo\w*|aeropuerto\w*|base aerea|pista de aterrizaje)\b/.test(n) ? 'aerodromo' : null;
    const obra = publica || (/\b(casa del saber|academias?|monasterios?|abadias?|universidad\w*|laboratorios?|observatorios?|escuelas?|bibliotecas?|cabana del chaman|choza del chaman)\b/.test(n) ? 'saber' : /\b(cuartel\w*|barracon\w*|soldados nuevos)\b/.test(n) ? 'cuartel' : /\b(arqueria\w*|campo de tiro|arqueros nuevos)\b/.test(n) ? 'arqueria' : /\b(castillos?|fortalezas?|fortin\w*|bunker\w*)\b/.test(n) ? 'castillo' : /\b(templos?|iglesias?|santuarios?|altar)\b/.test(n) ? 'templo' : /\b(torres?|murallas?|muros?|defensas|fortific\w*|fuertes?)\b/.test(n) ? 'torre' : /\b(puertos?|muelles?)\b/.test(n) ? 'puerto' : /\bmolinos?\b/.test(n) ? 'molino' : null);
    if (obra && !guerra) {
      acciones.push({ tipo: 'construir', obra });
      const pr = acciones.find(x => x.tipo === 'prioridad');
      if (pr) { delete pr.cambios.casas; if (obra === 'torre') delete pr.cambios.ejercito; if (!Object.keys(pr.cambios).length) acciones.splice(acciones.indexOf(pr), 1); }
    }
    // Colonos por tierra: "mandad colonos al sur", "fundad una aldea nueva".
    if (!porMar && !guerra && /\b(colonos?|fund\w*|nuevas? (ciudad|aldea|pueblo)\w*|otra (ciudad|aldea)|asentamiento\w*)\b/.test(n)) {
      const rumbo = /\bnorte\b/.test(n) ? 'norte' : /\bsur\b/.test(n) ? 'sur' : /\b(este|oriente)\b/.test(n) ? 'este' : /\b(oeste|poniente|occidente)\b/.test(n) ? 'oeste' : /\b(costa|mar|playa)\b/.test(n) ? 'costa' : null;
      acciones.push({ tipo: 'colonos', rumbo });
      const ex = acciones.find(x => x.tipo === 'expandir'); if (ex) acciones.splice(acciones.indexOf(ex), 1);
    }
    // Más gente: hacen falta comida y camas.
    if (/\b(hijos|ninos|bebes|familias|natalidad|mas gente|que crezca|crezca la poblacion|mas poblacion)\b/.test(n)) {
      let pr = acciones.find(x => x.tipo === 'prioridad');
      if (!pr) acciones.push(pr = { tipo: 'prioridad', cambios: {} });
      pr.cambios.comida = pr.cambios.comida || { mas: 0.5 }; pr.cambios.casas = pr.cambios.casas || { mas: 0.5 };
    }
    return acciones;
  }
