// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
// =====================================================================
//  이미지 파일 불러오기
//  - 게임의 그림은 코드로도 그려지지만, public/assets/ 에 같은 이름의 PNG가 있으면 그 파일을 대신 씁니다.
//  - public/assets/manifest.json 에 적힌 파일만 불러옵니다(없는 파일 요청으로 콘솔이 지저분해지지 않게).
//  - 그림을 바꾸려면: PNG를 수정해서 같은 경로에 덮어쓰기 → 새로고침. 크기는 원래와 달라도 됩니다.
//  - 새 PNG를 추가했다면 manifest.json 에도 경로를 넣어 주세요 (npm run assets:manifest).
// =====================================================================
import { ICON, oreIcon, ORE_SPR, dirtTiles, backTiles, grassTiles, decoTiles, hardTiles, stoneTiles, cracks, bedrock, sunImg, cloudImg, MINER_HI, MINER_CH, minerCache, chestTile, caveBack, caveTop, caveBot, wangTiles, wangBlock, treeImgs, dirtOver, gasTile, ladderTile, PLAYER_IMG, MECH_IMG, clearPlayerCache } from "./sprites.ts";
import { ITEM_ICON } from "./itemIcons.ts";
import { GARAGE_IMG, SIGN_IMG, TAB_IMG, UIK, plinthTop, plinthLow } from "./buildings.ts";
import { barIcon, furnaceImg } from "../systems/furnace.ts";
import { oreDrop } from "../systems/drops.ts";
import { S } from "../core/state.ts";

// 파일 경로(public/assets 기준) → 그 그림이 들어 있는 캔버스
export function assetTable() {
  const t = {};
  for (const k in ICON) t["ui/icon/" + k + ".png"] = () => ICON[k];
  for (const k in ITEM_ICON) if (ITEM_ICON[k] !== ICON[k]) t["items/" + k + ".png"] = () => ITEM_ICON[k];
  for (const k in oreIcon) t["ores/icon/" + k + ".png"] = () => oreIcon[k];
  for (const k in ORE_SPR) ORE_SPR[k].forEach((v, i) => { t["ores/world/" + k + "_" + i + ".png"] = () => ORE_SPR[k][i].img; });
  for (const k in oreDrop) t["ores/drop/" + k + ".png"] = () => oreDrop[k];
  for (const k in barIcon) t["bars/" + k + ".png"] = () => barIcon[k];
  dirtTiles.forEach((arr, L) => arr.forEach((_, v) => { t["tiles/dirt/" + L + "_" + v + ".png"] = () => dirtTiles[L][v]; }));
  backTiles.forEach((arr, L) => arr.forEach((_, v) => { t["tiles/back/" + L + "_" + v + ".png"] = () => backTiles[L][v]; }));
  caveBack.forEach((arr, L) => arr.forEach((_, v) => { t["tiles/cave/back_" + L + "_" + v + ".png"] = () => caveBack[L][v]; }));
  caveTop.forEach((arr, L) => arr.forEach((_, v) => { t["tiles/cave/top_" + L + "_" + v + ".png"] = () => caveTop[L][v]; }));
  wangTiles.forEach((_, L) => { t["tiles/wang/" + L + ".png"] = () => wangTiles[L]; });
  for (const [id, nm] of [[12, "stone"], [16, "hard"], [7, "bedrock"]]) t["tiles/wang/" + nm + ".png"] = () => wangBlock[id];
  caveBot.forEach((_, i) => { t["tiles/cave/bot_" + i + ".png"] = () => caveBot[i]; });
  treeImgs.forEach((_, i) => { t["tiles/tree_" + i + ".png"] = () => treeImgs[i]; });
  dirtOver.forEach((arr, L) => arr.forEach((_, v) => { t["tiles/dirt/over_" + L + "_" + v + ".png"] = () => dirtOver[L][v]; }));
  grassTiles.forEach((_, i) => { t["tiles/grass_" + i + ".png"] = () => grassTiles[i]; });
  decoTiles.forEach((_, i) => { t["tiles/deco_" + i + ".png"] = () => decoTiles[i]; });
  hardTiles.forEach((_, i) => { t["tiles/hard_" + i + ".png"] = () => hardTiles[i]; });
  stoneTiles.forEach((_, i) => { t["tiles/stone_" + i + ".png"] = () => stoneTiles[i]; });
  cracks.forEach((_, i) => { t["tiles/crack_" + i + ".png"] = () => cracks[i]; });
  t["tiles/bedrock.png"] = () => bedrock;
  t["tiles/plinth_top.png"] = () => plinthTop;
  t["tiles/plinth_low.png"] = () => plinthLow;
  t["buildings/town.png"] = () => S.townImg;                          // 상점·제작소·용광로를 합친 한 채 (예전 세 건물 그림은 안 씀)
  for (const k in UIK) t["ui/kit/" + k + ".png"] = () => UIK[k];   // 마을 창 UI 부품
  for (const k in GARAGE_IMG) t["buildings/" + k + ".png"] = () => GARAGE_IMG[k];   // 로봇 차고 두 단계 + 셔터
  for (const k in SIGN_IMG) t["signs/" + k + ".png"] = () => SIGN_IMG[k];
  for (const k in TAB_IMG) t["signs/tab_" + k + ".png"] = () => TAB_IMG[k];
  t["sky/sun.png"] = () => sunImg;
  t["sky/cloud.png"] = () => cloudImg;
  t["tiles/chest.png"] = () => chestTile;
  t["tiles/gas.png"] = () => gasTile;
  t["tiles/ladder.png"] = () => ladderTile;
  for (const k in PLAYER_IMG) t["player/" + k + ".png"] = () => PLAYER_IMG[k];   // 광부 시트 (몸 · 곡괭이 · 백팩 로켓)
  for (const k in MECH_IMG) t["mech/" + k + ".png"] = () => MECH_IMG[k];          // 로봇 탈것 시트 (PixelLab 원본으로 만듦)
  for (const k in MINER_HI) t["miner/" + k + ".png"] = () => MINER_HI[k];
  for (const id in MINER_CH) for (const k in MINER_CH[id]) t["miner/" + id + "/" + k + ".png"] = () => MINER_CH[id][k];   // 다른 캐릭터 부품
  return t;
}

