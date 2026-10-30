/* 簡報右下角即時聊天室：學員用手機 join.html#chat 發言，講台大螢幕即時出現
 * 收合時：一顆「💬 聊天室」膠囊＋未讀數，新訊息跳出小泡泡（8 秒後消失），表情回饋從角落往上飄
 * 展開時：完整訊息列表＋加入 QR Code
 * 彈幕：開啟時（預設開），新訊息從畫面右邊飛到左邊，自動分配跑道不重疊；按 D 或面板「彈」開關
 * 講者操作：點膠囊或按 C 開關；點某則訊息可在大螢幕隱藏（只存在這台電腦） */
import { isReady, watchChat, watchReacts, onStatus } from './interact.js?v=__BUILD_VERSION__';

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
  <div class="cw-danmaku" aria-hidden="true"></div>
  <div class="cw-toasts" aria-live="polite"></div>
  <div class="cw-floats" aria-hidden="true"></div>
  <section class="cw-panel" role="dialog" aria-label="即時聊天室">
    <header class="cw-head">
      <span class="cw-title">💬 即時聊天室<span class="cw-st" role="status"></span></span>
      <span class="cw-tools">
        <button type="button" data-act="dm" title="彈幕開關（D）">彈</button>
        <button type="button" data-act="admin" title="管理（清除聊天室）">🔒</button>
        <button type="button" data-act="big" title="切換大字">A+</button>
        <button type="button" data-act="mute" title="收合時不跳出新訊息">🔔</button>
        <button type="button" data-act="qr" title="顯示加入 QR Code">QR</button>
        <button type="button" data-act="close" title="收合（C）">✕</button>
      </span>
    </header>
    <a class="cw-qr" href="${esc(joinUrl)}" target="_blank" rel="noopener" title="點一下開新分頁進入聊天室"><div class="cw-qr-img"></div><div><b>掃描或點我加入</b><span>${esc(joinUrl.replace(/^https?:\/\//, ''))}</span><em>↗ 點一下開新分頁</em></div></a>
    <form class="cw-admin" autocomplete="off">
      <div class="cw-admin-login">
        <b>🔒 管理員</b>
        <input type="password" name="pw" placeholder="輸入管理密碼" aria-label="管理密碼" autocomplete="current-password" />
        <button type="submit">登入</button>
      </div>
      <div class="cw-admin-tools">
        <b>🔓 管理員</b>
        <button type="button" data-adm="sync" title="把目前頁碼同步給學員的跟隨模式">📡 同步頁碼</button>
        <button type="button" data-adm="clear">🗑 清除全部訊息</button>
        <button type="button" data-adm="logout">登出</button>
      </div>
      <div class="cw-admin-msg" aria-live="polite"></div>
    </form>
    <div class="cw-list"><div class="cw-empty">還沒有訊息。請學員掃 QR Code 加入！</div></div>
    <div class="cw-react-bar"></div>
    <footer class="cw-foot">點訊息可在大螢幕隱藏・C 開關聊天室・D 開關彈幕</footer>
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
const state = { open: store.get('open', false), big: store.get('big', false), mute: store.get('mute', false), qr: store.get('qr', true), dm: store.get('dm', true) };
let hidden = new Set(store.get('hidden', []));
let unread = 0;
function render() {
  root.classList.toggle('open', state.open);
  root.classList.toggle('big', state.big);
  root.classList.toggle('show-qr', state.qr);
  root.classList.toggle('dm-on', state.dm);
  if (!state.dm) $('.cw-danmaku').innerHTML = '';
  $('[data-act="mute"]').textContent = state.mute ? '🔕' : '🔔';
  const bigBtn = $('[data-act="big"]');                    // 大字模式時改成「A−」＝按了會變回小字
  bigBtn.textContent = state.big ? 'A−' : 'A+';
  bigBtn.title = state.big ? '切換小字' : '切換大字';
  bigBtn.setAttribute('aria-pressed', state.big ? 'true' : 'false');
  if (state.open) { unread = 0; list.scrollTop = list.scrollHeight; $('.cw-toasts').innerHTML = ''; }
  badge.hidden = !unread;
  badge.textContent = unread > 99 ? '99+' : unread;
}
function toggle(k) { state[k] = !state[k]; store.set(k, state[k]); render(); }
$('.cw-pill').addEventListener('click', () => toggle('open'));
$('.cw-head').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  if (b.dataset.act === 'admin') { openAdmin(); return; }
  toggle(b.dataset.act === 'close' ? 'open' : b.dataset.act);
});
// 按 C 開關聊天室、按 D 開關彈幕（打字時不攔截）
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k !== 'c' && k !== 'd') return;
  e.preventDefault(); e.stopPropagation();
  toggle(k === 'c' ? 'open' : 'dm');
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
onStatus((st) => { const s = $('.cw-st'); s.textContent = ST[st] || st; s.title = (ST[st] || st).replace('● ', ''); s.dataset.st = st; });

