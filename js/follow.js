/* 學員跟隨模式（index.html?follow=1）：跟著講台即時翻頁
 * 自己往前往後翻 → 自動暫停跟隨；按「回到老師進度」→ 立刻跳回並恢復跟隨
 * 學員端不載入聊天室小工具（省額度、手機畫面也比較乾淨），改放「回互動區」按鈕 */
import { watchLive } from './interact.js?v=__BUILD_VERSION__';

const bar = document.createElement('div');
bar.id = 'followbar';
bar.innerHTML = '<button type="button" class="fb-follow"></button><a class="fb-back" href="join.html#chat" aria-label="回互動區（聊天室）">💬 互動區</a>';
document.body.appendChild(bar);
const btn = bar.querySelector('.fb-follow');

let following = true;
let teacherH = null;
let teacherOn = false;
let programmatic = false;

function update() {
  const off = teacherH == null || !teacherOn;
  bar.classList.toggle('paused', !off && !following);
  bar.classList.toggle('waiting', off);
  btn.disabled = teacherH == null;
  if (teacherH == null) btn.textContent = '等待老師開始同步…';
  else if (!teacherOn) btn.textContent = `老師已暫停同步・可自由翻頁（停在第 ${teacherH + 1} 頁）`;
  else btn.textContent = following ? `跟隨老師中・第 ${teacherH + 1} 頁` : `⏸ 回到老師進度・第 ${teacherH + 1} 頁`;
}
function go() {
  if (teacherH == null || Reveal.getIndices().h === teacherH) return;
  programmatic = true;
  Reveal.slide(teacherH);
  setTimeout(() => { programmatic = false; }, 0);
}
btn.addEventListener('click', () => {
  if (!teacherOn) {                                   // 老師暫停同步時：點一下只是跳到老師最後停的那頁
    if (teacherH != null) { programmatic = true; Reveal.slide(teacherH); setTimeout(() => { programmatic = false; }, 0); }
    return;
  }
  // 暫停中 → 恢復並跳回；跟隨中但頁數不同（例如剛載入）→ 跳回；跟隨中且同頁 → 暫停
  following = !following || (teacherH != null && Reveal.getIndices().h !== teacherH);
  if (following) go();
  update();
});

const init = () => {
  Reveal.on('slidechanged', () => {
    if (programmatic) return;                         // 跟著老師翻的，不算自己翻
    if (teacherOn && following && teacherH != null && Reveal.getIndices().h !== teacherH) { following = false; update(); }
  });
  watchLive((s) => {
    const wasOn = teacherOn;
    teacherH = s && Number.isInteger(s.h) ? s.h : null;
    teacherOn = !!(s && s.on);
    if (teacherOn && !wasOn) following = true;        // 老師重新開始同步 → 大家自動恢復跟隨
    if (teacherOn && following) go();
    update();
  });
  update();
};
Reveal.isReady() ? init() : Reveal.on('ready', init);
