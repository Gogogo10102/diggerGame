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
| `npm test` | 스모크 테스트 약 490개 (브라우저 없이 node로 게임 로직 검사) |
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
    core/   config(상수·타일 id) world(지도) player(P) stats state(S) sound(효과음 합성)
    art/    sprites(타일·광물 그림) itemIcons buildings assets(PNG 불러오기)
    data/   items recipes consumables progress(레벨·업적·칭호)
    systems/furnace cave floating(떠 있는 흙) collapseFx drops input town update
    render/ util(글꼴·기본 그리기) draw(월드·HUD) townUI(마을 창 4탭) minimap(미니맵·큰 지도)
    save/   config worldSave account transfer
    ui/     dom inventory overlay menu
public/assets/         게임 그림 PNG + manifest.json
tests/                 harness.cjs(가짜 DOM/캔버스) smoke.cjs(테스트)
tools/                 build-test-html.mjs  make-manifest.mjs  make-hires.py(+robot3d.py, mapart.py)  make-player.py  make-pixellab-tiles.py  make-pixellab-ores.py  make-icons.py(+pixicon.py)  make-drill-icons.py(+drillart/)  make-buildings.py  make-signs.py
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
   - `state.ts`, `assets.ts`, `sound.ts`(효과음) 는 사슬 밖(누구나 import 가능).
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
   새 지형 요소를 넣을 때는 기존 광맥과 **다른 난수**(hash32 의 salt)를 써야 기존 광맥 배치가 그대로 유지됩니다(동굴이 그 예).
   빈칸은 두 종류: `natAir`(처음부터 빈 자연 동굴) / `dugAir`(플레이어가 판 칸). 떠 있는 흙 낙하는 판 칸 기준으로만 계산합니다(지반 붕괴는 없앰).
   테스트에서 굴을 직접 만들 때는 `WGEN.caveOff = true` 로 자연 동굴을 끈 월드를 씁니다(tests 의 login 이 기본으로 끔).

## 글꼴 · UI 규칙
- 글자 크기는 **12 / 16 / 32px 만** 씁니다. 12px = 갈무리11, 16·32px = Neo둥근모. 도트 글꼴은 설계 크기의 정수배가 아니면 흐려집니다.
  캔버스는 `txt(글, x, y, 색, 크기)` 를 쓰면 자동으로 가까운 단계에 맞춰집니다. 글자 폭을 잴 때는 `setFont(크기)` 후 `measureText`.
- 도트 그림은 `drawPx(그림, x, y, 칸크기)` 로 정수 배율로만 키웁니다(1.5배 금지).
- **굴 가장자리**는 `draw.ts` 의 `wangEdge` 가 PixelLab 타일셋(Wang 시트 `tiles/wang/<지층>.png`)의 가장자리 칸을 그대로 그립니다(윗면 풀·돌 윗단·옆 테두리·천장 그늘).
  **블록 모양은 바꾸지 않음**: 판 칸 옆 흙도 네모 그대로, 검은 윤곽선·깎기 없음(2026-11-25). 시트는 꼭짓점 기준이라 한 칸을 4조각으로 나눠 그림.
- **UI 스타일 = 철판**(레퍼런스 MENU 판): 숯색 판(`SY.body`) + 검은 테두리 + 회색 철판 머리띠·버튼(모서리 리벳) + 노란 경고 줄무늬. 색은 `render/util.ts` 의 `SY`·`MT`.
  제목 글씨는 주황 그러데이션 + 굵은 검은 테두리: 캔버스 `titleTxt`, HTML 창 `h2`(el 이 안쪽 `span.tt` 로 감쌈).
- **버튼 = 회색 철판, 뜻은 왼쪽 작은 색 띠 + 글자**: 초록 진행·구매 / 파랑 저장·정보 / 주황 설정·메뉴 / 빨강 닫기·뒤로·삭제 / 띠 없음 = 못 누름.
  캔버스는 `uiBtn`(kind: go·plain·gold·danger·steel) 또는 `btnPx` + `btnTxt`(진한 파인 글씨), HTML 창은 `mkBtn(글, 함수, "pri"|"info"|"back"|"del"|"off")` (없으면 주황).
