#!/usr/bin/env python3
# 드릴 로봇 캐릭터를 '작은 3D 장면'으로 그려 도트 부품 PNG 로 만듦 (make-hires.py 가 불러 씀)
#
# 왜 3D 로 그리나: 옆에서 살짝 비껴 본(3/4) 입체감을 손으로 맞추기 어려워서. 상자·원기둥·공 같은 도형으로 로봇을 세우고
#   (1) 직교 카메라로 약간 위·옆에서 비춰 봄  (2) 빛을 받은 정도를 4~5단으로 끊어 도트처럼  (3) 굵은 외곽선
# 결과는 예전과 같은 부품 규칙: 120x120, 몸통 칸 36~84, 발 = y 84.
#   body_<자세> 색 그대로 / trk_<0|1> · cw · lamp · bit_<자세>_<0|1> 은 회색(게임에서 장비 단계 색으로 칠함)
# 드릴 원뿔·척 자리는 draw.ts 의 드릴 밀기·축 그리기와 맞춤(옆: 밑변 x84 · 가운데 y55.5 / 아래: 밑변 y91 · x76.5 / 위: 밑변 y19 · x73.5).
import math
import numpy as np

N = 120
TH, PH = math.radians(38), 0.0                       # 로봇이 화면 쪽으로 돈 각도 · 내려다본 각도
#  PH = 0(눈높이): 궤도 두 줄이 같은 땅에 붙어 보임. 내려다보면 먼 쪽 궤도가 위로 떠 보여서 0 으로 둠

def nrm(v): v = np.asarray(v, float); return v / np.linalg.norm(v)
# 카메라 좌표: x 오른쪽, y 아래(화면), z 보는 사람 쪽
UP = nrm([0, -math.cos(PH), math.sin(PH)])
FW = nrm([math.cos(TH), math.sin(TH) * math.sin(PH), math.sin(TH) * math.cos(PH)])
SD = np.cross(UP, FW)
if SD[2] < 0: SD = -SD                                # 보는 사람 쪽 옆면(가까운 쪽)
ORG = np.array([60.0, 84.0, 0.0])                     # 바닥 가운데(로봇 발밑)이 화면에 오는 자리
K = 1.12                                              # 로봇 크기 배율

def to_cam(f, u, s):
    """로봇 좌표(앞 f, 위 u, 가까운 옆 s) → 카메라 좌표"""
    return ORG + K * (f * FW + u * UP + s * SD)

# ---- 거리 함수(SDF) ----
def loc(P):                                           # 카메라 → 로봇 좌표 (P: [...,3])
    d = (P - ORG) / K
    return np.stack([d @ FW, d @ UP, d @ SD], -1)
def sd_rbox(q, c, b, r):
    p = np.abs(q - c) - (np.asarray(b) - r)
    return np.linalg.norm(np.maximum(p, 0), axis=-1) + np.minimum(p.max(-1), 0) - r
def sd_sph(q, c, r): return np.linalg.norm(q - c, axis=-1) - r
def sd_cap(q, a, b, r):
    a, b = np.asarray(a, float), np.asarray(b, float); pa, ba = q - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[..., None] * ba, axis=-1) - r
def sd_cyl(q, a, b, r):
    a, b = np.asarray(a, float), np.asarray(b, float); ba = b - a; L = np.linalg.norm(ba); ax = ba / L
    pa = q - a; t = pa @ ax; d = np.linalg.norm(pa - t[..., None] * ax, axis=-1)
    dx, dy = d - r, np.abs(t - L / 2) - L / 2
    return np.minimum(np.maximum(dx, dy), 0) + np.hypot(np.maximum(dx, 0), np.maximum(dy, 0))
def sd_cone(q, base, tip, R):
    base, tip = np.asarray(base, float), np.asarray(tip, float); ba = tip - base; L = np.linalg.norm(ba); ax = ba / L
    pa = q - base; t = pa @ ax; d = np.linalg.norm(pa - t[..., None] * ax, axis=-1)
    k = R / L; side = (d - R + k * t) / math.sqrt(1 + k * k)
    return np.maximum(side, np.maximum(-t, t - L))

