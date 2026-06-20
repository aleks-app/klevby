const assert = require("node:assert/strict");
const test = require("node:test");

const {
  collectHomeDimmingDiagnostics
} = require("../assets/js/app/app-home-screen-owner.js");

test("Home dimming diagnostics publish computed style fields for target layers", () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const selectors = new Set([
    "#homeSection",
    "#homeSection .hero",
    "#homeSection .quick-action-card",
    "#homeSection .home-feed-preview-card",
    "#homeSection .weather-card"
  ]);

  global.document = {
    querySelector(selector) {
      return selectors.has(selector) ? { selector } : null;
    }
  };
  global.window = {
    getComputedStyle(element, pseudo) {
      return {
        position: pseudo ? "absolute" : "relative",
        zIndex: pseudo ? "1" : "auto",
        opacity: "0.72",
        background: "rgba(0, 0, 0, 0.25)",
        backgroundColor: "rgba(0, 0, 0, 0.25)",
        backgroundImage: "none",
        filter: "none",
        backdropFilter: "blur(2px)",
        webkitBackdropFilter: "blur(2px)",
        mixBlendMode: "normal",
        pointerEvents: "none",
        inset: "0px",
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
        transform: "none",
        isolation: element.selector === "#homeSection" ? "isolate" : "auto",
        getPropertyValue(property) {
          return this[property] || "";
        }
      };
    }
  };

  try {
    const diagnostics = collectHomeDimmingDiagnostics();
    const home = diagnostics.find((entry) => entry.selector === "#homeSection");
    const homeBefore = diagnostics.find((entry) => entry.selector === "#homeSection::before");

    assert.equal(diagnostics.length, 11);
    assert.equal(home.exists, true);
    assert.equal(home.elementExists, true);
    assert.equal(home.position, "relative");
    assert.equal(home.backgroundColor, "rgba(0, 0, 0, 0.25)");
    assert.equal(home.backdropFilter, "blur(2px)");
    assert.equal(home.pointerEvents, "none");
    assert.equal(home.inset, "0px");
    assert.equal(home.isolation, "isolate");
    assert.equal(homeBefore.exists, true);
    assert.equal(homeBefore.pseudoElement, "::before");
    assert.equal(homeBefore.position, "absolute");
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
  }
});
