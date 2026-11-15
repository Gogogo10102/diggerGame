#!/usr/bin/env python3
# 아이템·상점 아이콘 PNG 만들기 → public/assets/items/*.png, public/assets/ui/icon/*.png
#
# 스타일: "밝은 플랫" (같은 계열의 진한 색 테두리, 밝은 면, 명암 2~3단). docs/decisions.md 참고.
# 처음 한 번 만들 때 쓴 스크립트이고, 이후에는 PNG를 도트 편집기로 직접 고쳐도 됩니다.
#   필요: Python 3 + numpy + scipy + Pillow
#   실행: python3 tools/make-icons.py [--size 32]   (그 다음 npm run assets:manifest)
#   --size: 그림 크기(기본 32 = 고해상도. 16 이면 예전 도트 크기). 모양은 16칸 좌표라 크기와 상관없이 같음
# 장비는 분류마다 같은 모양에 단계(0~7)별 재질 색만 바꿉니다:
#   0 강철 · 1 티타늄 · 2 다이아 · 3 에메랄드 · 4 황금 · 5 루비 · 6 자수정 · 7 미스릴
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixicon import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ITEMS = os.path.join(ROOT, "public/assets/items")
OUT_UI = os.path.join(ROOT, "public/assets/ui/icon")
TIER = ["steel", "blue", "cyan", "emer", "gold", "ruby", "amet", "mith"]

# ---------------- 장비 모양 (t: 단계) ----------------
def drill(t):
    m = TIER[t]
    cone = poly([(5.4, 3.0), (5.4, 13.0), (14.8, 8.0)])
    gro = I_(U_(line(7.4, 3.0, 9.4, 13.0, 0.9), line(10.0, 4.6, 11.6, 11.4, 0.9)), cone)
    L_ = [L(rrect(1.2, 4.2, 5.8, 11.8, 0.8), "steel", "flat", 2),
          L(rect(1.2, 7.4, 5.8, 8.6), "steel", "fix", 1, sep=False),
          L(cone, m, "dome", 2.4, rr=2.0, spec=[(7, 6)]),
          L(gro, m, "fix", 1, sep=False)]
    if t >= 3: L_.append(L(ell(3.4, 6.0, 1.0, 1.0), m, "fix", 4, sep=False))
    if t >= 5: L_ += [L(poly([(2.0, 4.2), (4.6, 4.2), (3.4, 1.4)]), m, "flat", 3), L(poly([(2.0, 11.8), (4.6, 11.8), (3.4, 14.6)]), m, "flat", 2)]
    return L_

def tank(t):
    m = TIER[t]
    def can(x0, x1):
        cx = (x0 + x1) / 2
        return [L(rect(cx - 1.4, 1.2, cx + 1.4, 3.6), "steel", "flat", 3),
                L(rrect(x0, 3.0, x1, 14.8, 1.8), m, "dome", 2.4, rr=2.4, spec=[(x0 + 1.4, 5)]),
                L(rect(x0, 8.2, x1, 9.4), m, "fix", 1, sep=False)]
    if t >= 5:
        L_ = can(1.2, 7.6) + can(8.4, 14.8)
        bolt = U_(poly([(4.6, 5.0), (3.0, 8.4), (4.4, 8.4), (3.6, 12.0), (5.8, 7.6), (4.4, 7.6), (5.4, 5.0)]),
                  poly([(11.8, 5.0), (10.2, 8.4), (11.6, 8.4), (10.8, 12.0), (13.0, 7.6), (11.6, 7.6), (12.6, 5.0)]))
    else:
        L_ = can(3.0, 13.0)
        bolt = poly([(8.6, 4.6), (6.2, 9.0), (8.0, 9.0), (7.0, 13.4), (10.2, 8.0), (8.4, 8.0), (9.8, 4.6)])
    return L_ + [L(bolt, "glow", "fix", 3, sep=False)]

