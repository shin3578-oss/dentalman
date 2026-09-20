/* とどうふけんクエスト — 47都道府県をおぼえる子ども向け学習ゲーム
   データは data.js（src/build.py が生成）。この app.js は手で書いている。 */
'use strict';

const $ = (s) => document.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const byId = {};
PREFS.forEach((p) => { byId[p.id] = p; });

/* ---------------- ステージ（地方のまとまり） ---------------- */
const STAGES = [
  { t: '北海道・東北', ids: [1, 2, 3, 4, 5, 6, 7] },
  { t: '関東', ids: [8, 9, 10, 11, 12, 13, 14] },
  { t: '中部', ids: [15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { t: '近畿', ids: [24, 25, 26, 27, 28, 29, 30] },
  { t: '中国・四国', ids: [31, 32, 33, 34, 35, 36, 37, 38, 39] },
  { t: '九州・沖縄', ids: [40, 41, 42, 43, 44, 45, 46, 47] },
  { t: 'にっぽん ぜんぶ', ids: PREFS.map((p) => p.id), pick: 20 },
];

const MODES = [
  { k: 'place',   t: 'ばしょクイズ',   d: '名まえを聞いて、ちずの上でさがす' },
  { k: 'name',    t: 'なまえクイズ',   d: '光っている県の名まえを4つからえらぶ' },
  { k: 'capital', t: 'けんちょうしょざいち', d: '県庁所在地（けんの中心の市）をあてる' },
  { k: 'explore', t: 'たんけん',       d: 'ちずをタップして じゆうにおぼえる' },
];

/* ---------------- ほぞん ---------------- */
const SKEY = 'todofuken_quest_v1';
let save = { seen: [], medals: {}, ruby: true, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
const persist = () => { try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch (e) {} };

/* ---------------- おと ---------------- */
let ac = null;
function beep(freqs, dur, type) {
  if (!save.sound) return;
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      const t = ac.currentTime + i * dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch (e) {}
}
const seOk = () => beep([660, 880, 1320], 0.09);
const seNg = () => beep([200, 150], 0.14);
const seTap = () => beep([520], 0.05);
const seWin = () => beep([523, 659, 784, 1046, 1318], 0.11);

/* ---------------- ちいさな道具 ---------------- */
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function ruby(p) { return '<ruby>' + p.n + '<rt>' + p.k + '</rt></ruby>'; }
function rubyCity(p) { return '<ruby>' + p.c + '<rt>' + p.ck + '</rt></ruby>'; }
function toast(msg, ms) {
  const el = $('#toast'); el.innerHTML = msg; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), ms || 1600);
}
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
  if (id === 'title') drawTitleProgress();
}
function heroJump() { const h = $('#hero2'); h.src = HERO.jump; h.classList.add('jump'); setTimeout(() => { h.classList.remove('jump'); h.src = HERO.stand; }, 460); }

/* ---------------- ちずをつくる ---------------- */
const mapg = $('#mapg'), marks = $('#marks'), deco = $('#deco'), svg = $('#map');
const paths = {};
PREFS.forEach((p) => {
  const el = document.createElementNS(SVGNS, 'path');
  el.setAttribute('d', p.d); el.setAttribute('class', 'pref'); el.dataset.id = p.id;
  mapg.appendChild(el); paths[p.id] = el;
});
// タイトル画面のちいさな日本地図
PREFS.forEach((p) => {
  const el = document.createElementNS(SVGNS, 'path');
  el.setAttribute('d', p.d); $('#titleMap').appendChild(el);
});
$('#heroTitle').src = HERO.stand;
$('#hero2').src = HERO.stand;

