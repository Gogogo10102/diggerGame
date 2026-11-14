// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../core/world.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { B, GLOW, PAL } from "./itemIcons.ts";
import { LAYERS, ORE_COL } from "../core/config.ts";
import { S } from "../core/state.ts";
import { mulberry32 } from "../core/world.ts";
import { LOOK } from "../data/consumables.ts";
import { cv } from "../render/util.ts";

// =====================================================================
//  픽셀 스프라이트 (전부 코드로 생성 → 나중에 PNG로 교체 가능)
// =====================================================================
export const art = mulberry32(99);
export const artBase = art;
export function sprite(w, h, fn) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const p = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  fn(p, g);
  return cv;
}

// 색 섞기 / 해시
export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mixC = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
export const hv = (c, r) => (Math.imul(c + 11, 73856093) ^ Math.imul(r + 7, 19349663)) >>> 0;
// 흙 타일 (지층별 8종 변형, 이음매가 보이지 않게 가장자리를 감싸서 그림)
export const DIRT_VAR = 8;
// 깊은 지층(5번째부터)은 따로 쓰는 난수로 그림 → 기존 지층·광물 그림의 모양(난수 순서)이 바뀌지 않음
export const artDeep = mulberry32(4242);
export const dirtTiles = LAYERS.map((L, li) => Array.from({ length: DIRT_VAR }, () => sprite(16, 16, (p) => {
  const art = li < 4 ? artBase : artDeep;
  const w = (x, y, ww, hh, c) => { for (const dx of [0, -16]) for (const dy of [0, -16]) p(x + dx, y + dy, ww, hh, c); };
  const rn = (n) => (art() * n) | 0;
  const hiS = mixC(L.base, L.hi, 0.55), loS = mixC(L.base, L.lo, 0.55);
  p(0, 0, 16, 16, L.base);
  for (let i = 0; i < 46; i++) w(rn(16), rn(16), 1, 1, art() < 0.5 ? hiS : loS);                       // 고운 알갱이
  if (li === 2) for (let i = 0; i < 3; i++) { const y = rn(16), x = rn(16); w(x, y, 4 + rn(6), 1, L.lo); w(x + 1, y + 1, 3 + rn(5), 1, L.hi); }   // 암석 결
  else for (let i = 0; i < 5; i++) { const x = rn(16), y = rn(16); w(x, y, 2 + rn(2), 1, L.hi); w(x + 1, y + 1, 2, 1, L.lo); }    // 흙덩이
  for (let i = 0; i < 3; i++) { const x = rn(16), y = rn(16); w(x, y, 1, 2, L.lo); }                    // 잔금
  const np = 2 + rn(2);
  for (let i = 0; i < np; i++) {                                                                        // 자갈
    const x = rn(16), y = rn(16), s = 2 + rn(2);
    w(x - 1, y, s + 2, s, mixC(L.lo, "#000000", 0.35)); w(x, y - 1, s, s + 2, mixC(L.lo, "#000000", 0.35));
    w(x, y, s, s, L.peb); w(x, y, s, 1, mixC(L.peb, "#ffffff", 0.35)); w(x, y + s - 1, s, 1, mixC(L.peb, "#000000", 0.3));
  }
  if (li === 0) for (let i = 0; i < 2; i++) { const x = rn(16), y = rn(16); w(x, y, 1, 3, "#8a6a40"); w(x + 1, y + 2, 2, 1, "#8a6a40"); }   // 뿌리
  if (li === 1) for (let i = 0; i < 4; i++) w(rn(16), rn(16), 2, 1, "#a35a44");
  if (li === 3) for (let i = 0; i < 3; i++) { const x = rn(16), y = rn(16); w(x, y, 1, 1, "#9a86d6"); }
  if (li === 4) for (let i = 0; i < 3; i++) { const x = rn(16), y = rn(16); w(x, y, 2, 1, "#ff7a3c"); w(x, y + 1, 1, 1, "#ffb066"); }   // 용암 알갱이
  if (li === 5) for (let i = 0; i < 3; i++) { const x = rn(16), y = rn(16); w(x, y, 1, 2, "#9ff0ff"); w(x + 1, y, 1, 1, "#e0ffff"); }   // 수정 조각
  if (li === 6) for (let i = 0; i < 2; i++) { const x = rn(16), y = rn(16); w(x, y, 3, 1, "#efe4c8"); w(x + 1, y - 1, 1, 3, "#efe4c8"); }   // 화석 뼈
  if (li === 7) for (let i = 0; i < 4; i++) w(rn(16), rn(16), 1, 1, "#8fa0ff");                         // 반짝이는 점
})));

