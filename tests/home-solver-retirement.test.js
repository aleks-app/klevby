const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveHomeRetiredSolverState
} = require("../assets/js/app/app-home-screen-owner.js");

test("retires the Home lower-fill solver when Grid is diagnostic-clean", () => {
  const result = resolveHomeRetiredSolverState({
    gridContractActive: true,
    gridMode: { solverMode: "read-only", homeGridReason: "grid-balanced" },
    legacySolverResult: { lowerFillY: 0, solverApplied: false }
  });

  assert.equal(result.solverMode, "retired-read-only");
  assert.equal(result.solverRetired, true);
  assert.equal(result.solverFallbackActive, false);
  assert.equal(result.appliedLowerFillY, 0);
  assert.equal(result.homeSolverRetirementReason, "grid-read-only-clean");
});

test("keeps safety-fill active when Grid is not clean yet", () => {
  const result = resolveHomeRetiredSolverState({
    gridContractActive: true,
    gridMode: { solverMode: "safety-fill", homeGridReason: "bottom-rhythm-delta" },
    legacySolverResult: { lowerFillY: 12, solverApplied: true }
  });

  assert.equal(result.solverMode, "safety-fill");
  assert.equal(result.solverRetired, false);
  assert.equal(result.solverFallbackActive, true);
  assert.equal(result.appliedLowerFillY, 12);
  assert.equal(result.legacySolverSuggestedLowerFillY, 12);
  assert.equal(result.legacySolverWouldApply, true);
  assert.equal(result.homeSolverRetirementReason, "grid-needs-safety-fill");
});

test("allows explicit emergency safety-fill without reviving the old double-RAF path", () => {
  const result = resolveHomeRetiredSolverState({
    gridContractActive: true,
    gridMode: { solverMode: "safety-fill", homeGridReason: "weather-overflow" },
    legacySolverResult: { lowerFillY: 9, solverApplied: true },
    emergencyEnabled: true
  });

  assert.equal(result.solverMode, "safety-fill");
  assert.equal(result.solverRetired, false);
  assert.equal(result.solverFallbackActive, true);
  assert.equal(result.solverEmergencyEnabled, true);
  assert.equal(result.appliedLowerFillY, 9);
  assert.equal(result.homeSolverRetirementReason, "emergency-safety-fill");
});

test("keeps legacy behavior outside the Grid Home contract", () => {
  const result = resolveHomeRetiredSolverState({
    gridContractActive: false,
    gridMode: { solverMode: "legacy-active", homeGridReason: "legacy-layout" },
    legacySolverResult: { lowerFillY: 7, solverApplied: true }
  });

  assert.equal(result.solverMode, "legacy-active");
  assert.equal(result.solverRetired, false);
  assert.equal(result.solverFallbackActive, true);
  assert.equal(result.appliedLowerFillY, 7);
  assert.equal(result.homeSolverRetirementReason, "legacy-layout");
});

const fs = require("node:fs");
const path = require("node:path");

test("retires the old double-RAF lower-fill scheduler from the Home owner", () => {
  const owner = fs.readFileSync(
    path.resolve(__dirname, "../assets/js/app/app-home-screen-owner.js"),
    "utf8"
  );

  assert.doesNotMatch(owner, /scheduleHomeBottomRhythmSolver/);
  assert.doesNotMatch(owner, /solverMeasureFrame/);
  assert.doesNotMatch(owner, /let\s+solverFrame\s*=/);
  assert.match(owner, /updateHomeSolverRetirementState/);
  assert.match(owner, /data-home-solver-retirement/);
});
