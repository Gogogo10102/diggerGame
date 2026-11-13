// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../systems/drops.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ICON, sprite } from "./sprites.ts";
import { CATS, ITEMS } from "../data/items.ts";

// ---- 아이템 아이콘: 단계(0~7)가 오를수록 색이 화려해지고 디테일이 늘어남 ----
export const PAL = [
  { h: "#e3e8f2", m: "#9aa3b8", l: "#5b6379" },   // 0 강철
  { h: "#bfe0ff", m: "#5b9be6", l: "#2f5ea8" },   // 1 티타늄
  { h: "#e8ffff", m: "#5ef2ff", l: "#2aa6c9" },   // 2 다이아
  { h: "#c8ffd8", m: "#3ddc84", l: "#1b8f50" },   // 3 에메랄드
  { h: "#fff3b0", m: "#ffc23c", l: "#b87818" },   // 4 황금
  { h: "#ffc8c8", m: "#ff4d5e", l: "#a11a2f" },   // 5 루비
  { h: "#ecd4ff", m: "#a45cff", l: "#5a2aa8" },   // 6 자수정
  { h: "#ffffff", m: "#6ef2d4", l: "#2a9d92" },   // 7 미스릴
];
export const GLOW = ["#ffcd3c", "#fff3a8", "#e8ffff", "#b8ffcf", "#ffe9a0", "#ffc0c0", "#e6c8ff", "#ffffff"];
export const FLAME = [["#ff8a1f", "#ffe066"], ["#ff8a1f", "#ffe066"], ["#ffb040", "#fff3a8"], ["#5ef2ff", "#e8ffff"],
  ["#3ddc84", "#c8ffd8"], ["#ff4d5e", "#ffc8c8"], ["#a45cff", "#ecd4ff"], ["#6ef2d4", "#ffffff"], ["#ffffff", "#6ef2d4"]];
