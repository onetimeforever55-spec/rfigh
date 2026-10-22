// Las partes de cada módulo (js/mundo/<módulo>/NN-*.js) y el archivo unido que carga el juego deben ir a la par.
const { execFileSync } = require('child_process');
const path = require('path');
try {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'unir.js'), '--comprobar'], { stdio: 'pipe' });
  console.log('  ✓ los módulos unidos están al día con sus partes');
} catch (e) {
  console.log('  ✗ ' + String(e.stderr || e.message).trim());
  process.exit(1);
}
