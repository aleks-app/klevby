(function initKlevbyWaterBodyDetail(global) {
  const SECTION_ID = "waterBodyDetailSection";
  let selectedPoint = null;

  function toDisplayText(value, fallback) {
    const text = typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";

    return text || fallback || "";
  }

  function normalizePoint(properties) {
    const point = properties && typeof properties === "object" ? properties : {};

    return {
      id: toDisplayText(point.water_body_id || point.id),
      name: toDisplayText(point.name, "Водоём"),
      waterType: toDisplayText(point.waterType, "Тип водоёма не указан"),
      region: toDisplayText(point.region),
      district: toDisplayText(point.district),
      source: toDisplayText(point.source, "Источник не указан"),
      sourceUrl: toDisplayText(point.sourceUrl),
      quality: toDisplayText(point.quality),
      locationQuality: toDisplayText(point.locationQuality, "Не указано"),
      locationSource: toDisplayText(point.locationSource, "Не указано")
    };
  }

  function getSafeSourceUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";

    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      if (!url.hostname || url.username || url.password) return "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function setText(section, selector, value) {
    const element = section?.querySelector(selector);
    if (element) element.textContent = value;
  }

  function render(point) {
    const section = document.getElementById(SECTION_ID);
    if (!section) return false;

    const location = [point.region, point.district].filter(Boolean).join(" · ");
    setText(section, ".water-body-detail-name", point.name);
    setText(section, ".water-body-detail-type", point.waterType);
    setText(section, ".water-body-detail-location", location || "Регион не указан");
    setText(section, ".water-body-detail-status-text", "Черновая схема");
    setText(section, ".water-body-detail-source", "Источник: черновая база KlevGo");
    setText(section, ".water-body-detail-data-status", "Данные уточняются");
    setText(section, ".water-body-detail-location-quality", point.locationQuality);
    setText(
      section,
      ".water-body-detail-location-source",
      point.locationSource ? "Открытые источники / ручная проверка" : "Данные уточняются"
    );

    const depthAction = section.querySelector(".water-body-detail-depth-action");
    const hasDraftContours = global.KlevbyWaterDepthContoursLayer?.hasDraftContours(point.id) === true;
    if (depthAction) {
      depthAction.disabled = !hasDraftContours;
      depthAction.textContent = hasDraftContours
        ? "Показать схему глубин"
        : "Схема глубин готовится";
    }

    return true;
  }

  function open(properties) {
    selectedPoint = normalizePoint(properties);
    if (!render(selectedPoint)) return false;

    if (typeof global.showSection === "function") {
      global.showSection("water-body-detail");
      document.getElementById("appHeaderBackBtn")?.focus();
      return true;
    }

    return false;
  }

  function close() {
    if (typeof global.showSection !== "function") return false;

    global.showSection("map");
    return true;
  }

  async function showDepthContours() {
    if (!selectedPoint || !global.KlevbyWaterDepthContoursLayer?.hasDraftContours(selectedPoint.id)) {
      return false;
    }

    if (typeof global.klevbyShowWaterDepthContours !== "function") return false;
    return global.klevbyShowWaterDepthContours(selectedPoint.id);
  }

  function bind() {
    const section = document.getElementById(SECTION_ID);
    if (!section || section.dataset.waterBodyDetailBound === "true") return;

    section.dataset.waterBodyDetailBound = "true";
    section.querySelector(".water-body-detail-depth-action")?.addEventListener("click", function () {
      void showDepthContours().catch(function (error) {
        console.warn("KlevGo: не удалось показать черновую схему глубин.", error);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  global.KlevbyWaterBodyDetail = {
    SECTION_ID,
    normalizePoint,
    getSafeSourceUrl,
    render,
    open,
    close,
    showDepthContours,
    bind,
    getSelectedPoint: function () {
      return selectedPoint ? { ...selectedPoint } : null;
    }
  };
})(window);
