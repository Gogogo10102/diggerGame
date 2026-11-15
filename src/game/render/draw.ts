// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./util.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { BLD_FX, SIGN_IMG, fxText, plinthLow, plinthTop } from "../art/buildings.ts";
import { FLAME, itemIcon } from "../art/itemIcons.ts";
import { CLOUDS, DIRT_VAR, ICON, ORE_SPR, SKY, SPARK_ORES, backTiles, bedrock, cloudImg, cracks, decoFor, dirtTiles, oreIcon, getMiner, MINER_SZ, MINER_BOX, grassTiles, hardTiles, hv, stoneTiles, sunImg } from "../art/sprites.ts";
import { AS, B_CRAFT, B_FURN, B_SHOP, BUILD_COLS, H, HH, layerOf, LAYERS, MINE_COL, PX, SURF, T, TILE, W } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { SHOP_PER, STAT, bombs, cargoCap, cargoCount, curZoom, drillMult, flashes, floaters, maxFuel, parts } from "../core/stats.ts";
import { ensureRect, hardOf, isAir, seen, tiles } from "../core/world.ts";
import { HOT, LOOK, VIS_BASE, visR } from "../data/consumables.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { MAX_LV, levelOf, titleName } from "../data/progress.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { GLYPH, SY, btnPx, ctx, cv, gg, glyph, gridCv, hazard, icon, keycap, lg, lightCv, panel, pbar, plate, pxBox, segBar, setFont, txt } from "./util.ts";
import { DEBRIS_T, debrisT, dust } from "../systems/collapseFx.ts";
import { drawDrops } from "../systems/drops.ts";
import { chunks, floatT, solidTile } from "../systems/floating.ts";
import { BARS, furnaceImg, matHave, matIcon, matName } from "../systems/furnace.ts";
import { STICK_R, U_, shopBtn, touch } from "../systems/input.ts";
import { drawCraftModal, drawFurnaceModal, drawShopModal, fitText } from "./townUI.ts";
import { drawMapModal, drawMinimap } from "./minimap.ts";
import { SELL_KEYS, stashValue, unitPrice } from "../systems/town.ts";
import { ov } from "../ui/overlay.ts";

// =====================================================================
//  렌더링
// =====================================================================
// =====================================================================
//  부드러운 굴 가장자리 (Chipmatic 느낌)
//  - 흙 칸에서 '보이는 빈칸'(판 굴·발견한 동굴) 쪽 면(옆벽·천장)을 그림 2~5칸(화면 8~20px) 깎아 내고, 깎인 자리에 굴 배경을 그림.
//    바닥(흙 칸의 윗면)은 캐릭터가 딛는 곳이라 평평하게 둠(모서리만 둥글게).
//    그래서 한 칸을 파면 옆 흙들이 같이 작아지면서 통로가 블록보다 넓고 둥글어 보임. (충돌은 그대로 칸 단위)
//  - 깎는 깊이는 '세상 좌표'로 정해서 이웃 칸끼리 굴 벽이 끊김 없이 이어짐. 볼록한 모서리는 둥글게.
//  - 파는 중인 칸은 드릴 쪽부터 진행도만큼 더 깎여 들어감.
//  - 아직 못 본 동굴 쪽은 깎지 않음(동굴 위치가 새면 안 됨).
// =====================================================================
const EDGE_CACHE = new Map();
function edgeHash(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h >>> 16) & 3;
}
// 경계선 line 위, 그림 좌표 along 에서 깎는 깊이 (2~5칸). 6칸마다 정한 값을 부드럽게 이어서 이빨처럼 들쭉날쭉하지 않고 물결처럼
function edgeDepth(along, line) {
  const k = Math.floor(along / 6), f = (along - k * 6) / 6, s2 = f * f * (3 - 2 * f);
  const v = edgeHash(k, line) * (1 - s2) + edgeHash(k + 1, line) * s2;    // 0~3
  return 2 + Math.round(v);
}
const seenAir = (c, r) => isAir(c, r) && seen[r * W + c] === 1;
function edgePaths(c, r, bits, dig, digSide) {
  const key = c + "," + r + "," + bits + "," + dig + "," + digSide;
  let e = EDGE_CACHE.get(key);
  if (e) return e;
  const aT = bits & 1, aB = bits & 2, aL = bits & 4, aR = bits & 8, dTL = bits & 16, dTR = bits & 32, dBL = bits & 64, dBR = bits & 128;
  const cut = new Uint8Array(256), X0 = c * 16, Y0 = r * 16, RC = 6;
  const extra = (side) => (side === digSide ? dig : 0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = X0 + x, Y = Y0 + y;
    let k = 0;
    if (digSide === 1 && y < extra(1)) k = 1;            // 윗면 = 위 굴의 바닥: 캐릭터가 딛고 서는 곳이라 깎지 않음(뜬 것처럼 보이지 않게)
    if ((aB || digSide === 2) && 15 - y < (aB ? edgeDepth(X, r * 2 + 2) : 0) + extra(2)) k = 1;
    if ((aL || digSide === 4) && x < (aL ? edgeDepth(Y, 100003 + c * 2) : 0) + extra(4)) k = 1;
    if ((aR || digSide === 8) && 15 - x < (aR ? edgeDepth(Y, 100003 + c * 2 + 2) : 0) + extra(8)) k = 1;
    // 볼록한 모서리(두 면이 빈칸)는 둥글게
    const rnd = (cx, cy) => (cx - x - 0.5) * (cx - x - 0.5) + (cy - y - 0.5) * (cy - y - 0.5) > RC * RC;
    if (aT && aL && x < RC && y < RC && rnd(RC, RC)) k = 1;
    if (aT && aR && x >= 16 - RC && y < RC && rnd(16 - RC, RC)) k = 1;
    if (aB && aL && x < RC && y >= 16 - RC && rnd(RC, 16 - RC)) k = 1;
    if (aB && aR && x >= 16 - RC && y >= 16 - RC && rnd(16 - RC, 16 - RC)) k = 1;
    // 대각선만 빈칸인 안쪽 모서리: 이웃 칸들이 깎인 만큼 이어서 깎되 꼭짓점 한 칸은 남겨 살짝 둥글게
    //   (xx, yy) = 그 모서리에서 잰 거리, dx/dy = 이웃 칸들이 깎인 깊이
    const notch = (xx, yy, dx, dy) => xx < dx && yy < dy && !(xx === dx - 1 && yy === dy - 1);
    const dL = () => edgeDepth(Y, 100003 + c * 2), dR = () => edgeDepth(Y, 100003 + c * 2 + 2);
    const dT = () => edgeDepth(X, r * 2), dB = () => edgeDepth(X, r * 2 + 2);
    if (dTL && !aT && !aL && notch(x, y, dL(), 1)) k = 1;
    if (dTR && !aT && !aR && notch(15 - x, y, dR(), 1)) k = 1;
    if (dBL && !aB && !aL && notch(x, 15 - y, dL(), dB())) k = 1;
    if (dBR && !aB && !aR && notch(15 - x, 15 - y, dR(), dB())) k = 1;
    cut[y * 16 + x] = k;
  }
  const cutP = new Path2D(), line = new Path2D(), lit = new Path2D(), shade = new Path2D(), u = AS;
  for (let y = 0; y < 16; y++) {
    let x0 = -1;
    for (let x = 0; x <= 16; x++) {
      const on = x < 16 && cut[y * 16 + x];
      if (on && x0 < 0) x0 = x;
      if (!on && x0 >= 0) { cutP.rect(x0 * u, y * u, (x - x0) * u, u); x0 = -1; }
    }
  }
  const isCut = (x, y) => x >= 0 && x < 16 && y >= 0 && y < 16 && cut[y * 16 + x] === 1;
  if (aT) for (let x = 0; x < 16; x++) if (!cut[x]) { line.rect(x * u, 0, u, 2); lit.rect(x * u, 2, u, 2); }   // 깎지 않은 바닥에도 윤곽 + 빛
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (cut[y * 16 + x]) continue;
    const px = x * u, py = y * u;
    if (isCut(x, y - 1)) { line.rect(px, py, u, 2); lit.rect(px, py + 2, u, 2); }      // 바닥 면: 윤곽 + 위에서 오는 빛
    if (isCut(x, y + 1)) { line.rect(px, py + u - 2, u, 2); shade.rect(px, py - 2, u, 4); }   // 천장 면: 윤곽 + 그늘
    if (isCut(x - 1, y)) line.rect(px, py, 2, u);
    if (isCut(x + 1, y)) { line.rect(px + u - 2, py, 2, u); shade.rect(px + u - 4, py, 2, u); }
  }
  e = { cut: cutP, line, lit, shade, any: cut.some((v) => v) };
  if (EDGE_CACHE.size > 6000) EDGE_CACHE.clear();
  EDGE_CACHE.set(key, e);
  return e;
}
function softEdge(c, r, px, py, id) {
  if (typeof Path2D === "undefined") return;
  let bits = 0;
  if (seenAir(c, r - 1)) bits |= 1;
  if (seenAir(c, r + 1)) bits |= 2;
  if (seenAir(c - 1, r)) bits |= 4;
  if (seenAir(c + 1, r)) bits |= 8;
  if (seenAir(c - 1, r - 1)) bits |= 16;
  if (seenAir(c + 1, r - 1)) bits |= 32;
  if (seenAir(c - 1, r + 1)) bits |= 64;
  if (seenAir(c + 1, r + 1)) bits |= 128;
  // 파는 중인 칸: 드릴이 닿은 쪽(플레이어 쪽)부터 진행도만큼 더 깎음 (0~8칸)
  let dig = 0, side = 0;
  if (S.dig && S.dig.c === c && S.dig.r === r) {
    const need = Math.max(0.01, hardOf(id, r) / drillMult());
    dig = Math.min(8, Math.round(Math.min(1, S.dig.t / need) * 8));
    const pc = P.x / T, pr = P.y / T;
    side = Math.abs(pc - (c + 0.5)) > Math.abs(pr - (r + 0.5)) ? (pc < c + 0.5 ? 4 : 8) : (pr < r + 0.5 ? 1 : 2);
  }
  if (!bits && !dig) return;
  const e = edgePaths(c, r, bits, dig, side);
  if (!e.any) return;
  ctx.save();
  ctx.translate(px, py);
  ctx.save(); ctx.clip(e.cut);
  ctx.drawImage(backTiles[layerOf(r - SURF)][(c * 5 + r * 3) & 3], 0, 0, T, T);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, 0, T, T);   // 깎인 자리는 굴 안쪽이라 살짝 어둡게
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fill(e.shade);
  ctx.fillStyle = "rgba(255,230,190,0.16)"; ctx.fill(e.lit);
  ctx.fillStyle = "#0f0905"; ctx.fill(e.line);
  ctx.restore();
}

