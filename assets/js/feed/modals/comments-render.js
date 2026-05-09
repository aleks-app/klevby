(function () {
  "use strict";

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
  }

  function getCommentsCache() {
    return window.KlevbyFeedCommentsCache || window.KlevbyFeedCommentCache || {};
  }

  function getCommentsCounts() {
    return window.KlevbyFeedCommentsCounts || window.KlevbyFeedCommentCounts || {};
  }

  function escapeHtml(value) {
    const utils = getCommentsUtils();

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
    const utils = getCommentsUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(value);
    }

    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatDate(value) {
    const utils = getCommentsUtils();

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

  function canManageComment(comment) {
    const utils = getCommentsUtils();

    if (typeof utils.canManageComment === "function") {
      return Boolean(utils.canManageComment(comment));
    }

    return false;
  }

  function normalizeComments(comments) {
    const cache = getCommentsCache();

    if (typeof cache.normalizeComments === "function") {
      return cache.normalizeComments(comments);
    }

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

  function getCachedComments(postId) {
    const cache = getCommentsCache();

    if (typeof cache.getCachedComments === "function") {
      return cache.getCachedComments(postId);
    }

    return [];
  }

  function syncFeedCommentCount(postId, commentsCount) {
    const counts = getCommentsCounts();
    const cleanId = String(postId || "").trim();
    const safeCount = Math.max(0, Number(commentsCount || 0) || 0);

    if (!cleanId) return safeCount;

    if (typeof counts.syncFeedCommentCount === "function") {
      return counts.syncFeedCommentCount(cleanId, safeCount);
    }

    if (typeof window.klevbySyncFeedCommentCount === "function") {
      return window.klevbySyncFeedCommentCount(cleanId, safeCount);
    }

    return safeCount;
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

  const commentsRender = {
    escapeHtml,
    escapeAttr,
    formatDate,
    canManageComment,

    normalizeComments,

    getCommentsListPostId,
    hasVisibleComments,
    isCommentModalActiveForPost,
    setCommentMessage,

    renderCommentsPlaceholder,
    commentHtml,
    renderCommentsList,
    renderCachedCommentsIfPossible
  };

  window.KlevbyFeedCommentsRender = commentsRender;
  window.KlevbyFeedCommentRender = commentsRender;
})();
