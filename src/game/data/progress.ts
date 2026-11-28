// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../save/config.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { sfx } from "../core/sound.ts";
import { ORE_COL, TILE, won } from "../core/config.ts";
import { CHAR_IDS, ICON, minerPreview, oreIcon } from "../art/sprites.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { floaters, pushBanner, recalcStats, say, spawn } from "../core/stats.ts";
import { saveNow } from "../save/account.ts";
import { ORE_IDS } from "../save/config.ts";
import { BARS, FURNACE_LV, SKILL_COST } from "../systems/furnace.ts";

// =====================================================================
//  광부 레벨 / 업적(퀘스트) / 칭호
// =====================================================================
export const XP_ORE = { 1: 0.4, 6: 3, 2: 5, 3: 8, 8: 14, 4: 22, 9: 35, 5: 60, 10: 80, 11: 150, 17: 40,
  20: 5, 21: 20, 22: 45, 23: 90, 24: 180, 25: 260, 26: 400, 27: 600, 28: 900, 29: 1300, 30: 2200, 31: 5000 };   // 새 광물(2026-11-28)   // 채굴 1개당 경험치
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
    pushBanner("레벨 업!  Lv." + L.lv, "채굴 속도 · 판매가가 조금 올랐어요", ICON.drill, "#7cff6b"); sfx("levelup");
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
  20: { n: [10, 40, 100, 250, 600],   t: ["석영 줍는 아이", "석영 광부", "맑은 돌 수집가", "석영 장인", "투명한 눈"] },
  21: { n: [3, 12, 30, 80, 200],      t: ["호박 발견자", "호박 손질꾼", "꿀빛 손끝", "호박 장인", "굳은 시간의 수집가"] },
  22: { n: [5, 20, 50, 120, 300],     t: ["자수정 수집가", "보라 광부", "자색 눈", "자수정왕", "보랏빛 왕관"] },
  23: { n: [3, 15, 40, 100, 250],     t: ["사파이어 수집가", "청석 광부", "깊은 바다의 눈", "사파이어왕", "푸른 별"] },
  24: { n: [5, 20, 50, 120, 300],     t: ["흑요석 수집가", "검은 유리 광부", "용암의 기억", "흑요석왕", "밤의 칼날"] },
  25: { n: [3, 12, 30, 80, 200],      t: ["화염석 발견자", "불돌 광부", "타오르는 손", "화염석왕", "꺼지지 않는 불"] },
  26: { n: [3, 12, 30, 80, 200],      t: ["수정 발견자", "수정 광부", "빛 모으는 이", "수정왕", "수정궁의 주인"] },
  27: { n: [1, 5, 15, 40, 100],       t: ["오팔 발견자", "오팔 손질꾼", "무지갯빛 손끝", "오팔왕", "무지개의 심장"] },
  28: { n: [2, 8, 20, 50, 120],       t: ["아다만트 발견자", "아다만트 광부", "부서지지 않는 손", "아다만트왕", "불멸의 금속"] },
  29: { n: [1, 4, 12, 30, 80],        t: ["고대 호박 발견자", "고대의 손질꾼", "태고의 손끝", "고대 호박왕", "시간을 캔 자"] },
  30: { n: [1, 5, 15, 40, 100],       t: ["공허석 발견자", "공허의 광부", "빈 곳을 캔 자", "공허석왕", "공허의 지배자"] },
  31: { n: [1, 3, 8, 20, 50],         t: ["별을 주운 자", "별 조각 광부", "떨어진 별의 벗", "별의 왕", "하늘을 캔 광부"] },
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
addQuests("all", "전체 광물", [50, 200, 500, 1500, 4000, 10000], ["초보 광부", "숙련 광부", "베테랑 광부", "광산 달인", "지하의 지배자", "전설의 광부"], totalOres, "광물 채굴", [2000, 8000, 25000, 80000, 250000, 800000]);
addQuests("dirt", "흙 파기", [200, 1500, 6000], ["삽질 입문", "굴착 장인", "대지의 정복자"], () => minedOf(1), "흙 파기", [1000, 8000, 40000]);
// 맵이 2400m까지 깊어져서 단계를 늘림 (예전 마지막 단계 '대지의 끝에 서다'는 맨 끝으로 옮김)
addQuests("depth", "깊이", [50, 100, 200, 300, 500, 800, 1300, 1900, 2390],
  ["얕은 탐험가", "심부 탐험가", "지하 개척자", "심연의 방문자", "용암을 건넌 자", "수정 동굴 탐험가", "화석 발굴가", "심연의 주인", "대지의 끝에 서다"],
  () => (S.acct ? Math.floor(S.acct.stats.maxDepth) + 1 : 0), "m 도달", [150, 500, 2000, 8000, 20000, 40000, 80000, 150000, 300000]);
