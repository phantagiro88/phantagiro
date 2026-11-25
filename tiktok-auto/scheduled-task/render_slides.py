#!/usr/bin/env python3
"""Render slide photomode 3:4 (1080x1440) gaya @drsakinahazami:
foto pudar ke hitam, aksen emas, tajuk serif besar, handle kanan bawah TANPA ikon TikTok.

Guna:
  python3 -I render_slides.py spec.json OUT_DIR

spec.json:
{
  "style": "style1" | "style2",
  "photo": "photos/foto-01.jpg",
  "title": "7 Perkara Wajib Tahu Sebelum Beli Emas Pertama",
  "points": [ {"head": "Tajuk mata", "body": "Penerangan ringkas 1-2 ayat"}, ... ],   # style1: 3-5 mata; style2: sehingga 8 mata
  "closing": "Ikut @drsakinahazami dan daftar Public Gold percuma. Link di bio."          # style2 sahaja
}
Output: OUT_DIR/slide-01.jpg ... (JPEG kualiti 95 — TikTok tak terima PNG) dan preview PNG dalam OUT_DIR/_png/
"""
import json, sys, os, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1440
GOLD = (212, 167, 58)
CREAM = (243, 234, 214)
BLACK = (10, 8, 4)
HANDLE = "@drsakinahazami"

SERIF_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
]
SANS_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]
SANS_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def pick(paths):
    for p in paths:
        if os.path.exists(p):
            return p
    found = glob.glob("/usr/share/fonts/**/*.ttf", recursive=True)
    if found:
        return found[0]
    raise SystemExit("Tiada fon ditemui")


SERIF, SANS, SANS_B = pick(SERIF_CANDIDATES), pick(SANS_CANDIDATES), pick(SANS_BOLD_CANDIDATES)
font = lambda path, size: ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title(draw, text, max_w, max_lines, start=104, stop=56):
    for size in range(start, stop - 1, -4):
        f = font(SERIF, size)
        lines = wrap(draw, text, f, max_w)
        if len(lines) <= max_lines:
            return f, lines, size
    f = font(SERIF, stop)
    return f, wrap(draw, text, f, max_w)[:max_lines], stop


def cover_photo(path):
    im = Image.open(path).convert("RGB")
    # isi 1080x1440 (crop tengah, utamakan bahagian atas supaya muka tak terpotong)
    r = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * r + 1), int(im.height * r + 1)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = max(0, int((im.height - H) * 0.15))
    return im.crop((x, y, x + W, y + H))


def fade_to_black(im, start=0.38, end=0.80):
    """Foto pudar ke hitam dari `start` hingga `end` ketinggian."""
    grad = Image.new("L", (1, H))
    for y in range(H):
        t = (y / H - start) / (end - start)
        t = min(1, max(0, t))
        grad.putpixel((0, y), int(255 * (t * t * (3 - 2 * t))))
    grad = grad.resize((W, H))
    return Image.composite(Image.new("RGB", (W, H), BLACK), im, grad)


def gold_rule(draw, x, y, w=120, t=5):
    draw.rectangle([x, y, x + w, y + t], fill=GOLD)


def handle(draw):
    f = font(SANS_B, 30)
    tw = draw.textlength(HANDLE, font=f)
    draw.text((W - 64 - tw, H - 84), HANDLE, font=f, fill=GOLD)  # kanan bawah, tiada ikon


def counter(draw, i, n):
    draw.text((64, 64), f"{i:02d} / {n:02d}", font=font(SANS_B, 32), fill=GOLD)


def swipe(draw):
    draw.text((64, H - 84), "SWIPE →", font=font(SANS_B, 30), fill=CREAM)


def slide_cover(photo, title, n_total, swipe_hint):
    im = fade_to_black(cover_photo(photo))
    d = ImageDraw.Draw(im)
    if n_total > 1:
        counter(d, 1, n_total)
    f, lines, size = fit_title(d, title, W - 128, 5)
    lh = int(size * 1.16)
    y = H - 170 - lh * len(lines)
    gold_rule(d, 64, y - 36)
    for ln in lines:
        d.text((64, y), ln, font=f, fill=CREAM)
        y += lh
    if swipe_hint:
        swipe(d)
    handle(d)
    return im


