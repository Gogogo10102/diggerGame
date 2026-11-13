// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "./account.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)
import { cleanName, newId } from "./account.ts";
import { SAVE_VER } from "./config.ts";
import { b64dec, b64enc } from "./worldSave.ts";
import { SaveStore } from "../ui/inventory.ts";

// ---- 내보내기 / 가져오기 ----
export function exportCode(d) { return "DD1." + b64enc(JSON.stringify(d)); }
export function parseCode(code) {
  code = String(code || "").trim();
  if (code.slice(0, 4) !== "DD1.") throw new Error("저장 코드 형식이 아니에요");
  let d;
  try { d = JSON.parse(b64dec(code.slice(4))); } catch (e) { throw new Error("저장 코드가 손상됐어요"); }
  if (!d || typeof d.name !== "string" || typeof d.seed !== "number" || !d.player || typeof d.player !== "object")
    throw new Error("저장 코드가 손상됐어요");
  if (d.ver > SAVE_VER) throw new Error("더 새로운 버전의 저장 코드예요");
  return d;
}
export async function importAccount(code) {
  const d = parseCode(code);
  const list = await SaveStore.list();
  const base = cleanName(d.name) || "가져온 계정";
  let name = base, n = 2;
  while (list.some((a) => a.name.toLowerCase() === name.toLowerCase())) name = base.slice(0, 9) + " (" + n++ + ")";
  d.name = name; d.id = newId(); d.updated = Date.now();
  d.stats = Object.assign({ maxDepth: 0, earned: 0, deaths: 0, mined: {} }, d.stats || {});
  await SaveStore.save(d);
  return d;
}

