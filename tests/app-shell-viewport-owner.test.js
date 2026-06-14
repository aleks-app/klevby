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