/* ---------- 彈幕：從右飛到左，依跑道排隊，不互相重疊 ---------- */
const DM_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#ffd166', '#7fdbff', '#ff9ecd', '#b5f5a0'];
const lanes = [];                                  // 每條跑道「下一則可以出發的時間」
let dmQueue = [];
function laneSetup() {
  const fs = state.big ? 56 : 42;
  const laneH = Math.round(fs * 1.45);
  const top = 64;                                  // 避開上方主題按鈕
  const usable = Math.max(laneH, window.innerHeight * 0.62 - top);
  const n = Math.max(3, Math.floor(usable / laneH));
  while (lanes.length < n) lanes.push(0);
  lanes.length = n;
  return { fs, laneH, top };
}
function launch(m) {
  const box = $('.cw-danmaku');
  const { fs, laneH, top } = laneSetup();
  const now = performance.now();
  let li = 0;
  lanes.forEach((t, i) => { if (t < lanes[li]) li = i; });
  if (lanes[li] > now + 4000) { dmQueue.push(m); if (dmQueue.length > 30) dmQueue.shift(); return; } // 太擠就排隊
  const wait = Math.max(0, lanes[li] - now);
  const el = document.createElement('div');
  el.className = 'dm';
  el.style.fontSize = `${fs}px`;
  el.style.top = `${top + li * laneH}px`;
  el.style.color = DM_COLORS[Math.floor(Math.random() * DM_COLORS.length)];
  const text = m.text.length > 60 ? m.text.slice(0, 60) + '…' : m.text;
  el.innerHTML = `<b>${esc(m.name)}</b>${esc(text)}`;
  el.style.visibility = 'hidden';
  box.appendChild(el);
  const w = el.offsetWidth;
  const vw = window.innerWidth;
  const speed = vw / 9;                            // 9 秒橫越一個螢幕寬；長訊息等速但多跑一會兒
  const dur = ((vw + w) / speed) * 1000;
  lanes[li] = now + wait + ((w + 60) / speed) * 1000;   // 尾巴完全進場再留 60px 才放下一則
  setTimeout(() => {
    if (!state.dm || document.documentElement.classList.contains('is-opening')) { el.remove(); return; }
    el.style.visibility = '';
    const a = el.animate([{ transform: `translateX(${vw}px)` }, { transform: `translateX(${-w - 20}px)` }], { duration: dur, easing: 'linear' });
    a.onfinish = () => { el.remove(); if (dmQueue.length) launch(dmQueue.shift()); };
  }, wait);
  while (box.children.length > 60) box.firstElementChild.remove();
}
function danmaku(m) {
  if (!state.dm || hidden.has(m.id) || document.documentElement.classList.contains('is-opening')) return;
  launch(m);
}

/* ---------- 新訊息提示 ---------- */
function toast(m) {
  // 彈幕開著時不再跳右下泡泡（同一句話不要出現兩次）
  if (state.dm || state.open || state.mute || document.documentElement.classList.contains('is-opening')) return;
  const box = $('.cw-toasts');
  const t = document.createElement('div');
  t.className = 'cw-toast';
  t.innerHTML = `<b>${esc(m.name)}</b>${esc(m.text)}`;
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 8000);
}
/* 表情飛起（仿 Google Meet）：大表情＋送出者名牌，從右下角左右搖擺往上飄
 * 同時湧入很多個時錯開 0.12 秒出場，畫面上最多保留 40 個 */
let floatQueue = 0;
function floatEmoji(e, name) {
  if (document.documentElement.classList.contains('is-opening')) return;
  const delay = Math.min(floatQueue, 12) * 120;
  floatQueue += 1;
  setTimeout(() => {
    floatQueue = Math.max(0, floatQueue - 1);
    const box = $('.cw-floats');
    while (box.children.length >= 40) box.firstElementChild.remove();
    const f = document.createElement('div');
    f.className = 'cw-float';
    f.innerHTML = `<span class="cw-emo">${esc(e)}</span>${name ? `<span class="cw-who">${esc(name)}</span>` : ''}`;
    const dur = 3.6 + Math.random() * 0.9;
    f.style.left = `${Math.round(Math.random() * 120)}px`;
    f.style.setProperty('--s', `${Math.round((Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22))}px`);
    f.style.animationDuration = `${dur}s`;
    box.appendChild(f);
    setTimeout(() => f.remove(), dur * 1000 + 100);
  }, delay);
}