export const SPK = [[1, 1], [14, 2], [13, 13], [2, 13], [8, 0], [0, 8], [15, 8]];
export function sparkle(p, t, c) {
  const n = t < 3 ? 0 : t < 5 ? 1 : t < 6 ? 2 : t < 7 ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const x = SPK[i][0], y = SPK[i][1];
    p(x, y, 1, 1, "#fff");
    if (t >= 6) {
      if (x > 0) p(x - 1, y, 1, 1, c.h); if (x < 15) p(x + 1, y, 1, 1, c.h);
      if (y > 0) p(x, y - 1, 1, 1, c.h); if (y < 15) p(x, y + 1, 1, 1, c.h);
    }
  }
}
export const B = {};
B.drill = (p, t, c) => {
  p(1, 5, 5, 6, "#2e3244"); p(2, 6, 3, 4, "#565c70"); p(2, 6, 3, 1, "#8b93a6");
  p(1, 5, 5, 1, c.m); p(1, 10, 5, 1, c.l);
  const L = 6 + Math.min(3, t >> 1);
  for (let i = 0; i < L; i++) {
    const h = Math.max(1, Math.round(6 * (1 - i / L))), y0 = 8 - Math.ceil(h / 2);
    p(6 + i, y0, 1, h, c.m); p(6 + i, y0, 1, 1, c.h); p(6 + i, y0 + h - 1, 1, 1, c.l);
    if (i % 3 === 2) p(6 + i, y0, 1, h, c.l);
  }
  p(6 + L, 7, 1, 2, c.h);
  if (t >= 3) { p(2, 7, 2, 2, c.h); p(2, 7, 1, 1, "#fff"); }
  if (t >= 5) { p(7, 3, 3, 1, c.m); p(7, 12, 3, 1, c.m); p(6, 4, 1, 1, c.l); p(6, 11, 1, 1, c.l); }
  if (t >= 7) p(0, 4, 1, 8, c.h);
  sparkle(p, t, c);
};
B.tank = (p, t, c) => {
  const can = (x, w, y, hh) => {
    p(x, y, w, hh, "#14151f"); p(x + 1, y + 1, w - 2, hh - 2, c.m);
    p(x + 1, y + 1, w - 2, 2, c.h); p(x + 1, y + hh - 3, w - 2, 2, c.l);
    p(x + (w >> 1) - 1, y - 2, 3, 2, "#8b93a6");
  };
  const bolt = (bx) => { p(bx + 1, 6, 2, 1, "#ffe066"); p(bx, 7, 2, 1, "#ffe066"); p(bx, 8, 3, 1, "#ffe066"); p(bx + 1, 9, 2, 1, "#ffe066"); p(bx, 10, 2, 1, "#ffe066"); };
  if (t >= 5) { can(1, 6, 4, 11); can(9, 6, 4, 11); p(7, 8, 2, 2, c.l); bolt(3); bolt(11); }
  else { can(3, 10, 3, 12); bolt(7); if (t >= 2) { p(4, 6, 1, 6, c.l); p(11, 6, 1, 6, c.l); } }
  if (t >= 3) p(7, 0, 2, 1, c.h);
  sparkle(p, t, c);
};
B.crate = (p, t, c) => {
  const top = t >= 5 ? 6 : 4;
  p(2, top, 12, 14 - top, "#14151f"); p(3, top + 1, 10, 12 - top, c.m); p(3, top + 1, 10, 2, c.h);
  p(3, 12, 10, 1, c.l); p(7, top + 1, 2, 12 - top, c.l);
  if (t >= 2) p(3, top + 5, 10, 1, c.l);
  p(7, top + 3, 2, 2, t >= 3 ? c.h : "#ffd34d");
  if (t >= 5) { p(4, 1, 8, 5, "#14151f"); p(5, 2, 6, 3, c.l); p(5, 2, 6, 1, c.m); p(7, 3, 2, 1, c.h); }
  if (t >= 6) { p(2, 13, 12, 1, c.h); p(3, 14, 10, 1, c.m); }
  sparkle(p, t, c);
};
B.engine = (p, t, c) => {
  const n = t >= 6 ? 3 : t >= 3 ? 2 : 1;
  const xs = (k) => (n === 1 ? 6 : n === 2 ? 4 + k * 4 : 3 + k * 4);
  p(2, 4, 12, 6, "#14151f"); p(3, 5, 10, 4, "#565c70"); p(3, 5, 10, 1, c.h);
  const f = FLAME[Math.min(8, t + 1)], fl = 2 + (t >> 2);
  for (let k = 0; k < n; k++) {
    const x = xs(k);
    p(x, 2, 3, 3, c.m); p(x, 2, 3, 1, c.h); p(x, 4, 3, 1, c.l);
    p(x, 10, 3, 2, "#3a3f52"); p(x, 12, 3, fl, f[0]); p(x + 1, 12, 1, fl, f[1]);
  }
  if (t >= 5) { p(0, 5, 2, 4, c.m); p(14, 5, 2, 4, c.m); p(0, 5, 2, 1, c.h); p(14, 5, 2, 1, c.h); }
  sparkle(p, t, c);
};
B.tracks = (p, t, c) => {
  if (t >= 5) {
    p(1, 7, 14, 4, "#14151f"); p(2, 8, 12, 2, c.m); p(2, 8, 12, 1, c.h);
    p(3, 12, 10, 1, GLOW[t]); p(5, 13, 6, 1, c.m); p(6, 14, 4, 1, c.h);
  } else {
    p(1, 6, 14, 8, "#14151f"); p(2, 7, 12, 6, c.l);
    const n = t >= 2 ? 4 : 3, st = n === 4 ? 3 : 4;
    for (let k = 0; k < n; k++) { const x = 3 + k * st; p(x, 8, 3, 4, c.m); p(x, 8, 3, 1, c.h); p(x + 1, 9, 1, 2, c.l); }
    if (t >= 3) p(2, 6, 12, 1, c.h);
  }
  sparkle(p, t, c);
};
B.lamp = (p, t, c) => {
  const g = GLOW[t];
  p(4, 6, 8, 3, "#14151f"); p(5, 7, 6, 2, c.m); p(5, 7, 6, 1, c.h);
  p(5, 3, 6, 4, "#14151f"); p(6, 4, 4, 2, g); p(6, 4, 2, 1, "#fff");
  p(6, 9, 4, 2, "#565c70");
  const R = [[1, 12, 3, 1], [7, 12, 2, 3], [12, 12, 3, 1], [0, 9, 2, 1], [14, 9, 2, 1], [3, 14, 2, 1], [11, 14, 2, 1], [6, 15, 4, 1]];
  for (let i = 0; i < Math.min(8, 3 + t); i++) p(R[i][0], R[i][1], R[i][2], R[i][3], g);
  sparkle(p, t, c);
};
B.goggles = (p, t, c) => {
  p(0, 7, 1, 2, c.l); p(15, 7, 1, 2, c.l);
  p(1, 5, 6, 7, "#14151f"); p(9, 5, 6, 7, "#14151f");
  p(2, 6, 4, 5, c.m); p(10, 6, 4, 5, c.m);
  p(2, 6, 2, 1, c.h); p(10, 6, 2, 1, c.h); p(2, 10, 4, 1, c.l); p(10, 10, 4, 1, c.l);
  p(7, 7, 2, 2, "#8b93a6");
  if (t >= 2) { p(1, 4, 6, 1, c.l); p(9, 4, 6, 1, c.l); }
  if (t >= 3) p(7, 5, 2, 2, c.h);
  if (t >= 4) { p(3, 8, 1, 1, "#fff"); p(11, 8, 1, 1, "#fff"); }
  if (t >= 5) { p(3, 1, 1, 3, c.m); p(12, 1, 1, 3, c.m); p(3, 0, 1, 1, c.h); p(12, 0, 1, 1, c.h); }
  if (t >= 7) { p(5, 1, 6, 1, GLOW[4]); p(6, 0, 4, 1, GLOW[4]); }
  sparkle(p, t, c);
};
B.scale = (p, t, c) => {
  p(7, 3, 2, 10, c.l); p(4, 13, 8, 2, c.m); p(4, 13, 8, 1, c.h); p(1, 5, 14, 1, c.m);
  p(1, 6, 1, 3, c.l); p(14, 6, 1, 3, c.l); p(0, 9, 4, 2, c.m); p(12, 9, 4, 2, c.m);
  p(0, 9, 4, 1, c.h); p(12, 9, 4, 1, c.h); p(7, 2, 2, 1, c.h);
  sparkle(p, t, c);
};
B.clover = (p, t, c) => {
  for (const q of [[3, 1], [9, 1], [3, 7], [9, 7]]) { p(q[0], q[1], 4, 4, "#1b8f50"); p(q[0] + 1, q[1] + 1, 2, 2, c.m); p(q[0] + 1, q[1] + 1, 1, 1, c.h); }
  p(7, 5, 2, 4, "#1b8f50"); p(7, 6, 2, 2, GLOW[4]); p(7, 11, 2, 4, "#1b8f50");
  sparkle(p, t, c);
};

