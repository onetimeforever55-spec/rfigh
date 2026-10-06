#!/bin/sh
# Genera la app web instalable de Génesis en docs/ (lista para GitHub Pages u otro servidor estático).
# sh scripts/pwa.sh
set -e
cd "$(dirname "$0")/.."
node scripts/empaquetar.js --entrada mundo.html >/dev/null
rm -rf docs && mkdir -p docs
cp dist/mundo.html docs/index.html
cp pwa/manifest.webmanifest pwa/sw.js pwa/icono-*.png docs/
touch docs/.nojekyll
echo "Listo: docs/ (juego, manifiesto, iconos y modo sin internet)"
