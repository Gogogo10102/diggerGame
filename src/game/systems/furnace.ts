// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../data/recipes.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { B } from "../art/itemIcons.ts";
import { ICON, oreIcon, sprite } from "../art/sprites.ts";
import { BUILD_COLS, SURF, T, TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, say, spawn } from "../core/stats.ts";
import { ITEMS } from "../data/items.ts";
import { addXP, checkQuests } from "../data/progress.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { saveNow } from "../save/account.ts";
import { TOWN, stashCargo, switchTown, touch } from "./input.ts";
import { barEl, iconEl } from "../ui/dom.ts";
import { closeMenu } from "../ui/menu.ts";
import { el, keysReset, mkBtn, showOv } from "../ui/overlay.ts";

// =====================================================================
//  용광로: 원석 2개 + 석탄을 넣으면 시간이 지나 주괴 1개가 됩니다(플레이 중이면 광산에 있어도 진행).
//  제작소의 금속 재료는 원석이 아니라 주괴로 받습니다. 보석(에메랄드·다이아·루비)은 원석 그대로.
// =====================================================================
export const ORE_PER_BAR = 2;
export const BARS = {
  cu: { name: "구리 주괴",   ore: 2,  coal: 1, time: 4,  pal: ["#ffc9a0", "#e07a3c", "#9a4a22"] },
  fe: { name: "철 주괴",     ore: 3,  coal: 1, time: 6,  pal: ["#b9c0cf", "#7a8296", "#4a5064"] },
  ag: { name: "은 주괴",     ore: 8,  coal: 1, time: 8,  pal: ["#ffffff", "#d3e0f2", "#8f9db8"] },
  au: { name: "금 주괴",     ore: 4,  coal: 2, time: 10, pal: ["#fff6bf", "#ffcd3c", "#c98f1a"] },
  mi: { name: "미스릴 주괴", ore: 11, coal: 3, time: 20, pal: ["#d8fff9", "#5ee6d0", "#2a8f8a"] },
};
export const BAR_KEYS = Object.keys(BARS);
export const BAR_OF = { 2: "cu", 3: "fe", 8: "ag", 4: "au", 11: "mi" };
export const FURNACE_LV = [null,
  { cap: 5,  speed: 1,   save: 0,    cost: 0 },
  { cap: 10, speed: 1.5, save: 0,    cost: 600 },
  { cap: 20, speed: 2,   save: 0.25, cost: 2500 },
  { cap: 40, speed: 3,   save: 0.5,  cost: 8000 },
];
// 주괴 도트: 왼쪽 아래 → 오른쪽 위로 비스듬히 누운 막대 (윗면 밝게 / 앞면 기본 / 아랫면·끝면 어둡게)
//   L = x - y (막대 길이 방향), A = x + y (두께 방향)
export const barIcon = {};
for (const k of BAR_KEYS) {
  barIcon[k] = sprite(16, 16, (p) => {
    const c = BARS[k].pal, K = "#14151f";
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const L = x - y, A = x + y;
      if (A < 10 || A > 20) continue;
      const top = A <= 14, lo = top ? -6 : -8, hi = top ? 6 : 8;       // 윗면이 조금 짧은 사다리꼴 막대
      if (L < lo || L > hi) continue;
      let col;
      if (A === 10 || A === 20 || L === lo || L === hi) col = K;       // 테두리
      else if (top) col = (A === 11 && L > lo && L < hi - 2) || (A === 12 && L === lo + 1) ? "#ffffff" : c[0];   // 윗면 + 광택
      else if (A === 19 || L >= hi - 1) col = c[2];                     // 아랫면 / 오른쪽 끝면
      else col = L <= lo + 1 ? c[0] : c[1];                             // 앞면(왼쪽 끝은 밝게)
      p(x, y, 1, 1, col);
    }
    if (k === "mi") { p(2, 8, 1, 1, "#9ffff0"); p(14, 3, 1, 1, "#9ffff0"); p(9, 2, 1, 1, "#d8fff9"); }
  });
}
// 주괴 판매가: 원석 2개 + 석탄 값보다 35% 비쌈
export const barValue = (k) => Math.round((TILE[BARS[k].ore].value * ORE_PER_BAR + TILE[6].value * BARS[k].coal) * 1.35);
// 제작 재료 변환: 금속 원석 n개 → 주괴 ceil(n/2)개
for (const cat of RECIPE_CATS) for (const id of cat.ids) {
  const m0 = ITEMS[id].mats, m = {};
  for (const k in m0) { const b = BAR_OF[k]; if (b) m[b] = (m[b] || 0) + Math.ceil(m0[k] / ORE_PER_BAR); else m[k] = (m[k] || 0) + m0[k]; }
  ITEMS[id].mats = m;
}
export const isBar = (m) => !!BARS[m];
export const matHave = (m) => (isBar(m) ? P.bars[m] : P.stash[m]) || 0;
export const matName = (m) => (isBar(m) ? BARS[m].name : TILE[m].name);
export const matIcon = (m) => (isBar(m) ? barIcon[m] : oreIcon[m]);
export function matTake(m, n) { const box = isBar(m) ? P.bars : P.stash; box[m] = (box[m] || 0) - n; if (box[m] <= 0) delete box[m]; }

