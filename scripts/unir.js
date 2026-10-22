// Junta las partes de cada módulo de Génesis en su archivo: js/mundo/vida/*.js → js/mundo/vida.js (y así con los demás).
// node scripts/unir.js             → regenera los archivos
// node scripts/unir.js --comprobar → solo mira que estén al día (sale con error si alguno no lo está)
//
// Cada módulo es una sola función que comparte entre todas sus partes las constantes y funciones internas; por eso
// las partes no se cargan sueltas, sino unidas en el orden de su número (00, 01, 02…). Se editan las partes.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const MODULOS = ['sim', 'vida', 'mando', 'arte', 'pintor', 'vista'];
const comprobar = process.argv.includes('--comprobar');

function unido(mod) {
  const dir = path.join(raiz, 'js', 'mundo', mod);
  const partes = fs.readdirSync(dir).filter(f => /^\d\d-.+\.js$/.test(f)).sort();
  if (!partes.length) throw new Error('No hay partes en ' + path.relative(raiz, dir));
  const cuerpo = partes.map(f => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\n*$/, '\n')).join('\n');
  return '// ARCHIVO GENERADO por scripts/unir.js: no lo edites aquí, edita sus partes en js/mundo/' + mod + '/ (' + partes.join(', ') + ').\n' +
    '(function (RF) {\n' + cuerpo + '})(globalThis.RF = globalThis.RF || {});\n';
}

let mal = 0;
for (const mod of MODULOS) {
  const archivo = path.join(raiz, 'js', 'mundo', mod + '.js'), texto = unido(mod);
  const actual = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : null;
  if (comprobar) { if (actual !== texto) { mal++; console.error('Desfasado: js/mundo/' + mod + '.js (ejecuta node scripts/unir.js)'); } }
  else if (actual !== texto) { fs.writeFileSync(archivo, texto); console.log('Unido: js/mundo/' + mod + '.js'); }
}
if (mal) process.exit(1);
