const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");
const indexPath = path.join(root, "index.html");
const finalizationPath = path.join(root, "docs/architecture/ARCHITECTURE-FINALIZATION.md");
const pr12Path = path.join(root, "docs/architecture/PR-12-architecture-finalization.md");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("PR-12 removes runtime Home grid test-drive markers and uses final contract markers", () => {
  const owner = read(homeOwnerPath);
  const index = read(indexPath);

  assert.match(owner, /HOME_GRID_CONTRACT_ATTRIBUTE\s*=\s*"data-home-grid-contract"/);
  assert.match(owner, /root\.setAttribute\(HOME_GRID_CONTRACT_ATTRIBUTE,\s*"integrated"\)/);
  assert.match(owner, /homeGridContractActive/);
  assert.doesNotMatch(owner, /data-home-grid-test-drive/);
  assert.doesNotMatch(owner, /HOME_GRID_TEST_DRIVE/);
  assert.doesNotMatch(owner, /homeGridTestDriveActive/);
  assert.doesNotMatch(index, /data-home-grid-contract=/);
});

test("PR-12 keeps Home solver retired but leaves emergency safety-fill available", () => {
  const owner = read(homeOwnerPath);

  assert.match(owner, /HOME_SOLVER_RETIREMENT_ENABLED\s*=\s*true/);
  assert.match(owner, /HOME_LEGACY_SOLVER_EMERGENCY_ATTRIBUTE\s*=\s*"data-home-legacy-solver-emergency"/);
  assert.match(owner, /safety-fill/);
  assert.match(owner, /retired-read-only/);
  assert.doesNotMatch(owner, /scheduleHomeBottomRhythmSolver/);
  assert.doesNotMatch(owner, /solverMeasureFrame/);
});

test("PR-12 final architecture documents are present", () => {
  const finalization = read(finalizationPath);
  const pr12 = read(pr12Path);

  assert.match(finalization, /KlevGo Architecture Finalization/);
  assert.match(finalization, /Core Viewport Kernel/);
  assert.match(finalization, /Repository result envelope/);
  assert.match(pr12, /PR-12 — Architecture Finalization/);
  assert.match(pr12, /data-home-grid-contract="integrated"/);
});
