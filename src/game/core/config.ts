// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.

// =====================================================================
//  설정
// =====================================================================
export const T = 64;            // 화면상 타일 크기(px). 16x16 타일 그림을 4배로. 캐릭터(32px)의 2배라 동굴을 탐험하는 느낌
export const AS = T / 16;       // 타일·건물 그림 배율(4). 캐릭터 그림은 2배 그대로 → 확대 배율이 0.5 단위면 둘 다 도트가 안 깨짐
export const PX = T / 32;       // 속도·중력 같은 px 단위 숫자의 배율 (타일 32px 시절 기준값 × PX → 칸당 걸리는 시간은 그대로)
export const W = 384, H = 2400; // 월드 크기(타일): 왼쪽은 마을, 오른쪽은 광산 터. 32x32 구역 단위로 다가가면 생성 (core/world.ts)
//  돈 표시 (원, 한국식): 9만 5천원 · 9만 8,089원 · 4,200원 · 5천원 · 1억 2,000만원
export function won(n) {
  n = Math.round(Number(n) || 0);
  if (n < 0) return "-" + won(-n);
  const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
  const p = [];
  if (eok) p.push(eok.toLocaleString("ko-KR") + "억");
  if (man) p.push(man.toLocaleString("ko-KR") + "만");
  if (rest || !p.length) p.push(rest && rest % 1000 === 0 ? rest / 1000 + "천" : rest.toLocaleString("ko-KR"));
  return p.join(" ") + "원";
}
//  큰 개수 줄여 쓰기 (창고·화물 칸): 9,999 · 1.2만 · 34만 · 3.4억 · 12조
export function cnum(n) {
  n = Math.floor(Number(n) || 0);
  if (n < 1e4) return n.toLocaleString("ko-KR");
  const f = (v, u) => (v < 10 ? (Math.floor(v * 10) / 10).toString() : Math.floor(v).toLocaleString("ko-KR")) + u;
  return n < 1e8 ? f(n / 1e4, "만") : n < 1e12 ? f(n / 1e8, "억") : f(n / 1e12, "조");
}
export const SURF = 6;          // 지표면 행
export const HW = 12, HH = 12;  // 플레이어 충돌 반폭/반높이
export const SEED = 1234;
// 마을 건물은 한 채(상점 · 제작소 · 용광로 · 판매를 합침, 2026-11-25). 들어가면 마을 창 4탭. 정비소는 없음 → 지상에 나오면 연료 충전
export const BUILD_COLS = [[2, 6]];
export const B_SHOP = 0, B_CRAFT = 0, B_FURN = 0;                 // 예전 세 건물 번호 → 모두 같은 한 채
export const MINE_COL = 13;                                       // 여기부터 오른쪽이 광산 터. 건물 한 채 + 차고(7~10칸) 바로 뒤 (예전 22 → 13, 2026-11-25: 남는 마을 땅을 줄임. 옛 월드의 13~21칸 기초석은 fixFoundation 이 흙으로)
export const inTown = (c) => c >= 1 && c < MINE_COL;             // 마을 땅(기초석, 못 팜)
export const inB = (k, c) => c >= BUILD_COLS[k][0] && c <= BUILD_COLS[k][1];

