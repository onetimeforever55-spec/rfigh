/*
 * LAS LEYES VIGENTES
 * Cada decreto se convierte en una ley que sigue actuando TODOS los turnos hasta que se derogue.
 * Así los decretos se acumulan: si vendes el aire y además vendes cocaína, cada turno cobras las dos cosas
 * y pagas las consecuencias de las dos.
 *
 * Una ley tiene:
 *   inicial    efectos de una sola vez al firmarla
 *   porTurno   efectos cada turno: dinero (millones), estabilidad, felicidad e inflacion (presión sobre los precios)
 *   curvas     cómo cambia cada efecto con el tiempo:
 *                acostumbra  lo bueno se nota cada vez menos (la gente se acostumbra a los regalos)
 *                desgasta    la represión rinde cada vez menos y el rencor que provoca crece
 *                madura      las inversiones tardan unos turnos en dar fruto
 *   nivel      repetir el mismo decreto lo refuerza (máximo 3), con rendimientos decrecientes
 */
(function (RF) {
  'use strict';
  const T = RF.texto;
  const NIVEL = [0, 1, 1.7, 2.2];

  const CURVAS = {
    acostumbra: (v, edad) => (v > 0 ? Math.max(0.35, 1 - 0.08 * edad) : 1),
    desgasta: (v, edad) => (v > 0 ? Math.max(0.4, 1 - 0.07 * edad) : Math.min(1.6, 1 + 0.05 * edad)),
    madura: (v, edad) => (v > 0 ? (edad < 2 ? 0 : Math.min(1, (edad - 1) / 3)) : 1),
    lenta: (v, edad) => (v > 0 ? (edad < 3 ? 0 : Math.min(1, (edad - 2) / 6)) : 1)
  };

  const CREAN = ['CREAR', 'INVERTIR', 'OBLIGAR', 'GLORIFICAR', 'SUBSIDIAR', 'LEGALIZAR', 'ENFOCAR'];
  const DISUELVEN = ['PROHIBIR', 'RECORTAR', 'CASTIGAR', 'PRIVATIZAR'];

  function objeto(objId) { return objId === 'OTRO' ? RF.OBJETO_OTRO : RF.OBJETOS[objId] || RF.OBJETO_OTRO; }

  /*
   * La lógica de cada decreto. Devuelve la ley que crea, o { derogar: clave } si el decreto quita una ley,
   * o { unaVez: true } si solo tiene efectos inmediatos.
   */
  function definir(accion, objId, nombre) {
    const o = objeto(objId);
    const E = o.esencial || 0, R = o.rentable || 0, L = o.libertad || 0, P = o.popular || 0;
    const V = o.vicio ? 1 : 0, G = o.gente ? 1 : 0;
    const ley = { clave: objId === 'OTRO' ? 'OTRO:' + nombre : objId, porTurno: {}, inicial: {}, curvas: {}, notas: [] };
    const pt = (k, v) => { if (v) ley.porTurno[k] = (ley.porTurno[k] || 0) + v; };
    const ini = (k, v) => { if (v) ley.inicial[k] = (ley.inicial[k] || 0) + v; };

    if (accion === 'DEROGAR') return { derogar: objId === 'ULTIMA' ? 'ULTIMA' : ley.clave };

    // Instituciones del régimen: se crean o se disuelven.
    if (o.institucion) {
      const inst = RF.INSTITUCIONES[objId];
      if (DISUELVEN.includes(accion)) return { derogar: ley.clave };
      if (!CREAN.includes(accion)) return null;
      const c = RF.consejero.convertir(inst.crear);
      const d = RF.consejero.convertir(inst.diario);
      Object.assign(ley.inicial, c);
      Object.assign(ley.porTurno, d);
      pt('dinero', -3 * inst.coste);
      ley.curvas = { estabilidad: 'desgasta', felicidad: 'desgasta' };
      ley.texto = T.expandir(inst.texto);
      ley.institucion = true;
      return ley;
    }

    // El dinero: imprimir, dolarizar, devaluar.
    if (objId === 'DINERO') {
      if (['CREAR', 'SUBSIDIAR', 'INVERTIR', 'OBLIGAR'].includes(accion)) {
        ini('dinero', 10);
        pt('dinero', 25); pt('inflacion', 6);
        ley.imprime = true;
        ley.nombre = 'la impresión de dinero';
        ley.notas.push('Cada turno entrarán 25 millones recién impresos... y los precios subirán.');
        return ley;
      }
      if (accion === 'PROHIBIR' || accion === 'PRIVATIZAR') {
        ini('felicidad', -3); ini('estabilidad', 2);
        pt('inflacion', -4); pt('dinero', -3); pt('felicidad', -0.2);
        ley.notas.push('Adiós al won: la inflación irá bajando, pero ya no podrás imprimir dinero.');
        ley.dolariza = true;
        ley.nombre = 'la dolarización';
        return ley;
      }
      if (accion === 'RECORTAR' || accion === 'BAJAR_IMPUESTO') {
        return { unaVez: true, nombre: 'la devaluación del won', inicial: { dinero: 25, inflacion: 12, felicidad: -3 }, notas: ['El won pierde un tercio de su valor: entra dinero ahora, pero todo cuesta más.'] };
      }
    }

    // Reconvertir toda la economía: solo puede haber un modelo a la vez.
    if (accion === 'ENFOCAR') {
      const sector = RF.SECTOR_AMPLIO[objId] || 'exotico';
      const m = RF.MODELOS[sector];
      ley.clave = 'MODELO';
      ley.modelo = sector;
      ley.nombre = 'la economía basada en ' + (m.nombre || nombre);
      ini('dinero', -20); ini('felicidad', -3); ini('estabilidad', -2);
      Object.assign(ley.porTurno, m.porTurno);
      ley.curvas = { dinero: m.lenta ? 'lenta' : 'madura' };
      ley.notas.push(m.nota);
      return ley;
    }

    switch (accion) {
      case 'PRIVATIZAR': // vender o cobrar por algo
        if (objId === 'NARCO') {
          ini('dinero', 10);
          pt('dinero', 18); pt('estabilidad', -1.5); pt('felicidad', -0.5);
          break;
        }
        ini('dinero', 15 + 10 * R); ini('felicidad', -(2 + 2 * E));
        pt('dinero', 2 + 3 * E + 2 * R);
        pt('felicidad', -(0.3 + 0.6 * E));
        pt('estabilidad', -0.3 * E);
        break;

      case 'NACIONALIZAR':
        ini('dinero', -(10 + 5 * R)); ini('estabilidad', -(1 + R));
        pt('dinero', 2 + 3 * R); pt('felicidad', 0.3); pt('estabilidad', -0.2 * R);
        ley.curvas = { dinero: 'madura' };
        break;

      case 'PROHIBIR':
        if (objId === 'NARCO') {
          ini('estabilidad', -3);
          pt('estabilidad', -0.8); pt('felicidad', 0.3);
          ley.curvas = { estabilidad: 'acostumbra' };
          ley.notas.push('Los cárteles no se rinden sin pelear: la violencia tardará en bajar.');
          break;
        }
        ini('estabilidad', 1); ini('felicidad', -(2 + 3 * P + 2 * L));
        pt('felicidad', -(0.3 + 0.6 * P + 0.5 * L));
        pt('estabilidad', -(0.4 * P + 0.5 * V) + (L >= 2 ? 0.3 : 0));
        pt('dinero', -(1.5 * R + 2 * V));
        if (V || P >= 2) ley.notas.push('Lo prohibido no desaparece: se va a la clandestinidad.');
        break;

      case 'OBLIGAR':
        if (objId === 'EJERCITO') { ini('felicidad', -4); ini('ejercito', 4); pt('ejercito', 0.5); pt('estabilidad', 0.4); pt('felicidad', -0.8); pt('dinero', -3); break; }
        ini('felicidad', -(3 + 2 * L));
        pt('felicidad', -(0.4 + 0.4 * L)); pt('estabilidad', 0.3); pt('dinero', R);
        break;

      case 'SUBSIDIAR': // regalar, subvencionar, subir sueldos
        if (o.faccion === 'ejercito') { ini('ejercito', 10); pt('ejercito', 1.2); pt('estabilidad', 0.2); pt('dinero', -6); ley.curvas = { ejercito: 'acostumbra' }; break; }
        ini('felicidad', 3 + 2 * E + P);
        pt('dinero', -(2 + 2.5 * E + 2 * G));
        pt('felicidad', 0.8 + 0.6 * E + 0.3 * P);
        pt('estabilidad', 0.2);
        pt('inflacion', 0.3 * E);
        ley.curvas = { felicidad: 'acostumbra' };
        break;

      case 'SUBIR_IMPUESTO':
        if (o.faccion === 'cupula') {
          ini('felicidad', 2);
          pt('dinero', 8 + 2 * R); pt('felicidad', 0.2); pt('elite', -1.2);
        } else if (objId === 'GENERAL') {
          ini('felicidad', -3);
          pt('dinero', 12); pt('felicidad', -1.2); pt('estabilidad', -0.3);
        } else {
          ini('felicidad', -(1 + E));
          pt('dinero', 4 + 3 * R); pt('felicidad', -(0.3 + 0.6 * E + 0.3 * P)); pt('estabilidad', -0.2);
        }
        pt('inflacion', -0.3);
        break;

      case 'BAJAR_IMPUESTO':
        if (o.faccion === 'cupula') {
          pt('dinero', -(8 + 2 * R)); pt('elite', 1.2); pt('felicidad', -0.2);
        } else if (objId === 'GENERAL') {
          ini('felicidad', 3);
          pt('dinero', -12); pt('felicidad', 1.2);
        } else {
          ini('felicidad', 1 + E);
          pt('dinero', -(4 + 3 * R)); pt('felicidad', 0.4 + 0.5 * E);
        }
        pt('inflacion', 0.3);
        ley.curvas = { felicidad: 'acostumbra' };
        break;

      case 'CASTIGAR': // represión o mano dura
        if (!G) { ini('felicidad', -2); pt('felicidad', -0.4); pt('estabilidad', 0.2); break; }
        if (o.afecta === 'orden') { // contra el crimen: la gente lo aplaude al principio
          ini('estabilidad', 3); ini('felicidad', 2);
          pt('estabilidad', 1); pt('felicidad', 0.3); pt('dinero', -3);
        } else {
          ini('estabilidad', 3); ini('felicidad', -3);
          pt('estabilidad', 1.2); pt('felicidad', -(0.6 + 0.4 * L)); pt('dinero', -2);
        }
        ley.curvas = { estabilidad: 'desgasta', felicidad: 'desgasta' };
        break;

      case 'LEGALIZAR':
        if (objId === 'NARCO') { ini('dinero', 5); pt('dinero', 10); pt('estabilidad', -0.6); pt('felicidad', -0.3); break; }
        if (o.afecta === 'orden' && G) { ini('felicidad', -4); pt('estabilidad', -2); pt('felicidad', -1); break; }
        if (G) { ini('felicidad', 3); ini('estabilidad', -2); pt('felicidad', 0.3); pt('estabilidad', 0.2); ley.curvas = { felicidad: 'acostumbra' }; break; }
        ini('felicidad', 2 + 2 * P + L);
        pt('felicidad', 0.3 + 0.3 * P);
        if (V) { pt('dinero', 4); pt('estabilidad', 0.3); }
        ley.curvas = { felicidad: 'acostumbra' };
        break;

      case 'CREAR':
      case 'INVERTIR':
        if (o.faccion === 'ejercito') { ini('dinero', -20); ini('ejercito', 8); pt('ejercito', 0.8); pt('dinero', -3); break; }
        ini('dinero', -(25 + 10 * E));
        pt('dinero', 3 + 2 * R + E); pt('felicidad', 0.4 + 0.3 * E); pt('estabilidad', 0.2);
        ley.curvas = { dinero: 'madura', felicidad: 'madura', estabilidad: 'madura' };
        ley.notas.push('Las obras tardan: los beneficios llegarán dentro de unos turnos.');
        break;

      case 'RECORTAR':
        if (o.faccion === 'ejercito') { ini('ejercito', -12); pt('dinero', 6); pt('ejercito', -1.2); break; }
        pt('dinero', 4 + 3 * E); pt('felicidad', -(0.4 + 0.7 * E)); pt('estabilidad', -(0.2 + 0.3 * E));
        pt('inflacion', -0.4);
        break;

      case 'GLORIFICAR':
        ini('dinero', -15); ini('felicidad', -1);
        pt('dinero', -1);
        if (o.faccion === 'ejercito') { pt('ejercito', 1); pt('estabilidad', 0.2); } else pt('estabilidad', o.afecta === 'orden' ? 0.6 : 0.4);
        pt('felicidad', -0.2);
        break;

      default:
        return null;
    }
    return ley;
  }

  function lista(e) { if (!e.leyes) e.leyes = []; return e.leyes; }

  /*
   * Un tema duro (datos/temas.js). LEGALIZAR = a favor, PROHIBIR = en contra, PRIVATIZAR = su variante privada.
   * Ir "en contra" de algo que nunca estuvo a favor (abolir la esclavitud en un país sin esclavitud) usa "sinLey".
   */
  function definirTema(e, objId, accion) {
    const t = RF.TEMAS[objId];
    const dir = accion === 'PROHIBIR' ? 'contra' : accion === 'PRIVATIZAR' && t.privada ? 'privada' : 'favor';
    const vigente = lista(e).find(l => l.clave === 'TEMA:' + objId);
    // El arsenal heredado cuenta como "algo que desmantelar" aunque no haya ley.
    const heredado = objId === 'NUCLEAR' && e.diplomacia && e.diplomacia.arsenal;
    const d = dir === 'contra' && t.sinLey && !heredado && !(vigente && vigente.accion !== 'PROHIBIR') ? Object.assign({ nombre: t.contra.nombre }, t.sinLey) : t[dir];
    const prensa = d.prensa || (d.controversia >= 3 ? 'represion' : d.controversia === 2 ? 'libertad' : dir === 'contra' ? 'regalo' : 'general');
    if (d.unaVez) return { unaVez: true, nombre: d.nombre, inicial: Object.assign({}, d.inicial), notas: (d.notas || []).slice(), prensa, controversia: 0, economia: d.economia, relaciones: d.relaciones };
    return {
      clave: 'TEMA:' + objId, nombre: d.nombre, tema: objId, prensa,
      inicial: Object.assign({}, d.inicial), porTurno: Object.assign({}, d.porTurno), curvas: Object.assign({}, d.curvas),
      notas: (d.notas || []).slice(), texto: d.texto ? T.expandir(d.texto) : '', programar: d.programar || [], controversia: d.controversia || 0,
      economia: d.economia || null, // sanciones y mercado negro
      relaciones: d.relaciones || null // con las potencias vecinas
    };
  }

  // Firma una ley: si ya había una sobre lo mismo, la refuerza (misma acción) o la sustituye (otra acción).
  function promulgar(e, ley, accion, nombre) {
    const leyes = lista(e);
    const previa = leyes.find(l => l.clave === ley.clave);
    const out = { notas: [], inicial: Object.assign({}, ley.inicial), sustituye: null, refuerza: false };
    if (previa && previa.accion === accion && previa.nombre === nombre) {
      if (previa.nivel >= 3) {
        out.notas.push('Esa ley ya está al máximo. Repetirla no cambia nada.');
        for (const k of Object.keys(out.inicial)) out.inicial[k] = 0;
        out.ley = previa;
        return out;
      }
      previa.nivel++;
      for (const k of Object.keys(out.inicial)) out.inicial[k] = out.inicial[k] / 2;
      out.notas.push('Refuerzas una ley que ya existía (nivel ' + previa.nivel + '). Cada refuerzo rinde menos que el anterior.');
      out.refuerza = true;
      out.ley = previa;
      return out;
    }
    if (previa) {
      leyes.splice(leyes.indexOf(previa), 1);
      out.sustituye = previa;
      out.notas.push('Esta ley sustituye a la anterior: ' + previa.nombre + '.');
    }
    const nueva = {
      clave: ley.clave, accion, nombre, desde: e.dia, nivel: 1, factor: 1,
      porTurno: ley.porTurno, curvas: ley.curvas || {}, duracion: ley.duracion || null,
      imprime: !!ley.imprime, dolariza: !!ley.dolariza, modelo: ley.modelo || null, institucion: !!ley.institucion, secreta: !!ley.secreta
    };
    // Dolarizar impide imprimir; imprimir con el dólar es imposible.
    if (nueva.dolariza) { const imp = leyes.find(l => l.imprime); if (imp) leyes.splice(leyes.indexOf(imp), 1); }
    leyes.push(nueva);
    out.ley = nueva;
    return out;
  }

  // Quita una ley. Retirar algo bueno duele; retirar algo malo alivia.
  function derogar(e, clave) {
    const leyes = lista(e);
    const ley = clave === 'ULTIMA' ? leyes[leyes.length - 1] : leyes.find(l => l.clave === clave);
    if (!ley) return null;
    leyes.splice(leyes.indexOf(ley), 1);
    const fel = efectoActual(e, ley).felicidad || 0;
    const est = efectoActual(e, ley).estabilidad || 0;
    const choque = {};
    if (fel > 0) choque.felicidad = -Math.round(fel * 3); else if (fel < 0) choque.felicidad = Math.round(-fel * 2);
    if (est > 0 && ley.accion === 'CASTIGAR') choque.estabilidad = -Math.round(est * 2);
    return { ley, choque };
  }

  // Efecto de una ley en este turno, con su nivel, su edad y la situación del país.
  function esRepresion(ley) { return ley.accion === 'CASTIGAR' || ['ESCUADRON', 'MILICIA', 'ESPIAS'].includes(ley.clave); }

  function efectoActual(e, ley) {
    const edad = e.dia - ley.desde;
    const out = {};
    for (const [k, base] of Object.entries(ley.porTurno)) {
      let v = base * NIVEL[ley.nivel] * (ley.factor || 1);
      if (k === 'inflacion' && ley.imprime && ley.nivel > 1) v *= 1 + 0.4 * (ley.nivel - 1); // imprimir más dispara los precios más que proporcionalmente
      const curva = ley.curvas[k];
      if (curva) v *= CURVAS[curva](v, edad);
      if (k === 'dinero') {
        if (v < 0) v *= 1 + e.stats.inflacion / 100; // la inflación encarece los gastos
        else if (!ley.imprime) v *= Math.max(0.5, Math.min(1.2, 0.5 + e.stats.estabilidad / 120)) * Math.max(0.4, 1 - e.stats.inflacion / 250); // el caos y la inflación se comen los ingresos
      }
      // El régimen político: cómo se recauda, cuánto se invierte y cuánto rinde la represión.
      const m = RF.politica && e.politica ? RF.politica.mods(e) : null;
      if (m) {
        if (k === 'dinero' && v > 0 && !ley.imprime) v *= ley.accion === 'SUBIR_IMPUESTO' ? m.recaudacion : m.inversion;
        if (esRepresion(ley)) {
          if (k === 'estabilidad' && v > 0) v *= m.represionEstab;
          if (k === 'felicidad' && v < 0) v *= m.represionFel;
        }
      }
      out[k] = v;
    }
    return out;
  }

  // Lo que hará una ley cada turno "en régimen": sin curvas ni situación del país (para contárselo al jugador).
  function efectoNominal(ley) {
    const out = {};
    for (const [k, base] of Object.entries(ley.porTurno)) {
      let v = base * NIVEL[ley.nivel] * (ley.factor || 1);
      if (k === 'inflacion' && ley.imprime && ley.nivel > 1) v *= 1 + 0.4 * (ley.nivel - 1);
      out[k] = v;
    }
    return out;
  }

  // Los efectos de todas las leyes en un turno. Devuelve la lista detallada y los totales.
  function turno(e) {
    const leyes = lista(e);
    const detalle = [];
    const total = { dinero: 0, estabilidad: 0, felicidad: 0, inflacion: 0, ejercito: 0, elite: 0 };
    for (const ley of leyes.slice()) {
      const ef = efectoActual(e, ley);
      detalle.push({ nombre: ley.nombre, clave: ley.clave, nivel: ley.nivel, efectos: ef });
      for (const [k, v] of Object.entries(ef)) total[k] += v;
      if (ley.duracion && e.dia - ley.desde >= ley.duracion) leyes.splice(leyes.indexOf(ley), 1);
    }
    return { detalle, total };
  }

  function resumenLey(ef) {
    const f = (v, suf) => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) < 10 && suf !== 'M' ? 1 : 0) + suf;
    const partes = [];
    if (Math.abs(ef.dinero || 0) >= 0.5) partes.push(f(ef.dinero, 'M'));
    if (Math.abs(ef.estabilidad || 0) >= 0.05) partes.push('estab ' + f(ef.estabilidad, ''));
    if (Math.abs(ef.felicidad || 0) >= 0.05) partes.push('población ' + f(ef.felicidad, ''));
    if (Math.abs(ef.inflacion || 0) >= 0.05) partes.push('infl ' + f(ef.inflacion, ''));
    if (Math.abs(ef.ejercito || 0) >= 0.05) partes.push('ejército ' + f(ef.ejercito, ''));
    if (Math.abs(ef.elite || 0) >= 0.05) partes.push('palacio ' + f(ef.elite, ''));
    return partes.join('  ') || 'sin efecto este turno';
  }

  RF.leyes = { definir, definirTema, promulgar, derogar, turno, efectoActual, efectoNominal, resumenLey, lista, CURVAS };
})(globalThis.RF = globalThis.RF || {});
