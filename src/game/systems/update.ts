// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./town.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { B_CRAFT, B_FURN, B_SHOP, BUILD_COLS, H, HH, HW, inB, layerOf, LAYERS, MINE_COL, ORE_COL, PX, SURF, T, TILE, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { BANNER_T, FUEL_DIG, FUEL_IDLE, FUEL_THRUST, STAT, bannerQ, bombs, cargoCap, cargoCount, chips, drillMult, flashes, floaters, maxFuel, pushBanner, say, spawn, updateFx } from "../core/stats.ts";
import { ICON, dirtTiles } from "../art/sprites.ts";

// 보물 상자 열기: 깊을수록 많은 돈 + 25% 확률로 소모품 하나. 처음 열면 알림
export function openChest(c, r) {
  const d = Math.max(0, r - SURF), x = (c + 0.5) * T, y = (r + 0.5) * T;
  const money = Math.round((60 + d * 1.6) * (0.7 + Math.random() * 0.6));
  P.money += money;
  if (S.acct) { S.acct.stats.earned = (S.acct.stats.earned || 0) + money; S.acct.stats.chests = (S.acct.stats.chests || 0) + 1; }
  let bonus = "";
  if (Math.random() < 0.25) {
    const pick = d < 150 ? ["fuel_s", "dyn_s"] : d < 600 ? ["fuel_m", "dyn_s", "dyn_l"] : ["fuel_l", "dyn_l", "dyn_x"];
    const id = pick[(Math.random() * pick.length) | 0];
    P.inv[id] = (P.inv[id] || 0) + 1; bonus = " + " + CONS[id].name;
  }
  floaters.push({ x, y: y - 20, text: "보물! +$" + money + bonus, color: "#ffd34d", life: 1.8 });
  for (let k = 0; k < 18; k++) spawn(x + (Math.random() - 0.5) * 30, y, (Math.random() - 0.5) * 200 * PX, -(80 + Math.random() * 160) * PX, 0.7 + Math.random() * 0.4, ["#ffd34d", "#fff3a8", "#ffb020"][k % 3], 4, 600 * PX);
  sfx("sell"); sfx("levelup", { pitch: 1.6, vol: 0.4 });
  if (S.acct && S.acct.stats.chests === 1) pushBanner("보물 상자 발견!", "땅속 곳곳에 묻혀 있어요 · 깊을수록 값진 보물", ICON.chest, "#ffd34d");
  return money;
}

// 처음 하는 사람 안내: 한 단계씩, 해내면 다음으로. 진행은 계정에 저장(S.acct.tut). 도움말(H)을 끄면 안 보임
//  key: 키보드 문구 / touch: 터치 문구 / done: 끝났는지
export const TUT_STEPS = [
  { key: "↓ 키로 땅을 파고 내려가 보세요", touch: "아래로 드래그해서 땅을 파고 내려가 보세요", done: () => P.y / T - SURF >= 4 },
  { key: "광물을 캐 보세요 (반짝이는 돌)", touch: "광물을 캐 보세요 (반짝이는 돌)", done: () => cargoCount() > 0 || (S.acct && S.acct.stats.earned > 0) },
  { key: "↑ 키로 추진해 지상으로! 연료는 지상에서 충전돼요", touch: "위로 드래그해 추진! 연료는 지상에서 충전돼요", done: () => S.acct && ((S.acct.stats.trips || 0) > 0 || S.acct.stats.earned > 0) },
  { key: "마을 건물 앞에서 [E] → 판매 탭에서 광물을 팔아요", touch: "마을 건물을 눌러 판매 탭에서 광물을 팔아요", done: () => S.acct && S.acct.stats.earned > 0 },
  { key: "상점에서 장비를 사서 더 깊이 내려가요!", touch: "상점에서 장비를 사서 더 깊이 내려가요!", done: () => Object.keys(P.items).length > 0 },
];
export function updateTutorial(dt) {
  if (!S.acct) return;
  if (S.tutFlash > 0) S.tutFlash -= dt;
  const k = S.acct.tut | 0;
  if (k >= TUT_STEPS.length || S.tutFlash > 0) return;              // 다 했거나, 방금 끝낸 단계를 보여 주는 중
  if (TUT_STEPS[k].done()) {
    S.acct.tut = k + 1; S.tutFlash = 1.4; S.tutDone = k;           // 1.4초 동안 '완료' 표시 후 다음 단계
    sfx("tick", { pitch: 1.4 });
    if (S.acct.tut >= TUT_STEPS.length) pushBanner("기본은 끝!", "이제 더 깊이, 더 값진 광물을 찾아보세요", ICON.trophy, "#7cff6b");
  }
}

