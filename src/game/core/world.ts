// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./config.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { BUILD_COLS, H, SEED, SURF, TILE, W } from "./config.ts";

// =====================================================================
//  월드 생성 (시드 기반)
// =====================================================================
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
export const tiles = new Uint8Array(W * H);
export const seen = new Uint8Array(W * H);
export const rub = new Uint8Array(W * H);          // 붕괴로 다시 채워진 칸 = 1 (시간이 지나면 광물이 생길 수 있음)
export const regenT = new Float32Array(W * H);     // 광물 재생까지 남은 시간(초, 저장 안 함)
export const warn = new Float32Array(W * H);       // 천장 불안정 누적 시간(초, 저장 안 함)     // 한 번 본 칸 = 1 (어둠 속에서도 흐릿하게 기억)
// 광물 분포(깊이 m 기준): start부터 한두 개씩(trace) 나오기 시작 → rs~re 구간에서 가장 많이(peak) → end까지 줄어서 tail로 유지
export const ORE_GEN = [
  { id: 6,  start: 2,   rs: 4,   re: 50,  end: 150, peak: 0.090, tail: 0.012, trace: 0.02 },    // 석탄
  { id: 2,  start: 0,   rs: 0,   re: 70,  end: 160, peak: 0.080, tail: 0.015, trace: 0.08 },    // 구리
  { id: 3,  start: 20,  rs: 45,  re: 130, end: 260, peak: 0.060, tail: 0.015, trace: 0.004 },   // 철
  { id: 8,  start: 50,  rs: 85,  re: 170, end: 290, peak: 0.040, tail: 0.012, trace: 0.003 },   // 은
  { id: 4,  start: 90,  rs: 130, re: 230, end: 340, peak: 0.035, tail: 0.012, trace: 0.003 },   // 금
  { id: 9,  start: 130, rs: 175, re: 290, end: 392, peak: 0.028, tail: 0.016, trace: 0.0025 },  // 에메랄드
  { id: 5,  start: 175, rs: 235, re: 340, end: 392, peak: 0.022, tail: 0.016, trace: 0.0025 },  // 다이아몬드
  { id: 10, start: 230, rs: 290, re: 392, end: 392, peak: 0.018, tail: 0.018, trace: 0.002 },   // 루비
  { id: 11, start: 280, rs: 340, re: 392, end: 392, peak: 0.014, tail: 0.014, trace: 0.0015 },  // 미스릴
];
export function oreProb(g, d) {
  if (d < g.start) return 0;
  if (d < g.rs) return g.trace + (g.peak - g.trace) * Math.pow((d - g.start) / (g.rs - g.start), 2);
  if (d <= g.re) return g.peak;
  if (d < g.end) return g.peak + (g.tail - g.peak) * ((d - g.re) / (g.end - g.re));
  return g.tail;
}
// 깊을수록 땅이 단단해짐: 흙은 100m마다 +80%, 광물은 +40%
export const hardOf = (id, r) => { const d = Math.max(0, r - SURF); return TILE[id].hard * (1 + d * (id === 1 ? 0.008 : 0.004)); };
export const ORE_SINGLE = 0.15, ORE_VEIN = 0.85;      // 낱개로 박힌 광물 / 광맥(덩어리) 비율
export const VEIN_SIZE = { 6: [5, 12], 2: [4, 9], 3: [4, 8], 8: [3, 7], 4: [3, 6], 9: [2, 5], 5: [2, 4], 10: [2, 4], 11: [1, 3] };   // 광맥 크기(칸)
export const SHELL_P = { 4: 0.25, 9: 0.45, 5: 0.65, 10: 0.75, 11: 0.9 };   // 희귀 광물이 암석에 싸여 있을 확률
export const SHELL_STONE = { 10: 0.2, 11: 0.35 };                            // 그중 다이너마이트가 필요한 돌 껍질 확률
// 시드로 월드를 만듭니다. 계정마다 시드가 달라서 계정마다 다른 월드가 나옵니다.
export function genWorld(seed) {
  const rng = mulberry32(seed);
  tiles.fill(0);
  for (let r = SURF; r < H; r++) {
    const d = r - SURF;
    for (let c = 0; c < W; c++) {
      let t = 1;
      if (c === 0 || c === W - 1 || r >= H - 2) t = 7;
      else if (d > 5 && rng() < 0.02) t = 0;
      else {
        let p = rng();
        for (const g of ORE_GEN) {
          p -= oreProb(g, d) * ORE_SINGLE;
          if (p < 0) { t = g.id; break; }
        }
      }
      tiles[r * W + c] = t;
    }
  }
  // 광맥: 같은 광물이 덩어리로 뭉쳐 있음(마인크래프트처럼)
  for (let r = SURF + 2; r < H - 3; r++) {
    const d = r - SURF;
    for (let c = 1; c < W - 1; c++) {
      for (const g of ORE_GEN) {
        const [s0, s1] = VEIN_SIZE[g.id];
        const pr = oreProb(g, d) * ORE_VEIN / ((s0 + s1) / 2);
        if (pr <= 0 || rng() >= pr) continue;
        const n = s0 + ((rng() * (s1 - s0 + 1)) | 0);
        const cells = [[c, r]];
        if (tiles[r * W + c] === 1) tiles[r * W + c] = g.id;
        for (let tries = 0; cells.length < n && tries < n * 6; tries++) {
          const [x0, y0] = cells[(rng() * cells.length) | 0], m = (rng() * 4) | 0;
          const x = x0 + (m === 0 ? 1 : m === 1 ? -1 : 0), y = y0 + (m === 2 ? 1 : m === 3 ? -1 : 0);
          if (x > 0 && x < W - 1 && y > SURF + 1 && y < H - 2 && tiles[y * W + x] === 1) { tiles[y * W + x] = g.id; cells.push([x, y]); }
        }
      }
    }
  }
  // 희귀 광물 껍질: 덩어리를 경암(가끔 돌)이 감싸고 있어서 캐기 어려움
  const done = new Uint8Array(W * H);
  for (let i = (SURF + 2) * W; i < (H - 2) * W; i++) {
    const id = tiles[i];
    if (!SHELL_P[id] || done[i]) continue;
    const comp = [i]; done[i] = 1;
    for (let q = 0; q < comp.length; q++) {
      const k = comp[q];
      for (const j of [k - 1, k + 1, k - W, k + W]) if (!done[j] && tiles[j] === id) { done[j] = 1; comp.push(j); }
    }
    if (rng() >= SHELL_P[id]) continue;
    const stone = rng() < (SHELL_STONE[id] || 0);
    for (const k of comp) for (const j of [k - 1, k + 1, k - W, k + W, k - W - 1, k - W + 1, k + W - 1, k + W + 1]) {
      const cj = j % W;
      if (cj <= 0 || cj >= W - 1 || j < (SURF + 2) * W || tiles[j] !== 1) continue;
      if (rng() < 0.8) tiles[j] = stone ? 12 : 16;
    }
  }
  addStones(seed);
  fixFoundation();
  resetSeen();
  rub.fill(0); warn.fill(0);
}
genWorld(SEED);
// 건물 자리(열 범위). 이 아래 두 줄은 기초석이라 부술 수 없음
export function fixFoundation() {
  for (const b of BUILD_COLS) for (let c = b[0]; c <= b[1]; c++) for (let r = SURF; r <= SURF + 1; r++) tiles[r * W + c] = 13;
}
fixFoundation();
// 돌 장애물: 드릴로 못 파고 다이너마이트로만 부술 수 있음 (덩어리 + 가로 암석대)
export function addStones(seed) {
  const rng = mulberry32((seed ^ 0x5f3759df) | 0);
  const put = (c, r) => {
    if (c < 1 || c > W - 2 || r < SURF + 8 || r >= H - 2) return;
    const v = tiles[r * W + c];
    if (v !== 0 && v !== 7 && v !== 12) tiles[r * W + c] = 12;
  };
  for (let r = SURF + 8; r < H - 3; r++) for (let c = 1; c < W - 1; c++) {
    if (rng() < 0.006 + Math.min(0.012, (r - SURF) / 25000)) {
      let cc = c, rr = r;
      const n = 2 + ((rng() * 4) | 0);
      for (let k = 0; k < n; k++) { put(cc, rr); const q = rng(); if (q < 0.35) cc++; else if (q < 0.7) cc--; else rr++; }
    }
  }
  // 가로 암석대(2칸 두께): 좁은 통로가 하나 있어서 찾아 돌아가거나 폭파해서 뚫음
  for (let bd = 25 + ((rng() * 10) | 0); bd < H - SURF - 6; bd += 38 + ((rng() * 20) | 0)) {
    const g = 2 + ((rng() * (W - 6)) | 0);
    for (let k = 0; k < 2; k++) {
      for (let c = 1; c < W - 1; c++) {
        const inGap = k === 0 ? (c === g || c === g + 1) : (c === g + 1 || c === g + 2);
        if (!inGap) put(c, SURF + bd + k);
      }
    }
  }
}
export function resetSeen() {
  seen.fill(0);
  for (let r = 0; r < SURF + 4; r++) for (let c = 0; c < W; c++) seen[r * W + c] = 1;   // 지상 근처는 처음부터 밝음
}
export function legacySeen() {                                   // 예전 저장: 이미 뚫린 곳은 본 것으로 처리
  resetSeen();
  for (let r = SURF; r < H; r++) for (let c = 0; c < W; c++) {
    if (tiles[r * W + c] !== 0) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < H && cc >= 0 && cc < W) seen[rr * W + cc] = 1;
    }
  }
}

export const solid = (c, r) => {
  if (c < 0 || c >= W || r >= H) return true;
  if (r < 0) return false;
  const v = tiles[r * W + c];
  return v !== 0 && v !== 14 && v !== 15;       // 지지대는 지나갈 수 있음
};
export const isAir = (c, r) => r >= SURF && c >= 0 && c < W && r < H && (tiles[r * W + c] === 0 || tiles[r * W + c] === 14 || tiles[r * W + c] === 15);

