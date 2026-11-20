#!/usr/bin/env python3
# 드릴 장비 도안: 등급 4 (일반·희귀·영웅·전설) × 진화 4단계 = 16개
# 참고 느낌: 굵은 검은 외곽선 + 등급색 바깥 테두리, 6단 명암, 금속 결 · 보석 · 룬
# 대각선(손잡이 왼쪽 아래 → 드릴 끝 오른쪽 위) 48x48 도트
import math, sys, os
import numpy as np
from PIL import Image

N = 52
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
def ramp(*cols): return [hx(c) for c in cols]

# 재질 6단 (어둠 → 밝음)
MAT = {
    "steel":  ramp("#1d2230", "#3a4256", "#5d6880", "#8b97ad", "#bcc6d6", "#eef3fa"),
    "iron":   ramp("#1c1a20", "#35323c", "#4f4b57", "#6d6976", "#928e9c", "#c4c0cc"),
    "wood":   ramp("#24140c", "#4a2a16", "#6e4122", "#925a30", "#b57944", "#d8a066"),
    "leather":ramp("#1e100c", "#3d2016", "#5c3220", "#7c4a2e", "#9c643e", "#c08a5a"),
    "brass":  ramp("#2a1a08", "#5a3a10", "#8a5e1a", "#b98a2a", "#e0b84a", "#fff0a0"),
    "gold":   ramp("#3a2200", "#7a4a00", "#b87800", "#e8a80c", "#ffd34d", "#fff6c8"),
    "cobalt": ramp("#0c1430", "#1a2c62", "#26479a", "#3a6ad0", "#6a9cf0", "#c8e0ff"),
    "silver": ramp("#22262e", "#4a5260", "#7a8494", "#aab4c2", "#d6dde6", "#ffffff"),
    "obsid":  ramp("#100c18", "#211a30", "#352a4a", "#4c3e66", "#6a5a88", "#9a8ab8"),
    "amethyst":ramp("#200838", "#43126e", "#6a22a6", "#9a46d8", "#c88cf4", "#f4e0ff"),
    "lava":   ramp("#300806", "#6a1208", "#b02a0c", "#ea5a12", "#ff9a3a", "#ffe08a"),
    "ruby":   ramp("#30040c", "#6a0a1c", "#b0182e", "#ea3a48", "#ff8a8a", "#ffe0e0"),
    "sapph":  ramp("#04143a", "#0a2e78", "#1658c0", "#2a8cf0", "#7ac4ff", "#e0f4ff"),
    "emer":   ramp("#032a14", "#08562a", "#129048", "#2ac86a", "#7af0a6", "#e0ffee"),
    "ember":  ramp("#3a1000", "#7a2a00", "#c25200", "#ff8a1a", "#ffc65a", "#fff4c8"),
    "white":  ramp("#3a3f4c", "#6a7284", "#9aa3b4", "#c8cfdc", "#e8ecf2", "#ffffff"),
}
OUTLINE = hx("#120c18")

# 등급: 바깥 테두리 색 · 재질 조합
GRADES = [
    dict(key="common", name="일반", rim="#c9cfd8", cone="steel", body="iron", band="iron", grip="wood", gem="emer", rune="ember"),
    dict(key="rare", name="희귀", rim="#4aa8ff", cone="cobalt", body="silver", band="silver", grip="leather", gem="sapph", rune="sapph"),
    dict(key="epic", name="영웅", rim="#b36bff", cone="obsid", body="obsid", band="amethyst", grip="leather", gem="amethyst", rune="lava", glowGroove=True),
    dict(key="legend", name="전설", rim="#ffcc33", cone="gold", body="brass", band="gold", grip="leather", gem="ruby", rune="ember"),
]
EVO = ["1단계 · 기본", "2단계 · 강화", "3단계 · 개조", "4단계 · 각성"]

