// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
// =====================================================================
//  이미지 파일 불러오기
//  - 게임의 그림은 코드로도 그려지지만, public/assets/ 에 같은 이름의 PNG가 있으면 그 파일을 대신 씁니다.
//  - public/assets/manifest.json 에 적힌 파일만 불러옵니다(없는 파일 요청으로 콘솔이 지저분해지지 않게).
//  - 그림을 바꾸려면: PNG를 수정해서 같은 경로에 덮어쓰기 → 새로고침. 크기는 원래와 달라도 됩니다.
//  - 새 PNG를 추가했다면 manifest.json 에도 경로를 넣어 주세요 (npm run assets:manifest).
// =====================================================================
import { ICON, oreIcon, ORE_SPR, dirtTiles, backTiles, grassTiles, decoTiles, hardTiles, stoneTiles, cracks, bedrock, sunImg, cloudImg } from "./sprites.ts";
import { ITEM_ICON } from "./itemIcons.ts";
import { SIGN_IMG, TAB_IMG, plinthTop, plinthLow } from "./buildings.ts";
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
  grassTiles.forEach((_, i) => { t["tiles/grass_" + i + ".png"] = () => grassTiles[i]; });
  decoTiles.forEach((_, i) => { t["tiles/deco_" + i + ".png"] = () => decoTiles[i]; });
  hardTiles.forEach((_, i) => { t["tiles/hard_" + i + ".png"] = () => hardTiles[i]; });
  stoneTiles.forEach((_, i) => { t["tiles/stone_" + i + ".png"] = () => stoneTiles[i]; });
  cracks.forEach((_, i) => { t["tiles/crack_" + i + ".png"] = () => cracks[i]; });
  t["tiles/bedrock.png"] = () => bedrock;
  t["tiles/plinth_top.png"] = () => plinthTop;
  t["tiles/plinth_low.png"] = () => plinthLow;
  t["buildings/item_shop.png"] = () => S.itemShopImg;
  t["buildings/workshop.png"] = () => S.craftShopImg;
  t["buildings/furnace.png"] = () => furnaceImg;
  for (const k in SIGN_IMG) t["signs/" + k + ".png"] = () => SIGN_IMG[k];
  for (const k in TAB_IMG) t["signs/tab_" + k + ".png"] = () => TAB_IMG[k];
  t["sky/sun.png"] = () => sunImg;
  t["sky/cloud.png"] = () => cloudImg;
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
  let n = 0;
  await Promise.all(list.map(async (path) => {
    const get = table[path];
    if (!get) return;
    try { const img = await loadImage("assets/" + path); const cv = get(); if (cv) { applyImage(cv, img); n++; } }
    catch (e) { console.warn("그림 파일을 못 읽었어요:", path); }
  }));
  return n;
}
