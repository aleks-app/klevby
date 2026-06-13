(function initKlevbyWaterDepthContoursLayer(global) {
  const SOURCE_ID = "klevby-water-depth-contours-draft";
  const LINE_LAYER_ID = "klevby-water-depth-contours-draft-lines";
  const DISCLAIMER_CLASS = "water-depth-contours-draft-note";
  const DISCLAIMER_TEXT = "Глубины ориентировочные · данные уточняются";
  const DRAFT_CONTOURS = Object.freeze({
    zaslavskoe: "assets/data/depth-contours/zaslavskoe.draft.geojson"
  });

  let activeWaterBodyId = "";

  function normalizeWaterBodyId(value) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim().toLowerCase()
      : "";
  }

  function getDraftContourUrl(waterBodyId) {
    return DRAFT_CONTOURS[normalizeWaterBodyId(waterBodyId)] || "";
  }

  function hasDraftContours(waterBodyId) {
    return Boolean(getDraftContourUrl(waterBodyId));
  }

  function isDraftFeatureCollection(data, waterBodyId) {
    const normalizedId = normalizeWaterBodyId(waterBodyId);

    return Boolean(
      data &&
      data.type === "FeatureCollection" &&
      Array.isArray(data.features) &&
      data.features.length > 0 &&
      data.features.every(function (feature) {
        return feature?.type === "Feature" &&
          normalizeWaterBodyId(feature.properties?.water_body_id) === normalizedId &&
          Number.isFinite(feature.properties?.depth_m) &&
          feature.geometry?.type === "LineString" &&
          Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length > 1;
      })
    );
  }

  function getLineLayerDefinition() {
    return {
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": [
          "interpolate",
          ["linear"],
          ["get", "depth_m"],
          0, "#f59e42",
          3, "#38bdf8",
          6, "#2563eb",
          12, "#1d4ed8"
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7, 1.2,
          12, 2,
          16, 2.8
        ],
        "line-opacity": 0.78
      }
    };
  }

  function getMapContainer(map) {
    if (typeof map?.getContainer === "function") return map.getContainer();
    return document.getElementById("map");
  }

  function setDisclaimerVisible(map, visible) {
    const container = getMapContainer(map);
    if (!container) return;

    let note = container.querySelector?.(`.${DISCLAIMER_CLASS}`) || null;

    if (visible && !note) {
      note = document.createElement("div");
      note.className = DISCLAIMER_CLASS;
      note.textContent = DISCLAIMER_TEXT;
      note.setAttribute("role", "note");
      container.appendChild(note);
    }

    if (note) note.hidden = !visible;
  }

  function removeDraftContours(map) {
    if (!map) return false;

    if (typeof map.getLayer === "function" && map.getLayer(LINE_LAYER_ID)) {
      map.removeLayer(LINE_LAYER_ID);
    }

    if (typeof map.getSource === "function" && map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    activeWaterBodyId = "";
    setDisclaimerVisible(map, false);
    return true;
  }

  function getBounds(data) {
    const coordinates = data.features.flatMap(function (feature) {
      return feature.geometry.coordinates;
    });

    return coordinates.reduce(function (bounds, coordinate) {
      const longitude = coordinate?.[0];
      const latitude = coordinate?.[1];
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return bounds;

      if (!bounds) return [[longitude, latitude], [longitude, latitude]];
      bounds[0][0] = Math.min(bounds[0][0], longitude);
      bounds[0][1] = Math.min(bounds[0][1], latitude);
      bounds[1][0] = Math.max(bounds[1][0], longitude);
      bounds[1][1] = Math.max(bounds[1][1], latitude);
      return bounds;
    }, null);
  }

  async function showDraftContours(map, waterBodyId) {
    const normalizedId = normalizeWaterBodyId(waterBodyId);
    const contourUrl = getDraftContourUrl(normalizedId);
    if (!map || !contourUrl || typeof global.fetch !== "function") return false;

    const response = await global.fetch(contourUrl);
    if (!response.ok) throw new Error(`Не удалось загрузить черновую схему глубин: ${response.status}`);

    const data = await response.json();
    if (!isDraftFeatureCollection(data, normalizedId)) {
      throw new Error("Некорректные данные черновой схемы глубин");
    }

    removeDraftContours(map);

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data });
    }

    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer(getLineLayerDefinition());
    }

    activeWaterBodyId = normalizedId;
    setDisclaimerVisible(map, true);

    const bounds = getBounds(data);
    if (bounds && typeof map.fitBounds === "function") {
      map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 500 });
    }

    return true;
  }

  global.KlevbyWaterDepthContoursLayer = {
    SOURCE_ID,
    LINE_LAYER_ID,
    DISCLAIMER_CLASS,
    DISCLAIMER_TEXT,
    DRAFT_CONTOURS,
    normalizeWaterBodyId,
    getDraftContourUrl,
    hasDraftContours,
    isDraftFeatureCollection,
    getLineLayerDefinition,
    showDraftContours,
    removeDraftContours,
    setDisclaimerVisible,
    getActiveWaterBodyId: function () {
      return activeWaterBodyId;
    }
  };
})(window);
