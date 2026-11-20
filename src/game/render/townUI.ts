// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./draw.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { TAB_IMG, fxText } from "../art/buildings.ts";
import { itemIcon } from "../art/itemIcons.ts";
import { ICON, oreIcon } from "../art/sprites.ts";
import { TILE } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { GLYPH, SY, blit, btnPx, ctx, glyph, hazard, keycap, panel, pxBox, segBar, setFont, txt, well } from "./util.ts";
import { BARS, BAR_KEYS, FURNACE_LV, ORE_PER_BAR, barIcon, furnaceCan, matHave, matIcon, matName } from "../systems/furnace.ts";
import { TOWN, shopBtn, townActive } from "../systems/input.ts";
import { ORDER_N, SELL_KEYS, SELL_ORES, ensureOrders, orderRerollCost, stashValue, unitPrice } from "../systems/town.ts";

// =====================================================================
//  마을 창 (상점 · 제작 · 용광로 · 판매) — "안전 노랑" 스타일
//   네 탭이 모두 같은 틀을 씁니다.
//     ┌ 노란 머리띠: 탭들 ··· 경고 줄무늬 [X] ┐
//     │ ┌ 분류 ┐ ┌ 오른쪽 판: 제목 · 돈 ─────┐ │
//     │ │ 드릴▶│ │ 목록 (줄마다 버튼)          │ │  ← 왼쪽 분류를 누르면 오른쪽 목록이 바뀜
//     │ │ 탱크 │ │ ...                         │ │
//     │ └──────┘ └ 안내 한 줄 ─────────────────┘ │
//     └──────────────────────────────────────────┘
//   글자 크기는 12 / 16 / 32 만 씁니다 (util.ts 의 글꼴 설명 참고). 1칸 = 2px.
// =====================================================================
export const TC = {
  ink: SY.ink, body: SY.body, well: SY.well, dim: SY.dim, mute: SY.mute, gold: SY.gold,
  green: SY.green, red: SY.red, warn: SY.warn, blue: SY.blue,
};
const NO_SH = "rgba(0,0,0,0)";

// 도트 그림을 정수 배율로만 키워서 칸(box) 가운데에 그림. 1.5배처럼 어중간하게 키우면 픽셀 크기가 들쭉날쭉해짐
//  고해상도 그림(칸보다 큰 그림)은 칸에 맞게 줄임 (blit 이 부드럽게 줄여 줌)
export function drawPx(img, x, y, box, alpha) {
  if (!img || !img.width) return;
  const m = Math.max(img.width, img.height);
  const s = m > box ? box / m : Math.floor(box / m);
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  blit(img, Math.round(x + (box - w) / 2), Math.round(y + (box - h) / 2), w, h);
  ctx.globalAlpha = 1;
}

// 글자가 칸보다 길면 … 으로 줄임
export function fitText(s, maxW, size) {
  setFont(size || 16);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}
const money = (n) => "$" + Number(n).toLocaleString("en-US");

// 버튼. kind: go(초록) gold(주황) plain(파랑) danger(빨강) steel(회색). 꺼져 있으면 회색이지만 누르면 동작을 부름 → "돈이 부족해요" 같은 안내가 나옴
const KIND_COL = { go: "green", gold: "orange", plain: "blue", danger: "red", steel: "steel" };
export function uiBtn(x: number, y: number, w: number, h: number, label: string, sub: string | null, kind: string, on: boolean, act?: string | null, arg?: any, i?: number) {
  const col = on ? (KIND_COL[kind] || "steel") : "steel";
  const tc = { green: "#1f5418", blue: "#0b3f6c", orange: "#7a3006", red: "#6e1222", steel: "#3e4552" }[col];
  const pb = S.pressBtn, pressed = !!(pb && pb.x === x && pb.y === y && performance.now() - pb.t < 150);   // 방금 누른 버튼은 눌린 모양
  const cy = btnPx(x, y, w, h, col, pressed || (!on && kind === "steel"));
  if (sub && h >= 40) {
    txt(fitText(label, w - 8, 16), x + w / 2, cy - 17, tc, 16, "center", NO_SH);
    txt(fitText(sub, w - 8, 12), x + w / 2, cy + 2, tc, 12, "center", NO_SH);
  } else txt(fitText(label, w - 8, 16), x + w / 2, cy - 8, tc, 16, "center", NO_SH);
  if (act) shopBtn.push({ x, y, w, h, act, arg, i });
}

