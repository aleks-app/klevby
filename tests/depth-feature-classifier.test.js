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
const classifierSource = fs.readFileSync(
  path.join(root, "assets/js/map/depth-feature-classifier.js"),
  "utf8"
);

function loadDepthFoundation() {
  const window = {};
  const context = vm.createContext({ window, console });
  vm.runInContext(registrySource, context, { filename: "depth-maps-registry.js" });
  vm.runInContext(classifierSource, context, { filename: "depth-feature-classifier.js" });
  return {
    registry: window.KlevbyDepthMapsRegistry,
    classifier: window.KlevbyDepthFeatureClassifier
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parseDepthMeters distinguishes numeric, missing, and invalid values", () => {
  const { classifier } = loadDepthFoundation();

  assert.deepEqual(plain(classifier.parseDepthMeters(-4.5)), { kind: "numeric", value: -4.5 });
  assert.deepEqual(plain(classifier.parseDepthMeters(" 12.5 ")), { kind: "numeric", value: 12.5 });
  assert.deepEqual(plain(classifier.parseDepthMeters(null)), { kind: "missing" });
  assert.deepEqual(plain(classifier.parseDepthMeters(undefined)), { kind: "missing" });
  assert.deepEqual(plain(classifier.parseDepthMeters(" ")), { kind: "missing" });
  assert.deepEqual(plain(classifier.parseDepthMeters("not-a-depth")), { kind: "invalid" });
  assert.deepEqual(plain(classifier.parseDepthMeters(Infinity)), { kind: "invalid" });
});

test("getDepthStats counts numeric depths, absolute maximum, and geometry types", () => {
  const { classifier } = loadDepthFoundation();
  const stats = classifier.getDepthStats({
    type: "FeatureCollection",
    features: [
      { properties: { depth_m: -2 }, geometry: { type: "Point" } },
      { properties: { depth_m: "8" }, geometry: { type: "Polygon" } },
      { properties: { depth_m: null }, geometry: { type: "LineString" } },
      { properties: { depth_m: "bad" }, geometry: null }
    ]
  }, "depth_m");

  assert.equal(stats.featureCount, 4);
  assert.equal(stats.numericDepthCount, 2);
  assert.equal(stats.missingDepthCount, 1);
  assert.equal(stats.invalidDepthCount, 1);
  assert.equal(stats.minDepth, -2);
  assert.equal(stats.maxDepth, 8);
  assert.equal(stats.maxAbsDepth, 8);
  assert.deepEqual(plain(stats.geometryTypes), {
    Point: 1,
    Polygon: 1,
    LineString: 1,
    Missing: 1
  });
});

test("thresholds use registry metadata for ok maps and disable needs_review maps", () => {
  const { classifier } = loadDepthFoundation();
  const enabled = classifier.getDepthThresholds(
    { validationStatus: "ok", maxDepth: 20 },
    { maxAbsDepth: 12 }
  );
  const disabled = classifier.getDepthThresholds(
    { validationStatus: "needs_review", maxDepth: 20 },
    { maxAbsDepth: 12 }
  );

  assert.equal(enabled.classificationEnabled, true);
  assert.equal(enabled.effectiveMaxDepth, 20);
  assert.equal(enabled.effectiveMaxDepthSource, "registry");
  assert.equal(enabled.shallowMaxDepth, 5);
  assert.equal(enabled.deepMinDepth, 11);
  assert.ok(Math.abs(enabled.veryDeepMinDepth - 15.6) < Number.EPSILON * 100);
  assert.equal(disabled.classificationEnabled, false);
  assert.equal(disabled.reason, "validation_status_not_ok");
});

test("thresholds safely fall back to reasonable observed max depth", () => {
  const { classifier } = loadDepthFoundation();

  const fallback = classifier.getDepthThresholds(
    { validationStatus: "ok" },
    { maxAbsDepth: 10 }
  );
  const unreasonable = classifier.getDepthThresholds(
    { validationStatus: "ok" },
    { maxAbsDepth: classifier.MAX_REASONABLE_DEPTH_M + 1 }
  );

  assert.equal(fallback.classificationEnabled, true);
  assert.equal(fallback.effectiveMaxDepth, 10);
  assert.equal(fallback.effectiveMaxDepthSource, "stats");
  assert.equal(unreasonable.classificationEnabled, false);
  assert.equal(unreasonable.reason, "no_reasonable_max_depth");
});

