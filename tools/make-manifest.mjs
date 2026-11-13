// public/assets 안의 PNG 목록을 manifest.json 으로 저장 (게임은 이 목록에 있는 파일만 불러옵니다)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "assets");
const list = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".png")) list.push(path.relative(dir, p).split(path.sep).join("/"));
  }
})(dir);
list.sort();
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(list, null, 0) + "\n");
console.log("manifest.json: 그림 " + list.length + "개");
