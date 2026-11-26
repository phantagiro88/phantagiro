// Keep Calm, and Keep On Parenting: boleh digunakan tanpa internet.
// - Semua fail disimpan dalam telefon semasa app dibuka kali pertama (perlu internet sekali sahaja).
// - Selepas itu app dibuka terus dari simpanan (laju, tanpa internet), dan dikemas kini di belakang tabir bila ada internet.
// Naikkan nombor versi ini setiap kali fail app dikemas kini.
const PREFIX = 'keepcalm-';
const V = PREFIX + 'v8';
const FILES = [
  './', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/nunito-latin-400-normal.woff2', 'fonts/nunito-latin-600-normal.woff2',
  'fonts/nunito-latin-700-normal.woff2', 'fonts/nunito-latin-800-normal.woff2',
  'fonts/lora-latin-600-normal.woff2', 'fonts/lora-latin-600-italic.woff2',
  'fonts/lora-latin-700-normal.woff2', 'fonts/lora-latin-700-italic.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// Padam salinan lama Keep Calm sahaja; simpanan app lain tidak disentuh.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.indexOf(PREFIX) === 0 && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (new URL(r.url).origin !== location.origin) return;
  const isPage = r.mode === 'navigate';
  e.respondWith((async () => {
    const c = await caches.open(V);
    const key = isPage ? './' : r;
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(r).then(res => {
      if (res && res.ok && !res.redirected) c.put(key, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    return (await c.match('./')) || Response.error();
  })());
});
