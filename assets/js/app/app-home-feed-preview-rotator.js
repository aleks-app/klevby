(function () {
  "use strict";

  const ROTATOR_ID = "homeFeedPreviewRotator";
  const HOME_SECTION_ID = "homeSection";
  const SLIDE_MS = 4500;
  const POLL_MS = 1000;
  const DISSOLVE_MS = 860;
  const MOSAIC_COLUMNS = 12;
  const MOSAIC_ROWS = 11;

  function initHomeFeedPreviewRotator() {
    try {
      const rotator = document.getElementById(ROTATOR_ID);
      if (!rotator) return;

      const slides = rotator.querySelectorAll(".home-feed-preview-slide");
      if (slides.length < 2) return;

      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const viewport = rotator.querySelector(".home-feed-preview-rotator-viewport");
      const feedSlide = rotator.querySelector(".home-feed-preview-slide--feed");
      let activeIndex = 0;
      let timerId = 0;
      let isTransitioning = false;

      function syncViewportHeight() {
        if (!viewport || !feedSlide) return;

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
          slide.setAttribute("aria-hidden", slideIndex === index ? "false" : "true");
        });
        activeIndex = index;
      }

      function removeDuplicateIds(element) {
        if (element.id) element.removeAttribute("id");
        element.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
      }

      function createMosaic(currentSlide) {
        const bounds = viewport.getBoundingClientRect();
        const mosaic = document.createElement("div");
        mosaic.className = "home-feed-preview-mosaic";
        mosaic.setAttribute("aria-hidden", "true");

        for (let row = 0; row < MOSAIC_ROWS; row += 1) {
          for (let column = 0; column < MOSAIC_COLUMNS; column += 1) {
            const cell = document.createElement("div");
            const fragment = currentSlide.cloneNode(true);
            const seed = (row * 47 + column * 73 + row * column * 17) % 101;
            const wave = Math.sin(column * 0.82 + row * 0.43) * 68;
            const delay = Math.max(0, Math.round(35 + seed * 3.1 + wave));

            cell.className = "home-feed-preview-mosaic-cell";
            cell.style.left = `${(column / MOSAIC_COLUMNS) * 100}%`;
            cell.style.top = `${(row / MOSAIC_ROWS) * 100}%`;
            cell.style.width = `${100 / MOSAIC_COLUMNS + 0.08}%`;
            cell.style.height = `${100 / MOSAIC_ROWS + 0.08}%`;
            cell.style.setProperty("--mosaic-delay", `${delay}ms`);

            removeDuplicateIds(fragment);
            fragment.classList.remove("is-active");
            fragment.removeAttribute("onclick");
            fragment.removeAttribute("role");
            fragment.removeAttribute("tabindex");
            fragment.style.width = `${bounds.width}px`;
            fragment.style.height = `${bounds.height}px`;
            fragment.style.transform = `translate(${-column * bounds.width / MOSAIC_COLUMNS}px, ${-row * bounds.height / MOSAIC_ROWS}px)`;

            cell.appendChild(fragment);
            mosaic.appendChild(cell);
          }
        }

        return mosaic;
      }

      function transitionToSlide(index) {
        if (isTransitioning || index === activeIndex) return;

        if (prefersReducedMotion) {
          setActiveSlide(index);
          return;
        }

        isTransitioning = true;
        const currentSlide = slides[activeIndex];
        const nextSlide = slides[index];
        const mosaic = createMosaic(currentSlide);

        nextSlide.classList.add("is-active");
        nextSlide.setAttribute("aria-hidden", "false");
        currentSlide.classList.add("is-dissolving");
        viewport.appendChild(mosaic);

        window.requestAnimationFrame(() => {
          mosaic.classList.add("is-dissolving");
          currentSlide.classList.remove("is-active");
          currentSlide.setAttribute("aria-hidden", "true");
        });

        window.setTimeout(() => {
          mosaic.remove();
          currentSlide.classList.remove("is-dissolving");
          activeIndex = index;
          isTransitioning = false;
        }, DISSOLVE_MS);
      }

      function scheduleNextRotation() {
        window.clearTimeout(timerId);

        if (!canRotate()) {
          timerId = window.setTimeout(scheduleNextRotation, POLL_MS);
          return;
        }

        timerId = window.setTimeout(() => {
          transitionToSlide(activeIndex === 0 ? 1 : 0);
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
