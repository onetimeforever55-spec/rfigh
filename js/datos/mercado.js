/*
 * MERCADO: los sectores de la economía de Valdoria.
 *   peso    parte de la economía (todos suman 100 al empezar)
 *   base    precio mundial "normal" (1 = normal; el narcotráfico paga mucho más)
 *   vol     cuánto se mueve el precio cada día
 *   sucio   cuánto contamina cada punto de peso
 *   empleo  cuánta gente emplea cada punto de peso
 *   dueno   privado | estado | extranjero | carteles
 */
(function (RF) {
  'use strict';

  RF.SECTORES = {
    agro: { nombre: 'Agricultura', detalle: 'plátano, café y cacao', peso: 26, base: 1, vol: 0.035, sucio: 0.5, empleo: 1.6, dueno: 'privado' },
    mineria: { nombre: 'Petróleo/minas', detalle: 'petróleo, oro y litio', peso: 14, base: 1, vol: 0.05, sucio: 2, empleo: 0.6, dueno: 'extranjero' },
    carbon: { nombre: 'Carbón', detalle: 'minas y centrales de carbón', peso: 4, base: 1.15, vol: 0.07, sucio: 3.2, empleo: 1.3, dueno: 'privado' },
    industria: { nombre: 'Industria', detalle: 'fábricas, acero y maquilas', peso: 14, base: 1, vol: 0.025, sucio: 1.5, empleo: 1.3, dueno: 'privado' },
    turismo: { nombre: 'Turismo', detalle: 'playas, hoteles y cruceros', peso: 10, base: 1, vol: 0.02, sucio: 0.3, empleo: 1.3, dueno: 'privado' },
    tecnologia: { nombre: 'Tecnología', detalle: 'software y centros de datos', peso: 3, base: 1.1, vol: 0.045, sucio: 0.2, empleo: 0.5, dueno: 'privado' },
    servicios: { nombre: 'Comercio', detalle: 'tiendas, bancos y mercados', peso: 29, base: 1, vol: 0.012, sucio: 0.2, empleo: 1.1, dueno: 'privado' },
    narco: { nombre: 'Narcotráfico', detalle: 'coca, rutas y lavado de dinero', peso: 0, base: 2.4, vol: 0.04, sucio: 0.6, empleo: 0.9, dueno: 'carteles', ilegal: true }
  };

  // Qué sector toca cada tema cuando decretas directamente sobre él ("invertir en la industria").
  RF.SECTOR_DIRECTO = { AGRO: 'agro', RECURSOS: 'mineria', CARBON: 'carbon', INDUSTRIA: 'industria', TURISMO: 'turismo', TECNOLOGIA: 'tecnologia', NARCO: 'narco' };
  // Para reconvertir la economía se aceptan también temas cercanos ("economía basada en el fútbol" = turismo).
  RF.SECTOR_AMPLIO = Object.assign({}, RF.SECTOR_DIRECTO, {
    COMIDA: 'agro', ENERGIA: 'mineria', EMPRESAS: 'industria', TRABAJADORES: 'industria', DIVERSION: 'turismo',
    AMBIENTE: 'turismo', CALENDARIO: 'turismo', INTERNET: 'tecnologia', EDUCACION: 'tecnologia', VICIOS: 'narco', CRIMEN: 'narco'
  });

  RF.DUENOS = { privado: 'privado', estado: 'estatal', extranjero: 'extranjero', carteles: 'cárteles' };

  // Noticias del mercado cuando un precio se dispara o se hunde.
  RF.NOTICIAS_MERCADO = {
    baja: [
      'El precio internacional de {sector} se desploma. En {capital}, los empresarios del sector se miran las manos.',
      'Crac en {sector}: los compradores extranjeros cancelan pedidos. Los almacenes se llenan de cosas que nadie quiere.',
      'Los mercados castigan {sector}. {cifuentes} llama tres veces a Palacio antes del desayuno.'
    ],
    sube: [
      'El precio de {sector} se dispara en los mercados internacionales. En Valdoria, los del sector abren champán.',
      'Bonanza en {sector}: los compradores hacen cola en el puerto. Por una vez, el mundo necesita algo de Valdoria.',
      'Récord histórico en {sector}. {paredes} ya prepara el titular: "El milagro valdoriano".'
    ],
    modelo: [
      'Valdoria ya es, oficialmente, un país de {sector}: más de la mitad de la economía gira alrededor de ello.',
      'La reconversión ha terminado. {Sector} domina la economía. El resto del país se adapta como puede.'
    ]
  };
})(globalThis.RF = globalThis.RF || {});
