(function () {
  "use strict";

  const COMMENTS_LOAD_TIMEOUT_MS = 7000;
  const COMMENTS_SEND_TIMEOUT_MS = 9000;

  const COMMENTS_COUNT_STORAGE_KEY = "klevby_feed_comment_counts_v1";
  const COMMENTS_COUNT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v2";

  const commentsCacheByPostId = new Map();
  const knownCommentCountsByPostId = new Map();

  let commentsLoadSerial = 0;
  let commentCountSyncTimer = null;
  let commentCountObserver = null;
  let commentCountObserverRetryTimer = null;

  function getCore() {
    return window.KlevbyFeedModalCore || {};
  }

  function getStyles() {
    return window.KlevbyFeedModalStyles || {};
  }

  function getState() {
    const core = getCore();

    if (typeof core.getState === "function") {
      return core.getState();
    }

    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    const core = getCore();

    if (typeof core.getUtils === "function") {
      return core.getUtils();
    }

    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    const core = getCore();

    if (typeof core.getApi === "function") {
      return core.getApi();
    }

    return window.KlevbyFeedApi || {};
  }

  function getRender() {
    const core = getCore();

    if (typeof core.getRender === "function") {
      return core.getRender();
    }

    return window.KlevbyFeedRender || {};
  }

  function escapeHtml(value) {
    const core = getCore();

    if (typeof core.escapeHtml === "function") {
      return core.escapeHtml(value);
    }

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
    const core = getCore();

    if (typeof core.escapeAttr === "function") {
      return core.escapeAttr(value);
    }

    const utils = getUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(value);
    }

    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatDate(value) {
    const core = getCore();

    if (typeof core.formatDate === "function") {
      return core.formatDate(value);
    }

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

  function withTimeout(promise, timeoutMs, errorMessage) {
    let timer = null;

    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(errorMessage));
        }, Math.max(1200, Number(timeoutMs || 0)));
      })
    ]).finally(() => {
      if (timer) {
        window.clearTimeout(timer);
      }
    });
  }

  function getCurrentUser() {
    const core = getCore();

    if (typeof core.getCurrentUser === "function") {
      return core.getCurrentUser();
    }

    const utils = getUtils();

    if (typeof utils.getCurrentUser === "function") {
      return utils.getCurrentUser();
    }

    return (
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null
    );
  }

  function isAdmin() {
    const core = getCore();

    if (typeof core.isAdmin === "function") {
      return Boolean(core.isAdmin());
    }

    const utils = getUtils();

    if (typeof utils.isAdmin === "function") {
      return Boolean(utils.isAdmin());
    }

    if (typeof window.isAdmin === "function") {
      try {
        return Boolean(window.isAdmin());
      } catch (_) {
        return false;
      }
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function getCachedItem(postId) {
    const cleanId = String(postId || "").trim();
    const core = getCore();

    if (!cleanId) return null;

    if (typeof core.getCachedItem === "function") {
      return core.getCachedItem(cleanId);
    }

    const state = getState();

    if (typeof state.getCachedItem === "function") {
      return state.getCachedItem(cleanId);
    }

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function getLastItemsArray() {
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
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
    } else {
      window.__klevbyFeedLastItems = safeItems;
    }

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

  function canManageComment(comment) {
    const core = getCore();

    if (typeof core.canManageComment === "function") {
      return Boolean(core.canManageComment(comment));
    }

    if (!comment) return false;

    const user = getCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      isAdmin() ||
      (userId && comment.user_id && String(userId) === String(comment.user_id))
    );
  }

  function ensureModalStyles() {
    const styles = getStyles();

    if (typeof styles.ensureModalStyles === "function") {
      return styles.ensureModalStyles();
    }

    const core = getCore();

    if (typeof core.ensureModalStyles === "function") {
      return core.ensureModalStyles();
    }

    return null;
  }

  function setModalBodyLock() {
    const core = getCore();

    if (typeof core.setModalBodyLock === "function") {
      core.setModalBodyLock();
      return;
    }

    document.body.classList.add("post-modal-open");
  }

  function releaseModalBodyLockIfPossible() {
    const core = getCore();

    if (typeof core.releaseModalBodyLockIfPossible === "function") {
      core.releaseModalBodyLockIfPossible();
      return;
    }

    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const comments = document.getElementById("klevbyFeedCommentModal");

    const viewerOpen = viewer && !viewer.classList.contains("hidden");
    const commentsOpen = comments && !comments.classList.contains("hidden");

    if (!viewerOpen && !commentsOpen) {
      document.body.classList.remove("post-modal-open");
    }
  }

  function pulseButton(button, duration = 130) {
    const core = getCore();

    if (typeof core.pulseButton === "function") {
      core.pulseButton(button, duration);
      return;
    }

    if (!button) return;

    button.classList.add("is-pressed");

    window.setTimeout(() => {
      button.classList.remove("is-pressed");
    }, Math.max(60, Number(duration || 130)));
  }

  function bindPressFeedback(root) {
    const core = getCore();

    if (typeof core.bindPressFeedback === "function") {
      core.bindPressFeedback(root);
      return;
    }

    if (!root || root.dataset.pressFeedbackBound === "1") return;

    root.dataset.pressFeedbackBound = "1";

    root.addEventListener("pointerdown", (event) => {
      const button = event.target?.closest?.("button");

      if (!button || button.disabled) return;

      button.classList.add("is-pressed");
    });

    root.addEventListener("pointerup", (event) => {
      const button = event.target?.closest?.("button");

      if (!button) return;

      window.setTimeout(() => {
        button.classList.remove("is-pressed");
      }, 90);
    });

    root.addEventListener("pointercancel", (event) => {
      const button = event.target?.closest?.("button");

      if (!button) return;

      button.classList.remove("is-pressed");
    });

    root.addEventListener("pointerleave", (event) => {
      const button = event.target?.closest?.("button");

      if (!button) return;

      button.classList.remove("is-pressed");
    });
  }

  function renderFeedSoon(delay = 80) {
    const core = getCore();

    if (typeof core.renderFeedSoon === "function") {
      core.renderFeedSoon(delay);
      return;
    }

    const safeDelay = Math.max(0, Number(delay || 0));

    setTimeout(() => {
      const renderer = getRender();

      if (typeof renderer.renderProfileFeed === "function") {
        renderer.renderProfileFeed();
        return;
      }

      if (typeof window.renderProfileFeed === "function") {
        window.renderProfileFeed();
      }
    }, safeDelay);
  }

  function dispatchFeedUpdated(detail = {}) {
    const utils = getUtils();

    if (typeof utils.dispatchFeedUpdated === "function") {
      utils.dispatchFeedUpdated(detail);
      return;
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail
    }));
  }

  function cssEscape(value) {
    const cleanValue = String(value || "");

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(cleanValue);
    }

    return cleanValue.replace(/["\\]/g, "\\$&");
  }

  function getSafeCommentsCount(value) {
    return Math.max(0, Number(value || 0) || 0);
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

  function normalizeComments(comments) {
    if (!Array.isArray(comments)) return [];

    return comments
      .filter(Boolean)
      .map((comment) => {
        return {
          ...comment,
          id: comment.id || "",
          post_id: comment.post_id || comment.postId || "",
          user_id: comment.user_id || comment.userId || "",
          author_name: comment.author_name || comment.authorName || "Рыбак",
          author_city: comment.author_city || comment.authorCity || "",
          author_telegram: comment.author_telegram || comment.authorTelegram || "",
          text: comment.text || "",
          created_at: comment.created_at || comment.createdAt || "",
          updated_at: comment.updated_at || comment.updatedAt || ""
        };
      });
  }

  function normalizeCommentsResult(result) {
    if (Array.isArray(result)) {
      return normalizeComments(result);
    }

    if (Array.isArray(result?.comments)) {
      return normalizeComments(result.comments);
    }

    if (Array.isArray(result?.data)) {
      return normalizeComments(result.data);
    }

    if (Array.isArray(result?.result?.comments)) {
      return normalizeComments(result.result.comments);
    }

    return [];
  }

  function getCachedComments(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const cached = commentsCacheByPostId.get(cleanId);

    return Array.isArray(cached) ? cached : [];
  }

  function setCachedComments(postId, comments) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const safeComments = normalizeComments(comments);

    commentsCacheByPostId.set(cleanId, safeComments);
    syncFeedCommentCount(cleanId, safeComments.length);

    return safeComments;
  }

  function appendCachedComment(postId, comment) {
    const cleanId = String(postId || "").trim();

    if (!cleanId || !comment) return getCachedComments(cleanId);

    const cached = getCachedComments(cleanId);
    const commentId = String(comment.id || "").trim();

    if (commentId && cached.some((item) => String(item?.id || "") === commentId)) {
      syncFeedCommentCount(cleanId, cached.length);
      return cached;
    }

    const nextComments = normalizeComments([
      ...cached,
      comment
    ]);

    commentsCacheByPostId.set(cleanId, nextComments);
    syncFeedCommentCount(cleanId, nextComments.length);

    return nextComments;
  }

  function removeCachedComment(postId, commentId) {
    const cleanPostId = String(postId || "").trim();
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanPostId || !cleanCommentId) {
      return getCachedComments(cleanPostId);
    }

    const nextComments = getCachedComments(cleanPostId).filter((comment) => {
      return String(comment?.id || "") !== cleanCommentId;
    });

    commentsCacheByPostId.set(cleanPostId, nextComments);
    syncFeedCommentCount(cleanPostId, nextComments.length);

    return nextComments;
  }

  function getCommentsListPostId(list) {
    return String(list?.dataset?.postId || "").trim();
  }

  function hasVisibleComments(list) {
    return Boolean(list?.querySelector?.(".klevby-feed-comment-item"));
  }

  function isCommentModalActiveForPost(postId, token = null) {
    const cleanId = String(postId || "").trim();
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (!modal || modal.classList.contains("hidden")) return false;
    if (String(modal.dataset.postId || "").trim() !== cleanId) return false;

    if (token !== null && String(modal.dataset.commentsLoadToken || "") !== String(token)) {
      return false;
    }

    return true;
  }

  function setCommentMessage(text = "", isError = false) {
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!message) return;

    message.textContent = String(text || "");
    message.classList.toggle("error-line", Boolean(isError));
  }

  function renderCommentsPlaceholder(list, text) {
    if (!list) return;

    list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(text || "Комментариев пока нет.")}</div>`;
  }

  function renderCommentsList(list, postId, comments, options = {}) {
    if (!list) return false;

    const cleanId = String(postId || "").trim();
    const safeComments = normalizeComments(comments);
    const shouldScroll = options.scrollToBottom !== false;

    list.dataset.postId = cleanId;
    syncFeedCommentCount(cleanId, safeComments.length);

    if (!safeComments.length) {
      renderCommentsPlaceholder(list, "Комментариев пока нет. Напиши первый.");
      return false;
    }

    list.innerHTML = safeComments.map(commentHtml).join("");

    if (shouldScroll) {
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }

    return true;
  }

  function renderCachedCommentsIfPossible(postId, options = {}) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const cleanId = String(postId || "").trim();
    const cached = getCachedComments(cleanId);

    if (!list || !cleanId || !cached.length) {
      return false;
    }

    renderCommentsList(list, cleanId, cached, options);

    return true;
  }

  function beginCommentsLoad(postId) {
    const cleanId = String(postId || "").trim();
    const modal = document.getElementById("klevbyFeedCommentModal");
    const token = `${Date.now()}-${commentsLoadSerial += 1}`;

    if (modal) {
      modal.dataset.postId = cleanId;
      modal.dataset.commentsLoadToken = token;
    }

    return token;
  }

  function ensureCommentModal() {
    ensureModalStyles();

    let modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      bindPressFeedback(modal);
      bindCommentModalEvents(modal);
      return modal;
    }

    modal = document.createElement("div");
    modal.id = "klevbyFeedCommentModal";
    modal.className = "klevby-feed-comment-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="klevby-feed-comment-backdrop" data-feed-comments-close="1"></div>

      <div class="klevby-feed-comment-sheet">
        <button
          class="klevby-feed-comment-close"
          type="button"
          data-feed-comments-close="1"
          aria-label="Закрыть комментарии"
        >×</button>

        <h3>Комментарии</h3>
        <p id="klevbyFeedCommentSubtitle">Смотри отзывы рыбаков и добавляй свой.</p>

        <div id="klevbyFeedCommentsList" class="klevby-feed-comments-list" data-post-id="">
          <div class="klevby-feed-comments-empty">Загружаем комментарии...</div>
        </div>

        <textarea
          id="klevbyFeedCommentText"
          class="klevby-feed-comment-textarea"
          maxlength="700"
          placeholder="Напиши свой комментарий..."
        ></textarea>

        <div class="klevby-feed-comment-actions">
          <button class="small-btn green" type="button" data-feed-comments-submit="1">Отправить</button>
          <button class="small-btn gray" type="button" data-feed-comments-close="1">Закрыть</button>
        </div>

        <div id="klevbyFeedCommentMessage" class="klevby-feed-comment-message"></div>
      </div>
    `;

    document.body.appendChild(modal);

    bindPressFeedback(modal);
    bindCommentModalEvents(modal);

    return modal;
  }

  function bindCommentModalEvents(modal) {
    if (!modal || modal.dataset.commentModalEventsBound === "1") return;

    modal.dataset.commentModalEventsBound = "1";

    modal.addEventListener("click", (event) => {
      const closeTarget = event.target?.closest?.("[data-feed-comments-close]");
      const submitTarget = event.target?.closest?.("[data-feed-comments-submit]");
      const deleteTarget = event.target?.closest?.("[data-feed-comment-delete-id]");

      if (closeTarget) {
        event.preventDefault();
        closeFeedCommentModal();
        return;
      }

      if (submitTarget) {
        event.preventDefault();
        pulseButton(submitTarget);
        submitFeedComment();
        return;
      }

      if (deleteTarget) {
        event.preventDefault();
        pulseButton(deleteTarget);
        deleteFeedComment(deleteTarget.dataset.feedCommentDeleteId || "");
      }
    });

    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFeedCommentModal();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        submitFeedComment();
      }
    });
  }

  function commentHtml(comment) {
    const authorName = comment?.author_name || "Рыбак";
    const city = comment?.author_city || "";
    const text = comment?.text || "";
    const date = formatDate(comment?.created_at);
    const canDelete = canManageComment(comment);
    const commentId = escapeAttr(comment?.id || "");

    return `
      <div class="klevby-feed-comment-item">
        <div class="klevby-feed-comment-top">
          <div>
            <span class="klevby-feed-comment-author">
              ${escapeHtml(authorName)}
              ${city ? ` · ${escapeHtml(city)}` : ""}
            </span>
            ${date ? `<span class="klevby-feed-comment-date">${escapeHtml(date)}</span>` : ""}
          </div>

          ${
            canDelete
              ? `<button class="klevby-feed-comment-delete" type="button" data-feed-comment-delete-id="${commentId}">Удалить</button>`
              : ""
          }
        </div>

        <p class="klevby-feed-comment-text">${escapeHtml(text)}</p>
      </div>
    `;
  }

  async function runLoadComments(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) {
      return {
        ok: false,
        comments: [],
        error: new Error("Не указан id фото.")
      };
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.loadComments === "function"
    ) {
      return withTimeout(
        window.klevbyFeedSupabase.loadComments(cleanId),
        COMMENTS_LOAD_TIMEOUT_MS,
        "Комментарии не загрузились: Supabase не ответил."
      );
    }

    if (typeof window.klevbyLoadFeedComments === "function") {
      return withTimeout(
        window.klevbyLoadFeedComments(cleanId),
        COMMENTS_LOAD_TIMEOUT_MS,
        "Комментарии не загрузились: функция загрузки не ответила."
      );
    }

    const api = getApi();

    if (typeof api.loadComments === "function") {
      return withTimeout(
        api.loadComments(cleanId),
        COMMENTS_LOAD_TIMEOUT_MS,
        "Комментарии не загрузились: API ленты не ответил."
      );
    }

    return {
      ok: false,
      comments: [],
      error: new Error("Загрузка комментариев ещё не подключена.")
    };
  }

  async function loadCommentsIntoModal(postId, options = {}) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const cleanId = String(postId || "").trim();

    if (!list) return;

    if (!cleanId) {
      renderCommentsPlaceholder(list, "Фото не найдено.");
      return;
    }

    const token = beginCommentsLoad(cleanId);
    const cached = getCachedComments(cleanId);
    const listPostId = getCommentsListPostId(list);
    const isSamePostList = listPostId === cleanId;
    const hasCurrentVisibleComments = isSamePostList && hasVisibleComments(list);

    list.dataset.postId = cleanId;

    if (cached.length) {
      renderCommentsList(list, cleanId, cached, {
        scrollToBottom: options.scrollToBottom !== false
      });
    } else if (!hasCurrentVisibleComments) {
      renderCommentsPlaceholder(list, "Загружаем комментарии...");
    }

    try {
      const result = await runLoadComments(cleanId);

      if (!result || !result.ok) {
        const error = result?.error || new Error("Не удалось загрузить комментарии.");
        throw error;
      }

      const comments = setCachedComments(cleanId, normalizeCommentsResult(result));

      if (!isCommentModalActiveForPost(cleanId, token)) {
        return;
      }

      renderCommentsList(list, cleanId, comments, {
        scrollToBottom: options.scrollToBottom !== false
      });

      setCommentMessage("", false);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарии не загрузились", error);

      if (!isCommentModalActiveForPost(cleanId, token)) {
        return;
      }

      const latestCached = getCachedComments(cleanId);

      if (latestCached.length) {
        renderCommentsList(list, cleanId, latestCached, {
          scrollToBottom: false
        });

        setCommentMessage("Комментарии не обновились. Показываю последние загруженные.", true);
        return;
      }

      if (hasVisibleComments(list) && getCommentsListPostId(list) === cleanId) {
        setCommentMessage("Комментарии не обновились. Уже показанные комментарии оставлены.", true);
        return;
      }

      renderCommentsPlaceholder(
        list,
        error?.message || "Не удалось загрузить комментарии."
      );
    }
  }

  function openFeedCommentModal(postId) {
    const cleanId = String(postId || "").trim();
    const item = getCachedItem(cleanId);

    if (!cleanId) {
      alert("Фото не найдено. Обнови страницу и попробуй ещё раз.");
      return;
    }

    if (!item) {
      alert("Фото не найдено в ленте. Обнови страницу и попробуй ещё раз.");
      return;
    }

    if (item.source !== "supabase") {
      alert("Это фото ещё локальное. Комментарии работают для фото из общей ленты.");
      return;
    }

    const modal = ensureCommentModal();
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const subtitle = document.getElementById("klevbyFeedCommentSubtitle");
    const list = document.getElementById("klevbyFeedCommentsList");
    const submitButton = modal?.querySelector?.("[data-feed-comments-submit]");
    const cachedComments = getCachedComments(cleanId);

    modal.dataset.postId = cleanId;
    scheduleCommentCountSync(40);

    if (list) {
      list.dataset.postId = cleanId;

      if (cachedComments.length) {
        renderCommentsList(list, cleanId, cachedComments, {
          scrollToBottom: false
        });
      } else {
        renderCommentsPlaceholder(list, "Загружаем комментарии...");
      }
    }

    if (textarea) {
      textarea.value = "";
    }

    if (message) {
      message.textContent = "";
      message.classList.remove("error-line");
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.setAttribute("aria-busy", "false");
      submitButton.classList.remove("is-pending");
      submitButton.textContent = "Отправить";
    }

    if (subtitle) {
      subtitle.textContent = `${item.authorName || "Рыбак"} добавил фото. Ниже комментарии и поле для твоего отзыва.`;
    }

    modal.classList.remove("hidden");
    setModalBodyLock();

    loadCommentsIntoModal(cleanId, {
      scrollToBottom: !cachedComments.length
    });

    setTimeout(() => {
      if (textarea && isCommentModalActiveForPost(cleanId)) {
        textarea.focus({
          preventScroll: true
        });
      }
    }, 220);
  }

  function closeFeedCommentModal() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      modal.classList.add("hidden");
      modal.dataset.postId = "";
      modal.dataset.commentsLoadToken = "";
    }

    setSubmitBusy(false);
    releaseModalBodyLockIfPossible();
    scheduleCommentCountSync(80);
  }

  async function runAddComment(postId, text) {
    const cleanId = String(postId || "").trim();
    const cleanText = String(text || "").trim();

    if (!cleanId) {
      throw new Error("Не указан id фото.");
    }

    if (!cleanText) {
      throw new Error("Комментарий пустой.");
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.addComment === "function"
    ) {
      return withTimeout(
        window.klevbyFeedSupabase.addComment(cleanId, cleanText),
        COMMENTS_SEND_TIMEOUT_MS,
        "Комментарий не отправился: Supabase не ответил."
      );
    }

    if (typeof window.klevbyAddFeedComment === "function") {
      return withTimeout(
        window.klevbyAddFeedComment(cleanId, cleanText),
        COMMENTS_SEND_TIMEOUT_MS,
        "Комментарий не отправился: функция отправки не ответила."
      );
    }

    const api = getApi();

    if (typeof api.addComment === "function") {
      return withTimeout(
        api.addComment(cleanId, cleanText),
        COMMENTS_SEND_TIMEOUT_MS,
        "Комментарий не отправился: API ленты не ответил."
      );
    }

    throw new Error("Комментарии ещё не подключены в feed-supabase.js.");
  }

  function setSubmitBusy(isBusy) {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const submitButton = modal?.querySelector?.("[data-feed-comments-submit]");

    if (!submitButton) return;

    submitButton.disabled = Boolean(isBusy);
    submitButton.setAttribute("aria-busy", isBusy ? "true" : "false");
    submitButton.classList.toggle("is-pending", Boolean(isBusy));
    submitButton.textContent = isBusy ? "Отправляем..." : "Отправить";
  }

  async function submitFeedComment() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const list = document.getElementById("klevbyFeedCommentsList");

    if (!modal || !textarea) {
      console.warn("Klevby feed comments modal: submit skipped, DOM not ready");
      return;
    }

    const postId = String(modal.dataset.postId || "").trim();
    const text = String(textarea.value || "").trim();

    if (!postId) {
      if (message) {
        message.textContent = "Фото не найдено. Закрой окно и попробуй ещё раз.";
        message.classList.add("error-line");
      }

      return;
    }

    if (!text) {
      if (message) {
        message.textContent = "Напиши комментарий перед отправкой.";
        message.classList.add("error-line");
      }

      textarea.focus();
      return;
    }

    if (text.length > 700) {
      if (message) {
        message.textContent = "Комментарий слишком длинный. Сделай короче.";
        message.classList.add("error-line");
      }

      textarea.focus();
      return;
    }

    if (message) {
      message.textContent = "Отправляем комментарий...";
      message.classList.remove("error-line");
    }

    setSubmitBusy(true);

    try {
      const createdComment = await runAddComment(postId, text);

      textarea.value = "";

      if (createdComment && typeof createdComment === "object") {
        const nextComments = appendCachedComment(postId, createdComment);

        if (list && isCommentModalActiveForPost(postId)) {
          renderCommentsList(list, postId, nextComments, {
            scrollToBottom: true
          });
        }
      }

      if (message) {
        message.textContent = "✅ Комментарий отправлен.";
        message.classList.remove("error-line");
      }

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      loadCommentsIntoModal(postId, {
        scrollToBottom: true
      });

      scheduleCommentCountSync(80);
      scheduleCommentCountSync(900);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не отправился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось отправить комментарий.";
        message.classList.add("error-line");
      }
    } finally {
      setSubmitBusy(false);
    }
  }

  async function deleteFeedComment(commentId) {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const list = document.getElementById("klevbyFeedCommentsList");
    const postId = String(modal?.dataset?.postId || "").trim();
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) return;

    if (!confirm("Удалить комментарий?")) {
      return;
    }

    try {
      if (
        window.klevbyFeedSupabase &&
        typeof window.klevbyFeedSupabase.deleteComment === "function"
      ) {
        await withTimeout(
          window.klevbyFeedSupabase.deleteComment(cleanCommentId),
          COMMENTS_SEND_TIMEOUT_MS,
          "Комментарий не удалился: Supabase не ответил."
        );
      } else if (typeof window.klevbyDeleteFeedComment === "function") {
        await withTimeout(
          window.klevbyDeleteFeedComment(cleanCommentId),
          COMMENTS_SEND_TIMEOUT_MS,
          "Комментарий не удалился: функция удаления не ответила."
        );
      } else {
        const api = getApi();

        if (typeof api.deleteComment === "function") {
          await withTimeout(
            api.deleteComment(cleanCommentId),
            COMMENTS_SEND_TIMEOUT_MS,
            "Комментарий не удалился: API ленты не ответил."
          );
        } else {
          throw new Error("Удаление комментариев ещё не подключено.");
        }
      }

      if (message) {
        message.textContent = "Комментарий удалён.";
        message.classList.remove("error-line");
      }

      if (postId) {
        const nextComments = removeCachedComment(postId, cleanCommentId);

        if (list && isCommentModalActiveForPost(postId)) {
          renderCommentsList(list, postId, nextComments, {
            scrollToBottom: false
          });
        }

        loadCommentsIntoModal(postId, {
          scrollToBottom: false
        });

        scheduleCommentCountSync(80);
        scheduleCommentCountSync(900);
      }
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не удалился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось удалить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  function initCommentsActions() {
    ensureModalStyles();
    bindCommentCountSyncHooks();

    if (!window.__klevbyFeedCommentsActionsKeydownBound) {
      window.__klevbyFeedCommentsActionsKeydownBound = true;

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeFeedCommentModal();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentsActions);
  } else {
    setTimeout(initCommentsActions, 0);
  }

  const commentsModal = {
    ensureCommentModal,
    openFeedCommentModal,
    closeFeedCommentModal,
    loadCommentsIntoModal,
    submitFeedComment,
    deleteFeedComment,
    runLoadComments,
    runAddComment,
    syncFeedCommentCount,
    getKnownCommentCount,
    applyKnownCommentCountsToVisibleFeed,
    scheduleCommentCountSync
  };

  window.KlevbyFeedCommentsModal = commentsModal;

  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
  window.klevbySyncFeedCommentCount = syncFeedCommentCount;
  window.klevbyGetKnownFeedCommentCount = getKnownCommentCount;
})();
