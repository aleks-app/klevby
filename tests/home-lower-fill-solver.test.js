const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveMeasuredHomeDensity,
  resolveHomeLowerFillCap,
  resolveHomeLowerFill
} = require("../assets/js/app/app-home-screen-owner.js");

test("keeps density classification diagnostic-only", () => {
  assert.equal(resolveMeasuredHomeDensity(759), "standard");
  assert.equal(resolveMeasuredHomeDensity(699), "compact");
  assert.equal(resolveMeasuredHomeDensity(640), "tight");
});

test("lower-fill cap is zero because solver cannot mutate layout", () => {
  assert.equal(resolveHomeLowerFillCap("standard"), 0);
  assert.equal(resolveHomeLowerFillCap("compact"), 0);
  assert.equal(resolveHomeLowerFillCap("tight"), 0);
});

test("reports a larger lower gap without producing runtime fill", () => {
  const result = resolveHomeLowerFill({ upperGap: 12, lowerGap: 34, maxFill: 28 });

  assert.equal(result.lowerFillY, 0);
  assert.equal(result.lowerFillCap, 0);
  assert.equal(result.solverApplied, false);
  assert.equal(result.solverCapped, false);
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.lowerFillReason, "diagnostic-lower-gap-larger");
  assert.equal(result.measuredImbalance, 22);
});

test("reports an already balanced rhythm without producing runtime fill", () => {
  const result = resolveHomeLowerFill({ upperGap: 12, lowerGap: 12, maxFill: 28 });

  assert.equal(result.lowerFillY, 0);
  assert.equal(result.solverApplied, false);
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.lowerFillReason, "already-balanced");
});

test("reports a smaller lower gap without producing runtime fill", () => {
  const result = resolveHomeLowerFill({ upperGap: 16, lowerGap: 11, maxFill: 28 });

  assert.equal(result.lowerFillY, 0);
  assert.equal(result.solverApplied, false);
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.lowerFillReason, "diagnostic-lower-gap-smaller");
});