addQuests("craft", "제작", [1, 5, 12, 25], ["견습 제작자", "제작자", "장인", "대장장이 왕"], () => (S.acct ? S.acct.stats.crafted || 0 : 0), "장비 제작", [3000, 15000, 80000, 400000]);
addQuests("earn", "수익", [10000, 100000, 1000000, 10000000], ["동전 부자", "상인", "거상", "광산 재벌"], () => (S.acct ? S.acct.stats.earned || 0 : 0), "원 수익", [1000, 10000, 100000, 1000000]);
addQuests("types", "광물 도감", [9], ["광물 박사"], () => ORE_IDS.filter((id) => minedOf(id) > 0).length, "종류 채굴", [30000]);
addQuests("cave", "동굴 탐험", [1, 10, 30, 100], ["동굴 발견자", "동굴 탐험가", "지하 지도 제작자", "동굴의 주인"], () => (S.acct ? S.acct.stats.caves || 0 : 0), "개 동굴 발견", [3000, 20000, 80000, 300000]);
addQuests("smelt", "제련", [10, 50, 200, 1000], ["견습 제련공", "제련공", "용광로 장인", "불의 군주"], () => (S.acct ? S.acct.stats.smelted || 0 : 0), "주괴 제련", [2000, 8000, 40000, 200000]);
addQuests("chest", "보물 사냥", [1, 10, 30, 100], ["보물 사냥꾼", "상자 수집가", "도굴왕", "전설의 보물 사냥꾼"], () => (S.acct ? S.acct.stats.chests || 0 : 0), "개 보물 상자", [2000, 15000, 60000, 250000]);
const questStat = (k) => () => (S.acct ? S.acct.stats[k] || 0 : 0);
addQuests("trip", "귀환", [5, 25, 100, 300], ["첫 출근", "성실한 광부", "베테랑 운반꾼", "지하 철도왕"], questStat("trips"), "광물 싣고 귀환", [1000, 6000, 30000, 120000]);
addQuests("bomb", "폭파", [5, 30, 100, 300], ["불꽃놀이 입문", "폭파 기술자", "발파 전문가", "폭약의 달인"], questStat("bombs"), "다이너마이트 사용", [1500, 8000, 30000, 100000]);
addQuests("order", "의뢰", [1, 10, 40, 120], ["심부름꾼", "믿음직한 광부", "마을의 해결사", "전설의 납품왕"], questStat("orders"), "의뢰 완료", [1500, 12000, 60000, 250000]);
addQuests("close", "아슬아슬", [1, 5, 20], ["간 큰 광부", "벼랑 끝 귀환자", "연료 0의 마술사"], questStat("close"), "연료 10% 미만으로 귀환", [2000, 15000, 60000]);
addQuests("level", "광부 레벨", [5, 10, 20, 30], ["새내기 광부", "든든한 광부", "노련한 광부", "광부 명장"], () => (S.acct ? levelOf(S.acct.xp).lv : 0), "레벨 달성", [3000, 15000, 80000, 300000]);
QUESTS.forEach((q) => { q.xp = Math.max(10, Math.round(q.money * 0.15)); });
const QLABEL = {
  depth: (n) => "깊이 " + n + "m 도달", craft: (n) => "장비 " + n + "개 제작", earn: (n) => "누적 수익 " + won(n), types: (n) => "광물 " + n + "종 채굴",
  cave: (n) => "동굴 " + n + "개 발견", chest: (n) => "보물 상자 " + n + "개 열기", smelt: (n) => "주괴 " + n + "개 제련", dirt: (n) => "흙 " + n + "개 파기",
  all: (n) => "광물 " + n + "개 채굴", trip: (n) => "광물 싣고 " + n + "번 귀환", bomb: (n) => "다이너마이트 " + n + "번 사용",
  close: (n) => "연료 10% 미만으로 " + n + "번 귀환", level: (n) => "광부 레벨 " + n + " 달성", order: (n) => "마을 의뢰 " + n + "개 완료",
};
// 돈(earn)은 숫자 그대로 넘겨 won() 이 원으로
export function questLabel(q) { const n = q.group === "earn" ? q.need : q.need.toLocaleString(); return QLABEL[q.group] ? QLABEL[q.group](n) : q.unit + " " + n + "개"; }
export const QUEST_BY = {}; QUESTS.forEach((q) => { QUEST_BY[q.id] = q; });
S.questT = 0;
// ---- 캐릭터(로봇) 종류: 해금 조건 (그림은 sprites.ts 의 CHAR_IDS · tools/chars.py) ----
//  need: [기록 종류, 목표] — lv 레벨 · depth 최고 깊이(m) · chests 연 보물 상자 · ores 캔 광물 수
export const CHAR_INFO = [
  { id: "yellow", name: "노랑이", desc: "기본 굴착 로봇. 안전 노랑이 자랑", need: null },
  { id: "ruby", name: "불꽃이", desc: "새빨간 몸 · 안테나 하나 · 호박색 눈", need: ["lv", 3] },
  { id: "mint", name: "새싹이", desc: "둥근 머리 민트 로봇 · 분홍 눈", need: ["depth", 100] },
  { id: "cobalt", name: "파랑이", desc: "고글 눈 심해 탐사 로봇 · 안테나 없음", need: ["chests", 5] },
  { id: "mole", name: "두더지", desc: "광부 안전모 + 이마 램프 (조명 색)", need: ["depth", 300] },
  { id: "night", name: "밤하늘", desc: "남색 몸 · 금빛 머리 · 긴 안테나", need: ["lv", 15] },
];
const CHAR_NEED_TXT = { lv: (n) => "레벨 " + n, depth: (n) => n + "m 도달", chests: (n) => "보물 상자 " + n + "개", ores: (n) => "광물 " + n + "개 캐기" };
export function charHave(ch) {
  if (!ch.need || !S.acct) return 0;
  const k = ch.need[0];
  return k === "lv" ? levelOf(S.acct.xp).lv : k === "depth" ? Math.floor(S.acct.stats.maxDepth) : k === "chests" ? S.acct.stats.chests || 0 : k === "ores" ? totalOres() : 0;
}
export const charOpen = (ch) => !ch.need || charHave(ch) >= ch.need[1];
export const charNeedText = (ch) => (ch.need ? CHAR_NEED_TXT[ch.need[0]](ch.need[1]) : "처음부터");
// 새로 열린 캐릭터 알림 (acct.chars = 이미 알린 것). 불러올 때(quiet)는 알림 없이 표시만
function checkChars(quiet) {
  if (!S.acct.chars) S.acct.chars = [];
  for (const ch of CHAR_INFO) {
    if (!ch.need || S.acct.chars.includes(ch.id) || !charOpen(ch)) continue;
    S.acct.chars.push(ch.id);
    if (!quiet) { pushBanner("새 로봇: " + ch.name, "메뉴 › 캐릭터 정보 › 로봇 탭에서 바꿀 수 있어요", minerPreview(ch.id), "#7cff6b"); sfx("levelup"); }
  }
}
export function checkQuests(quiet) {
  if (!S.acct) return;
  checkChars(quiet);
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
    pushBanner("칭호 획득: " + q.title, q.gname + " · " + q.need + q.unit + " · 보상 " + won(q.money), ICON.trophy, "#ffd34d");
    say("업적 달성! 보상 " + won(got.reduce((a, b) => a + b.money, 0)));
    floaters.push({ x: P.x, y: P.y - 60, text: "칭호: " + q.title, color: "#ffd34d", life: 2.2 });
  }
  addXP(xp);
  saveNow(false, true);
}
export function onMined(id) {                                   // 광물/흙을 하나 캤을 때
  if (!S.acct) return;
  S.acct.stats.mined[id] = (S.acct.stats.mined[id] || 0) + 1;
  if (S.acct.stats.mined[id] === 1 && ORE_COL[id] && oreIcon[id]) {          // 처음 캔 광물: 도감에 새로 올라감
    pushBanner("새 광물 발견! " + TILE[id].name, "판매가 " + won(TILE[id].value) + " · 가방 도감에 기록됐어요", oreIcon[id], ORE_COL[id][0]);
    sfx("ore", { pitch: 1.5 });
  }
  addXP(XP_ORE[id] || 0);
  checkQuests(false);
}
export const titleName = () => (S.acct && S.acct.title && QUEST_BY[S.acct.title] ? QUEST_BY[S.acct.title].title : "");
export function initProgress(d) {                               // 저장 데이터에서 레벨/업적 복원 (예전 저장은 채굴 기록으로 계산)
  let xp = Number(d.xp);
  if (!Number.isFinite(xp) || xp < 0) { xp = 0; for (const id in XP_ORE) xp += ((S.acct.stats.mined[id] || 0) * XP_ORE[id]); }
  S.acct.xp = xp;
  const f = (d.furnace && typeof d.furnace === "object") ? d.furnace : {};
  S.acct.furnace = { lv: Math.max(1, Math.min(FURNACE_LV.length - 1, (f.lv | 0) || 1)), q: [], skill: Math.max(0, Math.min(SKILL_COST.length, f.skill | 0)) };   // skill: 제련 숙련 (예전 세이브엔 없음 → 0)
  if (Array.isArray(f.q)) for (const j of f.q.slice(0, FURNACE_LV[S.acct.furnace.lv].cap)) {
    if (j && BARS[j.m]) S.acct.furnace.q.push({ m: j.m, left: Math.max(0, Math.min(BARS[j.m].time, Number.isFinite(Number(j.left)) ? Number(j.left) : BARS[j.m].time)) });
  }
  S.acct.quest = {};
  if (d.quest && typeof d.quest === "object") for (const k in d.quest) if (QUEST_BY[k] && d.quest[k]) S.acct.quest[k] = 1;
  S.acct.title = typeof d.title === "string" && S.acct.quest[d.title] ? d.title : "";
  S.MINER_LV = levelOf(S.acct.xp).lv;
  // 캐릭터: 고른 것(열린 것만, 아니면 기본) · 이미 알린 것 목록 (옛 세이브는 없음 → 기본)
  S.acct.chars = Array.isArray(d.chars) ? d.chars.filter((x) => CHAR_IDS.includes(x)) : [];
  const pick = CHAR_INFO.find((c) => c.id === d.char);
  S.charId = pick && charOpen(pick) ? pick.id : "yellow";
  // 의뢰: 저장된 것 중 올바른 것만 (옛 세이브는 빈 목록 → 판매 탭을 열 때 새로 만듦)
  S.acct.orders = Array.isArray(d.orders) ? d.orders.filter((o) => o && (TILE[o.k] || BARS[o.k]) && o.n > 0 && o.pay > 0).slice(0, 3)
    .map((o) => ({ k: TILE[o.k] ? Number(o.k) : o.k, n: o.n | 0, pay: o.pay | 0, xp: o.xp | 0 })) : [];
}