// 제작 장비 아이콘: id -> [도안, 단계]
export const CRAFT_ICON = {
  laser_drill: ["drill", 3], dia_bit: ["drill", 5], mithril_drill: ["drill", 7],
  coal_boiler: ["engine", 2], ruby_core: ["engine", 5], mithril_reactor: ["engine", 7],
  silver_lens: ["lamp", 3], gold_scale: ["scale", 4], lucky_charm: ["clover", 5],
  copper_motor: ["tracks", 2], steel_frame: ["crate", 3], mithril_armor: ["crate", 7],
  iron_bit: ["drill", 2], silver_bit: ["drill", 3], gold_bit: ["drill", 4], ruby_bit: ["drill", 6],
  copper_coil: ["engine", 3], gold_cell: ["engine", 4], diamond_cell: ["engine", 6], void_engine: ["engine", 7],
  emerald_lens: ["lamp", 5], diamond_scope: ["lamp", 6], merchant_ring: ["scale", 6], clover_gem: ["clover", 6],
  turbo_motor: ["tracks", 4], ion_thruster: ["tracks", 6], silver_plating: ["crate", 4], diamond_hull: ["crate", 7],
  scout_goggles: ["goggles", 2], geo_scanner: ["goggles", 5], vein_radar: ["goggles", 6], deep_visor: ["goggles", 7],
};
export const ITEM_ICON = {};
for (const cat of CATS) {
  const b = B[cat.icon === "fuel" ? "tank" : cat.icon === "special" ? "goggles" : cat.icon];
  cat.ids.forEach((id, i) => { ITEM_ICON[id] = sprite(16, 16, (p) => b(p, i, PAL[i])); });
}
for (const id in CRAFT_ICON) {
  const bn = CRAFT_ICON[id][0], t = CRAFT_ICON[id][1];
  ITEM_ICON[id] = sprite(16, 16, (p) => B[bn](p, t, PAL[t]));
}
export const itemIcon = (id) => ITEM_ICON[id] || ICON[ITEMS[id].icon];

