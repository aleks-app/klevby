(function () {
  "use strict";

  const ACTIONS_VERSION = "20260509-comments-actions-slim-2";

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
      console.warn("Klevby feed comments actions: комментарии не загрузились", error);

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
      console.warn("Klevby feed comments actions: submit skipped, DOM not ready");
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
      console.warn("Klevby feed comments actions: комментарий не отправился", error);

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
      console.warn("Klevby feed comments actions: комментарий не удалился", error);

      if (message) {
        message.textContent = error?.message || "Не получилось удалить комментарий.";
        message.classList.add("error-line");
      }
    }
  }

  function initCommentsActions() {
    bindCommentCountSyncHooks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCommentsActions);
  } else {
    setTimeout(initCommentsActions, 0);
  }

  const commentsActions = {
    version: ACTIONS_VERSION,

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

  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;

  console.log("Klevby feed comments actions loaded", {
    version: ACTIONS_VERSION
  });
})();
