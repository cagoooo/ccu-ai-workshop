"""把網站檔案中的 __BUILD_VERSION__ 換成這次部署的版本號。
用法：python .github/stamp_version.py <網站根目錄> <版本號>
sw.js 的內容因此每次部署都不同 → 瀏覽器偵測到新版 Service Worker → 頁面跳出更新通知。"""
import sys
from pathlib import Path

root, version = Path(sys.argv[1]), sys.argv[2]
count = 0
for p in root.rglob('*'):
    if p.suffix in {'.html', '.js', '.json', '.webmanifest'} and p.is_file():
        text = p.read_text(encoding='utf-8')
        if '__BUILD_VERSION__' in text:
            p.write_text(text.replace('__BUILD_VERSION__', version), encoding='utf-8')
            count += 1
print(f'版本號 {version} 已寫入 {count} 個檔案')
