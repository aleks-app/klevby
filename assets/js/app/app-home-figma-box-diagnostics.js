(function () {
  "use strict";

  const OVERLAY_ID = "klevgoHomeBoxDiagnosticsOverlay";
  const TAP_TARGET_COUNT = 7;
  const TAP_WINDOW_MS = 2200;
  const TAP_DEDUPE_MS = 450;
  const GLOBAL_BOUND_KEY = "__KLEVGO_HOME_BOX_DIAGNOSTICS_BOUND__";

  const SELECTORS = {
    appRoot: "#app, #appRoot, .app, .wrap",
    background: "#homeSection",
    homeRoot: "#homeSection .home-figma-live",
    homeHeader: "#homeSection .home-figma-header",
    fishLogo: "#homeSection .home-figma-brand, #homeSection .home-figma-brand-icon",
    hero: "#homeSection .home-figma-hero-copy",
    actionCards: "#homeSection .home-figma-actions",
    feedShell: "#klevgo-home-figma-empty-ad-shell",
    feedTitle: "#klevgo-home-figma-feed-title",
    feedViewAll: "#klevgo-home-figma-feed-view-all",
    weatherShell: "#klevgo-home-figma-empty-weather-shell",
    touchBar: ".mobile-tabbar",
    bottomChrome: "#klevgo-home-figma-empty-weather-shell ~ .mobile-tabbar, .bottom-nav, .bottom-chrome, .app-bottom-chrome, [data-bottom-chrome]",
    topChrome: "#header, header, .app-header, [data-safe-area-top]"
  };

  const CSS_VARIABLE_PATTERNS = [
    /^--klev/i,
    /^--kg-/i,
    /^--home/i,
    /^--safe/i,
    /^--sat/i,
    /^--sab/i,
    /^--touch/i,
    /^--mobile-tabbar/i
  ];

  function query(selector) {
    try {
      return document.querySelector(selector);
    } catch (_) {
      return null;
    }
  }

  function queryAll(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function rectOf(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  function styleSummary(element) {
    if (!element || typeof getComputedStyle !== "function") return null;
    const style = getComputedStyle(element);
    return {
      selector: element.__klevgoSelector || null,
      position: style.position,
      zIndex: style.zIndex,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      width: style.width,
      height: style.height,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      marginTop: style.marginTop,
      marginBottom: style.marginBottom,
      transform: style.transform
    };
  }

  function classNameOf(element) {
    if (!element) return null;
    if (typeof element.className === "string") return element.className;
    if (element.className && typeof element.className.baseVal === "string") return element.className.baseVal;
    return String(element.className || "");
  }

  function isVisibleCandidate(rect, style) {
    return Boolean(
      rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      style &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function candidateSummary(name, selector, element, index) {
    const rect = rectOf(element);
    const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
    const visible = isVisibleCandidate(rect, style);
    return {
      name,
      selector,
      index,
      tagName: element?.tagName || null,
      id: element?.id || "",
      className: classNameOf(element),
      rect,
      display: style?.display ?? null,
      visibility: style?.visibility ?? null,
      opacity: style?.opacity ?? null,
      position: style?.position ?? null,
      zIndex: style?.zIndex ?? null,
      visible
    };
  }

  function collectCandidates(name, selector) {
    const candidates = queryAll(selector).map((element, index) => candidateSummary(name, selector, element, index));
    const selectedVisibleCandidate = candidates.find((candidate) => candidate.visible) || null;
    return {
      selector,
      candidates,
      selectedVisibleCandidate
    };
  }

  function markElement(name, selector) {
    const candidateGroup = collectCandidates(name, selector);
    const selectedIndex = candidateGroup.selectedVisibleCandidate?.index ?? 0;
    const element = queryAll(selector)[selectedIndex] || null;
    if (element) element.__klevgoSelector = selector;
    return [name, element];
  }

  function gap(a, b) {
    if (!a || !b) return null;
    return b.top - a.bottom;
  }

  function getCssVariables(element) {
    if (!element || typeof getComputedStyle !== "function") return {};
    const style = getComputedStyle(element);
    const values = {};
    for (let index = 0; index < style.length; index += 1) {
      const name = style[index];
      if (!CSS_VARIABLE_PATTERNS.some((pattern) => pattern.test(name))) continue;
      values[name] = style.getPropertyValue(name).trim();
    }
    return values;
  }


  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function sanitizeStartupTimingValue(value, seen = new WeakSet()) {
    if (value == null) return value;
    const valueType = typeof value;
    if (valueType === "string" || valueType === "boolean") return value;
    if (valueType === "number") return Number.isFinite(value) ? value : null;
    if (valueType !== "object") return undefined;
    if (seen.has(value)) return undefined;

    seen.add(value);

    if (Array.isArray(value)) {
      return value
        .slice(-25)
        .map((item) => sanitizeStartupTimingValue(item, seen))
        .filter((item) => item !== undefined);
    }

    if (!isPlainObject(value)) return undefined;

    const sanitized = {};
    Object.entries(value).forEach(([key, entryValue]) => {
      const sanitizedValue = sanitizeStartupTimingValue(entryValue, seen);
      if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
    });
    return sanitized;
  }

  function getStartupTimingsSnapshot() {
    const timings = window.__KLEVGO_STARTUP_TIMINGS__;
    if (!isPlainObject(timings)) return { available: false };

    return {
      available: true,
      startedAt: sanitizeStartupTimingValue(timings.startedAt) ?? null,
      events: sanitizeStartupTimingValue(Array.isArray(timings.events) ? timings.events : []) || [],
      latestEvents: sanitizeStartupTimingValue(Array.isArray(timings.latestEvents) ? timings.latestEvents : []) || [],
      durations: sanitizeStartupTimingValue(isPlainObject(timings.durations) ? timings.durations : {}) || {},
      lastError: sanitizeStartupTimingValue(timings.lastError) ?? null
    };
  }

  function safeComputedBackground(element) {
    if (!element || typeof getComputedStyle !== "function") return null;
    try {
      return getComputedStyle(element).backgroundColor;
    } catch (_) {
      return null;
    }
  }

  function metaContent(selector) {
    return query(selector)?.getAttribute("content") || null;
  }

  function timingNumber(entry, key) {
    const value = entry?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getNavigationTiming() {
    const navigation = typeof window.performance?.getEntriesByType === "function"
      ? window.performance.getEntriesByType("navigation")[0]
      : null;
    if (!navigation) return null;

    return {
      type: navigation.type || null,
      startTime: timingNumber(navigation, "startTime"),
      workerStart: timingNumber(navigation, "workerStart"),
      fetchStart: timingNumber(navigation, "fetchStart"),
      requestStart: timingNumber(navigation, "requestStart"),
      responseStart: timingNumber(navigation, "responseStart"),
      responseEnd: timingNumber(navigation, "responseEnd"),
      domInteractive: timingNumber(navigation, "domInteractive"),
      domContentLoadedEventStart: timingNumber(navigation, "domContentLoadedEventStart"),
      domContentLoadedEventEnd: timingNumber(navigation, "domContentLoadedEventEnd"),
      loadEventStart: timingNumber(navigation, "loadEventStart"),
      loadEventEnd: timingNumber(navigation, "loadEventEnd"),
      duration: timingNumber(navigation, "duration"),
      transferSize: timingNumber(navigation, "transferSize"),
      encodedBodySize: timingNumber(navigation, "encodedBodySize"),
      decodedBodySize: timingNumber(navigation, "decodedBodySize")
    };
  }

  function getPaintTimings() {
    const paintEntries = typeof window.performance?.getEntriesByType === "function"
      ? window.performance.getEntriesByType("paint")
      : [];
    return paintEntries.reduce((timings, entry) => {
      if (entry.name === "first-paint" || entry.name === "first-contentful-paint") {
        timings[entry.name] = {
          startTime: timingNumber(entry, "startTime"),
          duration: timingNumber(entry, "duration")
        };
      }
      return timings;
    }, {
      "first-paint": null,
      "first-contentful-paint": null
    });
  }

  function getCssResourceTimings() {
    const resources = typeof window.performance?.getEntriesByType === "function"
      ? window.performance.getEntriesByType("resource")
      : [];

    return resources
      .filter((entry) => {
        const name = entry.name || "";
        return name.includes("assets/css/main.css") ||
          name.includes("assets/css/base/global.css") ||
          name.includes(".css");
      })
      .slice(0, 10)
      .map((entry) => ({
        name: entry.name || null,
        shortName: entry.name ? entry.name.split("/").slice(-3).join("/") : null,
        startTime: timingNumber(entry, "startTime"),
        responseStart: timingNumber(entry, "responseStart"),
        responseEnd: timingNumber(entry, "responseEnd"),
        duration: timingNumber(entry, "duration"),
        transferSize: timingNumber(entry, "transferSize")
      }));
  }

  function timeoutValue(ms, value) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(value), ms);
    });
  }

  async function getServiceWorkerDiagnostics() {
    const supported = "serviceWorker" in navigator;
    const serviceWorker = {
      supported,
      controllerPresent: Boolean(navigator.serviceWorker?.controller),
      controllerScriptURL: navigator.serviceWorker?.controller?.scriptURL || null,
      controllerState: navigator.serviceWorker?.controller?.state || null,
      readyActiveScriptURL: null,
      readyActiveState: null,
      waitingScriptURL: null,
      installingScriptURL: null,
      timedOut: false,
      error: null
    };

    if (!supported) return serviceWorker;

    try {
      const registration = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        timeoutValue(300, { __klevgoTimedOut: true })
      ]);
      if (registration?.__klevgoTimedOut) {
        serviceWorker.timedOut = true;
        return serviceWorker;
      }
      serviceWorker.readyActiveScriptURL = registration?.active?.scriptURL || null;
      serviceWorker.readyActiveState = registration?.active?.state || null;
      serviceWorker.waitingScriptURL = registration?.waiting?.scriptURL || null;
      serviceWorker.installingScriptURL = registration?.installing?.scriptURL || null;
    } catch (error) {
      serviceWorker.error = error?.message || String(error);
    }

    return serviceWorker;
  }

  async function getPwaColdStartDiagnostics() {
    const criticalFirstPaintStyle = document.getElementById("klevgo-critical-first-paint");
    return {
      criticalFirstPaintStyle: {
        present: Boolean(criticalFirstPaintStyle),
        textLength: criticalFirstPaintStyle?.textContent?.length || 0
      },
      computedBackgrounds: {
        html: safeComputedBackground(document.documentElement),
        body: safeComputedBackground(document.body),
        homeSection: safeComputedBackground(document.getElementById("homeSection")),
        appSplash: safeComputedBackground(document.getElementById("appSplash"))
      },
      meta: {
        themeColor: metaContent('meta[name="theme-color"]'),
        backgroundColor: metaContent('meta[name="background-color"]'),
        appleMobileWebAppCapable: metaContent('meta[name="apple-mobile-web-app-capable"]'),
        appleMobileWebAppStatusBarStyle: metaContent('meta[name="apple-mobile-web-app-status-bar-style"]'),
        manifestHref: query('link[rel="manifest"]')?.getAttribute("href") || null
      },
      serviceWorker: await getServiceWorkerDiagnostics(),
      navigationTiming: getNavigationTiming(),
      paintTimings: getPaintTimings(),
      cssResourceTimings: getCssResourceTimings(),
      startupTimings: getStartupTimingsSnapshot()
    };
  }

  async function measureWithPwaColdStartDiagnostics() {
    const data = measure();
    data.pwaColdStart = await getPwaColdStartDiagnostics();
    return data;
  }

  function getWeatherBridgeDiagnostics() {
    const bridgeDebug = window.KLEVGO_FIGMA_WEATHER_BRIDGE_DEBUG || {};
    const weatherState = window.KlevGoWeatherState || {};
    return {
      source: bridgeDebug.source || null,
      lastRenderAt: bridgeDebug.lastRenderAt || null,
      hasState: Boolean(window.KlevGoWeatherState),
      stateUpdatedAt: weatherState.updatedAt || null,
      stateKeys: Object.keys(weatherState),
      mode: weatherState.mode || null,
      tempText: weatherState.tempText || null,
      conditionText: weatherState.conditionText || null,
      windText: weatherState.windText || null,
      pressureText: weatherState.pressureText || null,
      biteTitle: weatherState.biteTitle || null,
      biteDescription: weatherState.biteDescription || null
    };
  }

  function detectFixedValues() {
    const matches = [];
    const targets = [
      ["home-empty-ad-shell", "#klevgo-home-figma-empty-ad-shell-style"],
      ["home-figma-redesign", "style"]
    ];
    targets.forEach(([name, selector]) => {
      document.querySelectorAll(selector).forEach((node) => {
        const text = node.textContent || "";
        ["505px", "760px", "396px", "440px", "956px"].forEach((value) => {
          if (text.includes(value)) matches.push({ source: name, value });
        });
      });
    });
    return matches;
  }

  function isOutsideViewport(rect) {
    if (!rect) return null;
    return rect.left < 0 || rect.right > window.innerWidth;
  }

  function overlaps(a, b) {
    if (!a || !b) return null;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function measure() {
    const measuredCandidateNames = ["feedShell", "weatherShell", "background", "touchBar"];
    const candidateGroups = Object.fromEntries(
      measuredCandidateNames.map((name) => [name, collectCandidates(name, SELECTORS[name])])
    );
    const elements = Object.fromEntries(Object.entries(SELECTORS).map(([name, selector]) => markElement(name, selector)));
    measuredCandidateNames.forEach((name) => {
      const selectedIndex = candidateGroups[name].selectedVisibleCandidate?.index;
      if (selectedIndex == null) return;
      const selectedElement = queryAll(SELECTORS[name])[selectedIndex] || null;
      if (selectedElement) {
        selectedElement.__klevgoSelector = SELECTORS[name];
        elements[name] = selectedElement;
      }
    });
    const rects = {
      html: rectOf(document.documentElement),
      body: rectOf(document.body)
    };
    Object.entries(elements).forEach(([name, element]) => {
      rects[name] = rectOf(element);
    });

    const vv = window.visualViewport;
    const viewportBottom = window.innerHeight;
    const weatherRect = rects.weatherShell;
    const touchRect = rects.touchBar;
    const backgroundRect = rects.background;
    const bottomChromeRect = rects.bottomChrome;

    return {
      timestamp: new Date().toISOString(),
      geometrySource: "figma-shells",
      locationHref: window.location.href,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentElementClientWidth: document.documentElement.clientWidth,
        documentElementClientHeight: document.documentElement.clientHeight,
        bodyScrollWidth: document.body?.scrollWidth ?? null,
        bodyScrollHeight: document.body?.scrollHeight ?? null,
        visualViewport: vv ? {
          width: vv.width,
          height: vv.height,
          offsetTop: vv.offsetTop,
          offsetLeft: vv.offsetLeft,
          scale: vv.scale
        } : null
      },
      cssVariables: {
        root: getCssVariables(document.documentElement),
        body: getCssVariables(document.body),
        homeSection: getCssVariables(elements.background),
        touchBar: getCssVariables(elements.touchBar)
      },
      selectors: SELECTORS,
      candidates: candidateGroups,
      selectedVisibleSelectors: {
        feedShell: candidateGroups.feedShell.selectedVisibleCandidate?.selector ?? null,
        weatherShell: candidateGroups.weatherShell.selectedVisibleCandidate?.selector ?? null,
        background: candidateGroups.background.selectedVisibleCandidate?.selector ?? null,
        touchBar: candidateGroups.touchBar.selectedVisibleCandidate?.selector ?? null
      },
      visibleBlocks: {
        feedAdShell: rects.feedShell ? {
          top: rects.feedShell.top,
          bottom: rects.feedShell.bottom,
          height: rects.feedShell.height,
          gapToWeather: gap(rects.feedShell, weatherRect)
        } : null,
        weatherShell: weatherRect ? {
          top: weatherRect.top,
          bottom: weatherRect.bottom,
          height: weatherRect.height,
          gapToTouchBarTop: gap(weatherRect, touchRect)
        } : null,
        touchBar: touchRect ? {
          top: touchRect.top,
          bottom: touchRect.bottom,
          height: touchRect.height,
          bottomSpaceToViewport: viewportBottom - touchRect.bottom
        } : null,
        background: backgroundRect ? {
          top: backgroundRect.top,
          bottom: backgroundRect.bottom,
          height: backgroundRect.height,
          viewportBottom,
          bottomSpaceToViewport: viewportBottom - backgroundRect.bottom,
          reachesViewportBottom: backgroundRect.bottom >= viewportBottom
        } : null,
        rail: rects.homeRoot ? {
          left: rects.homeRoot.left,
          right: rects.homeRoot.right,
          width: rects.homeRoot.width,
          horizontalOverflowPx: Math.max(0, (document.body?.scrollWidth || 0) - window.innerWidth),
          exceedsViewport: isOutsideViewport(rects.homeRoot)
        } : null
      },
      rects,
      gaps: {
        heroToActionCards: gap(rects.hero, rects.actionCards),
        actionCardsToFeedAd: gap(rects.actionCards, rects.feedShell),
        feedAdToWeather: gap(rects.feedShell, weatherRect),
        weatherToTouchBar: gap(weatherRect, touchRect),
        touchBarBottomToViewportBottom: touchRect ? viewportBottom - touchRect.bottom : null,
        blackBottomBase: bottomChromeRect ? {
          top: bottomChromeRect.top,
          bottom: bottomChromeRect.bottom,
          height: bottomChromeRect.height
        } : null,
        backgroundTopOffsetFromViewport: backgroundRect ? backgroundRect.top : null,
        backgroundBottomOffsetFromViewport: backgroundRect ? viewportBottom - backgroundRect.bottom : null
      },
      overflow: {
        horizontalOverflowPx: Math.max(0, (document.body?.scrollWidth || 0) - window.innerWidth),
        verticalOverflowPx: Math.max(0, (document.body?.scrollHeight || 0) - window.innerHeight),
        homeRail: rects.homeRoot ? { left: rects.homeRoot.left, right: rects.homeRoot.right, width: rects.homeRoot.width } : null,
        exceedsViewport: {
          homeHeader: isOutsideViewport(rects.homeHeader),
          hero: isOutsideViewport(rects.hero),
          actionCards: isOutsideViewport(rects.actionCards),
          feedShell: isOutsideViewport(rects.feedShell),
          weatherShell: isOutsideViewport(weatherRect),
          touchBar: isOutsideViewport(touchRect)
        },
        weatherOverlapsTouchBar: overlaps(weatherRect, touchRect),
        homeContentOverlapsBottomChrome: overlaps(rects.homeRoot, bottomChromeRect)
      },
      layering: {
        background: styleSummary(elements.background),
        homeRoot: styleSummary(elements.homeRoot),
        feedShell: styleSummary(elements.feedShell),
        weatherShell: styleSummary(elements.weatherShell),
        touchBar: styleSummary(elements.touchBar),
        bottomChrome: styleSummary(elements.bottomChrome)
      },
      fixedValueHints: detectFixedValues(),
      weatherBridge: getWeatherBridgeDiagnostics(),
      startupTimings: getStartupTimingsSnapshot()
    };
  }

  function hideOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
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

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        return copyTextFallback(text);
      }
    }
    return copyTextFallback(text);
  }

  async function showOverlay() {
    hideOverlay();
    const data = await measureWithPwaColdStartDiagnostics();
    const json = JSON.stringify(data, null, 2);
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Home diagnostics");
    overlay.style.cssText = "position:fixed;inset:calc(10px + env(safe-area-inset-top,0px)) 10px calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483647;background:rgba(6,8,10,.96);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 18px 48px rgba(0,0,0,.45);";
    overlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 15px/1.2 system-ui,sans-serif;"><span>Home diagnostics</span><div style="display:flex;align-items:center;gap:8px;"><span data-klevgo-home-box-copy-status style="min-width:64px;color:#b7f7cf;font:600 12px/1.2 system-ui,sans-serif;"></span><button type="button" data-klevgo-home-box-copy style="min-height:36px;padding:7px 11px;border:0;border-radius:10px;background:#ffffff;color:#111;font-weight:800;">Copy JSON</button><button type="button" data-klevgo-home-box-close style="min-height:36px;padding:7px 11px;border:0;border-radius:10px;background:#f47a2b;color:#111;font-weight:800;">Close</button></div></div><pre data-klevgo-home-box-preview style="flex:1;min-height:0;width:100%;box-sizing:border-box;overflow:auto;white-space:pre-wrap;word-break:break-word;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.06);color:#fff;margin:0;padding:8px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;"></pre>';
    overlay.querySelector("[data-klevgo-home-box-preview]").textContent = json;
    overlay.querySelector("[data-klevgo-home-box-close]").addEventListener("click", hideOverlay);
    overlay.querySelector("[data-klevgo-home-box-copy]").addEventListener("click", async () => {
      const status = overlay.querySelector("[data-klevgo-home-box-copy-status]");
      const copied = await copyText(json);
      status.textContent = copied ? "Copied" : "Copy failed";
    });
    document.body.appendChild(overlay);
    return data;
  }

  async function printMeasure() {
    const data = await measureWithPwaColdStartDiagnostics();
    console.log(JSON.stringify(data, null, 2));
    return data;
  }

  function isRedesignedHomeActive() {
    return document.body?.dataset.homeRedesign === "true" && document.body?.dataset.appChromeMode === "home";
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.("button,a,input,select,textarea,[role='button'],[data-route],[data-tab],.home-figma-actions,.home-figma-action,.home-figma-profile,.home-figma-burger"));
  }

  function isDiagnosticsTapTarget(target) {
    if (!isRedesignedHomeActive() || !target?.closest) return false;
    if (isInteractiveTarget(target)) return false;
    return Boolean(target.closest("#homeSection .home-figma-header, #homeSection .home-figma-live, #homeSection"));
  }

  function bindFishSevenTap() {
    if (window[GLOBAL_BOUND_KEY]) return;

    let count = 0;
    let startedAt = 0;
    let lastAcceptedAt = 0;
    let lastPointerType = "";

    function handleTap(event) {
      if (event.type === "touchend" && window.PointerEvent) return;
      if (event.type === "click" && (window.PointerEvent || lastPointerType === "touchend") && Date.now() - lastAcceptedAt < TAP_DEDUPE_MS) return;
      if (!isDiagnosticsTapTarget(event.target)) return;
      const now = Date.now();
      if (!startedAt || now - startedAt > TAP_WINDOW_MS) {
        startedAt = now;
        count = 0;
      }
      count += 1;
      lastAcceptedAt = now;
      lastPointerType = event.type;
      if (count < TAP_TARGET_COUNT) return;
      count = 0;
      startedAt = 0;
      showOverlay();
    }

    document.addEventListener("pointerup", handleTap, { passive: true });
    document.addEventListener("touchend", handleTap, { passive: true });
    document.addEventListener("click", handleTap, { passive: true });
    window[GLOBAL_BOUND_KEY] = true;
  }

  window.KLEVGO_HOME_BOX_MEASURE = measure;
  window.KLEVGO_HOME_BOX_MEASURE_PWA_COLD_START = measureWithPwaColdStartDiagnostics;
  window.KLEVGO_HOME_BOX_PRINT = printMeasure;
  window.KLEVGO_HOME_BOX_SHOW = showOverlay;
  window.KLEVGO_HOME_BOX_HIDE = hideOverlay;

  function init() {
    bindFishSevenTap();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
