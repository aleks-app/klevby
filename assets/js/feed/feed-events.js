(function () {
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

  function refreshFeedIfHomeVisible() {
    const render = getRender();

    if (typeof render.refreshFeedIfHomeVisible === "function") {
      return render.refreshFeedIfHomeVisible();
    }

    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      return renderFeed();
    }

    return Promise.resolve();
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
        setTimeout(refreshFeedIfHomeVisible, 80);
      }
    });

    window.addEventListener("pageshow", () => {
      setTimeout(refreshFeedIfHomeVisible, 120);
    });

    window.addEventListener("focus", () => {
      setTimeout(refreshFeedIfHomeVisible, 160);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        setTimeout(refreshFeedIfHomeVisible, 160);
        setTimeout(loadCommentsIntoActiveModal, 220);
      }
    });

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(refreshFeedIfHomeVisible, 180);
    });

    window.addEventListener("klevby-feed-updated", (event) => {
      setTimeout(renderFeed, 220);

      const modal = document.getElementById("klevbyFeedCommentModal");
      const activePostId = String(modal?.dataset?.postId || "");
      const changedPostId = String(event?.detail?.postId || "");

      if (
        modal &&
        !modal.classList.contains("hidden") &&
        activePostId &&
        (!changedPostId || changedPostId === activePostId)
      ) {
        setTimeout(loadCommentsIntoActiveModal, 260);
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(refreshFeedIfHomeVisible, 180);
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

      refreshFeedIfHomeVisible();
      loadCommentsIntoActiveModal();
    }, 6000);

    if (typeof state.setAutoRefreshTimer === "function") {
      state.setAutoRefreshTimer(timer);
      return;
    }

    state.autoRefreshTimer = timer;
  }

  function tryStartRealtimeSubscription() {
    const state = getState();

    if (state.realtimeStarted) return;

    const api = window.klevbyFeedSupabase;

    if (!api) return;

    const refresh = () => {
      setTimeout(refreshFeedIfHomeVisible, 120);
      setTimeout(loadCommentsIntoActiveModal, 180);
    };

    try {
      if (typeof api.subscribeToFeedChanges === "function") {
        api.subscribeToFeedChanges(refresh);

        if (typeof state.setRealtimeStarted === "function") {
          state.setRealtimeStarted(true);
        } else {
          state.realtimeStarted = true;
        }

        return;
      }

      if (typeof api.subscribeToChanges === "function") {
        api.subscribeToChanges(refresh);

        if (typeof state.setRealtimeStarted === "function") {
          state.setRealtimeStarted(true);
        } else {
          state.realtimeStarted = true;
        }

        return;
      }

      if (typeof api.subscribe === "function") {
        api.subscribe(refresh);

        if (typeof state.setRealtimeStarted === "function") {
          state.setRealtimeStarted(true);
        } else {
          state.realtimeStarted = true;
        }
      }
    } catch (error) {
      console.warn("Klevby feed: realtime пока не подключился", error);
    }
  }

  window.KlevbyFeedEvents = {
    bindFeedRefreshHooks,
    startFeedAutoRefresh,
    tryStartRealtimeSubscription,
    refreshFeedIfHomeVisible,
    loadCommentsIntoActiveModal,
    closeOpenFeedWindows
  };
})();
