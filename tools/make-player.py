#!/usr/bin/env python3
# 광부(사람) 캐릭터 그림: 뼈대(관절 각도)로 자세를 잡아 프레임마다 그림 → 시트 PNG
#   python3 tools/make-player.py   → public/assets/player/body.png · pick.png · pack.png + tiles/ladder.png (사다리 칸)
#   그 다음 npm run assets:manifest
#
# 칸 하나 = 64x64 (화면 1:1), 오른쪽을 봄(왼쪽은 게임이 뒤집어 그림). 발 = y 60, 몸 가운데 = x 32
# 줄(애니메이션) 순서와 프레임 수는 src/game/art/sprites.ts 의 PLAYER_ANIM 과 같아야 함
#   body: 사람 · pick: 곡괭이(머리는 회색 → 곡괭이 단계 색으로 칠함, 자루는 나무색) · pack: 등의 백팩 로켓(몸 뒤에 그림)
# 그림 말투: 드릴 도안과 같은 6단 명암 · 부품 경계 진한 선 · 바깥 1px 아주 어두운 외곽선 (흰 테 없음)
import math, os, sys
import numpy as np
from PIL import Image

N = 64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/player")
SHIFT = 4                                                          # 몸을 칸 왼쪽으로 4px 당겨 앞으로 휘두른 곡괭이가 칸 안에 들어오게 (몸 가운데 = x 28, sprites.ts 의 PCX)
YY, XX = np.mgrid[0:N, 0:N].astype(float) + 0.5
XX = XX + SHIFT

