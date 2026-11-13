// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./floating.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { H, T, W } from "../core/config.ts";
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

