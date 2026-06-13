const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadWaterDepthMapSources(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-depth-map-sources.js"),
    "utf8"
  );
  const warnings = [];
  const info = [];
  const window = {
    KlevbyWaterDepthSources: options.reader,
    KLEVB_WATER_DEPTH_DEBUG: Boolean(options.debug)
  };
  const context = vm.createContext({
    window,
    console: {
      warn: (...args) => warnings.push(args),
      info: (...args) => info.push(args)
    }
  });

  vm.runInContext(source, context, { filename: "water-depth-map-sources.js" });

  return {
    api: window.KlevbyWaterDepthMapSources,
    warnings,
    info
  };
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("normalizeWaterDepthMapSources returns an empty array for empty or invalid input", () => {
  const { api } = loadWaterDepthMapSources();

  assert.deepEqual(Array.from(api.normalizeWaterDepthMapSources()), []);
  assert.deepEqual(Array.from(api.normalizeWaterDepthMapSources(null)), []);
  assert.deepEqual(Array.from(api.normalizeWaterDepthMapSources({})), []);
  assert.deepEqual(Array.from(api.normalizeWaterDepthMapSources([])), []);
});

test("normalizeWaterDepthMapSources converts a raw row to the map-ready shape", () => {
  const { api } = loadWaterDepthMapSources();
  const rows = api.normalizeWaterDepthMapSources([
    {
      id: 17,
      name: "  Озеро Нарочь ",
      water_type: " озеро ",
      region: "Минская область",
      district: "Мядельский район",
      latitude: 54.85,
      longitude: 26.97,
      location_quality: " примерно ",
      location_source: " ручная проверка ",
      location_checked_at: "2026-06-11",
      source: "Госводкадастр",
      source_url: " https://example.com/naroch ",
      usage_rule: "С указанием источника",
      quality: "точное совпадение",
      comment: "Проверено вручную",
      checked_at: "2026-06-10"
    }
  ]);

  assert.deepEqual(toPlain(rows), [
    {
      id: 17,
      waterBodyId: "",
      name: "Озеро Нарочь",
      waterType: "озеро",
      region: "Минская область",
      district: "Мядельский район",
      latitude: 54.85,
      longitude: 26.97,
      locationQuality: "примерно",
      locationSource: "ручная проверка",
      locationCheckedAt: "2026-06-11",
      source: "Госводкадастр",
      sourceUrl: "https://example.com/naroch",
      usageRule: "С указанием источника",
      quality: "точное совпадение",
      comment: "Проверено вручную",
      checkedAt: "2026-06-10",
      hasCoordinates: true
    }
  ]);
});

test("normalizeWaterDepthMapSources maps only Zaslavskoe aliases to the local contour id", () => {
  const { api } = loadWaterDepthMapSources();
  const rows = api.normalizeWaterDepthMapSources([
    { id: 31, name: "Заславское водохранилище", source_url: "https://example.com/zaslavskoe" },
    { id: 32, name: " Минское море ", source_url: "https://example.com/minsk-sea" },
    { id: 33, name: "Вилейское водохранилище", source_url: "https://example.com/vileyka" }
  ]);

  assert.deepEqual(Array.from(rows, (row) => row.waterBodyId), [
    "zaslavskoe",
    "zaslavskoe",
    ""
  ]);
});

test("normalizeWaterDepthMapSources preserves an explicit canonical water body id", () => {
  const { api } = loadWaterDepthMapSources();
  const [row] = api.normalizeWaterDepthMapSources([
    {
      id: 34,
      water_body_id: " canonical-id ",
      name: "Минское море",
      source_url: "https://example.com/minsk-sea"
    }
  ]);

  assert.equal(row.waterBodyId, "canonical-id");
});

