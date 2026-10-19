// 即時互動（文字雲／投票）共用模組：簡報頁與手機參與頁都用這一份
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  initializeFirestore, collection, addDoc, doc, setDoc, onSnapshot, serverTimestamp, getDocsFromServer,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

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
const db = ready ? initializeFirestore(initializeApp(firebaseConfig), { experimentalAutoDetectLongPolling: true }) : null;

/* ---------- 連線狀態（給畫面上的「即時同步中」燈號用） ---------- */
const statusListeners = new Set();
let status = ready ? 'connecting' : 'offline';
export function onStatus(cb) { statusListeners.add(cb); cb(status); return () => statusListeners.delete(cb); }
function setStatus(s) { if (s !== status) { status = s; statusListeners.forEach((cb) => cb(s)); } }

/* 即時監聽＋保險機制：
 * ① onSnapshot 即時推送（主要）
 * ② 分頁回到前景、網路恢復時立刻向伺服器補抓（Chrome 會凍結背景分頁）
 * ③ 每 4 秒向伺服器核對一次（即時連線被網路切斷時的備援） */
function liveQuery(ref, handle) {
  if (!db) { handle(null); return () => {}; }
  let lastSig = '';
  const apply = (snap) => {
    const sig = snap.docs.map((d) => d.id + ':' + JSON.stringify(d.data())).join('|');
    if (sig !== lastSig) { lastSig = sig; handle(snap); }
  };
  const unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    setStatus(snap.metadata.fromCache ? 'connecting' : 'live');
    apply(snap);
  }, (err) => { console.warn('即時監聽中斷', err); setStatus('retrying'); });
  const refresh = () => getDocsFromServer(ref).then((snap) => { setStatus('live'); apply(snap); })
    .catch(() => setStatus('retrying'));
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 4000);
  return () => { unsub(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
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

export function watchWords(key, cb) {
  return liveQuery(db ? collection(db, `${SLUG}_wordcloud_${key}`) : null, (snap) => {
    if (!snap) return cb([], 0);
    const counts = {};
    snap.forEach((d) => {
      const w = String(d.data().word || '').trim();
      if (w) counts[w] = (counts[w] || 0) + 1;
    });
    cb(Object.entries(counts).sort((a, b) => b[1] - a[1]), snap.size);
  });
}

export const myVote = (key) => store.get(`${SLUG}_vote_${key}`);

export async function vote(key, opt) {
  if (!db) return false;
  await setDoc(doc(db, `${SLUG}_poll_${key}`, voterId()), { opt, updated_at: serverTimestamp() });
  store.set(`${SLUG}_vote_${key}`, opt);
  return true;
}

export function watchPoll(key, cb) {
  return liveQuery(db ? collection(db, `${SLUG}_poll_${key}`) : null, (snap) => {
    if (!snap) return cb({}, 0);
    const counts = {};
    snap.forEach((d) => { const o = d.data().opt; counts[o] = (counts[o] || 0) + 1; });
    cb(counts, snap.size);
  });
}
