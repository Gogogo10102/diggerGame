// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./config.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { BUILD_COLS, H, SEED, SURF, TILE, W, inTown } from "./config.ts";

// =====================================================================
//  월드 생성 (시드 기반)
// =====================================================================
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
export const tiles = new Uint8Array(W * H);
export const baseTiles = new Uint8Array(W * H);  // 처음 생성된 모양(저장할 때 '바뀐 칸'만 고르려고 비교용)
export const seen = new Uint8Array(W * H);
export const rub = new Uint8Array(W * H);          // 붕괴로 다시 채워진 칸 = 1 (시간이 지나면 광물이 생길 수 있음)
export const rubSet = new Set();                   // rub=1 인 칸 목록 (맵이 커서 전체를 매번 훑지 않으려고)
export const setRub = (i, v) => { rub[i] = v ? 1 : 0; if (v) rubSet.add(i); else rubSet.delete(i); };
export const regenT = new Float32Array(W * H);     // 광물 재생까지 남은 시간(초, 저장 안 함)
export const warn = new Float32Array(W * H);       // 천장 불안정 누적 시간(초, 저장 안 함)
// 광물 분포(깊이 m 기준): start부터 한두 개씩(trace) 나오기 시작 → rs~re 구간에서 가장 많이(peak) → end까지 줄어서 tail로 유지
export const ORE_GEN = [
  { id: 6,  start: 2,   rs: 4,   re: 50,  end: 150, peak: 0.090, tail: 0.012, trace: 0.02 },    // 석탄
  { id: 2,  start: 0,   rs: 0,   re: 70,  end: 160, peak: 0.080, tail: 0.015, trace: 0.08 },    // 구리
  { id: 3,  start: 20,  rs: 45,  re: 130, end: 260, peak: 0.060, tail: 0.015, trace: 0.004 },   // 철
  { id: 8,  start: 50,  rs: 85,  re: 170, end: 290, peak: 0.040, tail: 0.012, trace: 0.003 },   // 은
  { id: 4,  start: 90,  rs: 130, re: 230, end: 340, peak: 0.035, tail: 0.012, trace: 0.003 },   // 금
  { id: 9,  start: 130, rs: 175, re: 290, end: 700, peak: 0.028, tail: 0.014, trace: 0.0025 },  // 에메랄드
  { id: 5,  start: 175, rs: 235, re: 500, end: 1000, peak: 0.022, tail: 0.016, trace: 0.0025 }, // 다이아몬드
  { id: 10, start: 230, rs: 290, re: 900, end: 1600, peak: 0.018, tail: 0.016, trace: 0.002 },  // 루비
  { id: 11, start: 280, rs: 340, re: 2400, end: 2400, peak: 0.014, tail: 0.014, trace: 0.0015 }, // 미스릴 (깊을수록 계속)
];
export function oreProb(g, d) {
  if (d < g.start) return 0;
  if (d < g.rs) return g.trace + (g.peak - g.trace) * Math.pow((d - g.start) / (g.rs - g.start), 2);
  if (d <= g.re) return g.peak;
  if (d < g.end) return g.peak + (g.tail - g.peak) * ((d - g.re) / (g.end - g.re));
  return g.tail;
}
// 깊을수록 땅이 단단해짐: 400m까지는 흙 100m마다 +80%·광물 +40%, 그 아래는 4분의 1 속도로 (맵이 깊어져서 끝없이 단단해지지 않게)
export const hardOf = (id, r) => {
  const d = Math.max(0, r - SURF), k = id === 1 ? 0.008 : 0.004;
  return TILE[id].hard * (1 + Math.min(d, 400) * k + Math.max(0, d - 400) * k * 0.25);
};
export const ORE_SINGLE = 0.15, ORE_VEIN = 0.85;      // 낱개로 박힌 광물 / 광맥(덩어리) 비율
export const VEIN_SIZE = { 6: [5, 12], 2: [4, 9], 3: [4, 8], 8: [3, 7], 4: [3, 6], 9: [2, 5], 5: [2, 4], 10: [2, 4], 11: [1, 3] };   // 광맥 크기(칸)
export const SHELL_P = { 4: 0.25, 9: 0.45, 5: 0.65, 10: 0.75, 11: 0.9 };   // 희귀 광물이 암석에 싸여 있을 확률
export const SHELL_STONE = { 10: 0.2, 11: 0.35 };                            // 그중 다이너마이트가 필요한 돌 껍질 확률
// =====================================================================
//  구역(32x32칸) 단위 생성
//   - 맵 전체를 한 번에 만들지 않고, 플레이어·화면 근처 구역만 그때그때 만듭니다(ensureAround / ensureRect).
//   - 구역 모양은 (시드, 구역 위치)만으로 정해져서 언제 어떤 순서로 만들어도 똑같음 → 저장은 '처음과 달라진 칸'만.
//   - 광맥·돌덩이는 이웃 구역으로 넘어갈 수 있어서, 구역을 만들 때 주변 3x3 구역의 광맥을 모두 계산해 자기 칸만 칠함.
// =====================================================================
export const CH = 32, CW = Math.ceil(W / CH), CHN = Math.ceil(H / CH);
export const genMask = new Uint8Array(CW * CHN);   // 만들어진 구역 = 1
export const WGEN = { seed: SEED, bands: [], feat: new Map(), caveOff: false };   // caveOff: 테스트에서 굴을 직접 만들 때만 끔
export const PREGEN = { cx: 2, cy: 14 };           // 시작할 때 미리 만드는 범위(구역 수): 마을과 그 아래 448m
export const hash32 = (a, b, c, d) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1) ^ Math.imul(d + 0x7f4a7c15, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
};
const cellRand = (c, r, salt) => hash32(WGEN.seed, c, r, salt) / 4294967296;
// 칸 하나의 바탕(흙/낱개 광물/작은 빈 굴/암반). 광맥·돌은 그 위에 덮음
export function baseCell(c, r) {
  if (r < SURF) return 0;
  if (c === 0 || c === W - 1 || r >= H - 2) return 7;
  const d = r - SURF;
  if (d > 5 && cellRand(c, r, 1) < 0.02) return 0;
  let p = cellRand(c, r, 2);
  for (const g of ORE_GEN) { p -= oreProb(g, d) * ORE_SINGLE; if (p < 0) return g.id; }
  return 1;
}
// 구역 하나에서 시작하는 광맥/껍질/돌덩이 (이웃 구역 칸까지 걸칠 수 있음). 한 번 계산하면 기억
export function chunkFeatures(cx, cy) {
  const key = cy * CW + cx;
  const hit = WGEN.feat.get(key);
  if (hit) return hit;
  const rng = mulberry32(hash32(WGEN.seed, cx, cy, 0x51ed));
  const veins = [], stones = [];
  const r0 = Math.max(SURF + 2, cy * CH), r1 = Math.min(H - 4, cy * CH + CH - 1);
  const c0 = Math.max(1, cx * CH), c1 = Math.min(W - 2, cx * CH + CH - 1);
  for (let r = r0; r <= r1; r++) {
    const d = r - SURF;
    for (let c = c0; c <= c1; c++) {
      for (const g of ORE_GEN) {
        const [s0, s1] = VEIN_SIZE[g.id];
        const pr = oreProb(g, d) * ORE_VEIN / ((s0 + s1) / 2);
        if (pr <= 0 || rng() >= pr) continue;
        const n = s0 + ((rng() * (s1 - s0 + 1)) | 0);
        const cells = [[c, r]], has = new Set([r * W + c]);
        for (let tries = 0; cells.length < n && tries < n * 6; tries++) {
          const [x0, y0] = cells[(rng() * cells.length) | 0], m = (rng() * 4) | 0;
          const x = x0 + (m === 0 ? 1 : m === 1 ? -1 : 0), y = y0 + (m === 2 ? 1 : m === 3 ? -1 : 0);
          if (x > 0 && x < W - 1 && y > SURF + 1 && y < H - 2 && !has.has(y * W + x)) { has.add(y * W + x); cells.push([x, y]); }
        }
        const v = { id: g.id, cells, shell: null, shellId: 0 };
        // 희귀 광물 껍질: 덩어리를 경암(가끔 돌)이 감쌈
        if (SHELL_P[g.id] && rng() < SHELL_P[g.id]) {
          v.shellId = rng() < (SHELL_STONE[g.id] || 0) ? 12 : 16;
          v.shell = [];
          for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const xx = x + dx, yy = y + dy;
            if (xx <= 0 || xx >= W - 1 || yy < SURF + 2 || yy >= H - 2 || has.has(yy * W + xx)) continue;
            if (rng() < 0.8) v.shell.push([xx, yy]);
          }
        }
        veins.push(v);
      }
      // 돌 장애물: 드릴로 못 파고 다이너마이트로만 부숨
      if (r >= SURF + 8 && rng() < 0.006 + Math.min(0.012, d / 25000)) {
        let cc = c, rr = r;
        const n = 2 + ((rng() * 4) | 0);
        for (let k = 0; k < n; k++) { stones.push([cc, rr]); const q = rng(); if (q < 0.35) cc++; else if (q < 0.7) cc--; else rr++; }
      }
    }
  }
  const f = { veins, stones, caves: chunkCaves(cx, cy) };
  WGEN.feat.set(key, f);
  return f;
}
// ---- 동굴 ----
// 구역마다 0~2개: 꼬불꼬불한 굴(벌레 굴) 또는 넓은 방. 깊을수록 자주·크게.
// 광맥과 다른 난수를 써서 기존 광맥 모양은 그대로 (동굴만 새로 파임). 시작점에서 ±30칸 안에만 파서 이웃 구역까지만 걸침.
// 동굴 벽에는 가끔 광물이 드러나 있음 (탐험 보상)
export const CAVE_TOP = SURF + 12;                 // 이보다 얕은 곳엔 동굴 없음 (마을·지표 근처 보호)
export function chunkCaves(cx, cy) {
  const rng = mulberry32(hash32(WGEN.seed, cx, cy, 0xca7e)), caves = [];
  if (WGEN.caveOff) return caves;
  const y0 = Math.max(CAVE_TOP, cy * CH + 2), y1 = Math.min(H - 6, cy * CH + CH - 3);
  if (y0 > y1) return caves;
  const d = (y0 - SURF);
  const p = d < 60 ? 0.35 : d < 300 ? 0.55 : 0.75;
  for (let n = 0; n < 2 && rng() < (n === 0 ? p : p * 0.4); n++) {
    const ox = cx * CH + 2 + ((rng() * (CH - 4)) | 0), oy = y0 + ((rng() * (y1 - y0 + 1)) | 0);
    const set = new Set(), cells = [];
    const add = (x, y) => {
      if (x < 1 || x > W - 2 || y < CAVE_TOP || y > H - 4 || Math.abs(x - ox) > 30 || Math.abs(y - oy) > 30) return;
      const i = y * W + x;
      if (!set.has(i)) { set.add(i); cells.push([x, y]); }
    };
    const ellipse = (x0, y0e, rx, ry) => {
      for (let yy = Math.floor(y0e - ry); yy <= Math.ceil(y0e + ry); yy++) for (let xx = Math.floor(x0 - rx); xx <= Math.ceil(x0 + rx); xx++) {
        const dx = (xx - x0) / rx, dy = (yy - y0e) / ry;
        if (dx * dx + dy * dy <= 1.05) add(xx, yy);
      }
    };
    const room = rng() < 0.3 + Math.min(0.3, d / 3000);
    if (room) {                                                   // 넓은 방: 타원 몇 개를 겹침, 바닥은 평평한 편
      const k = 3 + ((rng() * 4) | 0), big = 1 + Math.min(1, d / 1500);
      for (let q = 0; q < k; q++) ellipse(ox + (rng() - 0.5) * 12 * big, oy + (rng() - 0.5) * 4, (2.5 + rng() * 3.5) * big, 1.6 + rng() * 1.6);
    } else {                                                      // 벌레 굴: 옆으로 기는 굴, 굵기가 조금씩 바뀜
      let x = ox, y = oy, ang = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 1.2, rad = 0.9 + rng() * 0.8;
      const len = 16 + ((rng() * 36) | 0);
      for (let s = 0; s < len; s++) {
        ellipse(x, y, rad, Math.max(0.6, rad * 0.8));
        x += Math.cos(ang); y += Math.sin(ang) * 0.7;
        ang += (rng() - 0.5) * 0.7;
        rad = Math.max(0.6, Math.min(2.2, rad + (rng() - 0.5) * 0.5));
      }
    }
    // 벽에 드러난 광물
    const ores = [];
    for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (set.has(yy * W + xx) || rng() >= 0.05) continue;
      let pr = rng() * ORE_GEN.reduce((a, g) => a + oreProb(g, yy - SURF), 0);
      for (const g of ORE_GEN) { pr -= oreProb(g, yy - SURF); if (pr < 0) { ores.push([xx, yy, g.id]); break; } }
    }
    caves.push({ cells, ores });
  }
  return caves;
}

