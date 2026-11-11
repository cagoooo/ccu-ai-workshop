"""做離線備份包：網路被擋時，講台電腦雙擊「啟動簡報.bat」也能放簡報與影片。
外部套件（Reveal、GSAP、文字雲、QR、Firebase）全部下載進包裡；Google 字型改成不擋畫面，抓不到就用微軟正黑體。
用法：python scripts/build_offline.py [輸出資料夾]（預設 H:\\Seminar\\ccu-ai-workshop-離線版）
需要網路（下載套件）與 .env（本機建置用）；輸出資料夾不在 repo 裡，不會被提交。"""
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

here = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else here.parent / 'ccu-ai-workshop-離線版'
site = out / 'site'

# 1. 先做一份正常的本機建置（注入 Firebase 設定與版本號）
subprocess.run([sys.executable, str(here / 'scripts' / 'build_local.py')], check=True)
if out.exists():
    shutil.rmtree(out)
shutil.copytree(here / 'dist', site)

# 2. 下載外部套件
CDN = 'https://cdn.jsdelivr.net/npm/'
FB = 'https://www.gstatic.com/firebasejs/11.0.2/'
vendor_files = {
    CDN + 'reveal.js@5.1.0/dist/reset.css': 'vendor/reveal/reset.css',
    CDN + 'reveal.js@5.1.0/dist/reveal.css': 'vendor/reveal/reveal.css',
    CDN + 'reveal.js@5.1.0/dist/reveal.js': 'vendor/reveal/reveal.js',
    CDN + 'reveal.js@5.1.0/plugin/notes/notes.js': 'vendor/reveal/notes.js',
    CDN + 'gsap@3.13.0/dist/gsap.min.js': 'vendor/gsap/gsap.min.js',
    CDN + 'gsap@3.13.0/dist/SplitText.min.js': 'vendor/gsap/SplitText.min.js',
    CDN + 'wordcloud@1.2.2/src/wordcloud2.js': 'vendor/wordcloud2.js',
    CDN + 'qrcode-generator@1.4.4/qrcode.js': 'vendor/qrcode.js',
    FB + 'firebase-app.js': 'vendor/firebase/firebase-app.js',
    FB + 'firebase-firestore.js': 'vendor/firebase/firebase-firestore.js',
    FB + 'firebase-auth.js': 'vendor/firebase/firebase-auth.js',
}
for url, rel in vendor_files.items():
    dest = site / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    if rel.startswith('vendor/firebase/'):
        data = data.replace(FB.encode() + b'firebase-app.js', b'./firebase-app.js')
    dest.write_bytes(data)


def edit(path, fn):
    p = site / path
    p.write_text(fn(p.read_text(encoding='utf-8')), encoding='utf-8')


def offline_html(s):
    for url, rel in vendor_files.items():
        s = s.replace(url, rel)
    # Google 字型改成不擋畫面：網路被擋時不會卡住等字型
    s = re.sub(r'<link href="(https://fonts\.googleapis\.com/[^"]+)" rel="stylesheet" />',
               r'<link href="\1" rel="stylesheet" media="print" onload="this.media=\'all\'" />', s)
    # 離線版不用 Service Worker 與新版本提示
    s = re.sub(r'\s*<script src="js/sw-register\.js[^"]*"></script>', '', s)
    # 離線版不帶去課前問卷
    s = s.replace("Date.now() < Date.parse('2026-11-13T08:00:00+08:00')", 'false')
    return s


for name in ['index.html', 'join.html', 'survey.html']:
    edit(name, offline_html)
for js in (site / 'js').glob('*.js'):
    edit(f'js/{js.name}', lambda s: s.replace(FB, '../vendor/firebase/'))
(site / 'sw.js').unlink(missing_ok=True)

# 3. 檢查不再引用外部套件（字型除外）
left = []
for f in list(site.glob('*.html')) + list((site / 'js').glob('*.js')):
    for m in re.findall(r'https://(?:cdn\.jsdelivr\.net|www\.gstatic\.com)/[^\s"\')]+', f.read_text(encoding='utf-8')):
        left.append(f'{f.name}: {m}')
if left:
    raise SystemExit('還有外部套件沒換掉：\n' + '\n'.join(left))

# 4. 啟動程式與說明
shutil.copy2(here / 'scripts' / 'offline' / 'server.ps1', out / 'server.ps1')
(out / '啟動簡報.bat').write_bytes(
    b'@echo off\r\n'
    b'title CCU AI Workshop (offline)\r\n'
    b'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"\r\n'
    b'if errorlevel 1 pause\r\n')
(out / '使用說明.txt').write_text(
    'AI 數位教學實務工作坊｜離線版簡報\r\n'
    '\r\n'
    '什麼時候用：會場網路擋住網站、或正式網址打不開時。\r\n'
    '\r\n'
    '怎麼用：\r\n'
    '1. 把整個資料夾複製到講台電腦（不要只複製單一檔案）。\r\n'
    '2. 雙擊「啟動簡報.bat」，會跳出一個黑色視窗並自動打開瀏覽器。\r\n'
    '3. 簡報播放期間不要關掉黑色視窗；用完關掉它就結束。\r\n'
    '\r\n'
    '離線時可以用：全部投影片、動畫、片頭與宣傳影片、計時器、複製提示詞、深淺色切換。\r\n'
    '離線時不能用：聊天室、投票、文字雲、課前問卷統計、跟上簡報（這些需要網路）。\r\n'
    '若有網路但只是正式網址被擋，互動功能仍可能可以用。\r\n'
    '\r\n'
    '打不開時：\r\n'
    '- 學校電腦若禁止執行 PowerShell，改用同資料夾的 PDF 備份。\r\n'
    '- 黑色視窗顯示「找不到可用的連接埠」：關掉其他程式後再雙擊一次。\r\n'
    '\r\n'
    'Made with ❤ by 阿凱老師・桃園市龍潭區石門國民小學\r\n', encoding='utf-8-sig')
size = sum(f.stat().st_size for f in out.rglob('*') if f.is_file())
print(f'完成：{out}（{size / 1024 / 1024:.1f} MB）')
