const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");
const indexPath = path.join(root, "index.html");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("Home grid contract is enabled by the Home owner, not static markup", () => {
  const owner = read(homeOwnerPath);
  const index = read(indexPath);

  assert.match(owner, /HOME_GRID_CONTRACT_ENABLED\s*=\s*true/);
  assert.match(owner, /HOME_LAYOUT_ATTRIBUTE\s*=\s*"data-home-layout"/);
  assert.match(owner, /homeSection\.setAttribute\(HOME_LAYOUT_ATTRIBUTE, HOME_LAYOUT_GRID_VALUE\)/);
  assert.doesNotMatch(index, /data-home-layout=["']grid["']/);
});

test("Home grid contract keeps the legacy lower-fill token as retired diagnostic output", () => {
  const owner = read(homeOwnerPath);

  assert.match(owner, /HOME_SOLVER_RETIREMENT_ENABLED\s*=\s*true/);
  assert.match(owner, /resolveHomeRetiredSolverState/);
  assert.match(owner, /legacySolverSuggestedLowerFillY/);
  assert.match(owner, /solverRetired/);
  assert.match(owner, /solverFallbackActive/);
  assert.doesNotMatch(owner, /removeProperty\(["\']--klevby-home-lower-fill-y["\']\)/);
});
