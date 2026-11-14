// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./furnace.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ICON, sprite } from "../art/sprites.ts";
import { H, HH, HW, ORE_COL, PX, SURF, T, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, maxFuel, say, spawn } from "../core/stats.ts";
import { ORE_GEN, ensureRect, natAir, oreProb, regenT, rub, rubSet, seen, setRub, tiles, warn } from "../core/world.ts";
import { CONS } from "../data/consumables.ts";
import { saveNow } from "../save/account.ts";
import { addXP } from "../data/progress.ts";
import { spawnDust, startDebris } from "./collapseFx.ts";

// =====================================================================
//  지반 붕괴 / 지지대 / 광물 재생
//  - 지지대 없이 천장이 MAXSPAN칸보다 넓게 열려 있으면 징후(흙가루·균열·흔들림) 후 WARN_TIME초 뒤 무너져서
//    그 구간이 흙(가끔 돌)으로 다시 채워집니다.
//  - 무너져서 채워진 칸은 시간이 지나면 일정 확률로 광물로 바뀝니다.
//  - 지지대(나무: 1칸, 강철: 3칸)를 놓으면 그 칸은 천장이 받쳐진 것으로 계산합니다.
// =====================================================================
export const MAXSPAN = 3;                       // 지지대 없이 버티는 천장 폭(칸)
export const WARN_TIME = 4.0;                   // 불안정해진 뒤 무너질 때까지(초)
export const REGEN_MIN = 60, REGEN_MAX = 180;   // 무너진 자리에 광물이 생기기까지(초)
export const REGEN_ORE_CHANCE = 0.4;            // 그때 광물이 될 확률
export const unstMark = new Uint8Array(W * H);
S.unstable = [];                       // [{r, c0, c1, t}] 지금 불안정한 구간
S.scanT = 0; S.graceT = 0; S.cavWarn = 0; S.warnMsgT = 0;
export const isSup = (v) => v === 14 || v === 15;
export const strongCeil = (v) => v === 7 || v === 12 || v === 13 || v === 16;