def crate(t):
    m = "wood" if t == 0 else TIER[t]
    L_ = [L(rrect(1.4, 4.4, 14.6, 14.6, 0.8), m, "flat", 2),
          L(rect(1.4, 4.4, 14.6, 7.0), m, "flat", 3, sep=False),
          L(rect(1.4, 7.0, 14.6, 7.6), m, "fix", 1, sep=False),
          L(rect(7.2, 7.6, 8.8, 14.6), m, "fix", 1, sep=False),
          L(rrect(6.4, 5.6, 9.6, 9.4, 0.4), "gold" if m != "gold" else "steel", "flat", 3)]
    if t >= 2: L_.append(L(rect(1.4, 11.0, 14.6, 11.6), m, "fix", 1, sep=False))
    if t >= 5: L_.insert(0, L(D_(rrect(4.6, 1.2, 11.4, 5.0, 1.4), rrect(6.2, 2.4, 9.8, 5.0, 0.6)), "steel", "flat", 3))
    return L_

def engine(t):
    m = TIER[t]
    n = 3 if t >= 6 else 2 if t >= 3 else 1
    xs = {1: [8.0], 2: [5.4, 10.6], 3: [3.8, 8.0, 12.2]}[n]
    L_ = []
    for x in xs:
        L_.append(L(poly([(x - 1.6, 10.8), (x + 1.6, 10.8), (x + 1.0, 14.8 if t >= 4 else 13.8), (x, 15.0), (x - 1.0, 14.8 if t >= 4 else 13.8)]), "fire", "flat", 3))
    L_ += [L(rrect(1.6, 3.4, 14.4, 9.6, 1.2), "steel", "flat", 2),
           L(rect(2.8, 5.4, 13.2, 6.0), "steel", "fix", 1, sep=False),
           L(rect(2.8, 7.2, 13.2, 7.8), "steel", "fix", 1, sep=False)]
    for x in xs:
        L_.append(L(rrect(x - 1.8, 8.6, x + 1.8, 11.4, 0.4), m, "flat", 3))
    L_.append(L(rrect(5.4, 1.2, 10.6, 3.8, 0.6), m, "flat", 3, spec=[(6, 1.8)]))
    if t >= 5: L_ += [L(rect(0.6, 4.6, 1.8, 8.4), m, "flat", 3), L(rect(14.2, 4.6, 15.4, 8.4), m, "flat", 2)]
    return L_

def tracks(t):
    m = TIER[t]
    nw = 4 if t >= 2 else 3
    xs = [3.6 + i * (8.8 / (nw - 1)) for i in range(nw)]
    L_ = [L(rrect(1.0, 4.6, 15.0, 14.6, 4.6), "rubber", "flat", 2)]
    for x in xs: L_.append(L(ell(x, 9.6, 2.4, 2.4), m, "dome", 2.6, rr=1.4, spec=[(x - 1, 8.4)]))
    for x in xs: L_.append(L(ell(x, 9.6, 0.8, 0.8), "rubber", "fix", 1, sep=False))
    if t >= 3: L_.append(L(rrect(3.0, 1.6, 13.0, 4.8, 0.6), m, "flat", 3, spec=[(4, 2.2)]))
    if t >= 5: L_.append(L(rect(4.0, 14.2, 12.0, 15.2), "glow", "fix", 3))
    return L_

def lamp(t):
    m = TIER[t]
    L_ = []
    if t >= 2:
        L_ += [L(line(8, 1.2, 8, 2.4, 1.0), "glow", "fix", 3), L(line(3.0, 2.4, 4.0, 3.6, 1.0), "glow", "fix", 3), L(line(13.0, 2.4, 12.0, 3.6, 1.0), "glow", "fix", 3)]
    L_ += [L(rect(5.6, 11.4, 10.4, 14.8), "steel", "flat", 2),
           L(rrect(2.0, 4.0, 14.0, 12.0, 2.4), m, "dome", 2.4, rr=2.4),
           L(ell(8, 8.0, 3.8, 2.8), "glow", "dome", 3.0, rr=1.6, spec=[(6.4, 6.6)])]
    if t >= 5: L_.append(L(ell(8, 8.0, 1.4, 1.0), "glow", "fix", 4, sep=False))
    return L_

def goggles(t):
    m = TIER[t]
    return [L(rect(0.8, 7.2, 15.2, 8.8), "leath", "flat", 2),
            L(ell(4.6, 8.0, 3.4, 3.2), m, "dome", 2.4, rr=1.4),
            L(ell(11.4, 8.0, 3.4, 3.2), m, "dome", 2.4, rr=1.4),
            L(ell(4.6, 8.0, 2.1, 2.0), "glass", "dome", 2.8, rr=1.2, spec=[(3.8, 7.0)]),
            L(ell(11.4, 8.0, 2.1, 2.0), "glass", "dome", 2.8, rr=1.2, spec=[(10.6, 7.0)])] + \
           ([L(rrect(3.0, 2.0, 13.0, 4.4, 0.8), m, "flat", 3)] if t >= 5 else [])

