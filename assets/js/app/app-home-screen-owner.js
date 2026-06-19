(function () {
  "use strict";

  const HOME_SECTION_ID = "homeSection";
  const HOME_LAYOUT_ATTRIBUTE = "data-home-layout";
  const HOME_LAYOUT_GRID_VALUE = "grid";
  const HOME_LAYOUT_LEGACY_VALUE = "legacy";
  const HOME_GRID_CONTRACT_ATTRIBUTE = "data-home-grid-contract";
  const HOME_GRID_FALLBACK_ATTRIBUTE = "data-home-grid-fallback";
  const HOME_SOLVER_MODE_ATTRIBUTE = "data-home-solver-mode";
  const HOME_SOLVER_RETIREMENT_ATTRIBUTE = "data-home-solver-retirement";
  const HOME_LEGACY_SOLVER_EMERGENCY_ATTRIBUTE = "data-home-legacy-solver-emergency";
  const HOME_LEGACY_SOLVER_EMERGENCY_STORAGE_KEY = "klevgo:home:legacy-solver-emergency";
  const HOME_SCREEN_CONTRACT_CLASS = "kg-screen";
  const HOME_SCREEN_CONTRACT_MODE = "clean-integration";
  const HOME_SCREEN_CONTRACT_PASS_DELTA_PX = 2;
  const HOME_GRID_CONTRACT_ENABLED = true;
  const HOME_SOLVER_RETIREMENT_ENABLED = true;
  const HOME_GRID_DIAGNOSTIC_PASS_DELTA_PX = 2;
  const HOME_GRID_SAFETY_PASS_DELTA_PX = 6;
  const LOCK_ATTRIBUTE = "data-home-screen-lock";
  const HOME_SKELETON_ATTRIBUTE = "data-home-skeleton";
  const HOME_SKELETON_STORAGE_KEY = "klevgo:home-skeleton";
  const HOME_SKELETON_TAP_ZONE_ID = "homeSkeletonDevTapZone";
  const HOME_SKELETON_DIAGNOSTICS_OVERLAY_ID = "homeSkeletonDiagnosticsOverlay";
  const HOME_SKELETON_TAP_COUNT = 7;
  const HOME_SKELETON_TAP_WINDOW_MS = 2500;
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


  function isHomeSkeletonMode(homeSection = document.getElementById(HOME_SECTION_ID)) {
    return (
      document.body?.getAttribute(HOME_SKELETON_ATTRIBUTE) === "true" ||
      homeSection?.getAttribute(HOME_SKELETON_ATTRIBUTE) === "true"
    );
  }

  function setHomeSkeletonState(active) {
    const body = document.body;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    if (!body || !homeSection) return;

    if (active) {
      body.setAttribute(HOME_SKELETON_ATTRIBUTE, "true");
      homeSection.setAttribute(HOME_SKELETON_ATTRIBUTE, "true");
      return;
    }

    body.removeAttribute(HOME_SKELETON_ATTRIBUTE);
    homeSection.removeAttribute(HOME_SKELETON_ATTRIBUTE);
  }

  function readRectDiagnostics(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height
    };
  }

  function resolveHomeSkeletonGeometryDiagnostics({
    header,
    touchBar,
    homeSection,
    availableTop,
    availableBottom,
    availableHeight
  } = {}) {
    const quick = document.querySelector("#homeSection .home-quick-actions");
    const feed = document.querySelector("#homeSection .home-feed-preview");
    const weather = document.querySelector("#homeSection .home-weather-card");
    const headerRect = readRectDiagnostics(header);
    const touchBarRect = readRectDiagnostics(touchBar);
    const homeRect = readRectDiagnostics(homeSection);
    const homeComputedStyle = homeSection ? window.getComputedStyle(homeSection) : null;
    const quickRect = readRectDiagnostics(quick);
    const feedRect = readRectDiagnostics(feed);
    const weatherRect = readRectDiagnostics(weather);

    const weatherToTouchBarPx = weatherRect && touchBarRect
      ? touchBarRect.top - weatherRect.bottom
      : null;
    const weatherOverflowPx = weatherRect && touchBarRect
      ? Math.max(0, weatherRect.bottom - touchBarRect.top)
      : null;
    const homeOverflowPx = homeRect && touchBarRect
      ? Math.max(0, homeRect.bottom - touchBarRect.top)
      : null;
    const feedToWeatherGap = feedRect && weatherRect
      ? weatherRect.top - feedRect.bottom
      : null;
    const bottomRhythmDeltaPx = feedToWeatherGap != null && weatherToTouchBarPx != null
      ? Math.abs(feedToWeatherGap - weatherToTouchBarPx)
      : null;
    const expectedTop = Number.isFinite(availableTop) ? availableTop : (headerRect?.bottom ?? null);
    const expectedBottom = Number.isFinite(availableBottom) ? availableBottom : (touchBarRect?.top ?? null);
    const topDeltaPx = homeRect && expectedTop != null
      ? homeRect.top - expectedTop
      : null;
    const bottomDeltaPx = homeRect && expectedBottom != null
      ? homeRect.bottom - expectedBottom
      : null;

    return {
      skeletonMode: isHomeSkeletonMode(homeSection),
      headerRect,
      touchBarRect,
      homeSectionRect: homeRect,
      homeGridRootRect: homeRect,
      homeClassName: homeSection?.className ?? null,
      homeLayoutAttr: homeSection?.getAttribute(HOME_LAYOUT_ATTRIBUTE) ?? null,
      bodySkeletonAttr: document.body?.getAttribute(HOME_SKELETON_ATTRIBUTE) ?? null,
      homeSkeletonAttr: homeSection?.getAttribute(HOME_SKELETON_ATTRIBUTE) ?? null,
      homePosition: homeComputedStyle?.position ?? null,
      homeComputedTop: homeComputedStyle?.top ?? null,
      homeComputedBottom: homeComputedStyle?.bottom ?? null,
      homeComputedMarginTop: homeComputedStyle?.marginTop ?? null,
      homeComputedTransform: homeComputedStyle?.transform ?? null,
      homeComputedDisplay: homeComputedStyle?.display ?? null,
      quickRect,
      feedRect,
      weatherRect,
      availableHeight,
      homeTop: homeRect?.top ?? null,
      expectedTop,
      availableTop: expectedTop,
      homeBottom: homeRect?.bottom ?? null,
      expectedBottom,
      touchBarTop: touchBarRect?.top ?? expectedBottom,
      topDeltaPx,
      bottomDeltaPx,
      quickHeight: quickRect?.height ?? null,
      feedSlotHeight: feedRect?.height ?? null,
      weatherHeight: weatherRect?.height ?? null,
      weatherToTouchBarPx,
      weatherOverflowPx,
      homeOverflowPx,
      bottomRhythmDeltaPx,
      slotsOverlap: Boolean(
        quickRect && feedRect && weatherRect &&
        (quickRect.bottom > feedRect.top || feedRect.bottom > weatherRect.top)
      )
    };
  }


  function readHomeSkeletonStorageFlag() {
    try {
      return window.localStorage?.getItem(HOME_SKELETON_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function writeHomeSkeletonStorageFlag(enabled) {
    try {
      window.localStorage?.setItem(HOME_SKELETON_STORAGE_KEY, enabled ? "true" : "false");
    } catch (_) {
      // Keep the in-memory DOM state in sync even when storage is unavailable.
    }

    return enabled === true;
  }

  function shouldEnableHomeSkeletonMode() {
    return readHomeSkeletonStorageFlag();
  }

  function applyHomeSkeletonModeFromState(homeActive = isHomeScreenActive()) {
    const enabled = homeActive && shouldEnableHomeSkeletonMode();
    setHomeSkeletonState(enabled);
    return enabled;
  }

  function enableHomeSkeletonMode() {
    writeHomeSkeletonStorageFlag(true);
    syncHomeScreenState();
    return isHomeSkeletonMode();
  }

  function disableHomeSkeletonMode() {
    writeHomeSkeletonStorageFlag(false);
    syncHomeScreenState();
    return isHomeSkeletonMode();
  }

  function toggleHomeSkeletonMode() {
    writeHomeSkeletonStorageFlag(!shouldEnableHomeSkeletonMode());
    syncHomeScreenState();
    return isHomeSkeletonMode();
  }

  function ensureHomeSkeletonTapZone() {
    if (!document.body) return null;

    const existingZone = document.getElementById(HOME_SKELETON_TAP_ZONE_ID);
    if (existingZone) return existingZone;

    const zone = document.createElement("button");
    zone.id = HOME_SKELETON_TAP_ZONE_ID;
    zone.className = "home-skeleton-dev-tap-zone";
    zone.type = "button";
    zone.setAttribute("aria-label", "Exit Home skeleton diagnostic mode");
    zone.textContent = "EXIT SKELETON";
    document.body.appendChild(zone);

    return zone;
  }

  function ensureHomeSkeletonDiagnosticsOverlay() {
    if (!document.body) return null;

    const existingOverlay = document.getElementById(HOME_SKELETON_DIAGNOSTICS_OVERLAY_ID);
    if (existingOverlay) return existingOverlay;

    const overlay = document.createElement("div");
    overlay.id = HOME_SKELETON_DIAGNOSTICS_OVERLAY_ID;
    overlay.className = "home-skeleton-diagnostics-overlay";
    overlay.setAttribute("aria-live", "polite");
    document.body.appendChild(overlay);

    return overlay;
  }

  function formatHomeSkeletonDiagnosticValue(value) {
    if (value == null) return "null";
    if (typeof value === "boolean") return String(value);
    if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : "null";
    return String(value);
  }

  function refreshHomeSkeletonDiagnosticsOverlay() {
    const overlay = ensureHomeSkeletonDiagnosticsOverlay();
    if (!overlay) return null;

    const contract = getHomeFitContract() || {};
    const homeHeight = contract.homeSectionRect?.height ?? contract.homeHeight ?? null;
    const rows = [
      ["skeleton", contract.skeletonMode],
      ["available", contract.availableHeight],
      ["home", homeHeight],
      ["homeTop", contract.homeTop],
      ["expectedTop", contract.expectedTop ?? contract.availableTop],
      ["homeBottom", contract.homeBottom],
      ["expectedBottom", contract.expectedBottom ?? contract.touchBarTop],
      ["topDelta", contract.topDeltaPx],
      ["bottomDelta", contract.bottomDeltaPx],
      ["homeClassName", contract.homeClassName],
      ["homeLayoutAttr", contract.homeLayoutAttr],
      ["bodySkeletonAttr", contract.bodySkeletonAttr],
      ["homeSkeletonAttr", contract.homeSkeletonAttr],
      ["position", contract.homePosition],
      ["computedTop", contract.homeComputedTop],
      ["computedBottom", contract.homeComputedBottom],
      ["marginTop", contract.homeComputedMarginTop],
      ["transform", contract.homeComputedTransform],
      ["display", contract.homeComputedDisplay],
      ["quick", contract.quickHeight],
      ["feed", contract.feedSlotHeight],
      ["weather", contract.weatherHeight],
      ["toTouch", contract.weatherToTouchBarPx],
      ["weatherOv", contract.weatherOverflowPx],
      ["homeOv", contract.homeOverflowPx],
      ["overlap", contract.slotsOverlap],
      ["rhythmΔ", contract.bottomRhythmDeltaPx]
    ];

    overlay.textContent = [
      "SKELETON DIAG",
      ...rows.map(([label, value]) => `${label}: ${formatHomeSkeletonDiagnosticValue(value)}`)
    ].join("\n");

    return overlay.textContent;
  }

  function isEventInsideHomeSkeletonTapZone(event, zone) {
    if (!event || !zone) return false;

    const rect = zone.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function bindHomeSkeletonTapToggle() {
    const target = ensureHomeSkeletonTapZone();
    ensureHomeSkeletonDiagnosticsOverlay();
    if (!target || target.dataset.homeSkeletonTapToggleBound === "true") return;

    let tapCount = 0;
    let firstTapAt = 0;

    target.dataset.homeSkeletonTapToggleBound = "true";
    target.addEventListener("click", () => {
      if (isHomeSkeletonMode()) {
        tapCount = 0;
        firstTapAt = 0;
        disableHomeSkeletonMode();
      }
    });

    document.addEventListener("click", (event) => {
      if (isHomeSkeletonMode()) return;
      if (!isEventInsideHomeSkeletonTapZone(event, target)) return;

      const now = Date.now();
      if (!firstTapAt || now - firstTapAt > HOME_SKELETON_TAP_WINDOW_MS) {
        firstTapAt = now;
        tapCount = 0;
      }

      tapCount += 1;

      if (tapCount < HOME_SKELETON_TAP_COUNT) return;

      tapCount = 0;
      firstTapAt = 0;
      enableHomeSkeletonMode();
    });
  }

  function getPositiveHeight(value) {
    const height = Number(value);
    return Number.isFinite(height) && height > 0 ? height : 0;
  }

  function getFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getAbsoluteDelta(a, b) {
    const first = getFiniteNumber(a);
    const second = getFiniteNumber(b);
    if (first == null || second == null) return null;
    return Math.abs(first - second);
  }

  function getCssPixelValue(root, token) {
    if (!root || typeof getComputedStyle !== "function") return null;

    const value = getComputedStyle(root).getPropertyValue(token).trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function resolveHomeScreenContractIntegration({
    contractActive,
    contractClassActive,
    kgShellTop,
    kgShellHeight,
    kgShellBottomOffset,
    legacyShellTop,
    legacyShellHeight,
    legacyShellBottomOffset,
    homeTop,
    homeBottom,
    homeHeight,
    expectedTop,
    expectedBottom,
    expectedHeight
  } = {}) {
    const active = contractActive === true;

    if (!active) {
      return {
        homeScreenContractMode: "inactive",
        homeScreenContractActive: false,
        homeScreenContractClassActive: contractClassActive === true,
        homeScreenContractTokenBridgePass: null,
        homeScreenContractRectPass: null,
        homeScreenContractPass: null,
        homeScreenContractReason: "inactive",
        homeScreenContractTopDeltaPx: null,
        homeScreenContractBottomDeltaPx: null,
        homeScreenContractHeightDeltaPx: null,
        homeScreenContractTokenTopDeltaPx: null,
        homeScreenContractTokenHeightDeltaPx: null,
        homeScreenContractTokenBottomOffsetDeltaPx: null
      };
    }

    const tokenTopDelta = getAbsoluteDelta(kgShellTop, legacyShellTop);
    const tokenHeightDelta = getAbsoluteDelta(kgShellHeight, legacyShellHeight);
    const tokenBottomOffsetDelta = getAbsoluteDelta(kgShellBottomOffset, legacyShellBottomOffset);
    const topDelta = getAbsoluteDelta(homeTop, expectedTop);
    const bottomDelta = getAbsoluteDelta(homeBottom, expectedBottom);
    const heightDelta = getAbsoluteDelta(homeHeight, expectedHeight);
    const tokenBridgePass =
      tokenTopDelta != null &&
      tokenHeightDelta != null &&
      tokenBottomOffsetDelta != null &&
      tokenTopDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX &&
      tokenHeightDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX &&
      tokenBottomOffsetDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const rectPass =
      topDelta != null &&
      bottomDelta != null &&
      heightDelta != null &&
      topDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX &&
      bottomDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX &&
      heightDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;

    let reason = "integrated";
    if (contractClassActive !== true) reason = "kg-screen-class-missing";
    else if (!tokenBridgePass) reason = "kg-token-bridge-mismatch";
    else if (!rectPass) reason = "home-rect-contract-mismatch";

    return {
      homeScreenContractMode: HOME_SCREEN_CONTRACT_MODE,
      homeScreenContractActive: true,
      homeScreenContractClassActive: contractClassActive === true,
      homeScreenContractTokenBridgePass: tokenBridgePass,
      homeScreenContractRectPass: rectPass,
      homeScreenContractPass: contractClassActive === true && tokenBridgePass && rectPass,
      homeScreenContractReason: reason,
      homeScreenContractTopDeltaPx: topDelta,
      homeScreenContractBottomDeltaPx: bottomDelta,
      homeScreenContractHeightDeltaPx: heightDelta,
      homeScreenContractTokenTopDeltaPx: tokenTopDelta,
      homeScreenContractTokenHeightDeltaPx: tokenHeightDelta,
      homeScreenContractTokenBottomOffsetDeltaPx: tokenBottomOffsetDelta
    };
  }

  function resolveHomeHeaderFrameContract({
    contractActive,
    homeTop,
    headerTop,
    headerBottom,
    headerHeight,
    appShellAvailableTop,
    kernelHeaderBottom,
    kernelHeaderHeight
  } = {}) {
    if (contractActive !== true) {
      return {
        homeHeaderFrameMode: "inactive",
        homeHeaderFramePass: null,
        homeHeaderFrameReason: "inactive",
        homeHeaderFrameEdgeDeltaPx: null,
        homeHeaderFrameShellDeltaPx: null,
        homeHeaderFrameKernelBottomDeltaPx: null,
        homeHeaderFrameKernelHeightDeltaPx: null,
        homeHeaderTop: headerTop ?? null,
        homeHeaderBottom: headerBottom ?? null,
        homeHeaderHeight: headerHeight ?? null
      };
    }

    const edgeDelta = getAbsoluteDelta(homeTop, headerBottom);
    const shellDelta = getAbsoluteDelta(appShellAvailableTop, headerBottom);
    const kernelBottomDelta = getAbsoluteDelta(kernelHeaderBottom, headerBottom);
    const kernelHeightDelta = getAbsoluteDelta(kernelHeaderHeight, headerHeight);
    const edgePass = edgeDelta != null && edgeDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const shellPass = shellDelta == null || shellDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const kernelBottomPass =
      kernelBottomDelta == null || kernelBottomDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const kernelHeightPass =
      kernelHeightDelta == null || kernelHeightDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;

    let reason = "bound";
    if (!edgePass) reason = "screen-top-not-on-header-bottom";
    else if (!shellPass) reason = "shell-top-header-mismatch";
    else if (!kernelBottomPass) reason = "kernel-header-bottom-mismatch";
    else if (!kernelHeightPass) reason = "kernel-header-height-mismatch";

    return {
      homeHeaderFrameMode: "screen-header-integration",
      homeHeaderFramePass: edgePass && shellPass && kernelBottomPass && kernelHeightPass,
      homeHeaderFrameReason: reason,
      homeHeaderFrameEdgeDeltaPx: edgeDelta,
      homeHeaderFrameShellDeltaPx: shellDelta,
      homeHeaderFrameKernelBottomDeltaPx: kernelBottomDelta,
      homeHeaderFrameKernelHeightDeltaPx: kernelHeightDelta,
      homeHeaderTop: headerTop ?? null,
      homeHeaderBottom: headerBottom ?? null,
      homeHeaderHeight: headerHeight ?? null
    };
  }

  function resolveHomeTouchBarFrameContract({
    contractActive,
    homeBottom,
    touchBarTop,
    touchBarBottom,
    touchBarHeight,
    appShellAvailableBottom,
    kernelTouchBarTop,
    kernelTouchBarHeight
  } = {}) {
    if (contractActive !== true) {
      return {
        homeTouchBarFrameMode: "inactive",
        homeTouchBarFramePass: null,
        homeTouchBarFrameReason: "inactive",
        homeTouchBarFrameEdgeDeltaPx: null,
        homeTouchBarFrameShellDeltaPx: null,
        homeTouchBarFrameKernelTopDeltaPx: null,
        homeTouchBarFrameKernelHeightDeltaPx: null,
        homeTouchBarTop: touchBarTop ?? null,
        homeTouchBarBottom: touchBarBottom ?? null,
        homeTouchBarHeight: touchBarHeight ?? null
      };
    }

    const edgeDelta = getAbsoluteDelta(homeBottom, touchBarTop);
    const shellDelta = getAbsoluteDelta(appShellAvailableBottom, touchBarTop);
    const kernelTopDelta = getAbsoluteDelta(kernelTouchBarTop, touchBarTop);
    const kernelHeightDelta = getAbsoluteDelta(kernelTouchBarHeight, touchBarHeight);
    const edgePass = edgeDelta != null && edgeDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const shellPass = shellDelta == null || shellDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const kernelTopPass = kernelTopDelta == null || kernelTopDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;
    const kernelHeightPass = kernelHeightDelta == null || kernelHeightDelta <= HOME_SCREEN_CONTRACT_PASS_DELTA_PX;

    let reason = "bound";
    if (!edgePass) reason = "screen-bottom-not-on-touchbar-top";
    else if (!shellPass) reason = "shell-bottom-touchbar-mismatch";
    else if (!kernelTopPass) reason = "kernel-touchbar-top-mismatch";
    else if (!kernelHeightPass) reason = "kernel-touchbar-height-mismatch";

    return {
      homeTouchBarFrameMode: "screen-touchbar-integration",
      homeTouchBarFramePass: edgePass && shellPass && kernelTopPass && kernelHeightPass,
      homeTouchBarFrameReason: reason,
      homeTouchBarFrameEdgeDeltaPx: edgeDelta,
      homeTouchBarFrameShellDeltaPx: shellDelta,
      homeTouchBarFrameKernelTopDeltaPx: kernelTopDelta,
      homeTouchBarFrameKernelHeightDeltaPx: kernelHeightDelta,
      homeTouchBarTop: touchBarTop ?? null,
      homeTouchBarBottom: touchBarBottom ?? null,
      homeTouchBarHeight: touchBarHeight ?? null
    };
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

  function resolveHomeGridSolverMode(rhythm) {
    const measured = rhythm?.activeFeedCardMeasured === true;
    const delta = Number(rhythm?.bottomRhythmDelta);
    const overflow = Number(rhythm?.weatherOverflowPx);

    if (!measured || !Number.isFinite(delta) || !Number.isFinite(overflow)) {
      return {
        solverMode: "safety-fill",
        gridDiagnosticPass: false,
        gridSafetyPass: false,
        homeGridReason: "measurement-unavailable"
      };
    }

    if (overflow > 0) {
      return {
        solverMode: "safety-fill",
        gridDiagnosticPass: false,
        gridSafetyPass: false,
        homeGridReason: "weather-overflow"
      };
    }

    const gridDiagnosticPass = delta <= HOME_GRID_DIAGNOSTIC_PASS_DELTA_PX;
    const gridSafetyPass = delta <= HOME_GRID_SAFETY_PASS_DELTA_PX;

    return {
      solverMode: gridDiagnosticPass ? "read-only" : "safety-fill",
      gridDiagnosticPass,
      gridSafetyPass,
      homeGridReason: gridDiagnosticPass
        ? "grid-balanced"
        : gridSafetyPass
          ? "diagnostic-delta-only"
          : "bottom-rhythm-delta"
    };
  }

  function isHomeGridContractActive() {
    const homeSection = document.getElementById(HOME_SECTION_ID);
    return homeSection?.getAttribute(HOME_LAYOUT_ATTRIBUTE) === HOME_LAYOUT_GRID_VALUE;
  }

  function setHomeGridContractState(shouldEnable) {
    const root = document.documentElement;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    if (!root || !homeSection) return false;

    if (!shouldEnable || !HOME_GRID_CONTRACT_ENABLED) {
      homeSection.removeAttribute(HOME_LAYOUT_ATTRIBUTE);
      root.removeAttribute(HOME_GRID_CONTRACT_ATTRIBUTE);
      root.removeAttribute(HOME_GRID_FALLBACK_ATTRIBUTE);
      root.removeAttribute(HOME_SOLVER_MODE_ATTRIBUTE);
      root.removeAttribute(HOME_SOLVER_RETIREMENT_ATTRIBUTE);
      return false;
    }

    homeSection.setAttribute(HOME_LAYOUT_ATTRIBUTE, HOME_LAYOUT_GRID_VALUE);
    root.setAttribute(HOME_GRID_CONTRACT_ATTRIBUTE, "integrated");
    if (!root.hasAttribute(HOME_SOLVER_MODE_ATTRIBUTE)) {
      root.setAttribute(HOME_SOLVER_MODE_ATTRIBUTE, "retired-pending");
    }
    return true;
  }

  function setHomeScreenContractIntegrationState(shouldEnable) {
    const root = document.documentElement;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    if (!root || !homeSection) return false;

    if (!shouldEnable || !HOME_GRID_CONTRACT_ENABLED) {
      homeSection.classList.remove(HOME_SCREEN_CONTRACT_CLASS);
      homeSection.removeAttribute("data-home-screen-contract");
      root.removeAttribute("data-home-screen-contract");
      root.removeAttribute("data-home-screen-contract-pass");
      return false;
    }

    homeSection.classList.add(HOME_SCREEN_CONTRACT_CLASS);
    homeSection.removeAttribute("data-home-screen-contract");
    root.removeAttribute("data-home-screen-contract");
    root.removeAttribute("data-home-screen-contract-pass");
    return true;
  }

  function publishHomeLowerFill(root, fill) {
    if (!root) return;

    const normalizedFill = Math.max(0, Number(fill) || 0);
    const nextValue = `${normalizedFill}px`;
    if (root.style.getPropertyValue("--klevby-home-lower-fill-y") === nextValue) return;

    root.style.setProperty("--klevby-home-lower-fill-y", nextValue);
  }

  function isHomeLegacySolverEmergencyEnabled(root = document.documentElement) {
    if (root?.getAttribute(HOME_LEGACY_SOLVER_EMERGENCY_ATTRIBUTE) === "true") return true;

    try {
      return window.localStorage?.getItem(HOME_LEGACY_SOLVER_EMERGENCY_STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function resolveHomeRetiredSolverState({
    gridContractActive,
    gridMode,
    legacySolverResult,
    emergencyEnabled = false
  } = {}) {
    const suggestedLowerFillY = Math.max(0, Number(legacySolverResult?.lowerFillY) || 0);
    const legacySolverWouldApply = legacySolverResult?.solverApplied === true || suggestedLowerFillY > 0;
    const gridSolverMode = gridMode?.solverMode || "safety-fill";

    if (!HOME_SOLVER_RETIREMENT_ENABLED || gridContractActive !== true) {
      return {
        solverMode: "legacy-active",
        solverRetired: false,
        solverFallbackActive: legacySolverWouldApply,
        solverEmergencyEnabled: false,
        appliedLowerFillY: suggestedLowerFillY,
        legacySolverSuggestedLowerFillY: suggestedLowerFillY,
        legacySolverWouldApply,
        homeSolverRetirementReason: "legacy-layout"
      };
    }

    if (gridSolverMode === "safety-fill" && suggestedLowerFillY > 0) {
      return {
        solverMode: "safety-fill",
        solverRetired: false,
        solverFallbackActive: true,
        solverEmergencyEnabled: emergencyEnabled === true,
        appliedLowerFillY: suggestedLowerFillY,
        legacySolverSuggestedLowerFillY: suggestedLowerFillY,
        legacySolverWouldApply,
        homeSolverRetirementReason: emergencyEnabled
          ? "emergency-safety-fill"
          : "grid-needs-safety-fill"
      };
    }

    const readOnlyClean = gridSolverMode === "read-only";

    return {
      solverMode: readOnlyClean ? "retired-read-only" : "retired-watch",
      solverRetired: true,
      solverFallbackActive: false,
      solverEmergencyEnabled: emergencyEnabled === true,
      appliedLowerFillY: 0,
      legacySolverSuggestedLowerFillY: suggestedLowerFillY,
      legacySolverWouldApply,
      homeSolverRetirementReason: readOnlyClean
        ? "grid-read-only-clean"
        : gridMode?.homeGridReason || "grid-needs-watch"
    };
  }

  function updateHomeSolverRetirementState(density, touchBar) {
    const root = document.documentElement;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    if (!root || !touchBar) return;

    const gridContractActive = isHomeGridContractActive();
    const homeLayoutMode = homeSection?.getAttribute(HOME_LAYOUT_ATTRIBUTE) || HOME_LAYOUT_LEGACY_VALUE;
    const rhythm = measureHomeBottomRhythm(touchBar);
    const lowerFillCap = resolveHomeLowerFillCap(density);
    const result = resolveHomeLowerFill({
      upperGap: rhythm.upperGap,
      lowerGap: rhythm.lowerGap,
      maxFill: lowerFillCap,
      minLowerGap: HOME_MIN_LOWER_GAP_PX
    });
    const gridMode = gridContractActive
      ? resolveHomeGridSolverMode(rhythm)
      : {
          solverMode: "legacy-active",
          gridDiagnosticPass: null,
          gridSafetyPass: null,
          homeGridReason: "legacy-layout"
        };
    const retirement = resolveHomeRetiredSolverState({
      gridContractActive,
      gridMode,
      legacySolverResult: result,
      emergencyEnabled: isHomeLegacySolverEmergencyEnabled(root)
    });

    publishHomeLowerFill(root, retirement.appliedLowerFillY);
    root.setAttribute(HOME_SOLVER_MODE_ATTRIBUTE, retirement.solverMode);
    root.setAttribute(HOME_SOLVER_RETIREMENT_ATTRIBUTE, retirement.solverRetired ? "true" : "false");

    if (gridContractActive) {
      root.setAttribute(HOME_GRID_FALLBACK_ATTRIBUTE, retirement.solverFallbackActive ? "true" : "false");
    } else {
      root.removeAttribute(HOME_GRID_FALLBACK_ATTRIBUTE);
    }

    lastHomeFitContract = {
      ...lastHomeFitContract,
      homeLayoutMode,
      homeGridContractActive: gridContractActive,
      homeGridReadOnlyPass: gridMode.gridDiagnosticPass,
      homeGridSafetyPass: gridMode.gridSafetyPass,
      homeGridReason: gridMode.homeGridReason,
      solverMode: retirement.solverMode,
      solverRetired: retirement.solverRetired,
      solverFallbackActive: retirement.solverFallbackActive,
      solverEmergencyEnabled: retirement.solverEmergencyEnabled,
      homeSolverRetirementReason: retirement.homeSolverRetirementReason,
      activeFeedCardMeasured: rhythm.activeFeedCardMeasured,
      gapActiveFeedCardToWeather: rhythm.upperGap,
      gapWeatherToTouchBar: rhythm.lowerGap,
      bottomRhythmDelta: rhythm.bottomRhythmDelta,
      bottomRhythmPass: rhythm.bottomRhythmDelta != null && rhythm.bottomRhythmDelta <= 6,
      rhythmBefore: rhythm.bottomRhythmDelta,
      rhythmAfter: rhythm.bottomRhythmDelta,
      weatherOverflowPx: rhythm.weatherOverflowPx,
      lowerFillY: retirement.appliedLowerFillY,
      legacySolverSuggestedLowerFillY: retirement.legacySolverSuggestedLowerFillY,
      lowerFillCap: result.lowerFillCap,
      lowerFillReason: result.lowerFillReason,
      legacySolverWouldApply: retirement.legacySolverWouldApply,
      solverApplied: retirement.appliedLowerFillY > 0,
      solverCapped: result.solverCapped
    };
  }

  function updateHomeFitContract() {
    const root = document.documentElement;
    const homeSection = document.getElementById(HOME_SECTION_ID);
    const header = findAppHeader();
    const touchBar = document.querySelector(".mobile-tabbar");
    if (!root || !homeSection || !touchBar) return null;

    const headerRect = header?.getBoundingClientRect() || null;
    const homeSectionRect = homeSection.getBoundingClientRect();
    const mobileTabbarRect = touchBar.getBoundingClientRect();
    const headerMeasured = headerRect != null;
    const touchBarMeasured = true;
    const appShell = window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;
    const homeUsesAppShellContract =
      appShell?.chromeMode === "home" &&
      Number.isFinite(appShell.availableTop) &&
      Number.isFinite(appShell.availableBottom) &&
      Number.isFinite(appShell.availableHeight);
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
    const homeScreenContract = resolveHomeScreenContractIntegration({
      contractActive: homeSection.classList.contains(HOME_SCREEN_CONTRACT_CLASS),
      contractClassActive: homeSection.classList.contains(HOME_SCREEN_CONTRACT_CLASS),
      kgShellTop: getCssPixelValue(root, "--kg-shell-top"),
      kgShellHeight: getCssPixelValue(root, "--kg-shell-height"),
      kgShellBottomOffset: getCssPixelValue(root, "--kg-shell-bottom-offset"),
      legacyShellTop: getCssPixelValue(root, "--klevby-app-available-top"),
      legacyShellHeight: getCssPixelValue(root, "--klevby-app-available-height"),
      legacyShellBottomOffset: getCssPixelValue(root, "--klevby-app-available-bottom-offset"),
      homeTop: homeSectionRect.top,
      homeBottom: homeSectionRect.bottom,
      homeHeight: homeSectionRect.height,
      expectedTop: availableTop,
      expectedBottom: availableBottom,
      expectedHeight: availableHeight
    });
    const homeHeaderFrame = resolveHomeHeaderFrameContract({
      contractActive: homeScreenContract.homeScreenContractActive,
      homeTop: homeSectionRect.top,
      headerTop: headerRect?.top,
      headerBottom: headerRect?.bottom,
      headerHeight: headerRect?.height,
      appShellAvailableTop: appShell?.availableTop,
      kernelHeaderBottom: appShell?.headerBottom,
      kernelHeaderHeight: appShell?.headerHeight
    });
    const homeSkeletonGeometry = resolveHomeSkeletonGeometryDiagnostics({
      header,
      touchBar,
      homeSection,
      availableTop,
      availableBottom,
      availableHeight
    });

    const homeTouchBarFrame = resolveHomeTouchBarFrameContract({
      contractActive: homeScreenContract.homeScreenContractActive,
      homeBottom: homeSectionRect.bottom,
      touchBarTop: mobileTabbarRect.top,
      touchBarBottom: mobileTabbarRect.bottom,
      touchBarHeight: mobileTabbarRect.height,
      appShellAvailableBottom: appShell?.availableBottom,
      kernelTouchBarTop: appShell?.touchbarTop,
      kernelTouchBarHeight: appShell?.touchbarHeight
    });

    root.removeAttribute("data-home-screen-contract-pass");

    root.style.setProperty("--klevby-home-available-top", `${availableTop}px`);
    root.style.setProperty("--klevby-home-available-bottom", `${availableBottom}px`);
    root.style.setProperty("--klevby-home-available-height", `${availableHeight}px`);
    root.setAttribute(HOME_DENSITY_ATTRIBUTE, density);

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
      homeLayoutMode: homeSection.getAttribute(HOME_LAYOUT_ATTRIBUTE) || HOME_LAYOUT_LEGACY_VALUE,
      homeGridContractActive: isHomeGridContractActive(),
      homeGridReadOnlyPass: null,
      homeGridSafetyPass: null,
      homeGridReason: "baseline-pending",
      ...homeScreenContract,
      ...homeHeaderFrame,
      ...homeTouchBarFrame,
      ...homeSkeletonGeometry,
      solverMode: "retired-pending",
      solverRetired: HOME_SOLVER_RETIREMENT_ENABLED,
      solverFallbackActive: false,
      solverEmergencyEnabled: false,
      homeSolverRetirementReason: "baseline-pending",
      activeFeedCardMeasured: false,
      gapActiveFeedCardToWeather: null,
      gapWeatherToTouchBar: null,
      bottomRhythmDelta: null,
      bottomRhythmPass: false,
      lowerFillY: 0,
      legacySolverSuggestedLowerFillY: 0,
      lowerFillCap: resolveHomeLowerFillCap(density),
      lowerFillReason: "baseline-pending",
      legacySolverWouldApply: false,
      solverApplied: false,
      solverCapped: false,
      timestamp: new Date().toISOString()
    };

    updateHomeSolverRetirementState(density, touchBar);
    refreshHomeSkeletonDiagnosticsOverlay();
    return { ...lastHomeFitContract };
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
    const homeActive = isHomeScreenActive();
    applyHomeSkeletonModeFromState(homeActive);
    setLockState(homeActive);
    setHomeGridContractState(homeActive);
    setHomeScreenContractIntegrationState(homeActive);
    updateHomeFitContract();

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
    bindHomeSkeletonTapToggle();
    applyHomeSkeletonModeFromState(isHomeScreenActive());
    setHomeGridContractState(isHomeScreenActive());
    updateHomeFitContract();
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
    resolveMeasuredHomeDensity,
    resolveHomeLowerFill,
    resolveHomeGridSolverMode,
    resolveHomeRetiredSolverState,
    setHomeGridContractState,
    setHomeScreenContractIntegrationState,
    resolveHomeScreenContractIntegration,
    resolveHomeHeaderFrameContract,
    resolveHomeTouchBarFrameContract,
    getHomeFitContract,
    isHomeScreenActive,
    isHomeSkeletonMode,
    shouldEnableHomeSkeletonMode,
    enableHomeSkeletonMode,
    disableHomeSkeletonMode,
    toggleHomeSkeletonMode,
    refreshHomeSkeletonDiagnosticsOverlay
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      resolveMeasuredHomeDensity,
      resolveHomeLowerFillCap,
      resolveHomeLowerFill,
      resolveHomeGridSolverMode,
      resolveHomeRetiredSolverState,
      resolveHomeScreenContractIntegration,
      resolveHomeHeaderFrameContract,
      resolveHomeTouchBarFrameContract
    };
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.KlevbyHomeScreenOwner = homeScreenOwner;
    init();
  }
})();
