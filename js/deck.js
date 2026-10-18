// 簡報介面元件：主題切換、計時器、複製提示詞、前後對比滑桿、QR Code、文字雲、投票
import { WORDCLOUDS, POLLS, isReady, submitWord, watchWords, vote, watchPoll, myVote } from './interact.js';

const DEFAULT_PREF = 'light';
const THEME_KEY = 'ccu2026ai_theme';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 忽略 */ } },
};
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/* ---------- 主題（預設淺色） ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'dark' ? '☀️ 淺色' : '🌙 深色';
  drawAllClouds();
}
document.getElementById('theme-btn')?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set(THEME_KEY, next);
  applyTheme(next);
});

/* ---------- 倒數計時器 ---------- */
$$('.timer').forEach((box) => {
  const total = Number(box.dataset.min || 10) * 60;
  let left = total;
  let tick = null;
  const out = box.querySelector('.timer-num');
  const render = () => {
    out.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    box.classList.toggle('ending', left <= 60 && left > 0);
    box.classList.toggle('done', left === 0);
  };
  const stop = () => { clearInterval(tick); tick = null; box.classList.remove('running'); };
  box.querySelector('[data-t="go"]').addEventListener('click', () => {
    if (tick) return stop();
    if (left === 0) left = total;
    box.classList.add('running');
    tick = setInterval(() => { left = Math.max(0, left - 1); render(); if (!left) stop(); }, 1000);
  });
  box.querySelector('[data-t="reset"]').addEventListener('click', () => { stop(); left = total; render(); });
  box.querySelector('[data-t="plus"]').addEventListener('click', () => { left += 60; render(); });
  render();
});

/* ---------- 複製提示詞 ---------- */
$$('.prompt').forEach((card) => {
  const btn = card.querySelector('.copy');
  btn?.addEventListener('click', async () => {
    const text = card.querySelector('pre').innerText;
    try { await navigator.clipboard.writeText(text); btn.textContent = '✓ 已複製'; }
    catch { btn.textContent = '請手動選取複製'; }
    setTimeout(() => { btn.textContent = '複製提示詞'; }, 1800);
  });
});

/* ---------- 前後對比滑桿 ---------- */
$$('.viz').forEach((viz) => {
  const after = viz.querySelector('.viz-after');
  const line = viz.querySelector('.viz-line');
  const slider = viz.parentElement.querySelector('.viz-range');
  const set = (v) => {
    after.style.clipPath = `inset(0 0 0 ${v}%)`;
    line.style.left = v + '%';
    viz.querySelector('.viz-tag.l').style.opacity = v < 12 ? 0 : 1;
    viz.querySelector('.viz-tag.r').style.opacity = v > 88 ? 0 : 1;
  };
  slider.addEventListener('input', () => set(+slider.value));
  set(+slider.value);
});

/* ---------- 參與用 QR Code ---------- */
$$('.qr[data-key]').forEach((box) => {
  const url = new URL(`join.html#${box.dataset.key}`, location.href).href;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  const link = box.parentElement.querySelector('.qr-url');
  if (link) { link.textContent = url.replace(/^https?:\/\//, ''); link.href = url; }
});

/* ---------- 文字雲 ---------- */
const clouds = [];
function cloudColors() {
  return document.documentElement.dataset.theme === 'dark'
    ? ['#4fc3f7', '#ff8a5c', '#ffb74d', '#81c784', '#ce93d8', '#80deea']
    : ['#0b7fb3', '#d4531f', '#b26a00', '#2e7d32', '#7b3fa0', '#00838f'];
}
function drawCloud(c) {
  if (!c.data.length || typeof WordCloud === 'undefined' || !c.canvas.offsetWidth) return;
  c.canvas.width = c.canvas.offsetWidth;
  c.canvas.height = c.canvas.offsetHeight;
  const max = c.data[0][1];
  const colors = cloudColors();
  WordCloud(c.canvas, {
    list: c.data.slice(0, 80).map(([w, n]) => [w, Math.max(22, Math.round((n / max) * 96))]),
    gridSize: 8,
    weightFactor: 1,
    rotateRatio: 0.15,
    shuffle: false,
    fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
    fontWeight: 700,
    color: () => colors[Math.floor(Math.random() * colors.length)],
    backgroundColor: 'transparent',
  });
}
function drawAllClouds() {
  clouds.forEach((c) => { if (c.slide.classList.contains('present')) drawCloud(c); });
}

$$('.wc[data-key]').forEach((box) => {
  const key = box.dataset.key;
  const c = { canvas: box.querySelector('canvas'), data: [], slide: box.closest('section') };
  clouds.push(c);
  box.querySelector('.wc-q').textContent = WORDCLOUDS[key].q;
  const input = box.querySelector('input');
  input.placeholder = WORDCLOUDS[key].hint;
  const send = async () => {
    try { if (await submitWord(key, input.value)) input.value = ''; } catch (e) { console.warn(e); }
  };
  box.querySelector('.wc-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
  watchWords(key, (data, total) => {
    c.data = data;
    box.querySelector('.wc-total').textContent = total;
    box.querySelector('.wc-empty').style.display = data.length ? 'none' : '';
    box.querySelector('.wc-list').innerHTML = data.slice(0, 7)
      .map(([w, n]) => `<li><span>${esc(w)}</span><b>${n}</b></li>`).join('')
      || '<li class="muted">等待第一個答案…</li>';
    if (c.slide.classList.contains('present')) drawCloud(c);
  });
});

/* ---------- 投票 ---------- */
$$('.poll[data-key]').forEach((box) => {
  const key = box.dataset.key;
  const cfg = POLLS[key];
  box.querySelector('.poll-q').textContent = cfg.q;
  const list = box.querySelector('.poll-opts');
  list.innerHTML = cfg.options.map((o) => `
    <button class="poll-opt" data-opt="${o.id}">
      <span class="poll-label">${esc(o.label)}</span>
      <span class="poll-bar"><i></i></span>
      <span class="poll-pct">0%</span>
    </button>`).join('');
  const mark = () => $$('.poll-opt', list).forEach((b) => b.classList.toggle('mine', b.dataset.opt === myVote(key)));
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('.poll-opt');
    if (!b) return;
    try { await vote(key, b.dataset.opt); mark(); } catch (err) { console.warn(err); }
  });
  mark();
  watchPoll(key, (counts, total) => {
    box.querySelector('.poll-total').textContent = total;
    cfg.options.forEach((o) => {
      const pct = total ? Math.round(((counts[o.id] || 0) / total) * 100) : 0;
      const b = list.querySelector(`[data-opt="${o.id}"]`);
      b.querySelector('i').style.width = pct + '%';
      b.querySelector('.poll-pct').textContent = `${pct}%`;
    });
  });
});

applyTheme(store.get(THEME_KEY) === 'dark' ? 'dark' : DEFAULT_PREF);
if (!isReady()) document.documentElement.classList.add('offline');

Reveal.on('slidechanged', () => setTimeout(drawAllClouds, 450));
window.addEventListener('resize', () => setTimeout(drawAllClouds, 200));