// 추진 불꽃: 움직이는 반대쪽으로 기울어짐 (Chipmatic 처럼). 4px 도트 덩어리를 방향을 따라 이어 그림
function drawThrustFlame(x, y) {
  const lean = Math.max(-1, Math.min(1, -P.vx / (220 * PX)));        // 오른쪽으로 가면 불꽃은 왼쪽 아래로
  const ang = lean * 0.75, dx = Math.sin(ang), dy = Math.cos(ang);
  const fl = (((S.animT * 30) | 0) % 3), len = 7 + fl * 2 + (P.vy < 0 ? 2 : 0);
  const [outer, inner] = FLAME[LOOK.engine];
  for (let i = 0; i < len; i++) {
    const w = Math.max(1, Math.round(3.2 * (1 - i / len) + (i < 2 ? 0.8 : 0)));   // 덩어리 반폭(4px 단위)
    const cx = Math.round((x + dx * i * 4) / 2) * 2, cy = Math.round((y + dy * i * 4) / 2) * 2;
    ctx.fillStyle = i > len - 3 ? "rgba(255,140,40,0.55)" : outer; ctx.fillRect(cx - w * 4, cy, w * 8, 4);
    if (w > 1 && i < len - 2) { ctx.fillStyle = inner; ctx.fillRect(cx - (w - 1) * 4, cy, (w - 1) * 8, 4); }
    if (i < 2) { ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - 4, cy, 8, 4); }
  }
}

export function getCam(vw, vh) {
  let x = P.x - vw / 2, y = P.y - vh / 2;
  if (W * T <= vw) x = -(vw - W * T) / 2;
  else x = Math.max(0, Math.min(W * T - vw, x));
  y = Math.max(SURF * T - vh * 0.6, Math.min(H * T - vh, y));
  return { x: Math.round(x / 2) * 2, y: Math.round(y / 2) * 2 };     // 짝수 픽셀로 맞춰 확대해도 타일 사이에 틈이 안 생김
}

