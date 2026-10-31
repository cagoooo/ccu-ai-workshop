// 即時互動（文字雲／投票）共用模組：簡報頁與手機參與頁都用這一份
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  initializeFirestore, collection, addDoc, doc, setDoc, onSnapshot, serverTimestamp, getDocsFromServer,
  query, orderBy, limitToLast, getCountFromServer, getDocFromServer,
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
  let lastSig = null;                                  // 第一次一定通知畫面，集合是空的也不會一直停在讀取中
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
  // 學員用「跟隨模式」看簡報時不跑核對（幾十支手機一起核對會很耗額度）
  if (watchdog && !document.documentElement.classList.contains('audience')) {
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

/* ---------- 課前問卷：一人一份、可修改 ----------
 * plans＝{ 工具代號: 方案 }，空物件代表「都還沒用過」
 * 用獨立的匿名代號，不和聊天室暱稱綁在一起，問卷答案才真的對不到人 */
export const SURVEY_TOOLS = [
  { id: 'gemini', label: 'Gemini', by: 'Google' },
  { id: 'claude', label: 'Claude', by: 'Anthropic' },
  { id: 'chatgpt', label: 'ChatGPT', by: 'OpenAI' },
  { id: 'grok', label: 'Grok', by: 'xAI' },
  { id: 'other', label: '其他 AI', by: '例如 Copilot、Perplexity' },
];
export const SURVEY_PLANS = [
  { id: 'paid', label: '付費訂閱' },
  { id: 'free', label: '免費版' },
  { id: 'unsure', label: '不確定' },
];

let memSurveyId = null;
function surveyId() {
  let id = store.get(`${SLUG}_survey_id`);
  if (!id) {
    id = memSurveyId || ('s' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36));
    memSurveyId = id;
    store.set(`${SLUG}_survey_id`, id);
  }
  return id;
}

export function mySurvey() {
  try { return JSON.parse(store.get(`${SLUG}_survey_answer`)); } catch { return null; }
}
// 跳過只算這次開啟：下次再打開簡報還會邀請填答
export function skipSurvey() { try { sessionStorage.setItem(`${SLUG}_survey_skip`, '1'); } catch { /* 無痕模式 */ } }

export async function submitSurvey(plans) {
  if (!db) throw new Error('尚未連線');
  // 網路被擋時 setDoc 會一直等下去，10 秒沒回應就請學員重試
  const timeout = new Promise((_, reject) => { setTimeout(() => reject(new Error('送出逾時')), 10000); });
  await Promise.race([setDoc(doc(db, `${SLUG}_survey`, surveyId()), { plans, updated_at: serverTimestamp() }), timeout]);
  store.set(`${SLUG}_survey_answer`, JSON.stringify(plans));
}

export function watchSurvey(cb) {
  return liveQuery(db ? collection(db, `${SLUG}_survey`) : null, (snap) => {
    const r = { total: 0, none: 0, anyPaid: 0, tools: {} };
    SURVEY_TOOLS.forEach((t) => { r.tools[t.id] = { paid: 0, free: 0, unsure: 0, total: 0 }; });
    if (snap) snap.forEach((d) => {
      const plans = Object.entries(d.data().plans || {});
      r.total += 1;
      if (!plans.length) r.none += 1;
      if (plans.some(([, p]) => p === 'paid')) r.anyPaid += 1;
      plans.forEach(([tool, plan]) => {
        if (!r.tools[tool]) return;
        r.tools[tool][plan] += 1;
        r.tools[tool].total += 1;
      });
    });
    cb(r);
  });
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

/* ---------- 簡報進度同步：講台（管理員）寫入目前頁碼，學員端即時跟上 ---------- */
export function watchLive(cb) {
  if (!db) { cb(null); return () => {}; }
  const ref = doc(db, `${SLUG}_live`, 'state');
  const read = (snap) => {
    if (!snap.exists()) return cb(null);
    const d = snap.data({ serverTimestamps: 'estimate' });
    const t = d.updated_at && d.updated_at.toMillis ? d.updated_at.toMillis() : Date.now();
    const fresh = Date.now() - t < 3 * 3600 * 1000;          // 老師關掉簡報忘了停同步 → 3 小時後自動視為暫停
    cb({ h: d.h, on: d.on !== false && fresh });
  };
  const unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    setStatus(snap.metadata.fromCache ? 'connecting' : 'live');
    read(snap);
  }, () => setStatus('retrying'));
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    setTimeout(() => { if (status !== 'live') getDocFromServer(ref).then(read).catch(() => {}); }, 6000);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => { unsub(); document.removeEventListener('visibilitychange', onVisible); };
}
