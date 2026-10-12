'use strict';
// おとなの しょうれい（症例）エンジン
// そうさの しゅるい：tap（さがす）・choice（コマンドを えらぶ）・order（じゅんばんに えらぶ）・paint（ぬる）・erase（こする／けずる）
//                   hold（おしたまま まつ）・drag（はこぶ）・trace（なぞる）・depth（ふかさを きめる）・breath（しんこきゅう）
(function () {
const C = window.__hcore; if (!C) return;
const { G, P, ctx, W, H, TOP, text, rr, hint, drawSpark, SFX, stepDone, mistake, pop, star, clamp, lerp, rng, STEPS, PATIENTS } = C;
let S = {}, E = {};
const ST = () => G.step;

// ---------- きょうつうの えがきかた ----------
function wrap(s, maxW, size) {
  ctx.font = '400 ' + size + 'px ' + C.FONT; const out = []; let line = '';
  for (const ch of s) { if (ch === '\n') { out.push(line); line = ''; continue; } const t = line + ch; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; }
  if (line) out.push(line); return out;
}
function win(x, y, w, h, a) {
  const al = a == null ? 0.96 : a, g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(48,72,184,' + al + ')'); g.addColorStop(0.55, 'rgba(22,36,122,' + al + ')'); g.addColorStop(1, 'rgba(10,18,80,' + al + ')');
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#f2f2f8'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#7d8be0'; ctx.lineWidth = 1.5; rr(ctx, x + 4, y + 4, w - 8, h - 8, 4); ctx.stroke();
}
function label(s, x, y, size, col) { text(ctx, s, x, y, size || 11, col || '#ffffff', 'center', 'rgba(0,0,0,.75)'); }
function bg(col) { ctx.fillStyle = col; ctx.fillRect(0, TOP, W, H - TOP); }
function boneTex(x, y, w, h, col, seed) { const R = rng(seed || 3); ctx.fillStyle = col; for (let n = 0; n < w * h / 900; n++) { ctx.beginPath(); ctx.arc(x + R() * w, y + R() * h, 1 + R() * 2.6, 0, Math.PI * 2); ctx.fill(); } }
function ring(x, y, r, a, col) { ctx.strokeStyle = col || 'rgba(255,224,102,' + a + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
function pulse() { return 0.5 + 0.5 * Math.sin(G.t * 4); }

// ---------- おとなの はならび（うえから） ----------
const AW = { U: { w: [8.6, 6.6, 7.6, 7.0, 6.6, 10.2, 9.2], d: [7, 6.2, 8, 9, 9, 11, 10.5] }, L: { w: [5.4, 5.9, 6.9, 7.0, 7.1, 11.2, 10.5], d: [6, 6.4, 7.6, 8, 8.4, 10.5, 10] } };
const ARCH = {};
function adultArch(j) {
  if (ARCH[j]) return ARCH[j];
  const A = { cx: 180, cy: 252, rx: 120, ry: 200 }, k = 5.2, th0 = -0.8, th1 = Math.PI + 0.8, M = 1200, Sx = [0], TH = [th0];
  for (let i = 1; i <= M; i++) { const a = th0 + (th1 - th0) * i / M, b = th0 + (th1 - th0) * (i - 1) / M; Sx.push(Sx[i - 1] + Math.hypot(A.rx * (Math.cos(a) - Math.cos(b)), A.ry * (Math.sin(a) - Math.sin(b)))); TH.push(a); }
  const thAt = s => { let lo = 0, hi = M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Sx[m] < s) lo = m; else hi = m; } return TH[lo]; };
  const mid = Sx[M / 2], teeth = []; let thMin = 9, thMax = -9;
  for (const side of [1, -1]) {
    let acc = 0.15 * k;
    for (let i = 0; i < 7; i++) {
      const w = AW[j].w[i] * k, d = AW[j].d[i] * k, th = thAt(mid - side * (acc + w / 2)); acc += w + 0.25 * k;
      thMin = Math.min(thMin, th); thMax = Math.max(thMax, th);
      const nx = Math.cos(th) / A.rx, ny = Math.sin(th) / A.ry;
      teeth.push({ key: (side === 1 ? 'L' : 'R') + (i + 1), i, side, w, d, x: A.cx + A.rx * Math.cos(th), y: A.cy + A.ry * Math.sin(th), ang: Math.atan2(ny, nx) - Math.PI / 2 });
    }
  }
  return (ARCH[j] = { A, k, teeth, thMin: thMin - 0.1, thMax: thMax + 0.1 });
}
function archTooth(j, key) { return adultArch(j).teeth.find(t => t.key === key); }
function onTooth(j, key, lx, ly) { const t = archTooth(j, key), c = Math.cos(t.ang), s = Math.sin(t.ang); return { x: t.x + lx * t.w * c - ly * t.d * s, y: t.y + lx * t.w * s + ly * t.d * c }; }
function drawArchAdult(j) {
  const AR = adultArch(j), A = AR.A, fl = S.flags || {};
  bg('#4a1622');
  ctx.strokeStyle = '#d97a86'; ctx.lineWidth = 14; rr(ctx, 7, TOP + 7, W - 14, H - TOP - 14, 30); ctx.stroke();
  if (j === 'L') { const g = ctx.createRadialGradient(A.cx, A.cy + 40, 10, A.cx, A.cy + 40, A.ry * 0.8); g.addColorStop(0, '#ef8592'); g.addColorStop(1, '#c9566a'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(A.cx, A.cy + 22, A.rx - 42, A.ry - 62, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.fillStyle = '#e27f8c'; ctx.beginPath(); ctx.ellipse(A.cx, A.cy + 20, A.rx - 40, A.ry - 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(150,50,70,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(A.cx, A.cy + 140 - i * 8, 30 + i * 9, 10, 0, Math.PI, 0); ctx.stroke(); } }
  ctx.strokeStyle = '#ee98a4'; ctx.lineCap = 'round'; ctx.lineWidth = 15 * AR.k;
  ctx.beginPath(); ctx.ellipse(A.cx, A.cy, A.rx, A.ry, 0, AR.thMin, AR.thMax); ctx.stroke();
  for (const t of AR.teeth) {
    const f = fl[t.key] || [];
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    const w = t.w, d = t.d, molar = t.i >= 5, pm = t.i === 3 || t.i === 4;
    if (f.includes('missing')) { ctx.fillStyle = '#e88a98'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.42, d * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); continue; }
    const g = ctx.createLinearGradient(-w / 2, -d / 2, w / 2, d / 2);
    const crown = f.includes('crown'), implant = f.includes('implant');
    g.addColorStop(0, crown || implant ? '#ffffff' : '#fffdf6'); g.addColorStop(1, crown || implant ? '#d8dde6' : '#e6dcc6');
    ctx.fillStyle = g; ctx.strokeStyle = '#cbbd9e'; ctx.lineWidth = 1.4;
    rr(ctx, -w / 2, -d / 2, w, d, Math.min(w, d) * (molar ? 0.3 : pm ? 0.45 : 0.38)); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c8b791'; ctx.lineWidth = 1.4; ctx.beginPath();
    if (molar) { ctx.moveTo(-w * 0.32, 0); ctx.lineTo(w * 0.32, 0); ctx.moveTo(-w * 0.05, 0); ctx.lineTo(-w * 0.1, -d * 0.3); ctx.moveTo(w * 0.08, 0); ctx.lineTo(w * 0.12, d * 0.3); }
    else if (pm) { ctx.moveTo(-w * 0.28, 0); ctx.lineTo(w * 0.28, 0); }
    else { ctx.moveTo(-w * 0.32, 0); ctx.lineTo(w * 0.32, 0); }
    ctx.stroke();
    if (f.includes('decay')) { ctx.fillStyle = '#3d2414'; ctx.beginPath(); ctx.ellipse(w * 0.06, -d * 0.04, w * 0.16, d * 0.13, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1b0f08'; ctx.beginPath(); ctx.ellipse(w * 0.07, -d * 0.04, w * 0.07, d * 0.06, 0.4, 0, Math.PI * 2); ctx.fill(); }
    if (f.includes('inlay')) { ctx.fillStyle = '#f7f7ff'; rr(ctx, -w * 0.18, -d * 0.18, w * 0.36, d * 0.36, 3); ctx.fill(); ctx.strokeStyle = '#b8c0d8'; ctx.stroke(); }
    if (crown || implant) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-w * 0.15, -d * 0.16, w * 0.14, d * 0.08, -0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-w * 0.2, -d * 0.2, w * 0.1, d * 0.06, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  label(j === 'U' ? 'うえの はならび' : 'したの はならび', 300, TOP + 20, 11, '#ffd5dc');
}

// ---------- おくばの だんめん（よこから） ----------
const MO = { cx: 180, top: 168, cej: 262, apex: 470, w: 150 };
function molarPath(c, cx, top, cej, apex, w, crownOnly) {
  const hw = w / 2; c.beginPath(); c.moveTo(cx - hw, cej);
  c.bezierCurveTo(cx - hw - 5, cej - 40, cx - hw + 2, top + 26, cx - hw + 22, top + 8);
  c.quadraticCurveTo(cx - hw * 0.55, top - 6, cx - 8, top + 14);
  c.quadraticCurveTo(cx + hw * 0.5, top - 8, cx + hw - 20, top + 8);
  c.bezierCurveTo(cx + hw - 2, top + 26, cx + hw + 5, cej - 40, cx + hw, cej);
  if (!crownOnly) {
    c.quadraticCurveTo(cx + hw - 6, (cej + apex) / 2, cx + hw * 0.62, apex - 6); c.quadraticCurveTo(cx + hw * 0.55, apex + 6, cx + hw * 0.45, apex - 8);
    c.quadraticCurveTo(cx + hw * 0.25, cej + 100, cx + 10, cej + 58); c.quadraticCurveTo(cx, cej + 50, cx - 10, cej + 58);
    c.quadraticCurveTo(cx - hw * 0.25, cej + 100, cx - hw * 0.45, apex - 8); c.quadraticCurveTo(cx - hw * 0.55, apex + 6, cx - hw * 0.62, apex - 6);
    c.quadraticCurveTo(cx - hw + 6, (cej + apex) / 2, cx - hw, cej);
  }
  c.closePath();
}
function canals(cx, cej, apex, w) { const hw = w / 2; return [[[cx - 20, cej + 6], [cx - hw * 0.5, (cej + apex) / 2 + 10], [cx - hw * 0.55, apex - 10]], [[cx + 20, cej + 6], [cx + hw * 0.5, (cej + apex) / 2 + 10], [cx + hw * 0.55, apex - 10]]]; }
function drawMolarScene() {
  const m = S.m || {}, xr = !!ST().xray, cx = MO.cx, top = MO.top, cej = MO.cej, apex = MO.apex;
  const boneY = m.boneY || 292, gumY = m.gumY || 258;
  bg(xr ? '#07090c' : '#4a1622');
  // ほね
  ctx.fillStyle = xr ? 'rgba(115,123,131,.6)' : '#efd2bd'; ctx.beginPath(); ctx.moveTo(20, H); ctx.lineTo(20, boneY + 8); ctx.quadraticCurveTo(cx - 100, boneY - 4, cx - 80, boneY); ctx.lineTo(cx + 80, boneY); ctx.quadraticCurveTo(cx + 100, boneY - 4, 340, boneY + 8); ctx.lineTo(340, H); ctx.closePath(); ctx.fill();
  boneTex(24, boneY + 10, 312, H - boneY, xr ? 'rgba(20,24,28,.35)' : 'rgba(200,150,130,.35)', 7);
  if (m.lesion) { const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26); for (const sx of [-1, 1]) { ctx.save(); ctx.translate(cx + sx * MO.w * 0.55, apex + 2); ctx.fillStyle = xr ? 'rgba(5,6,8,.9)' : 'rgba(120,40,40,.75)'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }
  // は
  const prep = m.crown === 'prep' || m.crown === 'temp' || m.crown === 'final';
  ctx.save();
  molarPath(ctx, cx, top, cej, apex, MO.w); ctx.fillStyle = xr ? '#aab2b9' : '#f1e3c4'; ctx.fill();
  if (!prep) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cej - 4); ctx.clip(); molarPath(ctx, cx, top, cej, apex, MO.w, true); ctx.fillStyle = xr ? '#e9edf0' : '#fffaf0'; ctx.fill(); molarPath(ctx, cx, top + 10, cej + 12, apex, MO.w - 18, true); ctx.fillStyle = xr ? '#b6bec5' : '#f1e3c4'; ctx.fill(); ctx.restore(); }
  ctx.restore();
  if (prep) { // けずった あとの かたち（しだいし）
    ctx.fillStyle = '#4a1622'; ctx.beginPath(); ctx.rect(cx - 90, top - 20, 180, cej - top + 14); ctx.fill();
    ctx.fillStyle = xr ? '#aab2b9' : '#efdcb4'; ctx.beginPath(); ctx.moveTo(cx - 64, cej + 2); ctx.lineTo(cx - 52, top + 42); ctx.quadraticCurveTo(cx, top + 30, cx + 52, top + 42); ctx.lineTo(cx + 64, cej + 2); ctx.closePath(); ctx.fill();
  }
  // しずい
  const pc = { red: '#d8404e', normal: '#f29aa6', opened: '#c43a48', clean: '#2a1418', gp: '#ff8a3a' }[m.pulp || 'normal'];
  const pcol = xr ? (m.pulp === 'gp' ? '#f4f6f8' : '#3c4249') : pc;
  if (!prep || m.pulp === 'gp') {
    ctx.fillStyle = pcol; ctx.beginPath(); ctx.moveTo(cx - 30, cej + 8); ctx.lineTo(cx - 30, top + 52); ctx.quadraticCurveTo(cx - 26, top + 36, cx - 18, top + 50); ctx.lineTo(cx + 18, top + 50); ctx.quadraticCurveTo(cx + 26, top + 36, cx + 30, top + 52); ctx.lineTo(cx + 30, cej + 8); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = pcol; ctx.lineWidth = m.pulp === 'gp' || m.pulp === 'clean' ? 9 : 6; ctx.lineCap = 'round';
  for (const cn of canals(cx, cej, apex, MO.w)) { ctx.beginPath(); ctx.moveTo(cn[0][0], cn[0][1]); ctx.quadraticCurveTo(cn[1][0], cn[1][1], cn[2][0], cn[2][1]); ctx.stroke(); }
  // むしば・あな・つめもの
  if (m.decay === 1) { ctx.fillStyle = xr ? 'rgba(10,12,14,.85)' : '#3b2414'; ctx.beginPath(); ctx.ellipse(cx + 8, top + 18, 24, 16, 0.2, 0, Math.PI * 2); ctx.fill(); }
  if (m.decay === 2) { ctx.fillStyle = xr ? 'rgba(10,12,14,.9)' : '#3b2414'; ctx.beginPath(); ctx.moveTo(cx - 6, top + 6); ctx.quadraticCurveTo(cx + 34, top + 12, cx + 22, top + 52); ctx.lineTo(cx + 4, top + 54); ctx.quadraticCurveTo(cx - 20, top + 30, cx - 6, top + 6); ctx.fill(); }
  if (m.box && !m.inlay && !m.temp) { ctx.fillStyle = xr ? '#1a1e23' : '#8a5a34'; rr(ctx, cx - 28, top + 2, 56, 40, 4); ctx.fill(); }
  if (m.temp) { ctx.fillStyle = '#f2f2ea'; rr(ctx, cx - 28, top + 2, 56, 40, 4); ctx.fill(); ctx.strokeStyle = '#c9c9b8'; ctx.lineWidth = 1.5; ctx.stroke(); }
  if (m.inlay) { const g = ctx.createLinearGradient(cx - 28, top, cx + 28, top + 40); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe4ee'); ctx.fillStyle = g; rr(ctx, cx - 28, top + 2, 56, 40, 4); ctx.fill(); ctx.strokeStyle = '#aeb6cc'; ctx.lineWidth = 1.5; ctx.stroke(); }
  if (m.access) { ctx.fillStyle = m.pulp === 'gp' ? '#ff8a3a' : '#2a1418'; ctx.beginPath(); ctx.moveTo(cx - 22, top + 4); ctx.lineTo(cx + 22, top + 4); ctx.lineTo(cx + 28, cej + 6); ctx.lineTo(cx - 28, cej + 6); ctx.closePath(); ctx.fill(); }
  if (m.crown === 'temp' || m.crown === 'final') {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cej + 2); ctx.clip();
    molarPath(ctx, cx, top, cej, apex, MO.w, true);
    const g = ctx.createLinearGradient(cx - 70, top, cx + 70, cej); g.addColorStop(0, m.crown === 'final' ? '#ffffff' : '#f6f0e4'); g.addColorStop(1, m.crown === 'final' ? '#d6dcea' : '#e2d6c0');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = m.crown === 'final' ? '#9aa6c4' : '#c9b99a'; ctx.lineWidth = 2; ctx.stroke();
    if (m.crown === 'final') { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(cx - 30, top + 30, 18, 8, -0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  if (m.dam) { ctx.fillStyle = 'rgba(40,170,90,.85)'; ctx.fillRect(20, cej - 6, 320, 14); ctx.fillStyle = '#b8c0c8'; ctx.fillRect(cx - 80, cej - 12, 10, 18); ctx.fillRect(cx + 70, cej - 12, 10, 18); }
  // はぐき
  if (!xr) {
    ctx.fillStyle = m.gumRed ? '#d8506a' : '#ee98a4';
    ctx.beginPath(); ctx.moveTo(20, boneY + 24); ctx.lineTo(20, gumY + 4); ctx.quadraticCurveTo(cx - 100, gumY - 8, cx - MO.w / 2 - 2, gumY); ctx.lineTo(cx - MO.w / 2 + 4, boneY + 6); ctx.lineTo(20, boneY + 24); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(340, boneY + 24); ctx.lineTo(340, gumY + 4); ctx.quadraticCurveTo(cx + 100, gumY - 8, cx + MO.w / 2 + 2, gumY); ctx.lineTo(cx + MO.w / 2 - 4, boneY + 6); ctx.lineTo(340, boneY + 24); ctx.closePath(); ctx.fill();
    if (m.pocket) { ctx.strokeStyle = '#5a1222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - MO.w / 2 - 1, gumY + 2); ctx.lineTo(cx - MO.w / 2 + 3, gumY + m.pocket * 12.7); ctx.stroke(); }
    if (m.cord) { ctx.strokeStyle = '#3a7bff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - MO.w / 2, gumY + 2); ctx.lineTo(cx + MO.w / 2, gumY + 2); ctx.stroke(); }
  }
  if (m.scan) { ctx.strokeStyle = 'rgba(80,255,160,.55)'; ctx.lineWidth = 1; for (let y = top - 4; y < cej + 4; y += 8) { ctx.beginPath(); ctx.moveTo(cx - 80, y); ctx.lineTo(cx + 80, y); ctx.stroke(); } }
  label(xr ? 'レントゲン' : 'おくばの だんめん', 300, TOP + 20, 11, xr ? '#8f9aa4' : '#ffd5dc');
}

// ---------- インプラントの だんめん ----------
const IM = { cx: 180, crest: 262, nerve: 470, ppm: 16 };
function drawImplantScene() {
  const s = S.i || {}, xr = !!ST().xray, cx = IM.cx;
  bg(xr ? '#07090c' : '#4a1622');
  // となりの は
  for (const sx of [55, 305]) { ctx.save(); molarPath(ctx, sx, 182, IM.crest, 440, 96); ctx.fillStyle = xr ? '#aab2b9' : '#f1e3c4'; ctx.fill(); ctx.beginPath(); ctx.rect(0, 0, W, IM.crest - 4); ctx.clip(); molarPath(ctx, sx, 182, IM.crest, 440, 96, true); ctx.fillStyle = xr ? '#e9edf0' : '#fffaf0'; ctx.fill(); ctx.restore(); }
  // ほね
  ctx.fillStyle = xr ? 'rgba(115,123,131,.6)' : '#efd2bd'; rr(ctx, 14, IM.crest, 332, H - IM.crest + 20, 18); ctx.fill();
  ctx.strokeStyle = xr ? 'rgba(220,226,232,.7)' : '#e2b99e'; ctx.lineWidth = 5; rr(ctx, 16, IM.crest + 2, 328, H - IM.crest + 20, 18); ctx.stroke();
  boneTex(20, IM.crest + 8, 320, H - IM.crest, xr ? 'rgba(20,24,28,.35)' : 'rgba(200,150,130,.35)', 11);
  // しんけいの くだ
  ctx.fillStyle = xr ? '#1a1e23' : '#f4d24a'; rr(ctx, 14, IM.nerve, 332, 22, 11); ctx.fill(); ctx.strokeStyle = xr ? '#555' : '#b8902e'; ctx.lineWidth = 2; ctx.stroke();
  if (!xr) { ctx.strokeStyle = '#e0484e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, IM.nerve + 7); ctx.lineTo(346, IM.nerve + 7); ctx.stroke(); ctx.strokeStyle = '#4a7ee0'; ctx.beginPath(); ctx.moveTo(14, IM.nerve + 15); ctx.lineTo(346, IM.nerve + 15); ctx.stroke(); }
  label('しんけい・けっかん', 300, IM.nerve + 34, 10, xr ? '#cfd5da' : '#fff2b0');
  // あな・インプラント
  const hole = s.hole || 0, fix = s.fix || 0;
  if (hole > 0) { ctx.fillStyle = xr ? '#0c0e10' : '#5a2a22'; ctx.fillRect(cx - (s.wide || 5), IM.crest, (s.wide || 5) * 2, hole * IM.ppm); }
  if (fix > 0) {
    const len = fix * IM.ppm, y0 = IM.crest - 4;
    ctx.fillStyle = xr ? '#f4f6f8' : '#9aa6b4'; rr(ctx, cx - 17, y0, 34, len, 6); ctx.fill();
    ctx.strokeStyle = xr ? '#cfd5da' : '#6c7784'; ctx.lineWidth = 2;
    for (let y = y0 + 8; y < y0 + len - 6; y += 9) { ctx.beginPath(); ctx.moveTo(cx - 19, y); ctx.lineTo(cx + 19, y + 4); ctx.stroke(); }
    if (s.osseo && !xr) { ctx.strokeStyle = 'rgba(255,240,200,.85)'; ctx.lineWidth = 3; rr(ctx, cx - 21, y0, 42, len + 4, 8); ctx.stroke(); }
  }
  if (s.crown) { const g = ctx.createLinearGradient(cx - 50, 180, cx + 50, IM.crest); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6dcea'); ctx.fillStyle = '#b8c0c8'; ctx.fillRect(cx - 9, IM.crest - 26, 18, 26); ctx.save(); molarPath(ctx, cx, 180, IM.crest - 22, 600, 100, true); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#9aa6c4'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
  // はぐき
  if (!xr) {
    ctx.fillStyle = '#ee98a4';
    if (s.flap && !s.sutured) { ctx.beginPath(); ctx.moveTo(20, IM.crest + 30); ctx.lineTo(20, IM.crest - 10); ctx.quadraticCurveTo(110, IM.crest - 14, cx - 26, IM.crest - 18); ctx.lineTo(cx - 34, IM.crest + 14); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(340, IM.crest + 30); ctx.lineTo(340, IM.crest - 10); ctx.quadraticCurveTo(250, IM.crest - 14, cx + 26, IM.crest - 18); ctx.lineTo(cx + 34, IM.crest + 14); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(20, IM.crest + 30); ctx.lineTo(20, IM.crest - 10); ctx.quadraticCurveTo(cx, IM.crest - 22, 340, IM.crest - 10); ctx.lineTo(340, IM.crest + 30); ctx.closePath(); ctx.fill();
      if (s.sutured) { ctx.strokeStyle = '#2a2a6a'; ctx.lineWidth = 2; for (let x = cx - 50; x <= cx + 50; x += 25) { ctx.beginPath(); ctx.moveTo(x - 6, IM.crest - 22); ctx.lineTo(x + 6, IM.crest - 8); ctx.stroke(); } }
      if (s.crown) { ctx.fillStyle = '#ee98a4'; ctx.fillRect(cx - 50, IM.crest - 22, 100, 14); } }
  }
  label(xr ? 'CT' : 'はの ない ところの だんめん', 290, TOP + 20, 11, xr ? '#8f9aa4' : '#ffd5dc');
}

// ---------- おやしらず ----------
function drawWisdomScene() {
  const s = S.w || {}, xr = !!ST().xray;
  bg(xr ? '#07090c' : '#4a1622');
  ctx.fillStyle = xr ? 'rgba(115,123,131,.6)' : '#efd2bd'; rr(ctx, 10, 300, 340, 280, 20); ctx.fill();
  boneTex(14, 306, 332, 260, xr ? 'rgba(20,24,28,.35)' : 'rgba(200,150,130,.35)', 5);
  ctx.fillStyle = xr ? '#1a1e23' : '#f4d24a'; rr(ctx, 10, 446, 340, 20, 10); ctx.fill(); ctx.strokeStyle = xr ? '#555' : '#b8902e'; ctx.lineWidth = 2; ctx.stroke();
  label('しんけいの くだ', 290, 480, 10, xr ? '#cfd5da' : '#fff2b0');
  // だい2だいきゅうし
  ctx.save(); molarPath(ctx, 100, 178, 270, 430, 116); ctx.fillStyle = xr ? '#aab2b9' : '#f1e3c4'; ctx.fill(); ctx.beginPath(); ctx.rect(0, 0, W, 266); ctx.clip(); molarPath(ctx, 100, 178, 270, 430, 116, true); ctx.fillStyle = xr ? '#e9edf0' : '#fffaf0'; ctx.fill(); ctx.restore();
  // よこむきの おやしらず
  const drawW = (clipFn) => { ctx.save(); ctx.translate(255, 345); ctx.rotate(-Math.PI / 2); if (clipFn) clipFn(); molarPath(ctx, 0, -64, 4, 74, 92); ctx.fillStyle = xr ? '#aab2b9' : '#f1e3c4'; ctx.fill(); ctx.beginPath(); ctx.rect(-80, -80, 160, 82); ctx.clip(); molarPath(ctx, 0, -64, 4, 74, 92, true); ctx.fillStyle = xr ? '#e9edf0' : '#fffaf0'; ctx.fill(); ctx.restore(); };
  if (!s.out) {
    if (s.split) { drawW(() => { ctx.beginPath(); ctx.rect(-80, -90, 160, 88); ctx.clip(); }); ctx.save(); ctx.translate(6, 0); drawW(() => { ctx.beginPath(); ctx.rect(-80, 4, 160, 100); ctx.clip(); }); ctx.restore();
      ctx.strokeStyle = '#4a1622'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(257, 296); ctx.lineTo(257, 394); ctx.stroke(); }
    else drawW();
  } else { ctx.fillStyle = '#7a2a30'; ctx.beginPath(); ctx.ellipse(255, 330, 70, 40, 0, 0, Math.PI * 2); ctx.fill(); }
  // ほねが かぶさる ところ
  if (!s.boneCut && !s.out) { ctx.fillStyle = xr ? 'rgba(115,123,131,.85)' : '#efd2bd'; ctx.beginPath(); ctx.moveTo(180, 300); ctx.lineTo(340, 300); ctx.lineTo(340, 318); ctx.quadraticCurveTo(260, 330, 180, 312); ctx.closePath(); ctx.fill(); }
  if (!xr) {
    ctx.fillStyle = '#ee98a4';
    if (s.flap && !s.sutured) { ctx.beginPath(); ctx.moveTo(10, 300); ctx.lineTo(10, 268); ctx.quadraticCurveTo(100, 262, 175, 280); ctx.lineTo(180, 300); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(10, 300); ctx.lineTo(10, 268); ctx.quadraticCurveTo(60, 262, 158, 272); ctx.quadraticCurveTo(250, 276, 350, 280); ctx.lineTo(350, 302); ctx.closePath(); ctx.fill();
      if (s.sutured) { ctx.strokeStyle = '#2a2a6a'; ctx.lineWidth = 2; for (let x = 200; x <= 320; x += 30) { ctx.beginPath(); ctx.moveTo(x - 6, 270); ctx.lineTo(x + 6, 286); ctx.stroke(); } } }
  }
  label(xr ? 'レントゲン' : 'したの おくの だんめん', 290, TOP + 20, 11, xr ? '#8f9aa4' : '#ffd5dc');
}

// ---------- パノラマ（したの あご） ----------
const PANO = { slots: [{ x: 84, y: 266, ang: -0.45 }, { x: 160, y: 274, ang: 0 }, { x: 200, y: 274, ang: 0 }, { x: 276, y: 266, ang: 0.45 }], fora: [{ x: 96, y: 362 }, { x: 264, y: 362 }] };
function drawPanoScene() {
  const s = S.pa || {};
  bg('#07090c');
  ctx.fillStyle = 'rgba(120,128,136,.6)';
  ctx.beginPath(); ctx.moveTo(20, 140); ctx.quadraticCurveTo(14, 220, 26, 300); ctx.quadraticCurveTo(60, 470, 180, 470); ctx.quadraticCurveTo(300, 470, 334, 300); ctx.quadraticCurveTo(346, 220, 340, 140);
  ctx.lineTo(312, 150); ctx.quadraticCurveTo(300, 250, 280, 264); ctx.quadraticCurveTo(180, 286, 80, 264); ctx.quadraticCurveTo(60, 250, 48, 150); ctx.closePath(); ctx.fill();
  boneTex(30, 260, 300, 200, 'rgba(20,24,28,.35)', 9);
  ctx.strokeStyle = '#2a2e33'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(34, 220); ctx.quadraticCurveTo(50, 330, PANO.fora[0].x, PANO.fora[0].y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(326, 220); ctx.quadraticCurveTo(310, 330, PANO.fora[1].x, PANO.fora[1].y); ctx.stroke();
  for (const f of PANO.fora) { ctx.fillStyle = '#0c0e10'; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, Math.PI * 2); ctx.fill(); }
  if (s.fix) for (const sl of PANO.slots) drawItem('implant', sl.x, sl.y, sl.ang, 1, true);
  if (s.bridge) drawItem('bridge', 180, 246, 0, 1, true);
  label('パノラマ レントゲン（したの あご）', 180, TOP + 20, 11, '#8f9aa4');
  label('うしろ', 34, 500, 10, '#8f9aa4'); label('うしろ', 326, 500, 10, '#8f9aa4'); label('まえ', 180, 500, 10, '#8f9aa4');
}

// ---------- ずがいこつ（ザイゴマ） ----------
const ZY = { e: { x: 168, y: 404 }, z: { x: 240, y: 280 } };
function drawSkullScene() {
  const s = S.zy || {};
  bg('#0b1036');
  ctx.fillStyle = '#e9e2d0';
  ctx.beginPath(); ctx.moveTo(60, 300); ctx.bezierCurveTo(40, 150, 140, 100, 220, 110); ctx.bezierCurveTo(300, 120, 330, 200, 312, 270);
  ctx.lineTo(300, 300); ctx.lineTo(286, 330); ctx.lineTo(270, 380); ctx.quadraticCurveTo(240, 412, 200, 410); ctx.lineTo(150, 410); ctx.quadraticCurveTo(120, 380, 110, 340); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1d2a'; ctx.beginPath(); ctx.ellipse(232, 222, 36, 30, 0, 0, Math.PI * 2); ctx.fill();          // めの あな
  ctx.fillStyle = '#d6cdb6'; ctx.beginPath(); ctx.ellipse(250, 282, 46, 20, -0.2, 0, Math.PI * 2); ctx.fill();       // ほおぼね
  ctx.fillStyle = 'rgba(30,34,52,.85)'; ctx.beginPath(); ctx.ellipse(205, 330, 42, 34, 0, 0, Math.PI * 2); ctx.fill(); // じょうがくどう
  ctx.fillStyle = '#e9e2d0'; ctx.fillRect(140, 392, 120, 14);
  ctx.fillStyle = '#c9c0a8'; ctx.beginPath(); ctx.moveTo(120, 440); ctx.quadraticCurveTo(200, 470, 280, 430); ctx.lineTo(282, 470); ctx.quadraticCurveTo(200, 510, 118, 476); ctx.closePath(); ctx.fill();
  label('ほおぼね', 300, 268, 10, '#ffe9a0'); label('じょうがくどう', 205, 372, 10, '#cfd5ff');
  if (s.bridge) drawItem('bridgeU', 205, 412, 0, 1, true);
  if (s.depth) { const t = s.depth / 46, x = lerp(ZY.e.x, ZY.z.x, Math.min(1, t)), y = lerp(ZY.e.y, ZY.z.y, Math.min(1, t)); ctx.strokeStyle = '#9aa6b4'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ZY.e.x, ZY.e.y); ctx.lineTo(x, y); ctx.stroke(); ctx.strokeStyle = '#6c7784'; ctx.lineWidth = 2; ctx.stroke(); }
  label('ずがいこつ（よこから）', 290, TOP + 20, 11, '#b9c3ff');
}

// ---------- まえばの しょうめん（きょうせい） ----------
const FR = { y: 390, w: [7, 7, 7.6, 6.6, 8.6, 8.6, 6.6, 7.6, 7, 7], h: [34, 36, 46, 42, 48, 48, 42, 46, 36, 34], off: [[0, 0, 0], [0, 4, 0.05], [-4, -20, 0.1], [6, 6, -0.25], [3, 0, 0.08], [-4, 2, -0.12], [-6, 8, 0.3], [2, -16, -0.1], [0, 4, 0], [0, 0, 0]] };
function frontTeeth() {
  const k = 3.9, tot = FR.w.reduce((a, b) => a + b, 0) * k; let x = 180 - tot / 2; const a = S.align || 0, out = [];
  FR.w.forEach((w, i) => { const ww = w * k, o = FR.off[i]; out.push({ i, x: x + ww / 2 + o[0] * (1 - a), y: FR.y + o[1] * (1 - a), w: ww - 2, h: FR.h[i], r: o[2] * (1 - a) }); x += ww; });
  return out;
}
function bracketPos(t) { return { x: t.x, y: t.y - t.h * 0.42 }; }
function drawFrontScene() {
  bg('#4a1622');
  ctx.fillStyle = '#c8556a'; ctx.beginPath(); ctx.ellipse(180, 380, 170, 120, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a0c14'; ctx.beginPath(); ctx.ellipse(180, 392, 150, 92, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ee98a4'; ctx.beginPath(); ctx.moveTo(30, 330); ctx.quadraticCurveTo(180, 300, 330, 330); ctx.lineTo(330, 355); ctx.quadraticCurveTo(180, 335, 30, 355); ctx.closePath(); ctx.fill();
  const T = frontTeeth();
  for (const t of T) { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r); const g = ctx.createLinearGradient(0, -t.h, 0, 0); g.addColorStop(0, '#f3ead6'); g.addColorStop(1, '#fffdf7'); ctx.fillStyle = g; ctx.strokeStyle = '#cbbd9e'; ctx.lineWidth = 1.4; rr(ctx, -t.w / 2, -t.h, t.w, t.h, Math.min(8, t.w * 0.3)); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (S.brackets) for (const t of T) drawItem('bracket', bracketPos(t).x, bracketPos(t).y, 0, 1, true);
  if (S.wire) { ctx.strokeStyle = '#d8dde6'; ctx.lineWidth = 2.5; ctx.beginPath(); T.forEach((t, i) => { const b = bracketPos(t); i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x - 10, b.y); }); ctx.stroke(); }
  ctx.fillStyle = '#e07a8a'; ctx.beginPath(); ctx.ellipse(180, 470, 140, 30, 0, 0, Math.PI); ctx.fill();
  label('まえばの しょうめん', 290, TOP + 20, 11, '#ffd5dc');
}

// ---------- かお（がくかんせつ） ----------
const FC = { tmj: [{ x: 100, y: 268 }, { x: 260, y: 268 }] };
function drawFaceScene() {
  bg('#141a46');
  const girl = G.p && G.p.style === 'girl';
  ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.ellipse(180, 210, 104, 90, 0, Math.PI, 0); ctx.fill();
  if (girl) { ctx.fillRect(78, 200, 30, 170); ctx.fillRect(252, 200, 30, 170); }
  ctx.fillStyle = '#f2c9a4'; ctx.beginPath(); ctx.ellipse(180, 290, 92, 122, 0, 0, Math.PI * 2); ctx.fill();
  for (const sx of [-1, 1]) { ctx.fillStyle = '#e8b892'; ctx.beginPath(); ctx.ellipse(180 + sx * 92, 280, 12, 24, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.ellipse(180, 182, 96, 46, 0, Math.PI, 0); ctx.fill();
  for (const sx of [-1, 1]) { ctx.fillStyle = '#1b1b24'; ctx.beginPath(); ctx.ellipse(180 + sx * 34, 262, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(180 + sx * 22, 242); ctx.quadraticCurveTo(180 + sx * 34, 236, 180 + sx * 46, 242); ctx.stroke(); }
  ctx.strokeStyle = '#c99a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(180, 270); ctx.lineTo(174, 304); ctx.lineTo(184, 306); ctx.stroke();
  const op = S.open || 0, mh = 4 + op * 1.6;
  ctx.fillStyle = '#5a1222'; ctx.beginPath(); ctx.ellipse(180, 344 + mh / 2, 30, mh / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  if (op > 4) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(160, 344, 40, 7); ctx.fillRect(162, 344 + mh - 7, 36, 7); }
  if (S.splint && op > 4) { ctx.fillStyle = 'rgba(150,210,255,.6)'; ctx.fillRect(156, 342, 48, 11); }
  if (op > 0) { ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(230, 344); ctx.lineTo(230, 344 + mh); ctx.stroke(); label(Math.round(op) + 'mm', 262, 344 + mh / 2, 13, '#ffd75e'); }
  label('かお（しょうめん）', 290, TOP + 20, 11, '#b9c3ff');
}

// ---------- へや（ほうもん・しんりょうだい） ----------
function drawRoomScene() {
  bg('#1d2a5a');
  ctx.fillStyle = '#2a3a72'; ctx.fillRect(0, 380, W, H - 380);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(40, 360, 280, 26); ctx.fillRect(48, 386, 10, 70); ctx.fillRect(302, 386, 10, 70);
  ctx.fillStyle = '#f2f2f8'; ctx.fillRect(44, 340, 272, 24);
  const up = S.bedUp || 0;
  ctx.save(); ctx.translate(110, 352); ctx.rotate(-0.55 * up); ctx.fillStyle = '#e8e8f0'; ctx.fillRect(-70, -18, 90, 20); ctx.restore();
  ctx.save(); const hx = 60 + 10 * up, hy = 320 - 60 * up; rr(ctx, hx - 4, hy - 4, 72, 72, 8); ctx.fillStyle = '#0a0f33'; ctx.fill(); C.drawPortrait(ctx, hx, hy, 64, G.p, G.ouchT > 0 ? 'ouch' : '', G.t); ctx.restore();
  ctx.fillStyle = '#8ab0ff'; ctx.fillRect(140, 330, 170, 16);
  ctx.fillStyle = '#ffd75e'; ctx.fillRect(250, 130, 70, 60); ctx.fillStyle = '#9ad0ff'; ctx.fillRect(256, 136, 58, 48);
  label(up ? 'からだを おこした' : 'ねている', 180, 470, 12, '#ffd75e');
  label('おうち・しせつ', 290, TOP + 20, 11, '#b9c3ff');
}
function drawChairScene() {
  bg('#1d2a5a');
  ctx.fillStyle = '#2a3a72'; ctx.fillRect(0, 420, W, H - 420);
  ctx.fillStyle = '#3cc4b4'; ctx.beginPath(); ctx.moveTo(60, 400); ctx.lineTo(250, 380); ctx.lineTo(260, 400); ctx.lineTo(70, 420); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2aa394'; ctx.beginPath(); ctx.moveTo(60, 400); ctx.lineTo(40, 300); ctx.lineTo(60, 296); ctx.lineTo(80, 398); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa7b2'; ctx.fillRect(150, 418, 14, 60);
  ctx.save(); rr(ctx, 34, 210, 92, 92, 8); ctx.fillStyle = '#0a0f33'; ctx.fill(); ctx.strokeStyle = '#7d8be0'; ctx.lineWidth = 2; ctx.stroke(); C.drawPortrait(ctx, 36, 212, 88, G.p, G.ouchT > 0 ? 'ouch' : (S.fear || 0) > 50 ? 'nervous' : 'happy', G.t); ctx.restore();
  ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(250, 150, 26, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9aa7b2'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(250, 176); ctx.lineTo(250, 230); ctx.stroke();
  if (S.fear != null) {
    const f = clamp(S.fear, 0, 100);
    win(286, 230, 58, 190); label('ドキドキ', 315, 250, 11, '#ffd75e');
    ctx.fillStyle = '#000'; ctx.fillRect(302, 266, 26, 140);
    const g = ctx.createLinearGradient(0, 406, 0, 266); g.addColorStop(0, '#36d36a'); g.addColorStop(0.5, '#ffd75e'); g.addColorStop(1, '#ff4d6a');
    ctx.fillStyle = g; ctx.fillRect(302, 406 - 140 * f / 100, 26, 140 * f / 100);
  }
  label('しんりょうしつ', 290, TOP + 20, 11, '#b9c3ff');
}
function drawDentureScene() {
  bg('#2a3a72');
  ctx.fillStyle = '#e57f94'; ctx.beginPath(); ctx.ellipse(180, 300, 140, 170, 0, Math.PI * 0.05, Math.PI * 0.95, true); ctx.lineTo(80, 330); ctx.quadraticCurveTo(180, 430, 280, 330); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f29aaa'; ctx.beginPath(); ctx.ellipse(180, 300, 100, 120, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  for (let i = 0; i < 14; i++) { const a = Math.PI * (1.02 + i * 0.96 / 13), x = 180 + Math.cos(a) * 122, y = 312 + Math.sin(a) * 150; ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#cbbd9e'; ctx.beginPath(); ctx.ellipse(x, y, 12, 9, a, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  label('いれば（うらがわ）', 290, TOP + 20, 11, '#b9c3ff');
}
const SCENES = { archU: () => drawArchAdult('U'), archL: () => drawArchAdult('L'), molar: drawMolarScene, implant: drawImplantScene, wisdom: drawWisdomScene,
  pano: drawPanoScene, skull: drawSkullScene, front: drawFrontScene, face: drawFaceScene, room: drawRoomScene, chair: drawChairScene, denture: drawDentureScene };

// ---------- はこぶ もの ----------
function drawItem(kind, x, y, ang, sc, placed) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.scale(sc || 1, sc || 1);
  if (kind === 'implant') { ctx.fillStyle = '#c2ccd8'; rr(ctx, -9, 0, 18, 120, 5); ctx.fill(); ctx.strokeStyle = '#7d8896'; ctx.lineWidth = 1.5; for (let yy = 8; yy < 114; yy += 8) { ctx.beginPath(); ctx.moveTo(-10, yy); ctx.lineTo(10, yy + 3); ctx.stroke(); } }
  else if (kind === 'bridge' || kind === 'bridgeU') { ctx.fillStyle = '#e57f94'; rr(ctx, -140, -14, 280, 26, 12); ctx.fill(); for (let i = 0; i < 12; i++) { ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#cbbd9e'; rr(ctx, -132 + i * 22, kind === 'bridge' ? -34 : 6, 20, 28, 5); ctx.fill(); ctx.stroke(); } }
  else if (kind === 'temp' || kind === 'inlay') { ctx.fillStyle = kind === 'temp' ? '#f2f2ea' : '#ffffff'; rr(ctx, -28, -20, 56, 40, 4); ctx.fill(); ctx.strokeStyle = '#aeb6cc'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else if (kind === 'dam') { ctx.fillStyle = 'rgba(40,170,90,.9)'; rr(ctx, -110, -40, 220, 80, 6); ctx.fill(); ctx.fillStyle = '#4a1622'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); }
  else if (kind === 'crownT' || kind === 'crownF' || kind === 'crownI') { const g = ctx.createLinearGradient(-60, -50, 60, 40); g.addColorStop(0, kind === 'crownT' ? '#f6f0e4' : '#ffffff'); g.addColorStop(1, kind === 'crownT' ? '#e2d6c0' : '#d6dcea'); molarPath(ctx, 0, -46, 44, 400, kind === 'crownI' ? 100 : 150, true); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#9aa6c4'; ctx.lineWidth = 2; ctx.stroke(); }
  else if (kind === 'bracket') { ctx.fillStyle = '#c9d2dc'; rr(ctx, -6, -6, 12, 12, 2); ctx.fill(); ctx.fillStyle = '#7d8896'; ctx.fillRect(-6, -1.5, 12, 3); }
  else if (kind === 'splint') { ctx.fillStyle = 'rgba(150,210,255,.75)'; rr(ctx, -40, -10, 80, 20, 8); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  else if (kind === 'piece1' || kind === 'piece2') { ctx.fillStyle = kind === 'piece1' ? '#fffaf0' : '#f1e3c4'; rr(ctx, -34, -30, 68, 60, 14); ctx.fill(); ctx.strokeStyle = '#cbbd9e'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

// ---------- どうぐ（あたらしい ぶん） ----------
function drawTool(tool, x, y) {
  const line = (col, w, x1, y1, x2, y2) => { ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  if (tool === 'probe') { line('#c7d0d8', 7, x + 80, y + 118, x + 14, y + 22); line('#8c99a5', 2.5, x + 14, y + 22, x, y); ctx.fillStyle = '#222'; for (let i = 1; i < 4; i++) ctx.fillRect(x + 3.5 * i - 1, y + 5.5 * i - 1, 3, 2); return true; }
  if (tool === 'file') { line('#f2c94c', 12, x + 70, y + 104, x + 30, y + 46); line('#c7d0d8', 2, x + 30, y + 46, x, y); return true; }
  if (tool === 'scalpel') { line('#c7d0d8', 8, x + 80, y + 118, x + 18, y + 26); ctx.fillStyle = '#e6edf4'; ctx.beginPath(); ctx.moveTo(x + 18, y + 26); ctx.lineTo(x, y); ctx.lineTo(x + 26, y + 16); ctx.closePath(); ctx.fill(); return true; }
  if (tool === 'needle') { line('#c7d0d8', 6, x + 80, y + 118, x + 16, y + 20); ctx.strokeStyle = '#3a3a8a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 6, y + 8, 9, Math.PI * 0.8, Math.PI * 2.1); ctx.stroke(); return true; }
  if (tool === 'implantdrill') { line('#d8c27a', 14, x + 90, y + 120, x + 14, y + 24); line('#9aa7b2', 4, x + 12, y + 20, x, y); return true; }
  if (tool === 'scanner') { line('#e9eef4', 18, x + 90, y + 120, x + 10, y + 12); ctx.fillStyle = '#3cc4b4'; ctx.beginPath(); ctx.arc(x + 4, y + 4, 6, 0, Math.PI * 2); ctx.fill(); return true; }
  if (tool === 'tweezer') { line('#c7d0d8', 4, x + 76, y + 112, x - 2, y); line('#c7d0d8', 4, x + 86, y + 108, x + 4, y + 2); return true; }
  if (tool === 'hand' || tool === 'cursor') return true;
  return false;
}

// ---------- しんこう ----------
function startCasePatient(p) { S = JSON.parse(JSON.stringify(p.scene0 || {})); }
function init(st) {
  E = { t: 0, prog: 0, wasDown: false };
  if (st.before) st.before(S);
  if (st.type === 'paint') {
    E.cells = []; const cs = 6, rg = typeof st.region === 'function' ? st.region(S) : st.region;
    for (let y = TOP; y < H; y += cs) for (let x = 0; x < W; x += cs) {
      const cx = x + cs / 2, cy = y + cs / 2; let inside = false;
      for (const r of [].concat(rg)) { if (r.r != null) inside = inside || Math.hypot(cx - r.x, cy - r.y) < r.r; else if (r.rx != null) inside = inside || ((cx - r.x) / r.rx) ** 2 + ((cy - r.y) / r.ry) ** 2 < 1; else inside = inside || (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h); }
      if (inside) E.cells.push({ x: cx, y: cy, on: false });
    }
  }
  if (st.type === 'erase') E.marks = (typeof st.marks === 'function' ? st.marks(S) : st.marks).map(m => Object.assign({ hp: 1 }, m));
  if (st.type === 'drag') { E.items = (typeof st.items === 'function' ? st.items(S) : st.items).map(it => Object.assign({ placed: false, hx: it.x, hy: it.y }, it)); E.slots = (typeof st.slots === 'function' ? st.slots(S) : st.slots || []).map(s => Object.assign({ used: false }, s)); }
  if (st.type === 'trace') { E.pts = typeof st.pts === 'function' ? st.pts(S) : st.pts; E.idx = 0; }
  if (st.type === 'depth') { E.d = 0; E.lock = false; }
  if (st.type === 'order') { E.idx = 0; E.okSet = []; }
  if (st.type === 'tap') E.found = [];
  if (st.type === 'breath') { E.lung = 0; E.cyc = 0; E.ph = 'in'; }
}
function finishStep() { const st = ST(); if (st.after) st.after(S); stepDone(); }
function snd(L, on) { const k = ST().snd; if (k && on) L[k] = k === 'brush' ? 0.1 : k === 'hum' || k === 'air' ? 0.06 : 0.05; }
function update(dt, fd, jd, L) {
  const st = ST(); E.t += dt; const down = P.down;
  if (st.type === 'paint' && down) {
    const r = st.r || 16, n = Math.max(1, Math.ceil(Math.hypot(P.x - P.fx0, P.y - P.fy0) / 5));
    for (let i = 1; i <= n; i++) { const px = lerp(P.fx0, P.x, i / n), py = lerp(P.fy0, P.y, i / n); for (const c of E.cells) if (!c.on && (c.x - px) ** 2 + (c.y - py) ** 2 < r * r) c.on = true; }
    snd(L, true);
    const on = E.cells.filter(c => c.on).length; E.prog = on / Math.max(1, E.cells.length);
    if (E.prog >= 0.95) { E.cells.forEach(c => c.on = true); E.prog = 1; finishStep(); }
  }
  if (st.type === 'erase') {
    if (down) {
      const r = st.r || 14; let hit = false;
      for (const m of E.marks) if (m.hp > 0 && Math.hypot(m.x - P.x, m.y - P.y) < (m.r || 6) + r) { m.hp -= st.rub ? fd * (st.rate || 0.02) : dt * (st.rate || 3); hit = true; if (m.hp <= 0 && Math.random() < 0.5) G.parts.push(star(m.x, m.y)); }
      snd(L, hit || !st.rub);
      if (st.avoid) for (const a of st.avoid) if (Math.hypot(a.x - P.x, a.y - P.y) < a.r) { E.bad = (E.bad || 0) + dt; if (E.bad > 0.35) { E.bad = 0; mistake(a.msg); } }
    }
    const left = E.marks.filter(m => m.hp > 0).length; E.prog = 1 - left / Math.max(1, E.marks.length);
    if (left === 0) finishStep();
  }
  if (st.type === 'hold') {
    const a = st.area, inside = !a || Math.hypot(P.x - a.x, P.y - a.y) < (a.r || 30);
    if (down && inside) { if (st.still && fd > 2.5) { E.bad = (E.bad || 0) + dt; if (E.bad > 0.3) { E.bad = 0; pop(P.x, P.y - 34, 'うごかさないでね', '#ffe066'); } } else E.t2 = (E.t2 || 0) + dt; snd(L, true); }
    G.holdT = E.t2 || 0; E.prog = (E.t2 || 0) / st.sec;
    if (st.anim) st.anim(S, clamp(E.prog, 0, 1));
    if (E.prog >= 1) finishStep();
  }
  if (st.type === 'drag') {
    if (jd) { const it = E.items.find(i => !i.placed && Math.abs(P.sx - i.x) < (i.w || 40) / 2 + 10 && Math.abs(P.sy - i.y) < (i.h || 40) / 2 + 10); if (it) { E.grab = it; it.ox = it.x - P.sx; it.oy = it.y - P.sy; SFX.grip(); } }
    if (E.grab && down) { E.grab.x = P.x + E.grab.ox; E.grab.y = P.y + E.grab.oy; }
    if (E.grab && !down) {
      const it = E.grab; E.grab = null; const sn = st.snap || 44;
      const cand = it.slot ? [it.slot] : E.slots.filter(s => !s.used);
      let best = null, bd = 1e9; for (const s of cand) { const d = Math.hypot(it.x - s.x, it.y - s.y); if (d < bd) { bd = d; best = s; } }
      if (best && bd < sn) { it.x = best.x; it.y = best.y; it.ang = best.ang || 0; it.placed = true; best.used = true; SFX.pop(); }
    }
    E.prog = E.items.filter(i => i.placed).length / E.items.length;
    if (E.prog >= 1) finishStep();
  }
  if (st.type === 'trace' && down) {
    const p = E.pts[E.idx];
    if (st.slow && fd > 3.2) { E.bad = (E.bad || 0) + dt; if (E.bad > 0.25) { E.bad = 0; pop(P.x, P.y - 30, 'ゆっくり', '#ffe066'); } }
    else if (p && Math.hypot(P.x - p[0], P.y - p[1]) < (st.tol || 18)) { E.idx++; SFX.chu(); }
    snd(L, true);
    E.prog = E.idx / E.pts.length;
    if (E.idx >= E.pts.length) finishStep();
  }
  if (st.type === 'depth') {
    if (down && !E.lock) {
      E.d += dt * (st.speed || 3); snd(L, true);
      if (st.stopAt != null && E.d >= st.stopAt) { E.d = st.stopAt; if (!E.stopPop) { E.stopPop = true; SFX.click(); } }
      if (st.bad != null && E.d > st.bad) { mistake(st.overMsg || 'ふかすぎ！'); E.d = 0; E.lock = true; }
      if (st.beep && E.d >= st.green[0] && E.d <= st.green[1] && Math.floor(E.t * 8) !== E.beepT) { E.beepT = Math.floor(E.t * 8); SFX.pi(); }
    }
    if (E.wasDown && !down) {
      E.lock = false;
      if (E.d >= st.green[0] && E.d <= st.green[1]) { if (st.okMsg) pop(180, 300, st.okMsg, '#ffd75e'); finishStep(); }
      else if (E.d > st.green[1]) { mistake(st.overMsg || 'ふかすぎ！'); E.d = 0; }
      else if (E.d > 0.3) pop(P.x, P.y - 30, st.shortMsg || 'もうすこし', '#ffe066');
    }
    E.prog = clamp(E.d / st.green[0], 0, 1) * 0.95;
    if (st.live) st.live(S, E.d);
  }
  if (st.type === 'breath') {
    if (down) E.lung = Math.min(1, E.lung + dt / 2.2); else E.lung = Math.max(0, E.lung - dt / 2.2);
    if (E.ph === 'in' && E.lung >= 1) { E.ph = 'out'; SFX.chime(); }
    if (E.ph === 'in' && E.wasDown && !down && E.lung < 0.7 && E.lung > 0.05) pop(180, 300, 'もっと ゆっくり すって〜', '#ffe066');
    if (E.ph === 'out' && E.lung <= 0) { E.ph = 'in'; E.cyc++; if (st.anim) st.anim(S, E.cyc); SFX.tick(Math.min(3, E.cyc)); }
    E.prog = (E.cyc + (E.ph === 'out' ? 0.5 : 0)) / 3;
    if (E.cyc >= 3) finishStep();
  }
  E.wasDown = down;
}
function choiceRows() {
  const st = ST(), lines = wrap(st.q, 290, 14), qh = 26 + lines.length * 20, rows = []; let y = TOP + 18 + qh + 12;
  for (const o of st.opts) { const ls = wrap(o.t, 270, 14), h = 18 + ls.length * 20; rows.push({ o, ls, x: 22, y, w: 316, h }); y += h + 8; }
  return { lines, qh, rows };
}
function orderCards() { const st = ST(), n = st.items.length, cols = n > 4 ? 3 : 2, cw = 150, ch = 72, out = []; st.shuffle.forEach((idx, k) => { const c = k % cols, r = (k / cols) | 0; out.push({ idx, x: 180 - (cols * cw + (cols - 1) * 10) / 2 + c * (cw + 10), y: 230 + r * (ch + 12), w: cw, h: ch }); }); return out; }
function tap(x, y) {
  const st = ST();
  if (st.type === 'tap') {
    for (const tg of st.targets(S)) {
      const hit = tg.rx ? ((x - tg.x) / tg.rx) ** 2 + ((y - tg.y) / tg.ry) ** 2 < 1 : Math.hypot(x - tg.x, y - tg.y) < tg.r;
      if (!hit) continue;
      if (tg.ok) { if (!E.found.includes(tg.id)) { E.found.push(tg.id); pop(tg.x, tg.y - 30, tg.msg || 'みつけた！', '#ffe066'); SFX.pop(); } if (E.found.length >= (st.need || 1)) finishStep(); }
      else { SFX.no(); pop(x, y - 26, tg.msg || 'ここじゃないよ'); }
      return;
    }
    if (st.wrong) { SFX.no(); pop(x, y - 26, st.wrong); }
  } else if (st.type === 'choice') {
    const R = choiceRows();
    for (const r of R.rows) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
      if (r.o.ok) { pop(180, r.y - 8, r.o.why || 'せいかい！', '#ffd75e'); finishStep(); }
      else { mistake('ちがうよ'); pop(180, r.y + r.h + 14, r.o.why || 'もういちど かんがえよう', '#ffffff'); }
      return;
    }
  } else if (st.type === 'order') {
    for (const c of orderCards()) if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) {
      if (E.okSet.includes(c.idx)) return;
      if (c.idx === E.idx) { E.okSet.push(c.idx); E.idx++; SFX.pop(); if (E.idx >= st.items.length) finishStep(); }
      else { mistake('じゅんばんが ちがうよ'); if (st.why) pop(180, c.y - 10, st.why, '#ffffff'); }
      return;
    }
  }
}
function progress() {
  const st = ST();
  if (st.type === 'order') return E.idx / st.items.length;
  if (st.type === 'tap') return (E.found || []).length / (st.need || 1);
  if (st.type === 'choice') return 0;
  return clamp(E.prog || 0, 0, 1);
}
function isTap() { const t = ST().type; return t === 'tap' || t === 'choice' || t === 'order'; }
function draw() {
  const st = ST();
  (SCENES[st.scene] || (() => bg('#1d2a5a')))();
  if (st.type === 'paint') {
    ctx.fillStyle = st.color || 'rgba(80,140,255,.55)';
    for (const c of E.cells) if (c.on) ctx.fillRect(c.x - 3.2, c.y - 3.2, 6.4, 6.4);
    if (!G.done) { ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; for (const r of [].concat(typeof st.region === 'function' ? st.region(S) : st.region)) { ctx.beginPath(); if (r.r != null) ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); else if (r.rx != null) ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2); else ctx.rect(r.x, r.y, r.w, r.h); ctx.stroke(); } ctx.restore(); }
  }
  if (st.type === 'erase') for (const m of E.marks) if (m.hp > 0) { ctx.globalAlpha = clamp(m.hp * 1.4, 0.15, 1); ctx.fillStyle = m.c || st.color || '#d9b44a'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r || 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (st.type === 'hold' && !G.done) {
    const a = st.area; if (a) { ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(a.x, a.y, a.r || 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(a.x, a.y, (a.r || 30) + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(E.prog, 0, 1)); ctx.stroke(); }
    if (st.glow && P.down) { const g = ctx.createRadialGradient(P.x, P.y, 5, P.x, P.y, 100); g.addColorStop(0, st.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, 100, 0, Math.PI * 2); ctx.fill(); }
    if (st.timeText) { win(60, 200, 240, 60); label(st.timeText, 180, 222, 15, '#ffd75e'); ctx.fillStyle = '#000'; ctx.fillRect(80, 238, 200, 10); ctx.fillStyle = '#6fd3ff'; ctx.fillRect(80, 238, 200 * clamp(E.prog, 0, 1), 10); }
    hint(P.down ? 'あと ' + Math.max(1, Math.ceil(st.sec - (E.t2 || 0))) + ' びょう' : (st.hint || 'ボタンを おしたまま'));
  }
  if (st.type === 'drag') {
    for (const s of E.slots) if (!s.used) { ctx.save(); ctx.globalAlpha = 0.35 + 0.3 * pulse(); drawItem(s.kind || E.items[0].kind, s.x, s.y, s.ang || 0, 1); ctx.restore(); }
    for (const it of E.items) { if (!it.placed && it.slot) { ctx.save(); ctx.globalAlpha = 0.35 + 0.3 * pulse(); drawItem(it.kind, it.slot.x, it.slot.y, it.slot.ang || 0, 1); ctx.restore(); } }
    for (const it of E.items) drawItem(it.kind, it.x, it.y, it.placed ? it.ang || 0 : 0, it.placed ? 1 : (it.trayScale || 1));
    if (!G.done) hint(st.hint || 'ボタンを おしたまま はこんで、うすい かげに かさねよう');
  }
  if (st.type === 'trace') {
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); E.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = st.color || '#ff5a6e'; ctx.lineWidth = 3.5; ctx.beginPath(); for (let i = 0; i < E.idx; i++) { const p = E.pts[i]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
    const p = E.pts[E.idx]; if (p && !G.done) { ring(p[0], p[1], 10 + 4 * pulse(), 1, '#ffd75e'); }
    if (!G.done) hint(st.hint || 'ボタンを おしたまま まるを じゅんばんに なぞろう');
  }
  if (st.type === 'depth') {
    const gx = 322, gy0 = TOP + 82, gh = 285, mx = st.max || st.green[1] * 1.4, toY = v => gy0 + gh * v / mx;
    win(298, gy0 - 30, 50, gh + 70);
    ctx.fillStyle = '#000'; ctx.fillRect(gx - 8, gy0, 16, gh);
    ctx.fillStyle = 'rgba(54,211,106,.85)'; ctx.fillRect(gx - 8, toY(st.green[0]), 16, toY(st.green[1]) - toY(st.green[0]));
    if (st.bad != null) { ctx.fillStyle = 'rgba(255,77,106,.8)'; ctx.fillRect(gx - 8, toY(st.bad), 16, gy0 + gh - toY(st.bad)); }
    ctx.fillStyle = '#ffd75e'; ctx.fillRect(gx - 12, toY(Math.min(E.d, mx)) - 2, 24, 4);
    label((Math.round(E.d * 10) / 10).toFixed(1), gx, gy0 - 14, 12, '#ffd75e'); label(st.unit || 'mm', gx, gy0 + gh + 14, 10, '#b9c3ff');
    if (st.drawInst) st.drawInst(S, E.d);
    if (!G.done) hint(st.hint || 'ボタンを おして すすめ、みどりで はなそう');
  }
  if (st.type === 'breath') {
    win(60, 360, 240, 90); label(E.ph === 'in' ? 'すって〜（ボタンを おす）' : 'はいて〜（ボタンを はなす）', 180, 384, 14, '#ffd75e');
    ctx.fillStyle = '#000'; ctx.fillRect(80, 404, 200, 14); ctx.fillStyle = '#6fd3ff'; ctx.fillRect(80, 404, 200 * E.lung, 14);
    label((E.cyc || 0) + ' / 3', 180, 434, 12, '#ffffff');
  }
  if (st.type === 'choice') {
    ctx.fillStyle = 'rgba(5,8,28,.55)'; ctx.fillRect(0, TOP, W, H - TOP);
    const R = choiceRows(); win(14, TOP + 12, 332, R.qh);
    R.lines.forEach((l, i) => text(ctx, l, 28, TOP + 34 + i * 20, 14, '#ffffff', 'left', '#000'));
    for (const r of R.rows) {
      const hov = C.CTRL.used && C.CTRL.cx > r.x && C.CTRL.cx < r.x + r.w && C.CTRL.cy > r.y && C.CTRL.cy < r.y + r.h;
      win(r.x, r.y, r.w, r.h, hov ? 1 : 0.92);
      if (hov) text(ctx, '▶', r.x + 12, r.y + r.h / 2, 13, '#ffd75e', 'left', '#000');
      r.ls.forEach((l, i) => text(ctx, l, r.x + 30, r.y + 19 + i * 20, 14, hov ? '#ffd75e' : '#ffffff', 'left', '#000'));
    }
  }
  if (st.type === 'order') {
    ctx.fillStyle = 'rgba(5,8,28,.55)'; ctx.fillRect(0, TOP, W, H - TOP);
    win(14, TOP + 12, 332, 90); wrap(st.q, 300, 14).forEach((l, i) => text(ctx, l, 28, TOP + 36 + i * 20, 14, '#ffffff', 'left', '#000'));
    for (const c of orderCards()) {
      const done = E.okSet.includes(c.idx); win(c.x, c.y, c.w, c.h, done ? 0.45 : 0.95);
      if (st.icons) st.icons(c.idx, c.x + 26, c.y + c.h / 2);
      wrap(st.items[c.idx], c.w - (st.icons ? 56 : 20), 13).forEach((l, i, a) => text(ctx, l, c.x + (st.icons ? 50 : c.w / 2), c.y + c.h / 2 + (i - (a.length - 1) / 2) * 18, 13, done ? '#8f9ad6' : '#ffffff', st.icons ? 'left' : 'center', '#000'));
      if (done) label(String(E.okSet.indexOf(c.idx) + 1), c.x + c.w - 14, c.y + 14, 13, '#ffd75e');
    }
  }
  if (st.type === 'tap' && G.hintT > 12 && !G.done) for (const tg of st.targets(S)) if (tg.ok && !E.found.includes(tg.id)) { if (tg.rx) { ctx.strokeStyle = 'rgba(255,224,102,' + pulse() + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(tg.x, tg.y, tg.rx + 6, tg.ry + 6, 0, 0, Math.PI * 2); ctx.stroke(); } else ring(tg.x, tg.y, tg.r + 6, pulse()); }
}

// ---------- しょうれいの データ ----------
// ことばの きまり：say＝なにを するか、tip＝ほんものでは どうするか
const masui = (x, y) => ({ type: 'hold', label: 'ますい', tool: 'syringe', toolName: 'ますい', area: { x, y, r: 26 }, sec: 3, still: true, scary: true,
  say: 'はぐきの <b>まる</b>の うえで ボタンを おしたまま、うごかさずに まってね（ますい）',
  tip: '<b>ほんものでは</b> ぬりぐすりの ますいの あとに、ゆっくり ちゅうしゃを して いたくないように するよ。', hint: 'まるの うえで ボタンを おしたまま' });
const grid = (x0, y0, x1, y1, step, fn) => { const o = []; for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) if (!fn || fn(x, y)) o.push({ x, y }); return o; };
const dots = (pts, r, c) => pts.map(p => ({ x: p[0], y: p[1], r, c }));
const archTarget = (j, key, ok, msg) => { const t = archTooth(j, key); return { id: key, x: t.x, y: t.y, r: Math.max(t.w, t.d) / 2 + 6, ok, msg }; };
const allArch = (j, okKeys, okMsg, ngMsg) => adultArch(j).teeth.map(t => ({ id: t.key, x: t.x, y: t.y, r: Math.max(t.w, t.d) / 2 + 4, ok: okKeys.includes(t.key), msg: okKeys.includes(t.key) ? okMsg : ngMsg }));
const fear = d => S2 => { S2.fear = Math.max(5, (S2.fear || 0) - d); };

const CASES = [
  // ===== 保存：インレー =====
  { id: 'a_inlay', lv: 1, rank: 'ふつう', field: '保存', name: 'りょう', age: 32, skin: '#f2c9a4', hair: '#2a1a10', style: 'boy',
    worry: '「つめたい ものが しみる」', title: 'つめもの（インレー）', thanks: 'もう しみない！ かむのも らくに なったよ',
    scene0: { flags: { L6: ['decay'] }, m: { decay: 1 } },
    steps: [
      { type: 'tap', scene: 'archL', label: 'みる', tool: 'mirror', toolName: 'ミラー', say: 'しみる <b>むしば</b>の はを さがして えらぼう',
        tip: '<b>ほんものでは</b> みる・さわる・つめたい かぜを あてる などで、どの はか たしかめるよ。', targets: () => allArch('L', ['L6'], 'この は だ！', 'この はは げんき') },
      { type: 'choice', scene: 'molar', label: 'けいかく', say: 'どう なおすか きめよう', tip: '<b>ほんものでは</b> むしばの おおきさで なおしかたを えらぶよ。',
        q: 'むしばは すこし おおきめ。どう なおす？', opts: [
          { t: 'けずって かたを とり、つめもの（インレー）を つくる', ok: true, why: 'おおきめの あなは つくった つめもので じょうぶに' },
          { t: 'なにも しない', why: 'むしばは しぜんには なおらないよ' },
          { t: 'はを ぬく', why: 'けずって なおせる はは ぬかないよ' }] },
      masui(92, 276),
      { type: 'erase', scene: 'molar', label: 'けずる', tool: 'turbine', toolName: 'タービン', snd: 'drill', scary: true, rate: 4, r: 14, color: '#3b2414',
        say: 'くろい <b>むしば</b>を けずって、はこの かたちに ととのえよう', tip: '<b>ほんものでは</b> つめものが はずれないように、あなの かたちを ととのえるよ。',
        marks: () => grid(156, 172, 204, 206, 8).map(p => ({ x: p.x, y: p.y, r: 6, c: '#4a2c18' })), before: s => { s.m.decay = 0; s.m.box = true; } },
      { type: 'paint', scene: 'molar', label: 'かたどり', tool: 'scanner', toolName: 'こうないスキャナー', snd: 'hum', r: 18, color: 'rgba(80,255,160,.5)',
        say: 'スキャナーで はの かたちを <b>3D</b>で よみとろう（なぞる）', tip: '<b>ほんものでは</b> かたどりの ねんどや、こうない スキャナーで かたちを とるよ。',
        region: { x: 100, y: 160, w: 160, h: 104 }, after: s => { s.m.scan = true; } },
      { type: 'drag', scene: 'molar', label: 'かりの ふた', tool: 'tweezer', toolName: 'かりの ふた', say: 'つめものが できるまで <b>かりの ふた</b>を しよう',
        tip: '<b>ほんものでは</b> つめものが できるまでの あいだ、かりの ふたで あなを まもるよ。', before: s => { s.m.scan = false; },
        items: [{ kind: 'temp', x: 90, y: 500, w: 60, h: 44, slot: { x: 180, y: 190 } }], after: s => { s.m.temp = true; } },
      { type: 'choice', scene: 'molar', label: 'つぎの ひ', say: 'つめものが できたよ', tip: '<b>ほんものでは</b> ぎこうしさんが かたちに あわせて つめものを つくるよ。',
        q: 'ぎこうしさんが つめものを つくったよ。さいしょに することは？', opts: [
          { t: 'かりの ふたを とって、ぴったりか あわせて みる', ok: true, why: 'あわせてから つけるよ' },
          { t: 'かりの ふたの うえから つける', why: 'かりの ふたを とらないと はいらない' }], after: s => { s.m.temp = false; } },
      { type: 'drag', scene: 'molar', label: 'つける', tool: 'tweezer', toolName: 'セラミックの つめもの', say: '<b>つめもの</b>を あなに はめよう',
        tip: '<b>ほんものでは</b> とくべつな せっちゃくざいで しっかり つけるよ。', items: [{ kind: 'inlay', x: 270, y: 500, w: 60, h: 44, slot: { x: 180, y: 190 } }], after: s => { s.m.inlay = true; } },
      { type: 'erase', scene: 'molar', label: 'かみあわせ', tool: 'turbine', toolName: 'タービン（すこし けずる）', snd: 'drill', rate: 3, r: 12,
        say: 'あかい かみで しらべた <b>たかい ところ</b>（あか）を けずろう', tip: '<b>ほんものでは</b> あかい かみを かんで もらって、たかすぎる ところを けずるよ。',
        marks: dots([[166, 178], [194, 182], [180, 196]], 6, '#e2245a') }],
    card: { h: 'つめもの（インレー）', li: [
      '<b>インレー</b>は、かたを とって <b>ぎこうしさん</b>が つくる、はの いちぶを うめる つめもの。',
      'ちいさい むしばは その日に <b>レジン</b>で、おおきめなら インレーや かぶせもので なおすことが おおい。',
      'ざいりょうは <b>セラミック・きんぞく・レジン</b> など。',
      'さいごに <b>かみあわせ</b>を みて、たかい ところを ととのえる。'] } },

  // ===== 歯周病 =====
  { id: 'a_perio', lv: 1, rank: 'ふつう', field: '歯周病', name: 'まさる', age: 52, skin: '#e8b892', hair: '#555555', style: 'boy',
    worry: '「はぐきから ちが でる」', title: 'ししゅうびょうの ちりょう', thanks: 'はぐきが ひきしまって ちが でなくなった！',
    scene0: { m: { boneY: 345, gumY: 262, pocket: 6, gumRed: true } },
    steps: [
      { type: 'choice', scene: 'molar', label: 'けいかく', say: 'まず なにを するか えらぼう', tip: '<b>ほんものでは</b> はぐきの ようすを くわしく しらべてから ちりょうを きめるよ。',
        q: 'はぐきから ちが でる。さいしょに することは？', opts: [
          { t: 'はぐきの「ポケット」の ふかさを はかる', ok: true, why: 'けんさで どれくらい すすんだか しらべる' },
          { t: 'すぐに はを ぬく', why: 'まずは しらべて、なおせる ちりょうから' },
          { t: 'いたみどめを のむだけ', why: 'げんいんの ばいきんを とらないと なおらない' }] },
      { type: 'depth', scene: 'molar', label: 'けんさ', tool: 'cursor', toolName: 'プローブ（はかる どうぐ）', stopAt: 6, green: [5.8, 6.2], max: 10, speed: 3,
        say: 'プローブを はぐきの すきまに いれて、<b>そこで とまる</b>まで すすめよう', tip: '<b>ほんものでは</b> 1ぽんずつ ポケットの ふかさを はかるよ。けんこうなのは <b>3mm いか</b>。',
        okMsg: '6mm！ ふかい ポケット', drawInst: (s, d) => { const x = 107, y0 = 250; ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y0 - 40); ctx.lineTo(x, y0 + 12 + d * 12.7); ctx.stroke(); } },
      { type: 'erase', scene: 'molar', label: 'SRP', tool: 'scaler', toolName: 'スケーラー', snd: 'scrape', rub: true, rate: 0.03, r: 14, color: '#4a3a1a',
        say: 'ポケットの おくの ねっこに ついた <b>しせき</b>を こすって とろう', tip: '<b>ほんものでは</b> ねっこの ひょうめんを つるつるに する「<b>SRP</b>」を するよ。',
        marks: () => [270, 282, 294, 306, 318, 330].map(y => ({ x: 108, y, r: 5, c: '#3a2e14' })) },
      { type: 'choice', scene: 'molar', label: 'はみがき', say: 'おうちで できる ことを えらぼう', tip: '<b>ほんものでは</b> はみがきの しかたを いっしょに れんしゅうするよ。',
        q: 'はぐきを なおすために、おうちで いちばん だいじなのは？', opts: [
          { t: 'はと はぐきの さかいめ と はの あいだ（はかんブラシ）を まいにち みがく', ok: true, why: 'ばいきん（プラーク）を へらすのが いちばん' },
          { t: 'つよく ゴシゴシ みがく', why: 'つよすぎると はぐきを いためる' },
          { t: 'くすりを のむだけ', why: 'プラークを とらないと くりかえす' }] },
      { type: 'hold', scene: 'molar', label: '1かげつご', tool: 'none', toolName: 'じかんが たつ', sec: 2, timeText: '…1かげつご…', hint: 'ボタンを おしたまま まとう',
        say: 'ボタンを おしたまま まとう（はぐきが なおるまで）', tip: '<b>ほんものでは</b> しばらく たってから もういちど けんさする「<b>さいひょうか</b>」を するよ。',
        anim: (s, t) => { s.m.gumRed = t < 0.5; s.m.boneY = 345; s.m.pocket = t < 1 ? 6 - 3 * t : 3; } },
      { type: 'depth', scene: 'molar', label: 'さいけんさ', tool: 'cursor', toolName: 'プローブ', stopAt: 3, green: [2.8, 3.2], max: 10, speed: 3,
        say: 'もういちど はかろう。<b>そこで とまる</b>まで すすめよう', tip: '<b>ほんものでは</b> ふかい ところが のこれば、はぐきの しゅじゅつを することも あるよ。',
        okMsg: '3mm！ ひきしまった！', drawInst: (s, d) => { const x = 107, y0 = 250; ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y0 - 40); ctx.lineTo(x, y0 + 12 + d * 12.7); ctx.stroke(); } }],
    card: { h: 'ししゅうびょう', li: [
      '<b>ししゅうびょう</b>は、はぐきと はを ささえる <b>ほね</b>の びょうき。げんいんは <b>プラーク（ばいきん）</b>。',
      'すすむと ほねが とけて、はが ぐらぐらに なり ぬけて しまう。',
      '<b>ポケット</b>の ふかさを はかる。けんこうの めやすは <b>3mm いか</b>。',
      '<b>SRP</b>で ねっこの しせきを とる。まいにちの はみがきが いちばん だいじ。',
      '<b>たばこ</b>や <b>とうにょうびょう</b>とも かんけいが ふかい。'] } },

  // ===== 心療歯科 =====
  { id: 'a_psy', lv: 1, rank: 'ふつう', field: '心療歯科', name: 'あおい', age: 38, skin: '#f7d8bd', hair: '#2a1a10', style: 'girl',
    worry: '「はいしゃさんが こわい…」', title: 'こわさが つよい かたの しんりょう', thanks: 'こわくなかった。また こられそう',
    scene0: { fear: 95 },
    steps: [
      { type: 'choice', scene: 'chair', label: 'きく', say: 'あおいさんは とても ドキドキ しているよ', tip: '<b>ほんものでは</b> まず はなしを きいて、なにが こわいかを しるよ。',
        q: 'まず どうする？', opts: [
          { t: 'いすに すわったまま、はなしを ゆっくり きく', ok: true, why: 'きもちを きくと すこし あんしん' },
          { t: 'すぐに ちりょうを はじめる', why: 'こわさが ふえてしまう' },
          { t: '「だいじょうぶ！」と いうだけ', why: 'まずは きもちを きこう' }], after: fear(20) },
      { type: 'choice', scene: 'chair', label: 'せつめい', say: 'ちりょうの まえに', tip: '<b>ほんものでは</b>「いって・みせて・やる」（テル・ショウ・ドゥ）で すすめるよ。',
        q: 'なにを するかは どう つたえる？', opts: [
          { t: 'どうぐを みせて、さわって もらい、せつめいしてから やる', ok: true, why: 'わかると こわさが へる' },
          { t: 'めを つぶって もらい、だまって すすめる', why: 'なにを されるか わからないと こわい' }], after: fear(20) },
      { type: 'choice', scene: 'chair', label: 'あいず', say: 'いたい ときの やくそくを きめよう', tip: '<b>ほんものでは</b> あいずを きめると「とめられる」と わかって あんしん できるよ。',
        q: 'いたい ときや つらい ときは？', opts: [
          { t: '「ひだりてを あげたら とめる」と やくそくする', ok: true, why: 'じぶんで とめられると あんしん' },
          { t: 'さいごまで がまん してもらう', why: 'がまんは こわさを ふやす' }], after: fear(15) },
      { type: 'breath', scene: 'chair', label: 'しんこきゅう', tool: 'none', toolName: 'しんこきゅう', say: 'いっしょに <b>しんこきゅう</b>。ボタンを おして すって、はなして はこう（3かい）',
        tip: '<b>ほんものでは</b> ゆっくり いきを すると からだの ちからが ぬけるよ。', anim: s => { s.fear = Math.max(10, s.fear - 8); } },
      { type: 'choice', scene: 'chair', label: 'ほうほう', say: 'それでも こわい ときは？', tip: '<b>ほんものでは</b> くすりで リラックスして うける ほうほうも あるよ。',
        q: 'それでも とても こわい ときは？', opts: [
          { t: 'わらいガス（しょうき）や、ねむくなる くすり（じょうみゃく ないちんせい）で リラックスして うける', ok: true, why: 'こわさを へらす ほうほうが ある' },
          { t: 'むりやり おさえて ちりょうする', why: 'もっと こわく なってしまう' }], after: fear(30) }],
    card: { h: 'しんりょうしか（こわさが つよい かた）', li: [
      'はいしゃさんが こわい かたも、<b>はなしを きく → みせて せつめい → あいずを きめる → すこしずつ</b> すすめる。',
      'ゆっくり <b>しんこきゅう</b> すると、からだの ちからが ぬける。',
      '<b>わらいガス（しょうき ちんせい）</b>や <b>じょうみゃく ないちんせい</b>で リラックスして うける ほうほうも ある。',
      'しんりょうしかでは、こころの ようすが かんけいする くちの いたみや いわかんも みる。'] } },

  // ===== 障害者歯科 =====
  { id: 'a_spec', lv: 1, rank: 'ふつう', field: '障害者歯科', name: 'そら', age: 19, skin: '#f2c9a4', hair: '#1f1f2a', style: 'boy2',
    worry: '「はじめての ばしょは にがて」', title: 'ひとりひとりに あわせた しんりょう', thanks: 'できた！ シール もらったよ',
    scene0: { fear: 80, flags: {} },
    steps: [
      { type: 'choice', scene: 'chair', label: 'じゅんび', say: 'そらさんは はじめての ばしょが にがて', tip: '<b>ほんものでは</b> くる まえに しゃしんや えカードで ようすを つたえるよ。',
        q: 'くる まえに できることは？', opts: [
          { t: 'しゃしんや えカードで、なにを するか まえもって みせる', ok: true, why: 'みとおしが あると あんしん' },
          { t: 'なにも いわずに つれて くる', why: 'わからないと ふあんが ふえる' }], after: fear(20) },
      { type: 'choice', scene: 'chair', label: 'かんきょう', say: 'しんりょうしつの くふう', tip: '<b>ほんものでは</b> おとや ひかりに びんかんな かたも いるので かんきょうを ととのえるよ。',
        q: 'しんりょうしつでは？', opts: [
          { t: 'しずかにして、まぶしい ライトや おおきな おとに きを つける', ok: true, why: 'いやな しげきを へらす' },
          { t: 'にぎやかに おんがくを おおきく ならす', why: 'おとが にがてな かたも いる' }], after: fear(20) },
      { type: 'order', scene: 'chair', label: 'えカード', tool: 'none', toolName: 'えカード', say: 'えカードを <b>じゅんばん</b>に タップして、きょうの ながれを つたえよう',
        tip: '<b>ほんものでは</b> えカードや しゃしんで「つぎに なにを するか」を みせるよ。', q: 'きょうの ながれを じゅんばんに えらぼう',
        items: ['いすに すわる', 'くちを あける', 'はを みがく', 'おわり（シール）'], shuffle: [2, 0, 3, 1], why: 'じゅんばんが わかると あんしん',
        icons: (i, x, y) => { ctx.fillStyle = ['#3cc4b4', '#ff7a8a', '#6cc7f0', '#ffd75e'][i]; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); text(ctx, ['いす', 'あー', 'ブラシ', '★'][i], x, y, 9, '#000'); }, after: fear(20) },
      { type: 'erase', scene: 'archL', label: 'みがく', tool: 'brush', toolName: 'はブラシ', snd: 'brush', rub: true, rate: 0.04, r: 18, color: '#fff2c0',
        say: '<b>みじかい じかん</b>で、やさしく みがこう', tip: '<b>ほんものでは</b> つかれないように みじかく くぎって すすめるよ。',
        marks: () => ['L1', 'R1', 'L3', 'R3', 'L6', 'R6'].map(k => { const t = archTooth('L', k); return { x: t.x, y: t.y, r: 9 }; }) },
      { type: 'choice', scene: 'chair', label: 'ほめる', say: 'できたね！', tip: '<b>ほんものでは</b> できたら すぐに ほめて、つぎも がんばれるように するよ。',
        q: 'できたら どうする？', opts: [{ t: 'すぐに ほめる', ok: true, why: 'つぎも できる じしんに なる' }, { t: 'つぎの ちりょうを すぐ はじめる', why: 'まずは できたことを ほめよう' }], after: fear(30) }],
    card: { h: 'しょうがいしゃ しか', li: [
      'ひとりひとりに あわせて すすめる はいしゃさんの ちりょう。',
      '<b>みとおし</b>を つたえる（えカード・しゃしん）、<b>かんきょう</b>を ととのえる（おと・ひかり）。',
      '<b>みじかく くぎって</b>、できたら <b>すぐ ほめる</b>。',
      'かぞくや しせつの ひとと きょうりょく。ひつようなら <b>ぜんしんますい</b>での ちりょうも ある。'] } },

  // ===== 補綴：クラウン =====
  { id: 'a_crown', lv: 2, rank: 'ボス', field: '補綴', name: 'けいこ', age: 58, skin: '#f2cdb0', hair: '#6a4a3a', style: 'girl',
    worry: '「つめものが とれて はが かけた」', title: 'かぶせもの（クラウン）', thanks: 'じぶんの はみたいに きれい！',
    scene0: { m: { decay: 1 } },
    steps: [
      masui(92, 276),
      { type: 'erase', scene: 'molar', label: 'けずる', tool: 'turbine', toolName: 'タービン', snd: 'drill', scary: true, rate: 3.5, r: 14, color: '#fffaf0',
        say: 'かぶせものが のる ぶん、はの まわりを <b>うすく</b> けずろう', tip: '<b>ほんものでは</b> かぶせものの あつみの ぶんだけ、はを ぐるりと けずるよ（しだいし けいせい）。',
        marks: () => [].concat(dots([[110, 230], [112, 205], [125, 182], [150, 172], [180, 176], [210, 170], [235, 182], [248, 205], [250, 230]], 9, '#f6efe0')), after: s => { s.m.crown = 'prep'; s.m.decay = 0; } },
      { type: 'trace', scene: 'molar', label: 'いと', tool: 'tweezer', toolName: 'あっぱいし（いと）', color: '#3a7bff', say: 'はと はぐきの さかいめに <b>いと</b>を いれよう（なぞる）',
        tip: '<b>ほんものでは</b> はぐきを すこし ひろげて、さかいめまで きれいに かたを とるよ。', pts: [[106, 258], [140, 258], [180, 258], [220, 258], [254, 258]], after: s => { s.m.cord = true; } },
      { type: 'paint', scene: 'molar', label: 'スキャン', tool: 'scanner', toolName: 'こうないスキャナー', snd: 'hum', r: 18, color: 'rgba(80,255,160,.5)',
        say: 'スキャナーで かたちを <b>3D</b>で よみとろう', tip: '<b>ほんものでは</b> データは ぎこうしさんに おくって かぶせものを つくるよ。', region: { x: 100, y: 196, w: 160, h: 70 }, after: s => { s.m.cord = false; } },
      { type: 'drag', scene: 'molar', label: 'かりば', tool: 'tweezer', toolName: 'かりの は', say: 'かぶせものが できるまで <b>かりの は</b>を つけよう', tip: '<b>ほんものでは</b> かりの はで、はを まもり みためと かむ ちからを たもつよ。',
        items: [{ kind: 'crownT', x: 260, y: 505, w: 150, h: 90, trayScale: 0.6, slot: { x: 180, y: 212 } }], after: s => { s.m.crown = 'temp'; } },
      { type: 'choice', scene: 'molar', label: 'つぎの ひ', say: 'かぶせものが できたよ', tip: '<b>ほんものでは</b> ぎこうしさんが 1つずつ てで しあげるよ。',
        q: 'ほんものの かぶせもの。つける まえに することは？', opts: [
          { t: 'かりの はを はずして、ぴったりか・いろ・かみあわせを たしかめる', ok: true, why: 'あわせて みてから つける' },
          { t: 'かりの はの うえから つける', why: 'かりの はを はずさないと はいらない' }], after: s => { s.m.crown = 'prep'; } },
      { type: 'drag', scene: 'molar', label: 'つける', tool: 'tweezer', toolName: 'ジルコニアの かぶせもの', say: '<b>かぶせもの</b>を はめよう',
        tip: '<b>ほんものでは</b> セメントで しっかり つけるよ。', items: [{ kind: 'crownF', x: 100, y: 505, w: 150, h: 90, trayScale: 0.6, slot: { x: 180, y: 212 } }], after: s => { s.m.crown = 'final'; } },
      { type: 'erase', scene: 'molar', label: 'セメント', tool: 'scaler', toolName: 'スケーラー', snd: 'scrape', rub: true, rate: 0.04, r: 14, color: '#ffffff',
        say: 'はみだした <b>セメント</b>を こすって とろう', tip: '<b>ほんものでは</b> セメントが のこると はぐきが はれるので ていねいに とるよ。', marks: dots([[108, 252], [130, 258], [230, 258], [252, 252]], 6, '#f4f4ff') },
      { type: 'erase', scene: 'molar', label: 'かみあわせ', tool: 'turbine', toolName: 'タービン（すこし けずる）', snd: 'drill', rate: 3, r: 12,
        say: 'あかい しるし（<b>たかい ところ</b>）を けずろう', tip: '<b>ほんものでは</b> あかい かみで しらべて、かみあわせを ととのえるよ。', marks: dots([[150, 176], [208, 172]], 6, '#e2245a') }],
    card: { h: 'かぶせもの（クラウン）', li: [
      '<b>クラウン</b>は、はを ぐるりと すこし けずって かぶせる「かぶせもの」。',
      'かたどりは ねんどや <b>こうない スキャナー</b>。<b>ぎこうしさん</b>が つくる。',
      'できるまでは <b>かりの は</b>で まもる。',
      'ざいりょうは <b>きんぞく・セラミック・ジルコニア</b> など。さいごに かみあわせを ととのえる。'] } },

  // ===== 矯正 =====
  { id: 'a_ortho', lv: 2, rank: 'ボス', field: '矯正', name: 'みなと', age: 14, skin: '#f2c9a4', hair: '#2a1a10', style: 'boy2',
    worry: '「はならびが でこぼこ」', title: 'きょうせい（ブラケット）', thanks: 'はならびが きれいに なった！',
    scene0: { align: 0 },
    steps: [
      { type: 'choice', scene: 'front', label: 'けんさ', say: 'きょうせいの はじめに', tip: '<b>ほんものでは</b> しゃしん・レントゲン・はの かたちで けいかくを たてるよ。',
        q: 'はならびの ちりょう。さいしょに することは？', opts: [
          { t: 'しゃしん・レントゲン・はの かたちを しらべて けいかくを たてる', ok: true, why: 'けいかくが いちばん だいじ' },
          { t: 'すぐに そうちを つける', why: 'まず しらべて けいかくから' }] },
      { type: 'paint', scene: 'front', label: 'ボンド', tool: 'swab', toolName: 'ボンド', r: 12, color: 'rgba(255,240,180,.7)', say: 'そうちを つける ところに <b>ボンド</b>を ぬろう',
        tip: '<b>ほんものでは</b> はを きれいにして、くすりで ととのえてから せっちゃくざいを ぬるよ。', region: () => frontTeeth().slice(2, 8).map(t => ({ x: bracketPos(t).x, y: bracketPos(t).y, r: 9 })) },
      { type: 'drag', scene: 'front', label: 'ブラケット', tool: 'tweezer', toolName: 'ブラケット', snd: '', say: '<b>ブラケット</b>を はの まんなかに つけよう（6こ）',
        tip: '<b>ほんものでは</b> ブラケットの いちで はの うごきかたが きまるので、ていねいに おくよ。', snap: 30,
        slots: () => frontTeeth().slice(2, 8).map(t => ({ x: bracketPos(t).x, y: bracketPos(t).y, kind: 'bracket' })),
        items: () => [0, 1, 2, 3, 4, 5].map(i => ({ kind: 'bracket', x: 90 + i * 36, y: 512, w: 26, h: 26 })), after: s => { s.brackets = true; } },
      { type: 'hold', scene: 'front', label: 'かためる', tool: 'light', toolName: 'ひかりの きかい', snd: 'hum', sec: 2, glow: 'rgba(120,170,255,.7)', area: { x: 180, y: 360, r: 60 },
        say: 'ボタンを おしたまま <b>あおい ひかり</b>で かためよう', tip: '<b>ほんものでは</b> 1つずつ ひかりを あてて かためるよ。' },
      { type: 'trace', scene: 'front', label: 'ワイヤー', tool: 'tweezer', toolName: 'ワイヤー', color: '#d8dde6', tol: 16, say: 'ブラケットを じゅんばんに なぞって <b>ワイヤー</b>を とおそう',
        tip: '<b>ほんものでは</b> ワイヤーが もとに もどろうとする ちからで、はを すこしずつ うごかすよ。', pts: () => frontTeeth().slice(2, 8).map(t => [bracketPos(t).x, bracketPos(t).y]), after: s => { s.wire = true; } },
      { type: 'hold', scene: 'front', label: 'つきひ', tool: 'none', toolName: 'じかんが たつ', sec: 3, timeText: '…1ねん たつと…', hint: 'ボタンを おしたまま まとう',
        say: 'ボタンを おしたまま まとう（はが うごく ようすを みよう）', tip: '<b>ほんものでは</b> ちょうせいに かよいながら、ねん たんいで うごかすよ。', anim: (s, t) => { s.align = t; } },
      { type: 'choice', scene: 'front', label: 'ておくれ', say: 'そうちが ついている あいだ', tip: '<b>ほんものでは</b> うごいた あとは リテーナー（ほてい そうち）で もどらないように するよ。',
        q: 'そうちが ついている あいだ、だいじなのは？', opts: [
          { t: 'そうちの まわりを ていねいに みがく', ok: true, why: 'よごれが たまりやすく むしばに なりやすい' },
          { t: 'かたい ものを たくさん たべる', why: 'そうちが とれやすい' }] }],
    card: { h: 'きょうせい', li: [
      'きょうせいは <b>よわい ちから</b>で すこしずつ はを うごかす。',
      '<b>ブラケット＋ワイヤー</b>、<b>マウスピース</b> など いろいろな そうちが ある。',
      'ちりょうは <b>ねん たんい</b>。そうちの まわりは よごれやすいので ていねいに みがく。',
      'うごかした あとは <b>リテーナー</b>で もとに もどらないように する。'] } },

  // ===== 訪問診療 =====
  { id: 'a_visit', lv: 2, rank: 'ボス', field: '訪問診療', name: 'ちよ', age: 88, skin: '#f2d2b6', hair: '#d8d8d8', style: 'girl',
    worry: '「いればが いたくて たべられない」', title: 'ほうもん しんりょう', thanks: 'いたくない！ ごはんが おいしいよ',
    scene0: { bedUp: 0, flags: { R2: ['missing'], R4: ['missing'], R5: ['missing'], R6: ['missing'], R7: ['missing'], L2: ['missing'], L5: ['missing'], L6: ['missing'], L7: ['missing'] } },
    steps: [
      { type: 'choice', scene: 'room', label: 'じゅんび', say: 'ちよさんの おうちに いくよ', tip: '<b>ほんものでは</b> もちはこべる きかいを くるまに つんで いくよ。',
        q: 'もっていく ものは？', opts: [
          { t: 'もちはこべる ちりょうの きかい・ライト・すいとる きかい', ok: true, why: 'おうちでも ちりょう できる' },
          { t: 'しんりょうだいを まるごと', why: 'おおきすぎて はこべない' }] },
      { type: 'choice', scene: 'room', label: 'しせい', say: 'ちりょうや ごはんの ときの しせい', tip: '<b>ほんものでは</b> むせないように しせいを ととのえるよ。',
        q: 'どんな しせいが いい？', opts: [
          { t: 'からだを おこして、あごを すこし ひく', ok: true, why: 'のみこみやすく むせにくい' },
          { t: 'あおむけで あごを あげる', why: 'むせやすく きけん' }], after: s => { s.bedUp = 1; } },
      { type: 'erase', scene: 'denture', label: 'いれば', tool: 'engine', toolName: 'けずる きかい', snd: 'engine', rate: 2.5, r: 14, color: '#e2245a',
        say: 'いればの あかい ところ（<b>あたって いたい ところ</b>）を けずろう', tip: '<b>ほんものでは</b> とくべつな ペーストで あたる ところを しらべて けずるよ。',
        marks: dots([[110, 300], [250, 296], [180, 205]], 9, '#e2245a') },
      { type: 'erase', scene: 'archL', label: 'こうくうケア', tool: 'brush', toolName: 'スポンジブラシ', snd: 'brush', rub: true, rate: 0.04, r: 18, color: '#fff2c0',
        say: 'のこっている はと はぐきを やさしく <b>きれいに</b> しよう', tip: '<b>ほんものでは</b> くちの なかを きれいにして、ばいきんを へらすよ。',
        marks: () => ['L1', 'L3', 'L4', 'R3', 'R1'].map(k => { const t = archTooth('L', k); return { x: t.x, y: t.y, r: 9 }; }) },
      { type: 'choice', scene: 'room', label: 'ておくれ', say: 'いればの ておくれ', tip: '<b>ほんものでは</b> かぞくや かいごの かたにも つたえるよ。',
        q: 'いればの ておくれは？', opts: [
          { t: 'まいにち はずして あらう（ねる ときは はずす）', ok: true, why: 'いればにも ばいきんが つく' },
          { t: 'ずっと つけたまま', why: 'ばいきんが ふえて しまう' }] }],
    card: { h: 'ほうもん しんりょう', li: [
      'かよう ことが むずかしい かたの <b>おうちや しせつ</b>に、はいしゃさんが いく。',
      'いればの ちょうせい・<b>こうくうケア</b>・のみこみの チェック。',
      'くちを きれいに すると <b>ごえんせい はいえん</b>の よぼうに やくだつ。',
      'たべる ときは <b>からだを おこして あごを ひく</b>。'] } },

  // ===== 顎関節症 =====
  { id: 'a_tmj', lv: 2, rank: 'ボス', field: '顎関節症', name: 'まい', age: 29, skin: '#f7d8bd', hair: '#3a2416', style: 'girl',
    worry: '「くちが あかない・カクカク なる」', title: 'がくかんせつしょうの ちりょう', thanks: 'あごが らくに なった！',
    scene0: { open: 0 },
    steps: [
      { type: 'hold', scene: 'face', label: 'はかる', tool: 'none', toolName: 'ものさし', sec: 2, hint: 'ボタンを おしたまま',
        say: 'ボタンを おしたまま、<b>くちを あけて もらおう</b>（どこまで あくか はかる）', tip: '<b>ほんものでは</b> まえばと まえばの あいだを ものさしで はかるよ。', anim: (s, t) => { s.open = 28 * t; } },
      { type: 'choice', scene: 'face', label: 'しんだん', say: '28mm しか あかなかった', tip: '<b>ほんものでは</b> いたみ・おと・あきかたを しらべて しんだんするよ。',
        q: 'ふつうは ゆび 3ぼん（やく 40mm）くらい あく。28mm は？', opts: [{ t: 'あきにくい', ok: true, why: 'あごの かんせつや きんにくに ふたんが ある' }, { t: 'ふつう', why: '40mm くらいが めやす' }] },
      { type: 'tap', scene: 'face', label: 'かんせつ', tool: 'cursor', toolName: 'ゆびで さわる', say: '「カクカク」いう <b>あごの かんせつ</b>を さがそう（みみの まえ）',
        tip: '<b>ほんものでは</b> みみの まえを さわりながら くちを あけて もらうよ。', wrong: 'もっと みみの ちかく',
        targets: () => FC.tmj.map((p, i) => ({ id: 't' + i, x: p.x, y: p.y, r: 22, ok: true, msg: 'ここが あごの かんせつ' })) },
      { type: 'drag', scene: 'face', label: 'スプリント', tool: 'tweezer', toolName: 'スプリント（マウスピース）', say: '<b>スプリント</b>を うえの はに はめよう',
        tip: '<b>ほんものでは</b> ねている あいだに つけて、くいしばりの ふたんを へらすよ。', before: s => { s.open = 20; },
        items: [{ kind: 'splint', x: 180, y: 500, w: 90, h: 30, slot: { x: 180, y: 348 } }], after: s => { s.splint = true; } },
      { type: 'trace', scene: 'face', label: 'くんれん', tool: 'cursor', toolName: 'くんれん', slow: true, tol: 16, color: '#6fd3ff', say: '<b>ゆっくり</b> なぞって、くちを あけしめする れんしゅう',
        tip: '<b>ほんものでは</b> むりのない はんいで、ゆっくり あける ストレッチを するよ。', before: s => { s.open = 20; },
        pts: [[180, 300], [180, 330], [180, 360], [180, 390], [180, 420], [180, 390], [180, 360], [180, 330], [180, 300]] },
      { type: 'choice', scene: 'face', label: 'くらし', say: 'ふだんの くらしで', tip: '<b>ほんものでは</b> せいかつの くせを いっしょに みなおすよ。',
        q: 'ふだん きを つけることは？', opts: [
          { t: 'ほおづえを しない・はを くいしばらない・かたい ものを ひかえる', ok: true, why: 'あごの ふたんが へる' },
          { t: 'ガムを 1にちじゅう かむ', why: 'あごが つかれて しまう' }] }],
    card: { h: 'がくかんせつしょう', li: [
      'あごの <b>かんせつ</b>や <b>きんにく</b>の ふちょう。カクカク おと・いたみ・くちが あきにくい。',
      'ふつうは ゆび 3ぼん（やく <b>40mm</b>）くらい あく。',
      '<b>くいしばり・はぎしり・ストレス・しせい</b> などが かんけい。',
      'おおくは <b>スプリント</b>・せいかつの くふう・ストレッチで よくなる。'] } },

  // ===== 歯内療法 =====
  { id: 'a_endo', lv: 3, rank: 'だいボス', field: '歯内療法', name: 'たける', age: 41, skin: '#e8b892', hair: '#1f1f2a', style: 'boy2',
    worry: '「ズキズキ いたくて ねむれない」', title: 'ねっこの ちりょう（こんかん ちりょう）', thanks: 'いたみが ひいた！ ぐっすり ねむれる',
    scene0: { m: { decay: 2, pulp: 'red', lesion: true } },
    steps: [
      { type: 'tap', scene: 'molar', xray: true, label: 'レントゲン', tool: 'cursor', toolName: 'レントゲン', say: 'レントゲンで ねっこの さきの <b>くろい かげ</b>（うみ）を さがそう',
        tip: '<b>ほんものでは</b> ばいきんが ねっこの さきまで いくと、ほねが とけて くろく うつるよ。', wrong: 'ねっこの さきを みてみよう',
        targets: () => [{ id: 'a', x: MO.cx - MO.w * 0.55, y: MO.apex + 2, r: 26, ok: true, msg: 'うみの かげ！' }, { id: 'b', x: MO.cx + MO.w * 0.55, y: MO.apex + 2, r: 26, ok: true, msg: 'うみの かげ！' }, { id: 'p', x: MO.cx, y: 230, r: 24, ok: false, msg: 'しんけいの へや（しずい）' }] },
      masui(92, 276),
      { type: 'drag', scene: 'molar', label: 'ラバーダム', tool: 'tweezer', toolName: 'ラバーダム（ゴムの シート）', say: '<b>ゴムの シート</b>を かけて、つばが はいらないように しよう',
        tip: '<b>ほんものでは</b> つばの ばいきんが ねっこに はいらないように「<b>ラバーダム</b>」を つかうよ。', items: [{ kind: 'dam', x: 180, y: 500, w: 220, h: 80, trayScale: 0.6, slot: { x: 180, y: 262 } }], after: s => { s.m.dam = true; } },
      { type: 'erase', scene: 'molar', label: 'あける', tool: 'turbine', toolName: 'タービン', snd: 'drill', scary: true, rate: 4, r: 14, color: '#3b2414',
        say: 'むしばを とって、しんけいの へやの <b>やね</b>を あけよう', tip: '<b>ほんものでは</b> ねっこの いりぐちが ぜんぶ みえるように あけるよ（ずいくう かいかく）。',
        marks: () => grid(160, 176, 200, 250, 9).map(p => ({ x: p.x, y: p.y, r: 6, c: '#5a3a22' })), after: s => { s.m.decay = 0; s.m.access = true; s.m.pulp = 'opened'; } },
      { type: 'depth', scene: 'molar', label: 'ながさ', tool: 'cursor', toolName: 'ファイル＋そくていき', snd: '', green: [19.5, 20.7], bad: 21.4, max: 24, speed: 4, beep: true, scary: true,
        say: 'ファイルを ねっこに いれて、<b>ピピピ</b>と なる ところ（みどり）で とめよう', tip: '<b>ほんものでは</b> でんきの そくていきと レントゲンで、ねっこの ながさを はかるよ。',
        overMsg: 'ねっこの さきを つきぬけた！', okMsg: 'ながさ ぴったり！',
        drawInst: (s, d) => { const cn = canals(MO.cx, MO.cej, MO.apex, MO.w)[0], t = clamp(d / 21, 0, 1.06), x = lerp(cn[0][0], cn[2][0], t), y = lerp(MO.top + 20, cn[2][1], t); ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(MO.cx - 16, MO.top - 30); ctx.lineTo(x, y); ctx.stroke(); } },
      { type: 'erase', scene: 'molar', label: 'きれいに', tool: 'file', toolName: 'ファイル', snd: 'engine', rub: true, rate: 0.035, r: 14, color: '#7a5030',
        say: 'ねっこの なかを こすって <b>ばいきん</b>を とろう', tip: '<b>ほんものでは</b> ファイルで ひろげながら、くすりの みずで あらうよ。',
        marks: () => { const o = []; for (const cn of canals(MO.cx, MO.cej, MO.apex, MO.w)) for (let i = 1; i <= 5; i++) { const t = i / 6; o.push({ x: lerp(cn[0][0], cn[2][0], t), y: lerp(cn[0][1], cn[2][1], t), r: 5, c: '#7a5030' }); } return o; }, after: s => { s.m.pulp = 'clean'; } },
      { type: 'paint', scene: 'molar', label: 'つめる', tool: 'syringe', toolName: 'こんかん じゅうてん ざい', r: 12, color: 'rgba(255,138,58,.85)',
        say: 'ねっこの なかを <b>すきま なく</b> つめよう', tip: '<b>ほんものでは</b> ゴムの ような ざいりょうで ねっこの さきまで ぴったり つめるよ（こんかん じゅうてん）。',
        region: () => { const r = []; for (const cn of canals(MO.cx, MO.cej, MO.apex, MO.w)) for (let i = 0; i <= 8; i++) { const t = i / 8; r.push({ x: lerp(cn[0][0], cn[2][0], t), y: lerp(cn[0][1], cn[2][1], t), r: 9 }); } return r; }, after: s => { s.m.pulp = 'gp'; } },
      { type: 'choice', scene: 'molar', label: 'このあと', say: 'ねっこの ちりょうが おわったよ', tip: '<b>ほんものでは</b> ねっこの ちりょうを した はは もろいので かぶせもので まもるよ。',
        q: 'このあと はを まもるには？', opts: [{ t: 'どだいを たてて、かぶせものを する', ok: true, why: 'もろく なった はを まもる' }, { t: 'あなを あけたまま', why: 'ばいきんが また はいる' }] }],
    card: { h: 'ねっこの ちりょう（こんかん ちりょう）', li: [
      'はの しんけい（<b>しずい</b>）に ばいきんが はいると いたむ → <b>こんかん ちりょう</b>。',
      '<b>ラバーダム</b>で つばの ばいきんを ふせぐ。',
      'ねっこの ながさを <b>でんきの そくていき</b>と レントゲンで はかる。',
      'なかを きれいに して <b>すきま なく つめる</b>（こんかん じゅうてん）。さいごは かぶせもので まもる。'] } },

  // ===== 口腔外科：親知らず =====
  { id: 'a_wisdom', lv: 3, rank: 'だいボス', field: '口腔外科', name: 'はるか', age: 23, skin: '#f7d8bd', hair: '#4a2a1a', style: 'girl',
    worry: '「おくの はぐきが はれて いたい」', title: 'よこむきの おやしらずを ぬく', thanks: 'すっきり！ もう はれないね',
    scene0: { w: {} },
    steps: [
      { type: 'tap', scene: 'wisdom', xray: true, label: 'レントゲン', tool: 'cursor', toolName: 'レントゲン', need: 2, say: '<b>おやしらず</b>と <b>しんけいの くだ</b>を さがそう（2つ）',
        tip: '<b>ほんものでは</b> レントゲンや CT で、おやしらずと しんけいの きょりを たしかめるよ。',
        targets: () => [{ id: 'w', x: 255, y: 345, rx: 60, ry: 42, ok: true, msg: 'よこむきの おやしらず！' }, { id: 'n', x: 180, y: 456, rx: 170, ry: 14, ok: true, msg: 'しんけいの くだ。きずつけない！' }] },
      masui(70, 282),
      { type: 'trace', scene: 'wisdom', label: 'きる', tool: 'scalpel', toolName: 'メス', color: '#ff5a6e', say: 'はぐきを <b>メス</b>で きろう（なぞる）', scary: true,
        tip: '<b>ほんものでは</b> ほねと はが みえるように はぐきを ひらくよ。', pts: [[176, 286], [210, 286], [250, 286], [290, 286], [330, 286]], after: s => { s.w.flap = true; } },
      { type: 'erase', scene: 'wisdom', label: 'ほね', tool: 'turbine', toolName: 'けずる きかい', snd: 'drill', scary: true, rate: 3.5, r: 14, color: '#efd2bd',
        say: 'おやしらずに かぶさる <b>ほね</b>を すこし けずろう。<b>しんけいには ちかづかない</b>', tip: '<b>ほんものでは</b> けずる ほねは できるだけ すくなく するよ。',
        marks: dots([[195, 306], [225, 309], [255, 312], [285, 313], [315, 311]], 8, '#e6c8b0'), avoid: [{ x: 180, y: 456, r: 30, msg: 'しんけいに ちかすぎ！' }, { x: 100, y: 456, r: 30, msg: 'しんけいに ちかすぎ！' }, { x: 260, y: 456, r: 30, msg: 'しんけいに ちかすぎ！' }], after: s => { s.w.boneCut = true; } },
      { type: 'trace', scene: 'wisdom', label: 'わける', tool: 'turbine', toolName: 'けずる きかい', snd: 'drill', color: '#4a1622', say: 'はを <b>2つに わけよう</b>（たてに なぞる）',
        tip: '<b>ほんものでは</b> はを わけて ちいさく すると、ほねを けずる りょうが すくなく すむよ。', pts: [[257, 298], [257, 322], [257, 346], [257, 370], [257, 392]], after: s => { s.w.split = true; } },
      { type: 'drag', scene: 'wisdom', label: 'とりだす', tool: 'forceps', toolName: 'ししかん（はを つかむ）', say: 'わけた はを 1つずつ <b>トレー</b>へ とりだそう',
        tip: '<b>ほんものでは</b> ちいさく した はを 1つずつ ていねいに とりだすよ。', snap: 50,
        items: [{ kind: 'piece1', x: 225, y: 345, w: 64, h: 70, slot: { x: 260, y: 160 } }, { kind: 'piece2', x: 290, y: 345, w: 64, h: 70, slot: { x: 320, y: 160 } }], after: s => { s.w.out = true; } },
      { type: 'trace', scene: 'wisdom', label: 'ぬう', tool: 'needle', toolName: 'はりと いと', color: '#3a3a9a', tol: 16, say: 'はぐきを <b>ぬいあわせよう</b>（ジグザグに なぞる）',
        tip: '<b>ほんものでは</b> 1しゅうかんくらいで いとを とるよ。', pts: [[190, 272], [205, 290], [220, 272], [235, 290], [250, 272], [265, 290], [280, 272], [295, 290], [310, 272]], after: s => { s.w.sutured = true; } },
      { type: 'hold', scene: 'wisdom', label: 'ガーゼ', tool: 'gauze', toolName: 'ガーゼ', sec: 3, area: { x: 255, y: 285, r: 40 },
        say: 'ガーゼを かんで もらって <b>ちを とめよう</b>（ボタンを おしたまま）', tip: '<b>ほんものでは</b> ぬいた あと つよい うがいを しない ように つたえるよ（ちの かたまりを まもる）。' }],
    card: { h: 'おやしらず', li: [
      '<b>おやしらず</b>（だい3だいきゅうし）は 20さい まえごに はえる、いちばん おくの は。',
      'よこむき・はんぶん うまっていると <b>はれやすい</b>。',
      'したの おやしらずの ちかくには <b>しんけいの くだ</b> → レントゲンや CT で いちを かくにん。',
      'はを <b>わけて</b> とりだすと ほねを けずる りょうが すくない。ぬいた あとは <b>つよい うがいを しない</b>。'] } },

  // ===== インプラント =====
  { id: 'a_implant', lv: 3, rank: 'だいボス', field: 'インプラント', name: 'ひろし', age: 61, skin: '#e8b892', hair: '#7a7a7a', style: 'boy',
    worry: '「おくばが 1ぽん ない」', title: 'インプラント', thanks: 'しっかり かめる！ じぶんの はみたい',
    scene0: { i: {} },
    steps: [
      { type: 'tap', scene: 'implant', xray: true, label: 'CT', tool: 'cursor', toolName: 'CT', say: 'CT で <b>しんけいの くだ</b>を さがそう', tip: '<b>ほんものでは</b> CT で ほねの りょうと、しんけい・けっかんの いちを 3D で しらべるよ。',
        targets: () => [{ id: 'n', x: 180, y: 481, rx: 170, ry: 16, ok: true, msg: 'しんけいの くだ！' }] },
      { type: 'choice', scene: 'implant', xray: true, label: 'ながさ', say: 'インプラントの ながさを きめよう', tip: '<b>ほんものでは</b> しんけいまで 2mm いじょう よゆうを のこすのが めやす。',
        q: 'ほねの たかさは 12.5mm。しんけいまで よゆうを のこすと、インプラントの ながさは？', opts: [
          { t: '10mm', ok: true, why: 'しんけいまで 2mm いじょう よゆうが ある' }, { t: '13mm', why: 'しんけいに とどいて しまう！' }, { t: '6mm', why: 'みじかすぎて ささえが よわい' }] },
      masui(110, 270),
      { type: 'trace', scene: 'implant', label: 'きる', tool: 'scalpel', toolName: 'メス', scary: true, color: '#ff5a6e', say: 'はぐきを <b>メス</b>で きろう（なぞる）', tip: '<b>ほんものでは</b> ほねが みえるように はぐきを ひらくよ。',
        pts: [[110, 246], [145, 244], [180, 242], [215, 244], [250, 246]], after: s => { s.i.flap = true; } },
      { type: 'depth', scene: 'implant', label: 'ドリル', tool: 'cursor', toolName: 'インプラント ドリル', snd: 'engine', green: [9.6, 10.4], bad: 11.6, max: 13, speed: 2.5, scary: true,
        say: 'ドリルで <b>10mm</b>（みどり）まで あなを あけよう。<b>ふかすぎは きけん！</b>', tip: '<b>ほんものでは</b> ガイドを つかい、ふかさを みながら すこしずつ すすめるよ。',
        overMsg: 'ふかすぎ！しんけいに ちかい', okMsg: '10mm ぴったり！', live: (s, d) => { s.i.hole = d; },
        drawInst: (s, d) => { const y = IM.crest + d * IM.ppm; ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(IM.cx, IM.crest - 60); ctx.lineTo(IM.cx, y); ctx.stroke(); ctx.fillStyle = '#d8c27a'; rr(ctx, IM.cx - 13, IM.crest - 130, 26, 72, 8); ctx.fill(); ctx.fillStyle = '#9aa7b2'; ctx.beginPath(); ctx.arc(IM.cx, IM.crest - 58, 11, 0, Math.PI * 2); ctx.fill(); }, after: s => { s.i.hole = 10; } },
      { type: 'order', scene: 'implant', label: 'ひろげる', tool: 'none', toolName: 'ドリル', say: 'あなを すこしずつ ひろげよう。<b>ほそい じゅん</b>に えらぼう',
        tip: '<b>ほんものでは</b> ほねを いためないように、ほそい ドリルから じゅんばんに つかうよ。', q: 'ドリルを ほそい じゅんに えらぼう',
        items: ['2.0mm', '2.8mm', '3.5mm'], shuffle: [2, 0, 1], why: 'ほそい ほうから じゅんばんに', after: s => { s.i.wide = 15; } },
      { type: 'hold', scene: 'implant', label: 'うめる', tool: 'implantdrill', toolName: 'インプラント', snd: 'engine', sec: 3, area: { x: 180, y: 300, r: 50 },
        say: 'ボタンを おしたまま <b>インプラント</b>を ねじこもう', tip: '<b>ほんものでは</b> ゆっくり まわして ほねの なかに うめるよ。', anim: (s, t) => { s.i.fix = 10 * t; } },
      { type: 'trace', scene: 'implant', label: 'ぬう', tool: 'needle', toolName: 'はりと いと', color: '#3a3a9a', tol: 16, say: 'はぐきを <b>ぬいあわせよう</b>（ジグザグ）', tip: '<b>ほんものでは</b> はぐきで インプラントを おおって やすませるよ。',
        pts: [[130, 232], [145, 250], [160, 232], [175, 250], [190, 232], [205, 250], [220, 232]], after: s => { s.i.sutured = true; s.i.flap = false; } },
      { type: 'hold', scene: 'implant', label: 'まつ', tool: 'none', toolName: 'じかんが たつ', sec: 2, timeText: '…3〜6かげつ…', hint: 'ボタンを おしたまま まとう',
        say: 'ボタンを おしたまま まとう（<b>ほねと くっつく</b>まで）', tip: '<b>ほんものでは</b> ほねと インプラントが しっかり くっつくまで まつよ。', anim: (s, t) => { if (t >= 1) s.i.osseo = true; } },
      { type: 'drag', scene: 'implant', label: 'かぶせる', tool: 'tweezer', toolName: 'かぶせもの', say: 'インプラントに <b>かぶせもの</b>を つけよう', tip: '<b>ほんものでは</b> つなぎの ぶひんを つけて かぶせものを のせるよ。',
        items: [{ kind: 'crownI', x: 270, y: 505, w: 100, h: 80, trayScale: 0.7, slot: { x: 180, y: 196 } }], after: s => { s.i.crown = true; } }],
    card: { h: 'インプラント', li: [
      '<b>インプラント</b>は、あごの ほねに うめる <b>チタン</b>の じんこうの ねっこ。',
      '<b>CT</b> で ほねの りょうと <b>しんけい</b>の いちを しらべて ながさを きめる。',
      'ほねと くっつく（<b>オッセオインテグレーション</b>）まで <b>すうかげつ</b> まつ。',
      'ておくれを しないと <b>インプラント しゅういえん</b>に なる。ていきてきな けんしんが だいじ。'] } },

  // ===== オールオン4 =====
  { id: 'a_allon4', lv: 4, rank: 'ラスボス', field: 'オールオン4', name: 'しげる', age: 70, skin: '#e8b892', hair: '#cfcfcf', style: 'boy',
    worry: '「はが ほとんど ない」', title: 'オールオン4', thanks: 'その日の うちに はが はいった！',
    scene0: { pa: {} },
    steps: [
      { type: 'tap', scene: 'pano', label: 'しんけい', tool: 'cursor', toolName: 'レントゲン', need: 2, say: 'あごの しんけいの でぐち「<b>オトガイこう</b>」を 2つ さがそう',
        tip: '<b>ほんものでは</b> CT で しんけいの でぐちの いちを たしかめて けいかくするよ。', wrong: 'くろい まるい あなを さがそう',
        targets: () => PANO.fora.map((f, i) => ({ id: 'f' + i, x: f.x, y: f.y, r: 22, ok: true, msg: 'オトガイこう！' })) },
      { type: 'choice', scene: 'pano', label: 'けいかく', say: 'うしろの 2ほんの いれかた', tip: '<b>ほんものでは</b> うしろの インプラントを ななめに して、ほねを ながく つかうよ。',
        q: 'うしろの 2ほんは どう いれる？', opts: [
          { t: 'ななめに いれて、しんけいを さけながら ほねを ながく つかう', ok: true, why: 'オールオン4 の ポイント' },
          { t: 'まっすぐ ふかく いれる', why: 'しんけいに あたって しまう' }] },
      { type: 'drag', scene: 'pano', label: 'うめる', tool: 'implantdrill', toolName: 'インプラント', say: 'インプラントを <b>4ほん</b> いれよう（うしろの 2ほんは ななめ）',
        tip: '<b>ほんものでは</b> まえの 2ほんは まっすぐ、うしろの 2ほんは ななめに いれるよ。', snap: 40,
        slots: () => PANO.slots.map(s => ({ x: s.x, y: s.y, ang: s.ang, kind: 'implant' })), items: () => [0, 1, 2, 3].map(i => ({ kind: 'implant', x: 90 + i * 60, y: 410, w: 30, h: 60, trayScale: 0.5 })), after: s => { s.pa.fix = true; } },
      { type: 'drag', scene: 'pano', label: 'かりば', tool: 'tweezer', toolName: 'かりの は（ブリッジ）', say: 'その日の うちに <b>かりの は</b>を のせよう',
        tip: '<b>ほんものでは</b> じょうけんが あえば しゅじゅつの 日に かりの はが はいるよ（そくじ かじゅう）。', snap: 50,
        items: [{ kind: 'bridge', x: 180, y: 520, w: 280, h: 40, trayScale: 0.7, slot: { x: 180, y: 246 } }], after: s => { s.pa.bridge = true; } },
      { type: 'choice', scene: 'pano', label: 'そのあと', say: 'これからの ておくれ', tip: '<b>ほんものでは</b> ていきてきに はずして そうじや チェックを するよ。',
        q: 'これから だいじな ことは？', opts: [{ t: 'まいにちの みがきと、ていきてきな けんしん', ok: true, why: 'インプラントを ながもち させる' }, { t: 'はいったら もう かよわなくて いい', why: 'メンテナンスが だいじ' }] }],
    card: { h: 'オールオン4', li: [
      '<b>4ほん</b>の インプラントで、1つの あご ぜんぶの はを ささえる ほうほう。',
      'うしろの 2ほんを <b>ななめ</b>に いれて、ほねの おおい ところを つかい <b>しんけい</b>を さける。',
      'じょうけんが あえば <b>しゅじゅつの 日</b>に かりの はが はいる。',
      'ながもち させるには <b>ていきてきな メンテナンス</b>。'] } },

  // ===== ザイゴマ =====
  { id: 'a_zygoma', lv: 4, rank: 'ラスボス', field: 'ザイゴマ', name: 'ふみこ', age: 74, skin: '#f2d2b6', hair: '#bdbdbd', style: 'girl',
    worry: '「うえの ほねが やせて いればも あわない」', title: 'ザイゴマ インプラント', thanks: 'うえの はで しっかり かめる！',
    scene0: { zy: {} },
    steps: [
      { type: 'tap', scene: 'skull', label: 'しらべる', tool: 'cursor', toolName: 'CT', say: 'うわあごの <b>じょうがくどう</b>（くうきの へや）を さがそう',
        tip: '<b>ほんものでは</b> CT で ほねの あつみと じょうがくどうの ひろがりを しらべるよ。', wrong: 'うわあごの おくの くらい ところ',
        targets: () => [{ id: 's', x: 205, y: 330, rx: 42, ry: 34, ok: true, msg: 'くうきの へや（じょうがくどう）。ほねが うすい' }, { id: 'z', x: 250, y: 282, rx: 46, ry: 20, ok: false, msg: 'それは ほおぼね（きょうこつ）' }] },
      { type: 'choice', scene: 'skull', label: 'けいかく', say: 'どう ささえるか えらぼう', tip: '<b>ほんものでは</b> ほねを ふやす しゅじゅつを さけられる ことも あるよ。',
        q: 'うえの ほねが うすくて、ふつうの インプラントは むり。どうする？', opts: [
          { t: 'ほおぼね（きょうこつ）まで とどく ながい インプラントで ささえる', ok: true, why: 'かたい ほおぼねで しっかり ささえる' },
          { t: 'うすい ほねに むりやり いれる', why: 'ささえられず ぬけて しまう' }] },
      { type: 'trace', scene: 'skull', label: 'ねらう', tool: 'implantdrill', toolName: 'ガイド', color: '#ffd75e', say: 'いりぐちから <b>ほおぼね</b>まで ねらいを さだめよう（なぞる）',
        tip: '<b>ほんものでは</b> CT の けいかくどおりの かくどで すすめるよ。', pts: () => { const o = []; for (let i = 0; i <= 5; i++) o.push([lerp(ZY.e.x, ZY.z.x, i / 5), lerp(ZY.e.y, ZY.z.y, i / 5)]); return o; } },
      { type: 'depth', scene: 'skull', label: 'うめる', tool: 'cursor', toolName: 'ザイゴマ インプラント', snd: 'engine', green: [42, 48], bad: 51, max: 55, speed: 8, scary: true,
        say: 'ほおぼねに とどく まで（みどり）すすめよう。<b>つきぬけない</b>ように！', tip: '<b>ほんものでは</b> とても ながい インプラント（やく 30〜50mm）を つかうよ。',
        overMsg: 'ほおぼねを つきぬける！', okMsg: 'ほおぼねに とどいた！', live: (s, d) => { s.zy.depth = d; },
        drawInst: () => { ctx.fillStyle = '#d8c27a'; ctx.save(); ctx.translate(ZY.e.x, ZY.e.y); ctx.rotate(Math.atan2(ZY.e.y - ZY.z.y, ZY.e.x - ZY.z.x) - Math.PI / 2); rr(ctx, -12, 14, 24, 70, 8); ctx.fill(); ctx.restore(); }, after: s => { s.zy.depth = 46; } },
      { type: 'drag', scene: 'skull', label: 'かりば', tool: 'tweezer', toolName: 'うえの ブリッジ', say: '<b>うえの は</b>を のせよう', tip: '<b>ほんものでは</b> まえの インプラントと くみあわせて うえの はを ささえるよ。', snap: 50,
        items: [{ kind: 'bridgeU', x: 180, y: 520, w: 280, h: 40, trayScale: 0.6, slot: { x: 205, y: 412 } }], after: s => { s.zy.bridge = true; } }],
    card: { h: 'ザイゴマ インプラント', li: [
      'うわあごの ほねが おおきく やせた とき、<b>ほおぼね（きょうこつ）</b>まで とどく ながい インプラントで ささえる ほうほう。',
      'うわあごには <b>じょうがくどう</b>（くうきの へや）が あり、ほねが うすく なりやすい。',
      'CT での ていねいな けいかくと <b>たかい ぎじゅつ</b>が ひつよう。',
      'ほねを ふやす しゅじゅつを さけられる ことが ある。'] } },
];

// ---------- とうろく ----------
for (const cs of CASES) {
  cs.kind = 'case'; cs.cat = 'adult'; cs.hon = cs.hon || 'さん'; cs.cardObj = cs.card; cs.card = null;
  cs.steps = cs.steps.map((sd, i) => { const key = cs.id + '_' + i; STEPS[key] = Object.assign({ view: 'case', toolName: '', tip: '', label: '' }, sd, { view: 'case' }); if (!STEPS[key].tool) STEPS[key].tool = 'cursor'; if (!STEPS[key].toolName) STEPS[key].toolName = { choice: 'コマンド', order: 'じゅんばん', tap: 'さがす', breath: 'しんこきゅう' }[sd.type] || 'ちりょう'; return key; });
  PATIENTS.push(cs);
}
Object.assign(C.CASE, { patient: startCasePatient, init, update, draw, tap, progress, isTap, drawTool, state: () => ({ S, E }), dbg: { choiceRows, orderCards } });
})();