// 공용 틀: 노란 머리띠(탭 + 닫기) + 왼쪽 분류(있으면) + 오른쪽 판. 각 자리를 돌려줌
//   cats: [{name, icon}] 또는 null(분류 없음) · sel: 고른 분류 · catAct: 분류를 눌렀을 때 동작 이름
export function townFrame(vw, vh, title, cats, sel, catAct, hint) {
  if (!S.townDimDone) { ctx.fillStyle = "rgba(10,11,14,0.72)"; ctx.fillRect(0, 0, vw, vh); }   // (draw.ts 가 이미 화면 전체를 어둡게 깔았으면 생략)
  const narrow = vw < 560;
  const w = Math.min(720, vw - 16), h = Math.min(narrow ? 600 : 520, vh - 16);
  const short = h < 420;
  const x = Math.floor((vw - w) / 2), y = Math.floor((vh - h) / 2);
  S.shopRect = { x, y, w, h };
  panel(x, y, w, h);
  // 머리띠
  const TH = short ? 36 : 42;
  ctx.fillStyle = SY.y; ctx.fillRect(x + 2, y + 2, w - 4, TH);
  ctx.fillStyle = SY.yHi; ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.fillStyle = SY.yLo; ctx.fillRect(x + 2, y + TH, w - 4, 2);
  // 탭: 고른 탭은 판과 이어진 숯색, 나머지는 진한 노랑
  const act = townActive(), n = TOWN.length, gap = 4, closeW = TH - 8;
  const tabsW = Math.min(n * 112, w - 24 - closeW - 8 - (narrow ? 0 : 60));
  const tw = Math.floor((tabsW - gap * (n - 1)) / n);
  TOWN.forEach(([k, label], i) => {
    const tx = x + 10 + i * (tw + gap), on = k === act, ty = y + 8;
    if (on) {
      pxBox(tx, ty, tw, TH - 4, SY.ink);
      ctx.fillStyle = SY.body; ctx.fillRect(tx + 2, ty + 2, tw - 4, TH - 4);
      ctx.fillStyle = SY.hi; ctx.fillRect(tx + 2, ty + 2, tw - 4, 2);
    } else {
      pxBox(tx, ty + 2, tw, TH - 10, SY.yLo);
      ctx.fillStyle = SY.yDk; ctx.fillRect(tx + 2, ty + 4, tw - 4, TH - 14);
    }
    const img = TAB_IMG[k + (on ? "_on" : "_off")], inner = TH - 8;
    if (img && img.width > 1 && img.width <= tw - 6) {               // 탭 이름은 그림으로 박아 둔 로고 (글꼴 영향 없음)
      ctx.drawImage(img, tx + Math.floor((tw - img.width) / 2), ty + Math.floor((inner - img.height) / 2) + (on ? 1 : 2));
    } else txt(fitText(label, tw - 6, 12), tx + tw / 2, ty + Math.floor((inner - 12) / 2) + 1, on ? SY.y : "#3a2a00", 12, "center", NO_SH);
    shopBtn.push({ x: tx, y, w: tw, h: TH, act: "town", arg: k });
  });
  // 경고 줄무늬 + 닫기(빨강 X)
  const cx = x + w - 10 - closeW, hzX = x + 10 + n * (tw + gap) + 6;
  if (cx - 8 - hzX >= 24) hazard(hzX, y + 10, Math.min(96, cx - 8 - hzX) & ~1, TH - 16);
  btnPx(cx, y + 6, closeW, TH - 8, "red");
  glyph(GLYPH.x, cx + Math.floor((closeW - 14) / 2), y + 6 + Math.floor((TH - 8 - 4 - 14) / 2), "#6e1222");
  shopBtn.push({ x: cx - 4, y, w: closeW + 8, h: TH + 4, act: "close" });

  // 본문
  const by = y + TH + 10, bh = h - TH - 10 - 12;
  let lw = 0;
  if (cats) {                                                          // 왼쪽 분류 버튼
    lw = narrow ? 52 : 132;
    const ch = Math.max(30, Math.min(narrow ? 48 : 44, Math.floor((bh + 6) / cats.length) - 6));
    cats.forEach((c, i) => {
      const cy = by + i * (ch + 6), on = i === sel, bx = x + 10;
      pxBox(bx, cy, lw, ch, SY.ink);
      ctx.fillStyle = on ? SY.y : "#3a404c"; ctx.fillRect(bx + 2, cy + 2, lw - 4, ch - 4);
      ctx.fillStyle = on ? SY.yHi : "#4c5362"; ctx.fillRect(bx + 2, cy + 2, lw - 4, 2);
      ctx.fillStyle = on ? SY.yLo : "#262a32"; ctx.fillRect(bx + 2, cy + ch - 6, lw - 4, 4);
      if (on) { ctx.fillStyle = SY.y; for (let k = 0; k < 5; k++) ctx.fillRect(bx + lw + k * 2, cy + ch / 2 - 10 + k * 2, 2, 20 - k * 4); }   // 목록 쪽 화살표
      const ib = ch - 10 >= 32 && narrow ? 32 : 16;
      if (narrow) drawPx(c.img || ICON[c.icon], bx + Math.floor((lw - ib) / 2), cy + Math.floor((ch - 4 - ib) / 2), ib);
      else {
        drawPx(c.img || ICON[c.icon], bx + 8, cy + Math.floor((ch - 4 - 32) / 2), 32);
        txt(fitText(c.name, lw - 50, 16), bx + 44, cy + Math.floor((ch - 4 - 16) / 2), on ? "#1a1a1a" : "#d6dce6", 16, "left", on ? NO_SH : SY.ink);
      }
      shopBtn.push({ x: bx, y: cy, w: lw, h: ch, act: catAct, arg: i });
    });
    lw += 14;
  }
  // 오른쪽 판
  const rx = x + 12 + lw, ry = by, rw = x + w - 12 - rx, rh = bh;
  well(rx, ry, rw, rh);
  const tY = ry + 8;
  setFont(16);
  const ms = money(P.money), mw = Math.ceil(ctx.measureText(ms).width);
  txt(ms, rx + rw - 10, tY, SY.gold, 16, "right");
  drawPx(ICON.coin, rx + rw - 10 - mw - 22, tY, 16);
  txt(fitText(title, rw - 56 - mw, 16), rx + 10, tY, SY.y, 16);
  // 안내 한 줄 (판 맨 아래)
  const noteY = ry + rh - 20;
  if (S.msgT > 0) txt(fitText(S.msg, rw - 20, 12), rx + 10, noteY, SY.gold, 12);
  // 키 안내는 창 밖 아래에 작게 (자리가 있을 때만)
  if (hint && !S.usedTouch && vh - (y + h) >= 20) txt(hint, x + w, y + h + 6, SY.mute, 12, "right");
  return { x, y, w, h, narrow: narrow || rw < 420, short, cx: rx + 8, cy: ry + 32, cw: rw - 16, ch: rh - 32 - 24, rx, ry, rw, rh, noteY };
}

