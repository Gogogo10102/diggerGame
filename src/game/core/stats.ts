// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../art/buildings.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { CRAFT_ICON } from "../art/itemIcons.ts";
import { LAYERS, ORE_COL, PX, SURF, T, layerOf } from "./config.ts";
import { P } from "./player.ts";
import { S } from "./state.ts";
import { LOOK } from "../data/consumables.ts";
import { solid } from "./world.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { cv } from "../render/util.ts";
import { updateDebris } from "../systems/collapseFx.ts";
import { lsSet } from "../ui/inventory.ts";

// ---- 능력치: 구매한 아이템 효과의 합 ----
// 연료 소모(초당). 기본 연료·소모량은 여기서 조절
export const FUEL_BASE = 60, FUEL_IDLE = 0.12, FUEL_THRUST = 0.7, FUEL_DIG = 0.3;
S.MINER_LV = 1;                                   // 광부 레벨 (레벨당 채굴 +1.2%, 판매가 +0.4%)
export const PICK_BASE = 0.5;                     // 기본 곡괭이 채굴 속도 (로봇 기본 드릴 = 1)
export const STAT = { drill: 1, fuel: FUEL_BASE, cargo: 10, thrust: 1, speed: 1, light: 1, eff: 1, sell: 1, lucky: 0, pick: PICK_BASE, rocket: 0 };
export function recalcStats() {
  const s = { drill: 0, fuel: 0, cargo: 0, thrust: 0, speed: 0, light: 0, eff: 0, sell: 0, lucky: 0, pick: 0, rocket: 0, robot: 0 };
  for (const id in P.items) {
    if (!P.items[id]) continue;
    for (const k in ITEMS[id].fx) s[k] += ITEMS[id].fx[k];
  }
  STAT.drill = 1 + s.drill + (S.MINER_LV - 1) * 0.012;
  STAT.fuel = FUEL_BASE + s.fuel;
  STAT.cargo = 10 + s.cargo;
  STAT.thrust = 1 + s.thrust;
  STAT.speed = 1 + s.speed;
  STAT.light = 1 + s.light;
  STAT.eff = Math.max(0.4, 1 - s.eff);   // 연료 소모 배율
  STAT.sell = 1 + s.sell + (S.MINER_LV - 1) * 0.004;
  STAT.lucky = Math.min(0.9, s.lucky);   // 광물을 하나 더 얻을 확률
  STAT.pick = PICK_BASE + s.pick + (S.MINER_LV - 1) * 0.006;   // 사람: 곡괭이
  STAT.rocket = s.rocket;                // 사람: 백팩 로켓 추진력 (0 = 로켓 없음 → 못 낢)
  {                                      // 로봇 외형: 장비 단계에 따라 달라짐
    const lk = { drill: 0, tracks: 0, lamp: 0, crate: 0, engine: 0, pick: 0, rocket: 0 };
    for (const cat of CATS) {
      if (cat.cons || lk[cat.icon] === undefined) continue;
      cat.ids.forEach((id, i) => { if (P.items[id]) lk[cat.icon] = Math.max(lk[cat.icon], i + 1); });
    }
    for (const id in CRAFT_ICON) {
      const k = CRAFT_ICON[id][0];
      if (P.items[id] && lk[k] !== undefined) lk[k] = Math.max(lk[k], CRAFT_ICON[id][1] + 1);
    }
    Object.assign(LOOK, lk);
    LOOK.key = [lk.drill, lk.tracks, lk.lamp, lk.crate, lk.engine].join(",");   // (로봇 그림 캐시 키. 곡괭이·로켓 단계 LOOK.pick · LOOK.rocket 은 사람 그림용)
  }
}
recalcStats();
export const maxFuel = () => STAT.fuel;
export const cargoCap = () => STAT.cargo;
// 지금 파는 힘: 로봇에 타 있으면 드릴, 사람이면 곡괭이
export const drillMult = () => (P.mech ? STAT.drill : STAT.pick);
export const canFly = () => P.mech || STAT.rocket > 0;
export const cargoCount = () => Object.values(P.cargo).reduce((a, b) => a + b, 0);
S.dig = null;
export const ZOOMS = [0, 1, 1.5, 2];                          // 0 = 자동. 0.5 단위라야 도트가 깨지지 않음 (타일이 커서 1배가 기본)
S.zoomSel = 0;
export function autoZoom() {
  const short = Math.min(cv.width, cv.height), n = short < 520 ? 7 : 8.5;   // 짧은 쪽에 보이는 타일 수 목표
  return Math.max(1, Math.min(2, Math.floor(2 * short / (T * n)) / 2));
}
export const curZoom = () => (S.zoomSel > 0 ? ZOOMS[S.zoomSel] : autoZoom());
export const zoomName = () => (S.zoomSel > 0 ? ZOOMS[S.zoomSel] + "x" : "자동(" + autoZoom() + "x)");
export function cycleZoom() {
  S.zoomSel = (S.zoomSel + 1) % ZOOMS.length;
  lsSet("zoom", String(S.zoomSel));
  say("화면 확대: " + zoomName());
}
export const SHOP_PER = 4;                                   // 상점 한 쪽에 보이는 아이템 수
export const bombs = [], flashes = [];
S.shakeT = 0; S.stoneHintT = 0; S.lastRevealKey = "";
S.inShop = true;
S.nearItems = false; S.nearCraft = false; S.nearFurnace = false;
S.shopTab = 0; S.shopSel = 0; S.craftTab = 0; S.craftSel = 0; S.sellSel = 0; S.shopPer = 0; S.townU = 1; S.townLast = null; S.townCloseT = 0; S.townCloseState = null; S.townDimDone = false;
S.state = "title";       // title | play
S.showHelp = true;
S.msg = ""; S.msgT = 0;
S.bannerText = ""; S.bannerT = 0; S.banner = null;
S.animT = 0; S.digPT = 0; S.playT = 0;
export const say = (s) => { S.msg = s; S.msgT = 2.5; };
// 화면 위 알림 띠(지층 진입 · 최고 기록 · 새 광물 · 레벨 업 · 칭호). 한꺼번에 생기면 차례로 하나씩 보여 줌
//  icon: 왼쪽 칸에 그릴 그림(캔버스), col: 제목 색
export const BANNER_T = 3.5;
export const bannerQ = [];
export function pushBanner(title, sub = "", icon = null, col = "#ffd34d") {
  if (bannerQ.length >= 6) bannerQ.shift();                    // 너무 쌓이면 오래된 것부터 버림
  bannerQ.push({ title, sub, icon, col });
}