def scale(t):
    m = TIER[t] if t != 0 else "gold"
    return [L(rect(7.2, 3.0, 8.8, 13.0), m, "flat", 2),
            L(rrect(4.0, 12.6, 12.0, 14.8, 0.6), m, "flat", 2),
            L(rect(1.2, 4.0, 14.8, 5.2), m, "flat", 3),
            L(line(2.2, 5.0, 1.2, 9.0, 0.6), "steel", "fix", 2), L(line(2.2, 5.0, 3.6, 9.0, 0.6), "steel", "fix", 2),
            L(line(13.8, 5.0, 12.4, 9.0, 0.6), "steel", "fix", 2), L(line(13.8, 5.0, 15.0, 9.0, 0.6), "steel", "fix", 2),
            L(D_(ell(2.4, 9.0, 2.2, 1.8), rect(0, 0, 16, 9.0)), m, "flat", 3),
            L(D_(ell(13.6, 9.0, 2.2, 1.8), rect(0, 0, 16, 9.0)), m, "flat", 3),
            L(ell(8.0, 2.8, 1.4, 1.4), m, "dome", 2.6, rr=1)]

def clover(t):
    return [L(line(8.2, 9.0, 10.4, 14.8, 1.2), "leaf", "fix", 1),
            L(ell(5.2, 5.2, 3.0, 3.0), "leaf", "dome", 2.6, rr=1.6, spec=[(4.2, 4)]),
            L(ell(10.8, 5.2, 3.0, 3.0), "leaf", "dome", 2.6, rr=1.6, spec=[(9.8, 4)]),
            L(ell(5.2, 10.2, 3.0, 3.0), "leaf", "dome", 2.4, rr=1.6),
            L(ell(10.8, 10.2, 3.0, 3.0), "leaf", "dome", 2.4, rr=1.6),
            L(ell(8.0, 7.7, 1.6, 1.6), TIER[t] if t >= 4 else "gold", "dome", 3.0, rr=1)]

# ---------------- 특수 장비 (하나씩) ----------------
def gauge():
    return [L(D_(ell(8, 10.4, 7.0, 7.0), rect(0, 10.4, 16, 16)), "steel", "flat", 3),
            L(rect(1.0, 10.4, 15.0, 13.8), "steel", "flat", 2),
            L(D_(ell(8, 10.4, 5.0, 5.0), rect(0, 10.4, 16, 16)), "paper", "fix", 4),
            L(line(4.0, 7.0, 5.0, 8.0, 0.7), "ruby", "fix", 2, sep=False), L(line(12.0, 7.0, 11.0, 8.0, 0.7), "leaf", "fix", 2, sep=False),
            L(line(8.0, 10.4, 11.4, 6.4, 1.0), "leaf", "fix", 1, sep=False),
            L(ell(8.0, 10.4, 1.2, 1.2), "steel", "fix", 1, sep=False)]

def cool_core():
    snow = U_(line(8, 3.6, 8, 12.4, 0.9), line(4.2, 5.8, 11.8, 10.2, 0.9), line(4.2, 10.2, 11.8, 5.8, 0.9))
    return [L(rrect(5.4, 0.8, 10.6, 3.0, 0.4), "steel", "flat", 3),
            L(rrect(5.4, 13.0, 10.6, 15.2, 0.4), "steel", "flat", 2),
            L(ell(8, 8, 6.2, 5.6), "ice", "dome", 2.6, rr=3, spec=[(5, 5)]),
            L(snow, "ice", "fix", 4, sep=False)]

def chart():
    return [L(rect(6.6, 12.0, 9.4, 14.0), "steel", "flat", 2),
            L(rrect(3.6, 13.4, 12.4, 15.0, 0.4), "steel", "flat", 2),
            L(rrect(1.0, 1.6, 15.0, 12.4, 1.0), "steel", "flat", 2),
            L(rect(2.4, 3.0, 13.6, 11.0), "rubber", "fix", 0, sep=False),
            L(U_(line(3.4, 9.4, 6.4, 6.8, 1.0), line(6.4, 6.8, 8.6, 8.0, 1.0), line(8.6, 8.0, 12.4, 4.2, 1.0)), "leaf", "fix", 3, sep=False),
            L(poly([(10.8, 3.8), (12.8, 3.8), (12.8, 5.8)]), "leaf", "fix", 3, sep=False)]

