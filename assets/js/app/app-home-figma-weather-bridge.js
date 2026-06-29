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
    biteValue: "Средний",
    biteDescription: "Прогноз средний, нужно пробовать.",
  };

  let weatherMode = "weather";
  let activeSource = "missing-state";

  function getWeatherState() {
    const state = window.KlevGoWeatherState;
    return state && typeof state === "object" ? state : null;
  }

  function updateDebug({ source, state }) {
    window.KLEVGO_FIGMA_WEATHER_BRIDGE_DEBUG = {
      source,
      lastState: state ? { ...state } : null,
      lastRenderAt: new Date().toISOString(),
    };
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
        position: relative;
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
        gap: 8px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-right {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 5px;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-icon {
        width: 34px;
        height: 34px;
        display: block;
        flex: 0 0 34px;
        object-fit: contain;
        transform: translateY(-1px);
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        transform: translateY(2px);
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-temp {
        font-size: 20px;
        font-weight: 600;
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

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-wind-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-wind-icon {
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        display: block;
        object-fit: contain;
        opacity: 0.9;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-chevron {
        position: absolute;
        right: 18px;
        top: 50%;
        transform: translateY(-50%);
        width: 8px;
        height: 14px;
        display: block;
        border: 0;
        padding: 0;
        appearance: none;
        -webkit-appearance: none;
        background: #FF8D28;
        -webkit-mask: url("/assets/icons/figma/home-feed-view-all-chevron.svg") center / contain no-repeat;
        mask: url("/assets/icons/figma/home-feed-view-all-chevron.svg") center / contain no-repeat;
        pointer-events: auto;
        cursor: pointer;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[data-weather-mode="bite"] .klevgo-home-figma-weather-chevron {
        transform: translateY(-50%) scaleX(-1);
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-bite {
        display: none;
        grid-column: 1 / -1;
        min-width: 0;
        box-sizing: border-box;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[data-weather-mode="bite"] .klevgo-home-figma-weather-left,
      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[data-weather-mode="bite"] .klevgo-home-figma-weather-divider,
      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[data-weather-mode="bite"] .klevgo-home-figma-weather-right {
        display: none !important;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .${CONTENT_CLASS}[data-weather-mode="bite"] .klevgo-home-figma-weather-bite {
        display: block;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-bite-content {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        width: 100%;
        padding-right: 20px;
        box-sizing: border-box;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-weather-bite-icon {
        width: 30px;
        height: 30px;
        display: block;
        flex: 0 0 30px;
        object-fit: contain;
        opacity: 0.9;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-bite-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-bite-title {
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
        color: #FFFFFF;
        white-space: nowrap;
      }

      body[data-home-redesign="true"][data-app-chrome-mode="home"]:has(#homeSection:not(.hidden)) #${WEATHER_SHELL_ID} .klevgo-home-figma-bite-description {
        margin-top: 2px;
        font-size: 13px;
        font-weight: 400;
        line-height: 17px;
        color: rgba(255, 255, 255, 0.72);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
  }

  function getWeatherValuesFromState(state) {
    return {
      iconSrc: state?.iconSrc || "assets/icons/weather/cloud-sun.svg",
      temp: state?.tempText || FALLBACKS.temp,
      condition: state?.conditionText || FALLBACKS.condition,
      wind: state?.windText || FALLBACKS.wind,
      pressure: state?.pressureText || FALLBACKS.pressure,
    };
  }

  function getBiteValuesFromState(state) {
    return {
      iconSrc: state?.biteIconSrc || "assets/icons/weather/fish-light.svg",
      value: state?.biteTitle || FALLBACKS.biteValue,
      description: state?.biteDescription || FALLBACKS.biteDescription,
    };
  }

  function getBridgeDataSource() {
    const state = getWeatherState();

    return {
      source: state ? "state" : "missing-state",
      state,
      weather: getWeatherValuesFromState(state),
      bite: getBiteValuesFromState(state),
    };
  }

  function sanitizeBiteText(text) {
    return String(text || "")
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatBiteTitle(value) {
    const cleanValue = sanitizeBiteText(value) || FALLBACKS.biteValue;
    return `Клёв: ${cleanValue}`;
  }

  function formatBiteDescription(description) {
    return sanitizeBiteText(description) || FALLBACKS.biteDescription;
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
        <div class="klevgo-home-figma-weather-wind-row">
          <img class="klevgo-home-figma-weather-wind-icon" src="assets/icons/weather/wind-light.svg" alt="" decoding="async" />
          <div class="klevgo-home-figma-weather-wind"></div>
        </div>
        <div class="klevgo-home-figma-weather-pressure"></div>
      </div>
      <div class="klevgo-home-figma-weather-bite">
        <div class="klevgo-home-figma-bite-content">
          <img class="klevgo-home-figma-weather-bite-icon" src="assets/icons/weather/fish-light.svg" alt="" decoding="async" />
          <div class="klevgo-home-figma-bite-copy">
            <div class="klevgo-home-figma-bite-title"></div>
            <div class="klevgo-home-figma-bite-description"></div>
          </div>
        </div>
      </div>
      <button type="button" class="klevgo-home-figma-weather-chevron" aria-label="Показать прогноз клёва"></button>
    `;
    shell.appendChild(content);
    return content;
  }

  function applyMode(content) {
    content.setAttribute("data-weather-mode", weatherMode);

    const chevron = content.querySelector(".klevgo-home-figma-weather-chevron");
    if (chevron) {
      chevron.setAttribute(
        "aria-label",
        weatherMode === "weather" ? "Показать прогноз клёва" : "Вернуться к погоде",
      );
    }
  }

  function ensureBiteStructure(content) {
    let biteRoot = content.querySelector(".klevgo-home-figma-weather-bite");
    if (!biteRoot) {
      biteRoot = document.createElement("div");
      biteRoot.className = "klevgo-home-figma-weather-bite";

      const chevron = content.querySelector(".klevgo-home-figma-weather-chevron");
      if (chevron) {
        content.insertBefore(biteRoot, chevron);
      } else {
        content.appendChild(biteRoot);
      }
    }

    if (!biteRoot.querySelector(".klevgo-home-figma-bite-content")) {
      biteRoot.innerHTML = `
        <div class="klevgo-home-figma-bite-content">
          <img class="klevgo-home-figma-weather-bite-icon" src="assets/icons/weather/fish-light.svg" alt="" decoding="async" />
          <div class="klevgo-home-figma-bite-copy">
            <div class="klevgo-home-figma-bite-title"></div>
            <div class="klevgo-home-figma-bite-description"></div>
          </div>
        </div>
      `;
    }

    let chevron = content.querySelector(".klevgo-home-figma-weather-chevron");
    if (chevron && chevron.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "klevgo-home-figma-weather-chevron";
      button.setAttribute("aria-label", "Показать прогноз клёва");
      chevron.replaceWith(button);
      chevron = button;
    }

    if (chevron && content.dataset.chevronBound !== "true") {
      chevron.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        weatherMode = weatherMode === "weather" ? "bite" : "weather";
        applyMode(content);
        updateContent(content);
      });
      content.dataset.chevronBound = "true";
    }

    applyMode(content);
  }

  function updateContent(content) {
    const dataSource = getBridgeDataSource();
    activeSource = dataSource.source;

    if (weatherMode === "bite") {
      const bite = dataSource.bite;
      const biteIcon = content.querySelector(".klevgo-home-figma-weather-bite-icon");

      if (biteIcon && biteIcon.getAttribute("src") !== bite.iconSrc) {
        biteIcon.setAttribute("src", bite.iconSrc);
      }

      setTextIfChanged(content.querySelector(".klevgo-home-figma-bite-title"), formatBiteTitle(bite.value));
      setTextIfChanged(content.querySelector(".klevgo-home-figma-bite-description"), formatBiteDescription(bite.description));
      updateDebug({ source: activeSource, state: dataSource.state });
      return;
    }

    const values = dataSource.weather;
    const icon = content.querySelector(".klevgo-home-figma-weather-icon");

    if (icon && icon.getAttribute("src") !== values.iconSrc) {
      icon.setAttribute("src", values.iconSrc);
    }

    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-temp"), values.temp);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-condition"), values.condition);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-wind"), values.wind);
    setTextIfChanged(content.querySelector(".klevgo-home-figma-weather-pressure"), values.pressure);
    updateDebug({ source: activeSource, state: dataSource.state });
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
    ensureBiteStructure(ensuredContent);
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
  window.addEventListener("klevgo:weather-updated", sync);
})();
