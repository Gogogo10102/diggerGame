// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../systems/update.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { S } from "../core/state.ts";

// =====================================================================
//  렌더링 도우미
// =====================================================================
export const cv = document.getElementById("c");
export const ctx = cv.getContext("2d");
export const gridCv = document.createElement("canvas"); gridCv.width = gridCv.height = 1;   // 칸 하나 = 1px 밝기 지도
export const gg = gridCv.getContext("2d");
S.gridImg = gg.createImageData(1, 1); S.skyL = new Float32Array(1);
export const lightCv = document.createElement("canvas");
export const lg = lightCv.getContext("2d");
export function resize() {
  cv.width = Math.max(1, innerWidth || document.documentElement.clientWidth || 1); cv.height = Math.max(1, innerHeight || document.documentElement.clientHeight || 1);
}
addEventListener("resize", resize); resize();
// ---- 글꼴 ----
// 도트 글꼴은 "설계한 크기의 정수배"로 써야 픽셀이 또렷합니다. 그래서 크기를 세 단계로만 씁니다.
//   작은 글씨 12px  → 갈무리11 (12px 설계)
//   기본 글씨 16px  → Neo둥근모 (16px 설계)
//   큰 글씨 32/48px → Neo둥근모 2배/3배
// txt()에 다른 크기를 넘겨도 가장 가까운 단계로 맞춰집니다(14 → 16, 28 → 32 …).
export const FONT_M = "'NeoDunggeunmo','Galmuri11','Apple SD Gothic Neo','Malgun Gothic',monospace";
export const FONT_S = "'Galmuri11','NeoDunggeunmo','Apple SD Gothic Neo','Malgun Gothic',monospace";
export const FONT = FONT_M;                                    // 예전 코드 호환용
export function fontPx(size) { return !size ? 16 : size <= 12 ? 12 : size < 24 ? 16 : size < 40 ? 32 : 48; }
export function setFont(size) { const px = fontPx(size); ctx.font = px + "px " + (px === 12 ? FONT_S : FONT_M); return px; }
try { document.fonts.load("16px NeoDunggeunmo"); document.fonts.load("12px Galmuri11"); } catch (e) {}

