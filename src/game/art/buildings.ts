// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../data/consumables.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ITEM_ICON } from "./itemIcons.ts";
import { ICON, art, sprite } from "./sprites.ts";
import { S } from "../core/state.ts";

// ---- 건물 ----
// 실제 그림은 public/assets/buildings/*.png (tools/make-buildings.py 로 그림). 아래 코드 그림은 PNG를 못 불러올 때만 쓰는 예비용
// 움직이는 부분(굴뚝 연기, 대장간 불빛, 용광로 불·쇳물)의 위치: 그림 좌표(왼쪽 위 0,0). 그림 크기가 이와 같을 때만 그림
export const BLD_FX = {
  shop: { w: 112, h: 80, smoke: [90, 0] },
  craft: { w: 112, h: 80, smoke: [21, 0], forge: [9, 50, 38, 22] },
  furnace: { w: 80, h: 96, smoke: [40, 0], mouth: [26, 58, 28, 30], trough: [54, 83, 12, 2] },
};
export function brickFill(p, x, y, w, h, base, hi, mortar) {
  p(x, y, w, h, base);
  let j = 0;
  for (let yy = y; yy < y + h; yy += 4, j++) {
    p(x, yy, w, 1, mortar);
    const off = (j % 2) * 4;
    for (let xx = x + off; xx < x + w; xx += 8) p(xx, yy, 1, Math.min(4, y + h - yy), mortar);
    for (let xx = x + off + 2; xx < x + w - 3; xx += 8) if (art() < 0.55) p(xx, yy + 1, 3, 1, hi);
  }
}
export function winPane(p, x, y, w, h) {
  p(x - 1, y - 1, w + 2, h + 2, "#14151f"); p(x, y, w, h, "#7fc4e8"); p(x, y, w, 3, "#cdf3ff");
  p(x + (w >> 1), y, 1, h, "#14151f"); p(x, y + (h >> 1), w, 1, "#14151f");
  p(x + 1, y + 4, 2, 1, "#fff"); p(x - 2, y + h + 1, w + 4, 2, "#5e3b25"); p(x - 2, y + h + 1, w + 4, 1, "#a8704a");
}
export function buildItemShop() {
  return sprite(112, 64, (p, g) => {
    g.imageSmoothingEnabled = false;
    // 박공 지붕
    for (let y = 3; y < 21; y++) {
      const inset = (20 - y) * 2 + 2, row = y - 3;
      p(4 + inset, y, 104 - inset * 2, 1, row % 4 < 2 ? "#3f8de0" : "#2e6fb5");
      p(4 + inset, y, 1, 1, "#1c4373"); p(107 - inset, y, 1, 1, "#1c4373");
      if (row % 4 === 0) p(5 + inset, y, 102 - inset * 2, 1, "#6fb0ff");
      for (let x = 6 + inset + (row % 2) * 4; x < 106 - inset; x += 8) p(x, y, 1, 1, "#1c4373");
    }
    p(2, 21, 108, 2, "#1c4373"); p(2, 21, 108, 1, "#6fb0ff");
    p(54, 1, 4, 3, "#ffd34d"); p(55, 0, 2, 1, "#fff3a8");                      // 지붕 장식
    // 나무 벽
    p(6, 23, 100, 37, "#b9855a");
    for (let x = 6; x < 106; x += 6) { p(x, 23, 1, 37, "#8a5a3c"); p(x + 2, 23, 1, 37, "#d4a574"); }
    p(6, 54, 100, 6, "#7d8794"); for (let x = 6; x < 106; x += 8) p(x, 54, 1, 6, "#4a505c"); p(6, 54, 100, 1, "#a0a9b8"); p(6, 57, 100, 1, "#4a505c");
    // 걸이 간판
    p(34, 22, 44, 10, "#14151f"); p(35, 23, 42, 8, "#5e3b25"); p(35, 23, 42, 1, "#a8704a"); p(35, 30, 42, 1, "#3a2414");
    p(38, 20, 1, 3, "#8b93a6"); p(73, 20, 1, 3, "#8b93a6");
    // 차양 + 진열창
    for (const wx of [8, 72]) {
      for (let x = wx; x < wx + 32; x += 4) {
        const c = ((x - wx) >> 2) % 2 ? "#3f8de0" : "#f2f6fa";
        p(x, 34, 4, 5, c); p(x, 39, 4, 1, c); p(x + 1, 40, 2, 1, c);
      }
      p(wx, 34, 32, 1, "#1c4373");
      p(wx - 1, 41, 34, 15, "#14151f"); p(wx, 42, 32, 13, "#3a2a22"); p(wx, 42, 32, 2, "#6b4a35"); p(wx, 54, 32, 2, "#8a5a3c");
      p(wx + 1, 43, 5, 2, "#cdf3ff");
    }
    g.drawImage(ITEM_ICON.dia_drill, 10, 42, 12, 12); g.drawImage(ITEM_ICON.lamp3, 26, 42, 12, 12);
    g.drawImage(ITEM_ICON.cargo2, 74, 42, 12, 12); g.drawImage(ICON.fuel_m, 90, 42, 12, 12);
    // 문
    p(47, 41, 18, 19, "#14151f"); p(48, 42, 16, 18, "#6e4527"); p(48, 42, 16, 2, "#8a5a3c");
    p(51, 44, 10, 8, "#7fc4e8"); p(51, 44, 10, 2, "#cdf3ff"); p(55, 44, 1, 8, "#14151f");
    p(61, 54, 2, 2, "#ffd34d"); p(51, 54, 8, 4, "#ffd34d"); p(51, 54, 8, 1, "#fff3a8"); p(52, 56, 6, 1, "#c98f1a");
    p(43, 43, 3, 5, "#14151f"); p(44, 44, 1, 3, "#ffcd3c"); p(66, 43, 3, 5, "#14151f"); p(67, 44, 1, 3, "#ffcd3c");
    p(44, 60, 24, 4, "#8b93a6"); p(44, 60, 24, 1, "#cfd6e4");
    p(0, 60, 112, 4, "#5a5f70"); p(0, 60, 112, 1, "#9aa3b8");
  });
}
export function buildWorkshop() {
  return sprite(112, 64, (p) => {
    // 용광로 굴뚝
    brickFill(p, 10, 6, 12, 22, "#6d7482", "#8d95a6", "#3d414d");
    p(8, 4, 16, 3, "#3d414d"); p(8, 4, 16, 1, "#8d95a6"); p(11, 5, 10, 2, "#ff8a1f"); p(13, 5, 6, 1, "#ffe066");
    // 청동 패티나 지붕
    p(4, 17, 104, 10, "#2f7a5e");
    for (let x = 4; x < 108; x += 6) { p(x, 18, 4, 8, "#3d9b7a"); p(x, 18, 4, 1, "#6fd9ae"); p(x + 4, 18, 1, 8, "#1d4a38"); }
    p(4, 17, 104, 1, "#8fe8c4"); p(4, 26, 104, 2, "#1d4a38");
    // 톱니바퀴 엠블럼
    p(50, 7, 12, 12, "#14151f"); p(52, 5, 8, 16, "#14151f"); p(48, 9, 16, 8, "#14151f");
    p(52, 7, 8, 12, "#cfd6e4"); p(50, 9, 12, 8, "#cfd6e4"); p(52, 7, 8, 2, "#fff"); p(54, 11, 4, 4, "#2f7a5e"); p(55, 12, 2, 2, "#14151f");
    p(49, 12, 2, 2, "#8b93a6"); p(61, 12, 2, 2, "#8b93a6"); p(55, 5, 2, 2, "#8b93a6"); p(55, 19, 2, 1, "#565c70");
    // 돌 벽 + 목재 골조
    brickFill(p, 8, 28, 96, 32, "#7d8794", "#a0a9b8", "#4a505c");
    for (const bx of [8, 50, 100]) { p(bx, 28, 4, 32, "#5e3b25"); p(bx, 28, 1, 32, "#8a5a3c"); p(bx + 3, 28, 1, 32, "#3a2414"); }
    p(8, 28, 96, 3, "#5e3b25"); p(8, 28, 96, 1, "#8a5a3c");
    // 간판
    p(34, 31, 44, 10, "#14151f"); p(35, 32, 42, 8, "#3a3f52"); p(35, 32, 42, 1, "#8b93a6"); p(35, 39, 42, 1, "#1b1d2c");
    for (const sx of [36, 74]) p(sx, 33, 2, 2, "#cfd6e4");
    // 용광로 입구(이글거리는 불)
    p(14, 40, 24, 20, "#14151f"); p(16, 42, 20, 18, "#2b1a12"); p(18, 45, 16, 15, "#c0392b");
    p(19, 47, 14, 13, "#ff8a1f"); p(21, 50, 10, 10, "#ffe066"); p(23, 54, 6, 6, "#fff3a8");
    p(17, 44, 1, 1, "#ff8a1f"); p(34, 46, 1, 1, "#ffe066"); p(26, 44, 1, 1, "#ffe066");
    p(14, 40, 24, 2, "#565c70"); p(14, 40, 24, 1, "#cfd6e4");
    // 문
    p(46, 42, 20, 18, "#14151f"); p(47, 43, 18, 17, "#4a2e1b");
    for (let x = 47; x < 65; x += 4) p(x, 43, 1, 17, "#3a2414");
    p(47, 47, 18, 2, "#3a3f52"); p(47, 54, 18, 2, "#3a3f52"); p(47, 47, 18, 1, "#8b93a6"); p(47, 54, 18, 1, "#8b93a6");
    p(61, 50, 3, 3, "#ffd34d"); p(61, 50, 3, 1, "#fff3a8");
    // 벽에 걸린 연장
    p(70, 34, 1, 8, "#8a5a3c"); p(68, 33, 6, 2, "#cfd6e4"); p(68, 35, 2, 1, "#8b93a6"); p(72, 35, 2, 1, "#8b93a6");
    p(76, 36, 8, 2, "#5e3b25"); p(82, 34, 4, 6, "#8b93a6"); p(82, 34, 4, 1, "#e3e8f2");
    // 모루 + 장작
    p(84, 50, 14, 4, "#14151f"); p(85, 51, 12, 2, "#565c70"); p(85, 51, 12, 1, "#9aa3b8"); p(97, 51, 3, 2, "#565c70");
    p(88, 54, 6, 3, "#3a3f52"); p(86, 57, 10, 3, "#14151f"); p(87, 58, 8, 2, "#565c70");
    p(100, 53, 8, 7, "#14151f"); p(101, 54, 6, 2, "#8a5a3c"); p(101, 57, 6, 2, "#6e4527"); p(103, 54, 1, 5, "#c08a5c");
    p(0, 60, 112, 4, "#5a5f70"); p(0, 60, 112, 1, "#9aa3b8"); p(40, 62, 8, 1, "#3a3f52");
  });
}
S.itemShopImg = buildItemShop();
S.craftShopImg = buildWorkshop();
// 건물 기초석 (건물 아래 땅은 부술 수 없음)
export const plinthTop = sprite(16, 16, (p) => {
  brickFill(p, 0, 0, 16, 16, "#6a6f7e", "#8d93a6", "#3d414d");
  p(0, 0, 16, 2, "#a0a6ba"); p(0, 2, 16, 1, "#4a4e5c");
});
export const plinthLow = sprite(16, 16, (p) => { brickFill(p, 0, 0, 16, 16, "#4a4e5c", "#5e6374", "#2b2e38"); });

export function fxText(fx) {
  const NAMES = { drill: "채굴 속도", thrust: "추진력", speed: "이동 속도", light: "시야", sell: "판매가", lucky: "행운" };
  return Object.keys(fx).map((k) => {
    const v = fx[k];
    if (k === "fuel") return "최대 연료 +" + v;
    if (k === "cargo") return "화물 용량 +" + v;
    if (k === "eff") return "연료 소모 -" + Math.round(v * 100) + "%";
    return NAMES[k] + " +" + Math.round(v * 100) + "%";
  }).join(", ");
}

// ---- 광산 입구 표지판 로고 (글자 없이 그림만): public/assets/signs/mine.png. 못 불러오면 draw.ts 가 나무판 + 화살표로 대신 ----
export const SIGN_IMG = { mine: sprite(1, 1, () => {}) };
// 마을 창 탭 이름도 그림으로 (signs/tab_<탭>_<on|off>.png). 1배로 그림
export const TAB_IMG = {};
for (const k of ["shop", "craft", "furnace", "sell"]) for (const st of ["on", "off"]) TAB_IMG[k + "_" + st] = sprite(1, 1, () => {});
