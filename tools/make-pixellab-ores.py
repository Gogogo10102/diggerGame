#!/usr/bin/env python3
# 땅속 광물 그림 = 흙에 박힌 작은 알갱이 (2026-11-25 확정 느낌)
#   python3 tools/make-pixellab-ores.py [광물id…]   → ores/world/<광물id>_<0~3>.png (64x64, 32px 도트 x2, 투명 바탕에 알갱이만)
#   - 처음 PixelLab 인페인팅 결과(흙 칸에 구리를 박은 것, ref/pixellab/ores/copper_ref.png)를 원래 흙 칸(dirt_base.png)과 비교해
#     바뀐 진한 색 픽셀에서 구리 색 단계를 뽑음. 다른 광물은 config.ts 의 ORE_COL [밝은·기본·어두운] 으로 같은 단계를 만듦.
#     ref/pixellab/ores/<id>_ref.png (같은 흙 칸에 인페인팅한 결과)가 있으면 그 광물은 거기서 색을 뽑음.
#   - 알갱이: 3칸 ㄱ자 / 2x2 / 2x2+1칸, 왼위 한 점 하이라이트 · 오른아래 어둡게 · 아래 그림자 한 칸(박힌 느낌)
#   - 놓기: 네 귀퉁이(CORNER px 안)에 하나씩 → 전체 윤곽은 네모꼴, 나머지는 네모 안 아무 데나(후보 몇 개 중 가장 먼 곳)
#     → 안쪽은 불규칙. 금속 6~7개 · 보석 7~8개, 테두리에서 4px 안쪽, 알갱이 가운데끼리 MIN_D px 이상
#   - --no-shadow 를 주면 알갱이 아래 그림자 없이
#   - 알갱이 자리(그림자 포함 상자)도 출력 → sprites.ts 의 ORE_FLECK_BOX. 위 칸을 파서 윗면 무늬(풀·판돌)가 생기면
#     그 두께에 걸치는 알갱이는 통째로 안 그림(draw.ts) → 광물이 윗단 밖으로 삐져나와 보이지 않게
#   - 반짝이는 광물(SPARK_ORES)용 반짝임 자리(알갱이 하이라이트)를 출력 → sprites.ts 의 ORE_FLECK_SPARK 에 붙여 넣기
#   - 보석(다이아·에메랄드·루비, GEMS)은 <id>_ref.png(같은 흙 칸에 인페인팅)가 있을 때만: 그 색으로 작은 결정(2~4칸)을 7~8개.
#     없으면 건너뜀(예전 그림 유지)
import os, re, sys, json, colorsys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "tools/ref/pixellab/ores")
OUT = os.path.join(ROOT, "public/assets/ores/world")
GEMS = {5, 9, 10}                      # 다이아 · 에메랄드 · 루비
SHADOW = (82, 46, 22)                  # 알갱이 아래 그림자 (흙 틈)
COUNT, CELLS, MARGIN = (6, 8), 3, 4    # 개수(6~7) · 3x3 자리 · 테두리 여백(원본 px)
GEM_COUNT = (7, 9)                     # 보석: 결정이 작아서 조금 더 많이(7~8개)
CORNER = 4                             # 귀퉁이 알갱이가 놓일 수 있는 폭(px): 네 귀퉁이로 전체 윤곽을 네모꼴로
PICKS, MIN_D = 3, 6.0                  # 안쪽 알갱이: 후보 수(적을수록 불규칙) · 알갱이 가운데끼리 최소 거리(px)
SHADOW_ON = "--no-shadow" not in sys.argv   # 알갱이 아래 그림자 한 칸
# ORE_COL 대신 쓸 색 [밝은·기본·어두운]: 철은 ORE_COL(밝은 회색)대로면 은과 똑같아 보여서 따뜻하고 어두운 쇳빛으로
COL_OVERRIDE = {3: [(222, 208, 196), (164, 144, 132), (104, 86, 78)]}

def ore_cols():
    s = open(os.path.join(ROOT, "src/game/core/config.ts"), encoding="utf-8").read()
    s = s[s.index("export const ORE_COL"):]
    s = s[:s.index("};")]
    hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    return {int(m.group(1)): [hx(m.group(2)), hx(m.group(3)), hx(m.group(4))]
            for m in re.finditer(r'(\d+): \["(#\w{6})", "(#\w{6})", "(#\w{6})"\]', s)}

