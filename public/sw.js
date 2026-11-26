// Kebun Juta - service worker (skop akar: /)
// Repo ini juga menempatkan app lain di sub-folder (99-malam, belanjawan, dll.)
// yang ada service worker sendiri. Jadi worker ini HANYA mengurus fail game
// Kebun Juta dan tidak menyentuh cache atau permintaan app lain.
//
// Strategi: rangkaian dahulu (sentiasa dapat versi terbaru), tetapi jika
// rangkaian gagal atau terlalu perlahan, guna salinan simpanan supaya game
// boleh dimain tanpa internet.
const CACHE = 'kebun-juta-v3';
const CORE = ['./', './game.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const NAV_KEY = './';
const TIMEOUT_MS = 4000;
const OWN_PATHS = new Set(['/', '/index.html', '/game.js', '/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png']);

// Cloudflare boleh mengalihkan /index.html ke /. Respons yang pernah dialihkan
// tidak boleh dihidangkan semula untuk navigasi, jadi salin ia dahulu.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async u => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res.ok) await cache.put(u, await clean(res));
      } catch (_) { /* akan disimpan semasa digunakan */ }
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // padam hanya cache lama milik game ini, jangan sentuh cache app lain
    await Promise.all(keys.filter(k => k !== CACHE && k.indexOf('kebun-juta') === 0).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function handle(req) {
  const nav = req.mode === 'navigate';
  const cache = await caches.open(CACHE);
  const cached = () => cache.match(nav ? NAV_KEY : req, { ignoreSearch: true });
  const net = fetch(req);
  try {
    const res = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
    if (res.ok) cache.put(nav ? NAV_KEY : req, await clean(res.clone())).catch(() => {});
    return res;
  } catch (_) {
    const hit = await cached();
    if (hit) return hit;
    try { return await net; } catch (__) { return Response.error(); }
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!OWN_PATHS.has(url.pathname)) return; // biar app lain urus sendiri
  e.respondWith(handle(req));
});
