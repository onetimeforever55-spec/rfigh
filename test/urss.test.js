// Prueba del escenario de la URSS en 1985: país, fechas, historia programada, final y que no se cuele Corea.
// node test/urss.test.js
global.localStorage = { _d: { 'consola.escenario': 'urss1985' }, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } };
const RF = require('./cargar')();

let fallos = 0;
const comprobar = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallos++; };
const nuevo = () => RF.consejero.nuevoEstado();

console.log('EL PAÍS');
{
  comprobar(RF.ESCENARIO.id === 'urss1985' && RF.PAIS.id === 'urss' && RF.PAIS.juego === 'Consola del Kremlin', 'se carga la URSS');
  const e = nuevo();
  comprobar(RF.politica.regimen(e) === 'PARTIDO' && RF.REGIMENES.PARTIDO.nombre === 'Partido único', 'régimen de partido único');
  comprobar(RF.GABINETE.garrote.nombre === 'Mariscal Dmitri Grómov' && RF.VARS.lider === 'camarada Secretario General', 'con sus ministros y su tratamiento');
  comprobar(RF.CIUDADANOS.carmen.nombre === 'Abuela Zina' && RF.PERSONAS.valiente.nombre === 'Borís Volkónov', 'su gente de a pie y su rival');
  comprobar(Object.keys(RF.PAIS.relaciones).join() === 'eeuu,europa,china,este', 'y sus potencias: Estados Unidos, Europa Occidental, China y Europa del Este');
  comprobar(RF.escenario.fecha(1) === 'marzo de 1985' && RF.escenario.fecha(28) === 'diciembre de 1991' && RF.escenario.fecha(1, true) === 'MAR 1985', 'cada turno son tres meses: de marzo de 1985 a diciembre de 1991');
}

console.log('LA HISTORIA PROGRAMADA');
{
  const e = nuevo();
  const ids = e.dilemas.cadena.map(c => c.id + '@' + c.dia);
  comprobar(ids.includes('h_chernobil@5') && ids.includes('h_muro@19') && ids.includes('h_golpe@26'), 'Chernóbil, el Muro y el golpe de agosto llegan en su fecha');
  comprobar(e.pendientes.some(p => p.titulo === 'El petróleo se hunde' && p.ingresos < 0), 'el hundimiento del petróleo baja los ingresos para siempre');
  const coreanos = ['huelga_general', 'presion_china', 'mano_seul', 'secuestrados_japon'];
  comprobar(!RF.DILEMAS.some(d => coreanos.includes(d.id)) && RF.DILEMAS.some(d => d.id === 'congreso_bloquea'), 'los eventos de Corea del Norte no salen; los del sistema político, sí');
}

console.log('EL VOCABULARIO DE LA ÉPOCA');
{
  const e = nuevo();
  const casos = [['abrir la prensa', i => i.accion === 'LEGALIZAR' && i.objeto === 'PRENSA'], ['glásnost', i => i.objeto === 'PRENSA'], ['sacar las tropas de Afganistán', i => i.tema === 'GUERRA' && i.dir === 'contra'],
    ['legalizar las cooperativas', i => i.tema === 'MERCADOS'], ['vender más gas a Europa', i => i.tema === 'EXPORTACIONES'], ['prohibir el vodka', i => i.objeto === 'VICIOS']];
  const mal = casos.filter(([t, ok]) => { const i = RF.interprete.interpretar(t, e); return i.estado !== 'ok' || !ok(i); }).map(x => x[0]);
  comprobar(!mal.length, 'entiende la glásnost, Afganistán, las cooperativas o el gas, aunque se digan con otras palabras' + (mal.length ? ': falla ' + mal.join(', ') : ''));
  comprobar(RF.PAIS.atajos[0][1] === 'abrir la prensa', 'y los botones rápidos son soviéticos');
}

console.log('LA DIPLOMACIA');
{
  const e = nuevo();
  const d1 = RF.interprete.interpretar('negociar con Estados Unidos', e), d2 = RF.interprete.interpretar('visitar Bonn', e), d3 = RF.interprete.interpretar('amenazar a Polonia', e);
  comprobar(d1.tipo === 'diplomacia' && d1.pais === 'eeuu' && d2.pais === 'europa' && d3.pais === 'este' && d3.dir === 'hostil', 'entiende a quién va dirigido cada gesto (Washington, Bonn, Polonia)');
}

