(function () {
  let autoRefreshTimer = null;
  let realtimeStarted = false;
  let refreshBound = false;

  function getState() {
    return window.KlevbyFeedState || {};
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

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function isHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    return Boolean(homeSection && !homeSection.classList.contains("hidden"));
  }

  function renderFeed() {
    const renderer = getRender();

    if (typeof renderer.renderProfileFeed === "function") {
      return renderer.renderProfileFeed();
    }

    if (typeof window.renderProfileFeed === "function") {
      return window.renderProfileFeed();
    }

    return Promise.resolve();
  }

  function refreshFeedIfHomeVisible() {
    if (!isHomeVisible()) return Promise.resolve();

    return renderFeed();
  }

  function refreshOpenCommentsIfNeeded(delay = 140) {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const postId = String(modal?.dataset?.postId || "");

    if (!modal || modal.classList.contains("hidden") || !postId) {
      return;
    }

    setTimeout(() => {
      const modals = getModals();

      if (typeof modals.loadCommentsIntoModal === "function") {
        modals.loadCommentsIntoModal(postId);
        return;
      }

      if (typeof window.openFeedCommentModal === "function") {
        window.openFeedCommentModal(postId);
      }
    }, delay);
  }

  async function toggleLikeFromCard(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    const api = getApi();

    try {
      if (typeof api.toggleLike === "function") {
        await api.toggleLike(cleanId);
      } else if (typeof window.klevbyToggleFeedLike === "function") {
        await window.klevbyToggleFeedLike(cleanId);
      } else if (
        window.klevbyFeedSupabase &&
        typeof window.klevbyFeedSupabase.toggleLike === "function"
      ) {
        await window.klevbyFeedSupabase.toggleLike(cleanId);
      } else {
        alert("Лайки ещё не подключены.");
        return;
      }

      await renderFeed();

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (error) {
      console.warn("Klevby feed actions: лайк не сработал", error);
      alert(error?.message || "Не получилось поставить лайк.");
    }
  }

  async function toggleLikeFromViewer(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    await toggleLikeFromCard(cleanId);

    setTimeout(() => {
      const state = getState();
      const modals = getModals();

      const updatedItem =
        typeof state.getCachedItem === "function"
          ? state.getCachedItem(cleanId)
          : null;

      if (updatedItem && typeof modals.openFeedPhotoViewer === "function") {
        modals.openFeedPhotoViewer(updatedItem);
      }
    }, 320);
  }

  function openProfilePhotoFeedItem(postId) {
    const modals = getModals();

    if (typeof modals.openProfilePhotoFeedItem === "function") {
      modals.openProfilePhotoFeedItem(postId);
      return;
    }

    if (typeof window.openProfilePhotoFeedItem === "function") {
      window.openProfilePhotoFeedItem(postId);
      return;
    }

    const utils = getUtils();

    if (typeof utils.openProfileSafe === "function") {
      utils.openProfileSafe();
      return;
    }

    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
    }
  }

  function openFeedCommentModal(postId) {
    const modals = getModals();

    if (typeof modals.openFeedCommentModal === "function") {
      modals.openFeedCommentModal(postId);
      return;
    }

    if (typeof window.openFeedCommentModal === "function") {
      window.openFeedCommentModal(postId);
    }
  }

  function handleFeedUpdatedEvent(event) {
    const changedPostId = String(event?.detail?.postId || "");

    setTimeout(() => {
      renderFeed();
    }, 180);

    const modal = document.getElementById("klevbyFeedCommentModal");
    const activePostId = String(modal?.dataset?.postId || "");

    if (
      modal &&
      !modal.classList.contains("hidden") &&
      activePostId &&
      (!changedPostId || changedPostId === activePostId)
    ) {
      refreshOpenCommentsIfNeeded(240);
    }
  }

  function tryStartRealtimeSubscription() {
    if (realtimeStarted) return;

    const api = getApi();

    const refresh = () => {
      setTimeout(refreshFeedIfHomeVisible, 120);
      refreshOpenCommentsIfNeeded(180);
    };

    try {
      if (typeof api.subscribeToFeedChanges === "function") {
        api.subscribeToFeedChanges(refresh);
        realtimeStarted = true;
        return;
      }

      if (typeof api.subscribeToChanges === "function") {
        api.subscribeToChanges(refresh);
        realtimeStarted = true;
        return;
      }

      if (typeof api.subscribe === "function") {
        api.subscribe(refresh);
        realtimeStarted = true;
        return;
      }

      if (
        window.klevbyFeedSupabase &&
        typeof window.klevbyFeedSupabase.subscribeToFeedChanges === "function"
      ) {
        window.klevbyFeedSupabase.subscribeToFeedChanges(refresh);
        realtimeStarted = true;
      }
    } catch (error) {
      console.warn("Klevby feed actions: realtime пока не подключился", error);
    }
  }

  function startFeedAutoRefresh() {
    if (autoRefreshTimer) return;

    autoRefreshTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;

      refreshFeedIfHomeVisible();
      refreshOpenCommentsIfNeeded(120);
    }, 6000);
  }

  function stopFeedAutoRefresh() {
    if (!autoRefreshTimer) return;

    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  function bindRefreshHooks() {
    if (refreshBound) return;

    refreshBound = true;

    window.addEventListener("storage", (event) => {
      const constants = getState().CONSTANTS || {};
      const key = String(event?.key || "");

      const watchedKeys = [
        constants.PROFILE_PHOTOS_KEY || "klevby_profile_photos",
        constants.PROFILE_AVATAR_KEY || "klevby_profile_avatar",
        constants.PROFILE_SETTINGS_KEY || "klevby_profile_settings",
        constants.PROFILE_NAME_KEY || "klevby_profile_name"
      ];

      if (watchedKeys.includes(key)) {
        setTimeout(refreshFeedIfHomeVisible, 80);
      }
    });

    window.addEventListener("klevby-app-resumed", () => {
      setTimeout(refreshFeedIfHomeVisible, 120);
      refreshOpenCommentsIfNeeded(220);
    });

    if (!window.__klevbyCentralResumeRouter) {
      window.addEventListener("pageshow", () => {
        setTimeout(refreshFeedIfHomeVisible, 120);
      });

      window.addEventListener("focus", () => {
        setTimeout(refreshFeedIfHomeVisible, 160);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          setTimeout(refreshFeedIfHomeVisible, 160);
          refreshOpenCommentsIfNeeded(220);
        }
      });
    }

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(refreshFeedIfHomeVisible, 180);
    });

    window.addEventListener("klevby-feed-updated", handleFeedUpdatedEvent);

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(refreshFeedIfHomeVisible, 180);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      const modals = getModals();

      if (typeof modals.closeFeedPhotoViewer === "function") {
        modals.closeFeedPhotoViewer();
      }

      if (typeof modals.closeFeedCommentModal === "function") {
        modals.closeFeedCommentModal();
      }
    });
  }

  function initActions() {
    bindRefreshHooks();
    startFeedAutoRefresh();

    setTimeout(tryStartRealtimeSubscription, 1200);
    setTimeout(tryStartRealtimeSubscription, 2600);
  }

  const actions = {
    initActions,
    bindRefreshHooks,
    startFeedAutoRefresh,
    stopFeedAutoRefresh,
    tryStartRealtimeSubscription,
    refreshFeedIfHomeVisible,
    refreshOpenCommentsIfNeeded,
    renderFeed,
    toggleLikeFromCard,
    toggleLikeFromViewer,
    openProfilePhotoFeedItem,
    openFeedCommentModal
  };

  window.KlevbyFeedActions = actions;

  window.toggleFeedLike = toggleLikeFromCard;
  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.openFeedCommentModal = openFeedCommentModal;
})();
