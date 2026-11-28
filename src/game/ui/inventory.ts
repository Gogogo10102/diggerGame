// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./dom.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { CRAFT_ICON, itemIcon } from "../art/itemIcons.ts";
import { ICON, getMiner, oreIcon } from "../art/sprites.ts";
import { LAYERS, ORE_ORDER, TILE, cnum, won } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { EQUIP_FIXED, FUEL_DIG, FUEL_IDLE, FUEL_THRUST, SLOT_BASE, STAT, cargoRoom, cargoSlots, cargoStack, cargoUsed, equipSlot, equipToggle, maxFuel, maxHp, slotItem, worn } from "../core/stats.ts";
import { fxNum, fxText } from "../art/buildings.ts";
import { saveNow } from "../save/account.ts";
import { CONS, HOT, visR } from "../data/consumables.ts";
import { CATS, ITEMS, catOpen, itemLv } from "../data/items.ts";
import { MAX_LV, levelOf, titleName } from "../data/progress.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { LS_PREFIX } from "../save/config.ts";
import { TIER_COL } from "../systems/cave.ts";
import { discardOre } from "../systems/drops.ts";
import { BARS, BAR_KEYS, barIcon } from "../systems/furnace.ts";
import { useConsumable } from "../systems/update.ts";
import { unitPrice } from "../systems/town.ts";
import { cargoCells } from "../render/draw.ts";
import { MINER_CAP_H, MINER_MAX, layerOres, minerCollect, minerCost, minerOpen, minerPending, minerRate, minerUp, sellOre, sellStash, stashValue } from "../systems/town.ts";
import { switchTown, touch } from "../systems/input.ts";
import { sfx } from "../core/sound.ts";
import { hideOv } from "./overlay.ts";
import { barEl, charFooter, charTabs, iconEl } from "./dom.ts";
import { closeMenu } from "./menu.ts";
import { el, mkBtn, showOv } from "./overlay.ts";

