// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../art/itemIcons.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ITEM_ICON } from "../art/itemIcons.ts";
import { ICON, sprite } from "../art/sprites.ts";
import { STAT } from "../core/stats.ts";
import { CATS, ITEMS } from "./items.ts";

// ---- 소모품 (연료통 / 다이너마이트) ----
export const jerry = (p, x, y, w, h, c1, c2, c3, gem) => {
  p(x, y, w, h, "#14151f"); p(x + 1, y + 1, w - 2, h - 2, c1); p(x + 1, y + 1, w - 2, 2, c2); p(x + 1, y + h - 3, w - 2, 2, c3);
  p(x + w - 4, y - 3, 3, 3, "#8b93a6"); p(x + w - 4, y - 3, 3, 1, "#cfd6e4");
  p(x + (w >> 1) - 1, y + (h >> 1) - 1, 2, 3, gem);
};
ICON.fuelcan = sprite(16, 16, (p) => jerry(p, 3, 4, 10, 11, "#d9453a", "#ff7a6b", "#7b241c", "#ffd34d"));
ICON.fuel_s = sprite(16, 16, (p) => jerry(p, 5, 6, 7, 8, "#d9453a", "#ff7a6b", "#7b241c", "#ffd34d"));
ICON.fuel_m = sprite(16, 16, (p) => { jerry(p, 3, 4, 10, 11, "#d9453a", "#ff7a6b", "#7b241c", "#ffd34d"); p(4, 9, 8, 1, "#ffd34d"); });
ICON.fuel_l = sprite(16, 16, (p) => { jerry(p, 2, 3, 12, 12, "#ffb02e", "#fff3a8", "#b87818", "#d9453a"); p(3, 8, 10, 1, "#7b241c"); p(3, 12, 10, 1, "#7b241c"); p(7, 0, 2, 1, "#5ef2ff"); });
export const stickD = (p, x, y) => {
  p(x, y, 4, 9, "#14151f"); p(x + 1, y + 1, 2, 7, "#d9453a"); p(x + 1, y + 1, 1, 7, "#ff7a6b"); p(x, y + 4, 4, 2, "#f2f6fa");
  p(x + 1, y - 2, 1, 2, "#c9a26b");
};
ICON.dyn_s = sprite(16, 16, (p) => { stickD(p, 6, 5); p(7, 1, 3, 1, "#ffe066"); p(8, 0, 1, 1, "#ff8a1f"); });
ICON.dyn_l = sprite(16, 16, (p) => { stickD(p, 1, 5); stickD(p, 6, 5); stickD(p, 11, 5); p(0, 9, 16, 2, "#c9a26b"); p(0, 9, 16, 1, "#e8c78f"); p(7, 1, 3, 1, "#ffe066"); p(8, 0, 1, 1, "#ff8a1f"); });
ICON.dyn_x = sprite(16, 16, (p) => {
  p(5, 4, 6, 10, "#14151f"); p(3, 6, 10, 6, "#14151f"); p(4, 5, 8, 8, "#14151f");
  p(5, 6, 6, 6, "#2b2f45"); p(4, 7, 8, 4, "#2b2f45"); p(5, 6, 2, 2, "#7a82a6");
  p(3, 9, 10, 1, "#ffd34d"); p(4, 8, 8, 1, "#c98f1a"); p(8, 2, 1, 3, "#c9a26b"); p(7, 0, 3, 2, "#ff8a1f"); p(8, 0, 1, 1, "#ffe066");
});
export const CONS = {
  fuel_s: { name: "소형 연료통", kind: "fuel", frac: 0.3, cost: 40, desc: "연료 30% 즉시 충전" },
  fuel_m: { name: "중형 연료통", kind: "fuel", frac: 0.6, cost: 100, desc: "연료 60% 즉시 충전" },
  fuel_l: { name: "대형 연료통", kind: "fuel", frac: 1.0, cost: 200, desc: "연료 100% 즉시 충전" },
  dyn_s: { name: "다이너마이트", kind: "bomb", rad: 1, cost: 60, desc: "설치 2.5초 후 폭발 · 3x3" },
  dyn_l: { name: "강력 다이너마이트", kind: "bomb", rad: 2, cost: 200, desc: "설치 2.5초 후 폭발 · 5x5" },
  dyn_x: { name: "초강력 폭약", kind: "bomb", rad: 3, cost: 600, desc: "설치 2.5초 후 폭발 · 7x7" },
  ladder: { name: "사다리", kind: "ladder", len: 10, cost: 25, desc: "떨어뜨리면 아래로 10칸 펼쳐짐 · 타고 오르내림" },
  recall: { name: "마을 귀환서", kind: "recall", cost: 3000, desc: "읽으면 곧바로 마을로 · 화물은 그대로" },
  sup_w: { name: "나무 지지대", kind: "support", steel: false, cost: 15, desc: "(더 이상 팔지 않음)" },
  sup_s: { name: "강철 지지대", kind: "support", steel: true, cost: 60, desc: "(더 이상 팔지 않음)" },
};
// 단축 슬롯(1~8) = 상점 소모품 (7 = 사다리, 8 = 마을 귀환서). 지지대(sup_w/sup_s)는 지반 붕괴를 없애면서 뺐음 (옛 세이브 호환용으로 CONS 에만 남김)
export const HOT = ["fuel_s", "fuel_m", "fuel_l", "dyn_s", "dyn_l", "dyn_x", "ladder", "recall"];
{
  const ids = [];
  for (const id of HOT) {
    const c = CONS[id];
    ITEMS[id] = { id, name: c.name, cost: c.cost, desc: c.desc, icon: id, req: null, cons: true };
    ITEM_ICON[id] = ICON[id];
    ids.push(id);
  }
  CATS.push({ name: "소모품", icon: "fuelcan", ids, cons: true });
}
// 상점 탭 (2026-11-28): 장비 칸 분류(CATS)를 상점에서는 묶어서 보여 줌 → 탭 수를 줄임
//   조명 + 특수 = 기타 · 로봇 본체는 상점에서 빼고 차고에서 삼(update.ts toggleMech)
//   카드의 능력치 칸은 탭이 아니라 그 아이템의 분류(SLOT_OF)로 판단
export const SHOP_TABS = [
  ["곡괭이", "pick", ["pick"]], ["백팩 로켓", "rocket", ["rocket"]], ["톱니", "drill", ["drill"]],
  ["탱크", "fuel", ["fuel"]], ["화물", "crate", ["crate"]], ["엔진", "engine", ["engine"]], ["구동계", "tracks", ["tracks"]],
  ["기타", "special", ["lamp", "special"]], ["소모품", "fuelcan", ["fuelcan"]],
].map(([name, icon, keys]) => {
  const cs = keys.map((k) => CATS.find((c) => c.icon === k));
  return { name, icon, cats: cs, ids: cs.flatMap((c) => c.ids), cons: !!cs[0].cons, slot: cs.length === 1 ? cs[0].slot : null };
});
export const VIS_BASE = 2.5;                                     // 기본 시야 반경(타일)
export const visR = () => VIS_BASE * STAT.light;
export const LOOK = { drill: 0, tracks: 0, lamp: 0, crate: 0, engine: 0, pick: 0, rocket: 0, key: "" };   // 로봇 외형(장비 단계) · 사람 곡괭이/로켓 단계

