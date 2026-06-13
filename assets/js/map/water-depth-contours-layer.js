(function initKlevbyWaterDepthContoursLayer(global) {
  const SOURCE_ID = "klevby-water-depth-contours-draft";
  const FILL_LAYER_ID = "klevby-water-depth-contours-draft-fill";
  const LINE_LAYER_ID = "klevby-water-depth-contours-draft-lines";
  const ZVON_SOURCE_ID = "klevby-water-depth-zvon";
  const ZVON_FILL_LAYER_ID = "klevby-water-depth-zvon-fill";
  const ZVON_LINE_LAYER_ID = "klevby-water-depth-zvon-lines";
  const ZVON_POINT_LAYER_ID = "klevby-water-depth-zvon-points";
  const ZVON_CONTOUR_URL = "assets/data/depth-contours/zvon.depth.full.geojson";
  const ZVON_CENTER = [28.531068, 55.063978];
  const ZVON_LAYER_IDS = [ZVON_FILL_LAYER_ID, ZVON_LINE_LAYER_ID, ZVON_POINT_LAYER_ID];
  const DISCLAIMER_CLASS = "water-depth-contours-draft-note";
  const DISCLAIMER_TEXT = "Глубины ориентировочные · данные уточняются";
  // Reserved for future proper, licensed, or imported depth-map data.
  // The local Zaslavskoe draft remains an internal validation sample only.
  const DRAFT_CONTOURS = Object.freeze({});

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

  function hasValidCoordinates(coordinates, minimumPositions) {
    const positions = [];

    function collect(value) {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
        positions.push(value);
        return;
      }
      value.forEach(collect);
    }

    collect(coordinates);
    return positions.length >= minimumPositions;
  }

  function isSupportedDraftGeometry(feature) {
    const geometryType = feature?.geometry?.type;
    const coordinates = feature?.geometry?.coordinates;

    if (feature?.properties?.depth_type === "zone") {
      return (geometryType === "Polygon" || geometryType === "MultiPolygon") &&
        hasValidCoordinates(coordinates, 4);
    }

    return feature?.properties?.depth_type === "isobath" &&
      geometryType === "LineString" &&
      hasValidCoordinates(coordinates, 2);
  }

  function isDraftFeatureCollection(data, waterBodyId) {
    const normalizedId = normalizeWaterBodyId(waterBodyId);

    return Boolean(
      data &&
      data.type === "FeatureCollection" &&
      Array.isArray(data.features) &&
      data.features.length > 0 &&
      data.features.every(function (feature) {
        const properties = feature?.properties;
        const hasDepth = Number.isFinite(properties?.depth_m) ||
          (typeof properties?.depth_range === "string" && properties.depth_range.trim());

        return feature?.type === "Feature" &&
          normalizeWaterBodyId(properties?.water_body_id) === normalizedId &&
          hasDepth &&
          properties?.accuracy === "draft" &&
          properties?.source_status === "draft" &&
          properties?.checked_at === null &&
          isSupportedDraftGeometry(feature);
      })
    );
  }

  function getFillLayerDefinition() {
    return {
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      filter: ["==", ["get", "depth_type"], "zone"],
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "depth_m"],
          0, "#bae6fd",
          2, "#7dd3fc",
          5, "#38bdf8",
          8, "#2563eb",
          12, "#172554"
        ],
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["get", "depth_m"],
          0, 0.2,
          5, 0.3,
          8, 0.36,
          12, 0.46
        ]
      }
    };
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
      filter: ["in", ["get", "depth_type"], ["literal", ["zone", "isobath"]]],
      paint: {
        "line-color": [
          "interpolate",
          ["linear"],
          ["get", "depth_m"],
          0, "#7dd3fc",
          3, "#38bdf8",
          6, "#2563eb",
          12, "#172554"
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7, 1.2,
          12, 2,
          16, 2.8
        ],
        "line-opacity": 0.7
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

    if (typeof map.getLayer === "function" && map.getLayer(FILL_LAYER_ID)) {
      map.removeLayer(FILL_LAYER_ID);
    }

    if (typeof map.getSource === "function" && map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    activeWaterBodyId = "";
    setDisclaimerVisible(map, false);
    return true;
  }

  function countGeometryTypes(data) {
    return (data?.features || []).reduce(function (counts, feature) {
      const geometryType = feature?.geometry?.type;
      if (geometryType) counts[geometryType] = (counts[geometryType] || 0) + 1;
      return counts;
    }, { Polygon: 0, LineString: 0, Point: 0 });
  }

  function getZvonLayerDefinitions() {
    const depthValue = ["abs", ["to-number", ["get", "depth_m"], 0]];
    const depthColor = [
      "case",
      ["has", "depth_m"],
      [
        "interpolate",
        ["linear"],
        depthValue,
        0, "#67e8f9",
        2, "#38bdf8",
        5, "#3b82f6",
        9, "#4f46e5",
        13, "#312e81",
        18, "#172554"
      ],
      "#4338ca"
    ];

    return [
      {
        id: ZVON_FILL_LAYER_ID,
        type: "fill",
        source: ZVON_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": depthColor,
          "fill-opacity": 0.52
        }
      },
      {
        id: ZVON_LINE_LAYER_ID,
        type: "line",
        source: ZVON_SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#7dd3fc",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1,
            16, 1.5
          ],
          "line-opacity": 0.82
        }
      },
      {
        id: ZVON_POINT_LAYER_ID,
        type: "symbol",
        source: ZVON_SOURCE_ID,
        minzoom: 13,
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name"],
            ["concat", ["to-string", depthValue], " м"]
          ],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 10,
            16, 11
          ],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-allow-overlap": false,
          "text-ignore-placement": false
        },
        paint: {
          "text-color": "#dbeafe",
          "text-opacity": 0.9,
          "text-halo-color": "#172554",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.5
        }
      }
    ];
  }

  function removeZvonDepth(map) {
    if (!map) return false;

    ZVON_LAYER_IDS.slice().reverse().forEach(function (layerId) {
      if (typeof map.getLayer === "function" && map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    if (typeof map.getSource === "function" && map.getSource(ZVON_SOURCE_ID)) {
      map.removeSource(ZVON_SOURCE_ID);
    }

    return true;
  }

  async function showZvonDepth(map) {
    if (!map || typeof global.fetch !== "function") return false;

    console.info("Klevby depth diagnostic: started loading Zvon depth", ZVON_CONTOUR_URL);
    const response = await global.fetch(ZVON_CONTOUR_URL);
    console.info("Klevby depth diagnostic: fetch response", {
      status: response.status,
      ok: response.ok,
      url: response.url || ZVON_CONTOUR_URL
    });

    if (!response.ok) {
      throw new Error(`Не удалось загрузить глубины озера Звонь: ${response.status}`);
    }

    const data = await response.json();
    const featureCount = Array.isArray(data?.features) ? data.features.length : 0;
    const geometryCounts = countGeometryTypes(data);
    console.info("Klevby depth diagnostic: GeoJSON loaded", {
      featureCount,
      geometryCounts
    });

    if (data?.type !== "FeatureCollection" || !featureCount) {
      throw new Error("Некорректные данные глубин озера Звонь");
    }

    removeZvonDepth(map);
    map.addSource(ZVON_SOURCE_ID, { type: "geojson", data });

    // No beforeId is passed so the depth overlay stays readable above the basemap.
    getZvonLayerDefinitions().forEach(function (layer) {
      map.addLayer(layer);
    });

    console.info("Klevby depth diagnostic: rendered map objects", {
      source: map.getSource(ZVON_SOURCE_ID),
      layers: ZVON_LAYER_IDS.reduce(function (layers, layerId) {
        layers[layerId] = map.getLayer(layerId);
        return layers;
      }, {})
    });

    if (typeof map.flyTo === "function") {
      map.flyTo({ center: ZVON_CENTER, zoom: 13, duration: 500 });
    }

    return true;
  }

  function getBounds(data) {
    let bounds = null;

    function includeCoordinates(coordinates) {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
        const longitude = coordinates[0];
        const latitude = coordinates[1];
        if (!bounds) bounds = [[longitude, latitude], [longitude, latitude]];
        bounds[0][0] = Math.min(bounds[0][0], longitude);
        bounds[0][1] = Math.min(bounds[0][1], latitude);
        bounds[1][0] = Math.max(bounds[1][0], longitude);
        bounds[1][1] = Math.max(bounds[1][1], latitude);
        return;
      }
      coordinates.forEach(includeCoordinates);
    }

    data.features.forEach(function (feature) {
      includeCoordinates(feature.geometry.coordinates);
    });
    return bounds;
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

    if (!map.getLayer(FILL_LAYER_ID)) {
      map.addLayer(getFillLayerDefinition());
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
    FILL_LAYER_ID,
    LINE_LAYER_ID,
    ZVON_SOURCE_ID,
    ZVON_FILL_LAYER_ID,
    ZVON_LINE_LAYER_ID,
    ZVON_POINT_LAYER_ID,
    ZVON_CONTOUR_URL,
    ZVON_CENTER,
    DISCLAIMER_CLASS,
    DISCLAIMER_TEXT,
    DRAFT_CONTOURS,
    normalizeWaterBodyId,
    getDraftContourUrl,
    hasDraftContours,
    isDraftFeatureCollection,
    getFillLayerDefinition,
    getLineLayerDefinition,
    getZvonLayerDefinitions,
    countGeometryTypes,
    showZvonDepth,
    removeZvonDepth,
    showDraftContours,
    removeDraftContours,
    setDisclaimerVisible,
    getActiveWaterBodyId: function () {
      return activeWaterBodyId;
    }
  };
})(window);
