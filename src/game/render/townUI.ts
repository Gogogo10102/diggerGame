// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./draw.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { TAB_IMG, fxText } from "../art/buildings.ts";
import { itemIcon } from "../art/itemIcons.ts";
import { ICON, oreIcon } from "../art/sprites.ts";
import { TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { SHOP_PER } from "../core/stats.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { ctx, keycap, panel, pbar, setFont, txt } from "./util.ts";
import { BARS, BAR_KEYS, FURNACE_LV, ORE_PER_BAR, barIcon, furnaceCan, matHave, matIcon, matName } from "../systems/furnace.ts";
import { TOWN, shopBtn, townActive } from "../systems/input.ts";
import { SELL_COLS, SELL_KEYS, stashValue, unitPrice } from "../systems/town.ts";

// =====================================================================
//  마을 창 (상점 · 제작 · 용광로 · 판매)
//   네 탭이 모두 같은 틀을 씁니다.
//     ┌ 폴더 탭 ─────────────── [X] ┐
//     │ 제목                     $돈 │  ← 머리글
//     │ 본문 (목록/트리/칸)          │  ← 하나를 고르면
//     │ ┌ 상세 칸: 설명 + 실행 버튼 ┐ │  ← 여기에 설명과 버튼이 나옴
//     └─────────────────────────────┘
//   글자 크기는 12 / 16 / 32 만 씁니다 (util.ts 의 글꼴 설명 참고).
// =====================================================================
export const TC = {
  ink: "#14151f", line: "#6b7399", body: "#2b2f45", well: "#1b1d2c",
  tabOff: "#3a3f5e", tabOffHi: "#4a5070",
  dim: "#9aa3c8", mute: "#7a82a6", gold: "#ffd34d", green: "#7cff6b", red: "#ff6b6b", warn: "#ff9a90", blue: "#8fd3ff",
  row: "rgba(255,255,255,0.05)", sel: "rgba(255,255,255,0.14)",
};

// 도트 그림을 정수 배율로만 키워서 칸(box) 가운데에 그림. 1.5배처럼 어중간하게 키우면 픽셀 크기가 들쭉날쭉해짐
export function drawPx(img, x, y, box, alpha) {
  if (!img || !img.width) return;
  const s = Math.max(1, Math.floor(box / Math.max(img.width, img.height)));
  const w = img.width * s, h = img.height * s;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x + (box - w) / 2), Math.round(y + (box - h) / 2), w, h);
  ctx.globalAlpha = 1;
}

// 글자가 칸보다 길면 … 으로 줄임
export function fitText(s, maxW, size) {
  setFont(size || 16);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}

// 버튼. kind: go(초록) gold(노랑) plain(파랑) danger(빨강). 꺼져 있어도 누르면 동작을 부름 → "돈이 부족해요" 같은 안내가 나옴
const BTN_COL = {
  go: ["#3fbf55", "#7cff6b", "#ffffff"], gold: ["#f2b82e", "#fff3a8", "#14151f"],
  plain: ["#4a5280", "#6b7399", "#ffffff"], danger: ["#b8392e", "#ff7a6b", "#ffffff"],
  off: ["#353a52", "#454b68", "#7a82a6"],
};
export function uiBtn(x: number, y: number, w: number, h: number, label: string, sub: string | null, kind: string, on: boolean, act?: string | null, arg?: any) {
  const c = BTN_COL[on ? kind : "off"], noSh = c[2] === "#14151f" ? "rgba(0,0,0,0)" : undefined;
  ctx.fillStyle = TC.ink; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c[0]; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = c[1]; ctx.fillRect(x + 3, y + 3, w - 6, 3);
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x + 3, y + h - 6, w - 6, 3);
  if (sub && h >= 40) {
    const t = y + Math.floor((h - 30) / 2);
    txt(fitText(label, w - 8, 16), x + w / 2, t, c[2], 16, "center", noSh);
    txt(fitText(sub, w - 8, 12), x + w / 2, t + 18, c[2], 12, "center", noSh);
  } else txt(fitText(label, w - 8, 16), x + w / 2, y + Math.floor((h - 16) / 2), c[2], 16, "center", noSh);
  if (act) shopBtn.push({ x, y, w, h, act, arg });
}

