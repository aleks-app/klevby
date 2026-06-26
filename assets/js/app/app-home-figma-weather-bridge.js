(() => {
  const WEATHER_SHELL_ID = "klevgo-home-figma-empty-weather-shell";
  const CONTENT_CLASS = "klevgo-home-figma-weather-content";
  const STYLE_ID = "klevgo-home-figma-weather-bridge-style";
  const SYNC_INTERVAL_MS = 1000;
  const SYNC_INTERVAL_LIMIT = 20;

  const FALLBACKS = {
    temp: "—",
    condition: "Облачно",
    wind: "—",
    pressure: "—",
  };

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

  function isHomeRedesignVisible() {
    if (document.body?.getAttribute("data-home-redesign") !== "true") return false;
    if (document.body?.getAttribute("data-app-chrome-mode") !== "home") return false;
    if (isSplashActive()) return false;

    const home = document.getElementById("homeSection");
    if (!home || home.classList.contains("hidden")) return false;

    const style = window.getComputedStyle(home);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }

    const rect = home.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[hidden] {
        display: none !important;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS} {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
        align-items: center;
        column-gap: 14px;
        padding: 12px 18px;
        color: #ffffff;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-left,
      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-right {
        min-width: 0;
        display: flex;
        align-items: center;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-left {
        gap: 10px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-right {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 5px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-icon {
        width: 38px;
        height: 38px;
        display: block;
        flex: 0 0 38px;
        object-fit: contain;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-temp {
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-condition,
      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-pressure {
        overflow: hidden;
        color: rgba(255, 255, 255, 0.72);
        font-size: 12px;
        font-weight: 500;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-divider {
        width: 1px;
        height: 42px;
        background: rgba(255, 255, 255, 0.14);
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-wind {
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.1;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function getText(selector, fallback) {
    const value = document.querySelector(selector)?.textContent?.trim();
    return value || fallback;
  }

  function getWeatherValues() {
    return {
      iconSrc: document.getElementById("homeWeatherModeIcon")?.getAttribute("src") || "assets/icons/weather/cloud-sun.svg",
      temp: getText("#homeWeatherTempChip .home-weather-chip-value", FALLBACKS.temp),
      condition: getText("#homeWeatherCondition", FALLBACKS.condition),
      wind: getText("#homeWeatherWindChip .home-weather-chip-value", FALLBACKS.wind),
      pressure: getText("#homeWeatherPressure", FALLBACKS.pressure),
    };
  }

  function setTextIfChanged(element, value) {
    if (!element) return;

    if (element.textContent !== value) {
      element.textContent = value;
    }
  }

  function ensureContent(shell) {
    let content = shell.querySelector(`.${CONTENT_CLASS}`);
    if (content) return content;

    content = document.createElement("div");
    content.className = CONTENT_CLASS;
    content.setAttribute("aria-hidden", "true");
    content.innerHTML = `
      <div class="klevgo-home-figma-weather-left">
        <img class="klevgo-home-figma-weather-icon" alt="" decoding="async" />
        <div class="klevgo-home-figma-weather-copy">
          <div class="klevgo-home-figma-weather-temp"></div>
          <div class="klevgo-home-figma-weather-condition"></div>
        </div>
      </div>
      <div class="klevgo-home-figma-weather-divider" aria-hidden="true"></div>
      <div class="klevgo-home-figma-weather-right">
        <div class="klevgo-home-figma-weather-wind"></div>
        <div class="klevgo-home-figma-weather-pressure"></div>
      </div>
    `;
    shell.appendChild(content);
    return content;
  }

  function updateContent(content) {
    const values = getWeatherValues();
    const icon = content.querySelector(".klevgo-home-figma-weather-icon");

    if (icon && icon.getAttribute("src") !== values.iconSrc) {
      icon.setAttribute("src", values.iconSrc);
    }

    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-temp"), values.temp);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-condition"), values.condition);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-wind"), values.wind);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-pressure"), values.pressure);
  }

  function sync() {
    const shell = document.getElementById(WEATHER_SHELL_ID);
    const content = shell?.querySelector(`.${CONTENT_CLASS}`);

    if (!isHomeRedesignVisible()) {
      if (content) content.hidden = true;
      return;
    }

    if (!shell) return;

    ensureStyle();
    const ensuredContent = ensureContent(shell);
    ensuredContent.hidden = false;
    updateContent(ensuredContent);
  }

  sync();

  let intervalCount = 0;
  const intervalId = window.setInterval(() => {
    intervalCount += 1;
    sync();

    if (intervalCount >= SYNC_INTERVAL_LIMIT) {
      window.clearInterval(intervalId);
    }
  }, SYNC_INTERVAL_MS);

  const observer = new MutationObserver((mutations) => {
    const shell = document.getElementById(WEATHER_SHELL_ID);

    if (shell && mutations.every((mutation) => shell.contains(mutation.target))) {
      return;
    }

    sync();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ["class", "data-home-redesign", "data-app-chrome-mode", "src"],
  });

  window.addEventListener("pageshow", sync);
  window.addEventListener("resize", sync);
})();
