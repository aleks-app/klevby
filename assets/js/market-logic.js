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

  let marketFormOpen = false;
  let marketFiltersOpen = false;

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

  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function getMarketImage(item) {
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
    const formBox = document.getElementById("marketFormBox");
    const filtersBox = document.getElementById("marketFiltersBox");
    const formBtn = document.getElementById("marketToggleFormBtn");
    const filtersBtn = document.getElementById("marketToggleFiltersBtn");

    if (formBox) {
      formBox.classList.toggle("hidden", !marketFormOpen);
    }

    if (filtersBox) {
      filtersBox.classList.toggle("hidden", !marketFiltersOpen);
    }

    if (formBtn) {
      formBtn.textContent = marketFormOpen ? "Скрыть форму" : "+ Добавить товар";
      formBtn.setAttribute("aria-expanded", String(marketFormOpen));
    }

    if (filtersBtn) {
      filtersBtn.textContent = marketFiltersOpen ? "Скрыть фильтры" : "Фильтры";
      filtersBtn.setAttribute("aria-expanded", String(marketFiltersOpen));
    }
  }

  function setMarketFormOpen(open, options = {}) {
    marketFormOpen = Boolean(open);
    updateMarketUiState();

    if (marketFormOpen && options.scroll) {
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
    marketFiltersOpen = Boolean(open);
    updateMarketUiState();

    if (marketFiltersOpen && options.scroll) {
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
    const nextOpen = !marketFormOpen;
    setMarketFormOpen(nextOpen, { scroll: nextOpen });
  }

  function toggleMarketFilters() {
    const nextOpen = !marketFiltersOpen;
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
          <input id="marketImageInput" placeholder="Ссылка на фото товара, можно оставить пустым" />

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
    const el = document.getElementById("marketMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(244,251,247,0.66)";
  }

  function showMarketStatus(message, isError = false) {
    const el = document.getElementById("marketStatusLine");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("error-line", isError);
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

  const marketDetailsController = window.KlevbyMarket && typeof window.KlevbyMarket.createDetailsController === "function"
    ? window.KlevbyMarket.createDetailsController({
        getItems: function () {
          return marketItems;
        },
        getUser: function () {
          return marketUser;
        },
        helpers: {
          escapeHtml: escapeHtml,
          cleanTelegram: cleanTelegram,
          getMarketImage: getMarketImage
        }
      })
    : null;

  function ensureMarketDetailsOverlay() {
    if (marketDetailsController && typeof marketDetailsController.ensureMarketDetailsOverlay === "function") {
      return marketDetailsController.ensureMarketDetailsOverlay();
    }

    console.warn("Klevby барахолка: market-details.js не загружен");
    return null;
  }

  function handleMarketDetailsEscape(event) {
    if (marketDetailsController && typeof marketDetailsController.handleMarketDetailsEscape === "function") {
      return marketDetailsController.handleMarketDetailsEscape(event);
    }
  }

  function handleMarketCardKeydown(event, id) {
    if (marketDetailsController && typeof marketDetailsController.handleMarketCardKeydown === "function") {
      return marketDetailsController.handleMarketCardKeydown(event, id);
    }
  }

  function marketDetailsHtml(item) {
    if (marketDetailsController && typeof marketDetailsController.marketDetailsHtml === "function") {
      return marketDetailsController.marketDetailsHtml(item);
    }

    return "";
  }

  function openMarketItemDetails(id) {
    if (marketDetailsController && typeof marketDetailsController.openMarketItemDetails === "function") {
      return marketDetailsController.openMarketItemDetails(id);
    }

    console.warn("Klevby барахолка: market-details.js не загружен");
  }

  function closeMarketItemDetails() {
    if (marketDetailsController && typeof marketDetailsController.closeMarketItemDetails === "function") {
      return marketDetailsController.closeMarketItemDetails();
    }
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
    const contact = cleanTelegram(document.getElementById("marketContactInput").value);
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
    document.getElementById("marketContactInput").value = item.contact || item.telegram || "";
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

      await loadMarketItems({ force: true });

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMarket);
  } else {
    initMarket();
  }
})();
