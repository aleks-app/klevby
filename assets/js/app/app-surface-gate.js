(function () {
  "use strict";

  const MOBILE_MAX_WIDTH = 900;
  const PHONE_MAX_SCREEN_MIN = 600;
  const ALLOWED_SURFACE = "mobile-allowed";
  const BLOCKED_SURFACE = "desktop-blocked";
  const PHONE_DEVICE = "phone";
  const NON_PHONE_DEVICE = "non-phone";
  const PORTRAIT = "portrait";
  const LANDSCAPE = "landscape";

  function createMediaQuery(query) {
    try {
      return typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
    } catch (_) {
      return null;
    }
  }

  const standaloneMedia = createMediaQuery("(display-mode: standalone)");
  const coarsePointerMedia = createMediaQuery("(pointer: coarse)");
  const landscapeMedia = createMediaQuery("(orientation: landscape)");

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
    try {
      return Boolean(standaloneMedia && standaloneMedia.matches) || window.navigator.standalone === true;
    } catch (_) {
      return false;
    }
  }

  function isIphoneOrIpod() {
    try {
      return /iPhone|iPod/i.test(window.navigator.userAgent || "");
    } catch (_) {
      return false;
    }
  }

  function hasMobileUserAgentSignal() {
    try {
      if (window.navigator.userAgentData && window.navigator.userAgentData.mobile === true) {
        return true;
      }
      return /Android|Mobile/i.test(window.navigator.userAgent || "");
    } catch (_) {
      return false;
    }
  }

  function hasSmallPhysicalScreen() {
    try {
      const width = Number(window.screen && window.screen.width) || 0;
      const height = Number(window.screen && window.screen.height) || 0;
      const minimumDimension = Math.min(width, height);
      return minimumDimension > 0 && minimumDimension <= PHONE_MAX_SCREEN_MIN;
    } catch (_) {
      return false;
    }
  }

  function hasCoarsePointer() {
    try {
      return Boolean(coarsePointerMedia && coarsePointerMedia.matches);
    } catch (_) {
      return false;
    }
  }

  function classifyPhone() {
    if (isNativeApp() || isIphoneOrIpod()) return true;
    if (!hasSmallPhysicalScreen()) return false;

    return hasMobileUserAgentSignal() || hasCoarsePointer() || isStandalonePwa();
  }

  function isMobileViewport() {
    const width = Number(window.innerWidth || document.documentElement.clientWidth || 0);
    return width === 0 || width <= MOBILE_MAX_WIDTH;
  }

  function getPhoneOrientation() {
    try {
      if (typeof window.orientation === "number") {
        return Math.abs(window.orientation) === 90 ? LANDSCAPE : PORTRAIT;
      }
    } catch (_) {
      // Continue with media-query and viewport fallbacks.
    }

    try {
      if (landscapeMedia) return landscapeMedia.matches ? LANDSCAPE : PORTRAIT;
    } catch (_) {
      // Continue with a viewport fallback.
    }

    const width = Number(window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Number(window.innerHeight || document.documentElement.clientHeight || 0);
    return width > height ? LANDSCAPE : PORTRAIT;
  }

  const isPhone = classifyPhone();

  function isAppSurfaceAllowed() {
    return document.documentElement.dataset.appSurface !== BLOCKED_SURFACE;
  }

  function runWhenAllowed(callback) {
    if (typeof callback !== "function") return;

    if (isAppSurfaceAllowed()) {
      callback();
      return;
    }

    function handleSurfaceChange(event) {
      if (!event.detail || event.detail.isAllowed !== true) return;

      window.removeEventListener("klevby:app-surface-change", handleSurfaceChange);
      callback();
    }

    window.addEventListener("klevby:app-surface-change", handleSurfaceChange);
  }

  function updateAppSurface() {
    const root = document.documentElement;
    const isAllowed = isPhone || isNativeApp() || isStandalonePwa() || isMobileViewport();

    const nextSurface = isAllowed ? ALLOWED_SURFACE : BLOCKED_SURFACE;
    const previousSurface = root.dataset.appSurface || "";

    root.dataset.deviceClass = isPhone ? PHONE_DEVICE : NON_PHONE_DEVICE;
    root.dataset.phoneOrientation = getPhoneOrientation();
    root.dataset.appSurface = nextSurface;

    if (previousSurface && previousSurface !== nextSurface) {
      window.dispatchEvent(new CustomEvent("klevby:app-surface-change", {
        detail: {
          isAllowed,
          previousSurface,
          surface: nextSurface
        }
      }));
    }
  }

  function addMediaChangeListener(mediaQuery) {
    if (!mediaQuery) return;

    try {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateAppSurface);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(updateAppSurface);
      }
    } catch (_) {
      // The resize and orientationchange listeners remain as fallbacks.
    }
  }

  window.KlevbyAppSurface = Object.freeze({
    isAllowed: isAppSurfaceAllowed,
    runWhenAllowed
  });

  updateAppSurface();
  window.addEventListener("resize", updateAppSurface, { passive: true });
  window.addEventListener("orientationchange", updateAppSurface, { passive: true });
  addMediaChangeListener(standaloneMedia);
  addMediaChangeListener(landscapeMedia);

  try {
    if (window.screen && window.screen.orientation) {
      const screenOrientation = window.screen.orientation;
      if (typeof screenOrientation.addEventListener === "function") {
        screenOrientation.addEventListener("change", updateAppSurface);
      }
    }
  } catch (_) {
    // Older iOS versions do not expose Screen Orientation events.
  }
})();