# ---- 장면 ----
#  물체: (이름, 무리, 재질, 거리함수(카메라 좌표 → 거리), 무늬함수(카메라 좌표, 로봇 좌표 → 톤 보정))
#  무리: body(색 그대로) / trk / cw / lamp / bit
DRILL = {  # 드릴 원뿔(밑변 가운데, 끝, 밑변 반지름)과 척(원기둥 시작, 끝, 반지름) — 카메라 좌표
    "side": (np.array([84, 55.5]), np.array([117, 55.5]), np.array([75, 55.5]), 13.5),
    "down": (np.array([82.5, 91]), np.array([82.5, 117]), np.array([82.5, 79]), 13.5),   # 궤도 앞쪽 끝을 비켜 조금 앞으로
    "up":   (np.array([73.5, 19]), np.array([73.5, 2]), np.array([73.5, 32]), 13.5),
}
SHOULDER = (4, 31, 13.5)
# 캐릭터 모양 (make-hires.py 가 캐릭터마다 바꿔 끼움): 머리 box/dome · 안테나 two/one/none · 안테나 길이 · 고글 눈 · 안전모
STY = dict(head="box", ant="two", antlen=7.0, visor=False, helmet=False)

def scene(mode, leg, dig, lean=0):
    sh = to_cam(*SHOULDER)
    zd = sh[2] + 2                                     # 팔·척·드릴은 어깨와 같은 깊이(보는 쪽)
    if mode == "down":                                 # 아래로 팔 땐 척·드릴이 궤도 높이를 지나가므로 가까운 궤도보다 앞에 둠 (궤도에 가려지지 않게)
        zd = max(zd, to_cam(0, 7, 17.5)[2] + 3)
    base, tip, chuck0, R = DRILL[mode]
    B3, T3, C3 = [np.array([v[0], v[1], zd]) for v in (base, tip, chuck0)]
    ob = []
    def add(name, grp, mat, f, pat=None): ob.append((name, grp, mat, f, pat))
    # 궤도: 먼 쪽 · 가까운 쪽
    for s0, nm in ((-11.5, "trkF"), (11.5, "trkN")):
        add(nm, "trk", "gry", lambda P, s0=s0: sd_rbox(loc(P), np.array([0, 7, s0]), (23, 7, 4.5), 4.5),
            lambda P, q, s0=s0: np.where(((q[..., 0] + leg * 3.5) % 7 < 2.4) & ((q[..., 1] < 2.6) | (q[..., 1] > 11.4)), -3, -2))   # 궤도는 어둡게(참고 그림처럼), 바퀴 자국은 더
    for fw in (-15, -5, 5, 15):                        # 가까운 쪽 바퀴 (옆면에서 살짝 나옴)
        add("whl", "trk", "gry", lambda P, fw=fw: sd_cyl(loc(P), (fw, 7, 14), (fw, 7, 17.2), 4.6),
            lambda P, q, fw=fw: np.where(np.hypot(q[..., 0] - fw, q[..., 1] - 7) < 1.8, -2, 1))
    # 궤도 덮개(노랑) + 경고 줄무늬
    add("deck", "body", "sy", lambda P: sd_rbox(loc(P), np.array([0, 16, 0]), (22, 3.6, 16.5), 2.2),
        lambda P, q: np.where((q[..., 2] > 15.5) & (((q[..., 0] - q[..., 1] * 0.8) % 7) < 3), -9, 0))
    add("body", "body", "sy", lambda P: sd_rbox(loc(P), np.array([-2, 30, 0]), (15, 12.5, 12.5), 6.5), None)
    add("panel", "body", "chr", lambda P: sd_rbox(loc(P), np.array([12.6, 27, 0]), (2.2, 7.5, 7.5), 1.5),
        lambda P, q: np.where((np.abs(q[..., 1] - 27) < 4) & ((q[..., 1] % 3) < 1.2) & (np.abs(q[..., 2]) < 5), 1, 0))
    hr = 8.4 if STY["head"] == "dome" else 4.6       # 둥근 머리 = 모서리를 크게 깎은 상자
    add("head", "body", "hd", lambda P: sd_rbox(loc(P), np.array([3, 50, 0]), (11, 9.5, 11), hr),
        lambda P, q: np.where((q[..., 2] > 9.5) & (np.abs(q[..., 1] - 48) < 3) & ((q[..., 1] % 2.4) < 1) & (q[..., 0] < 4), -1, 0))
    if STY["visor"]:                                   # 가로로 긴 고글 눈
        add("eyeR", "body", "chr", lambda P: sd_rbox(loc(P), np.array([12.6, 51, 0]), (2.6, 3.6, 8.6), 1.8), None)
        add("eye", "body", "eye", lambda P: sd_rbox(loc(P), np.array([13.8, 51, 0]), (2.0, 2.5, 7.4), 1.4), None)
    else:
        add("eyeR", "body", "chr", lambda P: sd_sph(loc(P), np.array([12.8, 51, 3.8]), 5.4), None)
        add("eye", "body", "eye", lambda P: sd_sph(loc(P), np.array([14.2, 51, 3.8]), 4.3), None)
    if STY["helmet"]:                                  # 광부 안전모 + 앞 램프 (램프는 조명 단계 색)
        add("hat", "body", "hat", lambda P: np.maximum(sd_sph(loc(P), np.array([2, 55, 0]), 12.6), 55.5 - loc(P)[..., 1]),
            lambda P, q: np.where(np.abs(q[..., 2]) < 1.3, 1, 0))
        add("brim", "body", "hat", lambda P: sd_rbox(loc(P), np.array([3.5, 55.6, 0]), (15.5, 1.3, 13.8), 1.2), None)
        add("tip", "lamp", "gry", lambda P: sd_cyl(loc(P), (12.5, 61, 0), (15.8, 61, 0), 3.2), None)
    ants = {"two": (-6.5, 6.5), "one": (0.0,), "none": ()}[STY["ant"]]
    for s0 in ants:
        # 안테나: lean(-1 뒤로 · 0 · +1 앞으로) 만큼 끝이 기울어짐 → 게임에서 움직일 때 흔들림(ant_0~2 · lamp_0~2)
        al = STY["antlen"]
        add("ant", "ant", "hd", lambda P, s0=s0: sd_cap(loc(P), (1, 58, s0), (-0.5 + lean * 3.0, 58 + al - abs(lean) * 0.4, s0), 1.5), None)
        add("tip", "lamp", "gry", lambda P, s0=s0: sd_sph(loc(P), np.array([-0.7 + lean * 3.4, 59.2 + al - abs(lean) * 0.5, s0]), 2.6), None)
    add("pack", "cw", "gry", lambda P: sd_rbox(loc(P), np.array([-19, 31, 0]), (4.5, 10, 9.5), 3),
        lambda P, q: np.where(np.abs(q[..., 1] - 31) < 1.2, -1, 0))
    # 어깨 · 통짜 팔 · 드릴 척
    add("shoulder", "body", "sy", lambda P: sd_sph(P, sh, 7.6), None)
    add("arm", "body", "steel", lambda P: sd_cap(P, sh, C3, 4.6), None)
    ax = (B3 - C3) / np.linalg.norm(B3 - C3)
    add("chuck", "body", "chr", lambda P: sd_cyl(P, C3, B3 + ax * 0.5, 11),
        lambda P, q: np.where((((P - C3) @ ax) % 3.4) < 1.1, -1, 0))
    # 드릴 원뿔 (나선 홈: 축 둘레 각도 + 축 방향 거리로 줄무늬, dig 프레임마다 밀림)
    def groove(P, q):
        pa = P - B3; t = pa @ ax; rad = pa - t[..., None] * ax
        e1 = np.cross(ax, [0, 0, 1.0]); e1 = e1 / (np.linalg.norm(e1) + 1e-9); e2 = np.cross(ax, e1)
        a = np.arctan2(rad @ e2, rad @ e1) / (2 * np.pi)
        return np.where(((t / 7.5 + a * 2 + dig * 0.5) % 1) < 0.28, -1, 0)
    add("bit", "bit", "gry", lambda P: sd_cone(P, B3, T3, R), groove)
    return ob

