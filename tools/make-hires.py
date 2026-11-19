#!/usr/bin/env python3
# 고해상도 그림 만들기 (타일 하나 = 그림 64x64 를 그대로 화면 64px 에)
#
#   python3 tools/make-hires.py          → public/assets 아래 PNG 들을 고해상도로 다시 만듦
#   (그 다음 npm run assets:manifest)
#
# 만드는 것: 흙(지층 8개 x 16조각)·뒷벽(x 4) · 돌 · 경암 · 기반암 · 기단 · 풀 · 장식 · 균열 · 땅속 광물 · 광물 아이콘 ·
#           떨어진 광물 · 주괴 · 해·구름 · 캐릭터(미니 굴착기) 부품 · 건물(기존 그림 4배 + 재질 결)
# 아이템·화면 아이콘은 tools/make-icons.py --size 32 로 만듦.
# 필요: Python 3 + numpy + scipy + Pillow
import os, sys, math, re
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixicon import *
import mapart                                   # 맵 스타일 A (흙·뒷벽·땅속 광물·풀·풀잎·해·구름)

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
#  광물 (아이콘 · 떨어진 것 · 주괴). 땅속 광물·흙·뒷벽·풀·하늘은 tools/mapart.py
# ---------------------------------------------------------------------

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
#  땅속 보물 상자 (흙 타일 위에 겹침): 흙에 반쯤 묻힌 나무 상자 + 금테 + 자물쇠
# ---------------------------------------------------------------------
def chest_tile():
    MAT["wood"] = ["#2a160c", "#5a3418", "#8a5a30", "#b07a44", "#d8a868"]
    MAT["gold"] = ["#6a4200", "#b07a10", "#ffcc33", "#ffe68a", "#fffbe0"]
    lays = [L(ell(8, 12.6, 6.6, 1.6), "wood", "fix", 0),                                     # 흙에 파묻힌 그늘
            L(rrect(2.6, 7.4, 13.4, 13.2, 0.6), "wood", "flat", 2),                          # 몸통
            L(D_(rrect(2.6, 3.6, 13.4, 9.0, 2.6), rect(0, 7.6, 16, 16)), "wood", "dome", 2.8, rr=1.2, spec=[(5, 4.6)]),   # 둥근 뚜껑
            L(U_(rect(2.6, 7.2, 13.4, 8.2), rect(4.2, 3.8, 5.2, 13.2), rect(10.8, 3.8, 11.8, 13.2)), "gold", "flat", 3),  # 금테
            L(rrect(7.0, 6.6, 9.0, 9.6, 0.4), "gold", "dome", 3.0, rr=0.4),                    # 자물쇠
            L(rect(7.7, 8.0, 8.3, 9.0), "wood", "fix", 0, sep=False)]
    for k in range(3): lays.append(L(rect(3, 9.6 + k * 1.2, 13, 9.9 + k * 1.2), "wood", "fix", 1, sep=False))   # 판자 결
    return render(lays, R, "B", [])

