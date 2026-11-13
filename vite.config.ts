import { defineConfig } from "vite";

// base "./": 빌드 결과(dist)를 어느 주소 아래에 올려도 동작하도록 상대 경로로 만듭니다.
export default defineConfig({
  base: "./",
  // 묶은 JS/CSS는 static/ 에 두고, public/assets/(게임 그림 파일)와 섞이지 않게 합니다.
  build: { target: "es2022", assetsDir: "static" },
  server: { port: 5173, open: true },
});
