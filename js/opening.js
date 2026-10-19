/* 開場片頭：簡報第一頁自動播放，播完自動進入封面
 * 瀏覽器規定「有聲音的影片」要使用者先操作過頁面才能自動播放，
 * 被擋下時改顯示大播放鈕，按一下就開始。 */
(function () {
  const slide = document.getElementById('slide-opening');
  const video = document.getElementById('op-video');
  const playBtn = document.getElementById('op-play');
  if (!slide || !video || !playBtn) return;
  const root = document.documentElement;

  const isCurrent = () => Reveal.getCurrentSlide() === slide;
  const showButton = (show) => slide.classList.toggle('op-blocked', show);

  function start(fromBeginning) {
    if (fromBeginning) video.currentTime = 0;
    slide.classList.remove('op-ending');
    const p = video.play();
    if (p && p.catch) {
      p.then(() => showButton(false)).catch(() => showButton(true));   // 被瀏覽器擋下 → 顯示播放鈕
    }
  }

  function enter() {
    root.classList.add('is-opening');
    start(true);
  }

  function leave() {
    root.classList.remove('is-opening');
    video.pause();
    showButton(false);
  }

  playBtn.addEventListener('click', (e) => { e.stopPropagation(); start(false); });
  // 點影片可暫停／繼續（現場需要停下來說話時用）
  video.addEventListener('click', () => (video.paused ? start(false) : video.pause()));
  // 播完：淡出後自動進入封面
  video.addEventListener('ended', () => {
    slide.classList.add('op-ending');
    setTimeout(() => { if (isCurrent()) Reveal.next(); }, 700);
  });

  const init = () => {
    if (isCurrent()) enter();
    Reveal.on('slidechanged', (e) => {
      if (e.currentSlide === slide) enter();
      else if (e.previousSlide === slide) leave();
    });
  };
  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();
