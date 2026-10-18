# AI 數位教學實務工作坊（中正大學師培中心，2026.11.13）

阿凱老師的 Reveal.js 互動簡報：用 Gemini Notebook、Gemini Canvas 與 AI 代理人，把一張課本照片變成一整套教學。

- 簡報：`index.html`（方向鍵換頁、`S` 開講者備忘稿、右上角切換深淺色）
- 學員手機參與頁：`join.html`（文字雲、投票）
- 動畫層：`js/motion.js`（GSAP 時間軸，區塊依序淡入串接）
- 即時互動：`js/interact.js`（Firebase 專案 `akai-slide-interact`，集合前綴 `ccu2026ai_`）
- Firestore 規則：`firebase/firestore.rules`

Firebase 設定只在部署時由 `.github/inject.py` 從 GitHub Secrets 注入，原始碼只放佔位符。
本機預覽：`python scripts/build_local.py` 後開 `dist/`（讀取本機 `.env`）。

教育科技創新專區數據依據本機專案 H:\Akai v3.6.168（2026-10-18 盤點）。

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5) · 桃園市龍潭區石門國民小學