// 상세 칸(판 아래쪽): 왼쪽에 글 줄들, 오른쪽(좁으면 아래 줄)에 버튼들. f 의 본문 아래쪽을 fh 만큼 씀
//   lines: [[글, 색, 크기]]   btns: [{label, sub, kind, on, act, arg, w}]
export function townFooter(f, fh, lines, btns) {
  const fx = f.cx, fw = f.cw, fy = f.cy + f.ch - fh;
  ctx.fillStyle = SY.ink; ctx.fillRect(fx, fy - 6, fw, 2);
  const bh = f.short ? 40 : 44, gap = 6;
  let textW, maxY = fy + fh;
  if (f.narrow) {
    const by = fy + fh - bh - 2, free = fw - gap * (btns.length - 1);
    const tot = btns.reduce((a, b) => a + (b.w || 80), 0);
    let bx = fx;
    btns.forEach((b, i) => {
      const bw = i === btns.length - 1 ? fx + fw - bx : Math.floor((b.w || 80) * free / tot);
      uiBtn(bx, by, bw, bh, b.label, b.sub, b.kind, b.on, b.act, b.arg); bx += bw + gap;
    });
    textW = fw - 8; maxY = by - 4;
  } else {
    const tot = btns.reduce((a, b) => a + (b.w || 80), 0) + gap * Math.max(0, btns.length - 1);
    const by = fy + Math.floor((fh - bh) / 2);
    let bx = fx + fw - tot;
    for (const b of btns) { uiBtn(bx, by, b.w || 80, bh, b.label, b.sub, b.kind, b.on, b.act, b.arg); bx += (b.w || 80) + gap; }
    textW = fw - 16 - tot;
  }
  let ty = fy + 2;
  for (const [s, col, size] of lines) {
    if (ty + (size || 16) > maxY) break;                          // 자리가 모자라면 아래 줄은 생략
    if (s) txt(fitText(s, textW, size || 16), fx + 2, ty, col || "#fff", size || 16);
    ty += (size || 16) <= 12 ? 18 : 22;
  }
  return { tx: fx + 2, ty, textW };
}

// 목록 한 줄의 바탕 (번갈아 색 · 고른 줄은 노란 테두리)
function townRow(x, y, w, h, sel, k) {
  ctx.fillStyle = k % 2 ? SY.row2 : SY.row; ctx.fillRect(x, y, w, h);
  if (sel) { ctx.fillStyle = SY.y; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); }
}
// 아이콘 칸 (파인 칸 + 그림)
function iconSlot(img, x, y, s, alpha) {
  ctx.fillStyle = SY.ink; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = SY.wellDk; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  ctx.fillStyle = SY.wellLt; ctx.fillRect(x + 2, y + s - 4, s - 4, 2);
  drawPx(img, x + 2, y + 2, s - 4, alpha);
}
// 쪽 넘기기 (<  1 / 2  >)
function pager(f, page, pages, act) {
  const py = f.cy + f.ch - 30, mid = f.cx + Math.floor(f.cw / 2);
  uiBtn(mid - 80, py, 48, 30, "<", null, "plain", page > 0, act, -1);
  txt((page + 1) + " / " + pages, mid, py + 8, SY.dim, 12, "center");
  uiBtn(mid + 32, py, 48, 30, ">", null, "plain", page < pages - 1, act, 1);
}

