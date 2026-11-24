#!/usr/bin/env python3
# 사람 광부 · 로봇 그림 만들기 (PixelLab 에서 뽑은 원본 → 게임용 시트)
#   python3 tools/make-player.py [원본 폴더]   (기본: tools/ref/pixellab)
#   원본 폴더에 있어야 하는 것 (모두 배경 투명, 같은 배율):
#     east.png · west.png        서 있는 광부 (오른쪽 · 왼쪽)
#     walk_east.gif              오른쪽으로 걷기 (프레임 여러 장, 칸 크기는 달라도 됨)
#     robot_se.png · robot_sw.png 로봇 서 있기 (오른쪽 · 왼쪽 비스듬히)
#     robot_walk_se.gif · robot_jump_se.gif · robot_dig_se.gif  로봇 걷기 · 점프(백팩 로켓 점화 → 착지) · 캐기(오른팔 톱니바퀴). 왼쪽은 뒤집어 씀
#     [있으면] robot_dig_down_se.gif · robot_dig_up_se.gif  아래 · 위 캐기 (9장으로 맞춤. 없으면 임시 칸)
#     [있으면] <동작>_east.gif    jump · climb · mine 등 — ANIMS 표에 줄을 더하면 시트에 들어감
#   → public/assets/player/body.png  80x80 칸. 줄 0 = 오른쪽, 줄 1 = 왼쪽(걷기는 좌우 뒤집음)
#                                     칸 0 서 있기, 칸 1~8 걷기, 칸 9~17 곡괭이질(mine_east.gif) (sprites.ts 의 PLAYER_ANIM 과 짝)
#     public/assets/player/pick.png  손에 드는 곡괭이 1장 (자루가 위, 손잡이 (16, 29))
#     public/assets/player/pack.png  백팩 로켓 1장 (예전 그림용, 지금 광부는 자기 배낭이 있어 안 씀)
#     public/assets/mech/body.png    104x104 칸. 줄 0 오른쪽 · 줄 1 왼쪽, 칸 0 서 있기 · 1~8 걷기 · 9~17 점프 · 18~26 옆 캐기 · 27~35 아래 캐기 · 36~44 위 캐기 (sprites.ts 의 MECH_ANIM 과 짝)
#                                     발바닥 y 96, 몸 가운데 x 52 (sprites.ts 의 MCX · MFT)
#     public/assets/tiles/ladder.png 사다리 칸
#   모든 칸은 발바닥 y 68, 모자 가운데 x 40 에 맞춤 (draw.ts 의 PFT · PCX)
import os, sys, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageSequence
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/player")
F, FOOT, CX = 80, 68, 40          # 칸 크기 · 발바닥(이 줄부터 땅) · 모자 가운데
def hx(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)

def frames_of(path):
    im = Image.open(path)
    return [f.convert("RGBA") for f in ImageSequence.Iterator(im)] if getattr(im, "n_frames", 1) > 1 else [im.convert("RGBA")]

