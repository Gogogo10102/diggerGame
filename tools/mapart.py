# 맵 스타일 A "굵은 외곽선 덩어리" (2026-11-20 확정 시안)
#   그림 해상도 = 칸당 32px 도트, 저장할 때 2배로 키워 64px(게임 타일 크기)로.
#   흙: 4x4칸이 한 무늬로 이어지는 돌바닥 덩이(보로노이) → 변형 번호 = (c&3) + (r&3)*4 (draw.ts 와 짝)
#   광물: 아이콘처럼 3~4단 명암 + 1px 외곽선 덩이 3개, 뒷벽: 어두운 얼룩, 풀·구름·해: 외곽선 있는 굵은 도트
import colorsys
import numpy as np
from matplotlib.path import Path

TS = 32                                      # 칸당 도트 수
SUP = 4                                      # 흙 무늬가 이어지는 칸 수 (4x4)
OL = np.array([26, 15, 10], float)           # 외곽선 (아주 어두운 갈색)

def hx(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
def sat(c, s=1.25, v=1.0, hue=0.0):
    h, l, ss = colorsys.rgb_to_hls(*(np.clip(np.array(c, float), 0, 255) / 255))
    r = colorsys.hls_to_rgb((h + hue) % 1, min(1, l * v), min(1, ss * s))
    return np.array(r) * 255
def lramp(base, peb):
    """지층 색 5단 (config 색을 조금 진하게)"""
    b = sat(hx(base), 1.35)
    return dict(d2=sat(b, 1.1, 0.55), d1=sat(b, 1.1, 0.78), m=b, l1=sat(b, 1.05, 1.22), l2=sat(b, 1.0, 1.45), peb=sat(hx(peb), 1.2, 1.0))
def up2(a):                                 # 2배 (도트 그대로)
    return np.repeat(np.repeat(a, 2, 0), 2, 1)

def ring(m, diag=False, wrap=True):
    o = np.zeros_like(m)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if (dy or dx) and (diag or not (dy and dx)):
                if wrap: o |= np.roll(np.roll(m, dy, 0), dx, 1)
                else:
                    s = np.zeros_like(m); H, W = m.shape
                    s[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = m[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
                    o |= s
    return o & ~m

def pnoise(n, cells, seed):
    """n x n 이어지는 값 잡음"""
    g = np.random.default_rng(seed).random((cells, cells))
    x = np.arange(n) * cells / n
    i0 = np.floor(x).astype(int); f = x - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % cells
    a = g[np.ix_(i0, i0)] * (1 - f)[None, :] + g[np.ix_(i0, i1)] * f[None, :]
    b = g[np.ix_(i1, i0)] * (1 - f)[None, :] + g[np.ix_(i1, i1)] * f[None, :]
    return a * (1 - f)[:, None] + b * f[:, None]

def pvoronoi(n, cells, seed):
    """n x n 이어지는 보로노이: 덩이 번호 · 경계까지 거리 · 덩이 중심에서 본 위치"""
    rng = np.random.default_rng(seed); cell = n / cells
    jit = rng.uniform(0.15, 0.85, (cells, cells, 2))
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    ci, ri = (xx // cell).astype(int), (yy // cell).astype(int)
    b0 = np.full((n, n), 1e9); b1 = np.full((n, n), 1e9); bid = np.zeros((n, n), int); ux = np.zeros((n, n)); uy = np.zeros((n, n))
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            r2, c2 = ri + dy, ci + dx
            px = (c2 + jit[r2 % cells, c2 % cells, 0]) * cell; py = (r2 + jit[r2 % cells, c2 % cells, 1]) * cell
            ddx, ddy = xx - px, yy - py
            d = np.hypot(ddx, ddy * 1.25)                  # 살짝 납작한 덩이
            new = d < b0
            b1 = np.where(new, b0, np.minimum(b1, d)); b0 = np.where(new, d, b0)
            bid = np.where(new, (r2 % cells) * cells + (c2 % cells), bid)
            ux = np.where(new, ddx / cell, ux); uy = np.where(new, ddy / cell, uy)
    return bid, b1 - b0, ux, uy

def disk(n, cx, cy, rx, ry=None, wrap=True):
    ry = ry or rx; yy, xx = np.mgrid[0:n, 0:n] + 0.5
    dx, dy = xx - cx, yy - cy
    if wrap: dx = (dx + n / 2) % n - n / 2; dy = (dy + n / 2) % n - n / 2
    return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1

# ---------------------------------------------------------------------
#  흙: 4x4칸 한 장 → 16조각
# ---------------------------------------------------------------------
SPECK = {3: ("#9a86d6", "#d8c8ff"), 4: ("#ff7a3c", "#ffd08a"), 5: ("#7fd8e0", "#e0ffff"), 7: ("#8fa0ff", "#e0e6ff")}
def dirt_sheet(li, base, peb):
    n = TS * SUP; lr = lramp(base, peb)
    idx, edge, ux, uy = pvoronoi(n, 14, 911)                  # 무늬 모양은 지층끼리 같게 (경계에서 이어짐)
    tone = np.random.default_rng(905 + li).integers(1, 4, idx.max() + 1)[idx]
    g = tone.copy()
    g = np.where((ux + uy < -.5) & (edge > 1.5), np.minimum(tone + 1, 4), g)   # 위왼 빛
    g = np.where(ux + uy > .55, np.maximum(tone - 1, 0), g)                     # 아래오른 그늘
    g = np.where(edge < 1.6, 0, g)                                              # 덩이 사이 틈
    pal = np.array([lr["d2"], lr["d1"], lr["m"], lr["l1"], lr["l2"]])
    img = pal[g].astype(float)
    r = np.random.default_rng(1200 + li)
    for _ in range(9):                                        # 자갈 (외곽선 있는 작은 돌)
        x, y = r.uniform(0, n), r.uniform(0, n); p = disk(n, x, y, r.uniform(1.8, 3.2), r.uniform(1.5, 2.6))
        yy = np.mgrid[0:n, 0:n][0] + 0.5; below = ((yy - y + n / 2) % n - n / 2) > 0
        img[p] = lr["peb"]; img[p & below] = lr["peb"] * .78; img[ring(p)] = OL
    if li in SPECK:                                           # 깊은 지층의 반짝이 (2x2 + 외곽선)
        a, b = hx(SPECK[li][0]), hx(SPECK[li][1])
        for _ in range(14):
            x, y = int(r.uniform(0, n - 3)), int(r.uniform(0, n - 3))
            m = np.zeros((n, n), bool); m[y:y + 2, x:x + 2] = True
            img[ring(m)] = OL * 0 + pal[0]; img[m] = a; img[y, x] = b
    if li == 6:                                               # 고대 화석층: 뼈 조각
        for _ in range(4):
            x, y = int(r.uniform(4, n - 16)), int(r.uniform(4, n - 8))
            m = np.zeros((n, n), bool); m[y:y + 2, x + 1:x + 9] = True; m[y - 1:y + 3, x:x + 2] = True; m[y - 1:y + 3, x + 8:x + 10] = True
            img[ring(m)] = OL; img[m] = hx("#efe4c8"); img[y + 1, x + 2:x + 8] = hx("#b8aa88")
    if li == 0:                                               # 흙층: 가는 뿌리
        for _ in range(5):
            x, y = r.uniform(0, n), r.uniform(0, n)
            for k in range(int(r.uniform(6, 12))):
                img[int(y) % n, int(x) % n] = hx("#a07a48"); x += r.uniform(-0.9, 0.9); y += 1
    return img

def dirt_tiles(li, base, peb):
    """16조각 (번호 = cx + cy*4), 각각 64x64 RGB"""
    sh = up2(dirt_sheet(li, base, peb)); T2 = TS * 2
    return [sh[(v // SUP) * T2:(v // SUP + 1) * T2, (v % SUP) * T2:(v % SUP + 1) * T2] for v in range(SUP * SUP)]

def back_tile(li, v, base, peb):
    lr = lramp(base, peb); b = lr["d1"] * .62
    n = TS; f = 0.6 * pnoise(n, 4, 5000 + li) + 0.4 * pnoise(n, 8, 5100 + li * 7 + v)
    img = np.where((f > .6)[..., None], b * 1.12, np.where((f < .36)[..., None], b * .85, b))
    r = np.random.default_rng(5300 + li * 7 + v)
    for _ in range(2):                                        # 곡괭이 자국 같은 짧은 가로 줄
        x, y, w = int(r.uniform(0, n)), int(r.uniform(2, n - 2)), int(r.uniform(5, 10))
        for k in range(w): img[y, (x + k) % n] = b * .8
    return up2(img)

# ---------------------------------------------------------------------
#  땅속 광물: 아이콘처럼 덩이 3개 (1px 외곽선)
# ---------------------------------------------------------------------
ORE4 = {2: ("#ffd0a0", "#ff9a4a", "#d0602a", "#7a2e12"), 3: ("#ffffff", "#d2d8e2", "#98a2b2", "#55606e"),
        4: ("#fff7b0", "#ffd84a", "#e89a14", "#8a4e08"), 5: ("#ffffff", "#8ff4ff", "#2ec4e8", "#16658a"),
        6: ("#8a90a6", "#4a4e60", "#2a2c38", "#121319"), 8: ("#ffffff", "#e2eaf6", "#a8b6cc", "#5c6a84"),
        9: ("#d2ffe0", "#4ef08e", "#18b058", "#0a5a30"), 10: ("#ffd0d0", "#ff5a6a", "#d0203a", "#6a0a1a"),
        11: ("#e0fff8", "#7af8de", "#2ec0b0", "#11605e")}
# 변형마다 덩이 자리 (32칸 좌표: x, y, 크기)
ORE_PILES = [[(9, 11, 7), (22, 9, 6), (17, 22, 8)], [(10, 21, 7), (21, 20, 8), (14, 9, 6)],
             [(20, 12, 7), (10, 14, 6), (15, 23, 7)], [(12, 10, 6), (22, 17, 7), (10, 22, 6)]]
def ore_spark(v):
    """반짝이 자리 (16칸 좌표, sprites.ts 의 ORE_HI_SPARK 와 짝)"""
    return [[round((x - s * .38) / 2, 1), round((y - s * .38) / 2, 1)] for (x, y, s) in ORE_PILES[v]]

def _poly(n, pts):
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    return Path(pts).contains_points(np.stack([xx.ravel(), yy.ravel()], 1)).reshape(n, n)

def ore_tile(k, v, scale=1.15):
    n = TS; rp = [hx(c) for c in ORE4[k]]
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    rng = np.random.default_rng(700 + k * 13 + v)
    img = np.zeros((n, n, 4)); allm = np.zeros((n, n), bool); parts = []
    for (cx, cy, rad) in ORE_PILES[v]:
        R = rad * scale * 0.82 + rng.uniform(-.6, .6)
        if k in (5, 9, 10, 11):                                # 결정: 위로 뾰족한 육각 기둥
            w, h = R * .75, R * 1.3; t = rng.uniform(-1.5, 1.5)
            m = _poly(n, [(cx - w, cy + h * .45), (cx - w + t * .3, cy - h * .35), (cx + t, cy - h), (cx + w + t * .3, cy - h * .35), (cx + w, cy + h * .45), (cx, cy + h * .7)])
            left = xx < cx + t * (cy - yy) / h * .5
            sh = np.where(left, 1, 2); sh = np.where((yy < cy - h * .35) & (xx < cx + t), 0, sh); sh = np.where(yy > cy + h * .3, 3, sh)
            hl = m & (np.abs(xx - (cx - w * .45)) < 1) & (yy > cy - h * .3) & (yy < cy + h * .1)
        elif k == 6:                                           # 석탄: 모난 덩이
            a = rng.uniform(0, 1)
            m = _poly(n, [(cx + R * np.cos(q) * rng.uniform(.78, 1.05), cy + R * .85 * np.sin(q) * rng.uniform(.78, 1.05)) for q in np.linspace(a, a + 2 * np.pi, 7)[:-1]])
            s_ = (xx - cx) / R + (yy - cy) / R
            sh = np.select([s_ < -.6, s_ < .1, s_ < .7], [0, 1, 2], 3); hl = m & (((xx - cx + R * .35) / 1.2) ** 2 + ((yy - cy + R * .35) / 1.2) ** 2 <= 1)
        else:                                                  # 금속: 둥근 덩이
            m = ((xx - cx) / R) ** 2 + ((yy - cy) / (R * .82)) ** 2 <= 1
            s_ = (xx - cx) / R * .8 + (yy - cy) / R
            sh = np.select([s_ < -.55, s_ < .15, s_ < .7], [0, 1, 2], 3); hl = m & (((xx - cx + R * .38) / 1.3) ** 2 + ((yy - cy + R * .38) / 1.0) ** 2 <= 1)
        parts.append((m, sh, hl)); allm |= m
    shadow = np.roll(np.roll(allm, 1, 0), 1, 1) & ~allm      # 흙에 박힌 그늘 (아래 오른쪽)
    img[shadow] = [25, 14, 6, 110]
    ol = ring(allm, wrap=False); img[ol] = [*OL, 255]
    for (m, sh, hl) in parts:
        for i in range(4): img[m & (sh == i)] = [*rp[i], 255]
        img[hl] = [255, 255, 255, 255]
    return up2(img)

# ---------------------------------------------------------------------
#  풀 (흙 위 덮개) · 풀잎/꽃 장식 · 하늘
# ---------------------------------------------------------------------
GC = [hx("#2e8a2a"), hx("#4cc43a"), hx("#86e64a"), hx("#c4ff7a")]
def grass_tile(v):
    n = TS; img = np.zeros((n, n, 4)); r = np.random.default_rng(1000 + v)
    ln = 7 + np.floor(pnoise(n, 6, 1010 + v)[0] * 3) + 2 * ((np.arange(n) // 3) % 2)
    for x in range(n):
        L = int(ln[x])
        img[0:L, x] = [*GC[1], 255]; img[0:3, x] = [*GC[2], 255]; img[0, x] = [*OL, 255]
        img[L - 2:L, x] = [*GC[0], 255]; img[L, x] = [*OL, 255]; img[L + 1, x] = [20, 12, 6, 90]
    for _ in range(5):                                         # 진한 잎 무늬
        x, y = int(r.uniform(1, n - 2)), int(r.uniform(3, 5)); img[y:y + 2, x] = [*GC[0], 255]
    if v:
        for _ in range(4): x = int(r.uniform(1, n - 1)); img[1, x] = [*GC[3], 255]
    return up2(img)

def tuft_tiles():
    """땅 위 풀잎·꽃 (흙 바로 위 하늘 칸에 그림, 아래 끝 = 땅)"""
    n = TS; out = []
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    def blade(x, h, lean):
        return _poly(n, [(x - 1.6, n), (x + 1.6, n), (x + lean, n - h)])
    for v in range(6):
        r = np.random.default_rng(1500 + v); img = np.zeros((n, n, 4)); m = np.zeros((n, n), bool)
        for _ in range(3 + v % 3): m |= blade(r.uniform(3, 29), r.uniform(4, 9), r.uniform(-2, 2))
        img[ring(m, wrap=False) & (yy < n - .5)] = [*(GC[0] * .6), 255]; img[m] = [*GC[2], 255]
        if v in (1, 3, 4):                                     # 꽃
            for k in range(1 if v != 4 else 2):
                x = r.uniform(7, 25); y = n - 8 - r.uniform(0, 3)
                st = (np.abs(xx - x) < .6) & (yy > y) & (yy < n); img[st] = [*GC[0], 255]
                f = ((xx - x) / 2.3) ** 2 + ((yy - y) / 2.3) ** 2 <= 1
                col = hx(["#ff5a6a", "#ffd84a", "#ffffff", "#ff8ad0"][(v + k) % 4])
                img[ring(f, wrap=False)] = [*OL, 255]; img[f] = [*col, 255]; img[(np.abs(xx - x) < .6) & (np.abs(yy - y) < .6)] = [*hx("#ffb02a"), 255]
        if v == 5:                                             # 작은 돌
            f = ((xx - 16) / 5) ** 2 + ((yy - (n - 3)) / 3.4) ** 2 <= 1
            f &= yy < n
            img[ring(f, wrap=False) & (yy < n)] = [*OL, 255]; img[f] = [*hx("#9aa0ae"), 255]; img[f & (yy > n - 2.5)] = [*hx("#6a7080"), 255]
            img[f & (xx < 14) & (yy < n - 4)] = [*hx("#d8dce6"), 255]
        out.append(up2(img))
    return out

def sun_img():
    n = 32; yy, xx = np.mgrid[0:n, 0:n] + 0.5; img = np.zeros((n, n, 4))
    d = np.hypot(xx - 16, yy - 16)
    img[d <= 15] = [*hx("#ffb02a"), 255]; img[d <= 14] = [*hx("#fff070"), 255]; img[d <= 10.5] = [*hx("#fffbd0"), 255]
    return up2(img)

def cloud_img():
    W, H = 40, 16; yy, xx = np.mgrid[0:H, 0:W] + 0.5
    e = lambda cx, cy, rx, ry: ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    cl = e(20, 8.5, 9, 6.5) | e(10, 11, 6.5, 4.5) | e(30, 10.5, 7, 5) | e(22, 4.8, 5.5, 4.2)
    cl &= yy < 14.5
    img = np.zeros((H, W, 4)); img[ring(cl, wrap=False)] = [*hx("#5a8ac8"), 255]
    img[cl] = [255, 255, 255, 255]; img[cl & (yy > 11)] = [*hx("#d8ecff"), 255]
    return up2(img)

# ---------------------------------------------------------------------
#  자연 동굴: 뒷벽(판 굴보다 차갑고 바위 결) · 천장 고드름 돌 · 바닥 장식(버섯·수정·돌무더기)
# ---------------------------------------------------------------------
def cave_back_tile(li, v, base, peb):
    lr = lramp(base, peb)
    b = sat(lr["d1"] * .55, 0.8) * np.array([.86, .92, 1.16])     # 판 굴보다 어둡고 푸르스름
    n = TS
    idx, edge, ux, uy = pvoronoi(n, 4, 6100 + li * 7 + v)        # 큰 바위 결 (칸 안에서 이어짐)
    tone = np.random.default_rng(6200 + li * 7 + v).integers(0, 3, idx.max() + 1)[idx]
    k = np.choose(tone, [0.9, 1.0, 1.1])
    img = b[None, None, :] * k[..., None]
    img = np.where(((ux + uy) < -.45)[..., None], img * 1.12, img)
    img = np.where((edge < 1.2)[..., None], b * .62, img)
    return up2(np.clip(img, 0, 255))

def cave_top_tile(li, v, base, peb):
    """천장에서 내려온 고드름 돌 (칸 위쪽에 붙음, 나머지는 투명)"""
    lr = lramp(base, peb); n = TS; img = np.zeros((n, n, 4))
    r = np.random.default_rng(6400 + li * 5 + v); m = np.zeros((n, n), bool); sh = np.zeros((n, n), int)
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    for _ in range(2 + v % 2):
        x = r.uniform(5, 27); L = r.uniform(7, 15); w = r.uniform(2.6, 4.2)
        p = _poly(n, [(x - w, -1), (x + w, -1), (x + r.uniform(-.8, .8), L)])
        m |= p; sh = np.where(p & (xx < x - w * .2), 1, np.where(p & (xx > x + w * .35), 2, np.where(p, sh, sh)))
    img[ring(m, wrap=False) & (yy > 0.5)] = [*OL, 255]
    img[m] = [*lr["m"], 255]; img[m & (sh == 1)] = [*lr["l1"], 255]; img[m & (sh == 2)] = [*lr["d1"], 255]
    img[m & (yy < 2)] = [*lr["d1"], 255]
    return up2(img)

def cave_bot_tiles():
    """동굴 바닥 장식 4종 (칸 아래쪽에 붙음): 푸른 빛버섯 · 빨간 버섯 · 수정 · 돌무더기"""
    n = TS; out = []; yy, xx = np.mgrid[0:n, 0:n] + 0.5
    def cap(cx, cy, rx, ry, cols, stemc):
        img_m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1) & (yy <= cy + ry * .25)
        st = (np.abs(xx - cx) < rx * .32) & (yy > cy) & (yy < n)
        return img_m, st
    # 0, 1: 버섯 둘
    for cols, glow in ((["#1a4a8a", "#3a8aff", "#9ad8ff", "#e8f8ff"], True), (["#7a1a1a", "#d83a3a", "#ff8a7a", "#fff0e8"], False)):
        img = np.zeros((n, n, 4)); allm = np.zeros((n, n), bool)
        parts = []
        for (cx, cy, rx, ry) in ((12, 22, 7, 5), (22, 25, 4.5, 3.4)):
            cm, st = cap(cx, cy, rx, ry, cols, None); parts.append((cm, st, cx, cy, rx, ry)); allm |= cm | st
        if glow:
            g = np.clip(1 - np.hypot(xx - 14, yy - 22) / 14, 0, 1)
            img[..., :3] = hx(cols[2]); img[..., 3] = (g * 70).astype(int)
        img[ring(allm, wrap=False) & (yy < n - .5)] = [*OL, 255]
        for (cm, st, cx, cy, rx, ry) in parts:
            img[st] = [*hx("#e8dcc4"), 255]; img[st & (xx > cx + rx * .1)] = [*hx("#b8a888"), 255]
            img[cm] = [*hx(cols[1]), 255]; img[cm & (yy > cy - ry * .1)] = [*hx(cols[0]), 255]
            img[cm & (((xx - cx + rx * .35) / (rx * .35)) ** 2 + ((yy - cy + ry * .45) / (ry * .3)) ** 2 <= 1)] = [*hx(cols[2]), 255]
            for (dx, dy) in ((-.3, -.5), (.35, -.35)):
                img[(np.abs(xx - (cx + rx * dx)) < 1) & (np.abs(yy - (cy + ry * dy)) < .8) & cm] = [*hx(cols[3]), 255]
        out.append(up2(img))
    # 2: 수정
    img = np.zeros((n, n, 4)); allm = np.zeros((n, n), bool); parts = []
    for (cx, h, w, t) in ((11, 13, 3.4, -2.5), (17, 18, 4, 0.5), (23, 10, 3, 2.5)):
        m = _poly(n, [(cx - w, n), (cx - w + t * .2, n - h * .75), (cx + t, n - h), (cx + w + t * .2, n - h * .75), (cx + w, n)])
        parts.append((m, cx, t, h)); allm |= m
    g = np.clip(1 - np.hypot(xx - 17, yy - 24) / 15, 0, 1); img[..., :3] = hx("#7fe8ff"); img[..., 3] = (g * 60).astype(int)
    img[ring(allm, wrap=False) & (yy < n - .5)] = [*OL, 255]
    for (m, cx, t, h) in parts:
        img[m] = [*hx("#2ec4e8"), 255]; img[m & (xx < cx + t * (n - yy) / h * .8)] = [*hx("#8ff4ff"), 255]
        img[m & (yy > n - 3)] = [*hx("#16658a"), 255]
        img[m & (np.abs(xx - (cx - 1.4)) < .6) & (yy > n - h * .7) & (yy < n - 4)] = [255, 255, 255, 255]
    out.append(up2(img))
    # 3: 돌무더기
    img = np.zeros((n, n, 4)); allm = np.zeros((n, n), bool); parts = []
    for (cx, cy, rx, ry) in ((10, 28, 6, 4), (20, 28.5, 5, 3.5), (15, 24.5, 4.5, 3.4)):
        m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1) & (yy < n); parts.append((m, cx, cy, rx, ry)); allm |= m
    img[ring(allm, wrap=False) & (yy < n - .5)] = [*OL, 255]
    for (m, cx, cy, rx, ry) in parts:
        img[m] = [*hx("#8a8e9a"), 255]; img[m & ((xx - cx) / rx + (yy - cy) / ry > .5)] = [*hx("#5e6270"), 255]
        img[m & ((xx - cx) / rx + (yy - cy) / ry < -.6)] = [*hx("#c4c8d2"), 255]
    out.append(up2(img))
    return out
