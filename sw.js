// sw.js · Markin funziona anche senza rete. La pagina arriva dalla rete quando c'è,
// il resto dalla cache. A ogni versione nuova si cambia VERSIONE.
const VERSIONE = 'markin-2.0.0';
const BASE = [
  './', './index.html', './manifest.json',
  './css/app.css?v=2.0.0', './js/app.js?v=2.0.0',
  './js/foglio.js', './js/sorgente.js', './js/rileva.js', './js/esporta.js', './js/archivio.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];
const ESTERNI = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSIONE);
    await c.addAll(BASE.map((u) => new Request(u, { cache: 'reload' })));
    await Promise.all(ESTERNI.map((u) => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const vecchie = (await caches.keys()).filter((k) => k !== VERSIONE);
    await Promise.all(vecchie.map((k) => caches.delete(k)));
    await self.clients.claim();
    // chi aveva aperta la versione di prima la ricarica una volta e vede subito la nuova
    if (vecchie.length) {
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put('./index.html', copia)); }
          return r;
        })
        .catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || Response.error()),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((trovata) => trovata || fetch(req).then((r) => {
      if (r.ok || r.type === 'opaque') { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(req, copia)); }
      return r;
    })),
  );
});
