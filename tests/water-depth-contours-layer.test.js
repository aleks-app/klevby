const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const layerSource = fs.readFileSync(
  path.join(__dirname, "../assets/js/map/water-depth-contours-layer.js"),
  "utf8"
);
const contourData = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../assets/data/depth-contours/zaslavskoe.draft.geojson"),
  "utf8"
));

function createContainer() {
  const children = [];
  return {
    children,
    querySelector(selector) {
      if (!selector.startsWith(".")) return null;
      return children.find((child) => child.className === selector.slice(1)) || null;
    },
    appendChild(child) {
      children.push(child);
    }
  };
}

function loadLayer() {
  const container = createContainer();
  const document = {
    createElement() {
      return {
        className: "",
        textContent: "",
        hidden: false,
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        }
      };
    },
    getElementById(id) {
      return id === "map" ? container : null;
    }
  };
  const window = {
    fetch: async () => ({
      ok: true,
      json: async () => contourData
    })
  };

  vm.runInContext(layerSource, vm.createContext({ window, document, console }), {
    filename: "water-depth-contours-layer.js"
  });

  return { api: window.KlevbyWaterDepthContoursLayer, container };
}

function createMap(container) {
  const sources = new Map();
  const layers = new Map();
  const calls = { addSource: 0, addLayer: 0, removeSource: 0, removeLayer: 0, fitBounds: 0 };

  return {
    calls,
    getContainer() {
      return container;
    },
    getSource(id) {
      return sources.get(id) || null;
    },
    addSource(id, definition) {
      calls.addSource += 1;
      sources.set(id, definition);
    },
    removeSource(id) {
      calls.removeSource += 1;
      sources.delete(id);
    },
    getLayer(id) {
      return layers.get(id) || null;
    },
    addLayer(definition) {
      calls.addLayer += 1;
      layers.set(definition.id, definition);
    },
    removeLayer(id) {
      calls.removeLayer += 1;
      layers.delete(id);
    },
    fitBounds() {
      calls.fitBounds += 1;
    }
  };
}

test("draft contour availability is local and limited to Zaslavskoe", () => {
  const { api } = loadLayer();

  assert.equal(api.hasDraftContours("zaslavskoe"), true);
  assert.equal(api.getDraftContourUrl("zaslavskoe"), "assets/data/depth-contours/zaslavskoe.draft.geojson");
  assert.equal(api.hasDraftContours("unknown-water"), false);
});

test("draft contours use unique KlevGo source/layer ids and depth-based styling", () => {
  const { api } = loadLayer();
  const layer = api.getLineLayerDefinition();

  assert.equal(api.SOURCE_ID, "klevby-water-depth-contours-draft");
  assert.equal(api.LINE_LAYER_ID, "klevby-water-depth-contours-draft-lines");
  assert.equal(layer.type, "line");
  assert.deepEqual(JSON.parse(JSON.stringify(layer.paint["line-color"])).slice(0, 3), [
    "interpolate",
    ["linear"],
    ["get", "depth_m"]
  ]);
});

test("showing contours is repeat-safe and the disclaimer follows contour visibility", async () => {
  const { api, container } = loadLayer();
  const map = createMap(container);

  assert.equal(await api.showDraftContours(map, "zaslavskoe"), true);
  assert.equal(map.calls.addSource, 1);
  assert.equal(map.calls.addLayer, 1);
  assert.equal(map.calls.fitBounds, 1);

  const note = container.querySelector(`.${api.DISCLAIMER_CLASS}`);
  assert.ok(note);
  assert.equal(note.textContent, "Глубины ориентировочные · данные уточняются");
  assert.equal(note.hidden, false);

  assert.equal(await api.showDraftContours(map, "zaslavskoe"), true);
  assert.equal(map.calls.addSource, 2);
  assert.equal(map.calls.addLayer, 2);
  assert.equal(map.calls.removeLayer, 1);
  assert.equal(map.calls.removeSource, 1);
  assert.equal(container.children.length, 1);

  assert.equal(api.removeDraftContours(map), true);
  assert.equal(note.hidden, true);
  assert.equal(map.getLayer(api.LINE_LAYER_ID), null);
  assert.equal(map.getSource(api.SOURCE_ID), null);
});

test("draft disclaimer is declared only by the contour layer visibility module", () => {
  const disclaimer = "Глубины ориентировочные · данные уточняются";
  const detailSource = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-body-detail.js"),
    "utf8"
  );
  const markup = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  assert.match(layerSource, new RegExp(disclaimer));
  assert.equal(detailSource.includes(disclaimer), false);
  assert.equal(markup.includes(disclaimer), false);
  assert.match(layerSource, /setDisclaimerVisible\(map, true\)/);
  assert.match(layerSource, /setDisclaimerVisible\(map, false\)/);
});

test("map integration returns internally, enables depths, and removes contours with the depths toggle", () => {
  const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");

  assert.match(mapLogic, /window\.klevbyShowWaterDepthContours = async function/);
  assert.match(mapLogic, /window\.showSection\("map"\)/);
  assert.match(mapLogic, /klevbySetWaterDepthLayerEnabled\(true\)/);
  assert.match(mapLogic, /contoursLayer\.showDraftContours\(map, waterBodyId\)/);
  assert.match(mapLogic, /KlevbyWaterDepthContoursLayer\?\.removeDraftContours\(mapInstance\)/);
  assert.equal(mapLogic.includes("window.open"), false);
});
