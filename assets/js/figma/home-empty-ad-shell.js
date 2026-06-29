(() => {
  const SLOT_ID = "klevgo-home-figma-empty-ad-shell";
  const FEED_TITLE_ID = "klevgo-home-figma-feed-title";
  const FEED_VIEW_ALL_ID = "klevgo-home-figma-feed-view-all";
  const WEATHER_SHELL_ID = "klevgo-home-figma-empty-weather-shell";
  const STYLE_ID = "klevgo-home-figma-empty-ad-shell-style";
  const AD_IMAGE_SRC = "/assets/img/home/home-ad-placeholder-card.png?v=20260626-home-ad-1";
  const STARTED_AT = performance.now();

  const HOME_REDESIGN_ATTRIBUTE = "data-home-redesign";

  function isHomeRedesignEnabled() {
    return document.body?.getAttribute(HOME_REDESIGN_ATTRIBUTE) === "true";
  }

  function leftFromFigma(x) {
    return `calc(var(--klevby-home-content-inset, max(${x}px, calc((100vw - 440px) / 2 + ${x}px))) + ((${x} - 22) * var(--klevby-home-scale, 1)))`;
  }

  function scalePx(value) {
    return `calc(${value}px * var(--klevby-home-scale, 1))`;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${SLOT_ID} {
        position: fixed;
        left: var(--klevby-home-content-inset, ${leftFromFigma(23)});
        top: calc(
          var(--klevby-home-touchbar-top, 847px)
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(75)}
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(243)}
        );
        width: var(--klevby-home-rail-width, min(396px, calc(100vw - (2 * var(--klevby-home-content-inset, 22px)))));
        height: ${scalePx(243)};
        box-sizing: border-box;
        border-radius: 16px;
        background: transparent;
        border: none;
        box-shadow: none;
        overflow: hidden;
        z-index: 2147480000;
        pointer-events: none;
      }

      #${SLOT_ID} img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        pointer-events: none;
      }

      #${SLOT_ID}::before,
      #${SLOT_ID}::after {
        content: none !important;
        display: none !important;
      }

      #${FEED_TITLE_ID} {
        position: fixed;
        left: var(--klevby-home-content-inset, ${leftFromFigma(23)});
        top: calc(
          var(--klevby-home-touchbar-top, 847px)
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(75)}
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(243)}
          - ${scalePx(36)}
        );
        width: 55px;
        height: 24px;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 19px;
        font-weight: 500;
        line-height: 24px;
        letter-spacing: 0;
        color: #FFFFFF;
        white-space: nowrap;
        z-index: 2147480001;
        pointer-events: none;
      }

      #${FEED_VIEW_ALL_ID} {
        position: fixed;
        left: calc(var(--klevby-home-content-inset, 22px) + var(--klevby-home-rail-width, min(396px, calc(100vw - 44px))) - 110px);
        top: calc(
          var(--klevby-home-touchbar-top, 847px)
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(75)}
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(243)}
          - ${scalePx(36)}
        );
        width: 110px;
        height: 23px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        font-weight: 400;
        line-height: 21px;
        letter-spacing: 0;
        color: #FFFFFF;
        white-space: nowrap;
        z-index: 2147480001;
        pointer-events: none;
      }

      #${FEED_VIEW_ALL_ID} img {
        width: 8px;
        height: 14px;
        display: block;
        flex: 0 0 8px;
      }

      #${WEATHER_SHELL_ID} {
        position: fixed;
        left: var(--klevby-home-content-inset, ${leftFromFigma(22)});
        top: calc(
          var(--klevby-home-touchbar-top, 847px)
          - var(--klevby-home-scaled-gap, ${scalePx(12)})
          - ${scalePx(75)}
        );
        width: var(--klevby-home-rail-width, min(396px, calc(100vw - (2 * var(--klevby-home-content-inset, 22px)))));
        height: ${scalePx(75)};
        box-sizing: border-box;
        border-radius: 16px;
        background: #161C20;
        border: 0.9px solid rgba(255, 255, 255, 0.14);
        box-shadow: none;
        overflow: hidden;
        z-index: 2147480000;
        pointer-events: none;
      }

      #${WEATHER_SHELL_ID}::before,
      #${WEATHER_SHELL_ID}::after {
        content: none !important;
        display: none !important;
      }

    `;
    document.head.appendChild(style);
  }

  function isSplashActive() {
    if (document.body?.classList.contains("klevby-splash-active")) {
      return true;
    }

    const splash = document.getElementById("appSplash");
    if (!splash) return false;

    const style = window.getComputedStyle(splash);
    const rect = splash.getBoundingClientRect();

    return (
      !splash.classList.contains("hidden") &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function isHomeVisible() {
    /*
      Figma-aligned live elements are temporary Home-only overlays.
      They must never render during splash/startup and are independent
      from the PNG debug mirror flag.
    */
    if (!isHomeRedesignEnabled()) return false;
    if (isSplashActive()) return false;

    const bodyMode = document.body?.getAttribute("data-app-chrome-mode");
    if (bodyMode !== "home") return false;

    const home = document.getElementById("homeSection");
    if (!home || home.classList.contains("hidden")) return false;

    const style = window.getComputedStyle(home);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }

    const rect = home.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ensureAdShellImage(slot) {
    if (!slot) return;

    let image = slot.querySelector("img");
    if (!image) {
      image = document.createElement("img");
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.decoding = "async";
      slot.appendChild(image);
    }

    if (image.getAttribute("src") !== AD_IMAGE_SRC) {
      image.setAttribute("src", AD_IMAGE_SRC);
    }
  }

  function ensureHomeFigmaElements() {
    ensureStyle();

    let slot = document.getElementById(SLOT_ID);
    if (!slot) {
      slot = document.createElement("div");
      slot.id = SLOT_ID;
      slot.setAttribute("aria-hidden", "true");
      document.body.appendChild(slot);
    }
    ensureAdShellImage(slot);

    let feedTitle = document.getElementById(FEED_TITLE_ID);
    if (!feedTitle) {
      feedTitle = document.createElement("div");
      feedTitle.id = FEED_TITLE_ID;
      feedTitle.setAttribute("aria-hidden", "true");
      feedTitle.textContent = "Лента";
      document.body.appendChild(feedTitle);
    }

    let feedViewAll = document.getElementById(FEED_VIEW_ALL_ID);
    if (!feedViewAll) {
      feedViewAll = document.createElement("div");
      feedViewAll.id = FEED_VIEW_ALL_ID;
      feedViewAll.setAttribute("aria-hidden", "true");
      feedViewAll.innerHTML = '<span>Смотреть всё</span><img src="/assets/icons/figma/home-feed-view-all-chevron.svg" alt="" aria-hidden="true" />';
      document.body.appendChild(feedViewAll);
    }

    let weatherShell = document.getElementById(WEATHER_SHELL_ID);
    if (!weatherShell) {
      weatherShell = document.createElement("div");
      weatherShell.id = WEATHER_SHELL_ID;
      weatherShell.setAttribute("aria-hidden", "true");
      document.body.appendChild(weatherShell);
    }

  }

  function removeHomeFigmaElements() {
    document.getElementById(SLOT_ID)?.remove();
    document.getElementById(FEED_TITLE_ID)?.remove();
    document.getElementById(FEED_VIEW_ALL_ID)?.remove();
    document.getElementById(WEATHER_SHELL_ID)?.remove();
  }

  function sync() {
    if (isHomeVisible()) {
      ensureHomeFigmaElements();
    } else {
      removeHomeFigmaElements();
    }
  }

  sync();
  window.setTimeout(sync, 3000);
  window.setTimeout(sync, 3800);

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("pageshow", sync);
  window.addEventListener("resize", sync);
})();
