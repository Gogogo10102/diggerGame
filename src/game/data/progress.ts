// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../save/config.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, recalcStats, say, spawn } from "../core/stats.ts";
import { saveNow } from "../save/account.ts";
import { ORE_IDS } from "../save/config.ts";
import { BARS, FURNACE_LV } from "../systems/furnace.ts";

// =====================================================================
//  광부 레벨 / 업적(퀘스트) / 칭호
// =====================================================================
export const XP_ORE = { 1: 0.4, 6: 3, 2: 5, 3: 8, 8: 14, 4: 22, 9: 35, 5: 60, 10: 80, 11: 150 };   // 채굴 1개당 경험치
export const MAX_LV = 60;
export const xpForLevel = (L) => Math.round(30 * L + 6 * L * L);        // 레벨 L → L+1 에 필요한 경험치
export function levelOf(xp) {
  let lv = 1, rest = Math.max(0, xp);
  while (lv < MAX_LV && rest >= xpForLevel(lv)) { rest -= xpForLevel(lv); lv++; }
  return { lv, cur: lv >= MAX_LV ? 0 : rest, need: lv >= MAX_LV ? 1 : xpForLevel(lv) };
}
export function addXP(n) {
  if (!S.acct || !(n > 0)) return;
  const before = levelOf(S.acct.xp).lv;
  S.acct.xp += n;
  const L = levelOf(S.acct.xp);
  if (L.lv > before) {
    S.MINER_LV = L.lv; recalcStats();
    S.bannerText = "레벨 업!  Lv." + L.lv; S.bannerT = 3.5;
    floaters.push({ x: P.x, y: P.y - 44, text: "LEVEL UP! Lv." + L.lv, color: "#ffd34d", life: 1.8 });
    for (let k = 0; k < 14; k++) spawn(P.x + (Math.random() - 0.5) * 20, P.y, (Math.random() - 0.5) * 160, -60 - Math.random() * 120, 0.8, ["#ffd34d", "#fff3a8", "#7cff6b"][k % 3], 4, 300);
  }
}
export const QUEST_ORE = {
  6:  { n: [20, 100, 300, 800, 2000], t: ["석탄 줍는 이", "석탄 광부", "검은 손", "석탄왕", "흑연의 군주"] },
  2:  { n: [20, 100, 300, 800, 2000], t: ["구리 수집가", "구리 광부", "청동 장인", "구리왕", "적동의 군주"] },
  3:  { n: [10, 50, 100, 300, 800],   t: ["철 수집가", "철 광부", "철강왕", "강철 군주", "강철의 지배자"] },
  8:  { n: [10, 40, 100, 250, 600],   t: ["은 수집가", "은빛 광부", "은의 사냥꾼", "은장 명인", "월광의 지배자"] },
  4:  { n: [5, 25, 60, 150, 400],     t: ["금 수집가", "금 광부", "황금 손", "황금왕", "미다스"] },
  9:  { n: [5, 20, 50, 120, 300],     t: ["에메랄드 수집가", "녹석 광부", "푸른 숲의 눈", "에메랄드왕", "숲의 보석왕"] },
  5:  { n: [3, 15, 40, 100, 250],     t: ["다이아 수집가", "다이아 광부", "빛의 사냥꾼", "다이아왕", "영원의 결정"] },
  10: { n: [3, 12, 30, 80, 200],      t: ["루비 수집가", "홍석 광부", "붉은 눈", "루비왕", "불꽃의 심장"] },
  11: { n: [1, 5, 15, 40, 100],       t: ["미스릴 발견자", "미스릴 광부", "은빛 금속의 벗", "미스릴왕", "전설의 광맥꾼"] },
};
export const minedOf = (id) => (S.acct && S.acct.stats.mined[id]) || 0;
export const totalOres = () => { let n = 0; for (const id of ORE_IDS) n += minedOf(id); return n; };
export const QUESTS = [];
export function addQuests(group, gname, needs, titles, getter, unit, money) {
  needs.forEach((n, k) => QUESTS.push({ id: group + "_" + k, group, gname, need: n, title: titles[k], get: getter, unit, money: money[k], tier: k }));
}
for (const id of ORE_IDS) {
  const q = QUEST_ORE[id], v = TILE[id].value;
  addQuests("o" + id, TILE[id].name, q.n, q.t, () => minedOf(id), TILE[id].name + " 채굴", q.n.map((n) => Math.round(v * n * 0.3)));
}
addQuests("all", "전체 광물", [50, 200, 500, 1500, 4000, 10000], ["초보 광부", "숙련 광부", "베테랑 광부", "광산 달인", "지하의 지배자", "전설의 광부"], totalOres, "광물 채굴", [200, 800, 2500, 8000, 25000, 80000]);
addQuests("dirt", "흙 파기", [200, 1500, 6000], ["삽질 입문", "굴착 장인", "대지의 정복자"], () => minedOf(1), "흙 파기", [100, 800, 4000]);
// 맵이 2400m까지 깊어져서 단계를 늘림 (예전 마지막 단계 '대지의 끝에 서다'는 맨 끝으로 옮김)
addQuests("depth", "깊이", [50, 100, 200, 300, 500, 800, 1300, 1900, 2390],
  ["얕은 탐험가", "심부 탐험가", "지하 개척자", "심연의 방문자", "용암을 건넌 자", "수정 동굴 탐험가", "화석 발굴가", "심연의 주인", "대지의 끝에 서다"],
  () => (S.acct ? Math.floor(S.acct.stats.maxDepth) + 1 : 0), "m 도달", [150, 500, 2000, 8000, 20000, 40000, 80000, 150000, 300000]);
