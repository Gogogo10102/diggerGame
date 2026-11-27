#!/usr/bin/env python3
"""아이템 그림 (PixelLab 'Create images from style references (Pro)' 8x8 시트 → items/<id>.png)

원본: tools/ref/pixellab/items/<시트이름>.png  (256x256 = 32px 칸 8x8, 투명 배경)
고른 칸: 아래 PICKS 의 { 시트이름: { 칸번호(1~64, 왼쪽 위부터 가로로): 아이템 id } }
결과: public/assets/items/<id>.png (32x32 그대로) — 소모품은 ui/icon/<id>.png 도 같이

  python3 tools/make-pixellab-items.py            # 전부
  python3 tools/make-pixellab-items.py rocket     # 시트 하나만

스타일 참고(32px): tools/ref/pixellab/items/style_*.png  (Pro 도구의 Style images 에 넣은 것)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools/ref/pixellab/items")
OUT = os.path.join(ROOT, "public/assets/items")
UI = os.path.join(ROOT, "public/assets/ui/icon")
CELL = 32

# 시트마다 고른 칸 (2026-11-28 백팩 로켓부터)
PICKS = {
    "rocket": {2: "rocket1", 18: "rocket1b", 24: "rocket2", 33: "rocket3", 49: "rocket4"},   # 백팩 · 강화 · 터보 · 제트 · 플라즈마
    "fuel": {4: "aux_tank", 10: "big_tank", 19: "power_cell", 29: "comp_tank", 34: "plasma_cell", 49: "fusion_core", 54: "dark_tank", 64: "inf_reactor"},
    "crate": {25: "cargo1", 29: "cargo2", 40: "cargo3", 41: "cargo4", 33: "cargo5", 43: "cargo6", 49: "cargo7", 62: "cargo8"},   # 나무 상자 대신 철 상자 → 기계 큐브 (로봇 몸 안 적재함 느낌)
    "engine": {2: "engine1", 15: "engine2", 18: "engine3", 26: "engine4", 35: "engine5", 43: "engine6", 50: "engine7", 61: "engine8"},
    "lamp": {2: "lamp1", 13: "lamp2", 18: "lamp3", 31: "lamp4", 33: "lamp5", 44: "lamp6", 49: "lamp7", 63: "lamp8"},
    "special": {2: "eco1", 13: "appraiser", 17: "eco2", 27: "market_ana", 35: "luck_ant", 45: "auction", 49: "superwire", 58: "exchange"},
    "c_engine": {2: "coal_boiler", 10: "ruby_core", 21: "mithril_reactor", 25: "copper_coil", 33: "gold_cell", 41: "diamond_cell", 52: "void_engine"},
    "c_tracks": {1: "copper_motor", 10: "steel_frame", 20: "mithril_armor", 26: "turbo_motor", 34: "ion_thruster", 41: "silver_plating", 49: "diamond_hull"},
    "c_lamp": {1: "silver_lens", 22: "gold_scale", 19: "lucky_charm", 26: "emerald_lens", 34: "diamond_scope", 47: "merchant_ring", 57: "clover_gem"},
    "c_special": {2: "scout_goggles", 19: "geo_scanner", 33: "vein_radar", 50: "deep_visor"},
    "cons": {1: "fuel_s", 17: "fuel_m", 14: "fuel_l", 19: "dyn_s", 25: "dyn_l", 32: "dyn_x", 38: "ladder", 49: "recall", 50: "sup_w", 59: "sup_s"},
    # 드릴(상점·제작)·궤도는 아직: 로봇 팔이 톱니바퀴라 드릴 그림이 안 맞고, 다리는 외형이 안 바뀌어서 → 새 시트(톱니·구동 부품) 받으면 넣기
}
CONSUMABLE = {"fuel_s", "fuel_m", "fuel_l", "dyn_s", "dyn_l", "dyn_x", "ladder", "recall", "sup_w", "sup_s"}


def cell(sheet, n):
    x, y = (n - 1) % 8 * CELL, (n - 1) // 8 * CELL
    c = sheet.crop((x, y, x + CELL, y + CELL))
    a = c.split()[3].point(lambda v: 255 if v >= 128 else 0)   # 반투명 가장자리 없애기 (도트가 또렷하게)
    c.putalpha(a)
    return c


def main(only):
    for name, picks in PICKS.items():
        if only and name not in only:
            continue
        sheet = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
        assert sheet.size == (CELL * 8, CELL * 8), (name, sheet.size)
        for n, iid in picks.items():
            c = cell(sheet, n)
            c.save(os.path.join(OUT, iid + ".png"))
            if iid in CONSUMABLE:
                c.save(os.path.join(UI, iid + ".png"))
            print(f"{name} #{n} → items/{iid}.png")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
