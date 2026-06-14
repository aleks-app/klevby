const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const script = fs.readFileSync("assets/js/app/app-home-feed-preview-rotator.js", "utf8");
const styles = fs.readFileSync("assets/css/screens/home-mobile.css", "utf8");

test("Home feed/ad dissolve stays bounded and uses a two-slide rotator", () => {
  assert.match(script, /const MOSAIC_COLUMNS = 12;/);
  assert.match(script, /const MOSAIC_ROWS = 11;/);
  assert.match(script, /const currentSlide = slides\[activeIndex\];/);
  assert.match(script, /const nextSlide = slides\[index\];/);
  assert.match(script, /viewport\.appendChild\(mosaic\)/);

  assert.match(
    styles,
    /#homeSection \.home-feed-preview-rotator-viewport \{[\s\S]*?overflow: hidden;[\s\S]*?border-radius: 18px;/
  );
  assert.match(styles, /#homeSection \.home-feed-preview-mosaic-cell/);
  assert.doesNotMatch(styles, /body\s+\.home-feed-preview-mosaic/);
  assert.doesNotMatch(styles, /position:\s*fixed;[\s\S]{0,120}home-feed-preview-mosaic/);
});

test("Home mosaic uses only opacity and transform animation with reduced-motion handling", () => {
  const keyframes = styles.match(/@keyframes home-feed-mosaic-cell-away \{([\s\S]*?)\n  \}/);

  assert.ok(keyframes);
  assert.match(keyframes[1], /opacity:/);
  assert.match(keyframes[1], /transform:/);
  assert.doesNotMatch(keyframes[1], /(filter|box-shadow|width|height|top|left):/);
  assert.match(script, /if \(prefersReducedMotion\) \{\s*setActiveSlide\(index\);/);
});
