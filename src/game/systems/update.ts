// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./town.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { B_CRAFT, B_FURN, B_SHOP, BUILD_COLS, H, HH, HW, inB, layerOf, LAYERS, MINE_COL, ORE_COL, PX, SURF, T, TILE, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { FUEL_DIG, FUEL_IDLE, FUEL_THRUST, STAT, bombs, cargoCap, cargoCount, chips, drillMult, flashes, floaters, maxFuel, say, spawn, updateFx } from "../core/stats.ts";
import { ensureAround, hardOf, seen, solid, tiles } from "../core/world.ts";
import { CONS, visR } from "../data/consumables.ts";
import { checkQuests, onMined } from "../data/progress.ts";
import { saveNow } from "../save/account.ts";
import { discoverCave, placeSupport, updateCave } from "./cave.ts";
import { drops, spawnDrop, updateDrops } from "./drops.ts";
import { updateChunks } from "./floating.ts";
import { updateFurnace } from "./furnace.ts";
import { D_, L_, R_, U_ } from "./input.ts";

// =====================================================================
//  물리 / 업데이트
// =====================================================================
// ---- 소모품 사용 / 다이너마이트 ----
export function useConsumable(id) {
  const c = CONS[id];
  if (!c || P.dead > 0 || S.state !== "play") return;
  if (c.kind === "support") return placeSupport(id);
  if (!((P.inv[id] || 0) > 0)) return say(c.name + "이(가) 없어요! 아이템 상점에서 구매하세요");
  if (c.kind === "fuel") {
    if (P.fuel >= maxFuel() - 0.5) return say("연료가 이미 가득해요");
    P.fuel = Math.min(maxFuel(), P.fuel + maxFuel() * c.frac);
    P.inv[id]--;
    floaters.push({ x: P.x, y: P.y - 30, text: "연료 +" + Math.round(c.frac * 100) + "%", color: "#7cff6b", life: 1.2 });
    say(c.name + " 사용! (남은 " + P.inv[id] + "개)");
  } else {
    const col = Math.floor(P.x / T), row = Math.floor(P.y / T);
    if (row < SURF) return say("폭약은 땅속에서만 설치할 수 있어요");
    if (bombs.some((b) => b.c === col && b.r === row)) return say("이미 폭약이 설치된 자리예요");
    P.inv[id]--;
    bombs.push({ c: col, r: row, t: 2.5, rad: c.rad, id });
    say("폭약 설치! 멀리 떨어지세요 (남은 " + P.inv[id] + "개)");
  }
  saveNow(true, true);
}
export function explode(b) {
  const R = b.rad;
  let got = 0, lost = 0, broke = 0;
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    if (dc * dc + dr * dr > R * R + R) continue;            // 모서리를 깎은 둥근 범위
    const c = b.c + dc, r = b.r + dr;
    if (c <= 0 || c >= W - 1 || r < SURF || r >= H - 2) continue;
    const id = tiles[r * W + c];
    if (id === 0 || id === 7 || id === 13) continue;        // 공기 / 암반 / 건물 기초는 그대로
    tiles[r * W + c] = 0;
    seen[r * W + c] = 1;
    broke++;
    if (id < 12 && id !== 7) onMined(id);
    chips(c, r, id, 5, 1.5);
    if (TILE[id].value > 0) {
      if (cargoCount() < cargoCap()) { P.cargo[id] = (P.cargo[id] || 0) + 1; got++; } else { spawnDrop(id, (c + 0.5) * T, (r + 0.5) * T, 1); lost++; }
    }
  }
  const x = (b.c + 0.5) * T, y = (b.r + 0.5) * T;
  for (let i = 0; i < 44; i++) {
    spawn(x, y, (Math.random() - 0.5) * 460, (Math.random() - 0.5) * 460 - 60, 0.4 + Math.random() * 0.5,
      ["#ff8a1f", "#ffe066", "#9aa0b4", "#ffffff"][(Math.random() * 4) | 0], 5, 320);
  }
  flashes.push({ x, y, t: 0.4, rad: R });
  S.shakeT = 0.45;
  // 폭발에 휘말리면 연료를 잃고 튕겨 나감
  const d = Math.hypot(P.x / T - (b.c + 0.5), P.y / T - (b.r + 0.5));
  if (P.dead <= 0 && d < R + 0.9) {
    P.fuel -= maxFuel() * 0.3;
    P.vy = -320 * PX; P.vx = (P.x < x ? -1 : 1) * 240 * PX;
    floaters.push({ x: P.x, y: P.y - 30, text: "폭발! 연료 -30%", color: "#ff6b6b", life: 1.4 });
  }
  if (got > 0) floaters.push({ x: x, y: y - 20, text: "광물 +" + got, color: "#ffd34d", life: 1.4 });
  if (lost > 0) floaters.push({ x: x, y: y - 40, text: "화물 가득! " + lost + "개 떨어짐", color: "#ff6b6b", life: 1.4 });
  if (broke > 0) saveNow(true, true);
}
export function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.t -= dt;
    if (b.t <= 0) { bombs.splice(i, 1); explode(b); }
  }
  for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t -= dt; if (flashes[i].t <= 0) flashes.splice(i, 1); }
}
// 지나간 곳 기억: 플레이어 주변 칸을 '본 칸'으로 기록
export function revealAround() {
  const cc = Math.floor(P.x / T), rr = Math.floor(P.y / T), R = Math.max(1.6, visR() * 0.62);
  const key = cc + "," + rr + "," + R.toFixed(2);
  if (key === S.lastRevealKey) return;
  S.lastRevealKey = key;
  const ri = Math.ceil(R) + 1, px = P.x / T, py = P.y / T;
  for (let r = rr - ri; r <= rr + ri; r++) {
    if (r < 0 || r >= H) continue;
    for (let c = cc - ri; c <= cc + ri; c++) {
      if (c < 0 || c >= W) continue;
      const dx = c + 0.5 - px, dy = r + 0.5 - py;
      if (dx * dx + dy * dy <= R * R) seen[r * W + c] = 1;
    }
  }
}

