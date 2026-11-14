// 미니맵 + 큰 지도
import "./townUI.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { H, LAYERS, SURF, T, W, BUILD_COLS, layerOf } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { isGen, seen, tiles } from "../core/world.ts";
import { ctx, panel, txt } from "./util.ts";
import { uiBtn } from "./townUI.ts";
import { shopBtn, touch } from "../systems/input.ts";

// =====================================================================
//  미니맵(화면 오른쪽 위) + 큰 지도(M 키 / 미니맵 누르기)
//   - 한 번 본 칸(seen)만 보여 줌. 안 본 곳은 검정
//   - 칸 하나 = 점 하나로 그린 뒤 정수 배율로 키움
// =====================================================================

// 칸 종류 → 지도 색. 광물이 어디 있는지는 알려 주지 않고 '지나갈 수 있는 길'만 대충 보여 줌
//   빈칸(판 굴·동굴)·지지대 = 밝은 길 색 / 그 밖의 막힌 칸(흙·광물·돌·암반)은 모두 지층 색을 어둡게 한 한 가지 색
const MAP_RGB = (hex: string): number[] => { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const MAP_PACK = ([r, g, b]: number[]): number => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;   // 리틀엔디언 RGBA
export const MAP_UNSEEN = MAP_PACK([7, 7, 11]), MAP_SKY = MAP_PACK([106, 166, 224]), MAP_PATH = MAP_PACK([214, 196, 160]);
export const MAP_LUT = (() => {
  const lut = new Uint32Array(LAYERS.length * 256);
  LAYERS.forEach((L, li) => {
    const rock = MAP_PACK(MAP_RGB(L.base).map((v) => Math.round(v * 0.55)));
    for (let id = 0; id < 256; id++) lut[li * 256 + id] = id === 0 || id === 14 || id === 15 ? MAP_PATH : rock;
  });
  return lut;
})();
// 칸 하나의 지도 색
export function mapColor(c: number, r: number): number {
  if (c < 0 || c >= W || r < 0 || r >= H) return MAP_UNSEEN;
  if (r < SURF) return MAP_SKY;
  const i = r * W + c;
  if (!seen[i] || !isGen(c, r)) return MAP_UNSEEN;
  return MAP_LUT[layerOf(r - SURF) * 256 + tiles[i]];
}
// (c0, r0)부터 tw x th 칸을 캔버스에 칸당 1점으로 그림
type MapCanvas = HTMLCanvasElement & { _img?: ImageData | null };
function paintMap(cv: MapCanvas, c0: number, r0: number, tw: number, th: number) {
  if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; cv._img = null; }
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  if (!cv._img) cv._img = g.createImageData(tw, th);
  const img = cv._img, data = img.data, u32 = data.buffer ? new Uint32Array(data.buffer) : null;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const v = mapColor(c0 + x, r0 + y);
    if (u32) u32[y * tw + x] = v;
    else { const k = (y * tw + x) * 4; data[k] = v & 255; data[k + 1] = (v >>> 8) & 255; data[k + 2] = (v >>> 16) & 255; data[k + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------
//  미니맵: 주변 64 x 48칸을 2배로
// ---------------------------------------------------------------------
export const MINI = { tw: 64, th: 48, s: 2 };
export const miniCv: MapCanvas = document.createElement("canvas");
S.miniBtn = null; S.mapRect = null;
export function drawMinimap(vw: number, vh: number, by: number) {
  S.miniBtn = null;
  if (S.state !== "play") return;
  const iw = MINI.tw * MINI.s, ih = MINI.th * MINI.s, pw = iw + 12, ph = ih + 12;
  let x = vw - 10 - 36 - 8 - pw, y = by;
  if (x < 290) { y = 130; x = vw - 10 - 36 - 8 - pw; }                 // 좁은 화면: 왼쪽 위 상태 카드와 겹치지 않게 그 아래로
  if (x < 10 || y + ph + 20 > vh - 120) return;                          // 너무 작은 화면이면 생략
  const pc = Math.floor(P.x / T), pr = Math.floor(P.y / T);
  const c0 = pc - (MINI.tw >> 1), r0 = pr - (MINI.th >> 1);
  panel(x, y, pw, ph);
  paintMap(miniCv, c0, r0, MINI.tw, MINI.th);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(miniCv, x + 6, y + 6, iw, ih);
  // 마을 위치 표시(화면 안에 있으면)
  const tx = (BUILD_COLS[0][0] + 1 - c0) * MINI.s, ty = (SURF - 1 - r0) * MINI.s;
  if (tx >= 0 && tx < iw && ty >= 0 && ty < ih) { ctx.fillStyle = "#ffd34d"; ctx.fillRect(x + 6 + tx, y + 6 + ty - 2, (BUILD_COLS[BUILD_COLS.length - 1][1] - BUILD_COLS[0][0] - 1) * MINI.s, 2); }
  // 나 (깜빡임)
  const on = ((S.animT * 3) | 0) % 2 === 0;
  ctx.fillStyle = "#14151f"; ctx.fillRect(x + 6 + (MINI.tw >> 1) * MINI.s - 2, y + 6 + (MINI.th >> 1) * MINI.s - 2, 6, 6);
  ctx.fillStyle = on ? "#ffd34d" : "#fff3a8"; ctx.fillRect(x + 6 + (MINI.tw >> 1) * MINI.s - 1, y + 6 + (MINI.th >> 1) * MINI.s - 1, 4, 4);
  if (!S.usedTouch) txt("M 지도", x + pw - 6, y + ph + 3, "#9aa3c8", 12, "right");
  S.miniBtn = { x, y, w: pw, h: ph };
}

// ---------------------------------------------------------------------
//  큰 지도 (게임 멈춤). 드래그·방향키로 이동, +/- 또는 휠로 확대
// ---------------------------------------------------------------------
export const MAP_SCALES = [1, 2, 3, 4, 6, 8];
export const bigCv: MapCanvas = document.createElement("canvas");
S.mapView = { cx: 0, cy: 0, si: 3, drag: null };
export function openMap() {
  if (S.state !== "play" || P.dead > 0) return;
  S.state = "map";
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
  S.mapView.cx = P.x / T; S.mapView.cy = P.y / T; S.mapView.drag = null;
  if (S.usedTouch && S.mapView.si > 2) S.mapView.si = 2;
}
export function closeMap() { if (S.state === "map") S.state = "play"; S.mapView.drag = null; }
export function mapZoom(d: number) { S.mapView.si = Math.max(0, Math.min(MAP_SCALES.length - 1, S.mapView.si + d)); }
export function mapPan(dc: number, dr: number) {
  const v = S.mapView;
  v.cx = Math.max(0, Math.min(W, v.cx + dc)); v.cy = Math.max(0, Math.min(H, v.cy + dr));
}
// 지도 화면의 구역(머리글 아래)
function mapArea(vw: number, vh: number) {
  const x = 12, y = 12 + 52, w = vw - 24, h = vh - 24 - 52;
  return { x, y, w, h };
}
export function drawMapModal(vw: number, vh: number) {
  ctx.fillStyle = "rgba(14,15,23,0.92)"; ctx.fillRect(0, 0, vw, vh);
  const v = S.mapView, s = MAP_SCALES[v.si], A = mapArea(vw, vh);
  // 머리글
  panel(8, 8, vw - 16, vh - 16);
  txt("지도", 24, 24, "#ffd34d", 16);
  const depth = Math.max(0, Math.floor(P.y / T - SURF) + 1);
  const info = "지금 " + depth + "m · 가장 깊이 " + Math.floor(S.acct ? S.acct.stats.maxDepth : 0) + "m";
  if (vw >= 600) txt(info, 80, 26, "#9aa3c8", 12);
  else txt(info, 24, vh - 30, "#9aa3c8", 12);                                 // 좁은 화면은 버튼과 겹치지 않게 아래로
  const bx = vw - 20 - 40;
  uiBtn(bx, 16, 40, 36, "X", null, "danger", true, "mclose");
  uiBtn(bx - 46, 16, 40, 36, "+", null, "plain", v.si < MAP_SCALES.length - 1, "mzoom", 1);
  uiBtn(bx - 92, 16, 40, 36, "-", null, "plain", v.si > 0, "mzoom", -1);
  uiBtn(bx - 92 - 6 - 84, 16, 84, 36, "내 위치", null, "plain", true, "mhome");
  // 지도 본문
  const tw = Math.ceil(A.w / s), th = Math.ceil(A.h / s);
  const c0 = Math.floor(v.cx - tw / 2), r0 = Math.floor(v.cy - th / 2);
  ctx.fillStyle = "#07070b"; ctx.fillRect(A.x, A.y, A.w, A.h);
  paintMap(bigCv, c0, r0, tw, th);
  ctx.save();
  ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bigCv, A.x, A.y, tw * s, th * s);
  // 깊이 눈금 (100m마다) + 지층 이름
  const step = s >= 4 ? 50 : s >= 2 ? 100 : 200;
  for (let d = 0; d < H - SURF; d += step) {
    const yy = A.y + (SURF + d - r0) * s;
    if (yy < A.y || yy > A.y + A.h) continue;
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(A.x, yy, A.w, 1);
    txt(d + "m", A.x + 6, yy + 2, "#c9cfe6", 12);
  }
  for (const L of LAYERS) {
    const yy = A.y + (SURF + L.from - r0) * s;
    if (yy < A.y - 4 || yy > A.y + A.h - 14) continue;
    txt(L.name, A.x + A.w - 8, yy + 2, "#ffd34d", 12, "right");
  }
  // 마을
  const mx = A.x + (BUILD_COLS[0][0] - c0) * s, my = A.y + (SURF - r0) * s;
  if (my > A.y && my < A.y + A.h) {
    ctx.fillStyle = "#ffd34d"; ctx.fillRect(mx, my - Math.max(2, s), (BUILD_COLS[BUILD_COLS.length - 1][1] - BUILD_COLS[0][0] + 1) * s, Math.max(2, s));
    txt("마을", mx, my - Math.max(2, s) - 16, "#ffd34d", 12);
  }
  // 나
  const px = A.x + (P.x / T - c0) * s, py = A.y + (P.y / T - r0) * s, on = ((S.animT * 3) | 0) % 2 === 0;
  const ps = Math.max(4, s * 1.5) | 0;
  ctx.fillStyle = "#14151f"; ctx.fillRect(px - ps / 2 - 1, py - ps / 2 - 1, ps + 2, ps + 2);
  ctx.fillStyle = on ? "#ffd34d" : "#fff3a8"; ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
  ctx.restore();
  ctx.fillStyle = "#14151f"; ctx.fillRect(A.x - 2, A.y - 2, A.w + 4, 2); ctx.fillRect(A.x - 2, A.y + A.h, A.w + 4, 2);
  if (!S.usedTouch) txt("드래그·방향키 이동 · +/- 확대 · M/Esc 닫기", vw - 20, vh - 30, "#9aa3c8", 12, "right");
  else txt("드래그로 이동", vw - 20, vh - 30, "#9aa3c8", 12, "right");
  S.mapRect = A;
}
// 지도 화면 입력
export function mapKey(e: KeyboardEvent) {
  if (e.code === "Escape" || e.code === "KeyM") { if (!e.repeat) closeMap(); return; }
  const st = 8 / Math.max(1, MAP_SCALES[S.mapView.si] / 2);
  if (e.code === "ArrowLeft" || e.code === "KeyA") mapPan(-st, 0);
  else if (e.code === "ArrowRight" || e.code === "KeyD") mapPan(st, 0);
  else if (e.code === "ArrowUp" || e.code === "KeyW") mapPan(0, -st);
  else if (e.code === "ArrowDown" || e.code === "KeyS") mapPan(0, st);
  else if (e.code === "Equal" || e.code === "NumpadAdd") mapZoom(1);
  else if (e.code === "Minus" || e.code === "NumpadSubtract") mapZoom(-1);
  else if (e.code === "Space" || e.code === "KeyH") { S.mapView.cx = P.x / T; S.mapView.cy = P.y / T; }
}
export function mapPointerDown(x: number, y: number, id: number) {
  for (const b of shopBtn) {
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    if (b.act === "mclose") closeMap();
    else if (b.act === "mzoom") mapZoom(b.arg);
    else if (b.act === "mhome") { S.mapView.cx = P.x / T; S.mapView.cy = P.y / T; }
    return;
  }
  S.mapView.drag = { id, x, y };
}
export function mapPointerMove(x: number, y: number, id: number) {
  const d = S.mapView.drag;
  if (!d || d.id !== id) return;
  const s = MAP_SCALES[S.mapView.si];
  mapPan(-(x - d.x) / s, -(y - d.y) / s);
  d.x = x; d.y = y;
}
export function mapPointerUp(id: number) { if (S.mapView.drag && S.mapView.drag.id === id) S.mapView.drag = null; }
