/*
 * CONCEPTOS
 * La biblioteca con la que razona el juego: mecanismos reales de economía, sociedad, política,
 * relaciones exteriores e historia. No son decretos ya resueltos: se aplican a CUALQUIER decreto
 * según la situación del país, ajustan un poco sus consecuencias y explican el porqué.
 *
 * Cada concepto:
 *   area     economia | sociedad | politica | exterior | historia
 *   nombre   cómo se llama
 *   idea     el mecanismo en una frase (lo lee también el Consejo con IA)
 *   cuando   (c) => ¿se aplica a este decreto? c = { e, accion, objeto, o, tema, dir, n, res }
 *   ajuste   (c) => cambios extra: { efectos, economia, relaciones, factorLey } (opcional)
 *   porque   (c) => la explicación para el jugador, corta
 *   peso     prioridad al elegir qué explicaciones se enseñan (por defecto 1)
 * Los precedentes históricos (area "historia") solo explican: no cambian números.
 */
(function (RF) {
  'use strict';

  const ESENCIALES = ['AIRE', 'AGUA', 'COMIDA', 'SALUD', 'ENERGIA', 'VIVIENDA', 'TRANSPORTE'];
  const QUERIDOS = ['DIVERSION', 'VICIOS', 'INTERNET', 'TECNOLOGIA', 'ROPA', 'MASCOTAS', 'CALENDARIO', 'RELIGION'];
  const REPRESIVAS = ['ESCUADRON', 'MILICIA', 'ESPIAS'];
  const imprime = c => c.objeto === 'DINERO' && ['CREAR', 'SUBSIDIAR', 'INVERTIR', 'OBLIGAR'].includes(c.accion);
  const s = c => c.e.stats;
  const ec = c => c.e.economia || { sanciones: 0, mercadoNegro: 40 };
  const sec = c => c.e.sectores || { ejercito: 50, elite: 50 };
  const regimenDuro = c => ['JUCHE', 'DICTADURA', 'JUNTA'].includes(c.e.politica && c.e.politica.regimen);

  RF.CONCEPTOS = [
    // ---------------- ECONOMÍA ----------------
    {
      id: 'dinero_sin_respaldo', area: 'economia', nombre: 'Dinero sin respaldo', peso: 3,
      idea: 'Imprimir dinero sin que haya más bienes solo reparte la misma comida entre más billetes: suben los precios.',
      cuando: c => imprime(c),
      porque: () => 'Hay más wones pero el mismo arroz: cada billete compra menos.'
    },
    {
      id: 'confianza_moneda', area: 'economia', nombre: 'Confianza en la moneda', peso: 4,
      idea: 'Cuando la gente espera inflación, se deshace de la moneda (compra dólares, yuanes o arroz) y la inflación se acelera sola.',
      cuando: c => imprime(c) && s(c).inflacion > 18,
      ajuste: () => ({ efectos: { inflacion: 3 }, economia: { mercadoNegro: 3 } }),
      porque: () => 'Con los precios ya subiendo, nadie quiere guardar wones: se cambian por yuanes en el mercado y la inflación corre sola.'
    },
    {
      id: 'deficit_monetizado', area: 'economia', nombre: 'Gasto sin dinero', peso: 3,
      idea: 'Si el Estado regala o gasta sin tener dinero, acaba imprimiéndolo: más inflación.',
      cuando: c => ['SUBSIDIAR', 'INVERTIR', 'CREAR'].includes(c.accion) && s(c).dinero < 10 && c.objeto !== 'DINERO',
      ajuste: () => ({ efectos: { inflacion: 2 } }),
      porque: () => 'Las arcas están vacías: para pagarlo, el Banco Central encenderá la imprenta.'
    },
    {
      id: 'prohibicion_mercado', area: 'economia', nombre: 'Lo prohibido se va al mercado negro', peso: 3,
      idea: 'Prohibir algo que la gente quiere o necesita no lo elimina: pasa al mercado negro, más caro y sin impuestos.',
      cuando: c => c.accion === 'PROHIBIR' && (ESENCIALES.includes(c.objeto) || QUERIDOS.includes(c.objeto) || (c.o && (c.o.vicio || (c.o.popular || 0) >= 2))),
      ajuste: () => ({ economia: { mercadoNegro: 6 } }),
      porque: c => 'Prohibirlo no hace que la gente deje de quererlo: ' + (c.res.nombreObjeto || 'eso') + ' se vende ahora en el jangmadang, más caro y sin pagar impuestos.'
    },
    {
      id: 'recaudacion_informal', area: 'economia', nombre: 'Economía sumergida', peso: 2,
      idea: 'Los impuestos solo se cobran en la economía visible: con un mercado negro grande, subir impuestos recauda menos y empuja más gente a la informalidad.',
      cuando: c => c.accion === 'SUBIR_IMPUESTO' && ec(c).mercadoNegro >= 45,
      ajuste: () => ({ factorLey: 0.8, economia: { mercadoNegro: 4 } }),
      porque: c => 'Media economía (' + Math.round(ec(c).mercadoNegro) + '%) está en el mercado negro y no paga: el impuesto recauda menos y empuja a más gente fuera.'
    },
    {
      id: 'captura_privatizacion', area: 'economia', nombre: 'Privatizar para los de siempre', peso: 2,
      idea: 'En un régimen cerrado, lo que se privatiza lo compran los que ya mandan: la élite gana y el pueblo lo nota.',
      cuando: c => c.accion === 'PRIVATIZAR' && regimenDuro(c) && !c.tema,
      ajuste: () => ({ efectos: { elite: 4, felicidad: -1 } }),
      porque: () => 'Los únicos con dinero para comprarlo son los cuadros del Partido: el Palacio lo celebra, la calle no.'
    },
    {
      id: 'sanciones_inversion', area: 'economia', nombre: 'Invertir bajo sanciones', peso: 2,
      idea: 'Con sanciones fuertes no se puede importar maquinaria ni repuestos: las inversiones rinden menos.',
      cuando: c => ['INVERTIR', 'CREAR'].includes(c.accion) && ec(c).sanciones >= 3 && c.objeto !== 'DINERO',
      ajuste: () => ({ factorLey: 0.85 }),
      porque: () => 'Con las sanciones no entran repuestos: las máquinas se montan con piezas del mercado negro y rinden menos.'
    },
    {
      id: 'dependencia_china', area: 'exterior', nombre: 'Dependencia de China', peso: 2,
      idea: 'Casi todo el comercio pasa por China: abrir comercio o vender recursos acerca a Pekín, y Pekín cobra en influencia.',
      cuando: c => ['PRIVATIZAR', 'LEGALIZAR', 'ENFOCAR'].includes(c.accion) && ['RECURSOS', 'CARBON', 'TURISMO', 'EMPRESAS', 'INDUSTRIA'].includes(c.objeto),
      ajuste: () => ({ relaciones: { china: 3 } }),
      porque: () => 'El comprador, casi seguro, será chino: más divisas, y un poco más de Pekín en tus asuntos.'
    },
    {
      id: 'subsidio_costumbre', area: 'economia', nombre: 'Los derechos adquiridos', peso: 1,
      idea: 'Lo que se regala se convierte en derecho: con el tiempo ya no alegra, pero quitarlo enfurece.',
      cuando: c => c.accion === 'SUBSIDIAR' && ESENCIALES.includes(c.objeto),
      porque: () => 'Hoy es un regalo; en tres turnos será un derecho. Quitarlo entonces dolerá el doble.'
    },
    {
      id: 'curva_laffer', area: 'economia', nombre: 'Demasiados impuestos', peso: 2,
      idea: 'Por encima de cierto punto, subir impuestos hace que la gente produzca menos o evada, y se recauda menos.',
      cuando: c => c.accion === 'SUBIR_IMPUESTO' && RF.leyes.lista(c.e).filter(l => l.accion === 'SUBIR_IMPUESTO').length >= 2,
      ajuste: () => ({ factorLey: 0.75, efectos: { felicidad: -2 } }),
      porque: () => 'Ya pagan demasiados impuestos: cada nuevo recauda menos, porque la gente produce menos o esconde lo que gana.'
    },

    // ---------------- SOCIEDAD ----------------
    {
      id: 'doble_vida', area: 'sociedad', nombre: 'Obedecer en público', peso: 1,
      idea: 'Bajo un régimen duro, la gente cumple las normas absurdas en público y las ignora en privado.',
      cuando: c => ['PROHIBIR', 'OBLIGAR'].includes(c.accion) && ['DIVERSION', 'ROPA', 'CALENDARIO', 'MASCOTAS', 'OTRO'].includes(c.objeto) && regimenDuro(c),
      ajuste: () => ({ economia: { mercadoNegro: 2 } }),
      porque: () => 'La gente lo cumplirá delante del jefe de la unidad popular. En casa, con las cortinas echadas, ya se verá.'
    },
    {
      id: 'desigualdad_visible', area: 'sociedad', nombre: 'La desigualdad que se ve', peso: 2,
      idea: 'Favorecer a los ricos cuando la gente pasa necesidad genera resentimiento, aunque los ricos lo agradezcan.',
      cuando: c => (c.accion === 'BAJAR_IMPUESTO' && c.o && c.o.faccion === 'cupula') || (c.accion === 'SUBSIDIAR' && ['EMPRESAS', 'PARTIDO'].includes(c.objeto)),
      ajuste: c => ({ efectos: { felicidad: s(c).felicidad < 45 ? -3 : -1 } }),
      porque: () => 'En Pionyang estrenan coches; en el mercado se fijan en quién los conduce.'
    },
    {
      id: 'culto_con_hambre', area: 'sociedad', nombre: 'Culto con el estómago vacío', peso: 2,
      idea: 'Los homenajes al líder cuando falta comida suenan a burla: la propaganda funciona peor con hambre.',
      cuando: c => c.accion === 'GLORIFICAR' && s(c).felicidad < 40,
      ajuste: () => ({ efectos: { felicidad: -3 } }),
      porque: () => 'Una estatua nueva con el arroz tan caro: la gente aplaude, pero con las tripas.'
    },
    {
      id: 'miedo', area: 'sociedad', nombre: 'El miedo', peso: 2,
      idea: 'La represión no hace feliz a nadie, pero calla el descontento: da estabilidad artificial mientras dura el miedo.',
      cuando: c => c.accion === 'CASTIGAR' || REPRESIVAS.includes(c.objeto),
      porque: () => 'Nadie será más feliz, pero pocos se atreverán a decirlo: la estabilidad sube a base de miedo.'
    },
    {
      id: 'martir', area: 'sociedad', nombre: 'El mártir', peso: 2,
      idea: 'Perseguir a quien la gente admira lo convierte en símbolo: la oposición crece con cada detenido.',
      cuando: c => c.accion === 'CASTIGAR' && ['OPOSICION', 'PRENSA', 'RELIGION'].includes(c.objeto),
      ajuste: () => ({ efectos: { estabilidad: -1 } }),
      porque: () => 'Cada detenido tiene madre, hermanos y vecinos: la próxima memoria USB circulará con su foto.'
    },
    {
      id: 'movilidad_songbun', area: 'sociedad', nombre: 'Songbun', peso: 1,
      idea: 'La casta política heredada decide quién vive en Pionyang y quién estudia: tocarla alegra a los de abajo y asusta a los de arriba.',
      cuando: c => c.tema === 'SONGBUN',
      porque: () => 'El songbun decide desde la cuna quién vive en Pionyang: tocarlo alegra a los de abajo y pone nerviosos a los de arriba.'
    },

    // ---------------- POLÍTICA ----------------
    {
      id: 'paradoja_tocqueville', area: 'politica', nombre: 'El momento más peligroso', peso: 3,
      idea: 'El momento más peligroso para un régimen duro es cuando empieza a reformarse: las expectativas suben más rápido que los cambios.',
      cuando: c => regimenDuro(c) && ['LEGALIZAR', 'CREAR', 'INVERTIR'].includes(c.accion) && ['PRENSA', 'INTERNET', 'OPOSICION', 'ELECCIONES', 'CONGRESO'].includes(c.objeto) && s(c).estabilidad < 55,
      ajuste: () => ({ efectos: { estabilidad: -3 } }),
      porque: () => 'Abrir un poco la mano después de años de puño hace que todos pidan más, y más rápido de lo que puedes dar.'
    },
    {
      id: 'purga', area: 'politica', nombre: 'La purga', peso: 2,
      idea: 'Cuando cae alguien de arriba, los demás no se vuelven más leales: se vuelven más cuidadosos.',
      cuando: c => c.res && c.res.tipo === 'persona' && ['matar', 'encarcelar', 'destituir', 'exiliar'].includes(c.res.trato) && RF.PERSONAS[c.res.persona] && RF.PERSONAS[c.res.persona].tipo === 'ministro',
      ajuste: () => ({ efectos: { elite: -4 } }),
      porque: () => 'Cuando cae un ministro, los demás cuentan los días y guardan copias de todo.'
    },
    {
      id: 'ejercito_humillado', area: 'politica', nombre: 'No humilles al ejército', peso: 3,
      idea: 'El ejército es el único que puede dar un golpe: recortarlo cuando ya está molesto es jugar con fuego.',
      cuando: c => c.accion === 'RECORTAR' && c.objeto === 'EJERCITO' && sec(c).ejercito < 45,
      ajuste: () => ({ efectos: { ejercito: -5 } }),
      porque: () => 'Los generales ya estaban molestos: recortarles ahora es invitarlos a revisar los planos del Palacio.'
    },
    {
      id: 'legitimidad_rendimiento', area: 'politica', nombre: 'Legitimidad por resultados', peso: 1,
      idea: 'Un régimen sin elecciones se sostiene con resultados: cuando la vida mejora, se le perdona casi todo.',
      cuando: c => regimenDuro(c) && ['SUBSIDIAR', 'INVERTIR', 'BAJAR_IMPUESTO'].includes(c.accion) && ESENCIALES.concat(['GENERAL', 'TRABAJADORES', 'EDUCACION']).includes(c.objeto) && s(c).felicidad < 50,
      ajuste: () => ({ efectos: { estabilidad: 1 } }),
      porque: () => 'Sin elecciones, el régimen se sostiene con la comida en la mesa: cada mejora vale más que un desfile.'
    },
    {
      id: 'institucion_rival', area: 'politica', nombre: 'Guardias rivales', peso: 2,
      idea: 'Crear una fuerza armada paralela protege al líder del ejército, pero el ejército lo vive como una amenaza.',
      cuando: c => ['CREAR', 'INVERTIR'].includes(c.accion) && ['MILICIA', 'ESCUADRON'].includes(c.objeto),
      porque: () => 'Una fuerza que no depende del ejército te protege de los generales... y los generales lo saben.'
    },

    // ---------------- EXTERIOR ----------------
    {
      id: 'aislamiento', area: 'exterior', nombre: 'El precio del aislamiento', peso: 1,
      idea: 'Un país aislado paga más caro todo lo que importa y vende más barato todo lo que exporta.',
      cuando: c => ['PROHIBIR', 'CASTIGAR'].includes(c.accion) && ['EXTRANJEROS', 'TURISMO'].includes(c.objeto),
      ajuste: () => ({ relaciones: { china: -2 }, efectos: { dinero: -3 } }),
      porque: () => 'Cerrarse más cuesta divisas: menos turistas chinos, menos comercio y más sospechas en Pekín.'
    },

    {
      id: 'precio_maximo', area: 'economia', nombre: 'Precio máximo, estantería vacía', peso: 4,
      idea: 'Si el Estado fija un precio por debajo del de mercado, nadie quiere vender a ese precio: el producto desaparece de las tiendas y aparece en el mercado negro.',
      cuando: c => c.tema === 'CONTROL_PRECIOS' && c.dir === 'favor',
      porque: () => 'Si el arroz vale menos en la tienda que en el mercado, el arroz se va al mercado. Siempre.'
    },
    {
      id: 'precio_libre', area: 'economia', nombre: 'Precio libre, estantería llena', peso: 3,
      idea: 'Liberar precios los sube de golpe, pero devuelve el producto a las tiendas: a ese precio, a alguien le compensa vender.',
      cuando: c => c.tema === 'CONTROL_PRECIOS' && c.dir === 'contra',
      porque: () => 'Todo sube de golpe, pero al precio de verdad a alguien le compensa vender: vuelve el arroz a las tiendas.'
    },
    {
      id: 'colas', area: 'sociedad', nombre: 'La cola como institución', peso: 3,
      idea: 'El racionamiento reparte la escasez en lugar de acabar con ella: crea colas, privilegios para quien reparte y mercado negro para quien no llega.',
      cuando: c => c.tema === 'RACIONAMIENTO' && c.dir === 'favor',
      porque: () => 'La cartilla no crea arroz: reparte el que hay y convierte al que lo reparte en la persona más poderosa del barrio.'
    },
    {
      id: 'incentivos_campo', area: 'economia', nombre: 'Quien siembra, cosecha', peso: 4,
      idea: 'Los campesinos producen más cuando se quedan con lo que cosechan; en las granjas colectivas trabajan para cumplir la cuota, no para producir.',
      cuando: c => c.tema === 'TIERRA',
      porque: c => c.dir === 'favor' ? 'Un campesino que se queda con lo que cosecha madruga más que uno que cumple una cuota.' : 'En la granja colectiva nadie se queda con lo que siembra: se cumple la cuota y ni un grano más.'
    },
    {
      id: 'ahorros_confiscados', area: 'economia', nombre: 'Confiscar los ahorros', peso: 4,
      idea: 'Cambiar la moneda con un límite de canje baja la inflación de golpe, pero borra los ahorros de la gente y destruye la confianza en el Estado.',
      cuando: c => c.tema === 'REFORMA_MONETARIA' && c.dir === 'favor',
      porque: () => 'La inflación baja de golpe porque desaparece el dinero... incluido el que la gente tenía ahorrado bajo el colchón.'
    },

    // ---------------- HISTORIA (precedentes: solo explican) ----------------
    { id: 'h_hiper', area: 'historia', nombre: 'Weimar y Zimbabue', idea: 'Alemania en 1923 y Zimbabue en 2008 imprimieron hasta que el dinero no valía el papel.', cuando: c => imprime(c), porque: () => 'Ya pasó: en Zimbabue, en 2008, un billete de cien billones no alcanzaba para el autobús.' },
    { id: 'h_reforma2009', area: 'historia', nombre: 'La reforma monetaria de 2009', idea: 'En 2009 Corea del Norte cambió los billetes, arruinó los ahorros de la gente y tuvo que dar marcha atrás.', cuando: c => c.tema === 'REFORMA_MONETARIA' || (c.objeto === 'DINERO' && ['PROHIBIR', 'RECORTAR', 'BAJAR_IMPUESTO', 'CONTROLAR'].includes(c.accion)), porque: () => 'En 2009 tu padre cambió los billetes: los ahorros de la gente se evaporaron y hubo que fusilar al ministro que lo propuso.' },
    { id: 'h_agua', area: 'historia', nombre: 'La guerra del agua', idea: 'En Cochabamba (Bolivia), en 2000, privatizar el agua acabó en revuelta y el gobierno tuvo que echarse atrás.', cuando: c => c.accion === 'PRIVATIZAR' && ['AGUA', 'AIRE'].includes(c.objeto), porque: () => 'En Cochabamba, en el año 2000, privatizar el agua acabó con la ciudad en la calle y la empresa en el aeropuerto.' },
    { id: 'h_leyseca', area: 'historia', nombre: 'La Ley Seca', idea: 'La prohibición del alcohol en Estados Unidos (1920-1933) enriqueció a las mafias sin acabar con la bebida.', cuando: c => c.accion === 'PROHIBIR' && ['VICIOS', 'NARCO'].includes(c.objeto), porque: () => 'La Ley Seca americana no quitó la sed a nadie: solo hizo millonario a Al Capone.' },
    { id: 'h_hambruna', area: 'historia', nombre: 'La Ardua Marcha', idea: 'En los años noventa la hambruna mató a cientos de miles de norcoreanos y nació el mercado negro para sobrevivir.', cuando: c => ['PROHIBIR', 'RECORTAR', 'PRIVATIZAR'].includes(c.accion) && ['COMIDA', 'AGRO'].includes(c.objeto), porque: () => 'La abuela Sun-ja recuerda la Ardua Marcha de los noventa: cuando falta comida, la gente no espera al Estado.' },
    { id: 'h_shenzhen', area: 'historia', nombre: 'Shenzhen', idea: 'China abrió zonas económicas especiales en 1980 (Shenzhen): capital extranjero en una zona cerrada, sin tocar el régimen.', cuando: c => ['LEGALIZAR', 'PRIVATIZAR', 'ENFOCAR', 'INVERTIR'].includes(c.accion) && ['EMPRESAS', 'INDUSTRIA', 'TURISMO', 'EXTRANJEROS'].includes(c.objeto), porque: () => 'China lo hizo en Shenzhen en 1980: dinero de fuera en una zona vallada, y el Partido intacto. Casi siempre.' },
    { id: 'h_granSalto', area: 'historia', nombre: 'El Gran Salto Adelante', idea: 'Mao obligó a colectivizar el campo y a producir acero en hornos caseros (1958-62): la cosecha se hundió y hubo una hambruna enorme.', cuando: c => (c.tema === 'TIERRA' && c.dir === 'contra') || (['OBLIGAR', 'NACIONALIZAR', 'ENFOCAR'].includes(c.accion) && ['AGRO', 'INDUSTRIA', 'COMIDA'].includes(c.objeto)), porque: () => 'Mao intentó algo parecido con el Gran Salto Adelante: muchos informes de éxito, muy poco arroz.' },
    { id: 'h_prensa', area: 'historia', nombre: 'La glásnost', idea: 'Gorbachov abrió la prensa soviética en 1986 para salvar el sistema y la apertura acabó con él.', cuando: c => c.objeto === 'PRENSA' && ['LEGALIZAR', 'CREAR', 'INVERTIR'].includes(c.accion), porque: () => 'Gorbachov abrió la prensa en 1986 para salvar el sistema. Cinco años después no quedaba sistema.' },
    { id: 'h_venezuela', area: 'historia', nombre: 'Los precios justos', idea: 'Venezuela congeló precios en la década de 2010: las estanterías se vaciaron y todo se vendía en el mercado negro.', cuando: c => c.tema === 'CONTROL_PRECIOS' && c.dir === 'favor', porque: () => 'Venezuela lo probó con los "precios justos": las estanterías quedaron vacías y la harina solo se encontraba en la reventa.' },
    { id: 'h_xiaogang', area: 'historia', nombre: 'Xiaogang, 1978', idea: 'En 1978, dieciocho familias de Xiaogang (China) se repartieron en secreto las tierras colectivas y duplicaron la cosecha: fue el inicio de la reforma china.', cuando: c => c.tema === 'TIERRA' && c.dir === 'favor', porque: () => 'En 1978, dieciocho familias chinas de Xiaogang se repartieron la tierra en secreto. Esa cosecha cambió China.' },
    { id: 'h_sanciones', area: 'historia', nombre: 'Petróleo por alimentos', idea: 'Las sanciones a Irak en los noventa empobrecieron a la población mientras el régimen seguía en pie.', cuando: c => c.tema === 'NUCLEAR' || c.tema === 'MISILES', porque: () => 'Las sanciones rara vez tumban a un líder: suelen empobrecer a su gente. Irak en los noventa lo demostró.' }
  ];

  // Los conceptos que se aplican a un decreto. Devuelve { ajustes, porque[] } (máximo 2 explicaciones).
  RF.conceptosDe = function (c) {
    const activos = RF.CONCEPTOS.filter(k => { try { return k.cuando(c); } catch (err) { return false; } });
    const ajustes = activos.filter(k => k.ajuste).map(k => ({ id: k.id, a: k.ajuste(c) }));
    // Primero los que cambian algo (explican un número), luego los demás; la historia, como remate.
    const mecanismos = activos.filter(k => k.area !== 'historia').sort((a, b) => (b.ajuste ? 10 : 0) + (b.peso || 1) - ((a.ajuste ? 10 : 0) + (a.peso || 1)));
    const historia = activos.filter(k => k.area === 'historia');
    const porque = mecanismos.slice(0, 1).concat(historia.slice(0, 1).length ? historia.slice(0, 1) : mecanismos.slice(1, 2))
      .map(k => ({ id: k.id, nombre: k.nombre, area: k.area, texto: k.porque(c) }));
    return { activos, ajustes, porque };
  };
})(globalThis.RF = globalThis.RF || {});
