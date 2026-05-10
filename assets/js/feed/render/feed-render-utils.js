(function () {
  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getState() {
    return window.KlevbyFeedState || {};
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
    } catch (_) {
      return "";
    }
  }

  function cssEscape(value) {
    const cleanValue = String(value || "");

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(cleanValue);
    }

    return cleanValue.replace(/["\\]/g, "\\$&");
  }

  function uniqueArray(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function getAvatar(item = null) {
    const utils = getUtils();

    if (typeof utils.getProfileFeedAvatarSafe === "function") {
      return utils.getProfileFeedAvatarSafe(item);
    }

    return "";
  }

  function getItemId(item) {
    return String(item?.id || "").trim();
  }

  function getItemImage(item) {
    return String(item?.image || item?.imageUrl || "").trim();
  }

  function getItemTitle(item) {
    return String(item?.title || item?.caption || "Фото с рыбалки").trim();
  }

  function getItemAuthorName(item) {
    return String(item?.authorName || item?.author_name || "Рыбак").trim();
  }

  function getItemAuthorCity(item) {
    return String(item?.authorCity || item?.author_city || "").trim();
  }

  function getItemCreatedAt(item) {
    return String(item?.createdAt || item?.created_at || "").trim();
  }

  function getItemUpdatedAt(item) {
    return String(item?.updatedAt || item?.updated_at || "").trim();
  }

  function getItemLikesCount(item) {
    return Math.max(0, Number(item?.likesCount || item?.likes_count || 0) || 0);
  }

  function getItemCommentsCount(item) {
    return Math.max(0, Number(item?.commentsCount || item?.comments_count || 0) || 0);
  }

  function getItemViewsCount(item) {
    return Math.max(0, Number(item?.viewsCount || item?.views_count || 0) || 0);
  }

  function getItemLikedState(item) {
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

  function getRenderableFeedItems(items) {
    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      const id = getItemId(item);
      const image = getItemImage(item);

      return Boolean(id && image);
    });
  }

  function signaturePart(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("|", "\\|")
      .replaceAll("\n", " ")
      .replaceAll("\r", " ");
  }

  function getFeedStructureSignature(items) {
    const safeItems = getRenderableFeedItems(items);

    return safeItems
      .map((item) => {
        return [
          getItemId(item),
          item?.source || "",
          getItemImage(item),
          item?.imagePath || item?.image_path || "",
          getItemAuthorName(item),
          getItemAuthorCity(item),
          getAvatar(item),
          getItemTitle(item),
          getItemCreatedAt(item),
          getItemUpdatedAt(item),
          item?.userId || item?.user_id || item?.ownerId || item?.owner_id || ""
        ].map(signaturePart).join("|");
      })
      .join("||");
  }

  function getFeedFullSignature(items) {
    const safeItems = getRenderableFeedItems(items);

    return safeItems
      .map((item) => {
        const likedState = getItemLikedState(item);

        return [
          getItemId(item),
          item?.source || "",
          getItemImage(item),
          item?.imagePath || item?.image_path || "",
          getItemAuthorName(item),
          getItemAuthorCity(item),
          getAvatar(item),
          getItemTitle(item),
          getItemCreatedAt(item),
          getItemUpdatedAt(item),
          getItemLikesCount(item),
          getItemCommentsCount(item),
          getItemViewsCount(item),
          typeof likedState === "boolean" ? String(likedState) : "unknown",
          item?.userId || item?.user_id || item?.ownerId || item?.owner_id || ""
        ].map(signaturePart).join("|");
      })
      .join("||");
  }

  function listHasRealContent(list) {
    return Boolean(list && list.children && list.children.length > 0);
  }

  function setListSignature(list, fullSignature, structureSignature, source) {
    if (!list) return;

    list.dataset.klevbyFeedSignature = String(fullSignature || "");
    list.dataset.klevbyFeedStructureSignature = String(structureSignature || fullSignature || "");
    list.dataset.klevbyFeedSource = String(source || "");
  }

  function setLastItems(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
      return;
    }

    window.__klevbyFeedLastItems = safeItems;
  }

  function setItemsCacheFromArray(items) {
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

  function getLastItems() {
    const state = getState();

    if (typeof state.getLastItems === "function") {
      const items = state.getLastItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  const utils = {
    escapeHtml,
    escapeAttr,
    formatDate,
    cssEscape,
    uniqueArray,
    getAvatar,
    getRenderableFeedItems,
    getItemId,
    getItemImage,
    getItemTitle,
    getItemAuthorName,
    getItemAuthorCity,
    getItemCreatedAt,
    getItemUpdatedAt,
    getItemLikesCount,
    getItemCommentsCount,
    getItemViewsCount,
    getItemLikedState,
    signaturePart,
    getFeedStructureSignature,
    getFeedFullSignature,
    listHasRealContent,
    setListSignature,
    setLastItems,
    setItemsCacheFromArray,
    getLastItems
  };

  window.KlevbyFeedRenderUtils = utils;
})();
