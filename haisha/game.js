'use strict';
// はいしゃさんに なろう！ — こどもが ゆびで ほんものの ちりょうの てじゅんを たいけんする ゲーム
// てじゅんは じっさいの しんりょうに そろえる（むしば＝CRじゅうてん／おそうじ＝TBI〜PMTC〜フッそ／シーラント）
(function () {
const $ = s => document.querySelector(s);
const FONT = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Yu Gothic",sans-serif';
const W = 360, H = 560, TOP = 88;          // キャンバスの論理サイズ。上の88pxは かんじゃさんの欄
const cv = $('#cv'), ctx = cv.getContext('2d');
let SC = 1;

// ---------- 画面きりかえ ----------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'play') resize();
}
function resize() {
  const wrap = $('#stageWrap');
  if (!wrap.clientHeight) return;
  const s = Math.max(0.3, Math.min(wrap.clientWidth / W, wrap.clientHeight / H));
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(W * s * d), ph = Math.round(H * s * d);
  // 大きさが かわらないときは さわらない（canvas の width を いれなおすと 一瞬 まっしろに なる）
  if (pw === cv.width && ph === cv.height) return;
  cv.style.width = (W * s) + 'px'; cv.style.height = (H * s) + 'px';
  cv.width = pw; cv.height = ph;
  SC = cv.width / W;
  if (G.step && G.running && !G.finished && G.toolX != null) draw();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && AC && AC.state !== 'running') { try { AC.resume(); } catch (e) {} } });
window.addEventListener('resize', () => { if ($('#play').classList.contains('on')) resize(); });
if (window.ResizeObserver) new ResizeObserver(() => { if ($('#play').classList.contains('on')) resize(); }).observe($('#stageWrap'));

// ---------- 保存（この端末だけ） ----------
function loadStars() { try { return JSON.parse(localStorage.getItem('haisha_stars') || '{}') || {}; } catch (e) { return {}; } }
function saveStars(o) { try { localStorage.setItem('haisha_stars', JSON.stringify(o)); } catch (e) {} }

// ---------- 乱数（見た目を毎回同じにする） ----------
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- おと ----------
let AC = null, MASTER = null, NOISE = null, SFXBUS = null, LOOPBUS = null, BGMBUS = null, muted = false;
const LOOPS = {};
// iPhone の Safari では ①「ゆびを はなした」しゅんかん（touchend / click）でないと おとの きょかが でない
// ② マナーモードだと Web Audio が けされる → 無音の audio を ながして「おんがく」あつかいに する
let SILENT = null;
function silentWavUrl() {
  const n = 2000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function audioInit() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      // スマホの スピーカーでも きこえるように おおきめ。コンプレッサーで おとわれを ふせぐ
      MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 1;
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
      MASTER.connect(comp); comp.connect(AC.destination);
      SFXBUS = AC.createGain(); SFXBUS.gain.value = 2.4; SFXBUS.connect(MASTER);
      LOOPBUS = AC.createGain(); LOOPBUS.gain.value = 3.2; LOOPBUS.connect(MASTER);
      BGMBUS = AC.createGain(); BGMBUS.gain.value = 0; BGMBUS.connect(MASTER);
      NOISE = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
      const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; return; }
  }
  if (AC.state !== 'running') { try { AC.resume(); } catch (e) {} }
  // ちいさな 無音を いちど ならすと、iPhone で おとが でるように なる
  try { const b = AC.createBuffer(1, 1, 22050), src = AC.createBufferSource(); src.buffer = b; src.connect(AC.destination); src.start(0); } catch (e) {}
  try {
    if (!SILENT) { SILENT = new Audio(silentWavUrl()); SILENT.loop = true; SILENT.setAttribute('playsinline', ''); }
    if (SILENT.paused) { const pr = SILENT.play(); if (pr && pr.catch) pr.catch(() => {}); }
  } catch (e) {}
}
// きょかが でる しゅんかん（ゆびを はなした とき・クリック）に かならず よぶ
for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) document.addEventListener(ev, audioInit, { capture: true, passive: true });
function tone(f, dur, type, vol, f2, delay, dest) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || SFXBUS); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  ding() { tone(988, 0.18, 'sine', 0.25); tone(1319, 0.32, 'sine', 0.22, 0, 0.09); },
  no() { tone(330, 0.16, 'triangle', 0.15, 260); },
  ouch() { tone(440, 0.25, 'square', 0.08, 180); },
  pop() { tone(700, 0.08, 'sine', 0.12, 1100); },
  click() { tone(1800, 0.04, 'square', 0.06); tone(1500, 0.04, 'square', 0.05, 0, 0.12); },
  tap() { tone(880, 0.06, 'sine', 0.16, 1320); },
  start() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, 0, i * 0.08)); },
  chime() { tone(784, 0.14, 'sine', 0.14); tone(1175, 0.22, 'sine', 0.12, 0, 0.1); },
  chu() { tone(1400 + Math.random() * 500, 0.05, 'sine', 0.07, 700); },
  tick(n) { tone([659, 784, 988, 1175][n] || 1175, 0.1, 'triangle', 0.13); },
  pi() { tone(1568, 0.07, 'sine', 0.1); },
  grip() { tone(2200, 0.03, 'square', 0.07); tone(1600, 0.04, 'square', 0.06, 0, 0.05); },
  out() { tone(500, 0.12, 'sine', 0.18, 1400); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.16, 0, 0.12 + i * 0.09)); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, 0, i * 0.13)); tone(1047, 0.7, 'sine', 0.2, 0, 0.55); tone(1319, 0.7, 'sine', 0.14, 0, 0.55); },
};
function loop(kind, level) {
  if (!AC) return;
  let L = LOOPS[kind];
  if (!L) {
    const g = AC.createGain(); g.gain.value = 0; g.connect(LOOPBUS);
    if (kind === 'drill' || kind === 'engine') {
      const hi = kind === 'drill';
      const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hi ? 1700 : 260;
      const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.value = hi ? 3400 : 520;
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hi ? 2600 : 600; bp.Q.value = 1.5;
      o.connect(bp); o2.connect(bp); bp.connect(g); o.start(); o2.start();
    } else if (kind === 'hum') {
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = 330; o.connect(g); o.start();
    } else {
      const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true;
      const f = AC.createBiquadFilter();
      if (kind === 'vac') { f.type = 'lowpass'; f.frequency.value = 900; }
      else if (kind === 'brush') { f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 0.8; }
      else if (kind === 'air') { f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 0.5; }
      else { f.type = 'highpass'; f.frequency.value = 2800; }
      s.connect(f); f.connect(g); s.start();
    }
    L = LOOPS[kind] = { g, level: 0 };
  }
  if (Math.abs(L.level - level) > 0.002) { L.level = level; L.g.gain.setTargetAtTime(level, AC.currentTime, 0.04); }
}
function loopsOff() { for (const k in LOOPS) loop(k, 0); }

const BGM_MEL = [76, 79, 81, 79, 76, 0, 74, 0, 72, 74, 76, 0, 81, 0, 79, 0, 77, 76, 74, 72, 74, 0, 69, 0, 71, 72, 74, 0, 79, 0, 0, 0,
  76, 79, 84, 0, 83, 81, 79, 0, 81, 79, 76, 0, 72, 0, 76, 0, 77, 0, 81, 0, 79, 77, 76, 74, 74, 0, 71, 0, 72, 0, 0, 0];
