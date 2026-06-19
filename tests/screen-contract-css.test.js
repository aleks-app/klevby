const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const screenContractPath = path.join(root, "assets/css/core/screen-contract.css");
const mainCssPath = path.join(root, "assets/css/main.css");
const indexPath = path.join(root, "index.html");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("screen contract css is imported by the main css bundle", () => {
  const mainCss = read(mainCssPath);

  assert.match(
    mainCss,
    /@import\s+url\("\.\/core\/screen-contract\.css\?v=20260619-header-screen-contract-1"\);/
  );
});

test("kg screen contract consumes only kernel shell tokens", () => {
  const css = read(screenContractPath);

  assert.match(css, /\.kg-screen\s*\{/);
  assert.match(css, /top:\s*var\(--kg-screen-top-frame-offset/);
  assert.match(css, /bottom:\s*var\(--kg-screen-bottom-frame-offset/);
  assert.match(css, /height:\s*var\(--kg-shell-height/);
  assert.match(css, /padding-inline:\s*var\(--kg-screen-inline/);

  assert.doesNotMatch(css, /--klevby-home-lower-fill-y/);
  assert.doesNotMatch(css, /data-home-density/);
  assert.doesNotMatch(css, /getBoundingClientRect/);
  assert.doesNotMatch(css, /height\s*-\s*\d+px/);
});

test("screen contract is still not statically wired into markup", () => {
  const html = read(indexPath);

  assert.doesNotMatch(html, /class=["'][^"']*\bkg-screen\b/);
  assert.doesNotMatch(html, /class=["'][^"']*\bkg-screen__content\b/);
});
