(function () {
  "use strict";

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
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

  function getCurrentUser() {
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
    const utils = getUtils();

    if (typeof utils.isAdmin === "function") {
      return Boolean(utils.isAdmin());
    }

    if (typeof window.isAdmin === "function") {
      try {
        return Boolean(window.isAdmin());
      } catch (error) {
        return false;
      }
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function openProfileSafe() {
    const utils = getUtils();

    if (typeof utils.openProfileSafe === "function") {
      utils.openProfileSafe();
      return;
    }

    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function getCachedItem(postId) {
    const state = getState();
    const cleanId = String(postId || "");

    if (typeof state.getCachedItem === "function") {
      return state.getCachedItem(cleanId);
    }

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function canManageFeedItem(item) {
    if (!item) return false;

    const utils = getUtils();

    if (typeof utils.canManageFeedItem === "function") {
      return Boolean(utils.canManageFeedItem(item));
    }

    if (item.source === "local") {
      return true;
    }

    const user = getCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      isAdmin() ||
      (userId && item.userId && String(userId) === String(item.userId))
    );
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
    if (!comment) return false;

    const user = getCurrentUser();
    const userId = getCurrentUserId(user);
    const commentOwnerId = getCommentOwnerId(comment);

    return Boolean(
      isAdmin() ||
      (userId && commentOwnerId && userId === commentOwnerId)
    );
  }

  function renderFeedSoon(delay = 180) {
    const renderer = getRender();

    setTimeout(() => {
      if (typeof renderer.renderProfileFeed === "function") {
        renderer.renderProfileFeed();
        return;
      }

      if (typeof window.renderProfileFeed === "function") {
        window.renderProfileFeed();
      }
    }, delay);
  }

  function setModalBodyLock() {
    document.body.classList.add("post-modal-open");
  }

  function releaseModalBodyLockIfPossible() {
    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const comments = document.getElementById("klevbyFeedCommentModal");

    const viewerOpen = viewer && !viewer.classList.contains("hidden");
    const commentsOpen = comments && !comments.classList.contains("hidden");

    if (!viewerOpen && !commentsOpen) {
      document.body.classList.remove("post-modal-open");
    }
  }

  function getBooleanLikeStateFromItem(item) {
    if (!item || typeof item !== "object") return false;

    const candidates = [
      item.likedByViewer,
      item.viewerLiked,
      item.isLiked,
      item.liked,
      item.hasLiked,
      item.liked_by_viewer
    ];

    for (const value of candidates) {
      if (typeof value === "boolean") return value;
    }

    return false;
  }

  function getViewerButtonLikeCount(button, item) {
    const dataCount = Number(button?.dataset?.likeCount);

    if (Number.isFinite(dataCount)) {
      return Math.max(0, dataCount);
    }

    const itemCount = Number(item?.likesCount || item?.likes_count || 0);

    if (Number.isFinite(itemCount)) {
      return Math.max(0, itemCount);
    }

    const match = String(button?.textContent || "").match(/-?\d+/);

    if (!match) return 0;

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function getViewerButtonLiked(button, item) {
    const dataLiked = String(button?.dataset?.liked || "");

    if (dataLiked === "true") return true;
    if (dataLiked === "false") return false;

    return getBooleanLikeStateFromItem(item);
  }

  function setViewerLikeButtonState(button, count, liked, pending = false) {
    if (!button) return;

    const safeCount = Math.max(0, Number(count || 0) || 0);
    const safeLiked = Boolean(liked);

    button.textContent = `👍 ${safeCount}`;
    button.dataset.likeCount = String(safeCount);
    button.dataset.liked = safeLiked ? "true" : "false";
    button.dataset.pendingLike = pending ? "1" : "0";
    button.setAttribute("aria-pressed", safeLiked ? "true" : "false");
    button.classList.toggle("liked", safeLiked);
    button.classList.toggle("is-liked", safeLiked);
    button.classList.toggle("is-pending", pending);
    button.disabled = Boolean(pending);
  }

  function pulseButton(button, duration = 160) {
    if (!button) return;

    button.classList.add("is-pressed");

    window.setTimeout(() => {
      button.classList.remove("is-pressed");
    }, duration);
  }

  function bindPressFeedback(root) {
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

    root.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");

      if (!button || button.disabled) return;

      pulseButton(button, 130);
    });
  }

  window.KlevbyFeedModalCore = {
    getState,
    getUtils,
    getApi,
    getRender,
    escapeHtml,
    escapeAttr,
    formatDate,
    getCurrentUser,
    isAdmin,
    openProfileSafe,
    getCachedItem,
    canManageFeedItem,
    canManageComment,
    renderFeedSoon,
    setModalBodyLock,
    releaseModalBodyLockIfPossible,
    getBooleanLikeStateFromItem,
    getViewerButtonLikeCount,
    getViewerButtonLiked,
    setViewerLikeButtonState,
    pulseButton,
    bindPressFeedback
  };

  console.log("Klevby feed modal core loaded");
})();
