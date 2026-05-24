(function () {
  function markKlevbyResumeDebug(source, reason, detail = {}) {
    const api = window.KlevbyResumeDebug;
    if (!api || typeof api.mark !== "function") return null;
    try {
      return api.mark(source, reason, detail);
    } catch (error) {
      return null;
    }
  }

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
  let klevbyFeedMainCoalescedRefreshTimer = null;
  let klevbyFeedMainCoalescedRefreshReason = "";
  let klevbyFeedMainCoalescedRefreshForce = false;
  let klevbyFeedMainCoalescedRefreshDueAt = 0;
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
  const KLEVB_FEED_MAIN_COALESCE_MS = 280;



  const KLEVB_FEED_MAIN_DEBUG_EVENTS_LIMIT = 180;

  function createFeedMainDebug() {
    const state = {
      refreshReasons: Object.create(null),
      fullRenderExecutions: 0,
      suppressedReasons: Object.create(null),
      events: []
    };

    const addCount = (bucket, key) => {
      const safeKey = String(key || "unknown");
      bucket[safeKey] = Number(bucket[safeKey] || 0) + 1;
    };

    const cloneCounts = (bucket) => ({ ...bucket });

    const pushEvent = (type, reason, detail = {}) => {
      const payload = {
        at: new Date().toISOString(),
        ts: Date.now(),
        type: String(type || "event"),
        reason: String(reason || ""),
        detail
      };

      state.events.push(payload);

      if (state.events.length > KLEVB_FEED_MAIN_DEBUG_EVENTS_LIMIT) {
        state.events.splice(0, state.events.length - KLEVB_FEED_MAIN_DEBUG_EVENTS_LIMIT);
      }

      return payload;
    };

    return {
      trackRefresh(reason, detail = {}) {
        addCount(state.refreshReasons, reason);
        pushEvent("refresh_request", reason, detail);
      },
      trackRenderExecution(reason, detail = {}) {
        state.fullRenderExecutions += 1;
        pushEvent("full_render_execution", reason, detail);
      },
      trackSuppressed(kind, reason, detail = {}) {
        const key = `${String(kind || "suppressed")}:${String(reason || "")}`;
        addCount(state.suppressedReasons, key);
        pushEvent("suppressed", reason, {
          kind: String(kind || "suppressed"),
          ...detail
        });
      },
      log(type, reason, detail = {}) {
        pushEvent(type, reason, detail);
      },
      summary() {
        return {
          refreshReasons: cloneCounts(state.refreshReasons),
          fullRenderExecutions: state.fullRenderExecutions,
          suppressedReasons: cloneCounts(state.suppressedReasons),
          eventsStored: state.events.length,
          lastEvent: state.events.length ? state.events[state.events.length - 1] : null
        };
      },
      getEvents() {
        return state.events.slice();
      },
      reset() {
        state.refreshReasons = Object.create(null);
        state.fullRenderExecutions = 0;
        state.suppressedReasons = Object.create(null);
        state.events = [];
      }
    };
  }

  const feedMainDebug = window.KlevbyFeedMainDebug || createFeedMainDebug();
  window.KlevbyFeedMainDebug = feedMainDebug;

  function feedMainDebugLog(type, reason, detail = {}) {
    if (!feedMainDebug || typeof feedMainDebug.log !== "function") return;

    try {
      feedMainDebug.log(type, reason, detail);
      console.debug("Klevby feed main debug", {
        type,
        reason,
        ...detail
      });
    } catch (error) {
      return;
    }
  }

  function safeDebugStack(skipLines = 2, maxLines = 5) {
    try {
      const raw = String(new Error().stack || "");
      if (!raw) return null;
      return raw
        .split("\n")
        .slice(Math.max(0, Number(skipLines || 0)))
        .map((line) => String(line || "").trim())
        .filter(Boolean)
        .slice(0, Math.max(1, Number(maxLines || 5)))
        .join(" | ");
    } catch (_) {
      return null;
    }
  }

  function getMainRenderGuardDebugSnapshot(event, reason, extra = {}) {
    const safeDebugBool = (resolver, fallbackValue = false) => {
      try {
        if (typeof resolver === "function") {
          return Boolean(resolver());
        }
      } catch (_) {
        return Boolean(fallbackValue);
      }

      return Boolean(fallbackValue);
    };

    const resolveHomeVisibleSafe = () => {
      if (typeof isHomeSectionVisible === "function") {
        return isHomeSectionVisible();
      }

      const homeSection = document.getElementById("homeSection");
      if (homeSection) {
        return !homeSection.classList.contains("hidden");
      }

      return hasFeedDom();
    };

    const cleanReason = String(reason || "");
    const originalReason = String(extra.originalReason || "");
    return {
      event: String(event || "guard_event"),
      reason: cleanReason,
      originalReason,
      deferred: Boolean(extra.deferred),
      timestamp: new Date().toISOString(),
      nowMs: Date.now(),
      visible: safeDebugBool(() => isPageVisible(), false),
      homeVisible: safeDebugBool(resolveHomeVisibleSafe, false),
      hasFeedDom: safeDebugBool(() => hasFeedDom(), false),
      quietWindowActive: safeDebugBool(() => isFeedQuiet(), false),
      quietUntilMs: Number(klevbyFeedMainQuietUntil || 0),
      caller: String(extra.caller || ""),
      stack: safeDebugStack(3, 6)
    };
  }

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
    const requestedReason = String(reason || "deferred_render");
    feedMainDebugLog("schedule_deferred_render_before", requestedReason, getMainRenderGuardDebugSnapshot(
      "schedule_deferred_render_before",
      requestedReason,
      {
        deferred: true,
        caller: "scheduleDeferredRender"
      }
    ));
    clearDeferredRenderTimer();

    klevbyFeedMainDeferredRenderTimer = setTimeout(() => {
      klevbyFeedMainDeferredRenderTimer = null;

      if (!isPageVisible()) return;
      if (!hasFeedDom()) return;

      if (isFeedQuiet()) {
        const stillQuietReason = requestedReason + "_still_quiet";
        feedMainDebugLog("schedule_deferred_render_after", stillQuietReason, getMainRenderGuardDebugSnapshot(
          "schedule_deferred_render_after",
          stillQuietReason,
          {
            deferred: true,
            originalReason: requestedReason,
            caller: "scheduleDeferredRender:still_quiet"
          }
        ));
        scheduleDeferredRender(stillQuietReason, KLEVB_FEED_MAIN_INTERACTION_DEFER_MS);
        return;
      }

      feedMainDebugLog("schedule_deferred_render_after", requestedReason, getMainRenderGuardDebugSnapshot(
        "schedule_deferred_render_after",
        requestedReason,
        {
          deferred: false,
          caller: "scheduleDeferredRender:timeout_ready"
        }
      ));
      feedMainDebugLog("guard_force_render_before", requestedReason, getMainRenderGuardDebugSnapshot(
        "guard_force_render_before",
        requestedReason,
        {
          deferred: false,
          caller: "scheduleDeferredRender->forceRenderFeed"
        }
      ));
      forceRenderFeed(requestedReason, {
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
      feedMainDebugLog("guarded_external_render", "guarded_external_render", getMainRenderGuardDebugSnapshot(
        "guarded_external_render",
        "guarded_external_render",
        {
          deferred: false,
          caller: "render.renderProfileFeed"
        }
      ));
      if (shouldDeferRender("guarded_external_render", false)) {
        feedMainDebugLog("guarded_external_render_deferred", "guarded_external_render_after_quiet", getMainRenderGuardDebugSnapshot(
          "guarded_external_render_deferred",
          "guarded_external_render_after_quiet",
          {
            deferred: true,
            originalReason: "guarded_external_render",
            caller: "render.renderProfileFeed"
          }
        ));
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
      feedMainDebugLog("guarded_external_refresh", "guarded_external_refresh", getMainRenderGuardDebugSnapshot(
        "guarded_external_refresh",
        "guarded_external_refresh",
        {
          deferred: false,
          caller: "render.refreshFeedIfHomeVisible"
        }
      ));
      if (shouldDeferRender("guarded_external_refresh", false)) {
        feedMainDebugLog("guarded_external_refresh_deferred", "guarded_external_refresh_after_quiet", getMainRenderGuardDebugSnapshot(
          "guarded_external_refresh_deferred",
          "guarded_external_refresh_after_quiet",
          {
            deferred: true,
            originalReason: "guarded_external_refresh",
            caller: "render.refreshFeedIfHomeVisible"
          }
        ));
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
      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("deferred", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "deferred", force });
      return false;
    }

    if (!force && !isPageVisible()) {
      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("page_hidden", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "page_hidden", force });
      return false;
    }

    if (!hasFeedDom()) {
      startFeedDomWatcher();
      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("missing_dom", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "missing_dom", force });
      return false;
    }

    if (!isRenderReady()) {
      startFeedDomWatcher();

      if (force && !hasRecentSuccessfulRender(KLEVB_FEED_MAIN_STARTUP_DUPLICATE_GAP_MS)) {
        scheduleMainFeedRefresh(cleanReason + "_render_wait", 700, {
          force: true
        });
      }

      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("render_not_ready", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "render_not_ready", force });
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

      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("duplicate_skip", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "duplicate_skip", force });
      return false;
    }

    if (!isFreshRefreshAllowed(force)) {
      if (isResumeRefreshReason(cleanReason) || cleanReason.includes("main_burst")) {
        scheduleMainFeedRefresh(cleanReason + "_recently_refreshed", KLEVB_FEED_MAIN_PENDING_AFTER_MS, {
          force: false
        });
      }

      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("min_gap", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "min_gap", force });
      return false;
    }

    if (klevbyFeedMainRefreshInProgress) {
      if (isStartupRefreshReason(cleanReason) || isResumeRefreshReason(cleanReason)) {
        console.debug("Klevby feed main: duplicate refresh skipped", {
          reason: cleanReason
        });
        if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
          feedMainDebug.trackSuppressed("in_progress_critical_skip", cleanReason, { force });
        }
        feedMainDebugLog("suppressed", cleanReason, { kind: "in_progress_critical_skip", force });
        return false;
      }

      klevbyFeedMainRefreshPending = true;
      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("in_progress_pending", cleanReason, { force });
      }
      feedMainDebugLog("suppressed", cleanReason, { kind: "in_progress_pending", force });
      return false;
    }

    klevbyFeedMainRefreshInProgress = true;
    klevbyFeedMainLastRefreshStartedAt = Date.now();

    try {
      if (feedMainDebug && typeof feedMainDebug.trackRenderExecution === "function") {
        feedMainDebug.trackRenderExecution(cleanReason, { force });
      }
      feedMainDebugLog("full_render_execution", cleanReason, { force });
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
    const cleanReason = String(reason || "scheduled");
    const force = Boolean(options.force);
    const nextDueAt = Date.now() + Math.max(safeDelay, KLEVB_FEED_MAIN_COALESCE_MS);

    if (feedMainDebug && typeof feedMainDebug.trackRefresh === "function") {
      try {
        feedMainDebug.trackRefresh(cleanReason, {
          source: "scheduleMainFeedRefresh",
          delay: safeDelay,
          force
        });
      } catch (error) {
        // noop
      }
    }

    feedMainDebugLog("schedule_refresh", cleanReason, {
      delay: safeDelay,
      force
    });

    const runCoalescedRefresh = () => {
      const mergedReason = klevbyFeedMainCoalescedRefreshReason || cleanReason;
      const mergedForce = klevbyFeedMainCoalescedRefreshForce;

      klevbyFeedMainCoalescedRefreshTimer = null;
      klevbyFeedMainCoalescedRefreshReason = "";
      klevbyFeedMainCoalescedRefreshForce = false;
      klevbyFeedMainCoalescedRefreshDueAt = 0;

      forceRenderFeed(mergedReason, {
        force: mergedForce
      });
    };

    if (klevbyFeedMainCoalescedRefreshTimer) {
      klevbyFeedMainCoalescedRefreshForce = klevbyFeedMainCoalescedRefreshForce || force;

      if (klevbyFeedMainCoalescedRefreshReason) {
        if (!klevbyFeedMainCoalescedRefreshReason.includes(cleanReason)) {
          klevbyFeedMainCoalescedRefreshReason += `+${cleanReason}`;
        }
      } else {
        klevbyFeedMainCoalescedRefreshReason = cleanReason;
      }

      if (nextDueAt >= Number(klevbyFeedMainCoalescedRefreshDueAt || 0)) {
        return;
      }

      clearTimeout(klevbyFeedMainCoalescedRefreshTimer);
      klevbyFeedMainCoalescedRefreshTimer = null;
    } else {
      klevbyFeedMainCoalescedRefreshReason = cleanReason;
      klevbyFeedMainCoalescedRefreshForce = force;
    }

    klevbyFeedMainCoalescedRefreshDueAt = nextDueAt;
    klevbyFeedMainCoalescedRefreshTimer = setTimeout(runCoalescedRefresh, Math.max(0, nextDueAt - Date.now()));
  }

  function clearMainResumeTimers() {
    klevbyFeedMainResumeTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedMainResumeTimers = [];
  }

  function runMainResumeBurst(reason = "resume") {
    markKlevbyResumeDebug("feed.main.resume", reason, { phase: "start" });
    const now = Date.now();

    if (now - Number(klevbyFeedMainLastResumeAt || 0) < KLEVB_FEED_MAIN_RESUME_DUPLICATE_GAP_MS) {
      if (feedMainDebug && typeof feedMainDebug.trackSuppressed === "function") {
        feedMainDebug.trackSuppressed("resume_duplicate_gap", reason);
      }
      feedMainDebugLog("suppressed", reason, { kind: "resume_duplicate_gap" });
      return;
    }

    feedMainDebugLog("resume_burst", reason, { phase: "accepted" });

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
      markKlevbyResumeDebug("feed.main.listener", reason, { trigger: "klevby-app-resumed" });
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
      const detail = event?.detail || {};
      const action = String(detail?.action || "feed_updated");

      if (isLikeUpdateAction(action)) {
        markFeedQuiet(action, KLEVB_FEED_MAIN_LIKE_QUIET_MS);
        feedMainDebugLog("quiet_window", action, { duration: KLEVB_FEED_MAIN_LIKE_QUIET_MS });
        return;
      }

      if (action === "feed_comment_changed") {
        feedMainDebugLog("suppressed_event_refresh", action, {
          source: "klevby-feed-updated",
          ownership: "feed-events"
        });
        return;
      }

      if (action === "feed_post_changed") {
        const eventsApi = window.KlevbyFeedEvents || {};
        const isCounterOnly = typeof eventsApi.isCounterOnlyFeedPostChanged === "function"
          ? Boolean(eventsApi.isCounterOnlyFeedPostChanged(detail))
          : false;

        if (isCounterOnly) {
          feedMainDebugLog("suppressed_event_refresh", action, {
            source: "klevby-feed-updated",
            ownership: "feed-events",
            reason: "counter_only"
          });
          return;
        }
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
      feedMainDebugLog("trigger", "auth_changed", { source: "klevby-auth-changed" });
      runMainResumeBurst("auth_changed");
    });

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key.includes("klevby_feed") ||
        key.includes("klevby_profile") ||
        key.includes("sb-")
      ) {
        feedMainDebugLog("trigger", "storage_changed", { key });
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
        feedMainDebugLog("trigger", "navigation_home_click", { section, text });
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
