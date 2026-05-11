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

  const KLEVB_FEED_LIKES_TABLE = "feed_likes";
  const SET_LIKE_RPC_NAME = "set_feed_like_rpc";

  const LIKE_RENDER_PROTECTION_MS = 1200;
  const LIKE_BACKGROUND_REFRESH_MS = 1800;
  const LIKE_PROTECTION_RECHECK_MS = 260;
  const LIKE_READ_TIMEOUT_MS = 2200;
  const LIKE_WRITE_TIMEOUT_MS = 6500;
  const LIKE_RPC_REST_TIMEOUT_MS = 5200;
  const LIKE_RESUME_REFRESH_DELAY_MS = 180;
  const LIKE_RECENT_RESUME_MS = 14000;

  const FEED_AUTO_REFRESH_MS = 45000;
  const VIEWER_LIKES_STORAGE_PREFIX = "klevby_feed_viewer_likes_v1";
  const VIEWER_LAST_USER_KEY = "klevby_feed_last_like_user_id";

  function getCore() {
    return window.KlevbyFeedActionsCore || {};
  }

  function getState() {
    const core = getCore();

    if (typeof core.getState === "function") {
      return core.getState();
    }

    return window.KlevbyFeedState || {};
  }

  function getApi() {
    const core = getCore();

    if (typeof core.getApi === "function") {
      return core.getApi();
    }

    return window.KlevbyFeedApi || {};
  }

  function getRender() {
    const core = getCore();

    if (typeof core.getRender === "function") {
      return core.getRender();
    }

    return window.KlevbyFeedRender || {};
  }

  function getModals() {
    const core = getCore();

    if (typeof core.getModals === "function") {
      return core.getModals();
    }

    return window.KlevbyFeedModals || {};
  }

  function getUtils() {
    const core = getCore();

    if (typeof core.getUtils === "function") {
      return core.getUtils();
    }

    return window.KlevbyFeedUtils || {};
  }

  function isPromiseLike(value) {
    const core = getCore();

    if (typeof core.isPromiseLike === "function") {
      return core.isPromiseLike(value);
    }

    return Boolean(value && typeof value.then === "function");
  }

  function withSoftTimeout(promise, timeoutMs, fallbackValue = null, label = "operation") {
    const core = getCore();

    if (typeof core.withSoftTimeout === "function") {
      return core.withSoftTimeout(promise, timeoutMs, fallbackValue, label);
    }

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
    const core = getCore();

    if (typeof core.getSupabaseClient === "function") {
      return core.getSupabaseClient();
    }

    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function getSupabaseUrl() {
    const core = getCore();

    if (typeof core.getSupabaseUrl === "function") {
      return core.getSupabaseUrl();
    }

    return String(
      window.KLEVB_CONFIG?.SUPABASE_URL ||
      window.KlevbyConfig?.SUPABASE_URL ||
      window.SUPABASE_URL ||
      ""
    ).trim().replace(/\/+$/, "");
  }

  function getSupabaseAnonKey() {
    const core = getCore();

    if (typeof core.getSupabaseAnonKey === "function") {
      return core.getSupabaseAnonKey();
    }

    return String(
      window.KLEVB_CONFIG?.SUPABASE_ANON_KEY ||
      window.KlevbyConfig?.SUPABASE_ANON_KEY ||
      window.SUPABASE_ANON_KEY ||
      ""
    ).trim();
  }

  function getCurrentUser() {
    const core = getCore();

    if (typeof core.getCurrentUser === "function") {
      return core.getCurrentUser();
    }

    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    if (typeof window.klevbyGetCurrentUser === "function") {
      return window.klevbyGetCurrentUser();
    }

    return null;
  }

  function isMobileLikeViewport() {
    const core = getCore();

    if (typeof core.isMobileLikeViewport === "function") {
      return core.isMobileLikeViewport();
    }

    try {
      const width = Number(window.innerWidth || document.documentElement.clientWidth || 0);
      const screenMin = Math.min(Number(screen.width || 0), Number(screen.height || 0));

      return (
        width <= 900 ||
        screenMin <= 900 ||
        window.matchMedia("(pointer: coarse)").matches ||
        window.navigator.standalone === true
      );
    } catch (_) {
      return true;
    }
  }

  function rememberViewerUserId(userId) {
    const core = getCore();

    if (typeof core.rememberViewerUserId === "function") {
      core.rememberViewerUserId(userId);
      return;
    }

    const cleanUserId = String(userId || "").trim();

    if (!cleanUserId) return;

    try {
      localStorage.setItem(VIEWER_LAST_USER_KEY, cleanUserId);
    } catch (_) {}
  }

  function getKnownViewerUserIdSync() {
    const core = getCore();

    if (typeof core.getKnownViewerUserIdSync === "function") {
      return core.getKnownViewerUserIdSync();
    }

    const user = getCurrentUser();

    if (user && !isPromiseLike(user) && user.id) {
      const cleanUserId = String(user.id || "").trim();
      rememberViewerUserId(cleanUserId);
      return cleanUserId;
    }

    try {
      return String(localStorage.getItem(VIEWER_LAST_USER_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function readStoredSupabaseAccessToken() {
    const core = getCore();

    if (typeof core.readStoredSupabaseAccessToken === "function") {
      return core.readStoredSupabaseAccessToken();
    }

    try {
      const keys = [];

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) keys.push(key);
      }

      const authKeys = keys.filter((key) => {
        return key.startsWith("sb-") && key.includes("auth-token");
      });

      for (const key of authKeys) {
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          const token =
            parsed?.access_token ||
            parsed?.currentSession?.access_token ||
            parsed?.session?.access_token ||
            parsed?.data?.session?.access_token ||
            "";

          if (token) return String(token);
        } catch (_) {}
      }
    } catch (_) {}

    return "";
  }

  async function getSupabaseAccessToken() {
    const core = getCore();

    if (typeof core.getSupabaseAccessToken === "function") {
      return core.getSupabaseAccessToken();
    }

    const db = getSupabaseClient();

    if (db && db.auth && typeof db.auth.getSession === "function") {
      try {
        const result = await withSoftTimeout(
          db.auth.getSession(),
          900,
          null,
          "auth_get_session_for_like_rpc"
        );

        const token = result?.data?.session?.access_token || "";

        if (token) return String(token);
      } catch (error) {
        console.debug("Klevby feed actions: auth.getSession skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return readStoredSupabaseAccessToken();
  }

  async function ensureCurrentUser() {
    const core = getCore();

    if (typeof core.ensureCurrentUser === "function") {
      return core.ensureCurrentUser({
        timeoutMs: LIKE_READ_TIMEOUT_MS
      });
    }

    let user = getCurrentUser();

    if (isPromiseLike(user)) {
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
      rememberViewerUserId(user.id);
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

    if (isPromiseLike(user)) {
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
      rememberViewerUserId(user.id);
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
          rememberViewerUserId(authUser.id);
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

  function getViewerLikeStorageKey(userId = "") {
    const cleanUserId = String(userId || getKnownViewerUserIdSync() || "anon").trim() || "anon";
    return `${VIEWER_LIKES_STORAGE_PREFIX}:${cleanUserId}`;
  }

  function readViewerLikesCache(userId = "") {
    try {
      const raw = localStorage.getItem(getViewerLikeStorageKey(userId));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeViewerLikeCache(postId, liked, userId = "") {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    try {
      const cache = readViewerLikesCache(userId);
      cache[cleanId] = Boolean(liked);
      localStorage.setItem(getViewerLikeStorageKey(userId), JSON.stringify(cache));
    } catch (_) {}
  }

  function readViewerLikeCacheValue(postId, userId = "") {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    const cache = readViewerLikesCache(userId);

    if (typeof cache[cleanId] === "boolean") {
      return cache[cleanId];
    }

    return null;
  }

  function isHomeVisible() {
    const core = getCore();

    if (typeof core.isHomeVisible === "function") {
      return core.isHomeVisible();
    }

    const homeSection = document.getElementById("homeSection");

    return Boolean(homeSection && !homeSection.classList.contains("hidden"));
  }

  function renderFeed() {
    const core = getCore();

    if (typeof core.renderFeed === "function") {
      return core.renderFeed();
    }

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
    const core = getCore();

    if (typeof core.refreshFeedIfHomeVisible === "function") {
      return core.refreshFeedIfHomeVisible();
    }

    if (!isHomeVisible()) return Promise.resolve();

    return renderFeed();
  }

  function refreshOpenCommentsIfNeeded(delay = 140) {
    const core = getCore();

    if (typeof core.refreshOpenCommentsIfNeeded === "function") {
      return core.refreshOpenCommentsIfNeeded(delay);
    }

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
    const core = getCore();

    if (typeof core.getLastItemsArray === "function") {
      return core.getLastItemsArray();
    }

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
    const core = getCore();

    if (typeof core.setLastItemsArray === "function") {
      core.setLastItemsArray(items);
      return;
    }

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
    const core = getCore();

    if (typeof core.getCachedFeedItem === "function") {
      return core.getCachedFeedItem(postId);
    }

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
    const core = getCore();

    if (typeof core.getItemLikesCount === "function") {
      return core.getItemLikesCount(item);
    }

    return Math.max(0, Number(item?.likesCount || item?.likes_count || 0) || 0);
  }

  function getKnownLikeStateFromItem(item) {
    const core = getCore();

    if (typeof core.getKnownLikeStateFromItem === "function") {
      return core.getKnownLikeStateFromItem(item);
    }

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

  function releaseLikeButtonVisualState(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return;

    const release = () => {
      getLikeButtons(cleanId).forEach((button) => {
        try {
          button.classList.remove("is-pending-like", "is-pending");

          if (button.dataset.pendingLike === "1") {
            button.dataset.pendingLike = "0";
          }

          button.setAttribute("aria-busy", "false");

          if (document.activeElement === button && typeof button.blur === "function") {
            button.blur();
          }
        } catch (_) {}
      });
    };

    release();

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(release);
    }

    window.setTimeout(release, 60);
    window.setTimeout(release, 180);
    window.setTimeout(release, 420);
  }

  function getKnownLikeState(postId, item = null) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return null;

    if (viewerLikeState.has(cleanId)) {
      return viewerLikeState.get(cleanId);
    }

    const button = getLikeButtons(cleanId)[0];

    if (button?.dataset?.liked === "true") return true;
    if (button?.dataset?.liked === "false") return false;

    const cachedLiked = readViewerLikeCacheValue(cleanId);

    if (typeof cachedLiked === "boolean") {
      return cachedLiked;
    }

    return getKnownLikeStateFromItem(item);
  }

  function isButtonHoveredOrFocused(button) {
    if (!button) return false;

    if (isMobileLikeViewport()) {
      return false;
    }

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
    releaseLikeButtonVisualState(cleanId);
  }

  function protectLikeRender(postId, duration = LIKE_RENDER_PROTECTION_MS) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return;

    const until = Date.now() + Math.max(450, Number(duration || LIKE_RENDER_PROTECTION_MS));

    likeRenderProtectedUntil.set(cleanId, until);

    setTimeout(() => {
      cleanupLikeRenderProtection(cleanId);
    }, Math.max(520, Number(duration || LIKE_RENDER_PROTECTION_MS) + 80));
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
    releaseLikeButtonVisualState(cleanId);
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

        if (document.activeElement === button && typeof button.blur === "function") {
          button.blur();
        }
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
    const core = getCore();

    if (typeof core.extractPostIdFromDetail === "function") {
      return core.extractPostIdFromDetail(detail);
    }

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
    const core = getCore();

    if (typeof core.isFeedLikeUpdateDetail === "function") {
      return core.isFeedLikeUpdateDetail(detail);
    }

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
      button.textContent = `👍 ${safeCount}`;
      button.dataset.pendingLike = safePending ? "1" : "0";
      button.dataset.likeCount = String(safeCount);
      button.dataset.feedPostId = cleanId;

      button.disabled = false;
      button.setAttribute("aria-busy", safePending ? "true" : "false");
      button.classList.toggle("is-pending-like", false);
      button.classList.toggle("is-pending", false);

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

    releaseLikeButtonVisualState(cleanId);
  }

  function patchLocalFeedItem(postId, patch = {}) {
    const core = getCore();

    if (typeof core.patchLocalFeedItem === "function") {
      return core.patchLocalFeedItem(postId, patch);
    }

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
    const buttonCount = getButtonLikesCount(cleanId);
    const itemLikesCount = item ? getItemLikesCount(item) : null;

    const likesCount =
      itemLikesCount !== null && Number.isFinite(Number(itemLikesCount))
        ? itemLikesCount
        : buttonCount !== null
          ? buttonCount
          : 0;

    let liked = getKnownLikeState(cleanId, item);

    if (typeof liked !== "boolean") {
      liked = false;
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
    writeViewerLikeCache(cleanId, safeLiked);

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

    setLikeButtonsState(cleanId, safeCount, safeLiked, false);
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

  function getRpcPayloadCandidates(cleanId, desiredLiked) {
    const safeLiked = Boolean(desiredLiked);

    return [
      { p_post_id: cleanId, p_liked: safeLiked },
      { post_id: cleanId, liked: safeLiked },
      { post_id_input: cleanId, liked_input: safeLiked },
      { target_post_id: cleanId, target_liked: safeLiked }
    ];
  }

  async function callSetLikeRpcRest(cleanId, desiredLiked) {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    const accessToken = await getSupabaseAccessToken();

    if (!url || !anonKey || !accessToken || typeof fetch !== "function") {
      return null;
    }

    let lastError = null;
    const endpoint = `${url}/rest/v1/rpc/${SET_LIKE_RPC_NAME}`;

    for (const payload of getRpcPayloadCandidates(cleanId, desiredLiked)) {
      try {
        const controller = typeof AbortController !== "undefined"
          ? new AbortController()
          : null;
        const timeout = controller
          ? setTimeout(() => controller.abort(), LIKE_RPC_REST_TIMEOUT_MS)
          : null;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller?.signal
        });

        if (timeout) clearTimeout(timeout);

        const text = await response.text();
        let data = null;

        if (text) {
          try {
            data = JSON.parse(text);
          } catch (_) {
            data = text;
          }
        }

        if (!response.ok) {
          const message =
            data?.message ||
            data?.details ||
            data?.hint ||
            text ||
            `RPC ${SET_LIKE_RPC_NAME} failed with ${response.status}`;

          lastError = new Error(message);
          lastError.status = response.status;
          continue;
        }

        return data;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  async function callSetLikeRpcSdk(cleanId, desiredLiked) {
    const db = getSupabaseClient();

    if (!db || typeof db.rpc !== "function") {
      return null;
    }

    let lastError = null;

    for (const payload of getRpcPayloadCandidates(cleanId, desiredLiked)) {
      try {
        const response = await withSoftTimeout(
          db.rpc(SET_LIKE_RPC_NAME, payload),
          LIKE_WRITE_TIMEOUT_MS,
          { __klevbyTimeout: true },
          "set_like_rpc_sdk"
        );

        if (response?.__klevbyTimeout) {
          lastError = new Error("Supabase не успел подтвердить лайк.");
          continue;
        }

        if (response?.error) {
          lastError = response.error;
          continue;
        }

        return response?.data ?? response;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
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
      .eq("post_id", cleanId)
      .limit(10000);

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

    const liked = uniqueUsers.has(String(user.id));
    const likesCount = uniqueUsers.size;

    writeViewerLikeCache(cleanId, liked, user.id);

    return {
      liked,
      likesCount
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

    const after = await readDirectLikeState(cleanId);

    if (after && typeof after.liked === "boolean") {
      return after;
    }

    writeViewerLikeCache(cleanId, Boolean(desiredLiked), user.id);

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

        if (normalized && typeof normalized.liked === "boolean") {
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
    let lastError = null;

    try {
      const restResult = await callSetLikeRpcRest(cleanId, desiredLiked);
      const normalizedRest = normalizeLikeStateResult(restResult);

      if (normalizedRest && typeof normalizedRest.liked === "boolean") {
        return restResult;
      }
    } catch (error) {
      lastError = error;
      console.debug("Klevby feed actions: REST RPC set like skipped", {
        error: String(error?.message || error)
      });
    }

    try {
      const sdkResult = await callSetLikeRpcSdk(cleanId, desiredLiked);
      const normalizedSdk = normalizeLikeStateResult(sdkResult);

      if (normalizedSdk && typeof normalizedSdk.liked === "boolean") {
        return sdkResult;
      }
    } catch (error) {
      lastError = error;
      console.debug("Klevby feed actions: SDK RPC set like skipped", {
        error: String(error?.message || error)
      });
    }

    try {
      const directResult = await withSoftTimeout(
        writeDirectLikeState(cleanId, desiredLiked),
        LIKE_WRITE_TIMEOUT_MS,
        null,
        "direct_set_like_fallback"
      );

      if (directResult && typeof directResult.liked === "boolean") {
        return directResult;
      }
    } catch (error) {
      lastError = error;
    }

    throw lastError || new Error("Supabase не подтвердил лайк.");
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
    }, Math.max(300, Number(delay || LIKE_BACKGROUND_REFRESH_MS)));
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

  async function commitLikeState(cleanId, desiredLiked, optimisticCount) {
    const result = await callSetLikeStateApi(cleanId, desiredLiked);
    let normalized = normalizeLikeStateResult(result);

    if (!normalized || typeof normalized.liked !== "boolean") {
      const exactAfter = await withSoftTimeout(
        readDirectLikeState(cleanId),
        LIKE_READ_TIMEOUT_MS,
        null,
        "exact_like_after_missing_state"
      );

      normalized = normalizeLikeStateResult(exactAfter);
    }

    if (!normalized || typeof normalized.liked !== "boolean") {
      throw new Error("Supabase не вернул состояние лайка.");
    }

    if (normalized.likesCount === null || normalized.likesCount === undefined) {
      normalized.likesCount = optimisticCount;
    }

    return normalized;
  }

  async function verifyLikeAfterError(cleanId) {
    try {
      const state = await withSoftTimeout(
        callReadLikeStateApi(cleanId),
        LIKE_READ_TIMEOUT_MS,
        null,
        "like_error_verify"
      );

      if (state && typeof state.liked === "boolean") {
        return state;
      }
    } catch (_) {}

    return null;
  }

  async function toggleLikeFromCard(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return;

    if (pendingLikeLocks.has(cleanId)) {
      const snapshot = getLikeSnapshot(cleanId);

      releaseLikeButtonVisualState(cleanId);

      return {
        postId: cleanId,
        liked: snapshot.liked,
        likesCount: snapshot.likesCount,
        pending: true
      };
    }

    const snapshot = getLikeSnapshot(cleanId);
    const desiredLiked = !Boolean(snapshot.liked);
    const optimisticCount = Math.max(
      0,
      Number(snapshot.likesCount || 0) + (desiredLiked ? 1 : -1)
    );

    const sync = getLikeSync(cleanId);

    sync.inFlight = true;
    sync.rollbackSnapshot = snapshot;
    sync.desiredLiked = desiredLiked;
    sync.desiredCount = optimisticCount;

    pendingLikeLocks.add(cleanId);
    protectLikeRender(cleanId);

    applyLocalLikeState(cleanId, desiredLiked, optimisticCount);
    setLikeButtonsState(cleanId, optimisticCount, desiredLiked, false);
    releaseLikeButtonVisualState(cleanId);

    if (navigator.vibrate) {
      navigator.vibrate(12);
    }

    console.info("Klevby feed actions: optimistic like applied", {
      postId: cleanId,
      desiredLiked,
      optimisticCount
    });

    try {
      const normalized = await commitLikeState(cleanId, desiredLiked, optimisticCount);
      const finalLiked = Boolean(normalized.liked);
      const finalCount = Math.max(0, Number(normalized.likesCount || 0) || 0);

      applyLocalLikeState(cleanId, finalLiked, finalCount);
      setLikeButtonsState(cleanId, finalCount, finalLiked, false);
      releaseLikeButtonVisualState(cleanId);

      sync.desiredLiked = finalLiked;
      sync.desiredCount = finalCount;

      console.info("Klevby feed actions: RPC like synced", {
        postId: cleanId,
        finalLiked,
        finalCount
      });

      protectLikeRender(cleanId, LIKE_RENDER_PROTECTION_MS);
      scheduleLikeRefresh(900);

      return {
        postId: cleanId,
        liked: finalLiked,
        likedByViewer: finalLiked,
        viewerLiked: finalLiked,
        likesCount: finalCount
      };
    } catch (error) {
      const verified = await verifyLikeAfterError(cleanId);

      if (verified && typeof verified.liked === "boolean") {
        const verifiedCount =
          verified.likesCount !== null && verified.likesCount !== undefined
            ? Math.max(0, Number(verified.likesCount || 0) || 0)
            : optimisticCount;

        applyLocalLikeState(cleanId, verified.liked, verifiedCount);
        setLikeButtonsState(cleanId, verifiedCount, verified.liked, false);
        releaseLikeButtonVisualState(cleanId);
        scheduleLikeRefresh(900);

        console.warn("Klevby feed actions: like verified after error", {
          postId: cleanId,
          error: String(error?.message || error)
        });

        return {
          postId: cleanId,
          liked: verified.liked,
          likesCount: verifiedCount,
          recovered: true
        };
      }

      rollbackLikeState(cleanId, snapshot);
      releaseLikeButtonVisualState(cleanId);

      console.warn("Klevby feed actions: лайк не сработал", error);

      const now = Date.now();
      const recentlyResumed = now - Number(lastLikeResumeAt || 0) < LIKE_RECENT_RESUME_MS;

      if (!recentlyResumed && now - Number(sync.lastErrorAt || 0) > 2500) {
        sync.lastErrorAt = now;
        alert(error?.message || "Не получилось поставить лайк.");
      }

      if (recentlyResumed) {
        scheduleLikeRefresh(900);
      }

      return {
        postId: cleanId,
        liked: snapshot.liked,
        likesCount: snapshot.likesCount,
        error
      };
    } finally {
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

      releaseLikeButtonVisualState(cleanId);
    }
  }

  function rollbackLikeState(postId, snapshot) {
    const cleanId = String(postId || "").trim();

    viewerLikeState.set(cleanId, Boolean(snapshot.liked));
    writeViewerLikeCache(cleanId, Boolean(snapshot.liked));

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
    releaseLikeButtonVisualState(cleanId);
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

      releaseLikeButtonVisualState(cleanId);
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
      scheduleLikeRefresh(700);
      return;
    }

    setTimeout(() => {
      if (hasActiveLikeRenderProtection()) {
        scheduleLikeRefresh(700);
        return;
      }

      renderFeed();
    }, 120);

    const modal = document.getElementById("klevbyFeedCommentModal");
    const activePostId = String(modal?.dataset?.postId || "");

    if (
      modal &&
      !modal.classList.contains("hidden") &&
      activePostId &&
      (!changedPostId || changedPostId === activePostId)
    ) {
      refreshOpenCommentsIfNeeded(180);
    }
  }

  function tryStartRealtimeSubscription() {
    if (realtimeStarted) return;

    const api = getApi();

    const refresh = (detail = {}) => {
      if (shouldDelayRenderForLikeUpdate(detail)) {
        scheduleLikeRefresh(700);
        return;
      }

      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh(700);
          return;
        }

        refreshFeedIfHomeVisible();
      }, 90);

      refreshOpenCommentsIfNeeded(160);
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
      viewerLikeState.clear();

      setTimeout(() => {
        if (hasActiveLikeRenderProtection()) {
          scheduleLikeRefresh(700);
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
          scheduleLikeRefresh(700);
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