// 공용 틀: 탭 + 머리글 + 아래 상세 칸을 그리고, 본문(c*)과 상세 칸(f*) 자리를 돌려줌
//   fhWide / fhNarrow: 상세 칸 높이 (좁은 화면은 버튼이 글 아래 줄로 내려가서 더 높음)
export function townFrame(vw, vh, title, fhWide, fhNarrow, hint) {
  ctx.fillStyle = "rgba(14,15,23,0.75)"; ctx.fillRect(0, 0, vw, vh);
  const narrow = vw < 540;
  const w = Math.min(640, vw - 16), h = Math.min(narrow ? 580 : 480, vh - 16);
  const short = h < 420;
  const x = Math.floor((vw - w) / 2), y = Math.floor((vh - h) / 2);
  S.shopRect = { x, y, w, h };
  const TH = short ? 36 : 40, by = y + TH;
  panel(x, by, w, h - TH);

  // 탭: 고른 탭은 본문과 이어진 폴더 모양, 나머지는 한 단 낮고 어둡게
  const act = townActive(), n = TOWN.length, gap = 4, closeW = TH;
  const tw = Math.floor((w - 16 - closeW - gap * n) / n);
  TOWN.forEach(([k, label, ic], i) => {
    const tx = x + 8 + i * (tw + gap), on = k === act;
    let top, inner;
    if (on) {
      ctx.fillStyle = TC.ink; ctx.fillRect(tx, y, tw, TH + 3);
      ctx.fillStyle = TC.line; ctx.fillRect(tx + 3, y + 3, tw - 6, TH + 3);
      ctx.fillStyle = TC.body; ctx.fillRect(tx + 6, y + 6, tw - 12, TH + 3);
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(tx + 6, y + 6, tw - 12, 3);
      top = y + 6; inner = TH - 6;
    } else {
      ctx.fillStyle = TC.ink; ctx.fillRect(tx, y + 6, tw, TH - 6);
      ctx.fillStyle = TC.tabOff; ctx.fillRect(tx + 3, y + 9, tw - 6, TH - 12);
      ctx.fillStyle = TC.tabOffHi; ctx.fillRect(tx + 3, y + 9, tw - 6, 3);
      top = y + 9; inner = TH - 12;
    }
    const img = TAB_IMG[k + (on ? "_on" : "_off")];
    if (img && img.width > 1 && img.width <= tw - 8) {             // 탭 이름은 그림으로 박아 둔 로고 (글꼴 영향 없음)
      ctx.drawImage(img, tx + Math.floor((tw - img.width) / 2), top + Math.floor((inner - img.height) / 2) + 1);
    } else {                                                        // 그림이 없거나 칸이 좁으면 글자로
      setFont(16);
      const lw = Math.ceil(ctx.measureText(label).width), showIc = tw >= lw + 44;
      const total = lw + (showIc ? 22 : 0), sx = tx + Math.floor((tw - total) / 2), ty = top + Math.floor((inner - 16) / 2) + 1;
      if (showIc) drawPx(ICON[ic], sx, ty, 16, on ? 1 : 0.7);
      txt(label, sx + (showIc ? 22 : 0), ty, on ? TC.gold : TC.dim, 16);
    }
    shopBtn.push({ x: tx, y, w: tw, h: TH, act: "town", arg: k });
  });
  // 닫기
  const cx = x + w - 8 - closeW;
  ctx.fillStyle = TC.ink; ctx.fillRect(cx, y + 6, closeW, TH - 6);
  ctx.fillStyle = "#b8392e"; ctx.fillRect(cx + 3, y + 9, closeW - 6, TH - 12);
  ctx.fillStyle = "#ff7a6b"; ctx.fillRect(cx + 3, y + 9, closeW - 6, 3);
  txt("X", cx + closeW / 2, y + 9 + Math.floor((TH - 12 - 16) / 2) + 1, "#fff", 16, "center");
  shopBtn.push({ x: cx, y, w: closeW, h: TH, act: "close" });

  // 머리글: 제목(왼쪽) · 돈(오른쪽)
  const hy = by + (short ? 13 : 17);
  setFont(16);
  const ms = "$" + P.money, mw = Math.ceil(ctx.measureText(ms).width);
  txt(ms, x + w - 20, hy, TC.gold, 16, "right");
  drawPx(ICON.coin, x + w - 20 - mw - 22, hy, 16);
  txt(fitText(title, w - 80 - mw, 16), x + 20, hy, "#fff", 16);
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 12, hy + 25, w - 24, 2);
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(x + 12, hy + 27, w - 24, 1);

  // 키 안내는 창 밖 아래에 작게 (자리가 있을 때만)
  if (hint && !S.usedTouch && vh - (y + h) >= 20) txt(hint, x + w, y + h + 6, TC.mute, 12, "right");

  // 상세 칸
  const fh = narrow ? fhNarrow : short ? fhWide - 8 : fhWide;
  const fy = y + h - (short ? 10 : 12) - fh;
  ctx.fillStyle = TC.ink; ctx.fillRect(x + 12, fy, w - 24, fh);
  ctx.fillStyle = TC.well; ctx.fillRect(x + 14, fy + 2, w - 28, fh - 4);
  const cy = hy + (short ? 34 : 40);
  return { x, y, w, h, narrow, short, cx: x + 14, cy, cw: w - 28, ch: fy - (short ? 8 : 10) - cy, fx: x + 14, fy, fw: w - 28, fh };
}

