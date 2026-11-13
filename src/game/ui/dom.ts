// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../data/progress.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { QUESTS, titleName } from "../data/progress.ts";
import { saveNow } from "../save/account.ts";
import { renderInventory } from "./inventory.ts";
import { closeMenu, renderMenu, renderStats } from "./menu.ts";
import { el, keysReset, mkBtn, showOv } from "./overlay.ts";

// ---- DOM 도우미 (아이템 이미지를 그대로 사용) ----
export function iconEl(spr, size) {
  const c = document.createElement("canvas");
  c.width = spr.width || 16; c.height = spr.height || 16; c.className = "ico";      // 그림 파일 크기가 달라도 그대로
  c.style.width = c.style.height = (size || 40) + "px";
  c.getContext("2d").drawImage(spr, 0, 0);
  return c;
}
export function barEl(ratio, color) {
  const b = el("div", "bar"), f = el("div", "fill");
  f.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + "%"; if (color) f.style.background = color;
  b.appendChild(f); return b;
}
// 캐릭터 창 탭 (장비 · 업적 · 통계) + 닫기
export function charTabs(active) {
  const bar = el("div", "tabs");
  for (const [k, label, fn] of [["inv", "장비", () => renderInventory()], ["quest", "업적", () => renderQuests()], ["stat", "통계", () => renderStats()]]) {
    bar.appendChild(mkBtn(label, fn, "tab" + (k === active ? " on" : "")));
  }
  bar.appendChild(mkBtn("✕", closeMenu, "tab x"));
  return bar;
}
export function charFooter(root) {
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("닫기", closeMenu, "pri"));
  bs.appendChild(mkBtn("뒤로", () => renderMenu()));
  root.appendChild(bs);
}
export function renderQuests(note) {
  S.invOpen = false;
  const root = el("div", "wide");
  root.appendChild(charTabs("quest"));
  const done = QUESTS.filter((q) => S.acct.quest[q.id]).length;
  root.appendChild(el("p", "dim", "달성 " + done + " / " + QUESTS.length + "  ·  현재 칭호: " + (titleName() || "없음")));
  if (note) root.appendChild(el("p", "msg", note));
  root.appendChild(el("p", "msg", "진행 중"));
  const groups = [];
  for (const q of QUESTS) if (!groups.includes(q.group)) groups.push(q.group);
  for (const g of groups) {
    const q = QUESTS.find((x) => x.group === g && !S.acct.quest[x.id]);
    if (!q) continue;
    const have = Math.min(q.need, Math.floor(q.get()));
    const row = el("div", "row"), info = el("div", "info");
    const nTxt = q.need.toLocaleString();
    info.appendChild(el("div", "nm", q.group === "depth" ? "깊이 " + nTxt + "m 도달" : q.group === "craft" ? "장비 " + nTxt + "개 제작" : q.group === "earn" ? "누적 수익 $" + nTxt : q.group === "types" ? "광물 " + nTxt + "종 채굴" : q.unit + " " + nTxt + "개"));
    info.appendChild(barEl(have / q.need, "#7cff6b"));
    info.appendChild(el("div", "dim sm", have.toLocaleString() + " / " + q.need.toLocaleString() + "   칭호 「" + q.title + "」  보상 $" + q.money.toLocaleString()));
    row.appendChild(info);
    root.appendChild(row);
  }
  root.appendChild(el("p", "msg", "획득한 칭호 (눌러서 착용)"));
  const wrap = el("div", "btns");
  const have = QUESTS.filter((q) => S.acct.quest[q.id]);
  if (!have.length) wrap.appendChild(el("p", "dim", "아직 없어요. 광물을 캐 보세요!"));
  for (const q of have) wrap.appendChild(mkBtn(q.title + (S.acct.title === q.id ? " ✔" : ""), () => { S.acct.title = S.acct.title === q.id ? "" : q.id; saveNow(true, true); renderQuests(S.acct.title ? "「" + q.title + "」 칭호를 착용했어요" : "칭호를 해제했어요"); }, S.acct.title === q.id ? "pri" : ""));
  root.appendChild(wrap);
  charFooter(root);
  showOv(root);
}
export function openQuests() { if (S.state !== "play" || !S.acct || P.dead > 0) return; S.state = "menu"; keysReset(); renderQuests(); }

