const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPreviewSheet() {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-depth-preview-sheet.js"),
    "utf8"
  );
  const window = {};
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
