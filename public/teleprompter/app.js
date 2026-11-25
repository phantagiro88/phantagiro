'use strict';
(() => {
  const VERSION = '1.0.2';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ======================= Storan ======================= */
  const LS_SCRIPTS = 'tp.scripts.v1';
  const LS_SET = 'tp.settings.v1';
  const DEFAULTS = {
    wpm: 140, font: 44, lineH: 1.5, margin: 6, align: 'center',
    textColor: '#ffffff', bgColor: '#000000',
    mirror: false, marker: true, countdown: true,
    camera: false, facing: 'user', res: '720',
    overlay: 0.35, textOp: 0.9, fit: 'contain'
  };
  const loadJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Gagal simpan. Storan telefon penuh?'); } };

  let scripts = loadJSON(LS_SCRIPTS, []);
  if (!Array.isArray(scripts)) scripts = [];
  const S = Object.assign({}, DEFAULTS, loadJSON(LS_SET, {}));
  const saveScripts = () => saveJSON(LS_SCRIPTS, scripts);
  const saveSettings = () => saveJSON(LS_SET, S);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ======================= Utiliti ======================= */
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  const countWords = t => { const m = (t || '').trim(); return m ? m.split(/\s+/).length : 0; };
  const fmtTime = sec => {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  const estSeconds = words => words / S.wpm * 60;
  const autoTitle = text => {
    const first = (text || '').split('\n').map(x => x.trim()).find(Boolean) || '';
    return first.length > 40 ? first.slice(0, 40).trim() + '…' : first;
  };
  const displayTitle = s => (s.title || '').trim() || autoTitle(s.text) || 'Tanpa tajuk';
  const normText = t => String(t).replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n');
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(id, filled) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg'); s.setAttribute('class', 'i' + (filled ? ' f' : ''));
    const u = document.createElementNS(ns, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  }

  /* ======================= Navigasi ======================= */
  let view = 'home';
  function show(v, push = true) {
    const prev = view;
    if (prev === 'edit' && v !== 'edit') { flushEdit(); if (v !== 'prompter') cur = null; }
    if (prev === 'prompter' && v !== 'prompter') leavePrompter(v);
    if (prev === 'preview' && v !== 'preview') { try { $('#pv').pause(); } catch (e) {} if (v !== 'prompter') stopCamera(); }
    view = v;
    $$('.view').forEach(x => x.classList.toggle('active', x.id === 'v-' + v));
    if (push && v !== 'home') history.pushState({ v }, '');
    if (v === 'home') renderHome();
    if (v === 'prompter') enterPrompter();
  }
  history.replaceState({ v: 'home' }, '');
  window.addEventListener('popstate', e => {
    const target = (e.state && e.state.v) || 'home';
    if (view === 'prompter' && target !== 'prompter' && recording()) {
      history.pushState({ v: 'prompter' }, '');
      toast('Henti rakaman dahulu');
      return;
    }
    if (target !== view) show(target, false);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-back]')) history.back();
  });

  /* ======================= Skrin utama ======================= */
  function renderHome() {
    const list = $('#list'); list.innerHTML = '';
    const arr = [...scripts].sort((a, b) => b.updated - a.updated);
    $('#empty').hidden = arr.length > 0;
    for (const s of arr) {
      const words = countWords(s.text);
      const card = el('article', 'card');
      const main = el('div', 'card-main');
      main.appendChild(el('h3', '', displayTitle(s)));
      main.appendChild(el('p', 'snip', (s.text || '').replace(/\s+/g, ' ').trim() || '(kosong)'));
      main.appendChild(el('p', 'meta', words + ' perkataan · ≈ ' + fmtTime(estSeconds(words))));
      main.addEventListener('click', () => openPrompter(s.id));
      const go = el('button', 'go'); go.appendChild(icon('i-play', true)); go.appendChild(el('span', '', 'Mula'));
      go.addEventListener('click', () => openPrompter(s.id));
      const acts = el('div', 'card-actions');
      const bEdit = el('button', '', 'Edit'); bEdit.addEventListener('click', () => openEditor(s.id));
      const bDup = el('button', '', 'Duplikat'); bDup.addEventListener('click', () => duplicateScript(s.id));
      const bDel = el('button', 'del', 'Padam'); bDel.addEventListener('click', () => deleteScript(s.id));
      acts.append(bEdit, bDup, bDel);
      card.append(main, go, acts);
      list.appendChild(card);
    }
  }
  function duplicateScript(id) {
    const s = scripts.find(x => x.id === id); if (!s) return;
    scripts.push({ id: uid(), title: displayTitle(s) + ' (salinan)', text: s.text, updated: Date.now() });
    saveScripts(); renderHome(); toast('Skrip diduplikat');
  }
  function deleteScript(id) {
    const s = scripts.find(x => x.id === id); if (!s) return;
    if (!confirm('Padam skrip "' + displayTitle(s) + '"?')) return;
    scripts = scripts.filter(x => x.id !== id); if (cur && cur.id === id) cur = null; saveScripts(); renderHome(); toast('Skrip dipadam');
  }
  function createFromText(text) {
    const s = { id: uid(), title: autoTitle(text) || 'Skrip baharu', text: normText(text), updated: Date.now() };
    scripts.push(s); saveScripts();
    openEditor(s.id);
    toast('Ditampal ke skrip baharu');
  }

  /* ======================= Clipboard ======================= */
  async function readClip() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return null;
      return await navigator.clipboard.readText();
    } catch (e) { return null; }
  }
  let modalCb = null;
  function openPasteModal(cb) {
    modalCb = cb; $('#m-text').value = ''; $('#modal').hidden = false;
    setTimeout(() => $('#m-text').focus(), 50);
  }
  $('#m-cancel').addEventListener('click', () => { $('#modal').hidden = true; modalCb = null; });
  $('#m-ok').addEventListener('click', () => {
    const t = $('#m-text').value; $('#modal').hidden = true;
    const cb = modalCb; modalCb = null;
    if (!t.trim()) { toast('Tiada teks untuk ditampal'); return; }
    cb && cb(t);
  });
  $('#btn-paste-new').addEventListener('click', async () => {
    const t = await readClip();
    if (t === null) { openPasteModal(createFromText); return; }
    if (!t.trim()) { toast('Clipboard kosong. Salin skrip dahulu.'); return; }
    createFromText(t);
  });
  $('#btn-new').addEventListener('click', () => openEditor(null));
  $('#btn-open-settings').addEventListener('click', () => show('settings'));

  /* ======================= Editor ======================= */
  let cur = null, saveTimer = 0;
  function openEditor(id) {
    cur = id ? scripts.find(s => s.id === id) : { id: uid(), title: '', text: '', updated: Date.now() };
    if (!cur) return;
    $('#e-title').value = cur.title || '';
    $('#e-text').value = cur.text || '';
    updateEditStats();
    show('edit');
  }
  function saveCur() {
    if (!cur) return;
    if (!scripts.includes(cur)) {
      if (!cur.title.trim() && !cur.text.trim()) return;
      scripts.push(cur);
    }
    cur.updated = Date.now(); saveScripts();
  }
  function flushEdit() { clearTimeout(saveTimer); if (view === 'edit') saveCur(); }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveCur, 350); }
  function updateEditStats() {
    const w = countWords($('#e-text').value);
    $('#e-stats').textContent = w + ' perkataan · anggaran ' + fmtTime(estSeconds(w)) + ' pada ' + S.wpm + ' ppm';
  }
  $('#e-title').addEventListener('input', e => { cur.title = e.target.value; queueSave(); });
  $('#e-text').addEventListener('input', e => { cur.text = e.target.value; updateEditStats(); queueSave(); });
  function insertAtCursor(text) {
    const ta = $('#e-text'); text = normText(text);
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
    ta.selectionStart = ta.selectionEnd = a + text.length;
    cur.text = ta.value;
    if (!cur.title.trim()) { cur.title = autoTitle(cur.text); $('#e-title').value = cur.title; }
    updateEditStats(); queueSave();
  }
  $('#e-paste').addEventListener('click', async () => {
    const t = await readClip();
    if (t === null) { openPasteModal(insertAtCursor); return; }
    if (!t.trim()) { toast('Clipboard kosong'); return; }
    insertAtCursor(t); toast('Ditampal');
  });
  $('#e-go').addEventListener('click', () => {
    if (!$('#e-text').value.trim()) { toast('Skrip masih kosong'); return; }
    flushEdit(); openPrompter(cur.id);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushEdit(); });
  window.addEventListener('pagehide', flushEdit);

  /* ======================= Tetapan (UI) ======================= */
  const SLIDERS = [
    { k: 'wpm', label: 'Kelajuan skrol', min: 60, max: 300, step: 5, fmt: v => v + ' ppm' },
    { k: 'font', label: 'Saiz fon', min: 24, max: 160, step: 2, fmt: v => v + ' px' },
    { k: 'lineH', label: 'Jarak baris', min: 1, max: 2.4, step: 0.05, fmt: v => Number(v).toFixed(2) },
    { k: 'margin', label: 'Lebar margin tepi', min: 0, max: 30, step: 1, fmt: v => v + '%' },
    { k: 'overlay', label: 'Gelapkan latar di atas kamera', min: 0, max: 0.9, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { k: 'textOp', label: 'Kelegapan teks di atas kamera', min: 0.3, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' }
  ];
  const TEXT_COLORS = ['#ffffff', '#ffe066', '#d4af37', '#7cfc9a', '#ffb36b'];
  const BG_COLORS = ['#000000', '#141414', '#0b1a2b', '#1a0f2e', '#ffffff'];
  const refreshers = [];

  function buildSettings(box) {
    box.innerHTML = '';
    // slider
    for (const f of SLIDERS) {
      const row = el('div', 'row');
      const lab = el('label'); const name = el('span', '', f.label); const val = el('b'); lab.append(name, val);
      const inp = el('input'); inp.type = 'range'; inp.min = f.min; inp.max = f.max; inp.step = f.step;
      inp.addEventListener('input', () => setSetting(f.k, parseFloat(inp.value)));
      row.append(lab, inp); box.appendChild(row);
      refreshers.push(() => { inp.value = S[f.k]; val.textContent = f.fmt(S[f.k]); });
    }
    // pilihan
    const seg = (k, label, opts) => {
      const row = el('div', 'row'); row.appendChild(el('div', 'lbl', label));
      const g = el('div', 'seg'); const btns = [];
      for (const [val, text] of opts) {
        const b = el('button', '', text); b.type = 'button';
        b.addEventListener('click', () => setSetting(k, val));
        g.appendChild(b); btns.push([val, b]);
      }
      row.appendChild(g); box.appendChild(row);
      refreshers.push(() => btns.forEach(([val, b]) => b.classList.toggle('on', String(S[k]) === String(val))));
    };
    seg('align', 'Susunan teks', [['center', 'Tengah'], ['left', 'Kiri']]);
    // warna
    const colors = (k, label, list) => {
      const row = el('div', 'row'); row.appendChild(el('div', 'lbl', label));
      const g = el('div', 'swatches'); const sws = [];
      for (const c of list) {
        const b = el('button', 'swatch'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c);
        b.addEventListener('click', () => setSetting(k, c)); g.appendChild(b); sws.push([c, b]);
      }
      const ci = el('input'); ci.type = 'color'; ci.setAttribute('aria-label', 'Warna lain');
      ci.addEventListener('input', () => setSetting(k, ci.value));
      g.appendChild(ci); row.appendChild(g); box.appendChild(row);
      refreshers.push(() => { sws.forEach(([c, b]) => b.classList.toggle('on', S[k].toLowerCase() === c)); ci.value = S[k]; });
    };
    colors('textColor', 'Warna teks', TEXT_COLORS);
    colors('bgColor', 'Warna latar (tanpa kamera)', BG_COLORS);
    // suis
    const sw = (k, label) => {
      const row = el('div', 'sw'); row.appendChild(el('span', 't', label));
      const b = el('button'); b.type = 'button'; b.setAttribute('role', 'switch');
      b.addEventListener('click', () => setSetting(k, !S[k]));
      row.appendChild(b); box.appendChild(row);
      refreshers.push(() => { b.classList.toggle('on', !!S[k]); b.setAttribute('aria-checked', !!S[k]); });
    };
    sw('mirror', 'Mod cermin (untuk cermin teleprompter fizikal)');
    sw('marker', 'Tunjuk garis penanda bacaan');
    sw('countdown', 'Kira detik 3-2-1 sebelum mula');
    sw('camera', 'Guna kamera sebagai latar');
    seg('facing', 'Kamera', [['user', 'Depan'], ['environment', 'Belakang']]);
    seg('res', 'Resolusi rakaman', [['720', '720p'], ['1080', '1080p']]);
    seg('fit', 'Paparan kamera', [['contain', 'Muat (tiada potong)'], ['cover', 'Penuh skrin']]);
    const reset = el('button', 'btn', 'Set semula tetapan'); reset.type = 'button';
    reset.addEventListener('click', () => {
      if (!confirm('Set semula semua tetapan kepada asal?')) return;
      Object.assign(S, DEFAULTS); saveSettings(); applySettings('all');
    });
    box.appendChild(reset);
  }

  function setSetting(k, v) {
    if ((k === 'facing' || k === 'res') && recording()) { toast('Tidak boleh tukar semasa merakam'); return; }
    S[k] = v; saveSettings(); applySettings(k);
  }

  let rebuildTimer = 0;
  function applySettings(changed) {
    const stage = $('#stage'), vp = $('#v-prompter');
    stage.style.setProperty('--bg', S.bgColor);
    stage.style.setProperty('--tc', S.textColor);
    stage.style.setProperty('--fs', S.font + 'px');
    stage.style.setProperty('--lh', S.lineH);
    stage.style.setProperty('--lhn', S.lineH);
    stage.style.setProperty('--ta', S.align);
    vp.classList.toggle('cam-on', !!S.camera);
    $('#cam').classList.toggle('front', S.facing === 'user');
    $('#pmirror').classList.toggle('mirror', !!S.mirror);
    $('#marker').hidden = !S.marker;
    $('#backdrop').style.background = S.camera ? 'rgba(0,0,0,' + S.overlay + ')' : 'transparent';
    $('#pmirror').style.opacity = S.camera ? S.textOp : 1;
    $('#sp-range').value = S.wpm; $('#sp-label').textContent = S.wpm + ' ppm';
    $('#p-cam').classList.toggle('on', !!S.camera);
    $('#p-cam-l').textContent = 'Kamera';
    $('#p-flip').hidden = !S.camera;
    refreshers.forEach(f => f());
    fitCam();
    if (view === 'edit') updateEditStats();
    if (['font', 'lineH', 'margin', 'align', 'all'].includes(changed) && view === 'prompter') {
      clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 60);
    }
    if (changed === 'wpm') updateTimeUI(true);
    if (view === 'prompter') {
      if (changed === 'camera') { S.camera ? (camStream || startCamera()) : stopCamera(); }
      if ((changed === 'facing' || changed === 'res') && S.camera) startCamera();
    }
  }

  /* ======================= Teleprompter ======================= */
  const P = { id: null, title: '', text: '', words: 0, lines: [], pos: 0, max: 0, playing: false, started: false,
    last: 0, raf: 0, idx: 0, curEl: null, markerY: 0, lh: 0, dragging: false, lastTime: '' };

  function openPrompter(id) {
    const s = scripts.find(x => x.id === id); if (!s) return;
    if (!s.text.trim()) { toast('Skrip masih kosong'); return; }
    P.id = id; P.title = displayTitle(s); P.text = normText(s.text);
    P.pos = 0; P.started = false; P.playing = false;
    show('prompter');
  }
  function enterPrompter() {
    $('#p-title').textContent = P.title;
    $('#v-prompter').classList.remove('ui-hidden');
    $('#ui-show').hidden = true; $('#drawer').hidden = true;
    applySettings('none');
    setPlayUI();
    lockScreen();
    if (S.camera && !camStream) startCamera();
    requestAnimationFrame(() => requestAnimationFrame(rebuild));
  }
  function leavePrompter(next) {
    pause(); cancelCountdown(); stopMic(); if (next !== 'preview') stopCamera(); unlockScreen();
    $('#drawer').hidden = true;
  }

  function buildPrompter() {
    const stage = $('#stage'), box = $('#pcontent');
    const H = stage.clientHeight, W = stage.clientWidth;
    if (!H || !W) return;
    P.lh = S.font * S.lineH;
    P.markerY = Math.round(H * 0.36);
    box.style.paddingTop = Math.max(0, P.markerY - P.lh / 2) + 'px';
    box.style.paddingLeft = box.style.paddingRight = S.margin + '%';
    const m = $('#marker'); m.style.top = (P.markerY - P.lh / 2) + 'px'; m.style.height = P.lh + 'px';

    box.textContent = '';
    const frag = document.createDocumentFragment();
    let prevBlank = true, words = 0;
    for (const raw of P.text.split('\n')) {
      const t = raw.trim();
      if (!t) { if (!prevBlank) frag.appendChild(el('div', 'sp')); prevBlank = true; continue; }
      prevBlank = false;
      const p = el('div', 'para'); const ws = t.split(/\s+/);
      ws.forEach((w, i) => { p.appendChild(el('span', '', w)); if (i < ws.length - 1) p.appendChild(document.createTextNode(' ')); });
      words += ws.length; frag.appendChild(p);
    }
    box.appendChild(frag);
    P.words = words;

    // Kumpulkan perkataan mengikut baris sebenar (dua fasa: baca dahulu, kemudian tulis)
    const paras = $$('.para', box);
    const plan = paras.map(p => {
      const groups = []; let lastTop = null;
      for (const s of p.children) {
        const t = s.offsetTop;
        if (lastTop === null || Math.abs(t - lastTop) > 2) { groups.push([]); lastTop = t; }
        groups[groups.length - 1].push(s);
      }
      return groups;
    });
    paras.forEach((p, i) => {
      p.textContent = '';
      for (const g of plan[i]) {
        const ln = el('div', 'ln');
        g.forEach((s, j) => { ln.appendChild(s); if (j < g.length - 1) ln.appendChild(document.createTextNode(' ')); });
        p.appendChild(ln);
      }
    });

    const lines = [];
    for (const c of box.children) {
      if (c.classList.contains('sp')) lines.push({ el: c, spacer: true, top: c.offsetTop, bottom: c.offsetTop + c.offsetHeight });
      else for (const ln of c.children) lines.push({ el: ln, spacer: false, top: ln.offsetTop, bottom: ln.offsetTop + ln.offsetHeight });
    }
    P.lines = lines; P.idx = 0; P.curEl = null;
    let last = null;
    for (let i = lines.length - 1; i >= 0; i--) if (!lines[i].spacer) { last = lines[i]; break; }
    P.max = last ? Math.max(0, (last.top + last.bottom) / 2 - P.markerY) : 0;
  }
  function rebuild() {
    if (view !== 'prompter') return;
    const frac = P.max ? P.pos / P.max : 0;
    buildPrompter();
    setPos(P.pos === 0 ? 0 : frac * P.max);
    updateTimeUI(true);
  }
  window.addEventListener('resize', () => { if (view === 'prompter') { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 150); } });

  function pxPerSec() { return P.words ? P.max * S.wpm / (60 * P.words) : 0; }

  function setPos(p) {
    P.pos = Math.max(0, Math.min(P.max, p));
    $('#pcontent').style.transform = 'translate3d(0,' + (-P.pos) + 'px,0)';
    updateCur();
    $('#progress i').style.transform = 'scaleX(' + (P.max ? P.pos / P.max : 0) + ')';
    updateTimeUI();
  }
  function updateCur() {
    const L = P.lines; if (!L.length) return;
    const y = P.pos + P.markerY;
    let i = Math.min(P.idx, L.length - 1);
    while (i < L.length - 1 && L[i].bottom <= y) i++;
    while (i > 0 && L[i].top > y) i--;
    P.idx = i;
    const target = L[i].spacer ? null : L[i].el;
    if (target !== P.curEl) {
      if (P.curEl) P.curEl.classList.remove('cur');
      if (target) target.classList.add('cur');
      P.curEl = target;
    }
  }
  function updateTimeUI(force) {
    const total = estSeconds(P.words);
    const el0 = P.max ? (P.pos / P.max) * total : 0;
    const txt = fmtTime(el0) + ' / ' + fmtTime(total);
    if (force || txt !== P.lastTime) { $('#p-time').textContent = txt; P.lastTime = txt; }
  }

  function tick(ts) {
    if (!P.playing) return;
    const dt = Math.min(0.1, (ts - P.last) / 1000); P.last = ts;
    if (!P.dragging) {
      setPos(P.pos + pxPerSec() * dt);
      if (P.pos >= P.max - 0.5) { endReached(); return; }
    }
    P.raf = requestAnimationFrame(tick);
  }
  function play() {
    if (P.playing) return;
    if (P.pos >= P.max - 1) setPos(0);
    P.started = true; P.playing = true; P.last = performance.now();
    lockScreen(); setPlayUI();
    P.raf = requestAnimationFrame(tick);
  }
  function pause() {
    P.playing = false; cancelAnimationFrame(P.raf); setPlayUI();
  }
  function endReached() {
    P.playing = false; setPlayUI();
    toast(recording() ? 'Skrip tamat. Tekan Henti untuk simpan rakaman.' : 'Skrip tamat');
  }
  function setPlayUI() {
    const b = $('#p-play');
    b.querySelector('use').setAttribute('href', P.playing ? '#i-pause' : '#i-play');
    b.querySelector('span').textContent = P.playing ? 'Jeda' : 'Main';
  }
  function rewind() {
    pause(); cancelInertia(); setPos(0); P.started = false;
  }
  async function onPlayBtn() {
    if (cdActive) return;
    if (P.playing) { pause(); return; }
    if (!P.started || P.pos <= 1) {
      const ok = await runCountdown(); if (!ok) return;
    }
    play();
  }

  /* ---- Kira detik ---- */
  let cdActive = false, cdTimer = 0, cdResolve = null;
  function runCountdown() {
    return new Promise(res => {
      if (!S.countdown) { res(true); return; }
      const box = $('#countdown'), num = box.querySelector('span');
      let n = 3; num.textContent = n; box.hidden = false; cdActive = true; cdResolve = res;
      cdTimer = setInterval(() => {
        n--;
        if (n <= 0) { clearInterval(cdTimer); box.hidden = true; cdActive = false; cdResolve = null; res(true); }
        else { num.textContent = n; num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; }
      }, 1000);
    });
  }
  function cancelCountdown() {
    if (!cdActive) return;
    clearInterval(cdTimer); $('#countdown').hidden = true; cdActive = false;
    const r = cdResolve; cdResolve = null; r && r(false);
  }
  $('#countdown').addEventListener('click', cancelCountdown);

  /* ---- Gerak isyarat: tap = jeda/sambung, seret = skrol manual ---- */
  const G = { id: null, y0: 0, pos0: 0, t0: 0, moved: false, samples: [] };
  let inertiaRaf = 0;
  function cancelInertia() { cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; }
  const stage = $('#stage');
  stage.addEventListener('pointerdown', e => {
    if (cdActive) return;
    cancelInertia();
    G.id = e.pointerId; G.y0 = e.clientY; G.pos0 = P.pos; G.t0 = performance.now(); G.moved = false; G.samples = [[G.t0, e.clientY]];
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId !== G.id) return;
    const dy = e.clientY - G.y0;
    if (!G.moved && Math.abs(dy) > 8) { G.moved = true; P.dragging = true; }
    if (G.moved) {
      setPos(G.pos0 - dy);
      const now = performance.now(); G.samples.push([now, e.clientY]);
      while (G.samples.length > 2 && now - G.samples[0][0] > 100) G.samples.shift();
    }
  });
  function endGesture(e) {
    if (e.pointerId !== G.id) return;
    G.id = null;
    const dur = performance.now() - G.t0;
    if (!G.moved) {
      if (e.type === 'pointerup' && dur < 600) onPlayBtn();
      return;
    }
    P.dragging = false;
    const s = G.samples; let v = 0;
    if (s.length >= 2) { const a = s[0], b = s[s.length - 1]; if (b[0] > a[0]) v = -(b[1] - a[1]) / (b[0] - a[0]); } // px/ms
    if (Math.abs(v) > 0.3) coast(v);
  }
  stage.addEventListener('pointerup', endGesture);
  stage.addEventListener('pointercancel', endGesture);
  function coast(v) {
    let last = performance.now(); v = Math.max(-4, Math.min(4, v));
    const step = now => {
      const dt = now - last; last = now;
      setPos(P.pos + v * dt); v *= Math.pow(0.0015, dt / 1000);
      if (Math.abs(v) > 0.02 && P.pos > 0 && P.pos < P.max) inertiaRaf = requestAnimationFrame(step); else inertiaRaf = 0;
    };
    inertiaRaf = requestAnimationFrame(step);
  }
  stage.addEventListener('wheel', e => { e.preventDefault(); setPos(P.pos + e.deltaY); }, { passive: false });
  document.addEventListener('keydown', e => {
    if (view !== 'prompter') return;
    if (e.code === 'Space') { e.preventDefault(); onPlayBtn(); }
    if (e.code === 'ArrowUp') setPos(P.pos - 60);
    if (e.code === 'ArrowDown') setPos(P.pos + 60);
  });

  /* ---- Kawalan ---- */
  $('#p-play').addEventListener('click', onPlayBtn);
  $('#p-rewind').addEventListener('click', rewind);
  $('#sp-minus').addEventListener('click', () => setSetting('wpm', Math.max(60, S.wpm - 10)));
  $('#sp-plus').addEventListener('click', () => setSetting('wpm', Math.min(300, S.wpm + 10)));
  $('#sp-range').addEventListener('input', e => setSetting('wpm', parseInt(e.target.value, 10)));
  $('#f-minus').addEventListener('click', () => setSetting('font', Math.max(24, S.font - 4)));
  $('#f-plus').addEventListener('click', () => setSetting('font', Math.min(160, S.font + 4)));
  $('#p-cam').addEventListener('click', () => { if (recording()) { toast('Tidak boleh matikan kamera semasa merakam'); return; } setSetting('camera', !S.camera); });
  $('#p-flip').addEventListener('click', () => setSetting('facing', S.facing === 'user' ? 'environment' : 'user'));
  $('#p-set').addEventListener('click', () => { $('#drawer').hidden = !$('#drawer').hidden; });
  $('#drawer-close').addEventListener('click', () => { $('#drawer').hidden = true; });
  function hideUI() { $('#v-prompter').classList.add('ui-hidden'); $('#ui-show').hidden = false; $('#drawer').hidden = true; syncRecFloat(); }
  function showUI() { $('#v-prompter').classList.remove('ui-hidden'); $('#ui-show').hidden = true; syncRecFloat(); }
  $('#p-hide').addEventListener('click', hideUI);
  $('#ui-show').addEventListener('click', showUI);
  // ketuk dua kali pada skrin untuk tunjuk kawalan
  let lastTap = 0;
  stage.addEventListener('pointerup', e => {
    if (G.moved) return;
    const now = performance.now();
    if (now - lastTap < 320 && $('#v-prompter').classList.contains('ui-hidden')) showUI();
    lastTap = now;
  });

  /* ======================= Kunci skrin ======================= */
  let wl = null;
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && !wl) {
        wl = await navigator.wakeLock.request('screen');
        wl.addEventListener('release', () => { wl = null; });
      }
    } catch (e) { wl = null; }
  }
  function unlockScreen() { try { wl && wl.release(); } catch (e) {} wl = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && view === 'prompter') lockScreen();
  });

  /* ======================= Kamera & rakaman ======================= */
  let camStream = null, camTok = 0;
  function camErr(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Akses kamera ditolak. Benarkan kamera dan mikrofon dalam tetapan pelayar.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Kamera tidak ditemui.';
    if (n === 'NotReadableError') return 'Kamera sedang digunakan oleh app lain.';
    return 'Kamera gagal dibuka.';
  }
  let permWarm = false, micStream = null;
  async function startCamera() {
    stopCamera();
    const tok = ++camTok;
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      toast('Kamera tidak disokong. Buka app melalui HTTPS.'); S.camera = false; saveSettings(); applySettings('none'); return false;
    }
    // Sensor kamera landscape: minta dimensi landscape supaya iPhone/Android beri bidang pandang penuh (tiada potong/zum)
    const [w, h] = S.res === '1080' ? [1920, 1080] : [1280, 720];
    const vid = { facingMode: { ideal: S.facing }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } };
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    // Kali pertama sahaja: minta kamera + mikrofon serentak supaya kebenaran ditanya sekali.
    // Mikrofon terus dimatikan; ia hanya dihidupkan semasa merakam (elak penanda oren iOS).
    const attempts = !permWarm
      ? [{ video: vid, audio }, { video: { facingMode: { ideal: S.facing } }, audio: true }, { video: vid }, { video: true }]
      : [{ video: vid }, { video: { facingMode: { ideal: S.facing } } }, { video: true }];
    let s = null, err = null;
    for (const c of attempts) {
      try { s = await md.getUserMedia(c); break; } catch (e) { err = e; if (tok !== camTok) return false; }
    }
    if (tok !== camTok) { if (s) s.getTracks().forEach(t => t.stop()); return false; }
    if (!s) { toast(camErr(err), 4000); S.camera = false; saveSettings(); applySettings('none'); return false; }
    s.getAudioTracks().forEach(t => { t.stop(); s.removeTrack(t); });
    permWarm = true;
    camStream = s;
    const v = $('#cam'); v.srcObject = s;
    try { await v.play(); } catch (e) {}
    fitCam();
    return true;
  }
  function stopCamera() {
    camTok++;
    stopMic();
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    const v = $('#cam'); try { v.srcObject = null; } catch (e) {}
  }
  async function getMic() {
    stopMic();
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      return true;
    } catch (e) {
      micStream = null; toast('Mikrofon tidak dibenarkan. Rakaman akan tanpa suara.', 4000); return false;
    }
  }
  function stopMic() { if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; } }
  // Saiz video dikira sendiri (piksel) supaya sama di semua pelayar: Muat = tiada potong, Penuh = isi skrin
  function fitCam() {
    const v = $('#cam'), st = $('#stage');
    const vw = v.videoWidth, vh = v.videoHeight, W = st.clientWidth, H = st.clientHeight;
    if (!vw || !vh || !W || !H) return;
    const k = S.fit === 'cover' ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
    const w = vw * k, h = vh * k;
    Object.assign(v.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px', objectFit: 'fill' });
  }
  $('#cam').addEventListener('loadedmetadata', fitCam);
  $('#cam').addEventListener('resize', fitCam);
  window.addEventListener('resize', fitCam);

  let rec = null, chunks = [], recT0 = 0, recTimer = 0, recMime = '';
  let recBlob = null, recUrl = null;
  const recording = () => !!rec && rec.state !== 'inactive';
  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    const c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return c.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
  }
  async function toggleRecord() {
    if (recording()) { rec.stop(); return; }
    if (cdActive) { cancelCountdown(); return; }
    if (!window.MediaRecorder) { toast('Pelayar ini tidak menyokong rakaman video.', 4000); return; }
    if (!camStream) {
      S.camera = true; saveSettings(); applySettings('none');
      const ok = await startCamera(); if (!ok) return;
    }
    await getMic();
    rewind();
    if (!$('#v-prompter').classList.contains('ui-hidden')) hideUI();
    const ok = await runCountdown();
    if (!ok) { stopMic(); showUI(); return; }
    recMime = pickMime();
    const opts = { videoBitsPerSecond: S.res === '1080' ? 8e6 : 5e6 };
    if (recMime) opts.mimeType = recMime;
    const rs = new MediaStream([...camStream.getVideoTracks(), ...(micStream ? micStream.getAudioTracks() : [])]);
    try { rec = new MediaRecorder(rs, opts); }
    catch (e) { try { rec = new MediaRecorder(rs); } catch (e2) { stopMic(); toast('Rakaman gagal dimulakan.'); showUI(); return; } }
    chunks = [];
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = onRecStop;
    rec.onerror = () => toast('Ralat semasa merakam');
    rec.start(1000);
    recT0 = Date.now();
    recTimer = setInterval(() => { $('#rec-time').textContent = fmtTime((Date.now() - recT0) / 1000); }, 500);
    $('#rec-time').textContent = '0:00';
    setRecUI(true);
    play();
  }
  function onRecStop() {
    clearInterval(recTimer); stopMic();
    const type = (rec && rec.mimeType) || recMime || 'video/webm';
    const blob = new Blob(chunks, { type });
    chunks = []; setRecUI(false); pause(); showUI();
    if (!blob.size) { toast('Rakaman kosong. Cuba lagi.'); return; }
    if (recUrl) URL.revokeObjectURL(recUrl);
    recBlob = blob; recUrl = URL.createObjectURL(blob);
    openPreview();
  }
  function setRecUI(on) {
    const b = $('#p-rec');
    b.classList.toggle('on', on);
    b.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-rec');
    b.querySelector('span').textContent = on ? 'Henti' : 'Rakam';
    $('#recpill').hidden = !on;
    syncRecFloat();
  }
  function syncRecFloat() {
    $('#rec-float').hidden = !(recording() && $('#v-prompter').classList.contains('ui-hidden'));
  }
  $('#p-rec').addEventListener('click', toggleRecord);
  $('#rec-float').addEventListener('click', () => { if (recording()) rec.stop(); });

  /* ======================= Pratonton & simpan ======================= */
  const extOf = b => (b.type.includes('mp4') ? 'mp4' : 'webm');
  const fileName = b => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return 'content-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + extOf(b);
  };
  function openPreview() {
    const v = $('#pv'); v.src = recUrl;
    $('#pv-info').textContent = (extOf(recBlob).toUpperCase()) + ' · ' + (recBlob.size / 1048576).toFixed(1) + ' MB';
    show('preview');
  }
  function downloadBlob() {
    if (!recBlob) return;
    const a = document.createElement('a'); a.href = recUrl; a.download = fileName(recBlob);
    document.body.appendChild(a); a.click(); a.remove();
    toast('Muat turun dimulakan');
  }
  async function saveToPhone() {
    if (!recBlob) return;
    const file = new File([recBlob], fileName(recBlob), { type: recBlob.type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    downloadBlob();
  }
  $('#pv-save').addEventListener('click', saveToPhone);
  $('#pv-dl').addEventListener('click', downloadBlob);
  $('#pv-again').addEventListener('click', () => history.back());
  $('#pv-discard').addEventListener('click', () => {
    if (!confirm('Buang rakaman ini? Ia tidak boleh dikembalikan.')) return;
    if (recUrl) URL.revokeObjectURL(recUrl);
    recBlob = null; recUrl = null; $('#pv').removeAttribute('src');
    history.back();
  });

  /* ======================= PWA ======================= */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#btn-install').hidden = false; });
  $('#btn-install').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null; $('#btn-install').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        if (view === 'home') location.reload();
        else toast('Versi baharu sedia. Tutup dan buka semula app.', 4000);
      });
    });
  }

  /* ======================= Mula ======================= */
  $('#ver').textContent = VERSION;
  buildSettings($('#settings-box'));
  buildSettings($('#drawer-box'));
  applySettings('none');
  renderHome();
})();
