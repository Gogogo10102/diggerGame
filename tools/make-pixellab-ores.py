#!/usr/bin/env python3
# 광물 그림 = PixelLab 원본 (사이드뷰 32px, 덩어리 몇 개가 모인 더미)
#   python3 tools/make-pixellab-ores.py        (원본: tools/ref/pixellab/ores/<광물id>_<번호>.png, 번호 순서대로 씀)
#   원본은 덩어리끼리 붙어 있거나 살짝 겹쳐 있어서, 덩어리를 하나씩 떼어 내 사이를 GAP px 씩 벌려 다시 놓음:
#     1) 밝은 속(테두리보다 밝은 픽셀)을 4방향으로 이어서 덩어리 번호 → 어두운 테두리는 가장 가까운 덩어리 것으로
#     2) 겹치거나 GAP 보다 가까운 두 덩어리를 서로 반대쪽(무게중심 방향)으로 조금씩 밀어냄 (반복)
#     3) 남의 덩어리에 가려져 잘린 면은 테두리 색으로 닫아 줌 → 32x32 가운데에 놓음(떨어진 광물만 바닥에 붙임)
#   → ores/world/<id>_<0~3>.png (64x64, 2배. 원본이 4개보다 적으면 돌려 씀)
#       땅속 칸은 더미 모양 그대로가 아니라 덩어리를 칸 전체에 고르게 흩어 놓음(3x3 격자 자리 + 흔들기, 가장자리 1px 띄움)
#     ores/icon/<id>.png (32x32, 첫 번째 더미 1:1) · ores/drop/<id>.png (24x24, 첫 번째 더미에서 큰 덩어리 3개)
#   원본 중 4개만 쓰고 싶으면 파일 이름 번호로 순서를 정함(앞 4개가 땅속 변형).
import os, re, glob, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools/ref/pixellab/ores")
OUT = os.path.join(ROOT, "public/assets/ores")
GAP = 1                  # 덩어리 사이 빈칸 (원본 px. 게임에선 2배 = 2px)
MIN_PART = 4             # 이보다 작은 밝은 조각은 덩어리로 치지 않음(하이라이트 점)

def lum(a): return a[..., 0].astype(int) * 3 + a[..., 1].astype(int) * 6 + a[..., 2].astype(int)

def otsu(v):
    """밝기 값들을 두 무리로 가장 잘 나누는 경계 (오츠 방법)"""
    v = np.sort(v.astype(float)); best, thr = -1, v.mean()
    for t in np.unique(v)[:-1]:
        lo, hi = v[v <= t], v[v > t]
        s = len(lo) * len(hi) * (lo.mean() - hi.mean()) ** 2
        if s > best: best, thr = s, t
    return thr

def load(path):
    a = np.array(Image.open(path).convert("RGBA"))
    a[a[..., 3] < 128] = 0                                          # 반투명 가장자리는 버림(도트)
    a[a[..., 3] > 0, 3] = 255
    return a

def split(a):
    """덩어리별 (마스크, 왼위 x, y) 목록 + 원래 번호 지도"""
    al = a[..., 3] > 0
    L = lum(a)
    thr = otsu(L[al])                                               # 테두리(어두운 무리)와 속(밝은 무리)을 가르는 값
    inner = al & (L > thr)
    lab, n = ndimage.label(inner)
    keep = [i for i in range(1, n + 1) if (lab == i).sum() >= MIN_PART]
    lab = np.where(np.isin(lab, keep), lab, 0)
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    full = np.where(al, lab[iy, ix], 0)
    # 외딴 점(테두리가 덩어리에서 멀리 떨어진 1~2px 티끌)은 버림
    parts = []
    for k in keep:
        m = full == k
        sub, sn = ndimage.label(m)
        if sn > 1:
            big = max(range(1, sn + 1), key=lambda j: (sub == j).sum())
            m = sub == big
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        parts.append({"m": m[y0:y1, x0:x1], "x": float(x0), "y": float(y0), "k": k,
                      "px": a[y0:y1, x0:x1].copy(), "box": (x0, y0)})
    return parts, full

