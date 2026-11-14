#!/usr/bin/env python3
# 마을 건물 도트 그림 만들기 → public/assets/buildings/{item_shop,workshop,furnace}.png
#
# 건물은 이 스크립트로 처음 그렸고, 이후에는 PNG를 도트 편집기(Aseprite 등)로 직접 고쳐도 됩니다.
#   실행: python3 tools/make-buildings.py   (Python 3 + Pillow)
# 규칙
#   - 그림 1픽셀 = 게임 화면 AS(=T/16, 지금 4)픽셀 (16px 타일과 같은 배율). 그림 아래 끝 = 땅 표면
#   - 지금 크기: 상점·제작소 80x64(5칸), 용광로 64x80(4칸). 건물 칸 너비(BUILD_COLS)에 맞춤
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
#  간소화 디자인 (2026-11 두 번째 버전)
#   - 넓은 단색 면 + 왼쪽 밝게/오른쪽 어둡게 2~3단계만. 잔무늬·소품 최소화
#   - 실루엣이 한눈에 구분되게: 상점=파란 지붕 집, 제작소=초록 지붕 작업장, 용광로=벽돌 탑
#   - 이름 대신 지붕 위 로고 배지
# ---------------------------------------------------------------------
def flat_roof(c, x0, x1, top, bot, inset, ramp, lines=0):
    """사다리꼴 지붕: 위가 inset 만큼 좁음. 맨 위 밝게, 처마 아래 그림자"""
    for y in range(top, bot + 1):
        t = (y - top) / max(1, bot - top)
        a, b = int(x0 + inset * (1 - t)), int(x1 - inset * (1 - t))
        for x in range(a, b + 1):
            k = 4 if y <= top + 1 else 3
            if x < a + 3:
                k += 1
            elif x > b - 3:
                k -= 1
            c.p(x, y, ramp[k])
        if lines and (y - top) % lines == lines - 1 and y < bot - 1:
            c.hl(a + 1, y, b - a - 1, ramp[2])
    c.hl(x0, bot, x1 - x0 + 1, ramp[1])


def flat_wall(c, x, y, w, h, ramp):
    """벽: 가운데 한 색 + 왼쪽 2줄 밝게, 오른쪽 2줄 어둡게"""
    c.rect(x, y, w, h, ramp[3])
    c.rect(x, y, 2, h, ramp[4])
    c.rect(x + w - 2, y, 2, h, ramp[2])


