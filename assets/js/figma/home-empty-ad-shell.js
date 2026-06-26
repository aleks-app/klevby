(() => {
  const SLOT_ID = "klevgo-home-figma-empty-ad-shell";
  const FEED_TITLE_ID = "klevgo-home-figma-feed-title";
  const FEED_VIEW_ALL_ID = "klevgo-home-figma-feed-view-all";
  const WEATHER_SHELL_ID = "klevgo-home-figma-empty-weather-shell";
  const STYLE_ID = "klevgo-home-figma-empty-ad-shell-style";
  const STARTED_AT = performance.now();
  const WEATHER_CONTENT_CLASS = "klevgo-home-figma-weather-content";

  const HOME_REDESIGN_ATTRIBUTE = "data-home-redesign";

  function isHomeRedesignEnabled() {
    return document.body?.getAttribute(HOME_REDESIGN_ATTRIBUTE) === "true";
  }

  function leftFromFigma(x) {
    return `max(${x}px, calc((100vw - 440px) / 2 + ${x}px))`;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${SLOT_ID} {
        position: fixed;
        left: ${leftFromFigma(23)};
        top: 505px;
        width: 396px;
        height: 243px;
        box-sizing: border-box;
        border-radius: 16px;
        background: #161C20;
        border: 0.9px solid rgba(255, 255, 255, 0.14);
        box-shadow: none;
        overflow: hidden;
        z-index: 2147480000;
        pointer-events: none;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${SLOT_ID}::before,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${SLOT_ID}::after {
        content: none !important;
        display: none !important;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${FEED_TITLE_ID} {
        position: fixed;
        left: ${leftFromFigma(23)};
        top: 469px;
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

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${FEED_VIEW_ALL_ID} {
        position: fixed;
        left: ${leftFromFigma(309)};
        top: 469px;
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

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${FEED_VIEW_ALL_ID} img {
        width: 8px;
        height: 14px;
        display: block;
        flex: 0 0 8px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} {
        position: fixed;
        left: ${leftFromFigma(22)};
        top: 760px;
        width: 396px;
        height: 75px;
        box-sizing: border-box;
        border-radius: 16px;
        background: #161C20;
        border: 0.9px solid rgba(255, 255, 255, 0.14);
        box-shadow: none;
        overflow: hidden;
        z-index: 2147480000;
        pointer-events: none;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID}::before,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID}::after {
        content: none !important;
        display: none !important;
      }


      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .${WEATHER_CONTENT_CLASS} {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
        align-items: center;
        column-gap: 16px;
        padding: 12px 20px;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #FEFDFE;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-left,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-right {
        min-width: 0;
        display: flex;
        align-items: center;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-left {
        gap: 12px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-icon {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        display: block;
        object-fit: contain;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-copy,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-right {
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-temp,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-wind {
        font-size: 18px;
        line-height: 22px;
        font-weight: 600;
        white-space: nowrap;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-condition,
      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-pressure {
        margin-top: 3px;
        font-size: 13px;
        line-height: 17px;
        font-weight: 400;
        color: rgba(254, 253, 254, 0.72);
        white-space: nowrap;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"] #homeSection:not(.hidden) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-divider {
        width: 1px;
        height: 42px;
        background: rgba(255, 255, 255, 0.14);
      }

      body:has(#appSplash:not(.hidden)) #homeSection #${WEATHER_SHELL_ID} .${WEATHER_CONTENT_CLASS} {
        display: none;
      }

    `;
    document.head.appendChild(style);
  }


  function readText(selector, fallback) {
    const value = document.querySelector(selector)?.textContent?.trim();
    return value || fallback;
  }

  function syncFigmaWeatherContent() {
    const weatherShell = document.getElementById(WEATHER_SHELL_ID);
    const content = weatherShell?.querySelector(`.${WEATHER_CONTENT_CLASS}`);
    if (!weatherShell || !content) return;

    const legacyIcon = document.getElementById("homeWeatherModeIcon");
    const icon = content.querySelector(".klevgo-home-figma-weather-icon");
    const temp = content.querySelector(".klevgo-home-figma-weather-temp");
    const condition = content.querySelector(".klevgo-home-figma-weather-condition");
    const wind = content.querySelector(".klevgo-home-figma-weather-wind");
    const pressure = content.querySelector(".klevgo-home-figma-weather-pressure");

    if (icon && legacyIcon?.getAttribute("src")) {
      icon.src = legacyIcon.getAttribute("src");
    }

    if (temp) temp.textContent = readText("#homeWeatherTempChip .home-weather-chip-value", "—");
    if (condition) condition.textContent = readText("#homeWeatherCondition", "Облачно");
    if (wind) wind.textContent = readText("#homeWeatherWindChip .home-weather-chip-value", "—");
    if (pressure) pressure.textContent = readText("#homeWeatherPressure", "—");
  }

  function isSplashActive() {
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

  function getWeatherContentHtml() {
    return `
      <div class="${WEATHER_CONTENT_CLASS}" aria-hidden="true">
        <div class="klevgo-home-figma-weather-left">
          <img class="klevgo-home-figma-weather-icon" src="assets/icons/weather/cloud-sun.svg" alt="" decoding="async" />
          <div class="klevgo-home-figma-weather-copy">
            <div class="klevgo-home-figma-weather-temp">—</div>
            <div class="klevgo-home-figma-weather-condition">Облачно</div>
          </div>
        </div>
        <div class="klevgo-home-figma-weather-divider"></div>
        <div class="klevgo-home-figma-weather-right">
          <div class="klevgo-home-figma-weather-wind">—</div>
          <div class="klevgo-home-figma-weather-pressure">—</div>
        </div>
      </div>
    `;
  }

  function ensureHomeFigmaElements() {
    ensureStyle();

    const homeSection = document.getElementById("homeSection");

    let slot = document.getElementById(SLOT_ID);
    if (!slot) {
      slot = document.createElement("div");
      slot.id = SLOT_ID;
      slot.setAttribute("aria-hidden", "true");
      homeSection?.appendChild(slot);
    }

    let feedTitle = document.getElementById(FEED_TITLE_ID);
    if (!feedTitle) {
      feedTitle = document.createElement("div");
      feedTitle.id = FEED_TITLE_ID;
      feedTitle.setAttribute("aria-hidden", "true");
      feedTitle.textContent = "Лента";
      homeSection?.appendChild(feedTitle);
    }

    let feedViewAll = document.getElementById(FEED_VIEW_ALL_ID);
    if (!feedViewAll) {
      feedViewAll = document.createElement("div");
      feedViewAll.id = FEED_VIEW_ALL_ID;
      feedViewAll.setAttribute("aria-hidden", "true");
      feedViewAll.innerHTML = '<span>Смотреть всё</span><img src="/assets/icons/figma/home-feed-view-all-chevron.svg" alt="" aria-hidden="true" />';
      homeSection?.appendChild(feedViewAll);
    }

    let weatherShell = document.getElementById(WEATHER_SHELL_ID);
    if (!weatherShell) {
      weatherShell = document.createElement("div");
      weatherShell.id = WEATHER_SHELL_ID;
      weatherShell.setAttribute("aria-hidden", "true");
    }

    if (homeSection && weatherShell.parentElement !== homeSection) {
      homeSection.appendChild(weatherShell);
    }

    if (!weatherShell.querySelector(`.${WEATHER_CONTENT_CLASS}`)) {
      weatherShell.innerHTML = getWeatherContentHtml();
    }

    syncFigmaWeatherContent();
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
  window.addEventListener("klevgo-home-weather-updated", syncFigmaWeatherContent);
})();