// 상세 칸 채우기: 왼쪽에 글 줄들, 오른쪽(좁은 화면은 아래 줄)에 버튼들
//   lines: [[글, 색, 크기]]   btns: [{label, sub, kind, on, act, arg, w}]
export function townFooter(f, lines, btns) {
  const bh = f.short ? 40 : 44, gap = 6;
  let textW, maxY = f.fy + f.fh;
  if (f.narrow) {
    const by = f.fy + f.fh - bh - 8, free = f.fw - 16 - gap * (btns.length - 1);
    const tot = btns.reduce((a, b) => a + (b.w || 80), 0);
    let bx = f.fx + 8;
    btns.forEach((b, i) => {
      const bw = i === btns.length - 1 ? f.fx + f.fw - 8 - bx : Math.floor((b.w || 80) * free / tot);
      uiBtn(bx, by, bw, bh, b.label, b.sub, b.kind, b.on, b.act, b.arg); bx += bw + gap;
    });
    textW = f.fw - 20; maxY = by - 4;
  } else {
    const tot = btns.reduce((a, b) => a + (b.w || 80), 0) + gap * Math.max(0, btns.length - 1);
    const by = f.fy + Math.floor((f.fh - bh) / 2);
    let bx = f.fx + f.fw - 10 - tot;
    for (const b of btns) { uiBtn(bx, by, b.w || 80, bh, b.label, b.sub, b.kind, b.on, b.act, b.arg); bx += (b.w || 80) + gap; }
    textW = f.fw - 30 - tot;
  }
  let ty = f.fy + (f.short ? 9 : 11);
  for (const [s, col, size] of lines) {
    if (ty + (size || 16) > maxY) break;                          // 자리가 모자라면 아래 줄은 생략
    if (s) txt(fitText(s, textW, size || 16), f.fx + 10, ty, col || "#fff", size || 16);
    ty += (size || 16) <= 12 ? 18 : 22;
  }
  return { tx: f.fx + 10, ty, textW };
}

// 본문 위쪽 분류 탭(아이콘만). 높이를 돌려줌
function townCats(f, list, selI) {
  const n = list.length, catH = f.short ? 32 : 40, tw = Math.floor(f.cw / n), box = catH - 8 >= 32 ? 32 : 16;
  for (let i = 0; i < n; i++) {
    const tx = f.cx + i * tw, sel = i === selI;
    ctx.fillStyle = TC.ink; ctx.fillRect(tx, f.cy, tw - 2, catH);
    ctx.fillStyle = sel ? "#4a5280" : "#23263a"; ctx.fillRect(tx + 2, f.cy + 2, tw - 6, catH - 4);
    if (sel) { ctx.fillStyle = TC.gold; ctx.fillRect(tx + 2, f.cy + catH - 5, tw - 6, 3); }
    drawPx(ICON[list[i].icon], tx + Math.floor((tw - 2 - box) / 2), f.cy + Math.floor((catH - box) / 2) - (sel ? 1 : 0), box, sel ? 1 : 0.55);
    shopBtn.push({ x: tx, y: f.cy, w: tw - 2, h: catH, act: "tab", arg: i });
  }
  return catH;
}

