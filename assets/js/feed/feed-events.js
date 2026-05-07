(function () {
  const KLEVB_FEED_AUTO_REFRESH_MS = 8000;
  const KLEVB_FEED_RESUME_RECONNECT_GAP = 5500;
  const KLEVB_FEED_RESUME_REFRESH_DELAYS = [0, 450, 1400, 3200, 7000, 14000];

  let klevbyFeedRefreshDebounceTimer = null;
  let klevbyFeedRefreshInProgress = false;
  let klevbyFeedRefreshPending = false;
  let klevbyFeedLastRealtimeReconnectAt = 0;
  let klevbyFeedResumeTimers = [];

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

  function setRealtimeStarted(value) {
    const state = getState();

    if (typeof state.setRealtimeStarted === "function") {
      state.setRealtimeStarted(Boolean(value));
      return;
    }

    state.realtimeStarted = Boolean(value);
  }

  function getRealtimeStarted() {
    const state = getState();

    if (typeof state.getRealtimeStarted === "function") {
      return Boolean(state.getRealtimeStarted());
    }

    return Boolean(state.realtimeStarted);
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

  function isHomeFeedVisible() {
    const homeSection = document.getElementById("homeSection");
    const feedSection = document.getElementById("profileFeedSection");

    return Boolean(
      homeSection &&
      feedSection &&
      !homeSection.classList.contains("hidden")
    );
  }

  function refreshFeedIfHomeVisible(options = {}) {
    const force = Boolean(options.force);

    if (!force && !isHomeFeedVisible()) {
      return Promise.resolve(false);
    }

    if (!document.getElementById("profileFeedSection")) {
      return Promise.resolve(false);
    }

    return refreshFeedNow(options.reason || "refresh_home_visible", {
      force
    });
  }

  function queueFeedRefresh(reason = "queued_refresh", delay = 250, options = {}) {
    clearTimeout(klevbyFeedRefreshDebounceTimer);

    klevbyFeedRefreshDebounceTimer = setTimeout(() => {
      refreshFeedIfHomeVisible({
        reason,
        force: Boolean(options.force)
      });
    }, Math.max(0, Number(delay || 0)));
  }

  async function refreshFeedNow(reason = "manual", options = {}) {
    const force = Boolean(options.force);

    if (!force && document.visibilityState === "hidden") {
      return false;
    }

    if (!force && !isHomeFeedVisible()) {
      return false;
    }

    if (klevbyFeedRefreshInProgress) {
      klevbyFeedRefreshPending = true;
      return false;
    }

    klevbyFeedRefreshInProgress = true;

    try {
      await Promise.resolve(renderFeed());

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

        queueFeedRefresh("pending_after_" + reason, 500, {
          force
        });
      }
    }
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

  function queueCommentsRefresh(delay = 280) {
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
    if (document.visibilityState === "hidden") return;

    clearResumeTimers();

    tryStartRealtimeSubscription({
      force: true,
      reason
    }).catch((error) => {
      console.warn("Klevby feed: realtime не переподключился после возврата", error);
    });

    klevbyFeedResumeTimers = KLEVB_FEED_RESUME_REFRESH_DELAYS.map((delay) => {
      return setTimeout(() => {
        queueFeedRefresh(reason + "_refresh_" + delay, 0, {
          force: true
        });

        queueCommentsRefresh(180);
      }, delay);
    });
  }

  function bindFeedRefreshHooks() {
    if (window.__klevbyFeedRefreshBound) return;

    window.__klevbyFeedRefreshBound = true;

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
      }
    });

    window.addEventListener("klevby-auth-changed", () => {
      queueFeedRefresh("auth_changed", 180, {
        force: true
      });
    });

    window.addEventListener("klevby-feed-updated", (event) => {
      const action = String(event?.detail?.action || "feed_updated");

      queueFeedRefresh(action, 240, {
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
        queueCommentsRefresh(280);
      }
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      queueFeedRefresh("feed_module_ready", 350, {
        force: true
      });
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      queueFeedRefresh("navigation_click", 180, {
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
    const state = getState();

    if (state.autoRefreshTimer) return;

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;

      refreshFeedIfHomeVisible({
        reason: "auto_interval",
        force: false
      });

      queueCommentsRefresh(200);
    }, KLEVB_FEED_AUTO_REFRESH_MS);

    if (typeof state.setAutoRefreshTimer === "function") {
      state.setAutoRefreshTimer(timer);
      return;
    }

    state.autoRefreshTimer = timer;
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
      console.warn("Klevby feed: старый realtime канал не отключился", error);
    }

    setRealtimeStarted(false);
  }

  async function tryStartRealtimeSubscription(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (!force && getRealtimeStarted()) {
      return true;
    }

    if (
      force &&
      now - klevbyFeedLastRealtimeReconnectAt < KLEVB_FEED_RESUME_RECONNECT_GAP
    ) {
      return false;
    }

    klevbyFeedLastRealtimeReconnectAt = now;

    const api = getRealtimeApi();

    if (!api) return false;

    if (force) {
      await stopRealtimeSubscription();
    }

    const refresh = (payload) => {
      const postId =
        payload?.postId ||
        payload?.new?.post_id ||
        payload?.old?.post_id ||
        payload?.new?.id ||
        payload?.old?.id ||
        "";

      queueFeedRefresh("realtime_" + (postId || "feed"), 160, {
        force: true
      });

      queueCommentsRefresh(240);
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
        setRealtimeStarted(true);
        return true;
      }

      setRealtimeStarted(false);
      return false;
    } catch (error) {
      setRealtimeStarted(false);
      console.warn("Klevby feed: realtime пока не подключился", error);
      return false;
    }
  }

  window.KlevbyFeedEvents = {
    bindFeedRefreshHooks,
    startFeedAutoRefresh,
    tryStartRealtimeSubscription,
    refreshFeedIfHomeVisible,
    refreshFeedNow,
    queueFeedRefresh,
    handleAppResume,
    loadCommentsIntoActiveModal,
    closeOpenFeedWindows
  };
})();
