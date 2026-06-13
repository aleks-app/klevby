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
  assert.match(mapLogic, /data-map-action="location" aria-pressed="false"/);
  assert.match(mapLogic, /data-map-action="depths" aria-pressed="false"/);
  assert.match(mapLogic, /KlevbyMapUserLocation\.createController/);
});
