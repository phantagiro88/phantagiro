import * as THREE from 'three';

/* =====================================================================
   Kebun Juta - game kebun 3D. Kumpul $1,000,000 dengan jual bunga & buah.
   ===================================================================== */
const GOAL = 1000000, START_PLOTS = 4, MAXPLOTS = 24, COLS = 4, GAP = 2.3, KEY = 'kebunjuta.v1';

// unlock = jumlah duit yang pernah dijual sebelum benih ini dibuka
const CROPS = [
  { id: 'daisy',    e: '🌼', n: { ms: 'Daisy',     en: 'Daisy' },      cost: 5,      sell: 9,      time: 5,   unlock: 0 },
  { id: 'strawberi',e: '🍓', n: { ms: 'Strawberi', en: 'Strawberry' }, cost: 20,     sell: 38,     time: 10,  unlock: 60 },
  { id: 'epal',     e: '🍎', n: { ms: 'Epal',      en: 'Apple' },      cost: 80,     sell: 170,    time: 20,  unlock: 350 },
  { id: 'mawar',    e: '🌹', n: { ms: 'Mawar',     en: 'Rose' },       cost: 250,    sell: 600,    time: 35,  unlock: 1500 },
  { id: 'mangga',   e: '🥭', n: { ms: 'Mangga',    en: 'Mango' },      cost: 1000,   sell: 2800,   time: 60,  unlock: 7000 },
  { id: 'kelapa',   e: '🥥', n: { ms: 'Kelapa',    en: 'Coconut' },    cost: 5000,   sell: 16000,  time: 120, unlock: 35000 },
  { id: 'sakura',   e: '🌸', n: { ms: 'Sakura',    en: 'Sakura' },     cost: 25000,  sell: 90000,  time: 240, unlock: 180000 },
  { id: 'tembikai', e: '🍉', n: { ms: 'Tembikai',  en: 'Melon' },      cost: 100000, sell: 420000, time: 420, unlock: 700000 }
];
const byId = Object.fromEntries(CROPS.map(c => [c.id, c]));
// Stesen haiwan: beri makan (kos) -> tunggu -> kutip hasil
const ITEMS = { fish: { e: '🐟', sell: 90 }, egg: { e: '🥚', sell: 220 }, wool: { e: '🧶', sell: 2000 } };
const STATIONS = [
  { id: 'pond', item: 'fish', e: '🐟', n: { ms: 'Kolam Ikan', en: 'Fish Pond' },       cost: 120,  count: 4, time: 30, unlock: 800,   x: -2.5 },
  { id: 'coop', item: 'egg',  e: '🥚', n: { ms: 'Reban Ayam', en: 'Chicken Coop' },     cost: 400,  count: 6, time: 45, unlock: 4000,  x: 0 },
  { id: 'pen',  item: 'wool', e: '🧶', n: { ms: 'Kandang Biri-biri', en: 'Sheep Pen' }, cost: 2500, count: 5, time: 90, unlock: 25000, x: 2.5 }
];
const ST_Z = -3.3;
const prod = id => byId[id] || ITEMS[id];
const plotPrice = n => Math.round(30 * Math.pow(1.55, n));
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');

/* ---------- bahasa ---------- */
const L = {
  ms: {
    hint: '👆 Tekan tanah untuk tanam!', plantAll: '🌱 Tanam semua', harvestAll: '🧺 Tuai semua', sell: '🏪 Jual',
    basketEmpty: '🧺 kosong', winTitle: 'Tahniah!', winText: 'Kamu dah kumpul <b>$1,000,000</b>!<br>Kamu petani paling hebat! 🌟',
    keep: '🌱 Teruskan main', restart: '🔄 Mula semula',
    noMoney: '💰 Duit tak cukup', noMoneyPlot: '💰 Duit tak cukup untuk tanah baru',
    lock: (e, a) => `🔒 Jual sehingga ${a} untuk buka ${e}`, harvestFirst: '🧺 Tuai dulu, baru jual!',
    allFull: '🌱 Semua tanah dah penuh', notRipe: '⏳ Belum ada yang masak', gift: '🎁 Hadiah $10 untuk kamu!',
    lockedSeed: '🔒 Benih ini belum dibuka', stUnlocked: n => `🎉 ${n} dibuka!`, langBtn: 'BM'
  },
  en: {
    hint: '👆 Tap the soil to plant!', plantAll: '🌱 Plant all', harvestAll: '🧺 Harvest all', sell: '🏪 Sell',
    basketEmpty: '🧺 empty', winTitle: 'Congratulations!', winText: 'You collected <b>$1,000,000</b>!<br>You are the best farmer! 🌟',
    keep: '🌱 Keep playing', restart: '🔄 Start over',
    noMoney: '💰 Not enough money', noMoneyPlot: '💰 Not enough money for new land',
    lock: (e, a) => `🔒 Sell up to ${a} to unlock ${e}`, harvestFirst: '🧺 Harvest first, then sell!',
    allFull: '🌱 All plots are full', notRipe: '⏳ Nothing is ripe yet', gift: '🎁 A $10 gift for you!',
    lockedSeed: '🔒 This seed is still locked', stUnlocked: n => `🎉 ${n} unlocked!`, langBtn: 'EN'
  }
};

