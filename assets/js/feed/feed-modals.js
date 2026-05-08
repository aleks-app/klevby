(function () {
  let klevbyFeedViewerLikePending = false;

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

  function canManageComment(comment) {
    if (!comment) return false;

    const user = getCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      isAdmin() ||
      (userId && comment.user_id && String(userId) === String(comment.user_id))
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

  function ensureModalStyles() {
    const oldStyle = document.getElementById("klevbyFeedModalStyles");

    if (oldStyle) {
      oldStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "klevbyFeedModalStyles";
    style.dataset.version = "20260508-viewer-button-feedback-1";

    style.textContent = `
      .klevby-feed-viewer.hidden,
      .klevby-feed-comment-modal.hidden {
        display: none !important;
      }

      .klevby-feed-viewer,
      .klevby-feed-comment-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding:
          max(18px, env(safe-area-inset-top))
          14px
          max(18px, env(safe-area-inset-bottom));
      }

      .klevby-feed-comment-modal {
        z-index: 100000;
      }

      .klevby-feed-viewer-backdrop,
      .klevby-feed-comment-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .klevby-feed-viewer-sheet,
      .klevby-feed-comment-sheet {
        position: relative;
        z-index: 2;
        width: min(100%, 760px);
        max-height: 88dvh;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 28px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(244,178,74,0.12), transparent 42%),
          rgba(10, 14, 12, 0.96);
        box-shadow:
          0 28px 90px rgba(0,0,0,0.72),
          inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .klevby-feed-viewer-close,
      .klevby-feed-comment-close {
        appearance: none;
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 3;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(244,178,74,0.18);
        border-radius: 16px;
        background: rgba(0,0,0,0.45);
        color: #fff8ea;
        font-size: 28px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .klevby-feed-viewer-image {
        width: 100%;
        max-height: 66dvh;
        display: block;
        object-fit: contain;
        background: #050807;
      }

      .klevby-feed-viewer-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px;
        color: #fff8ea;
      }

      .klevby-feed-viewer-info strong {
        display: block;
        font-size: 15px;
        font-weight: 900;
        line-height: 1.25;
      }

      .klevby-feed-viewer-info span {
        display: block;
        margin-top: 4px;
        color: rgba(255,248,234,0.55);
        font-size: 12px;
        font-weight: 700;
      }

      .klevby-feed-viewer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .klevby-feed-viewer-actions button {
        appearance: none;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 15px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        transform: translateY(0) scale(1);
        transition:
          transform 0.08s ease,
          filter 0.12s ease,
          box-shadow 0.12s ease,
          background 0.12s ease,
          opacity 0.12s ease;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .klevby-feed-viewer-close,
      .klevby-feed-comment-close,
      .klevby-feed-comment-delete,
      .klevby-feed-comment-actions .small-btn {
        transform: translateY(0) scale(1);
        transition:
          transform 0.08s ease,
          filter 0.12s ease,
          box-shadow 0.12s ease,
          background 0.12s ease,
          opacity 0.12s ease;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .klevby-feed-viewer-actions button:hover,
      .klevby-feed-viewer-close:hover,
      .klevby-feed-comment-close:hover,
      .klevby-feed-comment-delete:hover,
      .klevby-feed-comment-actions .small-btn:hover {
        filter: brightness(1.08);
      }

      .klevby-feed-viewer-actions button:active,
      .klevby-feed-viewer-actions button.is-pressed,
      .klevby-feed-viewer-close:active,
      .klevby-feed-viewer-close.is-pressed,
      .klevby-feed-comment-close:active,
      .klevby-feed-comment-close.is-pressed,
      .klevby-feed-comment-delete:active,
      .klevby-feed-comment-delete.is-pressed,
      .klevby-feed-comment-actions .small-btn:active,
      .klevby-feed-comment-actions .small-btn.is-pressed {
        transform: translateY(2px) scale(0.97);
        filter: brightness(1.16);
        box-shadow:
          inset 0 2px 8px rgba(0,0,0,0.35),
          0 0 0 1px rgba(255,255,255,0.08);
      }

      .klevby-feed-viewer-actions button.is-pending,
      .klevby-feed-viewer-actions button:disabled {
        opacity: 0.72;
        cursor: wait;
      }

      #klevbyFeedViewerLikeBtn,
      #klevbyFeedViewerCommentBtn {
        border: 1px solid rgba(244,178,74,0.20);
        background: rgba(244,178,74,0.18);
        color: #fff8ea !important;
      }

      #klevbyFeedViewerLikeBtn.is-liked,
      #klevbyFeedViewerLikeBtn.liked {
        border-color: rgba(255,190,76,0.48);
        background:
          linear-gradient(180deg, rgba(255,190,76,0.34), rgba(244,178,74,0.18));
        color: #fff8ea !important;
      }

      #klevbyFeedViewerDeleteBtn {
        border: 1px solid rgba(228,88,88,0.24);
        background: rgba(228,88,88,0.92);
      }

      #klevbyFeedViewerDeleteBtn.hidden,
      #klevbyFeedViewerLikeBtn.hidden,
      #klevbyFeedViewerCommentBtn.hidden {
        display: none !important;
      }

      .klevby-feed-comment-sheet {
        width: min(100%, 620px);
        max-height: min(82dvh, 720px);
        padding: 22px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .klevby-feed-comment-sheet h3 {
        margin: 0 52px 8px 0;
        color: #fff8ea;
        font-size: 22px;
        line-height: 1.18;
        font-weight: 900;
      }

      .klevby-feed-comment-sheet p {
        margin: 0 0 14px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comments-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 260px;
        overflow-y: auto;
        margin: 0 0 14px;
        padding: 4px 2px 2px;
        -webkit-overflow-scrolling: touch;
      }

      .klevby-feed-comment-item {
        padding: 12px;
        border-radius: 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(244,178,74,0.11);
      }

      .klevby-feed-comment-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 7px;
      }

      .klevby-feed-comment-author {
        display: block;
        color: #fff8ea;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 900;
      }

      .klevby-feed-comment-date {
        display: block;
        margin-top: 2px;
        color: rgba(255,248,234,0.45);
        font-size: 11px;
        line-height: 1.2;
        font-weight: 700;
      }

      .klevby-feed-comment-delete {
        appearance: none;
        border: 1px solid rgba(228,88,88,0.22);
        background: rgba(228,88,88,0.12);
        color: #ffd2d2;
        border-radius: 999px;
        min-height: 28px;
        padding: 0 10px;
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        cursor: pointer;
        flex: 0 0 auto;
      }

      .klevby-feed-comment-text {
        margin: 0;
        color: rgba(255,248,234,0.82);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 650;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .klevby-feed-comments-empty {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.045);
        border: 1px dashed rgba(244,178,74,0.16);
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.5;
        font-weight: 700;
      }

      .klevby-feed-comment-textarea {
        width: 100%;
        min-height: 104px;
        resize: vertical;
        padding: 14px;
        border-radius: 20px;
        border: 1px solid rgba(244,178,74,0.16);
        outline: none;
        background: rgba(255,255,255,0.07);
        color: #fff8ea;
        font: inherit;
        font-size: 15px;
        line-height: 1.5;
        font-weight: 650;
      }

      .klevby-feed-comment-textarea::placeholder {
        color: rgba(255,248,234,0.42);
      }

      .klevby-feed-comment-actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }

      .klevby-feed-comment-actions .small-btn {
        flex: 1;
      }

      .klevby-feed-comment-message {
        min-height: 22px;
        margin-top: 12px;
        color: rgba(255,248,234,0.62);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
      }

      .klevby-feed-comment-message.error-line {
        color: #ffd2d2;
        background: transparent;
        border: 0;
        padding: 0;
        box-shadow: none;
      }

      @media (max-width: 760px) {
        .klevby-feed-comment-modal {
          align-items: center !important;
          justify-content: center !important;
          padding:
            max(18px, env(safe-area-inset-top))
            12px
            max(18px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-feed-comment-sheet {
          border-radius: 24px;
          padding: 20px;
          max-height: 78dvh;
        }

        .klevby-feed-comments-list {
          max-height: 230px;
        }

        .klevby-feed-comment-textarea {
          min-height: 96px;
        }

        .klevby-feed-viewer {
          align-items: center;
          padding: 12px;
        }

        .klevby-feed-viewer-sheet {
          border-radius: 24px;
          max-height: 86dvh;
        }

        .klevby-feed-viewer-image {
          max-height: 58dvh;
        }

        .klevby-feed-viewer-info {
          align-items: flex-start;
          flex-direction: column;
        }

        .klevby-feed-viewer-actions {
          width: 100%;
          justify-content: stretch;
        }

        .klevby-feed-viewer-actions button {
          flex: 1;
        }
      }

      @media (max-width: 380px) {
        .klevby-feed-comments-list {
          max-height: 200px;
        }
      }
    `;

    document.body.appendChild(style);
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
      console.error("Klevby feed modal: не удалось удалить фото", error);
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
      console.warn("Klevby feed modal: лайк viewer не сработал", error);
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

  function ensureCommentModal() {
    ensureModalStyles();

    let modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      bindPressFeedback(modal);
      return modal;
    }

    modal = document.createElement("div");
    modal.id = "klevbyFeedCommentModal";
    modal.className = "klevby-feed-comment-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="klevby-feed-comment-backdrop" onclick="closeFeedCommentModal()"></div>
      <div class="klevby-feed-comment-sheet">
        <button class="klevby-feed-comment-close" type="button" onclick="closeFeedCommentModal()" aria-label="Закрыть комментарии">×</button>

        <h3>Комментарии</h3>
        <p id="klevbyFeedCommentSubtitle">Смотри отзывы рыбаков и добавляй свой.</p>

        <div id="klevbyFeedCommentsList" class="klevby-feed-comments-list">
          <div class="klevby-feed-comments-empty">Загружаем комментарии...</div>
        </div>

        <textarea
          id="klevbyFeedCommentText"
          class="klevby-feed-comment-textarea"
          maxlength="700"
          placeholder="Напиши свой комментарий..."
        ></textarea>

        <div class="klevby-feed-comment-actions">
          <button class="small-btn green" type="button" onclick="submitFeedComment()">Отправить</button>
          <button class="small-btn gray" type="button" onclick="closeFeedCommentModal()">Закрыть</button>
        </div>

        <div id="klevbyFeedCommentMessage" class="klevby-feed-comment-message"></div>
      </div>
    `;

    document.body.appendChild(modal);
    bindPressFeedback(modal);

    return modal;
  }

  function commentHtml(comment) {
    const authorName = comment?.author_name || "Рыбак";
    const city = comment?.author_city || "";
    const text = comment?.text || "";
    const date = formatDate(comment?.created_at);
    const canDelete = canManageComment(comment);

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
              ? `<button class="klevby-feed-comment-delete" type="button" onclick="deleteFeedComment('${escapeAttr(comment.id || "")}')">Удалить</button>`
              : ""
          }
        </div>

        <p class="klevby-feed-comment-text">${escapeHtml(text)}</p>
      </div>
    `;
  }

  async function runLoadComments(postId) {
    const api = getApi();

    if (typeof api.loadComments === "function") {
      return api.loadComments(postId);
    }

    if (typeof window.klevbyLoadFeedComments === "function") {
      return window.klevbyLoadFeedComments(postId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.loadComments === "function"
    ) {
      return window.klevbyFeedSupabase.loadComments(postId);
    }

    return {
      ok: false,
      comments: [],
      error: new Error("Загрузка комментариев ещё не подключена.")
    };
  }

  async function loadCommentsIntoModal(postId) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!list) return;

    list.innerHTML = `<div class="klevby-feed-comments-empty">Загружаем комментарии...</div>`;

    try {
      const result = await runLoadComments(postId);

      if (!result || !result.ok) {
        const errorMessage = result?.error?.message || "Не удалось загрузить комментарии.";

        list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(errorMessage)}</div>`;
        return;
      }

      const comments = Array.isArray(result.comments) ? result.comments : [];

      if (!comments.length) {
        list.innerHTML = `<div class="klevby-feed-comments-empty">Комментариев пока нет. Напиши первый.</div>`;
        return;
      }

      list.innerHTML = comments.map(commentHtml).join("");

      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });

      if (message) {
        message.textContent = "";
        message.classList.remove("error-line");
      }
    } catch (error) {
      console.warn("Klevby feed modal: комментарии не загрузились", error);
      list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(error?.message || "Не удалось загрузить комментарии.")}</div>`;
    }
  }

  function openFeedCommentModal(postId) {
    const cleanId = String(postId || "");
    const item = getCachedItem(cleanId);

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

    modal.dataset.postId = cleanId;

    if (textarea) textarea.value = "";

    if (message) {
      message.textContent = "";
      message.classList.remove("error-line");
    }

    if (subtitle) {
      subtitle.textContent = `${item.authorName || "Рыбак"} добавил фото. Ниже комментарии и поле для твоего отзыва.`;
    }

    modal.classList.remove("hidden");
    setModalBodyLock();

    loadCommentsIntoModal(cleanId);

    setTimeout(() => {
      if (textarea) textarea.focus({ preventScroll: true });
    }, 220);
  }

  function closeFeedCommentModal() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      modal.classList.add("hidden");
      modal.dataset.postId = "";
    }

    releaseModalBodyLockIfPossible();
  }

  async function runAddComment(postId, text) {
    const api = getApi();

    if (typeof api.addComment === "function") {
      return api.addComment(postId, text);
    }

    if (typeof window.klevbyAddFeedComment === "function") {
      return window.klevbyAddFeedComment(postId, text);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.addComment === "function"
    ) {
      return window.klevbyFeedSupabase.addComment(postId, text);
    }

    throw new Error("Комментарии ещё не подключены в feed-supabase.js.");
  }

  async function submitFeedComment() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!modal || !textarea) return;

    const postId = String(modal.dataset.postId || "");
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

    try {
      await runAddComment(postId, text);

      textarea.value = "";

      if (message) {
        message.textContent = "✅ Комментарий отправлен.";
        message.classList.remove("error-line");
      }

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      await loadCommentsIntoModal(postId);
      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed modal: комментарий не отправился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось отправить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  async function deleteFeedComment(commentId) {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const postId = String(modal?.dataset?.postId || "");
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) return;

    if (!confirm("Удалить комментарий?")) {
      return;
    }

    const api = getApi();

    try {
      if (typeof api.deleteComment === "function") {
        await api.deleteComment(cleanCommentId);
      } else if (typeof window.klevbyDeleteFeedComment === "function") {
        await window.klevbyDeleteFeedComment(cleanCommentId);
      } else if (
        window.klevbyFeedSupabase &&
        typeof window.klevbyFeedSupabase.deleteComment === "function"
      ) {
        await window.klevbyFeedSupabase.deleteComment(cleanCommentId);
      } else {
        throw new Error("Удаление комментариев ещё не подключено.");
      }

      if (message) {
        message.textContent = "Комментарий удалён.";
        message.classList.remove("error-line");
      }

      if (postId) {
        await loadCommentsIntoModal(postId);
      }

      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed modal: комментарий не удалился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось удалить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureModalStyles();

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFeedPhotoViewer();
        closeFeedCommentModal();
      }
    });
  });

  const modals = {
    ensureModalStyles,
    ensurePhotoViewer,
    openProfilePhotoFeedItem,
    openFeedPhotoViewer,
    closeFeedPhotoViewer,
    ensureCommentModal,
    openFeedCommentModal,
    closeFeedCommentModal,
    loadCommentsIntoModal,
    submitFeedComment,
    deleteFeedComment,
    deleteFeedItem
  };

  window.KlevbyFeedModals = modals;

  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.closeFeedPhotoViewer = closeFeedPhotoViewer;
  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
})();
