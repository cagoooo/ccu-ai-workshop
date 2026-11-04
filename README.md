# AI 數位教學實務工作坊（中正大學師培中心，2026.11.13）

阿凱老師的 Reveal.js 互動簡報：用 Gemini Notebook、Gemini Canvas 與 AI 代理人，把一張課本照片變成一整套教學；上午另有一段 Gemini「技能」實作，帶學員把助教守則存成技能。

- 簡報：`index.html`（方向鍵換頁、`S` 開講者備忘稿、右上角切換深淺色）
  - 手機直拿時 Reveal 會改成上下捲動，投影片上下兩側會出現換頁箭頭和「上下滑動換頁」提示；手指滑過一次提示就收起，箭頭停幾秒自動隱藏，碰一下螢幕或換完頁再出現，第一頁沒有上箭頭、最後一頁沒有下箭頭
  - 手機直拿時切換深淺色，每頁底色會跟著換；兩個主題的填色與小字對比也一併加強
  - Gemini 技能單元：上午查核清單之後的 4 頁，依序是認識技能（Gem 轉成技能的說明與時程）、8 分鐘實作、名稱／說明／指令三欄範本（附複製按鈕）、驗收與備案；時程依 Google 官方說明（2026-11-01 查閱），頁面附官方說明連結供當天再確認
  - Padlet 資源專區：「今日地圖」頁放連結，謝謝頁放 QR Code（和教育科技創新專區並排）
- 學員手機參與頁：`join.html`（文字雲、投票、聊天室）
  - 導覽列第二顆是「📌 資源專區」，連到 Padlet；排在前面，手機上才不會被擠出畫面
  - 「📺 跟上簡報」開啟跟隨模式；手機直拿時會直接捲到講師目前那一頁
- 課前 AI 問卷：`survey.html`（工作坊前打開簡報會先到這頁，`survey.html#results` 看統計；2026-11-13 08:00 起不再自動帶過去，時間在 `index.html` 開頭）
  - 統計要等雲端資料回來才顯示，不會先閃出只有自己一份的結果
  - 頁尾分成品牌、活動時間地點、快速連結（看問卷統計、學員互動頁）與署名列四區
- 動畫層：`js/motion.js`（GSAP 時間軸，區塊依序淡入串接）
- 即時互動：`js/interact.js`（Firebase 專案 `akai-slide-interact`，集合前綴 `ccu2026ai_`）
- 管理員功能：`js/chat-admin.js`、`js/chat-widget.js`（簡報聊天室的管理區，可同步頁碼、清除全部訊息、清除投票與文字雲）
  - 「🧹 清除投票與文字雲」要在 4 秒內按同一顆兩次才會執行，課前問卷不受影響
- Firestore 規則：`firebase/firestore.rules`
  - 投票與課前問卷：每個瀏覽器自動用 Firebase 匿名登入取得一個身分，文件編號就是這個身分編號，規則只允許寫入自己那一份，所以可以改自己的答案，改不到別人的；改版前用舊代號留下的答案，新的那份會記下舊代號，統計時不重複計算
  - 文字雲、聊天訊息與表情：學員只能新增，不能修改或刪除
  - 清除資料：只有管理員帳號（Firebase 帳號密碼登入，密碼不在程式碼裡）可以刪除聊天室、投票與文字雲；課前問卷沒有刪除規則，管理員也刪不掉

Firebase 設定只在部署時由 `.github/inject.py` 從 GitHub Secrets 注入，原始碼只放佔位符。
本機預覽：`python scripts/build_local.py` 後開 `dist/`（讀取本機 `.env`）。

教育科技創新專區數據依據本機專案 H:\Akai v3.6.168（2026-10-18 盤點）。

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5) · 桃園市龍潭區石門國民小學

<!-- akai-edu-tools:backlink -->

---

## 🔗 阿凱老師教育工具集

這個專案是[阿凱老師教育工具集](https://cagoooo.github.io/Akai/)的 **#133 一張課本照片，長出一整套 AI 教學｜AI 數位教學實務工作坊**，由桃園市龍潭區石門國民小學阿凱老師開發。

- 工具介紹頁：[https://cagoooo.github.io/Akai/tool/133/](https://cagoooo.github.io/Akai/tool/133/)
- 線上使用：[https://cagoooo.github.io/ccu-ai-workshop/](https://cagoooo.github.io/ccu-ai-workshop/)
- 教學情境文章：[https://cagoooo.github.io/Akai/blog/ccu-ai-workshop-133-one-photo-whole-lesson/](https://cagoooo.github.io/Akai/blog/ccu-ai-workshop-133-one-photo-whole-lesson/)
- 全部工具（上百個教育工具與原始碼）：[https://cagoooo.github.io/Akai/](https://cagoooo.github.io/Akai/)

想改造成自己的版本？到上面的教學情境文章，按左下角「複製 AI 開發提示詞」，貼給 ChatGPT、Claude、Gemini 等 AI 助手，就能參考這份原始碼開始規劃。
