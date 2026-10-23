/* 簡報右下角即時聊天室：學員用手機 join.html#chat 發言，講台大螢幕即時出現
 * 收合時：一顆「💬 聊天室」膠囊＋未讀數，新訊息跳出小泡泡（8 秒後消失），表情回饋從角落往上飄
 * 展開時：完整訊息列表＋加入 QR Code
 * 講者操作：點膠囊或按 C 開關；點某則訊息可在大螢幕隱藏（只存在這台電腦） */
import { isReady, watchChat, onStatus } from './interact.js?v=__BUILD_VERSION__';

const KEY = 'ccu2026ai_chatw';
const store = {
  get(k, d) { try { const v = localStorage.getItem(`${KEY}_${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`${KEY}_${k}`, JSON.stringify(v)); } catch { /* 無痕模式 */ } },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const joinUrl = new URL('join.html#chat', location.href).href;
const root = document.createElement('div');
root.id = 'chatw';
root.innerHTML = `
  <div class="cw-toasts" aria-live="polite"></div>
  <div class="cw-floats" aria-hidden="true"></div>
  <section class="cw-panel" role="dialog" aria-label="即時聊天室">
    <header class="cw-head">
      <b>💬 即時聊天室</b><span class="cw-st"></span>
      <span class="cw-tools">
        <button type="button" data-act="big" title="切換大字">A+</button>
        <button type="button" data-act="mute" title="收合時不跳出新訊息">🔔</button>
        <button type="button" data-act="qr" title="顯示加入 QR Code">QR</button>
        <button type="button" data-act="close" title="收合（C）">✕</button>
      </span>
    </header>
    <div class="cw-qr"><div class="cw-qr-img"></div><div><b>掃描加入聊天室</b><span>${esc(joinUrl.replace(/^https?:\/\//, ''))}</span></div></div>
    <div class="cw-list"><div class="cw-empty">還沒有訊息。請學員掃 QR Code 加入！</div></div>
    <div class="cw-react-bar"></div>
    <footer class="cw-foot">點訊息可在大螢幕隱藏・按 C 開關</footer>
  </section>
  <button type="button" class="cw-pill" aria-label="開關即時聊天室（C）">💬 聊天室<span class="cw-badge" hidden>0</span></button>`;
document.body.appendChild(root);

const $ = (s) => root.querySelector(s);
const list = $('.cw-list');
const badge = $('.cw-badge');

// 加入用 QR Code
if (window.qrcode) {
  const qr = window.qrcode(0, 'M');
  qr.addData(joinUrl);
  qr.make();
  $('.cw-qr-img').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
}

/* ---------- 狀態：開關、大字、靜音、QR、隱藏清單（存在這台電腦） ---------- */
const state = { open: store.get('open', false), big: store.get('big', false), mute: store.get('mute', false), qr: store.get('qr', true) };
let hidden = new Set(store.get('hidden', []));
let unread = 0;
function render() {
  root.classList.toggle('open', state.open);
  root.classList.toggle('big', state.big);
  root.classList.toggle('show-qr', state.qr);
  $('[data-act="mute"]').textContent = state.mute ? '🔕' : '🔔';
  if (state.open) { unread = 0; list.scrollTop = list.scrollHeight; $('.cw-toasts').innerHTML = ''; }
  badge.hidden = !unread;
  badge.textContent = unread > 99 ? '99+' : unread;
}
function toggle(k) { state[k] = !state[k]; store.set(k, state[k]); render(); }
$('.cw-pill').addEventListener('click', () => toggle('open'));
$('.cw-head').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  toggle(b.dataset.act === 'close' ? 'open' : b.dataset.act);
});
// 按 C 開關（打字時不攔截）
document.addEventListener('keydown', (e) => {
  if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea/i.test(e.target.tagName)) {
    e.preventDefault(); e.stopPropagation(); toggle('open');
  }
}, true);
// 點訊息：在大螢幕隱藏／再點一次恢復
list.addEventListener('click', (e) => {
  const m = e.target.closest('.cw-msg');
  if (!m) return;
  const id = m.dataset.id;
  hidden.has(id) ? hidden.delete(id) : hidden.add(id);
  store.set('hidden', [...hidden]);
  m.classList.toggle('hid', hidden.has(id));
});

/* ---------- 連線燈 ---------- */
const ST = { live: '● 即時', connecting: '● 連線中', retrying: '● 重新連線', offline: '● 未連線' };
onStatus((st) => { const s = $('.cw-st'); s.textContent = ST[st] || st; s.dataset.st = st; });

/* ---------- 新訊息提示 ---------- */
function toast(m) {
  if (state.open || state.mute || document.documentElement.classList.contains('is-opening')) return;
  const box = $('.cw-toasts');
  const t = document.createElement('div');
  t.className = 'cw-toast';
  t.innerHTML = `<b>${esc(m.name)}</b>${esc(m.text)}`;
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 8000);
}
function floatEmoji(e) {
  if (document.documentElement.classList.contains('is-opening')) return;
  const f = document.createElement('span');
  f.className = 'cw-float';
  f.textContent = e;
  f.style.setProperty('--dx', `${Math.round(Math.random() * 80 - 40)}px`);
  $('.cw-floats').appendChild(f);
  setTimeout(() => f.remove(), 2600);
}

/* ---------- 訊息列表 ---------- */
const seen = new Set();
let first = true;
watchChat((items) => {
  const msgs = items.filter((m) => m.kind !== 'react');
  // 表情回饋統計：最近 80 則裡各表情的數量
  const counts = {};
  items.filter((m) => m.kind === 'react').forEach((m) => { counts[m.text] = (counts[m.text] || 0) + 1; });
  $('.cw-react-bar').innerHTML = Object.entries(counts).map(([e, n]) => `<span>${esc(e)} <b>${n}</b></span>`).join('');

  if (msgs.length) {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.innerHTML = msgs.map((m) => `<div class="cw-msg${hidden.has(m.id) ? ' hid' : ''}" data-id="${esc(m.id)}">
      <div class="cw-meta"><b>${esc(m.name)}</b><time>${hhmm(m.t)}</time></div><div class="cw-text">${esc(m.text)}</div></div>`).join('');
    if (nearBottom || first) list.scrollTop = list.scrollHeight;
  }
  items.forEach((m) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    if (first) return;                             // 剛打開簡報時的舊訊息不跳提示
    if (m.kind === 'react') floatEmoji(m.text);
    else { if (!state.open) unread += 1; toast(m); }
  });
  first = false;
  render();
});

if (!isReady()) root.classList.add('offline');
render();