// 가로 암석대(2칸 두께): 48칸마다 좁은 통로가 하나씩 있어서 찾아 돌아가거나 폭파해서 뚫음
export function makeBands(seed) {
  const rng = mulberry32((seed ^ 0x5f3759df) | 0), bands = [];
  for (let bd = 25 + ((rng() * 10) | 0); bd < H - SURF - 6; bd += 38 + ((rng() * 20) | 0)) {
    const gaps = [];
    for (let s = 0; s * 48 < W; s++) gaps.push(s * 48 + 2 + ((rng() * 42) | 0));
    bands.push({ r: SURF + bd, gaps });
  }
  return bands;
}
const putStone = (i, c, r) => {
  if (c < 1 || c > W - 2 || r < SURF + 8 || r >= H - 2) return;
  const v = tiles[i];
  if (v !== 0 && v !== 7 && v !== 12) tiles[i] = 12;
};
export function genChunk(cx, cy) {
  const k = cy * CW + cx;
  if (genMask[k]) return;
  const x0 = cx * CH, y0 = cy * CH, x1 = Math.min(W, x0 + CH), y1 = Math.min(H, y0 + CH);
  const inside = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) tiles[r * W + c] = baseCell(c, r);
  const near = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (nx >= 0 && nx < CW && ny >= 0 && ny < CHN) near.push(chunkFeatures(nx, ny));
  }
  for (const f of near) for (const v of f.veins) for (const [x, y] of v.cells) if (inside(x, y) && tiles[y * W + x] === 1) tiles[y * W + x] = v.id;
  for (const f of near) for (const v of f.veins) if (v.shell) for (const [x, y] of v.shell) if (inside(x, y) && tiles[y * W + x] === 1) tiles[y * W + x] = v.shellId;
  for (const f of near) for (const [x, y] of f.stones) if (inside(x, y)) putStone(y * W + x, x, y);
  for (const b of WGEN.bands) for (let kk = 0; kk < 2; kk++) {
    const r = b.r + kk;
    if (r < y0 || r >= y1) continue;
    for (let c = Math.max(1, x0); c < Math.min(W - 1, x1); c++) {
      const g = b.gaps[(c / 48) | 0];
      const gap = kk === 0 ? (c === g || c === g + 1) : (c === g + 1 || c === g + 2);
      if (!gap) putStone(r * W + c, c, r);
    }
  }
  for (const f of near) for (const cv of f.caves) for (const [x, y] of cv.cells) {          // 동굴 파기 (암반은 남김)
    if (inside(x, y) && tiles[y * W + x] !== 7) tiles[y * W + x] = 0;
  }
  for (const f of near) for (const cv of f.caves) for (const [x, y, id] of cv.ores) {      // 동굴 벽 광물
    if (inside(x, y) && tiles[y * W + x] === 1) tiles[y * W + x] = id;
  }
  for (let r = Math.max(y0, SURF); r <= SURF + 1 && r < y1; r++) for (let c = x0; c < x1; c++) {   // 마을 땅은 기초석(못 팜)
    if (inTown(c)) tiles[r * W + c] = 13;
  }
  for (let r = y0; r < y1; r++) baseTiles.set(tiles.subarray(r * W + x0, r * W + x1), r * W + x0);
  genMask[k] = 1;
}
// 처음부터 비어 있던 칸(자연 동굴·빈 틈) vs 플레이어가 판 칸. 자연 동굴은 무너지거나 떨어지지 않게 다르게 다룸
export const natAir = (i) => tiles[i] === 0 && baseTiles[i] === 0;
export const dugAir = (i) => tiles[i] === 0 && baseTiles[i] !== 0;
export const isGen = (c, r) => c >= 0 && c < W && r >= 0 && r < H && genMask[((r / CH) | 0) * CW + ((c / CH) | 0)] === 1;
// 칸 범위를 덮는 구역을 모두 만들어 둠
export function ensureRect(c0, r0, c1, r1) {
  const a = Math.max(0, Math.floor(c0 / CH)), b = Math.min(CW - 1, Math.floor(c1 / CH));
  const e = Math.max(0, Math.floor(r0 / CH)), f = Math.min(CHN - 1, Math.floor(r1 / CH));
  for (let cy = e; cy <= f; cy++) for (let cx = a; cx <= b; cx++) if (!genMask[cy * CW + cx]) genChunk(cx, cy);
}
// 플레이어 주변(구역 2칸 반경 = 약 64칸)을 미리 만들어서, 빠르게 떨어져도 아직 안 만든 땅에 닿지 않게
export const ensureAround = (c, r) => ensureRect(c - 2 * CH, r - 2 * CH, c + 2 * CH, r + 2 * CH);
// 시드로 월드를 새로 시작 (계정마다 시드가 달라서 다른 월드). 마을 근처만 바로 만들고 나머지는 다가가면 생성
export function genWorld(seed) {
  WGEN.seed = seed | 0; WGEN.bands = makeBands(WGEN.seed); WGEN.feat.clear();
  tiles.fill(0); baseTiles.fill(0); genMask.fill(0);
  ensureRect(0, 0, PREGEN.cx * CH - 1, PREGEN.cy * CH - 1);
  resetSeen();
  rub.fill(0); rubSet.clear(); warn.fill(0);
}
// 건물 자리(열 범위). 이 아래 두 줄은 기초석이라 부술 수 없음
export function fixFoundation() {
  for (let c = 0; c < W; c++) for (let r = SURF; r <= SURF + 1; r++) {
    if (!isGen(c, r)) continue;
    if (inTown(c)) tiles[r * W + c] = 13;
    else if (tiles[r * W + c] === 13) tiles[r * W + c] = 1;     // 예전 배치의 기초석이 광산 터에 남지 않게 흙으로
  }
}
export function resetSeen() {
  seen.fill(0);
  for (let r = 0; r < SURF + 4; r++) for (let c = 0; c < W; c++) seen[r * W + c] = 1;   // 지상 근처는 처음부터 밝음
}
export function legacySeen() {                                   // 예전 저장: 이미 뚫린 곳은 본 것으로 처리
  resetSeen();
  for (let r = SURF; r < H; r++) for (let c = 0; c < W; c++) {
    if (tiles[r * W + c] !== 0 || !isGen(c, r)) continue;           // 아직 안 만든 구역(0)은 빈 굴이 아님
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < H && cc >= 0 && cc < W) seen[rr * W + cc] = 1;
    }
  }
}

genWorld(SEED);

export const solid = (c, r) => {
  if (c < 0 || c >= W || r >= H) return true;
  if (r < 0) return false;
  const v = tiles[r * W + c];
  return v !== 0 && v !== 14 && v !== 15;       // 지지대는 지나갈 수 있음
};
export const isAir = (c, r) => r >= SURF && c >= 0 && c < W && r < H && (tiles[r * W + c] === 0 || tiles[r * W + c] === 14 || tiles[r * W + c] === 15);

