(function () {
  "use strict";

  const HOME_SECTION_ID = "homeSection";
  const LOCK_ATTRIBUTE = "data-home-screen-lock";
  const HOME_DENSITY_ATTRIBUTE = "data-home-density";
  const HOME_CLEARANCE_PX = 8;
  const HOME_STANDARD_AVAILABLE_HEIGHT_MIN = 720;
  const HOME_COMPACT_AVAILABLE_HEIGHT_MIN = 670;
  const HOME_MIN_LOWER_GAP_PX = 10;
  const HOME_RHYTHM_TARGET_DELTA_PX = 2;
  const HOME_LOWER_FILL_CAPS = Object.freeze({
    standard: 12,
    compact: 40,
    tight: 28
  });
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
  let finalLayoutLocked = false;
  let pipelineFrame = 0;
  let pipelineCommitFrame = 0;
  let activePipelineToken = 0;
  let lowerFillWriter = "none";
  let lowerFillResetDuringVisibleFrame = false;
  let finalCommitMutatesLayout = false;
  let lockedWeatherTop = null;
  let weatherMovedAfterVisibleLock = false;

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

  function resolveHomeLowerFillCap(density) {
    return HOME_LOWER_FILL_CAPS[density] ?? HOME_LOWER_FILL_CAPS.tight;
  }

  function resolveHomeLowerFill({
    upperGap,
    lowerGap,
    maxFill,
    minLowerGap = HOME_MIN_LOWER_GAP_PX
  } = {}) {
    const measuredUpperGap = Number(upperGap);
    const measuredLowerGap = Number(lowerGap);
    const fillCap = Math.max(0, Number(maxFill) || 0);
    const minimumLowerGap = Math.max(0, Number(minLowerGap) || 0);

    if (!Number.isFinite(measuredUpperGap) || !Number.isFinite(measuredLowerGap)) {
      return {
        lowerFillY: 0,
        lowerFillCap: fillCap,
        lowerFillReason: "measurement-unavailable",
        solverApplied: false,
        solverCapped: false
      };
    }

    const imbalance = measuredLowerGap - measuredUpperGap;
    if (imbalance <= HOME_RHYTHM_TARGET_DELTA_PX) {
      return {
        lowerFillY: 0,
        lowerFillCap: fillCap,
        lowerFillReason: imbalance < 0 ? "lower-gap-already-smaller" : "already-balanced",
        solverApplied: false,
        solverCapped: false
      };
    }

    const safeFill = Math.max(0, measuredLowerGap - minimumLowerGap);
    const lowerFillY = Math.min(imbalance, fillCap, safeFill);
    const solverCapped = lowerFillY < imbalance;
    let lowerFillReason = "rhythm-balanced";

    if (solverCapped) {
      lowerFillReason = safeFill < Math.min(imbalance, fillCap)
        ? "minimum-lower-gap-cap"
        : "density-cap";
    }

    return {
      lowerFillY,
      lowerFillCap: fillCap,
      lowerFillReason,
      solverApplied: lowerFillY > 0,
      solverCapped
    };
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

  function isVisibleHomeFrame() {
    return homeScreenLocked || finalLayoutLocked || isHomeScreenActive();
  }

  function markLowerFillWriter(writer) {
    if (!writer) return;
    if (lowerFillWriter === "none" || lowerFillWriter === writer) {
      lowerFillWriter = writer;
      return;
    }
    lowerFillWriter = "conflicted";
  }

  function publishHomeLowerFill(root, fill, writer = "solver") {
    markLowerFillWriter(writer);
    root.style.setProperty("--klevby-home-lower-fill-y", `${fill}px`);
  }

  function applyHomeBottomRhythmSolver(
    density,
    touchBar,
    { forced = false, resetBeforeMeasure = false } = {}
  ) {
    const root = document.documentElement;
    if (!root || !touchBar) return null;

    if (resetBeforeMeasure) {
      if (isVisibleHomeFrame()) {
        lowerFillResetDuringVisibleFrame = true;
      } else {
        publishHomeLowerFill(root, 0, "solver");
      }
    }

    const rhythmBefore = measureHomeBottomRhythm(touchBar);
    const lowerFillCap = resolveHomeLowerFillCap(density);
    const result = resolveHomeLowerFill({
      upperGap: rhythmBefore.upperGap,
      lowerGap: rhythmBefore.lowerGap,
      maxFill: lowerFillCap,
      minLowerGap: HOME_MIN_LOWER_GAP_PX
    });

    publishHomeLowerFill(root, result.lowerFillY);
    const rhythmAfter = measureHomeBottomRhythm(touchBar);

    lastHomeFitContract = {
      ...lastHomeFitContract,
      activeFeedCardMeasured: rhythmAfter.activeFeedCardMeasured,
      gapActiveFeedCardToWeather: rhythmAfter.upperGap,
      gapWeatherToTouchBar: rhythmAfter.lowerGap,
      bottomRhythmDelta: rhythmAfter.bottomRhythmDelta,
      bottomRhythmPass:
        rhythmAfter.bottomRhythmDelta != null && rhythmAfter.bottomRhythmDelta <= 6,
      rhythmBefore: rhythmBefore.bottomRhythmDelta,
      rhythmAfter: rhythmAfter.bottomRhythmDelta,
      weatherOverflowPx: rhythmAfter.weatherOverflowPx,
      lowerFillY: result.lowerFillY,
      lowerFillCap: result.lowerFillCap,
      lowerFillReason: forced && !result.solverApplied ? "forced-no-fill-needed" : result.lowerFillReason,
      solverApplied: result.solverApplied || forced,
      homeSolverExecuted: forced || lastHomeFitContract?.homeSolverExecuted === true,
      solverCapped: result.solverCapped
    };

    return { result, rhythmBefore, rhythmAfter };
  }

  function FINAL_LAYOUT_COMMIT(density, touchBar) {
    const root = document.documentElement;
    if (!root || !touchBar || !lastHomeFitContract) return null;

    const finalRhythm = measureHomeBottomRhythm(touchBar);
    const weatherCard = document.querySelector("#homeSection .home-weather-card");
    const weatherTop = weatherCard?.getBoundingClientRect?.().top ?? null;

    if (finalLayoutLocked && lockedWeatherTop != null && weatherTop != null) {
      weatherMovedAfterVisibleLock = Math.abs(weatherTop - lockedWeatherTop) > 1;
    }

    finalLayoutLocked = true;
    lockedWeatherTop = weatherTop;
    lastHomeFitContract = {
      ...lastHomeFitContract,
      activeFeedCardMeasured: finalRhythm.activeFeedCardMeasured,
      gapActiveFeedCardToWeather: finalRhythm.upperGap,
      gapWeatherToTouchBar: finalRhythm.lowerGap,
      bottomRhythmDelta: finalRhythm.bottomRhythmDelta,
      bottomRhythmPass:
        finalRhythm.bottomRhythmDelta != null && finalRhythm.bottomRhythmDelta <= 6,
      rhythmAfter: finalRhythm.bottomRhythmDelta,
      weatherOverflowPx: finalRhythm.weatherOverflowPx,
      layoutFinalAuthority: "css",
      lowerFillResetDuringVisibleFrame,
      lowerFillWriter,
      finalCommitMutatesLayout,
      weatherMovedAfterVisibleLock,
      finalLayoutCommitExecuted: true,
      homeCommitExecuted: true,
      finalLayoutCorrectionApplied: false,
      finalWeatherGapPx: finalRhythm.lowerGap,
      finalSolverWasForced: false,
      finalLayoutLocked,
      homeFrameLocked: finalLayoutLocked,
      weatherTouchBarVisualPass:
        finalRhythm.lowerGap != null && finalRhythm.lowerGap >= HOME_CLEARANCE_PX
    };

    return { ...lastHomeFitContract };
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
      homeSolverExecuted: false,
      homeCommitExecuted: false,
      homeFrameLocked: false,
      homePipelineDurationMs: 0,
      activeFeedCardMeasured: false,
      gapActiveFeedCardToWeather: null,
      gapWeatherToTouchBar: null,
      bottomRhythmDelta: null,
      bottomRhythmPass: false,
      lowerFillY: 0,
      lowerFillCap: resolveHomeLowerFillCap(density),
      lowerFillReason: "baseline-pending",
      solverApplied: false,
      solverCapped: false,
      layoutFinalAuthority: "css",
      lowerFillResetDuringVisibleFrame,
      lowerFillWriter,
      finalCommitMutatesLayout,
      weatherMovedAfterVisibleLock,
      finalLayoutCommitExecuted: false,
      finalLayoutCorrectionApplied: false,
      finalWeatherGapPx: null,
      finalSolverWasForced: false,
      finalLayoutLocked: false,
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
    if (pipelineCommitFrame) window.cancelAnimationFrame(pipelineCommitFrame);

    pipelineFrame = window.requestAnimationFrame((startTime) => {
      pipelineFrame = 0;
      if (token !== activePipelineToken) return;

      finalLayoutLocked = false;
      const pipelineStartedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : startTime;
      const measurement = measureHomeFitContract();
      if (!measurement) return;

      lastHomeFitContract = {
        ...lastHomeFitContract,
        homePipelineFrameExecuted: true,
        homeSolverExecuted: false,
        homeCommitExecuted: false,
        homeFrameLocked: false,
        homePipelineDurationMs: 0
      };

      applyHomeBottomRhythmSolver(measurement.density, measurement.touchBar, {
        forced: true,
        resetBeforeMeasure: false
      });
      lastHomeFitContract = {
        ...lastHomeFitContract,
        homeSolverExecuted: true,
        solverApplied: true
      };

      applyMeasuredHomeLayoutTokens(measurement);

      pipelineCommitFrame = window.requestAnimationFrame((commitTime) => {
        pipelineCommitFrame = 0;
        if (token !== activePipelineToken || finalLayoutLocked) return;

        FINAL_LAYOUT_COMMIT(measurement.density, measurement.touchBar);
        const endedAt =
          typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : commitTime;
        finalLayoutLocked = true;
        lastHomeFitContract = {
          ...lastHomeFitContract,
          solverApplied: true,
          homeCommitExecuted: true,
          homeFrameLocked: true,
          finalLayoutLocked: true,
          homePipelineDurationMs: Math.max(0, endedAt - pipelineStartedAt)
        };
      });
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
    resolveHomeLowerFill,
    getHomeFitContract,
    FINAL_LAYOUT_COMMIT,
    isHomeScreenActive
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      resolveMeasuredHomeDensity,
      resolveHomeLowerFillCap,
      resolveHomeLowerFill
    };
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.KlevbyHomeScreenOwner = homeScreenOwner;
    init();
  }
})();