// 광물 값(value, 원) · 한 번 캘 때 나오는 개수(yield, 행운 0 기준) — 2026-11-28 방치형 개편:
//   지층마다 그 지층 광물만 나옴(world.ts ORE_GEN) · 값은 지층마다 약 4배씩 · 얕은 광물일수록 한 번에 많이 (행운을 다 올리면 석탄 ~70개, 별 조각 ~3개, stats.ts oreYield)
//   맞춘 기준: tools/econ-sim.py 로 끝까지 약 600번 왕복 (예전 경제와 비슷하게)
// 타일 종류: 0 공기, 1 흙, 2 구리, 3 철, 4 금, 5 다이아, 7 암반, 17 보물 상자, 20~31 새 광물 (2026-11-28)
export const TILE = {
  1: { name: "흙",     hard: 0.35, value: 0 },
  2: { name: "구리",   hard: 0.55, value: 12, yield: 10 },
  3: { name: "철",     hard: 0.75, value: 40, yield: 8 },
  4: { name: "금",     hard: 1.00, value: 130, yield: 6 },
  5: { name: "다이아", hard: 1.60, value: 600, yield: 5 },
  6: { name: "석탄",   hard: 0.45, value: 8, yield: 10 },
  8: { name: "은",     hard: 0.85, value: 50, yield: 8 },
  9: { name: "에메랄드", hard: 1.25, value: 200, yield: 6 },
  10: { name: "루비",   hard: 1.45, value: 500, yield: 5 },
  11: { name: "미스릴", hard: 2.00, value: 2400, yield: 4 },
  // 새 광물 12종 (2026-11-28): 지층마다 1~2개. fragile = 약해서 로봇 톱니로 캐면 부서짐(사람 곡괭이로만)
  20: { name: "석영",     hard: 0.50, value: 15, yield: 9 },
  21: { name: "호박",     hard: 0.40, value: 60, yield: 6, fragile: true },
  22: { name: "자수정",   hard: 1.20, value: 170, yield: 6 },
  23: { name: "사파이어", hard: 1.55, value: 680, yield: 5 },
  24: { name: "흑요석",   hard: 2.10, value: 2000, yield: 4 },
  25: { name: "화염석",   hard: 2.20, value: 3000, yield: 4 },
  26: { name: "수정 결정", hard: 2.30, value: 9200, yield: 3 },
  27: { name: "오팔",     hard: 1.30, value: 17000, yield: 2, fragile: true },
  28: { name: "아다만트", hard: 2.60, value: 35000, yield: 2 },
  29: { name: "고대 호박", hard: 1.40, value: 62000, yield: 1.5, fragile: true },
  30: { name: "공허석",   hard: 2.90, value: 150000, yield: 1.5 },
  31: { name: "별 조각",  hard: 3.20, value: 600000, yield: 0.5 },
  14: { name: "나무 지지대", hard: Infinity, value: 0 },   // 지나갈 수 있는 설치물
  15: { name: "강철 지지대", hard: Infinity, value: 0 },
  13: { name: "기초석", hard: Infinity, value: 0 },    // 건물 아래 땅 (부술 수 없음)
  12: { name: "돌",    hard: Infinity, value: 0 },     // 드릴로 못 팜 → 다이너마이트
  16: { name: "경암",  hard: 2.6, value: 0 },          // 희귀 광물을 감싼 단단한 암석 (드릴로 오래 걸림)
  7: { name: "암반",   hard: Infinity, value: 0 },
  17: { name: "보물 상자", hard: 0.5, value: 0 },     // 땅속에 드물게 묻힌 상자: 부수면 돈 (가끔 소모품)
  19: { name: "사다리", hard: Infinity, value: 0 },    // 사람이 오르내리는 설치물 (지나갈 수 있음, 소모품 '사다리'를 떨어뜨리면 아래로 펼쳐짐)
  18: { name: "가스 주머니", hard: 0.4, value: 0 },   // 암석층(140m)부터: 뚫으면 가스가 새어 나와 그 안에서는 연료가 빨리 닳음 (폭파하면 타서 없어짐)
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
  20: ["#ffffff", "#e4dcef", "#a297b4"],   // 석영: 뿌연 흰 결정
  21: ["#ffe7a3", "#f2a52a", "#9a5a0c"],   // 호박: 꿀빛
  22: ["#f1d6ff", "#b26ee8", "#6a2c9c"],   // 자수정: 보라
  23: ["#cfe0ff", "#3f72f0", "#1b2f8c"],   // 사파이어: 짙은 파랑
  24: ["#9c8fb8", "#3d3350", "#17121f"],   // 흑요석: 검보라 유리
  25: ["#fff0a0", "#ff6a20", "#a8220c"],   // 화염석: 주황 불꽃
  26: ["#f6f2ff", "#bcc8ff", "#6a78d6"],   // 수정 결정: 옅은 남빛
  27: ["#fff4fc", "#f7b6e6", "#8c8ad8"],   // 오팔: 분홍·보라 무지갯빛
  28: ["#eeffc4", "#9ccd36", "#4a6a12"],   // 아다만트: 연두 금속
  29: ["#ffd2a2", "#d4621c", "#6c2a08"],   // 고대 호박: 진한 주황
  30: ["#d6c6ff", "#5c3cd2", "#1c1044"],   // 공허석: 깊은 보라
  31: ["#ffffff", "#fff6a8", "#d2b03e"],   // 별 조각: 흰 금빛
};
// 광물 순서(싼 것 → 비싼 것): 통계·판매·화물 칸 표시 순서. 새 광물(20~31)은 값 자리에 끼움
export const ORE_ORDER = [6, 2, 20, 3, 8, 21, 4, 22, 9, 10, 5, 23, 24, 11, 25, 26, 27, 28, 29, 30, 31];
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