/* ---------- simpan / muat ---------- */
const fresh = () => ({ money: 20, earned: 0, basket: {}, plots: Array(START_PLOTS).fill(null), sel: 'daisy', st: {}, sound: true, won: false, planted: false, lang: 'ms' });
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && Array.isArray(j.plots) && byId[j.sel]) return Object.assign(fresh(), j);
  } catch (e) {}
  return fresh();
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const t = k => L[S.lang][k];
const $id = id => document.getElementById(id);
const shelf = $id('shelf'), basketEl = $id('basket'), sellBtn = $id('sellBtn'), moneyEl = $id('money'), canvas = $id('c');

/* ---------- bunyi ---------- */
let ac;
function beep(f, d = .1, type = 'sine', v = .07, when = 0) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    const s = ac.currentTime + when;
    g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.0001, s + d);
    o.start(s); o.stop(s + d + .02);
  } catch (e) {}
}
const sfx = {
  plant: () => beep(440, .1),
  water: () => beep(700, .06, 'triangle'),
  harvest: () => { beep(523, .1); beep(784, .14, 'sine', .07, .08); },
  sell: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .14, 'sine', .07, i * .07)),
  no: () => beep(160, .2, 'square', .04),
  win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => beep(f, .25, 'sine', .08, i * .12))
};

/* ---------- bantuan UI ---------- */
let toastT;
function toast(msg) { const el = $id('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1700); }
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function floatText(txt, x, y) {
  const s = document.createElement('div'); s.className = 'fl'; s.textContent = txt;
  s.style.left = (x - 24) + 'px'; s.style.top = y + 'px';
  $id('fx').appendChild(s); setTimeout(() => s.remove(), 950);
}
function coinBurst(from) {
  const tg = moneyEl.getBoundingClientRect(), r = from.getBoundingClientRect();
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('div'); c.className = 'coin'; c.textContent = '💰';
    const x = r.left + r.width / 2 + (Math.random() * 60 - 30), y = r.top;
    c.style.left = x + 'px'; c.style.top = y + 'px'; $id('fx').appendChild(c);
    setTimeout(() => { c.style.transform = `translate(${tg.left + 30 - x}px,${tg.top + 20 - y}px) scale(.6)`; c.style.opacity = '.2'; }, 30 + i * 50);
    setTimeout(() => c.remove(), 1100 + i * 50);
  }
  moneyEl.classList.add('pop'); setTimeout(() => moneyEl.classList.remove('pop'), 400);
}
function confetti() {
  const em = ['🎉', '⭐', '🌟', '💰', '🌸', '🍓', '🍎', '🌼', '🍉'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div'); c.className = 'conf'; c.textContent = em[i % em.length];
    c.style.left = Math.random() * 100 + 'vw'; c.style.animationDuration = (2 + Math.random() * 2.5) + 's'; c.style.animationDelay = (Math.random() * 1.5) + 's';
    $id('fx').appendChild(c); setTimeout(() => c.remove(), 6000);
  }
}

/* =====================================================================
   3D
   ===================================================================== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ee6ff);
scene.fog = new THREE.Fog(0x9ee6ff, 38, 90);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7fbf6a, 1.05));
const sun = new THREE.DirectionalLight(0xfff3d6, 1.25); sun.position.set(6, 12, 7); scene.add(sun);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 200);

// cache geometri & bahan supaya ringan
const GC = {}, MC = {};
const geo = (k, f) => GC[k] || (GC[k] = f());
const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return MC[k] || (MC[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o))); };
const ico = (r, d = 1) => geo('i' + r + '_' + d, () => new THREE.IcosahedronGeometry(r, d));
const cyl = (rt, rb, h, s = 8) => geo(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const box = (w, h, d) => geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false });
const shadowGeo = new THREE.CircleGeometry(.8, 20);

// tanah besar + awan
const ground = mesh(new THREE.PlaneGeometry(400, 400), mat(0x5cc24f)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.3; scene.add(ground);
const clouds = [];
for (let i = 0; i < 7; i++) {
  const c = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = mesh(ico(1.4 + Math.random() * .8, 1), mat(0xffffff, { emissive: 0x666666 }), k * 1.6 - 1.6, Math.random() * .4, Math.random() * .8); c.add(b); }
  c.position.set(-40 + i * 14, 11 + Math.random() * 4, -14 - Math.random() * 22); c.userData.sp = .25 + Math.random() * .35;
  scene.add(c); clouds.push(c);
}
// beberapa pokok hiasan di sekeliling
for (let i = 0; i < 14; i++) {
  const a = i / 14 * Math.PI * 2, rr = 22 + (i % 3) * 5, g = new THREE.Group();
  g.add(mesh(cyl(.2, .28, 1.4), mat(0x8d6e63), 0, .7, 0)); g.add(mesh(ico(1.1, 1), mat(i % 2 ? 0x43a047 : 0x2e9e5b), 0, 2, 0));
  g.position.set(Math.cos(a) * rr, -.3, Math.sin(a) * rr + 4); scene.add(g);
}

/* ---------- label sprite (teks 3D) ---------- */
function makeLabel() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(1.5, .75, 1); sp.renderOrder = 10;
  let last = '';
  return {
    sprite: sp,
    set(lines) {
      const key = lines.join('|'); if (key === last) return; last = key;
      ctx.clearRect(0, 0, 256, 128); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const sizes = lines.length > 1 ? [58, 46] : [64];
      const ys = lines.length > 1 ? [40, 98] : [64];
      lines.forEach((tx, i) => {
        ctx.font = `900 ${sizes[i]}px ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif`;
        ctx.lineWidth = 10; ctx.strokeStyle = '#3b2a1a'; ctx.strokeText(tx, 128, ys[i]);
        ctx.fillStyle = '#fff'; ctx.fillText(tx, 128, ys[i]);
      });
      tex.needsUpdate = true; sp.visible = lines.length > 0 && lines[0] !== '';
    },
    dispose() { tex.dispose(); sp.material.dispose(); }
  };
}

