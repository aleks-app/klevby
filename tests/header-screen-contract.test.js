const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const globalCssPath = path.join(root, "assets/css/base/global.css");
const screenContractPath = path.join(root, "assets/css/core/screen-contract.css");
const headerCssPath = path.join(root, "assets/css/layout/header.css");
const mainCssPath = path.join(root, "assets/css/main.css");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("global css exposes kg Header frame aliases without replacing shell tokens", () => {
  const css = read(globalCssPath);

  assert.match(css, /PR-11 Header frame aliases/);
  assert.match(css, /--kg-header-top:\s*0px;/);
  assert.match(css, /--kg-header-bottom:\s*var\(--kg-shell-top/);
  assert.match(css, /--kg-header-height:\s*var\(--kg-header-height-measured/);
  assert.match(css, /--kg-header-frame-total:\s*var\(--kg-header-bottom\);/);
  assert.match(css, /--kg-screen-top-frame-offset:\s*var\(--kg-header-frame-total\);/);

  assert.match(css, /--klevby-app-available-top:/);
  assert.match(css, /--kg-shell-top:\s*var\(--klevby-app-available-top\);/);
});

test("screen contract top is framed through the shared Header boundary token", () => {
  const css = read(screenContractPath);

  assert.match(css, /top:\s*var\(--kg-screen-top-frame-offset/);
  assert.match(css, /visible Header bottom/);
  assert.match(css, /TouchBar top edges/);
  assert.doesNotMatch(css, /height\s*-\s*\d+px/);
});

test("header css consumes kg safe/header aliases without rewriting markup", () => {
  const css = read(headerCssPath);

  assert.match(css, /--kg-header-safe-top:\s*var\(--kg-safe-top/);
  assert.match(css, /--kg-header-frame-bottom:\s*var\(--kg-screen-top-frame-offset/);
  assert.match(css, /padding:\s*calc\(var\(--kg-header-safe-top/);
  assert.doesNotMatch(css, /data-home-density/);
  assert.doesNotMatch(css, /height\s*-\s*\d+px/);
});

test("main css imports the PR-11 cache-busted header contract files", () => {
  const css = read(mainCssPath);

  assert.match(css, /\.\/base\/global\.css\?v=20260625-hotfix-splash-intro-restore-1/);
  assert.match(css, /\.\/core\/screen-contract\.css\?v=20260619-header-screen-contract-1/);
  assert.match(css, /\.\/layout\/header\.css\?v=20260619-header-screen-contract-1/);
  assert.match(css, /\.\/mobile\/mobile-tabbar\.css\?v=20260626-touchbar-y847-1/);
});

test("home owner publishes Header frame diagnostics without disabling solver fallback", () => {
  const js = read(homeOwnerPath);

  assert.match(js, /function resolveHomeHeaderFrameContract/);
  assert.match(js, /homeHeaderFrameMode:\s*"screen-header-integration"/);
  assert.match(js, /homeHeaderFramePass/);
  assert.match(js, /kernelHeaderBottom:\s*appShell\?\.headerBottom/);
  assert.match(js, /kernelHeaderHeight:\s*appShell\?\.headerHeight/);
  assert.match(js, /solverMode:\s*"safety-fill"/);
  assert.match(js, /solverMode:\s*readOnlyClean \? "retired-read-only" : "retired-watch"/);
});
