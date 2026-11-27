#!/usr/bin/env python3
"""상점·마을 창 UI 부품 (PixelLab 'Create UI' 시트 한 장 → 부품 PNG 여러 장)

원본: tools/ref/pixellab/ui/kit.png (256x256, 투명 배경, 배치는 아래 LAYOUT 과 같게 놓고 뽑음)
결과: public/assets/ui/kit/<이름>.png  (1배 그대로. 코드가 9조각으로 늘려 그림 → render/townUI.ts 의 UIK_IN)

  python3 tools/make-ui-kit.py

- 부품은 좌표를 믿지 않고 투명 바탕으로 떨어진 덩어리를 찾아, 배치표에서 가장 가까운 자리의 이름을 붙임
  (PixelLab 이 상자보다 몇 px 크게 그려도 괜찮음)
- 버튼·줄에 글자가 박혀 나오면(라벨 칸을 비워도 'BUTTON' 이 들어갈 때가 있음) 밝은 주황 글자를 그 줄의 판 색으로 지움
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools/ref/pixellab/ui/kit.png")
OUT = os.path.join(ROOT, "public/assets/ui/kit")

# 배치표 (Create UI 에 놓은 상자: x, y, w, h) — 같은 배치로 다시 뽑으면 그대로 씀
LAYOUT = {
    "window": (8, 8, 128, 120),     # 창 테두리 (나무 + 철 모서리)
    "row_on": (144, 8, 104, 28),    # 고른 줄 (주황)
    "row": (144, 40, 104, 28),      # 목록 줄
    "tab": (144, 72, 48, 24),       # 분류
    "tab_on": (200, 72, 48, 24),    # 고른 분류
    "btn": (144, 104, 64, 24),      # 버튼
    "slot": (216, 104, 32, 32),     # 아이콘 칸
    "detail": (8, 136, 128, 72),    # 안쪽 판 (목록·상세 바탕)
    "btn_off": (144, 136, 64, 24),  # 꺼진 버튼
    "close": (220, 144, 24, 24),    # 닫기
    "price": (144, 168, 72, 40),    # 가격표
    "slot2": (220, 176, 28, 28),    # 작은 칸
    "bar": (8, 216, 240, 32),       # 아래 띠 (양 끝 경고 줄무늬)
}
TEXT_ERASE = {"btn", "btn_off", "row", "tab"}   # 주황 판(고른 줄·탭)은 주황 리벳까지 지워져서 뺌


def erase_text(b):
    """판 위에 박힌 밝은 주황 글자(+ 한 칸 그림자)를 줄마다 그 줄의 가장 흔한 판 색으로 덮음"""
    h, w = b.shape[:2]
    r, bb = b[..., 0].astype(int), b[..., 2].astype(int)
    txt = (r > 150) & (r - bb > 60)
    m = ndimage.binary_dilation(txt, iterations=1)
    m[:4, :] = False; m[h - 4:, :] = False; m[:, :6] = False; m[:, w - 6:] = False
    inner = m[4:h - 4, 6:w - 6]
    if m.sum() < 12 or inner.mean() > 0.3:   # 글자가 없거나, 판 자체가 주황(고른 줄·탭)이면 그대로
        return b, 0
    xs = np.arange(w)
    for y in range(h):
        if not m[y].any():
            continue
        keep = ~m[y] & (xs >= 6) & (xs < w - 6)
        if not keep.any():
            continue
        cols, cnt = np.unique(b[y][keep][:, :3], axis=0, return_counts=True)
        b[y, m[y], :3] = cols[cnt.argmax()]
    return b, int(m.sum())


def main():
    a = np.array(Image.open(SRC).convert("RGBA"))
    a[a[..., 3] < 128] = 0
    lab, n = ndimage.label(a[..., 3] > 0)
    found = {}
    for s in ndimage.find_objects(lab):
        x0, y0, x1, y1 = s[1].start, s[0].start, s[1].stop, s[0].stop
        if (x1 - x0) * (y1 - y0) < 64:
            continue
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        name = min(LAYOUT, key=lambda k: (LAYOUT[k][0] + LAYOUT[k][2] / 2 - cx) ** 2 + (LAYOUT[k][1] + LAYOUT[k][3] / 2 - cy) ** 2)
        if name in found:
            print("겹침:", name, "→ 더 큰 것 사용", file=sys.stderr)
            if found[name][2] * found[name][3] >= (x1 - x0) * (y1 - y0):
                continue
        found[name] = (x0, y0, x1 - x0, y1 - y0)
    os.makedirs(OUT, exist_ok=True)
    for name, (x, y, w, h) in sorted(found.items()):
        b = a[y:y + h, x:x + w].copy()
        b[lab[y:y + h, x:x + w] == 0] = 0       # 옆 부품 조각이 끼지 않게
        note = ""
        if name in TEXT_ERASE:
            b, k = erase_text(b)
            note = f" (글자 {k}px 지움)" if k else ""
        Image.fromarray(b, "RGBA").save(os.path.join(OUT, name + ".png"))
        print(f"ui/kit/{name}.png {w}x{h}{note}")
    miss = [k for k in LAYOUT if k not in found]
    if miss:
        print("못 찾은 부품:", miss, file=sys.stderr)


if __name__ == "__main__":
    main()