/* ---------- model tumbuhan ---------- */
function fruitRing(g, bloom, color, r, radius, cy, n, sy = 1, phase = 0) {
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + phase, f = mesh(ico(r, 1), mat(color), Math.cos(a) * radius, cy + (k % 2 ? .18 : -.12), Math.sin(a) * radius);
    f.scale.y = sy; g.add(f); bloom.push(f);
  }
}
function buildPlant(id) {
  const g = new THREE.Group(), bloom = [], ripen = [];
  switch (id) {
    case 'daisy': {
      g.add(mesh(cyl(.04, .05, .8, 6), mat(0x4caf50), 0, .4, 0));
      const lf = mesh(box(.28, .04, .12), mat(0x66bb6a), .16, .25, 0); lf.rotation.z = .5; g.add(lf);
      const head = new THREE.Group(); head.position.set(0, .88, 0); head.rotation.x = -.5;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, p = mesh(ico(.12, 0), mat(0xffffff), Math.cos(a) * .25, Math.sin(a) * .25, 0); p.scale.set(1.6, .8, .5); p.rotation.z = a; head.add(p); }
      head.add(mesh(ico(.14, 1), mat(0xffc107), 0, 0, .03));
      g.add(head); bloom.push(head); break;
    }
    case 'strawberi': {
      const b = mesh(ico(.5, 1), mat(0x43a047), 0, .3, 0); b.scale.set(1.1, .7, 1.1); g.add(b);
      g.add(mesh(ico(.3, 1), mat(0x66bb6a), .32, .25, .2));
      fruitRing(g, bloom, 0xe53935, .11, .52, .3, 6, 1.2, .4); break;
    }
    case 'epal': {
      g.add(mesh(cyl(.1, .15, .8), mat(0x8d6e63), 0, .4, 0));
      g.add(mesh(ico(.7, 1), mat(0x4caf50), 0, 1.25, 0));
      fruitRing(g, bloom, 0xe53935, .12, .72, 1.2, 6, 1); break;
    }
    case 'mawar': {
      g.add(mesh(cyl(.04, .05, .95, 6), mat(0x388e3c), 0, .48, 0));
      [[.2, .3, 0.5], [-.2, .5, -0.5]].forEach(([x, y, r]) => { const lf = mesh(ico(.16, 0), mat(0x4caf50), x, y, 0); lf.scale.set(1.6, .4, 1); lf.rotation.z = r; g.add(lf); });
      const head = new THREE.Group(); head.position.y = 1.02;
      head.add(mesh(ico(.25, 1), mat(0xc2185b), 0, 0, 0));
      head.add(mesh(ico(.18, 1), mat(0xe91e63), 0, .1, 0));
      head.add(mesh(ico(.1, 1), mat(0xff6090), 0, .19, 0));
      g.add(head); bloom.push(head); break;
    }
    case 'mangga': {
      g.add(mesh(cyl(.14, .2, 1.0), mat(0x795548), 0, .5, 0));
      g.add(mesh(ico(.85, 1), mat(0x2e7d32), 0, 1.6, 0));
      g.add(mesh(ico(.5, 1), mat(0x388e3c), .55, 1.3, .2));
      fruitRing(g, bloom, 0xffa726, .14, .8, 1.35, 5, 1.35, .3); break;
    }
    case 'kelapa': {
      const trunk = mesh(cyl(.1, .17, 2.0), mat(0x8d6e63), 0, 1, 0); trunk.rotation.z = .1; g.add(trunk);
      const crown = new THREE.Group(); crown.position.set(-.1, 2, 0);
      for (let k = 0; k < 7; k++) {
        const arm = new THREE.Group(); arm.rotation.y = k / 7 * Math.PI * 2;
        const fr = mesh(box(1.1, .05, .22), mat(0x43a047), .55, 0, 0); fr.rotation.z = -.45; fr.position.y = -.12; arm.add(fr); crown.add(arm);
      }
      g.add(crown);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, c = mesh(ico(.15, 1), mat(0x6d4c41), -.1 + Math.cos(a) * .2, 1.85, Math.sin(a) * .2); g.add(c); bloom.push(c); }
      break;
    }
    case 'sakura': {
      g.add(mesh(cyl(.1, .17, .95), mat(0x6d4c41), 0, .48, 0));
      [[0, 1.4, 0, .68], [.5, 1.1, .2, .46], [-.45, 1.18, -.2, .5]].forEach(([x, y, z, r]) => {
        const m = mesh(ico(r, 1), mat(0x66bb6a), x, y, z); g.add(m);
        ripen.push({ m, young: mat(0x66bb6a), ripe: mat(r > .6 ? 0xffb7c5 : 0xff9bb5) });
      });
      break;
    }
    case 'tembikai': {
      const v = mesh(ico(.6, 1), mat(0x388e3c), 0, .3, 0); v.scale.set(1.4, .5, 1.4); g.add(v);
      g.add(mesh(ico(.35, 1), mat(0x4caf50), -.5, .25, -.2));
      [[.55, .3, .25], [-.5, .3, .4], [.05, .3, -.6]].forEach(([x, y, z]) => {
        const m = mesh(ico(.32, 1), mat(0xffc107, { emissive: 0x8a6100 }), x, y, z); m.scale.set(1, .85, 1.15); g.add(m); bloom.push(m);
      });
      break;
    }
  }
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = .02; g.add(sh);
  g.userData = { bloom, ripen, ready: null };
  return g;
}
function setRipe(g, ready) {
  if (g.userData.ready === ready) return; g.userData.ready = ready;
  g.userData.bloom.forEach(o => { o.visible = ready; });
  g.userData.ripen.forEach(r => { r.m.material = ready ? r.ripe : r.young; });
}


