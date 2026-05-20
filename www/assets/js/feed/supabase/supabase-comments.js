(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};
  const Auth = window.KlevbyFeedSupabaseAuth || {};
  const Rest = window.KlevbyFeedSupabaseRest || {};
  const Counts = window.KlevbyFeedSupabaseCounts || {};

  async function loadFeedCommentsRest(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return {
        ok: false,
        comments: [],
        error: new Error("Не указан id поста")
      };
    }

    const params = new URLSearchParams();
    params.set("select", Core.COMMENT_SELECT);
    params.set("post_id", `eq.${cleanPostId}`);
    params.set("order", "created_at.asc");

    const data = await Rest.restRequest(Core.COMMENTS_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    return {
      ok: true,
      comments: Array.isArray(data) ? data : [],
      error: null
    };
  }

  async function loadFeedCommentsSdk(postId) {
    const db = Core.getClient();

    if (!db) {
      return {
        ok: false,
        comments: [],
        error: new Error("Supabase ещё не готов")
      };
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return {
        ok: false,
        comments: [],
        error: new Error("Не указан id поста")
      };
    }

    const { data, error } = await Core.rejectTimeout(
      db
        .from(Core.COMMENTS_TABLE)
        .select(`
          id,
          post_id,
          user_id,
          author_name,
          author_city,
          author_telegram,
          text,
          created_at,
          updated_at
        `)
        .eq("post_id", cleanPostId)
        .order("created_at", { ascending: true }),
      Core.SDK_TIMEOUT_MS,
      "Комментарии не загрузились: Supabase не ответил."
    );

    if (error) {
      console.error("Klevby feed: ошибка загрузки комментариев", error);

      return {
        ok: false,
        comments: [],
        error
      };
    }

    return {
      ok: true,
      comments: Array.isArray(data) ? data : [],
      error: null
    };
  }

  async function loadFeedComments(postId) {
    try {
      return await loadFeedCommentsRest(postId);
    } catch (restError) {
      console.warn("Klevby feed: REST загрузка комментариев не сработала, пробую SDK", restError);

      try {
        return await loadFeedCommentsSdk(postId);
      } catch (sdkError) {
        console.error("Klevby feed: ошибка загрузки комментариев", sdkError);

        return {
          ok: false,
          comments: [],
          error: sdkError
        };
      }
    }
  }

  async function addFeedCommentRest(postId, text) {
    const cleanPostId = String(postId || "").trim();
    const cleanText = String(text || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    if (!cleanText) {
      throw new Error("Комментарий пустой.");
    }

    if (cleanText.length > 700) {
      throw new Error("Комментарий слишком длинный. Максимум 700 символов.");
    }

    const user = await Auth.ensureUser();
    const authContext = await Auth.getAuthContext({
      requireAuth: true
    });

    const userId =
      user?.id ||
      authContext?.user?.id ||
      "";

    if (!userId) {
      throw new Error("Сначала войди, чтобы оставить комментарий.");
    }

    const profile = Auth.readProfileData();

    const payload = {
      post_id: cleanPostId,
      user_id: userId,
      author_name: profile.name || "Рыбак",
      author_city: profile.city || "",
      author_telegram: Core.cleanTelegram(profile.telegram),
      text: cleanText
    };

    const params = new URLSearchParams();
    params.set("select", Core.COMMENT_SELECT);

    const data = await Rest.restRequest(Core.COMMENTS_TABLE, {
      method: "POST",
      query: params.toString(),
      body: [payload],
      requireAuth: true,
      prefer: "return=representation",
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    const row = Array.isArray(data) ? data[0] : data;

    if (!row || !row.id) {
      throw new Error("Комментарий отправился, но Supabase не вернул запись.");
    }

    const commentCounts = await Counts.loadRealCommentCounts(
      Core.getClient(),
      [cleanPostId]
    );

    Core.dispatch("comment_added", {
      postId: cleanPostId,
      comment: row,
      commentsCount: commentCounts.has(cleanPostId) ? Number(commentCounts.get(cleanPostId) || 0) : undefined
    });

    return row;
  }

  async function addFeedCommentSdk(postId, text) {
    const db = Core.getClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await Auth.ensureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди, чтобы оставить комментарий.");
    }

    const cleanPostId = String(postId || "").trim();
    const cleanText = String(text || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    if (!cleanText) {
      throw new Error("Комментарий пустой.");
    }

    if (cleanText.length > 700) {
      throw new Error("Комментарий слишком длинный. Максимум 700 символов.");
    }

    const profile = Auth.readProfileData();

    const { data, error } = await Core.rejectTimeout(
      db
        .from(Core.COMMENTS_TABLE)
        .insert([{
          post_id: cleanPostId,
          user_id: user.id,
          author_name: profile.name || "Рыбак",
          author_city: profile.city || "",
          author_telegram: Core.cleanTelegram(profile.telegram),
          text: cleanText
        }])
        .select(`
          id,
          post_id,
          user_id,
          author_name,
          author_city,
          author_telegram,
          text,
          created_at,
          updated_at
        `)
        .single(),
      Core.SDK_TIMEOUT_MS,
      "Комментарий не отправился: Supabase не ответил."
    );

    if (error) {
      console.error("Klevby feed: ошибка добавления комментария", error);
      throw new Error("Не получилось добавить комментарий: " + error.message);
    }

    const commentCounts = await Counts.loadRealCommentCounts(db, [cleanPostId]);

    Core.dispatch("comment_added", {
      postId: cleanPostId,
      comment: data,
      commentsCount: commentCounts.has(cleanPostId) ? Number(commentCounts.get(cleanPostId) || 0) : undefined
    });

    return data;
  }

  async function addFeedComment(postId, text) {
    try {
      return await addFeedCommentRest(postId, text);
    } catch (restError) {
      console.warn("Klevby feed: REST отправка комментария не сработала, пробую SDK", restError);

      try {
        return await addFeedCommentSdk(postId, text);
      } catch (sdkError) {
        console.error("Klevby feed: ошибка добавления комментария", sdkError);
        throw sdkError;
      }
    }
  }

  async function deleteFeedCommentRest(commentId) {
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const params = new URLSearchParams();
    params.set("id", `eq.${cleanCommentId}`);

    await Rest.restRequest(Core.COMMENTS_TABLE, {
      method: "DELETE",
      query: params.toString(),
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: Core.REST_TIMEOUT_MS
    });

    Core.dispatch("comment_deleted", {
      commentId: cleanCommentId
    });

    return true;
  }

  async function deleteFeedCommentSdk(commentId) {
    const db = Core.getClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const { error } = await Core.rejectTimeout(
      db
        .from(Core.COMMENTS_TABLE)
        .delete()
        .eq("id", cleanCommentId),
      Core.SDK_TIMEOUT_MS,
      "Комментарий не удалился: Supabase не ответил."
    );

    if (error) {
      console.error("Klevby feed: ошибка удаления комментария", error);
      throw new Error("Не получилось удалить комментарий: " + error.message);
    }

    Core.dispatch("comment_deleted", {
      commentId: cleanCommentId
    });

    return true;
  }

  async function deleteFeedComment(commentId) {
    try {
      return await deleteFeedCommentRest(commentId);
    } catch (restError) {
      console.warn("Klevby feed: REST удаление комментария не сработало, пробую SDK", restError);

      return deleteFeedCommentSdk(commentId);
    }
  }

  async function registerFeedView(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    return false;
  }

  window.KlevbyFeedSupabaseComments = {
    loadFeedCommentsRest,
    loadFeedCommentsSdk,
    loadFeedComments,
    addFeedCommentRest,
    addFeedCommentSdk,
    addFeedComment,
    deleteFeedCommentRest,
    deleteFeedCommentSdk,
    deleteFeedComment,
    registerFeedView
  };
})();
