(function () {
  "use strict";

  const BOOT_STARTED_AT = performance.now();
  const MAX_EVENTS = 80;
  const MAX_ERRORS = 40;
  const STORAGE_LAST_SUCCESS_KEY = "klevby:last-successful-boot-at";

  const state = {
    bootStartedAt: BOOT_STARTED_AT,
    firstRenderAt: null,
    shellPresentedAt: null,
    bootCompletedAt: null,
    supabaseInitStatus: "pending",
    mapInitStatus: "idle",
    currentScreenType: "unknown",
    events: [],
    bootErrors: [],
    networkErrors: [],
    simulatedOffline: false,
    swBuildVersion: null,
    swCacheName: null,
  };

  function nowMs() {
    return Math.round(performance.now() - BOOT_STARTED_AT);
  }

  function readLastSuccessfulBootAt() {
    try {
      return window.localStorage.getItem(STORAGE_LAST_SUCCESS_KEY);
    } catch (_) {
      return null;
    }
  }

  function writeLastSuccessfulBootAt(isoString) {
    try {
      window.localStorage.setItem(STORAGE_LAST_SUCCESS_KEY, isoString);
    } catch (_) {}
  }

  function pushLimited(list, entry, limit) {
    list.push(entry);
    if (list.length > limit) {
      list.splice(0, list.length - limit);
    }
  }

  function normalizeError(error) {
    if (!error) {
      return { name: "Error", message: "Unknown error" };
    }

    if (typeof error === "string") {
      return { name: "Error", message: error };
    }

    return {
      name: error.name || "Error",
      message: error.message || String(error),
    };
  }

  function capture(scope, detail) {
    pushLimited(
      state.events,
      {
        atMs: nowMs(),
        scope,
        detail: detail ?? null,
        ts: new Date().toISOString(),
      },
      MAX_EVENTS,
    );
  }

  function recordError(scope, error, bucket = "boot") {
    const normalized = {
      scope,
      atMs: nowMs(),
      ts: new Date().toISOString(),
      ...normalizeError(error),
    };

    if (bucket === "network") {
      pushLimited(state.networkErrors, normalized, MAX_ERRORS);
    } else {
      pushLimited(state.bootErrors, normalized, MAX_ERRORS);
    }

    capture(`error:${scope}`, normalized);
  }

  function markFirstRender() {
    if (state.firstRenderAt != null) return;
    state.firstRenderAt = performance.now();
    capture("first-render", { atMs: nowMs() });
  }

  function markShellPresented(reason) {
    if (state.shellPresentedAt != null) return;
    state.shellPresentedAt = performance.now();
    capture("shell-presented", { reason: reason || "unknown", atMs: nowMs() });
    window.dispatchEvent(new CustomEvent("klevby-app-shell-ready"));
  }

  function markBootCompleted() {
    state.bootCompletedAt = performance.now();
    const iso = new Date().toISOString();
    writeLastSuccessfulBootAt(iso);
    capture("boot-completed", { atMs: nowMs() });
  }

  function setSupabaseStatus(status) {
    state.supabaseInitStatus = String(status || "unknown");
    capture("supabase-status", { status: state.supabaseInitStatus });
  }

  function setMapInitStatus(status) {
    state.mapInitStatus = String(status || "unknown");
    capture("map-status", { status: state.mapInitStatus });
  }

  function setCurrentScreenType(screenType) {
    state.currentScreenType = String(screenType || "unknown");
  }

  function setServiceWorkerInfo(info) {
    if (!info || typeof info !== "object") return;
    if (info.buildVersion) state.swBuildVersion = info.buildVersion;
    if (info.cacheName) state.swCacheName = info.cacheName;
  }

  function setSimulatedOffline(enabled) {
    state.simulatedOffline = Boolean(enabled);
    capture("simulate-offline", { enabled: state.simulatedOffline });
  }

  function isSimulatedOffline() {
    return state.simulatedOffline === true;
  }

  function clearDiagnostics() {
    state.events = [];
    state.bootErrors = [];
    state.networkErrors = [];
    capture("diagnostics-cleared", null);
  }

  function withTimeout(promise, timeoutMs, label) {
    const safeLabel = label || "operation";
    let timer = null;

    const timeoutPromise = new Promise((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error(`${safeLabel} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  async function getCacheNames() {
    if (!("caches" in window)) return [];
    try {
      return await caches.keys();
    } catch (error) {
      recordError("cache-names", error, "boot");
      return [];
    }
  }

  function getSnapshotSync() {
    const html = document.documentElement;
    const htmlStyles = html ? getComputedStyle(html) : null;
    const appShell = window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;

    return {
      bootStartedAtMs: BOOT_STARTED_AT,
      firstRenderHappened: state.firstRenderAt != null,
      firstRenderAtMs: state.firstRenderAt,
      shellPresented: state.shellPresentedAt != null,
      shellPresentedAtMs: state.shellPresentedAt,
      bootCompletedAtMs: state.bootCompletedAt,
      bootDurationMs:
        state.bootCompletedAt != null ? Math.round(state.bootCompletedAt - BOOT_STARTED_AT) : null,
      online: navigator.onLine,
      networkStatus: window.KlevbyNetworkState?.getStatus?.() || "unknown",
      simulatedOffline: state.simulatedOffline,
      serviceWorkerSupported: "serviceWorker" in navigator,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      serviceWorkerScriptURL: navigator.serviceWorker?.controller?.scriptURL || null,
      swBuildVersion: state.swBuildVersion,
      swCacheName: state.swCacheName,
      appBuildVersion: window.KLEVB_APP_BUILD_VERSION || null,
      supabaseInitStatus: state.supabaseInitStatus,
      mapInitStatus: state.mapInitStatus,
      currentScreenType: state.currentScreenType,
      visibleSection:
        typeof window.getVisibleSectionName === "function" ? window.getVisibleSectionName() : null,
      chromeMode: document.body?.getAttribute("data-app-chrome-mode") || null,
      lastSuccessfulBootAt: readLastSuccessfulBootAt(),
      lastBootErrors: state.bootErrors.slice(-10),
      lastNetworkErrors: state.networkErrors.slice(-10),
      recentEvents: state.events.slice(-20),
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      shellTokens: appShell,
      safeAreaBottom: htmlStyles?.getPropertyValue("--klevby-bottom-safe-area")?.trim() || null,
      documentReadyState: document.readyState,
      timestamp: new Date().toISOString(),
    };
  }

  async function getSnapshot() {
    const snapshot = getSnapshotSync();
    snapshot.cacheNames = await getCacheNames();
    return snapshot;
  }

  window.KlevbyBootStore = {
    capture,
    recordError,
    markFirstRender,
    markShellPresented,
    markBootCompleted,
    setSupabaseStatus,
    setMapInitStatus,
    setCurrentScreenType,
    setServiceWorkerInfo,
    setSimulatedOffline,
    isSimulatedOffline,
    clearDiagnostics,
    withTimeout,
    getSnapshot,
    getSnapshotSync,
    getBootStartedAt: () => BOOT_STARTED_AT,
  };

  window.KlevbyShellDebug = {
    capture(scope, detail) {
      window.KlevbyBootStore.capture(scope, detail);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markFirstRender, { once: true });
  } else {
    markFirstRender();
  }
})();
