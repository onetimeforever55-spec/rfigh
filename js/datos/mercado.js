/*
 * MODELOS ECONÓMICOS: qué pasa cuando reconviertes toda la economía hacia algo
 * ("quiero hacer un narcoestado", "toda la economía al carbón").
 * Efectos por turno cuando la reconversión ya está completa (tarda unos turnos en madurar).
 *   dinero       millones que entran cada turno
 *   estabilidad  puntos por turno
 *   felicidad    puntos por turno
 *   inflacion    presión sobre los precios por turno
 */
(function (RF) {
  'use strict';

  // Qué modelo económico corresponde a cada tema.
  RF.SECTOR_AMPLIO = {
    AGRO: 'agro', COMIDA: 'agro', RECURSOS: 'mineria', ENERGIA: 'mineria', CARBON: 'carbon', INDUSTRIA: 'industria',
    EMPRESAS: 'industria', TRABAJADORES: 'industria', TURISMO: 'turismo', DIVERSION: 'turismo', AMBIENTE: 'turismo',
    CALENDARIO: 'turismo', TECNOLOGIA: 'tecnologia', INTERNET: 'tecnologia', EDUCACION: 'tecnologia',
    NARCO: 'narco', VICIOS: 'narco', CRIMEN: 'narco'
  };

  RF.MODELOS = {
    narco: {
      nombre: 'el narcotráfico', porTurno: { dinero: 30, estabilidad: -2, felicidad: -0.8 },
      nota: 'El Estado se convierte en el mayor cártel del país. Dinero a raudales; a cambio, violencia, adicción y presión extranjera cada turno.'
    },
    carbon: {
      nombre: 'el carbón', porTurno: { dinero: 16, felicidad: -1, estabilidad: 0.2 },
      nota: 'Minas y centrales por todo el país: empleo y dinero, pero el humo baja la felicidad cada turno.'
    },
    mineria: {
      nombre: 'el petróleo y las minas', porTurno: { dinero: 18, estabilidad: -0.5, felicidad: -0.3 },
      nota: 'El petróleo da mucho dinero, pero atrae a potencias extranjeras con sus propios intereses.'
    },
    industria: {
      nombre: 'la industria', porTurno: { dinero: 13, estabilidad: 0.3, felicidad: -0.2 },
      nota: 'Las fábricas dan trabajo estable. Crecimiento lento pero sólido.'
    },
    turismo: {
      nombre: 'el turismo', porTurno: { dinero: 15, felicidad: 0.2 },
      nota: 'El turismo da dinero y alegría, pero depende mucho de la estabilidad: con el país en llamas no viene nadie.'
    },
    tecnologia: {
      nombre: 'la tecnología', porTurno: { dinero: 16, felicidad: 0.3 }, lenta: true,
      nota: 'La tecnología tarda en arrancar, pero es la apuesta más limpia a largo plazo.'
    },
    agro: {
      nombre: 'la agricultura', porTurno: { dinero: 9, felicidad: 0.3, estabilidad: 0.2 },
      nota: 'Plátano, café y cacao: poco dinero, pero el campo trabaja y come.'
    },
    exotico: {
      nombre: null, porTurno: { dinero: 2, felicidad: -0.3, estabilidad: -0.5 },
      nota: 'Ningún economista del mundo había contemplado este modelo. Da muy poco dinero y bastante vergüenza.'
    }
  };
})(globalThis.RF = globalThis.RF || {});
