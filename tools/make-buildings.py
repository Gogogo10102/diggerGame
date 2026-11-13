#!/usr/bin/env python3
# 마을 건물 도트 그림 만들기 → public/assets/buildings/{item_shop,workshop,furnace}.png
#
# 건물은 이 스크립트로 처음 그렸고, 이후에는 PNG를 도트 편집기(Aseprite 등)로 직접 고쳐도 됩니다.
#   실행: python3 tools/make-buildings.py   (Python 3 + Pillow)
# 규칙
#   - 그림 1픽셀 = 게임 화면 2픽셀 (16px 타일과 같은 배율). 그림 아래 끝 = 땅 표면
#   - 빛은 왼쪽 위에서. 색은 단계(램프)로만 칠하고, 바깥 테두리만 진한 색
#   - 이름 글자는 넣지 않고 로고(아이콘 배지)만
#   - 불빛·연기처럼 움직이는 부분은 게임 코드가 그 위에 그림 (위치는 src/game/art/buildings.ts 의 BLD_FX)
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/assets/buildings")
ICON_DIR = os.path.join(ROOT, "public/assets/ui/icon")

# ---------------------------------------------------------------------
#  색 램프 (어두움 → 밝음)
# ---------------------------------------------------------------------
INK = "#17121c"
WOOD = ["#2e1c14", "#4a2e1f", "#6b4229", "#8c5a36", "#b07a4a", "#d5a46c", "#efcf9a"]
BLUE = ["#121b33", "#1d2c52", "#2a4479", "#3a61a6", "#5784cc", "#86b0e8", "#c2dcfa"]
STONE = ["#1f2029", "#33353f", "#4a4d5a", "#646876", "#828797", "#a3a8b6", "#c9cdd7"]
BRICK = ["#2f120e", "#4d1d15", "#6e2c1e", "#93402a", "#b65a3b", "#d47d58", "#ebac88"]
GREEN = ["#10231b", "#1a3a2b", "#26553c", "#347450", "#4a9668", "#74bd8a", "#b3e3bb"]
IRON = ["#16171d", "#272a33", "#3b3f4b", "#555a68", "#767c8c", "#9fa5b4", "#d2d6df"]
FIRE = ["#4a1406", "#8a2a0a", "#cc4a12", "#f07a1e", "#ffae3a", "#ffd866", "#fff6c4"]
GOLD = ["#3e2806", "#6e4810", "#a8721c", "#d8a12e", "#f5cc52", "#fff0a0"]
GLASS = ["#14202e", "#1f3346", "#2d4c66", "#456f8e", "#6f9cb8", "#b5dcea"]
CREAM = ["#7d6d55", "#a8987a", "#cbbd9c", "#e6dbbf", "#f7f0dc"]
LEAF = ["#163018", "#24502a", "#357a3a", "#4fa64d", "#86d27a"]


def rgba(c, a=255):
    if isinstance(c, tuple):
        return c if len(c) == 4 else c + (a,)
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


