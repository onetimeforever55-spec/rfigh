/*
 * ESCENARIOS
 * Cada escenario es un momento (real o de hoy) con su país, su fecha de inicio, su objetivo y su final:
 *   pais        qué perfil de datos/paises.js (o del paquete de ese país) se usa
 *   calendario  { anio, mes (0-11), mesesPorTurno }: cada turno avanza el reloj
 *   turnos      cuántos turnos dura (null: partida libre, sin final)
 *   objetivo    { texto, evaluar(e) → { ganado, titulo, texto } } al acabar el último turno
 *   historia    lo que pasará sí o sí: [{ turno, dilema }] (decisión) o [{ turno, noticia }] (suceso)
 *   real        lo que pasó de verdad, para compararlo al final
 *   comparar(e) frases que comparan lo que hiciste con lo que pasó
 * El escenario elegido se guarda en el navegador; al cambiarlo, la página se recarga con el nuevo país
 * (muchos módulos leen el perfil del país al cargar).
 */
(function (RF) {
  'use strict';
  const CLAVE = 'consola.escenario';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  RF.ESCENARIOS = Object.assign({
    corea: {
      id: 'corea', pais: 'corea', nombre: 'Corea del Norte, hoy', subtitulo: 'Partida libre',
      resumen: 'Heredas el poder de tu padre en el país más aislado del mundo. Sin último turno: gobiernas mientras aguantes.',
      calendario: null, turnos: null
    }
  }, RF.ESCENARIOS || {});

  function leer() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }

  const elegido = RF.ESCENARIOS[leer()] ? leer() : 'corea';
  RF.ESCENARIO = RF.ESCENARIOS[elegido];
  RF.PAIS = RF.PAISES[RF.ESCENARIO.pais] || RF.PAISES.corea;
  // El paquete del país cambia ministros, gente de a pie, eventos, radio y finales.
  if (RF.PAQUETES && RF.PAQUETES[RF.PAIS.id]) RF.PAQUETES[RF.PAIS.id]();

  function fecha(dia, corto) {
    const c = RF.ESCENARIO.calendario;
    if (!c) return null;
    const m = c.mes + (dia - 1) * c.mesesPorTurno;
    const anio = c.anio + Math.floor(m / 12), mes = MESES[((m % 12) + 12) % 12];
    return corto ? mes.slice(0, 3).toUpperCase() + ' ' + anio : mes + ' de ' + anio;
  }

  // Al empezar: lo que la historia tiene preparado entra en la agenda.
  function preparar(estado) {
    const E = RF.ESCENARIO;
    estado.escenario = E.id;
    for (const h of E.historia || []) {
      if (h.dilema) estado.dilemas.cadena.push({ id: h.dilema, dia: h.turno });
      if (h.noticia) estado.pendientes.push(Object.assign({}, h.noticia, { dia: h.turno }));
    }
  }

  // Tras cada turno: ¿se acabó el escenario?
  function comprobar(estado) {
    const E = RF.ESCENARIO;
    if (!E.turnos || estado.fin || estado.dia <= E.turnos) return null;
    const r = E.objetivo.evaluar(estado);
    estado.resultadoEscenario = r;
    return r.ganado ? 'victoria' : 'objetivo_fallido';
  }

  function turnosRestantes(estado) {
    const E = RF.ESCENARIO;
    return E.turnos ? Math.max(0, E.turnos - estado.dia + 1) : null;
  }

  // Cambiar de escenario: se guarda y la página se recarga con el nuevo país.
  function elegir(id) {
    if (!RF.ESCENARIOS[id]) return false;
    try { localStorage.setItem(CLAVE, id); } catch (e) { return false; }
    return true;
  }

  // Lo que se le dice a la IA para que la partida respete la época y el objetivo.
  function paraIA(estado) {
    const E = RF.ESCENARIO;
    if (!E.calendario) return null;
    return { nombre: E.nombre, fecha: fecha(estado.dia), objetivo: E.objetivo ? E.objetivo.texto : null, turnos_restantes: turnosRestantes(estado),
      nota: 'Respeta la época: no existe nada posterior a esta fecha (ni internet ni móviles antes de los noventa). Los hechos históricos reales pueden cambiar por las decisiones del jugador.' };
  }

  // Cambia en un texto lo que es de Corea del Norte por lo del país actual (wones → rublos...).
  function localizar(t) {
    if (!t || !RF.PAIS.reemplazos) return t;
    for (const [re, rep] of RF.PAIS.reemplazos) t = t.replace(re, rep);
    return t;
  }

  RF.escenario = { fecha, preparar, comprobar, turnosRestantes, elegir, paraIA, localizar, lista: () => Object.values(RF.ESCENARIOS), actual: () => RF.ESCENARIO, CLAVE };
})(globalThis.RF = globalThis.RF || {});