// 배경 벽(파낸 뒤 보이는 면): 지층 색을 어둡게 가라앉힌 흙
export const backTiles = LAYERS.map((L, li) => Array.from({ length: 4 }, () => sprite(16, 16, (p) => {
  const art = li < 4 ? artBase : artDeep;
  const w = (x, y, ww, hh, c) => { for (const dx of [0, -16]) for (const dy of [0, -16]) p(x + dx, y + dy, ww, hh, c); };
  const rn = (n) => (art() * n) | 0;
  const bg = mixC(L.base, "#0a0605", 0.6), a = mixC(L.base, "#0a0605", 0.5), b = mixC(L.base, "#0a0605", 0.7);   // 파낸 뒤 보이는 뒷벽(흙보다 한 톤 어둡게)
  p(0, 0, 16, 16, bg);
  for (let i = 0; i < 22; i++) w(rn(16), rn(16), 1, 1, art() < 0.5 ? a : b);
  for (let i = 0; i < 3; i++) { const x = rn(16), y = rn(16); w(x, y, 3, 2, a); w(x, y + 2, 3, 1, b); }
})));

// 광물 가장자리에 어두운 테두리를 둘러 흙 위에서 또렷하게
export function rimmed(src) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 16;
  const g = cv.getContext("2d");
  const sh = document.createElement("canvas"); sh.width = sh.height = 16;
  const sg = sh.getContext("2d");
  sg.drawImage(src, 0, 0); sg.globalCompositeOperation = "source-in"; sg.fillStyle = "rgba(12,6,3,0.8)"; sg.fillRect(0, 0, 16, 16);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.drawImage(sh, dx, dy);
  g.drawImage(src, 0, 0);
  return cv;
}

