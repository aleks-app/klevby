const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../assets/js/map/map-user-location.js"),
  "utf8"
);

function loadApi() {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "map-user-location.js" });
  return context.KlevbyMapUserLocation;
}

function createButton() {
  const classes = new Set();
  const attributes = new Map([["aria-pressed", "false"]]);

  return {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        if (force === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
          return;
        }
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener() {},
    removeEventListener() {}
  };
}

function createMockMap() {
  const sources = new Map();
  const layers = new Set();

  return {
    sources,
    layers,
    getSource(id) {
      return sources.get(id) || null;
    },
    addSource(id, definition) {
      sources.set(id, {
        ...definition,
        setData(data) {
          this.data = data;
        }
      });
    },
    removeSource(id) {
      sources.delete(id);
    },
    getLayer(id) {
      return layers.has(id) ? { id } : null;
    },
    addLayer(definition) {
      layers.add(definition.id);
    },
    removeLayer(id) {
      layers.delete(id);
    },
    moveLayer() {},
    on() {},
    off() {},
    easeTo() {},
    flyTo() {},
    getZoom() {
      return 12;
    }
  };
}

function createMockMarkerClass() {
  const instances = [];

  function MockMarker() {
    this.lngLat = null;
    this.removed = false;
    instances.push(this);
  }

  MockMarker.prototype.setLngLat = function (lngLat) {
    this.lngLat = lngLat;
    return this;
  };
  MockMarker.prototype.addTo = function () {
    return this;
  };
  MockMarker.prototype.remove = function () {
    this.removed = true;
  };

  return { MockMarker, instances };
}

function createWiredController(position, options = {}) {
  const api = loadApi();
  const map = createMockMap();
  const button = createButton();
  const { MockMarker, instances } = createMockMarkerClass();
  const watchId = options.watchId ?? 10;
  const geolocation = {
    watchPosition(success) {
      success(position);
      return watchId;
    },
    clearWatch(id) {
      geolocation.clearedWatchId = id;
    },
    getCurrentPosition(success) {
      success(position);
    }
  };
  let clickHandler;

  button.addEventListener = function (event, handler) {
    if (event === "click") clickHandler = handler;
  };

  const controller = api.createController({
    map,
    button,
    geolocation,
    document: {
      createElement() {
        return {
          className: "",
          classList: { toggle() {}, add() {} },
          style: { setProperty() {} },
          setAttribute() {},
          innerHTML: ""
        };
      }
    },
    MarkerClass: MockMarker,
    notify() {}
  });

  return {
    api,
    map,
    button,
    geolocation,
    controller,
    instances,
    click() {
      clickHandler();
    }
  };
}

test("accuracy feature builds a closed polygon around the current position", () => {
  const feature = loadApi().createAccuracyFeature(27.56, 53.9, 25);
  assert.equal(feature.geometry.type, "Polygon");
  assert.equal(feature.geometry.coordinates[0].length, 65);
  assert.deepEqual(
    feature.geometry.coordinates[0][0],
    feature.geometry.coordinates[0][64]
  );
  assert.equal(feature.properties.accuracy, 25);
});

test("denied permission uses the required user-facing message", () => {
  assert.equal(
    loadApi().GEOLOCATION_DENIED_MESSAGE,
    "Разрешите доступ к геолокации, чтобы видеть себя на карте"
  );
});

test("location module is loaded before map logic and leaves depths control intact", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");
  assert.ok(html.indexOf("map-user-location.js") < html.indexOf("map-logic.js"));
  assert.match(html, /map-user-location\.js\?v=20260613-gps-off-cleanup-1/);
  assert.match(mapLogic, /data-map-action="location" aria-pressed="false"/);
  assert.match(mapLogic, /data-map-action="depths" aria-pressed="false"/);
  assert.match(mapLogic, /KlevbyMapUserLocation\.createController/);
});

test("disabling follow mode clears watch, location visuals, and button state", () => {
  const position = {
    coords: {
      longitude: 27.56,
      latitude: 53.9,
      accuracy: 25,
      heading: 90
    }
  };
  const { api, map, button, geolocation, instances, click } = createWiredController(position);

  click();
  assert.equal(button.classList.contains("is-active"), false);
  assert.equal(instances.length, 1);

  click();
  assert.equal(button.classList.contains("is-active"), true);
  assert.ok(map.getSource(api.SOURCE_ID).data);
  assert.equal(instances[0].removed, false);

  click();
  assert.equal(geolocation.clearedWatchId, 10);
  assert.equal(button.classList.contains("is-active"), false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(instances[0].removed, true);
  const clearedData = map.getSource(api.SOURCE_ID).data;
  assert.equal(clearedData.type, "FeatureCollection");
  assert.equal(clearedData.features.length, 0);
});

test("disable is safe when follow mode was never enabled", () => {
  const api = loadApi();
  const map = createMockMap();
  const button = createButton();
  const geo = { clearWatch() {} };

  const controller = api.createController({
    map,
    button,
    geolocation: geo,
    document: {
      createElement() {
        return {
          className: "",
          classList: { toggle() {} },
          style: { setProperty() {} },
          setAttribute() {},
          innerHTML: ""
        };
      }
    },
    MarkerClass: null,
    notify() {}
  });

  assert.equal(controller.isFollowing(), false);
  controller.destroy();
  assert.equal(map.layers.size, 0);
  assert.equal(map.sources.size, 0);
});

test("follow mode can be enabled again after disable", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: null }
  };
  const { api, map, button, instances, click } = createWiredController(position);

  click();
  click();
  click();
  assert.equal(instances[0].removed, true);

  click();
  click();
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(instances.length, 2);
  assert.equal(instances[1].removed, false);
  assert.ok(map.getSource(api.SOURCE_ID).data);
});
