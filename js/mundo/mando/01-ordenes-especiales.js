  // ── GÉNESIS · EL MANDO · Más órdenes: escuadrones, posturas de guerra, diplomacia y economía ──

  // ---------- Más órdenes: escuadrones, posturas de guerra, diplomacia menuda, el ánimo del pueblo ----------
  const sinTildes = n => n;
  // Una región propia que se nombra en la orden: una ciudad suya, «la capital», «la frontera».
  function regionPropia(m, c, n) {
    const ciudad = (m.ciudades || []).find(x => x.civ === c.id && n.includes(norm(x.nombre)));
    if (ciudad) return ciudad.region;
    if (/\bfrontera\b/.test(n)) {
      const enemigos = c.guerras.map(g => S().civ(m, g.con)).filter(Boolean), otros = enemigos.length ? enemigos : S().vecinosDe(m, c);
      const fr = otros.flatMap(o => S().frontera(m, o, c));
      if (fr.length) return fr.sort((x, y) => S().distancia(x, c.capital) - S().distancia(y, c.capital))[0];
    }
    if (/\b(capital|casa|corte|palacio|plaza)\b/.test(n)) return c.capital;
    return null;
  }
  function plazaEnemiga(m, c, n) {
    const ciudad = (m.ciudades || []).find(x => x.civ !== c.id && n.includes(norm(x.nombre)));
    if (ciudad) return ciudad.region;
    const o = otro(m, c, n) || (c.guerras[0] ? S().civ(m, c.guerras[0].con) : null);
    if (!o) return null;
    if (/\bcapital\b/.test(n)) return o.capital;
    // «su ciudad», «la ciudad enemiga»: la plaza suya más cercana a nosotros.
    const plazas = [o.capital, ...(m.ciudades || []).filter(x => x.civ === o.id).map(x => x.region)];
    return plazas.sort((x, y) => S().distancia(x, c.capital) - S().distancia(y, c.capital))[0];
  }
  function extras(m, c, n) {
    void sinTildes;
    // La cifra de gente: «10 soldados», «de 10», o una cifra en dígitos (no «un escuadrón»).
    const numero1 = (() => {
      const mt = n.match(new RegExp('\\b' + NUM + ' (?:soldad|guerrer|arquer|hombres|tanques|tropas|tirador|aldean|personas)')) || n.match(new RegExp('\\bde ' + NUM + '\\b(?! (?:segundos?|minutos?|turnos?|anos?))')) || n.match(/\b(\d+)\b(?! (?:segundos?|minutos?|min|turnos?|anos?|siglos?|horas?))/);
      return mt ? numero(mt[1]) : null;
    })();
    const o = otro(m, c, n);
    // Escuadrones: «formad un escuadrón de 10», «escuadrón de arqueros», «guardad la capital con 10 soldados»,
    // «10 soldados a defender Olota», «patrullad la frontera».
    const soldados = /\b(soldad\w*|guerrer\w*|arquer\w*|tropas?|hombres|tanques?)\b/;
    const escuadron = /\b(escuadr\w*|pelot\w*|patrull\w*|destacamento|batallon\w*|compania|guardia|grupo de (soldados|guerreros|arqueros)|centinelas?)\b/.test(n) ||
      (/\b(guard\w*|vigil\w*|proteg\w*|defend\w*|custodi\w*|atac\w*|ataq\w*|asalt\w*|tom(ad|en|ar)|sitia\w*|asedi\w*)\b/.test(n) && numero1 >= 1 && soldados.test(n));
    if (escuadron) {
      const arma = /\b(arquer\w*|tirador\w*|honder\w*|fusiler\w*|ballester\w*)\b/.test(n) ? 'arqueros' : /\btanques?\b/.test(n) ? 'tanques' : null;
      const ataca = /\b(ataq\w*|atac\w*|asalt\w*|tom\w*|asedi\w*|sitia\w*|saque[aoe]\w*)\b/.test(n) ? plazaEnemiga(m, c, n) : null;
      const region = ataca != null ? ataca : regionPropia(m, c, n) != null ? regionPropia(m, c, n) : (/\b(patrull\w*|vigil\w*|guard\w*)\b/.test(n) ? regionPropia(m, c, 'frontera') : null);
      return [{ tipo: 'escuadron', n: numero1 >= 1 ? Math.round(numero1) : arma === 'tanques' ? 3 : 8, arma, region, ataca: ataca != null || undefined }];
    }
    // «Entrenad arqueros», «más arqueros»: sin arquería se construye; con ella, un escuadrón de arqueros.
    if (/\b(entren\w*|form\w*|prepar\w*|mas|quiero|necesit\w*|reclut\w*)\b/.test(n) && /\b(arquer\w*|tirador\w*|ballester\w*)\b/.test(n)) {
      if (!(c.arquerias > 0)) return [{ tipo: 'construir', obra: 'arqueria' }];
      return [{ tipo: 'escuadron', n: numero1 >= 1 ? Math.round(numero1) : 6, arma: 'arqueros', region: null }];
    }
    // Reforestar: «plantad árboles», «reforestad el bosque»: los leñadores plantan con las semillas que haya.
    if (/\b(plant\w*|reforest\w*|repobl\w*|sembr\w* arboles|siembr\w* arboles)\b/.test(n) && /\b(arbol\w*|bosques?|pinos?|retonos?|semillas?|reforest\w*|repobl\w*)\b/.test(n)) return [{ tipo: 'reforestar' }];
    // Fabricar armas: «fabricad 20 fusiles», «forjad espadas», «producid armas de fuego»; y muebles en la fábrica.
    const verboFab = /\b(fabric\w*|forj\w*|produc\w*|manufactur\w*|hac\w*|hag\w*|elabor\w*)\b/.test(n) && !/\b(compr\w*|vend\w*|export\w*|import\w*)\b/.test(n);
    if (verboFab && /\b(armas?|armamento|fusiles?|rifles?|espingardas?|mosquetes?|arcabuces?|escopetas?|carabinas?|pistolas?|ametralladoras?|espadas?|lanzas?|hachas de guerra|municion\w*|balas)\b/.test(n) && !/\b(tanques?|blindados?|canon\w*|artilleri\w*|aviones?)\b/.test(n))
      return [{ tipo: 'fabricar', que: 'armas', n: numero1 >= 1 ? Math.round(numero1) : 20 }];
    if (verboFab && /\b(granadas?|bombas de mano)\b/.test(n)) return [{ tipo: 'fabricar', que: 'granadas', n: numero1 >= 1 ? Math.round(numero1) : 30 }];
    if (verboFab && /\b(muebles?|mobiliario|sillas|mesas|bienes|manufacturas?|productos)\b/.test(n)) return [{ tipo: 'fabricar', que: 'muebles', n: numero1 >= 1 ? Math.round(numero1) : 20 }];
    // «Fabricad 5 tanques», «haced 3 cañones»: el cuartel los hace para el almacén (se usan o se venden).
    if (verboFab && numero1 >= 1 && /\b(tanques?|blindados?|canon\w*|artilleri\w*|vehiculos?)\b/.test(n)) return [{ tipo: 'fabricar', que: 'vehiculos', n: Math.round(numero1) }];
    // Vehículos: «fabricad tanques», «haced cañones», «quiero aviones».
    const veh = /\b(tanques?|blindados?|carros de combate)\b/.test(n) ? 'tanque' : /\b(canon\w*|artilleri\w*|obuses|morteros?|bombardas?)\b/.test(n) ? 'artilleria' : /\b(aviones?|bombarder\w*|cazas|aviacion)\b/.test(n) ? 'aviones' : null;
    if (veh && /\b(fabric\w*|constru\w*|hac\w*|hag\w*|produc\w*|quiero|necesit\w*|mas|arm\w*|compr\w*|dame|dadme)\b/.test(n)) return [{ tipo: 'vehiculos', cual: veh }];
    // Posturas: esperar el ataque, emboscada, al ataque, alto.
    if (/\b(esper\w* (el |al |un |a |a que )?(ataque|enemigo|invasion|asalto|que ataquen|que vengan|que lleguen)|aguant\w*|a la defensiva|posicion defensiva|atrincher\w*|cavad trincheras|trincheras?)\b/.test(n))
      return [{ tipo: 'defender', region: regionPropia(m, c, n) != null ? regionPropia(m, c, n) : c.capital, postura: 'esperar' }];
    if (/\b(emboscad\w*|tend\w* una trampa|escond\w*)\b/.test(n)) { const r = regionPropia(m, c, n + ' frontera'); return [{ tipo: 'defender', region: r != null ? r : c.capital, postura: 'emboscada' }]; }
    if (/\b(al ataque|ataquen ya|atacad ya|avanz\w*|carg\w*|adelante|a la carga|ofensiva|a por ellos|contraatac\w*|a muerte|sin piedad)\b/.test(n) && !o && !(m.ciudades || []).some(x => n.includes(norm(x.nombre)))) return [{ tipo: 'atacar' }];
    if (/^(alto|parad|deteneos|quietos|alto el fuego|cese el fuego|parad la guerra|deteneos ya)$/.test(n)) return c.guerras.length ? [{ tipo: 'defender', region: c.capital, postura: 'alto' }] : [{ tipo: 'fiesta', descanso: true }];
    // Anexionar un reino entero: «anexionad X», «quedaos con todo X», «conquistad X entero».
    if (/\b(anex\w*|absorb\w*|incorpor\w*|someted\w*|quedaos con todo|quedarnos con todo|conquist\w* (todo|entero|entera|del todo)|todo (el reino|su reino)|que desaparezca)\b/.test(n) && !/\b(parad|dejad de|cancel\w*)\b/.test(n)) return [{ tipo: 'anexar', con: o ? o.id : (c.guerras[0] ? c.guerras[0].con : null) }];
    if (/\b(rendi\w*|rinda\w*|rendicion|capitul\w*|rindete|rendid|nos rendimos|bandera blanca)\b/.test(n)) return [{ tipo: 'rendicion', con: o ? o.id : (c.guerras[0] ? c.guerras[0].con : null) }];
    // Diplomacia menuda: espiar, insultar, regalar; y la guerra sucia: quemar sus campos, saquear.
    if (/\b(espi\w*|infiltr\w*|reconocimiento|averigu\w*|investig\w* (a|al|sobre))\b/.test(n) && (o || c.guerras.length)) return [{ tipo: 'espiar', con: o ? o.id : c.guerras[0].con }];
    if (/\b(insult\w*|provoc\w*|amenaz\w*|humill\w*|burl\w*|ofend\w*|desafi\w*)\b/.test(n) && o) return [{ tipo: 'insultar', con: o.id }];
    // La banca: el interés, prestar a otro reino, perdonarle la deuda, pedirle un préstamo y cómo va el banco.
    if (/\bbanco central\b/.test(n) && /\b(pas\w*|met\w*|deposit\w*|ingres\w*|sac\w*|retir\w*|mov\w*|llev\w*|dad|pon\w*|transfer\w*)\b/.test(n) && !/\b(prest\w*|credito)\b/.test(n)) {
      const cant = numero(((n.match(new RegExp('\\b' + NUM + '\\b')) || [])[1]) || '');
      return [{ tipo: 'banco_central', oro: cant || 30, al: /\b(sac\w*|retir\w*)\b|\bdel banco central\b|\bal tesoro\b/.test(n) ? 'tesoro' : 'banco' }];
    }
    if (/\b(interes\w*|tipos? de interes)\b/.test(n) && !o) return [{ tipo: 'interes', nivel: /\b(baj\w*|barat\w*|menos|reduc\w*)\b/.test(n) ? 0.5 : /\b(sub\w*|alt\w*|car\w*|mas)\b/.test(n) ? 1.5 : 1 }];
    if (/\bperdon\w* (la |su |sus )?deudas?\b|\bcondon\w*\b/.test(n) && o) return [{ tipo: 'perdonar', con: o.id }];
    if (/\b(pedi\w*|solicit\w*) (un |una )?(prestamo|credito)\b/.test(n) && o) return [{ tipo: 'pedir_prestamo', con: o.id }];
    if (/\b(prest\w*|credito|financi\w*|fia\w* oro)\b/.test(n) && o) return [{ tipo: 'prestar', con: o.id, oro: numero(((n.match(new RegExp('\\b' + NUM + '\\b')) || [])[1]) || '') || null }];
    if (/\b(banco|banca|prestamos?|deudas?|empresari\w*|capitalistas?|mercaderes)\b/.test(n) && /\b(como|que tal|cuanto|cuantos|estado|informe|va|van|tenemos|hay)\b/.test(n)) return [{ tipo: 'consulta_banca' }];
    if (/\b(regal\w*|obsequi\w*|tribut\w*|soborn\w*|don\w* (oro|riqueza)|envi\w* (oro|regalos?|presentes?)|pag\w* a)\b/.test(n) && o) return [{ tipo: 'regalo', con: o.id }];
    // El exterminio: «exterminad a la gente de X», «genocidio en X». Los soldados matan también a los civiles.
    if (/\b(extermin\w*|genocid\w*|aniquil\w*|limpieza etnica|pasad a cuchillo|matad a todos|matad a toda|que no quede nadie)\b/.test(n)) {
      if (/\b(parad|deten\w*|dejad de|basta|cancel\w*|perdon\w*|piedad|clemencia|suspend\w*)\b/.test(n)) return [{ tipo: 'exterminio', parar: true }];
      return [{ tipo: 'exterminio', con: o ? o.id : c.guerras.length ? c.guerras[0].con : null }];
    }
    if ((/\b(quem\w*|incendi\w*|arras\w*|sabote\w*|envenen\w*|destru\w* sus|talad sus|robad)\b/.test(n) && /\b(sus|enemig\w*|de \w+|su)\b/.test(n)) || /\bsabote\w* (a|al) \w+/.test(n)) return [{ tipo: 'sabotaje', con: o ? o.id : c.guerras.length ? c.guerras[0].con : null }];
    if (/\b(saque[aoe]\w*|pillad\w*|asedi\w*|sitia\w*|asalt\w*)\b/.test(n)) { const r = plazaEnemiga(m, c, n); return r != null ? [{ tipo: 'objetivo', region: r }] : [{ tipo: 'atacar' }]; }
    // Cazar lobos: unos cuantos salen armados a por ellos (3 turnos).
    if (/\b(caz\w*|mat\w*|ahuyent\w*) (a )?(los )?lobos?\b/.test(n)) return [{ tipo: 'cuadrilla', n: numero1 >= 1 ? Math.round(numero1) : 4, de: -1, a: 4, hasta: { turnos: 3 } }];
    // Reparar: las ruinas propias vuelven a ser casas (y se apaga lo que arda).
    if (/\b(repar\w*|reconstru\w*|restaur\w*|apag\w*|extingu\w*|arregl\w* las casas|levant\w* las ruinas)\b/.test(n)) return [{ tipo: 'reparar' }];
    // El pueblo: impuestos, fiestas, rezar, curar, trabajar todos.
    if (/\bimpuestos?|tributos?|diezmo\b/.test(n) && !o) return [{ tipo: 'impuestos', sube: !/\b(baj\w*|quit\w*|elimin\w*|reduc\w*|perdon\w*|menos)\b/.test(n) }];
    // «Trabajad sin descanso» es lo contrario de descansar: todos al trabajo (antes se leía «descanso» y les daba el día libre).
    if (/\b(sin descanso|sin parar|sin tregua|a destajo|horas extra|trabajad mas|trabajad duro|a trabajar|al trabajo|manos a la obra|volved al trabajo)\b/.test(n)) return [{ tipo: 'trabajar' }];
    if (/\b(fiesta\w*|festej\w*|celebr\w*|banquete\w*|feria|carnaval|descans\w*|vacaciones|dia libre|que nadie trabaje|tomaos un respiro)\b/.test(n)) return [{ tipo: 'fiesta', descanso: /\b(descans\w*|vacaciones|dia libre|nadie trabaje|respiro)\b/.test(n) || undefined }];
    // Las huelgas obreras: ceder (subir salarios, negociar) o reprimir.
    if (/\b(huelg\w*|obreros|sindicat\w*|salarios?|sueldos? de los obreros|jornales?)\b/.test(n)) {
      if (/\b(reprim\w*|aplast\w*|disolv\w*|disuelv\w*|cargad|policia|porras|ejercito contra|soldados contra|esquiroles|despedid)\b/.test(n)) return [{ tipo: 'huelga', ceder: false }];
      if (/\b(baj\w*|recort\w*|reduc\w*|rebaj\w*|menos sueldo|pagad menos)\b/.test(n)) return [{ tipo: 'salario', sube: false }];
      if (/\b(sub\w*|aument\w*|pag\w*|negoci\w*|acuerdo|ced\w*|dad\w* lo que piden|mejor\w*|escuch\w*)\b/.test(n)) return [{ tipo: 'huelga', ceder: true }];
    }
    if (/\b(rez\w*|orad|oren|plegarias?|misa|ofrendas?|sacrifici\w*|culto|procesion\w*|oracion\w*)\b/.test(n)) return [{ tipo: 'rezar' }];
    if (/\b(cur\w*|san(ad|en) a|heridos|medic\w*|hospital\w*|curanderos?)\b/.test(n)) return [{ tipo: 'curar' }];
    if (/\b(que trabajen todos|todos a trabajar|a trabajar|manos a la obra|nadie ocioso|no os quedeis quietos|a currar|espabil\w*)\b/.test(n)) return [{ tipo: 'trabajar' }];
    // «Quiero un ejército de 30».
    const ej = n.match(new RegExp('\\bejercito de ' + NUM));
    if (ej && numero(ej[1]) >= 1) return [{ tipo: 'cupo', o: 4, n: Math.round(numero(ej[1])) }];
    return null;
  }
  function economia(m, c, n) {
    // Subir de edad: «avanzad de edad», «pasad a la Edad del Hierro», «¿qué nos falta para la próxima edad?».
    const edad = /\b(edad|era|epoca)\b/.test(n);
    if (edad && /\b(que (nos )?falta|que necesit\w*|requisitos|cuando (llega|podemos)|como (llegamos|pasamos))\b/.test(n)) return [{ tipo: 'consulta_edad' }];
    if (edad && /\b(solos?|automatic\w*|cuando pueda\w*|por su cuenta)\b/.test(n) && /\b(avan[zc]\w*|sub\w*|pas\w*)\b/.test(n)) return [{ tipo: 'edad_auto', si: !/\b(no|nunca|dejad de)\b/.test(n) }];
    if (edad && /\b(ahorr\w*|guard\w*|junt\w*)\b/.test(n)) return [{ tipo: 'ahorrar_edad', si: !/\b(no|dejad de)\b/.test(n) }];
    if (edad && /\b(avanz\w*|sub\w*|pas\w*|pag\w*|compr\w*|entr\w*|lleg\w*|adelant\w*|cambi\w*|ir a|vamos a)\b/.test(n)) return [{ tipo: 'edad' }];
    // Una tecnología por su nombre (o por lo que da): «investigad la rueda», «quiero la imprenta», «estudiad el hierro».
    const quiereTec = /\b(investig\w*|estudi\w*|descubr\w*|invent\w*|desarroll\w*|aprend\w*|quiero|queremos|centr\w* en|prioriz\w*)\b/.test(n);
    const tec = M.TECNOLOGIAS.find(t => n.includes(norm(t.nombre))) || M.TECNOLOGIAS.find(t => n.includes(norm(t.invento).replace(/^(el|la|los|las) /, ''))) || M.TECNOLOGIAS.find(t => new RegExp('\\b' + t.id.replace('_', ' ') + '\\b').test(n));
    if (tec && quiereTec) return [{ tipo: 'investigar', id: tec.id }];
    if (/\b(que investig\w*|que (podemos )?investigar|que estudi\w*|tecnolog\w*|tecnica|arbol)\b/.test(n) && /\b(que|cual|cuales|lista|ver|como va|como van)\b/.test(n)) return [{ tipo: 'consulta_tec' }];
    // El tesoro.
    const cosa = n.match(/\b(madera|lena|comida|trigo|grano|alimentos?|piedras?|metal|hierro|armas?|espadas|lanzas|fusiles|armamento|carbon|hulla|petroleo|crudo|gasolina|combustible|muebles?|mobiliario|tanques?|blindados?|vehiculos?|canones|canon|obuses|artilleria|granadas?|semillas?|retonos?|plantones?)\b/);
    const BIEN = { semilla: 'semillas', retono: 'semillas', retonos: 'semillas', planton: 'semillas', plantones: 'semillas', mueble: 'muebles', mobiliario: 'muebles', tanque: 'vehiculos', tanques: 'vehiculos', blindado: 'vehiculos', blindados: 'vehiculos', vehiculo: 'vehiculos', canones: 'vehiculos', canon: 'vehiculos', obuses: 'vehiculos', artilleria: 'vehiculos', granada: 'granadas', hulla: 'carbon', crudo: 'petroleo', gasolina: 'petroleo', combustible: 'carbon', lena: 'madera', trigo: 'comida', grano: 'comida', alimento: 'comida', alimentos: 'comida', piedras: 'piedra', hierro: 'metal', arma: 'armas', espadas: 'armas', lanzas: 'armas', fusiles: 'armas', armamento: 'armas' };
    // Las ofertas de los mercaderes: «acepto el trato», «rechazad la oferta».
    if (/\b(trato|oferta|propuesta del mercader)\b/.test(n) && /\b(acept\w*|cerr\w*|hecho|vale|de acuerdo|si|rechaz\w*|no|nada)\b/.test(n) && !/\bpaz\b/.test(n)) return [{ tipo: 'oferta', si: !/\b(rechaz\w*|no|nada)\b/.test(n) }];
    // El mercado: «¿cómo está el mercado?», «precios», «especializaos en madera», «producid armas para vender».
    if (/\b(mercado|precios?|cuanto (vale|valen|cuesta|cuestan))\b/.test(n) && !/\b(compr\w*|vend\w*)\b/.test(n)) return [{ tipo: 'consulta_mercado' }];
    if (/\b(especializ\w*|dedica\w* a|dedicaos|vivid de|nuestro negocio)\b/.test(n) || (/\bpara vender\b/.test(n) && cosa)) {
      if (!cosa && /\b(no|dejad de|quita\w*|como querais|lo que querais)\b/.test(n)) return [{ tipo: 'especialidad', que: null }];
      if (cosa) return [{ tipo: 'especialidad', que: BIEN[cosa[1]] || cosa[1] }];
    }
    // Comercio libre o solo a petición: «comerciad libremente», «comerciad solo lo que yo diga».
    if (/\b(comerci\w*|negoci\w*|tratos?)\b/.test(n) && /\b(libre\w*|solos?|por vuestra cuenta|por su cuenta|lo que querais|automatic\w*)\b/.test(n) && !cosa) return [{ tipo: 'comercio_libre', si: !/\b(no|nunca|dejad de|solo (lo que|cuando) (yo )?(diga|mande|pida))\b/.test(n) }];
    if (/\b(comerci\w*)\b/.test(n) && /\bsolo (lo que|cuando) (yo )?(diga|mande|pida)\b/.test(n)) return [{ tipo: 'comercio_libre', si: false }];
    if (/\b(compr\w*|adquir\w*|import\w*)\b/.test(n) && cosa) { const mt = n.match(new RegExp('\\b' + NUM + '\\b')); return [{ tipo: 'comprar', que: BIEN[cosa[1]] || cosa[1], n: mt ? Math.round(numero(mt[1]) || 0) : null }]; }
    if (/\b(vend\w*|export\w*)\b/.test(n) && cosa) { const mt = n.match(new RegExp('\\b' + NUM + '\\b')); return [{ tipo: 'vender', que: BIEN[cosa[1]] || cosa[1], n: mt ? Math.round(numero(mt[1]) || 0) : null }]; }
    if (/\b(guard\w*|ahorr\w*|no gast\w*|reserv\w*) (el |todo el |nuestro )?(oro|dinero|tesoro)\b/.test(n)) return [{ tipo: 'tesoro', guardar: true }];
    if (/\b(invert\w*|gast\w*|usad|usa|financ\w*|pag\w*) (el |todo el )?(oro|dinero|tesoro)\b/.test(n) || /\b(mecenazgo|becas|pagad a los sabios)\b/.test(n)) return [{ tipo: 'tesoro', guardar: false }];
    if (/\b(cuanto oro|cuanto dinero|tesoro|arcas|presupuesto|cuentas|ingresos|gastos)\b/.test(n) && !/\b(sub\w*|baj\w*)\b/.test(n)) return [{ tipo: 'consulta_oro' }];
    return null;
  }
  const PRECIO = { madera: 0.6, comida: 0.5, piedra: 0.9, metal: 2.5, armas: 6, carbon: 1.4, petroleo: 3.2, muebles: 2.4, vehiculos: 30, semillas: 0.35, granadas: 1.6 };
  // Con quién comercia de verdad un pueblo: los del otro lado de sus rutas entre reinos.
  // (rutas por tierra, tratados, puertos en el mismo mar y tratos recientes: vida.js › sociosDe)
  const sociosDe = (m, c) => (M.vida && m.vida ? M.vida.sociosDe(m, c) : []);
  function aplicarEconomia(m, c, a, textos) {
    const p = plan(c), v = m.vida, an = t => v && (v.anuncios = v.anuncios || []).push({ civ: c.id, texto: t });
    const mk = m.mercado, pausa = M.vida && M.vida.pausada(m);
    if (a.tipo === 'comercio_libre') {
      p.comercioLibre = !!a.si;
      textos.push(a.si ? 'Vuestros comerciantes comercian solos con vuestros socios: venden lo que sobra y compran lo que falta, según convenga. (Con quién, lo decidís vosotros: «abrid una ruta comercial con X».)' : 'Vuestros comerciantes solo compran y venden lo que mandéis («comprad 20 de hierro», «vended madera»). Para que vuelvan a comerciar solos: «comerciad libremente».');
      return;
    }
    if (a.tipo === 'oferta') { const r = M.vida.aceptarOferta(m, c, a.si); textos.push(r.ok ? r.texto : 'Ya no hay ofertas que aceptar: con vuestros socios, los comerciantes compran y venden solos según convenga.'); if (r.ok && a.si) an('🤝 Trato cerrado'); return; }
    if (a.tipo === 'consulta_mercado') {
      if (!mk) { textos.push('Aún no hay mercado entre los reinos.'); return; }
      const fl = k => { const h = mk.historia[k] || []; const d = h.length > 6 ? h[h.length - 1] - h[h.length - 7] : 0; return d > 0.02 ? ' ▲' : d < -0.02 ? ' ▼' : ''; };
      const socios = sociosDe(m, c);
      textos.push('Precios del mundo: ' + M.vida.bienesDe(c).map(k => M.vida.NOMBRE_BIEN[k] + ' ' + (mk.precio[k] || M.vida.PRECIO_BASE[k]).toFixed(2) + fl(k)).join(' · ') + '. ' + (socios.length ? 'Comerciáis con ' + socios.map(o => o.nombre + (o.balance ? ' (le falta ' + (M.vida.BIENES.filter(k => o.balance.urg[k] > 0.3).join(', ') || 'poco') + ')' : '')).join(', ') + '.' : 'No comerciáis con nadie: sin una ruta con otro reino, todo lo tenéis que producir vosotros («comerciad con X»).') + (c.especialidad ? ' Vuestra especialidad: ' + c.especialidad + '.' : ''));
      return;
    }
    if (a.tipo === 'especialidad') {
      p.especialidad = a.que || null;
      if (a.que) c.especialidad = a.que;
      textos.push(a.que ? 'Tu pueblo se dedicará sobre todo a ' + (a.que === 'armas' ? 'forjar armas (hace falta cuartel y metal)' : a.que === 'muebles' ? 'fabricar muebles (hace falta fábrica y madera)' : a.que === 'vehiculos' ? 'fabricar vehículos de guerra (hace falta cuartel y metal)' : a.que === 'comida' ? 'cultivar y criar ganado' : a.que === 'madera' ? 'talar' : 'sacar ' + NB(a.que)) + ', y lo que sobre lo venderán vuestros comerciantes a quien lo necesite.' + (sociosDe(m, c).length ? '' : ' Ojo: sin rutas con otros reinos no tendréis a quién venderlo.') : 'Tu pueblo vuelve a elegir solo a qué dedicarse, según su tierra y los precios.');
      return;
    }
    if ((a.tipo === 'comprar' || a.tipo === 'vender') && pausa) {
      // Solo se compra y se vende con un reino con el que se comercia: el pedido lo trae (o lo lleva) la carreta.
      if (!PRECIO[a.que]) { textos.push('Eso no se compra ni se vende.'); return; }
      const socios = sociosDe(m, c), precio = mk ? mk.precio[a.que] : PRECIO[a.que];
      if (!socios.length) {
        // (Sin socios, si lo hace una empresa del país, se le compra a ella.)
        const IND = { metal: ['minera'], piedra: ['minera'], carbon: ['minera'], armas: ['fundicion'], muebles: ['aserradero'], comida: ['conservera'] }[a.que];
        if (a.tipo === 'comprar' && IND && M.vida.empresariosDe(m, c).some(x => x.emp.neg === 'fabrica' && IND.includes(x.emp.ind))) return aplicarExtra(m, c, { tipo: 'empresas', que: a.que, maq: false, n: a.n }, textos);
        textos.push('No comerciáis con ningún reino: no hay a quién ' + (a.tipo === 'comprar' ? 'comprar' : 'vender') + '. Abrid una («abrid una ruta comercial con X») o producidlo vosotros.'); return;
      }
      // (La comida se vende de lo que sobra: lo que come la gente no sale en la carreta, salvo que se diga cuánto.)
      const guarda = a.tipo === 'vender' && a.que === 'comida' && !a.n ? (c.aldeanos || 0) * 2 : 0;
      const nq = a.n || (a.tipo === 'comprar' ? Math.max(5, Math.floor((c.oro || 0) * 0.5 / precio)) : Math.floor(Math.max(0, (c[a.que] || 0) - guarda) * 0.5));
      if (nq <= 0) { textos.push(a.tipo === 'comprar' ? 'No hay oro para comprar ' + NB(a.que) + '.' : guarda && (c.comida || 0) > 0 ? 'No sobra comida que vender: la que hay (' + Math.floor(c.comida) + ') hace falta para la gente.' : 'No tenéis ' + NB(a.que) + ' que vender.'); return; }
      const lista = a.tipo === 'comprar' ? (p.pedidos = p.pedidos || []) : (p.ventas = p.ventas || []);
      lista.push({ que: a.que, n: nq, desde: m.turno });
      const tienen = socios.filter(o => o.balance && (a.tipo === 'comprar' ? M.vida.vendible(m, o, c, a.que) >= 1 : o.balance.falta[a.que] >= 1));
      an((a.tipo === 'comprar' ? '📦 Pedido: ' : '🏷 A la venta: ') + nq + ' ' + NB(a.que));
      // Quién lo tiene y cómo llega: en carreta (si hay carretera) o en barco (si hay puertos en el mismo mar).
      const via = o => ((m.vida.rutas || []).some(r => r.tipo === 'externa' && [r.a, r.b].includes(c.id) && [r.a, r.b].includes(o.id)) ? 'en carreta' : M.vida.porMar(m, c, o) ? 'en barco' : 'cuando haya camino o puertos en el mismo mar');
      const quien = tienen.map(o => o.nombre + ' (' + Math.floor(M.vida.vendible(m, o, c, a.que)) + ', ' + via(o) + ')').join(', ');
      const fuera = a.tipo === 'comprar' ? S().vivas(m).filter(o => o !== c && !socios.includes(o) && !S().enGuerra(c, o) && M.vida.vendible(m, o, c, a.que) >= 3).sort((x, y) => M.vida.vendible(m, y, c, a.que) - M.vida.vendible(m, x, c, a.que)).slice(0, 2) : [];
      const consejo = fuera.length ? ' ' + fuera.map(o => o.nombre + ' tiene ' + Math.floor(M.vida.vendible(m, o, c, a.que))).join(' y ') + ': si queréis, «abrid una ruta comercial con ' + fuera[0].nombre + '».' : '';
      textos.push(a.tipo === 'comprar' ? 'Encargáis ' + nq + ' de ' + NB(a.que) + ' a unas ' + precio.toFixed(2) + ' de oro cada una (' + Math.round(nq * precio) + ' en total, más si corre prisa). ' + (tienen.length ? 'Os lo pueden vender ' + quien + ' (si es de su reserva, algo más caro): vuestros comerciantes irán primero a por ello.' : 'Ahora ninguno de vuestros socios tiene para venderos; en cuanto tengan, llegará. Mientras, quizá convenga producirlo.') + consejo : 'Ponéis a la venta ' + nq + ' de ' + NB(a.que) + ' (unas ' + precio.toFixed(2) + ' de oro cada una). ' + (tienen.length ? 'A ' + tienen.map(o => o.nombre).join(' y ') + ' le hace falta: la carreta saldrá cargada.' : 'Ahora ningún socio lo necesita; se venderá cuando lo pidan.'));
      return;
    }
    if (a.tipo === 'edad' || a.tipo === 'consulta_edad') {
      const sig = M.ERAS[c.era + 1];
      if (!sig) { textos.push('Ya estáis en la última edad.'); return; }
      if (c.subiendo) { const d = c.subiendo.debe; textos.push('Ya estáis pasando a ' + sig.con + ': faltan ' + Math.max(0, c.subiendo.hasta - m.turno) + ' turnos' + (d ? ' y por pagar ' + Object.keys(d).map(k => Math.ceil(d[k]) + ' de ' + k).join(', ') + ' (se paga poco a poco; si falta, el paso espera)' : '') + '.'); return; }
      const r = S().puedeSubir(m, c), req = M.EDADES[c.era + 1];
      const precio = req ? ['comida', 'madera', 'piedra', 'oro', 'metal'].filter(k => req[k]).map(k => req[k] + ' de ' + k).join(', ') : '';
      if (a.tipo === 'edad' && r.ok) {
        S().empezarSubida(m, c);
        an('⏫ Hacia ' + sig.nombre);
        const d = c.subiendo.debe;
        textos.push(d ? '¡Adelante! Empieza el paso a ' + sig.con + ' (' + (c.subiendo.hasta - m.turno) + ' turnos). No teníais todo (' + precio + '): pagáis ahora la cuarta parte y el resto (' + Object.keys(d).map(k => Math.ceil(d[k]) + ' de ' + k).join(', ') + ') poco a poco mientras dura; si falta, el paso espera. Cuando termine, llegan sus armas, edificios y técnicas.' : '¡Adelante! Pagáis ' + precio + ' de golpe y empieza el paso a ' + sig.con + ' (' + (c.subiendo.hasta - m.turno) + ' turnos). Cuando termine, llegan sus armas, edificios y técnicas.');
        return;
      }
      textos.push((a.tipo === 'edad' ? 'Aún no podéis pasar a ' + sig.con + '. ' : 'Para pasar a ' + sig.con + ' hace falta: saber ' + sig.umbral + (sig.desde != null && !m.libre ? ', llegar al año ' + S().anioTexto(sig.desde).replace(/(\d)\.$/, '$1') : '') + (req ? ', ' + req.texto + ' y pagar ' + precio : '') + '. ') + (r.falta.length ? 'Os falta: ' + r.falta.join(', ') + '.' : '¡Lo tenéis todo! Decid «avanzad de edad».') + (r.falta.some(x => /saber/.test(x)) ? ' El saber lo traen tus ' + M.ERUDITO(c.era).varios + ': «más ' + M.ERUDITO(c.era).varios + '».' : ''));
      return;
    }
    if (a.tipo === 'edad_auto') { p.autoEdad = !!a.si; textos.push(a.si ? 'Tu gobierno pasará de edad solo en cuanto se pueda.' : 'Pasar de edad volverá a ser decisión tuya («avanzad de edad»).'); return; }
    if (a.tipo === 'ahorrar_edad') { p.ahorrarEdad = !!a.si; textos.push(a.si ? 'Se ahorra para la próxima edad: cuando tengáis el saber, no se gastará oro en mejoras ni edificios que no pida la edad.' : 'Se deja de ahorrar: el oro vuelve a gastarse en mejoras y edificios.'); return; }
    if (a.tipo === 'investigar') {
      const t = M.TECNOLOGIAS.find(x => x.id === a.id);
      if (!t) { textos.push('No conozco esa tecnología.'); return; }
      const ts = M.tecsDe(c);
      if (ts.includes(t.id)) { textos.push('Ya domináis ' + t.nombre.toLowerCase() + '.'); return; }
      if (t.era > c.era) { const faltan = M.TECNOLOGIAS.filter(x => x.era <= c.era && !ts.includes(x.id)); textos.push(t.nombre + ' es ' + ('de ' + M.ERAS[t.era].con).replace(/^de el /, 'del ') + '. Antes hay que dominar lo de ahora' + (faltan.length ? ': ' + faltan.map(x => x.nombre.toLowerCase()).join(', ') : '') + (m.libre || !M.ERAS[c.era + 1] || M.ERAS[c.era + 1].desde == null ? '' : ', y la nueva era no llega antes de ' + S().anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) + '.'); return; }
      const falta = S().faltaPara(m, c, t), inv = c.investigacion = c.investigacion || { id: null, puntos: 0 };
      if (falta.length && inv.id !== t.id) { p.investigar = t.id; const precio = Object.keys(t.precio || {}).map(k => t.precio[k] + ' de ' + k).join(', '), ORDEN_LUGAR = { saber: 'construid una casa del saber', molino: 'construid un molino', templo: 'construid un templo', cuartel: 'construid un cuartel', puerto: 'construid un puerto' };
        textos.push(t.nombre + ' se investiga en ' + (M.LUGARES[t.lugar] || 'la plaza') + (precio ? ' y cuesta ' + precio + ' (se paga poco a poco)' : '') + '. Os falta ' + falta.join(', ') + (ORDEN_LUGAR[t.lugar] ? ': «' + ORDEN_LUGAR[t.lugar] + '»' : '') + '. Queda apuntada: empezará en cuanto se pueda.'); return; }
      p.investigar = t.id;
      // Lo que llevaba la investigación anterior no se pierde del todo: la mitad pasa a la nueva.
      // No hace falta tener todo el precio: se va pagando poco a poco mientras se investiga (y lo pagado no se pierde).
      if (inv.id !== t.id) { if (inv.id) (c.puntosTec = c.puntosTec || {})[inv.id] = inv.puntos; inv.puntos = (c.puntosTec || {})[t.id] || 0; inv.id = t.id; inv.esperaPago = 0; }
      const debe = S().porPagar(c, t), debeTxt = Object.keys(debe).map(k => debe[k] + ' de ' + k).join(', ');
      an('🔬 Investigando: ' + t.nombre);
      textos.push('Tus ' + M.ERUDITO(c.era).varios + ' se ponen con ' + t.nombre.toLowerCase() + ' en ' + (M.LUGARES[t.lugar] || 'la plaza') + ' (' + t.texto + (debeTxt ? '; se paga poco a poco mientras avanza: ' + debeTxt : '') + '). Cuesta ' + M.costeTec(t) + ' de ciencia; con lo de ahora, unos ' + Math.max(1, Math.ceil((M.costeTec(t) - inv.puntos) / Math.max(0.01, (c.tecTurno || c.cienciaTurno || 1)))) + ' turnos. La investigan tus ' + M.ERUDITO(c.era).varios + ' (' + ((m.vida && m.vida.aldeanos.filter(x => x.c === c.id && x.o === 6).length) || 0) + '): cuantos más, antes; pon más con «quiero 4 ' + M.ERUDITO(c.era).varios + '».');
      return;
    }
    if (a.tipo === 'consulta_tec') {
      const ts = M.tecsDe(c), inv = c.investigacion && c.investigacion.id ? M.TECNOLOGIAS.find(t => t.id === c.investigacion.id) : null;
      const libres = M.TECNOLOGIAS.filter(t => t.era <= c.era && !ts.includes(t.id));
      textos.push((inv ? 'Investigáis ' + inv.nombre.toLowerCase() + ' (' + Math.round(100 * c.investigacion.puntos / M.costeTec(inv)) + ' %). ' : '') + (libres.length ? 'Podéis investigar: ' + libres.map(t => t.nombre + ' (' + t.texto + ')').join('; ') + '. Para elegir, di «investigad ' + libres[0].nombre.toLowerCase() + '».' : 'Domináis todo lo de ' + M.ERAS[c.era].con + (M.ERAS[c.era + 1] ? '; la próxima era llegará ' + (m.libre || M.ERAS[c.era + 1].desde == null ? 'enseguida' : 'en ' + S().anioTexto(M.ERAS[c.era + 1].desde).replace(/(\d)\.$/, '$1')) : '') + '.') + ' Dominadas: ' + ts.length + ' de ' + M.TECNOLOGIAS.length + '.');
      return;
    }
    if (a.tipo === 'comprar' || a.tipo === 'vender') {
      const precio = PRECIO[a.que];
      if (!precio) { textos.push('Eso no se compra ni se vende.'); return; }
      if (a.tipo === 'comprar') {
        const max = Math.floor((c.oro || 0) / precio), n = Math.min(a.n || Math.floor(max * 0.5), max);
        if (n <= 0) { textos.push('No hay oro para comprar ' + NB(a.que) + ' (cada unidad cuesta ' + precio + ').'); return; }
        c.oro -= n * precio; c[a.que] = (c[a.que] || 0) + n;
        an('🪙 −' + Math.round(n * precio) + ' · +' + n + ' ' + NB(a.que));
        textos.push('Los mercaderes traen ' + n + ' de ' + NB(a.que) + ' por ' + Math.round(n * precio) + ' de oro. Quedan ' + Math.round(c.oro) + '.');
      } else {
        const tiene = Math.floor(c[a.que] || 0), n = Math.min(a.n || Math.floor(tiene * 0.5), tiene);
        if (n <= 0) { textos.push('No tenéis ' + NB(a.que) + ' que vender.'); return; }
        const gana = Math.round(n * precio * 0.6);
        c[a.que] -= n; c.oro = (c.oro || 0) + gana;
        an('🪙 +' + gana + ' · −' + n + ' ' + a.que);
        textos.push('Vendéis ' + n + ' de ' + a.que + ' por ' + gana + ' de oro (los mercaderes compran barato). Tesoro: ' + Math.round(c.oro) + '.');
      }
      return;
    }
    if (a.tipo === 'tesoro') {
      p.guardarOro = !!a.guardar;
      textos.push(a.guardar ? 'El tesoro se guarda: el oro que sobre ya no irá a pagar sabios y escuelas.' : 'El oro que sobre de la reserva pagará sabios, escuelas y bibliotecas: más investigación.');
      return;
    }
    if (a.tipo === 'consulta_oro') {
      textos.push('Tesoro: ' + Math.round(c.oro || 0) + ' de oro. Por turno entran ' + (c.ingresos || 0).toFixed(1) + ' (impuestos y comercio) y salen ' + (c.gastos || 0).toFixed(1) + ' (sueldos de ' + (c.guerreros || 0) + ' soldados y mantenimiento)' + (c.mecenazgo ? ', y ' + c.mecenazgo.toFixed(1) + ' van a los sabios' : '') + '. Los edificios cuestan oro; sin oro, los soldados desertan.');
    }
  }
