(function initKlevbyWaterDepthMapLayer(global) {
  const SOURCE_ID = "klevby-water-depth-sources";
  const LAYER_ID = "klevby-water-depth-points";
  const LAYER_GLOW_ID = "klevby-water-depth-points-glow";
  const LAYER_HIT_ID = "klevby-water-depth-points-hit";
  const LAYER_NEAR_ID = "klevby-water-depth-points-pin";
  const MARKER_IMAGE_ID = "klevby-water-depth-marker";
  const ZOOM_NEAR = 11.5;
  const ALL_LAYER_IDS = [LAYER_GLOW_ID, LAYER_ID, LAYER_NEAR_ID, LAYER_HIT_ID];

  const COLOR_CYAN = "#22d3ee";
  const COLOR_ORANGE = "#F47A2B";
  const COLOR_GRAPHITE = "#1e293b";

  function isDebugEnabled() {
    if (global.KLEVB_WATER_DEPTH_DEBUG === true) {
      return true;
    }

    try {
      return global.localStorage?.getItem("KLEVB_WATER_DEPTH_DEBUG") === "1";
    } catch (_) {
      return false;
    }
  }

  function toWaterDepthFeatureCollection(rows) {
    const features = Array.isArray(rows)
      ? rows.filter(function (row) {
          return row?.hasCoordinates === true;
        }).map(function (row) {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [row.longitude, row.latitude]
            },
            properties: {
              id: row.id ?? null,
              name: row.name || "",
              sourceUrl: row.sourceUrl || "",
              quality: row.quality || "",
              locationQuality: row.locationQuality || ""
            }
          };
        })
      : [];

    return {
      type: "FeatureCollection",
      features
    };
  }

  function createDepthMarkerImageData(size) {
    const pixelSize = Number.isFinite(size) && size > 0 ? size : 64;

    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const centerX = pixelSize / 2;
    const pinTipY = pixelSize * 0.9;
    const pinTopY = pixelSize * 0.1;
    const pinRadius = pixelSize * 0.28;

    ctx.beginPath();
    ctx.moveTo(centerX, pinTipY);
    ctx.quadraticCurveTo(
      centerX - pinRadius * 1.15,
      pinTopY + pinRadius * 1.35,
      centerX - pinRadius * 0.95,
      pinTopY + pinRadius * 0.55
    );
    ctx.arc(centerX, pinTopY + pinRadius * 0.6, pinRadius * 0.95, Math.PI, 0);
    ctx.quadraticCurveTo(
      centerX + pinRadius * 1.15,
      pinTopY + pinRadius * 1.35,
      centerX,
      pinTipY
    );
    ctx.closePath();
    ctx.fillStyle = COLOR_GRAPHITE;
    ctx.fill();
    ctx.strokeStyle = COLOR_ORANGE;
    ctx.lineWidth = Math.max(2, pixelSize * 0.06);
    ctx.stroke();

    ctx.strokeStyle = COLOR_ORANGE;
    ctx.lineWidth = Math.max(1.5, pixelSize * 0.045);
    ctx.lineCap = "round";
    const layerIconTop = pinTopY + pinRadius * 0.2;
    const layerGap = pixelSize * 0.075;

    for (let index = 0; index < 3; index += 1) {
      const lineY = layerIconTop + index * layerGap;
      const lineHalfWidth = pinRadius * (0.95 - index * 0.12);
      ctx.beginPath();
      ctx.moveTo(centerX - lineHalfWidth, lineY);
      ctx.lineTo(centerX + lineHalfWidth, lineY);
      ctx.stroke();
    }

    return ctx.getImageData(0, 0, pixelSize, pixelSize);
  }

  function getFarGlowLayerSpec() {
    return {
      id: LAYER_GLOW_ID,
      type: "circle",
      source: SOURCE_ID,
      maxzoom: ZOOM_NEAR,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          10,
          8,
          13,
          11,
          15
        ],
        "circle-color": COLOR_ORANGE,
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.38,
          11,
          0.24
        ],
        "circle-blur": 0.75
      }
    };
  }

  function getFarCircleLayerSpec() {
    return {
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      maxzoom: ZOOM_NEAR,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          7,
          8,
          9,
          11,
          11
        ],
        "circle-color": COLOR_CYAN,
        "circle-stroke-color": COLOR_ORANGE,
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          2,
          11,
          2.5
        ],
        "circle-opacity": 0.94
      }
    };
  }

  function getHitCircleLayerSpec() {
    return {
      id: LAYER_HIT_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          18,
          11,
          22,
          14,
          24,
          16,
          26
        ],
        "circle-color": "#000000",
        "circle-opacity": 0
      }
    };
  }

  function getNearSymbolLayerSpec() {
    return {
      id: LAYER_NEAR_ID,
      type: "symbol",
      source: SOURCE_ID,
      minzoom: ZOOM_NEAR,
      layout: {
        "icon-image": MARKER_IMAGE_ID,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          ZOOM_NEAR,
          0.5,
          13,
          0.72,
          15,
          0.88,
          17,
          1
        ],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    };
  }

  function getNearCircleFallbackLayerSpec() {
    return {
      id: LAYER_NEAR_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: ZOOM_NEAR,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          ZOOM_NEAR,
          10,
          13,
          12,
          15,
          14
        ],
        "circle-color": COLOR_GRAPHITE,
        "circle-stroke-color": COLOR_ORANGE,
        "circle-stroke-width": 2.5,
        "circle-opacity": 0.96
      }
    };
  }

  function getWaterDepthLayerDefinitions(options) {
    const useSymbolNearLayer = options?.useSymbolNearLayer !== false;

    return [
      getFarGlowLayerSpec(),
      getFarCircleLayerSpec(),
      useSymbolNearLayer ? getNearSymbolLayerSpec() : getNearCircleFallbackLayerSpec(),
      getHitCircleLayerSpec()
    ];
  }

  async function ensureMarkerImage(map) {
    if (typeof map.hasImage === "function" && map.hasImage(MARKER_IMAGE_ID)) {
      return true;
    }

    const imageData = createDepthMarkerImageData();

    if (!imageData || typeof map.addImage !== "function") {
      return false;
    }

    try {
      map.addImage(MARKER_IMAGE_ID, imageData, { pixelRatio: 2 });
      return true;
    } catch (error) {
      console.warn("Klevby water depth map layer: marker image failed.", error);
      return false;
    }
  }

  function removeMarkerImage(map) {
    if (typeof map.hasImage !== "function" || typeof map.removeImage !== "function") {
      return;
    }

    try {
      if (map.hasImage(MARKER_IMAGE_ID)) {
        map.removeImage(MARKER_IMAGE_ID);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function areDepthLayersPresent(map) {
    if (!map || typeof map.getLayer !== "function") {
      return false;
    }

    return ALL_LAYER_IDS.every(function (layerId) {
      return Boolean(map.getLayer(layerId));
    });
  }

  function addWaterDepthLayers(map, options) {
    if (!map || typeof map.addLayer !== "function") {
      return false;
    }

    const layerDefinitions = getWaterDepthLayerDefinitions(options);
    let addedLayers = 0;

    layerDefinitions.forEach(function (layer) {
      if (typeof map.getLayer === "function" && map.getLayer(layer.id)) {
        return;
      }

      map.addLayer(layer);
      addedLayers += 1;
    });

    return addedLayers > 0 || areDepthLayersPresent(map);
  }

  function removeWaterDepthLayer(map) {
    if (!map) {
      return;
    }

    try {
      if (typeof map.getLayer === "function") {
        ALL_LAYER_IDS.slice().reverse().forEach(function (layerId) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        });
      }

      if (typeof map.getSource === "function" && map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }

      removeMarkerImage(map);
    } catch (error) {
      console.warn("Klevby water depth map layer: remove failed.", error);
    }
  }

  async function renderWaterDepthLayer(map) {
    if (!map) {
      return false;
    }

    const getWaterDepthMapSources = global.KlevbyWaterDepthMapSources?.getWaterDepthMapSources;

    if (typeof getWaterDepthMapSources !== "function") {
      return false;
    }

    try {
      const rows = await getWaterDepthMapSources();
      const totalRowsReceived = Array.isArray(rows) ? rows.length : 0;
      const rowsWithCoordinates = Array.isArray(rows)
        ? rows.filter(function (row) {
            return row?.hasCoordinates === true;
          }).length
        : 0;
      const data = toWaterDepthFeatureCollection(rows);
      const existingSource = typeof map.getSource === "function" ? map.getSource(SOURCE_ID) : null;

      if (existingSource && typeof existingSource.setData === "function") {
        existingSource.setData(data);
      } else if (typeof map.addSource === "function") {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data
        });
      } else {
        return false;
      }

      const markerImageReady = await ensureMarkerImage(map);
      const layerReady = areDepthLayersPresent(map) || addWaterDepthLayers(map, {
        useSymbolNearLayer: markerImageReady
      });

      if (isDebugEnabled()) {
        console.info("Klevby water depth map layer: debug render summary.", {
          totalRowsReceived,
          rowsWithCoordinates,
          rowsRenderedOnMap: layerReady ? data.features.length : 0,
          skippedRowsWithoutCoordinates: totalRowsReceived - rowsWithCoordinates,
          sourceId: SOURCE_ID,
          layerId: LAYER_ID,
          layerIds: ALL_LAYER_IDS,
          markerImageReady
        });
      }

      return layerReady;
    } catch (error) {
      console.warn("Klevby water depth map layer: fetch or rendering failed.", error);
      return false;
    }
  }

  async function addWaterDepthLayer(map) {
    if (!isDebugEnabled() || !map) {
      return;
    }

    await renderWaterDepthLayer(map);
  }

  async function setWaterDepthLayerVisible(map, visible) {
    if (!map) {
      return;
    }

    if (!visible) {
      removeWaterDepthLayer(map);
      return;
    }

    await renderWaterDepthLayer(map);
  }

  global.KlevbyWaterDepthMapLayer = {
    SOURCE_ID,
    LAYER_ID,
    LAYER_GLOW_ID,
    LAYER_HIT_ID,
    LAYER_NEAR_ID,
    MARKER_IMAGE_ID,
    ZOOM_NEAR,
    ALL_LAYER_IDS,
    toWaterDepthFeatureCollection,
    createDepthMarkerImageData,
    getWaterDepthLayerDefinitions,
    removeWaterDepthLayer,
    renderWaterDepthLayer,
    addWaterDepthLayer,
    setWaterDepthLayerVisible
  };
})(window);
