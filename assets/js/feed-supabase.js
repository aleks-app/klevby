(function () {
  const KLEVB_FEED_BUCKET = "feed-photos";
  const KLEVB_FEED_TABLE = "feed_posts";
  const KLEVB_FEED_LIKES_TABLE = "feed_likes";
  const KLEVB_FEED_COMMENTS_TABLE = "feed_comments";
  const KLEVB_FEED_VIEWS_TABLE = "feed_post_views";

  const KLEVB_FEED_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_FEED_VIEWER_KEY = "klevby_feed_viewer_key";

  const KLEVB_FEED_AUTH_TIMEOUT_MS = 1400;
  const KLEVB_FEED_REST_TIMEOUT_MS = 9000;
  const KLEVB_FEED_SDK_TIMEOUT_MS = 6500;
  const KLEVB_FEED_TOKEN_EXPIRY_GRACE_SECONDS = 60;

  const KLEVB_FEED_COMMENT_SELECT = [
    "id",
    "post_id",
    "user_id",
    "author_name",
    "author_city",
    "author_telegram",
    "text",
    "created_at",
    "updated_at"
  ].join(",");

  let klevbyFeedRealtimeChannel = null;
  let klevbyFeedRealtimeCallback = null;

  function klevbyFeedSupabaseGetClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function klevbyFeedSupabaseGetConfig() {
    const config = window.KLEVB_CONFIG || window.KlevbyConfig || window.klevbyConfig || {};

    const supabaseUrl =
      config.SUPABASE_URL ||
      config.supabaseUrl ||
      window.SUPABASE_URL ||
      window.KLEVB_SUPABASE_URL ||
      "";

    const supabaseAnonKey =
      config.SUPABASE_ANON_KEY ||
      config.supabaseAnonKey ||
      window.SUPABASE_ANON_KEY ||
      window.KLEVB_SUPABASE_ANON_KEY ||
      "";

    const supabaseStorageKey =
      config.SUPABASE_STORAGE_KEY ||
      config.supabaseStorageKey ||
      "sb-klevby-auth-token";

    return {
      supabaseUrl: String(supabaseUrl || "").replace(/\/+$/, ""),
      supabaseAnonKey: String(supabaseAnonKey || ""),
      supabaseStorageKey: String(supabaseStorageKey || "sb-klevby-auth-token")
    };
  }

  function klevbyFeedSupabaseSafeJsonParse(value) {
    try {
      if (!value) return null;

      if (typeof value === "object") {
        return value;
      }

      return JSON.parse(String(value));
    } catch (_) {
      return null;
    }
  }

  function klevbyFeedSupabaseExtractSession(value) {
    const parsed = klevbyFeedSupabaseSafeJsonParse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidates = [
      parsed,
      parsed.currentSession,
      parsed.session,
      parsed.data?.session,
      parsed.auth?.currentSession,
      parsed.auth?.session
    ].filter(Boolean);

    for (const candidate of candidates) {
      const accessToken =
        candidate.access_token ||
        candidate.accessToken ||
        candidate.provider_token ||
        "";

      if (!accessToken) continue;

      const user =
        candidate.user ||
        parsed.user ||
        parsed.currentUser ||
        parsed.data?.user ||
        null;

      const expiresAt = Number(candidate.expires_at || candidate.expiresAt || 0);

      return {
        accessToken: String(accessToken),
        refreshToken: String(candidate.refresh_token || candidate.refreshToken || ""),
        expiresAt,
        user
      };
    }

    return null;
  }

  function klevbyFeedSupabaseIsSessionFresh(session, graceSeconds = KLEVB_FEED_TOKEN_EXPIRY_GRACE_SECONDS) {
    if (!session || !session.accessToken) {
      return false;
    }

    const expiresAt = Number(session.expiresAt || 0);

    if (!expiresAt) {
      return true;
    }

    const expiresAtMs = expiresAt > 100000000000 ? expiresAt : expiresAt * 1000;
    const graceMs = Math.max(0, Number(graceSeconds || 0)) * 1000;

    return expiresAtMs - Date.now() > graceMs;
  }

  function klevbyFeedSupabaseGetStoredSession() {
    const config = klevbyFeedSupabaseGetConfig();
    const directKeys = [
      config.supabaseStorageKey,
      "sb-klevby-auth-token"
    ].filter(Boolean);

    try {
      for (const key of directKeys) {
        const raw = localStorage.getItem(key);
        const session = klevbyFeedSupabaseExtractSession(raw);

        if (session && session.accessToken) {
          return session;
        }
      }

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = String(localStorage.key(i) || "");

        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) {
          continue;
        }

        const raw = localStorage.getItem(key);
        const session = klevbyFeedSupabaseExtractSession(raw);

        if (session && session.accessToken) {
          return session;
        }
      }
    } catch (error) {
      console.debug("Klevby feed: stored auth session skipped", error);
    }

    return null;
  }

  async function klevbyFeedSupabaseGetAuthContext(options = {}) {
    const requireAuth = Boolean(options.requireAuth);

    if (!requireAuth) {
      return {
        accessToken: "",
        user: null,
        source: "anon_public"
      };
    }

    const storedSession = klevbyFeedSupabaseGetStoredSession();

    if (klevbyFeedSupabaseIsSessionFresh(storedSession)) {
      return {
        accessToken: storedSession.accessToken,
        user: storedSession.user || null,
        source: "storage"
      };
    }

    if (storedSession && storedSession.accessToken) {
      console.debug("Klevby feed: stored auth session expired/skipped");
    }

    const db = klevbyFeedSupabaseGetClient();

    if (db && db.auth && typeof db.auth.getSession === "function") {
      try {
        const sessionResult = await klevbyFeedSupabaseWithTimeout(
          db.auth.getSession(),
          KLEVB_FEED_AUTH_TIMEOUT_MS,
          null
        );

        const session = sessionResult?.data?.session || null;

        if (
          session &&
          session.access_token &&
          klevbyFeedSupabaseIsSessionFresh({
            accessToken: session.access_token,
            expiresAt: session.expires_at,
            user: session.user || null
          })
        ) {
          return {
            accessToken: String(session.access_token),
            user: session.user || null,
            source: "sdk_session"
          };
        }
      } catch (error) {
        console.debug("Klevby feed: auth session skipped", error);
      }
    }

    return {
      accessToken: "",
      user: null,
      source: "missing"
    };
  }

  function klevbyFeedSupabaseGetCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    const storedSession = klevbyFeedSupabaseGetStoredSession();

    if (storedSession?.user?.id) {
      return storedSession.user;
    }

    if (typeof window.klevbyGetCurrentUser === "function") {
      try {
        const user = window.klevbyGetCurrentUser();

        if (user && typeof user.then !== "function") {
          return user;
        }
      } catch (error) {
        console.debug("Klevby feed: current user getter skipped", error);
      }
    }

    return null;
  }

  function klevbyFeedSupabaseWithTimeout(promise, timeoutMs, fallbackValue = null) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), Math.max(0, Number(timeoutMs || 0)));
      })
    ]);
  }

  function klevbyFeedSupabaseRejectTimeout(promise, timeoutMs, errorMessage) {
    let timer = null;

    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(errorMessage || "Supabase не ответил."));
        }, Math.max(1200, Number(timeoutMs || 0)));
      })
    ]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  async function klevbyFeedSupabaseRestRequest(path, options = {}) {
    const config = klevbyFeedSupabaseGetConfig();
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const method = String(options.method || "GET").toUpperCase();
    const requireAuth = Boolean(options.requireAuth);
    const timeoutMs = Number(options.timeoutMs || KLEVB_FEED_REST_TIMEOUT_MS);

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("REST Supabase не настроен.");
    }

    const authContext = await klevbyFeedSupabaseGetAuthContext({
      requireAuth
    });

    if (requireAuth && !authContext.accessToken) {
      throw new Error("Сначала войди, чтобы выполнить действие.");
    }

    const query = options.query ? `?${String(options.query).replace(/^\?/, "")}` : "";
    const url = `${config.supabaseUrl}/rest/v1/${cleanPath}${query}`;

    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${authContext.accessToken || config.supabaseAnonKey}`,
      Accept: "application/json"
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.prefer) {
      headers.Prefer = String(options.prefer);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, Math.max(1200, timeoutMs));

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      const data = text ? klevbyFeedSupabaseSafeJsonParse(text) : null;

      if (!response.ok) {
        const message =
          data?.message ||
          data?.error_description ||
          data?.error ||
          `Supabase REST ошибка ${response.status}`;

        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        error.code = data?.code || "";
        error.details = data?.details || "";
        error.hint = data?.hint || "";
        throw error;
      }

      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Supabase не ответил.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function klevbyFeedSupabaseGetViewerUserId(db, options = {}) {
    const restore = Boolean(options.restore);

    let user = klevbyFeedSupabaseGetCurrentUser();

    if (user && user.id) {
      return String(user.id);
    }

    if (restore && typeof window.restoreAuthState === "function") {
      try {
        await klevbyFeedSupabaseWithTimeout(
          window.restoreAuthState("feed_supabase_viewer", false),
          KLEVB_FEED_AUTH_TIMEOUT_MS,
          null
        );
      } catch (error) {
        console.debug("Klevby feed: restore auth for viewer skipped", error);
      }

      user = klevbyFeedSupabaseGetCurrentUser();

      if (user && user.id) {
        return String(user.id);
      }
    }

    if (db && db.auth && typeof db.auth.getUser === "function") {
      try {
        const result = await klevbyFeedSupabaseWithTimeout(
          db.auth.getUser(),
          KLEVB_FEED_AUTH_TIMEOUT_MS,
          null
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          return String(authUser.id);
        }
      } catch (error) {
        console.debug("Klevby feed: auth.getUser skipped", error);
      }
    }

    return "";
  }

  async function klevbyFeedSupabaseEnsureUser() {
    let user = klevbyFeedSupabaseGetCurrentUser();

    if (user && user.id) {
      return user;
    }

    const storedSession = klevbyFeedSupabaseGetStoredSession();

    if (storedSession?.user?.id) {
      return storedSession.user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await klevbyFeedSupabaseWithTimeout(
          window.restoreAuthState("feed_supabase_action", false),
          KLEVB_FEED_AUTH_TIMEOUT_MS,
          null
        );
      } catch (error) {
        console.warn("Klevby feed: не удалось восстановить вход", error);
      }
    }

    user = klevbyFeedSupabaseGetCurrentUser();

    if (user && user.id) {
      return user;
    }

    const db = klevbyFeedSupabaseGetClient();

    if (db && db.auth && typeof db.auth.getUser === "function") {
      try {
        const result = await klevbyFeedSupabaseWithTimeout(
          db.auth.getUser(),
          KLEVB_FEED_AUTH_TIMEOUT_MS,
          null
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          return authUser;
        }
      } catch (error) {
        console.debug("Klevby feed: auth user fallback skipped", error);
      }
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

      let avatar = "";

      try {
        avatar = localStorage.getItem(KLEVB_FEED_PROFILE_AVATAR_KEY) || "";
      } catch (avatarError) {
        avatar = "";
      }

      return {
        name: String(parsed.name || fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim(),
        avatar: String(avatar || "").trim()
      };
    } catch (error) {
      console.warn("Klevby feed: не удалось прочитать данные профиля", error);

      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: "",
        avatar: ""
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
      throw new Error("Некорректный формат изображения.");
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

  function klevbyFeedSupabaseReadBoolean(value) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === 1) return true;
    if (value === 0) return false;

    return false;
  }

  function klevbyFeedSupabaseNormalizePost(row) {
    if (!row) return null;

    const likedByViewer = klevbyFeedSupabaseReadBoolean(
      row.liked_by_viewer ??
      row.likedByViewer ??
      row.viewerLiked ??
      row.viewer_liked ??
      row.isLiked ??
      row.liked ??
      row.hasLiked ??
      false
    );

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
      source: "supabase",

      likedByViewer,
      viewerLiked: likedByViewer,
      isLiked: likedByViewer,
      liked: likedByViewer,
      hasLiked: likedByViewer,
      liked_by_viewer: likedByViewer
    };
  }

  function klevbyFeedSupabaseApplyViewerLikeState(item, liked) {
    const safeLiked = Boolean(liked);

    return {
      ...item,
      likedByViewer: safeLiked,
      viewerLiked: safeLiked,
      isLiked: safeLiked,
      liked: safeLiked,
      hasLiked: safeLiked,
      liked_by_viewer: safeLiked
    };
  }

  function klevbyFeedSupabaseGetPostIds(items) {
    return Array.from(
      new Set(
        (Array.isArray(items) ? items : [])
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      )
    );
  }

  function klevbyFeedSupabaseNormalizeIds(postIds) {
    return Array.from(
      new Set(
        (Array.isArray(postIds) ? postIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );
  }

  function klevbyFeedSupabaseMakeZeroCountMap(postIds) {
    const counts = new Map();

    klevbyFeedSupabaseNormalizeIds(postIds).forEach((id) => {
      counts.set(id, 0);
    });

    return counts;
  }

  function klevbyFeedSupabaseCountCommentsRows(rows, postIds = []) {
    const counts = klevbyFeedSupabaseMakeZeroCountMap(postIds);

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const postId = String(row?.post_id || row?.postId || "").trim();

      if (!postId) return;

      counts.set(postId, Number(counts.get(postId) || 0) + 1);
    });

    return counts;
  }

  async function klevbyFeedSupabaseLoadRealCommentCountsRest(postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id");
    params.set("post_id", `in.(${ids.join(",")})`);

    const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_COMMENTS_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return klevbyFeedSupabaseCountCommentsRows(data, ids);
  }

  async function klevbyFeedSupabaseLoadRealCommentCountsSdk(db, postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!db || !ids.length) {
      return new Map();
    }

    const { data, error } = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_COMMENTS_TABLE)
        .select("post_id")
        .in("post_id", ids),
      KLEVB_FEED_SDK_TIMEOUT_MS,
      "Счётчики комментариев не ответили."
    );

    if (error) {
      throw error;
    }

    return klevbyFeedSupabaseCountCommentsRows(data, ids);
  }

  async function klevbyFeedSupabaseLoadRealCommentCounts(db, postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    try {
      return await klevbyFeedSupabaseLoadRealCommentCountsRest(ids);
    } catch (restError) {
      console.debug("Klevby feed: REST счётчики комментариев пропущены, пробую SDK", restError);

      try {
        return await klevbyFeedSupabaseLoadRealCommentCountsSdk(db, ids);
      } catch (sdkError) {
        console.debug("Klevby feed: реальные счётчики комментариев пропущены", sdkError);
        return new Map();
      }
    }
  }

  async function klevbyFeedSupabaseApplyRealCommentCounts(db, items) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const postIds = klevbyFeedSupabaseGetPostIds(safeItems);
    const counts = await klevbyFeedSupabaseLoadRealCommentCounts(db, postIds);

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

  function klevbyFeedSupabaseCountUniqueLikeUsersRows(rows, postIds = []) {
    const usersByPost = new Map();
    const counts = klevbyFeedSupabaseMakeZeroCountMap(postIds);

    klevbyFeedSupabaseNormalizeIds(postIds).forEach((postId) => {
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

  async function klevbyFeedSupabaseLoadRealLikeCountsRest(postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id,user_id");
    params.set("post_id", `in.(${ids.join(",")})`);
    params.set("limit", "10000");

    const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_LIKES_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return klevbyFeedSupabaseCountUniqueLikeUsersRows(data, ids);
  }

  async function klevbyFeedSupabaseLoadRealLikeCountsSdk(db, postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!db || !ids.length) {
      return new Map();
    }

    const { data, error } = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_LIKES_TABLE)
        .select("post_id,user_id")
        .in("post_id", ids)
        .limit(10000),
      KLEVB_FEED_SDK_TIMEOUT_MS,
      "Счётчики лайков не ответили."
    );

    if (error) {
      throw error;
    }

    return klevbyFeedSupabaseCountUniqueLikeUsersRows(data, ids);
  }

  async function klevbyFeedSupabaseLoadRealLikeCounts(db, postIds) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);

    if (!ids.length) {
      return new Map();
    }

    try {
      return await klevbyFeedSupabaseLoadRealLikeCountsRest(ids);
    } catch (restError) {
      console.debug("Klevby feed: REST счётчики лайков пропущены, пробую SDK", restError);

      if (!db) {
        return new Map();
      }

      try {
        return await klevbyFeedSupabaseLoadRealLikeCountsSdk(db, ids);
      } catch (sdkError) {
        console.debug("Klevby feed: реальные счётчики лайков пропущены", sdkError);
        return new Map();
      }
    }
  }

  async function klevbyFeedSupabaseApplyRealLikeCounts(db, items) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const postIds = klevbyFeedSupabaseGetPostIds(safeItems);
    const counts = await klevbyFeedSupabaseLoadRealLikeCounts(db, postIds);

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

  async function klevbyFeedSupabaseLoadViewerLikedPostIdsRest(postIds, userId) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();

    if (!ids.length || !cleanUserId) {
      return new Set();
    }

    const params = new URLSearchParams();
    params.set("select", "post_id");
    params.set("user_id", `eq.${cleanUserId}`);
    params.set("post_id", `in.(${ids.join(",")})`);

    const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_LIKES_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: true,
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return new Set(
      (Array.isArray(data) ? data : [])
        .map((row) => String(row?.post_id || "").trim())
        .filter(Boolean)
    );
  }

  async function klevbyFeedSupabaseLoadViewerLikedPostIdsSdk(db, postIds, userId) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();

    if (!db || !ids.length || !cleanUserId) {
      return new Set();
    }

    const { data, error } = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_LIKES_TABLE)
        .select("post_id")
        .eq("user_id", cleanUserId)
        .in("post_id", ids),
      KLEVB_FEED_SDK_TIMEOUT_MS,
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

  async function klevbyFeedSupabaseLoadViewerLikedPostIds(db, postIds, userId) {
    const ids = klevbyFeedSupabaseNormalizeIds(postIds);
    const cleanUserId = String(userId || "").trim();

    if (!ids.length || !cleanUserId) {
      return new Set();
    }

    try {
      return await klevbyFeedSupabaseLoadViewerLikedPostIdsRest(ids, cleanUserId);
    } catch (restError) {
      console.debug("Klevby feed: REST проверка моих лайков пропущена, пробую SDK", restError);

      if (!db) {
        return new Set();
      }

      try {
        return await klevbyFeedSupabaseLoadViewerLikedPostIdsSdk(db, ids, cleanUserId);
      } catch (sdkError) {
        console.warn("Klevby feed: ошибка проверки моих лайков", sdkError);
        return new Set();
      }
    }
  }

  async function klevbyFeedSupabaseApplyViewerLikes(db, items, options = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      return [];
    }

    const userId = await klevbyFeedSupabaseGetViewerUserId(db, {
      restore: Boolean(options.restore)
    });

    if (!userId) {
      return safeItems.map((item) => klevbyFeedSupabaseApplyViewerLikeState(item, false));
    }

    const likedPostIds = await klevbyFeedSupabaseLoadViewerLikedPostIds(
      db,
      safeItems.map((item) => item?.id),
      userId
    );

    return safeItems.map((item) => {
      const id = String(item?.id || "").trim();
      return klevbyFeedSupabaseApplyViewerLikeState(item, likedPostIds.has(id));
    });
  }

  async function klevbyFeedSupabaseGetExactLikeState(db, postId, userId) {
    const cleanPostId = String(postId || "").trim();
    const cleanUserId = String(userId || "").trim();

    if (!cleanPostId) {
      return {
        liked: false,
        likesCount: 0
      };
    }

    const likeCounts = await klevbyFeedSupabaseLoadRealLikeCounts(db, [cleanPostId]);
    const likesCount = Math.max(0, Number(likeCounts.get(cleanPostId) || 0) || 0);

    let liked = false;

    if (cleanUserId) {
      const likedPostIds = await klevbyFeedSupabaseLoadViewerLikedPostIds(
        db,
        [cleanPostId],
        cleanUserId
      );

      liked = likedPostIds.has(cleanPostId);
    }

    return {
      liked,
      likesCount
    };
  }

  function klevbyFeedSupabaseIsDuplicateError(error) {
    const code = String(error?.code || error?.data?.code || error?.details?.code || "").trim();
    const message = String(error?.message || error?.data?.message || "").toLowerCase();
    const details = String(error?.details || error?.data?.details || "").toLowerCase();
    const hint = String(error?.hint || error?.data?.hint || "").toLowerCase();
    const constraint = String(error?.constraint || error?.data?.constraint || "").toLowerCase();

    return (
      code === "23505" ||
      code === "409" ||
      message.includes("duplicate") ||
      message.includes("unique") ||
      details.includes("duplicate") ||
      details.includes("unique") ||
      hint.includes("duplicate") ||
      hint.includes("unique") ||
      constraint.includes("unique")
    );
  }

  async function klevbyFeedSupabaseGetPostCounters(db, postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return null;
    }

    let data = null;

    if (db) {
      try {
        const result = await klevbyFeedSupabaseRejectTimeout(
          db
            .from(KLEVB_FEED_TABLE)
            .select("likes_count,comments_count,views_count,engagement_score,updated_at")
            .eq("id", cleanPostId)
            .maybeSingle(),
          KLEVB_FEED_SDK_TIMEOUT_MS,
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

    const likeCounts = await klevbyFeedSupabaseLoadRealLikeCounts(db, [cleanPostId]);
    const commentCounts = await klevbyFeedSupabaseLoadRealCommentCounts(db, [cleanPostId]);

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

  function klevbyFeedSupabaseDispatch(action, detail = {}) {
    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action,
        ...detail
      }
    }));

    if (typeof klevbyFeedRealtimeCallback === "function") {
      try {
        klevbyFeedRealtimeCallback({
          action,
          ...detail
        });
      } catch (error) {
        console.warn("Klevby feed: callback realtime не сработал", error);
      }
    }
  }

  function klevbyFeedSupabaseGetPostSelectColumns(includeAvatar = true) {
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

  function klevbyFeedSupabaseIsPostsRestFallbackError(error) {
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

  function klevbyFeedSupabaseBuildPostsRestQuery(limit, options = {}) {
    const params = new URLSearchParams();
    const includeAvatar = options.includeAvatar !== false;
    const includeEngagementOrder = options.includeEngagementOrder !== false;

    params.set("select", klevbyFeedSupabaseGetPostSelectColumns(includeAvatar));

    params.set(
      "order",
      includeEngagementOrder
        ? "created_at.desc,engagement_score.desc"
        : "created_at.desc"
    );

    params.set("limit", String(limit));

    return params.toString();
  }

  async function klevbyRunFeedPostsRestQuery(limit) {
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
        const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_TABLE, {
          method: "GET",
          query: klevbyFeedSupabaseBuildPostsRestQuery(limit, attempt),
          requireAuth: false,
          timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
        });

        return {
          data: Array.isArray(data) ? data : [],
          error: null,
          source: attempt.source
        };
      } catch (error) {
        lastError = error;

        if (!klevbyFeedSupabaseIsPostsRestFallbackError(error)) {
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

  async function klevbyRunFeedPostsQuery(db, limit) {
    let result = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_TABLE)
        .select(klevbyFeedSupabaseGetPostSelectColumns(true))
        .order("created_at", { ascending: false })
        .order("engagement_score", { ascending: false })
        .limit(limit),
      KLEVB_FEED_SDK_TIMEOUT_MS,
      "Лента не ответила."
    );

    if (
      result.error &&
      String(result.error.message || "").toLowerCase().includes("author_avatar")
    ) {
      result = await klevbyFeedSupabaseRejectTimeout(
        db
          .from(KLEVB_FEED_TABLE)
          .select(klevbyFeedSupabaseGetPostSelectColumns(false))
          .order("created_at", { ascending: false })
          .order("engagement_score", { ascending: false })
          .limit(limit),
        KLEVB_FEED_SDK_TIMEOUT_MS,
        "Лента не ответила."
      );
    }

    if (
      result.error &&
      String(result.error.message || "").toLowerCase().includes("engagement_score")
    ) {
      result = await klevbyFeedSupabaseRejectTimeout(
        db
          .from(KLEVB_FEED_TABLE)
          .select(klevbyFeedSupabaseGetPostSelectColumns(false))
          .order("created_at", { ascending: false })
          .limit(limit),
        KLEVB_FEED_SDK_TIMEOUT_MS,
        "Лента не ответила."
      );
    }

    return {
      ...result,
      source: "sdk"
    };
  }

  async function klevbyLoadFeedPostsFromSupabase(options = {}) {
    const db = klevbyFeedSupabaseGetClient();
    const config = klevbyFeedSupabaseGetConfig();

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
        result = await klevbyRunFeedPostsRestQuery(limit);
      } catch (restError) {
        console.debug("Klevby feed: REST загрузка ленты не сработала, пробую SDK", restError);

        if (!db) {
          throw restError;
        }

        result = await klevbyRunFeedPostsQuery(db, limit);
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
        ? result.data.map(klevbyFeedSupabaseNormalizePost).filter(Boolean)
        : [];

      const realLikeItems = await klevbyFeedSupabaseApplyRealLikeCounts(db, normalizedItems);

      const likedItems = await klevbyFeedSupabaseApplyViewerLikes(db, realLikeItems, {
        restore: true
      });

      const items = await klevbyFeedSupabaseApplyRealCommentCounts(db, likedItems);

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

    if (blob.size > 5 * 1024 * 1024) {
      throw new Error("Фото больше 5 МБ. Нужно выбрать фото меньше или сильнее сжать.");
    }

    const extension = blob.type === "image/webp"
      ? "webp"
      : blob.type === "image/png"
        ? "png"
        : "jpg";

    const fileName = `${Date.now()}-${klevbyFeedSupabaseMakeIdPart()}.${extension}`;
    const imagePath = `${user.id}/${fileName}`;

    const uploadResult = await klevbyFeedSupabaseRejectTimeout(
      db.storage
        .from(KLEVB_FEED_BUCKET)
        .upload(imagePath, blob, {
          cacheControl: "31536000",
          contentType: blob.type || "image/jpeg",
          upsert: false
        }),
      KLEVB_FEED_REST_TIMEOUT_MS,
      "Фото не загрузилось: Supabase не ответил."
    );

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

    if (profile.avatar) {
      payload.author_avatar_url = profile.avatar;
    }

    let insertResult = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_TABLE)
        .insert([payload])
        .select(klevbyFeedSupabaseGetPostSelectColumns(true))
        .single(),
      KLEVB_FEED_REST_TIMEOUT_MS,
      "Пост ленты не создался: Supabase не ответил."
    );

    if (
      insertResult.error &&
      String(insertResult.error.message || "").toLowerCase().includes("author_avatar")
    ) {
      delete payload.author_avatar_url;

      insertResult = await klevbyFeedSupabaseRejectTimeout(
        db
          .from(KLEVB_FEED_TABLE)
          .insert([payload])
          .select(klevbyFeedSupabaseGetPostSelectColumns(false))
          .single(),
        KLEVB_FEED_REST_TIMEOUT_MS,
        "Пост ленты не создался: Supabase не ответил."
      );
    }

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

    const item = klevbyFeedSupabaseApplyViewerLikeState(
      klevbyFeedSupabaseNormalizePost(insertResult.data),
      false
    );

    klevbyFeedSupabaseDispatch("created", {
      item,
      postId: item?.id || ""
    });

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

    const { error } = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_TABLE)
        .delete()
        .eq("id", cleanPostId),
      KLEVB_FEED_REST_TIMEOUT_MS,
      "Удаление поста не ответило."
    );

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

    klevbyFeedSupabaseDispatch("deleted", {
      postId: cleanPostId
    });

    return true;
  }

  async function klevbyFeedSupabaseAddLikeRest(postId, userId) {
    await klevbyFeedSupabaseRestRequest(KLEVB_FEED_LIKES_TABLE, {
      method: "POST",
      body: [{
        post_id: postId,
        user_id: userId
      }],
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return true;
  }

  async function klevbyFeedSupabaseRemoveLikeRest(postId, userId) {
    const params = new URLSearchParams();
    params.set("post_id", `eq.${postId}`);
    params.set("user_id", `eq.${userId}`);

    await klevbyFeedSupabaseRestRequest(KLEVB_FEED_LIKES_TABLE, {
      method: "DELETE",
      query: params.toString(),
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return true;
  }

  async function klevbyFeedSupabaseAddLikeSdk(db, postId, userId) {
    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const result = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_LIKES_TABLE)
        .insert([{
          post_id: postId,
          user_id: userId
        }]),
      KLEVB_FEED_REST_TIMEOUT_MS,
      "Добавление лайка не ответило."
    );

    if (result.error) {
      throw result.error;
    }

    return true;
  }

  async function klevbyFeedSupabaseRemoveLikeSdk(db, postId, userId) {
    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const result = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_LIKES_TABLE)
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId),
      KLEVB_FEED_REST_TIMEOUT_MS,
      "Удаление лайка не ответило."
    );

    if (result.error) {
      throw result.error;
    }

    return true;
  }

  async function klevbyFeedSupabaseAddLike(db, postId, userId) {
    try {
      return await klevbyFeedSupabaseAddLikeRest(postId, userId);
    } catch (restError) {
      if (klevbyFeedSupabaseIsDuplicateError(restError)) {
        return true;
      }

      console.debug("Klevby feed: REST добавление лайка пропущено, пробую SDK", restError);

      try {
        return await klevbyFeedSupabaseAddLikeSdk(db, postId, userId);
      } catch (sdkError) {
        if (klevbyFeedSupabaseIsDuplicateError(sdkError)) {
          return true;
        }

        throw sdkError;
      }
    }
  }

  async function klevbyFeedSupabaseRemoveLike(db, postId, userId) {
    try {
      return await klevbyFeedSupabaseRemoveLikeRest(postId, userId);
    } catch (restError) {
      console.debug("Klevby feed: REST удаление лайка пропущено, пробую SDK", restError);

      return klevbyFeedSupabaseRemoveLikeSdk(db, postId, userId);
    }
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

    const beforeState = await klevbyFeedSupabaseGetExactLikeState(db, cleanPostId, user.id);
    const nextLiked = !beforeState.liked;

    if (nextLiked) {
      await klevbyFeedSupabaseAddLike(db, cleanPostId, user.id);
    } else {
      await klevbyFeedSupabaseRemoveLike(db, cleanPostId, user.id);
    }

    let afterState = null;

    try {
      afterState = await klevbyFeedSupabaseGetExactLikeState(db, cleanPostId, user.id);
    } catch (afterError) {
      console.debug("Klevby feed: точное состояние лайка после записи не прочиталось", afterError);
    }

    if (!afterState) {
      afterState = {
        liked: nextLiked,
        likesCount: Math.max(0, Number(beforeState.likesCount || 0) + (nextLiked ? 1 : -1))
      };
    }

    const counters = await klevbyFeedSupabaseGetPostCounters(db, cleanPostId);

    klevbyFeedSupabaseDispatch(afterState.liked ? "like_added" : "like_removed", {
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

  async function klevbyLoadFeedCommentsRest(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return {
        ok: false,
        comments: [],
        error: new Error("Не указан id поста")
      };
    }

    const params = new URLSearchParams();
    params.set("select", KLEVB_FEED_COMMENT_SELECT);
    params.set("post_id", `eq.${cleanPostId}`);
    params.set("order", "created_at.asc");

    const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_COMMENTS_TABLE, {
      method: "GET",
      query: params.toString(),
      requireAuth: false,
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    return {
      ok: true,
      comments: Array.isArray(data) ? data : [],
      error: null
    };
  }

  async function klevbyLoadFeedCommentsSdk(postId) {
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

    const { data, error } = await klevbyFeedSupabaseRejectTimeout(
      db
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
        .order("created_at", { ascending: true }),
      KLEVB_FEED_SDK_TIMEOUT_MS,
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

  async function klevbyLoadFeedComments(postId) {
    try {
      return await klevbyLoadFeedCommentsRest(postId);
    } catch (restError) {
      console.warn("Klevby feed: REST загрузка комментариев не сработала, пробую SDK", restError);

      try {
        return await klevbyLoadFeedCommentsSdk(postId);
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

  async function klevbyAddFeedCommentRest(postId, text) {
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

    const user = await klevbyFeedSupabaseEnsureUser();
    const authContext = await klevbyFeedSupabaseGetAuthContext({
      requireAuth: true
    });

    const userId =
      user?.id ||
      authContext?.user?.id ||
      "";

    if (!userId) {
      throw new Error("Сначала войди, чтобы оставить комментарий.");
    }

    const profile = klevbyFeedSupabaseReadProfileData();

    const payload = {
      post_id: cleanPostId,
      user_id: userId,
      author_name: profile.name || "Рыбак",
      author_city: profile.city || "",
      author_telegram: klevbyFeedSupabaseCleanTelegram(profile.telegram),
      text: cleanText
    };

    const params = new URLSearchParams();
    params.set("select", KLEVB_FEED_COMMENT_SELECT);

    const data = await klevbyFeedSupabaseRestRequest(KLEVB_FEED_COMMENTS_TABLE, {
      method: "POST",
      query: params.toString(),
      body: [payload],
      requireAuth: true,
      prefer: "return=representation",
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    const row = Array.isArray(data) ? data[0] : data;

    if (!row || !row.id) {
      throw new Error("Комментарий отправился, но Supabase не вернул запись.");
    }

    const commentCounts = await klevbyFeedSupabaseLoadRealCommentCounts(
      klevbyFeedSupabaseGetClient(),
      [cleanPostId]
    );

    klevbyFeedSupabaseDispatch("comment_added", {
      postId: cleanPostId,
      comment: row,
      commentsCount: commentCounts.has(cleanPostId) ? Number(commentCounts.get(cleanPostId) || 0) : undefined
    });

    return row;
  }

  async function klevbyAddFeedCommentSdk(postId, text) {
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

    const { data, error } = await klevbyFeedSupabaseRejectTimeout(
      db
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
        .single(),
      KLEVB_FEED_SDK_TIMEOUT_MS,
      "Комментарий не отправился: Supabase не ответил."
    );

    if (error) {
      console.error("Klevby feed: ошибка добавления комментария", error);
      throw new Error("Не получилось добавить комментарий: " + error.message);
    }

    const commentCounts = await klevbyFeedSupabaseLoadRealCommentCounts(db, [cleanPostId]);

    klevbyFeedSupabaseDispatch("comment_added", {
      postId: cleanPostId,
      comment: data,
      commentsCount: commentCounts.has(cleanPostId) ? Number(commentCounts.get(cleanPostId) || 0) : undefined
    });

    return data;
  }

  async function klevbyAddFeedComment(postId, text) {
    try {
      return await klevbyAddFeedCommentRest(postId, text);
    } catch (restError) {
      console.warn("Klevby feed: REST отправка комментария не сработала, пробую SDK", restError);

      try {
        return await klevbyAddFeedCommentSdk(postId, text);
      } catch (sdkError) {
        console.error("Klevby feed: ошибка добавления комментария", sdkError);
        throw sdkError;
      }
    }
  }

  async function klevbyDeleteFeedCommentRest(commentId) {
    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const params = new URLSearchParams();
    params.set("id", `eq.${cleanCommentId}`);

    await klevbyFeedSupabaseRestRequest(KLEVB_FEED_COMMENTS_TABLE, {
      method: "DELETE",
      query: params.toString(),
      requireAuth: true,
      prefer: "return=minimal",
      timeoutMs: KLEVB_FEED_REST_TIMEOUT_MS
    });

    klevbyFeedSupabaseDispatch("comment_deleted", {
      commentId: cleanCommentId
    });

    return true;
  }

  async function klevbyDeleteFeedCommentSdk(commentId) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const cleanCommentId = String(commentId || "").trim();

    if (!cleanCommentId) {
      throw new Error("Не указан id комментария.");
    }

    const { error } = await klevbyFeedSupabaseRejectTimeout(
      db
        .from(KLEVB_FEED_COMMENTS_TABLE)
        .delete()
        .eq("id", cleanCommentId),
      KLEVB_FEED_SDK_TIMEOUT_MS,
      "Комментарий не удалился: Supabase не ответил."
    );

    if (error) {
      console.error("Klevby feed: ошибка удаления комментария", error);
      throw new Error("Не получилось удалить комментарий: " + error.message);
    }

    klevbyFeedSupabaseDispatch("comment_deleted", {
      commentId: cleanCommentId
    });

    return true;
  }

  async function klevbyDeleteFeedComment(commentId) {
    try {
      return await klevbyDeleteFeedCommentRest(commentId);
    } catch (restError) {
      console.warn("Klevby feed: REST удаление комментария не сработало, пробую SDK", restError);

      return klevbyDeleteFeedCommentSdk(commentId);
    }
  }

  async function klevbyRegisterFeedView(postId) {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      return false;
    }

    return false;
  }

  function klevbySubscribeToFeedChanges(callback) {
    const db = klevbyFeedSupabaseGetClient();

    if (!db || typeof db.channel !== "function") {
      return null;
    }

    klevbyFeedRealtimeCallback = typeof callback === "function" ? callback : null;

    if (klevbyFeedRealtimeChannel) {
      return klevbyFeedRealtimeChannel;
    }

    try {
      klevbyFeedRealtimeChannel = db
        .channel("klevby-feed-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: KLEVB_FEED_TABLE
          },
          (payload) => {
            klevbyFeedSupabaseDispatch("feed_post_changed", {
              payload,
              postId: payload?.new?.id || payload?.old?.id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: KLEVB_FEED_LIKES_TABLE
          },
          (payload) => {
            klevbyFeedSupabaseDispatch("feed_like_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: KLEVB_FEED_COMMENTS_TABLE
          },
          (payload) => {
            klevbyFeedSupabaseDispatch("feed_comment_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: KLEVB_FEED_VIEWS_TABLE
          },
          (payload) => {
            klevbyFeedSupabaseDispatch("feed_view_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Klevby feed: realtime подключён");
          }

          if (status === "CHANNEL_ERROR") {
            console.warn("Klevby feed: realtime канал вернул ошибку");
          }
        });

      return klevbyFeedRealtimeChannel;
    } catch (error) {
      console.warn("Klevby feed: realtime не подключился", error);
      klevbyFeedRealtimeChannel = null;
      return null;
    }
  }

  async function klevbyUnsubscribeFromFeedChanges() {
    const db = klevbyFeedSupabaseGetClient();

    if (!db || !klevbyFeedRealtimeChannel) {
      klevbyFeedRealtimeChannel = null;
      klevbyFeedRealtimeCallback = null;
      return;
    }

    try {
      await db.removeChannel(klevbyFeedRealtimeChannel);
    } catch (error) {
      console.warn("Klevby feed: не удалось отключить realtime", error);
    }

    klevbyFeedRealtimeChannel = null;
    klevbyFeedRealtimeCallback = null;
  }

  window.klevbyFeedSupabase = {
    loadPosts: klevbyLoadFeedPostsFromSupabase,
    createPhotoPost: klevbyCreateFeedPhotoPost,
    deletePost: klevbyDeleteFeedPostFromSupabase,
    toggleLike: klevbyToggleFeedLike,
    loadComments: klevbyLoadFeedComments,
    addComment: klevbyAddFeedComment,
    deleteComment: klevbyDeleteFeedComment,
    registerView: klevbyRegisterFeedView,
    subscribeToFeedChanges: klevbySubscribeToFeedChanges,
    subscribeToChanges: klevbySubscribeToFeedChanges,
    subscribe: klevbySubscribeToFeedChanges,
    unsubscribe: klevbyUnsubscribeFromFeedChanges
  };

  window.klevbyLoadFeedPostsFromSupabase = klevbyLoadFeedPostsFromSupabase;
  window.klevbyCreateFeedPhotoPost = klevbyCreateFeedPhotoPost;
  window.klevbyDeleteFeedPostFromSupabase = klevbyDeleteFeedPostFromSupabase;
  window.klevbyToggleFeedLike = klevbyToggleFeedLike;
  window.klevbyLoadFeedComments = klevbyLoadFeedComments;
  window.klevbyAddFeedComment = klevbyAddFeedComment;
  window.klevbyDeleteFeedComment = klevbyDeleteFeedComment;
  window.klevbyRegisterFeedView = klevbyRegisterFeedView;
  window.klevbySubscribeToFeedChanges = klevbySubscribeToFeedChanges;
  window.klevbyUnsubscribeFromFeedChanges = klevbyUnsubscribeFromFeedChanges;
})();