// 로봇 살아 있는 느낌: 2~5초마다 눈 깜빡(가끔 두 번), 안테나는 스프링처럼 움직임 반대로 기울었다 돌아옴
S.blinkT = 2.5; S.antA = 0; S.antV = 0; S.lastVx = 0;
export function animMiner(dt) {
  S.blinkT -= dt;
  if (S.blinkT <= 0) {
    if (S.minerBlink) { S.minerBlink = false; S.blinkT = Math.random() < 0.2 ? 0.14 : 2 + Math.random() * 3; }   // 20% 는 바로 한 번 더
    else { S.minerBlink = true; S.blinkT = 0.12; }
  }
  const acc = (P.vx - S.lastVx) / Math.max(dt, 1e-4); S.lastVx = P.vx;
  const fwd = P.facing < 0 ? -1 : 1;                               // 그림이 왼쪽을 볼 땐 뒤집혀 그려지므로 '앞' 기준으로
  S.antV += (-S.antA * 140 - S.antV * 9 - acc * fwd / (900 * PX) * 24) * dt;   // 앞으로 가속하면 뒤로 기울고, 멈추면 앞으로 쏠림
  if (P.digging) S.antV += (Math.random() - 0.5) * 60 * dt * 10;   // 파는 동안 덜덜
  S.antA = Math.max(-1.5, Math.min(1.5, S.antA + S.antV * dt));
  S.minerAnt = S.antA < -0.35 ? 0 : S.antA > 0.35 ? 2 : 1;
}