export function collide(x, y) {
  const c0 = Math.floor((x - HW) / T), c1 = Math.floor((x + HW - 0.001) / T);
  const r0 = Math.floor((y - HH) / T), r1 = Math.floor((y + HH - 0.001) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return true;
  return false;
}

export function update(dt) {
  ensureAround(Math.floor(P.x / T), Math.floor(P.y / T));        // 플레이어 근처 땅을 아직 안 만들었으면 지금 만듦
  S.animT += dt;
  S.playT += dt;
  if (S.acct) { S.acct.playTime += dt; S.saveT += dt; if (S.saveT >= 15) saveNow(true, true); }   // 15초마다 자동 저장
  if (S.msgT > 0) S.msgT -= dt;
  if (S.bannerT > 0) S.bannerT -= dt;
  updateFx(dt);
  updateBombs(dt);
  if (S.shakeT > 0) S.shakeT -= dt;
  if (S.stoneHintT > 0) S.stoneHintT -= dt;
  updateCave(dt);
  updateChunks(dt);
  updateDrops(dt);
  updateFurnace(dt);
  S.questT += dt; if (S.questT >= 1) { S.questT = 0; checkQuests(false); }

  if (P.dead > 0) {
    P.dead -= dt;
    if (P.dead <= 0) respawn();
    return;
  }

  const dir = (R_() ? 1 : 0) - (L_() ? 1 : 0);
  if (dir !== 0) P.facing = dir;
  const target = dir * 170 * PX * STAT.speed;
  const acc = 1400 * PX * dt;
  if (P.vx < target) P.vx = Math.min(target, P.vx + acc);
  else if (P.vx > target) P.vx = Math.max(target, P.vx - acc);

  const thrusting = U_() && P.fuel > 0;
  if (thrusting) P.vy = Math.max(-Math.min(480, 260 * (1 + (STAT.thrust - 1) * 0.5)) * PX, P.vy - 1800 * PX * STAT.thrust * dt);
  P.vy = Math.min(520 * PX, P.vy + 900 * PX * dt);

  P.x += P.vx * dt;
  if (collide(P.x, P.y)) {
    P.x = P.vx > 0 ? Math.floor((P.x + HW) / T) * T - HW - 0.001
                    : (Math.floor((P.x - HW) / T) + 1) * T + HW + 0.001;
    P.vx = 0;
  }
  P.y += P.vy * dt;
  if (collide(P.x, P.y)) {
    P.y = P.vy > 0 ? Math.floor((P.y + HH) / T) * T - HH - 0.001
                    : (Math.floor((P.y - HH) / T) + 1) * T + HH + 0.001;
    P.vy = 0;
  }

  const grounded = collide(P.x, P.y + 1);
  P.grounded = grounded;
  const leftBlk = collide(P.x - 1, P.y);
  const rightBlk = collide(P.x + 1, P.y);

  // 채굴 대상
  let tgt = null, downDig = false, upDig = false;
  const rows = [Math.floor(P.y / T), Math.floor((P.y - HH + 1) / T), Math.floor((P.y + HH - 1) / T)];
  const headBlk = collide(P.x, P.y - 1);
  if (D_() && grounded) {
    tgt = [Math.floor(P.x / T), Math.floor((P.y + HH + 1) / T)]; downDig = true;
  } else if (U_() && headBlk && !L_() && !R_()) {                  // 천장에 머리가 닿은 채 위로 → 위 칸을 팜
    tgt = [Math.floor(P.x / T), Math.floor((P.y - HH - 1) / T)]; upDig = true;
  } else if (L_() && leftBlk) {
    const c = Math.floor((P.x - HW - 1) / T);
    for (const r of rows) if (solid(c, r)) { tgt = [c, r]; break; }
    P.facing = -1;
  } else if (R_() && rightBlk) {
    const c = Math.floor((P.x + HW + 1) / T);
    for (const r of rows) if (solid(c, r)) { tgt = [c, r]; break; }
    P.facing = 1;
  }

  let digging = false;
  const digDir = downDig ? "down" : upDig ? "up" : P.facing < 0 ? "left" : "right";
  if (tgt && tgt[0] >= 0 && tgt[0] < W && tgt[1] >= 0 && tgt[1] < H && tiles[tgt[1] * W + tgt[0]] > 0) {
    const id = tiles[tgt[1] * W + tgt[0]];
    const info = TILE[id];
    if ((id === 12 || id === 13 || id === 16) && S.stoneHintT <= 0) {
      say(id === 12 ? "단단한 돌이에요! 다이너마이트가 필요해요" : id === 16 ? "희귀 광물을 감싼 경암이에요. 드릴이 좋을수록 빨리 뚫려요" : "건물 아래 기초는 부술 수 없어요. 옆 빈 땅에서 내려가세요");
      S.stoneHintT = 6;
    }
    if (info.hard !== Infinity && P.fuel > 0) {
      digging = true;
      if (!S.dig || S.dig.c !== tgt[0] || S.dig.r !== tgt[1]) S.dig = { c: tgt[0], r: tgt[1], t: 0 };
      S.dig.t += dt;
      S.digPT -= dt;
      if (S.digPT <= 0) { S.digPT = 0.06; chips(S.dig.c, S.dig.r, id, 2, 1, digDir); }
      if (S.dig.t >= hardOf(id, S.dig.r) / drillMult()) {
        tiles[tgt[1] * W + tgt[0]] = 0;
        onMined(id);
        chips(tgt[0], tgt[1], id, 12, 1.4, digDir);
        S.dig = null;
        discoverCave(tgt[0], tgt[1]);                              // 뚫은 칸 옆이 숨은 동굴이면 동굴 전체가 드러남
        if (info.value > 0) {
          const ox = (tgt[0] + 0.5) * T, oy = (tgt[1] + 0.5) * T;
          const lucky = STAT.lucky > 0 && Math.random() < STAT.lucky;
          for (let n = 0; n < (lucky ? 2 : 1); n++) {
            if (cargoCount() < cargoCap()) P.cargo[id] = (P.cargo[id] || 0) + 1;
            else spawnDrop(id, ox, oy, 1);                       // 화물칸이 가득 → 그 자리에 떨어짐
          }
          if (lucky) floaters.push({ x: P.x, y: P.y - 42, text: "행운! +1", color: "#ffd34d", life: 1.1 });
          if (cargoCount() >= cargoCap() && drops.length && drops[drops.length - 1].age === 0) {
            say("화물칸이 가득 찼어요! 캔 광물은 땅에 떨어져요 (60초 안에 주우세요)");
            floaters.push({ x: P.x, y: P.y - 24, text: "FULL", color: "#ff6b6b", life: 1.1 });
          } else floaters.push({ x: P.x, y: P.y - 24, text: "+" + info.name, color: ORE_COL[id][0], life: 1.1 });
        }
      }
    }
  }
  if (!digging) S.dig = null;
  P.digging = digging;
  P.mode = digging && downDig ? "down" : digging && upDig ? "up" : "side";

  // 추진 파티클
  if (thrusting && Math.random() < 0.7) {
    const col = ["#ff8a1f", "#ffe066", "#9aa0b4"][(Math.random() * 3) | 0];
    spawn(P.x + (Math.random() - 0.5) * 10, P.y + HH, (Math.random() - 0.5) * 50, 90 + Math.random() * 90, 0.35, col, 4, 0);
  }

  revealAround();
  // 연료 / 상점 / 지층
  const row = Math.floor(P.y / T), col = Math.floor(P.x / T);
  const onGround = row < SURF;                                     // 지상(마을이든 광산 터든)에 나오면 연료가 줄지 않고 가득 참
  S.nearItems = onGround && inB(B_SHOP, col);                      // 상점 앞
  S.nearCraft = onGround && inB(B_CRAFT, col);                     // 제작소 앞
  S.nearFurnace = onGround && inB(B_FURN, col);                    // 용광로 앞
  if (!onGround) P.fuel -= (FUEL_IDLE + (thrusting ? FUEL_THRUST : 0) + (digging ? FUEL_DIG : 0)) * STAT.eff * dt;
  if (onGround && !S.inShop) {
    const was = P.fuel;
    P.fuel = maxFuel();
    if (was < maxFuel() - 0.5) say(cargoCount() > 0 ? "지상 도착 · 연료 충전! 광물은 마을 건물 [E] → 판매 탭에서 팔아요" : "지상 도착 · 연료 충전");
  }
  S.inShop = onGround;

  const depth = Math.max(0, P.y / T - SURF);
  if (S.acct && depth > S.acct.stats.maxDepth) S.acct.stats.maxDepth = depth;
  const ly = layerOf(depth);
  if (ly > P.layerMax) {
    P.layerMax = ly;
    S.bannerText = "제" + (ly + 1) + "층  " + LAYERS[ly].name;
    S.bannerT = 3.5;
  }

  if (P.fuel <= 0) {
    P.fuel = 0;
    P.dead = 2.5;
    if (S.acct) S.acct.stats.deaths++;
    saveNow(true);
    say("연료 고갈! 구조 중... (화물 손실)");
  }
}

export function respawn() {
  P.x = 6 * T + T / 2; P.y = SURF * T - HH - 1;
  P.vx = P.vy = 0; P.cargo = {}; P.fuel = maxFuel(); S.dig = null; S.inShop = true;
  bombs.length = 0; S.lastRevealKey = ""; S.graceT = 3;
}

