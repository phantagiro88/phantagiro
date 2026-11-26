const V='99malam-v2';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-180.png','icon-512.png','fonts/bc500.ttf','fonts/bc600.ttf','fonts/bc700.ttf','fonts/pirata.ttf'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k.indexOf('99malam')===0).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
/* Laju & offline: guna salinan simpanan dahulu, kemas kini di latar belakang untuk lawatan seterusnya */
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(m=>{
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res}).catch(()=>null);
    if(m){e.waitUntil(net);return m}
    return net.then(res=>res||c.match('./')||c.match('index.html'));
  })));
});
