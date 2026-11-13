// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./dom.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { CRAFT_ICON, itemIcon } from "../art/itemIcons.ts";
import { ICON, getMiner, oreIcon } from "../art/sprites.ts";
import { TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { FUEL_DIG, FUEL_IDLE, FUEL_THRUST, STAT, cargoCap, cargoCount, maxFuel } from "../core/stats.ts";
import { CONS, HOT, visR } from "../data/consumables.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { MAX_LV, levelOf, titleName } from "../data/progress.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { LS_PREFIX } from "../save/config.ts";
import { TIER_COL } from "../systems/cave.ts";
import { discardOre } from "../systems/drops.ts";
import { BARS, BAR_KEYS, barIcon } from "../systems/furnace.ts";
import { useConsumable } from "../systems/update.ts";
import { barEl, charFooter, charTabs, iconEl } from "./dom.ts";
import { closeMenu } from "./menu.ts";
import { el, mkBtn, showOv } from "./overlay.ts";

// ---- 인벤토리: 착용 중인 아이템을 그림으로 한눈에 ----
export function renderInventory(note) {
  S.invOpen = true;
  const root = el("div", "wide");
  root.appendChild(charTabs("inv"));
  if (note) root.appendChild(el("p", "msg", note));
  // 캐릭터 카드
  const L = levelOf(S.acct.xp);
  const card = el("div", "hero");
  const ph = el("div", "portrait");
  ph.appendChild(iconEl(getMiner("side", 0, -1), 96));
  card.appendChild(ph);
  const inf = el("div", "heroinfo");
  inf.appendChild(el("div", "nm", S.acct.name));
  inf.appendChild(el("div", "msg", "Lv." + L.lv + (titleName() ? "  「" + titleName() + "」" : "")));
  inf.appendChild(barEl(L.lv >= MAX_LV ? 1 : L.cur / L.need, "#ffd34d"));
  inf.appendChild(el("div", "dim sm", L.lv >= MAX_LV ? "최고 레벨" : "경험치 " + Math.floor(L.cur) + " / " + L.need));
  inf.appendChild(el("div", "dim sm", "$" + P.money + "  ·  연료 " + Math.ceil(P.fuel) + "/" + maxFuel() + "  ·  화물 " + cargoCount() + "/" + cargoCap()));
  card.appendChild(inf);
  root.appendChild(card);
  // 장비 슬롯
  root.appendChild(el("p", "msg", "장착 장비"));
  const grid = el("div", "slots");
  const slot = (label, id, iconSpr, tierTxt, tier) => {
    const s = el("div", "slot" + (id ? "" : " empty"));
    if (id) { const tc = TIER_COL[Math.max(0, Math.min(7, tier | 0))]; s.style.borderColor = tc; s.style.background = "linear-gradient(180deg," + tc + "33,rgba(255,255,255,.04))"; }
    s.appendChild(iconEl(iconSpr, 48));
    s.appendChild(el("div", "dim sm", label));
    s.appendChild(el("div", "nm2", id ? ITEMS[id].name : "비어 있음"));
    if (tierTxt) s.appendChild(el("div", "pips", tierTxt));
    grid.appendChild(s);
  };
  for (const cat of CATS) {
    if (cat.cons) continue;
    let top = -1;
    cat.ids.forEach((id, i) => { if (P.items[id]) top = i; });
    const id = top >= 0 ? cat.ids[top] : null;
    slot(cat.name, id, id ? itemIcon(id) : ICON[cat.icon === "fuel" ? "fuel" : cat.icon] || ICON.chest, id ? "●".repeat(top + 1) + "○".repeat(cat.ids.length - top - 1) : "", top);
  }
  for (const cat of RECIPE_CATS) {                                   // 제작 장비: 가장 높은 단계 하나
    let best = null;
    for (const id of cat.ids) if (P.items[id] && (!best || CRAFT_ICON[id][1] >= CRAFT_ICON[best][1])) best = id;
    const n = cat.ids.filter((id) => P.items[id]).length;
    slot("제작·" + cat.name, best, best ? itemIcon(best) : ICON[cat.icon] || ICON.chest, best ? n + " / " + cat.ids.length + " 제작" : "", best ? CRAFT_ICON[best][1] : 0);
  }
  root.appendChild(grid);
  // 소모품
  root.appendChild(el("p", "msg", "소모품 (숫자 키 1~8)"));
  const hot = el("div", "slots hot");
  HOT.forEach((id, i) => {
    const n = P.inv[id] || 0;
    const s = el("div", "slot" + (n > 0 ? "" : " empty"));
    s.appendChild(iconEl(ICON[id], 36));
    s.appendChild(el("div", "nm2", (i + 1) + ". " + CONS[id].name));
    s.appendChild(el("div", "dim sm", "x" + n));
    const usable = n > 0 || CONS[id].kind === "support";
    s.addEventListener("click", () => { if (usable) { closeMenu(); useConsumable(id); } });
    if (usable) s.style.cursor = "pointer";
    hot.appendChild(s);
  });
  root.appendChild(hot);
  // 보유 광물
  const own = Object.keys(P.cargo).filter((id) => P.cargo[id] > 0);
  const barsOwn = BAR_KEYS.filter((k) => P.bars[k] > 0);
  if (barsOwn.length) {
    root.appendChild(el("p", "msg", "주괴 (제작 재료)"));
    const bg = el("div", "slots ores");
    for (const k of barsOwn) { const s = el("div", "slot"); s.appendChild(iconEl(barIcon[k], 40)); s.appendChild(el("div", "nm2", BARS[k].name + " x" + P.bars[k])); bg.appendChild(s); }
    root.appendChild(bg);
  }
  root.appendChild(el("p", "msg", "화물 광물 (제작소에서 판매 · 버리면 땅에 떨어져요)"));
  if (!own.length) root.appendChild(el("p", "dim", "비어 있어요"));
  else {
    const og = el("div", "slots ores");
    for (const id of own) {
      const s = el("div", "slot");
      s.appendChild(iconEl(oreIcon[id], 36));
      s.appendChild(el("div", "nm2", TILE[id].name + " x" + P.cargo[id]));
      const row = el("div", "minis");
      const drop = (n) => () => { const k = discardOre(id, n); renderInventory(k > 0 ? TILE[id].name + " " + k + "개를 버렸어요. 60초 안에 다시 주울 수 있어요" : null); };
      row.appendChild(mkBtn("1개 버리기", drop(1), "mini"));
      row.appendChild(mkBtn("전부", drop(Infinity), "mini"));
      s.appendChild(row);
      og.appendChild(s);
    }
    root.appendChild(og);
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

