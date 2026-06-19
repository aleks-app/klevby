const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("Home skeleton diagnostic mode is opt-in for the current session only", () => {
  const owner = read(homeOwnerPath);

  assert.match(owner, /let homeSkeletonSessionEnabled\s*=\s*false/);
  assert.match(owner, /function shouldEnableHomeSkeletonMode\(\)\s*{\s*return homeSkeletonSessionEnabled === true;\s*}/);
  assert.doesNotMatch(owner, /function shouldEnableHomeSkeletonMode\(\)\s*{\s*return readHomeSkeletonStorageFlag\(\);\s*}/);
  assert.match(owner, /window\.localStorage\?\.removeItem\(HOME_SKELETON_STORAGE_KEY\)/);
});

test("EXIT SKELETON removes diagnostic attributes and root\/slot inline styles", () => {
  const owner = read(homeOwnerPath);

  assert.match(owner, /body\.removeAttribute\(HOME_SKELETON_ATTRIBUTE\)/);
  assert.match(owner, /homeSection\.removeAttribute\(HOME_SKELETON_ATTRIBUTE\)/);
  assert.match(owner, /applyHomeSkeletonRootInlineStyle\(false\)/);
  assert.match(owner, /applyHomeSkeletonSlotInlineStyles\(false\)/);
  assert.match(owner, /HOME_SKELETON_INLINE_STYLE_PROPS\.forEach\(\(property\) => \{\s*homeSection\.style\.removeProperty\(property\);\s*\}\)/);
  assert.match(owner, /HOME_SKELETON_SLOT_INLINE_STYLE_PROPS\.forEach\(\(property\) => \{\s*element\.style\.removeProperty\(property\);\s*\}\)/);
});

test("Home diagnostics report real-mode order and skeleton inline cleanup", () => {
  const owner = read(homeOwnerPath);

  assert.match(owner, /realMode:\s*!isHomeSkeletonMode\(homeSection\)/);
  assert.match(owner, /heroTop:\s*heroRect\?\.top \?\? null/);
  assert.match(owner, /quickTop:\s*quickRect\?\.top \?\? null/);
  assert.match(owner, /feedTop:\s*feedRect\?\.top \?\? null/);
  assert.match(owner, /weatherTop:\s*weatherRect\?\.top \?\? null/);
  assert.match(owner, /heroToQuickGap/);
  assert.match(owner, /quickToFeedGap/);
  assert.match(owner, /feedToWeatherGap/);
  assert.match(owner, /weatherToTouchBar/);
  assert.match(owner, /orderPass/);
  assert.match(owner, /heroHeight:\s*heroRect\?\.height \?\? null/);
  assert.match(owner, /quickBottom:\s*quickRect\?\.bottom \?\? null/);
  assert.match(owner, /quickHeight:\s*quickRect\?\.height \?\? null/);
  assert.match(owner, /feedBottom:\s*feedRect\?\.bottom \?\? null/);
  assert.match(owner, /feedHeight:\s*feedRect\?\.height \?\? null/);
  assert.match(owner, /weatherBottom:\s*weatherRect\?\.bottom \?\? null/);
  assert.match(owner, /weatherHeight:\s*weatherRect\?\.height \?\? null/);
  assert.match(owner, /weatherToTouchBar:\s*weatherToTouchBarPx/);
  assert.match(owner, /homeOv:\s*homeOverflowPx/);
  assert.match(owner, /weatherOv:\s*weatherOverflowPx/);
  assert.match(owner, /feedHeightBeforeRotation/);
  assert.match(owner, /feedHeightAfterRotation/);
  assert.match(owner, /weatherTopDeltaAfterRotation/);
  assert.match(owner, /readHomeSkeletonSlotInlineDiagnostics/);
  assert.match(owner, /quickInlineDisplayValue/);
  assert.match(owner, /feedInlineWidthValue/);
  assert.match(owner, /weatherInlinePositionValue/);
});
