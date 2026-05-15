(function () {
  const POSTS_RENDER_VERSION = "20260515-posts-render-trip-date-1";
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

  function normalizeTripDate(value) {
    const raw = String(value || "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    return "";
  }

  function getTodayLocalIso() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function isPostExpired(post, todayIso = getTodayLocalIso()) {
    const tripDate = normalizeTripDate(post?.trip_date);

    if (!tripDate) {
      return false;
    }

    return tripDate < todayIso;
  }

  function getCreatedAtTime(post) {
    const time = post?.created_at ? new Date(post.created_at).getTime() : 0;

    return Number.isFinite(time) ? time : 0;
  }

  function sortActivePosts(posts, todayIso = getTodayLocalIso()) {
    return [...posts].sort((a, b) => {
      const aTripDate = normalizeTripDate(a?.trip_date);
      const bTripDate = normalizeTripDate(b?.trip_date);

      const aHasActiveDate = Boolean(aTripDate && aTripDate >= todayIso);
      const bHasActiveDate = Boolean(bTripDate && bTripDate >= todayIso);

      if (aHasActiveDate && bHasActiveDate) {
        if (aTripDate !== bTripDate) {
          return aTripDate.localeCompare(bTripDate);
        }

        return getCreatedAtTime(b) - getCreatedAtTime(a);
      }

      if (aHasActiveDate) {
        return -1;
      }

      if (bHasActiveDate) {
        return 1;
      }

      return getCreatedAtTime(b) - getCreatedAtTime(a);
    });
  }

  function formatTripDate(value) {
    const tripDate = normalizeTripDate(value);

    if (!tripDate) {
      return "";
    }

    const parts = tripDate.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) {
      return tripDate;
    }

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short"
    });
  }

  function tryOpenPostModal(id) {
    if (window.KlevbyPostsModal && typeof window.KlevbyPostsModal.openPostModal === "function") {
      window.KlevbyPostsModal.openPostModal(id);
      return true;
    }

    if (typeof window.openPostModal === "function") {
      window.openPostModal(id);
      return true;
    }

    return false;
  }

  function openPostModalSafe(id) {
    const safeId = String(id || "").trim();

    if (!safeId) {
      console.warn("Klevby posts render: пустой id карточки, модалка не открыта.");
      return;
    }

    if (tryOpenPostModal(safeId)) {
      return;
    }

    setTimeout(() => {
      if (tryOpenPostModal(safeId)) {
        return;
      }

      console.warn("Klevby posts render: post modal module недоступен", {
        id: safeId,
        hasKlevbyPostsModal: Boolean(window.KlevbyPostsModal),
        openPostModalType: typeof window.KlevbyPostsModal?.openPostModal,
        globalOpenPostModalType: typeof window.openPostModal
      });
    }, 120);
  }

  function shouldIgnoreCardClick(event) {
    return Boolean(
      event.target.closest("button") ||
      event.target.closest("a") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea") ||
      event.target.closest("[data-no-card-open]")
    );
  }

  function bindPostCardOpenHandlers(container) {
    if (!container) return;

    const cards = Array.from(container.querySelectorAll(".trip-card[data-post-id]"));

    cards.forEach((card) => {
      if (card.dataset.klevbyOpenBound === "1") {
        return;
      }

      card.dataset.klevbyOpenBound = "1";

      card.addEventListener("click", (event) => {
        if (shouldIgnoreCardClick(event)) {
          return;
        }

        openPostModalSafe(card.dataset.postId);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        if (shouldIgnoreCardClick(event)) {
          return;
        }

        event.preventDefault();
        openPostModalSafe(card.dataset.postId);
      });
    });
  }

  function ensurePostsRenderStyles() {
    let style = document.getElementById("klevby-posts-render-actions-style");

    if (!style) {
      style = document.createElement("style");
      style.id = "klevby-posts-render-actions-style";
      document.head.appendChild(style);
    }

    style.textContent = `
      #postsSection .trip-card {
        display: flex !important;
        flex-direction: column;
        height: 100%;
        cursor: pointer;
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
    const todayIso = getTodayLocalIso();

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

    const activePosts = allPosts.filter((post) => !isPostExpired(post, todayIso));
    const expiredCount = Math.max(0, allPosts.length - activePosts.length);

    let filtered = sortActivePosts(activePosts, todayIso);

    if (mode === "mine") {
      filtered = filtered.filter((post) => isOwnPost(post, ownerId));
      showStatusSafe(
        expiredCount
          ? `Сейчас показаны: мои актуальные выезды. Старые выезды скрыты: ${expiredCount}.`
          : "Сейчас показаны: мои актуальные выезды."
      );
    } else {
      showStatusSafe(
        expiredCount
          ? `Сейчас показаны: актуальные выезды. Старые выезды скрыты: ${expiredCount}.`
          : "Сейчас показаны: все актуальные объявления о выездах."
      );
    }

    if (search) {
      filtered = filtered.filter(post =>
        normalizeText(post.name).includes(search) ||
        normalizeText(post.city).includes(search) ||
        normalizeText(post.destination).includes(search) ||
        normalizeText(post.trip_time).includes(search) ||
        normalizeText(post.trip_date).includes(search) ||
        normalizeText(formatTripDate(post.trip_date)).includes(search) ||
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
      let emptyText = "Пока актуальных объявлений о выездах нет.";

      if (activePosts.length && allPosts.length) {
        emptyText = "По фильтрам ничего не найдено.";
      } else if (allPosts.length && expiredCount === allPosts.length) {
        emptyText = "Все выезды уже прошли. Новые актуальные объявления появятся здесь.";
      }

      console.info("Klevby posts: empty render state", {
        allCount: allPosts.length,
        activeCount: activePosts.length,
        expiredCount,
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
    bindPostCardOpenHandlers(list);

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
    const tripDateText = formatTripDate(post?.trip_date);
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
        data-post-id="${safeId}"
        role="button"
        tabindex="0"
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
              <div class="trip-fact-value">${escapeHtml(tripTime || tripDateText || date || "Не указано")}</div>
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
            ${tripDateText ? `<span class="tag">🗓️ ${escapeHtml(tripDateText)}</span>` : ""}
            ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
            ${tg ? '<span class="tag">Telegram</span>' : ''}
            ${canManage ? '<span class="tag">моё</span>' : ''}
          </div>

          <div class="actions" data-no-card-open="1">
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
    openPostModalSafe,
    isPostExpired,
    sortActivePosts
  };

  ensurePostsRenderStyles();

  console.log("Klevby posts render loaded", {
    version: POSTS_RENDER_VERSION
  });
})();
