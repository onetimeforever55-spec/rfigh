// Carga los scripts del juego en Node (en el navegador se cargan con <script>), en el mismo orden que index.html.
const fs = require('fs');
const path = require('path');
module.exports = function cargar() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const rutas = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]).filter(r => !r.endsWith('juego.js'));
  for (const r of rutas) require(path.join(__dirname, '..', r));
  return globalThis.RF;
};