// 목록 한 줄의 바탕 (고른 줄은 밝게 + 왼쪽 노란 막대)
function townRow(x, y, w, h, sel) {
  ctx.fillStyle = sel ? TC.sel : TC.row; ctx.fillRect(x, y, w, h);
  if (sel) { ctx.fillStyle = TC.gold; ctx.fillRect(x, y, 3, h); }
}

// ---------------------------------------------------------------------
//  상점 (드릴·연료통 등 장비 + 소모품)
// ---------------------------------------------------------------------
export function drawShopModal(vw, vh) {
  const cat = CATS[S.shopTab];
  const f = townFrame(vw, vh, "상점 · " + cat.name, 84, 130, "[ ] 건물 이동 · ←→ 분류 · ↑↓ 고르기 · Enter 구매 · Esc 닫기");
  const catH = townCats(f, CATS, S.shopTab);

  const len = cat.ids.length, pages = Math.ceil(len / SHOP_PER), page = Math.floor(S.shopSel / SHOP_PER);
  const pagerH = pages > 1 ? 30 : 0;
  const ly = f.cy + catH + 8, lh = f.cy + f.ch - ly - pagerH;
  const rh = Math.max(34, Math.min(54, Math.floor(lh / SHOP_PER))), inner = rh - 4;
  for (let k = 0; k < SHOP_PER; k++) {
    const i = page * SHOP_PER + k;
    if (i >= len) break;
    const id = cat.ids[i], it = ITEMS[id], ry = ly + k * rh;
    const owned = !it.cons && !!P.items[id];
    const locked = !it.cons && !owned && !!it.req && !P.items[it.req];
    townRow(f.cx, ry, f.cw, inner, i === S.shopSel);
    let lx = f.cx + 10;
    if (!S.usedTouch) { keycap(lx, ry + Math.floor((inner - 26) / 2), String(k + 1)); lx += 36; }
    const ib = inner >= 36 ? 32 : 16;
    drawPx(itemIcon(id), lx, ry + Math.floor((inner - ib) / 2), ib, locked ? 0.35 : 1); lx += ib + 12;
    // 오른쪽: 가격 / 보유 / 잠김
    const right = f.cx + f.cw - 12;
    let rTxt, rCol;
    if (owned) { rTxt = "보유"; rCol = TC.blue; }
    else if (locked) { rTxt = "잠김"; rCol = TC.mute; }
    else { rTxt = "$" + it.cost; rCol = P.money >= it.cost ? TC.green : TC.red; }
    setFont(16); const rw = Math.ceil(ctx.measureText(rTxt).width);
    const nameW = right - rw - 16 - lx;
    const sub = locked ? "필요: " + ITEMS[it.req].name : it.cons ? it.desc : fxText(it.fx);
    if (inner >= 34) {
      const t = ry + Math.floor((inner - 32) / 2);
      txt(fitText(it.name, nameW, 16), lx, t, locked ? TC.mute : "#fff", 16);
      txt(fitText(sub, nameW, 12), lx, t + 19, locked ? TC.mute : TC.dim, 12);
    } else txt(fitText(it.name, nameW, 16), lx, ry + Math.floor((inner - 16) / 2), locked ? TC.mute : "#fff", 16);
    txt(rTxt, right, ry + Math.floor((inner - 16) / 2), rCol, 16, "right");
    if (it.cons && inner >= 34) txt("x" + (P.inv[id] || 0), right, ry + Math.floor((inner - 16) / 2) + 17, TC.blue, 12, "right");
    shopBtn.push({ x: f.cx, y: ry, w: f.cw, h: inner, act: "sel", i });
  }
  if (pages > 1) {                                                 // 쪽 넘기기
    const py = f.cy + f.ch - 26, mid = f.cx + Math.floor(f.cw / 2);
    uiBtn(mid - 76, py, 44, 26, "<", null, "plain", page > 0, "page", -1);
    txt((page + 1) + " / " + pages, mid, py + 7, TC.dim, 12, "center");
    uiBtn(mid + 32, py, 44, 26, ">", null, "plain", page < pages - 1, "page", 1);
  }

  // 상세 칸
  const id = cat.ids[Math.min(S.shopSel, len - 1)], it = ITEMS[id];
  const owned = !it.cons && !!P.items[id];
  const locked = !it.cons && !owned && !!it.req && !P.items[it.req];
  const head = it.name + (it.cons ? "  (보유 " + (P.inv[id] || 0) + "개)" : owned ? "  (보유 중)" : "");
  const note = S.msgT > 0 ? [S.msg, TC.gold, 12] : locked ? ["먼저 " + ITEMS[it.req].name + "을(를) 사야 해요", TC.warn, 12] : ["", 0, 12];
  const btn = owned ? { label: "보유 중", kind: "plain", on: false, w: 96 }
    : locked ? { label: "잠김", sub: "$" + it.cost, kind: "go", on: false, act: "buy", arg: id, w: 96 }
    : { label: "구매", sub: "$" + it.cost, kind: "go", on: P.money >= it.cost, act: "buy", arg: id, w: 96 };
  townFooter(f, [[head, "#fff", 16], [it.cons ? it.desc : fxText(it.fx), TC.dim, 12], note], [btn]);
}