export function txt(s: string, x: number, y: number, col?: string, size?: number, align?: CanvasTextAlign, shadow?: string) {
  align = align || "left";
  size = setFont(size);
  ctx.textAlign = align; ctx.textBaseline = "top";
  const o = size >= 32 ? 2 : 1;
  ctx.fillStyle = shadow || "#14151f"; ctx.fillText(s, Math.round(x) + o, Math.round(y) + o);
  ctx.fillStyle = col || "#fff"; ctx.fillText(s, Math.round(x), Math.round(y));
}
// ---- 안전 노랑 UI 색 (docs/decisions.md "UI 스타일") ----
//   숯색 철판 + 공사장 노랑. 1칸 = 2px (그림 1픽셀을 2배로 그린 크기)
export const SY = {
  ink: "#0b0c0f", body: "#2a2e37", hi: "#3c424e", lo: "#1a1d23",
  well: "#1d2027", wellDk: "#111317", wellLt: "#3a404c", row: "#262a32", row2: "#22252d",
  y: "#ffc21a", yHi: "#ffe27a", yLo: "#c48600", yDk: "#e0a400",
  txt: "#f2f4f8", dim: "#98a0b2", mute: "#6a7080", gold: "#ffc21a", red: "#ff7a6a", green: "#8ee05a", blue: "#6cc8f2", warn: "#ff9a5a",
};
// 모서리를 1칸 깎은 상자 (도트 느낌의 둥근 모서리)
export function pxBox(x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col; ctx.fillRect(x + 2, y, w - 4, h); ctx.fillRect(x, y + 2, w, h - 4);
}
// 창 · 카드: 검은 테두리 + 짙은 철판(빛 받는 위·왼쪽 테, 그늘진 아래·오른쪽 테) + 큰 판은 모서리 리벳
export function panel(x: number, y: number, w: number, h: number, fill?: string) {
  x |= 0; y |= 0; w |= 0; h |= 0;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 4, y + h, w - 4, 4);
  pxBox(x, y, w, h, SY.ink);
  ctx.fillStyle = fill || SY.body; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(x + 2, y + 2, w - 4, 2); ctx.fillRect(x + 2, y + 4, 2, h - 8);
  ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x + 2, y + h - 6, w - 4, 4); ctx.fillRect(x + w - 4, y + 4, 2, h - 10);
  if (w >= 160 && h >= 120 && !fill) { rivet(x + 6, y + h - 16); rivet(x + w - 12, y + h - 16); }   // 아래 모서리 리벳 (위는 머리띠가 덮음)
}
// 안쪽으로 파인 칸 (목록 판, 아이콘 칸)
export function well(x: number, y: number, w: number, h: number, fill?: string) {
  ctx.fillStyle = SY.ink; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = fill || SY.well; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = SY.wellDk; ctx.fillRect(x, y, w, 2);
}
// 경고 줄무늬 (노랑/검정 빗금). 같은 크기는 한 번 그려 두고 재사용
const HAZ_CACHE: Record<string, HTMLCanvasElement> = {};
export function hazard(x: number, y: number, w: number, h: number, a?: string, b?: string) {
  w |= 0; h |= 0; if (w <= 0 || h <= 0) return;
  const key = w + "x" + h + (a || "") + (b || "");
  let cv2 = HAZ_CACHE[key];
  if (!cv2) {
    cv2 = document.createElement("canvas"); cv2.width = w; cv2.height = h;
    const g = cv2.getContext("2d");
    if (g) for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) {
      g.fillStyle = (((xx + yy) >> 3) & 1) ? (b || "#1a1a1a") : (a || SY.y); g.fillRect(xx, yy, 2, 2);
    }
    HAZ_CACHE[key] = cv2;
  }
  ctx.drawImage(cv2, x | 0, y | 0);
}
// 칸 막대 (연료·화물·단계·소리 크기): 칸마다 위 밝음 / 가운데 / 아래 어두움 3단. 빈 칸은 회색
//   kind: fuel 주황 · low 빨강 · cargo 파랑 · lv 초록 · xp 보라
export const SEG_COL = {
  fuel: ["#ffe066", "#f8a430", "#d0621e"], low: ["#ffb4a4", "#f0503a", "#a01e16"], cargo: ["#b4f0ff", "#46b8f0", "#1a76c4"],
  lv: ["#c8f690", "#7cd84a", "#3e9a2a"], xp: ["#e6d0ff", "#b58cff", "#6a3ec4"], empty: ["#a8a8a8", "#8c8c8c", "#6a6a6a"],
};
export function segBar(x: number, y: number, n: number, filled: number, kind: string, sw?: number, h?: number) {
  sw = sw || 10; h = h || 20;
  const u = h >= 16 ? 2 : 1, W2 = n * sw + 2;
  ctx.fillStyle = SY.ink; ctx.fillRect(x, y, W2, h);
  for (let i = 0; i < n; i++) {
    const c = i < filled ? SEG_COL[kind] : SEG_COL.empty, sx = x + 2 + i * sw, iw = sw - 2;
    ctx.fillStyle = c[1]; ctx.fillRect(sx, y + 2, iw, h - 4);
    ctx.fillStyle = c[0]; ctx.fillRect(sx, y + 2, iw, 2 * u);
    ctx.fillStyle = c[2]; ctx.fillRect(sx, y + h - 2 - 2 * u, iw, 2 * u);
  }
  return W2;
}
// 예전 막대(가로로 차오름) — 칸 막대 모양으로 그림
export function pbar(x, y, w, h, ratio, col, hi) {
  ctx.fillStyle = SY.ink; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#8c8c8c"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const fw = Math.floor((w - 4) * Math.max(0, Math.min(1, ratio)));
  ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, fw, h - 4);
  ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 2, fw, 2);
  ctx.fillStyle = SY.ink;
  for (let i = x + 12; i < x + w - 2; i += 10) ctx.fillRect(i, y + 2, 2, h - 4);
}
export function keycap(x, y, label) {
  pxBox(x, y, 26, 26, SY.ink);
  ctx.fillStyle = "#5a6070"; ctx.fillRect(x + 2, y + 2, 22, 22);
  ctx.fillStyle = "#c6cedc"; ctx.fillRect(x + 2, y + 2, 22, 18);
  txt(label, x + 13, y + 3, SY.ink, 14, "center", "rgba(0,0,0,0)");
}
// 7x7 글리프(# = 칠함)를 2배로 그림. 버튼 안 기호(X, 화살표 등)
export const GLYPH = {
  x: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"],
  left: ["...#...", "..##...", ".######", "#######", ".######", "..##...", "...#..."],
  right: ["...#...", "...##..", "######.", "#######", "######.", "...##..", "...#..."],
  minus: [".......", ".......", ".......", "#######", ".......", ".......", "......."],
  plus: ["...#...", "...#...", "...#...", "#######", "...#...", "...#...", "...#..."],
  bag: ["..###..", ".#...#.", "#######", "#.....#", "#..#..#", "#.....#", "#######"],
  trophy: ["#######", "#.###.#", ".#####.", "..###..", "...#...", "..###..", ".#####."],
  menu: ["#######", ".......", ".......", "#######", ".......", ".......", "#######"],
};
export function glyph(g: string[], x: number, y: number, col: string, k?: number) {
  k = k || 2; ctx.fillStyle = col;
  for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === "#") ctx.fillRect(x + i * k, y + j * k, k, k);
}
// 버튼 색 (레퍼런스 버튼표): 테두리 · 아래 턱 · 몸통 · 윗빛 · 글자
//   초록 = 진행·구매 / 파랑 = 저장·정보 / 주황 = 설정·메뉴 / 빨강 = 닫기·뒤로 / 회색 = 못 누름
export const BTN_PAL = {
  green: ["#2c6a22", "#5aa83a", "#8ee05a", "#c4f690", "#1f5418"], blue: ["#0e4f86", "#1a86c4", "#40c4f0", "#a8eeff", "#0b3f6c"],
  orange: ["#94400a", "#e0780e", "#ffa82a", "#ffd684", "#7a3006"], red: ["#84182a", "#c43a4c", "#f2606e", "#ffb0b8", "#6e1222"],
  steel: ["#3e4552", "#788294", "#a6aebc", "#d6dce6", "#3e4552"],
};
// ---- 철판 버튼 (레퍼런스 MENU 판): 모든 버튼은 회색 철판 + 모서리 리벳, 뜻은 왼쪽 작은 색 띠와 글자로 ----
//   철판 색 5단: 반짝 · 밝음 · 몸 · 어둠(아래 턱) · 그늘
export const MT = { hi: "#f2f4f8", l: "#cdd2da", m: "#a9b0bc", d: "#7a8292", lo: "#545b68", txt: "#1b1d23", off: "#6a707c", eng: "#e4e8ee" };
// 리벳 하나 (6x6: 검은 테 · 밝은 머리 · 반짝 1칸)
export function rivet(x: number, y: number) {
  ctx.fillStyle = SY.ink; ctx.fillRect(x + 2, y, 2, 6); ctx.fillRect(x, y + 2, 6, 2);
  ctx.fillStyle = "#8a92a2"; ctx.fillRect(x + 2, y + 2, 2, 2);
  ctx.fillStyle = MT.hi; ctx.fillRect(x + 2, y + 2, 1, 1);
}
// 버튼 하나 그리기 (글자 위치 계산까지). 돌려주는 값: 글자를 놓을 가운데 y
//  col: green 진행·구매 / blue 저장·정보 / orange 설정·메뉴 / red 닫기·뒤로 / steel 못 누름(띠 없음)
export function btnPx(x: number, y: number, w: number, h: number, col: string, pressed?: boolean, noRivet?: boolean) {
  const c = BTN_PAL[col];
  let lip = h >= 34 ? 6 : 4;
  if (pressed) { y += lip - 2; h -= lip - 2; lip = 2; }
  pxBox(x, y, w, h, SY.ink);
  const ih = h - 4 - lip;
  ctx.fillStyle = MT.m; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = MT.l; ctx.fillRect(x + 2, y + 2, w - 4, Math.floor(ih / 2) & ~1);       // 위 절반은 밝게 (각진 그러데이션)
  ctx.fillStyle = MT.hi; ctx.fillRect(x + 4, y + 2, w - 8, 2); ctx.fillRect(x + 2, y + 4, 2, ih - 2);   // 빛 (위 · 왼쪽)
  ctx.fillStyle = MT.d; ctx.fillRect(x + w - 4, y + 4, 2, ih - 2);                          // 그늘 (오른쪽)
  ctx.fillStyle = MT.lo; ctx.fillRect(x + 2, y + h - 2 - lip, w - 4, lip);                  // 아래 턱
  ctx.fillStyle = MT.d; ctx.fillRect(x + 2, y + h - 2 - lip, w - 4, 2);
  if (c && col !== "steel" && w >= 64) {                                                    // 뜻을 알려 주는 왼쪽 띠
    ctx.fillStyle = SY.ink; ctx.fillRect(x + 4, y + 4, 8, ih - 4);
    ctx.fillStyle = c[2]; ctx.fillRect(x + 6, y + 6, 4, ih - 8);
    ctx.fillStyle = c[3]; ctx.fillRect(x + 6, y + 6, 4, 2);
  }
  if (h >= 34 && w >= 72 && !noRivet) {                                                     // 모서리 리벳 (아이콘이 들어가는 버튼은 끔)
    const rx0 = x + (c && col !== "steel" && w >= 64 ? 14 : 6), rx1 = x + w - 12, ry0 = y + 6, ry1 = y + h - lip - 12;
    rivet(rx0, ry0); rivet(rx1, ry0); rivet(rx0, ry1); rivet(rx1, ry1);
  }
  return y + (h - lip) / 2;
}
// 철판 버튼 위 글자: 진한 글자 + 아래 밝은 줄(파인 글씨처럼). on 이 아니면 흐린 회색
export function btnTxt(s: string, x: number, y: number, size?: number, on?: boolean, align?: CanvasTextAlign) {
  const sz = setFont(size || 16);
  ctx.textAlign = align || "center"; ctx.textBaseline = "top";
  ctx.fillStyle = MT.eng; ctx.fillText(s, Math.round(x), Math.round(y) + 1);
  ctx.fillStyle = on === false ? MT.off : MT.txt; ctx.fillText(s, Math.round(x), Math.round(y));
  return sz;
}
// 제목 글자 (레퍼런스 MENU 글씨): 굵은 검은 테두리 + 위 노랑 → 아래 주황 그러데이션 + 아래 그림자
export function titleTxt(s: string, x: number, y: number, size?: number, align?: CanvasTextAlign) {
  const sz = setFont(size || 16), o = sz >= 32 ? 3 : 2;
  ctx.textAlign = align || "left"; ctx.textBaseline = "top";
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = SY.ink;
  ctx.fillText(s, x + 1, y + o + 2);                                                        // 아래 그림자
  for (let dy = -o; dy <= o; dy += o) for (let dx = -o; dx <= o; dx += o) if (dx || dy) ctx.fillText(s, x + dx, y + dy);
  const g = ctx.createLinearGradient ? ctx.createLinearGradient(0, y, 0, y + sz) : null;
  if (g) { g.addColorStop(0, "#fff19a"); g.addColorStop(0.45, "#ffb52a"); g.addColorStop(0.55, "#ff9a1a"); g.addColorStop(1, "#e0520a"); }
  ctx.fillStyle = g || "#ffa82a";
  ctx.fillText(s, x, y);
  return sz;
}
// 작은 정보 판 (HUD 의 돈 · 깊이)
export function plate(x: number, y: number, w: number, h: number) {
  pxBox(x, y, w, h, SY.ink);
  ctx.fillStyle = SY.body; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = SY.hi; ctx.fillRect(x + 2, y + 2, w - 4, 2);
}
// 그림을 (w,h) 크기로 그림. 고해상도 그림을 더 작게 줄일 때만 부드럽게(이웃 픽셀만 고르면 선이 끊겨 보임), 키울 때는 도트 그대로
export function blit(img: HTMLCanvasElement | HTMLImageElement, x: number, y: number, w: number, h: number) {
  const down = img.width > w || img.height > h;
  if (down) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; }
  ctx.drawImage(img, x, y, w, h);
  if (down) ctx.imageSmoothingEnabled = false;
}
export function icon(img, x, y) { blit(img, Math.round(x), Math.round(y), 32, 32); }

