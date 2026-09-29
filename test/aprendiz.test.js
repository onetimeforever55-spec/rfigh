// Prueba del aprendiz: el intérprete local aprende de lo que entiende la IA, sin olvidar lo que ya sabía.
// node test/aprendiz.test.js
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = () => { const e = RF.consejero.nuevoEstado(); e.dilemas.ultimo = 999; return e; };
const ficha = (clave, extra) => Object.assign({ entendido: true, leyes: [{ nombre: 'x' }], personas: [], clave }, extra || {});

(async () => {
  console.log('LO QUE TRAE DE FÁBRICA');
  {
    const e = nuevo();
    const mal = RF.APRENDIDOS.filter(([t, et]) => !RF.aprendiz.validar(et) || !RF.aprendiz.acierta(t, et, e)).map(x => x[0]);
    comprobar(!mal.length, RF.APRENDIDOS.length + ' decretos enseñados y todos se entienden' + (mal.length ? ': ' + mal.join('; ') : ''));
    const i = RF.interprete.interpretar('nadie puede tomar soju', e);
    comprobar(i.accion === 'PROHIBIR' && i.objeto === 'VICIOS', 'generaliza: "nadie puede tomar soju" es prohibir el alcohol (aprendió qué es el soju)');
  }

  console.log('LECCIONES EXPORTADAS DE UNA PARTIDA (revisadas)');
  {
    const e = nuevo();
    const i = RF.interprete.interpretar('Prohibir el consumo de drogas en Corea del Norte es solo para exportaciones', e);
    const r = RF.consejero.decretar(e, i, { avanzar: false });
    comprobar(i.accion === 'ENFOCAR' && i.objeto === 'NARCO' && r.porque[0].id === 'narcoestado', 'drogas solo para exportar = narcoestado, y se explica como tal');
    const j = RF.interprete.interpretar('Fábricas de opio a hasta morir', nuevo());
    comprobar(j.tema === 'ESCLAVITUD' && j.dir === 'favor', 'fábricas de opio hasta morir = esclavitud (a favor, no en contra)');
    RF.aprendiz.aprender('Fábricas de opio a hasta morir', { tema: 'ESCLAVITUD', dir: 'contra' }, 'ia');
    comprobar(RF.interprete.interpretar('Fábricas de opio a hasta morir', nuevo()).dir === 'favor', 'la lección revisada manda sobre la equivocada que quedó guardada');
    RF.aprendiz.olvidar();
    comprobar(RF.CONCEPTOS.find(k => k.id === 'narcoestado').cuando({ n: 'mano dura contra los narcos', accion: 'CASTIGAR' }) === false, 'perseguir a los narcos no es un narcoestado');
  }

  console.log('APRENDE DE LA IA');
  {
    const e = nuevo();
    const t = 'que se prohíba el makgeolli';
    const antes = RF.interprete.interpretar(t, e);
    comprobar(antes.objeto !== 'VICIOS', 'antes no sabía qué es el makgeolli (' + antes.objeto + ')');
    const et = RF.aprendiz.deFicha(t, ficha({ accion: 'PROHIBIR', objeto: 'VICIOS', conceptos: ['prohibicion_mercado', 'no_existe'] }));
    comprobar(et && et.objeto === 'VICIOS' && et.conceptos.length === 1, 'la IA le enseña la clave (y se descartan los conceptos que no existen)');
    const d = RF.interprete.interpretar(t, e);
    comprobar(d.estado === 'ok' && d.accion === 'PROHIBIR' && d.objeto === 'VICIOS' && d.aprendido, 'ahora lo entiende solo, y sabe que lo aprendió');
    const r = RF.consejero.decretar(e, d, { avanzar: false });
    comprobar(r.conceptos.includes('prohibicion_mercado') && r.porque[0].id === 'prohibicion_mercado', 'y explica el porqué con el concepto que le enseñó la IA');
    comprobar(RF.interprete.interpretar('legalizar el makgeolli', e).objeto === 'VICIOS', 'la palabra nueva sirve para otros decretos ("legalizar el makgeolli")');
    const p = RF.interprete.interpretar('que se prohiba el makgeolli ya', e);
    comprobar(p.objeto === 'VICIOS' && p.aprendido, 'el mismo decreto dicho un poco distinto se entiende igual');

    comprobar(RF.aprendiz.deFicha('vender mi alma', ficha({ tema: 'TIERRA', dir: 'favor' })) && RF.interprete.interpretar('vender mi alma', e).tema === 'TIERRA', 'también aprende temas');
    comprobar(!RF.aprendiz.deFicha('hacer volar la luna', ficha({ accion: 'VOLAR', objeto: 'LUNA' })), 'una clave que no existe no se aprende');
    comprobar(!RF.aprendiz.deFicha('dos cosas', ficha({ accion: 'PROHIBIR', objeto: 'VICIOS' }, { leyes: [{}, {}] })), 'un decreto con varias leyes no se usa de ejemplo');
    comprobar(!RF.aprendiz.deFicha('no se entiende', { entendido: false, clave: { accion: 'PROHIBIR', objeto: 'VICIOS' } }), 'lo que la IA no entendió tampoco');
    comprobar(RF.interprete.interpretarVarios('prohibir el makgeolli y el soju en la playa', e).length >= 1, 'varios decretos en una frase siguen funcionando');
  }

  console.log('NO OLVIDA LO QUE SABÍA');
  {
    const e = nuevo();
    const base = [['subir impuestos', 'SUBIR_IMPUESTO', 'GENERAL'], ['prohibir el fútbol', 'PROHIBIR', 'DIVERSION'], ['imprimir dinero', 'CREAR', 'DINERO'], ['regalar comida a los pobres', 'SUBSIDIAR', 'COMIDA']];
    const mal = base.filter(([t, a, o]) => { const i = RF.interprete.interpretar(t, e); return i.accion !== a || i.objeto !== o; });
    comprobar(!mal.length, 'los decretos de siempre se entienden igual' + (mal.length ? ': ' + mal.map(x => x[0]).join('; ') : ''));
    RF.aprendiz.olvidar();
    comprobar(RF.interprete.interpretar('que se prohíba el makgeolli', e).objeto !== 'VICIOS' && RF.aprendiz.resumen().ia === 0, 'olvidar borra lo aprendido jugando');
    comprobar(RF.interprete.interpretar('nadie puede tomar soju', e).objeto === 'VICIOS', 'pero conserva lo de fábrica');
  }

  console.log('EL EXAMEN (con una IA de mentira)');
  {
    const e = nuevo();
    const genOriginal = RF.narradorIA.generar;
    RF.narradorIA.generar = async () => ({ texto: JSON.stringify({ decretos: [
      { texto: 'prohibir el fútbol', accion: 'PROHIBIR', objeto: 'DIVERSION' },
      { texto: 'fuera el chamchi de las mesas', accion: 'PROHIBIR', objeto: 'COMIDA' },
      { texto: 'mandar a los chavales al cuartel 12 años', tema: 'SERVICIO_MILITAR', dir: 'favor', conceptos: ['soldado_no_siembra'] },
      { texto: 'algo sin clave', accion: 'NADA', objeto: 'NADA' }
    ] }) });
    const r = await RF.aprendiz.examen(5, e);
    RF.narradorIA.generar = genOriginal;
    comprobar(r.total === 3, 'descarta los decretos con una clave imposible');
    comprobar(r.antes < 3 && r.despues === 3, 'antes acertaba ' + r.antes + ' de 3; después, 3');
    comprobar(r.aprendidos.some(x => x.texto.includes('chamchi')) && !r.aprendidos.some(x => x.texto === 'prohibir el fútbol'), 'aprende lo que falló, no lo que ya sabía');
    comprobar(RF.interprete.interpretar('mandar a los chavales al cuartel 12 años', e).tema === 'SERVICIO_MILITAR', 'y lo entiende después');
  }

  console.log('SE GUARDA EN LA BASE DE DATOS DEL JUEGO');
  {
    const docs = new Map();
    const col = { limit: () => col, get: async () => ({ docs: [...docs.entries()].map(([id, d]) => ({ id, data: () => d })) }),
      doc: id => ({ set: async d => { docs.set(id, JSON.parse(JSON.stringify(d))); }, delete: async () => { docs.delete(id); } }) };
    // Una lección que Claude ya corrigió en la base de datos, y otra que solo estaba en este navegador.
    const corregida = 'poner soju en las escuelas';
    RF.aprendiz.aprender(corregida, { accion: 'PROHIBIR', objeto: 'EDUCACION' }, 'ia');
    RF.aprendiz.aprender('fuera el makgeolli', { accion: 'PROHIBIR', objeto: 'VICIOS' }, 'ia');
    docs.set(RF.aprendiz.idDe(RF.texto.normalizar(corregida)), { texto: corregida, origen: 'ia', accion: 'SUBSIDIAR', objeto: 'VICIOS', revisada: true });
    globalThis.claude = { use: async n => (n === 'db' ? { collection: () => col } : null) };
    const n = await RF.aprendiz.conectar();
    comprobar(n >= 2 && RF.aprendiz.resumen().nube, 'se conecta a la base de datos y junta las lecciones');
    const i = RF.interprete.interpretar(corregida, nuevo());
    comprobar(i.accion === 'SUBSIDIAR' && i.objeto === 'VICIOS', 'la corrección hecha en la base de datos manda sobre la copia del navegador');
    comprobar([...docs.values()].some(d => d.texto === 'fuera el makgeolli'), 'sube lo que solo estaba en este navegador');
    RF.aprendiz.aprender('prohibir el chamchi', { accion: 'PROHIBIR', objeto: 'COMIDA' }, 'ia');
    await new Promise(r => setTimeout(r, 0));
    comprobar([...docs.values()].some(d => d.texto === 'prohibir el chamchi' && d.objeto === 'COMIDA'), 'cada lección nueva se guarda al momento');
    RF.aprendiz.olvidar();
    await new Promise(r => setTimeout(r, 0));
    comprobar(docs.size === 0, 'olvidar también la borra de la base de datos');
    delete globalThis.claude;
  }

  console.log('LA IA SABE QUE ENSEÑA');
  comprobar(RF.consejoIA.SISTEMA.includes('"clave"') && RF.consejoIA.SISTEMA.includes('SERVICIO_MILITAR') && RF.consejoIA.SISTEMA.includes('[dinero_sin_respaldo]'), 'el Consejo recibe las acciones, objetos, temas e ids de conceptos para dar la clave');

  console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
  process.exit(fallos ? 1 : 0);
})();
