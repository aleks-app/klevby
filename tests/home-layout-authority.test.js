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
  const start = ownerSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = ownerSource.indexOf("\n\n  function ", start + 1);
  assert.notEqual(nextFunction, -1, `${name} should be followed by another function`);
  return ownerSource.slice(start, nextFunction);
}

test("home JS measures AppShell/fallback geometry and publishes viewport tokens", () => {
  const measureBody = functionBody("measureHomeFitContract");
  const applyBody = functionBody("applyMeasuredHomeLayoutTokens");

  assert.match(measureBody, /KlevbyAppShellViewportOwner\?\.getLastMeasurement/);
  assert.match(measureBody, /homeUsesAppShellContract/);
  assert.match(measureBody, /const header = homeUsesAppShellContract \? null : findAppHeader\(\)/);
  assert.match(measureBody, /availableHeight/);
  assert.match(measureBody, /currentDensity: density/);
  assert.match(applyBody, /--klevby-home-available-top/);
  assert.match(applyBody, /--klevby-home-available-bottom/);
  assert.match(applyBody, /--klevby-home-available-height/);
  assert.match(applyBody, /setAttribute\(HOME_DENSITY_ATTRIBUTE, measurement\.density\)/);
});

test("home JS keeps Rhythm Solver as the only lower-fill writer", () => {
  const solverBody = functionBody("resolveHomeLowerFill");
  const applySolverBody = functionBody("applyHomeBottomRhythmSolver");

  assert.match(ownerSource, /HOME_LOWER_FILL_CAPS/);
  assert.match(ownerSource, /standard[\s\S]*compact[\s\S]*tight/);
  assert.match(solverBody, /lowerGap - upperGap/);
  assert.match(solverBody, /cssEffectRatio/);
  assert.match(solverBody, /HOME_CLEARANCE_PX/);
  assert.match(ownerSource, /--klevby-home-lower-fill-y/);
  assert.match(applySolverBody, /lowerFillWriter: "home-layout-engine"/);
  assert.match(applySolverBody, /solverApplied/);
  assert.equal(
    (ownerSource.match(/setProperty\("--klevby-home-lower-fill-y"/g) || []).length,
    1,
    "Home layout engine must publish lower-fill through the solver-owned writer"
  );
});

test("home layout pipeline has a final commit diagnostics pass", () => {
  const pipelineBody = functionBody("HOME_LAYOUT_PIPELINE_FRAME");

  assert.match(pipelineBody, /applyMeasuredHomeLayoutTokens\(measurement\)/);
  assert.match(pipelineBody, /applyHomeBottomRhythmSolver\(measurement\)/);
  assert.match(pipelineBody, /requestAnimationFrame\(\(\) =>/);
  assert.match(pipelineBody, /refineHomeBottomRhythmSolver\(measurement, solver\)/);
  assert.match(pipelineBody, /homeCommitExecuted: true/);
  assert.match(pipelineBody, /finalLayoutCommitExecuted: true/);
  assert.match(pipelineBody, /weatherOverflowPx/);
  assert.match(pipelineBody, /weatherTouchBarVisualPass/);
});

test("home CSS applies lower-fill to the outer feed slot and keeps media fill internal", () => {
  assert.match(homeCss, /--klevby-home-lower-fill-y:\s*0px/);
  assert.match(homeCss, /--klevby-home-feed-card-fill-share:\s*var\(--klevby-home-lower-fill-y\)/);
  assert.match(homeCss, /--klevby-home-feed-image-fill-share:\s*calc\(var\(--klevby-home-lower-fill-y\) \* 0\.24\)/);
  assert.match(
    homeCss,
    /#homeSection \.home-feed-preview-card \{[\s\S]*?min-height:\s*calc\(var\(--klevby-home-feed-card-min-h\) \+ var\(--klevby-home-feed-card-fill-share\)\)/
  );
  assert.match(
    homeCss,
    /#homeSection \.home-feed-preview-image \{[\s\S]*?min-height:\s*calc\(var\(--klevby-home-feed-image-min-h\) \+ var\(--klevby-home-feed-image-fill-share\)\)/
  );
});

test("home rhythm solver can refine the measured 12px/79px case without the old 44px cap", () => {
  const combined = `${ownerSource}\n${homeCss}`;

  assert.doesNotMatch(combined, /standard:\s*44/);
  assert.match(ownerSource, /refineHomeBottomRhythmSolver/);
  assert.match(ownerSource, /rhythmAfter\.bottomRhythmDelta > 2/);
  assert.match(ownerSource, /rhythmAfter\.weatherOverflowPx === 0/);
  assert.match(ownerSource, /currentFillY: appliedFillY/);
  assert.match(ownerSource, /measuredEffect \/ appliedFillY/);
});

test("home layout contract stays universal", () => {
  const combined = `${ownerSource}\n${homeCss}`;

  assert.doesNotMatch(combined, /iPhone|Pixel|Galaxy|Samsung|Android\s+\d/i);
  assert.doesNotMatch(combined, /pwa-short/);
  assert.doesNotMatch(combined, /height\s*-\s*633px|633px\s*-\s*height/);
  assert.doesNotMatch(combined, /data-home-density="(?!standard|compact|tight)/);
});
