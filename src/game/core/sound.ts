// =====================================================================
//  효과음 (Web Audio 로 그 자리에서 합성 · 소리 파일 없음)
//  - 사슬 밖 모듈: state.ts 만 씀. 누구나 import { sfx } 해서 sfx("dig") 처럼 부르면 됨.
//  - 브라우저는 사용자가 한 번 누르기 전까지 소리를 막아서, 첫 터치/키 입력 때 켭니다.
//  - Web Audio 가 없는 곳(테스트, 오래된 브라우저)에서는 아무 일도 안 함.
//  - 크기: S.sfxVol (0~10, 0 = 끔). 설정 창에서 바꾸고 기기에 저장(menu.ts).
//  - 이어지는 소리(추진 불꽃 · 드릴)는 sfxLoop(이름, 켬/끔) 을 매 프레임 부름. 0.15초 동안 안 부르면 저절로 꺼짐.
// =====================================================================
import { S } from "./state.ts";

S.sfxVol = 6;
let sndCtx: AudioContext | null = null;
let sndOut: GainNode | null = null;
let sndNoise: AudioBuffer | null = null;
let sndFailed = false;
const sndLast: Record<string, number> = {};

function sndGet(): AudioContext | null {
  if (sndCtx || sndFailed) return sndCtx;
  const g = globalThis as any, C = g.AudioContext || g.webkitAudioContext;
  if (!C) { sndFailed = true; return null; }
  try {
    sndCtx = new C() as AudioContext;
    sndOut = sndCtx.createGain(); sndOut.connect(sndCtx.destination);
    const n = sndCtx.sampleRate, buf = sndCtx.createBuffer(1, n, n), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;     // 흰 잡음 1초 (흙·폭발·바람 소리 재료)
    sndNoise = buf;
  } catch (e) { sndFailed = true; sndCtx = null; }
  return sndCtx;
}
export function unlockAudio() {
  const a = sndGet();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}
if (typeof addEventListener === "function") {
  addEventListener("pointerdown", unlockAudio, true);
  addEventListener("keydown", unlockAudio, true);
}

// 삑 소리 하나: 파형 · 시작/끝 높이 · 길이 · 크기 · 늦게 시작
function beep(a: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sndOut!); o.start(t); o.stop(t + dur + 0.02);
}
// 잡음 한 번: 거르개 종류 · 시작/끝 주파수 · 길이 · 크기
function hiss(a: AudioContext, kind: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, at = 0, q = 0.8) {
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = sndNoise; f.type = kind; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sndOut!);
  s.start(t, Math.random() * 0.8, dur + 0.05);
}

// 같은 소리가 너무 촘촘히 겹치지 않게 하는 최소 간격(초)
const SND_GAP: Record<string, number> = { ignite: 0.25, shutter: 0.3, dig: 0.08, step: 0.07, thrust: 0.07, tick: 0.03, click: 0.04, pickup: 0.05, land: 0.12, warn: 0.5, error: 0.15 };

