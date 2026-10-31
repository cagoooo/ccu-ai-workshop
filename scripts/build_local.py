"""本機預覽：複製網站到 dist/，用 .env 的值注入 Firebase 設定（原始碼保持佔位符）。"""
import os
import shutil
import subprocess
import time
import sys
from pathlib import Path

here = Path(__file__).resolve().parent.parent
dist = here / 'dist'
shutil.rmtree(dist, ignore_errors=True)
dist.mkdir()
for name in ['index.html', 'join.html', 'survey.html', 'css', 'js', 'images', 'media', 'sw.js', 'version.json', 'manifest.webmanifest',
             'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-image.jpg']:
    src = here / name
    (shutil.copytree if src.is_dir() else shutil.copy2)(src, dist / name)
env = dict(os.environ)
for line in (here / '.env').read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
subprocess.run([sys.executable, str(here / '.github' / 'inject.py'), str(dist)], env=env, check=True)
version = sys.argv[1] if len(sys.argv) > 1 else 'dev-' + time.strftime('%Y%m%d-%H%M%S')
subprocess.run([sys.executable, str(here / '.github' / 'stamp_version.py'), str(dist), version], check=True)
