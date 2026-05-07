(function () {
  let klevbyFeedMainRefreshTimer = null;
  let klevbyFeedMainRefreshInProgress = false;
  let klevbyFeedMainRefreshPending = false;
  let klevbyFeedMainResumeBound = false;
  let klevbyFeedMainResumeTimers = [];

  const KLEVB_FEED_MAIN_POLL_MS = 3000;
  const KLEVB_FEED_MAIN_RESUME_DELAYS = [0, 400, 1200, 2600, 5200, 9000, 15000];

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
  }

  function getModals() {
    return window.KlevbyFeedModals || {};
  }

  function getActions() {
    return window.KlevbyFeedActions || {};
  }

  function getEvents() {
    return window.KlevbyFeedEvents || {};
  }

  function safeCall(fn, args = [], fallbackValue = undefined) {
    try {
      if (typeof fn === "function") {
        return fn.apply(null, args);
      }
    } catch (error) {
      console.warn("Klevby feed: ошибка вызова функции", error);
    }

    return fallbackValue;
  }

  function isPageVisible() {
    return document.visibilityState !== "hidden";
  }

  function hasFeedDom() {
    return Boolean(document.getElementById("profileFeedSection"));
  }

  function openKlevbyProfileSafe() {
    const utils = getUtils();

    if (typeof utils.openKlevbyProfileSafe === "function") {
      return utils.openKlevbyProfileSafe();
    }

    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function renderProfileFeed() {
    const render = getRender();

    if (typeof render.renderProfileFeed === "function") {
      return render.renderProfileFeed();
    }

    const list = document.getElementById("profileFeedSection");

    if (list) {
      list.innerHTML = `
        <div class="home-empty-card">
          <div class="home-empty-icon">📸</div>
          <h3>Лента загружается</h3>
          <p>Модули ленты ещё подключаются. Обнови страницу через пару секунд.</p>
        </div>
      `;
    }

    return Promise.resolve();
  }

  function refreshFeedIfHomeVisible() {
    const render = getRender();
    const homeSection = document.getElementById("homeSection");

    if (typeof render.refreshFeedIfHomeVisible === "function") {
      return render.refreshFeedIfHomeVisible();
    }

    if (homeSection && !homeSection.classList.contains("hidden")) {
      return renderProfileFeed();
    }

    if (hasFeedDom()) {
      return renderProfileFeed();
    }

    return Promise.resolve();
  }

  async function forceRenderFeed(reason = "manual", options = {}) {
    const force = Boolean(options.force);

    if (!force && !isPageVisible()) {
      return false;
    }

    if (!hasFeedDom()) {
      return false;
    }

    if (klevbyFeedMainRefreshInProgress) {
      klevbyFeedMainRefreshPending = true;
      return false;
    }

    klevbyFeedMainRefreshInProgress = true;

    try {
      await Promise.resolve(renderProfileFeed());

      window.dispatchEvent(new CustomEvent("klevby-feed-main-refreshed", {
        detail: {
          reason,
          at: new Date().toISOString()
        }
      }));

      return true;
    } catch (error) {
      console.warn("Klevby feed main: лента не обновилась", error);
      return false;
    } finally {
      klevbyFeedMainRefreshInProgress = false;

      if (klevbyFeedMainRefreshPending) {
        klevbyFeedMainRefreshPending = false;

        setTimeout(() => {
          forceRenderFeed("pending_after_" + reason, {
            force
          });
        }, 500);
      }
    }
  }

  function scheduleMainFeedRefresh(reason = "scheduled", delay = 300, options = {}) {
    setTimeout(() => {
      forceRenderFeed(reason, {
        force: Boolean(options.force)
      });
    }, Math.max(0, Number(delay || 0)));
  }

  function clearMainResumeTimers() {
    klevbyFeedMainResumeTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedMainResumeTimers = [];
  }

  function runMainResumeBurst(reason = "resume") {
    clearMainResumeTimers();

    const events = getEvents();

    if (typeof events.handleAppResume === "function") {
      try {
        events.handleAppResume(reason);
      } catch (error) {
        console.warn("Klevby feed main: resume events skipped", error);
      }
    }

    if (typeof events.tryStartRealtimeSubscription === "function") {
      try {
        events.tryStartRealtimeSubscription({
          force: true,
          reason
        });
      } catch (error) {
        console.warn("Klevby feed main: realtime resume skipped", error);
      }
    }

    klevbyFeedMainResumeTimers = KLEVB_FEED_MAIN_RESUME_DELAYS.map((delay) => {
      return setTimeout(() => {
        forceRenderFeed(reason + "_main_burst_" + delay, {
          force: true
        });
      }, delay);
    });
  }

  function startMainFeedPolling() {
    if (klevbyFeedMainRefreshTimer) return;

    klevbyFeedMainRefreshTimer = setInterval(() => {
      if (!isPageVisible()) return;
      if (!hasFeedDom()) return;

      forceRenderFeed("main_visible_poll", {
        force: true
      });
    }, KLEVB_FEED_MAIN_POLL_MS);
  }

  function bindMainResumeHooks() {
    if (klevbyFeedMainResumeBound) return;

    klevbyFeedMainResumeBound = true;

    window.addEventListener("klevby-app-resumed", (event) => {
      const reason = String(event?.detail?.reason || "app_resumed");
      runMainResumeBurst(reason);
    });

    if (!window.__klevbyCentralResumeRouter) {
      window.addEventListener("focus", () => {
        runMainResumeBurst("window_focus");
      });

      window.addEventListener("pageshow", () => {
        runMainResumeBurst("page_show");
      });

      window.addEventListener("online", () => {
        runMainResumeBurst("browser_online");
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          runMainResumeBurst("visibility_visible");
        }
      });
    }

    window.addEventListener("klevby-feed-updated", (event) => {
      const action = String(event?.detail?.action || "feed_updated");

      scheduleMainFeedRefresh(action, 180, {
        force: true
      });
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      scheduleMainFeedRefresh("module_ready", 350, {
        force: true
      });
    });
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
    const actions = getActions();

    if (typeof actions.toggleFeedLikeFromCard === "function") {
      return actions.toggleFeedLikeFromCard(postId);
    }

    if (typeof actions.toggleFeedLike === "function") {
      return actions.toggleFeedLike(postId);
    }

    if (typeof window.klevbyToggleFeedLike === "function") {
      return window.klevbyToggleFeedLike(postId)
        .then(() => forceRenderFeed("like_clicked", {
          force: true
        }))
        .catch((error) => {
          console.warn("Klevby feed: лайк не сработал", error);
          alert(error?.message || "Не получилось поставить лайк.");
        });
    }

    alert("Лайки ещё не подключены.");
    return Promise.resolve();
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
        force: true
      });
    };
  }

  function warmUpModules() {
    const utils = getUtils();
    const render = getRender();
    const events = getEvents();

    safeCall(utils.ensureFeedStyles);
    safeCall(render.ensureFeedStyles);

    if (typeof events.bindFeedRefreshHooks === "function") {
      events.bindFeedRefreshHooks();
    }

    if (typeof events.startFeedAutoRefresh === "function") {
      events.startFeedAutoRefresh();
    }

    bindMainResumeHooks();
    startMainFeedPolling();
  }

  function startRealtimeLater() {
    const events = getEvents();

    if (typeof events.tryStartRealtimeSubscription === "function") {
      setTimeout(events.tryStartRealtimeSubscription, 1200);
      setTimeout(events.tryStartRealtimeSubscription, 2600);
      setTimeout(events.tryStartRealtimeSubscription, 5000);
    }
  }

  function renderLater() {
    setTimeout(renderProfileFeed, 350);
    setTimeout(() => forceRenderFeed("initial_main_900", { force: true }), 900);
    setTimeout(() => forceRenderFeed("initial_main_1600", { force: true }), 1600);
    setTimeout(() => forceRenderFeed("initial_main_3200", { force: true }), 3200);
  }

  function initKlevbyFeed() {
    if (window.__klevbyFeedModularStarted) return;

    window.__klevbyFeedModularStarted = true;

    exposeLegacyGlobals();
    warmUpModules();
    renderLater();
    startRealtimeLater();

    window.dispatchEvent(new CustomEvent("klevby-feed-module-ready", {
      detail: {
        version: "20260507-feed-main-hard-polling-1"
      }
    }));

    console.log("Klevby feed main hard polling loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKlevbyFeed);
  } else {
    setTimeout(initKlevbyFeed, 0);
  }

  window.KlevbyFeedMain = {
    init: initKlevbyFeed,
    exposeLegacyGlobals,
    renderProfileFeed,
    refreshFeedIfHomeVisible,
    forceRenderFeed,
    scheduleMainFeedRefresh,
    runMainResumeBurst,
    startMainFeedPolling,
    openKlevbyProfileSafe,
    openProfilePhotoFeedItem,
    openFeedCommentModal,
    closeFeedPhotoViewer,
    closeFeedCommentModal,
    submitFeedComment,
    deleteFeedComment,
    toggleFeedLike
  };
})();
