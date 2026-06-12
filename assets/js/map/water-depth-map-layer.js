(function initKlevbyWaterDepthMapLayer(global) {
  const SOURCE_ID = "klevby-water-depth-sources";
  const LAYER_ID = "klevby-water-depth-points";
  const LAYER_HIT_ID = "klevby-water-depth-points-hit";
  const LAYER_NEAR_ID = "klevby-water-depth-points-pin";
  const MARKER_DOT_IMAGE_ID = "klevby-water-depth-marker-dot";
  const MARKER_RADAR_IMAGE_ID = "klevby-water-depth-marker-radar";
  const MARKER_DOT_SVG_URL = "assets/icons/map-depth/depth-marker-dot.svg";
  const MARKER_RADAR_SVG_URL = "assets/icons/map-depth/depth-marker-radar.svg";
  const ZOOM_NEAR = 11.5;
  const ALL_LAYER_IDS = [LAYER_ID, LAYER_NEAR_ID, LAYER_HIT_ID];

  const COLOR_ORANGE = "#F47A2B";
  const COLOR_GRAPHITE = "#1e293b";

  const DEFAULT_DOT_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"',
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="12" cy="12" r="10"/>',
    '<circle cx="12" cy="12" r="1"/>',
    "</svg>"
  ].join("");

  const DEFAULT_RADAR_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"',
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>',
    '<path d="M4 6h.01"/>',
    '<path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>',
    '<path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/>',
    '<path d="M12 18h.01"/>',
    '<path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/>',
    '<circle cx="12" cy="12" r="2"/>',
    '<path d="m13.41 10.59 5.66-5.66"/>',
    "</svg>"
  ].join("");

  let cachedDotSvgSource = null;
  let cachedRadarSvgSource = null;

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

  function resolveAssetUrl(relativePath) {
    const normalizedPath = String(relativePath || "").replace(/^\//, "");

    if (!normalizedPath) {
      return relativePath;
    }

    if (typeof global.location === "object" && typeof global.location.href === "string") {
      try {
        return new URL(normalizedPath, global.location.href).toString();
      } catch (_) {
        return normalizedPath;
      }
    }

    return normalizedPath;
  }

  function recolorSvgStroke(svgText, strokeColor) {
    return String(svgText || "")
      .replace(/stroke="currentColor"/g, `stroke="${strokeColor}"`)
      .replace(/class="[^"]*"/g, "");
  }

  function buildDotMarkerSvg(sourceSvg) {
    const svg = recolorSvgStroke(sourceSvg || DEFAULT_DOT_SVG, COLOR_ORANGE);
    const innerDot = `<circle cx="12" cy="12" r="3.5" fill="${COLOR_GRAPHITE}" stroke="none"/>`;

    return svg.replace("</svg>", `${innerDot}</svg>`);
  }

  function buildRadarMarkerSvg(sourceSvg) {
    const svg = recolorSvgStroke(sourceSvg || DEFAULT_RADAR_SVG, COLOR_ORANGE);
    const background = `<circle cx="12" cy="12" r="11" fill="${COLOR_GRAPHITE}" stroke="none"/>`;

    return svg.replace(/(<svg[^>]*>)/, `$1${background}`);
  }

  async function loadSvgSource(url, fallbackSvg, cacheKey) {
    if (cacheKey === "dot" && cachedDotSvgSource) {
      return cachedDotSvgSource;
    }

    if (cacheKey === "radar" && cachedRadarSvgSource) {
      return cachedRadarSvgSource;
    }

    if (typeof global.fetch !== "function") {
      return fallbackSvg;
    }

    try {
      const response = await global.fetch(resolveAssetUrl(url));

      if (!response.ok) {
        return fallbackSvg;
      }

      const svgText = await response.text();

      if (cacheKey === "dot") {
        cachedDotSvgSource = svgText;
      } else if (cacheKey === "radar") {
        cachedRadarSvgSource = svgText;
      }

      return svgText;
    } catch (_) {
      return fallbackSvg;
    }
  }

  function rasterizeSvgToImageData(svgMarkup, pixelSize) {
    const size = Number.isFinite(pixelSize) && pixelSize > 0 ? pixelSize : 48;

    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return Promise.resolve(null);
    }

    return new Promise(function (resolve) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(null);
        return;
      }

      const image = new Image();

      image.onload = function () {
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        URL.revokeObjectURL(image.src);
        resolve(context.getImageData(0, 0, size, size));
      };

      image.onerror = function () {
        URL.revokeObjectURL(image.src);
        resolve(null);
      };

      try {
        const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
        image.src = URL.createObjectURL(blob);
      } catch (_) {
        resolve(null);
      }
    });
  }

  function getFarSymbolLayerSpec() {
    return {
      id: LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      maxzoom: ZOOM_NEAR,
      layout: {
        "icon-image": MARKER_DOT_IMAGE_ID,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.5,
          8,
          0.54,
          11,
          0.58
        ],
        "icon-anchor": "center",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
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
        "icon-image": MARKER_RADAR_IMAGE_ID,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          ZOOM_NEAR,
          1.08,
          13,
          1.15,
          15,
          1.2,
          17,
          1.25
        ],
        "icon-anchor": "center",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    };
  }

  function getFarCircleFallbackLayerSpec() {
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
          5,
          8,
          5.5,
          11,
          6
        ],
        "circle-color": COLOR_GRAPHITE,
        "circle-stroke-color": COLOR_ORANGE,
        "circle-stroke-width": 2,
        "circle-opacity": 0.96
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
          12,
          13,
          13,
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

  function getWaterDepthLayerDefinitions(options) {
    const useSymbolLayers = options?.useSymbolLayers !== false;

    return [
      useSymbolLayers ? getFarSymbolLayerSpec() : getFarCircleFallbackLayerSpec(),
      useSymbolLayers ? getNearSymbolLayerSpec() : getNearCircleFallbackLayerSpec(),
      getHitCircleLayerSpec()
    ];
  }

  async function addMarkerImage(map, imageId, svgMarkup, pixelSize) {
    if (typeof map.hasImage === "function" && map.hasImage(imageId)) {
      return true;
    }

    const imageData = await rasterizeSvgToImageData(svgMarkup, pixelSize);

    if (!imageData || typeof map.addImage !== "function") {
      return false;
    }

    try {
      map.addImage(imageId, imageData, { pixelRatio: 2 });
      return true;
    } catch (error) {
      console.warn("Klevby water depth map layer: marker image failed.", imageId, error);
      return false;
    }
  }

  async function ensureMarkerImages(map) {
    const [dotSource, radarSource] = await Promise.all([
      loadSvgSource(MARKER_DOT_SVG_URL, DEFAULT_DOT_SVG, "dot"),
      loadSvgSource(MARKER_RADAR_SVG_URL, DEFAULT_RADAR_SVG, "radar")
    ]);

    const [dotReady, radarReady] = await Promise.all([
      addMarkerImage(map, MARKER_DOT_IMAGE_ID, buildDotMarkerSvg(dotSource), 32),
      addMarkerImage(map, MARKER_RADAR_IMAGE_ID, buildRadarMarkerSvg(radarSource), 56)
    ]);

    return {
      dotReady,
      radarReady,
      symbolLayersReady: dotReady && radarReady
    };
  }

  function removeMarkerImages(map) {
    if (typeof map.hasImage !== "function" || typeof map.removeImage !== "function") {
      return;
    }

    [MARKER_DOT_IMAGE_ID, MARKER_RADAR_IMAGE_ID].forEach(function (imageId) {
      try {
        if (map.hasImage(imageId)) {
          map.removeImage(imageId);
        }
      } catch (_) {
        /* ignore */
      }
    });
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

      removeMarkerImages(map);
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

      const markerImages = await ensureMarkerImages(map);
      const layerReady = areDepthLayersPresent(map) || addWaterDepthLayers(map, {
        useSymbolLayers: markerImages.symbolLayersReady
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
          markerDotReady: markerImages.dotReady,
          markerRadarReady: markerImages.radarReady
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
    LAYER_HIT_ID,
    LAYER_NEAR_ID,
    MARKER_DOT_IMAGE_ID,
    MARKER_RADAR_IMAGE_ID,
    MARKER_DOT_SVG_URL,
    MARKER_RADAR_SVG_URL,
    ZOOM_NEAR,
    ALL_LAYER_IDS,
    toWaterDepthFeatureCollection,
    buildDotMarkerSvg,
    buildRadarMarkerSvg,
    getWaterDepthLayerDefinitions,
    removeWaterDepthLayer,
    renderWaterDepthLayer,
    addWaterDepthLayer,
    setWaterDepthLayerVisible
  };
})(window);
