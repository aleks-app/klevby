(function () {
  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function escapeHtml(value) {
    const utils = getUtils();

    if (typeof utils.escapeHtml === "function") {
      return utils.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    const utils = getUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(value);
    }

    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatDate(value) {
    const utils = getUtils();

    if (typeof utils.formatDate === "function") {
      return utils.formatDate(value);
    }

    if (!value) return "";

    try {
      return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "";
    }
  }

  function getAvatar(item = null) {
    const utils = getUtils();

    if (typeof utils.getProfileFeedAvatarSafe === "function") {
      return utils.getProfileFeedAvatarSafe(item);
    }

    return "";
  }

  function setLastItems(items) {
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(items);
      return;
    }

    window.__klevbyFeedLastItems = Array.isArray(items) ? items : [];
  }

  function setItemsCacheFromArray(items) {
    const state = getState();

    if (typeof state.setItemsCacheFromArray === "function") {
      state.setItemsCacheFromArray(items);
      return;
    }

    const cache = {};

    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item && item.id) {
          cache[String(item.id)] = item;
        }
      });
    }

    window.__klevbyFeedItemsCache = cache;
  }

  function getLastItems() {
    const state = getState();

    if (typeof state.getLastItems === "function") {
      return state.getLastItems();
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function nextRenderToken() {
    const state = getState();

    if (typeof state.nextRenderToken === "function") {
      return state.nextRenderToken();
    }

    window.__klevbyFeedRenderToken = Number(window.__klevbyFeedRenderToken || 0) + 1;
    return window.__klevbyFeedRenderToken;
  }

  function getRenderToken() {
    const state = getState();

    if (typeof state.getRenderToken === "function") {
      return state.getRenderToken();
    }

    return Number(window.__klevbyFeedRenderToken || 0);
  }

  const FEED_CACHE_VERSION = 1;
  const FEED_CACHE_LIMIT = 20;
  const FEED_CACHE_TTL_MS = 10 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v1";

  function getFeedCacheOwnerKey() {
    const possibleUser =
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null;

    const userId = String(possibleUser?.id || "").trim();

    if (userId) {
      return userId;
    }

    return "anon";
  }

  function getFeedCacheKey() {
    return `${FEED_CACHE_PREFIX}_${getFeedCacheOwnerKey()}`;
  }

  function normalizeFeedCacheItem(item) {
    if (!item || typeof item !== "object") return null;

    const id = String(item.id || "").trim();
    const image = String(item.image || item.imageUrl || "").trim();

    if (!id || !image) return null;

    return {
      id,
      source: item.source || "",
      image,
      imageUrl: item.imageUrl || item.image || "",
      authorName: item.authorName || "Рыбак",
      authorCity: item.authorCity || "",
      authorAvatarUrl: item.authorAvatarUrl || item.avatarUrl || item.avatar || "",
      avatarUrl: item.avatarUrl || item.authorAvatarUrl || item.avatar || "",
      avatar: item.avatar || item.avatarUrl || item.authorAvatarUrl || "",
      title: item.title || item.caption || "Фото с рыбалки",
      caption: item.caption || item.title || "Фото с рыбалки",
      likesCount: Number(item.likesCount || 0) || 0,
      commentsCount: Number(item.commentsCount || 0) || 0,
      viewsCount: Number(item.viewsCount || 0) || 0,
      createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      updatedAt: item.updatedAt || item.updated_at || "",
      userId: item.userId || item.user_id || item.ownerId || item.owner_id || null,
      ownerId: item.ownerId || item.owner_id || item.userId || item.user_id || null
    };
  }

  function normalizeFeedCacheItems(items) {
    if (!Array.isArray(items)) return [];

    return items
      .map(normalizeFeedCacheItem)
      .filter(Boolean)
      .slice(0, FEED_CACHE_LIMIT);
  }

  function readFeedCache() {
    const cacheKey = getFeedCacheKey();

    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      const version = Number(parsed?.version || 0);
      const savedAt = Number(parsed?.savedAt || 0);

      if (version !== FEED_CACHE_VERSION || !savedAt) {
        localStorage.removeItem(cacheKey);
        return [];
      }

      if (Date.now() - savedAt > FEED_CACHE_TTL_MS) {
        localStorage.removeItem(cacheKey);
        return [];
      }

      return normalizeFeedCacheItems(parsed?.items || []);
    } catch (error) {
      try {
        localStorage.removeItem(cacheKey);
      } catch (_) {}

      console.debug("Klevby feed render: cache read skipped", {
        error: String(error?.message || error)
      });

      return [];
    }
  }

  function writeFeedCache(items) {
    const cacheKey = getFeedCacheKey();

    try {
      const normalized = normalizeFeedCacheItems(items);

      if (!normalized.length) {
        localStorage.removeItem(cacheKey);
        return;
      }

      localStorage.setItem(cacheKey, JSON.stringify({
        version: FEED_CACHE_VERSION,
        savedAt: Date.now(),
        count: normalized.length,
        items: normalized
      }));
    } catch (error) {
      console.debug("Klevby feed render: cache write skipped", {
        error: String(error?.message || error)
      });
    }
  }

  function renderFeedItems(list, items, source = "fresh") {
    const safeItems = Array.isArray(items) ? items : [];

    setLastItems(safeItems);
    setItemsCacheFromArray(safeItems);

    if (!safeItems.length) {
      list.innerHTML = emptyHtml();
      return false;
    }

    const cards = safeItems
      .map((item) => {
        try {
          return profilePhotoCardHtml(item);
        } catch (error) {
          console.error("Klevby feed render: ошибка карточки", item, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    list.innerHTML = cards || emptyHtml();
    console.info("Klevby feed render: rendered", {
      source,
      count: safeItems.length
    });
    return Boolean(cards);
  }

  function ensureFeedStyles() {
    const oldStyle = document.getElementById("klevbyFeedStyles");

    if (oldStyle) {
      oldStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "klevbyFeedStyles";
    style.dataset.version = "20260507-split-render-1";

    style.textContent = `
      .social-feed-grid {
        align-items: start;
      }

      .profile-feed-card {
        position: relative;
        overflow: hidden;
        width: min(100%, 620px);
        padding: 0 !important;
        border-radius: 28px !important;
        border: 1px solid rgba(244, 178, 74, 0.18) !important;
        background:
          radial-gradient(circle at 20% 0%, rgba(244, 178, 74, 0.10), transparent 38%),
          rgba(12, 21, 17, 0.94) !important;
        box-shadow:
          0 22px 62px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        cursor: pointer;
        transform: translateZ(0);
      }

      .profile-feed-card:active {
        transform: scale(0.992);
      }

      .profile-feed-image {
        width: 100% !important;
        min-height: 300px !important;
        height: clamp(300px, 38vw, 430px) !important;
        max-height: 430px !important;
        border-radius: 28px 28px 0 0 !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        box-shadow: inset 0 -80px 100px rgba(0,0,0,0.18);
      }

      .profile-feed-body {
        padding: 14px 16px 16px !important;
      }

      .profile-feed-avatar-img,
      .profile-feed-avatar-fallback {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        display: inline-flex;
        flex: 0 0 auto;
        border: 1px solid rgba(244,178,74,0.34);
        box-shadow: 0 12px 28px rgba(0,0,0,0.32);
      }

      .profile-feed-avatar-img {
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }

      .profile-feed-avatar-fallback {
        align-items: center;
        justify-content: center;
        background: rgba(244,178,74,0.16);
        color: #fff8ea;
        font-weight: 900;
      }

      .profile-feed-author {
        appearance: none;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 0;
        margin: 0 0 12px;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .profile-feed-author-text {
        min-width: 0;
        display: block;
      }

      .profile-feed-author-name {
        display: block;
        font-size: 15px;
        font-weight: 950;
        line-height: 1.12;
        color: #fff8ea;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-feed-author-action {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,248,234,0.56);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-feed-title {
        margin: 0 0 12px !important;
        color: #fff8ea !important;
        font-size: clamp(19px, 3.8vw, 26px) !important;
        line-height: 1.12 !important;
        font-weight: 950 !important;
        letter-spacing: -0.028em;
      }

      .profile-feed-title .trip-name {
        color: #ffb43e !important;
        text-shadow: 0 12px 32px rgba(255, 171, 48, 0.16);
      }

      .profile-feed-title .trip-destination {
        color: #fff8ea !important;
      }

      .profile-feed-tags {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
        margin: 0 0 12px !important;
      }

      .profile-feed-tags .tag {
        min-height: 32px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid rgba(244,178,74,0.16);
        background: rgba(255,255,255,0.065);
        color: rgba(255,248,234,0.82);
        font-size: 12px;
        line-height: 1;
        font-weight: 900;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .profile-feed-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 0 !important;
      }

      .profile-feed-actions .small-btn {
        min-width: 0 !important;
        width: 100% !important;
        min-height: 46px !important;
        padding: 0 10px !important;
        border-radius: 17px !important;
        font-size: 14px !important;
        font-weight: 950 !important;
        box-shadow: none !important;
      }

      .profile-feed-open-btn {
        background: linear-gradient(180deg, #ffbd4a, #ff9f22) !important;
        color: #120c04 !important;
        border-color: rgba(255, 210, 117, 0.30) !important;
        box-shadow:
          0 14px 30px rgba(255, 165, 35, 0.16),
          inset 0 1px 0 rgba(255,255,255,0.24) !important;
      }

      .profile-feed-like-btn,
      .profile-feed-comment-btn,
      .profile-feed-profile-btn {
        background: rgba(255,255,255,0.075) !important;
        border-color: rgba(244,178,74,0.16) !important;
        color: rgba(255,248,234,0.90) !important;
      }

      .profile-feed-like-btn:active,
      .profile-feed-comment-btn:active,
      .profile-feed-profile-btn:active,
      .profile-feed-open-btn:active {
        transform: scale(0.98);
      }

      .home-empty-card {
        grid-column: 1 / -1;
        width: 100%;
        padding: 22px;
        border-radius: 26px;
        border: 1px solid rgba(244,178,74,0.14);
        background:
          radial-gradient(circle at 0% 0%, rgba(244,178,74,0.14), transparent 38%),
          rgba(13, 20, 17, 0.86);
        box-shadow: 0 12px 32px rgba(0,0,0,0.34);
      }

      .home-empty-icon {
        width: 54px;
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        border-radius: 20px;
        background: rgba(244,178,74,0.14);
        font-size: 26px;
      }

      .home-empty-card h3 {
        margin: 0 0 8px;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.15;
        font-weight: 900;
      }

      .home-empty-card p {
        margin: 0 0 16px;
        color: rgba(255,248,234,0.66);
        font-size: 14px;
        line-height: 1.5;
        font-weight: 600;
      }

      @media (max-width: 760px) {
        .profile-feed-card {
          width: 100%;
          border-radius: 26px !important;
        }

        .profile-feed-image {
          min-height: 280px !important;
          height: 34dvh !important;
          max-height: 340px !important;
          border-radius: 26px 26px 0 0 !important;
        }

        .profile-feed-body {
          padding: 13px 14px 15px !important;
        }

        .profile-feed-avatar-img,
        .profile-feed-avatar-fallback {
          width: 38px;
          height: 38px;
        }

        .profile-feed-author {
          margin-bottom: 10px;
        }

        .profile-feed-author-name {
          font-size: 14px;
        }

        .profile-feed-author-action {
          font-size: 12px;
        }

        .profile-feed-title {
          font-size: 20px !important;
          line-height: 1.12 !important;
          margin-bottom: 11px !important;
        }

        .profile-feed-tags {
          gap: 7px !important;
          margin-bottom: 11px !important;
        }

        .profile-feed-tags .tag {
          min-height: 31px;
          padding: 7px 10px;
          font-size: 12px;
        }

        .profile-feed-actions {
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 7px !important;
        }

        .profile-feed-actions .small-btn {
          min-height: 44px !important;
          padding: 0 8px !important;
          border-radius: 16px !important;
          font-size: 13px !important;
        }
      }

      @media (max-width: 380px) {
        .profile-feed-image {
          min-height: 250px !important;
          height: 31dvh !important;
          max-height: 310px !important;
        }

        .profile-feed-title {
          font-size: 18px !important;
        }

        .profile-feed-actions .small-btn {
          min-height: 42px !important;
          font-size: 12px !important;
        }
      }
    `;

    document.body.appendChild(style);
  }

  function profilePhotoCardHtml(item) {
    const safeId = escapeAttr(item?.id || "");
    const safeImage = escapeAttr(item?.image || item?.imageUrl || "");
    const authorName = item?.authorName || "Рыбак";
    const authorCity = item?.authorCity || "";
    const title = item?.title || item?.caption || "Фото с рыбалки";
    const likesCount = Number(item?.likesCount || 0);
    const commentsCount = Number(item?.commentsCount || 0);
    const date = formatDate(item?.createdAt);
    const avatar = getAvatar(item);
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";
    const isSupabase = item?.source === "supabase";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${escapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${escapeHtml(authorInitial)}</span>`;

    const likeButton = isSupabase
      ? `<button class="small-btn gray profile-feed-like-btn" type="button" data-feed-post-id="${safeId}" data-like-count="${likesCount}" data-liked="false" aria-pressed="false" onclick="event.preventDefault(); event.stopPropagation(); return toggleFeedLike('${safeId}', this);">👍 ${likesCount}</button>`
      : "";

    const commentButton = isSupabase
      ? `<button class="small-btn gray profile-feed-comment-btn" type="button" onclick="event.stopPropagation(); openFeedCommentModal('${safeId}')">💬 ${commentsCount}</button>`
      : `<button class="small-btn gray profile-feed-profile-btn" type="button" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>`;

    return `
      <article class="card profile-feed-card" onclick="openProfilePhotoFeedItem('${safeId}')">
        <div class="card-img profile-feed-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.20)), url('${safeImage}')"></div>

        <div class="card-body profile-feed-body">
          <button
            class="profile-feed-author"
            type="button"
            onclick="event.stopPropagation(); openKlevbyProfileSafe()"
            aria-label="Открыть профиль автора"
          >
            ${avatarHtml}

            <span class="profile-feed-author-text">
              <span class="profile-feed-author-name">${escapeHtml(authorName)}</span>
              <span class="profile-feed-author-action">добавил фото с рыбалки</span>
            </span>
          </button>

          <div class="trip-title profile-feed-title">
            <span class="trip-name">${escapeHtml(authorName)}</span>
            <span> добавил </span>
            <span class="trip-destination">${escapeHtml(title)}</span>
          </div>

          <div class="tags profile-feed-tags">
            ${authorCity ? `<span class="tag">📍 ${escapeHtml(authorCity)}</span>` : ""}
            ${date ? `<span class="tag">🕒 ${escapeHtml(date)}</span>` : ""}
          </div>

          <div class="actions profile-feed-actions">
            <button class="small-btn green profile-feed-open-btn" type="button" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть</button>
            ${likeButton}
            ${commentButton}
          </div>
        </div>
      </article>
    `;
  }

  function emptyHtml() {
    return `
      <div class="home-empty-card">
        <div class="home-empty-icon">📸</div>
        <h3>В ленте пока нет фото</h3>
        <p>Добавь первое фото в профиле — оно появится в общей ленте Klevby.</p>
        <div class="actions">
          <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
          <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
        </div>
      </div>
    `;
  }

  function loadingHtml() {
    return `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
  }

  async function renderProfileFeed() {
    const list = document.getElementById("profileFeedSection");
    const api = getApi();

    if (!list) return;

    ensureFeedStyles();

    const renderToken = nextRenderToken();
    let renderedCache = false;
    let freshLoadFailed = false;

    if (!getLastItems().length) {
      const cachedItems = readFeedCache();

      if (cachedItems.length) {
        renderedCache = renderFeedItems(list, cachedItems, "cache");
      } else {
        list.innerHTML = loadingHtml();
      }
    }

    let result = {
      source: "local_empty",
      items: []
    };

    try {
      if (typeof api.getFeedItemsForRender === "function") {
        result = await api.getFeedItemsForRender({
          limit: 40
        });
      }
    } catch (error) {
      freshLoadFailed = true;
      console.warn("Klevby feed render: лента не загрузилась", error);
    }

    if (renderToken !== getRenderToken()) {
      return;
    }

    const items = Array.isArray(result.items) ? result.items : [];

    if (freshLoadFailed && renderedCache) {
      return;
    }

    if (!items.length) {
      setLastItems([]);
      setItemsCacheFromArray([]);
      writeFeedCache([]);
      list.innerHTML = emptyHtml();
      return;
    }

    renderFeedItems(list, items, "fresh");
    writeFeedCache(items);
  }

  function refreshFeedIfHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      renderProfileFeed();
    }
  }

  const renderer = {
    ensureFeedStyles,
    profilePhotoCardHtml,
    emptyHtml,
    loadingHtml,
    renderProfileFeed,
    refreshFeedIfHomeVisible
  };

  window.KlevbyFeedRender = renderer;

  window.renderProfileFeed = renderProfileFeed;
  window.profilePhotoCardHtml = profilePhotoCardHtml;
})();
