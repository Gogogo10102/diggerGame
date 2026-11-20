// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./furnace.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { sfx } from "../core/sound.ts";
import { ICON, sprite } from "../art/sprites.ts";
import { H, ORE_COL, SURF, T, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, say, spawn } from "../core/stats.ts";
import { ORE_GEN, ensureRect, natAir, oreProb, regenT, rub, rubSet, seen, setRub, tiles, warn } from "../core/world.ts";
import { CONS } from "../data/consumables.ts";
import { saveNow } from "../save/account.ts";
import { addXP } from "../data/progress.ts";

// =====================================================================
//  쌓인 흙의 광물 재생 / (예전) 지지대
//  - 지반 붕괴는 없앴습니다(docs/decisions.md). 굴은 아무리 길게 파도 무너지지 않습니다.
//  - 떨어진 흙더미(floating.ts)로 다시 채워진 칸은 시간이 지나면 일정 확률로 광물로 바뀝니다.
//  - 지지대는 상점·단축 슬롯에서 뺐고, 예전 세이브에 이미 세운 지지대만 그대로 남아 있습니다(지나갈 수 있음).
// =====================================================================
export const REGEN_MIN = 60, REGEN_MAX = 180;   // 쌓인 흙에 광물이 생기기까지(초)
export const REGEN_ORE_CHANCE = 0.4;            // 그때 광물이 될 확률
S.unstable = [];                       // 예전 붕괴 경고 구간 (이제 늘 비어 있음 · 옛 코드 호환용)
S.scanT = 0; S.graceT = 0; S.cavWarn = 0; S.warnMsgT = 0;
export const isSup = (v) => v === 14 || v === 15 || v === 19;   // 지나갈 수 있는 설치물 (지지대 · 사다리)

// 쌓인 흙 칸의 광물 재생 타이머 (0.5초마다)
export function scanCave(dt) {
  for (const i of rubSet) {
    if (!rub[i]) { rubSet.delete(i); continue; }
    if (tiles[i] === 0 || isSup(tiles[i])) { setRub(i, 0); continue; }   // 다시 파냈으면 해제
    regenT[i] -= dt;
    if (regenT[i] <= 0) regenTile(i);
  }
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
  if (S.scanT >= 0.5) { const d = S.scanT; S.scanT = 0; scanCave(d); }
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
  sfx("cave");
  floaters.push({ x: P.x, y: P.y - 42, text: "동굴 발견!", color: "#8fd3ff", life: 1.6 });
  S.shakeT = Math.max(S.shakeT || 0, 0.12);
  return q.length;
}
