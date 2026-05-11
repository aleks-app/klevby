(function () {
  const ACTIONS_CORE_VERSION = "20260511-actions-core-2";

  const DEFAULT_SOFT_TIMEOUT_MS = 2200;
  const AUTH_SESSION_TIMEOUT_MS = 900;
  const VIEWER_LAST_USER_KEY = "klevby_feed_last_like_user_id";

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

  function isPromiseLike(value) {
    return Boolean(value && typeof value.then === "function");
  }

  function withSoftTimeout(promise, timeoutMs, fallbackValue = null, label = "operation") {
    const safeTimeout = Math.max(250, Number(timeoutMs || 0) || 0);
    let finished = false;
    let timer = null;

    return new Promise((resolve, reject) => {
      timer = window.setTimeout(() => {
        if (finished) return;

        finished = true;

        console.debug("Klevby feed actions core: soft timeout", {
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

  function getSupabaseUrl() {
    return String(
      window.KLEVB_CONFIG?.SUPABASE_URL ||
      window.KlevbyConfig?.SUPABASE_URL ||
      window.SUPABASE_URL ||
      ""
    )
      .trim()
      .replace(/\/+$/, "");
  }

  function getSupabaseAnonKey() {
    return String(
      window.KLEVB_CONFIG?.SUPABASE_ANON_KEY ||
      window.KlevbyConfig?.SUPABASE_ANON_KEY ||
      window.SUPABASE_ANON_KEY ||
      ""
    ).trim();
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

  function rememberViewerUserId(userId) {
    const cleanUserId = String(userId || "").trim();

    if (!cleanUserId) return;

    try {
      localStorage.setItem(VIEWER_LAST_USER_KEY, cleanUserId);
    } catch (_) {}
  }

  function getKnownViewerUserIdSync() {
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
    const db = getSupabaseClient();

    if (db && db.auth && typeof db.auth.getSession === "function") {
      try {
        const result = await withSoftTimeout(
          db.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
          null,
          "auth_get_session_for_actions_core"
        );

        const token = result?.data?.session?.access_token || "";

        if (token) return String(token);
      } catch (error) {
        console.debug("Klevby feed actions core: auth.getSession skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return readStoredSupabaseAccessToken();
  }

  async function ensureCurrentUser(options = {}) {
    const timeoutMs = Math.max(
      600,
      Number(options.timeoutMs || DEFAULT_SOFT_TIMEOUT_MS) || DEFAULT_SOFT_TIMEOUT_MS
    );

    let user = getCurrentUser();

    if (isPromiseLike(user)) {
      try {
        user = await withSoftTimeout(user, timeoutMs, null, "current_user_promise");
      } catch (error) {
        console.debug("Klevby feed actions core: current user promise skipped", {
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
          window.restoreAuthState("feed_action_core", false),
          timeoutMs,
          null,
          "restore_auth_state"
        );
      } catch (error) {
        console.debug("Klevby feed actions core: restore auth skipped", {
          error: String(error?.message || error)
        });
      }
    }

    user = getCurrentUser();

    if (isPromiseLike(user)) {
      try {
        user = await withSoftTimeout(user, timeoutMs, null, "current_user_after_restore");
      } catch (error) {
        console.debug("Klevby feed actions core: current user after restore skipped", {
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
          timeoutMs,
          null,
          "auth_get_user"
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          rememberViewerUserId(authUser.id);
          return authUser;
        }
      } catch (error) {
        console.debug("Klevby feed actions core: auth.getUser skipped", {
          error: String(error?.message || error)
        });
      }
    }

    return null;
  }

  function isMobileLikeViewport() {
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

  function removeLocalFeedItem(postId) {
    const cleanId = String(postId || "").trim();

    if (!cleanId) return false;

    const items = getLastItemsArray();
    const nextItems = items.filter((item) => String(item?.id || "") !== cleanId);
    const changed = nextItems.length !== items.length;

    if (changed) {
      setLastItemsArray(nextItems);
    }

    return changed;
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

  function isFeedLikeUpdateDetail(detail = {}) {
    const action = String(detail?.action || "").toLowerCase();
    const table = String(detail?.table || detail?.payload?.table || "").toLowerCase();

    return action.includes("like") || table.includes("feed_likes");
  }

  function safeJsonParse(raw, fallbackValue = null) {
    try {
      return raw ? JSON.parse(raw) : fallbackValue;
    } catch (_) {
      return fallbackValue;
    }
  }

  function safeLocalStorageGet(key, fallbackValue = "") {
    try {
      const value = localStorage.getItem(key);
      return value === null || value === undefined ? fallbackValue : value;
    } catch (_) {
      return fallbackValue;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeLocalStorageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  window.KlevbyFeedActionsCore = {
    ACTIONS_CORE_VERSION,

    DEFAULT_SOFT_TIMEOUT_MS,
    AUTH_SESSION_TIMEOUT_MS,
    VIEWER_LAST_USER_KEY,

    getState,
    getApi,
    getRender,
    getModals,
    getUtils,

    isPromiseLike,
    withSoftTimeout,

    getSupabaseClient,
    getSupabaseUrl,
    getSupabaseAnonKey,
    getCurrentUser,
    rememberViewerUserId,
    getKnownViewerUserIdSync,
    readStoredSupabaseAccessToken,
    getSupabaseAccessToken,
    ensureCurrentUser,

    isMobileLikeViewport,
    isHomeVisible,
    renderFeed,
    refreshFeedIfHomeVisible,
    refreshOpenCommentsIfNeeded,

    getLastItemsArray,
    setLastItemsArray,
    getCachedFeedItem,
    patchLocalFeedItem,
    removeLocalFeedItem,

    getItemLikesCount,
    getKnownLikeStateFromItem,
    extractPostIdFromDetail,
    isFeedLikeUpdateDetail,

    safeJsonParse,
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeLocalStorageRemove
  };

  console.info("Klevby feed actions core loaded", {
    version: ACTIONS_CORE_VERSION
  });
})();