- **미니맵·깊이 막대는 켜고 끌 수 있음**: 메뉴 버튼 아래 지도 버튼(누르면 토글, PC 는 N 키). `miniOn(vw)`(draw.ts) — 저장값(`S.miniOn`, settings.miniOn)이 없으면 휴대폰 세로(터치 + 폭 600 미만)는 끔.
  터치 화면 도움말 띠는 눌러서 닫음(`S.helpRect`). 둘 다 누르면 조작(드래그)이 시작되지 않게 input.ts 에서 먼저 처리.
- **양 표시는 칸 막대**(`segBar`): 연료·화물·경험치·단계·소리 크기. 아이콘은 막대 왼쪽 끝에 겹침.
- **큰 화면 UI 배율**: 마을 창은 `townScale`(draw.ts)로 2배/1.5배 키워 그리고 누른 자리도 나눠 맞춤(`S.townU`). 창 함수는 나눈 화면 크기를 받으니 배치는 그대로 짜면 됨. HTML 창은 style.css 의 zoom.
- 마을 창(상점·제작·용광로·판매)은 `render/townUI.ts` 의 공용 틀 `townFrame(…, 분류목록, 고른분류, 분류동작)` 을 씁니다.
  "왼쪽 분류 → 오른쪽 목록(줄마다 버튼)" 흐름을 지켜 주세요. 상세 칸이 필요하면 `townFooter`.
- **효과음**: 새 동작을 넣으면 `sfx("이름")` 도 같이 (`core/sound.ts` 의 목록에서 고르거나 추가). 테스트 환경에선 소리 없이 지나감.

## 그림(에셋) 다루는 법
- 게임은 그림을 코드로도 그리지만, `public/assets/<경로>.png` 가 있으면 그 파일로 **덮어씁니다**
  (`src/game/art/assets.ts` 의 `assetTable()` 이 경로 ↔ 그림 연결표).
- 그림 수정: PNG 를 편집기(Aseprite, Piskel 등)로 고쳐 같은 경로에 저장 → 새로고침. 크기는 바뀌어도 됨.
- 새 그림 추가: PNG 저장 → `assetTable()` 에 경로 한 줄 → `npm run assets:manifest`.
  manifest.json 에는 파일마다 내용 지문이 있어서, 그림을 고치면 주소(`?v=지문`)가 바뀌어 브라우저가 예전 그림을 쓰지 않습니다.
  그림을 고친 뒤에도 `npm run assets:manifest` 를 돌리세요(`npm run build` 는 자동으로 돌림).
- **크기 기준:** 타일 T=64px, 캐릭터(드릴 로봇)는 몸통 48px(드릴·안테나 포함 120x120). 충돌 상자는 24px 그대로. 확대 배율은 0.5 단위만(도트가 정수).
  속도·중력처럼 px 단위 숫자는 타일 32px 시절 값 × `PX`(=T/32) 로 써서, 한 칸 지나는 데 걸리는 시간이 타일 크기와 상관없게 합니다.
- **고해상도(1:1):** `public/assets` 의 그림은 화면 1px = 그림 1px 로 그립니다. 타일·땅속 광물 64x64, 광물 아이콘·주괴·아이템·화면 아이콘 32x32,
  떨어진 광물 24x24, 해 64, 구름 80x32, 캐릭터 부품 120x120, 건물은 예전 도트의 4배 크기. (코드로 그린 대체 그림은 16px 도트 × AS)
  - 그리는 쪽은 크기를 정해서 그리므로 그림 크기와 상관없음. 작게 줄일 때는 `blit`(util.ts)·`drawPx` 가 부드럽게 줄임.
  - 건물 PNG 는 폭 160px 이하면 도트 원본(×AS), 넘으면 고해상도(1:1). 불빛 자리 `BLD_FX` 는 도트 원본 좌표 그대로.
  - 땅속 광물 반짝임 자리는 고해상도 그림이면 `ORE_HI_SPARK`(make-hires.py 의 `ORE_HI_SLOTS` 와 짝).
