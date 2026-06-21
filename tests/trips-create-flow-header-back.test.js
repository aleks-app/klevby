const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const createFlowOwnerPath = path.join(root, "assets/js/app/app-trips-create-flow-owner.js");
const appJsPath = path.join(root, "assets/js/app.js");

test("trips create flow owner exposes isOpen", () => {
  const source = fs.readFileSync(createFlowOwnerPath, "utf8");

  assert.match(source, /isOpen\(\)\s*\{[\s\S]*return isOpen;/);
});

test("header back button closes open trips create flow before navigating away", () => {
  const source = fs.readFileSync(appJsPath, "utf8");

  assert.match(source, /KlevbyTripsCreateFlowOwner\?\.isOpen/);
  assert.match(source, /KlevbyTripsCreateFlowOwner\.isOpen\(\)/);
  assert.match(source, /KlevbyTripsCreateFlowOwner\.close\(\)/);
  assert.match(source, /showSection\(returnsToMap \? "map" : "home"\)/);
});

test("create flow open resets to step 1", () => {
  const source = fs.readFileSync(createFlowOwnerPath, "utf8");

  assert.match(source, /function open\(\)\s*\{[\s\S]*step = 1;/);
  assert.match(source, /function close\(\)\s*\{[\s\S]*isOpen = false;/);
});
