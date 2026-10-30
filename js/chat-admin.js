/* 聊天室管理（只有講者電腦會載入）：輸入管理密碼登入後，可以清除全部聊天訊息
 * 密碼存在 Firebase 登入系統（雜湊保存），程式碼裡只有管理員帳號名稱；第一次輸入的密碼會成為管理密碼；
 * 資料庫規則只允許這個帳號刪除聊天室資料，學員端仍然只能新增。 */
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { collection, getDocs, writeBatch, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { app, db, SLUG } from './interact.js?v=__BUILD_VERSION__';

const ADMIN_EMAIL = 'ccu-admin@akai-slide-interact.firebaseapp.com';
const auth = app ? getAuth(app) : null;

export const onAdmin = (cb) => (auth ? onAuthStateChanged(auth, (u) => cb(!!u && u.email === ADMIN_EMAIL)) : cb(false));

const explain = (e) => {
  const c = e && e.code;
  if (c === 'auth/too-many-requests') return '嘗試太多次，請稍後再試';
  if (c === 'auth/network-request-failed') return '網路連線失敗';
  if (c === 'auth/operation-not-allowed' || c === 'auth/configuration-not-found') return '管理員登入功能尚未在 Firebase 開啟';
  if (c === 'auth/weak-password') return '密碼至少要 6 個字';
  return '密碼不正確';
};

// 登入；若管理員帳號還不存在，第一次輸入的密碼就成為管理密碼（回傳 'created'）
export async function login(password) {
  if (!auth) throw new Error('offline');
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    return 'login';
  } catch (e) {
    if (!['auth/invalid-credential', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(e && e.code)) throw new Error(explain(e));
  }
  try {
    await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    return 'created';
  } catch (e) {
    throw new Error(e && e.code === 'auth/email-already-in-use' ? '密碼不正確' : explain(e));
  }
}

export const logout = () => (auth ? signOut(auth) : Promise.resolve());

// 清除全部聊天訊息與表情（每批 400 筆）；回傳刪除數量
export async function clearChat() {
  let n = 0;
  for (const name of [`${SLUG}_chat`, `${SLUG}_react`]) {
    const snap = await getDocs(collection(db, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      const part = snap.docs.slice(i, i + 400);
      part.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      n += part.length;
    }
  }
  return n;
}

// 簡報進度同步：管理員登入且開啟時，每次翻頁（0.4 秒內只送最後一次）寫入目前頁碼
let syncOn = false;
let lastH = null;
let syncTimer = null;
function pushPage(force) {
  if (!syncOn || !auth || !auth.currentUser || !window.Reveal) return;
  const h = window.Reveal.getIndices().h;
  if (!force && h === lastH) return;
  lastH = h;
  setDoc(doc(db, `${SLUG}_live`, 'state'), { h, updated_at: serverTimestamp() }).catch((e) => console.warn('頁碼同步失敗', e));
}
if (window.Reveal) window.Reveal.on('slidechanged', () => { clearTimeout(syncTimer); syncTimer = setTimeout(pushPage, 400); });
export function setSync(on) { syncOn = !!on; if (syncOn) pushPage(true); }