def plain_bg():
    im = Image.new("RGB", (W, H), BLACK)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 14, H], fill=GOLD)
    return im


def slide_point(i, n_total, head, body, last=False):
    im = plain_bg()
    d = ImageDraw.Draw(im)
    counter(d, i, n_total)
    fh, hl, hs = fit_title(d, head, W - 160, 3, start=76, stop=46)
    fb = font(SANS, 40)
    bl = wrap(d, body, fb, W - 160)
    block = len(hl) * int(hs * 1.18) + 48 + len(bl) * 60
    y = max(220, (H - block) // 2 - 40)
    gold_rule(d, 80, y - 44)
    for ln in hl:
        d.text((80, y), ln, font=fh, fill=CREAM)
        y += int(hs * 1.18)
    y += 36
    for ln in bl:
        d.text((80, y), ln, font=fb, fill=(214, 204, 180))
        y += 60
    if not last:
        swipe(d)
    handle(d)
    return im


def slide_single(photo, title, points):
    """Style 1: SATU slide — foto pudar ke hitam, tajuk + mata ringkas dengan penerangan pendek."""
    im = fade_to_black(cover_photo(photo), start=0.20, end=0.52)
    d = ImageDraw.Draw(im)
    fh = font(SANS_B, 38)
    fb = font(SANS, 31)
    # susun mata dari bawah ke atas supaya tajuk duduk betul di atasnya
    items = []
    for i, p in enumerate(points, 1):
        hl = wrap(d, f"{i:02d}  {p['head']}", fh, W - 128)
        bl = wrap(d, p.get("body", ""), fb, W - 128 - 62)
        items.append((hl, bl))
    total = sum(len(h) * 48 + len(b) * 40 + 22 for h, b in items)
    y = H - 130 - total
    ft, tl, ts = fit_title(d, title, W - 128, 4, start=88, stop=52)
    lh = int(ts * 1.15)
    ty = y - 50 - lh * len(tl)
    gold_rule(d, 64, ty - 34)
    for ln in tl:
        d.text((64, ty), ln, font=ft, fill=CREAM)
        ty += lh
    for hl, bl in items:
        for k, ln in enumerate(hl):
            d.text((64, y), ln, font=fh, fill=GOLD if k == 0 else CREAM)
            y += 48
        for ln in bl:
            d.text((64 + 62, y), ln, font=fb, fill=(214, 204, 180))
            y += 40
        y += 22
    handle(d)
    return im


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    os.makedirs(os.path.join(out, "_png"), exist_ok=True)
    style = spec.get("style", "style1")
    title, photo, pts = spec["title"], spec["photo"], spec.get("points", [])
    if style == "style1":
        # Style 1: SATU slide = foto Dr. Sakinah + tajuk hook sahaja (isi penuh ada dalam caption)
        slides = [slide_cover(photo, title, 1, False)]
    elif style == "style1_mata":
        slides = [slide_single(photo, title, pts[:5])]
    else:
        pts = pts[:8]
        n = 2 + len(pts) if spec.get("closing") else 1 + len(pts)
        slides = [slide_cover(photo, title, n, True)]
        for i, p in enumerate(pts, 2):
            slides.append(slide_point(i, n, p["head"], p.get("body", ""), last=(i == n and not spec.get("closing"))))
        if spec.get("closing"):
            slides.append(slide_point(n, n, "Jom mula hari ini", spec["closing"], last=True))
    for i, s in enumerate(slides, 1):
        s.save(os.path.join(out, f"slide-{i:02d}.jpg"), "JPEG", quality=95, subsampling=0)
        s.save(os.path.join(out, "_png", f"slide-{i:02d}.png"))
    print(f"{len(slides)} slide -> {out}")


if __name__ == "__main__":
    main()