// 광물 오버레이: 광물마다 모양이 다름 (글자 지도: a 밝음 / b 기본 / c 어두움 / w 하이라이트 / g 포인트색)
export const ORE_MAP = {
  6: [  // 석탄: 각진 검은 덩어리 + 푸른 광택
    "................",
    "..cc.......cc...",
    ".cabc.....cabc..",
    "cabwbc...cabwbc.",
    "cbbbbbc..cbbbbc.",
    ".cbbbc....cbbc..",
    "..ccc......cc...",
    "................",
    "....cc..........",
    "...cabc....cc...",
    "..cabwbc..cabc..",
    "..cbbbbc.cabwbc.",
    "...cbbc..cbbbbc.",
    "....cc....cbbc..",
    ".......c...cc...",
    "................"],
  2: [  // 구리: 둥근 덩어리 + 녹청(초록) 얼룩
    "................",
    "....aab.........",
    "...abbbb....ab..",
    "..abbbbbb..abbb.",
    "..bbgbbbc..bbbc.",
    "..bbbbbcc..gbcc.",
    "...bbccc....cc..",
    "................",
    ".ab.............",
    "abbbb....aab....",
    "bbgbbc..abbbb...",
    "bbbbcc..bbbbbc..",
    ".bbcc...bgbbcc..",
    "..cc.....bccc...",
    "................",
    "................"],
  3: [  // 철: 줄무늬 진 네모난 판 + 녹
    "................",
    ".aaaaaaa........",
    ".bbbbbbbc..aaaa.",
    ".cccccccc..bbbbc",
    ".bbgbbbbc..bgggc",
    ".bbbbbbbc..cccc.",
    "..cccccc........",
    "................",
    "......aaaaaa....",
    ".....bbbbbbbc...",
    ".....ccccccbc...",
    ".....bbbgbbbc...",
    ".....bbbbbbbc...",
    "......cccccc....",
    "................",
    "................"],
  8: [  // 은: 가지 친 실처럼 뻗은 광맥 + 반짝임
    "................",
    ".......w........",
    "..aa...ab...aa..",
    "...ab..ab..abb..",
    "....ab.ab.ab....",
    ".....abaabab....",
    "..aaabbbbbbbaa..",
    ".....abaabab....",
    "....ab.ab.ab....",
    "...ab..ab..ab...",
    "..ab...ab...ab..",
    ".w.....b.....w..",
    "................",
    ".......w........",
    "................",
    "................"],
  4: [  // 금: 매끈하고 큰 둥근 덩어리
    "................",
    "...aaab.........",
    "..abbbbb..aab...",
    ".abwbbbbc.bbbbb.",
    ".bbbbbbbc.bbbbc.",
    ".bbbbbbcc..bbcc.",
    "..bbbccc...ccc..",
    "...cccc.........",
    ".......aab......",
    ".aab..abbbbb....",
    "abbbb.bwbbbbc...",
    "bbbbbcbbbbbcc...",
    ".bbcc.cbbbcc....",
    "..cc...ccc......",
    "................",
    "................"],
  9: [  // 에메랄드: 세로로 선 육각 기둥
    "................",
    "...aa.......aa..",
    "..awbb.....awbb.",
    "..abbc.aa..abbc.",
    "..abbcawbb.abbc.",
    "..abbcabbc.abbc.",
    "..cbbcabbc..cc..",
    "...ccc.bbc......",
    ".......ccc..aa..",
    "..aa.......awbb.",
    ".awbb..aa..abbc.",
    ".abbc.awbb.abbc.",
    ".abbc.abbc..cc..",
    "..cc..abbc......",
    ".......cc.......",
    "................"],
  5: [  // 다이아몬드: 면이 깎인 마름모 보석
    "................",
    "...wwaa.........",
    "..awwbbb..aab...",
    ".abbwbbbc.abbb..",
    "abbbbbbbbcabbbc.",
    ".cbbbbbbc..cbc..",
    "..cbbbbc........",
    "...cbbc.........",
    "....cc..........",
    "..........aab...",
    ".aab.....abwbb..",
    "abwbb...abbbbbc.",
    ".cbbbc...cbbbc..",
    "..cbc.....cbc...",
    "...c............",
    "................"],
  10: [ // 루비: 둥글게 깎인 보석 무리
    "................",
    "....aaa.........",
    "...abbbbc..aa...",
    "..abwbbbbc.abbc.",
    "..bbbbbbbc.bbbc.",
    "..bbbbbbcc..cc..",
    "...bbbcc........",
    "....cc....aaa...",
    ".aa......abwbbc.",
    "abbbc....bbbbbc.",
    "abwbbc...cbbbc..",
    "bbbbbcc...ccc...",
    ".cbbcc..........",
    "..ccc...........",
    "................",
    "................"],
  11: [ // 미스릴: 가운데 큰 결정과 양옆 파편
    "................",
    ".......a........",
    "......abw.......",
    "..a...abb...a...",
    ".aba..abb..aba..",
    ".abba.abb.abba..",
    ".abbb.abc.bbbc..",
    "..bbc.bbc.bbc...",
    "...c..bbc..c....",
    ".....abbbc......",
    "..aa.abbbc.aa...",
    ".abba.bbc.abba..",
    ".abbc.bbc.abbc..",
    "..cc..ccc..cc...",
    "................",
    "................"],
};
export const ORE_ACCENT = { 2: "#4fb39a", 3: "#a8573a" };
// UI용 광물 아이콘(크고 또렷하게): 상점·인벤토리·떨어진 광물에 사용
export const oreIcon = {};
for (const id in ORE_MAP) {
  oreIcon[id] = rimmed(sprite(16, 16, (p) => {
    const c = ORE_COL[id], pal = { a: c[0], b: c[1], c: c[2], w: "#ffffff", g: ORE_ACCENT[id] || c[0] };
    ORE_MAP[id].forEach((row, y) => { for (let x = 0; x < 16; x++) { const ch = row[x]; if (ch !== "." && pal[ch]) p(x, y, 1, 1, pal[ch]); } });
  }));
}
// 월드용 광물 텍스처: 작은 알갱이가 흙에 박혀 있는 모습(검은 테두리 없이, 아래·오른쪽에 파묻힌 그늘)
export const ORE_STAMP = {
  6:  [["ab.", "bwb", "cbc"], [".a", "ab", "bc"], ["aab", "cbb"], ["ab", "cb"]],                 // 석탄: 불규칙한 검은 조각 + 윤기
  2:  [[".ab", "abb", "bbc"], ["ab", "bc"], ["ag.", "bbc"], ["ab", "gb"]],                     // 구리: 둥근 알 + 녹청
  3:  [["aab", "bbc"], ["ab", "bb", "bc"], ["abg", "bbc"], ["ab", "bc"]],                      // 철: 각진 조각 + 녹
  8:  [["a..", ".ab", "..b"], ["ab.", ".ab"], [".a", "ab", "b."], ["w"]],                     // 은: 가는 광맥 줄기
  4:  [[".a.", "abb", ".bc"], ["ab", "bc"], [".ab", "abc"], ["aw", "bc"]],                     // 금: 작은 둥근 알갱이
  9:  [["a", "b", "c"], ["ab", "bb", "bc"], ["w", "b", "c"], ["ab", "bc"]],                    // 에메랄드: 세로 기둥 결정
  5:  [[".w.", "abb", ".c."], [".a.", "abc", ".c."], ["w"], ["ab", "bc"]],                    // 다이아: 작은 마름모
  10: [[".a.", "awb", ".c."], ["ab", "bc"], [".ab", "abc"], ["w"]],                           // 루비: 둥근 보석
  11: [["a..", ".bw", "..b"], ["..a", ".b.", "c.."], ["aw", "bc"], ["w"]],                    // 미스릴: 빛나는 파편
};
export const ORE_SLOTS = [[2, 2], [9, 2], [4, 8], [11, 9], [6, 12], [1, 12], [12, 4], [7, 6]];
export const ORE_SPR = {};                                    // [변형 4개] = {img, spark}
for (const id in ORE_STAMP) {
  const c = ORE_COL[id], pal = { a: c[0], b: c[1], c: c[2], w: "#ffffff", g: ORE_ACCENT[id] || c[0] };
  const rare = [4, 5, 9, 10, 11].includes(Number(id));
  const base = [0, 1].map(() => {
    const grid = Array.from({ length: 16 }, () => new Array(16).fill(""));
    const spark = [];
    const slots = ORE_SLOTS.slice().sort(() => art() - 0.5).slice(0, rare ? 4 : 5);
    for (const [sx, sy] of slots) {
      const st = ORE_STAMP[id][(art() * ORE_STAMP[id].length) | 0];
      const ox = Math.max(0, Math.min(15 - st[0].length, sx + ((art() * 3) | 0) - 1));
      const oy = Math.max(0, Math.min(15 - st.length, sy + ((art() * 3) | 0) - 1));
      st.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") { grid[oy + y][ox + x] = row[x]; if (row[x] === "w" || (row[x] === "a" && !spark.length)) spark.push([ox + x, oy + y]); } });
    }
    const img = sprite(16, 16, (p) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!grid[y][x]) continue;
        p(x, y, 1, 1, pal[grid[y][x]]);
        if (x < 15 && y < 15 && !grid[y + 1][x + 1]) p(x + 1, y + 1, 1, 1, "rgba(25,14,6,0.45)");      // 파묻힌 그늘
        if (y < 15 && !grid[y + 1][x]) p(x, y + 1, 1, 1, "rgba(25,14,6,0.3)");
      }
    });
    return { img, spark: spark.length ? spark : [[slots[0][0], slots[0][1]]] };
  });
  const flip = (v) => ({ img: sprite(16, 16, (p, g) => { g.translate(16, 0); g.scale(-1, 1); g.drawImage(v.img, 0, 0); }), spark: v.spark.map(([x, y]) => [15 - x, y]) });
  ORE_SPR[id] = [base[0], base[1], flip(base[0]), flip(base[1])];
}
export const oreTiles = {};                                   // (호환) 월드 텍스처 대표 이미지
for (const id in ORE_SPR) oreTiles[id] = ORE_SPR[id][0].img;
export const SPARK_ORES = { 4: 1, 5: 1, 8: 1, 9: 1, 10: 1, 11: 1 };
// 단단한 암석(경암): 희귀 광물을 감싸고 있음. 드릴로 팔 수 있지만 오래 걸림
export const hardTiles = [0, 1].map(() => sprite(16, 16, (p) => {
  p(0, 0, 16, 16, "#33384a");
  for (const [x, y, w, h] of [[0, 0, 7, 6], [7, 0, 9, 5], [0, 6, 5, 10], [5, 5, 6, 6], [11, 5, 5, 7], [5, 11, 11, 5]]) {
    p(x, y, w, h, art() < 0.5 ? "#454b63" : "#3e435a"); p(x, y, w, 1, "#5d6582"); p(x, y, 1, h, "#565e7a");
    p(x, y + h - 1, w, 1, "#2a2e3c");
  }
  for (let i = 0; i < 5; i++) { const x = (art() * 14) | 0, y = (art() * 14) | 0; p(x, y, 1, 2, "#1d2029"); p(x + 1, y + 1, 1, 2, "#1d2029"); }
  for (let i = 0; i < 3; i++) p((art() * 15) | 0, (art() * 15) | 0, 1, 1, "#a8b4d8");
}));