console.log('EL FINAL');
{
  const preparar = est => { const e = nuevo(); e.dia = 27; e.dilemas.cadena = []; e.pendientes = []; e.dilemas.ultimo = 999; e.stats.estabilidad = est; e.marcas = { chernobil: 'ocultar', muro: 'dejar' }; return e; };
  const g = preparar(50); RF.consejero.pasarTurno(g);
  comprobar(g.fin === 'victoria' && g.resultadoEscenario.ganado, 'si la Unión llega en pie a diciembre de 1991, ganas');
  const bl = RF.narrador.final(g);
  const real = bl.find(b => b.titulo === 'LO QUE PASÓ DE VERDAD');
  comprobar(real && /Gorbachov/.test(real.texto) && /Ocultaste Chernóbil/.test(real.texto) && /Dejaste caer el Muro/.test(real.texto), 'y el final cuenta lo que pasó de verdad y en qué te pareciste');
  const p = preparar(8); RF.consejero.pasarTurno(p);
  comprobar(p.fin && p.fin !== 'victoria', 'si llega hecha pedazos, pierdes');
  const quieto = nuevo(); let n = 0;
  while (!quieto.fin && n++ < 40) { let d; while ((d = RF.director.pendiente(quieto))) RF.director.resolver(quieto, 0); if (!quieto.fin) RF.consejero.pasarTurno(quieto); }
  comprobar(quieto.fin && quieto.fin !== 'victoria', 'sin gobernar, la Unión se hunde como en la historia (' + RF.escenario.fecha(quieto.dia) + ')');
}

console.log('NO SE CUELA COREA DEL NORTE');
{
  const FUGA = /Pionyang|norcorean|Corea del Norte|\bwon(es)?\b|jangmadang|Sun-ja|Chol-su|Kwang-ho|Eun-hee|Song Dae-ho|Rodong|Juche|Hamhung|Nampo|Jang Tae|Pak Mi|Ryu Chang|Líder Supremo/;
  const fugas = [];
  const mirar = (bl, donde) => { for (const b of bl) for (const t of [b.texto, b.titulo].concat((b.hijos || []).map(h => h.texto)).concat((b.opciones || []).map(o => o.texto + ' ' + (o.resultado || '')))) if (t && FUGA.test(t)) fugas.push(donde + ': ' + String(t).slice(0, 100)); };
  const ds = ['abrir la prensa', 'imprimir dinero', 'prohibir los vaqueros', 'regalar comida', 'encarcelar a Volkónov', 'destituir al mariscal', 'visitar Bonn', 'lanzar un misil', 'campos de trabajo', 'esperar'];
  for (let p = 0; p < 3; p++) {
    const e = nuevo(); mirar(RF.narrador.intro(e), 'intro'); let k = p;
    while (!e.fin && e.dia <= 28) {
      let d; while ((d = RF.director.pendiente(e))) { mirar([RF.narrador.dilema(e, d)], d.id); RF.director.resolver(e, (p + e.dia) % d.opciones.length); }
      if (e.fin) break;
      const t = ds[k++ % ds.length];
      if (t === 'esperar') { mirar(RF.narrador.cierreDia(e, RF.consejero.pasarTurno(e)), 'espera'); continue; }
      const i = RF.interprete.interpretarVarios(t, e).filter(x => x.estado === 'ok')[0];
      if (!i) { RF.consejero.pasarTurno(e); continue; }
      const r = (i.tipo === 'persona' ? RF.consejero.decretarPersona : RF.consejero.decretar)(e, i);
      if (r.nulo) { RF.consejero.pasarTurno(e); continue; }
      mirar(RF.narrador.decreto(e, i, r).concat(RF.narrador.cierreDia(e, r)), t);
    }
    mirar(RF.narrador.estadoPais(e), 'estado'); mirar(RF.narrador.gabinete(e), 'gabinete'); if (e.fin) mirar(RF.narrador.final(e), 'final');
  }
  comprobar(!fugas.length, 'tres partidas enteras sin un solo texto de Corea del Norte' + (fugas.length ? ': ' + fugas.slice(0, 3).join(' | ') : ''));
}

console.log('LA IA SABE DÓNDE Y CUÁNDO ESTÁ');
{
  const e = nuevo(); e.dia = 5;
  const ctx = RF.consejoIA.contexto(e, 'abrir la prensa');
  comprobar(RF.consejoIA.SISTEMA.includes('Consola del Kremlin') && RF.consejoIA.SISTEMA.includes('"europa"') && !RF.consejoIA.SISTEMA.includes('Consola de Pionyang'), 'el Consejo recibe las reglas de la URSS');
  comprobar(ctx.escenario && ctx.escenario.fecha === 'marzo de 1986' && ctx.escenario.turnos_restantes === 23, 'y la fecha, el objetivo y los turnos que quedan');
  comprobar(RF.narradorIA.SISTEMA.includes('abuela Zina') && RF.narradorIA.SISTEMA.includes('camarada Secretario General'), 'el cronista conoce a la gente de la URSS');
}

console.log(fallos ? fallos + ' comprobaciones fallidas' : 'Todo bien');
process.exit(fallos ? 1 : 0);
