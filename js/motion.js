/* 動畫層：仿 HyperFrames 的 GSAP 時間軸編排
 * 每頁進場：章節標籤 → 標題逐字浮現 → 區塊依序淡入串接
 * 換頁：舊頁區塊先淡出，底圖緩慢推近（Ken Burns）
 * 片段（fragment）：由 GSAP 接手淡入淡出
 * 系統開啟「減少動態效果」時，所有動畫時間歸零 */
(function () {
  if (/print-pdf/.test(location.search)) return;
  gsap.registerPlugin(SplitText);

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const T = (s) => (reduceMQ.matches ? 0 : s);
  const EASE = 'power3.out';
  const splits = new WeakMap();
  const timelines = new WeakMap();

  const FROM = {
    up:    { autoAlpha: 0, y: 26 },
    left:  { autoAlpha: 0, x: -48 },
    right: { autoAlpha: 0, x: 48 },
    pop:   { autoAlpha: 0, scale: 0.72 },
    fade:  { autoAlpha: 0 },
  };
  const TO = { autoAlpha: 1, x: 0, y: 0, scale: 1 };

  function charsOf(title) {
    if (!splits.has(title)) splits.set(title, SplitText.create(title, { type: 'chars', charsClass: 'ch' }));
    return splits.get(title).chars;
  }

  function partsOf(slide) {
    const kickers = [...slide.querySelectorAll('.kicker')];
    const titles = [...slide.querySelectorAll('h1, h2')].filter((t) => !t.closest('.fragment:not(.visible)'));
    const items = [...slide.querySelectorAll('[data-a], .stg > *, .fragment.visible')]
      .filter((el) => !el.matches('h1, h2, .kicker'));
    return { kickers, titles, items };
  }

  function enter(slide) {
    if (!slide) return;
    timelines.get(slide)?.kill();
    const { kickers, titles, items } = partsOf(slide);

    slide.querySelectorAll('.fragment:not(.visible)').forEach((f) => gsap.set(f, { autoAlpha: 0 }));
    gsap.set(kickers, FROM.up);
    items.forEach((el) => gsap.set(el, FROM[el.dataset.a] || FROM.up));
    titles.forEach((t) => { gsap.set(t, { autoAlpha: 1, y: 0 }); gsap.set(charsOf(t), { autoAlpha: 0, yPercent: 65 }); });

    const tl = gsap.timeline({ defaults: { ease: EASE } });
    tl.to(kickers, { ...TO, duration: T(0.45) }, T(0.12));
    titles.forEach((t, i) => {
      tl.to(charsOf(t), { autoAlpha: 1, yPercent: 0, duration: T(0.5), stagger: T(0.02) }, i ? '<0.12' : T(0.2));
    });
    items.forEach((el, i) => {
      const ease = el.dataset.a === 'pop' ? 'back.out(1.6)' : EASE;
      tl.to(el, { ...TO, duration: T(0.55), ease }, i ? `<${T(0.085)}` : `-=${T(0.25)}`);
    });
    timelines.set(slide, tl);

    // 保險：瀏覽器暫停畫面更新（背景分頁、省電模式）時，直接顯示完成狀態，避免整頁空白
    const frameAtStart = gsap.ticker.frame;
    setTimeout(() => {
      if (timelines.get(slide) === tl && gsap.ticker.frame === frameAtStart) tl.progress(1);
    }, 1500);
  }

  function leave(slide) {
    if (!slide) return;
    timelines.get(slide)?.kill();
    const { kickers, titles, items } = partsOf(slide);
    gsap.to([...kickers, ...items], {
      autoAlpha: 0, y: -12, duration: T(0.28), stagger: T(0.015), ease: 'power2.in', overwrite: true,
    });
    gsap.to(titles, { autoAlpha: 0, duration: T(0.25), overwrite: true });
  }

  function kenBurns(slide) {
    const bg = Reveal.getSlideBackground(slide)?.querySelector('.slide-background-content');
    if (bg) gsap.fromTo(bg, { scale: 1.08 }, { scale: 1, duration: T(7), ease: 'power1.out' });
  }

  // ---- 手機直拿的上下捲動檢視 ----
  // 這個模式下一頁在「換頁事件」之前就已經滑進畫面，若等 slidechanged 才把內容藏起來再淡入，會看到內容閃一下。
  // 改成：頁面還在畫面外時先把內容設成進場前狀態；滑進畫面 30% 就播進場動畫；整頁滑出畫面才重設。
  // 不做淡出（舊頁正被滑走，淡出只會讓往回滑時看到空白）。
  function reset(slide) {
    timelines.get(slide)?.kill();
    timelines.delete(slide);
    const { kickers, titles, items } = partsOf(slide);
    gsap.set(kickers, FROM.up);
    items.forEach((el) => gsap.set(el, FROM[el.dataset.a] || FROM.up));
    titles.forEach((t) => { gsap.set(t, { autoAlpha: 1, y: 0 }); gsap.set(charsOf(t), { autoAlpha: 0, yPercent: 65 }); });
    const bg = Reveal.getSlideBackground(slide)?.querySelector('.slide-background-content');
    if (bg) gsap.set(bg, { scale: 1.08 });
  }

  let observer = null;
  let scrollMode = false;
  const shown = new WeakSet();
  function syncMode() {
    const now = !!(Reveal.isScrollView && Reveal.isScrollView());
    if (now === scrollMode && (!now || observer)) return;
    scrollMode = now;
    observer?.disconnect();
    observer = null;
    if (!now) {
      // 轉回橫向翻頁：目前這頁要是完成狀態
      const cur = Reveal.getCurrentSlide();
      if (cur && !shown.has(cur)) enter(cur);
      return;
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const slide = en.target.querySelector('section');
        if (!slide) return;
        if (en.isIntersecting && en.intersectionRatio >= 0.3) {
          if (!shown.has(slide)) { shown.add(slide); enter(slide); kenBurns(slide); }
        } else if (!en.isIntersecting || en.intersectionRatio === 0) {
          // 剛好貼在畫面邊緣時 isIntersecting 會是 true、比例 0，也要先藏好
          shown.delete(slide);
          reset(slide);
        }
      });
    }, { threshold: [0, 0.3] });
    document.querySelectorAll('.scroll-page').forEach((p) => observer.observe(p));
  }

  function start() {
    syncMode();
    if (!scrollMode) {
      enter(Reveal.getCurrentSlide());
      kenBurns(Reveal.getCurrentSlide());
      shown.add(Reveal.getCurrentSlide());
    }
    Reveal.on('resize', () => setTimeout(syncMode, 50));
    Reveal.on('slidechanged', (e) => {
      syncMode();
      if (scrollMode) return; // 捲動檢視由 IntersectionObserver 處理
      shown.delete(e.previousSlide);
      leave(e.previousSlide);
      enter(e.currentSlide);
      kenBurns(e.currentSlide);
      shown.add(e.currentSlide);
    });
    Reveal.on('fragmentshown', (e) => e.fragments.forEach((f) =>
      gsap.fromTo(f, FROM[f.dataset.a] || FROM.up, { ...TO, duration: T(0.5), ease: EASE, overwrite: true })));
    Reveal.on('fragmenthidden', (e) => e.fragments.forEach((f) =>
      gsap.to(f, { autoAlpha: 0, y: 10, duration: T(0.25), overwrite: true })));
  }

  const go = () => document.fonts.ready.then(start);
  Reveal.isReady() ? go() : Reveal.on('ready', go);
})();
