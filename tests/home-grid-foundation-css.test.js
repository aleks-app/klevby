const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cssPath = path.join(root, "assets/css/modules/home/home-grid-foundation.css");
const mainCssPath = path.join(root, "assets/css/main.css");
const indexPath = path.join(root, "index.html");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("home grid foundation css is imported after legacy Home mobile CSS", () => {
  const mainCss = read(mainCssPath);
  const legacyImport = './screens/home-mobile.css?v=20260619-home-contract-clean-1';
  const foundationImport = './modules/home/home-grid-foundation.css?v=20260610-home-grid-geometry-pr1';

  assert.ok(mainCss.includes(legacyImport));
  assert.ok(mainCss.includes(foundationImport));
  assert.ok(mainCss.indexOf(foundationImport) > mainCss.indexOf(legacyImport));
});

test("home grid foundation requires the clean kg-screen contract and runtime grid flag", () => {
  const css = read(cssPath);
  const index = read(indexPath);

  assert.match(css, /#homeSection\.kg-screen\[data-home-layout="grid"\]/);
  assert.doesNotMatch(index, /data-home-layout=["']grid["']/);
  assert.doesNotMatch(index, /id=["']homeSection["'][^>]*\bkg-screen\b/);
  assert.doesNotMatch(css, /#homeSection\s*\{[^}]*display\s*:\s*grid/i);
});

test("home grid foundation keeps legacy Home solver tokens as fallback", () => {
  const css = read(cssPath);

  assert.match(css, /--klevby-home-lower-fill-y/);
  assert.match(css, /--kg-home-grid-lower-fill-y:\s*var\(--klevby-home-lower-fill-y,\s*0px\)/);
  assert.match(css, /--kg-home-grid-weather-clearance-y:\s*var\(--klevby-home-weather-clearance-y,\s*12px\)/);
});

test("home grid foundation uses measured shell geometry and adaptive feed row", () => {
  const css = read(cssPath);

  assert.match(css, /--klevby-home-available-top/);
  assert.match(css, /--klevby-home-available-height/);
  assert.match(css, /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/);
  assert.match(css, /row-gap:\s*var\(--kg-home-grid-gap\)/);
  assert.match(css, /padding-bottom:\s*var\(--kg-home-grid-weather-clearance-y\)/);
  assert.match(css, /> \.hero\s*\{[^}]*grid-row:\s*1/s);
  assert.match(css, /> \.home-quick-actions\s*\{[^}]*grid-row:\s*2/s);
  assert.match(css, /> \.home-feed-preview\s*\{[^}]*grid-row:\s*3/s);
  assert.match(css, /> \.home-weather-card\s*\{[^}]*grid-row:\s*4/s);
  assert.doesNotMatch(css, /margin-top:\s*-/);
});


test("home feed preview constrains the active card inside its grid slot", () => {
  const css = read(cssPath);

  assert.match(css, /> \.home-feed-preview\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /> \.home-feed-preview\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.home-feed-preview-head\s*\{[^}]*grid-row:\s*1/s);
  assert.match(css, /\.home-feed-preview-rotator\s*\{[^}]*grid-row:\s*2/s);
  assert.match(css, /\.home-feed-preview-rotator,[\s\S]*?\.home-feed-preview-card\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.home-feed-preview-rotator,[\s\S]*?\.home-feed-preview-card\s*\{[^}]*overflow:\s*hidden/s);
});

test("home grid foundation lets kg-screen own shell height", () => {
  const css = read(cssPath);

  assert.doesNotMatch(css, /height:\s*var\(--kg-shell-height/);
  assert.doesNotMatch(css, /min-height:\s*var\(--kg-shell-height/);
  assert.doesNotMatch(css, /max-height:\s*var\(--kg-shell-height/);
  assert.match(css, /container-name:\s*kg-home-screen/);
});
