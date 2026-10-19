"""產生網站圖示全套與社群分享圖（OG 1200×630）。

主視覺：橘色漸層底＋翻開的課本＋AI 星光（呼應「一張課本照片，長出一整套 AI 教學」）。
文字用 Windows 微軟正黑體繪成點陣圖，部署後不依賴字型，不會出現方框字。
用法：python scripts/gen_brand_assets.py [原始封面底圖路徑]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'images' / 'app'
APP.mkdir(parents=True, exist_ok=True)
COVER = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / '_source_images' / 'bg_cover.png'
FONT_BOLD = 'C:/Windows/Fonts/msjhbd.ttc'

CORAL, AMBER, CYAN = (232, 100, 58), (247, 166, 84), (79, 195, 247)
INK, MUTED = (31, 35, 40), (91, 100, 112)
S = 1024  # 超取樣畫布


def gradient(size, c1, c2):
    """左上 → 右下的對角漸層。"""
    mask = Image.new('L', (256, 256))
    mask.putdata([(x + y) // 2 for y in range(256) for x in range(256)])
    mask = mask.resize(size, Image.BILINEAR)
    return Image.composite(Image.new('RGB', size, c2), Image.new('RGB', size, c1), mask)


def star(cx, cy, r_out, r_in):
    pts = []
    for i in range(8):
        r = r_out if i % 2 == 0 else r_in
        ang = -90 + i * 45
        from math import cos, radians, sin
        pts.append((cx + r * cos(radians(ang)), cy + r * sin(radians(ang))))
    return pts


def draw_mark(img, scale=1.0):
    """在 1024 畫布中央畫課本與星光；scale 用來縮進 maskable 安全區。"""
    d = ImageDraw.Draw(img)
    c = S / 2

    def P(x, y):
        return (c + (x - c) * scale, c + (y + 85 - c) * scale)

    # 課本陰影
    shadow = Image.new('L', img.size, 0)
    ImageDraw.Draw(shadow).polygon([P(190, 610), P(512, 668), P(834, 610), P(834, 640), P(512, 700), P(190, 640)], fill=90)
    img.paste((150, 55, 20), (0, 0), shadow.filter(ImageFilter.GaussianBlur(14 * scale)))
    # 左右頁
    d.polygon([P(512, 660), P(196, 604), P(196, 392), P(512, 448)], fill=(255, 255, 255))
    d.polygon([P(512, 660), P(828, 604), P(828, 392), P(512, 448)], fill=(255, 250, 244))
    d.line([P(512, 448), P(512, 660)], fill=(232, 205, 185), width=max(2, int(8 * scale)))
    # 頁面文字線
    for i, y in enumerate((478, 528, 578)):
        w = 18 if i < 2 else 10
        d.line([P(250, y - 28), P(250 + 190, y + 6)], fill=(250, 196, 170), width=max(2, int(w * scale)))
        d.line([P(774, y - 28), P(774 - 190, y + 6)], fill=(170, 220, 245), width=max(2, int(w * scale)))
    # AI 星光
    d.polygon([P(*p) for p in star(512, 250, 150, 38)], fill=(255, 255, 255))
    d.polygon([P(*p) for p in star(716, 168, 62, 16)], fill=(214, 243, 255))
    d.polygon([P(*p) for p in star(318, 186, 40, 11)], fill=(255, 236, 214))


def make_icon(maskable=False):
    img = gradient((S, S), CORAL, AMBER).convert('RGBA')
    draw_mark(img, 0.62 if maskable else 0.92)
    if maskable:
        return img
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def save_icons():
    rounded, full = make_icon(), make_icon(maskable=True)
    for size in (192, 512):
        rounded.resize((size, size), Image.LANCZOS).save(APP / f'icon-{size}.png', optimize=True)
        full.resize((size, size), Image.LANCZOS).save(APP / f'icon-{size}-maskable.png', optimize=True)
    # iOS 會自己裁圓角，所以用滿版底
    full_plain = gradient((S, S), CORAL, AMBER).convert('RGBA')
    draw_mark(full_plain, 0.8)
    full_plain.convert('RGB').resize((180, 180), Image.LANCZOS).save(ROOT / 'apple-touch-icon.png', optimize=True)
    rounded.resize((256, 256), Image.LANCZOS).save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    print('圖示完成：favicon.ico、apple-touch-icon.png、images/app/icon-*.png')


def fit_cover(img, w, h):
    r = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def center_text(d, y, text, font, fill, W):
    d.text(((W - d.textlength(text, font=font)) / 2, y), text, font=font, fill=fill)


def save_og():
    W, H = 1200, 630
    base = fit_cover(Image.open(COVER).convert('RGB'), W, H).convert('RGBA')
    panel = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle([150, 92, 1050, 538], radius=36, fill=(255, 255, 255, 222))
    base = Image.alpha_composite(base, panel.filter(ImageFilter.GaussianBlur(0.6)))
    d = ImageDraw.Draw(base)

    f_badge = ImageFont.truetype(FONT_BOLD, 26)
    f_title = ImageFont.truetype(FONT_BOLD, 66)
    f_sub = ImageFont.truetype(FONT_BOLD, 36)
    f_meta = ImageFont.truetype(FONT_BOLD, 25)

    badge = '國立中正大學師資培育中心｜2026.11.13（五）'
    bw = d.textlength(badge, font=f_badge) + 56
    d.rounded_rectangle([(W - bw) / 2, 130, (W + bw) / 2, 180], radius=25, fill=CORAL)
    center_text(d, 137, badge, f_badge, (255, 255, 255), W)
    center_text(d, 214, '一張課本照片，', f_title, INK, W)
    center_text(d, 296, '長出一整套 AI 教學', f_title, INK, W)
    center_text(d, 392, 'AI 數位教學實務工作坊', f_sub, (196, 71, 29), W)
    center_text(d, 458, '阿凱老師・桃園市龍潭區石門國民小學', f_meta, MUTED, W)

    base.convert('RGB').save(ROOT / 'og-image.jpg', quality=88, optimize=True, progressive=True)
    print(f'OG 圖完成：og-image.jpg（{(ROOT / "og-image.jpg").stat().st_size // 1024} KB）')


if __name__ == '__main__':
    save_icons()
    save_og()