const BGM_CH = [[48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 67, 71], [48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 67, 71]];
const EIGHTH = 60 / 100 / 2;
const BGM = { on: false, next: 0, i: 0, timer: null, duck: false };
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function bnote(m, t, dur, type, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = mf(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(BGMBUS); o.start(t); o.stop(t + dur + 0.05);
}
function bgmStep(i, t) {
  const bar = i >> 3, e = i & 7, ch = (bar === 7 && e >= 4) ? BGM_CH[0] : BGM_CH[bar];
  const m = BGM_MEL[i];
  if (m) { let n = 1; while (n < 4 && BGM_MEL[(i + n) % 64] === 0 && ((i + n) & 7) !== 0) n++; const d = EIGHTH * n * 0.95 + 0.15;
    bnote(m, t, d, 'sine', 0.16); bnote(m + 12, t, d * 0.6, 'sine', 0.04); }
  if (e === 0 || e === 4 || (bar === 7 && e === 4)) bnote(e === 0 ? ch[0] : ch[0] + 7, t, EIGHTH * 3.5, 'triangle', 0.2);
  if (e === 0 || (bar === 7 && e === 4)) for (const c of ch.slice(1)) bnote(c - 12, t, EIGHTH * 7.5, 'sine', 0.035);
  if (e % 2 === 1) { const s2 = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s2.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s2.connect(f); f.connect(g); g.connect(BGMBUS); s2.start(t, Math.random()); s2.stop(t + 0.06); }
}
function bgmTick() {
  if (!AC || AC.state !== 'running') return;
  if (BGM.next < AC.currentTime - 0.05) BGM.next = AC.currentTime + 0.05;
  while (BGM.next < AC.currentTime + 0.3) { bgmStep(BGM.i, BGM.next); BGM.next += EIGHTH; BGM.i = (BGM.i + 1) % 64; }
}
function bgmStart() {
  if (!AC || BGM.on) return;
  BGM.on = true; BGM.next = AC.currentTime + 0.1;
  BGMBUS.gain.setTargetAtTime(0.32, AC.currentTime, 0.4);
  BGM.timer = setInterval(bgmTick, 50);
}
function bgmDuck(on) {   // けずる おとなどが なっている あいだは BGM を さげる
  if (!AC || !BGM.on || BGM.duck === on) return;
  BGM.duck = on; BGMBUS.gain.setTargetAtTime(on ? 0.12 : 0.32, AC.currentTime, 0.15);
}

// ---------- かんじゃさん ----------
const PATIENTS = [
  { id: 'p1', name: 'はると', hon: 'くん', age: 5, skin: '#ffd9b8', hair: '#3a2a20', style: 'boy',
    worry: '「おくばが しみて いたいよ…」', title: 'むしばの ちりょう（つめもの）', arch: 'primary',
    steps: ['search', 'xray', 'masui', 'wattes', 'drill', 'detect', 'excavate', 'rinse', 'bond', 'fill', 'cure', 'bite', 'polish'], card: 'c1',
    thanks: 'もう しみないよ！ ありがとう、せんせい！' },
  { id: 'p2', name: 'みお', hon: 'ちゃん', age: 4, skin: '#ffe0c4', hair: '#6b3b1f', style: 'girl',
    worry: '「はいしゃさんで おそうじ してほしいな」', title: 'はの おそうじ と フッそ', arch: 'primary',
    steps: ['dye', 'brush', 'scale', 'pmtc', 'fluor'], card: 'c2',
    thanks: 'はが つるつる！ 30ぷん まってから おやつに するね！' },
  { id: 'p3', name: 'そうた', hon: 'くん', age: 6, skin: '#f7cfa8', hair: '#1f1f2a', style: 'boy2',
    worry: '「おくに おおきい はが はえてきたよ」', title: '6さいきゅうしの シーラント', arch: 'primary6',
    steps: ['find6', 'clean', 'wattes', 'etch', 'wash', 'dry', 'seal', 'cure', 'bite'], card: 'c3',
    thanks: 'おおきな はを だいじに するね！' },
  { id: 'p4', name: 'ゆい', hon: 'ちゃん', age: 6, skin: '#ffdcc0', hair: '#4a2a1a', style: 'girl',
    worry: '「まえばが ぐらぐら。うしろから あたらしい はが はえてきた」', title: 'ぐらぐらの こどもの はを ぬく', arch: 'primary',
    steps: ['find4', 'xray4', 'topical', 'extract', 'gauze'], card: 'c4',
    thanks: 'ぬけた はは おうちに もってかえるね！' },
];

// まなびカード
const CARDS = {
  c1: { h: 'むしばの ひみつ', li: [
    '<b>むしば</b>は、くちの なかの「<b>ミュータンス<ruby>菌<rt>きん</rt></ruby></b>」が さとうを たべて「<ruby>酸<rt>さん</rt></ruby>」を だし、はを とかす びょうき。',
    'はと はの あいだの むしばは めでは みえにくい。<b>レントゲン</b>では むしばが <b>くろく</b> うつるよ。',
    'けずる まえに <b>ますい</b>。さきに ぬりぐすりで はぐきを ねむらせ、<b>ゆっくり</b> いれると いたくない。',
    'むしばの やわらかい ところは「<b>うしょく けんちえき</b>」で そめて、のこさず とる。げんきな ところは けずらない。',
    'あなは はの いろの「<b>レジン</b>」で つめて、<b>あおい ひかり</b>で かためる。さいごに <b>かみあわせ</b>を みて、たかい ところを けずって みがく。',
    'おやつは <b>じかんを きめて</b> たべよう。こどもの は（<ruby>乳歯<rt>にゅうし</rt></ruby>）は ぜんぶで <b>20ぽん</b>。',
  ] },
  c2: { h: 'はの おそうじの ひみつ', li: [
    '<b><ruby>歯垢<rt>しこう</rt></ruby>（プラーク）</b>は <b>ばいきんの かたまり</b>。しろくて みえにくいので、「そめだし」で あかくすると よく わかる。',
    'みがきのこしが おおいのは「<b>はと はぐきの さかいめ</b>」と「<b>おくばの みぞ</b>」。',
    'しこうが かたまると「<b><ruby>歯石<rt>しせき</rt></ruby></b>」。<b>したの まえばの うらがわ</b>に つきやすく、はブラシでは とれないので はいしゃさんで とる。',
    'はいしゃさんの きかいで みがく おそうじを「<b>PMTC</b>」と いうよ。',
    '<b>フッそ</b>は はを つよくして、とけかけた ひょうめんを なおす（<ruby>再石灰化<rt>さいせっかいか</rt></ruby>）てだすけを する。ぬったあと <b>30ぷんは のんだり たべたり しない</b>。',
  ] },
  c3: { h: '6さいきゅうしの ひみつ', li: [
    '<b>6さいきゅうし</b>は、6さいごろに こどもの はの <b>いちばん おく</b>に はえてくる <b>おとなの は</b>。うえ・した・みぎ・ひだりで <b>4ほん</b>。',
    'おとなの はの なかで いちばん おおきく、かむ ちからの ちゅうしん。<b>いっしょう つかう は</b>だよ。',
    '<b>みぞが ふかく</b>、はえかけは せが ひくくて はブラシが とどきにくいので、<b>むしばに なりやすい</b>。',
    '<b>シーラント</b>の てじゅん：はを きれいに → つばが つかないように <b>わた</b>で まもる → くすりで ひょうめんを ととのえる → <b>あらって かわかす</b>（しろく にごれば OK）→ ぬる → ひかりで かためる → かみあわせを みる。',
    'おとなの はは ぜんぶで <b>28ほん</b>（おやしらずを いれると 32ほん）。',
  ] },
  c4: { h: 'はが はえかわる ひみつ', li: [
    '6さいごろから、こどもの はが ぬけて <b>おとなの はに はえかわる</b>。まえばから はじまることが おおいよ。',
    'したから おとなの はが そだってくると、こどもの はの <b>ねっこが とけて みじかく</b> なり、ぐらぐらに なる。',
    'したの まえばは、おとなの はが <b>うしろ（したの がわ）から</b> はえて「<b>にまいば</b>」に なることが ある。なかなか ぬけないときは はいしゃさんで ぬく。',
    'ぐらぐらの はは、<b>ぬりぐすりの ますい</b>だけで ぬくことも あるよ。',
    'ぬいたあとは <b>ガーゼを しばらく かんで</b> ちを とめる。その日は ぶくぶく うがいを <b>しすぎない</b>。',
  ] },
};

// ---------- ステップ ----------
// view: 'arch'＝くちの なか全体 / 'tooth'＝1本を おおきく / 'xray'＝レントゲン
const STEPS = {
  search: { view: 'arch', tool: 'mirror', toolName: 'ミラー と ライト', label: 'みる',
    say: 'ライトで くちの なかを てらして、<b>むしば</b>を さがそう。みつけたら タップ！',
    tip: '<b>ほんものでは</b> ミラーで みえにくい ところを うつし、ライトで てらして 1ぽんずつ みるよ。' },
  xray: { view: 'xray', tool: 'none', toolName: 'レントゲン', label: 'レントゲン',
    say: 'レントゲンで はの なかを みよう。むしばは <b>くろく</b> うつるよ。むしばを タップ！',
    tip: '<b>ほんものでは</b> めで みえない はの なかや、はと はの あいだの むしばを レントゲンで しらべるよ。' },
  masui: { view: 'tooth', tool: 'swab', toolName: 'ぬりぐすり', label: 'ますい',
    say: 'まず はぐきの <b>まる</b>の ところに <b>ぬりぐすり</b>を ぬろう',
    toolName2: 'ますいの ちゅうしゃ',
    say2: 'ますいの ちゅうしゃ。まるの うえで <b>ボタンを おしたまま</b>、うごかさずに まってね',
    tip: '<b>ほんものでは</b> ぬりぐすり（ひょうめんますい）で はぐきを ねむらせてから ちゅうしゃ。ゆっくり いれると いたくないよ。' },
  wattes: { view: 'tooth', tool: 'none', toolName: 'ロールワッテ（わた）', label: 'わた',
    say: '<b>わた</b>の うえで ボタンを おしたまま はこんで、はの よこの てんせんに おこう（2こ）',
    tip: '<b>ほんものでは</b> つばや ほっぺ・したが じゃまに ならないように、わたや ゴムの シートで はを まもるよ。' },
  drill: { view: 'tooth', tool: 'turbine', toolName: 'タービン（はやく まわる）', label: 'けずる',
    say: 'くろい <b>むしば</b>を なぞって けずろう。<b>げんきな ところは けずらないで</b>ね！',
    tip: '<b>ほんものでは</b> タービンは おみずを かけながら、かたい ところを けずる。いっしょに バキュームで すうよ。' },
  detect: { view: 'tooth', tool: 'detector', toolName: 'うしょく けんちえき', label: 'そめる',
    say: 'あなに <b>あかい くすり</b>を ぬろう。のこった むしばが <b>ピンク</b>に そまるよ',
    tip: '<b>ほんものでは</b>「うしょく けんちえき」で、めで みわけにくい やわらかい むしばを そめて たしかめるよ。' },
  excavate: { view: 'tooth', tool: 'engine', toolName: 'エンジン（ゆっくり まわる）', label: 'とる',
    say: 'ピンクに そまった ところを <b>ゆっくり まわる ドリル</b>で とろう',
    tip: '<b>ほんものでは</b> やわらかい むしばは ゆっくり まわる「エンジン」で ていねいに とるよ。' },
  rinse: { view: 'tooth', tool: 'vacuum', toolName: 'みず と バキューム', label: 'あらう',
    say: 'おみずで あらって、けずりかすを <b>バキューム</b>で すいとろう',
    tip: '<b>ほんものでは</b> バキュームは くちの なかの おみずや けずりかすを すいこむ そうじきだよ。' },
  bond: { view: 'tooth', tool: 'bondbrush', toolName: 'ボンド', label: 'ボンド',
    say: 'あなの なかに <b>ボンド</b>を ぬろう',
    toolName2: 'ひかりの きかい',
    say2: 'ボンドを <b>あおい ひかり</b>で かためよう。はの うえで ボタンを おしたまま まってね',
    tip: '<b>ほんものでは</b> つめものが はに しっかり くっつくように、さきに せっちゃくざい（ボンド）を ぬって ひかりで かためるよ。' },
  fill: { view: 'tooth', tool: 'resin', toolName: 'レジン（つめもの）', label: 'つめる',
    say: 'あなを なぞって はの いろの つめもの「<b>レジン</b>」を つめよう',
    tip: '<b>ほんものでは</b> レジンは はの いろに にた プラスチック。はの かたちに あわせて つめるよ。' },
  cure: { view: 'tooth', tool: 'light', toolName: 'ひかりの きかい', label: 'かためる',
    say: 'はの うえで <b>ボタンを おしたまま</b> まってね。あおい ひかりで かためるよ',
    tip: '<b>ほんものでは</b> レジンや シーラントは、あおい ひかりを あてると かたまる。ひかりを みないように するよ。' },
  bite: { view: 'tooth', tool: 'paper', toolName: 'こうごうし（あかい かみ）', label: 'かみあわせ',
    say: 'あかい かみを のせたよ。はを タップして「<b>カチカチ</b>」かんでもらおう',
    toolName2: 'タービン（すこし けずる）',
    say2: 'あかい しるしは <b>たかすぎる</b> ところ。こすって けずろう',
    tip: '<b>ほんものでは</b> あかい かみ（こうごうし）を かんでもらい、いろが つく たかい ところを すこし けずって かみあわせを あわせるよ。' },
  polish: { view: 'tooth', tool: 'polisher', toolName: 'みがく きかい', label: 'みがく',
    say: 'つめた ところを くるくる こすって <b>つるつる</b>に しよう',
    tip: '<b>ほんものでは</b> つるつるに みがくと よごれが つきにくく、ながもち するよ。' },
  dye: { view: 'arch', tool: 'swab', toolName: 'そめだしえき', label: 'そめだし',
    say: '<b>そめだしえき</b>を ぜんぶの はに ぬってみよう',
    tip: '<b>ほんものでは</b> しこう（プラーク）は しろくて みえにくいので、そめだして みがきのこしを いっしょに みるよ。' },
  brush: { view: 'arch', tool: 'brush', toolName: 'はブラシ', label: 'はみがき',
    say: 'あかい ところを <b>はブラシ</b>で こまかく みがこう',
    tip: '<b>ほんものでは</b> はみがきの しかたを れんしゅうするよ。はと はぐきの さかいめは こまかく うごかそう。' },
  scale: { view: 'arch', tool: 'scaler', toolName: 'スケーラー（しせきとり）', label: 'しせき',
    say: 'したの まえばの <b>うらがわ</b>の きいろくて かたい「<b>しせき</b>」を こすって とろう',
    tip: '<b>ほんものでは</b> しせきは だえきの でぐちに ちかい したの まえばの うらに つきやすい。はブラシでは とれないよ。' },
  pmtc: { view: 'arch', tool: 'polisher', toolName: 'みがく きかい（PMTC）', label: 'PMTC',
    say: 'はいしゃさんの きかいで ぜんぶの はを <b>ピカピカ</b>に みがこう',
    tip: '<b>ほんものでは</b> きかいと みがきこで はの ひょうめんを つるつるに する。これを PMTC と いうよ。' },
  fluor: { view: 'arch', tool: 'fluor', toolName: 'フッそ', label: 'フッそ',
    say: 'さいごに <b>フッそ</b>を ぜんぶの はに ぬって、はを つよくしよう',
    tip: '<b>ほんものでは</b> フッそを ぬったあと 30ぷんは のんだり たべたり しないでね、と おはなし するよ。' },
  find6: { view: 'arch', tool: 'mirror', toolName: 'ミラー', label: 'みる',
    say: 'いちばん おくに はえてきた <b>おおきな は</b>を さがして タップ！',
    tip: '<b>ほんものでは</b> 6さいごろ、こどもの はの おくに おとなの は「6さいきゅうし」が はえてくるのを たしかめるよ。' },
  clean: { view: 'tooth', tool: 'brush', toolName: 'きかいの ブラシ', label: 'きれいに',
    say: 'みぞに つまった <b>よごれ</b>を こすって かきだそう',
    tip: '<b>ほんものでは</b> よごれが のこると シーラントが くっつかない。さいしょに みぞを きれいに するよ。' },
  etch: { view: 'tooth', tool: 'etch', toolName: 'ひょうめんしょりざい', label: 'くすり',
    say: 'みぞの まわりに <b>あおい くすり</b>を ぬろう',
    tip: '<b>ほんものでは</b> くすり（エッチングざい）で はの ひょうめんを ざらざらに して、シーラントが くっつきやすく するよ。' },
  wash: { view: 'tooth', tool: 'water', toolName: 'みず と バキューム', label: 'あらう',
    say: 'あおい くすりを <b>おみず</b>で きれいに あらいながそう',
    tip: '<b>ほんものでは</b> くすりは しっかり あらいながして、バキュームで すいとるよ。' },
  dry: { view: 'tooth', tool: 'air', toolName: 'エアー（かぜ）', label: 'かわかす',
    say: 'はの うえで ボタンを おして <b>かぜ</b>で かわかそう。しろく にごったら OK！',
    tip: '<b>ほんものでは</b> くすりで ととのえた ところは かわかすと しろく にごって みえる。これが じゅんびが できた あいず。' },
  find4: { view: 'arch', tool: 'mirror', toolName: 'ミラー', label: 'みる',
    say: '<b>ぐらぐら</b> している こどもの はを さがして タップ！ うしろに あたらしい はが みえるよ',
    tip: '<b>ほんものでは</b> はを そっと おして、どれくらい ぐらぐら するか しらべるよ。' },
  xray4: { view: 'side', tool: 'none', toolName: 'レントゲン', label: 'レントゲン',
    say: 'レントゲンで みよう。したに かくれている <b>おとなの は</b>を タップ！',
    tip: '<b>ほんものでは</b> おとなの はが ちゃんと そだっているか、こどもの はの ねっこが どれくらい とけたかを みるよ。' },
  topical: { view: 'side', tool: 'swab', toolName: 'ぬりぐすり', label: 'ますい',
    say: 'はぐきの <b>まる</b>の ところに <b>ぬりぐすり</b>を ぬろう',
    tip: '<b>ほんものでは</b> ぐらぐらの はは、ぬりぐすりの ますいだけで ぬくことも あるよ。' },
  extract: { view: 'side', tool: 'forceps', toolName: 'ばってんし（はを つかむ）', label: 'ぬく',
    say: 'はの うえで ボタンを おして つかみ、スティックで <b>よこに ゆっくり</b> ゆらそう',
    say2: 'ぐらぐらに なった！ ボタンを おしたまま <b>うえに</b> ひっぱって ぬこう',
    tip: '<b>ほんものでは</b> いきなり ひっぱらずに、まず ゆっくり ゆらして ぬきやすく するよ。' },
  gauze: { view: 'side', tool: 'gauze', toolName: 'ガーゼ', label: 'ガーゼ',
    say: 'ぬけた あなの うえで <b>ボタンを おしたまま</b> まってね（ガーゼを かんで ちを とめる）',
    tip: '<b>ほんものでは</b> ガーゼを しばらく かんで ちを とめるよ。その日は ぶくぶく うがいを しすぎないでね。' },
  seal: { view: 'tooth', tool: 'sealant', toolName: 'シーラント', label: 'ぬる',
    say: 'みぞを なぞって「<b>シーラント</b>」で ふさごう',
    tip: '<b>ほんものでは</b> シーラントは ふかい みぞを ふさいで むしばを ふせぐ ぬりものだよ。' },
};

// ---------- ゲームの じょうたい ----------
const G = { p: null, si: 0, step: null, key: '', t: 0, mist: 0, done: false, doneT: 0, phase: 0,
  ouchT: 0, fade: 0, flash: null, pops: [], parts: [], chips: [], teeth: [], arch: null,
  holdT: 0, shine: 0, hintT: 0, running: false, finished: false, wattes: [], grab: null, badT: 0, toolX: 300, toolY: 470 };

// ---------- 1本を おおきく みる（マス目） ----------
const N = 48, TB = { cx: 180, cy: 318, s: 128 };
const CS = TB.s * 2 / N;
const OUT = 0, EN = 1, DEC = 2, SOFT = 3, HOLE = 4, RES = 5, CUR = 6, DEB = 7, GRV = 8, SEAL = 9, SEALC = 10;
const NN = N * N;
const cell = new Uint8Array(NN), hp = new Float32Array(NN), hash = new Float32Array(NN);
const soft = new Uint8Array(NN), dyed = new Uint8Array(NN), bonded = new Uint8Array(NN),
  gel = new Uint8Array(NN), etched = new Uint8Array(NN), high = new Float32Array(NN), zone = new Uint8Array(NN);
const cnt = { dec0: 1, deb0: 1, grv0: 1, zone0: 1, soft0: 1 };
const GROOVES = [[-0.62, 0.06, -0.2, -0.02], [-0.2, -0.02, 0.22, 0.03], [0.22, 0.03, 0.62, -0.04],
  [-0.2, -0.02, -0.3, 0.55], [-0.2, -0.02, -0.36, -0.52], [0.22, 0.03, 0.34, -0.56], [0.22, 0.03, 0.42, 0.52]];
const nc = i => (i + 0.5) / N * 2 - 1;
const inTooth = (x, y) => Math.pow(Math.abs(x), 3) + Math.pow(Math.abs(y / 0.9), 3) <= 0.82;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function grooveDist(x, y) { let m = 9; for (const g of GROOVES) m = Math.min(m, segDist(x, y, g[0], g[1], g[2], g[3])); return m; }
function gridInit(kind) {
  const R = rng(kind === 'cavity' ? 11 : 23);
  for (const a of [soft, dyed, bonded, gel, etched, zone]) a.fill(0);
  high.fill(0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = nc(i), y = nc(j);
    hash[k] = R(); hp[k] = 1;
    if (!inTooth(x, y)) { cell[k] = OUT; continue; }
    cell[k] = EN;
    if (kind === 'cavity') {
      const dx = x - 0.2, dy = y + 0.02, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      const edge = 0.24 + 0.05 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 9);
      if (r < edge || (grooveDist(x, y) < 0.06 && r < 0.42)) cell[k] = DEC;
      if (cell[k] === DEC && r < edge * 0.72 && hash[k] < 0.6) soft[k] = 1;   // けずったあとに のこる やわらかい むしば
    } else {
      const gd = grooveDist(x, y);
      if (gd < 0.065) cell[k] = hash[k] < 0.8 ? DEB : GRV;
      if (gd < 0.16) zone[k] = 1;                              // エッチングする はんい
    }
  }
  cnt.dec0 = Math.max(1, count(DEC)); cnt.deb0 = Math.max(1, count(DEB));
  cnt.zone0 = Math.max(1, zone.reduce((a, v) => a + v, 0)); cnt.soft0 = Math.max(1, soft.reduce((a, v) => a + v, 0));
}
function count(s) { let n = 0; for (let k = 0; k < NN; k++) if (cell[k] === s) n++; return n; }
function countIf(fn) { let n = 0; for (let k = 0; k < NN; k++) if (fn(k)) n++; return n; }
function eachCell(px, py, r, fn) {
  const x0 = TB.cx - TB.s, y0 = TB.cy - TB.s;
  const i0 = Math.max(0, Math.floor((px - r - x0) / CS)), i1 = Math.min(N - 1, Math.floor((px + r - x0) / CS));
  const j0 = Math.max(0, Math.floor((py - r - y0) / CS)), j1 = Math.min(N - 1, Math.floor((py + r - y0) / CS));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = x0 + (i + 0.5) * CS, cy = y0 + (j + 0.5) * CS;
    if ((cx - px) ** 2 + (cy - py) ** 2 <= r * r) fn(j * N + i, cx, cy);
  }
}
function cellAt(px, py) {
  const i = Math.floor((px - TB.cx + TB.s) / CS), j = Math.floor((py - TB.cy + TB.s) / CS);
  return (i < 0 || j < 0 || i >= N || j >= N) ? -1 : j * N + i;
}
const cellXY = k => ({ x: TB.cx - TB.s + (k % N + 0.5) * CS, y: TB.cy - TB.s + ((k / N | 0) + 0.5) * CS });
const onTooth = (x, y) => { const k = cellAt(x, y); return k >= 0 && cell[k] !== OUT; };
// ますいの ばしょ（はぐき）
const GUM = { x: 96, y: TB.cy + TB.s * 0.9, r: 22 };
// わたの おきば
const SLOTS = [{ x: TB.cx, y: TB.cy - TB.s * 0.9 - 18 }, { x: TB.cx, y: TB.cy + TB.s * 0.9 + 18 }];
const ROLL = { w: 150, h: 26 };

