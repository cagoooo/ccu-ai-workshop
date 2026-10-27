// 即時互動（文字雲／投票）共用模組：簡報頁與手機參與頁都用這一份
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  initializeFirestore, collection, addDoc, doc, setDoc, onSnapshot, serverTimestamp, getDocsFromServer,
  query, orderBy, limitToLast, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js?v=__BUILD_VERSION__';

// 集合名稱一律加簡報 slug 前綴，避免跨場次資料混在一起
export const SLUG = 'ccu2026ai';

export const WORDCLOUDS = {
  open:  { q: '說到「AI 教學」，你第一個想到的詞？', hint: '例如：省時、作弊、備課、家教…' },
  close: { q: '明天你會先用 AI 做哪一件事？', hint: '例如：出測驗、做心智圖、寫親師信…' },
};

export const POLLS = {
  pre: {
    q: '你用 AI 備過課嗎？',
    options: [
      { id: 'a', label: '從來沒有' },
      { id: 'b', label: '試過一兩次' },
      { id: 'c', label: '偶爾會用' },
      { id: 'd', label: '已經是備課日常' },
    ],
  },
  noon: {
    q: '上午做的教材，你最想帶回教室的是？',
    options: [
      { id: 'a', label: '互動報告' },
      { id: 'b', label: '心智圖' },
      { id: 'c', label: '學習卡' },
      { id: 'd', label: '資訊圖表' },
      { id: 'e', label: '測驗' },
      { id: 'f', label: '影音／語音摘要' },
    ],
  },
};

const ready = !firebaseConfig.apiKey.startsWith('__');
// 自動偵測：學校網路擋住即時串流時，改用長輪詢維持即時推送
export const app = ready ? initializeApp(firebaseConfig) : null;
export const db = ready ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }) : null;

/* ---------- 連線狀態（給畫面上的「即時同步中」燈號用） ---------- */
const statusListeners = new Set();
let status = ready ? 'connecting' : 'offline';
export function onStatus(cb) { statusListeners.add(cb); cb(status); return () => statusListeners.delete(cb); }
function setStatus(s) { if (s !== status) { status = s; statusListeners.forEach((cb) => cb(s)); } }

/* 即時監聽＋省額度保險（Firebase 免費方案每天只有 5 萬次讀取）：
 * ① onSnapshot 即時推送（主要）：第一次讀全部，之後只傳「有變動的那幾筆」
 * ② 分頁回到前景 6 秒後若還沒恢復「即時」才補抓（學員切去別的 App 再回來很常見，每次都整批重讀會很耗）；網路恢復時補抓
 * ③ watchdog（只給講台簡報用）：每 20 秒用「計數查詢」核對總數（1000 筆內只算 1 次讀取），
 *    總數變了但即時推送沒動靜，才整批補抓。舊版每 4 秒整批重讀，人一多幾分鐘就會把額度用完 */
function liveQuery(ref, handle, { countRef = null, watchdog = false } = {}) {
  if (!db || !ref) { handle(null); return () => {}; }
  let lastSig = '';
  let lastServerSnap = 0;
  let lastRefresh = 0;
  let knownCount = null;
  const apply = (snap) => {
    const sig = snap.docs.map((d) => d.id + ':' + JSON.stringify(d.data())).join('|');
    if (sig !== lastSig) { lastSig = sig; handle(snap); }
  };
  const unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    if (!snap.metadata.fromCache) lastServerSnap = Date.now();
    setStatus(snap.metadata.fromCache ? 'connecting' : 'live');
    apply(snap);
  }, (err) => { console.warn('即時監聽中斷', err); setStatus('retrying'); });
  const refresh = (force) => {
    if (!force && Date.now() - lastRefresh < 20000) return;
    lastRefresh = Date.now();
    getDocsFromServer(ref).then((snap) => { lastServerSnap = Date.now(); setStatus('live'); apply(snap); })
      .catch(() => setStatus('retrying'));
  };
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    setTimeout(() => { if (status !== 'live') refresh(); }, 6000);   // 即時推送會自己續接，續不上才補抓
  };
  const onOnline = () => refresh(true);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  let timer = null;
  if (watchdog) {
    timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      getCountFromServer(countRef || ref).then((r) => {
        const n = r.data().count;
        if (knownCount !== null && n !== knownCount && Date.now() - lastServerSnap > 20000) refresh(true);
        knownCount = n;
      }).catch(() => setStatus('retrying'));
    }, 20000);
  }
  return () => { unsub(); if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline); };
}
export const isReady = () => ready;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕模式可能不能存 */ } },
};

