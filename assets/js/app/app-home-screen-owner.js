(function () {
  "use strict";

  const HOME_SECTION_ID = "homeSection";
  const LOCK_ATTRIBUTE = "data-home-screen-lock";
  const HOME_DENSITY_ATTRIBUTE = "data-home-density";
  const HOME_CLEARANCE_PX = 8;
  const HOME_STANDARD_AVAILABLE_HEIGHT_MIN = 720;
  const HOME_COMPACT_AVAILABLE_HEIGHT_MIN = 670;
  const MOBILE_QUERY = "(max-width: 900px)";
  const FALLBACK_APP_SECTION_IDS = [
    "homeSection",
    "feedSection",
    "tripsSection",
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
  let lastHomeFitContract = null;
  let pipelineFrame = 0;
  let activePipelineToken = 0;

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

  function resolveMeasuredHomeDensity(availableHeight) {
    const measuredHeight = getPositiveHeight(availableHeight);
    if (measuredHeight >= HOME_STANDARD_AVAILABLE_HEIGHT_MIN) return "standard";
    if (measuredHeight >= HOME_COMPACT_AVAILABLE_HEIGHT_MIN) return "compact";
    return "tight";
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
    return roundedHeight;
  }

  function findAppHeader() {
    return (
      document.querySelector("header[data-chrome-mode]") ||
      document.querySelector("body header") ||
      document.querySelector("header") ||
      document.querySelector(".app-header")
    );
  }

  function findActiveHomeFeedCard() {
    return (
      document.querySelector("#homeSection .home-feed-preview-slide.is-active") ||
      document.querySelector(
        "#homeSection .home-feed-preview-slide, #homeSection .home-feed-preview-card"
      )
    );
  }

  function measureHomeBottomRhythm(touchBar) {
    const activeFeedCard = findActiveHomeFeedCard();
    const weatherCard = document.querySelector("#homeSection .home-weather-card");
    if (!activeFeedCard || !weatherCard || !touchBar) {
      return {
        activeFeedCardMeasured: false,
        upperGap: null,
        lowerGap: null,
        bottomRhythmDelta: null,
        weatherOverflowPx: null
      };
    }

    const activeFeedCardRect = activeFeedCard.getBoundingClientRect();
    const weatherCardRect = weatherCard.getBoundingClientRect();
    const touchBarRect = touchBar.getBoundingClientRect();
    const upperGap = weatherCardRect.top - activeFeedCardRect.bottom;
    const lowerGap = touchBarRect.top - weatherCardRect.bottom;

    return {
      activeFeedCardMeasured: true,
      upperGap,
      lowerGap,
      bottomRhythmDelta: Math.abs(upperGap - lowerGap),
      weatherOverflowPx: Math.max(0, weatherCardRect.bottom - (touchBarRect.top - HOME_CLEARANCE_PX))
    };
  }

  function measureHomeFitContract() {
    const root = document.documentElement;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    const appShell = window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;
    const homeUsesAppShellContract =
      appShell?.chromeMode === "home" &&
      Number.isFinite(appShell.availableTop) &&
      Number.isFinite(appShell.availableBottom) &&
      Number.isFinite(appShell.availableHeight);
    const header = homeUsesAppShellContract ? null : findAppHeader();
    const touchBar = document.querySelector(".mobile-tabbar");
    if (!root || !homeSection || !touchBar) return null;

    const headerRect = header?.getBoundingClientRect() || null;
    const homeSectionRect = homeSection.getBoundingClientRect();
    const mobileTabbarRect = touchBar.getBoundingClientRect();
    const headerMeasured = headerRect != null;
    const touchBarMeasured = true;
    const fallbackTopUsed = !homeUsesAppShellContract && !headerMeasured;
    const fallbackAvailableTop = headerRect?.bottom ?? homeSectionRect.top;
    const fallbackAvailableBottom = mobileTabbarRect.top - HOME_CLEARANCE_PX;
    const availableTop = homeUsesAppShellContract
      ? appShell.availableTop
      : fallbackAvailableTop;
    const availableBottom = homeUsesAppShellContract
      ? appShell.availableBottom
      : fallbackAvailableBottom;
    const availableHeight = homeUsesAppShellContract
      ? appShell.availableHeight
      : Math.max(0, availableBottom - availableTop);
    const appHeight = resolveAppHeight(root);
    const density = resolveMeasuredHomeDensity(availableHeight);

    lastHomeFitContract = {
      headerBottom: headerRect?.bottom ?? null,
      touchBarTop: mobileTabbarRect.top,
      availableTop,
      availableBottom,
      availableHeight,
      headerMeasured,
      touchBarMeasured,
      fallbackTopUsed,
      homeUsesAppShellContract,
      appShellBoundaryAuthority: homeUsesAppShellContract,
      appShellAvailableTop: appShell?.availableTop ?? null,
      appShellAvailableBottom: appShell?.availableBottom ?? null,
      appShellAvailableHeight: appShell?.availableHeight ?? null,
      homeAppShellDeltaTop: homeUsesAppShellContract
        ? availableTop - appShell.availableTop
        : null,
      homeAppShellDeltaBottom: homeUsesAppShellContract
        ? availableBottom - appShell.availableBottom
        : null,
      appHeight,
      currentDensity: density,
      homePipelineFrameExecuted: false,
      homePipelineDurationMs: 0,
      activeFeedCardMeasured: false,
      gapActiveFeedCardToWeather: null,
      gapWeatherToTouchBar: null,
      bottomRhythmDelta: null,
      bottomRhythmPass: false,
      layoutFinalAuthority: "css",
      finalWeatherGapPx: null,
      weatherTouchBarVisualPass: false,
      timestamp: new Date().toISOString()
    };

    return {
      root,
      touchBar,
      density,
      availableTop,
      availableBottom,
      availableHeight,
      contract: { ...lastHomeFitContract }
    };
  }

  function applyMeasuredHomeLayoutTokens(measurement) {
    const root = measurement?.root || document.documentElement;
    if (!root || !measurement) return;

    root.style.setProperty("--klevby-home-available-top", `${measurement.availableTop}px`);
    root.style.setProperty("--klevby-home-available-bottom", `${measurement.availableBottom}px`);
    root.style.setProperty("--klevby-home-available-height", `${measurement.availableHeight}px`);
    root.setAttribute(HOME_DENSITY_ATTRIBUTE, measurement.density);
  }

  function HOME_LAYOUT_PIPELINE_FRAME() {
    const token = ++activePipelineToken;

    if (pipelineFrame) window.cancelAnimationFrame(pipelineFrame);

    pipelineFrame = window.requestAnimationFrame((startTime) => {
      pipelineFrame = 0;
      if (token !== activePipelineToken) return;

      const pipelineStartedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : startTime;
      const measurement = measureHomeFitContract();
      if (!measurement) return;

      applyMeasuredHomeLayoutTokens(measurement);

      const finalRhythm = measureHomeBottomRhythm(measurement.touchBar);
      const endedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : startTime;
      lastHomeFitContract = {
        ...lastHomeFitContract,
        homePipelineFrameExecuted: true,
        activeFeedCardMeasured: finalRhythm.activeFeedCardMeasured,
        gapActiveFeedCardToWeather: finalRhythm.upperGap,
        gapWeatherToTouchBar: finalRhythm.lowerGap,
        bottomRhythmDelta: finalRhythm.bottomRhythmDelta,
        bottomRhythmPass: finalRhythm.bottomRhythmDelta === 0,
        weatherOverflowPx: finalRhythm.weatherOverflowPx,
        finalWeatherGapPx: finalRhythm.lowerGap,
        weatherTouchBarVisualPass:
          finalRhythm.lowerGap != null && finalRhythm.lowerGap >= HOME_CLEARANCE_PX,
        homePipelineDurationMs: Math.max(0, endedAt - pipelineStartedAt)
      };
    });

    return getHomeFitContract();
  }

  function updateHomeFitContract() {
    return HOME_LAYOUT_PIPELINE_FRAME();
  }

  function getHomeFitContract() {
    return lastHomeFitContract ? { ...lastHomeFitContract } : null;
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
    HOME_LAYOUT_PIPELINE_FRAME();

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
    HOME_LAYOUT_PIPELINE_FRAME();
    observeStateOwners();

    window.addEventListener("resize", handleViewportChange, { passive: true });
    window.addEventListener("orientationchange", handleViewportChange, { passive: true });
    window.addEventListener("load", handleViewportChange, { passive: true });
    window.addEventListener("pageshow", handleViewportChange, { passive: true });
    window.addEventListener("klevby-app-shell-updated", scheduleSync, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) handleViewportChange();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
      window.visualViewport.addEventListener("scroll", handleViewportChange, { passive: true });
    }

    syncHomeScreenState();
  }

  const homeScreenOwner = Object.freeze({
    init,
    syncHomeScreenState,
    updateAppHeight,
    updateHomeFitContract,
    HOME_LAYOUT_PIPELINE_FRAME,
    resolveMeasuredHomeDensity,
    getHomeFitContract,
    isHomeScreenActive
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      resolveMeasuredHomeDensity,
    };
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.KlevbyHomeScreenOwner = homeScreenOwner;
    init();
  }
})();
