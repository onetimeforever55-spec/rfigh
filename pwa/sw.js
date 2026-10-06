// Génesis sin internet: guarda el juego la primera vez y lo abre desde ahí. Con red, siempre prueba primero la
// versión nueva (así las mejoras llegan solas); sin red, usa la guardada.
const VERSION = 'genesis-v1';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icono-180.png', './icono-192.png', './icono-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const copia = res.clone(); caches.open(VERSION).then(c => c.put(r, copia)); return res; }).catch(() => caches.match(r).then(x => x || caches.match('./index.html'))));
});
