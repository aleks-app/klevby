(function () {
  let marketDb = null;
  let marketItems = [];
  let marketUser = null;
  let editingMarketId = null;
  let marketRendered = false;

  let marketUserRefreshPromise = null;
  let marketLastUserRefreshAt = 0;
  let marketLoadPromise = null;
  let marketLoadTimer = null;
  let marketPendingForceReload = false;
  let marketRealtimeChannel = null;
  let marketHasPendingNewItems = false;
  let marketOpenDetailsItemId = null;

  const MARKET_AUTH_REFRESH_THROTTLE_MS = 3000;
  const MARKET_LOAD_RETRY_DELAY_MS = 900;

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
        const result = await marketDb.auth.getUser();

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
        console.warn("Klevby барахолка: ошибка получения пользователя:", error);
        marketUser = getMainUser() || null;
        return marketUser;
      } finally {
        marketUserRefreshPromise = null;
      }
    })();

    return marketUserRefreshPromise;
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

    if (!marketDb) {
      marketDb = getMainSupabaseClient();
    }

    const grid = document.getElementById("marketItemsGrid");

    if (!grid) return;

    if (!marketDb) {
      showMarketStatus("Supabase ещё не готов. Повторяем загрузку барахолки...");
      scheduleMarketLoad(800, true);
      return;
    }

    if (marketLoadPromise) {
      if (force) {
        marketPendingForceReload = true;
      }

      return marketLoadPromise;
    }

    marketPendingForceReload = false;

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
        result = await marketDb
          .from("market_items")
          .select("*")
          .order("created_at", { ascending: false });
      } catch (error) {
        if (isAuthLockError(error) && retry < 2) {
          console.warn("Klevby барахолка: Supabase Auth занят, повторяем загрузку:", error);
          showMarketStatus("Подключение занято, повторяем загрузку барахолки...");
          setTimeout(() => {
            loadMarketItems({ force: true, retry: retry + 1 }).catch(() => {});
          }, MARKET_LOAD_RETRY_DELAY_MS);
          return;
        }

        console.error("Ошибка загрузки барахолки:", error);
        showMarketStatus("Не удалось загрузить барахолку. Попробуй обновить страницу.", true);

        if (!marketItems.length) {
          grid.innerHTML = `<div class="info-line error-line">Ошибка загрузки барахолки. Проверь интернет или Supabase.</div>`;
        }

        return;
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
    await refreshMarketUser({ force: true });

    if (!marketUser) {
      if (typeof showSection === "function") showSection("auth");
      alert("Сначала войди или зарегистрируйся, чтобы добавить товар.");
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
      owner_id: marketUser.id
    };

    let result;

    if (editingMarketId) {
      result = await marketDb
        .from("market_items")
        .update(payload)
        .eq("id", editingMarketId)
        .eq("owner_id", marketUser.id);
    } else {
      result = await marketDb
        .from("market_items")
        .insert([payload]);
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

    await loadMarketItems({ force: true });
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
    await refreshMarketUser({ force: true });

    if (!marketUser) {
      alert("Сначала войди в аккаунт.");
      return;
    }

    if (!confirm("Удалить товар из барахолки?")) return;

    const result = await marketDb
      .from("market_items")
      .delete()
      .eq("id", id)
      .eq("owner_id", marketUser.id);

    if (result.error) {
      console.error(result.error);
      alert("Не получилось удалить товар. Удалить может только владелец.");
      return;
    }

    closeMarketItemDetails();

    await loadMarketItems({ force: true });
  }

  async function initMarket() {
    try {
      injectMarketStyles();
      renderMarketBase();

      marketDb = getMainSupabaseClient();

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMarket);
  } else {
    initMarket();
  }
})();
