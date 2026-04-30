(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  let marketDb = null;
  let marketItems = [];
  let marketUser = null;
  let editingMarketId = null;

  function waitForSupabase() {
    return new Promise(function (resolve, reject) {
      let tries = 0;

      const timer = setInterval(function () {
        tries++;

        if (window.supabase) {
          clearInterval(timer);
          resolve();
        }

        if (tries > 80) {
          clearInterval(timer);
          reject(new Error("Supabase library not loaded"));
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
    if (document.getElementById("marketStyles")) return;

    const style = document.createElement("style");
    style.id = "marketStyles";

    style.textContent = `
      .market-hero {
        margin: 14px 0;
        padding: 24px;
        border-radius: 16px;
        background:
          radial-gradient(circle at 0% 0%, rgba(66,217,134,0.12), transparent 34%),
          radial-gradient(circle at 100% 0%, rgba(88,183,255,0.10), transparent 36%),
          rgba(18, 30, 36, 0.88);
        box-shadow: 0 16px 44px rgba(0,0,0,0.24);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .market-hero h1 {
        margin: 0 0 8px;
        font-size: clamp(32px, 5vw, 54px);
        line-height: 1.08;
        letter-spacing: -1px;
        color: #ffffff;
        font-weight: 800;
      }

      .market-hero p {
        max-width: 720px;
        margin: 0;
        color: rgba(244,251,247,0.72);
        font-size: 16px;
        line-height: 1.55;
      }

      .market-layout {
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 16px;
        align-items: start;
      }

      .market-panel {
        background: rgba(18, 30, 36, 0.9);
        border-radius: 16px;
        padding: 22px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .market-panel h2 {
        margin: 0 0 14px;
        color: #ffffff;
        font-size: 22px;
        font-weight: 800;
      }

      .market-note {
        margin: 10px 0 0;
        color: rgba(244,251,247,0.62);
        font-size: 13px;
        line-height: 1.45;
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
        border-radius: 16px;
        background: rgba(18, 30, 36, 0.92);
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        transition: 0.22s ease;
      }

      .market-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(0,0,0,0.28);
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
        color: #42d986;
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

      @media (max-width: 380px) {
        .market-grid {
          gap: 10px;
        }

        .market-img {
          height: 100px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function injectMarketSection() {
    if (document.getElementById("marketSection")) return;

    const main = document.querySelector("main.wrap");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "marketSection";
    section.className = "hidden";

    section.innerHTML = `
      <div class="market-hero">
        <h1>Барахолка рыбаков</h1>
        <p>
          Продай или найди снасти, катушки, удилища, лодки, эхолоты и всё, что связано с рыбалкой.
          Раздел спрятан в меню, чтобы сайт не был перегружен.
        </p>
      </div>

      <div class="market-layout">
        <div class="market-panel">
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

    const footer = main.querySelector(".footer");

    if (footer) {
      main.insertBefore(section, footer);
    } else {
      main.appendChild(section);
    }
  }

  function injectMarketMenuButton() {
    const mobileMenu = document.getElementById("mobileMenu");

    if (mobileMenu && !document.getElementById("marketMenuBtn")) {
      const btn = document.createElement("button");
      btn.id = "marketMenuBtn";
      btn.className = "mobile-menu-item";
      btn.textContent = "Барахолка";
      btn.onclick = function () {
        showSection("market");
        if (typeof closeMobileMenu === "function") closeMobileMenu();
      };

      const authBtn = Array.from(mobileMenu.querySelectorAll("button")).find(function (button) {
        return button.textContent.trim() === "Вход";
      });

      if (authBtn) {
        mobileMenu.insertBefore(btn, authBtn);
      } else {
        mobileMenu.appendChild(btn);
      }
    }

    const desktopNav = document.querySelector("nav");

    if (desktopNav && !document.getElementById("marketDesktopBtn")) {
      const btn = document.createElement("button");
      btn.id = "marketDesktopBtn";
      btn.className = "nav-btn";
      btn.textContent = "Барахолка";
      btn.onclick = function () {
        showSection("market");
      };

      desktopNav.appendChild(btn);
    }
  }

  function patchShowSection() {
    if (window.__klevbyMarketShowSectionPatched) return;
    if (typeof window.showSection !== "function") return;

    const originalShowSection = window.showSection;

    window.showSection = function (section) {
      originalShowSection(section);

      const marketSection = document.getElementById("marketSection");
      if (marketSection) {
        marketSection.classList.toggle("hidden", section !== "market");
      }

      if (section === "market") {
        setTimeout(function () {
          loadMarketItems();
        }, 100);
      }
    };

    window.__klevbyMarketShowSectionPatched = true;
  }

  async function refreshMarketUser() {
    const result = await marketDb.auth.getUser();
    marketUser = result.data && result.data.user ? result.data.user : null;
    return marketUser;
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
      showMarketStatus("Не удалось загрузить барахолку. Проверь таблицу market_items.", true);
      grid.innerHTML = "";
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
      ? `<button class="small-btn yellow" onclick="editMarketItem('${item.id}')">Редактировать</button>`
      : "";

    const deleteBtn = canManage
      ? `<button class="small-btn red" onclick="deleteMarketItem('${item.id}')">Удалить</button>`
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
    await refreshMarketUser();

    if (!marketUser) {
      showSection("auth");
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

    if (result.error && String(result.error.message || "").includes("contact")) {
      const fallbackPayload = { ...payload };
      fallbackPayload.telegram = fallbackPayload.contact;
      delete fallbackPayload.contact;

      if (editingMarketId) {
        result = await marketDb
          .from("market_items")
          .update(fallbackPayload)
          .eq("id", editingMarketId);
      } else {
        result = await marketDb
          .from("market_items")
          .insert([fallbackPayload]);
      }
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

    document.getElementById("marketSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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
    if (!confirm("Удалить товар из барахолки?")) return;

    const result = await marketDb
      .from("market_items")
      .delete()
      .eq("id", id);

    if (result.error) {
      console.error(result.error);
      alert("Не получилось удалить товар. Удалить может только владелец.");
      return;
    }

    await loadMarketItems();
  }

  async function initMarket() {
    try {
      await waitForSupabase();

      marketDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      injectMarketStyles();
      injectMarketSection();
      injectMarketMenuButton();
      patchShowSection();

      window.loadMarketItems = loadMarketItems;
      window.renderMarketItems = renderMarketItems;
      window.saveMarketItem = saveMarketItem;
      window.editMarketItem = editMarketItem;
      window.cancelMarketEdit = cancelMarketEdit;
      window.deleteMarketItem = deleteMarketItem;

      await loadMarketItems();

      console.log("Klevby барахолка запущена.");
    } catch (error) {
      console.error("Ошибка запуска барахолки:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMarket();
  });
})();