def antenna():
    return [L(rrect(4.0, 12.6, 12.0, 15.0, 0.6), "steel", "flat", 2),
            L(rect(7.3, 5.6, 8.7, 12.8), "steel", "flat", 3),
            L(D_(ell(8, 5.6, 6.6, 4.4), ell(8, 5.6, 5.2, 3.2), rect(0, 5.6, 16, 16)), "steel", "flat", 3),
            L(ell(8.0, 3.2, 2.0, 2.0), "leaf", "dome", 2.6, rr=1.2, spec=[(7.2, 2.4)]),
            L(ell(8.0, 3.2, 0.8, 0.8), "gold", "fix", 3, sep=False)]

def contract():
    return [L(rrect(2.4, 1.2, 13.6, 14.8, 0.6), "scroll", "flat", 3),
            L(U_(rect(4.2, 3.6, 11.8, 4.4), rect(4.2, 5.8, 11.8, 6.6), rect(4.2, 8.0, 9.6, 8.8)), "scroll", "fix", 1, sep=False),
            L(ell(10.4, 11.6, 2.6, 2.6), "ruby", "dome", 2.4, rr=1.4, spec=[(9.6, 10.6)]),
            L(poly([(9.0, 13.4), (8.4, 15.4), (9.8, 14.6)]), "ruby", "fix", 2),
            L(poly([(11.8, 13.4), (12.4, 15.4), (11.0, 14.6)]), "ruby", "fix", 2)]

def coil():
    loops = U_(*[D_(ell(x, 8, 1.6, 4.6), ell(x, 8, 0.7, 3.6)) for x in (4.4, 7.0, 9.6, 12.2)])
    return [L(rrect(1.0, 6.4, 15.0, 9.6, 1.0), "steel", "flat", 2),
            L(loops, "gold", "flat", 3)]

def permit():
    return [L(rrect(1.2, 3.0, 14.8, 13.4, 1.0), "gold", "flat", 3, spec=[(2.4, 4.0)]),
            L(rect(1.2, 5.4, 14.8, 6.8), "gold", "fix", 1, sep=False),
            L(U_(rect(3.0, 9.0, 8.0, 9.8), rect(3.0, 11.0, 6.6, 11.8)), "gold", "fix", 1, sep=False),
            L(ell(11.4, 10.2, 2.2, 2.2), "ruby", "dome", 2.4, rr=1.2)]

SPECIAL = {"eco1": gauge, "appraiser": lambda: goggles(4), "eco2": cool_core, "market_ana": chart,
           "luck_ant": antenna, "auction": contract, "superwire": coil, "exchange": permit}
SHAPES = {"drill": drill, "fuel": tank, "crate": crate, "engine": engine, "tracks": tracks, "lamp": lamp,
          "goggles": goggles, "scale": scale, "clover": clover}
CATS = [("drill", ["steel_drill", "ti_drill", "dia_drill", "plasma_drill", "sonic_drill", "gravity_drill", "antimatter_drill", "singularity_drill"]),
        ("fuel", ["aux_tank", "big_tank", "power_cell", "comp_tank", "plasma_cell", "fusion_core", "dark_tank", "inf_reactor"]),
        ("crate", ["cargo%d" % i for i in range(1, 9)]),
        ("engine", ["engine%d" % i for i in range(1, 9)]),
        ("tracks", ["track%d" % i for i in range(1, 9)]),
        ("lamp", ["lamp%d" % i for i in range(1, 9)])]
