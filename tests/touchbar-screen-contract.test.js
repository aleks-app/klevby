const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const globalCssPath = path.join(root, "assets/css/base/global.css");
const screenContractPath = path.join(root, "assets/css/core/screen-contract.css");
const tabbarCssPath = path.join(root, "assets/css/mobile/mobile-tabbar.css");
const mainCssPath = path.join(root, "assets/css/main.css");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("global css exposes kg TouchBar frame aliases without replacing legacy tokens", () => {
  const css = read(globalCssPath);

  assert.match(css, /--kg-touchbar-height:\s*var\(--klevby-touchbar-height\);/);
  assert.match(css, /--kg-touchbar-bottom-gap:\s*var\(--klevby-touchbar-bottom-gap\);/);
  assert.match(css, /--kg-touchbar-bottom-offset:\s*var\(--klevby-touchbar-bottom-offset\);/);
  assert.match(css, /--kg-touchbar-frame-total:\s*var\(--klevby-bottom-chrome-total\);/);
  assert.match(css, /--kg-screen-bottom-frame-offset:\s*var\(--kg-shell-bottom-offset/);

  assert.match(css, /--klevby-touchbar-height:\s*70px;/);
  assert.match(css, /--klevby-touchbar-bottom-offset:/);
});

test("screen contract bottom is framed through the shared TouchBar boundary token", () => {
  const css = read(screenContractPath);

  assert.match(css, /bottom:\s*var\(--kg-screen-bottom-frame-offset/);
  assert.match(css, /TouchBar top edges/);
  assert.doesNotMatch(css, /height\s*-\s*\d+px/);
});

test("mobile tabbar consumes kg aliases with legacy fallbacks", () => {
  const css = read(tabbarCssPath);

  assert.match(css, /left:\s*var\(--klevby-home-content-inset,\s*22px\);/);
  assert.match(css, /right:\s*var\(--klevby-home-content-inset,\s*22px\);/);
  assert.match(css, /bottom:\s*var\(--kg-touchbar-bottom-offset,\s*var\(--klevby-touchbar-bottom-offset\)\);/);
  assert.match(css, /height:\s*var\(--kg-touchbar-height,\s*var\(--klevby-touchbar-height\)\);/);
  assert.match(css, /display:\s*none;/);
  assert.match(css, /body\[data-app-chrome-mode="home"\]:has\(#homeSection:not\(\.hidden\)\) \.mobile-tabbar \{[\s\S]*top:\s*847px;[\s\S]*bottom:\s*auto;[\s\S]*height:\s*70px;[\s\S]*display:\s*grid;/);
});

test("main css imports the PR-11 cache-busted contract files", () => {
  const css = read(mainCssPath);

  assert.match(css, /\.\/base\/global\.css\?v=20260624-splash-intro-animation-fix-1/);
  assert.match(css, /\.\/core\/screen-contract\.css\?v=20260619-header-screen-contract-1/);
  assert.match(css, /\.\/mobile\/mobile-tabbar\.css\?v=20260626-touchbar-y847-1/);
});

test("home owner publishes TouchBar frame diagnostics without disabling solver fallback", () => {
  const js = read(homeOwnerPath);

  assert.match(js, /function resolveHomeTouchBarFrameContract/);
  assert.match(js, /homeTouchBarFrameMode:\s*"screen-touchbar-integration"/);
  assert.match(js, /homeTouchBarFramePass/);
  assert.match(js, /solverMode:\s*"safety-fill"/);
  assert.match(js, /solverMode:\s*readOnlyClean \? "retired-read-only" : "retired-watch"/);
});
