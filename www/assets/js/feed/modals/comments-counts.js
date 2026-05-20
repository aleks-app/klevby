(function () {
  "use strict";

  const COMMENTS_COUNT_STORAGE_KEY = "klevby_feed_comment_counts_v1";
  const COMMENTS_COUNT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v3";
  const COMMENTS_COUNTS_VERSION = "20260509-comments-counts-runtime-only-1";

  const knownCommentCountsByPostId = new Map();

  let commentCountSyncTimer = null;

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
  }

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getSafeCommentsCount(value) {
    const utils = getCommentsUtils();

    if (typeof utils.getSafeCommentsCount === "function") {
      return utils.getSafeCommentsCount(value);
    }

    return Math.max(0, Number(value || 0) || 0);
  }

  function getCachedItem(postId) {
    const utils = getCommentsUtils();

    if (typeof utils.getCachedItem === "function") {
      return utils.getCachedItem(postId);
    }

    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    const state = getState();

    if (typeof state.getItemById === "function") {
      const item = state.getItemById(cleanId);

      if (item) return item;
    }

    if (typeof state.getItemsCache === "function") {
      const cache = state.getItemsCache();

      if (cache && cache[cleanId]) {
        return cache[cleanId];
      }
    }

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function getLastItemsArray() {
    const utils = getCommentsUtils();

    if (typeof utils.getLastItemsArray === "function") {
      return utils.getLastItemsArray();
    }

    const state = getState();

    if (typeof state.getLastItems === "function") {
      const items = state.getLastItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function setLastItemsArray(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const utils = getCommentsUtils();

    if (typeof utils.setLastItemsArray === "function") {
      utils.setLastItemsArray(safeItems);
      return;
    }

    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
      return;
    }

    window.__klevbyFeedLastItems = safeItems;

    const cache = {};

    safeItems.forEach((item) => {
      if (item && item.id) {
        cache[String(item.id)] = item;
      }
    });

    window.__klevbyFeedItemsCache = cache;
  }

  function cssEscape(value) {
    const utils = getCommentsUtils();

    if (typeof utils.cssEscape === "function") {
      return utils.cssEscape(value);
    }

    const cleanValue = String(value || "");

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(cleanValue);
    }

    return cleanValue.replace(/["\\]/g, "\\$&");
  }

  function clearStoredCommentCounts() {
    try {
      localStorage.removeItem(COMMENTS_COUNT_STORAGE_KEY);
    } catch (_) {}
  }

  function readStoredCommentCounts() {
    clearStoredCommentCounts();
    return {};
  }

  function writeStoredCommentCounts() {
    clearStoredCommentCounts();
  }

  function cleanupStoredCommentCounts() {
    clearStoredCommentCounts();
    return {};
  }

  function preloadKnownCommentCounts() {
    clearStoredCommentCounts();
  }

  function getKnownCommentCount(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    if (!knownCommentCountsByPostId.has(cleanId)) {
      return null;
    }

    return getSafeCommentsCount(knownCommentCountsByPostId.get(cleanId));
  }

  function saveKnownCommentCount(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return safeCount;

    knownCommentCountsByPostId.set(cleanId, safeCount);

    return safeCount;
  }

  function patchStoredFeedCacheCommentCount() {
    return false;
  }

  function getCommentButtons(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const safeId = cssEscape(cleanId);
    const buttons = Array.from(
      document.querySelectorAll(`.profile-feed-comment-btn[data-feed-post-id="${safeId}"]`)
    );

    if (buttons.length) {
      return buttons;
    }

    return Array.from(document.querySelectorAll(".profile-feed-comment-btn")).filter((button) => {
      if (button.dataset.feedPostId) {
        return String(button.dataset.feedPostId).trim() === cleanId;
      }

      const onclickValue = String(button.getAttribute("onclick") || "");
      return onclickValue.includes(cleanId);
    });
  }

  function patchLocalFeedItemCommentCount(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return null;

    const items = getLastItemsArray();
    let patchedItem = null;
    let changed = false;

    const nextItems = items.map((item) => {
      if (String(item?.id || "") !== cleanId) return item;

      const currentCount = getSafeCommentsCount(item?.commentsCount ?? item?.comments_count);

      if (currentCount === safeCount) {
        patchedItem = item;
        return item;
      }

      changed = true;
      patchedItem = {
        ...item,
        commentsCount: safeCount,
        comments_count: safeCount
      };

      return patchedItem;
    });

    if (changed) {
      setLastItemsArray(nextItems);
    }

    const cache = window.__klevbyFeedItemsCache || {};
    const cachedItem = cache[cleanId] || getCachedItem(cleanId);

    if (cachedItem && typeof cachedItem === "object") {
      cachedItem.commentsCount = safeCount;
      cachedItem.comments_count = safeCount;
      cache[cleanId] = cachedItem;
      window.__klevbyFeedItemsCache = cache;
      patchedItem = patchedItem || cachedItem;
    }

    return patchedItem;
  }

  function applyCommentCountToButtons(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return safeCount;

    getCommentButtons(cleanId).forEach((button) => {
      const nextText = `💬 ${safeCount}`;

      if (button.textContent !== nextText) {
        button.textContent = nextText;
      }

      button.dataset.feedPostId = cleanId;
      button.dataset.commentCount = String(safeCount);
      button.setAttribute("aria-label", `Комментарии: ${safeCount}`);
    });

    return safeCount;
  }

  function syncFeedCommentCount(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return safeCount;

    saveKnownCommentCount(cleanId, safeCount);
    patchLocalFeedItemCommentCount(cleanId, safeCount);
    applyCommentCountToButtons(cleanId, safeCount);

    return safeCount;
  }

  function applyKnownCommentCountsToFeedItems() {
    const items = getLastItemsArray();

    if (!items.length || !knownCommentCountsByPostId.size) {
      return false;
    }

    let changed = false;

    const nextItems = items.map((item) => {
      const id = String(item?.id || "").trim();
      const knownCount = getKnownCommentCount(id);

      if (!id || knownCount === null) {
        return item;
      }

      const currentCount = getSafeCommentsCount(item?.commentsCount ?? item?.comments_count);

      if (currentCount === knownCount) {
        return item;
      }

      changed = true;

      return {
        ...item,
        commentsCount: knownCount,
        comments_count: knownCount
      };
    });

    if (changed) {
      setLastItemsArray(nextItems);
    }

    return changed;
  }

  function applyKnownCommentCountsToVisibleFeed() {
    if (!knownCommentCountsByPostId.size) {
      return false;
    }

    applyKnownCommentCountsToFeedItems();

    knownCommentCountsByPostId.forEach((count, postId) => {
      patchLocalFeedItemCommentCount(postId, count);
      applyCommentCountToButtons(postId, count);
    });

    return true;
  }

  function getActiveModalPostId() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (!modal || modal.classList.contains("hidden")) {
      return "";
    }

    return String(modal.dataset.postId || "").trim();
  }

  function getActiveModalRenderedCount(postId) {
    const cleanId = String(postId || "").trim();
    const list = document.getElementById("klevbyFeedCommentsList");

    if (!cleanId || !list) {
      return null;
    }

    if (String(list.dataset.postId || "").trim() !== cleanId) {
      return null;
    }

    const commentItems = Array.from(
      list.querySelectorAll(".klevby-feed-comment-item")
    );

    if (commentItems.length) {
      return commentItems.length;
    }

    const text = String(list.textContent || "").toLowerCase();

    if (
      text.includes("комментариев пока нет") ||
      text.includes("нет комментариев")
    ) {
      return 0;
    }

    return null;
  }

  function getActiveModalCachedCount(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    const cache =
      window.KlevbyFeedCommentsCache ||
      window.KlevbyFeedCommentCache ||
      {};

    if (typeof cache.getCachedComments === "function") {
      const comments = cache.getCachedComments(cleanId);

      if (Array.isArray(comments)) {
        return comments.length;
      }
    }

    return null;
  }

  function syncActiveModalCommentCount() {
    const postId = getActiveModalPostId();

    if (!postId) {
      return false;
    }

    const renderedCount = getActiveModalRenderedCount(postId);
    const cachedCount = getActiveModalCachedCount(postId);
    const count =
      renderedCount !== null
        ? renderedCount
        : cachedCount !== null
          ? cachedCount
          : null;

    if (count === null) {
      return false;
    }

    syncFeedCommentCount(postId, count);
    return true;
  }

  function scheduleCommentCountSync(delay = 80) {
    if (commentCountSyncTimer) {
      window.clearTimeout(commentCountSyncTimer);
      commentCountSyncTimer = null;
    }

    commentCountSyncTimer = window.setTimeout(() => {
      commentCountSyncTimer = null;

      syncActiveModalCommentCount();
      applyKnownCommentCountsToVisibleFeed();
    }, Math.max(0, Number(delay || 0)));
  }

  function startCommentCountObserver() {
    clearStoredCommentCounts();
  }

  function bindCommentCountSyncHooks() {
    if (window.__klevbyFeedCommentCountSyncBound) {
      scheduleCommentCountSync(120);
      return;
    }

    window.__klevbyFeedCommentCountSyncBound = true;

    clearStoredCommentCounts();

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (key === COMMENTS_COUNT_STORAGE_KEY) {
        clearStoredCommentCounts();
      }
    });
  }

  const commentsCounts = {
    version: COMMENTS_COUNTS_VERSION,

    COMMENTS_COUNT_STORAGE_KEY,
    COMMENTS_COUNT_STORAGE_TTL_MS,
    FEED_CACHE_PREFIX,

    readStoredCommentCounts,
    writeStoredCommentCounts,
    cleanupStoredCommentCounts,
    preloadKnownCommentCounts,

    getKnownCommentCount,
    saveKnownCommentCount,
    patchStoredFeedCacheCommentCount,

    getCommentButtons,
    patchLocalFeedItemCommentCount,
    applyCommentCountToButtons,
    syncFeedCommentCount,

    applyKnownCommentCountsToFeedItems,
    applyKnownCommentCountsToVisibleFeed,
    scheduleCommentCountSync,
    startCommentCountObserver,
    bindCommentCountSyncHooks
  };

  window.KlevbyFeedCommentsCounts = commentsCounts;
  window.KlevbyFeedCommentCounts = commentsCounts;

  window.klevbySyncFeedCommentCount = syncFeedCommentCount;
  window.klevbyGetKnownFeedCommentCount = getKnownCommentCount;

  console.log("Klevby feed comments counts loaded", {
    version: COMMENTS_COUNTS_VERSION
  });
})();
