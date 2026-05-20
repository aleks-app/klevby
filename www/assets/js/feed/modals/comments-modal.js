(function () {
  "use strict";

  const MODAL_VERSION = "20260509-comments-modal-real-1";

  function getActionsModule() {
    const actions =
      window.KlevbyFeedCommentsActions ||
      window.KlevbyFeedCommentActions ||
      null;

    if (actions && typeof actions === "object") {
      return actions;
    }

    return null;
  }

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
  }

  function getCommentsCache() {
    return window.KlevbyFeedCommentsCache || window.KlevbyFeedCommentCache || {};
  }

  function getCommentsRender() {
    return window.KlevbyFeedCommentsRender || window.KlevbyFeedCommentRender || {};
  }

  function getCommentsCounts() {
    return window.KlevbyFeedCommentsCounts || window.KlevbyFeedCommentCounts || {};
  }

  function callActions(methodName, args = [], fallback = undefined) {
    const actions = getActionsModule();

    if (actions && typeof actions[methodName] === "function") {
      return actions[methodName].apply(actions, args);
    }

    if (typeof fallback === "function") {
      return fallback();
    }

    return fallback;
  }

  function getCachedItem(postId) {
    const utils = getCommentsUtils();

    if (typeof utils.getCachedItem === "function") {
      return utils.getCachedItem(postId);
    }

    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    const cache = window.__klevbyFeedItemsCache || {};
    return cache[cleanId] || null;
  }

  function getCachedComments(postId) {
    const cache = getCommentsCache();

    if (typeof cache.getCachedComments === "function") {
      return cache.getCachedComments(postId);
    }

    return [];
  }

  function ensureModalStyles() {
    const utils = getCommentsUtils();

    if (typeof utils.ensureModalStyles === "function") {
      return utils.ensureModalStyles();
    }

    return null;
  }

  function setModalBodyLock() {
    const utils = getCommentsUtils();

    if (typeof utils.setModalBodyLock === "function") {
      utils.setModalBodyLock();
      return;
    }

    document.body.classList.add("post-modal-open");
  }

  function releaseModalBodyLockIfPossible() {
    const utils = getCommentsUtils();

    if (typeof utils.releaseModalBodyLockIfPossible === "function") {
      utils.releaseModalBodyLockIfPossible();
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
    const utils = getCommentsUtils();

    if (typeof utils.pulseButton === "function") {
      utils.pulseButton(button, duration);
      return;
    }

    if (!button) return;

    button.classList.add("is-pressed");

    window.setTimeout(() => {
      button.classList.remove("is-pressed");
    }, Math.max(60, Number(duration || 130)));
  }

  function bindPressFeedback(root) {
    const utils = getCommentsUtils();

    if (typeof utils.bindPressFeedback === "function") {
      utils.bindPressFeedback(root);
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

  function renderCommentsPlaceholder(list, text) {
    const render = getCommentsRender();

    if (typeof render.renderCommentsPlaceholder === "function") {
      render.renderCommentsPlaceholder(list, text);
      return;
    }

    if (!list) return;

    list.innerHTML = `<div class="klevby-feed-comments-empty">${String(text || "Комментариев пока нет.")}</div>`;
  }

  function renderCommentsList(list, postId, comments, options = {}) {
    const render = getCommentsRender();

    if (typeof render.renderCommentsList === "function") {
      return render.renderCommentsList(list, postId, comments, options);
    }

    return false;
  }

  function isCommentModalActiveForPost(postId, token = null) {
    const render = getCommentsRender();

    if (typeof render.isCommentModalActiveForPost === "function") {
      return Boolean(render.isCommentModalActiveForPost(postId, token));
    }

    const cleanId = String(postId || "").trim();
    const modal = document.getElementById("klevbyFeedCommentModal");

    if (!modal || modal.classList.contains("hidden")) return false;
    if (String(modal.dataset.postId || "").trim() !== cleanId) return false;

    if (token !== null && String(modal.dataset.commentsLoadToken || "") !== String(token)) {
      return false;
    }

    return true;
  }

  function scheduleCommentCountSync(delay = 80) {
    const counts = getCommentsCounts();

    if (typeof counts.scheduleCommentCountSync === "function") {
      counts.scheduleCommentCountSync(delay);
    }
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

  function loadCommentsIntoModal(postId, options = {}) {
    return callActions("loadCommentsIntoModal", [postId, options], Promise.resolve());
  }

  function submitFeedComment() {
    return callActions("submitFeedComment", [], Promise.resolve());
  }

  function deleteFeedComment(commentId) {
    return callActions("deleteFeedComment", [commentId], Promise.resolve());
  }

  function runLoadComments(postId) {
    return callActions("runLoadComments", [postId], Promise.resolve({
      ok: false,
      comments: [],
      error: new Error("Модуль загрузки комментариев ещё не готов.")
    }));
  }

  function runAddComment(postId, text) {
    return callActions("runAddComment", [postId, text], Promise.reject(
      new Error("Модуль отправки комментариев ещё не готов.")
    ));
  }

  function initCommentsModal() {
    ensureModalStyles();

    if (!window.__klevbyFeedCommentsModalKeydownBound) {
      window.__klevbyFeedCommentsModalKeydownBound = true;

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeFeedCommentModal();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentsModal);
  } else {
    setTimeout(initCommentsModal, 0);
  }

  const commentsModal = {
    version: MODAL_VERSION,

    ensureCommentModal,
    openFeedCommentModal,
    closeFeedCommentModal,
    loadCommentsIntoModal,
    submitFeedComment,
    deleteFeedComment,

    runLoadComments,
    runAddComment,

    setSubmitBusy
  };

  window.KlevbyFeedCommentsModal = commentsModal;
  window.KlevbyFeedCommentModal = commentsModal;

  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;

  console.log("Klevby feed comments modal loaded", {
    version: MODAL_VERSION,
    hasActionsModule: Boolean(getActionsModule())
  });
})();