export function draw() {
  const SW = cv.width, SH = cv.height;
  if (SW < 8 || SH < 8) return;                                  // 창이 0 크기일 때(숨김/로딩 중)는 그리지 않음
  const Z = curZoom();                                           // 확대 배율
  const vw = SW / Z, vh = SH / Z;                                // 월드 좌표계에서 보이는 크기
  ctx.setTransform(Z, 0, 0, Z, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const lw = Math.max(1, Math.ceil(vw / 4)), lh = Math.max(1, Math.ceil(vh / 4));
  if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
  const cam = getCam(vw, vh);
  let camX = cam.x, camY = cam.y;
  if (S.shakeT > 0 && S.state === "play") {
    const k = Math.min(1, S.shakeT * 3) * 10;
    camX += Math.round((Math.random() - 0.5) * k / 2) * 2; camY += Math.round((Math.random() - 0.5) * k / 2) * 2;
  }
  else if (P.digging && S.state === "play" && P.dead <= 0) {          // 파는 동안 화면도 잔잔하게 덜덜 (단단한 땅이면 더 세게)
    const hardD = S.dig && hardOf(tiles[S.dig.r * W + S.dig.c], S.dig.r) >= 1.2 ? 2 : 1;
    camX += (((S.animT * 50) | 0) % 2 ? 2 : -2) * (Math.random() < 0.5 ? 0 : 1);
    camY += (((S.animT * 44) | 0) % 2 ? 2 : 0) * hardD;
  }
  const surfY = Math.floor(SURF * T - camY);

  // 하늘
  const bh = Math.ceil(vh / SKY.length);
  for (let i = 0; i < SKY.length; i++) { ctx.fillStyle = SKY[i]; ctx.fillRect(0, i * bh, vw, bh); }
  const sunY = 70 + Math.round(-camY * 0.1);
  if (sunY + 64 < surfY) ctx.drawImage(sunImg, vw - 160, sunY, 64, 64);
  if (surfY > 0) {                                               // 먼 산과 언덕(시차 스크롤)
    for (const m of [{ k: 0.08, col: "#a9cfe9", h: 78, f: 0.011, a: 1 }, { k: 0.18, col: "#86b9a4", h: 46, f: 0.018, a: 2.3 }]) {
      ctx.fillStyle = m.col;
      for (let x = 0; x < vw; x += 4) {
        const wx = x + camX * m.k;
        const h = Math.round(m.h * (0.55 + 0.25 * Math.sin(wx * m.f + m.a) + 0.2 * Math.sin(wx * m.f * 2.7 + m.a * 1.9)) / 2) * 2;
        ctx.fillRect(x, surfY - h, 4, h);
      }
    }
  }
  const span = vw + 240;
  for (const c of CLOUDS) {
    const cx = (((c.x - camX * 0.25) % span) + span) % span - 120;
    const cy = c.y + Math.round(-camY * 0.2);
    if (cy + 8 * c.s < surfY) ctx.drawImage(cloudImg, Math.round(cx), cy, 20 * c.s, 8 * c.s);
  }
  // 월드 바깥(지하)
  ctx.fillStyle = "#0e0f17";
  const wl = -camX, wr = W * T - camX, sy0 = Math.max(0, surfY);
  if (wl > 0) ctx.fillRect(0, sy0, wl, vh - sy0);
  if (wr < vw) ctx.fillRect(wr, sy0, vw - wr, vh - sy0);

  // 타일
  const drawSolid = (id, c, r, px, py) => {
    if (id === 7) ctx.drawImage(bedrock, px, py, T, T);
    else if (id === 12) ctx.drawImage(stoneTiles[(c * 7 + r * 13) & 1], px, py, T, T);
    else if (id === 16) ctx.drawImage(hardTiles[(c * 7 + r * 13) & 1], px, py, T, T);
    else if (id === 13 && r === SURF && BUILD_COLS.some((b) => c >= b[0] && c <= b[1])) ctx.drawImage(plinthTop, px, py, T, T);   // 건물 바로 아래 한 줄만 돌 기단 (그 아래는 흙처럼)
    else {                                                         // 건물 사이 마을 땅(13)은 잔디 흙처럼 보이게
      ctx.drawImage(dirtTiles[layerOf(r - SURF)][hv(c, r) % DIRT_VAR], px, py, T, T);
      if (id > 1 && ORE_SPR[id]) {
        const ov = ORE_SPR[id][hv(c, r) & 3];
        ctx.drawImage(ov.img, px, py, T, T);
        const sp = SPARK_ORES[id] ? ov.spark : null;
        if (sp) {
          const k = (S.animT * 1.6 + (c * 5 + r * 3) * 0.37) % 3;
          if (k < 0.5) { const q = sp[(c + r) % sp.length], a = Math.sin(k / 0.5 * Math.PI); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.fillRect(px + q[0] * AS, py + q[1] * AS - 2, 2, 6); ctx.fillRect(px + q[0] * AS - 2, py + q[1] * AS, 6, 2); ctx.globalAlpha = 1; }
        }
      }
      if (r === SURF) ctx.drawImage(grassTiles[hv(c, 9) & 1], px, py, T, T);
    }
  };
  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(W - 1, Math.floor((camX + vw) / T));
  const r0 = Math.max(0, Math.floor(camY / T)), r1 = Math.min(H - 1, Math.floor((camY + vh) / T));
  ensureRect(c0 - 1, r0 - 1, c1 + 1, r1 + 1);                         // 화면에 보이는 땅은 꼭 만들어 둠(멀리 축소해서 볼 때)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const id = tiles[r * W + c];
      let px = c * T - camX, py = r * T - camY;
      if (id === 0 || id === 14 || id === 15) {
        if (r >= SURF) {
          ctx.drawImage(backTiles[layerOf(r - SURF)][(c * 5 + r * 3) & 3], px, py, T, T);
          if (r - SURF < 4) { ctx.fillStyle = "rgba(176,132,96," + [0.34, 0.22, 0.12, 0.05][r - SURF] + ")"; ctx.fillRect(px, py, T, T); }
          if (r === SURF) {                                      // 굴 너머 뒤편 잔디(앞쪽 잔디보다 한 톤 어둡게)
            ctx.fillStyle = "#3a6b2e"; ctx.fillRect(px, py, T, 4);
            ctx.fillStyle = "#2b5022"; ctx.fillRect(px, py + 4, T, 2);
            ctx.fillStyle = "rgba(20,12,6,0.25)"; ctx.fillRect(px, py + 6, T, 4);
            ctx.fillStyle = "#3a6b2e";
            for (let k = 0; k < 4; k++) { const hh = 2 + ((hv(c * 4 + k, 51) >> 2) % 3) * 2; ctx.fillRect(px + k * (T / 4) + 2, py - hh, 2, hh); }
          }
          // 천장 쪽은 살짝 어둡게 (굴 벽 모양은 흙 칸 쪽에서 깎아서 그림 → softEdge)
          if (r > SURF && solidTile(tiles[(r - 1) * W + c])) { ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(px, py, T, 12); }
        } else if (r === SURF - 1 && id === 0 && tiles[SURF * W + c] !== 13 && solidTile(tiles[SURF * W + c])) {
          const dc = decoFor(c);
          if (dc) ctx.drawImage(dc, px, py, T, T);
        }
        if (id > 0) ctx.drawImage(id === 14 ? ICON.sup_w : ICON.sup_s, px, py, T, T);
        continue;
      }
      const ft = floatT[r * W + c];
      if (ft > 0.2) px += (((S.animT * 40) | 0) % 2) ? 1 : -1;      // 곧 떨어질 덩어리는 떨림
      const dbT = debrisT[r * W + c];
      if (dbT > 0) {                                              // 붕괴 중: 천장에서 미끄러져 내려오는 흙
        ctx.drawImage(backTiles[layerOf(r - SURF)][(c * 5 + r * 3) & 3], px, py, T, T);
        const k = Math.max(0, 1 - dbT / DEBRIS_T), off = Math.round(T * (1 - k * k));
        ctx.save(); ctx.beginPath(); ctx.rect(px, py, T, T); ctx.clip();
        drawSolid(id, c, r, px, py - off);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0," + (0.35 * (1 - k)).toFixed(2) + ")"; ctx.fillRect(px, py, T, T);
      } else drawSolid(id, c, r, px, py);
      // 굴 가장자리: 빈칸 쪽 면을 2~3칸(그림 기준) 깎고 모서리를 둥글게 → 블록이 사라지는 게 아니라 굴이 넓어지는 느낌
      if (r > SURF && id !== 7 && id !== 13) softEdge(c, r, px, py, id);
    }
  }
  // 지표 굴 가장자리: 잔디가 옆면을 감싸고 굴 쪽으로 살짝 늘어져서 끊기지 않고 이어져 보이게
  if (SURF >= r0 && SURF <= r1) {
    const gy = SURF * T - camY;
    for (let c = Math.max(0, c0 - 1); c <= Math.min(W - 1, c1 + 1); c++) {
      const v = tiles[SURF * W + c];
      if (!solidTile(v) || v === 7 || v === 13 || v === 12) continue;
      const px = c * T - camX;
      for (const sd of [-1, 1]) {
        const n = c + sd;
        if (n < 0 || n >= W || !isAir(n, SURF)) continue;
        const h = hv(c * 2 + (sd > 0 ? 1 : 0), 77);
        const ex = sd < 0 ? px : px + T - 4;                 // 안쪽 가장자리
        const len = 8 + (h % 3) * 2;
        ctx.fillStyle = "#437a31"; ctx.fillRect(ex, gy, 4, len);
        ctx.fillStyle = "#2f5c25"; ctx.fillRect(ex, gy + len, 4, 2);
        ctx.fillStyle = "#5aa63e"; ctx.fillRect(ex + (sd < 0 ? 0 : 2), gy + 2, 2, len - 4);
        const ox = sd < 0 ? px - 4 : px + T;                 // 굴 쪽으로 튀어나온 잔디
        ctx.fillStyle = "#4f8f3a"; ctx.fillRect(ox, gy, 4, 6);
        ctx.fillStyle = "#7cc255"; ctx.fillRect(ox, gy, 4, 2);
        ctx.fillStyle = "#437a31"; ctx.fillRect(sd < 0 ? px - 2 : px + T, gy + 6, 2, 4 + ((h >> 3) % 3) * 2);
        ctx.fillStyle = "#2f5c25"; ctx.fillRect(sd < 0 ? px - 4 : px + T + 2, gy + 6, 2, 2 + ((h >> 5) % 2) * 2);
      }
    }
  }

  // 떨어지는 덩어리
  for (const ch of chunks) for (const k of ch.cells) drawSolid(k.id, k.c, k.r, k.c * T - camX, (k.r + ch.off) * T + Math.round(ch.frac) - camY);

  // 건물 (상점 / 제작소 / 용광로). 그림 아래 끝 = 땅 표면, 그림 1픽셀 = 화면 2픽셀. 이름 대신 그림 속 로고
  {
    const base = SURF * T - camY;
    if ((MINE_COL + 3) * T - camX > 0 && BUILD_COLS[0][0] * T - camX < vw) {
      const smoke = (x, y, col) => {                                // 굴뚝 연기
        for (let i = 0; i < 4; i++) {
          const t = (S.animT * 0.45 + i / 4) % 1, sz = Math.round((6 + t * 14) / 2) * 2;
          ctx.globalAlpha = (1 - t) * 0.6; ctx.fillStyle = col;
          ctx.fillRect(Math.round(x + Math.sin(S.animT * 1.3 + i * 2) * 8 * t - sz / 2), Math.round(y - t * 72), sz, sz);
        }
        ctx.globalAlpha = 1;
      };
      // 건물 칸 가운데에 맞춰 놓을 자리 (그림 크기가 바뀌어도 땅에 붙음)
      const spot = (img, k) => {
        const w = img.width * AS, h = img.height * AS, cw = (BUILD_COLS[k][1] - BUILD_COLS[k][0] + 1) * T;
        return { x: BUILD_COLS[k][0] * T - camX + Math.floor((cw - w) / 2), y: base - h, w, h, fx: BLD_FX[["shop", "craft", "furnace"][k]] };
      };
      const fit = (q, img) => q.fx && img.width === q.fx.w && img.height === q.fx.h;   // 새 그림일 때만 불빛 위치가 맞음
      const at = (q, a) => [q.x + a[0] * AS, q.y + a[1] * AS];

      const sh = spot(S.itemShopImg, B_SHOP), cr = spot(S.craftShopImg, B_CRAFT), fu = spot(furnaceImg, B_FURN);
      // 용광로 불·쇳물은 건물 그림 '뒤'에 먼저 그림 → 그림에 뚫린 아궁이·홈 사이로 보임 (창살은 그림 위에 남음)
      const busy = !!(S.acct && S.acct.furnace && S.acct.furnace.q.length);
      if (fit(fu, furnaceImg)) {
        const m = fu.fx.mouth, [mx, my] = at(fu, m), mw = m[2] * AS, mh = m[3] * AS;
        const fl = (k) => Math.round((Math.sin(S.animT * (7 + k) + k * 1.7) * 0.5 + 0.5) * 4) * 2;
        ctx.fillStyle = "#1c0d0a"; ctx.fillRect(mx, my, mw, mh);
        ctx.fillStyle = busy ? "#d8401a" : "#4a1a0e"; ctx.fillRect(mx, my + mh * 0.38 - fl(1), mw, mh * 0.62 + fl(1));
        ctx.fillStyle = busy ? "#ff8a1f" : "#6e2812"; ctx.fillRect(mx + 6, my + mh * 0.5 - fl(2), mw - 12, mh * 0.5 + fl(2));
        ctx.fillStyle = busy ? "#ffd34d" : "#94391a"; ctx.fillRect(mx + 14, my + mh * 0.62 - fl(3), mw - 28, mh * 0.38 + fl(3));
        if (busy) { ctx.fillStyle = "#fff3a8"; ctx.fillRect(mx + 22, my + mh * 0.74 - fl(4), mw - 44, mh * 0.26 + fl(4)); }
        const tr = fu.fx.trough;                                     // 쇳물 홈 (그림에 있을 때만)
        if (tr) {
          const [tx, ty] = at(fu, tr);
          ctx.fillStyle = busy ? "#ff8a1f" : "#2a1a14"; ctx.fillRect(tx, ty, tr[2] * AS, tr[3] * AS);
          if (busy) { ctx.fillStyle = "#fff3a8"; ctx.fillRect(tx + (((S.animT * 30) | 0) % (tr[2] * AS - 2)), ty, 2, tr[3] * AS); }
        }
      }
      ctx.drawImage(S.itemShopImg, sh.x, sh.y, sh.w, sh.h);
      ctx.drawImage(S.craftShopImg, cr.x, cr.y, cr.w, cr.h);
      ctx.drawImage(furnaceImg, fu.x, fu.y, fu.w, fu.h);
      if (fit(sh, S.itemShopImg) && sh.fx.smoke) smoke(...at(sh, sh.fx.smoke), "#c9ced8");
      if (fit(cr, S.craftShopImg)) {
        if (cr.fx.smoke) smoke(...at(cr, cr.fx.smoke), "#9aa0b4");
        const g = cr.fx.forge, [gx, gy] = at(cr, g);                 // 대장간 불빛 깜빡임
        ctx.globalAlpha = 0.14 + 0.08 * Math.sin(S.animT * 9) + 0.05 * Math.sin(S.animT * 23);
        ctx.fillStyle = "#ffb040"; ctx.fillRect(gx, gy, g[2] * AS, g[3] * AS);
        ctx.globalAlpha = 1;
      }
      if (fit(fu, furnaceImg)) {
        if (fu.fx.smoke) smoke(...at(fu, fu.fx.smoke), busy ? "#8a90a0" : "#c9ced8");
        ctx.fillStyle = busy ? "rgba(255,138,31,0.22)" : "rgba(255,90,31,0.07)";   // 아궁이 앞 땅에 비친 불빛
        ctx.fillRect(fu.x + 40, base - 4, fu.w - 80, 4);
      }
      // 광산 입구 표지판 (글자 없이 로고만)
      const sx = (MINE_COL - 1) * T + T / 2 - 22 - camX, sy = SURF * T - camY;   // 마을 끝 칸, 광산 터 바로 앞
      ctx.fillStyle = "#14151f"; ctx.fillRect(sx + 18, sy - 64, 8, 64);
      ctx.fillStyle = "#8a5a3c"; ctx.fillRect(sx + 20, sy - 64, 4, 64);
      if (SIGN_IMG.mine.width > 1) drawSign(SIGN_IMG.mine, sx + 22, sy - 76, null, null, 3);
      else {                                                       // 로고 PNG가 없을 때만 나무판 + 화살표
        ctx.fillStyle = "#14151f"; ctx.fillRect(sx + 2, sy - 70, 40, 30);
        ctx.fillStyle = "#c08a5c"; ctx.fillRect(sx + 4, sy - 68, 36, 26);
        txt("▼", sx + 22, sy - 63, "#3a2414", 16, "center");
      }
    }
  }

  // 채굴 균열
  if (S.dig) {
    const info = TILE[tiles[S.dig.r * W + S.dig.c]];
    if (info) {
      const k = Math.min(1, S.dig.t / (hardOf(tiles[S.dig.r * W + S.dig.c], S.dig.r) / drillMult()));
      const px = S.dig.c * T - camX, py = S.dig.r * T - camY;
      ctx.drawImage(cracks[k < 0.33 ? 0 : k < 0.66 ? 1 : 2], px, py, T, T);
      ctx.fillStyle = "#14151f"; ctx.fillRect(px, py - 8, T, 6);
      ctx.fillStyle = "#fff"; ctx.fillRect(px + 2, py - 6, Math.floor((T - 4) * k), 2);
    }
  }



  // 설치한 다이너마이트
  for (const b of bombs) {
    const px = b.c * T - camX, py = b.r * T - camY;
    ctx.drawImage(ICON[b.id], px, py, T, T);
    if (b.t < 1 && ((S.animT * 12) | 0) % 2) { ctx.globalAlpha = 0.55; ctx.fillStyle = "#fff"; ctx.fillRect(px + 6, py + 8, 20, 20); ctx.globalAlpha = 1; }
    if (((S.animT * 20) | 0) % 2) { ctx.fillStyle = "#ffe066"; ctx.fillRect(px + 14, py + 1, 4, 4); }
    txt(String(Math.ceil(b.t)), px + T / 2, py - 16, "#ffd34d", 14, "center");
  }

  // 떨어진 광물
  drawDrops(camX, camY, vw, vh);

  // 파티클
  for (const q of parts) {
    const s = q.life < q.max * 0.3 ? 2 : q.size;
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), s, s);
  }

  // 먼지 구름
  for (const q of dust) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max)) * 0.42;
    ctx.fillStyle = q.col;
    const rr = Math.round(q.r / 2) * 2;
    ctx.fillRect(Math.round(q.x - camX) - rr, Math.round(q.y - camY) - rr, rr * 2, rr * 2);
  }
  ctx.globalAlpha = 1;

  // 플레이어
  if (P.dead <= 0) {
    const px = Math.round(P.x - camX), py = Math.round(P.y - camY);
    const moving = Math.abs(P.vx) > 20 && P.grounded;
    const leg = moving ? ((S.animT * 10) | 0) % 2 : 0;
    const dg = P.digging ? ((S.animT * 24) | 0) % 2 : -1;
    // 기계라서 덜덜덜: 굴러갈 때·추진할 때 2px. 팔 때는 더 세게(앞뒤·위아래로 최대 4px 마구 떨림)
    const thr = U_() && P.fuel > 0;
    const fr = (S.animT * 60) | 0, jit = (k) => ((Math.imul(fr + k * 7919, 2654435761) >>> 24) % 5) - 2;   // -2~2
    let ox = 0, oy = 0;
    if (P.digging) { ox = jit(1) * 2; oy = jit(2) * 2; }
    else if (moving || thr) { oy = -(((S.animT * (thr ? 30 : 22)) | 0) % 2) * 2; ox = thr && fr % 3 === 0 ? 2 : 0; }
    // 드릴이 흙 쪽으로 파고드는 깊이: 진행도만큼 0→18px + 쿡쿡 찌르는 떨림
    let push = 0;
    if (P.digging && S.dig) {
      const id = tiles[S.dig.r * W + S.dig.c], need = Math.max(0.01, hardOf(id, S.dig.r) / drillMult());
      push = Math.min(1, S.dig.t / need) * 18 + (((S.animT * 18) | 0) % 2) * 4;
    }
    const ms = MINER_SZ * 3, mb = MINER_BOX * 3;                     // 그림 x3: 몸통 48px(블록의 3/4) · 충돌 크기는 그대로
    ctx.save();
    ctx.translate(px + ox, py + HH + oy);
    if (P.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(getMiner(P.mode, leg, dg, "body"), -24 - mb, -48 - mb, ms, ms);
    const pdx = P.mode === "side" ? push : 0, pdy = P.mode === "down" ? push : P.mode === "up" ? -push : 0;
    if (push > 0) {                                                  // 모터와 드릴 사이 축(밀려 나간 만큼)
      const L = Math.round(push) + 3;
      const [sx, sy, sw, sh] = P.mode === "side" ? [21, -33, L, 9] : P.mode === "down" ? [12, 3, 9, L] : [9, -63 - L + 3, 9, L];
      ctx.fillStyle = "#14151f"; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = "#9aa3b8"; ctx.fillRect(sx + (sw > sh ? 0 : 3), sy + (sw > sh ? 3 : 0), sw > sh ? sw : 3, sw > sh ? 3 : sh);
      ctx.fillStyle = "#e3e8f2"; ctx.fillRect(sx + (sw > sh ? 0 : 3), sy + (sw > sh ? 3 : 0), sw > sh ? sw : 1, sw > sh ? 1 : sh);
    }
    ctx.drawImage(getMiner(P.mode, leg, dg, "drill"), Math.round(-24 - mb + pdx), Math.round(-48 - mb + pdy), ms, ms);
    ctx.restore();
    if (U_() && P.fuel > 0) drawThrustFlame(px, py + HH);
  }

  // 떠오르는 글자
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    txt(f.text, f.x - camX, f.y - camY, f.color, 14, "center");
  }
  ctx.globalAlpha = 1;

  // 암흑 시야: 칸 단위 밝기를 부드럽게 늘려서 네모난 경계 없이 그림
  //  - 본 적 없는 곳: 거의 깜깜 / 본 곳: 흐릿하게 기억 / 하늘로 뚫린 굴: 햇빛이 깊이에 따라 스며듦
  const depth = Math.max(0, P.y / T - SURF);
  {
    const LW = lightCv.width, LH = lightCv.height;
    const gc0 = Math.floor(camX / T) - 1, gr0 = Math.floor(camY / T) - 1;
    const gw = Math.floor((camX + vw) / T) + 2 - gc0, gh = Math.floor((camY + vh) / T) + 2 - gr0;
    if (gridCv.width !== gw || gridCv.height !== gh) { gridCv.width = gw; gridCv.height = gh; S.gridImg = gg.createImageData(gw, gh); }
    // 하늘빛: 열마다 지표부터 아래로, 뚫린 칸을 지날수록 약해짐
    if (S.skyL.length < gw * gh) S.skyL = new Float32Array(gw * gh * 2);
    S.skyL.fill(0, 0, gw * gh);
    for (let i = 0; i < gw; i++) {
      const c = gc0 + i;
      if (c < 0 || c >= W) continue;
      let L = 1;
      for (let r = SURF; r < gr0 + gh && r < H; r++) {
        let v;
        if (isAir(c, r)) { v = L; L *= 0.8; } else { v = L * 0.7; L = 0; }
        if (r >= gr0) S.skyL[(r - gr0) * gw + i] = v;
        if (L <= 0.01) break;                                       // 빛이 다 막히면 그 아래는 0 (깊은 곳에서 위부터 훑지 않게)
      }
    }
    const data = S.gridImg.data;
    for (let j = 0; j < gh; j++) {
      const r = gr0 + j;
      for (let i = 0; i < gw; i++) {
        const c = gc0 + i, k = (j * gw + i) * 4;
        let a;
        if (r < SURF) a = 0;
        else if (c < 0 || c >= W || r >= H) a = 0.97;
        else {
          a = seen[r * W + c] ? 0.53 : 0.97;
          const amb = r - SURF < 3 ? [0.9, 0.6, 0.3][r - SURF] : 0;
          const s0 = S.skyL[j * gw + i], sL = i > 0 ? S.skyL[j * gw + i - 1] : 0, sR = i < gw - 1 ? S.skyL[j * gw + i + 1] : 0;
          const light = Math.max(amb, s0, sL * 0.55, sR * 0.55);
          a *= 1 - light;
        }
        data[k] = 4; data[k + 1] = 3; data[k + 2] = 9; data[k + 3] = Math.round(a * 255);
      }
    }
    gg.putImageData(S.gridImg, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, LW, LH);
    lg.imageSmoothingEnabled = true;                                 // 칸 사이를 부드럽게 이어 줌
    lg.drawImage(gridCv, (gc0 * T - camX) / 4, (gr0 * T - camY) / 4, gw * T / 4, gh * T / 4);
    lg.globalCompositeOperation = "destination-out";
    const lx = (P.x - camX) / 4, ly = (P.y - camY) / 4, R = visR() * 8;
    for (const f of [[1, 0.25], [0.82, 0.3], [0.66, 0.35], [0.5, 0.4], [0.34, 0.6], [0.18, 1]]) {
      lg.fillStyle = "rgba(0,0,0," + f[1] + ")";
      lg.beginPath(); lg.arc(lx, ly, R * f[0], 0, 7); lg.fill();
    }
    for (const b of bombs) {                                // 폭약 불빛
      lg.fillStyle = "rgba(0,0,0,0.7)";
      lg.beginPath(); lg.arc(((b.c + 0.5) * T - camX) / 4, ((b.r + 0.5) * T - camY) / 4, 14, 0, 7); lg.fill();
    }
    for (const f of flashes) {                              // 폭발 섬광: 주변 동굴이 잠깐 환해짐
      lg.fillStyle = "rgba(0,0,0," + Math.min(1, f.t * 4) + ")";
      lg.beginPath(); lg.arc((f.x - camX) / 4, (f.y - camY) / 4, (f.rad + 2) * 8 * (1.3 - f.t), 0, 7); lg.fill();
    }
    ctx.drawImage(lightCv, 0, 0, LW * 4, LH * 4);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);                    // 여기서부터는 확대 없이 화면 그대로
  ctx.imageSmoothingEnabled = false;
  if (P.dead > 0) {
    ctx.fillStyle = "rgba(120,10,10,0.35)"; ctx.fillRect(0, 0, SW, SH);
    txt("연료 고갈!", SW / 2, SH / 2 - 30, "#ff6b6b", 28, "center");
    txt("구조 중...", SW / 2, SH / 2 + 14, "#fff", 14, "center");
  }

  drawHUD(SW, SH, depth);
  drawStick();
  if (S.state === "shop") drawShopModal(SW, SH);
  if (S.state === "craft") drawCraftModal(SW, SH);
  if (S.state === "furnace") drawFurnaceModal(SW, SH);
  if (S.state === "map") drawMapModal(SW, SH);
  if (S.state === "title") drawTitle(SW, SH);
}