// 파일을 읽어서 같은 캔버스에 덮어 그림 → 그 캔버스를 쓰는 모든 코드가 새 그림을 씀
function applyImage(cv, img) {
  cv.width = img.naturalWidth || img.width;
  cv.height = img.naturalHeight || img.height;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, 0);
}
function loadImage(url) {
  return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = url; });
}
export async function loadAssets() {
  if (typeof fetch !== "function" || typeof Image === "undefined") return 0;
  let list;
  try {
    const r = await fetch("assets/manifest.json", { cache: "no-cache" });
    if (!r.ok) return 0;
    list = await r.json();
  } catch (e) { return 0; }                                            // 파일이 없으면 코드로 그린 그림 그대로 사용
  const table = assetTable();
  // 목록 형식: { files: { 경로: 지문 } } (예전 형식: [경로, ...]). 지문을 주소 뒤에 붙여 예전 그림 캐시를 피함
  const entries = Array.isArray(list) ? list.map((p) => [p, ""]) : Object.entries((list && list.files) || {});
  let n = 0;
  const kitUrl = {};
  await Promise.all(entries.map(async ([path, ver]) => {
    const get = table[path];
    if (!get) return;
    const url = "assets/" + path + (ver ? "?v=" + ver : "");
    try { const img = await loadImage(url); const cv = get(); if (cv) { applyImage(cv, img); n++; if (path.startsWith("ui/kit/")) kitUrl[path.slice(7, -4)] = url; } }
    catch (e) { console.warn("그림 파일을 못 읽었어요:", path); }
  }));
  // HTML 창(인벤토리·메뉴 등)도 같은 UI 부품으로: CSS 변수 --k-<이름> 에 그림 주소를 넣고 <html class="kit"> (style.css 의 .kit #ov …)
  try {
    if (kitUrl.window) {
      const st = document.documentElement.style;
      for (const k in kitUrl) st.setProperty("--k-" + k, "url(" + JSON.stringify(kitUrl[k]) + ")");
      document.documentElement.classList.add("kit");
    }
  } catch (e) { /* 테스트 환경 */ }
  minerCache.clear();                                                   // 그림이 바뀌었으니 조립해 둔 캐릭터 그림을 다시 만듦
  clearPlayerCache();
  return n;
}
