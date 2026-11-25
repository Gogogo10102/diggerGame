import "./menu.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { S } from "../core/state.ts";
import { MOVE, MOVE_DEF } from "../systems/update.ts";

// =====================================================================
//  움직임 조절판 (개발·실험용): 걷기·비행 숫자(MOVE)를 게임 안에서 슬라이더로 바꿔 봄
//  여는 법: 주소 끝에 ?tune  또는  ` 키(숫자 1 왼쪽). 바꾼 값은 이 브라우저에만 남고, 조절판을 열 때만 적용됨
//  마음에 드는 값이 나오면 [값 복사] → 붙여 넣어 전달 → update.ts 의 MOVE 기본값으로 확정
// =====================================================================
type TuneRow = [key: string, label: string, min: number, max: number, step: number];
const TUNE_SPEC: [string, TuneRow[]][] = [
  ["사람 걷기", [
    ["hSpeed", "걷기 속도", 80, 260, 5],
    ["hAccT", "출발 시간(초)", 0, 0.6, 0.02],
    ["hStopT", "멈춤 시간(초)", 0, 0.6, 0.02],
    ["hStride", "걷기 한 바퀴(px)", 30, 160, 2],
  ]],
  ["로봇 걷기", [
    ["mSpeed", "기본 속도", 100, 320, 5],
    ["mAccT", "출발 시간(초)", 0, 0.8, 0.02],
    ["mStopT", "멈춤 시간(초)", 0, 0.8, 0.02],
    ["mStride", "걷기 한 바퀴(px)", 60, 260, 2],
    ["mShake", "발걸음 흔들림(px)", 0, 6, 1],
  ]],
  ["공중", [
    ["airCtl", "공중 좌우 조작(배)", 0.2, 1.5, 0.05],
    ["grav", "중력", 400, 1600, 20],
    ["fallMax", "최대 낙하 속도", 200, 800, 10],
  ]],
  ["사람 백팩 로켓", [
    ["rAcc", "가속(× 로켓)", 300, 3000, 50],
    ["rMax", "최고 상승(× 로켓)", 80, 400, 10],
    ["rCap", "상승 상한", 120, 600, 10],
  ]],
  ["로봇 추진", [
    ["mAcc", "가속(× 엔진)", 300, 3000, 50],
    ["mMax", "최고 상승", 120, 480, 10],
    ["mCap", "상승 상한", 160, 700, 10],
  ]],
];
const TUNE_KEY = "dd_tune";
const tuneVals = MOVE as unknown as Record<string, number>;
const tuneDefs = MOVE_DEF as unknown as Record<string, number>;
let tuneBox: HTMLDivElement | null = null;

function tuneSave() {
  const diff: Record<string, number> = {};
  for (const k in tuneDefs) if (tuneVals[k] !== tuneDefs[k]) diff[k] = tuneVals[k];
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(diff)); } catch (e) { /* 저장 못 해도 지금 판에는 적용됨 */ }
  return diff;
}
function tuneLoad() {
  try {
    const d = JSON.parse(localStorage.getItem(TUNE_KEY) || "{}");
    for (const k in d) if (k in tuneDefs && typeof d[k] === "number") tuneVals[k] = d[k];
  } catch (e) { /* 저장값이 없거나 깨졌으면 기본값 */ }
}
const tuneFmt = (v: number, step: number) => (step < 1 ? v.toFixed(2) : String(Math.round(v)));