test("normalizeWaterDepthMapSources clears missing or invalid coordinate pairs", () => {
  const { api } = loadWaterDepthMapSources();
  const rows = api.normalizeWaterDepthMapSources([
    {
      id: 1,
      name: "Missing longitude",
      source_url: "https://example.com/one",
      latitude: 53.9,
      longitude: null
    },
    {
      id: 2,
      name: "Invalid latitude",
      source_url: "https://example.com/two",
      latitude: "53.9",
      longitude: 27.56
    },
    {
      id: 3,
      name: "Infinite longitude",
      source_url: "https://example.com/three",
      latitude: 53.9,
      longitude: Infinity
    }
  ]);

  assert.deepEqual(
    toPlain(rows.map(({ id, latitude, longitude, hasCoordinates }) => ({
      id,
      latitude,
      longitude,
      hasCoordinates
    }))),
    [
      { id: 1, latitude: null, longitude: null, hasCoordinates: false },
      { id: 2, latitude: null, longitude: null, hasCoordinates: false },
      { id: 3, latitude: null, longitude: null, hasCoordinates: false }
    ]
  );
});

test("normalizeWaterDepthMapSources skips broken rows", () => {
  const { api } = loadWaterDepthMapSources();
  const rows = api.normalizeWaterDepthMapSources([
    null,
    "not a row",
    { id: 1, name: "", source_url: "https://example.com/one" },
    { id: 2, name: "Река", source_url: "  " },
    { id: 3, name: "Озеро", source_url: "https://example.com/three" }
  ]);

  assert.deepEqual(Array.from(rows, (row) => row.id), [3]);
});

test("getWaterDepthMapSources returns normalized rows from the shared reader", async () => {
  let fetchCalls = 0;
  const reader = {
    async fetchWaterDepthSources() {
      fetchCalls += 1;
      return [
        {
          id: "source-1",
          name: "Вилейское водохранилище",
          source_url: "https://example.com/vileyka",
          water_type: "водохранилище"
        },
        { id: "broken", name: "Без ссылки", source_url: null }
      ];
    }
  };
  const { api } = loadWaterDepthMapSources({ reader });

  const rows = await api.getWaterDepthMapSources();

  assert.equal(fetchCalls, 1);
  assert.deepEqual(toPlain(rows), [
    {
      id: "source-1",
      waterBodyId: "",
      name: "Вилейское водохранилище",
      waterType: "водохранилище",
      region: "",
      district: "",
      latitude: null,
      longitude: null,
      locationQuality: "",
      locationSource: "",
      locationCheckedAt: "",
      source: "",
      sourceUrl: "https://example.com/vileyka",
      usageRule: "",
      quality: "",
      comment: "",
      checkedAt: "",
      hasCoordinates: false
    }
  ]);
});

test("getWaterDepthMapSources returns an empty array when the reader is unavailable or fails", async () => {
  const unavailable = loadWaterDepthMapSources();
  const failing = loadWaterDepthMapSources({
    reader: {
      async fetchWaterDepthSources() {
        throw new Error("reader failed");
      }
    }
  });

  assert.deepEqual(Array.from(await unavailable.api.getWaterDepthMapSources()), []);
  assert.deepEqual(Array.from(await failing.api.getWaterDepthMapSources()), []);
  assert.equal(failing.warnings.length, 1);
  assert.match(failing.warnings[0][0], /fetch failed/);
});

test("getWaterDepthMapSources diagnostics are opt-in", async () => {
  const reader = {
    async fetchWaterDepthSources() {
      return [{ id: 1, name: "Озеро", source_url: "https://example.com/lake" }];
    }
  };
  const disabled = loadWaterDepthMapSources({ reader });
  const enabled = loadWaterDepthMapSources({ reader, debug: true });

  await disabled.api.getWaterDepthMapSources();
  await enabled.api.getWaterDepthMapSources();

  assert.equal(disabled.info.length, 0);
  assert.equal(enabled.info.length, 2);
  assert.match(enabled.info[0][0], /raw rows loaded/);
  assert.match(enabled.info[1][0], /normalized map-ready rows/);
});