def ref_palette(path, gem=False):
    """인페인팅 결과에서 흙과 달라진 광물 색 픽셀 → 어두운→밝은 순 색 목록
       금속: 진한 색(채도 0.6↑)만 / 보석: 흙빛(갈색 계열)·어두운 그림자를 뺀 밝은 색 전부(다이아처럼 옅은 색도)"""
    a = np.array(Image.open(path).convert("RGBA")).astype(int)
    b = np.array(Image.open(os.path.join(REF, "dirt_base.png")).convert("RGBA")).astype(int)
    d = np.abs(a[..., :3] - b[..., :3]).sum(-1)
    cols = set()
    for y in range(2, 30):
        for x in range(2, 30):
            r, g, bb = a[y, x, :3]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, bb / 255)
            if gem: ok = d[y, x] > 20 and (s > 0.3 or v > 0.85) and not (0.03 < h < 0.14)   # 흙빛(갈색)·회색 그림자 빼고
            else: ok = d[y, x] > 20 and s > 0.6 and v > 0.62           # 흙빛으로 바뀐 픽셀은 빼고 광물 색만
            if ok: cols.add((int(r), int(g), int(bb)))
    return sorted(cols, key=lambda c: c[0] * 3 + c[1] * 6 + c[2])

def ramp(light, base, dark):
    mix = lambda p, q, t: tuple(int(round(p[i] + (q[i] - p[i]) * t)) for i in range(3))
    return [dark, mix(dark, base, 0.5), base, mix(base, light, 0.5), light]

def blob(rng, n):
    """뭉툭한 알갱이: 3칸 ㄱ자 / 2x2 / 2x2 + 한 칸"""
    pts = [(0, 0), (1, 0), (0, 1), (1, 1)]
    if n <= 3: pts.pop(int(rng.integers(1, 4)))                      # 왼위(하이라이트 자리)는 남김
    elif n >= 5: pts.append([(2, 0), (2, 1), (0, 2), (1, 2)][int(rng.integers(4))])
    return pts

def gem_blob(rng):
    """보석 결정: 세로 2칸 / ㄱ자 3칸 / 2x2 / 마름모 4칸 (원본의 1~2px 결정보다 한 단계 크게)"""
    return [[(0, 0), (0, 1)], [(0, 0), (1, 0), (0, 1)], [(0, 0), (1, 0), (0, 1), (1, 1)],
            [(1, 0), (0, 1), (1, 1), (1, 2)]][int(rng.integers(4))]

