(function () {
  "use strict";

  const ACTIONS_VERSION = "20260509-comments-actions-resume-safe-1";

  const LOAD_SOFT_COOLDOWN_MS = 3500;
  const SOFT_LOG_COOLDOWN_MS = 14000;
  const BACKGROUND_REFRESH_DELAY_MS = 1400;
  const BACKGROUND_DELETE_RETRY_DELAY_MS = 1800;

  let commentsLoadSerial = 0;

  const commentsLoadInFlightByPostId = new Map();
  const commentsLoadCooldownUntilByPostId = new Map();
  const commentsSoftLogAtByKey = new Map();
  const commentsRefreshTimersByPostId = new Map();
  const commentsDeleteRetryTimersById = new Map();

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

  function getNow() {
    return Date.now();
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
          reject(new Error(errorMessage || "Supabase не ответил."));
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

  function isRecoverableSupabaseError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();

    return (
      name.includes("abort") ||
      message.includes("supabase не ответил") ||
      message.includes("supabase не ответила") ||
      message.includes("не ответил") ||
      message.includes("не ответила") ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("abort") ||
      message.includes("aborted") ||
      message.includes("network") ||
      message.includes("failed to fetch") ||
      message.includes("fetch failed") ||
      message.includes("load failed")
    );
  }

  function softLog(key, message, error, options = {}) {
    const cleanKey = String(key || "comments-actions");
    const now = getNow();
    const lastLogAt = Number(commentsSoftLogAtByKey.get(cleanKey) || 0);
    const shouldLog = now - lastLogAt > SOFT_LOG_COOLDOWN_MS;
    const recoverable = isRecoverableSupabaseError(error);

    if (!shouldLog && !options.force) {
      if (typeof console.debug === "function") {
        console.debug(message, error);
      }
      return;
    }

    commentsSoftLogAtByKey.set(cleanKey, now);

    if (recoverable && !options.warnRecoverable) {
      if (typeof console.debug === "function") {
        console.debug(message, error);
      }
      return;
    }

    console.warn(message, error);
  }

  function markLoadCooldown(postId, delay = LOAD_SOFT_COOLDOWN_MS) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    commentsLoadCooldownUntilByPostId.set(
      cleanId,
      getNow() + Math.max(500, Number(delay || LOAD_SOFT_COOLDOWN_MS))
    );
  }

  function isLoadInCooldown(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return false;

    return getNow() < Number(commentsLoadCooldownUntilByPostId.get(cleanId) || 0);
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

  function runLoadCommentsDeduped(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) {
      return Promise.resolve({
        ok: false,
        comments: [],
        error: new Error("Не указан id фото.")
      });
    }

    if (commentsLoadInFlightByPostId.has(cleanId)) {
      return commentsLoadInFlightByPostId.get(cleanId);
    }

    const promise = runLoadComments(cleanId).finally(() => {
      commentsLoadInFlightByPostId.delete(cleanId);
    });

    commentsLoadInFlightByPostId.set(cleanId, promise);

    return promise;
  }

  function shouldSkipSoftLoad(cleanId, cached, list, options = {}) {
    if (options.force === true) return false;
    if (!isLoadInCooldown(cleanId)) return false;

    const hasCached = Array.isArray(cached) && cached.length > 0;
    const hasCurrentVisibleComments =
      getCommentsListPostId(list) === cleanId && hasVisibleComments(list);

    return Boolean(hasCached || hasCurrentVisibleComments || options.background);
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

    if (shouldSkipSoftLoad(cleanId, cached, list, options)) {
      if (!options.background) {
        setCommentMessage("", false);
      }
      return;
    }

    try {
      const result = await runLoadCommentsDeduped(cleanId);

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
      markLoadCooldown(cleanId);

      const latestCached = getCachedComments(cleanId);
      const canKeepVisible =
        latestCached.length ||
        (hasVisibleComments(list) && getCommentsListPostId(list) === cleanId);

      softLog(
        `load-${cleanId}`,
        "Klevby feed comments actions: комментарии не обновились",
        error,
        {
          warnRecoverable: !canKeepVisible && !options.background && !options.silent
        }
      );

      if (!isCommentModalActiveForPost(cleanId, token)) {
        return;
      }

      if (latestCached.length) {
        renderCommentsList(list, cleanId, latestCached, {
          scrollToBottom: false
        });

        if (!options.background && !options.silent) {
          setCommentMessage("Показываю последние загруженные комментарии.", false);
        }

        return;
      }

      if (hasVisibleComments(list) && getCommentsListPostId(list) === cleanId) {
        if (!options.background && !options.silent) {
          setCommentMessage("Комментарии не обновились. Уже показанные комментарии оставлены.", false);
        }

        return;
      }

      renderCommentsPlaceholder(
        list,
        error?.message || "Не удалось загрузить комментарии."
      );
    }
  }

  function queueCommentsRefresh(postId, options = {}) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    const oldTimer = commentsRefreshTimersByPostId.get(cleanId);

    if (oldTimer) {
      window.clearTimeout(oldTimer);
    }

    const delay = Math.max(250, Number(options.delay || BACKGROUND_REFRESH_DELAY_MS));

    const timer = window.setTimeout(() => {
      commentsRefreshTimersByPostId.delete(cleanId);

      const modal = document.getElementById("klevbyFeedCommentModal");

      if (!modal || modal.classList.contains("hidden")) {
        return;
      }

      if (String(modal.dataset.postId || "").trim() !== cleanId) {
        return;
      }

      loadCommentsIntoModal(cleanId, {
        scrollToBottom: options.scrollToBottom !== false,
        background: true,
        silent: true,
        force: Boolean(options.force)
      });
    }, delay);

    commentsRefreshTimersByPostId.set(cleanId, timer);
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

      queueCommentsRefresh(postId, {
        scrollToBottom: true,
        delay: 1200
      });

      scheduleCommentCountSync(80);
      scheduleCommentCountSync(900);
    } catch (error) {
      softLog(
        `add-${postId}`,
        "Klevby feed comments actions: комментарий не отправился",
        error,
        {
          warnRecoverable: true
        }
      );

      if (message) {
        message.textContent = error?.message || "Не получилось отправить комментарий.";
        message.classList.add("error-line");
      }
    } finally {
      setSubmitBusy(false);
    }
  }

  async function runDeleteCommentRemote(commentId) {
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.deleteComment === "function"
    ) {
      return withTimeout(
        window.klevbyFeedSupabase.deleteComment(cleanCommentId),
        getSendTimeoutMs(),
        "Комментарий не удалился: Supabase не ответил."
      );
    }

    if (typeof window.klevbyDeleteFeedComment === "function") {
      return withTimeout(
        window.klevbyDeleteFeedComment(cleanCommentId),
        getSendTimeoutMs(),
        "Комментарий не удалился: функция удаления не ответила."
      );
    }

    const api = getApi();

    if (typeof api.deleteComment === "function") {
      return withTimeout(
        api.deleteComment(cleanCommentId),
        getSendTimeoutMs(),
        "Комментарий не удалился: API ленты не ответил."
      );
    }

    throw new Error("Удаление комментариев ещё не подключено.");
  }

  function queueBackgroundDeleteRetry(commentId, postId) {
    const cleanCommentId = String(commentId || "").trim();
    const cleanPostId = String(postId || "").trim();

    if (!cleanCommentId) return;

    const oldTimer = commentsDeleteRetryTimersById.get(cleanCommentId);

    if (oldTimer) {
      window.clearTimeout(oldTimer);
    }

    const timer = window.setTimeout(async () => {
      commentsDeleteRetryTimersById.delete(cleanCommentId);

      try {
        await runDeleteCommentRemote(cleanCommentId);

        if (cleanPostId) {
          scheduleCommentCountSync(120);
          queueCommentsRefresh(cleanPostId, {
            scrollToBottom: false,
            delay: 1600,
            force: false
          });
        }
      } catch (error) {
        softLog(
          `delete-retry-${cleanCommentId}`,
          "Klevby feed comments actions: фоновое удаление комментария не подтвердилось",
          error,
          {
            warnRecoverable: false
          }
        );
      }
    }, BACKGROUND_DELETE_RETRY_DELAY_MS);

    commentsDeleteRetryTimersById.set(cleanCommentId, timer);
  }

  function restoreCachedComments(postId, previousComments) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId || !Array.isArray(previousComments)) return;

    setCachedComments(cleanPostId, previousComments);

    const list = document.getElementById("klevbyFeedCommentsList");

    if (list && isCommentModalActiveForPost(cleanPostId)) {
      renderCommentsList(list, cleanPostId, previousComments, {
        scrollToBottom: false
      });
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

    const previousComments = postId ? getCachedComments(postId).slice() : [];
    let optimisticApplied = false;

    if (postId && previousComments.length) {
      const nextComments = removeCachedComment(postId, cleanCommentId);
      optimisticApplied = true;

      if (list && isCommentModalActiveForPost(postId)) {
        renderCommentsList(list, postId, nextComments, {
          scrollToBottom: false
        });
      }
    }

    if (message) {
      message.textContent = "Удаляем комментарий...";
      message.classList.remove("error-line");
    }

    try {
      await runDeleteCommentRemote(cleanCommentId);

      if (message) {
        message.textContent = "Комментарий удалён.";
        message.classList.remove("error-line");
      }

      if (postId && !optimisticApplied) {
        const nextComments = removeCachedComment(postId, cleanCommentId);

        if (list && isCommentModalActiveForPost(postId)) {
          renderCommentsList(list, postId, nextComments, {
            scrollToBottom: false
          });
        }
      }

      if (postId) {
        queueCommentsRefresh(postId, {
          scrollToBottom: false,
          delay: 1200
        });

        scheduleCommentCountSync(80);
        scheduleCommentCountSync(900);
      }
    } catch (error) {
      const recoverable = isRecoverableSupabaseError(error);

      softLog(
        `delete-${cleanCommentId}`,
        "Klevby feed comments actions: комментарий не удалился сразу",
        error,
        {
          warnRecoverable: !recoverable
        }
      );

      if (recoverable) {
        if (message) {
          message.textContent = optimisticApplied
            ? "Комментарий убран из окна. Синхронизирую в фоне."
            : "Supabase подвис. Попробуй ещё раз через пару секунд.";
          message.classList.toggle("error-line", !optimisticApplied);
        }

        if (optimisticApplied) {
          queueBackgroundDeleteRetry(cleanCommentId, postId);
          scheduleCommentCountSync(900);
        }

        return;
      }

      if (optimisticApplied) {
        restoreCachedComments(postId, previousComments);
      }

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
