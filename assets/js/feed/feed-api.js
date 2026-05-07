(function () {
  const DEFAULTS = {
    KLEVB_FEED_BUCKET: "feed-photos",
    KLEVB_FEED_TABLE: "feed_posts",
    KLEVB_FEED_LIKES_TABLE: "feed_likes",
    KLEVB_FEED_COMMENTS_TABLE: "feed_comments",
    KLEVB_FEED_VIEWS_TABLE: "feed_post_views"
  };

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getConstants() {
    const utils = getUtils();

    if (typeof utils.getConstants === "function") {
      return {
        ...DEFAULTS,
        ...utils.getConstants()
      };
    }

    return DEFAULTS;
  }

  function getDb() {
    const utils = getUtils();

    if (typeof utils.getSupabaseClient === "function") {
      return utils.getSupabaseClient();
    }

    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      try {
        return window.klevbyGetSupabase();
      } catch (error) {
        console.warn("Klevby feed api: Supabase client не получен", error);
      }
    }

    return null;
  }

  function getCurrentUser() {
    const utils = getUtils();

    if (typeof utils.getCurrentUser === "function") {
      return utils.getCurrentUser();
    }

    return (
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null
    );
  }

  async function ensureUser() {
    const utils = getUtils();

    if (typeof utils.ensureUser === "function") {
      return utils.ensureUser();
    }

    const user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    return null;
  }

  function readProfileData() {
    const utils = getUtils();

    if (typeof utils.readProfileData === "function") {
      return utils.readProfileData();
    }

    return {
      name: "Рыбак",
      city: "",
      telegram: "",
      about: ""
    };
  }

  function cleanTelegram(value) {
    const utils = getUtils();

    if (typeof utils.cleanTelegram === "function") {
      return utils.cleanTelegram(value);
    }

    return String(value || "").trim().replace(/^@/, "");
  }

  function makeIdPart() {
    const utils = getUtils();

    if (typeof utils.makeIdPart === "function") {
      return utils.makeIdPart();
    }

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function dataUrlToBlob(dataUrl) {
    const utils = getUtils();

    if (typeof utils.dataUrlToBlob === "function") {
      return utils.dataUrlToBlob(dataUrl);
    }

    const value = String(dataUrl || "");
    const parts = value.split(",");

    if (parts.length < 2) {
      throw new Error("Некорректный формат изображения");
    }

    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/jpeg";

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], {
      type: mime
    });
  }

  function getViewerKey() {
    const utils = getUtils();

    if (typeof utils.getViewerKey === "function") {
      return utils.getViewerKey();
    }

    return `viewer_${makeIdPart()}`;
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

    return {
      type: row.type || "profile_photo",
      id: row.id,
      userId: row.user_id || "",
      authorName: row.author_name || "Рыбак",
      authorCity: row.author_city || "",
      authorTelegram: row.author_telegram || "",
      authorAvatar: row.author_avatar || row.author_avatar_url || "",
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

  function getPostSelectFields() {
    return `
      id,
      user_id,
      type,
      author_name,
      author_city,
      author_telegram,
      caption,
      image_path,
      image_url,
      image_width,
      image_height,
      image_size_kb,
      likes_count,
      comments_count,
      views_count,
      engagement_score,
      created_at,
      updated_at
    `;
  }

  async function loadPosts(options = {}) {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      return {
        ok: false,
        items: [],
        error: new Error("Supabase ещё не готов")
      };
    }

    const limit = Math.min(Math.max(Number(options.limit || 40), 1), 80);

    try {
      const { data, error } = await db
        .from(constants.KLEVB_FEED_TABLE)
        .select(getPostSelectFields())
        .order("engagement_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Klevby feed api: ошибка загрузки feed_posts", error);

        return {
          ok: false,
          items: [],
          error
        };
      }

      const items = Array.isArray(data)
        ? data.map(normalizePost).filter(Boolean)
        : [];

      return {
        ok: true,
        items,
        error: null
      };
    } catch (error) {
      console.error("Klevby feed api: ошибка загрузки Supabase-ленты", error);

      return {
        ok: false,
        items: [],
        error
      };
    }
  }

  async function loadSupabaseFeedItems(options = {}) {
    return loadPosts(options);
  }

  async function getFeedItemsForRender(options = {}) {
    const utils = getUtils();
    const supabaseResult = await loadPosts({
      limit: options.limit || 40
    });

    if (supabaseResult.ok && supabaseResult.items.length) {
      return {
        source: "supabase",
        items: supabaseResult.items
      };
    }

    let localItems = [];

    if (typeof utils.getFilteredProfileFeedItems === "function") {
      localItems = utils.getFilteredProfileFeedItems({});
    }

    if (localItems.length) {
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
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      throw new Error("Supabase ещё не готов. Обнови страницу.");
    }

    const user = await ensureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди или создай профиль, чтобы фото было видно в общей ленте.");
    }

    const dataUrl = String(photoData.dataUrl || photoData.src || "");

    if (!dataUrl) {
      throw new Error("Фото не найдено для загрузки.");
    }

    const profile = readProfileData();
    const cleanUserTelegram = cleanTelegram(profile.telegram);
    const blob = dataUrlToBlob(dataUrl);

    const extension = blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";

    const fileName = `${Date.now()}-${makeIdPart()}.${extension}`;
    const imagePath = `${user.id}/${fileName}`;

    const uploadResult = await db.storage
      .from(constants.KLEVB_FEED_BUCKET)
      .upload(imagePath, blob, {
        cacheControl: "31536000",
        contentType: blob.type || "image/jpeg",
        upsert: false
      });

    if (uploadResult.error) {
      console.error("Klevby feed api: ошибка загрузки фото в Storage", uploadResult.error);
      throw new Error("Фото не загрузилось в Supabase Storage: " + uploadResult.error.message);
    }

    const publicUrlResult = db.storage
      .from(constants.KLEVB_FEED_BUCKET)
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
      author_telegram: cleanUserTelegram,
      caption: caption || "Фото с рыбалки",
      image_path: imagePath,
      image_url: imageUrl,
      image_width: Number(photoData.width || 0),
      image_height: Number(photoData.height || 0),
      image_size_kb: Number(photoData.sizeKb || photoData.savedSizeKb || Math.round(blob.size / 1024) || 0)
    };

    const insertResult = await db
      .from(constants.KLEVB_FEED_TABLE)
      .insert([payload])
      .select(getPostSelectFields())
      .single();

    if (insertResult.error) {
      console.error("Klevby feed api: запись feed_posts не создалась", insertResult.error);

      try {
        await db.storage
          .from(constants.KLEVB_FEED_BUCKET)
          .remove([imagePath]);
      } catch (removeError) {
        console.warn("Klevby feed api: не удалось удалить фото после ошибки записи", removeError);
      }

      throw new Error("Пост ленты не создался: " + insertResult.error.message);
    }

    const item = normalizePost(insertResult.data);

    dispatchFeedUpdated({
      action: "created",
      item
    });

    return item;
  }

  async function deletePost(postId, imagePath = "") {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const { error } = await db
      .from(constants.KLEVB_FEED_TABLE)
      .delete()
      .eq("id", cleanPostId);

    if (error) {
      console.error("Klevby feed api: ошибка удаления feed_posts", error);
      throw new Error("Не получилось удалить пост: " + error.message);
    }

    if (imagePath) {
      try {
        await db.storage
          .from(constants.KLEVB_FEED_BUCKET)
          .remove([imagePath]);
      } catch (storageError) {
        console.warn("Klevby feed api: пост удалён, но файл Storage удалить не получилось", storageError);
      }
    }

    dispatchFeedUpdated({
      action: "deleted",
      postId: cleanPostId
    });

    return true;
  }

  async function toggleLike(postId) {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await ensureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди, чтобы поставить лайк.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const existing = await db
      .from(constants.KLEVB_FEED_LIKES_TABLE)
      .select("id")
      .eq("post_id", cleanPostId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing.error) {
      console.error("Klevby feed api: ошибка проверки лайка", existing.error);
      throw new Error("Не получилось проверить лайк: " + existing.error.message);
    }

    if (existing.data && existing.data.id) {
      const removeResult = await db
        .from(constants.KLEVB_FEED_LIKES_TABLE)
        .delete()
        .eq("id", existing.data.id);

      if (removeResult.error) {
        console.error("Klevby feed api: ошибка удаления лайка", removeResult.error);
        throw new Error("Не получилось убрать лайк: " + removeResult.error.message);
      }

      dispatchFeedUpdated({
        action: "like_removed",
        postId: cleanPostId
      });

      return {
        liked: false
      };
    }

    const addResult = await db
      .from(constants.KLEVB_FEED_LIKES_TABLE)
      .insert([{
        post_id: cleanPostId,
        user_id: user.id
      }]);

    if (addResult.error) {
      console.error("Klevby feed api: ошибка добавления лайка", addResult.error);
      throw new Error("Не получилось поставить лайк: " + addResult.error.message);
    }

    dispatchFeedUpdated({
      action: "like_added",
      postId: cleanPostId
    });

    return {
      liked: true
    };
  }

  async function loadComments(postId) {
    const db = getDb();
    const constants = getConstants();

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

    const { data, error } = await db
      .from(constants.KLEVB_FEED_COMMENTS_TABLE)
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
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Klevby feed api: ошибка загрузки комментариев", error);

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

  async function addComment(postId, text) {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await ensureUser();

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

    const profile = readProfileData();

    const { data, error } = await db
      .from(constants.KLEVB_FEED_COMMENTS_TABLE)
      .insert([{
        post_id: cleanPostId,
        user_id: user.id,
        author_name: profile.name || "Рыбак",
        author_city: profile.city || "",
        author_telegram: cleanTelegram(profile.telegram),
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
      .single();

    if (error) {
      console.error("Klevby feed api: ошибка добавления комментария", error);
      throw new Error("Не получилось добавить комментарий: " + error.message);
    }

    dispatchFeedUpdated({
      action: "comment_added",
      postId: cleanPostId,
      comment: data
    });

    return data;
  }

  async function deleteComment(commentId) {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const { error } = await db
      .from(constants.KLEVB_FEED_COMMENTS_TABLE)
      .delete()
      .eq("id", cleanCommentId);

    if (error) {
      console.error("Klevby feed api: ошибка удаления комментария", error);
      throw new Error("Не получилось удалить комментарий: " + error.message);
    }

    dispatchFeedUpdated({
      action: "comment_deleted",
      commentId: cleanCommentId
    });

    return true;
  }

  async function registerView(postId) {
    const db = getDb();
    const constants = getConstants();

    if (!db) {
      return false;
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const user = getCurrentUser();
    const viewerKey = user && user.id
      ? `user_${user.id}`
      : getViewerKey();

    try {
      const { error } = await db
        .from(constants.KLEVB_FEED_VIEWS_TABLE)
        .insert([{
          post_id: cleanPostId,
          user_id: user?.id || null,
          viewer_key: viewerKey
        }]);

      if (error) {
        const message = String(error.message || "").toLowerCase();

        if (
          message.includes("duplicate") ||
          message.includes("unique") ||
          error.code === "23505"
        ) {
          return false;
        }

        console.warn("Klevby feed api: просмотр не записался", error);
        return false;
      }

      dispatchFeedUpdated({
        action: "view_added",
        postId: cleanPostId
      });

      return true;
    } catch (error) {
      console.warn("Klevby feed api: ошибка записи просмотра", error);
      return false;
    }
  }

  function subscribeToFeedChanges(callback) {
    const db = getDb();
    const constants = getConstants();

    if (!db || typeof db.channel !== "function") {
      return null;
    }

    if (window.__klevbyFeedRealtimeChannel) {
      return window.__klevbyFeedRealtimeChannel;
    }

    const safeCallback = typeof callback === "function"
      ? callback
      : function () {};

    const channel = db
      .channel("klevby-feed-social-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: constants.KLEVB_FEED_TABLE
        },
        (payload) => {
          safeCallback(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: constants.KLEVB_FEED_LIKES_TABLE
        },
        (payload) => {
          safeCallback(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: constants.KLEVB_FEED_COMMENTS_TABLE
        },
        (payload) => {
          safeCallback(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: constants.KLEVB_FEED_VIEWS_TABLE
        },
        (payload) => {
          safeCallback(payload);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Klevby feed: realtime подключён");
        }
      });

    window.__klevbyFeedRealtimeChannel = channel;

    return channel;
  }

  const api = {
    normalizePost,
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
    subscribe: subscribeToFeedChanges
  };

  window.KlevbyFeedApi = api;

  window.klevbyFeedSupabase = {
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
    subscribe: subscribeToFeedChanges
  };

  window.klevbyLoadFeedPostsFromSupabase = loadPosts;
  window.klevbyCreateFeedPhotoPost = createPhotoPost;
  window.klevbyDeleteFeedPostFromSupabase = deletePost;
  window.klevbyToggleFeedLike = toggleLike;
  window.klevbyLoadFeedComments = loadComments;
  window.klevbyAddFeedComment = addComment;
  window.klevbyDeleteFeedComment = deleteComment;
  window.klevbyRegisterFeedView = registerView;
})();
