(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    root.KlevbyAppShellViewportOwner = api.createAppShellViewportOwner(root, root.document);
    root.KlevbyAppShellViewportOwner.init();
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const CSS_VARIABLES = Object.freeze({
    viewportWidth: "--klevby-app-viewport-width",
    viewportHeight: "--klevby-app-viewport-height",
    availableTop: "--klevby-app-available-top",
    availableBottom: "--klevby-app-available-bottom",
    availableHeight: "--klevby-app-available-height",
    availableBottomOffset: "--klevby-app-available-bottom-offset"
  });

  const LEGACY_VIEWPORT_ALIASES = Object.freeze({
    viewportHeight: "--klevby-app-height"
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
    const measuredHeaderBottom = finiteNonNegative(headerRect?.bottom);
    const measuredTabbarTop = finiteNonNegative(tabbarRect?.top, viewportHeight);
    const availableTop = headerVisible
      ? clamp(measuredHeaderBottom, 0, viewportHeight)
      : 0;
    const usesTabbarBoundary =
      cleanChromeMode !== "map" && tabbarVisible && tabbarRect != null;
    const availableBottom = usesTabbarBoundary
      ? clamp(measuredTabbarTop, availableTop, viewportHeight)
      : viewportHeight;
    const availableHeight = Math.max(0, availableBottom - availableTop);
    const availableBottomOffset = Math.max(0, viewportHeight - availableBottom);

    return {
      chromeMode: cleanChromeMode,
      viewportWidth,
      viewportHeight,
      availableTop,
      availableBottom,
      availableHeight,
      availableBottomOffset,
      headerVisible: Boolean(headerVisible),
      tabbarVisible: cleanChromeMode === "map" ? false : Boolean(tabbarVisible)
    };
  }

  function createAppShellViewportOwner(windowObject, documentObject) {
    let initialized = false;
    let updateFrame = 0;
    let observer = null;
    let layoutWatchdog = 0;
    let delayedRemeasureScheduled = false;
    let lastMeasurement = null;

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

    function measurementChanged(nextMeasurement) {
      if (!lastMeasurement) return true;

      return [
        "viewportWidth",
        "viewportHeight",
        "availableTop",
        "availableBottom",
        "availableHeight",
        "availableBottomOffset",
        "chromeMode",
        "headerVisible",
        "tabbarVisible"
      ].some((key) => lastMeasurement[key] !== nextMeasurement[key]);
    }

    function publish(measurement) {
      if (!measurementChanged(measurement)) {
        return lastMeasurement;
      }

      const style = documentObject.documentElement.style;

      Object.entries(CSS_VARIABLES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      Object.entries(LEGACY_VIEWPORT_ALIASES).forEach(([property, variable]) => {
        style.setProperty(variable, `${measurement[property]}px`);
      });

      lastMeasurement = Object.freeze({ ...measurement });
      windowObject.dispatchEvent(
        new windowObject.CustomEvent("klevby-app-shell-updated", {
          detail: { ...lastMeasurement }
        })
      );

      return lastMeasurement;
    }

    function measureAndPublish() {
      return publish(measure());
    }

    function update() {
      return measureAndPublish();
    }

    function scheduleUpdate() {
      if (updateFrame) return;

      updateFrame = windowObject.requestAnimationFrame(() => {
        updateFrame = 0;
        measureAndPublish();
      });
    }


    function scheduleDelayedRemeasure() {
      if (delayedRemeasureScheduled) return;
      delayedRemeasureScheduled = true;

      windowObject.requestAnimationFrame(() => {
        windowObject.setTimeout(() => {
          measureAndPublish();
        }, 400);
      });
    }

    function startLayoutWatchdog() {
      if (layoutWatchdog) {
        windowObject.clearInterval(layoutWatchdog);
      }

      layoutWatchdog = windowObject.setInterval(() => {
        measureAndPublish();
      }, 2500);
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
        measureAndPublish();
        scheduleDelayedRemeasure();
        startLayoutWatchdog();
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

  return Object.freeze({
    CSS_VARIABLES,
    calculateAppShellViewport,
    createAppShellViewportOwner
  });
});
