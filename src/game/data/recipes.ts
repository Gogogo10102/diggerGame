// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./items.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { ITEMS } from "./items.ts";
import { icon } from "../render/util.ts";
import { ICON, sprite } from "../art/sprites.ts";

// ---- 제작 장비 ----
// ITEMS에 같이 등록되므로 구매 아이템과 똑같이 능력치/저장에 반영됩니다.
// 항목: [id, 이름, 효과, 재료{광물id: 개수}, 돈, (선택) 먼저 제작해야 하는 장비 id]
// 광물 id: 6 석탄, 2 구리, 3 철, 8 은, 4 금, 9 에메랄드, 5 다이아, 10 루비, 11 미스릴
// 분류마다 3개씩 넣으세요. 재료는 제작소 창고(P.stash)에서 소모됩니다.
export const RECIPE_CATS = [];
export function addRecipeCat(name, icon, list, robot) {
  const cat = { name, icon, ids: [], robot: !!robot };            // robot: 로봇 부품이라 로봇을 사야 보임
  list.forEach((it) => {
    ITEMS[it[0]] = { id: it[0], name: it[1], fx: it[2], mats: it[3], cost: it[4], icon, req: it[5] || null, craft: true };
    cat.ids.push(it[0]);
  });
  RECIPE_CATS.push(cat);
}
// 분류마다 제작 트리가 있어서, 선행 장비(req)를 먼저 만들어야 위 단계를 만들 수 있습니다.
addRecipeCat("톱날", "drill", [
  ["laser_drill", "에메랄드 톱날", { drill: 0.8 }, { 9: 120, 3: 290 }, 90000, "iron_bit"],
  ["dia_bit", "다이아 톱날", { drill: 1.2, lucky: 0.1 }, { 5: 96, 9: 80, 3: 480 }, 250000, "laser_drill"],
  ["mithril_drill", "미스릴 톱날", { drill: 2.0, lucky: 0.15 }, { 11: 60, 5: 96 }, 600000, "dia_bit"],
  ["iron_bit", "철 톱날", { drill: 0.4 }, { 3: 240, 6: 260 }, 12000],
  ["silver_bit", "은 톱날", { drill: 0.6, lucky: 0.05 }, { 8: 190, 3: 240 }, 35000, "iron_bit"],
  ["gold_bit", "금 코팅 톱날", { drill: 0.9, sell: 0.1 }, { 4: 160, 8: 140 }, 90000, "silver_bit"],
  ["ruby_bit", "루비 톱날", { drill: 1.5, lucky: 0.05 }, { 10: 96, 4: 160 }, 300000, "laser_drill"],
], true);
addRecipeCat("동력", "engine", [
  ["coal_boiler", "석탄 보일러", { fuel: 30, eff: 0.1 }, { 6: 640, 3: 120 }, 10000],
  ["ruby_core", "루비 열 코어", { fuel: 60, eff: 0.15 }, { 10: 80, 4: 120 }, 150000, "coal_boiler"],
  ["mithril_reactor", "미스릴 반응로", { fuel: 150, eff: 0.2, thrust: 0.3 }, { 11: 72, 10: 64 }, 500000, "ruby_core"],
  ["copper_coil", "구리 코일", { fuel: 25, eff: 0.08 }, { 2: 640, 6: 320 }, 20000, "coal_boiler"],
  ["gold_cell", "금 축전지", { fuel: 70, eff: 0.1 }, { 4: 160, 2: 480 }, 90000, "copper_coil"],
  ["diamond_cell", "다이아 셀", { fuel: 110, eff: 0.12 }, { 5: 80, 10: 64 }, 350000, "ruby_core"],
  ["void_engine", "공허 엔진", { fuel: 250, eff: 0.25, thrust: 0.4 }, { 11: 120, 5: 130 }, 1200000, "mithril_reactor"],
], true);
addRecipeCat("보조", "lamp", [
  ["silver_lens", "은 반사경", { light: 0.35 }, { 8: 190, 2: 160 }, 25000],
  ["gold_scale", "금도금 저울", { sell: 0.2 }, { 4: 120, 8: 140 }, 50000],
  ["lucky_charm", "행운의 부적", { lucky: 0.15 }, { 4: 80, 9: 60, 10: 32 }, 80000],
  ["emerald_lens", "에메랄드 렌즈", { light: 0.5 }, { 9: 120, 8: 140 }, 120000, "silver_lens"],
  ["diamond_scope", "다이아 스코프", { light: 0.8 }, { 5: 80, 9: 80 }, 400000, "emerald_lens"],
  ["merchant_ring", "상인의 반지", { sell: 0.25 }, { 4: 200, 10: 48 }, 220000, "gold_scale"],
  ["clover_gem", "네잎 보석", { lucky: 0.2 }, { 9: 100, 5: 32 }, 300000, "lucky_charm"],
]);
addRecipeCat("외장", "tracks", [
  ["copper_motor", "구리 모터", { speed: 0.15, thrust: 0.1 }, { 2: 480, 3: 140 }, 15000],
  ["steel_frame", "강철 화물 프레임", { cargo: 1 }, { 3: 480, 6: 320 }, 30000],
  ["mithril_armor", "미스릴 외장", { speed: 0.3, thrust: 0.4, cargo: 2 }, { 11: 60, 5: 80 }, 600000, "silver_plating"],
  ["turbo_motor", "터보 모터", { speed: 0.3, thrust: 0.15 }, { 4: 120, 3: 360 }, 70000, "copper_motor"],
  ["ion_thruster", "이온 추진기", { thrust: 0.5, speed: 0.2 }, { 9: 120, 5: 48 }, 350000, "turbo_motor"],
  ["silver_plating", "은 도금 프레임", { cargo: 1 }, { 8: 290, 3: 480 }, 90000, "steel_frame"],
  ["diamond_hull", "다이아 선체", { cargo: 3, speed: 0.1 }, { 5: 130, 11: 36 }, 900000, "mithril_armor"],
], true);
addRecipeCat("탐사", "special", [
  ["scout_goggles", "탐사 고글", { light: 0.2, lucky: 0.03 }, { 2: 320, 8: 96 }, 18000],
  ["geo_scanner", "지질 스캐너", { light: 0.4, lucky: 0.08 }, { 9: 80, 8: 190 }, 150000, "scout_goggles"],
  ["vein_radar", "광맥 레이더", { light: 0.3, lucky: 0.15, drill: 0.3 }, { 5: 64, 10: 48 }, 500000, "geo_scanner"],
  ["deep_visor", "심층 바이저", { light: 1.0, lucky: 0.1 }, { 11: 72, 5: 96 }, 1100000, "vein_radar"],
]);
// 이동 (2026-11-28): 텔레포터. 만들면 마을 ↔ 땅속(간 적 있는 깊이) 을 순간 이동, 좋은 것일수록 갈 수 있는 최대 깊이(tele, m)가 늘어남
//   재료는 바로 앞 단계로 갈 수 있는 깊이의 새 광물 → 한 단계씩 깊어짐 (로봇 없이도 씀)
//   지상에 설치해서 쓰는 소모성 장비: 한 번에 하나만, 내구도를 다 쓰면 사라짐 (update.ts 의 텔레포터)
ICON.tele = sprite(16, 16, (p) => {
  p(3, 13, 10, 2, "#14151f"); p(4, 13, 8, 1, "#8b93a6"); p(2, 12, 12, 1, "#14151f");
  p(4, 2, 8, 11, "#14151f"); p(5, 3, 6, 9, "#3a2a78"); p(6, 4, 4, 7, "#6a4ae0"); p(7, 5, 2, 5, "#b8a8ff"); p(7, 6, 1, 2, "#ffffff");
  p(3, 4, 1, 8, "#9fd8ff"); p(12, 4, 1, 8, "#9fd8ff"); p(5, 1, 6, 1, "#9fd8ff");
});
addRecipeCat("이동", "tele", [
  ["tele1", "간이 텔레포터", { tele: 200 }, { 20: 560, 2: 960 }, 30000],
  ["tele2", "자수정 텔레포터", { tele: 500 }, { 22: 200, 3: 720 }, 400000, "tele1"],
  ["tele3", "사파이어 게이트", { tele: 900 }, { 23: 160, 4: 400 }, 3000000, "tele2"],
  ["tele4", "흑요석 게이트", { tele: 1400 }, { 24: 140, 25: 60 }, 30000000, "tele3"],
  ["tele5", "수정 공명기", { tele: 2000 }, { 26: 80, 27: 16 }, 300000000, "tele4"],
  ["tele6", "공허 도약기", { tele: 2400 }, { 28: 48, 30: 12 }, 3000000000, "tele5"],
]);
export const TELE_DUR = { tele1: 20, tele2: 25, tele3: 30, tele4: 35, tele5: 40, tele6: 50 };   // 내구도 (설치 2 · 한 번 넘어갈 때 1)
for (const id in TELE_DUR) ITEMS[id].dur = TELE_DUR[id];
// 재료 개수 (2026-11-28 방치형 개편): 원석은 한 번에 여러 개 나오니 그 광물의 기본 개수(yield) × 4 배, 주괴는 × 3 배로 늘림
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