// 파티클 / 떠오르는 글자
export const parts = [];
export const floaters = [];
export function spawn(x, y, vx, vy, life, color, size, g) {
  const q = { x, y, vx, vy, life, max: life, color, size, g, bounce: false };
  parts.push(q);
  if (parts.length > 500) parts.splice(0, parts.length - 500);   // 너무 많아지면 오래된 것부터
  return q;
}
// 파편: 드릴이 닿은 면에서 튀어나와 플레이어 쪽으로 날아감
//   dir = 파는 방향 ("down" 아래 칸 / "up" 위 칸 / "left" 왼쪽 칸 / "right" 오른쪽 칸)
//   아래를 파면 위로 튀고, 옆을 파면 반대쪽(플레이어 쪽)으로, 위를 파면 아래로 쏟아짐
export function chips(c, r, id, n, power, dir) {
  const L = LAYERS[layerOf(r - SURF)];
  const cols = id === 17 ? ["#8a5a30", "#b07a44", "#ffcc33"] : id >= 12 ? ["#8a90a0", "#5b606e", "#b0b6c6"] : id > 1 ? [ORE_COL[id][1], L.base, ORE_COL[id][0]] : [L.base, L.hi, L.lo];   // 17 보물 상자 = 나무·금 조각
  const d = dir || "down", k = PX * power, rnd = Math.random;
  for (let i = 0; i < n; i++) {
    let x, y, vx, vy;
    if (d === "down") {                                              // 칸 윗면 → 위로
      x = (c + 0.15 + rnd() * 0.7) * T; y = r * T + 2 + rnd() * 6;
      vx = (rnd() - 0.5) * 140 * k; vy = -(50 + rnd() * 110) * k;
    } else if (d === "up") {                                         // 칸 아랫면 → 아래로 쏟아짐
      x = (c + 0.15 + rnd() * 0.7) * T; y = (r + 1) * T - 2 - rnd() * 6;
      vx = (rnd() - 0.5) * 90 * k; vy = (20 + rnd() * 70) * k;
    } else {                                                         // 옆 칸: 플레이어 쪽 면 → 플레이어 쪽으로
      const s = d === "left" ? 1 : -1;                               // 파편이 날아갈 방향
      x = (d === "left" ? (c + 1) * T - 2 - rnd() * 6 : c * T + 2 + rnd() * 6); y = (r + 0.2 + rnd() * 0.6) * T;
      vx = s * (50 + rnd() * 120) * k; vy = -(10 + rnd() * 80) * k;
    }
    const p = spawn(x, y, vx, vy, 0.55 + rnd() * 0.35, cols[i % cols.length], [2, 4, 4, 6][(rnd() * 4) | 0], 720 * PX);
    p.bounce = true;                                               // 흙 부스러기는 바닥에 떨어져 톡 튀고 멈춤
  }
}
export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    if (q.bounce && q.vy > 0 && solid(Math.floor(q.x / T), Math.floor(q.y / T))) {
      q.y = Math.floor(q.y / T) * T - 1;                           // 바닥 위로 올려놓고
      q.vy = q.vy > 120 * PX ? -q.vy * 0.32 : 0;                   // 세게 떨어지면 한 번 더 튀고, 아니면 멈춤
      q.vx *= 0.45;
      if (q.vy === 0) { q.g = 0; q.vx = 0; q.life = Math.min(q.life, 0.35); }   // 바닥에 남았다가 곧 사라짐
    }
    if (q.life <= 0) parts.splice(i, 1);
  }
  updateDebris(dt);
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 36 * dt; f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  // 떠오르는 글자끼리 겹치면(한꺼번에 여러 개: 보물+레벨 업+칭호 등) 먼저 생긴 것을 위로 밀어 줄을 띄움
  for (let i = 0; i < floaters.length; i++) for (let j = i + 1; j < floaters.length; j++) {
    const a = floaters[i], b = floaters[j], dy = a.y - b.y;
    if (Math.abs(a.x - b.x) < 160 && Math.abs(dy) < 20) {
      const up = 20 - Math.abs(dy);
      if (dy <= 0) a.y -= up; else b.y -= up;                         // 위에 있는 쪽을 더 위로
    }
  }
}

