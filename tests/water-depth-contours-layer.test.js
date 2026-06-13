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
const zvonData = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../assets/data/depth-contours/zvon.depth.full.geojson"),
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

function loadLayer(fetchImplementation) {
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
    fetch: fetchImplementation || (async () => ({
      ok: true,
      status: 200,
      json: async () => contourData
    }))
  };

  vm.runInContext(layerSource, vm.createContext({ window, document, console }), {
    filename: "water-depth-contours-layer.js"
  });

  return { api: window.KlevbyWaterDepthContoursLayer, container };
}

function createMap(container) {
  const sources = new Map();
  const layers = new Map();
  const calls = {
    addSource: 0,
    addLayer: 0,
    removeSource: 0,
    removeLayer: 0,
    fitBounds: 0,
    flyTo: []
  };

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
    },
    flyTo(options) {
      calls.flyTo.push(options);
    }
  };
}

test("the local Zaslavskoe draft sample is not available to the user flow", () => {
  const { api } = loadLayer();

  assert.deepEqual(JSON.parse(JSON.stringify(api.DRAFT_CONTOURS)), {});
  assert.equal(api.hasDraftContours("zaslavskoe"), false);
  assert.equal(api.getDraftContourUrl("zaslavskoe"), "");
  assert.equal(api.hasDraftContours("unknown-water"), false);
});

test("draft zones use unique KlevGo fill/line ids and depth-based styling", () => {
  const { api } = loadLayer();
  const fillLayer = api.getFillLayerDefinition();
  const lineLayer = api.getLineLayerDefinition();

  assert.equal(api.SOURCE_ID, "klevby-water-depth-contours-draft");
  assert.equal(api.FILL_LAYER_ID, "klevby-water-depth-contours-draft-fill");
  assert.equal(api.LINE_LAYER_ID, "klevby-water-depth-contours-draft-lines");
  assert.equal(new Set([api.SOURCE_ID, api.FILL_LAYER_ID, api.LINE_LAYER_ID]).size, 3);
  assert.equal(fillLayer.type, "fill");
  assert.equal(lineLayer.type, "line");
  assert.deepEqual(JSON.parse(JSON.stringify(fillLayer.paint["fill-color"])).slice(0, 3), [
    "interpolate",
    ["linear"],
    ["get", "depth_m"]
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(lineLayer.paint["line-color"])).slice(0, 3), [
    "interpolate",
    ["linear"],
    ["get", "depth_m"]
  ]);
});

test("Zvon depth map loads the bundled GeoJSON with calm depth styling", async () => {
  const requestedUrls = [];
  const { api, container } = loadLayer(async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      url,
      json: async () => zvonData
    };
  });
  const map = createMap(container);

  assert.equal(await api.showZvonDepth(map), true);
  assert.deepEqual(requestedUrls, ["assets/data/depth-contours/zvon.depth.full.geojson"]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.countGeometryTypes(zvonData))), {
    Polygon: 93,
    LineString: 103,
    Point: 192
  });
  assert.ok(map.getSource(api.ZVON_SOURCE_ID));
  const overviewHaloLayer = map.getLayer(api.DEPTH_OVERVIEW_HALO_LAYER_ID);
  const overviewFillLayer = map.getLayer(api.DEPTH_OVERVIEW_FILL_LAYER_ID);
  const fillLayer = map.getLayer(api.ZVON_FILL_LAYER_ID);
  const lineLayer = map.getLayer(api.ZVON_LINE_LAYER_ID);
  const labelLayer = map.getLayer(api.ZVON_POINT_LAYER_ID);
  assert.equal(overviewHaloLayer.type, "line");
  assert.equal(overviewHaloLayer.source, api.DEPTH_SOURCE_ID);
  assert.equal(overviewHaloLayer.maxzoom, 12);
  assert.deepEqual(JSON.parse(JSON.stringify(overviewHaloLayer.filter)), [
    "==", ["geometry-type"], "Polygon"
  ]);
  assert.equal(overviewHaloLayer.paint["line-color"], "#22d3ee");
  assert.equal(overviewFillLayer.type, "fill");
  assert.equal(overviewFillLayer.source, api.DEPTH_SOURCE_ID);
  assert.equal(overviewFillLayer.maxzoom, 12);
  assert.deepEqual(JSON.parse(JSON.stringify(overviewFillLayer.filter)), [
    "==", ["geometry-type"], "Polygon"
  ]);
  assert.equal(overviewFillLayer.paint["fill-color"], "#06b6d4");
  assert.equal(fillLayer.minzoom, 10);
  assert.equal(fillLayer.paint["fill-color"][0], "case");
  assert.equal(fillLayer.paint["fill-color"][2][0], "interpolate");
  assert.equal(fillLayer.paint["fill-opacity"], 0.52);
  assert.equal(lineLayer.paint["line-color"], "#7dd3fc");
  assert.deepEqual(JSON.parse(JSON.stringify(lineLayer.paint["line-width"])), [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, 1,
    16, 1.5
  ]);
  assert.equal(lineLayer.paint["line-opacity"], 0.82);
  assert.equal(labelLayer.type, "symbol");
  assert.equal(labelLayer.minzoom, 13);
  assert.equal(labelLayer.layout["text-size"][4], 10);
  assert.equal(labelLayer.layout["text-size"][6], 11);
  assert.equal(labelLayer.paint["text-color"], "#dbeafe");
  assert.equal(labelLayer.paint["text-halo-color"], "#172554");
  assert.equal(map.calls.flyTo.length, 0);
  assert.equal(map.calls.fitBounds, 0);
  assert.equal(map.calls.addLayer, 5);
});

