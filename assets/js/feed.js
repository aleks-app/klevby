(function () {
  const KLEVB_FEED_BRIDGE_VERSION = "20260507-feed-bridge-1";

  if (window.__klevbyFeedBridgeLoaded) {
    console.warn("Klevby feed bridge: feed.js уже был подключён, повторный запуск остановлен.");
    return;
  }

  window.__klevbyFeedBridgeLoaded = true;

  function klevbyFeedGetModule(moduleName) {
    return window[moduleName] || null;
  }

  function klevbyFeedFindFunction(candidates) {
    for (const candidate of candidates) {
      const module = klevbyFeedGetModule(candidate.moduleName);

      if (
        module &&
        candidate.functionName &&
        typeof module[candidate.functionName] === "function"
      ) {
        return module[candidate.functionName].bind(module);
      }
    }

    return null;
  }

  function klevbyFeedRun(candidates, args = [], fallbackMessage = "") {
    const fn = klevbyFeedFindFunction(candidates);

    if (fn) {
      return fn(...args);
    }

    if (fallbackMessage) {
      console.warn(fallbackMessage);
    }

    return undefined;
  }

  function klevbyFeedRunAsync(candidates, args = [], fallbackMessage = "") {
    try {
      const result = klevbyFeedRun(candidates, args, fallbackMessage);

      if (result && typeof result.then === "function") {
        return result;
      }

      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function klevbyFeedFallbackAlert(message) {
    if (message) {
      alert(message);
    }
  }

  function klevbyFeedInit() {
    if (window.__klevbyFeedBridgeInitialized) return;

    window.__klevbyFeedBridgeInitialized = true;

    const initResult = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedMain", functionName: "init" },
        { moduleName: "KlevbyFeedMain", functionName: "start" },
        { moduleName: "KlevbyFeedEvents", functionName: "init" },
        { moduleName: "KlevbyFeedEvents", functionName: "bind" },
        { moduleName: "KlevbyFeedEvents", functionName: "bindEvents" }
      ],
      [],
      "Klevby feed bridge: основной модуль ленты не найден."
    );

    setTimeout(() => {
      klevbyFeedRun(
        [
          { moduleName: "KlevbyFeedMain", functionName: "render" },
          { moduleName: "KlevbyFeedMain", functionName: "renderFeed" },
          { moduleName: "KlevbyFeedRenderer", functionName: "render" },
          { moduleName: "KlevbyFeedRenderer", functionName: "renderFeed" },
          { moduleName: "KlevbyFeedRenderer", functionName: "renderProfileFeed" }
        ],
        [],
        ""
      );
    }, 250);

    return initResult;
  }

  function klevbyFeedRenderProfileFeed() {
    return klevbyFeedRunAsync(
      [
        { moduleName: "KlevbyFeedMain", functionName: "render" },
        { moduleName: "KlevbyFeedMain", functionName: "renderFeed" },
        { moduleName: "KlevbyFeedRenderer", functionName: "render" },
        { moduleName: "KlevbyFeedRenderer", functionName: "renderFeed" },
        { moduleName: "KlevbyFeedRenderer", functionName: "renderProfileFeed" }
      ],
      [],
      "Klevby feed bridge: renderProfileFeed не найден в модульной ленте."
    );
  }

  function klevbyFeedRefreshIfHomeVisible() {
    return klevbyFeedRunAsync(
      [
        { moduleName: "KlevbyFeedMain", functionName: "refreshIfHomeVisible" },
        { moduleName: "KlevbyFeedMain", functionName: "refresh" },
        { moduleName: "KlevbyFeedRenderer", functionName: "refreshIfHomeVisible" },
        { moduleName: "KlevbyFeedRenderer", functionName: "refresh" }
      ],
      [],
      ""
    );
  }

  function klevbyFeedOpenProfilePhotoFeedItem(photoId) {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedModals", functionName: "openProfilePhotoFeedItem" },
        { moduleName: "KlevbyFeedModals", functionName: "openPhotoFeedItem" },
        { moduleName: "KlevbyFeedActions", functionName: "openProfilePhotoFeedItem" },
        { moduleName: "KlevbyFeedActions", functionName: "openPhotoFeedItem" }
      ],
      [photoId],
      "Klevby feed bridge: openProfilePhotoFeedItem не найден."
    );

    if (typeof result === "undefined" && typeof window.openProfilePhotoViewer === "function") {
      window.openProfilePhotoViewer(photoId);
    }

    return result;
  }

  function klevbyFeedClosePhotoViewer() {
    return klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedModals", functionName: "closePhotoViewer" },
        { moduleName: "KlevbyFeedModals", functionName: "closeFeedPhotoViewer" },
        { moduleName: "KlevbyFeedActions", functionName: "closePhotoViewer" }
      ],
      [],
      ""
    );
  }

  function klevbyFeedOpenCommentModal(postId) {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedModals", functionName: "openCommentModal" },
        { moduleName: "KlevbyFeedModals", functionName: "openFeedCommentModal" },
        { moduleName: "KlevbyFeedActions", functionName: "openCommentModal" },
        { moduleName: "KlevbyFeedActions", functionName: "openFeedCommentModal" }
      ],
      [postId],
      "Klevby feed bridge: openFeedCommentModal не найден."
    );

    if (typeof result === "undefined") {
      klevbyFeedFallbackAlert("Комментарии пока не подключились. Обнови страницу и попробуй ещё раз.");
    }

    return result;
  }

  function klevbyFeedCloseCommentModal() {
    return klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedModals", functionName: "closeCommentModal" },
        { moduleName: "KlevbyFeedModals", functionName: "closeFeedCommentModal" },
        { moduleName: "KlevbyFeedActions", functionName: "closeCommentModal" }
      ],
      [],
      ""
    );
  }

  function klevbyFeedSubmitComment() {
    return klevbyFeedRunAsync(
      [
        { moduleName: "KlevbyFeedModals", functionName: "submitComment" },
        { moduleName: "KlevbyFeedModals", functionName: "submitFeedComment" },
        { moduleName: "KlevbyFeedActions", functionName: "submitComment" },
        { moduleName: "KlevbyFeedActions", functionName: "submitFeedComment" }
      ],
      [],
      "Klevby feed bridge: submitFeedComment не найден."
    );
  }

  function klevbyFeedDeleteComment(commentId) {
    return klevbyFeedRunAsync(
      [
        { moduleName: "KlevbyFeedActions", functionName: "deleteComment" },
        { moduleName: "KlevbyFeedActions", functionName: "deleteFeedComment" },
        { moduleName: "KlevbyFeedModals", functionName: "deleteComment" },
        { moduleName: "KlevbyFeedModals", functionName: "deleteFeedComment" }
      ],
      [commentId],
      "Klevby feed bridge: deleteFeedComment не найден."
    );
  }

  function klevbyFeedToggleLike(postId) {
    return klevbyFeedRunAsync(
      [
        { moduleName: "KlevbyFeedActions", functionName: "toggleLike" },
        { moduleName: "KlevbyFeedActions", functionName: "toggleFeedLike" },
        { moduleName: "KlevbyFeedActions", functionName: "toggleLikeFromCard" },
        { moduleName: "KlevbyFeedApi", functionName: "toggleLike" },
        { moduleName: "KlevbyFeedApi", functionName: "toggleFeedLike" }
      ],
      [postId],
      "Klevby feed bridge: toggleFeedLike не найден."
    );
  }

  function klevbyFeedOpenProfileSafe() {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedUtils", functionName: "openKlevbyProfileSafe" },
        { moduleName: "KlevbyFeedActions", functionName: "openKlevbyProfileSafe" }
      ],
      [],
      ""
    );

    if (typeof result !== "undefined") {
      return result;
    }

    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return undefined;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }

    return undefined;
  }

  function klevbyFeedGetProfileFeedItemsSafe() {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedApi", functionName: "getProfileFeedItemsSafe" },
        { moduleName: "KlevbyFeedState", functionName: "getProfileFeedItemsSafe" },
        { moduleName: "KlevbyFeedUtils", functionName: "getProfileFeedItemsSafe" }
      ],
      [],
      ""
    );

    return Array.isArray(result) ? result : [];
  }

  function klevbyFeedGetFilteredProfileFeedItems(options = {}) {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedApi", functionName: "getFilteredProfileFeedItems" },
        { moduleName: "KlevbyFeedState", functionName: "getFilteredProfileFeedItems" },
        { moduleName: "KlevbyFeedRenderer", functionName: "getFilteredProfileFeedItems" }
      ],
      [options],
      ""
    );

    return Array.isArray(result) ? result : [];
  }

  function klevbyFeedProfilePhotoCardHtml(item) {
    const result = klevbyFeedRun(
      [
        { moduleName: "KlevbyFeedRenderer", functionName: "profilePhotoCardHtml" },
        { moduleName: "KlevbyFeedRenderer", functionName: "cardHtml" },
        { moduleName: "KlevbyFeedRenderer", functionName: "photoCardHtml" }
      ],
      [item],
      ""
    );

    return typeof result === "string" ? result : "";
  }

  window.klevbyFeedBridgeVersion = KLEVB_FEED_BRIDGE_VERSION;

  window.renderProfileFeed = klevbyFeedRenderProfileFeed;
  window.refreshProfileFeed = klevbyFeedRefreshIfHomeVisible;
  window.openProfilePhotoFeedItem = klevbyFeedOpenProfilePhotoFeedItem;
  window.closeFeedPhotoViewer = klevbyFeedClosePhotoViewer;
  window.openFeedCommentModal = klevbyFeedOpenCommentModal;
  window.closeFeedCommentModal = klevbyFeedCloseCommentModal;
  window.submitFeedComment = klevbyFeedSubmitComment;
  window.deleteFeedComment = klevbyFeedDeleteComment;
  window.toggleFeedLike = klevbyFeedToggleLike;
  window.openKlevbyProfileSafe = klevbyFeedOpenProfileSafe;
  window.getProfileFeedItemsSafe = klevbyFeedGetProfileFeedItemsSafe;
  window.getFilteredProfileFeedItems = klevbyFeedGetFilteredProfileFeedItems;
  window.profilePhotoCardHtml = klevbyFeedProfilePhotoCardHtml;

  window.KlevbyFeedBridge = {
    version: KLEVB_FEED_BRIDGE_VERSION,
    init: klevbyFeedInit,
    render: klevbyFeedRenderProfileFeed,
    refresh: klevbyFeedRefreshIfHomeVisible,
    openProfilePhotoFeedItem: klevbyFeedOpenProfilePhotoFeedItem,
    closePhotoViewer: klevbyFeedClosePhotoViewer,
    openCommentModal: klevbyFeedOpenCommentModal,
    closeCommentModal: klevbyFeedCloseCommentModal,
    submitComment: klevbyFeedSubmitComment,
    deleteComment: klevbyFeedDeleteComment,
    toggleLike: klevbyFeedToggleLike,
    openProfileSafe: klevbyFeedOpenProfileSafe
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(klevbyFeedInit, 80);
    setTimeout(klevbyFeedRenderProfileFeed, 420);
  });

  window.addEventListener("pageshow", () => {
    setTimeout(klevbyFeedRefreshIfHomeVisible, 180);
  });

  console.log("Klevby feed bridge loaded:", KLEVB_FEED_BRIDGE_VERSION);
})();
