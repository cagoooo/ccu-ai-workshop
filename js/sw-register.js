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
    // 桌機：上方置中膠囊；手機（≤560px）：底部滿寬卡片、大按鈕好點、避開瀏海與底部手勢列
    style.textContent = [
      '#sw-update-bar{position:fixed;z-index:10000;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);',
      'box-sizing:border-box;display:flex;align-items:center;gap:12px;width:max-content;max-width:calc(100vw - 24px);',
      'background:#1f2328;color:#fff;padding:8px 8px 8px 20px;border-radius:999px;box-shadow:0 16px 36px -10px rgba(0,0,0,.55);',
      "font:600 16px/1.35 'Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif;animation:swIn .35s cubic-bezier(.2,.9,.3,1.2)}",
      '#sw-update-bar *{box-sizing:border-box}',
      '#sw-update-bar .sw-msg{display:flex;flex-direction:column;min-width:0}',
      '#sw-update-bar .sw-title{white-space:nowrap}',
      '#sw-update-bar .sw-sub{display:none;font-weight:400;font-size:14px;color:#c9d1d9}',
      '#sw-update-bar button{cursor:pointer;border:none;font:inherit;-webkit-tap-highlight-color:transparent}',
      '#sw-go{order:1;min-height:40px;padding:0 18px;border-radius:999px;color:#fff;white-space:nowrap;background:linear-gradient(135deg,#f7a654,#e8643a)}',
      '#sw-x{order:2;width:40px;height:40px;border-radius:50%;background:transparent;color:#9aa4b2;font-size:18px}',
      '#sw-go:focus-visible,#sw-x:focus-visible{outline:3px solid #ffd166;outline-offset:2px}',
      '@keyframes swIn{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}',
      '@media (max-width:560px){',
      '#sw-update-bar{left:12px;right:12px;top:auto;bottom:max(12px,env(safe-area-inset-bottom));transform:none;width:auto;max-width:none;',
      'display:grid;grid-template-columns:1fr auto;grid-template-areas:"msg x" "go go";gap:10px;padding:14px 10px 12px 16px;border-radius:18px;animation-name:swUp}',
      '#sw-update-bar .sw-msg{grid-area:msg;align-self:center}',
      '#sw-update-bar .sw-title{white-space:normal;font-size:17px}',
      '#sw-update-bar .sw-sub{display:block;margin-top:2px}',
      '#sw-x{grid-area:x;width:44px;height:44px;margin:-6px -2px 0 0}',
      '#sw-go{grid-area:go;width:100%;min-height:48px;font-size:17px;border-radius:14px}',
      '@keyframes swUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}}',
      '@media (prefers-reduced-motion:reduce){#sw-update-bar{animation:none}}',
    ].join('');
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'sw-update-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span class="sw-msg"><span class="sw-title">✨ 有新版本囉！</span><span class="sw-sub">重新整理就能看到最新內容</span></span>' +
      '<button id="sw-go" type="button">重新整理載入</button><button id="sw-x" type="button" aria-label="稍後再說">✕</button>';
    document.body.appendChild(bar);
    document.getElementById('sw-x').onclick = function () { bar.remove(); };
    document.getElementById('sw-go').onclick = applyUpdate;
  }

  if (/[?&]swdemo=1/.test(location.search)) setTimeout(showBar, 300);

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
