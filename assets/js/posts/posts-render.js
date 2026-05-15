(function () {
  const POSTS_RENDER_VERSION = "20260515-posts-render-clean-actions-open-modal-1";
  const TELEGRAM_ICON_SRC = "assets/img/telegram.png";

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

  function isOwnPost(post, ownerId = getOwnerId()) {
    return Boolean(ownerId && post?.owner_id && String(post.owner_id) === String(ownerId));
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

  function getTelegramGroupUrl() {
    const config = window.KLEVB_CONFIG || {};
    return config.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
  }

  function openTelegramSafe() {
    if (typeof window.openTelegram === "function") {
      window.openTelegram();
      return;
    }

    window.open(getTelegramGroupUrl(), "_blank", "noopener");
  }

  function openPostModalSafe(id) {
    if (window.KlevbyPostsModal && typeof window.KlevbyPostsModal.openPostModal === "function") {
      window.KlevbyPostsModal.openPostModal(id);
      return;
    }

    if (typeof window.openPostModal === "function") {
      window.openPostModal(id);
      return;
    }

    console.warn("Klevby posts render: post modal module недоступен", {
      id,
      hasKlevbyPostsModal: Boolean(window.KlevbyPostsModal),
      openPostModalType: typeof window.KlevbyPostsModal?.openPostModal,
      globalOpenPostModalType: typeof window.openPostModal
    });
  }

  function ensurePostsRenderStyles() {
    if (document.getElementById("klevby-posts-render-actions-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "klevby-posts-render-actions-style";
    style.textContent = `
      #postsSection .trip-card {
        display: flex !important;
        flex-direction: column;
        height: 100%;
      }

      #postsSection .trip-card .card-body {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
      }

      #postsSection .trip-card .actions {
        display: grid !important;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-top: auto;
        padding-top: 12px;
      }

      #postsSection .trip-card .actions:empty {
        display: none !important;
      }

      #postsSection .trip-card .actions .small-btn {
        width: 100%;
        min-height: 38px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        white-space: normal;
        line-height: 1.1;
      }

      #postsSection .trip-card .trip-telegram-btn {
        font-weight: 900;
        letter-spacing: 0.01em;
      }

      #postsSection .trip-telegram-icon {
        width: 21px;
        height: 21px;
        border-radius: 999px;
        overflow: hidden;
        flex: 0 0 21px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #229ed9;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.22);
      }

      #postsSection .trip-telegram-icon img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        mix-blend-mode: multiply;
      }

      #postsSection .trip-telegram-icon.is-missing::before {
        content: "TG";
        color: #ffffff;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: -0.04em;
      }

      #postsSection .trip-telegram-icon.is-missing img {
        display: none;
      }

      @media (min-width: 768px) {
        #postsSection .trip-card .actions {
          max-width: 230px;
        }
      }

      @media (max-width: 767px) {
        #postsSection .trip-card .actions {
          display: grid !important;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-top: auto;
          padding-top: 12px;
        }

        #postsSection .trip-card .actions .small-btn {
          min-height: 42px;
          border-radius: 15px;
          font-size: 11px;
        }

        #postsSection .trip-telegram-icon {
          width: 22px;
          height: 22px;
          flex-basis: 22px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderPosts() {
    ensurePostsRenderStyles();

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
      filtered = filtered.filter((post) => isOwnPost(post, ownerId));
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

  function getTelegramIconHtml() {
    return `
      <span class="trip-telegram-icon" aria-hidden="true">
        <img
          src="${escapeAttr(TELEGRAM_ICON_SRC)}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.parentElement.classList.add('is-missing'); this.remove();"
        >
      </span>
    `;
  }

  function cardHtml(post) {
    const id = post?.id;
    const tg = cleanTelegram(post?.telegram);
    const ownerId = getOwnerId();
    const canManage = isOwnPost(post, ownerId);
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
    const telegramIcon = getTelegramIconHtml();

    const tgButton = tg
      ? `
        <button
          class="small-btn green trip-telegram-btn"
          type="button"
          title="Написать автору в Telegram"
          onclick="event.stopPropagation(); window.open('https://t.me/${escapeAttr(tg)}','_blank','noopener')"
        >
          ${telegramIcon}
          <span>Написать</span>
        </button>
      `
      : `
        <button
          class="small-btn green trip-telegram-btn"
          type="button"
          title="Открыть Telegram-чат Klevby"
          onclick="event.stopPropagation(); window.KlevbyPostsRender.openTelegramSafe()"
        >
          ${telegramIcon}
          <span>Telegram</span>
        </button>
      `;

    const date = post?.created_at
      ? new Date(post.created_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    return `
      <div
        class="card trip-card ${canManage ? "can-manage" : ""}"
        role="button"
        tabindex="0"
        onclick="window.KlevbyPostsRender.openPostModalSafe('${safeId}')"
        onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); window.KlevbyPostsRender.openPostModalSafe('${safeId}'); }"
      >
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
              <div class="trip-fact-value">${escapeHtml(seats || "Уточнить")}</div>
            </div>
          </div>

          <p class="trip-description">${escapeHtml(post?.text || "")}</p>

          <div class="tags">
            <span class="tag">🎣 выезд</span>
            ${city ? `<span class="tag">📍 ${escapeHtml(city)}</span>` : ""}
            ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
            ${tg ? '<span class="tag">Telegram</span>' : ''}
            ${canManage ? '<span class="tag">моё</span>' : ''}
          </div>

          <div class="actions">
            ${tgButton}
          </div>
        </div>
      </div>
    `;
  }

  window.KlevbyPostsRender = {
    renderPosts,
    cardHtml,
    openTelegramSafe,
    openPostModalSafe
  };

  ensurePostsRenderStyles();

  console.log("Klevby posts render loaded", {
    version: POSTS_RENDER_VERSION
  });
})();
