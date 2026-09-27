// Carga los scripts del juego en Node (en el navegador se cargan con <script>).
const path = require('path');
const ARCHIVOS = ['texto', 'datos/sinonimos', 'datos/acciones', 'datos/objetos', 'interprete', 'datos/personajes', 'datos/eventos', 'datos/dilemas', 'datos/voces', 'director', 'consejero', 'narrador'];
module.exports = function cargar() {
  for (const a of ARCHIVOS) {
    try { require(path.join(__dirname, '..', 'js', a + '.js')); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  return globalThis.RF;
};