/* ---------- stesen haiwan ---------- */
function makeChicken() {
  const c = new THREE.Group();
  const body = mesh(ico(.16, 1), mat(0xffffff), 0, .2, 0); body.scale.set(1.2, 1, .9); c.add(body);
  c.add(mesh(ico(.08, 0), mat(0xeeeeee), -.17, .28, 0));
  const head = new THREE.Group(); head.position.set(.17, .33, 0);
  head.add(mesh(ico(.085, 1), mat(0xffffff), 0, 0, 0));
  const beak = mesh(cyl(0, .035, .08, 4), mat(0xffa000), .1, -.01, 0); beak.rotation.z = -Math.PI / 2; head.add(beak);
  head.add(mesh(ico(.04, 0), mat(0xe53935), 0, .09, 0));
  c.add(head);
  [-.05, .05].forEach(z => c.add(mesh(cyl(.012, .012, .12, 4), mat(0xffa000), 0, .06, z)));
  c.userData.head = head; return c;
}
function makeSheep() {
  const sh = new THREE.Group();
  const skin = mesh(ico(.24, 1), mat(0xf3d2b0), 0, .42, 0); skin.scale.set(1.3, 1, 1); sh.add(skin);
  const wool = new THREE.Group(); wool.position.y = .46;
  const core = mesh(ico(.34, 1), mat(0xfafafa), 0, 0, 0); core.scale.set(1.25, 1, 1); wool.add(core);
  [[.22, .12, .15], [-.22, .1, .15], [.12, .15, -.18], [-.16, .12, -.17], [0, .24, 0]].forEach(([x, y, z]) => wool.add(mesh(ico(.2, 1), mat(0xffffff), x, y, z)));
  sh.add(wool);
  sh.add(mesh(ico(.14, 1), mat(0x455a64), .46, .5, 0));
  [[.52, .62, .1], [.52, .62, -.1]].forEach(([x, y, z]) => sh.add(mesh(ico(.05, 0), mat(0x37474f), x - .08, y - .08, z)));
  [[.2, .12], [.2, -.12], [-.2, .12], [-.2, -.12]].forEach(([x, z]) => sh.add(mesh(cyl(.035, .035, .28, 5), mat(0x4e342e), x, .14, z)));
  sh.userData.wool = wool; return sh;
}
function buildStation(id) {
  const g = new THREE.Group(), anim = { root: g };
  if (id === 'pond') {
    g.add(mesh(cyl(1.0, 1.05, .3, 18), mat(0x9e9e9e), 0, .15, 0));
    g.add(mesh(cyl(.86, .86, .32, 24), mat(0x4fc3f7, { emissive: 0x0a3d5c }), 0, .15, 0));
    [[.3, -.3], [-.4, .35]].forEach(([x, z]) => g.add(mesh(cyl(.2, .2, .02, 10), mat(0x43a047), x, .33, z)));
    [[.95, .5], [1.05, .2], [-1.0, -.5]].forEach(([x, z]) => { g.add(mesh(cyl(.025, .025, .9, 5), mat(0x388e3c), x, .5, z)); g.add(mesh(cyl(.06, .06, .22, 6), mat(0x6d4c41), x, .95, z)); });
    anim.fish = [];
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group(), b = mesh(ico(.12, 1), mat(k % 2 ? 0xff7043 : 0xffb300), 0, 0, 0); b.scale.set(1.7, .8, .8); f.add(b);
      const tail = mesh(cyl(0, .09, .15, 4), mat(k % 2 ? 0xff7043 : 0xffb300), -.22, 0, 0); tail.rotation.z = Math.PI / 2; f.add(tail);
      f.userData = { a: k / 4 * Math.PI * 2, r: .3 + .13 * (k % 2), sp: .7 + .15 * k };
      g.add(f); anim.fish.push(f);
    }
  } else if (id === 'coop') {
    g.add(mesh(box(1.5, .9, 1.1), mat(0xc0392b), 0, .45, -.5));
    [[-1, .6], [1, -.6]].forEach(([sx, rz]) => { const r = mesh(box(.95, .08, 1.35), mat(0x8d3a2a), sx * .43, 1.05, -.5); r.rotation.z = rz * (sx > 0 ? 1 : 1) * (sx > 0 ? 1 : -1) * -1 * -1; g.add(r); });
    g.children[1].rotation.z = .6; g.children[2].rotation.z = -.6;
    g.add(mesh(box(.4, .5, .05), mat(0x5d4037), 0, .28, .06));
    g.add(mesh(box(1.6, .06, .06), mat(0xffecb3), 0, 1.4, -.5));
    const nest = mesh(cyl(.38, .42, .08, 12), mat(0xe6c35c), .95, .04, .55); g.add(nest);
    anim.eggs = new THREE.Group();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, e = mesh(ico(.085, 1), mat(0xfff3d6), .95 + Math.cos(a) * .17, .15, .55 + Math.sin(a) * .17); e.scale.y = 1.3; anim.eggs.add(e); }
    g.add(anim.eggs);
    anim.chickens = [];
    for (let k = 0; k < 3; k++) { const c = makeChicken(); c.userData.ph = k * 2.1; g.add(c); anim.chickens.push(c); }
  } else {
    const gr = mesh(box(1.9, .05, 1.9), mat(0x9be37f), 0, .03, 0); g.add(gr);
    [.25, .5].forEach(y => {
      [-.95, .95].forEach(z => g.add(mesh(box(2.05, .07, .07), mat(0xa1744a), 0, y, z)));
      [-.95, .95].forEach(x => g.add(mesh(box(.07, .07, 1.95), mat(0xa1744a), x, y, 0)));
    });
    [[-.95, -.95], [.95, -.95], [-.95, .95], [.95, .95], [0, -.95], [0, .95], [-.95, 0], [.95, 0]].forEach(([x, z]) => g.add(mesh(box(.1, .7, .1), mat(0x8d6e63), x, .35, z)));
    anim.sheep = [];
    for (let k = 0; k < 2; k++) { const sh = makeSheep(); sh.userData.ph = k * 3.3; g.add(sh); anim.sheep.push(sh); }
  }
  return { g, anim };
}
function buildLocked(def) {
  const g = new THREE.Group();
  g.add(mesh(box(1.9, .08, 1.9), mat(0xc8b79b), 0, .04, 0));
  g.add(mesh(cyl(.05, .05, 1.0, 5), mat(0x8d6e63), 0, .5, 0));
  g.add(mesh(box(.9, .45, .07), mat(0xd7b98a), 0, 1.0, 0));
  return g;
}
function animStation(s, time, pr, active, ready) {
  const a = s.anim; if (!a) return;
  a.root.scale.setScalar(ready ? 1 + Math.sin(time * 5) * .02 : 1);
  a.root.rotation.z = (time - s.jiggle < .4) ? Math.sin((time - s.jiggle) * 40) * .06 : 0;
  if (a.fish) {
    a.fish.forEach(f => {
      const u = f.userData, ang = u.a + time * u.sp * (ready ? 1.8 : 1);
      f.position.set(Math.cos(ang) * u.r, ready ? .3 + Math.abs(Math.sin(time * 5 + u.a * 2)) * .55 : .3, Math.sin(ang) * u.r);
      f.rotation.y = -(ang + Math.PI / 2);
    });
  } else if (a.chickens) {
    a.eggs.visible = ready;
    a.chickens.forEach(c => {
      const ph = c.userData.ph, w = time * .5 + ph, x = Math.sin(w) * .75, z = .55 + Math.cos(w * .8) * .22;
      const vx = Math.cos(w) * .75, vz = -Math.sin(w * .8) * .22 * .8;
      c.position.set(x, 0, z); c.rotation.y = -Math.atan2(vz, vx);
      c.userData.head.rotation.z = Math.max(0, Math.sin(time * 6 + ph)) * .5;
    });
  } else if (a.sheep) {
    a.sheep.forEach(sh => {
      const ph = sh.userData.ph, w = time * .25 + ph, x = Math.sin(w) * .45, z = Math.cos(w * .9) * .4;
      const vx = Math.cos(w) * .45, vz = -Math.sin(w * .9) * .4 * .9;
      sh.position.set(x, Math.abs(Math.sin(time * 3 + ph)) * .02, z); sh.rotation.y = -Math.atan2(vz, vx);
      const w1 = ready ? 1 : (active ? .45 + .55 * pr : .45);
      sh.userData.wool.scale.setScalar(w1);
    });
  }
}

