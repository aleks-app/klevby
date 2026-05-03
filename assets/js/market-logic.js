(function () {
  let marketDb = null;
  let marketItems = [];
  let marketUser = null;
  let editingMarketId = null;
  let marketRendered = false;

  let marketUserRefreshPromise = null;
  let marketLastUserRefreshAt = 0;

  const MARKET_AUTH_REFRESH_THROTTLE_MS = 2500;

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

        if (tries > 80) {
          clearInterval(timer);
          reject(new Error("Основной Supabase client не найден"));
        }
      }, 100);
    });
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
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 16px;
        align-items: start;
      }

      .market-form-box {
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

      .market-filters {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr 0.8fr;
        gap: 10px;
        margin-bottom: 14px;
      }

      .market-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }

      .market-card {
        overflow: hidden;
        border-radius: 20px;
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 10px 28px rgba(0,0,0,0.22);
        transition: 0.22s ease;
      }

      .market-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 34px rgba(0,0,0,0.30);
      }

      .market-img {
        height: 150px;
        background-size: cover;
        background-position: center;
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
        margin-top: 12px;
      }

      @media (max-width: 900px) {
        .market-layout {
          grid-template-columns: 1fr;
        }

        .market-filters {
          grid-template-columns: 1fr;
        }

        .market-grid {
          grid-template-columns: 1fr 1fr;
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
      }

      @media (max-width: 430px) {
        .market-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderMarketBase() {
    const root = document.getElementById("marketRoot");
    if (!root || marketRendered) return;

    root.innerHTML = `
      <div class="market-layout">
        <div class="market-form-box">
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
            <button class="small-btn green" onclick="saveMarketItem()">Сохранить</button>
            <button id="marketCancelEditBtn" class="small-btn gray hidden" onclick="cancelMarketEdit()">Отмена</button>
          </div>

          <div id="marketMessage" class="auth-status"></div>

          <div class="market-note">
            Чтобы добавить товар, нужно войти на сайт. Это защищает объявления от чужого удаления.
          </div>
        </div>

        <div>
          <div class="market-filters">
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

  async function loadMarketItems() {
    renderMarketBase();

    const grid = document.getElementById("marketItemsGrid");
    if (!grid || !marketDb) return;

    showMarketStatus("Загрузка барахолки...");

    grid.innerHTML = `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;

    await refreshMarketUser();

    const result = await marketDb
      .from("market_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error(result.error);
      showMarketStatus("Не удалось загрузить барахолку. Проверь таблицу market_items в Supabase.", true);
      grid.innerHTML = `<div class="info-line error-line">Ошибка загрузки барахолки. Проверь таблицу market_items.</div>`;
      return;
    }

    marketItems = result.data || [];
    renderMarketItems();
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

  function marketCardHtml(item) {
    const contact = cleanTelegram(item.contact || item.telegram);
    const ownerId = marketUser ? marketUser.id : null;
    const canManage = ownerId && item.owner_id === ownerId;
    const image = getMarketImage(item);

    const contactBtn = contact
      ? `<button class="small-btn green" onclick="window.open('https://t.me/${escapeHtml(contact)}','_blank')">Написать</button>`
      : `<button class="small-btn gray" disabled>Нет контакта</button>`;

    const editBtn = canManage
      ? `<button class="small-btn yellow" onclick="editMarketItem('${escapeHtml(item.id)}')">Редактировать</button>`
      : "";

    const deleteBtn = canManage
      ? `<button class="small-btn red" onclick="deleteMarketItem('${escapeHtml(item.id)}')">Удалить</button>`
      : "";

    return `
      <div class="market-card">
        <div class="market-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42)), url('${escapeHtml(image)}')"></div>

        <div class="market-body">
          <h3 class="market-title">${escapeHtml(item.title || "Товар")}</h3>
          <div class="market-price">${escapeHtml(item.price || "Цена не указана")}</div>

          <div class="market-text">${escapeHtml(item.description || "Описание не указано")}</div>

          <div class="market-tags">
            ${item.city ? `<span class="market-tag">📍 ${escapeHtml(item.city)}</span>` : ""}
            ${item.category ? `<span class="market-tag">🎣 ${escapeHtml(item.category)}</span>` : ""}
            ${item.condition ? `<span class="market-tag">${escapeHtml(item.condition)}</span>` : ""}
            ${contact ? `<span class="market-tag">Telegram</span>` : ""}
          </div>

          <div class="market-actions">
            ${contactBtn}
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
      </div>
    `;
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
        .eq("id", editingMarketId);
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

    await loadMarketItems();
  }

  function editMarketItem(id) {
    const item = marketItems.find(function (x) {
      return String(x.id) === String(id);
    });

    if (!item) return;

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

    const marketSection = document.getElementById("marketSection");
    if (marketSection) {
      marketSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  function cancelMarketEdit() {
    editingMarketId = null;
    clearMarketForm();
    document.getElementById("marketFormTitle").textContent = "Добавить товар";
    document.getElementById("marketCancelEditBtn").classList.add("hidden");
    showMarketMessage("");
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
    await refreshMarketUser();

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

    await loadMarketItems();
  }

  async function initMarket() {
    try {
      injectMarketStyles();

      marketDb = await waitForMarketClient();

      window.klevbyLoadMarket = loadMarketItems;
      window.renderMarketItems = renderMarketItems;
      window.saveMarketItem = saveMarketItem;
      window.editMarketItem = editMarketItem;
      window.cancelMarketEdit = cancelMarketEdit;
      window.deleteMarketItem = deleteMarketItem;

      renderMarketBase();
      await loadMarketItems();

      console.log("Klevby барахолка запущена.");
    } catch (error) {
      console.error("Ошибка запуска барахолки:", error);

      const root = document.getElementById("marketRoot");
      if (root) {
        root.innerHTML = `<div class="info-line error-line">Ошибка запуска барахолки. Проверь market-logic.js и основной Supabase client.</div>`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMarket);
  } else {
    initMarket();
  }
})();
