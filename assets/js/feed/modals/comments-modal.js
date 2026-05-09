(function () {
  "use strict";

  function getCore() {
    return window.KlevbyFeedModalCore || {};
  }

  function getStyles() {
    return window.KlevbyFeedModalStyles || {};
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

  function getState() {
    const core = getCore();

    if (typeof core.getState === "function") {
      return core.getState();
    }

    return window.KlevbyFeedState || {};
  }

  function debugLog(label, payload) {
    if (!window.KLEVB_DEBUG_FEED) return;

    try {
      console.debug(label, payload || {});
    } catch (_) {}
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

  function renderFeedSoon(delay = 120) {
    const core = getCore();

    if (typeof core.renderFeedSoon === "function") {
      core.renderFeedSoon(delay);
      return;
    }

    setTimeout(() => {
      const renderer = window.KlevbyFeedRender || {};

      if (typeof renderer.renderProfileFeed === "function") {
        renderer.renderProfileFeed();
        return;
      }

      if (typeof window.renderProfileFeed === "function") {
        window.renderProfileFeed();
      }
    }, Math.max(0, Number(delay || 0)));
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

  function setMessage(text = "", isError = false) {
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!message) return;

    message.textContent = text;
    message.classList.toggle("error-line", Boolean(isError));
  }

  function getCommentModalParts() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const textarea = document.getElementById("klevbyFeedCommentText");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const list = document.getElementById("klevbyFeedCommentsList");
    const subtitle = document.getElementById("klevbyFeedCommentSubtitle");
    const submitButton = document.getElementById("klevbyFeedCommentSubmitBtn");

    return {
      modal,
      textarea,
      message,
      list,
      subtitle,
      submitButton
    };
  }

  function setSubmitPending(pending) {
    const { submitButton, textarea } = getCommentModalParts();

    if (submitButton) {
      submitButton.disabled = Boolean(pending);
      submitButton.setAttribute("aria-busy", pending ? "true" : "false");
      submitButton.textContent = pending ? "Отправляем..." : "Отправить";
    }

    if (textarea) {
      textarea.disabled = Boolean(pending);
    }
  }

  async function runLoadComments(postId) {
    const cleanId = String(postId || "").trim();
    const api = getApi();

    if (typeof api.loadComments === "function") {
      return api.loadComments(cleanId);
    }

    if (typeof window.klevbyLoadFeedComments === "function") {
      return window.klevbyLoadFeedComments(cleanId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.loadComments === "function"
    ) {
      return window.klevbyFeedSupabase.loadComments(cleanId);
    }

    return {
      ok: false,
      comments: [],
      error: new Error("Загрузка комментариев ещё не подключена.")
    };
  }

  async function runAddComment(postId, text) {
    const cleanId = String(postId || "").trim();
    const cleanText = String(text || "").trim();
    const api = getApi();

    if (typeof api.addComment === "function") {
      return api.addComment(cleanId, cleanText);
    }

    if (typeof window.klevbyAddFeedComment === "function") {
      return window.klevbyAddFeedComment(cleanId, cleanText);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.addComment === "function"
    ) {
      return window.klevbyFeedSupabase.addComment(cleanId, cleanText);
    }

    throw new Error("Комментарии ещё не подключены в feed-supabase.js.");
  }

  async function runDeleteComment(commentId) {
    const cleanId = String(commentId || "").trim();
    const api = getApi();

    if (typeof api.deleteComment === "function") {
      return api.deleteComment(cleanId);
    }

    if (typeof window.klevbyDeleteFeedComment === "function") {
      return window.klevbyDeleteFeedComment(cleanId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.deleteComment === "function"
    ) {
      return window.klevbyFeedSupabase.deleteComment(cleanId);
    }

    throw new Error("Удаление комментариев ещё не подключено.");
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
              ? `<button class="klevby-feed-comment-delete" type="button" data-feed-comment-delete="${commentId}">Удалить</button>`
              : ""
          }
        </div>

        <p class="klevby-feed-comment-text">${escapeHtml(text)}</p>
      </div>
    `;
  }

  function bindCommentModalEvents(modal) {
    if (!modal || modal.dataset.commentEventsBound === "1") return;

    modal.dataset.commentEventsBound = "1";

    modal.addEventListener("click", (event) => {
      const closeTarget = event.target?.closest?.("[data-feed-comment-close]");
      const submitTarget = event.target?.closest?.("[data-feed-comment-submit]");
      const deleteTarget = event.target?.closest?.("[data-feed-comment-delete]");

      if (closeTarget) {
        event.preventDefault();
        closeFeedCommentModal();
        return;
      }

      if (submitTarget) {
        event.preventDefault();
        submitFeedComment();
        return;
      }

      if (deleteTarget) {
        event.preventDefault();
        deleteFeedComment(deleteTarget.dataset.feedCommentDelete || "");
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
      <div class="klevby-feed-comment-backdrop" data-feed-comment-close="1"></div>

      <div class="klevby-feed-comment-sheet">
        <button
          class="klevby-feed-comment-close"
          type="button"
          data-feed-comment-close="1"
          aria-label="Закрыть комментарии"
        >×</button>

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
          <button
            id="klevbyFeedCommentSubmitBtn"
            class="small-btn green"
            type="button"
            data-feed-comment-submit="1"
          >Отправить</button>

          <button
            class="small-btn gray"
            type="button"
            data-feed-comment-close="1"
          >Закрыть</button>
        </div>

        <div id="klevbyFeedCommentMessage" class="klevby-feed-comment-message"></div>
      </div>
    `;

    document.body.appendChild(modal);

    bindPressFeedback(modal);
    bindCommentModalEvents(modal);

    return modal;
  }

  async function loadCommentsIntoModal(postId) {
    const cleanId = String(postId || "").trim();
    const { list } = getCommentModalParts();

    if (!list) return;

    list.innerHTML = `<div class="klevby-feed-comments-empty">Загружаем комментарии...</div>`;

    if (!cleanId) {
      list.innerHTML = `<div class="klevby-feed-comments-empty">Фото не найдено.</div>`;
      return;
    }

    try {
      const result = await runLoadComments(cleanId);

      if (!result || !result.ok) {
        const errorMessage = result?.error?.message || "Не удалось загрузить комментарии.";
        list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(errorMessage)}</div>`;
        return;
      }

      const comments = Array.isArray(result.comments) ? result.comments : [];

      if (!comments.length) {
        list.innerHTML = `<div class="klevby-feed-comments-empty">Комментариев пока нет. Напиши первый.</div>`;
      } else {
        list.innerHTML = comments.map(commentHtml).join("");
      }

      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });

      setMessage("", false);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарии не загрузились", error);
      list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(error?.message || "Не удалось загрузить комментарии.")}</div>`;
    }
  }

  function openFeedCommentModal(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) {
      alert("Фото не найдено. Обнови страницу и попробуй ещё раз.");
      return;
    }

    const item = getCachedItem(cleanId);

    if (item && item.source && item.source !== "supabase") {
      alert("Это фото ещё локальное. Комментарии работают для фото из общей ленты.");
      return;
    }

    const modal = ensureCommentModal();
    const { textarea, subtitle } = getCommentModalParts();

    modal.dataset.postId = cleanId;

    if (textarea) {
      textarea.value = "";
      textarea.disabled = false;
    }

    if (subtitle) {
      subtitle.textContent = item
        ? `${item.authorName || "Рыбак"} добавил фото. Ниже комментарии и поле для твоего отзыва.`
        : "Комментарии к фото из общей ленты Klevby.";
    }

    setMessage("", false);
    setSubmitPending(false);

    modal.classList.remove("hidden");
    setModalBodyLock();

    loadCommentsIntoModal(cleanId);

    setTimeout(() => {
      try {
        textarea?.focus({ preventScroll: true });
      } catch (_) {
        textarea?.focus();
      }
    }, 220);
  }

  function closeFeedCommentModal() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      modal.classList.add("hidden");
      modal.dataset.postId = "";
    }

    setSubmitPending(false);
    releaseModalBodyLockIfPossible();
  }

  async function submitFeedComment() {
    const { modal, textarea } = getCommentModalParts();

    debugLog("[feed comments] submit:start", {
      hasModal: Boolean(modal),
      hasTextarea: Boolean(textarea),
      postId: modal?.dataset?.postId || ""
    });

    if (!modal || !textarea) {
      console.warn("Klevby feed comments modal: submit skipped, modal parts not found");
      return;
    }

    const postId = String(modal.dataset.postId || "").trim();
    const text = String(textarea.value || "").trim();

    if (!postId) {
      setMessage("Фото не найдено. Закрой окно и попробуй ещё раз.", true);
      return;
    }

    if (!text) {
      setMessage("Напиши комментарий перед отправкой.", true);
      textarea.focus();
      return;
    }

    if (text.length > 700) {
      setMessage("Комментарий слишком длинный. Сделай короче.", true);
      textarea.focus();
      return;
    }

    setSubmitPending(true);
    setMessage("Отправляем комментарий...", false);

    try {
      await runAddComment(postId, text);

      textarea.value = "";
      setMessage("✅ Комментарий отправлен.", false);

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      await loadCommentsIntoModal(postId);

      dispatchFeedUpdated({
        action: "comment_added_local",
        postId
      });

      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не отправился", error);
      setMessage(error?.message || "Не получилось отправить комментарий.", true);
    } finally {
      setSubmitPending(false);
    }
  }

  async function deleteFeedComment(commentId) {
    const cleanCommentId = String(commentId || "").trim();
    const { modal } = getCommentModalParts();
    const postId = String(modal?.dataset?.postId || "").trim();

    if (!cleanCommentId) return;

    if (!confirm("Удалить комментарий?")) {
      return;
    }

    setMessage("Удаляем комментарий...", false);

    try {
      await runDeleteComment(cleanCommentId);

      setMessage("Комментарий удалён.", false);

      if (postId) {
        await loadCommentsIntoModal(postId);
      }

      dispatchFeedUpdated({
        action: "comment_deleted_local",
        postId,
        commentId: cleanCommentId
      });

      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не удалился", error);
      setMessage(error?.message || "Не получилось удалить комментарий.", true);
    }
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
    runDeleteComment
  };

  window.KlevbyFeedCommentsModal = commentsModal;

  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
})();
