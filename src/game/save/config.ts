// @ts-nocheck — 원래 한 파일이던 코드를 옮겨 온 상태. 타입을 붙이면서 이 줄을 하나씩 지워 나가세요.
import "../render/draw.ts";   // 실행 순서 보장: 바로 앞 모듈을 먼저 실행 (docs/decisions.md 참고)


// =====================================================================
//  계정 / 저장 데이터
//   - 계정마다 독립된 월드(시드), 진행도, 통계를 따로 저장합니다.
//   - 저장소는 SaveStore 뒤에 숨겨 두었습니다. 지금은 브라우저 localStorage이고,
//     서버 계정(Firebase/Supabase 등)을 붙일 때는 SaveStore의 list/load/save/remove 만 교체하면 됩니다.
// =====================================================================
export const SAVE_VER = 1;
export const LS_PREFIX = "deepdigger:v1:";
export const ORE_IDS = [6, 2, 3, 8, 4, 9, 5, 10, 11];     // 통계 표시 순서(싼 것 → 비싼 것)
