// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./input.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { sfx } from "../core/sound.ts";
import { TILE, won } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { STAT, equipNew, equipToggle, maxFuel, recalcStats, say, worn } from "../core/stats.ts";
import { CATS, ITEMS, LV_MAX, itemLv, lvCost, reqMet } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { saveNow } from "../save/account.ts";
import { BARS, barValue, isBar, matHave, matName, matTake } from "./furnace.ts";
import { addXP, checkQuests, minedOf } from "../data/progress.ts";
import { stashCargo, touch } from "./input.ts";

// 안 되는 이유를 알려 줄 때: 삐 소리 + 안내
function townFail(m) { sfx("error"); return say(m); }

// ---- 제작소: 열기 / 제작 / 창고 판매 ----
export function openCraft() {
  stashCargo();                                          // 화물 광물은 창고로 자동 보관
  S.state = "craft"; S.craftSel = 0; sfx("open");
  if (S.craftTab >= RECIPE_CATS.length) S.craftTab = 0;
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
}
export function craftItem(id) {
  const it = ITEMS[id];
  if (!it || !it.craft) return;
  if (P.items[id]) return townFail("이미 제작한 장비예요");
  if (it.req && !P.items[it.req]) return townFail("먼저 " + ITEMS[it.req].name + " 제작");
  for (const m in it.mats) if (matHave(m) < it.mats[m]) return townFail(matName(m) + "이(가) 부족해요" + (isBar(m) ? " (용광로에서 재련)" : ""));
  if (P.money < it.cost) return townFail("돈이 부족해요 (" + won(it.cost) + ")");
  for (const m in it.mats) matTake(m, it.mats[m]);
  P.money -= it.cost;
  P.items[id] = true;
  if (it.lv) P.lv[id] = 1;
  equipNew(id);
  recalcStats();
  if (it.fx.fuel) P.fuel = maxFuel();
  if (S.acct) S.acct.stats.crafted = (S.acct.stats.crafted || 0) + 1;
  say(it.name + " 제작 완료!"); sfx("buy");
  saveNow(true);
}
export function stashValue() {
  let v = 0;
  for (const id in P.stash) v += TILE[id].value * P.stash[id];
  return Math.round(v * STAT.sell);
}
// 판매 목록: 원석 9종 + 주괴 5종
export const SELL_KEYS = [6, 2, 3, 8, 4, 9, 5, 10, 11, "cu", "fe", "ag", "au", "mi"];
export const SELL_ORES = 9;                                 // 앞 9개는 원석, 나머지는 주괴
// 판매 탭 분류: 0 원석 · 1 주괴 · 2 의뢰 (S.sellSel 이 SELL_KEYS 뒤로 넘어가면 의뢰 줄)
export const SELL_CAT_START = [0, SELL_ORES, SELL_KEYS.length];
export const sellCat = () => (S.sellSel >= SELL_KEYS.length ? 2 : S.sellSel >= SELL_ORES ? 1 : 0);
export const unitPrice = (k) => Math.round((BARS[k] ? barValue(k) : TILE[k].value) * STAT.sell);
export function sellItem(k, n) {
  if (!BARS[k]) return sellOre(k, n);
  const have = P.bars[k] || 0, c = Math.min(have, n);
  if (c <= 0) return townFail("판매할 " + BARS[k].name + "이(가) 없어요");
  const gain = unitPrice(k) * c;
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.bars[k] = have - c; if (P.bars[k] <= 0) delete P.bars[k];
  say(BARS[k].name + " " + c + "개 판매 +" + won(gain)); sfx("sell");
  saveNow(true, true);
}
// 선택한 광물만 판매 (n: 개수, Infinity = 전부)
export function sellOre(id, n) {
  const have = P.stash[id] || 0, k = Math.min(have, n);
  if (k <= 0) return townFail("판매할 " + TILE[id].name + "이(가) 없어요");
  const gain = Math.round(TILE[id].value * k * STAT.sell);
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.stash[id] = have - k;
  if (P.stash[id] <= 0) delete P.stash[id];
  say(TILE[id].name + " " + k + "개 판매 +" + won(gain)); sfx("sell");
  saveNow(true, true);
}
export function sellStash() {
  const gain = stashValue();
  if (gain <= 0) return townFail("판매할 광물이 없어요");
  P.money += gain;
  if (S.acct) S.acct.stats.earned += gain;
  P.stash = {};
  say("창고 광물 판매 +" + won(gain)); sfx("sell");
  saveNow(true);
}
// 레벨 장비(특수) 레벨 올리기: 가진 장비를 또 사면 Lv +1 (최대 LV_MAX), Lv.100 이면 같은 줄의 다음 장비가 열림
export function levelUp(id) {
  const it = ITEMS[id], lv = itemLv(id);
  if (lv >= LV_MAX) return townFail(it.name + " 은(는) 최대 레벨이에요");
  const c = lvCost(id, lv);
  if (P.money < c) return townFail("돈이 부족합니다 (" + won(c) + " 필요)");
  P.money -= c;
  P.lv[id] = lv + 1;
  recalcStats();
  const nx = CATS.find((cat) => cat.ids.includes(id)).ids.find((k) => ITEMS[k].req === id);
  if (P.lv[id] >= LV_MAX && nx) { say(it.name + " Lv." + LV_MAX + "! 다음 장비 " + ITEMS[nx].name + " 이(가) 열렸어요"); sfx("levelup"); }
  else { say(it.name + " Lv." + P.lv[id]); sfx("buy"); }
  saveNow(true, true);
}
export function buyItem(id) {
  const it = ITEMS[id];
  if (!it) return;
  if (it.cons) {
    if (P.money < it.cost) return townFail("돈이 부족합니다 (" + won(it.cost) + " 필요)");
    if ((P.inv[id] || 0) >= 99) return townFail("더 들 수 없어요 (최대 99개)");
    P.money -= it.cost;
    P.inv[id] = (P.inv[id] || 0) + 1;
    say(it.name + " 구매! (보유 " + P.inv[id] + "개)"); sfx("buy");
    (S.shopFly = S.shopFly || []).push({ id, t: performance.now() });   // 상점 '내 가방'으로 날아 들어가는 그림 (townUI.ts)
    saveNow(true, true);
    return;
  }
  if (it.lv && P.items[id]) return levelUp(id);     // 레벨 장비: 또 사면 레벨 업
  if (P.items[id]) {                                // 가진 장비: 장착 (상점 버튼 '장착')
    if (worn(id)) return townFail("이미 장착 중이에요");
    const err = equipToggle(id);
    if (err) return townFail(err);
    say(it.name + " 장착!"); sfx("click");
    saveNow(true, true);
    return;
  }
  if (!reqMet(id)) return townFail(it.req === "robot" ? "먼저 차고에서 로봇을 사야 해요" : ITEMS[it.req].lv ? ITEMS[it.req].name + " 을(를) Lv." + LV_MAX + " 까지 올려야 열려요" : "먼저 " + ITEMS[it.req].name + " 구매 필요");
  if (P.money < it.cost) return townFail("돈이 부족합니다 (" + won(it.cost) + " 필요)");
  P.money -= it.cost;
  P.items[id] = true;
  if (it.lv) P.lv[id] = 1;
  equipNew(id);
  recalcStats();
  if (it.fx.fuel) P.fuel = maxFuel();               // 연료통을 사면 가득 채움
  say(it.name + " 장착!"); sfx("buy");
  saveNow(true);
}