# ---------------------------------------------------------------------
#  캐릭터: 드릴 로봇 부품 → tools/robot3d.py (작은 3D 장면을 3/4 각도로 비춰 도트로 끊음)
#   body_<자세> 색 그대로 / trk_<0|1> 궤도 · cw 등 탱크 · lamp 안테나 끝 · bit_<자세>_<0|1> 드릴 원뿔 은 회색
# ---------------------------------------------------------------------
GRAY = ["#202020", "#505050", "#808080", "#c0c0c0", "#ffffff"]
def miner_parts(ch=None):
    """기본 캐릭터(노랑이)는 부품 21개 전부, 다른 캐릭터(ch)는 모양·색이 다른 12개만 (궤도·탱크·드릴은 같이 씀)"""
    import robot3d, chars
    c = ch or chars.CHARS[0]
    robot3d.STY.update(dict(head="box", ant="two", antlen=7.0, visor=False, helmet=False)); robot3d.STY.update(c[1])
    ramps = chars.ramps_of(c); ramps["gry"] = GRAY
    ramps = {k: [list(hexrgb(x).astype(int)) for x in v] for k, v in ramps.items()}
    out = {}
    for mode in ("side", "down", "up"):
        for dig in (0, 1):
            if ch and dig: continue
            p = robot3d.parts_for(mode, 0, dig, ramps)
            if not ch: out["bit_%s_%d" % (mode, dig)] = p["bit"]
            if dig == 0:
                out["body_" + mode] = p["body"]
                out["blink_" + mode] = robot3d.blink_overlay(mode, ramps)          # 눈 깜빡임 덮개
                if mode == "side":
                    out["lamp"], out["ant_1"] = p["lamp"], p["ant"]
                    if not ch: out["cw"], out["trk_0"] = p["cw"], p["trk"]
    if not ch: out["trk_1"] = robot3d.parts_for("side", 1, 0, ramps)["trk"]
    for k, lean in ((0, -1), (2, 1)):                                              # 안테나 흔들림: 뒤로 · 앞으로 기운 것
        p = robot3d.parts_for("side", 0, 0, ramps, lean=lean)
        out["ant_%d" % k], out["lamp_%d" % k] = p["ant"], p["lamp"]
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
    for li, Lc in enumerate(LAYERS):
        for v, im in enumerate(mapart.dirt_tiles(li, Lc["base"], Lc["peb"])):    # 4x4칸 이어지는 무늬 16조각
            save(im, f"{A}/tiles/dirt/{li}_{v}.png"); n += 1
        for v in range(4):
            save(mapart.back_tile(li, v, Lc["base"], Lc["peb"]), f"{A}/tiles/back/{li}_{v}.png"); n += 1
    for v in range(2):
        save(stone_tile(v), f"{A}/tiles/stone_{v}.png"); save(hard_tile(v), f"{A}/tiles/hard_{v}.png")
        save(mapart.grass_tile(v), f"{A}/tiles/grass_{v}.png"); n += 3
    save(bedrock_tile(), f"{A}/tiles/bedrock.png"); save(plinth(1), f"{A}/tiles/plinth_top.png"); save(plinth(0), f"{A}/tiles/plinth_low.png")
    for i in range(3): save(crack_img(i), f"{A}/tiles/crack_{i}.png")
    for i, im in enumerate(mapart.tuft_tiles()): save(im, f"{A}/tiles/deco_{i}.png")
    n += 12
    for id_ in ORE_COL:
        for v in range(4): save(mapart.ore_tile(id_, v), f"{A}/ores/world/{id_}_{v}.png")
        save(ore_icon(id_), f"{A}/ores/icon/{id_}.png"); save(ore_drop(id_), f"{A}/ores/drop/{id_}.png"); n += 6
    FUR = open(os.path.join(ROOT, "src/game/systems/furnace.ts"), encoding="utf-8").read()
    for k, a, b, c in re.findall(r'(\w\w): \{ name: "[^"]+",\s+ore: \d+,\s+coal: \d+, time: \d+,\s+pal: \["(#\w+)", "(#\w+)", "(#\w+)"\]', FUR):
        save(bar_icon(k, [a, b, c]), f"{A}/bars/{k}.png"); n += 1
    save(mapart.sun_img(), f"{A}/sky/sun.png"); save(mapart.cloud_img(), f"{A}/sky/cloud.png"); save(chest_tile(), f"{A}/tiles/chest.png"); n += 3
    for name, im in miner_parts().items():
        save(im, f"{A}/miner/{name}.png"); n += 1
    import chars
    for ch in chars.CHARS[1:]:                                                   # 다른 캐릭터: miner/<id>/*.png
        for name, im in miner_parts(ch).items():
            save(im, f"{A}/miner/{ch[0]}/{name}.png"); n += 1
    for b in ("item_shop", "workshop", "furnace"):
        im = hires_building(f"{A}/buildings/{b}.png")
        if im is not None: save(im, f"{A}/buildings/{b}.png"); n += 1
    print("고해상도 그림", n, "개 저장")