def simple_window(c, x, y, w, h):
    c.rect(x - 1, y - 1, w + 2, h + 2, WOOD[1])
    c.rect(x, y, w, h, FIRE[4])
    c.rect(x, y, w, h // 2, FIRE[3])
    c.vl(x + w // 2, y, h, WOOD[1]); c.hl(x, y + h // 2, w, WOOD[1])
    c.p(x + 1, y + 1, FIRE[6]); c.p(x + 2, y + 1, FIRE[6]); c.p(x + 1, y + 2, FIRE[6])
    c.hl(x - 1, y + h + 1, w + 2, WOOD[2])                               # 창턱


def base_strip(c, x, y, w, h):
    c.rect(x, y, w, h, STONE[3]); c.hl(x, y, w, STONE[5]); c.hl(x, y + h - 1, w, STONE[2])
    for k in range(x + 6, x + w - 2, 10):
        c.vl(k, y + 1, h - 2, STONE[2])


def build_shop():
    W_, H_ = 80, 64
    c = Px(W_, H_)
    G = H_ - 5                                                        # 기단 윗면
    flat_wall(c, 4, 22, 72, G - 22, CREAM)
    c.rect(4, 22, 72, 2, CREAM[1])                                    # 지붕 아래 그림자
    # 차양 (줄무늬 + 물결 끝)
    for x in range(4, 76):
        blue = ((x - 4) // 4) % 2 == 0
        col = BLUE[4] if blue else CREAM[4]
        c.rect(x, 26, 1, 4, col)
        if (x - 4) % 4 in (1, 2):
            c.p(x, 30, BLUE[3] if blue else CREAM[2])
    c.hl(4, 26, 72, BLUE[5])
    c.blend(4, 31, 72, 2, INK, 0.3)
    # 창 2개 + 문
    simple_window(c, 9, 35, 16, 11)
    simple_window(c, 55, 35, 16, 11)
    c.rect(32, 34, 16, G - 34, WOOD[1])
    c.rect(33, 35, 14, G - 35, WOOD[3]); c.vl(33, 35, G - 35, WOOD[4])
    c.rect(36, 38, 8, 6, FIRE[4]); c.hl(36, 38, 8, FIRE[3])
    c.p(44, 48, GOLD[4])
    base_strip(c, 0, G, 80, 5)
    # 지붕 + 로고 배지
    flat_roof(c, 0, 79, 10, 21, 10, BLUE, lines=4)
    badge_round(c, 40, 10, 9, GOLD, BLUE, icon("chest"))
    c.outline()
    return c.im


def build_workshop():
    W_, H_ = 80, 64
    c = Px(W_, H_)
    G = H_ - 5
    flat_wall(c, 4, 22, 72, G - 22, STONE)
    for y in range(28, G, 8):                                          # 돌벽 줄 몇 개만
        c.hl(5, y, 70, STONE[2])
        for x in range(8 + (y // 8 % 2) * 8, 74, 16):
            c.vl(x, y - 7, 7, STONE[2])
    c.rect(4, 22, 72, 2, STONE[1])
    # 열린 작업장 입구 (안쪽 불빛은 게임이 깜빡이게 그림)
    c.rect(9, 31, 30, G - 31, WOOD[1])
    c.rect(10, 32, 28, G - 32, "#1d1414")
    c.rect(10, G - 9, 28, 9, BRICK[1])
    c.rect(14, G - 7, 12, 7, FIRE[2]); c.rect(16, G - 5, 8, 5, FIRE[4]); c.hl(18, G - 4, 4, FIRE[6])   # 화덕 불
    c.rect(29, G - 5, 7, 2, IRON[4]); c.rect(31, G - 3, 3, 3, IRON[2])                              # 모루
    c.rect(8, 29, 32, 2, WOOD[2])                                      # 문 위 들보
    # 오른쪽: 창 하나
    simple_window(c, 51, 34, 18, 11)
    base_strip(c, 0, G, 80, 5)
    # 지붕 + 연통 + 톱니 배지
    c.rect(64, 0, 5, 12, IRON[3]); c.vl(64, 0, 12, IRON[5]); c.rect(63, 0, 7, 2, IRON[2])
    flat_roof(c, 0, 79, 11, 21, 9, GREEN, lines=0)
    for x in range(10, 72, 3):                                         # 함석 골 (세로줄)
        for y in range(13, 21):
            t = (y - 11) / 10
            if 9 * (1 - t) <= x <= 79 - 9 * (1 - t):
                c.p(x, y, GREEN[2])
    import math
    gx, gy, r = 40, 11, 10
    for a in range(10):
        ang = a * math.pi / 5
        tx, ty = int(round(gx + math.cos(ang) * (r + 1))), int(round(gy + math.sin(ang) * (r + 1)))
        c.rect(tx - 1, ty - 1, 3, 3, IRON[4])
    badge_round(c, gx, gy, r - 1, IRON, GREEN, icon("drill"))
    c.outline()
    return c.im


def build_furnace():
    W_, H_ = 64, 80
    c = Px(W_, H_)
    G = H_ - 5
    # 굴뚝
    c.rect(26, 2, 12, 24, BRICK[3]); c.rect(26, 2, 3, 24, BRICK[4]); c.rect(35, 2, 3, 24, BRICK[2])
    c.rect(24, 0, 16, 3, IRON[3]); c.hl(24, 0, 16, IRON[5])
    # 탑 (아래로 넓어짐)
    top, bot = 26, G
    for y in range(top, bot):
        t = (y - top) / (bot - top)
        a, b = int(14 - 8 * t), int(50 + 8 * t)
        for x in range(a, b):
            k = 4 if x < a + 4 else 2 if x > b - 5 else 3
            c.p(x, y, BRICK[k])
        if (y - top) % 7 == 6:                                           # 벽돌 줄 조금만
            c.hl(a + 1, y, b - a - 2, BRICK[2])
    # 꼭대기 쇠갓 + 가운데 쇠띠
    c.rect(11, 24, 42, 4, IRON[3]); c.hl(11, 24, 42, IRON[5]); c.hl(11, 27, 42, IRON[1])
    c.rect(8, 47, 48, 2, IRON[3]); c.hl(8, 47, 48, IRON[5])
    # 로고 배지
    badge_round(c, 32, 37, 8, GOLD, BRICK, icon("furnace"))
    # 아궁이: 아치 + 창살. 안쪽은 뚫어서 게임이 뒤에 불을 그림
    mx, my, mw, mh = 20, 52, 24, G - 52
    c.ellipse(mx - 2, my - 2, mx + mw + 1, my + 12, STONE[4])
    c.rect(mx - 2, my + 5, mw + 4, mh - 5, STONE[4])
    c.ellipse(mx, my, mx + mw - 1, my + 10, "#1c0d0a")
    c.rect(mx, my + 5, mw, mh - 5, "#1c0d0a")
    for x in range(mx + 5, mx + mw - 2, 6):
        c.vl(x, my + 2, mh - 2, IRON[3]); c.vl(x + 1, my + 2, mh - 2, IRON[1])
    base_strip(c, 4, G, 56, 5)
    c.outline()
    for y in range(my, my + mh):
        for x in range(mx, mx + mw):
            if c.get(x, y)[:3] == rgba("#1c0d0a")[:3]:
                c.px[x, y] = (0, 0, 0, 0)
    return c.im


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (("item_shop", build_shop), ("workshop", build_workshop), ("furnace", build_furnace)):
        im = fn()
        im.save(os.path.join(OUT, name + ".png"))
        print(name, im.size)