/* ---- viewBox（見えるはんい）の出し入れ ---- */
let view = { x: 0, y: 0, w: MAPSIZE.w, h: MAPSIZE.h };
let anim = null;
function applyView() {
  svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);
  renderLabels();
}
function fitBox(box, animate) {
  const r = $('#mapWrap').getBoundingClientRect();
  const pad = 1.10;
  let w = box.w * pad, h = box.h * pad;
  const ar = r.width / r.height;
  if (w / h < ar) w = h * ar; else h = w / ar;
  const to = { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w: w, h: h };
  if (!animate) { view = to; applyView(); return; }
  const from = Object.assign({}, view), t0 = performance.now();
  cancelAnimationFrame(anim);
  (function step(t) {
    const k = Math.min(1, (t - t0) / 320), e = 1 - Math.pow(1 - k, 3);
    view = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e,
             w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e };
    applyView();
    if (k < 1) anim = requestAnimationFrame(step);
  })(t0);
}
function boxOf(ids) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ids.forEach((id) => {
    const b = paths[id].getBBox();
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ---- 沖縄は本当はもっと南にある → わくで囲んで「べつわく」だとわかるようにする ---- */
function drawOkinawaFrame() {
  const b = paths[47].getBBox();
  if (!b.width) return;
  deco.innerHTML = '';
  const m = Math.max(b.width, b.height) * 0.22;
  const r = document.createElementNS(SVGNS, 'rect');
  r.setAttribute('x', b.x - m); r.setAttribute('y', b.y - m);
  r.setAttribute('width', b.width + m * 2); r.setAttribute('height', b.height + m * 2);
  deco.appendChild(r);
  const t = document.createElementNS(SVGNS, 'text');
  t.setAttribute('x', b.x + b.width / 2); t.setAttribute('y', b.y - m - 6);
  t.setAttribute('font-size', Math.max(10, b.width * 0.28));
  t.textContent = 'ほんとうは ずっと南';
  deco.appendChild(t);
}

/* ---- ラベル（ズームしたときだけ名前を出す） ---- */
let labelIds = [];
function renderLabels() {
  const r = $('#mapWrap').getBoundingClientRect();
  const scale = r.width / view.w;               // 画面px ÷ 地図単位
  const fs = Math.max(9, Math.min(22, 13 / scale * 1.0));
  marks.innerHTML = '';
  labelIds.forEach((id) => {
    const p = byId[id];
    const b = paths[id].getBBox();
    if (b.width * scale < 40 && labelIds.length > 3) return;   // ちいさすぎる・ごちゃつくときは出さない
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('class', 'lbl'); t.setAttribute('x', p.lx); t.setAttribute('y', p.ly);
    t.setAttribute('font-size', fs);
    const mark = (game.mode === 'explore' && save.seen.indexOf(id) >= 0) ? '★' : '';
    t.textContent = mark + p.n.replace(/[都府県]$/, '');
    marks.appendChild(t);
  });
}

/* ---- ゆびの操作（タップ・うごかす・ひろげる） ---- */
(function () {
  const wrap = $('#mapWrap');
  const pts = new Map();
  let start = null, moved = 0, t0 = 0;
  const toSvg = (cx, cy) => {
    const r = wrap.getBoundingClientRect();
    return { x: view.x + (cx - r.left) / r.width * view.w, y: view.y + (cy - r.top) / r.height * view.h };
  };
  wrap.addEventListener('pointerdown', (e) => {
    wrap.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = toSvg(e.clientX, e.clientY); moved = 0; t0 = Date.now(); }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      start = { d: Math.hypot(a.x - b.x, a.y - b.y), view: Object.assign({}, view),
                c: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1 && start && moved > 6) {
      const now = toSvg(e.clientX, e.clientY);
      view.x += start.x - now.x; view.y += start.y - now.y; applyView();
    } else if (pts.size === 2 && start && start.d) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      let k = start.d / d;
      const w = Math.max(MAPSIZE.w * 0.05, Math.min(MAPSIZE.w * 1.6, start.view.w * k));
      const h = w * start.view.h / start.view.w;
      view = { x: start.c.x - (start.c.x - start.view.x) * (w / start.view.w),
               y: start.c.y - (start.c.y - start.view.y) * (h / start.view.h), w: w, h: h };
      applyView();
    }
  });
  const end = (e) => {
    const wasOne = pts.size === 1;
    pts.delete(e.pointerId);
    if (wasOne && moved < 10 && Date.now() - t0 < 600) handleTap(e.clientX, e.clientY);
    if (pts.size < 2) start = null;
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const cx = view.x + (e.clientX - r.left) / r.width * view.w;
    const cy = view.y + (e.clientY - r.top) / r.height * view.h;
    const k = e.deltaY > 0 ? 1.15 : 0.87;
    const w = Math.max(MAPSIZE.w * 0.05, Math.min(MAPSIZE.w * 1.6, view.w * k));
    const h = w * view.h / view.w;
    view = { x: cx - (cx - view.x) * (w / view.w), y: cy - (cy - view.y) * (h / view.h), w: w, h: h };
    applyView();
  }, { passive: false });
})();

