(function () {
  "use strict";

  let klevbyFeedViewerLikePending = false;

  function getCore() {
    return window.KlevbyFeedModalCore || {};
  }

  function getStyles() {
    return window.KlevbyFeedModalStyles || {};
  }

  function getCommentsModal() {
    return window.KlevbyFeedCommentsModal || {};
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

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(ms || 0)));
    });
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

  function readNumber(value, fallback = 0) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.max(0, number);
    }

    return Math.max(0, Number(fallback || 0) || 0);
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
    button.classList.remove("is-pending");
    button.disabled = Boolean(pending);
  }

  function elementTreeContainsPostId(element, postId) {
    const cleanId = String(postId || "").trim();

    if (!element || !cleanId) return false;

    let node = element;
    let depth = 0;

    while (node && node.nodeType === 1 && depth < 9) {
      const dataset = node.dataset || {};

      for (const key of Object.keys(dataset)) {
        const value = String(dataset[key] || "");

        if (value === cleanId) {
          return true;
        }
      }

      const attributes = Array.from(node.attributes || []);

      for (const attr of attributes) {
        const value = String(attr.value || "");

        if (value === cleanId) {
          return true;
        }
      }

      node = node.parentElement;
      depth += 1;
    }

    return false;
  }

  function isLikelyLikeButton(button) {
    if (!button) return false;
    if (button.id === "klevbyFeedViewerLikeBtn") return false;
    if (button.closest("#klevbyFeedPhotoViewer")) return false;

    const text = String(button.textContent || "").toLowerCase();
    const className = String(button.className || "").toLowerCase();
    const dataset = button.dataset || {};
    const attributes = Array.from(button.attributes || [])
      .map((attr) => `${attr.name}=${attr.value}`)
      .join(" ")
      .toLowerCase();

    return (
      text.includes("👍") ||
      text.includes("лайк") ||
      className.includes("like") ||
      attributes.includes("like") ||
      Object.keys(dataset).some((key) => key.toLowerCase().includes("like"))
    );
  }

  function findFeedCardLikeButton(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));

    const exactButton = buttons.find((button) => {
      return (
        isLikelyLikeButton(button) &&
        elementTreeContainsPostId(button, cleanId)
      );
    });

    if (exactButton) {
      return exactButton;
    }

    return null;
  }

  function readLikeCountFromButton(button, fallback = 0) {
    if (!button) return readNumber(fallback, 0);

    const dataset = button.dataset || {};
    const directValues = [
      dataset.likeCount,
      dataset.likesCount,
      dataset.count,
      button.getAttribute("data-like-count"),
      button.getAttribute("data-likes-count"),
      button.getAttribute("aria-label")
    ];

    for (const value of directValues) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return Math.max(0, number);
      }
    }

    const match = String(button.textContent || "").match(/-?\d+/);

    if (match) {
      const number = Number(match[0]);

      if (Number.isFinite(number)) {
        return Math.max(0, number);
      }
    }

    return readNumber(fallback, 0);
  }

  function readLikedFromButton(button, fallback = false) {
    if (!button) return Boolean(fallback);

    const dataset = button.dataset || {};
    const values = [
      dataset.liked,
      dataset.viewerLiked,
      dataset.isLiked,
      button.getAttribute("aria-pressed"),
      button.getAttribute("data-liked"),
      button.getAttribute("data-viewer-liked")
    ];

    for (const value of values) {
      const cleanValue = String(value || "").trim().toLowerCase();

      if (cleanValue === "true" || cleanValue === "1" || cleanValue === "yes") {
        return true;
      }

      if (cleanValue === "false" || cleanValue === "0" || cleanValue === "no") {
        return false;
      }
    }

    return Boolean(
      fallback ||
      button.classList.contains("liked") ||
      button.classList.contains("is-liked") ||
      button.classList.contains("active") ||
      button.classList.contains("is-active")
    );
  }

  function syncViewerLikeButtonFromFeed(postId, fallbackItem = null) {
    const likeButton = document.getElementById("klevbyFeedViewerLikeBtn");

    if (!likeButton) return;

    const cachedItem = getCachedItem(postId) || fallbackItem || {};
    const fallbackCount = Number(cachedItem.likesCount || cachedItem.likes_count || likeButton.dataset.likeCount || 0);
    const fallbackLiked = getBooleanLikeStateFromItem(cachedItem) || getViewerButtonLiked(likeButton, cachedItem);

    setViewerLikeButtonState(
      likeButton,
      readNumber(fallbackCount, 0),
      Boolean(fallbackLiked),
      false
    );
  }

  function ensurePhotoViewer() {
    ensureModalStyles();

    let viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewer) {
      bindPressFeedback(viewer);
      bindPhotoViewerEvents(viewer);
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
            <button id="klevbyFeedViewerLikeBtn" type="button" aria-pressed="false">👍 0</button>
            <button id="klevbyFeedViewerCommentBtn" type="button">💬 Комментарии</button>
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

    klevbyFeedViewerLikePending = false;

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    releaseModalBodyLockIfPossible();
  }

  async function deleteFeedItem(item) {
    if (!item || !item.id) return;

    if (!confirm("Удалить фото из ленты? Это действие нельзя отменить.")) {
      return;
    }

    const api = getApi();

    try {
      if (item.source === "supabase") {
        if (typeof api.deletePost === "function") {
          await api.deletePost(item.id, item.imagePath || "");
        } else if (typeof window.klevbyDeleteFeedPostFromSupabase === "function") {
          await window.klevbyDeleteFeedPostFromSupabase(item.id, item.imagePath || "");
        } else {
          throw new Error("Удаление Supabase-фото ещё не подключено.");
        }
      } else if (typeof window.removeProfilePhoto === "function") {
        await window.removeProfilePhoto(item.id);
      }

      closeFeedPhotoViewer();
      renderFeedSoon(120);

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch (error) {
      console.error("Klevby feed photo viewer: не удалось удалить фото", error);
      alert(error?.message || "Не получилось удалить фото.");
    }
  }

  async function runLikeThroughWorkingFeedButton(postId) {
    const feedLikeButton = findFeedCardLikeButton(postId);

    if (!feedLikeButton || feedLikeButton.disabled) {
      return false;
    }

    feedLikeButton.click();

    await delay(420);

    return true;
  }

  async function runLikeThroughFallbackApi(postId) {
    const actions = window.KlevbyFeedActions || {};
    const api = getApi();

    if (typeof actions.toggleLikeFromCard === "function") {
      return actions.toggleLikeFromCard(postId);
    }

    if (typeof window.toggleFeedLike === "function") {
      return window.toggleFeedLike(postId);
    }

    if (typeof api.toggleLike === "function") {
      return api.toggleLike(postId);
    }

    if (typeof window.klevbyToggleFeedLike === "function") {
      return window.klevbyToggleFeedLike(postId);
    }

    throw new Error("Лайки ещё не подключены.");
  }

  async function toggleLikeFromViewer(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId || klevbyFeedViewerLikePending) return;

    const likeButton = document.getElementById("klevbyFeedViewerLikeBtn");
    const currentItem = getCachedItem(cleanId);
    const previousCount = getViewerButtonLikeCount(likeButton, currentItem);
    const previousLiked = getViewerButtonLiked(likeButton, currentItem);
    const nextLiked = !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

    klevbyFeedViewerLikePending = true;

    pulseButton(likeButton, 140);
    setViewerLikeButtonState(likeButton, nextCount, nextLiked, true);

    try {
      const result = await runLikeThroughFallbackApi(cleanId);

      if (result && typeof result === "object") {
        const resultCount = Number(result.likesCount ?? result.likes_count);
        const resultLiked = result.liked ?? result.viewerLiked ?? result.likedByViewer;

        if (Number.isFinite(resultCount) || typeof resultLiked === "boolean") {
          setViewerLikeButtonState(
            likeButton,
            Number.isFinite(resultCount) ? resultCount : nextCount,
            typeof resultLiked === "boolean" ? resultLiked : nextLiked,
            false
          );
        }
      }

      renderFeedSoon(180);
      await delay(260);
      const freshItemAfterToggle = getCachedItem(cleanId);
      syncViewerLikeButtonFromFeed(cleanId, freshItemAfterToggle || null);

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (error) {
      setViewerLikeButtonState(likeButton, previousCount, previousLiked, false);
      console.debug("Klevby feed photo viewer: лайк синхронизируется в фоне", error);
    } finally {
      klevbyFeedViewerLikePending = false;

      const viewer = document.getElementById("klevbyFeedPhotoViewer");

      if (viewer && !viewer.classList.contains("hidden")) {
        const freshItemAfterToggle = getCachedItem(cleanId);
        syncViewerLikeButtonFromFeed(cleanId, freshItemAfterToggle || null);
      }
    }
  }

  function openFeedCommentModal(postId) {
    const commentsModal = getCommentsModal();

    if (typeof commentsModal.openFeedCommentModal === "function") {
      commentsModal.openFeedCommentModal(postId);
      return;
    }

    if (typeof window.openFeedCommentModal === "function") {
      window.openFeedCommentModal(postId);
      return;
    }

    alert("Комментарии ещё загружаются. Обнови страницу и попробуй ещё раз.");
  }

  function openFeedPhotoViewer(item) {
    if (!item) return;

    const viewer = ensurePhotoViewer();
    const image = document.getElementById("klevbyFeedPhotoViewerImage");
    const title = document.getElementById("klevbyFeedPhotoViewerTitle");
    const meta = document.getElementById("klevbyFeedPhotoViewerMeta");
    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");
    const likeButton = document.getElementById("klevbyFeedViewerLikeBtn");
    const commentButton = document.getElementById("klevbyFeedViewerCommentBtn");

    const imageUrl = item.image || item.imageUrl || "";
    const titleText = item.title || item.caption || "Фото с рыбалки";
    const dateText = formatDate(item.createdAt);
    const cityText = item.authorCity ? `📍 ${item.authorCity}` : "";
    const likesCount = Math.max(0, Number(item.likesCount || item.likes_count || 0) || 0);
    const commentsCount = Math.max(0, Number(item.commentsCount || item.comments_count || 0) || 0);
    const viewerLiked = getBooleanLikeStateFromItem(item);
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

      deleteButton.classList.toggle("hidden", !canDelete);
      deleteButton.onclick = () => {
        pulseButton(deleteButton);
        deleteFeedItem(item);
      };
    }

    if (likeButton) {
      const isSupabase = item.source === "supabase";

      likeButton.classList.toggle("hidden", !isSupabase);
      setViewerLikeButtonState(likeButton, likesCount, viewerLiked, false);
      likeButton.onclick = () => toggleLikeFromViewer(item.id);
    }

    if (commentButton) {
      const isSupabase = item.source === "supabase";

      commentButton.classList.toggle("hidden", !isSupabase);
      commentButton.textContent = commentsCount ? `💬 ${commentsCount}` : "💬 Комментарии";
      commentButton.onclick = () => {
        pulseButton(commentButton);
        openFeedCommentModal(item.id);
      };
    }

    viewer.classList.remove("hidden");
    setModalBodyLock();

    const api = getApi();

    if (item.source === "supabase") {
      if (typeof api.registerView === "function") {
        api.registerView(item.id).then((added) => {
          if (added) {
            renderFeedSoon(550);
          }
        });
      } else if (typeof window.klevbyRegisterFeedView === "function") {
        window.klevbyRegisterFeedView(item.id).then((added) => {
          if (added) {
            renderFeedSoon(550);
          }
        });
      }
    }

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