/* ---------- kebun ---------- */
const farm = new THREE.Group(); scene.add(farm);
let slots = [], stSlots = [], buySlot = null, picks = [], builtCount = -1, builtMask = '', firstBuild = true;
const stMask = () => STATIONS.map(d => S.earned >= d.unlock ? '1' : '0').join('');
const slotPos = i => new THREE.Vector3((i % COLS - (COLS - 1) / 2) * GAP, 0, Math.floor(i / COLS) * GAP);
const pickMat = new THREE.MeshBasicMaterial({ visible: false });
const soilDark = mat(0x7b4f31), soilTop = mat(0x946038), soilReady = mat(0xffd45c, { emissive: 0x5a4000 });

function rebuildFarm() {
  slots.forEach(s => s.label.dispose()); if (buySlot) buySlot.label.dispose(); stSlots.forEach(s => s.label.dispose());
  farm.clear(); slots = []; picks = []; buySlot = null; stSlots = [];
  const n = S.plots.length, tiles = n + (n < MAXPLOTS ? 1 : 0), rows = Math.ceil(tiles / COLS);
  const zMin = ST_Z - 1.4, zMax = (rows - 1) * GAP + 1.3, d = zMax - zMin, cz = (zMin + zMax) / 2, w = COLS * GAP + .8;
  const base = mesh(box(1, 1, 1), mat(0xa6ee8f), 0, -.15, cz); base.scale.set(w, .25, d); farm.add(base);
  const rim = mesh(box(1, 1, 1), mat(0x6b4a2e), 0, -.27, cz); rim.scale.set(w + .35, .2, d + .35); farm.add(rim);
  for (let i = 0; i < tiles; i++) {
    const isBuy = i >= n, p = slotPos(i), grp = new THREE.Group(); grp.position.copy(p);
    const tile = mesh(box(1.95, .3, 1.95), isBuy ? mat(0xdff7c9) : soilDark, 0, 0, 0); grp.add(tile);
    const top = mesh(box(1.7, .05, 1.7), isBuy ? mat(0xbdeaa4) : soilTop, 0, .16, 0); grp.add(top);
    const pick = mesh(box(2.1, 1.7, 2.1), pickMat, 0, .8, 0); pick.userData = isBuy ? { buy: true } : { i }; grp.add(pick); picks.push(pick);
    const label = makeLabel(); label.sprite.position.set(0, 2.1, 0); grp.add(label.sprite);
    farm.add(grp);
    const slot = { grp, top, label, plant: null, key: '', isBuy, jiggle: -9 };
    if (isBuy) { buySlot = slot; label.set(['➕', fmt(plotPrice(n - START_PLOTS))]); label.sprite.position.y = 1.0; }
    else slots.push(slot);
  }
  STATIONS.forEach(def => {
    const grp = new THREE.Group(); grp.position.set(def.x, 0, ST_Z); farm.add(grp);
    const open = S.earned >= def.unlock, st = { def, grp, label: makeLabel(), open, anim: null, jiggle: -9 };
    if (open) { const m = buildStation(def.id); grp.add(m.g); st.anim = m.anim; } else grp.add(buildLocked(def));
    const pick = mesh(box(2.3, 1.6, 2.3), pickMat, 0, .8, 0); pick.userData = { st: def.id }; grp.add(pick); picks.push(pick);
    st.label.sprite.position.set(0, 2.1, 0); grp.add(st.label.sprite);
    stSlots.push(st);
  });
  builtCount = n; builtMask = stMask();
  if (firstBuild) { firstBuild = false; camTarget.set(0, 0, (Math.min(rows, 3) - 1) * GAP / 2 - 1.2); }
  farmBounds = { w, d, cz };
}
let farmBounds = { w: 10, d: 5, cz: 2 };

