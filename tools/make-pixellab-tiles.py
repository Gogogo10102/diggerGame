#!/usr/bin/env python3
# 땅 블록 그림 = PixelLab 타일셋 (사이드뷰, 32px, Wang 내보내기 160x128)
#   python3 tools/make-pixellab-tiles.py      (원본: tools/ref/pixellab/tiles/layer<번호>_<이름>.png)
#   원본에서 '속 칸'(사방이 다 같은 재료인 칸, 시트의 (0,3) 칸)을 잘라 2배(64px)로 →
#     tiles/dirt/<지층>_<0~15>.png   블록 (16가지 모두 같은 칸: 이음매 없이 이어지는 무늬라 블록끼리 자연스럽게 이어짐)
#     tiles/back/<지층>_<0~3>.png    판 굴 뒷벽 (블록을 어둡게)
#     tiles/cave/back_<지층>_<0~3>.png 자연 동굴 뒷벽 (조금 더 어둡고 푸르게)
#     tiles/dirt/over_<지층>_<0~5>.png 예전 자갈 덧그림 → 비움 (새 무늬와 그림체가 달라서)
#     tiles/grass_0.png · grass_1.png 지표면 풀 (흙 타일셋 윗면 칸의 풀 띠)
#     tiles/cave/top_<지층>_<0~2>.png 동굴 천장 고드름 돌 (그 지층 블록 색, 계단식 1~2개)
#     tiles/wang/<지층>.png          Wang 시트 통째로 2배(320x256) → 굴 가장자리(풀·윗단·테두리)를 시트 그대로 그림 (draw.ts 의 wangEdge)
#       칸 배치(네 모서리 왼위·오른위·왼아래·오른아래, 1 = 흙)는 PixelLab 내보내기 고정 배치 = WANG_LAYOUT (draw.ts 의 WANG_AT 과 같음)
#   원본이 없는 지층은 흙(0번)을 그 지층 색으로 바꿔 씀 (config.ts 의 LAYERS 색)
#   단단한 블록(block_stone/hard/bedrock.png) → tiles/stone_0·1 · hard_0·1 · bedrock (속 칸) + tiles/wang/<이름>.png (가장자리)
import os, re, glob, colorsys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools/ref/pixellab/tiles")
OUT = os.path.join(ROOT, "public/assets/tiles")
N_LAYERS = 8
INNER = (0, 3)                     # Wang 160x128 시트에서 속 칸 자리 (칸 단위)
TS = 32

# 단단한 블록: 원본 block_<이름>.png → 블록 그림 경로들 (+ tiles/wang/<이름>.png)
BLOCKS = {"stone": ["stone_0.png", "stone_1.png"],      # 돌(12): 드릴로 못 팜, 다이너마이트로만
          "hard": ["hard_0.png", "hard_1.png"],         # 경암(16): 희귀 광물을 감싼 단단한 암석
          "bedrock": ["bedrock.png"]}                   # 암반(7): 절대 못 팜 (맨 아래·가장자리)

def layer_cols():
    s = open(os.path.join(ROOT, "src/game/core/config.ts"), encoding="utf-8").read()
    s = s[s.index("export const LAYERS"):]
    return [m.group(1) for m in re.finditer(r'base: "(#[0-9a-fA-F]{6})"', s)][:N_LAYERS]

def x2(a): return np.kron(a, np.ones((2, 2, 1), np.uint8))
def save(a, path): os.makedirs(os.path.dirname(path), exist_ok=True); Image.fromarray(a, "RGBA").save(path)

def inner_of(path):
    a = np.array(Image.open(path).convert("RGBA"))
    c, r = INNER
    t = a[r * TS:(r + 1) * TS, c * TS:(c + 1) * TS]
    assert (t[..., 3] > 0).all(), "속 칸이 꽉 차 있지 않음: " + path
    return t.copy()