// ---------------------------------------------------------------------
//  제작소 (제작 트리) — 판매 탭도 같은 상태(craft)를 써서 여기서 나눠 그림
// ---------------------------------------------------------------------
export function drawCraftModal(vw, vh) {
  if (S.craftTab === RECIPE_CATS.length) return drawSellModal(vw, vh);
  const cat = RECIPE_CATS[S.craftTab];
  const f = townFrame(vw, vh, "제작소 · " + cat.name + " 제작 트리", 92, 140, "[ ] 건물 이동 · Tab 분류 · 방향키 고르기 · Enter 제작 · Esc 닫기");
  const catH = townCats(f, RECIPE_CATS, S.craftTab);
  const stat = (id) => {
    const it = ITEMS[id], owned = !!P.items[id];
    const locked = !owned && !!it.req && !P.items[it.req];
    const mats = Object.keys(it.mats).every((m) => matHave(m) >= it.mats[m]);
    return { owned, locked, mats, can: !owned && !locked && mats && P.money >= it.cost };
  };
  // 트리
  const areaY = f.cy + catH + 8, treeH = f.cy + f.ch - areaY, rowsN = Math.max(3, cat.rows);
  const rowH = Math.floor(treeH / rowsN), nb = Math.max(30, Math.min(52, rowH - 8));
  const colW = cat.cols > 1 ? Math.min(150, Math.floor((f.cw - 24 - nb) / (cat.cols - 1))) : 0;
  const treeW = nb + colW * (cat.cols - 1), ox = f.cx + Math.floor((f.cw - treeW) / 2), oy = areaY + Math.floor((treeH - rowH * cat.rows) / 2);
  const pos = {};
  cat.nodes.forEach((n) => { pos[n.id] = { x: ox + n.col * colW, y: oy + n.row * rowH + Math.floor((rowH - nb) / 2) }; });
  for (const n of cat.nodes) {                                      // 연결선
    if (!n.req) continue;
    const a = pos[n.req], b = pos[n.id], mx = Math.floor((a.x + nb + b.x) / 2);
    ctx.fillStyle = P.items[n.req] ? TC.blue : "#4a5070";
    ctx.fillRect(a.x + nb, a.y + (nb >> 1) - 1, mx - a.x - nb + 1, 3);
    ctx.fillRect(mx, Math.min(a.y, b.y) + (nb >> 1) - 1, 3, Math.abs(a.y - b.y) + 3);
    ctx.fillRect(mx, b.y + (nb >> 1) - 1, b.x - mx, 3);
  }
  for (const n of cat.nodes) {                                      // 노드
    const id = n.id, st = stat(id), p0 = pos[id], sel = n.i === S.craftSel;
    ctx.fillStyle = sel ? "#ffffff" : TC.ink; ctx.fillRect(p0.x - 3, p0.y - 3, nb + 6, nb + 6);
    ctx.fillStyle = st.owned ? "#2f6b45" : st.locked ? "#23263a" : st.can ? "#6b5a1e" : "#4a3a44"; ctx.fillRect(p0.x, p0.y, nb, nb);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(p0.x, p0.y, nb, 3);
    drawPx(itemIcon(id), p0.x + 4, p0.y + 4, nb - 8, st.locked ? 0.35 : 1);
    if (st.owned) { ctx.fillStyle = TC.green; ctx.fillRect(p0.x + nb - 12, p0.y + 3, 3, 3); ctx.fillRect(p0.x + nb - 9, p0.y + 6, 3, 3); ctx.fillRect(p0.x + nb - 6, p0.y + 1, 3, 5); }
    else if (st.can) { ctx.fillStyle = TC.gold; ctx.fillRect(p0.x + nb - 8, p0.y + 3, 5, 5); }
    else if (st.locked) { ctx.fillStyle = TC.dim; ctx.fillRect(p0.x + nb - 10, p0.y + 7, 7, 5); ctx.fillRect(p0.x + nb - 9, p0.y + 3, 5, 5); ctx.fillStyle = "#23263a"; ctx.fillRect(p0.x + nb - 8, p0.y + 5, 3, 2); }
    shopBtn.push({ x: p0.x - 4, y: p0.y - 4, w: nb + 8, h: nb + 8, act: "node", i: n.i });
  }
  // 상세 칸: 이름 / 효과 / 재료(아이콘 + 보유/필요)
  const id = cat.ids[S.craftSel], it = ITEMS[id], st = stat(id);
  const btn = { label: st.owned ? "보유 중" : st.locked ? "잠김" : "제작", sub: st.owned ? null : "$" + it.cost, kind: "go", on: st.can, act: st.owned ? null : "craft", arg: id, w: 96 };
  const r = townFooter(f, [[it.name + (st.owned ? "  (보유 중)" : ""), "#fff", 16], [fxText(it.fx), TC.dim, 12]], [btn]);
  let mx = r.tx;
  const my = r.ty + 2, limit = r.tx + r.textW;
  for (const m in it.mats) {
    const have = matHave(m), need = it.mats[m], label = have + "/" + need;
    setFont(16); const lw = Math.ceil(ctx.measureText(label).width);
    if (mx + 28 + lw > limit) break;
    drawPx(matIcon(m), mx, my - 4, 24);
    txt(label, mx + 28, my, have >= need ? TC.green : TC.red, 16);
    mx += 28 + lw + 16;
  }
  const tail = S.msgT > 0 ? [S.msg, TC.gold] : st.locked ? ["먼저 제작: " + ITEMS[it.req].name, TC.warn] : null;
  if (tail && mx < limit - 40) txt(fitText(tail[0], limit - mx, 12), mx, my + 3, tail[1], 12);
}