// ---------- くちの なか全体（はならび） ----------
// [はばmm, あつみmm]。こどもの はの したあご（まえから A B C D E）、6さいきゅうし
const TW = { A: [4.2, 5.2], B: [4.7, 5.4], C: [5.9, 6.0], D: [7.8, 7.4], E: [9.8, 8.8], M6: [11.2, 10.2] };
function buildArch(with6) {
  const order = ['A', 'B', 'C', 'D', 'E'].concat(with6 ? ['M6'] : []);
  const k = with6 ? 6.6 : 8.0;
  const A = { cx: 180, cy: with6 ? 250 : 262, rx: 116, ry: 196 };
  const th0 = -0.75, th1 = Math.PI + 0.75, M = 1500, S = [0], TH = [th0];
  for (let i = 1; i <= M; i++) {
    const a = th0 + (th1 - th0) * i / M, b = th0 + (th1 - th0) * (i - 1) / M;
    S.push(S[i - 1] + Math.hypot(A.rx * (Math.cos(a) - Math.cos(b)), A.ry * (Math.sin(a) - Math.sin(b)))); TH.push(a);
  }
  const thAt = s => { let lo = 0, hi = M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m; } return TH[lo]; };
  const sMid = S[M / 2];
  const teeth = [], R = rng(5);
  let thMin = 9, thMax = -9;
  for (const side of [1, -1]) {
    let acc = 0.15 * k;
    order.forEach((type, idx) => {
      const w = TW[type][0] * k, d = TW[type][1] * k;
      const th = thAt(sMid - side * (acc + w / 2)); acc += w + 0.3 * k;
      thMin = Math.min(thMin, th); thMax = Math.max(thMax, th);
      const x = A.cx + A.rx * Math.cos(th), y = A.cy + A.ry * Math.sin(th);
      const nx = Math.cos(th) / A.rx, ny = Math.sin(th) / A.ry;
      const t = { type, idx, side, x, y, w, d, ang: Math.atan2(ny, nx) - Math.PI / 2,
        molar: idx >= 3, hitR: Math.max(w, d) / 2 + 6,
        plaque: clamp((idx >= 3 ? 0.75 : 0.45) + R() * 0.35, 0, 1), dyed: 0, fluor: 0, gloss: 0,
        cavity: false, erupt: type === 'M6', blobs: [], tartar: [] };
      for (let b = 0; b < 4; b++) t.blobs.push({ lx: (R() - 0.5) * w * 0.7, ly: (b % 2 ? 1 : -1) * d * (0.28 + R() * 0.12), r: (0.16 + R() * 0.1) * Math.min(w, d) });
      if (idx <= 1) for (const lx of [-0.25, 0.22]) t.tartar.push({ lx: lx * w, ly: -d / 2 - 1.5, r: 5.5 + R() * 2, hp: 1 });
      teeth.push(t);
    });
  }
  G.arch = { A, k, thMin: thMin - 0.12, thMax: thMax + 0.12 };
  G.teeth = teeth;
}
function toWorld(t, lx, ly) {
  const c = Math.cos(t.ang), s = Math.sin(t.ang);
  return { x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c };
}
function toothAt(x, y) {
  let best = null, bd = 1e9;
  for (const t of G.teeth) { const d = Math.hypot(t.x - x, t.y - y); if (d < t.hitR && d < bd) { bd = d; best = t; } }
  return best;
}
function teethNear(x, y, r) { return G.teeth.filter(t => Math.hypot(t.x - x, t.y - y) < t.hitR + r); }

// ---------- レントゲン ----------
const XR = { D: { x: 116, w: 86 }, E: { x: 236, w: 112 }, top: 205, cej: 292, apex: 420,
  cav: { x: 236 + 24, y: 240, rx: 15, ry: 24 } };

// ---------- ポインタ ----------
// ゆびで さわるときは、どうぐの さきを ゆびの すこし うえに だす（ゆびで かくれずに みながら ちりょうできる）
const TOUCH_OFF = 56;
const P = { x: 180, y: 318, down: false, justDown: false, sx: 0, sy: 0, moved: 0, fx: 180, fy: 318, hover: false,
  off: 0, rx: 180, ry: 318, rsx: 0, rsy: 0 };
function toLocal(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
// ゆびで がめんを さわったときは カーソルを そこへ うごかすだけ（はを えらぶ ばめんだけ タップで きまる）
const TAP_STEPS = ['search', 'find6', 'xray', 'find4', 'xray4'];
function isTapStep() { return TAP_STEPS.includes(G.key) || (G.key === 'bite' && G.phase === 0); }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit(); bgmStart();
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const p = toLocal(e);
  if (e.pointerType !== 'mouse') { CTRL.used = true; CTRL.cx = p.x; CTRL.cy = clamp(p.y, TOP + 6, H - 6); CTRL.touch = true; CTRL.tsx = p.x; CTRL.tsy = p.y; CTRL.tmoved = 0; return; }
  CTRL.used = false;
  P.off = e.pointerType === 'mouse' ? 0 : TOUCH_OFF;
  P.down = true; P.justDown = true; P.moved = 0;
  P.rx = P.rsx = p.x; P.ry = P.rsy = p.y;
  P.x = P.sx = P.fx = p.x; P.y = P.sy = P.fy = p.y - P.off;
});
cv.addEventListener('pointermove', e => {
  const p = toLocal(e);
  if (CTRL.touch) { CTRL.tmoved += Math.hypot(p.x - CTRL.cx, p.y - CTRL.cy); CTRL.cx = p.x; CTRL.cy = clamp(p.y, TOP + 6, H - 6); return; }
  if (e.pointerType !== 'mouse' && CTRL.used) return; if (P.down) P.moved += Math.hypot(p.x - P.rx, p.y - P.ry);
  P.rx = p.x; P.ry = p.y; P.x = p.x; P.y = p.y - (P.down ? P.off : 0); P.hover = e.pointerType === 'mouse';
});
function up(e) {
  if (CTRL.touch) { CTRL.touch = false; const p = toLocal(e); if (CTRL.tmoved < 16 && G.step && !G.done && isTapStep()) tapAt(p.x, p.y); return; }
  if (!P.down) return; P.down = false;
  const p = toLocal(e);
  dropRoll();
  if (P.moved < 16 && G.step && !G.done) tapAt(p.x, p.y);   // タップは ゆびの ばしょ そのもの
}
cv.addEventListener('pointerup', up);
for (const ev of ['touchstart', 'touchmove', 'touchend']) cv.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => { if ($('#play').classList.contains('on') && e.cancelable) e.preventDefault(); }, { passive: false });
cv.addEventListener('pointercancel', () => { CTRL.touch = false; if (!CTRL.a) { P.down = false; dropRoll(); } });
cv.addEventListener('pointerleave', () => { P.hover = false; });

// ---------- コントローラー（ひだり＝スティック・みぎ＝つかうボタン） ----------
const CTRL = { vx: 0, vy: 0, a: false, cx: 180, cy: 318, used: false, touch: false, keys: {} };
(function setupPad() {
  const stick = $('#stick'), knob = $('#knob'), ab = $('#abtn');
  let sid = null;
  const setStick = e => {
    const r = stick.getBoundingClientRect(), R = r.width / 2 - 18;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    CTRL.vx = dx / R; CTRL.vy = dy / R; CTRL.used = true;
  };
  const endStick = () => { sid = null; CTRL.vx = CTRL.vy = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (_) {} setStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  ab.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); bgmStart(); try { ab.setPointerCapture(e.pointerId); } catch (_) {} ctrlDown(); });
  ab.addEventListener('pointerup', ctrlUp); ab.addEventListener('pointercancel', ctrlUp);
  for (const el of [stick, ab]) for (const ev of ['touchstart', 'touchmove', 'touchend']) el.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  // パソコン：やじるしキー と スペース
  document.addEventListener('keydown', e => {
    if (!$('#play').classList.contains('on')) return;
    if (e.key.startsWith('Arrow')) { CTRL.keys[e.key] = true; CTRL.used = true; e.preventDefault(); }
    if ((e.key === ' ' || e.key === 'Enter') && !CTRL.a) { e.preventDefault(); ctrlDown(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key.startsWith('Arrow')) CTRL.keys[e.key] = false;
    if (e.key === ' ' || e.key === 'Enter') ctrlUp();
  });
})();
function ctrlDown() {
  if (CTRL.a || !G.step) return;
  CTRL.a = true; CTRL.used = true; $('#abtn').classList.add('on');
  P.off = 0; P.down = true; P.justDown = true; P.moved = 0;
  P.x = P.sx = P.fx = P.rx = P.rsx = CTRL.cx; P.y = P.sy = P.fy = P.ry = P.rsy = CTRL.cy;
}
function ctrlUp() {
  if (!CTRL.a) return;
  CTRL.a = false; $('#abtn').classList.remove('on');
  P.down = false; dropRoll();
  if (P.moved < 16 && G.step && !G.done) tapAt(CTRL.cx, CTRL.cy);
}
function ctrlTick(dt) {
  if (!CTRL.used) return;
  let vx = CTRL.vx, vy = CTRL.vy;
  const k = CTRL.keys; if (k.ArrowLeft) vx = -1; if (k.ArrowRight) vx = 1; if (k.ArrowUp) vy = -1; if (k.ArrowDown) vy = 1;
  const m = Math.min(1, Math.hypot(vx, vy));
  if (m > 0.08) { const sp = 240 * Math.pow(m, 1.5) / Math.max(m, 0.001); CTRL.cx += vx * sp * dt; CTRL.cy += vy * sp * dt; }
  CTRL.cx = clamp(CTRL.cx, 8, W - 8); CTRL.cy = clamp(CTRL.cy, TOP + 6, H - 6);
  if (P.down) P.moved += Math.hypot(CTRL.cx - P.x, CTRL.cy - P.y);
  P.x = P.rx = CTRL.cx; P.y = P.ry = CTRL.cy; P.hover = true;
}

