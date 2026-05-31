(function () {
  function markKlevbyResumeDebug(source, reason, detail = {}) {
    const api = window.KlevbyResumeDebug;
    if (!api || typeof api.mark !== "function") return null;
    try {
      return api.mark(source, reason, detail);
    } catch (error) {
      return null;
    }
  }

  const KLEVB_FEED_VISIBLE_REFRESH_MS = 4000;
  const KLEVB_FEED_VISIBLE_STALE_REFRESH_MS = 60000;
  const KLEVB_FEED_HIDDEN_REFRESH_MS = 30000;
  const KLEVB_FEED_DEBOUNCE_MS = 450;
  const KLEVB_FEED_RESUME_DELAYS = [0, 600, 1800, 4200, 8000];

  const KLEVB_RT_COUNTER_HYDRATE_DEDUP_MS = 1200;
  const klevbyRealtimeCounterHydrationMap = new Map();

  const KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS = 4500;
  const klevbyTargetedLikeSuccessMap = new Map();
  const KLEVB_TARGETED_FALLBACK_CANCEL_TTL_MS = 5000;
  const klevbyTargetedFallbackByPostMap = new Map();
  const KLEVB_RECENT_TARGETED_FEED_SUCCESS_TTL_MS = 1800;
  let klevbyRecentTargetedFeedSuccessUntil = 0;

  const KLEVB_RECENT_COMMENT_ADDED_TARGETED_SUCCESS_TTL_MS = 2200;
  const klevbyRecentCommentAddedTargetedSuccessByPostMap = new Map();


  let klevbyFeedRefreshTimer = null;
  let klevbyFeedPendingRefreshMeta = null;
  let klevbyFeedIntervalTimer = null;
  let klevbyFeedHiddenIntervalTimer = null;
  let klevbyFeedRefreshInProgress = false;
  let klevbyFeedRefreshPending = false;
  let klevbyFeedHooksBound = false;
  let klevbyFeedRealtimeStarted = false;
  let klevbyFeedResumeTimers = [];
  let klevbyFeedLastRenderAt = 0;
  let klevbyPendingMissingPostIdRealtimeFallbackMeta = null;

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getModals() {
    return window.KlevbyFeedModals || {};
  }

  function getRealtimeApi() {
    return window.klevbyFeedSupabase || getApi() || {};
  }

  function isHomeFeedVisible() {
    const homeSection = document.getElementById("homeSection");
    const feedSection = document.getElementById("profileFeedSection");

    return Boolean(
      homeSection &&
      feedSection &&
      !homeSection.classList.contains("hidden")
    );
  }

  function isPageVisible() {
    return document.visibilityState !== "hidden";
  }


  function getFeedMainDebug() {
    const api = window.KlevbyFeedMainDebug;
    return api && typeof api.log === "function" ? api : null;
  }

  function logFeedRefreshMarker(functionName, reason, detail = {}) {
    const debug = getFeedMainDebug();
    if (!debug) return;
    try {
      debug.log("full_refresh_marker", String(reason || ""), {
        source: "feed-events",
        function: String(functionName || "unknown"),
        action: String(detail.action || "full_refresh"),
        refreshKind: String(detail.refreshKind || "full"),
        delay: Number(detail.delay || 0),
        force: Boolean(detail.force),
        postId: detail.postId ? String(detail.postId) : "",
        visible: detail.visible === undefined ? isPageVisible() : Boolean(detail.visible),
        homeVisible: detail.homeVisible === undefined ? isHomeFeedVisible() : Boolean(detail.homeVisible)
      });
    } catch (_) {}
  }


  function isCounterOnlyFeedEvent(action) {
    return (
      action === "feed_like_changed" ||
      action === "feed_comment_changed" ||
      action === "comment_added" ||
      action === "comment_deleted"
    );
  }

  function logTargetedUpdateDecision(reason, detail = {}) {
    const debug = getFeedMainDebug();
    if (!debug) return;
    try {
      debug.log(String(detail.event || "targeted_update"), String(reason || ""), {
        source: "feed-events",
        action: String(detail.action || ""),
        postId: detail.postId ? String(detail.postId) : "",
        fallback: Boolean(detail.fallback),
        note: String(detail.note || ""),
        snapshot: detail && typeof detail.snapshot === "object" ? detail.snapshot : null
      });
    } catch (_) {}
  }

  function renderFeed() {
    const render = getRender();

    if (typeof render.renderProfileFeed === "function") {
      return render.renderProfileFeed();
    }

    if (typeof window.renderProfileFeed === "function") {
      return window.renderProfileFeed();
    }

    return Promise.resolve();
  }

  async function refreshFeedNow(reason = "manual", options = {}) {
    const force = Boolean(options.force);
    logFeedRefreshMarker("refreshFeedNow", reason, { force, action: "full_refresh" });

    if (!force && !isPageVisible()) {
      return false;
    }

    if (!force && !isHomeFeedVisible()) {
      return false;
    }

    if (!document.getElementById("profileFeedSection")) {
      return false;
    }

    if (klevbyFeedRefreshInProgress) {
      klevbyFeedRefreshPending = true;
      return false;
    }

    klevbyFeedRefreshInProgress = true;

    try {
      await Promise.resolve(renderFeed());

      klevbyFeedLastRenderAt = Date.now();

      window.dispatchEvent(new CustomEvent("klevby-feed-silent-refresh-done", {
        detail: {
          reason,
          at: new Date().toISOString()
        }
      }));

      return true;
    } catch (error) {
      console.warn("Klevby feed: тихое обновление ленты не сработало", error);
      return false;
    } finally {
      klevbyFeedRefreshInProgress = false;

      if (klevbyFeedRefreshPending) {
        klevbyFeedRefreshPending = false;
        queueFeedRefresh("pending_after_" + reason, 650, {
          force
        });
      }
    }
  }



  function markTargetedFallbackQueued(postId, reason = "") {
    const cleanPostId = String(postId || "").trim();
    if (!cleanPostId) return;

    klevbyTargetedFallbackByPostMap.set(cleanPostId, {
      at: Date.now(),
      reason: String(reason || "")
    });
  }

  function cancelPendingFullRefreshAfterTargetedSuccess(postId, reason = "") {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId || !klevbyFeedPendingRefreshMeta || !klevbyFeedRefreshTimer) {
      return false;
    }

    if (String(klevbyFeedPendingRefreshMeta.postId || "") !== cleanPostId) {
      return false;
    }

    const fallbackMeta = klevbyTargetedFallbackByPostMap.get(cleanPostId);

    if (!fallbackMeta || Number(fallbackMeta.at || 0) <= 0) {
      return false;
    }

    if (Date.now() - Number(fallbackMeta.at || 0) > KLEVB_TARGETED_FALLBACK_CANCEL_TTL_MS) {
      klevbyTargetedFallbackByPostMap.delete(cleanPostId);
      return false;
    }

    clearTimeout(klevbyFeedRefreshTimer);
    klevbyFeedRefreshTimer = null;
    klevbyFeedPendingRefreshMeta = null;
    klevbyTargetedFallbackByPostMap.delete(cleanPostId);

    logTargetedUpdateDecision(reason || "targeted_update", {
      event: "pending_full_refresh_cancelled_after_targeted_success",
      action: reason || "",
      postId: cleanPostId,
      fallback: false,
      note: "pending full refresh cancelled after targeted success"
    });

    return true;
  }

  function queueFeedRefresh(reason = "queued", delay = KLEVB_FEED_DEBOUNCE_MS, options = {}) {
    const safeDelay = Math.max(0, Number(delay || 0));
    logFeedRefreshMarker("queueFeedRefresh", reason, {
      action: "queue_full_refresh",
      delay: safeDelay,
      force: Boolean(options.force),
      postId: options.postId
    });
    if (klevbyPendingMissingPostIdRealtimeFallbackMeta && klevbyFeedRefreshTimer) {
      if (klevbyPendingMissingPostIdRealtimeFallbackMeta.timerId === klevbyFeedRefreshTimer) {
        klevbyPendingMissingPostIdRealtimeFallbackMeta = null;
      }
    }

    clearTimeout(klevbyFeedRefreshTimer);

    klevbyFeedPendingRefreshMeta = {
      reason: String(reason || "queued"),
      postId: options.postId ? String(options.postId) : "",
      queuedAt: Date.now()
    };

    klevbyFeedRefreshTimer = setTimeout(() => {
      if (klevbyPendingMissingPostIdRealtimeFallbackMeta && klevbyPendingMissingPostIdRealtimeFallbackMeta.timerId === klevbyFeedRefreshTimer) {
        klevbyPendingMissingPostIdRealtimeFallbackMeta.executedAt = Date.now();
        klevbyPendingMissingPostIdRealtimeFallbackMeta = null;
      }

      klevbyFeedPendingRefreshMeta = null;
      refreshFeedNow(reason, {
        force: Boolean(options.force)
      });
    }, safeDelay);
  }

  function refreshFeedIfHomeVisible(options = {}) {
    return refreshFeedNow(options.reason || "refresh_home_visible", {
      force: Boolean(options.force)
    });
  }

  function loadCommentsIntoActiveModal() {
    const modals = getModals();
    const modal = document.getElementById("klevbyFeedCommentModal");
    const postId = String(modal?.dataset?.postId || "");

    if (!modal || modal.classList.contains("hidden") || !postId) {
      return Promise.resolve();
    }

    if (typeof modals.loadCommentsIntoModal === "function") {
      return modals.loadCommentsIntoModal(postId);
    }

    if (typeof window.loadFeedCommentsIntoModal === "function") {
      return window.loadFeedCommentsIntoModal(postId);
    }

    return Promise.resolve();
  }

  function queueCommentsRefresh(delay = 250) {
    setTimeout(() => {
      loadCommentsIntoActiveModal().catch((error) => {
        console.warn("Klevby feed: комментарии не обновились", error);
      });
    }, Math.max(0, Number(delay || 0)));
  }


  function hasOwn(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function pickCounterValue(detail, payload, primaryKey, fallbackKeys = []) {
    if (hasOwn(detail, primaryKey)) {
      return detail[primaryKey];
    }

    for (const key of fallbackKeys) {
      if (hasOwn(detail, key)) {
        return detail[key];
      }
    }

    if (payload && payload.new) {
      if (hasOwn(payload.new, primaryKey)) {
        return payload.new[primaryKey];
      }

      for (const key of fallbackKeys) {
        if (hasOwn(payload.new, key)) {
          return payload.new[key];
        }
      }
    }

    return undefined;
  }

  function makeRealtimeCounters(detail = {}) {
    const payload = detail?.payload || null;

    const likesCount = pickCounterValue(detail, payload, "likesCount", ["likes_count"]);
    const commentsCount = pickCounterValue(detail, payload, "commentsCount", ["comments_count"]);
    const liked = pickCounterValue(detail, payload, "liked", []);

    const counters = {};

    if (likesCount !== undefined) {
      counters.likesCount = likesCount;
    }

    if (commentsCount !== undefined) {
      counters.commentsCount = commentsCount;
    }

    if (typeof liked === "boolean") {
      counters.liked = liked;
    }

    return counters;
  }



  function getKnownViewerUserIdSync() {
    const fromWindow =
      window.currentUser?.id ||
      window.klevbyCurrentUser?.id ||
      window.klevbyUser?.id ||
      "";

    if (fromWindow) {
      return String(fromWindow).trim();
    }

    try {
      return String(localStorage.getItem("klevby_feed_last_like_user_id") || "").trim();
    } catch (error) {
      return "";
    }
  }

  function resolveOwnLikeEventState(detail = {}) {
    const payload = detail?.payload || detail || {};
    const action = String(detail?.action || "");

    if (action && action !== "feed_like_changed") {
      return {
        safe: false,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    const viewerUserId = getKnownViewerUserIdSync();
    const actorUserId = String(
      payload?.new?.user_id ||
      payload?.old?.user_id ||
      ""
    ).trim();
    const eventType = String(payload?.eventType || payload?.event_type || "").toUpperCase();

    if (!viewerUserId || !actorUserId || !eventType) {
      return {
        safe: false,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    if (actorUserId !== viewerUserId) {
      return {
        safe: true,
        isOwnLikeEvent: false,
        liked: null
      };
    }

    if (eventType === "INSERT") {
      return {
        safe: true,
        isOwnLikeEvent: true,
        liked: true
      };
    }

    if (eventType === "DELETE") {
      return {
        safe: true,
        isOwnLikeEvent: true,
        liked: false
      };
    }

    return {
      safe: false,
      isOwnLikeEvent: true,
      liked: null
    };
  }

  function resolveFeedCountersUpdater() {
    const render = getRender();

    if (render && typeof render.updateFeedCardCounters === "function") {
      return render.updateFeedCardCounters;
    }

    if (window.KlevbyFeedRender && typeof window.KlevbyFeedRender.updateFeedCardCounters === "function") {
      return window.KlevbyFeedRender.updateFeedCardCounters;
    }

    return null;
  }

  function resolveRealtimePostId(detail = {}) {
    return String(
      detail?.postId ||
      detail?.payload?.postId ||
      detail?.payload?.new?.post_id ||
      detail?.payload?.old?.post_id ||
      detail?.payload?.new?.postId ||
      detail?.payload?.old?.postId ||
      detail?.payload?.post_id ||
      detail?.payload?.new?.feed_post_id ||
      detail?.payload?.old?.feed_post_id ||
      detail?.payload?.new?.id ||
      detail?.payload?.old?.id ||
      ""
    ).trim();
  }

  function isCounterOnlyFeedPostChanged(detail = {}) {
    const setReason = (reason) => {
      try {
        if (detail && typeof detail === "object") {
          detail.counterOnlyRejectReason = reason;
        }
      } catch (error) {
        // no-op
      }
      return false;
    };

    const action = String(detail?.action || detail?.type || "").trim();

    if (action !== "feed_post_changed") {
      return setReason("not_feed_post_changed");
    }

    const payload = detail?.payload || {};
    const eventType = String(payload?.eventType || payload?.event_type || "").toUpperCase();

    if (eventType && eventType !== "UPDATE") {
      return setReason("not_update");
    }

    const postId = resolveRealtimePostId(detail);

    if (!postId) {
      return setReason("missing_post_id");
    }

    const nextRow = payload?.new && typeof payload.new === "object" ? payload.new : null;

    if (!nextRow) {
      return setReason("missing_payload_new");
    }

    const hasLikesCounter = hasOwn(nextRow, "likes_count");
    const hasCommentsCounter = hasOwn(nextRow, "comments_count");

    if (!hasLikesCounter && !hasCommentsCounter) {
      return setReason("missing_counter_fields");
    }

    const allowedChangedFields = new Set(["likes_count", "comments_count", "engagement_score", "updated_at"]);
    const prevRow = payload?.old && typeof payload.old === "object" ? payload.old : null;

    if (!prevRow) {
      if (hasRecentTargetedLikeCounterUpdate(postId)) {
        if (detail && typeof detail === "object" && hasOwn(detail, "counterOnlyRejectReason")) {
          delete detail.counterOnlyRejectReason;
        }
        return true;
      }
      return setReason("missing_payload_old");
    }

    const keys = new Set([...Object.keys(nextRow || {}), ...Object.keys(prevRow || {})]);

    for (const key of keys) {
      const before = prevRow?.[key];
      const after = nextRow?.[key];

      if (before === after) {
        continue;
      }

      if (!allowedChangedFields.has(key)) {
        if (detail && typeof detail === "object") {
          detail.counterOnlyChangedKeys = detail.counterOnlyChangedKeys || [];
          if (!detail.counterOnlyChangedKeys.includes(String(key))) {
            detail.counterOnlyChangedKeys.push(String(key));
          }
        }
        return setReason("content_field_changed");
      }
    }

    if (detail && typeof detail === "object" && hasOwn(detail, "counterOnlyRejectReason")) {
      delete detail.counterOnlyRejectReason;
    }

    return true;
  }

  async function hydrateRealtimeFeedCardCounters(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return null;
    }

    const now = Date.now();
    const existing = klevbyRealtimeCounterHydrationMap.get(cleanPostId);

    if (existing && existing.promise && now - existing.startedAt <= KLEVB_RT_COUNTER_HYDRATE_DEDUP_MS) {
      return existing.promise;
    }

    const promise = (async () => {
      const countsApi = window.KlevbyFeedSupabaseCounts || null;
      const coreApi = window.KlevbyFeedSupabaseCore || null;

      if (!countsApi || typeof countsApi.getPostCounters !== "function") {
        return null;
      }

      const db = coreApi && typeof coreApi.getClient === "function"
        ? coreApi.getClient()
        : null;

      const counters = await countsApi.getPostCounters(db, cleanPostId);

      if (!counters) {
        return null;
      }

      return {
        likesCount: Number(counters.likesCount || 0),
        commentsCount: Number(counters.commentsCount || 0)
      };
    })();

    klevbyRealtimeCounterHydrationMap.set(cleanPostId, {
      startedAt: now,
      promise
    });

    const cleanup = () => {
      const active = klevbyRealtimeCounterHydrationMap.get(cleanPostId);

      if (active && active.promise === promise) {
        klevbyRealtimeCounterHydrationMap.delete(cleanPostId);
      }
    };

    promise.then(cleanup, cleanup);

    return promise;
  }

  function tryUpdateRealtimeFeedCardCounters(detail = {}) {
    const action = String(detail?.action || "");

    if (
      action !== "feed_like_changed" &&
      action !== "feed_comment_changed" &&
      action !== "comment_added" &&
      action !== "comment_deleted" &&
      !(action === "feed_post_changed" && isCounterOnlyFeedPostChanged(detail))
    ) {
      return false;
    }

    const postId = resolveRealtimePostId(detail);

    if (!postId) {
      return {
        updated: false,
        action,
        postId: "",
        diagnostics: null,
        fallbackReason: "missing_post_id"
      };
    }

    const counters = makeRealtimeCounters(detail);

    if (!Object.keys(counters).length) {
      const payload = detail?.payload || null;
      return {
        updated: false,
        action,
        postId,
        diagnostics: getTargetedUpdateDomDiagnostics(postId, counters),
        fallbackReason: "missing_counters",
        missingCountersDiagnostics: {
          hasPostId: Boolean(postId),
          hasPayload: Boolean(payload),
          hasPayloadOld: Boolean(payload && payload.old),
          hasPayloadNew: Boolean(payload && payload.new),
          hasDetailCommentsCount: hasOwn(detail, "commentsCount"),
          hasDetailCommentsCountSnake: hasOwn(detail, "comments_count"),
          hasPayloadNewCommentsCount: Boolean(payload?.new && hasOwn(payload.new, "comments_count")),
          hasPayloadOldCommentsCount: Boolean(payload?.old && hasOwn(payload.old, "comments_count"))
        }
      };
    }

    const updateFn = resolveFeedCountersUpdater();

    if (!updateFn) {
      return {
        updated: false,
        action,
        postId,
        diagnostics: getTargetedUpdateDomDiagnostics(postId, counters),
        fallbackReason: "missing_updater"
      };
    }

    const diagnostics = getTargetedUpdateDomDiagnostics(postId, counters);

    try {
      const updated = Boolean(updateFn(postId, counters));
      const isCounterOnlyPostAction =
        action === "feed_post_changed" &&
        isCounterOnlyFeedPostChanged(detail);
      const hasLikeCounterInCounters = Object.prototype.hasOwnProperty.call(counters, "likesCount");
      const payload = detail?.payload || {};
      const payloadShowsLikesCounterChange =
        payload?.new &&
        payload?.old &&
        Object.prototype.hasOwnProperty.call(payload.new, "likes_count") &&
        Object.prototype.hasOwnProperty.call(payload.old, "likes_count") &&
        payload.new.likes_count !== payload.old.likes_count;

      if (
        updated &&
        (
          action === "feed_like_changed" ||
          (isCounterOnlyPostAction && (hasLikeCounterInCounters || payloadShowsLikesCounterChange))
        )
      ) {
        markTargetedLikeCounterUpdateSuccess(postId);
      }

      return {
        updated,
        action,
        postId,
        diagnostics,
        fallbackReason: updated ? "" : detectTargetedFallbackReason(diagnostics, null, { updaterReturnedFalse: true })
      };
    } catch (error) {
      return {
        updated: false,
        action,
        postId,
        diagnostics,
        fallbackReason: detectTargetedFallbackReason(diagnostics, error)
      };
    }
  }


  function markTargetedLikeCounterUpdateSuccess(postId, ttlMs = KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    klevbyTargetedLikeSuccessMap.set(cleanPostId, Date.now() + Math.max(500, Number(ttlMs || KLEVB_TARGETED_LIKE_SUCCESS_TTL_MS)));
    return true;
  }

  function hasRecentTargetedLikeCounterUpdate(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const expiresAt = Number(klevbyTargetedLikeSuccessMap.get(cleanPostId) || 0);

    if (!expiresAt) {
      return false;
    }

    if (Date.now() > expiresAt) {
      klevbyTargetedLikeSuccessMap.delete(cleanPostId);
      return false;
    }

    return true;
  }

  function markRecentTargetedFeedCounterSuccess(ttlMs = KLEVB_RECENT_TARGETED_FEED_SUCCESS_TTL_MS) {
    const safeTtlMs = Math.max(500, Number(ttlMs || KLEVB_RECENT_TARGETED_FEED_SUCCESS_TTL_MS));
    klevbyRecentTargetedFeedSuccessUntil = Date.now() + safeTtlMs;
    return true;
  }

  function hasRecentTargetedFeedCounterSuccess() {
    if (!klevbyRecentTargetedFeedSuccessUntil) {
      return false;
    }

    if (Date.now() > klevbyRecentTargetedFeedSuccessUntil) {
      klevbyRecentTargetedFeedSuccessUntil = 0;
      return false;
    }

    return true;
  }




  function markRecentCommentAddedTargetedSuccess(postId, ttlMs = KLEVB_RECENT_COMMENT_ADDED_TARGETED_SUCCESS_TTL_MS) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const expiresAt = Date.now() + Math.max(500, Number(ttlMs || KLEVB_RECENT_COMMENT_ADDED_TARGETED_SUCCESS_TTL_MS));
    klevbyRecentCommentAddedTargetedSuccessByPostMap.set(cleanPostId, expiresAt);
    return true;
  }

  function hasRecentCommentAddedTargetedSuccess(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const expiresAt = Number(klevbyRecentCommentAddedTargetedSuccessByPostMap.get(cleanPostId) || 0);

    if (!expiresAt) {
      return false;
    }

    if (Date.now() > expiresAt) {
      klevbyRecentCommentAddedTargetedSuccessByPostMap.delete(cleanPostId);
      return false;
    }

    return true;
  }

  function shouldSuppressCommentAddedFullRefreshAfterTargetedSuccess(action, fallbackPostId) {
    if (action !== "comment_added") {
      return false;
    }

    return hasRecentCommentAddedTargetedSuccess(fallbackPostId);
  }

  function getTargetedUpdateDomDiagnostics(postId, counters = {}) {
    const cleanPostId = String(postId || "").trim();
    const root = document.getElementById("profileFeedSection");
    const feedList = root ? root.querySelector("#profileFeed") : null;
    const selector = cleanPostId
      ? `.profile-feed-card[data-feed-card-id="${CSS.escape(cleanPostId)}"]`
      : "";
    const matches = selector && feedList ? Array.from(feedList.querySelectorAll(selector)) : [];
    const card = matches[0] || null;
    const cardVisible = Boolean(card && card.isConnected && card.getClientRects && card.getClientRects().length > 0);

    const needLikeNode = Object.prototype.hasOwnProperty.call(counters, "likesCount") || Object.prototype.hasOwnProperty.call(counters, "liked");
    const needCommentNode = Object.prototype.hasOwnProperty.call(counters, "commentsCount");
    const likeNode = card && needLikeNode
      ? card.querySelector(`.profile-feed-like-btn[data-feed-post-id="${CSS.escape(cleanPostId)}"]`)
      : null;
    const commentNode = card && needCommentNode
      ? card.querySelector(`.profile-feed-comment-btn[data-feed-post-id="${CSS.escape(cleanPostId)}"]`)
      : null;

    return {
      cardExists: Boolean(card),
      cardVisible,
      matchingSelectorsCount: matches.length,
      isHomeVisible: isHomeFeedVisible(),
      visibleFeedContainerExists: Boolean(root && feedList),
      missingLikeNode: Boolean(needLikeNode && !likeNode),
      missingCommentNode: Boolean(needCommentNode && !commentNode)
    };
  }

  function detectTargetedFallbackReason(diagnostics = {}, error = null) {
    const options = arguments[2] || {};
    if (error) return "exception";
    if (!diagnostics || typeof diagnostics !== "object") return "unknown";
    if (!diagnostics.cardExists) return "target_card_not_found";
    if (!diagnostics.cardVisible) return "target_card_not_in_dom";
    if (diagnostics.missingLikeNode || diagnostics.missingCommentNode) return "missing_counter_node";
    if (options.updaterReturnedFalse) return "updater_returned_false";
    return "unknown";
  }

  function normalizeTargetedUpdateResult(result, detail = {}) {
    if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "updated")) {
      return result;
    }

    return {
      updated: Boolean(result),
      action: String(detail?.action || ""),
      postId: resolveRealtimePostId(detail),
      diagnostics: null,
      fallbackReason: Boolean(result) ? "" : "updater_returned_false"
    };
  }

  function shouldSuppressLikeFallbackRefresh(action, result = {}) {
    if (action !== "feed_like_changed") {
      return false;
    }

    const reason = String(result?.fallbackReason || "");
    return reason === "target_card_not_found" || reason === "target_card_not_in_dom";
  }

  function isCommentsModalOpenForPost(postId) {
    const cleanPostId = String(postId || "").trim();
    const modal = document.getElementById("klevbyFeedCommentModal");
    const modalPostId = String(modal?.dataset?.postId || "").trim();
    return Boolean(modal && !modal.classList.contains("hidden") && cleanPostId && modalPostId === cleanPostId);
  }

  function resolveActiveCommentContextPostId() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    const modalPostId = String(modal?.dataset?.postId || "").trim();
    if (modalPostId) {
      return {
        postId: modalPostId,
        resolvedFromActiveCommentContext: true,
        source: "comment_modal_dataset"
      };
    }

    const list = document.getElementById("klevbyFeedCommentsList");
    const listPostId = String(list?.dataset?.postId || "").trim();
    if (listPostId) {
      return {
        postId: listPostId,
        resolvedFromActiveCommentContext: true,
        source: "comment_list_dataset"
      };
    }

    const globalPostId = String(window.KlevbyActiveCommentPostId || "").trim();
    if (globalPostId) {
      return {
        postId: globalPostId,
        resolvedFromActiveCommentContext: true,
        source: "window.KlevbyActiveCommentPostId"
      };
    }

    return {
      postId: "",
      resolvedFromActiveCommentContext: false,
      source: ""
    };
  }


  function isAnyCommentsModalOpen() {
    const modal = document.getElementById("klevbyFeedCommentModal");
    return Boolean(modal && !modal.classList.contains("hidden"));
  }

  function queueSoftCommentMissingPostFallback(reason = "comment_deleted_missing_post_id") {
    if (isAnyCommentsModalOpen()) {
      return false;
    }

    queueFeedRefresh(reason, 1600, {
      force: true,
      postId: ""
    });

    return true;
  }

  function resolveCommentEventPostId(detail = {}, result = {}) {
    const fromResult = String(result?.postId || "").trim();
    if (fromResult) return { postId: fromResult, resolvedFromActiveCommentContext: false, source: "targeted_result" };
    const fromDetail = String(detail?.postId || "").trim();
    if (fromDetail) return { postId: fromDetail, resolvedFromActiveCommentContext: false, source: "event_detail" };
    return resolveActiveCommentContextPostId();
  }

  function shouldSuppressCommentFallbackRefresh(action, result = {}) {
    if (action !== "feed_comment_changed" && action !== "comment_added" && action !== "comment_deleted") {
      return false;
    }

    const postId = String(result?.postId || "").trim();
    if (!postId) {
      return false;
    }

    const reason = String(result?.fallbackReason || "");
    if (reason === "target_card_not_found" || reason === "target_card_not_in_dom") {
      return true;
    }

    if (reason !== "missing_counters") {
      return false;
    }

    const diagnostics = result?.diagnostics || {};
    const cardExists = Boolean(diagnostics.cardExists);
    const matchingSelectorsCount = Number(diagnostics.matchingSelectorsCount || 0);

    return !cardExists || matchingSelectorsCount <= 0;
  }

  function buildMissingPostIdRealtimeSnapshot(detail = {}) {
    const payload = detail?.payload || null;
    return {
      action: String(detail?.action || detail?.type || ''),
      postIdResolved: resolveRealtimePostId(detail),
      hasDetailPayload: Boolean(detail && typeof detail === 'object' && detail.payload),
      hasPayloadNew: Boolean(payload && payload.new),
      hasPayloadOld: Boolean(payload && payload.old),
      detailPostId: detail?.postId || '',
      payloadPostId: payload?.postId || '',
      payloadNewPostId: payload?.new?.post_id || '',
      payloadOldPostId: payload?.old?.post_id || '',
      payloadNewId: payload?.new?.id || '',
      payloadOldId: payload?.old?.id || '',
      eventType: payload?.eventType || '',
      event_type: payload?.event_type || ''
    };
  }

  function markPendingMissingPostIdRealtimeLikeFallback(meta = {}) {
    if (!klevbyFeedRefreshTimer) {
      klevbyPendingMissingPostIdRealtimeFallbackMeta = null;
      return false;
    }

    klevbyPendingMissingPostIdRealtimeFallbackMeta = {
      reason: "realtime_feed",
      action: String(meta.action || "feed_like_changed"),
      queuedAt: Number(meta.queuedAt || Date.now()),
      timerId: klevbyFeedRefreshTimer,
      isMissingPostIdLikeFallback: true
    };

    return true;
  }

  function cancelPendingMissingPostIdRealtimeLikeFallbackAfterTargetedSuccess(reason = "") {
    const pending = klevbyPendingMissingPostIdRealtimeFallbackMeta;

    if (!pending || !pending.isMissingPostIdLikeFallback) {
      return false;
    }

    const ageMs = Date.now() - Number(pending.queuedAt || 0);

    if (ageMs > KLEVB_RECENT_TARGETED_FEED_SUCCESS_TTL_MS + 400) {
      klevbyPendingMissingPostIdRealtimeFallbackMeta = null;
      return false;
    }

    if (!klevbyFeedRefreshTimer || pending.timerId !== klevbyFeedRefreshTimer) {
      logTargetedUpdateDecision(reason || "realtime_feed", {
        event: "pending_realtime_feed_missing_post_id_cancel_missed",
        action: pending.action || "feed_like_changed",
        postId: "",
        fallback: true,
        note: "pending realtime_feed missing postId fallback already executed or replaced"
      });
      klevbyPendingMissingPostIdRealtimeFallbackMeta = null;
      return false;
    }

    clearTimeout(klevbyFeedRefreshTimer);
    klevbyFeedRefreshTimer = null;
    klevbyFeedPendingRefreshMeta = null;
    klevbyPendingMissingPostIdRealtimeFallbackMeta = null;

    logTargetedUpdateDecision(reason || "realtime_feed", {
      event: "pending_realtime_feed_missing_post_id_cancelled_after_targeted_success",
      action: pending.action || "feed_like_changed",
      postId: "",
      fallback: false,
      note: "pending realtime_feed missing postId fallback cancelled after targeted success"
    });

    return true;
  }
  function closeOpenFeedWindows() {
    const modals = getModals();

    if (typeof modals.closeFeedPhotoViewer === "function") {
      modals.closeFeedPhotoViewer();
    } else if (typeof window.closeFeedPhotoViewer === "function") {
      window.closeFeedPhotoViewer();
    }

    if (typeof modals.closeFeedCommentModal === "function") {
      modals.closeFeedCommentModal();
    } else if (typeof window.closeFeedCommentModal === "function") {
      window.closeFeedCommentModal();
    }
  }

  function clearResumeTimers() {
    klevbyFeedResumeTimers.forEach((timer) => {
      clearTimeout(timer);
    });

    klevbyFeedResumeTimers = [];
  }

  function handleAppResume(reason = "resume") {
    markKlevbyResumeDebug("feed.events.resume", reason, { phase: "start" });
    clearResumeTimers();

    tryStartRealtimeSubscription();

    klevbyFeedResumeTimers = KLEVB_FEED_RESUME_DELAYS.map((delay) => {
      return setTimeout(() => {
        const burstReason = reason + "_burst_" + delay;
        markKlevbyResumeDebug("feed.events.resume", burstReason, { phase: "burst_fire", delay });
        queueFeedRefresh(burstReason, 0, {
          force: true
        });

        queueCommentsRefresh(180);
      }, delay);
    });
  }

  function bindFeedRefreshHooks() {
    if (klevbyFeedHooksBound || window.__klevbyFeedRefreshBoundV2) return;

    klevbyFeedHooksBound = true;
    window.__klevbyFeedRefreshBoundV2 = true;

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === "klevby_profile_photos" ||
        key === "klevby_profile_avatar" ||
        key === "klevby_profile_settings" ||
        key === "klevby_profile_name"
      ) {
        queueFeedRefresh("storage_" + key, 80, {
          force: true
        });
      }
    });

    window.addEventListener("klevby-app-resumed", (event) => {
      const reason = String(event?.detail?.reason || "app_resumed");

      if (window.__klevbyCentralResumeRouter) {
        tryStartRealtimeSubscription();
        restartFeedAutoRefresh();
        return;
      }

      handleAppResume(reason);
      restartFeedAutoRefresh();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        startHiddenWakeRefresh();
      }
    });

    window.addEventListener("klevby-auth-changed", () => {
      queueFeedRefresh("auth_changed", 120, {
        force: true
      });
    });

    window.addEventListener("klevby-feed-updated", async (event) => {
      const action = String(event?.detail?.action || "feed_updated");
      const detail = event?.detail || {};
      const targetedUpdateResult = normalizeTargetedUpdateResult(tryUpdateRealtimeFeedCardCounters(detail), detail);
      let cardCountersUpdated = Boolean(targetedUpdateResult.updated);

      if (!cardCountersUpdated && action === "feed_like_changed") {
        const postId = String(
          detail?.postId ||
          detail?.payload?.postId ||
          detail?.payload?.new?.post_id ||
          detail?.payload?.old?.post_id ||
          ""
        ).trim();

        if (postId) {
          try {
            const hydratedCounters = await hydrateRealtimeFeedCardCounters(postId);
            const updateFn = resolveFeedCountersUpdater();

            if (hydratedCounters && updateFn) {
              const ownLikeState = resolveOwnLikeEventState(detail);

              if (!ownLikeState.safe) {
                cardCountersUpdated = false;
              } else {
                const nextCounters = {
                  ...hydratedCounters
                };

                if (ownLikeState.isOwnLikeEvent) {
                  nextCounters.liked = Boolean(ownLikeState.liked);
                }

                cardCountersUpdated = Boolean(updateFn(postId, nextCounters));

                if (cardCountersUpdated) {
                  markTargetedLikeCounterUpdateSuccess(postId);
                }
              }
            }
          } catch (error) {
            console.debug("Klevby feed: targeted hydration counters skipped", error);
          }
        }
      }

      if (cardCountersUpdated) {
        markRecentTargetedFeedCounterSuccess();
        const targetedPostId = resolveRealtimePostId(detail);
        if (action === "comment_added") {
          markRecentCommentAddedTargetedSuccess(targetedPostId);
        }
        cancelPendingFullRefreshAfterTargetedSuccess(targetedPostId, action);
        cancelPendingMissingPostIdRealtimeLikeFallbackAfterTargetedSuccess(action);
        logTargetedUpdateDecision(action, {
          event: "targeted_update_success",
          action,
          postId: targetedPostId,
          fallback: false,
          note: "full refresh suppressed"
        });
      } else {
        const fallbackPostId = targetedUpdateResult.postId || resolveRealtimePostId(detail);
        logTargetedUpdateDecision(action, {
          event: "targeted_update_fallback",
          action,
          postId: fallbackPostId,
          fallback: true,
          note: "targeted update failed, fallback full refresh",
          snapshot: {
            ...(targetedUpdateResult.diagnostics || {}),
            fallbackReason: targetedUpdateResult.fallbackReason || "unknown"
          }
        });

        if (isCounterOnlyFeedEvent(action)) {
          logTargetedUpdateDecision(action, {
            event: "counter_only_fallback_refresh_skipped",
            action,
            postId: fallbackPostId,
            fallback: false,
            note: "counter-only event: skip full refresh to keep feed card order stable",
            snapshot: {
              ...(targetedUpdateResult.diagnostics || {}),
              fallbackReason: targetedUpdateResult.fallbackReason || "unknown"
            }
          });
        } else {
          const resolvedCommentContext = resolveCommentEventPostId(detail, targetedUpdateResult);
          const resolvedFallbackPostId = resolvedCommentContext.postId || fallbackPostId;
          const likeFallbackSuppressed = shouldSuppressLikeFallbackRefresh(action, targetedUpdateResult);
          const commentFallbackSuppressed = shouldSuppressCommentFallbackRefresh(action, {
            ...targetedUpdateResult,
            postId: resolvedFallbackPostId
          });
          const commentAddedFallbackSuppressedAfterSuccess = shouldSuppressCommentAddedFullRefreshAfterTargetedSuccess(action, resolvedFallbackPostId);
          if (commentAddedFallbackSuppressedAfterSuccess) {
            logTargetedUpdateDecision(action, {
              event: "comment_added_recent_targeted_success_skip",
              action,
              postId: resolvedFallbackPostId,
              fallback: false,
              note: "recent comment_added targeted success suppresses full refresh"
            });
          } else if (likeFallbackSuppressed) {
            logTargetedUpdateDecision(action, {
              event: "feed_like_target_card_not_found_skip",
              action,
              postId: resolvedFallbackPostId,
              fallback: false,
              note: "like_target_not_visible_skip",
              snapshot: {
                ...(targetedUpdateResult.diagnostics || {}),
                fallbackReason: targetedUpdateResult.fallbackReason || "target_card_not_found"
              }
            });
          } else if (commentFallbackSuppressed) {
            const modalOpenForPost = isCommentsModalOpenForPost(resolvedFallbackPostId);
            logTargetedUpdateDecision(action, {
              event: "comment_target_card_not_found_skip",
              action,
              postId: resolvedFallbackPostId,
              fallback: false,
              note: modalOpenForPost
                ? "comment_target_not_visible_skip_feed_refresh_modal_will_refresh"
                : "comment_target_not_visible_skip_feed_refresh",
              snapshot: {
                ...(targetedUpdateResult.diagnostics || {}),
                fallbackReason: targetedUpdateResult.fallbackReason || "target_card_not_found",
                resolvedFromActiveCommentContext: Boolean(resolvedCommentContext.resolvedFromActiveCommentContext),
                activeCommentContextSource: resolvedCommentContext.source || "",
                matchingSelectorsCount: Number(targetedUpdateResult?.diagnostics?.matchingSelectorsCount || 0),
                cardExists: Boolean(targetedUpdateResult?.diagnostics?.cardExists)
              }
            });
          } else if (action === "comment_deleted" && !resolvedFallbackPostId) {
            logTargetedUpdateDecision(action, {
              event: "comment_deleted_missing_post_id_fallback",
              action,
              postId: "",
              fallback: true,
              note: "comment_deleted postId unresolved, immediate full refresh skipped",
              snapshot: {
                fallbackReason: targetedUpdateResult.fallbackReason || "missing_post_id",
                resolvedFromActiveCommentContext: false
              }
            });
            const softFallbackReason = action + "_missing_post_id_soft_fallback";
            const softFallbackQueued = queueSoftCommentMissingPostFallback(softFallbackReason);
            logTargetedUpdateDecision(action, {
              event: "comment_deleted_missing_post_id_soft_fallback",
              action,
              postId: "",
              fallback: softFallbackQueued,
              note: softFallbackQueued
                ? "comment_deleted missing postId queued delayed soft fallback"
                : "comment_deleted missing postId soft fallback skipped while modal open"
            });
          } else {
            markTargetedFallbackQueued(resolvedFallbackPostId, action);
            queueFeedRefresh(action, 120, {
              force: true,
              postId: resolvedFallbackPostId
            });
          }
        }
      }

      const modal = document.getElementById("klevbyFeedCommentModal");
      const activePostId = String(modal?.dataset?.postId || "");
      const changedPostId = String(event?.detail?.postId || "");

      if (
        modal &&
        !modal.classList.contains("hidden") &&
        activePostId &&
        (!changedPostId || changedPostId === activePostId)
      ) {
        queueCommentsRefresh(220);
      }
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      queueFeedRefresh("feed_module_ready", 250, {
        force: true
      });
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      queueFeedRefresh("navigation_click", 160, {
        force: true
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeOpenFeedWindows();
      }
    });
  }

  function startFeedAutoRefresh() {
    if (klevbyFeedIntervalTimer) return;

    klevbyFeedIntervalTimer = setInterval(() => {
      if (!isPageVisible()) return;

      if (!isHomeFeedVisible()) return;

      const now = Date.now();
      const lastRenderAt = Number(klevbyFeedLastRenderAt || 0);
      const elapsedMs = lastRenderAt > 0 ? now - lastRenderAt : -1;
      const debug = getFeedMainDebug();

      if (lastRenderAt > 0 && elapsedMs < KLEVB_FEED_VISIBLE_STALE_REFRESH_MS) {
        if (debug) {
          try {
            debug.log("full_refresh_marker", "visible_interval_skipped_recent_render", {
              source: "feed-events",
              function: "startFeedAutoRefresh",
              action: "skip_visible_interval_refresh",
              refreshKind: "full",
              elapsedMs,
              staleThresholdMs: KLEVB_FEED_VISIBLE_STALE_REFRESH_MS,
              visible: true,
              homeVisible: true
            });
          } catch (_) {}
        }
        return;
      }

      if (debug) {
        try {
          debug.log("full_refresh_marker", "visible_interval_stale_recovery_refresh", {
            source: "feed-events",
            function: "startFeedAutoRefresh",
            action: "stale_visible_interval_recovery",
            refreshKind: "full",
            elapsedMs,
            staleThresholdMs: KLEVB_FEED_VISIBLE_STALE_REFRESH_MS,
            visible: true,
            homeVisible: true
          });
        } catch (_) {}
      }

      refreshFeedNow("visible_interval_stale", {
        force: true
      });

      queueCommentsRefresh(200);
    }, KLEVB_FEED_VISIBLE_REFRESH_MS);

    const state = getState();

    if (typeof state.setAutoRefreshTimer === "function") {
      state.setAutoRefreshTimer(klevbyFeedIntervalTimer);
    } else {
      state.autoRefreshTimer = klevbyFeedIntervalTimer;
    }
  }

  function restartFeedAutoRefresh() {
    if (klevbyFeedHiddenIntervalTimer) {
      clearInterval(klevbyFeedHiddenIntervalTimer);
      klevbyFeedHiddenIntervalTimer = null;
    }

    if (!klevbyFeedIntervalTimer) {
      startFeedAutoRefresh();
    }

    queueFeedRefresh("restart_visible_refresh", 100, {
      force: true
    });
  }

  function startHiddenWakeRefresh() {
    if (klevbyFeedHiddenIntervalTimer) return;

    klevbyFeedHiddenIntervalTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;

      clearInterval(klevbyFeedHiddenIntervalTimer);
      klevbyFeedHiddenIntervalTimer = null;

      handleAppResume("hidden_timer_resume");
    }, KLEVB_FEED_HIDDEN_REFRESH_MS);
  }

  async function stopRealtimeSubscription() {
    const api = getRealtimeApi();

    try {
      if (api && typeof api.unsubscribe === "function") {
        await api.unsubscribe();
      } else if (typeof window.klevbyUnsubscribeFromFeedChanges === "function") {
        await window.klevbyUnsubscribeFromFeedChanges();
      }
    } catch (error) {
      console.warn("Klevby feed: realtime канал не отключился", error);
    }

    klevbyFeedRealtimeStarted = false;
  }

  function tryStartRealtimeSubscription() {
    if (klevbyFeedRealtimeStarted) {
      return true;
    }

    const api = getRealtimeApi();

    if (!api) {
      return false;
    }

    const refresh = async (payload) => {
      const postId = String(
        payload?.postId ||
        payload?.new?.post_id ||
        payload?.old?.post_id ||
        payload?.new?.id ||
        payload?.old?.id ||
        ""
      ).trim();

      const targetedUpdateResult = normalizeTargetedUpdateResult(tryUpdateRealtimeFeedCardCounters(payload || {}), payload || {});
      let cardCountersUpdated = Boolean(targetedUpdateResult.updated);
      const action = String(payload?.action || "");

      if (!cardCountersUpdated && action === "feed_like_changed" && postId) {
        try {
          const hydratedCounters = await hydrateRealtimeFeedCardCounters(postId);
          const updateFn = resolveFeedCountersUpdater();

          if (hydratedCounters && updateFn) {
            const ownLikeState = resolveOwnLikeEventState(payload);

            if (!ownLikeState.safe) {
              cardCountersUpdated = false;
            } else {
              const nextCounters = {
                ...hydratedCounters
              };

              if (ownLikeState.isOwnLikeEvent) {
                nextCounters.liked = Boolean(ownLikeState.liked);
              }

              cardCountersUpdated = Boolean(updateFn(postId, nextCounters));

              if (cardCountersUpdated) {
                markTargetedLikeCounterUpdateSuccess(postId);
              }
            }
          }
        } catch (error) {
          console.debug("Klevby feed: realtime targeted hydration counters skipped", error);
        }
      }

      if (cardCountersUpdated) {
        markRecentTargetedFeedCounterSuccess();
        if (action === "comment_added") {
          markRecentCommentAddedTargetedSuccess(postId);
        }
        cancelPendingFullRefreshAfterTargetedSuccess(postId, "realtime_" + (postId || "feed"));
        cancelPendingMissingPostIdRealtimeLikeFallbackAfterTargetedSuccess("realtime_" + (postId || "feed"));
        logTargetedUpdateDecision("realtime_" + (postId || "feed"), {
          event: "targeted_update_success",
          action,
          postId,
          fallback: false,
          note: "full refresh suppressed"
        });
      } else {
        const fallbackReason = "realtime_" + (postId || "feed");
        const fallbackPostIdForLog = targetedUpdateResult.postId || postId;
        const suppressRealtimeFeedFallback =
          action === "feed_like_changed" &&
          !postId &&
          fallbackReason === "realtime_feed" &&
          hasRecentTargetedFeedCounterSuccess();

        if (suppressRealtimeFeedFallback) {
          logTargetedUpdateDecision(fallbackReason, {
            event: "realtime_feed_missing_post_id_suppressed_after_recent_targeted_success",
            action,
            postId,
            fallback: false,
            note: "missing postId realtime_feed fallback suppressed after recent targeted success"
          });
        } else {
          const snapshot = !postId && fallbackReason === "realtime_feed"
            ? buildMissingPostIdRealtimeSnapshot(payload || {})
            : null;

          logTargetedUpdateDecision(fallbackReason, {
            event: !postId && fallbackReason === "realtime_feed"
              ? "missing_post_id_realtime_feed_fallback"
              : "targeted_update_fallback",
            action,
            postId: fallbackPostIdForLog,
            fallback: true,
            note: "targeted update failed, fallback full refresh",
            snapshot: {
              ...(snapshot || {}),
              ...(targetedUpdateResult.diagnostics || {}),
              fallbackReason: targetedUpdateResult.fallbackReason || "unknown",
              missingCountersDiagnostics: targetedUpdateResult.missingCountersDiagnostics || null
            }
          });

          if (isCounterOnlyFeedEvent(action)) {
            logTargetedUpdateDecision(fallbackReason, {
              event: "counter_only_fallback_refresh_skipped",
              action,
              postId: fallbackPostIdForLog,
              fallback: false,
              note: "counter-only event: skip full refresh to keep feed card order stable",
              snapshot: {
                ...(targetedUpdateResult.diagnostics || {}),
                fallbackReason: targetedUpdateResult.fallbackReason || "unknown",
                missingCountersDiagnostics: targetedUpdateResult.missingCountersDiagnostics || null
              }
            });
          } else {
            const resolvedCommentContext = resolveCommentEventPostId(payload || {}, targetedUpdateResult);
            const fallbackPostId = resolvedCommentContext.postId || targetedUpdateResult.postId || postId;
            const likeFallbackSuppressed = shouldSuppressLikeFallbackRefresh(action, targetedUpdateResult);
            const commentFallbackSuppressed = shouldSuppressCommentFallbackRefresh(action, {
              ...targetedUpdateResult,
              postId: fallbackPostId
            });
            const commentAddedFallbackSuppressedAfterSuccess = shouldSuppressCommentAddedFullRefreshAfterTargetedSuccess(action, fallbackPostId);
            if (commentAddedFallbackSuppressedAfterSuccess) {
              logTargetedUpdateDecision(fallbackReason, {
                event: "comment_added_recent_targeted_success_skip",
                action,
                postId: fallbackPostId,
                fallback: false,
                note: "recent comment_added targeted success suppresses full refresh"
              });
            } else if (likeFallbackSuppressed) {
              logTargetedUpdateDecision(fallbackReason, {
                event: "feed_like_target_card_not_found_skip",
                action,
                postId: fallbackPostId,
                fallback: false,
                note: "like_target_not_visible_skip",
                snapshot: {
                  ...(targetedUpdateResult.diagnostics || {}),
                  fallbackReason: targetedUpdateResult.fallbackReason || "target_card_not_found"
                }
              });
            } else if (commentFallbackSuppressed) {
              const modalOpenForPost = isCommentsModalOpenForPost(fallbackPostId);
              logTargetedUpdateDecision(fallbackReason, {
                event: "comment_target_card_not_found_skip",
                action,
                postId: fallbackPostId,
                fallback: false,
                note: modalOpenForPost
                  ? "comment_target_not_visible_skip_feed_refresh_modal_will_refresh"
                  : "comment_target_not_visible_skip_feed_refresh",
                snapshot: {
                  ...(targetedUpdateResult.diagnostics || {}),
                  fallbackReason: targetedUpdateResult.fallbackReason || "target_card_not_found",
                  modalOpenForPost,
                  resolvedFromActiveCommentContext: Boolean(resolvedCommentContext.resolvedFromActiveCommentContext),
                  activeCommentContextSource: resolvedCommentContext.source || "",
                  matchingSelectorsCount: Number(targetedUpdateResult?.diagnostics?.matchingSelectorsCount || 0),
                  cardExists: Boolean(targetedUpdateResult?.diagnostics?.cardExists)
                }
              });
            } else if (action === "comment_deleted" && !fallbackPostId) {
              logTargetedUpdateDecision(fallbackReason, {
                event: "comment_deleted_missing_post_id_fallback",
                action,
                postId: "",
                fallback: true,
                note: "comment_deleted postId unresolved, immediate full refresh skipped",
                snapshot: {
                  ...(targetedUpdateResult.diagnostics || {}),
                  fallbackReason: targetedUpdateResult.fallbackReason || "missing_post_id",
                  resolvedFromActiveCommentContext: false
                }
              });
              const softFallbackReason = fallbackReason + "_missing_post_id_soft_fallback";
              const softFallbackQueued = queueSoftCommentMissingPostFallback(softFallbackReason);
              logTargetedUpdateDecision(fallbackReason, {
                event: "comment_deleted_missing_post_id_soft_fallback",
                action,
                postId: "",
                fallback: softFallbackQueued,
                note: softFallbackQueued
                  ? "comment_deleted missing postId queued delayed soft fallback"
                  : "comment_deleted missing postId soft fallback skipped while modal open"
              });
            } else {
              markTargetedFallbackQueued(fallbackPostId, fallbackReason);
              queueFeedRefresh(fallbackReason, 80, {
                force: true,
                postId: fallbackPostId
              });
            }

            if (action === "feed_like_changed" && !postId && fallbackReason === "realtime_feed") {
              markPendingMissingPostIdRealtimeLikeFallback({
                action,
                queuedAt: Date.now()
              });
            }
          }
        }
      }

      queueCommentsRefresh(180);
    };

    try {
      let channel = null;

      if (typeof api.subscribeToFeedChanges === "function") {
        channel = api.subscribeToFeedChanges(refresh);
      } else if (typeof api.subscribeToChanges === "function") {
        channel = api.subscribeToChanges(refresh);
      } else if (typeof api.subscribe === "function") {
        channel = api.subscribe(refresh);
      }

      if (channel) {
        klevbyFeedRealtimeStarted = true;
        return true;
      }

      klevbyFeedRealtimeStarted = false;
      return false;
    } catch (error) {
      klevbyFeedRealtimeStarted = false;
      console.warn("Klevby feed: realtime пока не подключился", error);
      return false;
    }
  }

  window.KlevbyFeedEvents = {
    bindFeedRefreshHooks,
    startFeedAutoRefresh,
    restartFeedAutoRefresh,
    startHiddenWakeRefresh,
    tryStartRealtimeSubscription,
    stopRealtimeSubscription,
    refreshFeedIfHomeVisible,
    refreshFeedNow,
    queueFeedRefresh,
    isCounterOnlyFeedPostChanged,
    markTargetedLikeCounterUpdateSuccess,
    hasRecentTargetedLikeCounterUpdate,
    handleAppResume,
    loadCommentsIntoActiveModal,
    closeOpenFeedWindows
  };

  window.refreshKlevbyFeedSilently = function refreshKlevbyFeedSilently() {
    return refreshFeedNow("manual_global", {
      force: true
    });
  };

  window.klevbyWakeFeed = function klevbyWakeFeed() {
    handleAppResume("manual_wake");
    return refreshFeedNow("manual_wake", {
      force: true
    });
  };
})();
