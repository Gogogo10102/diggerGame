// @ts-nocheck
// 진입점: 스타일을 불러오고, 마지막 모듈부터 거꾸로 이어진 import 사슬로 모든 모듈을 원래 순서대로 실행한 뒤 메인 루프를 돕니다.
import "./style.css";
import "./game/ui/menu.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { S } from "./game/core/state.ts";
import { draw } from "./game/render/draw.ts";
import { update } from "./game/systems/update.ts";
import { loadAssets } from "./game/art/assets.ts";
import { updateFurnace } from "./game/systems/furnace.ts";

// =====================================================================
//  메인 루프 (고정 스텝)
// =====================================================================
S.last = performance.now(); S.accT = 0;
const STEP = 1 / 120;
function loop(now) {
  const dtr = Math.min(0.1, (now - S.last) / 1000);
  S.accT += dtr;
  S.last = now;
  if (S.saveFlash > 0) S.saveFlash -= dtr;
  if (S.state === "play") {
    while (S.accT >= STEP) { update(STEP); S.accT -= STEP; }
  } else {
    S.accT = 0; S.animT += 1 / 60;
    if (S.msgT > 0) S.msgT -= 1 / 60;
    if (S.state === "furnace") updateFurnace(dtr);          // 용광로 창을 보는 동안에도 재련이 진행되어 막대가 차오름
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// 이미지 파일(public/assets)을 불러와 같은 캔버스에 덮어 그림 → 불러오는 즉시 화면에 반영 (파일이 없으면 코드로 그린 그림 그대로)
loadAssets();
