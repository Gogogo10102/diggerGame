// 브라우저 없이 게임을 돌려 보기 위한 가짜 환경 (가짜 캔버스 + 가짜 DOM + 가짜 localStorage)
const fs = require("fs"), vm = require("vm");

class El {
  constructor(tag) {
    this.tag = tag; this.children = []; this.className = ""; this.style = {};
    this.listeners = {}; this._text = ""; this.value = ""; this.attrs = {};
    const set = new Set();
    this.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c) };
  }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  get firstChild() { return this.children[0] || null; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text; }
  addEventListener(n, f) { this.listeners[n] = f; }
  focus() {} select() {}
  click() { if (this.listeners.click) return this.listeners.click({ preventDefault() {} }); }
}
const walk = (n, out = []) => { out.push(n); for (const c of n.children || []) walk(c, out); return out; };

function boot(path, opts = {}) {
  const w = opts.w || 1280, h = opts.h || 720;
  const store = opts.store || new Map();
  const html = fs.readFileSync(path, "utf8");
  const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

  const mkCtx = () => new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return () => ({ width: 50 });
      if (k === "createImageData") return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => mkCtx() });
  const canvasHandlers = {}, docHandlers = {}, handlers = {};
  const main = Object.assign(mkCanvas(), {
    addEventListener: (n, f) => { canvasHandlers[n] = f; }, setPointerCapture() {},
  });
  const body = new El("body");
  let rafCb = null, now = 0;
  const document = {
    body, hidden: false,
    getElementById: () => main,
    createElement: (t) => (t === "canvas" ? mkCanvas() : new El(t)),
    fonts: { load: () => Promise.resolve() },
    addEventListener: (n, f) => { docHandlers[n] = f; },
  };
  const localStorage = opts.brokenStorage
    ? { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } }
    : {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    };
  const sandbox = {
    document, localStorage,
    addEventListener: (n, f) => { handlers[n] = f; },
    matchMedia: () => ({ matches: !!opts.touch }),
    innerWidth: w, innerHeight: h,
    requestAnimationFrame: (f) => { rafCb = f; },
    performance: { now: () => now },
    console, setTimeout, clearTimeout, btoa, atob, TextEncoder, TextDecoder,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const t = {
    sandbox, store, body, handlers, docHandlers, canvasHandlers,
    ev: (s) => vm.runInContext(s, sandbox),
    key: (c, extra = {}) => handlers.keydown({ code: c, key: c, repeat: false, preventDefault() {}, ...extra }),
    keyup: (c) => handlers.keyup({ code: c }),
    ptr: (type, x, y, id = 1) =>
      canvasHandlers[type]({ pointerId: id, pointerType: "touch", clientX: x, clientY: y, preventDefault() {} }),
    frame: () => { now += 16.7; const f = rafCb; rafCb = null; f(now); },
    run: (n) => { for (let i = 0; i < n; i++) t.frame(); },
    tick: async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); },
    all: () => walk(body),
    find: (pred) => walk(body).find(pred),
    btn: (text) => walk(body).find((n) => n.tag === "button" && n.textContent === text),
    click: async (text) => {
      const b = t.btn(text);
      if (!b) throw new Error("버튼을 못 찾음: " + text + " / 현재 버튼: " + walk(body).filter((n) => n.tag === "button").map((n) => n.textContent).join(","));
      const r = b.click(); if (r && r.then) await r; await t.tick();
    },
    texts: () => walk(body).map((n) => n._text).filter(Boolean),
  };
  return t;
}
module.exports = { boot, El, walk };