def close_cuts(a, full, p):
    """남의 덩어리와 맞닿았던 가장자리 픽셀 = 잘린 면 → 그 덩어리의 테두리 색으로"""
    m, px = p["m"], p["px"]
    x0, y0 = p["box"]
    al = m
    dark = px[al & (lum(px) <= np.percentile(lum(px)[al], 20))]
    oc = dark[np.argmin(lum(dark[None])[0])] if len(dark) else np.array([60, 10, 5, 255])
    H, W = m.shape
    for y in range(H):
        for x in range(W):
            if not m[y, x]: continue
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                yy, xx = y + dy, x + dx
                inside = 0 <= yy < H and 0 <= xx < W and m[yy, xx]
                if inside: continue
                gy, gx = y0 + yy, x0 + xx                          # 원본 좌표에서 이웃이 다른 덩어리였나
                if 0 <= gy < full.shape[0] and 0 <= gx < full.shape[1] and full[gy, gx] not in (0, p["k"]):
                    px[y, x] = oc
                    break
    px[~m] = 0

def overlap(p, q, gap):
    ax, ay, bx, by = round(p["x"]), round(p["y"]), round(q["x"]), round(q["y"])
    pm = ndimage.binary_dilation(np.pad(p["m"], gap), np.ones((2 * gap + 1, 2 * gap + 1), bool)) if gap else p["m"]
    ax -= gap; ay -= gap
    x0, y0 = max(ax, bx), max(ay, by)
    x1, y1 = min(ax + pm.shape[1], bx + q["m"].shape[1]), min(ay + pm.shape[0], by + q["m"].shape[0])
    if x1 <= x0 or y1 <= y0: return False
    return bool((pm[y0 - ay:y1 - ay, x0 - ax:x1 - ax] & q["m"][y0 - by:y1 - by, x0 - bx:x1 - bx]).any())

def centroid(p):
    ys, xs = np.nonzero(p["m"])
    return np.array([p["x"] + xs.mean(), p["y"] + ys.mean()])

def spread(parts, gap=GAP):
    for _ in range(400):
        moved = False
        for i in range(len(parts)):
            for j in range(i + 1, len(parts)):
                p, q = parts[i], parts[j]
                if not overlap(p, q, gap): continue
                d = centroid(p) - centroid(q)
                d = d / (np.linalg.norm(d) or 1)
                d[1] *= 0.6                                         # 위아래보다 옆으로 벌림(더미가 너무 높아지지 않게)
                p["x"] += d[0] * 0.5; p["y"] += d[1] * 0.5
                q["x"] -= d[0] * 0.5; q["y"] -= d[1] * 0.5
                moved = True
        if not moved: return parts
    print("  ! 다 못 벌림 (덩어리가 너무 많거나 큼)")
    return parts

