#!/usr/bin/env python3
# 드릴 도안 v2 — '기계 장치' 느낌: 옆에서 본 전동 드릴
#  모터 몸통(통풍구·계기판·리벳) + 권총 손잡이 + 배터리/연료통 + 척(조이는 턱) + 나선 홈 비트
#  등급 4 × 진화 4. 64x48 도트
import math, sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drills import MAT, OUTLINE, GRADES, hx

W, H = 64, 48
yy, xx = np.mgrid[0:H, 0:W].astype(float) + 0.5

def rrect(x0, y0, x1, y1, r=0):
    m = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    if r > 0:
        for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
            corner = (np.abs(xx - cx) > 0) & (((xx < x0 + r) & (cx == x0 + r)) | ((xx > x1 - r) & (cx == x1 - r))) & (((yy < y0 + r) & (cy == y0 + r)) | ((yy > y1 - r) & (cy == y1 - r)))
            m &= ~(corner & ((xx - cx) ** 2 + (yy - cy) ** 2 > r * r))
    return m
def circ(cx, cy, r): return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
def poly(pts):
    from matplotlib.path import Path
    p = Path(pts)
    return p.contains_points(np.stack([xx.ravel(), yy.ravel()], 1)).reshape(H, W)

def box_shade(y0, y1, x0=None, x1=None, base=3.0):
    """상자: 위쪽 밝음 → 아래 어둠, 맨 윗줄 반짝, 맨 아랫줄 그늘"""
    t = base + 0.8 - (yy - y0) / max(1, (y1 - y0)) * 1.8
    t = np.where(yy < y0 + 1.5, base + 1.9, t)
    t = np.where(yy > y1 - 1.2, base - 1.4, t)
    if x0 is not None: t = np.where(xx < x0 + 1.2, t + 0.6, t)
    if x1 is not None: t = np.where(xx > x1 - 1.2, t - 0.7, t)
    return t
def cyl_shade(cy, r, base=3.0):
    """가로로 누운 원통: 위쪽 1/3 지점이 가장 밝음"""
    n = np.clip((yy - cy) / np.maximum(r, 0.6), -1, 1)
    t = base - n * 1.9
    return t + np.where((n > -0.72) & (n < -0.3), 1.0, 0)

# 진화 단계별 크기 (몸통 높이·비트 길이 등이 커짐)
EV = {
    1: dict(body=(9, 15, 31, 29), chuck=(31, 17, 36, 27), bit=(36, 56, 6.0), grip=(14, 29, 21, 42), batt=(10, 40, 25, 45)),
    2: dict(body=(7, 13, 31, 29), chuck=(31, 15, 37, 27), bit=(37, 59, 7.0), grip=(13, 29, 21, 42), batt=(9, 40, 26, 46)),
    3: dict(body=(6, 12, 32, 30), chuck=(32, 14, 38, 28), bit=(38, 61, 8.0), grip=(13, 30, 21, 42), batt=(8, 40, 27, 46)),
    4: dict(body=(5, 11, 32, 31), chuck=(32, 13, 39, 29), bit=(39, 63, 9.5), grip=(13, 31, 21, 42), batt=(7, 40, 28, 47)),
}

