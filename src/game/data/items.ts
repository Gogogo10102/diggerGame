// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../core/player.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { icon } from "../render/util.ts";

// ---- 아이템 카탈로그 ----
// 항목: [id, 이름, 효과, 가격, (선택) 선행 아이템 id]
// 효과 키: drill 채굴 속도, fuel 최대 연료, cargo 화물 용량, thrust 추진력,
//          speed 이동 속도, light 시야, eff 연료 소모 감소, sell 판매가
// chain=true 인 분류는 위에서부터 순서대로 사야 합니다. 분류마다 3개씩 넣으세요.
export const ITEMS = {};
export const CATS = [];
export function addCat(name, icon, list, chain) {
  const cat = { name, icon, ids: [] };
  list.forEach((it, i) => {
    const req = it[4] !== undefined ? it[4] : (chain && i > 0 ? list[i - 1][0] : null);
    ITEMS[it[0]] = { id: it[0], name: it[1], fx: it[2], cost: it[3], icon, req };
    cat.ids.push(it[0]);
  });
  CATS.push(cat);
}
addCat("드릴", "drill", [
  ["steel_drill", "강철 드릴", { drill: 0.4 }, 80],
  ["ti_drill", "티타늄 드릴", { drill: 0.6 }, 320],
  ["dia_drill", "다이아 드릴", { drill: 1.0 }, 1200],
  ["plasma_drill", "플라즈마 드릴", { drill: 0.8 }, 3200],
  ["sonic_drill", "소닉 드릴", { drill: 1.0 }, 8500],
  ["gravity_drill", "중력 드릴", { drill: 1.2 }, 22000],
  ["antimatter_drill", "반물질 드릴", { drill: 1.5 }, 55000],
  ["singularity_drill", "특이점 드릴", { drill: 2.0 }, 140000],
], true);
addCat("탱크", "fuel", [
  ["aux_tank", "보조 탱크", { fuel: 20 }, 60],
  ["big_tank", "대형 탱크", { fuel: 40 }, 250],
  ["power_cell", "고출력 배터리", { fuel: 80 }, 1000],
  ["comp_tank", "압축 탱크", { fuel: 120 }, 2800],
  ["plasma_cell", "플라즈마 셀", { fuel: 180 }, 7500],
  ["fusion_core", "핵융합 코어", { fuel: 260 }, 20000],
  ["dark_tank", "암흑물질 탱크", { fuel: 380 }, 52000],
  ["inf_reactor", "무한 동력로", { fuel: 600 }, 130000],
], true);
addCat("화물", "crate", [
  ["cargo1", "확장 화물칸", { cargo: 8 }, 50],
  ["cargo2", "대형 화물칸", { cargo: 16 }, 220],
  ["cargo3", "압축 화물칸", { cargo: 32 }, 900],
  ["cargo4", "합금 화물칸", { cargo: 48 }, 2500],
  ["cargo5", "자석 화물칸", { cargo: 70 }, 6800],
  ["cargo6", "공간 압축 화물칸", { cargo: 100 }, 18000],
  ["cargo7", "차원 화물칸", { cargo: 140 }, 46000],
  ["cargo8", "블랙홀 화물칸", { cargo: 200 }, 115000],
], true);
addCat("엔진", "engine", [
  ["engine1", "강화 엔진", { thrust: 0.2 }, 150],
  ["engine2", "터보 엔진", { thrust: 0.3 }, 600],
  ["engine3", "제트 엔진", { thrust: 0.5 }, 2000],
  ["engine4", "플라즈마 엔진", { thrust: 0.4 }, 5200],
  ["engine5", "이온 엔진", { thrust: 0.5 }, 13000],
  ["engine6", "핵 엔진", { thrust: 0.6 }, 33000],
  ["engine7", "반중력 엔진", { thrust: 0.8 }, 80000],
  ["engine8", "초광속 엔진", { thrust: 1.0 }, 200000],
], true);
addCat("궤도", "tracks", [
  ["track1", "고속 궤도", { speed: 0.15 }, 120],
  ["track2", "강화 궤도", { speed: 0.2 }, 500],
  ["track3", "터보 궤도", { speed: 0.25 }, 1500],
  ["track4", "합금 궤도", { speed: 0.2 }, 4000],
  ["track5", "자기부상 궤도", { speed: 0.2 }, 10500],
  ["track6", "호버 궤도", { speed: 0.25 }, 26000],
  ["track7", "반중력 궤도", { speed: 0.3 }, 65000],
  ["track8", "차원 도약 궤도", { speed: 0.35 }, 160000],
], true);
addCat("조명", "lamp", [
  ["lamp1", "헤드램프", { light: 0.3 }, 90],
  ["lamp2", "탐사 라이트", { light: 0.4 }, 400],
  ["lamp3", "광자 램프", { light: 0.6 }, 1400],
  ["lamp4", "크세논 램프", { light: 0.3 }, 3800],
  ["lamp5", "레이저 서치라이트", { light: 0.3 }, 9500],
  ["lamp6", "플라즈마 조명", { light: 0.4 }, 24000],
  ["lamp7", "태양광 램프", { light: 0.4 }, 60000],
  ["lamp8", "초신성 램프", { light: 0.5 }, 150000],
], true);
addCat("특수", "special", [
  ["eco1", "연비 개선기", { eff: 0.15 }, 300],
  ["appraiser", "감정사 고글", { sell: 0.15 }, 500],
  ["eco2", "냉각 코어", { eff: 0.2 }, 900, "eco1"],
  ["market_ana", "시장 분석기", { sell: 0.2 }, 2500, "appraiser"],
  ["luck_ant", "행운 안테나", { lucky: 0.1 }, 6000],
  ["auction", "경매 계약서", { sell: 0.25 }, 9000, "market_ana"],
  ["superwire", "초전도 배선", { eff: 0.1 }, 12000, "eco2"],
  ["exchange", "황금 거래 허가증", { sell: 0.3, lucky: 0.05 }, 30000, "auction"],
], false);