let memId = null;
export function voterId() {
  let id = store.get(`${SLUG}_voter`);
  if (!id) {
    id = memId || ('v' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36));
    memId = id;
    store.set(`${SLUG}_voter`, id);
  }
  return id;
}

export async function submitWord(key, raw) {
  const word = String(raw || '').trim().slice(0, 20);
  if (!word || !db) return false;
  await addDoc(collection(db, `${SLUG}_wordcloud_${key}`), { word, created_at: serverTimestamp() });
  return true;
}

export function watchWords(key, cb, opts) {
  return liveQuery(db ? collection(db, `${SLUG}_wordcloud_${key}`) : null, (snap) => {
    if (!snap) return cb([], 0);
    const counts = {};
    snap.forEach((d) => {
      const w = String(d.data().word || '').trim();
      if (w) counts[w] = (counts[w] || 0) + 1;
    });
    cb(Object.entries(counts).sort((a, b) => b[1] - a[1]), snap.size);
  }, opts);
}

export const myVote = (key) => store.get(`${SLUG}_vote_${key}`);

export async function vote(key, opt) {
  if (!db) return false;
  await setDoc(doc(db, `${SLUG}_poll_${key}`, voterId()), { opt, updated_at: serverTimestamp() });
  store.set(`${SLUG}_vote_${key}`, opt);
  return true;
}

export function watchPoll(key, cb, opts) {
  return liveQuery(db ? collection(db, `${SLUG}_poll_${key}`) : null, (snap) => {
    if (!snap) return cb({}, 0);
    const counts = {};
    snap.forEach((d) => { const o = d.data().opt; counts[o] = (counts[o] || 0) + 1; });
    cb(counts, snap.size);
  }, opts);
}

/* ---------- 即時聊天室 ---------- */
export const REACTIONS = ['👍', '❤️', '👏', '😮', '🤔', '❓'];
export const myName = () => store.get(`${SLUG}_name`) || '';
export const setMyName = (n) => store.set(`${SLUG}_name`, String(n || '').trim().slice(0, 12));

export async function sendChat(raw, kind = 'msg') {
  const text = String(raw || '').trim().slice(0, 200);
  if (!text || !db) return false;
  if (kind === 'react' && !REACTIONS.includes(text)) return false;
  const name = myName() || '匿名學員';
  // 表情存在獨立的集合：只有講台簡報在聽，學員手機不必下載每一個表情（省讀取額度）
  if (kind === 'react') await addDoc(collection(db, `${SLUG}_react`), { name, text, uid: voterId(), created_at: serverTimestamp() });
  else await addDoc(collection(db, `${SLUG}_chat`), { name, text, kind, uid: voterId(), created_at: serverTimestamp() });
  return true;
}

const toItems = (snap) => snap.docs.map((d) => {
  const x = d.data({ serverTimestamps: 'estimate' });
  const t = x.created_at && x.created_at.toDate ? x.created_at.toDate() : new Date();
  return { id: d.id, name: x.name, text: x.text, kind: x.kind || 'react', uid: x.uid, t };
});

// 只抓最近 n 則文字訊息；送出中的訊息先用本機估計時間排序（學員手機 40 則、講台 80 則）
export function watchChat(cb, n = 40, opts = {}) {
  const col = db ? collection(db, `${SLUG}_chat`) : null;
  const ref = col ? query(col, orderBy('created_at'), limitToLast(n)) : null;
  return liveQuery(ref, (snap) => cb(snap ? toItems(snap).filter((m) => m.kind !== 'react') : []), { ...opts, countRef: col });
}

// 表情回饋（只有講台簡報監聽）
export function watchReacts(cb, n = 200, opts = {}) {
  const col = db ? collection(db, `${SLUG}_react`) : null;
  const ref = col ? query(col, orderBy('created_at'), limitToLast(n)) : null;
  return liveQuery(ref, (snap) => cb(snap ? toItems(snap) : []), { ...opts, countRef: col });
}