// 장비 칸 능력치 짧은 이름 (칸 아래 작은 글씨)
const FX_NAME_INV = { pick: "곡괭이 채굴력", drill: "톱니 채굴력", fuel: "최대 연료", cargo: "화물칸", thrust: "로봇 추진력", speed: "로봇 이동 속도", light: "시야", rocket: "로켓 추진력" };
const FX_SHORT = (k) => ({ pick: "채굴력", drill: "채굴력", fuel: "연료", cargo: "화물칸", thrust: "추진력", speed: "속도", light: "시야", rocket: "추진력" }[k] || "");
// ---- 인벤토리 (2026-11-28 다시 만듦): PC = A(왼쪽 캐릭터 + 장비 칸 · 오른쪽 큰 칸 + 단축 9칸) / 휴대폰 세로 = D(장비 한 줄 · 5열 칸 · 아래 탭) ----
//  칸 하나 = 마인크래프트처럼 아이콘 + 오른쪽 아래 개수. 창고·화물·주괴는 위(휴대폰은 아래) 탭으로
S.invTab = "cargo"; S.invSel = null;
// 칸 만들기: spr 그림 · n 개수(없으면 빈칸) · on 고름 · click
function cellEl(spr, n, opt) {
  const o = opt || {}, c = el("div", "cell" + (spr ? "" : " e") + (o.sel ? " sel" : "") + (o.full ? " full" : "") + (o.cls ? " " + o.cls : ""));
  if (spr) c.appendChild(iconEl(spr, 32));
  if (o.key) c.appendChild(el("span", "k", o.key));
  if (n != null && spr) c.appendChild(el("span", "n", typeof n === "number" ? cnum(n) : n));
  if (o.label) c.appendChild(el("span", "lb", o.label));
  if (o.title) c.title = o.title;
  if (o.click) c.addEventListener("click", o.click);
  return c;
}
// 칸 목록: 창고(원석) · 화물(칸마다 쌓기) · 주괴
export function invCells(tab) {
  if (tab === "cargo") return cargoCells().map((c) => ({ kind: "ore", id: c.id, n: c.n, full: c.n >= cargoStack() }));
  if (tab === "bars") return BAR_KEYS.filter((k) => P.bars[k] > 0).map((k) => ({ kind: "bar", id: k, n: P.bars[k] }));
  return ORE_ORDER.filter((id) => P.stash[id] > 0).map((id) => ({ kind: "ore", id, n: P.stash[id] }));
}
const cellSpr = (c) => (c.kind === "bar" ? barIcon[c.id] : oreIcon[c.id]);
const cellName = (c) => (c.kind === "bar" ? BARS[c.id].name : TILE[c.id].name);
export function renderInventory(note) {
  S.invOpen = true;
  const root = el("div", "inv");
  root.appendChild(charTabs("inv"));
  if (note) root.appendChild(el("p", "msg", note));
  const L = levelOf(S.acct.xp);
  const wrap = el("div", "ia");
  // ---- 왼쪽: 캐릭터 + 장비 칸 ----
  const left = el("div", "ia-box");
  const hd = el("div", "ia-hd"); hd.appendChild(el("b", null, S.acct.name)); hd.appendChild(el("span", null, "Lv." + L.lv + (titleName() ? " 「" + titleName() + "」" : "")));
  left.appendChild(hd);
  left.appendChild(barEl(L.lv >= MAX_LV ? 1 : L.cur / L.need, "#ffd34d"));
  const pickCats = [];                                               // [키, 분류, 장비 칸?]
  const eqCell = (cat, key, tierWise) => {
    const owned = cat.ids.some((id) => P.items[id] && !EQUIP_FIXED[id]);
    let id = null;
    if (tierWise) id = slotItem(cat);
    else if (cat.craft || RECIPE_CATS.includes(cat)) { for (const x of cat.ids) if (worn(x) && (!id || CRAFT_ICON[x][1] >= CRAFT_ICON[id][1])) id = x; }
    else { const on = cat.ids.filter((x) => worn(x)); id = on.length ? on[on.length - 1] : null; }
    pickCats.push([key, cat, tierWise]);
    const name = RECIPE_CATS.includes(cat) ? "제작·" + cat.name : cat.name;
    return cellEl(id ? itemIcon(id) : ICON[cat.icon === "fuel" ? "fuel" : cat.icon] || ICON.chest, null, {
      cls: "eqs" + (id ? "" : " dim"), label: cat.name, sel: S.invPick === key, title: name + (id ? " · " + ITEMS[id].name : " · 비어 있음"),
      click: owned ? () => { S.invPick = S.invPick === key ? null : key; renderInventory(); } : null });
  };
  const slotCats = CATS.filter((c) => c.slot && !c.cons && catOpen(c.icon));
  const half = Math.ceil(slotCats.length / 2);
  const eq = el("div", "ia-eq"), cl = el("div", "ia-col"), cr = el("div", "ia-col"), por = el("div", "ia-por");
  slotCats.forEach((c, k) => (k < half ? cl : cr).appendChild(eqCell(c, "c:" + c.icon, true)));
  por.appendChild(iconEl(getMiner("side", 0, -1), 96));
  eq.appendChild(cl); eq.appendChild(por); eq.appendChild(cr);
  left.appendChild(eq);
  const ext = el("div", "ia-ext");                                   // 특수 · 제작 장비 (끼고 빼는 것)
  let extN = 0;
  for (const c of CATS) if (!c.slot && !c.cons && catOpen(c.icon) && c.ids.some((id) => P.items[id] && !EQUIP_FIXED[id])) { ext.appendChild(eqCell(c, "c:" + c.icon, false)); extN++; }
  for (const c of RECIPE_CATS) if ((!c.robot || P.items.robot) && c.ids.some((id) => P.items[id])) { ext.appendChild(eqCell(c, "r:" + c.name, false)); extN++; }
  if (extN) left.appendChild(ext);
  left.appendChild(el("div", "dim sm", "체력 " + Math.ceil(P.hp) + "/" + maxHp() + " · 연료 " + Math.ceil(P.fuel) + "/" + maxFuel()));
  left.appendChild(el("div", "dim sm", won(P.money)));
  wrap.appendChild(left);
  // ---- 오른쪽: 탭 + 큰 칸 + 고른 칸 설명 + 단축 9칸 ----
  const right = el("div", "ia-box ia-r");
  const tabs = el("div", "ia-tabs");
  for (const [k, label] of [["cargo", "화물 " + cargoUsed() + "/" + cargoSlots() + "칸"], ["stash", "창고"], ["bars", "주괴"]]) {
    tabs.appendChild(mkBtn(label, () => { S.invTab = k; S.invSel = null; renderInventory(); }, "tab" + (S.invTab === k ? " on" : "")));
  }
  right.appendChild(tabs);
  const cells = invCells(S.invTab), grid = el("div", "ia-grid");
  const minCells = S.invTab === "cargo" ? cargoSlots() : Math.max(27, Math.ceil(cells.length / 9) * 9);
  for (let k = 0; k < Math.max(minCells, cells.length); k++) {
    const c = cells[k];
    grid.appendChild(c ? cellEl(cellSpr(c), c.n, { full: c.full, sel: S.invSel === k, title: cellName(c), click: () => { S.invSel = S.invSel === k ? null : k; renderInventory(); } }) : cellEl(null));
  }
  right.appendChild(grid);
  const det = el("div", "ia-det"), sc = S.invSel != null ? cells[S.invSel] : null;
  if (sc) {
    det.appendChild(iconEl(cellSpr(sc), 32));
    const tot = sc.kind === "bar" ? sc.n : S.invTab === "cargo" ? P.cargo[sc.id] : P.stash[sc.id];
    det.appendChild(el("b", null, cellName(sc)));
    det.appendChild(el("span", null, tot.toLocaleString("ko-KR") + "개 · 개당 " + won(sc.kind === "bar" ? unitPrice(sc.id) : TILE[sc.id].value * STAT.sell)));
    if (S.invTab === "cargo") {
      const drop = (n) => () => { const k = discardOre(sc.id, n); S.invSel = null; renderInventory(k > 0 ? TILE[sc.id].name + " " + cnum(k) + "개를 버렸어요. 60초 안에 다시 주울 수 있어요" : null); };
      det.appendChild(mkBtn("한 칸 버리기", drop(sc.n), "del"));
    } else det.appendChild(el("span", "dim", "마을 가게 → 창고에서 팔거나 제작에 써요"));
  } else det.appendChild(el("span", "dim", cells.length ? "칸을 누르면 설명" : S.invTab === "cargo" ? "화물이 비어 있어요 · 캐면 여기 칸에 쌓여요" : "비어 있어요"));
  right.appendChild(det);
  right.appendChild(el("div", "ia-hd", "단축 칸 (1~9 키)"));
  const hot = el("div", "ia-hot");
  HOT.forEach((id, k) => {
    const n = P.inv[id] || 0;
    const c = cellEl(ICON[id], n, { key: String(k + 1), title: CONS[id].name, cls: n > 0 ? "" : "dim", click: n > 0 ? () => { closeMenu(); useConsumable(id); } : null });
    if (!n) c.style.opacity = ".45";
    hot.appendChild(c);
  });
  right.appendChild(hot);
  wrap.appendChild(right);
  root.appendChild(wrap);
  // 고르기 칸: 단계 분류는 단계 하나를(아래 단계까지 함께 낌), 그 밖은 하나씩 끼고 뺌
  const pc = pickCats.find((x) => x[0] === S.invPick);
  let pickHead = null;
  if (pc) {
    const [, cat, tierWise] = pc;
    const after = (msg, ok) => { if (!msg) saveNow(true, true); renderInventory(msg || ok); };
    pickHead = root.appendChild(el("p", "msg", (cat.name) + " 고르기" + (tierWise ? " · 한 칸에 하나만 껴요 (숫자 = 그 장비의 값)" : " · 하나씩 끼고 뺄 수 있어요")));
    const pg = el("div", "slots");
    const card = (iconSpr, name, fx, btn) => {
      const s = el("div", "slot");
      s.appendChild(iconEl(iconSpr, 36));
      s.appendChild(el("div", "nm2", name));
      s.appendChild(el("div", "dim sm", fx));
      const row = el("div", "minis"); row.appendChild(btn); s.appendChild(row);
      pg.appendChild(s);
    };
    if (tierWise) {                                                  // 장비 칸: 하나만 고름 (각 장비의 고유 값)
      const cur = slotItem(cat), k = cat.slot;
      const base = { pick: "기본 곡괭이", rocket: "안 씀 (못 날아요)" }[cat.icon] || "기본";
      card(ICON[cat.icon === "fuel" ? "fuel" : cat.icon] || ICON.chest, base, k === "rocket" ? "날 수 없음" : FX_NAME_INV[k] + " " + fxNum(k, SLOT_BASE[k]),
        !cur ? mkBtn("장착 중", () => {}, "mini off") : mkBtn("장착", () => after(equipSlot(cat, null), base + "(으)로 바꿨어요"), "mini"));
      for (const id of cat.ids) {
        if (!P.items[id] || EQUIP_FIXED[id]) continue;
        card(itemIcon(id), ITEMS[id].name, fxText(ITEMS[id].fx, k),
          cur === id ? mkBtn("장착 중", () => {}, "mini off") : mkBtn("장착", () => after(equipSlot(cat, id), ITEMS[id].name + " 장착!"), "mini"));
      }
    } else {
      for (const id of cat.ids) {
        if (!P.items[id] || EQUIP_FIXED[id]) continue;
        const on = worn(id);
        if (ITEMS[id].lv) { card(itemIcon(id), ITEMS[id].name + " Lv." + itemLv(id), ITEMS[id].fx.sell ? "골드 획득량 증가" : ITEMS[id].fx.lucky ? "행운 증가" : "연비 개선", mkBtn("늘 켜짐", () => {}, "mini off")); continue; }   // 레벨 장비
        card(itemIcon(id), ITEMS[id].name, fxText(ITEMS[id].fx),
          on ? mkBtn("빼기", () => after(equipToggle(id), ITEMS[id].name + " 뺐어요"), "mini") : mkBtn("장착", () => after(equipToggle(id), ITEMS[id].name + " 장착!"), "mini"));
      }
    }
    root.appendChild(pg);
  }
  // 능력치
  root.appendChild(el("p", "msg", "능력치"));
  const burn0 = FUEL_IDLE * STAT.eff, burn1 = (FUEL_IDLE + FUEL_THRUST + FUEL_DIG) * STAT.eff;
  const tb = el("table");
  for (const r of [
    ["연료 지속(가만히 / 추진+채굴)", Math.floor(maxFuel() / burn0) + "초 / " + Math.floor(maxFuel() / burn1) + "초"],
    ["채굴 속도", "x" + STAT.drill.toFixed(2) + "  (레벨 보너스 +" + Math.round((S.MINER_LV - 1) * 1.2) + "%)"],
    ["연료 소모", "x" + STAT.eff.toFixed(2)],
    ["추진력 / 이동 속도", "x" + STAT.thrust.toFixed(2) + " / x" + STAT.speed.toFixed(2)],
    ["시야", visR().toFixed(1) + "칸"],
    ["판매가", "x" + STAT.sell.toFixed(2) + "  (레벨 보너스 +" + ((S.MINER_LV - 1) * 0.4).toFixed(1) + "%)"],
    ["행운", "+" + Math.round(STAT.lucky * 100) + "%"],
  ]) { const tr = el("tr"); tr.appendChild(el("td", null, r[0])); tr.appendChild(el("td", null, r[1])); tb.appendChild(tr); }
  root.appendChild(tb);
  charFooter(root);
  showOv(root);
  if (pickHead && pickHead.scrollIntoView) pickHead.scrollIntoView({ block: "start" });   // 고르기 칸이 아래에 있어 바로 보이게
}

