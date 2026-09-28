/*
 * DIPLOMACIA
 * Relaciones (0-100) con las potencias que rodean al país (las define su perfil en datos/paises.js).
 * Cada una quiere algo y teme algo; sus relaciones cambian con tus decretos, los eventos y la IA,
 * y cada turno tienen consecuencias:
 *   China           comercio (divisas) y petróleo: si se enfada, corta el oleoducto y suben los precios
 *   Estados Unidos  las sanciones: si te odia, las endurece; si te aprecia, las alivia
 *   Corea del Sur   ayuda humanitaria (y series del Sur que se cuelan)
 *   Japón           algo de ayuda si las relaciones son buenas
 * También se decreta diplomacia directamente: "negociar con Estados Unidos", "insultar a Japón", "pedir ayuda a China".
 */
(function (RF) {
  'use strict';
  const T = RF.texto;

  function paises() { return RF.PAIS.relaciones || {}; }

  function iniciar(e) {
    if (!e.diplomacia) {
      e.diplomacia = { arsenal: !!(RF.PAIS.inicio.arsenal), relaciones: {} };
      for (const [id, p] of Object.entries(paises())) e.diplomacia.relaciones[id] = p.inicio;
    }
    return e.diplomacia;
  }

  function rel(e, id) { return iniciar(e).relaciones[id]; }

  const PLURAL = { hostil: 'hostiles', 'fría': 'frías', tensa: 'tensas', cordial: 'cordiales', aliada: 'de alianza' };
  function etiqueta(v) { return v < 20 ? 'hostil' : v < 40 ? 'fría' : v < 60 ? 'tensa' : v < 80 ? 'cordial' : 'aliada'; }

  // Cambia relaciones ({ eeuu: -10, china: 5 }). Devuelve { id: cambio real }.
  function ajustar(e, cambios, notas) {
    const D = iniciar(e);
    const hecho = {};
    for (const [id, v] of Object.entries(cambios || {})) {
      if (!(id in D.relaciones) || !v) continue;
      const antes = D.relaciones[id];
      D.relaciones[id] = Math.max(0, Math.min(100, Math.round(antes + v)));
      const d = D.relaciones[id] - antes;
      if (!d) continue;
      hecho[id] = d;
      if (notas && etiqueta(antes) !== etiqueta(D.relaciones[id])) notas.push('Las relaciones con ' + paises()[id].nombre + ' pasan a ser ' + PLURAL[etiqueta(D.relaciones[id])] + '.');
    }
    return hecho;
  }

  // ¿A qué país se refiere el texto? (normalizado)
  function buscar(n) {
    for (const [id, p] of Object.entries(paises())) if (p.claves.test(n)) return id;
    return null;
  }

  const AMISTAD = /\b(negoci\w*|dialog\w*|acerc\w*|reuni\w*|visit\w*|viaj\w* a|cumbre|acuerdo|pact\w*|alian\w*|aliar\w*|amist\w*|comerci\w*|relaciones con|embajad\w*|regal\w*|halag\w*|felicit\w*|disculp\w*|perdon|pedir ayuda|pedirle ayuda|ayuda de|cooper\w*|tender la mano|hacer las paces|reconcili\w*|invit\w*)\b/;
  const HOSTIL = /\b(insult\w*|amenaz\w*|romper relaciones|romper con|cortar relaciones|expuls\w*|provoc\w*|desafi\w*|burl\w*|humill\w*|boicot\w*|cerrar la frontera|espi\w*|hacke\w*|ciberataque\w*|secuestr\w*|odi\w*|enfrent\w*|denunci\w*|maldec\w*|escup\w*|ignor\w*)\b/;

  // Un decreto diplomático: { pais, dir: 'amistad' | 'hostil' }, o null.
  function detectar(n) {
    const pais = buscar(n);
    if (!pais) return null;
    if (HOSTIL.test(n)) return { pais, dir: 'hostil' };
    if (AMISTAD.test(n)) return { pais, dir: 'amistad' };
    return null;
  }

  /*
   * Qué produce un gesto diplomático. Lo ganado rinde menos cuanto mejor es ya la relación.
   * Devuelve { medida, texto, efectos, relaciones, sanciones, notas }.
   */
  function gesto(e, pais, dir) {
    const P = paises()[pais];
    const G = P.gestos[dir];
    const actual = rel(e, pais);
    const factor = dir === 'amistad' ? Math.max(0.35, 1 - actual / 110) : 1;
    const relaciones = {};
    for (const [id, v] of Object.entries(G.relaciones)) relaciones[id] = Math.round(v * (id === pais ? factor : 1));
    const notas = [];
    if (dir === 'amistad' && factor < 0.6) notas.push('Las relaciones con ' + P.nombre + ' ya son buenas: cada gesto rinde menos.');
    return { medida: T.expandir(G.medida), texto: T.expandir(T.azar(G.textos)), efectos: Object.assign({}, G.efectos), relaciones, sanciones: G.sanciones || 0, notas };
  }

  // Lo que hacen las potencias cada turno. Devuelve cambios para la economía del turno y deja sucesos en res.
  function turno(e, res) {
    const D = iniciar(e);
    const out = { dinero: 0, inflacion: 0, felicidad: 0, elite: 0 };
    const causas = res.causas || [];
    // Las relaciones vuelven poco a poco a su punto de partida: la memoria diplomática es corta.
    for (const [id, p] of Object.entries(paises())) D.relaciones[id] += Math.sign(p.base - D.relaciones[id]) * Math.min(1, Math.abs(p.base - D.relaciones[id]) * 0.05) || 0;
    for (const id of Object.keys(D.relaciones)) D.relaciones[id] = Math.round(D.relaciones[id] * 10) / 10;
    const r = D.relaciones;
    const ec = RF.consejero.asegurar(e).economia;

    if ('china' in r) {
      out.dinero += (r.china - 50) * 0.1;
      if (r.china < 25) { out.inflacion += 1.5; out.dinero -= 2; causas.push('China ha cerrado el oleoducto "por mantenimiento": falta petróleo y suben los precios.'); }
    }
    if ('surcorea' in r && r.surcorea >= 60) { out.dinero += 2; out.felicidad += 0.4; out.elite -= 0.2; causas.push('Llega ayuda humanitaria del Sur. Con los sacos de arroz se cuelan memorias USB.'); }
    if ('japon' in r && r.japon >= 60) out.dinero += 1;

    if ('eeuu' in r) {
      const reg = {};
      if (r.eeuu < 15 && ec.sanciones < 4 && Math.random() < 0.12) {
        RF.consejero.ajustarEconomia(e, { sanciones: 1 });
        res.sucesos.push({ tipo: 'diplomacia', titulo: 'Washington endurece las sanciones', texto: T.expandir('El Departamento del Tesoro congela cuentas de tres bancos chinos que trabajaban para ti. {montiel} tarda una tarde entera en encontrar otro. Las sanciones suben de nivel.'), deltas: reg });
      } else if (r.eeuu >= 65 && ec.sanciones > 0 && Math.random() < 0.2) {
        RF.consejero.ajustarEconomia(e, { sanciones: -1 });
        res.sucesos.push({ tipo: 'diplomacia', titulo: 'Se alivian las sanciones', texto: 'Washington levanta la prohibición de importar maquinaria agrícola "como gesto de buena voluntad". En el puerto de Nampo descargan tractores de verdad.', deltas: reg });
      }
    }
    return out;
  }

  // Las consecuencias diplomáticas de algunos temas duros, según a quién apunten ("lanzar un misil a Japón").
  function objetivo(textoNorm) { return buscar(textoNorm); }

  function resumen(e) {
    const D = iniciar(e);
    const lineas = [];
    for (const [id, p] of Object.entries(paises())) {
      const v = Math.round(D.relaciones[id]);
      lineas.push((p.nombre + '               ').slice(0, 15) + String(v).padStart(3) + '  ' + etiqueta(v));
      lineas.push('   quiere: ' + p.quiere);
      lineas.push('   teme:   ' + p.teme);
    }
    lineas.push('', 'Arsenal nuclear: ' + (D.arsenal ? 'sí (heredado de tu padre)' : 'desmantelado'));
    lineas.push('Sanciones: nivel ' + RF.consejero.asegurar(e).economia.sanciones + ' de 4');
    lineas.push('', 'Decretos de ejemplo: "negociar con Estados Unidos", "pedir ayuda a China", "visitar Seúl", "insultar a Japón", "desmantelar las armas nucleares".');
    return lineas.join('\n');
  }

  // Para la IA y la crónica: una línea por país.
  function paraIA(e) {
    const D = iniciar(e);
    const out = {};
    for (const [id, p] of Object.entries(paises())) out[id] = Math.round(D.relaciones[id]) + ' (' + etiqueta(D.relaciones[id]) + '). Quiere: ' + p.quiere + '. Teme: ' + p.teme + '.';
    out.arsenal_nuclear = D.arsenal ? 'sí' : 'desmantelado';
    return out;
  }

  RF.diplomacia = { iniciar, rel, etiqueta, ajustar, detectar, buscar, gesto, turno, objetivo, resumen, paraIA };
})(globalThis.RF = globalThis.RF || {});
