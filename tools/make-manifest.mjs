// public/assets 안의 PNG 목록을 manifest.json 으로 저장 (게임은 이 목록에 있는 파일만 불러옵니다)
// 파일마다 내용 지문(해시)도 적어 둠 → 게임이 "그림.png?v=지문" 으로 불러서, 그림을 고치면 브라우저가 예전 그림을 쓰지 않음
// npm run build 때 자동으로 다시 만들어짐
import crypto from "node:crypto";
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
const files = {};
for (const f of list) files[f] = crypto.createHash("sha1").update(fs.readFileSync(path.join(dir, f))).digest("hex").slice(0, 8);
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ files }, null, 0) + "\n");
console.log("manifest.json: 그림 " + list.length + "개");
