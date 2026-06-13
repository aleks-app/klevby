const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");

function loadControlHelpers() {
  const instrumentedMapLogic = mapLogic.replace(
    /\}\)\(\);\s*$/,
    `window.__waterDepthControlTestHelpers = {
      handleWaterDepthControlClick,
      isWaterDepthControlAvailable,
      syncWaterDepthControlElement
    };\n})();`
  );
  const window = {
    location: {
      href: "https://localhost/index.html",
      origin: "https://localhost",
      protocol: "https:",
      pathname: "/index.html"
    },
    addEventListener() {}
  };

  vm.runInNewContext(instrumentedMapLogic, {
    window,
    URL,
    console
  });

  return window.__waterDepthControlTestHelpers;
}

function createButton() {
  const classes = new Set(["is-unavailable"]);
  const attributes = new Map();

  return {
    classList: {
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name);
    }
  };
}

test("depth control becomes available only for a ready MapLibre instance", () => {
  const { syncWaterDepthControlElement } = loadControlHelpers();
  const button = createButton();

  const unavailable = syncWaterDepthControlElement(button, {
    activeMapProvider: "maplibre",
    mapReady: true,
    hasMapInstance: true,
    waterDepthLayerEnabled: false
  });

  assert.equal(unavailable, false);
  assert.equal(button.classList.contains("is-unavailable"), false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("Yandex keeps the depth control unavailable", () => {
  const { syncWaterDepthControlElement } = loadControlHelpers();
  const button = createButton();

  const unavailable = syncWaterDepthControlElement(button, {
    activeMapProvider: "yandex",
    mapReady: true,
    hasMapInstance: true,
    waterDepthLayerEnabled: false
  });

  assert.equal(unavailable, true);
  assert.equal(button.classList.contains("is-unavailable"), true);
});

test("depth control click toggles only after MapLibre readiness", () => {
  const { handleWaterDepthControlClick, syncWaterDepthControlElement } = loadControlHelpers();
  const button = createButton();
  let toggleCount = 0;
  const toggle = () => {
    toggleCount += 1;
  };

  syncWaterDepthControlElement(button, {
    activeMapProvider: "maplibre",
    mapReady: false,
    hasMapInstance: true,
    waterDepthLayerEnabled: false
  });

  assert.equal(handleWaterDepthControlClick(button, toggle), false);
  assert.equal(toggleCount, 0);

  syncWaterDepthControlElement(button, {
    activeMapProvider: "maplibre",
    mapReady: true,
    hasMapInstance: true,
    waterDepthLayerEnabled: false
  });

  assert.equal(handleWaterDepthControlClick(button, toggle), true);
  assert.equal(toggleCount, 1);
});