function hitTest(cx, cy) {
  const el = document.elementFromPoint(cx, cy);
  if (el && el.classList && el.classList.contains('pref')) return +el.dataset.id;
  // はずれたら、いちばん近い県をひろう（ゆびが太い子でも当たるように）
  const r = $('#mapWrap').getBoundingClientRect();
  const sx = view.x + (cx - r.left) / r.width * view.w;
  const sy = view.y + (cy - r.top) / r.height * view.h;
  const scale = r.width / view.w;
  let best = null, bd = 1e9;
  (game.active.length ? game.active : PREFS.map((p) => p.id)).forEach((id) => {
    const p = byId[id], d = Math.hypot(p.lx - sx, p.ly - sy);
    if (d < bd) { bd = d; best = id; }
  });
  return bd * scale < 46 ? best : null;
}

/* ---------------- ゲーム本体 ---------------- */
const game = { mode: 'explore', stage: 0, queue: [], i: 0, hits: 0, tries: 0, miss: [], active: [], locked: false };

function clearMarks() {
  PREFS.forEach((p) => { paths[p.id].setAttribute('class', 'pref'); });
}
function paintBase() {
  clearMarks();
  if (game.mode === 'explore') {
    PREFS.forEach((p) => paths[p.id].classList.add('reg' + p.r));   // 地方ごとに色を変える
    save.seen.forEach((id) => { if (paths[id]) paths[id].classList.add('seen'); });
  } else {
    PREFS.forEach((p) => { if (game.active.indexOf(p.id) < 0) paths[p.id].classList.add('dim'); });
  }
}

function startMode(mode) {
  game.mode = mode;
  if (mode === 'explore') { startStage(6); return; }
  $('#stageTitle').textContent = MODES.filter((m) => m.k === mode)[0].t + '：ちほうを えらぼう';
  buildStageCards(); show('stage');
}

function startStage(idx) {
  const st = STAGES[idx];
  game.stage = idx;
  game.active = st.ids.slice();
  game.hits = 0; game.tries = 0; game.miss = []; game.i = 0; game.locked = false;
  let q = shuffle(st.ids.slice());
  if (st.pick && game.mode !== 'explore') q = q.slice(0, st.pick);
  game.queue = q;
  labelIds = (game.mode === 'explore') ? PREFS.map((p) => p.id) : [];
  paintBase();
  $('#info').classList.remove('on');
  show('play');
  fitBox(boxOf(st.ids), false);
  drawOkinawaFrame();
  if (game.mode === 'explore') {
    $('#choices').innerHTML = '';
    $('#question').innerHTML = 'ちずを タップして みよう';
    $('#hintBtn').style.display = 'none';
    updateExploreCount();
  } else {
    $('#hintBtn').style.display = '';
    nextQuestion();
  }
}

function updateExploreCount() {
  const n = save.seen.length;
  $('#counter').innerHTML = 'みた県 ' + n + '/47';
  $('#scoreTxt').textContent = n + '/47';
  $('#bar').style.width = (n / 47 * 100) + '%';
}