- 경로 규칙: `ores/icon/<광물id>.png`(인벤토리 아이콘), `ores/world/<id>_<변형>.png`(땅속 광물),
  `ores/drop/<id>.png`(바닥에 떨어진 것), `bars/<cu|fe|ag|au|mi>.png`(주괴), `items/<아이템id>.png`,
  `ui/icon/<이름>.png`, `tiles/...`, `buildings/...`, `sky/...`,
  `signs/mine.png`(광산 입구 표지판), `signs/tab_<탭>_<on|off>.png`(마을 창 탭 이름).
- **건물에는 이름 글자를 쓰지 않고 그림 속 로고(아이콘 배지)만 넣습니다.** 탭 이름도 글꼴 대신 그림.
- 건물 그림(`buildings/item_shop|workshop|furnace.png`)은 `tools/make-buildings.py`, 표지판·탭은 `tools/make-signs.py` 로
  처음 만들었고, 이후엔 PNG를 직접 고쳐도 됩니다. 그림 아래 끝이 땅 표면이고, 크기를 바꿔도 건물 칸 가운데에 붙습니다.
  불빛·연기 위치는 `art/buildings.ts` 의 `BLD_FX` (그림 크기가 같을 때만 그림). 용광로 아궁이·쇳물 홈은 그림에 구멍을 뚫어 두고 그 뒤에 불을 그립니다.
- 광물 id: 2 구리, 3 철, 4 금, 5 다이아, 6 석탄, 8 은, 9 에메랄드, 10 루비, 11 미스릴.
- **드릴 아이콘**(`items/<드릴 id>.png` 15개 + `ui/icon/drill.png`)은 `python3 tools/make-drill-icons.py` (확정 도안 v2, 등급 4 × 진화 4 중 고른 표는 파일 안 MAP).
- 현재 원석·주괴 그림은 **임시 확정(v1)** 입니다. 나중에 다시 작업 예정.
- 아이템·소모품·화면 아이콘(`items/`, `ui/icon/`)은 `python3 tools/make-icons.py` 로 다시 만들 수 있습니다(밝은 플랫 스타일, 기본 32px · `--size 16` 이면 예전 크기. 드릴 아이콘은 건드리지 않음). 고친 뒤 `npm run assets:manifest`.
- 흙·뒷벽·돌·풀·장식·균열·광물(땅속/아이콘/떨어진 것)·주괴·해·구름·캐릭터 부품은 `python3 tools/make-hires.py` 가 만듭니다.
  **맵 스타일 A(굵은 외곽선 덩어리, 2026-11-20 확정)**: 흙·뒷벽·땅속 광물·풀·풀잎·해·구름은 `tools/mapart.py`(칸당 32px 도트 ×2). 흙은 4x4칸이 이어지는 돌바닥 무늬라 변형 번호 = `(c&3) + (r&3)*4` (draw.ts). (굴 윤곽선·깎기는 없앰 → 위 '굴 가장자리')
  지층 색·광물 색은 `config.ts`, 주괴 색은 `furnace.ts` 에서 읽어 오므로 색을 바꾸면 다시 돌리면 됩니다. 그 뒤 PNG 를 직접 고쳐도 됩니다.
- **땅 블록 = PixelLab 타일셋(2026-11-24)**: `tools/ref/pixellab/tiles/layer<지층>_<이름>.png`(사이드뷰 32px, Wang 내보내기 160x128)를
  `python3 tools/make-pixellab-tiles.py` 가 속 칸((0,3) 칸)만 잘라 2배로 → `tiles/dirt/<지층>_<0~15>` · `tiles/back`(어둡게) · `tiles/cave/back_*` · `grass_0/1`(흙 타일셋 윗면 풀 띠) · `tiles/wang/<지층>`(시트 통째 2배, 굴 가장자리).
  예전 자갈 덧그림(`tiles/dirt/over_*`)은 그림체가 달라 비움. 원본이 없는 지층(지금 1번 점토)은 흙 무늬를 그 지층 색(`LAYERS`)으로 바꿔 씀.
  **make-hires.py 를 다시 돌리면 이 블록 그림을 덮어쓰니**, 그 뒤에 make-pixellab-tiles.py 를 다시 돌릴 것. 단단한 돌·동굴 장식은 아직 예전(맵 스타일 A) 그림.
