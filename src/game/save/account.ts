// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./worldSave.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { BUILD_COLS, B_CRAFT, B_FURN, B_SHOP, H, HH, LAYERS, MINE_COL, SURF, T, TILE, W, inB } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { FUEL_BASE, bombs, flashes, floaters, maxFuel, parts, recalcStats, say } from "../core/stats.ts";
import { fixFoundation, genWorld, legacySeen, regenT, rub, rubSet, warn } from "../core/world.ts";
import { HOT } from "../data/consumables.ts";
import { ITEMS } from "../data/items.ts";
import { checkQuests, initProgress } from "../data/progress.ts";
import { SAVE_VER } from "./config.ts";
import { decodeRLE, decodeSeen, decodeWorld, encodeRLE, encodeSeen, encodeWorld } from "./worldSave.ts";
import { REGEN_MAX, REGEN_MIN } from "../systems/cave.ts";
import { debrisList, debrisT, dust } from "../systems/collapseFx.ts";
import { drops } from "../systems/drops.ts";
import { chunks, floatT, withChunksSettled } from "../systems/floating.ts";
import { BARS } from "../systems/furnace.ts";
import { collide, revealAround } from "../systems/update.ts";
import { SaveStore, lsSet } from "../ui/inventory.ts";
import { hideOv, openAccountScreen } from "../ui/overlay.ts";

// ---- 현재 계정 ----
S.acct = null;                  // {id, name, created, seed, playTime, stats}
S.saveT = 0; S.lastSave = 0; S.saveFlash = 0; S.saveFail = false;
export const newId = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const cleanName = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 12);

export function snapshot() {
  return withChunksSettled(() => ({
    ver: SAVE_VER, id: S.acct.id, name: S.acct.name, created: S.acct.created, updated: Date.now(),
    seed: S.acct.seed, playTime: Math.floor(S.acct.playTime), stats: S.acct.stats,
    player: { x: P.x, y: P.y, fuel: P.fuel, money: P.money, cargo: P.cargo, stash: P.stash, bars: P.bars, inv: P.inv, items: P.items, layerMax: P.layerMax, facing: P.facing },
    settings: { showHelp: S.showHelp },
    world: encodeWorld(),
    stones: 1, worldV: 2,
    seen: encodeSeen(),
    rub: encodeRLE(rub),
    mineNo: S.acct.mineNo || 1,
    furnace: S.acct.furnace,
    xp: S.acct.xp, quest: S.acct.quest, title: S.acct.title || "",
  }));
}
export function saveNow(force, quiet) {
  if (!S.acct || S.state === "account") return Promise.resolve(false);
  const t = performance.now();
  if (!force && t - S.lastSave < 1500) return Promise.resolve(false);
  S.lastSave = t; S.saveT = 0;
  return SaveStore.save(snapshot()).then(
    (ok) => { if (!quiet || !ok) { S.saveFlash = 1.8; S.saveFail = !ok; } return ok; },
    () => { S.saveFlash = 1.8; S.saveFail = true; return false; });
}