export type SfxOpt = { pitch?: number; vol?: number; hard?: boolean };
export function sfx(name: string, o: SfxOpt = {}) {
  if (!(S.sfxVol > 0)) return;
  const a = sndGet();
  if (!a || !sndOut || a.state !== "running") return;
  const now = a.currentTime;
  if (now - (sndLast[name] || -9) < (SND_GAP[name] || 0.02)) return;
  sndLast[name] = now;
  sndOut.gain.value = Math.pow(S.sfxVol / 10, 1.6) * 0.7;
  const p = (o.pitch || 1) * (0.92 + Math.random() * 0.16), v = o.vol === undefined ? 1 : o.vol;
  switch (name) {
    case "dig":            // 흙 긁는 소리 (단단한 돌은 더 높고 날카롭게)
      if (o.hard) { hiss(a, "bandpass", 2400 * p, 1400 * p, 0.05, 0.35 * v, 0, 1.4); beep(a, "square", 260 * p, 180 * p, 0.03, 0.05 * v); }
      else { hiss(a, "lowpass", 1000 * p, 420 * p, 0.06, 0.4 * v); beep(a, "triangle", 150 * p, 90 * p, 0.05, 0.12 * v); }
      break;
    case "break":          // 흙이 부서짐
      hiss(a, "lowpass", 1400 * p, 260, 0.14, 0.55 * v); beep(a, "sine", 120 * p, 50, 0.13, 0.35 * v);
      break;
    case "ore":            // 광물: 부서지는 소리 + 반짝이는 쨍 (비싼 광물일수록 높음)
      hiss(a, "lowpass", 1600, 300, 0.1, 0.4 * v); beep(a, "sine", 110, 55, 0.1, 0.25 * v);
      beep(a, "square", 880 * p, 1320 * p, 0.07, 0.07 * v, 0.02); beep(a, "triangle", 1760 * p, 2200 * p, 0.16, 0.08 * v, 0.06);
      break;
    case "step":           // 바퀴로 굴러가는 소리
      hiss(a, "lowpass", 520 * p, 300, 0.04, 0.16 * v); break;
    case "thrust":         // 위로 뜰 때 분사
      hiss(a, "bandpass", 700 * p, 380 * p, 0.09, 0.16 * v, 0, 0.7); break;
    case "land":           // 바닥에 쿵
      hiss(a, "lowpass", 480, 120, 0.1, 0.45 * v); beep(a, "sine", 95, 45, 0.12, 0.35 * v); break;
    case "pickup":         // 떨어진 광물 줍기
      beep(a, "square", 660 * p, 990 * p, 0.05, 0.08 * v); beep(a, "square", 990 * p, 1320 * p, 0.06, 0.07 * v, 0.05); break;
    case "click":          // 버튼 누름
      beep(a, "square", 1050, 900, 0.03, 0.09 * v); hiss(a, "highpass", 4000, 3000, 0.015, 0.08 * v); break;
    case "tick":           // 목록에서 고르기
      beep(a, "square", 720, 680, 0.02, 0.05 * v); break;
    case "open":           // 마을 창 열기
      hiss(a, "bandpass", 900, 2600, 0.12, 0.12 * v, 0, 1); beep(a, "square", 520, 780, 0.07, 0.06 * v, 0.03); break;
    case "buy":            // 사기 · 만들기 (찰칵 + 띵)
      beep(a, "square", 880, 880, 0.06, 0.09 * v); beep(a, "square", 1320, 1320, 0.14, 0.09 * v, 0.07);
      beep(a, "triangle", 2640, 2640, 0.16, 0.05 * v, 0.07); break;
    case "sell":           // 팔기 (동전 짤랑)
      beep(a, "triangle", 1568, 1568, 0.06, 0.11 * v); beep(a, "triangle", 2093, 2093, 0.14, 0.1 * v, 0.06);
      hiss(a, "highpass", 6000, 5000, 0.05, 0.08 * v, 0.02); break;
    case "error":          // 안 됨 (돈 부족 등)
      beep(a, "square", 190, 140, 0.15, 0.09 * v); break;
    case "cave":           // 동굴 발견: 올라가는 화음 + 바람
      [392, 523, 659, 784].forEach((f, i) => beep(a, "triangle", f, f, 0.22, 0.09 * v, i * 0.08));
      hiss(a, "bandpass", 400, 900, 0.6, 0.1 * v, 0, 0.5); break;
    case "levelup":
      [523, 659, 784, 1046].forEach((f, i) => beep(a, "square", f, f, 0.12, 0.07 * v, i * 0.07)); break;
    case "boom":           // 폭발
      hiss(a, "lowpass", 1800, 90, 0.7, 0.9 * v); beep(a, "sine", 80, 30, 0.55, 0.6 * v); break;
    case "rumble":         // 천장 붕괴 · 흙더미 떨어짐
      hiss(a, "lowpass", 380, 90, 0.9, 0.7 * v); beep(a, "sine", 60, 35, 0.8, 0.4 * v); break;
    case "warn":           // 연료 부족 · 지반 불안정
      beep(a, "square", 880, 880, 0.07, 0.07 * v); beep(a, "square", 660, 660, 0.09, 0.07 * v, 0.1); break;
    case "refuel":         // 지상 도착 연료 충전
      beep(a, "sine", 300, 900, 0.28, 0.12 * v); beep(a, "triangle", 600, 1500, 0.22, 0.05 * v, 0.06); break;
    case "ignite":         // 엔진 점화: 펑 + 쉬이익 (로켓 발사 시작)
      beep(a, "sine", 140, 50, 0.18, 0.4 * v); hiss(a, "lowpass", 3000, 500, 0.35, 0.5 * v); hiss(a, "bandpass", 600, 2400, 0.25, 0.25 * v, 0.03, 0.7); break;
    case "shutter":        // 차고 셔터: 철판이 말리며 덜그럭 (짧은 딸깍 여러 번 + 쇳소리)
      hiss(a, "bandpass", 1500 * p, 900 * p, 0.42, 0.14 * v, 0, 1.2);
      for (let i = 0; i < 6; i++) beep(a, "square", (210 + (i % 2) * 40) * p, 150 * p, 0.025, 0.05 * v, i * 0.065);
      break;
    case "fuse":           // 폭약 설치
      hiss(a, "highpass", 3000, 5000, 0.25, 0.1 * v); beep(a, "square", 400, 300, 0.05, 0.06 * v); break;
  }
}

