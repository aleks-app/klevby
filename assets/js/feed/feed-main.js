(function () {
  let klevbyFeedMainRefreshTimer = null;
  let klevbyFeedMainRefreshInProgress = false;
  let klevbyFeedMainRefreshPending = false;
  let klevbyFeedMainResumeBound = false;
  let klevbyFeedMainResumeTimers = [];
  let klevbyFeedMainDomWatchTimer = null;
  let klevbyFeedMainLastRefreshStartedAt = 0;
  let klevbyFeedMainLastRefreshFinishedAt = 0;
  let klevbyFeedMainLastSuccessfulRenderAt = 0;

  const KLEVB_FEED_MAIN_POLL_MS = 30000;
  const KLEVB_FEED_MAIN_MIN_REFRESH_GAP_MS = 1400;
  const KLEVB_FEED_MAIN_DOM_WATCH_MS = 450;
  const KLEVB_FEED_MAIN_DOM_WATCH_LIMIT = 70;

  const KLEVB_FEED_MAIN_INITIAL_DELAYS = [
    0,
    120,
    350,
    800,
    1400,
    2400,
    3800,
    5600,
    8200,
    12000,
    17000,
    23000
  ];

  const KLEVB_FEED_MAIN_RESUME_DELAYS = [
    0,
    250,
    700,
    1400,
    2600,
    4600,
    7600,
    12000
  ];

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

  function isRenderReady() {
    const render = getRender();
    return typeof render.renderProfileFeed === "function";
  }

  function isFreshRefreshAllowed(force) {
    if (force) return true;

    const now = Date.now();
    const lastStartedAt = Number(klevbyFeedMainLastRefreshStartedAt || 0);

    if (!lastStartedAt) return true;

    return now - lastStartedAt >= KLEVB_FEED_MAIN_MIN_REFRESH_GAP_MS;
  }

  function isDuplicateLikeError(error) {
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

    if (list && !list.dataset.klevbyFeedWaitingShown) {
      list.dataset.klevbyFeedWaitingShown = "1";
      list.innerHTML = `
        <div class="home-empty-card">
          <div class="home-empty-icon">📸</div>
          <h3>Лента загружается</h3>
          <p>Модули ленты ещё подключаются. Подожди пару секунд.</p>
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
      startFeedDomWatcher();
      return false;
    }

    if (!isRenderReady()) {
      startFeedDomWatcher();

      if (force) {
        scheduleMainFeedRefresh(reason + "_render_wait", 420, {
          force: true
        });
      }

      return false;
    }

    if (!isFreshRefreshAllowed(force)) {
      return false;
    }

    if (klevbyFeedMainRefreshInProgress) {
      klevbyFeedMainRefreshPending = true;
      return false;
    }

    klevbyFeedMainRefreshInProgress = true;
    klevbyFeedMainLastRefreshStartedAt = Date.now();

    try {
      await Promise.resolve(renderProfileFeed());

      klevbyFeedMainLastRefreshFinishedAt = Date.now();
      klevbyFeedMainLastSuccessfulRenderAt = Date.now();

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
        }, 520);
      }
    }
  }

  function scheduleMainFeedRefresh(reason = "scheduled", delay = 300, options = {}) {
    const safeDelay = Math.max(0, Number(delay || 0));

    setTimeout(() => {
      forceRenderFeed(reason, {
        force: Boolean(options.force)
      });
    }, safeDelay);
  }

  function clearMainResumeTimers() {
    klevbyFeedMainResumeTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedMainResumeTimers = [];
  }

  function runMainResumeBurst(reason = "resume") {
    clearMainResumeTimers();
    startFeedDomWatcher();

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
      if (!hasFeedDom()) {
        startFeedDomWatcher();
        return;
      }

      forceRenderFeed("main_visible_poll", {
        force: false
      });
    }, KLEVB_FEED_MAIN_POLL_MS);
  }

  function stopFeedDomWatcher() {
    if (klevbyFeedMainDomWatchTimer) {
      clearInterval(klevbyFeedMainDomWatchTimer);
      klevbyFeedMainDomWatchTimer = null;
    }
  }

  function startFeedDomWatcher() {
    if (klevbyFeedMainDomWatchTimer) return;

    let attempts = 0;

    klevbyFeedMainDomWatchTimer = setInterval(() => {
      attempts += 1;

      if (attempts > KLEVB_FEED_MAIN_DOM_WATCH_LIMIT) {
        stopFeedDomWatcher();
        return;
      }

      if (!isPageVisible()) return;

      if (hasFeedDom() && isRenderReady()) {
        forceRenderFeed("dom_watch_ready_" + attempts, {
          force: true
        });

        if (klevbyFeedMainLastSuccessfulRenderAt) {
          stopFeedDomWatcher();
        }
      }
    }, KLEVB_FEED_MAIN_DOM_WATCH_MS);
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

      scheduleMainFeedRefresh(action, 160, {
        force: true
      });
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      startFeedDomWatcher();

      scheduleMainFeedRefresh("module_ready_fast", 80, {
        force: true
      });

      scheduleMainFeedRefresh("module_ready_confirm", 650, {
        force: true
      });
    });

    window.addEventListener("klevby-auth-changed", () => {
      runMainResumeBurst("auth_changed");
    });

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key.includes("klevby_feed") ||
        key.includes("klevby_profile") ||
        key.includes("sb-")
      ) {
        scheduleMainFeedRefresh("storage_changed", 260, {
          force: true
        });
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      const element = target && target.closest
        ? target.closest("[data-section], [data-target], .bottom-nav button, .mobile-tabbar button, .tabbar button, .nav-btn")
        : null;

      if (!element) return;

      const text = String(element.textContent || "").toLowerCase();
      const section = String(element.dataset?.section || element.dataset?.target || "").toLowerCase();

      if (
        section.includes("home") ||
        section.includes("feed") ||
        text.includes("лента") ||
        text.includes("главная")
      ) {
        scheduleMainFeedRefresh("navigation_home_click", 180, {
          force: true
        });
      }
    }, true);
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

    if (typeof actions.toggleLikeFromCard === "function") {
      return actions.toggleLikeFromCard(postId);
    }

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
          if (isDuplicateLikeError(error)) {
            return forceRenderFeed("like_duplicate", {
              force: true
            });
          }

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
    startFeedDomWatcher();
  }

  function startRealtimeLater() {
    const events = getEvents();

    if (typeof events.tryStartRealtimeSubscription === "function") {
      setTimeout(() => {
        safeCall(events.tryStartRealtimeSubscription, [{
          force: false,
          reason: "initial_realtime_1200"
        }]);
      }, 1200);

      setTimeout(() => {
        safeCall(events.tryStartRealtimeSubscription, [{
          force: false,
          reason: "initial_realtime_3000"
        }]);
      }, 3000);

      setTimeout(() => {
        safeCall(events.tryStartRealtimeSubscription, [{
          force: false,
          reason: "initial_realtime_6500"
        }]);
      }, 6500);
    }
  }

  function renderLater() {
    KLEVB_FEED_MAIN_INITIAL_DELAYS.forEach((delay) => {
      setTimeout(() => {
        forceRenderFeed("initial_main_" + delay, {
          force: true
        });
      }, delay);
    });
  }

  function initKlevbyFeed() {
    if (window.__klevbyFeedModularStarted) {
      startFeedDomWatcher();
      scheduleMainFeedRefresh("already_started_recheck", 160, {
        force: true
      });
      return;
    }

    window.__klevbyFeedModularStarted = true;

    exposeLegacyGlobals();
    warmUpModules();
    renderLater();
    startRealtimeLater();

    window.dispatchEvent(new CustomEvent("klevby-feed-module-ready", {
      detail: {
        version: "20260509-feed-main-stable-start-1"
      }
    }));

    console.log("Klevby feed main stable starter loaded");
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
    startFeedDomWatcher,
    stopFeedDomWatcher,
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
