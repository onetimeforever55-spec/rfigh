/*
 * POLÍTICAS ECONÓMICAS Y SOCIALES
 * Medidas clásicas de un régimen que el clasificador general no sabe tratar: control de precios,
 * racionamiento, reforma monetaria, la tierra (repartirla o colectivizarla) y el songbun.
 * Misma forma que los temas duros (datos/temas.js). Sus porqués salen de la biblioteca de conceptos.
 */
(function (RF) {
  'use strict';

  const POLITICAS = {
    CONTROL_PRECIOS: {
      nombre: 'los precios',
      re: /\b((congel\w*|fij\w*|top\w*|limit\w*|control\w*|baj\w*|liber\w*|soltar) (\w+ ){0,2}precios?|precios? (maximos?|oficiales?|justos?|topados?|congelados?)|control de precios)\b/,
      contraRe: /\b(liber\w*|soltar|desregul\w*|dej\w* de (controlar|congelar|fijar)|acab\w* con (el )?control)\b/,
      favor: {
        nombre: 'la congelación de precios', controversia: 0, prensa: 'regalo',
        inicial: { inflacion: -4, felicidad: 3 }, porTurno: { inflacion: -0.5, felicidad: -0.6 }, economia: { mercadoNegro: 10 },
        texto: 'El Estado fija el precio justo del arroz, el aceite y el jabón. Los precios justos se imprimen en carteles preciosos. Los productos, en cambio, desaparecen de las tiendas esa misma tarde.',
        programar: [{ en: 2, titulo: 'Las tiendas vacías', texto: 'Las tiendas del Estado tienen el arroz al precio oficial. Lo que no tienen es arroz. El arroz está en el mercado, al triple, y el vendedor lo llama "precio de patriota".', efectos: { felicidad: -4 } }]
      },
      contra: {
        nombre: 'la liberación de precios', controversia: 1, prensa: 'economia',
        inicial: { inflacion: 5, felicidad: -3 }, porTurno: { inflacion: 0.3, felicidad: 0.2 }, economia: { mercadoNegro: -8 },
        texto: 'Los precios quedan libres. El primer día suben todos. El segundo, por primera vez en años, hay arroz en las tiendas.'
      },
      sinLey: { unaVez: true, inicial: { inflacion: 2 }, notas: ['No había precios congelados: ya eran libres, aunque nadie lo dijera.'] }
    },

    RACIONAMIENTO: {
      nombre: 'el racionamiento',
      re: /\b(racion\w*|cartillas?|libretas? de abastecimiento|cupones? de comida|sistema publico de distribucion)\b/,
      contraRe: /\b(acab\w*|elimin\w*|quit\w*|abol\w*|suprim\w*|fin de|dej\w* de|sin)\b/,
      favor: {
        nombre: 'el racionamiento', controversia: 0, prensa: 'esencial',
        inicial: { felicidad: -3, inflacion: -2 }, porTurno: { dinero: -2, felicidad: -0.3, estabilidad: 0.2, inflacion: -0.4 }, economia: { mercadoNegro: 5 },
        texto: 'Cada familia recibe una cartilla: 400 gramos de cereal al día por persona, más si trabajas en el Partido, menos si tu abuelo estuvo en el bando equivocado. La cola empieza a las cinco de la mañana.'
      },
      contra: {
        nombre: 'el fin de las cartillas', controversia: 1,
        inicial: { felicidad: 1, inflacion: 3 }, porTurno: { dinero: 1 },
        texto: 'Se acaban las cartillas. Quien tiene dinero compra en el mercado; quien no, descubre que la cartilla era poco, pero era algo.'
      },
      sinLey: { unaVez: true, inicial: {}, notas: ['Las cartillas oficiales ya no llegaban a nadie fuera de Pionyang. Nadie nota la diferencia.'] }
    },

    REFORMA_MONETARIA: {
      nombre: 'la reforma monetaria',
      re: /\b((cambi\w*|canj\w*|sustitu\w*|renov\w*) (\w+ ){0,2}(billetes|moneda)|nueva moneda|nuevo won|quit\w* (los |tres |dos )?ceros|reforma monetaria|redenominaci\w*)\b/,
      no: /\b(bitcoin\w*|cripto\w*|dolar\w*|yuan\w*|euro\w*)\b/,
      contraRe: /\b(no cambiar|anular la reforma|volver (al|a los) (won|billetes) viejos?)\b/,
      favor: {
        nombre: 'la reforma monetaria', controversia: 1, unaVez: true, prensa: 'economia',
        inicial: { inflacion: -15, felicidad: -10, estabilidad: -5, elite: -5, dinero: 10 }, economia: { mercadoNegro: -15 },
        texto: 'Mañana circula el nuevo won, con dos ceros menos y tu cara en más grande. Cada familia puede cambiar como máximo cien mil wones viejos. El resto de sus ahorros sirve, a partir de hoy, para encender la estufa.',
        programar: [{ en: 2, titulo: 'La rabia de los ahorradores', texto: 'Las vendedoras del mercado, que guardaban sus ahorros en wones viejos, se plantan frente al edificio del Partido. Es la primera protesta en años. {sombra} no sabe si detenerlas o darles la razón.', efectos: { estabilidad: -4, felicidad: -3 } }]
      },
      contra: { nombre: 'la vuelta a la moneda de siempre', unaVez: true, inicial: { felicidad: 2 }, notas: ['Nadie había cambiado la moneda. El won de siempre sigue valiendo lo de siempre: poco.'] }
    },

    TIERRA: {
      nombre: 'la tierra',
      re: /\b(reforma agraria|repart\w* (\w+ ){0,2}tierras?|tierras? (a|para) (los |las )?(campesinos|familias)|parcelas? (familiares|privadas)|colectiviz\w*|granjas? colectivas?|comunas? (agricolas|populares)|cooperativas? agricolas?)\b/,
      contraRe: /\b(colectiviz\w*|granjas? colectivas?|comunas?|cooperativas? agricolas?)\b/,
      favor: {
        nombre: 'el reparto de tierras a las familias', controversia: 1, prensa: 'regalo',
        inicial: { felicidad: 5, elite: -4, estabilidad: -1 }, porTurno: { dinero: 1, felicidad: 0.5, inflacion: -0.6 }, curvas: { dinero: 'madura', inflacion: 'madura' },
        texto: 'Cada familia campesina recibe una parcela y puede vender lo que le sobre. El primer año nadie se lo cree y siembran poco, por si acaso. El segundo, las cosechas se duplican.'
      },
      contra: {
        nombre: 'la colectivización del campo', controversia: 1, prensa: 'culto',
        inicial: { estabilidad: 1, felicidad: -5, elite: 3 }, porTurno: { felicidad: -0.6, inflacion: 0.6, dinero: -1 },
        texto: 'Las parcelas pasan a las granjas colectivas. Los campesinos trabajan en brigadas, cantando, bajo la mirada de un cuadro del Partido que no ha sembrado nunca. Los informes de producción son excelentes. Las cosechas, no tanto.'
      }
    },

    SONGBUN: {
      nombre: 'el songbun',
      re: /\b(songbun|castas?|clases? sociales?|origen familiar|familias? (leales|hostiles))\b/,
      contraRe: /\b(abol\w*|elimin\w*|acab\w*|quit\w*|igual\w*|suprim\w*|derog\w*|fin (de|del)|romper)\b/,
      favor: {
        nombre: 'el endurecimiento del songbun', controversia: 2, prensa: 'libertad',
        inicial: { elite: 4, felicidad: -3, estabilidad: 1 }, porTurno: { felicidad: -0.3 },
        texto: 'Se revisan los expedientes de todas las familias hasta la tercera generación. Un nieto de un terrateniente de 1945 descubre que ya no puede estudiar medicina. Tampoco sabía que su abuelo tenía tierras.'
      },
      contra: {
        nombre: 'la abolición del songbun', controversia: 2, prensa: 'regalo',
        inicial: { felicidad: 6, elite: -8, estabilidad: -3 }, porTurno: { felicidad: 0.4 },
        texto: 'Se queman los expedientes de origen familiar. Por primera vez, un chico del campo puede pedir plaza en la universidad de Pionyang. Las familias de buen songbun miran sus privilegios como quien ve un helado derretirse.'
      }
    }
  };

  RF.TEMAS = Object.assign({}, POLITICAS, RF.TEMAS);
})(globalThis.RF = globalThis.RF || {});