function syncStations(time, now) {
  stSlots.forEach(s => {
    const d = s.def, st = S.st[d.id];
    if (!s.open) { s.label.set([d.e + '🔒', fmt(d.unlock)]); return; }
    let pr = 0, ready = false;
    if (st) { pr = Math.min(1, Math.max(0, (now - st.at) / (st.ready - st.at))); ready = pr >= 1; }
    animStation(s, time, pr, !!st, ready);
    s.label.set(ready ? ['✨'] : st ? [timeLeft(st.ready - now)] : [d.e, fmt(d.cost)]);
    s.label.sprite.position.y = 2.1;
  });
}
function syncPlots(time) {
  if (builtCount !== S.plots.length || builtMask !== stMask()) {
    const old = builtMask, nw = stMask();
    rebuildFarm();
    if (old) STATIONS.forEach((d, i) => { if (old[i] === '0' && nw[i] === '1') { toast(t('stUnlocked')(d.n[S.lang])); sfx.win(); } });
  }
  const now = Date.now();
  S.plots.forEach((p, i) => {
    const s = slots[i]; if (!s) return;
    if (!p) {
      if (s.plant) { s.grp.remove(s.plant); s.plant = null; s.key = ''; }
      s.label.set([]); s.top.material = soilTop; return;
    }
    const key = p.c + ':' + p.at;
    if (s.key !== key) { if (s.plant) s.grp.remove(s.plant); s.plant = buildPlant(p.c); s.plant.position.y = .18; s.grp.add(s.plant); s.key = key; s.plant.userData.ready = null; }
    const pr = Math.min(1, Math.max(0, (now - p.at) / (p.ready - p.at))), ready = pr >= 1, g = s.plant;
    setRipe(g, ready);
    let sc = ready ? 1 : .28 + .62 * pr;
    if (ready) { g.position.y = .18 + Math.abs(Math.sin(time * 4 + i)) * .07; sc += Math.sin(time * 4 + i) * .02; }
    else {
      g.position.y = .18; g.rotation.z = Math.sin(time * 1.6 + i) * .04;
      if (time - s.jiggle < .4) g.rotation.z = Math.sin((time - s.jiggle) * 40) * .12;
    }
    if (ready) g.rotation.z = 0;
    g.scale.setScalar(sc);
    s.top.material = ready ? soilReady : soilTop;
    s.label.set(ready ? ['✨'] : [timeLeft(p.ready - now)]);
    s.label.sprite.position.y = ready ? 2.5 : 2.1;
  });
  syncStations(time, now);
  }
function timeLeft(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's'; }