// ---------------------------------------------------------------------
//  창고 · 판매 (원석 9종 + 주괴 5종)
// ---------------------------------------------------------------------
function drawSellModal(vw, vh) {
  const f = townFrame(vw, vh, "창고 · 판매", 84, 130, "[ ] 건물 이동 · 방향키 고르기 · Space 1개 · Enter 전부 · F 원석 모두");
  const cols = SELL_COLS, rowsN = Math.ceil(SELL_KEYS.length / cols);
  const cw = Math.floor(f.cw / cols), chh = Math.max(36, Math.min(66, Math.floor((f.ch + 6) / rowsN)));
  SELL_KEYS.forEach((k, i) => {
    const px = f.cx + (i % cols) * cw, py = f.cy + Math.floor(i / cols) * chh;
    const n = matHave(k), sel = i === S.sellSel, isB = !!BARS[k], ih = chh - 6;
    ctx.fillStyle = sel ? TC.sel : isB ? "rgba(255,170,90,0.08)" : TC.row; ctx.fillRect(px, py, cw - 6, ih);
    if (sel) { ctx.fillStyle = TC.gold; ctx.fillRect(px, py, 3, ih); }
    const box = ih >= 54 && cw >= 110 ? 48 : 24;
    drawPx(matIcon(k), px + 8, py + Math.floor((ih - box) / 2), box, n > 0 ? 1 : 0.3);
    const tx = px + 8 + box + 8, t = py + Math.floor((ih - 32) / 2);
    txt("x" + n, tx, t, n > 0 ? "#fff" : TC.mute, 16);
    txt("$" + unitPrice(k), tx, t + 19, n > 0 ? TC.gold : TC.mute, 12);
    shopBtn.push({ x: px, y: py, w: cw, h: chh, act: "sellsel", i });
  });
  const id = SELL_KEYS[Math.min(S.sellSel, SELL_KEYS.length - 1)], have = matHave(id), unit = unitPrice(id), tot = stashValue();
  townFooter(f, [
    [matName(id) + "  ·  보유 " + have + "개", "#fff", 16],
    ["개당 $" + unit + (BARS[id] ? " · 원석으로 팔 때보다 35% 더 받아요" : ""), TC.dim, 12],
    S.msgT > 0 ? [S.msg, TC.gold, 12] : ["원석 모두 팔면 $" + tot + " · 주괴는 골라서 팔아요", TC.mute, 12],
  ], [
    { label: "1개", sub: "$" + unit, kind: "go", on: have >= 1, act: "sell", arg: [id, 1], w: 66 },
    { label: "10개", sub: "$" + unit * Math.min(10, have), kind: "go", on: have >= 1, act: "sell", arg: [id, 10], w: 66 },
    { label: "전부", sub: "$" + unit * have, kind: "go", on: have >= 1, act: "sell", arg: [id, Infinity], w: 74 },
    { label: "원석 모두", sub: "$" + tot, kind: "gold", on: tot > 0, act: "sellall", w: 104 },
  ]);
}