// ---------- しんこう ----------
function startPatient(p) {
  G.p = p; G.si = 0; G.mist = 0; G.finished = false; G.parts = []; G.chips = []; G.pops = []; G.wattes = []; G.grab = null;
  buildArch(p.arch === 'primary6');
  G.ext = { wig: 0, lift: 0, ang: 0, out: false, outT: 0, gauze: false, grip: false };
  if (p.id === 'p4') G.teeth.find(t => t.side === -1 && t.type === 'A').loose = true;
  if (p.id === 'p1') G.teeth.find(t => t.side === 1 && t.type === 'E').cavity = true;
  if (p.id !== 'p2') G.teeth.forEach(t => { t.plaque = 0; t.tartar = []; });  // しこう・しせきは おそうじの こだけ
  gridInit(p.id === 'p1' ? 'cavity' : 'groove');
  show('play'); startStep();
  if (!G.running) { G.running = true; last = performance.now(); requestAnimationFrame(frame); }
}
function setSay() {
  $('#say').innerHTML = G.phase && G.step.say2 ? G.step.say2 : G.step.say;
  $('#tip').innerHTML = G.step.tip;
}
function startStep() {
  G.key = G.p.steps[G.si]; G.step = STEPS[G.key];
  G.lastPr = 0; G.lastQ = 0; G.lastSec = 0; if (G.si > 0) SFX.chime();
  G.t = 0; G.done = false; G.doneT = 0; G.holdT = 0; G.shine = 0; G.hintT = 0; G.phase = 0; G.badT = 0;
  if (G.key === 'rinse' && G.chips.length < 24) {
    const holes = []; for (let k = 0; k < NN; k++) if (cell[k] === HOLE) holes.push(k);
    for (let n = G.chips.length; n < 24 && holes.length; n++) { const c = cellXY(holes[(Math.random() * holes.length) | 0]); addChip(c.x, c.y); }
  }
  if (G.key === 'wattes') G.wattes = [{ x: 92, y: 530, slot: null }, { x: 268, y: 530, slot: null }];
  if (G.key === 'seal') cnt.grv0 = Math.max(1, count(GRV));
  setSay();
  $('#toolName').textContent = G.step.toolName;
  resize();
  if (!CTRL.used) { P.x = P.fx = 180; P.y = P.fy = 318; }
  if (G.toolX == null) { G.toolX = 300; G.toolY = 470; }
}
function stepDone() {
  if (G.done) return; G.done = true; G.doneT = 0; SFX.ding();
  G.flash = { text: G.si === G.p.steps.length - 1 ? 'かんせい！' : 'できた！', t: 0 };
  for (let i = 0; i < 18; i++) G.parts.push(star(180, 318));
}
function nextPhase() { G.phase++; G.holdT = 0; G.lastSec = 0; G.badT = 0; SFX.ding(); setSay(); if (G.step.toolName2) $('#toolName').textContent = G.step.toolName2; }
function nextStep() {
  const prevView = G.step.view;
  G.si++;
  if (G.si >= G.p.steps.length) return finish();
  startStep();
  if (G.step.view !== prevView) G.fade = 1;
}
function stars() { return G.mist <= 1 ? 3 : G.mist <= 4 ? 2 : 1; }
function finish() {
  G.finished = true; loopsOff(); bgmDuck(false); SFX.fanfare();
  const st = loadStars(), s = stars(); st[G.p.id] = Math.max(st[G.p.id] || 0, s); saveStars(st);
  $('#rstars').textContent = '★'.repeat(s) + '☆'.repeat(3 - s);
  $('#rmsg').textContent = G.p.name + G.p.hon + '「' + G.p.thanks + '」';
  const c = CARDS[G.p.card];
  const order = G.p.steps.map(k => STEPS[k].label).join(' → ');
  $('#rcard').innerHTML = '<h3>おぼえた こと：' + c.h + '</h3><ul>' + c.li.map(x => '<li>' + x + '</li>').join('') + '</ul>' +
    '<p class="order"><b>きょうの ちりょうの じゅんばん</b><br>' + order + '</p>';
  const rf = $('#rface'), rc = rf.getContext('2d'); rc.clearRect(0, 0, 220, 220);
  drawFace(rc, 110, 115, 92, G.p, 'happy');
  setTimeout(() => show('result'), 400);
}
function mistake(text) {
  G.mist++; G.ouchT = 0.9; SFX.ouch();
  G.pops.push({ x: P.x, y: P.y - 30, text: text || 'いたっ！', t: 0, c: '#ff5a7a' });
}
function pop(x, y, text, c) { G.pops.push({ x, y, text, t: 0, c: c || '#ffffff' }); }

function tapAt(x, y) {
  const k = G.key;
  if (k === 'search') {
    const t = toothAt(x, y);
    if (!t) return;
    if (t.cavity) { pop(t.x, t.y - 30, 'みつけた！', '#ffe066'); stepDone(); }
    else { SFX.no(); pop(t.x, t.y - 26, 'この はは げんき！'); }
  } else if (k === 'find6') {
    const t = toothAt(x, y);
    if (!t) return;
    if (t.type === 'M6') { pop(t.x, t.y - 34, '6さいきゅうし！', '#ffe066'); stepDone(); }
    else { SFX.no(); pop(t.x, t.y - 26, 'これは こどもの は'); }
  } else if (k === 'xray') {
    const c = XR.cav;
    if (Math.hypot((x - c.x) / (c.rx + 10), (y - c.y) / (c.ry + 10)) < 1) { pop(c.x, c.y - 40, 'むしば みつけた！', '#ffe066'); stepDone(); return; }
    for (const T of [XR.D, XR.E]) {
      if (Math.abs(x - T.x) < T.w * 0.24 && y > XR.top + 30 && y < XR.cej + 20) { SFX.no(); pop(x, y - 26, 'しんけいの へや（しずい）だよ'); return; }
      if (Math.hypot(x - T.x, y - 466) < 36) { SFX.no(); pop(x, y - 30, 'おとなの はの たまご！'); return; }
      if (Math.abs(x - T.x) < T.w / 2 && y > XR.top && y < XR.apex) { SFX.no(); pop(x, y - 26, 'ここは げんき'); return; }
    }
  } else if (k === 'find4') {
    const t = toothAt(x, y);
    if (!t) return;
    if (t.loose) { pop(t.x, t.y - 34, 'ぐらぐら！', '#ffe066'); stepDone(); }
    else { SFX.no(); pop(t.x, t.y - 26, 'この はは ぐらぐら してないよ'); }
  } else if (k === 'xray4') {
    if (Math.hypot((x - SD.qx) / 44, (y - SD.qy) / 110) < 1) { pop(SD.qx, SD.qy - 130, 'おとなの は みつけた！', '#ffe066'); stepDone(); return; }
    if (Math.abs(x - SD.px) < 24 && y > SD.gum - 6 && y < SD.gum + 40) { SFX.no(); pop(x, y - 26, 'こどもの はの ねっこ。とけて みじかい'); return; }
    if (Math.abs(x - SD.px) < 24 && y > SD.gum - 90 && y < SD.gum) { SFX.no(); pop(x, y - 26, 'ぐらぐらの こどもの は'); return; }
  } else if (k === 'bite' && G.phase === 0) {
    if (!onTooth(x, y)) return;
    SFX.click(); pop(TB.cx, TB.cy - TB.s - 6, 'カチカチ', '#ffffff');
    // つめた ところの 3かしょに あかい いろが つく（たかすぎる ところ）
    const filled = []; for (let i = 0; i < NN; i++) if (cell[i] === CUR || cell[i] === SEALC) filled.push(i);
    const R = rng(77);
    for (let n = 0; n < 3 && filled.length; n++) {
      const c = cellXY(filled[(R() * filled.length) | 0]);
      eachCell(c.x, c.y, CS * 1.9, i => { if (cell[i] === CUR || cell[i] === SEALC) high[i] = 1; });
    }
    cnt.high0 = Math.max(1, countIf(i => high[i] > 0));
    nextPhase();
  }
}

// ---------- わた（ロールワッテ） ----------
function rollAt(x, y) { return G.wattes.find(r => Math.abs(x - r.x) < ROLL.w / 2 + 6 && Math.abs(y - r.y) < ROLL.h / 2 + 12); }
function dropRoll() {
  const r = G.grab; if (!r) return; G.grab = null;
  for (const s of SLOTS) {
    if (Math.hypot(r.x - s.x, r.y - s.y) < 44 && !G.wattes.some(o => o !== r && o.slot === s)) { r.x = s.x; r.y = s.y; r.slot = s; SFX.pop(); }
  }
  if (G.key === 'wattes' && !G.done && G.wattes.every(o => o.slot)) stepDone();
}