// 지층 알림의 둘째 줄: 이 지층 깊이에서 처음 나오기 시작하는 광물 (없으면 깊이만)
export function layerSub(ly) {
  const from = LAYERS[ly].from, to = ly + 1 < LAYERS.length ? LAYERS[ly + 1].from : Infinity;
  const fresh = ORE_GEN.filter((g) => g.rs >= from && g.rs < to).map((g) => TILE[g.id].name);
  return from + "m 아래" + (fresh.length ? " · 새 광물: " + fresh.join(" · ") : "");
}
import { ORE_GEN, ensureAround, hardOf, seen, solid, tiles } from "../core/world.ts";
import { CONS, visR } from "../data/consumables.ts";
import { checkQuests, onMined } from "../data/progress.ts";
import { saveNow } from "../save/account.ts";
import { discoverCave, placeSupport, updateCave } from "./cave.ts";
import { drops, spawnDrop, updateDrops } from "./drops.ts";
import { updateChunks } from "./floating.ts";
import { dustCol, puff } from "./collapseFx.ts";
import { updateFurnace } from "./furnace.ts";
import { D_, L_, R_, U_ } from "./input.ts";
import { sfx, sfxLoop } from "../core/sound.ts";

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
    sfx("refuel");
    floaters.push({ x: P.x, y: P.y - 30, text: "연료 +" + Math.round(c.frac * 100) + "%", color: "#7cff6b", life: 1.2 });
    say(c.name + " 사용! (남은 " + P.inv[id] + "개)");
  } else {
    const col = Math.floor(P.x / T), row = Math.floor(P.y / T);
    if (row < SURF) return say("폭약은 땅속에서만 설치할 수 있어요");
    if (bombs.some((b) => b.c === col && b.r === row)) return say("이미 폭약이 설치된 자리예요");
    P.inv[id]--;
    bombs.push({ c: col, r: row, t: 2.5, rad: c.rad, id });
    if (S.acct) S.acct.stats.bombs = (S.acct.stats.bombs || 0) + 1;
    sfx("fuse");
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
    if (id === 17) { onMined(id); openChest(c, r); }               // 폭파해도 상자는 열림
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
  sfx("boom", { vol: Math.max(0.25, 1 - Math.hypot(P.x - x, P.y - y) / (20 * T)) });
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
  if (S.bannerT <= 0 && bannerQ.length) { S.banner = bannerQ.shift(); S.bannerText = S.banner.title; S.bannerT = BANNER_T; }
  animMiner(dt);
  updateTutorial(dt);
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
  const fallV = P.vy;
  if (collide(P.x, P.y)) {
    if (fallV > 260 * PX) sfx("land", { vol: Math.min(1, fallV / (520 * PX)) });   // 세게 떨어질수록 큰 쿵
    if (fallV > 200 * PX) {                                          // 착지: 궤도 양 끝에서 먼지가 옆으로 퍼짐
      const fr = Math.floor((P.y + HH + 2) / T), n = Math.min(4, 1 + Math.floor(fallV / (130 * PX)));
      for (const sd of [-1, 1]) for (let k = 0; k < n; k++)
        puff(P.x + sd * (HW + 4), P.y + HH - 2, sd * (30 + Math.random() * 50) * PX, -(4 + Math.random() * 10) * PX, 4 + Math.random() * 3, dustCol(fr), 0.55 + Math.random() * 0.25);
    }
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
      if (S.digPT <= 0) {
        S.digPT = 0.06; chips(S.dig.c, S.dig.r, id, 2, 1, digDir); sfx("dig", { hard: info.hard >= 1.2, vol: 0.45 });   // 드릴 소리 위에 흙 부스러지는 소리
        if (Math.random() < 0.8) {                                 // 드릴 끝에서 먼지가 피어오름
          const [fx, fy] = digDir === "down" ? [P.x + P.facing * 4, tgt[1] * T] : digDir === "up" ? [P.x, (tgt[1] + 1) * T] : [digDir === "right" ? tgt[0] * T : (tgt[0] + 1) * T, P.y + 6];
          puff(fx, fy, (digDir === "left" ? 1 : digDir === "right" ? -1 : (Math.random() - 0.5)) * (20 + Math.random() * 30) * PX, -(6 + Math.random() * 18) * PX, 3 + Math.random() * 3, dustCol(tgt[1]), 0.5 + Math.random() * 0.3);
        }
      }
      if (S.dig.t >= hardOf(id, S.dig.r) / drillMult()) {
        tiles[tgt[1] * W + tgt[0]] = 0;
        onMined(id);
        chips(tgt[0], tgt[1], id, 12, 1.4, digDir);
        for (let k = 0; k < 4; k++) puff((tgt[0] + 0.2 + Math.random() * 0.6) * T, (tgt[1] + 0.2 + Math.random() * 0.6) * T, (Math.random() - 0.5) * 40 * PX, -(4 + Math.random() * 14) * PX, 5 + Math.random() * 5, dustCol(tgt[1]), 0.7 + Math.random() * 0.4);
        S.dig = null;
        if (id === 17) openChest(tgt[0], tgt[1]);
        else if (info.value > 0) sfx("ore", { pitch: 0.8 + Math.min(0.9, Math.log10(1 + info.value) * 0.3) }); else sfx("break");
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

  // 이동 · 추진 · 드릴 소리: 추진은 켜는 순간 점화음 + 로켓 불꽃 소리, 파는 동안은 드릴 소리가 이어짐
  if (thrusting && !S.thrustOn) sfx("ignite");
  S.thrustOn = !!thrusting;
  sfxLoop("thrust", !!thrusting, { pitch: P.vy < 0 ? 1.4 : 1 });
  sfxLoop("drill", !!P.digging, { hard: !!(S.dig && hardOf(tiles[S.dig.r * W + S.dig.c], S.dig.r) >= 1.2) });
  if (!thrusting && grounded && !digging && Math.abs(P.vx) > 40 * PX) {
    sfx("step", { pitch: 0.8 + Math.abs(P.vx) / (340 * PX) });
    S.trackDustT = (S.trackDustT || 0) - dt;                         // 궤도 뒤로 흙먼지가 조금씩
    if (S.trackDustT <= 0) {
      S.trackDustT = 0.09 + Math.random() * 0.06;
      const back = P.vx > 0 ? -1 : 1;
      puff(P.x + back * (HW + 2), P.y + HH - 3, back * (12 + Math.random() * 20) * PX, -(4 + Math.random() * 10) * PX, 2 + Math.random() * 2, dustCol(Math.floor((P.y + HH + 2) / T)), 0.4 + Math.random() * 0.2);
    }
  }
  // 연료가 1/4 아래로 떨어지면 1.5초마다 경고음
  if (!(Math.floor(P.y / T) < SURF) && P.fuel / maxFuel() < 0.25) { S.lowBeepT = (S.lowBeepT || 0) - dt; if (S.lowBeepT <= 0) { S.lowBeepT = 1.5; sfx("warn"); } }
  else S.lowBeepT = 0;
  // 추진 파티클
  if (thrusting && Math.random() < 0.7) {                           // 불꽃처럼 움직이는 반대쪽으로 흩날림
    const col = ["#ff8a1f", "#ffe066", "#9aa0b4"][(Math.random() * 3) | 0];
    spawn(P.x + (Math.random() - 0.5) * 10, P.y + HH, -P.vx * 0.6 + (Math.random() - 0.5) * 50, 90 + Math.random() * 90, 0.35, col, 4, 0);
    if (Math.random() < 0.18) puff(P.x + (Math.random() - 0.5) * 8, P.y + HH + 8, -P.vx * 0.3 + (Math.random() - 0.5) * 20, 30 + Math.random() * 30, 3 + Math.random() * 2, Math.random() < 0.5 ? "#8a90a0" : "#b6bcc8", 0.5);   // 불꽃 뒤 회색 연기
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
    if (was < maxFuel() - 0.5) sfx("refuel");
    if (was < maxFuel() - 0.5) say(cargoCount() > 0 ? "지상 도착 · 연료 충전! 광물은 마을 건물 [E] → 판매 탭에서 팔아요" : "지상 도착 · 연료 충전");
    if (S.acct && was < maxFuel() - 0.5) {                           // 땅속에서 올라옴: 귀환 기록 (업적 '귀환' · '아슬아슬')
      const st = S.acct.stats;
      if (cargoCount() > 0) st.trips = (st.trips || 0) + 1;
      if (was > 0 && was < maxFuel() * 0.1) {
        st.close = (st.close || 0) + 1;
        floaters.push({ x: P.x, y: P.y - 44, text: "아슬아슬 귀환!", color: "#ff9a3c", life: 1.6 });
      }
    }
  }
  S.inShop = onGround;

  const depth = Math.max(0, P.y / T - SURF);
  if (S.acct && depth > S.acct.stats.maxDepth) {
    const was = S.acct.stats.maxDepth;
    S.acct.stats.maxDepth = depth;
    // 100m 마다 최고 기록 알림 (처음 100m 부터. 지층 알림과 같은 깊이면 지층 알림만)
    const m0 = Math.floor((was + 1) / 100), m1 = Math.floor((depth + 1) / 100);
    if (m1 > m0 && m1 >= 1 && !LAYERS.some((L) => L.from === m1 * 100)) {
      pushBanner("최고 기록 " + m1 * 100 + "m!", "지금까지 가장 깊이 내려왔어요", ICON.depth, "#9fd8ff");
      sfx("levelup", { pitch: 1.25, vol: 0.6 });
    }
  }
  const ly = layerOf(depth);
  if (ly > P.layerMax) {
    P.layerMax = ly;
    pushBanner("제" + (ly + 1) + "층 · " + LAYERS[ly].name, layerSub(ly), dirtTiles[ly][0], "#ffd34d");
    sfx("cave", { pitch: 0.8 });
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

