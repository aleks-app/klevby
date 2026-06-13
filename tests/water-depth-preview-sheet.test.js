const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPreviewSheet(windowOverrides = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-depth-preview-sheet.js"),
    "utf8"
  );
  const window = { ...windowOverrides };
  const document = {
    addEventListener() {}
  };

  vm.runInContext(source, vm.createContext({ window, document, URL, console }), {
    filename: "water-depth-preview-sheet.js"
  });

  return window.KlevbyWaterDepthPreviewSheet;
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("normalizePoint keeps only display-safe preview values and supplies fallbacks", () => {
  const api = loadPreviewSheet();

  assert.deepEqual(toPlain(api.normalizePoint({
    id: 21,
    water_body_id: " zaslavskoe ",
    name: "  Озеро Нарочь  ",
    waterType: "озеро",
    region: { unsafe: true },
    district: "Мядельский район",
    source: "",
    sourceUrl: "https://example.com/naroch",
    quality: "точное совпадение",
    locationQuality: null,
    locationSource: ["unsafe"]
  })), {
    id: "21",
    waterBodyId: "zaslavskoe",
    name: "Озеро Нарочь",
    waterType: "озеро",
    region: "",
    district: "Мядельский район",
    source: "Источник не указан",
    sourceUrl: "https://example.com/naroch",
    quality: "точное совпадение",
    locationQuality: "Не указано",
    locationSource: ""
  });
});

test("bottom sheet uses the internal water body CTA and exposes source as trust text only", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-depth-preview-sheet.js"),
    "utf8"
  );

  assert.match(source, />Открыть водоём<\/button>/);
  assert.match(source, /depthStatus\.label/);
  assert.doesNotMatch(source, /`Источник: \${point\.source}`/);
  assert.doesNotMatch(source, /water-depth-preview-source-link/);
  assert.doesNotMatch(source, /target="_blank"/);
  assert.match(source, /KlevbyWaterBodyDetail\.open\(selectedPoint\)/);
});

test("preview status helper reads available depth metadata from the registry", () => {
  const api = loadPreviewSheet({
    KlevbyDepthMapsRegistry: {
      getByWaterBodyId(id) {
        return id === "zvon"
          ? { id: "zvon", waterBodyId: "zvon", status: "available", format: "geojson", maxDepth: 18 }
          : null;
      }
    }
  });

  const status = toPlain(api.getDepthMapStatusForWaterBody("zvon"));
  assert.equal(status.available, true);
  assert.equal(status.label, "Карта глубин доступна");
  assert.equal(status.maxDepth, 18);
  assert.equal(status.depthMapId, "zvon");
  assert.equal(status.waterBodyId, "zvon");
  assert.equal(api.getDepthMapStatusForWaterBody("unknown").status, "unavailable");
});
