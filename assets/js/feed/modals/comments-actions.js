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

  async function loadCommentsIntoModal(postId) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const message = document.getElementById("klevbyFeedCommentMessage");
    const cleanId = String(postId || "").trim();

    if (!list) return;

    if (!cleanId) {
      list.innerHTML = `<div class="klevby-feed-comments-empty">Фото не найдено.</div>`;
      return;
    }

    list.innerHTML = `<div class="klevby-feed-comments-empty">Загружаем комментарии...</div>`;

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

      if (message) {
        message.textContent = "";
        message.classList.remove("error-line");
      }
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарии не загрузились", error);

      list.innerHTML = `<div class="klevby-feed-comments-empty">${escapeHtml(error?.message || "Не удалось загрузить комментарии.")}</div>`;
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
    const submitButton = modal?.querySelector?.("[data-feed-comments-submit]");

    modal.dataset.postId = cleanId;

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

    loadCommentsIntoModal(cleanId);

    setTimeout(() => {
      if (textarea) {
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
    }

    setSubmitBusy(false);
    releaseModalBodyLockIfPossible();
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
      await runAddComment(postId, text);

      textarea.value = "";

      if (message) {
        message.textContent = "✅ Комментарий отправлен.";
        message.classList.remove("error-line");
      }

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      dispatchFeedUpdated({
        action: "comment_added_local",
        postId
      });

      await loadCommentsIntoModal(postId);
      renderFeedSoon(80);
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
        dispatchFeedUpdated({
          action: "comment_deleted_local",
          postId,
          commentId: cleanCommentId
        });

        await loadCommentsIntoModal(postId);
      }

      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не удалился", error);

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
        closeFeedCommentModal();
      }
    });
  });

  const commentsModal = {
    ensureCommentModal,
    openFeedCommentModal,
    closeFeedCommentModal,
    loadCommentsIntoModal,
    submitFeedComment,
    deleteFeedComment,
    runLoadComments,
    runAddComment
  };

  window.KlevbyFeedCommentsModal = commentsModal;

  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
})();