test("depth toggle loads every configured lake without changing the viewport", async () => {
  const requestedUrls = [];
  const infoCalls = [];
  const originalInfo = console.info;
  console.info = (...args) => infoCalls.push(args);
  const { api, container } = loadLayer(async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      url,
      json: async () => zvonData
    };
  });
  const map = createMap(container);

  try {
    assert.equal(await api.showAllDepthMaps(map), true);
    assert.deepEqual(
      requestedUrls,
      JSON.parse(JSON.stringify(api.DEPTH_MAPS)).map((depthMap) => depthMap.url)
    );
    assert.equal(map.getSource(api.DEPTH_SOURCE_ID).data.features.length, zvonData.features.length * 4);
    assert.equal(map.calls.flyTo.length, 0);
    assert.equal(map.calls.fitBounds, 0);
    assert.equal(api.getActiveDepthMapId(), "all");
    assert.equal(map.calls.addLayer, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(infoCalls)), [[
      "Klevby Map: depth maps loaded",
      { maps: 4, features: zvonData.features.length * 4 }
    ]]);
  } finally {
    console.info = originalInfo;
  }

  api.removeDepthMap(map);
  assert.equal(map.getSource(api.DEPTH_SOURCE_ID), null);
  assert.equal(map.calls.removeLayer, 5);
});

test("Zvon diagnostic reports a failed GeoJSON response without adding map objects", async () => {
  const { api, container } = loadLayer(async () => ({
    ok: false,
    status: 404,
    url: "assets/data/depth-contours/zvon.depth.full.geojson"
  }));
  const map = createMap(container);

  await assert.rejects(api.showZvonDepth(map), /404/);
  assert.equal(map.calls.addSource, 0);
  assert.equal(map.calls.addLayer, 0);
});

test("draft validation accepts polygon zones and keeps LineString isobath support", () => {
  const { api } = loadLayer();
  const lineCollection = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        water_body_id: "zaslavskoe",
        depth_m: 4,
        depth_type: "isobath",
        accuracy: "draft",
        source_status: "draft",
        checked_at: null
      },
      geometry: {
        type: "LineString",
        coordinates: [[27.35, 53.98], [27.39, 53.97]]
      }
    }]
  };

  assert.equal(api.isDraftFeatureCollection(contourData, "zaslavskoe"), true);
  assert.equal(api.isDraftFeatureCollection(lineCollection, "zaslavskoe"), true);
  lineCollection.features[0].geometry.type = "Polygon";
  assert.equal(api.isDraftFeatureCollection(lineCollection, "zaslavskoe"), false);
});

test("unavailable draft contours do not fetch or render fill and line layers", async () => {
  const { api, container } = loadLayer();
  const map = createMap(container);

  assert.equal(await api.showDraftContours(map, "zaslavskoe"), false);
  assert.equal(map.calls.addSource, 0);
  assert.equal(map.calls.addLayer, 0);
  assert.equal(map.calls.fitBounds, 0);
  assert.equal(map.getLayer(api.FILL_LAYER_ID), null);
  assert.equal(map.getLayer(api.LINE_LAYER_ID), null);
  assert.equal(container.children.length, 0);
});

test("stale draft contour layers and their disclaimer are removed safely", () => {
  const { api, container } = loadLayer();
  const map = createMap(container);

  map.addSource(api.SOURCE_ID, { type: "geojson", data: contourData });
  map.addLayer(api.getFillLayerDefinition());
  map.addLayer(api.getLineLayerDefinition());
  api.setDisclaimerVisible(map, true);

  const note = container.querySelector(`.${api.DISCLAIMER_CLASS}`);
  assert.ok(note);
  assert.equal(note.hidden, false);
  assert.equal(api.removeDraftContours(map), true);
  assert.equal(note.hidden, true);
  assert.equal(map.getLayer(api.FILL_LAYER_ID), null);
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

test("map integration guards unavailable drafts and removes stale contours on depth toggles", () => {
  const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");

  assert.match(mapLogic, /window\.klevbyShowWaterDepthContours = async function/);
  assert.match(mapLogic, /window\.showSection\("map"\)/);
  assert.match(mapLogic, /klevbySetWaterDepthLayerEnabled\(true\)/);
  assert.match(mapLogic, /contoursLayer\.showDraftContours\(map, waterBodyId\)/);
  const cleanupIndex = mapLogic.indexOf("KlevbyWaterDepthContoursLayer?.removeDraftContours(mapInstance)");
  const disabledBranchIndex = mapLogic.indexOf("if (!waterDepthLayerEnabled)", cleanupIndex);
  assert.ok(cleanupIndex >= 0);
  assert.ok(disabledBranchIndex > cleanupIndex);
  assert.match(mapLogic, /showAllDepthMaps\(mapInstance\)/);
  assert.match(mapLogic, /failed to load depth maps/);
  assert.match(mapLogic, /getSource\(contoursLayer\.DEPTH_SOURCE_ID\)/);
  assert.equal(
    mapLogic.includes("KlevbyWaterDepthMapLayer?.setWaterDepthLayerVisible"),
    false
  );
  assert.doesNotMatch(mapLogic, /mapDepthSheet|selectedDepthMapId/);
  assert.equal(mapLogic.includes("window.open"), false);
});