// 풀(지표면) 2종
export const grassTiles = [0, 1].map((v) => sprite(16, 16, (p) => {
  p(0, 0, 16, 3, "#4f8f3a"); p(0, 0, 16, 1, "#7cc255");
  for (let x = 0; x < 16; x++) {
    const h = 3 + (art() * 4 | 0);
    p(x, 2, 1, h - 2, "#437a31"); p(x, h - 1, 1, 1, "#2f5c25");
    if (art() < 0.35) p(x, 1, 1, 1, "#8fd465");
  }
  p(0, 3, 16, 1, "#3a2a18");
  if (v) for (let i = 0; i < 2; i++) { const x = 2 + (art() * 12 | 0); p(x, 1, 1, 1, i ? "#ffd34d" : "#ff7a8a"); }
}));
export const grass = grassTiles[0];
// 지표면 위 장식(풀포기·꽃·돌·버섯)
export const decoTiles = [
  sprite(16, 16, (p) => { for (const [x, h, c] of [[4, 4, "#5aa63e"], [6, 6, "#6fbf4a"], [8, 5, "#5aa63e"], [10, 3, "#4f8f3a"]]) { p(x, 16 - h, 1, h, c); } p(3, 13, 9, 3, "#4f8f3a"); p(6, 10, 1, 6, "#8fd465"); }),
  sprite(16, 16, (p) => { p(7, 9, 1, 7, "#4f8f3a"); p(5, 12, 2, 1, "#4f8f3a"); p(8, 13, 2, 1, "#4f8f3a"); p(6, 7, 3, 3, "#ff7a8a"); p(7, 8, 1, 1, "#ffe066"); p(6, 6, 3, 1, "#ffc0c8"); }),
  sprite(16, 16, (p) => { p(4, 12, 8, 4, "#4a4f5e"); p(5, 11, 6, 1, "#4a4f5e"); p(5, 12, 6, 3, "#8a90a0"); p(6, 11, 4, 1, "#b0b6c6"); p(5, 14, 6, 1, "#5b606e"); }),
  sprite(16, 16, (p) => { p(7, 11, 2, 5, "#e8dcc4"); p(4, 8, 8, 4, "#c4403a"); p(5, 7, 6, 1, "#c4403a"); p(5, 9, 1, 1, "#fff"); p(9, 8, 2, 1, "#fff"); p(4, 11, 8, 1, "#8a2a28"); }),
  sprite(16, 16, (p) => { p(5, 12, 1, 4, "#4f8f3a"); p(7, 10, 1, 6, "#5aa63e"); p(9, 11, 1, 5, "#4f8f3a"); p(6, 8, 3, 3, "#ffe066"); p(7, 9, 1, 1, "#ff9a2a"); p(3, 14, 2, 1, "#4f8f3a"); }),
  sprite(16, 16, (p) => { p(2, 11, 12, 5, "#2f6a2a"); p(3, 9, 10, 3, "#3b7d33"); p(5, 8, 6, 1, "#3b7d33"); p(4, 10, 3, 1, "#5aa63e"); p(9, 11, 2, 1, "#5aa63e"); p(11, 9, 1, 1, "#ff7a8a"); p(5, 13, 1, 1, "#ff7a8a"); p(2, 15, 12, 1, "#24511f"); }),
];
export const decoFor = (c) => { const h = hv(c, 3) % 14; return h < 6 ? null : decoTiles[[0, 0, 1, 2, 3, 4, 5, 0][h - 6]]; };

