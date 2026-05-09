(function () {
  "use strict";

  let klevbyFeedViewerLikePending = false;

  function getCore() {
    return window.KlevbyFeedModalCore || {};
  }

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

  function getStyles() {
    return window.KlevbyFeedModalStyles || {};
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
    } catch (error) {
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
      } catch (error) {
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
    const core = getCore();

    if (typeof core.getCachedItem === "function") {
      return core.getCachedItem(postId);
    }

    const state = getState();
    const cleanId = String(postId || "");

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

  function renderFeedSoon(delay = 180) {
    const core = getCore();

    if (typeof core.renderFeedSoon === "function") {
      core.renderFeedSoon(delay);
      return;
    }

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

  function getBooleanLikeStateFromItem(item) {
    const core = getCore();

    if (typeof core.getBooleanLikeStateFromItem === "function") {
      return Boolean(core.getBooleanLikeStateFromItem(item));
    }

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
    const core = getCore();

    if (typeof core.pulseButton === "function") {
      core.pulseButton(button, duration);
      return;
    }

    if (!button) return;

    button.classList.add("is-pressed");

    window.setTimeout(() => {
      button.classList.remove("is-pressed");
    }, duration);
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

    root.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");

      if (!button || button.disabled) return;

      pulseButton(button, 130);
    });
  }

  function ensurePhotoViewer() {
    ensureModalStyles();

    let viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewer) {
      bindPressFeedback(viewer);
      return viewer;
    }

    viewer = document.createElement("div");
    viewer.id = "klevbyFeedPhotoViewer";
    viewer.className = "klevby-feed-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");

    viewer.innerHTML = `
      <div class="klevby-feed-viewer-backdrop" onclick="closeFeedPhotoViewer()"></div>
      <div class="klevby-feed-viewer-sheet">
        <button class="klevby-feed-viewer-close" type="button" onclick="closeFeedPhotoViewer()" aria-label="Закрыть фото">×</button>
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

    return viewer;
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

    pulseButton(likeButton, 160);
    setViewerLikeButtonState(likeButton, nextCount, nextLiked, true);

    try {
      const actions = window.KlevbyFeedActions || {};

      if (typeof actions.toggleLikeFromCard === "function") {
        await actions.toggleLikeFromCard(cleanId);
      } else if (typeof window.toggleFeedLike === "function") {
        await window.toggleFeedLike(cleanId);
      } else if (typeof window.klevbyToggleFeedLike === "function") {
        await window.klevbyToggleFeedLike(cleanId);
        renderFeedSoon(120);
      } else {
        throw new Error("Лайки ещё не подключены.");
      }

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (error) {
      setViewerLikeButtonState(likeButton, previousCount, previousLiked, false);
      console.warn("Klevby feed photo viewer: лайк viewer не сработал", error);
      alert(error?.message || "Не получилось поставить лайк.");
    } finally {
      klevbyFeedViewerLikePending = false;

      const updatedItem = getCachedItem(cleanId);
      const finalItem = updatedItem || currentItem;
      const finalCount = getViewerButtonLikeCount(likeButton, finalItem);
      const finalLiked = getViewerButtonLiked(likeButton, finalItem);

      setViewerLikeButtonState(likeButton, finalCount, finalLiked, false);

      setTimeout(() => {
        const viewer = document.getElementById("klevbyFeedPhotoViewer");
        const newestItem = getCachedItem(cleanId);

        if (viewer && !viewer.classList.contains("hidden") && newestItem) {
          openFeedPhotoViewer(newestItem);
        }
      }, 260);
    }
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

    if (image) image.src = imageUrl;
    if (title) title.textContent = titleText;

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

        if (typeof window.openFeedCommentModal === "function") {
          window.openFeedCommentModal(item.id);
          return;
        }

        const commentsModal = window.KlevbyFeedCommentsModal || {};

        if (typeof commentsModal.openFeedCommentModal === "function") {
          commentsModal.openFeedCommentModal(item.id);
        }
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
    const cleanId = String(photoId || "");
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

  const photoViewer = {
    ensurePhotoViewer,
    openProfilePhotoFeedItem,
    openFeedPhotoViewer,
    closeFeedPhotoViewer,
    deleteFeedItem,
    toggleLikeFromViewer,
    setViewerLikeButtonState
  };

  window.KlevbyFeedPhotoViewer = photoViewer;

  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.closeFeedPhotoViewer = closeFeedPhotoViewer;
})();
