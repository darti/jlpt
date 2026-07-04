/* Service worker — mode hors ligne pour l'app JLPT N3.
   Stratégie :
   - pages HTML : network-first (toujours la dernière version en ligne, repli cache hors ligne) ;
   - autres ressources same-origin (icônes, manifest) : cache-first avec mise à jour ;
   - tout le cross-origin (api.github.com, etc.) : réseau direct. */
const CACHE = 'jlpt-n3-v44';
const SHELL = [
  './',
  'index.html',
  'app-n3.html',
  'cours-n3.html',
  'planning-n3.html',
  'dict.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  // on n'active PAS tout de suite : la page affiche un bandeau « Nouvelle version »
  // et appelle skipWaiting au clic de l'utilisateur (voir message ci-dessous).
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

// la page demande l'activation immédiate quand l'utilisateur clique « Recharger »
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // network-first : on tente le réseau, on met à jour le cache, sinon on sert le cache.
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
  } else {
    // cache-first pour les ressources statiques.
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