// ---- 가게 창고 C (2026-11-28): 왼쪽 화물 칸 ↔ 가운데 버튼 ↔ 오른쪽 창고 칸. 화물은 [보관] 해야 창고로 (자동 보관 없음) ----
//  팔기는 화물에서 바로, 또는 창고에서. 휴대폰 세로는 위아래로 쌓임 (style.css .ic)
S.stoSel = null;                                                     // { side: "cargo" | "stash", id }
export function stashMove(id, n) {                                   // 화물 → 창고 (보관)
  const k = Math.min(P.cargo[id] || 0, n);
  if (k <= 0) return 0;
  P.cargo[id] -= k; if (P.cargo[id] <= 0) delete P.cargo[id];
  P.stash[id] = (P.stash[id] || 0) + k;
  return k;
}
export function stashTake(id, n) {                                   // 창고 → 화물 (꺼내기, 빈 칸만큼)
  const k = Math.min(P.stash[id] || 0, n, cargoRoom(id));
  if (k <= 0) return 0;
  P.stash[id] -= k; if (P.stash[id] <= 0) delete P.stash[id];
  P.cargo[id] = (P.cargo[id] || 0) + k;
  return k;
}
export function cargoSell(id, n) {                                   // 화물에서 바로 팔기 (창고를 거쳐 같은 값으로)
  const k = stashMove(id, n);
  if (k > 0) sellOre(id, k);
  return k;
}
export function openStorage() {
  if (!S.acct) return;
  S.state = "menu"; S.stoSel = null; keysResetTown();
  const n = Object.keys(P.miners).length ? minerCollect() : 0;     // 자동 채굴기에 쌓인 건 창고를 열 때 같이 받음
  if (n > 0) saveNow(true, true);
  renderStorage(n > 0 ? "자동 채굴기에서 " + cnum(n) + "개가 창고로 들어왔어요" : null);
}
function keysResetTown() { S.stick = null; touch.l = touch.r = touch.u = touch.d = false; }
export function renderStorage(note) {
  S.invOpen = false;
  const root = el("div", "inv");
  root.appendChild(el("h2", null, "창고"));
  root.appendChild(el("p", note ? "msg" : "dim", note || "화물은 [보관]을 눌러야 창고로 가요 · 화물에서 바로 팔거나, 창고에 모아 두고 팔아도 돼요"));
  const after = (msg) => { saveNow(true, true); renderStorage(msg); };
  const box = (title, sub, cls, cells, side, minN) => {
    const b = el("div", "ia-box"), hd = el("div", "ia-hd");
    hd.appendChild(el("b", null, title)); hd.appendChild(el("span", null, sub)); b.appendChild(hd);
    const g = el("div", "ia-grid " + cls);
    for (let k = 0; k < Math.max(minN, cells.length); k++) {
      const c = cells[k];
      const on = c && S.stoSel && S.stoSel.side === side && S.stoSel.id === c.id;
      g.appendChild(c ? cellEl(oreIcon[c.id], c.n, { full: c.full, sel: on, title: TILE[c.id].name, click: () => { S.stoSel = on ? null : { side, id: c.id }; renderStorage(); } }) : cellEl(null));
    }
    b.appendChild(g);
    return b;
  };
  const cc = invCells("cargo"), sc = invCells("stash");
  const wrap = el("div", "ic");
  wrap.appendChild(box("화물", cargoUsed() + "/" + cargoSlots() + "칸 · 칸당 " + cnum(cargoStack()), "cg", cc, "cargo", cargoSlots()));
  const mid = el("div", "ic-mid");
  const cargoVal = Object.keys(P.cargo).reduce((a, id) => a + TILE[id].value * P.cargo[id], 0) * STAT.sell;
  const stashVal = stashValue();
  mid.appendChild(mkBtn("모두 보관 →", () => { let n = 0; for (const id of Object.keys(P.cargo)) n += stashMove(id, Infinity); sfx("pickup"); after(n ? "화물 " + cnum(n) + "개를 창고에 보관했어요" : "화물이 비어 있어요"); }, cc.length ? "pri" : "off"));
  mid.appendChild(mkBtn("화물 모두 팔기 · " + won(cargoVal), () => { for (const id of Object.keys(P.cargo)) cargoSell(id, Infinity); after(); }, cc.length ? "" : "off"));
  mid.appendChild(mkBtn("창고 모두 팔기 · " + won(stashVal), () => { sellStash(); after(); }, sc.length ? "" : "off"));
  wrap.appendChild(mid);
  wrap.appendChild(box("창고", "칸 무제한", "sg", sc, "stash", 24));
  root.appendChild(wrap);
  // 고른 칸
  const det = el("div", "ia-det"), sel = S.stoSel;
  const have = sel ? (sel.side === "cargo" ? P.cargo[sel.id] : P.stash[sel.id]) || 0 : 0;
  if (sel && have > 0) {
    const id = sel.id, unit = TILE[id].value * STAT.sell;
    det.appendChild(iconEl(oreIcon[id], 32));
    det.appendChild(el("b", null, TILE[id].name));
    det.appendChild(el("span", null, (sel.side === "cargo" ? "화물 " : "창고 ") + have.toLocaleString("ko-KR") + "개 · 개당 " + won(unit)));
    if (sel.side === "cargo") {
      det.appendChild(mkBtn("보관", () => { const k = stashMove(id, Infinity); sfx("pickup"); after(TILE[id].name + " " + cnum(k) + "개 보관"); }, "pri"));
      det.appendChild(mkBtn("팔기 · " + won(unit * have), () => { cargoSell(id, Infinity); after(); }));
    } else {
      const room = Math.min(have, cargoRoom(id));
      det.appendChild(mkBtn("꺼내기", () => { const k = stashTake(id, Infinity); after(k ? TILE[id].name + " " + cnum(k) + "개를 화물로" : "화물에 빈 칸이 없어요"); }, room > 0 ? "info" : "off"));
      det.appendChild(mkBtn("1개 팔기", () => { sellOre(id, 1); after(); }));
      det.appendChild(mkBtn("모두 팔기 · " + won(unit * have), () => { sellOre(id, Infinity); after(); }));
    }
  } else det.appendChild(el("span", "dim", "칸을 누르면 보관·꺼내기·팔기"));
  root.appendChild(det);
  const bs = el("div", "btns");
  const go = (k) => () => { hideOv(); S.invOpen = false; switchTown(k); };
  bs.appendChild(mkBtn("상점", go("shop"), "info"));
  bs.appendChild(mkBtn("제작", go("craft"), "info"));
  bs.appendChild(mkBtn("용광로", go("furnace"), "info"));
  bs.appendChild(mkBtn("주괴·의뢰", go("sell"), "info"));
  bs.appendChild(mkBtn("자동 채굴기", () => renderMiners(), "pri"));
  bs.appendChild(mkBtn("닫기", closeMenu, "back"));
  root.appendChild(bs);
  showOv(root);
}