/* ---------- kamera & kawalan ---------- */
const camTarget = new THREE.Vector3(0, 0, 2);
let az = .5, azT = .5, zoom = 1, fitDist = 14;
const EL = THREE.MathUtils.degToRad(46);
function fit() {
  const stage = $id('stage'), w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dH = (COLS * GAP / 2 + 1.1) / Math.tan(hf / 2), dV = (2.6 * GAP / 2 + 1) / Math.tan(vf / 2);
  fitDist = Math.max(dH, dV * .9) * 1.3;
}
function placeCam() {
  const d = fitDist * zoom;
  camera.position.set(camTarget.x + Math.sin(az) * Math.cos(EL) * d, Math.sin(EL) * d, camTarget.z + Math.cos(az) * Math.cos(EL) * d);
  camera.lookAt(camTarget);
}
function clampTarget() {
  const mx = farmBounds.w / 2, mz = farmBounds.d / 2;
  camTarget.x = Math.max(-mx, Math.min(mx, camTarget.x));
  camTarget.z = Math.max(farmBounds.cz - mz, Math.min(farmBounds.cz + mz, camTarget.z));
}
function setZoom(z) { zoom = Math.max(.4, Math.min(1.25, z)); }
function pan(dx, dy) {
  const H = canvas.clientHeight, k = 2 * fitDist * zoom * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / H;
  const rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az), se = Math.sin(EL);
  camTarget.x += -rx * dx * k + fx * dy * k / se;
  camTarget.z += -rz * dx * k + fz * dy * k / se;
  clampTarget();
}
const ptrs = new Map(); let tapInfo = null, pinchD = 0;
const pdist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
canvas.addEventListener('pointerdown', e => {
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) tapInfo = { x: e.clientX, y: e.clientY, moved: false };
  else { tapInfo = null; pinchD = pdist(); }
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1 && tapInfo) {
    if (!tapInfo.moved && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 8) tapInfo.moved = true;
    if (tapInfo.moved) pan(dx, dy);
  } else if (ptrs.size === 2) { const d = pdist(); if (pinchD) setZoom(zoom * pinchD / d); pinchD = d; }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return;
  if (ptrs.size === 1 && tapInfo && !tapInfo.moved && e.type === 'pointerup') onTap(e.clientX, e.clientY);
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0; tapInfo = null;
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (1 + e.deltaY * .001)); }, { passive: false });
$id('rotL').onclick = () => { azT -= Math.PI / 2; beep(500, .05); };
$id('rotR').onclick = () => { azT += Math.PI / 2; beep(500, .05); };

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function slotScreen(i, lift = 1.4) { return groupScreen(slots[i].grp, lift); }
function groupScreen(grp, lift = 1.4) {
  const v = grp.position.clone(); v.y += lift; v.project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
}
function onTap(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(picks, false)[0]; if (!hit) return;
  const u = hit.object.userData;
  if (u.buy) { buyPlot(); return; }
  if (u.st) { stationTap(u.st); return; }
  const i = u.i, p = S.plots[i];
  if (!p) { if (plantAt(i)) { sfx.plant(); refresh(); } }
  else if (Date.now() >= p.ready) { harvestAt(i); sfx.harvest(); refresh(); }
  else { p.ready -= 1500; const sp = slotScreen(i); floatText('💧', sp.x, sp.y); slots[i].jiggle = performance.now() / 1000; sfx.water(); save(); }
}

/* =====================================================================
   Logik game
   ===================================================================== */
const unlocked = c => S.earned >= c.unlock;
const basketValue = () => Object.entries(S.basket).reduce((a, [id, n]) => a + (prod(id) ? prod(id).sell * n : 0), 0);
const growingCount = () => S.plots.filter(Boolean).length + Object.values(S.st).filter(Boolean).length;
function deny(msg) { sfx.no(); shake(moneyEl); if (msg) toast(msg); }

function plantAt(i, quiet) {
  const c = byId[S.sel];
  if (!unlocked(c)) { if (!quiet) deny(t('lock')(c.e, fmt(c.unlock))); return false; }
  if (S.money < c.cost) { if (!quiet) deny(t('noMoney')); return false; }
  const now = Date.now();
  S.money -= c.cost; S.plots[i] = { c: c.id, at: now, ready: now + c.time * 1000 }; S.planted = true;
  return true;
}
function harvestAt(i) {
  const p = S.plots[i]; if (!p) return;
  S.basket[p.c] = (S.basket[p.c] || 0) + 1; S.plots[i] = null;
  if (slots[i]) { const sp = slotScreen(i); floatText('+1 ' + byId[p.c].e, sp.x, sp.y); }
}
function collectStation(s) {
  const d = s.def; S.basket[d.item] = (S.basket[d.item] || 0) + d.count; S.st[d.id] = null;
  const sp = groupScreen(s.grp, 1.8); floatText('+' + d.count + ' ' + ITEMS[d.item].e, sp.x, sp.y);
}
function stationTap(id) {
  const s = stSlots.find(x => x.def.id === id), d = s.def, st = S.st[id], now = Date.now(), sp = groupScreen(s.grp, 1.8);
  if (!s.open) { deny(t('lock')(d.e, fmt(d.unlock))); return; }
  if (!st) {
    if (S.money < d.cost) { deny(t('noMoney')); return; }
    S.money -= d.cost; S.st[id] = { at: now, ready: now + d.time * 1000 }; floatText('🍽️', sp.x, sp.y); sfx.plant(); refresh();
  } else if (now >= st.ready) { collectStation(s); sfx.harvest(); refresh(); }
  else { st.ready -= 1500; floatText('❤️', sp.x, sp.y); s.jiggle = performance.now() / 1000; sfx.water(); save(); }
}
function buyPlot() {
  if (S.plots.length >= MAXPLOTS) return;
  const price = plotPrice(S.plots.length - START_PLOTS);
  if (S.money < price) { deny(t('noMoneyPlot')); return; }
  S.money -= price; S.plots.push(null); sfx.plant(); refresh();
}
function sellAll() {
  const v = basketValue();
  if (v <= 0) { sfx.no(); shake(basketEl); toast(t('harvestFirst')); return; }
  S.money += v; S.earned += v; S.basket = {}; sfx.sell(); coinBurst(sellBtn); refresh();
  if (!S.won && S.money >= GOAL) { S.won = true; save(); showWin(); }
}
function showWin() { $id('win').hidden = false; sfx.win(); confetti(); }

