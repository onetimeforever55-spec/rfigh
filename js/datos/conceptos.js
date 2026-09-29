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

    // ---------------- ECONOMÍA (II) ----------------
    {
      id: 'obras_publicas', area: 'economia', nombre: 'Obras que rinden... si se terminan', peso: 3,
      idea: 'La inversión en infraestructura da empleo hoy y ahorra costes mañana, pero solo si se termina y se mantiene; pagada con billetes nuevos, sube los precios.',
      cuando: c => (c.tema === 'INFRAESTRUCTURA' && c.dir === 'favor') || (c.accion === 'INVERTIR' && ['TRANSPORTE', 'ENERGIA', 'VIVIENDA', 'AGUA'].includes(c.objeto)),
      ajuste: c => (s(c).dinero < 25 ? { efectos: { inflacion: 2 } } : {}),
      porque: c => s(c).dinero < 25 ? 'Sin divisas, la obra se paga imprimiendo wones: el cemento llega, y los precios también.' : 'Una carretera da trabajo hoy y ahorra tiempo durante años. Pero un puente a medias no lleva a ninguna parte.'
    },
    {
      id: 'elefante_blanco', area: 'politica', nombre: 'El elefante blanco', peso: 2,
      idea: 'Los regímenes personalistas prefieren obras de prestigio (rascacielos, estadios) a las útiles: se ven en las fotos, pero no producen nada.',
      cuando: c => c.tema === 'INFRAESTRUCTURA' && c.dir === 'favor' && /\b(rascacielos|aeropuerto|estadio|monument\w*|torre)\b/.test(c.n),
      porque: () => 'Las obras de prestigio salen muy bien en la foto y muy mal en la contabilidad.'
    },
    {
      id: 'enclave', area: 'economia', nombre: 'El enclave vallado', peso: 3,
      idea: 'Una zona económica especial atrae capital extranjero sin abrir todo el país: la valla protege al régimen, pero los que trabajan dentro vuelven con ideas y dinero.',
      cuando: c => c.tema === 'ZONA_ESPECIAL',
      ajuste: c => (c.dir === 'favor' && ec(c).sanciones >= 3 ? { factorLey: 0.7 } : {}),
      porque: c => c.dir === 'contra' ? 'Cerrar la zona tranquiliza al Partido y espanta al dinero: el inversor que se va no vuelve a la primera llamada.' : ec(c).sanciones >= 3 ? 'Con sanciones duras, pocos se arriesgan a invertir: la zona rinde menos de lo que promete el cartel.' : 'La valla deja entrar el dinero y dejar fuera las ideas. Al menos la mitad del trato se cumple.'
    },
    {
      id: 'ventaja_comparativa', area: 'economia', nombre: 'Comprar lo que otros hacen mejor', peso: 3,
      idea: 'Importar lo que otros producen más barato abarata la vida y libera manos para lo que uno hace mejor; cerrarse obliga a producir poco de todo.',
      cuando: c => c.tema === 'COMERCIO_EXTERIOR',
      ajuste: c => (c.dir === 'favor' && ec(c).sanciones >= 3 ? { factorLey: 0.7, relaciones: { china: 2 } } : {}),
      porque: c => c.dir === 'contra' ? 'Ningún país produce todo. El que lo intenta acaba produciendo poco de todo, y caro.' : ec(c).sanciones >= 3 ? 'Con las sanciones, "abrir el comercio" significa comprarle a China. Ayuda, pero China pone el precio.' : 'El arroz de fuera es más barato que el que no se cosecha: los precios bajan y el mercado respira.'
    },
    {
      id: 'exportar_hambre', area: 'economia', nombre: 'Exportar con hambre en casa', peso: 3,
      idea: 'Vender fuera lo que falta dentro trae divisas pero sube los precios locales: lo que se exporta lo pagan los que no pueden comprarlo.',
      cuando: c => c.tema === 'EXPORTACIONES' && c.dir === 'favor',
      ajuste: c => (s(c).felicidad < 40 || /\b(arroz|comida|maiz|trigo|alimentos|pescado|marisco)\b/.test(c.n) ? { efectos: { felicidad: -2, inflacion: 1 } } : {}),
      porque: c => /\b(arroz|comida|maiz|trigo|alimentos|pescado|marisco)\b/.test(c.n) ? 'Cada saco de arroz que sale por el puerto trae yuanes... y deja un plato vacío en casa.' : 'Las divisas entran, pero lo que se va deja de estar en el mercado: sube de precio.'
    },
    {
      id: 'ayuda_fungible', area: 'exterior', nombre: 'La ayuda es fungible', peso: 3,
      idea: 'La ayuda alimentaria alimenta a la gente, pero también libera dinero del régimen para otras cosas (armas, lujos): por eso los donantes exigen inspecciones.',
      cuando: c => c.tema === 'AYUDA_HUMANITARIA',
      porque: c => c.dir === 'contra' ? 'Rechazar la ayuda protege el orgullo del régimen. El hambre, en cambio, no tiene orgullo.' : 'Cada saco regalado es un saco que el Estado no compra: ese dinero puede ir a la gente... o a los misiles. Por eso los donantes quieren mirar.'
    },
    {
      id: 'sueldo_sin_produccion', area: 'economia', nombre: 'Sueldos sin producción', peso: 3,
      idea: 'Subir los sueldos sin que haya más bienes es imprimir dinero con otro nombre; recortarlos en una economía informal empuja a cobrar por fuera.',
      cuando: c => c.tema === 'SUELDOS_ESTADO' || c.tema === 'SALARIO',
      ajuste: c => (c.dir === 'favor' && s(c).dinero < 25 ? { efectos: { inflacion: 2 } } : {}),
      porque: c => c.dir === 'contra' ? 'Un funcionario que no llega a fin de mes no deja de comer: empieza a cobrar por firmar.' : s(c).dinero < 25 ? 'Sin divisas en la caja, la subida se paga imprimiendo: el sueldo sube y el arroz, detrás.' : 'Más wones en el bolsillo alegran... hasta que el arroz se entera.'
    },
    {
      id: 'precio_dinero', area: 'economia', nombre: 'El precio del dinero', peso: 3,
      idea: 'Subir los tipos de interés frena la inflación porque encarece el crédito y premia el ahorro, pero apenas funciona si la gente no usa los bancos.',
      cuando: c => c.tema === 'TIPOS_INTERES',
      ajuste: c => (ec(c).mercadoNegro > 50 ? { factorLey: 0.6 } : {}),
      porque: c => ec(c).mercadoNegro > 50 ? 'Mover los tipos funciona cuando la gente usa el banco. Aquí el banco es un colchón lleno de dólares: el efecto es pequeño.' : c.dir === 'contra' ? 'El crédito barato anima a gastar: bien para construir, mal para los precios.' : 'Si el dinero cuesta más, se presta menos y se gasta menos: los precios se enfrían.'
    },
    {
      id: 'combustible_cadena', area: 'economia', nombre: 'La gasolina está en todo', peso: 3,
      idea: 'El combustible es el coste de mover todo lo demás: subirlo encarece la comida; subvencionarlo beneficia sobre todo a quien tiene vehículo.',
      cuando: c => c.tema === 'COMBUSTIBLE',
      porque: c => c.dir === 'contra' ? 'La gasolina va dentro del precio del arroz: el camión que lo trae también bebe.' : 'La gasolina barata la disfruta quien tiene coche. Aquí eso es el Partido, el ejército y los taxistas.'
    },
    {
      id: 'carbon_divisas', area: 'economia', nombre: 'Vivir del carbón', peso: 3,
      idea: 'Corea del Norte depende del carbón para la luz, la industria y las exportaciones a China: tocarlo afecta a la vez a la energía y a las divisas.',
      cuando: c => c.objeto === 'CARBON' || (c.objeto === 'ENERGIA' && /\b(carbon|solar|renovable\w*|eolic\w*|placas)\b/.test(c.n)),
      ajuste: c => (['PROHIBIR', 'RECORTAR'].includes(c.accion) && /carbon/.test(c.n) ? { efectos: { dinero: -3, felicidad: -1 } } : {}),
      porque: c => ['PROHIBIR', 'RECORTAR'].includes(c.accion) && /carbon/.test(c.n) ? 'El carbón era la luz de las casas y los yuanes de China. Se pierden las dos cosas a la vez.' : /solar|placa/.test(c.n) ? 'En un país sin petróleo y con apagones, una placa solar en el balcón es independencia. Ya las hay a miles, de contrabando.' : 'El carbón da luz y divisas: todo lo que lo toca, toca las dos.'
    },
    {
      id: 'banca_estado', area: 'economia', nombre: 'Lo que es de todos lo manda uno', peso: 2,
      idea: 'Nacionalizar da control al Estado, pero una empresa o un banco públicos suelen servir a quien manda más que a quien produce.',
      cuando: c => c.accion === 'NACIONALIZAR' || (c.accion === 'PRIVATIZAR' && /\bbancos?\b/.test(c.n)),
      porque: c => /\bbancos?\b/.test(c.n) ? (c.accion === 'NACIONALIZAR' ? 'Un banco del Estado presta a quien tiene carnet del Partido, no a quien tiene un buen negocio.' : 'Un banco privado presta a quien pueda devolver. Aquí, a quien tenga un primo en el Partido: eso no cambia tan rápido.') : 'Lo que es de todos lo gestiona el que manda: se gana control y se pierde eficiencia.'
    },
    {
      id: 'paro_oculto', area: 'sociedad', nombre: 'El paro escondido', peso: 3,
      idea: 'En una economía planificada el desempleo se esconde en puestos inútiles; eliminarlos ahorra dinero pero empuja a esa gente al mercado informal.',
      cuando: c => (c.tema === 'BUROCRACIA' && c.dir === 'favor') || (c.objeto === 'INDUSTRIA' && ['PROHIBIR', 'RECORTAR'].includes(c.accion)),
      ajuste: () => ({ economia: { mercadoNegro: 3 } }),
      porque: () => 'Los despedidos no desaparecen: se van al mercado a vender lo que puedan. El paro oficial sigue siendo cero.'
    },
    {
      id: 'natalidad_incentivos', area: 'sociedad', nombre: 'Los hijos no se decretan', peso: 2,
      idea: 'Las familias deciden cuántos hijos tener por vivienda, trabajo y futuro; los premios mueven poco la natalidad y los límites dejan huella durante generaciones.',
      cuando: c => c.tema === 'NATALIDAD',
      ajuste: c => (c.dir === 'favor' ? { factorLey: 0.8 } : {}),
      porque: c => c.dir === 'contra' ? 'Limitar los hijos funciona rápido y se paga en veinte años: faltan jóvenes para trabajar y sobran abuelos.' : 'Una medalla no cría a un niño. Las familias tienen hijos cuando ven casa y futuro, no cuando ven carteles.'
    },
    {
      id: 'poblacion_envejece', area: 'sociedad', nombre: 'Menos jóvenes, más abuelos', peso: 2,
      idea: 'Con pocos nacimientos y más esperanza de vida, cada vez menos trabajadores sostienen a más jubilados.',
      cuando: c => c.tema === 'PENSIONES',
      porque: () => 'Cada año hay menos jóvenes pagando por más abuelos: la cuenta no sale sin tocar algo.'
    },
    {
      id: 'salida_voz', area: 'politica', nombre: 'Salida, voz o lealtad', peso: 3,
      idea: 'Los descontentos pueden irse (salida), protestar (voz) o aguantar (lealtad). Si se les deja salir, protestan menos; si se les cierra la puerta, solo queda la voz.',
      cuando: c => c.tema === 'EMIGRACION' || (c.tema === 'MURO' && c.dir === 'favor'),
      porque: c => c.dir === 'contra' || c.tema === 'MURO' ? 'Si nadie puede irse, al descontento solo le quedan dos caminos: callar o gritar. Y cuanto más calla, más fuerte grita después.' : 'Los que se van no protestan: se van. Pero se lleva a los que más saben, y lo que cuentan fuera se oye dentro.'
    },
    {
      id: 'remesas', area: 'economia', nombre: 'Las remesas', peso: 2,
      idea: 'Los emigrantes envían dinero a sus familias: entran divisas por la puerta de atrás y la gente depende menos del Estado.',
      cuando: c => (c.tema === 'EMIGRACION' && c.dir === 'favor') || c.tema === 'TRABAJADORES_FUERA',
      porque: () => 'Cada emigrante manda dinero a casa. Entran divisas... y familias que ya no dependen de la cartilla.'
    },
    {
      id: 'soldado_no_siembra', area: 'economia', nombre: 'El soldado no siembra', peso: 3,
      idea: 'Cada joven en el cuartel es un trabajador menos en el campo o la fábrica: un ejército enorme empobrece la economía que lo mantiene.',
      cuando: c => c.tema === 'SERVICIO_MILITAR',
      ajuste: c => (c.dir === 'contra' && sec(c).ejercito < 35 ? { efectos: { estabilidad: -2 } } : {}),
      porque: c => c.dir === 'contra' ? (sec(c).ejercito < 35 ? 'Cien mil jóvenes vuelven al campo y producen, pero los generales ya estaban molestos: ahora están molestos y con menos soldados que perder.' : 'Cien mil jóvenes vuelven a sembrar y a fabricar: la economía lo nota antes que el ejército.') : 'Doce años de mili son doce años sin sembrar: el ejército crece y el campo se queda sin brazos.'
    },
    {
      id: 'liberalizar_peligro', area: 'politica', nombre: 'El momento más peligroso', peso: 3,
      idea: 'Liberar presos o relajar la represión alivia la presión, pero da voz a quienes saben lo que pasó: es el momento más peligroso para un régimen que se reforma.',
      cuando: c => c.tema === 'AMNISTIA' && c.dir === 'favor',
      ajuste: c => (regimenDuro(c) ? { efectos: { estabilidad: -1 } } : {}),
      porque: () => 'Cada preso liberado es un testigo. Soltar presión alivia la olla, pero también deja salir lo que había dentro.'
    },
    {
      id: 'corrupcion_lubricante', area: 'politica', nombre: 'El soborno como aceite', peso: 3,
      idea: 'En economías rígidas, el soborno hace que las cosas se muevan y compra la lealtad de la élite; lo paga la gente de abajo.',
      cuando: c => c.tema === 'CORRUPCION' && c.dir === 'contra',
      porque: () => 'Tolerar la corrupción es pagar a la élite sin sacar dinero de la caja: la factura la paga el de abajo, sobre en mano.'
    },
    {
      id: 'purga_selectiva', area: 'politica', nombre: 'Todos son culpables', peso: 3,
      idea: 'Cuando todos los cuadros cobran sobornos, una campaña anticorrupción permite elegir a quién castigar: limpia rivales, no la corrupción.',
      cuando: c => c.tema === 'CORRUPCION' && c.dir === 'favor',
      ajuste: c => (ec(c).mercadoNegro > 50 ? { economia: { mercadoNegro: -3 } } : {}),
      porque: () => 'Si todos cobran sobornos, todos son culpables: la campaña no elige al corrupto, elige al enemigo.'
    },
    {
      id: 'dilema_dictador', area: 'politica', nombre: 'El dilema del dictador', peso: 3,
      idea: 'Cuanto más miedo tienen los subordinados, menos malas noticias le cuentan al líder: el poder absoluto gobierna a ciegas.',
      cuando: c => c.tema === 'VIGILANCIA_ELITE' || (c.objeto === 'ESPIAS' && ['INVERTIR', 'CREAR', 'LEGALIZAR'].includes(c.accion)),
      ajuste: c => (c.dir !== 'contra' ? { efectos: { dinero: -1 } } : {}),
      porque: c => c.dir === 'contra' ? 'Sin micrófonos, quizá alguien te diga por fin una mala noticia a tiempo.' : 'Un ministro vigilado es leal, pero mudo: nadie te trae malas noticias hasta que es tarde.'
    },
    {
      id: 'dinero_turbio', area: 'exterior', nombre: 'Dinero sin preguntas', peso: 2,
      idea: 'Los casinos y negocios opacos en zonas fronterizas atraen divisas precisamente porque nadie pregunta de dónde vienen: ingresos fáciles, y más motivos para sancionar.',
      cuando: c => c.tema === 'CASINOS' && c.dir === 'favor',
      ajuste: c => (ec(c).sanciones >= 2 ? { relaciones: { eeuu: -2 } } : {}),
      porque: () => 'El jugador chino no viene por la ruleta: viene porque aquí nadie pregunta de dónde sale su dinero. Washington sí pregunta.'
    },
    {
      id: 'prevenir_barato', area: 'sociedad', nombre: 'Prevenir es barato', peso: 2,
      idea: 'Una vacuna cuesta mucho menos que una epidemia: la salud pública preventiva es de las inversiones más rentables que existen.',
      cuando: c => c.tema === 'CAMPANA_SALUD',
      porque: c => c.dir === 'contra' ? 'Ahorrarse la vacuna sale caro en cuanto llega la primera fiebre.' : 'Una vacuna cuesta menos que una cama de hospital. Y mucho menos que una epidemia.'
    },
    {
      id: 'campana_choque', area: 'economia', nombre: 'La campaña de choque', peso: 3,
      idea: 'Las movilizaciones masivas suben la producción a base de agotar a la gente y exagerar las cifras: el esfuerzo no se puede repetir cada mes.',
      cuando: c => c.tema === 'CAMPANA_PRODUCCION' && c.dir === 'favor',
      ajuste: c => (s(c).felicidad < 35 ? { efectos: { felicidad: -2 } } : {}),
      porque: () => 'La campaña saca producción de la gente como agua de una esponja: la segunda vez sale menos.'
    },
    {
      id: 'ventana_turismo', area: 'exterior', nombre: 'Ventana en las dos direcciones', peso: 3,
      idea: 'El turismo trae divisas, pero cada visitante es una ventana: los de fuera ven lo que hay dentro y los de dentro ven cómo viven los de fuera.',
      cuando: c => c.tema === 'TURISMO' || (c.objeto === 'TURISMO' && ['LEGALIZAR', 'INVERTIR', 'SUBSIDIAR'].includes(c.accion)),
      ajuste: c => (c.dir !== 'contra' && ec(c).sanciones >= 3 ? { factorLey: 0.8 } : {}),
      porque: c => c.dir === 'contra' ? 'Sin turistas no hay testigos... ni divisas.' : 'Cada turista paga en euros y se lleva fotos. Las dos cosas llegan lejos.'
    },
    {
      id: 'informacion_contagiosa', area: 'sociedad', nombre: 'La información no se desinventa', peso: 3,
      idea: 'Una vez que la gente accede a información de fuera (internet, series surcoreanas), no se puede hacer que la olvide: cambia sus expectativas para siempre.',
      cuando: c => ['INTERNET', 'TECNOLOGIA'].includes(c.objeto) && ['LEGALIZAR', 'SUBSIDIAR', 'INVERTIR', 'CREAR'].includes(c.accion),
      ajuste: c => (regimenDuro(c) ? { efectos: { estabilidad: -1, felicidad: 1 } } : {}),
      porque: () => 'Lo que la gente ve en internet no se puede des-ver: la primera serie de Seúl cambia más cabezas que diez años de propaganda.'
    },
    {
      id: 'tiempo_mercado', area: 'sociedad', nombre: 'Las horas que van al mercado', peso: 2,
      idea: 'En Corea del Norte, las horas que no se pasan en la fábrica estatal se dedican al mercado: acortar la jornada oficial alimenta la economía informal.',
      cuando: c => c.tema === 'JORNADA',
      ajuste: c => (c.dir === 'contra' ? { economia: { mercadoNegro: 2 } } : {}),
      porque: c => c.dir === 'contra' ? 'La hora que sale de la fábrica no se va al sofá: se va al mercado.' : 'Más horas en la fábrica del Estado son menos horas en el mercado, que es donde de verdad se gana para comer.'
    },
    {
      id: 'guardianes', area: 'politica', nombre: '¿Quién vigila al vigilante?', peso: 2,
      idea: 'Más policías dan más control, pero también más gente con poder para cobrar sobornos: la policía mal pagada se paga sola.',
      cuando: c => c.objeto === 'POLICIA' && ['INVERTIR', 'CREAR', 'SUBSIDIAR', 'OBLIGAR'].includes(c.accion),
      ajuste: c => (s(c).dinero < 25 ? { economia: { mercadoNegro: 2 } } : {}),
      porque: c => s(c).dinero < 25 ? 'Un policía más con un sueldo que no alcanza es un peaje más en cada esquina.' : 'Más policías, más orden... y más gente con uniforme que puede pedirte "un favor".'
    },

    {
      id: 'empleo_lealtad', area: 'politica', nombre: 'El empleo como premio', peso: 2,
      idea: 'En los regímenes clientelares el empleo público se reparte como premio a la lealtad: compra apoyos de la élite y sus familias, pero cuesta dinero y no produce nada.',
      cuando: c => c.tema === 'BUROCRACIA' && c.dir === 'contra',
      porque: () => 'Cada puesto nuevo es un regalo a una familia leal. Se paga con dinero público y se cobra en fidelidad.'
    },
    {
      id: 'armas_divisas', area: 'exterior', nombre: 'Armas por divisas', peso: 3,
      idea: 'Para un país sancionado, vender armas y servicios militares es de las pocas fuentes de divisas; cada envío descubierto endurece las sanciones.',
      cuando: c => ['VENTA_ARMAS', 'GUERRILLA_FUERA', 'GOLPE_FUERA', 'CONTRABANDO'].includes(c.tema) && c.dir !== 'contra',
      ajuste: c => (ec(c).sanciones >= 3 ? { relaciones: { eeuu: -2, japon: -1 } } : {}),
      porque: c => ec(c).sanciones >= 3 ? 'Con sanciones duras, las armas son de los pocos productos que siguen teniendo compradores. Y cada barco descubierto es una sanción más.' : 'Las armas se venden bien donde hay guerra: entran divisas, y el nombre del país acaba en un informe de la ONU.'
    },
    {
      id: 'formalizar_mercado', area: 'economia', nombre: 'Sacar a la luz el mercado', peso: 3,
      idea: 'Legalizar el comercio informal permite cobrarle impuestos y baja los sobornos, pero reconoce que el Estado ya no reparte la comida: pierde un instrumento de control.',
      cuando: c => c.tema === 'MERCADOS',
      ajuste: c => (c.dir !== 'contra' && ec(c).mercadoNegro > 50 ? { efectos: { dinero: 2 } } : {}),
      porque: c => c.dir === 'contra' ? 'El mercado no desaparece al cerrarlo: se muda a los portales y sube los precios por el riesgo.' : 'Lo que se vende a escondidas no paga impuestos; lo que se vende a la vista, sí. Pero el Estado acaba de admitir que ya no da de comer.'
    },

    {
      id: 'coste_hundido', area: 'economia', nombre: 'El coste hundido', peso: 3,
      idea: 'Lo ya gastado en una obra no se recupera al pararla: la decisión solo debe mirar lo que falta por gastar y lo que rendirá, no lo que costó.',
      cuando: c => c.tema === 'INFRAESTRUCTURA' && c.dir === 'contra',
      porque: () => 'Lo gastado, gastado está: parar ahorra lo que faltaba, pero deja el hormigón pagado sin servir para nada.'
    },

    {
      id: 'narcoestado', area: 'exterior', nombre: 'El narcoestado', peso: 3,
      idea: 'Un Estado sancionado que fabrica drogas para exportar consigue divisas, pero convierte a sus diplomáticos en contrabandistas y parte de la droga siempre se queda dentro: la adicción se extiende por el país.',
      cuando: c => /\b(opio|droga\w*|metanfetamina\w*|heroina|cristal|bingdu|narco\w*|amapola\w*)\b/.test(c.n) && c.dir !== 'contra' &&
        (['ENFOCAR', 'LEGALIZAR', 'CREAR', 'INVERTIR', 'PRIVATIZAR', 'NACIONALIZAR'].includes(c.accion) || ['ESCLAVITUD', 'EXPORTACIONES', 'CONTRABANDO', 'TRABAJO_INFANTIL'].includes(c.tema)),
      ajuste: () => ({ economia: { mercadoNegro: 3 }, relaciones: { eeuu: -3, china: -2 } }),
      porque: () => 'La droga del Estado se vende fuera, pero una parte siempre se queda dentro: el bingdu, el "hielo", ya corre por los pueblos.'
    },

    // ---------------- POLÍTICA Y SOCIEDAD (III) ----------------
    {
      id: 'aversion_perdida', area: 'sociedad', nombre: 'Perder duele más que ganar', peso: 2,
      idea: 'La gente siente una pérdida con el doble de fuerza que una ganancia del mismo tamaño: quitar algo que ya se tenía enfada mucho más de lo que alegró darlo.',
      cuando: c => (c.dir === 'contra' && ['SALARIO', 'PENSIONES', 'RENTA_BASICA', 'SUELDOS_ESTADO', 'VOTO_MUJERES', 'MATRIMONIO', 'COMBUSTIBLE'].includes(c.tema)) || (c.accion === 'RECORTAR' && ESENCIALES.includes(c.objeto)),
      ajuste: () => ({ efectos: { felicidad: -1 } }),
      porque: () => 'Quitar algo que ya se tenía duele el doble de lo que alegró darlo. La gente no compara con antes de tenerlo: compara con ayer.'
    },
    {
      id: 'trabajo_forzado', area: 'economia', nombre: 'El trabajo forzado rinde poco', peso: 3,
      idea: 'Quien trabaja bajo amenaza hace lo justo para no ser castigado: el trabajo forzado produce poco y mal, y su coste real llega en sanciones, fugas y vergüenza internacional.',
      cuando: c => ['CAMPOS', 'ESCLAVITUD', 'TRABAJO_INFANTIL'].includes(c.tema) && c.dir === 'favor',
      porque: () => 'Quien trabaja a punta de fusil hace lo justo para que no le disparen. Se produce poco, y lo que se ahorra en sueldos se paga en sanciones.'
    },
    {
      id: 'confesion_falsa', area: 'politica', nombre: 'Confesiones, no información', peso: 3,
      idea: 'Bajo tortura la gente dice lo que el interrogador quiere oír: se consiguen culpables y confesiones, no información fiable.',
      cuando: c => c.tema === 'TORTURA' && c.dir === 'favor',
      porque: () => 'Bajo tortura cualquiera confiesa lo que haga falta. Se llenan los expedientes de culpables y se vacían de verdad.'
    },
    {
      id: 'guerra_cara', area: 'exterior', nombre: 'Las guerras se pagan durante décadas', peso: 3,
      idea: 'Una guerra se decide en una tarde y se paga durante décadas; contra un vecino con aliados poderosos, nunca se lucha contra uno solo.',
      cuando: c => c.tema === 'GUERRA',
      porque: c => c.dir === 'contra' ? 'La paz ahorra vidas y dinero, pero deja a un ejército enorme sin enemigo: y un ejército sin enemigo busca uno dentro.' : 'Atacar al Sur es atacar también a Estados Unidos. Las guerras se empiezan en una tarde y se pagan durante generaciones.'
    },
    {
      id: 'deuda_manda', area: 'exterior', nombre: 'El que presta, manda', peso: 3,
      idea: 'Un préstamo es un impuesto aplazado: el dinero llega hoy y la factura, con intereses, mañana; y el acreedor gana poder sobre el deudor. Dejar de pagar cierra el crédito durante años.',
      cuando: c => c.tema === 'PRESTAMO',
      porque: c => c.dir === 'contra' ? 'Dejar de pagar alivia la caja hoy y cierra todas las puertas mañana: nadie vuelve a prestar al que no devolvió.' : 'El préstamo llega hoy y la factura mañana, con intereses. Y quien te presta empieza a opinar sobre tus puertos.'
    },
    {
      id: 'lealtad_rival', area: 'politica', nombre: 'Una lealtad que no controla el Estado', peso: 2,
      idea: 'Una religión organiza a la gente en torno a una lealtad ajena al Estado; por eso los regímenes totalitarios la tratan como un partido rival, y la persecución suele fortalecerla en secreto.',
      cuando: c => c.objeto === 'RELIGION',
      porque: c => ['LEGALIZAR', 'SUBSIDIAR', 'INVERTIR'].includes(c.accion) ? 'Dejar rezar alivia a mucha gente, pero abre un lugar donde se reúnen sin que el Partido organice la reunión.' : 'Para el régimen, un creyente tiene otro jefe. La fe perseguida no desaparece: se esconde y se vuelve más fuerte.'
    },
    {
      id: 'oposicion_valvula', area: 'politica', nombre: 'La válvula de la olla', peso: 3,
      idea: 'Una oposición legal canaliza el descontento hacia la palabra y las urnas en lugar de la calle; pero una vez legal, volver a callarla es mucho más caro.',
      cuando: c => c.objeto === 'OPOSICION' && ['LEGALIZAR', 'SUBSIDIAR', 'CREAR'].includes(c.accion),
      porque: () => 'Una oposición legal es una válvula: el vapor sale por ella y no por la ventana. Pero una válvula abierta ya no se cierra sin que se note.'
    },
    {
      id: 'censura_ceguera', area: 'politica', nombre: 'La censura también ciega al censor', peso: 2,
      idea: 'Sin prensa libre, los problemas no llegan al líder: los informes dicen lo que él quiere oír y los desastres se descubren tarde.',
      cuando: c => c.objeto === 'PRENSA' && ['PROHIBIR', 'CASTIGAR', 'CONTROLAR', 'NACIONALIZAR'].includes(c.accion),
      porque: () => 'Sin periódicos libres, el líder también lee solo buenas noticias. Los desastres llegan igual, pero sin avisar.'
    },
    {
      id: 'ejercito_pagado', area: 'politica', nombre: 'La lealtad a sueldo', peso: 2,
      idea: 'Un ejército bien pagado es leal mientras siga bien pagado; recortarlo ahorra, pero deja a miles de hombres armados sin sueldo ni futuro.',
      cuando: c => c.objeto === 'EJERCITO' && ['INVERTIR', 'SUBSIDIAR', 'RECORTAR', 'PRIVATIZAR'].includes(c.accion),
      porque: c => c.accion === 'RECORTAR' ? 'Recortar el ejército ahorra, pero manda a casa a miles de hombres que saben usar un fusil y ya no tienen sueldo.' : 'Los generales son leales mientras cobran. La pregunta es qué pasa el primer mes que la caja no llega.'
    },
    {
      id: 'culto_ritual', area: 'politica', nombre: 'El aplauso obligatorio', peso: 2,
      idea: 'La adoración obligatoria no mide el apoyo, mide el miedo: todos aplauden y nadie sabe quién cree. Cuesta recursos, pero fabrica una unanimidad visible que desanima a los descontentos.',
      cuando: c => c.accion === 'GLORIFICAR' || (c.objeto === 'CALENDARIO' && ['CREAR', 'OBLIGAR'].includes(c.accion)),
      porque: () => 'Cuando aplaudir es obligatorio, todos aplauden. Así nadie sabe si está solo en no creérselo, y eso es justo lo que se busca.'
    },
    {
      id: 'derechos_lentos', area: 'sociedad', nombre: 'La ley cambia antes que las costumbres', peso: 2,
      idea: 'Ampliar derechos cuesta poco dinero y mucho debate: la sociedad cambia más despacio que la ley, y el choque se nota en las familias y los pueblos.',
      cuando: c => ['ABORTO', 'MATRIMONIO', 'VOTO_MUJERES', 'EDAD_VOTO', 'PROSTITUCION'].includes(c.tema),
      porque: () => 'Una ley se cambia en una tarde; las costumbres, en una generación. Mientras tanto, el debate se muda a las cocinas.'
    },
    {
      id: 'salario_informal', area: 'economia', nombre: 'El mínimo empuja a la sombra', peso: 2,
      idea: 'Un salario mínimo alto protege a quien tiene empleo formal, pero donde hay mucha economía informal empuja a más gente a trabajar en negro.',
      cuando: c => c.tema === 'SALARIO' && c.dir === 'favor',
      ajuste: c => (ec(c).mercadoNegro > 40 ? { economia: { mercadoNegro: 2 } } : {}),
      porque: () => 'El salario mínimo protege al que tiene contrato. El que no lo tiene, que aquí son muchos, sigue cobrando lo que le den en el mercado.'
    },
    {
      id: 'moneda_ajena', area: 'economia', nombre: 'Una moneda que no controlas', peso: 3,
      idea: 'Adoptar una moneda que el Estado no emite (bitcoin, dólar) acaba con la inflación de imprimir, pero le quita al Estado su herramienta favorita y lo ata a precios que no decide.',
      cuando: c => c.tema === 'BITCOIN',
      porque: c => c.dir === 'contra' ? 'Prohibir las criptomonedas protege al won... de la gente que ya no confía en el won.' : 'Si la moneda es bitcoin, el Banco Central ya no puede imprimir. Adiós inflación, adiós también a pagar las nóminas con la imprenta.'
    },
    {
      id: 'tala_riadas', area: 'sociedad', nombre: 'Sin árboles, la lluvia se lleva la tierra', peso: 3,
      idea: 'Talar da leña, madera y tierra de cultivo hoy; sin raíces, la lluvia arrastra la tierra fértil, se llenan los ríos de barro y llegan las riadas.',
      cuando: c => c.tema === 'DEFORESTACION' || (c.objeto === 'AMBIENTE' && ['PRIVATIZAR', 'RECORTAR'].includes(c.accion)),
      porque: c => c.dir === 'contra' ? 'Proteger los montes cuesta leña este invierno y ahorra riadas los próximos veinte.' : 'Los árboles dan leña este invierno. Sin ellos, la próxima lluvia se lleva la tierra, las cosechas y a veces el pueblo.'
    },
    {
      id: 'ciber_rastro', area: 'exterior', nombre: 'Robar sin fronteras', peso: 3,
      idea: 'El robo informático es de las pocas fuentes de divisas que las sanciones no pueden cerrar: no hay barcos que inspeccionar. Pero deja rastro, y cada golpe atribuido endurece la vigilancia sobre el país.',
      cuando: c => c.tema === 'CIBERROBO' && c.dir !== 'contra',
      porque: () => 'Robar por internet no necesita barcos ni fronteras: las sanciones no lo pueden parar. Pero cada golpe deja huellas, y los bancos aprenden.'
    },
    {
      id: 'titere', area: 'exterior', nombre: 'El títere necesita al titiritero', peso: 3,
      idea: 'Poner un gobierno amigo en otro país con un golpe es relativamente barato; mantenerlo, carísimo: depende de quien lo puso y el resentimiento dura generaciones.',
      cuando: c => c.tema === 'GOLPE_FUERA' && c.dir !== 'contra',
      porque: () => 'Un golpe se da en una noche. Luego el gobierno que pusiste necesita tu dinero, tus armas y tu protección para siempre.'
    },
    {
      id: 'estudiar_fuera', area: 'sociedad', nombre: 'Estudiantes que vuelven (o no)', peso: 3,
      idea: 'Mandar jóvenes a estudiar fuera trae conocimiento y técnicos; también ideas nuevas, y el riesgo de que algunos no vuelvan.',
      cuando: c => ['EDUCACION', 'EXTRANJEROS', 'TECNOLOGIA'].includes(c.objeto) && /\b(estudi\w*|becas?|universidad\w*)\b/.test(c.n) && /\b(fuera|afuera|extranjero|exterior|china|rusia|europa)\b/.test(c.n),
      porque: () => 'Los estudiantes vuelven con ingenieros en la cabeza y series en el móvil. Algunos, además, no vuelven.'
    },

    {
      id: 'cambio_regimen', area: 'politica', nombre: 'Cambia quién manda, no cuánto arroz hay', peso: 2,
      idea: 'Un cambio de régimen reparte de nuevo el poder entre ejército, élite y calle, pero no crea riqueza por sí solo: los que pierden poder se resisten y los que ganan lo cobran.',
      cuando: c => ['DEMOCRACIA', 'DICTADURA', 'MONARQUIA', 'JUNTA', 'TEOCRACIA', 'JUCHE'].includes(c.objeto) && ['CREAR', 'LEGALIZAR', 'OBLIGAR'].includes(c.accion),
      porque: c => c.objeto === 'JUNTA' ? 'Con los generales al mando, el ejército está contento y el cuartel se convierte en ministerio. El problema llega cuando un coronel quiere su turno.' : 'Cambiar de régimen cambia quién manda, no cuánto arroz hay. Los que pierden poder no lo sueltan gratis.'
    },

    // ---------------- HISTORIA (precedentes: solo explican) ----------------
    { id: 'h_hiper', area: 'historia', nombre: 'Weimar y Zimbabue', idea: 'Alemania en 1923 y Zimbabue en 2008 imprimieron hasta que el dinero no valía el papel.', cuando: c => imprime(c), porque: () => 'Ya pasó: en Zimbabue, en 2008, un billete de cien billones no alcanzaba para el autobús.' },
    { id: 'h_reforma2009', area: 'historia', nombre: 'La reforma monetaria de 2009', idea: 'En 2009 Corea del Norte cambió los billetes, arruinó los ahorros de la gente y tuvo que dar marcha atrás.', cuando: c => c.tema === 'REFORMA_MONETARIA' || (c.objeto === 'DINERO' && ['PROHIBIR', 'RECORTAR', 'BAJAR_IMPUESTO', 'CONTROLAR'].includes(c.accion)), porque: () => 'En 2009 tu padre cambió los billetes: los ahorros de la gente se evaporaron y hubo que fusilar al ministro que lo propuso.' },
    { id: 'h_agua', area: 'historia', nombre: 'La guerra del agua', idea: 'En Cochabamba (Bolivia), en 2000, privatizar el agua acabó en revuelta y el gobierno tuvo que echarse atrás.', cuando: c => c.accion === 'PRIVATIZAR' && ['AGUA', 'AIRE'].includes(c.objeto), porque: () => 'En Cochabamba, en el año 2000, privatizar el agua acabó con la ciudad en la calle y la empresa en el aeropuerto.' },
    { id: 'h_leyseca', area: 'historia', nombre: 'La Ley Seca', idea: 'La prohibición del alcohol en Estados Unidos (1920-1933) enriqueció a las mafias sin acabar con la bebida.', cuando: c => c.accion === 'PROHIBIR' && ['VICIOS', 'NARCO'].includes(c.objeto), porque: () => 'La Ley Seca americana no quitó la sed a nadie: solo hizo millonario a Al Capone.' },
    { id: 'h_hambruna', area: 'historia', nombre: 'La Ardua Marcha', idea: 'En los años noventa la hambruna mató a cientos de miles de norcoreanos y nació el mercado negro para sobrevivir.', cuando: c => ['PROHIBIR', 'RECORTAR', 'PRIVATIZAR'].includes(c.accion) && ['COMIDA', 'AGRO'].includes(c.objeto), porque: () => 'La abuela Sun-ja recuerda la Ardua Marcha de los noventa: cuando falta comida, la gente no espera al Estado.' },
    { id: 'h_shenzhen', area: 'historia', nombre: 'Shenzhen', idea: 'China abrió zonas económicas especiales en 1980 (Shenzhen): capital extranjero en una zona cerrada, sin tocar el régimen.', cuando: c => (c.tema === 'ZONA_ESPECIAL' && c.dir === 'favor') || (['LEGALIZAR', 'PRIVATIZAR', 'ENFOCAR', 'INVERTIR'].includes(c.accion) && ['EMPRESAS', 'INDUSTRIA', 'TURISMO', 'EXTRANJEROS'].includes(c.objeto)), porque: () => 'China lo hizo en Shenzhen en 1980: dinero de fuera en una zona vallada, y el Partido intacto. Casi siempre.' },
    { id: 'h_granSalto', area: 'historia', nombre: 'El Gran Salto Adelante', idea: 'Mao obligó a colectivizar el campo y a producir acero en hornos caseros (1958-62): la cosecha se hundió y hubo una hambruna enorme.', cuando: c => (c.tema === 'TIERRA' && c.dir === 'contra') || (['OBLIGAR', 'NACIONALIZAR', 'ENFOCAR'].includes(c.accion) && ['AGRO', 'INDUSTRIA', 'COMIDA'].includes(c.objeto)), porque: () => 'Mao intentó algo parecido con el Gran Salto Adelante: muchos informes de éxito, muy poco arroz.' },
    { id: 'h_prensa', area: 'historia', nombre: 'La glásnost', idea: 'Gorbachov abrió la prensa soviética en 1986 para salvar el sistema y la apertura acabó con él.', cuando: c => c.objeto === 'PRENSA' && ['LEGALIZAR', 'CREAR', 'INVERTIR'].includes(c.accion), porque: () => 'Gorbachov abrió la prensa en 1986 para salvar el sistema. Cinco años después no quedaba sistema.' },
    { id: 'h_venezuela', area: 'historia', nombre: 'Los precios justos', idea: 'Venezuela congeló precios en la década de 2010: las estanterías se vaciaron y todo se vendía en el mercado negro.', cuando: c => c.tema === 'CONTROL_PRECIOS' && c.dir === 'favor', porque: () => 'Venezuela lo probó con los "precios justos": las estanterías quedaron vacías y la harina solo se encontraba en la reventa.' },
    { id: 'h_xiaogang', area: 'historia', nombre: 'Xiaogang, 1978', idea: 'En 1978, dieciocho familias de Xiaogang (China) se repartieron en secreto las tierras colectivas y duplicaron la cosecha: fue el inicio de la reforma china.', cuando: c => c.tema === 'TIERRA' && c.dir === 'favor', porque: () => 'En 1978, dieciocho familias chinas de Xiaogang se repartieron la tierra en secreto. Esa cosecha cambió China.' },
    { id: 'h_ryugyong', area: 'historia', nombre: 'El Hotel Ryugyong', idea: 'El Hotel Ryugyong de Pionyang (105 plantas) empezó a construirse en 1987 y lleva décadas sin abrir.', cuando: c => c.tema === 'INFRAESTRUCTURA' && c.dir === 'favor', porque: () => 'El Hotel Ryugyong empezó a construirse en 1987. Tiene 105 plantas y ningún huésped.' },
    { id: 'h_kaesong', area: 'historia', nombre: 'Kaesong', idea: 'El polígono industrial de Kaesong unió fábricas surcoreanas y obreros norcoreanos de 2004 a 2016, hasta que la política lo cerró.', cuando: c => c.tema === 'ZONA_ESPECIAL', porque: () => 'Kaesong lo intentó: fábricas del Sur, obreros del Norte, doce años de divisas. Lo cerró una crisis de misiles.' },
    { id: 'h_albania', area: 'historia', nombre: 'La Albania de Hoxha', idea: 'Albania se aisló de todos sus aliados en los años 70 buscando la autarquía y acabó siendo el país más pobre de Europa.', cuando: c => (c.tema === 'COMERCIO_EXTERIOR' || c.tema === 'EXPORTACIONES') && c.dir === 'contra', porque: () => 'Albania probó la autarquía en los setenta: 170.000 búnkeres y el país más pobre de Europa.' },
    { id: 'h_irlanda', area: 'historia', nombre: 'La Gran Hambruna irlandesa', idea: 'Durante la hambruna irlandesa (1845-49) se siguió exportando comida desde Irlanda mientras la gente moría de hambre.', cuando: c => c.tema === 'EXPORTACIONES' && c.dir === 'favor' && /\b(arroz|comida|maiz|trigo|alimentos)\b/.test(c.n), porque: () => 'En la hambruna irlandesa de 1845 los barcos seguían saliendo cargados de trigo. Irlanda no lo ha olvidado.' },
    { id: 'h_ayuda90', area: 'historia', nombre: 'La ayuda de los noventa', idea: 'Durante la hambruna norcoreana de los 90, parte de la ayuda internacional se desvió al ejército y a los mercados.', cuando: c => c.tema === 'AYUDA_HUMANITARIA' && c.dir === 'favor', porque: () => 'En la hambruna de los noventa, parte del arroz de la ONU acabó en los cuarteles y parte en el mercado, con la etiqueta todavía puesta.' },
    { id: 'h_volcker', area: 'historia', nombre: 'Volcker, 1980', idea: 'Paul Volcker subió los tipos de EE.UU. hasta el 20% en 1980: acabó con la inflación a costa de una dura recesión.', cuando: c => c.tema === 'TIPOS_INTERES' && c.dir === 'favor', porque: () => 'En 1980 Volcker subió los tipos al 20% en Estados Unidos: la inflación murió, y se llevó por delante a unos cuantos empleos.' },
    { id: 'h_iran2019', area: 'historia', nombre: 'Irán, 2019', idea: 'Irán subió la gasolina un 50% en noviembre de 2019 y estallaron protestas en más de cien ciudades.', cuando: c => c.tema === 'COMBUSTIBLE' && c.dir === 'contra', porque: () => 'Irán subió la gasolina en 2019 y en tres días había protestas en cien ciudades.' },
    { id: 'h_hijounico', area: 'historia', nombre: 'El hijo único', idea: 'China limitó a un hijo por familia (1980-2015): frenó la población y dejó un país envejecido con más hombres que mujeres.', cuando: c => c.tema === 'NATALIDAD' && c.dir === 'contra', porque: () => 'China lo hizo con el hijo único: funcionó tan bien que ahora paga a las familias para que tengan más.' },
    { id: 'h_rda', area: 'historia', nombre: 'El Muro de Berlín', idea: 'Antes de 1961 casi tres millones de alemanes orientales huyeron al Oeste; la RDA levantó el Muro para cortar la sangría.', cuando: c => c.tema === 'EMIGRACION' || c.tema === 'MURO', porque: () => 'La RDA perdió tres millones de personas antes de levantar el Muro en 1961. Luego perdió el Muro.' },
    { id: 'h_songun', area: 'historia', nombre: 'Songun', idea: 'La política Songun ("el ejército primero") de los 90 puso al ejército por delante de todo, incluida la comida, en plena hambruna.', cuando: c => (c.tema === 'SERVICIO_MILITAR' && c.dir === 'favor') || (c.objeto === 'EJERCITO' && ['INVERTIR', 'SUBSIDIAR', 'GLORIFICAR'].includes(c.accion)), porque: () => 'Con el Songun de los noventa, el ejército comió primero. El resto, cuando pudo.' },
    { id: 'h_gorbachov', area: 'historia', nombre: 'Gorbachov suelta a los presos', idea: 'Gorbachov liberó a los presos políticos soviéticos en 1987; en cuatro años la URSS se había disuelto.', cuando: c => c.tema === 'AMNISTIA' && c.dir === 'favor', porque: () => 'Gorbachov liberó a los presos políticos en 1987. En 1991 ya no quedaba URSS que los encerrara.' },
    { id: 'h_xi', area: 'historia', nombre: 'Moscas y tigres', idea: 'La campaña anticorrupción de Xi Jinping desde 2012 castigó a más de un millón de cuadros y, de paso, a sus rivales políticos.', cuando: c => c.tema === 'CORRUPCION' && c.dir === 'favor', porque: () => 'Xi Jinping cazó "moscas y tigres" desde 2012: un millón de cuadros castigados, y casualmente ningún aliado.' },
    { id: 'h_chollima', area: 'historia', nombre: 'Chollima', idea: 'El movimiento Chollima (1956) movilizó al país para producir a velocidad de caballo alado: crecimiento rápido, agotamiento después.', cuando: c => c.tema === 'CAMPANA_PRODUCCION' && c.dir === 'favor', porque: () => 'El movimiento Chollima de 1956 pidió producir a la velocidad de un caballo alado. El caballo se cansó.' },
    { id: 'h_cuba', area: 'historia', nombre: 'El Período Especial', idea: 'Cuba se abrió al turismo en los 90 tras perder la ayuda soviética: trajo divisas y una economía paralela en dólares.', cuando: c => c.tema === 'TURISMO' && c.dir === 'favor', porque: () => 'Cuba se abrió al turismo en los noventa para sobrevivir: llegaron los dólares, y con ellos dos países distintos en una misma isla.' },
    { id: 'h_macao', area: 'historia', nombre: 'Banco Delta Asia', idea: 'En 2005 EE.UU. congeló las cuentas norcoreanas en el Banco Delta Asia de Macao por blanqueo: 25 millones de dólares bloqueados.', cuando: c => c.tema === 'CASINOS' && c.dir === 'favor', porque: () => 'En 2005 Washington congeló 25 millones norcoreanos en un banco de Macao. El dinero de casino deja rastro.' },
    { id: 'h_series', area: 'historia', nombre: 'Las memorias USB', idea: 'Las series surcoreanas entran en Corea del Norte en memorias USB desde China; el régimen aprobó en 2020 una ley con penas durísimas por verlas.', cuando: c => ['INTERNET', 'TECNOLOGIA'].includes(c.objeto), porque: () => 'Las series de Seúl ya entran en memorias USB escondidas en sacos de arroz. En 2020 el régimen tuvo que endurecer la ley para frenarlas.' },
    { id: 'h_chongchongang', area: 'historia', nombre: 'El Chong Chon Gang', idea: 'En 2013 Panamá interceptó el barco norcoreano Chong Chon Gang con cazas MiG y misiles escondidos bajo 200.000 sacos de azúcar cubano.', cuando: c => c.tema === 'VENTA_ARMAS' && c.dir !== 'contra', porque: () => 'En 2013 Panamá paró un barco norcoreano: debajo de 200.000 sacos de azúcar había dos cazas MiG.' },
    { id: 'h_julio2002', area: 'historia', nombre: 'Las medidas de julio de 2002', idea: 'En julio de 2002 Corea del Norte legalizó en parte los mercados y subió precios y salarios: los mercados crecieron y el régimen dio marcha atrás en 2005.', cuando: c => c.tema === 'MERCADOS', porque: () => 'En 2002 el régimen legalizó a medias los mercados. Crecieron tanto que en 2005 se asustó y dio marcha atrás.' },
    { id: 'h_pongsu', area: 'historia', nombre: 'El Pong Su', idea: 'En 2003 Australia abordó el carguero norcoreano Pong Su, que había desembarcado 150 kilos de heroína; se atribuye al régimen una red estatal de drogas para conseguir divisas.', cuando: c => /\b(opio|droga\w*|metanfetamina\w*|heroina|cristal|narco\w*|amapola\w*)\b/.test(c.n) && c.dir !== 'contra' && c.accion !== 'CASTIGAR' && c.accion !== 'PROHIBIR', porque: () => 'En 2003 Australia abordó el Pong Su, un carguero norcoreano que acababa de desembarcar 150 kilos de heroína.' },
    { id: 'h_libia', area: 'historia', nombre: 'Libia, 2003', idea: 'Libia entregó su programa nuclear en 2003 a cambio de levantar sanciones; en 2011 su régimen cayó con bombardeos de la OTAN. Pionyang lo cita como la razón para no desarmarse.', cuando: c => c.tema === 'NUCLEAR' && c.dir === 'contra', porque: () => 'Libia entregó su programa nuclear en 2003. En 2011 su régimen cayó bajo las bombas de la OTAN. En Pionyang nadie lo ha olvidado.' },
    { id: 'h_guerra_corea', area: 'historia', nombre: 'La Guerra de Corea', idea: 'La Guerra de Corea (1950-53) acabó casi donde empezó, en torno al paralelo 38, con millones de muertos; nunca se firmó la paz, solo un armisticio.', cuando: c => c.tema === 'GUERRA', porque: () => 'La Guerra de Corea acabó en 1953 casi donde empezó, con millones de muertos. Técnicamente sigue: solo se firmó un armisticio.' },
    { id: 'h_gulag', area: 'historia', nombre: 'El Gulag', idea: 'La URSS usó a millones de presos como mano de obra en el Gulag; tras 1953 se desmontó en gran parte, entre otras cosas porque producía poco y caro.', cuando: c => c.tema === 'CAMPOS', porque: () => 'La URSS tuvo millones de presos trabajando en el Gulag. Tras 1953 se desmontó en gran parte: además de cruel, salía caro.' },
    { id: 'h_congo', area: 'historia', nombre: 'El Congo de Leopoldo II', idea: 'El Estado Libre del Congo (1885-1908), propiedad personal del rey Leopoldo II, se enriqueció con caucho arrancado por trabajo forzado; el escándalo internacional obligó a Bélgica a quitárselo.', cuando: c => ['ESCLAVITUD', 'TRABAJO_INFANTIL'].includes(c.tema) && c.dir === 'favor', porque: () => 'Leopoldo II se hizo rico con el caucho del Congo y el trabajo forzado. El escándalo fue tal que en 1908 le quitaron la colonia.' },
    { id: 'h_inquisicion', area: 'historia', nombre: 'Las confesiones de la Inquisición', idea: 'Los tribunales de brujería de los siglos XVI y XVII obtenían con tortura confesiones de vuelos en escoba y pactos con el diablo.', cuando: c => c.tema === 'TORTURA' && c.dir === 'favor', porque: () => 'Con tortura, los tribunales de brujería consiguieron que la gente confesara volar en escoba. Confesiones hubo muchas; brujas, ninguna.' },
    { id: 'h_decreto770', area: 'historia', nombre: 'El Decreto 770', idea: 'La Rumanía de Ceaușescu prohibió el aborto en 1966 para aumentar la población: la natalidad subió un tiempo y se dispararon los abortos clandestinos, la mortalidad materna y los orfanatos.', cuando: c => (c.tema === 'ABORTO' && c.dir === 'contra') || (c.tema === 'NATALIDAD' && c.dir === 'favor' && /\b(obliga\w*|prohib\w*)\b/.test(c.n)), porque: () => 'Rumanía prohibió el aborto en 1966 para tener más niños. Tuvo más niños un tiempo, y después orfanatos llenos y madres muertas en abortos clandestinos.' },
    { id: 'h_holanda2001', area: 'historia', nombre: 'Países Bajos, 2001', idea: 'Los Países Bajos fueron el primer país en legalizar el matrimonio entre personas del mismo sexo, en 2001.', cuando: c => c.tema === 'MATRIMONIO' && c.dir === 'favor', porque: () => 'Los Países Bajos fueron los primeros, en 2001. Dos décadas después, más de treinta países habían hecho lo mismo.' },
    { id: 'h_nzelanda', area: 'historia', nombre: 'Nueva Zelanda, 1893', idea: 'Nueva Zelanda fue el primer país en dar el voto a las mujeres, en 1893.', cuando: c => c.tema === 'VOTO_MUJERES', porque: () => 'Nueva Zelanda fue la primera en dar el voto a las mujeres, en 1893. El país no se hundió; los que lo predijeron, un poco.' },
    { id: 'h_alaska', area: 'historia', nombre: 'El dividendo de Alaska', idea: 'Alaska reparte desde 1982 un dividendo anual del petróleo a cada residente: lo más parecido a una renta básica que funciona desde hace décadas.', cuando: c => c.tema === 'RENTA_BASICA', porque: () => 'Alaska reparte desde 1982 un cheque anual del petróleo a cada vecino. Funciona porque hay petróleo detrás; con la imprenta detrás, sería otra historia.' },
    { id: 'h_elsalvador', area: 'historia', nombre: 'El Salvador y el bitcoin', idea: 'El Salvador hizo del bitcoin moneda de curso legal en 2021; poca gente lo usó en su día a día y en 2025 dejó de ser obligatorio aceptarlo.', cuando: c => c.tema === 'BITCOIN', porque: () => 'El Salvador adoptó el bitcoin en 2021. La gente siguió pagando el pan en dólares, y en 2025 dejó de ser obligatorio aceptarlo.' },
    { id: 'h_riadas1995', area: 'historia', nombre: 'Las inundaciones de 1995', idea: 'En 1995 unas inundaciones enormes arrasaron las cosechas norcoreanas; los montes pelados por la tala para leña y cultivo agravaron el desastre, preludio de la hambruna.', cuando: c => c.tema === 'DEFORESTACION' || (c.objeto === 'AMBIENTE' && ['PRIVATIZAR', 'RECORTAR', 'INVERTIR'].includes(c.accion)), porque: () => 'En 1995 las lluvias bajaron por montes sin árboles y se llevaron las cosechas. Detrás vino la Ardua Marcha.' },
    { id: 'h_bangladesh', area: 'historia', nombre: 'El robo al Banco de Bangladesh', idea: 'En 2016 unos piratas informáticos, atribuidos a Corea del Norte, robaron 81 millones de dólares al banco central de Bangladesh mediante órdenes falsas de SWIFT.', cuando: c => c.tema === 'CIBERROBO' && c.dir !== 'contra', porque: () => 'En 2016 robaron por internet 81 millones al banco central de Bangladesh. Casi fueron mil millones: los salvó una errata en una orden.' },
    { id: 'h_hambantota', area: 'historia', nombre: 'El puerto de Hambantota', idea: 'Sri Lanka, ahogada por la deuda, cedió en 2017 a una empresa china el puerto de Hambantota durante 99 años.', cuando: c => c.tema === 'PRESTAMO' && c.dir !== 'contra', porque: () => 'Sri Lanka pidió prestado a China para un puerto. En 2017, sin poder pagar, se lo cedió por 99 años.' },
    { id: 'h_argentina2001', area: 'historia', nombre: 'El corralito', idea: 'Argentina dejó de pagar su deuda en 2001, tras congelar los depósitos (el corralito): la mayor suspensión de pagos de su época y años sin crédito internacional.', cuando: c => c.tema === 'PRESTAMO' && c.dir === 'contra', porque: () => 'Argentina dejó de pagar en 2001. Tuvo cinco presidentes en dos semanas y tardó años en volver a pedir prestado.' },
    { id: 'h_mosaddeq', area: 'historia', nombre: 'Irán, 1953', idea: 'En 1953 Estados Unidos y el Reino Unido organizaron el derrocamiento de Mosaddeq en Irán; el resentimiento alimentó la revolución de 1979.', cuando: c => c.tema === 'GOLPE_FUERA' && c.dir !== 'contra', porque: () => 'En 1953 americanos y británicos derribaron al primer ministro de Irán. En 1979 la revolución les pasó la factura.' },
    { id: 'h_2397', area: 'historia', nombre: 'La resolución 2397', idea: 'En 2017 la resolución 2397 de la ONU ordenó repatriar a los trabajadores norcoreanos en el extranjero, una de las principales fuentes de divisas del régimen.', cuando: c => c.tema === 'TRABAJADORES_FUERA', porque: () => 'En 2017 la ONU ordenó devolver a casa a todos los trabajadores norcoreanos del extranjero. Muchos siguieron allí con otro papel.' },
    { id: 'h_carbon2017', area: 'historia', nombre: 'El carbón sancionado', idea: 'En 2017 la ONU prohibió las exportaciones de carbón norcoreano, su principal fuente de divisas; desde entonces sale de contrabando en transbordos en alta mar.', cuando: c => c.objeto === 'CARBON' || c.tema === 'CONTRABANDO', porque: () => 'En 2017 la ONU prohibió comprar carbón norcoreano. Desde entonces sale igual, de barco a barco en alta mar y de noche.' },
    { id: 'h_rio_han', area: 'historia', nombre: 'El milagro del río Han', idea: 'Corea del Sur apostó por exportar desde los años sesenta y pasó de ser más pobre que el Norte a ser una de las economías más ricas del mundo.', cuando: c => (c.tema === 'COMERCIO_EXTERIOR' || c.tema === 'EXPORTACIONES') && c.dir === 'favor' && !/\b(arroz|comida|maiz|trigo|alimentos)\b/.test(c.n), porque: () => 'En los sesenta el Sur era más pobre que el Norte. Apostó por vender al mundo y hoy es de los países más ricos.' },
    { id: 'h_parkinson', area: 'historia', nombre: 'La ley de Parkinson', idea: 'El historiador C. N. Parkinson observó en 1955 que la burocracia crece aunque el trabajo no crezca: el Almirantazgo británico tenía más funcionarios cuantos menos barcos tenía.', cuando: c => c.tema === 'BUROCRACIA', porque: () => 'En 1955 Parkinson notó que el Almirantazgo británico tenía más funcionarios cuantos menos barcos le quedaban. La burocracia crece sola.' },
    { id: 'h_corea_natalidad', area: 'historia', nombre: 'La natalidad del Sur', idea: 'Corea del Sur ha gastado enormes sumas en fomentar la natalidad desde 2006 y aun así tiene la tasa más baja del mundo: 0,72 hijos por mujer en 2023.', cuando: c => c.tema === 'NATALIDAD' && c.dir === 'favor', porque: () => 'Corea del Sur lleva desde 2006 pagando por cada bebé y en 2023 tuvo la natalidad más baja del mundo: 0,72 hijos por mujer.' },
    { id: 'h_venezuela_gasolina', area: 'historia', nombre: 'La gasolina más barata del mundo', idea: 'Venezuela tuvo durante décadas la gasolina casi regalada: el subsidio costaba miles de millones y alimentaba el contrabando hacia Colombia.', cuando: c => c.tema === 'COMBUSTIBLE' && c.dir === 'favor', porque: () => 'Venezuela regaló la gasolina durante décadas. Llenar el depósito costaba menos que un café, y media gasolina acababa de contrabando en Colombia.' },
    { id: 'h_viruela', area: 'historia', nombre: 'La viruela', idea: 'La viruela, que mató a cientos de millones de personas, fue declarada erradicada en 1980 gracias a la vacunación.', cuando: c => c.tema === 'CAMPANA_SALUD' && c.dir !== 'contra', porque: () => 'La viruela mató a cientos de millones de personas. En 1980 se declaró erradicada: a base de vacunas.' },
    { id: 'h_stasi', area: 'historia', nombre: 'La Stasi', idea: 'La policía política de la RDA llegó a tener unos 90.000 empleados y más de 170.000 informantes; en 1989 no evitó la caída del Muro.', cuando: c => c.tema === 'VIGILANCIA_ELITE' || (c.objeto === 'ESPIAS' && ['CREAR', 'INVERTIR', 'SUBSIDIAR'].includes(c.accion)), porque: () => 'La Stasi tenía unos 90.000 agentes y 170.000 informantes. Lo sabía todo de todos, y aun así en 1989 cayó el Muro.' },
    { id: 'h_meiji', area: 'historia', nombre: 'El Japón Meiji', idea: 'Desde 1870 el Japón Meiji envió a sus jóvenes a estudiar a Occidente y contrató expertos extranjeros; en una generación se convirtió en una potencia industrial.', cuando: c => ['EDUCACION', 'EXTRANJEROS', 'TECNOLOGIA'].includes(c.objeto) && /\b(estudi\w*|becas?|universidad\w*)\b/.test(c.n) && /\b(fuera|afuera|extranjero|exterior|china|rusia|europa)\b/.test(c.n), porque: () => 'El Japón Meiji mandó a sus jóvenes a estudiar a Occidente desde 1870. En una generación era una potencia industrial.' },
    { id: 'h_pravda', area: 'historia', nombre: 'Pravda e Izvestia', idea: 'En la URSS los dos grandes diarios se llamaban "La Verdad" (Pravda) y "Las Noticias" (Izvestia); el chiste era que en Pravda no había noticias y en Izvestia no había verdad.', cuando: c => c.objeto === 'PRENSA' && ['PROHIBIR', 'CASTIGAR', 'CONTROLAR', 'NACIONALIZAR'].includes(c.accion), porque: () => 'En la URSS se decía: en La Verdad (Pravda) no hay noticias, y en Las Noticias (Izvestia) no hay verdad.' },
    { id: 'h_albania_atea', area: 'historia', nombre: 'El primer Estado ateo', idea: 'Albania se declaró en 1967 el primer Estado oficialmente ateo del mundo y cerró todos los templos; la fe sobrevivió en secreto y volvió en cuanto cayó el régimen.', cuando: c => c.objeto === 'RELIGION' && ['PROHIBIR', 'CASTIGAR'].includes(c.accion), porque: () => 'Albania se declaró oficialmente atea en 1967 y cerró todos los templos. En 1990 la gente volvió a rezar como si nada.' },
    { id: 'h_milenio_rus', area: 'historia', nombre: 'El milenio de la Rus', idea: 'En 1988, por el milenio del bautismo de la Rus, Gorbachov devolvió iglesias a la Iglesia ortodoxa y relajó la persecución religiosa.', cuando: c => c.objeto === 'RELIGION' && ['LEGALIZAR', 'SUBSIDIAR', 'INVERTIR'].includes(c.accion), porque: () => 'En 1988 Gorbachov devolvió las iglesias por el milenio de la Rus. Las colas para bautizarse dieron la vuelta a la manzana.' },
    { id: 'h_antialcohol', area: 'historia', nombre: 'La campaña antialcohol', idea: 'La campaña antialcohol soviética de 1985 recortó la venta de vodka: el Estado perdió muchísimos ingresos, faltó azúcar (se usaba para destilar en casa) y floreció el samogón.', cuando: c => c.objeto === 'VICIOS' && ['PROHIBIR', 'SUBIR_IMPUESTO', 'RECORTAR'].includes(c.accion), porque: () => 'La URSS recortó el vodka en 1985. El Estado perdió una fortuna, el azúcar desapareció de las tiendas y cada cocina se volvió una destilería.' },
    { id: 'h_uruguay', area: 'historia', nombre: 'Uruguay, 2013', idea: 'Uruguay fue en 2013 el primer país en legalizar la producción y venta de marihuana, con el Estado como regulador.', cuando: c => c.objeto === 'VICIOS' && c.accion === 'LEGALIZAR', porque: () => 'Uruguay legalizó la marihuana en 2013 y el Estado se puso a venderla en farmacias. El narco perdió clientes; el país no se hundió.' },
    { id: 'h_barbas', area: 'historia', nombre: 'El impuesto a las barbas', idea: 'Pedro el Grande impuso en 1698 un impuesto a las barbas para obligar a los rusos a vestirse a la europea; los barbudos debían llevar una ficha que probaba que habían pagado.', cuando: c => c.objeto === 'ROPA' && ['PROHIBIR', 'OBLIGAR', 'SUBIR_IMPUESTO'].includes(c.accion), porque: () => 'Pedro el Grande puso un impuesto a las barbas en 1698. Los barbudos pagaban y llevaban una ficha de cobre que decía "la barba es un peso inútil".' },
    { id: 'h_talibanes', area: 'historia', nombre: 'Las cometas prohibidas', idea: 'Los talibanes prohibieron en 1996 la música, la televisión y hasta las cometas en Afganistán; los casetes siguieron circulando a escondidas.', cuando: c => c.objeto === 'DIVERSION' && ['PROHIBIR', 'CASTIGAR'].includes(c.accion), porque: () => 'Los talibanes prohibieron en 1996 la música, la tele y las cometas. Los casetes siguieron pasando de mano en mano, bajo el burka.' },
    { id: 'h_escuela_sur', area: 'historia', nombre: 'La escuela del Sur', idea: 'Tras la guerra, Corea del Sur era un país de campesinos en gran parte analfabetos; su apuesta por la escuela universal fue la base de su despegue económico.', cuando: c => c.objeto === 'EDUCACION' && ['INVERTIR', 'SUBSIDIAR', 'CREAR'].includes(c.accion), porque: () => 'Tras la guerra, el Sur era un país de campesinos que no sabían leer. Llenó el país de escuelas antes que de fábricas, y luego llegaron las fábricas.' },
    { id: 'h_medicos_cuba', area: 'historia', nombre: 'Los médicos de Cuba', idea: 'Cuba hizo de su sanidad un orgullo nacional y un producto de exportación: miles de médicos en el extranjero que traen divisas al Estado.', cuando: c => c.objeto === 'SALUD' && ['INVERTIR', 'SUBSIDIAR', 'NACIONALIZAR'].includes(c.accion), porque: () => 'Cuba convirtió a sus médicos en orgullo y en negocio: miles trabajan fuera y el Estado se queda buena parte del sueldo.' },
    { id: 'h_nacionaliza_ve', area: 'historia', nombre: 'Las nacionalizaciones de Venezuela', idea: 'Venezuela nacionalizó cientos de empresas desde 2007; muchas acabaron produciendo una fracción de lo que producían antes.', cuando: c => c.accion === 'NACIONALIZAR' && ['EMPRESAS', 'INDUSTRIA', 'RECURSOS', 'AGRO'].includes(c.objeto), porque: () => 'Venezuela nacionalizó cientos de empresas desde 2007. Muchas siguieron abiertas; lo que dejaron fue de producir.' },
    { id: 'h_tontons', area: 'historia', nombre: 'Los tontons macoutes', idea: 'Los Duvalier gobernaron Haití de 1957 a 1986 apoyados en los tontons macoutes, una milicia personal que aterrorizaba al país.', cuando: c => c.objeto === 'ESCUADRON' && ['CREAR', 'INVERTIR', 'SUBSIDIAR', 'LEGALIZAR'].includes(c.accion), porque: () => 'Los Duvalier gobernaron Haití casi treinta años con los tontons macoutes, una milicia propia. Cuando cayeron, la gente buscó a los macoutes por las calles.' },
    { id: 'h_guardias_rojos', area: 'historia', nombre: 'Los Guardias Rojos', idea: 'Mao lanzó a los Guardias Rojos en 1966 contra sus rivales; en dos años eran tan incontrolables que tuvo que mandarlos al campo.', cuando: c => c.objeto === 'MILICIA' && ['CREAR', 'INVERTIR', 'SUBSIDIAR', 'LEGALIZAR'].includes(c.accion), porque: () => 'Mao soltó a los Guardias Rojos contra sus rivales en 1966. En 1968 tuvo que mandarlos al campo: ya no obedecían a nadie.' },
    { id: 'h_gran_purga', area: 'historia', nombre: 'La Gran Purga', idea: 'Las purgas de Stalin (1936-38) eliminaron a buena parte de los mandos del Ejército Rojo; en 1941 la invasión alemana lo encontró sin oficiales experimentados.', cuando: c => (c.accion === 'CASTIGAR' && ['OPOSICION', 'PARTIDO', 'EJERCITO'].includes(c.objeto)) || (c.res && c.res.tipo === 'persona' && ['matar', 'encarcelar'].includes(c.res.trato)), porque: () => 'Stalin purgó a buena parte de sus generales en 1937. En 1941, cuando llegó la invasión, le faltaban oficiales que supieran mandar.' },
    { id: 'h_sakoku', area: 'historia', nombre: 'El Japón cerrado', idea: 'Japón se cerró a casi todos los extranjeros durante más de dos siglos (sakoku); en 1853 los barcos americanos lo encontraron sin defensas modernas y tuvo que abrirse a la fuerza.', cuando: c => c.objeto === 'EXTRANJEROS' && ['PROHIBIR', 'CASTIGAR'].includes(c.accion) && !/\b(estudi\w*|becas?)\b/.test(c.n), porque: () => 'Japón se cerró al mundo más de doscientos años. En 1853 llegaron cuatro barcos americanos y descubrió que el mundo no le había esperado.' },
    { id: 'h_libreta', area: 'historia', nombre: 'La libreta cubana', idea: 'Cuba reparte alimentos con la libreta de abastecimiento desde 1962: nació como medida temporal y sigue en vigor.', cuando: c => c.tema === 'RACIONAMIENTO' && c.dir === 'favor', porque: () => 'Cuba sacó su libreta de racionamiento en 1962 como medida temporal. Sigue ahí.' },
    { id: 'h_francia2023', area: 'historia', nombre: 'Francia, 2023', idea: 'Francia subió en 2023 la edad de jubilación de 62 a 64 años: millones de personas salieron a la calle durante meses.', cuando: c => c.tema === 'PENSIONES' || (c.tema === 'JORNADA' && c.dir === 'favor'), porque: () => 'Francia subió la jubilación de 62 a 64 años en 2023 y tuvo meses de huelgas y basura sin recoger en París.' },
    { id: 'h_noche', area: 'historia', nombre: 'La península de noche', idea: 'Las fotos de satélite de Corea de noche muestran el Sur iluminado y el Norte casi a oscuras, salvo Pionyang.', cuando: c => c.objeto === 'ENERGIA', porque: () => 'Vista desde el espacio de noche, la península es un Sur lleno de luz y un Norte negro con un punto encendido: Pionyang.' },
    { id: 'h_calendario_juche', area: 'historia', nombre: 'El calendario Juche', idea: 'En 1997 Corea del Norte adoptó el calendario Juche, que cuenta los años desde el nacimiento del Presidente Eterno, en 1912.', cuando: c => c.objeto === 'CALENDARIO' || (c.accion === 'GLORIFICAR' && c.objeto === 'LIDER'), porque: () => 'Desde 1997 el país cuenta los años desde el nacimiento de tu abuelo, el Presidente Eterno. 1912 es el año 1 Juche.' },
    { id: 'h_bokassa', area: 'historia', nombre: 'El emperador Bokassa', idea: 'Bokassa se coronó emperador de Centroáfrica en 1977 con una ceremonia que costó una parte enorme del presupuesto nacional; en 1979 fue derrocado.', cuando: c => c.objeto === 'MONARQUIA' && ['CREAR', 'LEGALIZAR'].includes(c.accion), porque: () => 'Bokassa se coronó emperador de Centroáfrica en 1977 con un trono de oro con forma de águila. Dos años después lo derrocaron.' },
    { id: 'h_transicion', area: 'historia', nombre: 'La Transición española', idea: 'España pasó de la dictadura a la democracia entre 1975 y 1978 pactando con los propios herederos del régimen: la élite aceptó el cambio porque conservaba parte de su poder.', cuando: c => c.objeto === 'DEMOCRACIA' && ['CREAR', 'LEGALIZAR'].includes(c.accion), porque: () => 'España pasó de dictadura a democracia en tres años sin guerra: los del régimen aceptaron porque se quedaban con parte del poder.' },
    { id: 'h_solidaridad', area: 'historia', nombre: 'Solidaridad, 1989', idea: 'Polonia legalizó el sindicato Solidaridad en 1989 y convocó elecciones semilibres: ganó casi todos los escaños que se disputaban.', cuando: c => c.objeto === 'OPOSICION' && ['LEGALIZAR', 'SUBSIDIAR', 'CREAR'].includes(c.accion), porque: () => 'Polonia legalizó Solidaridad en 1989 pensando que controlaría las elecciones. Solidaridad ganó casi todos los escaños que se votaban.' },
    { id: 'h_ejercito_rojo', area: 'historia', nombre: 'El ejército que volvió a casa', idea: 'Tras 1989 el ejército soviético se retiró de Europa del Este: miles de oficiales volvieron sin casa ni sueldo, y parte de su armamento acabó en el mercado negro.', cuando: c => c.objeto === 'EJERCITO' && c.accion === 'RECORTAR', porque: () => 'Cuando la URSS retiró sus tropas de Europa del Este, miles de oficiales volvieron sin casa ni sueldo. Parte de sus armas acabó en venta.' },
    { id: 'h_niyazov', area: 'historia', nombre: 'Los meses de Turkmenistán', idea: 'El presidente de Turkmenistán renombró en 2002 los meses del año, uno con su propio nombre y otro con el de su madre.', cuando: c => c.accion === 'GLORIFICAR' && c.objeto === 'LIDER', porque: () => 'El presidente de Turkmenistán cambió en 2002 el nombre de los meses: enero pasó a llamarse como él y abril como su madre.' },
    { id: 'h_annona', area: 'historia', nombre: 'Pan y circo', idea: 'La annona de Roma repartía grano gratis a unos 200.000 ciudadanos en tiempos de Augusto: compraba la paz de la ciudad y se convirtió en un gasto imposible de quitar.', cuando: c => c.objeto === 'COMIDA' && ['SUBSIDIAR', 'CREAR'].includes(c.accion), porque: () => 'Roma regalaba grano a unos 200.000 ciudadanos. Nadie se atrevió nunca a quitarlo: el pan gratis compra paz y crea costumbre.' },
    { id: 'h_1789', area: 'historia', nombre: 'Los Estados Generales', idea: 'La Revolución Francesa empezó por una crisis fiscal: en 1789 el rey convocó los Estados Generales para subir impuestos y acabó perdiendo el trono.', cuando: c => c.accion === 'SUBIR_IMPUESTO' && ['GENERAL', 'TRABAJADORES', 'AGRO'].includes(c.objeto), porque: () => 'En 1789 el rey de Francia reunió a los Estados Generales para subir impuestos. Salió de ahí sin impuestos y, al final, sin cabeza.' },
    { id: 'h_kansas', area: 'historia', nombre: 'El experimento de Kansas', idea: 'Kansas recortó drásticamente los impuestos en 2012 esperando que el crecimiento lo pagara; el agujero en las cuentas obligó a revertirlo en 2017.', cuando: c => c.accion === 'BAJAR_IMPUESTO' && ['EMPRESAS', 'GENERAL'].includes(c.objeto), porque: () => 'Kansas bajó mucho los impuestos en 2012 esperando que la economía despegara. En 2017 los subió otra vez: despegó el déficit.' },
    { id: 'h_british_rail', area: 'historia', nombre: 'Los trenes británicos', idea: 'El Reino Unido privatizó sus ferrocarriles en los noventa; los billetes se encarecieron y parte de la red acabó volviendo a manos públicas.', cuando: c => c.accion === 'PRIVATIZAR' && c.objeto === 'TRANSPORTE', porque: () => 'El Reino Unido privatizó sus trenes en los noventa. Los billetes subieron, y años después el Estado tuvo que volver a quedarse con parte de la red.' },
    { id: 'h_ford', area: 'historia', nombre: 'Los cinco dólares de Ford', idea: 'Henry Ford duplicó el sueldo de sus obreros a 5 dólares diarios en 1914: bajó la rotación y sus trabajadores pudieron comprar los coches que fabricaban.', cuando: c => c.tema === 'SALARIO' && c.dir === 'favor', porque: () => 'Ford duplicó el sueldo de sus obreros en 1914 y le salió bien: dejaron de irse y empezaron a comprarse sus propios coches.' },
    { id: 'h_35horas', area: 'historia', nombre: 'Las 35 horas', idea: 'Francia implantó la semana laboral de 35 horas en 2000 con la idea de repartir el trabajo; el efecto sobre el empleo sigue discutiéndose.', cuando: c => c.tema === 'JORNADA' && c.dir === 'contra', porque: () => 'Francia pasó a 35 horas semanales en 2000 para repartir el trabajo. Veinte años después, los economistas siguen discutiendo si funcionó.' },
    { id: 'h_veil', area: 'historia', nombre: 'La ley Veil', idea: 'Francia legalizó el aborto en 1975 con la ley Veil, tras años de abortos clandestinos y un gran debate público.', cuando: c => c.tema === 'ABORTO' && c.dir === 'favor', porque: () => 'Francia lo legalizó en 1975 con la ley Veil. Antes, miles de mujeres abortaban igual, pero a escondidas y con riesgo.' },
    { id: 'h_rusia90', area: 'historia', nombre: 'Las privatizaciones rusas', idea: 'Rusia privatizó sus empresas estatales en los noventa a toda prisa; unos pocos con contactos se quedaron con petróleo, metales y bancos a precio de saldo: nacieron los oligarcas.', cuando: c => c.accion === 'PRIVATIZAR' && ['EMPRESAS', 'INDUSTRIA', 'RECURSOS', 'SALUD', 'CARBON'].includes(c.objeto), porque: () => 'Rusia privatizó todo en los noventa y a toda prisa. Unos pocos con amigos en el Kremlin se quedaron el petróleo a precio de saldo: nacieron los oligarcas.' },
    { id: 'h_myanmar', area: 'historia', nombre: 'La junta de Myanmar', idea: 'Los militares gobernaron Myanmar de 1962 a 2011; tras una década de apertura, volvieron con un golpe en 2021.', cuando: c => c.objeto === 'JUNTA' && ['CREAR', 'LEGALIZAR'].includes(c.accion), porque: () => 'Los militares gobernaron Myanmar casi cincuenta años. Soltaron el poder en 2011 y lo recuperaron con un golpe en 2021.' },
    { id: 'h_sanciones', area: 'historia', nombre: 'Petróleo por alimentos', idea: 'Las sanciones a Irak en los noventa empobrecieron a la población mientras el régimen seguía en pie.', cuando: c => c.tema === 'NUCLEAR' || c.tema === 'MISILES', porque: () => 'Las sanciones rara vez tumban a un líder: suelen empobrecer a su gente. Irak en los noventa lo demostró.' }
  ];

  // Los conceptos que se aplican a un decreto. Devuelve { ajustes, porque[] } (máximo 2 explicaciones).
  RF.conceptosDe = function (c) {
    // Los conceptos que la IA enseñó para este decreto (c.extra) cuentan aunque su condición no salte.
    // Si uno de esos no encaja con su propia condición, explica con su idea general (su porqué a medida
    // podría hablar de otro caso) y no cambia números.
    const encaja = new Set(RF.CONCEPTOS.filter(k => { try { return k.cuando(c); } catch (err) { return false; } }));
    const activos = RF.CONCEPTOS.filter(k => encaja.has(k) || (c.extra || []).includes(k.id));
    const ajustes = activos.filter(k => k.ajuste && encaja.has(k)).map(k => ({ id: k.id, a: k.ajuste(c) }));
    // Primero los que enseñó la IA, luego los que cambian algo (explican un número); la historia, como remate.
    const nota = k => ((c.extra || []).includes(k.id) ? 20 : 0) + (k.ajuste ? 10 : 0) + (k.peso || 1);
    const mecanismos = activos.filter(k => k.area !== 'historia').sort((a, b) => nota(b) - nota(a));
    const historia = activos.filter(k => k.area === 'historia');
    const porque = mecanismos.slice(0, 1).concat(historia.slice(0, 1).length ? historia.slice(0, 1) : mecanismos.slice(1, 2))
      .map(k => ({ id: k.id, nombre: k.nombre, area: k.area, texto: encaja.has(k) ? k.porque(c) : k.idea }));
    return { activos, ajustes, porque };
  };
})(globalThis.RF = globalThis.RF || {});