// 소모품 단축 슬롯 (1~6 키 / 터치로 탭)
export function drawHotbar(vw, vh) {
  S.hotBtns = []; S.hotLeft = 1e9;
  if (S.state !== "play") return;
  const sz = vw < 560 ? 40 : 48, gap = vw < 560 ? 2 : 4, n = HOT.length, tw = n * sz + (n - 1) * gap, isz = 32;
  const x0 = Math.max(8, vw - 12 - tw), y0 = vh - 12 - sz;
  S.hotLeft = x0;
  HOT.forEach((id, i) => {
    const x = x0 + i * (sz + gap), cnt = P.inv[id] || 0;
    pxBox(x, y0, sz, sz, SY.ink);
    ctx.fillStyle = cnt > 0 ? SY.body : SY.well; ctx.fillRect(x + 2, y0 + 2, sz - 4, sz - 4);
    ctx.fillStyle = cnt > 0 ? SY.hi : SY.wellDk; ctx.fillRect(x + 2, y0 + 2, sz - 4, 2);
    ctx.globalAlpha = cnt > 0 ? 1 : 0.35;
    ctx.drawImage(ICON[id], x + ((sz - isz) >> 1), y0 + (sz === 48 ? 4 : 2), isz, isz);
    ctx.globalAlpha = 1;
    txt(String(i + 1), x + 5, y0 + 3, SY.dim, 12);
    txt("x" + cnt, x + sz - 4, y0 + sz - 15, cnt > 0 ? "#fff" : SY.mute, 12, "right");
    S.hotBtns.push({ x: x - 2, y: y0 - 2, w: sz + 4, h: sz + 4, id });
  });
}

