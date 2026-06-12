const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("app navigation registers and detects the water body detail section", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/app/app-navigation.js"),
    "utf8"
  );
  const sections = new Map();
  [
    "homeSection",
    "feedSection",
    "tripsSection",
    "createSection",
    "marketSection",
    "pondsSection",
    "mapSection",
    "waterBodyDetailSection",
    "authSection",
    "profileSection"
  ].forEach((id) => {
    sections.set(id, { classList: { contains: () => id !== "waterBodyDetailSection", toggle() {} } });
  });
  const document = {
    getElementById(id) {
      return sections.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    documentElement: { setAttribute() {} },
    body: { setAttribute() {} }
  };
  const window = {};

  vm.runInContext(source, vm.createContext({ window, document, sessionStorage: { removeItem() {} }, console }), {
    filename: "app-navigation.js"
  });

  assert.ok(window.KlevbyAppNavigation.getAppSections().includes("waterBodyDetailSection"));
  assert.equal(window.KlevbyAppNavigation.getVisibleSectionName(), "water-body-detail");
});

test("showSection gives water body detail dedicated header chrome and map back behavior", () => {
  const source = fs.readFileSync(path.join(__dirname, "../assets/js/app.js"), "utf8");

  assert.match(source, /data-water-body-detail/);
  assert.match(source, /safeSection === "water-body-detail" \? "true" : "false"/);
  assert.match(source, /const returnsToMap = safeSection === "water-body-detail"/);
  assert.match(source, /showSection\(returnsToMap \? "map" : "home"\)/);
});