CRAFT = {  # 제작 장비: id -> (모양, 단계)  (src/game/art/itemIcons.ts 의 CRAFT_ICON 과 같음)
    "laser_drill": ("drill", 3), "dia_bit": ("drill", 5), "mithril_drill": ("drill", 7),
    "coal_boiler": ("engine", 2), "ruby_core": ("engine", 5), "mithril_reactor": ("engine", 7),
    "silver_lens": ("lamp", 3), "gold_scale": ("scale", 4), "lucky_charm": ("clover", 5),
    "copper_motor": ("tracks", 2), "steel_frame": ("crate", 3), "mithril_armor": ("crate", 7),
    "iron_bit": ("drill", 2), "silver_bit": ("drill", 3), "gold_bit": ("drill", 4), "ruby_bit": ("drill", 6),
    "copper_coil": ("engine", 3), "gold_cell": ("engine", 4), "diamond_cell": ("engine", 6), "void_engine": ("engine", 7),
    "emerald_lens": ("lamp", 5), "diamond_scope": ("lamp", 6), "merchant_ring": ("scale", 6), "clover_gem": ("clover", 6),
    "turbo_motor": ("tracks", 4), "ion_thruster": ("tracks", 6), "silver_plating": ("crate", 4), "diamond_hull": ("crate", 7),
    "scout_goggles": ("goggles", 2), "geo_scanner": ("goggles", 5), "vein_radar": ("goggles", 6), "deep_visor": ("goggles", 7),
}

# ---------------- 소모품 · 화면 아이콘 ----------------
def jerry(mat="redcan", s=1.0, gold_x=False):
    o = lambda v: 8 + (v - 8) * s
    body = rrect(o(2.6), o(4.2), o(13.4), o(14.8), 1.4 * s)
    handle = D_(rrect(o(4.4), o(1.2), o(10.4), o(4.8), 1.0 * s), rect(o(5.8), o(2.4), o(9.0), o(4.8)))
    spout = poly([(o(10.8), o(4.6)), (o(12.6), o(1.4)), (o(14.4), o(2.4)), (o(13.0), o(5.0))])
    xm = I_(U_(line(o(4.2), o(6.2), o(11.8), o(13.0), 1.1 * s), line(o(11.8), o(6.2), o(4.2), o(13.0), 1.1 * s)), rrect(o(3.8), o(5.6), o(12.2), o(13.6), 0.8))
    return [L(spout, "steel", "flat", 3), L(handle, mat, "dome", 2.4, rr=1.2), L(body, mat, "dome", 2.4, rr=3, spec=[(o(4), o(5.5))]),
            L(xm, mat, "fix", 1, sep=False)]

def dyn_stick(x):
    return [L(line(x + 0.4, 1.2, x + 1.2, 3.2, 0.7), "scroll", "fix", 1),
            L(rrect(x - 1.6, 3.0, x + 1.6, 14.8, 0.8), "redcan", "dome", 2.6, rr=1.2),
            L(rect(x - 1.6, 7.6, x + 1.6, 9.2), "paper", "fix", 4, sep=False)]

def dyn_s():  return dyn_stick(8) + [L(ell(9.6, 1.4, 1.0, 1.0), "glow", "fix", 3)]
def dyn_l():  return dyn_stick(4.0) + dyn_stick(8.0) + dyn_stick(12.0) + [L(rect(1.6, 10.4, 14.4, 12.0), "scroll", "flat", 2), L(ell(9.6, 1.4, 1.0, 1.0), "glow", "fix", 3)]
def dyn_x():
    return [L(line(8.0, 4.6, 9.6, 1.4, 0.8), "scroll", "fix", 1), L(ell(10.2, 1.4, 1.0, 1.0), "glow", "fix", 3),
            L(rect(6.4, 3.6, 9.6, 5.6), "steel", "flat", 2),
            L(ell(8, 10.0, 5.6, 5.2), "rubber", "dome", 2.6, rr=3, spec=[(5.4, 7.4)]),
            L(rect(2.6, 9.4, 13.4, 10.8), "gold", "fix", 3, sep=False)]
def sup_w():
    return [L(rect(3.0, 4.0, 5.6, 15.0), "wood", "flat", 2), L(rect(10.4, 4.0, 13.0, 15.0), "wood", "flat", 2),
            L(rect(1.0, 1.4, 15.0, 4.4), "wood", "flat", 3), L(line(5.6, 4.4, 8.0, 7.4, 1.0), "wood", "fix", 1),
            L(line(10.4, 4.4, 8.0, 7.4, 1.0), "wood", "fix", 1)]
def sup_s():
    return [L(U_(rect(3.0, 4.0, 5.6, 15.0), rect(10.4, 4.0, 13.0, 15.0)), "steel", "flat", 2),
            L(rect(1.0, 1.4, 15.0, 4.4), "steel", "flat", 3),
            L(U_(rect(1.0, 2.6, 15.0, 3.2)), "steel", "fix", 1, sep=False),
            L(U_(rect(4.0, 4.0, 4.6, 15.0), rect(11.4, 4.0, 12.0, 15.0)), "steel", "fix", 1, sep=False),
            L(rect(1.2, 13.8, 14.8, 15.0), "glow", "fix", 2)]

