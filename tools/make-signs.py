#!/usr/bin/env python3
# 건물 간판 로고 PNG 만들기 → public/assets/signs/*.png
#
# 간판 글자는 게임 글꼴(웹 글꼴)에 따라 모양이 바뀌지 않도록, 그림(PNG)으로 박아 둡니다.
# 이 스크립트는 처음 한 번 만들 때 쓴 것이고, 이후에는 PNG를 도트 편집기로 직접 고쳐도 됩니다.
#   필요: Python 3 + Pillow, Noto Sans CJK KR Bold 글꼴(SIL OFL)
#   실행: python3 tools/make-signs.py [글꼴 경로]
# 그림 1픽셀 = 건물 도트 1픽셀 (게임에서 2배로 그려짐)
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "public/assets/ui/icon")
OUT = os.path.join(ROOT, "public/assets/signs")
FONT = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_INDEX = 1          # .ttc 안의 KR 글꼴
SIZE = 12

INK = (20, 21, 31, 255)
# 이름, 글자, 아이콘, 판(바탕, 밝은 테, 어두운 테), 글자(본색, 밝은 윗부분)
SIGNS = [   # 건물 이름은 건물 그림 속 로고로 대신함(tools/make-buildings.py). 여기엔 광산 입구 표지판만 (글자 없이)
    ("mine",    "",            "depth",   ("#5e3b25", "#8a5a3c", "#3a2414"), ("#ff9a4d", "#ffd8b0")),
]

def hexc(h, a=255):
    h = h.lstrip("#"); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def letters(text, fill, light, size=SIZE):
    """1비트 글자(안티앨리어싱 없음) + 윗부분 밝게 + 1px 테두리 + 아래 그림자"""
    f = ImageFont.truetype(FONT, size, index=FONT_INDEX)
    m = Image.new("L", (size * len(text) + 8, size + 8), 0)
    ImageDraw.Draw(m).text((2, 1), text, font=f, fill=255)
    m = m.point(lambda v: 255 if v > 110 else 0)
    l, t, r, b = m.getbbox()
    m = m.crop((l - 2, t - 2, r + 2, b + 3))
    w, h = m.size
    body = m.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = out.load()
    rows = [y for y in range(h) if any(body[x, y] for x in range(w))]
    top, bot = min(rows), max(rows)
    split = top + (bot - top) * 0.42
    ring = m.filter(ImageFilter.MaxFilter(3)).load()
    for y in range(h):
        for x in range(w):
            if body[x, y]:
                o[x, y] = hexc(light if y < split else fill)
            elif ring[x, y]:
                o[x, y] = INK
    # 아래쪽 그림자 1px
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0)); s = sh.load()
    for y in range(h - 1):
        for x in range(w):
            if o[x, y][3] and not o[x, y + 1][3]:
                s[x, y + 1] = (0, 0, 0, 90)
    sh.alpha_composite(out)
    return sh

def plate(name, text, icon, pal, col):
    lt = letters(text, *col) if text else Image.new("RGBA", (0, 0))
    ic = Image.open(os.path.join(ICON_DIR, icon + ".png")).convert("RGBA")
    ic = ic.crop(ic.getbbox())                                     # 아이콘 둘레의 빈칸은 잘라 냄
    pad, gap = 4, 4
    inner_h = max(lt.height, ic.height + 4)
    W = 1 + pad + ic.width + (gap + lt.width - 1 if text else 0) + pad + 1
    H = 1 + inner_h + 2 + 1
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base, hi, lo = (hexc(c) for c in pal)
    # 판: 테두리 / 바탕 / 윗줄 밝게 / 아랫줄 어둡게 / 모서리 깎기 / 못
    d.rectangle([0, 0, W - 1, H - 1], fill=INK)
    d.rectangle([1, 1, W - 2, H - 2], fill=base)
    d.line([1, 1, W - 2, 1], fill=hi)
    d.line([1, H - 2, W - 2, H - 2], fill=lo)
    for (x, y) in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
        im.putpixel((x, y), (0, 0, 0, 0))
    for (x, y) in [(2, 3), (W - 3, 3), (2, H - 4), (W - 3, H - 4)]:
        im.putpixel((x, y), hi); im.putpixel((x, y + 1), lo)
    # 아이콘 + 글자
    cy = (H - ic.height) // 2
    im.alpha_composite(ic, (1 + pad, cy))
    if text:
        im.alpha_composite(lt, (1 + pad + ic.width + gap - 2, (H - lt.height) // 2 + 1))
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name + ".png"))
    return im

# 마을 창 탭 이름 (판 없이 아이콘 + 글자). 게임에서는 1배로 그림. 고른 탭(on) / 나머지(off) 두 벌
TABS = [("shop", "상점", "chest"), ("craft", "제작", "drill"), ("furnace", "용광로", "furnace"), ("sell", "판매", "coin")]
TAB_COL = {"on": ("#ffd34d", "#fff3a8"), "off": ("#9aa3c8", "#c9cfe6")}

def tab(name, text, icon, state):
    lt = letters(text, *TAB_COL[state], size=14)                   # 탭은 1배로 그려서 간판보다 조금 큰 글자
    ic = Image.open(os.path.join(ICON_DIR, icon + ".png")).convert("RGBA")
    ic = ic.crop(ic.getbbox())
    if state == "off":                                               # 고르지 않은 탭은 아이콘도 살짝 어둡게
        px = ic.load()
        for y in range(ic.height):
            for x in range(ic.width):
                r, g, b, a = px[x, y]; px[x, y] = (r * 7 // 10, g * 7 // 10, b * 7 // 10, a)
    W, H = ic.width + 4 + lt.width - 2, max(ic.height, lt.height)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.alpha_composite(ic, (0, (H - ic.height) // 2))
    im.alpha_composite(lt, (ic.width + 2, (H - lt.height) // 2 + 1))
    im.save(os.path.join(OUT, "tab_" + name + "_" + state + ".png"))
    return im

if __name__ == "__main__":
    for s in SIGNS:
        im = plate(*s)
        print(s[0], im.size)
    for t in TABS:
        for st in ("on", "off"):
            im = tab(*t, st)
        print("tab", t[0], im.size)
