(function () {
  "use strict";

  const CACHE_SCHEMA_VERSION = 1;
  const STORAGE_PREFIX = "klevby:last-known:";
  const MAX_BYTES_PER_KEY = 450000;
  const MAX_ITEMS = {
    feed: 40,
    trips: 50,
    weather: 1,
    home: 1,
    "map-viewport": 1,
    "map-waterbody": 1,
    "map-depth": 1,
    "map-registry": 40,
  };

  let lastWriteStatus = "idle";

  function storageKey(key) {
    return `${STORAGE_PREFIX}${String(key || "").trim()}`;
  }

  function approxBytes(value) {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch (_) {
      return 0;
    }
  }

  function trimData(key, data) {
    const normalizedKey = String(key || "").trim();

    if (normalizedKey === "feed" && Array.isArray(data)) {
      return data.slice(0, MAX_ITEMS.feed);
    }

    if (normalizedKey === "trips" && Array.isArray(data)) {
      return data.slice(0, MAX_ITEMS.trips).map(sanitizeTripPost).filter(Boolean);
    }

    if (normalizedKey === "weather" && data && typeof data === "object") {
      return {
        mode: data.mode || "weather",
        weatherMode: data.weatherMode || "cloudy",
        tempText: data.tempText || "",
        conditionText: data.conditionText || "",
        windText: data.windText || "",
        pressureText: data.pressureText || "",
        biteIconSrc: data.biteIconSrc || "",
        biteTitle: data.biteTitle || "",
        biteDescription: data.biteDescription || "",
        updatedAt: data.updatedAt || null,
      };
    }

    if (normalizedKey === "home" && data && typeof data === "object") {
      return {
        feedPreviewCount: Number(data.feedPreviewCount || 0) || 0,
        hasWeather: Boolean(data.hasWeather),
      };
    }

    if (normalizedKey === "map-registry" && Array.isArray(data)) {
      return data.slice(0, MAX_ITEMS["map-registry"]);
    }

    return data;
  }

  function sanitizeTripPost(post) {
    if (!post || typeof post !== "object") return null;

    const id = String(post.id || "").trim();
    if (!id) return null;

    return {
      id,
      created_at: post.created_at || "",
      name: post.name || "",
      city: post.city || "",
      destination: post.destination || "",
      trip_time: post.trip_time || "",
      trip_date: post.trip_date || "",
      transport: post.transport || "",
      seats: post.seats ?? null,
      text: post.text || "",
      telegram: post.telegram || "",
      owner_id: post.owner_id || "",
      fishing_type: post.fishing_type || "",
      crew_full: Boolean(post.crew_full),
    };
  }

  function saveLastKnown(key, data, meta) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return false;

    const safeData = trimData(normalizedKey, data);
    const payload = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
      data: safeData,
      meta: {
        onlineSuccess: Boolean(meta?.onlineSuccess),
        count: Array.isArray(safeData) ? safeData.length : safeData ? 1 : 0,
        ...(meta && typeof meta === "object" ? meta : {}),
      },
    };

    if (approxBytes(payload) > MAX_BYTES_PER_KEY) {
      lastWriteStatus = `skipped:${normalizedKey}:too-large`;
      window.KlevbyBootStore?.capture?.("last-known-cache.skip", {
        key: normalizedKey,
        reason: "too-large",
      });
      return false;
    }

    try {
      localStorage.setItem(storageKey(normalizedKey), JSON.stringify(payload));
      lastWriteStatus = `saved:${normalizedKey}`;
      window.KlevbyBootStore?.capture?.("last-known-cache.save", {
        key: normalizedKey,
        count: payload.meta.count,
      });
      return true;
    } catch (error) {
      lastWriteStatus = `error:${normalizedKey}`;
      window.KlevbyBootStore?.recordError?.("last-known-cache.save", error);
      return false;
    }
  }

  function readLastKnown(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return null;

    try {
      const raw = localStorage.getItem(storageKey(normalizedKey));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        clearLastKnown(normalizedKey);
        return null;
      }

      if (Number(parsed.schemaVersion) !== CACHE_SCHEMA_VERSION) {
        clearLastKnown(normalizedKey);
        return null;
      }

      return {
        schemaVersion: parsed.schemaVersion,
        savedAt: Number(parsed.savedAt || 0) || null,
        data: parsed.data ?? null,
        meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
      };
    } catch (error) {
      clearLastKnown(normalizedKey);
      window.KlevbyBootStore?.recordError?.("last-known-cache.read", error);
      return null;
    }
  }

  function clearLastKnown(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return;

    try {
      localStorage.removeItem(storageKey(normalizedKey));
      lastWriteStatus = `cleared:${normalizedKey}`;
    } catch (_) {}
  }

  function clearAllLastKnown() {
    const keys = [
      "feed",
      "trips",
      "weather",
      "home",
      "map-viewport",
      "map-waterbody",
      "map-depth",
      "map-registry",
    ];

    keys.forEach(clearLastKnown);

    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = String(localStorage.key(i) || "");
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}

    lastWriteStatus = "cleared:all";
  }

  function getLastKnownSnapshot() {
    const keys = [
      "feed",
      "trips",
      "weather",
      "home",
      "map-viewport",
      "map-waterbody",
      "map-depth",
      "map-registry",
    ];
    const entries = {};

    keys.forEach((key) => {
      const entry = readLastKnown(key);
      entries[key] = {
        present: Boolean(entry),
        savedAt: entry?.savedAt || null,
        savedAtIso: entry?.savedAt ? new Date(entry.savedAt).toISOString() : null,
        approxBytes: entry ? approxBytes(entry) : 0,
        count: entry?.meta?.count ?? (Array.isArray(entry?.data) ? entry.data.length : entry?.data ? 1 : 0),
        onlineSuccess: Boolean(entry?.meta?.onlineSuccess),
      };
    });

    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      keys,
      entries,
      lastWriteStatus,
      timestamp: new Date().toISOString(),
    };
  }

  function hasAnyLastKnown() {
    return ["feed", "trips", "weather"].some((key) => {
      const entry = readLastKnown(key);
      if (!entry) return false;
      if (Array.isArray(entry.data)) return entry.data.length > 0;
      return entry.data != null;
    });
  }

  function isNetworkDegraded() {
    if (window.KlevbyBootStore?.isSimulatedOffline?.()) return true;
    if (window.KlevbyNetworkState?.isOfflineOrWeak?.()) return true;
    return navigator.onLine === false;
  }

  window.KlevbyLastKnownCache = {
    CACHE_SCHEMA_VERSION,
    saveLastKnown,
    readLastKnown,
    clearLastKnown,
    clearAllLastKnown,
    getLastKnownSnapshot,
    hasAnyLastKnown,
    isNetworkDegraded,
    sanitizeTripPost,
    getLastWriteStatus: () => lastWriteStatus,
  };
})();
