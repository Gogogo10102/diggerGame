// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./floating.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { H, LAYERS, SURF, T, W, layerOf } from "../core/config.ts";
import { spawn } from "../core/stats.ts";

// =====================================================================
//  붕괴 연출: 천장에서 흙이 미끄러져 내려와 빈 곳을 채우고, 먼지 구름이 번졌다가 가라앉습니다.
// =====================================================================
export const DEBRIS_T = 0.42;                          // 흙이 천장에서 내려오는 시간(초)
export const debrisT = new Float32Array(W * H);        // 칸별 남은 연출 시간(DEBRIS_T보다 크면 아직 대기 중)
export const debrisList = [];
export const dust = [];                                // 먼지 구름 [{x,y,vx,vy,r,gr,life,max,col}]
export function spawnDust(x, y, n, spread, col) {
  for (let k = 0; k < n; k++) {
    const life = 0.8 + Math.random() * 0.8;
    dust.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 50, vy: -8 - Math.random() * 26,
      r: 3 + Math.random() * 4, gr: 7 + Math.random() * 8, life, max: life, col: col || (Math.random() < 0.5 ? "#b89c84" : "#8f7a6a") });
  }
  if (dust.length > 260) dust.splice(0, dust.length - 260);
}
// 먼지 한 뭉치: 파기·부수기·착지·궤도 굴러갈 때. 퍼지면서 옅어짐
export function puff(x, y, vx, vy, r, col, life = 0.6) {
  dust.push({ x, y, vx, vy, r, gr: r * 1.6, life, max: life, col });
  if (dust.length > 260) dust.splice(0, dust.length - 260);
}
// 그 깊이 흙 색으로 밝은 먼지 색 (지상은 마른 흙색)
const DUST_COL = LAYERS.map((L) => [L.hi, L.peb].map((c) => {   // 흙색을 밝은 베이지 쪽으로 섞어 어두운 굴에서도 보이게
  const a = parseInt(c.slice(1), 16), b = 0xe8dcc8, m = (s) => Math.round(((a >> s) & 255) * 0.45 + ((b >> s) & 255) * 0.55);
  return "#" + ((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0");
}));
export function dustCol(r) {
  if (r < SURF) return Math.random() < 0.5 ? "#c9b394" : "#a8916f";
  return DUST_COL[layerOf(r - SURF)][Math.random() < 0.5 ? 0 : 1];
}
export function startDebris(i) {
  debrisT[i] = DEBRIS_T + Math.random() * 0.3;
  debrisList.push(i);
}
export function updateDebris(dt) {
  for (let n = debrisList.length - 1; n >= 0; n--) {
    const i = debrisList[n], before = debrisT[i];
    debrisT[i] = before - dt;
    if (before > 0 && debrisT[i] <= 0) {                // 바닥에 닿음: 튀는 부스러기 + 먼지
      debrisT[i] = 0; debrisList.splice(n, 1);
      const c = i % W, r = (i / W) | 0, x = (c + 0.5) * T, y = (r + 1) * T - 2;
      for (let k = 0; k < 3; k++) spawn(x + (Math.random() - 0.5) * T * 0.8, y, (Math.random() - 0.5) * 110, -70 - Math.random() * 70, 0.45, Math.random() < 0.5 ? "#8d6a4a" : "#6b4a2f", 3, 700);
      spawnDust(x, y, 2, T * 0.8);
    }
  }
  for (let n = dust.length - 1; n >= 0; n--) {
    const q = dust[n];
    q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 1.5 * dt; q.r += q.gr * dt; q.life -= dt;
    if (q.life <= 0) dust.splice(n, 1);
  }
}

