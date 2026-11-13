# 작업 계획 · 역할 분담

담당 칸에 이름을 적고 시작하세요. 끝나면 [x]. 두 사람이 같은 파일을 동시에 크게 고치지 않는 게 목적입니다.

- **A (게임플레이 담당)** — `src/game/systems`, `core`, `data` 위주: 채굴·붕괴·용광로·밸런스·새 콘텐츠
- **B (화면·서비스 담당)** — `src/game/ui`, `render`, `save`, `public/assets`, 배포·Supabase
- 누가 A/B 를 맡을지는 두 분이 정하세요. 각자 자기 Claude 에게 "docs/plan.md 의 A 작업 해 줘" 처럼 시키면 됩니다.

## 0단계 — 시작 준비 (둘 다, 사람이 직접)
- [ ] Node.js LTS, Git 설치
- [ ] GitHub 비공개 저장소 만들기 → 상대방 초대(Collaborator)
- [ ] 이 폴더를 올리기 (`git init` → `git add .` → `git commit` → `git push`)
- [ ] 각자 `git clone` → `npm install` → `npm run dev` 로 게임이 뜨는지 확인 → `npm test` ALL_OK 확인

## 1단계 — 웹에 올리기 (B)
- [ ] Cloudflare Pages 에 GitHub 저장소 연결 (빌드 명령 `npm run build`, 출력 폴더 `dist`)
- [ ] `*.pages.dev` 주소로 휴대폰에서 접속·터치 조작 확인
- [ ] Galmuri 폰트 버전 고정 또는 `public/` 에 포함
- [ ] GitHub Actions: Pull Request 마다 `npm test` + `npm run typecheck` 자동 실행

## 2단계 — 코드 다듬기 (A, B 각자 자기 폴더)
- [ ] 자기 폴더 파일부터 `@ts-nocheck` 지우고 타입 붙이기 (작은 파일부터: config, stats, drops, furnace)
- [ ] (A) 아이템·레시피·업적 데이터를 `src/data/*.json` 으로 빼기
- [ ] (B) 캐릭터(로봇) 그림을 PNG 파츠로 분리 (몸통·드릴·바퀴 등을 장비별로)
- [ ] (B) 건물 그림에서 매 프레임 코드로 그리는 부분을 PNG 로

## 3단계 — 계정·저장·랭킹 (B 주도, A 는 세이브 데이터 정리)
- [ ] Supabase 프로젝트 생성, 로그인(이메일 또는 구글)
- [ ] 지금의 로컬 저장(localStorage)은 그대로 두고, 로그인하면 클라우드에도 저장·불러오기
- [ ] (A) 세이브 데이터에 버전 번호 넣기, 옛 세이브 변환 함수
- [ ] 랭킹: 최고 깊이, 총 수입, 업적 수 (점수 검증은 Edge Function)

## 4단계 — 콘텐츠 (A 주도)
- [ ] 용광로 확장 아이디어: 합금(구리+은 등), 연료 종류별 속도, 용광로 과열 미니게임
- [ ] 더 깊은 층의 새 광물 / 지형 이벤트(용암, 가스, 지하수)
- [ ] 원석·주괴 아트 다시 작업 (현재 v1 임시 확정) — B 와 같이

## 나중에
- [ ] Capacitor 로 Android/iOS 앱
- [ ] 효과음·배경음
