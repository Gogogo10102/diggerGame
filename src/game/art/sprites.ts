// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../core/world.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { B, GLOW, PAL, PICK_TIER } from "./itemIcons.ts";
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
// 흙 타일 (지층별 16조각: 4x4칸이 이어지는 무늬. 고해상도는 tools/mapart.py)
export const DIRT_VAR = 16;                       // 흙 무늬는 4x4칸이 이어지는 한 장 (번호 = (c&3) + (r&3)*4)
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
// 자연 동굴: 뒷벽(판 굴보다 어둡고 푸르스름) · 천장 고드름 돌(지층마다 3) · 바닥 장식 4종(빛버섯·버섯·수정·돌무더기)
//  고해상도 그림 tiles/cave/*.png (tools/mapart.py). 파일이 없으면 뒷벽은 판 굴 뒷벽을 어둡게, 장식은 안 그림(1x1)
export const caveBack = LAYERS.map((L, li) => [0, 1, 2, 3].map((v) => sprite(16, 16, (p, g) => { g.drawImage(backTiles[li][v], 0, 0); p(0, 0, 16, 16, "rgba(12,20,44,0.35)"); })));
export const caveTop = LAYERS.map(() => [0, 1, 2].map(() => sprite(1, 1, () => {})));
// 굴 가장자리 = PixelLab Wang 시트 통째(지층마다, tiles/wang/<지층>.png, 320x256). 파일이 없으면 1x1 → 가장자리 없이 네모 칸
export const wangTiles = LAYERS.map(() => sprite(1, 1, () => {}));
// 단단한 블록(돌 12 · 경암 16 · 암반 7)의 가장자리 시트 (tiles/wang/stone|hard|bedrock.png)
export const wangBlock = { 12: sprite(1, 1, () => {}), 16: sprite(1, 1, () => {}), 7: sprite(1, 1, () => {}) };
export const caveBot = [0, 1, 2, 3, 4, 5, 6].map(() => sprite(1, 1, () => {}));
// 지층마다 나오는 바닥 장식 (0 빛버섯 · 1 빨간 버섯 · 2 수정 · 3 돌무더기 · 4 용암 웅덩이 · 5 뼈 무더기 · 6 보라 수정, -1 = 없음)
//  바닥 장식은 새 그림체와 안 맞아 전부 뺌(2026-11-25, 동굴엔 천장 고드름 돌만). 그림 파일·자리는 남겨 둠(다시 쓸 때 번호만 넣으면 됨)
export const CAVE_BOT_BY_LAYER = [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]];
//  어둠 속에서 빛나는 장식과 그 색
export const CAVE_BOT_GLOW = { 0: "#5aa8ff", 2: "#7fe8ff", 4: "#ff8a1f", 6: "#c486ff" };
// 흙 위에 칸마다 골라 얹는 자갈·반짝이·뼈·뿌리 (지층마다 6종, 고해상도 tiles/dirt/over_<지층>_<v>.png 만)
//  4x4 이어지는 흙 무늬가 되풀이돼 보이지 않게 칸마다 다르게 얹음
export const DIRT_OVER = 6;
export const dirtOver = LAYERS.map(() => Array.from({ length: DIRT_OVER }, () => sprite(1, 1, () => {})));
// 가스 주머니 (흙 위에 겹침): 흙 틈의 초록 거품. 고해상도 tiles/gas.png
export const gasTile = sprite(16, 16, (p) => {
  for (const [x, y, r] of [[5, 6, 2], [10, 9, 3], [6, 11, 1], [11, 4, 1]]) {
    p(x - r, y - r + 1, r * 2 + 1, r * 2 - 1, "#1a3a10"); p(x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, "#7cdc5a"); p(x - r + 1, y - r + 1, 1, 1, "#e0ffc0");
  }
});
// 사다리 (빈칸 위에 겹침): 나무 기둥 둘 + 가로대. 고해상도 tiles/ladder.png
export const ladderTile = sprite(16, 16, (p) => {
  p(3, 0, 2, 16, "#14151f"); p(11, 0, 2, 16, "#14151f"); p(3, 0, 1, 16, "#b07a44"); p(11, 0, 1, 16, "#b07a44");
  for (let y = 1; y < 16; y += 4) { p(5, y, 6, 2, "#14151f"); p(5, y, 6, 1, "#d8a868"); }
});
// 지상 나무 3종 (광산 터 땅 위, 64x128 · 아래 끝 = 땅). 고해상도 tiles/tree_<v>.png 만 (없으면 안 그림)
export const treeImgs = [0, 1, 2].map(() => sprite(1, 1, () => {}));

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
// 고해상도 광물 그림(64px, tools/make-hires.py)의 반짝임 자리 (16칸 좌표, 변형마다 덩이 왼쪽 위 밝은 곳)
//  tools/mapart.py 의 ORE_PILES 덩이마다 빛 받는 자리 (ore_spark 로 계산)
// 알갱이 광물 그림(tools/make-pixellab-ores.py)의 반짝임 자리: 광물마다 · 변형마다 알갱이 하이라이트 셋 (16칸 좌표). 그 도구가 출력한 값
export const ORE_FLECK_SPARK = {
  2: [[[3.25,2.75],[12.75,2.75],[2.25,11.75]],[[3.75,3.75],[12.75,3.75],[3.25,11.75]],[[2.75,2.75],[11.75,3.25],[2.75,11.25]],[[2.25,2.25],[11.75,3.75],[2.75,12.25]]],
  3: [[[2.75,2.75],[11.25,2.75],[3.25,12.75]],[[2.25,3.25],[12.25,3.75],[3.75,12.75]],[[3.25,2.75],[12.25,2.75],[3.75,11.25]],[[2.75,3.25],[11.75,2.25],[3.25,11.75]]],
  4: [[[3.25,2.75],[11.25,3.75],[2.25,12.75]],[[3.75,3.25],[12.75,3.25],[3.25,10.75]],[[2.75,2.75],[12.25,2.75],[2.75,11.75]],[[2.75,2.25],[11.75,2.25],[3.75,11.75]]],
  5: [[[3.75,3.75],[11.75,3.25],[3.75,10.75]],[[4.25,2.75],[12.25,2.25],[3.75,12.75]],[[2.75,3.25],[13.25,3.25],[3.25,12.75]],[[3.25,3.25],[13.25,3.25],[2.25,11.25]]],
  6: [[[2.25,3.75],[12.25,3.25],[3.75,11.25]],[[3.75,3.75],[12.75,3.25],[3.25,11.25]],[[3.25,3.25],[11.25,2.75],[2.75,12.75]],[[3.75,3.75],[12.25,2.75],[2.75,11.75]]],
  8: [[[2.25,3.25],[12.75,3.25],[3.75,12.25]],[[2.25,2.25],[10.75,3.75],[3.75,11.25]],[[3.75,3.75],[12.25,3.25],[2.75,11.75]],[[2.25,2.75],[11.25,2.75],[3.25,12.75]]],
  9: [[[2.25,3.25],[11.25,2.25],[3.75,12.75]],[[2.75,3.75],[12.75,2.75],[3.25,12.75]],[[3.75,2.25],[11.75,2.75],[2.25,12.25]],[[3.75,3.25],[11.75,2.25],[3.75,12.75]]],
  10: [[[2.75,3.25],[11.25,3.25],[2.25,12.75]],[[3.75,2.75],[11.25,3.75],[2.75,12.25]],[[3.25,3.25],[11.75,2.25],[3.25,12.25]],[[2.25,2.25],[12.25,2.25],[3.75,12.75]]],
  11: [[[3.25,2.25],[11.75,3.25],[2.25,11.75]],[[2.25,3.25],[11.75,2.25],[2.25,11.75]],[[3.75,3.25],[10.75,2.25],[3.75,12.25]],[[2.25,3.75],[11.25,2.25],[3.75,11.75]]],
};
// 알갱이 광물 그림의 알갱이 자리 [x, y, 폭, 높이] (화면 px, 그림자 포함). 같은 도구가 출력한 값
//  위 칸을 파서 윗면 무늬가 생기면 그 두께에 걸치는 알갱이만 빼고 그리는 데 씀 (draw.ts)
export const ORE_FLECK_BOX = {
  2: [[[12,10,6,6],[50,10,6,6],[8,46,6,6],[50,50,6,6],[26,28,6,6],[40,24,6,8],[24,44,6,6]],[[14,14,6,6],[50,14,6,6],[12,46,8,6],[46,44,8,6],[28,24,6,6],[34,42,6,6]],[[10,10,6,6],[46,12,6,6],[10,44,6,6],[48,48,6,6],[34,28,6,6],[32,10,8,6],[22,40,8,6]],[[8,8,6,6],[46,14,6,6],[10,48,6,8],[42,46,8,6],[16,24,6,6],[24,12,6,6],[24,46,6,6]]],
  3: [[[10,10,6,6],[44,10,6,6],[12,50,6,6],[50,48,6,6],[12,30,6,6],[34,44,6,6]],[[8,12,8,6],[48,14,6,6],[14,50,6,6],[48,48,6,6],[34,28,6,8],[24,36,6,6],[34,10,6,6]],[[12,10,6,6],[48,10,6,6],[14,44,8,6],[44,44,6,6],[44,26,6,6],[32,40,6,8],[32,18,6,6]],[[10,12,6,6],[46,8,6,8],[12,46,6,6],[46,46,6,6],[38,22,6,8],[36,38,6,6],[10,26,6,6]]],
  4: [[[12,10,8,6],[44,14,6,8],[8,50,8,6],[48,46,6,6],[20,34,6,6],[32,28,6,6],[28,14,6,6]],[[14,12,6,8],[50,12,6,6],[12,42,6,8],[50,44,6,6],[38,46,6,6],[36,18,8,6],[14,30,6,8]],[[10,10,6,8],[48,10,6,6],[10,46,6,8],[44,48,6,6],[28,22,6,6],[44,34,6,8]],[[10,8,6,6],[46,8,6,6],[14,46,8,6],[50,44,6,6],[30,8,6,6],[18,26,6,6],[32,42,6,6]]],
  5: [[[12,14,6,8],[46,12,6,6],[12,42,6,8],[46,44,6,6],[32,34,6,6],[26,16,6,8],[18,28,6,8],[52,24,4,6]],[[14,10,6,8],[48,8,4,6],[14,50,6,6],[44,44,6,6],[28,22,6,8],[12,26,4,6],[26,50,6,6]],[[10,12,6,6],[50,12,6,8],[12,50,6,6],[50,42,6,8],[42,32,6,6],[18,30,6,8],[24,14,4,6],[24,48,6,6]],[[12,12,4,6],[50,12,6,8],[8,44,6,6],[48,46,6,6],[40,34,6,6],[28,18,6,6],[22,34,6,8],[8,26,6,6]]],
  6: [[[8,14,6,6],[48,12,6,6],[14,44,6,6],[48,44,6,8],[32,30,8,6],[8,30,6,6]],[[14,14,6,6],[50,12,6,6],[12,44,8,6],[46,44,6,6],[30,18,6,6],[10,30,6,6]],[[12,12,6,6],[44,10,6,6],[10,50,6,6],[48,44,6,8],[38,32,6,8],[34,18,8,6]],[[14,14,6,6],[48,10,6,6],[10,46,6,6],[42,46,8,6],[22,30,8,6],[42,24,6,6]]],
  8: [[[8,12,8,6],[50,12,6,6],[14,48,6,6],[50,48,6,6],[40,26,6,6],[38,50,6,6],[28,32,6,6]],[[8,8,6,6],[42,14,8,6],[14,44,6,6],[44,50,6,6],[50,28,6,6],[40,38,6,6]],[[14,14,6,8],[48,12,6,6],[10,46,6,6],[46,44,6,8],[42,28,6,6],[28,38,6,6],[18,28,6,6]],[[8,10,6,6],[44,10,6,6],[12,50,6,6],[48,48,6,6],[10,28,6,6],[48,30,6,6],[32,24,6,8]]],
  9: [[[8,12,6,6],[44,8,6,6],[14,50,4,6],[46,48,4,6],[28,26,6,6],[48,36,4,6],[26,14,6,6],[12,28,6,6]],[[10,14,6,6],[50,10,4,6],[12,50,4,6],[52,46,4,6],[12,34,6,6],[26,20,4,6],[34,48,6,6],[50,32,6,6]],[[14,8,6,6],[46,10,4,6],[8,48,4,6],[52,46,4,6],[52,32,4,6],[30,36,6,8],[22,20,6,6]],[[12,12,6,8],[44,8,6,8],[14,50,4,6],[46,50,6,6],[50,28,6,8],[38,26,4,6],[8,38,4,6],[18,24,6,8]]],
  10: [[[8,12,6,8],[44,12,6,6],[8,50,6,6],[48,46,6,8],[18,30,4,6],[32,34,6,8],[46,30,6,6],[24,20,6,6]],[[12,10,6,8],[44,14,6,6],[10,48,6,6],[48,48,6,6],[14,30,6,6],[28,14,4,6],[52,34,4,6]],[[12,12,4,6],[46,8,4,6],[12,48,4,6],[44,50,6,6],[30,42,4,6],[48,30,6,8],[14,34,6,6]],[[8,8,6,6],[46,8,6,8],[14,50,4,6],[46,48,4,6],[22,18,6,6],[44,24,6,8],[8,26,4,6],[30,36,6,6]]],
  11: [[[12,8,6,8],[46,12,6,6],[8,46,6,6],[46,48,6,6],[32,32,6,6],[20,18,6,6],[30,10,6,6]],[[8,12,6,6],[46,8,6,6],[8,46,8,6],[44,48,6,6],[24,34,6,6],[44,28,6,6]],[[14,12,6,6],[42,8,8,6],[14,48,6,8],[44,46,6,6],[32,46,6,6],[42,26,6,6]],[[8,14,6,6],[44,8,8,6],[14,46,6,6],[44,48,6,6],[50,32,6,6],[32,20,6,6]]],
};
export const ORE_HI_SPARK = [[[3.2, 4.2], [9.9, 3.4], [7.0, 9.5]],
  [[3.7, 9.2], [9.0, 8.5], [5.9, 3.4]],
  [[8.7, 4.7], [3.9, 5.9], [6.2, 10.2]],
  [[4.9, 3.9], [9.7, 7.2], [3.9, 9.9]]];
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
export const SKY = ["#4aafff", "#5cbaff", "#6ec4ff", "#82cdff", "#98d8ff", "#b2e3ff"];   // 맵 스타일 A: 또렷한 하늘 띠

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