export const bedrock = sprite(16, 16, (p) => {
  p(0, 0, 16, 16, "#2b2b33");
  for (let i = 0; i < 20; i++) p(art() * 14 | 0, art() * 15 | 0, 2, 1, "#3a3a46");
  for (let i = 0; i < 14; i++) p(art() * 15 | 0, art() * 14 | 0, 1, 2, "#1d1d24");
  p(0, 15, 16, 1, "#1d1d24"); p(15, 0, 1, 16, "#1d1d24");
});
export const stoneTiles = [0, 1].map(() => sprite(16, 16, (p) => {
  p(0, 0, 16, 16, "#3d414d");
  for (const r of [[1, 1, 6, 5], [8, 1, 7, 6], [1, 7, 5, 8], [7, 8, 8, 7]]) {
    const x = r[0], y = r[1], w = r[2], h = r[3], dx = (art() * 2) | 0;
    p(x, y, w, h, "#8a90a0"); p(x, y, w, 1, "#b0b6c6"); p(x, y, 1, h, "#b0b6c6");
    p(x, y + h - 1, w, 1, "#5b606e"); p(x + w - 1, y, 1, h, "#5b606e");
    p(x + 2 + dx, y + 2, 1, 1, "#6f7586");
  }
  for (let i = 0; i < 6; i++) p(art() * 15 | 0, art() * 15 | 0, 1, 1, "#2b2e38");
}));
// 채굴 균열 3단계
export const CRACK = [[7,1,1,3],[6,4,1,2],[8,4,1,2],[5,6,1,2],[9,6,1,3],[7,7,1,2],[4,9,1,2],[7,9,1,3],[10,9,1,2],[6,12,1,3],[9,12,1,2]];
export const cracks = [4, 8, 11].map((n) => sprite(16, 16, (p) => {
  for (let i = 0; i < n; i++) p(...CRACK[i], "rgba(10,6,3,0.85)");
}));

