(function initKlevbyWaterDepthMapLayer(global) {
  const SOURCE_ID = "klevby-water-depth-sources";
  const LAYER_ID = "klevby-water-depth-points";

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

  function removeWaterDepthLayer(map) {
    if (!map) {
      return;
    }

    try {
      if (typeof map.getLayer === "function" && map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }

      if (typeof map.getSource === "function" && map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
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

      const existingLayer = typeof map.getLayer === "function" ? map.getLayer(LAYER_ID) : null;
      let layerReady = Boolean(existingLayer);

      if (!existingLayer && typeof map.addLayer === "function") {
        map.addLayer({
          id: LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 5,
            "circle-color": "#38bdf8",
            "circle-stroke-color": "#082f49",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85
          }
        });
        layerReady = true;
      }

      if (isDebugEnabled()) {
        console.info("Klevby water depth map layer: debug render summary.", {
          totalRowsReceived,
          rowsWithCoordinates,
          rowsRenderedOnMap: layerReady ? data.features.length : 0,
          skippedRowsWithoutCoordinates: totalRowsReceived - rowsWithCoordinates,
          sourceId: SOURCE_ID,
          layerId: LAYER_ID
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
    toWaterDepthFeatureCollection,
    removeWaterDepthLayer,
    renderWaterDepthLayer,
    addWaterDepthLayer,
    setWaterDepthLayerVisible
  };
})(window);