- **땅속 광물 = 흙에 박힌 작은 알갱이(2026-11-25 확정)**: `python3 tools/make-pixellab-ores.py [광물id…]` → `ores/world/<id>_<0~3>`(투명 바탕에 알갱이만, 32px 도트 ×2).
  알갱이 7~8개(3칸 ㄱ자·2x2·2x2+1칸)를 3x3 자리에 하나씩 흔들어 놓고 테두리에서 4px 안쪽. 왼위 하이라이트·오른아래 어둡게·아래 그림자 한 칸.
  색: 구리는 PixelLab 인페인팅 결과(`tools/ref/pixellab/ores/copper_ref.png` vs 원래 흙 `dirt_base.png`)에서 뽑은 색, 나머지는 `ORE_COL`(철만 `COL_OVERRIDE`, 은과 구분).
  **보석(다이아·에메랄드·루비)은 결정 모양이 필요해 아직 예전 그림** → `ores/<id>_ref.png`(같은 흙 칸에 인페인팅)를 받으면 따로.
  반짝이는 광물의 반짝임 자리는 도구가 출력하는 값을 `sprites.ts` 의 `ORE_FLECK_SPARK` 에 붙여 넣음(배치를 바꾸면 다시). 광물 아이콘·떨어진 광물은 아직 예전 그림.
  make-hires.py 를 다시 돌리면 덮어쓰니 그 뒤에 이 도구를 다시 돌릴 것.
- **사람 광부 · 로봇 그림 = PixelLab 원본**(`tools/ref/pixellab/`): `east.png`·`west.png`(서 있기 56x56) · `walk_east.gif`(걷기 8장 80x80) · `robot_se.png`·`robot_sw.png`(로봇 72x72)
  · `robot_walk_se.gif`(로봇 걷기 8장) · `robot_jump_se.gif`(로봇 점프 9장: 웅크림 → 백팩 로켓 점화 → 착지, 불꽃이 그림에 들어 있음)
  · `robot_dig_se.gif`(로봇 캐기 9장: 오른팔 톱니바퀴를 앞으로 내질러 돌림).
  `python3 tools/make-player.py` 가 → `player/body.png`(80x80 칸, 줄 0 오른쪽 · 줄 1 왼쪽, 칸 0 서 있기 · 1~8 걷기, 왼쪽 걷기는 뒤집음) + `mech/body.png`(104x104 칸, 같은 줄 규칙) +
  `player/pick.png`(손에 드는 곡괭이, 손잡이 (16,29)) · `tiles/ladder.png`. 광부 칸은 모자 가운데 x 40 · 발바닥 y 68 (`draw.ts` 의 `PCX`·`PFT`), 로봇 칸은 몸 가운데 x 52 · 발바닥 y 96 (`sprites.ts` 의 `MCX`·`MFT`).
  로봇 동작은 `sprites.ts` 의 `MECH_ANIM` + `draw.ts` 의 `mechAnim()`: 점화(한 번, `S.thrustT` < 0.16초) → 비행(누르는 동안 반복) → 낙하(뗌) → 착지(`S.landT`) → 서 있기 / 걷기(걸은 거리).
  캐기는 팔 내지르기(`dig_in`, 캔 지 0.24초까지 `S.digHoldT`) → 톱니바퀴 회전(`dig` 반복). 아래·위는 `dig_down*`·`dig_up*`(시트 27~35·36~44칸):
  원본 `robot_dig_down_se.gif`(있음)·`robot_dig_up_se.gif`(아직 없음 → 임시 칸)를 9장으로 맞춰 넣음. 캐는 동안 파는 쪽으로 몸을 붙이고 ±2px 갈리는 떨림(톱니바퀴가 암석에 닿게).
  로봇은 그림 속 불꽃을 쓰고 코드 불꽃은 안 그림. 단 **날면서 캘 때**는 캐기 그림(불꽃 없음)을 쓰고 등 아래 분사구에 코드 불꽃을 덧그림.
  칸 고르기는 `sprites.ts` 의 `PLAYER_ANIM`(칸 번호 목록), 손 자리는 `PGRIP`. **점프·사다리·곡괭이질 원본은 아직 없어서** 서 있기/걷기 칸을 빌려 쓰고 곡괭이는 손에 붙여 코드로 돌림(`SWING_POSE`·`humanPose()`).
  새 동작 원본(예: `mine_east.gif`)을 받으면 make-player.py 의 시트에 칸을 더하고 `PLAYER_ANIM` 만 고치면 됨. 걷기 칸은 걸은 거리(`S.walkD`)로 넘김(미끄러져 보이지 않게).
  박자는 `update.ts` 의 `PICK_SWING`(0.4초): 내리찍는 순간에만 소리·부스러기·캐기 진행. 곡괭이 날은 회색이라 단계 색(`PICK_TIER`)으로 칠함.
  로봇은 사서 마을 차고(`GARAGE` 7~8칸)에서 타는 탈것: `P.mech` 가 참일 때만 로봇 그림·드릴·추진. 로봇 시트가 있으면 그것으로(팔 때는 서 있기 칸으로 파는 쪽에 들이밀며 덜덜), 없으면 아래 예전 코드 로봇.
