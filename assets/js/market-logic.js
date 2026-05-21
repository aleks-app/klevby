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
    if (document.getElementById("klevbyMarketStyles")) return;

    const style = document.createElement("style");
    style.id = "klevbyMarketStyles";

    style.textContent = `
      .market-layout {
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: stretch;
      }

      .market-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        justify-content: flex-start;
        margin: 0 0 2px;
      }

      .market-toolbar-left {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .market-toolbar-btn {
        min-height: 42px;
        padding: 11px 16px;
        border-radius: 999px;
        font-size: 14px;
        line-height: 1.1;
        white-space: nowrap;
      }

      .market-form-box {
        max-width: 760px;
        width: 100%;
        background: rgba(255,255,255,0.045);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 22px;
        padding: 20px;
      }

      .market-form-box h2 {
        margin: 0 0 14px;
        font-size: 22px;
        color: #ffffff;
        font-weight: 800;
      }

      .market-note {
        margin-top: 12px;
        color: rgba(244,251,247,0.58);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 500;
      }

      .market-list-panel {
        width: 100%;
      }

      .market-filters {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr 0.8fr;
        gap: 10px;
        margin-bottom: 12px;
      }

      .market-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      .market-card {
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 10px 28px rgba(0,0,0,0.22);
        transition: 0.22s ease;
        cursor: pointer;
      }

      .market-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 34px rgba(0,0,0,0.30);
        border-color: rgba(244,178,74,0.22);
      }

      .market-card:active {
        transform: translateY(-1px) scale(0.992);
      }

      .market-card:focus-visible {
        outline: 2px solid rgba(255,183,69,0.92);
        outline-offset: 4px;
      }

      .market-img {
        position: relative;
        height: 150px;
        background-size: cover;
        background-position: center;
      }

      .market-open-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 7px 10px;
        border-radius: 999px;
        background: rgba(5,10,8,0.72);
        color: rgba(255,255,255,0.92);
        border: 1px solid rgba(255,255,255,0.16);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(0,0,0,0.26);
      }

      .market-body {
        padding: 15px;
      }

      .market-title {
        margin: 0 0 7px;
        color: #ffffff;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.25;
      }

      .market-price {
        margin-bottom: 8px;
        color: #57e6b2;
        font-size: 20px;
        font-weight: 800;
      }

      .market-text {
        color: rgba(244,251,247,0.66);
        font-size: 13px;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .market-card-more {
        margin-top: 10px;
        color: rgba(255,190,82,0.92);
        font-size: 12px;
        line-height: 1.25;
        font-weight: 900;
      }

      .market-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 12px 0;
      }

      .market-tag {
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        color: rgba(244,251,247,0.72);
        font-size: 11px;
        font-weight: 700;
      }

      .market-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        align-items: center;
        margin-top: 12px;
      }

      .market-actions .small-btn {
        padding: 9px 12px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.1;
      }

      .market-contact-missing {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.055);
        color: rgba(244,251,247,0.55);
        font-size: 12px;
        font-weight: 800;
      }

      .market-details-open {
        overflow: hidden;
      }

      .market-details-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 22px;
      }

      .market-details-backdrop {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        padding: 0;
        background: rgba(0,0,0,0.68);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        cursor: pointer;
      }

      .market-details-panel {
        position: relative;
        z-index: 1;
        width: min(920px, 100%);
        max-height: min(86vh, 840px);
        overflow: auto;
        border-radius: 28px;
        background:
          radial-gradient(circle at 14% 0%, rgba(244,178,74,0.16), transparent 34%),
          linear-gradient(180deg, rgba(26,35,30,0.98), rgba(8,14,12,0.98));
        border: 1px solid rgba(255,255,255,0.11);
        box-shadow: 0 28px 80px rgba(0,0,0,0.48);
      }

      .market-details-close {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 3;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 999px;
        background: rgba(0,0,0,0.42);
        color: #ffffff;
        font-size: 24px;
        line-height: 1;
        font-weight: 800;
        cursor: pointer;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .market-details-img {
        min-height: 330px;
        background-size: cover;
        background-position: center;
        border-radius: 28px 28px 0 0;
      }

      .market-details-body {
        padding: 24px;
      }

      .market-details-kicker {
        margin: 0 0 8px;
        color: rgba(255,190,82,0.94);
        font-size: 13px;
        line-height: 1.25;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .market-details-title {
        margin: 0 0 10px;
        color: #ffffff;
        font-size: clamp(28px, 5vw, 44px);
        line-height: 1.02;
        letter-spacing: -0.9px;
        font-weight: 900;
      }

      .market-details-price {
        margin: 0 0 16px;
        color: #57e6b2;
        font-size: 32px;
        line-height: 1.05;
        font-weight: 900;
      }

      .market-details-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 18px;
      }

      .market-details-description {
        margin: 0;
        color: rgba(244,251,247,0.78);
        font-size: 16px;
        line-height: 1.62;
        white-space: pre-wrap;
      }

      .market-details-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }

      .market-details-actions .small-btn {
        min-height: 44px;
        padding: 12px 16px;
        border-radius: 16px;
      }

      @media (max-width: 900px) {
        .market-layout {
          gap: 12px;
        }

        .market-toolbar {
          align-items: stretch;
        }

        .market-toolbar-left {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .market-toolbar-btn {
          width: 100%;
          min-height: 46px;
          padding: 12px 12px;
          font-size: 13px;
        }

        .market-form-box {
          max-width: none;
          padding: 16px;
          border-radius: 22px;
        }

        .market-form-box h2 {
          font-size: 21px;
        }

        .market-filters {
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .market-grid {
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .market-img {
          height: 120px;
        }

        .market-body {
          padding: 12px;
        }

        .market-title {
          font-size: 13px;
        }

        .market-price {
          font-size: 16px;
        }

        .market-text {
          font-size: 12px;
          -webkit-line-clamp: 2;
        }

        .market-card-more {
          font-size: 11px;
        }

        .market-actions .small-btn {
          padding: 8px 10px;
          font-size: 12px;
        }

        .market-details-overlay {
          align-items: flex-end;
          padding: 0;
        }

        .market-details-panel {
          width: 100%;
          max-height: 92vh;
          border-radius: 28px 28px 0 0;
        }

        .market-details-img {
          min-height: 260px;
          border-radius: 28px 28px 0 0;
        }

        .market-details-body {
          padding: 20px 18px calc(24px + env(safe-area-inset-bottom));
        }

        .market-details-title {
          font-size: 30px;
        }

        .market-details-price {
          font-size: 28px;
        }

        .market-details-description {
          font-size: 15px;
        }
      }

      @media (max-width: 430px) {
        .market-grid {
          grid-template-columns: 1fr;
        }

        .market-img {
          height: 178px;
        }

        .market-title {
          font-size: 18px;
        }

        .market-price {
          font-size: 22px;
        }

        .market-text {
          font-size: 14px;
          -webkit-line-clamp: 3;
        }

        .market-open-badge {
          min-height: 32px;
          padding: 8px 11px;
          font-size: 11px;
        }

        .market-actions {
          gap: 8px;
        }

        .market-actions .small-btn {
          min-height: 38px;
          padding: 9px 12px;
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(style);
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

  function handleMarketCardKeydown(event, id) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openMarketItemDetails(id);
  }

  function marketCardHtml(item) {
    const contact = cleanTelegram(item.contact || item.telegram);
    const ownerId = marketUser ? marketUser.id : null;
    const canManage = ownerId && item.owner_id === ownerId;
    const image = getMarketImage(item);
    const safeId = escapeHtml(item.id);

    const contactBlock = contact
      ? `<button class="small-btn green" type="button" onclick="event.stopPropagation(); window.open('https://t.me/${escapeHtml(contact)}','_blank')">Написать</button>`
      : `<span class="market-contact-missing">Контакт не указан</span>`;

    const editBtn = canManage
      ? `<button class="small-btn yellow" type="button" onclick="event.stopPropagation(); editMarketItem('${safeId}')">Редактировать</button>`
      : "";

    const deleteBtn = canManage
      ? `<button class="small-btn red" type="button" onclick="event.stopPropagation(); deleteMarketItem('${safeId}')">Удалить</button>`
      : "";

    return `
      <article class="market-card" role="button" tabindex="0" onclick="openMarketItemDetails('${safeId}')" onkeydown="handleMarketCardKeydown(event, '${safeId}')">
        <div class="market-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42)), url('${escapeHtml(image)}')">
          <span class="market-open-badge">Открыть</span>
        </div>

        <div class="market-body">
          <h3 class="market-title">${escapeHtml(item.title || "Товар")}</h3>
          <div class="market-price">${escapeHtml(item.price || "Цена не указана")}</div>

          <div class="market-text">${escapeHtml(item.description || "Описание не указано")}</div>
          <div class="market-card-more">Подробнее →</div>

          <div class="market-tags">
            ${item.city ? `<span class="market-tag">📍 ${escapeHtml(item.city)}</span>` : ""}
            ${item.category ? `<span class="market-tag">🎣 ${escapeHtml(item.category)}</span>` : ""}
            ${item.condition ? `<span class="market-tag">${escapeHtml(item.condition)}</span>` : ""}
            ${contact ? `<span class="market-tag">Telegram</span>` : ""}
          </div>

          <div class="market-actions">
            ${contactBlock}
            ${editBtn}
            ${deleteBtn}
          </div>
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
    const contact = cleanTelegram(item.contact || item.telegram);
    const ownerId = marketUser ? marketUser.id : null;
    const canManage = ownerId && item.owner_id === ownerId;
    const image = getMarketImage(item);
    const safeId = escapeHtml(item.id);

    const contactBlock = contact
      ? `<button class="small-btn green" type="button" onclick="window.open('https://t.me/${escapeHtml(contact)}','_blank')">Написать продавцу</button>`
      : `<span class="market-contact-missing">Контакт не указан</span>`;

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
            ${contact ? `<span class="market-tag">Telegram</span>` : ""}
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
    document.body.classList.add("market-details-open");
    document.addEventListener("keydown", handleMarketDetailsEscape);
  }

  function closeMarketItemDetails() {
    const overlay = document.getElementById("marketDetailsOverlay");

    if (overlay) {
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
    }

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