# ---- 대각선 축 좌표 ----
#  u: 손잡이 끝(0) → 드릴 끝(L), v: 축에서 옆으로 (+ 는 오른쪽 아래 = 그늘 쪽)
S2 = math.sqrt(2)
# 진화 단계마다 크기·모양: L 전체 길이, br 모터 반지름, body 모터 구간, cr 날 밑동 반지름, cone 날 구간
EV = {1: dict(L=44, br=4.6, body=(15, 23), cr=6.4, cone=(23, 43)),
      2: dict(L=50, br=5.4, body=(15, 25), cr=7.6, cone=(25, 49)),
      3: dict(L=55, br=6.0, body=(15, 26), cr=8.8, cone=(26, 54)),
      4: dict(L=59, br=6.6, body=(15, 27), cr=10.0, cone=(27, 58))}

def render(g, evo):
    E = EV[evo]
    X0, Y0 = N / 2 - E["L"] / (2 * S2) + 1.0, N / 2 + E["L"] / (2 * S2) - 1.0   # 가운데 정렬 (손잡이 쪽이 조금 가벼워서 살짝 이동)
    yy, xx = np.mgrid[0:N, 0:N].astype(float) + 0.5
    dx, dy = xx - X0, yy - Y0
    U, V = (dx - dy) / S2, (dx + dy) / S2
    part = np.zeros((N, N), int)          # 0 빈칸, 숫자 = 부품 (나중에 넣은 것이 앞)
    mat = np.empty((N, N), object)
    tone = np.zeros((N, N), float)
    PARTS = []
    def put(name, m, mask, shade):
        PARTS.append(name); k = len(PARTS)
        part[mask] = k; mat[mask] = m; tone[mask] = shade[mask] if np.ndim(shade) == 2 else float(shade)
    def cyl_shade(r, bias=0.0, vv=None):
        vv = V if vv is None else vv
        n = np.clip(vv / np.maximum(r, 0.6), -1, 1)                # -1 빛 쪽(왼쪽 위) ~ 1 그늘
        t = 3.1 - n * 2.0 + bias
        t += np.where((n > -0.78) & (n < -0.38), 1.0, 0)            # 원통 하이라이트 띠
        return t
    br, cr = E["br"], E["cr"]
    b0, b1 = E["body"]; c0, c1 = E["cone"]
    # 손잡이 끝 (폼멜)
    pr = 2.4 + (0.5 if evo >= 2 else 0) + (0.5 if evo >= 4 else 0)
    pm = ((U - 2.2) ** 2 + V ** 2 <= pr ** 2) if evo < 3 else ((np.abs(U - 2.4) + np.abs(V)) <= pr + 1.0)
    put("pommel", g["band"] if evo >= 2 else g["body"], pm, cyl_shade(pr, 0.4))
    if evo >= 3:                                                      # 폼멜 보석
        gm = (np.abs(U - 2.4) + np.abs(V)) <= 1.2
        put("pgem", g["gem"], gm, 3.6 - V)
    # 손잡이
    gr = 2.3
    grip = (U >= 3.5) & (U <= b0) & (np.abs(V) <= gr)
    sh = cyl_shade(gr)
    if evo >= 2: sh = sh - np.where(((U + V * 0.9) % 3.0) < 1.0, 1.1, 0)   # 감은 가죽 줄
    put("grip", g["grip"], grip, sh)
    for u0 in ([4.2, b0 - 1.8] if evo >= 2 else [b0 - 1.6]):
        m = (U >= u0) & (U <= u0 + 1.5) & (np.abs(V) <= gr + 0.9)
        put("ring", g["band"], m, cyl_shade(gr + 0.9, 0.4))
    # 옆 손잡이 (2단계부터): 모터 아래쪽으로 튀어나온 권총 손잡이 → '드릴' 다운 모양
    if evo >= 2:
        hu = b0 + 2.5
        h = (np.abs(U - hu) <= 1.7) & (V >= br - 0.5) & (V <= br + 4.5 + evo * 0.4)
        put("handle", g["grip"], h, 3.0 - (U - hu) * 0.8)
        cap = (np.abs(U - hu) <= 2.1) & (V >= br + 4.0 + evo * 0.4) & (V <= br + 5.6 + evo * 0.4)
        put("hcap", g["band"], cap, 2.6)
    # 모터 몸통
    body = (U >= b0) & (U <= b1) & (np.abs(V) <= br) & ((np.abs(V) <= br - 1.2) | ((U >= b0 + 1) & (U <= b1 - 1)))
    put("body", g["body"], body, cyl_shade(br, -0.1))
    vent = body & (U >= b0 + 2.5) & (U <= b1 - 2.5) & ((np.floor(U) % 2) == 0) & (np.abs(V) <= br - 2.2)
    tone[vent] -= 1.7
    if evo >= 2:                                                      # 모터 띠 + 리벳
        for u0 in (b0 + 0.6, b1 - 2.0):
            m = (U >= u0) & (U <= u0 + 1.6) & (np.abs(V) <= br + 0.7)
            put("band", g["band"], m, cyl_shade(br + 0.7, 0.5))
        for vv in (-br + 1.7, br - 1.7):
            m = ((U - (b0 + b1) / 2) ** 2 + (V - vv) ** 2) <= 0.8
            put("rivet", "gold" if g["key"] == "legend" else "silver", m, 5)
    if evo >= 3:                                                      # 모터 양옆 날개
        for sgn in (-1, 1):
            wing = (U >= b1 - 5) & (U <= b1 + 0.5) & (sgn * V >= br) & (sgn * V <= br + 2.8 + (evo - 3) * 1.6) & ((sgn * V - br) <= (U - (b1 - 5)) * 0.8)
            if sgn > 0 and evo >= 2: wing &= ~((np.abs(U - (b0 + 2.5)) <= 2.2))
            put("wing", g["band"], wing, np.where(sgn < 0, 4.3, 1.9))
        gem_r = 2.2 + (0.7 if evo >= 4 else 0)
        gm = (np.abs(U - (b0 + b1) / 2) + np.abs(V)) <= gem_r
        put("gem", g["gem"], gm, 3.1 - V * 0.9)
        tone[gm & (np.abs(U - (b0 + b1) / 2 + 0.6) < 0.6) & (np.abs(V + 0.9) < 0.6)] = 5.6
    # 드릴 날 (원뿔 + 나선)
    t = np.clip((U - c0) / (c1 - c0), 0, 1)
    rad = cr * (1 - t) ** (1.0 if evo < 3 else 0.85)
    cone = (U >= c0) & (U <= c1) & (np.abs(V) <= rad)
    n = np.clip(V / np.maximum(rad, 0.5), -1, 1)
    theta = np.arcsin(n)
    pitch = 6.2 - evo * 0.5
    ph = ((U - c0) / pitch + theta / (2 * math.pi) * 1.3) % 1.0
    csh = cyl_shade(np.maximum(rad, 0.5), 0.2)
    groove, edge = ph < 0.24, (ph >= 0.24) & (ph < 0.38)
    csh = csh - np.where(groove, 1.9, 0) + np.where(edge, 1.0, 0)
    if evo >= 2:                                                      # 나선 날이 윤곽 밖으로 톱니처럼
        teeth = (np.abs(V) > rad) & (np.abs(V) <= rad + 0.9 + (evo - 2) * 0.6) & (U >= c0 + 1.5) & (U <= c1 - 3) & (ph > 0.26) & (ph < 0.44)
        cone = cone | teeth
        csh = np.where(teeth, np.where(V < 0, 4.4, 2.0), csh)
    put("cone", g["cone"], cone, csh)
    if g.get("glowGroove") and evo >= 3:                              # 영웅: 3단계부터 나선 홈 속이 용암처럼 빛남
        gl = cone & groove & (np.abs(V) <= rad - 0.6)
        mat[gl] = g["rune"]; tone[gl] = 3.0 - np.clip(V[gl] / np.maximum(rad[gl], 1), -1, 1) * 0.8
    if evo >= 4:                                                      # 날 밑동 왕관 가시 + 룬 + 빛나는 심
        for sgn in (-1, 1):
            for k, du in enumerate((0.0, 3.2)):
                base = cr - 1.0 - du * 0.7
                sp = (U >= c0 - 1.5 + du) & (U <= c0 + 2.5 + du) & (sgn * V >= base) & (sgn * V <= base + 4.2 - k) & ((sgn * V - base) <= (c0 + 2.5 + du - U) * 1.4)
                put("crown", g["band"], sp, np.where(sgn < 0, 4.5, 2.0))
        rune = cone & (np.abs(V + rad * 0.2) < 0.8) & (((U - c0) % 5.2) < 2.6) & (U < c1 - 5) & (U > c0 + 2)
        mat[rune] = g["rune"]; tone[rune] = 4.7
        core = cone & (np.abs(V) < 1.0) & (U > c1 - 7)
        mat[core] = g["rune"]; tone[core] = 5.2
    tip = (np.abs(U - (c1 - 1.6)) < 0.8) & (np.abs(V + 0.2) < 0.7)
    tone[tip & cone] = 5.5

    # ---- 색칠 ----
    img = np.zeros((N, N, 4), float)
    for y in range(N):
        for x in range(N):
            if part[y, x]:
                r = MAT[mat[y, x]]
                img[y, x, :3] = r[int(np.clip(round(tone[y, x]), 0, 5))]
                img[y, x, 3] = 255
    # 부품 사이 경계: 뒤 부품(번호 작은 쪽)이 앞 부품과 닿는 칸을 그 재질의 가장 어두운 색으로
    for y in range(N):
        for x in range(N):
            k = part[y, x]
            if not k: continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy2, xx2 = y + dy, x + dx
                if 0 <= yy2 < N and 0 <= xx2 < N and part[yy2, xx2] > k and PARTS[part[yy2, xx2] - 1] not in ("rivet",):
                    img[y, x, :3] = MAT[mat[y, x]][0]; break
    # 검은 외곽선 (4방향) → 등급색 바깥 테두리 (8방향)
    filled = img[..., 3] > 0
    ol = np.zeros_like(filled)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ol |= np.roll(np.roll(filled, dy, 0), dx, 1)
    ol &= ~filled
    img[ol, :3] = OUTLINE; img[ol, 3] = 255
    f2 = img[..., 3] > 0
    rim = np.zeros_like(f2)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            rim |= np.roll(np.roll(f2, dy, 0), dx, 1)
    rim &= ~f2
    rc = hx(g["rim"])
    img[rim, :3] = rc; img[rim, 3] = 255
    if evo >= 4:                                                      # 각성: 테두리를 한 칸 더 (빛이 번지는 느낌)
        f3 = img[..., 3] > 0; rim2 = np.zeros_like(f3)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)): rim2 |= np.roll(np.roll(f3, dy, 0), dx, 1)
        rim2 &= ~f3
        img[rim2, :3] = np.clip(rc * 0.55 + 255 * 0.45, 0, 255); img[rim2, 3] = 150
    # 4단계: 등급색 반짝이 몇 개
    if evo >= 4:
        rng = np.random.default_rng(len(g["key"]) * 7)
        for _ in range(5):
            x, y = int(rng.uniform(3, N - 4)), int(rng.uniform(3, N - 4))
            if img[y, x, 3] == 0 and img[y - 1, x, 3] == 0 and img[y + 1, x, 3] == 0:
                light = np.clip(rc * 0.5 + 255 * 0.5, 0, 255)
                for (a, b) in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                    img[y + a, x + b, :3] = light if (a, b) == (0, 0) else rc; img[y + a, x + b, 3] = 255
    return img.astype(np.uint8)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for g in GRADES:
        for e in range(1, 5):
            Image.fromarray(render(g, e), "RGBA").save(f"{out}/drill_{g['key']}_{e}.png")
    print("ok")
