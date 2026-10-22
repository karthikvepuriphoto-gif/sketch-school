import { LESSONS, LEVELS, buildLesson } from './lessons.js';

// ---------------- storage ----------------
const KEY = 'sketchschool_v1';
const st = Object.assign({ done: {}, stars: {}, photos: [], watched: {}, badges: {}, pinHash: null, videos: null }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { toast('Storage is full, so the oldest photo was removed.'); st.photos.shift(); localStorage.setItem(KEY, JSON.stringify(st)); } };
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const h = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
const speak = (t) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; const v = speechSynthesis.getVoices().find(v => v.lang === 'en-US'); if (v) u.voice = v; u.rate = .95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } };

// ---------------- graphite engine ----------------
const W = 1600, H = 1200, K = 1.6;
const GRADES = {
  '2H': { c: [128, 132, 142], size: 3.2, flow: .3, grain: .55, about: 'Hard and light. Great for first sketch lines you can erase, and soft far-away things.' },
  'HB': { c: [84, 86, 95], size: 4, flow: .34, grain: .5, about: 'The everyday middle pencil. Good for outlines and mid-tones.' },
  '2B': { c: [48, 49, 56], size: 5.2, flow: .38, grain: .45, about: 'Soft and darker. Use it for shadows. Smudges easily.' },
  '6B': { c: [20, 20, 25], size: 8, flow: .48, grain: .35, about: 'Very soft and very dark. Save it for the darkest darks, like pupils and tires.' },
};
const TEX = {};
function makeTex() {
  for (const [g, o] of Object.entries(GRADES)) {
    TEX[g] = [0, 1, 2, 3].map(() => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), im = x.createImageData(32, 32);
      for (let i = 0; i < 32 * 32; i++) { const px = i % 32 - 15.5, py = (i / 32 | 0) - 15.5, d = Math.hypot(px, py) / 16; if (d > 1) continue; const a = (1 - d * d) * (Math.random() < o.grain ? Math.random() * .5 : 1); im.data.set([...o.c, a * 255], i * 4); }
      x.putImageData(im, 0, 0); return c;
    });
  }
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#0000'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); TEX.soft = c;
}
makeTex();
const sc = document.createElement('canvas'); sc.width = sc.height = 16; const sctx = sc.getContext('2d');
const tmp = document.createElement('canvas'); tmp.width = tmp.height = 128; const tctx = tmp.getContext('2d');
function paper(cv) {
  const x = cv.getContext('2d'); x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, cv.width, cv.height);
  const im = x.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n - 1; }
  x.putImageData(im, 0, 0);
}
function withClip(ctx, clip, fn) {
  if (!clip) return fn(); ctx.save(); ctx.setTransform(K, 0, 0, K, 0, 0);
  for (const c of clip) { c._p = c._p || new Path2D(c.d); ctx.clip(c._p, c.rule || 'nonzero'); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); fn(); ctx.restore();
}
function dab(ctx, s, x, y, p, prev) {
  if (s.t === 'pencil') {
    const g = GRADES[s.g] || GRADES.HB, size = g.size * K * (.7 + .6 * p) * 1.4;
    ctx.globalAlpha = Math.min(1, g.flow * Math.pow(p, 1.3) * 1.25); ctx.drawImage(TEX[s.g || 'HB'][(Math.random() * 4) | 0], x - size / 2, y - size / 2, size, size);
  } else if (s.t === 'lift') {
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .35 * p; const r = 22 * K; ctx.drawImage(TEX.soft, x - r, y - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over';
  } else if (s.t === 'smudge') {
    // blend: take the area under the stump, blur it (shrink + grow), and lay it back softly
    const r = 20 * K, d = 2 * r, sm = 7;
    sctx.clearRect(0, 0, 16, 16); sctx.drawImage(ctx.canvas, x - r, y - r, d, d, 0, 0, sm, sm);
    tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, 128, 128); tctx.imageSmoothingEnabled = true; tctx.drawImage(sc, 0, 0, sm, sm, 0, 0, d, d);
    tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(TEX.soft, 0, 0, d, d);
    ctx.globalAlpha = .28 * p; ctx.drawImage(tmp, 0, 0, d, d, x - r, y - r, d, d);
  }
  ctx.globalAlpha = 1;
}
// draw points [i0, i1) of stroke s
function drawRange(ctx, s, i0, i1) {
  withClip(ctx, s.clip, () => {
    const pts = s.p;
    if (pts.length === 1 && i0 === 0) { dab(ctx, s, pts[0][0] * K, pts[0][1] * K, pts[0][2]); return; }
    for (let i = Math.max(1, i0); i < i1; i++) {
      const a = pts[i - 1], b = pts[i], ax = a[0] * K, ay = a[1] * K, bx = b[0] * K, by = b[1] * K;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (s.t === 'pencil' ? 2.2 : s.t === 'smudge' ? 9 : 6)));
      let px = ax, py = ay;
      for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; dab(ctx, s, x, y, a[2] + (b[2] - a[2]) * t, [px, py]); px = x; py = y; }
    }
  });
}
const drawStroke = (ctx, s) => drawRange(ctx, s, 0, s.p.length);
function renderSteps(steps, upto, w = 800) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; paper(c); const x = c.getContext('2d');
  for (let i = 0; i <= upto && i < steps.length; i++) for (const s of steps[i].strokes) drawStroke(x, s);
  if (w === W) return c;
  const o = document.createElement('canvas'); o.width = w; o.height = w * .75; o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); return o;
}
const cache = {};
function lessonSteps(l) { return cache[l.id] = cache[l.id] || buildLesson(l); }
function thumb(l, w = 480) { const k = l.id + w; if (cache[k]) return cache[k]; const steps = l.upside ? lessonSteps(LESSONS.find(x => x.id === 'cat')) : lessonSteps(l); return cache[k] = renderSteps(steps, 99, w).toDataURL('image/jpeg', .85); }

// pressure words
function pressWord(p) { if (p < .2) return ['Barely touch the paper', 'Feather light']; if (p < .4) return ['Light', 'Gentle pressure']; if (p < .6) return ['Medium', 'Normal writing pressure']; if (p < .8) return ['Press harder', 'For shadows']; return ['Heavy', 'Darkest darks, like a core shadow']; }

const unlocked_ = (l) => { const i = LESSONS.indexOf(l); return st.unlockAll || i === 0 || !!st.done[LESSONS[i - 1].id] || !!st.done[l.id] || !!(st.unlocks || {})[l.id]; };
// ---------------- badges ----------------
const BADGES = [
  { id: 'first', em: '🌱', name: 'First Lesson', test: () => Object.keys(st.done).length >= 1 },
  ...LEVELS.map(lv => ({ id: 'lv_' + lv.id, em: { warm: '✏️', see: '👀', form: '🧊', subjects: '🍎', eyes: '👁️', space: '🛣️', hero: '🦸' }[lv.id], name: lv.name.split('· ')[1] + ' Master', test: () => LESSONS.filter(l => l.level === lv.id).every(l => st.done[l.id]) })),
  { id: 'value', em: '🎚️', name: 'Value Scale Pro', test: () => (st.stars.value || 0) >= 3 },
  { id: 'shadow', em: '🕵️', name: 'Shadow Detective', test: () => (st.stars.sphere || 0) >= 3 },
  { id: 'photos', em: '📸', name: 'Sketchbook Keeper', test: () => st.photos.length >= 3 },
  { id: 'videos', em: '🎬', name: 'Video Learner', test: () => Object.keys(st.watched).length >= 3 },
  { id: 'all', em: '🏆', name: 'Sketch School Graduate', test: () => LESSONS.every(l => st.done[l.id]) },
];
function checkBadges() { for (const b of BADGES) if (!st.badges[b.id] && b.test()) { st.badges[b.id] = Date.now(); save(); setTimeout(() => toast(`${b.em} New badge: ${b.name}!`), 400); } }
function starCount() { return Object.values(st.stars).reduce((a, b) => a + b, 0); }
function bar(title, back = true) { $('#ttl').textContent = title; $('#back').style.visibility = back ? 'visible' : 'hidden'; $('#stars').textContent = '⭐ ' + starCount(); }
$('#back').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/'; };

