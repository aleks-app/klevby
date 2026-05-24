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

    window.addEventListener("klevby-feed-updated", (event) => {
      const action = String(event?.detail?.action || "feed_updated");

      queueFeedRefresh(action, 120, {
        force: true
      });

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

    const refresh = (payload) => {
      const postId =
        payload?.postId ||
        payload?.new?.post_id ||
        payload?.old?.post_id ||
        payload?.new?.id ||
        payload?.old?.id ||
        "";

      queueFeedRefresh("realtime_" + (postId || "feed"), 80, {
        force: true
      });

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
