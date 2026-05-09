(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};
  const Auth = window.KlevbyFeedSupabaseAuth || {};
  const Rest = window.KlevbyFeedSupabaseRest || {};
  const Normalize = window.KlevbyFeedSupabaseNormalize || {};
  const Counts = window.KlevbyFeedSupabaseCounts || {};

  async function addLikeRest(postId, userId) {
    await Rest.restRequest(Core.LIKES_TABLE, {
      method: "POST",
      body: [{
        post_id: postId,
        user_id: userId
      }],
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    return true;
  }

  async function removeLikeRest(postId, userId) {
    const params = new URLSearchParams();
    params.set("post_id", `eq.${postId}`);
    params.set("user_id", `eq.${userId}`);

    await Rest.restRequest(Core.LIKES_TABLE, {
      method: "DELETE",
      query: params.toString(),
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    return true;
  }

  async function addLikeSdk(db, postId, userId) {
    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const result = await Core.rejectTimeout(
      db
        .from(Core.LIKES_TABLE)
        .insert([{
          post_id: postId,
          user_id: userId
        }]),
      Core.REST_TIMEOUT_MS,
      "Добавление лайка не ответило."
    );

    if (result.error) {
      throw result.error;
    }

    return true;
  }

  async function removeLikeSdk(db, postId, userId) {
    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const result = await Core.rejectTimeout(
      db
        .from(Core.LIKES_TABLE)
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId),
      Core.REST_TIMEOUT_MS,
      "Удаление лайка не ответило."
    );

    if (result.error) {
      throw result.error;
    }

    return true;
  }

  async function addLike(db, postId, userId) {
    try {
      return await addLikeRest(postId, userId);
    } catch (restError) {
      if (Normalize.isDuplicateError(restError)) {
        return true;
      }

      console.debug("Klevby feed: REST добавление лайка пропущено, пробую SDK", restError);

      try {
        return await addLikeSdk(db, postId, userId);
      } catch (sdkError) {
        if (Normalize.isDuplicateError(sdkError)) {
          return true;
        }

        throw sdkError;
      }
    }
  }

  async function removeLike(db, postId, userId) {
    try {
      return await removeLikeRest(postId, userId);
    } catch (restError) {
      console.debug("Klevby feed: REST удаление лайка пропущено, пробую SDK", restError);

      return removeLikeSdk(db, postId, userId);
    }
  }

  async function toggleFeedLike(postId) {
    const db = Core.getClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await Auth.ensureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди, чтобы поставить лайк.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const beforeState = await Counts.getExactLikeState(db, cleanPostId, user.id);
    const nextLiked = !beforeState.liked;

    if (nextLiked) {
      await addLike(db, cleanPostId, user.id);
    } else {
      await removeLike(db, cleanPostId, user.id);
    }

    let afterState = null;

    try {
      afterState = await Counts.getExactLikeState(db, cleanPostId, user.id);
    } catch (afterError) {
      console.debug("Klevby feed: точное состояние лайка после записи не прочиталось", afterError);
    }

    if (!afterState) {
      afterState = {
        liked: nextLiked,
        likesCount: Math.max(0, Number(beforeState.likesCount || 0) + (nextLiked ? 1 : -1))
      };
    }

    const counters = await Counts.getPostCounters(db, cleanPostId);

    Core.dispatch(afterState.liked ? "like_added" : "like_removed", {
      postId: cleanPostId,
      liked: afterState.liked,
      likedByViewer: afterState.liked,
      viewerLiked: afterState.liked,
      likesCount: afterState.likesCount,
      commentsCount: counters?.commentsCount
    });

    return {
      liked: afterState.liked,
      likedByViewer: afterState.liked,
      viewerLiked: afterState.liked,
      postId: cleanPostId,
      likesCount: afterState.likesCount,
      commentsCount: counters?.commentsCount,
      viewsCount: counters?.viewsCount,
      engagementScore: counters?.engagementScore,
      updatedAt: counters?.updatedAt || ""
    };
  }

  window.KlevbyFeedSupabaseLikes = {
    addLikeRest,
    removeLikeRest,
    addLikeSdk,
    removeLikeSdk,
    addLike,
    removeLike,
    toggleFeedLike
  };
})();
