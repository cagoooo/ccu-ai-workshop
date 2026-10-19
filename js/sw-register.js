/* Service Worker 註冊＋新版本通知列
 * 兩個偵測來源共用同一個通知列：① SW 的 updatefound ② 定時讀 version.json
 * 按下「重新整理載入」時才檢查 waiting 中的新版並切換，避免通知重複出現或按了沒反應 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var APP_VERSION = '__BUILD_VERSION__';            // 部署時自動填入，與 sw.js、version.json 一致
  if (APP_VERSION.indexOf('__') === 0) return;      // 未經建置的原始檔不註冊（避免開發時快取干擾）
  var SW_REG = null;
  var UPDATING = false;
  var RELOAD_FLAG = 'ccu2026ai_sw_reloaded';

  function applyUpdate() {
    if (UPDATING) return;
    UPDATING = true;
    var bar = document.getElementById('sw-update-bar');
    if (bar) bar.remove();
    if (SW_REG && SW_REG.waiting) {
      SW_REG.waiting.postMessage({ type: 'SKIP_WAITING' });   // → 新版接手 → controllerchange → 重新整理
      setTimeout(function () { location.reload(); }, 1500);  // 保底
    } else {
      location.reload();
    }
  }

  function showBar() {
    if (document.getElementById('sw-update-bar') || UPDATING) return;
    var style = document.createElement('style');
    style.textContent =
      '#sw-update-bar{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:12px;' +
      'background:#1f2328;color:#fff;padding:10px 12px 10px 18px;border-radius:999px;box-shadow:0 14px 34px -10px rgba(0,0,0,.5);' +
      "font:600 15px 'Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif;max-width:calc(100vw - 28px)}" +
      '#sw-update-bar button{cursor:pointer;border:none;border-radius:999px;font:inherit}' +
      '#sw-go{background:linear-gradient(135deg,#f7a654,#e8643a);color:#fff;padding:7px 16px}' +
      '#sw-x{background:transparent;color:#9aa4b2;padding:6px 8px}';
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'sw-update-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>✨ 簡報有新版本</span><button id="sw-go" type="button">重新整理載入</button><button id="sw-x" type="button" aria-label="稍後再說">✕</button>';
    document.body.appendChild(bar);
    document.getElementById('sw-x').onclick = function () { bar.remove(); };
    document.getElementById('sw-go').onclick = applyUpdate;
  }

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    SW_REG = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showBar();
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        // 有 controller 才代表是「更新」，第一次安裝不提示
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showBar();
      });
    });
    setInterval(function () { reg.update().catch(function () {}); }, 60000);
  }).catch(function () {});

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;       // 防止無限重新整理
      sessionStorage.setItem(RELOAD_FLAG, '1');
      setTimeout(function () { sessionStorage.removeItem(RELOAD_FLAG); }, 4000);
    } catch (e) { /* 無痕模式 */ }
    location.reload();
  });

  // 備援：讀 version.json。發現新版時先請 SW 抓更新，讓按下按鈕時 waiting 已就緒
  function checkVersion() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.version && d.version !== APP_VERSION && d.version.indexOf('__') !== 0) {
          if (SW_REG) SW_REG.update().catch(function () {});
          showBar();
        }
      }).catch(function () {});
  }
  ['focus', 'online', 'pageshow'].forEach(function (ev) { window.addEventListener(ev, checkVersion); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkVersion(); });
  setTimeout(checkVersion, 8000);
  setInterval(checkVersion, 180000);
})();
