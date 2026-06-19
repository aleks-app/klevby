const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const homeOwnerPath = path.join(root, "assets/js/app/app-home-screen-owner.js");
const homeMobileCssPath = path.join(root, "assets/css/screens/home-mobile.css");
const responsiveMobileCssPath = path.join(root, "assets/css/responsive/mobile.css");
const homeGridCssPath = path.join(root, "assets/css/modules/home/home-grid-foundation.css");
const screenContractCssPath = path.join(root, "assets/css/core/screen-contract.css");
const indexPath = path.join(root, "index.html");

const {
  resolveHomeScreenContractIntegration
} = require("../assets/js/app/app-home-screen-owner.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("Home screen contract clean integration is runtime-owned, not static markup", () => {
  const owner = read(homeOwnerPath);
  const index = read(indexPath);

  assert.match(owner, /HOME_SCREEN_CONTRACT_CLASS\s*=\s*"kg-screen"/);
  assert.match(owner, /HOME_SCREEN_CONTRACT_MODE\s*=\s*"clean-integration"/);
  assert.match(owner, /homeSection\.classList\.add\(HOME_SCREEN_CONTRACT_CLASS\)/);
  assert.match(owner, /homeSection\.classList\.remove\(HOME_SCREEN_CONTRACT_CLASS\)/);
  assert.match(owner, /setHomeScreenContractIntegrationState\(homeActive\)/);
  assert.doesNotMatch(owner, /setAttribute\(["']data-home-screen-contract["']/);
  assert.doesNotMatch(owner, /setAttribute\(["']data-home-screen-contract-pass["']/);
  assert.doesNotMatch(index, /id=["']homeSection["'][^>]*\bkg-screen\b/);
});

test("Home legacy shell fit rule no longer competes with kg-screen", () => {
  const homeMobileCss = read(homeMobileCssPath);
  const responsiveMobileCss = read(responsiveMobileCssPath);
  const screenContractCss = read(screenContractCssPath);

  assert.match(homeMobileCss, /#homeSection:not\(\.kg-screen\)\s*\{/);
  assert.match(responsiveMobileCss, /#homeSection:not\(\.kg-screen\)\s*\{/);
  assert.doesNotMatch(homeMobileCss, /#homeSection\s*\{\s*position:\s*absolute\s*!important/);
  assert.doesNotMatch(responsiveMobileCss, /#homeSection\s*\{\s*position:\s*relative/);
  assert.match(screenContractCss, /\.kg-screen\s*\{[\s\S]*top:\s*var\(--kg-screen-top-frame-offset/);
  assert.match(screenContractCss, /\.kg-screen\s*\{[\s\S]*height:\s*var\(--kg-shell-height/);
});

test("Home grid foundation has no !important shell-height overrides", () => {
  const css = read(homeGridCssPath);

  assert.match(css, /#homeSection\.kg-screen\[data-home-layout="grid"\]\s*\{/);
  assert.doesNotMatch(css, /display:\s*grid\s*!important/);
  assert.doesNotMatch(css, /height:\s*var\(--kg-shell-height[\s\S]*!important/);
  assert.doesNotMatch(css, /min-height:\s*var\(--kg-shell-height[\s\S]*!important/);
  assert.doesNotMatch(css, /max-height:\s*var\(--kg-shell-height[\s\S]*!important/);
});

test("Home screen contract clean integration accepts matching kg and legacy shell geometry", () => {
  const result = resolveHomeScreenContractIntegration({
    contractActive: true,
    contractClassActive: true,
    kgShellTop: 72,
    kgShellHeight: 690,
    kgShellBottomOffset: 82,
    legacyShellTop: 72,
    legacyShellHeight: 690,
    legacyShellBottomOffset: 82,
    homeTop: 72,
    homeBottom: 762,
    homeHeight: 690,
    expectedTop: 72,
    expectedBottom: 762,
    expectedHeight: 690
  });

  assert.equal(result.homeScreenContractMode, "clean-integration");
  assert.equal(result.homeScreenContractActive, true);
  assert.equal(result.homeScreenContractTokenBridgePass, true);
  assert.equal(result.homeScreenContractRectPass, true);
  assert.equal(result.homeScreenContractPass, true);
  assert.equal(result.homeScreenContractReason, "integrated");
});

test("Home screen contract clean integration fails safely when the kg-screen class is missing", () => {
  const result = resolveHomeScreenContractIntegration({
    contractActive: true,
    contractClassActive: false,
    kgShellTop: 72,
    kgShellHeight: 690,
    kgShellBottomOffset: 82,
    legacyShellTop: 72,
    legacyShellHeight: 690,
    legacyShellBottomOffset: 82,
    homeTop: 72,
    homeBottom: 762,
    homeHeight: 690,
    expectedTop: 72,
    expectedBottom: 762,
    expectedHeight: 690
  });

  assert.equal(result.homeScreenContractPass, false);
  assert.equal(result.homeScreenContractReason, "kg-screen-class-missing");
});

test("Home screen contract clean integration still catches token bridge mismatch", () => {
  const result = resolveHomeScreenContractIntegration({
    contractActive: true,
    contractClassActive: true,
    kgShellTop: 80,
    kgShellHeight: 690,
    kgShellBottomOffset: 82,
    legacyShellTop: 72,
    legacyShellHeight: 690,
    legacyShellBottomOffset: 82,
    homeTop: 72,
    homeBottom: 762,
    homeHeight: 690,
    expectedTop: 72,
    expectedBottom: 762,
    expectedHeight: 690
  });

  assert.equal(result.homeScreenContractTokenBridgePass, false);
  assert.equal(result.homeScreenContractPass, false);
  assert.equal(result.homeScreenContractReason, "kg-token-bridge-mismatch");
});

test("Home screen contract clean integration catches Home rect mismatch without disabling solver", () => {
  const result = resolveHomeScreenContractIntegration({
    contractActive: true,
    contractClassActive: true,
    kgShellTop: 72,
    kgShellHeight: 690,
    kgShellBottomOffset: 82,
    legacyShellTop: 72,
    legacyShellHeight: 690,
    legacyShellBottomOffset: 82,
    homeTop: 80,
    homeBottom: 770,
    homeHeight: 690,
    expectedTop: 72,
    expectedBottom: 762,
    expectedHeight: 690
  });

  assert.equal(result.homeScreenContractRectPass, false);
  assert.equal(result.homeScreenContractPass, false);
  assert.equal(result.homeScreenContractReason, "home-rect-contract-mismatch");
});
