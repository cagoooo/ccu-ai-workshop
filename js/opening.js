/* 影片頁：開場片頭、上午場宣傳片、下午場宣傳片，切到這頁就自動播放，播完自動進入下一頁
 * 瀏覽器規定「有聲音的影片」要使用者先操作過頁面才能自動播放，
 * 被擋下時改顯示大播放鈕，按一下就開始。 */
(function () {
  const slides = [...document.querySelectorAll('section.vid-slide')];
  if (!slides.length) return;
  const root = document.documentElement;

  const players = slides.map((slide) => {
    const video = slide.querySelector('.op-video');
    const playBtn = slide.querySelector('.op-play');
    if (!video || !playBtn) return null;
    const showButton = (show) => slide.classList.toggle('op-blocked', show);

    function start(fromBeginning) {
      if (fromBeginning) video.currentTime = 0;
      slide.classList.remove('op-ending');
      const p = video.play();
      if (p && p.catch) {
        p.then(() => showButton(false)).catch(() => showButton(true));   // 被瀏覽器擋下 → 顯示播放鈕
      }
    }

    playBtn.addEventListener('click', (e) => { e.stopPropagation(); start(false); });
    // 點影片可暫停／繼續（現場需要停下來說話時用）
    video.addEventListener('click', () => (video.paused ? start(false) : video.pause()));
    // 播完：淡出後自動進入下一頁
    video.addEventListener('ended', () => {
      slide.classList.add('op-ending');
      setTimeout(() => { if (Reveal.getCurrentSlide() === slide) Reveal.next(); }, 700);
    });

    return {
      slide,
      enter() {
        // 學員跟隨模式：手機不自動播有聲影片，改顯示播放鈕讓學員自己決定
        if (root.classList.contains('audience')) { showButton(true); return; }
        root.classList.add('is-opening'); start(true);
      },
      leave() { video.pause(); showButton(false); slide.classList.remove('op-ending'); },
    };
  }).filter(Boolean);

  const sync = (cur, prev) => {
    players.forEach((p) => { if (p.slide === prev) p.leave(); });
    const now = players.find((p) => p.slide === cur);
    if (now) now.enter();
    else root.classList.remove('is-opening');
  };

  const init = () => {
    sync(Reveal.getCurrentSlide(), null);
    Reveal.on('slidechanged', (e) => sync(e.currentSlide, e.previousSlide));
  };
  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();
