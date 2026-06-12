const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement() {
  return {
    textContent: "",
    hidden: false,
    href: "",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "href") this.href = "";
    },
    addEventListener() {},
    focus() {
      this.focused = true;
    }
  };
}

function loadDetailScreen() {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-body-detail.js"),
    "utf8"
  );
  const elements = new Map();
  [
    ".water-body-detail-name",
    ".water-body-detail-type",
    ".water-body-detail-location",
    ".water-body-detail-source",
    ".water-body-detail-location-quality",
    ".water-body-detail-location-source",
    ".water-body-detail-depth-link"
  ].forEach((selector) => elements.set(selector, createElement()));

  elements.set("#appHeaderBackBtn", createElement());

  const section = {
    dataset: {},
    querySelector(selector) {
      return elements.get(selector) || null;
    }
  };
  const openedSections = [];
  const document = {
    readyState: "complete",
    getElementById(id) {
      if (id === "waterBodyDetailSection") return section;
      if (id === "appHeaderBackBtn") return elements.get("#appHeaderBackBtn");
      return null;
    }
  };
  const window = {
    showSection(sectionName) {
      openedSections.push(sectionName);
    }
  };

  vm.runInContext(source, vm.createContext({ window, document, URL, console }), {
    filename: "water-body-detail.js"
  });

  return { api: window.KlevbyWaterBodyDetail, elements, openedSections };
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("detail screen opens with normalized selected point data", () => {
  const { api, elements, openedSections } = loadDetailScreen();

  assert.equal(api.open({
    id: 42,
    name: "  Озеро Нарочь ",
    waterType: "озеро",
    region: "Минская область",
    district: "Мядельский район",
    source: "FisherMap",
    sourceUrl: "https://fish.example/depths",
    quality: "verified",
    locationQuality: "Высокая",
    locationSource: "FisherMap"
  }), true);

  assert.deepEqual(toPlain(api.getSelectedPoint()), {
    id: "42",
    name: "Озеро Нарочь",
    waterType: "озеро",
    region: "Минская область",
    district: "Мядельский район",
    source: "FisherMap",
    sourceUrl: "https://fish.example/depths",
    quality: "verified",
    locationQuality: "Высокая",
    locationSource: "FisherMap"
  });
  assert.deepEqual(openedSections, ["water-body-detail"]);
  assert.equal(elements.get(".water-body-detail-name").textContent, "Озеро Нарочь");
  assert.equal(elements.get(".water-body-detail-location").textContent, "Минская область · Мядельский район");
  assert.equal(elements.get(".water-body-detail-depth-link").hidden, false);
  assert.equal(elements.get(".water-body-detail-depth-link").href, "https://fish.example/depths");
  assert.equal(elements.get("#appHeaderBackBtn").focused, true);
});

test("safe depth source URL accepts only absolute credential-free HTTP(S) URLs", () => {
  const { api } = loadDetailScreen();

  assert.equal(api.getSafeSourceUrl("https://fishermap.org/map?water=42"), "https://fishermap.org/map?water=42");
  assert.equal(api.getSafeSourceUrl("http://example.com/depths"), "http://example.com/depths");
  assert.equal(api.getSafeSourceUrl("javascript:alert(1)"), "");
  assert.equal(api.getSafeSourceUrl("/relative/source"), "");
  assert.equal(api.getSafeSourceUrl("https://user:secret@example.com/depths"), "");
});

test("invalid source URL hides the external depth-map action", () => {
  const { api, elements } = loadDetailScreen();

  api.open({ name: "Тестовый водоём", sourceUrl: "javascript:alert(1)" });

  const action = elements.get(".water-body-detail-depth-link");
  assert.equal(action.hidden, true);
  assert.equal(action.attributes["aria-disabled"], "true");
  assert.equal(action.href, "");
});

test("detail close returns to the existing map section", () => {
  const { api, openedSections } = loadDetailScreen();

  assert.equal(api.close(), true);
  assert.deepEqual(openedSections, ["map"]);
});

test("detail markup uses collapsed accordions without a duplicate back control", () => {
  const markup = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const detailStart = markup.indexOf('<section id="waterBodyDetailSection"');
  const detailEnd = markup.indexOf('<section id="authSection"', detailStart);
  const detailMarkup = markup.slice(detailStart, detailEnd);

  assert.equal(detailMarkup.includes("water-body-detail-back"), false);
  assert.equal((detailMarkup.match(/<details class="water-body-detail-card water-body-detail-accordion/g) || []).length, 3);
  assert.equal(detailMarkup.includes("<details class=\"water-body-detail-card water-body-detail-accordion\" open"), false);
  assert.match(detailMarkup, /<summary>\s*<span>О водоёме<\/span>/);
  assert.match(detailMarkup, /<summary>\s*<span>Возможности<\/span>/);
  assert.match(detailMarkup, /<summary>\s*<span>Источник и точность<\/span>/);
});
