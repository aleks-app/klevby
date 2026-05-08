(function () {
  let autoRefreshTimer = null;
  let realtimeStarted = false;
  let refreshBound = false;
  let likeRefreshTimer = null;

  const pendingLikeLocks = new Set();
  const viewerLikeState = new Map();

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

  function getLastItemsArray() {
    const state = getState();

    if (typeof state.getLastItems === "function") {
      const items = state.getLastItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function setLastItemsArray(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
    } else {
      window.__klevbyFeedLastItems = safeItems;
    }

    if (typeof state.setItemsCacheFromArray === "function") {
      state.setItemsCacheFromArray(safeItems);
      return;
    }

    const cache = {};
    safeItems.forEach((item) => {
      if (item && item.id) {
        cache[String(item.id)] = item;
      }
    });
    window.__klevbyFeedItemsCache = cache;
  }

  function getCachedFeedItem(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return null;

    const state = getState();

    if (typeof state.getCachedItem === "function") {
      const item = state.getCachedItem(cleanId);
      if (item) return item;
    }

    const items = getLastItemsArray();
    return items.find((item) => String(item?.id || "") === cleanId) || null;
  }

  function getItemLikesCount(item) {
    return Math.max(0, Number(item?.likesCount || item?.likes_count || 0) || 0);
  }

  function getKnownLikeStateFromItem(item) {
    if (!item || typeof item !== "object") return null;

    const candidates = [
      item.likedByViewer,
      item.viewerLiked,
      item.isLiked,
      item.liked,
      item.hasLiked,
      item.liked_by_viewer
    ];

    for (const value of candidates) {
      if (typeof value === "boolean") return value;
    }

    return null;
  }

  function getKnownLikeState(postId, item = null) {
    const cleanId = String(postId || "").trim();

    if (viewerLikeState.has(cleanId)) {
      return viewerLikeState.get(cleanId);
    }

    return getKnownLikeStateFromItem(item);
  }

  function getLikeButtons(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return [];

    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(cleanId)
        : cleanId.replace(/"/g, '\\"');

    const mappedButtons = Array.from(
      document.querySelectorAll(`.profile-feed-like-btn[data-feed-post-id="${safeId}"]`)
    );

    if (mappedButtons.length) {
      return mappedButtons;
    }

    return Array.from(document.querySelectorAll(".profile-feed-like-btn")).filter((button) => {
      if (button.dataset.feedPostId) {
        return String(button.dataset.feedPostId).trim() === cleanId;
      }

      const onclickValue = String(button.getAttribute("onclick") || "");
      return onclickValue.includes(cleanId);
    });
  }

  function getButtonLikesCount(postId) {
    const button = getLikeButtons(postId)[0];

    if (!button) return null;

    const match = String(button.textContent || "").match(/-?\d+/);
    if (!match) return null;

    const count = Number(match[0]);
    return Number.isFinite(count) ? Math.max(0, count) : null;
  }

  function setLikeButtonsState(postId, likesCount, liked, pending = false) {
    const safeCount = Math.max(0, Number(likesCount || 0) || 0);

    getLikeButtons(postId).forEach((button) => {
      button.textContent = `👍 ${safeCount}`;
      button.dataset.pendingLike = pending ? "1" : "0";
      button.dataset.likeCount = String(safeCount);

      if (typeof liked === "boolean") {
        button.dataset.liked = liked ? "true" : "false";
        button.setAttribute("aria-pressed", liked ? "true" : "false");
        button.classList.toggle("liked", liked);
        button.classList.toggle("is-liked", liked);
      }
    });
  }

  function patchLocalFeedItem(postId, patch = {}) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return null;

    const items = getLastItemsArray();
    let patchedItem = null;
    let changed = false;

    const nextItems = items.map((item) => {
      if (String(item?.id || "") !== cleanId) return item;

      changed = true;
      patchedItem = {
        ...item,
        ...patch
      };

      return patchedItem;
    });

    if (changed) {
      setLastItemsArray(nextItems);
    }

    return patchedItem;
  }

  function getLikeSnapshot(postId) {
    const item = getCachedFeedItem(postId);
    const buttonCount = getButtonLikesCount(postId);

    const likesCount =
      buttonCount !== null
        ? buttonCount
        : getItemLikesCount(item);

    const liked = getKnownLikeState(postId, item);

    return {
      item,
      likesCount,
      liked
    };
  }

  function applyLocalLikeState(postId, liked, likesCount) {
    const safeCount = Math.max(0, Number(likesCount || 0) || 0);

    viewerLikeState.set(String(postId), Boolean(liked));

    patchLocalFeedItem(postId, {
      likedByViewer: Boolean(liked),
      viewerLiked: Boolean(liked),
      likesCount: safeCount
    });

    setLikeButtonsState(postId, safeCount, Boolean(liked), pendingLikeLocks.has(String(postId)));
  }

  function applyOptimisticLike(postId) {
    const snapshot = getLikeSnapshot(postId);
    const previousLiked = typeof snapshot.liked === "boolean" ? snapshot.liked : false;
    const optimisticLiked = !previousLiked;
    const optimisticCount = Math.max(
      0,
      snapshot.likesCount + (optimisticLiked ? 1 : -1)
    );

    applyLocalLikeState(postId, optimisticLiked, optimisticCount);

    return {
      ...snapshot,
      optimisticLiked,
      optimisticCount
    };
  }

  function extractServerLikedState(result) {
    if (typeof result === "boolean") return result;

    if (typeof result?.liked === "boolean") return result.liked;
    if (typeof result?.data?.liked === "boolean") return result.data.liked;
    if (typeof result?.result?.liked === "boolean") return result.result.liked;

    return null;
  }

  function reconcileLikeAfterSuccess(postId, snapshot, result) {
    const serverLiked = extractServerLikedState(result);

    if (typeof serverLiked !== "boolean") {
      setLikeButtonsState(postId, snapshot.optimisticCount, snapshot.optimisticLiked, false);
      return;
    }

    const previousLiked =
      typeof snapshot.liked === "boolean"
        ? snapshot.liked
        : null;

    let finalCount = snapshot.likesCount;

    if (previousLiked === true && serverLiked === false) {
      finalCount = Math.max(0, snapshot.likesCount - 1);
    } else if (previousLiked === false && serverLiked === true) {
      finalCount = snapshot.likesCount + 1;
    } else if (previousLiked === null) {
      finalCount = Math.max(0, snapshot.likesCount + (serverLiked ? 1 : -1));
    }

    applyLocalLikeState(postId, serverLiked, finalCount);
    setLikeButtonsState(postId, finalCount, serverLiked, false);
  }

  function rollbackLikeState(postId, snapshot) {
    if (typeof snapshot.liked === "boolean") {
      viewerLikeState.set(String(postId), snapshot.liked);
    } else {
      viewerLikeState.delete(String(postId));
    }

    patchLocalFeedItem(postId, {
      likedByViewer: snapshot.liked === true,
      viewerLiked: snapshot.liked === true,
      likesCount: snapshot.likesCount
    });

    setLikeButtonsState(postId, snapshot.likesCount, snapshot.liked, false);
  }


  function isDuplicateLikeError(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || error?.details?.code || "").toLowerCase();
    const constraint = String(
      error?.constraint || error?.details?.constraint || error?.hint || ""
    ).toLowerCase();

    if (constraint.includes("feed_likes_unique_user_post")) {
      return true;
    }

    return (
      code === "23505" && (
        message.includes("feed_likes_unique_user_post") ||
        message.includes("duplicate key")
      )
    ) || message.includes('duplicate key value violates unique constraint "feed_likes_unique_user_post"');
  }

  function scheduleLikeRefresh() {
    clearTimeout(likeRefreshTimer);

    likeRefreshTimer = setTimeout(() => {
      refreshFeedIfHomeVisible();
      refreshOpenCommentsIfNeeded(120);
    }, 650);
  }

  async function callToggleLikeApi(cleanId) {
    const api = getApi();

    if (typeof api.toggleLike === "function") {
      return await api.toggleLike(cleanId);
    }

    if (typeof window.klevbyToggleFeedLike === "function") {
      return await window.klevbyToggleFeedLike(cleanId);
    }

    if (
      window.klevbyFeedSupabase &&
      typeof window.klevbyFeedSupabase.toggleLike === "function"
    ) {
      return await window.klevbyFeedSupabase.toggleLike(cleanId);
    }

    throw new Error("Лайки ещё не подключены.");
  }

  async function toggleLikeFromCard(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    if (pendingLikeLocks.has(cleanId)) {
      return;
    }

    pendingLikeLocks.add(cleanId);
    const snapshot = applyOptimisticLike(cleanId);
    setLikeButtonsState(cleanId, snapshot.optimisticCount, snapshot.optimisticLiked, true);

    try {
      const result = await callToggleLikeApi(cleanId);

      reconcileLikeAfterSuccess(cleanId, snapshot, result);

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }

      scheduleLikeRefresh();
    } catch (error) {
      if (isDuplicateLikeError(error)) {
        const duplicatedCount = Math.max(snapshot.likesCount, snapshot.optimisticCount);

        applyLocalLikeState(cleanId, true, duplicatedCount);
        setLikeButtonsState(cleanId, duplicatedCount, true, false);
      } else {
        rollbackLikeState(cleanId, snapshot);
        console.warn("Klevby feed actions: лайк не сработал", error);
        alert(error?.message || "Не получилось поставить лайк.");
      }
    } finally {
      pendingLikeLocks.delete(cleanId);
      const currentSnapshot = getLikeSnapshot(cleanId);
      setLikeButtonsState(
        cleanId,
        currentSnapshot.likesCount,
        getKnownLikeState(cleanId, currentSnapshot.item),
        false
      );
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
          : getCachedFeedItem(cleanId);

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
