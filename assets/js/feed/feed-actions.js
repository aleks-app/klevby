(function () {
  let autoRefreshTimer = null;
  let realtimeStarted = false;
  let refreshBound = false;
  let likeRefreshTimer = null;

  const pendingLikeLocks = new Set();
  const viewerLikeState = new Map();
  const likeRenderProtectedUntil = new Map();

  const LIKE_RENDER_PROTECTION_MS = 5200;
  const LIKE_BACKGROUND_REFRESH_MS = 6200;
  const LIKE_PROTECTION_RECHECK_MS = 900;

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

    const dataButtons = Array.from(
      document.querySelectorAll(`.profile-feed-like-btn[data-feed-post-id="${safeId}"]`)
    );

    if (dataButtons.length) {
      return dataButtons;
    }

    return Array.from(document.querySelectorAll(".profile-feed-like-btn")).filter((button) => {
      if (button.dataset.feedPostId) {
        return String(button.dataset.feedPostId).trim() === cleanId;
      }

      const onclickValue = String(button.getAttribute("onclick") || "");
      return onclickValue.includes(cleanId);
    });
  }

  function isButtonHoveredOrFocused(button) {
    if (!button) return false;

    try {
      return (
        button === document.activeElement ||
        button.matches(":hover") ||
        button.matches(":focus") ||
        button.matches(":focus-visible")
      );
    } catch (_) {
      return button === document.activeElement;
    }
  }

  function isLikeButtonActive(postId) {
    return getLikeButtons(postId).some(isButtonHoveredOrFocused);
  }

  function cleanupLikeRenderProtection(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return;

    const until = Number(likeRenderProtectedUntil.get(cleanId) || 0);

    if (until > Date.now()) {
      setTimeout(() => {
        cleanupLikeRenderProtection(cleanId);
      }, Math.max(120, until - Date.now() + 80));
      return;
    }

    if (isLikeButtonActive(cleanId)) {
      setTimeout(() => {
        cleanupLikeRenderProtection(cleanId);
      }, LIKE_PROTECTION_RECHECK_MS);
      return;
    }

    likeRenderProtectedUntil.delete(cleanId);
  }

  function protectLikeRender(postId, duration = LIKE_RENDER_PROTECTION_MS) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return;

    const until = Date.now() + Math.max(600, Number(duration || LIKE_RENDER_PROTECTION_MS));

    likeRenderProtectedUntil.set(cleanId, until);

    setTimeout(() => {
      cleanupLikeRenderProtection(cleanId);
    }, Math.max(700, Number(duration || LIKE_RENDER_PROTECTION_MS) + 100));
  }

  function isLikeRenderProtected(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return false;

    if (pendingLikeLocks.has(cleanId)) {
      return true;
    }

    if (!likeRenderProtectedUntil.has(cleanId)) {
      return false;
    }

    const until = Number(likeRenderProtectedUntil.get(cleanId) || 0);

    if (until > Date.now()) {
      return true;
    }

    if (isLikeButtonActive(cleanId)) {
      return true;
    }

    likeRenderProtectedUntil.delete(cleanId);
    return false;
  }

  function hasActiveLikeRenderProtection() {
    for (const postId of Array.from(likeRenderProtectedUntil.keys())) {
      if (isLikeRenderProtected(postId)) {
        return true;
      }
    }

    return pendingLikeLocks.size > 0;
  }

  function extractPostIdFromDetail(detail = {}) {
    const payload = detail?.payload || detail?.record || detail || {};

    return String(
      detail?.postId ||
      detail?.post_id ||
      payload?.postId ||
      payload?.post_id ||
      payload?.new?.post_id ||
      payload?.old?.post_id ||
      payload?.new?.id ||
      payload?.old?.id ||
      ""
    ).trim();
  }

  function isLikeUpdateDetail(detail = {}) {
    const action = String(detail?.action || "").toLowerCase();
    const table = String(detail?.table || detail?.payload?.table || "").toLowerCase();

    return (
      action.includes("like") ||
      table.includes("feed_likes")
    );
  }

  function shouldDelayRenderForLikeUpdate(detail = {}) {
    if (!isLikeUpdateDetail(detail)) {
      return false;
    }

    const postId = extractPostIdFromDetail(detail);

    if (!postId) {
      return hasActiveLikeRenderProtection();
    }

    return isLikeRenderProtected(postId);
  }

  function getButtonLikesCount(postId) {
    const button = getLikeButtons(postId)[0];

    if (!button) return null;

    const dataCount = Number(button.dataset.likeCount);

    if (Number.isFinite(dataCount)) {
      return Math.max(0, dataCount);
    }

    const match = String(button.textContent || "").match(/-?\d+/);
    if (!match) return null;

    const count = Number(match[0]);

    return Number.isFinite(count) ? Math.max(0, count) : null;
  }

  function setLikeButtonsState(postId, likesCount, liked, pending = false) {
    const cleanId = String(postId || "").trim();
    const safeCount = Math.max(0, Number(likesCount || 0) || 0);

    getLikeButtons(cleanId).forEach((button) => {
      button.textContent = `👍 ${safeCount}`;
      button.dataset.pendingLike = pending ? "1" : "0";
      button.dataset.likeCount = String(safeCount);
      button.dataset.feedPostId = cleanId;

      button.disabled = false;
      button.setAttribute("aria-busy", pending ? "true" : "false");
      button.classList.remove("is-pending-like");

      if (typeof liked === "boolean") {
        button.dataset.liked = liked ? "true" : "false";
        button.setAttribute("aria-pressed", liked ? "true" : "false");
        button.classList.toggle("liked", liked);
        button.classList.toggle("is-liked", liked);
      } else {
        button.removeAttribute("aria-pressed");
        delete button.dataset.liked;
        button.classList.remove("liked", "is-liked");
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
    const cleanId = String(postId || "").trim();
    const item = getCachedFeedItem(cleanId);
    const button = getLikeButtons(cleanId)[0];
    const buttonCount = getButtonLikesCount(cleanId);

    const likesCount =
      buttonCount !== null
        ? buttonCount
        : getItemLikesCount(item);

    let liked = getKnownLikeState(cleanId, item);

    if (typeof liked !== "boolean" && button?.dataset?.liked) {
      liked = String(button.dataset.liked) === "true";
    }

    return {
      item,
      likesCount,
      liked
    };
  }

  function applyLocalLikeState(postId, liked, likesCount) {
    const cleanId = String(postId || "").trim();
    const safeCount = Math.max(0, Number(likesCount || 0) || 0);
    const safeLiked = Boolean(liked);

    viewerLikeState.set(cleanId, safeLiked);

    patchLocalFeedItem(cleanId, {
      likedByViewer: safeLiked,
      viewerLiked: safeLiked,
      isLiked: safeLiked,
      liked: safeLiked,
      hasLiked: safeLiked,
      liked_by_viewer: safeLiked,
      likesCount: safeCount,
      likes_count: safeCount
    });

    setLikeButtonsState(cleanId, safeCount, safeLiked, pendingLikeLocks.has(cleanId));
  }

  function extractServerLikedState(result) {
    if (typeof result === "boolean") return result;

    if (typeof result?.liked === "boolean") return result.liked;
    if (typeof result?.viewerLiked === "boolean") return result.viewerLiked;
    if (typeof result?.likedByViewer === "boolean") return result.likedByViewer;
    if (typeof result?.liked_by_viewer === "boolean") return result.liked_by_viewer;

    if (typeof result?.data?.liked === "boolean") return result.data.liked;
    if (typeof result?.data?.viewerLiked === "boolean") return result.data.viewerLiked;
    if (typeof result?.data?.likedByViewer === "boolean") return result.data.likedByViewer;
    if (typeof result?.data?.liked_by_viewer === "boolean") return result.data.liked_by_viewer;

    if (typeof result?.result?.liked === "boolean") return result.result.liked;
    if (typeof result?.result?.viewerLiked === "boolean") return result.result.viewerLiked;
    if (typeof result?.result?.likedByViewer === "boolean") return result.result.likedByViewer;
    if (typeof result?.result?.liked_by_viewer === "boolean") return result.result.liked_by_viewer;

    return null;
  }

  function extractServerLikesCount(result) {
    const candidates = [
      result?.likesCount,
      result?.likes_count,
      result?.count,
      result?.likes,
      result?.data?.likesCount,
      result?.data?.likes_count,
      result?.data?.count,
      result?.data?.likes,
      result?.result?.likesCount,
      result?.result?.likes_count,
      result?.result?.count,
      result?.result?.likes
    ];

    for (const value of candidates) {
      const numberValue = Number(value);

      if (Number.isFinite(numberValue)) {
        return Math.max(0, numberValue);
      }
    }

    return null;
  }

  function normalizeLikeStateResult(result) {
    const liked = extractServerLikedState(result);
    const likesCount = extractServerLikesCount(result);

    if (typeof liked !== "boolean" && likesCount === null) {
      return null;
    }

    return {
      liked,
      likesCount
    };
  }

  async function callReadLikeStateApi(cleanId) {
    const api = getApi();

    const candidates = [
      api.getViewerLikeState,
      api.getViewerLikedState,
      api.getLikeState,
      api.getPostLikeState,
      api.isPostLikedByViewer,
      api.hasViewerLiked,
      api.hasLiked,
      window.klevbyGetFeedLikeState,
      window.klevbyGetViewerLikeState,
      window.klevbyFeedSupabase?.getViewerLikeState,
      window.klevbyFeedSupabase?.getViewerLikedState,
      window.klevbyFeedSupabase?.getLikeState,
      window.klevbyFeedSupabase?.getPostLikeState,
      window.klevbyFeedSupabase?.isPostLikedByViewer,
      window.klevbyFeedSupabase?.hasViewerLiked,
      window.klevbyFeedSupabase?.hasLiked
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "function") continue;

      try {
        const result = await candidate(cleanId);
        const normalized = normalizeLikeStateResult(result);

        if (normalized) {
          return normalized;
        }
      } catch (error) {
        console.debug("Klevby feed actions: like state preflight skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return null;
  }

  async function callUnlikeApi(cleanId) {
    const api = getApi();

    const candidates = [
      api.unlike,
      api.removeLike,
      api.deleteLike,
      api.unlikePost,
      api.removePostLike,
      window.klevbyUnlikeFeedLike,
      window.klevbyRemoveFeedLike,
      window.klevbyFeedSupabase?.unlike,
      window.klevbyFeedSupabase?.removeLike,
      window.klevbyFeedSupabase?.deleteLike,
      window.klevbyFeedSupabase?.unlikePost,
      window.klevbyFeedSupabase?.removePostLike
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "function") continue;

      try {
        return await candidate(cleanId);
      } catch (error) {
        console.debug("Klevby feed actions: explicit unlike skipped", {
          error: String(error?.message || error)
        });
      }
    }

    throw new Error("Нет отдельной функции удаления лайка.");
  }

  async function improveUnknownLikeSnapshot(postId, snapshot) {
    if (typeof snapshot?.liked === "boolean") {
      return snapshot;
    }

    const cleanId = String(postId || "").trim();
    const serverState = await callReadLikeStateApi(cleanId);

    if (!serverState || typeof serverState.liked !== "boolean") {
      return snapshot;
    }

    const likesCount =
      serverState.likesCount !== null && serverState.likesCount !== undefined
        ? serverState.likesCount
        : snapshot.likesCount;

    applyLocalLikeState(cleanId, serverState.liked, likesCount);

    return {
      ...snapshot,
      likesCount,
      liked: serverState.liked
    };
  }

  function applyOptimisticLike(postId, snapshot) {
    const cleanId = String(postId || "").trim();

    if (typeof snapshot?.liked !== "boolean") {
      setLikeButtonsState(cleanId, snapshot.likesCount, null, true);

      return {
        ...snapshot,
        optimisticLiked: null,
        optimisticCount: snapshot.likesCount,
        optimisticApplied: false
      };
    }

    const optimisticLiked = !snapshot.liked;
    const optimisticCount = Math.max(
      0,
      snapshot.likesCount + (optimisticLiked ? 1 : -1)
    );

    applyLocalLikeState(cleanId, optimisticLiked, optimisticCount);

    return {
      ...snapshot,
      optimisticLiked,
      optimisticCount,
      optimisticApplied: true
    };
  }

  function reconcileLikeAfterSuccess(postId, snapshot, result) {
    const cleanId = String(postId || "").trim();
    const serverLiked = extractServerLikedState(result);
    const serverLikesCount = extractServerLikesCount(result);

    if (typeof serverLiked === "boolean") {
      let finalCount = serverLikesCount;

      if (finalCount === null) {
        if (snapshot.liked === true && serverLiked === false) {
          finalCount = Math.max(0, snapshot.likesCount - 1);
        } else if (snapshot.liked === false && serverLiked === true) {
          finalCount = snapshot.likesCount + 1;
        } else if (snapshot.liked === null || snapshot.liked === undefined) {
          finalCount = Math.max(0, snapshot.likesCount + (serverLiked ? 1 : -1));
        } else {
          finalCount = snapshot.likesCount;
        }
      }

      applyLocalLikeState(cleanId, serverLiked, finalCount);
      setLikeButtonsState(cleanId, finalCount, serverLiked, false);
      return;
    }

    if (serverLikesCount !== null && typeof snapshot.optimisticLiked === "boolean") {
      applyLocalLikeState(cleanId, snapshot.optimisticLiked, serverLikesCount);
      setLikeButtonsState(cleanId, serverLikesCount, snapshot.optimisticLiked, false);
      return;
    }

    if (snapshot.optimisticApplied && typeof snapshot.optimisticLiked === "boolean") {
      setLikeButtonsState(cleanId, snapshot.optimisticCount, snapshot.optimisticLiked, false);
      return;
    }

    setLikeButtonsState(cleanId, snapshot.likesCount, snapshot.liked, false);
    scheduleLikeRefresh();
  }

  function rollbackLikeState(postId, snapshot) {
    const cleanId = String(postId || "").trim();

    if (typeof snapshot.liked === "boolean") {
      viewerLikeState.set(cleanId, snapshot.liked);
    } else {
      viewerLikeState.delete(cleanId);
    }

    patchLocalFeedItem(cleanId, {
      likedByViewer: snapshot.liked === true,
      viewerLiked: snapshot.liked === true,
      isLiked: snapshot.liked === true,
      liked: snapshot.liked === true,
      hasLiked: snapshot.liked === true,
      liked_by_viewer: snapshot.liked === true,
      likesCount: snapshot.likesCount,
      likes_count: snapshot.likesCount
    });

    setLikeButtonsState(cleanId, snapshot.likesCount, snapshot.liked, false);
  }

  function isDuplicateLikeError(error) {
    const code = String(error?.code || error?.details?.code || "").trim();
    const message = String(error?.message || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const constraint = String(error?.constraint || error?.details?.constraint || "").toLowerCase();

    return (
      code === "23505" ||
      code === "409" ||
      message.includes("duplicate key") ||
      message.includes("feed_likes_unique_user_post") ||
      details.includes("feed_likes_unique_user_post") ||
      hint.includes("feed_likes_unique_user_post") ||
      constraint.includes("feed_likes_unique_user_post")
    );
  }

  function scheduleLikeRefresh(delay = LIKE_BACKGROUND_REFRESH_MS) {
    clearTimeout(likeRefreshTimer);

    likeRefreshTimer = setTimeout(() => {
      if (hasActiveLikeRenderProtection()) {
        scheduleLikeRefresh(LIKE_PROTECTION_RECHECK_MS);
        return;
      }

      refreshFeedIfHomeVisible();
      refreshOpenCommentsIfNeeded(120);
    }, Math.max(400, Number(delay || LIKE_BACKGROUND_REFRESH_MS)));
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

  async function handleDuplicateLikeError(cleanId, snapshot) {
    const shouldTryUnlike =
      snapshot.liked === true ||
      snapshot.liked === null ||
      snapshot.liked === undefined;

    if (shouldTryUnlike) {
      try {
        const unlikeResult = await callUnlikeApi(cleanId);
        const serverLikesCount = extractServerLikesCount(unlikeResult);
        const finalCount =
          serverLikesCount !== null
            ? serverLikesCount
            : Math.max(0, snapshot.likesCount - 1);

        applyLocalLikeState(cleanId, false, finalCount);
        setLikeButtonsState(cleanId, finalCount, false, false);
        scheduleLikeRefresh();
        return true;
      } catch (error) {
        console.debug("Klevby feed actions: duplicate unlike fallback", {
          error: String(error?.message || error)
        });
      }
    }

    const stableCount = Math.max(0, Number(snapshot.likesCount || 0) || 0);

    applyLocalLikeState(cleanId, true, stableCount);
    setLikeButtonsState(cleanId, stableCount, true, false);
    scheduleLikeRefresh();

    return true;
  }

  async function toggleLikeFromCard(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    if (pendingLikeLocks.has(cleanId)) {
      return;
    }

    protectLikeRender(cleanId);
    pendingLikeLocks.add(cleanId);

    let snapshot = getLikeSnapshot(cleanId);

    try {
      snapshot = await improveUnknownLikeSnapshot(cleanId, snapshot);
    } catch (error) {
      console.debug("Klevby feed actions: like preflight failed", {
        error: String(error?.message || error)
      });
    }

    snapshot = applyOptimisticLike(cleanId, snapshot);
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
        await handleDuplicateLikeError(cleanId, snapshot);
      } else {
        rollbackLikeState(cleanId, snapshot);
        console.warn("Klevby feed actions: лайк не сработал", error);
        alert(error?.message || "Не получилось поставить лайк.");
      }
    } finally {
      pendingLikeLocks.delete(cleanId);
      protectLikeRender(cleanId, LIKE_RENDER_PROTECTION_MS);

      const currentSnapshot = getLikeSnapshot(cleanId);
      const currentLiked = getKnownLikeState(cleanId, currentSnapshot.item);

      setLikeButtonsState(
        cleanId,
        currentSnapshot.likesCount,
        currentLiked,
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
    const detail = event?.detail || {};
    const changedPostId = String(detail?.postId || detail?.post_id || extractPostIdFromDetail(detail) || "");

    if (shouldDelayRenderForLikeUpdate(detail)) {
      scheduleLikeRefresh();
      return;
    }

    setTimeout(() => {
      if (hasActiveLikeRenderProtection()) {
        scheduleLikeRefresh();
        return;
      }

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

    const refresh = (detail = {}) => {
      if (shouldDelayRenderForLikeUpdate(detail)) {
        scheduleLikeRefresh();
        return;
      }

      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh();
          return;
        }

        refreshFeedIfHomeVisible();
      }, 120);

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

      if (hasActiveLikeRenderProtection()) {
        return;
      }

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
      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh();
          return;
        }

        refreshFeedIfHomeVisible();
      }, 120);

      refreshOpenCommentsIfNeeded(220);
    });

    if (!window.__klevbyCentralResumeRouter) {
      window.addEventListener("pageshow", () => {
        setTimeout(() => {
          if (hasActiveLikeRenderProtection()) {
            scheduleLikeRefresh();
            return;
          }

          refreshFeedIfHomeVisible();
        }, 120);
      });

      window.addEventListener("focus", () => {
        setTimeout(() => {
          if (hasActiveLikeRenderProtection()) {
            scheduleLikeRefresh();
            return;
          }

          refreshFeedIfHomeVisible();
        }, 160);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          setTimeout(() => {
            if (hasActiveLikeRenderProtection()) {
              scheduleLikeRefresh();
              return;
            }

            refreshFeedIfHomeVisible();
          }, 160);

          refreshOpenCommentsIfNeeded(220);
        }
      });
    }

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh();
          return;
        }

        refreshFeedIfHomeVisible();
      }, 180);
    });

    window.addEventListener("klevby-feed-updated", handleFeedUpdatedEvent);

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh();
          return;
        }

        refreshFeedIfHomeVisible();
      }, 180);
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
    toggleFeedLikeFromCard: toggleLikeFromCard,
    toggleFeedLike: toggleLikeFromCard,
    toggleLikeFromViewer,
    openProfilePhotoFeedItem,
    openFeedCommentModal
  };

  window.KlevbyFeedActions = actions;

  window.toggleFeedLike = toggleLikeFromCard;
  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.openFeedCommentModal = openFeedCommentModal;
})();
