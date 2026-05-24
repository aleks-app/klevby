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

  const KLEVB_FEED_VISIBLE_REFRESH_MS = 4000;
  const KLEVB_FEED_HIDDEN_REFRESH_MS = 30000;
  const KLEVB_FEED_DEBOUNCE_MS = 450;
  const KLEVB_FEED_RESUME_DELAYS = [0, 600, 1800, 4200, 8000];

  const KLEVB_RT_COUNTER_HYDRATE_DEDUP_MS = 1200;
  const klevbyRealtimeCounterHydrationMap = new Map();

  const KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS = 4500;
  const klevbyTargetedLikeSuccessMap = new Map();


  let klevbyFeedRefreshTimer = null;
  let klevbyFeedIntervalTimer = null;
  let klevbyFeedHiddenIntervalTimer = null;
  let klevbyFeedRefreshInProgress = false;
  let klevbyFeedRefreshPending = false;
  let klevbyFeedHooksBound = false;
  let klevbyFeedRealtimeStarted = false;
  let klevbyFeedResumeTimers = [];
  let klevbyFeedLastRenderAt = 0;

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getModals() {
    return window.KlevbyFeedModals || {};
  }

  function getRealtimeApi() {
    return window.klevbyFeedSupabase || getApi() || {};
  }

  function isHomeFeedVisible() {
    const homeSection = document.getElementById("homeSection");
    const feedSection = document.getElementById("profileFeedSection");

    return Boolean(
      homeSection &&
      feedSection &&
      !homeSection.classList.contains("hidden")
    );
  }

  function isPageVisible() {
    return document.visibilityState !== "hidden";
  }

  function renderFeed() {
    const render = getRender();

    if (typeof render.renderProfileFeed === "function") {
      return render.renderProfileFeed();
    }

    if (typeof window.renderProfileFeed === "function") {
      return window.renderProfileFeed();
    }

    return Promise.resolve();
  }

  async function refreshFeedNow(reason = "manual", options = {}) {
    const force = Boolean(options.force);

    if (!force && !isPageVisible()) {
      return false;
    }

    if (!force && !isHomeFeedVisible()) {
      return false;
    }

    if (!document.getElementById("profileFeedSection")) {
      return false;
    }

    if (klevbyFeedRefreshInProgress) {
      klevbyFeedRefreshPending = true;
      return false;
    }

    klevbyFeedRefreshInProgress = true;

    try {
      await Promise.resolve(renderFeed());

      klevbyFeedLastRenderAt = Date.now();

      window.dispatchEvent(new CustomEvent("klevby-feed-silent-refresh-done", {
        detail: {
          reason,
          at: new Date().toISOString()
        }
      }));

      return true;
    } catch (error) {
      console.warn("Klevby feed: тихое обновление ленты не сработало", error);
      return false;
    } finally {
      klevbyFeedRefreshInProgress = false;

      if (klevbyFeedRefreshPending) {
        klevbyFeedRefreshPending = false;
        queueFeedRefresh("pending_after_" + reason, 650, {
          force
        });
      }
    }
  }

  function queueFeedRefresh(reason = "queued", delay = KLEVB_FEED_DEBOUNCE_MS, options = {}) {
    clearTimeout(klevbyFeedRefreshTimer);

    klevbyFeedRefreshTimer = setTimeout(() => {
      refreshFeedNow(reason, {
        force: Boolean(options.force)
      });
    }, Math.max(0, Number(delay || 0)));
  }

  function refreshFeedIfHomeVisible(options = {}) {
    return refreshFeedNow(options.reason || "refresh_home_visible", {
      force: Boolean(options.force)
    });
  }

  function loadCommentsIntoActiveModal() {
    const modals = getModals();
    const modal = document.getElementById("klevbyFeedCommentModal");
    const postId = String(modal?.dataset?.postId || "");

    if (!modal || modal.classList.contains("hidden") || !postId) {
      return Promise.resolve();
    }

    if (typeof modals.loadCommentsIntoModal === "function") {
      return modals.loadCommentsIntoModal(postId);
    }

    if (typeof window.loadFeedCommentsIntoModal === "function") {
      return window.loadFeedCommentsIntoModal(postId);
    }

    return Promise.resolve();
  }

  function queueCommentsRefresh(delay = 250) {
    setTimeout(() => {
      loadCommentsIntoActiveModal().catch((error) => {
        console.warn("Klevby feed: комментарии не обновились", error);
      });
    }, Math.max(0, Number(delay || 0)));
  }


  function hasOwn(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function pickCounterValue(detail, payload, primaryKey, fallbackKeys = []) {
    if (hasOwn(detail, primaryKey)) {
      return detail[primaryKey];
    }

    for (const key of fallbackKeys) {
      if (hasOwn(detail, key)) {
        return detail[key];
      }
    }

    if (payload && payload.new) {
      if (hasOwn(payload.new, primaryKey)) {
        return payload.new[primaryKey];
      }

      for (const key of fallbackKeys) {
        if (hasOwn(payload.new, key)) {
          return payload.new[key];
        }
      }
    }

    return undefined;
  }

  function makeRealtimeCounters(detail = {}) {
    const payload = detail?.payload || null;

    const likesCount = pickCounterValue(detail, payload, "likesCount", ["likes_count"]);
    const commentsCount = pickCounterValue(detail, payload, "commentsCount", ["comments_count"]);
    const liked = pickCounterValue(detail, payload, "liked", []);

    const counters = {};

    if (likesCount !== undefined) {
      counters.likesCount = likesCount;
    }

    if (commentsCount !== undefined) {
      counters.commentsCount = commentsCount;
    }

    if (typeof liked === "boolean") {
      counters.liked = liked;
    }

    return counters;
  }



  function getKnownViewerUserIdSync() {
    const fromWindow =
      window.currentUser?.id ||
      window.klevbyCurrentUser?.id ||
      window.klevbyUser?.id ||
      "";

    if (fromWindow) {
      return String(fromWindow).trim();
    }

    try {
      return String(localStorage.getItem("klevby_feed_last_like_user_id") || "").trim();
    } catch (error) {
      return "";
    }
  }

  function resolveOwnLikeEventState(detail = {}) {
    const payload = detail?.payload || detail || {};
    const action = String(detail?.action || "");

    if (action && action !== "feed_like_changed") {
      return {
        safe: false,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    const viewerUserId = getKnownViewerUserIdSync();
    const actorUserId = String(
      payload?.new?.user_id ||
      payload?.old?.user_id ||
      ""
    ).trim();
    const eventType = String(payload?.eventType || payload?.event_type || "").toUpperCase();

    if (!viewerUserId || !actorUserId || !eventType) {
      return {
        safe: false,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    if (actorUserId !== viewerUserId) {
      return {
        safe: true,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    if (eventType === "INSERT") {
      return {
        safe: true,
        isOwnLikeEvent: true,
        liked: true
      };
    }

    if (eventType === "DELETE") {
      return {
        safe: true,
        isOwnLikeEvent: true,
        liked: false
      };
    }

    return {
      safe: false,
      isOwnLikeEvent: true,
      liked: null
    };
  }

  function resolveFeedCountersUpdater() {
    const render = getRender();

    if (render && typeof render.updateFeedCardCounters === "function") {
      return render.updateFeedCardCounters;
    }

    if (window.KlevbyFeedRender && typeof window.KlevbyFeedRender.updateFeedCardCounters === "function") {
      return window.KlevbyFeedRender.updateFeedCardCounters;
    }

    return null;
  }

  function resolveRealtimePostId(detail = {}) {
    return String(
      detail?.postId ||
      detail?.payload?.postId ||
      detail?.payload?.new?.post_id ||
      detail?.payload?.old?.post_id ||
      detail?.payload?.new?.id ||
      detail?.payload?.old?.id ||
      ""
    ).trim();
  }

  function isCounterOnlyFeedPostChanged(detail = {}) {
    const action = String(detail?.action || detail?.type || "").trim();

    if (action !== "feed_post_changed") {
      return false;
    }

    const payload = detail?.payload || {};
    const eventType = String(payload?.eventType || payload?.event_type || "").toUpperCase();

    if (eventType !== "UPDATE") {
      return false;
    }

    const postId = resolveRealtimePostId(detail);

    if (!postId) {
      return false;
    }

    if (!payload?.new || !hasOwn(payload.new, "likes_count") || !hasOwn(payload.new, "comments_count")) {
      return false;
    }

    const nextRow = payload.new;
    const prevRow = payload.old;

    if (prevRow && typeof prevRow === "object") {
      const allowedChangedFields = new Set(["likes_count", "comments_count", "updated_at"]);
      const keys = new Set([...Object.keys(nextRow || {}), ...Object.keys(prevRow || {})]);

      for (const key of keys) {
        const before = prevRow?.[key];
        const after = nextRow?.[key];

        if (before === after) {
          continue;
        }

        if (!allowedChangedFields.has(key)) {
          return false;
        }
      }
    }

    return true;
  }

  async function hydrateRealtimeFeedCardCounters(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return null;
    }

    const now = Date.now();
    const existing = klevbyRealtimeCounterHydrationMap.get(cleanPostId);

    if (existing && existing.promise && now - existing.startedAt <= KLEVB_RT_COUNTER_HYDRATE_DEDUP_MS) {
      return existing.promise;
    }

    const promise = (async () => {
      const countsApi = window.KlevbyFeedSupabaseCounts || null;
      const coreApi = window.KlevbyFeedSupabaseCore || null;

      if (!countsApi || typeof countsApi.getPostCounters !== "function") {
        return null;
      }

      const db = coreApi && typeof coreApi.getClient === "function"
        ? coreApi.getClient()
        : null;

      const counters = await countsApi.getPostCounters(db, cleanPostId);

      if (!counters) {
        return null;
      }

      return {
        likesCount: Number(counters.likesCount || 0),
        commentsCount: Number(counters.commentsCount || 0)
      };
    })();

    klevbyRealtimeCounterHydrationMap.set(cleanPostId, {
      startedAt: now,
      promise
    });

    const cleanup = () => {
      const active = klevbyRealtimeCounterHydrationMap.get(cleanPostId);

      if (active && active.promise === promise) {
        klevbyRealtimeCounterHydrationMap.delete(cleanPostId);
      }
    };

    promise.then(cleanup, cleanup);

    return promise;
  }

  function tryUpdateRealtimeFeedCardCounters(detail = {}) {
    const action = String(detail?.action || "");

    if (
      action !== "feed_like_changed" &&
      action !== "feed_comment_changed" &&
      !(action === "feed_post_changed" && isCounterOnlyFeedPostChanged(detail))
    ) {
      return false;
    }

    const postId = resolveRealtimePostId(detail);

    if (!postId) {
      return false;
    }

    const counters = makeRealtimeCounters(detail);

    if (!Object.keys(counters).length) {
      return false;
    }

    const updateFn = resolveFeedCountersUpdater();

    if (!updateFn) {
      return false;
    }

    try {
      const updated = Boolean(updateFn(postId, counters));
      const isCounterOnlyPostAction =
        action === "feed_post_changed" &&
        isCounterOnlyFeedPostChanged(detail);
      const hasLikeCounterInCounters = Object.prototype.hasOwnProperty.call(counters, "likesCount");
      const payload = detail?.payload || {};
      const payloadShowsLikesCounterChange =
        payload?.new &&
        payload?.old &&
        Object.prototype.hasOwnProperty.call(payload.new, "likes_count") &&
        Object.prototype.hasOwnProperty.call(payload.old, "likes_count") &&
        payload.new.likes_count !== payload.old.likes_count;

      if (
        updated &&
        (
          action === "feed_like_changed" ||
          (isCounterOnlyPostAction && (hasLikeCounterInCounters || payloadShowsLikesCounterChange))
        )
      ) {
        markTargetedLikeCounterUpdateSuccess(postId);
      }

      return updated;
    } catch (error) {
      return false;
    }
  }


  function markTargetedLikeCounterUpdateSuccess(postId, ttlMs = KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    klevbyTargetedLikeSuccessMap.set(cleanPostId, Date.now() + Math.max(500, Number(ttlMs || KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS)));
    return true;
  }

  function hasRecentTargetedLikeCounterUpdate(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const expiresAt = Number(klevbyTargetedLikeSuccessMap.get(cleanPostId) || 0);

    if (!expiresAt) {
      return false;
    }

    if (Date.now() > expiresAt) {
      klevbyTargetedLikeSuccessMap.delete(cleanPostId);
      return false;
    }

    return true;
  }

  function closeOpenFeedWindows() {
    const modals = getModals();

    if (typeof modals.closeFeedPhotoViewer === "function") {
      modals.closeFeedPhotoViewer();
    } else if (typeof window.closeFeedPhotoViewer === "function") {
      window.closeFeedPhotoViewer();
    }

    if (typeof modals.closeFeedCommentModal === "function") {
      modals.closeFeedCommentModal();
    } else if (typeof window.closeFeedCommentModal === "function") {
      window.closeFeedCommentModal();
    }
  }

  function clearResumeTimers() {
    klevbyFeedResumeTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedResumeTimers = [];
  }

  function handleAppResume(reason = "resume") {
    markKlevbyResumeDebug("feed.events.resume", reason, { phase: "start" });
    clearResumeTimers();

    tryStartRealtimeSubscription();

    klevbyFeedResumeTimers = KLEVB_FEED_RESUME_DELAYS.map((delay) => {
      return setTimeout(() => {
        const burstReason = reason + "_burst_" + delay;
        markKlevbyResumeDebug("feed.events.resume", burstReason, { phase: "burst_fire", delay });
        queueFeedRefresh(burstReason, 0, {
          force: true
        });

        queueCommentsRefresh(180);
      }, delay);
    });
  }

  function bindFeedRefreshHooks() {
    if (klevbyFeedHooksBound || window.__klevbyFeedRefreshBoundV2) return;

    klevbyFeedHooksBound = true;
    window.__klevbyFeedRefreshBoundV2 = true;

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === "klevby_profile_photos" ||
        key === "klevby_profile_avatar" ||
        key === "klevby_profile_settings" ||
        key === "klevby_profile_name"
      ) {
        queueFeedRefresh("storage_" + key, 80, {
          force: true
        });
      }
    });

    window.addEventListener("klevby-app-resumed", (event) => {
      const reason = String(event?.detail?.reason || "app_resumed");
      handleAppResume(reason);
      restartFeedAutoRefresh();
    });

    if (!window.__klevbyCentralResumeRouter) {
      window.addEventListener("pageshow", () => {
        handleAppResume("pageshow");
      });

      window.addEventListener("focus", () => {
        handleAppResume("focus");
      });

      window.addEventListener("online", () => {
        handleAppResume("online");
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          handleAppResume("visibility_visible");
          restartFeedAutoRefresh();
        } else {
          startHiddenWakeRefresh();
        }
      });
    } else {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          startHiddenWakeRefresh();
        }
      });
    }

    window.addEventListener("klevby-auth-changed", () => {
      queueFeedRefresh("auth_changed", 120, {
        force: true
      });
    });

    window.addEventListener("klevby-feed-updated", async (event) => {
      const action = String(event?.detail?.action || "feed_updated");
      const detail = event?.detail || {};
      let cardCountersUpdated = tryUpdateRealtimeFeedCardCounters(detail);

      if (!cardCountersUpdated && action === "feed_like_changed") {
        const postId = String(
          detail?.postId ||
          detail?.payload?.postId ||
          detail?.payload?.new?.post_id ||
          detail?.payload?.old?.post_id ||
          ""
        ).trim();

        if (postId) {
          try {
            const hydratedCounters = await hydrateRealtimeFeedCardCounters(postId);
            const updateFn = resolveFeedCountersUpdater();

            if (hydratedCounters && updateFn) {
              const ownLikeState = resolveOwnLikeEventState(detail);

              if (!ownLikeState.safe) {
                cardCountersUpdated = false;
              } else {
                const nextCounters = {
                  ...hydratedCounters
                };

                if (ownLikeState.isOwnLikeEvent) {
                  nextCounters.liked = Boolean(ownLikeState.liked);
                }

                cardCountersUpdated = Boolean(updateFn(postId, nextCounters));

                if (cardCountersUpdated) {
                  markTargetedLikeCounterUpdateSuccess(postId);
                }
              }
            }
          } catch (error) {
            console.debug("Klevby feed: targeted hydration counters skipped", error);
          }
        }
      }

      if (!cardCountersUpdated) {
        queueFeedRefresh(action, 120, {
          force: true
        });
      }

      const modal = document.getElementById("klevbyFeedCommentModal");
      const activePostId = String(modal?.dataset?.postId || "");
      const changedPostId = String(event?.detail?.postId || "");

      if (
        modal &&
        !modal.classList.contains("hidden") &&
        activePostId &&
        (!changedPostId || changedPostId === activePostId)
      ) {
        queueCommentsRefresh(220);
      }
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      queueFeedRefresh("feed_module_ready", 250, {
        force: true
      });
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      queueFeedRefresh("navigation_click", 160, {
        force: true
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeOpenFeedWindows();
      }
    });
  }

  function startFeedAutoRefresh() {
    if (klevbyFeedIntervalTimer) return;

    klevbyFeedIntervalTimer = setInterval(() => {
      if (!isPageVisible()) return;

      if (!isHomeFeedVisible()) return;

      refreshFeedNow("visible_interval", {
        force: true
      });

      queueCommentsRefresh(200);
    }, KLEVB_FEED_VISIBLE_REFRESH_MS);

    const state = getState();

    if (typeof state.setAutoRefreshTimer === "function") {
      state.setAutoRefreshTimer(klevbyFeedIntervalTimer);
    } else {
      state.autoRefreshTimer = klevbyFeedIntervalTimer;
    }
  }

  function restartFeedAutoRefresh() {
    if (klevbyFeedHiddenIntervalTimer) {
      clearInterval(klevbyFeedHiddenIntervalTimer);
      klevbyFeedHiddenIntervalTimer = null;
    }

    if (!klevbyFeedIntervalTimer) {
      startFeedAutoRefresh();
    }

    queueFeedRefresh("restart_visible_refresh", 100, {
      force: true
    });
  }

  function startHiddenWakeRefresh() {
    if (klevbyFeedHiddenIntervalTimer) return;

    klevbyFeedHiddenIntervalTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;

      clearInterval(klevbyFeedHiddenIntervalTimer);
      klevbyFeedHiddenIntervalTimer = null;

      handleAppResume("hidden_timer_resume");
    }, KLEVB_FEED_HIDDEN_REFRESH_MS);
  }

  async function stopRealtimeSubscription() {
    const api = getRealtimeApi();

    try {
      if (api && typeof api.unsubscribe === "function") {
        await api.unsubscribe();
      } else if (typeof window.klevbyUnsubscribeFromFeedChanges === "function") {
        await window.klevbyUnsubscribeFromFeedChanges();
      }
    } catch (error) {
      console.warn("Klevby feed: realtime канал не отключился", error);
    }

    klevbyFeedRealtimeStarted = false;
  }

  function tryStartRealtimeSubscription() {
    if (klevbyFeedRealtimeStarted) {
      return true;
    }

    const api = getRealtimeApi();

    if (!api) {
      return false;
    }

    const refresh = async (payload) => {
      const postId = String(
        payload?.postId ||
        payload?.new?.post_id ||
        payload?.old?.post_id ||
        payload?.new?.id ||
        payload?.old?.id ||
        ""
      ).trim();

      let cardCountersUpdated = tryUpdateRealtimeFeedCardCounters(payload || {});
      const action = String(payload?.action || "");

      if (!cardCountersUpdated && action === "feed_like_changed" && postId) {
        try {
          const hydratedCounters = await hydrateRealtimeFeedCardCounters(postId);
          const updateFn = resolveFeedCountersUpdater();

          if (hydratedCounters && updateFn) {
            const ownLikeState = resolveOwnLikeEventState(payload);

            if (!ownLikeState.safe) {
              cardCountersUpdated = false;
            } else {
              const nextCounters = {
                ...hydratedCounters
              };

              if (ownLikeState.isOwnLikeEvent) {
                nextCounters.liked = Boolean(ownLikeState.liked);
              }

              cardCountersUpdated = Boolean(updateFn(postId, nextCounters));

              if (cardCountersUpdated) {
                markTargetedLikeCounterUpdateSuccess(postId);
              }
            }
          }
        } catch (error) {
          console.debug("Klevby feed: realtime targeted hydration counters skipped", error);
        }
      }

      if (!cardCountersUpdated) {
        queueFeedRefresh("realtime_" + (postId || "feed"), 80, {
          force: true
        });
      }

      queueCommentsRefresh(180);
    };

    try {
      let channel = null;

      if (typeof api.subscribeToFeedChanges === "function") {
        channel = api.subscribeToFeedChanges(refresh);
      } else if (typeof api.subscribeToChanges === "function") {
        channel = api.subscribeToChanges(refresh);
      } else if (typeof api.subscribe === "function") {
        channel = api.subscribe(refresh);
      }

      if (channel) {
        klevbyFeedRealtimeStarted = true;
        return true;
      }

      klevbyFeedRealtimeStarted = false;
      return false;
    } catch (error) {
      klevbyFeedRealtimeStarted = false;
      console.warn("Klevby feed: realtime пока не подключился", error);
      return false;
    }
  }

  window.KlevbyFeedEvents = {
    bindFeedRefreshHooks,
    startFeedAutoRefresh,
    restartFeedAutoRefresh,
    startHiddenWakeRefresh,
    tryStartRealtimeSubscription,
    stopRealtimeSubscription,
    refreshFeedIfHomeVisible,
    refreshFeedNow,
    queueFeedRefresh,
    isCounterOnlyFeedPostChanged,
    markTargetedLikeCounterUpdateSuccess,
    hasRecentTargetedLikeCounterUpdate,
    handleAppResume,
    loadCommentsIntoActiveModal,
    closeOpenFeedWindows
  };

  window.refreshKlevbyFeedSilently = function refreshKlevbyFeedSilently() {
    return refreshFeedNow("manual_global", {
      force: true
    });
  };

  window.klevbyWakeFeed = function klevbyWakeFeed() {
    handleAppResume("manual_wake");
    return refreshFeedNow("manual_wake", {
      force: true
    });
  };
})();
