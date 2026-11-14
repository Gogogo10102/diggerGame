// 테스트용 빌드: src/ 의 모듈들을 브라우저가 실행하는 순서(ESM 평가 순서) 그대로 한 파일로 이어 붙입니다.
//  - import/export 줄만 지우고 이어 붙이므로, 모듈 최상위 이름은 프로젝트 전체에서 겹치면 안 됩니다.
//  - 결과: .test-build/game.html  (tests/harness.cjs 가 Node 안에서 이 파일을 실행)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// 타입 표시(: number 등)를 지우려고 TypeScript 로 JS 변환 (npm install 로 설치됨. 다른 곳의 typescript 는 TS_PATH 로 지정 가능)
const require = createRequire(import.meta.url);
let ts = null;
for (const p of ["typescript", process.env.TS_PATH].filter(Boolean)) { try { ts = require(p); break; } catch (e) { /* 다음 후보 */ } }
if (!ts) console.warn("경고: typescript 를 못 찾음 → 타입 표시가 있는 파일은 실행이 안 될 수 있어요 (npm install)");
const toJs = (text, file) => ts
  ? ts.transpileModule(text, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true } }).outputText
  : text;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const importRe = /^import\s+(?:[^"']*?\s+from\s+)?["'](\.[^"']+)["'];?/gm;

// ESM 평가 순서 = import 를 적힌 순서대로 깊이 우선 탐색한 뒤의 후위 순서
const order = [], seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(importRe)) {
    const dep = path.resolve(path.dirname(file), m[1]);
    if (dep.endsWith(".ts")) visit(dep);
  }
  order.push(file);
}
visit(path.join(src, "main.ts"));

const strip = (t) => t.split("\n")
  .filter((l) => !/^import\s/.test(l) && !/^export \{\s*\};?$/.test(l))
  .map((l) => l.replace(/^export\s+/, ""))
  .join("\n")
  .replace(/^export const S: any = \{\};$/m, "const S = {};")
  .replace(/^const S: any = \{\};$/m, "const S = {};");
let js = "";
for (const f of order) js += "// ---- " + path.relative(src, f) + "\n" + strip(toJs(fs.readFileSync(f, "utf8"), f)) + "\n";
// 테스트에서 예전 전역 이름(state, acct ...)으로 S 값을 읽고 쓸 수 있게
js += "\nfor (const k of Object.keys(S)) Object.defineProperty(globalThis, k, { get() { return S[k]; }, set(v) { S[k] = v; }, configurable: true });\n";

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(src, "style.css"), "utf8");
const out = html
  .replace(/<script type="module" src="\/src\/main\.ts"><\/script>/, "<script>" + js.replace(/<\/script>/g, "<\\/script>") + "</script>")
  .replace("</head>", "<style>\n" + css + "</style>\n</head>");
fs.mkdirSync(path.join(root, ".test-build"), { recursive: true });
fs.writeFileSync(path.join(root, ".test-build", "game.html"), out);
console.log("테스트 빌드: 모듈 " + order.length + "개 → .test-build/game.html");
