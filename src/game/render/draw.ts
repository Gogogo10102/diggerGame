// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./util.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { fxText, plinthLow, plinthTop } from "../art/buildings.ts";
import { FLAME, itemIcon } from "../art/itemIcons.ts";
import { CLOUDS, DIRT_VAR, ICON, ORE_SPR, SKY, SPARK_ORES, backTiles, bedrock, cloudImg, cracks, decoFor, dirtTiles, getMiner, grassTiles, hardTiles, hv, stoneTiles, sunImg } from "../art/sprites.ts";
import { BUILD_COLS, H, HH, LAYERS, MINE_COL, SURF, T, TILE, W, layerOf } from "../core/config.ts";
import { P } from "../core/player.ts";
import { S } from "../core/state.ts";
import { SHOP_PER, STAT, bombs, cargoCap, cargoCount, curZoom, drillMult, flashes, floaters, maxFuel, parts } from "../core/stats.ts";
import { hardOf, isAir, seen, tiles } from "../core/world.ts";
import { HOT, LOOK, VIS_BASE, visR } from "../data/consumables.ts";
import { CATS, ITEMS } from "../data/items.ts";
import { MAX_LV, levelOf, titleName } from "../data/progress.ts";
import { RECIPE_CATS } from "../data/recipes.ts";
import { ctx, cv, gg, gridCv, icon, keycap, lg, lightCv, panel, pbar, setFont, txt } from "./util.ts";
import { WARN_TIME } from "../systems/cave.ts";
import { DEBRIS_T, debrisT, dust } from "../systems/collapseFx.ts";
import { drawDrops } from "../systems/drops.ts";
import { chunks, floatT, solidTile } from "../systems/floating.ts";
import { BARS, furnaceImg, matHave, matIcon, matName } from "../systems/furnace.ts";
import { STICK_R, U_, shopBtn, touch } from "../systems/input.ts";
import { drawCraftModal, drawFurnaceModal, drawShopModal, fitText } from "./townUI.ts";
import { SELL_COLS, SELL_KEYS, stashValue, unitPrice } from "../systems/town.ts";
import { ov } from "../ui/overlay.ts";

