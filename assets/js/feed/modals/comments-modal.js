(function () {
  "use strict";

  const BRIDGE_VERSION = "20260509-comments-modal-bridge-1";

  function getActionsModule() {
    const module = window.KlevbyFeedCommentsModal;

    if (
      module &&
      module.__klevbyCommentsModalBridge !== true &&
      typeof module === "object"
    ) {
      return module;
    }

    return null;
  }

  function getLegacyModule() {
    const modals = window.KlevbyFeedModals;

    if (modals && typeof modals === "object") {
      return modals;
    }

    return null;
  }

  function callModuleMethod(methodName, args, fallbackValue) {
    const actionsModule = getActionsModule();

    if (
      actionsModule &&
      typeof actionsModule[methodName] === "function"
    ) {
      return actionsModule[methodName].apply(actionsModule, args);
    }

    const legacyModule = getLegacyModule();

    if (
      legacyModule &&
      typeof legacyModule[methodName] === "function"
    ) {
      return legacyModule[methodName].apply(legacyModule, args);
    }

    return fallbackValue;
  }

  function ensureCommentModal() {
    return callModuleMethod("ensureCommentModal", arguments, null);
  }

  function openFeedCommentModal(postId) {
    return callModuleMethod("openFeedCommentModal", arguments, undefined);
  }

  function closeFeedCommentModal() {
    return callModuleMethod("closeFeedCommentModal", arguments, undefined);
  }

  function loadCommentsIntoModal(postId) {
    return callModuleMethod(
      "loadCommentsIntoModal",
      arguments,
      Promise.resolve()
    );
  }

  function submitFeedComment() {
    return callModuleMethod(
      "submitFeedComment",
      arguments,
      Promise.resolve()
    );
  }

  function deleteFeedComment(commentId) {
    return callModuleMethod(
      "deleteFeedComment",
      arguments,
      Promise.resolve()
    );
  }

  function runLoadComments(postId) {
    return callModuleMethod(
      "runLoadComments",
      arguments,
      Promise.resolve({
        ok: false,
        comments: [],
        error: new Error("Модуль комментариев ещё не готов.")
      })
    );
  }

  function runAddComment(postId, text) {
    return callModuleMethod(
      "runAddComment",
      arguments,
      Promise.reject(new Error("Модуль отправки комментариев ещё не готов."))
    );
  }

  const existingModule = getActionsModule();

  if (!existingModule) {
    window.KlevbyFeedCommentsModal = {
      __klevbyCommentsModalBridge: true,
      version: BRIDGE_VERSION,
      ensureCommentModal,
      openFeedCommentModal,
      closeFeedCommentModal,
      loadCommentsIntoModal,
      submitFeedComment,
      deleteFeedComment,
      runLoadComments,
      runAddComment
    };
  }

  if (typeof window.openFeedCommentModal !== "function") {
    window.openFeedCommentModal = openFeedCommentModal;
  }

  if (typeof window.closeFeedCommentModal !== "function") {
    window.closeFeedCommentModal = closeFeedCommentModal;
  }

  if (typeof window.submitFeedComment !== "function") {
    window.submitFeedComment = submitFeedComment;
  }

  if (typeof window.deleteFeedComment !== "function") {
    window.deleteFeedComment = deleteFeedComment;
  }

  console.log("Klevby feed comments modal bridge loaded", {
    version: BRIDGE_VERSION,
    hasRealModule: Boolean(existingModule)
  });
})();
