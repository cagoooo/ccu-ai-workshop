"""把圖標總表依格線裁切、依亮度去背，並把底圖壓成 JPG。"""
import sys
from pathlib import Path
from PIL import Image

D = Path(sys.argv[1])
SHEETS = {
    'icon_sheet_a.png': (2, 4, ['report', 'mindmap', 'slides', 'cards', 'infographic', 'quiz', 'video', 'audio']),
    'icon_sheet_b.png': (3, 3, ['target', 'scale', 'heart', 'wander', 'loop', 'mask', 'bell', 'code', 'socrates']),
}

def alpha_by_luma(img):
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            l = 0.299 * r + 0.587 * g + 0.114 * b
            a = 0 if l < 45 else 255 if l > 80 else int((l - 45) / 35 * 255)
            px[x, y] = (r, g, b, a)
    return img

for sheet, (rows, cols, names) in SHEETS.items():
    img = Image.open(D / sheet).convert('RGB')
    w, h = img.size
    gray = img.convert('L')
    for i, name in enumerate(names):
        r, c = divmod(i, cols)
        box = (c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows)
        cell = gray.crop(box).point(lambda v: 255 if v > 70 else 0)
        bb = cell.getbbox()
        x0, y0, x1, y1 = (bb[0] + box[0], bb[1] + box[1], bb[2] + box[0], bb[3] + box[1]) if bb else box
        side = int(max(x1 - x0, y1 - y0) * 1.18)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        sq = img.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((256, 256), Image.LANCZOS)
        alpha_by_luma(sq).save(D / f'icon_{name}.png', optimize=True)
        print('icon', name)

for p in sorted(D.glob('bg_*.png')):
    Image.open(p).convert('RGB').save(p.with_suffix('.jpg'), quality=82, optimize=True, progressive=True)
    print('jpg', p.stem, p.with_suffix('.jpg').stat().st_size // 1024, 'KB')
