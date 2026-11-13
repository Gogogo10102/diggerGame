// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../art/sprites.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { HH, SURF, T } from "./config.ts";

// =====================================================================
//  상태
// =====================================================================
export const P = {
  x: 6 * T + T / 2, y: SURF * T - HH - 1,
  vx: 0, vy: 0,
  fuel: 60, money: 0,
  cargo: {},
  items: {},            // 구매/제작한 아이템 { id: true }
  stash: {},            // 제작소 창고의 광물 { 광물id: 개수 }
  bars: {},             // 용광로에서 만든 주괴 { cu/fe/ag/au/mi: 개수 }
  inv: {},              // 소모품 { 아이템id: 개수 }
  dead: 0, facing: 1, digging: false, mode: "side", grounded: false,
  layerMax: 0,
};

