# Deep Digger ⛏️

픽셀 아트 광산 게임. 땅을 파서 광물을 모으고, 용광로에서 주괴로 녹이고, 팔아서 장비를 업그레이드합니다.
웹 브라우저(PC·모바일)에서 바로 플레이.

## 처음 실행하기
1. [Node.js LTS](https://nodejs.org) 와 [Git](https://git-scm.com) 설치
2. 이 폴더에서 터미널을 열고:
   ```bash
   npm install      # 처음 한 번
   npm run dev      # 브라우저가 열리며 게임 실행 (http://localhost:5173)
   ```
3. 코드를 고치면 저장하는 순간 화면에 반영됩니다.

## 자주 쓰는 명령
```bash
npm test             # 게임 로직 테스트 (ALL_OK 가 나와야 함)
npm run typecheck    # 타입 검사
npm run build        # 배포용 파일을 dist/ 에 생성
npm run assets:manifest  # 그림 PNG 를 추가했을 때 목록 갱신
```

## 조작
- PC: 방향키/WASD 이동·굴착, E 상호작용, `[` `]` 마을 창 탭 이동
- 모바일: 화면의 터치 버튼

## 더 읽을 것
- `CLAUDE.md` — 코드 규칙 (Claude 와 사람 모두)
- `docs/plan.md` — 할 일과 역할 분담
- `docs/decisions.md` — 왜 이렇게 만들었는지
