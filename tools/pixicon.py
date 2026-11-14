# 도트 아이콘 엔진 (tools/make-icons.py 가 씀)
#   모양: 16칸 좌표계의 벡터 도형 / 재질: 어두움→밝음 5단 색 / 스타일 A = 밝은 플랫(같은 계열 진한 테두리)
#   필요: Python 3 + numpy + scipy + Pillow
import numpy as np
from scipy.ndimage import distance_transform_edt

def hx(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)

# ---------- 도형 (U,V 는 0..16 좌표 배열) ----------
def ell(cx, cy, rx, ry): return lambda U, V: ((U - cx) / rx) ** 2 + ((V - cy) / ry) ** 2 <= 1
def rect(x0, y0, x1, y1): return lambda U, V: (U >= x0) & (U < x1) & (V >= y0) & (V < y1)
def rrect(x0, y0, x1, y1, r):
    def f(U, V):
        cx = np.clip(U, x0 + r, x1 - r); cy = np.clip(V, y0 + r, y1 - r)
        return rect(x0, y0, x1, y1)(U, V) & ((U - cx) ** 2 + (V - cy) ** 2 <= r * r)
    return f
def poly(pts):
    P = np.array(pts, float)
    def f(U, V):
        ins = np.zeros(U.shape, bool)
        for i in range(len(P)):
            x1, y1 = P[i]; x2, y2 = P[(i + 1) % len(P)]
            c = ((y1 > V) != (y2 > V))
            with np.errstate(divide="ignore", invalid="ignore"):
                xi = (x2 - x1) * (V - y1) / (y2 - y1 + 1e-12) + x1
            ins ^= c & (U < xi)
        return ins
    return f
def line(x0, y0, x1, y1, w=1.0):
    def f(U, V):
        dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy
        t = np.clip(((U - x0) * dx + (V - y0) * dy) / L2, 0, 1)
        return (U - (x0 + t * dx)) ** 2 + (V - (y0 + t * dy)) ** 2 <= (w / 2) ** 2
    return f
def U_(*fs): return lambda U, V: np.logical_or.reduce([f(U, V) for f in fs])
def I_(a, b): return lambda U, V: a(U, V) & b(U, V)
def D_(a, *bs): return lambda U, V: a(U, V) & ~np.logical_or.reduce([b(U, V) for b in bs])
def rot(f, ang, cx=8, cy=8):
    c, s = np.cos(ang), np.sin(ang)
    return lambda U, V: f(cx + (U - cx) * c + (V - cy) * s, cy - (U - cx) * s + (V - cy) * c)
def gear(cx, cy, r_in, r_out, teeth, hole, tw=0.42):
    def f(U, V):
        dx, dy = U - cx, V - cy; r = np.hypot(dx, dy); a = np.arctan2(dy, dx)
        ph = (a * teeth / (2 * np.pi)) % 1.0
        tooth = (np.abs(ph - 0.5) < tw / 2 + 0.0) & (r <= r_out)
        return ((r <= r_in) | tooth) & (r >= hole)
    return f

def raster(f, N):
    g = (np.arange(N) + 0.5) * 16.0 / N
    U, V = np.meshgrid(g, g)
    return f(U, V)

