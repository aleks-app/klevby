(function () {
  "use strict";

  const STORAGE_KEY = "klevbyAndroidDiagnosticsEnabled";
  const PWA_STORAGE_KEY = "klevbyPwaHomeDiagnosticsEnabled";
  const LAYOUT_STORAGE_KEY = "klevbyLayoutDiagnostics";
  const BUTTON_CONTAINER_ID = "klevbyAndroidDiagnosticsControls";
  const LOGO_TAP_TARGET = 7;
  const LOGO_TAP_RESET_MS = 4000;
  const HOME_SKELETON_STORAGE_KEY = "klevgo:home-skeleton";
  const HOME_SKELETON_ATTRIBUTE = "data-home-skeleton";
  const SKELETON_STATUS_ID = "klevbyDiagnosticsSkeletonStatus";

  const params = new URLSearchParams(window.location.search);
  const hasAndroidDebugFlag = params.get("klevbyAndroidDebug") === "1";
  const hasViewportDebugFlag = params.get("klevbyViewportDebug") === "1";
  const hasExplicitDebugFlag = hasAndroidDebugFlag || hasViewportDebugFlag;

  let logoTapCount = 0;
  let logoTapResetTimer = 0;
  let logoActivationBound = false;

  function readStorageKeyEnabled(storageKey) {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch (_) {
      return false;
    }
  }

  function setStorageEnabled(enabled) {
    try {
      const storageKey = isStandaloneMode() ? PWA_STORAGE_KEY : STORAGE_KEY;
      if (enabled) {
        window.localStorage.setItem(storageKey, "1");
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(PWA_STORAGE_KEY);
        window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
      }
    } catch (_) {}
  }

  function isStandaloneMode() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches
    );
  }

  function isIphone() {
    return /iPhone/i.test(navigator.userAgent);
  }

  function isDiagnosticsEnabled() {
    return (
      hasExplicitDebugFlag ||
      readStorageKeyEnabled(STORAGE_KEY) ||
      readStorageKeyEnabled(LAYOUT_STORAGE_KEY) ||
      (isStandaloneMode() && readStorageKeyEnabled(PWA_STORAGE_KEY))
    );
  }

  function getCapacitorNativeState() {
    const capacitor = window.Capacitor;
    if (!capacitor || typeof capacitor.isNativePlatform !== "function") {
      return { capacitor, isNativePlatform: false };
    }

    try {
      return {
        capacitor,
        isNativePlatform: capacitor.isNativePlatform() === true
      };
    } catch (_) {
      return { capacitor, isNativePlatform: false };
    }
  }

  function isHomeActive() {
    const homeSection = document.getElementById("homeSection");
    const body = document.body;

    if (!homeSection || !body) return false;
    if (homeSection.classList.contains("hidden")) return false;
    return body.getAttribute("data-app-chrome-mode") === "home";
  }

  function getDiagnosticsJson() {
    return JSON.stringify(window.klevbyAndroidDiagnostics.collect(), null, 2);
  }

  function getDiagnosticsName() {
    return isIphone() && isStandaloneMode()
      ? "KlevGo iPhone PWA Home Diagnostics"
      : "KlevGo Android Diagnostics";
  }

  function readHomeSkeletonStorageFlag() {
    try {
      return window.localStorage.getItem(HOME_SKELETON_STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function collectHomeDimmingLayersFromOwner(ownerFitContract) {
    const owner = window.KlevbyHomeScreenOwner;

    if (owner && typeof owner.collectHomeDimmingDiagnostics === "function") {
      return owner.collectHomeDimmingDiagnostics();
    }

    if (owner && typeof owner.getHomeDimmingDiagnostics === "function") {
      return owner.getHomeDimmingDiagnostics();
    }

    return Array.isArray(ownerFitContract?.homeDimmingLayers)
      ? ownerFitContract.homeDimmingLayers
      : [];
  }

  function collectSkeletonDiagnostics(ownerFitContract) {
    const owner = window.KlevbyHomeScreenOwner;
    const body = document.body;
    const homeSection = document.getElementById("homeSection");
    const fitContract =
      ownerFitContract || (owner && typeof owner.getHomeFitContract === "function"
        ? owner.getHomeFitContract()
        : null);

    return {
      skeletonApiLoaded: typeof owner?.enableHomeSkeletonMode === "function",
      skeletonStorageFlag: readHomeSkeletonStorageFlag(),
      bodyHomeSkeletonAttr: body?.getAttribute(HOME_SKELETON_ATTRIBUTE) ?? null,
      homeSectionSkeletonAttr: homeSection?.getAttribute(HOME_SKELETON_ATTRIBUTE) ?? null,
      skeletonModeFromContract: fitContract?.skeletonMode ?? null,
      hasSkeletonDevTapZone: document.getElementById("homeSkeletonDevTapZone") != null,
      hasSkeletonDiagnosticsOverlay:
        document.getElementById("homeSkeletonDiagnosticsOverlay") != null
    };
  }

  function setSkeletonStatusMessage(message) {
    const status = document.getElementById(SKELETON_STATUS_ID);
    if (!status) return;

    status.textContent = message || "";
    status.style.display = message ? "block" : "none";
  }

  function refreshSkeletonDiagnostics() {
    window.KlevbyHomeScreenOwner?.updateHomeFitContract?.();
    window.KlevbyHomeScreenOwner?.refreshHomeSkeletonDiagnosticsOverlay?.();
  }

  function enableSkeletonFromDiagnostics() {
    const owner = window.KlevbyHomeScreenOwner;
    if (typeof owner?.enableHomeSkeletonMode !== "function") {
      setSkeletonStatusMessage("Skeleton API not loaded");
      return false;
    }

    owner.enableHomeSkeletonMode();
    refreshSkeletonDiagnostics();
    setSkeletonStatusMessage("Skeleton enabled");
    return true;
  }

  function disableSkeletonFromDiagnostics() {
    window.KlevbyHomeScreenOwner?.disableHomeSkeletonMode?.();
    refreshSkeletonDiagnostics();
    setSkeletonStatusMessage("Skeleton disabled");
  }

  function getDiagnosticsFilename() {
    return isIphone() && isStandaloneMode()
      ? "klevby-iphone-pwa-home-diagnostics.json"
      : "klevby-android-diagnostics.json";
  }

  function getLayoutRect(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      height: rect.height,
      y: rect.y,
      width: rect.width
    };
  }

  function findAppHeader() {
    return (
      document.querySelector("header[data-chrome-mode]") ||
      document.querySelector("body header") ||
      document.querySelector("header") ||
      document.querySelector(".app-header")
    );
  }


  function getHomeHeroCopyComputedDiagnostics(heroCopy, homeSection = document.querySelector("#homeSection")) {
    if (!heroCopy) return null;

    const heroCopyStyle = getComputedStyle(heroCopy);
    const root = document.documentElement;
    return {
      heroCopyClassName: heroCopy.className || null,
      heroCopyTransform: heroCopyStyle.transform || null,
      heroCopyTranslate: heroCopyStyle.translate || null,
      heroCopyPosition: heroCopyStyle.position || null,
      heroCopyPaddingTop: heroCopyStyle.paddingTop || null,
      heroCopyPaddingBottom: heroCopyStyle.paddingBottom || null,
      heroCopyMarginTop: heroCopyStyle.marginTop || null,
      heroCopyMarginBottom: heroCopyStyle.marginBottom || null,
      heroCopyDisplay: heroCopyStyle.display || null,
      heroCopyJustifyContent: heroCopyStyle.justifyContent || null,
      heroCopyMinHeight: heroCopyStyle.minHeight || null,
      heroCopyHeight: heroCopyStyle.height || null,
      homeSectionClassName: homeSection?.className || null,
      homeSectionLayout: homeSection?.getAttribute("data-home-layout") ?? null,
      rootHomeGridContract: root?.getAttribute("data-home-grid-contract") ?? null,
      rootHomeDensity: root?.getAttribute("data-home-density") ?? null
    };
  }

  function getCssDeliveryDiagnostics() {
    const targetNames = ["main.css", "home-mobile.css", "home-grid-foundation.css"];
    const stylesheetHrefs = Array.from(document.styleSheets || [])
      .map((sheet) => sheet?.href || null)
      .filter((href) => href && targetNames.some((name) => href.includes(name)));

    return {
      stylesheetHrefs,
      serviceWorkerControllerScriptURL: navigator.serviceWorker?.controller?.scriptURL ?? null
    };
  }

  function getVerticalGap(upperRect, lowerRect) {
    if (!upperRect || !lowerRect) return null;
    return lowerRect.top - upperRect.bottom;
  }

  function collectHomeInternalGeometry() {
    const html = document.documentElement;
    const body = document.body;
    const htmlStyles = getComputedStyle(html);
    const headerRect = getLayoutRect(findAppHeader());
    const touchBarRect = getLayoutRect(document.querySelector(".mobile-tabbar"));
    const heroCopy = document.querySelector("#homeSection .hero-copy");
    const homeSection = document.querySelector("#homeSection");
    const heroCopyRect = getLayoutRect(heroCopy);
    const quickActionsWrapperRect = getLayoutRect(
      document.querySelector("#homeSection .home-quick-actions")
    );
    const quickActionsRailRect = getLayoutRect(
      document.querySelector("#homeSection .home-quick-actions-grid")
    );
    const feedTitleRowRect = getLayoutRect(
      document.querySelector("#homeSection .home-feed-preview-head")
    );
    const feedAdCardRect = getLayoutRect(
      document.querySelector("#homeSection .home-feed-preview-slide.is-active") ||
        document.querySelector(
          "#homeSection .home-feed-preview-slide, #homeSection .home-feed-preview-card"
        )
    );
    const weatherCardRect = getLayoutRect(
      document.querySelector("#homeSection .home-weather-card")
    );
    const cssTokenNames = [
      "--klevby-app-available-top",
      "--klevby-app-available-bottom",
      "--klevby-app-available-height",
      "--klevby-app-available-bottom-offset",
      "--klevby-home-lower-fill-y"
    ];

    return {
      viewportAppShell: {
        window: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        },
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height
            }
          : null,
        headerBottom: headerRect?.bottom ?? null,
        touchBarTop: touchBarRect?.top ?? null,
        availableHeight:
          headerRect && touchBarRect ? touchBarRect.top - headerRect.bottom : null,
        homeDensity: {
          html: html.getAttribute("data-home-density"),
          body: body?.getAttribute("data-home-density") ?? null
        },
        cssTokens: Object.fromEntries(
          cssTokenNames.map((name) => [name, htmlStyles.getPropertyValue(name).trim()])
        )
      },
      rects: {
        homeSection: getLayoutRect(homeSection),
        heroCopy: heroCopyRect,
        quickActionsWrapper: quickActionsWrapperRect,
        quickActionsRail: quickActionsRailRect,
        quickActionCards: Array.from(
          document.querySelectorAll("#homeSection .home-quick-action-card"),
          getLayoutRect
        ),
        feedTitleRow: feedTitleRowRect,
        feedAdCard: feedAdCardRect,
        weatherCard: weatherCardRect,
        touchBar: touchBarRect
      },
      heroCopyComputed: getHomeHeroCopyComputedDiagnostics(heroCopy, homeSection),
      cssDelivery: getCssDeliveryDiagnostics(),
      verticalGaps: {
        heroCopyToQuickActions: getVerticalGap(heroCopyRect, quickActionsWrapperRect),
        quickActionsToFeedTitle: getVerticalGap(
          quickActionsWrapperRect,
          feedTitleRowRect
        ),
        feedTitleToFeedAdCard: getVerticalGap(feedTitleRowRect, feedAdCardRect),
        feedAdCardToWeather: getVerticalGap(feedAdCardRect, weatherCardRect),
        weatherToTouchBar: getVerticalGap(weatherCardRect, touchBarRect)
      },
      horizontalRails: {
        touchBar: touchBarRect,
        quickActionsRail: quickActionsRailRect,
        feedAdCard: feedAdCardRect,
        weatherCard: weatherCardRect
      }
    };
  }

  function getElementAttributes(element) {
    if (!element) return null;

    return Object.fromEntries(
      Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value])
    );
  }

  function getSafeAreaDiagnostics(htmlStyles) {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = [
      "position:fixed",
      "visibility:hidden",
      "pointer-events:none",
      "padding-top:env(safe-area-inset-top, 0px)",
      "padding-right:env(safe-area-inset-right, 0px)",
      "padding-bottom:env(safe-area-inset-bottom, 0px)",
      "padding-left:env(safe-area-inset-left, 0px)"
    ].join(";");
    document.body?.appendChild(probe);

    const probeStyles = probe.isConnected ? getComputedStyle(probe) : null;
    const diagnostics = {
      cssVariables: {
        "--klevby-bottom-safe-area": htmlStyles
          .getPropertyValue("--klevby-bottom-safe-area")
          .trim()
      },
      resolvedEnvironmentInsets: probeStyles
        ? {
            top: probeStyles.paddingTop,
            right: probeStyles.paddingRight,
            bottom: probeStyles.paddingBottom,
            left: probeStyles.paddingLeft
          }
        : null
    };

    probe.remove();
    return diagnostics;
  }

  function getSelectedComputedStyles(element, properties) {
    if (!element) return null;

    const styles = getComputedStyle(element);
    return properties.reduce((selectedStyles, property) => {
      selectedStyles[property] = styles[property];
      return selectedStyles;
    }, {});
  }

  function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(textarea);
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


  function rectsOverlap(a, b) {
    if (!a || !b) return null;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function isElementVisible(element, styles) {
    if (!element || !styles) return false;
    const rect = element.getBoundingClientRect();
    return styles.display !== "none" && styles.visibility !== "hidden" && Number(styles.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function getDetailedElementDiagnostics(selector, element) {
    const target = element || document.querySelector(selector);
    if (!target) return { selector, exists: false, visible: false };

    const styles = getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    const rectPayload = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y
    };

    return {
      selector,
      exists: true,
      visible: isElementVisible(target, styles),
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      rect: rectPayload,
      computed: {
        position: styles.position,
        zIndex: styles.zIndex,
        top: styles.top,
        right: styles.right,
        bottom: styles.bottom,
        left: styles.left,
        width: styles.width,
        height: styles.height,
        margin: styles.margin,
        padding: styles.padding,
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        transform: styles.transform,
        overflow: styles.overflow,
        overflowX: styles.overflowX,
        overflowY: styles.overflowY,
        pointerEvents: styles.pointerEvents,
        backgroundImage: styles.backgroundImage && styles.backgroundImage !== "none" ? styles.backgroundImage : null,
        boxShadow: styles.boxShadow && styles.boxShadow !== "none" ? styles.boxShadow : null
      }
    };
  }

  function collectSelectorMap(selectors) {
    return Object.fromEntries(
      selectors.map((entry) => {
        const name = Array.isArray(entry) ? entry[0] : entry;
        const selector = Array.isArray(entry) ? entry[1] : entry;
        return [name, getDetailedElementDiagnostics(selector)];
      })
    );
  }

  function getRectFromMap(map, key) {
    return map?.[key]?.exists ? map[key].rect : null;
  }

  function getCssVariables(names) {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, styles.getPropertyValue(name).trim() || null]));
  }

  function collectRootAttributes() {
    const html = document.documentElement;
    const body = document.body;
    const pick = (element) => ({
      class: element?.getAttribute("class") || "",
      style: element?.getAttribute("style") || "",
      "data-app-chrome-mode": element?.getAttribute("data-app-chrome-mode") || null,
      "data-device-class": element?.getAttribute("data-device-class") || null,
      "data-phone-orientation": element?.getAttribute("data-phone-orientation") || null,
      "data-home-density": element?.getAttribute("data-home-density") || null
    });
    return { html: pick(html), body: pick(body) };
  }

  function collectLayoutMatrix() {
    const sizes = [[360,760],[360,800],[375,812],[390,844],[393,852],[402,874],[412,915],[430,932],[440,956]];
    return {
      mode: "calculation-only-not-domrect",
      source: "CSS variables are read from current runtime; viewport rows are reference sizes only.",
      rows: sizes.map(([width, height]) => ({ width, height, aspect: Number((height / width).toFixed(4)) }))
    };
  }

  function collectUnifiedLayoutDiagnostics() {
    const html = document.documentElement;
    const body = document.body;
    const capacitorState = getCapacitorNativeState();
    const cssVariables = getCssVariables([
      "--klevby-app-viewport-width", "--klevby-app-viewport-height", "--klevby-app-available-top",
      "--klevby-app-available-bottom", "--klevby-app-available-height", "--klevby-app-available-bottom-offset",
      "--klevby-bottom-safe-area", "--kg-viewport-width", "--kg-viewport-height", "--kg-shell-top",
      "--kg-shell-bottom", "--kg-shell-height", "--kg-header-top", "--kg-header-bottom",
      "--kg-header-height-measured", "--kg-touchbar-top", "--kg-touchbar-bottom",
      "--kg-touchbar-height-measured", "--klevby-trips-create-step1-copy-top"
    ]);
    const home = collectSelectorMap([
      ["homeSection", "#homeSection"], ["header", "#header, header"], ["logoTitleArea", ".app-header-logo, .logo.app-header-logo, .header-inner"],
      ["hero", "#homeSection .hero"], ["heroCopy", "#homeSection .hero-copy"], ["heroTitle", "#homeSection .hero-title, #homeSection .hero h1, #homeSection .hero-copy h1"],
      ["heroSlogan", "#homeSection .hero-slogan, #homeSection .hero-copy p"], ["quickActions", "#homeSection .home-quick-actions"], ["quickActionsGrid", "#homeSection .home-quick-actions-grid"],
      ["quickActionCard", "#homeSection .home-quick-action-card"], ["feedTitleRow", "#homeSection .home-feed-preview-head"], ["feedAdCard", "#homeSection .home-feed-preview-slide.is-active, #homeSection .home-feed-preview-card"],
      ["weatherCard", "#homeSection .home-weather-card"], ["touchBar", ".mobile-tabbar"]
    ]);
    const trips = collectSelectorMap([
      ["tripsSection", "#tripsSection"], ["backButton", "#appHeaderBackBtn, .app-header-back-btn"], ["shell", "#tripsSection .trips-fullscreen-shell"],
      ["container", "#tripsSection .trips-fullscreen-content"], ["hero", "#tripsSection .trips-fullscreen-hero"], ["title", "#tripsSection .trips-fullscreen-hero-title"],
      ["subtitle", "#tripsSection .trips-fullscreen-hero-description"], ["cta", "#tripsSection .trips-fullscreen-hero-cta"], ["upperTabs", "#tripsSection .trips-fullscreen-type-tabs"],
      ["lowerFilters", "#tripsSection .trips-fullscreen-filter-row"], ["listTitleRow", "#tripsSection .trips-fullscreen-list-header"]
    ]);
    const create = collectSelectorMap([
      ["flow", ".trips-create-flow"], ["progress", ".trips-create-flow__step-one-progress"], ["progressLabel", ".trips-create-flow__step-one-progress-label"],
      ["copy", ".trips-create-flow__copy"], ["copyTitle", ".trips-create-flow__copy-title"], ["copySubtitle", ".trips-create-flow__copy-subtitle"],
      ["placeOptions", ".trips-create-flow__place-options"], ["firstCard", ".trips-create-flow__place-card:nth-of-type(1)"], ["secondCard", ".trips-create-flow__place-card:nth-of-type(2)"],
      ["next", ".trips-create-flow__step-one-next"], ["nextCircle", ".trips-create-flow__step-one-next-circle"], ["nextLabel", ".trips-create-flow__step-one-next-label"],
      ["backButton", "#appHeaderBackBtn, .app-header-back-btn"]
    ]);
    const h = (key) => getRectFromMap(home, key);
    const t = (key) => getRectFromMap(trips, key);
    const c = (key) => getRectFromMap(create, key);
    const payload = {
      timestamp: new Date().toISOString(),
      locationHref: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform || null,
      capacitorPlatform: capacitorState.isNativePlatform && typeof capacitorState.capacitor.getPlatform === "function" ? capacitorState.capacitor.getPlatform() : "browser",
      isNativePlatform: capacitorState.isNativePlatform,
      standalone: isStandaloneMode(),
      pwa: { navigatorStandalone: window.navigator.standalone === true, displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches },
      devicePixelRatio: window.devicePixelRatio,
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, outerWidth: window.outerWidth, outerHeight: window.outerHeight },
      visualViewport: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop, offsetLeft: window.visualViewport.offsetLeft, scale: window.visualViewport.scale } : null,
      documentElement: { clientWidth: html.clientWidth, clientHeight: html.clientHeight, scrollWidth: html.scrollWidth, scrollHeight: html.scrollHeight },
      body: body ? { clientWidth: body.clientWidth, clientHeight: body.clientHeight, scrollWidth: body.scrollWidth, scrollHeight: body.scrollHeight } : null,
      rootAttributes: collectRootAttributes(),
      cssVariables,
      home: { active: !document.querySelector("#homeSection")?.classList.contains("hidden"), selectors: home, derived: {
        headerLogoBottomToHeroCopyTop: getVerticalGap(h("logoTitleArea") || h("header"), h("heroCopy") || h("heroTitle")),
        heroTitleOverlapsHeaderLogo: rectsOverlap(h("heroTitle") || h("heroCopy"), h("logoTitleArea") || h("header")),
        heroCopyBottomToQuickActionsTop: getVerticalGap(h("heroCopy"), h("quickActions")),
        quickActionsBottomToFeedTitleTop: getVerticalGap(h("quickActions"), h("feedTitleRow")),
        feedAdBottomToWeatherTop: getVerticalGap(h("feedAdCard"), h("weatherCard")),
        weatherBottomToTouchBarTop: getVerticalGap(h("weatherCard"), h("touchBar")),
        anyOverlapFlags: { heroHeader: rectsOverlap(h("heroCopy") || h("heroTitle"), h("header")), weatherTouchBar: rectsOverlap(h("weatherCard"), h("touchBar")) }
      }},
      tripsList: { active: !document.querySelector("#tripsSection")?.classList.contains("hidden") && !document.querySelector(".trips-create-flow[data-trips-create-flow='open']"), selectors: trips, derived: {
        viewportTopToBackButtonTop: t("backButton") ? t("backButton").top : null,
        backButtonOverlapsTitle: rectsOverlap(t("backButton"), t("title")), titleTop: t("title")?.top ?? null, titleBottom: t("title")?.bottom ?? null,
        titleBottomToSubtitleTop: getVerticalGap(t("title"), t("subtitle")), ctaBottomToTabsTop: getVerticalGap(t("cta"), t("upperTabs")),
        lowerFiltersBottomToListTitleTop: getVerticalGap(t("lowerFilters"), t("listTitleRow")),
        horizontalOverflow: { upperTabs: t("upperTabs") ? t("upperTabs").right > html.clientWidth || t("upperTabs").left < 0 : null, lowerFilters: t("lowerFilters") ? t("lowerFilters").right > html.clientWidth || t("lowerFilters").left < 0 : null },
        topClipping: { backButton: t("backButton") ? t("backButton").top < 0 : null, title: t("title") ? t("title").top < 0 : null }
      }},
      tripsCreateStep1: { active: document.querySelector(".trips-create-flow[data-trips-create-flow='open'][data-trips-create-step='1']") != null, selectors: create, derived: {
        progressBottomToCopyTitleTop: getVerticalGap(c("progress"), c("copyTitle")), titleBottomToSubtitleTop: getVerticalGap(c("copyTitle"), c("copySubtitle")),
        subtitleBottomToFirstCardTop: getVerticalGap(c("copySubtitle"), c("firstCard")), firstCardBottomToSecondCardTop: getVerticalGap(c("firstCard"), c("secondCard")),
        secondCardBottomToNextCircleTop: getVerticalGap(c("secondCard"), c("nextCircle")), secondCardBottomToNextVisualGlowTopApprox: getVerticalGap(c("secondCard"), c("nextCircle")) != null ? getVerticalGap(c("secondCard"), c("nextCircle")) - 18 : null,
        nextLabelBottomToViewportBottom: c("nextLabel") ? window.innerHeight - c("nextLabel").bottom : null, nextLabelBottomToDocumentClientHeight: c("nextLabel") ? html.clientHeight - c("nextLabel").bottom : null,
        nextLabelClippedByViewportNavArea: c("nextLabel") ? c("nextLabel").bottom > Math.min(window.innerHeight, html.clientHeight) : null,
        subtitleOverlapsFirstCard: rectsOverlap(c("copySubtitle"), c("firstCard")), secondCardOverlapsNextCircle: rectsOverlap(c("secondCard"), c("nextCircle")),
        secondCardIntersectsNextGlowZone: c("secondCard") && c("nextCircle") ? c("secondCard").bottom > c("nextCircle").top - 18 : null,
        backOverlapsProgressOrTitle: rectsOverlap(c("backButton"), c("progress")) || rectsOverlap(c("backButton"), c("copyTitle"))
      }},
      matrix: collectLayoutMatrix()
    };
    window.__KLEVBY_LAYOUT_DIAGNOSTICS__ = payload;
    return payload;
  }

  function showManualCopyDialog(text) {
    const existing = document.getElementById("klevbyLayoutDiagnosticsManualCopy");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "klevbyLayoutDiagnosticsManualCopy";
    wrap.style.cssText = "position:fixed;inset:12px;z-index:2147483647;background:rgba(8,12,10,.96);padding:12px;border-radius:12px;color:#fff;display:flex;flex-direction:column;gap:8px;";
    const label = document.createElement("div");
    label.textContent = "Clipboard unavailable. Select and copy JSON manually.";
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "flex:1;width:100%;font:12px/1.35 monospace;";
    const close = createDiagnosticsButton("Close", () => wrap.remove(), { background: "#356A48" });
    wrap.append(label, textarea, close);
    document.body.appendChild(wrap);
    textarea.focus();
    textarea.select();
  }

  function initDiagnosticsModule() {
    const { capacitor, isNativePlatform } = getCapacitorNativeState();

    if (!window.klevbyAndroidDiagnostics) {
      window.klevbyAndroidDiagnostics = {};
    }

    const diag = window.klevbyAndroidDiagnostics;

    diag.collectHomeInternalGeometry = collectHomeInternalGeometry;

    diag.collect = function () {
      const home = document.querySelector("#homeSection");
      const header = findAppHeader();
      const headerInner =
        header?.querySelector(".header-inner") || document.querySelector(".header-inner");
      const touchBar = document.querySelector(".mobile-tabbar");
      const body = document.body;
      const html = document.documentElement;
      const bodyStyles = body ? getComputedStyle(body) : null;
      const htmlStyles = getComputedStyle(html);
      const touchBarStyles = touchBar ? getComputedStyle(touchBar) : null;
      const appShellViewport =
        window.KlevbyAppShellViewportOwner?.getLastMeasurement?.() || null;
      const activeFeedCard =
        document.querySelector("#homeSection .home-feed-preview-slide.is-active") ||
        document.querySelector(
          "#homeSection .home-feed-preview-slide, #homeSection .home-feed-preview-card"
        );
      const homeElements = {
        header,
        headerInner,
        homeSection: home,
        hero: document.querySelector("#homeSection .hero"),
        heroCopy: document.querySelector("#homeSection .hero-copy"),
        quickActions: document.querySelector("#homeSection .home-quick-actions"),
        quickActionsGrid: document.querySelector("#homeSection .home-quick-actions-grid"),
        feedPreview: document.querySelector("#homeSection .home-feed-preview"),
        activeFeedCard,
        feedHeader: document.querySelector("#homeSection .home-feed-preview-head"),
        feedCard: document.querySelector("#homeSection .home-feed-preview-card"),
        feedContent: document.querySelector("#homeSection .home-feed-preview-content"),
        feedImage: document.querySelector("#homeSection .home-feed-preview-image"),
        weatherCard: document.querySelector("#homeSection .home-weather-card"),
        weatherStrip: document.querySelector("#homeSection .home-weather-strip"),
        touchBar
      };
      const homeRects = Object.fromEntries(
        Object.entries(homeElements).map(([name, element]) => [name, getLayoutRect(element)])
      );
      homeRects.mobileTabbar = homeRects.touchBar;
      const safeArea = getSafeAreaDiagnostics(htmlStyles);
      const headerMeasured = homeRects.header != null;
      const touchBarMeasured = homeRects.touchBar != null;
      const fallbackTopUsed = !headerMeasured && homeRects.homeSection != null;
      const availableTop =
        homeRects.header?.bottom ?? homeRects.homeSection?.top ?? null;
      const availableBottom =
        homeRects.touchBar?.top != null ? homeRects.touchBar.top - 8 : null;
      const availableHeight =
        availableTop != null && availableBottom != null
          ? Math.max(0, availableBottom - availableTop)
          : 0;
      const contentBottoms = [
        homeRects.hero,
        homeRects.quickActions,
        homeRects.feedPreview,
        homeRects.activeFeedCard,
        homeRects.weatherCard
      ]
        .map((rect) => rect?.bottom)
        .filter(Number.isFinite);
      const homeContentBottom = contentBottoms.length ? Math.max(...contentBottoms) : null;
      const weatherBottom = homeRects.weatherCard?.bottom ?? null;
      const overflowPx =
        homeContentBottom != null && availableBottom != null
          ? Math.max(0, homeContentBottom - availableBottom)
          : null;
      const weatherOverflowPx =
        weatherBottom != null && availableBottom != null
          ? Math.max(0, weatherBottom - availableBottom)
          : null;
      const gapWeatherToTouchBar =
        weatherBottom != null && homeRects.touchBar?.top != null
          ? homeRects.touchBar.top - weatherBottom
          : null;
      const gapActiveFeedCardToWeather = getVerticalGap(
        homeRects.activeFeedCard,
        homeRects.weatherCard
      );
      const bottomRhythmDelta =
        gapActiveFeedCardToWeather != null && gapWeatherToTouchBar != null
          ? Math.abs(gapActiveFeedCardToWeather - gapWeatherToTouchBar)
          : null;
      const ownerFitContract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.() || null;
      const homeDimmingLayers = collectHomeDimmingLayersFromOwner(ownerFitContract);
      const skeletonDiagnostics = collectSkeletonDiagnostics(ownerFitContract);
      const homeAvailableTop = ownerFitContract?.availableTop ?? null;
      const homeAvailableBottom = ownerFitContract?.availableBottom ?? null;
      const homeAvailableHeight = ownerFitContract?.availableHeight ?? null;
      const homeUsesAppShellContract = ownerFitContract?.homeUsesAppShellContract === true;
      const homeAppShellDeltaTop =
        homeAvailableTop != null && appShellViewport?.availableTop != null
          ? homeAvailableTop - appShellViewport.availableTop
          : null;
      const homeAppShellDeltaBottom =
        homeAvailableBottom != null && appShellViewport?.availableBottom != null
          ? homeAvailableBottom - appShellViewport.availableBottom
          : null;
      const lowerFillY = Number.parseFloat(
        htmlStyles.getPropertyValue("--klevby-home-lower-fill-y")
      ) || 0;
      const unifiedLayoutDiagnostics = collectUnifiedLayoutDiagnostics();
      const homeFitContract = {
        clearancePx: 8,
        headerBottom: homeRects.header?.bottom ?? null,
        touchBarTop: homeRects.touchBar?.top ?? null,
        availableTop,
        availableBottom,
        availableHeight,
        headerMeasured,
        touchBarMeasured,
        fallbackTopUsed,
        homeContentBottom,
        weatherBottom,
        overflowPx,
        weatherOverflowPx,
        activeFeedCardMeasured: homeRects.activeFeedCard != null,
        gapActiveFeedCardToWeather,
        gapWeatherToTouchBar,
        bottomRhythmDelta,
        bottomRhythmPass: bottomRhythmDelta != null && bottomRhythmDelta <= 6,
        lowerFillY,
        lowerFillCap: ownerFitContract?.lowerFillCap ?? null,
        lowerFillReason: ownerFitContract?.lowerFillReason ?? "owner-unavailable",
        rhythmBefore: ownerFitContract?.rhythmBefore ?? null,
        rhythmAfter: ownerFitContract?.rhythmAfter ?? bottomRhythmDelta,
        solverApplied: ownerFitContract?.solverApplied === true,
        solverCapped: ownerFitContract?.solverCapped === true,
        fitPass: overflowPx != null && overflowPx <= 1 && availableHeight > 0,
        weatherFitPass:
          weatherOverflowPx != null &&
          gapWeatherToTouchBar != null &&
          weatherOverflowPx <= 1 &&
          gapWeatherToTouchBar >= 10 &&
          availableHeight > 0,
        heroTailAfterCopy: ownerFitContract?.heroTailAfterCopy ?? null,
        feedPreviewTop: ownerFitContract?.feedPreviewTop ?? homeRects.feedPreview?.top ?? null,
        feedPreviewHeight: ownerFitContract?.feedPreviewHeight ?? homeRects.feedPreview?.height ?? null,
        feedAdCardHeight: ownerFitContract?.feedAdCardHeight ?? homeRects.activeFeedCard?.height ?? null,
        feedAdCardClientHeight: ownerFitContract?.feedAdCardClientHeight ?? null,
        feedAdCardScrollHeight: ownerFitContract?.feedAdCardScrollHeight ?? null,
        feedAdCardOverflowY: ownerFitContract?.feedAdCardOverflowY ?? null,
        feedContentFits: ownerFitContract?.feedContentFits ?? null,
        feedVisualPass: ownerFitContract?.feedVisualPass ?? null,
        upperWhitespacePass: ownerFitContract?.upperWhitespacePass ?? null,
        homeVisualBudgetPass: ownerFitContract?.homeVisualBudgetPass ?? null,
        computedBudgetTokens: ownerFitContract?.computedBudgetTokens ?? null,
        homeDimmingLayers
      };

      return {
        bootDiagnostics: window.KlevbyBootStore?.getSnapshotSync
          ? window.KlevbyBootStore.getSnapshotSync()
          : null,
        unifiedLayoutDiagnostics,
        timestamp: new Date().toISOString(),
        homeInternalGeometry: collectHomeInternalGeometry(),
        cssDelivery: getCssDeliveryDiagnostics(),
        locationHref: window.location.href,
        documentReadyState: document.readyState,
        documentVisibilityState: document.visibilityState,
        capacitorPlatform:
          isNativePlatform && typeof capacitor.getPlatform === "function"
            ? capacitor.getPlatform()
            : "browser",
        isNativePlatform,
        standalone: isStandaloneMode(),
        pwa: {
          isStandalone: isStandaloneMode(),
          navigatorStandalone: window.navigator.standalone === true,
          displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
          isIphone: isIphone()
        },
        debugFlags: {
          klevbyAndroidDebug: hasAndroidDebugFlag,
          klevbyViewportDebug: hasViewportDebugFlag,
          klevbyAndroidDiagnosticsEnabled: readStorageKeyEnabled(STORAGE_KEY),
          klevbyPwaHomeDiagnosticsEnabled: readStorageKeyEnabled(PWA_STORAGE_KEY),
          klevbyLayoutDiagnostics: readStorageKeyEnabled(LAYOUT_STORAGE_KEY)
        },
        userAgent: navigator.userAgent,
        dpr: window.devicePixelRatio,
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetTop: window.visualViewport.offsetTop,
              offsetLeft: window.visualViewport.offsetLeft,
              scale: window.visualViewport.scale
            }
          : null,
        appShellViewportWidth: appShellViewport?.viewportWidth ?? null,
        appShellViewportHeight: appShellViewport?.viewportHeight ?? null,
        appShellAvailableTop: appShellViewport?.availableTop ?? null,
        appShellAvailableBottom: appShellViewport?.availableBottom ?? null,
        appShellAvailableHeight: appShellViewport?.availableHeight ?? null,
        appShellAvailableBottomOffset: appShellViewport?.availableBottomOffset ?? null,
        appShellChromeMode: appShellViewport?.chromeMode ?? null,
        appShellHeaderVisible: appShellViewport?.headerVisible ?? null,
        appShellTabbarVisible: appShellViewport?.tabbarVisible ?? null,
        homeAvailableTop,
        homeAvailableBottom,
        homeAvailableHeight,
        homeUsesAppShellContract,
        homeAppShellDeltaTop,
        homeAppShellDeltaBottom,
        homeDimmingLayers,
        homeSectionTopNegative:
          homeRects.homeSection?.top != null ? homeRects.homeSection.top < -1 : null,
        homeFitContract,
        ...skeletonDiagnostics,
        homeSkeleton: skeletonDiagnostics,
        homeSection: homeRects.homeSection,
        touchBar: homeRects.touchBar,
        homeLayout: {
          ...homeRects,
          gaps: {
            gapHeroToQuick: getVerticalGap(homeRects.hero, homeRects.quickActions),
            gapQuickToFeed: getVerticalGap(homeRects.quickActions, homeRects.feedPreview),
            gapFeedHeaderToCard: getVerticalGap(homeRects.feedHeader, homeRects.feedCard),
            gapFeedCardToWeather: getVerticalGap(homeRects.feedCard, homeRects.weatherCard),
            gapWeatherToTouchBar: getVerticalGap(homeRects.weatherCard, homeRects.touchBar),
            gapWeatherStripToTouchBar: getVerticalGap(homeRects.weatherStrip, homeRects.touchBar)
          },
          safeArea,
          variables: {
            "--klevby-app-height": htmlStyles.getPropertyValue("--klevby-app-height").trim(),
            "--klevby-home-available-top": htmlStyles
              .getPropertyValue("--klevby-home-available-top")
              .trim(),
            "--klevby-home-available-bottom": htmlStyles
              .getPropertyValue("--klevby-home-available-bottom")
              .trim(),
            "--klevby-home-available-height": htmlStyles
              .getPropertyValue("--klevby-home-available-height")
              .trim(),
            "--klevby-home-bottom-reserve": htmlStyles
              .getPropertyValue("--klevby-home-bottom-reserve")
              .trim(),
            "--klevby-bottom-chrome-total": htmlStyles
              .getPropertyValue("--klevby-bottom-chrome-total")
              .trim(),
            "--klevby-touchbar-height": htmlStyles
              .getPropertyValue("--klevby-touchbar-height")
              .trim(),
            "--klevby-touchbar-bottom-offset": htmlStyles
              .getPropertyValue("--klevby-touchbar-bottom-offset")
              .trim(),
            "--klevby-home-section-gap": htmlStyles
              .getPropertyValue("--klevby-home-section-gap")
              .trim(),
            "--klevby-home-hero-pad-top": htmlStyles
              .getPropertyValue("--klevby-home-hero-pad-top")
              .trim(),
            "--klevby-home-hero-copy-min-h": htmlStyles
              .getPropertyValue("--klevby-home-hero-copy-min-h")
              .trim(),
            "--klevby-home-quick-min-h": htmlStyles
              .getPropertyValue("--klevby-home-quick-min-h")
              .trim(),
            "--klevby-home-hero-row-max-h": htmlStyles
              .getPropertyValue("--klevby-home-hero-row-max-h")
              .trim(),
            "--klevby-home-feed-card-visual-min-h": htmlStyles
              .getPropertyValue("--klevby-home-feed-card-visual-min-h")
              .trim(),
            "--klevby-home-feed-row-min-h": htmlStyles
              .getPropertyValue("--klevby-home-feed-row-min-h")
              .trim(),
            "--klevby-home-feed-image-min-h": htmlStyles
              .getPropertyValue("--klevby-home-feed-image-min-h")
              .trim(),
            "--klevby-home-weather-strip-min-h": htmlStyles
              .getPropertyValue("--klevby-home-weather-strip-min-h")
              .trim(),
            "--klevby-home-weather-nudge-y": htmlStyles
              .getPropertyValue("--klevby-home-weather-nudge-y")
              .trim()
          },
          computedStyles: {
            heroCopyMeasured: getHomeHeroCopyComputedDiagnostics(homeElements.heroCopy, homeElements.homeSection),
            hero: getSelectedComputedStyles(homeElements.hero, [
              "minHeight",
              "paddingTop",
              "paddingBottom"
            ]),
            quickActions: getSelectedComputedStyles(homeElements.quickActions, [
              "marginTop",
              "marginBottom"
            ]),
            feedPreview: getSelectedComputedStyles(homeElements.feedPreview, [
              "marginTop",
              "marginBottom"
            ]),
            feedCard: getSelectedComputedStyles(homeElements.feedCard, [
              "paddingTop",
              "paddingBottom",
              "gap"
            ]),
            weatherCard: getSelectedComputedStyles(homeElements.weatherCard, [
              "marginTop",
              "marginBottom",
              "paddingTop",
              "paddingBottom",
              "transform"
            ]),
            mobileTabbar: getSelectedComputedStyles(homeElements.touchBar, ["bottom", "height"])
          }
        },
        body: body ? body.getBoundingClientRect() : null,
        html: html.getBoundingClientRect(),
        attributes: {
          root: getElementAttributes(html),
          body: getElementAttributes(body)
        },
        scroll: {
          bodyScrollTop: body ? body.scrollTop : null,
          bodyScrollHeight: body ? body.scrollHeight : null,
          bodyClientHeight: body ? body.clientHeight : null,
          bodyScrollWidth: body ? body.scrollWidth : null,
          bodyClientWidth: body ? body.clientWidth : null,
          documentElementScrollTop: html.scrollTop,
          documentElementScrollHeight: html.scrollHeight,
          documentElementClientHeight: html.clientHeight,
          documentElementScrollWidth: html.scrollWidth,
          documentElementClientWidth: html.clientWidth,
          windowScrollX: window.scrollX,
          windowScrollY: window.scrollY
        },
        computedStyles: {
          body: bodyStyles
            ? {
                overflow: bodyStyles.overflow,
                overflowX: bodyStyles.overflowX,
                overflowY: bodyStyles.overflowY,
                paddingBottom: bodyStyles.paddingBottom
              }
            : null,
          html: {
            overflow: htmlStyles.overflow,
            overflowX: htmlStyles.overflowX,
            overflowY: htmlStyles.overflowY,
            paddingBottom: htmlStyles.paddingBottom
          },
          touchBar: touchBarStyles
            ? {
                bottom: touchBarStyles.bottom,
                height: touchBarStyles.height
              }
            : null
        },
        safeArea,
        appHeight: htmlStyles.getPropertyValue("--klevby-app-height").trim(),
        "--klevby-app-height": htmlStyles.getPropertyValue("--klevby-app-height").trim(),
        homeScreenLock: {
          root: html.getAttribute("data-home-screen-lock") || null,
          body: body?.getAttribute("data-home-screen-lock") || null
        },
        chromeMode: body?.getAttribute("data-app-chrome-mode") || null,
        homeDensity: html.getAttribute("data-home-density") || null,
        compactMediaQuery: window.matchMedia("(max-width: 390px) and (max-height: 820px)").matches,
        homeScrollDiff: home ? home.scrollHeight - home.clientHeight : null
      };
    };

    diag.saveJSON = function () {
      const json = getDiagnosticsJson();
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = getDiagnosticsFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    };

    diag.copyJSON = async function () {
      const json = getDiagnosticsJson();
      console.log(`[${getDiagnosticsName()}]`, json);

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(json);
          return true;
        }
      } catch (_) {}

      const copied = copyWithTextarea(json);
      if (!copied) showManualCopyDialog(json);
      return copied;
    };

    diag.shareJSON = async function () {
      if (!navigator.share || typeof navigator.share !== "function") return false;

      const json = getDiagnosticsJson();
      const file = new File([json], getDiagnosticsFilename(), {
        type: "application/json"
      });

      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: getDiagnosticsName()
          });
          return true;
        }
      } catch (_) {}

      try {
        await navigator.share({
          title: getDiagnosticsName(),
          text: json
        });
        return true;
      } catch (_) {
        return false;
      }
    };

    diag.disable = function () {
      setStorageEnabled(false);
      removeDiagnosticsControls();
      bindLogoActivation();
    };
  }

  function createDiagnosticsButton(label, onClick, options) {
    const button = document.createElement("button");
    const opts = options || {};

    button.type = "button";
    button.textContent = label;
    button.style.position = "relative";
    button.style.display = "block";
    button.style.width = "100%";
    button.style.background = opts.background || "#F47A2B";
    button.style.color = opts.color || "#fff";
    button.style.padding = opts.padding || "8px 12px";
    button.style.border = "none";
    button.style.borderRadius = "6px";
    button.style.fontSize = opts.fontSize || "12px";
    button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);

    return button;
  }

  function flashButtonLabel(button, successLabel, failureLabel, succeeded) {
    const originalText = button.textContent;
    button.textContent = succeeded ? successLabel : failureLabel;

    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
  }

  function removeDiagnosticsControls() {
    const container = document.getElementById(BUTTON_CONTAINER_ID);
    if (container) container.remove();
  }

  function showDiagnosticsControls() {
    if (!window.klevbyAndroidDiagnostics || document.getElementById(BUTTON_CONTAINER_ID)) return;

    const container = document.createElement("div");
    container.id = BUTTON_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.bottom = "80px";
    container.style.left = "10px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "6px";
    container.style.maxWidth = "220px";

    const title = document.createElement("div");
    title.textContent = "Layout diagnostics";
    title.style.cssText = "padding:6px 8px;border-radius:6px;background:rgba(8,12,10,0.92);color:#fff;font:700 12px/1.2 system-ui,sans-serif;";
    container.appendChild(title);

    const downloadButton = createDiagnosticsButton(`Save ${getDiagnosticsName()}`, () => {
      window.klevbyAndroidDiagnostics.saveJSON();
    });
    container.appendChild(downloadButton);

    const enableSkeletonButton = createDiagnosticsButton("Enable Skeleton", () => {
      enableSkeletonFromDiagnostics();
    });
    container.appendChild(enableSkeletonButton);

    const disableSkeletonButton = createDiagnosticsButton(
      "Disable Skeleton",
      () => {
        disableSkeletonFromDiagnostics();
      },
      {
        background: "#356A48"
      }
    );
    container.appendChild(disableSkeletonButton);

    const skeletonStatus = document.createElement("div");
    skeletonStatus.id = SKELETON_STATUS_ID;
    skeletonStatus.style.display = "none";
    skeletonStatus.style.background = "rgba(8,12,10,0.92)";
    skeletonStatus.style.color = "#fff";
    skeletonStatus.style.padding = "6px 8px";
    skeletonStatus.style.borderRadius = "6px";
    skeletonStatus.style.fontSize = "11px";
    skeletonStatus.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    container.appendChild(skeletonStatus);

    const copyButton = createDiagnosticsButton("Copy JSON", async () => {
      const copied = await window.klevbyAndroidDiagnostics.copyJSON();
      flashButtonLabel(copyButton, "JSON copied", "Copy failed", copied);
    });
    container.appendChild(copyButton);

    if (window.KlevbyBootStore?.clearDiagnostics) {
      const clearBootButton = createDiagnosticsButton("Clear diagnostics", () => {
        window.KlevbyBootStore.clearDiagnostics();
        flashButtonLabel(clearBootButton, "Cleared", "Failed", true);
      }, { background: "#5A4A2E" });
      container.appendChild(clearBootButton);
    }

    if (window.KlevbyNetworkState?.setSimulatedOffline) {
      let simulatedOffline = false;
      const simulateOfflineButton = createDiagnosticsButton("Simulate offline", () => {
        simulatedOffline = !simulatedOffline;
        window.KlevbyNetworkState.setSimulatedOffline(simulatedOffline);
        simulateOfflineButton.textContent = simulatedOffline ? "Disable offline sim" : "Simulate offline";
      }, { background: "#5A4A2E" });
      container.appendChild(simulateOfflineButton);
    }

    if (window.KlevbyLastKnownCache?.clearAllLastKnown) {
      const clearCacheButton = createDiagnosticsButton("Clear last-known cache", () => {
        window.KlevbyLastKnownCache.clearAllLastKnown();
        flashButtonLabel(clearCacheButton, "Cache cleared", "Failed", true);
      }, { background: "#5A4A2E" });
      container.appendChild(clearCacheButton);
    }

    const refreshButton = createDiagnosticsButton("Refresh", () => {
      window.klevbyAndroidDiagnostics.collect();
      flashButtonLabel(refreshButton, "Refreshed", "Refresh failed", true);
    }, { background: "#356A48" });
    container.appendChild(refreshButton);

    const closeButton = createDiagnosticsButton("Close", removeDiagnosticsControls, {
      background: "rgba(8,12,10,0.92)",
      color: "#fff",
      fontSize: "11px",
      padding: "6px 10px"
    });
    container.appendChild(closeButton);

    if (navigator.share && typeof navigator.share === "function") {
      const shareButton = createDiagnosticsButton("Share JSON", async () => {
        const shared = await window.klevbyAndroidDiagnostics.shareJSON();
        flashButtonLabel(shareButton, "Share opened", "Share failed", shared);
      });
      container.appendChild(shareButton);
    }

    const disableButton = createDiagnosticsButton(
      "Disable Diagnostics",
      () => {
        window.klevbyAndroidDiagnostics.disable();
      },
      {
        background: "rgba(8,12,10,0.92)",
        color: "#fff",
        fontSize: "11px",
        padding: "6px 10px"
      }
    );
    container.appendChild(disableButton);

    document.body.appendChild(container);
  }

  function activateDiagnosticsFromLogoGesture() {
    setStorageEnabled(true);
    initDiagnosticsModule();
    showDiagnosticsControls();
    console.log(`[${getDiagnosticsName()}] Enabled via logo gesture.`);
  }

  function bindLogoActivation() {
    if (logoActivationBound) return;

    const { isNativePlatform } = getCapacitorNativeState();
    const isIphonePwa = isIphone() && isStandaloneMode();
    if (!isNativePlatform && !isIphonePwa) return;

    const logo = document.querySelector(".logo.app-header-logo, .logo.app-header-logo img");
    if (!logo) return;

    logo.addEventListener("click", () => {
      if (!isHomeActive()) return;

      logoTapCount += 1;
      window.clearTimeout(logoTapResetTimer);

      if (logoTapCount < LOGO_TAP_TARGET) {
        logoTapResetTimer = window.setTimeout(() => {
          logoTapCount = 0;
        }, LOGO_TAP_RESET_MS);
        return;
      }

      logoTapCount = 0;
      window.clearTimeout(logoTapResetTimer);
      activateDiagnosticsFromLogoGesture();
    });

    logoActivationBound = true;
  }

  function bootDiagnostics() {
    if (isDiagnosticsEnabled()) {
      initDiagnosticsModule();

      const showControls = () => {
        if (!document.body) return;
        showDiagnosticsControls();
      };

      if (document.body) {
        showControls();
      } else {
        document.addEventListener("DOMContentLoaded", showControls, { once: true });
      }

      window.addEventListener("load", showControls, { once: true });
      console.log(`[${getDiagnosticsName()}] Opt-in diagnostics loaded.`);
      return;
    }

    bindLogoActivation();
  }

  if (document.body) {
    bootDiagnostics();
  } else {
    document.addEventListener("DOMContentLoaded", bootDiagnostics, { once: true });
  }
})();
