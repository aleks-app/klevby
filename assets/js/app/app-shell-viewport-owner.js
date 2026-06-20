(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    root.KlevGoViewportKernel = api;
    root.KlevbyAppShellViewportOwner = api.createAppShellViewportOwner(root, root.document);
    root.KlevbyAppShellViewportOwner.init();
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const VIEWPORT_KERNEL_ROLE = "core-viewport-kernel";
  const VIEWPORT_KERNEL_ENTRYPOINT = "assets/js/app/app-shell-viewport-owner.js";

  const CSS_VARIABLES = Object.freeze({
    viewportWidth: "--klevby-app-viewport-width",
    viewportHeight: "--klevby-app-viewport-height",
    availableTop: "--klevby-app-available-top",
    availableBottom: "--klevby-app-available-bottom",
    availableHeight: "--klevby-app-available-height",
    availableBottomOffset: "--klevby-app-available-bottom-offset"
  });

  const KG_CSS_VARIABLES = Object.freeze({
    viewportWidth: "--kg-viewport-width",
    viewportHeight: "--kg-viewport-height",
    availableTop: "--kg-shell-top",
    availableBottom: "--kg-shell-bottom",
    availableHeight: "--kg-shell-height",
    availableBottomOffset: "--kg-shell-bottom-offset"
  });

  const HEADER_FRAME_CSS_VARIABLES = Object.freeze({
    headerTop: "--kg-header-top",
    headerBottom: "--kg-header-bottom",
    headerHeight: "--kg-header-height-measured",
    headerTopOffset: "--kg-header-top-offset-measured"
  });

  const TOUCHBAR_FRAME_CSS_VARIABLES = Object.freeze({
    touchbarTop: "--kg-touchbar-top",
    touchbarBottom: "--kg-touchbar-bottom",
    touchbarHeight: "--kg-touchbar-height-measured",
    touchbarBottomOffset: "--kg-touchbar-bottom-offset-measured"
  });

  function finiteNonNegative(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function calculateAppShellViewport({
    chromeMode = "",
    visualViewportWidth,
    visualViewportHeight,
    innerWidth,
    innerHeight,
    clientWidth,
    clientHeight,
    headerRect = null,
    tabbarRect = null,
    headerVisible = false,
    tabbarVisible = false
  } = {}) {
    const viewportWidth =
      finiteNonNegative(visualViewportWidth) ||
      finiteNonNegative(innerWidth) ||
      finiteNonNegative(clientWidth);
    const viewportHeight =
      finiteNonNegative(visualViewportHeight) ||
      finiteNonNegative(innerHeight) ||
      finiteNonNegative(clientHeight);
    const cleanChromeMode = String(chromeMode || "").trim().toLowerCase();
    const measuredHeaderTop = finiteNonNegative(headerRect?.top);
    const measuredHeaderBottom = finiteNonNegative(headerRect?.bottom);
    const measuredTabbarTop = finiteNonNegative(tabbarRect?.top, viewportHeight);
    const availableTop = headerVisible
      ? clamp(measuredHeaderBottom, 0, viewportHeight)
      : 0;
    const headerTop = headerVisible ? clamp(measuredHeaderTop, 0, availableTop) : 0;
    const headerBottom = headerVisible ? availableTop : 0;
    const headerHeight = headerVisible ? Math.max(0, headerBottom - headerTop) : 0;
    const headerTopOffset = headerVisible ? headerTop : 0;
    const usesTabbarBoundary =
      cleanChromeMode !== "map" && tabbarVisible && tabbarRect != null;
    const availableBottom = usesTabbarBoundary
      ? clamp(measuredTabbarTop, availableTop, viewportHeight)
      : viewportHeight;
    const availableHeight = Math.max(0, availableBottom - availableTop);
    const availableBottomOffset = Math.max(0, viewportHeight - availableBottom);
    const measuredTabbarBottom = finiteNonNegative(tabbarRect?.bottom, viewportHeight);
    const touchbarTop = usesTabbarBoundary ? availableBottom : viewportHeight;
    const touchbarBottom = usesTabbarBoundary
      ? clamp(measuredTabbarBottom, touchbarTop, viewportHeight)
      : viewportHeight;
    const touchbarHeight = usesTabbarBoundary ? Math.max(0, touchbarBottom - touchbarTop) : 0;
    const touchbarBottomOffset = usesTabbarBoundary
      ? Math.max(0, viewportHeight - touchbarBottom)
      : 0;

    return {
      chromeMode: cleanChromeMode,
      viewportWidth,
      viewportHeight,
      availableTop,
      availableBottom,
      availableHeight,
      availableBottomOffset,
      headerTop,
      headerBottom,
      headerHeight,
      headerTopOffset,
      touchbarTop,
      touchbarBottom,
      touchbarHeight,
      touchbarBottomOffset,
      headerVisible: Boolean(headerVisible),
      tabbarVisible: cleanChromeMode === "map" ? false : Boolean(tabbarVisible)
    };
  }

  function createAppShellViewportOwner(windowObject, documentObject) {
    let initialized = false;
    let updateFrame = 0;
    let observer = null;
    let lastMeasurement = null;
    let lastGoodShellContract = null;
    let resumeRemeasureFrame = 0;
    let appShellResumeRemeasureCount = 0;

    function getChromeMode() {
      const body = documentObject.body;
      return (
        body?.getAttribute("data-chrome-mode") ||
        body?.getAttribute("data-app-chrome-mode") ||
        ""
      );
    }

    function getHeader() {
      return (
        documentObject.getElementById("header") ||
        documentObject.querySelector("header[data-chrome-mode]") ||
        documentObject.querySelector("#klevbyAppRoot > header") ||
        documentObject.querySelector("header")
      );
    }

    function isElementVisible(element, rect, viewportWidth, viewportHeight) {
      if (!element || !rect || rect.width <= 0 || rect.height <= 0) return false;

      const styles = windowObject.getComputedStyle(element);
      if (
        styles.display === "none" ||
        styles.visibility === "hidden" ||
        Number.parseFloat(styles.opacity) === 0
      ) {
        return false;
      }

      return (
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth
      );
    }

    function measure() {
      const rootElement = documentObject.documentElement;
      const visualViewport = windowObject.visualViewport;
      const viewportWidth =
        finiteNonNegative(visualViewport?.width) ||
        finiteNonNegative(windowObject.innerWidth) ||
        finiteNonNegative(rootElement?.clientWidth);
      const viewportHeight =
        finiteNonNegative(visualViewport?.height) ||
        finiteNonNegative(windowObject.innerHeight) ||
        finiteNonNegative(rootElement?.clientHeight);
      const header = getHeader();
      const tabbar = documentObject.querySelector(".mobile-tabbar");
      const headerRect = header?.getBoundingClientRect() || null;
      const tabbarRect = tabbar?.getBoundingClientRect() || null;
      const chromeMode = getChromeMode();

      return calculateAppShellViewport({
        chromeMode,
        visualViewportWidth: visualViewport?.width,
        visualViewportHeight: visualViewport?.height,
        innerWidth: windowObject.innerWidth,
        innerHeight: windowObject.innerHeight,
        clientWidth: rootElement?.clientWidth,
        clientHeight: rootElement?.clientHeight,
        headerRect,
        tabbarRect,
        headerVisible: isElementVisible(header, headerRect, viewportWidth, viewportHeight),
        tabbarVisible:
          String(chromeMode).trim().toLowerCase() !== "map" &&
          isElementVisible(tabbar, tabbarRect, viewportWidth, viewportHeight)
      });
    }

    function isGoodHomeShellContract(measurement) {
      return (
        measurement?.chromeMode === "home" &&
        measurement.headerVisible === true &&
        measurement.tabbarVisible === true &&
        measurement.headerBottom > 0 &&
        measurement.touchbarTop > measurement.headerBottom &&
        measurement.availableHeight > 0
      );
    }

    function isZeroChromeHomeMeasurement(measurement) {
      return (
        measurement?.chromeMode === "home" &&
        measurement.headerVisible === false &&
        measurement.tabbarVisible === false &&
        measurement.headerBottom === 0 &&
        measurement.touchbarTop === measurement.viewportHeight &&
        measurement.touchbarHeight === 0 &&
        measurement.availableTop === 0 &&
        measurement.availableBottom === measurement.viewportHeight
      );
    }

    function withShellDiagnostics(measurement, diagnostics = {}) {
      return {
        ...measurement,
        appShellLastGoodTop: lastGoodShellContract?.availableTop ?? null,
        appShellLastGoodBottom: lastGoodShellContract?.availableBottom ?? null,
        appShellLastGoodHeight: lastGoodShellContract?.availableHeight ?? null,
        appShellUsedLastGoodAfterResume: Boolean(diagnostics.usedLastGoodAfterResume),
        appShellZeroChromeRejected: Boolean(diagnostics.zeroChromeRejected),
        appShellResumeRemeasureCount
      };
    }

    function scheduleResumeRemeasure() {
      if (resumeRemeasureFrame) return;

      resumeRemeasureFrame = windowObject.requestAnimationFrame(() => {
        resumeRemeasureFrame = windowObject.requestAnimationFrame(() => {
          resumeRemeasureFrame = 0;
          appShellResumeRemeasureCount += 1;
          update();
        });
      });
    }

    function publish(measurement) {
      const style = documentObject.documentElement.style;

      Object.entries(CSS_VARIABLES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      Object.entries(KG_CSS_VARIABLES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      Object.entries(HEADER_FRAME_CSS_VARIABLES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      Object.entries(TOUCHBAR_FRAME_CSS_VARIABLES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      if (isGoodHomeShellContract(measurement) && !measurement.appShellUsedLastGoodAfterResume) {
        lastGoodShellContract = Object.freeze({ ...measurement });
        measurement = withShellDiagnostics(measurement);
      }

      lastMeasurement = Object.freeze({ ...measurement });
      windowObject.dispatchEvent(
        new windowObject.CustomEvent("klevby-app-shell-updated", {
          detail: { ...lastMeasurement }
        })
      );

      return lastMeasurement;
    }

    function update() {
      const measurement = measure();

      if (lastGoodShellContract && isZeroChromeHomeMeasurement(measurement)) {
        scheduleResumeRemeasure();
        return publish(
          withShellDiagnostics(
            {
              ...lastGoodShellContract,
              viewportWidth: measurement.viewportWidth,
              viewportHeight: measurement.viewportHeight
            },
            {
              usedLastGoodAfterResume: true,
              zeroChromeRejected: true
            }
          )
        );
      }

      return publish(withShellDiagnostics(measurement));
    }

    function scheduleUpdate() {
      if (updateFrame) return;

      updateFrame = windowObject.requestAnimationFrame(() => {
        updateFrame = 0;
        update();
      });
    }

    function observeChromeMode() {
      if (!documentObject.body || typeof windowObject.MutationObserver !== "function") return;

      observer = new windowObject.MutationObserver(scheduleUpdate);
      observer.observe(documentObject.body, {
        attributes: true,
        attributeFilter: ["data-chrome-mode", "data-app-chrome-mode"]
      });
    }

    function bindEvents() {
      windowObject.addEventListener("load", scheduleUpdate, { passive: true });
      windowObject.addEventListener("resize", scheduleUpdate, { passive: true });
      windowObject.addEventListener("orientationchange", scheduleUpdate, { passive: true });
      windowObject.addEventListener("klevby-app-resumed", scheduleUpdate, { passive: true });
      windowObject.addEventListener("focus", scheduleUpdate, { passive: true });
      windowObject.addEventListener("pageshow", scheduleUpdate, { passive: true });
      documentObject.addEventListener("visibilitychange", scheduleUpdate, { passive: true });

      if (windowObject.visualViewport) {
        windowObject.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
        windowObject.visualViewport.addEventListener("scroll", scheduleUpdate, { passive: true });
      }
    }

    function init() {
      if (initialized) return;
      initialized = true;

      bindEvents();

      const initializeDocumentMeasurement = () => {
        observeChromeMode();
        update();
      };

      if (documentObject.readyState === "loading") {
        documentObject.addEventListener("DOMContentLoaded", initializeDocumentMeasurement, {
          once: true
        });
      } else {
        initializeDocumentMeasurement();
      }
    }

    return Object.freeze({
      init,
      update,
      scheduleUpdate,
      getLastMeasurement() {
        return lastMeasurement ? { ...lastMeasurement } : null;
      }
    });
  }

  const calculateViewportKernel = calculateAppShellViewport;
  const createViewportKernel = createAppShellViewportOwner;

  return Object.freeze({
    VIEWPORT_KERNEL_ROLE,
    VIEWPORT_KERNEL_ENTRYPOINT,
    CSS_VARIABLES,
    KG_CSS_VARIABLES,
    HEADER_FRAME_CSS_VARIABLES,
    TOUCHBAR_FRAME_CSS_VARIABLES,
    calculateViewportKernel,
    createViewportKernel,
    calculateAppShellViewport,
    createAppShellViewportOwner
  });
});
