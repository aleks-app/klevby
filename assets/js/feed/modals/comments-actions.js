(function () {
  "use strict";

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getModals() {
    return window.KlevbyFeedModals || {};
  }

  function getCommentsModal() {
    return window.KlevbyFeedCommentsModal || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
  }

  function renderFeedSoon(delay = 80) {
    const renderer = getRender();

    setTimeout(() => {
      if (typeof renderer.renderProfileFeed === "function") {
        renderer.renderProfileFeed();
        return;
      }

      if (typeof window.renderProfileFeed === "function") {
        window.renderProfileFeed();
      }
    }, Math.max(0, Number(delay || 0)));
  }

  function getCommentModalElements() {
    return {
      modal: document.getElementById("klevbyFeedCommentModal"),
      textarea: document.getElementById("klevbyFeedCommentText"),
      message: document.getElementById("klevbyFeedCommentMessage")
    };
  }

  function setCommentMessage(text, isError = false) {
    const message = document.getElementById("klevbyFeedCommentMessage");

    if (!message) return;

    message.textContent = text || "";
    message.classList.toggle("error-line", Boolean(isError));
  }

  function focusCommentTextarea() {
    const textarea = document.getElementById("klevbyFeedCommentText");

    if (!textarea) return;

    try {
      textarea.focus({
        preventScroll: true
      });
    } catch (_) {
      textarea.focus();
    }
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

  async function runDeleteComment(commentId) {
    const api = getApi();

    if (typeof api.deleteComment === "function") {
      return api.deleteComment(commentId);
    }

    if (typeof window.klevbyDeleteFeedComment === "function") {
      return window.klevbyDeleteFeedComment(commentId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.deleteComment === "function"
    ) {
      return window.klevbyFeedSupabase.deleteComment(commentId);
    }

    throw new Error("Удаление комментариев ещё не подключено.");
  }

  async function loadCommentsIntoModal(postId) {
    const commentsModal = getCommentsModal();
    const modals = getModals();

    if (typeof commentsModal.loadCommentsIntoModal === "function") {
      return commentsModal.loadCommentsIntoModal(postId);
    }

    if (typeof modals.loadCommentsIntoModal === "function") {
      return modals.loadCommentsIntoModal(postId);
    }

    if (typeof window.loadFeedCommentsIntoModal === "function") {
      return window.loadFeedCommentsIntoModal(postId);
    }

    return Promise.resolve();
  }

  function getActiveCommentPostId() {
    const modal = document.getElementById("klevbyFeedCommentModal");

    return String(modal?.dataset?.postId || "").trim();
  }

  async function submitFeedComment() {
    const { modal, textarea } = getCommentModalElements();

    if (!modal || !textarea) {
      console.warn("Klevby feed comments: comment modal elements not found");
      return;
    }

    const postId = String(modal.dataset.postId || "").trim();
    const text = String(textarea.value || "").trim();

    if (!postId) {
      setCommentMessage("Фото не найдено. Закрой окно и попробуй ещё раз.", true);
      return;
    }

    if (!text) {
      setCommentMessage("Напиши комментарий перед отправкой.", true);
      focusCommentTextarea();
      return;
    }

    if (text.length > 700) {
      setCommentMessage("Комментарий слишком длинный. Сделай короче.", true);
      focusCommentTextarea();
      return;
    }

    textarea.disabled = true;
    setCommentMessage("Отправляем комментарий...", false);

    try {
      await runAddComment(postId, text);

      textarea.value = "";
      setCommentMessage("✅ Комментарий отправлен.", false);

      if (navigator.vibrate) {
        navigator.vibrate(16);
      }

      await loadCommentsIntoModal(postId);
      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed comments: комментарий не отправился", error);
      setCommentMessage(error?.message || "Не получилось отправить комментарий.", true);
    } finally {
      textarea.disabled = false;
    }
  }

  async function deleteFeedComment(commentId) {
    const cleanCommentId = String(commentId || "").trim();
    const postId = getActiveCommentPostId();

    if (!cleanCommentId) return;

    if (!confirm("Удалить комментарий?")) {
      return;
    }

    setCommentMessage("Удаляем комментарий...", false);

    try {
      await runDeleteComment(cleanCommentId);

      setCommentMessage("Комментарий удалён.", false);

      if (postId) {
        await loadCommentsIntoModal(postId);
      }

      renderFeedSoon(80);
    } catch (error) {
      console.warn("Klevby feed comments: комментарий не удалился", error);
      setCommentMessage(error?.message || "Не получилось удалить комментарий.", true);
    }
  }

  window.KlevbyFeedCommentsActions = {
    renderFeedSoon,
    getCommentModalElements,
    setCommentMessage,
    focusCommentTextarea,
    runAddComment,
    runDeleteComment,
    loadCommentsIntoModal,
    getActiveCommentPostId,
    submitFeedComment,
    deleteFeedComment
  };

  window.submitFeedComment = submitFeedComment;
  window.deleteFeedComment = deleteFeedComment;
})();
