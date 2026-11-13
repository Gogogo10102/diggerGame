# CLAUDE.md — Deep Digger 작업 규칙

이 저장소에서 일하는 Claude(두 사람이 각자 쓰는 Claude Code 모두)가 먼저 읽는 파일입니다.
사람도 같이 읽어 두면 좋습니다. 결정의 이유는 `docs/decisions.md`, 할 일은 `docs/plan.md` 에 있습니다.

## 프로젝트 한 줄 요약
픽셀 아트 광산 게임(굴착소년 쿵 느낌). 웹 브라우저에서 바로 플레이, 모바일 터치 지원.
**Vanilla TypeScript + Vite**, 프레임워크 없음. 캔버스 2D로 그림. 백엔드 서버 없음(나중에 Supabase로 로그인·저장·랭킹).

## 명령어
| 명령 | 하는 일 |
|---|---|
| `npm install` | 처음 한 번 (vite, typescript 설치) |
| `npm run dev` | 개발 서버 → http://localhost:5173 (저장하면 바로 반영) |
| `npm test` | 스모크 테스트 약 430개 (브라우저 없이 node로 게임 로직 검사) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | `dist/` 에 배포용 파일 생성 (Cloudflare Pages가 이걸 올림) |
| `npm run assets:manifest` | `public/assets` 의 PNG 목록(manifest.json) 다시 만들기 |

**코드를 바꾸면 커밋 전에 반드시 `npm test` 를 돌리고 ALL_OK 를 확인하세요.**

## 폴더 구조
```
src/
  main.ts              게임 루프 시작점 (마지막 모듈 menu.ts 를 import)
  style.css            HTML 창/버튼 스타일
  game/
    core/   config(상수·타일 id) world(지도) player(P) stats state(S)
    art/    sprites(타일·광물 그림) itemIcons buildings assets(PNG 불러오기)
    data/   items recipes consumables progress(레벨·업적·칭호)
    systems/furnace cave floating(떠 있는 흙) collapseFx drops input town update
    render/ util(글꼴·기본 그리기) draw(월드·HUD) townUI(마을 창 4탭) minimap(미니맵·큰 지도)
    save/   config worldSave account transfer
    ui/     dom inventory overlay menu
public/assets/         게임 그림 PNG + manifest.json
tests/                 harness.cjs(가짜 DOM/캔버스) smoke.cjs(테스트)
tools/                 build-test-html.mjs  make-manifest.mjs
docs/                  plan.md decisions.md
```

## 꼭 지켜야 하는 규칙

1. **실행 순서 사슬(chain import)을 깨지 말 것.**
   모든 게임 모듈의 첫 import 는 `import "<바로 앞 모듈>";` 입니다. 원래 한 파일이던 코드라서
   위에서 아래로 실행되는 순서가 중요합니다(앞 모듈의 값을 최상단에서 바로 씀).
   순서: config → world → sprites → player → items → recipes → furnace → cave → floating →
   collapseFx → drops → itemIcons → consumables → buildings → stats → input → town → update →
   util → draw → townUI → minimap → save/config → progress → dom → inventory → worldSave → account → transfer →
   overlay → menu → main.
   - 새 모듈을 넣을 때: 들어갈 자리 앞 모듈을 import 하고, 뒤 모듈의 사슬 import 를 새 모듈로 바꿉니다.
   - `state.ts`, `assets.ts` 는 사슬 밖(누구나 import 가능).
   - 증상: `Cannot access 'X' before initialization` 가 나면 순서 문제입니다.

2. **바뀌는 전역 값은 `S` 에.** 여러 모듈이 다시 대입하는 값(화면 상태, 타이머, 선택 탭 등)은
   `S.xxx` 로 씁니다(`src/game/core/state.ts`). 다른 모듈의 `let` 을 직접 바꿀 수 없기 때문입니다.
   한 번 만들고 속만 바꾸는 객체(P, 배열, Map)는 `export const` 로 두면 됩니다.

3. **최상단 이름은 프로젝트 전체에서 겹치지 않게.** 테스트 빌드가 모든 모듈을 한 파일로
   이어 붙이기 때문입니다. 모듈 안 지역 변수는 상관없습니다. `S.xxx` 의 이름도 최상단 이름과 겹치면 안 됩니다
   (테스트 빌드가 S 의 값들을 전역 이름으로도 꺼내 둠).

4. **`// @ts-nocheck` 는 하나씩 지워 나가는 중.** 옮겨 온 코드라 타입이 없습니다.
   파일을 크게 손볼 때 그 파일의 nocheck 를 지우고 타입을 붙이는 걸 권장(필수 아님).
   새로 만드는 파일에는 nocheck 를 쓰지 마세요.

5. **주석과 UI 문구는 한국어.** 주석은 "왜"를 짧게.

6. **게임 숫자를 바꾸면** (가격, 확률, 경도, 연료 등) 테스트의 기대값도 같이 확인하고,
   `docs/decisions.md` 의 "밸런스 메모" 에 한 줄 남깁니다.

