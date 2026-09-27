/*
 * ACCIONES: qué quiere hacer el Líder con algo.
 * Cada frase de ejemplo usa {o} donde va el objeto ("el aire", "los bancos"...).
 * El Intérprete combina estas frases con todos los objetos para entrenarse.
 */
(function (RF) {
  'use strict';

  RF.ACCIONES = {
    PROHIBIR: {
      nombre: 'Prohibir',
      nominal: 'la prohibición {de}',
      inversa: 'LEGALIZAR',
      frases: [
        'prohibir {o}', 'se prohibe {o}', '{o} queda prohibido', '{o} esta prohibido', 'prohibido {o}',
        'nadie puede tener {o}', 'no se permite {o}', 'no se puede usar {o}', 'eliminar {o}', 'abolir {o}',
        'vetar {o}', '{o} es ilegal', 'ilegalizar {o}', 'quiero que desaparezca {o}', 'fuera {o}',
        'se acabo {o}', 'clausurar {o}', 'cerrar {o}', 'bloquear {o}', 'censurar {o}', 'nadie puede usar {o}',
        'queda terminantemente prohibido {o}', 'nada de {o}', 'erradicar {o}', 'suprimir {o}', 'prohiban {o}', 'que cierren {o}', 'eliminen {o}', 'quitar {o}', 'se acabo {o} para siempre', 'mandar a cerrar {o}', 'que no exista {o}', 'desaparecer {o}', 'nadie puede {o}', 'queda vetado {o}', 'restringir {o}', 'limitar {o}'
      ]
    },
    OBLIGAR: {
      nombre: 'Obligar',
      nominal: 'la obligatoriedad {de}',
      inversa: 'LEGALIZAR',
      frases: [
        'obligar a todos a {o}', '{o} es obligatorio', '{o} sera obligatorio', 'todos deben {o}',
        'todos tienen que {o}', 'es obligatorio {o}', 'imponer {o}', 'exigir {o}', 'cada ciudadano debe tener {o}',
        'todo el mundo debe usar {o}', 'forzar {o}', '{o} de forma obligatoria', 'obligatorio para todos {o}',
        'nadie puede negarse a {o}', 'todos estan obligados a {o}', 'usar {o} a diario por ley', 'obligar {o}',
        'todos deberan {o}', 'deben {o}', 'que todos usen {o}', 'que todo el mundo lleve {o}', 'llevar {o} obligatoriamente',
        'hay que {o} a diario', 'tienen que {o} cada dia', 'es deber de todos {o}', 'que todos tengan {o}', 'obliguen a {o}', 'todo ciudadano debera {o}', 'es obligatorio que todos {o}', 'multa a quien no {o}', 'carcel a quien no {o}', 'todos a {o}', 'uso obligatorio de {o}', 'que todos trabajen {o}', 'trabajar {o} obligatoriamente', 'todos deben trabajar {o}'
      ]
    },
    PRIVATIZAR: {
      nombre: 'Privatizar',
      nominal: 'la privatización {de}',
      inversa: 'NACIONALIZAR',
      frases: [
        'privatizar {o}', 'vender {o}', '{o} se vende', '{o} ahora se vende', 'cobrar por {o}',
        'hay que pagar por {o}', '{o} cuesta dinero', '{o} sera de pago', 'poner precio a {o}', 'subastar {o}',
        'vender {o} a empresas', '{o} pasa a manos privadas', 'cobrar {o}', '{o} ya no es gratis',
        'que la gente pague por {o}', 'concesionar {o}', 'la gente tiene que pagar {o}', 'rematar {o}',
        'vender {o} al mejor postor', '{o} tiene precio', 'pagar para {o}',
        'se cobra por {o}', 'cobrar a la gente por {o}', 'el estado cobra por {o}', 'cobrar una cuota por {o}', 'vendan {o}', 'que se venda {o}', 'que cobren por {o}', 'dar {o} a empresas privadas', 'meterle precio a {o}', 'que {o} lo gestione una empresa', 'poner peaje a {o}', 'cobrar entrada a {o}', 'ceder {o} a los privados'
      ]
    },
    NACIONALIZAR: {
      nombre: 'Nacionalizar',
      nominal: 'la nacionalización {de}',
      inversa: 'PRIVATIZAR',
      frases: [
        'nacionalizar {o}', 'expropiar {o}', '{o} pasa a ser del estado', '{o} es del estado',
        'el estado controla {o}', 'estatizar {o}', 'confiscar {o}', 'quitarle {o} a los privados',
        '{o} pertenece al estado', 'el gobierno toma {o}', '{o} ahora es publico', 'requisar {o}',
        'el gobierno se queda con {o}', 'expropiese {o}', 'socializar {o}', 'expropien {o}', 'que el estado tome {o}', 'recuperar {o} para el estado', 'que {o} sea publico', 'estatal {o}', 'que el estado gestione {o}', 'quitarle {o} a las empresas'
      ]
    },
    SUBIR_IMPUESTO: {
      nombre: 'Subir impuestos',
      nominal: 'el nuevo impuesto {a}',
      inversa: 'BAJAR_IMPUESTO',
      frases: [
        'subir impuestos a {o}', 'mas impuestos a {o}', 'gravar {o}', 'impuesto a {o}', 'nuevo impuesto sobre {o}',
        'cobrar impuestos a {o}', 'aumentar los impuestos de {o}', 'tasa especial a {o}', '{o} paga mas impuestos',
        'duplicar impuestos a {o}', 'tributo sobre {o}', 'subir el iva de {o}', 'impuestazo a {o}',
        'que {o} pague mas impuestos', 'recargo fiscal a {o}', 'subir la tasa de {o}', 'impuesto al {o}', 'que {o} paguen mas', 'cobrarle mas a {o}', 'que {o} tributen mas', 'impuesto especial para {o}', 'gravamen a {o}', 'subir impuestos'
      ]
    },
    BAJAR_IMPUESTO: {
      nombre: 'Bajar impuestos',
      nominal: 'la rebaja de impuestos {a}',
      inversa: 'SUBIR_IMPUESTO',
      frases: [
        'bajar impuestos a {o}', 'menos impuestos a {o}', 'quitar impuestos a {o}', '{o} no paga impuestos',
        'rebaja fiscal para {o}', 'reducir impuestos de {o}', 'exentar de impuestos a {o}', 'eliminar el impuesto a {o}',
        'exoneracion fiscal a {o}', 'bajar el iva de {o}', 'sin impuestos para {o}', 'libre de impuestos {o}',
        'recortar impuestos a {o}', 'alivio fiscal para {o}', '{o} no pagan impuestos', 'que {o} no paguen impuestos', 'perdonar impuestos a {o}', 'bajar impuestos', 'menos impuestos', 'eliminar impuestos a {o}', 'rebajar el iva a {o}'
      ]
    },
    SUBSIDIAR: {
      nombre: 'Regalar',
      nominal: 'los subsidios {a}',
      inversa: 'RECORTAR',
      frases: [
        '{o} gratis', '{o} gratis para todos', 'subsidiar {o}', 'regalar {o}', 'repartir {o} gratis',
        'el estado paga {o}', 'ayudas para {o}', 'subvencionar {o}', 'bono para {o}', '{o} gratuito',
        'abaratar {o}', 'bajar el precio de {o}', 'congelar el precio de {o}', 'subir el sueldo a {o}',
        'dar dinero a {o}', 'pagar a {o}', 'repartir {o}', 'regalo de {o} a cada familia', '{o} a mitad de precio',
        'ayuda economica a {o}', 'aumentar el sueldo de {o}', 'regalen {o}', 'repartan {o} gratis', 'dar {o} gratis', 'que {o} sea gratis', 'que el gobierno pague {o}', 'cheque para {o}', 'beca para {o}', 'regalarle {o} a cada familia', 'ayudar a {o}'
      ]
    },
    CASTIGAR: {
      nombre: 'Mano dura',
      nominal: 'la mano dura contra {o}',
      inversa: 'LEGALIZAR',
      frases: [
        'castigar {o}', 'encarcelar a {o}', 'ejecutar a {o}', 'fusilar a {o}', 'carcel para {o}',
        'mano dura contra {o}', 'perseguir a {o}', 'arrestar a {o}', 'multar a {o}', 'desterrar a {o}',
        'exiliar a {o}', 'pena de muerte para {o}', 'reprimir a {o}', 'purgar a {o}', 'detener a {o}',
        'deportar a {o}', 'meter presos a {o}', 'encerrar a {o}', 'aplastar a {o}', 'cazar a {o}',
        'mano de hierro con {o}', 'eliminar a {o}', 'matar a {o}', 'fusilen a {o}', 'encierren a {o}', 'arresten a {o}', 'maten a {o}', 'castiguen a {o}', 'que encarcelen a {o}', 'vigilar a {o}', 'espiar a {o}', 'investigar a {o}', 'hacer una limpieza de {o}', 'torturar a {o}', 'palizas a {o}', 'meter a la carcel a {o}', 'juicio sumario a {o}'
      ]
    },
    LEGALIZAR: {
      nombre: 'Legalizar',
      nominal: 'la legalización {de}',
      inversa: 'PROHIBIR',
      frases: [
        'legalizar {o}', '{o} es legal', 'permitir {o}', 'se permite {o}', '{o} queda permitido',
        'despenalizar {o}', 'liberar {o}', '{o} libre', 'libertad para {o}', 'autorizar {o}',
        'amnistia para {o}', 'indultar a {o}', 'perdonar a {o}', 'soltar a {o}', '{o} ya es legal',
        'regular {o}', 'se puede {o} libremente', 'legalicen {o}', 'permitan {o}', 'que se permita {o}', 'desbloquear {o}', 'reabrir {o}', 'devolver {o}', 'quitar la prohibicion de {o}', 'liberalizar {o}', 'se vale {o}'
      ]
    },
    INVERTIR: {
      nombre: 'Invertir',
      nominal: 'la inversión en {o}',
      inversa: 'RECORTAR',
      frases: [
        'invertir en {o}', 'construir {o}', 'mas dinero para {o}', 'financiar {o}', 'mejorar {o}',
        'modernizar {o}', 'ampliar {o}', 'crear {o}', 'fortalecer {o}', 'presupuesto para {o}',
        'plan nacional de {o}', 'desarrollar {o}', 'aumentar el presupuesto de {o}', 'impulsar {o}',
        'fondos para {o}', 'reformar {o}', 'mas {o}', 'duplicar el presupuesto de {o}', 'construyan {o}', 'inviertan en {o}', 'apoyar {o}', 'potenciar {o}', 'mas presupuesto para {o}', 'contratar mas {o}', 'nuevas {o}', 'construir mas {o}', 'construir {o} nuevos', 'construir {o} en cada barrio', 'edificar {o}', 'levantar {o}', 'renovar {o}', 'reparar {o}'
      ]
    },
    RECORTAR: {
      nombre: 'Recortar',
      nominal: 'los recortes en {o}',
      inversa: 'INVERTIR',
      frases: [
        'recortar {o}', 'recortes en {o}', 'menos dinero para {o}', 'reducir el presupuesto de {o}',
        'quitar fondos a {o}', 'desfinanciar {o}', 'congelar el presupuesto de {o}', 'austeridad en {o}',
        'reducir {o}', 'despedir a {o}', 'bajar el sueldo a {o}', 'eliminar ayudas a {o}', 'quitar subsidios a {o}',
        'menos {o}', 'ajuste en {o}', 'tijeretazo a {o}', 'reducir el gasto en {o}', 'recorten {o}', 'despidan a {o}', 'reducir a la mitad {o}', 'menos presupuesto para {o}', 'privar de fondos a {o}', 'reducir personal de {o}', 'ahorrar en {o}'
      ]
    },
    GLORIFICAR: {
      nombre: 'Glorificar',
      nominal: 'el homenaje {a}',
      inversa: null,
      frases: [
        'construir una estatua de {o}', 'estatua de {o}', 'homenaje a {o}', 'celebrar a {o}', 'dia nacional de {o}',
        'feriado en honor a {o}', 'heroe nacional a {o}', 'culto a {o}', 'alabar a {o}',
        'retrato de {o} en cada casa', 'cambiar el himno por {o}', 'renombrar el pais en honor a {o}',
        'desfile en honor a {o}', 'glorificar a {o}', 'poner la cara de {o} en los billetes', 'cantar alabanzas a {o}',
        'un monumento a {o}', 'medalla para {o}', 'honrar a {o}', 'un himno para {o}', 'rezarle a {o}', 'canonizar a {o}', 'dia festivo por {o}', 'mural de {o}', 'museo de {o}', 'que todos veneren a {o}'
      ]
    }
  };
})(globalThis.RF = globalThis.RF || {});
