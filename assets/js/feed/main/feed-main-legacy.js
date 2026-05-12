(function () {
  const LEGACY_VERSION = "20260512-feed-main-legacy-1";

  function createBridge(deps = {}) {
    const safeDeps = deps && typeof deps === "object" ? deps : {};

    function getRender() {
      if (typeof safeDeps.getRender === "function") {
        return safeDeps.getRender() || {};
      }

      return window.KlevbyFeedRender || {};
    }

    function getUtils() {
      if (typeof safeDeps.getUtils === "function") {
        return safeDeps.getUtils() || {};
      }

      return window.KlevbyFeedUtils || {};
    }

    function getModals() {
      if (typeof safeDeps.getModals === "function") {
        return safeDeps.getModals() || {};
      }

      return window.KlevbyFeedModals || {};
    }

    function getActions() {
      if (typeof safeDeps.getActions === "function") {
        return safeDeps.getActions() || {};
      }

      return window.KlevbyFeedActions || {};
    }

    function getLikeQuietMs() {
      return Math.max(0, Number(safeDeps.likeQuietMs || 0) || 0);
    }

    function markFeedQuiet(reason = "quiet", duration = getLikeQuietMs()) {
      if (typeof safeDeps.markFeedQuiet === "function") {
        safeDeps.markFeedQuiet(reason, duration);
      }
    }

    function forceRenderFeed(reason = "manual", options = {}) {
      if (typeof safeDeps.forceRenderFeed === "function") {
        return safeDeps.forceRenderFeed(reason, options);
      }

      return Promise.resolve(false);
    }

    function runMainResumeBurst(reason = "resume") {
      if (typeof safeDeps.runMainResumeBurst === "function") {
        safeDeps.runMainResumeBurst(reason);
      }
    }

    function renderProfileFeed() {
      if (typeof safeDeps.renderProfileFeed === "function") {
        return safeDeps.renderProfileFeed();
      }

      const render = getRender();

      if (typeof render.renderProfileFeed === "function") {
        return render.renderProfileFeed();
      }

      return Promise.resolve(false);
    }

    function isDuplicateLikeError(error) {
      if (typeof safeDeps.isDuplicateLikeError === "function") {
        return safeDeps.isDuplicateLikeError(error);
      }

      const code = String(error?.code || error?.details?.code || "").trim();
      const message = String(error?.message || "").toLowerCase();
      const details = String(error?.details || "").toLowerCase();
      const hint = String(error?.hint || "").toLowerCase();
      const constraint = String(error?.constraint || error?.details?.constraint || "").toLowerCase();

      return (
        code === "23505" ||
        message.includes("duplicate key") ||
        message.includes("feed_likes_unique_user_post") ||
        details.includes("feed_likes_unique_user_post") ||
        hint.includes("feed_likes_unique_user_post") ||
        constraint.includes("feed_likes_unique_user_post")
      );
    }

    function openKlevbyProfileSafe() {
      const utils = getUtils();

      if (typeof utils.openKlevbyProfileSafe === "function") {
        return utils.openKlevbyProfileSafe();
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

    function getProfileFeedItemsSafe() {
      const render = getRender();
      const utils = getUtils();

      if (typeof render.getProfileFeedItemsSafe === "function") {
        return render.getProfileFeedItemsSafe();
      }

      if (typeof utils.getProfileFeedItemsSafe === "function") {
        return utils.getProfileFeedItemsSafe();
      }

      try {
        if (typeof window.getProfileFeedItems === "function") {
          const items = window.getProfileFeedItems();
          return Array.isArray(items) ? items : [];
        }
      } catch (error) {
        console.warn("Klevby feed: не удалось получить фото профиля", error);
      }

      return [];
    }

    function getFilteredProfileFeedItems(options = {}) {
      const render = getRender();
      const utils = getUtils();

      if (typeof render.getFilteredProfileFeedItems === "function") {
        return render.getFilteredProfileFeedItems(options);
      }

      if (typeof utils.getFilteredProfileFeedItems === "function") {
        return utils.getFilteredProfileFeedItems(options);
      }

      return getProfileFeedItemsSafe();
    }

    function profilePhotoCardHtml(item) {
      const render = getRender();

      if (typeof render.profilePhotoCardHtml === "function") {
        return render.profilePhotoCardHtml(item);
      }

      return "";
    }

    function openProfilePhotoFeedItem(postId) {
      const modals = getModals();
      const actions = getActions();

      if (typeof modals.openProfilePhotoFeedItem === "function") {
        return modals.openProfilePhotoFeedItem(postId);
      }

      if (typeof actions.openProfilePhotoFeedItem === "function") {
        return actions.openProfilePhotoFeedItem(postId);
      }

      if (typeof window.openProfilePhotoViewer === "function") {
        return window.openProfilePhotoViewer(postId);
      }

      return openKlevbyProfileSafe();
    }

    function closeFeedPhotoViewer() {
      const modals = getModals();

      if (typeof modals.closeFeedPhotoViewer === "function") {
        return modals.closeFeedPhotoViewer();
      }

      const viewer = document.getElementById("klevbyFeedPhotoViewer");
      const image = document.getElementById("klevbyFeedPhotoViewerImage");

      if (viewer) {
        viewer.classList.add("hidden");
      }

      if (image) {
        image.removeAttribute("src");
      }

      document.body.classList.remove("post-modal-open");

      return undefined;
    }

    function openFeedCommentModal(postId) {
      const modals = getModals();

      if (typeof modals.openFeedCommentModal === "function") {
        return modals.openFeedCommentModal(postId);
      }

      alert("Комментарии ещё загружаются. Обнови страницу и попробуй ещё раз.");
      return undefined;
    }

    function closeFeedCommentModal() {
      const modals = getModals();

      if (typeof modals.closeFeedCommentModal === "function") {
        return modals.closeFeedCommentModal();
      }

      const modal = document.getElementById("klevbyFeedCommentModal");

      if (modal) {
        modal.classList.add("hidden");
        modal.dataset.postId = "";
      }

      document.body.classList.remove("post-modal-open");

      return undefined;
    }

    function submitFeedComment() {
      const actions = getActions();
      const modals = getModals();

      if (typeof actions.submitFeedComment === "function") {
        return actions.submitFeedComment();
      }

      if (typeof modals.submitFeedComment === "function") {
        return modals.submitFeedComment();
      }

      alert("Отправка комментариев ещё не подключена.");
      return Promise.resolve();
    }

    function deleteFeedComment(commentId) {
      const actions = getActions();
      const modals = getModals();

      if (typeof actions.deleteFeedComment === "function") {
        return actions.deleteFeedComment(commentId);
      }

      if (typeof modals.deleteFeedComment === "function") {
        return modals.deleteFeedComment(commentId);
      }

      alert("Удаление комментариев ещё не подключено.");
      return Promise.resolve();
    }

    function toggleFeedLike(postId) {
      const cleanPostId = String(postId || "").trim();
      const actions = getActions();

      markFeedQuiet("like_button_click", getLikeQuietMs());

      if (typeof actions.toggleLikeFromCard === "function") {
        return actions.toggleLikeFromCard(cleanPostId);
      }

      if (typeof actions.toggleFeedLikeFromCard === "function") {
        return actions.toggleFeedLikeFromCard(cleanPostId);
      }

      if (typeof actions.toggleFeedLike === "function") {
        return actions.toggleFeedLike(cleanPostId);
      }

      if (typeof window.klevbyToggleFeedLike === "function") {
        return window.klevbyToggleFeedLike(cleanPostId)
          .then(() => {
            markFeedQuiet("like_clicked", getLikeQuietMs());
            return true;
          })
          .catch((error) => {
            if (isDuplicateLikeError(error)) {
              markFeedQuiet("like_duplicate", getLikeQuietMs());
              return true;
            }

            console.warn("Klevby feed: лайк не сработал", error);
            alert(error?.message || "Не получилось поставить лайк.");
            return false;
          });
      }

      alert("Лайки ещё не подключены.");
      return Promise.resolve(false);
    }

    function exposeLegacyGlobals() {
      window.getProfileFeedItemsSafe = getProfileFeedItemsSafe;
      window.getFilteredProfileFeedItems = getFilteredProfileFeedItems;
      window.openKlevbyProfileSafe = openKlevbyProfileSafe;
      window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
      window.renderProfileFeed = renderProfileFeed;
      window.profilePhotoCardHtml = profilePhotoCardHtml;
      window.toggleFeedLike = toggleFeedLike;
      window.closeFeedPhotoViewer = closeFeedPhotoViewer;
      window.openFeedCommentModal = openFeedCommentModal;
      window.closeFeedCommentModal = closeFeedCommentModal;
      window.submitFeedComment = submitFeedComment;
      window.deleteFeedComment = deleteFeedComment;

      window.klevbyForceRenderFeed = function klevbyForceRenderFeed() {
        return forceRenderFeed("manual_force_global", {
          force: true
        });
      };

      window.klevbyWakeFeed = function klevbyWakeFeed() {
        runMainResumeBurst("manual_wake_global");

        return forceRenderFeed("manual_wake_global", {
          force: true
        });
      };

      window.refreshKlevbyFeedSilently = function refreshKlevbyFeedSilently() {
        return forceRenderFeed("manual_silent_global", {
          force: false
        });
      };

      return true;
    }

    return {
      exposeLegacyGlobals,
      getProfileFeedItemsSafe,
      getFilteredProfileFeedItems,
      profilePhotoCardHtml,
      openKlevbyProfileSafe,
      openProfilePhotoFeedItem,
      closeFeedPhotoViewer,
      openFeedCommentModal,
      closeFeedCommentModal,
      submitFeedComment,
      deleteFeedComment,
      toggleFeedLike
    };
  }

  window.KlevbyFeedMainLegacy = {
    LEGACY_VERSION,
    createBridge
  };

  console.info("Klevby feed main legacy bridge loaded", {
    version: LEGACY_VERSION
  });
})();
