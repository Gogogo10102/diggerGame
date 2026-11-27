#!/usr/bin/env python3
"""아이템 그림 (PixelLab 'Create images from style references (Pro)' 8x8 시트 → items/<id>.png)

원본: tools/ref/pixellab/items/<시트이름>.png  (256x256 = 32px 칸 8x8, 투명 배경)
고른 칸: 아래 PICKS 의 { 시트이름: { 칸번호(1~64, 왼쪽 위부터 가로로): 아이템 id } }
결과: public/assets/items/<id>.png (32x32 그대로) — 소모품은 ui/icon/<id>.png 도 같이

  python3 tools/make-pixellab-items.py            # 전부
  python3 tools/make-pixellab-items.py rocket     # 시트 하나만

스타일 참고(32px): tools/ref/pixellab/items/style_*.png  (Pro 도구의 Style images 에 넣은 것)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools/ref/pixellab/items")
OUT = os.path.join(ROOT, "public/assets/items")
UI = os.path.join(ROOT, "public/assets/ui/icon")
CELL = 32

# 시트마다 고른 칸 (2026-11-28 백팩 로켓부터)
PICKS = {
    "rocket": {17: "rocket1", 29: "rocket2", 36: "rocket3", 53: "rocket4"},
}
CONSUMABLE = {"fuel_s", "fuel_m", "fuel_l", "dyn_s", "dyn_l", "dyn_x", "ladder", "recall", "sup_w", "sup_s"}


def cell(sheet, n):
    x, y = (n - 1) % 8 * CELL, (n - 1) // 8 * CELL
    c = sheet.crop((x, y, x + CELL, y + CELL))
    a = c.split()[3].point(lambda v: 255 if v >= 128 else 0)   # 반투명 가장자리 없애기 (도트가 또렷하게)
    c.putalpha(a)
    return c


def main(only):
    for name, picks in PICKS.items():
        if only and name not in only:
            continue
        sheet = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
        assert sheet.size == (CELL * 8, CELL * 8), (name, sheet.size)
        for n, iid in picks.items():
            c = cell(sheet, n)
            c.save(os.path.join(OUT, iid + ".png"))
            if iid in CONSUMABLE:
                c.save(os.path.join(UI, iid + ".png"))
            print(f"{name} #{n} → items/{iid}.png")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