function tuneBuild() {
  const box = document.createElement("div");
  box.id = "tune";
  box.style.cssText = "position:fixed;left:8px;top:112px;z-index:30;width:280px;max-height:calc(100vh - 120px);overflow:auto;" +
    "background:rgba(27,29,35,.94);border:2px solid #0b0c0f;box-shadow:0 0 0 2px #4c5362;color:#e6eaf2;" +
    "font:12px var(--font-s);padding:8px 10px;touch-action:auto;-webkit-user-select:none;user-select:none";
  // 조절판을 만지는 동안 게임 조작(방향키·드래그)이 같이 움직이지 않게
  for (const ev of ["keydown", "keyup", "pointerdown", "pointermove", "pointerup", "wheel"]) box.addEventListener(ev, (e) => e.stopPropagation());
  const head = document.createElement("div");
  head.style.cssText = "font:16px var(--font-m);color:#ffc21a;margin-bottom:4px";
  head.textContent = "움직임 조절판";
  box.appendChild(head);
  const note = document.createElement("div");
  note.style.cssText = "color:#9aa3b8;margin-bottom:6px;line-height:1.4";
  note.textContent = "바꾸면 바로 적용돼요 · ` 키로 열고 닫기";
  box.appendChild(note);
  for (const [group, rows] of TUNE_SPEC) {
    const g = document.createElement("div");
    g.style.cssText = "margin:8px 0 2px;color:#ffa82a";
    g.textContent = group;
    box.appendChild(g);
    for (const [k, label, min, max, step] of rows) {
      const row = document.createElement("label");
      row.style.cssText = "display:grid;grid-template-columns:1fr 44px;gap:0 6px;align-items:center;margin:2px 0";
      const name = document.createElement("span");
      name.textContent = label;
      const val = document.createElement("span");
      val.style.cssText = "text-align:right;color:#fff";
      const inp = document.createElement("input");
      inp.type = "range"; inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(tuneVals[k]); inp.dataset.k = k;
      inp.style.cssText = "grid-column:1 / 3;width:100%;margin:0;accent-color:#ffc21a";
      const show = () => {
        val.textContent = tuneFmt(tuneVals[k], step);
        val.style.color = tuneVals[k] !== tuneDefs[k] ? "#ffc21a" : "#fff";   // 기본값에서 바뀐 값은 노랗게
      };
      inp.addEventListener("input", () => { tuneVals[k] = +inp.value; show(); tuneSave(); });
      show();
      row.append(name, val, inp);
      box.appendChild(row);
    }
  }
  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:6px;margin-top:10px";
  const mk = (txt: string, col: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = txt;
    b.style.cssText = `flex:1;font:12px var(--font-s);color:#1b1d23;background:#a6aebc;border:2px solid #0b0c0f;border-left:6px solid ${col};padding:6px 4px;cursor:pointer`;
    b.addEventListener("click", fn);
    btns.appendChild(b);
    return b;
  };
  mk("기본값", "#ffa82a", () => { Object.assign(tuneVals, tuneDefs); tuneSave(); tuneRebuild(); });
  const copyBtn = mk("값 복사", "#40c4f0", () => {
    const txt = JSON.stringify(tuneSave());
    const done = () => { copyBtn.textContent = "복사됨"; setTimeout(() => { copyBtn.textContent = "값 복사"; }, 1200); };
    try { navigator.clipboard.writeText(txt).then(done, () => prompt("이 값을 복사해 주세요", txt)); }
    catch (e) { prompt("이 값을 복사해 주세요", txt); }
  });
  mk("닫기", "#f2606e", () => closeTune());
  box.appendChild(btns);
  return box;
}
function tuneRebuild() { if (!tuneBox) return; tuneBox.remove(); tuneBox = tuneBuild(); document.body.appendChild(tuneBox); }

export function openTune() {
  if (tuneBox) return;
  tuneLoad();
  tuneBox = tuneBuild();
  document.body.appendChild(tuneBox);
}
export function closeTune() { if (tuneBox) { tuneBox.remove(); tuneBox = null; } }

// ` 키는 input.ts 의 keydown 이 S.toggleTune 을 부름 (keydown 듣는 곳을 하나로)
S.toggleTune = () => { if (tuneBox) closeTune(); else openTune(); };
try { if (/[?&]tune\b/.test(location.search)) openTune(); } catch (e) { /* 테스트 환경 등 location 이 없을 때 */ }
