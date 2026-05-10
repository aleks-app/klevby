(function () {
  let autoRefreshTimer = null;
  let realtimeStarted = false;
  let refreshBound = false;
  let likeRefreshTimer = null;
  let likeResumeResetTimer = null;
  let lastLikeRuntimeResetAt = 0;
  let lastLikeResumeAt = 0;

  const pendingLikeLocks = new Set();
  const viewerLikeState = new Map();
  const likeRenderProtectedUntil = new Map();
  const likeSyncState = new Map();

  const KLEVB_FEED_TABLE = "feed_posts";
  const KLEVB_FEED_LIKES_TABLE = "feed_likes";

  const LIKE_RENDER_PROTECTION_MS = 5200;
  const LIKE_BACKGROUND_REFRESH_MS = 6200;
  const LIKE_PROTECTION_RECHECK_MS = 900;
  const LIKE_PREFLIGHT_TIMEOUT_MS = 850;
  const LIKE_READ_TIMEOUT_MS = 2200;
  const LIKE_WRITE_TIMEOUT_MS = 12000;
  const LIKE_RESUME_REFRESH_DELAY_MS = 180;
  const LIKE_RECENT_RESUME_MS = 14000;
  const LIKE_BACKGROUND_VERIFY_DELAYS = [1400, 3000, 5500, 9000];

  const FEED_AUTO_REFRESH_MS = 45000;

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

  function withSoftTimeout(promise, timeoutMs, fallbackValue = null, label = "operation") {
    const safeTimeout = Math.max(250, Number(timeoutMs || 0) || 0);
    let finished = false;
    let timer = null;

    return new Promise((resolve, reject) => {
      timer = window.setTimeout(() => {
        if (finished) return;

        finished = true;

        console.debug("Klevby feed actions: soft timeout", {
          label,
          timeoutMs: safeTimeout
        });

        resolve(fallbackValue);
      }, safeTimeout);

      Promise.resolve(promise)
        .then((value) => {
          if (finished) return;

          finished = true;

          if (timer) {
            window.clearTimeout(timer);
          }

          resolve(value);
        })
        .catch((error) => {
          if (finished) return;

          finished = true;

          if (timer) {
            window.clearTimeout(timer);
          }

          reject(error);
        });
    });
  }

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function getCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    if (typeof window.klevbyGetCurrentUser === "function") {
      return window.klevbyGetCurrentUser();
    }

    return null;
  }

  async function ensureCurrentUser() {
    let user = getCurrentUser();

    if (user && typeof user.then === "function") {
      try {
        user = await withSoftTimeout(user, LIKE_READ_TIMEOUT_MS, null, "current_user_promise");
      } catch (error) {
        console.debug("Klevby feed actions: current user promise skipped", {
          error: String(error?.message || error)
        });
        user = null;
      }
    }

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await withSoftTimeout(
          window.restoreAuthState("feed_like_action", false),
          LIKE_READ_TIMEOUT_MS,
          null,
          "restore_auth_state"
        );
      } catch (error) {
        console.debug("Klevby feed actions: restore auth skipped", {
          error: String(error?.message || error)
        });
      }
    }

    user = getCurrentUser();

    if (user && typeof user.then === "function") {
      try {
        user = await withSoftTimeout(user, LIKE_READ_TIMEOUT_MS, null, "current_user_after_restore");
      } catch (error) {
        console.debug("Klevby feed actions: current user after restore skipped", {
          error: String(error?.message || error)
        });
        user = null;
      }
    }

    if (user && user.id) {
      return user;
    }

    const db = getSupabaseClient();

    if (db && db.auth && typeof db.auth.getUser === "function") {
      try {
        const result = await withSoftTimeout(
          db.auth.getUser(),
          LIKE_READ_TIMEOUT_MS,
          null,
          "auth_get_user"
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          return authUser;
        }
      } catch (error) {
        console.debug("Klevby feed actions: auth.getUser skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return null;
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

  function isRecentlyResumed() {
    return Date.now() - Number(lastLikeResumeAt || 0) < LIKE_RECENT_RESUME_MS;
  }

  function resetLikeRuntimeState(reason = "resume") {
    const now = Date.now();

    if (now - lastLikeRuntimeResetAt < 180) {
      return;
    }

    lastLikeRuntimeResetAt = now;

    if (likeRefreshTimer) {
      clearTimeout(likeRefreshTimer);
      likeRefreshTimer = null;
    }

    viewerLikeState.clear();
    pendingLikeLocks.clear();
    likeRenderProtectedUntil.clear();

    likeSyncState.forEach((sync) => {
      sync.inFlight = false;
      sync.desiredLiked = null;
      sync.desiredCount = null;
      sync.rollbackSnapshot = null;
    });

    document
      .querySelectorAll(".profile-feed-like-btn, #klevbyFeedViewerLikeBtn")
      .forEach((button) => {
        button.disabled = false;
        button.dataset.pendingLike = "0";
        button.setAttribute("aria-busy", "false");
        button.classList.remove("is-pending-like", "is-pending");
      });

    console.info("Klevby feed actions: like runtime reset", {
      reason
    });
  }

  function recoverFeedAfterResume(reason = "resume", delay = LIKE_RESUME_REFRESH_DELAY_MS) {
    lastLikeResumeAt = Date.now();

    if (likeResumeResetTimer) {
      clearTimeout(likeResumeResetTimer);
      likeResumeResetTimer = null;
    }

    resetLikeRuntimeState(reason);

    setTimeout(() => {
      ensureCurrentUser().catch((error) => {
        console.debug("Klevby feed actions: resume auth warmup skipped", {
          error: String(error?.message || error)
        });
      });
    }, 80);

    likeResumeResetTimer = setTimeout(() => {
      likeResumeResetTimer = null;

      refreshFeedIfHomeVisible();
      refreshOpenCommentsIfNeeded(220);
    }, Math.max(80, Number(delay || LIKE_RESUME_REFRESH_DELAY_MS)));
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
    const safePending = Boolean(pending);

    getLikeButtons(cleanId).forEach((button) => {
      button.textContent = safePending ? `⏳ ${safeCount}` : `👍 ${safeCount}`;
      button.dataset.pendingLike = safePending ? "1" : "0";
      button.dataset.likeCount = String(safeCount);
      button.dataset.feedPostId = cleanId;

      button.disabled = safePending;
      button.setAttribute("aria-busy", safePending ? "true" : "false");
      button.classList.toggle("is-pending-like", safePending);
      button.classList.toggle("is-pending", safePending);

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
    const itemLikesCount = item ? getItemLikesCount(item) : null;

    const likesCount =
      itemLikesCount !== null && Number.isFinite(Number(itemLikesCount))
        ? itemLikesCount
        : buttonCount !== null
          ? buttonCount
          : 0;

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

  async function readDirectLikeState(cleanId) {
    const db = getSupabaseClient();

    if (!db) {
      return null;
    }

    const user = await ensureCurrentUser();

    if (!user || !user.id) {
      return null;
    }

    const rowsResult = await db
      .from(KLEVB_FEED_LIKES_TABLE)
      .select("user_id")
      .eq("post_id", cleanId);

    if (rowsResult.error) {
      throw rowsResult.error;
    }

    const rows = Array.isArray(rowsResult.data) ? rowsResult.data : [];
    const uniqueUsers = new Set();

    rows.forEach((row) => {
      const userId = String(row?.user_id || "").trim();

      if (userId) {
        uniqueUsers.add(userId);
      }
    });

    return {
      liked: uniqueUsers.has(String(user.id)),
      likesCount: uniqueUsers.size
    };
  }

  async function writeDirectLikeState(cleanId, desiredLiked) {
    const db = getSupabaseClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await ensureCurrentUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди, чтобы поставить лайк.");
    }

    const before = await readDirectLikeState(cleanId);

    if (before && before.liked === desiredLiked) {
      return before;
    }

    if (desiredLiked) {
      const addResult = await db
        .from(KLEVB_FEED_LIKES_TABLE)
        .insert([{
          post_id: cleanId,
          user_id: user.id
        }]);

      if (addResult.error && !isDuplicateLikeError(addResult.error)) {
        throw addResult.error;
      }
    } else {
      const removeResult = await db
        .from(KLEVB_FEED_LIKES_TABLE)
        .delete()
        .eq("post_id", cleanId)
        .eq("user_id", user.id);

      if (removeResult.error) {
        throw removeResult.error;
      }
    }

    try {
      const after = await readDirectLikeState(cleanId);

      if (after && typeof after.liked === "boolean") {
        return after;
      }
    } catch (_) {}

    return {
      liked: Boolean(desiredLiked),
      likesCount: null
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
        const result = await withSoftTimeout(
          candidate(cleanId),
          LIKE_READ_TIMEOUT_MS,
          null,
          "like_state_candidate"
        );
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

    try {
      const directState = await withSoftTimeout(
        readDirectLikeState(cleanId),
        LIKE_READ_TIMEOUT_MS,
        null,
        "direct_like_state"
      );

      if (directState && typeof directState.liked === "boolean") {
        return directState;
      }
    } catch (error) {
      console.debug("Klevby feed actions: direct like state skipped", {
        error: String(error?.message || error)
      });
    }

    return null;
  }

  async function callSetLikeStateApi(cleanId, desiredLiked) {
    const api = getApi();

    const candidates = [
      api.setLikeState,
      api.setViewerLikeState,
      api.setPostLikeState,
      api.updateLikeState,
      window.klevbySetFeedLikeState,
      window.klevbySetViewerLikeState,
      window.klevbyFeedSupabase?.setLikeState,
      window.klevbyFeedSupabase?.setViewerLikeState,
      window.klevbyFeedSupabase?.setPostLikeState,
      window.klevbyFeedSupabase?.updateLikeState
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "function") continue;

      try {
        const result = await withSoftTimeout(
          candidate(cleanId, desiredLiked),
          LIKE_WRITE_TIMEOUT_MS,
          null,
          "set_like_candidate"
        );
        const normalized = normalizeLikeStateResult(result);

        if (normalized) {
          return normalized;
        }
      } catch (error) {
        console.debug("Klevby feed actions: explicit set like skipped", {
          error: String(error?.message || error)
        });
      }
    }

    try {
      const directResult = await withSoftTimeout(
        writeDirectLikeState(cleanId, desiredLiked),
        LIKE_WRITE_TIMEOUT_MS,
        null,
        "direct_set_like"
      );

      if (directResult && typeof directResult.liked === "boolean") {
        return directResult;
      }
    } catch (directError) {
      console.debug("Klevby feed actions: direct set like skipped", {
        error: String(directError?.message || directError)
      });

      const beforeToggle = await callReadLikeStateApi(cleanId).catch(() => null);

      if (beforeToggle && beforeToggle.liked === desiredLiked) {
        return beforeToggle;
      }

      const toggleResult = await callToggleLikeApi(cleanId);
      const normalizedToggle = normalizeLikeStateResult(toggleResult);

      if (normalizedToggle) {
        return normalizedToggle;
      }

      return {
        liked: Boolean(desiredLiked),
        likesCount: null
      };
    }

    return {
      liked: Boolean(desiredLiked),
      likesCount: null
    };
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
        return await withSoftTimeout(
          candidate(cleanId),
          LIKE_WRITE_TIMEOUT_MS,
          null,
          "unlike_candidate"
        );
      } catch (error) {
        console.debug("Klevby feed actions: explicit unlike skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return withSoftTimeout(
      writeDirectLikeState(cleanId, false),
      LIKE_WRITE_TIMEOUT_MS,
      null,
      "direct_unlike"
    );
  }

  async function improveUnknownLikeSnapshot(postId, snapshot, force = false) {
    if (!force && typeof snapshot?.liked === "boolean") {
      return snapshot;
    }

    const cleanId = String(postId || "").trim();
    const serverState = await withSoftTimeout(
      callReadLikeStateApi(cleanId),
      LIKE_PREFLIGHT_TIMEOUT_MS,
      null,
      "like_preflight"
    );

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
      item: getCachedFeedItem(cleanId) || snapshot.item,
      likesCount,
      liked: serverState.liked
    };
  }

  function applyOptimisticLike(postId, snapshot) {
    const cleanId = String(postId || "").trim();

    const previousLiked =
      typeof snapshot?.liked === "boolean"
        ? snapshot.liked
        : false;

    const optimisticLiked = !previousLiked;
    const optimisticCount = Math.max(
      0,
      Number(snapshot.likesCount || 0) + (optimisticLiked ? 1 : -1)
    );

    applyLocalLikeState(cleanId, optimisticLiked, optimisticCount);

    return {
      ...snapshot,
      liked: previousLiked,
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

  function scheduleBackgroundLikeVerification(postId, snapshot = {}, reason = "background", attempt = 0) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    const delay = LIKE_BACKGROUND_VERIFY_DELAYS[Math.min(
      Math.max(0, Number(attempt || 0)),
      LIKE_BACKGROUND_VERIFY_DELAYS.length - 1
    )];

    window.setTimeout(async () => {
      try {
        const serverState = await callReadLikeStateApi(cleanId);

        if (serverState && typeof serverState.liked === "boolean") {
          const finalCount =
            serverState.likesCount !== null && serverState.likesCount !== undefined
              ? Math.max(0, Number(serverState.likesCount || 0) || 0)
              : Math.max(0, Number(snapshot.likesCount || 0) || 0);

          applyLocalLikeState(cleanId, serverState.liked, finalCount);
          setLikeButtonsState(cleanId, finalCount, serverState.liked, false);

          const sync = getLikeSync(cleanId);
          sync.inFlight = false;
          sync.rollbackSnapshot = null;
          sync.desiredLiked = serverState.liked;
          sync.desiredCount = finalCount;

          pendingLikeLocks.delete(cleanId);
          protectLikeRender(cleanId, LIKE_RENDER_PROTECTION_MS);
          scheduleLikeRefresh(900);

          console.info("Klevby feed actions: background like verified", {
            postId: cleanId,
            liked: serverState.liked,
            likesCount: finalCount,
            reason,
            attempt
          });

          return;
        }
      } catch (error) {
        console.debug("Klevby feed actions: background like verification skipped", {
          postId: cleanId,
          reason,
          attempt,
          error: String(error?.message || error)
        });
      }

      if (attempt + 1 < LIKE_BACKGROUND_VERIFY_DELAYS.length) {
        scheduleBackgroundLikeVerification(cleanId, snapshot, reason, attempt + 1);
        return;
      }

      pendingLikeLocks.delete(cleanId);

      const sync = getLikeSync(cleanId);
      sync.inFlight = false;
      sync.rollbackSnapshot = null;

      const currentSnapshot = getLikeSnapshot(cleanId);
      const currentLiked = getKnownLikeState(cleanId, currentSnapshot.item);

      setLikeButtonsState(
        cleanId,
        currentSnapshot.likesCount,
        currentLiked,
        false
      );

      refreshFeedIfHomeVisible();
      refreshOpenCommentsIfNeeded(180);

      console.warn("Klevby feed actions: background like verification gave up", {
        postId: cleanId,
        reason
      });
    }, Math.max(500, Number(delay || 0)));
  }

  async function callToggleLikeApi(cleanId) {
    const api = getApi();

    const candidate =
      window.klevbyFeedSupabase && typeof window.klevbyFeedSupabase.toggleLike === "function"
        ? window.klevbyFeedSupabase.toggleLike
        : typeof window.klevbyToggleFeedLike === "function"
          ? window.klevbyToggleFeedLike
          : typeof api.toggleLike === "function"
            ? api.toggleLike
            : null;

    if (typeof candidate !== "function") {
      throw new Error("Лайки ещё не подключены.");
    }

    const timeoutMs = isRecentlyResumed()
      ? Math.max(LIKE_WRITE_TIMEOUT_MS, 14000)
      : LIKE_WRITE_TIMEOUT_MS;

    const result = await withSoftTimeout(
      candidate(cleanId),
      timeoutMs,
      {
        pendingConfirm: true,
        postId: cleanId
      },
      "toggle_like_server_authority"
    );

    return result;
  }

  async function handleDuplicateLikeError(cleanId, snapshot) {
    const shouldTryUnlike =
      snapshot.liked === true ||
      snapshot.liked === null ||
      snapshot.liked === undefined;

    if (shouldTryUnlike) {
      try {
        const unlikeResult = await callUnlikeApi(cleanId);
        const normalizedUnlike = normalizeLikeStateResult(unlikeResult);
        const serverLikesCount = extractServerLikesCount(unlikeResult);
        const finalCount =
          normalizedUnlike?.likesCount !== null && normalizedUnlike?.likesCount !== undefined
            ? normalizedUnlike.likesCount
            : serverLikesCount !== null
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

  function getLikeSync(postId) {
    const cleanId = String(postId || "").trim();

    if (!likeSyncState.has(cleanId)) {
      likeSyncState.set(cleanId, {
        inFlight: false,
        desiredLiked: null,
        desiredCount: null,
        rollbackSnapshot: null,
        lastErrorAt: 0
      });
    }

    return likeSyncState.get(cleanId);
  }

  async function processLikeSync(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return;

    const sync = getLikeSync(cleanId);

    if (sync.inFlight) {
      return;
    }

    sync.inFlight = true;
    pendingLikeLocks.add(cleanId);

    try {
      let attempts = 0;

      while (attempts < 6) {
        attempts += 1;

        const desiredLiked = sync.desiredLiked;

        if (typeof desiredLiked !== "boolean") {
          break;
        }

        const before = await callReadLikeStateApi(cleanId).catch(() => null);

        if (
          before &&
          typeof before.liked === "boolean" &&
          before.liked === desiredLiked
        ) {
          const currentSnapshot = getLikeSnapshot(cleanId);
          const finalCount =
            before.likesCount !== null && before.likesCount !== undefined
              ? before.likesCount
              : currentSnapshot.likesCount;

          applyLocalLikeState(cleanId, desiredLiked, finalCount);
          break;
        }

        const result = await callSetLikeStateApi(cleanId, desiredLiked);
        const normalized = normalizeLikeStateResult(result) || {
          liked: desiredLiked,
          likesCount: null
        };

        const latestDesired = sync.desiredLiked;

        if (
          typeof normalized.liked === "boolean" &&
          normalized.liked === latestDesired
        ) {
          const currentSnapshot = getLikeSnapshot(cleanId);
          const finalCount =
            normalized.likesCount !== null && normalized.likesCount !== undefined
              ? normalized.likesCount
              : currentSnapshot.likesCount;

          applyLocalLikeState(cleanId, normalized.liked, finalCount);
          break;
        }

        if (attempts >= 6) {
          scheduleLikeRefresh(900);
        }
      }
    } catch (error) {
      if (isDuplicateLikeError(error)) {
        const snapshot = getLikeSnapshot(cleanId);
        await handleDuplicateLikeError(cleanId, snapshot);
      } else {
        const rollbackSnapshot = sync.rollbackSnapshot || getLikeSnapshot(cleanId);

        rollbackLikeState(cleanId, rollbackSnapshot);

        console.warn("Klevby feed actions: лайк не сработал", error);

        const now = Date.now();

        if (now - Number(sync.lastErrorAt || 0) > 2500) {
          sync.lastErrorAt = now;
          alert(error?.message || "Не получилось поставить лайк.");
        }
      }
    } finally {
      pendingLikeLocks.delete(cleanId);
      sync.inFlight = false;

      const currentSnapshot = getLikeSnapshot(cleanId);
      const currentLiked = getKnownLikeState(cleanId, currentSnapshot.item);

      setLikeButtonsState(
        cleanId,
        currentSnapshot.likesCount,
        currentLiked,
        false
      );

      if (
        typeof sync.desiredLiked === "boolean" &&
        typeof currentLiked === "boolean" &&
        sync.desiredLiked !== currentLiked
      ) {
        setTimeout(() => {
          processLikeSync(cleanId);
        }, 80);
        return;
      }

      sync.rollbackSnapshot = null;
      protectLikeRender(cleanId, LIKE_RENDER_PROTECTION_MS);
      scheduleLikeRefresh();
    }
  }

  async function toggleLikeFromCard(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    if (pendingLikeLocks.has(cleanId)) {
      const snapshot = getLikeSnapshot(cleanId);

      return {
        postId: cleanId,
        liked: snapshot.liked,
        likesCount: snapshot.likesCount,
        pending: true
      };
    }

    protectLikeRender(cleanId);

    const sync = getLikeSync(cleanId);
    const snapshot = getLikeSnapshot(cleanId);

    sync.inFlight = true;
    sync.rollbackSnapshot = snapshot;
    pendingLikeLocks.add(cleanId);

    setLikeButtonsState(cleanId, snapshot.likesCount, snapshot.liked, true);

    try {
      const result = await callToggleLikeApi(cleanId);

      if (result?.pendingConfirm) {
        console.info("Klevby feed actions: server like pending confirmation", {
          postId: cleanId,
          recentlyResumed: isRecentlyResumed()
        });

        scheduleBackgroundLikeVerification(cleanId, snapshot, "slow_server_confirm", 0);

        return {
          postId: cleanId,
          liked: snapshot.liked,
          likesCount: snapshot.likesCount,
          pending: true
        };
      }

      const normalized = normalizeLikeStateResult(result);

      if (!normalized || typeof normalized.liked !== "boolean") {
        scheduleBackgroundLikeVerification(cleanId, snapshot, "missing_server_state", 0);

        return {
          postId: cleanId,
          liked: snapshot.liked,
          likesCount: snapshot.likesCount,
          pending: true
        };
      }

      let finalLiked = normalized.liked;
      let finalCount =
        normalized.likesCount !== null && normalized.likesCount !== undefined
          ? Math.max(0, Number(normalized.likesCount || 0) || 0)
          : null;

      try {
        const exactAfter = await withSoftTimeout(
          readDirectLikeState(cleanId),
          LIKE_READ_TIMEOUT_MS,
          null,
          "exact_like_after_optional"
        );

        if (exactAfter && typeof exactAfter.liked === "boolean") {
          finalLiked = exactAfter.liked;

          if (Number.isFinite(Number(exactAfter.likesCount))) {
            finalCount = Math.max(0, Number(exactAfter.likesCount || 0));
          }
        }
      } catch (afterError) {
        console.debug("Klevby feed actions: optional exact after skipped", {
          error: String(afterError?.message || afterError)
        });
      }

      if (finalCount === null) {
        const previousLiked =
          typeof snapshot.liked === "boolean"
            ? snapshot.liked
            : !finalLiked;

        finalCount = Math.max(
          0,
          Number(snapshot.likesCount || 0) + (finalLiked && !previousLiked ? 1 : !finalLiked && previousLiked ? -1 : 0)
        );
      }

      applyLocalLikeState(cleanId, finalLiked, finalCount);
      setLikeButtonsState(cleanId, finalCount, finalLiked, false);

      sync.desiredLiked = finalLiked;
      sync.desiredCount = finalCount;

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }

      console.info("Klevby feed actions: server like synced", {
        postId: cleanId,
        finalLiked,
        finalCount
      });

      protectLikeRender(cleanId, LIKE_RENDER_PROTECTION_MS);
      scheduleLikeRefresh(1600);

      return {
        postId: cleanId,
        liked: finalLiked,
        likedByViewer: finalLiked,
        viewerLiked: finalLiked,
        likesCount: finalCount
      };
    } catch (error) {
      if (isRecentlyResumed()) {
        console.warn("Klevby feed actions: like delayed after resume, verifying in background", {
          postId: cleanId,
          error: String(error?.message || error)
        });

        scheduleBackgroundLikeVerification(cleanId, snapshot, "resume_error_background_verify", 0);

        return {
          postId: cleanId,
          liked: snapshot.liked,
          likesCount: snapshot.likesCount,
          pending: true,
          error
        };
      }

      rollbackLikeState(cleanId, snapshot);

      console.warn("Klevby feed actions: лайк не сработал", error);

      const now = Date.now();

      if (now - Number(sync.lastErrorAt || 0) > 2500) {
        sync.lastErrorAt = now;
        alert(error?.message || "Не получилось поставить лайк.");
      }

      return {
        postId: cleanId,
        liked: snapshot.liked,
        likesCount: snapshot.likesCount,
        error
      };
    } finally {
      const stillPending = pendingLikeLocks.has(cleanId) && getLikeButtons(cleanId).some((button) => {
        return button.dataset.pendingLike === "1";
      });

      if (!stillPending) {
        pendingLikeLocks.delete(cleanId);
        sync.inFlight = false;
        sync.rollbackSnapshot = null;

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
    }, FEED_AUTO_REFRESH_MS);
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
      recoverFeedAfterResume("klevby-app-resumed");
    });

    if (!window.__klevbyCentralResumeRouter) {
      window.addEventListener("pageshow", () => {
        recoverFeedAfterResume("pageshow");
      });

      window.addEventListener("focus", () => {
        recoverFeedAfterResume("focus", 220);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          recoverFeedAfterResume("visibilitychange", 220);
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
    openFeedCommentModal,
    resetLikeRuntimeState,
    recoverFeedAfterResume
  };

  window.KlevbyFeedActions = actions;

  window.toggleFeedLike = toggleLikeFromCard;
  window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
  window.openFeedCommentModal = openFeedCommentModal;
})();