test("classifyDepthValue assigns shallow, mid, deep, and very_deep bands", () => {
  const { classifier } = loadDepthFoundation();
  const thresholds = classifier.getDepthThresholds(
    { validationStatus: "ok", maxDepth: 20 },
    { maxAbsDepth: 20 }
  );

  assert.equal(classifier.classifyDepthValue(3, thresholds), "shallow");
  assert.equal(classifier.classifyDepthValue(7, thresholds), "mid");
  assert.equal(classifier.classifyDepthValue(12, thresholds), "deep");
  assert.equal(classifier.classifyDepthValue(18, thresholds), "very_deep");
  assert.equal(classifier.classifyDepthValue(-18, thresholds), "very_deep");
});

test("candidate flags are limited to shallow/very-deep Point and Polygon features", () => {
  const { classifier } = loadDepthFoundation();
  const depthMap = { validationStatus: "ok", depthProperty: "depth_m", maxDepth: 20 };
  const thresholds = classifier.getDepthThresholds(depthMap, { maxAbsDepth: 20 });
  const feature = (depth, type) => ({
    properties: { depth_m: depth },
    geometry: { type }
  });

  assert.equal(classifier.classifyDepthFeature(feature(18, "Point"), depthMap, thresholds).pitCandidate, true);
  assert.equal(classifier.classifyDepthFeature(feature(18, "Polygon"), depthMap, thresholds).pitCandidate, true);
  assert.equal(classifier.classifyDepthFeature(feature(18, "LineString"), depthMap, thresholds).pitCandidate, false);
  assert.equal(classifier.classifyDepthFeature(feature(2, "Point"), depthMap, thresholds).shoalCandidate, true);
  assert.equal(classifier.classifyDepthFeature(feature(2, "Polygon"), depthMap, thresholds).shoalCandidate, true);
  assert.equal(classifier.classifyDepthFeature(feature(2, "LineString"), depthMap, thresholds).shoalCandidate, false);
});

test("current validated maps receive bands while Valkovskoe is skipped", (t) => {
  const { registry, classifier } = loadDepthFoundation();
  const reports = registry.getAvailable().map((depthMap) => {
    const featureCollection = JSON.parse(
      fs.readFileSync(path.join(root, depthMap.url), "utf8")
    );
    return classifier.analyzeDepthFeatureCollection(featureCollection, depthMap);
  });

  reports.forEach((report) => {
    const depthMap = registry.getById(report.mapId);
    assert.ok(report.stats.numericDepthCount > 0, `${report.mapId}.numericDepthCount`);

    if (depthMap.validationStatus === "needs_review") {
      assert.equal(report.classificationEnabled, false, report.mapId);
      assert.equal(report.reason, "validation_status_not_ok", report.mapId);
      assert.deepEqual(plain(report.bandCounts), {
        shallow: 0,
        mid: 0,
        deep: 0,
        very_deep: 0
      });
      return;
    }

    assert.equal(report.classificationEnabled, true, report.mapId);
    assert.equal(
      Object.values(report.bandCounts).reduce((total, count) => total + count, 0),
      report.stats.numericDepthCount,
      `${report.mapId}.bandCounts`
    );
    assert.ok(report.candidateCounts.pit_candidate >= 0, `${report.mapId}.pit_candidate`);
    assert.ok(report.candidateCounts.shoal_candidate >= 0, `${report.mapId}.shoal_candidate`);
  });

  const expectedEnabledMaps = registry.getAvailable()
    .filter((depthMap) => depthMap.validationStatus === "ok")
    .map((depthMap) => depthMap.id);
  const expectedSkippedMaps = registry.getAvailable()
    .filter((depthMap) => depthMap.validationStatus !== "ok")
    .map((depthMap) => depthMap.id);
  const enabled = reports.filter((report) => report.classificationEnabled);
  const skipped = reports.filter((report) => !report.classificationEnabled);
  assert.deepEqual(
    plain(enabled.map((report) => report.mapId)),
    plain(expectedEnabledMaps)
  );
  assert.deepEqual(
    plain(skipped.map((report) => report.mapId)),
    plain(expectedSkippedMaps)
  );
  assert.ok(expectedSkippedMaps.includes("valkovskoe"));
  t.diagnostic(`Depth classification report:\n${JSON.stringify(reports, null, 2)}`);
});

test("index loads the classifier between registry and depth layer with isolated cache bust", () => {
  const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const registryScript = "assets/js/map/depth-maps-registry.js?v=20260613-depth-zoom-style-pr7-1";
  const classifierScript = "assets/js/map/depth-feature-classifier.js?v=20260613-depth-feature-classifier-pr9-1";
  const layerScript = "assets/js/map/water-depth-contours-layer.js?v=20260613-depth-valkovskoe-hide-bad-labels-pr12-1";

  assert.ok(indexSource.indexOf(registryScript) < indexSource.indexOf(classifierScript));
  assert.ok(indexSource.indexOf(classifierScript) < indexSource.indexOf(layerScript));
});
