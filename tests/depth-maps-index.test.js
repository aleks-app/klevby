const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const registrySource = fs.readFileSync(
  path.join(root, "assets/js/map/depth-maps-registry.js"),
  "utf8"
);

function loadRegistry() {
  const window = { fetch: async () => { throw new Error("index must not fetch"); } };
  vm.runInContext(registrySource, vm.createContext({
    window,
    document: { getElementById() { return null; } },
    console
  }));
  return window.KlevbyDepthMapsRegistry;
}

test("depth maps registry exposes the current available maps", () => {
  const registry = loadRegistry();
  assert.ok(registry);
  assert.equal(registry.maps.length, 9);
  assert.equal(registry.getAll(), registry.maps);
  assert.equal(registry.getAvailable().length, 9);
  assert.equal(registry.getById("zvon").name, "Звонь");
  assert.equal(registry.getById("unknown"), null);
  assert.equal(registry.getByWaterBodyId("zvon").name, "Звонь");
  assert.equal(registry.hasAvailableDepthMap("zvon"), true);
  assert.equal(registry.getByWaterBodyId("unknown"), null);
});

test("registry maps point to valid local FeatureCollections", () => {
  const maps = JSON.parse(JSON.stringify(loadRegistry().getAvailable()));
  assert.equal(maps.length, 9);

  maps.forEach((depthMap) => {
    ["id", "name", "url", "center", "bbox", "featureCount"].forEach((field) => {
      assert.notEqual(depthMap[field], undefined, `${depthMap.id}.${field}`);
    });
    assert.equal(depthMap.center.length, 2);
    assert.equal(depthMap.bbox.length, 4);
    assert.ok(depthMap.center.every(Number.isFinite));
    const filename = path.join(root, depthMap.url);
    assert.equal(fs.existsSync(filename), true, depthMap.url);
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.equal(data.type, "FeatureCollection", depthMap.url);
    assert.ok(data.features.length > 0, depthMap.url);
    assert.equal(data.features.length, depthMap.featureCount, depthMap.url);
  });
});
