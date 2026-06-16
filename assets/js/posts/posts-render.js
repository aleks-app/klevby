(function () {
  const POSTS_RENDER_VERSION = "20260605-mine-trips-archive-1";
  const TELEGRAM_ICON_SRC = "assets/img/telegram.png";

  let mobileFilterExpanded = false;
  let lastMobileFilterSummary = "Все актуальные объявления";

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

  function getMineTripsMode() {
    const state = getState();

    if (typeof state.getMineTripsMode === "function") {
      return state.getMineTripsMode();
    }

    return window.klevbyMineTripsMode === "expired" ? "expired" : "active";
  }

  function hasActivePostsLoad() {
    const state = getState();

    return Boolean(
      (typeof state.getPostsLoadPromise === "function" && state.getPostsLoadPromise()) ||
      (typeof state.getPostsPendingForceReload === "function" && state.getPostsPendingForceReload())
    );
  }

  function hasPostsInitialLoadDone() {
    const state = getState();

    if (typeof state.hasPostsInitialLoadDone === "function") {
      return state.hasPostsInitialLoadDone();
    }

    return false;
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
    const state = getState();

    if (typeof state.normalizeTripDate === "function") {
      return state.normalizeTripDate(value);
    }

    return "";
  }

  function partitionTrips(posts, options = {}) {
    const state = getState();

    if (typeof state.partitionTrips === "function") {
      return state.partitionTrips(posts, options);
    }

    const safePosts = Array.isArray(posts) ? posts : [];
    const ownerId = options.ownerId ?? null;

    return {
      activeAll: [],
      expiredAll: [],
      undatedAll: safePosts,
      activeMine: [],
      expiredMine: [],
      undatedMine: safePosts.filter((post) => isOwnPost(post, ownerId))
    };
  }

  function getCreatedAtTime(post) {
    const time = post?.created_at ? new Date(post.created_at).getTime() : 0;

    return Number.isFinite(time) ? time : 0;
  }

  function sortActivePosts(posts) {
    return [...posts].sort((a, b) => {
      const aTripDate = normalizeTripDate(a?.trip_date);
      const bTripDate = normalizeTripDate(b?.trip_date);

      const aHasActiveDate = Boolean(aTripDate);
      const bHasActiveDate = Boolean(bTripDate);

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
      month: "long"
    });
  }

  function formatTripWhen(post) {
    const tripDateText = formatTripDate(post?.trip_date);
    const tripTime = String(post?.trip_time || "").trim();

    if (tripDateText && tripTime) {
      return `${tripDateText} · ${tripTime}`;
    }

    if (tripDateText) {
      return tripDateText;
    }

    return "Дата не указана";
  }

  function isMobileFilterViewport() {
    try {
      return window.matchMedia("(max-width: 767px)").matches;
    } catch (error) {
      return window.innerWidth <= 767;
    }
  }

  function getActiveFilterCount(context = {}) {
    let count = 0;

    if (context.search) count += 1;
    if (context.selectedCity) count += 1;
    if (context.selectedType) count += 1;
    if (context.telegramOnly) count += 1;

    return count;
  }

  function getMobileFilterSummary(context = {}) {
    const activeCount = getActiveFilterCount(context);
    const mode = context.mode || "all";
    const mineTripsMode = context.mineTripsMode === "expired" ? "expired" : "active";
    const expiredCount = Number(context.expiredCount || 0);

    if (activeCount) {
      return `Фильтр включён: ${activeCount}`;
    }

    if (mode === "mine" && mineTripsMode === "expired") {
      return "Мои прошедшие выезды";
    }

    if (mode === "mine") {
      return expiredCount
        ? `Мои актуальные · Прошедшие: ${expiredCount}`
        : "Мои актуальные выезды";
    }

    return "Все актуальные объявления";
  }

  function updateMineTripsSwitcher(mode, mineTripsMode, expiredCount = 0) {
    const switcher = document.getElementById("mineTripsSwitcher");
    if (!switcher) return;

    const isMine = mode === "mine";
    switcher.classList.toggle("hidden", !isMine);

    switcher.querySelectorAll("[data-mine-trips-mode]").forEach((button) => {
      const isActive = button.dataset.mineTripsMode === mineTripsMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const count = document.getElementById("mineExpiredTripsCount");
    if (count) {
      count.textContent = expiredCount ? String(expiredCount) : "";
      count.classList.toggle("hidden", !expiredCount);
    }
  }

  function setMobileFilterExpanded(value) {
    mobileFilterExpanded = Boolean(value);

    const card = document.querySelector("#tripsSection .filter-card");
    if (!card) return;

    card.classList.toggle("is-mobile-filter-expanded", mobileFilterExpanded);
    card.classList.toggle("is-mobile-filter-collapsed", !mobileFilterExpanded);
    card.setAttribute("data-mobile-expanded", mobileFilterExpanded ? "true" : "false");

    const title = card.querySelector(".filter-title");
    if (title) {
      title.setAttribute("aria-expanded", mobileFilterExpanded ? "true" : "false");
    }

    const toggle = card.querySelector(".klevby-mobile-filter-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", mobileFilterExpanded ? "true" : "false");
      toggle.textContent = mobileFilterExpanded ? "Скрыть" : "Фильтр";
    }
  }

  function updateMobileFilterSummary(context = {}) {
    const card = document.querySelector("#tripsSection .filter-card");
    if (!card) return;

    lastMobileFilterSummary = getMobileFilterSummary(context);

    const summary = card.querySelector(".klevby-mobile-filter-summary");
    if (summary) {
      summary.textContent = lastMobileFilterSummary;
    }

    const badge = card.querySelector(".klevby-mobile-filter-badge");
    if (badge) {
      const count = getActiveFilterCount(context);
      badge.textContent = count ? String(count) : "";
      badge.classList.toggle("hidden", !count);
    }
  }

  function setupMobileFilterShell() {
    const card = document.querySelector("#tripsSection .filter-card");
    if (!card) return;

    const title = card.querySelector(".filter-title");
    const filters = card.querySelector(".filters");

    if (!title || !filters) return;

    card.classList.add("klevby-mobile-filter-card");

    let mobileMeta = title.querySelector(".klevby-mobile-filter-meta");

    if (!mobileMeta) {
      mobileMeta = document.createElement("div");
      mobileMeta.className = "klevby-mobile-filter-meta";
      mobileMeta.innerHTML = `
        <span class="klevby-mobile-filter-summary">${escapeHtml(lastMobileFilterSummary)}</span>
        <span class="klevby-mobile-filter-badge hidden"></span>
      `;
      title.appendChild(mobileMeta);
    }

    let toggle = title.querySelector(".klevby-mobile-filter-toggle");

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "klevby-mobile-filter-toggle";
      toggle.setAttribute("aria-label", "Открыть или закрыть фильтр объявлений");
      toggle.textContent = mobileFilterExpanded ? "Скрыть" : "Фильтр";
      title.appendChild(toggle);
    }

    if (title.dataset.klevbyMobileFilterBound !== "1") {
      title.dataset.klevbyMobileFilterBound = "1";
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");

      title.addEventListener("click", (event) => {
        if (!isMobileFilterViewport()) {
          return;
        }

        if (
          event.target.closest("input") ||
          event.target.closest("select") ||
          event.target.closest("textarea") ||
          event.target.closest("label")
        ) {
          return;
        }

        setMobileFilterExpanded(!mobileFilterExpanded);
      });

      title.addEventListener("keydown", (event) => {
        if (!isMobileFilterViewport()) {
          return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        setMobileFilterExpanded(!mobileFilterExpanded);
      });
    }

    if (toggle.dataset.klevbyMobileFilterBound !== "1") {
      toggle.dataset.klevbyMobileFilterBound = "1";

      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isMobileFilterViewport()) {
          return;
        }

        setMobileFilterExpanded(!mobileFilterExpanded);
      });
    }

    setMobileFilterExpanded(mobileFilterExpanded);
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

      .klevby-mobile-filter-meta,
      .klevby-mobile-filter-toggle,
      .klevby-mobile-filter-badge {
        display: none;
      }

      @media (min-width: 768px) {
        #postsSection .trip-card .actions {
          max-width: 230px;
        }
      }

      @media (max-width: 767px) {
        #tripsSection #statusLine {
          display: none !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card {
          padding: 0 !important;
          margin-top: 14px !important;
          margin-bottom: 18px !important;
          border-radius: 24px !important;
          overflow: hidden !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(32, 58, 78, 0.12), transparent 48%),
            linear-gradient(180deg, rgba(8, 16, 23, 0.86) 0%, rgba(6, 12, 18, 0.92) 100%) !important;
          border: 1px solid rgba(88, 108, 124, 0.24) !important;
          box-shadow:
            0 10px 24px rgba(0, 8, 16, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            inset 0 0 0 1px rgba(244, 140, 60, 0.10) !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .filter-title {
          width: 100%;
          min-height: 68px;
          padding: 15px 16px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .filter-title h3 {
          margin: 0 !important;
          font-size: 18px !important;
          line-height: 1.1 !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .filter-title > span:not(.klevby-mobile-filter-badge) {
          display: none !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-meta {
          display: flex !important;
          min-width: 0;
          align-items: center;
          gap: 8px;
          grid-column: 1 / 2;
          color: rgba(244, 251, 247, 0.66);
          font-size: 12px;
          line-height: 1.25;
          font-weight: 800;
          margin-top: -3px;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-summary {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          min-width: 20px;
          border-radius: 999px;
          background: rgba(244, 122, 43, 0.88);
          color: #081018;
          font-size: 11px;
          font-weight: 950;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.10);
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-badge.hidden {
          display: none !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-toggle {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          grid-column: 2 / 3;
          grid-row: 1 / 3;
          min-width: 88px;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(244, 122, 43, 0.22);
          background: rgba(8, 16, 23, 0.72);
          color: rgba(244, 140, 60, 0.92);
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        #tripsSection .filter-card.klevby-mobile-filter-card .klevby-mobile-filter-toggle::after {
          content: "▾";
          display: inline-block;
          margin-left: 7px;
          font-size: 12px;
          transition: transform 0.18s ease;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .klevby-mobile-filter-toggle::after {
          transform: rotate(180deg);
        }

        #tripsSection .filter-card.klevby-mobile-filter-card:not(.is-mobile-filter-expanded) .filters {
          display: none !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          padding: 0 16px 16px !important;
          margin: 0 !important;
          animation: klevbyMobileFilterOpen 0.18s ease both;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters input,
        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters select,
        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters .check,
        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters .filter-reset {
          width: 100% !important;
          min-height: 52px !important;
          border-radius: 18px !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters .check {
          box-sizing: border-box !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 12px !important;
          padding: 0 16px !important;
          margin: 0 !important;
          overflow: hidden !important;
          text-align: center !important;
          color: rgba(244, 251, 247, 0.78) !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        #tripsSection .filter-card.klevby-mobile-filter-card.is-mobile-filter-expanded .filters .check input[type="checkbox"] {
          appearance: auto !important;
          -webkit-appearance: checkbox !important;
          box-sizing: border-box !important;
          position: static !important;
          display: inline-block !important;
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          max-width: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          flex: 0 0 20px !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 4px !important;
          transform: none !important;
          accent-color: #ffaf2d;
        }

        @keyframes klevbyMobileFilterOpen {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

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
    setupMobileFilterShell();

    const list = document.getElementById("postsSection");
    if (!list) return;

    const allPosts = getPostsArray();
    const search = normalizeText(document.getElementById("searchInput")?.value);
    const selectedCity = normalizeSelectFilterValue("citySelect");
    const selectedType = normalizeSelectFilterValue("typeSelect");
    const telegramOnly = document.getElementById("telegramOnly")?.checked;
    const ownerId = getOwnerId();
    const mode = getCurrentViewMode();
    const mineTripsMode = getMineTripsMode();

    if (!allPosts.length && (!hasPostsInitialLoadDone() || hasActivePostsLoad())) {
      showStatusSafe("Загрузка объявлений...");
      updateMineTripsSwitcher(mode, mineTripsMode, 0);

      updateMobileFilterSummary({
        mode,
        mineTripsMode,
        search,
        selectedCity,
        selectedType,
        telegramOnly: Boolean(telegramOnly),
        expiredCount: 0
      });

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

    const tripPartitions = partitionTrips(allPosts, { ownerId });
    const activeMine = [...tripPartitions.activeMine, ...tripPartitions.undatedMine];
    const activeAll = [...tripPartitions.activeAll, ...tripPartitions.undatedAll];
    const expiredCount = tripPartitions.expiredMine.length;
    const visiblePosts = mode === "mine"
      ? (mineTripsMode === "expired" ? tripPartitions.expiredMine : activeMine)
      : activeAll;

    let filtered = mineTripsMode === "expired" && mode === "mine"
      ? [...visiblePosts]
      : sortActivePosts(visiblePosts);

    updateMineTripsSwitcher(mode, mineTripsMode, expiredCount);
    updateMobileFilterSummary({
      mode,
      mineTripsMode,
      search,
      selectedCity,
      selectedType,
      telegramOnly: Boolean(telegramOnly),
      expiredCount
    });

    if (mode === "mine" && mineTripsMode === "expired") {
      showStatusSafe("Сейчас показаны: мои прошедшие выезды.");
    } else if (mode === "mine") {
      showStatusSafe(
        expiredCount
          ? `Сейчас показаны: мои актуальные выезды. Прошедшие: ${expiredCount}.`
          : "Сейчас показаны: мои актуальные выезды."
      );
    } else {
      showStatusSafe("Сейчас показаны: все актуальные объявления о выездах.");
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

      if (visiblePosts.length) {
        emptyText = "По фильтрам ничего не найдено.";
      } else if (mode === "mine" && mineTripsMode === "expired") {
        emptyText = "Прошедших выездов пока нет.";
      } else if (mode === "mine" && expiredCount) {
        emptyText = "Актуальных выездов пока нет, но у вас есть прошедшие. Откройте вкладку «Прошедшие».";
      } else if (mode === "mine") {
        emptyText = "Актуальных выездов пока нет.";
      }

      console.info("Klevby posts: empty render state", {
        allCount: allPosts.length,
        visibleCount: visiblePosts.length,
        expiredCount,
        mode,
        mineTripsMode,
        search,
        selectedCity,
        selectedType,
        telegramOnly: Boolean(telegramOnly)
      });

      list.innerHTML = `
        <div class="info-line">
          ${emptyText}
          <div style="margin-top:12px;">
            <button class="small-btn green" type="button" onclick="showCreatePostScreen()">Создать выезд</button>
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
    const tripWhenText = formatTripWhen(post);
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
          title="Открыть Telegram-чат Klevgo"
          onclick="event.stopPropagation(); window.KlevbyPostsRender.openTelegramSafe()"
        >
          ${telegramIcon}
          <span>Telegram</span>
        </button>
      `;

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
              <div class="trip-fact-value">${escapeHtml(tripWhenText)}</div>
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
    sortActivePosts,
    setMobileFilterExpanded,
    formatTripWhen
  };

  ensurePostsRenderStyles();

  console.log("Klevby posts render loaded", {
    version: POSTS_RENDER_VERSION
  });
})();
