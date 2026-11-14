// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.

// =====================================================================
//  설정
// =====================================================================
export const T = 32;            // 화면상 타일 크기(px). 아트는 16x16을 2배 확대해서 그림
export const W = 384, H = 2400; // 월드 크기(타일): 왼쪽은 마을, 오른쪽은 광산 터. 32x32 구역 단위로 다가가면 생성 (core/world.ts)
export const SURF = 6;          // 지표면 행
export const HW = 12, HH = 12;  // 플레이어 충돌 반폭/반높이
export const SEED = 1234;
export const BUILD_COLS = [[1, 7], [8, 14], [15, 19]];   // 상점 / 제작소 / 용광로 (왼쪽에 나란히). 정비소는 없앰 → 지상에 나오면 연료 충전
export const B_SHOP = 0, B_CRAFT = 1, B_FURN = 2;                 // BUILD_COLS 순서
export const MINE_COL = BUILD_COLS[BUILD_COLS.length - 1][1] + 1;  // 여기부터 오른쪽이 광산 터
export const inB = (k, c) => c >= BUILD_COLS[k][0] && c <= BUILD_COLS[k][1];

// 타일 종류: 0 공기, 1 흙, 2 구리, 3 철, 4 금, 5 다이아, 7 암반
export const TILE = {
  1: { name: "흙",     hard: 0.35, value: 0 },
  2: { name: "구리",   hard: 0.55, value: 10 },
  3: { name: "철",     hard: 0.75, value: 25 },
  4: { name: "금",     hard: 1.00, value: 80 },
  5: { name: "다이아", hard: 1.60, value: 300 },
  6: { name: "석탄",   hard: 0.45, value: 6 },
  8: { name: "은",     hard: 0.85, value: 50 },
  9: { name: "에메랄드", hard: 1.25, value: 140 },
  10: { name: "루비",   hard: 1.45, value: 200 },
  11: { name: "미스릴", hard: 2.00, value: 600 },
  14: { name: "나무 지지대", hard: Infinity, value: 0 },   // 지나갈 수 있는 설치물
  15: { name: "강철 지지대", hard: Infinity, value: 0 },
  13: { name: "기초석", hard: Infinity, value: 0 },    // 건물 아래 땅 (부술 수 없음)
  12: { name: "돌",    hard: Infinity, value: 0 },     // 드릴로 못 팜 → 다이너마이트
  16: { name: "경암",  hard: 2.6, value: 0 },          // 희귀 광물을 감싼 단단한 암석 (드릴로 오래 걸림)
  7: { name: "암반",   hard: Infinity, value: 0 },
};
// 광물 색상 [밝은색, 기본색, 어두운색]
export const ORE_COL = {
  2: ["#ffb27a", "#e0803a", "#a34a1f"],
  3: ["#f2f6fa", "#b9c2cc", "#7d8794"],
  4: ["#fff08a", "#ffd34d", "#c98f1a"],
  5: ["#e8ffff", "#5ef2ff", "#2aa6c9"],
  6: ["#6a6f80", "#2b2d38", "#14151b"],
  8: ["#ffffff", "#c9d6e8", "#8393ad"],
  9: ["#b8ffcf", "#3ddc84", "#1b8f50"],
  10: ["#ffc0c0", "#ff4d5e", "#a11a2f"],
  11: ["#d7fff6", "#6ef2d4", "#2a9d92"],
};
// 지층 (깊이 m 기준)
export const LAYERS = [
  { name: "흙층",     from: 0,    base: "#6b4a2f", hi: "#7d5a3a", lo: "#573b25", peb: "#8a8077" },
  { name: "점토층",   from: 60,   base: "#7a4436", hi: "#8d5443", lo: "#63372b", peb: "#a8826e" },
  { name: "암석층",   from: 140,  base: "#5d6070", hi: "#70748a", lo: "#4a4d5b", peb: "#8d92a8" },
  { name: "심층 코어", from: 250,  base: "#3f3358", hi: "#51436e", lo: "#30274a", peb: "#6a5c91" },
  { name: "용암 지대", from: 450,  base: "#5a2a24", hi: "#743731", lo: "#421d19", peb: "#c0582e" },
  { name: "수정 동굴", from: 800,  base: "#24434f", hi: "#2f5866", lo: "#1a323b", peb: "#7fd8e0" },
  { name: "고대 화석층", from: 1300, base: "#6d6450", hi: "#837962", lo: "#544c3c", peb: "#d8ccae" },
  { name: "심연",     from: 1900, base: "#1d2236", hi: "#272d46", lo: "#151928", peb: "#5a6aa8" },
];
export const layerOf = (d) => { let i = 0; while (i + 1 < LAYERS.length && d >= LAYERS[i + 1].from) i++; return i; };

