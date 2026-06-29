(function () {
  "use strict";

  let api = null;
  let compatBridge = null;

  const LEGACY_ALIASES = {
    loadPosts: "klevbyLoadFeedPostsFromSupabase",
    createPhotoPost: "klevbyCreateFeedPhotoPost",
    deletePost: "klevbyDeleteFeedPostFromSupabase",
    toggleLike: "klevbyToggleFeedLike",
    loadComments: "klevbyLoadFeedComments",
    addComment: "klevbyAddFeedComment",
    deleteComment: "klevbyDeleteFeedComment",
    registerView: "klevbyRegisterFeedView",
    subscribeToFeedChanges: "klevbySubscribeToFeedChanges",
    unsubscribe: "klevbyUnsubscribeFromFeedChanges"
  };

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function isOwnFunction(fn) {
    if (typeof fn !== "function") return false;

    const apiValues = api ? Object.values(api) : [];
    const bridgeValues = compatBridge ? Object.values(compatBridge) : [];

    return apiValues.includes(fn) || bridgeValues.includes(fn);
  }

  function getSupabaseApiSource() {
    const source = window.klevbyFeedSupabase;

    if (
      source &&
      typeof source === "object" &&
      source !== api &&
      source !== compatBridge
    ) {
      return source;
    }

    return null;
  }

  function getLegacyAlias(name) {
    const fn = window[name];

    if (typeof fn === "function" && !isOwnFunction(fn)) {
      return fn;
    }

    return null;
  }

  function getMissingError(methodName) {
    return new Error(
      `Klevby feed api: метод ${methodName} недоступен. Проверь подключение assets/js/feed-supabase.js.`
    );
  }

  function dispatchFeedUpdated(detail = {}) {
    const utils = getUtils();

    if (typeof utils.dispatchFeedUpdated === "function") {
      utils.dispatchFeedUpdated(detail);
      return;
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail
    }));
  }

  function normalizePost(row) {
    if (!row) return null;

    const utils = getUtils();

    if (typeof utils.normalizePost === "function") {
      return utils.normalizePost(row);
    }

    return {
      type: row.type || "profile_photo",
      id: row.id,
      userId: row.user_id || "",
      authorName: row.author_name || "Рыбак",
      authorCity: row.author_city || "",
      authorTelegram: row.author_telegram || "",
      authorAvatar: row.author_avatar_url || row.author_avatar || "",
      authorAvatarUrl: row.author_avatar_url || row.author_avatar || "",
      title: row.caption || "Фото с рыбалки",
      caption: row.caption || "",
      image: row.image_url || "",
      imagePath: row.image_path || "",
      imageUrl: row.image_url || "",
      width: Number(row.image_width || 0),
      height: Number(row.image_height || 0),
      savedSizeKb: Number(row.image_size_kb || 0),
      likesCount: Number(row.likes_count || 0),
      commentsCount: Number(row.comments_count || 0),
      viewsCount: Number(row.views_count || 0),
      engagementScore: Number(row.engagement_score || 0),
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      source: "supabase"
    };
  }

  async function loadPosts(options = {}) {
    const source = getSupabaseApiSource();

    if (source && typeof source.loadPosts === "function") {
      return source.loadPosts(options);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.loadPosts);

    if (legacyFn) {
      return legacyFn(options);
    }

    return {
      ok: false,
      items: [],
      error: getMissingError("loadPosts")
    };
  }

  async function loadSupabaseFeedItems(options = {}) {
    return loadPosts(options);
  }

  async function getFeedItemsForRender(options = {}) {
    const utils = getUtils();
    const supabaseResult = await loadPosts({
      limit: options.limit || 40
    });

    if (supabaseResult.ok && Array.isArray(supabaseResult.items) && supabaseResult.items.length) {
      let rankedItems = supabaseResult.items;
      const ranking = window.KlevbyFeedRanking || null;

      if (ranking && typeof ranking.rankFeedItems === "function") {
        try {
          rankedItems = ranking.rankFeedItems(supabaseResult.items, {});
        } catch (error) {
          console.warn("Klevby feed api: ranking fallback to original order", error);
          rankedItems = supabaseResult.items;
        }
      }

      return {
        source: "supabase",
        items: rankedItems
      };
    }

    let localItems = [];

    if (typeof utils.getFilteredProfileFeedItems === "function") {
      try {
        localItems = utils.getFilteredProfileFeedItems({});
      } catch (error) {
        console.warn("Klevby feed api: локальная лента не получена", error);
      }
    }

    if (Array.isArray(localItems) && localItems.length) {
      return {
        source: "local",
        items: localItems
      };
    }

    return {
      source: supabaseResult.ok ? "supabase_empty" : "local_empty",
      items: []
    };
  }

  async function createPhotoPost(photoData = {}) {
    const source = getSupabaseApiSource();

    if (source && typeof source.createPhotoPost === "function") {
      return source.createPhotoPost(photoData);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.createPhotoPost);

    if (legacyFn) {
      return legacyFn(photoData);
    }

    throw getMissingError("createPhotoPost");
  }

  async function deletePost(postId, imagePath = "") {
    const source = getSupabaseApiSource();

    if (source && typeof source.deletePost === "function") {
      return source.deletePost(postId, imagePath);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.deletePost);

    if (legacyFn) {
      return legacyFn(postId, imagePath);
    }

    throw getMissingError("deletePost");
  }

  async function toggleLike(postId) {
    const source = getSupabaseApiSource();

    if (source && typeof source.toggleLike === "function") {
      return source.toggleLike(postId);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.toggleLike);

    if (legacyFn) {
      return legacyFn(postId);
    }

    throw getMissingError("toggleLike");
  }

  async function loadComments(postId) {
    const source = getSupabaseApiSource();

    if (source && typeof source.loadComments === "function") {
      return source.loadComments(postId);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.loadComments);

    if (legacyFn) {
      return legacyFn(postId);
    }

    return {
      ok: false,
      comments: [],
      error: getMissingError("loadComments")
    };
  }

  async function addComment(postId, text) {
    const source = getSupabaseApiSource();

    if (source && typeof source.addComment === "function") {
      return source.addComment(postId, text);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.addComment);

    if (legacyFn) {
      return legacyFn(postId, text);
    }

    throw getMissingError("addComment");
  }

  async function deleteComment(commentId) {
    const source = getSupabaseApiSource();

    if (source && typeof source.deleteComment === "function") {
      return source.deleteComment(commentId);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.deleteComment);

    if (legacyFn) {
      return legacyFn(commentId);
    }

    throw getMissingError("deleteComment");
  }

  async function registerView(postId) {
    const source = getSupabaseApiSource();

    if (source && typeof source.registerView === "function") {
      return source.registerView(postId);
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.registerView);

    if (legacyFn) {
      return legacyFn(postId);
    }

    return false;
  }

  function subscribeToFeedChanges(callback) {
    const source = getSupabaseApiSource();

    if (source) {
      if (typeof source.subscribeToFeedChanges === "function") {
        return source.subscribeToFeedChanges(callback);
      }

      if (typeof source.subscribeToChanges === "function") {
        return source.subscribeToChanges(callback);
      }

      if (typeof source.subscribe === "function") {
        return source.subscribe(callback);
      }
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.subscribeToFeedChanges);

    if (legacyFn) {
      return legacyFn(callback);
    }

    return null;
  }

  async function unsubscribe() {
    const source = getSupabaseApiSource();

    if (source && typeof source.unsubscribe === "function") {
      return source.unsubscribe();
    }

    const legacyFn = getLegacyAlias(LEGACY_ALIASES.unsubscribe);

    if (legacyFn) {
      return legacyFn();
    }

    return null;
  }

  api = {
    normalizePost,
    dispatchFeedUpdated,
    loadPosts,
    loadSupabaseFeedItems,
    getFeedItemsForRender,
    createPhotoPost,
    deletePost,
    toggleLike,
    loadComments,
    addComment,
    deleteComment,
    registerView,
    subscribeToFeedChanges,
    subscribeToChanges: subscribeToFeedChanges,
    subscribe: subscribeToFeedChanges,
    unsubscribe
  };

  compatBridge = {
    loadPosts,
    createPhotoPost,
    deletePost,
    toggleLike,
    loadComments,
    addComment,
    deleteComment,
    registerView,
    subscribeToFeedChanges,
    subscribeToChanges: subscribeToFeedChanges,
    subscribe: subscribeToFeedChanges,
    unsubscribe
  };

  window.KlevbyFeedApi = api;

  if (!window.klevbyFeedSupabase) {
    window.klevbyFeedSupabase = compatBridge;
  }

  if (!window.klevbyLoadFeedPostsFromSupabase) {
    window.klevbyLoadFeedPostsFromSupabase = loadPosts;
  }

  if (!window.klevbyCreateFeedPhotoPost) {
    window.klevbyCreateFeedPhotoPost = createPhotoPost;
  }

  if (!window.klevbyDeleteFeedPostFromSupabase) {
    window.klevbyDeleteFeedPostFromSupabase = deletePost;
  }

  if (!window.klevbyToggleFeedLike) {
    window.klevbyToggleFeedLike = toggleLike;
  }

  if (!window.klevbyLoadFeedComments) {
    window.klevbyLoadFeedComments = loadComments;
  }

  if (!window.klevbyAddFeedComment) {
    window.klevbyAddFeedComment = addComment;
  }

  if (!window.klevbyDeleteFeedComment) {
    window.klevbyDeleteFeedComment = deleteComment;
  }

  if (!window.klevbyRegisterFeedView) {
    window.klevbyRegisterFeedView = registerView;
  }

  if (!window.klevbySubscribeToFeedChanges) {
    window.klevbySubscribeToFeedChanges = subscribeToFeedChanges;
  }

  if (!window.klevbyUnsubscribeFromFeedChanges) {
    window.klevbyUnsubscribeFromFeedChanges = unsubscribe;
  }

  console.log("Klevby feed api bridge loaded");
})();