// ---- 자동 채굴기 창 (2026-11-28 방치형): 지층마다 설치·레벨 업, 시간당 개수, 쌓인 것 받기 ----
export function renderMiners(note) {
  S.invOpen = false;
  if (S.state !== "menu") S.state = "menu";
  const root = el("div", "inv");
  root.appendChild(el("h2", null, "자동 채굴기"));
  root.appendChild(el("p", note ? "msg" : "dim", note || "지층마다 하나씩 · 그 지층 광물이 시간마다 창고에 쌓여요 (꺼 둔 동안도 최대 " + MINER_CAP_H + "시간)"));
  const pend = minerPending(), pn = Object.values(pend).reduce((a, b) => a + Math.floor(b), 0);
  const top = el("div", "ia-det");
  top.appendChild(el("b", null, "쌓인 것 " + cnum(pn) + "개"));
  for (const id of ORE_ORDER) if (Math.floor(pend[id] || 0) > 0) { top.appendChild(iconEl(oreIcon[id], 24)); top.appendChild(el("span", null, cnum(pend[id]))); }
  top.appendChild(mkBtn("받기 → 창고", () => { const n = minerCollect(); sfx("pickup"); saveNow(true, true); renderMiners(n ? cnum(n) + "개를 창고에 넣었어요" : "아직 쌓인 게 없어요"); }, pn > 0 ? "pri" : "off"));
  root.appendChild(top);
  const tb = el("div", "ia-box");
  LAYERS.forEach((Ly, i) => {
    const lv = P.miners[i] || 0, open = minerOpen(i), row = el("div", "ia-det");
    row.style.borderTop = i ? "2px solid #0b0c0f" : "none";
    row.appendChild(el("b", null, Ly.name));
    row.appendChild(el("span", "dim", Ly.from + "m~ · " + (lv ? "Lv." + lv : open ? "설치 안 함" : "아직 못 간 지층")));
    const r = minerRate(i, Math.max(1, lv));
    for (const g of layerOres(i)) { row.appendChild(iconEl(oreIcon[g.id], 24)); row.appendChild(el("span", lv ? null : "dim", cnum(r[g.id]) + "/시간")); }
    if (open && lv < MINER_MAX) row.appendChild(mkBtn((lv ? "Lv 업 · " : "설치 · ") + won(minerCost(i)), () => { if (minerUp(i) === true) renderMiners(); else renderMiners(S.msg); }, P.money >= minerCost(i) ? "pri" : "off"));
    tb.appendChild(row);
  });
  root.appendChild(tb);
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("창고로", () => renderStorage(), "info"));
  bs.appendChild(mkBtn("닫기", closeMenu, "back"));
  root.appendChild(bs);
  showOv(root);
}