// ---------------------------------------------------------------------
//  상점: 왼쪽 분류 → 오른쪽 목록 (줄마다 구매 버튼)
// ---------------------------------------------------------------------
export function drawShopModal(vw, vh) {
  const cat = CATS[S.shopTab];
  const f = townFrame(vw, vh, cat.name, CATS.map((c) => ({ name: c.name, icon: c.icon, img: ICON[c.icon] })), S.shopTab, "tab",
    "[ ] 건물 이동 · ←→ 분류 · ↑↓ 고르기 · Enter 구매 · Esc 닫기");
  // 한 쪽에 몇 줄: 창 높이에 맞춰 3~9줄 (예전엔 4줄 고정이라 빈 자리가 남아도 쪽을 넘겨야 했음)
  const len = cat.ids.length;
  let per = Math.max(3, Math.min(9, Math.floor(f.ch / 52)));
  if (len > per) per = Math.max(3, Math.min(9, Math.floor((f.ch - 38) / 52)));
  S.shopPer = per;
  const pages = Math.ceil(len / per), page = Math.floor(S.shopSel / per);
  const pagerH = pages > 1 ? 38 : 0;
  const rh = Math.max(40, Math.min(66, Math.floor((f.ch - pagerH) / Math.min(per, Math.max(4, len))))), inner = rh - 6;
  for (let k = 0; k < per; k++) {
    const i = page * per + k;
    if (i >= len) break;
    const id = cat.ids[i], it = ITEMS[id], ry = f.cy + k * rh;
    const owned = !it.cons && !!P.items[id];
    const locked = !it.cons && !owned && !!it.req && !P.items[it.req];
    const poor = !owned && !locked && P.money < it.cost;
    townRow(f.cx, ry, f.cw, inner, i === S.shopSel, k);
    let lx = f.cx + 6;
    if (!S.usedTouch && !f.narrow) { keycap(lx, ry + Math.floor((inner - 26) / 2), String(k + 1)); lx += 32; }
    const ib = inner >= 44 ? Math.min(52, inner - 4) : 36 <= inner ? 36 : inner - 4;   // 줄이 높으면 아이콘도 크게 (드릴 그림이 가로로 길어서)
    iconSlot(itemIcon(id), lx, ry + Math.floor((inner - ib) / 2), ib, locked ? 0.35 : 1); lx += ib + 10;
    // 오른쪽 버튼: 구매(가격) / 장착 중 / 잠김
    const bw = f.narrow ? 76 : 96, bh = Math.min(inner - 6, 48), bx = f.cx + f.cw - 6 - bw, by2 = ry + Math.floor((inner - bh) / 2);
    const price = money(it.cost);
    if (owned) uiBtn(bx, by2, bw, bh, "장착 중", null, "steel", false, null);
    else if (locked) uiBtn(bx, by2, bw, bh, "잠김", bh >= 40 ? price : null, "go", false, "buy", id);
    else uiBtn(bx, by2, bw, bh, bh >= 40 ? "구매" : price, bh >= 40 ? price : null, "go", !poor, "buy", id);
    // 이름 + 설명
    const nameW = bx - 10 - lx;
    const sub = locked ? "필요: " + ITEMS[it.req].name : it.cons ? it.desc : fxText(it.fx);
    const cnt = it.cons ? "  x" + (P.inv[id] || 0) : "";
    if (inner >= 36) {
      const t = ry + Math.floor((inner - 34) / 2);
      txt(fitText(it.name + cnt, nameW, 16), lx, t, locked ? SY.mute : SY.txt, 16);
      txt(fitText(sub, nameW, 12), lx, t + 21, locked ? SY.warn : poor ? SY.red : SY.dim, 12);
    } else txt(fitText(it.name + cnt, nameW, 16), lx, ry + Math.floor((inner - 16) / 2), locked ? SY.mute : SY.txt, 16);
    shopBtn.push({ x: f.cx, y: ry, w: bx - f.cx - 4, h: inner, act: "sel", i });
  }
  if (pages > 1) pager(f, page, pages, "page");
  if (!(S.msgT > 0)) {
    const it = ITEMS[cat.ids[Math.min(S.shopSel, len - 1)]];
    const tip = it.cons ? "소모품은 여러 개 살 수 있어요 · 아래 슬롯(1~7)으로 사용" : cat.ids.length && !it.cons ? "위에서부터 차례로 강화돼요 · 산 장비는 바로 장착" : "";
    txt(fitText(tip, f.cw, 12), f.cx, f.noteY, SY.mute, 12);
  }
}

