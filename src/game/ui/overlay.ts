// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../save/transfer.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { S } from "../core/state.ts";
import { createAccount, loginAccount } from "../save/account.ts";
import { importAccount } from "../save/transfer.ts";
import { keys, touch } from "../systems/input.ts";
import { SaveStore } from "./inventory.ts";

// ---- 오버레이 UI (DOM) ----
export const ov = document.createElement("div");
ov.id = "ov";
document.body.appendChild(ov);
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
export function mkBtn(text, fn, cls) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), text);
  b.addEventListener("click", fn);
  return b;
}
export function showOv(root) {
  while (ov.firstChild) ov.removeChild(ov.firstChild);
  const p = el("div", "pnl" + (String(root.className || "").indexOf("wide") >= 0 ? " wide" : ""));
  p.appendChild(root);
  ov.appendChild(p);
  ov.classList.add("on");
}
export function hideOv() { ov.classList.remove("on"); }
export function keysReset() {
  for (const k in keys) keys[k] = false;
  S.stick = null; touch.l = touch.r = touch.u = touch.d = false;
}
export function fmtTime(sec) {
  const m = Math.floor((sec || 0) / 60), h = Math.floor(m / 60);
  return h > 0 ? h + "시간 " + (m % 60) + "분" : m + "분";
}
export function fmtDate(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, "0");
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

export async function openAccountScreen(note) {
  S.state = "account"; S.acct = null; keysReset();
  const list = await SaveStore.list();
  if (S.state !== "account") return;
  const root = el("div");
  root.appendChild(el("h2", null, "계정 선택"));
  if (!S.storageOK) root.appendChild(el("p", "warn", "이 브라우저는 저장소를 쓸 수 없어 진행이 저장되지 않을 수 있어요."));
  if (note) root.appendChild(el("p", "msg", note));
  if (list.length === 0) root.appendChild(el("p", "dim", "아직 계정이 없어요. 이름을 정해 새 계정을 만들어 보세요."));
  for (const a of list) {
    const row = el("div", "row");
    const info = el("div", "info");
    info.appendChild(el("div", "nm", a.name));
    info.appendChild(el("div", "dim", "최대 " + (Math.floor(a.maxDepth || 0) + 1) + "m · " + fmtTime(a.playTime) + " · " + fmtDate(a.updated || 0)));
    row.appendChild(info);
    row.appendChild(mkBtn("시작", () => loginAccount(a.id), "pri"));
    let armed = false, timer = 0;
    const del = mkBtn("삭제", async () => {                // 두 번 눌러야 삭제
      if (!armed) {
        armed = true; del.textContent = "정말?";
        timer = setTimeout(() => { armed = false; del.textContent = "삭제"; }, 3000);
        return;
      }
      clearTimeout(timer);
      await SaveStore.remove(a.id);
      openAccountScreen("'" + a.name + "' 계정을 삭제했어요");
    }, "del");
    row.appendChild(del);
    root.appendChild(row);
  }

  // 새 계정
  const nameInp = document.createElement("input");
  nameInp.type = "text"; nameInp.maxLength = 12; nameInp.placeholder = "새 계정 이름 (최대 12자)";
  const errEl = el("p", "warn", "");
  const doCreate = async () => { const err = await createAccount(nameInp.value); if (err) errEl.textContent = err; };
  nameInp.addEventListener("keydown", (e) => { if (e.key === "Enter") doCreate(); });
  root.appendChild(nameInp);
  root.appendChild(errEl);
  const bs = el("div", "btns");
  bs.appendChild(mkBtn("계정 만들기", doCreate, "pri"));

  // 저장 코드로 가져오기
  const impBox = el("div");
  bs.appendChild(mkBtn("저장 코드로 불러오기", () => {
    while (impBox.firstChild) impBox.removeChild(impBox.firstChild);
    const ta = document.createElement("textarea");
    ta.placeholder = "내보낸 저장 코드를 붙여넣으세요";
    const impErr = el("p", "warn", "");
    impBox.appendChild(ta);
    impBox.appendChild(impErr);
    impBox.appendChild(mkBtn("가져오기", async () => {
      try {
        const d = await importAccount(ta.value);
        openAccountScreen("'" + d.name + "' 계정을 가져왔어요");
      } catch (e) { impErr.textContent = e.message || "가져오기에 실패했어요"; }
    }, "pri"));
  }));
  root.appendChild(bs);
  root.appendChild(impBox);
  root.appendChild(el("p", "dim", "저장 위치: 이 기기의 브라우저. 계정 이름만으로 접근하며 비밀번호는 없어요."));
  showOv(root);
  if (list.length === 0) nameInp.focus();
}