// 배경: 구름, 해
export const cloudImg = sprite(20, 8, (p) => {
  p(2, 3, 16, 5, "#ffffff"); p(5, 1, 6, 3, "#ffffff"); p(10, 0, 6, 4, "#ffffff"); p(2, 7, 16, 1, "#d6ecff");
});
export const sunImg = sprite(16, 16, (p) => {
  p(5, 0, 6, 16, "#fff3a8"); p(3, 2, 10, 12, "#fff3a8"); p(1, 4, 14, 8, "#fff3a8"); p(0, 5, 16, 6, "#fff3a8");
  p(5, 3, 6, 10, "#ffe066"); p(3, 5, 10, 6, "#ffe066"); p(4, 4, 8, 8, "#ffe066");
});
export const CLOUDS = [{x:60,y:50,s:3},{x:340,y:110,s:4},{x:620,y:40,s:3},{x:880,y:130,s:5},{x:1150,y:70,s:3},{x:1400,y:100,s:4}];
export const SKY = ["#5fb8ff", "#74c3ff", "#8ccfff", "#a3dbff", "#bde6ff", "#d3f0ff"];

// 상점 건물 (112x48 아트 = 7x3 타일). 지붕 색만 바꿔서 두 건물을 만듦
export function makeShop(roofA, roofB, roofC) {
  return sprite(112, 48, (p) => {
    p(0, 0, 112, 10, roofA);
    for (let x = 0; x < 112; x += 16) p(x, 0, 8, 10, roofB);
    p(0, 10, 112, 2, roofC);
    p(4, 12, 104, 36, "#8a5a3c"); p(4, 12, 104, 1, "#a8704a");
    for (let y = 18; y < 48; y += 6) p(4, y, 104, 1, "#6b4329");
    p(34, 14, 44, 12, "#2b2f45"); p(34, 14, 44, 1, "#6b7399"); p(34, 25, 44, 1, "#14151f"); p(34, 14, 1, 12, "#6b7399"); p(77, 14, 1, 12, "#14151f");
    for (const wx of [10, 84]) {
      p(wx - 1, 21, 20, 16, "#4a2e1b"); p(wx, 22, 18, 14, "#9fe3ff"); p(wx, 22, 18, 3, "#cdf3ff");
      p(wx + 8, 22, 2, 14, "#4a2e1b"); p(wx, 28, 18, 2, "#4a2e1b");
    }
    p(49, 25, 14, 23, "#3a2414"); p(50, 26, 12, 22, "#5a381f"); p(50, 26, 12, 2, "#6e4527"); p(59, 38, 2, 2, "#ffd34d");
    p(0, 46, 112, 2, "#5a381f");
  });
}
S.itemShopImg = undefined; S.craftShopImg = undefined;                              // 건물 스프라이트(아래에서 생성)

