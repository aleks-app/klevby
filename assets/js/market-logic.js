(function () {
  function markKlevbyResumeDebug(source, reason, detail = {}) {
    const api = window.KlevbyResumeDebug;
    if (!api || typeof api.mark !== "function") return null;
    try {
      return api.mark(source, reason, detail);
    } catch (error) {
      return null;
    }
  }

  let marketDb = null;
  let marketItems = [];
  let marketOwnerItems = [];
  let marketUser = null;
  let editingMarketId = null;
  let marketRendered = false;

  let marketUserRefreshPromise = null;
  let marketLastUserRefreshAt = 0;
  let marketLoadPromise = null;
  let marketLoadStartedAt = 0;
  let marketLoadTimer = null;
  let marketPendingForceReload = false;
  let marketRealtimeChannel = null;
  let marketHasPendingNewItems = false;
  let marketOpenDetailsItemId = null;
  let marketLastResumeRecoverAt = 0;
  let marketLastSuccessfulLoadAt = 0;
  let marketViewMode = "all";
  let marketOwnerTab = "active";
  let marketPreparedPhotoFile = null;
  let marketPreparedPhotoPreviewUrl = "";
  let marketPhotoInvalid = false;
  let marketSelectedPhotoFile = null;
  let marketSaveInProgress = false;
  let marketOwnerActionsExpanded = false;
  let marketOwnerActionsReturnScrollTop = null;

  const MARKET_AUTH_REFRESH_THROTTLE_MS = 3000;
  const MARKET_LOAD_RETRY_DELAY_MS = 900;
  const MARKET_AUTH_TIMEOUT_MS = 7000;
  const MARKET_LOAD_TIMEOUT_MS = 9000;
  const MARKET_STALE_LOAD_MS = 12000;
  const MARKET_RESUME_RECOVER_THROTTLE_MS = 1500;
  const MARKET_RESUME_RELOAD_COOLDOWN_MS = 90000;

  const MARKET_REALTIME_CHANNEL_NAME = "klevby-market-items-live";
  const MARKET_REALTIME_OWNER = "market";
  const MARKET_REALTIME_PURPOSE = "items-realtime";


  function getMainSupabaseClient() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }


  function getRealtimeManagerSafe() {
    const manager = window.KlevbySupabaseRealtimeManager;
    if (!manager || typeof manager !== "object") return null;
    return manager;
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

    return marketUser || null;
  }

  function withMarketTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      let settled = false;
      const timeout = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("MARKET_TIMEOUT:" + String(label || "operation")));
      }, Math.max(1, Number(ms) || 1));

      Promise.resolve(promise)
        .then(function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(value);
        })
        .catch(function (error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  function waitForMarketClient() {
    return new Promise(function (resolve, reject) {
      let tries = 0;

      const timer = setInterval(function () {
        tries++;

        const client = getMainSupabaseClient();

        if (client) {
          clearInterval(timer);
          resolve(client);
          return;
        }

        if (tries > 100) {
          clearInterval(timer);
          reject(new Error("Основной Supabase client не найден"));
        }
      }, 100);
    });
  }

  function refreshMarketDbBinding() {
    const latestClient = getMainSupabaseClient();

    if (latestClient && latestClient !== marketDb) {
      marketDb = latestClient;
    } else if (!marketDb && latestClient) {
      marketDb = latestClient;
    }

    return marketDb;
  }



  function isMarketItemPubliclyVisible(item) {
    if (!item || typeof item !== "object") return false;
    if (String(item.status || "").trim().toLowerCase() !== "active") return false;

    const expiresAtRaw = item.expires_at;
    if (!expiresAtRaw) return false;

    const expiresAtTs = Date.parse(expiresAtRaw);
    if (!Number.isFinite(expiresAtTs)) return false;

    return expiresAtTs > Date.now();
  }
  function getMarketSupabaseRestConfig() {
    const config = window.KLEVB_CONFIG || {};
    const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "").trim().replace(/\/$/, "");
    const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();

    if (!supabaseUrl || !supabaseAnonKey) return null;

    return { supabaseUrl, supabaseAnonKey };
  }

  async function loadMarketItemsViaRest() {
    const restConfig = getMarketSupabaseRestConfig();
    if (!restConfig) {
      throw new Error("MARKET_REST_CONFIG_MISSING");
    }

    const nowIso = new Date().toISOString();
    const endpoint = `${restConfig.supabaseUrl}/rest/v1/market_items?select=*&status=eq.active&expires_at=gt.${encodeURIComponent(nowIso)}&order=created_at.desc`;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, MARKET_LOAD_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: restConfig.supabaseAnonKey,
          Authorization: `Bearer ${restConfig.supabaseAnonKey}`
        },
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        throw new Error("MARKET_REST_HTTP_" + response.status);
      }

      const data = await response.json();
      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      const aborted = error?.name === "AbortError";
      if (aborted) {
        throw new Error("MARKET_TIMEOUT:market_items_rest");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadOwnerMarketItemsViaRest(ownerId) {
    const restConfig = getMarketSupabaseRestConfig();
    if (!restConfig) throw new Error("MARKET_REST_CONFIG_MISSING");

    const accessToken = await getMarketAccessToken();
    if (!accessToken) throw new Error("MARKET_AUTH_REQUIRED");

    const endpoint = `${restConfig.supabaseUrl}/rest/v1/market_items?select=*&owner_id=eq.${encodeURIComponent(String(ownerId))}&order=created_at.desc`;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, MARKET_LOAD_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: restConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`
        },
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) throw new Error("MARKET_OWNER_REST_HTTP_" + response.status);
      const data = await response.json();
      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("MARKET_TIMEOUT:market_owner_items_rest");
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function readMarketSessionFromStorage() {
    try {
      const config = window.KLEVB_CONFIG || {};
      const storageKey = String(config.SUPABASE_STORAGE_KEY || window.SUPABASE_STORAGE_KEY || "sb-klevby-auth-token").trim();
      if (!storageKey) return null;

      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;

      return parsed;
    } catch (error) {
      console.warn("Klevby барахолка: не удалось прочитать session из localStorage:", error);
      return null;
    }
  }

  function isMarketTokenExpired(expiresAt) {
    if (!expiresAt) return false;

    const expiresAtNum = Number(expiresAt);
    if (!Number.isFinite(expiresAtNum) || expiresAtNum <= 0) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    return expiresAtNum <= nowSeconds + 5;
  }

  function extractTokenFromMarketSessionShape(candidate) {
    if (!candidate || typeof candidate !== "object") return "";

    const possibleSessions = [
      candidate,
      candidate.currentSession,
      candidate.session,
      candidate.data?.session,
      candidate.data?.currentSession
    ];

    for (const entry of possibleSessions) {
      if (!entry || typeof entry !== "object") continue;
      const token = String(entry.access_token || "").trim();
      if (!token) continue;
      if (isMarketTokenExpired(entry.expires_at)) continue;
      return token;
    }

    const directToken = String(candidate.access_token || "").trim();
    if (directToken && !isMarketTokenExpired(candidate.expires_at)) {
      return directToken;
    }

    return "";
  }

  async function getMarketAccessToken() {
    refreshMarketDbBinding();

    const storedSession = readMarketSessionFromStorage();
    const tokenFromStorage = extractTokenFromMarketSessionShape(storedSession);
    if (tokenFromStorage) return tokenFromStorage;

    const globalSessionCandidates = [
      window.klevbySession,
      window.currentSession,
      window.supabaseSession,
      window.klevbyAuthSession
    ];
    for (const candidate of globalSessionCandidates) {
      const token = extractTokenFromMarketSessionShape(candidate);
      if (token) return token;
    }

    try {
      if (marketDb?.auth?.getSession) {
        const sessionResult = await withMarketTimeout(
          marketDb.auth.getSession(),
          MARKET_AUTH_TIMEOUT_MS,
          "auth.getSession"
        );

        const tokenFromSdk = extractTokenFromMarketSessionShape(sessionResult);
        if (tokenFromSdk) return tokenFromSdk;
      }
    } catch (error) {
      console.warn("Klevby барахолка: не удалось получить access token из SDK:", error);
    }

    return "";
  }

  async function marketRestWrite(method, query, body, label) {
    const restConfig = getMarketSupabaseRestConfig();
    if (!restConfig) throw new Error("MARKET_REST_CONFIG_MISSING");

    const accessToken = await getMarketAccessToken();
    if (!accessToken) throw new Error("MARKET_AUTH_REQUIRED");

    const endpoint = `${restConfig.supabaseUrl}/rest/v1/market_items${query || ""}`;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, MARKET_LOAD_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: restConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=representation"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        throw new Error(`MARKET_REST_WRITE_HTTP_${response.status}:${label}`);
      }

      if (response.status === 204) return { data: [], error: null };
      const data = await response.json();
      return { data: Array.isArray(data) ? data : [data], error: null };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`MARKET_TIMEOUT:${label}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function insertMarketItemViaRest(payload) {
    return marketRestWrite("POST", "", payload, "market_items_insert_rest");
  }

  function updateMarketItemViaRest(id, ownerId, payload) {
    const query = `?id=eq.${encodeURIComponent(String(id))}&owner_id=eq.${encodeURIComponent(String(ownerId))}`;
    return marketRestWrite("PATCH", query, payload, "market_items_update_rest");
  }

  function deleteMarketItemViaRest(id, ownerId) {
    const query = `?id=eq.${encodeURIComponent(String(id))}&owner_id=eq.${encodeURIComponent(String(ownerId))}`;
    return marketRestWrite("DELETE", query, null, "market_items_delete_rest");
  }

  const marketUtils = window.KlevbyMarket || {};
  const marketUiState = { marketFormOpen: false, marketFiltersOpen: false };

  function getMarketUiHelpers() {
    return window.KlevbyMarket || {};
  }

  function isAuthLockError(error) {
    if (typeof marketUtils.isAuthLockError === "function") {
      return marketUtils.isAuthLockError(error);
    }

    const message = String(error?.message || error || "").toLowerCase();

    return (
      message.includes("lock") &&
      message.includes("auth-token")
    );
  }

  function escapeHtml(value) {
    if (typeof marketUtils.escapeHtml === "function") {
      return marketUtils.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanTelegram(value) {
    const marketContacts = window.KlevbyMarket || {};

    if (typeof marketContacts.cleanMarketContact === "function") {
      return marketContacts.cleanMarketContact(value);
    }

    if (typeof marketUtils.cleanTelegram === "function") {
      return marketUtils.cleanTelegram(value);
    }

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

  function normalizeText(value) {
    if (typeof marketUtils.normalizeText === "function") {
      return marketUtils.normalizeText(value);
    }

    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
  }

  function getSearchTokens(value) {
    return normalizeText(value)
      .split(/[^a-zа-я0-9]+/i)
      .map(function (token) { return token.trim(); })
      .filter(Boolean);
  }

  function normalizeRuTokenStem(token) {
    const safe = String(token || "").trim();
    if (!safe) return "";
    if (safe.length <= 3) return safe;

    const suffixes = ["иями", "ями", "ами", "ией", "ией", "ого", "ему", "ому", "ыми", "ими", "ать", "ять", "ешь", "ите", "ов", "ев", "ей", "ой", "ий", "ый", "ая", "яя", "ое", "ее", "ам", "ям", "ах", "ях", "ом", "ем", "ую", "юю", "ы", "и", "а", "я", "е", "о", "у", "ю"];

    for (const suffix of suffixes) {
      if (safe.length - suffix.length < 3) continue;
      if (safe.endsWith(suffix)) {
        return safe.slice(0, -suffix.length);
      }
    }

    return safe;
  }

  function isSmartSearchMatch(searchValue, haystackValue) {
    const search = normalizeText(searchValue);
    const haystack = normalizeText(haystackValue);
    if (!search) return true;
    if (!haystack) return false;

    if (haystack.includes(search)) return true;

    const searchTokens = getSearchTokens(search);
    if (!searchTokens.length) return haystack.includes(search);

    const haystackTokens = getSearchTokens(haystack);
    if (!haystackTokens.length) return false;

    const haystackStems = haystackTokens.map(normalizeRuTokenStem);

    return searchTokens.every(function (searchToken) {
      if (haystack.includes(searchToken)) return true;

      const searchStem = normalizeRuTokenStem(searchToken);
      if (!searchStem || searchStem.length < 3) return false;

      return haystackTokens.some(function (token, index) {
        if (token.startsWith(searchStem)) return true;
        const stem = haystackStems[index] || "";
        return stem.startsWith(searchStem) || searchStem.startsWith(stem);
      });
    });
  }

  function getSpoonSearchStem(token) {
    const safe = normalizeText(token);
    if (safe === "бле" || safe.startsWith("блес")) return "блес";
    return "";
  }

  function isSpoonTitleSearchMatch(searchValue, titleValue) {
    const searchTokens = getSearchTokens(searchValue);
    const titleTokens = getSearchTokens(titleValue);
    if (!searchTokens.length || !titleTokens.length) return false;

    return searchTokens.every(function (searchToken) {
      const searchStem = getSpoonSearchStem(searchToken);
      if (!searchStem) return false;

      return titleTokens.some(function (titleToken) {
        return getSpoonSearchStem(titleToken) === searchStem;
      });
    });
  }

  const MARKET_CATEGORY_SEARCH_RULES = [
    {
      aliases: ["приманки", "приманка"],
      categories: ["Приманки"],
      matchType: "category"
    },
    {
      aliases: ["блесна", "блесны", "блесен", "бле"],
      categories: ["Приманки"],
      matchType: "title"
    },
    {
      aliases: ["катушки", "катушка"],
      categories: ["Катушки"],
      matchType: "category"
    },
    {
      aliases: ["лодки", "лодка", "пвх"],
      categories: ["Лодки"],
      matchType: "category"
    },
    {
      aliases: ["эхолоты", "эхолот"],
      categories: ["Эхолоты"],
      matchType: "category"
    }
  ];

  function getMarketCategorySearchRule(searchValue) {
    const search = normalizeText(searchValue);
    if (!search) return null;

    return MARKET_CATEGORY_SEARCH_RULES.find(function (rule) {
      return rule.aliases.some(function (alias) {
        return search === normalizeText(alias);
      });
    }) || null;
  }

  function isMarketItemInSearchCategory(item, rule) {
    if (!rule) return false;

    return rule.categories.some(function (categoryName) {
      return normalizeText(item.category) === normalizeText(categoryName);
    });
  }

  function isMarketItemSearchMatch(item, search) {
    const categoryRule = getMarketCategorySearchRule(search);
    if (categoryRule) {
      if (categoryRule.matchType === "category") {
        return isMarketItemInSearchCategory(item, categoryRule);
      }

      if (categoryRule.matchType === "title") {
        return isMarketItemInSearchCategory(item, categoryRule) && isSpoonTitleSearchMatch(search, item.title);
      }

      return false;
    }

    return (
      isSmartSearchMatch(search, item.title) ||
      isSmartSearchMatch(search, item.description) ||
      isSmartSearchMatch(search, item.category) ||
      isSmartSearchMatch(search, item.city) ||
      isSmartSearchMatch(search, item.price)
    );
  }

  function getMarketImage(item) {
    if (typeof marketUtils.getMarketImage === "function") {
      return marketUtils.getMarketImage(item);
    }

    const image = String(item.image_url || "").trim();

    if (image) return image;

    return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80";
  }

  function injectMarketStyles() {
    if (window.KlevbyMarket && typeof window.KlevbyMarket.injectMarketStyles === "function") {
      window.KlevbyMarket.injectMarketStyles();
      return;
    }

    console.warn("Klevby барахолка: market-styles.js не загружен");
  }

  function updateMarketUiState() {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.updateMarketUiState === "function") {
      marketUi.updateMarketUiState(marketUiState);
      return;
    }

    const formBox = document.getElementById("marketFormBox");
    const filtersBox = document.getElementById("marketFiltersBox");
    const formBtn = document.getElementById("marketToggleFormBtn");
    const filtersBtn = document.getElementById("marketToggleFiltersBtn");
    const searchFiltersBtn = document.getElementById("marketSearchFiltersBtn");

    if (formBox) {
      formBox.classList.toggle("hidden", !marketUiState.marketFormOpen);
    }

    if (filtersBox) {
      filtersBox.classList.toggle("hidden", !marketUiState.marketFiltersOpen);
    }

    if (formBtn) {
      formBtn.textContent = marketUiState.marketFormOpen ? "Скрыть форму" : "+ Добавить товар";
      formBtn.setAttribute("aria-expanded", String(marketUiState.marketFormOpen));
    }

    if (filtersBtn) {
      filtersBtn.textContent = marketUiState.marketFiltersOpen ? "Скрыть фильтры" : "Фильтр";
      filtersBtn.setAttribute("aria-expanded", String(marketUiState.marketFiltersOpen));
    }

    if (searchFiltersBtn) {
      searchFiltersBtn.setAttribute("aria-expanded", String(marketUiState.marketFiltersOpen));
    }
  }

  function setMarketFormOpen(open, options = {}) {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.setMarketFormOpen === "function") {
      marketUi.setMarketFormOpen(marketUiState, open, options);
      return;
    }

    marketUiState.marketFormOpen = Boolean(open);
    updateMarketUiState();

    if (marketUiState.marketFormOpen && options.scroll) {
      const formBox = document.getElementById("marketFormBox");
      if (formBox) {
        setTimeout(function () {
          formBox.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 40);
      }
    }
  }

  function setMarketFiltersOpen(open, options = {}) {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.setMarketFiltersOpen === "function") {
      marketUi.setMarketFiltersOpen(marketUiState, open, options);
      return;
    }

    marketUiState.marketFiltersOpen = Boolean(open);
    updateMarketUiState();

    if (marketUiState.marketFiltersOpen && options.scroll) {
      const filtersBox = document.getElementById("marketFiltersBox");
      if (filtersBox) {
        setTimeout(function () {
          filtersBox.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
        }, 40);
      }
    }
  }

  function toggleMarketForm() {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.toggleMarketForm === "function") {
      marketUi.toggleMarketForm(marketUiState);
      return;
    }

    const nextOpen = !marketUiState.marketFormOpen;
    setMarketFormOpen(nextOpen, { scroll: nextOpen });
  }

  function toggleMarketFilters() {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.toggleMarketFilters === "function") {
      marketUi.toggleMarketFilters(marketUiState);
      return;
    }

    const nextOpen = !marketUiState.marketFiltersOpen;
    setMarketFiltersOpen(nextOpen, { scroll: nextOpen });
  }

  function renderMarketBase() {
    const root = document.getElementById("marketRoot");
    if (!root || marketRendered) return;

    root.innerHTML = `
      <div class="market-layout">
        <div id="marketFormBox" class="market-form-box hidden">
          <h2 id="marketFormTitle">Добавить товар</h2>

          <input id="marketTitleInput" placeholder="Название: спиннинг, катушка, лодка..." />

          <div class="form-row">
            <input id="marketPriceInput" placeholder="Цена, например: 120 BYN" />
            <input id="marketCityInput" placeholder="Город" />
          </div>

          <select id="marketCategoryInput">
            <option value="">Категория</option>
            <option value="Спиннинги">Спиннинги</option>
            <option value="Катушки">Катушки</option>
            <option value="Приманки">Приманки</option>
            <option value="Лодки">Лодки</option>
            <option value="Эхолоты">Эхолоты</option>
            <option value="Одежда">Одежда</option>
            <option value="Другое">Другое</option>
          </select>

          <select id="marketConditionInput">
            <option value="">Состояние</option>
            <option value="Новое">Новое</option>
            <option value="Б/у">Б/у</option>
            <option value="Требует ремонта">Требует ремонта</option>
          </select>

          <textarea id="marketDescriptionInput" placeholder="Описание: состояние, комплект, причина продажи"></textarea>
          <input id="marketContactInput" placeholder="Telegram продавца: @username или ссылка" />
          <div class="form-row">
            <input id="marketPhoneInput" placeholder="Телефон: +375..." inputmode="tel" autocomplete="tel" />
            <input id="marketWhatsAppInput" placeholder="WhatsApp: номер или ссылка" />
          </div>
          <div class="form-row">
            <input id="marketViberInput" placeholder="Viber: номер" />
            <input id="marketImageInput" placeholder="Ссылка на фото товара, можно оставить пустым" />
          </div>
          <div class="form-row market-upload-row">
            <label class="small-btn gray market-file-label" for="marketPhotoFileInput">Выбрать фото</label>
            <input id="marketPhotoFileInput" class="market-file-input" type="file" accept="image/*" />
            <label class="small-btn gray market-file-label" for="marketPhotoCameraInput">Сделать фото</label>
            <input id="marketPhotoCameraInput" class="market-file-input" type="file" accept="image/*" capture="environment" />
            <div class="market-file-meta">
              <div id="marketPhotoSelectedStatus" class="market-file-status">Фото не выбрано</div>
              <span id="marketPhotoFileName" class="market-file-name">Файл не выбран</span>
            </div>
            <button id="marketPhotoClearBtn" class="small-btn gray market-file-clear-btn hidden" type="button">Очистить фото</button>
          </div>
          <div id="marketPhotoPreviewWrap" class="market-photo-preview hidden">
            <img id="marketPhotoPreviewImage" alt="Предпросмотр фото товара" />
          </div>

          <div class="actions">
            <button id="marketSaveBtn" class="small-btn green" type="button" onclick="saveMarketItem()">Сохранить</button>
            <button id="marketCancelEditBtn" class="small-btn gray hidden" type="button" onclick="cancelMarketEdit()">Отмена</button>
          </div>

          <div id="marketMessage" class="auth-status"></div>

          <div class="market-note">
            Чтобы добавить товар, нужно войти на сайт. Это защищает объявления от чужого удаления.
          </div>
        </div>

        <div class="market-list-panel">
          <div id="marketOwnerLoginMessage" class="info-line hidden">Чтобы смотреть свои объявления, войдите в аккаунт.</div>

          <div class="market-search-row" role="search" aria-label="Поиск объявлений">
            <span class="market-search-icon" aria-hidden="true"></span>
            <input id="marketSearchInput" class="market-search-input" placeholder="Поиск объявлений" oninput="renderMarketItems()" />
            <button id="marketSearchFiltersBtn" class="market-search-filters-btn" type="button" onclick="toggleMarketFilters()" aria-label="Открыть фильтры" aria-expanded="false">⋯</button>
          </div>

          <div id="marketFiltersBox" class="market-filters hidden">
            <select id="marketCategoryFilter" onchange="renderMarketItems()">
              <option value="">Все категории</option>
              <option value="Спиннинги">Спиннинги</option>
              <option value="Катушки">Катушки</option>
              <option value="Приманки">Приманки</option>
              <option value="Лодки">Лодки</option>
              <option value="Эхолоты">Эхолоты</option>
              <option value="Одежда">Одежда</option>
              <option value="Другое">Другое</option>
            </select>

            <select id="marketCityFilter" onchange="renderMarketItems()">
              <option value="">Все города</option>
              <option value="Минск">Минск</option>
              <option value="Гомель">Гомель</option>
              <option value="Могилев">Могилев</option>
              <option value="Витебск">Витебск</option>
              <option value="Гродно">Гродно</option>
              <option value="Брест">Брест</option>
            </select>
          </div>

          <div id="marketStatusLine" class="info-line market-status-line">Загрузка барахолки...</div>
          <button id="marketNewItemsNotice" class="market-new-items-notice hidden" type="button" onclick="applyMarketPendingNewItems()">
            Появились новые товары — показать
          </button>

          <div id="marketItemsGrid" class="market-grid">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
        </div>
      </div>
    `;

    marketRendered = true;
    updateMarketUiState();
  }

  function updateMarketViewControls() {
    const allBtn = document.getElementById("marketViewAllBtn");
    const mineBtn = document.getElementById("marketViewMineBtn");
    const ownerTabs = document.getElementById("marketOwnerTabs");
    const ownerMessage = document.getElementById("marketOwnerLoginMessage");
    const activeBtn = document.getElementById("marketOwnerTabActiveBtn");
    const archiveBtn = document.getElementById("marketOwnerTabArchiveBtn");
    const soldBtn = document.getElementById("marketOwnerTabSoldBtn");
    const isMine = marketViewMode === "mine";
    const hasUser = Boolean(marketUser && marketUser.id);

    if (allBtn) allBtn.classList.toggle("is-active", !isMine);
    if (mineBtn) mineBtn.classList.toggle("is-active", isMine);
    if (ownerTabs) ownerTabs.classList.toggle("hidden", !isMine || !hasUser);
    if (ownerMessage) ownerMessage.classList.toggle("hidden", !isMine || hasUser);

    if (activeBtn) activeBtn.classList.toggle("is-active", marketOwnerTab === "active");
    if (archiveBtn) archiveBtn.classList.toggle("is-active", marketOwnerTab === "archive");
    if (soldBtn) soldBtn.classList.toggle("is-active", marketOwnerTab === "sold");
  }

  async function refreshMarketUser(options = {}) {
    refreshMarketDbBinding();

    const force = Boolean(options.force);
    const now = Date.now();

    const mainUser = getMainUser();

    if (!mainUser && isCentralAuthGuestAuthoritative()) {
      marketUser = null;
      marketLastUserRefreshAt = now;
      return null;
    }

    if (mainUser && mainUser.id) {
      marketUser = mainUser;
      marketLastUserRefreshAt = now;
      return marketUser;
    }

    if (!marketDb?.auth?.getUser) {
      if (isCentralAuthGuestAuthoritative()) {
        marketUser = null;
        return null;
      }
      return getCentralUser() || marketUser || null;
    }

    if (!force && marketUser && marketUser.id && now - marketLastUserRefreshAt < MARKET_AUTH_REFRESH_THROTTLE_MS) {
      if (isCentralAuthGuestAuthoritative()) {
        marketUser = null;
        return null;
      }
      return marketUser;
    }

    if (!force && marketUserRefreshPromise) {
      return marketUserRefreshPromise;
    }

    marketLastUserRefreshAt = now;

    marketUserRefreshPromise = (async function () {
      try {
        const result = await withMarketTimeout(
          marketDb.auth.getUser(),
          MARKET_AUTH_TIMEOUT_MS,
          "auth.getUser"
        );

        if (result.error) {
          console.warn("Klevby барахолка: пользователь не получен:", result.error);
          marketUser = getMainUser() || null;
          return marketUser;
        }

        marketUser = result.data && result.data.user ? result.data.user : null;

        return marketUser;
      } catch (error) {
        if (String(error && error.message || "").includes("MARKET_TIMEOUT:auth.getUser")) {
          console.warn("Klevby барахолка: auth.getUser timeout, используем fallback пользователя");
        } else {
          console.warn("Klevby барахолка: ошибка получения пользователя:", error);
        }
        marketUser = isCentralAuthGuestAuthoritative() ? null : (getMainUser() || null);
        return marketUser;
      } finally {
        marketUserRefreshPromise = null;
      }
    })();

    return marketUserRefreshPromise;
  }

  async function ensureMarketUserForWrite() {
    refreshMarketDbBinding();

    let user = getMainUser();

    if (user && user.id) {
      marketUser = user;
      return marketUser;
    }

    user = await refreshMarketUser({ force: true });
    if (user && user.id) return user;

    user = await refreshMarketUser({ force: true });
    if (user && user.id) return user;

    return null;
  }

  function showMarketMessage(message, isError = false) {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.showMarketMessage === "function") {
      marketUi.showMarketMessage(message, isError);
      return;
    }

    const el = document.getElementById("marketMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(244,251,247,0.66)";
  }

  function showMarketStatus(message, isError = false) {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.showMarketStatus === "function") {
      marketUi.showMarketStatus(message, isError);
      return;
    }

    const el = document.getElementById("marketStatusLine");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("error-line", isError);
  }

  function showMarketNewItemsNotice() {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.showMarketNewItemsNotice === "function") {
      marketUi.showMarketNewItemsNotice();
      return;
    }

    const notice = document.getElementById("marketNewItemsNotice");
    if (notice) notice.classList.remove("hidden");
  }

  function hideMarketNewItemsNotice() {
    const marketUi = getMarketUiHelpers();

    if (typeof marketUi.hideMarketNewItemsNotice === "function") {
      marketUi.hideMarketNewItemsNotice();
      return;
    }

    const notice = document.getElementById("marketNewItemsNotice");
    if (notice) notice.classList.add("hidden");
  }

  function isMarketVisible() {
    const root = document.getElementById("marketRoot");
    if (!root) return false;
    if (document.hidden) return false;
    if (root.offsetParent === null) return false;

    return true;
  }

  function resolveMarketUserFromAuthEvent(event) {
    const eventUser = event?.detail?.user || null;

    if (eventUser && eventUser.id) {
      return eventUser;
    }

    if (isCentralAuthGuestAuthoritative()) {
      return null;
    }

    const centralUser = getCentralUser();
    return centralUser && centralUser.id ? centralUser : null;
  }

  function marketGridHasRenderedCards() {
    const grid = document.getElementById("marketItemsGrid");
    return Boolean(grid && grid.querySelector(".market-card"));
  }

  function handleMarketAuthChanged(event) {
    const prevUserId = marketUser?.id || null;
    const nextUser = resolveMarketUserFromAuthEvent(event);
    const nextUserId = nextUser?.id || null;

    marketUser = nextUser;
    updateMarketViewControls();

    if (prevUserId === nextUserId && marketGridHasRenderedCards()) {
      return;
    }

    renderMarketItems();
  }

  function isMarketLoadStale() {
    if (!marketLoadPromise) return false;
    if (!marketLoadStartedAt) return false;

    return Date.now() - marketLoadStartedAt >= MARKET_STALE_LOAD_MS;
  }

  function resetStaleMarketLoadLock(reason) {
    if (!isMarketLoadStale()) return false;

    console.warn("Klevby барахолка: сбрасываем зависшую загрузку барахолки:", reason || "stale-load-lock");
    marketLoadPromise = null;
    marketLoadStartedAt = 0;
    return true;
  }

  async function recoverMarketOnResume(reason) {
    const cleanReason = String(reason || "resume");
    markKlevbyResumeDebug("market.resume", cleanReason, { phase: "start" });
    if (!isMarketVisible()) {
      markKlevbyResumeDebug("market.resume", cleanReason, { phase: "skip_not_visible" });
      return;
    }
    const now = Date.now();
    if (now - marketLastResumeRecoverAt < MARKET_RESUME_RECOVER_THROTTLE_MS) {
      markKlevbyResumeDebug("market.resume", cleanReason, { phase: "skip_throttle", sinceLastMs: now - marketLastResumeRecoverAt });
      return;
    }
    marketLastResumeRecoverAt = now;

    resetStaleMarketLoadLock(reason || "resume");
    refreshMarketDbBinding();

    await refreshMarketUser();
    subscribeMarketRealtime();

    const isLoaded = Array.isArray(marketItems) && marketItems.length > 0;
    const isFresh = marketLastSuccessfulLoadAt > 0 && now - marketLastSuccessfulLoadAt < MARKET_RESUME_RELOAD_COOLDOWN_MS;
    const shouldForceReload = !(isLoaded && isFresh);

    await loadMarketItems({ force: shouldForceReload });
    markKlevbyResumeDebug("market.resume", cleanReason, { phase: "done", shouldForceReload });
  }

  function applyMarketPendingNewItems() {
    if (!marketHasPendingNewItems) return;

    marketHasPendingNewItems = false;
    hideMarketNewItemsNotice();

    loadMarketItems({ force: true }).catch((error) => {
      console.warn("Klevby барахолка: не удалось обновить список новых товаров:", error);
    });
  }

  function unsubscribeMarketRealtime() {
    if (!marketRealtimeChannel || !marketDb) return;

    try {
      marketDb.removeChannel(marketRealtimeChannel);
    } catch (error) {
      console.warn("Klevby барахолка: не удалось отписаться от realtime:", error);
    } finally {
      const realtimeManager = getRealtimeManagerSafe();
      if (realtimeManager && typeof realtimeManager.unregisterChannel === "function") {
        try {
          realtimeManager.unregisterChannel(
            MARKET_REALTIME_OWNER,
            MARKET_REALTIME_CHANNEL_NAME,
            MARKET_REALTIME_PURPOSE
          );
        } catch (managerError) {
          console.warn("Klevby барахолка: не удалось снять регистрацию realtime-канала в менеджере:", managerError);
        }
      }
    }

    marketRealtimeChannel = null;
  }

  function subscribeMarketRealtime() {
    if (!marketDb || typeof marketDb.channel !== "function") return;
    if (marketRealtimeChannel) return;

    try {
      marketRealtimeChannel = marketDb
        .channel(MARKET_REALTIME_CHANNEL_NAME)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "market_items"
        }, function () {
          if (!isMarketVisible()) return;

          marketHasPendingNewItems = true;
          showMarketNewItemsNotice();
        })
        .on("postgres_changes", {
          event: "DELETE",
          schema: "public",
          table: "market_items"
        }, function (payload) {
          const deletedId = payload?.old?.id ?? payload?.id ?? null;

          if (!deletedId) {
            if (isMarketVisible()) {
              loadMarketItems({ force: true }).catch((error) => {
                console.warn("Klevby барахолка: не удалось обновить после live DELETE:", error);
              });
            }
            return;
          }

          const beforeLength = marketItems.length;
          marketItems = marketItems.filter(function (item) {
            return String(item.id) !== String(deletedId);
          });

          if (beforeLength === marketItems.length) return;

          if (marketOpenDetailsItemId && String(marketOpenDetailsItemId) === String(deletedId)) {
            closeMarketItemDetails();
          }

          renderMarketItems();
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "market_items"
        }, function (payload) {
          const updatedRow = payload?.new;
          const updatedId = updatedRow?.id ?? payload?.old?.id ?? null;
          if (!updatedRow || !updatedId) return;

          const isVisible = isMarketItemPubliclyVisible(updatedRow);
          let updated = false;
          let removed = false;

          marketItems = marketItems.reduce(function (acc, item) {
            if (String(item.id) !== String(updatedId)) {
              acc.push(item);
              return acc;
            }

            if (isVisible) {
              acc.push(updatedRow);
              updated = true;
              return acc;
            }

            removed = true;
            return acc;
          }, []);

          if (!updated && !removed) return;

          renderMarketItems();

          if (marketOpenDetailsItemId && String(marketOpenDetailsItemId) === String(updatedId)) {
            if (isVisible) {
              openMarketItemDetails(updatedId);
            } else {
              closeMarketItemDetails();
            }
          }
        })
        .subscribe(function (status) {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("Klevby барахолка: realtime недоступен, продолжаем без live-уведомлений:", status);
          }
        });

      const realtimeManager = getRealtimeManagerSafe();
      if (realtimeManager && typeof realtimeManager.registerChannel === "function") {
        try {
          realtimeManager.registerChannel({
            owner: MARKET_REALTIME_OWNER,
            channelName: MARKET_REALTIME_CHANNEL_NAME,
            purpose: MARKET_REALTIME_PURPOSE,
            channel: marketRealtimeChannel,
            allowReplace: true
          });
        } catch (managerError) {
          console.warn("Klevby барахолка: не удалось зарегистрировать realtime-канал в менеджере:", managerError);
        }
      }
    } catch (error) {
      marketRealtimeChannel = null;
      console.warn("Klevby барахолка: ошибка подписки realtime, продолжаем в обычном режиме:", error);
    }
  }

  function scheduleMarketLoad(delay = MARKET_LOAD_RETRY_DELAY_MS, force = false) {
    clearTimeout(marketLoadTimer);

    marketLoadTimer = setTimeout(() => {
      loadMarketItems({ force }).catch((error) => {
        console.warn("Klevby барахолка: отложенная загрузка не удалась:", error);
      });
    }, delay);
  }

  async function loadMarketItems(options = {}) {
    const force = Boolean(options.force);
    const retry = Number(options.retry || 0);

    renderMarketBase();

    refreshMarketDbBinding();

    const grid = document.getElementById("marketItemsGrid");

    if (!grid) return;

    if (!marketDb) {
      showMarketStatus("Supabase ещё не готов. Повторяем загрузку барахолки...");
      scheduleMarketLoad(800, true);
      return;
    }

    if (force) {
      resetStaleMarketLoadLock("force-reload");
    }

    if (marketLoadPromise) {
      if (force) {
        marketPendingForceReload = true;
      }

      return marketLoadPromise;
    }

    marketPendingForceReload = false;

    marketLoadStartedAt = Date.now();
    marketLoadPromise = (async function () {
      showMarketStatus("Загрузка барахолки...");

      if (!marketItems.length) {
        grid.innerHTML = `
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        `;
      }

      /*
        ВАЖНО:
        Здесь больше НЕ вызываем refreshMarketUser().
        Барахолка должна грузить товары даже без проверки авторизации.
        Пользователя проверяем только при сохранении/удалении.
      */

      let result;

      try {
        result = await loadMarketItemsViaRest();
      } catch (error) {
        console.warn("Klevby барахолка: REST-загрузка market_items не удалась, пробуем SDK fallback:", error);

        try {
          const loadClient = refreshMarketDbBinding();
          result = await withMarketTimeout(
            loadClient
              .from("market_items")
              .select("*")
              .eq("status", "active")
              .gt("expires_at", new Date().toISOString())
              .order("created_at", { ascending: false }),
            MARKET_LOAD_TIMEOUT_MS,
            "market_items_select"
          );
        } catch (sdkError) {
          const message = String(sdkError?.message || "");
          if (message.includes("MARKET_TIMEOUT:") && retry < 1) {
            console.warn("Klevby барахолка: таймаут загрузки market_items (REST+SDK), будет повторная попытка:", sdkError);
            showMarketStatus("Барахолка отвечает слишком долго. Повторяем загрузку...");
            setTimeout(() => {
              loadMarketItems({ force: true, retry: retry + 1 }).catch(() => {});
            }, MARKET_LOAD_RETRY_DELAY_MS);
            return;
          }

          if (message.includes("MARKET_TIMEOUT:")) {
            console.warn("Klevby барахолка: таймаут загрузки market_items (REST+SDK), можно повторить вручную:", sdkError);
            showMarketStatus("Загрузка барахолки заняла слишком много времени. Попробуй ещё раз.", true);
            return;
          }

          if (isAuthLockError(sdkError) && retry < 2) {
            console.warn("Klevby барахолка: Supabase Auth занят, повторяем загрузку:", sdkError);
            showMarketStatus("Подключение занято, повторяем загрузку барахолки...");
            setTimeout(() => {
              loadMarketItems({ force: true, retry: retry + 1 }).catch(() => {});
            }, MARKET_LOAD_RETRY_DELAY_MS);
            return;
          }

          console.error("Ошибка загрузки барахолки:", sdkError);
          showMarketStatus("Не удалось загрузить барахолку. Попробуй обновить страницу.", true);

          if (!marketItems.length) {
            grid.innerHTML = `<div class="info-line error-line">Ошибка загрузки барахолки. Проверь интернет или Supabase.</div>`;
          }

          return;
        }

        const message = String(error?.message || "");
        if (message.includes("MARKET_REST_CONFIG_MISSING")) {
          console.warn("Klevby барахолка: REST-конфиг не найден, используем SDK fallback.");
        }
      }

      if (result.error) {
        if (isAuthLockError(result.error) && retry < 2) {
          console.warn("Klevby барахолка: Supabase Auth занят, повторяем загрузку:", result.error);
          showMarketStatus("Подключение занято, повторяем загрузку барахолки...");
          setTimeout(() => {
            loadMarketItems({ force: true, retry: retry + 1 }).catch(() => {});
          }, MARKET_LOAD_RETRY_DELAY_MS);
          return;
        }

        console.error(result.error);
        showMarketStatus("Не удалось загрузить барахолку. Проверь таблицу market_items в Supabase.", true);

        if (!marketItems.length) {
          grid.innerHTML = `<div class="info-line error-line">Ошибка загрузки барахолки. Проверь таблицу market_items.</div>`;
        }

        return;
      }

      marketItems = result.data || [];
      marketLastSuccessfulLoadAt = Date.now();
      if (marketViewMode === "mine") {
        await loadOwnerMarketItems();
      }
      marketHasPendingNewItems = false;
      hideMarketNewItemsNotice();

      const mainUser = getMainUser();
      if (mainUser && mainUser.id) {
        marketUser = mainUser;
      }

      renderMarketItems();
    })();

    try {
      return await marketLoadPromise;
    } finally {
      marketLoadPromise = null;
      marketLoadStartedAt = 0;

      if (marketPendingForceReload) {
        marketPendingForceReload = false;
        scheduleMarketLoad(MARKET_LOAD_RETRY_DELAY_MS, true);
      }
    }
  }

  function renderMarketItems() {
    const grid = document.getElementById("marketItemsGrid");
    if (!grid) return;

    const search = normalizeText(document.getElementById("marketSearchInput")?.value);
    const category = normalizeText(document.getElementById("marketCategoryFilter")?.value);
    const city = normalizeText(document.getElementById("marketCityFilter")?.value);

    const hasUser = Boolean(marketUser && marketUser.id);
    const sourceItems = marketViewMode === "mine" && hasUser ? marketOwnerItems : marketItems;
    let filtered = [...sourceItems];

    if (search) {
      filtered = filtered.filter(function (item) {
        return isMarketItemSearchMatch(item, search);
      });
    }

    if (category) {
      filtered = filtered.filter(function (item) {
        return normalizeText(item.category).includes(category);
      });
    }

    if (city) {
      filtered = filtered.filter(function (item) {
        return normalizeText(item.city).includes(city);
      });
    }

    if (marketViewMode === "mine" && hasUser) {
      filtered = filtered.filter(ownerTabFilter);
    }

    if (marketViewMode === "mine") {
      showMarketStatus(hasUser ? `${filtered.length} товаров` : "Войдите в аккаунт, чтобы смотреть свои объявления.");
    } else {
      showMarketStatus(`${filtered.length} товаров`);
    }

    if (!filtered.length) {
      grid.innerHTML = `<div class="market-empty-state"><strong>Пока товаров нет</strong><span>Добавь первый товар</span></div>`;
      return;
    }

    grid.innerHTML = filtered.map(function (item, index) {
      return marketCardHtml(item, index);
    }).join("");
  }

  function isOwnerArchivedItem(item) {
    if (!item || typeof item !== "object") return false;
    const status = String(item.status || "").trim().toLowerCase();
    if (status === "archived") return true;
    const expiresAtTs = Date.parse(item.expires_at || "");
    return Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now();
  }

  function isOwnerExpiredActiveItem(item) {
    if (!item || typeof item !== "object") return false;
    const status = String(item.status || "").trim().toLowerCase();
    if (status !== "active") return false;
    const expiresAtTs = Date.parse(item.expires_at || "");
    return Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now();
  }

  function ownerTabFilter(item) {
    const status = String(item.status || "").trim().toLowerCase();
    if (marketOwnerTab === "sold") return status === "sold";
    if (marketOwnerTab === "archive") return status === "archived" || isOwnerExpiredActiveItem(item);
    return status === "active" && isMarketItemPubliclyVisible(item);
  }

  function getMarketItemById(id) {
    const safeId = String(id);
    const fromOwner = marketOwnerItems.find(function (x) {
      return String(x.id) === safeId;
    });
    if (fromOwner) return fromOwner;
    return marketItems.find(function (x) {
      return String(x.id) === safeId;
    }) || null;
  }

  async function loadOwnerMarketItems() {
    const user = await ensureMarketUserForWrite();
    if (!user || !user.id) {
      marketOwnerItems = [];
      return;
    }

    let result;
    try {
      result = await loadOwnerMarketItemsViaRest(user.id);
    } catch (error) {
      const loadClient = refreshMarketDbBinding();
      result = await withMarketTimeout(
        loadClient
          .from("market_items")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        MARKET_LOAD_TIMEOUT_MS,
        "market_owner_items_select"
      );
    }

    marketOwnerItems = Array.isArray(result.data) ? result.data : [];
  }

  async function switchMarketView(mode) {
    const nextMode = String(mode || "").trim() === "mine" ? "mine" : "all";
    if (marketViewMode === nextMode && !(nextMode === "mine" && !marketOwnerItems.length)) {
      updateMarketViewControls();
      renderMarketItems();
      return;
    }

    marketViewMode = nextMode;
    await refreshMarketUser();
    updateMarketViewControls();

    if (marketViewMode === "mine" && marketUser && marketUser.id) {
      await loadOwnerMarketItems();
    }

    renderMarketItems();
  }

  function switchMarketOwnerTab(tab) {
    const nextTab = ["active", "archive", "sold"].includes(tab) ? tab : "active";
    marketOwnerTab = nextTab;
    updateMarketViewControls();
    renderMarketItems();
  }

  function handleMarketCardKeydown(event, id) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openMarketItemDetails(id);
  }

  function handleMarketImageLoad(event) {
    const image = event && event.target ? event.target : null;
    if (!image) return;
    image.classList.add("is-loaded");
    const frame = image.closest(".market-photo-frame");
    if (frame) frame.classList.add("is-loaded");
  }

  function handleMarketImageError(event) {
    const image = event && event.target ? event.target : null;
    if (!image) return;
    const frame = image.closest(".market-photo-frame");
    if (frame) frame.classList.add("is-error");
    image.removeAttribute("src");
    image.classList.remove("is-loaded");
  }

  function marketPhotoHtml(image, options) {
    const photoClass = options?.photoClass || "";
    const frameClass = options?.frameClass || "";
    const loading = options?.loading ? ` loading="${options.loading}"` : "";
    const fetchPriority = options?.fetchPriority ? ` fetchpriority="${options.fetchPriority}"` : "";
    const imageUrl = escapeHtml(image || "");

    return `
      <div class="market-photo-frame ${frameClass}">
        <div class="market-photo-skeleton" aria-hidden="true"></div>
        <img class="market-photo ${photoClass}" src="${imageUrl}" alt="Фото товара"${loading}${fetchPriority} decoding="async" onload="handleMarketImageLoad(event)" onerror="handleMarketImageError(event)" />
      </div>
    `;
  }

  function marketCardHtml(item, index) {
    const image = getMarketImage(item);
    const safeId = escapeHtml(item.id);
    const status = String(item.status || "").trim().toLowerCase();
    const ownerView = marketViewMode === "mine" && marketUser && marketUser.id;
    let ownerStatusBadge = "";

    if (ownerView) {
      if (status === "sold") ownerStatusBadge = "Продано";
      else if (status === "archived") ownerStatusBadge = "В архиве";
      else if (isOwnerExpiredActiveItem(item)) ownerStatusBadge = "Просрочено";
      else ownerStatusBadge = "Активно";
    }

    const cardIndex = Number(index) || 0;
    const shouldEagerLoad = cardIndex < 4;
    const loadingMode = shouldEagerLoad ? "eager" : "lazy";
    const fetchPriority = shouldEagerLoad ? "high" : "auto";

    return `
      <article class="market-card" role="button" tabindex="0" onclick="openMarketItemDetails('${safeId}')" onkeydown="handleMarketCardKeydown(event, '${safeId}')">
        <div class="market-img">
          ${marketPhotoHtml(image, { loading: loadingMode, fetchPriority, frameClass: "market-card-photo-frame", photoClass: "market-card-photo" })}
          <span class="market-open-badge">Открыть</span>
        </div>

        <div class="market-body">
          <h3 class="market-title">${escapeHtml(item.title || "Товар")}</h3>
          <div class="market-price">${escapeHtml(item.price || "Цена не указана")}</div>
          ${ownerStatusBadge ? `<div class="market-city">Статус: ${escapeHtml(ownerStatusBadge)}</div>` : ""}
          ${item.city ? `<div class="market-city">📍 ${escapeHtml(item.city)}</div>` : ""}
        </div>
      </article>
    `;
  }

  function ensureMarketDetailsOverlay() {
    let overlay = document.getElementById("marketDetailsOverlay");

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "marketDetailsOverlay";
    overlay.className = "market-details-overlay hidden";
    document.body.appendChild(overlay);

    return overlay;
  }

  function handleMarketDetailsEscape(event) {
    if (event.key === "Escape") {
      closeMarketItemDetails();
    }
  }

  function marketDetailsHtml(item) {
    const marketContacts = window.KlevbyMarket || {};
    const contacts = typeof marketContacts.resolveMarketContacts === "function"
      ? marketContacts.resolveMarketContacts(item)
      : {
        phone: "",
        telegram: cleanTelegram(item.contact_telegram || item.contact || item.telegram || ""),
        viber: "",
        whatsapp: "",
        hasAny: Boolean(cleanTelegram(item.contact_telegram || item.contact || item.telegram || ""))
      };
    const ownerId = marketUser ? marketUser.id : null;
    const canManage = ownerId && item.owner_id === ownerId;
    const image = getMarketImage(item);
    const safeId = escapeHtml(item.id);

    const contactBlock = typeof marketContacts.marketContactCtaHtml === "function"
      ? marketContacts.marketContactCtaHtml(contacts)
      : (contacts.telegram
        ? `<button class="small-btn green" type="button" onclick="window.open('https://t.me/${escapeHtml(contacts.telegram)}','_blank')">Telegram</button>`
        : `<span class="market-contact-missing">Контакт не указан</span>`);

    const status = String(item.status || "").trim().toLowerCase();
    const isSold = status === "sold";
    const deleteBtn = canManage && !isSold
      ? `<button class="small-btn red" type="button" onclick="closeMarketItemDetails(); deleteMarketItem('${safeId}')">Удалить</button>`
      : "";
    const canResume = !isSold && isOwnerArchivedItem(item);
    const renewBtn = canManage && !isSold
      ? `<button class="small-btn green" type="button" onclick="applyMarketOwnerAction('${safeId}', 'renew')">${canResume ? "Возобновить" : "Продлить"}</button>`
      : "";
    const soldBtn = canManage && !isSold
      ? `<button class="small-btn gray" type="button" onclick="applyMarketOwnerAction('${safeId}', 'sold')">Продано</button>`
      : "";
    const editBtn = canManage && !isSold
      ? `<button class="small-btn yellow" type="button" onclick="closeMarketItemDetails(); editMarketItem('${safeId}')">Редактировать</button>`
      : "";
    const archiveBtn = canManage && !isSold && !canResume
      ? `<button class="small-btn gray" type="button" onclick="applyMarketOwnerAction('${safeId}', 'archive')">В архив</button>`
      : "";
    const ownerMoreActions = [renewBtn, soldBtn, archiveBtn, deleteBtn].filter(Boolean).join('');
    const ownerActionBlock = canManage
      ? `
        <div class="market-owner-actions">
          <div class="market-owner-actions-top">
            ${contactBlock}
            ${editBtn}
          </div>
          ${ownerMoreActions
            ? `<button class="small-btn market-owner-more-toggle" type="button" onclick="toggleMarketOwnerActions()" aria-expanded="${marketOwnerActionsExpanded ? "true" : "false"}">${marketOwnerActionsExpanded ? "Скрыть" : "Ещё"}</button>
            <div class="market-owner-actions-more ${marketOwnerActionsExpanded ? "" : "hidden"}">
              ${ownerMoreActions}
            </div>`
            : ""}
        </div>`
      : contactBlock;

    return `
      <button class="market-details-backdrop" type="button" onclick="closeMarketItemDetails()" aria-label="Закрыть карточку товара"></button>

      <section class="market-details-panel" role="dialog" aria-modal="true" aria-label="Карточка товара">
        <button class="market-details-close" type="button" onclick="closeMarketItemDetails()" aria-label="Закрыть">×</button>

        <div class="market-details-img">
          ${marketPhotoHtml(image, { loading: "eager", fetchPriority: "high", frameClass: "market-details-photo-frame", photoClass: "market-details-photo" })}
        </div>

        <div class="market-details-body">
          <p class="market-details-kicker">Барахолка снастей</p>

          <h2 class="market-details-title">${escapeHtml(item.title || "Товар")}</h2>

          <div class="market-details-price">${escapeHtml(item.price || "Цена не указана")}</div>

          <div class="market-details-meta">
            ${item.city ? `<span class="market-tag">📍 ${escapeHtml(item.city)}</span>` : ""}
            ${item.category ? `<span class="market-tag">🎣 ${escapeHtml(item.category)}</span>` : ""}
            ${item.condition ? `<span class="market-tag">${escapeHtml(item.condition)}</span>` : ""}
            ${contacts.telegram ? `<span class="market-tag">Telegram</span>` : ""}
            ${contacts.phone ? `<span class="market-tag">📞 Телефон</span>` : ""}
            ${contacts.whatsapp ? `<span class="market-tag">WhatsApp</span>` : ""}
            ${contacts.viber ? `<span class="market-tag">Viber</span>` : ""}
          </div>

          <p class="market-details-description">${escapeHtml(item.description || "Описание не указано")}</p>

          <div class="market-details-actions">
            ${ownerActionBlock}
          </div>
        </div>
      </section>
    `;
  }


  function getMarketDetailsScrollInset() {
    const viewport = window.visualViewport;
    const viewportGap = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
    return Math.max(28, Math.ceil(viewportGap) + 28);
  }

  function scrollMarketDetailsToElement(panel, target, options = {}) {
    if (!panel || !target || typeof panel.scrollTo !== "function") return;

    const panelRect = panel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollInset = getMarketDetailsScrollInset();
    const align = options.align || "nearest";
    let nextTop = panel.scrollTop;

    if (align === "top") {
      nextTop += targetRect.top - panelRect.top - (options.offset || 18);
    } else {
      const visibleBottom = panelRect.bottom - scrollInset;
      const visibleTop = panelRect.top + (options.offset || 18);

      if (targetRect.bottom > visibleBottom) {
        nextTop += targetRect.bottom - visibleBottom;
      }

      if (targetRect.top < visibleTop) {
        nextTop -= visibleTop - targetRect.top;
      }
    }

    const maxTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const boundedTop = Math.min(Math.max(0, nextTop), maxTop);

    panel.scrollTo({
      top: boundedTop,
      behavior: "smooth"
    });
  }

  function scheduleMarketOwnerActionsScroll(expanded) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const overlay = document.getElementById("marketDetailsOverlay");
        const panel = overlay ? overlay.querySelector(".market-details-panel") : null;

        if (!panel) return;

        const target = expanded
          ? panel.querySelector(".market-owner-actions-more:not(.hidden)")
          : (panel.querySelector(".market-owner-more-toggle") || panel.querySelector(".market-owner-actions-top"));

        if (!target) return;

        scrollMarketDetailsToElement(panel, target, {
          align: "nearest",
          offset: expanded ? 18 : 14
        });
      });
    });
  }

  function scheduleMarketOwnerActionsReturnScroll(savedScrollTop) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const overlay = document.getElementById("marketDetailsOverlay");
        const panel = overlay ? overlay.querySelector(".market-details-panel") : null;

        if (!panel || typeof panel.scrollTo !== "function") return;

        const maxTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
        const boundedTop = Math.min(Math.max(0, savedScrollTop), maxTop);

        panel.scrollTo({
          top: boundedTop,
          behavior: "smooth"
        });
      });
    });
  }

  function toggleMarketOwnerActions() {
    const overlay = document.getElementById("marketDetailsOverlay");
    if (!overlay || !marketOpenDetailsItemId) return;

    const item = getMarketItemById(marketOpenDetailsItemId);
    if (!item) return;

    const panel = overlay.querySelector(".market-details-panel");
    const moreActions = panel ? panel.querySelector(".market-owner-actions-more") : null;
    const toggle = panel ? panel.querySelector(".market-owner-more-toggle") : null;

    if (!panel || !moreActions || !toggle) return;

    const currentScrollTop = panel.scrollTop;
    const wasExpanded = marketOwnerActionsExpanded;

    if (!wasExpanded) {
      marketOwnerActionsReturnScrollTop = currentScrollTop;
    }

    marketOwnerActionsExpanded = !marketOwnerActionsExpanded;
    const expanded = marketOwnerActionsExpanded;
    const savedReturnScrollTop = marketOwnerActionsReturnScrollTop;

    moreActions.classList.toggle("hidden", !expanded);
    toggle.textContent = expanded ? "Скрыть" : "Ещё";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");

    if (expanded) {
      scheduleMarketOwnerActionsScroll(true);
      return;
    }

    if (Number.isFinite(savedReturnScrollTop)) {
      scheduleMarketOwnerActionsReturnScroll(savedReturnScrollTop);
      marketOwnerActionsReturnScrollTop = null;
      return;
    }

    scheduleMarketOwnerActionsScroll(false);
  }

  function openMarketItemDetails(id) {
    const item = getMarketItemById(id);

    if (!item) return;

    const overlay = ensureMarketDetailsOverlay();

    marketOwnerActionsExpanded = false;
    marketOwnerActionsReturnScrollTop = null;
    overlay.innerHTML = marketDetailsHtml(item);
    overlay.classList.remove("hidden");
    marketOpenDetailsItemId = String(id);
    document.body.classList.add("market-details-open");
    document.addEventListener("keydown", handleMarketDetailsEscape);
  }

  function closeMarketItemDetails() {
    const overlay = document.getElementById("marketDetailsOverlay");

    if (overlay) {
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
    }

    marketOpenDetailsItemId = null;
    marketOwnerActionsExpanded = false;
    marketOwnerActionsReturnScrollTop = null;
    document.body.classList.remove("market-details-open");
    document.removeEventListener("keydown", handleMarketDetailsEscape);
  }

  function setMarketSaveButtonState(isSaving) {
    const saveBtn = document.getElementById("marketSaveBtn");
    if (!saveBtn) return;
    const nextSaving = Boolean(isSaving);
    saveBtn.disabled = nextSaving;
    saveBtn.classList.toggle("is-saving", nextSaving);
    saveBtn.textContent = nextSaving ? "Сохраняем…" : "Сохранить";
    saveBtn.setAttribute("aria-busy", nextSaving ? "true" : "false");
  }

  async function saveMarketItem() {
    if (marketSaveInProgress) return;
    marketSaveInProgress = true;
    setMarketSaveButtonState(true);

    try {
      refreshMarketDbBinding();
      const safeUser = await ensureMarketUserForWrite();

      if (!safeUser) {
        if (typeof showSection === "function") showSection("auth");
        showMarketMessage("Не удалось проверить авторизацию. Открой раздел входа и попробуй снова.", true);
        alert("Не удалось проверить авторизацию. Войди в аккаунт и попробуй снова.");
        return;
      }

      const title = document.getElementById("marketTitleInput").value.trim();
    const price = document.getElementById("marketPriceInput").value.trim();
    const city = document.getElementById("marketCityInput").value.trim();
    const category = document.getElementById("marketCategoryInput").value.trim();
    const condition = document.getElementById("marketConditionInput").value.trim();
    const description = document.getElementById("marketDescriptionInput").value.trim();
    const marketContacts = window.KlevbyMarket || {};
    const contactRaw = document.getElementById("marketContactInput").value;
    const phoneRaw = document.getElementById("marketPhoneInput").value;
    const whatsappRaw = document.getElementById("marketWhatsAppInput").value;
    const viberRaw = document.getElementById("marketViberInput").value;

    const contact = typeof marketContacts.normalizeMarketTelegram === "function" ? marketContacts.normalizeMarketTelegram(contactRaw) : cleanTelegram(contactRaw);
    const contactPhone = typeof marketContacts.normalizeMarketPhone === "function" ? marketContacts.normalizeMarketPhone(phoneRaw) : String(phoneRaw || "").trim();
    const contactWhatsapp = typeof marketContacts.normalizeMarketWhatsapp === "function" ? marketContacts.normalizeMarketWhatsapp(whatsappRaw) : String(whatsappRaw || "").trim();
    const contactViber = typeof marketContacts.normalizeMarketViber === "function" ? marketContacts.normalizeMarketViber(viberRaw) : String(viberRaw || "").trim();
    const imageUrl = document.getElementById("marketImageInput").value.trim();
    const selectedPhotoFile = marketSelectedPhotoFile;

    if (!title || !price || !city || !description) {
      showMarketMessage("Заполни название, цену, город и описание.", true);
      return;
    }

    let resolvedImageUrl = imageUrl;
    if (selectedPhotoFile) {
      if (marketPhotoInvalid || !marketPreparedPhotoFile) {
        showMarketMessage("Это фото не удалось открыть. Попробуй выбрать другое фото.", true);
        return;
      }
      const uploader = window.KlevbyMarket || {};
      if (typeof uploader.uploadMarketPhotoFile !== "function") {
        showMarketMessage("Не удалось подготовить загрузку фото. Обнови страницу и попробуй снова.", true);
        return;
      }
      const accessToken = await getMarketAccessToken();
      if (!accessToken) {
        showMarketMessage("Нужен вход в аккаунт для загрузки фото.", true);
        return;
      }

      showMarketMessage("Загружаем фото…");

      try {
        const uploadResult = await uploader.uploadMarketPhotoFile({
          userId: safeUser.id,
          file: selectedPhotoFile,
          preparedFile: marketPreparedPhotoFile,
          accessToken
        });
        resolvedImageUrl = String(uploadResult?.publicUrl || "").trim();
      } catch (error) {
        const msg = String(error?.message || "");
        if (msg.includes("MARKET_UPLOAD_AUTH_REQUIRED")) {
          showMarketMessage("Нужен вход в аккаунт для загрузки фото.", true);
          return;
        }
        if (msg.includes("MARKET_UPLOAD_TYPE_INVALID")) {
          showMarketMessage("Поддерживаются только JPEG, PNG или WEBP.", true);
          return;
        }
        if (msg.includes("MARKET_UPLOAD_TOO_LARGE")) {
          showMarketMessage("Фото должно быть не больше 5 МБ.", true);
          return;
        }
        if (msg.includes("MARKET_HEIC_UNSUPPORTED")) {
          showMarketMessage("HEIC/HEIF пока не поддерживается. Выбери JPEG/PNG/WEBP.", true);
          return;
        }
        if (msg.includes("MARKET_IMAGE_PROCESS_FAILED")) {
          showMarketMessage("Не удалось обработать это фото. Попробуй выбрать другое фото.", true);
          return;
        }
        console.error("Klevby барахолка: загрузка фото не удалась:", error);
        showMarketMessage("Не удалось загрузить фото. Попробуй другой файл или повтори позже.", true);
        return;
      }
    }

    const payload = {
      title,
      price,
      city,
      category,
      condition,
      description,
      contact,
      telegram: contact,
      contact_telegram: contact,
      contact_phone: contactPhone,
      contact_whatsapp: contactWhatsapp,
      contact_viber: contactViber,
      image_url: resolvedImageUrl,
      owner_id: safeUser.id
    };

    let result;

    try {
      if (editingMarketId) {
        result = await updateMarketItemViaRest(editingMarketId, safeUser.id, payload);
      } else {
        result = await insertMarketItemViaRest(payload);
      }
    } catch (error) {
      const msg = String(error?.message || "");
      if (msg.includes("MARKET_AUTH_REQUIRED")) {
        showMarketMessage("Сессия устарела. Войди снова и повтори действие.", true);
        return;
      }
      if (msg.includes("MARKET_TIMEOUT:market_items_update_rest")) {
        showMarketMessage("Сохранение заняло слишком много времени. Попробуй ещё раз.", true);
        return;
      }
      if (msg.includes("MARKET_TIMEOUT:market_items_insert_rest")) {
        showMarketMessage("Добавление заняло слишком много времени. Попробуй ещё раз.", true);
        return;
      }
      console.error("Klevby барахолка: REST-сохранение товара не удалось:", error);
      showMarketMessage("Не получилось сохранить товар. Попробуй ещё раз.", true);
      return;
    }

    if (result.error) {
      console.error(result.error);
      showMarketMessage("Не получилось сохранить товар. Проверь таблицу market_items и RLS.", true);
      return;
    }

      const wasEditing = Boolean(editingMarketId);

      clearMarketForm();
      editingMarketId = null;
      document.getElementById("marketFormTitle").textContent = "Добавить товар";
      document.getElementById("marketCancelEditBtn").classList.add("hidden");

      showMarketMessage(wasEditing ? "Товар обновлён." : "Товар добавлен.");
      setMarketFormOpen(false);

      try {
        await loadMarketItems({ force: true });
      } catch (error) {
        console.warn("Klevby барахолка: пост-обновление после сохранения завершилось с ошибкой:", error);
        showMarketStatus("Товар сохранён. Обновление списка можно повторить вручную.", true);
      }
    } finally {
      marketSaveInProgress = false;
      setMarketSaveButtonState(false);
    }
  }

  async function editMarketItem(id) {
    await refreshMarketUser();

    const item = getMarketItemById(id);

    if (!item) return;

    if (!marketUser || String(item.owner_id || "") !== String(marketUser.id || "")) {
      alert("Редактировать может только владелец товара.");
      return;
    }

    editingMarketId = id;

    document.getElementById("marketTitleInput").value = item.title || "";
    document.getElementById("marketPriceInput").value = item.price || "";
    document.getElementById("marketCityInput").value = item.city || "";
    document.getElementById("marketCategoryInput").value = item.category || "";
    document.getElementById("marketConditionInput").value = item.condition || "";
    document.getElementById("marketDescriptionInput").value = item.description || "";
    document.getElementById("marketContactInput").value = item.contact_telegram || item.contact || item.telegram || "";
    const marketContacts = window.KlevbyMarket || {};
    const normalizedEditPhone = typeof marketContacts.normalizeMarketPhone === "function"
      ? marketContacts.normalizeMarketPhone(item.contact_phone || "")
      : String(item.contact_phone || "").trim();
    document.getElementById("marketPhoneInput").value = normalizedEditPhone;
    document.getElementById("marketWhatsAppInput").value = item.contact_whatsapp || "";
    document.getElementById("marketViberInput").value = item.contact_viber || "";
    document.getElementById("marketImageInput").value = item.image_url || "";

    document.getElementById("marketFormTitle").textContent = "Редактировать товар";
    document.getElementById("marketCancelEditBtn").classList.remove("hidden");

    setMarketFormOpen(true, { scroll: true });
  }

  function cancelMarketEdit() {
    editingMarketId = null;
    clearMarketForm();
    document.getElementById("marketFormTitle").textContent = "Добавить товар";
    document.getElementById("marketCancelEditBtn").classList.add("hidden");
    showMarketMessage("");
    setMarketFormOpen(false);
  }

  function clearMarketForm() {
    document.getElementById("marketTitleInput").value = "";
    document.getElementById("marketPriceInput").value = "";
    document.getElementById("marketCityInput").value = "";
    document.getElementById("marketCategoryInput").value = "";
    document.getElementById("marketConditionInput").value = "";
    document.getElementById("marketDescriptionInput").value = "";
    document.getElementById("marketContactInput").value = "";
    document.getElementById("marketPhoneInput").value = "";
    document.getElementById("marketWhatsAppInput").value = "";
    document.getElementById("marketViberInput").value = "";
    document.getElementById("marketImageInput").value = "";
    clearSelectedMarketPhoto();
  }

  function clearSelectedMarketPhoto() {
    const fileInput = document.getElementById("marketPhotoFileInput");
    const cameraInput = document.getElementById("marketPhotoCameraInput");
    const fileName = document.getElementById("marketPhotoFileName");
    const fileStatus = document.getElementById("marketPhotoSelectedStatus");
    const previewWrap = document.getElementById("marketPhotoPreviewWrap");
    const previewImage = document.getElementById("marketPhotoPreviewImage");
    const clearBtn = document.getElementById("marketPhotoClearBtn");

    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
    if (marketPreparedPhotoPreviewUrl) URL.revokeObjectURL(marketPreparedPhotoPreviewUrl);
    marketPreparedPhotoPreviewUrl = "";
    marketPreparedPhotoFile = null;
    marketSelectedPhotoFile = null;
    marketPhotoInvalid = false;
    if (fileName) fileName.textContent = "Файл не выбран";
    if (fileStatus) fileStatus.textContent = "Фото не выбрано";
    if (previewImage) previewImage.removeAttribute("src");
    if (previewWrap) previewWrap.classList.add("hidden");
    if (clearBtn) clearBtn.classList.add("hidden");
  }

  function showMarketPhotoPreview(file) {
    const fileName = document.getElementById("marketPhotoFileName");
    const fileStatus = document.getElementById("marketPhotoSelectedStatus");
    const previewWrap = document.getElementById("marketPhotoPreviewWrap");
    const previewImage = document.getElementById("marketPhotoPreviewImage");
    const clearBtn = document.getElementById("marketPhotoClearBtn");
    if (!file || !previewImage || !previewWrap) {
      clearSelectedMarketPhoto();
      return;
    }

    const uploader = window.KlevbyMarket || {};
    const canPrepare = typeof uploader.prepareMarketPhotoFile === "function";
    if (!canPrepare) {
      if (fileStatus) fileStatus.textContent = "Это фото не удалось открыть. Попробуй выбрать другое фото.";
      marketSelectedPhotoFile = file;
      marketPhotoInvalid = true;
      return;
    }
    if (fileName) fileName.textContent = file.name || "Файл выбран";
    marketSelectedPhotoFile = file;
    if (clearBtn) clearBtn.classList.remove("hidden");
    uploader.prepareMarketPhotoFile(file).then(function (prepared) {
      if (!prepared || !prepared.file || !prepared.previewUrl) throw new Error("MARKET_IMAGE_PROCESS_FAILED");
      if (marketPreparedPhotoPreviewUrl) URL.revokeObjectURL(marketPreparedPhotoPreviewUrl);
      marketPreparedPhotoPreviewUrl = prepared.previewUrl;
      marketPreparedPhotoFile = prepared.file;
      marketPhotoInvalid = false;
      if (fileStatus) fileStatus.textContent = "Фото готово";
      previewImage.src = prepared.previewUrl;
      previewWrap.classList.remove("hidden");
    }).catch(function (error) {
      const msg = String(error?.message || "");
      marketPreparedPhotoFile = null;
      marketSelectedPhotoFile = file;
      marketPhotoInvalid = true;
      previewImage.removeAttribute("src");
      previewWrap.classList.add("hidden");
      if (fileStatus) {
        fileStatus.textContent = msg.includes("MARKET_HEIC_UNSUPPORTED")
          ? "HEIC/HEIF пока не поддерживается. Выбери JPEG/PNG/WEBP."
          : "Это фото не удалось открыть. Попробуй выбрать другое фото.";
      }
    });
  }

  function bindMarketPhotoInput() {
    const fileInput = document.getElementById("marketPhotoFileInput");
    const cameraInput = document.getElementById("marketPhotoCameraInput");
    const fileName = document.getElementById("marketPhotoFileName");
    const fileStatus = document.getElementById("marketPhotoSelectedStatus");
    const clearBtn = document.getElementById("marketPhotoClearBtn");
    if (!fileInput || !cameraInput || !fileName || !fileStatus || !clearBtn || fileInput.dataset.marketBound === "1") return;

    fileInput.dataset.marketBound = "1";
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!file) {
        clearSelectedMarketPhoto();
        return;
      }
      showMarketPhotoPreview(file);
    });
    cameraInput.addEventListener("change", function () {
      const file = cameraInput.files && cameraInput.files[0] ? cameraInput.files[0] : null;
      if (!file) {
        clearSelectedMarketPhoto();
        return;
      }
      showMarketPhotoPreview(file);
    });

    clearBtn.addEventListener("click", function () {
      clearSelectedMarketPhoto();
    });
  }

  function bindMarketPhoneInput() {
    const phoneInput = document.getElementById("marketPhoneInput");
    if (!phoneInput || phoneInput.dataset.marketBound === "1") return;

    function extractBelarusLocalDigits(value) {
      const digits = String(value || "").replace(/\D/g, "");
      if (!digits) return "";
      return (digits.startsWith("375") ? digits.slice(3) : digits).slice(0, 9);
    }

    function formatBelarusPhoneInput(localDigits) {
      const digits = String(localDigits || "").replace(/\D/g, "").slice(0, 9);
      if (!digits) return "";

      const operator = digits.slice(0, 2);
      const part1 = digits.slice(2, 5);
      const part2 = digits.slice(5, 7);
      const part3 = digits.slice(7, 9);

      let formatted = "+375";
      if (operator) formatted += ` (${operator}`;
      if (operator.length === 2) formatted += ")";
      if (part1) formatted += ` ${part1}`;
      if (part2) formatted += `-${part2}`;
      if (part3) formatted += `-${part3}`;
      return formatted;
    }

    function placeCursorAtEnd() {
      const cursorPos = phoneInput.value.length;
      phoneInput.setSelectionRange(cursorPos, cursorPos);
    }

    phoneInput.dataset.marketBound = "1";
    phoneInput.addEventListener("focus", function () {
      if (phoneInput.value !== "") return;
      phoneInput.value = "+375 ";
      placeCursorAtEnd();
    });

    phoneInput.addEventListener("input", function () {
      const localDigits = extractBelarusLocalDigits(phoneInput.value);
      phoneInput.value = formatBelarusPhoneInput(localDigits);
      placeCursorAtEnd();
    });

    phoneInput.addEventListener("blur", function () {
      const localDigits = extractBelarusLocalDigits(phoneInput.value);
      if (localDigits.length !== 9) {
        phoneInput.value = "";
        return;
      }
      phoneInput.value = formatBelarusPhoneInput(localDigits);
    });
  }

  async function deleteMarketItem(id) {
    refreshMarketDbBinding();
    const safeUser = await ensureMarketUserForWrite();

    if (!safeUser) {
      showMarketMessage("Не удалось проверить авторизацию для удаления. Попробуй снова.", true);
      alert("Не удалось проверить авторизацию. Войди в аккаунт и попробуй снова.");
      return;
    }

    if (!confirm("Удалить товар из барахолки?")) return;

    let result;
    try {
      result = await deleteMarketItemViaRest(id, safeUser.id);
    } catch (error) {
      const msg = String(error?.message || "");
      if (msg.includes("MARKET_AUTH_REQUIRED")) {
        showMarketMessage("Сессия устарела. Войди снова и повтори действие.", true);
        return;
      }
      if (msg.includes("MARKET_TIMEOUT:market_items_delete_rest")) {
        showMarketMessage("Удаление заняло слишком много времени. Попробуй ещё раз.", true);
        return;
      }
      console.error("Klevby барахолка: REST-удаление товара не удалось:", error);
      showMarketMessage("Не получилось удалить товар. Попробуй ещё раз.", true);
      return;
    }

    if (result.error) {
      console.error(result.error);
      alert("Не получилось удалить товар. Удалить может только владелец.");
      return;
    }

    closeMarketItemDetails();

    try {
      await loadMarketItems({ force: true });
    } catch (error) {
      console.warn("Klevby барахолка: пост-обновление после удаления завершилось с ошибкой:", error);
      showMarketStatus("Товар удалён. Обновление списка можно повторить вручную.", true);
    }
  }

  async function applyMarketOwnerAction(id, action) {
    refreshMarketDbBinding();
    const safeUser = await ensureMarketUserForWrite();

    if (!safeUser) {
      showMarketMessage("Не удалось проверить авторизацию. Попробуй снова.", true);
      alert("Не удалось проверить авторизацию. Войди в аккаунт и попробуй снова.");
      return;
    }

    const item = getMarketItemById(id);

    if (!item || String(item.owner_id || "") !== String(safeUser.id || "")) {
      showMarketMessage("Управлять товаром может только владелец.", true);
      return;
    }

    const nowIso = new Date().toISOString();
    const renewed = new Date();
    renewed.setDate(renewed.getDate() + 30);

    let payload = null;
    let successMessage = "";

    if (action === "renew") {
      payload = {
        status: "active",
        expires_at: renewed.toISOString(),
        archived_at: null,
        sold_at: null
      };
      successMessage = isOwnerArchivedItem(item) ? "Продажа возобновлена на 30 дней." : "Объявление продлено на 30 дней.";
    } else if (action === "sold") {
      payload = {
        status: "sold",
        sold_at: nowIso
      };
      successMessage = "Объявление отмечено как проданное.";
    } else if (action === "archive") {
      payload = {
        status: "archived",
        archived_at: nowIso
      };
      successMessage = "Объявление отправлено в архив.";
    } else {
      showMarketMessage("Неизвестное действие.", true);
      return;
    }

    let result;
    try {
      result = await updateMarketItemViaRest(id, safeUser.id, payload);
    } catch (error) {
      const msg = String(error?.message || "");
      if (msg.includes("MARKET_AUTH_REQUIRED")) {
        showMarketMessage("Сессия устарела. Войди снова и повтори действие.", true);
        return;
      }
      if (msg.includes("MARKET_TIMEOUT:market_items_update_rest")) {
        showMarketMessage("Операция заняла слишком много времени. Попробуй ещё раз.", true);
        return;
      }
      console.error("Klevby барахолка: owner action не выполнено:", error);
      showMarketMessage("Не удалось выполнить действие. Попробуй ещё раз.", true);
      return;
    }

    if (result.error) {
      console.error(result.error);
      showMarketMessage("Не удалось выполнить действие. Проверь таблицу market_items и RLS.", true);
      return;
    }

    showMarketMessage(successMessage);

    try {
      await loadMarketItems({ force: true });
      if (action === "renew") {
        marketViewMode = "mine";
        marketOwnerTab = "active";
      } else if (action === "archive") {
        marketViewMode = "mine";
        marketOwnerTab = "archive";
      } else if (action === "sold") {
        marketViewMode = "mine";
        marketOwnerTab = "sold";
      }
      updateMarketViewControls();
      renderMarketItems();
      closeMarketItemDetails();
    } catch (error) {
      console.warn("Klevby барахолка: пост-обновление после owner action завершилось с ошибкой:", error);
      showMarketStatus("Операция выполнена. Обновление списка можно повторить вручную.", true);
    }
  }

  async function initMarket() {
    try {
      injectMarketStyles();
      renderMarketBase();
      bindMarketPhoneInput();
      bindMarketPhotoInput();

      refreshMarketDbBinding();

      if (!marketDb) {
        showMarketStatus("Supabase ещё не готов. Ждём подключение...");
        marketDb = await waitForMarketClient();
      }

      window.klevbyLoadMarket = function () {
        return loadMarketItems({ force: true });
      };

      window.renderMarketItems = renderMarketItems;
      window.handleMarketImageLoad = handleMarketImageLoad;
      window.handleMarketImageError = handleMarketImageError;
      window.saveMarketItem = saveMarketItem;
      window.editMarketItem = editMarketItem;
      window.cancelMarketEdit = cancelMarketEdit;
      window.deleteMarketItem = deleteMarketItem;
      window.applyMarketOwnerAction = applyMarketOwnerAction;
      window.toggleMarketForm = toggleMarketForm;
      window.toggleMarketFilters = toggleMarketFilters;
      window.openMarketItemDetails = openMarketItemDetails;
      window.closeMarketItemDetails = closeMarketItemDetails;
      window.toggleMarketOwnerActions = toggleMarketOwnerActions;
      window.handleMarketCardKeydown = handleMarketCardKeydown;
      window.applyMarketPendingNewItems = applyMarketPendingNewItems;
      window.switchMarketView = switchMarketView;
      window.switchMarketOwnerTab = switchMarketOwnerTab;

      await loadMarketItems({ force: true });
      subscribeMarketRealtime();

      console.log("Klevby барахолка запущена.");
    } catch (error) {
      console.error("Ошибка запуска барахолки:", error);

      const root = document.getElementById("marketRoot");
      if (root) {
        root.innerHTML = `<div class="info-line error-line">Ошибка запуска барахолки. Проверь market-logic.js и основной Supabase client.</div>`;
      }
    }
  }

  window.addEventListener("klevby-auth-changed", handleMarketAuthChanged);

  window.addEventListener("beforeunload", unsubscribeMarketRealtime);
  window.addEventListener("klevby-app-resumed", function () {
    recoverMarketOnResume("klevby-app-resumed").catch((error) => {
      console.warn("Klevby барахолка: не удалось восстановиться после возобновления приложения:", error);
    });
  });

  function startMarketWhenAllowed() {
    const appSurface = window.KlevbyAppSurface;

    if (appSurface && typeof appSurface.runWhenAllowed === "function") {
      appSurface.runWhenAllowed(initMarket);
      return;
    }

    initMarket();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMarketWhenAllowed);
  } else {
    startMarketWhenAllowed();
  }
})();
