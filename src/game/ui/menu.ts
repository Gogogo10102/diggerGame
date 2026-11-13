// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./overlay.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { HH, SURF, T, TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { ZOOMS, maxFuel, say, zoomName } from "../core/stats.ts";
import { genWorld } from "../core/world.ts";
import { ITEMS } from "../data/items.ts";
import { levelOf, titleName } from "../data/progress.ts";
import { applyAccount, saveNow, snapshot } from "../save/account.ts";
import { ORE_IDS } from "../save/config.ts";
import { exportCode } from "../save/transfer.ts";
import { chunks } from "../systems/floating.ts";
import { SENS_NAME } from "../systems/input.ts";
import { charFooter, charTabs } from "./dom.ts";
import { lsGet, lsSet, renderInventory } from "./inventory.ts";
import { el, fmtTime, hideOv, keysReset, mkBtn, openAccountScreen, showOv } from "./overlay.ts";

// ---- 게임 중 메뉴 ----
export function openMenu() {
  if (S.state !== "play" || !S.acct) return;
  saveNow(true);
  S.state = "menu"; keysReset();
  renderMenu();
}
export function closeMenu() { hideOv(); S.invOpen = false; S.state = "play"; }
export function openInventory() {
  if (S.state !== "play" || !S.acct || P.dead > 0) return;
  S.state = "menu"; keysReset();
  renderInventory();
}
export function renderMenu(note) {
  S.invOpen = false;
  const root = el("div");
  root.appendChild(el("h2", null, "메뉴"));
  root.appendChild(el("p", "dim", "계정: " + S.acct.name));
  if (note) root.appendChild(el("p", "msg", note));
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("계속하기", closeMenu, "pri"));
  bs.appendChild(mkBtn("지금 저장", async () => { const ok = await saveNow(true); renderMenu(ok ? "저장했어요" : "저장에 실패했어요"); }));
  bs.appendChild(mkBtn("캐릭터 정보 (장비·업적·통계)", () => renderInventory()));
  bs.appendChild(mkBtn("새 광산 찾기", renderNewMine));
  bs.appendChild(mkBtn("설정", () => renderSettings()));
  bs.appendChild(mkBtn("저장 코드 내보내기", renderExport));
  bs.appendChild(mkBtn("계정 전환", async () => { await saveNow(true); openAccountScreen(); }));
  root.appendChild(bs);
  showOv(root);
}
export function renderSettings(note) {
  const root = el("div");
  root.appendChild(el("h2", null, "설정"));
  if (note) root.appendChild(el("p", "msg", note));
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("화면 확대: " + zoomName(), () => {
    S.zoomSel = (S.zoomSel + 1) % ZOOMS.length; lsSet("zoom", String(S.zoomSel));
    renderSettings("화면 확대를 '" + zoomName() + "'(으)로 바꿨어요");
  }));
  bs.appendChild(mkBtn("터치 감도: " + SENS_NAME[S.sensIdx], () => {
    S.sensIdx = (S.sensIdx + 1) % 3; lsSet("sens", String(S.sensIdx));
    renderSettings("터치 감도를 '" + SENS_NAME[S.sensIdx] + "'(으)로 바꿨어요");
  }));
  bs.appendChild(mkBtn("조작 도움말: " + (S.showHelp ? "켜짐" : "꺼짐"), () => {
    S.showHelp = !S.showHelp; S.helpPinned = S.showHelp;
    renderSettings(S.showHelp ? "도움말을 계속 표시해요" : "도움말을 숨겼어요");
  }));
  bs.appendChild(mkBtn("뒤로", () => renderMenu(), "pri"));
  root.appendChild(bs);
  showOv(root);
}
export function renderNewMine() {
  const root = el("div");
  root.appendChild(el("h2", null, "새 광산 찾기"));
  root.appendChild(el("p", "dim", "지금 광산(파낸 땅, 지지대, 쌓인 흙더미)은 두고 완전히 새로운 땅으로 떠나요."));
  root.appendChild(el("p", "dim", "돈 · 장비 · 소모품 · 창고 · 광물 기록은 그대로 가져갑니다. 연료는 가득 채워져요."));
  root.appendChild(el("p", "msg", "현재 광산 #" + (S.acct.mineNo || 1) + " → 새 광산 #" + ((S.acct.mineNo || 1) + 1) + " (되돌릴 수 없어요)"));
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("새 광산으로 떠나기", newMine, "pri"));
  bs.appendChild(mkBtn("취소", () => renderMenu()));
  root.appendChild(bs);
  showOv(root);
}
export async function newMine() {
  if (!S.acct) return;
  const seed = ((Math.random() * 2147483647) | 0) || 1;
  S.acct.seed = seed; S.acct.mineNo = Math.min(9999, (S.acct.mineNo || 1) + 1);
  chunks.length = 0;
  genWorld(seed);
  const d = snapshot();
  d.player = Object.assign({}, d.player, { x: 6 * T + T / 2, y: SURF * T - HH - 1, fuel: maxFuel(), layerMax: 0, facing: 1 });
  applyAccount(d);
  hideOv(); keysReset();
  await saveNow(true, true);
  say("새 광산 #" + S.acct.mineNo + " 도착! 마음껏 파 보세요");
}
export function renderStats() {
  S.invOpen = false;
  const st = S.acct.stats;
  const root = el("div", "wide");
  root.appendChild(charTabs("stat"));
  root.appendChild(el("p", "dim", S.acct.name + " 님의 기록"));
  const tb = el("table");
  const rows = [
    ["최대 깊이", (Math.floor(st.maxDepth) + 1) + " m"],
    ["총 수익", "$" + st.earned],
    ["플레이 시간", fmtTime(S.acct.playTime)],
    ["광부 레벨", "Lv." + levelOf(S.acct.xp).lv],
    ["칭호", titleName() || "없음"],
    ["현재 광산", "#" + (S.acct.mineNo || 1)],
    ["사망 횟수", st.deaths + "회"],
    ["지반 붕괴", (st.collapses || 0) + "회"],
    ["제련한 주괴", (st.smelted || 0) + "개"],
    ["용광로", "Lv." + ((S.acct.furnace && S.acct.furnace.lv) || 1)],
    ["구매한 아이템", Object.keys(P.items).filter((id) => !ITEMS[id].craft).length + " / " + Object.keys(ITEMS).filter((id) => !ITEMS[id].craft && !ITEMS[id].cons).length],
    ["제작한 장비", Object.keys(P.items).filter((id) => ITEMS[id].craft).length + " / " + Object.keys(ITEMS).filter((id) => ITEMS[id].craft).length],
    ["흙 채굴", (st.mined[1] || 0) + "개"],
  ];
  for (const id of ORE_IDS) rows.push([TILE[id].name + " 채굴", (st.mined[id] || 0) + "개"]);
  for (const r of rows) {
    const tr = el("tr");
    tr.appendChild(el("td", null, r[0]));
    tr.appendChild(el("td", null, r[1]));
    tb.appendChild(tr);
  }
  root.appendChild(tb);
  charFooter(root);
  showOv(root);
}
export function renderExport() {
  saveNow(true);
  const code = exportCode(snapshot());
  const root = el("div");
  root.appendChild(el("h2", null, "저장 코드"));
  root.appendChild(el("p", "dim", "다른 기기나 브라우저의 계정 선택 화면에서 이 코드를 붙여넣으면 진행을 가져올 수 있어요."));
  const ta = document.createElement("textarea");
  ta.readOnly = true; ta.value = code;
  root.appendChild(ta);
  const msgEl = el("p", "msg", "");
  root.appendChild(msgEl);
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("복사", async () => {
    try { await navigator.clipboard.writeText(code); msgEl.textContent = "복사했어요"; }
    catch (e) { ta.focus(); ta.select(); msgEl.textContent = "선택했어요. 길게 눌러 복사하세요"; }
  }, "pri"));
  bs.appendChild(mkBtn("뒤로", () => renderMenu()));
  root.appendChild(bs);
  showOv(root);
}

{ const raw = lsGet("sens"), v = raw === null ? -1 : Number(raw); if (v === 0 || v === 1 || v === 2) S.sensIdx = v; }
{ const raw = lsGet("zoom"), v = raw === null ? -1 : Number(raw); if (Number.isInteger(v) && v >= 0 && v < ZOOMS.length) S.zoomSel = v; }
// 탭을 닫거나 숨길 때 마지막으로 저장
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(true); });
addEventListener("pagehide", () => saveNow(true));