// 아이콘
export const ICON = {};
ICON.coin = sprite(16, 16, (p) => {
  p(5, 2, 6, 12, "#9a6a12"); p(3, 4, 10, 8, "#9a6a12"); p(4, 3, 8, 10, "#9a6a12");
  p(6, 3, 4, 10, "#ffd34d"); p(4, 5, 8, 6, "#ffd34d"); p(5, 4, 6, 8, "#ffd34d");
  p(5, 5, 2, 2, "#fff08a"); p(7, 5, 2, 6, "#c98f1a");
});
ICON.crate = sprite(16, 16, (p) => {
  p(2, 4, 12, 10, "#5e3b25"); p(3, 5, 10, 8, "#8a5a3c"); p(3, 5, 10, 2, "#b07a52");
  p(3, 9, 10, 1, "#5e3b25"); p(7, 5, 2, 8, "#5e3b25");
});
ICON.fuel = sprite(16, 16, (p) => {
  p(3, 3, 10, 11, "#7b241c"); p(4, 4, 8, 9, "#d9453a"); p(4, 4, 8, 2, "#ff7a6b");
  p(9, 1, 4, 3, "#8b93a6"); p(7, 7, 2, 4, "#ffd34d"); p(6, 9, 4, 2, "#ffd34d");
});
ICON.depth = sprite(16, 16, (p) => {
  p(7, 1, 2, 8, "#8fd3ff"); p(3, 8, 10, 1, "#8fd3ff"); p(4, 9, 8, 1, "#8fd3ff");
  p(5, 10, 6, 1, "#8fd3ff"); p(6, 11, 4, 1, "#8fd3ff"); p(7, 12, 2, 1, "#8fd3ff");
});
ICON.drill = sprite(16, 16, (p) => {
  p(1, 5, 5, 6, "#565c70"); p(2, 6, 3, 4, "#8b93a6"); p(6, 4, 3, 8, "#cfd6e4");
  p(9, 5, 3, 6, "#cfd6e4"); p(12, 6, 2, 4, "#cfd6e4"); p(14, 7, 1, 2, "#fff");
  p(7, 5, 1, 1, "#565c70"); p(8, 8, 1, 1, "#565c70"); p(10, 6, 1, 1, "#565c70"); p(11, 9, 1, 1, "#565c70");
});

ICON.engine = sprite(16, 16, (p) => {
  p(3, 2, 10, 8, "#565c70"); p(4, 3, 8, 6, "#8b93a6"); p(4, 3, 8, 2, "#cfd6e4");
  p(5, 10, 6, 3, "#3a3f52"); p(6, 13, 4, 2, "#ff8a1f"); p(7, 13, 2, 3, "#ffe066");
});
ICON.tracks = sprite(16, 16, (p) => {
  p(1, 6, 14, 8, "#14151f"); p(2, 7, 12, 6, "#3a3f52");
  p(3, 8, 3, 4, "#8b93a6"); p(7, 8, 3, 4, "#8b93a6"); p(11, 8, 3, 4, "#8b93a6");
  p(4, 9, 1, 2, "#565c70"); p(8, 9, 1, 2, "#565c70"); p(12, 9, 1, 2, "#565c70");
});
ICON.lamp = sprite(16, 16, (p) => {
  p(5, 2, 6, 5, "#d9902b"); p(6, 3, 4, 3, "#ffcd3c"); p(6, 3, 2, 1, "#fff3a8");
  p(4, 7, 8, 2, "#8b93a6"); p(6, 9, 4, 2, "#565c70");
  p(1, 12, 3, 1, "#fff3a8"); p(7, 12, 2, 3, "#fff3a8"); p(12, 12, 3, 1, "#fff3a8");
});
ICON.special = sprite(16, 16, (p) => {
  p(0, 7, 1, 2, "#8b93a6"); p(15, 7, 1, 2, "#8b93a6");
  p(1, 5, 6, 7, "#14151f"); p(9, 5, 6, 7, "#14151f");
  p(2, 6, 4, 5, "#5ff3ff"); p(10, 6, 4, 5, "#5ff3ff");
  p(2, 6, 2, 1, "#e8ffff"); p(10, 6, 2, 1, "#e8ffff");
  p(7, 7, 2, 2, "#8b93a6");
});