/* ---------- HUD ---------- */
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  $id('lang').textContent = t('langBtn');
}
function updateHUD() {
  $id('moneyTxt').textContent = fmt(S.money);
  $id('goalFill').style.width = Math.max(2, Math.min(100, S.money / GOAL * 100)) + '%';
  $id('hint').hidden = S.planted;
  $id('snd').textContent = S.sound ? '🔊' : '🔇';
  shelf.innerHTML = '';
  CROPS.forEach(c => {
    const b = document.createElement('button'), lock = !unlocked(c);
    b.className = 'seed' + (S.sel === c.id ? ' sel' : '') + (lock ? ' lock' : '') + (!lock && S.money < c.cost ? ' poor' : '');
    b.innerHTML = '<span class="e">' + (lock ? '🔒' : c.e) + '</span><span class="n">' + c.n[S.lang] + '</span><span class="p">' + (lock ? fmt(c.unlock) : fmt(c.cost)) + '</span>';
    b.onclick = () => {
      if (lock) { deny(t('lock')(c.e, fmt(c.unlock))); return; }
      S.sel = c.id; beep(600, .05); updateHUD(); save();
    };
    shelf.appendChild(b);
  });
  const items = Object.entries(S.basket).filter(([id, n]) => n > 0 && prod(id));
  basketEl.innerHTML = items.length ? items.map(([id, n]) => '<span>' + prod(id).e + '×' + n + '</span>').join('') : '<span class="empty">' + t('basketEmpty') + '</span>';
  const v = basketValue(); $id('sellVal').textContent = fmt(v); sellBtn.classList.toggle('off', v <= 0);
  if (buySlot) buySlot.label.set(['➕', fmt(plotPrice(S.plots.length - START_PLOTS))]);
}
function refresh() { updateHUD(); save(); }

/* ---------- butang ---------- */
$id('plantAll').onclick = () => {
  let n = 0;
  for (let i = 0; i < S.plots.length; i++) { if (!S.plots[i]) { if (plantAt(i, true)) n++; else break; } }
  if (n) { sfx.plant(); refresh(); }
  else {
    const c = byId[S.sel];
    if (!S.plots.some(p => !p)) toast(t('allFull'));
    else deny(!unlocked(c) ? t('lockedSeed') : t('noMoney'));
  }
};
$id('harvestAll').onclick = () => {
  const now = Date.now(); let n = 0;
  S.plots.forEach((p, i) => { if (p && now >= p.ready) { harvestAt(i); n++; } });
  stSlots.forEach(s => { const st = S.st[s.def.id]; if (s.open && st && now >= st.ready) { collectStation(s); n++; } });
  if (n) { sfx.harvest(); refresh(); } else { sfx.no(); toast(t('notRipe')); }
};
sellBtn.onclick = sellAll;
$id('snd').onclick = () => { S.sound = !S.sound; updateHUD(); save(); beep(600, .08); };
$id('lang').onclick = () => { S.lang = S.lang === 'ms' ? 'en' : 'ms'; applyLang(); updateHUD(); save(); beep(600, .06); };
$id('keepPlaying').onclick = () => { $id('win').hidden = true; };
$id('restart').onclick = () => { const snd = S.sound, lg = S.lang; S = fresh(); S.sound = snd; S.lang = lg; $id('win').hidden = true; refresh(); };

/* ---------- gelung ---------- */
let lastSave = 0, lastGift = 0;
setInterval(() => {
  if (S.money < 5 && !growingCount() && !basketValue() && Date.now() - lastGift > 3000) { lastGift = Date.now(); S.money += 10; toast(t('gift')); updateHUD(); }
  if (Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); }
}, 500);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

function frame(ms) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const time = ms / 1000;
  az += (azT - az) * .12;
  clouds.forEach(c => { c.position.x += c.userData.sp * .016; if (c.position.x > 55) c.position.x = -55; });
  syncPlots(time);
  clampTarget(); placeCam();
  renderer.render(scene, camera);
}

new ResizeObserver(fit).observe($id('stage'));
window.addEventListener('resize', fit);
applyLang(); rebuildFarm(); fit(); refresh(); requestAnimationFrame(frame);
window.__game = { get S() { return S; }, CROPS, STATIONS, slots: () => slots, stSlots: () => stSlots, onTap, rebuildFarm, camera };

/* ---------- PWA: kemas kini automatik ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; save(); location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
