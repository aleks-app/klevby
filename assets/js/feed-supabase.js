(function () {
  const KLEVB_FEED_BUCKET = "feed-photos";
  const KLEVB_FEED_TABLE = "feed_posts";
  const KLEVB_FEED_LIKES_TABLE = "feed_likes";
  const KLEVB_FEED_COMMENTS_TABLE = "feed_comments";
  const KLEVB_FEED_VIEWS_TABLE = "feed_post_views";

  const KLEVB_FEED_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_FEED_VIEWER_KEY = "klevby_feed_viewer_key";

  function klevbyFeedSupabaseGetClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function klevbyFeedSupabaseGetCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    if (typeof window.klevbyGetCurrentUser === "function") {
      return window.klevbyGetCurrentUser();
    }

    return null;
  }

  async function klevbyFeedSupabaseEnsureUser() {
    let user = klevbyFeedSupabaseGetCurrentUser();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await window.restoreAuthState("feed_supabase_action", false);
      } catch (error) {
        console.warn("Klevby feed: не удалось восстановить вход", error);
      }
    }

    user = klevbyFeedSupabaseGetCurrentUser();

    if (user && user.id) {
      return user;
    }

    return null;
  }

  function klevbyFeedSupabaseReadProfileData() {
    try {
      const raw = localStorage.getItem(KLEVB_FEED_PROFILE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const user = klevbyFeedSupabaseGetCurrentUser();
      const meta = user?.user_metadata || {};

      const fallbackName =
        localStorage.getItem(KLEVB_FEED_PROFILE_NAME_KEY) ||
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        "";

      return {
        name: String(parsed.name || fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim()
      };
    } catch (error) {
      console.warn("Klevby feed: не удалось прочитать данные профиля", error);

      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: ""
      };
    }
  }

  function klevbyFeedSupabaseCleanTelegram(value) {
    let cleanValue = String(value || "").trim();

    cleanValue = cleanValue.replace(/^@/, "");
    cleanValue = cleanValue.replace(/^https?:\/\/t\.me\//i, "");
    cleanValue = cleanValue.replace(/^https?:\/\/telegram\.me\//i, "");
    cleanValue = cleanValue.replace(/^t\.me\//i, "");
    cleanValue = cleanValue.split("?")[0];
    cleanValue = cleanValue.split("/")[0];
    cleanValue = cleanValue.replace(/[^a-zA-Z0-9_]/g, "");

    return cleanValue;
  }

  function klevbyFeedSupabaseMakeIdPart() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return [
      Date.now(),
      Math.random().toString(16).slice(2),
      Math.random().toString(16).slice(2)
    ].join("-");
  }

  function klevbyFeedSupabaseGetViewerKey() {
    try {
      let key = localStorage.getItem(KLEVB_FEED_VIEWER_KEY);

      if (!key || key.length < 12) {
        key = `viewer_${klevbyFeedSupabaseMakeIdPart()}`;
        localStorage.setItem(KLEVB_FEED_VIEWER_KEY, key);
      }

      return key;
    } catch (error) {
      return `viewer_${klevbyFeedSupabaseMakeIdPart()}`;
    }
  }

  function klevbyFeedSupabaseDataUrlToBlob(dataUrl) {
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
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], {
      type: mime
    });
  }

  function klevbyFeedSupabaseNormalizePost(row) {
    if (!row) return null;

    return {
      type: row.type || "profile_photo",
      id: row.id,
      userId: row.user_id || "",
      authorName: row.author_name || "Рыбак",
      authorCity: row.author_city || "",
      authorTelegram: row.author_telegram || "",
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

  async function klevbyLoadFeedPostsFromSupabase(options = {}) {
    const db = klevbyFeedSupabaseGetClient();

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
        .from(KLEVB_FEED_TABLE)
        .select(`
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
        `)
        .order("engagement_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Klevby feed: ошибка загрузки feed_posts", error);

        return {
          ok: false,
          items: [],
          error
        };
      }

      const items = Array.isArray(data)
        ? data.map(klevbyFeedSupabaseNormalizePost).filter(Boolean)
        : [];

      return {
        ok: true,
        items,
        error: null
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

  async function klevbyCreateFeedPhotoPost(photoData = {}) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов. Обнови страницу.");
    }

    const user = await klevbyFeedSupabaseEnsureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди или создай профиль, чтобы фото было видно в общей ленте.");
    }

    const dataUrl = String(photoData.dataUrl || photoData.src || "");

    if (!dataUrl) {
      throw new Error("Фото не найдено для загрузки.");
    }

    const profile = klevbyFeedSupabaseReadProfileData();
    const cleanTelegram = klevbyFeedSupabaseCleanTelegram(profile.telegram);
    const blob = klevbyFeedSupabaseDataUrlToBlob(dataUrl);

    const extension = blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";

    const fileName = `${Date.now()}-${klevbyFeedSupabaseMakeIdPart()}.${extension}`;
    const imagePath = `${user.id}/${fileName}`;

    const uploadResult = await db.storage
      .from(KLEVB_FEED_BUCKET)
      .upload(imagePath, blob, {
        cacheControl: "31536000",
        contentType: blob.type || "image/jpeg",
        upsert: false
      });

    if (uploadResult.error) {
      console.error("Klevby feed: ошибка загрузки фото в Storage", uploadResult.error);
      throw new Error("Фото не загрузилось в Supabase Storage: " + uploadResult.error.message);
    }

    const publicUrlResult = db.storage
      .from(KLEVB_FEED_BUCKET)
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

    const insertResult = await db
      .from(KLEVB_FEED_TABLE)
      .insert([payload])
      .select(`
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
      `)
      .single();

    if (insertResult.error) {
      console.error("Klevby feed: запись feed_posts не создалась", insertResult.error);

      try {
        await db.storage
          .from(KLEVB_FEED_BUCKET)
          .remove([imagePath]);
      } catch (removeError) {
        console.warn("Klevby feed: не удалось удалить фото после ошибки записи", removeError);
      }

      throw new Error("Пост ленты не создался: " + insertResult.error.message);
    }

    const item = klevbyFeedSupabaseNormalizePost(insertResult.data);

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "created",
        item
      }
    }));

    return item;
  }

  async function klevbyDeleteFeedPostFromSupabase(postId, imagePath = "") {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const { error } = await db
      .from(KLEVB_FEED_TABLE)
      .delete()
      .eq("id", cleanPostId);

    if (error) {
      console.error("Klevby feed: ошибка удаления feed_posts", error);
      throw new Error("Не получилось удалить пост: " + error.message);
    }

    if (imagePath) {
      try {
        await db.storage
          .from(KLEVB_FEED_BUCKET)
          .remove([imagePath]);
      } catch (storageError) {
        console.warn("Klevby feed: пост удалён, но файл Storage удалить не получилось", storageError);
      }
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "deleted",
        postId: cleanPostId
      }
    }));

    return true;
  }

  async function klevbyToggleFeedLike(postId) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await klevbyFeedSupabaseEnsureUser();

    if (!user || !user.id) {
      throw new Error("Сначала войди, чтобы поставить лайк.");
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    const existing = await db
      .from(KLEVB_FEED_LIKES_TABLE)
      .select("id")
      .eq("post_id", cleanPostId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing.error) {
      console.error("Klevby feed: ошибка проверки лайка", existing.error);
      throw new Error("Не получилось проверить лайк: " + existing.error.message);
    }

    if (existing.data && existing.data.id) {
      const removeResult = await db
        .from(KLEVB_FEED_LIKES_TABLE)
        .delete()
        .eq("id", existing.data.id);

      if (removeResult.error) {
        console.error("Klevby feed: ошибка удаления лайка", removeResult.error);
        throw new Error("Не получилось убрать лайк: " + removeResult.error.message);
      }

      window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
        detail: {
          action: "like_removed",
          postId: cleanPostId
        }
      }));

      return {
        liked: false
      };
    }

    const addResult = await db
      .from(KLEVB_FEED_LIKES_TABLE)
      .insert([{
        post_id: cleanPostId,
        user_id: user.id
      }]);

    if (addResult.error) {
      console.error("Klevby feed: ошибка добавления лайка", addResult.error);
      throw new Error("Не получилось поставить лайк: " + addResult.error.message);
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "like_added",
        postId: cleanPostId
      }
    }));

    return {
      liked: true
    };
  }

  async function klevbyLoadFeedComments(postId) {
    const db = klevbyFeedSupabaseGetClient();

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
      .from(KLEVB_FEED_COMMENTS_TABLE)
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

  async function klevbyAddFeedComment(postId, text) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const user = await klevbyFeedSupabaseEnsureUser();

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

    const profile = klevbyFeedSupabaseReadProfileData();

    const { data, error } = await db
      .from(KLEVB_FEED_COMMENTS_TABLE)
      .insert([{
        post_id: cleanPostId,
        user_id: user.id,
        author_name: profile.name || "Рыбак",
        author_city: profile.city || "",
        author_telegram: klevbyFeedSupabaseCleanTelegram(profile.telegram),
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
      console.error("Klevby feed: ошибка добавления комментария", error);
      throw new Error("Не получилось добавить комментарий: " + error.message);
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "comment_added",
        postId: cleanPostId,
        comment: data
      }
    }));

    return data;
  }

  async function klevbyDeleteFeedComment(commentId) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const { error } = await db
      .from(KLEVB_FEED_COMMENTS_TABLE)
      .delete()
      .eq("id", cleanCommentId);

    if (error) {
      console.error("Klevby feed: ошибка удаления комментария", error);
      throw new Error("Не получилось удалить комментарий: " + error.message);
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: "comment_deleted",
        commentId: cleanCommentId
      }
    }));

    return true;
  }

  async function klevbyRegisterFeedView(postId) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      return false;
    }

    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    const user = klevbyFeedSupabaseGetCurrentUser();
    const viewerKey = user && user.id
      ? `user_${user.id}`
      : klevbyFeedSupabaseGetViewerKey();

    try {
      const { error } = await db
        .from(KLEVB_FEED_VIEWS_TABLE)
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

        console.warn("Klevby feed: просмотр не записался", error);
        return false;
      }

      window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
        detail: {
          action: "view_added",
          postId: cleanPostId
        }
      }));

      return true;
    } catch (error) {
      console.warn("Klevby feed: ошибка записи просмотра", error);
      return false;
    }
  }

  window.klevbyFeedSupabase = {
    loadPosts: klevbyLoadFeedPostsFromSupabase,
    createPhotoPost: klevbyCreateFeedPhotoPost,
    deletePost: klevbyDeleteFeedPostFromSupabase,
    toggleLike: klevbyToggleFeedLike,
    loadComments: klevbyLoadFeedComments,
    addComment: klevbyAddFeedComment,
    deleteComment: klevbyDeleteFeedComment,
    registerView: klevbyRegisterFeedView
  };

  window.klevbyLoadFeedPostsFromSupabase = klevbyLoadFeedPostsFromSupabase;
  window.klevbyCreateFeedPhotoPost = klevbyCreateFeedPhotoPost;
  window.klevbyDeleteFeedPostFromSupabase = klevbyDeleteFeedPostFromSupabase;
  window.klevbyToggleFeedLike = klevbyToggleFeedLike;
  window.klevbyLoadFeedComments = klevbyLoadFeedComments;
  window.klevbyAddFeedComment = klevbyAddFeedComment;
  window.klevbyDeleteFeedComment = klevbyDeleteFeedComment;
  window.klevbyRegisterFeedView = klevbyRegisterFeedView;
})();
