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
try { document.fonts.load("14px Galmuri14"); } catch (e) {}

export const FONT = "'Galmuri14','Galmuri11','Malgun Gothic',monospace";
export function txt(s, x, y, col, size, align, shadow) {
  size = size || 14; align = align || "left";
  ctx.font = size + "px " + FONT;
  ctx.textAlign = align; ctx.textBaseline = "top";
  const o = size >= 28 ? 2 : 1;
  ctx.fillStyle = shadow || "#14151f"; ctx.fillText(s, Math.round(x) + o, Math.round(y) + o);
  ctx.fillStyle = col || "#fff"; ctx.fillText(s, Math.round(x), Math.round(y));
}
export function panel(x, y, w, h, fill) {
  x |= 0; y |= 0; w |= 0; h |= 0;
  const u = 3;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + u, y + u * 2, w - 2 * u, h);
  ctx.fillStyle = "#14151f"; ctx.fillRect(x + u, y, w - 2 * u, h); ctx.fillRect(x, y + u, w, h - 2 * u);
  ctx.fillStyle = "#6b7399"; ctx.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  ctx.fillStyle = fill || "#2b2f45"; ctx.fillRect(x + 2 * u, y + 2 * u, w - 4 * u, h - 4 * u);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x + 2 * u, y + 2 * u, w - 4 * u, u);
}
export function pbar(x, y, w, h, ratio, col, hi) {
  ctx.fillStyle = "#14151f"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3a3f58"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const fw = Math.floor((w - 4) * Math.max(0, Math.min(1, ratio)));
  ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, fw, h - 4);
  ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 2, fw, 2);
  ctx.fillStyle = "rgba(20,21,31,0.5)";
  for (let i = x + 12; i < x + w - 2; i += 10) ctx.fillRect(i, y + 2, 2, h - 4);
}
export function keycap(x, y, label) {
  ctx.fillStyle = "#14151f"; ctx.fillRect(x, y, 26, 26);
  ctx.fillStyle = "#7a82a6"; ctx.fillRect(x + 2, y + 2, 22, 22);
  ctx.fillStyle = "#d7dcf0"; ctx.fillRect(x + 2, y + 2, 22, 18);
  txt(label, x + 13, y + 3, "#14151f", 14, "center", "rgba(0,0,0,0)");
}
export function icon(img, x, y) { ctx.drawImage(img, Math.round(x), Math.round(y), 32, 32); }