# 흙 무늬를 다른 지층 색으로: 색상(hue)을 목표 색으로 돌리고 채도를 맞춤 (자갈 같은 무채색은 그대로)
def recolor(t, target):
    th, _, ts = colorsys.rgb_to_hsv(*[int(target[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    out = t.copy()
    for y in range(t.shape[0]):
        for x in range(t.shape[1]):
            r, g, b = t[y, x, :3] / 255
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if s < 0.15: continue
            r, g, b = colorsys.hsv_to_rgb(th, min(1, s * (ts / 0.55)), v)
            out[y, x, :3] = (int(r * 255), int(g * 255), int(b * 255))
    return out

def darken(t, k, tint=(0, 0, 0), ta=0.0):
    o = t.copy().astype(float)
    o[..., :3] = o[..., :3] * k * (1 - ta) + np.array(tint) * ta
    return o.clip(0, 255).astype(np.uint8)

WANG_LAYOUT = [["0001", "0011", "0010", "1110", "1101"],
               ["0101", "1111", "1010", "1011", "0111"],
               ["0100", "1100", "1000", "1001", "0110"],
               ["1111", "0000", "0000", "0000", "0000"]]

def wang_of(path):
    a = np.array(Image.open(path).convert("RGBA"))
    assert a.shape[:2] == (4 * TS, 5 * TS), "Wang 160x128 이 아님: " + path
    for r in range(4):                                              # 배치가 다르면 가장자리가 엉뚱하게 그려지니 확인
        for c in range(5):
            t = a[r * TS:(r + 1) * TS, c * TS:(c + 1) * TS, 3]
            got = "".join("1" if t[y, x] > 0 else "0" for y, x in ((8, 8), (8, 24), (24, 8), (24, 24)))
            assert got == WANG_LAYOUT[r][c], "Wang 배치가 다름 %s (%d,%d) %s" % (path, c, r, got)
    return a

def stalactites(t, seed):
    """동굴 천장 고드름 돌: 그 지층 블록 색으로 (검은 외곽선 없이 타일셋처럼 어두운 테두리만). 32px 칸 위쪽에 1~2개
       도트 계단식: 위에서 2~3줄마다 폭이 2px 씩 줄어 끝은 1px. 왼쪽 밝게 · 오른쪽·끝 어둡게"""
    rng = np.random.default_rng(seed)
    cols = np.unique(t[..., :3].reshape(-1, 3), axis=0)
    cols = cols[np.argsort(cols @ np.array([3, 6, 1]))]                 # 어두운 → 밝은
    pick = lambda q: cols[min(len(cols) - 1, int(q * (len(cols) - 1)))]
    edge, dark, mid, light = (pick(0.0) * 0.75).astype(np.uint8), pick(0.3), pick(0.6), pick(0.9)
    out = np.zeros((TS, TS, 4), np.uint8)
    n = int(rng.integers(1, 3))
    slots = [int(x) for x in rng.choice([5, 11, 17, 23], n, replace=False)]
    for cx in slots:
        cx += int(rng.integers(-1, 2))
        w = int(rng.choice([5, 7])); y = 0
        widths = [w + 2]                                            # 천장에 붙는 밑동은 조금 넓게
        while w >= 1:
            widths += [w] * int(rng.integers(2, 4)); w -= 2
        for y, ww in enumerate(widths):
            a0 = cx - ww // 2
            for x in range(a0, a0 + ww):
                if not (0 <= x < TS) or y >= TS: continue
                c = mid
                if x == a0 and ww > 2: c = light
                if x == a0 + ww - 1 and ww > 1: c = edge if ww > 2 else dark
                if x == a0 + ww - 2 and ww > 3: c = dark
                out[y, x, :3] = c; out[y, x, 3] = 255
        out[len(widths) - 1, cx, :3] = edge                          # 끝 한 점은 어둡게
    return out

def grass(path):
    a = np.array(Image.open(path).convert("RGBA"))
    t = a[0:TS, TS:2 * TS]                                          # (1,0) 칸 = 블록 윗면이 칸 가운데를 가로지름
    rows = [y for y in range(TS) if (t[y, :, 3] > 0).all()]
    top = rows[0]
    g = ((t[..., 1].astype(int) > t[..., 0].astype(int) + 10) & (t[..., 1] > t[..., 2]) & (t[..., 3] > 0))
    gy = [y for y in range(TS) if g[y].any()]
    bot = gy[-1] + 1                                                # 풀 띠 + 그 아래 그늘 한 줄
    band = t[top:bot + 1]
    out = np.zeros((TS, TS, 4), np.uint8)
    out[0:band.shape[0]] = band
    return out

if __name__ == "__main__":
    cols = layer_cols()
    files = {int(re.match(r"layer(\d+)", os.path.basename(p)).group(1)): p for p in glob.glob(os.path.join(SRC, "layer*.png"))}
    base = inner_of(files[0])
    made = []
    for L in range(N_LAYERS):
        t = inner_of(files[L]) if L in files else recolor(base, cols[L])
        made.append("원본" if L in files else "흙 색바꿈")
        w = wang_of(files[L]) if L in files else recolor(wang_of(files[0]), cols[L])
        save(x2(w), os.path.join(OUT, "wang", "%d.png" % L))
        big = x2(t)
        for v in range(16): save(big, os.path.join(OUT, "dirt", "%d_%d.png" % (L, v)))
        for v in range(6): save(np.zeros((64, 64, 4), np.uint8), os.path.join(OUT, "dirt", "over_%d_%d.png" % (L, v)))
        for v in range(4):
            save(x2(darken(t, 0.42)), os.path.join(OUT, "back", "%d_%d.png" % (L, v)))
            save(x2(darken(t, 0.34, (12, 20, 44), 0.25)), os.path.join(OUT, "cave", "back_%d_%d.png" % (L, v)))
        for v in range(3):                                          # 동굴 천장 고드름 돌 (지층마다 3가지)
            save(x2(stalactites(t, L * 10 + v)), os.path.join(OUT, "cave", "top_%d_%d.png" % (L, v)))
    gr = grass(files[0])
    save(x2(gr), os.path.join(OUT, "grass_0.png"))
    save(x2(gr[:, ::-1].copy()), os.path.join(OUT, "grass_1.png"))
    # 단단한 블록 3종(지층과 상관없이 어디서나 같은 그림): 속 칸 → 블록, 시트 통째 → 가장자리
    for name, outs in BLOCKS.items():
        p = os.path.join(SRC, "block_%s.png" % name)
        if not os.path.exists(p): continue
        big = x2(inner_of(p))
        for o in outs: save(big, os.path.join(OUT, o))
        save(x2(wang_of(p)), os.path.join(OUT, "wang", "%s.png" % name))
        made.append(name)
    print("지층·블록:", ", ".join("%d %s" % (i, m) if i < N_LAYERS else m for i, m in enumerate(made)))
