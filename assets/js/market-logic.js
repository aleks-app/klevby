(function () {
  let marketDb = null;
  let marketItems = [];
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

  const MARKET_AUTH_REFRESH_THROTTLE_MS = 3000;
  const MARKET_LOAD_RETRY_DELAY_MS = 900;
  const MARKET_AUTH_TIMEOUT_MS = 7000;
  const MARKET_LOAD_TIMEOUT_MS = 9000;
  const MARKET_STALE_LOAD_MS = 12000;
  const MARKET_RESUME_RECOVER_THROTTLE_MS = 1500;

  function getMainSupabaseClient() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getMainUser() {
    return (
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      marketUser ||
      null
    );
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

    const endpoint = `${restConfig.supabaseUrl}/rest/v1/market_items?select=*&order=created_at.desc`;
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

    return String(value || "").toLowerCase().trim();
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
      filtersBtn.textContent = marketUiState.marketFiltersOpen ? "Скрыть фильтры" : "Фильтры";
      filtersBtn.setAttribute("aria-expanded", String(marketUiState.marketFiltersOpen));
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
        <div class="market-toolbar">
          <div class="market-toolbar-left">
            <button id="marketToggleFormBtn" class="small-btn green market-toolbar-btn" type="button" onclick="toggleMarketForm()" aria-expanded="false">
              + Добавить товар
            </button>

            <button id="marketToggleFiltersBtn" class="small-btn gray market-toolbar-btn" type="button" onclick="toggleMarketFilters()" aria-expanded="false">
              Фильтры
            </button>
          </div>
        </div>

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
            <input id="marketPhoneInput" placeholder="Телефон: +375..." />
            <input id="marketWhatsAppInput" placeholder="WhatsApp: номер или ссылка" />
          </div>
          <div class="form-row">
            <input id="marketViberInput" placeholder="Viber: номер" />
            <input id="marketImageInput" placeholder="Ссылка на фото товара, можно оставить пустым" />
          </div>

          <div class="actions">
            <button class="small-btn green" type="button" onclick="saveMarketItem()">Сохранить</button>
            <button id="marketCancelEditBtn" class="small-btn gray hidden" type="button" onclick="cancelMarketEdit()">Отмена</button>
          </div>

          <div id="marketMessage" class="auth-status"></div>

          <div class="market-note">
            Чтобы добавить товар, нужно войти на сайт. Это защищает объявления от чужого удаления.
          </div>
        </div>

        <div class="market-list-panel">
          <div id="marketFiltersBox" class="market-filters hidden">
            <input id="marketSearchInput" placeholder="Поиск: катушка, лодка, Shimano..." oninput="renderMarketItems()" />

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

          <div id="marketStatusLine" class="info-line">Загрузка барахолки...</div>
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

  async function refreshMarketUser(options = {}) {
    refreshMarketDbBinding();

    const force = Boolean(options.force);
    const now = Date.now();

    const mainUser = getMainUser();

    if (mainUser && mainUser.id) {
      marketUser = mainUser;
      marketLastUserRefreshAt = now;
      return marketUser;
    }

    if (!marketDb?.auth?.getUser) {
      marketUser = null;
      return null;
    }

    if (!force && marketUser && marketUser.id && now - marketLastUserRefreshAt < MARKET_AUTH_REFRESH_THROTTLE_MS) {
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

        if (marketUser) {
          window.klevbyCurrentUser = marketUser;
          window.currentUser = marketUser;
          window.klevbyUser = marketUser;
        }

        return marketUser;
      } catch (error) {
        if (String(error && error.message || "").includes("MARKET_TIMEOUT:auth.getUser")) {
          console.warn("Klevby барахолка: auth.getUser timeout, используем fallback пользователя");
        } else {
          console.warn("Klevby барахолка: ошибка получения пользователя:", error);
        }
        marketUser = getMainUser() || marketUser || null;
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
    if (!isMarketVisible()) return;
    const now = Date.now();
    if (now - marketLastResumeRecoverAt < MARKET_RESUME_RECOVER_THROTTLE_MS) return;
    marketLastResumeRecoverAt = now;

    resetStaleMarketLoadLock(reason || "resume");
    refreshMarketDbBinding();

    await refreshMarketUser();
    subscribeMarketRealtime();
    await loadMarketItems({ force: true });
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
    }

    marketRealtimeChannel = null;
  }

  function subscribeMarketRealtime() {
    if (!marketDb || typeof marketDb.channel !== "function") return;
    if (marketRealtimeChannel) return;

    try {
      marketRealtimeChannel = marketDb
        .channel("klevby-market-items-live")
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

          let updated = false;
          marketItems = marketItems.map(function (item) {
            if (String(item.id) !== String(updatedId)) return item;
            updated = true;
            return updatedRow;
          });

          if (!updated) return;

          renderMarketItems();

          if (marketOpenDetailsItemId && String(marketOpenDetailsItemId) === String(updatedId)) {
            openMarketItemDetails(updatedId);
          }
        })
        .subscribe(function (status) {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("Klevby барахолка: realtime недоступен, продолжаем без live-уведомлений:", status);
          }
        });
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

    let filtered = [...marketItems];

    if (search) {
      filtered = filtered.filter(function (item) {
        return (
          normalizeText(item.title).includes(search) ||
          normalizeText(item.description).includes(search) ||
          normalizeText(item.category).includes(search) ||
          normalizeText(item.city).includes(search) ||
          normalizeText(item.price).includes(search)
        );
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

    showMarketStatus(`Товаров в барахолке: ${filtered.length}`);

    if (!filtered.length) {
      grid.innerHTML = `<div class="info-line">Пока товаров нет. Добавь первый товар.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(marketCardHtml).join("");
  }

  function handleMarketCardKeydown(event, id) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openMarketItemDetails(id);
  }

  function marketCardHtml(item) {
    const image = getMarketImage(item);
    const safeId = escapeHtml(item.id);

    return `
      <article class="market-card" role="button" tabindex="0" onclick="openMarketItemDetails('${safeId}')" onkeydown="handleMarketCardKeydown(event, '${safeId}')">
        <div class="market-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42)), url('${escapeHtml(image)}')">
          <span class="market-open-badge">Открыть</span>
        </div>

        <div class="market-body">
          <h3 class="market-title">${escapeHtml(item.title || "Товар")}</h3>
          <div class="market-price">${escapeHtml(item.price || "Цена не указана")}</div>
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

    const editBtn = canManage
      ? `<button class="small-btn yellow" type="button" onclick="closeMarketItemDetails(); editMarketItem('${safeId}')">Редактировать</button>`
      : "";

    const deleteBtn = canManage
      ? `<button class="small-btn red" type="button" onclick="closeMarketItemDetails(); deleteMarketItem('${safeId}')">Удалить</button>`
      : "";

    return `
      <button class="market-details-backdrop" type="button" onclick="closeMarketItemDetails()" aria-label="Закрыть карточку товара"></button>

      <section class="market-details-panel" role="dialog" aria-modal="true" aria-label="Карточка товара">
        <button class="market-details-close" type="button" onclick="closeMarketItemDetails()" aria-label="Закрыть">×</button>

        <div class="market-details-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.38)), url('${escapeHtml(image)}')"></div>

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
            ${contactBlock}
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
      </section>
    `;
  }

  function openMarketItemDetails(id) {
    const item = marketItems.find(function (x) {
      return String(x.id) === String(id);
    });

    if (!item) return;

    const overlay = ensureMarketDetailsOverlay();

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
    document.body.classList.remove("market-details-open");
    document.removeEventListener("keydown", handleMarketDetailsEscape);
  }

  async function saveMarketItem() {
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

    if (!title || !price || !city || !description) {
      showMarketMessage("Заполни название, цену, город и описание.", true);
      return;
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
      image_url: imageUrl,
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
  }

  async function editMarketItem(id) {
    await refreshMarketUser();

    const item = marketItems.find(function (x) {
      return String(x.id) === String(id);
    });

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
    document.getElementById("marketPhoneInput").value = item.contact_phone || "";
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

  async function initMarket() {
    try {
      injectMarketStyles();
      renderMarketBase();

      refreshMarketDbBinding();

      if (!marketDb) {
        showMarketStatus("Supabase ещё не готов. Ждём подключение...");
        marketDb = await waitForMarketClient();
      }

      window.klevbyLoadMarket = function () {
        return loadMarketItems({ force: true });
      };

      window.renderMarketItems = renderMarketItems;
      window.saveMarketItem = saveMarketItem;
      window.editMarketItem = editMarketItem;
      window.cancelMarketEdit = cancelMarketEdit;
      window.deleteMarketItem = deleteMarketItem;
      window.toggleMarketForm = toggleMarketForm;
      window.toggleMarketFilters = toggleMarketFilters;
      window.openMarketItemDetails = openMarketItemDetails;
      window.closeMarketItemDetails = closeMarketItemDetails;
      window.handleMarketCardKeydown = handleMarketCardKeydown;
      window.applyMarketPendingNewItems = applyMarketPendingNewItems;

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

  window.addEventListener("klevby-auth-changed", function () {
    const mainUser = getMainUser();

    if (mainUser && mainUser.id) {
      marketUser = mainUser;
      renderMarketItems();
    }
  });

  window.addEventListener("beforeunload", unsubscribeMarketRealtime);
  window.addEventListener("focus", function () {
    recoverMarketOnResume("window-focus").catch((error) => {
      console.warn("Klevby барахолка: не удалось восстановиться после focus:", error);
    });
  });
  window.addEventListener("pageshow", function () {
    recoverMarketOnResume("pageshow").catch((error) => {
      console.warn("Klevby барахолка: не удалось восстановиться после pageshow:", error);
    });
  });
  window.addEventListener("klevby-app-resumed", function () {
    recoverMarketOnResume("klevby-app-resumed").catch((error) => {
      console.warn("Klevby барахолка: не удалось восстановиться после возобновления приложения:", error);
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    recoverMarketOnResume("visibilitychange").catch((error) => {
      console.warn("Klevby барахолка: не удалось восстановиться после visibilitychange:", error);
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMarket);
  } else {
    initMarket();
  }
})();
