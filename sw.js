/* Service worker: rende l'app installabile e utilizzabile offline.
 *
 * Strategia:
 *  - pagine (navigazioni): prima la rete, se manca si usa la copia in cache
 *    → aggiornamenti subito visibili quando c'è connessione, app funzionante in palestra senza campo.
 *  - codice dell'app (html, js, css, manifest, json): prima la rete, poi la cache (aggiornamenti immediati).
 *  - immagini, icone, video, font: dalla cache e aggiornati in background.
 *  - richieste verso altri domini (api.github.com), la cartella dati/ e le richieste non GET: mai in cache.
 *
 * Per forzare l'aggiornamento di tutti i telefoni basta cambiare VERSION.
 */
const VERSION = 'v13';
const CACHE = `mr9-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './alimentazione/ali.css',
  './alimentazione/ali-dati.js',
  './alimentazione/ali.js',
  './manifest.webmanifest',
  './pwa/pwa.js',
  './pwa/pwa.css',
  './pwa/keepawake.mp4',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Un file mancante non deve bloccare l'installazione.
      Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mr9-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Altri domini (es. api.github.com dove l'app legge e scrive sedute ed esiti): sempre dalla rete.
  if (url.origin !== self.location.origin) return;
  // Dati delle sedute serviti dallo stesso sito: sempre freschi, mai dalla cache.
  if (url.pathname.includes('/dati/')) return;
  // I video vengono chiesti a pezzi (Range): lasciali al browser.
  if (req.headers.has('range')) return;

  // Pagine e codice dell'app (html, js, css, manifest): prima la rete, così ogni rilascio arriva subito;
  // senza rete si usa la copia in cache. Immagini, icone e video: dalla cache.
  if (req.mode === 'navigate' || /\.(?:html|js|mjs|css|webmanifest|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(req, event));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, event));
});

async function networkFirst(req, event) {
  const cache = await caches.open(CACHE);
  // La rete aggiorna sempre la cache; se non risponde entro 3 s (campo scarso) si usa la copia salvata.
  const rete = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  if (event) event.waitUntil(rete.catch(() => {}));
  const salvata = () => cache.match(req, { ignoreSearch: req.mode === 'navigate' })
    .then((r) => r || (req.mode === 'navigate' ? cache.match('./index.html').then((x) => x || cache.match('./')) : undefined));
  const timeout = new Promise((ok) => setTimeout(ok, 3000)).then(salvata);
  try {
    const r = await Promise.race([rete, timeout]);
    if (r) return r;
    return await rete; // nessuna copia salvata: aspetta la rete
  } catch {
    return (await salvata()) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) || new Response('', { status: 504 });
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
