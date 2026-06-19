const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VIEWPORT_KERNEL_ROLE,
  VIEWPORT_KERNEL_ENTRYPOINT,
  CSS_VARIABLES,
  KG_CSS_VARIABLES,
  HEADER_FRAME_CSS_VARIABLES,
  TOUCHBAR_FRAME_CSS_VARIABLES,
  calculateViewportKernel,
  createViewportKernel,
  calculateAppShellViewport,
  createAppShellViewportOwner
} = require("../assets/js/app/app-shell-viewport-owner.js");

const viewportKernelAdapter = require("../assets/js/core/viewport/viewport-kernel.js");

test("viewport kernel adapter exposes official kernel aliases without replacing legacy API", () => {
  assert.equal(VIEWPORT_KERNEL_ROLE, "core-viewport-kernel");
  assert.equal(VIEWPORT_KERNEL_ENTRYPOINT, "assets/js/app/app-shell-viewport-owner.js");
  assert.equal(calculateViewportKernel, calculateAppShellViewport);
  assert.equal(createViewportKernel, createAppShellViewportOwner);

  assert.equal(viewportKernelAdapter.VIEWPORT_KERNEL_ROLE, VIEWPORT_KERNEL_ROLE);
  assert.equal(viewportKernelAdapter.VIEWPORT_KERNEL_ENTRYPOINT, VIEWPORT_KERNEL_ENTRYPOINT);
  assert.equal(viewportKernelAdapter.calculateViewportKernel, calculateAppShellViewport);
  assert.equal(viewportKernelAdapter.createViewportKernel, createAppShellViewportOwner);
  assert.equal(viewportKernelAdapter.CSS_VARIABLES, CSS_VARIABLES);
  assert.equal(viewportKernelAdapter.KG_CSS_VARIABLES, KG_CSS_VARIABLES);
  assert.equal(viewportKernelAdapter.HEADER_FRAME_CSS_VARIABLES, HEADER_FRAME_CSS_VARIABLES);
  assert.equal(viewportKernelAdapter.TOUCHBAR_FRAME_CSS_VARIABLES, TOUCHBAR_FRAME_CSS_VARIABLES);
});

test("kg token bridge mirrors the app shell measurement keys", () => {
  assert.deepEqual(Object.keys(KG_CSS_VARIABLES), Object.keys(CSS_VARIABLES));

  assert.equal(KG_CSS_VARIABLES.viewportWidth, "--kg-viewport-width");
  assert.equal(KG_CSS_VARIABLES.viewportHeight, "--kg-viewport-height");
  assert.equal(KG_CSS_VARIABLES.availableTop, "--kg-shell-top");
  assert.equal(KG_CSS_VARIABLES.availableBottom, "--kg-shell-bottom");
  assert.equal(KG_CSS_VARIABLES.availableHeight, "--kg-shell-height");
  assert.equal(KG_CSS_VARIABLES.availableBottomOffset, "--kg-shell-bottom-offset");
});


test("header frame bridge publishes measured Header geometry tokens", () => {
  assert.equal(HEADER_FRAME_CSS_VARIABLES.headerTop, "--kg-header-top");
  assert.equal(HEADER_FRAME_CSS_VARIABLES.headerBottom, "--kg-header-bottom");
  assert.equal(HEADER_FRAME_CSS_VARIABLES.headerHeight, "--kg-header-height-measured");
  assert.equal(HEADER_FRAME_CSS_VARIABLES.headerTopOffset, "--kg-header-top-offset-measured");
});

test("touchbar frame bridge publishes measured TouchBar geometry tokens", () => {
  assert.equal(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarTop, "--kg-touchbar-top");
  assert.equal(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarBottom, "--kg-touchbar-bottom");
  assert.equal(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarHeight, "--kg-touchbar-height-measured");
  assert.equal(
    TOUCHBAR_FRAME_CSS_VARIABLES.touchbarBottomOffset,
    "--kg-touchbar-bottom-offset-measured"
  );
});

test("viewport owner publishes legacy and kg runtime tokens with the same values", () => {
  const published = new Map();
  const documentObject = {
    body: {
      getAttribute() {
        return "home";
      }
    },
    documentElement: {
      clientWidth: 390,
      clientHeight: 844,
      style: {
        setProperty(name, value) {
          published.set(name, value);
        }
      }
    },
    getElementById(id) {
      if (id !== "header") return null;

      return {
        getBoundingClientRect() {
          return { top: 0, left: 0, right: 390, bottom: 72, width: 390, height: 72 };
        }
      };
    },
    querySelector(selector) {
      if (selector === ".mobile-tabbar") {
        return {
          getBoundingClientRect() {
            return { top: 762, left: 16, right: 374, bottom: 828, width: 358, height: 66 };
          }
        };
      }

      return null;
    }
  };

  const windowObject = {
    innerWidth: 390,
    innerHeight: 844,
    getComputedStyle() {
      return { display: "block", visibility: "visible", opacity: "1" };
    },
    dispatchEvent() {},
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    }
  };

  const owner = createAppShellViewportOwner(windowObject, documentObject);
  owner.update();

  Object.keys(CSS_VARIABLES).forEach((key) => {
    assert.equal(
      published.get(KG_CSS_VARIABLES[key]),
      published.get(CSS_VARIABLES[key]),
      `${KG_CSS_VARIABLES[key]} mirrors ${CSS_VARIABLES[key]}`
    );
  });

  assert.equal(published.get(HEADER_FRAME_CSS_VARIABLES.headerTop), "0px");
  assert.equal(published.get(HEADER_FRAME_CSS_VARIABLES.headerBottom), "72px");
  assert.equal(published.get(HEADER_FRAME_CSS_VARIABLES.headerHeight), "72px");
  assert.equal(published.get(HEADER_FRAME_CSS_VARIABLES.headerTopOffset), "0px");

  assert.equal(published.get(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarTop), "762px");
  assert.equal(published.get(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarBottom), "828px");
  assert.equal(published.get(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarHeight), "66px");
  assert.equal(published.get(TOUCHBAR_FRAME_CSS_VARIABLES.touchbarBottomOffset), "16px");
});

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
    headerTop: 0,
    headerBottom: 72,
    headerHeight: 72,
    headerTopOffset: 0,
    touchbarTop: 762,
    touchbarBottom: 844,
    touchbarHeight: 82,
    touchbarBottomOffset: 0,
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