addQuests("craft", "제작", [1, 5, 12, 25], ["견습 제작자", "제작자", "장인", "대장장이 왕"], () => (S.acct ? S.acct.stats.crafted || 0 : 0), "장비 제작", [300, 1500, 8000, 40000]);
addQuests("earn", "수익", [1000, 10000, 100000, 1000000], ["동전 부자", "상인", "거상", "광산 재벌"], () => (S.acct ? S.acct.stats.earned || 0 : 0), "$ 수익", [100, 1000, 10000, 100000]);
addQuests("types", "광물 도감", [9], ["광물 박사"], () => ORE_IDS.filter((id) => minedOf(id) > 0).length, "종류 채굴", [3000]);
addQuests("smelt", "제련", [10, 50, 200, 1000], ["견습 제련공", "제련공", "용광로 장인", "불의 군주"], () => (S.acct ? S.acct.stats.smelted || 0 : 0), "주괴 제련", [200, 800, 4000, 20000]);
QUESTS.forEach((q) => { q.xp = Math.max(10, Math.round(q.money * 0.15)); });
export const QUEST_BY = {}; QUESTS.forEach((q) => { QUEST_BY[q.id] = q; });
S.questT = 0;
export function checkQuests(quiet) {
  if (!S.acct) return;
  const got = [];
  for (const q of QUESTS) {
    if (S.acct.quest[q.id] || q.get() < q.need) continue;
    S.acct.quest[q.id] = 1; got.push(q);
    P.money += q.money;
    if (!S.acct.title) S.acct.title = q.id;
  }
  if (!got.length) return;
  let xp = 0; for (const q of got) xp += q.xp;
  if (quiet) say("업적 " + got.length + "개 달성!");
  else {
    const q = got[got.length - 1];
    S.bannerText = "칭호 획득: " + q.title; S.bannerT = 3.5;
    say("업적 달성! 보상 $" + got.reduce((a, b) => a + b.money, 0));
    floaters.push({ x: P.x, y: P.y - 60, text: "칭호: " + q.title, color: "#ffd34d", life: 2.2 });
  }
  addXP(xp);
  saveNow(false, true);
}
export function onMined(id) {                                   // 광물/흙을 하나 캤을 때
  if (!S.acct) return;
  S.acct.stats.mined[id] = (S.acct.stats.mined[id] || 0) + 1;
  addXP(XP_ORE[id] || 0);
  checkQuests(false);
}
export const titleName = () => (S.acct && S.acct.title && QUEST_BY[S.acct.title] ? QUEST_BY[S.acct.title].title : "");
export function initProgress(d) {                               // 저장 데이터에서 레벨/업적 복원 (예전 저장은 채굴 기록으로 계산)
  let xp = Number(d.xp);
  if (!Number.isFinite(xp) || xp < 0) { xp = 0; for (const id in XP_ORE) xp += ((S.acct.stats.mined[id] || 0) * XP_ORE[id]); }
  S.acct.xp = xp;
  const f = (d.furnace && typeof d.furnace === "object") ? d.furnace : {};
  S.acct.furnace = { lv: Math.max(1, Math.min(FURNACE_LV.length - 1, (f.lv | 0) || 1)), q: [] };
  if (Array.isArray(f.q)) for (const j of f.q.slice(0, FURNACE_LV[S.acct.furnace.lv].cap)) {
    if (j && BARS[j.m]) S.acct.furnace.q.push({ m: j.m, left: Math.max(0, Math.min(BARS[j.m].time, Number.isFinite(Number(j.left)) ? Number(j.left) : BARS[j.m].time)) });
  }
  S.acct.quest = {};
  if (d.quest && typeof d.quest === "object") for (const k in d.quest) if (QUEST_BY[k] && d.quest[k]) S.acct.quest[k] = 1;
  S.acct.title = typeof d.title === "string" && S.acct.quest[d.title] ? d.title : "";
  S.MINER_LV = levelOf(S.acct.xp).lv;
}

