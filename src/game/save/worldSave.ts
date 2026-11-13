// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../ui/inventory.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { H, TILE, W } from "../core/config.ts";
import { CH, CW, baseTiles, genChunk, genMask, seen, tiles } from "../core/world.ts";

// ---- 월드 저장 (형식 2) ----
// 맵이 커서 전체를 저장하지 않고, "만들어진 구역 번호 + 그 구역에서 처음과 달라진 칸"만 저장합니다.
// 불러올 때는 같은 시드로 구역을 다시 만들고 달라진 칸만 덮어씀.
//   바이트: "W2" + [구역번호 u16, 바뀐 칸 수 u16, (구역 안 칸 번호 u16, 값 u8) × 수] × 구역 수
export function encodeWorld() {
  const out = [87, 50];
  for (let k = 0; k < genMask.length; k++) {
    if (!genMask[k]) continue;
    const cx = k % CW, cy = (k / CW) | 0, x0 = cx * CH, y0 = cy * CH;
    const diff = [];
    for (let r = y0; r < Math.min(H, y0 + CH); r++) for (let c = x0; c < Math.min(W, x0 + CH); c++) {
      const i = r * W + c;
      if (tiles[i] !== baseTiles[i]) diff.push((r - y0) * CH + (c - x0), tiles[i]);
    }
    const n = diff.length / 2;
    out.push(k >> 8, k & 255, n >> 8, n & 255);
    for (let q = 0; q < diff.length; q += 2) out.push(diff[q] >> 8, diff[q] & 255, diff[q + 1]);
  }
  let bin = "";
  for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return btoa(bin);
}
// genWorld(시드) 를 먼저 한 뒤 부름. 형식이 다르거나(예전 저장) 깨졌으면 false
export function decodeWorld(b64) {
  try {
    const bin = atob(b64);
    if (bin.charCodeAt(0) !== 87 || bin.charCodeAt(1) !== 50) return false;
    const at = (q) => bin.charCodeAt(q);
    let q = 2;
    while (q < bin.length) {
      if (q + 4 > bin.length) return false;
      const k = (at(q) << 8) | at(q + 1), n = (at(q + 2) << 8) | at(q + 3); q += 4;
      if (k >= genMask.length || q + n * 3 > bin.length) return false;
      const cx = k % CW, cy = (k / CW) | 0;
      genChunk(cx, cy);
      for (let m = 0; m < n; m++, q += 3) {
        const local = (at(q) << 8) | at(q + 1), v = at(q + 2);
        if (local >= CH * CH || (v !== 0 && !TILE[v])) return false;
        const c = cx * CH + (local % CH), r = cy * CH + ((local / CH) | 0);
        if (c < W && r < H) tiles[r * W + c] = v;
      }
    }
    return true;
  } catch (e) { return false; }
}
// 0/1(또는 작은 값) 배열을 RLE + base64로
export function encodeRLE(arr) {
  const out = [];
  let v = arr[0], n = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === v && n < 255) n++;
    else { out.push(v, n); v = arr[i]; n = 1; }
  }
  out.push(v, n);
  let bin = "";
  for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return btoa(bin);
}
export function decodeRLE(b64, arr, maxV) {
  try {
    const bin = atob(b64), t = new Uint8Array(arr.length);
    let k = 0;
    for (let i = 0; i + 1 < bin.length; i += 2) {
      const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
      if (v > maxV || k + n > t.length) return false;
      t.fill(v, k, k + n); k += n;
    }
    if (k !== t.length) return false;
    arr.set(t);
    return true;
  } catch (e) { return false; }
}
export function encodeSeen() {
  const out = [];
  let v = seen[0], n = 1;
  for (let i = 1; i < seen.length; i++) {
    if (seen[i] === v && n < 255) n++;
    else { out.push(v, n); v = seen[i]; n = 1; }
  }
  out.push(v, n);
  let bin = "";
  for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return btoa(bin);
}
export function decodeSeen(b64) {
  try {
    const bin = atob(b64);
    const t = new Uint8Array(seen.length);
    let k = 0;
    for (let i = 0; i + 1 < bin.length; i += 2) {
      const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
      if (v > 1 || k + n > t.length) return false;
      t.fill(v, k, k + n); k += n;
    }
    if (k !== t.length) return false;
    seen.set(t);
    return true;
  } catch (e) { return false; }
}
export function b64enc(s) {
  const u = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(bin);
}
export function b64dec(b) {
  const bin = atob(b), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u);
}