// ---------------- screens ----------------
let stopPlayer = () => { }, stopVideo = () => { };
function route() {
  stopPlayer(); stopPlayer = () => { }; stopVideo(); stopVideo = () => { }; speechSynthesis && speechSynthesis.cancel();
  const [, a, b] = location.hash.split('/');
  ({ '': home, learn, lesson: () => lesson(b), do: () => doIt(b), pencils, supplies, mistakes, videos, watch: () => watch(b), edit: () => editSteps(b), welcome, parent, badges, photos }[a || ''] || home)();
}
addEventListener('hashchange', route);

function home() {
  if (!st.onboarded) { location.replace('#/welcome'); return; }
  bar('Sketch School', false);
  const next = LESSONS.find(l => !st.done[l.id] && unlocked_(l)) || LESSONS.find(l => !st.done[l.id]) || LESSONS[LESSONS.length - 1];
  const lv = LEVELS.find(x => x.id === next.level), nDone = Object.keys(st.done).length;
  h(`<section class="hero"><div><div class="stepno">${lv.name}</div><h2>${next.emoji} ${esc(next.title)}</h2><p class="mute">Watch the pencil draw one step, then pause and draw it on your paper. Tap to continue when you're ready.</p>
   <div class="row" style="margin-top:14px"><a class="btn pri big" href="#/lesson/${next.id}">▶ ${nDone ? 'Continue' : 'Start'}</a><a class="btn" href="#/learn">See my path</a></div>
   <div class="prog" style="margin-top:16px;cursor:default"><div class="fill" style="width:${nDone / LESSONS.length * 100}%"></div></div><p class="mute">${nDone} of ${LESSONS.length} drawings done · ⭐ ${starCount()}</p></div>
   <img src="${thumb(next, 600)}" alt="" style="width:100%;border-radius:16px;box-shadow:0 10px 30px #0008;${next.upside ? 'transform:rotate(180deg)' : ''}"></section>
   <div class="grid" style="margin-top:16px">${[['learn', '🗺️', 'Learn', 'Your drawing path, one step at a time'], ['videos', '🎬', 'Playground', 'Draw-along videos picked by your parent'], ['photos', '📔', 'Journal', `${st.photos.length} drawing${st.photos.length === 1 ? '' : 's'} saved`]].map(([r, e, t, s]) => `<a class="tile space" href="#/${r}"><div class="em">${e}</div><h3>${t}</h3><small>${s}</small></a>`).join('')}</div>
   <h2>Artist toolbox</h2><div class="grid">${[['pencils', '✏️', 'Pencils & Grip', '2H, HB, 2B, 6B and how to hold'], ['supplies', '🎒', 'What You Need', 'Paper, pencils, stump, eraser'], ['mistakes', '🚫', 'Common Mistakes', 'And how to fix them'], ['badges', '🏅', 'Badges', `${Object.keys(st.badges).length} of ${BADGES.length} earned`]].map(([r, e, t, s]) => `<a class="tile" href="#/${r}"><div class="em">${e}</div><h3>${t}</h3><small>${s}</small></a>`).join('')}</div>`);
}
function welcome() {
  bar('Welcome!', false);
  const Q = [
    { k: 'exp', q: 'How much have you drawn before?', a: [['new', '🌱 I\'m just starting'], ['some', '✏️ I did some step-by-step drawing lessons'], ['lots', '🎨 I draw all the time']] },
    { k: 'shade', q: 'Have you shaded with a pencil to make things look 3D?', a: [['no', 'Not yet'], ['little', 'A little'], ['yes', 'Yes, lots']] },
    { k: 'fav', q: 'What do you want to draw most?', a: [['objects', '🍎 Real objects'], ['animals', '🐈 Animals & nature'], ['faces', '🙂 Faces & people'], ['cities', '🏢 Cities & roads']] },
  ];
  const prof = st.profile || {}; let i = 0;
  const sup = ['Paper (a sketchbook is best)', 'Pencils: 2H, HB, 2B, 6B (or a #2 school pencil)', 'A blending stump or tissue', 'A kneaded eraser (or any eraser)'];
  const draw = () => {
    if (i < Q.length) { const q = Q[i]; h(`<div class="card" style="max-width:620px;margin:10px auto"><div class="stepno">Question ${i + 1} of ${Q.length}</div><h2>${q.q}</h2><div class="q">${q.a.map(([v, t]) => `<button class="btn ${prof[q.k] === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div></div>`); app.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { prof[q.k] = b.dataset.v; i++; draw(); }); return; }
    if (i === Q.length) { h(`<div class="card" style="max-width:620px;margin:10px auto"><div class="stepno">Get ready</div><h2>Grab your supplies 🎒</h2><p class="mute">You'll draw on real paper. Tap what you have. Don't worry if you're missing something!</p><div class="check">${sup.map((s, k) => `<label><input type="checkbox" ${k < 2 ? 'checked' : ''}> ${s}</label>`).join('')}</div><div class="row" style="margin-top:12px"><button class="btn pri" id="nx">Ready! ▶</button><a class="btn" href="#/supplies">What are these?</a></div></div>`); $('#nx').onclick = () => { i++; draw(); }; return; }
    const skip = prof.exp !== 'new';
    st.profile = prof; st.onboarded = true; save();
    const first = LESSONS[0];
    h(`<div class="card" style="max-width:620px;margin:10px auto;text-align:center"><div style="font-size:60px">🎉</div><h2>Your drawing path is ready!</h2>
      <p>${skip ? 'You already know the basics like outlines and simple shapes, so we start with <b>real shading</b>: how hard to press and how to make things look 3D.' : 'We start with the most important skill for realistic drawing: <b>how hard to press</b> to make light and dark.'}</p>
      <p class="mute">Learn a skill → draw a real subject → practice. Your favorite, ${({ objects: 'real objects', animals: 'animals & nature', faces: 'faces', cities: 'cities & roads' })[prof.fav] || 'real things'}, is on the way!</p>
      <img src="${thumb(first, 600)}" alt="" style="width:100%;border-radius:14px;margin:8px 0"><a class="btn pri big" href="#/lesson/${first.id}">▶ Start: ${esc(first.title)}</a></div>`);
  };
  draw();
}
function learn() {
  bar('Lessons');
  h(`<p class="mute">Each drawing unlocks when you finish the one before it. Learn a skill, then use it on a real subject!</p>` + LEVELS.map(lv => `<h2 class="lvl" style="--c:${lv.color}">${lv.name}</h2><div class="grid">${LESSONS.filter(l => l.level === lv.id).map(l => unlocked_(l) ? `<a class="tile ${st.done[l.id] ? 'done' : ''} ${!st.done[l.id] ? 'nextup' : ''}" href="#/lesson/${l.id}"><img src="${thumb(l, 400)}" alt="" style="width:100%;border-radius:12px;margin-bottom:8px;${l.upside ? 'transform:rotate(180deg)' : ''}"><h3>${l.emoji} ${esc(l.title)}</h3><small><span class="chip">${l.level === 'subjects' || l.level === 'space' ? 'Subject' : 'Skill'}</span>${'⭐'.repeat(st.stars[l.id] || 0) || `About ${l.minutes} min`}</small></a>` : `<div class="tile locked"><div style="aspect-ratio:4/3;border-radius:12px;background:#ffffff0d;display:grid;place-items:center;font-size:40px;margin-bottom:8px">🔒</div><h3>${l.emoji} ${esc(l.title)}</h3><small>Finish the drawing before this one to unlock</small></div>`).join('')}</div>`).join(''));
}

function lesson(id) {
  const l = LESSONS.find(x => x.id === id); if (!l) return home(); if (!unlocked_(l)) { toast('🔒 Finish the drawing before this one first!'); return learn(); }
  bar(l.emoji + ' ' + l.title);
  const steps = l.upside ? [] : lessonSteps(l);
  if (l.upside) {
    h(`<div class="player"><div class="boardwrap"><img src="${thumb(LESSONS.find(x => x.id === 'cat'), 1200)}" alt="Upside-down picture" style="width:100%;height:100%;transform:rotate(180deg)"></div>
    <div class="side">${(st.demoDone = st.demoDone || {}, st.demoDone[l.id] = 1, save(), '')}${l.build().map((s, i) => `<div class="card"><div class="stepno">Step ${i + 1}</div><h3>${s.title}</h3><p>${s.say}</p></div>`).join('')}<a class="btn pri" href="#/do/${l.id}">✏️ My turn on paper</a></div></div>`);
    return;
  }
  h(`<div class="player"><div><div class="boardwrap" id="board"><canvas id="pc" width="${W}" height="${H}"></canvas><canvas id="dc" width="${W}" height="${H}"></canvas><div class="labels" id="labs"></div><div class="sov" id="sov"><div class="sovin"><div class="stepno" id="sovn"></div><div id="sovc" class="sovc"></div><button class="btn pri big" id="sgo">Tap when you've drawn this step ▶</button><button class="btn sm" id="srep">↺ Replay this step</button></div></div>
     <svg class="pencil" id="pen" viewBox="0 0 44 44"><g transform="rotate(45 22 22)"><rect x="18" y="-6" width="8" height="34" rx="1.5" fill="#fbbf24"/><rect x="18" y="-6" width="8" height="5" fill="#f472b6"/><polygon points="18,28 26,28 22,38" fill="#f1d3a1"/><polygon points="20.6,34.5 23.4,34.5 22,38" fill="#333"/></g></svg></div>
     <div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><div><span class="grade" id="gd">HB</span><span class="gname" id="gw">Light</span></div><small class="mute" id="gs"></small></div><div class="gauge"><i id="gi" style="left:0"></i></div><div class="row mute" style="justify-content:space-between;font-size:12px"><span>Barely touch</span><span>Medium</span><span>Heavy</span></div></div></div>
   <div class="side"><div class="card"><div class="stepno" id="sn"></div><h3 id="st"></h3><p id="ss"></p>${l.credit ? `<p class="mute" style="font-size:13px">🎨 ${esc(l.credit)}</p>` : ''}<button class="btn sm" id="say">🔊 Read to me</button></div>
     <div class="card"><div class="ctrls"><button class="btn" id="bprev" aria-label="Previous step">⏮</button><button class="btn pri" id="bplay" aria-label="Play">▶</button><button class="btn" id="bstep" aria-label="Next step">⏭</button></div>
     <div class="seg" id="spd" style="margin-top:10px">${[.5, 1, 2, 4].map(s => `<button data-s="${s}" class="${s === 1 ? 'on' : ''}">${s}×</button>`).join('')}</div>
     <div class="dots" id="dots" style="margin-top:12px">${steps.map((_, i) => `<span data-i="${i}"></span>`).join('')}</div></div>
     <a class="btn pri" href="#/do/${l.id}" style="text-align:center;text-decoration:none">✏️ My turn on paper</a></div></div>
   <h2>Before &amp; after</h2><div class="ba"><figure><img alt="Before" src="${renderSteps(steps, 1, 600).toDataURL('image/jpeg', .85)}"><figcaption>Outline only</figcaption></figure><figure><img alt="After" src="${thumb(l, 600)}"><figcaption>With shading</figcaption></figure></div>`);
  const dc = $('#dc'), ctx = dc.getContext('2d'), pc = $('#pc'), pen = $('#pen'); paper(pc);
  let step = 0, si = 0, pi = 0, playing = false, speed = 1, raf = 0, last = 0, rate = 400, carry = 0, pauseUntil = 0;
  const totalPts = (s) => s.strokes.reduce((a, b) => a + b.p.length, 0);
  function showStep() {
    const s = steps[step]; $('#sn').textContent = `Step ${step + 1} of ${steps.length}`; $('#st').textContent = s.title; $('#ss').textContent = s.say;
    $('#labs').innerHTML = (s.labels || []).map(b => `<div class="lab" style="left:${b.x / 10}%;top:${b.y / 7.5}%">${esc(b.t)}</div>`).join('');
    document.querySelectorAll('#dots span').forEach((d, i) => d.className = i === step ? 'on' : i < step ? 'past' : '');
    rate = Math.max(120, totalPts(s) / Math.min(14, Math.max(4, totalPts(s) / 250)));
    const g = s.strokes.find(x => x.t === 'pencil'); if (g) $('#gd').textContent = g.g;
  }
  function redrawTo(n) { $('#sov').classList.remove('on'); ctx.clearRect(0, 0, W, H); for (let i = 0; i < n; i++) for (const s of steps[i].strokes) drawStroke(ctx, s); step = n; si = 0; pi = 0; showStep(); }
  function setGauge(s, p) {
    $('#gi').style.left = `calc(${p * 100}% - 3px)`; const [w, sub] = pressWord(p);
    if (s.t === 'pencil') { $('#gd').textContent = s.g; $('#gw').textContent = w; $('#gs').textContent = sub; }
    else { $('#gd').textContent = s.t === 'smudge' ? 'Stump' : 'Eraser'; $('#gw').textContent = s.t === 'smudge' ? 'Blend in small circles' : 'Dab to lift graphite'; $('#gs').textContent = ''; }
  }
  function tick(t) {
    raf = requestAnimationFrame(tick); const dt = Math.min(50, t - (last || t)); last = t; if (!playing || t < pauseUntil) return;
    const s = steps[step]; if (!s.strokes.length) return nextStep();
    carry += rate * speed * dt / 1000; let budget = Math.floor(carry); carry -= budget;
    while (budget > 0 && si < s.strokes.length) {
      const k = s.strokes[si], end = Math.min(k.p.length, pi + budget);
      drawRange(ctx, k, pi, end); budget -= (end - pi); const q = k.p[end - 1]; pen.style.left = q[0] / 10 + '%'; pen.style.top = q[1] / 7.5 + '%'; setGauge(k, q[2]);
      pi = end; if (pi >= k.p.length) { si++; pi = 0; }
    }
    if (si >= s.strokes.length) nextStep();
  }
  const ENC = ['Take your time. There is no rush.', 'It is OK if yours looks a little different. That is your style!', 'Nice and slow is how artists draw.', 'Light lines first. You can always go darker.', 'Look at the demo, then look at your paper.'];
  function nextStep() {
    playing = false; pen.style.opacity = 0; $('#bplay').textContent = '▶';
    const last = step >= steps.length - 1; if (last) { finished = true; st.demoDone = st.demoDone || {}; st.demoDone[l.id] = 1; save(); }
    $('#sovn').textContent = last ? '🎉 All steps done!' : `Step ${step + 1} of ${steps.length} · your turn`;
    $('#sovc').innerHTML = `<b>${esc(steps[step].title)}</b><br><span class="mute">${last ? 'Awesome work! Snap a photo of your drawing for your Journal.' : esc(ENC[step % ENC.length])}</span>`;
    $('#sgo').textContent = last ? '📸 Finish & add to my Journal' : "Tap when you've drawn this step ▶";
    $('#sov').classList.add('on');
  }
  function cont() { $('#sov').classList.remove('on'); if (finished) { location.hash = '#/do/' + l.id; return; } step++; si = 0; pi = 0; showStep(); playing = true; pen.style.opacity = 1; $('#bplay').textContent = '⏸'; }
  $('#sov').onclick = (e) => { if (e.target.id === 'srep') return; cont(); };
  $('#srep').onclick = () => { $('#sov').classList.remove('on'); finished = false; redrawTo(step); playing = true; pen.style.opacity = 1; $('#bplay').textContent = '⏸'; };
  let finished = false;
  $('#bplay').onclick = () => { if ($('#sov').classList.contains('on')) return cont(); if (finished) { finished = false; redrawTo(0); } playing = !playing; pen.style.opacity = playing ? 1 : .5; $('#bplay').textContent = playing ? '⏸' : '▶'; };
  $('#bstep').onclick = () => { if ($('#sov').classList.contains('on')) return cont(); const s = steps[step]; for (let i = si; i < s.strokes.length; i++) drawRange(ctx, s.strokes[i], i === si ? pi : 0, s.strokes[i].p.length); si = s.strokes.length; nextStep(); };
  $('#bprev').onclick = () => { finished = false; redrawTo(Math.max(0, step - (si === 0 && pi === 0 ? 1 : 0))); };
  $('#dots').onclick = (e) => { const i = e.target.dataset.i; if (i != null) { finished = false; redrawTo(+i); } };
  $('#spd').onclick = (e) => { if (!e.target.dataset.s) return; speed = +e.target.dataset.s; document.querySelectorAll('#spd button').forEach(b => b.classList.toggle('on', b === e.target)); };
  $('#say').onclick = () => speak(steps[step].title + '. ' + steps[step].say);
  showStep(); raf = requestAnimationFrame(tick);
  window.__player = { get step() { return step; }, get playing() { return playing; }, get finished() { return finished; } };
  stopPlayer = () => cancelAnimationFrame(raf);
}

function doIt(id) {
  const l = LESSONS.find(x => x.id === id); if (!l) return home(); if (!unlocked_(l)) return learn(); const ex = l.exercise; const mins = ex.minutes || Math.min(15, l.minutes);
  bar('My turn: ' + l.title);
  h(`<div class="player"><div><div class="card"><h2 style="margin-top:0">✏️ ${esc(ex.text)}</h2><p class="mute">Use real paper and pencils. Look back at the demo any time.</p>
     <div class="timer" id="tm">${mins}:00</div><div class="row" style="justify-content:center"><button class="btn pri" id="tgo">▶ Start timer</button><button class="btn" id="trs">Reset</button>${[5, 10, 15, 20].map(m => `<button class="btn sm" data-m="${m}">${m} min</button>`).join('')}</div></div>
     <div class="card" style="margin-top:12px"><h3>Check your drawing</h3><div class="check" id="ck">${ex.check.map((c, i) => `<label><input type="checkbox" data-i="${i}"> ${esc(c)}</label>`).join('')}</div></div></div>
   <div class="side"><div class="card"><h3>Compare</h3><div class="ba"><figure><img alt="Demo" src="${thumb(l, 600)}" style="${l.upside ? 'transform:rotate(180deg)' : ''}"><figcaption>Demo</figcaption></figure><figure><img id="mine" alt="" style="display:none"><div id="noph" style="aspect-ratio:4/3;border-radius:12px;border:2px dashed #ffffff33;display:grid;place-items:center;color:var(--mute);text-align:center;padding:6px">Your drawing</div><figcaption>Yours</figcaption></figure></div>
     <label class="btn" style="display:block;text-align:center;margin-top:10px">📸 Take a photo (optional)<input id="ph" type="file" accept="image/*" capture="environment" hidden></label></div>
     <button class="btn pri" id="done" ${(st.demoDone || {})[l.id] || l.upside ? '' : 'disabled'}>✅ I finished my drawing</button>${(st.demoDone || {})[l.id] || l.upside ? '' : '<small class="mute">Watch every step of the demo first (pausing to draw each one), then come back.</small>'}<a class="btn" href="#/lesson/${l.id}" style="text-align:center;text-decoration:none">↩ Watch the demo again</a></div></div>`);
  let left = mins * 60, run = false, iv = setInterval(() => { if (!run) return; left = Math.max(0, left - 1); show(); if (!left) { run = false; $('#tgo').textContent = '▶ Start timer'; toast('⏰ Time! Check your drawing.'); speak('Time is up! Check your drawing.'); } }, 1000);
  const show = () => $('#tm').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  stopPlayer = () => clearInterval(iv);
  $('#tgo').onclick = () => { run = !run; $('#tgo').textContent = run ? '⏸ Pause' : '▶ Start timer'; };
  $('#trs').onclick = () => { left = mins * 60; run = false; $('#tgo').textContent = '▶ Start timer'; show(); };
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { left = +b.dataset.m * 60; show(); });
  let photo = null;
  $('#ph').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), s = Math.min(1, 640 / Math.max(img.width, img.height)); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); photo = c.toDataURL('image/jpeg', .7); $('#mine').src = photo; $('#mine').style.display = 'block'; $('#noph').style.display = 'none'; URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
  $('#done').onclick = () => {
    const n = app.querySelectorAll('#ck input:checked').length, tot = ex.check.length, stars = n === tot ? 3 : n >= tot / 2 ? 2 : 1;
    st.done[l.id] = Date.now(); st.stars[l.id] = Math.max(st.stars[l.id] || 0, stars);
    if (photo) st.photos.push({ id: l.id, t: Date.now(), img: photo });
    save(); checkBadges(); toast(`${'⭐'.repeat(stars)} Great work!`); speak(stars === 3 ? 'Awesome job! Three stars!' : 'Nice work! Keep practicing.');
    const nx = LESSONS[LESSONS.indexOf(l) + 1]; setTimeout(() => location.hash = nx ? '#/lesson/' + nx.id : '#/badges', 1200);
  };
}

