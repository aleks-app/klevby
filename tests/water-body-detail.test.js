const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement() {
  const listeners = new Map();
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    href: "",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "href") this.href = "";
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    click() {
      return listeners.get("click")?.({ preventDefault() {} });
    },
    focus() {
      this.focused = true;
    }
  };
}

function loadDetailScreen(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/map/water-body-detail.js"),
    "utf8"
  );
  const elements = new Map();
  [
    ".water-body-detail-name",
    ".water-body-detail-type",
    ".water-body-detail-location",
    ".water-body-detail-status-text",
    ".water-body-detail-source",
    ".water-body-detail-data-status",
    ".water-body-detail-location-quality",
    ".water-body-detail-location-source",
    ".water-body-detail-depth-action"
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
  const contourRequests = [];
  const externalOpens = [];
  const window = {
    KlevbyWaterDepthContoursLayer: {
      hasDraftContours(id) {
        return id === "zaslavskoe";
      }
    },
    showSection(sectionName) {
      openedSections.push(sectionName);
    },
    klevbyShowWaterDepthContours(id) {
      contourRequests.push(id);
      return Promise.resolve(true);
    },
    open(...args) {
      externalOpens.push(args);
    },
    ...options.window
  };

  vm.runInContext(source, vm.createContext({ window, document, URL, console }), {
    filename: "water-body-detail.js"
  });

  return { api: window.KlevbyWaterBodyDetail, elements, openedSections, contourRequests, externalOpens };
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
  assert.equal(elements.get(".water-body-detail-status-text").textContent, "Черновая схема");
  assert.equal(elements.get(".water-body-detail-source").textContent, "Источник: черновая база KlevGo");
  assert.equal(elements.get(".water-body-detail-data-status").textContent, "Данные уточняются");
  assert.equal(elements.get(".water-body-detail-location-source").textContent, "Открытые источники / ручная проверка");
  assert.equal(elements.get(".water-body-detail-depth-action").href, "");
  assert.equal(elements.get(".water-body-detail-depth-action").disabled, true);
  assert.equal(elements.get(".water-body-detail-depth-action").textContent, "Схема глубин готовится");
  assert.equal(elements.get("#appHeaderBackBtn").focused, true);
});

test("Zaslavskoe enables the internal draft depth contour action", () => {
  const { api, elements } = loadDetailScreen();

  api.open({ id: "zaslavskoe", name: "Заславское водохранилище" });

  const action = elements.get(".water-body-detail-depth-action");
  assert.equal(action.disabled, false);
  assert.equal(action.textContent, "Показать схему глубин");
});

test("water_body_id also enables the local Zaslavskoe contour action", () => {
  const { api, elements } = loadDetailScreen();

  api.open({ water_body_id: "zaslavskoe", name: "Заславское водохранилище" });

  assert.equal(api.getSelectedPoint().id, "zaslavskoe");
  assert.equal(elements.get(".water-body-detail-depth-action").disabled, false);
});

test("depth action calls the internal KlevGo contour flow without opening an external URL", async () => {
  const { api, elements, contourRequests, externalOpens } = loadDetailScreen();
  api.open({
    id: "zaslavskoe",
    name: "Заславское водохранилище",
    sourceUrl: "https://external.example/depths"
  });

  elements.get(".water-body-detail-depth-action").click();
  await Promise.resolve();

  assert.deepEqual(contourRequests, ["zaslavskoe"]);
  assert.deepEqual(externalOpens, []);
});

test("safe depth source URL accepts only absolute credential-free HTTP(S) URLs", () => {
  const { api } = loadDetailScreen();

  assert.equal(api.getSafeSourceUrl("https://fishermap.org/map?water=42"), "https://fishermap.org/map?water=42");
  assert.equal(api.getSafeSourceUrl("http://example.com/depths"), "http://example.com/depths");
  assert.equal(api.getSafeSourceUrl("javascript:alert(1)"), "");
  assert.equal(api.getSafeSourceUrl("/relative/source"), "");
  assert.equal(api.getSafeSourceUrl("https://user:secret@example.com/depths"), "");
});

test("source URL remains internal and is never exposed as the depth action", () => {
  const { api, elements } = loadDetailScreen();

  api.open({
    name: "Тестовый водоём",
    source: "fishermap_depth_map_v1",
    sourceUrl: "https://fishermap.example/depths"
  });

  assert.equal(api.getSelectedPoint().sourceUrl, "https://fishermap.example/depths");
  assert.equal(elements.get(".water-body-detail-source").textContent, "Источник: черновая база KlevGo");
  assert.equal(elements.get(".water-body-detail-depth-action").href, "");
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
  assert.match(detailMarkup, /Собираем свою базу глубин KlevGo/);
  assert.match(detailMarkup, /Схема глубин готовится/);
  assert.match(detailMarkup, /class="water-body-detail-depth-action" type="button" disabled/);
  assert.match(detailMarkup, /Данные уточняются/);
  assert.equal(detailMarkup.includes("Открыть карту глубин"), false);
  assert.equal(detailMarkup.includes('target="_blank"'), false);
  assert.equal(detailMarkup.includes("water-body-detail-depth-link"), false);
});