// 의뢰서 (판매 탭 '의뢰' 분류). 고해상도: ui/icon/order.png (make-icons.py)
ICON.order = sprite(16, 16, (p) => {
  p(3, 1, 10, 14, "#5a4020"); p(4, 2, 8, 12, "#f6e6bc"); p(2, 1, 12, 2, "#a07a40"); p(2, 13, 12, 2, "#a07a40");
  p(5, 5, 6, 1, "#381a0e"); p(5, 7, 6, 1, "#381a0e"); p(5, 9, 3, 1, "#381a0e");
  p(9, 10, 3, 3, "#e23448"); p(9, 10, 1, 1, "#ff7c8c");
});
ICON.chest = sprite(16, 16, (p) => {
  p(2, 5, 12, 9, "#4a2e1b"); p(3, 6, 10, 7, "#8a5a3c"); p(3, 6, 10, 3, "#a8704a");
  p(2, 8, 12, 1, "#4a2e1b"); p(7, 5, 2, 9, "#ffd34d"); p(7, 9, 2, 2, "#14151f");
  p(3, 12, 10, 1, "#6b4329");
});
// 땅속 보물 상자 (흙 위에 겹쳐 그림). 고해상도: tiles/chest.png
export const chestTile = sprite(16, 16, (p, g) => g.drawImage(ICON.chest, 0, 0));
// 플레이어(채굴 로봇) 프레임
export const minerCache = new Map();
// ---- 캐릭터: 미니 굴착기 ----
//  그림 40x40 (화면 120x120 = 3배). 몸통은 가운데 16x16 칸(12~27) = 화면 48px(블록의 3/4). 드릴은 몸통 밖으로 크게 나옴.
//  충돌 크기(HW/HH)는 예전 그대로라 몸통이 충돌 상자보다 큼 → 굴 가장자리가 깎여 보여서 벽에 파묻혀 보이지 않음.
//  드릴만 방향을 바꿈: side = 앞으로, down = 앞쪽 아래로, up = 위로. 몸은 꺾지 않음.
//  장비 단계에 따라 색이 바뀜: 드릴 날(LOOK.drill) · 궤도(LOOK.tracks) · 뒤 평형추(LOOK.crate) · 지붕 등(LOOK.lamp)
export const MINER_SZ = 40, MINER_BOX = 12;
//  part: "all"(기본) · "body"(드릴 원뿔만 뺀 몸) · "drill"(드릴 원뿔만) — 팔 때 드릴만 흙 쪽으로 밀어 넣어 그리려고 나눔
// 고해상도 부품 (public/assets/miner/*.png, 120x120 = 화면 그대로). 파일이 있으면 assets.ts 가 이 캔버스에 덮어씀
//  고해상도 캐릭터는 '드릴 로봇'(노란 몸 + 회색 머리·외눈 + 안테나 두 개 + 통짜 팔 끝 드릴). 파일이 없을 때만 아래 미니 굴착기 도트
//  body_<자세> 는 색 그대로, 나머지는 회색 그림 → 장비 단계 색으로 바꿔 칠함 (cw = 등 탱크, lamp = 안테나 끝 불빛)
export const MINER_HI = {};
for (const k of ["body_side", "body_down", "body_up", "trk_0", "trk_1", "cw", "lamp",
  "bit_side_0", "bit_side_1", "bit_down_0", "bit_down_1", "bit_up_0", "bit_up_1",
  "ant_0", "ant_1", "ant_2", "lamp_0", "lamp_2", "blink_side", "blink_down", "blink_up"]) MINER_HI[k] = sprite(1, 1, () => {});
