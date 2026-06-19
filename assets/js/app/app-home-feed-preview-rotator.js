(function () {
  "use strict";

  const ROTATOR_ID = "homeFeedPreviewRotator";
  const HOME_SECTION_ID = "homeSection";
  const HOME_LAYOUT_ATTRIBUTE = "data-home-layout";
  const HOME_LAYOUT_GRID_VALUE = "grid";
  const SLIDE_MS = 4500;
  const POLL_MS = 1000;

  function initHomeFeedPreviewRotator() {
    try {
      const rotator = document.getElementById(ROTATOR_ID);
      if (!rotator) return;

      const slides = rotator.querySelectorAll(".home-feed-preview-slide");
      if (slides.length < 2) return;

      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const viewport = rotator.querySelector(".home-feed-preview-rotator-viewport");
      const feedSlide = rotator.querySelector(".home-feed-preview-slide--feed");
      const homeSection = document.getElementById(HOME_SECTION_ID);
      let activeIndex = 0;
      let timerId = 0;

      function isHomeMeasuredGridMode() {
        return homeSection?.getAttribute(HOME_LAYOUT_ATTRIBUTE) === HOME_LAYOUT_GRID_VALUE;
      }

      function clearViewportHeight() {
        if (!viewport) return;
        viewport.style.removeProperty("min-height");
        viewport.style.removeProperty("height");
      }

      function syncViewportHeight() {
        if (!viewport || !feedSlide) return;

        if (isHomeMeasuredGridMode()) {
          clearViewportHeight();
          return;
        }

        const height = Math.ceil(feedSlide.getBoundingClientRect().height);
        if (height > 0) {
          viewport.style.minHeight = `${height}px`;
        }
      }

      function isHomeVisible() {
        const home = document.getElementById(HOME_SECTION_ID);
        return Boolean(home && !home.classList.contains("hidden"));
      }

      function canRotate() {
        return isHomeVisible() && document.visibilityState !== "hidden";
      }

      function setActiveSlide(index) {
        slides.forEach((slide, slideIndex) => {
          slide.classList.toggle("is-active", slideIndex === index);
        });
        activeIndex = index;
      }

      function scheduleNextRotation() {
        window.clearTimeout(timerId);

        if (!canRotate()) {
          timerId = window.setTimeout(scheduleNextRotation, POLL_MS);
          return;
        }

        timerId = window.setTimeout(() => {
          setActiveSlide(activeIndex === 0 ? 1 : 0);
          scheduleNextRotation();
        }, SLIDE_MS);
      }

      rotator.classList.add("is-ready");
      setActiveSlide(0);

      window.requestAnimationFrame(() => {
        syncViewportHeight();
        scheduleNextRotation();
      });

      window.addEventListener("resize", syncViewportHeight);

      const densityObserver = new MutationObserver(syncViewportHeight);
      densityObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-home-density"]
      });

      if (homeSection) {
        const layoutObserver = new MutationObserver(syncViewportHeight);
        layoutObserver.observe(homeSection, {
          attributes: true,
          attributeFilter: [HOME_LAYOUT_ATTRIBUTE]
        });
      }

      document.addEventListener("visibilitychange", () => {
        if (canRotate()) {
          syncViewportHeight();
          scheduleNextRotation();
        }
      });
    } catch (error) {
      console.warn("[KlevbyHomeFeedPreviewRotator] Rotator disabled:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeFeedPreviewRotator);
  } else {
    initHomeFeedPreviewRotator();
  }
})();
