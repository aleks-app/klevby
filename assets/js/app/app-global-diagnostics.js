(function () {
  "use strict";

  const AUDIT_VERSION = "2026-06-24-full-audit-1";
  const MAX_ISSUES = 30;

  const SCREEN_DEFINITIONS = [
    { id: "home", sectionId: "homeSection", type: "tab" },
    { id: "feed", sectionId: "feedSection", type: "tab" },
    { id: "trips", sectionId: "tripsSection", type: "tab" },
    { id: "map", sectionId: "mapSection", type: "tab" },
    { id: "market", sectionId: "marketSection", type: "fullscreen" },
    { id: "ponds", sectionId: "pondsSection", type: "fullscreen" },
    { id: "water-body-detail", sectionId: "waterBodyDetailSection", type: "fullscreen" },
    { id: "auth", sectionId: "authSection", type: "fullscreen" },
    { id: "profile", sectionId: "profileSection", type: "fullscreen" },
  ];

  function safeRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    const rect = element.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  function readSafeArea(htmlStyles) {
    if (!htmlStyles) return null;
    return {
      top: htmlStyles.getPropertyValue("env(safe-area-inset-top, 0px)").trim() || null,
      right: htmlStyles.getPropertyValue("env(safe-area-inset-right, 0px)").trim() || null,
      bottom: htmlStyles.getPropertyValue("env(safe-area-inset-bottom, 0px)").trim() || null,
      left: htmlStyles.getPropertyValue("env(safe-area-inset-left, 0px)").trim() || null,
      bottomToken: htmlStyles.getPropertyValue("--klevby-bottom-safe-area").trim() || null,
    };
  }

  function shortError(error) {
    if (!error) return null;
    if (typeof error === "string") return error.slice(0, 180);
    const message = error.message || String(error);
    return message.slice(0, 180);
  }

  function getNavigationTiming() {
    try {
      const entry = performance.getEntriesByType("navigation")[0];
      if (!entry) return null;
      return {
        domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
        loadEventEndMs: Math.round(entry.loadEventEnd),
        responseEndMs: Math.round(entry.responseEnd),
      };
    } catch (_) {
      return null;
    }
  }

  function getActiveTabIndex() {
    const buttons = document.querySelectorAll(".mobile-tabbar .mobile-tab-btn");
    for (let i = 0; i < buttons.length; i += 1) {
      if (buttons[i].classList.contains("active")) return i;
    }
    return null;
  }

  function getVisibleSectionId() {
    if (typeof window.getVisibleSectionName === "function") {
      return window.getVisibleSectionName();
    }
    return null;
  }

  function collectScreenAudit() {
    const visible = getVisibleSectionId();
    return SCREEN_DEFINITIONS.map((screen) => {
      const section = document.getElementById(screen.sectionId);
      const hidden = !section || section.classList.contains("hidden");
      const rect = safeRect(section);
      const scrollHeight = section?.scrollHeight ?? null;
      const clientHeight = section?.clientHeight ?? null;
      const touchBar = document.querySelector(".mobile-tabbar");
      const touchBarTop = touchBar ? touchBar.getBoundingClientRect().top : null;
      const contentBottom = rect?.bottom ?? null;
      const overflowBehindTouchBar =
        !hidden &&
        touchBarTop != null &&
        contentBottom != null &&
        screen.type === "tab" &&
        contentBottom > touchBarTop + 2;

      return {
        id: screen.id,
        sectionId: screen.sectionId,
        type: screen.type,
        visible: screen.id === visible,
        hidden,
        bounds: rect,
        scrollHeight,
        clientHeight,
        overflowBehindTouchBar,
        usesSharedViewport: Boolean(window.KlevbyAppShellViewportOwner?.getLastMeasurement?.()),
        offlineCapable: ["home", "feed", "trips", "map"].includes(screen.id),
      };
    });
  }

  function collectBootDiagnostics() {
    const bootStore = window.KlevbyBootStore;
    const bootSnapshot = bootStore?.getSnapshotSync?.() || null;
    const splash = window.KlevbyAppSplash?.getDiagnosticsSnapshot?.() || null;
    const bootStartedAt = bootStore?.getBootStartedAt?.() ?? null;
    const navTiming = getNavigationTiming();

    const slowBootMarkers = [];
    if (splash?.elapsedMs != null && splash.elapsedMs > 3400) {
      slowBootMarkers.push("splash-force-hide-window-reached");
    }
    if (bootSnapshot?.bootDurationMs != null && bootSnapshot.bootDurationMs > 8000) {
      slowBootMarkers.push("boot-duration-over-8s");
    }
    if (navTiming?.domContentLoadedMs != null && navTiming.domContentLoadedMs > 5000) {
      slowBootMarkers.push("domcontentloaded-over-5s");
    }

    return {
      bootStartedAtMs: bootStartedAt,
      bootStartedAtIso: bootStartedAt != null ? new Date(Date.now() - (performance.now() - bootStartedAt)).toISOString() : null,
      navigationTiming: navTiming,
      firstRenderHappened: bootSnapshot?.firstRenderHappened ?? null,
      firstRenderAtMs: bootSnapshot?.firstRenderAtMs ?? null,
      shellPresented: bootSnapshot?.shellPresented ?? null,
      shellPresentedAtMs: bootSnapshot?.shellPresentedAtMs ?? null,
      bootCompletedAtMs: bootSnapshot?.bootCompletedAtMs ?? null,
      bootDurationMs: bootSnapshot?.bootDurationMs ?? null,
      splash,
      firstScreenRendered: bootSnapshot?.visibleSection ?? getVisibleSectionId(),
      bootErrors: (bootSnapshot?.lastBootErrors || []).map((entry) => ({
        scope: entry.scope,
        message: shortError(entry),
        atMs: entry.atMs,
      })),
      bootWarnings: slowBootMarkers,
      slowBootMarkers,
      documentReadyState: document.readyState,
      appBuildVersion: window.KLEVB_APP_BUILD_VERSION || null,
      lastSuccessfulBootAt: bootSnapshot?.lastSuccessfulBootAt ?? null,
      bootWaitedForAuth: false,
    };
  }

  function collectAuthDiagnostics() {
    const hasUser = Boolean(
      window.currentUser ||
        window.klevbyCurrentUser ||
        window.klevbyUser,
    );
    const authReady = Boolean(window.klevbyAuthReady || window.authReady);
    const recentLogout = (() => {
      try {
        return window.sessionStorage?.getItem("klevby_recent_logout") === "1";
      } catch (_) {
        return false;
      }
    })();

    let authMode = "unknown";
    if (hasUser) authMode = "authenticated";
    else if (authReady && !hasUser) authMode = recentLogout ? "guest" : "guest";
    else if (!authReady) authMode = "degraded";

    const bootSnapshot = window.KlevbyBootStore?.getSnapshotSync?.() || null;

    return {
      authReady,
      authMode,
      hasSessionUser: hasUser,
      profileLoadStatus: hasUser ? "loaded" : authReady ? "guest-or-empty" : "pending",
      lastAuthError: (bootSnapshot?.lastBootErrors || [])
        .filter((entry) => String(entry.scope || "").includes("auth"))
        .slice(-1)
        .map((entry) => shortError(entry))[0] || null,
      bootWaitedForAuth: false,
    };
  }

  function collectFeedDiagnostics() {
    const feedSection = document.getElementById("feedSection");
    const cards = feedSection
      ? feedSection.querySelectorAll(".feed-card, .post-card, [data-feed-post-id]")
      : [];
    const lastKnown = window.KlevbyLastKnownCache?.getLastKnownSnapshot?.() || null;
    const feedEntry = lastKnown?.entries?.feed || null;

    return {
      feedLoadStatus: feedSection?.classList.contains("hidden") ? "inactive" : "active-section",
      postsCount: cards.length,
      lastKnownPostsCount: feedEntry?.count ?? null,
      lastKnownSavedAt: feedEntry?.savedAtIso ?? null,
      feedSource: feedEntry?.present && cards.length > 0 ? "mixed-or-unknown" : feedEntry?.present ? "cached" : cards.length > 0 ? "live-dom" : "empty",
      lastFeedError: (window.KlevbyBootStore?.getSnapshotSync?.()?.lastNetworkErrors || [])
        .slice(-1)
        .map((entry) => shortError(entry))[0] || null,
    };
  }

  function collectTripsDiagnostics() {
    const tripsState = window.KlevbyTripsState?.getState?.() || null;
    const tripsSection = document.getElementById("tripsSection");
    const tripCards = tripsSection
      ? tripsSection.querySelectorAll(".trip-card, [data-trip-id], .trips-fullscreen-card")
      : [];
    const lastKnown = window.KlevbyLastKnownCache?.getLastKnownSnapshot?.() || null;
    const tripsEntry = lastKnown?.entries?.trips || null;
    const createFlow = window.KlevbyTripsCreateFlowOwner;

    return {
      tripsLoadStatus: tripsSection?.classList.contains("hidden") ? "inactive" : "active-section",
      tripsDomCount: tripCards.length,
      lastKnownTripsCount: tripsEntry?.count ?? null,
      lastKnownSavedAt: tripsEntry?.savedAtIso ?? null,
      activeFilters: tripsState
        ? {
            type: tripsState.selectedType,
            shelf: tripsState.selectedShelf,
            lowerFilter: tripsState.activeLowerFilter,
            region: tripsState.selectedRegion,
          }
        : null,
      counts: tripsState?.counts ?? null,
      createFlowOpen: createFlow?.isOpen?.() === true,
      createFlowStep: createFlow?.getDebug?.()?.step ?? null,
      screenType: createFlow?.isOpen?.() ? "flow" : "fullscreen",
    };
  }

  function collectHomeDiagnostics() {
    const home = document.getElementById("homeSection");
    const touchBar = document.querySelector(".mobile-tabbar");
    const weather = document.querySelector("#homeSection .home-weather-card, #homeSection .home-weather-strip");
    const feedCard = document.querySelector(
      "#homeSection .home-feed-preview-slide.is-active, #homeSection .home-feed-preview-card",
    );
    const homeRect = safeRect(home);
    const touchBarRect = safeRect(touchBar);
    const weatherRect = safeRect(weather);
    const feedRect = safeRect(feedCard);
    const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.() || null;
    const lastKnown = window.KlevbyLastKnownCache?.getLastKnownSnapshot?.() || null;

    const availableBottom = contract?.availableBottom ?? touchBarRect?.top ?? null;
    const contentBottom = contract?.homeContentBottom ?? weatherRect?.bottom ?? feedRect?.bottom ?? null;
    const overflowPx =
      availableBottom != null && contentBottom != null
        ? Math.max(0, Math.round(contentBottom - availableBottom))
        : null;

    return {
      containerBounds: homeRect,
      contentBottom,
      weatherBounds: weatherRect,
      feedCardBounds: feedRect,
      touchBarClearance:
        touchBarRect?.top != null && contentBottom != null
          ? Math.round(touchBarRect.top - contentBottom)
          : null,
      overflowPx,
      lastKnownDataUsed: Boolean(lastKnown?.entries?.home?.present || lastKnown?.entries?.weather?.present),
      density: document.documentElement.getAttribute("data-home-density") || null,
      lowerFillY: contract?.lowerFillY ?? null,
      usesAppShellContract: contract?.homeUsesAppShellContract === true,
    };
  }

  function collectTouchBarDiagnostics() {
    const touchBar = document.querySelector(".mobile-tabbar");
    const touchBarRect = safeRect(touchBar);
    const activeBtn = document.querySelector(".mobile-tabbar .mobile-tab-btn.active");
    const visibleSection = document.querySelector("main section:not(.hidden), #homeSection:not(.hidden), #feedSection:not(.hidden), #tripsSection:not(.hidden), #mapSection:not(.hidden)");
    const sectionRect = safeRect(visibleSection);
    const overlapRisk =
      touchBarRect &&
      sectionRect &&
      sectionRect.bottom > touchBarRect.top + 2;

    return {
      activeTab: getActiveTabIndex(),
      visible: touchBar ? getComputedStyle(touchBar).display !== "none" : false,
      bounds: touchBarRect,
      activeItemBounds: safeRect(activeBtn),
      overlapsContent: overlapRisk === true,
      screenBehindTouchBar: overlapRisk === true ? getVisibleSectionId() : null,
      chromeMode: document.body?.getAttribute("data-app-chrome-mode") || null,
    };
  }

  function collectWarnings(snapshot) {
    const warnings = [];

    if (window.KlevbyAppSplash?.isSplashActive?.()) {
      warnings.push({ code: "splash-still-active", message: "Splash overlay still visible after collect" });
    }
    if (snapshot.currentScreen?.screenType === "unknown") {
      warnings.push({ code: "screen-type-unknown", message: "Current screen type is unknown" });
    }
    if (snapshot.TouchBar?.overlapsContent) {
      warnings.push({
        code: "touchbar-overlap",
        message: `Content may render behind TouchBar on ${snapshot.currentScreen?.screenId || "screen"}`,
      });
    }
    if (snapshot.network?.detectedStatus === "offline" || snapshot.network?.detectedStatus === "weak") {
      warnings.push({
        code: "network-degraded",
        message: `Network status: ${snapshot.network.detectedStatus}`,
      });
    }

    snapshot.screens?.forEach((screen) => {
      if (screen.visible && screen.overflowBehindTouchBar) {
        warnings.push({
          code: "screen-overflow-touchbar",
          message: `${screen.id} content may overflow behind TouchBar`,
        });
      }
    });

    return warnings.slice(0, MAX_ISSUES);
  }

  function collectSync() {
    const html = document.documentElement;
    const htmlStyles = html ? getComputedStyle(html) : null;
    const appShell = window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;
    const bootSnapshot = window.KlevbyBootStore?.getSnapshotSync?.() || null;
    const visibleSection = getVisibleSectionId();
    const createFlowOpen = window.KlevbyTripsCreateFlowOwner?.isOpen?.() === true;

    const snapshot = {
      auditVersion: AUDIT_VERSION,
      timestamp: new Date().toISOString(),
      boot: collectBootDiagnostics(),
      appShell: {
        measurement: appShell,
        chromeMode: document.body?.getAttribute("data-app-chrome-mode") || null,
        headerVisible: appShell?.headerVisible ?? null,
        tabbarVisible: appShell?.tabbarVisible ?? null,
      },
      currentScreen: {
        screenId: visibleSection,
        screenType: createFlowOpen
          ? "flow"
          : bootSnapshot?.currentScreenType || "unknown",
        activeTab: getActiveTabIndex(),
        sectionElementId:
          SCREEN_DEFINITIONS.find((screen) => screen.id === visibleSection)?.sectionId || null,
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetTop: window.visualViewport.offsetTop,
              offsetLeft: window.visualViewport.offsetLeft,
              scale: window.visualViewport.scale,
            }
          : null,
        scrollHeight: html?.scrollHeight ?? null,
        clientHeight: html?.clientHeight ?? null,
        overflowRisk:
          html && html.scrollHeight > html.clientHeight + 4 ? "document-scrollable" : "none",
      },
      safeArea: readSafeArea(htmlStyles),
      TouchBar: collectTouchBarDiagnostics(),
      network: {
        navigatorOnLine: navigator.onLine,
        detectedStatus: window.KlevbyNetworkState?.getStatus?.() || bootSnapshot?.networkStatus || "unknown",
        simulatedOffline: window.KlevbyBootStore?.isSimulatedOffline?.() === true,
        ...(window.KlevbyNetworkState?.getDiagnosticsSnapshot?.() || {}),
      },
      serviceWorker: {
        supported: "serviceWorker" in navigator,
        controlled: Boolean(navigator.serviceWorker?.controller),
        scriptURL: navigator.serviceWorker?.controller?.scriptURL || null,
        buildVersion: bootSnapshot?.swBuildVersion || null,
        cacheName: bootSnapshot?.swCacheName || null,
      },
      caches: {
        cacheNames: null,
        cacheNamesAsync: true,
      },
      lastKnownCache: window.KlevbyLastKnownCache?.getLastKnownSnapshot?.() || null,
      auth: collectAuthDiagnostics(),
      supabase: {
        initStatus: bootSnapshot?.supabaseInitStatus || "unknown",
        lastSupabaseError: (bootSnapshot?.lastBootErrors || [])
          .filter((entry) => String(entry.scope || "").toLowerCase().includes("supabase"))
          .slice(-1)
          .map((entry) => shortError(entry))[0] || null,
      },
      Home: collectHomeDiagnostics(),
      Feed: collectFeedDiagnostics(),
      Trips: collectTripsDiagnostics(),
      CreateFlow: {
        open: window.KlevbyTripsCreateFlowOwner?.isOpen?.() === true,
        step: window.KlevbyTripsCreateFlowOwner?.getDebug?.()?.step ?? null,
        totalSteps: window.KlevbyTripsCreateFlowOwner?.getDebug?.()?.totalSteps ?? null,
      },
      Map: {
        initStatus: bootSnapshot?.mapInitStatus || "unknown",
        ...(window.KlevbyLastKnownMap?.getMapDiagnosticsSnapshot?.() || {}),
      },
      Chat: {
        shellPresent: Boolean(document.getElementById("chat-window")),
        launcherPresent: Boolean(document.getElementById("chat-desktop-btn")),
        windowVisible: (() => {
          const node = document.getElementById("chat-window");
          if (!node) return false;
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        })(),
      },
      screens: collectScreenAudit(),
      errors: (bootSnapshot?.lastBootErrors || []).slice(-10).map((entry) => ({
        scope: entry.scope,
        message: shortError(entry),
        atMs: entry.atMs,
      })),
      warnings: [],
    };

    snapshot.warnings = collectWarnings(snapshot);
    return snapshot;
  }

  async function collectAsync() {
    const snapshot = collectSync();

    if ("caches" in window) {
      try {
        snapshot.caches.cacheNames = await caches.keys();
        snapshot.caches.cacheNamesAsync = false;
      } catch (error) {
        snapshot.caches.cacheNamesError = shortError(error);
      }
    }

    return snapshot;
  }

  function publish(snapshot) {
    window.__KLEVBY_GLOBAL_DIAGNOSTICS__ = snapshot;
    return snapshot;
  }

  function collectAndPublish() {
    return publish(collectSync());
  }

  window.KlevbyGlobalDiagnostics = {
    AUDIT_VERSION,
    collectSync,
    collectAsync,
    collectAndPublish,
    getSnapshot: collectSync,
    publish,
  };

  window.addEventListener("klevby-app-shell-ready", collectAndPublish);
  window.addEventListener("klevby-app-splash-hidden", collectAndPublish);
  window.addEventListener("klevby-network-status", collectAndPublish);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", collectAndPublish, { once: true });
  } else {
    collectAndPublish();
  }
})();
