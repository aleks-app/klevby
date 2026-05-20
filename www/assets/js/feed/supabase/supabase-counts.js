(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};
  const Auth = window.KlevbyFeedSupabaseAuth || {};
  const Rest = window.KlevbyFeedSupabaseRest || {};
  const Normalize = window.KlevbyFeedSupabaseNormalize || {};

  function getViewerLikesRenderTimeoutMs() {
    const restTimeout = Number(Core.REST_TIMEOUT_MS || 9000);
    return Math.min(Math.max(restTimeout, 1200), 3000);
  }

  function getViewerLikesExactTimeoutMs() {
    const restTimeout = Number(Core.REST_TIMEOUT_MS || 9000);
    return Math.min(Math.max(restTimeout, 2500), 6500);
  }

  function logViewerLikesSkipped(stage, error, quiet = true) {
    const message = String(error?.message || error || "");

    if (quiet) {
      console.debug("Klevby feed: проверка моих лайков пропущена", {
        stage,
        reason: message
      });
      return;
    }

    console.warn("Klevby feed: ошибка проверки моих лайков", {
      stage,
      error
    });
  }

  function countCommentsRows(rows, postIds = []) {
    const counts = Normalize.makeZeroCountMap(postIds);

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const postId = String(row?.post_id || row?.postId || "").trim();

      if (!postId) return;

      counts.set(postId, Number(counts.get(postId) || 0) + 1);
    });

    return counts;
  }

  async function loadRealCommentCountsRest(postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id");
    params.set("post_id", `in.(${ids.join(",")})`);

    const data = await Rest.restRequest(Core.COMMENTS_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    return countCommentsRows(data, ids);
  }

  async function loadRealCommentCountsSdk(db, postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!db || !ids.length) {
      return new Map();
    }

    const { data, error } = await Core.rejectTimeout(
      db
        .from(Core.COMMENTS_TABLE)
        .select("post_id")
        .in("post_id", ids),
      Core.SDK_TIMEOUT_MS,
      "Счётчики комментариев не ответили."
    );

    if (error) {
      throw error;
    }

    return countCommentsRows(data, ids);
  }

  async function loadRealCommentCounts(db, postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    try {
      return await loadRealCommentCountsRest(ids);
    } catch (restError) {
      console.debug("Klevby feed: REST счётчики комментариев пропущены, пробую SDK", restError);

      try {
        return await loadRealCommentCountsSdk(db, ids);
      } catch (sdkError) {
        console.debug("Klevby feed: реальные счётчики комментариев пропущены", sdkError);
        return new Map();
      }
    }
  }

  async function applyRealCommentCounts(db, items) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const postIds = Normalize.getPostIds(safeItems);
    const counts = await loadRealCommentCounts(db, postIds);

    if (!counts || !counts.size) {
      return safeItems;
    }

    return safeItems.map((item) => {
      const id = String(item?.id || "").trim();

      if (!id) {
        return item;
      }

      const realCount = Math.max(0, Number(counts.get(id) || 0) || 0);

      return {
        ...item,
        commentsCount: realCount,
        comments_count: realCount
      };
    });
  }

  function countUniqueLikeUsersRows(rows, postIds = []) {
    const usersByPost = new Map();
    const counts = Normalize.makeZeroCountMap(postIds);

    Normalize.normalizeIds(postIds).forEach((postId) => {
      usersByPost.set(postId, new Set());
    });

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const postId = String(row?.post_id || row?.postId || "").trim();
      const userId = String(row?.user_id || row?.userId || "").trim();

      if (!postId || !userId) return;

      if (!usersByPost.has(postId)) {
        usersByPost.set(postId, new Set());
      }

      usersByPost.get(postId).add(userId);
    });

    usersByPost.forEach((users, postId) => {
      counts.set(postId, users.size);
    });

    return counts;
  }

  async function loadRealLikeCountsRest(postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id,user_id");
    params.set("post_id", `in.(${ids.join(",")})`);
    params.set("limit", "10000");

    const data = await Rest.restRequest(Core.LIKES_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    return countUniqueLikeUsersRows(data, ids);
  }

  async function loadRealLikeCountsSdk(db, postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!db || !ids.length) {
      return new Map();
    }

    const { data, error } = await Core.rejectTimeout(
      db
        .from(Core.LIKES_TABLE)
        .select("post_id,user_id")
        .in("post_id", ids)
        .limit(10000),
      Core.SDK_TIMEOUT_MS,
      "Счётчики лайков не ответили."
    );

    if (error) {
      throw error;
    }

    return countUniqueLikeUsersRows(data, ids);
  }

  async function loadRealLikeCounts(db, postIds) {
    const ids = Normalize.normalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    try {
      return await loadRealLikeCountsRest(ids);
    } catch (restError) {
      console.debug("Klevby feed: REST счётчики лайков пропущены, пробую SDK", restError);

      if (!db) {
        return new Map();
      }

      try {
        return await loadRealLikeCountsSdk(db, ids);
      } catch (sdkError) {
        console.debug("Klevby feed: реальные счётчики лайков пропущены", sdkError);
        return new Map();
      }
    }
  }

  async function applyRealLikeCounts(db, items) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const postIds = Normalize.getPostIds(safeItems);
    const counts = await loadRealLikeCounts(db, postIds);

    if (!counts || !counts.size) {
      return safeItems;
    }

    return safeItems.map((item) => {
      const id = String(item?.id || "").trim();

      if (!id) {
        return item;
      }

      const realCount = Math.max(0, Number(counts.get(id) || 0) || 0);

      return {
        ...item,
        likesCount: realCount,
        likes_count: realCount
      };
    });
  }

  async function loadViewerLikedPostIdsRest(postIds, userId, options = {}) {
    const ids = Normalize.normalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();

    if (!ids.length || !cleanUserId) {
      return new Set();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id");
    params.set("user_id", `eq.${cleanUserId}`);
    params.set("post_id", `in.(${ids.join(",")})`);

    const data = await Rest.restRequest(Core.LIKES_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: true,
      timeoutMs: Number(options.timeoutMs || Core.REST_TIMEOUT_MS || 9000)
    });

    return new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => String(row?.post_id || "").trim())
        .filter(Boolean)
    );
  }

  async function loadViewerLikedPostIdsSdk(db, postIds, userId, options = {}) {
    const ids = Normalize.normalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();

    if (!db || !ids.length || !cleanUserId) {
      return new Set();
    }

    const { data, error } = await Core.rejectTimeout(
      db
        .from(Core.LIKES_TABLE)
        .select("post_id")
        .eq("user_id", cleanUserId)
        .in("post_id", ids),
      Number(options.timeoutMs || Core.SDK_TIMEOUT_MS || 6500),
      "Проверка лайков не ответила."
    );

    if (error) {
      throw error;
    }

    return new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => String(row?.post_id || "").trim())
        .filter(Boolean)
    );
  }

  async function loadViewerLikedPostIds(db, postIds, userId, options = {}) {
    const ids = Normalize.normalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();
    const allowSdkFallback = options.allowSdkFallback !== false;
    const quiet = options.quiet !== false;
    const timeoutMs = Number(options.timeoutMs || Core.REST_TIMEOUT_MS || 9000);

    if (!ids.length || !cleanUserId) {
      return new Set();
    }

    try {
      return await loadViewerLikedPostIdsRest(ids, cleanUserId, {
        timeoutMs
      });
    } catch (restError) {
      logViewerLikesSkipped("rest", restError, quiet);

      if (!db || !allowSdkFallback) {
        return new Set();
      }

      try {
        return await loadViewerLikedPostIdsSdk(db, ids, cleanUserId, {
          timeoutMs: Number(options.sdkTimeoutMs || Core.SDK_TIMEOUT_MS || timeoutMs)
        });
      } catch (sdkError) {
        logViewerLikesSkipped("sdk", sdkError, quiet);
        return new Set();
      }
    }
  }

  async function applyViewerLikes(db, items, options = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const userId = await Auth.getViewerUserId(db, {
      restore: Boolean(options.restore)
    });

    if (!userId) {
      return safeItems.map((item) => Normalize.applyViewerLikeState(item, false));
    }

    const likedPostIds = await loadViewerLikedPostIds(
      db,
      safeItems.map((item) => item?.id),
      userId,
      {
        allowSdkFallback: false,
        quiet: true,
        timeoutMs: getViewerLikesRenderTimeoutMs()
      }
    );

    return safeItems.map((item) => {
      const id = String(item?.id || "").trim();
      return Normalize.applyViewerLikeState(item, likedPostIds.has(id));
    });
  }

  async function getExactLikeState(db, postId, userId) {
    const cleanPostId = String(postId || "").trim();
    const cleanUserId = String(userId || "").trim();

    if (!cleanPostId) {
      return {
        liked: false,
        likesCount: 0
      };
    }

    const likeCounts = await loadRealLikeCounts(db, [cleanPostId]);
    const likesCount = Math.max(0, Number(likeCounts.get(cleanPostId) || 0) || 0);

    let liked = false;

    if (cleanUserId) {
      const likedPostIds = await loadViewerLikedPostIds(
        db,
        [cleanPostId],
        cleanUserId,
        {
          allowSdkFallback: true,
          quiet: true,
          timeoutMs: getViewerLikesExactTimeoutMs(),
          sdkTimeoutMs: getViewerLikesExactTimeoutMs()
        }
      );

      liked = likedPostIds.has(cleanPostId);
    }

    return {
      liked,
      likesCount
    };
  }

  async function getPostCounters(db, postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return null;
    }

    let data = null;

    if (db) {
      try {
        const result = await Core.rejectTimeout(
          db
            .from(Core.TABLE)
            .select("likes_count,comments_count,views_count,engagement_score,updated_at")
            .eq("id", cleanPostId)
            .maybeSingle(),
          Core.SDK_TIMEOUT_MS,
          "Счётчики поста не ответили."
        );

        if (result.error) {
          console.debug("Klevby feed: counters skipped", result.error);
        } else {
          data = result.data || null;
        }
      } catch (error) {
        console.debug("Klevby feed: counters row read skipped", error);
      }
    }

    const likeCounts = await loadRealLikeCounts(db, [cleanPostId]);
    const commentCounts = await loadRealCommentCounts(db, [cleanPostId]);

    const realLikesCount = likeCounts.has(cleanPostId)
      ? Number(likeCounts.get(cleanPostId) || 0)
      : Number(data?.likes_count || 0);

    const realCommentsCount = commentCounts.has(cleanPostId)
      ? Number(commentCounts.get(cleanPostId) || 0)
      : Number(data?.comments_count || 0);

    return {
      likesCount: Math.max(0, Number(realLikesCount || 0) || 0),
      commentsCount: Math.max(0, Number(realCommentsCount || 0) || 0),
      viewsCount: Number(data?.views_count || 0),
      engagementScore: Number(data?.engagement_score || 0),
      updatedAt: data?.updated_at || ""
    };
  }

  window.KlevbyFeedSupabaseCounts = {
    countCommentsRows,
    loadRealCommentCountsRest,
    loadRealCommentCountsSdk,
    loadRealCommentCounts,
    applyRealCommentCounts,
    countUniqueLikeUsersRows,
    loadRealLikeCountsRest,
    loadRealLikeCountsSdk,
    loadRealLikeCounts,
    applyRealLikeCounts,
    loadViewerLikedPostIdsRest,
    loadViewerLikedPostIdsSdk,
    loadViewerLikedPostIds,
    applyViewerLikes,
    getExactLikeState,
    getPostCounters
  };
})();
