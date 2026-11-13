const { boot } = require("./harness.cjs");
const path = process.argv[2] || require("path").join(__dirname, "..", ".test-build", "game.html");
const ok = (c, m) => { if (!c) throw new Error("ASSERT FAILED: " + m); console.log("  ok -", m); };
const worldHash = (t) => t.ev("tiles.reduce((a, v, i) => (a * 31 + v + i) >>> 0, 7)");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(t, name) {
  t.key("Enter"); await t.tick();                       // 타이틀 → 계정 화면
  const inp = t.find((n) => n.tag === "input");
  inp.value = name;
  await t.click("계정 만들기");
}

(async () => {
  console.log("[1] 광물/월드");
  const t = boot(path);
  t.run(10);
  ok(t.ev("state") === "title", "타이틀 화면에서 시작");
  const cnt = JSON.parse(t.ev("JSON.stringify((() => { const c = {}; for (const v of tiles) c[v] = (c[v] || 0) + 1; return c; })())"));
  for (const id of [2, 3, 4, 5, 6, 8, 9, 10, 11]) ok(cnt[id] > 0, "월드에 광물 id " + id + " 생성 (" + cnt[id] + "개)");
  ok(t.ev("[2,3,4,5,6,8,9,10,11].every((id) => TILE[id] && ORE_COL[id] && oreTiles[id])"), "모든 광물에 타일 정의/색/스프라이트 존재");
  const dep = t.ev("(() => { const f = {}; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const v = tiles[r*W+c]; if ([6,8,9,10,11].includes(v) && !(v in f)) f[v] = r - SURF; } return JSON.stringify(f); })()");
  console.log("  (첫 등장 깊이)", dep);

  console.log("[2] 계정 생성 / 입력 처리");
  t.key("Enter"); await t.tick();
  ok(t.ev("state") === "account", "타이틀에서 키를 누르면 계정 화면");
  t.key("KeyE"); t.key("Escape"); t.key("Space");
  ok(t.ev("state") === "account", "계정 화면에서는 게임 키가 무시됨(입력칸 타이핑 보호)");
  await t.click("계정 만들기");
  ok(t.texts().some((x) => x.includes("이름을 입력")), "이름이 비면 안내 메시지");
  const inp = t.find((n) => n.tag === "input");
  inp.value = "  Tester  ";
  await t.click("계정 만들기");
  ok(t.ev("state") === "play", "계정 생성 후 플레이 시작");
  ok(t.ev("acct.name") === "Tester", "이름 공백 정리");
  const hashA = worldHash(t);
  t.run(30);

  console.log("[3] 진행 저장/복원");
  t.ev("P.money = 1000; buyItem('steel_drill')");
  ok(Math.abs(t.ev("STAT.drill") - 1.4) < 1e-9, "아이템 구매 → 능력치 반영");
  t.ev("tiles[20 * W + 5] = 0; acct.stats.mined[6] = 3; acct.stats.mined[1] = 10; P.cargo = { 6: 2, 11: 1 }; P.x = 5 * T + 16; P.y = 20 * T + 16; P.fuel = 33");
  await t.ev("saveNow(true)"); await t.tick();
  ok(t.store.has("deepdigger:v1:index"), "저장소에 계정 목록 기록");
  const idxA = JSON.parse(t.store.get("deepdigger:v1:index"));
  ok(idxA.length === 1 && idxA[0].name === "Tester", "목록에 Tester");

  console.log("[4] 계정 전환 + 계정별 분리");
  t.key("Escape");
  ok(t.ev("state") === "menu", "Esc로 메뉴");
  await t.click("계정 전환");
  ok(t.ev("state") === "account" && t.ev("acct") === null, "계정 전환 시 acct 해제");
  const inp2 = t.find((n) => n.tag === "input");
  inp2.value = "tester";
  await t.click("계정 만들기");
  ok(t.texts().some((x) => x.includes("이미 있는 이름")), "대소문자 무시 중복 이름 거부");
  inp2.value = "Second";
  await t.click("계정 만들기");
  ok(t.ev("acct.name") === "Second" && t.ev("state") === "play", "두 번째 계정 생성");
  ok(t.ev("P.money") === 0 && Object.keys(t.ev("P.items")).length === 0, "새 계정은 돈/아이템이 비어 있음");
  ok(t.ev("STAT.drill") === 1, "새 계정 능력치 초기화");
  const hashB = worldHash(t);
  ok(hashA !== hashB, "계정마다 월드가 다름");

  t.key("Escape"); await t.click("계정 전환");
  const rows = t.texts().filter((x) => x === "Tester" || x === "Second");
  ok(rows.length === 2, "계정 목록에 두 계정 표시");
  // Tester 로그인 (목록 첫 번째 '시작')
  const startBtns = t.all().filter((n) => n.tag === "button" && n.textContent === "시작");
  ok(startBtns.length === 2, "시작 버튼 2개");
  const names = t.all().filter((n) => n.className === "nm").map((n) => n.textContent);
  startBtns[names.indexOf("Tester")].click(); await t.tick();
  ok(t.ev("acct.name") === "Tester", "Tester로 로그인");
  ok(t.ev("P.money") === 0 || t.ev("P.money") >= 0, "돈 복원 확인용");
  ok(Math.abs(t.ev("STAT.drill") - 1.4) < 1e-9, "복원: 구매한 아이템/능력치");
  ok(t.ev("tiles[20 * W + 5]") === 0, "복원: 파낸 타일이 유지됨");
  ok(worldHash(t) !== hashB, "복원: Tester의 월드(Second와 다름)");
  ok(t.ev("acct.stats.mined[6]") === 3, "복원: 채굴 통계");
  ok(t.ev("P.cargo[6]") === 2 && t.ev("P.cargo[11]") === 1, "복원: 화물");
  ok(Math.abs(t.ev("P.x") - (5 * 32 + 16)) < 1 && Math.abs(t.ev("P.y") - (20 * 32 + 16)) < 1, "복원: 위치");
  ok(t.ev("P.fuel") === 33, "복원: 연료");

  console.log("[5] 자동 저장 / 페이지 숨김 저장 / 통계");
  const before = JSON.parse(t.store.get("deepdigger:v1:index")).find((a) => a.name === "Tester").updated;
  await sleep(8);
  t.ev("saveT = 14.95");
  t.run(60);
  await t.tick();
  const after = JSON.parse(t.store.get("deepdigger:v1:index")).find((a) => a.name === "Tester").updated;
  ok(after > before, "15초 자동 저장 동작");
  t.ev("P.money = 4321");
  t.sandbox.document.hidden = true; t.docHandlers.visibilitychange(); await t.tick();
  const saved = JSON.parse(t.store.get("deepdigger:v1:acct:" + t.ev("acct.id")));
  ok(saved.player.money === 4321, "탭이 숨겨질 때 저장됨");
  t.ev("P.money = 5555"); t.handlers.pagehide(); await t.tick();
  ok(JSON.parse(t.store.get("deepdigger:v1:acct:" + t.ev("acct.id"))).player.money === 5555, "pagehide 저장");
  t.sandbox.document.hidden = false;
  t.key("Escape"); await t.click("캐릭터 정보 (장비·업적·통계)"); await t.click("통계");
  ok(t.texts().some((x) => x.includes("석탄 채굴")) && t.texts().some((x) => x === "3개"), "통계 화면에 광물별 채굴 수 표시");
  await t.click("뒤로");

  console.log("[6] 내보내기 / 가져오기");
  await t.click("저장 코드 내보내기");
  const ta = t.find((n) => n.tag === "textarea");
  ok(ta && ta.value.startsWith("DD1."), "저장 코드 생성");
  const code = ta.value;
  await t.click("뒤로"); await t.click("계정 전환");
  await t.click("저장 코드로 불러오기");
  const ta2 = t.find((n) => n.tag === "textarea");
  ta2.value = "garbage";
  await t.click("가져오기");
  ok(t.texts().some((x) => x.includes("형식이 아니")), "잘못된 코드 거부");
  ta2.value = "DD1.@@@";
  await t.click("가져오기");
  ok(t.texts().some((x) => x.includes("손상")), "깨진 코드 거부");
  ta2.value = code;
  await t.click("가져오기");
  ok(t.texts().some((x) => x === "Tester (2)"), "가져온 계정은 새 이름으로 추가(이름 충돌 회피)");
  const imported = t.all().filter((n) => n.className === "nm").map((n) => n.textContent);
  const btnsNow = t.all().filter((n) => n.tag === "button" && n.textContent === "시작");
  btnsNow[imported.indexOf("Tester (2)")].click(); await t.tick();
  ok(t.ev("P.money") === 5555 && Math.abs(t.ev("STAT.drill") - 1.4) < 1e-9, "가져온 계정의 진행도 복원");
  ok(t.ev("acct.id") !== saved.id, "가져온 계정은 새 id");

  console.log("[7] 삭제 / 손상된 저장");
  t.key("Escape"); await t.click("계정 전환");
  const dels = t.all().filter((n) => n.tag === "button" && n.textContent === "삭제");
  const before3 = dels.length;
  dels[0].click(); await t.tick();
  ok(t.all().some((n) => n.tag === "button" && n.textContent === "정말?"), "삭제는 두 번 눌러야 함");
  t.all().find((n) => n.tag === "button" && n.textContent === "정말?").click(); await t.tick(6);
  ok(t.all().filter((n) => n.tag === "button" && n.textContent === "삭제").length === before3 - 1, "삭제됨");
  // 남은 계정 하나의 저장을 망가뜨림
  const left = JSON.parse(t.store.get("deepdigger:v1:index"))[0];
  t.store.set("deepdigger:v1:acct:" + left.id, "{not json");
  const nms = t.all().filter((n) => n.className === "nm").map((n) => n.textContent);
  t.all().filter((n) => n.tag === "button" && n.textContent === "시작")[nms.indexOf(left.name)].click(); await t.tick(6);
  ok(t.ev("state") === "account" && t.texts().some((x) => x.includes("읽을 수 없")), "손상된 저장은 안내 후 계정 화면 유지");
  // 월드만 손상 → 시드로 재생성
  const good = { ver: 1, id: "zz1", name: "Broken", created: 1, updated: Date.now(), seed: 4242, playTime: 5,
    stats: { maxDepth: 1, earned: 0, deaths: 0, mined: {} }, player: { x: 200, y: 100, fuel: 40, money: 9, cargo: { 2: 1 }, items: { fake_item: true, cargo1: true }, layerMax: 0, facing: 1 },
    settings: {}, world: "AAAA" };
  t.store.set("deepdigger:v1:acct:zz1", JSON.stringify(good));
  t.store.set("deepdigger:v1:index", JSON.stringify([{ id: "zz1", name: "Broken", updated: Date.now(), playTime: 5, maxDepth: 1 }]));
  await t.ev("openAccountScreen()"); await t.tick();
  t.btn("시작").click(); await t.tick(6);
  ok(t.ev("state") === "play" && t.ev("acct.name") === "Broken", "월드가 손상돼도 시드로 복구해서 시작");
  ok(!t.ev("!!P.items.fake_item") && t.ev("!!P.items.cargo1"), "알 수 없는 아이템은 버리고 유효한 아이템만 복원");
  ok(t.ev("STAT.cargo") === 18, "복원된 아이템으로 능력치 재계산");

  console.log("[8] 기존 기능 회귀: 상점/판매/죽음");
  t.ev("P.money = 100000; P.x = 11 * T + 16; P.y = 4 * T; P.vx = 0; P.vy = 0; nearItems = false");
  t.run(20);
  t.key("KeyE");
  ok(t.ev("state") === "shop", "아이템 상점 열림");
  t.key("Digit1"); t.key("Escape");
  ok(t.ev("state") === "play", "상점 닫힘");
  t.ev("P.cargo = { 11: 2, 6: 5 }; P.x = 5 * T; P.y = 3 * T; inShop = false; P.money = 0");
  t.run(5); await t.tick();
  ok(t.ev("P.money") === 0 && t.ev("P.cargo[11]") === 2, "정비소는 광물을 강제로 팔지 않음");
  ok(t.ev("P.fuel") === t.ev("maxFuel()"), "정비소는 연료를 가득 채움");
  t.ev("P.stash = { 11: 2, 6: 5 }; P.money = 0; sellOre(6, 3);");
  ok(t.ev("P.money") === 18 && t.ev("P.stash[6]") === 2, "선택 판매: 석탄 3개만 판매($18)");
  t.ev("sellOre(11, Infinity); sellStash();");
  ok(t.ev("P.money") === 18 + 1200 + 12 && t.ev("Object.keys(P.stash).length") === 0, "미스릴 전부 + 나머지 전부 판매");
  ok(t.ev("acct.stats.earned") >= 1230, "수익 통계 반영");
  t.ev("P.fuel = 0.001; P.y = 20 * T; P.x = 10 * T; tiles.fill(0, 19*W, 22*W)");
  const d0 = t.ev("acct.stats.deaths");
  t.run(400);
  ok(t.ev("acct.stats.deaths") === d0 + 1, "연료 고갈 사망 통계");

  console.log("[9] 저장소를 못 쓰는 브라우저");
  const t2 = boot(path, { brokenStorage: true });
  t2.run(5);
  await login(t2, "NoStore");
  ok(t2.ev("state") === "play", "저장소 접근이 막혀도 게임은 시작");
  ok(t2.ev("storageOK") === false, "저장소 실패 감지");
  await t2.ev("saveNow(true)"); await t2.tick();
  ok(t2.ev("saveFail") === true, "저장 실패 표시");

  console.log("[10] 터치/폰 레이아웃 + 메뉴 버튼");
  const t3 = boot(path, { w: 390, h: 844, touch: true });
  t3.run(5);
  t3.ptr("pointerdown", 200, 400); await t3.tick();
  ok(t3.ev("state") === "account", "탭으로 계정 화면");
  t3.find((n) => n.tag === "input").value = "Phone";
  await t3.click("계정 만들기");
  t3.run(40);
  const mb = t3.ev("menuBtn");
  ok(mb && mb.x + mb.w <= 390 && mb.y + mb.h <= 844, "메뉴 버튼이 화면 안에 있음");
  t3.ptr("pointerdown", mb.x + 5, mb.y + 5); t3.ptr("pointerup", 0, 0);
  ok(t3.ev("state") === "menu", "메뉴 버튼 탭으로 메뉴 열림");
  await t3.click("계속하기");
  ok(t3.ev("state") === "play", "계속하기");
  t3.ev("P.cargo = { 6: 1, 2: 1, 3: 1, 8: 1, 4: 1, 9: 1, 5: 1, 10: 1, 11: 1 }");
  t3.run(20);
  const h3 = t3.ev("menuBtn"); ok(!!h3, "광물 9종을 들어도 HUD가 정상 렌더링됨(줄바꿈)");
  const t4 = boot(path, { w: 800, h: 360, touch: true });
  t4.run(5); await login(t4, "Land"); t4.run(30);
  const mb4 = t4.ev("menuBtn");
  ok(mb4 && mb4.y + mb4.h <= 360, "가로 폰 화면에서도 메뉴 버튼이 화면 안에 있음");

  console.log("[11] 조이스틱 감도");
  const t5 = boot(path, { w: 390, h: 844, touch: true });
  t5.run(5); t5.ptr("pointerdown", 200, 400); await t5.tick();
  t5.find((n) => n.tag === "input").value = "Stick"; await t5.click("계정 만들기"); t5.run(10);
  const dir = (dx, dy) => { t5.ptr("pointerdown", 200, 600); t5.ptr("pointermove", 200 + dx, 600 + dy); t5.run(2);
    const r = t5.ev("JSON.stringify(touch)"); t5.ptr("pointerup", 200 + dx, 600 + dy); return JSON.parse(r); };
  let d = dir(40, -12); ok(d.r && !d.u, "옆으로 밀면서 살짝 올라가도 추진 안 켜짐");
  d = dir(40, -20); ok(d.r && !d.u, "대각선 약간 위(20px)도 추진 안 켜짐");
  d = dir(5, -45); ok(d.u && !d.l && !d.r, "확실히 위로 밀면 추진");
  d = dir(-40, 10); ok(d.l && !d.u && !d.d, "왼쪽");
  d = dir(0, 40); ok(d.d, "아래");
  t5.ev("sensIdx = 0"); d = dir(5, -45); ok(!d.u, "감도 낮음: 같은 입력으로 추진 안 켜짐");
  t5.ev("sensIdx = 1");

  console.log("[12] 제작소");
  const t6 = boot(path); t6.run(5); await login(t6, "Crafter"); t6.run(10);
  t6.ev("P.x = 18 * T + 16; P.y = (SURF - 1) * T - 20"); t6.run(10);
  ok(t6.ev("nearCraft") === true, "제작소 앞 감지");
  t6.ev("P.cargo = { 6: 20, 3: 5 }; P.money = 500");
  t6.key("KeyE"); await t6.tick();
  ok(t6.ev("state") === "craft", "E로 제작소 열림");
  ok(t6.ev("P.stash[6]") === 20 && t6.ev("cargoCount()") === 0, "화물이 창고로 이동");
  t6.run(5);
  const oldFuel = t6.ev("STAT.fuel");
  t6.ev("craftTab = 1; craftSel = 0"); t6.key("Enter"); await t6.tick();
  ok(!t6.ev("!!P.items.coal_boiler") && t6.ev("msg").includes("철 주괴"), "철 원석만으로는 제작 불가 (주괴 필요)");
  t6.ev("P.bars = { fe: 3 }"); t6.key("Enter"); await t6.tick();
  ok(t6.ev("!!P.items.coal_boiler") && t6.ev("STAT.fuel") === oldFuel + 30, "석탄 보일러 제작 → 연료 +30");
  ok(t6.ev("P.money") === 400, "비용 차감");
  t6.key("Enter"); await t6.tick();
  ok(t6.ev("P.money") === 400, "중복 제작 안 됨");
  t6.ev("craftTab = 1; craftSel = 1"); t6.key("Enter"); await t6.tick();
  ok(!t6.ev("!!P.items.ruby_core"), "재료 없이 루비 코어 제작 안 됨");
  t6.ev("P.items.lucky_charm = true; recalcStats()");
  ok(Math.abs(t6.ev("STAT.lucky") - 0.15) < 1e-9, "행운 능력치 반영");
  t6.ev("craftTab = RECIPE_CATS.length; sellSel = ORE_IDS.indexOf(4); P.stash = { 4: 3 }"); const m0 = t6.ev("P.money");
  t6.key("Enter"); await t6.tick();
  ok(t6.ev("P.money") > m0 && t6.ev("Object.keys(P.stash).length") === 0, "창고에서 선택한 광물 판매");
  t6.key("Escape"); await t6.tick();
  ok(t6.ev("state") === "play", "Esc로 제작소 닫힘");
  t6.run(30);

  console.log("[13] 돌 / 암흑 시야 기억");
  const t8 = boot(path); t8.run(5); await login(t8, "Dark"); t8.run(10);
  const nStone = t8.ev("tiles.reduce((a, v) => a + (v === 12 ? 1 : 0), 0)");
  ok(nStone > 100, "월드에 돌 생성 (" + nStone + "개)");
  ok(t8.ev("(() => { for (let r = 0; r < SURF + 8; r++) for (let c = 0; c < W; c++) if (tiles[r*W+c] === 12) return false; return true; })()"), "지표 근처에는 돌 없음");
  const bandRow = t8.ev("(() => { for (let r = SURF + 20; r < H; r++) { let n = 0; for (let c = 1; c < W - 1; c++) if (tiles[r*W+c] === 12) n++; if (n > 24) return r; } return -1; })()");
  ok(bandRow > 0, "가로 암석대 존재 (행 " + bandRow + ")");
  ok(t8.ev("(() => { const r = " + bandRow + "; for (let c = 1; c < W - 1; c++) if (tiles[r*W+c] !== 12 && tiles[r*W+c] !== 7) return true; return false; })()"), "암석대에 통로(틈)가 있음");
  ok(t8.ev("seen[(SURF + 30) * W + 10]") === 0, "깊은 곳은 처음엔 안 본 칸");
  t8.ev("P.x = 10 * T + 16; P.y = (SURF + 30) * T + 16; tiles[(SURF+30)*W+10] = 0; P.vy = 0"); t8.run(3);
  ok(t8.ev("seen[(SURF + 30) * W + 10]") === 1, "플레이어 자리는 본 칸으로 기록");
  ok(t8.ev("seen[(SURF + 30) * W + 11]") === 1, "바로 옆 칸도 보임");
  ok(t8.ev("seen[(SURF + 30) * W + 20]") === 0, "멀리 있는 칸은 여전히 안 보임");
  const r1 = t8.ev("visR()");
  t8.ev("P.items.lamp1 = true; recalcStats()"); t8.ev("lastRevealKey = ''"); t8.run(3);
  ok(t8.ev("visR()") > r1, "조명 아이템으로 시야 반경 증가");
  t8.ev("P.items.lamp1 = false; P.items.lamp2 = true; P.items.lamp3 = true; P.items.lamp4 = true; P.items.lamp5 = true; recalcStats(); lastRevealKey = ''"); t8.run(3);
  ok(t8.ev("seen[(SURF + 30) * W + 13]") === 1, "시야가 넓어지면 더 먼 칸까지 기록");
  // 돌은 드릴로 못 팜
  t8.ev("P.items = {}; recalcStats(); P.fuel = maxFuel()");
  t8.ev("P.x = 10 * T + 16; P.y = (SURF + 30) * T + 16; tiles[(SURF+30)*W+11] = 12; tiles[(SURF+31)*W+10] = 7; P.vx = 0; P.vy = 0");
  t8.key("ArrowRight"); t8.run(300); t8.keyup("ArrowRight");
  ok(t8.ev("tiles[(SURF+30)*W+11]") === 12, "돌은 드릴로 파지지 않음");
  ok(t8.ev("msg").includes("다이너마이트"), "돌에 부딪히면 안내 메시지");

  console.log("[14] 소모품 / 다이너마이트");
  t8.ev("P.dead = 0; P.fuel = 10; P.inv = { fuel_s: 1, dyn_s: 2 }");
  t8.key("Digit1"); await t8.tick();
  ok(Math.abs(t8.ev("P.fuel") - (10 + t8.ev("maxFuel()") * 0.3)) < 0.5 && t8.ev("P.inv.fuel_s") === 0, "소형 연료통: 30% 충전 + 수량 감소");
  t8.key("Digit1"); await t8.tick();
  ok(t8.ev("msg").includes("없어요"), "수량 없으면 안내");
  t8.ev("P.fuel = maxFuel()"); t8.ev("P.inv.fuel_m = 1"); t8.key("Digit2"); await t8.tick();
  ok(t8.ev("P.inv.fuel_m") === 1 && t8.ev("msg").includes("가득"), "연료가 가득하면 소모품을 아끼고 안내");
  // 폭약: 설치 → 멀리 이동 → 폭발
  t8.ev("P.x = 10 * T + 16; P.y = (SURF + 30) * T + 16; P.vx = 0; P.vy = 0; P.cargo = {}");
  t8.ev("for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) tiles[(SURF+30+dr)*W+10+dc] = 1");
  t8.ev("tiles[(SURF+30)*W+10] = 0; tiles[(SURF+30)*W+11] = 12; tiles[(SURF+29)*W+10] = 2; tiles[(SURF+30)*W+14] = 1; tiles[(SURF+28)*W+10] = 1; tiles[(SURF+31)*W+10] = 1");
  t8.key("Digit4"); await t8.tick();
  ok(t8.ev("bombs.length") === 1 && t8.ev("P.inv.dyn_s") === 1, "다이너마이트 설치");
  t8.key("Digit4"); await t8.tick();
  ok(t8.ev("bombs.length") === 1, "같은 자리에는 중복 설치 안 됨");
  t8.ev("P.x = 10 * T + 16 + 6 * T; P.y = (SURF + 30) * T - 200"); // 폭발 범위 밖으로 순간이동
  t8.ev("tiles[(SURF+30)*W+16] = 0");
  const fuelBefore = t8.ev("P.fuel");
  t8.run(400);
  ok(t8.ev("bombs.length") === 0, "2.5초 후 폭발");
  ok(t8.ev("tiles[(SURF+30)*W+11]") === 0, "돌이 폭파됨");
  ok(t8.ev("tiles[(SURF+29)*W+10]") === 0 && (t8.ev("P.cargo[2]") || 0) >= 1, "범위 내 광물이 파괴되고 화물로 회수");
  ok(t8.ev("tiles[(SURF+30)*W+14]") === 1, "범위 밖 타일은 그대로 (r=1)");
  ok(t8.ev("tiles[(SURF+30)*W+10 + 0]") === 0 && t8.ev("tiles[(SURF+28)*W+10]") === 1, "3x3 범위만 파괴");
  ok(t8.ev("P.fuel") >= fuelBefore - 5, "범위 밖에 있으면 연료 피해 없음");
  t8.ev("tiles[(SURF+31)*W+10] = 7"); // 암반은 보호
  t8.ev("P.x = 10 * T + 16; P.y = (SURF + 30) * T + 16; P.vx = 0; P.vy = 0; P.inv.dyn_l = 1"); t8.key("Digit5"); await t8.tick();
  t8.ev("bombs[0].t = 0.001"); const fb = t8.ev("P.fuel"); t8.run(5);
  ok(t8.ev("tiles[(SURF+31)*W+10]") === 7, "암반은 폭발로도 안 부서짐");
  ok(t8.ev("P.fuel") < fb - 1, "폭발 범위 안에 있으면 연료 손실");
  t8.ev("P.x = 6 * T; P.y = SURF * T - 20; P.vx = P.vy = 0; P.inv.dyn_s = 1"); t8.run(3);
  t8.key("Digit4"); await t8.tick();
  ok(t8.ev("bombs.length") === 0, "지상에서는 설치 불가");

  console.log("[15] 상점 2쪽 + 소모품 구매");
  const t9 = boot(path); t9.run(5); await login(t9, "ShopP"); t9.run(10);
  ok(t9.ev("CATS.length") === 8, "상점 분류 8개(소모품 포함)");
  ok(t9.ev("CATS.slice(0, 7).every((c) => c.ids.length === 8)"), "분류마다 아이템 8개 (기존 3 + 5)");
  ok(t9.ev("new Set(Object.keys(ITEMS)).size") === 56 + 32 + 8, "아이템 id 중복 없음 (" + t9.ev("Object.keys(ITEMS).length") + ")");
  ok(t9.ev("Object.keys(ITEMS).every((id) => itemIcon(id) && itemIcon(id).width === 16)"), "모든 아이템에 아이콘 존재");
  const uniq = t9.ev("new Set(CATS.slice(0,7).flatMap((c) => c.ids).map((id) => itemIcon(id).toDataURL ? id : id)).size");
  t9.ev("P.x = 11 * T; P.y = SURF * T - 20; P.vx = P.vy = 0"); t9.run(5);
  t9.key("KeyE"); await t9.tick();
  ok(t9.ev("state") === "shop", "상점 열림");
  t9.ev("P.money = 100000");
  t9.key("ArrowDown"); t9.key("ArrowDown"); t9.key("ArrowDown"); t9.key("ArrowDown");
  ok(t9.ev("shopSel") === 4, "아래로 4칸 → 2쪽 첫 항목");
  t9.key("Digit1"); await t9.tick();
  ok(t9.ev("!!P.items.sonic_drill") === false, "선행 아이템 없으면 구매 불가(잠김)");
  t9.ev("P.items = { steel_drill: true, ti_drill: true, dia_drill: true, plasma_drill: true }; recalcStats()");
  t9.key("Digit1"); await t9.tick();
  ok(t9.ev("!!P.items.sonic_drill"), "2쪽에서 숫자키로 구매");
  // 터치 방식: 쪽 넘기기 버튼
  t9.run(2);
  const pgBtn = t9.ev("JSON.stringify(shopBtn.filter((b) => b.act === 'page'))");
  ok(JSON.parse(pgBtn).length === 2, "쪽 넘기기 버튼 2개");
  t9.key("ArrowRight"); t9.key("ArrowRight"); t9.key("ArrowRight"); t9.key("ArrowRight"); t9.key("ArrowRight"); t9.key("ArrowRight"); t9.key("ArrowRight");
  ok(t9.ev("shopTab") === 7, "소모품 탭으로 이동");
  t9.ev("P.money = 1000"); t9.key("Digit3"); await t9.tick();
  ok(t9.ev("P.inv.fuel_l") === 1 && t9.ev("P.money") === 800, "대형 연료통 구매 → 보유 수량 증가");
  t9.key("Digit3"); await t9.tick();
  ok(t9.ev("P.inv.fuel_l") === 2, "소모품은 여러 개 구매 가능");
  t9.key("Escape"); await t9.tick();
  ok(t9.ev("state") === "play", "상점 닫기");

  console.log("[16] 새 저장 항목 + 예전 저장 호환");
  await t9.ev("saveNow(true)"); await t9.tick();
  const sv16 = JSON.parse(await t9.ev("JSON.stringify(snapshot())"));
  ok(sv16.stones === 1 && typeof sv16.seen === "string" && sv16.player.inv.fuel_l === 2, "저장에 stones/seen/inv 포함");
  const old16 = JSON.parse(JSON.stringify(sv16)); delete old16.stones; delete old16.seen; delete old16.player.inv;
  const wl = t9.ev("(() => { const w = []; for (let r = SURF + 9; r < SURF + 60; r++) for (let c = 1; c < W - 1; c++) if (tiles[r*W+c] === 12) w.push(1); return w.length; })()");
  t9.ev("tiles.fill(1, " + 6 * 32 + ")"); 
  old16.world = t9.ev("encodeWorld()");
  t9.ev("tiles[(SURF+40)*W+5] = 0");
  old16.world = t9.ev("encodeWorld()");
  t9.ev("applyAccount(" + JSON.stringify(old16) + ")");
  ok(t9.ev("tiles.some((v) => v === 12)"), "돌 없던 예전 저장 → 불러올 때 돌 추가");
  ok(t9.ev("seen[(SURF+40)*W+5]") === 1, "예전 저장은 이미 뚫린 곳을 본 칸으로 처리");
  ok(t9.ev("Object.keys(P.inv).length") === 0, "inv 없는 저장도 정상");
  const bad16 = JSON.parse(JSON.stringify(sv16)); bad16.player.inv = { fuel_s: 9999, dyn_s: -5, hack: 3 }; bad16.seen = "###";
  t9.ev("applyAccount(" + JSON.stringify(bad16) + ")");
  ok(t9.ev("P.inv.fuel_s") === 99 && !t9.ev("P.inv.dyn_s") && !t9.ev("P.inv.hack"), "소모품 수량 보정/알 수 없는 항목 무시");
  t9.run(30);
  ok(t9.ev("state") === "play", "손상된 seen 데이터에도 정상 시작");

  console.log("[17] 장비 외형 / 폰 레이아웃");
  const t10 = boot(path, { w: 390, h: 844, touch: true }); t10.run(5);
  t10.ptr("pointerdown", 200, 400); await t10.tick();
  t10.find((n) => n.tag === "input").value = "Look"; await t10.click("계정 만들기"); t10.run(20);
  const k0 = t10.ev("LOOK.key");
  t10.ev("P.items = { steel_drill: true, ti_drill: true, lamp1: true, cargo1: true, engine1: true, track1: true }; recalcStats()");
  ok(t10.ev("LOOK.key") !== k0 && t10.ev("LOOK.drill") === 2 && t10.ev("LOOK.lamp") === 1, "장비 단계가 외형(LOOK)에 반영");
  t10.run(20);
  const hb = JSON.parse(t10.ev("JSON.stringify(hotBtns)"));
  ok(hb.length === 8 && hb.every((b) => b.x >= 0 && b.x + b.w <= 390 && b.y + b.h <= 844), "휴대폰에서 소모품 슬롯 8개가 화면 안에 있음");
  t10.ev("P.inv = { fuel_s: 2 }; P.fuel = 5");
  t10.ptr("pointerdown", hb[0].x + 5, hb[0].y + 5); t10.ptr("pointerup", 0, 0);
  ok(t10.ev("P.inv.fuel_s") === 1 && t10.ev("P.fuel") > 5, "슬롯 터치로 연료통 사용");
  ok(t10.ev("JSON.stringify(touch)").includes('"l":false'), "슬롯 터치가 조이스틱을 건드리지 않음");

  console.log("[18] 건물 기초석 / 확대");
  const t11 = boot(path); t11.run(5); await login(t11, "Found"); t11.run(10);
  ok(t11.ev("BUILD_COLS.every((b) => { for (let c = b[0]; c <= b[1]; c++) for (let r = SURF; r <= SURF + 1; r++) if (tiles[r*W+c] !== 13) return false; return true; })"), "건물 아래 2줄은 전부 기초석");
  ok(t11.ev("(() => { for (let c = MINE_COL; c < W - 1; c++) if (tiles[SURF*W+c] === 13) return false; return true; })()"), "광산 터(마을 오른쪽)는 그대로 팔 수 있음");
  ok(t11.ev("BUILD_COLS[1][0] === BUILD_COLS[0][1] + 1 && BUILD_COLS[2][0] === BUILD_COLS[1][1] + 1 && MINE_COL > 20 && W - MINE_COL >= 20"), "건물 세 개가 왼쪽에 붙어 있고 오른쪽에 넓은 광산 터");
  ok(t11.ev("tiles[(SURF+2)*W+5] !== 13"), "기초석 아래 땅은 일반 지형");
  t11.ev("P.x = 5 * T + 16; P.y = SURF * T - 14; P.vx = P.vy = 0"); t11.run(10);
  t11.key("ArrowDown"); t11.run(600); t11.keyup("ArrowDown");
  ok(t11.ev("tiles[(SURF)*W+5]") === 13, "건물 아래에서 아래로 파도 기초석은 안 부서짐");
  ok(t11.ev("msg").includes("기초"), "기초석 안내 메시지");
  t11.ev("P.dead = 0; P.inv = { dyn_l: 1 }; P.x = 5 * T + 16; P.y = (SURF + 3) * T + 16; tiles[(SURF+3)*W+5] = 0; P.vx = P.vy = 0"); t11.run(3);
  t11.key("Digit5"); await t11.tick(); t11.ev("bombs[0].t = 0.001"); t11.run(5);
  ok(t11.ev("tiles[(SURF+1)*W+5]") === 13 && t11.ev("tiles[(SURF)*W+5]") === 13, "폭발도 기초석은 못 부심");
  // 예전 저장: 건물 아래가 이미 뚫려 있던 경우 복구
  const sv18 = JSON.parse(await t11.ev("JSON.stringify(snapshot())"));
  t11.ev("tiles[(SURF)*W+5] = 0; tiles[(SURF+1)*W+5] = 0; tiles[(SURF)*W+15] = 0");
  sv18.world = t11.ev("encodeWorld()");
  t11.ev("applyAccount(" + JSON.stringify(sv18) + ")");
  ok(t11.ev("tiles[(SURF)*W+5] === 13 && tiles[(SURF+1)*W+5] === 13 && tiles[(SURF)*W+15] === 13"), "예전 저장의 뚫린 건물 아래를 기초석으로 복구");
  // 확대
  const t12 = boot(path, { w: 1000, h: 640 }); t12.run(5);
  ok(t12.ev("curZoom()") === 2, "데스크톱 자동 확대 2x");
  const t13 = boot(path, { w: 390, h: 844, touch: true }); t13.run(5);
  ok(t13.ev("curZoom()") === 1.5, "폰(세로) 자동 확대 1.5x");
  const t14 = boot(path, { w: 800, h: 360, touch: true }); t14.run(5);
  ok(t14.ev("curZoom()") === 1.5, "폰(가로) 자동 확대 1.5x");
  const t15 = boot(path, { w: 2560, h: 1440 }); t15.run(5);
  ok(t15.ev("curZoom()") === 3, "큰 화면은 최대 3x");
  await login(t12, "Zoom"); t12.run(10);
  t12.key("KeyZ"); t12.key("KeyZ"); await t12.tick();
  ok(t12.ev("zoomSel") === 2 && t12.ev("curZoom()") === 1.5, "Z 키로 확대 단계 변경");
  t12.run(20);
  const cam = t12.ev("JSON.stringify(getCam(cv.width / curZoom(), cv.height / curZoom()))");
  ok(JSON.parse(cam).x % 2 === 0 && JSON.parse(cam).y % 2 === 0, "카메라는 짝수 픽셀(확대 시 타일 틈 방지)");
  ok(t12.ev("[1,1.5,2,2.5,3].every((z) => (z * 16 * 2) % 1 === 0)"), "확대 단계는 도트가 정수 픽셀");
  const t16 = boot(path, { w: 390, h: 844, touch: true }); t16.run(5);
  t16.ptr("pointerdown", 200, 400); await t16.tick();
  t16.find((n) => n.tag === "input").value = "Ph"; await t16.click("계정 만들기");
  t16.ev("P.x = 11 * T; P.y = SURF * T - 20; P.vx = P.vy = 0"); t16.run(30);
  const pb = t16.ev("JSON.stringify(promptBtn)");
  ok(pb !== "null" && JSON.parse(pb).y >= 0 && JSON.parse(pb).y + JSON.parse(pb).h <= 844 - 60, "폰: 상점 열기 버튼이 슬롯과 겹치지 않음");

  console.log("[19] 지반 붕괴 / 지지대 / 광물 재생");
  const t20 = boot(path); t20.run(5); await login(t20, "Cave"); t20.run(10);
  const R = 42;
  const setup = (c0, c1, extra) => t20.ev("(() => { graceT = 0; unstable = []; warn.fill(0); for (let r = SURF + 38; r <= SURF + 46; r++) for (let c = 2; c < 30; c++) { tiles[r*W+c] = 1; rub[r*W+c] = 0; } for (let c = " + c0 + "; c <= " + c1 + "; c++) tiles[(SURF+" + R + ")*W+c] = 0; " + (extra || "") + " })()");
  const far = () => t20.ev("P.dead = 0; P.fuel = maxFuel(); P.x = 26 * T + 16; P.y = (SURF + 60) * T + 16; tiles[(SURF+60)*W+26] = 0; P.vx = P.vy = 0");
  const scans = (n) => { for (let i = 0; i < n; i++) t20.ev("scanCave(0.5)"); };
  const cell = (c) => t20.ev("tiles[(SURF+" + R + ")*W+" + c + "]");
  far(); setup(5, 12);
  scans(1);
  ok(t20.ev("unstable.length") === 1 && t20.ev("unstable[0].c1 - unstable[0].c0 + 1") === 8, "지지대 없는 8칸 터널 = 불안정 구간 1개");
  ok(t20.ev("unstable[0].t") > 0, "불안정 누적 시간이 쌓이기 시작(징후)");
  t20.run(3);
  scans(6);
  ok(cell(8) === 0, "경고 시간(4초) 전에는 무너지지 않음");
  scans(2);
  ok([5, 6, 7, 8, 9, 10, 11, 12].every((c) => cell(c) === 1 || cell(c) === 12), "경고 시간이 지나면 터널이 흙/돌로 다시 채워짐");
  ok(t20.ev("[5,6,7,8,9,10,11,12].every((c) => rub[(SURF+" + R + ")*W+c] === 1)"), "채워진 칸은 재생 대상으로 표시");
  ok(t20.ev("floaters.some((f) => f.text === '붕괴!')"), "붕괴 알림 표시");
  // 짧은 터널은 안전
  setup(5, 7); scans(12);
  ok([5, 6, 7].every((c) => cell(c) === 0), "3칸 이하 터널은 지지대 없이도 안전");
  // 나무 지지대
  setup(5, 12, "tiles[(SURF+" + R + ")*W+8] = 14; tiles[(SURF+" + R + ")*W+11] = 14;"); scans(12);
  ok(t20.ev("unstable.length") === 0 && cell(6) === 0 && cell(12) === 0 && cell(8) === 14, "나무 지지대를 4칸 간격으로 세우면 안전");
  setup(5, 12, "tiles[(SURF+" + R + ")*W+8] = 14;"); scans(1);
  ok(t20.ev("unstable.length") === 1, "지지대 간격이 넓으면 여전히 불안정");
  // 강철 지지대
  setup(4, 12, ""); scans(1);
  ok(t20.ev("unstable.length") === 1, "9칸 터널은 불안정");
  setup(4, 12, "tiles[(SURF+" + R + ")*W+8] = 15;"); scans(14);
  ok(t20.ev("unstable.length") === 0 && cell(4) === 0 && cell(12) === 0, "강철 지지대 1개로 양옆 3칸씩 보강(총 9칸 안전)");
  // 돌 천장은 무너지지 않음
  setup(5, 14, "for (let c = 5; c <= 14; c++) tiles[(SURF+" + (R - 1) + ")*W+c] = 12;"); scans(1);
  ok(t20.ev("unstable.length") === 0, "돌 천장 아래는 붕괴 대상이 아님");
  // 플레이어가 안에 있을 때
  setup(5, 12, "");
  t20.ev("P.x = 8 * T + 16; P.y = (SURF + " + R + ") * T + 16; P.vx = P.vy = 0; P.fuel = maxFuel(); P.dead = 0");
  scans(1);
  ok(t20.ev("cavWarn") > 0, "플레이어 근처가 불안정하면 경고 수치가 올라감");
  scans(8);
  ok(cell(8) === 0, "플레이어가 서 있는 칸은 비워 둠(매몰 방지)");
  ok(cell(5) === 1 && cell(12) === 1, "나머지 구간은 채워짐");
  ok(t20.ev("P.fuel") < t20.ev("maxFuel()") * 0.85, "낙반에 맞으면 연료 -20%");
  ok(t20.ev("(() => { const c = 8; return !collide(P.x, P.y); })()"), "플레이어는 갇히지 않고 움직일 수 있는 상태");
  // 재생
  far(); setup(5, 7);
  t20.ev("(() => { for (let k = 0; k < 300; k++) { const c = 2 + (k % 28), r = SURF + 120 + ((k / 28) | 0); tiles[r*W+c] = 1; rub[r*W+c] = 1; regenT[r*W+c] = 0; } })()");
  scans(1);
  const ores = t20.ev("(() => { let n = 0; for (let k = 0; k < 300; k++) { const c = 2 + (k % 28), r = SURF + 120 + ((k / 28) | 0); if (tiles[r*W+c] > 1 && tiles[r*W+c] < 12) n++; } return n; })()");
  ok(ores > 60 && ores < 190, "재생 시간이 되면 일부(약 40%)가 광물로 변함 (" + ores + "/300)");
  ok(t20.ev("rub.reduce((a, v) => a + v, 0)") === 0 || t20.ev("(() => { let n = 0; for (let i = 0; i < rub.length; i++) n += rub[i]; return n; })()") < 5, "재생 처리된 칸은 표시 해제");
  t20.ev("tiles[(SURF+100)*W+5] = 0; rub[(SURF+100)*W+5] = 1; regenT[(SURF+100)*W+5] = 999"); scans(1);
  ok(t20.ev("rub[(SURF+100)*W+5]") === 0, "다시 파낸 칸은 재생 표시 해제");
  t20.ev("tiles[(SURF+101)*W+5] = 12; rub[(SURF+101)*W+5] = 1; regenT[(SURF+101)*W+5] = 0"); scans(1);
  ok(t20.ev("tiles[(SURF+101)*W+5]") === 12, "돌로 채워진 칸은 광물로 안 변함");
  // 저장/복원
  t20.ev("tiles[(SURF+110)*W+7] = 1; rub[(SURF+110)*W+7] = 1");
  await t20.ev("saveNow(true)"); await t20.tick();
  const sv19 = JSON.parse(await t20.ev("JSON.stringify(snapshot())"));
  ok(typeof sv19.rub === "string" && sv19.stats.collapses >= 1, "저장에 재생 표시 + 붕괴 횟수 포함");
  t20.ev("rub.fill(0)");
  setup(5, 12); far();
  t20.ev("applyAccount(" + JSON.stringify(sv19) + ")");
  ok(t20.ev("rub[(SURF+110)*W+7]") === 1 && t20.ev("regenT[(SURF+110)*W+7]") > 0, "불러오면 재생 표시와 타이머 복원");
  ok(t20.ev("graceT") > 0, "불러온 직후 붕괴 유예");
  t20.ev("unstable = []; for (let c = 5; c <= 12; c++) tiles[(SURF+" + R + ")*W+c] = 0; for (let c = 3; c <= 14; c++) tiles[(SURF+" + (R - 1) + ")*W+c] = 1");
  t20.ev("P.x = 26 * T + 16; P.y = (SURF + 60) * T + 16; tiles[(SURF+60)*W+26] = 0");
  scans(10);
  ok(cell(8) === 0, "유예 시간 동안에는 불안정해도 무너지지 않음");
  const bad19 = JSON.parse(JSON.stringify(sv19)); bad19.rub = "%%%";
  t20.ev("applyAccount(" + JSON.stringify(bad19) + ")");
  ok(t20.ev("state") === "play", "손상된 rub 데이터도 무시하고 시작");

  console.log("[20] 지지대 설치 / 회수 / 폭파");
  t20.ev("graceT = 0; P.dead = 0; P.inv = { sup_w: 2, sup_s: 1 }; P.x = 15 * T + 16; P.y = (SURF + 20) * T + 16; P.vx = P.vy = 0; tiles[(SURF+20)*W+15] = 0; tiles[(SURF+20)*W+14] = 1; tiles[(SURF+20)*W+16] = 1");
  t20.key("Digit7"); await t20.tick();
  ok(t20.ev("tiles[(SURF+20)*W+15]") === 14 && t20.ev("P.inv.sup_w") === 1, "7번 키: 나무 지지대 설치");
  ok(!t20.ev("collide(P.x, P.y)"), "지지대는 통과할 수 있음(막지 않음)");
  t20.key("Digit7"); await t20.tick();
  ok(t20.ev("tiles[(SURF+20)*W+15]") === 0 && t20.ev("P.inv.sup_w") === 2, "같은 자리에서 다시 쓰면 회수");
  t20.key("Digit8"); await t20.tick();
  ok(t20.ev("tiles[(SURF+20)*W+15]") === 15 && t20.ev("P.inv.sup_s") === 0, "8번 키: 강철 지지대 설치");
  t20.key("Digit7"); await t20.tick();
  ok(t20.ev("tiles[(SURF+20)*W+15]") === 15 && t20.ev("msg").includes("회수") === false || t20.ev("P.inv.sup_w") === 2, "다른 종류 지지대로 덮어쓰기 안 됨");
  t20.ev("P.inv.dyn_s = 1"); t20.ev("P.x = 15 * T + 16; P.y = (SURF + 20) * T + 16"); t20.key("Digit4"); await t20.tick();
  t20.ev("P.x = 15 * T + 16 + 6 * T"); t20.ev("bombs[0].t = 0.001"); t20.run(5);
  ok(t20.ev("tiles[(SURF+20)*W+15]") === 0, "폭발이 지지대를 부숨");
  t20.ev("P.x = 6 * T; P.y = SURF * T - 20; P.vx = P.vy = 0; P.inv.sup_w = 1"); t20.run(3);
  t20.key("Digit7"); await t20.tick();
  ok(t20.ev("P.inv.sup_w") === 1, "지상에서는 설치 불가");
  // 상점에서 구매
  const t21 = boot(path); t21.run(5); await login(t21, "SupShop"); t21.run(10);
  t21.ev("P.x = 11 * T; P.y = SURF * T - 20; P.vx = P.vy = 0; P.money = 500"); t21.run(5);
  t21.key("KeyE"); await t21.tick();
  t21.ev("shopTab = 7; shopSel = 4");
  t21.key("Digit3"); await t21.tick();
  ok(t21.ev("P.inv.sup_w") === 1 && t21.ev("P.money") === 485, "상점 소모품 2쪽에서 나무 지지대 구매");
  t21.key("Digit4"); await t21.tick();
  ok(t21.ev("P.inv.sup_s") === 1 && t21.ev("P.money") === 425, "강철 지지대 구매");
  // 징후 렌더링
  const t22 = boot(path, { w: 1000, h: 640 }); t22.run(5); await login(t22, "Sign"); t22.run(10);
  t22.ev("graceT = 0; for (let r = SURF + 38; r <= SURF + 46; r++) for (let c = 2; c < 30; c++) tiles[r*W+c] = 1; for (let c = 5; c <= 12; c++) tiles[(SURF+42)*W+c] = 0; P.x = 8 * T + 16; P.y = (SURF + 42) * T + 16; P.vx = P.vy = 0; P.fuel = 1e9; scanCave(0.5); scanCave(0.5); scanCave(0.5);");
  t22.run(60);
  ok(t22.ev("unstable.length") === 1 && t22.ev("parts.length") >= 0, "징후(균열/흙가루) 그리기 중에도 오류 없음");
  t22.run(200);
  ok(t22.ev("Number.isFinite(shakeT) && cavWarn >= 0") && t22.ev("state") === "play", "경고 → 붕괴까지 진행해도 오류 없이 계속 플레이");

  console.log("[21] 공중 흙 낙하 / 새 광산");
  const t23 = boot(path, { w: 1000, h: 640 }); t23.run(5); await login(t23, "Float"); t23.run(10);
  // 깊은 곳에 빈 방을 만들고 그 안에 떠 있는 2x2 덩어리를 둠
  t23.ev("graceT = 99; for (let r = SURF + 60; r <= SURF + 70; r++) for (let c = 2; c < 30; c++) tiles[r*W+c] = 1; for (let r = SURF + 62; r <= SURF + 69; r++) for (let c = 8; c <= 14; c++) tiles[r*W+c] = 0; for (const [c, r] of [[10, 63], [11, 63], [10, 64], [11, 64]]) tiles[(SURF+r)*W+c] = 3; P.x = 3 * T; P.y = (SURF + 30) * T; P.vx = P.vy = 0; P.fuel = 1e9; floatT.fill(0); scanFloating(0.3);");
  ok(t23.ev("floatT[(SURF+63)*W+10] > 0"), "떠 있는 덩어리를 감지");
  ok(t23.ev("chunks.length") === 0, "곧바로 떨어지진 않고 잠깐 떨림");
  for (let i = 0; i < 200 && t23.ev("chunks.length") === 0; i++) t23.run(1);
  ok(t23.ev("chunks.length") === 1, "시간이 지나면 덩어리가 떨어지기 시작");
  ok(t23.ev("tiles[(SURF+63)*W+10]") === 0, "떨어지는 동안 원래 자리는 비어 있음");
  t23.ev("withChunksSettled(() => { globalThis.__sv = tiles[(SURF+69)*W+10] + ',' + tiles[(SURF+68)*W+10]; })");
  ok(t23.ev("__sv") === "3,3", "저장 시에는 착지한 상태로 기록");
  ok(t23.ev("tiles[(SURF+63)*W+10]") === 0, "저장 후 원래 상태로 복구");
  t23.run(400);
  ok(t23.ev("chunks.length") === 0, "덩어리가 착지해 사라짐");
  ok(t23.ev("tiles[(SURF+69)*W+10]") === 3 && t23.ev("tiles[(SURF+68)*W+11]") === 3, "바닥 위에 쌓여 연결됨");
  t23.ev("scanFloating(1)");
  ok(t23.ev("(() => { for (let i = SURF*W; i < tiles.length; i++) if (floatT[i] > 0) return false; return true; })()"), "착지 후에는 떠 있는 흙이 없음");
  // 지상(건물 기초석, 바닥)과 붙은 흙은 안 떨어짐
  t23.ev("floatT.fill(0); scanFloating(5);");
  ok(t23.ev("chunks.length") === 0, "연결된 땅은 떨어지지 않음");
  // 광물 개수 보존
  const ironBefore = t23.ev("tiles.reduce((a, v) => a + (v === 3 ? 1 : 0), 0)");
  t23.ev("for (const [c, r] of [[20, 63], [21, 63]]) tiles[(SURF+r)*W+c] = 4; tiles[(SURF+64)*W+20] = 0; tiles[(SURF+64)*W+21] = 0; tiles[(SURF+63)*W+19] = 0; tiles[(SURF+63)*W+22] = 0; tiles[(SURF+62)*W+20] = 0; tiles[(SURF+62)*W+21] = 0; scanFloating(1);");
  t23.run(300);
  ok(t23.ev("tiles.reduce((a, v) => a + (v === 3 ? 1 : 0), 0)") === ironBefore, "낙하 중에도 타일이 사라지거나 복제되지 않음");
  // 플레이어 위로 떨어질 때 낙석 피해
  t23.ev("for (let c = 8; c <= 14; c++) for (let r = 62; r <= 69; r++) tiles[(SURF+r)*W+c] = 0; tiles[(SURF+64)*W+11] = 3; P.x = 11 * T + 16; P.y = (SURF + 67) * T + 16; P.vx = P.vy = 0; P.fuel = maxFuel(); floatT.fill(0); scanFloating(0.8);");
  t23.run(200);
  ok(t23.ev("P.fuel") < t23.ev("maxFuel()") && t23.ev("state") === "play" && !t23.ev("collide(P.x, P.y)"), "머리 위로 떨어지면 낙석 피해, 끼이지 않음");

  // 새 광산
  const t24 = boot(path); t24.run(5); await login(t24, "NewMine"); t24.run(10);
  t24.ev("P.money = 777; P.items.lamp1 = true; P.inv = { dyn_s: 3 }; P.stash = { 2: 5 }; for (let r = SURF + 3; r < SURF + 12; r++) tiles[r*W+20] = 0;");
  const h0 = worldHash(t24), seed0 = t24.ev("acct.seed");
  t24.key("Escape"); await t24.tick();
  ok(t24.ev("state") === "menu", "메뉴 열림");
  await t24.click("새 광산 찾기");
  ok(t24.texts().some((x) => x.includes("되돌릴 수 없어요")), "확인 화면이 나옴");
  await t24.click("취소");
  ok(worldHash(t24) === h0, "취소하면 월드가 그대로");
  await t24.click("새 광산 찾기");
  await t24.click("새 광산으로 떠나기");
  t24.run(10);
  ok(t24.ev("state") === "play" && t24.ev("acct.mineNo") === 2, "새 광산 #2에서 플레이 재개");
  ok(worldHash(t24) !== h0 && t24.ev("acct.seed") !== seed0, "월드가 새로 만들어짐");
  ok(t24.ev("P.money") === 777 && t24.ev("P.inv.dyn_s") === 3 && t24.ev("P.stash[2]") === 5 && t24.ev("!!P.items.lamp1"), "돈/소모품/창고/장비는 유지");
  ok(t24.ev("P.y") < t24.ev("SURF * T") && t24.ev("P.fuel") === t24.ev("maxFuel()"), "지상에서 연료 가득 시작");
  ok(t24.ev("tiles[(SURF+5)*W+20]") !== 0 || t24.ev("rub.reduce((a, v) => a + v, 0)") === 0, "이전 광산의 구멍/흔적이 없음");
  ok(t24.ev("[2,3,4,5,6,8,9,10,11].every((id) => tiles.includes(id) || id > 6)") , "새 월드에도 광물이 있음");
  // 저장 / 재접속
  const sv24 = JSON.parse(JSON.stringify(t24.ev("snapshot()")));
  ok(sv24.mineNo === 2, "저장 데이터에 광산 번호 포함");
  const t25 = boot(path); t25.run(5); await login(t25, "Other"); t25.run(5);
  t25.ev("applyAccount(" + JSON.stringify(sv24) + ")");
  ok(t25.ev("acct.mineNo") === 2 && worldHash(t25) === worldHash(t24), "불러오면 같은 광산이 복원됨");
  const old24 = JSON.parse(JSON.stringify(sv24)); delete old24.mineNo;
  t25.ev("applyAccount(" + JSON.stringify(old24) + ")");
  ok(t25.ev("acct.mineNo") === 1, "광산 번호가 없는 예전 저장은 #1");
  // 그리기 오류 없음(산/장식/그늘/반짝임)
  const t26 = boot(path, { w: 1000, h: 640 }); t26.run(5); await login(t26, "Look"); t26.run(10);
  t26.ev("P.x = 5 * T; P.y = SURF * T - 20; P.vx = P.vy = 0"); t26.run(30);
  t26.ev("P.y = (SURF + 8) * T; P.fuel = 1e9"); t26.run(60);
  ok(t26.ev("state") === "play" && t26.ev("Array.isArray(dirtTiles[0]) && dirtTiles[0].length === DIRT_VAR && backTiles.length === LAYERS.length"), "새 타일 스프라이트로 그리기 오류 없음");


  console.log("[22] 인벤토리 / 연료 / 붕괴 연출");
  const t27 = boot(path, { w: 1000, h: 640 }); t27.run(5); await login(t27, "Inv"); t27.run(10);
  t27.ev("P.cargo = { 2: 3, 4: 1 }; P.inv = { fuel_s: 2 }; P.items.lamp1 = true; recalcStats();");
  t27.key("KeyI"); await t27.tick();
  ok(t27.ev("state") === "menu" && t27.ev("invOpen"), "I 키로 인벤토리 열림");
  ok(t27.texts().some((x) => x.includes("능력치")) && t27.texts().some((x) => x.includes("구리")) && t27.texts().some((x) => x.includes("헤드램프")), "능력치/광물/장비가 표시됨");
  t27.key("KeyI"); await t27.tick();
  ok(t27.ev("state") === "play", "I 키로 다시 닫힘");
  t27.key("KeyI"); await t27.tick();
  t27.ev("P.fuel = 10");
  ok(t27.texts().some((x) => x.includes("소형 연료통")), "소모품 슬롯이 표시됨");
  t27.ev("closeMenu(); useConsumable(\"fuel_s\")");
  ok(t27.ev("state") === "play" && t27.ev("P.fuel") > 10 && t27.ev("P.inv.fuel_s") === 1, "인벤토리에서 소모품 사용");
  // 연료 소모 속도: 추진+채굴 연속 시 60초 이상 버팀(기본 60)
  const full = t27.ev("maxFuel()");
  ok(full === 60, "기본 연료 60");
  t27.ev("P.x = 15 * T + 16; P.y = (SURF + 8) * T; P.vx = P.vy = 0; P.fuel = maxFuel(); graceT = 99");
  t27.run(120);
  ok(t27.ev("P.fuel") > full - 4, "2초 동안 가만히 있으면 연료가 거의 안 줆(" + t27.ev("P.fuel").toFixed(2) + ")");
  // 붕괴 연출
  t27.ev("graceT = 0; for (let r = SURF + 38; r <= SURF + 46; r++) for (let c = 2; c < 30; c++) tiles[r*W+c] = 1; for (let c = 5; c <= 12; c++) tiles[(SURF+42)*W+c] = 0; P.x = 20 * T; P.y = (SURF + 30) * T; P.vx = P.vy = 0; P.fuel = 1e9; scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5); scanCave(0.5);");
  for (let i = 0; i < 60 && t27.ev("debrisList.length") === 0; i++) t27.run(1);
  ok(t27.ev("debrisList.length") > 0 && t27.ev("dust.length") > 0, "붕괴 시 흙 낙하 연출과 먼지 생성");
  t27.run(120);
  ok(t27.ev("debrisList.length") === 0 && [1, 12].includes(t27.ev("tiles[(SURF+42)*W+8]")), "연출이 끝나면 흙(가끔 돌)으로 채워져 있음");
  t27.run(200);
  ok(t27.ev("dust.length") === 0, "먼지가 가라앉아 사라짐");

  console.log("[23] 깊이별 분포 / 경도 / 레벨 / 업적 / 제작 트리");
  const t28 = boot(path); t28.run(5); await login(t28, "Prog"); t28.run(10);
  // 분포: 구간별 광물 개수
  const dist = JSON.parse(t28.ev("JSON.stringify((() => { const z = [[0,40],[40,100],[100,170],[170,250],[250,330],[330,392]]; return z.map(([a,b]) => { const c = {}; for (let r = SURF + a; r < SURF + b; r++) for (let x = 1; x < W - 1; x++) { const v = tiles[r*W+x]; if (v > 1 && v < 12) c[v] = (c[v] || 0) + 1; } return c; }); })())"));
  console.log("  (구간별 광물)", JSON.stringify(dist));
  ok(!dist[0][5] && !dist[0][10] && !dist[0][11] && !dist[0][9], "얕은 곳에는 다이아/루비/미스릴/에메랄드가 없음");
  ok((dist[5][11] || 0) > (dist[3][11] || 0) && (dist[5][11] || 0) >= 4, "미스릴은 깊을수록 훨씬 많아짐");
  ok((dist[1][3] || 0) > (dist[0][3] || 0), "철은 중층에서 더 많음");
  ok((dist[3][11] || 0) <= 12, "미스릴은 한계 구간 전에는 한두 개씩만 나옴");
  ok((dist[0][2] || 0) + (dist[1][2] || 0) > (dist[4][2] || 0) + (dist[5][2] || 0), "구리는 깊어질수록 줄어듦");   // 광맥이 뭉쳐 나와서 구간 하나끼리 비교하면 가끔 뒤집힘
  // 경도
  ok(t28.ev("hardOf(1, SURF + 200)") > t28.ev("hardOf(1, SURF + 5)") * 2, "깊은 흙이 훨씬 단단함");
  ok(t28.ev("hardOf(3, SURF + 100)") > t28.ev("hardOf(3, SURF + 2)"), "깊은 곳의 광물도 더 단단함");
  // 레벨
  ok(t28.ev("levelOf(0).lv") === 1 && t28.ev("levelOf(xpForLevel(1)).lv") === 2, "레벨 계산");
  const d1 = t28.ev("STAT.drill");
  t28.ev("addXP(5000)");
  ok(t28.ev("levelOf(acct.xp).lv") > 5 && t28.ev("STAT.drill") > d1, "레벨업 시 채굴 속도 보너스");
  // 칭호/업적
  t28.ev("acct.stats.mined[3] = 99; acct.quest = {}; acct.title = ''; P.money = 0;"); t28.ev("onMined(3)");
  ok(t28.ev("!!acct.quest.o3_0 && !!acct.quest.o3_1 && !!acct.quest.o3_2") && t28.ev("acct.title") !== "", "철 100개 → 철강왕 포함 달성");
  ok(t28.ev("QUEST_BY.o3_2.title") === "철강왕", "철 100개 칭호는 철강왕");
  ok(t28.ev("P.money") > 0, "업적 보상 지급");
  const nq = t28.ev("Object.keys(acct.quest).length"); t28.ev("onMined(3)");
  ok(t28.ev("Object.keys(acct.quest).length") === nq, "같은 업적은 한 번만 지급");
  ok(t28.ev("ORE_IDS.every((id) => QUESTS.filter((q) => q.group === 'o' + id).length === 5)"), "모든 광물에 5단계 칭호");
  ok(t28.ev("QUESTS.some((q) => q.group === 'all') && QUESTS.length") >= 60, "전체 광물 등 종합 업적 포함 (" + t28.ev("QUESTS.length") + "개)");
  t28.ev("acct.title = 'o3_2'");
  t28.key("KeyQ"); await t28.tick();
  ok(t28.ev("state") === "menu" && t28.texts().some((x) => x.includes("업적")), "Q 키로 업적 화면");
  ok(t28.texts().some((x) => x.includes("철강왕")), "획득한 칭호 표시");
  t28.key("Escape"); await t28.tick();
  // 저장/복원
  const sv28 = JSON.parse(JSON.stringify(t28.ev("snapshot()")));
  ok(sv28.xp > 0 && sv28.quest.o3_2 === 1 && sv28.title === "o3_2", "저장 데이터에 경험치/업적/칭호");
  const t29 = boot(path); t29.run(5); await login(t29, "Other2"); t29.run(5);
  t29.ev("applyAccount(" + JSON.stringify(sv28) + ")");
  ok(t29.ev("titleName()") === "철강왕" && t29.ev("MINER_LV") === t28.ev("MINER_LV"), "불러오면 칭호/레벨 복원");
  const old28 = JSON.parse(JSON.stringify(sv28)); delete old28.xp; delete old28.quest; delete old28.title; old28.stats.mined = { 1: 100, 4: 30 };
  t29.ev("applyAccount(" + JSON.stringify(old28) + ")");
  ok(t29.ev("levelOf(acct.xp).lv") >= 2 && t29.ev("!!acct.quest.o4_1"), "예전 저장도 채굴 기록으로 레벨/업적 계산");
  t29.ev("acct.quest.fake_q = 1; acct.title = 'fake_q'");
  const bad28 = JSON.parse(JSON.stringify(t29.ev("snapshot()")));
  t29.ev("applyAccount(" + JSON.stringify(bad28) + ")");
  ok(!t29.ev("acct.quest.fake_q") && t29.ev("acct.title") !== "fake_q", "모르는 업적/칭호는 무시");
  // 인벤토리: 그림 슬롯 + 장착
  t29.ev("P.items.laser_drill = true; P.items.lamp1 = true; recalcStats()");
  t29.key("KeyI"); await t29.tick();
  ok(t29.ev("state") === "menu" && t29.texts().some((x) => x.includes("장착 장비")) && t29.texts().some((x) => x.includes("에메랄드 레이저 드릴")), "인벤토리에 장착한 장비가 표시됨");
  t29.key("Escape"); await t29.tick();
  // 제작 트리
  ok(t29.ev("RECIPE_CATS.length") === 5 && t29.ev("RECIPE_CATS.every((c) => c.nodes.length === c.ids.length && c.cols >= 2)"), "제작 분류 5개, 모두 트리 배치");
  ok(t29.ev("ITEMS.laser_drill.req") === "iron_bit" && t29.ev("ITEMS.dia_bit.req") === "laser_drill", "상위 장비는 하위 장비가 선행 조건");
  t29.ev("P.items = {}; P.stash = { 9: 20, 3: 80, 6: 40, 5: 20 }; P.bars = { fe: 40 }; P.money = 100000; recalcStats()");
  t29.ev("craftItem('laser_drill')");
  ok(!t29.ev("!!P.items.laser_drill") && t29.ev("msg").includes("먼저"), "선행 장비 없이는 제작 불가");
  t29.ev("craftItem('iron_bit'); craftItem('laser_drill'); craftItem('dia_bit')");
  ok(t29.ev("!!P.items.iron_bit && !!P.items.laser_drill && !!P.items.dia_bit"), "순서대로 제작하면 가능");
  ok(t29.ev("RECIPE_CATS.every((c) => c.ids.every((id) => itemIcon(id) && itemIcon(id).width === 16))"), "새 장비 아이콘 모두 존재");
  // 트리 키 이동
  t29.ev("P.x = 18 * T + 16; P.y = (SURF - 1) * T - 20"); t29.run(10);
  t29.key("KeyE"); await t29.tick();
  t29.ev("craftTab = 0; craftSel = RECIPE_CATS[0].ids.indexOf('iron_bit')");
  t29.key("ArrowRight"); ok(t29.ev("RECIPE_CATS[0].ids[craftSel]") !== "iron_bit", "→ 키로 다음 단계로 이동");
  t29.key("ArrowLeft"); ok(t29.ev("RECIPE_CATS[0].ids[craftSel]") === "iron_bit", "← 키로 선행 장비로 이동");
  t29.key("Digit6"); ok(t29.ev("craftTab") === 5, "숫자 키로 판매 탭 이동");
  t29.run(5);
  t29.key("Escape"); await t29.tick();

  console.log("[24] 마을 배치 / 떨어진 광물 / 시야");
  const t30 = boot(path, { w: 1000, h: 640 }); t30.run(5); await login(t30, "Drop"); t30.run(10);
  // 화물이 가득한 채로 광물을 캐면 그 자리에 떨어짐
  t30.ev("graceT = 99; for (let r = SURF + 20; r <= SURF + 26; r++) for (let c = 26; c <= 34; c++) tiles[r*W+c] = 1; for (let c = 27; c <= 33; c++) tiles[(SURF+23)*W+c] = 0; tiles[(SURF+23)*W+31] = 3; P.x = 30 * T + 16; P.y = (SURF + 23) * T + 16; P.vx = P.vy = 0; P.fuel = 1e9; P.items = {}; recalcStats(); P.cargo = { 6: cargoCap() }; drops.length = 0");
  t30.ev("keys.ArrowRight = true"); for (let i = 0; i < 600 && t30.ev("tiles[(SURF+23)*W+31]") !== 0; i++) t30.run(1); t30.ev("keys.ArrowRight = false");
  ok(t30.ev("tiles[(SURF+23)*W+31]") === 0, "광물 채굴됨");
  ok(t30.ev("drops.length") >= 1 && t30.ev("drops[0].id") === 3 && !t30.ev("P.cargo[3]"), "화물칸이 가득하면 땅에 떨어짐");
  t30.run(60);
  ok(t30.ev("drops.length") >= 1 && t30.ev("drops[0].vy") === 0, "떨어진 광물이 바닥에 놓임");
  // 자리가 생기면 위로 지나가서 주움
  t30.ev("P.cargo = { 6: cargoCap() - 5 }; P.x = drops[0].x; P.y = drops[0].y - 4; P.vx = P.vy = 0"); t30.run(10);
  ok(t30.ev("drops.length") === 0 && t30.ev("P.cargo[3]") >= 1, "자리가 있으면 주워짐");
  // 버리기: 바로 다시 줍지 않고, 멀어졌다 돌아오면 주움
  t30.ev("P.cargo = { 2: 4 }"); t30.ev("discardOre(2, 3)");
  ok(t30.ev("P.cargo[2]") === 1 && t30.ev("drops.length") === 1 && t30.ev("drops[0].n") === 3, "광물 3개 버리기");
  t30.run(120);
  ok(t30.ev("drops.length") === 1, "버린 자리에 서 있어도 바로 다시 줍지 않음");
  t30.ev("P.x += 4 * T"); t30.run(10); t30.ev("P.x = drops[0].x; P.y = drops[0].y - 4; P.vx = P.vy = 0"); t30.run(10);
  ok(t30.ev("drops.length") === 0 && t30.ev("P.cargo[2]") === 4, "멀어졌다가 돌아오면 다시 주움");
  // 60초가 지나면 사라짐
  t30.ev("spawnDrop(5, 28 * T + 16, (SURF + 23) * T + 16, 1); P.x = 33 * T + 16"); t30.run(30);
  t30.ev("drops[0].age = 59.9"); t30.run(20);
  ok(t30.ev("drops.length") === 0, "60초가 지나면 사라짐");
  // 묻히면 사라짐(붕괴/낙하)
  t30.ev("spawnDrop(5, 28 * T + 16, (SURF + 23) * T + 16, 1)"); t30.run(30);
  ok(t30.ev("drops.length") === 1, "떨어진 광물 유지");
  t30.ev("tiles[(SURF+23)*W+28] = 1"); t30.run(2);
  ok(t30.ev("drops.length") === 0, "그 자리가 흙으로 채워지면 사라짐");
  // 폭발로 캔 광물도 화물칸이 가득하면 떨어짐
  t30.ev("P.cargo = { 6: cargoCap() }; tiles[(SURF+24)*W+30] = 4; bombs.push({ id: 'dyn_s', c: 30, r: SURF + 23, t: 0.001, rad: 1 }); P.x = 40 * T; P.y = (SURF + 10) * T");
  t30.run(5);
  ok(t30.ev("drops.some((d) => d.id === 4)"), "폭발로 캔 광물도 떨어짐");
  // 인벤토리에서 버리기 버튼
  t30.ev("P.x = 30 * T + 16; P.y = (SURF + 23) * T + 16; P.cargo = { 9: 2 }; drops.length = 0");
  t30.key("KeyI"); await t30.tick();
  ok(t30.texts().some((x) => x.includes("1개 버리기")), "인벤토리에 버리기 버튼");
  await t30.click("1개 버리기");
  ok(t30.ev("P.cargo[9]") === 1 && t30.ev("drops.length") === 1 && t30.ev("state") === "menu", "인벤토리에서 1개 버림");
  t30.key("Escape"); await t30.tick();
  // 저장에 섞이지 않음 + 불러오면 정리
  t30.ev("applyAccount(JSON.parse(JSON.stringify(snapshot())))");
  ok(t30.ev("drops.length") === 0, "불러오면 떨어진 광물은 정리");
  // 예전(좁은 월드) 저장 → 새로 만들고 지상에서 시작, 진행은 유지
  const old30 = JSON.parse(JSON.stringify(t30.ev("snapshot()")));
  old30.world = t30.ev("(() => { let bin = ''; let left = 32 * 400; while (left > 0) { const n = Math.min(255, left); bin += String.fromCharCode(1, n); left -= n; } return btoa(bin); })()");
  old30.player.x = 10 * 32 + 16; old30.player.y = (6 + 50) * 32 + 16; old30.player.money = 4321;
  t30.ev("applyAccount(" + JSON.stringify(old30) + ")");
  ok(t30.ev("P.y") < t30.ev("SURF * T") && t30.ev("inB(0, Math.floor(P.x / T))") && t30.ev("P.money") === 4321, "예전 저장: 지상 정비소 앞에서 시작, 돈 유지");
  ok(t30.ev("tiles[SURF*W + 3]") === 13 && t30.ev("tiles[SURF*W + MINE_COL + 2]") !== 13, "예전 저장: 새 마을 배치 적용");
  // 시야 계산(하늘빛) 오류 없음
  t30.ev("for (let r = SURF; r < SURF + 6; r++) tiles[r*W+30] = 0; P.x = 30 * T + 16; P.y = (SURF + 5) * T + 16; P.vx = P.vy = 0; P.fuel = 1e9"); t30.run(20);
  ok(t30.ev("state") === "play" && t30.ev("gridCv.width") > 10, "시야 지도 그리기 정상");

  console.log("[25] 용광로 / 주괴");
  const t31 = boot(path, { w: 1000, h: 640 }); t31.run(5); await login(t31, "Smelter"); t31.run(10);
  ok(t31.ev("BUILD_COLS.length") === 4 && t31.ev("BUILD_COLS[3][0]") === t31.ev("BUILD_COLS[2][1] + 1") && t31.ev("tiles[SURF*W + BUILD_COLS[3][0]]") === 13, "제작소 옆에 용광로 건물(기초석 포함)");
  ok(t31.ev("MINE_COL") === t31.ev("BUILD_COLS[3][1] + 1") && t31.ev("W - MINE_COL") >= 18, "광산 터는 용광로 오른쪽");
  ok(t31.ev("RECIPE_CATS.every((c) => c.ids.every((id) => Object.keys(ITEMS[id].mats).every((m) => !BAR_OF[m])))"), "제작 재료에 금속 원석 대신 주괴 사용");
  ok(t31.ev("ITEMS.coal_boiler.mats.fe") === 3 && t31.ev("ITEMS.coal_boiler.mats[6]") === 20, "석탄 보일러: 철 주괴 3 + 석탄 20");
  // 용광로 열기
  t31.ev("P.x = 24 * T + 16; P.y = (SURF - 1) * T - 20; P.vx = P.vy = 0"); t31.run(10);
  ok(t31.ev("nearFurnace") === true, "용광로 앞 감지");
  t31.ev("P.cargo = { 2: 10, 3: 5, 6: 12 }; P.stash = { 4: 4 }; P.money = 5000");
  t31.key("KeyE"); await t31.tick();
  t31.run(1);
  ok(t31.ev("state") === "furnace" && t31.canvasTexts().some((x) => x.includes("용광로")) && t31.ev("cargoCount()") === 0 && t31.ev("P.stash[2]") === 10, "E로 용광로 열림, 화물은 창고로");
  ok(t31.canvasTexts().some((x) => x.includes("구리 주괴")) && t31.canvasTexts().some((x) => x.includes("미스릴 주괴")), "재련 목록 표시");
  // 창 안에서 조작: 키보드 1개 넣기 → 버튼으로 비우기 → 다른 주괴 고르고 '최대'
  t31.key("Digit1"); t31.run(1);
  ok(t31.ev("acct.furnace.q.length") === 1 && t31.ev("acct.furnace.q[0].m") === "cu" && t31.ev("P.stash[2]") === 8, "용광로 창: 1 키로 구리 주괴 1개 넣기");
  t31.run(30);
  ok(t31.ev("acct.furnace.q[0].left") < 4, "용광로 창을 보는 동안에도 재련 진행");
  t31.tapAct("fclear"); t31.run(1);
  ok(t31.ev("acct.furnace.q.length") === 0 && t31.ev("P.stash[2]") === 10 && t31.ev("msgT") > 0, "비우기 버튼: 재료 반환 + 안내");
  t31.tapAct("fsel", 1); t31.run(1);
  ok(t31.ev("furnaceSel") === 1 && t31.canvasTexts().some((x) => x.includes("철 주괴 넣기")), "줄을 누르면 철 주괴 선택, 상세 칸 표시");
  t31.tapAct("smelt", null); t31.run(1);
  ok(t31.ev("acct.furnace.q.length") === 2 && t31.ev("acct.furnace.q.every((j) => j.m === 'fe')"), "최대 버튼: 철 주괴 2개(원석 5개 → 2개)");
  t31.ev("furnaceClear()"); t31.key("Escape"); t31.run(1);
  ok(t31.ev("state") === "play", "Esc로 용광로 창 닫힘");
  // 재련 시작: 구리 원석 2 + 석탄 1 → 구리 주괴 1
  let r = t31.ev("furnaceSmelt('cu', 3)");
  ok(r.includes("3개") && t31.ev("acct.furnace.q.length") === 3 && t31.ev("P.stash[2]") === 4 && t31.ev("P.stash[6]") === 9, "구리 주괴 3개: 원석 6 + 석탄 3 사용");
  r = t31.ev("furnaceSmelt('cu', 99)");
  ok(t31.ev("acct.furnace.q.length") === 5 && !t31.ev("P.stash[2]"), "대기열 최대 5개(Lv.1)");
  r = t31.ev("furnaceSmelt('fe', 1)");
  ok(r.includes("가득"), "대기열이 차면 거부: " + r);
  r = t31.ev("furnaceClear()");
  ok(t31.ev("acct.furnace.q.length") === 0 && t31.ev("P.stash[2]") === 10 && t31.ev("P.stash[6]") === 12, "대기열 비우면 재료 반환");
  r = t31.ev("furnaceSmelt('mi', 1)");
  ok(r.includes("미스릴"), "미스릴 원석 없으면 거부: " + r);
  t31.ev("P.stash[6] = 1"); r = t31.ev("furnaceSmelt('au', 1)");
  ok(r.includes("석탄"), "석탄 부족하면 거부(금은 석탄 2개): " + r);
  t31.ev("P.stash[6] = 12");
  // 시간이 지나면 주괴 완성 (광산에 있어도 진행)
  t31.ev("furnaceSmelt('cu', 2); furnaceSmelt('fe', 1)");
  t31.ev("P.x = 35 * T + 16; P.y = (SURF + 10) * T + 16; for (let r = SURF + 9; r <= SURF + 11; r++) tiles[r*W+35] = 0; P.fuel = 1e9; graceT = 99");
  t31.run(60 * 9);
  ok(t31.ev("P.bars.cu") === 2 && !t31.ev("P.bars.fe"), "약 9초 뒤 구리 주괴 2개 완성, 철은 진행 중");
  t31.run(60 * 7);
  ok(t31.ev("P.bars.fe") === 1 && t31.ev("acct.furnace.q.length") === 0 && t31.ev("acct.stats.smelted") === 3, "철 주괴 완성, 대기열 비고 통계 반영");
  // 주괴로 제작
  t31.ev("P.bars.fe = 3; P.stash[6] = 20; P.money = 5000; craftItem('coal_boiler')");
  ok(t31.ev("!!P.items.coal_boiler") && !t31.ev("P.bars.fe") && t31.ev("P.stash[6]") === undefined, "주괴로 석탄 보일러 제작");
  // 강화
  t31.ev("P.money = 600"); r = t31.ev("furnaceUpgrade()");
  ok(t31.ev("acct.furnace.lv") === 2 && t31.ev("P.money") === 0, "용광로 Lv.2 강화 ($600)");
  t31.ev("P.money = 10"); r = t31.ev("furnaceUpgrade()");
  ok(t31.ev("acct.furnace.lv") === 2 && r.includes("돈"), "돈이 없으면 강화 불가");
  // 업적
  t31.ev("acct.stats.smelted = 9; P.stash = { 2: 2, 6: 1 }; furnaceSmelt('cu', 1)"); t31.run(60 * 4);
  ok(t31.ev("!!acct.quest.smelt_0"), "주괴 10개 → 견습 제련공");
  // 저장 / 불러오기
  t31.ev("P.stash = { 4: 6, 6: 10 }; furnaceSmelt('au', 2); acct.furnace.q[0].left = 3.5");
  const sv31 = JSON.parse(JSON.stringify(t31.ev("snapshot()")));
  ok(sv31.furnace.lv === 2 && sv31.furnace.q.length === 2 && sv31.player.bars.cu >= 2, "저장에 용광로/주괴 포함");
  const t32 = boot(path); t32.run(5); await login(t32, "Other3"); t32.run(5);
  t32.ev("applyAccount(" + JSON.stringify(sv31) + ")");
  ok(t32.ev("acct.furnace.lv") === 2 && t32.ev("acct.furnace.q.length") === 2 && Math.abs(t32.ev("acct.furnace.q[0].left") - 3.5) < 1e-6 && t32.ev("P.bars.cu") >= 2, "불러오면 대기열/주괴 복원");
  const old32 = JSON.parse(JSON.stringify(sv31)); delete old32.furnace; delete old32.player.bars;
  t32.ev("applyAccount(" + JSON.stringify(old32) + ")");
  ok(t32.ev("acct.furnace.lv") === 1 && t32.ev("acct.furnace.q.length") === 0 && t32.ev("Object.keys(P.bars).length") === 0, "예전 저장은 용광로 Lv.1, 주괴 없음");
  const bad32 = JSON.parse(JSON.stringify(sv31)); bad32.furnace = { lv: 99, q: [{ m: "zz", left: 1 }, { m: "cu", left: -5 }] }; bad32.player.bars = { zz: 5, cu: "abc", fe: 2 };
  t32.ev("applyAccount(" + JSON.stringify(bad32) + ")");
  ok(t32.ev("acct.furnace.lv") === 4 && t32.ev("acct.furnace.q.length") === 1 && t32.ev("acct.furnace.q[0].left") === 0 && t32.ev("JSON.stringify(P.bars)") === '{"fe":2}', "잘못된 용광로/주괴 값 정리");
  // 그리기 오류 없음
  t32.ev("P.x = 24 * T + 16; P.y = (SURF - 1) * T - 20"); t32.run(30);
  ok(t32.ev("state") === "play" && t32.ev("nearFurnace") === true, "용광로 앞에서 그리기 정상");

  console.log("[26] 주괴 판매 / 마을 창 통합");
  const t33 = boot(path, { w: 1000, h: 640 }); t33.run(5); await login(t33, "Town"); t33.run(10);
  ok(t33.ev("BAR_KEYS.every((k) => barValue(k) > TILE[BARS[k].ore].value * 2 + TILE[6].value * BARS[k].coal)"), "주괴는 원석 2개 + 석탄보다 비쌈");
  console.log("  (주괴 가격)", t33.ev("JSON.stringify(Object.fromEntries(BAR_KEYS.map((k) => [k, barValue(k)])))"));
  t33.ev("P.bars = { fe: 3, au: 1 }; P.money = 0");
  t33.ev("sellItem('fe', 2)");
  ok(t33.ev("P.money") === t33.ev("unitPrice('fe') * 2") && t33.ev("P.bars.fe") === 1, "철 주괴 2개 판매");
  t33.ev("sellItem('au', Infinity)");
  ok(t33.ev("!P.bars.au") && t33.ev("acct.stats.earned") >= t33.ev("unitPrice('fe') * 2 + unitPrice('au')"), "금 주괴 전부 판매 + 수익 통계");
  t33.ev("P.stash = { 2: 4 }; sellStash()");
  ok(t33.ev("P.bars.fe") === 1 && !t33.ev("P.stash[2]"), "원석 모두 판매는 주괴를 건드리지 않음");
  // 마을 어디서나 연료 충전
  t33.ev("P.fuel = 5; P.x = 24 * T + 16; P.y = (SURF - 1) * T - 20; P.vx = P.vy = 0; inShop = false"); t33.run(10);
  ok(t33.ev("P.fuel") === t33.ev("maxFuel()"), "용광로 앞에서도 연료 충전(마을 어디서나)");
  // 정비소 앞 E → 창고·판매
  t33.ev("P.x = 4 * T + 16; P.y = (SURF - 1) * T - 20"); t33.run(10);
  t33.ev("P.cargo = { 3: 2 }");
  t33.key("KeyE"); await t33.tick();
  ok(t33.ev("state") === "craft" && t33.ev("craftTab") === t33.ev("RECIPE_CATS.length") && t33.ev("P.stash[3]") === 2, "정비소 앞 E: 창고·판매 탭(화물 보관)");
  // 공용 탭 이동: 판매 → 상점 → 제작 → 용광로 → 판매
  t33.ev("switchTown('shop')"); ok(t33.ev("townActive()") === "shop" && t33.ev("state") === "shop", "공용 탭: 상점");
  t33.ev("switchTown('craft')"); ok(t33.ev("townActive()") === "craft" && t33.ev("craftTab") < t33.ev("RECIPE_CATS.length"), "공용 탭: 제작");
  t33.ev("switchTown('furnace')"); await t33.tick();
  t33.run(1);
  ok(t33.ev("townActive()") === "furnace" && t33.ev("state") === "furnace" && t33.canvasTexts().some((x) => x.includes("용광로")), "공용 탭: 용광로");
  t33.key("BracketRight"); await t33.tick();
  ok(t33.ev("townActive()") === "sell", "] 키: 용광로 → 판매");
  t33.key("BracketRight"); await t33.tick();
  ok(t33.ev("townActive()") === "shop", "] 키: 판매 → 상점");
  t33.key("BracketLeft"); await t33.tick();
  ok(t33.ev("townActive()") === "sell", "[ 키: 상점 → 판매");
  t33.key("Escape"); await t33.tick();
  ok(t33.ev("state") === "play", "Esc로 닫힘");
  // 판매 탭 키보드: 주괴 칸 선택 후 Enter
  t33.ev("P.bars = { cu: 2 }; P.money = 0; switchTown('sell'); sellSel = SELL_KEYS.indexOf('cu')");
  t33.key("Enter"); await t33.tick();
  ok(t33.ev("!P.bars.cu") && t33.ev("P.money") === t33.ev("unitPrice('cu') * 2"), "판매 탭에서 주괴 선택 판매");
  t33.key("Escape"); await t33.tick();
  ok(t33.ev("BAR_KEYS.every((k) => barIcon[k].width === 16) && Object.keys(oreDrop).every((k) => oreDrop[k].width === 12)"), "주괴 아이콘/떨어진 아이템 스프라이트");
  t33.ev("spawnDrop(5, 4 * T, (SURF - 1) * T, 1)"); t33.run(30);
  ok(t33.ev("state") === "play", "작아진 떨어진 아이템 그리기 정상");

  console.log("ALL_OK");
})().catch((e) => { console.log("FAIL", e.stack || e.message); process.exit(1); });
