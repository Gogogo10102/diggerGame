// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./draw.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { CAT_IMG, FX_NAME, TAB_IMG, UIK, fxNum, fxText } from "../art/buildings.ts";
import { itemIcon } from "../art/itemIcons.ts";
import { ICON, oreIcon } from "../art/sprites.ts";
import { TILE, won } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { EQUIP_FIXED, SLOT_OF, STAT, worn } from "../core/stats.ts";
import { SHOP_TABS } from "../data/consumables.ts";
import { CATS, ITEMS, LV_MAX, itemLv, lvCost, reqMet } from "../data/items.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { GLYPH, MT, SY, blit, btnPx, btnTxt, ctx, rivet, titleTxt, glyph, hazard, keycap, panel, pxBox, segBar, setFont, txt, well } from "./util.ts";
import { BARS, BAR_KEYS, BAR_MULT, FURNACE_LV, ORE_PER_BAR, SKILL_COST, SKILL_STEP, barIcon, furnaceCan, matHave, matIcon, matName, smeltRate } from "../systems/furnace.ts";
import { TOWN, shopBtn, townActive } from "../systems/input.ts";
import { ORDER_N, SELL_KEYS, SELL_ORES, ensureOrders, orderPay, orderRerollCost, stashValue, unitPrice } from "../systems/town.ts";

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
const money = (n) => won(n);                                     // 원 (한국식 9만 5천원)

// ---- PixelLab UI 부품 (ui/kit/*.png, tools/make-ui-kit.py) ----
//  9조각: 모서리는 그대로, 변·가운데는 되풀이해 깔아 늘림 (도트·리벳이 늘어나 보이지 않게). [위, 오른, 아래, 왼] 여백
const UIK_IN = {
  window: [24, 24, 24, 24], detail: [20, 20, 20, 20], bar: [10, 18, 10, 18], price: [14, 14, 14, 14],
  row: [8, 12, 8, 12], row_on: [8, 12, 8, 12], tab: [8, 10, 8, 10], tab_on: [8, 10, 8, 10],
  btn: [8, 8, 8, 8], btn_off: [8, 8, 8, 8], slot: [8, 8, 8, 8], slot2: [7, 7, 7, 7], close: [8, 8, 8, 8],
};
export const kitOn = () => UIK.window.width > 16;
const KIT_STRIPE = { go: "#5fd068", gold: "#ffa82a", plain: "#40c4f0", danger: "#f2606e" };   // 버튼 뜻 = 왼쪽 작은 색 띠 (CLAUDE.md 버튼 규칙)
export function kit(name, x, y, w, h) {
  const img = UIK[name];
  if (!img || img.width <= 4) return false;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  let [t, r, b, l] = UIK_IN[name];
  if (l + r > w) { l = Math.floor(w / 2); r = w - l; }                // 아주 작게 그릴 때 모서리끼리 겹치지 않게
  if (t + b > h) { t = Math.floor(h / 2); b = h - t; }
  const iw = img.width, ih = img.height, mw = iw - l - r, mh = ih - t - b, dw = w - l - r, dh = h - t - b;
  const part = (sx, sy, sw, sh, dx, dy, ww, hh) => {                 // (sx,sy,sw,sh) 조각을 ww×hh 에 되풀이해 깔기
    if (ww <= 0 || hh <= 0 || sw <= 0 || sh <= 0) return;
    for (let oy = 0; oy < hh; oy += sh) for (let ox = 0; ox < ww; ox += sw) {
      const cw = Math.min(sw, ww - ox), ch = Math.min(sh, hh - oy);
      ctx.drawImage(img, sx, sy, cw, ch, dx + ox, dy + oy, cw, ch);
    }
  };
  part(l, t, mw, mh, x + l, y + t, dw, dh);                          // 가운데
  part(l, 0, mw, t, x + l, y, dw, t); part(l, ih - b, mw, b, x + l, y + h - b, dw, b);   // 위·아래 변
  part(0, t, l, mh, x, y + t, l, dh); part(iw - r, t, r, mh, x + w - r, y + t, r, dh);   // 왼·오른 변
  ctx.drawImage(img, 0, 0, l, t, x, y, l, t); ctx.drawImage(img, iw - r, 0, r, t, x + w - r, y, r, t);
  ctx.drawImage(img, 0, ih - b, l, b, x, y + h - b, l, b); ctx.drawImage(img, iw - r, ih - b, r, b, x + w - r, y + h - b, r, b);
  return true;
}

// 버튼. kind: go(초록) gold(주황) plain(파랑) danger(빨강) steel(회색). 꺼져 있으면 회색이지만 누르면 동작을 부름 → "돈이 부족해요" 같은 안내가 나옴
const KIND_COL = { go: "green", gold: "orange", plain: "blue", danger: "red", steel: "steel" };
export function uiBtn(x: number, y: number, w: number, h: number, label: string, sub: string | null, kind: string, on: boolean, act?: string | null, arg?: any, i?: number) {
  const col = on ? (KIND_COL[kind] || "steel") : "steel";
  const pb = S.pressBtn, pressed = !!(pb && pb.x === x && pb.y === y && performance.now() - pb.t < 150);   // 방금 누른 버튼은 눌린 모양
  if (kitOn()) {                                                      // PixelLab 버튼: 어두운 철판 + 왼쪽 색 띠 + 밝은 글씨
    const dy = pressed ? 2 : 0;
    kit(on ? "btn" : "btn_off", x, y + dy, w, h - dy);
    const sc = on && KIT_STRIPE[kind];
    if (sc && w >= 48) { ctx.fillStyle = SY.ink; ctx.fillRect(x + 5, y + 6 + dy, 6, h - 12 - dy); ctx.fillStyle = sc; ctx.fillRect(x + 6, y + 7 + dy, 4, h - 14 - dy); }
    const sx = sc && w >= 48 ? 5 : 0, tw = w - 14 - sx * 2, mid = x + w / 2 + sx, cy = y + dy + Math.floor((h - dy) / 2);
    const fg = on ? "#fff" : "#8a8f99";
    if (sub && h >= 40) {
      txt(fitText(label, tw, 16), mid, cy - 18, fg, 16, "center", SY.ink);
      txt(fitText(sub, tw, 12), mid, cy + 1, on ? SY.gold : "#8a8f99", 12, "center", SY.ink);
    } else txt(fitText(label, tw, 16), mid, cy - 8, fg, 16, "center", SY.ink);
    if (act) shopBtn.push({ x, y, w, h, act, arg, i });
    return;
  }
  const cy = btnPx(x, y, w, h, col, pressed || (!on && kind === "steel"));
  const sx = col !== "steel" && w >= 64 ? 6 : 0, tw = w - 8 - sx * 2;             // 왼쪽 색 띠만큼 글자를 살짝 오른쪽으로
  if (sub && h >= 40) {
    btnTxt(fitText(label, tw, 16), x + w / 2 + sx, cy - 17, 16, on);
    btnTxt(fitText(sub, tw, 12), x + w / 2 + sx, cy + 2, 12, on);
  } else btnTxt(fitText(label, tw, 16), x + w / 2 + sx, cy - 8, 16, on);
  if (act) shopBtn.push({ x, y, w, h, act, arg, i });
}

