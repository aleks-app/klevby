(function () {
  window.KlevbyMarket = window.KlevbyMarket || {};

  function fallbackEscapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fallbackCleanTelegram(value) {
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

  function fallbackGetMarketImage(item) {
    const image = String(item?.image_url || "").trim();

    if (image) return image;

    return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80";
  }

  function createDetailsController(options = {}) {
    const getItems = typeof options.getItems === "function" ? options.getItems : function () {
      return [];
    };

    const getUser = typeof options.getUser === "function" ? options.getUser : function () {
      return null;
    };

    const helpers = options.helpers || {};
    const escapeHtml = typeof helpers.escapeHtml === "function" ? helpers.escapeHtml : fallbackEscapeHtml;
    const cleanTelegram = typeof helpers.cleanTelegram === "function" ? helpers.cleanTelegram : fallbackCleanTelegram;
    const getMarketImage = typeof helpers.getMarketImage === "function" ? helpers.getMarketImage : fallbackGetMarketImage;

    function findItemById(id) {
      const items = getItems();

      return items.find(function (x) {
        return String(x.id) === String(id);
      });
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

    function handleMarketCardKeydown(event, id) {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      openMarketItemDetails(id);
    }

    function marketDetailsHtml(item) {
      const contact = cleanTelegram(item.contact || item.telegram);
      const ownerId = getUser() ? getUser().id : null;
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
      const item = findItemById(id);

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

    return {
      ensureMarketDetailsOverlay,
      handleMarketDetailsEscape,
      handleMarketCardKeydown,
      marketDetailsHtml,
      openMarketItemDetails,
      closeMarketItemDetails
    };
  }

  window.KlevbyMarket.createDetailsController = createDetailsController;

  console.log("Klevby market details loaded");
})();