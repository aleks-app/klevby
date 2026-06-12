const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadWaterDepthMapLayer(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-depth-map-layer.js"),
    "utf8"
  );
  const info = [];
  const warnings = [];
  const window = {
    KLEVB_WATER_DEPTH_DEBUG: options.debug === true,
    KlevbyWaterDepthMapSources: options.adapter,
    localStorage: options.localStorage
  };
  const context = vm.createContext({
    window,
    console: {
      info: (...args) => info.push(args),
      warn: (...args) => warnings.push(args)
    }
  });

  vm.runInContext(source, context, { filename: "water-depth-map-layer.js" });

  return {
    api: window.KlevbyWaterDepthMapLayer,
    info,
    warnings
  };
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("toWaterDepthFeatureCollection keeps only map-ready coordinate rows", () => {
  const { api } = loadWaterDepthMapLayer();
  const data = api.toWaterDepthFeatureCollection([
    {
      id: 7,
      name: "Озеро Нарочь",
      latitude: 54.85,
      longitude: 26.97,
      hasCoordinates: true,
      sourceUrl: "https://example.com/naroch",
      quality: "verified",
      locationQuality: "approximate"
    },
    {
      id: 8,
      name: "Без координат",
      latitude: null,
      longitude: null,
      hasCoordinates: false
    }
  ]);

  assert.deepEqual(toPlain(data), {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [26.97, 54.85]
        },
        properties: {
          id: 7,
          name: "Озеро Нарочь",
          sourceUrl: "https://example.com/naroch",
          quality: "verified",
          locationQuality: "approximate"
        }
      }
    ]
  });
});

test("addWaterDepthLayer is disabled by default", async () => {
  let adapterCalls = 0;
  let sourceCalls = 0;
  const { api, info, warnings } = loadWaterDepthMapLayer({
    adapter: {
      async getWaterDepthMapSources() {
        adapterCalls += 1;
        return [];
      }
    }
  });

  await api.addWaterDepthLayer({
    addSource() {
      sourceCalls += 1;
    }
  });

  assert.equal(adapterCalls, 0);
  assert.equal(sourceCalls, 0);
  assert.equal(info.length, 0);
  assert.equal(warnings.length, 0);
});

test("addWaterDepthLayer accepts only the exact localStorage debug value", async () => {
  let adapterCalls = 0;
  const { api } = loadWaterDepthMapLayer({
    localStorage: {
      getItem() {
        return "true";
      }
    },
    adapter: {
      async getWaterDepthMapSources() {
        adapterCalls += 1;
        return [];
      }
    }
  });

  await api.addWaterDepthLayer({});

  assert.equal(adapterCalls, 0);
});

test("addWaterDepthLayer adds one GeoJSON source and circle layer when enabled", async () => {
  const sourceCalls = [];
  const layerCalls = [];
  const { api, info, warnings } = loadWaterDepthMapLayer({
    debug: true,
    adapter: {
      async getWaterDepthMapSources() {
        return [
          { id: 1, latitude: 53.9, longitude: 27.56, hasCoordinates: true },
          { id: 2, latitude: null, longitude: null, hasCoordinates: false }
        ];
      }
    }
  });
  const map = {
    getSource() {
      return null;
    },
    addSource(...args) {
      sourceCalls.push(args);
    },
    getLayer() {
      return null;
    },
    addLayer(layer) {
      layerCalls.push(layer);
    }
  };

  await api.addWaterDepthLayer(map);

  assert.equal(sourceCalls.length, 1);
  assert.equal(sourceCalls[0][0], "klevby-water-depth-sources");
  assert.equal(toPlain(sourceCalls[0][1]).type, "geojson");
  assert.deepEqual(toPlain(sourceCalls[0][1].data.features[0].geometry.coordinates), [27.56, 53.9]);
  assert.equal(layerCalls.length, 1);
  assert.equal(layerCalls[0].id, "klevby-water-depth-points");
  assert.equal(layerCalls[0].type, "circle");
  assert.equal(info.length, 1);
  assert.match(info[0][0], /debug render summary/);
  assert.deepEqual(toPlain(info[0][1]), {
    totalRowsReceived: 2,
    rowsWithCoordinates: 1,
    rowsRenderedOnMap: 1,
    skippedRowsWithoutCoordinates: 1,
    sourceId: "klevby-water-depth-sources",
    layerId: "klevby-water-depth-points"
  });
  assert.equal(warnings.length, 0);
});

test("addWaterDepthLayer updates an existing source without duplicating the layer", async () => {
  const updates = [];
  let addSourceCalls = 0;
  let addLayerCalls = 0;
  const { api } = loadWaterDepthMapLayer({
    localStorage: {
      getItem(key) {
        return key === "KLEVB_WATER_DEPTH_DEBUG" ? "1" : null;
      }
    },
    adapter: {
      async getWaterDepthMapSources() {
        return [];
      }
    }
  });
  const map = {
    getSource() {
      return {
        setData(data) {
          updates.push(data);
        }
      };
    },
    addSource() {
      addSourceCalls += 1;
    },
    getLayer() {
      return { id: "klevby-water-depth-points" };
    },
    addLayer() {
      addLayerCalls += 1;
    }
  };

  await api.addWaterDepthLayer(map);

  assert.equal(updates.length, 1);
  assert.deepEqual(toPlain(updates[0]), { type: "FeatureCollection", features: [] });
  assert.equal(addSourceCalls, 0);
  assert.equal(addLayerCalls, 0);
});

test("addWaterDepthLayer contains MapLibre rendering failures", async () => {
  const { api, warnings } = loadWaterDepthMapLayer({
    debug: true,
    adapter: {
      async getWaterDepthMapSources() {
        return [{ id: 1, latitude: 53.9, longitude: 27.56, hasCoordinates: true }];
      }
    }
  });

  await assert.doesNotReject(() => api.addWaterDepthLayer({
    getSource() {
      return null;
    },
    addSource() {
      throw new Error("MapLibre source failed");
    }
  }));

  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /fetch or rendering failed/);
});

test("addWaterDepthLayer warns and does not throw when fetching fails", async () => {
  const { api, warnings } = loadWaterDepthMapLayer({
    debug: true,
    adapter: {
      async getWaterDepthMapSources() {
        throw new Error("fetch failed");
      }
    }
  });

  await api.addWaterDepthLayer({});

  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /failed/);
});

test("setWaterDepthLayerVisible renders without debug and removes on disable", async () => {
  const sourceCalls = [];
  const layerCalls = [];
  const removed = [];
  const { api } = loadWaterDepthMapLayer({
    adapter: {
      async getWaterDepthMapSources() {
        return [{ id: 3, latitude: 53.9, longitude: 27.56, hasCoordinates: true }];
      }
    }
  });
  const map = {
    getSource(id) {
      return sourceCalls.some((call) => call[0] === id) ? { setData() {} } : null;
    },
    addSource(...args) {
      sourceCalls.push(args);
    },
    getLayer(id) {
      return layerCalls.some((layer) => layer.id === id) ? { id } : null;
    },
    addLayer(layer) {
      layerCalls.push(layer);
    },
    removeLayer(id) {
      removed.push(["layer", id]);
    },
    removeSource(id) {
      removed.push(["source", id]);
    }
  };

  await api.setWaterDepthLayerVisible(map, true);
  assert.equal(sourceCalls.length, 1);
  assert.equal(layerCalls.length, 1);

  await api.setWaterDepthLayerVisible(map, false);
  assert.deepEqual(removed, [
    ["layer", "klevby-water-depth-points"],
    ["source", "klevby-water-depth-sources"]
  ]);
});
