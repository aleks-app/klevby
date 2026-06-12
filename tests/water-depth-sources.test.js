const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadWaterDepthSources(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/supabase/water-depth-sources.js"),
    "utf8"
  );
  const warnings = [];
  const info = [];
  const window = {
    supabaseClient: options.supabaseClient || null,
    KLEVB_WATER_DEPTH_DEBUG: Boolean(options.debug)
  };
  const context = vm.createContext({
    window,
    Intl,
    Map,
    console: {
      warn: (...args) => warnings.push(args),
      info: (...args) => info.push(args)
    }
  });

  vm.runInContext(source, context, { filename: "water-depth-sources.js" });

  return {
    api: window.KlevbyWaterDepthSources,
    warnings,
    info
  };
}

function createSupabaseResult(result, calls) {
  return {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                async order(columnName, options) {
                  calls.push(["order", columnName, options]);
                  return result;
                }
              };
            }
          };
        }
      };
    }
  };
}

test("fetchWaterDepthSources filters the query and sorts by quality then name", async () => {
  const calls = [];
  const rows = [
    { id: 1, name: "Ясное", quality: "похоже" },
    { id: 2, name: "Боровое", quality: "точное совпадение" },
    { id: 3, name: "Альфа", quality: "другое" },
    { id: 4, name: "Аист", quality: "точное совпадение" }
  ];
  const supabaseClient = createSupabaseResult({ data: rows, error: null }, calls);
  const { api, warnings } = loadWaterDepthSources({ supabaseClient });

  const result = await api.fetchWaterDepthSources();

  assert.deepEqual(Array.from(result, (row) => row.id), [4, 2, 1, 3]);
  assert.deepEqual(calls[0], ["from", "water_depth_sources"]);
  assert.deepEqual(calls[2], ["eq", "has_depth_map", "найдено"]);
  assert.equal(calls[3][0], "order");
  assert.equal(calls[3][1], "name");
  assert.equal(calls[3][2].ascending, true);
  assert.equal(warnings.length, 0);
});

test("fetchWaterDepthSources returns an empty array and warns on a query error", async () => {
  const supabaseClient = createSupabaseResult(
    { data: null, error: new Error("request failed") },
    []
  );
  const { api, warnings } = loadWaterDepthSources({ supabaseClient });

  const result = await api.fetchWaterDepthSources();

  assert.deepEqual(Array.from(result), []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /fetch failed/);
});

test("fetchWaterDepthSources emits the row count only when debug logging is enabled", async () => {
  const supabaseClient = createSupabaseResult(
    { data: [{ id: 1, name: "Озеро", quality: "похоже" }], error: null },
    []
  );
  const { api, info } = loadWaterDepthSources({ supabaseClient, debug: true });

  await api.fetchWaterDepthSources();

  assert.equal(info.length, 1);
  assert.match(info[0][0], /loaded 1 rows/);
});
