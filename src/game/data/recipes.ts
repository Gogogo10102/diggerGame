// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./items.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ITEMS } from "./items.ts";
import { icon } from "../render/util.ts";

// ---- 제작 장비 ----
// ITEMS에 같이 등록되므로 구매 아이템과 똑같이 능력치/저장에 반영됩니다.
// 항목: [id, 이름, 효과, 재료{광물id: 개수}, 돈, (선택) 먼저 제작해야 하는 장비 id]
// 광물 id: 6 석탄, 2 구리, 3 철, 8 은, 4 금, 9 에메랄드, 5 다이아, 10 루비, 11 미스릴
// 분류마다 3개씩 넣으세요. 재료는 제작소 창고(P.stash)에서 소모됩니다.
export const RECIPE_CATS = [];
export function addRecipeCat(name, icon, list) {
  const cat = { name, icon, ids: [] };
  list.forEach((it) => {
    ITEMS[it[0]] = { id: it[0], name: it[1], fx: it[2], mats: it[3], cost: it[4], icon, req: it[5] || null, craft: true };
    cat.ids.push(it[0]);
  });
  RECIPE_CATS.push(cat);
}
// 분류마다 제작 트리가 있어서, 선행 장비(req)를 먼저 만들어야 위 단계를 만들 수 있습니다.
addRecipeCat("드릴", "drill", [
  ["laser_drill", "에메랄드 레이저 드릴", { drill: 0.8 }, { 9: 6, 3: 12 }, 900, "iron_bit"],
  ["dia_bit", "다이아 비트", { drill: 1.2, lucky: 0.1 }, { 5: 6, 9: 4, 3: 20 }, 2500, "laser_drill"],
  ["mithril_drill", "미스릴 드릴", { drill: 2.0, lucky: 0.15 }, { 11: 5, 5: 6 }, 6000, "dia_bit"],
  ["iron_bit", "철 비트", { drill: 0.4 }, { 3: 10, 6: 8 }, 120],
  ["silver_bit", "은 비트", { drill: 0.6, lucky: 0.05 }, { 8: 8, 3: 10 }, 350, "iron_bit"],
  ["gold_bit", "금 코팅 비트", { drill: 0.9, sell: 0.1 }, { 4: 8, 8: 6 }, 900, "silver_bit"],
  ["ruby_bit", "루비 레이저", { drill: 1.5, lucky: 0.05 }, { 10: 6, 4: 8 }, 3000, "laser_drill"],
]);
addRecipeCat("동력", "engine", [
  ["coal_boiler", "석탄 보일러", { fuel: 30, eff: 0.1 }, { 6: 20, 3: 5 }, 100],
  ["ruby_core", "루비 열 코어", { fuel: 60, eff: 0.15 }, { 10: 5, 4: 6 }, 1500, "coal_boiler"],
  ["mithril_reactor", "미스릴 반응로", { fuel: 150, eff: 0.2, thrust: 0.3 }, { 11: 6, 10: 4 }, 5000, "ruby_core"],
  ["copper_coil", "구리 코일", { fuel: 25, eff: 0.08 }, { 2: 20, 6: 10 }, 200, "coal_boiler"],
  ["gold_cell", "금 축전지", { fuel: 70, eff: 0.1 }, { 4: 8, 2: 15 }, 900, "copper_coil"],
  ["diamond_cell", "다이아 셀", { fuel: 110, eff: 0.12 }, { 5: 5, 10: 4 }, 3500, "ruby_core"],
  ["void_engine", "공허 엔진", { fuel: 250, eff: 0.25, thrust: 0.4 }, { 11: 10, 5: 8 }, 12000, "mithril_reactor"],
]);
addRecipeCat("보조", "lamp", [
  ["silver_lens", "은 반사경", { light: 0.35 }, { 8: 8, 2: 5 }, 250],
  ["gold_scale", "금도금 저울", { sell: 0.2 }, { 4: 6, 8: 6 }, 500],
  ["lucky_charm", "행운의 부적", { lucky: 0.15 }, { 4: 4, 9: 3, 10: 2 }, 800],
  ["emerald_lens", "에메랄드 렌즈", { light: 0.5 }, { 9: 6, 8: 6 }, 1200, "silver_lens"],
  ["diamond_scope", "다이아 스코프", { light: 0.8 }, { 5: 5, 9: 4 }, 4000, "emerald_lens"],
  ["merchant_ring", "상인의 반지", { sell: 0.25 }, { 4: 10, 10: 3 }, 2200, "gold_scale"],
  ["clover_gem", "네잎 보석", { lucky: 0.2 }, { 9: 5, 5: 2 }, 3000, "lucky_charm"],
]);
addRecipeCat("외장", "tracks", [
  ["copper_motor", "구리 모터", { speed: 0.15, thrust: 0.1 }, { 2: 15, 3: 6 }, 150],
  ["steel_frame", "강철 화물 프레임", { cargo: 20 }, { 3: 20, 6: 10 }, 300],
  ["mithril_armor", "미스릴 외장", { speed: 0.3, thrust: 0.4, cargo: 40 }, { 11: 5, 5: 5 }, 6000, "silver_plating"],
  ["turbo_motor", "터보 모터", { speed: 0.3, thrust: 0.15 }, { 4: 6, 3: 15 }, 700, "copper_motor"],
  ["ion_thruster", "이온 추진기", { thrust: 0.5, speed: 0.2 }, { 9: 6, 5: 3 }, 3500, "turbo_motor"],
  ["silver_plating", "은 도금 프레임", { cargo: 25 }, { 8: 12, 3: 20 }, 900, "steel_frame"],
  ["diamond_hull", "다이아 선체", { cargo: 50, speed: 0.1 }, { 5: 8, 11: 3 }, 9000, "mithril_armor"],
]);
addRecipeCat("탐사", "special", [
  ["scout_goggles", "탐사 고글", { light: 0.2, lucky: 0.03 }, { 2: 10, 8: 4 }, 180],
  ["geo_scanner", "지질 스캐너", { light: 0.4, lucky: 0.08 }, { 9: 4, 8: 8 }, 1500, "scout_goggles"],
  ["vein_radar", "광맥 레이더", { light: 0.3, lucky: 0.15, drill: 0.3 }, { 5: 4, 10: 3 }, 5000, "geo_scanner"],
  ["deep_visor", "심층 바이저", { light: 1.0, lucky: 0.1 }, { 11: 6, 5: 6 }, 11000, "vein_radar"],
]);
// 트리 배치: 선행 장비가 왼쪽, 다음 단계가 오른쪽
export function layoutTree(cat) {
  const nodes = cat.ids.map((id, i) => ({ id, i, req: ITEMS[id].req && cat.ids.includes(ITEMS[id].req) ? ITEMS[id].req : null, col: 0, row: 0 }));
  const by = {}; nodes.forEach((n) => { by[n.id] = n; });
  let row = 0, maxCol = 0;
  const walk = (n, col) => {
    n.col = col; maxCol = Math.max(maxCol, col);
    const ks = nodes.filter((k) => k.req === n.id);
    if (!ks.length) { n.row = row++; return; }
    ks.forEach((k) => walk(k, col + 1));
    n.row = ks[0].row;
  };
  nodes.filter((n) => !n.req).forEach((n) => walk(n, 0));
  cat.nodes = nodes; cat.cols = maxCol + 1; cat.rows = row;
}
RECIPE_CATS.forEach(layoutTree);