// ---------------------------------------------------------------------
//  이어지는 소리: 추진(로켓 불꽃 소리) · 드릴(모터 윙 + 갈리는 소리)
// ---------------------------------------------------------------------
type SndLoop = { g: GainNode; vol: number; on: boolean; last: number; tune: (o: SfxOpt) => void };
const sndLoops: Record<string, SndLoop> = {};
let sndLoopTimer: any = null;

function noiseSrc(a: AudioContext) {
  const s2 = a.createBufferSource(); s2.buffer = sndNoise; s2.loop = true; s2.start(); return s2;
}
function makeLoop(a: AudioContext, name: string): SndLoop {
  const g = a.createGain(); g.gain.value = 0.0001; g.connect(sndOut!);
  if (name === "thrust") {
    // 로켓 불꽃: 낮게 웅웅대는 굉음(저역 잡음) + 쉬익(중역) + 타닥거림(빠르게 흔들리는 크기)
    const roar = noiseSrc(a), lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = 0.9;
    const hiss2 = noiseSrc(a), bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1600; bp.Q.value = 0.6;
    const hg = a.createGain(); hg.gain.value = 0.35;
    const crack = a.createGain(); crack.gain.value = 0.8;
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.type = "square"; lfo.frequency.value = 23; lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(crack.gain); lfo.start();
    roar.connect(lp); lp.connect(crack); hiss2.connect(bp); bp.connect(hg); hg.connect(crack); crack.connect(g);
    return { g, vol: 0.55, on: false, last: 0, tune: (o) => { lp.frequency.setTargetAtTime(380 + (o.pitch || 1) * 120, a.currentTime, 0.05); } };
  }
  // 드릴: 톱니파 모터(빠르게 흔들려서 윙윙) + 갈리는 잡음. 단단한 땅이면 더 높고 거칠게
  const motor = a.createOscillator(); motor.type = "sawtooth"; motor.frequency.value = 92;
  const wob = a.createOscillator(), wg = a.createGain(); wob.frequency.value = 31; wg.gain.value = 9;
  wob.connect(wg); wg.connect(motor.frequency); wob.start();
  const mlp = a.createBiquadFilter(); mlp.type = "lowpass"; mlp.frequency.value = 900;
  const mg = a.createGain(); mg.gain.value = 0.35;
  motor.connect(mlp); mlp.connect(mg); mg.connect(g); motor.start();
  const grind = noiseSrc(a), gbp = a.createBiquadFilter(); gbp.type = "bandpass"; gbp.frequency.value = 2200; gbp.Q.value = 1.6;
  const gg2 = a.createGain(); gg2.gain.value = 0.55;
  const glfo = a.createOscillator(), glg = a.createGain(); glfo.type = "triangle"; glfo.frequency.value = 13; glg.gain.value = 0.3;
  glfo.connect(glg); glg.connect(gg2.gain); glfo.start();
  grind.connect(gbp); gbp.connect(gg2); gg2.connect(g);
  return {
    g, vol: 0.4, on: false, last: 0,
    tune: (o) => {
      const t = a.currentTime;
      motor.frequency.setTargetAtTime(o.hard ? 132 : 92, t, 0.06);
      gbp.frequency.setTargetAtTime(o.hard ? 3400 : 2000, t, 0.06);
      mlp.frequency.setTargetAtTime(o.hard ? 1500 : 900, t, 0.06);
    },
  };
}
// 켜 둔 소리 중 한동안 다시 안 불린 것은 끔 (창이 열려 게임이 멈춰도 소리가 남지 않게)
function sndLoopCheck() {
  if (!sndCtx) return;
  const now = sndCtx.currentTime;
  for (const k in sndLoops) {
    const L2 = sndLoops[k];
    if (L2.on && now - L2.last > 0.15) { L2.on = false; L2.g.gain.setTargetAtTime(0.0001, now, 0.05); }
  }
}
export function sfxLoop(name: string, on: boolean, o: SfxOpt = {}) {
  const a = sndGet();
  if (!a || !sndOut || a.state !== "running") return;
  let L2 = sndLoops[name];
  if (!on || !(S.sfxVol > 0)) {
    if (L2 && L2.on) { L2.on = false; L2.g.gain.setTargetAtTime(0.0001, a.currentTime, name === "thrust" ? 0.08 : 0.04); }
    return;
  }
  if (!L2) {
    L2 = sndLoops[name] = makeLoop(a, name);
    if (!sndLoopTimer && typeof setInterval === "function") sndLoopTimer = setInterval(sndLoopCheck, 100);
  }
  sndOut.gain.value = Math.pow(S.sfxVol / 10, 1.6) * 0.7;
  L2.last = a.currentTime;
  if (!L2.on) { L2.on = true; L2.g.gain.setTargetAtTime(L2.vol * (o.vol === undefined ? 1 : o.vol), a.currentTime, 0.03); }
  L2.tune(o);
}
