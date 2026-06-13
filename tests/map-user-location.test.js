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

function createMockMap(options = {}) {
  const sources = new Map();
  const layers = new Set();
  const listeners = new Map();
  const flyToCalls = [];
  const easeToCalls = [];
  let zoom = options.zoom ?? 12;

  return {
    sources,
    layers,
    flyToCalls,
    easeToCalls,
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
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emit(event, data) {
      for (const handler of listeners.get(event) || []) handler(data);
    },
    easeTo(options) {
      easeToCalls.push(options);
    },
    flyTo(options) {
      flyToCalls.push(options);
    },
    getZoom() {
      return zoom;
    },
    setZoom(value) {
      zoom = value;
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
  const map = createMockMap(options);
  const button = createButton();
  const { MockMarker, instances } = createMockMarkerClass();
  const watchId = options.watchId ?? 10;
  let watchCallback;
  let watchErrorCallback;
  const geolocation = {
    watchPosition(success, error) {
      geolocation.watchStarted = true;
      watchCallback = success;
      watchErrorCallback = error;
      if (!options.deferWatchCallback) {
        success(position);
        if (options.extraWatchUpdates) {
          success(position);
        }
      }
      return watchId;
    },
    clearWatch(id) {
      geolocation.clearedWatchId = id;
    },
    getCurrentPosition() {}
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
    },
    deliverPosition() {
      watchCallback?.(position);
    },
    deliverError(error) {
      watchErrorCallback?.(error);
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
  assert.match(html, /map-user-location\.js\?v=20260613-gps-stability-fix-1/);
  assert.match(mapLogic, /data-map-action="location" aria-pressed="false"/);
  assert.match(mapLogic, /data-map-action="depths" aria-pressed="false"/);
  assert.match(mapLogic, /KlevbyMapUserLocation\.createController/);
});

test("first successful GPS position zooms map to street level", () => {
  const api = loadApi();
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { map, click } = createWiredController(position, { zoom: 8 });

  click();

  assert.equal(map.flyToCalls.length, 1);
  assert.equal(map.flyToCalls[0].center[0], 27.56);
  assert.equal(map.flyToCalls[0].center[1], 53.9);
  assert.ok(map.flyToCalls[0].zoom >= api.USER_LOCATION_FOCUS_ZOOM);
  assert.equal(map.easeToCalls.length, 0);
});

test("repeated GPS updates do not move the map again", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { map, click } = createWiredController(position, {
    extraWatchUpdates: true
  });

  click();

  assert.equal(map.flyToCalls.length, 1);
  assert.equal(map.easeToCalls.length, 0);
});

test("manual map movement does not disable active GPS or remove its marker", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { map, button, geolocation, instances, click } = createWiredController(position);

  click();
  for (const event of ["dragstart", "movestart", "zoomstart", "moveend", "zoomend"]) {
    map.emit(event, { originalEvent: {} });
  }

  assert.equal(geolocation.clearedWatchId, undefined);
  assert.equal(instances[0].removed, false);
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(button.getAttribute("aria-pressed"), "true");
});

test("temporary watch errors after a successful fix keep GPS and visuals active", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const wired = createWiredController(position);

  wired.click();
  wired.deliverError({ code: 3 });
  wired.deliverError({ code: 2 });

  assert.equal(wired.geolocation.clearedWatchId, undefined);
  assert.equal(wired.instances[0].removed, false);
  assert.equal(wired.button.classList.contains("is-active"), true);
  assert.equal(wired.button.getAttribute("aria-pressed"), "true");
  assert.ok(wired.map.getSource(wired.api.SOURCE_ID).data);
});

test("first fix keeps a closer manual zoom instead of zooming out", () => {
  const api = loadApi();
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: null }
  };
  const { map, click } = createWiredController(position, { zoom: 18 });

  click();

  assert.equal(map.flyToCalls.length, 1);
  assert.equal(map.flyToCalls[0].zoom, 18);
  assert.ok(api.USER_LOCATION_FOCUS_ZOOM < 18);
});

test("first click starts watch and activates button immediately", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { geolocation, button, click } = createWiredController(position, {
    deferWatchCallback: true
  });

  click();

  assert.equal(geolocation.watchStarted, true);
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(button.getAttribute("aria-pressed"), "true");
});

test("position success shows marker while button stays active", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { api, map, button, instances, click } = createWiredController(position);

  click();

  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(instances.length, 1);
  assert.equal(instances[0].removed, false);
  assert.ok(map.getSource(api.SOURCE_ID).data);
});

test("second click disables GPS and clears location visuals", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const { api, map, button, geolocation, instances, click } = createWiredController(position);

  click();
  assert.equal(button.classList.contains("is-active"), true);

  click();
  assert.equal(geolocation.clearedWatchId, 10);
  assert.equal(button.classList.contains("is-active"), false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(instances[0].removed, true);
  const clearedData = map.getSource(api.SOURCE_ID).data;
  assert.equal(clearedData.type, "FeatureCollection");
  assert.equal(clearedData.features.length, 0);
});

test("permission denied before first success safely disables GPS", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const wired = createWiredController(position, { deferWatchCallback: true });

  wired.click();
  wired.deliverError({ code: 1 });

  assert.equal(wired.geolocation.clearedWatchId, 10);
  assert.equal(wired.button.classList.contains("is-active"), false);
  assert.equal(wired.button.getAttribute("aria-pressed"), "false");
  assert.equal(wired.instances.length, 0);
});

test("disable and enable again zooms once on the next first fix", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: 90 }
  };
  const wired = createWiredController(position, { deferWatchCallback: true });

  wired.click();
  wired.deliverPosition();
  assert.equal(wired.map.flyToCalls.length, 1);

  wired.click();
  wired.click();
  wired.deliverPosition();
  wired.deliverPosition();

  assert.equal(wired.map.flyToCalls.length, 2);
});

test("marker is never visible while button is inactive", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: null }
  };
  const { button, instances, click, deliverPosition } = createWiredController(position, {
    deferWatchCallback: true
  });

  click();
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(instances.length, 0);

  deliverPosition();
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].removed, false);

  click();
  assert.equal(button.classList.contains("is-active"), false);
  assert.equal(instances[0].removed, true);
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

test("location can be enabled again after disable", () => {
  const position = {
    coords: { longitude: 27.56, latitude: 53.9, accuracy: 25, heading: null }
  };
  const { api, map, button, instances, click } = createWiredController(position);

  click();
  click();
  assert.equal(instances[0].removed, true);
  assert.equal(map.flyToCalls.length, 1);

  click();
  assert.equal(button.classList.contains("is-active"), true);
  assert.equal(instances.length, 2);
  assert.equal(instances[1].removed, false);
  assert.ok(map.getSource(api.SOURCE_ID).data);
  assert.equal(map.flyToCalls.length, 2);
  assert.equal(map.easeToCalls.length, 0);
});
