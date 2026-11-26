// Belanjawan: boleh guna luar talian.
// - Fail app disimpan semasa pasang dan dikemas kini setiap kali ada internet.
// - Halaman: cuba rangkaian dulu (maks 3 saat), kalau gagal/lambat guna salinan simpanan.
const CACHE = 'belanjawan-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req){
  return new Promise(resolve => {
    const fallback = () => caches.match(req, {ignoreSearch: true})
      .then(r => r || caches.match('index.html'))
      .then(r => resolve(r || Response.error()));
    const timer = setTimeout(fallback, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); }
      resolve(res);
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
}
function staleWhileRevalidate(req){
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); }
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate' ? networkFirst(req) : staleWhileRevalidate(req));
});