export function applyAccount(d) {
  const pl = d.player || {}, st = d.stats || {};
  S.acct = {
    id: d.id, name: d.name, created: d.created || Date.now(), seed: d.seed | 0, mineNo: Math.max(1, Math.min(9999, d.mineNo | 0)),
    playTime: Number(d.playTime) || 0,
    stats: {
      maxDepth: Number(st.maxDepth) || 0, earned: Number(st.earned) || 0, deaths: Number(st.deaths) || 0, crafted: Number(st.crafted) || 0, collapses: Number(st.collapses) || 0,
      mined: st.mined && typeof st.mined === "object" ? st.mined : {},
    },
  };
  initProgress(d);
  let regenWorld = false;
  genWorld(S.acct.seed);                                          // 같은 시드로 마을 근처를 만들고, 저장된 구역의 바뀐 칸을 덮어씀
  if (!(typeof d.world === "string" && decodeWorld(d.world))) { genWorld(S.acct.seed); regenWorld = typeof d.world === "string"; }   // 예전 형식(작은 맵) → 새로
  else if (!(typeof d.seen === "string" && decodeSeen(d.seen))) legacySeen();
  fixFoundation();                                                 // 건물 기초석 보정
  if (regenWorld || !(typeof d.rub === "string" && decodeRLE(d.rub, rub, 1))) rub.fill(0);
  rubSet.clear();
  for (let i = 0; i < rub.length; i++) if (rub[i]) { rubSet.add(i); regenT[i] = REGEN_MIN + Math.random() * (REGEN_MAX - REGEN_MIN); }
  warn.fill(0); floatT.fill(0); chunks.length = 0; drops.length = 0; debrisT.fill(0); debrisList.length = 0; dust.length = 0; S.floatScanT = 0; S.unstable = []; S.graceT = 6; S.cavWarn = 0; S.scanT = 0;     // 불러온 직후 잠깐은 붕괴 유예
  P.items = {};
  for (const id in (pl.items || {})) if (ITEMS[id] && pl.items[id]) P.items[id] = true;   // 모르는 아이템은 무시
  recalcStats();
  P.money = Math.max(0, Math.floor(Number(pl.money) || 0));
  P.cargo = {};
  for (const id in (pl.cargo || {})) {
    const n = Math.max(0, Math.floor(Number(pl.cargo[id]) || 0));
    if (TILE[id] && TILE[id].value > 0 && n > 0) P.cargo[id] = n;
  }
  P.stash = {};
  for (const id in (pl.stash || {})) {
    const n = Math.max(0, Math.floor(Number(pl.stash[id]) || 0));
    if (TILE[id] && TILE[id].value > 0 && n > 0) P.stash[id] = n;
  }
  P.bars = {};
  for (const k in (pl.bars || {})) {
    const n = Math.max(0, Math.floor(Number(pl.bars[k]) || 0));
    if (BARS[k] && n > 0) P.bars[k] = n;
  }
  P.inv = {};
  for (const id of HOT) {
    const n = Math.max(0, Math.min(99, Math.floor(Number((pl.inv || {})[id]) || 0)));
    if (n > 0) P.inv[id] = n;
  }
  P.fuel = Number.isFinite(pl.fuel) ? Math.min(maxFuel(), pl.fuel) : maxFuel();
  P.layerMax = Math.max(0, Math.min(LAYERS.length - 1, pl.layerMax | 0));
  P.facing = pl.facing < 0 ? -1 : 1;
  const sx = 6 * T + T / 2, sy = SURF * T - HH - 1;
  P.x = Number.isFinite(pl.x) ? pl.x : sx;
  P.y = Number.isFinite(pl.y) ? pl.y : sy;
  const broken = regenWorld || P.x < 0 || P.x > W * T || P.y < -200 || P.y > H * T || collide(P.x, P.y);
  if (broken || !(P.fuel > 0)) {
    P.x = sx; P.y = sy;                                           // 연료가 바닥났던 저장은 구조된 상태로 시작
    if (!(P.fuel > 0)) { P.cargo = {}; P.fuel = maxFuel(); }
  }
  P.vx = 0; P.vy = 0; P.dead = 0; P.digging = false;
  S.dig = null; parts.length = 0; floaters.length = 0;
  bombs.length = 0; flashes.length = 0; S.shakeT = 0; S.lastRevealKey = "";
  S.showHelp = !(d.settings && d.settings.showHelp === false);
  const row = Math.floor(P.y / T), col = Math.floor(P.x / T);
  S.inShop = row < SURF;
  S.nearItems = row < SURF && inB(B_SHOP, col);
  S.nearCraft = row < SURF && inB(B_CRAFT, col);
  S.nearFurnace = row < SURF && inB(B_FURN, col);
  revealAround();
  S.msgT = 0; S.bannerT = 0; S.playT = 0; S.saveT = 0; S.lastSave = performance.now();
  S.state = "play";
  checkQuests(true);
  if (regenWorld) say("맵이 넓어져서 광산을 새로 만들었어요 (돈·장비·업적은 그대로)");
}

export function newAccountData(name) {
  const seed = ((Math.random() * 2147483647) | 0) || 1;
  genWorld(seed);
  const now = Date.now();
  return {
    ver: SAVE_VER, id: newId(), name, created: now, updated: now, seed, mineNo: 1, xp: 0, quest: {}, title: "", playTime: 0,
    stats: { maxDepth: 0, earned: 0, deaths: 0, crafted: 0, collapses: 0, mined: {} },
    player: { x: 6 * T + T / 2, y: SURF * T - HH - 1, fuel: FUEL_BASE, money: 0, cargo: {}, stash: {}, bars: {}, inv: {}, items: {}, layerMax: 0, facing: 1 },
    settings: { showHelp: true },
    world: encodeWorld(),
    stones: 1, worldV: 2,
    seen: encodeSeen(),
    rub: encodeRLE(rub),
  };
}
export function enterGame(d) { applyAccount(d); lsSet("last", d.id); hideOv(); }
export async function createAccount(rawName) {
  const name = cleanName(rawName);
  if (!name) return "이름을 입력해 주세요";
  const list = await SaveStore.list();
  if (list.some((a) => a.name.toLowerCase() === name.toLowerCase())) return "이미 있는 이름이에요";
  const d = newAccountData(name);
  await SaveStore.save(d);
  enterGame(d);
  return null;
}
export async function loginAccount(id) {
  const d = await SaveStore.load(id);
  if (!d || typeof d !== "object" || typeof d.name !== "string") return openAccountScreen("계정 데이터를 읽을 수 없어요");
  enterGame(d);
}

