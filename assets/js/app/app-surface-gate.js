(function () {
  "use strict";

  const MOBILE_MAX_WIDTH = 900;
  const ALLOWED_SURFACE = "mobile-allowed";
  const BLOCKED_SURFACE = "desktop-blocked";
  const standaloneMedia = window.matchMedia("(display-mode: standalone)");

  function isNativeApp() {
    const capacitor = window.Capacitor;
    if (!capacitor) return false;

    try {
      if (typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()) {
        return true;
      }
    } catch (_) {
      // Fall through to the platform name when the helper is unavailable.
    }

    try {
      return typeof capacitor.getPlatform === "function" && capacitor.getPlatform() !== "web";
    } catch (_) {
      return false;
    }
  }

  function isStandalonePwa() {
    return standaloneMedia.matches || window.navigator.standalone === true;
  }

  function isMobileViewport() {
    const width = Number(window.innerWidth || document.documentElement.clientWidth || 0);
    return width === 0 || width <= MOBILE_MAX_WIDTH;
  }

  function updateAppSurface() {
    const isAllowed = isNativeApp() || isStandalonePwa() || isMobileViewport();
    document.documentElement.dataset.appSurface = isAllowed ? ALLOWED_SURFACE : BLOCKED_SURFACE;
  }

  updateAppSurface();
  window.addEventListener("resize", updateAppSurface, { passive: true });

  if (typeof standaloneMedia.addEventListener === "function") {
    standaloneMedia.addEventListener("change", updateAppSurface);
  } else if (typeof standaloneMedia.addListener === "function") {
    standaloneMedia.addListener(updateAppSurface);
  }
})();
