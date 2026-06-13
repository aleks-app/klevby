(function initKlevbyWaterDepthContoursLayer(global) {
  const SOURCE_ID = "klevby-water-depth-contours-draft";
  const FILL_LAYER_ID = "klevby-water-depth-contours-draft-fill";
  const LINE_LAYER_ID = "klevby-water-depth-contours-draft-lines";
  const DEPTH_SOURCE_ID = "klevby-water-depth-selected";
  const DEPTH_OVERVIEW_HALO_LAYER_ID = "klevby-water-depth-overview-halo";
  const DEPTH_OVERVIEW_FILL_LAYER_ID = "klevby-water-depth-overview-fill";
  const DEPTH_FILL_LAYER_ID = "klevby-water-depth-selected-fill";
  const DEPTH_LINE_LAYER_ID = "klevby-water-depth-selected-lines";
  const DEPTH_LABEL_LAYER_ID = "klevby-water-depth-selected-labels";
  const DEPTH_MARKER_SOURCE_ID = "klevby-depth-map-markers";
  const DEPTH_MARKER_LAYER_ID = "klevby-depth-map-markers";
  const DEPTH_MARKER_HITBOX_LAYER_ID = "klevby-depth-map-marker-hitbox";
  const DEPTH_MARKER_LABEL_LAYER_ID = "klevby-depth-map-marker-labels";
  const DEPTH_LAYER_IDS = [
    DEPTH_OVERVIEW_HALO_LAYER_ID,
    DEPTH_OVERVIEW_FILL_LAYER_ID,
    DEPTH_FILL_LAYER_ID,
    DEPTH_LINE_LAYER_ID,
    DEPTH_LABEL_LAYER_ID
  ];
  const DEPTH_MAPS = global.KlevbyDepthMapsRegistry?.maps || [];
  const AVAILABLE_DEPTH_MAPS = global.KlevbyDepthMapsRegistry?.getAvailable?.() || DEPTH_MAPS.filter(function (depthMap) {
    return depthMap.status !== "disabled";
  });
  const ZVON_CONTOUR_URL = global.KlevbyDepthMapsRegistry?.getById("zvon")?.url
    || "assets/data/depth-contours/zvon.depth.full.geojson";
  const DISCLAIMER_CLASS = "water-depth-contours-draft-note";
  const DISCLAIMER_TEXT = "Глубины ориентировочные · данные уточняются";
  // Reserved for future proper, licensed, or imported depth-map data.
  // The local Zaslavskoe draft remains an internal validation sample only.
  const DRAFT_CONTOURS = Object.freeze({});

  let activeWaterBodyId = "";
  let activeDepthMapId = "";
  let depthMapLoading = false;
  let depthModeMap = null;
  let depthMarkerClickHandler = null;
  let depthMarkerEnterHandler = null;
  let depthMarkerLeaveHandler = null;
  let depthModeGeneration = 0;
  const depthDataCache = new Map();

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

  function getDepthMapConfig(mapId) {
    const normalizedId = normalizeWaterBodyId(mapId);
    return DEPTH_MAPS.find(function (depthMap) {
      return depthMap.id === normalizedId;
    }) || null;
  }

  function getDepthLayerDefinitions() {
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
        id: DEPTH_OVERVIEW_HALO_LAYER_ID,
        type: "line",
        source: DEPTH_SOURCE_ID,
        maxzoom: 12,
        filter: ["==", ["geometry-type"], "Polygon"],
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#22d3ee",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 2.5,
            9, 3.5,
            12, 2
          ],
          "line-blur": 1.5,
          "line-opacity": 0.9
        }
      },
      {
        id: DEPTH_OVERVIEW_FILL_LAYER_ID,
        type: "fill",
        source: DEPTH_SOURCE_ID,
        maxzoom: 12,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#06b6d4",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 0.72,
            9, 0.62,
            12, 0.22
          ],
          "fill-outline-color": "#67e8f9"
        }
      },
      {
        id: DEPTH_FILL_LAYER_ID,
        type: "fill",
        source: DEPTH_SOURCE_ID,
        minzoom: 10,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": depthColor,
          "fill-opacity": 0.52
        }
      },
      {
        id: DEPTH_LINE_LAYER_ID,
        type: "line",
        source: DEPTH_SOURCE_ID,
        minzoom: 11,
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
        id: DEPTH_LABEL_LAYER_ID,
        type: "symbol",
        source: DEPTH_SOURCE_ID,
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

  function getDepthMarkerLabel(depthMap) {
    const shortName = depthMap?.shortName;
    if (typeof shortName === "string" && shortName.trim()) {
      return shortName.trim();
    }

    const name = typeof depthMap?.name === "string" ? depthMap.name.trim() : "";
    if (!name) return "";

    return name.replace(/\s+водохранилище$/iu, " вод.").trim();
  }

  function getDepthMarkerHitboxRadiusExpression() {
    return ["interpolate", ["linear"], ["zoom"], 5, 22, 12, 28];
  }

  function getDepthMarkerVisibleRadiusExpression() {
    return ["interpolate", ["linear"], ["zoom"], 5, 4, 8.5, 6, 12, 10];
  }

  function getDepthMarkerFeatureCollection(excludedMapId) {
    const normalizedExcludedMapId = normalizeWaterBodyId(excludedMapId);

    return {
      type: "FeatureCollection",
      features: AVAILABLE_DEPTH_MAPS.filter(function (depthMap) {
        return depthMap.id !== normalizedExcludedMapId;
      }).map(function (depthMap) {
        return {
          type: "Feature",
          properties: {
            id: depthMap.id,
            waterBodyId: depthMap.waterBodyId || depthMap.id,
            depthMapId: depthMap.id,
            depthStatus: depthMap.status || "available",
            depthFormat: depthMap.format || "geojson",
            name: getDepthMarkerLabel(depthMap),
            maxDepth: depthMap.maxDepth || null
          },
          geometry: {
            type: "Point",
            coordinates: depthMap.center.slice()
          }
        };
      })
    };
  }

  function getDepthMarkerLayerDefinitions() {
    return [
      {
        id: DEPTH_MARKER_HITBOX_LAYER_ID,
        type: "circle",
        source: DEPTH_MARKER_SOURCE_ID,
        paint: {
          "circle-radius": getDepthMarkerHitboxRadiusExpression(),
          "circle-color": "#000000",
          "circle-opacity": 0
        }
      },
      {
        id: DEPTH_MARKER_LAYER_ID,
        type: "circle",
        source: DEPTH_MARKER_SOURCE_ID,
        paint: {
          "circle-radius": getDepthMarkerVisibleRadiusExpression(),
          "circle-color": "#0c4a6e",
          "circle-stroke-color": "#bae6fd",
          "circle-stroke-width": 2,
          "circle-opacity": 0.93
        }
      },
      {
        id: DEPTH_MARKER_LABEL_LAYER_ID,
        type: "symbol",
        source: DEPTH_MARKER_SOURCE_ID,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 1.35],
          "text-anchor": "top",
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#cffafe",
          "text-halo-color": "#083344",
          "text-halo-width": 1.5
        }
      }
    ];
  }

  function syncDepthMarkers(map) {
    const source = map?.getSource?.(DEPTH_MARKER_SOURCE_ID);
    if (!source || typeof source.setData !== "function") return false;

    source.setData(getDepthMarkerFeatureCollection(activeDepthMapId));
    return true;
  }

  function getDepthMarkerFeatureAtPoint(map, point) {
    if (!map || !point || !map.getLayer?.(DEPTH_MARKER_HITBOX_LAYER_ID)) return null;

    try {
      return map.queryRenderedFeatures(point, {
        layers: [DEPTH_MARKER_HITBOX_LAYER_ID]
      })[0] || null;
    } catch (_) {
      return null;
    }
  }

  function removeDepthMap(map) {
    if (!map) return false;

    DEPTH_LAYER_IDS.slice().reverse().forEach(function (layerId) {
      if (typeof map.getLayer === "function" && map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    if (typeof map.getSource === "function" && map.getSource(DEPTH_SOURCE_ID)) {
      map.removeSource(DEPTH_SOURCE_ID);
    }

    activeDepthMapId = "";
    return true;
  }

  async function showDepthMap(map, mapId) {
    if (!map || typeof global.fetch !== "function") return false;
    const depthMap = getDepthMapConfig(mapId);
    if (!depthMap || depthMapLoading) return false;

    depthMapLoading = true;
    const requestGeneration = depthModeGeneration;
    let data = depthDataCache.get(depthMap.id);

    try {
      if (!data) {
        const response = await global.fetch(depthMap.url);

        if (!response.ok) {
          throw new Error(`Не удалось загрузить глубины «${depthMap.name}»: ${response.status}`);
        }

        data = await response.json();
      }
      const featureCount = Array.isArray(data?.features) ? data.features.length : 0;

      if (data?.type !== "FeatureCollection" || !featureCount) {
        throw new Error(`Некорректные данные глубин «${depthMap.name}»`);
      }

      depthDataCache.set(depthMap.id, data);
      if (requestGeneration !== depthModeGeneration || (depthModeMap && depthModeMap !== map)) return false;
      removeDepthMap(map);
      map.addSource(DEPTH_SOURCE_ID, { type: "geojson", data });

      // No beforeId is passed so the depth overlay stays readable above the basemap.
      getDepthLayerDefinitions().forEach(function (layer) {
        map.addLayer(layer);
      });

      activeDepthMapId = depthMap.id;
      syncDepthMarkers(map);
      return true;
    } finally {
      depthMapLoading = false;
    }
  }

  async function selectDepthMap(map, mapId) {
    if (depthMapLoading) return false;

    try {
      return await showDepthMap(map, mapId);
    } catch (error) {
      console.warn("Klevby Map: failed to load selected depth map", {
        id: normalizeWaterBodyId(mapId),
        error
      });
      return false;
    }
  }

  function removeDepthMarkers(map) {
    if (!map) return false;

    if (depthModeMap === map && typeof map.off === "function") {
      if (depthMarkerClickHandler) map.off("click", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerClickHandler);
      if (depthMarkerEnterHandler) map.off("mouseenter", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerEnterHandler);
      if (depthMarkerLeaveHandler) map.off("mouseleave", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerLeaveHandler);
    }

    [DEPTH_MARKER_LABEL_LAYER_ID, DEPTH_MARKER_LAYER_ID, DEPTH_MARKER_HITBOX_LAYER_ID].forEach(function (layerId) {
      if (typeof map.getLayer === "function" && map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (typeof map.getSource === "function" && map.getSource(DEPTH_MARKER_SOURCE_ID)) {
      map.removeSource(DEPTH_MARKER_SOURCE_ID);
    }

    depthModeMap = null;
    depthMarkerClickHandler = null;
    depthMarkerEnterHandler = null;
    depthMarkerLeaveHandler = null;
    return true;
  }

  function enableDepthMode(map) {
    if (!map) return false;

    removeDepthMarkers(map);
    depthModeGeneration += 1;
    map.addSource(DEPTH_MARKER_SOURCE_ID, {
      type: "geojson",
      data: getDepthMarkerFeatureCollection()
    });
    getDepthMarkerLayerDefinitions().forEach(function (layer) {
      map.addLayer(layer);
    });

    depthModeMap = map;
    depthMarkerClickHandler = function (event) {
      event?.preventDefault?.();
      event?.originalEvent?.preventDefault?.();
      event?.originalEvent?.stopPropagation?.();
      const mapId = event?.features?.[0]?.properties?.id;
      if (mapId) void selectDepthMap(map, mapId);
    };
    depthMarkerEnterHandler = function () {
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = "pointer";
    };
    depthMarkerLeaveHandler = function () {
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = "";
    };

    if (typeof map.on === "function") {
      map.on("click", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerClickHandler);
      map.on("mouseenter", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerEnterHandler);
      map.on("mouseleave", DEPTH_MARKER_HITBOX_LAYER_ID, depthMarkerLeaveHandler);
    }
    return true;
  }

  function disableDepthMode(map) {
    depthModeGeneration += 1;
    removeDepthMarkers(map);
    removeDepthMap(map);
    return true;
  }

  async function showAllDepthMaps(map) {
    if (!map || typeof global.fetch !== "function") return false;

    const results = await Promise.allSettled(DEPTH_MAPS.map(async function (depthMap) {
      const response = await global.fetch(depthMap.url);

      if (!response.ok) {
        throw new Error(`Не удалось загрузить глубины «${depthMap.name}»: ${response.status}`);
      }

      const data = await response.json();
      if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || !data.features.length) {
        throw new Error(`Некорректные данные глубин «${depthMap.name}»`);
      }

      return data;
    }));
    const collections = [];
    let failedMaps = 0;

    results.forEach(function (result, index) {
      const depthMap = DEPTH_MAPS[index];

      if (result.status === "fulfilled") {
        collections.push(result.value);
        return;
      }

      failedMaps += 1;
      console.warn("Klevby Map: failed to load depth map", {
        name: depthMap.name,
        url: depthMap.url,
        error: result.reason
      });
    });

    if (!collections.length) {
      removeDepthMap(map);
      return false;
    }

    const data = {
      type: "FeatureCollection",
      features: collections.flatMap(function (collection) {
        return collection.features;
      })
    };

    removeDepthMap(map);
    map.addSource(DEPTH_SOURCE_ID, { type: "geojson", data });
    getDepthLayerDefinitions().forEach(function (layer) {
      map.addLayer(layer);
    });

    activeDepthMapId = "all";
    console.info("Klevby Map: depth maps loaded", {
      successfulMaps: collections.length,
      failedMaps,
      totalFeatures: data.features.length
    });
    return true;
  }

  function showZvonDepth(map) {
    return showDepthMap(map, "zvon");
  }

  function removeZvonDepth(map) {
    return removeDepthMap(map);
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
    DEPTH_SOURCE_ID,
    DEPTH_OVERVIEW_HALO_LAYER_ID,
    DEPTH_OVERVIEW_FILL_LAYER_ID,
    DEPTH_FILL_LAYER_ID,
    DEPTH_LINE_LAYER_ID,
    DEPTH_LABEL_LAYER_ID,
    DEPTH_MARKER_SOURCE_ID,
    DEPTH_MARKER_LAYER_ID,
    DEPTH_MARKER_HITBOX_LAYER_ID,
    DEPTH_MARKER_LABEL_LAYER_ID,
    DEPTH_MAPS,
    ZVON_SOURCE_ID: DEPTH_SOURCE_ID,
    ZVON_FILL_LAYER_ID: DEPTH_FILL_LAYER_ID,
    ZVON_LINE_LAYER_ID: DEPTH_LINE_LAYER_ID,
    ZVON_POINT_LAYER_ID: DEPTH_LABEL_LAYER_ID,
    ZVON_CONTOUR_URL,
    DISCLAIMER_CLASS,
    DISCLAIMER_TEXT,
    DRAFT_CONTOURS,
    normalizeWaterBodyId,
    getDraftContourUrl,
    hasDraftContours,
    isDraftFeatureCollection,
    getFillLayerDefinition,
    getLineLayerDefinition,
    getDepthMapConfig,
    getDepthLayerDefinitions,
    getDepthMarkerLabel,
    getDepthMarkerFeatureCollection,
    getDepthMarkerLayerDefinitions,
    getDepthMarkerHitboxRadiusExpression,
    getDepthMarkerVisibleRadiusExpression,
    getDepthMarkerFeatureAtPoint,
    getZvonLayerDefinitions: getDepthLayerDefinitions,
    countGeometryTypes,
    showDepthMap,
    selectDepthMap,
    enableDepthMode,
    disableDepthMode,
    removeDepthMarkers,
    showAllDepthMaps,
    removeDepthMap,
    showZvonDepth,
    removeZvonDepth,
    showDraftContours,
    removeDraftContours,
    setDisclaimerVisible,
    getActiveWaterBodyId: function () {
      return activeWaterBodyId;
    },
    getActiveDepthMapId: function () {
      return activeDepthMapId;
    },
    isDepthMapLoading: function () {
      return depthMapLoading;
    },
    clearDepthDataCache: function () {
      depthDataCache.clear();
    }
  };
})(window);
