'use strict';
// クエスト（フリーシナリオ）：どこへ いき、だれを たすけるかは じゆう。ななつの のろいを とくと 大魔王の とうが ひらく
(function () {
const C = window.__hcore; if (!C) return;
const $ = s => document.querySelector(s);
const { PATIENTS } = C;

function load() { try { return JSON.parse(localStorage.getItem('haisha_story') || '{}') || {}; } catch (e) { return {}; } }
function save(o) { try { localStorage.setItem('haisha_story', JSON.stringify(o)); } catch (e) {} }
function stars() { try { return JSON.parse(localStorage.getItem('haisha_stars') || '{}') || {}; } catch (e) { return {}; } }

// ななつの のろい（いちばん つよい ちりょう）
const CURSES = ['k_trauma', 'a_perio2', 'a_endo', 'a_wisdom', 'a_implant', 'a_allon4', 'a_zygoma'];
const RUMOR = {
  k_trauma: 'こどもの むらで、ころんで まえばが ぬけた こが ないて いるらしい。',
  a_perio2: 'みなとまちに、はぐきの おくまで のろわれた おとこが いるそうだ。',
  a_endo: 'まなびの みやこで、ズキズキ いたくて ねむれない おとこが うなされて いる。',
  a_wisdom: 'けわしい とうげで、おくの はぐきが はれた たびびとが うごけないらしい。',
  a_implant: 'いにしえの しろの へいしは、おくばが 1ぽん ないそうだ。',
  a_allon4: 'いにしえの しろの おうさまは、はが ほとんど ないらしい…',
  a_zygoma: 'いにしえの しろの まじょは、うえの ほねが やせて いるとか。',
};
const LOCS = [
  { id: 'town', name: 'はじまりの まち', x: 0.27, y: 0.7, icon: 'town', npc: { name: 'いんちょう', img: 'n_mentor' }, inn: true,
    desc: 'しんちゃまの しんりょうじょが ある まち。たびは ここから はじまる。', pts: ['p2', 'a_white', 'a_inlay'],
    talk: n => n >= 7 ? ['ついに… むしば大魔王の とうへの みちが ひらいた！', 'きたの とうへ いけ。おまえなら できる。']
      : n >= 3 ? ['うでを あげたな、しんちゃま。', 'のろいの ちりょうは むずかしい。ていねいに、げんきな ところは けずらぬようにな。', 'のろいは あと ' + (7 - n) + 'つ じゃ。']
        : ['よく きたな、しんちゃま。この くには ななつの のろいに くるしんでおる。', 'どこから たすけに いっても よい。じぶんで きめるのだ。', 'こまったら やどやで うわさを きくと よい。'] },
  { id: 'village', name: 'こどもの むら', x: 0.18, y: 0.535, icon: 'village', npc: { name: 'ほいくしさん', img: 'n_teacher' },
    desc: 'こどもたちの わらいごえが きこえる のどかな むら。', pts: ['p1', 'p3', 'p4', 'k_trauma'],
    talk: () => ['こどもの はは おとなの はより やわらかくて、むしばが すすみやすいの。', '6さいごろには、おくに おおきな おとなの は「6さいきゅうし」が はえてくるのよ。', 'はが ぬけたら ぎゅうにゅうに いれて、すぐ はいしゃさんへ！'] },
  { id: 'port', name: 'みなとまち', x: 0.52, y: 0.865, icon: 'port', npc: { name: 'せんちょう', img: 'n_captain' },
    desc: 'ふねが いきかう にぎやかな みなと。しおかぜが きもちいい。', pts: ['a_perio', 'a_perio2', 'a_aligner', 'a_ortho'],
    talk: () => ['ガハハ！ うみの おとこは はぐきから ちが でとる やつが おおい。', 'ししゅうびょうは いたくないまま すすむ、こわい びょうきじゃ。', 'たばこは はぐきの てきだぞ！'] },
  { id: 'library', name: 'まなびの みやこ', x: 0.48, y: 0.59, icon: 'library', npc: { name: 'ししょ', img: 'n_librarian' },
    desc: 'はの しょもつが あつまる がくもんの みやこ。', pts: ['a_endo', 'a_crown', 'a_psy', 'a_spec'],
    talk: () => ['ここには はの しょもつが あつまって いるわ。', 'ねっこの ちりょうは「ねっこの ながさ」を はかるのが だいじ、と かいてあるわ。', 'こわがりの かたには、はなしを きいて・みせて・あいずを きめる。それも いりょうよ。'] },
  { id: 'mount', name: 'やまの さと', x: 0.71, y: 0.31, icon: 'mount', npc: { name: 'ちょうろう', img: 'n_elder' },
    desc: 'やまおくの しずかな さと。としよりが おおく すんでいる。', pts: ['a_visit', 'a_denture', 'a_cancer'],
    talk: () => ['やまの さとは としよりが おおい。はいしゃまで おりて これん ものも いる。', 'いればも まいにち はずして あらえば ながもち するぞ。', 'したに 2しゅうかん なおらん できものが あったら、すぐ みてもらう ことじゃ。'] },
  { id: 'pass', name: 'けわしい とうげ', x: 0.3, y: 0.3, icon: 'pass', npc: { name: 'たびびとの メモ', img: null },
    desc: 'かぜの つよい やまみち。たびびとが ひとやすみ している。', pts: ['a_wisdom', 'a_tmj'],
    talk: () => ['「おくの はぐきが はれて うごけない。よこむきの おやしらず らしい…」', '「おやしらずの したには しんけいの くだが ある。きを つけて くれ」', '「あごが カクカク いうのは、くいしばりの せいかも しれない」'] },
  { id: 'castle', name: 'いにしえの しろ', x: 0.79, y: 0.59, icon: 'castle', npc: { name: 'ろうきし', img: 'n_knight' },
    desc: 'むかしの おうさまが すむ しろ。かむ ちからを うしなった ものが おおい。', pts: ['a_implant', 'a_allon4', 'a_zygoma'],
    talk: () => ['この しろの ものたちは はを うしない、かむ ちからを なくした。', 'インプラントは ほねと くっつくまで まつのが だいじだ。', 'ほねが すくなければ、ほおぼねまで とどく わざも あると きく。'] },
  { id: 'tower', name: 'むしば大魔王の とう', x: 0.47, y: 0.155, icon: 'tower', final: true, npc: null,
    desc: 'くろい くもに つつまれた とう。おくから「ぐおお… いたい…」と うめきごえが きこえる。', pts: ['boss'] },
];
// ラスボス：大魔王の むしばを なおす（こどもの むしば ちりょうと おなじ てじゅん）
const base = PATIENTS.find(p => p.id === 'p1');
if (base && !PATIENTS.find(p => p.id === 'boss')) PATIENTS.push(Object.assign({}, base, {
  id: 'boss', base: 'p1', cat: 'story', lv: 4, rank: 'ラスボス', name: 'むしば大魔王', hon: '', age: '1000', style: 'boy', skin: '#9a7ab8', hair: '#2a1a3a',
  worry: '「ぐおお… おくばが いたい…」', title: '大魔王の むしばを なおせ', thanks: 'ぐおお… いたみが きえた… わしの まけじゃ…',
  card: null, cardObj: { h: 'はの くにを まもる ちから', li: [
    '<b>むしば</b>は ミュータンス<ruby>菌<rt>きん</rt></ruby>が さとうから つくる「さん」で はが とける びょうき。',
    'まいにちの <b>はみがき</b>、おやつの <b>じかんを きめる</b>、<b>フッそ</b>。これが のろいを ふせぐ まほう。',
    'いたく なる まえに、<b>ていきけんしん</b>で はいしゃさんに みてもらおう。'] } }));

const curesDone = st => CURSES.filter(id => st[id]).length;
const cleared = st => PATIENTS.filter(p => st[p.id] && p.id !== 'boss').length;

// ---------- がめん ----------
let LOC = null, TALK = null;
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }

// ものがたり（タップで すすむ）
let SCROLL = null;
function playStory(lines, done, title) {
  SCROLL = { lines, i: 0, done };
  $('#storyTitle').textContent = title || '';
  show('story'); stepStory();
}
function stepStory() {
  const s = SCROLL; if (!s) return;
  if (s.i >= s.lines.length) { SCROLL = null; s.done(); return; }
  const el = $('#storyText'); el.classList.remove('fade'); void el.offsetWidth; el.textContent = s.lines[s.i++]; el.classList.add('fade');
}
$('#story').addEventListener('click', () => { C.SFX.tap(); stepStory(); });

const PROLOGUE = ['ここは はの くに デンタリア。', 'あるとき、やみの おうさま「むしば大魔王」が めざめ、ひとびとの はに ななつの のろいを かけた。',
  'はが いたむ ひとが くにじゅうに あふれ、えがおが きえて いった…', 'わかき はいしゃ しんちゃまは、ミラーと タービンを てに たびだつ。',
  'どこへ いき、だれを たすけるかは きみ しだい。', 'ななつの のろいを とけば、大魔王の とうへの みちが ひらかれる——'];
const ENDING = ['大魔王の はの いたみが、すっと きえた。', '「わしは… はみがきを わすれたから、やみに おちたのだ…」', 'のろいは とけ、デンタリアに えがおが もどった。',
  'しかし むしばは、いつでも もどってくる。', 'まいにちの はみがきと、ていきけんしんを わすれずに——', 'おしまい'];

// せかいちず
// せかいちず（Canva で つくった え）。え の よこたて ひ を たもって まんなかに おき、まちの ボタンも おなじ わくに のせる
const MAPIMG = new Image(); MAPIMG.onload = () => { if ($('#map').classList.contains('on')) drawMap(); }; MAPIMG.src = 'worldmap.jpg';
function drawMap() {
  const cv = $('#mapCv'), box = cv.parentElement.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(box.width * d); cv.height = Math.round(box.height * d); cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px';
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.fillStyle = '#123a8a'; c.fillRect(0, 0, w, h);
  const ar = 9 / 16, rw = Math.min(w, h * ar), rh = rw / ar, rx = (w - rw) / 2, ry = (h - rh) / 2;
  if (MAPIMG.complete && MAPIMG.naturalWidth) c.drawImage(MAPIMG, rx, ry, rw, rh);
  if (curesDone(stars()) < 7) { const t = LOCS.find(l => l.id === 'tower'), g = c.createRadialGradient(rx + t.x * rw, ry + t.y * rh, 4, rx + t.x * rw, ry + t.y * rh, rw * 0.2); g.addColorStop(0, 'rgba(10,0,20,.85)'); g.addColorStop(1, 'rgba(10,0,20,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  const lay = $('#mapLocs'); lay.style.left = (rx / d) + 'px'; lay.style.top = (ry / d) + 'px'; lay.style.width = (rw / d) + 'px'; lay.style.height = (rh / d) + 'px'; lay.style.right = 'auto'; lay.style.bottom = 'auto';
}
function buildMap() {
  const st = stars(), n = curesDone(st), lay = $('#mapLocs'); lay.innerHTML = '';
  $('#mapStat').innerHTML = 'たすけた ひと <b>' + cleared(st) + '</b> / ' + (PATIENTS.length - 1) + '　のろい <b>' + n + '</b> / 7';
  for (const l of LOCS) {
    if (l.final && n < 7) continue;
    const b = document.createElement('button'); b.className = 'loc' + (l.final ? ' final' : '');
    const left = l.pts.filter(id => !st[id]).length, cur = l.pts.filter(id => CURSES.includes(id) && !st[id]).length;
    b.innerHTML = l.name + (cur ? '<span class="lc">のろい×' + cur + '</span>' : left === 0 ? '<span class="lok">★</span>' : '');
    b.style.left = (l.x * 100) + '%'; b.style.top = (l.y * 100) + '%';
    b.addEventListener('click', () => openLoc(l));
    lay.appendChild(b);
  }
  requestAnimationFrame(drawMap);
}
function goMap() { LOC = null; show('map'); buildMap(); if (C.bgmPlay) C.bgmPlay(C.BGM_SELECT); }

// まち
function npcImg(img) { return img ? '<img src="' + img + '.png" alt="">' : '<div class="noimg">メモ</div>'; }
function openLoc(l) {
  LOC = l; const st = stars();
  $('#townName').textContent = l.name; $('#townDesc').textContent = l.desc;
  const acts = $('#townActs'); acts.innerHTML = '';
  if (l.npc) { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = (l.npc.img ? 'はなす：' : 'よむ：') + l.npc.name; b.addEventListener('click', () => talk(l.npc, l.talk(curesDone(stars())))); acts.appendChild(b); }
  if (l.inn) { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'やどや：うわさを きく'; b.addEventListener('click', () => { const left = CURSES.filter(id => !stars()[id]); const lines = left.length ? [RUMOR[left[(Math.random() * left.length) | 0]]] : ['もう のろいの うわさは きかないね。あとは きたの とうだけさ。']; talk({ name: 'やどやの おかみ', img: null }, lines); }); acts.appendChild(b); }
  const list = $('#townPts'); list.innerHTML = '';
  for (const id of l.pts) {
    const p = PATIENTS.find(x => x.id === id); if (!p) continue;
    const s = st[p.id] || 0, curse = CURSES.includes(p.id);
    const b = document.createElement('button'); b.className = 'pcard' + (curse ? ' curse' : '') + (p.id === 'boss' ? ' boss' : '');
    const cvp = document.createElement('canvas'); cvp.width = 152; cvp.height = 152; C.drawPortrait(cvp.getContext('2d'), 0, 0, 152, p, s ? 'happy' : '', 1.2);
    const info = document.createElement('div');
    info.innerHTML = '<div class="nm">' + p.name + p.hon + (p.id === 'boss' ? '' : '（' + p.age + 'さい）') + (s ? '<span class="st">' + '★'.repeat(s) + '☆'.repeat(3 - s) + '</span>' : '') + '</div>' +
      (curse ? '<span class="rank r4">のろい</span> ' : '') + '<span class="rank r' + p.lv + '">' + '★'.repeat(p.lv) + ' ' + p.rank + '</span>' +
      '<div class="wr">' + p.worry + '</div><span class="tt">' + (p.field ? '【' + p.field + '】' : '') + p.title + '</span>';
    b.appendChild(cvp); b.appendChild(info);
    b.addEventListener('click', () => C.startPatient(p));
    list.appendChild(b);
  }
  $('#talkBox').classList.remove('on');
  show('town'); if (C.bgmPlay) C.bgmPlay(l.final ? 3 : C.BGM_SELECT);  // おなじ きょくなら bgmPlay は なにも しない
}
function talk(npc, lines) {
  TALK = { lines, i: 0 }; $('#talkFace').innerHTML = npcImg(npc.img); $('#talkName').textContent = npc.name;
  $('#talkBox').classList.add('on'); nextTalk();
}
function nextTalk() { if (!TALK) return; if (TALK.i >= TALK.lines.length) { TALK = null; $('#talkBox').classList.remove('on'); return; } $('#talkText').textContent = TALK.lines[TALK.i++]; }
$('#talkBox').addEventListener('click', () => { C.SFX.tap(); nextTalk(); });
$('#townBack').addEventListener('click', goMap);
window.addEventListener('resize', () => { if ($('#map').classList.contains('on')) drawMap(); });

// ---------- いりぐち ----------
function start() {
  const sv = load();
  if (!sv.prologue) { if (C.bgmPlay) C.bgmPlay(C.BGM_OPEN); playStory(PROLOGUE, () => { const s = load(); s.prologue = true; save(s); goMap(); }, 'プロローグ'); }
  else goMap();
}
function back() {
  const st = stars(), sv = load();
  if (st.boss && !sv.ending) { if (C.bgmPlay) C.bgmPlay(C.BGM_OPEN); playStory(ENDING, () => { const s = load(); s.ending = true; save(s); $('#toCert').click(); }, 'エンディング'); return; }
  if (LOC) openLoc(LOC); else goMap();
}
let refT = 0;
function refresh() { clearTimeout(refT); refT = setTimeout(() => { if (LOC && $('#town').classList.contains('on') && !$('#talkBox').classList.contains('on')) openLoc(LOC); }, 120); }
C.STORY = { refresh, start, back, goMap, LOCS, CURSES, prologue: () => playStory(PROLOGUE, goMap, 'プロローグ') };
})();