// ---------------------------------------------------------------------
//  용광로 (원석 2개 + 석탄 → 주괴 1개)
// ---------------------------------------------------------------------
export function drawFurnaceModal(vw, vh) {
  const F = S.acct.furnace, L = FURNACE_LV[F.lv], nx = FURNACE_LV[F.lv + 1];
  const f = townFrame(vw, vh, "용광로 · Lv." + F.lv, 84, 130, "[ ] 건물 이동 · ↑↓ 고르기 · 1 / 5 / Enter 넣기 · U 강화 · Esc 닫기");

  // 상태 카드: 아이콘 · 진행 상황 · 강화 버튼
  const cardH = f.short ? 44 : 66, ib = f.short || f.narrow ? 32 : 48;
  ctx.fillStyle = TC.row; ctx.fillRect(f.cx, f.cy, f.cw, cardH);
  drawPx(ICON.furnace, f.cx + 8, f.cy + Math.floor((cardH - ib) / 2), ib);
  const bw = f.narrow ? 84 : 104, bh = cardH - 14;
  const upLabel = !nx ? "최고 단계" : bh >= 40 ? "강화" : "강화 $" + nx.cost;   // 낮은 화면은 가격을 한 줄에
  uiBtn(f.cx + f.cw - 8 - bw, f.cy + 7, bw, bh, upLabel, nx && bh >= 40 ? "$" + nx.cost : null, "gold", !!nx && P.money >= nx.cost, nx ? "fup" : null);
  const x0 = f.cx + 8 + ib + 12, tw = f.cw - (x0 - f.cx) - bw - 20, t0 = f.cy + (f.short ? 4 : 9);
  const qTxt = "대기 " + F.q.length + "/" + L.cap, qInline = !f.narrow;          // 좁은 화면은 '대기 n/m'을 아래 줄로
  const lvInfo = "속도 x" + L.speed + (L.save ? " · 석탄 " + Math.round(L.save * 100) + "% 절약" : "");
  if (F.q.length) {
    const j = F.q[0], B = BARS[j.m], left = Math.ceil(F.q.reduce((a, q) => a + q.left, 0) / L.speed);
    txt(fitText("재련 중 · " + B.name, qInline ? tw - 70 : tw, 16), x0, t0, TC.gold, 16);
    if (qInline) txt(qTxt, x0 + tw, t0 + 2, TC.dim, 12, "right");
    pbar(x0, t0 + (f.short ? 19 : 21), tw, f.short ? 8 : 10, 1 - j.left / B.time, "#ff8a1f", "#ffd34d");
    if (!f.short) txt(fitText((qInline ? "" : qTxt + " · ") + "남은 시간 약 " + left + "초 · " + lvInfo, tw, 12), x0, t0 + 36, TC.dim, 12);
    else txt(fitText((qInline ? "" : qTxt + " · ") + "남은 약 " + left + "초 · " + lvInfo, tw, 12), x0, t0 + 28, TC.dim, 12);
  } else {
    txt("쉬는 중", x0, t0, "#fff", 16);
    if (qInline) txt(qTxt, x0 + tw, t0 + 2, TC.dim, 12, "right");
    txt(fitText("원석 " + ORE_PER_BAR + "개 + 석탄 → 주괴 1개 · 넣어 두면 광산에 있어도 계속 재련돼요", tw, 12), x0, t0 + 20, TC.dim, 12);
    if (!f.short) txt(fitText((qInline ? "" : qTxt + " · ") + lvInfo, tw, 12), x0, t0 + 38, TC.mute, 12);
  }

  // 주괴 목록
  const ly = f.cy + cardH + (f.short ? 6 : 8), n = BAR_KEYS.length;
  const rh = Math.max(26, Math.min(50, Math.floor((f.cy + f.ch - ly) / n))), inner = rh - 4;
  BAR_KEYS.forEach((k, i) => {
    const B = BARS[k], ry = ly + i * rh, can = furnaceCan(k);
    townRow(f.cx, ry, f.cw, inner, i === S.furnaceSel);
    let lx = f.cx + 10;
    const iy = ry + Math.floor((inner - 24) / 2);
    drawPx(oreIcon[B.ore], lx, iy, 24, can > 0 ? 1 : 0.55); lx += 26;
    txt("→", lx + 2, ry + Math.floor((inner - 16) / 2), "#ff9a4d", 16); lx += 22;
    drawPx(barIcon[k], lx, iy, 24); lx += 34;
    const rightW = 92, nameW = f.cx + f.cw - 12 - rightW - lx;
    if (inner >= 34) {
      const t = ry + Math.floor((inner - 32) / 2);
      txt(fitText(B.name, nameW, 16), lx, t, "#fff", 16);
      txt(fitText(TILE[B.ore].name + " " + ORE_PER_BAR + " + 석탄 " + B.coal + " · " + B.time + "초", nameW, 12), lx, t + 19, TC.dim, 12);
      txt("보유 " + (P.bars[k] || 0), f.cx + f.cw - 12, t, TC.blue, 16, "right");
      txt("넣기 가능 " + can, f.cx + f.cw - 12, t + 19, can > 0 ? TC.green : TC.mute, 12, "right");
    } else {
      txt(fitText(B.name, nameW, 16), lx, ry + Math.floor((inner - 16) / 2), "#fff", 16);
      txt("보유 " + (P.bars[k] || 0), f.cx + f.cw - 12, ry + Math.floor((inner - 16) / 2), TC.blue, 16, "right");
    }
    shopBtn.push({ x: f.cx, y: ry, w: f.cw, h: inner, act: "fsel", i });
  });

  // 상세 칸: 고른 주괴 넣기
  const k = BAR_KEYS[S.furnaceSel] || BAR_KEYS[0], B = BARS[k], can = furnaceCan(k);
  const full = F.q.length >= L.cap;
  const note = S.msgT > 0 ? [S.msg, TC.gold, 12]
    : full ? ["대기열이 가득 찼어요 · 강화하면 더 많이 넣을 수 있어요", TC.warn, 12]
    : can <= 0 ? [TILE[B.ore].name + " " + ORE_PER_BAR + "개와 석탄 " + B.coal + "개가 있어야 1개를 만들 수 있어요", TC.warn, 12] : ["", 0, 12];
  townFooter(f, [
    [B.name + " 넣기", "#fff", 16],
    ["창고: " + TILE[B.ore].name + " " + (P.stash[B.ore] || 0) + "개 · 석탄 " + (P.stash[6] || 0) + "개", TC.dim, 12],
    note,
  ], [
    { label: "1개", kind: "go", on: can >= 1, act: "smelt", arg: 1, w: 58 },
    { label: "5개", kind: "go", on: can >= 1, act: "smelt", arg: 5, w: 58 },
    { label: "최대", sub: can + "개", kind: "go", on: can >= 1, act: "smelt", arg: Infinity, w: 74 },
    { label: "비우기", kind: "danger", on: F.q.length > 0, act: "fclear", w: 74 },
  ]);
}