// ---------- まいフレーム ----------
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if ($('#play').classList.contains('on') && !G.finished) { ctrlTick(dt); update(dt); draw(); }
  else loopsOff();
  requestAnimationFrame(frame);
}
function addChip(x, y) {
  if (G.chips.length > 60) return;
  const c = ['#e9dcc0', '#d7c49e', '#5a3a22', '#f3ead6'][(Math.random() * 4) | 0];
  G.chips.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, r: 1.6 + Math.random() * 2, c });
}
function star(x, y) {
  const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.9 + Math.random() * 0.5, c: ['#ffe066', '#7fe0d3', '#ff9fbf', '#ffffff'][(Math.random() * 4) | 0], k: 'star' };
}
function drop(x, y) { G.parts.push({ x: x + (Math.random() - 0.5) * 40, y: y - 30 - Math.random() * 20, vx: 0, vy: 140, t: 0, life: 0.35, c: '#bfe9ff', k: 'drop' }); }
// けずる どうぐ（タービン・エンジン）の きょうつう。target を けずり、げんきな はだけを さわったら いたい
function cutter(dt, target, rate) {
  let near = false;
  eachCell(P.x, P.y, 15, (i, cx, cy) => {
    if (target(i)) {
      near = true; hp[i] -= dt * rate;
      if (hp[i] <= 0) { hp[i] = 1; cell[i] = (cell[i] === DEC && soft[i]) ? SOFT : HOLE; if (Math.random() < 0.45) addChip(cx, cy); }
    } else if (cell[i] === HOLE || cell[i] === SOFT || cell[i] === DEC) near = true;
  });
  const c = cell[cellAt(P.x, P.y)];
  G.badT = (c === EN && !near) ? G.badT + dt : 0;
  if (G.badT > 0.35) { G.badT = 0; mistake('いたっ！ そこは げんきな は'); }
}
function stroke(r, fn) {
  const n = Math.max(1, Math.ceil(Math.hypot(P.x - P.fx0, P.y - P.fy0) / 6)), seen = new Set();
  for (let s = 1; s <= n; s++) eachCell(lerp(P.fx0, P.x, s / n), lerp(P.fy0, P.y, s / n), r, (i, cx, cy) => { if (!seen.has(i)) { seen.add(i); fn(i, cx, cy); } });
}
function update(dt) {
  G.t += dt; G.hintT += dt; G.ouchT = Math.max(0, G.ouchT - dt); G.fade = Math.max(0, G.fade - dt * 2.2);
  const fd = P.down ? Math.hypot(P.x - P.fx, P.y - P.fy) : 0; P.fx0 = P.fx; P.fy0 = P.fy; P.fx = P.x; P.fy = P.y;
  const jd = P.justDown; P.justDown = false;
  const L = { drill: 0, engine: 0, vac: 0, hum: 0, brush: 0, scrape: 0, air: 0 };
  const onT = Math.hypot(P.x - TB.cx, P.y - TB.cy) < TB.s * 0.95;
  if (!G.done && G.fade < 0.5) {
    const k = G.key;
    if (k === 'topical' && P.down && Math.hypot(P.x - SD.rub.x, P.y - SD.rub.y) < SD.rub.r + 10) {
      G.holdT += fd / 160; if (G.holdT >= 1) stepDone();
    }
    if (k === 'extract') {
      const E = G.ext;
      if (jd) { E.grip = Math.abs(P.sx - SD.px) < 40 && P.sy > SD.gum - 120 && P.sy < SD.gum + 24; if (E.grip) SFX.grip(); }
      if (!P.down) E.grip = false;
      if (E.grip && G.phase === 0) {
        const target = clamp((P.x - P.sx) / 140, -0.28, 0.28);
        E.ang += (target - E.ang) * Math.min(1, dt * 12);
        const dx = Math.abs(P.x - P.fx0);
        if (dx > 22) { G.badT += dt; if (G.badT > 0.3) { G.badT = 0; pop(P.x, P.y - 34, 'ゆっくり ゆらそう', '#ffe066'); } }
        else E.wig += dx / 350;
        if (P.sy - P.y > 30 && E.wig < 1) { G.badT += dt; if (G.badT > 0.4) { G.badT = 0; pop(P.x, P.y - 34, 'まだ ぬけないよ。よこに ゆらそう', '#ffe066'); } }
        if (E.wig >= 1) { E.ang = 0; nextPhase(); }
      } else if (G.phase === 0) E.ang *= Math.pow(0.02, dt);
      if (G.phase === 1) {
        if (jd) { E.grip = Math.abs(P.sx - SD.px) < 40 && P.sy > SD.gum - 120 && P.sy < SD.gum + 24; if (E.grip) SFX.grip(); }
        E.lift = E.grip ? clamp(P.sy - P.y, 0, 110) : E.lift * Math.pow(0.05, dt);
        if (E.lift > 80) { E.out = true; E.outT = 0; SFX.out(); pop(SD.px + 60, SD.gum - 120, 'ぬけた！', '#ffe066'); stepDone(); }
      }
    }
    if (k === 'gauze') {
      if (P.down && Math.hypot(P.x - SD.sock.x, P.y - SD.sock.y) < 40) G.holdT += dt;
      if (G.holdT >= 3) { G.ext.gauze = true; stepDone(); }
    }
    if (k === 'masui') {
      const inGum = Math.hypot(P.x - GUM.x, P.y - GUM.y) < GUM.r + 10;
      if (G.phase === 0) {
        if (P.down && inGum) { G.holdT += fd / 160; if (Math.random() < fd * 0.05) G.parts.push(star(P.x, P.y)); }
        if (G.holdT >= 1) nextPhase();
      } else {
        if (P.down && inGum) {
          if (fd > 2.5) { G.badT += dt; if (G.badT > 0.25) { G.badT = 0; pop(P.x, P.y - 34, 'ゆっくり うごかさないでね', '#ffe066'); } }
          else G.holdT += dt;
        }
        if (G.holdT >= 3) { pop(GUM.x + 70, GUM.y - 40, 'ねむくなったよ', '#ffffff'); stepDone(); }
      }
    }
    if (k === 'wattes') {
      if (jd) { const r = rollAt(P.rsx, P.rsy); if (r) { G.grab = r; r.slot = null; r.ox = r.x - P.rsx; r.oy = r.y - P.rsy; } }
      if (G.grab && P.down) { G.grab.x = P.rx + G.grab.ox; G.grab.y = P.ry + G.grab.oy; }
    }
    if (k === 'drill' && P.down && onTooth(P.x, P.y)) {
      L.drill = 0.05; L.vac = 0.04;
      cutter(dt, i => cell[i] === DEC, 6);
      if (count(DEC) / cnt.dec0 < 0.05) { for (let i = 0; i < NN; i++) if (cell[i] === DEC) cell[i] = soft[i] ? SOFT : HOLE; stepDone(); }
    }
    if (k === 'detect' && P.down) {
      stroke(15, i => { if (cell[i] === HOLE || cell[i] === SOFT) dyed[i] = 1; });
      const tot = countIf(i => cell[i] === HOLE || cell[i] === SOFT);
      if (countIf(i => (cell[i] === HOLE || cell[i] === SOFT) && !dyed[i]) / Math.max(1, tot) < 0.05) { for (let i = 0; i < NN; i++) if (cell[i] === HOLE || cell[i] === SOFT) dyed[i] = 1; stepDone(); }
    }
    if (k === 'excavate' && P.down && onTooth(P.x, P.y)) {
      L.engine = 0.06;
      cutter(dt, i => cell[i] === SOFT, 4);
      if (count(SOFT) <= 2) { for (let i = 0; i < NN; i++) if (cell[i] === SOFT) cell[i] = HOLE; stepDone(); }
    }
    if (k === 'rinse') {
      if (P.down) {
        L.vac = 0.1;
        for (const c of G.chips) {
          const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy);
          if (d < 70) { const f = (70 - d) * 9; c.vx += dx / (d + 1) * f * dt * 6; c.vy += dy / (d + 1) * f * dt * 6; }
          if (d < 12) c.dead = true;
        }
        if (Math.random() < dt * 20) drop(P.x, P.y);
      }
      const before = G.chips.length; G.chips = G.chips.filter(c => !c.dead);
      if (G.chips.length < before && Math.random() < 0.5) tone(1200 + Math.random() * 400, 0.05, 'sine', 0.05);
      if (G.chips.length === 0) { dyed.fill(0); stepDone(); }   // あかい くすりも あらいながす
    }
    if (k === 'bond') {
      if (G.phase === 0) {
        if (P.down) stroke(14, i => { if (cell[i] === HOLE) bonded[i] = 1; });
        const tot = count(HOLE);
        if (countIf(i => cell[i] === HOLE && !bonded[i]) / Math.max(1, tot) < 0.05) { for (let i = 0; i < NN; i++) if (cell[i] === HOLE) bonded[i] = 1; nextPhase(); }
      } else {
        if (P.down && onT) { L.hum = 0.04; G.holdT += dt; }
        if (G.holdT >= 2) stepDone();
      }
    }
    if (k === 'fill' && P.down) {
      stroke(16, i => { if (cell[i] === HOLE) cell[i] = RES; });
      if (count(HOLE) / Math.max(1, count(HOLE) + count(RES)) < 0.04) { for (let i = 0; i < NN; i++) if (cell[i] === HOLE) cell[i] = RES; stepDone(); }
    }
    if (k === 'cure') {
      if (P.down && onT) { L.hum = 0.04; G.holdT += dt; }
      if (G.holdT >= 3) { for (let i = 0; i < NN; i++) { if (cell[i] === RES) cell[i] = CUR; if (cell[i] === SEAL) cell[i] = SEALC; } stepDone(); }
    }
    if (k === 'bite' && G.phase === 1 && P.down && onTooth(P.x, P.y)) {
      L.drill = 0.03;
      eachCell(P.x, P.y, 14, i => { if (high[i] > 0) high[i] -= dt * 3; });
      if (countIf(i => high[i] > 0) === 0) stepDone();
    }
    if (k === 'polish' && P.down && onTooth(P.x, P.y)) {
      G.shine = Math.min(1, G.shine + fd / 1100); L.engine = fd > 0.5 ? 0.04 : 0;
      if (Math.random() < fd * 0.02) G.parts.push(star(P.x, P.y));
      if (G.shine >= 1) stepDone();
    }
    if (k === 'clean' && P.down) {
      L.brush = Math.min(0.12, fd * 0.012);
      stroke(18, i => { if (cell[i] === DEB) { hp[i] -= fd * 0.03; if (hp[i] <= 0) { hp[i] = 1; cell[i] = GRV; } } });
      if (count(DEB) / cnt.deb0 < 0.04) { for (let i = 0; i < NN; i++) if (cell[i] === DEB) cell[i] = GRV; stepDone(); }
    }
    if (k === 'etch' && P.down) {
      stroke(15, i => { if (zone[i]) gel[i] = 1; });
      if (countIf(i => zone[i] && !gel[i]) / cnt.zone0 < 0.05) { for (let i = 0; i < NN; i++) if (zone[i]) gel[i] = 1; stepDone(); }
    }
    if (k === 'wash' && P.down) {
      L.vac = 0.08; if (Math.random() < dt * 25) drop(P.x, P.y);
      stroke(24, i => { if (gel[i]) { hp[i] -= fd * 0.08 + dt * 1.6; if (hp[i] <= 0) { hp[i] = 1; gel[i] = 0; } } });
      if (countIf(i => gel[i]) / cnt.zone0 < 0.08) { gel.fill(0); stepDone(); }
    }
    if (k === 'dry') {
      if (P.down && onT) { L.air = 0.08; G.holdT += dt; }
      if (G.holdT >= 2.5) { for (let i = 0; i < NN; i++) if (zone[i]) etched[i] = 1; stepDone(); }
    }
    if (k === 'seal' && P.down) {
      stroke(12, i => { if (cell[i] === GRV) cell[i] = SEAL; });
      if (count(GRV) / cnt.grv0 < 0.06) { for (let i = 0; i < NN; i++) if (cell[i] === GRV) cell[i] = SEAL; stepDone(); }
    }
    if (k === 'dye' && P.down && fd > 0) {
      for (const t of teethNear(P.x, P.y, 6)) t.dyed = Math.min(1, t.dyed + fd / 110);
      if (G.teeth.every(t => t.dyed >= 0.95)) { G.teeth.forEach(t => t.dyed = 1); stepDone(); }
    }
    if (k === 'brush' && P.down && fd > 0) {
      L.brush = Math.min(0.12, fd * 0.012);
      for (const t of teethNear(P.x, P.y, 8)) t.plaque = Math.max(0, t.plaque - fd / 420);
      if (Math.random() < fd * 0.05) G.parts.push({ x: P.x + (Math.random() - 0.5) * 20, y: P.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -30, t: 0, life: 0.7, c: '#ffffff', k: 'bubble' });
      const tot = G.teeth.reduce((a, t) => a + t.plaque, 0);
      if (tot / G.teeth.length < 0.04) { G.teeth.forEach(t => t.plaque = 0); stepDone(); }
    }
    if (k === 'scale' && P.down && fd > 0) {
      let hit = false;
      for (const t of G.teeth) for (const b of t.tartar) {
        if (b.hp <= 0) continue;
        const w = toWorld(t, b.lx, b.ly);
        if (Math.hypot(w.x - P.x, w.y - P.y) < b.r + 12) {
          b.hp -= fd / 160; hit = true;
          if (Math.random() < fd * 0.06) G.parts.push({ x: w.x, y: w.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0, life: 0.5, c: '#e8cf7a', k: 'chip' });
        }
      }
      L.scrape = hit ? 0.07 : 0;
      if (G.teeth.every(t => t.tartar.every(b => b.hp <= 0))) stepDone();
    }
    if (k === 'pmtc' && P.down && fd > 0) {
      L.engine = 0.05;
      for (const t of teethNear(P.x, P.y, 6)) t.gloss = Math.min(1, t.gloss + fd / 100);
      if (Math.random() < fd * 0.03) G.parts.push(star(P.x, P.y));
      if (G.teeth.every(t => t.gloss >= 0.95)) { G.teeth.forEach(t => t.gloss = 1); stepDone(); }
    }
    if (k === 'fluor' && P.down && fd > 0) {
      for (const t of teethNear(P.x, P.y, 6)) t.fluor = Math.min(1, t.fluor + fd / 90);
      if (Math.random() < fd * 0.04) G.parts.push(star(P.x, P.y));
      if (G.teeth.every(t => t.fluor >= 0.95)) { G.teeth.forEach(t => t.fluor = 1); stepDone(); }
    }
  }
  if (G.ext && G.ext.out) G.ext.outT = Math.min(0.6, G.ext.outT + dt);
  for (const n in L) loop(n, L[n]);
  bgmDuck(L.drill + L.engine + L.vac + L.brush + L.scrape + L.air > 0.02);
  // ぬる・こする たびに「ちゅっ」、4ぶんの1 すすむごとに あがる おと、まつ あいだは 1びょうごとに「ピッ」
  if (!G.done) {
    const pr = progress(), q = Math.floor(pr * 4);
    if (pr > (G.lastPr || 0) + 0.004 && G.t - (G.chuT || 0) > 0.11 && !['cure', 'dry', 'gauze', 'masui', 'bond', 'extract'].includes(G.key)) { G.chuT = G.t; SFX.chu(); }
    if (q > (G.lastQ || 0) && q < 4) SFX.tick(q - 1);
    G.lastPr = pr; G.lastQ = q;
    const sec = Math.floor(G.holdT);
    if (['cure', 'dry', 'gauze'].includes(G.key) || (G.key === 'masui' && G.phase === 1) || (G.key === 'bond' && G.phase === 1)) { if (sec > (G.lastSec || 0)) SFX.pi(); }
    G.lastSec = sec;
  }
  for (const c of G.chips) { c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= Math.pow(0.02, dt); c.vy *= Math.pow(0.02, dt); }
  for (const q of G.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'star' || q.k === 'chip') q.vy += 260 * dt; }
  G.parts = G.parts.filter(q => q.t < q.life);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter(q => q.t < 1.3);
  if (G.flash) { G.flash.t += dt; if (G.flash.t > 1.2) G.flash = null; }
  if (G.done) { G.doneT += dt; if (G.doneT > 1.25) nextStep(); }
  const pr = Math.round(progress() * 100) + '%'; if (pr !== G.barW) { G.barW = pr; $('#barIn').style.width = pr; }
}
function progress() {
  if (G.done) return 1;
  const ph = (a, b) => G.phase ? 0.5 + clamp(b, 0, 1) * 0.5 : clamp(a, 0, 1) * 0.5;
  switch (G.key) {
    case 'search': case 'find6': case 'xray': case 'find4': case 'xray4': return 0;
    case 'topical': return G.holdT;
    case 'extract': return G.phase ? 0.5 + 0.5 * clamp(G.ext.lift / 80, 0, 1) : 0.5 * clamp(G.ext.wig, 0, 1);
    case 'gauze': return G.holdT / 3;
    case 'masui': return ph(G.holdT, G.holdT / 3);
    case 'wattes': return G.wattes.filter(r => r.slot).length / 2;
    case 'drill': return 1 - count(DEC) / cnt.dec0;
    case 'detect': { const tot = countIf(i => cell[i] === HOLE || cell[i] === SOFT); return tot ? countIf(i => (cell[i] === HOLE || cell[i] === SOFT) && dyed[i]) / tot : 1; }
    case 'excavate': return 1 - count(SOFT) / cnt.soft0;
    case 'rinse': return 1 - G.chips.length / 24;
    case 'bond': { const tot = count(HOLE); return ph(tot ? countIf(i => cell[i] === HOLE && bonded[i]) / tot : 1, G.holdT / 2); }
    case 'fill': return count(RES) / Math.max(1, count(HOLE) + count(RES));
    case 'cure': return G.holdT / 3;
    case 'bite': return G.phase ? 0.3 + 0.7 * (1 - countIf(i => high[i] > 0) / (cnt.high0 || 1)) : 0;
    case 'polish': return G.shine;
    case 'clean': return 1 - count(DEB) / cnt.deb0;
    case 'etch': return 1 - countIf(i => zone[i] && !gel[i]) / cnt.zone0;
    case 'wash': return 1 - countIf(i => gel[i]) / cnt.zone0;
    case 'dry': return G.holdT / 2.5;
    case 'seal': return 1 - count(GRV) / cnt.grv0;
    case 'dye': return G.teeth.reduce((a, t) => a + t.dyed, 0) / G.teeth.length;
    case 'brush': { const p0 = G.teeth.length * 0.75; return clamp(1 - G.teeth.reduce((a, t) => a + t.plaque, 0) / p0, 0, 1); }
    case 'scale': { let a = 0, n = 0; G.teeth.forEach(t => t.tartar.forEach(b => { n++; a += clamp(b.hp, 0, 1); })); return n ? 1 - a / n : 1; }
    case 'pmtc': return G.teeth.reduce((a, t) => a + t.gloss, 0) / G.teeth.length;
    case 'fluor': return G.teeth.reduce((a, t) => a + t.fluor, 0) / G.teeth.length;
  }
  return 0;
}

// ---------- えがく ----------
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function text(c, s, x, y, size, color, align, stroke) {
  c.font = '800 ' + size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = size * 0.28; c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = color; c.fillText(s, x, y);
}
function hint(s) { text(ctx, s, 180, H - 22, 13, '#ffffff', 'center', 'rgba(60,10,20,.85)'); }
function draw() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save(); rr(ctx, 0, TOP, W, H - TOP, 0); ctx.clip();
  const v = G.step.view;
  if (v === 'arch') drawArch(); else if (v === 'xray') drawXray(); else if (v === 'side') drawSide(); else drawCloseup();
  drawParts();
  ctx.restore();
  drawHeader();
  if (P.down && P.off && !G.done && !['search', 'find6', 'xray', 'wattes', 'find4', 'xray4'].includes(G.key)) {
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y, 15, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  drawTool();
  if (CTRL.used && !G.done) {
    ctx.save(); ctx.strokeStyle = 'rgba(40,20,30,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(CTRL.cx, CTRL.cy, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = CTRL.a ? '#ffe066' : '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(CTRL.cx, CTRL.cy, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CTRL.cx - 16, CTRL.cy); ctx.lineTo(CTRL.cx - 6, CTRL.cy); ctx.moveTo(CTRL.cx + 6, CTRL.cy); ctx.lineTo(CTRL.cx + 16, CTRL.cy);
    ctx.moveTo(CTRL.cx, CTRL.cy - 16); ctx.lineTo(CTRL.cx, CTRL.cy - 6); ctx.moveTo(CTRL.cx, CTRL.cy + 6); ctx.lineTo(CTRL.cx, CTRL.cy + 16); ctx.stroke(); ctx.restore();
  }
  for (const q of G.pops) { const a = 1 - Math.max(0, q.t - 0.8) / 0.5; ctx.globalAlpha = a; text(ctx, q.text, clamp(q.x, 100, W - 100), q.y - q.t * 24, 16, q.c, 'center', 'rgba(40,20,30,.85)'); ctx.globalAlpha = 1; }
  if (G.flash) {
    const t = G.flash.t, s = t < 0.2 ? lerp(0.4, 1.15, t / 0.2) : t < 0.3 ? lerp(1.15, 1, (t - 0.2) / 0.1) : 1;
    ctx.save(); ctx.globalAlpha = t > 0.9 ? 1 - (t - 0.9) / 0.3 : 1; ctx.translate(180, 300); ctx.scale(s, s);
    text(ctx, G.flash.text, 0, 0, 46, '#ffe066', 'center', '#d0466e'); ctx.restore(); ctx.globalAlpha = 1;
  }
  if (G.fade > 0) { ctx.fillStyle = 'rgba(255,255,255,' + G.fade + ')'; ctx.fillRect(0, TOP, W, H - TOP); }
}
function drawHeader() {
  ctx.fillStyle = '#fff7ee'; rr(ctx, 0, 0, W, TOP - 4, 22); ctx.fill();
  const scary = (G.key === 'drill' || G.key === 'excavate' || G.key === 'extract' || (G.key === 'masui' && G.phase === 1)) && P.down;
  const mood = G.ouchT > 0 ? 'ouch' : G.done && G.si === G.p.steps.length - 1 ? 'happy' : scary ? 'nervous' : G.key === 'xray' ? 'smile' : 'open';
  ctx.save(); ctx.beginPath(); ctx.arc(46, 44, 36, 0, Math.PI * 2); ctx.fillStyle = '#ffe8d2'; ctx.fill(); ctx.clip();
  drawFace(ctx, 46, 48, 32, G.p, mood); ctx.restore();
  text(ctx, G.p.name + G.p.hon + '（' + G.p.age + 'さい）', 92, 22, 16, '#2b3a4a', 'left');
  const n = G.p.steps.length, gap = Math.min(24, 168 / (n - 1)), rad = Math.min(8, gap * 0.36);
  ctx.fillStyle = '#dbe7ea'; ctx.fillRect(100, 46.5, gap * (n - 1), 3);
  for (let i = 0; i < n; i++) {
    const x = 100 + i * gap, y = 48;
    ctx.beginPath(); ctx.arc(x, y, i === G.si ? rad + 2 : rad, 0, Math.PI * 2);
    ctx.fillStyle = i < G.si || (i === G.si && G.done) ? '#3cc4b4' : i === G.si ? '#ffc94a' : '#dbe7ea'; ctx.fill();
  }
  text(ctx, (G.si + 1) + ' / ' + n + '　' + G.step.label, 92, 72, 12, '#5d6f80', 'left');
  text(ctx, 'やさしさ', 318, 22, 11, '#5d6f80');
  const s = stars();
  for (let i = 0; i < 3; i++) drawHeart(ctx, 294 + i * 24, 48, 9, i < s ? '#ff7aa2' : '#e3d6dc');
}
function drawHeart(c, x, y, r, col) {
  c.beginPath(); c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  c.fillStyle = col; c.fill();
}

