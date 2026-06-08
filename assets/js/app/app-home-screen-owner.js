(function () {
  "use strict";

  const HOME_SECTION_ID = "homeSection";
  const LOCK_ATTRIBUTE = "data-home-screen-lock";
  const HOME_DENSITY_ATTRIBUTE = "data-home-density";
  const HOME_COMPACT_HEIGHT_MAX = 820;
  const IPHONE_PWA_SHORT_HEIGHT_ENTER = 920;
  const IPHONE_PWA_SHORT_HEIGHT_EXIT = 930;
  const MOBILE_QUERY = "(max-width: 900px)";
  const FALLBACK_APP_SECTION_IDS = [
    "homeSection",
    "feedSection",
    "tripsSection",
    "createSection",
    "marketSection",
    "pondsSection",
    "mapSection",
    "authSection",
    "profileSection"
  ];

  let initialized = false;
  let homeScreenLocked = false;
  let syncFrame = 0;
  let observer = null;
  let hasCapturedFirstSync = false;
  let standaloneViewportReady = false;
  let deferredStandaloneHeight = 0;
  let isIphonePwaShort = false;

  function getPositiveHeight(value) {
    const height = Number(value);
    return Number.isFinite(height) && height > 0 ? height : 0;
  }

  function isStandalonePwa() {
    if (isNativeApp()) return false;

    const root = document.documentElement;
    const body = document.body;

    if (root?.classList.contains("pwa-standalone")) return true;
    if (body?.classList.contains("pwa-installed")) return true;

    try {
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches
      ) {
        return true;
      }
    } catch (_) {}

    return navigator.standalone === true;
  }

  function isStandaloneIphonePwa() {
    if (!isStandalonePwa()) return false;

    return /iPhone/i.test(navigator.userAgent || "");
  }

  function resolveHomeDensity(height) {
    if (isStandaloneIphonePwa()) {
      if (height < IPHONE_PWA_SHORT_HEIGHT_ENTER) {
        isIphonePwaShort = true;
      } else if (height >= IPHONE_PWA_SHORT_HEIGHT_EXIT) {
        isIphonePwaShort = false;
      }

      if (isIphonePwaShort) return "pwa-short";
    } else {
      isIphonePwaShort = false;
    }

    return height <= HOME_COMPACT_HEIGHT_MAX ? "compact" : "standard";
  }

  function resolveAppHeight(root) {
    const visualViewportHeight = getPositiveHeight(window.visualViewport?.height);
    const innerHeight = getPositiveHeight(window.innerHeight);
    const clientHeight = getPositiveHeight(root.clientHeight);

    if (isNativeApp()) {
      return visualViewportHeight || innerHeight || clientHeight;
    }

    if (isStandalonePwa()) {
      const layoutHeight = Math.max(innerHeight, clientHeight);
      return layoutHeight || visualViewportHeight;
    }

    return visualViewportHeight || innerHeight || clientHeight;
  }

  function updateAppHeight() {
    const root = document.documentElement;
    if (!root) return 0;

    const height = resolveAppHeight(root);

    if (!height) return 0;

    const roundedHeight = Math.round(height);
    root.style.setProperty("--klevby-app-height", `${roundedHeight}px`);
    root.setAttribute(HOME_DENSITY_ATTRIBUTE, resolveHomeDensity(height));
    return roundedHeight;
  }

  function isAppSurfaceAllowed() {
    const appSurface = window.KlevbyAppSurface;

    if (appSurface && typeof appSurface.isAllowed === "function") {
      try {
        return appSurface.isAllowed();
      } catch (_) {
        // Fall back to the published surface attribute.
      }
    }

    const surface = document.documentElement?.getAttribute("data-app-surface");
    return !surface || surface === "mobile-allowed";
  }

  function isNativeApp() {
    const capacitor = window.Capacitor;
    if (!capacitor) return false;

    try {
      if (typeof capacitor.isNativePlatform === "function") {
        return capacitor.isNativePlatform();
      }
    } catch (_) {}

    try {
      return typeof capacitor.getPlatform === "function" && capacitor.getPlatform() !== "web";
    } catch (_) {
      return false;
    }
  }

  function matchesMobileSurface() {
    const root = document.documentElement;

    if (root?.getAttribute("data-device-class") === "phone") return true;
    if (isNativeApp()) return true;
    if (root?.classList.contains("pwa-standalone")) return true;
    if (document.body?.classList.contains("pwa-installed")) return true;

    try {
      return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
    } catch (_) {
      return false;
    }
  }

  function getAppSectionIds() {
    const navigation = window.KlevbyAppNavigation;

    if (navigation && typeof navigation.getAppSections === "function") {
      try {
        const sectionIds = navigation.getAppSections();
        const validSectionIds = Array.isArray(sectionIds)
          ? sectionIds.filter((id) => typeof id === "string" && id.trim())
          : [];

        if (validSectionIds.length === sectionIds.length && validSectionIds.length) {
          return validSectionIds;
        }
      } catch (_) {
        // Fall back to the local list when navigation is not ready.
      }
    }

    return FALLBACK_APP_SECTION_IDS;
  }

  function hasAnotherActiveSection() {
    return getAppSectionIds().some((id) => {
      if (id === HOME_SECTION_ID) return false;

      const section = document.getElementById(id);
      return section && !section.classList.contains("hidden");
    });
  }

  function isHomeScreenActive() {
    const homeSection = document.getElementById(HOME_SECTION_ID);
    const body = document.body;

    if (!homeSection || !body) return false;
    if (homeSection.classList.contains("hidden")) return false;
    if (body.getAttribute("data-app-chrome-mode") !== "home") return false;
    if (hasAnotherActiveSection()) return false;
    if (!isAppSurfaceAllowed()) return false;

    return matchesMobileSurface();
  }

  function clearLockState(root, body) {
    root.removeAttribute(LOCK_ATTRIBUTE);
    body.removeAttribute(LOCK_ATTRIBUTE);
    homeScreenLocked = false;
  }

  function shouldDeferStandaloneHomeLock() {
    if (!isStandalonePwa() || standaloneViewportReady) return false;

    const height = updateAppHeight();
    if (height) deferredStandaloneHeight = Math.max(deferredStandaloneHeight, height);

    if (document.readyState === "complete") {
      standaloneViewportReady = true;
      return false;
    }

    return true;
  }

  function setLockState(shouldLock) {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    if (!shouldLock) {
      clearLockState(root, body);
      return;
    }

    if (shouldDeferStandaloneHomeLock()) {
      clearLockState(root, body);
      return;
    }

    updateAppHeight();
    root.setAttribute(LOCK_ATTRIBUTE, "true");
    body.setAttribute(LOCK_ATTRIBUTE, "true");

    if (!homeScreenLocked) {
      homeScreenLocked = true;
      window.scrollTo(0, 0);
    }
  }

  function syncHomeScreenState() {
    setLockState(isHomeScreenActive());

    if (!hasCapturedFirstSync) {
      hasCapturedFirstSync = true;
      window.KlevbyShellDebug?.capture("first syncHomeScreenState()");
    }
  }

  function scheduleSync() {
    if (syncFrame) return;

    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      syncHomeScreenState();
    });
  }

  function handleViewportChange() {
    const height = updateAppHeight();

    if (
      isStandalonePwa() &&
      !standaloneViewportReady &&
      (document.readyState === "complete" ||
        (deferredStandaloneHeight && height > deferredStandaloneHeight))
    ) {
      standaloneViewportReady = true;
    }

    scheduleSync();
  }

  function observeStateOwners() {
    const root = document.documentElement;
    const body = document.body;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    if (!root || !body || !homeSection || typeof MutationObserver !== "function") return;

    observer = new MutationObserver(scheduleSync);
    observer.observe(homeSection, { attributes: true, attributeFilter: ["class"] });
    observer.observe(body, { attributes: true, attributeFilter: ["data-app-chrome-mode"] });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-app-surface", "data-device-class"]
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    window.KlevbyShellDebug?.capture("app-home-screen-owner init");

    updateAppHeight();
    observeStateOwners();

    window.addEventListener("resize", handleViewportChange, { passive: true });
    window.addEventListener("orientationchange", handleViewportChange, { passive: true });
    window.addEventListener("load", handleViewportChange, { passive: true });
    window.addEventListener("pageshow", handleViewportChange, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) handleViewportChange();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
      window.visualViewport.addEventListener("scroll", handleViewportChange, { passive: true });
    }

    syncHomeScreenState();
  }

  window.KlevbyHomeScreenOwner = Object.freeze({
    init,
    syncHomeScreenState,
    updateAppHeight,
    isHomeScreenActive
  });

  init();
})();
