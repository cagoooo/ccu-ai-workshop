// PDF 備份（截圖版）：逐頁拍投影時的畫面（1280×720、2 倍解析度、片段全部展開），再由 Python 組成 PDF
// 不用 Reveal 的 ?print-pdf：它的列印版面和投影不同，部分頁面（講師介紹、前後對比）會被擠出頁外
// 用法（先雙擊離線包的「啟動簡報.bat」或執行 server.ps1 -NoBrowser 開好 http://localhost:8790）：
//   npm i playwright-core        （放在暫存資料夾即可）
//   node pdf-shots.js <截圖資料夾> [只拍的頁碼，例如 1,2,28]
//   python -c "import fitz,glob;d=fitz.open();[d.new_page(width=1280,height=720).insert_image(fitz.Rect(0,0,1280,720),filename=f) for f in sorted(glob.glob('<截圖資料夾>/*.jpg'))];d.save('簡報備份.pdf',deflate=True)"
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const exe = path.join(process.env.USERPROFILE, 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', (r) => (r.request().url().startsWith('http://localhost:8790/') ? r.continue() : r.abort()));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto('http://localhost:8790/index.html#/2', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.Reveal && Reveal.isReady(), null, { timeout: 30000 });
  await p.addStyleTag({ content: '#chatw,.akai-footer,#theme-btn,.reveal .controls,.reveal .progress,.reveal .slide-number,#sw-update-bar{display:none!important}.vid-slide .op-play,.vid-slide .op-skip{display:none!important}' });
  await sleep(1500);
  // 影片頁拍封面圖：拿掉影片來源，瀏覽器就會改顯示 poster
  await p.evaluate(() => document.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); }));
  const total = await p.evaluate(() => Reveal.getTotalSlides());
  const only = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
  for (let h = 0; h < total; h++) {
    if (only.length && !only.includes(h + 1)) continue;
    await p.evaluate((i) => {
      Reveal.slide(i, 0, 99);                            // 99 = 片段全部展開
    }, h);
    await sleep(2600);                                   // 等進場動畫跑完
    await p.screenshot({ path: path.join(OUT, String(h + 1).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 88 });
  }
  console.log('拍了', total, '頁｜錯誤', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
