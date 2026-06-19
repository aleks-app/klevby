const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateAppShellViewport
} = require("../assets/js/app/app-shell-viewport-owner.js");

test("normal mode uses the visible header and tabbar boundaries", () => {
  const result = calculateAppShellViewport({
    chromeMode: "home",
    innerWidth: 390,
    innerHeight: 844,
    headerRect: { bottom: 72 },
    tabbarRect: { top: 762 },
    headerVisible: true,
    tabbarVisible: true
  });

  assert.deepEqual(result, {
    chromeMode: "home",
    viewportWidth: 390,
    viewportHeight: 844,
    availableTop: 72,
    availableBottom: 762,
    availableHeight: 690,
    availableBottomOffset: 82,
    headerVisible: true,
    tabbarVisible: true
  });
});

test("map mode uses the viewport bottom even if a tabbar rect is present", () => {
  const result = calculateAppShellViewport({
    chromeMode: "map",
    innerWidth: 390,
    innerHeight: 844,
    headerRect: { bottom: 64 },
    tabbarRect: { top: 762 },
    headerVisible: true,
    tabbarVisible: true
  });

  assert.equal(result.availableBottom, 844);
  assert.equal(result.availableHeight, 780);
  assert.equal(result.availableBottomOffset, 0);
  assert.equal(result.tabbarVisible, false);
});

test("falls back to the viewport bottom when no tabbar is visible", () => {
  const result = calculateAppShellViewport({
    chromeMode: "inner",
    innerWidth: 390,
    innerHeight: 844,
    headerRect: { bottom: 64 },
    tabbarRect: { top: 762 },
    headerVisible: true,
    tabbarVisible: false
  });

  assert.equal(result.availableBottom, 844);
  assert.equal(result.availableHeight, 780);
  assert.equal(result.availableBottomOffset, 0);
});

test("falls back to zero when no header is visible", () => {
  const result = calculateAppShellViewport({
    chromeMode: "home",
    innerWidth: 390,
    innerHeight: 844,
    tabbarRect: { top: 762 },
    headerVisible: false,
    tabbarVisible: true
  });

  assert.equal(result.availableTop, 0);
  assert.equal(result.availableHeight, 762);
});

test("prefers visualViewport dimensions over inner dimensions", () => {
  const result = calculateAppShellViewport({
    chromeMode: "home",
    visualViewportWidth: 375,
    visualViewportHeight: 620,
    innerWidth: 390,
    innerHeight: 844,
    headerRect: { bottom: 60 },
    tabbarRect: { top: 560 },
    headerVisible: true,
    tabbarVisible: true
  });

  assert.equal(result.viewportWidth, 375);
  assert.equal(result.viewportHeight, 620);
  assert.equal(result.availableHeight, 500);
});

