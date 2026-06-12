const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const mapLogic = fs.readFileSync(path.join(__dirname, "../assets/js/map-logic.js"), "utf8");
const vendorScript = fs.readFileSync(path.join(__dirname, "../scripts/vendor-maplibre.mjs"), "utf8");

test("MapLibre loader tries pinned local app assets before the remote fallback", () => {
  assert.match(mapLogic, /const MAPLIBRE_VERSION = "5\.24\.0"/);
  assert.match(mapLogic, /assets\/vendor\/maplibre-gl\/\$\{MAPLIBRE_VERSION\}/);
  assert.ok(mapLogic.indexOf('{ source: "local"') < mapLogic.indexOf('{ source: "remote-fallback"'));
  assert.match(mapLogic, /loadMapLibreAssetWithFallback\("script", MAPLIBRE_SCRIPT_SOURCES, providerConfig\)/);
  assert.match(mapLogic, /loadMapLibreAssetWithFallback\("stylesheet", MAPLIBRE_STYLESHEET_SOURCES, providerConfig\)/);
});

test("Android preparation vendors the same pinned MapLibre release", () => {
  assert.match(vendorScript, /const version = '5\.24\.0'/);
  assert.match(vendorScript, /maplibre-gl\.js/);
  assert.match(vendorScript, /maplibre-gl\.css/);

  const packageJson = require("../package.json");
  assert.match(packageJson.scripts["prepare:android"], /^npm run vendor:maplibre &&/);
});

function loadDiagnosticHelpers(logs = []) {
  const instrumentedMapLogic = mapLogic.replace(
    /\}\)\(\);\s*$/,
    `window.__mapDiagnosticTestHelpers = {
      buildMapDiagnostic,
      getMapTilerStyleUrl,
      getSanitizedUrlText,
      redactDiagnosticText
    };\n})();`
  );
  const window = {
    location: {
      href: "https://localhost/assets/index.html",
      origin: "https://localhost",
      protocol: "https:",
      pathname: "/assets/index.html"
    },
    addEventListener() {}
  };
  const sandbox = {
    window,
    URL,
    console: {
      info(...args) { logs.push(args); },
      warn(...args) { logs.push(args); },
      error(...args) { logs.push(args); },
      log(...args) { logs.push(args); }
    }
  };

  vm.runInNewContext(instrumentedMapLogic, sandbox);
  return window.__mapDiagnosticTestHelpers;
}

test("Map diagnostics expose the important stages", () => {
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
});

test("plain string MapLibre diagnostics include stage, message, nested details, and sanitized URLs", () => {
  const helpers = loadDiagnosticHelpers();
  const key = "maptiler-super-secret-key";
  const error = new Error(`Style request failed: https://api.maptiler.com/maps/demo/style.json?key=${key}`);
  error.name = "AJAXError";
  error.status = 401;
  error.statusText = "Unauthorized";
  error.url = `https://api.maptiler.com/maps/demo/style.json?key=${key}&session=private`;
  error.source = { id: "maptiler-streets" };
  error.tile = { url: `https://api.maptiler.com/tiles/12/1/2.pbf?key=${key}` };
  const event = { error };
  event.circular = event;

  const diagnostic = helpers.buildMapDiagnostic("map error before load", {
    provider: "maplibre",
    styleUrl: `https://api.maptiler.com/maps/demo/style.json?key=${key}`,
    eventOrError: event,
    error,
    secrets: [key]
  });

  assert.equal(typeof diagnostic, "string");
  assert.match(diagnostic, /stage="map error before load"/);
  assert.match(diagnostic, /provider="maplibre"/);
  assert.match(diagnostic, /runtimeOrigin="https:\/\/localhost"/);
  assert.match(diagnostic, /runtimeProtocol="https:"/);
  assert.match(diagnostic, /errorName="AJAXError"/);
  assert.match(diagnostic, /errorMessage="Style request failed:/);
  assert.match(diagnostic, /httpStatus="401"/);
  assert.match(diagnostic, /httpStatusText="Unauthorized"/);
  assert.match(diagnostic, /sourceId="maptiler-streets"/);
  assert.match(diagnostic, /tile="https:\/\/api\.maptiler\.com\/tiles\/12\/1\/2\.pbf"/);
  assert.match(diagnostic, /style="https:\/\/api\.maptiler\.com\/maps\/demo\/style\.json"/);
  assert.doesNotMatch(diagnostic, /\?key=|session=private/);
  assert.doesNotMatch(diagnostic, new RegExp(key));
});

test("MapTiler style construction logs one plain diagnostic string without the full key", () => {
  const logs = [];
  const helpers = loadDiagnosticHelpers(logs);
  const key = "another-full-maptiler-key";
  const styleUrl = helpers.getMapTilerStyleUrl(
    "https://api.maptiler.com/maps/streets-v2-dark/style.json",
    key
  );

  assert.match(styleUrl, new RegExp(key));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].length, 1);
  assert.equal(typeof logs[0][0], "string");
  assert.match(logs[0][0], /stage="MapTiler style URL constructed"/);
  assert.match(logs[0][0], /errorMessage="MapTiler style URL is ready"/);
  assert.match(logs[0][0], /style="https:\/\/api\.maptiler\.com\/maps\/streets-v2-dark\/style\.json"/);
  assert.doesNotMatch(logs[0][0], new RegExp(key));
});

test("diagnostic text redacts key aliases and explicit raw or encoded secrets", () => {
  const helpers = loadDiagnosticHelpers();
  const key = "secret/value+with spaces";
  const text = helpers.redactDiagnosticText(
    `raw=${key} encoded=${encodeURIComponent(key)} url=https://example.com/style?api_key=${encodeURIComponent(key)}&x=1`,
    [key]
  );

  assert.doesNotMatch(text, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(text, new RegExp(encodeURIComponent(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(text, /api_key=|\?api_key=|&x=1/);
});
