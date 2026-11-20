#!/usr/bin/env python3
# 드릴 아이템 아이콘: 2026-11-20 확정 도안 v2 '기계 장치 드릴'(등급 4 × 진화 4, tools/drillart/drills2.py)을 게임 드릴에 입힘
#   python3 tools/make-drill-icons.py   → public/assets/items/<드릴 id>.png (72x72, 70x54 그림을 가운데에)
#   그 다음 npm run assets:manifest
# 등급: common(회색) · rare(파랑) · epic(보라) · legend(금), 진화 1~4. 상점 8단계 + 제작 7단계에 아래 표처럼 나눔
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "drillart"))
import drills2
from drills import GRADES

MAP = {  # 아이템 id: (등급, 진화)
    # 상점 드릴 (강해지는 순서)
    "steel_drill": ("common", 1), "ti_drill": ("common", 2), "dia_drill": ("rare", 1), "plasma_drill": ("rare", 2),
    "sonic_drill": ("rare", 3), "gravity_drill": ("epic", 3), "antimatter_drill": ("epic", 4), "singularity_drill": ("legend", 4),
    # 제작 드릴
    "iron_bit": ("common", 3), "silver_bit": ("common", 4), "gold_bit": ("legend", 1), "laser_drill": ("rare", 4),
    "ruby_bit": ("epic", 2), "dia_bit": ("legend", 2), "mithril_drill": ("legend", 3),
}
OUT = os.path.join(os.path.dirname(HERE), "public/assets/items")
if __name__ == "__main__":
    by = {g["key"]: g for g in GRADES}
    for id_, (gk, evo) in MAP.items():
        im = drills2.render(by[gk], evo)                       # 70x54 RGBA
        h, w = im.shape[:2]; N = 72
        sq = np.zeros((N, N, 4), np.uint8); y0, x0 = (N - h) // 2, (N - w) // 2
        sq[y0:y0 + h, x0:x0 + w] = im
        Image.fromarray(sq, "RGBA").save(os.path.join(OUT, id_ + ".png"))
    # 화면 아이콘(분류 버튼·빈 칸 등의 '드릴')도 같은 그림으로
    im = drills2.render(by["rare"], 2); h, w = im.shape[:2]
    sq = np.zeros((72, 72, 4), np.uint8); sq[(72 - h) // 2:(72 - h) // 2 + h, (72 - w) // 2:(72 - w) // 2 + w] = im
    Image.fromarray(sq, "RGBA").save(os.path.join(os.path.dirname(OUT), "ui/icon/drill.png"))
    print("드릴 아이콘", len(MAP) + 1, "개 저장")