- 예전 캐릭터(**드릴 로봇**, PixelLab 로봇 그림이 없을 때만, `sprites.ts` 의 `getMiner`): 옆에서 살짝 비껴 본 3D(3/4 각도), 노란 몸 + 회색 머리·파란 외눈 + 안테나 두 개 + 관절 없는 통짜 팔 끝 드릴, 궤도 위.
  `tools/robot3d.py` 가 상자·원기둥·공으로 세운 작은 3D 장면을 눈높이에서 비스듬히 비춰 4단 명암으로 끊어 그립니다(돈 각도 `TH`, 내려다본 각도 `PH`=0 이라 궤도 두 줄이 같은 땅에 붙음, 크기 `K`, 발밑 자리 `ORG`).
  부품 PNG `miner/*.png` 21개(`tools/make-hires.py` 가 robot3d 로 만듦. 안테나 3자세 `ant_0~2`·`lamp_0/lamp/lamp_2`, 눈 감은 덮개 `blink_<자세>` 포함)를 읽으면 그것으로 조립하고, 없으면 예전 미니 굴착기 코드 도트(40x40 × 3)로 그립니다.
  `body_<side|down|up>` 은 색 그대로, `trk_<0|1>`·`cw`(등 탱크)·`lamp`(안테나 끝 불빛)·`bit_<자세>_<0|1>` 은 **회색**으로 그려 두면 장비 단계 색(`PAL`·`GLOW`)으로 바꿔 칠합니다
  (밝기 24 미만 = 외곽선, 56/104/160/224 를 경계로 어둠·l·m·h·반짝). 부품 자리는 120x120 안에서 몸통 칸 36~84, 발 = y 84.
  **로봇 종류**(노랑이 외 5종): 모양 `robot3d.STY` + 색 `tools/chars.py` → `miner/<id>/*.png` 12개(몸·눈 덮개·안테나·안테나 끝). 목록 `CHAR_IDS`(sprites.ts) · 이름·해금 `CHAR_INFO`(progress.ts) 는 chars.py 와 같은 순서. 고른 로봇 `S.charId`.

## 협업
- 두 사람이 각자 Claude 계정으로 이 저장소를 씁니다(계정 공유 금지).
- `main` 에 바로 올리지 말고 브랜치 → Pull Request → 상대가 확인 후 합치기.
- 브랜치 이름: `기능/짧은설명` 대신 영문 권장 `feat/furnace-queue`, `fix/collapse-dust`, `art/ingots-v2`.
- 같은 파일을 동시에 크게 고치지 않도록 `docs/plan.md` 의 담당 칸을 먼저 확인.
