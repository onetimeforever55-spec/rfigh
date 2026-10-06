#!/bin/sh
# Empaqueta Génesis para que cualquiera lo juegue: un .zip con el juego en un solo HTML y unas instrucciones.
# sh scripts/paquete.sh  →  paquete/Genesis.zip
set -e
cd "$(dirname "$0")/.."
node scripts/empaquetar.js --entrada mundo.html >/dev/null
rm -rf paquete/Genesis paquete/Genesis.zip
mkdir -p paquete/Genesis
cp dist/mundo.html paquete/Genesis/Genesis.html
cp scripts/LEEME-juego.txt paquete/Genesis/LEEME.txt
(cd paquete && zip -qr Genesis.zip Genesis)
echo "Listo: paquete/Genesis.zip"
