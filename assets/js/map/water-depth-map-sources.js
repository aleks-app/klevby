(function initKlevbyWaterDepthMapSources(global) {
  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  const WATER_BODY_IDS_BY_NAME = new Map([
    ["заславское водохранилище", "zaslavskoe"],
    ["минское море", "zaslavskoe"]
  ]);

  function normalizeWaterBodyId(row, name) {
    const explicitId = normalizeText(row?.water_body_id || row?.waterBodyId);
    if (explicitId) return explicitId;

    return WATER_BODY_IDS_BY_NAME.get(name.toLocaleLowerCase("ru")) || "";
  }

  function normalizeCoordinates(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        latitude: null,
        longitude: null,
        hasCoordinates: false
      };
    }

    return {
      latitude,
      longitude,
      hasCoordinates: true
    };
  }

  function normalizeWaterDepthMapSources(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.reduce(function normalizeRows(sources, row) {
      if (!row || typeof row !== "object") {
        return sources;
      }

      const name = normalizeText(row.name);
      const sourceUrl = normalizeText(row.source_url);

      if (!name || !sourceUrl) {
        return sources;
      }

      const coordinates = normalizeCoordinates(row.latitude, row.longitude);

      sources.push({
        id: row.id ?? null,
        waterBodyId: normalizeWaterBodyId(row, name),
        name,
        waterType: normalizeText(row.water_type),
        region: normalizeText(row.region),
        district: normalizeText(row.district),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        locationQuality: normalizeText(row.location_quality),
        locationSource: normalizeText(row.location_source),
        locationCheckedAt: normalizeText(row.location_checked_at),
        source: normalizeText(row.source),
        sourceUrl,
        usageRule: normalizeText(row.usage_rule),
        quality: normalizeText(row.quality),
        comment: normalizeText(row.comment),
        checkedAt: normalizeText(row.checked_at),
        hasCoordinates: coordinates.hasCoordinates
      });

      return sources;
    }, []);
  }

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

  async function getWaterDepthMapSources() {
    const fetchWaterDepthSources = global.KlevbyWaterDepthSources?.fetchWaterDepthSources;

    if (typeof fetchWaterDepthSources !== "function") {
      return [];
    }

    try {
      const rawRows = await fetchWaterDepthSources();
      const normalizedRows = normalizeWaterDepthMapSources(rawRows);

      if (isDebugEnabled()) {
        console.info("Klevby water depth map sources: raw rows loaded.", rawRows);
        console.info("Klevby water depth map sources: normalized map-ready rows.", normalizedRows);
      }

      return normalizedRows;
    } catch (error) {
      console.warn("Klevby water depth map sources: fetch failed.", error);
      return [];
    }
  }

  global.KlevbyWaterDepthMapSources = {
    normalizeWaterDepthMapSources,
    getWaterDepthMapSources
  };
})(window);
