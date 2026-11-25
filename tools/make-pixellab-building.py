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
