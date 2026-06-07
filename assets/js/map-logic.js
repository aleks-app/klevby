(function () {
  const ADMIN_EMAIL = "al822alex@gmail.com";

  /*
    Если карта уже работает — можешь оставить ключ пустым.
    Если Яндекс попросит ключ, вставь его между кавычками.
  */
  const YANDEX_API_KEY = "";

  const DEFAULT_CENTER = [53.9023, 27.5619]; // Минск
  const DEFAULT_ZOOM = 7;

  let mapDb = null;
  let mapInstance = null;
  let mapReady = false;
  let postsCollection = null;
  let spotsCollection = null;
  let pendingSpotCoords = null;
  let cachedFishingSpots = [];
  let activeSpotFilter = "all";
  let mapInitPromise = null;

  let currentMapUser = null;
  let userRefreshPromise = null;
  let lastUserRefreshAt = 0;

  const MAP_AUTH_REFRESH_THROTTLE_MS = 8000;
  const YANDEX_API_LOAD_TIMEOUT_MS = 15000;
  const YANDEX_SCRIPT_SELECTOR = 'script[src*="api-maps.yandex.ru"]';

  const geocodeCache = {};

  function getMainSupabaseClient() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getCentralUser() {
    return (
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  function isCentralAuthGuestAuthoritative() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    if (recentLogout) {
      return true;
    }

    const centralUser = getCentralUser();
    if (centralUser && centralUser.id) {
      return false;
    }

    return Boolean(window.klevbyAuthReady || window.authReady);
  }

  function getMainUser() {
    const centralUser = getCentralUser();
    if (centralUser && centralUser.id) {
      return centralUser;
    }

    if (isCentralAuthGuestAuthoritative()) {
      return null;
    }

    return currentMapUser || null;
  }

  function waitForMainSupabaseClient() {
    return new Promise(function (resolve, reject) {
      let tries = 0;

      const timer = setInterval(function () {
        tries += 1;

        const client = getMainSupabaseClient();

        if (client) {
          clearInterval(timer);
          resolve(client);
          return;
        }

        if (tries > 120) {
          clearInterval(timer);
          reject(new Error("Основной Supabase client не найден для map-logic.js"));
        }
      }, 100);
    });
  }

  function isAuthLockError(error) {
    const message = String(error?.message || error || "").toLowerCase();

    return (
      message.includes("lock") &&
      message.includes("auth-token")
    );
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanTelegram(value) {
    let v = String(value || "").trim();

    v = v.replace(/^@/, "");
    v = v.replace(/^https?:\/\/t\.me\//i, "");
    v = v.replace(/^https?:\/\/telegram\.me\//i, "");
    v = v.replace(/^t\.me\//i, "");
    v = v.split("?")[0];
    v = v.split("/")[0];
    v = v.replace(/[^a-zA-Z0-9_]/g, "");

    return v;
  }

  function isYandexMapsApiUsable() {
    return Boolean(
      window.ymaps &&
      typeof window.ymaps.ready === "function" &&
      typeof window.ymaps.Map === "function" &&
      typeof window.ymaps.GeoObjectCollection === "function" &&
      typeof window.ymaps.Placemark === "function"
    );
  }

  function loadYandexMapsApi() {
    return new Promise(function (resolve, reject) {
      let script = document.querySelector(YANDEX_SCRIPT_SELECTOR);
      let settled = false;

      const finish = function (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);

        if (script) {
          script.removeEventListener("load", handleScriptLoad);
          script.removeEventListener("error", handleScriptError);
        }

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      const waitForYandexReady = function () {
        if (!isYandexMapsApiUsable()) {
          finish(new Error("Yandex Maps API loaded, but ymaps is not usable"));
          return;
        }

        try {
          window.ymaps.ready(function () {
            if (isYandexMapsApiUsable()) {
              finish();
            } else {
              finish(new Error("Yandex Maps API is not usable after ready"));
            }
          });
        } catch (error) {
          finish(error);
        }
      };

      const handleScriptLoad = function () {
        waitForYandexReady();
      };

      const handleScriptError = function () {
        finish(new Error("Yandex Maps API not loaded"));
      };

      const timeoutId = setTimeout(function () {
        finish(new Error("Yandex Maps API load timed out"));
      }, YANDEX_API_LOAD_TIMEOUT_MS);

      if (isYandexMapsApiUsable()) {
        waitForYandexReady();
        return;
      }

      const shouldAppendScript = !script;

      if (shouldAppendScript) {
        script = document.createElement("script");

        const apiKeyPart = YANDEX_API_KEY
          ? "apikey=" + encodeURIComponent(YANDEX_API_KEY) + "&"
          : "";

        script.src = "https://api-maps.yandex.ru/2.1/?" + apiKeyPart + "lang=ru_RU";
        script.async = true;
      }

      script.addEventListener("load", handleScriptLoad);
      script.addEventListener("error", handleScriptError);

      if (shouldAppendScript) {
        document.head.appendChild(script);
      }
    });
  }

  function injectMapStyles() {
    if (document.getElementById("klevby-map-styles")) return;

    const style = document.createElement("style");
    style.id = "klevby-map-styles";

    style.textContent = `
      #mapHint {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 6px 0 8px;
        padding: 9px 12px;
        border: 1px solid rgba(255, 248, 234, 0.08);
        border-radius: 14px;
        background: rgba(24, 25, 23, 0.82);
        color: #fff8ea;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
      }

      .map-hint-icon,
      .map-filter-icon {
        display: block;
        flex: 0 0 auto;
        background-color: currentColor;
        -webkit-mask: var(--map-icon) center / contain no-repeat;
        mask: var(--map-icon) center / contain no-repeat;
      }

      .map-hint-icon {
        width: 18px;
        height: 18px;
        color: #f28c28;
        --map-icon: url("assets/icons/map/location.svg");
      }

      .map-hint-copy {
        min-width: 0;
      }

      .map-hint-title {
        display: block;
        color: #fff8ea;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.15;
      }

      .map-hint-subtitle {
        display: block;
        margin-top: 2px;
        color: rgba(255, 248, 234, 0.68);
        font-size: 11px;
        font-weight: 600;
        line-height: 1.25;
      }

      #mapFilters {
        display: flex;
        gap: 7px;
        width: 100%;
        margin: 0;
        padding: 0 1px 2px;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }

      #mapFilters::-webkit-scrollbar {
        display: none;
      }

      .map-filter-btn {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 6px 10px;
        border: 1px solid rgba(255, 248, 234, 0.1);
        border-radius: 999px;
        background: rgba(24, 25, 23, 0.9);
        color: rgba(255, 248, 234, 0.72);
        font-size: 12px;
        font-weight: 750;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        touch-action: manipulation;
        transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
      }

      .map-filter-icon {
        width: 16px;
        height: 16px;
      }

      .map-filter-icon--all {
        --map-icon: url("assets/icons/map/filter.svg");
      }

      .map-filter-icon--free {
        --map-icon: url("assets/icons/map/free.svg");
      }

      .map-filter-icon--paid {
        --map-icon: url("assets/icons/map/paid.svg");
      }

      .map-filter-icon--good {
        --map-icon: url("assets/icons/map/fish.svg");
      }

      .map-filter-icon--warning {
        --map-icon: url("assets/icons/map/warning.svg");
      }

      .map-filter-btn:hover {
        background: rgba(255, 248, 234, 0.09);
        border-color: rgba(255, 248, 234, 0.16);
        color: #fff8ea;
      }

      .map-filter-btn:focus-visible {
        outline: 2px solid rgba(242, 140, 40, 0.72);
        outline-offset: 2px;
      }

      .map-filter-btn.active {
        background: #f28c28;
        color: #17130e;
        border-color: #f28c28;
      }

      .klevby-map-state {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 24px;
        text-align: center;
        color: rgba(244,251,247,0.82);
        font-size: 16px;
        font-weight: 700;
      }

      .klevby-map-retry {
        min-height: 42px;
        padding: 10px 18px;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #42d986, #1fae68);
        color: #03150c;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .klevby-map-modal {
        position: fixed;
        inset: 0;
        z-index: 70000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0,0,0,0.72);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .klevby-map-modal.open {
        display: flex;
      }

      .klevby-map-modal-card {
        width: min(100%, 520px);
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 24px;
        background:
          radial-gradient(circle at 10% 0%, rgba(66,217,134,0.16), transparent 34%),
          radial-gradient(circle at 95% 0%, rgba(88,183,255,0.13), transparent 36%),
          rgba(10, 18, 23, 0.98);
        box-shadow:
          0 24px 70px rgba(0,0,0,0.54),
          inset 0 1px 0 rgba(255,255,255,0.08);
        color: #f4fbf7;
        padding: 22px;
      }

      .klevby-map-modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
      }

      .klevby-map-modal-title {
        margin: 0;
        font-size: 24px;
        line-height: 1.15;
        letter-spacing: -0.5px;
        font-weight: 800;
      }

      .klevby-map-modal-subtitle {
        margin: 6px 0 0;
        color: rgba(244,251,247,0.62);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 500;
      }

      .klevby-map-modal-close {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        color: #ffffff;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
      }

      .klevby-map-form-label {
        display: block;
        margin: 12px 0 6px;
        color: rgba(244,251,247,0.72);
        font-size: 13px;
        font-weight: 700;
      }

      .klevby-map-input,
      .klevby-map-select,
      .klevby-map-textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(255,255,255,0.08);
        outline: none;
        border-radius: 16px;
        padding: 13px 14px;
        background: rgba(255,255,255,0.065);
        color: #f4fbf7;
        font-size: 15px;
        font-weight: 500;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .klevby-map-input::placeholder,
      .klevby-map-textarea::placeholder {
        color: rgba(244,251,247,0.38);
      }

      .klevby-map-textarea {
        min-height: 96px;
        resize: vertical;
        line-height: 1.5;
      }

      .klevby-map-select option {
        background: #101a20;
        color: #f4fbf7;
      }

      .klevby-map-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .klevby-map-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }

      .klevby-map-save,
      .klevby-map-cancel {
        min-height: 48px;
        border: 0;
        border-radius: 16px;
        padding: 0 16px;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }

      .klevby-map-save {
        flex: 1;
        background: linear-gradient(135deg, #42d986, #1fae68);
        color: #03150c;
      }

      .klevby-map-save:disabled {
        opacity: 0.58;
        cursor: not-allowed;
      }

      .klevby-map-cancel {
        width: 120px;
        background: rgba(255,255,255,0.08);
        color: #f4fbf7;
      }

      .klevby-map-message {
        margin-top: 12px;
        min-height: 18px;
        color: rgba(244,251,247,0.64);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 600;
      }

      .klevby-map-message.error {
        color: #ffd2d2;
      }

      .klevby-balloon-btn {
        display: inline-block;
        margin-top: 8px;
        padding: 8px 10px;
        background: #42d986;
        color: #03150c !important;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 700;
        font-size: 13px;
        border: 0;
        cursor: pointer;
      }

      .klevby-balloon-btn.route {
        background: linear-gradient(135deg, #58b7ff, #42d986);
        color: #03150c !important;
        margin-right: 6px;
      }

      .klevby-balloon-btn.delete {
        background: #e45858;
        color: #ffffff !important;
        margin-left: 0;
      }

      .klevby-balloon-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      @media (max-width: 520px) {
        .klevby-map-modal {
          align-items: flex-end;
          padding: 10px;
          padding-bottom: max(10px, env(safe-area-inset-bottom));
        }

        .klevby-map-modal-card {
          width: 100%;
          max-height: min(90vh, 90dvh);
          padding: 18px;
          border-radius: 22px;
        }

        .klevby-map-row {
          grid-template-columns: 1fr;
        }

        .klevby-map-actions {
          flex-direction: column;
        }

        .klevby-map-cancel {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getMapSurface() {
    const mapSection = document.getElementById("mapSection");
    if (!mapSection) return null;

    return mapSection.querySelector("#map");
  }

  function showMapState(state) {
    if (mapInstance) return;

    const mapSurface = getMapSurface();
    if (!mapSurface) return;

    if (state === "loading") {
      mapSurface.innerHTML = '<div class="klevby-map-state">Загружаем карту…</div>';
      return;
    }

    mapSurface.innerHTML = `
      <div class="klevby-map-state">
        <div>Карта временно недоступна</div>
        <button class="klevby-map-retry" type="button">Повторить</button>
      </div>
    `;

    mapSurface.querySelector(".klevby-map-retry")?.addEventListener("click", function () {
      window.klevbyEnsureMapInitialized?.().catch(function () {});
    });
  }

  function prepareMapContainer() {
    const mapSection = document.getElementById("mapSection");

    if (!mapSection) {
      throw new Error("Не найдена секция #mapSection");
    }

    const mapEl = getMapSurface();

    if (!mapEl) {
      throw new Error("Не найден контейнер #map внутри #mapSection");
    }

    mapEl.innerHTML = "";

    addMapHint(mapSection);
    addMapFilters(mapSection);
    createSpotModal();

    return mapEl;
  }

  function getMapStatusHost(mapSection) {
    const existingHost = mapSection.querySelector("#mapStatusHost");
    if (existingHost) return existingHost;

    const mapScreen = mapSection.querySelector(".map-screen") || mapSection;
    const host = document.createElement("div");
    host.id = "mapStatusHost";
    host.className = "map-status-host";
    host.setAttribute("aria-live", "polite");
    mapScreen.prepend(host);
    return host;
  }

  function getMapFiltersHost(mapSection) {
    const existingHost = mapSection.querySelector("#mapFiltersHost");
    if (existingHost) return existingHost;

    const mapStage = mapSection.querySelector(".map-stage") || mapSection;
    const host = document.createElement("div");
    host.id = "mapFiltersHost";
    host.className = "map-filters-host";
    mapStage.appendChild(host);
    return host;
  }

  function addMapHint(mapSection) {
    if (mapSection.querySelector("#mapHint")) return;

    const hint = document.createElement("div");
    hint.id = "mapHint";

    hint.innerHTML = `
      <span class="map-hint-icon" aria-hidden="true"></span>
      <span class="map-hint-copy">
        <strong class="map-hint-title">Карта ловли</strong>
        <span class="map-hint-subtitle">Нажми на карту, чтобы добавить точку. Сохранение — после входа.</span>
      </span>
    `;

    getMapStatusHost(mapSection).appendChild(hint);
  }

  function addMapFilters(mapSection) {
    if (mapSection.querySelector("#mapFilters")) return;

    const filters = document.createElement("div");
    filters.id = "mapFilters";

    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Фильтры точек на карте");
    filters.innerHTML = `
      <button class="map-filter-btn active" type="button" data-filter="all" aria-pressed="true">
        <span class="map-filter-icon map-filter-icon--all" aria-hidden="true"></span>
        <span>Все точки</span>
      </button>
      <button class="map-filter-btn" type="button" data-filter="free" aria-pressed="false">
        <span class="map-filter-icon map-filter-icon--free" aria-hidden="true"></span>
        <span>Бесплатные</span>
      </button>
      <button class="map-filter-btn" type="button" data-filter="paid" aria-pressed="false">
        <span class="map-filter-icon map-filter-icon--paid" aria-hidden="true"></span>
        <span>Платные</span>
      </button>
      <button class="map-filter-btn" type="button" data-filter="good" aria-pressed="false">
        <span class="map-filter-icon map-filter-icon--good" aria-hidden="true"></span>
        <span>Хороший клёв</span>
      </button>
      <button class="map-filter-btn" type="button" data-filter="warning" aria-pressed="false">
        <span class="map-filter-icon map-filter-icon--warning" aria-hidden="true"></span>
        <span>Осторожно</span>
      </button>
    `;

    getMapFiltersHost(mapSection).appendChild(filters);

    filters.querySelectorAll(".map-filter-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        activeSpotFilter = button.getAttribute("data-filter") || "all";

        filters.querySelectorAll(".map-filter-btn").forEach(function (btn) {
          const isActive = btn === button;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
        });

        renderFishingSpots(cachedFishingSpots);
      });
    });
  }

  function createSpotModal() {
    if (document.getElementById("klevbySpotModal")) return;

    const modal = document.createElement("div");
    modal.id = "klevbySpotModal";
    modal.className = "klevby-map-modal";

    modal.innerHTML = `
      <div class="klevby-map-modal-card" onclick="event.stopPropagation()">
        <div class="klevby-map-modal-head">
          <div>
            <h2 class="klevby-map-modal-title">Добавить точку ловли</h2>
            <p class="klevby-map-modal-subtitle">
              Заполни место, рыбу и описание. После сохранения точка появится на карте.
            </p>
          </div>

          <button class="klevby-map-modal-close" id="klevbySpotCloseBtn" type="button" aria-label="Закрыть">×</button>
        </div>

        <form id="klevbySpotForm">
          <label class="klevby-map-form-label" for="klevbySpotName">Название места</label>
          <input
            id="klevbySpotName"
            class="klevby-map-input"
            placeholder="Например: Минское море, берег возле пляжа"
            autocomplete="off"
          />

          <div class="klevby-map-row">
            <div>
              <label class="klevby-map-form-label" for="klevbySpotFish">Какая рыба водится</label>
              <input
                id="klevbySpotFish"
                class="klevby-map-input"
                placeholder="Щука, окунь, карась"
                autocomplete="off"
              />
            </div>

            <div>
              <label class="klevby-map-form-label" for="klevbySpotType">Тип точки</label>
              <select id="klevbySpotType" class="klevby-map-select">
                <option value="Бесплатное место">Бесплатное место</option>
                <option value="Платное место">Платное место</option>
                <option value="Хороший клёв">Хороший клёв</option>
                <option value="Осторожно">Осторожно</option>
              </select>
            </div>
          </div>

          <label class="klevby-map-form-label" for="klevbySpotDescription">Описание места</label>
          <textarea
            id="klevbySpotDescription"
            class="klevby-map-textarea"
            placeholder="Например: хороший подъезд, берег удобный, лучше работает спиннинг утром..."
          ></textarea>

          <div class="klevby-map-actions">
            <button id="klevbySpotSaveBtn" class="klevby-map-save" type="submit">Сохранить точку</button>
            <button id="klevbySpotCancelBtn" class="klevby-map-cancel" type="button">Отмена</button>
          </div>

          <div id="klevbySpotMessage" class="klevby-map-message"></div>
        </form>
      </div>
    `;

    modal.addEventListener("click", closeSpotModal);

    document.body.appendChild(modal);

    document.getElementById("klevbySpotCloseBtn").addEventListener("click", closeSpotModal);
    document.getElementById("klevbySpotCancelBtn").addEventListener("click", closeSpotModal);

    document.getElementById("klevbySpotForm").addEventListener("submit", function (event) {
      event.preventDefault();
      saveSpotFromModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSpotModal();
      }
    });
  }

  function setSpotMessage(message, isError) {
    const messageEl = document.getElementById("klevbySpotMessage");
    if (!messageEl) return;

    messageEl.textContent = message || "";
    messageEl.classList.toggle("error", Boolean(isError));
  }

  function openSpotModal(coords) {
    pendingSpotCoords = coords;

    const modal = document.getElementById("klevbySpotModal");
    const nameInput = document.getElementById("klevbySpotName");
    const fishInput = document.getElementById("klevbySpotFish");
    const descriptionInput = document.getElementById("klevbySpotDescription");
    const typeInput = document.getElementById("klevbySpotType");
    const saveBtn = document.getElementById("klevbySpotSaveBtn");

    if (!modal || !nameInput || !fishInput || !descriptionInput || !typeInput || !saveBtn) return;

    nameInput.value = "";
    fishInput.value = "";
    descriptionInput.value = "";
    typeInput.value = "Бесплатное место";
    saveBtn.disabled = false;
    saveBtn.textContent = "Сохранить точку";
    setSpotMessage("");

    modal.classList.add("open");

    setTimeout(function () {
      nameInput.focus();
    }, 80);
  }

  function closeSpotModal() {
    const modal = document.getElementById("klevbySpotModal");
    if (!modal) return;

    modal.classList.remove("open");
    pendingSpotCoords = null;
  }

  async function getCurrentUser(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    const mainUser = getMainUser();

    if (!mainUser && isCentralAuthGuestAuthoritative()) {
      currentMapUser = null;
      lastUserRefreshAt = now;
      return null;
    }

    if (mainUser && mainUser.id) {
      currentMapUser = mainUser;
      lastUserRefreshAt = now;
      return currentMapUser;
    }

    if (!mapDb?.auth?.getUser) {
      if (isCentralAuthGuestAuthoritative()) {
        currentMapUser = null;
        return null;
      }
      return getCentralUser() || currentMapUser || null;
    }

    if (!force && currentMapUser && currentMapUser.id && now - lastUserRefreshAt < MAP_AUTH_REFRESH_THROTTLE_MS) {
      if (isCentralAuthGuestAuthoritative()) {
        currentMapUser = null;
        return null;
      }
      return currentMapUser;
    }

    if (!force && userRefreshPromise) {
      return userRefreshPromise;
    }

    lastUserRefreshAt = now;

    userRefreshPromise = (async function () {
      try {
        const userResult = await mapDb.auth.getUser();

        if (userResult.error) {
          if (!isAuthLockError(userResult.error)) {
            console.warn("Klevby map: пользователь не получен:", userResult.error);
          }

          currentMapUser = isCentralAuthGuestAuthoritative() ? null : (getMainUser() || null);
          return currentMapUser;
        }

        currentMapUser = userResult.data && userResult.data.user ? userResult.data.user : null;

        return currentMapUser;
      } catch (error) {
        if (!isAuthLockError(error)) {
          console.warn("Klevby map: ошибка получения пользователя:", error);
        }

        currentMapUser = isCentralAuthGuestAuthoritative() ? null : (getMainUser() || null);
        return currentMapUser;
      } finally {
        userRefreshPromise = null;
      }
    })();

    return userRefreshPromise;
  }

  async function handleMapClick(coords) {
    const user = await getCurrentUser();

    if (!user) {
      alert("Чтобы добавить точку ловли, сначала войди в аккаунт на сайте.");
      return;
    }

    openSpotModal(coords);
  }

  async function saveSpotFromModal() {
    const user = await getCurrentUser({ force: true });

    if (!user) {
      setSpotMessage("Сначала войди в аккаунт на сайте.", true);
      return;
    }

    if (!pendingSpotCoords) {
      setSpotMessage("Не удалось определить координаты точки. Нажми на карту ещё раз.", true);
      return;
    }

    const nameInput = document.getElementById("klevbySpotName");
    const fishInput = document.getElementById("klevbySpotFish");
    const descriptionInput = document.getElementById("klevbySpotDescription");
    const typeInput = document.getElementById("klevbySpotType");
    const saveBtn = document.getElementById("klevbySpotSaveBtn");

    const name = nameInput.value.trim();
    const fish = fishInput.value.trim();
    const description = descriptionInput.value.trim();
    const spotType = typeInput.value.trim() || "Бесплатное место";

    if (!name) {
      setSpotMessage("Напиши название места.", true);
      nameInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохраняю...";
    setSpotMessage("Сохраняем точку на карте...");

    const result = await mapDb
      .from("fishing_spots")
      .insert([
        {
          name,
          description,
          fish,
          spot_type: spotType,
          lat: pendingSpotCoords[0],
          lng: pendingSpotCoords[1],
          owner_id: user.id
        }
      ]);

    if (result.error) {
      console.error(result.error);
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить точку";
      setSpotMessage("Не получилось сохранить точку. Проверь таблицу fishing_spots и RLS.", true);
      return;
    }

    setSpotMessage("Точка добавлена ✅");

    setTimeout(function () {
      closeSpotModal();
    }, 500);

    await loadFishingSpots();
  }

  function createMap(mapEl) {
    if (mapInstance) return mapInstance;

    mapInstance = new ymaps.Map(mapEl, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["geolocationControl", "zoomControl", "fullscreenControl"]
    }, {
      suppressMapOpenBlock: true
    });

    postsCollection = new ymaps.GeoObjectCollection(null, {
      preset: "islands#blueFishingIcon"
    });

    spotsCollection = new ymaps.GeoObjectCollection(null, {
      preset: "islands#greenDotIcon"
    });

    mapInstance.geoObjects.add(spotsCollection);
    mapInstance.geoObjects.add(postsCollection);

    mapInstance.events.add("click", function (event) {
      const coords = event.get("coords");
      handleMapClick(coords);
    });

    mapReady = true;

    setTimeout(function () {
      if (mapInstance && mapInstance.container) {
        mapInstance.container.fitToViewport();
      }
    }, 500);

    return mapInstance;
  }

  async function loadFishingSpots() {
    if (!spotsCollection || !mapDb) return;

    const result = await mapDb
      .from("fishing_spots")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("Ошибка загрузки fishing_spots:", result.error);
      return;
    }

    cachedFishingSpots = result.data || [];
    renderFishingSpots(cachedFishingSpots);
  }

  function renderFishingSpots(spots) {
    if (!spotsCollection) return;

    spotsCollection.removeAll();

    const filtered = filterFishingSpots(spots || []);

    filtered.forEach(function (spot) {
      if (!spot.lat || !spot.lng) return;

      try {
        const placemark = new ymaps.Placemark(
          [spot.lat, spot.lng],
          {
            balloonContent: getFishingSpotBalloonHtml(spot),
            hintContent: escapeHtml(spot.name || "Точка ловли")
          },
          {
            preset: getSpotPreset(spot.spot_type)
          }
        );

        spotsCollection.add(placemark);
      } catch (error) {
        console.warn("Не удалось поставить метку точки ловли:", spot?.id, error);
      }
    });
  }

  function filterFishingSpots(spots) {
    if (activeSpotFilter === "all") return spots;

    return spots.filter(function (spot) {
      const type = String(spot.spot_type || "").toLowerCase();

      if (activeSpotFilter === "free") {
        return type.includes("бесплат");
      }

      if (activeSpotFilter === "paid") {
        return type.includes("плат");
      }

      if (activeSpotFilter === "good") {
        return type.includes("клёв") || type.includes("клев");
      }

      if (activeSpotFilter === "warning") {
        return type.includes("осторож");
      }

      return true;
    });
  }

  function getSpotPreset(spotType) {
    const type = String(spotType || "").toLowerCase();

    if (type.includes("плат")) return "islands#yellowDotIcon";
    if (type.includes("осторож")) return "islands#redDotIcon";
    if (type.includes("клёв") || type.includes("клев")) return "islands#greenDotIcon";

    return "islands#darkGreenDotIcon";
  }

  function getRouteUrl(lat, lng) {
    const safeLat = encodeURIComponent(String(lat));
    const safeLng = encodeURIComponent(String(lng));

    const isMobile = /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);

    if (isMobile) {
      return `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}&travelmode=driving`;
    }

    return `https://yandex.by/maps/?rtext=~${safeLat},${safeLng}&rtt=auto`;
  }

  function getFishingSpotBalloonHtml(spot) {
    const name = escapeHtml(spot.name || "Точка ловли");
    const fish = escapeHtml(spot.fish || "Не указано");
    const description = escapeHtml(spot.description || "Описание не указано");
    const spotType = escapeHtml(spot.spot_type || "Место ловли");
    const safeId = escapeHtml(JSON.stringify(String(spot.id || "")));

    const lat = Number(spot.lat);
    const lng = Number(spot.lng);

    const routeButton = Number.isFinite(lat) && Number.isFinite(lng)
      ? `
        <a
          class="klevby-balloon-btn route"
          href="${escapeHtml(getRouteUrl(lat, lng))}"
          target="_blank"
          rel="noopener noreferrer"
        >
          🧭 Маршрут
        </a>
      `
      : "";

    const deleteButton = `
      <button
        class="klevby-balloon-btn delete"
        onclick="window.klevbyDeleteFishingSpot(${safeId})"
      >
        Удалить
      </button>
    `;

    return `
      <div style="max-width:280px;font-family:Arial,sans-serif;">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">
          🎣 ${name}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Тип:</b> ${spotType}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Рыба:</b> ${fish}
        </div>

        <div style="font-size:13px;line-height:1.4;margin-bottom:8px;">
          ${description}
        </div>

        <div class="klevby-balloon-actions">
          ${routeButton}
          ${deleteButton}
        </div>
      </div>
    `;
  }

  async function loadPostMarkers() {
    if (!postsCollection || !mapDb) return;

    postsCollection.removeAll();

    const result = await mapDb
      .from("posts")
      .select("id, name, city, destination, trip_time, text, telegram, created_at")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("Ошибка загрузки posts:", result.error);
      return;
    }

    const posts = result.data || [];

    for (const post of posts) {
      if (!post.city) continue;

      try {
        const coords = await geocodeCity(post.city);
        if (!coords) continue;

        const placemark = new ymaps.Placemark(
          coords,
          {
            balloonContent: getPostBalloonHtml(post, coords),
            hintContent: escapeHtml((post.name || "Рыбак") + " — " + post.city)
          },
          {
            preset: "islands#blueFishingIcon"
          }
        );

        postsCollection.add(placemark);
      } catch (error) {
        console.warn("Не удалось поставить метку объявления:", post.city, error);
      }
    }
  }

  async function geocodeCity(city) {
    const query = String(city || "").trim() + ", Беларусь";
    const cacheKey = query.toLowerCase();

    if (geocodeCache[cacheKey]) {
      return geocodeCache[cacheKey];
    }

    const result = await ymaps.geocode(query, {
      results: 1
    });

    const firstGeoObject = result.geoObjects.get(0);

    if (!firstGeoObject) {
      return null;
    }

    const coords = firstGeoObject.geometry.getCoordinates();
    geocodeCache[cacheKey] = coords;

    return coords;
  }

  function getPostBalloonHtml(post, coords) {
    const name = escapeHtml(post.name || "Без имени");
    const city = escapeHtml(post.city || "Город не указан");
    const destination = escapeHtml(post.destination || "Куда едет — не указано");
    const tripTime = escapeHtml(post.trip_time || "Когда — не указано");
    const text = escapeHtml(post.text || "Описание не указано");
    const tg = cleanTelegram(post.telegram);

    const telegramButton = tg
      ? `
        <a href="https://t.me/${escapeHtml(tg)}" target="_blank" class="klevby-balloon-btn">
          Написать в Telegram
        </a>
      `
      : "";

    const routeButton = coords && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))
      ? `
        <a
          href="${escapeHtml(getRouteUrl(coords[0], coords[1]))}"
          target="_blank"
          rel="noopener noreferrer"
          class="klevby-balloon-btn route"
        >
          🧭 Маршрут
        </a>
      `
      : "";

    return `
      <div style="max-width:280px;font-family:Arial,sans-serif;">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">
          👤 ${name}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Откуда:</b> ${city}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Куда:</b> ${destination}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Когда:</b> ${tripTime}
        </div>

        <div style="font-size:13px;line-height:1.4;margin-bottom:8px;">
          ${text}
        </div>

        <div class="klevby-balloon-actions">
          ${routeButton}
          ${telegramButton}
        </div>
      </div>
    `;
  }

  async function reloadMapData() {
    if (!mapReady || !mapDb) return;

    const results = await Promise.allSettled([
      loadFishingSpots(),
      loadPostMarkers()
    ]);

    results.forEach(function (result) {
      if (result.status === "rejected") {
        console.warn("Не удалось обновить часть данных карты:", result.reason);
      }
    });

    setTimeout(function () {
      if (mapInstance && mapInstance.container) {
        mapInstance.container.fitToViewport();
      }
    }, 300);
  }

  function refreshMapView() {
    if (!mapInstance) return Promise.resolve();
    return reloadMapData();
  }

  async function deleteFishingSpot(id) {
    const user = await getCurrentUser({ force: true });

    if (!user) {
      alert("Чтобы удалить точку, сначала войди в аккаунт.");
      return;
    }

    const confirmDelete = confirm("Удалить эту точку ловли?");
    if (!confirmDelete) return;

    const result = await mapDb
      .from("fishing_spots")
      .delete()
      .eq("id", id);

    if (result.error) {
      console.error(result.error);
      alert("Не получилось удалить точку. Удалять может только владелец точки или админ.");
      return;
    }

    await loadFishingSpots();
  }

  function cleanupPartialMapInitialization() {
    const partialMap = mapInstance;

    mapInstance = null;
    mapReady = false;
    postsCollection = null;
    spotsCollection = null;

    if (partialMap && typeof partialMap.destroy === "function") {
      try {
        partialMap.destroy();
      } catch (error) {
        console.warn("Не удалось очистить частично созданную карту:", error);
      }
    }
  }

  async function initMapLogic() {
    injectMapStyles();

    const mapEl = prepareMapContainer();
    showMapState("loading");

    mapDb = getMainSupabaseClient();

    if (!mapDb) {
      mapDb = await waitForMainSupabaseClient();
    }

    const mainUser = getMainUser();
    if (mainUser && mainUser.id) {
      currentMapUser = mainUser;
    }

    await loadYandexMapsApi();

    mapEl.innerHTML = "";
    createMap(mapEl);

    window.klevbyReloadMap = refreshMapView;
    window.klevbyDeleteFishingSpot = deleteFishingSpot;

    await reloadMapData();

    console.log("Klevby карта ловли запущена.");
    return mapInstance;
  }

  function ensureMapInitialized() {
    if (mapInitPromise) return mapInitPromise;

    if (mapInstance) {
      return refreshMapView().then(function () {
        return mapInstance;
      });
    }

    mapInitPromise = initMapLogic()
      .then(function (instance) {
        mapInitPromise = null;
        return instance;
      })
      .catch(function (error) {
        mapInitPromise = null;
        cleanupPartialMapInitialization();

        const failedScript = document.querySelector(YANDEX_SCRIPT_SELECTOR);
        if (!isYandexMapsApiUsable() && failedScript) {
          failedScript.remove();
        }

        showMapState("failed");
        console.error("Ошибка запуска карты:", error);
        throw error;
      });

    return mapInitPromise;
  }

  window.klevbyEnsureMapInitialized = ensureMapInitialized;

  window.addEventListener("klevby-auth-changed", function (event) {
    const eventUser = event?.detail?.user || null;

    if (eventUser && eventUser.id) {
      currentMapUser = eventUser;
      return;
    }

    if (isCentralAuthGuestAuthoritative()) {
      currentMapUser = null;
      return;
    }

    const centralUser = getCentralUser();
    currentMapUser = centralUser && centralUser.id ? centralUser : null;
  });
})();