// ---------------------------------------------------------------------
//  제작소: 왼쪽 분류 → 오른쪽 제작 트리 + 아래 상세 — 판매 탭도 같은 상태(craft)를 써서 여기서 나눠 그림
// ---------------------------------------------------------------------
export function drawCraftModal(vw, vh) {
  if (S.craftTab === RECIPE_CATS.length) return drawSellModal(vw, vh);
  const cat = RECIPE_CATS[S.craftTab];
  const f = townFrame(vw, vh, "제작 · " + cat.name, RECIPE_CATS.map((c) => ({ name: c.name, icon: c.icon })), S.craftTab, "tab",
    "[ ] 건물 이동 · Tab 분류 · 방향키 고르기 · Enter 제작 · Esc 닫기");
  const stat = (id) => {
    const it = ITEMS[id], owned = !!P.items[id];
    const locked = !owned && !!it.req && !P.items[it.req];
    const mats = Object.keys(it.mats).every((m) => matHave(m) >= it.mats[m]);
    return { owned, locked, mats, can: !owned && !locked && mats && P.money >= it.cost };
  };
  const fh = f.narrow ? 120 : 76;
  // 트리
  const areaY = f.cy, treeH = f.ch - fh - 12, rowsN = Math.max(3, cat.rows);
  const rowH = Math.floor(treeH / rowsN), nb = Math.max(30, Math.min(52, rowH - 8));
  const colW = cat.cols > 1 ? Math.min(150, Math.floor((f.cw - 24 - nb) / (cat.cols - 1))) : 0;
  const treeW = nb + colW * (cat.cols - 1), ox = f.cx + Math.floor((f.cw - treeW) / 2), oy = areaY + Math.floor((treeH - rowH * cat.rows) / 2);
  const pos = {};
  cat.nodes.forEach((n) => { pos[n.id] = { x: ox + n.col * colW, y: oy + n.row * rowH + Math.floor((rowH - nb) / 2) }; });
  for (const n of cat.nodes) {                                      // 연결선 (만든 장비에서 나가는 선은 노랑)
    if (!n.req) continue;
    const a = pos[n.req], b = pos[n.id], mx = Math.floor((a.x + nb + b.x) / 2);
    ctx.fillStyle = P.items[n.req] ? SY.y : "#4c5362";
    ctx.fillRect(a.x + nb, a.y + (nb >> 1) - 2, mx - a.x - nb + 2, 4);
    ctx.fillRect(mx, Math.min(a.y, b.y) + (nb >> 1) - 2, 4, Math.abs(a.y - b.y) + 4);
    ctx.fillRect(mx, b.y + (nb >> 1) - 2, b.x - mx, 4);
  }
  for (const n of cat.nodes) {                                      // 노드
    const id = n.id, st = stat(id), p0 = pos[id], sel = n.i === S.craftSel;
    pxBox(p0.x - 4, p0.y - 4, nb + 8, nb + 8, sel ? SY.y : SY.ink);
    ctx.fillStyle = st.owned ? "#2f5a32" : st.locked ? "#1d2027" : st.can ? "#5a4a14" : "#3a3f4b"; ctx.fillRect(p0.x - 2, p0.y - 2, nb + 4, nb + 4);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(p0.x - 2, p0.y - 2, nb + 4, 2);
    drawPx(itemIcon(id), p0.x + 2, p0.y + 2, nb - 4, st.locked ? 0.35 : 1);
    if (st.owned) glyph(["......#", ".....##", "#...##.", "##.##..", ".###...", "..#...."], p0.x + nb - 14, p0.y + 2, SY.green, 2);
    else if (st.can) { ctx.fillStyle = SY.y; ctx.fillRect(p0.x + nb - 8, p0.y + 2, 6, 6); }
    shopBtn.push({ x: p0.x - 4, y: p0.y - 4, w: nb + 8, h: nb + 8, act: "node", i: n.i });
  }
  // 상세: 이름 / 효과 / 재료(아이콘 + 보유/필요)
  const id = cat.ids[S.craftSel], it = ITEMS[id], st = stat(id);
  const btn = { label: st.owned ? "보유 중" : st.locked ? "잠김" : "제작", sub: st.owned ? null : money(it.cost), kind: "go", on: st.can, act: st.owned ? null : "craft", arg: id, w: 96 };
  const r = townFooter(f, fh, [[it.name + (st.owned ? "  (보유 중)" : ""), SY.txt, 16], [fxText(it.fx), SY.dim, 12]], [btn]);
  let mx = r.tx;
  const my = r.ty + 2, limit = r.tx + r.textW;
  for (const m in it.mats) {
    const have = matHave(m), need = it.mats[m], label = have + "/" + need;
    setFont(16); const lw = Math.ceil(ctx.measureText(label).width);
    if (mx + 28 + lw > limit) break;
    drawPx(matIcon(m), mx, my - 4, 24);
    txt(label, mx + 28, my, have >= need ? SY.green : SY.red, 16);
    mx += 28 + lw + 16;
  }
  if (!(S.msgT > 0) && st.locked) txt(fitText("먼저 제작: " + ITEMS[it.req].name, f.cw, 12), f.cx, f.noteY, SY.warn, 12);
}

