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
    window.__KLEVBY_GLOBAL_DIAGNOSTICS__ = snapshot;
    return snapshot;
  }

  function collectAndPublish() {
    return publish(collectSync());
  }

  const OVERLAY_ID = "klevgoHomeBoxDiagnosticsOverlay";

  function getGlobalSnapshotSafe() {
    try {
      return publish(collectSync());
    } catch (_) {
      return window.__KLEVBY_GLOBAL_DIAGNOSTICS__ || null;
    }
  }

  function isGlobalAvailable(snapshot) {
    const data = snapshot || getGlobalSnapshotSafe();
    return Boolean(data && data.auditVersion && data.boot && data.splash);
  }

  function getGlobalJsonString() {
    try {
      const snapshot = getGlobalSnapshotSafe();
      if (!isGlobalAvailable(snapshot)) {
        return JSON.stringify(
          {
            available: false,
            error: "Global diagnostics unavailable",
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        );
      }
      return JSON.stringify(snapshot, null, 2);
    } catch (error) {
      return JSON.stringify(
        {
          available: false,
          error: shortError(error) || "Global diagnostics unavailable",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    }
  }

  function formatGlobalSummary(snapshot) {
    if (!isGlobalAvailable(snapshot)) return "Global diagnostics unavailable";
    return [
      `screen: ${snapshot.currentScreen?.screenId || "?"} (${snapshot.currentScreen?.screenType || "?"})`,
      `net: ${snapshot.network?.detectedStatus || "?"} online=${snapshot.network?.navigatorOnLine}`,
      `splash: ${snapshot.splash?.hideReason || (snapshot.splash?.isActive ? "active" : "hidden")} ${snapshot.splash?.visibleDurationMs ?? "?"}ms`,
      `boot: ${snapshot.boot?.bootDurationMs ?? "?"}ms`,
      `auth: ${snapshot.auth?.authMode || "?"}`,
      `warnings: ${snapshot.warnings?.length || 0}`,
    ].join("\n");
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

  function showManualCopyFallback(text) {
    const existing = document.getElementById("klevbyGlobalDiagnosticsManualCopy");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "klevbyGlobalDiagnosticsManualCopy";
    wrap.style.cssText =
      "position:fixed;inset:12px;z-index:2147483647;background:rgba(8,12,10,.96);padding:12px;border-radius:12px;color:#fff;display:flex;flex-direction:column;gap:8px;";
    const label = document.createElement("div");
    label.textContent = "Clipboard unavailable. Select and copy JSON manually.";
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "flex:1;width:100%;font:12px/1.35 monospace;";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.style.cssText =
      "min-height:36px;padding:7px 11px;border:0;border-radius:10px;background:#356A48;color:#fff;font-weight:700;";
    close.addEventListener("click", () => wrap.remove());
    wrap.append(label, textarea, close);
    document.body.appendChild(wrap);
    textarea.focus();
    textarea.select();
  }

  function hideDiagnosticsOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function createOverlayButton(label, background) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `min-height:36px;padding:7px 10px;border:0;border-radius:10px;background:${background};color:#111;font-weight:800;font-size:12px;`;
    return button;
  }

  function setOverlayStatus(node, message, ok) {
    if (!node) return;
    node.textContent = message;
    node.style.color = ok ? "#b7f7cf" : "#ffb4a2";
  }

  function showDiagnosticsOverlay(options) {
    hideDiagnosticsOverlay();

    const getHomeJson =
      options && typeof options.getHomeJson === "function"
        ? options.getHomeJson
        : () =>
            JSON.stringify(
              { error: "Home diagnostics unavailable", timestamp: new Date().toISOString() },
              null,
              2,
            );

    let snapshot = null;
    let globalAvailable = false;
    try {
      snapshot = getGlobalSnapshotSafe();
      globalAvailable = isGlobalAvailable(snapshot);
    } catch (_) {
      globalAvailable = false;
    }

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "KlevGo diagnostics");
    overlay.style.cssText =
      "position:fixed;inset:calc(10px + env(safe-area-inset-top,0px)) 10px calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483647;background:rgba(6,8,10,.96);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 18px 48px rgba(0,0,0,.45);";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;flex-direction:column;gap:8px;font:700 15px/1.2 system-ui,sans-serif;";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
    const title = document.createElement("span");
    title.textContent = "KlevGo diagnostics";
    const status = document.createElement("span");
    status.style.cssText = "min-width:72px;color:#b7f7cf;font:600 12px/1.2 system-ui,sans-serif;text-align:right;";
    titleRow.append(title, status);
    header.appendChild(titleRow);

    const summary = document.createElement("div");
    summary.style.cssText =
      "padding:8px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#d9f5e5;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;";
    summary.textContent = formatGlobalSummary(snapshot);
    header.appendChild(summary);

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";

    const copyGlobalButton = createOverlayButton("Copy global JSON", "#ffffff");
    const copyHomeButton = createOverlayButton("Copy Home JSON", "#e8eef0");
    const clearButton = createOverlayButton("Clear diagnostics", "#5A4A2E");
    clearButton.style.color = "#fff8ea";
    const closeButton = createOverlayButton("Close", "#f47a2b");

    buttons.append(copyGlobalButton, copyHomeButton, clearButton, closeButton);
    header.appendChild(buttons);
    overlay.appendChild(header);

    const preview = document.createElement("pre");
    preview.style.cssText =
      "flex:1;min-height:0;width:100%;box-sizing:border-box;overflow:auto;white-space:pre-wrap;word-break:break-word;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.06);color:#fff;margin:0;padding:8px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;";
    preview.textContent = globalAvailable ? getGlobalJsonString() : getGlobalJsonString();
    overlay.appendChild(preview);

    copyGlobalButton.addEventListener("click", async () => {
      const json = getGlobalJsonString();
      const copied = await copyTextToClipboard(json);
      if (!copied) showManualCopyFallback(json);
      setOverlayStatus(status, copied ? "Global copied" : "Copy failed", copied);
    });

    copyHomeButton.addEventListener("click", async () => {
      let json = "";
      try {
        json = getHomeJson();
      } catch (error) {
        json = JSON.stringify(
          { error: shortError(error) || "Home diagnostics failed", timestamp: new Date().toISOString() },
          null,
          2,
        );
      }
      const copied = await copyTextToClipboard(json);
      if (!copied) showManualCopyFallback(json);
      setOverlayStatus(status, copied ? "Home copied" : "Copy failed", copied);
    });

    clearButton.addEventListener("click", () => {
      try {
        window.KlevbyBootStore?.clearDiagnostics?.();
      } catch (_) {}
      setOverlayStatus(status, "Cleared", true);
      try {
        snapshot = getGlobalSnapshotSafe();
        globalAvailable = isGlobalAvailable(snapshot);
        summary.textContent = formatGlobalSummary(snapshot);
        preview.textContent = getGlobalJsonString();
      } catch (_) {
        summary.textContent = "Global diagnostics unavailable";
      }
    });

    closeButton.addEventListener("click", hideDiagnosticsOverlay);

    document.body.appendChild(overlay);
    return snapshot;
  }

  window.KlevbyGlobalDiagnostics = {
    AUDIT_VERSION,
    collectSync,
    collectAsync,
    collectAndPublish,
    getSnapshot: collectSync,
    publish,
    isAvailable: isGlobalAvailable,
    getGlobalJsonString,
    showOverlay: showDiagnosticsOverlay,
    hideOverlay: hideDiagnosticsOverlay,
  };

  window.KlevbyDiagnosticsOverlay = {
    show: showDiagnosticsOverlay,
    hide: hideDiagnosticsOverlay,
  };

  window.__KLEVBY_GLOBAL_DIAGNOSTICS_GET_JSON__ = getGlobalJsonString;

  window.addEventListener("klevby-app-shell-ready", collectAndPublish);
  window.addEventListener("klevby-app-splash-hidden", collectAndPublish);
  window.addEventListener("klevby-network-status", collectAndPublish);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", collectAndPublish, { once: true });
  } else {
    collectAndPublish();
  }
})();
