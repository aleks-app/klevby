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
      id: toDisplayText(point.id),
      waterBodyId: toDisplayText(point.water_body_id || point.waterBodyId),
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

  function getDepthMapStatusForWaterBody(waterBodyId) {
    const depthEntry = global.KlevbyDepthMapsRegistry?.getByWaterBodyId?.(waterBodyId) || null;

    if (!depthEntry || depthEntry.status === "disabled") {
      const cachedRegistryEntry = global.KlevbyLastKnownMap?.readRegistryEntry?.(waterBodyId) || null;
      if (cachedRegistryEntry) {
        return {
          available: cachedRegistryEntry.status === "available",
          status: cachedRegistryEntry.status || "draft",
          label:
            cachedRegistryEntry.status === "available"
              ? "Последние сохранённые данные глубин"
              : "Карта глубин готовится",
          maxDepth: cachedRegistryEntry.maxDepth || null,
          depthMapId: cachedRegistryEntry.id,
          waterBodyId: cachedRegistryEntry.waterBodyId || cachedRegistryEntry.id,
          format: cachedRegistryEntry.format || "geojson",
          fromCache: true,
        };
      }

      return {
        available: false,
        status: "unavailable",
        label: global.KlevbyLastKnownCache?.isNetworkDegraded?.()
          ? "Данные водоёма недоступны без интернета"
          : "Карта глубин пока недоступна",
      };
    }

    const statusModel = {
      available: depthEntry.status === "available",
      status: depthEntry.status,
      label: depthEntry.status === "available"
        ? "Карта глубин доступна"
        : "Карта глубин готовится",
      maxDepth: depthEntry.maxDepth || null,
      depthMapId: depthEntry.id,
      waterBodyId: depthEntry.waterBodyId || depthEntry.id,
      format: depthEntry.format || "geojson"
    };

    return statusModel;
  }

  function renderCachedNotice(section, visible) {
    if (!section) return;

    let notice = section.querySelector(".klevby-waterbody-cached-notice");
    if (!visible) {
      notice?.remove();
      return;
    }

    if (!notice) {
      notice = document.createElement("div");
      notice.className = "klevby-waterbody-cached-notice";
      section.querySelector(".water-body-detail-content")?.prepend(notice);
    }

    notice.innerHTML =
      global.KlevbyLastKnownUi?.savedNoticeHtml?.({
        title: "Последние сохранённые данные",
        subtitle: "Обновятся, когда появится интернет",
        compact: true,
      }) || "";
  }

  function render(point, options) {
    const section = document.getElementById(SECTION_ID);
    if (!section) return false;

    const fromCache = Boolean(options?.fromCache);
    const depthStatus = getDepthMapStatusForWaterBody(point.waterBodyId);
    const location = [point.region, point.district].filter(Boolean).join(" · ");
    setText(section, ".water-body-detail-name", point.name);
    setText(section, ".water-body-detail-type", point.waterType);
    setText(section, ".water-body-detail-location", location || "Регион не указан");
    setText(
      section,
      ".water-body-detail-status-text",
      fromCache ? "Последние сохранённые данные" : depthStatus.label,
    );
    setText(
      section,
      ".water-body-detail-draft-copy",
      depthStatus.maxDepth ? `До ${depthStatus.maxDepth} м` : depthStatus.label
    );
    setText(
      section,
      ".water-body-detail-draft-note",
      fromCache
        ? "Обновятся, когда появится интернет"
        : depthStatus.depthMapId
          ? `Формат: ${depthStatus.format}`
          : "Данные уточняются"
    );
    setText(section, ".water-body-detail-source", "Источник не указан");
    setText(section, ".water-body-detail-data-status", depthStatus.label);
    setText(section, ".water-body-detail-location-quality", point.locationQuality);
    setText(
      section,
      ".water-body-detail-location-source",
      point.locationSource ? "Открытые источники / ручная проверка" : "Данные уточняются"
    );

    const depthAction = section.querySelector(".water-body-detail-depth-action");
    if (depthAction) {
      const canOpenDepth =
        depthStatus.available &&
        !global.KlevbyLastKnownCache?.isNetworkDegraded?.();
      depthAction.disabled = !canOpenDepth;
      depthAction.textContent = canOpenDepth
        ? "Открыть глубины"
        : fromCache
          ? "Глубины офлайн"
          : "Скоро";
    }

    renderCachedNotice(section, fromCache || depthStatus.fromCache === true);

    return true;
  }

  function open(properties) {
    selectedPoint = normalizePoint(properties);
    const fromCache = Boolean(properties?.fromCache);
    if (!fromCache) {
      global.KlevbyLastKnownMap?.saveWaterbody?.(selectedPoint, { source: "water-body-detail.open" });
    }
    if (!render(selectedPoint, { fromCache })) return false;

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
    if (global.KlevbyLastKnownCache?.isNetworkDegraded?.()) {
      return false;
    }

    const depthStatus = getDepthMapStatusForWaterBody(selectedPoint?.waterBodyId);
    if (!depthStatus.available || typeof global.klevbyShowWaterDepthContours !== "function") return false;

    if (typeof global.showSection === "function") {
      global.showSection("map");
    }

    await new Promise(function (resolve) {
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(resolve);
      } else {
        resolve();
      }
    });

    return global.klevbyShowWaterDepthContours(depthStatus.waterBodyId, { fitBounds: true });
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
    getDepthMapStatusForWaterBody,
    getSafeSourceUrl,
    render,
    open,
    close,
    showDepthContours,
    bind,
    openFromCache(waterBodyId) {
      const cached = global.KlevbyLastKnownMap?.readWaterbody?.()?.data;
      if (!cached) return false;
      if (waterBodyId && cached.waterBodyId !== waterBodyId && cached.id !== waterBodyId) {
        return false;
      }
      return open({ ...cached, fromCache: true });
    },
    getSelectedPoint: function () {
      return selectedPoint ? { ...selectedPoint } : null;
    }
  };
})(window);
