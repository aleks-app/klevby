const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveHomeLowerFill
} = require("../assets/js/app/app-home-screen-owner.js");

test("fills a large lower gap to match the upper rhythm", () => {
  const result = resolveHomeLowerFill({ upperGap: 12, lowerGap: 34, maxFill: 28 });
  assert.equal(result.lowerFillY, 22);
  assert.equal(Math.abs(12 - (34 - result.lowerFillY)), 0);
  assert.equal(result.solverCapped, false);
});

test("improves a small standard-density imbalance", () => {
  const result = resolveHomeLowerFill({ upperGap: 14, lowerGap: 18, maxFill: 12 });
  assert.equal(result.lowerFillY, 4);
  assert.equal(Math.abs(14 - (18 - result.lowerFillY)), 0);
});

test("keeps an already balanced rhythm unchanged", () => {
  const result = resolveHomeLowerFill({ upperGap: 12, lowerGap: 12, maxFill: 28 });
  assert.equal(result.lowerFillY, 0);
  assert.equal(result.solverApplied, false);
});

test("fills a moderate lower gap without crossing the safety floor", () => {
  const result = resolveHomeLowerFill({ upperGap: 10, lowerGap: 25, maxFill: 28 });
  assert.equal(result.lowerFillY, 15);
  assert.equal(25 - result.lowerFillY, 10);
});

test("does not push weather down when the lower gap is already smaller", () => {
  const result = resolveHomeLowerFill({ upperGap: 16, lowerGap: 11, maxFill: 28 });
  assert.equal(result.lowerFillY, 0);
  assert.equal(result.lowerFillReason, "lower-gap-already-smaller");
});

test("reports when the density cap prevents full balancing", () => {
  const result = resolveHomeLowerFill({ upperGap: 10, lowerGap: 50, maxFill: 12 });
  assert.equal(result.lowerFillY, 12);
  assert.equal(result.solverCapped, true);
  assert.equal(result.lowerFillReason, "density-cap");
});

test("reports when the minimum lower gap limits fill", () => {
  const result = resolveHomeLowerFill({ upperGap: 2, lowerGap: 15, maxFill: 28 });
  assert.equal(result.lowerFillY, 5);
  assert.equal(result.solverCapped, true);
  assert.equal(result.lowerFillReason, "minimum-lower-gap-cap");
});