# 한 장을 80 칸에 놓을 자리: 발 = 맨 아래 불투명 줄, 가로 = 위쪽 25%(모자) 가운데
def anchor(img):
    a = np.array(img)[..., 3] > 0
    ys, xs = np.nonzero(a)
    top = ys.min(); band = a[top:top + max(4, (ys.max() - top) // 4)]
    by, bx = np.nonzero(band)
    return int(round(bx.mean())), ys.max() + 1

# 로봇 시트: 몸통(위 45%) 가운데 · 발바닥으로 맞춤. GIF 는 첫 장 기준 한 번만 맞춰 원본의 들썩임을 살림
MF, MFOOT, MCX = 104, 96, 52
def anchor_mech(img):
    a = np.array(img)[..., 3] > 0
    ys, xs = np.nonzero(a)
    top = ys.min(); band = a[top:top + int((ys.max() - top) * 0.45)]
    by, bx = np.nonzero(band)
    return int(round(bx.mean())), ys.max() + 1
def mech_sheet(src):
    se = frames_of(os.path.join(src, "robot_se.png"))[0]
    sw = frames_of(os.path.join(src, "robot_sw.png"))[0]
    anims = [frames_of(os.path.join(src, n)) for n in ("robot_walk_se.gif", "robot_jump_se.gif", "robot_dig_se.gif")]
    # 아래·위 캐기: 원본이 있으면 9장으로 맞춰 넣고, 없으면 임시 그림(아래 = 몸 낮춘 점프 칸, 위 = 서 있기)을 9칸 채움 → 칸 번호가 늘 같게
    for n, fallback in (("robot_dig_down_se.gif", anims[1][1]), ("robot_dig_up_se.gif", se)):
        p = os.path.join(src, n)
        fr = frames_of(p) if os.path.exists(p) else [fallback] * 9
        anims.append([fr[min(len(fr) - 1, round(i * (len(fr) - 1) / 8))] for i in range(9)])
    cols = 1 + sum(len(a) for a in anims)
    out = Image.new("RGBA", (MF * cols, MF * 2))
    def put(img, c, r, ax, ay): out.alpha_composite(img, (c * MF + MCX - ax, r * MF + MFOOT - ay))
    ax, ay = anchor_mech(se); put(se, 0, 0, ax, ay)
    ax, ay = anchor_mech(sw); put(sw, 0, 1, ax, ay)
    c = 1
    for fr in anims:
        ax, ay = anchor_mech(fr[0])
        for f in fr:
            put(f, c, 0, ax, ay); put(ImageOps.mirror(f), c, 1, f.width - 1 - ax, ay); c += 1
    return out

# 걷기 뒤에 이어 붙이는 동작 (원본이 있을 때만, 순서대로 칸 번호가 이어짐 → sprites.ts 의 PLAYER_ANIM 과 짝)
#   mine_east.gif: 곡괭이로 앞 블록 두들기기 9장 → 칸 9~17
ANIMS = ["mine_east.gif"]

def main_only(img):
    """몸에서 떨어진 작은 조각(불꽃·티끌 효과)은 지움 — 부스러기는 게임이 따로 그림"""
    a = np.array(img); al = a[..., 3] > 0
    lab, n = nd.label(al, structure=np.ones((3, 3)))
    if n > 1:
        big = max(range(1, n + 1), key=lambda k: (lab == k).sum())
        a[(lab != big) & al] = 0
    return Image.fromarray(a, "RGBA")

def body_sheet(src):
    east = frames_of(os.path.join(src, "east.png"))[0]
    west = frames_of(os.path.join(src, "west.png"))[0]
    walk = frames_of(os.path.join(src, "walk_east.gif"))
    extra = [[main_only(f) for f in frames_of(os.path.join(src, n))] for n in ANIMS if os.path.exists(os.path.join(src, n))]
    cols = 1 + len(walk) + sum(len(a) for a in extra)
    out = Image.new("RGBA", (F * cols, F * 2))
    def put(img, c, r, ax=None, ay=None):
        if ax is None: ax, ay = anchor(img)
        out.alpha_composite(img, (c * F + CX - ax, r * F + FOOT - ay))
    put(east, 0, 0); put(west, 0, 1)
    c = 1
    # 동작 프레임은 원본끼리의 흔들림을 살리려고 동작마다 첫 장 기준 한 번만 맞춤
    for fr in [walk] + extra:
        wx, wy = anchor(fr[0])
        for f in fr:
            put(f, c, 0, wx, wy)
            m = ImageOps.mirror(f); put(m, c, 1, f.width - 1 - wx, wy)
            c += 1
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
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tools/ref/pixellab")
    body_sheet(src).save(os.path.join(OUT, "body.png"))
    pick().save(os.path.join(OUT, "pick.png"))
    pack().save(os.path.join(OUT, "pack.png"))
    os.makedirs(os.path.join(ROOT, "public/assets/mech"), exist_ok=True)
    mech_sheet(src).save(os.path.join(ROOT, "public/assets/mech/body.png"))
    Image.fromarray(ladder_tile(), "RGBA").save(os.path.join(ROOT, "public/assets/tiles/ladder.png"))
    print("player: body (80칸, 줄 0 오른쪽 · 1 왼쪽) · pick · pack · mech body (104칸) · ladder")
