#!/usr/bin/env python3
# 고해상도 그림 만들기 (타일 하나 = 그림 64x64 를 그대로 화면 64px 에)
#
#   python3 tools/make-hires.py          → public/assets 아래 PNG 들을 고해상도로 다시 만듦
#   (그 다음 npm run assets:manifest)
#
# 만드는 것: 흙·뒷벽(지층 8개 x 변형) · 돌 · 경암 · 기반암 · 기단 · 풀 · 장식 · 균열 · 땅속 광물 · 광물 아이콘 ·
#           떨어진 광물 · 주괴 · 해·구름 · 캐릭터(미니 굴착기) 부품 · 건물(기존 그림 4배 + 재질 결)
# 아이템·화면 아이콘은 tools/make-icons.py --size 32 로 만듦.
# 필요: Python 3 + numpy + scipy + Pillow
import os, sys, math, re
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixicon import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "public/assets")
R = 64                                          # 타일 그림 크기
rng = np.random.default_rng(20261116)

def hexrgb(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
def mix(a, b, t): return a * (1 - t) + b * t
def save(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA" if arr.shape[2] == 4 else "RGB").save(path)

# ---- config.ts 에서 지층·광물 색 읽기 (게임과 같은 색을 쓰려고) ----
CFG = open(os.path.join(ROOT, "src/game/core/config.ts"), encoding="utf-8").read()
LAYERS = [dict(base=m[0], hi=m[1], lo=m[2], peb=m[3]) for m in
          re.findall(r'base: "(#\w+)", hi: "(#\w+)", lo: "(#\w+)", peb: "(#\w+)"', CFG)]
ORE_COL = {int(k): [a, b, c] for k, a, b, c in re.findall(r'(\d+): \["(#\w+)", "(#\w+)", "(#\w+)"\]', CFG[CFG.index("ORE_COL"):CFG.index("LAYERS")])}

# ---- 이어지는(타일 경계에서 맞물리는) 값 잡음 ----
def tnoise(n, cells, seed):
    """n x n, 가로세로 cells 칸 격자, 경계에서 이어짐"""
    g = np.random.default_rng(seed).random((cells, cells))
    x = np.arange(n) * cells / n
    i0 = np.floor(x).astype(int); f = x - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % cells
    a = g[np.ix_(i0, i0)] * (1 - f)[None, :] + g[np.ix_(i0, i1)] * f[None, :]
    b = g[np.ix_(i1, i0)] * (1 - f)[None, :] + g[np.ix_(i1, i1)] * f[None, :]
    return a * (1 - f)[:, None] + b * f[:, None]

YY, XX = np.mgrid[0:R, 0:R]

def ramp6(L):
    lo, base, hi = hexrgb(L["lo"]), hexrgb(L["base"]), hexrgb(L["hi"])
    return [mix(lo, np.zeros(3), 0.35), lo, mix(lo, base, 0.5), base, hi, mix(hi, np.full(3, 255), 0.18)]

def shade_blob(img, cx, cy, rx, ry, col_lo, col, col_hi, rim=None, alpha=None):
    """둥근 덩이: 왼쪽 위 밝음 · 오른쪽 아래 어두움 · 테두리"""
    d = ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2
    m = d <= 1
    if rim is not None:
        mr = (((XX - cx) / (rx + 1)) ** 2 + ((YY - cy) / (ry + 1)) ** 2 <= 1) & ~m
        img[mr] = rim
    t = ((XX - cx) / rx + (YY - cy) / ry)                         # -2(왼위) ~ 2(오른아래)
    img[m] = col
    img[m & (t < -0.55)] = col_hi
    img[m & (t > 0.6)] = col_lo
    img[m & (d < 0.12) & (t < -0.2)] = mix(col_hi, np.full(3, 255), 0.4)
    return m

def wrap_blob(img, cx, cy, rx, ry, *a, **k):
    """타일 경계를 넘으면 반대쪽에 이어서 그림"""
    for dx in (0, -R, R):
        for dy in (0, -R, R):
            if -rx - 2 <= cx + dx <= R + rx + 2 and -ry - 2 <= cy + dy <= R + ry + 2:
                shade_blob(img, cx + dx, cy + dy, rx, ry, *a, **k)

# ---------------------------------------------------------------------
#  흙 · 뒷벽
# ---------------------------------------------------------------------
LOW = [tnoise(R, 2, 900 + i) for i in range(8)]           # 지층마다 같은 큰 얼룩(변형끼리 경계가 맞게)

def dirt_tile(li, v):
    L = LAYERS[li]; rp = ramp6(L)
    big = LOW[li]
    mid = tnoise(R, 8, 1000 + li * 31 + v)
    fine = tnoise(R, 32, 2000 + li * 31 + v)
    grain = np.random.default_rng(3000 + li * 31 + v).random((R, R))
    f = 0.35 * big + 0.35 * mid + 0.2 * fine + 0.18 * (grain - 0.5)
    q = np.clip((f - 0.12) / 0.7, 0, 0.999) * 4 + 1           # 톤 1~5
    qi = q.astype(int); fr = (q - qi)[..., None]
    lo_c = np.array(rp)[np.clip(qi, 0, 5)]; hi_c = np.array(rp)[np.clip(qi + 1, 0, 5)]
    img = lo_c * (1 - fr * 0.55) + hi_c * (fr * 0.55)
    r = np.random.default_rng(4000 + li * 31 + v)
    # 흙덩이
    for _ in range(6):                                    # 흙덩이: 바탕과 비슷한 톤으로 은은하게
        cx, cy, s = r.uniform(0, R), r.uniform(0, R), r.uniform(2.5, 4.5)
        wrap_blob(img, cx, cy, s * 1.3, s, mix(rp[2], rp[3], 0.5), rp[3], mix(rp[3], rp[4], 0.6))
    # 자갈
    peb = hexrgb(L["peb"])
    for _ in range(r.integers(0, 3)):                    # 자갈은 드문드문 (변형마다 0~2개)
        cx, cy, s = r.uniform(8, R - 8), r.uniform(8, R - 8), r.uniform(2.5, 5.5)
        shade_blob(img, cx, cy, s * r.uniform(1.0, 1.4), s, mix(peb, np.zeros(3), 0.35), peb, mix(peb, np.full(3, 255), 0.35), rim=mix(rp[0], np.zeros(3), 0.3))
    # 지층마다 다른 것
    if li == 0:   # 뿌리
        for _ in range(2):
            x, y = r.uniform(4, R - 4), r.uniform(0, R - 20)
            for k in range(int(r.uniform(10, 18))):
                xi, yi = int(x) % R, int(y) % R
                img[yi, xi] = hexrgb("#8a6a40"); img[yi, (xi + 1) % R] = hexrgb("#6a4e2c")
                x += r.uniform(-0.8, 0.8); y += 1
    if li == 1:   # 점토 줄
        for _ in range(4):
            x, y, w = r.uniform(0, R), r.uniform(0, R), int(r.uniform(6, 14))
            for k in range(w): img[int(y) % R, int(x + k) % R] = hexrgb("#a35a44"); img[int(y + 1) % R, int(x + k) % R] = hexrgb("#63372b")
    if li == 2:   # 암석 결
        for _ in range(3):
            y0 = r.uniform(0, R); x0 = r.uniform(0, R); w = int(r.uniform(14, 30))
            for k in range(w):
                yy = int(y0 + math.sin(k / 6) * 1.5) % R
                img[yy, int(x0 + k) % R] = hexrgb(L["lo"]) * 0.8; img[(yy + 1) % R, int(x0 + k) % R] = hexrgb(L["hi"])
    specks = {3: ["#9a86d6", "#c8b8ff"], 4: ["#ff7a3c", "#ffd08a"], 5: ["#9ff0ff", "#e0ffff"], 7: ["#8fa0ff", "#d8e0ff"]}
    if li in specks:
        a, b = hexrgb(specks[li][0]), hexrgb(specks[li][1])
        for _ in range(7 if li != 5 else 4):
            x, y = int(r.uniform(2, R - 3)), int(r.uniform(2, R - 3))
            if li == 5:   # 수정 조각
                for k in range(4): img[y + k - 2, x] = a; img[y + k - 2, x + 1] = b if k < 2 else a
            else:
                img[y, x] = b; img[y, x + 1] = a; img[y + 1, x] = a
    if li == 6:   # 화석 뼈
        for _ in range(2):
            x, y = int(r.uniform(8, R - 16)), int(r.uniform(8, R - 10))
            bone = hexrgb("#efe4c8")
            img[y:y + 2, x:x + 10] = bone; img[y - 2:y + 4, x:x + 2] = bone; img[y - 2:y + 4, x + 9:x + 11] = bone
            img[y + 2, x + 1:x + 10] = hexrgb("#a89a7a")
    return img

def back_tile(li, v):
    L = LAYERS[li]
    bgc = mix(hexrgb(L["base"]), hexrgb("#0a0605"), 0.62)
    a, b = mix(hexrgb(L["base"]), hexrgb("#0a0605"), 0.5), mix(hexrgb(L["base"]), hexrgb("#0a0605"), 0.75)
    f = 0.5 * tnoise(R, 4, 5000 + li) + 0.35 * tnoise(R, 16, 5100 + li * 7 + v) + 0.15 * np.random.default_rng(5200 + v).random((R, R))
    img = np.where((f > 0.62)[..., None], a, np.where((f < 0.4)[..., None], b, bgc)).astype(float)
    r = np.random.default_rng(5300 + li * 7 + v)
    for _ in range(5):
        cx, cy, s = r.uniform(0, R), r.uniform(0, R), r.uniform(3, 6)
        wrap_blob(img, cx, cy, s * 1.4, s, b, mix(a, bgc, 0.5), a)
    return img

# ---------------------------------------------------------------------
#  돌 · 경암 · 기반암 · 기단 · 균열
# ---------------------------------------------------------------------
def boulders(base_col, rocks, seed, bg, hl=0.4, crack=True):
    img = np.tile(hexrgb(bg), (R, R, 1)).astype(float)
    r = np.random.default_rng(seed)
    tex = tnoise(R, 16, seed + 1)
    for (x, y, w, h) in rocks:
        c = hexrgb(base_col) * (0.92 + 0.16 * r.random())
        m = ((XX - x - w / 2) / (w / 2)) ** 4 + ((YY - y - h / 2) / (h / 2)) ** 4 <= 1   # 둥근 네모 바위
        t = (XX - x) / w + (YY - y) / h
        col = c[None, None, :] * (0.88 + 0.24 * tex[..., None])
        img[m] = col[m]
        img[m & (t < 0.55)] = mix(img[m & (t < 0.55)], np.full(3, 255), 0.12)
        img[m & (t > 1.45)] = img[m & (t > 1.45)] * 0.7
        edge = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
        img[edge] = hexrgb(bg) * 0.7
        top = m & ~np.roll(m, 1, 0) & ~edge
        img[np.roll(top, 1, 0) & m] = mix(c, np.full(3, 255), hl)
        if crack:
            cx, cy = int(x + w * r.uniform(0.3, 0.6)), int(y + h * 0.25)
            for k in range(int(h * 0.5)):
                if 0 <= cy + k < R and 0 <= cx < R and m[cy + k, cx]: img[cy + k, cx] = c * 0.5
                cx += r.integers(-1, 2)
    return img

def stone_tile(v):
    rocks = [[2, 2, 28, 26], [32, 3, 30, 27], [2, 30, 24, 32], [27, 32, 35, 30]] if v == 0 else [[2, 2, 34, 24], [37, 2, 25, 30], [2, 28, 26, 34], [29, 34, 33, 28]]
    return boulders("#8a90a0", rocks, 600 + v, "#3d414d")

def hard_tile(v):
    rocks = [[1, 1, 26, 22], [28, 1, 35, 18], [1, 24, 18, 39], [20, 21, 24, 24], [45, 20, 18, 28], [20, 46, 43, 17]]
    img = boulders("#454b63", rocks, 700 + v, "#262a38", hl=0.25)
    r = np.random.default_rng(710 + v)
    for _ in range(6):
        x, y = int(r.uniform(4, R - 4)), int(r.uniform(4, R - 4))
        img[y, x] = hexrgb("#a8b4d8"); img[y - 1, x] = hexrgb("#6a7498")
    return img

def bedrock_tile():
    f = 0.6 * tnoise(R, 8, 800) + 0.4 * tnoise(R, 32, 801)
    img = np.where((f > 0.62)[..., None], hexrgb("#3a3a46"), np.where((f < 0.38)[..., None], hexrgb("#1d1d24"), hexrgb("#2b2b33")))
    return img.astype(float)

def plinth(top):
    img = np.tile(hexrgb("#5b606e"), (R, R, 1)).astype(float)
    r = np.random.default_rng(820 + top)
    rows = [(0, 20), (20, 22), (42, 22)] if top else [(0, 32), (32, 32)]
    for ri, (y, h) in enumerate(rows):
        x = -((ri * 13) % 24)
        while x < R:
            w = int(r.uniform(22, 34))
            x0, x1 = max(0, x + 1), min(R, x + w - 1)
            if x1 > x0:
                c = hexrgb("#8a90a0") * (0.9 + 0.2 * r.random())
                img[y + 1:y + h - 1, x0:x1] = c
                img[y + 1, x0:x1] = mix(c, np.full(3, 255), 0.3)
                img[y + h - 2, x0:x1] = c * 0.75
            x += w
    if top: img[0:3] = hexrgb("#b0b6c6"); img[3] = hexrgb("#5b606e")
    return img

def crack_img(stage):
    img = np.zeros((R, R, 4))
    r = np.random.default_rng(900)
    branches = [(32, 4, 0)] + ([(30, 24, -1), (34, 24, 1)] if stage >= 1 else []) + ([(26, 40, -1), (38, 42, 1), (32, 46, 0)] if stage >= 2 else [])
    for (x, y, d) in branches:
        n = 22 if stage == 0 else 18
        for k in range(n):
            xi, yi = int(x), int(y)
            if 0 <= xi < R - 1 and 0 <= yi < R - 1:
                img[yi, xi] = [10, 6, 3, 230]; img[yi, xi + 1] = [10, 6, 3, 200]
                img[yi, xi + 2 if xi + 2 < R else xi] = [255, 230, 190, 50]
            x += d * 0.6 + r.uniform(-0.7, 0.7); y += 1
    return img

# ---------------------------------------------------------------------
#  풀 · 장식
# ---------------------------------------------------------------------
def grass_tile(v):
    """흙 칸 위에 겹쳐 그리는 잔디 (아래는 투명 → 흙 변형이 그대로 보임)"""
    img = np.zeros((R, R, 4))
    r = np.random.default_rng(1000 + v)
    def put(y0, y1, x, col, a=255):
        img[y0:y1, x, :3] = hexrgb(col); img[y0:y1, x, 3] = a
    for x in range(R):
        h = int(10 + 6 * tnoise(R, 8, 1010 + v)[0, x] + r.uniform(0, 4))       # 잔디가 흙 쪽으로 내려온 길이
        put(0, h, x, "#437a31" if (x // 2) % 3 else "#4a8636")
        put(0, 3, x, "#4f8f3a"); put(0, 1, x, "#7cc255")
        if r.random() < 0.35: put(1, 3, x, "#a6e07a")
        put(h - 2, h, x, "#2f5c25")
        put(h, h + 2, x, "#1a1208", 110)                                       # 잔디 밑 그늘
    for _ in range(10):                                                         # 잔디 사이로 보이는 짙은 잎
        x = int(r.uniform(2, R - 3)); y = int(r.uniform(4, 9))
        put(y, y + 3, x, "#2f6a2a")
    if v:
        for k in range(3):
            x = int(r.uniform(6, R - 8)); col = ["#ffd34d", "#ff7a8a", "#ffffff"][k]
            img[1:4, x:x + 3, :3] = hexrgb(col); img[1:4, x:x + 3, 3] = 255; img[2, x + 1, :3] = hexrgb("#ff9a2a")
    return img

def deco_tiles():
    MAT["leafG"] = ["#1f4a1a", "#2f6a2a", "#4f8f3a", "#7cc255", "#c8f0a0"]
    MAT["petal"] = ["#7a1a2a", "#c43a4a", "#ff7a8a", "#ffc0c8", "#fff0f2"]
    MAT["petalY"] = ["#7a4a00", "#c48a10", "#ffd34d", "#ffe99a", "#fffbe0"]
    MAT["cap"] = ["#5a1410", "#8a2a28", "#c4403a", "#ef7a6a", "#ffd0c8"]
    MAT["stem"] = ["#7a6a50", "#b8a888", "#e8dcc4", "#f6eedc", "#ffffff"]
    MAT["rock"] = ["#2a2e38", "#4a4f5e", "#8a90a0", "#b0b6c6", "#e0e4ee"]
    blades = lambda xs: U_(*[poly([(x - 0.5, 16), (x + 0.5, 16), (x + 0.3 * s, 16 - h)]) for x, h, s in xs])
    D = [
        [L(blades([(4, 6, -1), (6, 8, 0.5), (8, 7, 1), (10, 5, 1.5), (5.5, 4, -1.5), (9, 9, 0)]), "leafG", "flat", 3)],
        [L(line(8, 9, 8, 16, 0.8), "leafG", "fix", 2), L(ell(6.4, 12.4, 1.4, 0.6), "leafG", "fix", 3), L(ell(9.6, 13.2, 1.4, 0.6), "leafG", "fix", 3),
         L(U_(ell(8, 6.4, 1.4, 1.4), ell(6.4, 8, 1.4, 1.4), ell(9.6, 8, 1.4, 1.4), ell(8, 9.6, 1.4, 1.4)), "petal", "dome", 2.6, rr=1),
         L(ell(8, 8, 0.9, 0.9), "petalY", "fix", 3)],
        [L(rrect(3.4, 11.4, 12.6, 16, 1.6), "rock", "dome", 2.4, rr=2, spec=[(5, 12.4)])],
        [L(rrect(7, 11, 9, 16, 0.6), "stem", "flat", 2), L(D_(ell(8, 11, 4.4, 3.6), rect(0, 11, 16, 16)), "cap", "dome", 2.6, rr=1.6, spec=[(6, 8.6)]),
         L(U_(ell(6.4, 9.6, 0.6, 0.6), ell(9.4, 8.6, 0.7, 0.7)), "stem", "fix", 4, sep=False)],
        [L(U_(line(6, 11, 6, 16, 0.6), line(8, 9, 8, 16, 0.7), line(10, 11.4, 10, 16, 0.6)), "leafG", "fix", 2),
         L(U_(ell(6, 10.4, 1.2, 1.2), ell(8, 8.4, 1.5, 1.5), ell(10, 10.8, 1.2, 1.2)), "petalY", "dome", 2.6, rr=0.8)],
        [L(U_(ell(8, 12.4, 6, 3.6), ell(5.4, 11, 3, 2.6), ell(10.6, 10.6, 3.2, 2.8), ell(8, 9.6, 3, 2.6)), "leafG", "dome", 2.4, rr=2.4, spec=[(6, 9.4)]),
         L(U_(ell(11.4, 9.4, 0.6, 0.6), ell(5, 12.6, 0.6, 0.6)), "petal", "fix", 3, sep=False)],
    ]
    return [render(d, R, "B", []) for d in D]

# ---------------------------------------------------------------------
#  광물 (땅속 · 아이콘 · 떨어진 것 · 주괴)
# ---------------------------------------------------------------------
# 땅속 광물: 변형마다 덩이 자리 고정 (16칸 좌표). sprites.ts 의 ORE_HI_SPARK 와 같음
ORE_HI_SLOTS = [[(4.5, 4.5), (11.5, 6), (6, 11.5), (12, 12.5)], [(5, 5.5), (11, 4), (10, 11), (4, 12)],
                [(11.5, 4.5), (4.5, 6), (10, 11.5), (4, 12.5)], [(11, 5.5), (5, 4), (6, 11), (12, 12)]]

def ore_ramp(id_):
    a, b, c = [hexrgb(x) for x in ORE_COL[id_]]
    return ["#%02x%02x%02x" % tuple(int(v) for v in col) for col in (c * 0.55, c, b, a, mix(a, np.full(3, 255), 0.6))]

def lump(id_, cx, cy, s):
    m = "ore%d" % id_
    if id_ in (5,):                         # 다이아: 팔면체 결정
        return [L(poly([(cx - 1.7 * s, cy), (cx, cy - 2.4 * s), (cx + 1.7 * s, cy), (cx, cy + 2.2 * s)]), m, "fix", 3),
                L(poly([(cx, cy - 2.4 * s), (cx + 1.7 * s, cy), (cx, cy + 2.2 * s)]), m, "fix", 2, sep=False),
                L(poly([(cx - 1.7 * s, cy), (cx + 1.7 * s, cy), (cx, cy + 2.2 * s)]), m, "fix", 1, sep=False),
                L(line(cx - 0.8 * s, cy - 0.6 * s, cx - 0.2 * s, cy - 1.6 * s, 0.5 * s), m, "fix", 4, sep=False)]
    if id_ in (9, 11):                      # 에메랄드 · 미스릴: 기둥 결정
        return [L(poly([(cx - 1.1 * s, cy + 2 * s), (cx - 1.1 * s, cy - 1.2 * s), (cx, cy - 2.4 * s), (cx + 1.1 * s, cy - 1.2 * s), (cx + 1.1 * s, cy + 2 * s)]), m, "fix", 3),
                L(poly([(cx, cy - 2.4 * s), (cx + 1.1 * s, cy - 1.2 * s), (cx + 1.1 * s, cy + 2 * s), (cx, cy + 2 * s)]), m, "fix", 2, sep=False),
                L(line(cx - 0.5 * s, cy - 0.8 * s, cx - 0.5 * s, cy + 1.2 * s, 0.4 * s), m, "fix", 4, sep=False)]
    if id_ in (6, 3):                       # 석탄 · 철: 각진 조각
        return [L(poly([(cx - 1.8 * s, cy - 0.4 * s), (cx - 0.6 * s, cy - 1.6 * s), (cx + 1.6 * s, cy - 1.0 * s), (cx + 1.8 * s, cy + 1.0 * s), (cx + 0.2 * s, cy + 1.7 * s), (cx - 1.5 * s, cy + 1.1 * s)]), m, "dome", 2.4, rr=0.9 * s, spec=[(cx - 0.6 * s, cy - 0.6 * s)])]
    if id_ == 8:                            # 은: 울퉁불퉁한 덩이 + 금속 결
        return [L(U_(ell(cx - 0.5 * s, cy + 0.2 * s, 1.4 * s, 1.2 * s), ell(cx + 0.8 * s, cy - 0.5 * s, 1.1 * s, 1.0 * s)), m, "dome", 2.5, rr=0.9 * s, spec=[(cx - 0.9 * s, cy - 0.3 * s)]),
                L(line(cx - 1.2 * s, cy + 0.6 * s, cx + 0.9 * s, cy - 0.4 * s, 0.35 * s), m, "fix", 4, sep=False)]
    return [L(ell(cx, cy, 1.7 * s, 1.45 * s), m, "dome", 2.5, rr=1.0 * s, spec=[(cx - 0.6 * s, cy - 0.5 * s)])]   # 구리·금·루비: 둥근 알

def ore_world(id_, v):
    MAT["ore%d" % id_] = ore_ramp(id_)
    lays = []
    for k, (cx, cy) in enumerate(ORE_HI_SLOTS[v]):        # 덩이 크기를 섞어서 (큰 것 하나, 작은 것 하나)
        lays += lump(id_, cx, cy, [1.45, 1.05, 1.2, 0.8][(k + v) % 4])
    im = render(lays, R, "B", []).astype(float)
    # 흙에 박힌 느낌: 아래·오른쪽에 그늘
    a = im[..., 3] > 0
    sh = np.roll(np.roll(a, 2, 0), 1, 1) & ~a
    im[sh] = [25, 14, 6, 120]
    return im

def ore_icon(id_, N=32):
    MAT["ore%d" % id_] = ore_ramp(id_)
    lays = lump(id_, 6.0, 9.6, 1.65) + lump(id_, 11.0, 6.4, 1.15)
    return render(lays, N, "B", [])

def ore_drop(id_, N=24):
    MAT["ore%d" % id_] = ore_ramp(id_)
    return render(lump(id_, 8, 8.4, 2.4), N, "B", [])

def bar_icon(k, pal, N=32):
    MAT["bar" + k] = ["#%02x%02x%02x" % tuple(int(v) for v in col) for col in
                      (hexrgb(pal[2]) * 0.55, hexrgb(pal[2]), hexrgb(pal[1]), hexrgb(pal[0]), mix(hexrgb(pal[0]), np.full(3, 255), 0.6))]
    top = poly([(4.6, 4.4), (11.4, 4.4), (13.6, 7.6), (2.4, 7.6)])
    front = poly([(2.4, 7.6), (13.6, 7.6), (14.8, 12.6), (1.2, 12.6)])
    return render([L(front, "bar" + k, "flat", 2), L(top, "bar" + k, "flat", 3, spec=[(5, 5)]),
                   L(rrect(6.0, 9.0, 10.0, 11.2, 0.4), "bar" + k, "inset", 2, sep=False)], N, "B", [])

# ---------------------------------------------------------------------
#  하늘
# ---------------------------------------------------------------------
def sun():
    MAT["sun"] = ["#c98a1a", "#ffcd3c", "#ffe066", "#fff3a8", "#fffbe0"]
    return render([L(ell(8, 8, 6.6, 6.6), "sun", "dome", 3.0, rr=4, spec=[(5.6, 5.4)])], 64, "A", [])
def cloud():
    MAT["cloud"] = ["#9cc4e8", "#c8e2f8", "#f2f8ff", "#ffffff", "#ffffff"]
    # 80x80 으로 그려 가운데 32줄만 씀 (16칸 좌표 y 4.8~11.2 안에 들어가게)
    im = render([L(U_(ell(5, 9, 3.4, 2.0), ell(9, 7.6, 4.0, 2.6), ell(12.6, 9.2, 2.8, 1.8), rect(2.4, 9, 14.8, 11)), "cloud", "dome", 2.8, rr=2.0)], 80, "A", [])
    return im[24:56]

# ---------------------------------------------------------------------
#  캐릭터: 드릴 로봇 부품 (그림 120x120 = 화면 그대로, 몸통 칸 36~84, 발 = y 84)
#   옆에서 본 약간 3D: 옆면은 밝게, 앞면(오른쪽)·궤도 윗면·뒤쪽 궤도가 살짝 보임. 굵은 외곽선(2px)
#   통통한 노란 몸 + 회색 머리·파란 외눈 + 귀 같은 안테나 두 개, 관절 없는 통짜 팔 끝에 드릴
#   body_<자세>  : 색 그대로 (몸·머리·어깨·팔·드릴 척)
#   trk_<0|1>    : 궤도 (회색 → 게임에서 궤도 단계 색으로 바꿔 칠함)
#   cw · lamp    : 등 탱크(화물칸 단계 색) · 안테나 끝 불빛(조명 색)
#   bit_<자세>_<0|1> : 드릴 원뿔(회색 → 드릴 단계 색), 홈이 밀린 두 장면
# ---------------------------------------------------------------------
MN = 120
def P(f):                                        # 화면 px 좌표로 쓴 도형 → 16칸 좌표계
    return lambda U, V: f(U * MN / 16, V * MN / 16)
GRAY = ["#202020", "#505050", "#808080", "#c0c0c0", "#ffffff"]
def thick_outline(im):
    """바깥에 1px 더 짙은 테두리 (화면에서 작게 보여도 도트 윤곽이 또렷하게)"""
    a = im[..., 3] > 0
    d = a.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): d |= np.roll(np.roll(a, dy, 0), dx, 1)
    out = im.copy(); out[d & ~a] = [14, 15, 20, 255]
    return out
def miner_parts():
    MAT["sy"] = ["#5a3400", "#c47e00", "#ffbe1a", "#ffe27a", "#fff6c8"]
    MAT["syd"] = ["#3a2200", "#8a5600", "#c98a10", "#e8b030", "#ffe08a"]      # 앞면(그늘진 면) 노랑
    MAT["chr"] = ["#0e1014", "#22252d", "#3a3f4b", "#5a6170", "#8a92a2"]
    MAT["hd"] = ["#2a2f3a", "#6a7384", "#b4bcca", "#e2e7ef", "#ffffff"]
    MAT["eye"] = ["#0a2a5a", "#1a5ac0", "#4aa8ff", "#b8e4ff", "#ffffff"]
    MAT["gry"] = GRAY
    out = {}
    def R_(lays): return render(lays, MN, "B", [])
    s16 = lambda v: v * 16 / MN
    stripes = [L(P(U_(*[rect(x, 66.5, x + 4, 69.5) for x in range(42, 77, 9)])), "chr", "fix", 2, sep=False)]
    fender = [L(P(rrect(37, 61, 81, 71, 3)), "sy", "flat", 2), L(P(rect(38, 67, 80, 70)), "syd", "fix", 1, sep=False)] + stripes
    shell = [L(P(rrect(37, 34, 74, 66, 12)), "sy", "dome", 2.6, rr=2.4, spec=[(s16(44), s16(41))]),       # 몸 옆면
             L(P(D_(rrect(37, 34, 74, 66, 12), rect(0, 0, 64, 120))), "syd", "dome", 2.2, rr=1.2),         # 앞면(오른쪽, 그늘)
             L(P(rrect(46, 50, 60, 63, 3)), "chr", "flat", 1),                                              # 배 쪽 어두운 판
             L(P(U_(rect(49, 54, 57, 55.4), rect(49, 57.5, 57, 58.9))), "chr", "fix", 3, sep=False)]
    head = [L(P(rrect(41, 21, 66, 42, 7)), "hd", "flat", 3),
            L(P(D_(rrect(42, 22, 65, 41, 6), rect(0, 0, 120, 25.5), rect(0, 0, 44.5, 120))), "hd", "fix", 3, sep=False),
            L(P(D_(rrect(41, 21, 66, 42, 7), rect(0, 0, 58, 120))), "hd", "flat", 2),                      # 머리 앞면(살짝 그늘)
            L(P(D_(rrect(41, 21, 66, 42, 7), rect(0, 25.5, 120, 120), rect(58, 0, 120, 120))), "hd", "fix", 4, sep=False),   # 윗면 빛
            L(P(ell(60.5, 31, 5.6, 5.6)), "chr", "fix", 1, sep=False),
            L(P(ell(60.5, 31, 4.3, 4.3)), "eye", "dome", 2.8, rr=0.5),
            L(P(rect(58.4, 28.6, 60.4, 30.6)), "eye", "fix", 4, sep=False),
            L(P(U_(rect(45, 34, 52, 35.2), rect(45, 37, 52, 38.2))), "hd", "fix", 1, sep=False),
            L(P(line(57, 22, 58.5, 12, 3)), "hd", "flat", 2),                                            # 앞 안테나(귀)
            L(P(line(48, 22, 46, 12, 3)), "hd", "flat", 1)]                                              # 뒤 안테나
    pad = [L(P(ell(62, 52, 8, 8)), "sy", "dome", 2.7, rr=1.4, spec=[(s16(59), s16(48))]),                # 어깨(팔 뿌리)
           L(P(D_(ell(62, 52, 8, 8), rect(0, 0, 66, 120))), "syd", "dome", 2.2, rr=0.7)]
    # 관절 없는 통짜 팔 + 드릴 척. 척 자리·드릴 축 자리는 draw.ts 의 축 그리기와 맞춤
    ARM = {"side": ((60, 56, 80, 56), (77, 45, 87, 67)), "down": ((66, 56, 76.5, 82), (63, 80, 90, 92)), "up": ((67, 50, 74, 30), (60, 19, 88, 32))}
    for mode, ((ax0, ay0, ax1, ay1), (x0, y0, x1, y1)) in ARM.items():
        arm = [L(P(line(ax0, ay0, ax1, ay1, 9 if mode == "side" else 10)), "steel", "dome", 2.4, rr=0.9),
               L(P(rrect(x0, y0, x1, y1, 3.5)), "chr", "dome", 2.2, rr=0.7),
               L(P(rect(x0 + 2, y0 + 2, x1 - 2, y0 + 3.2)), "chr", "fix", 4, sep=False)]
        out["body_" + mode] = thick_outline(R_(fender + shell + head + arm + pad))
    for leg in (0, 1):
        lays = [L(P(rrect(44, 66, 88, 80, 6)), "gry", "flat", 0),              # 뒤쪽 궤도(멀리 있어 어둡게, 살짝 위·오른쪽)
                L(P(rrect(35, 69, 83, 86, 7.5)), "gry", "flat", 1),
                L(P(rect(41, 69, 77, 71.4)), "gry", "fix", 3, sep=False)]      # 궤도 윗면
        for wx in (44, 54.5, 65, 75):
            lays += [L(P(ell(wx, 78, 4.8, 4.8)), "gry", "dome", 2.8, rr=0.6), L(P(ell(wx, 78, 1.6, 1.6)), "gry", "fix", 1, sep=False)]
        lays.append(L(P(U_(*[rect(37 + k * 7 + leg * 3.5, 84, 39.5 + k * 7 + leg * 3.5, 86) for k in range(6)])), "gry", "fix", 0, sep=False))
        out["trk_%d" % leg] = thick_outline(R_(lays))
    out["cw"] = thick_outline(R_([L(P(rrect(29, 40, 40, 62, 4)), "gry", "dome", 2.4, rr=1.0), L(P(rect(29, 49, 40, 51)), "gry", "fix", 1, sep=False)]))
    out["lamp"] = thick_outline(R_([L(P(rrect(44, 8, 48.6, 13.5, 1.2)), "gry", "dome", 2.4, rr=0.4), L(P(rrect(56.4, 8, 61, 13.5, 1.2)), "gry", "dome", 3.2, rr=0.4)]))
    cones = {"side": ([(84, 41.5), (84, 69.5), (117, 55.5)], 0), "down": ([(62.5, 91), (90.5, 91), (76.5, 117)], 1), "up": ([(59.5, 19), (87.5, 19), (73.5, 2)], 2)}
    for mode, (pts, ax) in cones.items():
        for d in (0, 1):
            cone = P(poly(pts))
            o = d * 5
            if ax == 0: gro = U_(*[line(88 + k * 9 + o, 40, 92 + k * 9 + o, 71, 2.2) for k in range(4)])
            elif ax == 1: gro = U_(*[line(60, 95 + k * 7 + o, 93, 99 + k * 7 + o, 2.2) for k in range(3)])
            else: gro = U_(*[line(57, 15 - k * 5 - o, 90, 11 - k * 5 - o, 2.0) for k in range(3)])
            out["bit_%s_%d" % (mode, d)] = R_([L(cone, "gry", "dome", 2.6, rr=1.8, spec=[((pts[0][0] + 4) * 16 / MN, (pts[0][1] + 4) * 16 / MN)]),
                                               L(I_(P(gro), cone), "gry", "fix", 1, sep=False)])
    return out

# ---------------------------------------------------------------------
#  건물: 기존 그림을 4배로 키우고 재질에 잔결을 더함 (모양은 그대로)
# ---------------------------------------------------------------------
def hires_building(path):
    src = Image.open(path).convert("RGBA")
    w, h = src.size
    if w > 160: return None                                       # 이미 고해상도
    big = np.array(src.resize((w * 4, h * 4), Image.NEAREST)).astype(float)
    grain = np.random.default_rng(hash(path) & 0xffff).random(big.shape[:2])
    tex = tnoise(max(big.shape[:2]), 24, 77)[:big.shape[0], :big.shape[1]]
    k = (0.93 + 0.1 * grain + 0.06 * (tex - 0.5))[..., None]
    a = big[..., 3:] > 0
    dark = big[..., :3].sum(-1, keepdims=True) < 90                # 테두리 선은 그대로
    big[..., :3] = np.where(a & ~dark, big[..., :3] * k, big[..., :3])
    # 칸 경계마다 1px 그늘(원래 1칸 = 4px 안에 윗빛·아랫그늘)
    src_a = np.array(src)
    for y in range(h):
        for x in range(w):
            if src_a[y, x, 3] == 0: continue
            if y + 1 < h and src_a[y + 1, x, 3] and tuple(src_a[y + 1, x, :3]) != tuple(src_a[y, x, :3]):
                big[y * 4 + 3, x * 4:x * 4 + 4, :3] *= 0.85
    return big

if __name__ == "__main__":
    n = 0
    for li in range(len(LAYERS)):
        for v in range(8):
            save(dirt_tile(li, v), f"{A}/tiles/dirt/{li}_{v}.png"); n += 1
        for v in range(4):
            save(back_tile(li, v), f"{A}/tiles/back/{li}_{v}.png"); n += 1
    for v in range(2):
        save(stone_tile(v), f"{A}/tiles/stone_{v}.png"); save(hard_tile(v), f"{A}/tiles/hard_{v}.png")
        save(grass_tile(v), f"{A}/tiles/grass_{v}.png"); n += 3
    save(bedrock_tile(), f"{A}/tiles/bedrock.png"); save(plinth(1), f"{A}/tiles/plinth_top.png"); save(plinth(0), f"{A}/tiles/plinth_low.png")
    for i in range(3): save(crack_img(i), f"{A}/tiles/crack_{i}.png")
    for i, im in enumerate(deco_tiles()): save(im, f"{A}/tiles/deco_{i}.png")
    n += 12
    for id_ in ORE_COL:
        for v in range(4): save(ore_world(id_, v), f"{A}/ores/world/{id_}_{v}.png")
        save(ore_icon(id_), f"{A}/ores/icon/{id_}.png"); save(ore_drop(id_), f"{A}/ores/drop/{id_}.png"); n += 6
    FUR = open(os.path.join(ROOT, "src/game/systems/furnace.ts"), encoding="utf-8").read()
    for k, a, b, c in re.findall(r'(\w\w): \{ name: "[^"]+",\s+ore: \d+,\s+coal: \d+, time: \d+,\s+pal: \["(#\w+)", "(#\w+)", "(#\w+)"\]', FUR):
        save(bar_icon(k, [a, b, c]), f"{A}/bars/{k}.png"); n += 1
    save(sun(), f"{A}/sky/sun.png"); save(cloud(), f"{A}/sky/cloud.png"); n += 2
    for name, im in miner_parts().items():
        save(im, f"{A}/miner/{name}.png"); n += 1
    for b in ("item_shop", "workshop", "furnace"):
        im = hires_building(f"{A}/buildings/{b}.png")
        if im is not None: save(im, f"{A}/buildings/{b}.png"); n += 1
    print("고해상도 그림", n, "개 저장")