LIGHT = nrm([-0.55, -0.75, 0.62])                     # 왼쪽 위 앞에서 오는 빛

def render_scene(mode, leg=0, dig=0, skip=(), lean=0):
    obs = [o for o in scene(mode, leg, dig, lean) if o[0] not in skip]
    ys, xs = np.mgrid[0:N, 0:N].astype(float) + 0.5
    z = np.full((N, N), 120.0); hit = np.zeros((N, N), bool); idx = np.full((N, N), -1)
    for _ in range(140):                               # 보는 쪽(z+)에서 안쪽으로 걸어 들어가며 표면 찾기
        P = np.stack([xs, ys, z], -1)
        ds = np.stack([o[3](P) for o in obs], 0)
        d = ds.min(0); k = ds.argmin(0)
        newhit = ~hit & (d < 0.05)
        idx[newhit] = k[newhit]; hit |= newhit
        z = np.where(hit, z, z - np.maximum(d * 0.8, 0.05))
        if (z < -120).all() or hit.all(): break
    hit &= z > -119
    P = np.stack([xs, ys, z], -1)
    # 법선 (해당 물체 거리함수의 기울기)
    nrmv = np.zeros((N, N, 3)); e = 0.3
    for i, o in enumerate(obs):
        m = hit & (idx == i)
        if not m.any(): continue
        Q = P[m]
        g = np.stack([(o[3](Q + dv) - o[3](Q - dv)) for dv in np.eye(3) * e], -1)
        nrmv[m] = g / (np.linalg.norm(g, axis=-1, keepdims=True) + 1e-9)
    # 화면 y 는 아래쪽이 + 라서 빛 계산은 그대로(LIGHT 도 같은 좌표)
    dif = np.clip((nrmv * LIGHT).sum(-1), 0, 1)
    spec = np.clip((nrmv * nrm(LIGHT + [0, 0, 1])).sum(-1), 0, 1) ** 24
    tone = 0.55 + dif * 3.0 + spec * 1.6               # 0..4 근처
    tone = np.clip(np.round(tone), 1, 4).astype(int)
    for i, o in enumerate(obs):                        # 무늬(줄무늬·홈·바퀴 등)
        m = hit & (idx == i)
        if o[4] is None or not m.any(): continue
        adj = o[4](P[m], loc(P[m]))
        if np.isscalar(adj): adj = np.full(m.sum(), adj)
        stripe = adj <= -9
        t = np.clip(tone[m] + np.where(stripe, 0, adj), 0, 4)
        tone[m] = t
        if stripe.any():                               # 경고 줄무늬는 숯색으로
            sub = np.zeros(N * N, bool); sub[np.flatnonzero(m.ravel())[stripe]] = True
            idx_s = sub.reshape(N, N); tone[idx_s] = 102   # 표시: 아래에서 숯색 칠함
    # 경계선: 이웃이 다른 물체이고 더 가까우면 이 칸을 가장 어둡게(먼 쪽에 선)
    edge = np.zeros((N, N), bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb_i = np.roll(np.roll(idx, dy, 0), dx, 1); nb_z = np.roll(np.roll(z, dy, 0), dx, 1); nb_h = np.roll(np.roll(hit, dy, 0), dx, 1)
        edge |= hit & nb_h & (nb_i != idx) & (nb_z > z + 1.2)
    return obs, hit, idx, tone, edge, z

def paint(R, ramps, pick):
    """render_scene 결과에서 pick(물체) 가 참인 물체들만 색칠한 RGBA"""
    obs, hit, idx, tone, edge, z = R
    im = np.zeros((N, N, 4), np.uint8)
    for i, o in enumerate(obs):
        if not pick(o): continue
        m = hit & (idx == i)
        if not m.any(): continue
        ramp = np.array(ramps[o[2]])
        t = tone[m].copy()
        col = ramp[np.clip(t, 0, 4)]
        col[t == 102] = ramps["chr"][1]
        e = edge[m]; col[e] = ramp[0]
        im[m, :3] = col; im[m, 3] = 255
    return im

def parts_for(mode, leg=0, dig=0, ramps=None, lean=0):
    """무리별 RGBA 그림. ramps[재질] = 5단 색(어둠→밝음)"""
    R = render_scene(mode, leg, dig, lean=lean)
    return {grp: thick_outline(paint(R, ramps, lambda o, g=grp: o[1] == g)) for grp in ("body", "ant", "trk", "cw", "lamp", "bit")}

def blink_overlay(mode, ramps):
    """눈 감은 모습: 눈이 보이던 칸만, 눈을 뺀 장면(머리 면)으로 덮고 가운데에 감은 눈 선"""
    R = render_scene(mode)
    obs, hit, idx = R[0], R[1], R[2]
    eye_ids = [i for i, o in enumerate(obs) if o[0] in ("eye", "eyeR")]
    mask = hit & np.isin(idx, eye_ids)
    core = mask.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): mask |= np.roll(np.roll(core, dy, 0), dx, 1) & hit   # 눈 둘레 경계선까지 덮음
    lid = paint(render_scene(mode, skip=("eye", "eyeR")), ramps, lambda o: True)
    out = np.zeros((N, N, 4), np.uint8)
    out[mask] = lid[mask]
    ys, xs = np.nonzero(core)
    if len(ys):
        cy = int(round(ys.mean())) + 1
        row = core[cy]; out[cy, row, :3] = ramps["chr"][0]; out[cy, row, 3] = 255         # 감은 눈꺼풀 선
        r2 = core[cy - 1] & core[cy]; out[cy - 1, r2, :3] = ramps["hd"][1]; out[cy - 1, r2, 3] = 255
    return out

def thick_outline(im):
    """바깥에 1px 짙은 테두리 (화면에서 작게 보여도 도트 윤곽이 또렷하게)"""
    a = im[..., 3] > 0
    d = a.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): d |= np.roll(np.roll(a, dy, 0), dx, 1)
    out = im.copy(); out[d & ~a] = [14, 15, 20, 255]
    return out
