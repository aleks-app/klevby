(function () {
  "use strict";

  const KLEVB_PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  let klevbyFeedViewerLikePending = false;
  let klevbyFeedViewerDeletePendingIds = new Set();

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

  function openProfileSafe() {
    const core = getCore();

    if (typeof core.openProfileSafe === "function") {
      core.openProfileSafe();
      return;
    }

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

  function canManageFeedItem(item) {
    const core = getCore();

    if (typeof core.canManageFeedItem === "function") {
      return Boolean(core.canManageFeedItem(item));
    }

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

  function renderFeedSoon(delayMs = 120) {
    const core = getCore();

    if (typeof core.renderFeedSoon === "function") {
      core.renderFeedSoon(delayMs);
      return;
    }

    const safeDelay = Math.max(0, Number(delayMs || 0));

    window.setTimeout(() => {
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

  function readCount(value) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.max(0, number);
    }

    return 0;
  }

  function setViewerLikeButtonState(button, count, liked, pending = false) {
    if (!button) return;

    const safeCount = readCount(count);
    const safeLiked = Boolean(liked);

    button.textContent = `👍 ${safeCount}`;
    button.dataset.likeCount = String(safeCount);
    button.dataset.liked = safeLiked ? "true" : "false";
    button.dataset.pendingLike = pending ? "1" : "0";
    button.setAttribute("aria-pressed", safeLiked ? "true" : "false");
    button.classList.toggle("liked", safeLiked);
    button.classList.toggle("is-liked", safeLiked);
    button.classList.toggle("is-pending", Boolean(pending));
    button.disabled = Boolean(pending);
  }

  function ensurePhotoViewer() {
    ensureModalStyles();

    let viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewer) {
      bindPressFeedback(viewer);
      bindPhotoViewerEvents(viewer);
      cleanupLegacyViewerActionButtons(viewer);
      return viewer;
    }

    viewer = document.createElement("div");
    viewer.id = "klevbyFeedPhotoViewer";
    viewer.className = "klevby-feed-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");

    viewer.innerHTML = `
      <div class="klevby-feed-viewer-backdrop" data-feed-viewer-close="1"></div>

      <div class="klevby-feed-viewer-sheet">
        <button
          class="klevby-feed-viewer-close"
          type="button"
          data-feed-viewer-close="1"
          aria-label="Закрыть фото"
        >×</button>

        <img id="klevbyFeedPhotoViewerImage" class="klevby-feed-viewer-image" alt="Фото из ленты">

        <div class="klevby-feed-viewer-info">
          <div>
            <strong id="klevbyFeedPhotoViewerTitle">Фото с рыбалки</strong>
            <span id="klevbyFeedPhotoViewerMeta">Лента Klevby</span>
          </div>

          <div class="klevby-feed-viewer-actions">
            <button id="klevbyFeedViewerDeleteBtn" type="button">Удалить</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);

    bindPressFeedback(viewer);
    bindPhotoViewerEvents(viewer);

    return viewer;
  }

  function cleanupLegacyViewerActionButtons(viewer) {
    if (!viewer) return;

    const legacyLikeButton = viewer.querySelector("#klevbyFeedViewerLikeBtn");
    const legacyCommentButton = viewer.querySelector("#klevbyFeedViewerCommentBtn");

    if (legacyLikeButton) {
      legacyLikeButton.remove();
    }

    if (legacyCommentButton) {
      legacyCommentButton.remove();
    }
  }

  function bindPhotoViewerEvents(viewer) {
    if (!viewer || viewer.dataset.photoViewerEventsBound === "1") return;

    viewer.dataset.photoViewerEventsBound = "1";

    viewer.addEventListener("click", (event) => {
      const closeTarget = event.target?.closest?.("[data-feed-viewer-close]");

      if (closeTarget) {
        event.preventDefault();
        closeFeedPhotoViewer();
      }
    });

    viewer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFeedPhotoViewer();
      }
    });
  }

  function closeFeedPhotoViewer() {
    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const image = document.getElementById("klevbyFeedPhotoViewerImage");
    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");

    klevbyFeedViewerLikePending = false;

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    if (deleteButton) {
      setViewerDeleteButtonBusy(deleteButton, false);
      deleteButton.onclick = null;
    }

    releaseModalBodyLockIfPossible();
  }

  function getFeedDeleteKey(item) {
    return String(item?.id || item?.feedPostId || item?.localId || "").trim();
  }

  function isFeedDeletePending(item) {
    const key = getFeedDeleteKey(item);
    return Boolean(key && klevbyFeedViewerDeletePendingIds.has(key));
  }

  function setFeedDeletePending(item, isPending) {
    const key = getFeedDeleteKey(item);

    if (!key) return;

    if (isPending) {
      klevbyFeedViewerDeletePendingIds.add(key);
      return;
    }

    klevbyFeedViewerDeletePendingIds.delete(key);
  }

  function setViewerDeleteButtonBusy(button, isBusy) {
    if (!button) return;

    button.disabled = Boolean(isBusy);
    button.dataset.deleting = isBusy ? "1" : "0";
    button.setAttribute("aria-busy", isBusy ? "true" : "false");
    button.textContent = isBusy ? "Удаляю…" : "Удалить";
  }

  function getItemIdentityList(item) {
    return Array.from(new Set([
      item?.id,
      item?.feedPostId,
      item?.localId,
      item?.postId,
      item?.feed_post_id
    ].map((value) => String(value || "").trim()).filter(Boolean)));
  }

  function escapeCssValue(value) {
    const cleanValue = String(value || "");

    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(cleanValue);
    }

    return cleanValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  function removeFeedItemDomNow(item) {
    const ids = getItemIdentityList(item);

    ids.forEach((id) => {
      const escaped = escapeCssValue(id);
      const selectors = [
        `[data-feed-post-id="${escaped}"]`,
        `[data-post-id="${escaped}"]`,
        `[data-feed-id="${escaped}"]`,
        `[data-item-id="${escaped}"]`,
        `[data-id="${escaped}"]`,
        `button[onclick*="${escaped}"]`,
        `a[onclick*="${escaped}"]`
      ];

      selectors.forEach((selector) => {
        let nodes = [];

        try {
          nodes = Array.from(document.querySelectorAll(selector));
        } catch (_) {
          nodes = [];
        }

        nodes.forEach((node) => {
          const card = node.closest?.(
            ".klevby-feed-card, .klevby-feed-post, .klevby-feed-item, .profile-feed-card, .feed-card, .feed-photo-card, .post-card, article, li"
          );

          if (card && card.id !== "klevbyFeedPhotoViewer") {
            card.remove();
          }
        });
      });
    });
  }

  function rememberOptimisticDeletedFeedItem(item) {
    const ids = getItemIdentityList(item);

    if (!window.__klevbyFeedOptimisticDeletedIds) {
      window.__klevbyFeedOptimisticDeletedIds = new Set();
    }

    if (!window.__klevbyFeedOptimisticDeletedAt) {
      window.__klevbyFeedOptimisticDeletedAt = {};
    }

    ids.forEach((id) => {
      window.__klevbyFeedOptimisticDeletedIds.add(id);
      window.__klevbyFeedOptimisticDeletedAt[id] = Date.now();

      if (window.__klevbyFeedItemsCache && typeof window.__klevbyFeedItemsCache === "object") {
        delete window.__klevbyFeedItemsCache[id];
      }
    });

    const state = getState();
    const methods = [
      "removeCachedItem",
      "deleteCachedItem",
      "removeItem",
      "deleteItem",
      "markDeleted"
    ];

    methods.forEach((methodName) => {
      if (typeof state[methodName] !== "function") return;

      ids.forEach((id) => {
        try {
          state[methodName](id);
        } catch (_) {
          // optional state cleanup
        }
      });
    });
  }

  function removeFeedItemFromProfileLocalPhotos(item) {
    const ids = getItemIdentityList(item);

    if (!ids.length) return false;

    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_PHOTOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(parsed) || !parsed.length) return false;

      const updated = parsed.filter((photo) => {
        return !ids.some((id) => {
          return (
            String(photo?.id || "") === id ||
            String(photo?.feedPostId || "") === id ||
            String(photo?.feed_post_id || "") === id
          );
        });
      });

      if (updated.length === parsed.length) return false;

      localStorage.setItem(KLEVB_PROFILE_PHOTOS_KEY, JSON.stringify(updated));

      if (typeof window.updateKlevbyProfileView === "function") {
        try {
          window.updateKlevbyProfileView();
        } catch (_) {
          // optional profile refresh
        }
      }

      return true;
    } catch (error) {
      console.warn("Klevby feed photo viewer: локальные фото профиля не обновились после удаления", error);
      return false;
    }
  }

  function dispatchOptimisticFeedDelete(item, stage = "optimistic") {
    const postId = String(item?.id || item?.feedPostId || "").trim();

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "feed_photo_deleted_optimistic",
        postId,
        photoId: postId,
        itemId: postId,
        imagePath: item?.imagePath || "",
        item,
        optimistic: stage === "optimistic",
        background: stage !== "server_confirmed",
        stage
      }
    }));

    window.dispatchEvent(new CustomEvent("klevby-feed-photo-deleted", {
      detail: {
        postId,
        photoId: postId,
        itemId: postId,
        imagePath: item?.imagePath || "",
        item,
        optimistic: stage === "optimistic",
        background: stage !== "server_confirmed",
        stage
      }
    }));
  }

  async function deleteFeedItemOnServer(item) {
    const api = getApi();

    if (item.source === "supabase") {
      if (typeof api.deletePost === "function") {
        await api.deletePost(item.id, item.imagePath || "");
        return true;
      }

      if (typeof window.klevbyDeleteFeedPostFromSupabase === "function") {
        await window.klevbyDeleteFeedPostFromSupabase(item.id, item.imagePath || "");
        return true;
      }

      throw new Error("Удаление Supabase-фото ещё не подключено.");
    }

    if (typeof window.removeProfilePhoto === "function") {
      await window.removeProfilePhoto(item.id);
      return true;
    }

    return true;
  }

  function runFeedItemDeleteInBackground(item) {
    window.setTimeout(async () => {
      try {
        await deleteFeedItemOnServer(item);

        dispatchOptimisticFeedDelete(item, "server_confirmed");
        renderFeedSoon(120);

        console.info("Klevby feed photo viewer: фото удалено на сервере в фоне", {
          postId: item?.id || ""
        });
      } catch (error) {
        console.warn("Klevby feed photo viewer: фото скрыто локально, но серверное удаление не подтвердилось", {
          postId: item?.id || "",
          error
        });
      } finally {
        setFeedDeletePending(item, false);
      }
    }, 0);
  }

  async function deleteFeedItem(item) {
    if (!item || !item.id) return;

    if (isFeedDeletePending(item)) {
      return;
    }

    if (!confirm("Удалить фото из ленты? Это действие нельзя отменить.")) {
      return;
    }

    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");

    setFeedDeletePending(item, true);
    setViewerDeleteButtonBusy(deleteButton, true);

    rememberOptimisticDeletedFeedItem(item);
    removeFeedItemFromProfileLocalPhotos(item);
    removeFeedItemDomNow(item);
    closeFeedPhotoViewer();
    dispatchOptimisticFeedDelete(item, "optimistic");

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }

    runFeedItemDeleteInBackground(item);
  }

  async function toggleLikeFromViewer() {
    klevbyFeedViewerLikePending = false;
    return false;
  }

  function openFeedPhotoViewer(item) {
    if (!item) return;

    const viewer = ensurePhotoViewer();
    const image = document.getElementById("klevbyFeedPhotoViewerImage");
    const title = document.getElementById("klevbyFeedPhotoViewerTitle");
    const meta = document.getElementById("klevbyFeedPhotoViewerMeta");
    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");

    const imageUrl = item.image || item.imageUrl || "";
    const titleText = item.title || item.caption || "Фото с рыбалки";
    const dateText = formatDate(item.createdAt);
    const cityText = item.authorCity ? `📍 ${item.authorCity}` : "";
    const likesCount = readCount(item.likesCount ?? item.likes_count);
    const commentsCount = readCount(item.commentsCount ?? item.comments_count);
    const likesText = item.source === "supabase" ? `👍 ${likesCount}` : "";
    const commentsText = item.source === "supabase" ? `💬 ${commentsCount}` : "";

    if (image) {
      image.src = imageUrl;
    }

    if (title) {
      title.textContent = titleText;
    }

    if (meta) {
      meta.textContent = [
        cityText,
        dateText,
        likesText,
        commentsText
      ].filter(Boolean).join(" • ");
    }

    if (deleteButton) {
      const canDelete = canManageFeedItem(item);
      const isDeleting = isFeedDeletePending(item);

      deleteButton.classList.toggle("hidden", !canDelete);
      setViewerDeleteButtonBusy(deleteButton, isDeleting);

      deleteButton.onclick = () => {
        if (deleteButton.disabled || deleteButton.dataset.deleting === "1") return;

        pulseButton(deleteButton);
        deleteFeedItem(item);
      };
    }

    viewer.classList.remove("hidden");
    setModalBodyLock();

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function openProfilePhotoFeedItem(photoId) {
    const cleanId = String(photoId || "").trim();
    const cachedItem = getCachedItem(cleanId);

    if (cachedItem) {
      openFeedPhotoViewer(cachedItem);
      return;
    }

    if (typeof window.openProfilePhotoViewer === "function") {
      window.openProfilePhotoViewer(cleanId);
      return;
    }

    openProfileSafe();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureModalStyles();

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFeedPhotoViewer();
      }
    });
  });

  const photoViewer = {
    ensurePhotoViewer,
    openProfilePhotoFeedItem,
    openFeedPhotoViewer,
    closeFeedPhotoViewer,
    toggleLikeFromViewer,
    deleteFeedItem,
    setViewerLikeButtonState
  };

  window.KlevbyFeedPhotoViewer = photoViewer;

  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.closeFeedPhotoViewer = closeFeedPhotoViewer;
})();
