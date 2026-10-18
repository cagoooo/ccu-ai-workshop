"""把 js/firebase-config.js 的 __FIREBASE_*__ 佔位符換成環境變數的真實值。
用法：python .github/inject.py [網站根目錄]（預設為目前目錄）"""
import os
import sys
from pathlib import Path

KEYS = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
        'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID']

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
target = root / 'js' / 'firebase-config.js'
text = target.read_text(encoding='utf-8')
missing = [k for k in KEYS if not os.environ.get(k)]
if missing:
    sys.exit(f'缺少環境變數：{", ".join(missing)}')
for k in KEYS:
    text = text.replace(f'__{k}__', os.environ[k])
target.write_text(text, encoding='utf-8')
print(f'已注入 {len(KEYS)} 個 Firebase 設定到 {target}')
