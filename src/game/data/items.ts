// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../core/player.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { icon } from "../render/util.ts";

// ---- 아이템 카탈로그 ----
// 항목: [id, 이름, 효과, 가격, (선택) 선행 아이템 id]
// 장비 칸 분류(slot 이 있는 분류: 곡괭이·로켓·드릴·탱크·화물·엔진·궤도·조명)는 효과가 '그 장비의 고유 값'입니다.
//   한 칸에 하나만 껴서 그 값이 곧 능력치 (예: 금 곡괭이 = 곡괭이 채굴력 1.6). 안 끼면 기본값(stats.ts 의 SLOT_BASE).
// 특수·제작 장비의 효과는 낀 장비 값에 더해지는 보너스 (판매가·연비·행운은 %).
// 효과 키: drill 로봇 드릴 채굴력, fuel 최대 연료, cargo 화물칸, thrust 로봇 추진력, speed 로봇 이동 속도,
//          light 시야, eff 연료 소모 감소, sell 판매가, pick 곡괭이 채굴력, rocket 백팩 로켓 추진력, robot 로봇 본체
// chain=true 인 분류는 위에서부터 순서대로 사야 합니다.
export const ITEMS = {};
export const CATS = [];
export function addCat(name, icon, list, chain, slot) {
  const cat = { name, icon, ids: [], slot: slot || null };   // slot: 장비 칸이면 그 능력치 키 (한 칸에 하나만 낌)
  list.forEach((it, i) => {
    const req = it[4] !== undefined ? it[4] : (chain && i > 0 ? list[i - 1][0] : null);
    ITEMS[it[0]] = { id: it[0], name: it[1], fx: it[2], cost: it[3], icon, req };
    cat.ids.push(it[0]);
  });
  CATS.push(cat);
}
// 사람 장비: 곡괭이(처음엔 기본 곡괭이 · 무료) · 백팩 로켓(있어야 날 수 있음, 연료 씀) / 로봇(마을 차고에서 타는 탈것)
addCat("곡괭이", "pick", [
  ["pick_iron", "철 곡괭이", { pick: 0.75 }, 60],
  ["pick_steel", "강철 곡괭이", { pick: 1.1 }, 250],
  ["pick_gold", "금 곡괭이", { pick: 1.6 }, 900],
  ["pick_dia", "다이아 곡괭이", { pick: 2.3 }, 3000],
  ["pick_mith", "미스릴 곡괭이", { pick: 3.3 }, 9000],
], true, "pick");
addCat("백팩 로켓", "rocket", [
  ["rocket1", "백팩 로켓", { rocket: 0.8 }, 350],
  ["rocket1b", "강화 백팩 로켓", { rocket: 0.9 }, 700],      // 2026-11-28 추가 (PixelLab 그림 5종). id 는 세이브 때문에 기존 것 그대로 두고 사이에 끼움
  ["rocket2", "터보 백팩 로켓", { rocket: 1.05 }, 1400],
  ["rocket3", "제트 백팩", { rocket: 1.35 }, 4200],
  ["rocket4", "플라즈마 백팩", { rocket: 1.75 }, 12000],
], true, "rocket");
addCat("로봇", "robot", [
  ["robot", "굴착 로봇", { robot: 1 }, 1500],
], true);
// 아래 드릴 · 엔진 · 궤도는 로봇 장비 (로봇을 사야 살 수 있음). 탱크(연료) · 화물 · 조명 · 특수는 사람·로봇 공용
addCat("톱니", "drill", [   // 예전 "드릴" — 로봇 팔이 톱니바퀴라 이름도 톱니 (id·icon 키는 세이브 때문에 그대로)
  ["steel_drill", "강철 톱니", { drill: 1.4 }, 80, "robot"],
  ["ti_drill", "티타늄 톱니", { drill: 2.0 }, 320],
  ["dia_drill", "다이아 톱니", { drill: 3.0 }, 1200],
  ["plasma_drill", "플라즈마 톱니", { drill: 3.8 }, 3200],
  ["sonic_drill", "소닉 톱니", { drill: 4.8 }, 8500],
  ["gravity_drill", "중력 톱니", { drill: 6.0 }, 22000],
  ["antimatter_drill", "반물질 톱니", { drill: 7.5 }, 55000],
  ["singularity_drill", "특이점 톱니", { drill: 9.5 }, 140000],
], true, "drill");
addCat("탱크", "fuel", [
  ["aux_tank", "보조 탱크", { fuel: 80 }, 60],
  ["big_tank", "대형 탱크", { fuel: 120 }, 250],
  ["power_cell", "고출력 배터리", { fuel: 200 }, 1000],
  ["comp_tank", "압축 탱크", { fuel: 320 }, 2800],
  ["plasma_cell", "플라즈마 셀", { fuel: 500 }, 7500],
  ["fusion_core", "핵융합 코어", { fuel: 760 }, 20000],
  ["dark_tank", "암흑물질 탱크", { fuel: 1140 }, 52000],
  ["inf_reactor", "무한 동력로", { fuel: 1740 }, 130000],
], true, "fuel");
addCat("화물", "crate", [
  ["cargo1", "확장 화물칸", { cargo: 18 }, 50],
  ["cargo2", "대형 화물칸", { cargo: 34 }, 220],
  ["cargo3", "압축 화물칸", { cargo: 66 }, 900],
  ["cargo4", "합금 화물칸", { cargo: 114 }, 2500],
  ["cargo5", "자석 화물칸", { cargo: 184 }, 6800],
  ["cargo6", "공간 압축 화물칸", { cargo: 284 }, 18000],
  ["cargo7", "차원 화물칸", { cargo: 424 }, 46000],
  ["cargo8", "블랙홀 화물칸", { cargo: 624 }, 115000],
], true, "cargo");
addCat("엔진", "engine", [
  ["engine1", "강화 엔진", { thrust: 1.2 }, 150, "robot"],
  ["engine2", "터보 엔진", { thrust: 1.5 }, 600],
  ["engine3", "제트 엔진", { thrust: 2.0 }, 2000],
  ["engine4", "플라즈마 엔진", { thrust: 2.4 }, 5200],
  ["engine5", "이온 엔진", { thrust: 2.9 }, 13000],
  ["engine6", "핵 엔진", { thrust: 3.5 }, 33000],
  ["engine7", "반중력 엔진", { thrust: 4.3 }, 80000],
  ["engine8", "초광속 엔진", { thrust: 5.3 }, 200000],
], true, "thrust");
addCat("구동계", "tracks", [   // 예전 "궤도" — 다리를 바꾸면 외형이 안 바뀌어서 몸속 부품으로
  ["track1", "고속 서보 모터", { speed: 1.15 }, 120, "robot"],
  ["track2", "강화 기어박스", { speed: 1.35 }, 500],
  ["track3", "유압 액추에이터", { speed: 1.6 }, 1500],
  ["track4", "합금 관절 모터", { speed: 1.8 }, 4000],
  ["track5", "자기부상 코일", { speed: 2.0 }, 10500],
  ["track6", "호버 안정기", { speed: 2.25 }, 26000],
  ["track7", "반중력 모듈", { speed: 2.55 }, 65000],
  ["track8", "차원 도약 장치", { speed: 2.9 }, 160000],
], true, "speed");
addCat("조명", "lamp", [
  ["lamp1", "헤드램프", { light: 1.3 }, 90],
  ["lamp2", "탐사 라이트", { light: 1.7 }, 400],
  ["lamp3", "광자 램프", { light: 2.3 }, 1400],
  ["lamp4", "크세논 램프", { light: 2.6 }, 3800],
  ["lamp5", "레이저 서치라이트", { light: 2.9 }, 9500],
  ["lamp6", "플라즈마 조명", { light: 3.3 }, 24000],
  ["lamp7", "태양광 램프", { light: 3.7 }, 60000],
  ["lamp8", "초신성 램프", { light: 4.2 }, 150000],
], true, "light");
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

