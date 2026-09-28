// Junta el juego en un solo archivo HTML: node scripts/empaquetar.js [salida] [--sin-envoltura]
// --sin-envoltura quita <!doctype>, <html>, <head> y <body> (para páginas que ya ponen su propio esqueleto).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const args = process.argv.slice(2);
const sinEnvoltura = args.includes('--sin-envoltura');
const salida = args.find(a => !a.startsWith('--')) || path.join(raiz, 'dist', 'pionyang.html');

let html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const leer = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

html = html.replace(/<!--ESTILOS-->[\s\S]*?<!--\/ESTILOS-->/, () => {
  return '<style>\n' + leer('css/estilo.css') + '</style>';
});
html = html.replace(/<!--SCRIPTS-->([\s\S]*?)<!--\/SCRIPTS-->/, (_, bloque) => {
  const rutas = [...bloque.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  // "<\/script" evita que un texto dentro del código cierre la etiqueta antes de tiempo.
  return '<script>\n' + rutas.map(r => '// ' + r + '\n' + leer(r).replace(/<\/script/gi, '<\\/script')).join('\n') + '</script>';
});

if (sinEnvoltura) {
  const cabeza = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/, '')
    .replace(/<meta name="viewport"[^>]*>\s*/, '');
  const cuerpo = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = cabeza.trim() + '\n' + cuerpo.trim() + '\n';
}

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, html);
console.log('Empaquetado en', path.relative(process.cwd(), salida), '(' + Math.round(html.length / 1024) + ' KB)');
