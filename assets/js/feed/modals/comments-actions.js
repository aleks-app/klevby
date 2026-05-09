(function () {
  "use strict";

  let commentsLoadSerial = 0;

  function getCommentsUtils() {
    return window.KlevbyFeedCommentsUtils || window.KlevbyFeedCommentUtils || {};
  }

  function getCommentsCounts() {
    return window.KlevbyFeedCommentsCounts || window.KlevbyFeedCommentCounts || {};
  }

  function getCommentsCache() {
    return window.KlevbyFeedCommentsCache || window.KlevbyFeedCommentCache || {};
  }

  function getCommentsRender() {
    return window.KlevbyFeedCommentsRender || window.KlevbyFeedCommentRender || {};
  }

  function getApi() {
    const utils = getCommentsUtils();

    if (typeof utils.getApi === "function") {
      return utils.getApi();
    }

    return window.KlevbyFeedApi || {};
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
    }
  }

  function withTimeout(promise, timeoutMs, errorMessage) {
    const utils = getCommentsUtils();

    if (typeof utils.withTimeout === "function") {
      return utils.withTimeout(promise, timeoutMs, errorMessage);
    }

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

  function getLoadTimeoutMs() {
    const utils = getCommentsUtils();
    return Number(utils.COMMENTS_LOAD_TIMEOUT_MS || 7000);
  }

  function getSendTimeoutMs() {
    const utils = getCommentsUtils();
    return Number(utils.COMMENTS_SEND_TIMEOUT_MS || 9000);
  }

  function scheduleCommentCountSync(delay = 80) {
    const counts = getCommentsCounts();

    if (typeof counts.scheduleCommentCountSync === "function") {
      counts.scheduleCommentCountSync(delay);
    }
  }

  function bindCommentCountSyncHooks() {
    const counts = getCommentsCounts();

    if (typeof counts.bindCommentCountSyncHooks === "function") {
      counts.bindCommentCountSyncHooks();
    }
  }

  function getCachedComments(postId) {
    const cache = getCommentsCache();

    if (typeof cache.getCachedComments === "function") {
      return cache.getCachedComments(postId);
    }

    return [];
  }

  function setCachedComments(postId, comments) {
    const cache = getCommentsCache();

    if (typeof cache.setCachedComments === "function") {
      return cache.setCachedComments(postId, comments);
    }

    return Array.isArray(comments) ? comments : [];
  }

  function appendCachedComment(postId, comment) {
    const cache = getCommentsCache();

    if (typeof cache.appendCachedComment === "function") {
      return cache.appendCachedComment(postId, comment);
    }

    return getCachedComments(postId);
  }

  function removeCachedComment(postId, commentId) {
    const cache = getCommentsCache();

    if (typeof cache.removeCachedComment === "function") {
      return cache.removeCachedComment(postId, commentId);
    }

    return getCachedComments(postId);
  }

  function normalizeCommentsResult(result) {
    const cache = getCommentsCache();

    if (typeof cache.normalizeCommentsResult === "function") {
      return cache.normalizeCommentsResult(result);
    }

    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.comments)) return result.comments;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.result?.comments)) return result.result.comments;

    return [];
  }

  function getCommentsListPostId(list) {
    const render = getCommentsRender();

    if (typeof render.getCommentsListPostId === "function") {
      return render.getCommentsListPostId(list);
    }

    return String(list?.dataset?.postId || "").trim();
  }

  function hasVisibleComments(list) {
    const render = getCommentsRender();

    if (typeof render.hasVisibleComments === "function") {
      return Boolean(render.hasVisibleComments(list));
    }

    return Boolean(list?.querySelector?.(".klevby-feed-comment-item"));
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

  function setCommentMessage(text = "", isError = false) {
    const render = getCommentsRender();

    if (typeof render.setCommentMessage === "function") {
      render.setCommentMessage(text, isError);
      return;
    }

    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!message) return;

    message.textContent = String(text || "");
    message.classList.toggle("error-line", Boolean(isError));
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

  function beginCommentsLoad(postId) {
    const cleanId = String(postId || "").trim();
    const modal = document.getElementById("klevbyFeedCommentModal");
    const token = `${Date.now()}-${commentsLoadSerial += 1}`;

    if (modal) {
      modal.dataset.postId = cleanId;
      modal.dataset.commentsLoadToken = token;
    }

    return token;
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
        getLoadTimeoutMs(),
        "Комментарии не загрузились: Supabase не ответил."
      );
    }

    if (typeof window.klevbyLoadFeedComments === "function") {
      return withTimeout(
        window.klevbyLoadFeedComments(cleanId),
        getLoadTimeoutMs(),
        "Комментарии не загрузились: функция загрузки не ответила."
      );
    }

    const api = getApi();

    if (typeof api.loadComments === "function") {
      return withTimeout(
        api.loadComments(cleanId),
        getLoadTimeoutMs(),
        "Комментарии не загрузились: API ленты не ответил."
      );
    }

    return {
      ok: false,
      comments: [],
      error: new Error("Загрузка комментариев ещё не подключена.")
    };
  }

  async function loadCommentsIntoModal(postId, options = {}) {
    const list = document.getElementById("klevbyFeedCommentsList");
    const cleanId = String(postId || "").trim();

    if (!list) return;

    if (!cleanId) {
      renderCommentsPlaceholder(list, "Фото не найдено.");
      return;
    }

    const token = beginCommentsLoad(cleanId);
    const cached = getCachedComments(cleanId);
    const listPostId = getCommentsListPostId(list);
    const isSamePostList = listPostId === cleanId;
    const hasCurrentVisibleComments = isSamePostList && hasVisibleComments(list);

    list.dataset.postId = cleanId;

    if (cached.length) {
      renderCommentsList(list, cleanId, cached, {
        scrollToBottom: options.scrollToBottom !== false
      });
    } else if (!hasCurrentVisibleComments) {
      renderCommentsPlaceholder(list, "Загружаем комментарии...");
    }

    try {
      const result = await runLoadComments(cleanId);

      if (!result || !result.ok) {
        const error = result?.error || new Error("Не удалось загрузить комментарии.");
        throw error;
      }

      const comments = setCachedComments(cleanId, normalizeCommentsResult(result));

      if (!isCommentModalActiveForPost(cleanId, token)) {
        return;
      }

      renderCommentsList(list, cleanId, comments, {
        scrollToBottom: options.scrollToBottom !== false
      });

      setCommentMessage("", false);
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарии не загрузились", error);

      if (!isCommentModalActiveForPost(cleanId, token)) {
        return;
      }

      const latestCached = getCachedComments(cleanId);

      if (latestCached.length) {
        renderCommentsList(list, cleanId, latestCached, {
          scrollToBottom: false
        });

        setCommentMessage("Комментарии не обновились. Показываю последние загруженные.", true);
        return;
      }

      if (hasVisibleComments(list) && getCommentsListPostId(list) === cleanId) {
        setCommentMessage("Комментарии не обновились. Уже показанные комментарии оставлены.", true);
        return;
      }

      renderCommentsPlaceholder(
        list,
        error?.message || "Не удалось загрузить комментарии."
      );
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
        getSendTimeoutMs(),
        "Комментарий не отправился: Supabase не ответил."
      );
    }

    if (typeof window.klevbyAddFeedComment === "function") {
      return withTimeout(
        window.klevbyAddFeedComment(cleanId, cleanText),
        getSendTimeoutMs(),
        "Комментарий не отправился: функция отправки не ответила."
      );
    }

    const api = getApi();

    if (typeof api.addComment === "function") {
      return withTimeout(
        api.addComment(cleanId, cleanText),
        getSendTimeoutMs(),
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
    const list = document.getElementById("klevbyFeedCommentsList");

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
      const createdComment = await runAddComment(postId, text);

      textarea.value = "";

      if (createdComment && typeof createdComment === "object") {
        const nextComments = appendCachedComment(postId, createdComment);

        if (list && isCommentModalActiveForPost(postId)) {
          renderCommentsList(list, postId, nextComments, {
            scrollToBottom: true
          });
        }
      }

      if (message) {
        message.textContent = "✅ Комментарий отправлен.";
        message.classList.remove("error-line");
      }

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      loadCommentsIntoModal(postId, {
        scrollToBottom: true
      });

      scheduleCommentCountSync(80);
      scheduleCommentCountSync(900);
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
    const list = document.getElementById("klevbyFeedCommentsList");
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
          getSendTimeoutMs(),
          "Комментарий не удалился: Supabase не ответил."
        );
      } else if (typeof window.klevbyDeleteFeedComment === "function") {
        await withTimeout(
          window.klevbyDeleteFeedComment(cleanCommentId),
          getSendTimeoutMs(),
          "Комментарий не удалился: функция удаления не ответила."
        );
      } else {
        const api = getApi();

        if (typeof api.deleteComment === "function") {
          await withTimeout(
            api.deleteComment(cleanCommentId),
            getSendTimeoutMs(),
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
        const nextComments = removeCachedComment(postId, cleanCommentId);

        if (list && isCommentModalActiveForPost(postId)) {
          renderCommentsList(list, postId, nextComments, {
            scrollToBottom: false
          });
        }

        loadCommentsIntoModal(postId, {
          scrollToBottom: false
        });

        scheduleCommentCountSync(80);
        scheduleCommentCountSync(900);
      }
    } catch (error) {
      console.warn("Klevby feed comments modal: комментарий не удалился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось удалить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  function initCommentsActions() {
    ensureModalStyles();
    bindCommentCountSyncHooks();

    if (!window.__klevbyFeedCommentsActionsKeydownBound) {
      window.__klevbyFeedCommentsActionsKeydownBound = true;

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeFeedCommentModal();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentsActions);
  } else {
    setTimeout(initCommentsActions, 0);
  }

  const commentsActions = {
    version: "20260509-comments-actions-slim-1",

    ensureCommentModal,
    openFeedCommentModal,
    closeFeedCommentModal,
    loadCommentsIntoModal,
    submitFeedComment,
    deleteFeedComment,

    runLoadComments,
    runAddComment,

    setSubmitBusy,
    scheduleCommentCountSync
  };

  window.KlevbyFeedCommentsActions = commentsActions;
  window.KlevbyFeedCommentActions = commentsActions;

  window.KlevbyFeedCommentsModal = commentsActions;
  window.KlevbyFeedCommentModal = commentsActions;

  window.openFeedCommentModal = openFeedCommentModal;
  window.closeFeedCommentModal = closeFeedCommentModal;
  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
})();
