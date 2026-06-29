(function () {
  "use strict";

  const HOME_NOTICE_ID = "klevby-home-last-known-notice";

  function restoreCachedWeather() {
    const cache = window.KlevbyLastKnownCache?.readLastKnown?.("weather");
    if (!cache?.data || typeof window.publishKlevGoWeatherState !== "function") return false;

    window.publishKlevGoWeatherState({
      ...cache.data,
      fromCache: true,
    });

    return true;
  }

  function updateHomeNotice() {
    const cacheApi = window.KlevbyLastKnownCache;
    const ui = window.KlevbyLastKnownUi;
    if (!cacheApi || !ui) return;

    const homeSection = document.getElementById("homeSection");
    if (!homeSection || homeSection.classList.contains("hidden")) return;

    const degraded = cacheApi.isNetworkDegraded?.();
    const hasCache = cacheApi.hasAnyLastKnown?.();
    let node = document.getElementById(HOME_NOTICE_ID);

    if (!degraded || !hasCache) {
      node?.remove();
      return;
    }

    if (!node) {
      node = document.createElement("div");
      node.id = HOME_NOTICE_ID;
      node.className = "klevby-last-known-home-notice";
      document.body.appendChild(node);
    }

    node.innerHTML = ui.savedNoticeHtml({ compact: true });
    node.style.top = "calc(env(safe-area-inset-top, 0px) + 56px)";
  }

  function saveHomeSnapshot() {
    const cacheApi = window.KlevbyLastKnownCache;
    if (!cacheApi) return;

    const feedEntry = cacheApi.readLastKnown("feed");
    const weatherEntry = cacheApi.readLastKnown("weather");

    cacheApi.saveLastKnown(
      "home",
      {
        feedPreviewCount: Array.isArray(feedEntry?.data) ? feedEntry.data.length : 0,
        hasWeather: Boolean(weatherEntry?.data),
      },
      {
        onlineSuccess: Boolean(feedEntry?.meta?.onlineSuccess || weatherEntry?.meta?.onlineSuccess),
      },
    );
  }

  function bindEvents() {
    window.addEventListener("klevby-network-status", updateHomeNotice);
    window.addEventListener("klevgo:weather-updated", () => {
      saveHomeSnapshot();
      updateHomeNotice();
    });
    window.addEventListener("klevby-app-shell-ready", updateHomeNotice, { once: true });
    document.addEventListener("visibilitychange", updateHomeNotice);
  }

  function initHomeLastKnownBridge() {
    restoreCachedWeather();
    updateHomeNotice();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeLastKnownBridge, { once: true });
  } else {
    initHomeLastKnownBridge();
  }

  window.KlevbyHomeLastKnownBridge = {
    restoreCachedWeather,
    updateHomeNotice,
    saveHomeSnapshot,
  };
})();
