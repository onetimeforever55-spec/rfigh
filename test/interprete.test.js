// Prueba del Intérprete: node test/interprete.test.js
// Frases escritas a mano (no están en los datos de entrenamiento).
const RF = require('./cargar')();

const CASOS = [
  ['el aire se vende', 'PRIVATIZAR', 'AIRE'],
  ['A partir de hoy el aire es propiedad del Estado y se cobra por respirar', 'PRIVATIZAR', 'AIRE'],
  ['prohibir el fútbol', 'PROHIBIR', 'DIVERSION'],
  ['prohivir el reggaeton', 'PROHIBIR', 'DIVERSION'],
  ['queda prohibida la cerveza', 'PROHIBIR', 'VICIOS'],
  ['cerrar internet', 'PROHIBIR', 'INTERNET'],
  ['censura total a la prensa', 'PROHIBIR', 'PRENSA'],
  ['ejecutar a los ladrones', 'CASTIGAR', 'CRIMEN'],
  ['encarcelar a los periodistas', 'CASTIGAR', 'PRENSA'],
  ['fusilen a los traidores', 'CASTIGAR', 'OPOSICION'],
  ['mano dura contra los narcos', 'CASTIGAR', 'CRIMEN'],
  ['ya no se vende el agua', 'NACIONALIZAR', 'AGUA'],
  ['dejen de vender el agua', 'NACIONALIZAR', 'AGUA'],
  ['el agua ya no es gratis', 'PRIVATIZAR', 'AGUA'],
  ['subir mucho los impuestos a los ricos', 'SUBIR_IMPUESTO', 'EMPRESAS'],
  ['impuesto al tabaco', 'SUBIR_IMPUESTO', 'VICIOS'],
  ['bajar impuestos a las empresas', 'BAJAR_IMPUESTO', 'EMPRESAS'],
  ['los jubilados no pagan impuestos', 'BAJAR_IMPUESTO', 'TRABAJADORES'],
  ['quiero una estatua de mí', 'GLORIFICAR', 'LIDER'],
  ['mi cara en todos los billetes', 'GLORIFICAR', 'LIDER'],
  ['la comida gratis para todos', 'SUBSIDIAR', 'COMIDA'],
  ['regalar casas a los pobres', 'SUBSIDIAR', 'VIVIENDA'],
  ['subir el sueldo a los soldados', 'SUBSIDIAR', 'EJERCITO'],
  ['legalizar la marihuana', 'LEGALIZAR', 'VICIOS'],
  ['permitir las armas', 'LEGALIZAR', 'ARMAS'],
  ['todos deben rezar', 'OBLIGAR', 'RELIGION'],
  ['la misa es obligatoria', 'OBLIGAR', 'RELIGION'],
  ['servicio militar obligatorio', 'OBLIGAR', 'EJERCITO'],
  ['despedir a los maestros', 'RECORTAR', 'EDUCACION'],
  ['recortar el presupuesto de los hospitales', 'RECORTAR', 'SALUD'],
  ['nacionalizar el petroleo', 'NACIONALIZAR', 'RECURSOS'],
  ['expropiar los bancos', 'NACIONALIZAR', 'EMPRESAS'],
  ['invertir en hospitales', 'INVERTIR', 'SALUD'],
  ['construir mas escuelas', 'INVERTIR', 'EDUCACION'],
  ['modernizar el metro', 'INVERTIR', 'TRANSPORTE'],
  ['vender las minas de oro a los chinos', 'PRIVATIZAR', 'RECURSOS'],
  ['cobrar por la luz', 'PRIVATIZAR', 'ENERGIA'],
  ['deportar a los inmigrantes', 'CASTIGAR', 'EXTRANJEROS'],
  ['cerrar las fronteras', 'PROHIBIR', 'EXTRANJEROS'],
  ['prohibir los gatos', 'PROHIBIR', 'MASCOTAS'],
  ['homenaje al ejercito', 'GLORIFICAR', 'EJERCITO'],
  ['amnistia para los opositores', 'LEGALIZAR', 'OPOSICION'],
  ['gasolina gratis', 'SUBSIDIAR', 'ENERGIA'],
  ['congelar el precio del pan', 'SUBSIDIAR', 'COMIDA'],
  ['prohibir los calcetines rojos', 'PROHIBIR', 'OTRO'],
  ['que todos usen sombrero', 'OBLIGAR', 'ROPA'],
  ['prohibir los paraguas', 'PROHIBIR', 'OTRO'],
  // Jerga y sinónimos
  ['banear a los tombos', 'PROHIBIR', 'POLICIA'],
  ['encanar a los malandros', 'CASTIGAR', 'CRIMEN'],
  ['legalizar la mota', 'LEGALIZAR', 'VICIOS'],
  ['fusilen a los milicos', 'CASTIGAR', 'EJERCITO'],
  ['no más tiktok', 'PROHIBIR', 'INTERNET'],
  ['al paredón con los corruptos', 'CASTIGAR', 'CRIMEN'],
  ['que se jodan los ricachones', 'CASTIGAR', 'EMPRESAS'],
  ['subir impuestos', 'SUBIR_IMPUESTO', 'GENERAL'],
  ['abajo los impuestos', 'BAJAR_IMPUESTO', 'GENERAL'],
  ['prohibir los lunes', 'PROHIBIR', 'CALENDARIO'],
  ['que todos trabajen los domingos', 'OBLIGAR', 'CALENDARIO'],
  ['prohibir la inteligencia artificial', 'PROHIBIR', 'TECNOLOGIA'],
  ['prohibir las bolsas de plástico', 'PROHIBIR', 'AMBIENTE'],
  ['viva el ejército', 'GLORIFICAR', 'EJERCITO'],
  ['prohivir el alcojol', 'PROHIBIR', 'VICIOS']
];