export const memStore = {};                               // localStorage를 못 쓸 때의 임시 보관
S.storageOK = true;
export function lsGet(k) {
  try { const v = localStorage.getItem(LS_PREFIX + k); return v === null ? (memStore[k] || null) : v; }
  catch (e) { S.storageOK = false; return memStore[k] || null; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(LS_PREFIX + k, v); delete memStore[k]; return true; }
  catch (e) { S.storageOK = false; memStore[k] = v; return false; }
}
export function lsDel(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {} delete memStore[k]; }
export function parseJSON(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; } }
export function readIndex() { const v = parseJSON(lsGet("index"), []); return Array.isArray(v) ? v : []; }

export const SaveStore = {
  async list() { return readIndex().sort((a, b) => (b.updated || 0) - (a.updated || 0)); },
  async load(id) { return parseJSON(lsGet("acct:" + id), null); },
  async save(d) {
    const ok = lsSet("acct:" + d.id, JSON.stringify(d));
    const idx = readIndex().filter((a) => a.id !== d.id);
    idx.push({ id: d.id, name: d.name, updated: d.updated, playTime: d.playTime, maxDepth: d.stats.maxDepth, money: d.player.money });
    lsSet("index", JSON.stringify(idx));
    return ok;
  },
  async remove(id) {
    lsDel("acct:" + id);
    lsSet("index", JSON.stringify(readIndex().filter((a) => a.id !== id)));
  },
};