// 공용 틀: 노란 머리띠(탭 + 닫기) + 왼쪽 분류(있으면) + 오른쪽 판. 각 자리를 돌려줌
//   cats: [{name, icon}] 또는 null(분류 없음) · sel: 고른 분류 · catAct: 분류를 눌렀을 때 동작 이름
export function townFrame(vw, vh, title, cats, sel, catAct, hint) {
  if (!S.townDimDone) { ctx.fillStyle = "rgba(10,11,14,0.72)"; ctx.fillRect(0, 0, vw, vh); }   // (draw.ts 가 이미 화면 전체를 어둡게 깔았으면 생략)
  if (kitOn()) return townFrameKit(vw, vh, title, cats, sel, catAct, hint);
  const narrow = vw < 560;
  const w = Math.min(720, vw - 16), h = Math.min(narrow ? 600 : 520, vh - 16);
  const short = h < 420;
  const x = Math.floor((vw - w) / 2), y = Math.floor((vh - h) / 2);
  S.shopRect = { x, y, w, h };
  panel(x, y, w, h);
  // 머리띠: 회색 철판 띠 (양 끝 리벳) — 레퍼런스 MENU 판
  const TH = short ? 36 : 42;
  ctx.fillStyle = MT.m; ctx.fillRect(x + 2, y + 2, w - 4, TH);
  ctx.fillStyle = MT.l; ctx.fillRect(x + 2, y + 2, w - 4, (TH / 2) & ~1);
  ctx.fillStyle = MT.hi; ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.fillStyle = MT.lo; ctx.fillRect(x + 2, y + TH - 2, w - 4, 4);
  ctx.fillStyle = SY.ink; ctx.fillRect(x + 2, y + TH + 2, w - 4, 2);
  rivet(x + 4, y + Math.floor(TH / 2) - 2);
  // 탭: 고른 탭은 판과 이어진 숯색, 나머지는 한 단 낮은 철판
  const act = townActive(), n = TOWN.length, gap = 4, closeW = TH - 8;
  const tabsW = Math.min(n * 112, w - 24 - closeW - 8 - (narrow ? 0 : 60));
  const tw = Math.floor((tabsW - gap * (n - 1)) / n);
  TOWN.forEach(([k, label], i) => {
    const tx = x + 12 + i * (tw + gap), on = k === act, ty = y + 8;
    if (on) {
      pxBox(tx, ty, tw, TH - 2, SY.ink);
      ctx.fillStyle = SY.body; ctx.fillRect(tx + 2, ty + 2, tw - 4, TH);
      ctx.fillStyle = SY.hi; ctx.fillRect(tx + 2, ty + 2, tw - 4, 2);
    } else {
      pxBox(tx, ty + 2, tw, TH - 10, SY.ink);
      ctx.fillStyle = MT.d; ctx.fillRect(tx + 2, ty + 4, tw - 4, TH - 14);
      ctx.fillStyle = MT.lo; ctx.fillRect(tx + 2, ty + 4, tw - 4, 2);
    }
    const img = TAB_IMG[k + (on ? "_on" : "_off")], inner = TH - 8;
    if (img && img.width > 1 && img.width <= tw - 6) {               // 탭 이름은 그림으로 박아 둔 로고 (글꼴 영향 없음)
      ctx.drawImage(img, tx + Math.floor((tw - img.width) / 2), ty + Math.floor((inner - img.height) / 2) + (on ? 1 : 2));
    } else txt(fitText(label, tw - 6, 12), tx + tw / 2, ty + Math.floor((inner - 12) / 2) + 1, on ? SY.y : "#fff", 12, "center", SY.ink);
    shopBtn.push({ x: tx, y, w: tw, h: TH, act: "town", arg: k });
  });
  // 경고 줄무늬 + 닫기(빨강 X)
  const cx = x + w - 10 - closeW, hzX = x + 12 + n * (tw + gap) + 6;
  if (cx - 8 - hzX >= 24) hazard(hzX, y + 10, Math.min(96, cx - 8 - hzX) & ~1, TH - 16);
  btnPx(cx, y + 6, closeW, TH - 8, "red");
  glyph(GLYPH.x, cx + Math.floor((closeW - 14) / 2), y + 6 + Math.floor((TH - 8 - 4 - 14) / 2), "#c42a3a");
  shopBtn.push({ x: cx - 4, y, w: closeW + 8, h: TH + 4, act: "close" });

  // 본문
  const by = y + TH + 10, bh = h - TH - 10 - 12;
  let lw = 0;
  if (cats) {                                                          // 왼쪽 분류 버튼
    lw = narrow ? 52 : 132;
    const ch = Math.max(30, Math.min(narrow ? 48 : 44, Math.floor((bh + 6) / cats.length) - 6));
    cats.forEach((c, i) => {
      const cy = by + i * (ch + 6), on = i === sel, bx = x + 10;
      // 분류 = 철판 버튼. 고른 것은 눌린 철판 + 주황 띠 + 주황 제목 글씨
      const mid = btnPx(bx, cy, lw, ch, on ? "orange" : "steel", on, true);
      if (on) { ctx.fillStyle = SY.y; for (let k = 0; k < 5; k++) ctx.fillRect(bx + lw + 2 + k * 2, mid - 10 + k * 2, 2, 20 - k * 4); }   // 목록 쪽 화살표
      const ib = ch - 10 >= 32 && narrow ? 32 : 16;
      if (narrow) drawPx(c.img || ICON[c.icon], bx + Math.floor((lw - ib) / 2), Math.round(mid - ib / 2), ib);
      else {
        const ix = bx + (on ? 14 : 8);
        drawPx(c.img || ICON[c.icon], ix, Math.round(mid - 16), 32);
        const nm = fitText(c.name, lw - (ix - bx) - 44, 16);
        if (on) titleTxt(nm, ix + 36, Math.round(mid - 8), 16); else btnTxt(nm, ix + 36, Math.round(mid - 8), 16, true, "left");
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
  titleTxt(fitText(title, rw - 60 - mw, 16), rx + 12, tY, 16);
  // 안내 한 줄 (판 맨 아래)
  const noteY = ry + rh - 20;
  if (S.msgT > 0) txt(fitText(S.msg, rw - 20, 12), rx + 10, noteY, SY.gold, 12);
  // 키 안내는 창 밖 아래에 작게 (자리가 있을 때만)
  if (hint && !S.usedTouch && vh - (y + h) >= 20) txt(hint, x + w, y + h + 6, SY.mute, 12, "right");
  return { x, y, w, h, narrow: narrow || rw < 420, short, cx: rx + 8, cy: ry + 32, cw: rw - 16, ch: rh - 32 - 24, rx, ry, rw, rh, noteY };
}

// PixelLab 부품으로 그린 틀 (배치·돌려주는 자리는 townFrame 과 같음)
function townFrameKit(vw, vh, title, cats, sel, catAct, hint) {
  const narrow = vw < 560;
  const w = Math.min(720, vw - 16), h = Math.min(narrow ? 600 : 520, vh - 16);
  const short = h < 420;
  const x = Math.floor((vw - w) / 2), y = Math.floor((vh - h) / 2);
  S.shopRect = { x, y, w, h };
  kit("window", x, y, w, h);                                          // 나무 + 철 모서리 창
  const FP = 18, TH = short ? 32 : 36;                               // 테두리 안쪽 여백 · 머리 줄 높이
  // 탭 (상점·제작·용광로·판매): 고른 탭은 주황 테두리
  const act = townActive(), n = TOWN.length, gap = 4, closeW = TH;
  const tabsW = Math.min(n * 112, w - 2 * FP - closeW - 8 - (narrow ? 0 : 60));
  const tw = Math.floor((tabsW - gap * (n - 1)) / n), ty = y + FP;
  TOWN.forEach(([k, label], i) => {
    const tx = x + FP + i * (tw + gap), on = k === act;
    kit(on ? "tab_on" : "tab", tx, ty, tw, TH);
    const img = TAB_IMG[k + (on ? "_on" : "_off")];
    if (img && img.width > 1 && img.width <= tw - 12) ctx.drawImage(img, tx + Math.floor((tw - img.width) / 2), ty + Math.floor((TH - img.height) / 2));
    else txt(fitText(label, tw - 12, 12), tx + tw / 2, ty + Math.floor((TH - 12) / 2), on ? SY.y : "#fff", 12, "center", SY.ink);
    shopBtn.push({ x: tx, y: ty, w: tw, h: TH, act: "town", arg: k });
  });
  const cx = x + w - FP - closeW, hzX = x + FP + n * (tw + gap) + 6;
  if (cx - 8 - hzX >= 24) hazard(hzX, ty + 8, Math.min(96, cx - 8 - hzX) & ~1, TH - 16);
  kit("close", cx, ty, closeW, TH);
  glyph(GLYPH.x, cx + Math.floor((closeW - 14) / 2), ty + Math.floor((TH - 14) / 2), "#f2606e");
  shopBtn.push({ x: cx - 4, y: ty - 4, w: closeW + 8, h: TH + 8, act: "close" });
  // 본문
  const by = ty + TH + 10, bh = y + h - 22 - by;                     // 아래 테두리(나무 + 철)가 위보다 두꺼워서 22
  let lw = 0;
  if (cats) {                                                          // 왼쪽 분류: 나무 탭, 고른 것은 주황 테두리
    lw = narrow ? 52 : 132;
    const cg = 4, ch = Math.max(20, Math.min(narrow ? 48 : 44, Math.floor((bh + cg) / cats.length) - cg));   // 낮은 화면(가로 휴대폰)에서도 분류가 다 들어가게
    cats.forEach((c, i) => {
      const cy = by + i * (ch + cg), on = i === sel, bx = x + FP;
      kit(on ? "tab_on" : "tab", bx, cy, lw, ch);
      const mid = cy + Math.floor(ch / 2);
      if (on) { ctx.fillStyle = SY.y; for (let k = 0; k < 5; k++) ctx.fillRect(bx + lw + 2 + k * 2, mid - 10 + k * 2, 2, 20 - k * 4); }
      const ib = ch - 10 >= 32 && narrow ? 32 : 16;
      if (narrow) drawPx(c.img || ICON[c.icon], bx + Math.floor((lw - ib) / 2), Math.round(mid - ib / 2), ib);
      else {
        const ix = bx + 10, is = ch >= 36 ? 32 : 16;                  // 칸이 낮으면 아이콘도 작게
        drawPx(c.img || ICON[c.icon], ix, Math.round(mid - is / 2), is);
        const nm = fitText(c.name, lw - (ix - bx) - is - 14, 16);
        if (on) titleTxt(nm, ix + is + 4, Math.round(mid - 8), 16); else txt(nm, ix + is + 4, Math.round(mid - 8), "#e6eaf2", 16, "left", SY.ink);
      }
      shopBtn.push({ x: bx, y: cy, w: lw, h: ch, act: catAct, arg: i });
    });
    lw += 16;
  }
  // 오른쪽 판: 창 안쪽 어두운 바닥 그대로 (제목 + 돈)
  const rx = x + FP + lw, ry = by, rw = x + w - FP - rx, rh = bh;
  const tY = ry + 4;
  setFont(16);
  const ms = money(P.money), mw = Math.ceil(ctx.measureText(ms).width);
  txt(ms, rx + rw - 6, tY, SY.gold, 16, "right", SY.ink);
  drawPx(ICON.coin, rx + rw - 6 - mw - 22, tY, 16);
  titleTxt(fitText(title, rw - 60 - mw, 16), rx + 4, tY, 16);
  const noteY = ry + rh - 18;
  if (S.msgT > 0) txt(fitText(S.msg, rw - 12, 12), rx + 4, noteY, SY.gold, 12, "left", SY.ink);
  if (hint && !S.usedTouch && vh - (y + h) >= 20) txt(hint, x + w, y + h + 6, SY.mute, 12, "right");
  return { x, y, w, h, narrow: narrow || rw < 420, short, cx: rx, cy: ry + 28, cw: rw, ch: rh - 28 - 22, rx, ry, rw, rh, noteY };
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
  if (kit("row", x, y, w, h)) {                                      // PixelLab 줄 판. 고른 줄은 노란 테두리 (주황 판은 글씨가 안 읽혀서)
    if (sel) { ctx.fillStyle = SY.y; ctx.fillRect(x + 2, y, w - 4, 2); ctx.fillRect(x + 2, y + h - 2, w - 4, 2); ctx.fillRect(x, y + 2, 2, h - 4); ctx.fillRect(x + w - 2, y + 2, 2, h - 4); }
    return;
  }
  ctx.fillStyle = k % 2 ? SY.row2 : SY.row; ctx.fillRect(x, y, w, h);
  if (sel) { ctx.fillStyle = SY.y; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); }
}
// 줄 안 글 두 줄(이름 16px + 설명 12px)을 줄 판의 가운데에. PixelLab 줄 판은 위아래 테두리(나무·철)가 두꺼워서
//   판 안쪽 높이가 모자라면 한 줄로: 이름 뒤에 설명을 작게 이어 씀 (테두리 위로 글자가 올라가지 않게)
const ROW_2LINE = () => (kitOn() ? 46 : 34);
function rowText(x, ry, inner, w, name, nameCol, desc, descCol) {
  if (inner >= ROW_2LINE()) {
    const t = ry + Math.floor((inner - 31) / 2);
    txt(fitText(name, w, 16), x, t, nameCol, 16);
    txt(fitText(desc, w, 12), x, t + 19, descCol, 12);
    return;
  }
  const t = ry + Math.floor((inner - 16) / 2);
  const nm = fitText(name, w, 16);
  txt(nm, x, t, nameCol, 16);
  setFont(16);
  const nw = Math.ceil(ctx.measureText(nm).width) + 10;
  if (desc && w - nw > 40) txt(fitText(desc, w - nw, 12), x + nw, t + 3, descCol, 12);
}
// 줄 판 오른쪽 끝 여백 (PixelLab 줄 판은 오른쪽 끝이 둥근 테두리라 조금 더 띄움)
const ROW_PAD = () => (kitOn() ? 14 : 8);

// 아이콘 칸 (파인 칸 + 그림)
function iconSlot(img, x, y, s, alpha) {
  if (kit("slot", x, y, s, s)) { drawPx(img, x + 4, y + 4, s - 8, alpha); return; }
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
// ---------------------------------------------------------------------
//  상점 (PC·넓은 화면, 시안 B 2026-11-27): 위 = 분류 아이콘 띠 · 가운데 = 장비 큰 카드 4장(아이콘 · 이름 · 값 · 버튼) · 아래 = 안내 띠 + 쪽
//  좁은 화면(휴대폰 세로)·UI 부품이 없을 때는 아래 drawShopList (왼쪽 분류 + 목록 줄)
// ---------------------------------------------------------------------
const SHOP_CARDS = 4;
export function drawShopModal(vw, vh) {
  if (!kitOn() || vw < 560) return drawShopList(vw, vh);             // vw 는 이미 UI 배율로 나눈 크기
  const cat = SHOP_TABS[S.shopTab], len = cat.ids.length;
  const f = townFrame(vw, vh, cat.name, null, 0, null, "[ ] 건물 이동 · ←→ 분류 · ↑↓ 고르기 · 휠·끌기 옆으로 · Enter 구매·장착 · Esc 닫기");
  if (f.narrow) return;                                              // (townFrame 이 좁다고 판단하면 위에서 걸러짐)
  const low = f.short;
  // 분류 아이콘 띠
  const n = SHOP_TABS.length, cg = 4, cw = Math.floor((f.cw - cg * (n - 1)) / n), chh = low ? 36 : 48;
  SHOP_TABS.forEach((c, i) => {
    const x = f.cx + i * (cw + cg), on = i === S.shopTab, is = low || cw < 44 ? 16 : 32;
    kit(on ? "tab_on" : "tab", x, f.cy, cw, chh);
    drawPx(catIcon(c.icon), x + Math.floor((cw - is) / 2), f.cy + Math.floor((chh - is) / 2), is);
    shopBtn.push({ x, y: f.cy, w: cw, h: chh, act: "tab", arg: i });
  });
  // 가진 개수 (제목 옆)
  if (!cat.cons) {
    const own = cat.ids.filter((id) => P.items[id]).length;
    setFont(16);
    const tw2 = Math.ceil(ctx.measureText(cat.name).width);
    txt(len + "개 중 " + own + "개 가짐", f.rx + 4 + tw2 + 12, f.ry + 7, SY.dim, 12, "left", SY.ink);
  }
  // 카드: 한 화면에 4장, 나머지는 옆으로 밀어서 (2026-11-28, 쪽 넘기기 대신 가로 스크롤)
  const per = cat.cons ? len : SHOP_CARDS;
  S.shopPer = per;
  const barH = 34, barY = f.ry + f.rh - barH, top = f.cy + chh + 10, ch = barY - 10 - top, gap = 10;   // 아래 띠는 판 맨 아래(안내 줄 자리까지)
  if (cat.cons) { S.shopStrip = null; shopConsGrid(f, cat, top, ch, low); shopBar(f, cat, barY, barH, 0); return; }
  const cwid = Math.floor((f.cw - gap * (per - 1)) / per), step = cwid + gap, maxS = Math.max(0, len - per);
  shopScrollTick(maxS, per);
  const sv = S.shopScrollV;
  S.shopStrip = { x: f.cx, y: top, w: f.cw, h: ch, step, max: maxS };   // input.ts: 이 안을 끌면 옆으로 밀기
  const ss = Math.max(40, Math.min(120, cwid - 40, ch - (low ? 112 : 172)));   // 아이콘 칸: 넉넉하게 (그림 64 둘레에 여백)
  const ib = ss >= 72 ? 64 : 32;
  const b0 = shopBtn.length;
  ctx.save();
  ctx.beginPath(); ctx.rect(f.cx - 2, top - 2, f.cw + 4, ch + 4); ctx.clip();   // 옆으로 밀려 나간 카드는 잘라서
  for (let i = Math.max(0, Math.floor(sv)); i < Math.min(len, Math.ceil(sv) + per); i++) {
    const id = cat.ids[i], it = ITEMS[id], x = Math.round(f.cx + (i - sv) * step), mid = x + Math.floor(cwid / 2);
    const owned = !!P.items[id], on = owned && !it.lv && (worn(id) || EQUIP_FIXED[id]);
    const locked = !owned && !reqMet(id), lv = it.lv ? itemLv(id) : 0;
    const cost = it.lv && owned ? lvCost(id, lv) : it.cost;          // 레벨 장비: 가진 뒤엔 다음 레벨 값
    const poor = !locked && P.money < cost, sel = i === S.shopSel;
    kit("detail", x, top, cwid, ch);
    if (sel) { ctx.fillStyle = SY.y; ctx.fillRect(x, top, cwid, 2); ctx.fillRect(x, top + ch - 2, cwid, 2); ctx.fillRect(x, top, 2, ch); ctx.fillRect(x + cwid - 2, top, 2, ch); }
    let y = top + (low ? 12 : 20);
    kit("slot", mid - Math.floor(ss / 2), y, ss, ss);
    drawPx(itemIcon(id), mid - ib / 2, y + Math.floor((ss - ib) / 2), ib, locked ? 0.35 : 1);
    y += ss + (low ? 6 : 12);
    setFont(16);
    const nsz = ctx.measureText(it.name).width <= cwid - 20 ? 16 : 12;   // 카드가 좁으면 긴 이름은 작은 글씨로 (…로 자르지 않게)
    txt(fitText(it.name, cwid - 16, nsz), mid, y + (nsz === 12 ? 3 : 0), locked ? SY.mute : SY.txt, nsz, "center", SY.ink);
    y += 22;
    const sl = SLOT_OF[id] ? SLOT_OF[id].slot : null;               // 이 아이템의 장비 칸 (기타 탭은 조명·특수가 섞여 있어서 아이템마다)
    if (sl) {                                                        // 장비 칸: 능력치 이름 + 값 (지금보다 좋으면 초록 + 차이)
      const v = it.fx[sl], cur = STAT[sl], better = !on && v > cur + 1e-9;
      if (!low) { txt(FX_NAME[sl], mid, y, SY.dim, 12, "center", SY.ink); y += 18; }
      txt(fxNum(sl, v) + (better ? "  (+" + fxNum(sl, v - cur) + ")" : ""), mid, y, better ? SY.green : on ? SY.y : SY.txt, 16, "center", SY.ink);
      y += 22;
    } else if (it.lv) {                                              // 레벨 장비: 대충 어떤 효과인지 + 레벨 막대
      txt(lvDesc(it), mid, y, SY.dim, 12, "center", SY.ink); y += 18;
      if (owned) {
        txt("Lv." + lv + " / " + LV_MAX, mid, y, lv >= LV_MAX ? SY.y : SY.green, 16, "center", SY.ink); y += 22;
        const bw0 = cwid - 40;
        ctx.fillStyle = SY.ink; ctx.fillRect(x + 20, y, bw0, 6);
        ctx.fillStyle = lv >= LV_MAX ? SY.y : SY.green; ctx.fillRect(x + 21, y + 1, Math.round((bw0 - 2) * lv / LV_MAX), 4);
        y += 14;
      }
    } else {
      txt(fitText(fxText(it.fx), cwid - 28, 12), mid, y, SY.dim, 12, "center", SY.ink);
      y += 18;
    }
    // 버튼 (카드 아래): 안 가진 것은 가격만 (구매·잠김 글자 없이, 못 사면 꺼진 버튼) · 레벨 장비는 다음 레벨 값
    const bh = low ? 36 : 44, bx = x + 16, bw = cwid - 32, by = top + ch - bh - (low ? 12 : 16), price = money(cost);
    if (locked && y + 14 <= by - 4) {                                  // 자리가 있을 때만 · 길면 '필요:' 를 빼고 (감정사 고글 Lv.100)
      setFont(12);
      const rq = ctx.measureText(reqText(it)).width <= cwid - 28 || it.req === "robot" ? reqText(it) : ITEMS[it.req].name + (ITEMS[it.req].lv ? " Lv." + LV_MAX : "");
      txt(fitText(rq, cwid - 28, 12), mid, y, SY.warn, 12, "center", SY.ink);
    }
    if (it.lv && lv >= LV_MAX) uiBtn(bx, by, bw, bh, "최대 레벨", null, "steel", false, null);
    else if (it.lv && owned) uiBtn(bx, by, bw, bh, price, null, "go", !poor, "buy", id);
    else if (on) uiBtn(bx, by, bw, bh, "장착 중", null, "steel", false, null);
    else if (owned) uiBtn(bx, by, bw, bh, "장착", null, "gold", true, "buy", id);
    else uiBtn(bx, by, bw, bh, price, null, "go", !locked && !poor, "buy", id);
    shopBtn.push({ x, y: top, w: cwid, h: by - top - 2, act: "sel", i });
  }
  ctx.restore();
  for (let k = shopBtn.length - 1; k >= b0; k--) {                   // 반쯤 밀려 나간 카드는 누르지 않게
    const q = shopBtn[k];
    if (q.x < f.cx - 4 || q.x + q.w > f.cx + f.cw + 4) shopBtn.splice(k, 1);
  }
  // 양 끝 그늘: 옆에 더 있다는 표시
  if (sv > 0.02) shopEdge(f.cx, top, ch, 1);
  if (sv < maxS - 0.02) shopEdge(f.cx + f.cw, top, ch, -1);
  shopBar(f, cat, barY, barH, maxS > 0 ? { sv, max: maxS, per, len } : 0);
}
// 상점 분류 아이콘: PixelLab 그림(ui/tab)이 있으면 그것, 없으면 예전 아이콘
const catIcon = (k) => (CAT_IMG[k] && CAT_IMG[k].width > 1 ? CAT_IMG[k] : ICON[k] || ICON.coin);
// 잠긴 상품의 안내: 로봇 장비는 로봇을 차고에서 사야 해서 그렇게 알려 줌
const reqText = (it) => (it.req === "robot" ? "필요: 로봇 (차고에서 구매)" : "필요: " + ITEMS[it.req].name + (ITEMS[it.req].lv ? " Lv." + LV_MAX : ""));
// 레벨 장비 설명은 대충 (숫자 없이)
const lvDesc = (it) => (it.fx.sell ? "골드 획득량 증가" : it.fx.lucky ? "행운 증가" : it.fx.eff ? "연비 개선" : "");
// 상점 가로 스크롤: S.shopScroll = 목표(카드 번호, 정수) · S.shopScrollV = 지금 그리는 자리(부드럽게 따라감)
export function shopScrollTick(maxS, per) {
  const now = performance.now(), dt = Math.min(0.1, (now - (S.shopScrollT || now)) / 1000);
  S.shopScrollT = now;
  if (S.shopScrollTab !== S.shopTab) { S.shopScrollTab = S.shopTab; S.shopScroll = S.shopScrollV = 0; S.shopSelSeen = -1; }
  if (S.shopSelSeen !== S.shopSel) {                                 // 키보드로 고른 카드가 화면 밖이면 그쪽으로 밀기
    S.shopSelSeen = S.shopSel;
    if (S.shopSel < S.shopScroll) S.shopScroll = S.shopSel;
    else if (S.shopSel > S.shopScroll + per - 1) S.shopScroll = S.shopSel - per + 1;
  }
  S.shopScroll = Math.max(0, Math.min(maxS, S.shopScroll || 0));
  if (S.shopDrag && S.shopDrag.moved) S.shopScrollV = S.shopScroll;   // 끄는 동안은 손가락 그대로
  else {
    const v = S.shopScrollV || 0, d = S.shopScroll - v;
    S.shopScrollV = Math.abs(d) < 0.002 ? S.shopScroll : v + d * Math.min(1, dt * 14);
  }
}
function shopEdge(x, y, h, dir) {
  const w = 18;
  const g = ctx.createLinearGradient(x, 0, x + dir * w, 0);
  g.addColorStop(0, "rgba(10,11,14,0.75)"); g.addColorStop(1, "rgba(10,11,14,0)");
  ctx.fillStyle = g; ctx.fillRect(dir > 0 ? x : x - w, y, w, h);
}
// 상점 아래 띠: 안내(또는 방금 메시지) + 오른쪽에 스크롤 막대(옆에 더 있을 때, 누르면 한 칸씩)
function shopBar(f, cat, by, barH, sc) {
  kit("bar", f.cx, by, f.cw, barH);
  const selIt = cat.cons && ITEMS[cat.ids[S.shopSel]];
  const tip = S.msgT > 0 ? S.msg : selIt ? selIt.name + " · " + selIt.desc : cat.slot ? "한 칸에 하나만 껴요 · 가진 장비는 [장착]으로 바꿔 끼기" : cat.cats.length > 1 ? "특수 장비는 또 사면 레벨 업 · Lv.100 이면 다음 장비가 열려요" : "산 장비는 바로 장착 · 빼려면 인벤토리 장비 탭";
  const pw = sc ? 170 : 0;
  txt(fitText(tip, f.cw - 48 - pw, 12), f.cx + 22, by + Math.floor((barH - 12) / 2), S.msgT > 0 ? SY.gold : SY.dim, 12, "left", SY.ink);
  if (sc) {
    const px = f.cx + f.cw - 22 - pw, pb = barH - 8, tx = px + 40, tw = pw - 80, ty = by + Math.floor(barH / 2) - 3;
    uiBtn(px, by + 4, 34, pb, "<", null, "plain", sc.sv > 0.02, "scroll", -1);
    uiBtn(px + pw - 34, by + 4, 34, pb, ">", null, "plain", sc.sv < sc.max - 0.02, "scroll", 1);
    ctx.fillStyle = SY.ink; ctx.fillRect(tx, ty, tw, 6);              // 막대: 전체 중 지금 보이는 4장 자리
    const kw = Math.max(12, Math.round((tw - 2) * sc.per / sc.len)), kx = tx + 1 + Math.round((tw - 2 - kw) * (sc.sv / sc.max));
    ctx.fillStyle = SY.y; ctx.fillRect(kx, ty + 1, kw, 4);
  }
}
// ---------------------------------------------------------------------
//  상점 소모품 (2026-11-28): 왼쪽 = 살 것 칸(4x2) · 오른쪽 = 내 가방(단축 슬롯 1~8 과 같은 순서)
//   사면 아이콘이 칸에서 가방 칸으로 날아가 들어가고(S.shopFly), 들어간 칸이 통 튐 → '내 인벤토리로 들어온다'는 느낌
// ---------------------------------------------------------------------
const consAt = {}, bagAt = {};                                      // 이번 그림에서 아이템별 아이콘 자리 (날아가는 그림의 출발·도착)
const FLY_MS = 420, POP_MS = 260;
function shopConsGrid(f, cat, top, ch, low) {
  const now = performance.now(), gap = 8;
  const bagW = Math.max(188, Math.min(300, Math.floor(f.cw * 0.30)));
  const lw = f.cw - bagW - gap * 2;
  const ids = cat.ids, flat = (ch - gap) / 2 < 112;                   // 낮은 판(휴대폰 가로): 2줄 x 4칸 대신 가로로 긴 줄 2열 x 4줄
  const cols = flat ? 2 : 4, rows = Math.ceil(ids.length / cols);
  const tw = Math.floor((lw - gap * (cols - 1)) / cols), th = Math.floor((ch - gap * (rows - 1)) / rows);
  const ss = th >= 150 ? 64 : th >= 120 ? 48 : 40, ib = ss >= 56 ? 32 : 32;
  const fly = (S.shopFly || []).filter((q) => now - q.t < FLY_MS);
  S.shopFly = fly;
  ids.forEach((id, i) => {
    const it = ITEMS[id], x = f.cx + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap), mid = x + Math.floor(tw / 2);
    const sel = i === S.shopSel, poor = P.money < it.cost;
    kit("detail", x, y, tw, th);
    if (sel) { ctx.fillStyle = SY.y; ctx.fillRect(x, y, tw, 2); ctx.fillRect(x, y + th - 2, tw, 2); ctx.fillRect(x, y, 2, th); ctx.fillRect(x + tw - 2, y, 2, th); }
    if (flat) {                                                      // 줄: [아이콘] 이름 ··· [가격]
      const fs = Math.min(44, th - 8), sx = x + 6, sy = y + Math.floor((th - fs) / 2), fi = fs >= 40 ? 32 : 16;
      kit("slot", sx, sy, fs, fs);
      drawPx(itemIcon(id), sx + (fs - fi) / 2, sy + (fs - fi) / 2, fi);
      consAt[id] = { x: sx + (fs - fi) / 2, y: sy + (fs - fi) / 2, s: fi };
      const bw = 84, bh = Math.min(40, th - 10), bx = x + tw - 6 - bw, nx = sx + fs + 8, nw = bx - 6 - nx;
      setFont(16);
      const nsz = ctx.measureText(it.name).width <= nw ? 16 : 12;
      txt(fitText(it.name, nw, nsz), nx, y + Math.floor((th - nsz) / 2) - 1, SY.txt, nsz, "left", SY.ink);
      uiBtn(bx, y + Math.floor((th - bh) / 2), bw, bh, money(it.cost), null, "go", !poor, "buy", id);
      shopBtn.push({ x, y, w: bx - x - 2, h: th, act: "sel", i });
      return;
    }
    const pad = th < 140 ? 8 : 14, sy = y + pad;
    kit("slot", mid - ss / 2, sy, ss, ss);
    drawPx(itemIcon(id), mid - ib / 2, sy + (ss - ib) / 2, ib);
    consAt[id] = { x: mid - ib / 2, y: sy + (ss - ib) / 2, s: ib };
    setFont(16);
    const nsz = ctx.measureText(it.name).width <= tw - 12 ? 16 : 12;
    txt(fitText(it.name, tw - (nsz === 12 ? 2 : 8), nsz), mid, sy + ss + 6 + (nsz === 12 ? 2 : 0), SY.txt, nsz, "center", SY.ink);
    const room = th - (ss + 26) - pad * 2;
    const bh = room >= 44 ? 40 : Math.max(28, Math.min(36, room - 4)), by = y + th - bh - pad;
    uiBtn(x + 10, by, tw - 20, bh, money(it.cost), null, "go", !poor, "buy", id);
    shopBtn.push({ x, y, w: tw, h: by - y - 2, act: "sel", i });
  });
  bagPanel(ids, f.cx + lw + gap * 2, top, bagW, ch, now, fly, true);
  drawFly(fly, now);
}
// 내 가방 판: 소모품 칸(단축 슬롯 1~8 순서) + 개수. tall = 세로로 긴 판(넓은 화면 오른쪽) / 아니면 한 줄 띠(좁은 화면 아래)
function bagPanel(ids, bx, top, bw, bh, now, fly, tall) {
  kit("window", bx, top, bw, bh);
  const own = ids.reduce((a, id) => a + (P.inv[id] || 0), 0);
  let gx0, gw, gy0, gc, sg = tall ? 10 : 4;                         // 칸 사이·판 테두리와 넉넉히 띄움 (빽빽해 보여서, 2026-11-28)
  if (tall) {
    titleTxt("내 가방", bx + 16, top + 14, 16);
    txt(own + "개", bx + bw - 16, top + 16, SY.dim, 12, "right", SY.ink);
    gx0 = bx + 18; gw = bw - 36; gy0 = top + 52; gc = 3;                // 3칸씩 (판이 낮으면 아래에서 4칸)
  } else {
    titleTxt("내 가방", bx + 12, top + 10, 16);
    txt(own + "개", bx + bw - 12, top + 12, SY.dim, 12, "right", SY.ink);
    gx0 = bx + 10; gw = bw - 20; gy0 = top + 32; gc = ids.length;
  }
  let cs = Math.min(tall ? 64 : 60, Math.floor((gw - sg * (gc - 1)) / gc));
  if (tall) {                                                        // 판이 낮으면(휴대폰 가로) 칸을 줄이고 4칸씩
    const fit = (c) => Math.floor((bh - (gy0 - top) - 10 - sg * (Math.ceil(ids.length / c) - 1)) / Math.ceil(ids.length / c));
    if (cs > fit(gc) && gc === 3) { gc = 4; sg = 8; cs = Math.min(60, Math.floor((gw - sg * 3) / 4)); }
    cs = Math.min(cs, fit(gc));
  }
  const gx = gx0 + Math.floor((gw - (cs * gc + sg * (gc - 1))) / 2);
  const pop = S.bagPop && now - S.bagPop.t < POP_MS ? S.bagPop : null;
  ids.forEach((id, i) => {
    const x = gx + (i % gc) * (cs + sg), y0 = gy0 + Math.floor(i / gc) * (cs + sg);
    const flying = fly.filter((q) => q.id === id).length, n = Math.max(0, (P.inv[id] || 0) - flying);   // 날아가는 중인 것은 도착하면 셈
    const pk = pop && pop.id === id ? Math.sin(((now - pop.t) / POP_MS) * Math.PI) : 0, y = y0 - Math.round(pk * 4);
    kit("slot2", x, y, cs, cs);
    const isz = cs >= 40 ? 32 : 16;
    drawPx(itemIcon(id), x + (cs - isz) / 2, y + (cs - isz) / 2, isz, n > 0 ? 1 : 0.18);   // 없는 것은 흐리게 (자리만)
    if (pk > 0) { ctx.globalAlpha = pk; ctx.fillStyle = SY.y; ctx.fillRect(x, y, cs, 2); ctx.fillRect(x, y + cs - 2, cs, 2); ctx.fillRect(x, y, 2, cs); ctx.fillRect(x + cs - 2, y, 2, cs); ctx.globalAlpha = 1; }
    if (n > 0) txt(cs >= 40 ? "x" + n : String(n), x + cs - (cs >= 48 ? 7 : 3), y + cs - (cs >= 48 ? 18 : 14), "#fff", 12, "right", SY.ink);
    bagAt[id] = { x: x + (cs - isz) / 2, y: y0 + (cs - isz) / 2, s: isz };
  });
  const ny = gy0 + Math.ceil(ids.length / gc) * (cs + sg) + 6;
  if (tall && ny + 34 <= top + bh - 16) {
    txt("광산에서 아래 슬롯(1~8)으로 써요", bx + bw / 2, ny, SY.dim, 12, "center", SY.ink);
    txt("최대 99개씩", bx + bw / 2, ny + 16, SY.mute, 12, "center", SY.ink);
  }
}
// 날아가는 아이콘 (살 것 칸 → 가방 칸, 위로 살짝 휘는 길). 도착하면 그 칸이 통 튐(S.bagPop)
function drawFly(fly, now) {
  for (const q of fly) {
    const a = consAt[q.id], b = bagAt[q.id];
    if (!a || !b) continue;
    const u = Math.min(1, (now - q.t) / FLY_MS), e = 1 - (1 - u) * (1 - u);
    const sz = Math.round((a.s + (b.s - a.s) * e) / 2) * 2;
    drawPx(itemIcon(q.id), a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e - Math.sin(u * Math.PI) * 60, sz);
    if (u > 0.9 && !(S.bagPop && S.bagPop.q === q)) S.bagPop = { id: q.id, t: now, q };
  }
}
// 좁은 화면: 왼쪽 분류 + 목록 줄 (예전 상점)
function drawShopList(vw, vh) {
  const cat = SHOP_TABS[S.shopTab];
  S.shopStrip = null;                                                // (휴대폰 목록은 위아래 목록 + 쪽)
  const f = townFrame(vw, vh, cat.name, SHOP_TABS.map((c) => ({ name: c.name, icon: c.icon, img: catIcon(c.icon) })), S.shopTab, "tab",
    "[ ] 건물 이동 · ←→ 분류 · ↑↓ 고르기 · Enter 구매 · Esc 닫기");
  // 한 쪽에 몇 줄: 창 높이에 맞춰 3~9줄 (예전엔 4줄 고정이라 빈 자리가 남아도 쪽을 넘겨야 했음)
  const len = cat.ids.length;
  const bagH = cat.cons && kitOn() ? 72 : 0, fch = f.ch - (bagH ? bagH + 8 : 0);   // 소모품: 아래에 '내 가방' 띠
  let per = Math.max(3, Math.min(9, Math.floor(fch / 52)));
  if (len > per) per = Math.max(3, Math.min(9, Math.floor((fch - 38) / 52)));
  if (bagH && fch / len >= 42) per = len;                            // 소모품은 줄을 조금 낮춰서라도 한 쪽에 다
  S.shopPer = per;
  const pages = Math.ceil(len / per), page = Math.floor(S.shopSel / per);
  const pagerH = pages > 1 ? 38 : 0;
  const rh = Math.max(40, Math.min(66, Math.floor((fch - pagerH) / Math.min(per, Math.max(4, len))))), inner = rh - 6;
  for (let k = 0; k < per; k++) {
    const i = page * per + k;
    if (i >= len) break;
    const id = cat.ids[i], it = ITEMS[id], ry = f.cy + k * rh;
    const owned = !it.cons && !!P.items[id];
    const locked = !it.cons && !owned && !reqMet(id), lv = it.lv ? itemLv(id) : 0;
    const cost = it.lv && owned ? lvCost(id, lv) : it.cost;
    const poor = (!owned || it.lv) && !locked && P.money < cost;
    townRow(f.cx, ry, f.cw, inner, i === S.shopSel, k);
    let lx = f.cx + 6;
    const ib = inner >= 44 ? Math.min(52, inner - 4) : 36 <= inner ? 36 : inner - 4;   // 줄이 높으면 아이콘도 크게 (드릴 그림이 가로로 길어서)
    iconSlot(itemIcon(id), lx, ry + Math.floor((inner - ib) / 2), ib, locked ? 0.35 : 1); lx += ib + 10;
    if (it.cons) consAt[id] = { x: lx + 4, y: ry + Math.floor((inner - ib) / 2) + 4, s: ib - 8 };
    // 오른쪽 버튼: 구매(가격) / 장착(가진 것, 눌러서 바꿔 끼기) / 장착 중 / 잠김
    const bw = f.narrow ? 92 : 104, bh = Math.min(inner - 6, 48), bx = f.cx + f.cw - 6 - bw, by2 = ry + Math.floor((inner - bh) / 2);   // 가격(4,300원 · 120억원)이 안 잘리게
    const price = money(cost), on = owned && !it.lv && worn(id);
    if (it.lv && lv >= LV_MAX) uiBtn(bx, by2, bw, bh, "최대", null, "steel", false, null);
    else if (it.lv && owned) uiBtn(bx, by2, bw, bh, price, null, "go", !poor, "buy", id);   // 레벨 장비: 다음 레벨 값
    else if (on || (owned && EQUIP_FIXED[id])) uiBtn(bx, by2, bw, bh, "장착 중", null, "steel", false, null);
    else if (owned) uiBtn(bx, by2, bw, bh, "장착", null, "gold", true, "buy", id);
    else uiBtn(bx, by2, bw, bh, price, null, "go", !locked && !poor, "buy", id);   // 가격만 (구매·잠김 글자 없이)
    // 이름 + 설명
    const nameW = bx - 10 - lx;
    const sl = SLOT_OF[id] ? SLOT_OF[id].slot : null, cur = sl ? STAT[sl] : null;   // 장비 칸: 고유 값 + 지금 능력치 (비교)
    const sub = locked ? reqText(it) : it.cons ? it.desc : it.lv ? lvDesc(it) + (owned ? " · Lv." + lv + "/" + LV_MAX : "") : fxText(it.fx, sl) + (sl && !on ? "  (지금 " + fxNum(sl, cur) + ")" : "");
    const cnt = it.cons && !bagH ? "  x" + (P.inv[id] || 0) : "";   // 가방 띠가 있으면 개수는 거기서
    rowText(lx, ry, inner, nameW, it.name + cnt, locked ? SY.mute : SY.txt, sub, locked ? SY.warn : poor ? SY.red : SY.dim);
    shopBtn.push({ x: f.cx, y: ry, w: bx - f.cx - 4, h: inner, act: "sel", i });
  }
  if (pages > 1) pager(f, page, pages, "page");
  if (bagH) {                                                        // 내 가방 띠 (사면 여기로 날아 들어옴)
    const now = performance.now(), fly = (S.shopFly || []).filter((q) => now - q.t < FLY_MS);
    S.shopFly = fly;
    bagPanel(cat.ids, f.cx, f.cy + f.ch - bagH, f.cw, bagH, now, fly, false);
    drawFly(fly, now);
  }
  if (!(S.msgT > 0)) {
    const it = ITEMS[cat.ids[Math.min(S.shopSel, len - 1)]];
    const tip = it.cons ? "소모품은 여러 개 살 수 있어요 · 아래 슬롯(1~8)으로 사용" : cat.slot ? "한 칸에 하나만 껴요 · 산 장비는 바로 장착 · 가진 장비는 [장착]으로 바꿔 끼기" : cat.cats && cat.cats.length > 1 ? "특수 장비는 또 사면 레벨 업 · Lv.100 이면 다음 장비가 열려요" : cat.ids.length && !it.cons ? "산 장비는 바로 장착 · 빼려면 인벤토리 장비 탭" : "";
    txt(fitText(tip, f.cw, 12), f.cx, f.noteY, SY.mute, 12);
  }
}

// ---------------------------------------------------------------------
//  제작소: 왼쪽 분류 → 오른쪽 제작 트리 + 아래 상세 — 판매 탭도 같은 상태(craft)를 써서 여기서 나눠 그림
// ---------------------------------------------------------------------
export function drawCraftModal(vw, vh) {
  if (S.craftTab === RECIPE_CATS.length) return drawSellModal(vw, vh);
  const cat = RECIPE_CATS[S.craftTab];
  const f = townFrame(vw, vh, "제작 · " + cat.name, RECIPE_CATS.map((c) => ({ name: c.name, icon: c.icon, img: CAT_IMG["craft_" + c.icon] && CAT_IMG["craft_" + c.icon].width > 1 ? CAT_IMG["craft_" + c.icon] : null })), S.craftTab, "tab",
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
    const nameW = b1x - 8 - lx;
    rowText(lx, ry, inner, nameW, matName(id) + "  x" + have, have > 0 ? SY.txt : SY.mute, "개당 " + money(unit) + (BARS[id] ? " · 원석보다 35% 비쌈" : ""), have > 0 ? SY.gold : SY.mute);
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
    uiBtn(bx, by2, bw, bh, "납품", bh >= 40 ? money(orderPay(o)) : null, "go", ok, "order", k);
    const nameW = bx - 8 - lx;
    rowText(lx, ry, inner, nameW, matName(o.k) + " " + o.n + "개", SY.txt, "가진 것 " + have + " / " + o.n + "  ·  보상 " + money(orderPay(o)) + " · 경험치 " + o.xp, ok ? SY.green : SY.dim);
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
//  용광로 (원석 2개 + 석탄 → 주괴 1개) — 마인크래프트 화로처럼 한눈에:
//    위: 만들 주괴 고르기(가로 칸 5개) · 가운데: 화로 [넣은 원석] + [불] + [석탄] → (진행 화살표) → [나온 주괴] · 대기열 칸
//    아래: 넣기 1개 / 5개 / 최대 / 비우기 + 강화
// ---------------------------------------------------------------------
// 불꽃 (2px 도트, 켜져 있으면 흔들림 · 꺼져 있으면 회색 숯)
function furnaceFlame(x, y, on, u = 2) {
  const t = S.animT || 0, k = on ? Math.floor(t * 8) % 3 : 0;
  const cols = on ? ["#ff5a1f", "#ffa21a", "#ffe066"] : ["#3a3f4b", "#4c5362", "#5b606e"];
  const rows = [[3, 5], [2, 7], [1, 9], [1, 9], [0, 11], [0, 11], [1, 9], [2, 7]];   // 아래에서 위로 넓어졌다 좁아지는 혀 모양
  const lift = on ? [0, 1, 0][k] : 0;
  rows.forEach(([a, w], i) => {
    const yy = y + (rows.length - 1 - i) * u - lift * u;
    if (on && i === rows.length - 1 && k === 2) return;               // 맨 위 한 줄은 깜박
    ctx.fillStyle = cols[0]; ctx.fillRect(x + a * u, yy, w * u, u);
    if (w > 4) { ctx.fillStyle = cols[1]; ctx.fillRect(x + (a + 2) * u, yy, (w - 4) * u, u); }
    if (w > 7 && i < 6) { ctx.fillStyle = cols[2]; ctx.fillRect(x + (a + 3) * u + (k === 1 ? u : 0), yy, (w - 7) * u, u); }
  });
}
// 진행 화살표 (빈 회색 → 주황으로 차오름)
function furnaceArrow(x, y, w, h, p) {
  const sh = Math.floor(h / 3), hw = Math.floor(h * 0.7), mid = y + Math.floor(h / 2);
  const draw = (col, upto) => {
    ctx.fillStyle = col;
    const sw = Math.max(0, Math.min(w - hw, upto));
    if (sw > 0) ctx.fillRect(x, mid - (sh >> 1), sw, sh);
    for (let i = 0; i < hw; i += 2) {                                 // 화살촉: 2px 계단
      if (x + w - hw + i >= x + upto) break;
      const half = Math.floor((h / 2) * (1 - i / hw));
      ctx.fillRect(x + w - hw + i, mid - half, 2, half * 2);
    }
  };
  ctx.fillStyle = SY.ink; ctx.fillRect(x - 2, mid - (sh >> 1) - 2, w - hw + 2, sh + 4);
  draw("#3a3f4b", w);
  draw("#ffa21a", Math.round(w * p));
}
// 칸 안 오른쪽 아래 개수 (검은 그림자)
function slotCount(n, x, y, s) { if (n > 0) txt(String(n), x + s - 5, y + s - 18, "#fff", 16, "right", SY.ink); }

export function drawFurnaceModal(vw, vh) {
  const F = S.acct.furnace, L = FURNACE_LV[F.lv], nx = FURNACE_LV[F.lv + 1];
  const f = townFrame(vw, vh, "용광로 · Lv." + F.lv, null, 0, null, "[ ] 건물 이동 · ←→ 주괴 고르기 · 1 / 5 / Enter 넣기 · U 강화 · K 성공률 · Esc 닫기");
  const narrow = f.narrow, low = f.short && !narrow, gap = 8;          // low: 낮은 화면(가로 휴대폰) → 칸·화로를 작게
  const sel = BAR_KEYS[S.furnaceSel] || BAR_KEYS[0], SB = BARS[sel], canSel = furnaceCan(sel);

  // ---- 위: 만들 주괴 고르기 (가로 칸) ----
  const n = BAR_KEYS.length, tw = Math.floor((f.cw - gap * (n - 1)) / n), th = narrow ? 64 : low ? 50 : 86;
  BAR_KEYS.forEach((k, i) => {
    const B = BARS[k], x = f.cx + i * (tw + gap), y = f.cy, can = furnaceCan(k), on = i === S.furnaceSel;
    kit(on ? "tab_on" : "tab", x, y, tw, th) || (ctx.fillStyle = SY.row, ctx.fillRect(x, y, tw, th));
    const ic = narrow || low ? 24 : 32, top = y + (narrow ? 8 : low ? 7 : 10);
    if (narrow) drawPx(barIcon[k], x + Math.floor((tw - ic) / 2), top, ic);
    else {                                                            // 원석 → 주괴
      const w0 = ic * 2 + 14, x0 = x + Math.floor((tw - w0) / 2);
      drawPx(oreIcon[B.ore], x0, top, ic, can > 0 ? 1 : 0.5);
      ctx.fillStyle = "#ff9a4d"; ctx.fillRect(x0 + ic + 3, top + ic / 2 - 1, 6, 2); ctx.fillRect(x0 + ic + 7, top + ic / 2 - 3, 2, 6);
      drawPx(barIcon[k], x0 + ic + 14, top, ic);
    }
    if (!narrow && !low) txt(fitText(B.name, tw - 12, 12), x + tw / 2, top + ic + 4, on ? SY.y : SY.txt, 12, "center", SY.ink);
    txt((narrow ? "" : "가능 ") + can, x + tw / 2, y + th - (narrow ? 22 : low ? 18 : 20), can > 0 ? SY.green : SY.mute, 12, "center", SY.ink);
    shopBtn.push({ x, y, w: tw, h: th, act: "fsel", i });
  });

  // ---- 가운데: 화로 ----
  const bh = narrow ? 92 : 48;                                        // 아래 버튼 줄 높이 (좁으면 두 줄)
  const py = f.cy + th + 10, ph = f.cy + f.ch - bh - 10 - py;
  kit("detail", f.cx, py, f.cw, ph) || well(f.cx, py, f.cw, ph);
  const job = F.q[0], JB = job ? BARS[job.m] : null;
  const showK = job ? job.m : sel, show = BARS[showK];
  const ss = narrow ? 52 : low ? 36 : 64, os = narrow ? 68 : low ? 48 : 84, fu = low ? 2 : 3;   // 넣는 칸 · 나오는 칸 크기 · 불꽃 도트
  const fh = 8 * fu + 8, colH = ss * 2 + fh;
  const inX = f.cx + (narrow ? 30 : 48);
  const inY = narrow ? py + 26 : py + Math.floor((ph - colH) / 2), midY = inY + Math.floor(colH / 2), fuelY = inY + ss + fh;   // 좁으면 화로를 판 위쪽에, 아래에 상태·대기열
  // 넣은 원석 (재련 중이면 화로 안의 것, 쉬는 중이면 고른 주괴의 원석을 흐리게)
  const qSame = job ? F.q.filter((q) => q.m === job.m).length : 0, coalIn = F.q.reduce((a, q) => a + BARS[q.m].coal, 0);
  kit("slot", inX, inY, ss, ss);
  drawPx(oreIcon[show.ore], inX + 6, inY + 6, ss - 12, job ? 1 : 0.35);
  slotCount(job ? qSame * ORE_PER_BAR : 0, inX, inY, ss);
  furnaceFlame(inX + Math.floor((ss - 11 * fu) / 2), inY + ss + 4, !!job, fu);
  kit("slot", inX, fuelY, ss, ss);
  drawPx(oreIcon[6], inX + 6, fuelY + 6, ss - 12, job ? 1 : 0.35);
  slotCount(coalIn, inX, fuelY, ss);
  // 화살표 → 나온 주괴
  const outX = narrow ? f.cx + f.cw - os - 30 : inX + ss + (low ? 110 : 170), outY = midY - Math.floor(os / 2);
  const ax = inX + ss + 18, aw = outX - 18 - ax, p = job ? 1 - job.left / JB.time : 0, ah = narrow ? 24 : 32;
  furnaceArrow(ax, midY - ah / 2, aw, ah, p);
  kit("slot", outX, outY, os, os);
  drawPx(barIcon[showK], outX + 8, outY + 8, os - 16);
  slotCount(P.bars[showK] || 0, outX, outY, os);
  if (!narrow && !low) txt("보유", outX + os / 2, outY + os + 4, SY.dim, 12, "center", SY.ink);
  // 오른쪽(좁으면 아래 줄): 상태 · 대기열 칸
  const sx = narrow ? f.cx + 22 : outX + os + 36, sw = narrow ? f.cw - 44 : f.cx + f.cw - 22 - sx;
  let sy = narrow ? inY + colH + 18 : py + (low ? 14 : 22);          // 좁은 화면은 화로 아래에 상태 + 대기열
  const left = job ? Math.ceil(F.q.reduce((a, q) => a + q.left, 0) / L.speed) : 0;
  txt(fitText(job ? "재련 중 · " + JB.name : "쉬는 중", sw, 16), sx, sy, job ? SY.gold : SY.txt, 16, "left", SY.ink);
  txt(fitText(job ? "남은 약 " + left + "초 · 속도 x" + L.speed : "원석 " + ORE_PER_BAR + "개 + 석탄 → 주괴 1개", sw, 12), sx, sy + 22, SY.dim, 12, "left", SY.ink);
  // 성공률 + 숙련 강화 (돈 + 주괴): 성공하면 주괴 값이 재료의 BAR_MULT 배, 실패하면 재료만 날아감
  const sk = F.skill || 0, sc = SKILL_COST[sk], rate = Math.round(smeltRate(showK) * 100);
  txt(fitText("성공률 " + rate + "% · 성공하면 값 ×" + BAR_MULT + " · 숙련 Lv." + sk, sw, 12), sx, sy + (low ? 38 : 40), SY.gold, 12, "left", SY.ink);
  sy += low ? 56 : narrow ? 60 : 62;
  if (!narrow) {                                                     // (좁은 화면은 아래 버튼 줄에 강화와 반씩)
    const kw = Math.min(sw, 280), kh = low ? 30 : 40, canK = !!sc && P.money >= sc.money && (P.bars[sc.bar] || 0) >= sc.n;
    const sub = sc ? money(sc.money) + " + " + BARS[sc.bar].name + " " + sc.n : null;
    if (!sc) uiBtn(sx, sy, kw, kh, "성공률 최고", null, "steel", false, null);
    else if (kh >= 40) uiBtn(sx, sy, kw, kh, "성공률 +" + Math.round(SKILL_STEP * 100) + "%", sub, "gold", canK, "fskill");
    else uiBtn(sx, sy, kw, kh, fitText("성공률 +5% · " + sub, kw - 20, 12), null, "gold", canK, "fskill");
    if (sy + kh + 10 + 18 + 24 > py + ph - 6) txt("대기 " + F.q.length + " / " + L.cap, sx + kw + 12, sy + Math.floor(kh / 2) - 6, SY.dim, 12, "left", SY.ink);   // 낮은 화면: 대기 칸 대신 버튼 옆에 개수만
    sy += kh + 10;
  }
  const qRoom = sy + 18 + 24 <= py + ph - 6;
  if (qRoom || narrow) txt("대기 " + F.q.length + " / " + L.cap, sx, sy, SY.dim, 12, "left", SY.ink);
  const qs = 24, per = Math.max(1, Math.floor((sw + 4) / (qs + 4))), rowsQ = qRoom || narrow ? Math.max(1, Math.min(3, Math.floor((py + ph - 22 - (sy + 18)) / (qs + 4)))) : 0;
  const shown = Math.min(L.cap, per * rowsQ);
  for (let i = 0; i < shown; i++) {                                   // 대기열 칸: 들어간 주괴(맨 앞은 진행 막대)
    const qx = sx + (i % per) * (qs + 4), qy = sy + 18 + Math.floor(i / per) * (qs + 4), q = F.q[i];
    ctx.fillStyle = SY.ink; ctx.fillRect(qx, qy, qs, qs);
    ctx.fillStyle = q ? "#2a2e37" : "#1d2027"; ctx.fillRect(qx + 2, qy + 2, qs - 4, qs - 4);
    if (q) {
      drawPx(barIcon[q.m], qx + 4, qy + 4, 16);
      if (i === 0) { ctx.fillStyle = "#ffa21a"; ctx.fillRect(qx + 2, qy + qs - 4, Math.round((qs - 4) * p), 2); }
    }
  }
  if (L.cap > shown && F.q.length > shown) txt("+" + (F.q.length - shown), sx + per * (qs + 4), sy + 22, SY.dim, 12, "left", SY.ink);

  // ---- 아래: 넣기 버튼 · 강화 ----
  const full = F.q.length >= L.cap;
  const note = full ? "대기열이 가득 찼어요 · 강화하면 더 넣을 수 있어요"
    : canSel <= 0 ? TILE[SB.ore].name + " " + ORE_PER_BAR + "개 + 석탄 " + SB.coal + "개가 있어야 1개를 만들어요"
    : "창고: " + TILE[SB.ore].name + " " + (P.stash[SB.ore] || 0) + "개 · 석탄 " + (P.stash[6] || 0) + "개";
  const by = f.cy + f.ch - bh, upW = narrow ? f.cw : 124;
  const btns = [["1개", 1, "go"], ["5개", 5, "go"], ["최대", Infinity, "go"]];
  const bw = narrow ? Math.floor((f.cw - gap * 3) / 4) : 80;
  let bx = f.cx;
  if (!narrow) { txt(fitText(SB.name + " 넣기", 200, 16), f.cx, by + 4, SY.txt, 16, "left", SY.ink); txt(fitText(note, f.cw - upW - 4 * (bw + gap) - 16, 12), f.cx, by + 26, canSel > 0 && !full ? SY.dim : SY.warn, 12, "left", SY.ink); bx = f.cx + f.cw - upW - gap - 4 * (bw + gap); }
  const bY = narrow ? by : by, bH = narrow ? 42 : bh;
  for (const [lab, v, kind] of btns) { uiBtn(bx, bY, bw, bH, lab, v === Infinity && bH >= 40 ? canSel + "개" : null, kind, canSel >= 1 && !full, "smelt", v); bx += bw + gap; }
  uiBtn(bx, bY, bw, bH, "비우기", null, "danger", F.q.length > 0, "fclear"); bx += bw + gap;
  const upY = narrow ? by + 48 : by, upLabel = !nx ? "최고 단계" : "강화 Lv." + (F.lv + 1);
  if (narrow) {                                                      // 좁은 화면: 강화 | 성공률 반씩
    const hw = Math.floor((f.cw - gap) / 2), canK = !!sc && P.money >= sc.money && (P.bars[sc.bar] || 0) >= sc.n;
    uiBtn(f.cx, upY, hw, 42, upLabel, nx ? money(nx.cost) : null, "gold", !!nx && P.money >= nx.cost, nx ? "fup" : null);
    uiBtn(f.cx + hw + gap, upY, hw, 42, sc ? "성공률 +5%" : "성공률 최고", sc ? fitText(money(sc.money) + " + " + BARS[sc.bar].name.replace(" 주괴", "") + " " + sc.n, hw - 24, 12) : null, sc ? "gold" : "steel", canK, sc ? "fskill" : null);
  } else uiBtn(bx, upY, upW, bh, upLabel, nx ? money(nx.cost) : null, "gold", !!nx && P.money >= nx.cost, nx ? "fup" : null);
  if (narrow && !(S.msgT > 0)) txt(fitText(note, f.cw, 12), f.cx, f.noteY, canSel > 0 && !full ? SY.dim : SY.warn, 12);
}
