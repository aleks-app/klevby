(function () {
  function getRenderUtils() {
    return window.KlevbyFeedRenderUtils || {};
  }

  function getStyles() {
    return window.KlevbyFeedRenderStyles || {};
  }

  function getImages() {
    return window.KlevbyFeedRenderImages || {};
  }

  function getCards() {
    return window.KlevbyFeedRenderCards || {};
  }

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function cssEscape(value) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.cssEscape === "function") {
      return renderUtils.cssEscape(value);
    }

    const cleanValue = String(value || "");

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(cleanValue);
    }

    return cleanValue.replace(/["\\]/g, "\\$&");
  }

  function getRenderableFeedItems(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getRenderableFeedItems === "function") {
      const renderableItems = renderUtils.getRenderableFeedItems(items);
      return Array.isArray(renderableItems) ? renderableItems : [];
    }

    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      const id = String(item?.id || "").trim();
      const image = String(item?.image || item?.imageUrl || "").trim();

      return Boolean(id && image);
    });
  }

  function listHasRealContent(list) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.listHasRealContent === "function") {
      return renderUtils.listHasRealContent(list);
    }

    return Boolean(list && list.children && list.children.length > 0);
  }

  function setListSignature(list, fullSignature, structureSignature, source) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.setListSignature === "function") {
      renderUtils.setListSignature(list, fullSignature, structureSignature, source);
      return;
    }

    if (!list) return;

    list.dataset.klevbyFeedSignature = String(fullSignature || "");
    list.dataset.klevbyFeedStructureSignature = String(structureSignature || fullSignature || "");
    list.dataset.klevbyFeedSource = String(source || "");
  }

  function setLastItems(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.setLastItems === "function") {
      renderUtils.setLastItems(items);
      return;
    }

    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
      return;
    }

    window.__klevbyFeedLastItems = safeItems;
  }

  function setItemsCacheFromArray(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.setItemsCacheFromArray === "function") {
      renderUtils.setItemsCacheFromArray(items);
      return;
    }

    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setItemsCacheFromArray === "function") {
      state.setItemsCacheFromArray(safeItems);
      return;
    }

    const cache = {};

    safeItems.forEach((item) => {
      if (item && item.id) {
        cache[String(item.id)] = item;
      }
    });

    window.__klevbyFeedItemsCache = cache;
  }

  function scheduleMobileFeedWidthLock(reason = "scheduled", delay = 0) {
    const styles = getStyles();

    if (typeof styles.scheduleMobileFeedWidthLock === "function") {
      styles.scheduleMobileFeedWidthLock(reason, delay);
    }
  }

  function warmDesktopFeedImages(items, source = "unknown") {
    const images = getImages();

    if (typeof images.warmDesktopFeedImages === "function") {
      images.warmDesktopFeedImages(items, source);
    }
  }

  function getItemId(item) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getItemId === "function") {
      return renderUtils.getItemId(item);
    }

    return String(item?.id || "").trim();
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

  function getFeedStructureSignature(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getFeedStructureSignature === "function") {
      return renderUtils.getFeedStructureSignature(items);
    }

    return JSON.stringify(getRenderableFeedItems(items).map((item) => ({
      id: item?.id || "",
      source: item?.source || "",
      image: item?.image || item?.imageUrl || "",
      title: item?.title || item?.caption || "",
      createdAt: item?.createdAt || item?.created_at || ""
    })));
  }

  function getFeedFullSignature(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getFeedFullSignature === "function") {
      return renderUtils.getFeedFullSignature(items);
    }

    return JSON.stringify(getRenderableFeedItems(items).map((item) => ({
      id: item?.id || "",
      source: item?.source || "",
      image: item?.image || item?.imageUrl || "",
      avatar:
        item?.authorAvatarUrl ||
        item?.authorAvatar ||
        item?.avatarUrl ||
        item?.avatar_url ||
        item?.author_avatar_url ||
        item?.author_avatar ||
        "",
      likesCount: getItemLikesCount(item),
      commentsCount: getItemCommentsCount(item),
      liked: getItemLikedState(item)
    })));
  }

  function fallbackEmptyHtml() {
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

  function getProfilePhotoCardHtml(item, index = 0, options = {}) {
    if (typeof options.profilePhotoCardHtml === "function") {
      return options.profilePhotoCardHtml(item, index);
    }

    const cards = getCards();

    if (typeof cards.profilePhotoCardHtml === "function") {
      return cards.profilePhotoCardHtml(item, index);
    }

    if (typeof window.profilePhotoCardHtml === "function") {
      return window.profilePhotoCardHtml(item, index);
    }

    return "";
  }

  function setStaticListHtml(list, html, signature, source) {
    const safeSignature = String(signature || source || "static");

    if (
      listHasRealContent(list) &&
      String(list.dataset.klevbyFeedSignature || "") === safeSignature
    ) {
      return false;
    }

    list.innerHTML = html;
    setListSignature(list, safeSignature, safeSignature, source);
    scheduleMobileFeedWidthLock("static_html", 40);

    return true;
  }

  function patchExistingFeedCards(list, items, fullSignature, structureSignature, source) {
    if (!list || !listHasRealContent(list)) return false;

    const safeItems = getRenderableFeedItems(items);
    const cards = Array.from(list.querySelectorAll(".profile-feed-card[data-feed-card-id]"));

    if (!safeItems.length || cards.length !== safeItems.length) {
      return false;
    }

    const currentStructure = String(list.dataset.klevbyFeedStructureSignature || "");

    if (!currentStructure || currentStructure !== structureSignature) {
      return false;
    }

    let canPatch = true;

    safeItems.forEach((item) => {
      const id = getItemId(item);
      const card = list.querySelector(`.profile-feed-card[data-feed-card-id="${cssEscape(id)}"]`);

      if (!id || !card) {
        canPatch = false;
      }
    });

    if (!canPatch) {
      return false;
    }

    safeItems.forEach((item) => {
      const id = getItemId(item);
      const likesCount = getItemLikesCount(item);
      const commentsCount = getItemCommentsCount(item);
      const likedState = getItemLikedState(item);

      const likeButton = list.querySelector(`.profile-feed-like-btn[data-feed-post-id="${cssEscape(id)}"]`);
      const commentButton = list.querySelector(`.profile-feed-comment-btn[data-feed-post-id="${cssEscape(id)}"]`);

      if (likeButton) {
        likeButton.textContent = `👍 ${likesCount}`;
        likeButton.dataset.likeCount = String(likesCount);
        likeButton.dataset.feedPostId = id;

        if (typeof likedState === "boolean") {
          likeButton.dataset.liked = likedState ? "true" : "false";
          likeButton.setAttribute("aria-pressed", likedState ? "true" : "false");
          likeButton.classList.toggle("liked", likedState);
          likeButton.classList.toggle("is-liked", likedState);
        }
      }

      if (commentButton) {
        commentButton.textContent = `💬 ${commentsCount}`;
        commentButton.dataset.commentCount = String(commentsCount);
        commentButton.dataset.feedPostId = id;
      }
    });

    setLastItems(safeItems);
    setItemsCacheFromArray(safeItems);
    setListSignature(list, fullSignature, structureSignature, source);
    scheduleMobileFeedWidthLock("patch_cards", 40);

    return true;
  }

  function renderFeedItems(list, items, source = "fresh", options = {}) {
    const safeItems = getRenderableFeedItems(items);
    const emptyHtml = typeof options.emptyHtml === "function"
      ? options.emptyHtml
      : fallbackEmptyHtml;

    warmDesktopFeedImages(safeItems, source);
    setLastItems(safeItems);
    setItemsCacheFromArray(safeItems);

    if (!safeItems.length) {
      setStaticListHtml(list, emptyHtml(), "empty", "empty");
      return false;
    }

    const fullSignature = getFeedFullSignature(safeItems);
    const structureSignature = getFeedStructureSignature(safeItems);
    const currentSignature = String(list.dataset.klevbyFeedSignature || "");

    if (listHasRealContent(list) && currentSignature === fullSignature) {
      scheduleMobileFeedWidthLock("same_signature", 40);
      return true;
    }

    if (patchExistingFeedCards(list, safeItems, fullSignature, structureSignature, source)) {
      return true;
    }

    const cardsHtml = safeItems
      .map((item, index) => {
        try {
          return getProfilePhotoCardHtml(item, index, options);
        } catch (error) {
          console.error("Klevby feed render: ошибка карточки", item, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    setStaticListHtml(
      list,
      cardsHtml || emptyHtml(),
      cardsHtml ? fullSignature : "empty",
      source
    );

    if (cardsHtml) {
      list.dataset.klevbyFeedStructureSignature = structureSignature;
    }

    scheduleMobileFeedWidthLock("render_items", 80);

    return Boolean(cardsHtml);
  }

  window.KlevbyFeedRenderList = {
    setStaticListHtml,
    patchExistingFeedCards,
    renderFeedItems
  };
})();
