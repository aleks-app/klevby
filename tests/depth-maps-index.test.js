const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "assets/js/map/water-depth-contours-layer.js"),
  "utf8"
);

test("DEPTH_MAPS points to valid non-empty local FeatureCollections", () => {
  const window = { fetch: async () => { throw new Error("index must not fetch"); } };
  vm.runInContext(source, vm.createContext({
    window,
    document: { getElementById() { return null; } },
    console
  }));

  const maps = JSON.parse(JSON.stringify(window.KlevbyWaterDepthContoursLayer.DEPTH_MAPS));
  assert.equal(maps.length, 9);

  maps.forEach((depthMap) => {
    assert.equal(depthMap.center.length, 2);
    assert.ok(depthMap.center.every(Number.isFinite));
    const filename = path.join(root, depthMap.url);
    assert.equal(fs.existsSync(filename), true, depthMap.url);
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.equal(data.type, "FeatureCollection", depthMap.url);
    assert.ok(data.features.length > 0, depthMap.url);
    assert.equal(data.features.length, depthMap.featureCount, depthMap.url);
  });
});
