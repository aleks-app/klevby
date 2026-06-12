const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");
const vendorScript = fs.readFileSync(path.join(__dirname, "../scripts/vendor-maplibre.mjs"), "utf8");

test("MapLibre loader tries pinned local app assets before the remote fallback", () => {
  assert.match(mapLogic, /const MAPLIBRE_VERSION = "5\.24\.0"/);
  assert.match(mapLogic, /assets\/vendor\/maplibre-gl\/\$\{MAPLIBRE_VERSION\}/);
  assert.ok(mapLogic.indexOf('{ source: "local"') < mapLogic.indexOf('{ source: "remote-fallback"'));
  assert.match(mapLogic, /loadMapLibreAssetWithFallback\("script", MAPLIBRE_SCRIPT_SOURCES\)/);
  assert.match(mapLogic, /loadMapLibreAssetWithFallback\("stylesheet", MAPLIBRE_STYLESHEET_SOURCES\)/);
});

test("Android preparation vendors the same pinned MapLibre release", () => {
  assert.match(vendorScript, /const version = '5\.24\.0'/);
  assert.match(vendorScript, /maplibre-gl\.js/);
  assert.match(vendorScript, /maplibre-gl\.css/);

  const packageJson = require("../package.json");
  assert.match(packageJson.scripts["prepare:android"], /^npm run vendor:maplibre &&/);
});

test("Map diagnostics expose stages but redact MapTiler key query values", () => {
  for (const stage of [
    "provider config resolved",
    "runtime location",
    "MapLibre asset load start",
    "MapLibre asset load success",
    "MapLibre asset load failure",
    "MapTiler style URL constructed",
    "map constructor start",
    "map load success",
    "map error before load",
    "fallback to Yandex"
  ]) {
    assert.ok(mapLogic.includes(stage), `missing diagnostic stage: ${stage}`);
  }

  assert.match(mapLogic, /replace\(\/\(\[\?&\]key=\)\[\^&\\s"'\]\+\/gi, "\$1\[redacted\]"\)/);
  assert.doesNotMatch(mapLogic, /console\.(?:log|info|warn|error)\([^\n]*maptilerKey\b/);
});
