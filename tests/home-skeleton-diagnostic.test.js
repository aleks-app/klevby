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