// 용광로 아이콘(창 머리글용)
ICON.furnace = sprite(16, 16, (p) => {
  const D = "#14151f";
  p(10, 0, 4, 5, D); p(11, 1, 2, 4, "#5b606e");
  p(1, 4, 14, 12, D); p(2, 5, 12, 10, "#8a5440"); p(2, 5, 12, 2, "#a8694f");
  for (const [x, y] of [[2, 8], [8, 8], [5, 11], [11, 11]]) p(x, y, 3, 1, "#5e3528");
  p(4, 9, 8, 6, D); p(5, 10, 6, 5, "#ff8a1f"); p(6, 11, 4, 4, "#ffd34d"); p(7, 12, 2, 3, "#fff3a8");
});
// 용광로 건물 (5칸 x 4칸, 16px 도트 기준 80 x 64)
export const furnaceImg = sprite(80, 64, (p) => {
  const D = "#14151f";
  // 바닥 돌판
  p(0, 60, 80, 4, D); p(1, 61, 78, 2, "#5b606e"); p(1, 61, 78, 1, "#7a8094");
  // 굴뚝
  p(44, 0, 12, 22, D); p(45, 1, 10, 21, "#4a4f63"); p(45, 1, 3, 21, "#5d6582"); p(42, 0, 16, 4, D); p(43, 1, 14, 2, "#6b7399");
  // 지붕(후드)
  p(10, 14, 52, 10, D); p(12, 15, 48, 8, "#5e3528"); p(12, 15, 48, 2, "#7a4a3a");
  for (let x = 14; x < 58; x += 6) p(x, 18, 3, 1, "#4a2c22");
  // 몸체: 붉은 벽돌
  p(6, 22, 60, 39, D); p(7, 23, 58, 37, "#8a5440");
  for (let y = 23, k = 0; y < 60; y += 4, k++) {
    p(7, y + 3, 58, 1, "#5e3528");
    for (let x = 7 + (k % 2 ? 4 : 0); x < 65; x += 8) { p(x, y, 1, 3, "#5e3528"); p(x + 1, y, 6, 1, "#a8694f"); }
  }
  // 아궁이(불은 실행 중에 그림)
  p(20, 34, 32, 26, D); p(22, 36, 28, 24, "#2a1510");
  p(24, 32, 24, 3, D); p(26, 30, 20, 3, D);
  p(22, 35, 28, 2, "#4a2c22");
  // 쇠테 장식
  p(18, 33, 36, 2, "#3a3f52"); p(18, 33, 36, 1, "#7a8094");
  for (const x of [20, 34, 50]) p(x, 32, 2, 2, "#c9ced8");
  // 풀무(왼쪽)
  p(0, 44, 8, 14, D); p(1, 45, 6, 12, "#8a5a3c"); p(1, 45, 6, 2, "#c08a5c"); for (let y = 48; y < 57; y += 3) p(1, y, 6, 1, "#5e3b25");
  // 석탄 더미(오른쪽)
  p(66, 52, 14, 9, D); p(67, 53, 12, 7, "#2b2d38");
  for (const [x, y] of [[68, 54], [72, 53], [75, 55], [70, 57], [74, 58]]) { p(x, y, 2, 2, "#4a4f63"); p(x, y, 1, 1, "#8a90a0"); }
  // 쇳물 홈통(앞쪽 오른쪽 아래)
  p(52, 54, 14, 4, D); p(53, 55, 12, 2, "#3a3f52");
});

