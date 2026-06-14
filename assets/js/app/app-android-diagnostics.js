(function () {
  "use strict";

  const STORAGE_KEY = "klevbyAndroidDiagnosticsEnabled";
  const PWA_STORAGE_KEY = "klevbyPwaHomeDiagnosticsEnabled";
  const BUTTON_CONTAINER_ID = "klevbyAndroidDiagnosticsControls";
  const LOGO_TAP_TARGET = 7;
  const LOGO_TAP_RESET_MS = 4000;

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
    const heroCopyRect = getLayoutRect(document.querySelector("#homeSection .hero-copy"));
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
        homeSection: getLayoutRect(document.querySelector("#homeSection")),
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
          availableHeight > 0
      };

      return {
        timestamp: new Date().toISOString(),
        homeInternalGeometry: collectHomeInternalGeometry(),
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
          klevbyPwaHomeDiagnosticsEnabled: readStorageKeyEnabled(PWA_STORAGE_KEY)
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
        homeSectionTopNegative:
          homeRects.homeSection?.top != null ? homeRects.homeSection.top < -1 : null,
        homeFitContract,
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

      return copyWithTextarea(json);
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

    const downloadButton = createDiagnosticsButton(`Save ${getDiagnosticsName()}`, () => {
      window.klevbyAndroidDiagnostics.saveJSON();
    });
    container.appendChild(downloadButton);

    const copyButton = createDiagnosticsButton("Copy JSON", async () => {
      const copied = await window.klevbyAndroidDiagnostics.copyJSON();
      flashButtonLabel(copyButton, "JSON copied", "Copy failed", copied);
    });
    container.appendChild(copyButton);

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