def coin():
    return [L(ell(8, 8, 6.4, 6.9), "gold", "dome", 2.4, spec=[(5, 4), (4, 6)]),
            L(ell(8, 8, 4.0, 4.6), "gold", "inset", 2),
            L(rrect(7.1, 5.0, 8.9, 11.0, 0.6), "gold", "flat", 3, sep=False)]
def chest():
    return [L(rrect(1.2, 3.0, 14.8, 8.0, 2.2), "wood", "dome", 2.6, rr=2.5),
            L(rect(1.2, 7.6, 14.8, 14.8), "wood", "flat", 2),
            L(rect(1.2, 10.8, 14.8, 11.4), "wood", "fix", 1, sep=False),
            L(rect(3.0, 3.0, 4.8, 14.8), "gold", "flat", 3), L(rect(11.2, 3.0, 13.0, 14.8), "gold", "flat", 3),
            L(rect(1.2, 7.4, 14.8, 8.4), "gold", "flat", 2),
            L(rrect(6.4, 6.0, 9.6, 10.4, 0.6), "gold", "flat", 3, spec=[(7, 6.6)]),
            L(rect(7.6, 7.6, 8.4, 9.4), "dwood", "fix", 0, sep=False)]
def bag():
    return [L(D_(rrect(4.4, 1.2, 11.6, 5.2, 1.6), rrect(6.0, 2.6, 10.0, 5.2, 0.6)), "leath", "dome", 2.4, rr=1),
            L(rrect(2.0, 4.0, 14.0, 14.8, 2.4), "leath", "dome", 2.4, rr=3, spec=[(4, 5.4)]),
            L(rrect(4.0, 8.6, 12.0, 13.4, 1.0), "leath", "flat", 2),
            L(rrect(7.0, 7.6, 9.0, 10.2, 0.4), "gold", "flat", 3)]
def trophy():
    cup = U_(D_(ell(8, 4.0, 5.2, 6.4), rect(0, 0, 16, 2.0)))
    return [L(U_(D_(ell(2.8, 5.0, 2.2, 2.4), ell(2.8, 5.0, 1.0, 1.2)), D_(ell(13.2, 5.0, 2.2, 2.4), ell(13.2, 5.0, 1.0, 1.2))), "gold", "flat", 2),
            L(cup, "gold", "dome", 2.6, rr=2.4, spec=[(5, 3.6)]),
            L(rect(7.0, 10.0, 9.0, 12.4), "gold", "flat", 2),
            L(rrect(4.0, 12.2, 12.0, 14.8, 0.6), "wood", "flat", 2),
            L(rect(6.0, 13.0, 10.0, 14.0), "gold", "fix", 3, sep=False)]

ICON_N = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 32
def save(layers, path):
    img = Image.fromarray(render(layers, ICON_N, "A", []), "RGBA")
    img.save(path)

if __name__ == "__main__":
    n = 0
    for shape, ids in CATS:
        for t, id_ in enumerate(ids):
            save(SHAPES[shape](t), os.path.join(OUT_ITEMS, id_ + ".png")); n += 1
    for id_, fn in SPECIAL.items():
        save(fn(), os.path.join(OUT_ITEMS, id_ + ".png")); n += 1
    for id_, (shape, t) in CRAFT.items():
        save(SHAPES[shape](t), os.path.join(OUT_ITEMS, id_ + ".png")); n += 1
    ui = {"coin": coin(), "chest": chest(), "bag": bag(), "crate": crate(0), "fuel": jerry(), "fuelcan": jerry(),
          "fuel_s": jerry(s=0.72), "fuel_m": jerry(s=0.86), "fuel_l": jerry("gold"),
          "dyn_s": dyn_s(), "dyn_l": dyn_l(), "dyn_x": dyn_x(), "sup_w": sup_w(), "sup_s": sup_s(),
          "drill": drill(1), "engine": engine(1), "tracks": tracks(1), "lamp": lamp(1), "special": goggles(2), "trophy": trophy()}
    for k, lay in ui.items():
        save(lay, os.path.join(OUT_UI, k + ".png")); n += 1
    print("아이콘", n, "개 저장")