// かお
function drawFace(c, x, y, r, p, mood) {
  c.save();
  if (p.style === 'girl') { c.fillStyle = p.hair; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 1.02, y + r * 0.05, r * 0.38, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = p.skin; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.hair; c.beginPath();
  c.arc(x, y - r * 0.05, r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
  if (p.style === 'boy2') { c.lineTo(x + r * 0.7, y - r * 0.45); c.lineTo(x + r * 0.35, y - r * 0.6); c.lineTo(x, y - r * 0.38); c.lineTo(x - r * 0.4, y - r * 0.58); c.lineTo(x - r * 0.75, y - r * 0.4); }
  else { c.quadraticCurveTo(x + r * 0.5, y - r * 0.75, x, y - r * 0.5); c.quadraticCurveTo(x - r * 0.5, y - r * 0.8, x - r * 1.0, y - r * 0.15); }
  c.closePath(); c.fill();
  if (p.style === 'girl') { c.fillStyle = '#ff7aa2'; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.8, y - r * 0.55, r * 0.17, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = 'rgba(255,120,140,.35)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * r * 0.55, y + r * 0.25, r * 0.18, r * 0.11, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#2b2b33'; c.fillStyle = '#2b2b33'; c.lineWidth = Math.max(1.5, r * 0.07); c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = x + s * r * 0.35, ey = y - r * 0.02;
    if (mood === 'ouch') { c.beginPath(); c.moveTo(ex - s * r * 0.12, ey - r * 0.1); c.lineTo(ex + s * r * 0.08, ey); c.lineTo(ex - s * r * 0.12, ey + r * 0.1); c.stroke(); }
    else if (mood === 'happy') { c.beginPath(); c.arc(ex, ey + r * 0.04, r * 0.11, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else { c.beginPath(); c.arc(ex, ey, r * 0.09, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + r * 0.03, ey - r * 0.03, r * 0.03, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2b2b33'; }
  }
  const my = y + r * 0.45;
  if (mood === 'open') { c.fillStyle = '#9b2b3a'; c.beginPath(); c.ellipse(x, my, r * 0.24, r * 0.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ff8a95'; c.beginPath(); c.ellipse(x, my + r * 0.09, r * 0.14, r * 0.07, 0, 0, Math.PI * 2); c.fill(); }
  else if (mood === 'happy') { c.fillStyle = '#9b2b3a'; c.beginPath(); c.arc(x, my - r * 0.06, r * 0.26, 0, Math.PI); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - r * 0.18, my - r * 0.06, r * 0.36, r * 0.07); }
  else if (mood === 'ouch') { c.fillStyle = '#9b2b3a'; c.beginPath(); c.ellipse(x, my, r * 0.12, r * 0.15, 0, 0, Math.PI * 2); c.fill(); }
  else if (mood === 'nervous') { c.beginPath(); c.moveTo(x - r * 0.2, my); for (let i = 1; i <= 4; i++) c.lineTo(x - r * 0.2 + i * r * 0.1, my + (i % 2 ? -1 : 1) * r * 0.05); c.stroke(); c.fillStyle = '#7fd0ff'; c.beginPath(); c.ellipse(x + r * 0.75, y - r * 0.35, r * 0.08, r * 0.13, 0, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); c.arc(x, my - r * 0.1, r * 0.2, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
  c.restore();
}

// くちの なか全体
function drawArch() {
  const A = G.arch.A, k = G.arch.k;
  ctx.fillStyle = '#5c1d2a'; ctx.fillRect(0, TOP, W, H - TOP);
  ctx.strokeStyle = '#e88a95'; ctx.lineWidth = 16; rr(ctx, 8, TOP + 8, W - 16, H - TOP - 16, 40); ctx.stroke();
  ctx.strokeStyle = '#f6b2ba'; ctx.lineWidth = 4; rr(ctx, 14, TOP + 14, W - 28, H - TOP - 28, 36); ctx.stroke();
  const g = ctx.createRadialGradient(A.cx, A.cy + 40, 10, A.cx, A.cy + 40, A.ry * 0.8);
  g.addColorStop(0, '#f58b97'); g.addColorStop(1, '#d55e6d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(A.cx, A.cy + 20, A.rx - 40, A.ry - 60, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(160,50,70,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A.cx, A.cy - 60); ctx.lineTo(A.cx, A.cy + 90); ctx.stroke();
  ctx.strokeStyle = '#f29aa6'; ctx.lineCap = 'round'; ctx.lineWidth = 14 * k;
  ctx.beginPath(); ctx.ellipse(A.cx, A.cy, A.rx, A.ry, 0, G.arch.thMin, G.arch.thMax); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(A.cx, A.cy, A.rx + 5 * k, A.ry + 5 * k, 0, G.arch.thMin + 0.05, G.arch.thMax - 0.05); ctx.stroke();
  for (const t of G.teeth) drawArchTooth(t);
  for (const t of G.teeth) for (const b of t.tartar) {
    if (b.hp <= 0) continue;
    const w = toWorld(t, b.lx, b.ly);
    ctx.globalAlpha = clamp(b.hp * 1.3, 0, 1);
    ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(w.x, w.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#efd683'; ctx.beginPath(); ctx.arc(w.x - b.r * 0.3, w.y - b.r * 0.3, b.r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8902e'; ctx.beginPath(); ctx.arc(w.x + b.r * 0.35, w.y + b.r * 0.2, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if ((G.key === 'search' || G.key === 'find6') && G.hintT > 12 && !G.done) {
    for (const t of G.teeth) if ((G.key === 'search' && t.cavity) || (G.key === 'find6' && t.type === 'M6')) {
      ctx.strokeStyle = 'rgba(255,224,102,' + (0.5 + 0.5 * Math.sin(G.t * 6)) + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.hitR + 6, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (G.key === 'search' && !G.done) {
    const lx = (P.down || P.hover) ? P.x : 180 + Math.sin(G.t * 0.8) * 60, ly = (P.down || P.hover) ? P.y : 330 + Math.cos(G.t * 0.6) * 60;
    const lg = ctx.createRadialGradient(lx, ly, 30, lx, ly, 95);
    lg.addColorStop(0, 'rgba(10,0,5,0)'); lg.addColorStop(1, 'rgba(10,0,5,.86)');
    ctx.fillStyle = lg; ctx.fillRect(0, TOP, W, H - TOP);
  }
  if (G.key === 'scale' && !G.done) hint('したの まえばの うらがわ（したの がわ）に あるよ');
  if (G.key === 'fluor' && G.done) hint('30ぷんは のんだり たべたり しないでね');
}
function drawArchTooth(t) {
  if (t.loose) {   // うしろ（したがわ）に はえてきた おとなの は
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang); ctx.translate(0, -t.d * 0.95);
    ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#d6c9ad'; ctx.lineWidth = 1.5;
    rr(ctx, -t.w * 0.62, -t.d * 0.4, t.w * 1.24, t.d * 0.8, t.d * 0.3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang + (t.loose && G.key === 'find4' ? Math.sin(G.t * 5) * 0.06 : 0));
  const w = t.w, d = t.d, rad = Math.min(w, d) * (t.molar ? 0.32 : t.type === 'C' ? 0.48 : 0.4);
  const g = ctx.createLinearGradient(-w / 2, -d / 2, w / 2, d / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ece3cf');
  ctx.fillStyle = g; ctx.strokeStyle = '#d6c9ad'; ctx.lineWidth = 1.5;
  rr(ctx, -w / 2, -d / 2, w, d, rad); ctx.fill(); ctx.stroke();
  if (t.molar) {
    ctx.strokeStyle = '#cdbd99'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(-w * 0.3, 0); ctx.lineTo(w * 0.3, 0); ctx.moveTo(-w * 0.08, 0); ctx.lineTo(-w * 0.14, -d * 0.3); ctx.moveTo(w * 0.1, 0); ctx.lineTo(w * 0.16, d * 0.3); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(205,189,153,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(w * 0.3, 0); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -d * 0.18, w * 0.12, d * 0.08, -0.4, 0, Math.PI * 2); ctx.fill();
  if (t.plaque > 0.01) for (const b of t.blobs) {
    const a = t.plaque;
    if (t.dyed < 1) { ctx.fillStyle = 'rgba(255,255,235,' + (0.35 * a * (1 - t.dyed)) + ')'; ctx.beginPath(); ctx.arc(b.lx, b.ly, b.r, 0, Math.PI * 2); ctx.fill(); }
    if (t.dyed > 0) { ctx.fillStyle = 'rgba(225,30,90,' + (0.85 * a * t.dyed) + ')'; ctx.beginPath(); ctx.arc(b.lx, b.ly, b.r, 0, Math.PI * 2); ctx.fill(); }
  }
  if (t.dyed > 0 && t.plaque > 0.01) { ctx.fillStyle = 'rgba(255,140,170,' + 0.12 * t.dyed + ')'; rr(ctx, -w / 2, -d / 2, w, d, rad); ctx.fill(); }
  if (t.cavity) {
    ctx.fillStyle = '#4a2c18'; ctx.beginPath(); ctx.ellipse(w * 0.08, -d * 0.02, w * 0.17, d * 0.15, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e120a'; ctx.beginPath(); ctx.ellipse(w * 0.09, -d * 0.02, w * 0.08, d * 0.07, 0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (t.erupt) {
    ctx.fillStyle = 'rgba(242,154,166,.92)'; ctx.beginPath();
    ctx.ellipse(t.side * w * 0.42, 0, w * 0.32, d * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (t.gloss > 0) { ctx.fillStyle = 'rgba(255,255,255,' + 0.5 * t.gloss + ')'; ctx.beginPath(); ctx.ellipse(-w * 0.12, -d * 0.12, w * 0.22, d * 0.13, -0.4, 0, Math.PI * 2); ctx.fill(); }
  if (t.fluor > 0) {
    ctx.strokeStyle = 'rgba(160,230,255,' + 0.9 * t.fluor + ')'; ctx.lineWidth = 2.5;
    rr(ctx, -w / 2 + 1, -d / 2 + 1, w - 2, d - 2, rad); ctx.stroke();
  }
  if (t.fluor >= 1 || t.gloss >= 1) { const v = Math.sin(G.t * 1.2 + t.x * 0.7); if (v > 0.4) { ctx.globalAlpha = (v - 0.4) / 0.6; drawSpark(ctx, w * 0.2, -d * 0.2, 6, '#ffffff'); ctx.globalAlpha = 1; } }
  ctx.restore();
}
function drawSpark(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); c.fill();
}

// レントゲン（よこから みた こどもの おくば 2ほん）
function molarSidePath(c, x, w, top, cej, apex, inset) {
  const i = inset || 0, hw = w / 2 - i, t = top + i * 1.1;
  c.beginPath();
  c.moveTo(x - hw, cej);
  c.bezierCurveTo(x - hw - 4, cej - 30, x - hw, t + 14, x - hw * 0.7, t + 4);
  c.quadraticCurveTo(x - hw * 0.4, t - 6, x - hw * 0.1, t + 8);
  c.quadraticCurveTo(x + hw * 0.25, t - 6, x + hw * 0.7, t + 4);
  c.bezierCurveTo(x + hw, t + 14, x + hw + 4, cej - 30, x + hw, cej);
  if (apex) {
    // ねっこ（こどもの おくばは ねっこが ひらいて、したに おとなの はが そだつ）
    c.quadraticCurveTo(x + hw + 6, (cej + apex) / 2, x + hw + 6 - i, apex);
    c.quadraticCurveTo(x + hw * 0.3, apex - 40, x + hw * 0.15, cej + 34);
    c.quadraticCurveTo(x, cej + 22, x - hw * 0.15, cej + 34);
    c.quadraticCurveTo(x - hw * 0.3, apex - 40, x - hw - 6 + i, apex);
    c.quadraticCurveTo(x - hw - 6, (cej + apex) / 2, x - hw, cej);
  }
  c.closePath();
}
function drawXray() {
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, TOP, W, H - TOP);
  const bg = ctx.createLinearGradient(0, XR.cej - 10, 0, H);
  bg.addColorStop(0, 'rgba(120,128,136,0)'); bg.addColorStop(0.1, 'rgba(120,128,136,.55)'); bg.addColorStop(1, 'rgba(90,96,104,.6)');
  ctx.fillStyle = bg; ctx.fillRect(10, XR.cej + 6, W - 20, H - XR.cej);
  const R = rng(9); ctx.fillStyle = 'rgba(20,24,28,.35)';
  for (let n = 0; n < 160; n++) { ctx.beginPath(); ctx.arc(10 + R() * (W - 20), XR.cej + 20 + R() * 260, 1 + R() * 3, 0, Math.PI * 2); ctx.fill(); }
  for (const T of [XR.D, XR.E]) {
    ctx.fillStyle = '#1a1e23'; ctx.beginPath(); ctx.arc(T.x, 466, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9cfd4'; ctx.beginPath(); ctx.ellipse(T.x, 458, 22, 14, 0, Math.PI, 0); ctx.lineTo(T.x + 22, 464); ctx.lineTo(T.x - 22, 464); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aab2b9'; molarSidePath(ctx, T.x, T.w, XR.top, XR.cej, XR.apex); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, XR.cej - 6); ctx.clip();
    ctx.fillStyle = '#e9edf0'; molarSidePath(ctx, T.x, T.w, XR.top, XR.cej, 0); ctx.fill();
    ctx.fillStyle = '#b6bec5'; molarSidePath(ctx, T.x, T.w, XR.top, XR.cej + 10, 0, 9); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3c4249'; ctx.beginPath();
    const pw = T.w * 0.22;
    ctx.moveTo(T.x - pw, XR.cej + 12); ctx.lineTo(T.x - pw, XR.top + 50); ctx.quadraticCurveTo(T.x - pw * 0.8, XR.top + 34, T.x - pw * 0.5, XR.top + 50);
    ctx.lineTo(T.x + pw * 0.5, XR.top + 50); ctx.quadraticCurveTo(T.x + pw * 0.8, XR.top + 34, T.x + pw, XR.top + 50); ctx.lineTo(T.x + pw, XR.cej + 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3c4249'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(T.x - pw * 0.7, XR.cej + 10); ctx.quadraticCurveTo(T.x - T.w * 0.45, XR.apex - 60, T.x - T.w / 2 - 2, XR.apex - 6);
    ctx.moveTo(T.x + pw * 0.7, XR.cej + 10); ctx.quadraticCurveTo(T.x + T.w * 0.45, XR.apex - 60, T.x + T.w / 2 + 2, XR.apex - 6); ctx.stroke();
  }
  const c = XR.cav, cg = ctx.createRadialGradient(c.x, c.y - 8, 2, c.x, c.y, c.ry);
  cg.addColorStop(0, 'rgba(8,10,12,.95)'); cg.addColorStop(0.7, 'rgba(20,24,28,.85)'); cg.addColorStop(1, 'rgba(40,44,50,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx, c.ry, 0.25, 0, Math.PI * 2); ctx.fill();
  if (G.hintT > 12 && !G.done) { ctx.strokeStyle = 'rgba(255,224,102,' + (0.5 + 0.5 * Math.sin(G.t * 6)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx + 10, c.ry + 10, 0.25, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 0.85;
  text(ctx, 'エナメルしつ（いちばん しろい）', 120, XR.top - 26, 11, '#e9edf0', 'center');
  text(ctx, 'しずい', XR.D.x, XR.cej - 14, 10, '#e9edf0', 'center', 'rgba(0,0,0,.6)');
  text(ctx, 'おとなの はの たまご', 180, 518, 11, '#cfd5da', 'center');
  ctx.globalAlpha = 1;
  if (G.done) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx + 8, c.ry + 8, 0.25, 0, Math.PI * 2); ctx.stroke(); }
  text(ctx, 'レントゲン', 310, TOP + 18, 11, '#7f8a94', 'center');
}

// よこから みた したの まえば（だんめんず）。こどもの はの うしろ（したがわ）に おとなの はが そだっている
const SD = { px: 150, gum: 300, qx: 212, qy: 345, piv: 330, sock: { x: 150, y: 302 }, rub: { x: 112, y: 318, r: 22 } };
function primPath(c) {   // ねもと(0,0)が きじゅんの こどもの まえば。ねっこは とけて みじかい
  c.beginPath(); c.moveTo(-17, 0);
  c.bezierCurveTo(-19, -30, -10, -70, -5, -84); c.lineTo(4, -82);
  c.bezierCurveTo(8, -60, 20, -30, 17, 0);
  c.lineTo(11, 18); c.lineTo(6, 26); c.lineTo(2, 22); c.lineTo(-3, 30); c.lineTo(-8, 24); c.lineTo(-12, 16); c.closePath();
}
function permPath(c) {   // おとなの まえば（ねっこは まだ そだちかけ）
  c.beginPath(); c.moveTo(-21, 0);
  c.bezierCurveTo(-24, -40, -12, -88, -6, -104); c.lineTo(5, -102);
  c.bezierCurveTo(12, -76, 25, -36, 21, 0);
  c.lineTo(16, 70); c.lineTo(9, 92); c.lineTo(-9, 92); c.lineTo(-16, 70); c.closePath();
}
function drawSide() {
  const xr = G.key === 'xray4', E = G.ext;
  ctx.fillStyle = xr ? '#07090c' : '#5c1d2a'; ctx.fillRect(0, TOP, W, H - TOP);
  if (!xr) {
    ctx.fillStyle = '#e8838f'; ctx.beginPath(); ctx.ellipse(10, 270, 50, 110, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d55e6d'; ctx.beginPath(); ctx.ellipse(370, 250, 80, 120, 0, 0, Math.PI * 2); ctx.fill();
    text(ctx, 'くちびる', 34, 150, 11, '#ffe7ec', 'center', 'rgba(60,10,20,.7)');
    text(ctx, 'した', 328, 150, 11, '#ffe7ec', 'center', 'rgba(60,10,20,.7)');
  }
  // ほね
  ctx.fillStyle = xr ? 'rgba(110,118,126,.55)' : '#f0d3bf'; rr(ctx, 50, SD.gum + 4, 260, H - SD.gum, 30); ctx.fill();
  const R = rng(4); ctx.fillStyle = xr ? 'rgba(20,24,28,.35)' : 'rgba(200,150,130,.35)';
  for (let n = 0; n < 90; n++) { ctx.beginPath(); ctx.arc(60 + R() * 240, SD.gum + 20 + R() * 230, 1 + R() * 3, 0, Math.PI * 2); ctx.fill(); }
  // おとなの は
  ctx.save(); ctx.translate(SD.qx, SD.qy); ctx.rotate(-0.16);
  ctx.fillStyle = xr ? '#1a1e23' : 'rgba(200,120,120,.25)'; ctx.beginPath(); ctx.ellipse(0, 20, 34, 92, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = xr ? '#dfe4e8' : '#fffaf0'; permPath(ctx); ctx.fill();
  if (!xr) { ctx.strokeStyle = '#d6c9ad'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.fillStyle = xr ? '#4a5058' : 'rgba(240,150,150,.5)'; ctx.beginPath(); ctx.ellipse(0, 10, 6, 60, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // こどもの は（ぐらぐら）
  if (!E.out || E.outT < 0.6) {
    ctx.save();
    if (E.out) { const t = E.outT / 0.6; ctx.translate(lerp(SD.px, 300, t), lerp(SD.gum - E.lift, 140, t)); ctx.scale(1 - t * 0.5, 1 - t * 0.5); }
    else { ctx.translate(SD.px, SD.piv); ctx.rotate(G.key === 'extract' ? E.ang : 0); ctx.translate(0, SD.gum - SD.piv - E.lift); }
    ctx.fillStyle = xr ? '#e9edf0' : '#fffdf7'; primPath(ctx); ctx.fill();
    if (!xr) { ctx.strokeStyle = '#d6c9ad'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = xr ? '#4a5058' : 'rgba(240,150,150,.5)'; ctx.beginPath(); ctx.ellipse(0, -14, 4, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // はぐき
  if (!xr) {
    ctx.fillStyle = '#f29aa6'; ctx.beginPath(); ctx.moveTo(50, SD.gum + 30); ctx.lineTo(50, SD.gum - 2);
    ctx.quadraticCurveTo(SD.px - 30, SD.gum - 16, SD.px - 18, SD.gum - 2); ctx.lineTo(SD.px + 18, SD.gum - 2);
    ctx.quadraticCurveTo(SD.qx - 30, SD.gum - 8, SD.qx - 26, SD.gum - 10); ctx.lineTo(SD.qx + 24, SD.gum - 18);
    ctx.quadraticCurveTo(290, SD.gum - 18, 310, SD.gum + 4); ctx.lineTo(310, SD.gum + 30); ctx.closePath(); ctx.fill();
    if (E.out) { ctx.fillStyle = '#a3243a'; ctx.beginPath(); ctx.ellipse(SD.sock.x, SD.sock.y, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    if (E.gauze || (G.key === 'gauze' && P.down && !G.done)) {
      const gx = E.gauze ? SD.sock.x : P.x, gy = E.gauze ? SD.sock.y - 6 : P.y;
      ctx.fillStyle = '#ffffff'; rr(ctx, gx - 22, gy - 14, 44, 28, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,200,.7)'; ctx.lineWidth = 1;
      for (let i = -16; i <= 16; i += 8) { ctx.beginPath(); ctx.moveTo(gx + i, gy - 12); ctx.lineTo(gx + i, gy + 12); ctx.stroke(); }
    }
    text(ctx, 'よこから みた だんめん', 300, TOP + 18, 11, '#ffd5dc', 'center');
  } else {
    ctx.globalAlpha = 0.9;
    text(ctx, 'こどもの は', SD.px - 14, 196, 11, '#e9edf0', 'center');
    text(ctx, 'ほね', 84, 500, 11, '#cfd5da', 'center');
    text(ctx, 'レントゲン', 310, TOP + 18, 11, '#7f8a94', 'center');
    ctx.globalAlpha = 1;
    const ring = a => { ctx.strokeStyle = 'rgba(255,224,102,' + a + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(SD.qx, SD.qy, 44, 110, -0.16, 0, Math.PI * 2); ctx.stroke(); };
    if (G.done) { ring(1); text(ctx, 'おとなの は', SD.qx + 40, SD.qy + 128, 12, '#ffe066', 'center'); }
    else if (G.hintT > 12) ring(0.5 + 0.5 * Math.sin(G.t * 3));
  }
  if (G.done) return;
  if (G.key === 'topical') {
    const c = SD.rub;
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (G.holdT > 0) { ctx.fillStyle = 'rgba(255,240,180,' + 0.5 * clamp(G.holdT, 0, 1) + ')'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 3, 0, Math.PI * 2); ctx.fill(); }
    hint('まるの なかを こする');
  }
  if (G.key === 'extract') hint(G.phase ? 'はを つかんだまま うえへ' : 'はを つかんで よこに ゆらゆら');
  if (G.key === 'gauze') hint(P.down ? 'あと ' + Math.max(1, Math.ceil(3 - G.holdT)) + ' びょう' : 'あなの うえで ボタンを おしたまま');
}

// 1本を おおきく
function toothPath(c, cx, cy, s) {
  c.beginPath();
  for (let i = 0; i <= 80; i++) {
    const a = i / 80 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 3) * 0.936, y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 3) * 0.936 * 0.9;
    i ? c.lineTo(cx + x * s, cy + y * s) : c.moveTo(cx + x * s, cy + y * s);
  }
  c.closePath();
}
function drawRoll(r, ghost) {
  ctx.save(); ctx.translate(r.x, r.y);
  if (ghost) {
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5;
    rr(ctx, -ROLL.w / 2, -ROLL.h / 2, ROLL.w, ROLL.h, ROLL.h / 2); ctx.stroke(); ctx.setLineDash([]);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, -ROLL.w / 2 + 2, -ROLL.h / 2 + 4, ROLL.w, ROLL.h, ROLL.h / 2); ctx.fill();
    const g = ctx.createLinearGradient(0, -ROLL.h / 2, 0, ROLL.h / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e8ec');
    ctx.fillStyle = g; rr(ctx, -ROLL.w / 2, -ROLL.h / 2, ROLL.w, ROLL.h, ROLL.h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,190,200,.6)'; ctx.lineWidth = 1;
    for (let x = -ROLL.w / 2 + 14; x < ROLL.w / 2 - 8; x += 12) { ctx.beginPath(); ctx.moveTo(x, -ROLL.h / 2 + 4); ctx.lineTo(x + 4, ROLL.h / 2 - 4); ctx.stroke(); }
  }
  ctx.restore();
}
function drawCloseup() {
  const bg = ctx.createRadialGradient(TB.cx, TB.cy, 40, TB.cx, TB.cy, 300);
  bg.addColorStop(0, '#f6a3ae'); bg.addColorStop(1, '#c9576a');
  ctx.fillStyle = bg; ctx.fillRect(0, TOP, W, H - TOP);
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(0, TB.cy - 120, 0, TB.cy + 120); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e8dcc4');
    ctx.fillStyle = g; toothPath(ctx, TB.cx + s * TB.s * 2.08, TB.cy, TB.s * 0.95); ctx.fill();
  }
  const g = ctx.createRadialGradient(TB.cx - 50, TB.cy - 60, 20, TB.cx, TB.cy, TB.s * 1.1);
  g.addColorStop(0, '#fffdf7'); g.addColorStop(0.7, '#f3ead6'); g.addColorStop(1, '#e2d3b4');
  ctx.fillStyle = g; toothPath(ctx, TB.cx, TB.cy, TB.s); ctx.fill();
  ctx.strokeStyle = '#d4c19c'; ctx.lineWidth = 3; ctx.stroke();
  for (const [x, y] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42], [0, -0.55]]) {
    const hg = ctx.createRadialGradient(TB.cx + x * TB.s - 8, TB.cy + y * TB.s - 8, 2, TB.cx + x * TB.s, TB.cy + y * TB.s, TB.s * 0.38);
    hg.addColorStop(0, 'rgba(255,255,255,.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(TB.cx + x * TB.s, TB.cy + y * TB.s, TB.s * 0.38, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (const [w, col] of [[7, '#d8c49c'], [3, '#b89f74']]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    for (const s of GROOVES) { ctx.moveTo(TB.cx + s[0] * TB.s, TB.cy + s[1] * TB.s); ctx.lineTo(TB.cx + s[2] * TB.s, TB.cy + s[3] * TB.s); }
    ctx.stroke();
  }
  // マス目
  const x0 = TB.cx - TB.s, y0 = TB.cy - TB.s;
  const cureMix = (G.key === 'cure') ? clamp(G.holdT / 3, 0, 1) : 0;
  const dryMix = G.key === 'dry' ? clamp(G.holdT / 2.5, 0, 1) : 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, s = cell[k];
    if (s === OUT) continue;
    const x = x0 + (i + 0.5) * CS, y = y0 + (j + 0.5) * CS, h = hash[k];
    // かわかすと しろく にごる（エッチングした ところ）
    const chalk = etched[k] ? 1 : (zone[k] ? dryMix : 0);
    if (chalk > 0 && s !== SEAL && s !== SEALC) { ctx.fillStyle = 'rgba(255,255,255,' + 0.6 * chalk + ')'; ctx.fillRect(x - CS / 2 - 0.3, y - CS / 2 - 0.3, CS + 0.6, CS + 0.6); }
    if (s !== EN) {
      let col, r = CS * 0.8;
      if (s === DEC) { col = h < 0.33 ? '#3b2618' : h < 0.66 ? '#5a3a22' : '#2a1a10'; if (hp[k] < 1) col = '#7a5536'; }
      else if (s === SOFT) col = dyed[k] ? (h < 0.5 ? '#ff4f93' : '#f0367f') : (h < 0.5 ? '#c4935c' : '#b5844f');
      else if (s === HOLE) {
        let edge = false; for (const o of [-1, 1, -N, N]) if (cell[k + o] === EN) edge = true;
        col = edge ? '#b07a45' : (h < 0.5 ? '#d2a46c' : '#c99659');
      }
      else if (s === RES) col = '#efe3c2';
      else if (s === CUR) col = '#fffaf0';
      else if (s === DEB) { col = h < 0.4 ? '#7a5a34' : h < 0.7 ? '#9b7a48' : '#5e4426'; r = CS * (0.55 + h * 0.4); }
      else if (s === GRV) { col = '#a88b5e'; r = CS * 0.6; }
      else if (s === SEAL) col = '#fff1b8';
      else if (s === SEALC) col = '#fffbe8';
      if (cureMix && (s === RES || s === SEAL)) col = mix(s === RES ? '#efe3c2' : '#fff1b8', s === RES ? '#fffaf0' : '#fffbe8', cureMix);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (s === HOLE && bonded[k]) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
    }
    if (gel[k]) { ctx.fillStyle = 'rgba(40,120,255,.55)'; ctx.beginPath(); ctx.arc(x, y, CS * 0.85, 0, Math.PI * 2); ctx.fill(); }
    if (high[k] > 0) { ctx.fillStyle = 'rgba(225,25,70,' + clamp(high[k], 0, 1) + ')'; ctx.beginPath(); ctx.arc(x, y, CS * 0.75, 0, Math.PI * 2); ctx.fill(); }
  }
  if (G.key === 'polish' || (G.p.steps.includes('polish') && G.si > G.p.steps.indexOf('polish'))) {
    const sh = G.key === 'polish' ? G.shine : 1;
    for (let k = 0; k < NN; k += 7) if (cell[k] === CUR && hash[k] < 0.25 * sh) {
      const v = Math.sin(G.t * 1.5 + hash[k] * 40); if (v < 0.3) continue;
      const c = cellXY(k); ctx.globalAlpha = (v - 0.3) / 0.7; drawSpark(ctx, c.x, c.y, 5, '#ffffff'); ctx.globalAlpha = 1;
    }
  }
  // ますいの まる（はぐき）
  if (G.key === 'masui' && !G.done) {
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(GUM.x, GUM.y, GUM.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const a = G.phase ? 0.5 : 0.5 * clamp(G.holdT, 0, 1);
    if (a > 0) { ctx.fillStyle = 'rgba(255,240,180,' + a + ')'; ctx.beginPath(); ctx.arc(GUM.x, GUM.y, GUM.r - 3, 0, Math.PI * 2); ctx.fill(); }
    if (G.phase === 1) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(GUM.x, GUM.y, GUM.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(G.holdT / 3, 0, 1)); ctx.stroke(); }
    text(ctx, 'はぐき', GUM.x, GUM.y + GUM.r + 15, 12, '#ffffff', 'center', 'rgba(60,10,20,.7)');
  }
  if (G.key === 'wattes' && !G.done) for (const s of SLOTS) if (!G.wattes.some(r => r.slot === s)) drawRoll(s, true);
  for (const r of G.wattes) drawRoll(r);
  for (const c of G.chips) { ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); }
  const lightOn = (G.key === 'cure' || (G.key === 'bond' && G.phase === 1)) && P.down && !G.done;
  if (lightOn) {
    const lg = ctx.createRadialGradient(P.x, P.y, 5, P.x, P.y, 110);
    lg.addColorStop(0, 'rgba(120,170,255,.75)'); lg.addColorStop(1, 'rgba(80,120,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(P.x, P.y, 110, 0, Math.PI * 2); ctx.fill();
  }
  if (G.key === 'dry' && P.down && !G.done) for (let n = 0; n < 4; n++) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); const a = G.t * 2.5 + n * Math.PI / 2, r0 = 14 + n * 7; ctx.arc(P.x, P.y, r0, a, a + 0.8); ctx.stroke(); }
  if (G.done) return;
  const need = G.key === 'cure' ? 3 : G.key === 'dry' ? 2.5 : (G.key === 'bond' && G.phase === 1) ? 2 : 0;
  if (need) hint(P.down ? 'あと ' + Math.max(1, Math.ceil(need - G.holdT)) + ' びょう' : 'はの うえで ボタンを おしたまま');
  else if (G.key === 'drill' || G.key === 'excavate') hint('げんきな ところ（しろ）は けずらない');
  else if (G.key === 'masui') hint(G.phase ? 'うごかさずに 3びょう' : 'まるの なかを こする');
  else if (G.key === 'bite' && G.phase === 0) hint('はの うえで ボタンを おす');
}
function mix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')';
}
function drawParts() {
  for (const q of G.parts) {
    const a = 1 - q.t / q.life; ctx.globalAlpha = clamp(a, 0, 1);
    if (q.k === 'star') drawSpark(ctx, q.x, q.y, 7, q.c);
    else if (q.k === 'bubble') { ctx.strokeStyle = q.c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, 3 + q.t * 6, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.k === 'drop' ? 2.5 : 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// どうぐ
function drawTool() {
  if (!G.step || G.done) return;
  let tool = G.step.tool;
  if (G.key === 'masui' && G.phase === 1) tool = 'syringe';
  if (G.key === 'bond' && G.phase === 1) tool = 'light';
  if (G.key === 'bite' && G.phase === 1) tool = 'turbine';
  if (tool === 'none') return;
  const active = P.down || P.hover;
  if (active) { G.toolX = P.x; G.toolY = P.y; }
  const x = G.toolX, y = G.toolY;
  ctx.save(); ctx.lineCap = 'round';
  const handle = (col, w, ex, ey) => { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x + 90, y + 125); ctx.lineTo(x + ex, y + ey); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  if (tool === 'turbine' || tool === 'polisher' || tool === 'engine') {
    handle(tool === 'turbine' ? '#c7d0d8' : '#d8c27a', 13, 16, 22);
    ctx.fillStyle = '#9aa7b2'; ctx.beginPath(); ctx.arc(x + 12, y + 15, 10, 0, Math.PI * 2); ctx.fill();
    if (tool === 'polisher') { ctx.fillStyle = '#5fc98f'; ctx.beginPath(); ctx.arc(x + 2, y + 2, 7, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = '#d9b34a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 9, y + 11); ctx.lineTo(x, y); ctx.stroke(); if (tool === 'engine') { ctx.fillStyle = '#d9b34a'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); } }
    if (P.down && tool === 'turbine') { ctx.fillStyle = 'rgba(190,230,255,.6)'; for (let i = 0; i < 6; i++) { const a = G.t * 3 + i * Math.PI / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 2, 0, Math.PI * 2); ctx.fill(); } }
  } else if (tool === 'mirror') {
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 85, y + 120); ctx.lineTo(x + 14, y + 20); ctx.stroke();
    const mg = ctx.createLinearGradient(x - 14, y - 14, x + 14, y + 14); mg.addColorStop(0, '#eaf6ff'); mg.addColorStop(1, '#8fb3cc');
    ctx.fillStyle = mg; ctx.strokeStyle = '#9aa7b2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 4, y + 4, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (tool === 'vacuum' || tool === 'water') {
    handle('#e9f1f6', 18, 8, 10);
    ctx.fillStyle = '#4d6070'; ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 9, 6, -0.9, 0, Math.PI * 2); ctx.fill();
    if (tool === 'water') { ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 60, y + 110); ctx.lineTo(x - 14, y - 10); ctx.stroke(); }
  } else if (tool === 'air') {
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + 80, y + 120); ctx.lineTo(x + 10, y + 14); ctx.lineTo(x + 2, y + 2); ctx.stroke();
  } else if (tool === 'resin' || tool === 'sealant' || tool === 'syringe') {
    handle(tool === 'syringe' ? '#eef3f7' : '#ffffff', 12, 14, 20);
    ctx.strokeStyle = '#9aa7b2'; ctx.lineWidth = tool === 'syringe' ? 1.5 : 3; ctx.beginPath(); ctx.moveTo(x + 12, y + 18); ctx.lineTo(x + 1, y + 1); ctx.stroke();
    if (tool !== 'syringe') { ctx.fillStyle = tool === 'resin' ? '#efe3c2' : '#fff1b8'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  } else if (tool === 'light') {
    handle('#7f93a6', 15, 14, 18);
    ctx.fillStyle = P.down ? '#7fb0ff' : '#5b7aa8'; ctx.beginPath(); ctx.arc(x + 4, y + 5, 9, 0, Math.PI * 2); ctx.fill();
    const need = G.key === 'cure' ? 3 : 2;
    if (P.down) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(G.holdT / need, 0, 1)); ctx.stroke(); }
  } else if (tool === 'brush') {
    handle('#6cc7f0', 10, 18, 22);
    ctx.save(); ctx.translate(x + 4, y + 4); ctx.rotate(-0.95);
    ctx.fillStyle = '#6cc7f0'; rr(ctx, -6, -9, 26, 18, 6); ctx.fill();
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(-1 + i * 6, -5 + j * 5, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } else if (tool === 'scaler') {
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x + 85, y + 120); ctx.lineTo(x + 24, y + 34); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8c99a5'; ctx.beginPath(); ctx.moveTo(x + 24, y + 34); ctx.quadraticCurveTo(x + 14, y + 8, x, y); ctx.stroke();
  } else if (tool === 'forceps') {
    const open = G.ext.grip ? 4 : 10;
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + 70, y + 120); ctx.quadraticCurveTo(x + 30, y + 40, x - open, y + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 90, y + 110); ctx.quadraticCurveTo(x + 40, y + 36, x + open, y + 4); ctx.stroke();
  } else if (tool === 'gauze') {
    if (!P.down) { ctx.fillStyle = '#ffffff'; rr(ctx, x - 22, y - 14, 44, 28, 6); ctx.fill(); }
  } else if (tool === 'paper') {
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 80, y + 110); ctx.lineTo(x + 30, y + 30); ctx.stroke();
    ctx.fillStyle = '#e8285a'; ctx.save(); ctx.translate(x + 10, y + 10); ctx.rotate(-0.6); ctx.fillRect(-30, -6, 60, 12); ctx.restore();
  } else {
    // swab / fluor / detector / bondbrush / etch ＝ ぬる どうぐ
    const tipCol = { swab: G.key === 'dye' ? '#e2316a' : '#ffe9a8', fluor: '#a6e3ff', detector: '#e8285a', bondbrush: '#f4f0d0', etch: '#3f7dff' }[tool] || '#ffffff';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 80, y + 120); ctx.lineTo(x + 6, y + 8); ctx.stroke();
    ctx.fillStyle = tipCol; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 6, 9, -0.6, 0, Math.PI * 2); ctx.fill();
    if (tool === 'fluor' && P.down) drawSpark(ctx, x - 10, y - 12, 6, '#ffffff');
  }
  ctx.restore();
}

// ---------- ボタン ----------
function buildSelect() {
  const st = loadStars(), list = $('#plist'); list.innerHTML = '';
  PATIENTS.forEach(p => {
    const b = document.createElement('button'); b.className = 'pcard';
    const c = document.createElement('canvas'); c.width = 152; c.height = 152;
    const cc = c.getContext('2d'); drawFace(cc, 76, 82, 54, p, st[p.id] ? 'happy' : 'nervous');
    const s = st[p.id] || 0;
    const info = document.createElement('div');
    info.innerHTML = '<div class="nm">' + p.name + p.hon + '（' + p.age + 'さい）' + (s ? '<span class="st">' + '★'.repeat(s) + '☆'.repeat(3 - s) + '</span>' : '') + '</div>' +
      '<div class="wr">' + p.worry + '</div><span class="tt">' + p.title + '・' + p.steps.length + 'ステップ</span>';
    b.appendChild(c); b.appendChild(info);
    b.addEventListener('click', () => { audioInit(); startPatient(p); });
    list.appendChild(b);
  });
  $('#toCert').style.display = PATIENTS.every(p => st[p.id]) ? '' : 'none';
}
$('#startBtn').addEventListener('click', () => { audioInit(); SFX.start(); bgmStart(); buildSelect(); show('select'); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && b.id !== 'startBtn' && b.id !== 'abtn') { audioInit(); bgmStart(); SFX.tap(); } });
$('#toTitle').addEventListener('click', () => show('title'));
$('#toSelect').addEventListener('click', () => { buildSelect(); show('select'); });
$('#quit').addEventListener('click', () => { ctrlUp(); loopsOff(); buildSelect(); show('select'); });
$('#mute').addEventListener('click', () => {
  muted = !muted; $('#mute').textContent = muted ? '×' : '♪';
  if (MASTER) MASTER.gain.value = muted ? 0 : 1;
});
$('#toCert').addEventListener('click', () => {
  const d = new Date();
  $('#certN').textContent = PATIENTS.length;
  $('#certDate').textContent = d.getFullYear() + 'ねん ' + (d.getMonth() + 1) + 'がつ ' + d.getDate() + 'にち';
  show('cert');
});
$('#certName').addEventListener('input', e => { $('#certNm').textContent = (e.target.value || '　') + (e.target.value ? ' せんせい' : ''); });
$('#certBack').addEventListener('click', () => { buildSelect(); show('select'); });

// テスト用の入り口（自動プレイで使う）
window.__haisha = { CTRL, SD, audio: () => AC && AC.state, G, P, PATIENTS, startPatient, cell, high, zone, gel, dyed, bonded, count, STEPS, TB, N, CS, GUM, SLOTS, XR,
  consts: { DEC, SOFT, HOLE, RES, CUR, DEB, GRV, SEAL, SEALC, EN } };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if ($('#select').classList.contains('on')) buildSelect(); });
})();
