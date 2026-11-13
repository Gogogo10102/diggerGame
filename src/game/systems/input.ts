// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../core/stats.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { SHOP_PER, cycleZoom, say } from "../core/stats.ts";
import { HOT } from "../data/consumables.ts";
import { CATS } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { saveNow } from "../save/account.ts";
import { BAR_KEYS, furnaceAct, openFurnace } from "./furnace.ts";
import { SELL_COLS, SELL_KEYS, buyItem, craftItem, openCraft, sellItem, sellStash } from "./town.ts";
import { useConsumable } from "./update.ts";
import { openQuests } from "../ui/dom.ts";
import { closeMenu, openInventory, openMenu } from "../ui/menu.ts";
import { hideOv, openAccountScreen } from "../ui/overlay.ts";
import { mapKey, mapPointerDown, mapPointerMove, mapPointerUp, mapZoom, openMap } from "../render/minimap.ts";

// =====================================================================
//  입력
// =====================================================================
export const keys = {};
addEventListener("keydown", (e) => {
  if (S.state === "account") return;                  // 계정 화면: 입력칸에 타이핑
  if (S.state === "menu") { if ((e.code === "Escape" || (e.code === "KeyI" && S.invOpen)) && !e.repeat) closeMenu(); return; }
  if (S.state === "map") { if (/^Arrow|Space/.test(e.code)) e.preventDefault(); mapKey(e); return; }   // 큰 지도
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (S.state === "title") { openAccountScreen(); return; }
  if ((S.state === "shop" || S.state === "craft" || S.state === "furnace") && townKey(e)) return;
  if (S.state === "furnace") {                          // 용광로 창 조작: ↑↓ 고르기 · 1/5/Enter 넣기 · U 강화 · Backspace 비우기
    const len = BAR_KEYS.length;
    if (e.code === "Escape" || e.code === "KeyE") { if (!e.repeat) closeShop(); return; }
    if (e.repeat && !/^Arrow|^Key[WS]$/.test(e.code)) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") S.furnaceSel = (S.furnaceSel + len - 1) % len;
    else if (e.code === "ArrowDown" || e.code === "KeyS") S.furnaceSel = (S.furnaceSel + 1) % len;
    else if (e.code === "Digit1") furnaceAct("smelt", 1);
    else if (e.code === "Digit5") furnaceAct("smelt", 5);
    else if (e.code === "Enter" || e.code === "Space") furnaceAct("smelt", Infinity);
    else if (e.code === "KeyU") furnaceAct("up");
    else if (e.code === "Backspace" || e.code === "Delete") furnaceAct("clear");
    return;
  }
  if (S.state === "shop") {                             // 상점 메뉴 조작
    const n = CATS.length, len = CATS[S.shopTab].ids.length;
    if (e.code === "Escape" || e.code === "KeyE") { if (!e.repeat) closeShop(); return; }
    if (e.repeat && (e.code === "Enter" || e.code === "Space")) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") { S.shopTab = (S.shopTab + n - 1) % n; S.shopSel = 0; }
    else if (e.code === "ArrowRight" || e.code === "KeyD") { S.shopTab = (S.shopTab + 1) % n; S.shopSel = 0; }
    else if (e.code === "ArrowUp" || e.code === "KeyW") S.shopSel = (S.shopSel + len - 1) % len;
    else if (e.code === "ArrowDown" || e.code === "KeyS") S.shopSel = (S.shopSel + 1) % len;
    else if (e.code === "PageDown") S.shopSel = Math.min(len - 1, (Math.floor(S.shopSel / SHOP_PER) + 1) * SHOP_PER);
    else if (e.code === "PageUp") S.shopSel = Math.max(0, (Math.floor(S.shopSel / SHOP_PER) - 1) * SHOP_PER);
    else if (e.code === "Enter" || e.code === "Space") buyItem(CATS[S.shopTab].ids[S.shopSel]);
    else if (/^Digit[1-4]$/.test(e.code)) {
      const idx = Math.floor(S.shopSel / SHOP_PER) * SHOP_PER + Number(e.code.slice(5)) - 1;
      if (idx < len) { S.shopSel = idx; buyItem(CATS[S.shopTab].ids[idx]); }
    }
    return;
  }
  if (S.state === "craft") {                            // 제작소 메뉴 조작
    const n = RECIPE_CATS.length + 1;
    const onSell = S.craftTab === RECIPE_CATS.length;
    const setTab = (t) => { S.craftTab = (t + n) % n; S.craftSel = 0; };
    if (e.code === "Escape" || e.code === "KeyE") { if (!e.repeat) closeShop(); return; }
    if (e.repeat && (e.code === "Enter" || e.code === "Space")) return;
    if (e.code === "Tab") { e.preventDefault(); setTab(S.craftTab + (e.shiftKey ? -1 : 1)); return; }
    if (e.code === "PageUp") { setTab(S.craftTab - 1); return; }
    if (e.code === "PageDown") { setTab(S.craftTab + 1); return; }
    if (/^Digit[1-9]$/.test(e.code)) { const t = Number(e.code.slice(5)) - 1; if (t < n) setTab(t); return; }
    if (onSell) {
      const cols = SELL_COLS, len = SELL_KEYS.length;
      if (e.code === "ArrowLeft" || e.code === "KeyA") S.sellSel = Math.max(0, S.sellSel - 1);
      else if (e.code === "ArrowRight" || e.code === "KeyD") S.sellSel = Math.min(len - 1, S.sellSel + 1);
      else if (e.code === "ArrowUp" || e.code === "KeyW") S.sellSel = Math.max(0, S.sellSel - cols);
      else if (e.code === "ArrowDown" || e.code === "KeyS") S.sellSel = Math.min(len - 1, S.sellSel + cols);
      else if (e.code === "Enter") sellItem(SELL_KEYS[S.sellSel], Infinity);
      else if (e.code === "Space") sellItem(SELL_KEYS[S.sellSel], 1);
      else if (e.code === "KeyF") sellStash();
      return;
    }
    const cat = RECIPE_CATS[S.craftTab], cur = cat.nodes[S.craftSel];
    const go = (n2) => { if (n2) S.craftSel = n2.i; };
    if (e.code === "ArrowLeft" || e.code === "KeyA") go(cur.req ? cat.nodes.find((q) => q.id === cur.req) : null);
    else if (e.code === "ArrowRight" || e.code === "KeyD") go(cat.nodes.filter((q) => q.req === cur.id).sort((p1, p2) => p1.row - p2.row)[0]);
    else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "ArrowDown" || e.code === "KeyS") {
      const dirn = (e.code === "ArrowUp" || e.code === "KeyW") ? -1 : 1;
      const col = cat.nodes.filter((q) => q.col === cur.col).sort((p1, p2) => p1.row - p2.row);
      const k = col.indexOf(cur) + dirn;
      go(col[(k + col.length) % col.length]);
    }
    else if (e.code === "Enter" || e.code === "Space") craftItem(cat.ids[S.craftSel]);
    return;
  }
  if (e.code === "Escape") { if (!e.repeat) openMenu(); return; }
  if (e.code === "KeyI") { if (!e.repeat) openInventory(); return; }
  if (e.code === "KeyQ") { if (!e.repeat) openQuests(); return; }
  if (e.code === "KeyM") { if (!e.repeat) openMap(); return; }
  keys[e.code] = true;
  if (e.code === "KeyH") { S.showHelp = !S.showHelp; S.helpPinned = S.showHelp; }
  if (e.code === "KeyE" && !e.repeat && P.dead <= 0) { if (S.nearItems) openShop(); else if (S.nearCraft) openCraft(); else if (S.nearFurnace) openFurnace(); }
  if (/^Digit[1-8]$/.test(e.code) && !e.repeat) useConsumable(HOT[Number(e.code.slice(5)) - 1]);
  if (e.code === "KeyZ" && !e.repeat) cycleZoom();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

// ---- 터치 / 포인터: 화면 어디서나 쓰는 플로팅 조이스틱 ----
// 터치한 자리에 스틱이 생기고, 드래그 방향으로 조작합니다.
//   ←→ 이동 / ↑ 추진 / ↓ 아래 파기 / 벽 쪽으로 밀면 옆 파기
export const touch = { l: false, r: false, u: false, d: false };
export const SENS_MUL = [1.35, 1, 0.75], SENS_NAME = ["낮음", "보통", "높음"];
S.sensIdx = 1;               // 터치 감도 (메뉴에서 변경, 기기에 저장)
export const STICK_R = 56;            // 스틱 반경(px)
S.stick = null;              // {id, ox, oy, x, y}
S.usedTouch = false;
try { S.usedTouch = matchMedia("(pointer: coarse)").matches; } catch (e) {}
S.hotBtns = []; S.hotLeft = 1e9;
export const shopBtn: any[] = []; S.promptBtn = null; S.shopRect = { x: 0, y: 0, w: 0, h: 0 }; S.menuBtn = null; S.bagBtn = null; S.questBtn = null; S.invOpen = false; S.helpPinned = false;            // 상점 버튼 영역 (draw에서 채움)
export const stage = document.getElementById("c");

export function updateStick() {
  let dx = S.stick.x - S.stick.ox, dy = S.stick.y - S.stick.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > STICK_R) {        // 손가락이 반경을 넘으면 스틱이 따라옴
    const k = (dist - STICK_R) / dist;
    S.stick.ox += dx * k; S.stick.oy += dy * k;
    dx = S.stick.x - S.stick.ox; dy = S.stick.y - S.stick.oy;
  }
  // 방향 판정 - 옆으로 파다가 손이 살짝 올라가도 추진이 켜지지 않게, 위/아래는 '확실히' 밀었을 때만 켬.
  const m = SENS_MUL[S.sensIdx];                    // 감도: 낮음 1.35 / 보통 1 / 높음 0.75 (클수록 둔함)
  const ax = Math.abs(dx), ay = Math.abs(dy);
  // 위(추진): 위쪽 성분이 충분히 크고 좌우보다 우세해야 켜짐. 한 번 켜지면 조금 덜 밀어도 유지(깜빡임 방지).
  const up = touch.u ? (dy < -22 * m && -dy > ax * 0.6) : (dy < -38 * m && -dy > ax);
  const down = touch.d ? (dy > 16 * m && dy > ax * 0.5) : (dy > 28 * m && dy > ax * 0.9);
  // 거의 수직으로 밀 때는 좌우로 새지 않게 막음
  const vertical = (up || down) && ax < ay * 0.6;
  const onH = (cur) => (cur ? ax > 8 * m : ax > 16 * m);
  touch.u = up; touch.d = down;
  touch.l = !vertical && dx < 0 && onH(touch.l);
  touch.r = !vertical && dx > 0 && onH(touch.r);
}
export function endStick(e) {
  if (S.stick && e.pointerId === S.stick.id) {
    S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
  }
}
stage.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (e.pointerType === "touch" || e.pointerType === "pen") S.usedTouch = true;
  if (S.state === "title") { openAccountScreen(); return; }
  if (S.state === "account" || S.state === "menu") return;
  const x = e.clientX, y = e.clientY;
  const hit = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (S.state === "map") { mapPointerDown(x, y, e.pointerId); return; }
  if (S.state === "craft") {                           // 제작소 메뉴: 탭 처리
    for (const b of shopBtn) {
      if (!hit(b)) continue;
      if (b.act === "town") switchTown(b.arg);
      else if (b.act === "tab") { S.craftTab = b.arg; S.craftSel = 0; }
      else if (b.act === "node") S.craftSel = b.i;
      else if (b.act === "sellsel") S.sellSel = b.i;
      else if (b.act === "sell") sellItem(b.arg[0], b.arg[1]);
      else if (b.act === "craft") craftItem(b.arg);
      else if (b.act === "sellall") sellStash();
      else if (b.act === "close") closeShop();
      return;
    }
    if (!hit(S.shopRect)) closeShop();                 // 패널 바깥을 탭하면 닫기
    return;
  }
  if (S.state === "furnace") {                         // 용광로 창: 탭 처리
    for (const b of shopBtn) {
      if (!hit(b)) continue;
      if (b.act === "town") switchTown(b.arg);
      else if (b.act === "fsel") S.furnaceSel = b.i;
      else if (b.act === "smelt") furnaceAct("smelt", b.arg);
      else if (b.act === "fup") furnaceAct("up");
      else if (b.act === "fclear") furnaceAct("clear");
      else if (b.act === "close") closeShop();
      return;
    }
    if (!hit(S.shopRect)) closeShop();
    return;
  }
  if (S.state === "shop") {                            // 상점 메뉴: 탭 처리
    for (const b of shopBtn) {
      if (!hit(b)) continue;
      if (b.act === "town") switchTown(b.arg);
      else if (b.act === "tab") { S.shopTab = b.arg; S.shopSel = 0; }
      else if (b.act === "sel") S.shopSel = b.i;              // 줄을 누르면 고르기, 아래 [구매] 버튼으로 사기
      else if (b.act === "buy") buyItem(b.arg);
      else if (b.act === "page") {
        const np = Math.max(0, Math.min(Math.ceil(CATS[S.shopTab].ids.length / SHOP_PER) - 1, Math.floor(S.shopSel / SHOP_PER) + b.arg));
        S.shopSel = np * SHOP_PER;
      }
      else if (b.act === "close") closeShop();
      return;
    }
    if (!hit(S.shopRect)) closeShop();                 // 패널 바깥을 탭하면 닫기
    return;
  }
  if (S.promptBtn && P.dead <= 0 && hit(S.promptBtn)) { if (S.nearItems) openShop(); else if (S.nearCraft) openCraft(); else if (S.nearFurnace) openFurnace(); else switchTown("sell"); return; }   // 상점/제작소 열기 버튼
  if (S.menuBtn && hit(S.menuBtn)) { openMenu(); return; }
  if (S.bagBtn && hit(S.bagBtn)) { openInventory(); return; }
  if (S.questBtn && hit(S.questBtn)) { openQuests(); return; }                      // 메뉴 버튼
  if (S.miniBtn && hit(S.miniBtn)) { openMap(); return; }                            // 미니맵 → 큰 지도
  for (const b of S.hotBtns) if (hit(b)) { if (P.dead <= 0) useConsumable(b.id); return; }   // 소모품 슬롯
  if (S.stick) return;
  S.stick = { id: e.pointerId, ox: x, oy: y, x, y };
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  updateStick();
});
stage.addEventListener("pointermove", (e) => {
  if (S.state === "map") { mapPointerMove(e.clientX, e.clientY, e.pointerId); return; }
  if (!S.stick || e.pointerId !== S.stick.id) return;
  S.stick.x = e.clientX; S.stick.y = e.clientY;
  updateStick();
});
stage.addEventListener("pointerup", (e) => { mapPointerUp(e.pointerId); endStick(e); });
stage.addEventListener("pointercancel", (e) => { mapPointerUp(e.pointerId); endStick(e); });
stage.addEventListener("wheel", (e) => { if (S.state === "map") { e.preventDefault(); mapZoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
addEventListener("contextmenu", (e) => e.preventDefault());

export const L_ = () => keys.ArrowLeft || keys.KeyA || touch.l;
export const R_ = () => keys.ArrowRight || keys.KeyD || touch.r;
export const U_ = () => keys.ArrowUp || keys.KeyW || keys.Space || touch.u;
export const D_ = () => keys.ArrowDown || keys.KeyS || touch.d;

// 마을 창: 상점·제작소·용광로 + 판매(창고)를 위쪽 탭으로 오가며 사용. 어느 건물 앞에서 [E]로 열어도 됨
export const TOWN = [["shop", "상점", "chest"], ["craft", "제작", "drill"], ["furnace", "용광로", "furnace"], ["sell", "판매", "coin"]];
export function stashCargo() {
  let moved = 0;
  for (const id in P.cargo) { P.stash[id] = (P.stash[id] || 0) + P.cargo[id]; moved += P.cargo[id]; }
  P.cargo = {};
  if (moved > 0) { say("화물 광물 " + moved + "개를 창고에 보관했어요"); saveNow(true); }
  return moved;
}
export function townActive() {
  if (S.state === "shop") return "shop";
  if (S.state === "craft") return S.craftTab === RECIPE_CATS.length ? "sell" : "craft";
  if (S.state === "furnace") return "furnace";
  return null;
}
export function switchTown(k) {
  if (S.state === "menu") hideOv();
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
  if (k === "shop") { S.state = "shop"; S.shopSel = 0; }
  else if (k === "craft") { stashCargo(); S.state = "craft"; if (S.craftTab >= RECIPE_CATS.length) S.craftTab = 0; S.craftSel = 0; }
  else if (k === "sell") { stashCargo(); S.state = "craft"; S.craftTab = RECIPE_CATS.length; }
  else if (k === "furnace") openFurnace();
}
export function townKey(e) {                                       // [ / ] 로 마을 창 탭 이동
  if (e.code !== "BracketLeft" && e.code !== "BracketRight") return false;
  if (e.repeat) return true;
  const i = TOWN.findIndex((t) => t[0] === townActive()), d = e.code === "BracketLeft" ? -1 : 1;
  switchTown(TOWN[(i + d + TOWN.length) % TOWN.length][0]);
  return true;
}
export function openShop() {
  S.state = "shop"; S.shopSel = 0;
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;   // 조이스틱 해제
}
export function closeShop() { S.state = "play"; }