// 가진 광물 칸: 화물칸에 든 광물을 아이콘 + 개수로 (새로 주우면 잠깐 노랗게 반짝)
//   center=true 면 x 가 가운데, 아니면 왼쪽 끝. 돌려주는 값: 칸의 아래 y
const ORE_BAR_IDS = [6, 2, 3, 8, 4, 9, 5, 10, 11];
const ORE_BAR_LAST = {}, ORE_BAR_FLASH = {};
function drawOreBar(x, y, maxW, center) {
  const have = ORE_BAR_IDS.filter((id) => (P.cargo[id] || 0) > 0);
  for (const id of ORE_BAR_IDS) {
    const n = P.cargo[id] || 0;
    if (n > (ORE_BAR_LAST[id] || 0)) ORE_BAR_FLASH[id] = S.animT + 0.35;
    ORE_BAR_LAST[id] = n;
  }
  setFont(16);
  let isz = 24, cells = have.map((id) => ({ id, s: String(P.cargo[id]), w: 0 }));
  const measure = () => cells.reduce((a, c) => { c.w = isz + 4 + Math.ceil(ctx.measureText(c.s).width); return a + c.w + 10; }, 0) + 10;
  let w = have.length ? measure() : 0;
  if (w > maxW) { isz = 16; w = measure(); }
  const h = isz + 12;
  if (!have.length) {
    setFont(12); const ew = Math.ceil(ctx.measureText("광물 없음").width) + 20;
    const x0 = center ? Math.floor(x - ew / 2) : x;
    plate(x0, y, ew, 28); txt("광물 없음", x0 + 10, y + 8, SY.mute, 12);
    return y + 28;
  }
  // 자리가 모자라면 여러 줄로 (좁은 화면)
  const lines = [[]];
  let lw = 10;
  for (const c of cells) {
    if (lw + c.w + 10 > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 10; }
    lines[lines.length - 1].push(c); lw += c.w + 10;
  }
  const pw = lines.length > 1 ? maxW : w, ph = h * lines.length - (lines.length - 1) * 6;
  const x0 = center ? Math.floor(x - pw / 2) : x;
  plate(x0, y, pw, ph);
  lines.forEach((line, li) => {
    let cx = x0 + 10;
    const ly = y + li * (h - 6);
    for (const c of line) {
      const fl = (ORE_BAR_FLASH[c.id] || 0) > S.animT;
      if (fl) { ctx.fillStyle = "rgba(255,194,26,0.35)"; ctx.fillRect(cx - 4, ly + 3, c.w + 8, h - 6); }
      ctx.drawImage(oreIcon[c.id], cx, ly + 6 - (fl ? 2 : 0), isz, isz);
      txt(c.s, cx + isz + 4, ly + Math.floor((h - 16) / 2), fl ? SY.y : "#fff", 16, "left", SY.ink);
      cx += c.w + 10;
    }
  });
  return y + ph;
}