# ---------- 재질 (어두움 → 밝음 5단) ----------
MAT = {
    "gold":   ["#6b3208", "#c0601a", "#f2a224", "#ffd447", "#fff6b4"],
    "wood":   ["#34140a", "#6a2a14", "#97441f", "#c0652f", "#e08e52"],
    "dwood":  ["#140604", "#24100a", "#381a0e", "#4c2614", "#60341c"],
    "steel":  ["#1e222c", "#464e60", "#7a8496", "#b6bfce", "#f0f4fa"],
    "blue":   ["#0b2554", "#1b55a6", "#3592d8", "#6cc8f2", "#d2f4ff"],
    "cyan":   ["#0a4566", "#1a8cc0", "#3ccaf2", "#96eeff", "#ffffff"],
    "ruby":   ["#480a18", "#991830", "#e23448", "#ff7c8c", "#ffd4dc"],
    "emer":   ["#08382a", "#12806a", "#22c4a2", "#78f2d4", "#e2fff6"],
    "amet":   ["#2a0a4a", "#5c1c9c", "#8c40da", "#c486ff", "#f2e0ff"],
    "burlap": ["#4a280e", "#8c5426", "#c48446", "#e4b47a", "#faE4bc"],
    "leath":  ["#3a180a", "#703416", "#a45a2a", "#cc7e40", "#ecae6c"],
    "redcan": ["#3c0808", "#841a16", "#d43226", "#ff6c4e", "#ffc6ae"],
    "paper":  ["#3a4a3a", "#6e8a6c", "#a6c2a0", "#d4e8cc", "#f4fff0"],
    "mith":   ["#0e4a46", "#1f8f86", "#4ed8c4", "#a8fff0", "#ffffff"],
    "fire":   ["#7a1a00", "#d0420a", "#ff8a1f", "#ffd04a", "#fff6c0"],
    "rubber": ["#121418", "#24282f", "#3a404c", "#565e6c", "#7a8292"],
    "glass":  ["#0a4566", "#1a8cc0", "#5ed6f6", "#b8f4ff", "#ffffff"],
    "glow":   ["#8a5a00", "#e0a010", "#ffe066", "#fff6b0", "#ffffff"],
    "scroll": ["#5a4020", "#a07a40", "#e6cc90", "#f6e6bc", "#fffaf0"],
    "leaf":   ["#0a3a1a", "#1b8f50", "#3ddc84", "#a0f0b8", "#e8fff0"],
    "ice":    ["#1a4a7a", "#3a8ad8", "#8ad0ff", "#d0f0ff", "#ffffff"],
}

# ---------- 레이어 ----------
# L(shape, mat, kind, **opt)  kind: dome(둥근 명암) / flat(면) / inset(파인 면) / fix(고정 톤)
def L(shape, mat, kind="dome", tone=2, sep=True, spec=(), rr=3.0, rim=True):
    return dict(shape=shape, mat=mat, kind=kind, tone=tone, sep=sep, spec=spec, rr=rr, rim=rim)

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32

def sh(a, dy, dx):
    """a 를 (dy,dx) 만큼 민 배열 (밖은 False/0)"""
    out = np.zeros_like(a)
    H, W = a.shape
    ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[ys, xs] = a[yd, xd]
    return out

LIGHT = np.array([-0.55, -0.68, 0.48]); LIGHT = LIGHT / np.linalg.norm(LIGHT)

def tone_map(M, lay, N, style):
    k = lay["kind"]; T = np.full(M.shape, float(lay["tone"]))
    up_out = M & ~sh(M, 1, 0); left_out = M & ~sh(M, 0, 1)
    dn_out = M & ~sh(M, -1, 0); rt_out = M & ~sh(M, 0, -1)
    if k == "dome":
        d = distance_transform_edt(M)
        R = lay["rr"] * N / 16
        dc = np.minimum(d, R)
        h = np.sqrt(np.maximum(R * R - (R - dc) ** 2, 0))
        gy, gx = np.gradient(h)
        n = np.stack([-gx, -gy, np.ones_like(h) * 1.0], -1)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        dot = n @ LIGHT
        T = lay["tone"] + (dot - LIGHT[2]) * 3.2
    elif k in ("flat", "inset") and lay["rim"]:
        s = 1 if k == "flat" else -1
        T = T + s * (up_out | left_out) * 1.0 - s * (dn_out | rt_out) * 1.0
    return T

def quant(T, style, N):
    if style == "D":
        f = np.clip(T, 0, 4); b = np.floor(f); fr = f - b
        H, W = T.shape
        th = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
        mid = (fr > 0.3) & (fr < 0.7)
        return np.where(mid, b + (fr > th), np.round(f)).clip(0, 4).astype(int)
    if style == "A":   # 레퍼런스1: 밝고 평평하게 (그림자 적고 밝은 면 넓게)
        return np.clip(np.round(T + 0.45), 2, 4).astype(int)
    if style == "B":   # 레퍼런스2: 명암 대비를 크게
        return np.clip(np.round(2 + (T - 2) * 1.35), 0, 4).astype(int)
    if style == "C":   # 로고처럼 면을 크게: 기본·그림자 2단 + 흰 하이라이트는 따로
        return np.where(T < 1.6, 1, np.where(T > 3.3, 3, 2)).astype(int)
    return np.clip(np.round(T), 0, 4).astype(int)

