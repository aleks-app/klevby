(function () {
  "use strict";

  const COMMENTS_COUNT_STORAGE_KEY = "klevby_feed_comment_counts_v1";
  const COMMENTS_COUNT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v2";

  const knownCommentCountsByPostId = new Map();

  let commentCountSyncTimer = null;
  let commentCountObserver = null;
  let commentCountObserverRetryTimer = null;

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
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

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function getLastItemsArray() {
    const utils = getCommentsUtils();

    if (typeof utils.getLastItemsArray === "function") {
      return utils.getLastItemsArray();
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function setLastItemsArray(items) {
    const utils = getCommentsUtils();

    if (typeof utils.setLastItemsArray === "function") {
      utils.setLastItemsArray(items);
      return;
    }

    window.__klevbyFeedLastItems = Array.isArray(items) ? items : [];
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

  function readStoredCommentCounts() {
    try {
      const raw = localStorage.getItem(COMMENTS_COUNT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return parsed;
    } catch (_) {
      return {};
    }
  }

  function writeStoredCommentCounts(payload) {
    try {
      localStorage.setItem(COMMENTS_COUNT_STORAGE_KEY, JSON.stringify(payload || {}));
    } catch (_) {}
  }

  function cleanupStoredCommentCounts(payload) {
    const now = Date.now();
    const source = payload && typeof payload === "object" ? payload : {};
    const cleanPayload = {};
    let changed = false;

    Object.keys(source).forEach((postId) => {
      const item = source[postId];
      const savedAt = Number(item?.savedAt || 0);
      const count = getSafeCommentsCount(item?.count);

      if (!savedAt || now - savedAt > COMMENTS_COUNT_STORAGE_TTL_MS) {
        changed = true;
        return;
      }

      cleanPayload[postId] = {
        count,
        savedAt
      };
    });

    if (changed) {
      writeStoredCommentCounts(cleanPayload);
    }

    return cleanPayload;
  }

  function preloadKnownCommentCounts() {
    const stored = cleanupStoredCommentCounts(readStoredCommentCounts());

    Object.keys(stored).forEach((postId) => {
      const cleanId = String(postId || "").trim();
      const count = getSafeCommentsCount(stored[postId]?.count);

      if (cleanId) {
        knownCommentCountsByPostId.set(cleanId, count);
      }
    });
  }

  function getKnownCommentCount(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    if (knownCommentCountsByPostId.has(cleanId)) {
      return getSafeCommentsCount(knownCommentCountsByPostId.get(cleanId));
    }

    const stored = cleanupStoredCommentCounts(readStoredCommentCounts());
    const storedItem = stored[cleanId];

    if (!storedItem) return null;

    const count = getSafeCommentsCount(storedItem.count);
    knownCommentCountsByPostId.set(cleanId, count);

    return count;
  }

  function saveKnownCommentCount(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return safeCount;

    knownCommentCountsByPostId.set(cleanId, safeCount);

    const stored = cleanupStoredCommentCounts(readStoredCommentCounts());

    stored[cleanId] = {
      count: safeCount,
      savedAt: Date.now()
    };

    writeStoredCommentCounts(stored);
    patchStoredFeedCacheCommentCount(cleanId, safeCount);

    return safeCount;
  }

  function patchStoredFeedCacheCommentCount(postId, commentsCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = getSafeCommentsCount(commentsCount);

    if (!cleanId) return;

    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = String(localStorage.key(index) || "");

        if (!key.startsWith(FEED_CACHE_PREFIX)) {
          continue;
        }

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);

        if (!parsed || !Array.isArray(parsed.items)) {
          continue;
        }

        let changed = false;

        parsed.items = parsed.items.map((item) => {
          if (String(item?.id || "") !== cleanId) {
            return item;
          }

          changed = true;

          return {
            ...item,
            commentsCount: safeCount,
            comments_count: safeCount
          };
        });

        if (changed) {
          parsed.savedAt = Date.now();
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      }
    } catch (_) {}
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
      button.textContent = `💬 ${safeCount}`;
      button.dataset.feedPostId = cleanId;
      button.dataset.commentCount = String(safeCount);
      button.setAttribute("aria-label", `Комментарии: ${safeCount}`);
    });

    const viewerButton = document.getElementById("klevbyFeedViewerCommentBtn");
    const viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewerButton && viewer && !viewer.classList.contains("hidden")) {
      viewerButton.textContent = safeCount ? `💬 ${safeCount}` : "💬 Комментарии";
      viewerButton.dataset.commentCount = String(safeCount);
    }

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
    preloadKnownCommentCounts();
    applyKnownCommentCountsToFeedItems();

    knownCommentCountsByPostId.forEach((count, postId) => {
      patchLocalFeedItemCommentCount(postId, count);
      applyCommentCountToButtons(postId, count);
    });
  }

  function scheduleCommentCountSync(delay = 80) {
    if (commentCountSyncTimer) {
      window.clearTimeout(commentCountSyncTimer);
      commentCountSyncTimer = null;
    }

    commentCountSyncTimer = window.setTimeout(() => {
      commentCountSyncTimer = null;
      applyKnownCommentCountsToVisibleFeed();
    }, Math.max(0, Number(delay || 0)));
  }

  function startCommentCountObserver() {
    const list = document.getElementById("profileFeedSection");

    if (!list) {
      if (commentCountObserverRetryTimer) {
        window.clearTimeout(commentCountObserverRetryTimer);
      }

      commentCountObserverRetryTimer = window.setTimeout(startCommentCountObserver, 700);
      return;
    }

    if (commentCountObserver) {
      try {
        commentCountObserver.disconnect();
      } catch (_) {}
    }

    commentCountObserver = new MutationObserver(() => {
      scheduleCommentCountSync(60);
    });

    try {
      commentCountObserver.observe(list, {
        childList: true,
        subtree: true
      });
    } catch (_) {}
  }

  function bindCommentCountSyncHooks() {
    if (window.__klevbyFeedCommentCountSyncBound) {
      scheduleCommentCountSync(120);
      return;
    }

    window.__klevbyFeedCommentCountSyncBound = true;

    preloadKnownCommentCounts();
    startCommentCountObserver();

    window.addEventListener("klevby-feed-main-refreshed", () => {
      scheduleCommentCountSync(90);
    });

    window.addEventListener("klevby-feed-updated", () => {
      scheduleCommentCountSync(120);
    });

    window.addEventListener("klevby-app-resumed", () => {
      startCommentCountObserver();
      scheduleCommentCountSync(160);
      scheduleCommentCountSync(900);
    });

    window.addEventListener("pageshow", () => {
      startCommentCountObserver();
      scheduleCommentCountSync(160);
    });

    window.addEventListener("focus", () => {
      scheduleCommentCountSync(180);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        startCommentCountObserver();
        scheduleCommentCountSync(180);
        scheduleCommentCountSync(900);
      }
    });

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === COMMENTS_COUNT_STORAGE_KEY ||
        key.startsWith(FEED_CACHE_PREFIX)
      ) {
        preloadKnownCommentCounts();
        scheduleCommentCountSync(120);
      }
    });

    scheduleCommentCountSync(120);
    scheduleCommentCountSync(900);
  }

  const commentsCounts = {
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

  if (typeof window.klevbySyncFeedCommentCount !== "function") {
    window.klevbySyncFeedCommentCount = syncFeedCommentCount;
  }

  if (typeof window.klevbyGetKnownFeedCommentCount !== "function") {
    window.klevbyGetKnownFeedCommentCount = getKnownCommentCount;
  }
})();
