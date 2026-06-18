(function () {
  let postsLoadPromise = null;
  let postsLoadRetryTimer = null;
  let postsPendingForceReload = false;
  let postsInitialLoadStarted = false;
  let postsInitialLoadDone = false;
  let mineTripsMode = "active";

  function normalizeTripDate(value) {
    const raw = String(value || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

    if (!match) {
      return "";
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return "";
    }

    return raw;
  }

  function getTodayIso(now = new Date()) {
    const date = now instanceof Date ? now : new Date(now);

    if (!Number.isFinite(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTripLifecycle(post, todayIso = getTodayIso()) {
    const tripDate = normalizeTripDate(post?.trip_date);
    const normalizedToday = normalizeTripDate(todayIso) || getTodayIso();

    if (!tripDate) {
      return "undated";
    }

    return tripDate < normalizedToday ? "expired" : "active";
  }

  function isOwnedBy(post, ownerId) {
    return Boolean(ownerId && post?.owner_id && String(post.owner_id) === String(ownerId));
  }

  function partitionTrips(posts, options = {}) {
    const safePosts = Array.isArray(posts) ? posts : [];
    const safeOptions = options && typeof options === "object" ? options : {};
    const todayIso = normalizeTripDate(safeOptions.todayIso) || getTodayIso();
    const ownerId = safeOptions.ownerId ?? null;
    const partitions = {
      activeAll: [],
      expiredAll: [],
      undatedAll: [],
      activeMine: [],
      expiredMine: [],
      undatedMine: []
    };

    safePosts.forEach((post) => {
      const lifecycle = getTripLifecycle(post, todayIso);
      const allKey = `${lifecycle}All`;

      partitions[allKey].push(post);

      if (isOwnedBy(post, ownerId)) {
        const mineKey = `${lifecycle}Mine`;
        partitions[mineKey].push(post);
      }
    });

    return partitions;
  }

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

  function normalizeMineTripsMode(mode) {
    return mode === "expired" ? "expired" : "active";
  }

  function getMineTripsMode() {
    return normalizeMineTripsMode(window.klevbyMineTripsMode || mineTripsMode);
  }

  function setMineTripsMode(mode) {
    mineTripsMode = normalizeMineTripsMode(mode);
    window.klevbyMineTripsMode = mineTripsMode;
    return mineTripsMode;
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

  function hasPostsInitialLoadStarted() {
    return Boolean(postsInitialLoadStarted);
  }

  function setPostsInitialLoadStarted(value) {
    postsInitialLoadStarted = Boolean(value);
  }

  function hasPostsInitialLoadDone() {
    return Boolean(postsInitialLoadDone);
  }

  function setPostsInitialLoadDone(value) {
    postsInitialLoadDone = Boolean(value);
  }

  window.KlevbyPostsState = {
    normalizeTripDate,
    getTodayIso,
    getTripLifecycle,
    partitionTrips,
    getOwnerId,
    getCurrentUserSafe,
    getCurrentAuthReady,
    getPostsArray,
    setPostsArray,
    getCurrentViewMode,
    setCurrentViewMode,
    normalizeMineTripsMode,
    getMineTripsMode,
    setMineTripsMode,
    getCurrentEditingId,
    setCurrentEditingId,
    getActiveModalPost,
    setActiveModalPost,
    getPostsLoadPromise,
    setPostsLoadPromise,
    getPostsLoadRetryTimer,
    setPostsLoadRetryTimer,
    getPostsPendingForceReload,
    setPostsPendingForceReload,
    hasPostsInitialLoadStarted,
    setPostsInitialLoadStarted,
    hasPostsInitialLoadDone,
    setPostsInitialLoadDone
  };

  window.getOwnerId = getOwnerId;
  window.getCurrentUserSafe = getCurrentUserSafe;
  window.getCurrentAuthReady = getCurrentAuthReady;
  window.getPostsArray = getPostsArray;
  window.setPostsArray = setPostsArray;
  window.getCurrentViewMode = getCurrentViewMode;
  window.setCurrentViewMode = setCurrentViewMode;
  window.getMineTripsMode = getMineTripsMode;
  window.setMineTripsMode = setMineTripsMode;
})();
