#!/usr/bin/env python3
# 사람 광부 그림 만들기
#   python3 tools/make-player.py [참고 시트]   (기본: tools/ref/player_sheet.png)
#   → public/assets/player/body.png  참고 시트(5칸 × 4줄: 서기·걷기·달리기·점프)를 잘라 80x80 칸으로 줄임
#     public/assets/player/pick.png  곡괭이 1장 (자루가 위를 봄, 손잡이 = (16, 29)). 날은 회색 → 게임이 곡괭이 단계 색으로 칠함
#     public/assets/player/pack.png  백팩 로켓 1장
#     public/assets/tiles/ladder.png 사다리 칸 (맵 스타일 A: 32px 도트 ×2)
#   칸 배치·손 위치는 sprites.ts 의 PLAYER_ANIM · PGRIP 과 짝. 몸 가운데 x 40 · 발바닥 y 76 (draw.ts 의 PCX·PFT)
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/player")
F, FOOT, CX = 80, 76, 40          # 칸 크기 · 발바닥 · 몸 가운데
HEIGHT = 60                       # 게임 속 키(px). 칸(64) 보다 조금 작게
def hx(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)

# ---- 참고 시트 자르기: 바둑판(가짜 투명) 배경을 가장자리부터 지우고 캐릭터 20개를 찾음 ----
def body_sheet(path):
    src = np.array(Image.open(path).convert("RGB")).astype(int)
    mx, mn = src.max(2), src.min(2)
    cand = ((mx - mn) < 28) & (mx > 105)                          # 무채색 밝은 칸 = 배경 후보 (외곽선은 아주 어두워서 막힘)
    lab, _ = nd.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = nd.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    lab, _ = nd.label(fg)
    objs = [(i + 1, s) for i, s in enumerate(nd.find_objects(lab)) if (lab[s] == i + 1).sum() > fg.size * 0.0008]
    assert len(objs) == 20, "캐릭터 20개를 찾지 못함: %d" % len(objs)
    objs.sort(key=lambda t: t[1][0].stop)
    rows = [sorted(objs[k * 5:(k + 1) * 5], key=lambda t: t[1][1].start) for k in range(4)]
    sc = HEIGHT / np.median([s[0].stop - s[0].start for _, s in objs[:10]])   # 서기·걷기 키로 배율
    out = Image.new("RGBA", (F * 5, F * 4))
    for r, row in enumerate(rows):
        for c, (li, s) in enumerate(row):
            y0, y1, x0, x1 = s[0].start - 2, s[0].stop + 2, s[1].start - 2, s[1].stop + 2
            a = (lab[y0:y1, x0:x1] == li).astype(float)
            pm = np.dstack([src[y0:y1, x0:x1] * a[..., None], a * 255])
            h, w = a.shape; th, tw = round(h * sc), round(w * sc)
            sm = np.array(Image.fromarray(pm.clip(0, 255).astype(np.uint8), "RGBA").resize((tw, th), Image.BOX)).astype(float)
            al = sm[..., 3] / 255
            rgb = np.where(al[..., None] > 0, sm[..., :3] / np.maximum(al[..., None], 1e-3), 0)
            A = al > 0.45
            lab2, n2 = nd.label(A)                                  # 속도선 부스러기 지우기 (몸통에 안 붙은 작은 점)
            if n2 > 1:
                sz = nd.sum(A, lab2, range(1, n2 + 1)); A = lab2 == (1 + int(np.argmax(sz)))
            fr = np.dstack([rgb.clip(0, 255).astype(np.uint8), (A * 255).astype(np.uint8)])
            ys, xs = np.nonzero(A)
            yy, xx = np.nonzero(A[:int(th * 0.45)])                 # 가로 기준 = 머리 가운데
            out.alpha_composite(Image.fromarray(fr, "RGBA"), (c * F + CX - int(round(xx.mean())), r * F + FOOT - (ys.max() + 1)))
    return out

# ---- 외곽선 붙이기 (1px, 4방향) ----
def outlined(img, col="#120c18"):
    a = np.array(img); al = a[..., 3] > 0
    ring = nd.binary_dilation(al) & ~al
    a[ring, :3] = hx(col); a[ring, 3] = 255
    return Image.fromarray(a, "RGBA")

# ---- 곡괭이: 손잡이 (16, 29), 자루가 위로, 날은 회색 5단(밝기로 단계 색을 입힘) ----
def pick():
    im = Image.new("RGBA", (32, 32)); d = ImageDraw.Draw(im)
    d.rectangle([15, 7, 16, 30], fill="#8a5428"); d.line([(15, 7), (15, 30)], fill="#b07a44")   # 나무 자루
    d.rectangle([15, 26, 16, 30], fill="#5e3418")                                           # 손잡이 감은 끈
    head = [(3, 12), (6, 8), (11, 5), (16, 4), (21, 5), (26, 8), (29, 12), (25, 10), (20, 8), (16, 8), (12, 8), (7, 10)]
    d.polygon(head, fill=(150, 150, 150))
    d.line([(6, 8), (11, 5), (16, 4), (21, 5), (26, 8)], fill=(214, 214, 214))              # 날 윗면 빛
    d.line([(7, 10), (12, 8), (20, 8), (25, 10)], fill=(90, 90, 90))                        # 날 아랫면 그늘
    d.rectangle([14, 4, 17, 9], fill=(120, 120, 120)); d.point([(14, 5), (15, 5)], fill=(240, 240, 240))   # 자루 끼우는 쇠
    for p in ((3, 12), (29, 12)): d.point(p, fill=(250, 250, 250))                          # 날 끝 반짝
    return outlined(im)

# ---- 백팩 로켓: 붉은 통 두 개 + 쇠 띠, 아래가 분사구 ----
def pack():
    im = Image.new("RGBA", (20, 24)); d = ImageDraw.Draw(im)
    for x in (2, 10):
        d.rounded_rectangle([x, 2, x + 7, 18], 3, fill="#c8323a")
        d.line([(x + 1, 4), (x + 1, 16)], fill="#ff7a6a"); d.line([(x + 6, 4), (x + 6, 16)], fill="#7a1420")
        d.rectangle([x + 1, 18, x + 6, 21], fill="#545b68"); d.line([(x + 2, 19), (x + 5, 19)], fill="#a9b0bc")
    d.rectangle([1, 8, 18, 10], fill="#a9b0bc"); d.line([(1, 8), (18, 8)], fill="#e4e8ee")
    return outlined(im)

# ---- 사다리 칸 (tiles/ladder.png): 32px 도트 ×2, 굵은 외곽선 · 나무 3단 ----
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
    ref = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tools/ref/player_sheet.png")
    body_sheet(ref).save(os.path.join(OUT, "body.png"))
    pick().save(os.path.join(OUT, "pick.png"))
    pack().save(os.path.join(OUT, "pack.png"))
    Image.fromarray(ladder_tile(), "RGBA").save(os.path.join(ROOT, "public/assets/tiles/ladder.png"))
    print("player: body 400x320 (80칸 5x4) · pick 32 · pack 20x24 · ladder")