// ---------------------------------------------------------------------
//  창고 · 판매: 왼쪽 원석/주괴 → 오른쪽 목록 (줄마다 1개 · 전부)
// ---------------------------------------------------------------------
function drawSellModal(vw, vh) {
  if (S.sellSel >= SELL_KEYS.length) return drawOrders(vw, vh);
  const onBar = S.sellSel >= SELL_ORES;
  const f = townFrame(vw, vh, onBar ? "판매 · 주괴" : "판매 · 원석", SELL_CATS(), onBar ? 1 : 0, "scat",
    "[ ] 건물 이동 · ←→ 원석/주괴/의뢰 · ↑↓ 고르기 · Space 1개 · Enter 전부 · F 원석 모두");
  const keys = onBar ? SELL_KEYS.slice(SELL_ORES) : SELL_KEYS.slice(0, SELL_ORES), base = onBar ? SELL_ORES : 0;
  const tot = stashValue(), allH = onBar ? 0 : 52;
  const per = Math.max(1, Math.floor((f.ch - allH - 38) / 46)), pages = Math.ceil(keys.length / per);
  S.sellPer = per;
  const page = Math.min(pages - 1, Math.floor((S.sellSel - base) / per)), pagerH = pages > 1 ? 38 : 0;
  const rh = Math.max(42, Math.min(60, Math.floor((f.ch - allH - pagerH) / Math.min(per, keys.length)))), inner = rh - 6;
  for (let k = 0; k < per; k++) {
    const j = page * per + k;
    if (j >= keys.length) break;
    const id = keys[j], i = base + j, have = matHave(id), unit = unitPrice(id), ry = f.cy + k * rh;
    townRow(f.cx, ry, f.cw, inner, i === S.sellSel, k);
    const ib = Math.min(40, inner - 4);
    iconSlot(matIcon(id), f.cx + 6, ry + Math.floor((inner - ib) / 2), ib, have > 0 ? 1 : 0.3);
    const lx = f.cx + 6 + ib + 10;
    const bw = f.narrow ? 58 : 70, bh = Math.min(inner - 6, 44), by2 = ry + Math.floor((inner - bh) / 2);
    const b2x = f.cx + f.cw - 6 - bw, b1x = b2x - 6 - bw;
    uiBtn(b1x, by2, bw, bh, "1개", bh >= 40 ? money(unit) : null, "go", have >= 1, "sell", [id, 1]);
    uiBtn(b2x, by2, bw, bh, "전부", bh >= 40 ? money(unit * have) : null, "go", have >= 1, "sell", [id, Infinity]);
    const nameW = b1x - 8 - lx, t = ry + Math.floor((inner - 34) / 2);
    txt(fitText(matName(id) + "  x" + have, nameW, 16), lx, t, have > 0 ? SY.txt : SY.mute, 16);
    txt(fitText("개당 " + money(unit) + (BARS[id] ? " · 원석보다 35% 비쌈" : ""), nameW, 12), lx, t + 21, have > 0 ? SY.gold : SY.mute, 12);
    shopBtn.push({ x: f.cx, y: ry, w: b1x - f.cx - 4, h: inner, act: "sellsel", i });
  }
  if (pages > 1) {
    const py = f.cy + f.ch - allH - 30, mid = f.cx + Math.floor(f.cw / 2);
    uiBtn(mid - 80, py, 48, 30, "<", null, "plain", page > 0, "spage", -1);
    txt((page + 1) + " / " + pages, mid, py + 8, SY.dim, 12, "center");
    uiBtn(mid + 32, py, 48, 30, ">", null, "plain", page < pages - 1, "spage", 1);
  }
  if (!onBar) uiBtn(f.cx, f.cy + f.ch - 46, f.cw, 44, "원석 모두 팔기", money(tot), "gold", tot > 0, "sellall");
  else if (!(S.msgT > 0)) txt("주괴는 용광로에서 원석 " + ORE_PER_BAR + "개 + 석탄으로 만들어요", f.cx, f.noteY, SY.mute, 12);
}

