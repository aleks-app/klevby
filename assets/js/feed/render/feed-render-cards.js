(function () {
  const FEED_DESKTOP_EAGER_LIMIT = 8;
  const FEED_DESKTOP_HIGH_PRIORITY_LIMIT = 5;

  function getBaseUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getRenderUtils() {
    return window.KlevbyFeedRenderUtils || {};
  }

  function escapeHtml(value) {
    const utils = getBaseUtils();

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
    const utils = getBaseUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(value);
    }

    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatDate(value) {
    const utils = getBaseUtils();

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
    } catch (_) {
      return "";
    }
  }

  function getAvatar(item = null) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getAvatar === "function") {
      return renderUtils.getAvatar(item);
    }

    const utils = getBaseUtils();

    if (typeof utils.getProfileFeedAvatarSafe === "function") {
      return utils.getProfileFeedAvatarSafe(item);
    }

    return "";
  }

  function getItemLikesCount(item) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getItemLikesCount === "function") {
      return renderUtils.getItemLikesCount(item);
    }

    return Math.max(0, Number(item?.likesCount || item?.likes_count || 0) || 0);
  }

  function getItemCommentsCount(item) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getItemCommentsCount === "function") {
      return renderUtils.getItemCommentsCount(item);
    }

    return Math.max(0, Number(item?.commentsCount || item?.comments_count || 0) || 0);
  }

  function getItemLikedState(item) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getItemLikedState === "function") {
      return renderUtils.getItemLikedState(item);
    }

    if (!item || typeof item !== "object") return null;

    const candidates = [
      item.likedByViewer,
      item.viewerLiked,
      item.isLiked,
      item.liked,
      item.hasLiked,
      item.liked_by_viewer
    ];

    for (const value of candidates) {
      if (typeof value === "boolean") {
        return value;
      }
    }

    return null;
  }

  function isDesktopFeedMode() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
        return false;
      }

      return Number(window.innerWidth || 0) > 760;
    } catch (_) {
      return false;
    }
  }

  function profilePhotoCardHtml(item, index = 0) {
    const safeId = escapeAttr(item?.id || "");
    const safeImage = escapeAttr(item?.image || item?.imageUrl || "");
    const authorName = item?.authorName || item?.author_name || "Рыбак";
    const authorCity = item?.authorCity || item?.author_city || "";
    const title = item?.title || item?.caption || "Фото с рыбалки";
    const likesCount = getItemLikesCount(item);
    const commentsCount = getItemCommentsCount(item);
    const date = formatDate(item?.createdAt || item?.created_at);
    const avatar = getAvatar(item);
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";
    const isSupabase = item?.source === "supabase";
    const likedState = getItemLikedState(item);
    const likedAttrs = typeof likedState === "boolean"
      ? ` data-liked="${likedState ? "true" : "false"}" aria-pressed="${likedState ? "true" : "false"}"`
      : "";

    const useDesktopImageElement = isDesktopFeedMode();
    const imageLoading = useDesktopImageElement && index < FEED_DESKTOP_EAGER_LIMIT ? "eager" : "lazy";
    const imageFetchPriority = useDesktopImageElement && index < FEED_DESKTOP_HIGH_PRIORITY_LIMIT ? "high" : "auto";
    const imageBackgroundAttr = useDesktopImageElement
      ? ""
      : ` style="background-image: url('${safeImage}')"`;
    const imageElementHtml = useDesktopImageElement
      ? `<img class="profile-feed-image-img" src="${safeImage}" alt="" loading="${imageLoading}" decoding="async" fetchpriority="${imageFetchPriority}" draggable="false">`
      : "";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${escapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${escapeHtml(authorInitial)}</span>`;

    const likeButton = isSupabase
      ? `<button class="small-btn gray profile-feed-like-btn${likedState ? " is-liked liked" : ""}" type="button" data-feed-post-id="${safeId}" data-like-count="${likesCount}"${likedAttrs} onclick="event.stopPropagation(); toggleFeedLike('${safeId}')">👍 ${likesCount}</button>`
      : "";

    const commentButton = isSupabase
      ? `<button class="small-btn gray profile-feed-comment-btn" type="button" data-feed-post-id="${safeId}" data-comment-count="${commentsCount}" onclick="event.stopPropagation(); openFeedCommentModal('${safeId}')">💬 ${commentsCount}</button>`
      : `<button class="small-btn gray profile-feed-profile-btn" type="button" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>`;

    const authorUserIdRaw = item?.userId || item?.user_id || item?.ownerId || item?.owner_id || "";
    const authorUserId = String(authorUserIdRaw || "").trim();
    const fallbackData = {
      authorName: item?.authorName || item?.author_name || "",
      authorCity: item?.authorCity || item?.author_city || "",
      authorAvatarUrl: item?.authorAvatarUrl || item?.author_avatar_url || item?.avatarUrl || item?.avatar_url || "",
      avatarUrl: item?.authorAvatarUrl || item?.author_avatar_url || item?.avatarUrl || item?.avatar_url || "",
      image: item?.image || item?.imageUrl || item?.image_url || "",
      imageUrl: item?.image || item?.imageUrl || item?.image_url || ""
    };
    const authorFallbackJson = escapeAttr(JSON.stringify(fallbackData));
    const authorUserIdAttr = escapeAttr(authorUserId);
    const authorClickAction = authorUserId
      ? `(function(){ const userId = '${authorUserIdAttr}'; const me = String(window.currentUserId || window.klevbyUserId || window.viewerUserId || window.authUserId || window.userId || '').trim(); if (me && userId && me === userId) { openKlevbyProfileSafe(); return; } if (userId && typeof window.openKlevbyPublicProfile === 'function') { window.openKlevbyPublicProfile(userId, JSON.parse('${authorFallbackJson}')); return; } openKlevbyProfileSafe(); })()`
      : "openKlevbyProfileSafe()";

    return `
      <article class="card profile-feed-card" data-feed-card-id="${safeId}" onclick="openProfilePhotoFeedItem('${safeId}')">
        <div class="card-img profile-feed-image"${imageBackgroundAttr}>${imageElementHtml}</div>

        <div class="card-body profile-feed-body">
          <button
            class="profile-feed-author"
            type="button"
            onclick="event.stopPropagation(); ${authorClickAction}"
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

  const cards = {
    profilePhotoCardHtml,
    emptyHtml,
    loadingHtml
  };

  window.KlevbyFeedRenderCards = cards;
})();
