# 캐릭터(드릴 로봇) 종류: 모양(robot3d.STY) + 색(재질별 5단). make-hires.py 가 miner/<id>/*.png 를 만듦
#  게임 쪽 목록·해금 조건은 src/game/art/sprites.ts 의 CHARS 와 같은 id 순서
BASE = {"chr": ["#0e1014", "#22252d", "#3a3f4b", "#5a6170", "#8a92a2"],
        "steel": ["#1e222c", "#464e60", "#7a8496", "#b6bfce", "#f0f4fa"],
        "gry": ["#202020", "#505050", "#808080", "#c0c0c0", "#ffffff"]}
CHARS = [
    ("yellow", dict(), {"sy": ["#5a3400", "#c47e00", "#ffbe1a", "#ffe27a", "#fff6c8"], "hd": ["#2a2f3a", "#6a7384", "#b4bcca", "#e2e7ef", "#ffffff"],
                        "eye": ["#0a2a5a", "#1a5ac0", "#4aa8ff", "#b8e4ff", "#ffffff"]}),
    ("ruby", dict(ant="one", antlen=8.5), {"sy": ["#4a0c0c", "#a81e22", "#ec3b36", "#ff8a6e", "#ffd8c8"], "hd": ["#3a3236", "#8a7e84", "#e6dcd8", "#fff6f0", "#ffffff"],
                        "eye": ["#5a2a00", "#c06a00", "#ffb21a", "#ffe08a", "#ffffff"]}),
    ("mint", dict(head="dome", antlen=5.0), {"sy": ["#0c3a2c", "#1e8a62", "#3fd69a", "#9af2c8", "#e8fff4"], "hd": ["#24343a", "#5e7a80", "#a8c8c8", "#e0f4f0", "#ffffff"],
                        "eye": ["#4a0a3a", "#a81e7a", "#ff4ab4", "#ffb0e0", "#ffffff"]}),
    ("cobalt", dict(ant="none", visor=True), {"sy": ["#0a1a4a", "#1a46a8", "#3a7cff", "#9ac0ff", "#e4eeff"], "hd": ["#2a2e3a", "#646a7e", "#b4bacc", "#e4e8f2", "#ffffff"],
                        "eye": ["#08404a", "#109aa8", "#3ff0ff", "#b8ffff", "#ffffff"]}),
    ("mole", dict(ant="none", helmet=True), {"sy": ["#24160c", "#5a3a22", "#8a5e3a", "#b88a5a", "#e6c8a0"], "hd": ["#2a2a2e", "#5a5a62", "#9a9aa4", "#d0d0d8", "#ffffff"],
                        "eye": ["#4a1a00", "#b04a00", "#ff8a1a", "#ffd08a", "#ffffff"], "hat": ["#5a3400", "#c47e00", "#ffbe1a", "#ffe27a", "#fff6c8"]}),
    ("night", dict(head="dome", ant="two", antlen=9.0), {"sy": ["#0e0c1a", "#24203a", "#3a3460", "#5e5690", "#9a92c8"], "hd": ["#4a3000", "#a87400", "#f0b820", "#ffe070", "#fffbe0"],
                        "eye": ["#4a0a3a", "#b0127a", "#ff3ab0", "#ffa8e0", "#ffffff"]}),
]
def ramps_of(c):
    r = dict(BASE); r.update(c[2]); r.setdefault("hat", r["sy"])
    return r
