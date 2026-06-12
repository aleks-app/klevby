(function initKlevbyWaterDepthPreviewSheet(global) {
  const SHEET_ID = "klevbyWaterDepthPreviewSheet";
  const SWIPE_CLOSE_THRESHOLD_PX = 72;

  let sheet = null;
  let currentPoint = null;
  let dragStartY = null;
  let dragOffsetY = 0;

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
      name: toDisplayText(point.name, "Водоём"),
      waterType: toDisplayText(point.waterType, "Тип водоёма не указан"),
      region: toDisplayText(point.region),
      district: toDisplayText(point.district),
      source: toDisplayText(point.source, "Источник не указан"),
      sourceUrl: toDisplayText(point.sourceUrl),
      quality: toDisplayText(point.quality),
      locationQuality: toDisplayText(point.locationQuality, "Не указано"),
      locationSource: toDisplayText(point.locationSource)
    };
  }

  function setText(selector, value) {
    const element = sheet?.querySelector(selector);
    if (element) element.textContent = value;
  }

  function resetDrag() {
    dragStartY = null;
    dragOffsetY = 0;

    if (sheet) {
      sheet.style.removeProperty("--water-depth-sheet-drag-y");
      sheet.classList.remove("is-dragging");
    }
  }

  function close(options) {
    if (!sheet) {
      currentPoint = null;
      return;
    }

    const restoreFocus = options?.restoreFocus === true;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    resetDrag();
    currentPoint = null;

    if (restoreFocus) {
      document.querySelector('[data-map-action="depths"]')?.focus();
    }
  }

  function render(point) {
    if (!sheet) return;

    const location = [point.region, point.district].filter(Boolean).join(" · ");
    const locationQuality = point.locationSource
      ? `${point.locationQuality} · ${point.locationSource}`
      : point.locationQuality;
    setText(".water-depth-preview-name", point.name);
    setText(".water-depth-preview-water-type", point.waterType);
    setText(".water-depth-preview-location", location || "Регион не указан");
    setText(".water-depth-preview-location-quality", locationQuality);
    setText(".water-depth-preview-source-name", `Источник: ${point.source}`);
  }

  function open(properties) {
    ensureCreated();
    if (!sheet) return;

    currentPoint = normalizePoint(properties);
    render(currentPoint);
    resetDrag();
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function isOpen() {
    return Boolean(sheet?.classList.contains("is-open"));
  }

  function onPointerDown(event) {
    if (!isOpen() || (event.pointerType === "mouse" && event.button !== 0)) return;

    dragStartY = event.clientY;
    dragOffsetY = 0;
    sheet.classList.add("is-dragging");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (dragStartY === null) return;

    dragOffsetY = Math.max(0, event.clientY - dragStartY);
    sheet.style.setProperty("--water-depth-sheet-drag-y", `${dragOffsetY}px`);
  }

  function onPointerEnd(event) {
    if (dragStartY === null) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const shouldClose = dragOffsetY >= SWIPE_CLOSE_THRESHOLD_PX;
    resetDrag();

    if (shouldClose) close();
  }

  function ensureCreated(host) {
    if (sheet?.isConnected) return sheet;

    const mapHost = host || document.getElementById("map");
    if (!mapHost) return null;

    sheet = document.createElement("section");
    sheet.id = SHEET_ID;
    sheet.className = "water-depth-preview-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "false");
    sheet.setAttribute("aria-hidden", "true");
    sheet.setAttribute("aria-labelledby", `${SHEET_ID}Title`);
    sheet.innerHTML = `
      <div class="water-depth-preview-drag-zone">
        <span class="water-depth-preview-drag-handle" aria-hidden="true"></span>
      </div>
      <button class="water-depth-preview-close" type="button" aria-label="Закрыть">×</button>
      <div class="water-depth-preview-content">
        <p class="water-depth-preview-eyebrow">Глубины найдены</p>
        <h2 class="water-depth-preview-name" id="${SHEET_ID}Title"></h2>
        <p class="water-depth-preview-meta">
          <span class="water-depth-preview-water-type"></span>
          <span aria-hidden="true">•</span>
          <span class="water-depth-preview-location"></span>
        </p>
        <dl class="water-depth-preview-details">
          <div>
            <dt>Точность точки</dt>
            <dd class="water-depth-preview-location-quality"></dd>
          </div>
          <div>
            <dt>Данные</dt>
            <dd class="water-depth-preview-source-name"></dd>
          </div>
        </dl>
        <button class="water-depth-preview-cta" type="button">Открыть водоём</button>
      </div>
    `;

    sheet.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    sheet.querySelector(".water-depth-preview-close")?.addEventListener("click", function () {
      close({ restoreFocus: true });
    });
    sheet.querySelector(".water-depth-preview-cta")?.addEventListener("click", function () {
      if (!currentPoint || typeof global.KlevbyWaterBodyDetail?.open !== "function") return;

      const selectedPoint = { ...currentPoint };
      close();
      global.KlevbyWaterBodyDetail.open(selectedPoint);
    });

    const dragZone = sheet.querySelector(".water-depth-preview-drag-zone");
    dragZone?.addEventListener("pointerdown", onPointerDown);
    dragZone?.addEventListener("pointermove", onPointerMove);
    dragZone?.addEventListener("pointerup", onPointerEnd);
    dragZone?.addEventListener("pointercancel", onPointerEnd);

    mapHost.appendChild(sheet);
    return sheet;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      close({ restoreFocus: true });
    }
  });

  global.KlevbyWaterDepthPreviewSheet = {
    ensureCreated,
    normalizePoint,
    open,
    close,
    isOpen,
    getSelectedPoint: function () {
      return currentPoint ? { ...currentPoint } : null;
    }
  };
})(window);