class Px:
    """아주 작은 도트 그리기 도구 (안티앨리어싱 없음)"""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        s.px = s.im.load()

    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None:
            s.px[x, y] = rgba(c)

    def get(s, x, y):
        return s.px[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)

    def rect(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.p(xx, yy, c)

    def hl(s, x, y, w, c): s.rect(x, y, w, 1, c)
    def vl(s, x, y, h, c): s.rect(x, y, 1, h, c)

    def box(s, x, y, w, h, fill, edge=INK):
        s.rect(x, y, w, h, edge)
        s.rect(x + 1, y + 1, w - 2, h - 2, fill)

    def poly(s, pts, c):
        d = ImageDraw.Draw(s.im)
        d.polygon(pts, fill=rgba(c))

    def ellipse(s, x0, y0, x1, y1, c):
        ImageDraw.Draw(s.im).ellipse([x0, y0, x1, y1], fill=rgba(c))

    def dither(s, x, y, w, h, c, phase=0):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if (xx + yy + phase) % 2 == 0:
                    s.p(xx, yy, c)

    def blend(s, x, y, w, h, c, a):
        """반투명 색을 덮음 (그림자/빛 번짐)"""
        cr = rgba(c)
        for yy in range(max(0, y), min(s.h, y + h)):
            for xx in range(max(0, x), min(s.w, x + w)):
                o = s.px[xx, yy]
                if o[3] == 0:
                    continue
                s.px[xx, yy] = tuple(int(o[i] * (1 - a) + cr[i] * a) for i in range(3)) + (o[3],)

    def paste(s, img, x, y):
        s.im.alpha_composite(img, (x, y))
        s.px = s.im.load()

    def outline(s, c=INK):
        """바깥 실루엣에만 1px 테두리"""
        src = s.im.copy().load()
        for y in range(s.h):
            for x in range(s.w):
                if src[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < s.w and 0 <= yy < s.h and src[xx, yy][3] > 0:
                        s.px[x, y] = rgba(c)
                        break


def icon(name, dim=1.0):
    im = Image.open(os.path.join(ICON_DIR, name + ".png")).convert("RGBA")
    im = im.crop(im.getbbox())
    if dim != 1.0:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                px[x, y] = (int(r * dim), int(g * dim), int(b * dim), a)
    return im


# ---------------------------------------------------------------------
#  공용 부품
# ---------------------------------------------------------------------
def badge_round(c, cx, cy, r, rim, face, icon_img):
    """둥근 로고 배지: 금테 + 바탕 + 아이콘 (이름 대신)"""
    c.ellipse(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, INK)
    c.ellipse(cx - r, cy - r, cx + r, cy + r, rim[2])
    c.ellipse(cx - r, cy - r, cx + r - 1, cy + r - 1, rim[3])          # 왼쪽 위 밝게
    c.ellipse(cx - r + 1, cy - r + 1, cx + r - 1, cy + r - 1, rim[2])
    c.ellipse(cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2, INK)
    c.ellipse(cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3, face[1])
    c.ellipse(cx - r + 3, cy - r + 3, cx + r - 4, cy + r - 4, face[2])
    for a in range(-1, 2):                                              # 테의 반짝이
        c.p(cx - r + 2 + a, cy - r + 4 - a, rim[5])
    c.paste(icon_img, cx - icon_img.width // 2, cy - icon_img.height // 2)


def lantern(c, x, y):
    """벽 등불 (7x10). 주변 빛 번짐은 따로"""
    c.rect(x + 3, y, 1, 2, IRON[1])
    c.box(x + 1, y + 2, 5, 1, IRON[2])
    c.rect(x + 1, y + 3, 5, 5, INK)
    c.rect(x + 2, y + 4, 3, 3, FIRE[5]); c.p(x + 3, y + 5, FIRE[6]); c.p(x + 2, y + 4, FIRE[6])
    c.rect(x, y + 8, 7, 1, INK); c.rect(x + 1, y + 8, 5, 1, IRON[3])


def glow(c, cx, cy, r, col=FIRE[4], a=0.18):
    for yy in range(cy - r, cy + r + 1):
        for xx in range(cx - r, cx + r + 1):
            d = ((xx - cx) ** 2 + (yy - cy) ** 2) ** 0.5
            if d <= r and (xx + yy) % 2 == 0:
                c.blend(xx, yy, 1, 1, col, a * (1 - d / (r + 1)) * 2)


def stone_base(c, x, y, w, h):
    """돌 기단: 엇갈린 돌덩이 + 윗면 밝게"""
    c.rect(x, y, w, h, STONE[1])
    row = 0
    yy = y
    while yy < y + h:
        bh = min(4, y + h - yy)
        xx = x - (4 if row % 2 else 0)
        k = 0
        while xx < x + w:
            bw = 9 if (k + row) % 3 else 7
            x0, x1 = max(x, xx), min(x + w, xx + bw - 1)
            if x1 > x0:
                shade = STONE[3] if (k * 7 + row * 3) % 4 else STONE[4]
                c.rect(x0, yy, x1 - x0, bh - 1, shade)
                c.hl(x0, yy, x1 - x0, STONE[5])
                c.p(x1 - 1, yy + bh - 2, STONE[2])
            xx += bw
            k += 1
        yy += 4
        row += 1
    c.hl(x, y, w, STONE[6])


def bricks(c, x, y, w, h, ramp, light_left=True, seed=0):
    """벽돌 벽: 4px 줄, 엇갈림, 왼쪽이 조금 밝음"""
    c.rect(x, y, w, h, ramp[1])
    for i, yy in enumerate(range(y, y + h, 4)):
        off = (i % 2) * 4
        for j, xx in enumerate(range(x - off, x + w, 8)):
            x0, x1 = max(x, xx), min(x + w, xx + 7)
            if x1 <= x0:
                continue
            t = (x0 - x) / max(1, w)
            base = ramp[4] if (light_left and t < 0.35) else ramp[3]
            if (i * 5 + j * 3 + seed) % 7 == 0:
                base = ramp[2]
            hh = min(3, y + h - yy)
            c.rect(x0, yy, x1 - x0, hh, base)
            c.hl(x0, yy, x1 - x0, ramp[5] if base != ramp[2] else ramp[3])


def planks_v(c, x, y, w, h, ramp, pw=4, seed=0):
    """세로 나무판: 판마다 색 조금씩 다르게 + 결 + 못"""
    for i, xx in enumerate(range(x, x + w, pw)):
        ww = min(pw, x + w - xx)
        k = (i * 7 + seed) % 5
        base = [ramp[3], ramp[4], ramp[3], ramp[4], ramp[3]][k]
        c.rect(xx, y, ww, h, base)
        c.vl(xx, y, h, ramp[2])                                      # 판 사이 틈
        if ww > 2:
            c.vl(xx + 1, y, h, ramp[5] if k % 2 else ramp[4])        # 판 왼쪽 밝게
        for g in range(3):                                           # 나뭇결
            gy = y + ((i * 11 + g * 13 + seed) % max(1, h - 3)) + 1
            c.rect(xx + 2, gy, 1, 2, ramp[2])
        c.p(xx + 2, y + 1, ramp[1]); c.p(xx + 2, y + h - 2, ramp[1])  # 못


# ---------------------------------------------------------------------
#  상점 (112 x 80): 파란 기와지붕 + 나무 가게 + 차양 + 진열창
# ---------------------------------------------------------------------
def build_shop():
    W_, H_ = 112, 80
    c = Px(W_, H_)
    G = H_ - 8                     # 기단 윗면

    # --- 벽 (나무판) ---
    planks_v(c, 4, 30, 104, G - 30, WOOD, seed=3)
    # 기둥(모서리) + 가로 들보
    for x in (3, 104):
        c.rect(x, 30, 5, G - 30, WOOD[2]); c.vl(x + 1, 30, G - 30, WOOD[4]); c.vl(x + 4, 30, G - 30, WOOD[1])
    c.rect(3, 30, 106, 3, WOOD[2]); c.hl(3, 30, 106, WOOD[4])

    # --- 진열창 (좌/우) ---
    def window(x, y, w, h, goods):
        c.rect(x - 2, y - 2, w + 4, h + 4, INK)
        c.rect(x - 1, y - 1, w + 2, h + 2, CREAM[3]); c.hl(x - 1, y - 1, w + 2, CREAM[4]); c.vl(x + w, y - 1, h + 2, CREAM[1])
        # 유리 너머 따뜻한 실내: 위는 어둡고 아래로 갈수록 밝게
        for yy in range(h):
            t = yy / max(1, h - 1)
            col = FIRE[2] if t > 0.7 else BRICK[3] if t > 0.4 else BRICK[2] if t > 0.15 else BRICK[1]
            c.hl(x, y + yy, w, col)
        c.dither(x, y + int(h * 0.4), w, 2, BRICK[3], 1)
        c.dither(x, y + int(h * 0.7) - 1, w, 1, FIRE[2], 0)
        c.rect(x, y + 5, w, 1, WOOD[2]); c.hl(x, y + 4, w, WOOD[1])             # 뒤쪽 선반
        for k in range(x + 2, x + w - 2, 4):                                   # 선반 위 병/상자
            c.rect(k, y + 2, 2, 2, [GLASS[4], GOLD[3], LEAF[3], BRICK[4]][(k // 4) % 4])
        # 진열대 + 물건
        c.rect(x, y + h - 5, w, 1, WOOD[1]); c.rect(x, y + h - 4, w, 4, WOOD[3]); c.hl(x, y + h - 4, w, WOOD[5])
        gx = x + 2
        for g in goods:
            c.paste(g, gx, y + h - 5 - g.height)
            gx += g.width + 3
        # 창살 + 유리 반사
        c.vl(x + w // 2, y, h, CREAM[2])
        for k in range(0, 5):
            c.p(x + 2 + k, y + 5 - k, GLASS[5]); c.p(x + 3 + k, y + 5 - k, GLASS[5])
            c.p(x + w // 2 + 3 + k, y + 7 - k, GLASS[5])
        # 화분 상자
        c.rect(x - 2, y + h + 2, w + 4, 4, INK); c.rect(x - 1, y + h + 2, w + 2, 3, WOOD[3]); c.hl(x - 1, y + h + 2, w + 2, WOOD[5])
        for k in range(x, x + w, 3):
            c.p(k, y + h + 1, LEAF[3]); c.p(k + 1, y + h, LEAF[2])
            c.p(k + 1, y + h + 1, LEAF[4] if k % 2 else LEAF[3])
            if k % 6 == 0:
                c.p(k, y + h, "#ff6b8a"); c.p(k + 1, y + h - 1, "#ffd0dc")
            elif k % 6 == 3:
                c.p(k, y + h, "#ffe066")

    drill = icon("drill", 0.85); fuel = icon("fuelcan", 0.85); lamp = icon("lamp", 0.85); dyn = icon("dyn_s", 0.85)
    window(10, 47, 30, 16, [drill, dyn])
    window(72, 47, 30, 16, [fuel, lamp])

    # --- 문 ---
    dx, dw = 47, 18
    c.rect(dx - 2, 44, dw + 4, G - 44, INK)
    c.rect(dx - 1, 45, dw + 2, G - 45, WOOD[1])
    for half in (0, 1):
        hx = dx + half * (dw // 2)
        c.rect(hx, 46, dw // 2 - 1, G - 46, WOOD[3]); c.vl(hx, 46, G - 46, WOOD[4])
        c.rect(hx + 2, 48, dw // 2 - 5, 9, INK)                             # 문 유리
        c.rect(hx + 3, 49, dw // 2 - 7, 7, FIRE[4]); c.hl(hx + 3, 49, dw // 2 - 7, FIRE[3]); c.p(hx + 3, 50, FIRE[6])
        c.rect(hx + 2, 60, dw // 2 - 5, 8, WOOD[2]); c.rect(hx + 3, 61, dw // 2 - 7, 6, WOOD[4])  # 아래 판
    c.p(dx + dw // 2 - 3, 58, GOLD[4]); c.p(dx + dw // 2 + 1, 58, GOLD[4])        # 손잡이
    c.rect(dx - 3, G, dw + 6, 2, STONE[4]); c.hl(dx - 3, G, dw + 6, STONE[6])       # 문턱

    # --- 차양 (파랑/흰 줄무늬, 물결 끝) ---
    ay, ah = 35, 7
    for x in range(5, 107):
        stripe = ((x - 5) // 5) % 2
        top = BLUE[4] if stripe else CREAM[4]
        mid = BLUE[3] if stripe else CREAM[3]
        for yy in range(ah):
            c.p(x, ay + yy, top if yy < 2 else mid)
        if (x - 5) % 5 in (1, 2, 3):                                   # 물결 끝
            c.p(x, ay + ah, mid)
            if (x - 5) % 5 == 2:
                c.p(x, ay + ah + 1, BLUE[2] if stripe else CREAM[1])
    c.hl(5, ay - 1, 102, INK); c.hl(5, ay, 102, BLUE[5])
    c.vl(4, ay - 1, ah + 2, INK); c.vl(107, ay - 1, ah + 2, INK)
    c.blend(5, ay + ah + 1, 102, 3, INK, 0.35)                          # 차양 그림자

    # --- 등불 ---
    lantern(c, 38, 34 + 10); lantern(c, 67, 34 + 10)
    glow(c, 41, 49, 7); glow(c, 70, 49, 7)

    # --- 지붕 (파란 기와) ---
    top_y, eave_y = 9, 29
    for yy in range(top_y, eave_y + 1):
        t = (yy - top_y) / (eave_y - top_y)
        x0 = int(16 - 16 * t) + 1
        x1 = int(96 + 16 * t) - 1
        for xx in range(x0, x1 + 1):
            row = (yy - top_y) // 3
            seam = (xx + (row % 2) * 3) % 6 == 0
            k = 4 if (yy - top_y) % 3 == 0 else 3
            if xx < 24:
                k += 1
            elif xx > 80:
                k -= 1
            col = BLUE[k]
            if seam:
                col = BLUE[2]
            if (yy - top_y) % 3 == 2:
                col = BLUE[2] if xx % 2 else BLUE[1]                   # 기와 줄 아래 그림자
            c.p(xx, yy, col)
    # 용마루 + 처마 끝
    c.rect(15, top_y - 2, 82, 3, BLUE[1]); c.hl(15, top_y - 2, 82, BLUE[5])
    c.rect(0, eave_y, 112, 3, WOOD[2]); c.hl(0, eave_y, 112, WOOD[4]); c.hl(0, eave_y + 2, 112, WOOD[1])
    for x in range(2, 112, 6):
        c.p(x, eave_y + 1, WOOD[5])

    # 굴뚝 (연기는 게임이 그림)
    c.rect(86, 0, 9, 14, BRICK[3]); bricks(c, 87, 2, 7, 11, BRICK); c.rect(85, 0, 11, 2, IRON[3]); c.hl(85, 0, 11, IRON[5])

    # --- 로고 박공: 지붕 가운데 삼각 박공 + 둥근 배지(상자 아이콘) ---
    gx, gy = 56, 2
    c.poly([(gx, gy), (gx + 20, gy + 26), (gx - 20, gy + 26)], CREAM[3])
    for yy in range(gy + 4, gy + 27, 3):
        half = int((yy - gy) * 20 / 26)
        c.hl(gx - half, yy, half * 2 + 1, CREAM[2])
    c.poly([(gx, gy - 1), (gx + 22, gy + 27), (gx + 19, gy + 27), (gx, gy + 2)], WOOD[2])
    c.poly([(gx, gy - 1), (gx - 22, gy + 27), (gx - 19, gy + 27), (gx, gy + 2)], WOOD[4])
    badge_round(c, gx, gy + 16, 9, GOLD, BLUE, icon("chest"))

    # --- 기단 + 소품 ---
    stone_base(c, 0, G, 112, 8)
    # 왼쪽 통
    bx, by = 0, G - 12
    c.rect(bx, by, 9, 12, INK); c.rect(bx + 1, by + 1, 7, 10, WOOD[3]); c.vl(bx + 2, by + 1, 10, WOOD[5])
    for yy in (by + 3, by + 8):
        c.hl(bx + 1, yy, 7, IRON[3])
    c.hl(bx + 1, by + 1, 7, WOOD[2])
    # 오른쪽 상자 더미
    for (x, y, s) in ((101, G - 9, 9), (104, G - 16, 7)):
        c.rect(x, y, s, s, INK); c.rect(x + 1, y + 1, s - 2, s - 2, WOOD[4]); c.hl(x + 1, y + 1, s - 2, WOOD[5])
        c.p(x + 1, y + 1, WOOD[6]); c.rect(x + 1, y + s // 2, s - 2, 1, WOOD[2]); c.vl(x + s // 2, y + 1, s - 2, WOOD[2])

    c.outline()
    return c.im


# ---------------------------------------------------------------------
#  제작소 (112 x 80): 초록 함석지붕 + 돌벽 + 열린 대장간 + 연장 벽
# ---------------------------------------------------------------------
def build_workshop():
    W_, H_ = 112, 80
    c = Px(W_, H_)
    G = H_ - 8

    # 벽: 아래 돌, 위 회벽 + 나무 골조
    c.rect(3, 28, 106, G - 28, CREAM[2])
    for yy in range(28, 46):
        for xx in range(3, 109):
            if (xx * 3 + yy * 7) % 11 == 0:
                c.p(xx, yy, CREAM[1])
            elif (xx * 5 + yy) % 17 == 0:
                c.p(xx, yy, CREAM[3])
    bricks(c, 3, 46, 106, G - 46, STONE, seed=2)
    for x in (3, 50, 104):                                              # 나무 기둥
        c.rect(x, 28, 5, G - 28, WOOD[2]); c.vl(x + 1, 28, G - 28, WOOD[4]); c.vl(x + 4, 28, G - 28, WOOD[1])
    c.rect(3, 44, 106, 3, WOOD[2]); c.hl(3, 44, 106, WOOD[4])
    for (x0, x1) in ((8, 50), (55, 104)):                               # 회벽 X자 나무 보강
        for i in range(x1 - x0):
            y = 29 + int(i * 15 / (x1 - x0))
            c.rect(x0 + i, y, 1, 2, WOOD[3]); c.p(x0 + i, y, WOOD[4])
            y2 = 43 - int(i * 15 / (x1 - x0))
            c.rect(x0 + i, y2 - 1, 1, 2, WOOD[2])

    # 열린 대장간 (불빛은 게임이 깜빡이게 그림)
    fx, fy, fw = 9, 40, 38
    c.rect(fx - 1, fy - 1, fw + 2, G - fy + 1, INK)
    c.rect(fx, fy, fw, G - fy, "#1c1012")
    for yy in range(fy, G):                                             # 안쪽 벽에 비친 불빛
        t = (yy - fy) / (G - fy)
        if t > 0.35:
            c.dither(fx, yy, fw, 1, BRICK[2] if t < 0.7 else FIRE[1], yy)
    # 화덕
    c.rect(fx + 4, G - 14, 16, 14, INK); bricks(c, fx + 5, G - 13, 14, 13, BRICK)
    c.rect(fx + 8, G - 10, 8, 5, FIRE[3]); c.rect(fx + 9, G - 9, 6, 3, FIRE[5]); c.hl(fx + 10, G - 8, 4, FIRE[6])
    c.rect(fx + 6, G - 20, 12, 6, IRON[2]); c.hl(fx + 6, G - 20, 12, IRON[4])   # 후드
    c.rect(fx + 10, fy, 4, G - 20 - fy, IRON[1]); c.vl(fx + 10, fy, G - 20 - fy, IRON[3])
    # 안쪽 모루
    ax = fx + 24
    c.rect(ax, G - 8, 10, 3, IRON[3]); c.hl(ax, G - 8, 10, IRON[5]); c.rect(ax - 2, G - 8, 2, 2, IRON[3])
    c.rect(ax + 3, G - 5, 4, 5, IRON[2]); c.rect(ax + 1, G - 1, 8, 1, IRON[1])
    # 문틀 위 들보
    c.rect(fx - 2, fy - 4, fw + 4, 4, WOOD[2]); c.hl(fx - 2, fy - 4, fw + 4, WOOD[4])

    # 연장 벽 (못걸이 판) + 작업대
    px_, py_ = 57, 49
    c.rect(px_, py_, 44, 13, INK); c.rect(px_ + 1, py_ + 1, 42, 11, WOOD[4])
    for yy in range(py_ + 2, py_ + 12, 3):
        for xx in range(px_ + 3, px_ + 42, 3):
            c.p(xx, yy, WOOD[2])
    # 망치
    c.rect(px_ + 4, py_ + 3, 6, 3, IRON[4]); c.hl(px_ + 4, py_ + 3, 6, IRON[6]); c.rect(px_ + 6, py_ + 6, 2, 5, WOOD[2])
    # 렌치
    c.rect(px_ + 14, py_ + 3, 2, 8, IRON[4]); c.rect(px_ + 13, py_ + 2, 4, 2, IRON[5]); c.p(px_ + 14, py_ + 2, WOOD[4])
    # 톱
    c.rect(px_ + 20, py_ + 4, 10, 3, IRON[5]); c.hl(px_ + 20, py_ + 7, 10, IRON[3])
    for xx in range(px_ + 20, px_ + 30, 2):
        c.p(xx, py_ + 7, IRON[6])
    c.rect(px_ + 30, py_ + 3, 3, 5, WOOD[2])
    # 집게
    c.vl(px_ + 36, py_ + 3, 8, IRON[3]); c.vl(px_ + 38, py_ + 3, 8, IRON[3]); c.rect(px_ + 36, py_ + 6, 3, 1, IRON[5])
    # 작업대
    c.rect(55, G - 9, 48, 3, INK); c.rect(56, G - 9, 46, 2, WOOD[4]); c.hl(56, G - 9, 46, WOOD[6])
    for x in (57, 99):
        c.rect(x, G - 6, 2, 6, WOOD[2])
    c.rect(63, G - 13, 6, 4, IRON[3]); c.hl(63, G - 13, 6, IRON[5]); c.rect(65, G - 15, 2, 2, IRON[2])   # 바이스
    for k, b in enumerate(("cu", "fe", "au")):                            # 작업대 위 주괴
        bc = {"cu": BRICK[5], "fe": IRON[5], "au": GOLD[4]}[b]
        c.rect(80 + k * 6, G - 11, 5, 2, bc); c.hl(80 + k * 6, G - 11, 5, "#ffffff" if b != "cu" else BRICK[6])
    # 벽 등
    lantern(c, 70, 36); glow(c, 73, 41, 8)

    # 지붕: 초록 함석 (골이 세로로)
    top_y, eave_y = 10, 27
    for yy in range(top_y, eave_y + 1):
        t = (yy - top_y) / (eave_y - top_y)
        x0 = int(12 - 12 * t)
        x1 = int(100 + 12 * t)
        for xx in range(x0, x1):
            k = (xx // 2) % 2
            col = GREEN[4] if k else GREEN[3]
            if xx % 4 == 0:
                col = GREEN[5]
            if xx > W_ * 0.6 and col != GREEN[5]:
                col = GREEN[3] if k else GREEN[2]
            c.p(xx, yy, col)
        if (yy - top_y) % 6 == 5:                                       # 판 이음새
            c.hl(x0, yy, x1 - x0, GREEN[2])
    c.rect(11, top_y - 2, 90, 3, GREEN[1]); c.hl(11, top_y - 2, 90, GREEN[5])
    c.rect(0, eave_y, 112, 2, GREEN[1]); c.hl(0, eave_y, 112, GREEN[4])
    c.blend(3, eave_y + 2, 106, 2, INK, 0.4)
    # 굴뚝(연통)
    c.rect(18, 0, 6, 12, IRON[2]); c.vl(19, 0, 12, IRON[4]); c.rect(16, 0, 10, 2, IRON[3]); c.hl(16, 0, 10, IRON[5])
    c.rect(17, 6, 8, 1, IRON[1])
    # 환풍기 (오른쪽 지붕)
    c.rect(86, 4, 10, 7, IRON[2]); c.hl(86, 4, 10, IRON[5])
    for xx in range(87, 95, 2):
        c.vl(xx, 6, 4, IRON[1])

    # 로고: 톱니바퀴 배지(드릴 아이콘)
    gx, gy, r = 56, 15, 11
    import math
    for a in range(12):
        ang = a * math.pi / 6
        tx, ty = gx + math.cos(ang) * (r + 1), gy + math.sin(ang) * (r + 1)
        c.rect(int(round(tx)) - 2, int(round(ty)) - 2, 4, 4, INK)
        c.rect(int(round(tx)) - 1, int(round(ty)) - 1, 2, 2, IRON[5] if a in (7, 8, 9) else IRON[4])
    badge_round(c, gx, gy, r - 1, IRON, GREEN, icon("drill"))

    stone_base(c, 0, G, 112, 8)
    # 바깥 소품: 숫돌, 쇠막대 통
    c.rect(102, G - 10, 8, 10, INK); c.rect(103, G - 9, 6, 9, WOOD[3]); c.hl(103, G - 9, 6, WOOD[5])
    for xx in (104, 106, 108):
        c.vl(xx, G - 14, 5, IRON[4]); c.p(xx, G - 14, IRON[6])
    c.outline()
    return c.im


# ---------------------------------------------------------------------
#  용광로 (80 x 96): 위로 좁아지는 벽돌 탑 + 쇠띠 + 아궁이 + 풀무 + 석탄 + 쇳물 홈
# ---------------------------------------------------------------------
def build_furnace():
    W_, H_ = 80, 96
    c = Px(W_, H_)
    G = H_ - 8

    # 굴뚝
    for yy in range(4, 30):
        t = (yy - 4) / 26
        x0, x1 = int(34 - 2 * t), int(46 + 2 * t)
        for xx in range(x0, x1):
            k = 4 if xx < x0 + 3 else 3 if xx < x1 - 3 else 2
            if (yy // 3 + xx // 4) % 2 == 0 and (yy % 3 == 0):
                k -= 1
            c.p(xx, yy, BRICK[k])
    c.rect(31, 0, 18, 4, IRON[2]); c.hl(31, 0, 18, IRON[5]); c.hl(31, 3, 18, IRON[1])
    c.rect(32, 14, 16, 2, IRON[3]); c.hl(32, 14, 16, IRON[5])

    # 탑 몸통 (아래로 넓어짐)
    top, bot = 32, G
    for yy in range(top, bot):
        t = (yy - top) / (bot - top)
        x0, x1 = int(18 - 12 * t), int(62 + 12 * t)
        row = (yy - top) // 4
        for xx in range(x0, x1):
            u = (xx - x0) / max(1, x1 - x0)
            off = (row % 2) * 4
            mortar = (yy - top) % 4 == 3 or (xx + off) % 8 == 7
            if mortar:
                col = BRICK[1]
            else:
                k = 5 if u < 0.15 else 4 if u < 0.45 else 3 if u < 0.8 else 2
                if ((xx + off) // 8 + row) % 5 == 0:
                    k -= 1
                col = BRICK[k]
                if (yy - top) % 4 == 0 and k >= 3:
                    col = BRICK[min(6, k + 1)]
            c.p(xx, yy, col)
    # 꼭대기 쇠갓
    c.rect(14, 26, 52, 7, IRON[2]); c.hl(14, 26, 52, IRON[5]); c.hl(14, 27, 52, IRON[4]); c.hl(14, 32, 52, IRON[1])
    for xx in range(17, 64, 6):
        c.p(xx, 29, IRON[6]); c.p(xx, 30, IRON[1])

    # 쇠띠 2줄 + 리벳
    for yy in (50, 74):
        t = (yy - top) / (bot - top)
        x0, x1 = int(18 - 12 * t) - 1, int(62 + 12 * t) + 1
        c.rect(x0, yy, x1 - x0, 3, IRON[3]); c.hl(x0, yy, x1 - x0, IRON[5]); c.hl(x0, yy + 2, x1 - x0, IRON[1])
        for xx in range(x0 + 2, x1 - 1, 5):
            c.p(xx, yy + 1, IRON[6])

    # 로고 배지 (용광로 아이콘)
    badge_round(c, 40, 41, 8, GOLD, BRICK, icon("furnace"))

    # 아궁이 (아치). 안쪽 불은 게임이 그림
    mx, my, mw, mh = 26, 58, 28, 30
    c.ellipse(mx - 2, my - 2, mx + mw + 1, my + 16, INK)
    c.rect(mx - 2, my + 6, mw + 4, mh - 6, INK)
    c.ellipse(mx, my, mx + mw - 1, my + 14, "#1c0d0a")
    c.rect(mx, my + 7, mw, mh - 7, "#1c0d0a")
    # 아치 테두리 돌
    for i in range(0, 15):
        ang = 3.14159 * i / 14
        import math
        x = int(round(mx + mw / 2 - 1 + math.cos(ang) * (mw / 2 + 1)))
        y = int(round(my + 7 - math.sin(ang) * 9))
        c.rect(x - 1, y - 1, 3, 2, STONE[4] if i < 7 else STONE[3]); c.p(x - 1, y - 1, STONE[6])
    # 쇠 창살
    for xx in range(mx + 3, mx + mw - 2, 5):
        c.vl(xx, my + 2, mh - 10, IRON[3]); c.vl(xx + 1, my + 2, mh - 10, IRON[1])
    c.hl(mx, my + mh - 8, mw, IRON[3])

    # 풀무 (왼쪽)
    bx, by = 0, G - 18
    c.poly([(bx + 1, by + 2), (bx + 12, by + 7), (bx + 12, by + 12), (bx + 1, by + 17)], "#5a3a22")
    for k in range(3):
        c.hl(bx + 2, by + 6 + k * 4, 9, "#3d2614")
    c.rect(bx, by, 3, 18, WOOD[3]); c.vl(bx, by, 18, WOOD[5])
    c.rect(bx + 12, by + 8, 6, 3, IRON[3]); c.hl(bx + 12, by + 8, 6, IRON[5])   # 관

    # 석탄 더미 (오른쪽)
    import random
    rnd = random.Random(7)
    for x in range(63, 80):                                              # 둥근 더미 모양
        hgt = max(0, 9 - abs(x - 71) * 9 // 9)
        for y in range(G - hgt, G):
            c.p(x, y, [IRON[1], "#24262f", IRON[2]][rnd.randint(0, 2)])
    for i in range(26):                                                  # 덩어리 윗면 반짝임
        x = 64 + rnd.randint(0, 14); hgt = max(0, 9 - abs(x - 71))
        y = G - rnd.randint(1, max(1, hgt))
        c.p(x, y, IRON[4]); c.p(x - 1, y, IRON[3])
    for (x, y) in ((68, G - 6), (72, G - 8), (75, G - 4), (70, G - 3)):
        c.p(x, y, IRON[6])

    # 쇳물 홈 (아궁이 오른쪽 아래 → 거푸집). 쇳물 빛은 게임이 그림
    c.rect(54, G - 6, 12, 4, INK); c.rect(54, G - 5, 12, 2, IRON[2])
    c.rect(58, G - 3, 9, 3, INK); c.rect(59, G - 2, 7, 2, IRON[3])

    stone_base(c, 4, G, 72, 8)
    c.outline()
    # 아궁이 안쪽과 쇳물 홈은 뚫어 둠 → 게임이 그 뒤에 불/쇳물을 그려서 창살 사이로 보임 (BLD_FX.furnace)
    for y in range(my, my + mh):
        for x in range(mx, mx + mw):
            if c.get(x, y)[:3] == rgba("#1c0d0a")[:3]:
                c.px[x, y] = (0, 0, 0, 0)
    for x in range(54, 66):
        for y in (G - 5, G - 4):
            c.px[x, y] = (0, 0, 0, 0)
    return c.im


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (("item_shop", build_shop), ("workshop", build_workshop), ("furnace", build_furnace)):
        im = fn()
        im.save(os.path.join(OUT, name + ".png"))
        print(name, im.size)
