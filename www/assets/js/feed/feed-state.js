(function () {
  const KLEVB_FEED_STATE_VERSION = "20260507-feed-state-1";

  const KLEVB_FEED_PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_FEED_PROFILE_SETTINGS_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_FEED_VIEWER_KEY = "klevby_feed_viewer_key";

  const KLEVB_FEED_BUCKET = "feed-photos";
  const KLEVB_FEED_TABLE = "feed_posts";
  const KLEVB_FEED_LIKES_TABLE = "feed_likes";
  const KLEVB_FEED_COMMENTS_TABLE = "feed_comments";
  const KLEVB_FEED_VIEWS_TABLE = "feed_post_views";

  const state = {
    version: KLEVB_FEED_STATE_VERSION,
    renderToken: 0,
    lastItems: [],
    itemsCache: {},
    autoRefreshTimer: null,
    realtimeStarted: false,
    activeCommentPostId: "",
    isReady: false
  };

  const constants = {
    KLEVB_FEED_PROFILE_PHOTOS_KEY,
    KLEVB_FEED_PROFILE_AVATAR_KEY,
    KLEVB_FEED_PROFILE_SETTINGS_KEY,
    KLEVB_FEED_PROFILE_NAME_KEY,
    KLEVB_FEED_VIEWER_KEY,
    KLEVB_FEED_BUCKET,
    KLEVB_FEED_TABLE,
    KLEVB_FEED_LIKES_TABLE,
    KLEVB_FEED_COMMENTS_TABLE,
    KLEVB_FEED_VIEWS_TABLE
  };

  function getState() {
    return state;
  }

  function getConstants() {
    return constants;
  }

  function nextRenderToken() {
    state.renderToken += 1;
    return state.renderToken;
  }

  function getRenderToken() {
    return state.renderToken;
  }

  function setLastItems(items) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

    state.lastItems = safeItems;
    state.itemsCache = {};

    safeItems.forEach((item) => {
      if (item && item.id) {
        state.itemsCache[String(item.id)] = item;
      }
    });

    return safeItems;
  }

  function getLastItems() {
    return Array.isArray(state.lastItems) ? state.lastItems : [];
  }

  function getItemsCache() {
    return state.itemsCache || {};
  }

  function getItemById(id) {
    const cleanId = String(id || "").trim();

    if (!cleanId) return null;

    return state.itemsCache[cleanId] || null;
  }

  function setAutoRefreshTimer(timer) {
    state.autoRefreshTimer = timer || null;
  }

  function getAutoRefreshTimer() {
    return state.autoRefreshTimer || null;
  }

  function setRealtimeStarted(value) {
    state.realtimeStarted = Boolean(value);
  }

  function isRealtimeStarted() {
    return Boolean(state.realtimeStarted);
  }

  function setActiveCommentPostId(postId) {
    state.activeCommentPostId = String(postId || "").trim();
  }

  function getActiveCommentPostId() {
    return String(state.activeCommentPostId || "").trim();
  }

  function setReady(value) {
    state.isReady = Boolean(value);
  }

  function isReady() {
    return Boolean(state.isReady);
  }

  window.KlevbyFeedState = {
    version: KLEVB_FEED_STATE_VERSION,
    constants,
    getState,
    getConstants,
    nextRenderToken,
    getRenderToken,
    setLastItems,
    getLastItems,
    getItemsCache,
    getItemById,
    setAutoRefreshTimer,
    getAutoRefreshTimer,
    setRealtimeStarted,
    isRealtimeStarted,
    setActiveCommentPostId,
    getActiveCommentPostId,
    setReady,
    isReady
  };
})();
