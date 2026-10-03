// Junta un juego en un solo archivo HTML: node scripts/empaquetar.js [salida] [--sin-envoltura] [--entrada mundo.html]
// --sin-envoltura quita <!doctype>, <html>, <head> y <body> (para páginas que ya ponen su propio esqueleto).
// --entrada elige la página (por defecto index.html, la consola; mundo.html es Génesis).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const args = process.argv.slice(2);
const sinEnvoltura = args.includes('--sin-envoltura');
const iEntrada = args.indexOf('--entrada');
const entrada = iEntrada >= 0 ? args[iEntrada + 1] : 'index.html';
const salida = args.find((a, i) => !a.startsWith('--') && i !== iEntrada + 1) || path.join(raiz, 'dist', entrada === 'index.html' ? 'pionyang.html' : entrada.replace(/\.html$/, '') + '.html');

let html = fs.readFileSync(path.join(raiz, entrada), 'utf8');
const leer = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

html = html.replace(/<!--ESTILOS-->([\s\S]*?)<!--\/ESTILOS-->/, (_, bloque) => {
  const hojas = [...bloque.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  return '<style>\n' + hojas.map(leer).join('\n') + '</style>';
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
