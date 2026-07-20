/* Service worker — mode hors ligne pour l'app JLPT N3.
   Stratégie :
   - pages HTML : network-first (toujours la dernière version en ligne, repli cache hors ligne) ;
   - données de contenu (data/*.json) : network-first aussi — elles changent entre versions,
     et un client au SW encore périmé servait sinon l'ancienne forme (ex. avant lessons→groups)
     au bundle courant → plantage (category.groups.map sur undefined). Repli cache hors ligne ;
   - autres ressources same-origin (icônes, manifest, bundle hashé) : cache-first avec mise à jour ;
   - tout le cross-origin (api.github.com, etc.) : réseau direct. */
const CACHE = 'jlpt-n3-v108';
const SHELL = [
  './',
  'index.html',
  'quiz.html',
  'app-n3.html',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];
// Documents du graphe : tout le contenu de l'app (~10 Mo décompressés, ~1,3 Mo sur le fil).
// Précachés pour que le hors ligne soit complet DÈS la première visite, y compris sur des
// questions jamais ouvertes.
const GRAPH = [
  'data/graph/context.jsonld',
  'data/graph/corpus.jsonld',
  'data/graph/word.jsonld',
  'data/graph/kanji.jsonld',
  'data/graph/gram.jsonld',
  'data/graph/lesson.jsonld',
  'data/graph/example.jsonld',
  'data/graph/method.jsonld',
  'data/graph/q-grammaire.jsonld',
  'data/graph/q-vocabulaire.jsonld',
  'data/graph/q-kanji.jsonld',
  'data/graph/q-lecture.jsonld',
  'data/graph/q-ecoute.jsonld'
];

self.addEventListener('install', e => {
  // on n'active PAS tout de suite : la page affiche un bandeau « Nouvelle version »
  // et appelle skipWaiting au clic de l'utilisateur (voir message ci-dessous).
  //
  // DEUX listes, et c'est délibéré. addAll() est ATOMIQUE : une seule requête en échec
  // rejette tout. Pour la coquille c'est le bon comportement (un SW sans index.html ne
  // sert à rien). Pour les 10 Mo du graphe ce serait un piège : une coupure réseau au
  // milieu de q-vocabulaire ferait échouer l'install entière → AUCUN service worker
  // activé, donc plus de hors ligne du tout. Le contenu se précache donc en best-effort,
  // et ce qui a raté sera repris au premier fetch (network-first, cf. isData plus bas).
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(SHELL).then(() => Promise.allSettled(GRAPH.map(u => c.add(u))))
  ));
});

// la page demande l'activation immédiate quand l'utilisateur clique « Recharger »
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // la page demande le numéro de version (= nom du cache)
  if (e.data && e.data.type === 'VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage(CACHE);
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  // data/* = contenu qui évolue entre versions → network-first comme le HTML.
  // ⚠ `.jsonld` DOIT être couvert : sans lui les documents du graphe tombaient dans la
  // branche cache-first (celle des icônes) et le corpus restait figé à vie chez le client,
  // exactement la panne décrite en tête de ce fichier. `.jsonld` ne finit pas par `.json`.
  const isData = url.pathname.includes('/data/')
    && (url.pathname.endsWith('.json') || url.pathname.endsWith('.jsonld'));

  if (isHTML || isData) {
    // network-first ; on ne met en cache QUE les réponses OK (jamais un 404 → pas de
    // garbage servi hors ligne). En cas d'échec réseau, on sert le cache (repli index.html
    // UNIQUEMENT pour une navigation — jamais pour un asset comme dict.js ou un data/*.json).
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || (isHTML ? caches.match('index.html') : undefined)))
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
