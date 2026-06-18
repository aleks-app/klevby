const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ownerSource = fs.readFileSync(
  path.join(__dirname, "..", "assets/js/app/app-home-screen-owner.js"),
  "utf8"
);
const homeCss = fs.readFileSync(
  path.join(__dirname, "..", "assets/css/screens/home-mobile.css"),
  "utf8"
);

function functionBody(name) {
  const start = ownerSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = ownerSource.indexOf("\n\n  function ", start + 1);
  assert.notEqual(nextFunction, -1, `${name} should be followed by another function`);
  return ownerSource.slice(start, nextFunction);
}

test("home JS keeps viewport measurement and read-only rhythm diagnostics", () => {
  const body = functionBody("measureHomeFitContract");

  assert.match(body, /KlevbyAppShellViewportOwner\?\.getLastMeasurement/);
  assert.match(body, /homeUsesAppShellContract/);
  assert.match(body, /const header = homeUsesAppShellContract \? null : findAppHeader\(\)/);
  assert.match(body, /headerBottom/);
  assert.match(body, /touchBarTop/);
  assert.match(body, /gapActiveFeedCardToWeather/);
  assert.match(body, /gapWeatherToTouchBar/);
  assert.match(body, /layoutFinalAuthority:\s*"css"/);
});

test("home JS has no lower-fill solver or layout commit pass", () => {
  assert.doesNotMatch(ownerSource, /resolveHomeLowerFill/);
  assert.doesNotMatch(ownerSource, /applyHomeBottomRhythmSolver/);
  assert.doesNotMatch(ownerSource, /FINAL_LAYOUT_COMMIT/);
  assert.doesNotMatch(ownerSource, /--klevby-home-lower-fill-y/);
  assert.doesNotMatch(ownerSource, /lowerFillY|lowerFillCap|solverApplied|solverCapped/);
  assert.doesNotMatch(ownerSource, /finalLayoutCommit|homeCommitExecuted|finalLayoutCorrection/);
});

test("home feed and weather gaps share the same CSS token source", () => {
  const sectionGapDefinitions = homeCss.match(/--klevby-home-section-gap:\s*var\(--kr-2\);/g) || [];
  assert.equal(sectionGapDefinitions.length, 3);
  assert.match(
    homeCss,
    /#homeSection \.home-feed-preview \{[\s\S]*?margin:\s*0 auto var\(--klevby-home-section-gap\);/
  );
  assert.match(
    homeCss,
    /#homeSection \.home-weather-card \{[\s\S]*?margin:\s*0 auto var\(--klevby-home-section-gap\);/
  );
  assert.doesNotMatch(homeCss, /--klevby-home-lower-fill-y|lower-fill|header-nudge/);
});
