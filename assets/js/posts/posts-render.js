(function () {
  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getUtils() {
    return window.KlevbyPostsUtils || {};
  }

  function getPostsArray() {
    const state = getState();

    if (typeof state.getPostsArray === "function") {
      return state.getPostsArray();
    }

    if (Array.isArray(window.posts)) return window.posts;
    if (Array.isArray(window.klevbyPosts)) return window.klevbyPosts;

    return [];
  }

  function getOwnerId() {
    const state = getState();

    if (typeof state.getOwnerId === "function") {
      return state.getOwnerId();
    }

    const user =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;

    return user ? user.id : null;
  }

  function getCurrentViewMode() {
    const state = getState();

    if (typeof state.getCurrentViewMode === "function") {
      return state.getCurrentViewMode();
    }

    return window.klevbyViewMode || "all";
  }

  function hasActivePostsLoad() {
    const state = getState();

    return Boolean(
      (typeof state.getPostsLoadPromise === "function" && state.getPostsLoadPromise()) ||
      (typeof state.getPostsPendingForceReload === "function" && state.getPostsPendingForceReload())
    );
  }

  function isAdminSafe() {
    if (typeof window.isAdmin === "function") {
      return window.isAdmin();
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function showStatusSafe(message, isError = false) {
    const utils = getUtils();

    if (typeof utils.showStatusSafe === "function") {
      utils.showStatusSafe(message, isError);
      return;
    }

    if (typeof window.showStatus === "function") {
      window.showStatus(message, isError);
      return;
    }

    const status = document.getElementById("statusLine");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error-line", Boolean(isError));
  }

  function cleanTelegram(value) {
    const utils = getUtils();

    if (typeof utils.cleanTelegram === "function") {
      return utils.cleanTelegram(value);
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
    const utils = getUtils();

    if (typeof utils.normalizeText === "function") {
      return utils.normalizeText(value);
    }

    return String(value || "").toLowerCase().trim();
  }

  function normalizeSelectFilterValue(elementId) {
    const utils = getUtils();

    if (typeof utils.normalizeSelectFilterValue === "function") {
      return utils.normalizeSelectFilterValue(elementId);
    }

    const value = normalizeText(document.getElementById(elementId)?.value);

    if (!value) return "";

    if (
      value === "выберите город" ||
      value === "все города" ||
      value === "город" ||
      value === "способ ловли" ||
      value === "выберите способ ловли" ||
      value === "тип ловли" ||
      value === "все способы"
    ) {
      return "";
    }

    return value;
  }

  function escapeHtml(text) {
    const utils = getUtils();

    if (typeof utils.escapeHtml === "function") {
      return utils.escapeHtml(text);
    }

    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(text) {
    const utils = getUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(text);
    }

    return escapeHtml(text).replaceAll("`", "&#096;");
  }

  function getPostFishingType(post) {
    const utils = getUtils();

    if (typeof utils.getPostFishingType === "function") {
      return utils.getPostFishingType(post);
    }

    return post?.fishing_type || post?.type || post?.category || "";
  }

  function getFishingTypeClass(type) {
    const utils = getUtils();

    if (typeof utils.getFishingTypeClass === "function") {
      return utils.getFishingTypeClass(type);
    }

    const t = normalizeText(type);

    if (t.includes("спин")) return "type-spinning";
    if (t.includes("фидер")) return "type-feeder";
    if (t.includes("поплав")) return "type-float";
    if (t.includes("карп")) return "type-carp";
    if (t.includes("зим")) return "type-winter";

    return "";
  }

  function getCardImage(post) {
    const utils = getUtils();

    if (typeof utils.getCardImage === "function") {
      return utils.getCardImage(post);
    }

    return "assets/img/klevby-icon-512.png";
  }

  function openTelegramSafe() {
    const utils = getUtils();

    if (typeof utils.openTelegramSafe === "function") {
      utils.openTelegramSafe();
      return;
    }

    if (typeof window.openTelegram === "function") {
      window.openTelegram();
      return;
    }

    const config = window.KLEVB_CONFIG || {};
    const link = config.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
    window.open(link, "_blank");
  }

  function renderPosts() {
    const list = document.getElementById("postsSection");
    if (!list) return;

    const allPosts = getPostsArray();
    const search = normalizeText(document.getElementById("searchInput")?.value);
    const selectedCity = normalizeSelectFilterValue("citySelect");
    const selectedType = normalizeSelectFilterValue("typeSelect");
    const telegramOnly = document.getElementById("telegramOnly")?.checked;
    const ownerId = getOwnerId();
    const mode = getCurrentViewMode();

    if (!allPosts.length && hasActivePostsLoad()) {
      showStatusSafe("Загрузка объявлений...");

      list.innerHTML = `
        <div class="info-line">
          Загружаем объявления о выездах…
        </div>
      `;

      if (typeof window.updateHomeFloatButton === "function") {
        setTimeout(window.updateHomeFloatButton, 80);
      }

      return;
    }

    let filtered = [...allPosts];

    if (mode === "mine") {
      filtered = filtered.filter(post => ownerId && post.owner_id === ownerId);
      showStatusSafe("Сейчас показаны: мои выезды.");
    } else {
      showStatusSafe("Сейчас показаны: все объявления о выездах.");
    }

    if (search) {
      filtered = filtered.filter(post =>
        normalizeText(post.name).includes(search) ||
        normalizeText(post.city).includes(search) ||
        normalizeText(post.destination).includes(search) ||
        normalizeText(post.trip_time).includes(search) ||
        normalizeText(post.transport).includes(search) ||
        normalizeText(post.seats).includes(search) ||
        normalizeText(post.text).includes(search) ||
        normalizeText(getPostFishingType(post)).includes(search)
      );
    }

    if (selectedCity) {
      filtered = filtered.filter(post => normalizeText(post.city).includes(selectedCity));
    }

    if (selectedType) {
      filtered = filtered.filter(post => normalizeText(getPostFishingType(post)).includes(selectedType));
    }

    if (telegramOnly) {
      filtered = filtered.filter(post => cleanTelegram(post.telegram));
    }

    if (!filtered.length) {
      const emptyText = allPosts.length
        ? "По фильтрам ничего не найдено."
        : "Пока объявлений о выездах нет.";

      console.info("Klevby posts: empty render state", {
        allCount: allPosts.length,
        mode,
        search,
        selectedCity,
        selectedType,
        telegramOnly: Boolean(telegramOnly)
      });

      list.innerHTML = `
        <div class="info-line">
          ${emptyText}
          <div style="margin-top:12px;">
            <button class="small-btn green" type="button" onclick="showSection('create')">Создать выезд</button>
          </div>
        </div>
      `;

      if (typeof window.updateHomeFloatButton === "function") {
        setTimeout(window.updateHomeFloatButton, 80);
      }

      return;
    }

    const cards = filtered
      .map((post) => {
        try {
          return cardHtml(post);
        } catch (error) {
          console.error("Ошибка отрисовки карточки объявления:", post, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    if (!cards) {
      list.innerHTML = `
        <div class="info-line error-line">
          Объявления загрузились, но карточки не отрисовались. Смотри Console.
        </div>
      `;
      return;
    }

    list.innerHTML = cards;

    if (typeof window.updateHomeFloatButton === "function") {
      setTimeout(window.updateHomeFloatButton, 80);
    }
  }

  function cardHtml(post) {
    const id = post?.id;
    const tg = cleanTelegram(post?.telegram);
    const ownerId = getOwnerId();
    const canManage = isAdminSafe() || (ownerId && post?.owner_id === ownerId);
    const isFull = Boolean(post?.crew_full);
    const image = getCardImage(post);
    const fishingType = getPostFishingType(post);
    const fishingTypeClass = getFishingTypeClass(fishingType);

    const name = post?.name || "Рыбак";
    const city = post?.city || "";
    const destination = post?.destination || "";
    const tripTime = post?.trip_time || "";
    const transport = post?.transport || "";
    const seats = post?.seats || "";
    const titleDestination = destination || city || "рыбалку";

    const safeId = escapeAttr(id);

    const tgButton = isFull
      ? `<button class="small-btn disabled" disabled onclick="event.stopPropagation()">Экипаж набран</button>`
      : tg
        ? `<button class="small-btn green" onclick="event.stopPropagation(); window.open('https://t.me/${escapeAttr(tg)}','_blank')">Написать автору</button>`
        : `<button class="small-btn green" onclick="event.stopPropagation(); openTelegramSafe()">Написать в общий чат</button>`;

    const fullBtn = canManage
      ? `<button class="small-btn ${isFull ? "gray" : "blue"}" onclick="event.stopPropagation(); toggleCrewFull('${safeId}', ${isFull ? "false" : "true"})">${isFull ? "Снова ищу" : "Экипаж набран"}</button>`
      : "";

    const editBtn = canManage
      ? `<button class="small-btn yellow" onclick="event.stopPropagation(); editPost('${safeId}')">Редактировать</button>`
      : "";

    const deleteBtn = canManage
      ? `<button class="small-btn red" onclick="event.stopPropagation(); deletePost('${safeId}')">Удалить</button>`
      : "";

    const date = post?.created_at
      ? new Date(post.created_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    return `
      <div class="card trip-card ${isFull ? "full" : ""}" onclick="openPostModal('${safeId}')">
        <div class="card-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.35)), url('${escapeAttr(image)}')"></div>

        <div class="card-body">
          <div class="trip-title">
            <span class="trip-name">${escapeHtml(name)}</span>
            <span> едет на </span>
            <span class="trip-destination">${escapeHtml(titleDestination)}</span>
          </div>

          <div class="trip-facts">
            <div class="trip-fact">
              <div class="trip-fact-label">Когда</div>
              <div class="trip-fact-value">${escapeHtml(tripTime || date || "Не указано")}</div>
            </div>

            <div class="trip-fact">
              <div class="trip-fact-label">Тип</div>
              <div class="trip-fact-value">${escapeHtml(fishingType || "Не указано")}</div>
            </div>

            <div class="trip-fact">
              <div class="trip-fact-label">Транспорт</div>
              <div class="trip-fact-value">${escapeHtml(transport || "Не указано")}</div>
            </div>

            <div class="trip-fact">
              <div class="trip-fact-label">Места</div>
              <div class="trip-fact-value">${escapeHtml(seats || (isFull ? "Экипаж набран" : "Уточнить"))}</div>
            </div>
          </div>

          <p class="trip-description">${escapeHtml(post?.text || "")}</p>

          <div class="tags">
            <span class="tag">🎣 выезд</span>
            ${city ? `<span class="tag">📍 ${escapeHtml(city)}</span>` : ""}
            ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
            ${isFull ? '<span class="tag full">экипаж набран</span>' : ''}
            ${tg ? '<span class="tag">Telegram</span>' : ''}
            ${ownerId && post?.owner_id === ownerId ? '<span class="tag">моё</span>' : ''}
          </div>

          <div class="actions">
            ${tgButton}
            ${fullBtn}
            ${editBtn}
            ${deleteBtn}
          </div>
        </div>
      </div>
    `;
  }

  window.KlevbyPostsRender = {
    renderPosts,
    cardHtml
  };

  console.log("Klevby posts render loaded", {
    version: "20260514-posts-render-split-1"
  });
})();
