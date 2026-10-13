// Guarda o app no celular para abrir sem internet. Mude VERSION a cada publicação.
const VERSION = 'estudio-1.0.2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'src/style.css', 'src/main.js', 'src/dsp.js', 'src/db.js', 'src/media.js', 'src/rec-worklet.js', 'src/dsp-worker.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION + '-fontes').then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; } catch (err) { return hit || Response.error(); }
    }));
  }
});
