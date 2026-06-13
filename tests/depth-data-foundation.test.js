const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8"));
}

test("water-body seed contains draft KlevGo-owned records with the required fields", () => {
  const rows = readJson("assets/data/water-bodies/water-bodies.seed.json");
  const requiredFields = [
    "id",
    "name",
    "type",
    "region",
    "district",
    "area_sq_km",
    "max_depth_m",
    "avg_depth_m",
    "latitude",
    "longitude",
    "status",
    "source_status",
    "updated_at"
  ];

  assert.ok(Array.isArray(rows));
  assert.ok(rows.length > 0);

  for (const row of rows) {
    assert.deepEqual(Object.keys(row), requiredFields);
    assert.equal(row.status, "draft");
    assert.equal(row.source_status, "draft");
    assert.match(row.updated_at, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("Zaslavskoe draft contours are a labeled GeoJSON FeatureCollection", () => {
  const collection = readJson("assets/data/depth-contours/zaslavskoe.draft.geojson");

  assert.equal(collection.type, "FeatureCollection");
  assert.ok(Array.isArray(collection.features));
  assert.ok(collection.features.length > 0);

  const geometryTypes = new Set();
  const depths = [];

  for (const feature of collection.features) {
    assert.equal(feature.type, "Feature");
    assert.equal(feature.properties.water_body_id, "zaslavskoe");
    assert.ok(["zone", "isobath"].includes(feature.properties.depth_type));
    assert.equal(feature.properties.accuracy, "draft");
    assert.equal(feature.properties.source_status, "draft");
    assert.equal(feature.properties.checked_at, null);
    assert.equal(feature.properties.comment, "Черновая схема глубин KlevGo. Данные уточняются.");
    assert.equal(typeof feature.properties.depth_m, "number");
    assert.equal(typeof feature.properties.depth_range, "string");
    assert.ok(feature.geometry);

    geometryTypes.add(feature.geometry.type);
    depths.push(feature.properties.depth_m);

    if (feature.properties.depth_type === "zone") {
      assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
    } else {
      assert.equal(feature.geometry.type, "LineString");
    }
  }

  assert.ok(geometryTypes.has("Polygon") || geometryTypes.has("MultiPolygon"));
  assert.ok(depths.some((depth) => depth <= 2));
  assert.ok(depths.some((depth) => depth >= 5 && depth < 10));
  assert.ok(depths.some((depth) => depth >= 10));
});