/* ---------- 訊息列表（文字訊息）---------- */
const seen = new Set();
let first = true;
watchChat((msgs) => {
  if (!msgs.length && !first) list.innerHTML = '<div class="cw-empty">聊天室是空的。請學員掃 QR Code 加入！</div>';
  if (msgs.length) {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.innerHTML = msgs.map((m) => `<div class="cw-msg${hidden.has(m.id) ? ' hid' : ''}" data-id="${esc(m.id)}">
      <div class="cw-meta"><b>${esc(m.name)}</b><time>${hhmm(m.t)}</time></div><div class="cw-text">${esc(m.text)}</div></div>`).join('');
    if (nearBottom || first) list.scrollTop = list.scrollHeight;
  }
  msgs.forEach((m) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    if (first) return;                             // 剛打開簡報時的舊訊息不跳提示
    if (!state.open) unread += 1;
    danmaku(m);
    toast(m);
  });
  first = false;
  render();
}, 80, { watchdog: true });

/* ---------- 表情回饋（獨立集合，只有講台在聽）---------- */
const seenR = new Set();
let firstR = true;
watchReacts((items) => {
  const counts = {};                               // 最近 200 個表情的統計
  items.forEach((m) => { counts[m.text] = (counts[m.text] || 0) + 1; });
  $('.cw-react-bar').innerHTML = Object.entries(counts).map(([e, n]) => `<span>${esc(e)} <b>${n}</b></span>`).join('');
  items.forEach((m) => {
    if (seenR.has(m.id)) return;
    seenR.add(m.id);
    if (!firstR) floatEmoji(m.text, m.name);
  });
  firstR = false;
}, 200, { watchdog: true });

/* ---------- 管理：輸入管理密碼後可清除聊天室（登入模組要用時才載入） ---------- */
const adminForm = $('.cw-admin');
const adminMsg = $('.cw-admin-msg');
let adminMod = null;
async function loadAdmin() {
  if (!adminMod) {
    adminMod = await import('./chat-admin.js?v=__BUILD_VERSION__');
    adminMod.onAdmin((ok) => {
      root.classList.toggle('is-admin', ok);
      if (ok) store.set('adminDevice', true);       // 記住這台是講台電腦，下次一打開就自動同步
      applySync(ok);
    });
  }
  return adminMod;
}
// 頁碼同步：管理員登入後預設開啟（存在這台電腦）
let syncPref = store.get('sync', true);
function applySync(isAdmin) {
  const on = isAdmin && syncPref;
  root.classList.toggle('syncing', on);
  const b = $('[data-adm="sync"]');
  if (b) b.textContent = syncPref ? '📡 同步頁碼：開' : '📡 同步頁碼：關';
  if (adminMod) adminMod.setSync(on);
}
if (store.get('adminDevice', false)) loadAdmin().catch(() => {});

function openAdmin() {
  const show = !root.classList.contains('admin-open');
  root.classList.toggle('admin-open', show);
  adminMsg.textContent = '';
  if (show) loadAdmin().then(() => { if (!root.classList.contains('is-admin')) adminForm.pw.focus(); })
    .catch(() => { adminMsg.textContent = '管理功能載入失敗，請檢查網路'; });
}
adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = adminForm.pw.value;
  if (!pw) return;
  adminMsg.textContent = '登入中…';
  try {
    const r = await (await loadAdmin()).login(pw);
    adminMsg.textContent = r === 'created' ? '已完成首次設定：剛剛輸入的就是管理密碼' : '登入成功';
  }
  catch (err) { adminMsg.textContent = err.message || '登入失敗'; }
  adminForm.pw.value = '';
});
let confirmUntil = 0;
adminForm.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-adm]');
  if (!b) return;
  const mod = await loadAdmin();
  if (b.dataset.adm === 'logout') { await mod.logout(); store.set('adminDevice', false); adminMsg.textContent = '已登出'; return; }
  if (b.dataset.adm === 'sync') {
    syncPref = !syncPref; store.set('sync', syncPref);
    applySync(root.classList.contains('is-admin'));
    adminMsg.textContent = syncPref ? '學員的「跟隨模式」會跟著你翻頁' : '已暫停同步：學員停在最後同步的那一頁';
    return;
  }
  if (Date.now() > confirmUntil) {                       // 按兩次才清除，避免誤觸
    confirmUntil = Date.now() + 4000;
    b.textContent = '確定？再按一次';
    setTimeout(() => { b.textContent = '🗑 清除全部訊息'; }, 4000);
    return;
  }
  confirmUntil = 0;
  b.disabled = true; b.textContent = '清除中…';
  try {
    const n = await mod.clearChat();
    hidden = new Set(); store.set('hidden', []);
    adminMsg.textContent = `已清除 ${n} 筆（訊息＋表情）`;
  } catch (err) { adminMsg.textContent = '清除失敗：沒有權限或網路中斷'; }
  b.disabled = false; b.textContent = '🗑 清除全部訊息';
});

if (!isReady()) root.classList.add('offline');
render();