def compose(parts, size, bottom=None):
    xs = [round(p["x"]) for p in parts]; ys = [round(p["y"]) for p in parts]
    x0 = min(xs); x1 = max(x + p["m"].shape[1] for x, p in zip(xs, parts))
    y0 = min(ys); y1 = max(y + p["m"].shape[0] for y, p in zip(ys, parts))
    w, h = x1 - x0, y1 - y0
    if w > size or h > size: print("  ! %dx%d 가 %d 칸보다 큼 → 가장자리가 잘림" % (w, h, size))
    ox = (size - w) // 2 - x0
    oy = (max(0, size - bottom - h) if bottom is not None else (size - h) // 2) - y0   # bottom 을 주면 바닥에 붙임(떨어진 광물)
    out = np.zeros((size, size, 4), np.uint8)
    for x, y, p in zip(xs, ys, parts):
        for yy in range(p["m"].shape[0]):
            for xx in range(p["m"].shape[1]):
                if not p["m"][yy, xx]: continue
                X, Y = x + ox + xx, y + oy + yy
                if 0 <= X < size and 0 <= Y < size: out[Y, X] = p["px"][yy, xx]
    return out

def fits_all(parts, gap, size, M):
    for i, p in enumerate(parts):
        x, y = round(p["x"]), round(p["y"])
        if x < M or y < M or x + p["m"].shape[1] > size - M or y + p["m"].shape[0] > size - M: return False
        for q in parts[i + 1:]:
            if overlap(p, q, gap): return False
    return True

def scatter(parts, size=32, seed=0, gap=GAP, M=1):
    """땅속 칸용: 덩어리를 네모 칸 전체에 고르게(3x3 격자 + 흔들기) 흩어 놓음. 이웃 칸과도 붙지 않게 가장자리 M px 띄움"""
    rng = np.random.default_rng(seed)
    for tries in range(200):
        ps = sorted(parts, key=lambda p: -p["m"].sum())[:9]
        cells = [(cx, cy) for cy in range(3) for cx in range(3)]
        while True:                                                 # 빈 자리끼리 붙지 않게(한쪽이 휑하지 않게)
            rng.shuffle(cells)
            empty = cells[len(ps):]
            if all(abs(a[0] - b[0]) + abs(a[1] - b[1]) > 1 for i, a in enumerate(empty) for b in empty[i + 1:]): break
        cw = (size - 2 * M) / 3
        for p, (cx, cy) in zip(ps, cells):
            h, w = p["m"].shape
            jx, jy = rng.uniform(-2.2, 2.2, 2)
            p["x"] = M + (cx + 0.5) * cw - w / 2 + jx
            p["y"] = M + (cy + 0.5) * cw - h / 2 + jy
        for _ in range(300):                                        # 겹친 것 밀어내기 + 칸 밖으로 나간 것 끌어들이기
            moved = False
            for i in range(len(ps)):
                for j in range(i + 1, len(ps)):
                    p, q = ps[i], ps[j]
                    if not overlap(p, q, gap): continue
                    d = centroid(p) - centroid(q); d = d / (np.linalg.norm(d) or 1)
                    p["x"] += d[0] * 0.5; p["y"] += d[1] * 0.5; q["x"] -= d[0] * 0.5; q["y"] -= d[1] * 0.5
                    moved = True
            for p in ps:
                h, w = p["m"].shape
                nx = min(max(p["x"], M), size - M - w); ny = min(max(p["y"], M), size - M - h)
                if abs(nx - p["x"]) > 1e-6 or abs(ny - p["y"]) > 1e-6: p["x"], p["y"] = nx, ny; moved = True
            if not moved: break
        if fits_all(ps, gap, size, M): return ps
    print("  ! 칸에 고르게 못 넣음 (덩어리가 너무 큼)")
    return ps

def place(parts, size):
    """정해 둔 자리 그대로 size 칸에 찍음"""
    out = np.zeros((size, size, 4), np.uint8)
    for p in parts:
        x, y = round(p["x"]), round(p["y"])
        for yy, xx in zip(*np.nonzero(p["m"])):
            X, Y = x + xx, y + yy
            if 0 <= X < size and 0 <= Y < size: out[Y, X] = p["px"][yy, xx]
    return out

def x2(a): return np.kron(a, np.ones((2, 2, 1), np.uint8))
def save(a, path): os.makedirs(os.path.dirname(path), exist_ok=True); Image.fromarray(a, "RGBA").save(path)

def pile(path):
    a = load(path)
    parts, full = split(a)
    for p in parts: close_cuts(a, full, p)
    return spread(parts)

if __name__ == "__main__":
    files = {}
    for f in glob.glob(os.path.join(SRC, "*.png")):
        m = re.match(r"(\d+)_(\d+)\.png$", os.path.basename(f))
        if m: files.setdefault(int(m.group(1)), []).append((int(m.group(2)), f))
    only = [int(x) for x in sys.argv[1:]]
    for oid in sorted(files):
        if only and oid not in only: continue
        fs = [f for _, f in sorted(files[oid])]
        piles = [pile(f) for f in fs[:4]]
        print("광물 %d: 원본 %d개, 덩어리 %s" % (oid, len(fs), [len(p) for p in piles]))
        for v in range(4):                                          # 땅속: 칸 전체에 고르게 흩어 놓음(불규칙하지만 빈 곳 없이)
            save(x2(place(scatter(pile(fs[v % len(fs)]), 32, seed=oid * 10 + v), 32)), os.path.join(OUT, "world", "%d_%d.png" % (oid, v)))
        save(compose(piles[0], 32), os.path.join(OUT, "icon", "%d.png" % oid))
        # 떨어진 광물(24칸): 첫 더미에서 가운데 크기 덩어리 3개를 골라 작은 더미로 (큰 것만 고르면 24칸을 넘음)
        ps = sorted(pile(fs[0]), key=lambda p: p["m"].sum())
        mid = len(ps) // 2
        drop3 = ps[max(0, mid - 1):mid + 2]
        for k, p in enumerate(drop3): p["x"], p["y"] = [(0, 8), (10, 8), (5, 0)][k]   # 아래 둘 · 위 하나
        save(compose(spread(drop3), 24, bottom=1), os.path.join(OUT, "drop", "%d.png" % oid))
