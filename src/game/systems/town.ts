// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./input.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { STAT, maxFuel, recalcStats, say } from "../core/stats.ts";
import { ITEMS } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { saveNow } from "../save/account.ts";
import { BARS, barValue, isBar, matHave, matName, matTake } from "./furnace.ts";
import { stashCargo, touch } from "./input.ts";

// ---- 제작소: 열기 / 제작 / 창고 판매 ----
export function openCraft() {
  stashCargo();                                          // 화물 광물은 창고로 자동 보관
  S.state = "craft"; S.craftSel = 0;
  if (S.craftTab >= RECIPE_CATS.length) S.craftTab = 0;
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
}
export function craftItem(id) {
  const it = ITEMS[id];
  if (!it || !it.craft) return;
  if (P.items[id]) return say("이미 제작한 장비예요");
  if (it.req && !P.items[it.req]) return say("먼저 " + ITEMS[it.req].name + " 제작");
  for (const m in it.mats) if (matHave(m) < it.mats[m]) return say(matName(m) + "이(가) 부족해요" + (isBar(m) ? " (용광로에서 재련)" : ""));
  if (P.money < it.cost) return say("돈이 부족해요 ($" + it.cost + ")");
  for (const m in it.mats) matTake(m, it.mats[m]);
  P.money -= it.cost;
  P.items[id] = true;
  recalcStats();
  if (it.fx.fuel) P.fuel = maxFuel();
  if (S.acct) S.acct.stats.crafted = (S.acct.stats.crafted || 0) + 1;
  say(it.name + " 제작 완료!");
  saveNow(true);
}
export function stashValue() {
  let v = 0;
  for (const id in P.stash) v += TILE[id].value * P.stash[id];
  return Math.round(v * STAT.sell);
}
// 판매 목록: 원석 9종 + 주괴 5종
export const SELL_KEYS = [6, 2, 3, 8, 4, 9, 5, 10, 11, "cu", "fe", "ag", "au", "mi"];
export const SELL_COLS = 5;
export const unitPrice = (k) => Math.round((BARS[k] ? barValue(k) : TILE[k].value) * STAT.sell);
export function sellItem(k, n) {
  if (!BARS[k]) return sellOre(k, n);
  const have = P.bars[k] || 0, c = Math.min(have, n);
  if (c <= 0) return say("판매할 " + BARS[k].name + "이(가) 없어요");
  const gain = unitPrice(k) * c;
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.bars[k] = have - c; if (P.bars[k] <= 0) delete P.bars[k];
  say(BARS[k].name + " " + c + "개 판매 +$" + gain);
  saveNow(true, true);
}
// 선택한 광물만 판매 (n: 개수, Infinity = 전부)
export function sellOre(id, n) {
  const have = P.stash[id] || 0, k = Math.min(have, n);
  if (k <= 0) return say("판매할 " + TILE[id].name + "이(가) 없어요");
  const gain = Math.round(TILE[id].value * k * STAT.sell);
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.stash[id] = have - k;
  if (P.stash[id] <= 0) delete P.stash[id];
  say(TILE[id].name + " " + k + "개 판매 +$" + gain);
  saveNow(true, true);
}
export function sellStash() {
  const gain = stashValue();
  if (gain <= 0) return say("판매할 광물이 없어요");
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.stash = {};
  say("창고 광물 판매 +$" + gain);
  saveNow(true);
}
export function buyItem(id) {
  const it = ITEMS[id];
  if (!it) return;
  if (it.cons) {
    if (P.money < it.cost) return say("돈이 부족합니다 ($" + it.cost + " 필요)");
    if ((P.inv[id] || 0) >= 99) return say("더 들 수 없어요 (최대 99개)");
    P.money -= it.cost;
    P.inv[id] = (P.inv[id] || 0) + 1;
    say(it.name + " 구매! (보유 " + P.inv[id] + "개)");
    saveNow(true, true);
    return;
  }
  if (P.items[id]) return say("이미 보유한 아이템입니다");
  if (it.req && !P.items[it.req]) return say("먼저 " + ITEMS[it.req].name + " 구매 필요");
  if (P.money < it.cost) return say("돈이 부족합니다 ($" + it.cost + " 필요)");
  P.money -= it.cost;
  P.items[id] = true;
  recalcStats();
  if (it.fx.fuel) P.fuel = maxFuel();               // 연료통을 사면 가득 채움
  say(it.name + " 장착!");
  saveNow(true);
}