def render(g, evo):
    E = EV[evo]
    part = np.zeros((H, W), int); mat = np.empty((H, W), object); tone = np.zeros((H, W)); names = []
    def put(name, m, mask, shade):
        names.append(name); k = len(names)
        part[mask] = k; mat[mask] = m
        tone[mask] = shade[mask] if np.ndim(shade) == 2 else float(shade)
    bx0, by0, bx1, by1 = E["body"]; cy = (by0 + by1) / 2
    gx0, gy0, gx1, gy1 = E["grip"]
    # ---- 배터리 / 연료통 (손잡이 아래) ----
    ax0, ay0, ax1, ay1 = E["batt"]
    batt = rrect(ax0, ay0, ax1, ay1, 1.5)
    put("batt", g["body"], batt, box_shade(ay0, ay1, ax0, ax1, 2.8))
    if evo >= 2:                                                       # 배터리 눈금(충전 칸)
        for k in range(3 + (evo >= 3)):
            m = rrect(ax0 + 3 + k * 3.2, ay0 + 2, ax0 + 4.6 + k * 3.2, ay1 - 2)
            put("cell", g["gem"] if evo >= 3 else "emer", m, 3.6 if k < 2 + evo // 2 else 1.2)
    # ---- 권총 손잡이 (뒤로 비스듬히) + 방아쇠 ----
    grip = poly([(gx0, gy0), (gx1, gy0), (gx1 - 2.5, gy1), (gx0 - 2.5, gy1)])
    gs = 3.0 - (xx - gx0) / (gx1 - gx0) * 1.6 + np.where(xx < gx0 + 1.5, 0.8, 0)
    if evo >= 2: gs = gs - np.where((yy % 3) < 1, 1.0, 0)            # 미끄럼 방지 홈
    put("grip", g["grip"], grip, gs)
    trig = rrect(gx1, gy0 + 1, gx1 + 2.2, gy0 + 5, 0.8)
    put("trig", g["band"], trig, 2.6)
    # ---- 모터 몸통 ----
    body = rrect(bx0, by0, bx1, by1, 3 + (evo >= 3))
    put("body", g["body"], body, box_shade(by0, by1, bx0, bx1, 3.0))
    # 뒤쪽 팬 덮개(동그란 그릴)
    fan = circ(bx0 + 3.5, cy, (by1 - by0) / 2 - 1.5) & body
    tone[fan] -= 0.6
    grill = fan & (((xx + yy) % 3) < 1)
    tone[grill] -= 1.4
    # 통풍구 (가로 홈 3~4줄)
    for k in range(3 + (evo >= 3)):
        vy = by0 + 4 + k * 2.6
        m = rrect(bx0 + 9, vy, bx0 + 17 + evo, vy + 0.9) & body
        tone[m] = 0.8
    # 몸통 띠 (2단계부터) + 리벳
    if evo >= 2:
        for x0 in (bx0 + 7, bx1 - 4):
            m = rrect(x0, by0 - 0.6, x0 + 2.2, by1 + 0.6) & ~fan
            put("band", g["band"], m, box_shade(by0, by1, base=3.4))
        for x0 in (bx0 + 8, bx1 - 3):
            for y0 in (by0 + 2, by1 - 2):
                put("rivet", "gold" if g["key"] == "legend" else "silver", circ(x0 + 0.1, y0, 0.75), 5)
    # 계기판 (2단계부터): 둥근 게이지 + 바늘
    if evo >= 2:
        gx, gyc, gr = bx1 - 9.5, by0 + 5, 2.8 + (evo >= 4) * 0.4
        put("gauge", "white", circ(gx, gyc, gr), 4.2)
        put("gring", g["band"], circ(gx, gyc, gr + 1.1) & ~circ(gx, gyc, gr), 2.4)
        needle = (np.abs((yy - gyc) + (xx - gx) * 0.8) < 0.6) & circ(gx, gyc, gr - 0.6) & (xx >= gx)
        mat[needle] = "ruby"; tone[needle] = 2.5
    # 위 보조 손잡이 (2단계부터)
    if evo >= 2:
        hx0 = bx0 + 9
        top = rrect(hx0, by0 - 4.5, hx0 + 9 + evo, by0 - 2.2, 1.2) | rrect(hx0, by0 - 4.5, hx0 + 1.8, by0 + 0.5) | rrect(hx0 + 7.2 + evo, by0 - 4.5, hx0 + 9 + evo, by0 + 0.5)
        put("thandle", g["grip"], top, box_shade(by0 - 4.5, by0 - 2.2, base=3.0))
    # 3단계: 옆에 드러난 톱니바퀴 + 배기관
    if evo >= 3:
        gcx, gcy, gR = bx0 + (15 if evo < 4 else 13.5), by1 - 4.5, 3.6 + (evo >= 4) * 0.4
        ang = np.arctan2(yy - gcy, xx - gcx); rr = np.hypot(xx - gcx, yy - gcy)
        teeth = rr <= gR + np.where((np.mod(ang * 8 / (2 * np.pi) + 0.25, 1) < 0.5), 1.0, 0)
        gear = teeth & ~(rr <= 1.0)
        put("gear", g["band"], gear, 3.0 - (yy - gcy) / gR * 1.2)
        put("axle", "iron", rr <= 1.0, 1.5)
        for k, px in enumerate((bx0 + 3, bx0 + 6.5)[: 1 + (evo >= 4)]):
            pipe = rrect(px, by0 - 6 - k * 1.5, px + 2.2, by0 + 1)
            put("pipe", "iron", pipe, 3.2 - (xx - px) * 0.7)
            put("pcap", g["band"], rrect(px - 0.6, by0 - 7 - k * 1.5, px + 2.8, by0 - 5.5 - k * 1.5), 3.6)
    # 4단계: 에너지 창 (빛나는 심) — 몸통 가운데 창으로 보임
    if evo >= 4:
        win = rrect(bx0 + 19, by1 - 8.5, bx1 - 2, by1 - 2.5, 1.2)
        put("core", g["rune"], win, 4.2 + np.where(((xx + yy) % 4) < 1.2, 1.0, 0))
    # ---- 척 (비트를 무는 턱) ----
    cx0, cy0, cx1, cy1 = E["chuck"]
    chuck = rrect(cx0, cy0, cx1, cy1, 1)
    put("chuck", g["band"] if evo >= 3 else "iron", chuck, cyl_shade(cy, (cy1 - cy0) / 2, 3.0))
    tone[chuck & ((np.floor(xx) % 2) == 0)] -= 0.8                      # 손잡이 홈(널링)
    nose = rrect(cx1 - 0.5, cy - (cy1 - cy0) / 2 + 2, cx1 + 1.5, cy + (cy1 - cy0) / 2 - 2)
    put("nose", "iron", nose, cyl_shade(cy, (cy1 - cy0) / 2 - 2, 2.6))
    # ---- 비트 (나선 홈 원뿔) ----
    b0, b1, R = E["bit"]
    t = np.clip((xx - b0) / (b1 - b0), 0, 1)
    rad = R * (1 - t) ** 0.9 + 0.6
    bit = (xx >= b0) & (xx <= b1) & (np.abs(yy - cy) <= rad)
    n = np.clip((yy - cy) / np.maximum(rad, 0.5), -1, 1)
    pitch = 6.0 - evo * 0.35
    ph = ((xx - b0) / pitch - np.arcsin(n) / (2 * math.pi) * 1.4) % 1.0    # 옆에서 본 나선: 비스듬한 줄
    bs = cyl_shade(cy, np.maximum(rad, 0.5), 3.1)
    groove, edge = ph < 0.26, (ph >= 0.26) & (ph < 0.4)
    bs = bs - np.where(groove, 1.9, 0) + np.where(edge, 1.1, 0)
    if evo >= 2:                                                        # 나선 날이 위아래 윤곽 밖으로 톱니처럼
        teeth = (np.abs(yy - cy) > rad) & (np.abs(yy - cy) <= rad + 0.8 + (evo - 2) * 0.5) & (xx >= b0 + 1) & (xx <= b1 - 3) & (ph > 0.28) & (ph < 0.46)
        bit |= teeth
        bs = np.where(teeth, np.where(yy < cy, 4.4, 2.0), bs)
    put("bit", g["cone"], bit, bs)
    if g.get("glowGroove") and evo >= 3:                                 # 영웅: 홈 속 용암
        gl = bit & groove & (np.abs(yy - cy) <= rad - 0.7)
        mat[gl] = g["rune"]; tone[gl] = 3.2
    if evo >= 4:                                                        # 각성: 빛나는 심 + 룬
        core = bit & (np.abs(yy - cy) < 1.0) & (xx > b1 - 7)
        mat[core] = g["rune"]; tone[core] = 5.2
        rune = bit & (np.abs(yy - cy + rad * 0.35) < 0.7) & (((xx - b0) % 5) < 2) & (xx < b1 - 6) & (xx > b0 + 2)
        mat[rune] = g["rune"]; tone[rune] = 4.6
    tone[bit & (np.abs(xx - (b1 - 1.2)) < 0.8) & (np.abs(yy - cy + 0.3) < 0.7)] = 5.5

    # ---- 색칠 + 경계 + 외곽선 + 등급 테두리 ----
    img = np.zeros((H, W, 4), float)
    for y in range(H):
        for x in range(W):
            if part[y, x]:
                r = MAT[mat[y, x]]
                img[y, x, :3] = r[int(np.clip(round(tone[y, x]), 0, 5))]; img[y, x, 3] = 255
    skip = {"rivet", "cell", "core", "gauge"}
    for y in range(H):
        for x in range(W):
            k = part[y, x]
            if not k: continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                y2, x2 = y + dy, x + dx
                if 0 <= y2 < H and 0 <= x2 < W and part[y2, x2] > k and names[part[y2, x2] - 1] not in skip:
                    img[y, x, :3] = MAT[mat[y, x]][0]; break
    pad = lambda a: np.pad(a, 3)
    img = np.stack([pad(img[..., c]) for c in range(4)], -1)
    def ring(f, diag):
        o = np.zeros_like(f)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if (dy or dx) and (diag or not (dy and dx)): o |= np.roll(np.roll(f, dy, 0), dx, 1)
        return o & ~f
    f = img[..., 3] > 0
    ol = ring(f, False); img[ol, :3] = OUTLINE; img[ol, 3] = 255
    f = img[..., 3] > 0
    rim = ring(f, True); rc = hx(g["rim"]); img[rim, :3] = rc; img[rim, 3] = 255
    if evo >= 4:
        f = img[..., 3] > 0
        r2 = ring(f, False); img[r2, :3] = np.clip(rc * 0.55 + 255 * 0.45, 0, 255); img[r2, 3] = 150
        rng = np.random.default_rng(len(g["key"]) * 7 + 1)
        for _ in range(5):
            x, y = int(rng.uniform(4, W + 2)), int(rng.uniform(4, H + 2))
            if (img[y - 2:y + 3, x - 2:x + 3, 3] == 0).all():
                for (a, b) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                    img[y + a, x + b, :3] = np.clip(rc * 0.5 + 127, 0, 255) if (a, b) == (0, 0) else rc; img[y + a, x + b, 3] = 255
    return img.astype(np.uint8)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for g in GRADES:
        for e in range(1, 5):
            Image.fromarray(render(g, e), "RGBA").save(f"{out}/drill2_{g['key']}_{e}.png")
    print("ok")
