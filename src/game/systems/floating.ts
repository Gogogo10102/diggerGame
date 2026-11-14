// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./cave.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { H, HH, HW, PX, SURF, T, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, maxFuel, spawn } from "../core/stats.ts";
import { dugAir, ensureRect, isGen, regenT, rub, seen, setRub, tiles, warn } from "../core/world.ts";
import { saveNow } from "../save/account.ts";
import { REGEN_MAX, REGEN_MIN } from "./cave.ts";
import { spawnDust } from "./collapseFx.ts";

// =====================================================================
//  공중에 떠 있는 흙: 바닥(기반암/기초석)에 이어지지 않은 덩어리는 잠깐 흔들린 뒤 떨어져 쌓입니다.
// =====================================================================
export const FLOAT_DELAY = 0.7;                       // 떠 있는 걸 감지한 뒤 떨어지기까지(초)
export const floatT = new Float32Array(W * H);        // 칸별 '떠 있음' 누적 시간(저장 안 함)
export const chunks = [];                             // 떨어지는 덩어리 [{cells:[{c,r,id,rub}], off, frac, vy, hit}]
S.floatScanT = 0;
export const anchorTile = (v) => v === 7 || v === 13;
export const solidTile = (v) => v !== 0 && v !== 14 && v !== 15;
// 맵이 커서 플레이어 주변 창(가로 ±64, 세로 ±48칸)만 계산. 창 가장자리에 닿은 땅은 바깥과 이어진 것으로 봄
export const FLOAT_WIN = { c: 64, r: 48 };
export const _stack = new Int32Array((FLOAT_WIN.c * 2 + 1) * (FLOAT_WIN.r * 2 + 1)), _vis = new Uint8Array((FLOAT_WIN.c * 2 + 1) * (FLOAT_WIN.r * 2 + 1));
export function scanFloating(dt) {
  const pc = Math.floor(P.x / T), pr = Math.floor(P.y / T);
  const c0 = Math.max(0, pc - FLOAT_WIN.c), c1 = Math.min(W - 1, pc + FLOAT_WIN.c);
  const r0 = Math.max(SURF, pr - FLOAT_WIN.r), r1 = Math.min(H - 1, pr + FLOAT_WIN.r);
  const ww = c1 - c0 + 1, wh = r1 - r0 + 1;
  if (ww <= 0 || wh <= 0) return;
  ensureRect(c0, r0, c1, r1);                                           // 아직 안 만든 땅(빈칸 0)을 공중으로 착각하지 않게
  _vis.fill(0, 0, ww * wh);
  let sp = 0;
  const L = (c, r) => (r - r0) * ww + (c - c0);                         // 창 안 번호
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const v = tiles[r * W + c];
    const edge = (c === c0 && c0 > 0) || (c === c1 && c1 < W - 1) || (r === r0 && r0 > SURF) || (r === r1 && r1 < H - 1);
    if (anchorTile(v) || (edge && solidTile(v))) { const k = L(c, r); _vis[k] = 1; _stack[sp++] = k; }
  }
  while (sp > 0) {
    const k = _stack[--sp], c = c0 + (k % ww), r = r0 + ((k / ww) | 0);
    if (c > c0) { const j = k - 1; if (!_vis[j] && solidTile(tiles[r * W + c - 1])) { _vis[j] = 1; _stack[sp++] = j; } }
    if (c < c1) { const j = k + 1; if (!_vis[j] && solidTile(tiles[r * W + c + 1])) { _vis[j] = 1; _stack[sp++] = j; } }
    if (r > r0 && r > SURF) { const j = k - ww; if (!_vis[j] && solidTile(tiles[(r - 1) * W + c])) { _vis[j] = 1; _stack[sp++] = j; } }
    if (r < r1) { const j = k + ww; if (!_vis[j] && solidTile(tiles[(r + 1) * W + c])) { _vis[j] = 1; _stack[sp++] = j; } }
  }
  const out = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * W + c;
    if (!_vis[L(c, r)] && solidTile(tiles[i])) { out.push(i); floatT[i] += dt; }
    else if (floatT[i] !== 0) floatT[i] = 0;
  }
  if (!out.length) return;
  // 떠 있는 칸들을 덩어리로 묶기
  const seenI = new Set();
  for (const s of out) {
    if (seenI.has(s)) continue;
    const comp = [s]; seenI.add(s);
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], c = i % W, r = (i / W) | 0;
      for (const [cc, rr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
        if (cc < c0 || cc > c1 || rr < r0 || rr > r1 || rr < SURF) continue;
        const j = rr * W + cc;
        if (!seenI.has(j) && !_vis[L(cc, rr)] && solidTile(tiles[j])) { seenI.add(j); comp.push(j); }
      }
    }
    // 플레이어가 판 칸(dugAir)에 닿지 않은 덩어리는 원래 그렇게 생긴 자연 지형 → 떨어뜨리지 않음
    const touchesDug = comp.some((i) => dugAir(i - 1) || dugAir(i + 1) || dugAir(i - W) || dugAir(i + W));
    if (!touchesDug) { for (const i of comp) floatT[i] = 0; continue; }
    let t = 0;
    for (const i of comp) t = Math.max(t, floatT[i]);
    if (t >= FLOAT_DELAY) makeChunk(comp);
  }
}
export function makeChunk(comp) {
  const cells = comp.map((i) => ({ c: i % W, r: (i / W) | 0, id: tiles[i], rub: rub[i] }));
  for (const i of comp) { tiles[i] = 0; setRub(i, 0); floatT[i] = 0; warn[i] = 0; }
  chunks.push({ cells, off: 0, frac: 0, vy: 0, hit: false });
  const cx = cells[0].c * T, cy = cells[0].r * T;
  for (let k = 0; k < 6; k++) spawn(cx + Math.random() * T, cy + Math.random() * T, (Math.random() - 0.5) * 60, 10, 0.5, "#a8826e", 4, 600);
}
export function chunkBlockedAt(ch, off) {
  for (const k of ch.cells) {
    const r = k.r + off;
    if (r >= H) return true;
    if (!isGen(k.c, r)) ensureRect(k.c, r, k.c, r);                  // 깊은 굴로 떨어지면 아래 구역을 그때 만듦
    const v = tiles[r * W + k.c];
    if (solidTile(v)) return true;
  }
  return false;
}
export function landChunk(ch, off) {
  const pc0 = Math.floor((P.x - HW) / T), pc1 = Math.floor((P.x + HW - 0.001) / T);
  const pr0 = Math.floor((P.y - HH) / T), pr1 = Math.floor((P.y + HH - 0.001) / T);
  for (const k of ch.cells) {
    const r = k.r + off, i = r * W + k.c;
    for (let n = 0; n < 3; n++) spawn((k.c + Math.random()) * T, (r + 1) * T - 2, (Math.random() - 0.5) * 70, -20 - Math.random() * 40, 0.4, "#8d6a4a", 3, 500);
    if (P.dead <= 0 && k.c >= pc0 && k.c <= pc1 && r >= pr0 && r <= pr1) continue;   // 플레이어 칸은 비워 둠
    tiles[i] = k.id; setRub(i, k.rub); seen[i] = 1;
    if (k.rub) regenT[i] = REGEN_MIN + Math.random() * (REGEN_MAX - REGEN_MIN);
  }
  spawnDust((ch.cells[0].c + 0.5) * T, (ch.cells[0].r + off + 1) * T - 2, Math.min(8, 2 + (ch.cells.length >> 1)), Math.min(T * 4, ch.cells.length * 6));
  if (Math.abs(ch.cells[0].c * T - P.x) < 12 * T && Math.abs((ch.cells[0].r + off) * T - P.y) < 12 * T) S.shakeT = Math.max(S.shakeT, 0.25);
}
export function updateChunks(dt) {
  S.floatScanT += dt;
  if (S.floatScanT >= 0.25) { const d = S.floatScanT; S.floatScanT = 0; scanFloating(d); }
  for (let n = chunks.length - 1; n >= 0; n--) {
    const ch = chunks[n];
    ch.vy = Math.min(900 * PX, ch.vy + 1400 * PX * dt);
    ch.frac += ch.vy * dt;
    let landed = false;
    while (ch.frac >= T) {
      if (chunkBlockedAt(ch, ch.off + 1)) { landed = true; ch.frac = 0; break; }
      ch.off++; ch.frac -= T;
    }
    if (!landed && chunkBlockedAt(ch, ch.off + 1)) { landed = true; ch.frac = 0; }   // 바로 아래가 막혔으면 착지
    // 플레이어 충돌(낙석)
    if (!ch.hit && P.dead <= 0) {
      for (const k of ch.cells) {
        const x0 = k.c * T, y0 = (k.r + ch.off) * T + ch.frac;
        if (P.x + HW > x0 && P.x - HW < x0 + T && P.y + HH > y0 && P.y - HH < y0 + T) {
          ch.hit = true; P.fuel -= maxFuel() * 0.2; P.vy = -200 * PX;
          floaters.push({ x: P.x, y: P.y - 30, text: "낙석! 연료 -20%", color: "#ff6b6b", life: 1.4 });
          S.shakeT = Math.max(S.shakeT, 0.5);
          break;
        }
      }
    }
    if (landed) { landChunk(ch, ch.off); chunks.splice(n, 1); saveNow(false, true); }
  }
}
// 저장할 때는 떨어지는 중인 덩어리를 착지한 상태로 간주해서 기록
export function withChunksSettled(fn) {
  const undo = [];
  for (const ch of chunks) {
    let off = ch.off;
    while (!chunkBlockedAt(ch, off + 1)) off++;
    for (const k of ch.cells) {
      const i = (k.r + off) * W + k.c;
      undo.push([i, tiles[i], rub[i]]);
      tiles[i] = k.id; rub[i] = k.rub;
    }
  }
  try { return fn(); }
  finally { for (let n = undo.length - 1; n >= 0; n--) { tiles[undo[n][0]] = undo[n][1]; rub[undo[n][0]] = undo[n][2]; } }
}