//  ant_0~2 · lamp_0/lamp/lamp_2: 안테나가 뒤로 · 가운데 · 앞으로 기운 모습 (S.minerAnt) / blink_<자세>: 눈 감은 덮개 (S.minerBlink)
S.minerAnt = 1; S.minerBlink = false;
const minerHiReady = () => Object.values(MINER_HI).every((c) => c.width === MINER_SZ * 3);
// ---- 캐릭터 종류 (tools/chars.py 와 같은 id 순서). 첫 번째 = 기본(노랑이, MINER_HI 그대로) ----
//  다른 캐릭터는 몸·눈 덮개·안테나·안테나 끝 12개만 따로(miner/<id>/*.png), 궤도·등 탱크·드릴은 같이 씀
export const CHAR_IDS = ["yellow", "ruby", "mint", "cobalt", "mole", "night"];
export const CHAR_PARTS = ["body_side", "body_down", "body_up", "blink_side", "blink_down", "blink_up", "ant_0", "ant_1", "ant_2", "lamp_0", "lamp", "lamp_2"];
export const MINER_CH = {};
for (const id of CHAR_IDS.slice(1)) { MINER_CH[id] = {}; for (const k of CHAR_PARTS) MINER_CH[id][k] = sprite(1, 1, () => {}); }
S.charId = "yellow";
//  그 캐릭터 그림이 아직 없으면(파일 못 읽음) 기본 부품으로
const chPart = (k, id) => { const c = MINER_CH[id] && MINER_CH[id][k]; return c && c.width === MINER_SZ * 3 ? c : MINER_HI[k]; };
// 회색 밝기 → 색 단계 (외곽선 · 어둠 · l · m · h · 반짝)
function tintGray(src, ramp) {
  return sprite(src.width, src.height, (p, g) => {
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, src.width, src.height);
    if (!d || !d.data) return;                                            // (테스트용 가짜 캔버스)
    const a = d.data;
    const rgb = ramp.map(hexRgb);
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const v = a[i], t = v < 24 ? 0 : v < 56 ? 1 : v < 104 ? 2 : v < 160 ? 3 : v < 224 ? 4 : 5;
      a[i] = rgb[t][0]; a[i + 1] = rgb[t][1]; a[i + 2] = rgb[t][2];
    }
    g.putImageData(d, 0, 0);
  });
}
const rampOf = (c) => ["#14151f", mixC(c.l, "#000000", 0.35), c.l, c.m, c.h, mixC(c.h, "#ffffff", 0.45)];
function getMinerHi(mode, leg, dig, part, ant, blink, id = S.charId) {
  const TR = LOOK.tracks > 0 ? PAL[LOOK.tracks - 1] : { h: "#c6cedc", m: "#8b93a6", l: "#3a3f52" };
  const DR = LOOK.drill > 0 ? PAL[LOOK.drill - 1] : { h: "#e3e8f2", m: "#9aa3b8", l: "#5b6379" };
  const CP = LOOK.crate > 0 ? PAL[LOOK.crate - 1] : { h: "#4a5262", m: "#2a2e37", l: "#1c1f26" };
  const lc = LOOK.lamp > 0 ? GLOW[LOOK.lamp - 1] : "#3a7bff";                // 안테나 끝 불빛 (조명 없으면 파랑)
  const LP = { h: mixC(lc, "#ffffff", 0.3), m: lc, l: mixC(lc, "#000000", 0.3) };
  const ds = dig < 0 ? 0 : dig;
  return sprite(MINER_SZ * 3, MINER_SZ * 3, (p, g) => {
    if (part !== "drill") {
      g.drawImage(tintGray(MINER_HI["trk_" + (leg & 1)], rampOf(TR)), 0, 0);
      g.drawImage(tintGray(MINER_HI.cw, rampOf(CP)), 0, 0);
      g.drawImage(chPart("body_" + mode, id), 0, 0);
      if (blink) g.drawImage(chPart("blink_" + mode, id), 0, 0);
      g.drawImage(chPart("ant_" + ant, id), 0, 0);
      g.drawImage(tintGray(chPart(ant === 1 ? "lamp" : "lamp_" + ant, id), rampOf(LP)), 0, 0);
    }
    if (part !== "body") g.drawImage(tintGray(MINER_HI["bit_" + mode + "_" + (ds & 1)], rampOf(DR)), 0, 0);
  });
}
// 캐릭터 고르기 창 그림: 옆모습, 지금 장비 색 (120x120)
export function minerPreview(id) {
  const key = "pv|" + id + "|" + LOOK.key + (minerHiReady() ? "hi" : "");
  if (minerCache.has(key)) return minerCache.get(key);
  const full = minerHiReady() ? getMinerHi("side", 0, 0, "all", 1, false, id) : getMiner("side", 0, 0);
  // 빈 여백을 잘라 로봇만 (고해상도 120x120 → 112x92, 안테나 끝 ~ 궤도 밑)
  const im = minerHiReady() ? sprite(112, 92, (p, g) => g.drawImage(full, -8, -2)) : full;
  minerCache.set(key, im);
  return im;
}
export function getMiner(mode, leg, dig, part = "all") {
  const hi = minerHiReady();
  const ant = part === "drill" ? 1 : S.minerAnt | 0, blink = part !== "drill" && !!S.minerBlink;   // 드릴 그림은 안테나·눈과 상관없음
  const key = mode + leg + dig + part + "|" + LOOK.key + (hi ? "|hi" + ant + (blink ? "b" : "") + S.charId : "");
  if (minerCache.has(key)) return minerCache.get(key);
  if (hi) { const im = getMinerHi(mode, leg, dig, part, ant, blink); minerCache.set(key, im); return im; }
  const img = sprite(MINER_SZ, MINER_SZ, (p0) => {
    const p = (x, y, w, h, c) => p0(MINER_BOX + x, MINER_BOX + y, w, h, c);    // 몸통 칸 기준 좌표
    const K = "#14151f", Y = "#ffc21a", Yh = "#ffe27a", Ys = "#c48600", Yd = "#8a5a00";
    const G = "#5ff3ff", Gh = "#e0ffff", Gd = "#1f6a8a", CH = "#2a2e37", CHl = "#4a5262";
    const TR = LOOK.tracks > 0 ? PAL[LOOK.tracks - 1] : null;
    const DR = LOOK.drill > 0 ? PAL[LOOK.drill - 1] : null;
    const CP = LOOK.crate > 0 ? PAL[LOOK.crate - 1] : null;
    const trD = TR ? TR.l : "#3a3f52", trP = TR ? TR.m : "#8b93a6", trH = TR ? TR.h : "#c6cedc";
    const bH = DR ? DR.h : "#e3e8f2", bM = DR ? DR.m : "#9aa3b8", bL = DR ? DR.l : "#5b6379";
    const ds = dig < 0 ? 0 : dig;

    // 드릴 원뿔: (방향 r/d/u, 밑변 가운데, 길이, 밑변 폭). 홈 무늬가 dig 프레임마다 밀려서 도는 것처럼 보임
    const cone = (dir, bx, by, len, base) => {
      const at = (i, k) => (dir === "r" ? [bx + i, by + k] : dir === "d" ? [bx + k, by + i] : [bx + k, by - i]);
      const fill = new Map();
      for (let i = 0; i < len; i++) {
        const h = Math.round(((base - 1) / 2) * (1 - i / len));
        for (let k = -h; k <= h; k++) fill.set(at(i, k).join(","), [i, k, h]);
      }
      for (const key2 of fill.keys()) {                                  // 바깥 윤곽
        const [x, y] = key2.split(",").map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!fill.has((x + dx) + "," + (y + dy))) p(x + dx, y + dy, 1, 1, K);
      }
      for (const [key2, [i, k, h]] of fill) {
        const [x, y] = key2.split(",").map(Number);
        const t = h ? (k + h) / (2 * h) : 0.5;                              // 0 = 위(왼)쪽 · 1 = 아래(오른)쪽
        let c = t < 0.3 ? bH : t < 0.72 ? bM : bL;
        if (h > 0 && ((i + k + ds * 2) & 3) === 0) c = t < 0.3 ? bM : bL;  // 나선 홈
        p(x, y, 1, 1, c);
      }
    };
    if (part !== "drill") {
    // 무한궤도
    p(1, 11, 14, 1, K); p(0, 12, 1, 3, K); p(15, 12, 1, 3, K); p(1, 15, 14, 1, K);
    p(1, 12, 14, 3, trD); p(1, 12, 14, 1, trP);
    for (let i = 0; i < 4; i++) { const wx = 2 + i * 3 + (i > 1 ? 1 : 0); p(wx, 12, 2, 2, trP); p(wx, 12, 1, 1, trH); p(wx + 1, 13, 1, 1, K); }
    for (let i = 0; i < 5; i++) p(1 + i * 3 + leg, 14, 1, 1, K);           // 바퀴 자국: 움직이면 한 칸씩 밀림
    // 뒤 평형추 (화물칸 단계 색)
    const cw = CP || { h: CHl, m: CH, l: K };
    p(0, 5, 2, 6, K); p(0, 6, 2, 4, cw.m); p(0, 6, 1, 1, cw.h);
    if (LOOK.crate >= 4) p(0, 4, 2, 1, cw.h);
    // 차체
    p(1, 8, 13, 4, K); p(2, 9, 11, 2, Y); p(2, 9, 11, 1, Yh); p(2, 10, 11, 1, Ys);
    for (let x = 3; x < 12; x += 3) p(x, 10, 1, 1, Yd);                       // 경고 줄무늬 느낌
    // 운전석
    p(3, 0, 6, 1, K); p(2, 1, 1, 8, K); p(9, 1, 1, 8, K);
    p(3, 1, 6, 8, Y); p(3, 1, 5, 1, Yh); p(3, 1, 1, 6, Yh); p(8, 2, 1, 6, Ys); p(3, 8, 6, 1, Ys);
    p(5, 2, 3, 4, Gd); p(5, 2, 3, 3, G); p(5, 2, 1, 1, Gh); p(6, 2, 1, 1, Gh);   // 유리창
    p(4, 7, 4, 1, Ys);
    // 지붕 등 (조명 단계)
    if (LOOK.lamp > 0) { p(8, -1, 2, 1, K); p(8, -1, 1, 1, GLOW[LOOK.lamp - 1]); } else p(8, -1, 1, 1, "#ff5a4d");
    }
    // 팔 + 드릴 (방향마다)
    const body = part !== "drill", bit = part !== "body";
    if (mode === "side") {
      if (body) { p(10, 3, 2, 6, K); p(10, 4, 1, 4, Y); p(11, 4, 1, 4, Ys); }             // 팔(운전석 앞)
      if (body) { p(12, 2, 4, 9, K); p(12, 3, 3, 7, CH); p(12, 3, 3, 1, CHl); }            // 드릴 모터
      if (bit) cone("r", 16, 6, 10, 9);
    } else if (mode === "down") {
      if (body) { p(10, 3, 2, 6, K); p(10, 4, 1, 4, Y); }
      if (body) { p(12, 5, 3, 11, K); p(12, 6, 2, 9, Y); p(12, 6, 1, 9, Yh); }            // 앞으로 내린 팔 (궤도 앞)
      if (body) { p(9, 15, 9, 3, K); p(10, 15, 7, 2, CH); p(10, 15, 7, 1, CHl); }         // 드릴 모터
      if (bit) cone("d", 13, 18, 8, 9);
    } else {
      if (body) { p(10, -2, 4, 5, K); p(11, -1, 2, 4, Y); p(11, -1, 1, 4, Yh); }         // 위로 든 팔
      if (body) { p(8, -5, 9, 4, K); p(9, -4, 7, 2, CH); p(9, -4, 7, 1, CHl); }           // 드릴 모터
      if (bit) cone("u", 12, -6, 6, 9);
    }
  });
  minerCache.set(key, img);
  return img;
}

