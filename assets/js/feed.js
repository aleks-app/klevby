(function () {
  const BOOTSTRAP_VERSION = "20260507-feed-bridge-1";
  const REQUIRED_MODULES = [
    "KlevbyFeedUtils",
    "KlevbyFeedState",
    "KlevbyFeedApi",
    "KlevbyFeedRenderer",
    "KlevbyFeedModals",
    "KlevbyFeedActions",
    "KlevbyFeedEvents",
    "KlevbyFeedMain"
  ];

  function getModule(name) {
    return window[name] || null;
  }

  function callSafe(fn, args = []) {
    if (typeof fn !== "function") return undefined;

    try {
      return fn.apply(window, args);
    } catch (error) {
      console.warn("Klevby feed bridge: функция не выполнилась", error);
      return undefined;
    }
  }

  function hasMainInitializer() {
    const main = getModule("KlevbyFeedMain");

    return Boolean(
      main &&
      (
        typeof main.init === "function" ||
        typeof main.start === "function" ||
        typeof main.bootstrap === "function"
      )
    );
  }

  function initMainModule() {
    const main = getModule("KlevbyFeedMain");

    if (!main || window.__klevbyFeedBridgeMainStarted) {
      return;
    }

    window.__klevbyFeedBridgeMainStarted = true;

    if (typeof main.init === "function") {
      callSafe(main.init);
      return;
    }

    if (typeof main.start === "function") {
      callSafe(main.start);
      return;
    }

    if (typeof main.bootstrap === "function") {
      callSafe(main.bootstrap);
    }
  }

  function exposeLegacyAliases() {
    const utils = getModule("KlevbyFeedUtils") || {};
    const state = getModule("KlevbyFeedState") || {};
    const api = getModule("KlevbyFeedApi") || {};
    const renderer = getModule("KlevbyFeedRenderer") || {};
    const modals = getModule("KlevbyFeedModals") || {};
    const actions = getModule("KlevbyFeedActions") || {};
    const events = getModule("KlevbyFeedEvents") || {};

    if (typeof window.getProfileFeedItemsSafe !== "function") {
      window.getProfileFeedItemsSafe =
        state.getProfileFeedItemsSafe ||
        renderer.getProfileFeedItemsSafe ||
        function () {
          return [];
        };
    }

    if (typeof window.getFilteredProfileFeedItems !== "function") {
      window.getFilteredProfileFeedItems =
        state.getFilteredProfileFeedItems ||
        renderer.getFilteredProfileFeedItems ||
        function () {
          return [];
        };
    }

    if (typeof window.openKlevbyProfileSafe !== "function") {
      window.openKlevbyProfileSafe =
        utils.openKlevbyProfileSafe ||
        function () {
          if (typeof window.openKlevbyProfile === "function") {
            window.openKlevbyProfile();
            return;
          }

          if (typeof window.showSection === "function") {
            window.showSection("profile");
          }
        };
    }

    if (typeof window.renderProfileFeed !== "function") {
      window.renderProfileFeed =
        renderer.renderProfileFeed ||
        renderer.render ||
        function () {
          const list = document.getElementById("profileFeedSection");

          if (list && !list.children.length) {
            list.innerHTML = "";
          }
        };
    }

    if (typeof window.profilePhotoCardHtml !== "function") {
      window.profilePhotoCardHtml =
        renderer.profilePhotoCardHtml ||
        renderer.cardHtml ||
        function () {
          return "";
        };
    }

    if (typeof window.openProfilePhotoFeedItem !== "function") {
      window.openProfilePhotoFeedItem =
        modals.openProfilePhotoFeedItem ||
        modals.openPhoto ||
        actions.openProfilePhotoFeedItem ||
        function () {
          if (typeof window.openKlevbyProfileSafe === "function") {
            window.openKlevbyProfileSafe();
          }
        };
    }

    if (typeof window.closeFeedPhotoViewer !== "function") {
      window.closeFeedPhotoViewer =
        modals.closeFeedPhotoViewer ||
        modals.closePhotoViewer ||
        function () {
          const viewer = document.getElementById("klevbyFeedPhotoViewer");

          if (viewer) {
            viewer.classList.add("hidden");
          }

          document.body.classList.remove("post-modal-open");
        };
    }

    if (typeof window.openFeedCommentModal !== "function") {
      window.openFeedCommentModal =
        modals.openFeedCommentModal ||
        modals.openCommentModal ||
        actions.openFeedCommentModal ||
        function () {
          alert("Комментарии ещё загружаются. Обнови страницу и попробуй ещё раз.");
        };
    }

    if (typeof window.closeFeedCommentModal !== "function") {
      window.closeFeedCommentModal =
        modals.closeFeedCommentModal ||
        modals.closeCommentModal ||
        function () {
          const modal = document.getElementById("klevbyFeedCommentModal");

          if (modal) {
            modal.classList.add("hidden");
            modal.dataset.postId = "";
          }

          document.body.classList.remove("post-modal-open");
        };
    }

    if (typeof window.submitFeedComment !== "function") {
      window.submitFeedComment =
        actions.submitFeedComment ||
        modals.submitFeedComment ||
        function () {
          alert("Отправка комментариев ещё загружается. Обнови страницу и попробуй ещё раз.");
        };
    }

    if (typeof window.deleteFeedComment !== "function") {
      window.deleteFeedComment =
        actions.deleteFeedComment ||
        modals.deleteFeedComment ||
        function () {
          alert("Удаление комментариев ещё загружается. Обнови страницу и попробуй ещё раз.");
        };
    }

    if (typeof window.toggleFeedLike !== "function") {
      window.toggleFeedLike =
        actions.toggleFeedLike ||
        actions.toggleLike ||
        api.toggleLike ||
        function () {
          alert("Лайки ещё загружаются. Обнови страницу и попробуй ещё раз.");
        };
    }

    if (typeof window.klevbyRefreshFeedIfHomeVisible !== "function") {
      window.klevbyRefreshFeedIfHomeVisible =
        events.refreshFeedIfHomeVisible ||
        renderer.refreshFeedIfHomeVisible ||
        function () {
          const homeSection = document.getElementById("homeSection");

          if (
            homeSection &&
            !homeSection.classList.contains("hidden") &&
            typeof window.renderProfileFeed === "function"
          ) {
            window.renderProfileFeed();
          }
        };
    }

    if (typeof window.klevbyStartFeedAutoRefresh !== "function") {
      window.klevbyStartFeedAutoRefresh =
        events.startFeedAutoRefresh ||
        function () {};
    }

    if (typeof window.klevbyTryStartFeedRealtime !== "function") {
      window.klevbyTryStartFeedRealtime =
        events.tryStartRealtimeSubscription ||
        events.tryStartRealtime ||
        function () {};
    }

    window.KlevbyFeedBridge = {
      version: BOOTSTRAP_VERSION,
      modules: REQUIRED_MODULES.reduce((result, name) => {
        result[name] = Boolean(getModule(name));
        return result;
      }, {}),
      init: initMainModule,
      exposeLegacyAliases
    };
  }

  function warnAboutMissingModules() {
    const missing = REQUIRED_MODULES.filter((name) => !getModule(name));

    if (!missing.length) return;

    console.warn(
      "Klevby feed bridge: часть модулей ленты не найдена:",
      missing.join(", ")
    );
  }

  function bootstrapFeed() {
    exposeLegacyAliases();

    if (hasMainInitializer()) {
      initMainModule();
    } else {
      warnAboutMissingModules();

      setTimeout(() => {
        exposeLegacyAliases();

        if (hasMainInitializer()) {
          initMainModule();
          return;
        }

        if (typeof window.renderProfileFeed === "function") {
          callSafe(window.renderProfileFeed);
        }
      }, 250);
    }

    setTimeout(() => {
      if (typeof window.klevbyRefreshFeedIfHomeVisible === "function") {
        callSafe(window.klevbyRefreshFeedIfHomeVisible);
      }
    }, 700);

    setTimeout(() => {
      if (typeof window.klevbyTryStartFeedRealtime === "function") {
        callSafe(window.klevbyTryStartFeedRealtime);
      }
    }, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapFeed, {
      once: true
    });
  } else {
    bootstrapFeed();
  }
})();