function nextQuestion() {
  if (game.i >= game.queue.length) { finish(); return; }
  game.locked = false; game.wrongThis = 0; game.hintedRegion = false;
  const p = byId[game.queue[game.i]];
  game.cur = p;
  paintBase();
  $('#counter').textContent = (game.i + 1) + '/' + game.queue.length;
  $('#scoreTxt').textContent = 'せいかい ' + game.hits;
  $('#bar').style.width = (game.i / game.queue.length * 100) + '%';
  $('#hintTxt').textContent = '';
  labelIds = [];
  if (game.mode === 'place') {
    $('#choices').innerHTML = '';
    $('#question').innerHTML = ruby(p) + ' は どこ？';
  } else if (game.mode === 'name') {
    paths[p.id].classList.remove('dim'); paths[p.id].classList.add('pulse', 'target');
    $('#question').innerHTML = '光っている ところは どこ？';
    makeChoices(p, (x) => x.n, (x) => ruby(x));
    zoomToPref(p);
  } else if (game.mode === 'capital') {
    paths[p.id].classList.remove('dim'); paths[p.id].classList.add('pulse', 'target');
    $('#question').innerHTML = ruby(p) + ' の けんちょうしょざいちは？';
    makeChoices(p, (x) => x.c, (x) => rubyCity(x));
    zoomToPref(p);
  }
  renderLabels();
}

function zoomToPref(p) {
  const b = boxOf([p.id]);
  const stBox = boxOf(STAGES[game.stage].ids);
  // 県が小さいときだけ寄る（大きいものは地方ぜんたいのまま）
  const k = Math.max(b.w / stBox.w, b.h / stBox.h);
  if (k < 0.22) {
    const m = Math.max(b.w, b.h) * 3.2;
    fitBox({ x: b.x + b.w / 2 - m / 2, y: b.y + b.h / 2 - m / 2, w: m, h: m }, true);
  } else {
    fitBox(stBox, true);
  }
}

function makeChoices(ans, keyf, labelf) {
  const pool = shuffle(STAGES[game.stage].ids.filter((id) => id !== ans.id).map((id) => byId[id]));
  const others = [];
  pool.forEach((p) => { if (others.length < 3 && keyf(p) !== keyf(ans)) others.push(p); });
  while (others.length < 3) {                       // ちほうに数が足りないときは全国から
    const p = PREFS[Math.random() * PREFS.length | 0];
    if (p.id !== ans.id && others.every((o) => o.id !== p.id)) others.push(p);
  }
  const list = shuffle(others.concat([ans]));
  const box = $('#choices'); box.innerHTML = '';
  list.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'btn'; b.innerHTML = labelf(p); b.dataset.id = p.id;
    b.onclick = () => answerChoice(b, p);
    box.appendChild(b);
  });
}

function answerChoice(btn, p) {
  if (game.locked) return;
  if (p.id === game.cur.id) {
    game.locked = true; btn.classList.add('right');
    correct();
  } else {
    btn.classList.add('wrong'); btn.disabled = true;
    wrong(p);
  }
}

