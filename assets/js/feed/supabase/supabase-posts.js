(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};
  const Auth = window.KlevbyFeedSupabaseAuth || {};
  const Rest = window.KlevbyFeedSupabaseRest || {};
  const Normalize = window.KlevbyFeedSupabaseNormalize || {};
  const Counts = window.KlevbyFeedSupabaseCounts || {};

  function getPostSelectColumns(includeAvatar = true) {
    const columns = [
      "id",
      "user_id",
      "type",
      "author_name",
      "author_city",
      "author_telegram",
      "caption",
      "image_path",
      "image_url",
      "image_width",
      "image_height",
      "image_size_kb",
      "likes_count",
      "comments_count",
      "views_count",
      "engagement_score",
      "created_at",
      "updated_at"
    ];

    if (includeAvatar) {
      columns.push("author_avatar_url");
    }

    return columns.join(",");
  }

  function isPostsRestFallbackError(error) {
    const message = String(error?.message || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const payload = `${message} ${details} ${hint}`;

    return (
      payload.includes("author_avatar") ||
      payload.includes("author_avatar_url") ||
      payload.includes("engagement_score") ||
      payload.includes("schema cache") ||
      payload.includes("could not find") ||
      payload.includes("column") ||
      payload.includes("order")
    );
  }

  function buildPostsRestQuery(limit, options = {}) {
    const params = new URLSearchParams();
    const includeAvatar = options.includeAvatar !== false;
    const includeEngagementOrder = options.includeEngagementOrder !== false;

    params.set("select", getPostSelectColumns(includeAvatar));

    params.set(
      "order",
      includeEngagementOrder
        ? "created_at.desc,engagement_score.desc"
        : "created_at.desc"
    );

    params.set("limit", String(limit));

    return params.toString();
  }

  async function runFeedPostsRestQuery(limit) {
    const attempts = [
      {
        includeAvatar: true,
        includeEngagementOrder: true,
        source: "rest"
      },
      {
        includeAvatar: false,
        includeEngagementOrder: true,
        source: "rest_no_avatar"
      },
      {
        includeAvatar: true,
        includeEngagementOrder: false,
        source: "rest_no_engagement_order"
      },
      {
        includeAvatar: false,
        includeEngagementOrder: false,
        source: "rest_simple"
      }
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const data = await Rest.restRequest(Core.TABLE, {
          method: "GET",
          query: buildPostsRestQuery(limit, attempt),
          requireAuth: false,
          timeoutMs: Core.REST_TIMEOUT_MS
        });

        return {
          data: Array.isArray(data) ? data : [],
          error: null,
          source: attempt.source
        };
      } catch (error) {
        lastError = error;

        if (!isPostsRestFallbackError(error)) {
          throw error;
        }

        console.debug("Klevby feed: REST вариант ленты пропущен", {
          source: attempt.source,
          error: String(error?.message || error)
        });
      }
    }

    throw lastError || new Error("REST лента не ответила.");
  }

  async function runFeedPostsQuery(db, limit) {
    let result = await Core.rejectTimeout(
      db
        .from(Core.TABLE)
        .select(getPostSelectColumns(true))
        .order("created_at", { ascending: false })
        .order("engagement_score", { ascending: false })
        .limit(limit),
      Core.SDK_TIMEOUT_MS,
      "Лента не ответила."
    );

    if (
      result.error &&
      String(result.error.message || "").toLowerCase().includes("author_avatar")
    ) {
      result = await Core.rejectTimeout(
        db
          .from(Core.TABLE)
          .select(getPostSelectColumns(false))
          .order("created_at", { ascending: false })
          .order("engagement_score", { ascending: false })
          .limit(limit),
        Core.SDK_TIMEOUT_MS,
        "Лента не ответила."
      );
    }

    if (
      result.error &&
      String(result.error.message || "").toLowerCase().includes("engagement_score")
    ) {
      result = await Core.rejectTimeout(
        db
          .from(Core.TABLE)
          .select(getPostSelectColumns(false))
          .order("created_at", { ascending: false })
          .limit(limit),
        Core.SDK_TIMEOUT_MS,
        "Лента не ответила."
      );
    }

    return {
      ...result,
      source: "sdk"
    };
  }

  async function loadFeedPostsFromSupabase(options = {}) {
    const db = Core.getClient();
    const config = Core.getConfig();

    if (!db && (!config.supabaseUrl || !config.supabaseAnonKey)) {
      return {
        ok: false,
        items: [],
        error: new Error("Supabase ещё не готов")
      };
    }

    const limit = Math.min(Math.max(Number(options.limit || 40), 1), 80);

    try {
      let result = null;

      try {
        result = await runFeedPostsRestQuery(limit);
      } catch (restError) {
        console.debug("Klevby feed: REST загрузка ленты не сработала, пробую SDK", restError);

        if (!db) {
          throw restError;
        }

        result = await runFeedPostsQuery(db, limit);
      }

      if (result.error) {
        console.error("Klevby feed: ошибка загрузки feed_posts", result.error);

        return {
          ok: false,
          items: [],
          error: result.error
        };
      }

      const normalizedItems = Array.isArray(result.data)
        ? result.data.map(Normalize.normalizePost).filter(Boolean)
        : [];

      const realLikeItems = await Counts.applyRealLikeCounts(db, normalizedItems);

      const likedItems = await Counts.applyViewerLikes(db, realLikeItems, {
        restore: true
      });

      const items = await Counts.applyRealCommentCounts(db, likedItems);

      return {
        ok: true,
        items,
        error: null,
        source: result.source || "unknown"
      };
    } catch (error) {
      console.error("Klevby feed: ошибка загрузки Supabase-ленты", error);

      return {
        ok: false,
        items: [],
        error
      };
    }
  }

  async function createFeedPhotoPost(photoData = {}) {
    const db = Core.getClient();

    if (!db) {
      throw new Error("Supabase ещё не готов. Обнови страницу.");
    }

    const user = await Auth.ensureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди или создай профиль, чтобы фото было видно в общей ленте.");
    }

    const dataUrl = String(photoData.dataUrl || photoData.src || "");

    if (!dataUrl) {
      throw new Error("Фото не найдено для загрузки.");
    }

    const profile = Auth.readProfileData();
    const cleanTelegram = Core.cleanTelegram(profile.telegram);
    const blob = Core.dataUrlToBlob(dataUrl);

    if (blob.size > 5 * 1024 * 1024) {
      throw new Error("Фото больше 5 МБ. Нужно выбрать фото меньше или сильнее сжать.");
    }

    const extension = blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";

    const fileName = `${Date.now()}-${Core.makeIdPart()}.${extension}`;
    const imagePath = `${user.id}/${fileName}`;

    const uploadResult = await Core.rejectTimeout(
      db.storage
        .from(Core.BUCKET)
        .upload(imagePath, blob, {
          cacheControl: "31536000",
          contentType: blob.type || "image/jpeg",
          upsert: false
        }),
      Core.REST_TIMEOUT_MS,
      "Фото не загрузилось: Supabase не ответил."
    );

    if (uploadResult.error) {
      console.error("Klevby feed: ошибка загрузки фото в Storage", uploadResult.error);
      throw new Error("Фото не загрузилось в Supabase Storage: " + uploadResult.error.message);
    }

    const publicUrlResult = db.storage
      .from(Core.BUCKET)
      .getPublicUrl(imagePath);

    const imageUrl = publicUrlResult?.data?.publicUrl || "";

    if (!imageUrl) {
      throw new Error("Supabase не вернул публичную ссылку на фото.");
    }

    const caption = String(
      photoData.caption ||
      photoData.title ||
      "Фото с рыбалки"
    ).trim();

    const payload = {
      user_id: user.id,
      type: "profile_photo",
      author_name: profile.name || "Рыбак",
      author_city: profile.city || "",
      author_telegram: cleanTelegram,
      caption: caption || "Фото с рыбалки",
      image_path: imagePath,
      image_url: imageUrl,
      image_width: Number(photoData.width || 0),
      image_height: Number(photoData.height || 0),
      image_size_kb: Number(photoData.sizeKb || photoData.savedSizeKb || Math.round(blob.size / 1024) || 0)
    };

    if (profile.avatar) {
      payload.author_avatar_url = profile.avatar;
    }

    let insertResult = await Core.rejectTimeout(
      db
        .from(Core.TABLE)
        .insert([payload])
        .select(getPostSelectColumns(true))
        .single(),
      Core.REST_TIMEOUT_MS,
      "Пост ленты не создался: Supabase не ответил."
    );

    if (
      insertResult.error &&
      String(insertResult.error.message || "").toLowerCase().includes("author_avatar")
    ) {
      delete payload.author_avatar_url;

      insertResult = await Core.rejectTimeout(
        db
          .from(Core.TABLE)
          .insert([payload])
          .select(getPostSelectColumns(false))
          .single(),
        Core.REST_TIMEOUT_MS,
        "Пост ленты не создался: Supabase не ответил."
      );
    }

    if (insertResult.error) {
      console.error("Klevby feed: запись feed_posts не создалась", insertResult.error);

      try {
        await db.storage
          .from(Core.BUCKET)
          .remove([imagePath]);
      } catch (removeError) {
        console.warn("Klevby feed: не удалось удалить фото после ошибки записи", removeError);
      }

      throw new Error("Пост ленты не создался: " + insertResult.error.message);
    }

    const item = Normalize.applyViewerLikeState(
      Normalize.normalizePost(insertResult.data),
      false
    );

    Core.dispatch("created", {
      item,
      postId: item?.id || ""
    });

    return item;
  }

  async function deleteFeedPostFromSupabase(postId, imagePath = "") {
    const db = Core.getClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const { error } = await Core.rejectTimeout(
      db
        .from(Core.TABLE)
        .delete()
        .eq("id", cleanPostId),
      Core.REST_TIMEOUT_MS,
      "Удаление поста не ответило."
    );

    if (error) {
      console.error("Klevby feed: ошибка удаления feed_posts", error);
      throw new Error("Не получилось удалить пост: " + error.message);
    }

    if (imagePath) {
      try {
        await db.storage
          .from(Core.BUCKET)
          .remove([imagePath]);
      } catch (storageError) {
        console.warn("Klevby feed: пост удалён, но файл Storage удалить не получилось", storageError);
      }
    }

    Core.dispatch("deleted", {
      postId: cleanPostId
    });

    return true;
  }

  window.KlevbyFeedSupabasePosts = {
    getPostSelectColumns,
    isPostsRestFallbackError,
    buildPostsRestQuery,
    runFeedPostsRestQuery,
    runFeedPostsQuery,
    loadFeedPostsFromSupabase,
    createFeedPhotoPost,
    deleteFeedPostFromSupabase
  };
})();
