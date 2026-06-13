const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  MAX_REASONABLE_DEPTH_M,
  parseDepth,
  validateDepthMap,
  validateAvailableDepthMaps
} = require("./helpers/depth-data-validation");

const root = path.join(__dirname, "..");
const registrySource = fs.readFileSync(
  path.join(root, "assets/js/map/depth-maps-registry.js"),
  "utf8"
);
const KNOWN_DEPTH_ANOMALIES = new Set(["valkovskoe"]);

function loadRegistry() {
  const window = {};
  vm.runInContext(registrySource, vm.createContext({ window, console }));
  return window.KlevbyDepthMapsRegistry;
}

test("depth parsing distinguishes numeric, missing, and suspicious invalid values", () => {
  assert.deepEqual(parseDepth(-4.5), { kind: "numeric", value: -4.5 });
  assert.deepEqual(parseDepth(" 12.5 "), { kind: "numeric", value: 12.5 });
  assert.deepEqual(parseDepth(null), { kind: "missing" });
  assert.deepEqual(parseDepth(" "), { kind: "missing" });
  assert.deepEqual(parseDepth("not-a-depth"), { kind: "invalid" });
  assert.deepEqual(parseDepth(Infinity), { kind: "invalid" });
  assert.equal(MAX_REASONABLE_DEPTH_M, 60);
});

test("unsupported geometry marks a depth map as needs_review", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(__dirname, "depth-validation-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(temporaryRoot, "unsupported.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { depth_m: -3 },
        geometry: { type: "GeometryCollection", geometries: [] }
      }]
    })
  );

  const summary = validateDepthMap(temporaryRoot, {
    id: "unsupported",
    waterBodyId: "unsupported",
    url: "unsupported.geojson",
    depthProperty: "depth_m"
  });

  assert.deepEqual(summary.geometryTypes, { GeometryCollection: 1 });
  assert.deepEqual(summary.unsupportedGeometryTypes, ["GeometryCollection"]);
  assert.equal(summary.suspiciousDepthCount, 0);
  assert.equal(summary.status, "needs_review");
});

test("all available depth maps have an explicit validation status", (t) => {
  const registry = loadRegistry();
  const availableMaps = registry.getAvailable();
  const report = validateAvailableDepthMaps(root, registry);

  assert.ok(availableMaps.length > 0);
  assert.equal(report.length, availableMaps.length);
  t.diagnostic(`Validated available depth maps: ${report.length}`);

  report.forEach((summary) => {
    const depthMap = registry.getById(summary.id);
    assert.ok(depthMap, summary.id);
    assert.equal(summary.waterBodyId, depthMap.waterBodyId, `${summary.id}.waterBodyId`);
    assert.equal(summary.featureCount, depthMap.featureCount, `${summary.id}.featureCount`);
    assert.equal(
      summary.numericDepthCount + summary.nullDepthCount + summary.invalidDepthCount,
      summary.featureCount,
      `${summary.id} depth counts`
    );
    assert.ok(summary.propertyKeys.includes(depthMap.depthProperty), `${summary.id}.depthProperty`);
    assert.ok(Object.keys(summary.geometryTypes).length > 0, `${summary.id}.geometryTypes`);
    assert.ok(Array.isArray(summary.unsupportedGeometryTypes));
    assert.ok(["ok", "needs_review", "no_numeric_depth"].includes(summary.status));
  });

  const needsReview = report
    .filter((summary) => summary.status === "needs_review")
    .map((summary) => summary.id);
  const knownAnomalies = report
    .filter((summary) => KNOWN_DEPTH_ANOMALIES.has(summary.id))
    .map((summary) => summary.id);
  const unexpectedAnomalies = needsReview.filter((id) => !KNOWN_DEPTH_ANOMALIES.has(id));

  assert.deepEqual(needsReview, ["valkovskoe"]);
  assert.deepEqual(knownAnomalies, ["valkovskoe"]);
  assert.deepEqual(unexpectedAnomalies, []);

  const valkovskoe = report.find((summary) => summary.id === "valkovskoe");
  assert.equal(valkovskoe.status, "needs_review");
  assert.ok(valkovskoe.suspiciousDepthCount > 0);
  assert.ok(valkovskoe.maxAbsDepth > MAX_REASONABLE_DEPTH_M);

  report
    .filter((summary) => !KNOWN_DEPTH_ANOMALIES.has(summary.id))
    .forEach((summary) => {
      assert.equal(summary.status, "ok", `${summary.id}.status`);
      assert.equal(summary.suspiciousDepthCount, 0, `${summary.id}.suspiciousDepthCount`);
      assert.deepEqual(
        summary.unsupportedGeometryTypes,
        [],
        `${summary.id}.unsupportedGeometryTypes`
      );
    });

  assert.deepEqual(valkovskoe.unsupportedGeometryTypes, []);

  t.diagnostic(`Depth data validation report:\n${JSON.stringify(report, null, 2)}`);
});
