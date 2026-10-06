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
# El icono y el manifiesto también van dentro del HTML: así la app se puede instalar subiendo solo index.html.
python3 - <<'PY'
import base64, json
b64 = lambda f: base64.b64encode(open(f, 'rb').read()).decode()
ic180, ic192, ic512 = (b64('pwa/icono-%d.png' % n) for n in (180, 192, 512))
man = json.load(open('pwa/manifest.webmanifest'))
for i in man['icons']: i['src'] = 'data:image/png;base64,' + (ic192 if i['sizes'] == '192x192' else ic512)
man['start_url'] = './'; man.pop('scope', None)
mdata = 'data:application/manifest+json;base64,' + base64.b64encode(json.dumps(man, ensure_ascii=False).encode()).decode()
h = open('docs/index.html', encoding='utf-8').read()
h = h.replace('href="manifest.webmanifest"', 'href="' + mdata + '"').replace('href="icono-180.png"', 'href="data:image/png;base64,' + ic180 + '"').replace('href="icono-192.png"', 'href="data:image/png;base64,' + ic192 + '"')
open('docs/index.html', 'w', encoding='utf-8').write(h)
PY
echo "Listo: docs/ (juego, manifiesto, iconos y modo sin internet)"
