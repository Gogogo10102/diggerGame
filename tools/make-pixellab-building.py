#!/usr/bin/env python3
# 마을 건물(상점·제작소·용광로를 합친 한 채) = PixelLab 원본
#   python3 tools/make-pixellab-building.py    (원본: tools/ref/pixellab/town_building.png, 블록 32px 기준 도트)
#   → public/assets/buildings/town.png  불투명 부분만 잘라 2배(블록 64px 와 같은 배율). 그림 아래 끝 = 땅 표면
#     (원본 아래쪽의 돌 기단·풀·계단은 건물 일부로 그대로 씀)
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, "tools/ref/pixellab/town_building.png")).convert("RGBA")
a = np.array(src); a[a[..., 3] < 128] = 0; a[a[..., 3] > 0, 3] = 255        # 반투명 가장자리는 버림(도트)
im = Image.fromarray(a).crop(Image.fromarray(a).getbbox())
out = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
os.makedirs(os.path.join(ROOT, "public/assets/buildings"), exist_ok=True)
out.save(os.path.join(ROOT, "public/assets/buildings/town.png"))
print("buildings/town.png", out.size)

# ---- 로봇 차고 (PixelLab 원본 두 장: 기본 · 업그레이드) + 셔터 ----
#   원본: tools/ref/pixellab/garage_basic.png · garage_up.png (128px 캔버스, 문 자리가 같음)
#   → buildings/garage_0.png · garage_1.png : 두 장을 같은 상자로 잘라 2배 (문 자리가 겹치게)
#   → buildings/shutter.png : 문 구멍을 덮는 철판 셔터 (원본 문틀 색으로 그림). 코드가 위로 말아 올림
GAR = ["garage_basic.png", "garage_up.png"]
DOOR = (58, 80, 46, 36)                       # 원본 좌표의 문 구멍 (x, y, 폭, 높이). 아래 116 줄은 문턱이라 남김
gs = []
for f in GAR:
    g = np.array(Image.open(os.path.join(ROOT, "tools/ref/pixellab", f)).convert("RGBA"))
    g[g[..., 3] < 128] = 0; g[g[..., 3] > 0, 3] = 255
    gs.append(Image.fromarray(g))
box = [min(g.getbbox()[0] for g in gs), min(g.getbbox()[1] for g in gs), max(g.getbbox()[2] for g in gs), max(g.getbbox()[3] for g in gs)]
for i, g in enumerate(gs):
    c = g.crop(box)
    c.resize((c.width * 2, c.height * 2), Image.NEAREST).save(os.path.join(ROOT, f"public/assets/buildings/garage_{i}.png"))
    print(f"buildings/garage_{i}.png", (c.width * 2, c.height * 2))

def shutter(w, h):
    # 가로 골판 철판: 4줄마다 밝은 윗줄 · 중간 · 어두운 아랫줄 (문틀 위 철판 띠 색과 같은 계열)
    HI, MID, LO, LN = (108, 100, 101), (86, 80, 82), (64, 58, 58), (34, 28, 29)
    a = np.zeros((h, w, 4), np.uint8)
    rng = np.random.default_rng(7)
    for y in range(h - 4):
        col = [HI, MID, MID, LO][y % 4]
        if y % 8 == 7: col = LN                   # 두 골마다 이음매
        a[y, :, :3] = col
    a[:2, :, :3] = (np.array(a[:2, :, :3], float) * 0.6).astype(np.uint8)      # 위 철판 띠 밑 그늘
    for x in (0, 1): a[:h - 4, x, :3] = (np.array(a[:h - 4, x, :3], float) * (0.6 + 0.2 * x)).astype(np.uint8)   # 왼 문틀 그늘
    a[:h - 4, w - 1, :3] = (np.array(a[:h - 4, w - 1, :3], float) * 0.7).astype(np.uint8)
    for _ in range(w * h // 60):                  # 군데군데 녹·때 (도트 한 칸)
        x, y = rng.integers(2, w - 1), rng.integers(2, h - 5)
        if y % 4 in (1, 2): a[y, x, :3] = (92, 70, 56) if rng.random() < 0.5 else LO
    a[h - 4, :, :3] = LN; a[h - 3, :, :3] = (98, 90, 91); a[h - 2, :, :3] = (72, 66, 66); a[h - 1, :, :3] = LN   # 아래 막대
    cx = w // 2; a[h - 3:h - 1, cx - 4:cx + 4, :3] = LN; a[h - 3, cx - 3:cx + 3, :3] = (40, 34, 34)              # 손잡이 홈
    a[..., 3] = 255
    return Image.fromarray(a, "RGBA")
x, y, w, h = DOOR
sh = shutter(w, h)
sh.resize((w * 2, h * 2), Image.NEAREST).save(os.path.join(ROOT, "public/assets/buildings/shutter.png"))
print("buildings/shutter.png", (w * 2, h * 2))
print("GARAGE_FX door (2배, 잘린 그림 기준):", [(x - box[0]) * 2, (y - box[1]) * 2, w * 2, h * 2], "그림", ((box[2] - box[0]) * 2, (box[3] - box[1]) * 2))