const SELL_CATS = () => [{ name: "원석", img: oreIcon[4] }, { name: "주괴", img: barIcon.au }, { name: "의뢰", img: ICON.order }];
// 의뢰: 줄마다 [아이콘 · 무엇 N개 · 보상] + 납품 버튼, 아래에 '새 의뢰 받기'($)
function drawOrders(vw, vh) {
  ensureOrders();
  const f = townFrame(vw, vh, "판매 · 의뢰", SELL_CATS(), 2, "scat", "[ ] 건물 이동 · ←→ 원석/주괴/의뢰 · ↑↓ 고르기 · Enter 납품 · R 새 의뢰");
  const sel = S.sellSel - SELL_KEYS.length, footH = 52;
  const rh = Math.max(46, Math.min(72, Math.floor((f.ch - footH) / ORDER_N))), inner = rh - 6;
  S.acct.orders.forEach((o, k) => {
    const ry = f.cy + k * rh, have = matHave(o.k), ok = have >= o.n;
    townRow(f.cx, ry, f.cw, inner, k === sel, k);
    const ib = Math.min(40, inner - 4);
    iconSlot(matIcon(o.k), f.cx + 6, ry + Math.floor((inner - ib) / 2), ib, 1);
    const lx = f.cx + 6 + ib + 10, bw = f.narrow ? 70 : 92, bh = Math.min(inner - 6, 44);
    const bx = f.cx + f.cw - 6 - bw, by2 = ry + Math.floor((inner - bh) / 2);
    uiBtn(bx, by2, bw, bh, "납품", bh >= 40 ? money(o.pay) : null, "go", ok, "order", k);
    const nameW = bx - 8 - lx, t = ry + Math.floor((inner - 34) / 2);
    txt(fitText(matName(o.k) + " " + o.n + "개", nameW, 16), lx, t, SY.txt, 16);
    txt(fitText("가진 것 " + have + " / " + o.n + "  ·  보상 " + money(o.pay) + " · 경험치 " + o.xp, nameW, 12), lx, t + 21, ok ? SY.green : SY.dim, 12);
    shopBtn.push({ x: f.cx, y: ry, w: bx - f.cx - 4, h: inner, act: "sellsel", i: SELL_KEYS.length + k });
    const fl = S.orderFlash;
    if (fl && fl.k === k && fl.t > 0) {                                // 방금 끝낸 줄: 초록 반짝 + '완료!' (새 의뢰가 그 자리로)
      ctx.globalAlpha = Math.min(1, fl.t / 0.6) * 0.45; ctx.fillStyle = SY.green; ctx.fillRect(f.cx, ry, f.cw, inner); ctx.globalAlpha = 1;
      txt("완료!", f.cx + f.cw / 2, ry + Math.floor(inner / 2) - 8 - Math.round((0.6 - fl.t) * 20), "#ffffff", 16, "center");
      fl.t -= 1 / 60;
    }
  });
  const c = orderRerollCost();
  uiBtn(f.cx, f.cy + f.ch - 46, f.cw, 44, "새 의뢰 받기 (셋 다 바꿈)", money(c), "plain", P.money >= c, "oreroll");
  if (!(S.msgT > 0)) txt(fitText("의뢰 = 판매가 1.6배 + 경험치 · 캐 본 광물만 나와요", f.cw, 12), f.cx, f.noteY, SY.mute, 12);
}