function flash(text) {
  const f = $('#flash'); f.querySelector('span').textContent = text;
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

function correct() {
  seOk(); heroJump(); flash('せいかい!');
  const p = game.cur;
  PREFS.forEach((q) => paths[q.id].classList.remove('hint'));
  paths[p.id].classList.remove('pulse', 'target', 'ng');
  paths[p.id].classList.add('ok');
  labelIds = [p.id]; renderLabels();
  if (game.wrongThis === 0) game.hits++;
  game.tries++;
  $('#scoreTxt').textContent = 'せいかい ' + game.hits;
  game.locked = true;
  setTimeout(() => { game.i++; nextQuestion(); }, 850);
}

function wrong(picked) {
  seNg();
  game.wrongThis = (game.wrongThis || 0) + 1;
  if (game.miss.indexOf(game.cur.id) < 0) game.miss.push(game.cur.id);
  if (picked && paths[picked.id]) {
    paths[picked.id].classList.add('ng');
    setTimeout(() => paths[picked.id] && paths[picked.id].classList.remove('ng'), 600);
  }
  if (game.mode === 'place' && picked) {
    toast('そこは ' + picked.n + ' だよ');
  } else {
    toast('ちがうよ');
  }
  if (game.wrongThis >= 2) {                        // 2回まちがえたら答えを見せる
    game.locked = true; game.tries++;
    const p = game.cur;
    paths[p.id].classList.remove('dim', 'pulse');
    paths[p.id].classList.add('target');
    labelIds = [p.id]; renderLabels();
    toast('こたえは ' + p.n, 2000);
    if (game.mode === 'place') fitBox(boxOf(STAGES[game.stage].ids), true);
    setTimeout(() => { game.i++; nextQuestion(); }, 1700);
  } else if (game.mode === 'place') {
    hint();
  }
}

function hint() {
  if (game.mode === 'explore' || !game.cur) return;
  const p = game.cur;
  const regions = {};
  game.active.forEach((id) => { regions[byId[id].r] = 1; });
  const manyRegions = Object.keys(regions).length > 1;
  if (manyRegions && !game.hintedRegion) {          // 1回目：ちほうを教える
    game.hintedRegion = true;
    $('#hintTxt').innerHTML = 'ヒント：' + REGIONS[p.r] + ' ちほう';
    PREFS.forEach((q) => { if (q.r === p.r && game.active.indexOf(q.id) >= 0) paths[q.id].classList.add('hint'); });
    return;
  }
  // 2回目：3つにしぼる
  const pool = shuffle(game.active.filter((id) => id !== p.id)).slice(0, 2).concat([p.id]);
  PREFS.forEach((q) => paths[q.id].classList.remove('hint'));
  pool.forEach((id) => paths[id].classList.add('hint'));
  $('#hintTxt').innerHTML = 'ヒント：色のついた3つのどれか';
}

function handleTap(cx, cy) {
  const id = hitTest(cx, cy);
  if (!id) return;
  const p = byId[id];
  if (game.mode === 'explore') {
    seTap();
    if (save.seen.indexOf(id) < 0) { save.seen.push(id); persist(); }
    paintBase();
    paths[id].classList.add('target');
    labelIds = PREFS.map((q) => q.id); renderLabels();
    showInfo(p);
    updateExploreCount();
    if (save.seen.length === 47) { seWin(); flash('47けん せいは!'); }
  } else if (game.mode === 'place') {
    if (game.locked) return;
    if (id === game.cur.id) correct(); else wrong(p);
  }
}

function showInfo(p) {
  $('#infoName').innerHTML = ruby(p);
  $('#infoMeta').innerHTML = 'けんちょうしょざいち：' + rubyCity(p) + '　／　' + REGIONS[p.r] + 'ちほう';
  $('#infoFact').textContent = p.f;
  $('#info').classList.add('on');
}

/* ---------------- けっか ---------------- */
function finish() {
  const total = game.queue.length, hits = game.hits;
  const rate = hits / total;
  let medal = '', label = '';
  if (rate === 1) { medal = '🥇'; label = 'きんメダル！'; }
  else if (rate >= 0.8) { medal = '🥈'; label = 'ぎんメダル！'; }
  else if (rate >= 0.6) { medal = '🥉'; label = 'どうメダル！'; }
  else { medal = '💪'; label = 'もういちど ちょうせん！'; }
  const key = game.mode + '|' + game.stage;
  const rank = { '🥉': 1, '🥈': 2, '🥇': 3 };
  if (rank[medal] && rank[medal] > (rank[save.medals[key]] || 0)) { save.medals[key] = medal; }
  persist();
  seWin();
  $('#medal').textContent = medal;
  $('#resultScore').textContent = total + 'もんちゅう ' + hits + 'もん せいかい';
  $('#resultMsg').textContent = label + '（' + STAGES[game.stage].t + '・' + MODES.filter((m) => m.k === game.mode)[0].t + '）';
  const ml = $('#missList');
  if (game.miss.length) {
    ml.innerHTML = '<b>おぼえなおす県</b><br>' + game.miss.map((id) => {
      const p = byId[id];
      return ruby(p) + '（' + rubyCity(p) + '）';
    }).join('<br>');
  } else {
    ml.innerHTML = 'まちがい なし！ かんぺき！';
  }
  $('#retryMiss').style.display = game.miss.length ? '' : 'none';
  $('#nextStage').style.display = (game.stage < STAGES.length - 1) ? '' : 'none';
  show('result');
}

/* ---------------- がめんづくり ---------------- */
function buildModeCards() {
  const box = $('#modeCards'); box.innerHTML = '';
  MODES.forEach((m) => {
    const got = STAGES.map((s, i) => save.medals[m.k + '|' + i]).filter(Boolean);
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = '<div class="t">' + m.t + '</div><div class="d">' + m.d + '</div>' +
      (m.k === 'explore' ? '<div class="medal">みた県 ' + save.seen.length + '/47</div>'
                         : '<div class="medal">' + (got.join('') || 'メダル なし') + '</div>');
    b.onclick = () => { seTap(); startMode(m.k); };
    box.appendChild(b);
  });
}
function buildStageCards() {
  const box = $('#stageCards'); box.innerHTML = '';
  STAGES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    const n = s.pick ? s.pick : s.ids.length;
    b.innerHTML = '<div class="t">' + s.t + ' ' + (save.medals[game.mode + '|' + i] || '') + '</div>' +
      '<div class="d">' + n + 'もん</div>';
    b.onclick = () => { seTap(); startStage(i); };
    box.appendChild(b);
  });
}
function drawTitleProgress() {
  const medals = Object.keys(save.medals).length;
  $('#titleProgress').textContent = 'みた県 ' + save.seen.length + '/47　メダル ' + medals + 'こ';
}

