/* Service Worker：版本號由部署流程自動填入，每次部署內容都會變 → 瀏覽器偵測到新版 → 提示使用者重新整理 */
const BUILD_VERSION = '__BUILD_VERSION__';
const PREFIX = 'ccu2026ai-';
const CACHE = PREFIX + BUILD_VERSION;
const PRECACHE = [
  './', './index.html', './join.html', './manifest.webmanifest',
  './favicon.svg', './favicon.ico', './apple-touch-icon.png',
  './css/deck.css', './js/deck.js', './js/interact.js', './js/firebase-config.js',
  './js/motion.js', './js/demo-circle.js', './js/opening.js', './js/sw-register.js', './media/akai-opening-poster.jpg',
  './images/app/icon-192.png', './images/app/icon-512.png',
];

self.addEventListener('install', (e) => {
  // 不自動 skipWaiting：讓新版進入 waiting，由使用者按「重新整理載入」決定何時套用
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const putCache = (req, res) => {
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;            // Firebase、CDN 等外部請求不攔截

  if (url.pathname.endsWith('/version.json')) {                // 版本檔永遠向網路要最新
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  // 圖片：先用快取（省流量），背景再更新
  if (/\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => putCache(req, res)).catch(() => cached);
      return cached || net;
    }));
    return;
  }
  // 網頁、程式、樣式：先問網路（拿到最新），斷線才用快取
  e.respondWith(fetch(req).then((res) => putCache(req, res)).catch(() =>
    caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
