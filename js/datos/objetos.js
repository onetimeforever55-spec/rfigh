/*
 * OBJETOS: sobre qué cae el decreto.
 * Propiedades (0 a 3) que usa el Consejero para calcular consecuencias:
 *   esencial  cuánto depende la gente de ello para vivir
 *   rentable  cuánto dinero puede generar
 *   libertad  cuánto se asocia a libertades (prensa, internet...)
 *   popular   cuánto le gusta a la gente
 *   vicio     es un vicio (alcohol, apuestas...)
 *   gente     es un grupo de personas (se les puede encarcelar)
 *   faccion   estadística del grupo que representa (ejercito, cupula...)
 *   afecta    estadística directamente ligada (salud, orden, mundo...)
 */
(function (RF) {
  'use strict';

  RF.OBJETOS = {
    AIRE: {
      nombre: 'el aire', esencial: 3, rentable: 2, afecta: 'salud',
      formas: ['el aire', 'el oxígeno', 'respirar', 'la respiración', 'el aire puro']
    },
    AGUA: {
      nombre: 'el agua', esencial: 3, rentable: 2, afecta: 'salud',
      formas: ['el agua', 'el agua potable', 'los ríos', 'el agua del grifo', 'el agua de la llave', 'la lluvia']
    },
    COMIDA: {
      nombre: 'la comida', esencial: 3, rentable: 1, afecta: 'salud', popular: 1,
      formas: ['la comida', 'el pan', 'los alimentos', 'las arepas', 'el arroz', 'la carne', 'la canasta básica', 'comer', 'la harina', 'los huevos', 'la leche']
    },
    SALUD: {
      nombre: 'los hospitales', esencial: 3, rentable: 1, afecta: 'salud',
      formas: ['los hospitales', 'la sanidad', 'las medicinas', 'los médicos', 'la salud pública', 'las vacunas', 'las enfermeras', 'los medicamentos', 'las clínicas']
    },
    EDUCACION: {
      nombre: 'las escuelas', esencial: 2, libertad: 1,
      formas: ['las escuelas', 'la educación', 'las universidades', 'los maestros', 'los profesores', 'los colegios', 'estudiar', 'los libros', 'los estudiantes']
    },
    PRENSA: {
      nombre: 'la prensa', libertad: 3, afecta: 'mundo',
      formas: ['la prensa', 'los periodistas', 'los periódicos', 'la televisión', 'la radio', 'las noticias', 'los medios', 'los canales de tv']
    },
    INTERNET: {
      nombre: 'internet', libertad: 2, popular: 3, rentable: 1,
      formas: ['internet', 'las redes sociales', 'el wifi', 'los celulares', 'WhatsApp', 'TikTok', 'los teléfonos', 'Instagram', 'YouTube', 'los móviles']
    },
    RELIGION: {
      nombre: 'la religión', libertad: 2, popular: 2,
      formas: ['la religión', 'las iglesias', 'la misa', 'rezar', 'los curas', 'la fe', 'Dios', 'los templos', 'la biblia']
    },
    EJERCITO: {
      nombre: 'el ejército', faccion: 'ejercito', gente: 1,
      formas: ['el ejército', 'los militares', 'los soldados', 'las fuerzas armadas', 'los generales', 'los tanques', 'el servicio militar']
    },
    POLICIA: {
      nombre: 'la policía', afecta: 'orden', gente: 1,
      formas: ['la policía', 'los policías', 'los agentes', 'la guardia nacional', 'las patrullas', 'los guardias']
    },
    OPOSICION: {
      nombre: 'la oposición', libertad: 3, afecta: 'mundo', gente: 1,
      formas: ['la oposición', 'los opositores', 'los partidos políticos', 'los disidentes', 'los manifestantes', 'los traidores', 'los rebeldes', 'las protestas', 'los enemigos del estado', 'las huelgas']
    },
    EMPRESAS: {
      nombre: 'las empresas', rentable: 3, faccion: 'cupula', gente: 1,
      formas: ['las empresas', 'los ricos', 'los empresarios', 'los bancos', 'los millonarios', 'las multinacionales', 'las fabricas', 'la bolsa', 'los oligarcas']
    },
    TRABAJADORES: {
      nombre: 'los trabajadores', esencial: 2, faccion: 'pueblo', gente: 1,
      formas: ['los trabajadores', 'los obreros', 'los sueldos', 'el salario mínimo', 'los empleados', 'los sindicatos', 'los pobres', 'las pensiones', 'los jubilados', 'los campesinos']
    },
    DIVERSION: {
      nombre: 'el fútbol y las fiestas', popular: 3, libertad: 1, rentable: 1,
      formas: ['el fútbol', 'los deportes', 'la música', 'las fiestas', 'el carnaval', 'el cine', 'los conciertos', 'bailar', 'el reguetón', 'la cultura', 'los videojuegos', 'la salsa', 'el béisbol']
    },
    VICIOS: {
      nombre: 'el alcohol', popular: 2, rentable: 2, vicio: 1,
      formas: ['el alcohol', 'la cerveza', 'el ron', 'el tabaco', 'fumar', 'los cigarros', 'las drogas', 'la marihuana', 'los casinos', 'las apuestas', 'el vino', 'emborracharse']
    },
    TRANSPORTE: {
      nombre: 'el transporte', esencial: 2, rentable: 1,
      formas: ['el transporte', 'los autobuses', 'el metro', 'los taxis', 'los coches', 'los carros', 'las carreteras', 'el tren', 'las motos', 'las bicicletas']
    },
    ENERGIA: {
      nombre: 'la electricidad', esencial: 3, rentable: 2,
      formas: ['la luz', 'la electricidad', 'la gasolina', 'el gas', 'la energía', 'el combustible', 'el diésel']
    },
    VIVIENDA: {
      nombre: 'la vivienda', esencial: 2, rentable: 2,
      formas: ['las casas', 'la vivienda', 'los alquileres', 'las rentas', 'los apartamentos', 'los pisos', 'las hipotecas', 'los edificios']
    },
    EXTRANJEROS: {
      nombre: 'los extranjeros', libertad: 1, afecta: 'mundo', gente: 1,
      formas: ['los extranjeros', 'los inmigrantes', 'los turistas', 'la frontera', 'las fronteras', 'viajar', 'las importaciones', 'los visados']
    },
    ARMAS: {
      nombre: 'las armas', afecta: 'orden', rentable: 1,
      formas: ['las armas', 'las pistolas', 'los fusiles', 'las balas', 'las escopetas', 'los rifles']
    },
    RECURSOS: {
      nombre: 'el petróleo', rentable: 3, afecta: 'mundo',
      formas: ['el petróleo', 'las minas', 'el oro', 'el litio', 'los bosques', 'la selva', 'los recursos naturales', 'el cobre', 'la minería']
    },
    CRIMEN: {
      nombre: 'la delincuencia', afecta: 'orden', gente: 1,
      formas: ['los ladrones', 'los delincuentes', 'el crimen', 'la delincuencia', 'los narcos', 'las pandillas', 'la corrupción', 'los corruptos', 'robar', 'los asesinos', 'los mafiosos']
    },
    MASCOTAS: {
      nombre: 'las mascotas', popular: 2,
      formas: ['las mascotas', 'los perros', 'los gatos', 'los animales', 'los loros', 'las palomas']
    },
    LIDER: {
      nombre: 'el Líder',
      formas: ['mi', 'mi persona', 'el líder', 'su excelencia', 'el presidente', 'yo', 'mi cara', 'mi nombre', 'el gran líder', 'mi madre', 'mi cumpleaños']
    }
  };

  // Objeto comodín para decretos sobre cosas que el bot no conoce ("los calcetines").
  RF.OBJETO_OTRO = { nombre: 'eso', libertad: 1, popular: 1, formas: [] };
})(globalThis.RF = globalThis.RF || {});
