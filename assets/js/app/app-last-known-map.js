(function () {
  "use strict";

  const KEYS = {
    viewport: "map-viewport",
    waterbody: "map-waterbody",
    depth: "map-depth",
    registry: "map-registry",
  };

  let lastMapError = null;
  let depthMapsStatus = "idle";
  let depthMapsLastError = null;

  function cacheApi() {
    return window.KlevbyLastKnownCache || null;
  }

  function sanitizeViewport(data) {
    if (!data || typeof data !== "object") return null;

    const center = Array.isArray(data.center) ? data.center.slice(0, 2) : null;
    const zoom = Number(data.zoom);
    const bounds = data.bounds && typeof data.bounds === "object" ? data.bounds : null;

    if (!center || center.length < 2 || !center.every(Number.isFinite)) {
      return null;
    }

    return {
      center,
      zoom: Number.isFinite(zoom) ? zoom : null,
      bounds: bounds
        ? {
            north: Number(bounds.north),
            south: Number(bounds.south),
            east: Number(bounds.east),
            west: Number(bounds.west),
          }
        : null,
      provider: String(data.provider || "").trim() || null,
      label: String(data.label || "").trim() || null,
    };
  }

  function sanitizeWaterbody(point) {
    if (!point || typeof point !== "object") return null;

    const waterBodyId = String(point.waterBodyId || point.water_body_id || point.id || "").trim();
    if (!waterBodyId) return null;

    return {
      id: String(point.id || waterBodyId).trim(),
      waterBodyId,
      name: String(point.name || "Водоём").trim(),
      waterType: String(point.waterType || point.water_type || "").trim(),
      region: String(point.region || "").trim(),
      district: String(point.district || "").trim(),
      locationQuality: String(point.locationQuality || "").trim(),
      locationSource: String(point.locationSource || "").trim(),
      source: String(point.source || "").trim(),
    };
  }

  function sanitizeDepthMode(data) {
    if (!data || typeof data !== "object") return null;

    const depthMapId = String(data.depthMapId || data.id || "").trim();
    if (!depthMapId) return null;

    return {
      depthMapId,
      name: String(data.name || "").trim() || null,
      enabled: Boolean(data.enabled),
      waterBodyId: String(data.waterBodyId || "").trim() || null,
    };
  }

  function sanitizeRegistry(entries) {
    if (!Array.isArray(entries)) return [];

    return entries
      .slice(0, 40)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const id = String(entry.id || entry.waterBodyId || "").trim();
        if (!id) return null;

        return {
          id,
          waterBodyId: String(entry.waterBodyId || entry.id || id).trim(),
          name: String(entry.name || "").trim(),
          status: String(entry.status || "").trim(),
          format: String(entry.format || "").trim(),
          maxDepth: entry.maxDepth ?? null,
        };
      })
      .filter(Boolean);
  }

  function saveViewport(data, meta) {
    const safe = sanitizeViewport(data);
    if (!safe) return false;
    return cacheApi()?.saveLastKnown?.(KEYS.viewport, safe, {
      onlineSuccess: true,
      ...meta,
    });
  }

  function readViewport() {
    return cacheApi()?.readLastKnown?.(KEYS.viewport) || null;
  }

  function saveWaterbody(point, meta) {
    const safe = sanitizeWaterbody(point);
    if (!safe) return false;
    return cacheApi()?.saveLastKnown?.(KEYS.waterbody, safe, {
      onlineSuccess: true,
      ...meta,
    });
  }

  function readWaterbody() {
    return cacheApi()?.readLastKnown?.(KEYS.waterbody) || null;
  }

  function saveDepthMode(data, meta) {
    const safe = sanitizeDepthMode(data);
    if (!safe) return false;
    depthMapsStatus = "saved";
    return cacheApi()?.saveLastKnown?.(KEYS.depth, safe, {
      onlineSuccess: true,
      ...meta,
    });
  }

  function readDepthMode() {
    return cacheApi()?.readLastKnown?.(KEYS.depth) || null;
  }

  function saveRegistryMetadata(entries, meta) {
    const safe = sanitizeRegistry(entries);
    return cacheApi()?.saveLastKnown?.(KEYS.registry, safe, {
      onlineSuccess: true,
      count: safe.length,
      ...meta,
    });
  }

  function readRegistry() {
    return cacheApi()?.readLastKnown?.(KEYS.registry) || null;
  }

  function readRegistryEntry(waterBodyId) {
    const normalized = String(waterBodyId || "").trim().toLowerCase();
    if (!normalized) return null;

    const entry = readRegistry();
    const rows = Array.isArray(entry?.data) ? entry.data : [];
    return (
      rows.find((row) => {
        const id = String(row?.id || "").trim().toLowerCase();
        const bodyId = String(row?.waterBodyId || "").trim().toLowerCase();
        return id === normalized || bodyId === normalized;
      }) || null
    );
  }

  function syncRegistryFromRuntime() {
    const registry = window.KlevbyDepthMapsRegistry;
    if (!registry || typeof registry.getAvailable !== "function") return false;

    return saveRegistryMetadata(registry.getAvailable(), { source: "runtime-registry" });
  }

  function hasLastKnownViewport() {
    const entry = readViewport();
    return Boolean(entry?.data?.center);
  }

  function hasLastKnownWaterbody() {
    const entry = readWaterbody();
    return Boolean(entry?.data?.waterBodyId || entry?.data?.name);
  }

  function formatViewportLabel(viewportEntry, waterbodyEntry) {
    const waterbody = waterbodyEntry?.data;
    if (waterbody?.name) return waterbody.name;

    const viewport = viewportEntry?.data;
    if (!viewport?.center) return "Сохранённая область";

    const [lat, lng] = viewport.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Сохранённая область";

    return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  }

  function recordMapError(error, context) {
    lastMapError = {
      at: new Date().toISOString(),
      message: error?.message || String(error || "Unknown map error"),
      context: context || null,
    };
    window.KlevbyBootStore?.recordError?.("map", error);
    window.KlevbyBootStore?.setMapInitStatus?.("failed");
  }

  function recordDepthMapsError(error, context) {
    depthMapsLastError = {
      at: new Date().toISOString(),
      message: error?.message || String(error || "Unknown depth maps error"),
      context: context || null,
    };
    depthMapsStatus = "error";
    window.KlevbyBootStore?.recordError?.("depth-maps", error, "network");
  }

  function setDepthMapsStatus(status) {
    depthMapsStatus = String(status || "idle");
  }

  function clearMapCache() {
    Object.values(KEYS).forEach((key) => {
      cacheApi()?.clearLastKnown?.(key);
    });
    lastMapError = null;
    depthMapsLastError = null;
    depthMapsStatus = "cleared";
  }

  function getMapDiagnosticsSnapshot() {
    const viewport = readViewport();
    const waterbody = readWaterbody();
    const depth = readDepthMode();
    const registry = readRegistry();

    return {
      lastInitStatus: window.KlevbyBootStore?.getSnapshotSync?.()?.mapInitStatus || null,
      lastError: lastMapError,
      lastViewportSavedAt: viewport?.savedAt || null,
      lastWaterbodySavedAt: waterbody?.savedAt || null,
      hasLastKnownViewport: hasLastKnownViewport(),
      hasLastKnownWaterbody: hasLastKnownWaterbody(),
      viewportLabel: formatViewportLabel(viewport, waterbody),
      depthMaps: {
        status: depthMapsStatus,
        lastError: depthMapsLastError,
        savedMode: depth?.data || null,
        savedAt: depth?.savedAt || null,
      },
      cache: {
        viewportBytes: viewport ? JSON.stringify(viewport).length : 0,
        waterbodyBytes: waterbody ? JSON.stringify(waterbody).length : 0,
        registryCount: Array.isArray(registry?.data) ? registry.data.length : 0,
        registryBytes: registry ? JSON.stringify(registry).length : 0,
        keys: Object.values(KEYS),
      },
      timestamp: new Date().toISOString(),
    };
  }

  window.KlevbyLastKnownMap = {
    KEYS,
    saveViewport,
    readViewport,
    saveWaterbody,
    readWaterbody,
    saveDepthMode,
    readDepthMode,
    saveRegistryMetadata,
    readRegistry,
    readRegistryEntry,
    syncRegistryFromRuntime,
    hasLastKnownViewport,
    hasLastKnownWaterbody,
    formatViewportLabel,
    recordMapError,
    recordDepthMapsError,
    setDepthMapsStatus,
    clearMapCache,
    getMapDiagnosticsSnapshot,
  };
})();
