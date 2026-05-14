(function () {
  let postsLoadPromise = null;
  let postsLoadRetryTimer = null;
  let postsPendingForceReload = false;

  function getOwnerId() {
    const user =
      (typeof currentUser !== "undefined" && currentUser)
        ? currentUser
        : (window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null);

    return user ? user.id : null;
  }

  function getCurrentUserSafe() {
    if (typeof currentUser !== "undefined" && currentUser) {
      return currentUser;
    }

    return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
  }

  function getCurrentAuthReady() {
    if (typeof authReady !== "undefined") {
      return authReady;
    }

    return Boolean(window.klevbyAuthReady || window.authReady);
  }

  function getPostsArray() {
    if (typeof posts !== "undefined" && Array.isArray(posts)) {
      return posts;
    }

    if (Array.isArray(window.posts)) {
      return window.posts;
    }

    if (Array.isArray(window.klevbyPosts)) {
      return window.klevbyPosts;
    }

    return [];
  }

  function setPostsArray(value) {
    const safePosts = Array.isArray(value) ? value : [];

    if (typeof posts !== "undefined") {
      posts = safePosts;
    }

    window.posts = safePosts;
    window.klevbyPosts = safePosts;
  }

  function getCurrentViewMode() {
    if (window.klevbyViewMode) {
      return window.klevbyViewMode;
    }

    if (typeof viewMode !== "undefined" && viewMode) {
      return viewMode;
    }

    return "all";
  }

  function setCurrentViewMode(mode) {
    const safeMode = mode === "mine" ? "mine" : "all";

    if (typeof viewMode !== "undefined") {
      viewMode = safeMode;
    }

    window.klevbyViewMode = safeMode;
  }

  function getCurrentEditingId() {
    if (typeof editingId !== "undefined") {
      return editingId;
    }

    return window.klevbyEditingPostId || null;
  }

  function setCurrentEditingId(value) {
    if (typeof editingId !== "undefined") {
      editingId = value;
    }

    window.klevbyEditingPostId = value;
  }

  function getActiveModalPost() {
    if (typeof activeModalPost !== "undefined") {
      return activeModalPost;
    }

    return window.klevbyActiveModalPost || null;
  }

  function setActiveModalPost(value) {
    if (typeof activeModalPost !== "undefined") {
      activeModalPost = value;
    }

    window.klevbyActiveModalPost = value;
  }

  function getPostModalCloseTimer() {
    if (typeof postModalCloseTimer !== "undefined") {
      return postModalCloseTimer;
    }

    return window.klevbyPostModalCloseTimer || null;
  }

  function setPostModalCloseTimer(value) {
    if (typeof postModalCloseTimer !== "undefined") {
      postModalCloseTimer = value;
    }

    window.klevbyPostModalCloseTimer = value;
  }

  function getPostsLoadPromise() {
    return postsLoadPromise;
  }

  function setPostsLoadPromise(value) {
    postsLoadPromise = value || null;
  }

  function getPostsLoadRetryTimer() {
    return postsLoadRetryTimer;
  }

  function setPostsLoadRetryTimer(value) {
    postsLoadRetryTimer = value || null;
  }

  function getPostsPendingForceReload() {
    return Boolean(postsPendingForceReload);
  }

  function setPostsPendingForceReload(value) {
    postsPendingForceReload = Boolean(value);
  }

  window.KlevbyPostsState = {
    getOwnerId,
    getCurrentUserSafe,
    getCurrentAuthReady,
    getPostsArray,
    setPostsArray,
    getCurrentViewMode,
    setCurrentViewMode,
    getCurrentEditingId,
    setCurrentEditingId,
    getActiveModalPost,
    setActiveModalPost,
    getPostModalCloseTimer,
    setPostModalCloseTimer,
    getPostsLoadPromise,
    setPostsLoadPromise,
    getPostsLoadRetryTimer,
    setPostsLoadRetryTimer,
    getPostsPendingForceReload,
    setPostsPendingForceReload
  };

  window.getOwnerId = getOwnerId;
  window.getCurrentUserSafe = getCurrentUserSafe;
  window.getCurrentAuthReady = getCurrentAuthReady;
  window.getPostsArray = getPostsArray;
  window.setPostsArray = setPostsArray;
  window.getCurrentViewMode = getCurrentViewMode;
  window.setCurrentViewMode = setCurrentViewMode;
})();
