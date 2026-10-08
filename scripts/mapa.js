// El mapa del código de Génesis: cada archivo de js/mundo/ con sus secciones y la línea donde empieza cada una.
// node scripts/mapa.js            (todos los archivos)
// node scripts/mapa.js vida       (solo uno)
// node scripts/mapa.js barcos     (busca en los títulos de sección y en los nombres de función)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js', 'mundo');
const arg = (process.argv[2] || '').toLowerCase();
const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const soloArchivo = archivos.find(f => f === arg + '.js');
const busca = arg && !soloArchivo ? arg : '';
for (const f of soloArchivo ? [soloArchivo] : archivos) {
  const lineas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'), salida = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    let m = l.match(/^  \/\/ -{6,} (.*?) ?-*$/), titulo = null, func = null;
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