def render(layers, N=16, style="B", sparkles=(), bg=None):
    H = W = N
    rgb = np.zeros((H, W, 3), np.uint8); alpha = np.zeros((H, W), bool)
    lid = np.full((H, W), -1)
    masks = []
    for i, lay in enumerate(layers):
        M = raster(lay["shape"], N); masks.append(M)
        ramp = [hx(c) for c in MAT[lay["mat"]]]
        T = quant(tone_map(M, lay, N, style), style, N)
        if lay["kind"] == "fix": T = np.full(M.shape, lay["tone"])
        for t in range(5):
            sel = M & (T == t); rgb[sel] = ramp[t]
        # 다른 레이어 위에 얹힌 경계: 구분선
        if lay["sep"] and i > 0:
            under = alpha & ~M
            edge = M & (sh(under, 1, 0) | sh(under, -1, 0) | sh(under, 0, 1) | sh(under, 0, -1))
            if style == "C": rgb[edge] = (12, 12, 16)
            elif style == "A": rgb[edge] = ramp[1]
            else: rgb[edge] = ramp[0]
        alpha |= M; lid[M] = i
        # C: 로고처럼 왼쪽 위 흰 띠
        if style == "C" and lay["kind"] != "fix" and M.sum() > N * N * 0.06:
            inner = M & ~(sh(~M, 1, 0) | sh(~M, 0, 1))  # 경계 바로 안쪽 한 칸 더
            topleft = M & ~sh(M, 2, 0) & sh(M, 1, 0) | M & ~sh(M, 0, 2) & sh(M, 0, 1)
            rgb[topleft & ~(M & ~sh(M, 1, 0)) & ~(M & ~sh(M, 0, 1))] = ramp[4] if lay["mat"] != "steel" else hx("#ffffff")
        for (sx, sy) in lay["spec"]:
            px, py = int(sx * N / 16), int(sy * N / 16)
            if 0 <= px < W and 0 <= py < H and M[py, px]:
                c = hx("#ffffff") if style in ("C", "D") else ramp[4]
                rgb[py, px] = c
                if N >= 32 and px + 1 < W and M[py, px + 1]: rgb[py, px + 1] = ramp[4]
    # 바깥 외곽선
    out = ~alpha & (sh(alpha, 1, 0) | sh(alpha, -1, 0) | sh(alpha, 0, 1) | sh(alpha, 0, -1))
    if style in ("C",):
        out |= ~alpha & (sh(alpha, 1, 1) | sh(alpha, -1, -1) | sh(alpha, 1, -1) | sh(alpha, -1, 1)) & False
    nb = np.maximum.reduce([sh(lid, 1, 0), sh(lid, -1, 0), sh(lid, 0, 1), sh(lid, 0, -1)])
    for y, x in zip(*np.nonzero(out)):
        j = nb[y, x]
        # 이웃 레이어 재질 (가장 위 레이어)
        cand = [lid[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < H and 0 <= xx < W and lid[yy, xx] >= 0]
        ramp = [hx(c) for c in MAT[layers[max(cand)]["mat"]]]
        if style == "C": c = (12, 12, 16)
        elif style == "A": c = ramp[1] * 0.92
        elif style == "D":
            lit = (y + 1 < H and lid[y + 1, x] >= 0) or (x + 1 < W and lid[y, x + 1] >= 0)
            c = ramp[1] * 0.8 if lit and not ((y - 1 >= 0 and lid[y - 1, x] >= 0) or (x - 1 >= 0 and lid[y, x - 1] >= 0)) else ramp[0] * 0.75
        else: c = ramp[0] * 0.55
        rgb[y, x] = np.array(c).astype(np.uint8); alpha[y, x] = True
    # 반짝이(+ 모양)
    if style in ("B", "D"):
        for (sx, sy, r) in sparkles:
            px, py = int(sx * N / 16), int(sy * N / 16); rr = max(1, int(r * N / 16))
            for k in range(-rr, rr + 1):
                for (yy, xx) in ((py + k, px), (py, px + k)):
                    if 0 <= yy < H and 0 <= xx < W and not alpha[yy, xx] or (0 <= yy < H and 0 <= xx < W and lid[yy, xx] == -1):
                        rgb[yy, xx] = hx("#fff3b0") if abs(k) < rr else hx("#e0a030"); alpha[yy, xx] = True
    img = np.zeros((H, W, 4), np.uint8); img[..., :3] = rgb; img[..., 3] = alpha * 255
    return img
