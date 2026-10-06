#!/bin/sh
# Empaqueta Génesis para que cualquiera lo juegue: el juego entero en un solo archivo HTML, sin zip.
# sh scripts/paquete.sh  →  paquete/Genesis.html
set -e
cd "$(dirname "$0")/.."
node scripts/empaquetar.js --entrada mundo.html >/dev/null
rm -rf paquete
mkdir -p paquete
cp dist/mundo.html paquete/Genesis.html
echo "Listo: paquete/Genesis.html"