def fleck_tile(pal, seed, M=MARGIN, gem=False):
    rng = np.random.default_rng(seed)
    out = np.zeros((32, 32, 4), np.uint8)
    taken = np.zeros((32, 32), bool)
    n = int(rng.integers(*(GEM_COUNT if gem else COUNT)))
    lo, top = M, 32 - M                                             # 놓을 수 있는 네모 [lo, top)
    centers, hi, boxes = [], [], []
    for k in range(n * 3):
        if len(hi) >= n: break
        pts = gem_blob(rng) if gem else blob(rng, int(rng.integers(3, 6)))
        w = max(p[0] for p in pts) + 1; h = max(p[1] for p in pts) + 1
        xmax, ymax = top - w - 1, top - h - 1                       # 그림자 한 칸까지 네모 안에
        if len(hi) < 4:
            # 귀퉁이 넷: 각 귀퉁이 CORNER px 안 아무 데나 → 전체 윤곽은 네모꼴
            q = len(hi)
            cands = [(int(rng.integers(lo, lo + CORNER)) if q & 1 == 0 else int(rng.integers(xmax - CORNER + 1, xmax + 1)),
                      int(rng.integers(lo, lo + CORNER)) if q < 2 else int(rng.integers(ymax - CORNER + 1, ymax + 1))) for _ in range(8)]
        else:
            # 나머지: 네모 안 아무 데나 몇 군데 뽑아 그중 이미 놓은 것과 가장 먼 곳 (바둑판처럼 줄 서지 않게 후보는 적게)
            cands = [(int(rng.integers(lo, xmax + 1)), int(rng.integers(lo, ymax + 1))) for _ in range(PICKS)]
            cands.sort(key=lambda c: -min((c[0] + w / 2 - a) ** 2 + (c[1] + h / 2 - b) ** 2 for a, b in centers))
        for x0, y0 in cands:
            area = taken[max(0, y0 - 1):y0 + h + 2, max(0, x0 - 1):x0 + w + 2]   # 1px 띄움(그림자 자리 포함)
            far = all((x0 + w / 2 - a) ** 2 + (y0 + h / 2 - b) ** 2 >= MIN_D ** 2 for a, b in centers)
            if not area.any() and far: break
        else: continue
        centers.append((x0 + w / 2, y0 + h / 2))
        cxm = np.mean([p[0] for p in pts]); cym = np.mean([p[1] for p in pts])
        for x, y in (pts if SHADOW_ON else []):                     # 그림자: 오른쪽 아래·아래 한 칸
            for sx, sy in ((1, 1), (0, 1)):
                X, Y = x0 + x + sx, y0 + y + sy
                if (x + sx, y + sy) not in pts and not out[Y, X, 3]: out[Y, X] = SHADOW + (255,)
        for x, y in pts:
            t = (x - cxm) + (y - cym)                               # 왼위 밝고 오른아래 어두움
            c = pal[[0, len(pal) // 2, len(pal) - 2][0 if t > 0.8 else (1 if t > -0.2 else 2)]]
            if (x, y) == min(pts, key=lambda p: (p[0] + p[1], p[1])): c = pal[-1]   # 왼위 끝 한 점 = 하이라이트
            out[y0 + y, x0 + x] = tuple(c) + (255,)
        hx, hy = min(pts, key=lambda p: (p[0] + p[1], p[1]))
        hi.append((x0 + hx, y0 + hy))
        boxes.append((x0, y0, w + 1, h + 1))                        # 알갱이 + 그림자 자리
        taken[y0:y0 + h + 1, x0:x0 + w + 1] = True
    return out, hi, boxes

if __name__ == "__main__":
    cols = ore_cols()
    only = [int(x) for x in sys.argv[1:] if x.isdigit()]
    spark, boxd = {}, {}
    for oid in sorted(cols):
        if only and oid not in only: continue
        refp = os.path.join(REF, "copper_ref.png" if oid == 2 else "%d_ref.png" % oid)
        if oid in GEMS and not os.path.exists(refp):
            print("광물 %d: 보석이라 건너뜀 (PixelLab 원본 필요)" % oid); continue
        gem = oid in GEMS
        pal = ref_palette(refp, gem) if os.path.exists(refp) else ramp(*COL_OVERRIDE.get(oid, cols[oid]))
        if gem and os.path.exists(refp) and max(colorsys.rgb_to_hsv(*[c / 255 for c in q])[2] for q in pal) < 0.7:
            # 원본 색이 너무 어두우면(루비) ORE_COL 의 밝은 단계를 더해 밝힘 (원본의 어두운 색은 그늘로 남김)
            pal = sorted(set(pal) | set(ramp(*cols[oid])[1:]), key=lambda c: c[0] * 3 + c[1] * 6 + c[2])
        sp, bx = [], []
        for v in range(4):
            t, hi, boxes = fleck_tile(pal, seed=(0 if oid == 2 else oid * 10) + v, gem=gem)   # 구리 = 처음 고른 배치(0~3)
            Image.fromarray(np.kron(t, np.ones((2, 2, 1), np.uint8)), "RGBA").save(os.path.join(OUT, "%d_%d.png" % (oid, v)))
            sp.append([[round((2 * x + 1) / 4, 2), round((2 * y + 1) / 4, 2)] for x, y in hi[:3]])   # 반짝임: 하이라이트 셋 (16칸 좌표 = 화면 px / 4)
            bx.append([[2 * x, 2 * y, 2 * w, 2 * h] for x, y, w, h in boxes])                     # 알갱이 자리 (화면 px, 64칸)
        spark[oid] = sp; boxd[oid] = bx
        print("광물 %d: %s %s" % (oid, "PixelLab 색" if os.path.exists(refp) else "ORE_COL 색", pal))
    print("ORE_FLECK_SPARK =", json.dumps(spark).replace(" ", ""))
    print("ORE_FLECK_BOX =", json.dumps(boxd).replace(" ", ""))