// =====================================================================
//  렌더링
// =====================================================================
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
    else if (id === 13) ctx.drawImage(r === SURF ? plinthTop : plinthLow, px, py, T, T);
    else {
      ctx.drawImage(dirtTiles[layerOf(r - SURF)][hv(c, r) % DIRT_VAR], px, py, T, T);
      if (id > 1) {
        const ov = ORE_SPR[id][hv(c, r) & 3];
        ctx.drawImage(ov.img, px, py, T, T);
        const sp = SPARK_ORES[id] ? ov.spark : null;
        if (sp) {
          const k = (S.animT * 1.6 + (c * 5 + r * 3) * 0.37) % 3;
          if (k < 0.5) { const q = sp[(c + r) % sp.length], a = Math.sin(k / 0.5 * Math.PI); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.fillRect(px + q[0] * 2, py + q[1] * 2 - 2, 2, 6); ctx.fillRect(px + q[0] * 2 - 2, py + q[1] * 2, 6, 2); ctx.globalAlpha = 1; }
        }
      }
      if (r === SURF) ctx.drawImage(grassTiles[hv(c, 9) & 1], px, py, T, T);
    }
  };
  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(W - 1, Math.floor((camX + vw) / T));
  const r0 = Math.max(0, Math.floor(camY / T)), r1 = Math.min(H - 1, Math.floor((camY + vh) / T));
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
            for (let k = 0; k < 4; k++) { const hh = 2 + ((hv(c * 4 + k, 51) >> 2) % 3) * 2; ctx.fillRect(px + k * 8 + 2, py - hh, 2, hh); }
          }
          // 천장·벽 그늘(동굴 깊이감)
          if (r > SURF && solidTile(tiles[(r - 1) * W + c])) { ctx.fillStyle = "rgba(0,0,0,0.34)"; ctx.fillRect(px, py, T, 8); ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(px, py + 8, T, 8); }
          if (c > 0 && solidTile(tiles[r * W + c - 1])) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(px, py, 6, T); }
          if (c < W - 1 && solidTile(tiles[r * W + c + 1])) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(px + T - 6, py, 6, T); }
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
      // 터널 가장자리: 어두운 윤곽 + 안쪽 하이라이트/그림자
      const aT = isAir(c, r - 1) && r - 1 >= SURF, aB = isAir(c, r + 1), aL = isAir(c - 1, r), aR = isAir(c + 1, r);
      if (aT) { ctx.fillStyle = "rgba(255,230,190,0.16)"; ctx.fillRect(px, py + 2, T, 2); }
      if (aL) { ctx.fillStyle = "rgba(255,230,190,0.10)"; ctx.fillRect(px + 2, py, 2, T); }
      if (aB) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(px, py + T - 6, T, 4); }
      if (aR) { ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(px + T - 6, py, 4, T); }
      ctx.fillStyle = "#0f0905";
      if (aT) ctx.fillRect(px, py, T, 2);
      if (aB) ctx.fillRect(px, py + T - 2, T, 2);
      if (aL) ctx.fillRect(px, py, 2, T);
      if (aR) ctx.fillRect(px + T - 2, py, 2, T);
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

  // 건물 (정비소 / 아이템 상점 / 제작소)
  {
    const bY = (SURF - 4) * T - camY, bW = 7 * T, bH = 4 * T;
    const bx1 = BUILD_COLS[0][0] * T - camX, bx2 = BUILD_COLS[1][0] * T - camX, bx3 = BUILD_COLS[2][0] * T - camX;
    if ((MINE_COL + 3) * T - camX > 0 && bx1 < vw) {
      ctx.drawImage(S.shopImg, bx1, bY, bW, bH);
      ctx.drawImage(S.itemShopImg, bx2, bY, bW, bH);
      ctx.drawImage(S.craftShopImg, bx3, bY, bW, bH);
      txt("정비소", bx1 + bW / 2, bY + 56, "#ffd34d", 14, "center");
      txt("아이템 상점", bx2 + bW / 2, bY + 48, "#8fd3ff", 14, "center");
      txt("제작소", bx3 + bW / 2, bY + 64, "#7cff6b", 14, "center");
      // 굴뚝 연기 / 용광로 불빛
      const smoke = (x, y, col) => {
        for (let i = 0; i < 4; i++) {
          const t = (S.animT * 0.45 + i / 4) % 1, sz = Math.round((6 + t * 14) / 2) * 2;
          ctx.globalAlpha = (1 - t) * 0.6; ctx.fillStyle = col;
          ctx.fillRect(Math.round(x + Math.sin(S.animT * 1.3 + i * 2) * 8 * t - sz / 2), Math.round(y - t * 72), sz, sz);
        }
        ctx.globalAlpha = 1;
      };
      smoke(bx1 + 186, bY + 8, "#c9ced8");
      // 용광로: 재련 중이면 불길이 세지고 쇳물이 흐름
      {
        const bx4 = BUILD_COLS[3][0] * T - camX, fW = 5 * T;
        ctx.drawImage(furnaceImg, bx4, bY, fW, bH);
        const busy = !!(S.acct && S.acct.furnace && S.acct.furnace.q.length);
        const fx = bx4 + 44, fy = bY + 72, fw = 56, fh = 48;
        const fl = (k) => Math.round((Math.sin(S.animT * (7 + k) + k * 1.7) * 0.5 + 0.5) * 4) * 2;
        ctx.fillStyle = busy ? "#d8401a" : "#4a1a0e"; ctx.fillRect(fx, fy + 18 - fl(1), fw, fh - 18 + fl(1));
        ctx.fillStyle = busy ? "#ff8a1f" : "#6e2812"; ctx.fillRect(fx + 6, fy + 24 - fl(2), fw - 12, fh - 24 + fl(2));
        ctx.fillStyle = busy ? "#ffd34d" : "#94391a"; ctx.fillRect(fx + 14, fy + 30 - fl(3), fw - 28, fh - 30 + fl(3));
        if (busy) { ctx.fillStyle = "#fff3a8"; ctx.fillRect(fx + 22, fy + 36 - fl(4), fw - 44, fh - 36 + fl(4)); }
        ctx.fillStyle = busy ? "rgba(255,138,31,0.22)" : "rgba(255,90,31,0.07)"; ctx.fillRect(bx4 + 24, bY + bH - 4, 96, 4);
        if (busy) {
          ctx.fillStyle = "#ff8a1f"; ctx.fillRect(bx4 + 106, bY + 110, 24, 4);
          ctx.fillStyle = "#fff3a8"; ctx.fillRect(bx4 + 106 + (((S.animT * 30) | 0) % 22), bY + 110, 2, 4);
        }
        smoke(bx4 + 100, bY - 2, busy ? "#8a90a0" : "#c9ced8");
        txt("용광로", bx4 + fW / 2, bY + 31, "#ffb066", 14, "center");
      }
      // 광산 입구 표지판
      const sx = MINE_COL * T + 8 - camX, sy = SURF * T - camY;
      ctx.fillStyle = "#14151f"; ctx.fillRect(sx + 18, sy - 50, 8, 50);
      ctx.fillStyle = "#8a5a3c"; ctx.fillRect(sx + 20, sy - 50, 4, 50);
      ctx.fillStyle = "#14151f"; ctx.fillRect(sx - 4, sy - 66, 74, 30);
      ctx.fillStyle = "#c08a5c"; ctx.fillRect(sx - 2, sy - 64, 70, 26);
      ctx.fillStyle = "#e0a874"; ctx.fillRect(sx - 2, sy - 64, 70, 3);
      ctx.fillStyle = "#8a5a3c"; ctx.fillRect(sx - 2, sy - 41, 70, 3);
      txt("광산 ▼", sx + 33, sy - 58, "#3a2414", 14, "center");
      smoke(bx3 + 32, bY + 10, "#9aa0b4");
      ctx.globalAlpha = 0.16 + 0.1 * Math.sin(S.animT * 9) + 0.05 * Math.sin(S.animT * 23);
      ctx.fillStyle = "#ffb040"; ctx.fillRect(bx3 + 28, bY + 80, 48, 40);
      ctx.globalAlpha = 1;
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

  // 지반 붕괴 징후: 천장에 균열이 생기고 떨리다가 무너짐
  for (const u of S.unstable) {
    if (!(u.t > 0)) continue;
    const k = Math.min(1, (u.t + S.scanT) / WARN_TIME);
    for (let c = u.c0; c <= u.c1; c++) {
      const px = c * T - camX, py = (u.r - 1) * T - camY;
      if (px < -T || px > vw || py < -T || py > vh) continue;
      const sh = k > 0.35 ? (((((S.animT * 30) | 0) + c) % 2) ? 1 : -1) : 0;
      ctx.drawImage(cracks[k < 0.35 ? 0 : k < 0.7 ? 1 : 2], px + sh, py, T, T);
      if (k > 0.55 && ((S.animT * 6) | 0) % 2) { ctx.globalAlpha = 0.25; ctx.fillStyle = "#ff3b2f"; ctx.fillRect(px, py, T, T); ctx.globalAlpha = 1; }
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
    const img = getMiner(P.mode, leg, dg);
    const shake = P.digging && ((S.animT * 40) | 0) % 2 ? 2 : 0;
    ctx.save();
    ctx.translate(px + (P.mode === "side" ? shake * P.facing : 0), py + HH + (P.mode === "down" ? shake : 0));
    if (P.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -16, -32, 32, 32);
    ctx.restore();
    if (U_() && P.fuel > 0) {
      const fh = 8 + (((S.animT * 30) | 0) % 3) * 4;
      ctx.fillStyle = FLAME[LOOK.engine][0]; ctx.fillRect(px - 6, py + HH, 12, fh);
      ctx.fillStyle = FLAME[LOOK.engine][1]; ctx.fillRect(px - 2, py + HH, 4, fh - 4);
    }
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
        if (L <= 0.01 && r >= gr0) break;
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
  if (S.state === "title") drawTitle(SW, SH);
}

// 소모품 단축 슬롯 (1~6 키 / 터치로 탭)
export function drawHotbar(vw, vh) {
  S.hotBtns = []; S.hotLeft = 1e9;
  if (S.state !== "play") return;
  const sz = vw < 560 ? 40 : 48, gap = vw < 560 ? 2 : 4, n = HOT.length, tw = n * sz + (n - 1) * gap, isz = sz === 48 ? 32 : 28;
  const x0 = Math.max(8, vw - 12 - tw), y0 = vh - 12 - sz;
  S.hotLeft = x0;
  HOT.forEach((id, i) => {
    const x = x0 + i * (sz + gap), cnt = P.inv[id] || 0;
    ctx.fillStyle = "#14151f"; ctx.fillRect(x, y0, sz, sz);
    ctx.fillStyle = cnt > 0 ? "#3a3f5e" : "#23263a"; ctx.fillRect(x + 2, y0 + 2, sz - 4, sz - 4);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x + 2, y0 + 2, sz - 4, 3);
    ctx.globalAlpha = cnt > 0 ? 1 : 0.35;
    ctx.drawImage(ICON[id], x + ((sz - isz) >> 1), y0 + 3, isz, isz);
    ctx.globalAlpha = 1;
    txt(String(i + 1), x + 5, y0 + 3, "#9aa3c8", 14);
    txt("x" + cnt, x + sz - 5, y0 + sz - 17, cnt > 0 ? "#fff" : "#7a82a6", 14, "right");
    S.hotBtns.push({ x: x - 2, y: y0 - 2, w: sz + 4, h: sz + 4, id });
  });
}

export function drawHUD(vw, vh, depth) {
  shopBtn.length = 0;
  // 좌상단 상태 카드: 레벨 · 연료 · 돈 · 화물 · 깊이를 한 장에 모음
  const cw = 268, chh = 112;
  panel(10, 10, cw, chh);
  const Lx = levelOf(S.acct ? S.acct.xp : 0);
  ctx.fillStyle = "#14151f"; ctx.fillRect(20, 20, 50, 34);                 // 레벨 배지
  ctx.fillStyle = "#4b3d8c"; ctx.fillRect(22, 22, 46, 30);
  ctx.fillStyle = "#6f5cc4"; ctx.fillRect(22, 22, 46, 4);
  txt("Lv", 45, 24, "#c9bcff", 12, "center");
  txt(String(Lx.lv), 45, 37, "#ffd34d", 14, "center");
  // 연료
  ctx.drawImage(ICON.fuel, 76, 20, 32, 32);
  const fr = P.fuel / maxFuel();
  const blink = fr < 0.25 && ((S.animT * 4) | 0) % 2;
  const fbx = 112, fbw = cw + 10 - fbx - 12;
  if (fr > 0.5) pbar(fbx, 27, fbw, 18, fr, "#5ee06a", "#a4ff9b");
  else if (fr > 0.25) pbar(fbx, 27, fbw, 18, fr, "#ffcd3c", "#fff3a8");
  else pbar(fbx, 27, fbw, 18, fr, blink ? "#ff9a90" : "#ff5a4d", "#ffd0cb");
  txt(Math.ceil(P.fuel) + " / " + Math.round(maxFuel()), fbx + fbw / 2, 29, "#fff", 12, "center");
  // 돈 / 화물 / 깊이
  const money = P.money >= 100000 ? (P.money / 10000).toFixed(P.money >= 1000000 ? 0 : 1) + "만" : String(P.money);
  const full = cargoCount() >= cargoCap();
  ctx.drawImage(ICON.coin, 18, 60, 32, 32);   txt("$" + money, 52, 69, "#ffd34d", 14);
  ctx.drawImage(ICON.crate, 112, 60, 32, 32); txt(cargoCount() + "/" + cargoCap(), 146, 69, full && blink ? "#ff9a90" : full ? "#ff6b6b" : "#fff", 14);
  ctx.drawImage(ICON.depth, 192, 60, 32, 32); txt((Math.floor(depth) + 1) + "m", 226, 69, "#9fd8ff", 14);
  // 칭호 + 경험치
  txt(fitText(titleName() || "칭호 없음", 100), 20, 97, titleName() ? "#ffd34d" : "#7a82a6", 12);
  pbar(126, 99, cw + 10 - 126 - 12, 10, Lx.lv >= MAX_LV ? 1 : Lx.cur / Lx.need, "#b58cff", "#e3d0ff");

  // 우측 상단: 가방 / 업적 / 메뉴 버튼 한 줄 + 그 아래 깊이 미터
  const bs = 44, bg = 6, bx0 = vw - 10 - 3 * bs - 2 * bg, by0 = 10;
  S.menuBtn = null; S.bagBtn = null; S.questBtn = null;
  if (S.state === "play") {
    [[ICON.bag, "I", "bag"], [ICON.trophy, "Q", "quest"], [ICON.menu, "Esc", "menu"]].forEach(([img, key, kind], i) => {
      const x = bx0 + i * (bs + bg);
      panel(x, by0, bs, bs);
      ctx.drawImage(img, x + 6, by0 + 6, 32, 32);
      if (!S.usedTouch) txt(key, x + 4, by0 + bs - 15, "#9aa3c8", 12);
      const hitR = { x: x - 3, y: by0 - 3, w: bs + 6, h: bs + 6 };
      if (kind === "bag") S.bagBtn = hitR; else if (kind === "quest") S.questBtn = hitR; else S.menuBtn = hitR;
    });
  }
  if (S.saveFlash > 0 && S.state !== "title") txt(S.saveFail ? "저장 실패!" : "저장됨", bx0 - 10, by0 + 15, S.saveFail ? "#ff6b6b" : "#7cff6b", 14, "right");
  const mh = Math.min(260, vh - 64 - 150), mx = vw - 10 - 36, my = by0 + bs + 10;
  if (mh >= 70) {
    panel(mx, my, 36, mh);
    const bx = mx + 12, by = my + 10, bw = 12, bhh = mh - 20, total = H - SURF;
    ctx.fillStyle = "#14151f"; ctx.fillRect(bx - 2, by - 2, bw + 4, bhh + 4);
    for (let i = 0; i < 4; i++) {
      const a = LAYERS[i].from, b = i < 3 ? LAYERS[i + 1].from : total;
      ctx.fillStyle = LAYERS[i].base;
      ctx.fillRect(bx, Math.floor(by + bhh * a / total), bw, Math.ceil(bhh * (b - a) / total));
    }
    const mk = Math.floor(by + bhh * Math.max(0, Math.min(1, depth / total)));
    ctx.fillStyle = "#14151f";
    ctx.fillRect(bx - 18, mk - 8, 4, 16); ctx.fillRect(bx - 14, mk - 6, 4, 12); ctx.fillRect(bx - 10, mk - 4, 4, 8); ctx.fillRect(bx - 6, mk - 2, 4, 4);
    ctx.fillStyle = "#ffd34d";
    ctx.fillRect(bx - 16, mk - 6, 4, 12); ctx.fillRect(bx - 12, mk - 4, 4, 8); ctx.fillRect(bx - 8, mk - 2, 4, 4);
  }

  // 지반 불안정 경고
  if (S.cavWarn > 0 && S.state === "play" && P.dead <= 0) {
    const w = Math.min(320, vw - 24), x = Math.floor((vw - w) / 2), y = S.bannerT > 0 ? 80 : 14;
    const blink = ((S.animT * 5) | 0) % 2;
    panel(x, y, w, 52, blink ? "#5a2530" : "#3a2f58");
    txt("! 지반이 불안정해요 !", vw / 2, y + 9, blink ? "#ff9a90" : "#ffd34d", 14, "center");
    pbar(x + 20, y + 30, w - 40, 12, Math.min(1, S.cavWarn), "#ff5a4d", "#ffd0cb");
  }

  // 지층 배너
  if (S.bannerT > 0) {
    const w = 300, x = (vw - w) / 2;
    const slide = Math.min(1, S.bannerT * 3, (3.5 - S.bannerT) * 3);
    panel(x, -60 + 76 * slide, w, 56, "#3a2f58");
    txt(S.bannerText, vw / 2, -60 + 76 * slide + 19, "#ffd34d", 14, "center");
  }

  // 상점 패널
  // 아이템 상점 열기 버튼 (상점 건물 안에 있을 때만)
  S.promptBtn = null;
  const helpOn = S.showHelp && S.state === "play" && (S.helpPinned || S.playT < 30);
  const helpStr = S.usedTouch
    ? "드래그로 조작 · 아래 슬롯: 소모품 · 오른쪽 위: 가방/업적/메뉴"
    : "←→ 이동 · ↑ 추진 · ↓ 파기 · 1-8 소모품 · I 가방 · Q 업적 · Z 확대 · H 도움말";
  setFont(12);
  const helpW = Math.ceil(ctx.measureText(helpStr).width) + 32;
  const helpUp = helpOn && 12 + helpW > S.hotLeft - 8;      // 슬롯과 겹치면 도움말을 슬롯 위로 올리고, 안내창도 같이 올림
  const helpLift = helpUp ? 44 : 0;
  if ((S.nearItems || S.nearCraft || S.nearFurnace || S.nearGarage) && S.state === "play" && P.dead <= 0) {
    const nm = S.nearItems ? "아이템 상점 열기" : S.nearCraft ? "제작소 열기" : S.nearFurnace ? "용광로 열기" : "창고 · 판매 열기";
    const label = S.usedTouch ? nm : "[E] " + nm;
    setFont(16);
    const pw = Math.ceil(ctx.measureText(label).width) + 56, ph = 48;
    const px = Math.floor((vw - pw) / 2), py = vh - 124 - helpLift;
    S.promptBtn = { x: px, y: py, w: pw, h: ph };
    panel(px, py, pw, ph, "#3a2f58");
    txt(label, vw / 2, py + 17, "#ffd34d", 14, "center");
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
    panel(12, hy, helpW, 32, "#23263a");
    ctx.globalAlpha = 1;
    txt(helpStr, 28, hy + 10, "#c9cfe6", 12);
  }
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