def hx(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
def ramp(*c): return [hx(x) for x in c]
MAT = {   # 0 경계 · 1 그늘 · 2 어둠 · 3 기본 · 4 밝음 · 5 반짝 (어두운 쪽은 색을 틀어 따뜻하게)
    "skin":   ramp("#3a1a14", "#8a4a30", "#c87e56", "#f0b088", "#ffd4b0", "#fff0e2"),
    "hair":   ramp("#0c0808", "#241614", "#3a2620", "#54382c", "#74503e", "#9a7058"),
    "hat":    ramp("#4a1a0a", "#9a3e0c", "#de7a10", "#ffb81a", "#ffe45a", "#fffbd8"),
    "jacket": ramp("#061a24", "#0c3a4a", "#155e70", "#22849a", "#52b4c4", "#a8e8ec"),
    "band":   ramp("#4a3a00", "#9a7a00", "#d8b800", "#ffe84a", "#fff6a0", "#ffffff"),
    "shirt":  ramp("#1a0610", "#3a0e20", "#5a1830", "#7a2440", "#a03a58", "#c86a84"),
    "pants":  ramp("#0a0810", "#16141e", "#24202e", "#343044", "#4c4660", "#6e6888"),
    "boot":   ramp("#140a06", "#2e180c", "#4a2a14", "#6a3e1e", "#8c5a2e", "#b07a44"),
    "glove":  ramp("#140a06", "#3a2210", "#5e3a1c", "#82542a", "#a87440", "#d09a62"),
    "eye":    ramp("#06060a", "#0e1420", "#16243a", "#1e3658", "#4a78b0", "#ffffff"),
    "lampg":  ramp("#3a3000", "#8a7000", "#d8b800", "#fff07a", "#fffbd0", "#ffffff"),
    "metal":  ramp("#202020", "#505050", "#808080", "#b0b0b0", "#e0e0e0", "#ffffff"),   # 회색 → 게임에서 곡괭이 단계 색
    "wood":   ramp("#1e0e06", "#3e2210", "#62381a", "#8a5428", "#ac7238", "#d09a5a"),
    "rocket": ramp("#2a0806", "#6a140c", "#b02818", "#e8442a", "#ff8a6a", "#ffd8c8"),
    "steel":  ramp("#141822", "#2e3648", "#4e5a72", "#7a88a2", "#b0bcd0", "#eef2fa"),
}
OUTLINE = hx("#120c18")

class Cv:
    def __init__(self):
        self.part = np.zeros((N, N), int); self.mat = np.empty((N, N), object); self.tone = np.zeros((N, N)); self.k = 0
    def put(self, m, mask, shade):
        self.k += 1
        self.part[mask] = self.k; self.mat[mask] = m
        self.tone[mask] = shade[mask] if np.ndim(shade) == 2 else float(shade)
    def render(self, outline=True):
        img = np.zeros((N, N, 4))
        for y in range(N):
            for x in range(N):
                if self.part[y, x]:
                    img[y, x, :3] = MAT[self.mat[y, x]][int(np.clip(round(self.tone[y, x]), 1, 5))]; img[y, x, 3] = 255
        # 부품 경계: 위에 그린(뒤에 그린) 부품과 닿은 쪽 칸을 그 재질의 가장 어두운 색으로
        for y in range(N):
            for x in range(N):
                k = self.part[y, x]
                if not k: continue
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    y2, x2 = y + dy, x + dx
                    if 0 <= y2 < N and 0 <= x2 < N and self.part[y2, x2] > k and self.mat[y2, x2] != self.mat[y, x]:
                        img[y, x, :3] = MAT[self.mat[y, x]][0]; break
        if outline:
            a = img[..., 3] > 0; o = np.zeros_like(a)
            ap = np.pad(a, 1)                                              # 가장자리에서 반대쪽으로 넘어가지 않게(예전엔 np.roll 이 감쌌음)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): o |= ap[1 + dy:1 + dy + N, 1 + dx:1 + dx + N]
            img[o & ~a, :3] = OUTLINE; img[o & ~a, 3] = 255
        return img.astype(np.uint8)

# ---- 도형 ----
def capsule(a, b, r):
    a, b = np.array(a, float), np.array(b, float); ba = b - a; L2 = max(1e-6, ba @ ba)
    t = np.clip(((XX - a[0]) * ba[0] + (YY - a[1]) * ba[1]) / L2, 0, 1)
    return np.hypot(XX - (a[0] + t * ba[0]), YY - (a[1] + t * ba[1])) <= r
def ell(cx, cy, rx, ry): return ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1
def poly(pts):
    from matplotlib.path import Path
    return Path(pts).contains_points(np.stack([XX.ravel(), YY.ravel()], 1)).reshape(N, N)
def cyl_shade(a, b, base=3.0):
    """막대(팔·다리): 빛이 왼쪽 위에서 → 막대 축에 수직인 방향으로 밝기 3단"""
    a, b = np.array(a, float), np.array(b, float); d = b - a; d = d / (np.linalg.norm(d) + 1e-9)
    nx, ny = -d[1], d[0]
    if nx * -0.6 + ny * -0.8 < 0: nx, ny = -nx, -ny                # 빛 쪽을 향한 법선
    s = (XX - a[0]) * nx + (YY - a[1]) * ny
    return base + np.where(s > 1.0, 1, np.where(s < -1.2, -1, 0))
def ball_shade(cx, cy, r, base=3.0):
    s = ((XX - cx) + (YY - cy)) / max(1, r)
    return base + np.where(s < -0.55, 1, np.where(s > 0.6, -1, 0)) + np.where(((XX - cx + r * .4) ** 2 + (YY - cy + r * .4) ** 2) < (r * .22) ** 2, 1, 0)
def pt(o, ang, L):
    """o 에서 각도 ang(도, 0 = 아래, + = 앞쪽(오른쪽)으로 들림) 으로 L 만큼"""
    r = math.radians(ang); return (o[0] + math.sin(r) * L, o[1] + math.cos(r) * L)

# ---- 자세 하나 그리기 ----
#  P: dict(bob, lean, nT, nK, fT, fK  (다리: 허벅지·무릎 각도), nS, nE, fS, fE (팔: 어깨·팔꿈치), pick: 곡괭이 각도 or None, head, blink)
def draw(Pz, layer):
    c = Cv()
    bob = Pz.get("bob", 0); lean = Pz.get("lean", 0)
    hip = (31 + lean * 0.3, 41 + bob)                              # 발이 y 57 근처 (칸 아래 끝에 닿지 않게)
    neck = (32 + lean, 28 + bob)
    shN = (34 + lean, 30 + bob); shF = (30 + lean, 30 + bob)
    UL, LL, UA, LA = 8.0, 8.0, 7.0, 6.5
    def leg(side, T, K):
        h = (hip[0] + (1.5 if side == "n" else -1.5), hip[1])
        knee = pt(h, T, UL); foot = pt(knee, T - K, LL)
        dark = -1 if side == "f" else 0
        c.put("pants", capsule(h, knee, 3.4) | capsule(knee, foot, 3.0), cyl_shade(h, foot, 3 + dark))
        # 장화: 발목에서 앞쪽으로
        fwd = math.radians(T - K + 90); bx, by = foot[0] + math.sin(fwd) * 3, foot[1] + math.cos(fwd) * 0.5
        boot = capsule((foot[0] - 1, foot[1]), (bx + 1.5, by + 0.5), 3.0) | ell(foot[0], foot[1] - 1, 3.2, 3.0)
        c.put("boot", boot, ball_shade(foot[0], foot[1], 4, 3 + dark))
        return foot
    def arm(side, S, E, base):
        sh = shN if side == "n" else shF
        el = pt(sh, S, UA); hand = pt(el, S + E, LA)
        dark = -1 if side == "f" else 0
        c.put("jacket", capsule(sh, el, 3.2), cyl_shade(sh, el, base + dark))
        c.put("jacket", capsule(el, hand, 2.8), cyl_shade(el, hand, base + dark))
        c.put("glove", ell(hand[0], hand[1], 2.8, 2.8), ball_shade(hand[0], hand[1], 2.8, 3 + dark))
        return hand
    if layer == "pack":                                            # 백팩 로켓 (등 뒤) — 몸 뒤에 그려짐
        bx, by = neck[0] - 9, neck[1] + 3
        c.put("rocket", capsule((bx, by), (bx, by + 11), 3.6), cyl_shade((bx, by), (bx, by + 11), 3.0))
        c.put("rocket", capsule((bx - 4.2, by + 1), (bx - 4.2, by + 10), 2.6), cyl_shade((bx, by), (bx, by + 11), 2.6))
        c.put("steel", capsule((bx - 2, by + 12), (bx - 2, by + 14.5), 2.6), 2.4)              # 분사구
        c.put("steel", capsule((bx + 1, by + 2), (bx + 6, by + 3), 1.3), 3.0)                 # 멜빵
        return c.render()
    # 뒤쪽 팔·다리 (어둡게)
    fF = leg("f", Pz["fT"], Pz["fK"])
    handF = arm("f", Pz["fS"], Pz["fE"], 3.0)
    # 몸통: 작업복 + 반사띠 + 셔츠 깃
    torso = poly([(neck[0] - 6, neck[1] + 1), (neck[0] + 6, neck[1] + 1), (hip[0] + 6.5, hip[1] + 1), (hip[0] - 6.5, hip[1] + 1)]) | ell(neck[0], neck[1] + 3, 7, 4)
    c.put("jacket", torso, 3 + np.where(XX < neck[0] - 3, 1, 0) - np.where(YY > hip[1] - 2, 1, 0))
    c.put("band", torso & (np.abs(YY - (hip[1] - 6)) < 1.3), 3 + np.where(XX < neck[0], 1, 0))
    c.put("shirt", poly([(neck[0] - 2.5, neck[1]), (neck[0] + 3, neck[1]), (neck[0] + 1, neck[1] + 6)]), 3)
    c.put("glove", (np.abs(YY - (hip[1] - 1)) < 1.4) & torso, 2.6)                           # 허리띠
    fN = leg("n", Pz["nT"], Pz["nK"])
    # 머리 (큰 꼬마 머리) + 머리카락 + 안전모 + 램프
    hcx, hcy = neck[0] + 1 + Pz.get("head", 0), neck[1] - 10
    head = ell(hcx, hcy, 10.5, 10)
    c.put("skin", head, ball_shade(hcx, hcy, 10, 3.0))
    hair = (head & ((XX < hcx - 3.5) | (YY < hcy - 2))) | ell(hcx - 8, hcy + 2, 3.5, 5.5) | (ell(hcx - 3, hcy + 5.5, 7, 3) & (XX < hcx - 4))
    c.put("hair", hair & ~ell(hcx + 2, hcy + 4, 7.5, 6), 3 + np.where(YY < hcy - 2, 1, 0))
    for (sx, sy) in ((hcx - 9, hcy + 6), (hcx - 6, hcy + 8)):                                  # 삐친 머리
        c.put("hair", poly([(sx, sy - 3), (sx + 2.5, sy - 2), (sx - 1, sy + 3)]), 3)
    ex, ey = hcx + 4.5, hcy + 1.5
    if Pz.get("blink"): c.put("eye", (np.abs(YY - ey - 0.5) < 0.7) & (np.abs(XX - ex) < 2.2), 1)
    else:
        c.put("eye", ell(ex, ey, 2.4, 3.2), 2)                     # 큰 눈 (참고 그림처럼)
        c.put("eye", ell(ex + 0.3, ey + 0.9, 1.4, 1.6), 4)
        c.put("eye", ell(ex - 0.7, ey - 1.3, 0.9, 0.9), 5)
    c.put("skin", ell(hcx + 9.6, hcy + 4.5, 1.6, 1.4), 2)                                      # 코끝
    c.put("hair", (np.abs(YY - (ey - 4.2)) < 0.7) & (XX > ex - 2.5) & (XX < ex + 2.5), 2)       # 눈썹
    c.put("shirt", (np.abs(YY - (hcy + 7.6)) < 0.6) & (XX > hcx + 4) & (XX < hcx + 7.5), 3)    # 입
    hat = (ell(hcx, hcy - 2, 11.5, 10) & (YY < hcy - 2.5))
    c.put("hat", hat, ball_shade(hcx, hcy - 6, 10, 3.0))
    c.put("hat", ell(hcx + 1, hcy - 2.5, 14, 2.2) & (XX < hcx + 14), 3 - np.where(YY > hcy - 2.5, 1, 0))   # 챙
    c.put("hat", (np.abs(XX - hcx) < 1.2) & hat & (YY < hcy - 4), 4)                        # 가운데 골
    c.put("steel", ell(hcx + 9.5, hcy - 6, 3.2, 3.2) & ~ell(hcx + 11, hcy - 6, 1.5, 2.2), 3)
    c.put("lampg", ell(hcx + 10.6, hcy - 6, 1.9, 2.4), 4)                                     # 이마 램프
    # 앞쪽 팔 + 곡괭이
    handN = arm("n", Pz["nS"], Pz["nE"], 3.0)
    img = c.render()
    if layer == "pick":
        pc = Cv()
        if Pz.get("pick") is not None:
            a = math.radians(Pz["pick"]); hx_, hy_ = handN
            dx, dy = math.sin(a), -math.cos(a)                     # 자루 방향 (손 → 머리)
            top = (hx_ + dx * 12, hy_ + dy * 12); bot = (hx_ - dx * 3, hy_ - dy * 3)
            pc.put("wood", capsule(bot, top, 1.4), cyl_shade(bot, top, 3.0))
            # 곡괭이 머리: 자루 끝에 수직으로 휜 날 (앞쪽이 뾰족)
            px_, py_ = -dy, dx
            blade = poly([(top[0] - px_ * 7 - dx * 0.5, top[1] - py_ * 7 - dy * 0.5), (top[0] - px_ * 2 + dx * 2.6, top[1] - py_ * 2 + dy * 2.6),
                          (top[0] + px_ * 2 + dx * 2.6, top[1] + py_ * 2 + dy * 2.6), (top[0] + px_ * 9 - dx * 2.5, top[1] + py_ * 9 - dy * 2.5),
                          (top[0] + px_ * 2 - dx * 1.6, top[1] + py_ * 2 - dy * 1.6), (top[0] - px_ * 2 - dx * 1.6, top[1] - py_ * 2 - dy * 1.6)])
            pc.put("metal", blade, 3 + np.where((XX - top[0]) * -0.6 + (YY - top[1]) * -0.8 > 0.6, 1, 0))
        return pc.render()
    return img

# ---- 애니메이션 (sprites.ts 의 PLAYER_ANIM 과 같은 순서) ----
BASE = dict(bob=0, lean=0, nT=4, nK=0, fT=-4, fK=0, nS=10, nE=-10, fS=-8, fE=-12, pick=-20)
def anims():
    A = []
    # 0 idle (4): 숨쉬기 + 3번째에 눈 깜빡
    A.append(("idle", [dict(BASE, bob=b, nS=10 + s, fS=-8 - s, blink=(i == 2)) for i, (b, s) in enumerate(((0, 0), (1, 2), (1, 2), (0, 0)))]))
    # 1 run (8): 다리 · 팔 반대로, 몸 앞으로 기울고 위아래로
    run = []
    for i in range(8):
        ph = 2 * math.pi * i / 8; s = math.sin(ph)
        run.append(dict(BASE, lean=3, bob=-round(abs(math.cos(ph)) * 2),
                        nT=34 * s, nK=max(0, 50 * math.sin(ph + 1.4)), fT=-34 * s, fK=max(0, 50 * math.sin(ph + 1.4 + math.pi)),
                        nS=-40 * s + 10, nE=60, fS=40 * s + 10, fE=60, pick=-60 - 30 * s))
    A.append(("run", run))
    # 2 jump (3): 웅크려 오름 · 꼭대기 · 다리 펴고 떨어짐
    A.append(("jump", [dict(BASE, bob=-1, nT=40, nK=80, fT=10, fK=70, nS=150, nE=10, fS=120, fE=20, pick=150),
                       dict(BASE, bob=-1, nT=30, nK=60, fT=-10, fK=40, nS=110, nE=30, fS=90, fE=30, pick=100),
                       dict(BASE, bob=0, nT=12, nK=10, fT=-14, fK=6, nS=70, nE=20, fS=60, fE=10, pick=60)]))
    # 3 climb (4): 사다리 잡고 팔·다리 번갈아 (옆모습)
    cl = []
    for i in range(4):
        up = i in (0, 1)
        cl.append(dict(BASE, lean=2, bob=(-1 if i % 2 else 0), nT=(40 if up else 10), nK=(70 if up else 20), fT=(10 if up else 40), fK=(20 if up else 70),
                       nS=(170 if up else 120), nE=(-20 if up else -40), fS=(120 if up else 170), fE=(-40 if up else -20), pick=None))
    A.append(("climb", cl))
    # 4 mine_side (4): 들어 올림 → 내려침 → 박힘 → 돌아옴
    A.append(("mine_side", [dict(BASE, lean=-2, nT=14, nK=8, fT=-10, fK=4, nS=190, nE=-30, fS=170, fE=-20, pick=200),
                            dict(BASE, lean=1, nT=16, nK=10, fT=-12, fK=6, nS=130, nE=-10, fS=120, fE=-10, pick=130),
                            dict(BASE, lean=4, bob=1, nT=18, nK=14, fT=-14, fK=8, nS=80, nE=0, fS=70, fE=0, pick=88),
                            dict(BASE, lean=2, nT=16, nK=10, fT=-12, fK=6, nS=110, nE=-10, fS=100, fE=-10, pick=115)]))
    # 5 mine_down (4): 발밑을 내려찍음
    A.append(("mine_down", [dict(BASE, lean=-2, nT=10, nK=6, fT=-10, fK=4, nS=180, nE=-30, fS=165, fE=-20, pick=195),
                            dict(BASE, lean=2, nT=14, nK=12, fT=-12, fK=8, nS=110, nE=-10, fS=100, fE=-10, pick=110),
                            dict(BASE, lean=5, bob=2, nT=22, nK=30, fT=-6, fK=24, nS=40, nE=10, fS=30, fE=10, pick=30),
                            dict(BASE, lean=3, bob=1, nT=16, nK=16, fT=-10, fK=10, nS=80, nE=0, fS=70, fE=0, pick=70)]))
    # 6 mine_up (4): 머리 위를 찍음
    A.append(("mine_up", [dict(BASE, lean=-1, nT=6, nK=0, fT=-6, fK=0, nS=100, nE=20, fS=90, fE=20, pick=60),
                          dict(BASE, lean=0, nT=6, nK=0, fT=-6, fK=0, nS=150, nE=10, fS=140, fE=10, pick=150),
                          dict(BASE, lean=0, bob=-1, nT=4, nK=0, fT=-4, fK=0, nS=175, nE=0, fS=165, fE=0, pick=178),
                          dict(BASE, lean=0, nT=6, nK=0, fT=-6, fK=0, nS=140, nE=10, fS=130, fE=10, pick=140)]))
    # 7 fly (2): 백팩 로켓으로 날 때 — 다리는 늘어뜨리고 살짝 흔들림
    A.append(("fly", [dict(BASE, lean=3, nT=14, nK=20, fT=0, fK=26, nS=40, nE=30, fS=30, fE=30, pick=10),
                      dict(BASE, lean=3, bob=-1, nT=18, nK=24, fT=4, fK=30, nS=46, nE=30, fS=36, fE=30, pick=16)]))
    return A

def sheet(layer):
    A = anims(); cols = max(len(f) for _, f in A)
    out = np.zeros((N * len(A), N * cols, 4), np.uint8)
    for r, (_, frames) in enumerate(A):
        for i, Pz in enumerate(frames):
            out[r * N:(r + 1) * N, i * N:(i + 1) * N] = draw(Pz, layer)
    return out

# ---- 사다리 칸 (tiles/ladder.png): 맵 스타일 A 처럼 32px 도트 ×2, 굵은 외곽선 · 나무 3단 ----
def ladder_tile():
    n = 32; img = np.zeros((n, n, 4), np.uint8)
    OL, W0, W1, W2, W3 = (hx("#1a0f0a"), hx("#5e3418"), hx("#8a5428"), hx("#b07a44"), hx("#d8a868"))
    def box(x0, y0, x1, y1, col):
        img[y0:y1, x0:x1, :3] = col; img[y0:y1, x0:x1, 3] = 255
    for y in (3, 11, 19, 27):                                       # 가로 발판 (레일 사이)
        box(8, y - 1, 24, y + 3, OL); box(8, y, 24, y + 2, W2); box(8, y, 24, y + 1, W3); box(8, y + 1, 24, y + 2, W1)
    for x in (5, 23):                                               # 세로 레일 (위아래 칸과 이어지게 끝까지)
        box(x - 1, 0, x + 5, n, OL); box(x, 0, x + 4, n, W1); box(x, 0, x + 1, n, W2); box(x + 1, 0, x + 2, n, W3); box(x + 3, 0, x + 4, n, W0)
        for y in (3, 11, 19, 27): box(x + 1, y, x + 3, y + 2, hx("#2a1a10")); img[y, x + 1, :3] = hx("#9aa3b8")   # 못
    return np.kron(img, np.ones((2, 2, 1), np.uint8))

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(ladder_tile(), "RGBA").save(os.path.join(ROOT, "public/assets/tiles/ladder.png"))
    for layer in ("body", "pick", "pack"):
        Image.fromarray(sheet(layer), "RGBA").save(os.path.join(OUT, layer + ".png"))
    print("광부 시트 저장:", [(n, len(f)) for n, f in anims()])
