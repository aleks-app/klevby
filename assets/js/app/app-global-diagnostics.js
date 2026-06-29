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

  function collectSplashDiagnostics() {
    const raw = window.KlevbyAppSplash?.getDiagnosticsSnapshot?.() || null;
    if (!raw) {
      return {
        startedAt: null,
        shellReadyAt: null,
        hiddenAt: null,
        visibleDurationMs: null,
        minDurationMs: null,
        maxSafetyTimeoutMs: null,
        hideReason: null,
        isActive: null,
        available: false,
      };
    }

    return {
      startedAt: raw.startedAt ?? raw.splashStartedAtMs ?? null,
      shellReadyAt: raw.shellReadyAt ?? raw.shellReadyMarkedAtMs ?? null,
      hiddenAt: raw.hiddenAt ?? raw.splashHiddenAtMs ?? null,
      visibleDurationMs: raw.visibleDurationMs ?? raw.elapsedMs ?? null,
      minDurationMs: raw.minDurationMs ?? raw.requiredVisibleMs ?? null,
      maxSafetyTimeoutMs: raw.maxSafetyTimeoutMs ?? raw.forceHideMs ?? null,
      hideReason: raw.hideReason ?? null,
      isActive: raw.isActive ?? null,
      shellReady: raw.shellReady ?? null,
      hideCommitted: raw.hideCommitted ?? null,
      available: true,
    };
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

  function summarizeLastKnownCache() {
    const full = window.KlevbyLastKnownCache?.getLastKnownSnapshot?.();
    if (!full) return null;
    const entries = {};
    Object.entries(full.entries || {}).forEach(([key, entry]) => {
      entries[key] = {
        present: Boolean(entry?.present),
        count: entry?.count ?? null,
        savedAtIso: entry?.savedAtIso ?? null,
      };
    });
    return {
      schemaVersion: full.schemaVersion || null,
      keys: full.keys || [],
      entries,
      lastWriteStatus: full.lastWriteStatus || null,
    };
  }

  function collectBootSummary() {
    const bootSnapshot = window.KlevbyBootStore?.getSnapshotSync?.() || null;
    if (!bootSnapshot) return { available: false };
    return {
      bootDurationMs: bootSnapshot.bootDurationMs ?? null,
      supabaseInitStatus: bootSnapshot.supabaseInitStatus ?? null,
      mapInitStatus: bootSnapshot.mapInitStatus ?? null,
      networkStatus: bootSnapshot.networkStatus ?? null,
      visibleSection: bootSnapshot.visibleSection ?? getVisibleSectionId(),
      shellPresented: bootSnapshot.shellPresented ?? null,
      firstRenderHappened: bootSnapshot.firstRenderHappened ?? null,
      appBuildVersion: bootSnapshot.appBuildVersion ?? window.KLEVB_APP_BUILD_VERSION ?? null,
      errorCount: bootSnapshot.lastBootErrors?.length ?? 0,
      errors: (bootSnapshot.lastBootErrors || []).slice(-3).map((entry) => ({
        scope: entry.scope,
        message: shortError(entry),
      })),
    };
  }

  function collectCompactSync(overlayMeta) {
    const html = document.documentElement;
    const htmlStyles = html ? getComputedStyle(html) : null;
    const appShell = window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;
    const bootSnapshot = window.KlevbyBootStore?.getSnapshotSync?.() || null;
    const visibleSection = getVisibleSectionId();
    const createFlowOpen = window.KlevbyTripsCreateFlowOwner?.isOpen?.() === true;
    const networkProbe = window.KlevbyNetworkState?.getDiagnosticsSnapshot?.() || null;

    const snapshot = {
      auditVersion: AUDIT_VERSION,
      compact: true,
      timestamp: new Date().toISOString(),
      boot: collectBootSummary(),
      splash: collectSplashDiagnostics(),
      appShell: appShell
        ? {
            availableTop: appShell.availableTop ?? null,
            availableBottom: appShell.availableBottom ?? null,
            availableHeight: appShell.availableHeight ?? null,
            chromeMode: appShell.chromeMode ?? (document.body?.getAttribute("data-app-chrome-mode") || null),
            headerVisible: appShell.headerVisible ?? null,
            tabbarVisible: appShell.tabbarVisible ?? null,
          }
        : { available: false },
      currentScreen: {
        screenId: visibleSection,
        screenType: createFlowOpen ? "flow" : bootSnapshot?.currentScreenType || "unknown",
        activeTab: getActiveTabIndex(),
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetTop: window.visualViewport.offsetTop,
            }
          : null,
      },
      safeArea: readSafeArea(htmlStyles),
      TouchBar: collectTouchBarDiagnostics(),
      network: {
        navigatorOnLine: navigator.onLine,
        detectedStatus: window.KlevbyNetworkState?.getStatus?.() || bootSnapshot?.networkStatus || "unknown",
        simulatedOffline: window.KlevbyBootStore?.isSimulatedOffline?.() === true,
        lastCheckedAtIso: networkProbe?.lastCheckedAtIso ?? null,
        lastProbe: networkProbe?.lastProbe
          ? {
              ok: networkProbe.lastProbe.ok,
              elapsedMs: networkProbe.lastProbe.elapsedMs,
              status: networkProbe.lastProbe.status,
              error: networkProbe.lastProbe.error
                ? shortError(networkProbe.lastProbe.error)
                : null,
            }
          : null,
      },
      serviceWorker: {
        supported: "serviceWorker" in navigator,
        controlled: Boolean(navigator.serviceWorker?.controller),
        buildVersion: bootSnapshot?.swBuildVersion || null,
      },
      caches: {
        supported: "caches" in window,
        note: "Use async collect for cache name list",
      },
      lastKnownCache: summarizeLastKnownCache(),
      auth: collectAuthDiagnostics(),
      supabase: {
        initStatus: bootSnapshot?.supabaseInitStatus || "unknown",
        lastError: (bootSnapshot?.lastBootErrors || [])
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
      },
      Map: {
        initStatus: bootSnapshot?.mapInitStatus || "unknown",
      },
      errors: (bootSnapshot?.lastBootErrors || []).slice(-5).map((entry) => ({
        scope: entry.scope,
        message: shortError(entry),
      })),
      warnings: [],
      diagnosticsOverlay: overlayMeta || null,
    };

    snapshot.warnings = collectWarnings(snapshot).slice(0, 5);
    return snapshot;
  }

  function truncatePreview(text, maxLen) {
    const safe = String(text || "");
    if (safe.length <= maxLen) return safe;
    return `${safe.slice(0, maxLen)}\n… [preview truncated]`;
  }

  function isRuntimeReady() {
    return typeof window.KlevbyBootStore?.getSnapshotSync === "function";
  }

  function buildUnavailableJson(errorMessage) {
    return JSON.stringify(
      {
        available: false,
        error: shortError(errorMessage) || "Global diagnostics unavailable",
        runtimeReady: isRuntimeReady(),
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  function buildCompactJson(overlayMeta) {
    try {
      if (!isRuntimeReady()) {
        return buildUnavailableJson("KlevbyBootStore not ready");
      }
      const snapshot = collectCompactSync(overlayMeta);
      publish(snapshot);
      return JSON.stringify(snapshot, null, 2);
    } catch (error) {
      return buildUnavailableJson(error);
    }
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
      splash: collectSplashDiagnostics(),
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
    if (globalDiagnosticsApi) {
      globalDiagnosticsApi.lastSnapshot = snapshot;
    }
    return snapshot;
  }

  function collectAndPublish() {
    return publish(collectCompactSync());
  }

  function scheduleBackgroundPublish() {
    window.setTimeout(() => {
      try {
        if (isRuntimeReady()) collectAndPublish();
      } catch (_) {}
    }, 0);
  }

  const OVERLAY_ID = "klevgoHomeBoxDiagnosticsOverlay";
  const PREVIEW_MAX_CHARS = 1600;

  const overlayRuntime = {
    openedAt: null,
    buttonsCount: 0,
    actionsBound: false,
    lastAction: null,
    lastError: null,
    freezeSafeMode: true,
    busy: false,
    root: null,
    statusNode: null,
    previewNode: null,
    getHomeJson: null,
  };

  function hideDiagnosticsOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
    overlayRuntime.root = null;
    overlayRuntime.statusNode = null;
    overlayRuntime.previewNode = null;
    overlayRuntime.busy = false;
    overlayRuntime.openedAt = null;
  }

  function setOverlayStatus(message, ok) {
    if (!overlayRuntime.statusNode) return;
    overlayRuntime.statusNode.textContent = message;
    overlayRuntime.statusNode.style.color = ok === false ? "#ffb4a2" : "#b7f7cf";
  }

  function setOverlayPreview(text) {
    if (!overlayRuntime.previewNode) return;
    overlayRuntime.previewNode.textContent = truncatePreview(text, PREVIEW_MAX_CHARS);
  }

  function copyTextFallback(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    return copyTextFallback(text);
  }

  function runDeferred(task) {
    window.setTimeout(() => {
      try {
        task();
      } catch (error) {
        overlayRuntime.lastError = shortError(error);
        setOverlayStatus("Action failed", false);
        overlayRuntime.busy = false;
      }
    }, 0);
  }

  async function runCopyAction(label, buildJson) {
    if (overlayRuntime.busy) return;
    overlayRuntime.busy = true;
    overlayRuntime.lastAction = label;
    setOverlayStatus("Preparing…", true);

    runDeferred(async () => {
      let json = "";
      try {
        json = buildJson();
      } catch (error) {
        json = buildUnavailableJson(error);
      }

      const copied = await copyTextToClipboard(json);
      setOverlayStatus(copied ? `${label} copied` : "Copy failed", copied);
      setOverlayPreview(copied ? `${label} ready (${json.length} chars).` : "Copy failed — try again.");
      overlayRuntime.busy = false;
    });
  }

  function handleOverlayAction(event) {
    const button = event.target?.closest?.("[data-action]");
    if (!button || !overlayRuntime.root?.contains(button)) return;

    const action = button.getAttribute("data-action");
    if (!action) return;

    if (action === "close") {
      event.preventDefault();
      event.stopPropagation();
      hideDiagnosticsOverlay();
      return;
    }

    if (overlayRuntime.busy) return;

    if (action === "copy-global-json") {
      event.preventDefault();
      void runCopyAction("Global JSON", () =>
        buildCompactJson({
          openedAt: overlayRuntime.openedAt,
          buttonsCount: overlayRuntime.buttonsCount,
          actionsBound: overlayRuntime.actionsBound,
          lastAction: "copy-global-json",
          freezeSafeMode: true,
        }),
      );
      return;
    }

    if (action === "copy-home-json") {
      event.preventDefault();
      void runCopyAction("Home JSON", () => {
        if (typeof overlayRuntime.getHomeJson === "function") {
          return overlayRuntime.getHomeJson();
        }
        if (typeof window.KLEVGO_HOME_BOX_MEASURE === "function") {
          return JSON.stringify(window.KLEVGO_HOME_BOX_MEASURE(), null, 2);
        }
        return buildUnavailableJson("Home diagnostics unavailable");
      });
      return;
    }

    if (action === "clear-diagnostics") {
      event.preventDefault();
      overlayRuntime.lastAction = action;
      try {
        window.KlevbyBootStore?.clearDiagnostics?.();
        setOverlayStatus("Cleared", true);
        setOverlayPreview("Boot diagnostics cleared.");
      } catch (error) {
        overlayRuntime.lastError = shortError(error);
        setOverlayStatus("Clear failed", false);
      }
      return;
    }

    if (action === "clear-last-known-cache") {
      event.preventDefault();
      overlayRuntime.lastAction = action;
      try {
        window.KlevbyLastKnownCache?.clearAllLastKnown?.();
        setOverlayStatus("Cache cleared", true);
      } catch (error) {
        overlayRuntime.lastError = shortError(error);
        setOverlayStatus("Cache clear failed", false);
      }
      return;
    }

    if (action === "clear-map-cache") {
      event.preventDefault();
      overlayRuntime.lastAction = action;
      try {
        window.KlevbyLastKnownMap?.clearMapCache?.();
        setOverlayStatus("Map cache cleared", true);
      } catch (error) {
        overlayRuntime.lastError = shortError(error);
        setOverlayStatus("Map cache clear failed", false);
      }
      return;
    }

    if (action === "refresh") {
      event.preventDefault();
      overlayRuntime.lastAction = action;
      setOverlayStatus("Ready", true);
      setOverlayPreview("Ready — tap Copy global JSON or Copy Home JSON.");
    }
  }

  function bindOverlayActions(overlay) {
    if (overlayRuntime.actionsBound && overlay.dataset.diagnosticsActionsBound === "true") return;
    overlay.dataset.diagnosticsActionsBound = "true";
    overlayRuntime.actionsBound = true;

    const onAction = (event) => {
      handleOverlayAction(event);
    };

    overlay.addEventListener("click", onAction, true);
    overlay.addEventListener("pointerup", onAction, true);
    overlay.addEventListener(
      "touchend",
      (event) => {
        if (event.target?.closest?.('[data-action="close"]')) {
          event.preventDefault();
        }
        onAction(event);
      },
      { capture: true, passive: false },
    );
  }

  function showDiagnosticsOverlay(options) {
    hideDiagnosticsOverlay();

    overlayRuntime.getHomeJson =
      options && typeof options.getHomeJson === "function" ? options.getHomeJson : null;
    overlayRuntime.openedAt = new Date().toISOString();
    overlayRuntime.lastAction = null;
    overlayRuntime.lastError = null;
    overlayRuntime.busy = false;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "KlevGo diagnostics");
    overlay.setAttribute("data-klevby-diagnostics-overlay", "true");
    overlay.style.cssText =
      "position:fixed;inset:calc(10px + env(safe-area-inset-top,0px)) 10px calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483647;background:rgba(6,8,10,.96);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;touch-action:manipulation;pointer-events:auto;box-shadow:0 18px 48px rgba(0,0,0,.45);";

    const buttonStyle =
      "min-height:40px;padding:8px 11px;border:0;border-radius:10px;font-weight:800;font-size:12px;touch-action:manipulation;cursor:pointer;";

    const optionalButtons = [];
    if (window.KlevbyLastKnownCache?.clearAllLastKnown) {
      optionalButtons.push(
        `<button type="button" data-action="clear-last-known-cache" style="${buttonStyle}background:#5A4A2E;color:#fff8ea;">Clear last-known cache</button>`,
      );
    }
    if (window.KlevbyLastKnownMap?.clearMapCache) {
      optionalButtons.push(
        `<button type="button" data-action="clear-map-cache" style="${buttonStyle}background:#5A4A2E;color:#fff8ea;">Clear map cache</button>`,
      );
    }

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 15px/1.2 system-ui,sans-serif;">
        <span>KlevGo diagnostics</span>
        <span data-diag-status style="min-width:72px;color:#b7f7cf;font:600 12px/1.2 system-ui,sans-serif;text-align:right;">Ready</span>
      </div>
      <div data-diag-preview style="padding:8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#d9f5e5;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-height:120px;overflow:auto;white-space:pre-wrap;">Ready — tap Copy global JSON or Copy Home JSON. No heavy preview on open.</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        <button type="button" data-action="copy-global-json" style="${buttonStyle}background:#ffffff;color:#111;">Copy global JSON</button>
        <button type="button" data-action="copy-home-json" style="${buttonStyle}background:#e8eef0;color:#111;">Copy Home JSON</button>
        <button type="button" data-action="clear-diagnostics" style="${buttonStyle}background:#5A4A2E;color:#fff8ea;">Clear diagnostics</button>
        ${optionalButtons.join("")}
        <button type="button" data-action="refresh" style="${buttonStyle}background:#356A48;color:#fff;">Refresh</button>
        <button type="button" data-action="close" style="${buttonStyle}background:#f47a2b;color:#111;">Close</button>
      </div>
    `;

    overlayRuntime.root = overlay;
    overlayRuntime.statusNode = overlay.querySelector("[data-diag-status]");
    overlayRuntime.previewNode = overlay.querySelector("[data-diag-preview]");
    overlayRuntime.buttonsCount = overlay.querySelectorAll("[data-action]").length;

    bindOverlayActions(overlay);
    document.body.appendChild(overlay);

    scheduleBackgroundPublish();
    return overlay;
  }

  let globalDiagnosticsApi = null;

  globalDiagnosticsApi = {
    version: AUDIT_VERSION,
    AUDIT_VERSION,
    lastSnapshot: null,
    isRuntimeReady,
    isAvailable: isRuntimeReady,
    getSnapshot(options) {
      const compact = !options || options.compact !== false;
      const snapshot = compact ? collectCompactSync() : collectSync();
      this.lastSnapshot = snapshot;
      return snapshot;
    },
    getJson(options) {
      return JSON.stringify(this.getSnapshot(options), null, 2);
    },
    collectSync,
    collectCompactSync,
    collectAsync,
    collectAndPublish,
    publish,
    getGlobalJsonString() {
      return buildCompactJson({
        openedAt: overlayRuntime.openedAt,
        buttonsCount: overlayRuntime.buttonsCount,
        actionsBound: overlayRuntime.actionsBound,
        lastAction: overlayRuntime.lastAction,
        freezeSafeMode: true,
      });
    },
    showOverlay: showDiagnosticsOverlay,
    hideOverlay: hideDiagnosticsOverlay,
  };

  window.__KLEVBY_GLOBAL_DIAGNOSTICS__ = globalDiagnosticsApi;
  window.KlevbyGlobalDiagnostics = globalDiagnosticsApi;
  window.KlevbyDiagnosticsOverlay = {
    show: showDiagnosticsOverlay,
    hide: hideDiagnosticsOverlay,
  };
  window.__KLEVBY_GLOBAL_DIAGNOSTICS_GET_JSON__ = () => globalDiagnosticsApi.getGlobalJsonString();

  window.addEventListener("klevby-app-shell-ready", scheduleBackgroundPublish);
  window.addEventListener("klevby-app-splash-hidden", scheduleBackgroundPublish);
  window.addEventListener("klevby-network-status", scheduleBackgroundPublish);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBackgroundPublish, { once: true });
  } else {
    scheduleBackgroundPublish();
  }
})();