// Varios decretos en una frase.
const MULTIPLES = [
  ['prohibir el fútbol y la música', [['PROHIBIR', 'DIVERSION'], ['PROHIBIR', 'DIVERSION']]],
  ['subir impuestos a los ricos y regalar comida a los pobres', [['SUBIR_IMPUESTO', 'EMPRESAS'], ['SUBSIDIAR', 'COMIDA']]],
  ['el aire se vende, el agua también y ejecutar a los ladrones', [['PRIVATIZAR', 'AIRE'], ['PRIVATIZAR', 'AGUA'], ['CASTIGAR', 'CRIMEN']]],
  ['construir escuelas y hospitales', [['INVERTIR', 'EDUCACION'], ['INVERTIR', 'SALUD']]],
  ['prohibir el fútbol y las fiestas', [['PROHIBIR', 'DIVERSION'], ['PROHIBIR', 'DIVERSION']]]
];

RF.interprete.entrenar();
let ok = 0;
const fallos = [];
for (const [frase, accion, objeto] of CASOS) {
  const r = RF.interprete.interpretar(frase);
  if (r.estado === 'ok' && r.accion === accion && r.objeto === objeto) ok++;
  else fallos.push(`  ✗ "${frase}" → ${r.estado} ${r.accion} ${r.objeto} (esperado ${accion} ${objeto})`);
}
console.log(fallos.join('\n'));
const pct = Math.round((ok / CASOS.length) * 100);
console.log(`Intérprete: ${ok}/${CASOS.length} (${pct}%)`);

let multOk = 0;
for (const [frase, esperado] of MULTIPLES) {
  const rs = RF.interprete.interpretarVarios(frase);
  const bien = rs.length === esperado.length && rs.every((r, i) => r.estado === 'ok' && r.accion === esperado[i][0] && r.objeto === esperado[i][1]);
  if (bien) multOk++; else console.log(`  ✗ "${frase}" → ${rs.map(r => r.estado + ' ' + r.accion + ' ' + r.objeto).join(' | ')}`);
}
console.log(`Varios decretos: ${multOk}/${MULTIPLES.length}`);

// Casos que el bot debe reconocer como dudosos en vez de inventar.
const dudas = [['el agua', 'preguntar_accion'], ['banana', 'confuso'], ['asdf qwer', 'confuso']];
let dudasOk = 0;
for (const [frase, estado] of dudas) {
  const r = RF.interprete.interpretar(frase);
  if (r.estado === estado) dudasOk++; else console.log(`  ✗ "${frase}" → ${r.estado} (esperado ${estado})`);
}
console.log(`Dudas: ${dudasOk}/${dudas.length}`);
process.exit(pct >= 85 && dudasOk === dudas.length && multOk === MULTIPLES.length ? 0 : 1);