test("viewport owner stabilizes without duplicate publishes", () => {
  const { createAppShellViewportOwner } = require("../assets/js/app/app-shell-viewport-owner.js");
  const cssWrites = [];
  const visualViewportListeners = {};
  const rafCallbacks = [];
  let dispatchCount = 0;
  let intervalCallback = null;
  let timeoutCallback = null;
  const header = {
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 390, bottom: 60, width: 390, height: 60 })
  };
  const tabbar = {
    getBoundingClientRect: () => ({ top: 760, left: 0, right: 390, bottom: 844, width: 390, height: 84 })
  };
  const documentObject = {
    readyState: "complete",
    body: {
      getAttribute: (name) => (name === "data-app-chrome-mode" ? "home" : null)
    },
    documentElement: {
      clientWidth: 390,
      clientHeight: 844,
      style: {
        setProperty: (name, value) => cssWrites.push([name, value])
      }
    },
    getElementById: (id) => (id === "header" ? header : null),
    querySelector: (selector) => {
      if (selector === ".mobile-tabbar") return tabbar;
      if (selector === "header[data-chrome-mode]") return header;
      return null;
    },
    addEventListener: () => {}
  };
  const windowObject = {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: {
      width: 390,
      height: 844,
      addEventListener: (name, callback) => {
        visualViewportListeners[name] = callback;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(name, options) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    MutationObserver: class MutationObserver {
      observe() {}
    },
    addEventListener: () => {},
    dispatchEvent: () => {
      dispatchCount += 1;
    },
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    requestAnimationFrame: (callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
    setTimeout: (callback, delay) => {
      timeoutCallback = callback;
      assert.equal(delay, 400);
      return 1;
    },
    setInterval: (callback, delay) => {
      intervalCallback = callback;
      assert.equal(delay, 2500);
      return 1;
    },
    clearInterval: () => {}
  };

  const owner = createAppShellViewportOwner(windowObject, documentObject);
  owner.init();

  const initialWrites = cssWrites.length;
  assert.ok(initialWrites > 0);
  assert.equal(dispatchCount, 1);
  assert.equal(typeof intervalCallback, "function");
  assert.equal(typeof visualViewportListeners.resize, "function");
  assert.equal(typeof visualViewportListeners.scroll, "function");
  assert.equal(rafCallbacks.length, 1);

  rafCallbacks.shift()();
  assert.equal(typeof timeoutCallback, "function");
  timeoutCallback();
  assert.equal(cssWrites.length, initialWrites);
  assert.equal(dispatchCount, 1);

  intervalCallback();
  assert.equal(cssWrites.length, initialWrites);
  assert.equal(dispatchCount, 1);
});

test("visualViewport events are coalesced through requestAnimationFrame", () => {
  const { createAppShellViewportOwner } = require("../assets/js/app/app-shell-viewport-owner.js");
  const cssWrites = [];
  const visualViewportListeners = {};
  const rafCallbacks = [];
  let dispatchCount = 0;
  const header = {
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 390, bottom: 60, width: 390, height: 60 })
  };
  const tabbar = {
    getBoundingClientRect: () => ({ top: 760, left: 0, right: 390, bottom: 844, width: 390, height: 84 })
  };
  const documentObject = {
    readyState: "complete",
    body: {
      getAttribute: (name) => (name === "data-app-chrome-mode" ? "home" : null)
    },
    documentElement: {
      clientWidth: 390,
      clientHeight: 844,
      style: {
        setProperty: (name, value) => cssWrites.push([name, value])
      }
    },
    getElementById: (id) => (id === "header" ? header : null),
    querySelector: (selector) => {
      if (selector === ".mobile-tabbar") return tabbar;
      if (selector === "header[data-chrome-mode]") return header;
      return null;
    },
    addEventListener: () => {}
  };
  const windowObject = {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: {
      width: 390,
      height: 844,
      addEventListener: (name, callback) => {
        visualViewportListeners[name] = callback;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(name, options) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    MutationObserver: class MutationObserver {
      observe() {}
    },
    addEventListener: () => {},
    dispatchEvent: () => {
      dispatchCount += 1;
    },
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    requestAnimationFrame: (callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
    setTimeout: () => 1,
    setInterval: () => 1,
    clearInterval: () => {}
  };

  const owner = createAppShellViewportOwner(windowObject, documentObject);
  owner.init();
  rafCallbacks.length = 0;

  visualViewportListeners.resize();
  visualViewportListeners.scroll();
  assert.equal(rafCallbacks.length, 1);

  const initialWrites = cssWrites.length;
  windowObject.visualViewport.height = 820;
  rafCallbacks.shift()();
  assert.ok(cssWrites.length > initialWrites);
  assert.equal(dispatchCount, 2);
});

test("home mobile CSS keeps viewport fallbacks before first measurement", () => {
  const { readFileSync } = require("node:fs");
  const css = readFileSync("assets/css/screens/home-mobile.css", "utf8");

  assert.match(css, /height:\s*var\(--klevby-app-viewport-height, 100dvh\);/);
  assert.match(
    css,
    /height:\s*var\(--klevby-app-height, var\(--klevby-app-viewport-height, 100dvh\)\) !important;/
  );
  assert.match(
    css,
    /min-height:\s*var\(--klevby-app-height, var\(--klevby-app-viewport-height, 100dvh\)\) !important;/
  );
  assert.match(
    css,
    /max-height:\s*var\(--klevby-app-height, var\(--klevby-app-viewport-height, 100dvh\)\) !important;/
  );
});
