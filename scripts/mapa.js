// El mapa del código de Génesis: cada archivo de js/mundo/ con sus secciones y la línea donde empieza cada una.
// Los módulos grandes están partidos (js/mundo/vida/NN-*.js…): se listan sus partes, que son lo que se edita.
// node scripts/mapa.js            (todos los archivos)
// node scripts/mapa.js vida       (solo uno, con todas sus partes)
// node scripts/mapa.js barcos     (busca en los títulos de sección y en los nombres de función)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js', 'mundo');
const arg = (process.argv[2] || '').toLowerCase();
// (Un módulo con carpeta de partes se lista por sus partes: el archivo unido lo genera scripts/unir.js.)
const conPartes = f => fs.existsSync(path.join(dir, f.replace(/\.js$/, ''))) && fs.statSync(path.join(dir, f.replace(/\.js$/, ''))).isDirectory();
const archivosDe = f => conPartes(f) ? fs.readdirSync(path.join(dir, f.replace(/\.js$/, ''))).filter(x => /^\d\d-.+\.js$/.test(x)).sort().map(x => f.replace(/\.js$/, '') + '/' + x) : [f];
const modulos = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const soloArchivo = modulos.find(f => f === arg + '.js');
const busca = arg && !soloArchivo ? arg : '';
const archivos = (soloArchivo ? [soloArchivo] : modulos).flatMap(archivosDe);
for (const f of archivos) {
  const lineas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'), salida = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    let m = l.match(/^  \/\/ -{6,} (.*?) ?-*$/), titulo = null, func = null;
    if (/^  \/\/ ── GÉNESIS · /.test(l)) continue; // (el título de la parte ya va en la cabecera)
    if (m) titulo = m[1];
    else if (/^  \/\*$/.test(l) && lineas[i + 1]) titulo = lineas[i + 1].replace(/^ *\* */, '');
    else if ((m = l.match(/^  (?:async )?function\*? (\w+)/))) func = m[1];
    const texto = titulo ? '§ ' + titulo.slice(0, 100) : func ? '    ' + func + '()' : null;
    if (!texto) continue;
    if (busca && !texto.toLowerCase().includes(busca)) continue;
    if (!busca && func) continue; // sin búsqueda, solo las secciones
    salida.push(String(i + 1).padStart(6) + '  ' + texto);
  }
  if (salida.length) console.log('\n' + f + ' (' + lineas.length + ' líneas)\n' + salida.join('\n'));
}