// ---------------------------------------------------------------------
//  의뢰 (판매 탭의 세 번째 분류): 광물·주괴 N개를 가져오면 판매가의 1.6배 + 경험치
//   늘 3개. 캐 본 적 있는 광물(주괴는 그 원석)만 나옴. 끝내면 그 자리에 새 의뢰. '새 의뢰 받기'로 셋 다 바꿈($)
// ---------------------------------------------------------------------
export const ORDER_N = 3, ORDER_BONUS = 1.6;
S.orderFlash = null;
export const orderRerollCost = () => Math.round((400 + Math.min(2000, (S.acct ? S.acct.stats.maxDepth : 0)) * 6) * STAT.sell);   // 10배 + 골드 획득량 (벌이에 맞춰)
function orderPool() {
  const ores = SELL_KEYS.slice(0, SELL_ORES).filter((id) => minedOf(id) > 0);
  const bars = SELL_KEYS.slice(SELL_ORES).filter((k) => minedOf(BARS[k].ore) > 0 && S.acct && (S.acct.stats.smelted || 0) > 0);
  return ores.length ? ores.concat(bars) : [6, 2];                    // 처음엔 석탄·구리
}
export function makeOrder(avoid = []) {
  const pool = orderPool().filter((k) => !avoid.includes(k));
  const list = pool.length ? pool : orderPool();
  const k = list[Math.floor(Math.random() * list.length)];
  const unit = BARS[k] ? barValue(k) : TILE[k].value;
  const V = 1000 + Math.min(2400, S.acct ? S.acct.stats.maxDepth : 0) * 20;   // 의뢰 하나의 크기(판매가 기준): 깊이 들어갈수록 큼
  const n = Math.max(2, Math.min(30, Math.round(V / unit * (0.7 + Math.random() * 0.6))));
  const pay = Math.round(n * unit * ORDER_BONUS / 5) * 5;
  return { k, n, pay, xp: Math.max(5, Math.round(pay * 0.006)) };   // 값이 10배가 돼서 경험치 비율은 1/10
}
// 의뢰 보상도 골드 획득량(판매가 배율)을 받음 — 저장은 기본값, 보여 줄 때·받을 때 곱함
export const orderPay = (o) => Math.round(o.pay * STAT.sell);
export function ensureOrders() {
  if (!S.acct) return;
  if (!Array.isArray(S.acct.orders)) S.acct.orders = [];
  while (S.acct.orders.length < ORDER_N) S.acct.orders.push(makeOrder(S.acct.orders.map((o) => o.k)));
}
export function deliverOrder(i) {
  ensureOrders();
  const o = S.acct.orders[i];
  if (!o) return;
  if (matHave(o.k) < o.n) return townFail(matName(o.k) + "이(가) " + (o.n - matHave(o.k)) + "개 모자라요");
  matTake(o.k, o.n);
  const got = orderPay(o);
  P.money += got;
  S.acct.stats.earned += got;
  S.acct.stats.orders = (S.acct.stats.orders || 0) + 1;
  addXP(o.xp);
  S.acct.orders[i] = makeOrder(S.acct.orders.map((x) => x.k));
  S.orderFlash = { k: i, t: 0.6 };                                  // 그 줄이 잠깐 초록으로 반짝이고 새 의뢰가 들어옴
  say("의뢰 완료! +" + won(got) + " · 경험치 +" + o.xp); sfx("sell"); sfx("levelup", { pitch: 1.5, vol: 0.35 });
  checkQuests();
  saveNow(true, true);
}
export function rerollOrders() {
  const c = orderRerollCost();
  if (P.money < c) return townFail("돈이 부족해요 (" + won(c) + ")");
  P.money -= c;
  S.acct.orders = [];
  ensureOrders();
  say("새 의뢰를 받았어요 (-" + won(c) + ")"); sfx("buy");
  saveNow(true, true);
}