export function furnaceSmelt(m, n) {
  const B = BARS[m], F = S.acct.furnace, L = FURNACE_LV[F.lv];
  const room = L.cap - F.q.length;
  const byOre = Math.floor((P.stash[B.ore] || 0) / ORE_PER_BAR), byCoal = Math.floor((P.stash[6] || 0) / B.coal);
  const k = Math.min(n, room, byOre, byCoal);
  if (room <= 0) return "대기열이 가득 찼어요 (최대 " + L.cap + "개)";
  if (byOre <= 0) return TILE[B.ore].name + " 원석이 " + ORE_PER_BAR + "개 이상 필요해요";
  if (byCoal <= 0) return "석탄이 부족해요 (주괴 1개에 " + B.coal + "개)";
  P.stash[B.ore] -= k * ORE_PER_BAR; if (P.stash[B.ore] <= 0) delete P.stash[B.ore];
  P.stash[6] -= k * B.coal; if (P.stash[6] <= 0) delete P.stash[6];
  for (let i = 0; i < k; i++) F.q.push({ m, left: B.time });
  saveNow(true, true);
  return B.name + " " + k + "개 재련 시작!";
}
export function furnaceClear() {                                   // 대기열 비우기: 재료를 돌려줌
  const F = S.acct.furnace;
  let n = 0;
  for (const j of F.q) {
    const B = BARS[j.m];
    P.stash[B.ore] = (P.stash[B.ore] || 0) + ORE_PER_BAR;
    P.stash[6] = (P.stash[6] || 0) + B.coal;
    n++;
  }
  F.q = [];
  saveNow(true, true);
  return n ? "대기열 " + n + "개를 취소하고 재료를 돌려받았어요" : "비울 대기열이 없어요";
}
export function furnaceUpgrade() {
  const F = S.acct.furnace, nx = FURNACE_LV[F.lv + 1];
  if (!nx) return "이미 최고 단계예요";
  if (P.money < nx.cost) return "돈이 부족해요 ($" + nx.cost + ")";
  P.money -= nx.cost; F.lv++;
  saveNow(true, true);
  return "용광로 Lv." + F.lv + " 강화 완료!";
}
S.furnaceAnnounce = 0;
export function updateFurnace(dt) {
  if (!S.acct || !S.acct.furnace || !S.acct.furnace.q.length) return;
  const F = S.acct.furnace, L = FURNACE_LV[F.lv], job = F.q[0];
  if (Math.random() < dt * 5) spawn((BUILD_COLS[3][0] + 2.5) * T + (Math.random() - 0.5) * 30, (SURF - 0.7) * T, (Math.random() - 0.5) * 60, -60 - Math.random() * 80, 0.6, Math.random() < 0.5 ? "#ffd34d" : "#ff8a1f", 2, 200);
  job.left -= dt * L.speed;
  if (job.left > 0) return;
  F.q.shift();
  P.bars[job.m] = (P.bars[job.m] || 0) + 1;
  S.acct.stats.smelted = (S.acct.stats.smelted || 0) + 1;
  S.furnaceAnnounce++;
  if (L.save > 0 && Math.random() < L.save) P.stash[6] = (P.stash[6] || 0) + BARS[job.m].coal;   // 강화: 석탄 절약
  addXP(2);
  if (Math.abs(P.x - (BUILD_COLS[3][0] + 2.5) * T) < 6 * T && P.y < SURF * T)
    floaters.push({ x: (BUILD_COLS[3][0] + 2.5) * T, y: (SURF - 2) * T, text: "+" + BARS[job.m].name, color: BARS[job.m].pal[1], life: 1.2 });
  if (!F.q.length) { say("용광로: 주괴 " + S.furnaceAnnounce + "개 재련 완료!"); S.furnaceAnnounce = 0; saveNow(false, true); }
  checkQuests(false);
}
export function openFurnace() {
  const moved = stashCargo();
  S.state = "menu"; keysReset();
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
  renderFurnace(moved > 0 ? "화물 광물 " + moved + "개를 창고에 넣었어요" : null);
}
export function townTabs() {
  const bar = el("div", "tabs");
  for (const [k, label] of TOWN) bar.appendChild(mkBtn(label, () => switchTown(k), "tab" + (k === "furnace" ? " on" : "")));
  bar.appendChild(mkBtn("✕", closeMenu, "tab x"));
  return bar;
}
export function renderFurnace(note) {
  S.invOpen = false; S.furnaceOpen = true;
  const F = S.acct.furnace, L = FURNACE_LV[F.lv];
  const root = el("div", "wide");
  root.appendChild(townTabs());
  root.appendChild(el("h2", null, "용광로  Lv." + F.lv));
  // 상태 카드
  const card = el("div", "hero");
  const ph = el("div", "portrait"); ph.appendChild(iconEl(ICON.furnace, 72)); card.appendChild(ph);
  const inf = el("div", "heroinfo");
  inf.appendChild(el("div", "nm", F.q.length ? "재련 중... (" + F.q.length + " / " + L.cap + ")" : "쉬는 중 (대기열 0 / " + L.cap + ")"));
  if (F.q.length) {
    const j = F.q[0], B = BARS[j.m];
    inf.appendChild(barEl(1 - j.left / B.time, "#ff8a1f"));
    const cnt = {}; for (const q of F.q) cnt[q.m] = (cnt[q.m] || 0) + 1;
    inf.appendChild(el("div", "dim sm", "지금: " + B.name + " · 남은 시간 약 " + Math.ceil(F.q.reduce((a, q) => a + q.left, 0) / L.speed) + "초"));
    inf.appendChild(el("div", "dim sm", Object.keys(cnt).map((k) => BARS[k].name + " x" + cnt[k]).join(" · ")));
  } else inf.appendChild(el("div", "dim sm", "원석 " + ORE_PER_BAR + "개 + 석탄으로 주괴 1개. 넣어 두면 광산에 가 있어도 계속 재련돼요."));
  inf.appendChild(el("div", "dim sm", "속도 x" + L.speed + (L.save ? " · 석탄 " + Math.round(L.save * 100) + "% 절약" : "") + " · 창고 석탄 " + (P.stash[6] || 0) + "개"));
  card.appendChild(inf);
  root.appendChild(card);
  if (note) root.appendChild(el("p", "msg", note));
  // 재련 목록
  root.appendChild(el("p", "msg", "재련하기"));
  for (const k of BAR_KEYS) {
    const B = BARS[k];
    const row = el("div", "row smelt");
    row.appendChild(iconEl(oreIcon[B.ore], 36));
    row.appendChild(el("div", "arrow", "→"));
    row.appendChild(iconEl(barIcon[k], 40));
    const info = el("div", "info");
    info.appendChild(el("div", "nm", B.name + "  (보유 " + (P.bars[k] || 0) + ")"));
    info.appendChild(el("div", "dim sm", TILE[B.ore].name + " " + ORE_PER_BAR + " + 석탄 " + B.coal + " · " + B.time + "초 · 창고 " + TILE[B.ore].name + " " + (P.stash[B.ore] || 0) + "개"));
    row.appendChild(info);
    const can = Math.min(L.cap - F.q.length, Math.floor((P.stash[B.ore] || 0) / ORE_PER_BAR), Math.floor((P.stash[6] || 0) / B.coal));
    const go = (n) => () => renderFurnace(furnaceSmelt(k, n));
    const bs = el("div", "minis");
    bs.appendChild(mkBtn("1개", go(1), can > 0 ? "mini" : "mini off"));
    bs.appendChild(mkBtn("5개", go(5), can > 0 ? "mini" : "mini off"));
    bs.appendChild(mkBtn("최대 " + Math.max(0, can), go(Infinity), can > 0 ? "mini pri" : "mini off"));
    row.appendChild(bs);
    root.appendChild(row);
  }
  // 강화
  const nx = FURNACE_LV[F.lv + 1];
  root.appendChild(el("p", "msg", "용광로 강화"));
  if (nx) {
    root.appendChild(el("p", "dim", "Lv." + (F.lv + 1) + ": 대기열 " + L.cap + "→" + nx.cap + " · 속도 x" + L.speed + "→x" + nx.speed + (nx.save ? " · 석탄 " + Math.round(nx.save * 100) + "% 절약" : "")));
    const ub = el("div", "btns");
    ub.appendChild(mkBtn("강화 ($" + nx.cost + ")", () => renderFurnace(furnaceUpgrade()), P.money >= nx.cost ? "pri" : ""));
    root.appendChild(ub);
  } else root.appendChild(el("p", "dim", "최고 단계예요!"));
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("닫기", closeMenu, "pri"));
  if (F.q.length) bs.appendChild(mkBtn("대기열 비우기", () => renderFurnace(furnaceClear()), "del"));
  root.appendChild(bs);
  showOv(root);
}