function swatch(g, mode = 'ramp') {
  const c = document.createElement('canvas'); c.width = W; c.height = 300; paper(c); const x = c.getContext('2d');
  const s = { t: 'pencil', g, p: [] };
  if (mode === 'ramp') { for (let r = 0; r < 26; r++) { const pts = []; for (let i = 0; i <= 120; i++) pts.push([30 + i * 7.6, 25 + r * 6 + Math.sin(i * .7) * 1.5, i / 120]); drawStroke(x, { ...s, p: pts }); } }
  return c.toDataURL('image/jpeg', .85);
}
function pencils() {
  bar('Pencils & Grip');
  h(`<p class="mute">Pencils are graded by how hard the "lead" (really graphite and clay) is. <b>H</b> means hard and light. <b>B</b> means soft and black. The bigger the number, the stronger it is.</p>
   <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${Object.entries(GRADES).map(([g, o]) => `<div class="card"><h3><span class="grade">${g}</span> ${{ '2H': 'Hard & light', 'HB': 'Middle', '2B': 'Soft & dark', '6B': 'Super soft & black' }[g]}</h3><img class="swatch" alt="${g} pressure ramp" src="${swatch(g)}"><div class="row mute" style="justify-content:space-between;font-size:12px"><span>Barely touch</span><span>Press harder →</span></div><p>${o.about}</p></div>`).join('')}</div>
   <p class="mute">Notice: even pressing hard, a 2H never gets as dark as a 6B. To go darker, switch to a softer pencil instead of pressing so hard you dent the paper.</p>
   <h2>How to hold the pencil</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
   <div class="card">${gripSVG('tripod')}<h3>Tripod grip: for lines and details</h3><p>Hold it like you write: thumb, pointer and middle finger. The point touches the paper. Use it for outlines, eyes, lashes and small details.</p></div>
   <div class="card">${gripSVG('over')}<h3>Overhand grip: for shading</h3><p>Hold the pencil under your palm, almost flat, and shade with the <b>side</b> of the lead. Move from your elbow and shoulder. You get big, smooth tones fast with less pressure.</p></div>
   <div class="card">${gripSVG('far')}<h3>Hold it farther back: for light sketching</h3><p>Holding near the end makes your lines lighter and looser, which is perfect for the first sketch.</p></div></div>
   <h2>Pressure, in words</h2><div class="card">${[.1, .3, .5, .7, .9].map(p => `<div class="row" style="margin:6px 0"><div class="gauge" style="flex:0 0 140px;margin:0"><i style="left:calc(${p * 100}% - 3px)"></i></div><b>${pressWord(p)[0]}</b><span class="mute">${pressWord(p)[1]}</span></div>`).join('')}</div>`);
}
function gripSVG(k) {
  const pencil = (x, y, a, len = 190) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="0" y="-7" width="${len}" height="14" rx="2" fill="#fbbf24"/><rect x="${len - 16}" y="-7" width="16" height="14" fill="#f472b6"/><polygon points="0,-7 0,7 -24,0" fill="#f1d3a1"/><polygon points="-16,-2.5 -16,2.5 -24,0" fill="#333"/></g>`;
  const paperRect = `<rect x="10" y="150" width="300" height="40" rx="6" fill="#f6f2e8"/>`;
  if (k === 'tripod') return `<svg viewBox="0 0 320 200" width="100%">${paperRect}${pencil(110, 148, -55)}<ellipse cx="175" cy="70" rx="42" ry="30" fill="#e0ac84"/><ellipse cx="148" cy="92" rx="16" ry="11" fill="#d39a72"/><ellipse cx="160" cy="62" rx="18" ry="10" fill="#d39a72"/><text x="200" y="140" fill="#a3a8bd" font-size="14">tip on paper</text><path d="M110 148 q60 0 80 -10" stroke="#555" fill="none" stroke-width="2" stroke-dasharray="3 4"/></svg>`;
  if (k === 'over') return `<svg viewBox="0 0 320 200" width="100%">${paperRect}${pencil(80, 150, -12, 210)}<ellipse cx="200" cy="110" rx="70" ry="34" fill="#e0ac84"/><ellipse cx="150" cy="128" rx="22" ry="10" fill="#d39a72"/><text x="30" y="140" fill="#a3a8bd" font-size="14">side of the lead</text><rect x="50" y="160" width="120" height="16" rx="8" fill="#6b6e78" opacity=".5"/></svg>`;
  return `<svg viewBox="0 0 320 200" width="100%">${paperRect}${pencil(70, 150, -40, 220)}<ellipse cx="225" cy="30" rx="34" ry="24" fill="#e0ac84"/><text x="40" y="120" fill="#a3a8bd" font-size="14">loose & light</text></svg>`;
}
function supplies() {
  bar('What You Need');
  const it = [['📄', 'Drawing paper', 'A sketchbook with slightly rough ("toothy") paper holds graphite better than printer paper. Printer paper is fine to start.'], ['✏️', 'Pencils: 2H, HB, 2B, 6B', 'A basic sketching set is perfect. A regular #2 school pencil is about an HB.'], ['🧻', 'Blending stump', 'A pencil-shaped stick of rolled paper for smooth blending. A cotton swab or tissue works too. Fingers leave oily smudges.'], ['🩶', 'Kneaded eraser', 'Soft and squishy like putty. Press and lift to lighten areas and make highlights without wearing out the paper.'], ['⬜', 'Regular eraser', 'For cleaning up lines. A white plastic eraser works great.'], ['🔪', 'Pencil sharpener', 'A sharp point for details, a duller point for shading. Ask a grown-up before using a craft knife.'], ['📏', 'Ruler', 'For value scale boxes and perspective lines.'], ['💡', 'A lamp', 'Shine a lamp on an apple or ball so you can see real light and shadow.']];
  h(`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${it.map(([e, t, s]) => `<div class="card"><div style="font-size:36px">${e}</div><h3>${t}</h3><p class="mute">${s}</p></div>`).join('')}</div>
   <h2>Set up your space</h2><div class="card"><p>✅ Sit at a table with good light.</p><p>✅ Put a scrap of paper under your hand so it doesn't smudge your drawing.</p><p>✅ Right-handed? Shade from left to right. Lefty? Right to left.</p></div>`);
}
function mistakes() {
  bar('Common Mistakes');
  const sp = lessonSteps(LESSONS.find(l => l.id === 'sphere'));
  const sph = (dark) => { const c = renderSteps([{ strokes: [sp[0].strokes[0]] }], 0, W), x = c.getContext('2d'); dark(x); return c; };
  const shrink = (c) => { const o = document.createElement('canvas'); o.width = 400; o.height = 300; o.getContext('2d').drawImage(c, 0, 0, 400, 300); return o.toDataURL('image/jpeg', .85); };
  const box = (x0, y0, x1, y1) => polyClip([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const polyClip = (pts) => [{ d: 'M' + pts.map(p => p.join(',')).join(' L') + ' Z' }];
  const H8 = (ctx, box, ang, gap, v, g, clip) => { const [x0, y0, x1, y1] = box; for (let o = -800; o < 1600; o += gap) { const pts = []; for (let t = -800; t < 1600; t += 8) { const x = Math.cos(ang) * t - Math.sin(ang) * o, y = Math.sin(ang) * t + Math.cos(ang) * o; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) pts.push([x, y, typeof v === 'function' ? v(x, y) : v]); } if (pts.length > 1) drawStroke(ctx, { t: 'pencil', g, p: pts, clip }); } };
  const C = [{ d: 'M300,350 a170,170 0 1,0 340,0 a170,170 0 1,0 -340,0 Z' }];
  const ex = [
    ['Outline too dark', 'Real objects don\'t have black outlines. Sketch lightly, then let the shading make the edge.', sph(x => { drawStroke(x, { t: 'pencil', g: '6B', p: sp[0].strokes[0].p.map(q => [q[0], q[1], 1]) }); drawStroke(x, { t: 'pencil', g: '6B', p: sp[0].strokes[0].p.map(q => [q[0] + 2, q[1] + 2, 1]) }); }), renderSteps(sp, 99, W)],
    ['Scribbly, messy shading', 'Keep strokes in the same direction and close together, or follow the shape.', sph(x => { for (let i = 0; i < 60; i++) { const a = []; let px = 300 + Math.random() * 340, py = 200 + Math.random() * 300; for (let k = 0; k < 6; k++) { px += (Math.random() - .5) * 90; py += (Math.random() - .5) * 90; a.push([px, py, .7]); } drawStroke(x, { t: 'pencil', g: '2B', p: a, clip: C }); } }), sph(x => H8(x, [300, 180, 640, 520], .8, 7, .5, 'HB', C))],
    ['Not enough contrast', 'Be brave with darks! Without a real dark, nothing looks 3D. Use a 6B for the darkest parts.', sph(x => H8(x, [300, 180, 640, 520], .8, 7, .2, '2H', C)), renderSteps(sp, 99, W)],
    ['Forgetting the light source', 'Shadows go on the side away from the light, the same for every object in the picture.', sph(x => H8(x, [300, 180, 640, 520], .8, 7, (X, Y) => Math.max(0, Math.min(1, 1 - Math.hypot(X - 400, Y - 260) / 300)), '2B', C)), renderSteps(sp, 99, W)],
    ['Smudging with your fingers', 'Fingers leave oily, blotchy marks. Use a blending stump or tissue.', sph(x => { H8(x, [300, 180, 640, 520], .8, 7, .45, 'HB', C); for (let i = 0; i < 9; i++) { const cx = 360 + Math.random() * 240, cy = 250 + Math.random() * 200; drawStroke(x, { t: 'pencil', g: '6B', p: Array.from({ length: 12 }, (_, k) => [cx + Math.cos(k) * 22, cy + Math.sin(k) * 22, .5]), clip: C }); } }), renderSteps(sp, 99, W)],
    ['Eyes too high on the face', 'Eyes go halfway down the head, not near the top.', null, null, 'face'],
  ];
  h(`<p class="mute">Every artist makes these. Spotting them is how you get better!</p><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${ex.map(([t, s, bad, good, f]) => `<div class="card"><h3>🚫 ${t}</h3>${bad ? `<div class="mist"><figure style="margin:0"><img class="bad" style="width:100%" alt="Mistake" src="${shrink(bad)}"><figcaption class="mute" style="text-align:center">Oops</figcaption></figure><figure style="margin:0"><img class="good" style="width:100%" alt="Better" src="${shrink(good)}"><figcaption class="mute" style="text-align:center">Better</figcaption></figure></div>` : `<img class="good" style="width:100%" alt="Face proportions" src="${thumb(LESSONS.find(l => l.id === f), 600)}">`}<p>✅ ${s}</p></div>`).join('')}
   <div class="card"><h3>🚫 Pressing too hard at the start</h3><p>✅ Dark first lines can't be erased and dent the paper. Start with a 2H and barely touch the paper. Build dark slowly in layers.</p></div>
   <div class="card"><h3>🚫 Drawing what you think, not what you see</h3><p>✅ Your brain says "an eye is a football shape." Look again! Try the upside-down and blind contour lessons.</p></div></div>`);
}

// ---------------- Playground: parent-curated draw-along videos ----------------
let SEED = [];
const vids = () => st.videos || SEED;
const ytThumb = (v) => v.provider === 'youtube' ? `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg` : 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#1ab7ea"/><text x="8" y="5.6" font-size="3" text-anchor="middle" fill="#fff">▶ Vimeo</text></svg>');
function videos() {
  bar('Playground');
  const list = vids();
  const card = (v) => { const i = list.indexOf(v); return `<a class="tile vcard ${st.watched[v.provider + v.id] ? 'done' : ''}" href="#/watch/${i}"><img alt="" src="${ytThumb(v)}" referrerpolicy="no-referrer"><h3 style="margin-top:8px">${esc(v.title)}</h3><small><span class="chip">${(v.steps || []).length + 1} steps</span>${esc(v.channel || '')}</small></a>`; };
  const sets = [...new Set(list.map(v => v.set || 'More videos'))];
  h(`<p class="mute">Draw-along videos picked by your parent 🔒. Each video stops after every step so you can draw it on your paper.</p>${sets.map(s => `<h2>${esc(s)}</h2>${s === 'Character Videos' ? '<p class="mute">Official how-to-draw videos from Disney, Marvel and DC.</p>' : ''}<div class="grid">${list.filter(v => (v.set || 'More videos') === s).map(card).join('')}</div>`).join('') || '<p>No videos yet. Ask a parent to add some.</p>'}
   <p style="margin-top:28px"><a class="btn sm" href="#/parent">🔐 Parent settings</a></p>`);
}
let ytReady, vmReady;
function loadYT() { return ytReady = ytReady || new Promise(res => { window.onYouTubeIframeAPIReady = res; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }); }
function loadVimeo() { return vmReady = vmReady || new Promise(res => { const s = document.createElement('script'); s.src = 'https://player.vimeo.com/api/player.js'; s.onload = res; document.head.appendChild(s); }); }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// Locked-down player: no YouTube controls, a tap shield over the frame, sandboxed iframe, our own end screen.
function makePlayer(box, v, on) {
  const origin = encodeURIComponent(location.origin);
  const src = v.provider === 'vimeo' ? `https://player.vimeo.com/video/${encodeURIComponent(v.id)}?title=0&byline=0&portrait=0&dnt=1&controls=0&playsinline=1`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&controls=0&iv_load_policy=3&cc_load_policy=0&origin=${origin}`;
  box.innerHTML = `<iframe id="yt" src="${src}" title="${esc(v.title)}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="shield" id="shield" aria-hidden="true"></div>`;
  const P = { playing: false, dur: v.duration || 0, player: null };
  P.play = () => { if (!P.player) return; v.provider === 'vimeo' ? P.player.play() : P.player.playVideo(); };
  P.pause = () => { if (!P.player) return; v.provider === 'vimeo' ? P.player.pause() : P.player.pauseVideo(); };
  P.time = async () => P.player ? await P.player.getCurrentTime() : 0;
  P.seek = (t) => { if (!P.player) return; v.provider === 'vimeo' ? P.player.setCurrentTime(t) : P.player.seekTo(t, true); };
  const set = (pl) => { P.playing = pl; on.state && on.state(pl); };
  if (v.provider === 'vimeo') loadVimeo().then(() => { P.player = new Vimeo.Player(box.querySelector('iframe')); P.player.getDuration().then(d => P.dur = d); P.player.on('play', () => set(true)); P.player.on('pause', () => set(false)); P.player.on('ended', () => { set(false); on.ended && on.ended(); }); on.ready && on.ready(); });
  else loadYT().then(() => { const p = new YT.Player(box.querySelector('iframe'), { events: { onReady: () => { P.player = p; P.dur = p.getDuration() || P.dur; window.__yt = p; on.ready && on.ready(); }, onStateChange: (e) => { if (e.data === 1) { P.dur = p.getDuration() || P.dur; set(true); } else if (e.data === 2) set(false); else if (e.data === 0) { set(false); on.ended && on.ended(); } } } }); });
  P.destroy = () => { try { P.player && (P.player.destroy ? P.player.destroy() : P.player.unload()); } catch (e) { } };
  return P;
}
// step k spans [start(k), end(k)); the last step runs to the end of the video
const stepEnds = (v, dur) => [...(v.steps || []).map(s => s.end).filter(e => !dur || e < dur - 1), dur || 1e9];
function watch(i) {
  const v = vids()[+i]; if (!v) return videos();
  bar(v.title);
  const caps = [...(v.steps || []).map(s => s.cap), 'Last step: finish your drawing'];
  h(`<div class="vwrap"><div id="vbox"></div>
     <div class="sov" id="sov" style="background:#14161fb8"><div class="sovin"><div class="stepno" id="sovn"></div><div class="sovc" id="sovc"></div><button class="btn pri big" id="sgo">Tap when you've drawn this step ▶</button><button class="btn sm" id="srep">↺ Replay this step</button></div></div>
     <div class="vend" id="vend"><div><div style="font-size:54px">🎉</div><h2>You drew the whole thing!</h2><p class="mute">Snap a photo of your paper for your Journal.</p><div class="row" style="justify-content:center"><label class="btn pri">📸 Add to Journal<input id="vph" type="file" accept="image/*" capture="environment" hidden></label><button class="btn" id="again">↺ Watch again</button><a class="btn" href="#/videos">More videos</a></div></div></div></div>
   <div class="card" style="margin-top:10px"><div class="row" style="justify-content:space-between"><b id="vcap">Step 1</b><span id="vt" class="mute">0:00</span></div><div class="prog" id="prog"><div class="fill" id="pfill"></div></div>
   <div class="row" style="margin-top:10px"><button class="btn pri" id="vp" style="flex:1">▶ Play</button><button class="btn" id="vr">↺ Replay step</button></div>
   ${v.placeholder ? '<p class="mute" style="font-size:13px">Steps are evenly spaced placeholders (parent: adjust steps).</p>' : ''}</div>`);
  let step = 0, holding = false, ends = stepEnds(v, v.duration);
  const start = (k) => k ? ends[k - 1] : 0;
  const marks = () => { const d = P.dur || v.duration || 1; ends = stepEnds(v, d); $('#prog').innerHTML = `<div class="fill" id="pfill"></div>` + ends.slice(0, -1).map((e, k) => `<div class="mk ${k < step ? 'past' : ''}" data-k="${k + 1}" style="left:${e / d * 100}%"></div>`).join(''); };
  const showCap = () => { $('#vcap').textContent = `Step ${step + 1} of ${ends.length}: ${caps[step] || ''}`; };
  const P = makePlayer($('#vbox'), v, {
    ready: () => { marks(); showCap(); },
    state: (pl) => { $('#vp').textContent = pl ? '⏸ Pause' : '▶ Play'; if (pl) { $('#sov').classList.remove('on'); $('#vend').classList.remove('on'); } },
    ended: () => finish(),
  });
  window.__watch = { get step() { return step; }, get held() { return holding; }, P };
  const hold = () => { holding = true; P.pause(); $('#sovn').textContent = `Step ${step + 1} of ${ends.length} · pause and draw`; $('#sovc').innerHTML = `<b>${esc(caps[step] || '')}</b><br><span class="mute">Take your time. It's OK if yours looks a little different!</span>`; $('#sov').classList.add('on'); speak(`Your turn. ${caps[step] || ''}`.replace(/\(parent: adjust steps\)/, '')); };
  const finish = () => { P.pause(); holding = false; $('#sov').classList.remove('on'); $('#vend').classList.add('on'); st.watched[v.provider + v.id] = Date.now(); save(); checkBadges(); };
  const cont = () => { holding = false; $('#sov').classList.remove('on'); step = Math.min(step + 1, ends.length - 1); marks(); showCap(); P.play(); };
  const replay = () => { holding = false; $('#sov').classList.remove('on'); P.seek(start(step)); P.play(); };
  $('#sov').onclick = (e) => { if (e.target.id !== 'srep') cont(); }; $('#srep').onclick = replay; $('#vr').onclick = replay;
  $('#vp').onclick = $('#shield').onclick = () => { if (holding) return cont(); P.playing ? P.pause() : P.play(); };
  $('#again').onclick = () => { step = 0; marks(); showCap(); $('#vend').classList.remove('on'); P.seek(0); P.play(); };
  $('#prog').onclick = (e) => { const k = e.target.dataset.k; if (k == null) return; step = +k; marks(); showCap(); holding = false; $('#sov').classList.remove('on'); P.seek(start(step)); P.play(); };
  $('#vph').onchange = (e) => addPhoto(e.target.files[0], 'video:' + v.id, () => toast('📔 Saved to your Journal!'));
  const iv = setInterval(async () => {
    if (!P.player) return; const t = await P.time(), d = P.dur || 1; $('#pfill').style.width = (t / d * 100) + '%'; $('#vt').textContent = fmt(t) + ' / ' + fmt(d);
    if (!P.playing || holding) return;
    while (step < ends.length - 1 && t < start(step)) step--; // after a backward jump
    if (step < ends.length - 1 && t >= ends[step] - .25) hold();
    else if (step === ends.length - 1 && d > 1 && t >= d - 1.2) finish();
  }, 200);
  stopVideo = () => { clearInterval(iv); P.destroy(); };
}
function addPhoto(f, id, done) {
  if (!f) return; const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'), s = Math.min(1, 640 / Math.max(img.width, img.height)); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const url = c.toDataURL('image/jpeg', .7); URL.revokeObjectURL(img.src); st.photos.push({ id, t: Date.now(), img: url }); save(); checkBadges(); done && done(url); };
  img.src = URL.createObjectURL(f);
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sketchschool:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
let unlocked = false;
function parent() {
  bar('Parent settings');
  if (!unlocked) return pinPad(!st.pinHash);
  const list = vids();
  h(`<div class="card"><h3>Curated videos</h3><p class="mute">Only these videos can be played. ${st.videos ? '' : '<b>Showing starter picks for parent review.</b>'} Tap <b>Steps</b> to set where each video pauses.</p>
     ${list.map((v, i) => `<div class="row" style="padding:8px 0;border-bottom:1px solid #ffffff10"><img src="${ytThumb(v)}" alt="" style="width:96px;border-radius:8px" referrerpolicy="no-referrer"><span style="flex:1;min-width:160px"><b>${esc(v.title)}</b><br><small class="mute">${v.provider} · ${esc(v.id)} · ${(v.steps || []).length + 1} steps${v.placeholder ? ' · <span style="color:var(--acc)">placeholder steps</span>' : ''}</small></span><a class="btn sm" href="#/edit/${i}">✂️ Steps</a><button class="btn sm" data-del="${i}">Remove</button></div>`).join('')}
     <h3 style="margin-top:16px">Add a video</h3><input type="url" id="vu" placeholder="YouTube or Vimeo link, or a video ID"><input type="text" id="vtl" placeholder="Title (optional, filled in automatically when possible)" style="margin-top:8px">
     <div class="row" style="margin-top:8px"><button class="btn pri" id="add">Add video</button><button class="btn" id="reset">Reset to starter picks</button></div><p id="msg" class="mute"></p></div>
   <div class="card" style="margin-top:12px"><h3>Backup: export / import</h3><p class="mute">Copy the video list and steps to another device.</p><div class="row"><button class="btn sm" id="exp">⬇ Export JSON</button><label class="btn sm">⬆ Import file<input type="file" id="impf" accept="application/json,.json" hidden></label><button class="btn sm" id="impt">Import pasted text</button></div><textarea id="json" placeholder="Exported JSON appears here, or paste JSON to import"></textarea></div>
   <div class="card" style="margin-top:12px"><h3>Lessons</h3><p class="mute">Lessons unlock one at a time. Override here if needed.</p><div class="row"><button class="btn sm" id="unext">Unlock the next lesson</button><button class="btn sm" id="uall">${st.unlockAll ? 'Turn off "unlock all"' : 'Unlock all lessons'}</button><button class="btn sm" id="reob">Redo the welcome quiz</button></div></div>
   <div class="card" style="margin-top:12px"><h3>Tips for a locked-down iPad</h3><p class="mute">Videos play inside the app with YouTube's buttons hidden, taps blocked, and our own screen at the end instead of YouTube's suggestions. For full lockdown, turn on <b>Guided Access</b> (Settings › Accessibility › Guided Access, then triple-click the side or top button) so Nivaan can't switch apps or open Safari tabs. Also consider Screen Time › Content &amp; Privacy to block the YouTube app.</p></div>
   <div class="row" style="margin-top:12px"><button class="btn" id="chg">Change PIN</button><button class="btn" id="lock">🔒 Lock</button></div>`);
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const l = [...vids()]; l.splice(+b.dataset.del, 1); st.videos = l; save(); parent(); });
  $('#reset').onclick = () => { if (confirm('Replace your list with the starter picks?')) { st.videos = null; save(); parent(); } };
  $('#lock').onclick = () => { unlocked = false; location.hash = '#/videos'; };
  $('#chg').onclick = () => { unlocked = false; pinPad(true); };
  $('#unext').onclick = () => { const n = LESSONS.find(l => !unlocked_(l)); if (!n) return toast('Everything is already unlocked'); st.unlocks = st.unlocks || {}; st.unlocks[n.id] = 1; save(); toast('Unlocked: ' + n.title); };
  $('#uall').onclick = () => { st.unlockAll = !st.unlockAll; save(); parent(); };
  $('#reob').onclick = () => { st.onboarded = false; save(); location.hash = '#/welcome'; };
  $('#exp').onclick = () => { const txt = JSON.stringify({ app: 'sketch-school', version: 1, videos: vids() }, null, 1); $('#json').value = txt; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'sketch-school-videos.json'; a.click(); };
  const imp = (txt) => { try { const j = JSON.parse(txt), l = Array.isArray(j) ? j : j.videos; if (!Array.isArray(l)) throw 0; const clean = l.map(x => ({ set: String(x.set || 'More videos'), provider: x.provider === 'vimeo' ? 'vimeo' : 'youtube', id: String(x.id), title: String(x.title || 'Drawing video'), channel: String(x.channel || ''), duration: +x.duration || 0, placeholder: !!x.placeholder, steps: (x.steps || []).map(s => ({ end: +s.end, cap: String(s.cap || '') })).filter(s => s.end > 0).sort((a, b) => a.end - b.end) })).filter(x => parseVideo(x.id)); st.videos = clean; save(); parent(); toast(`Imported ${clean.length} videos`); } catch (e) { $('#msg').textContent = 'That JSON could not be read.'; toast('Import failed'); } };
  $('#impt').onclick = () => imp($('#json').value);
  $('#impf').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(imp); };
  $('#add').onclick = async () => {
    const p = parseVideo($('#vu').value.trim()); if (!p) { $('#msg').textContent = 'That doesn\'t look like a YouTube or Vimeo link or ID.'; return; }
    if (vids().some(v => v.provider === p.provider && v.id === p.id)) { $('#msg').textContent = 'That video is already on the list.'; return; }
    $('#msg').textContent = 'Checking the video…';
    const meta = await oembed(p); if (meta === false) { $('#msg').textContent = 'Could not find that video. Check the link.'; return; }
    st.videos = [...vids(), { ...p, title: $('#vtl').value.trim() || meta?.title || 'Drawing video', channel: meta?.author_name || '', set: 'More videos', steps: [] }]; save(); toast('Video added. Now mark its steps.'); location.hash = '#/edit/' + (st.videos.length - 1);
  };
}
function editSteps(i) {
  if (!unlocked) { location.hash = '#/parent'; return; }
  const list = [...vids()], v = JSON.parse(JSON.stringify(list[+i] || null)); if (!v) return parent();
  bar('Steps: ' + v.title); v.steps = v.steps || [];
  h(`<div class="vwrap"><div id="vbox"></div></div>
   <div class="card" style="margin-top:10px"><div class="row" style="justify-content:space-between"><span id="vt" class="mute">0:00</span><span class="mute">Play the video and tap “Mark step here” at the end of each step.</span></div><div class="prog" id="prog"><div class="fill" id="pfill"></div></div>
   <div class="row" style="margin-top:10px"><button class="btn" id="vp">▶ Play</button><button class="btn" id="b10">−10s</button><button class="btn" id="f10">+10s</button><button class="btn pri" id="mark">📍 Mark step here</button></div></div>
   <div class="card steps-ed" style="margin-top:10px"><h3>Steps</h3><div id="sl"></div><div class="row" style="margin-top:10px"><button class="btn pri" id="sv">💾 Save steps</button><button class="btn" id="clr">Clear all</button><a class="btn" href="#/parent">Cancel</a></div></div>`);
  const P = makePlayer($('#vbox'), v, { state: (pl) => $('#vp').textContent = pl ? '⏸ Pause' : '▶ Play', ready: () => draw() });
  window.__edit = { P, v };
  const draw = () => {
    const d = P.dur || v.duration || 1; v.steps.sort((a, b) => a.end - b.end);
    $('#prog').innerHTML = `<div class="fill" id="pfill"></div>` + v.steps.map(s => `<div class="mk" style="left:${s.end / d * 100}%"></div>`).join('');
    $('#sl').innerHTML = v.steps.map((s, k) => `<div class="row"><b style="width:74px">${fmt(s.end)}</b><input type="text" data-c="${k}" value="${esc(s.cap)}" placeholder="Step ${k + 1}: e.g. lightly sketch the circle, HB, light pressure"><button class="btn sm" data-go="${k}">▶</button><button class="btn sm" data-x="${k}">✕</button></div>`).join('') + `<p class="mute">Last step: from ${fmt(v.steps.length ? v.steps[v.steps.length - 1].end : 0)} to the end of the video.</p>`;
    $('#sl').querySelectorAll('[data-c]').forEach(inp => inp.oninput = () => v.steps[+inp.dataset.c].cap = inp.value);
    $('#sl').querySelectorAll('[data-x]').forEach(b => b.onclick = () => { v.steps.splice(+b.dataset.x, 1); draw(); });
    $('#sl').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const k = +b.dataset.go; P.seek(k ? v.steps[k - 1].end : 0); P.play(); });
  };
  draw();
  $('#vp').onclick = () => P.playing ? P.pause() : P.play();
  $('#b10').onclick = async () => P.seek(Math.max(0, await P.time() - 10)); $('#f10').onclick = async () => P.seek(await P.time() + 10);
  $('#mark').onclick = async () => { const t = Math.round(await P.time() * 10) / 10; if (t < 1) return toast('Play the video first'); if (v.steps.some(s => Math.abs(s.end - t) < 1)) return; v.steps.push({ end: t, cap: `Step ${v.steps.length + 1}: ` }); v.placeholder = false; draw(); toast('📍 Step marked at ' + fmt(t)); };
  $('#clr').onclick = () => { v.steps = []; draw(); };
  $('#sv').onclick = () => { v.duration = Math.round(P.dur || v.duration || 0); if (v.steps.some(s => /parent: adjust/.test(s.cap)) === false) v.placeholder = false; list[+i] = v; st.videos = list; save(); toast('Steps saved'); location.hash = '#/parent'; };
  const iv = setInterval(async () => { if (!P.player) return; const t = await P.time(), d = P.dur || 1; $('#pfill').style.width = (t / d * 100) + '%'; $('#vt').textContent = fmt(t) + ' / ' + fmt(d); }, 250);
  stopVideo = () => { clearInterval(iv); P.destroy(); };
}
export function parseVideo(s) {
  let m;
  if ((m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { provider: 'vimeo', id: m[1] };
  if (/^\d{6,12}$/.test(s)) return { provider: 'vimeo', id: s };
  if ((m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/))) return { provider: 'youtube', id: m[1] };
  if (/^[\w-]{11}$/.test(s)) return { provider: 'youtube', id: s };
  return null;
}
async function oembed(p) {
  const u = p.provider === 'vimeo' ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent('https://vimeo.com/' + p.id)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + p.id)}`;
  try { const r = await fetch(u); if (r.status === 404 || r.status === 400) return false; if (r.ok) return await r.json(); } catch (e) { }
  try { const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(p.provider === 'vimeo' ? 'https://vimeo.com/' + p.id : 'https://www.youtube.com/watch?v=' + p.id)}`); const j = await r.json(); if (j.error) return false; return j; } catch (e) { return null; }
}
function pinPad(create) {
  let entered = '', first = null;
  const draw = (msg) => { h(`<div class="card" style="max-width:380px;margin:20px auto;text-align:center"><h2 style="margin-top:0">🔐 ${create ? (first ? 'Type it again' : 'Create a parent PIN') : 'Parent PIN'}</h2><p class="mute">${msg || (create ? 'Choose 4 numbers a grown-up will remember.' : 'Grown-ups only.')}</p><div class="pdots">${[0, 1, 2, 3].map(i => `<i class="${i < entered.length ? 'f' : ''}"></i>`).join('')}</div><div class="pin">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('')}</div></div>`); app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => press(b.dataset.k)); };
  const press = async (k) => {
    if (k === '⌫') entered = entered.slice(0, -1); else if (entered.length < 4) entered += k;
    if (entered.length < 4) return draw();
    if (create) { if (!first) { first = entered; entered = ''; return draw(); } if (first !== entered) { first = null; entered = ''; return draw('Those didn\'t match. Try again.'); } st.pinHash = await sha(entered); save(); unlocked = true; toast('PIN saved'); return parent(); }
    if (await sha(entered) === st.pinHash) { unlocked = true; return parent(); }
    entered = ''; draw('Wrong PIN. Try again.');
  };
  draw();
}
function badges() {
  bar('Badges');
  h(`<div class="grid">${BADGES.map(b => `<div class="card badge ${st.badges[b.id] ? 'got' : ''}"><div class="em">${b.em}</div><h3>${b.name}</h3><small class="mute">${st.badges[b.id] ? 'Earned!' : 'Keep going'}</small></div>`).join('')}</div><h2>Stars: ⭐ ${starCount()}</h2><p class="mute">Check off everything on a lesson's checklist to earn 3 stars.</p>`);
}
function photos() {
  bar('My Journal');
  h(`<label class="btn pri" style="margin-bottom:12px">📸 Add any drawing<input id="jph" type="file" accept="image/*" capture="environment" hidden></label>` + (st.photos.length ? `<div class="grid">${st.photos.map((p, i) => { const l = LESSONS.find(x => x.id === p.id); const vv = !l && String(p.id).startsWith('video:') ? vids().find(x => 'video:' + x.id === p.id) : null; return `<div class="card"><img src="${p.img}" alt="" style="width:100%;border-radius:12px"><h3>${l ? l.emoji + ' ' + esc(l.title) : vv ? '🎬 ' + esc(vv.title) : '✏️ My drawing'}</h3><small class="mute">${new Date(p.t).toLocaleDateString('en-US')}</small> <button class="btn sm" data-del="${i}">Delete</button></div>`; }).join('')}</div>` : `<div class="card"><h3>No photos yet</h3><p class="mute">After a lesson, tap "Take a photo" to save your paper drawing here and compare it with the demo. Photos stay on this device.</p></div>`));
  $('#jph').onchange = (e) => addPhoto(e.target.files[0], 'own', () => photos());
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this photo?')) { st.photos.splice(+b.dataset.del, 1); save(); photos(); } });
}

fetch('videos.json').then(r => r.json()).then(j => { SEED = j.videos; if (location.hash.startsWith('#/videos') || location.hash.startsWith('#/parent')) route(); }).catch(() => { });
route();
