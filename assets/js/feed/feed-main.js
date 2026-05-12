(function () {
  let klevbyFeedMainRefreshTimer = null;
  let klevbyFeedMainRefreshInProgress = false;
  let klevbyFeedMainRefreshPending = false;
  let klevbyFeedMainResumeBound = false;
  let klevbyFeedMainResumeTimers = [];
  let klevbyFeedMainInitialTimers = [];
  let klevbyFeedMainDomWatchTimer = null;
  let klevbyFeedMainDeferredRenderTimer = null;
  let klevbyFeedMainRawRenderProfileFeed = null;
  let klevbyFeedMainRawRefreshFeedIfHomeVisible = null;
  let klevbyFeedMainRenderGuardInstalled = false;
  let klevbyFeedMainLastRefreshStartedAt = 0;
  let klevbyFeedMainLastRefreshFinishedAt = 0;
  let klevbyFeedMainLastSuccessfulRenderAt = 0;
  let klevbyFeedMainLastResumeAt = 0;
  let klevbyFeedMainQuietUntil = 0;
  let klevbyFeedMainQuietReason = "";
  let klevbyFeedMainLegacyBridge = null;

  const KLEVB_FEED_MAIN_POLL_MS = 0;
  const KLEVB_FEED_MAIN_MIN_REFRESH_GAP_MS = 2600;
  const KLEVB_FEED_MAIN_STARTUP_DUPLICATE_GAP_MS = 7000;
  const KLEVB_FEED_MAIN_RESUME_DUPLICATE_GAP_MS = 4500;
  const KLEVB_FEED_MAIN_DOM_WATCH_MS = 700;
  const KLEVB_FEED_MAIN_DOM_WATCH_LIMIT = 10;
  const KLEVB_FEED_MAIN_LIKE_QUIET_MS = 2600;
  const KLEVB_FEED_MAIN_INTERACTION_DEFER_MS = 1800;
  const KLEVB_FEED_MAIN_PENDING_AFTER_MS = 1100;

  const KLEVB_FEED_MAIN_INITIAL_DELAYS = [
    0,
    1400
  ];

  const KLEVB_FEED_MAIN_RESUME_DELAYS = [
    0,
    1600
  ];

  const feedMainCore = window.KlevbyFeedMainCore || {};

  const getState = typeof feedMainCore.getState === "function"
    ? feedMainCore.getState
    : function () {
      return window.KlevbyFeedState || {};
    };

  const getUtils = typeof feedMainCore.getUtils === "function"
    ? feedMainCore.getUtils
    : function () {
      return window.KlevbyFeedUtils || {};
    };

  const getApi = typeof feedMainCore.getApi === "function"
    ? feedMainCore.getApi
    : function () {
      return window.KlevbyFeedApi || {};
    };

  const getRender = typeof feedMainCore.getRender === "function"
    ? feedMainCore.getRender
    : function () {
      return window.KlevbyFeedRender || {};
    };

  const getModals = typeof feedMainCore.getModals === "function"
    ? feedMainCore.getModals
    : function () {
      return window.KlevbyFeedModals || {};
    };

  const getActions = typeof feedMainCore.getActions === "function"
    ? feedMainCore.getActions
    : function () {
      return window.KlevbyFeedActions || {};
    };

  const getEvents = typeof feedMainCore.getEvents === "function"
    ? feedMainCore.getEvents
    : function () {
      return window.KlevbyFeedEvents || {};
    };

  const safeCall = typeof feedMainCore.safeCall === "function"
    ? feedMainCore.safeCall
    : function (fn, args = [], fallbackValue = undefined) {
      try {
        if (typeof fn === "function") {
          return fn.apply(null, args);
        }
      } catch (error) {
        console.warn("Klevby feed: ошибка вызова функции", error);
      }

      return fallbackValue;
    };

  const isPageVisible = typeof feedMainCore.isPageVisible === "function"
    ? feedMainCore.isPageVisible
    : function () {
      return document.visibilityState !== "hidden";
    };

  const hasFeedDom = typeof feedMainCore.hasFeedDom === "function"
    ? feedMainCore.hasFeedDom
    : function () {
      return Boolean(document.getElementById("profileFeedSection"));
    };

  const isLikeUpdateAction = typeof feedMainCore.isLikeUpdateAction === "function"
    ? feedMainCore.isLikeUpdateAction
    : function (action) {
      const value = String(action || "").toLowerCase();

      return value.includes("like") || value.includes("лайк");
    };

  const isStartupRefreshReason = typeof feedMainCore.isStartupRefreshReason === "function"
    ? feedMainCore.isStartupRefreshReason
    : function (reason) {
      const value = String(reason || "").toLowerCase();

      return (
        value.includes("initial") ||
        value.includes("module_ready") ||
        value.includes("dom_watch") ||
        value.includes("already_started") ||
        value.includes("render_wait")
      );
    };

  const isResumeRefreshReason = typeof feedMainCore.isResumeRefreshReason === "function"
    ? feedMainCore.isResumeRefreshReason
    : function (reason) {
      const value = String(reason || "").toLowerCase();

      return (
        value.includes("resume") ||
        value.includes("app_resumed") ||
        value.includes("visibility_visible") ||
        value.includes("page_show") ||
        value.includes("window_focus") ||
        value.includes("browser_online") ||
        value.includes("auth_changed")
      );
    };

  const isManualRefreshReason = typeof feedMainCore.isManualRefreshReason === "function"
    ? feedMainCore.isManualRefreshReason
    : function (reason) {
      const value = String(reason || "").toLowerCase();

      return (
        value.includes("manual") ||
        value.includes("wake") ||
        value.includes("navigation_home")
      );
    };

  const isCriticalRefreshReason = typeof feedMainCore.isCriticalRefreshReason === "function"
    ? feedMainCore.isCriticalRefreshReason
    : function (reason) {
      return (
        isManualRefreshReason(reason) ||
        isStartupRefreshReason(reason) ||
        isResumeRefreshReason(reason)
      );
    };

  const isDuplicateLikeError = typeof feedMainCore.isDuplicateLikeError === "function"
    ? feedMainCore.isDuplicateLikeError
    : function (error) {
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
    };

  function markFeedQuiet(reason = "quiet", duration = KLEVB_FEED_MAIN_LIKE_QUIET_MS) {
    const until = Date.now() + Math.max(0, Number(duration || 0));

    klevbyFeedMainQuietUntil = Math.max(klevbyFeedMainQuietUntil, until);
    klevbyFeedMainQuietReason = String(reason || "quiet");
  }

  function isFeedQuiet() {
    return Date.now() < Number(klevbyFeedMainQuietUntil || 0);
  }

  function hasRecentSuccessfulRender(duration) {
    const lastSuccessfulAt = Number(klevbyFeedMainLastSuccessfulRenderAt || 0);

    if (!lastSuccessfulAt) return false;

    return Date.now() - lastSuccessfulAt < Math.max(0, Number(duration || 0));
  }

  function shouldSkipDuplicateRender(reason = "", force = false) {
    const cleanReason = String(reason || "");

    if (isManualRefreshReason(cleanReason)) {
      return false;
    }

    if (isStartupRefreshReason(cleanReason)) {
      return hasRecentSuccessfulRender(KLEVB_FEED_MAIN_STARTUP_DUPLICATE_GAP_MS);
    }

    if (isResumeRefreshReason(cleanReason)) {
      return hasRecentSuccessfulRender(KLEVB_FEED_MAIN_RESUME_DUPLICATE_GAP_MS);
    }

    if (!force) {
      return false;
    }

    return hasRecentSuccessfulRender(KLEVB_FEED_MAIN_MIN_REFRESH_GAP_MS);
  }

  function shouldDeferRender(reason = "", force = false) {
    if (force && isCriticalRefreshReason(reason)) {
      return false;
    }

    if (isLikeUpdateAction(reason)) {
      return true;
    }

    if (isFeedQuiet() && !isCriticalRefreshReason(reason)) {
      return true;
    }

    return false;
  }

  function clearDeferredRenderTimer() {
    if (klevbyFeedMainDeferredRenderTimer) {
      clearTimeout(klevbyFeedMainDeferredRenderTimer);
      klevbyFeedMainDeferredRenderTimer = null;
    }
  }

  function scheduleDeferredRender(reason = "deferred_render", delay = KLEVB_FEED_MAIN_INTERACTION_DEFER_MS) {
    clearDeferredRenderTimer();

    klevbyFeedMainDeferredRenderTimer = setTimeout(() => {
      klevbyFeedMainDeferredRenderTimer = null;

      if (!isPageVisible()) return;
      if (!hasFeedDom()) return;

      if (isFeedQuiet()) {
        scheduleDeferredRender(reason + "_still_quiet", KLEVB_FEED_MAIN_INTERACTION_DEFER_MS);
        return;
      }

      forceRenderFeed(reason, {
        force: false
      });
    }, Math.max(0, Number(delay || 0)));
  }

  function getRawRenderProfileFeed() {
    const render = getRender();

    if (typeof klevbyFeedMainRawRenderProfileFeed === "function") {
      return klevbyFeedMainRawRenderProfileFeed;
    }

    if (typeof render.renderProfileFeed === "function") {
      return render.renderProfileFeed;
    }

    return null;
  }

  function installRenderGuard() {
    const render = getRender();

    if (!render || typeof render.renderProfileFeed !== "function") {
      return false;
    }

    if (klevbyFeedMainRenderGuardInstalled && typeof klevbyFeedMainRawRenderProfileFeed === "function") {
      return true;
    }

    if (render.renderProfileFeed.__klevbyFeedMainGuarded) {
      klevbyFeedMainRenderGuardInstalled = true;
      return true;
    }

    klevbyFeedMainRawRenderProfileFeed = render.renderProfileFeed.bind(render);

    if (typeof render.refreshFeedIfHomeVisible === "function") {
      klevbyFeedMainRawRefreshFeedIfHomeVisible = render.refreshFeedIfHomeVisible.bind(render);
    }

    render.renderProfileFeed = function klevbyFeedMainGuardedRenderProfileFeed() {
      if (shouldDeferRender("guarded_external_render", false)) {
        scheduleDeferredRender("guarded_external_render_after_quiet");
        return Promise.resolve(false);
      }

      if (shouldSkipDuplicateRender("guarded_external_render", false)) {
        return Promise.resolve(false);
      }

      return forceRenderFeed("guarded_external_render", {
        force: false
      });
    };

    render.renderProfileFeed.__klevbyFeedMainGuarded = true;

    render.refreshFeedIfHomeVisible = function klevbyFeedMainGuardedRefreshFeedIfHomeVisible() {
      if (shouldDeferRender("guarded_external_refresh", false)) {
        scheduleDeferredRender("guarded_external_refresh_after_quiet");
        return Promise.resolve(false);
      }

      return forceRenderFeed("guarded_refresh_home_visible", {
        force: false
      });
    };

    render.refreshFeedIfHomeVisible.__klevbyFeedMainGuarded = true;

    klevbyFeedMainRenderGuardInstalled = true;

    return true;
  }

  function isRenderReady() {
    installRenderGuard();

    return typeof getRawRenderProfileFeed() === "function";
  }

  function isFreshRefreshAllowed(force) {
    if (force) return true;

    const now = Date.now();
    const lastStartedAt = Number(klevbyFeedMainLastRefreshStartedAt || 0);

    if (!lastStartedAt) return true;

    return now - lastStartedAt >= KLEVB_FEED_MAIN_MIN_REFRESH_GAP_MS;
  }

  function shouldStartDomWatcher() {
    if (klevbyFeedMainDomWatchTimer) return false;
    if (hasRecentSuccessfulRender(KLEVB_FEED_MAIN_STARTUP_DUPLICATE_GAP_MS)) return false;

    return !hasFeedDom() || !isRenderReady();
  }

  function renderProfileFeed() {
    const rawRenderProfileFeed = getRawRenderProfileFeed();

    if (typeof rawRenderProfileFeed === "function") {
      return rawRenderProfileFeed();
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

    return Promise.resolve(false);
  }

  function refreshFeedIfHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      return forceRenderFeed("home_visible_refresh", {
        force: false
      });
    }

    if (hasFeedDom()) {
      return forceRenderFeed("feed_dom_refresh", {
        force: false
      });
    }

    return Promise.resolve(false);
  }

  function clearInitialRenderTimers() {
    klevbyFeedMainInitialTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedMainInitialTimers = [];
  }

  async function forceRenderFeed(reason = "manual", options = {}) {
    const force = Boolean(options.force);
    const cleanReason = String(reason || "manual");

    installRenderGuard();

    if (shouldDeferRender(cleanReason, force)) {
      scheduleDeferredRender(cleanReason + "_deferred");
      return false;
    }

    if (!force && !isPageVisible()) {
      return false;
    }

    if (!hasFeedDom()) {
      startFeedDomWatcher();
      return false;
    }

    if (!isRenderReady()) {
      startFeedDomWatcher();

      if (force && !hasRecentSuccessfulRender(KLEVB_FEED_MAIN_STARTUP_DUPLICATE_GAP_MS)) {
        scheduleMainFeedRefresh(cleanReason + "_render_wait", 700, {
          force: true
        });
      }

      return false;
    }

    if (shouldSkipDuplicateRender(cleanReason, force)) {
      if (isStartupRefreshReason(cleanReason)) {
        clearInitialRenderTimers();
        stopFeedDomWatcher();
      }

      if (isResumeRefreshReason(cleanReason)) {
        clearMainResumeTimers();
      }

      return false;
    }

    if (!isFreshRefreshAllowed(force)) {
      return false;
    }

    if (klevbyFeedMainRefreshInProgress) {
      if (isStartupRefreshReason(cleanReason) || isResumeRefreshReason(cleanReason)) {
        return false;
      }

      klevbyFeedMainRefreshPending = true;
      return false;
    }

    klevbyFeedMainRefreshInProgress = true;
    klevbyFeedMainLastRefreshStartedAt = Date.now();

    try {
      await Promise.resolve(renderProfileFeed());

      klevbyFeedMainLastRefreshFinishedAt = Date.now();
      klevbyFeedMainLastSuccessfulRenderAt = Date.now();

      if (isStartupRefreshReason(cleanReason)) {
        clearInitialRenderTimers();
        stopFeedDomWatcher();
      }

      if (isResumeRefreshReason(cleanReason) || cleanReason.includes("main_burst")) {
        clearMainResumeTimers();
        stopFeedDomWatcher();
      }

      window.dispatchEvent(new CustomEvent("klevby-feed-main-refreshed", {
        detail: {
          reason: cleanReason,
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
          forceRenderFeed("pending_after_" + cleanReason, {
            force
          });
        }, KLEVB_FEED_MAIN_PENDING_AFTER_MS);
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
    const now = Date.now();

    if (now - Number(klevbyFeedMainLastResumeAt || 0) < KLEVB_FEED_MAIN_RESUME_DUPLICATE_GAP_MS) {
      return;
    }

    klevbyFeedMainLastResumeAt = now;

    clearMainResumeTimers();
    clearDeferredRenderTimer();

    const events = getEvents();

    if (typeof events.tryStartRealtimeSubscription === "function") {
      try {
        events.tryStartRealtimeSubscription({
          force: false,
          reason
        });
      } catch (error) {
        console.warn("Klevby feed main: realtime resume skipped", error);
      }
    }

    klevbyFeedMainResumeTimers = KLEVB_FEED_MAIN_RESUME_DELAYS.map((delay) => {
      return setTimeout(() => {
        forceRenderFeed(reason + "_main_burst_" + delay, {
          force: delay === 0
        });
      }, delay);
    });
  }

  function startMainFeedPolling() {
    if (KLEVB_FEED_MAIN_POLL_MS <= 0) {
      return;
    }

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
    if (!shouldStartDomWatcher()) return;

    let attempts = 0;

    klevbyFeedMainDomWatchTimer = setInterval(() => {
      attempts += 1;

      if (attempts > KLEVB_FEED_MAIN_DOM_WATCH_LIMIT) {
        stopFeedDomWatcher();
        return;
      }

      if (!isPageVisible()) return;

      if (klevbyFeedMainLastSuccessfulRenderAt) {
        stopFeedDomWatcher();
        return;
      }

      if (hasFeedDom() && isRenderReady()) {
        forceRenderFeed("dom_watch_ready_" + attempts, {
          force: true
        });
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

      if (isLikeUpdateAction(action)) {
        markFeedQuiet(action, KLEVB_FEED_MAIN_LIKE_QUIET_MS);
        return;
      }

      scheduleMainFeedRefresh(action, 900, {
        force: false
      });
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      installRenderGuard();

      if (shouldStartDomWatcher()) {
        startFeedDomWatcher();
      }

      scheduleMainFeedRefresh("module_ready_fast", 180, {
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
        scheduleMainFeedRefresh("storage_changed", 700, {
          force: false
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
        scheduleMainFeedRefresh("navigation_home_click", 320, {
          force: true
        });
      }
    }, true);
  }

  function getLegacyBridge() {
    if (klevbyFeedMainLegacyBridge) {
      return klevbyFeedMainLegacyBridge;
    }

    const legacyModule = window.KlevbyFeedMainLegacy || {};

    if (typeof legacyModule.createBridge === "function") {
      klevbyFeedMainLegacyBridge = legacyModule.createBridge({
        getRender,
        getUtils,
        getModals,
        getActions,
        markFeedQuiet,
        forceRenderFeed,
        runMainResumeBurst,
        renderProfileFeed,
        isDuplicateLikeError,
        likeQuietMs: KLEVB_FEED_MAIN_LIKE_QUIET_MS
      }) || {};
    } else {
      klevbyFeedMainLegacyBridge = {};
      console.warn("Klevby feed main: legacy bridge module not found");
    }

    return klevbyFeedMainLegacyBridge;
  }

  function exposeLegacyGlobals() {
    const legacy = getLegacyBridge();

    if (typeof legacy.exposeLegacyGlobals === "function") {
      return legacy.exposeLegacyGlobals();
    }

    window.renderProfileFeed = renderProfileFeed;

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

    return false;
  }

  function openKlevbyProfileSafe() {
    const legacy = getLegacyBridge();

    if (typeof legacy.openKlevbyProfileSafe === "function") {
      return legacy.openKlevbyProfileSafe();
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

  function openProfilePhotoFeedItem(postId) {
    const legacy = getLegacyBridge();

    if (typeof legacy.openProfilePhotoFeedItem === "function") {
      return legacy.openProfilePhotoFeedItem(postId);
    }

    return openKlevbyProfileSafe();
  }

  function closeFeedPhotoViewer() {
    const legacy = getLegacyBridge();

    if (typeof legacy.closeFeedPhotoViewer === "function") {
      return legacy.closeFeedPhotoViewer();
    }

    return undefined;
  }

  function openFeedCommentModal(postId) {
    const legacy = getLegacyBridge();

    if (typeof legacy.openFeedCommentModal === "function") {
      return legacy.openFeedCommentModal(postId);
    }

    alert("Комментарии ещё загружаются. Обнови страницу и попробуй ещё раз.");
    return undefined;
  }

  function closeFeedCommentModal() {
    const legacy = getLegacyBridge();

    if (typeof legacy.closeFeedCommentModal === "function") {
      return legacy.closeFeedCommentModal();
    }

    return undefined;
  }

  function submitFeedComment() {
    const legacy = getLegacyBridge();

    if (typeof legacy.submitFeedComment === "function") {
      return legacy.submitFeedComment();
    }

    alert("Отправка комментариев ещё не подключена.");
    return Promise.resolve();
  }

  function deleteFeedComment(commentId) {
    const legacy = getLegacyBridge();

    if (typeof legacy.deleteFeedComment === "function") {
      return legacy.deleteFeedComment(commentId);
    }

    alert("Удаление комментариев ещё не подключено.");
    return Promise.resolve();
  }

  function toggleFeedLike(postId) {
    const legacy = getLegacyBridge();

    if (typeof legacy.toggleFeedLike === "function") {
      return legacy.toggleFeedLike(postId);
    }

    alert("Лайки ещё не подключены.");
    return Promise.resolve(false);
  }

  function warmUpModules() {
    const utils = getUtils();
    const render = getRender();
    const events = getEvents();

    safeCall(utils.ensureFeedStyles);
    safeCall(render.ensureFeedStyles);

    installRenderGuard();

    if (typeof events.bindFeedRefreshHooks === "function") {
      events.bindFeedRefreshHooks();
    }

    bindMainResumeHooks();
    startMainFeedPolling();

    if (shouldStartDomWatcher()) {
      startFeedDomWatcher();
    }
  }

  function startRealtimeLater() {
    const events = getEvents();

    if (typeof events.tryStartRealtimeSubscription === "function") {
      setTimeout(() => {
        safeCall(events.tryStartRealtimeSubscription, [{
          force: false,
          reason: "initial_realtime_1500"
        }]);
      }, 1500);

      setTimeout(() => {
        safeCall(events.tryStartRealtimeSubscription, [{
          force: false,
          reason: "initial_realtime_6000"
        }]);
      }, 6000);
    }
  }

  function renderLater() {
    clearInitialRenderTimers();

    klevbyFeedMainInitialTimers = KLEVB_FEED_MAIN_INITIAL_DELAYS.map((delay) => {
      return setTimeout(() => {
        forceRenderFeed("initial_main_" + delay, {
          force: delay === 0
        });
      }, delay);
    });
  }

  function initKlevbyFeed() {
    if (window.__klevbyFeedModularStarted) {
      installRenderGuard();

      if (shouldStartDomWatcher()) {
        startFeedDomWatcher();
      }

      scheduleMainFeedRefresh("already_started_recheck", 420, {
        force: false
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
        version: "20260512-feed-main-legacy-split-1"
      }
    }));

    console.log("Klevby feed main light desktop starter loaded");
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
    markFeedQuiet,
    getLegacyBridge,
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