// =====================================================================
//  광부(사람) 캐릭터: tools/make-player.py 가 만든 그림 3장 (오른쪽을 봄)
//   body 사람 시트 · pick 곡괭이 1장(회색 날 → 곡괭이 단계 색, 코드로 돌려 휘두름) · pack 백팩 로켓 1장(예전 그림용). 모자 가운데 x 40 · 발바닥 y 68 (draw.ts 의 PCX·PFT)
// =====================================================================
export const PSZ = 80;
//  사람 광부 시트(make-player.py 가 PixelLab 원본으로 만듦): 80x80 칸, 줄 0 = 오른쪽 · 줄 1 = 왼쪽
//   칸 0 서 있기, 칸 1~8 걷기, 칸 9~17 옆 곡괭이질. 점프·오르기·위아래 곡괭이질은 아직 원본이 없어서 이 칸들을 빌려 씀 (원본이 생기면 칸을 더하고 여기만 고치면 됨)
//  애니메이션 = 칸 번호 목록 + 초당 프레임(걷기는 속도에 맞춰 draw.ts 가 정함)
export const PLAYER_ANIM = {
  idle: { f: [0], fps: 0 },
  walk: { f: [1, 2, 3, 4, 5, 6, 7, 8], fps: 8 },
  run: { f: [1, 2, 3, 4, 5, 6, 7, 8], fps: 14 },
  jump: { f: [2, 2, 6], fps: 0 },                                   // 오름 · 꼭대기 · 내려옴 (다리 벌린 칸)
  land: { f: [0], fps: 0 },
  climb: { f: [2, 6], fps: 0 },
  fly: { f: [2], fps: 0 },
  raise: { f: [0], fps: 0 },                                        // 곡괭이 치켜든 자세
  crouch: { f: [4], fps: 0 },                                       // 곡괭이 내리찍은 자세 (팔이 앞으로 나간 칸)
  // 옆 곡괭이질 (PixelLab mine_east.gif 9장 = 칸 9~17). 내리찍는 순간(원본 5번째 장)부터 한 바퀴: 맞음 → 버팀 → 거둠 → 치켜듦 → 휘두름
  mine: { f: [13, 14, 15, 16, 17, 9, 10, 11, 12], fps: 0 },
};
export const PLAYER_MINE_CELLS = 18;                                  // 시트에 곡괭이질 칸까지 있으면 칸 수가 이만큼 (없으면 예전처럼 코드로 휘두름)
//  칸 안의 손(곡괭이 손잡이) 자리 — 오른쪽을 볼 때. 왼쪽은 draw.ts 가 좌우로 뒤집어 씀
export const PGRIP = { raise: [42, 46], crouch: [51, 50], back: [30, 50] };
export const PLAYER_IMG = { body: sprite(1, 1, () => {}), pick: sprite(1, 1, () => {}), pack: sprite(1, 1, () => {}) };
const PLAYER_CACHE = new Map();
// 회색 칸만 단계 색으로 (곡괭이 자루 나무색은 그대로)
function tintGrayOnly(src, ramp) {
  return sprite(src.width, src.height, (p, g) => {
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, src.width, src.height);
    if (!d || !d.data) return;
    const a = d.data, rgb = ramp.map(hexRgb);
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3] || a[i] !== a[i + 1] || a[i + 1] !== a[i + 2]) continue;
      const v = a[i], t = v < 24 ? 0 : v < 56 ? 1 : v < 104 ? 2 : v < 160 ? 3 : v < 224 ? 4 : 5;
      a[i] = rgb[t][0]; a[i + 1] = rgb[t][1]; a[i + 2] = rgb[t][2];
    }
    g.putImageData(d, 0, 0);
  });
}
// 코드로 그린 대체 광부 (시트 파일이 없을 때): 작은 사람 (32px → 2배로 그림)
const PLAYER_FALLBACK = sprite(32, 32, (p) => {
  p(12, 4, 9, 5, "#14151f"); p(13, 5, 7, 4, "#232a3a");
  p(12, 8, 9, 7, "#14151f"); p(13, 9, 7, 5, "#f0c0a0"); p(18, 10, 1, 2, "#14151f");
  p(12, 15, 9, 8, "#14151f"); p(13, 15, 7, 7, "#1f6f8a"); p(15, 15, 2, 6, "#6a1a2a");
  p(13, 23, 3, 5, "#24202e"); p(17, 23, 3, 5, "#24202e"); p(12, 28, 4, 2, "#14151f"); p(17, 28, 4, 2, "#14151f");
});
//  몸 칸 하나 (anim 의 i 번째, facing 1 오른쪽 · -1 왼쪽). 시트가 없으면 대체 그림
export function playerFrame(anim, i, facing = 1) {
  const src = PLAYER_IMG.body;
  if (src.width < PSZ) return PLAYER_FALLBACK;
  const A = PLAYER_ANIM[anim] || PLAYER_ANIM.idle, n = A.f.length, c = A.f[((i % n) + n) % n];
  const r = facing < 0 && src.height >= PSZ * 2 ? 1 : 0;
  const key = "b" + c + "," + r;
  let im = PLAYER_CACHE.get(key);
  if (!im) { im = sprite(PSZ, PSZ, (p, g) => g.drawImage(src, c * PSZ, r * PSZ, PSZ, PSZ, 0, 0, PSZ, PSZ)); PLAYER_CACHE.set(key, im); }
  return im;
}
//  로봇(탈것) 시트 mech/body.png (make-player.py 가 PixelLab 원본으로 만듦): 104x104 칸, 줄 0 오른쪽 · 줄 1 왼쪽
//   칸 0 서 있기 · 1~8 걷기 · 9~17 점프(9~11 웅크림 · 12 점화 · 13~14 로켓 상승 · 15~16 착지 분사 · 17 착지 끝). 불꽃은 그림에 들어 있음
//   18~26 옆 캐기(18 기준 자세 · 19~22 오른팔 톱니바퀴를 앞으로 내지름 · 23~26 톱니바퀴가 돌며 불꽃)
//   27~35 아래 캐기 · 36~44 위 캐기 (같은 짜임: 첫 칸 기준 · 1~4 내지르기 · 5~8 회전. 원본이 없으면 임시 칸)
export const MSZ = 104, MCX = 52, MFT = 96;                          // 칸 크기 · 몸 가운데 x · 발바닥 y
export const MECH_ANIM = {
  idle: [0],
  walk: [1, 2, 3, 4, 5, 6, 7, 8],
  takeoff: [11, 12],                                                // 점화 순간 (한 번)
  fly: [13, 14],                                                    // 누르고 있는 동안 (반복)
  fall: [17],                                                       // 불 꺼지고 떨어지는 중
  land: [16, 9],                                                    // 착지: 발밑 분사 → 무릎 굽힘
  dig_in: [19, 20, 21, 22],                                         // 캐기 시작: 팔 내지르기 (한 번)
  dig: [23, 24, 25, 26],                                            // 계속 캐는 동안 톱니바퀴 회전 (반복)
  dig_down_in: [28, 29, 30, 31], dig_down: [32, 33, 34, 35],
  dig_up_in: [37, 38, 39, 40], dig_up: [41, 42, 43, 44],
};
export const MECH_IMG = { body: sprite(1, 1, () => {}) };
//  로봇 칸 하나. 시트가 없으면 null → 예전 코드 로봇
export function mechFrame(anim, i, facing = 1) {
  const src = MECH_IMG.body;
  if (src.width < MSZ) return null;
  const f = MECH_ANIM[anim] || MECH_ANIM.idle, r = facing < 0 ? 1 : 0;
  let c = f[((i % f.length) + f.length) % f.length];
  if ((c + 1) * MSZ > src.width) c = 0;                             // 시트에 그 칸이 없으면(예전 시트) 서 있기로
  const key = "m" + c + "," + r;
  let im = PLAYER_CACHE.get(key);
  if (!im) { im = sprite(MSZ, MSZ, (p, g) => g.drawImage(src, c * MSZ, r * MSZ, MSZ, MSZ, 0, 0, MSZ, MSZ)); PLAYER_CACHE.set(key, im); }
  return im;
}
//  곡괭이 (tier 0 = 기본 녹슨 쇠, 1~ = PICK_TIER 색). 시트가 없으면 null
export function pickImg(tier = 0) {
  const src = PLAYER_IMG.pick;
  if (src.width < 8) return null;
  const key = "p" + tier;
  let im = PLAYER_CACHE.get(key);
  if (!im) {
    const c = tier > 0 ? PAL[PICK_TIER[Math.min(PICK_TIER.length, tier) - 1]] : { h: "#a89c90", m: "#6e6458", l: "#3e3630" };
    im = tintGrayOnly(src, rampOf(c)); PLAYER_CACHE.set(key, im);
  }
  return im;
}
export const clearPlayerCache = () => PLAYER_CACHE.clear();