7. **세이브 형식을 바꾸면** 옛 세이브도 읽히게(없는 필드는 기본값) 하고 테스트를 추가합니다.

8. **맵은 32x32칸 구역 단위로 '다가가면' 만들어집니다** (`core/world.ts`). 아직 안 만든 구역은 전부 0(빈칸)이라
   그대로 읽으면 굴로 착각합니다. 플레이어에서 먼 칸을 읽거나 쓰기 전에는 `ensureRect`/`ensureAround` 로 먼저 만드세요
   (먼저 써 두면 나중에 구역이 만들어질 때 덮어써짐). 맵 전체를 훑는 반복문은 쓰지 말고 플레이어 주변 창만 계산합니다.
   구역 모양은 (시드, 위치)로만 정해지므로 생성 규칙(`baseCell`, `chunkFeatures`)을 바꾸면 기존 월드의 안 판 곳 모양도 바뀝니다.

## 글꼴 · UI 규칙
- 글자 크기는 **12 / 16 / 32px 만** 씁니다. 12px = 갈무리11, 16·32px = Neo둥근모. 도트 글꼴은 설계 크기의 정수배가 아니면 흐려집니다.
  캔버스는 `txt(글, x, y, 색, 크기)` 를 쓰면 자동으로 가까운 단계에 맞춰집니다. 글자 폭을 잴 때는 `setFont(크기)` 후 `measureText`.
- 도트 그림은 `drawPx(그림, x, y, 칸크기)` 로 정수 배율로만 키웁니다(1.5배 금지).
- 마을 창(상점·제작·용광로·판매)은 `render/townUI.ts` 의 공용 틀(`townFrame` + `townFooter`)을 씁니다.
  "본문에서 고르기 → 아래 상세 칸에 설명과 버튼" 흐름을 지켜 주세요. 버튼은 `uiBtn`.

## 그림(에셋) 다루는 법
- 게임은 그림을 코드로도 그리지만, `public/assets/<경로>.png` 가 있으면 그 파일로 **덮어씁니다**
  (`src/game/art/assets.ts` 의 `assetTable()` 이 경로 ↔ 그림 연결표).
- 그림 수정: PNG 를 편집기(Aseprite, Piskel 등)로 고쳐 같은 경로에 저장 → 새로고침. 크기는 바뀌어도 됨.
- 새 그림 추가: PNG 저장 → `assetTable()` 에 경로 한 줄 → `npm run assets:manifest`.
  manifest.json 에는 파일마다 내용 지문이 있어서, 그림을 고치면 주소(`?v=지문`)가 바뀌어 브라우저가 예전 그림을 쓰지 않습니다.
  그림을 고친 뒤에도 `npm run assets:manifest` 를 돌리세요(`npm run build` 는 자동으로 돌림).
- 경로 규칙: `ores/icon/<광물id>.png`(인벤토리 아이콘), `ores/world/<id>_<변형>.png`(땅속 광물),
  `ores/drop/<id>.png`(바닥에 떨어진 것), `bars/<cu|fe|ag|au|mi>.png`(주괴), `items/<아이템id>.png`,
  `ui/icon/<이름>.png`, `tiles/...`, `buildings/...`, `sky/...`,
  `signs/mine.png`(광산 입구 표지판), `signs/tab_<탭>_<on|off>.png`(마을 창 탭 이름).
- **건물에는 이름 글자를 쓰지 않고 그림 속 로고(아이콘 배지)만 넣습니다.** 탭 이름도 글꼴 대신 그림.
- 건물 그림(`buildings/item_shop|workshop|furnace.png`)은 `tools/make-buildings.py`, 표지판·탭은 `tools/make-signs.py` 로
  처음 만들었고, 이후엔 PNG를 직접 고쳐도 됩니다. 그림 아래 끝이 땅 표면이고, 크기를 바꿔도 건물 칸 가운데에 붙습니다.
  불빛·연기 위치는 `art/buildings.ts` 의 `BLD_FX` (그림 크기가 같을 때만 그림). 용광로 아궁이·쇳물 홈은 그림에 구멍을 뚫어 두고 그 뒤에 불을 그립니다.
- 광물 id: 2 구리, 3 철, 4 금, 5 다이아, 6 석탄, 8 은, 9 에메랄드, 10 루비, 11 미스릴.
- 현재 원석·주괴 그림은 **임시 확정(v1)** 입니다. 나중에 다시 작업 예정.
- 아직 코드로만 그리는 것: 캐릭터(로봇, 장비에 따라 모양이 바뀜).

## 협업
- 두 사람이 각자 Claude 계정으로 이 저장소를 씁니다(계정 공유 금지).
- `main` 에 바로 올리지 말고 브랜치 → Pull Request → 상대가 확인 후 합치기.
- 브랜치 이름: `기능/짧은설명` 대신 영문 권장 `feat/furnace-queue`, `fix/collapse-dust`, `art/ingots-v2`.
- 같은 파일을 동시에 크게 고치지 않도록 `docs/plan.md` 의 담당 칸을 먼저 확인.