ICON.chest = sprite(16, 16, (p) => {
  p(2, 5, 12, 9, "#4a2e1b"); p(3, 6, 10, 7, "#8a5a3c"); p(3, 6, 10, 3, "#a8704a");
  p(2, 8, 12, 1, "#4a2e1b"); p(7, 5, 2, 9, "#ffd34d"); p(7, 9, 2, 2, "#14151f");
  p(3, 12, 10, 1, "#6b4329");
});
// 플레이어(채굴 로봇) 프레임
export const minerCache = new Map();
export function getMiner(mode, leg, dig) {
  const key = mode + leg + dig + "|" + LOOK.key;
  if (minerCache.has(key)) return minerCache.get(key);
  const img = sprite(16, 16, (p) => {
    const Y = "#ffcd3c", Yh = "#fff3a8", Ys = "#d9902b";
    const O = "#ef7d3a", Oh = "#ffb066", Os = "#b34a24";
    const D = "#3a3f52", V = "#1f2a44", E = "#5ff3ff";
    const TR = LOOK.tracks > 0 ? PAL[LOOK.tracks - 1] : null;
    const DR = LOOK.drill > 0 ? PAL[LOOK.drill - 1] : null;
    const CP = LOOK.crate > 0 ? PAL[LOOK.crate - 1] : null;
    const trD = TR ? TR.l : D, trB = "#14151f", trP = TR ? TR.m : "#8b93a6";
    const bitC = DR ? DR.h : "#cfd6e4", drG = DR ? DR.m : "#8b93a6", drD = DR ? DR.l : "#565c70";
    const ds = dig < 0 ? 0 : dig;
    // 화물 배낭 (화물칸 단계가 오를수록 커지고 화려해짐)
    if (CP) {
      if (mode === "side") {
        p(1, 9, 3, 4, "#14151f"); p(2, 9, 2, 3, CP.m); p(2, 9, 2, 1, CP.h);
        if (LOOK.crate >= 4) { p(0, 10, 1, 3, CP.l); p(1, 8, 2, 1, CP.h); }
      } else { p(2, 9, 2, 4, CP.m); p(12, 9, 2, 4, CP.m); p(2, 9, 2, 1, CP.h); p(12, 9, 2, 1, CP.h); }
    }
    // 무한궤도
    if (mode === "down") { p(3, 13, 3, 3, trD); p(10, 13, 3, 3, trD); p(3, 15, 3, 1, trB); p(10, 15, 3, 1, trB); }
    else { p(3, 13, 10, 3, trD); p(3, 15, 10, 1, trB); for (let i = 0; i < 3; i++) p(4 + i * 3 + leg, 14, 2, 1, trP); }
    // 몸통
    p(4, 8, 8, 6, O); p(4, 12, 8, 2, Os); p(5, 9, 2, 1, Oh);
    p(7, 10, 3, 2, D); p(8, 10, 1, 1, "#7cff6b");
    // 헬멧
    p(4, 1, 8, 7, Y); p(3, 3, 10, 4, Y);
    p(11, 2, 1, 5, Ys); p(12, 3, 1, 4, Ys); p(5, 2, 3, 1, Yh); p(3, 7, 10, 1, Ys);
    p(8, 0, 1, 1, "#ff5a4d");
    if (LOOK.lamp > 0) { p(12, 2, 2, 2, GLOW[LOOK.lamp - 1]); p(12, 2, 1, 1, "#fff"); }
    // 바이저
    p(6, 4, 6, 3, V); p(7, 5, 1, 1, E); p(10, 5, 1, 1, E);
    // 드릴 (등급에 따라 색이 달라짐)
    if (mode === "side") {
      p(12, 10, 2, 3, drG); p(12, 10, 2, 1, bitC);
      p(14, 10, 1, 3, bitC); p(15, 11, 1, 1, bitC);
      if (LOOK.drill >= 4) { p(15, 10, 1, 1, bitC); p(15, 12, 1, 1, bitC); }
      if (ds === 0) p(14, 11, 1, 1, drD); else { p(14, 10, 1, 1, drD); p(14, 12, 1, 1, drD); }
    } else if (mode === "up") {                                     // 위로: 헬멧 위로 드릴을 들어 올림
      p(6, 0, 4, 2, drG); p(7, 0, 2, 1, bitC);
      if (ds === 0) p(6, 1, 1, 1, drD); else p(9, 1, 1, 1, drD);
    } else {
      p(6, 13, 4, 2, drG); p(7, 15, 2, 1, bitC);
      if (ds === 0) p(6, 14, 1, 1, drD); else p(9, 14, 1, 1, drD);
    }
  });
  minerCache.set(key, img);
  return img;
}
