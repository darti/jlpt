/* Service worker — mode hors ligne pour l'app JLPT N3.
   Stratégie : cache-first pour la coquille de l'app (same-origin),
   réseau direct pour tout le reste (ex. api.github.com pour la synchro). */
const CACHE = 'jlpt-n3-v3';
const SHELL = [
  './',
  'index.html',
  'app-n3.html',
  'cours-n3.html',
  'planning-n3.html',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // On ne gère que les GET same-origin ; le reste (API GitHub, etc.) passe au réseau.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return cached || net;
    })
  );
});
