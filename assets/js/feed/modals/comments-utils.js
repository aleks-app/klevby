(function () {
  "use strict";

  const COMMENTS_LOAD_TIMEOUT_MS = 7000;
  const COMMENTS_SEND_TIMEOUT_MS = 9000;

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

  function getCurrentUserId(user) {
    if (!user) return "";

    return String(
      user.id ||
      user.userId ||
      user.user_id ||
      user?.user?.id ||
      user?.user?.userId ||
      user?.user?.user_id ||
      ""
    ).trim();
  }

  function getCommentOwnerId(comment) {
    if (!comment) return "";

    return String(
      comment.user_id ||
      comment.userId ||
      comment.owner_id ||
      comment.ownerId ||
      comment.author_id ||
      comment.authorId ||
      ""
    ).trim();
  }

  function canManageComment(comment) {
    const core = getCore();

    if (typeof core.canManageComment === "function") {
      return Boolean(core.canManageComment(comment));
    }

    if (!comment) return false;

    const user = getCurrentUser();
    const userId = getCurrentUserId(user);
    const commentOwnerId = getCommentOwnerId(comment);

    return Boolean(
      isAdmin() ||
      (userId && commentOwnerId && userId === commentOwnerId)
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

  const commentsUtils = {
    COMMENTS_LOAD_TIMEOUT_MS,
    COMMENTS_SEND_TIMEOUT_MS,

    getCore,
    getStyles,
    getState,
    getUtils,
    getApi,
    getRender,

    escapeHtml,
    escapeAttr,
    formatDate,
    withTimeout,

    getCurrentUser,
    isAdmin,
    getCachedItem,
    getLastItemsArray,
    setLastItemsArray,
    canManageComment,

    ensureModalStyles,
    setModalBodyLock,
    releaseModalBodyLockIfPossible,
    pulseButton,
    bindPressFeedback,
    renderFeedSoon,
    dispatchFeedUpdated,

    cssEscape,
    getSafeCommentsCount
  };

  window.KlevbyFeedCommentsUtils = commentsUtils;
  window.KlevbyFeedCommentUtils = commentsUtils;
})();
