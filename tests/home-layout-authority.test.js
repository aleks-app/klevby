const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ownerSource = fs.readFileSync(
  path.join(__dirname, "..", "assets/js/app/app-home-screen-owner.js"),
  "utf8"
);

function functionBody(name) {
  const start = ownerSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = ownerSource.indexOf("\n\n  function ", start + 1);
  assert.notEqual(nextFunction, -1, `${name} should be followed by another function`);
  return ownerSource.slice(start, nextFunction);
}

test("final layout commit validates without rewriting the lower fill token", () => {
  const body = functionBody("FINAL_LAYOUT_COMMIT");

  assert.match(body, /finalLayoutCommitExecuted:\s*true/);
  assert.match(body, /finalLayoutLocked/);
  assert.match(body, /finalWeatherGapPx/);
  assert.match(body, /weatherTouchBarVisualPass/);
  assert.match(body, /finalCommitMutatesLayout:\s*false|finalCommitMutatesLayout/);
  assert.doesNotMatch(body, /publishHomeLowerFill/);
  assert.doesNotMatch(body, /setProperty\("--klevby-home-lower-fill-y"/);
  assert.doesNotMatch(body, /applyHomeBottomRhythmSolver/);
});

test("visible home pipeline does not request lower-fill reset before measuring", () => {
  assert.doesNotMatch(ownerSource, /resetBeforeMeasure:\s*true/);
  assert.match(ownerSource, /lowerFillResetDuringVisibleFrame/);
  assert.match(ownerSource, /layoutFinalAuthority:\s*"css"/);
  assert.match(ownerSource, /lowerFillWriter/);
});

test("home measurement prefers the AppShell viewport contract when available", () => {
  const body = functionBody("measureHomeFitContract");

  assert.match(body, /KlevbyAppShellViewportOwner\?\.getLastMeasurement/);
  assert.match(body, /homeUsesAppShellContract/);
  assert.match(body, /const header = homeUsesAppShellContract \? null : findAppHeader\(\)/);
  assert.match(body, /appShellBoundaryAuthority:\s*homeUsesAppShellContract/);
});