export function scanCave(dt) {
  const pr = Math.floor(P.y / T), pc = Math.floor(P.x / T);
  const rLo = Math.max(SURF + 1, pr - 40), rHi = Math.min(H - 3, pr + 40);
  const cLo = Math.max(1, pc - 64), cHi = Math.min(W - 2, pc + 64);    // 맵이 넓어서 플레이어 주변 열만 계산
  ensureRect(cLo - 1, rLo - 1, cHi + 1, rHi + 1);                       // 아직 안 만든 땅(빈칸 0)을 굴로 착각하지 않게
  const held = new Uint8Array(W), runs = [];
  for (let r = rLo; r <= rHi; r++) {
    held.fill(0, cLo - 1, cHi + 2);
    for (let c = cLo; c <= cHi; c++) {
      const v = tiles[r * W + c];
      if (v === 14) held[c] = 1;
      else if (v === 15) { held[c] = 1; held[c - 1] = 1; held[c + 1] = 1; }
    }
    let c0 = -1;
    const flush = (c1) => {
      if (c0 >= 0 && c1 - c0 + 1 > MAXSPAN) runs.push({ r, c0, c1, t: 0 });
      c0 = -1;
    };
    for (let c = cLo; c <= cHi; c++) {
      const v = tiles[r * W + c], ct = tiles[(r - 1) * W + c];
      const air = v === 0 || isSup(v);
      const weak = ct !== 0 && !isSup(ct) && !strongCeil(ct);     // 무너질 수 있는 천장(흙/광물)
      const nat = v === 0 && natAir(r * W + c);                    // 자연 동굴은 원래 그 모양으로 버티던 곳 → 판 칸만 셈
      if (air && !held[c] && weak && !nat) { if (c0 < 0) c0 = c; } else flush(c - 1);
    }
    flush(cHi);
  }
  // 칸별 불안정 누적 시간
  for (let r = rLo; r <= rHi; r++) unstMark.fill(0, r * W + cLo, r * W + cHi + 1);
  for (const u of runs) for (let c = u.c0; c <= u.c1; c++) unstMark[u.r * W + c] = 1;
  const grace = S.graceT > 0;
  if (grace) S.graceT -= dt;
  for (let r = rLo; r <= rHi; r++) for (let c = cLo; c <= cHi; c++) {
    const i = r * W + c;
    if (unstMark[i] && !grace) warn[i] += dt; else if (warn[i] !== 0) warn[i] = 0;
  }
  for (const u of runs) { let t = 0; for (let c = u.c0; c <= u.c1; c++) t = Math.max(t, warn[u.r * W + c]); u.t = t; }
  S.unstable = runs;
  S.cavWarn = 0;
  for (const u of runs) if (u.t > 0 && Math.abs(u.r - pr) <= 10 && pc >= u.c0 - 10 && pc <= u.c1 + 10) S.cavWarn = Math.max(S.cavWarn, u.t / WARN_TIME);
  if (S.cavWarn > 0 && S.warnMsgT <= 0) { say("지반이 흔들려요! 지지대를 설치하세요"); S.warnMsgT = 10; }
  for (const u of runs.slice()) if (u.t >= WARN_TIME) collapseRun(u);
  // 무너진 자리의 광물 재생
  for (const i of rubSet) {
    if (!rub[i]) { rubSet.delete(i); continue; }
    if (tiles[i] === 0 || isSup(tiles[i])) { setRub(i, 0); continue; }   // 다시 파냈으면 해제
    regenT[i] -= dt;
    if (regenT[i] <= 0) regenTile(i);
  }
}
export function collapseRun(u) {
  const pr = Math.floor(P.y / T), pc = Math.floor(P.x / T);
  const pc0 = Math.floor((P.x - HW) / T), pc1 = Math.floor((P.x + HW - 0.001) / T);
  const pr0 = Math.floor((P.y - HH) / T), pr1 = Math.floor((P.y + HH - 0.001) / T);
  const near = P.dead <= 0 && Math.abs(u.r - pr) <= 1 && pc >= u.c0 - 1 && pc <= u.c1 + 1;
  const close = Math.abs(u.r - pr) <= 4 && pc >= u.c0 - 4 && pc <= u.c1 + 4;
  const stoneP = close ? 0 : Math.min(0.22, Math.max(0, u.r - SURF) / 700);   // 가까이 있으면 돌 대신 흙(탈출 가능)
  for (let c = u.c0; c <= u.c1; c++) {
    const i = u.r * W + c;
    warn[i] = 0;
    for (let k = 0; k < 4; k++) spawn((c + Math.random()) * T, (u.r + Math.random()) * T, (Math.random() - 0.5) * 120, 20 + Math.random() * 120, 0.5 + Math.random() * 0.4, ["#a8826e", "#6b4a2f", "#8d92a8"][(Math.random() * 3) | 0], 5, 700);
    if (P.dead <= 0 && c >= pc0 && c <= pc1 && u.r >= pr0 && u.r <= pr1) continue;   // 플레이어가 서 있는 칸은 비워 둠
    tiles[i] = Math.random() < stoneP ? 12 : 1;
    setRub(i, 1); seen[i] = 1; startDebris(i);
    spawnDust((c + 0.5) * T, u.r * T + 4, 2, T);
    regenT[i] = REGEN_MIN + Math.random() * (REGEN_MAX - REGEN_MIN);
  }
  floaters.push({ x: ((u.c0 + u.c1 + 1) / 2) * T, y: u.r * T - 10, text: "붕괴!", color: "#ff9a90", life: 1.5 });
  if (S.acct) S.acct.stats.collapses = (S.acct.stats.collapses || 0) + 1;
  if (Math.abs(u.r - pr) <= 15 && Math.abs(pc - (u.c0 + u.c1) / 2) <= 15) S.shakeT = Math.max(S.shakeT, 0.4);
  if (near) {
    P.fuel -= maxFuel() * 0.2;
    P.vy = -200 * PX;
    floaters.push({ x: P.x, y: P.y - 30, text: "낙반! 연료 -20%", color: "#ff6b6b", life: 1.4 });
  }
  S.unstable = S.unstable.filter((x) => x !== u);
  saveNow(true, true);
}
export function rollOre(d) {
  let tot = 0;
  const w = ORE_GEN.map((g) => { const p = oreProb(g, d); tot += p; return p; });
  if (tot <= 0) return 0;
  let x = Math.random() * tot;
  for (let k = 0; k < w.length; k++) { x -= w[k]; if (x < 0) return ORE_GEN[k].id; }
  return 0;
}
export function regenTile(i) {
  setRub(i, 0);
  if (tiles[i] !== 1 || Math.random() >= REGEN_ORE_CHANCE) return;
  const r = (i / W) | 0, c = i % W, id = rollOre(r - SURF);
  if (!id) return;
  tiles[i] = id;
  if (Math.abs(r - Math.floor(P.y / T)) < 14 && Math.abs(c - Math.floor(P.x / T)) < 20) {     // 근처면 반짝임
    for (let k = 0; k < 6; k++) spawn((c + Math.random()) * T, (r + Math.random()) * T, (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 0.7, ORE_COL[id][0], 4, 0);
  }
}
export function updateCave(dt) {
  S.scanT += dt;
  if (S.warnMsgT > 0) S.warnMsgT -= dt;
  if (S.scanT >= 0.5) { const d = S.scanT; S.scanT = 0; scanCave(d); }
  const pr = Math.floor(P.y / T);
  for (const u of S.unstable) {                          // 징후: 천장에서 흙가루가 떨어짐
    if (!(u.t > 0) || Math.abs(u.r - pr) > 18) continue;
    const k = Math.min(1, (u.t + S.scanT) / WARN_TIME);
    if (Math.random() < dt * (6 + 40 * k)) {
      const c = u.c0 + ((Math.random() * (u.c1 - u.c0 + 1)) | 0);
      spawn((c + Math.random()) * T, u.r * T + 2, (Math.random() - 0.5) * 20, 10, 0.5 + Math.random() * 0.3, Math.random() < 0.5 ? "#a8826e" : "#6b4a2f", 3, 700);
    }
  }
  if (S.cavWarn > 0.6 && P.dead <= 0) S.shakeT = Math.max(S.shakeT, 0.06);
}
// 지지대 설치 / 회수 (같은 자리에서 한 번 더 쓰면 회수)
export function placeSupport(id) {
  const c = CONS[id];
  const col = Math.floor(P.x / T), row = Math.floor(P.y / T), i = row * W + col;
  if (row < SURF || col < 1 || col > W - 2) return say("지지대는 땅속에서만 설치할 수 있어요");
  const cur = tiles[i];
  if (isSup(cur)) {
    const back = cur === 14 ? "sup_w" : "sup_s";
    tiles[i] = 0;
    P.inv[back] = Math.min(99, (P.inv[back] || 0) + 1);
    S.scanT = 0.5;
    say(CONS[back].name + " 회수");
    return saveNow(true, true);
  }
  if (cur !== 0) return say("여기에는 설치할 수 없어요");
  if (!((P.inv[id] || 0) > 0)) return say(c.name + "이(가) 없어요! 아이템 상점에서 구매하세요");
  P.inv[id]--;
  tiles[i] = c.steel ? 15 : 14;
  warn[i] = 0;
  say(c.name + " 설치! (남은 " + P.inv[id] + "개)");
  for (let k = 0; k < 8; k++) spawn((col + Math.random()) * T, (row + Math.random()) * T, (Math.random() - 0.5) * 60, -20 - Math.random() * 40, 0.4, "#c08a5c", 3, 200);
  saveNow(true, true);
}
// 지지대 스프라이트 (타일 크기 그대로: 가로보 + 양쪽 기둥, 가운데는 비어 있어 지나갈 수 있음)
export const supSprite = (wood) => sprite(16, 16, (p) => {
  const D = "#14151f";
  const M = wood ? "#8a5a3c" : "#9aa3b8", H = wood ? "#c08a5c" : "#e3e8f2", L = wood ? "#5e3b25" : "#565c70";
  p(0, 0, 16, 5, D); p(0, 0, 16, 4, M); p(0, 0, 16, 1, H); p(0, 3, 16, 1, L);
  p(1, 4, 4, 12, D); p(2, 4, 2, 12, M); p(2, 4, 1, 12, H); p(3, 4, 1, 12, L);
  p(11, 4, 4, 12, D); p(12, 4, 2, 12, M); p(12, 4, 1, 12, H); p(13, 4, 1, 12, L);
  p(4, 5, 2, 2, D); p(4, 5, 1, 1, M); p(10, 5, 2, 2, D); p(11, 5, 1, 1, M);
  if (wood) { p(2, 1, 1, 1, "#2b2b33"); p(13, 1, 1, 1, "#2b2b33"); p(7, 1, 2, 1, L); }
  else { for (let x = 5; x < 12; x += 4) p(x, 1, 2, 2, "#ffcd3c"); p(2, 1, 1, 1, L); p(13, 1, 1, 1, L); p(2, 9, 1, 1, "#ffffff"); p(13, 9, 1, 1, "#ffffff"); }
});
ICON.sup_w = supSprite(true);
ICON.sup_s = supSprite(false);
// HUD 버튼 아이콘
ICON.bag = sprite(16, 16, (p) => {
  const D = "#14151f";
  p(5, 1, 6, 4, D); p(6, 2, 4, 1, "#8a5a3c"); p(6, 3, 1, 2, "#8a5a3c"); p(9, 3, 1, 2, "#8a5a3c");
  p(2, 4, 12, 11, D); p(3, 5, 10, 9, "#c08a5c"); p(3, 5, 10, 3, "#e0a874"); p(3, 8, 10, 1, "#8a5a3c"); p(3, 13, 10, 1, "#8a5a3c");
  p(7, 7, 2, 3, "#ffd34d"); p(7, 9, 2, 1, "#c98f1a");
});
ICON.trophy = sprite(16, 16, (p) => {
  const D = "#14151f";
  p(3, 1, 10, 8, D); p(4, 2, 8, 6, "#ffd34d"); p(4, 2, 2, 6, "#fff3a8"); p(10, 2, 2, 6, "#c98f1a");
  p(1, 2, 3, 4, D); p(2, 3, 1, 2, "#ffd34d"); p(12, 2, 3, 4, D); p(13, 3, 1, 2, "#c98f1a");
  p(6, 8, 4, 3, D); p(7, 8, 2, 2, "#c98f1a");
  p(4, 11, 8, 4, D); p(5, 12, 6, 2, "#8a5a3c"); p(5, 12, 6, 1, "#c08a5c");
});
ICON.menu = sprite(16, 16, (p) => { for (const y of [3, 7, 11]) { p(2, y, 12, 3, "#14151f"); p(3, y, 10, 2, "#d7dcf0"); } });
export const TIER_COL = ["#8a90a0", "#7cff6b", "#4fc3ff", "#b58cff", "#ffd34d", "#ff8a3c", "#ff5a8a", "#7ff5e6"];   // 장비 단계 테두리 색

// ---- 동굴 발견 ----
// 판 칸 옆이 아직 못 본 자연 동굴이면, 이어진 동굴 전체(와 그 벽)를 한 번에 보여 줌 → "파다가 동굴을 발견"
export const CAVE_FIND_MIN = 12;                // 이만큼 이상 새로 드러나야 '동굴 발견'으로 침 (작은 빈 틈은 제외)
export function discoverCave(c, r) {
  const q = [], has = new Set();
  for (const [x, y] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
    if (x <= 0 || x >= W - 1 || y <= SURF || y >= H - 1) continue;
    const i = y * W + x;
    if (natAir(i) && !has.has(i)) { has.add(i); q.push(i); }
  }
  if (!q.length) return 0;
  ensureRect(c - 40, r - 40, c + 40, r + 40);
  let fresh = 0;
  for (let k = 0; k < q.length && q.length < 1500; k++) {
    const i = q[k], x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {   // 동굴 칸 + 벽을 보이게
      const j = (y + dy) * W + x + dx;
      if (!seen[j]) { seen[j] = 1; fresh++; }
    }
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      const jx = j % W, jy = (j / W) | 0;
      if (Math.abs(jx - c) > 40 || Math.abs(jy - r) > 40 || jy <= SURF) continue;
      if (!has.has(j) && natAir(j)) { has.add(j); q.push(j); }
    }
  }
  if (q.length < CAVE_FIND_MIN || fresh < CAVE_FIND_MIN) return 0;
  if (S.acct) S.acct.stats.caves = (S.acct.stats.caves || 0) + 1;
  addXP(10 + Math.min(40, q.length >> 3));
  say("동굴 발견! 숨어 있던 공간이 드러났어요");
  floaters.push({ x: P.x, y: P.y - 42, text: "동굴 발견!", color: "#8fd3ff", life: 1.6 });
  S.shakeT = Math.max(S.shakeT || 0, 0.12);
  return q.length;
}
