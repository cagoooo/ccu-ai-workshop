/* 圓面積動畫頁：把圓切成 8 片扇形，上下交錯排成近似長方形（GSAP 時間軸、靜音） */
(function () {
  const svg = document.getElementById('circle-svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const R = 110;
  const HALF = 22.5;                     // 每片扇形的半角
  const CX = 300, CY = 168;              // 圓心
  const S = (Math.PI * R) / 8;           // 每片扇形弧長的一半
  const X0 = CX - 4.5 * S;               // 排成一列時的左端
  const YT = 105;                        // 排成一列時的上緣

  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    parent.appendChild(n);
    return n;
  };
  const rad = (d) => (d * Math.PI) / 180;
  const p = (deg) => `${(R * Math.cos(rad(deg))).toFixed(2)} ${(R * Math.sin(rad(deg))).toFixed(2)}`;
  // 頂點在原點、朝下（90°）的扇形
  const SECTOR = `M0 0 L${p(90 - HALF)} A${R} ${R} 0 0 1 ${p(90 + HALF)} Z`;

  const ghost = el('circle', { cx: CX, cy: CY, r: R, class: 'cd-ghost' });
  // 用純數值物件記錄每片扇形的位置與角度，每格畫面自己寫入 transform（避開 SVG 旋轉原點的位移補償）
  const near = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180;   // 走最短的旋轉方向
  const sectors = [];
  for (let i = 0; i < 8; i++) {
    const node = el('path', { d: SECTOR, class: i < 4 ? 'cd-a' : 'cd-b' });
    const dir = i * 45 + HALF;           // 在圓中的方向
    const lower = i < 4;                 // 下半圓 4 片 → 排列時尖端朝上；上半圓 4 片 → 尖端朝下
    const k = lower ? i : i - 4;
    const start = dir - 90;
    sectors.push({
      node,
      circle: { x: CX, y: CY, r: start },
      burst: { x: CX + 16 * Math.cos(rad(dir)), y: CY + 16 * Math.sin(rad(dir)), r: start },
      row: lower
        ? { x: X0 + 2 * S * (k + 1), y: YT + R, r: near(start, 180) }   // 尖端在下、弧在上
        : { x: X0 + S + 2 * S * k, y: YT, r: near(start, 0) },           // 尖端在上、弧在下
    });
  }
  // GSAP 會逐一補間字串裡的數字，所以直接補間 transform 屬性，播放與跳轉都正確
  const tf = (o) => `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)}) rotate(${o.r.toFixed(2)})`;

  const label = (x, y, text, cls) => { const t = el('text', { x, y, class: cls }); t.textContent = text; return t; };
  const tR = label(CX + 10, CY - 8, '半徑 r', 'cd-label');
  const rLine = el('line', { x1: CX, y1: CY, x2: CX + R, y2: CY, class: 'cd-line' });
  const hLine = el('line', { x1: X0 - 14, y1: YT, x2: X0 - 14, y2: YT + R, class: 'cd-line' });
  const tH = label(X0 - 22, YT + R / 2 + 8, '高 r', 'cd-label cd-end');
  const bLine = el('line', { x1: X0 + 0.5 * S, y1: YT + R + 22, x2: X0 + 8.5 * S, y2: YT + R + 22, class: 'cd-line' });
  const tB = label(CX, YT + R + 50, '底 ≈ 圓周的一半 ＝ πr', 'cd-label cd-mid');
  const tF = label(CX, 50, '面積 ＝ πr × r ＝ πr²', 'cd-formula cd-mid');

  const lines = [tR, rLine, hLine, tH, bLine, tB, tF];
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

  function reset() {
    tl.pause(0);
    sectors.forEach((s) => gsap.set(s.node, { attr: { transform: tf(s.circle) } }));
    gsap.set(lines, { autoAlpha: 0 });
    gsap.set([tR, rLine], { autoAlpha: 1 });
    gsap.set(ghost, { autoAlpha: 0 });
  }

  tl.to([tR, rLine], { autoAlpha: 0, duration: 0.4 }, 0.6)
    .to(ghost, { autoAlpha: 1, duration: 0.3 }, '<')
    .add('cut')
    .add('row', 'cut+=1.4');
  sectors.forEach((s) => {
    tl.to(s.node, { duration: 0.8, ease: 'power2.out', attr: { transform: tf(s.burst) } }, 'cut');
  });
  sectors.forEach((s, i) => {
    tl.to(s.node, { duration: 1.1, attr: { transform: tf(s.row) } }, `row+=${(i * 0.18).toFixed(2)}`);
  });
  tl
    .to(ghost, { autoAlpha: 0, duration: 0.6 }, 'row')
    .addPause('+=0.3')
    .to([hLine, tH], { autoAlpha: 1, duration: 0.5 })
    .to([bLine, tB], { autoAlpha: 1, duration: 0.5 }, '+=0.5')
    .to(tF, { autoAlpha: 1, duration: 0.6, ease: 'back.out(1.6)' }, '+=0.6');

  reset();
  const root = svg.closest('section');
  root.querySelector('[data-c="play"]').addEventListener('click', () => (tl.progress() === 1 ? tl.restart() : tl.play()));
  root.querySelector('[data-c="pause"]').addEventListener('click', () => tl.pause());
  root.querySelector('[data-c="replay"]').addEventListener('click', () => { reset(); tl.play(); });

  const onShow = () => { if (Reveal.getCurrentSlide() === root) reset(); };
  Reveal.isReady() ? Reveal.on('slidechanged', onShow) : Reveal.on('ready', () => Reveal.on('slidechanged', onShow));
})();
