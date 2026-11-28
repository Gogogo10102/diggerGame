// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../art/sprites.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { HH, SURF, T } from "./config.ts";

// =====================================================================
//  상태
// =====================================================================
export const P = {
  x: 6 * T + T / 2, y: SURF * T - HH - 1,
  vx: 0, vy: 0,
  fuel: 60, hp: 100, money: 0, tele: null, made: {},
  cargo: {},
  items: {},            // 구매/제작한 아이템 { id: true }
  eq: {},               // 장비 칸마다 낀 장비 { 분류icon: id | "" } ("" = 안 낌. 기록이 없는 칸은 가진 것 중 가장 높은 단계)
  off: {},              // 빼 둔 특수·제작 장비 { id: true }
  lv: {},               // 레벨 장비(특수)의 레벨 { id: n } (items.ts 의 itemLv)
  miners: {},           // 자동 채굴기 레벨 { 지층 번호: Lv } (town.ts, 2026-11-28 방치형)
  minerAt: 0,           // 자동 채굴기를 마지막으로 받은 때 (Date.now ms, 0 = 아직)
  stash: {},            // 제작소 창고의 광물 { 광물id: 개수 }
  bars: {},             // 용광로에서 만든 주괴 { cu/fe/ag/au/mi: 개수 }
  inv: {},              // 소모품 { 아이템id: 개수 }
  dead: 0, facing: 1, digging: false, mode: "side", grounded: false,
  mech: false,          // 로봇에 타 있는지 (false = 사람 광부). 로봇은 마을 차고에서만 타고 내림
  climbing: false,      // 사다리를 오르내리는 중
  layerMax: 0,
};