// ---------------------------------------------------------------------
//  용광로 (원석 2개 + 석탄 → 주괴 1개): 위 상태 카드 + 주괴 목록 + 아래 넣기 버튼
// ---------------------------------------------------------------------
export function drawFurnaceModal(vw, vh) {
  const F = S.acct.furnace, L = FURNACE_LV[F.lv], nx = FURNACE_LV[F.lv + 1];
  const f = townFrame(vw, vh, "용광로 · Lv." + F.lv, null, 0, null, "[ ] 건물 이동 · ↑↓ 고르기 · 1 / 5 / Enter 넣기 · U 강화 · Esc 닫기");

  // 상태 카드: 아이콘 · 진행 상황 · 강화 버튼
  const cardH = f.short ? 48 : 66, ib = f.short || f.narrow ? 32 : 48;
  ctx.fillStyle = SY.row; ctx.fillRect(f.cx, f.cy, f.cw, cardH);
  drawPx(ICON.furnace, f.cx + 8, f.cy + Math.floor((cardH - ib) / 2), ib);
  const bw = f.narrow ? 84 : 104, bh = cardH - 14;
  const upLabel = !nx ? "최고 단계" : bh >= 40 ? "강화" : "강화 " + money(nx.cost);
  uiBtn(f.cx + f.cw - 8 - bw, f.cy + 7, bw, bh, upLabel, nx && bh >= 40 ? money(nx.cost) : null, "gold", !!nx && P.money >= nx.cost, nx ? "fup" : null);
  const x0 = f.cx + 8 + ib + 12, tw = f.cw - (x0 - f.cx) - bw - 20, t0 = f.cy + (f.short ? 4 : 8);
  const qTxt = "대기 " + F.q.length + "/" + L.cap, qInline = !f.narrow;
  const lvInfo = "속도 x" + L.speed + (L.save ? " · 석탄 " + Math.round(L.save * 100) + "% 절약" : "");
  if (F.q.length) {
    const j = F.q[0], B = BARS[j.m], left = Math.ceil(F.q.reduce((a, q) => a + q.left, 0) / L.speed);
    txt(fitText("재련 중 · " + B.name, qInline ? tw - 70 : tw, 16), x0, t0, SY.gold, 16);
    if (qInline) txt(qTxt, x0 + tw, t0 + 2, SY.dim, 12, "right");
    const nSeg = Math.max(4, Math.floor(tw / 10)), done = Math.round(nSeg * (1 - j.left / B.time));
    segBar(x0, t0 + 20, nSeg, done, "fuel", 10, f.short ? 12 : 14);
    txt(fitText((qInline ? "" : qTxt + " · ") + "남은 약 " + left + "초 · " + lvInfo, tw, 12), x0, t0 + (f.short ? 34 : 38), SY.dim, 12);
  } else {
    txt("쉬는 중", x0, t0, SY.txt, 16);
    if (qInline) txt(qTxt, x0 + tw, t0 + 2, SY.dim, 12, "right");
    txt(fitText("원석 " + ORE_PER_BAR + "개 + 석탄 → 주괴 1개 · 광산에 있어도 계속 재련돼요", tw, 12), x0, t0 + 20, SY.dim, 12);
    if (!f.short) txt(fitText((qInline ? "" : qTxt + " · ") + lvInfo, tw, 12), x0, t0 + 38, SY.mute, 12);
  }

  // 주괴 목록
  const fh = f.narrow ? 120 : 76;
  const ly = f.cy + cardH + 8, n = BAR_KEYS.length;
  const rh = Math.max(28, Math.min(50, Math.floor((f.cy + f.ch - fh - 12 - ly) / n))), inner = rh - 4;
  BAR_KEYS.forEach((k, i) => {
    const B = BARS[k], ry = ly + i * rh, can = furnaceCan(k);
    townRow(f.cx, ry, f.cw, inner, i === S.furnaceSel, i);
    let lx = f.cx + 10;
    const iy = ry + Math.floor((inner - 24) / 2);
    drawPx(oreIcon[B.ore], lx, iy, 24, can > 0 ? 1 : 0.55); lx += 26;
    txt("→", lx + 2, ry + Math.floor((inner - 16) / 2), "#ff9a4d", 16); lx += 22;
    drawPx(barIcon[k], lx, iy, 24); lx += 34;
    const rightW = 92, nameW = f.cx + f.cw - 12 - rightW - lx;
    if (inner >= 34) {
      const t = ry + Math.floor((inner - 32) / 2);
      txt(fitText(B.name, nameW, 16), lx, t, SY.txt, 16);
      txt(fitText(TILE[B.ore].name + " " + ORE_PER_BAR + " + 석탄 " + B.coal + " · " + B.time + "초", nameW, 12), lx, t + 19, SY.dim, 12);
      txt("보유 " + (P.bars[k] || 0), f.cx + f.cw - 12, t, SY.blue, 16, "right");
      txt("넣기 가능 " + can, f.cx + f.cw - 12, t + 19, can > 0 ? SY.green : SY.mute, 12, "right");
    } else {
      txt(fitText(B.name, nameW, 16), lx, ry + Math.floor((inner - 16) / 2), SY.txt, 16);
      txt("보유 " + (P.bars[k] || 0), f.cx + f.cw - 12, ry + Math.floor((inner - 16) / 2), SY.blue, 16, "right");
    }
    shopBtn.push({ x: f.cx, y: ry, w: f.cw, h: inner, act: "fsel", i });
  });

  // 아래: 고른 주괴 넣기
  const k = BAR_KEYS[S.furnaceSel] || BAR_KEYS[0], B = BARS[k], can = furnaceCan(k);
  const full = F.q.length >= L.cap;
  const note = full ? ["대기열이 가득 찼어요 · 강화하면 더 많이 넣을 수 있어요", SY.warn, 12]
    : can <= 0 ? [TILE[B.ore].name + " " + ORE_PER_BAR + "개와 석탄 " + B.coal + "개가 있어야 1개를 만들 수 있어요", SY.warn, 12]
    : ["창고: " + TILE[B.ore].name + " " + (P.stash[B.ore] || 0) + "개 · 석탄 " + (P.stash[6] || 0) + "개", SY.dim, 12];
  townFooter(f, fh, [[B.name + " 넣기", SY.txt, 16], note], [
    { label: "1개", kind: "go", on: can >= 1, act: "smelt", arg: 1, w: 58 },
    { label: "5개", kind: "go", on: can >= 1, act: "smelt", arg: 5, w: 58 },
    { label: "최대", sub: can + "개", kind: "go", on: can >= 1, act: "smelt", arg: Infinity, w: 74 },
    { label: "비우기", kind: "danger", on: F.q.length > 0, act: "fclear", w: 74 },
  ]);
}