/* ---------------- ボタン ---------------- */
$('#start').onclick = () => { seTap(); buildModeCards(); show('menu'); };
document.querySelectorAll('[data-back]').forEach((b) => {
  b.onclick = () => {
    seTap();
    const to = b.dataset.back;
    if (to === 'stage' && game.mode === 'explore') { buildModeCards(); show('menu'); return; }
    if (to === 'menu') buildModeCards();
    if (to === 'stage') buildStageCards();
    show(to);
  };
});
$('#rubyBtn').onclick = () => {
  save.ruby = !save.ruby; persist(); applyRuby();
  toast(save.ruby ? 'ふりがな ON' : 'ふりがな OFF');
};
$('#soundBtn').onclick = () => {
  save.sound = !save.sound; persist();
  $('#soundBtn').textContent = save.sound ? 'おと ON' : 'おと OFF';
  if (save.sound) seTap();
};
function applyRuby() {
  document.body.classList.toggle('ruby-off', !save.ruby);
  $('#rubyBtn').textContent = save.ruby ? 'ふりがな ON' : 'ふりがな OFF';
}
$('#infoClose').onclick = () => { $('#info').classList.remove('on'); };
$('#zoomOut').onclick = () => { seTap(); fitBox(boxOf(STAGES[game.stage].ids), true); };
$('#hintBtn').onclick = () => { seTap(); hint(); };
$('#again').onclick = () => { seTap(); startStage(game.stage); };
$('#nextStage').onclick = () => { seTap(); startStage(Math.min(STAGES.length - 1, game.stage + 1)); };
$('#retryMiss').onclick = () => {
  seTap();
  const miss = game.miss.slice();
  startStage(game.stage);
  game.queue = shuffle(miss); game.i = 0; game.hits = 0; game.miss = [];
  if (game.mode !== 'explore') nextQuestion();
};
window.addEventListener('resize', () => { applyView(); });

applyRuby();
$('#soundBtn').textContent = save.sound ? 'おと ON' : 'おと OFF';
drawTitleProgress();