// 큰 수는 "12.3만" 처럼 줄여서
function hudMoney(n) { return n >= 100000 ? (n / 10000).toFixed(n >= 1000000 ? 0 : 1) + "만" : Number(n).toLocaleString("en-US"); }
// 칸 막대 + 왼쪽에 겹쳐 그린 아이콘 (번개 막대 모양)
function hudBar(x, y, img, n, filled, kind, label, labelCol) {
  const w = segBar(x + 22, y, n, filled, kind, 10, 20);
  ctx.drawImage(img, x, y - 6, 32, 32);
  txt(label, x + 22 + w + 6, y + 3, labelCol || "#fff", 12, "left", SY.ink);
  return x + 22 + w;
}

export function drawHUD(vw, vh, depth) {
  shopBtn.length = 0;
  const wide = vw >= 760;                     // 넓으면 위 가운데에 광물 칸 + 깊이
  const blink = ((S.animT * 4) | 0) % 2;
  // 왼쪽 위: 연료 · 화물 칸 막대 (아이콘이 막대 왼쪽 끝에 겹침)
  const fr = Math.max(0, P.fuel / maxFuel()), low = fr < 0.25;
  const fSeg = Math.ceil(fr * 12 - 1e-9);
  hudBar(10, 12, ICON.fuel, 12, low && blink ? Math.max(0, fSeg - 1) : fSeg, low ? "low" : "fuel", Math.ceil(P.fuel) + "/" + Math.round(maxFuel()), low ? SY.red : "#fff");
  const cc = cargoCount(), cap = cargoCap(), full = cc >= cap;
  hudBar(10, 44, ICON.crate, 12, Math.min(12, Math.ceil(cc / cap * 12 - 1e-9)), full && blink ? "low" : "cargo", cc + "/" + cap, full ? SY.red : "#fff");
  // 레벨 + 경험치 + 칭호
  const Lx = levelOf(S.acct ? S.acct.xp : 0);
  plate(10, 74, 50, 24);
  txt("Lv." + Lx.lv, 35, 80, SY.gold, 12, "center", SY.ink);
  const xpN = 10, xpF = Lx.lv >= MAX_LV ? xpN : Math.floor(xpN * Lx.cur / Lx.need);
  segBar(66, 78, xpN, xpF, "xp", 8, 14);
  txt(fitText(titleName() || "칭호 없음", Math.max(40, (wide ? 300 : vw - 230) - 6), 12), 66 + xpN * 8 + 8, 79, titleName() ? SY.gold : SY.mute, 12, "left", SY.ink);
  // 돈 · 깊이: 넓은 화면은 위 가운데(깊이) · 오른쪽 위(돈), 좁은 화면은 왼쪽 줄 아래에
  const dTxt = (Math.floor(depth) + 1) + "m", mTxt = hudMoney(P.money);
  const bs = 44, bg = 6, bx0 = vw - 10 - 3 * bs - 2 * bg, by0 = 10;
  S.hudBottom = 0;
  if (wide) {
    // 위 가운데: 가진 광물 칸 (Chipmatic 처럼) + 그 아래 깊이
    const ob = drawOreBar(Math.floor(vw / 2), 10, Math.max(160, vw - 2 * 230), true);
    setFont(16); const dw = Math.ceil(ctx.measureText(dTxt).width) + 48;
    plate(Math.floor(vw / 2 - dw / 2), ob + 6, dw, 30); ctx.drawImage(ICON.depth, Math.floor(vw / 2 - dw / 2) + 8, ob + 13, 16, 16);
    txt(dTxt, Math.floor(vw / 2 - dw / 2) + 30, ob + 13, "#9fd8ff", 16);
    const mw = Math.ceil(ctx.measureText(mTxt).width) + 50, mx0 = bx0 - 10 - mw;
    plate(mx0, by0, mw, bs); ctx.drawImage(ICON.coin, mx0 + 8, by0 + 6, 32, 32);
    txt(mTxt, mx0 + mw - 10, by0 + 14, SY.gold, 16, "right");
  } else {
    ctx.drawImage(ICON.coin, 10, 102, 24, 24); txt(mTxt, 38, 106, SY.gold, 16, "left", SY.ink);
    setFont(16); const mw = Math.ceil(ctx.measureText(mTxt).width);
    ctx.drawImage(ICON.depth, 38 + mw + 14, 106, 16, 16); txt(dTxt, 38 + mw + 34, 106, "#9fd8ff", 16, "left", SY.ink);
    S.hudBottom = drawOreBar(10, 134, vw - 20 - 46, false);      // 좁은 화면: 왼쪽 줄 아래에 광물 칸 (미니맵은 그 아래로)
  }

  // 오른쪽 위: 가방(초록) · 업적(파랑) · 메뉴(주황) 사각 버튼 + 그 아래 미니맵 · 깊이 미터
  S.menuBtn = null; S.bagBtn = null; S.questBtn = null;
  if (S.state === "play") {
    [["green", GLYPH.bag, "bag", "#1f5418"], ["blue", GLYPH.trophy, "quest", "#0b3f6c"], ["orange", GLYPH.menu, "menu", "#7a3006"]].forEach(([col, g, kind, tc], i) => {
      const x = bx0 + i * (bs + bg);
      const cy = btnPx(x, by0, bs, bs, col);
      glyph(g, x + Math.floor((bs - 21) / 2), Math.round(cy - 10.5), tc, 3);
      const hitR = { x: x - 3, y: by0 - 3, w: bs + 6, h: bs + 6 };
      if (kind === "bag") S.bagBtn = hitR; else if (kind === "quest") S.questBtn = hitR; else S.menuBtn = hitR;
    });
  }
  if (S.saveFlash > 0 && S.state !== "title") txt(S.saveFail ? "저장 실패!" : "저장됨", bx0 - 10, by0 + (wide ? bs + 6 : 15), S.saveFail ? "#ff6b6b" : "#7cff6b", 12, "right", SY.ink);
  const mh = Math.min(260, vh - 64 - 150), mx = vw - 10 - 36, my = by0 + bs + 10;
  drawMinimap(vw, vh, my);
  if (mh >= 70) {
    panel(mx, my, 36, mh);
    const bx = mx + 12, by = my + 10, bw = 12, bhh = mh - 20, total = H - SURF;
    ctx.fillStyle = SY.ink; ctx.fillRect(bx - 2, by - 2, bw + 4, bhh + 4);
    for (let i = 0; i < LAYERS.length; i++) {
      const a = LAYERS[i].from, b = i < LAYERS.length - 1 ? LAYERS[i + 1].from : total;
      ctx.fillStyle = LAYERS[i].base;
      ctx.fillRect(bx, Math.floor(by + bhh * a / total), bw, Math.ceil(bhh * (b - a) / total));
    }
    const mk = Math.floor(by + bhh * Math.max(0, Math.min(1, depth / total)));
    ctx.fillStyle = SY.ink;
    ctx.fillRect(bx - 18, mk - 8, 4, 16); ctx.fillRect(bx - 14, mk - 6, 4, 12); ctx.fillRect(bx - 10, mk - 4, 4, 8); ctx.fillRect(bx - 6, mk - 2, 4, 4);
    ctx.fillStyle = SY.y;
    ctx.fillRect(bx - 16, mk - 6, 4, 12); ctx.fillRect(bx - 12, mk - 4, 4, 8); ctx.fillRect(bx - 8, mk - 2, 4, 4);
  }

  // 지반 불안정 경고

  // 지층 배너
  if (S.bannerT > 0) {
    const w = 300, x = (vw - w) / 2;
    const slide = Math.min(1, S.bannerT * 3, (3.5 - S.bannerT) * 3);
    panel(x, -60 + 76 * slide, w, 56);
    ctx.fillStyle = SY.y; ctx.fillRect(x + 2, -60 + 76 * slide + 2, w - 4, 4);
    txt(S.bannerText, vw / 2, -60 + 76 * slide + 19, "#ffd34d", 14, "center");
  }

  // 상점 패널
  // 아이템 상점 열기 버튼 (상점 건물 안에 있을 때만)
  S.promptBtn = null;
  const helpOn = S.showHelp && S.state === "play" && (S.helpPinned || S.playT < 30);
  const helpStr = S.usedTouch
    ? "드래그로 조작 · 아래 슬롯: 소모품 · 오른쪽 위: 가방/업적/메뉴"
    : "←→ 이동 · ↑ 추진 · ↓ 파기 · 1-6 소모품 · I 가방 · Q 업적 · M 지도 · Z 확대 · H 도움말";
  setFont(12);
  const helpW = Math.ceil(ctx.measureText(helpStr).width) + 32;
  const helpUp = helpOn && 12 + helpW > S.hotLeft - 8;      // 슬롯과 겹치면 도움말을 슬롯 위로 올리고, 안내창도 같이 올림
  const helpLift = helpUp ? 44 : 0;
  if ((S.nearItems || S.nearCraft || S.nearFurnace) && S.state === "play" && P.dead <= 0) {
    const nm = S.nearItems ? "상점 열기" : S.nearCraft ? "제작소 열기" : "용광로 열기";
    const label = S.usedTouch ? nm : "[E] " + nm;
    setFont(16);
    const pw = Math.ceil(ctx.measureText(label).width) + 56, ph = 48;
    const px = Math.floor((vw - pw) / 2), py = vh - 124 - helpLift;
    S.promptBtn = { x: px, y: py, w: pw, h: ph };
    const cy = btnPx(px, py, pw, ph, "green");
    txt(label, vw / 2, cy - 8, "#1f5418", 16, "center", "rgba(0,0,0,0)");
  }

  // 토스트
  if (S.msgT > 0 && S.state === "play") {
    setFont(16);
    const w = Math.ceil(ctx.measureText(S.msg).width) + 48;
    const ty = vh - 126 - helpLift - (S.promptBtn ? 56 : 0);
    panel((vw - w) / 2, ty, w, 44);
    txt(S.msg, vw / 2, ty + 15, "#fff", 14, "center");
  }

  drawHotbar(vw, vh);
  // 도움말
  if (helpOn) {
    const hy = helpUp ? vh - 100 : vh - 44;
    ctx.globalAlpha = 0.85;
    panel(12, hy, helpW, 32, SY.well);
    ctx.globalAlpha = 1;
    txt(helpStr, 28, hy + 10, "#c9cfe6", 12);
  }
}

