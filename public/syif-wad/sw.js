// Syif Wad: boleh dimain tanpa internet.
// - Semua fail dipasang ke simpanan semasa kali pertama dibuka (perlu internet sekali sahaja).
// - Selepas itu fail dibaca dari simpanan dahulu (laju, tanpa internet), dan dikemas kini di belakang tabir bila ada internet.
// Naikkan nombor versi ini setiap kali fail game dikemas kini.
const PREFIX='syifwad-';
const V=PREFIX+'v3';
const FILES=['./','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(V)
      .then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k.indexOf(PREFIX)===0&&k!==V).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(V);
    const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r).then(res=>{
      if(res&&res.ok&&!res.redirected)c.put(r,res.clone()).catch(()=>{});
      return res;
    }).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}
    const res=await net;
    if(res)return res;
    if(r.mode==='navigate'){const home=await c.match('./');if(home)return home;}
    return new Response('Luar talian',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
