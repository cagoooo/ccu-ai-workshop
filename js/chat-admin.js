/* 聊天室管理（只有講者電腦會載入）：輸入管理密碼登入後，可以清除全部聊天訊息
 * 密碼存在 Firebase 登入系統（雜湊保存），程式碼裡只有管理員帳號名稱；
 * 資料庫規則只允許這個帳號刪除聊天室資料，學員端仍然只能新增。 */
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { collection, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { app, db, SLUG } from './interact.js?v=__BUILD_VERSION__';

const ADMIN_EMAIL = 'ccu-admin@akai-slide-interact.firebaseapp.com';
const auth = app ? getAuth(app) : null;

export const onAdmin = (cb) => (auth ? onAuthStateChanged(auth, (u) => cb(!!u && u.email === ADMIN_EMAIL)) : cb(false));

export async function login(password) {
  if (!auth) throw new Error('offline');
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  } catch (e) {
    const c = e && e.code;
    if (c === 'auth/too-many-requests') throw new Error('嘗試太多次，請稍後再試');
    if (c === 'auth/network-request-failed') throw new Error('網路連線失敗');
    if (c === 'auth/operation-not-allowed' || c === 'auth/configuration-not-found') throw new Error('管理員登入功能尚未在 Firebase 開啟');
    throw new Error('密碼不正確');
  }
}

export const logout = () => (auth ? signOut(auth) : Promise.resolve());

// 清除全部聊天訊息（每批 400 筆）；回傳刪除數量
export async function clearChat() {
  const snap = await getDocs(collection(db, `${SLUG}_chat`));
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    n += Math.min(400, snap.docs.length - i);
  }
  return n;
}