// 간판 로고: 그림 1픽셀 = 건물 도트 1픽셀이라 2배로 그림. (cx, cy) 가운데 기준. 그림이 없으면 글자로 대신
export function drawSign(img, cx, cy, label, col, scale) {
  if (img.width > 1) {
    const k = scale || AS, w = img.width * k, h = img.height * k;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  } else if (label) txt(label, cx, cy - 8, col, 16, "center");
}

// 마을 창(상점·제작·용광로·판매)은 render/townUI.ts 에서 그립니다.

// 도트 느낌 원 (4px 단위)
export function pcircle(cx, cy, r, col) {
  const st = 4; ctx.fillStyle = col;
  for (let y = -r; y < r; y += st) {
    const yy = Math.abs(y + st / 2);
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)) / st) * st;
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, st);
  }
}
export function drawStick() {
  if (!S.stick || S.state !== "play") return;
  let dx = S.stick.x - S.stick.ox, dy = S.stick.y - S.stick.oy;
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) { dx = dx / d * STICK_R; dy = dy / d * STICK_R; }
  pcircle(S.stick.ox, S.stick.oy, STICK_R + 4, "rgba(20,21,31,0.55)");
  pcircle(S.stick.ox, S.stick.oy, STICK_R, "rgba(255,255,255,0.14)");
  {                                                   // 지금 어떤 방향이 인식되는지 표시
    const rr = STICK_R - 10;
    const mk = (on, mx, my, mw, mh) => { ctx.fillStyle = on ? "#ffd34d" : "rgba(255,255,255,0.28)"; ctx.fillRect(Math.round(S.stick.ox + mx), Math.round(S.stick.oy + my), mw, mh); };
    mk(touch.u, -6, -rr, 12, 6); mk(touch.d, -6, rr - 6, 12, 6); mk(touch.l, -rr, -6, 6, 12); mk(touch.r, rr - 6, -6, 6, 12);
  }
  const kx = S.stick.ox + dx, ky = S.stick.oy + dy;
  pcircle(kx, ky, 26, "#14151f");
  pcircle(kx, ky, 22, "#ffd34d");
  pcircle(kx - 4, ky - 4, 10, "#fff3a8");
}

export function drawTitle(vw, vh) {
  ctx.fillStyle = "rgba(20,21,31,0.6)"; ctx.fillRect(0, 0, vw, vh);
  const w = Math.min(620, vw - 40), h = 270;
  const x = Math.floor((vw - w) / 2), y = Math.floor(vh / 2 - h / 2);
  panel(x, y, w, h);
  txt("DEEP DIGGER", vw / 2, y + 40, "#ffd34d", 56, "center");
  txt("땅속 끝까지 파고 내려가라 (가제)", vw / 2, y + 118, "#c9cfe6", 14, "center");
  txt("광물을 캐서 팔고, 장비를 강화하고, 더 깊이!", vw / 2, y + 144, "#9aa3c8", 14, "center");
  if (S.usedTouch) txt("화면 어디서나 드래그해서 조작", vw / 2, y + 170, "#9aa3c8", 14, "center");
  if (((performance.now() / 500) | 0) % 2 === 0) txt(S.usedTouch ? "TOUCH TO START" : "PRESS ANY KEY", vw / 2, y + 196, "#7cff6b", 28, "center");
}

