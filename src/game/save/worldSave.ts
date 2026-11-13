// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../ui/inventory.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { TILE } from "../core/config.ts";
import { seen, tiles } from "../core/world.ts";

// ---- 월드 저장 (RLE + base64) ----
export function encodeWorld() {
  const out = [];
  let v = tiles[0], n = 1;
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] === v && n < 255) n++;
    else { out.push(v, n); v = tiles[i]; n = 1; }
  }
  out.push(v, n);
  let bin = "";
  for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return btoa(bin);
}
export function decodeWorld(b64) {
  try {
    const bin = atob(b64);
    const t = new Uint8Array(tiles.length);
    let k = 0;
    for (let i = 0; i + 1 < bin.length; i += 2) {
      const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
      if (v !== 0 && !TILE[v]) return false;
      if (k + n > t.length) return false;
      t.fill(v, k, k + n); k += n;
    }
    if (k !== t.length) return false;
    tiles.set(t);
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

