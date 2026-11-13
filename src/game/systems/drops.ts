// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./collapseFx.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ORE_ACCENT, sprite } from "../art/sprites.ts";
import { ORE_COL, T, TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { cargoCap, cargoCount, floaters, spawn } from "../core/stats.ts";
import { solid } from "../core/world.ts";
import { ctx, txt } from "../render/util.ts";
import { saveNow } from "../save/account.ts";
import { spawnDust } from "./collapseFx.ts";

// =====================================================================
//  떨어진 광물: 버리거나 화물칸이 가득 찬 채로 캔 광물은 땅에 떨어집니다.
//  - 위로 지나가면 화물칸에 자리가 있을 때 주워요(버린 광물은 한 번 멀어졌다가 다시 와야 주워짐)
//  - 60초가 지나거나, 그 자리가 붕괴·낙하한 흙에 묻히면 사라져요
// =====================================================================
// 떨어진 광물 아이템: 광물 하나(덩어리·원석·결정)를 12x12 도트로 (k 테두리 / a 밝음 / b 기본 / c 어두움 / w 광택 / g 포인트)
export const DROP_MAP = {
  6: [ // 석탄 덩어리
    "............",
    "....kkk.....",
    "..kkabbk....",
    ".kbaawbbk...",
    ".kbbbbabbk..",
    "kbcbbbbbbbk.",
    "kbbbcbbbcbk.",
    ".kbbbbcbbbk.",
    ".kccbbbbcck.",
    "..kcccbcck..",
    "...kkkkkk...",
    "............"],
  2: [ // 구리 원석: 둥근 덩어리 + 녹청
    "............",
    "....kkkk....",
    "...kaabbk...",
    "..kaawbbbk..",
    ".kabbbbgbbk.",
    ".kbbgbbbbbk.",
    ".kbbbbbbcbk.",
    ".kbbbbgbcck.",
    "..kbbcbccck.",
    "..kkccccck..",
    "....kkkkk...",
    "............"],
  3: [ // 철 원석: 각진 덩어리 + 녹
    "............",
    "...kkkkk....",
    "..kaaabbk...",
    ".kaabbbbbk..",
    ".kabbgbbbbk.",
    "kabbbbbbcbk.",
    "kbbbbbbbbck.",
    "kbbgbbbcbck.",
    ".kbbbbbccck.",
    ".kcbcccccck.",
    "..kkkkkkkk..",
    "............"],
  8: [ // 은 원석: 반짝이는 흰 덩어리
    "............",
    ".....kkk....",
    "...kkawbk...",
    "..kaawwbbk..",
    ".kaabbbbbbk.",
    ".kabbbbcbbk.",
    "kabbcbbbbbk.",
    "kbbbbbbbcbk.",
    ".kbbbcbbcck.",
    ".kkcccccck..",
    "...kkkkkk...",
    "............"],
  4: [ // 금 덩어리: 매끈한 둥근 금알
    "............",
    "....kkkkk...",
    "...kaawbbk..",
    "..kawwbbbbk.",
    ".kaabbbbbbk.",
    ".kabbbbbbbck",
    ".kbbbbbbbcck",
    "..kbbbbbccck",
    "..kkbbcccck.",
    "....kkkkkk..",
    "............",
    "............"],
  9: [ // 에메랄드: 세로로 긴 육각 보석
    "....kkkk....",
    "...kawbbk...",
    "..kaawbbck..",
    "..kaabbbck..",
    "..kaabbbck..",
    "..kaabbbck..",
    "..kaabbbck..",
    "..kaabbbck..",
    "..kabbbcck..",
    "...kbbcck...",
    "....kkkk....",
    "............"],
  5: [ // 다이아몬드: 브릴리언트 컷
    "............",
    "...kkkkkk...",
    "..kwaawabk..",
    ".kaawabbbck.",
    "kcccccccccck",
    ".kabbbbbbck.",
    "..kabbbbck..",
    "...kabbck...",
    "....kbck....",
    ".....kk.....",
    "............",
    "............"],
  10: [ // 루비: 타원형 컷 보석
    "............",
    "....kkkk....",
    "..kkawabkk..",
    ".kaawabbbck.",
    ".kawbbbbbck.",
    ".kabbbbbbck.",
    ".kabbbbbcck.",
    ".kbbbbbccck.",
    "..kkbcccck..",
    "....kkkk....",
    "............",
    "............"],
  11: [ // 미스릴: 비스듬한 결정 조각
    ".......k....",
    "......kak...",
    ".....kawk...",
    "....kawbk...",
    "...kawbbk...",
    "...kabbck...",
    "..kabbbck...",
    "..kabbck....",
    ".kabbck.....",
    ".kbbcck.....",
    ".kkkkk......",
    "............"],
};
export const DROP_GLOW = { 4: "255,211,77", 9: "80,230,140", 5: "130,230,255", 10: "255,90,110", 11: "120,255,230" };   // 희귀 광물은 은은하게 빛남
export const oreDrop = {};
for (const id in DROP_MAP) {
  oreDrop[id] = sprite(12, 12, (p) => {
    const c = ORE_COL[id], pal = { k: "#14151f", a: c[0], b: c[1], c: c[2], w: "#ffffff", g: ORE_ACCENT[id] || c[0] };
    if (id === "6") pal.k = "#05060a";
    DROP_MAP[id].forEach((row, y) => { for (let x = 0; x < 12; x++) { const ch = row[x]; if (ch !== "." && pal[ch]) p(x, y, 1, 1, pal[ch]); } });
  });
}
export const DROP_LIFE = 60;
export const drops = [];                       // [{id, n, x, y, vx, vy, age, wait}]
export function spawnDrop(id, x, y, n, wait) {
  drops.push({ id, n: n || 1, x, y, vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40, age: 0, wait: !!wait });
  if (drops.length > 200) drops.splice(0, drops.length - 200);
}
export function dropPoof(d, col) {
  for (let k = 0; k < 6; k++) spawn(d.x, d.y, (Math.random() - 0.5) * 80, -30 - Math.random() * 50, 0.4, col || ORE_COL[d.id][0], 3, 300);
}
export function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt;
    if (d.age >= DROP_LIFE) { dropPoof(d, "#9aa0b4"); drops.splice(i, 1); continue; }
    // 묻힘(붕괴로 채워짐 / 흙덩이가 떨어짐) → 사라짐
    if (solid(Math.floor(d.x / T), Math.floor(d.y / T))) { spawnDust(d.x, d.y, 1, 8); drops.splice(i, 1); continue; }
    // 중력 + 바닥/벽 충돌 (크기 16px)
    d.vy = Math.min(700, d.vy + 900 * dt);
    let nx = d.x + d.vx * dt;
    if (solid(Math.floor((nx + (d.vx > 0 ? 7 : -7)) / T), Math.floor(d.y / T))) { nx = d.x; d.vx = -d.vx * 0.3; }
    d.x = nx;
    let ny = d.y + d.vy * dt;
    const fr = Math.floor((ny + 8) / T), fc = Math.floor(d.x / T);
    if (d.vy > 0 && solid(fc, fr)) { ny = fr * T - 8; d.vy = 0; d.vx *= Math.max(0, 1 - 8 * dt); }
    else if (d.vy < 0 && solid(fc, Math.floor((ny - 8) / T))) { d.vy = 0; ny = d.y; }
    d.y = ny;
    // 줍기
    const dist = Math.hypot(P.x - d.x, P.y - d.y);
    if (d.wait) { if (dist > 52) d.wait = false; continue; }
    if (P.dead > 0 || d.age < 0.35 || dist > 24) continue;
    const room = cargoCap() - cargoCount();
    if (room <= 0) { if (d.age > 0.5 && !(d.fullT > 0)) { floaters.push({ x: P.x, y: P.y - 24, text: "화물 가득", color: "#ff9a90", life: 0.9 }); d.fullT = 2; } if (d.fullT > 0) d.fullT -= dt; continue; }
    const k = Math.min(room, d.n);
    P.cargo[d.id] = (P.cargo[d.id] || 0) + k;
    d.n -= k;
    floaters.push({ x: P.x, y: P.y - 24, text: "+" + TILE[d.id].name + (k > 1 ? " x" + k : ""), color: ORE_COL[d.id][0], life: 1.0 });
    if (d.n <= 0) drops.splice(i, 1);
  }
}
export function drawDrops(camX, camY, vw, vh) {
  for (const d of drops) {
    const left = DROP_LIFE - d.age;
    if (left < 10 && ((S.animT * (left < 4 ? 10 : 5)) | 0) % 2) continue;          // 곧 사라지면 깜빡임
    const cx = Math.round(d.x - camX), floor = Math.round(d.y - camY) + 8;
    if (cx < -20 || floor < -20 || cx > vw + 20 || floor > vh + 30) continue;
    const ph = d.x * 0.13 + d.n;
    const rest = d.vy === 0;
    const bob = rest ? 2 + Math.round(Math.sin(S.animT * 3 + ph) * 1.5) : 0;        // 바닥 위에서 살짝 떠 있음
    const spin = rest ? Math.abs(Math.cos(S.animT * 1.8 + ph)) : 1;                 // 천천히 도는 느낌
    const w = Math.max(2, Math.round(12 * (0.25 + 0.75 * spin) / 2) * 2), top = floor - 12 - bob;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(cx - 4, floor - 1, 8, 2);     // 그림자
    const gl = DROP_GLOW[d.id];
    if (gl) {
      const a = 0.08 + 0.05 * Math.sin(S.animT * 4 + ph), my = top + 6;
      ctx.fillStyle = "rgba(" + gl + "," + a.toFixed(3) + ")";
      ctx.fillRect(cx - 8, my - 4, 16, 8); ctx.fillRect(cx - 4, my - 8, 8, 16); ctx.fillRect(cx - 6, my - 6, 12, 12);
    }
    ctx.drawImage(oreDrop[d.id], cx - w / 2, top, w, 12);
    if (gl && spin > 0.85 && ((S.animT * 2 + ph) % 3) < 0.35) { ctx.fillStyle = "#fff"; ctx.fillRect(cx - 3, top, 1, 3); ctx.fillRect(cx - 4, top + 1, 3, 1); }
    if (d.n > 1) txt("x" + d.n, cx, top - 14, "#fff", 12, "center");
  }
}
// 화물에서 광물 버리기
export function discardOre(id, n) {
  const have = P.cargo[id] || 0, k = Math.min(have, n);
  if (k <= 0) return 0;
  P.cargo[id] = have - k;
  if (P.cargo[id] <= 0) delete P.cargo[id];
  spawnDrop(id, P.x + P.facing * 4, P.y - 4, k, true);
  saveNow(true, true);
  return k;
}

