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

  function isDeleteRestFallbackError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();
    const payload = `${name} ${message}`;

    return (
      payload.includes("timeout") ||
      payload.includes("не ответило") ||
      payload.includes("timed out") ||
      payload.includes("network") ||
      payload.includes("fetch") ||
      payload.includes("websocket") ||
      payload.includes("closed") ||
      payload.includes("connection") ||
      payload.includes("supabase") ||
      payload.includes("failed")
    );
  }

  function isCreateRestFallbackError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();
    const payload = `${name} ${message}`;

    return (
      payload.includes("timeout") ||
      payload.includes("не ответил") ||
      payload.includes("не ответило") ||
      payload.includes("timed out") ||
      payload.includes("network") ||
      payload.includes("fetch") ||
      payload.includes("websocket") ||
      payload.includes("closed") ||
      payload.includes("connection") ||
      payload.includes("supabase") ||
      payload.includes("failed") ||
      payload.includes("load failed")
    );
  }

  function isObjectAlreadyExistsError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);

    return (
      status === 409 ||
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("resource already exists")
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

  function buildDeletePostRestQuery(postId) {
    const cleanPostId = String(postId || "").trim();

    return `id=eq.${encodeURIComponent(cleanPostId)}`;
  }

  function buildInsertPostRestQuery(includeAvatar = true) {
    const params = new URLSearchParams();
    params.set("select", getPostSelectColumns(includeAvatar));
    return params.toString();
  }

  function buildFindPostByImagePathRestQuery(imagePath, includeAvatar = true) {
    const params = new URLSearchParams();
    params.set("select", getPostSelectColumns(includeAvatar));
    params.set("image_path", `eq.${String(imagePath || "").trim()}`);
    params.set("limit", "1");
    return params.toString();
  }

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function getConfig() {
    if (Core && typeof Core.getConfig === "function") {
      try {
        return Core.getConfig() || {};
      } catch (error) {
        console.warn("Klevby feed: Core.getConfig не сработал", error);
      }
    }

    return window.KLEVB_CONFIG || window.klevbyConfig || {};
  }

  function getSupabaseUrl() {
    const config = getConfig();
    return String(
      config.supabaseUrl ||
      config.SUPABASE_URL ||
      window.KLEVB_CONFIG?.SUPABASE_URL ||
      ""
    ).replace(/\/+$/, "");
  }

  function getSupabaseAnonKey() {
    const config = getConfig();
    return String(
      config.supabaseAnonKey ||
      config.SUPABASE_ANON_KEY ||
      window.KLEVB_CONFIG?.SUPABASE_ANON_KEY ||
      ""
    );
  }

  function getSupabaseStorageKeys() {
    const config = getConfig();
    const explicitKeys = [
      config.supabaseStorageKey,
      config.SUPABASE_STORAGE_KEY,
      window.KLEVB_CONFIG?.SUPABASE_STORAGE_KEY,
      "sb-klevby-auth-token"
    ].filter(Boolean);

    try {
      const detectedKeys = Object.keys(localStorage || {})
        .filter((key) => /^sb-.*-auth-token$/i.test(key));

      return Array.from(new Set([...explicitKeys, ...detectedKeys]));
    } catch (error) {
      return Array.from(new Set(explicitKeys));
    }
  }

  function normalizeStoredSession(parsed) {
    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.currentSession?.access_token) {
      return parsed.currentSession;
    }

    if (parsed.session?.access_token) {
      return parsed.session;
    }

    if (parsed.access_token) {
      return parsed;
    }

    return null;
  }

  function readStoredSupabaseSession() {
    const keys = getSupabaseStorageKeys();

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const session = normalizeStoredSession(parsed);

        if (session?.access_token) {
          return session;
        }
      } catch (error) {
        // silently skip broken storage keys
      }
    }

    return null;
  }

  function getStoredAccessToken() {
    const session = readStoredSupabaseSession();
    return String(session?.access_token || "");
  }

  function getStoredUser() {
    const session = readStoredSupabaseSession();
    return session?.user || null;
  }

  async function getAuthContextSafe(requireAuth = false) {
    let token = "";
    let user = null;

    if (Auth && typeof Auth.getAuthContext === "function") {
      try {
        const context = await Core.rejectTimeout(
          Promise.resolve(Auth.getAuthContext(requireAuth)),
          3500,
          "Supabase auth context не ответил."
        );

        token = String(
          context?.accessToken ||
          context?.access_token ||
          context?.token ||
          context?.session?.access_token ||
          ""
        );

        user = context?.user || context?.session?.user || null;
      } catch (error) {
        console.debug("Klevby feed: Auth.getAuthContext не сработал, пробую fallback", error);
      }
    }

    if (!token) {
      const db = Core.getClient ? Core.getClient() : null;

      if (db?.auth && typeof db.auth.getSession === "function") {
        try {
          const { data, error } = await Core.rejectTimeout(
            db.auth.getSession(),
            3500,
            "Supabase getSession не ответил."
          );

          if (!error && data?.session?.access_token) {
            token = String(data.session.access_token || "");
            user = data.session.user || user;
          }
        } catch (error) {
          console.debug("Klevby feed: auth.getSession не сработал, читаю localStorage", error);
        }
      }
    }

    if (!token) {
      token = getStoredAccessToken();
    }

    if (!user) {
      user = getStoredUser();
    }

    if (requireAuth && !token) {
      throw new Error("Нет активной сессии Supabase.");
    }

    return {
      token,
      user
    };
  }

  async function directSupabaseRequest(path, options = {}) {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase config недоступен для REST-запроса.");
    }

    const cleanPath = String(path || "").startsWith("/")
      ? String(path || "")
      : `/${String(path || "")}`;

    const query = options.query ? `?${String(options.query).replace(/^\?/, "")}` : "";
    const url = `${supabaseUrl}${cleanPath}${query}`;
    const method = String(options.method || "GET").toUpperCase();
    const timeoutMs = Number(options.timeoutMs || Core.REST_TIMEOUT_MS || 9000);
    const requireAuth = options.requireAuth !== false;
    const authContext = await getAuthContextSafe(requireAuth);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      apikey: anonKey,
      ...(options.headers || {})
    };

    if (authContext.token) {
      headers.Authorization = `Bearer ${authContext.token}`;
    } else if (requireAuth) {
      clearTimeout(timer);
      throw new Error("Нет токена Supabase для REST-запроса.");
    }

    const fetchOptions = {
      method,
      headers,
      signal: controller.signal
    };

    if (options.body !== undefined) {
      if (
        options.body instanceof Blob ||
        options.body instanceof FormData ||
        typeof options.body === "string"
      ) {
        fetchOptions.body = options.body;
      } else {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();

      if (!response.ok) {
        let payload = null;

        try {
          payload = text ? JSON.parse(text) : null;
        } catch (error) {
          payload = null;
        }

        const error = new Error(
          payload?.message ||
          payload?.error ||
          text ||
          `${response.status} ${response.statusText}`
        );

        error.status = response.status;
        error.statusText = response.statusText;
        error.details = payload?.details || "";
        error.hint = payload?.hint || "";
        error.payload = payload;
        throw error;
      }

      if (options.parseJson === false) {
        return text || null;
      }

      if (!text) return null;

      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("REST-запрос Supabase не ответил.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function restTableRequestDirect(table, options = {}) {
    return directSupabaseRequest(`/rest/v1/${String(table || "")}`, options);
  }

  function getPublicStorageUrl(db, bucket, path) {
    const cleanBucket = String(bucket || "").trim();
    const cleanPath = String(path || "").trim();

    if (!cleanBucket || !cleanPath) return "";

    try {
      const publicUrlResult = db?.storage
        ?.from(cleanBucket)
        ?.getPublicUrl(cleanPath);

      const publicUrl = publicUrlResult?.data?.publicUrl || "";

      if (publicUrl) return publicUrl;
    } catch (error) {
      // fallback below
    }

    const supabaseUrl = getSupabaseUrl();

    if (!supabaseUrl) return "";

    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(cleanBucket)}/${encodeStoragePath(cleanPath)}`;
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

  async function ensureFeedUserForCreate() {
    if (Auth && typeof Auth.ensureUser === "function") {
      try {
        const user = await Core.rejectTimeout(
          Promise.resolve(Auth.ensureUser()),
          4500,
          "Пользователь Supabase не ответил."
        );

        if (user?.id) return user;
      } catch (error) {
        console.warn("Klevby feed: Auth.ensureUser не ответил, пробую session fallback", error);
      }
    }

    const authContext = await getAuthContextSafe(true);

    if (authContext.user?.id) {
      return authContext.user;
    }

    throw new Error("Сначала войди или создай профиль, чтобы фото было видно в общей ленте.");
  }

  function isPublicUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
  }

  async function loadAuthorAvatarUrlFromProfiles(userId) {
    const cleanUserId = String(userId || "").trim();

    if (!cleanUserId) return "";

    const params = new URLSearchParams();
    params.set("select", "avatar_url");
    params.set("id", `eq.${cleanUserId}`);
    params.set("limit", "1");

    try {
      const data = await restTableRequestDirect("profiles", {
        method: "GET",
        query: params.toString(),
        requireAuth: true,
        timeoutMs: 3500
      });

      const row = Array.isArray(data) ? data[0] : data;
      const avatarUrl = String(row?.avatar_url || "").trim();

      return isPublicUrl(avatarUrl) ? avatarUrl : "";
    } catch (error) {
      console.debug("Klevby feed: avatar_url из profiles не подтянулся для поста", error);
      return "";
    }
  }

  async function resolveAuthorAvatarUrl(user, profile = {}) {
    const directUrl = String(
      profile.author_avatar_url ||
      profile.avatar_url ||
      profile.avatarUrl ||
      profile.avatar ||
      ""
    ).trim();

    if (isPublicUrl(directUrl)) {
      return directUrl;
    }

    return loadAuthorAvatarUrlFromProfiles(user?.id || "");
  }

  async function recoverSupabaseClient(reason = "", source = "feed") {
    const recover =
      typeof window.recoverSupabaseClient === "function"
        ? window.recoverSupabaseClient
        : typeof window.klevbyRecoverSupabaseClient === "function"
          ? window.klevbyRecoverSupabaseClient
          : null;

    if (!recover) return false;

    try {
      console.info("Klevby feed: пробую восстановить Supabase", {
        reason: String(reason || ""),
        source
      });

      await Core.rejectTimeout(
        Promise.resolve(recover({
          reason: source,
          source: "supabase-posts"
        })),
        3500,
        "Supabase recover не ответил."
      );

      return true;
    } catch (error) {
      console.warn("Klevby feed: recover Supabase не сработал", error);
      return false;
    }
  }

  async function uploadFeedStorageViaSdk(db, imagePath, blob) {
    if (!db?.storage) {
      throw new Error("Supabase Storage SDK недоступен.");
    }

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

    if (uploadResult?.error) {
      throw uploadResult.error;
    }

    return {
      path: imagePath,
      source: "sdk_storage"
    };
  }

  async function uploadFeedStorageViaRest(imagePath, blob) {
    const cleanBucket = String(Core.BUCKET || "").trim();
    const cleanPath = String(imagePath || "").trim();

    if (!cleanBucket || !cleanPath) {
      throw new Error("Не указан bucket/path для загрузки фото.");
    }

    await directSupabaseRequest(
      `/storage/v1/object/${encodeURIComponent(cleanBucket)}/${encodeStoragePath(cleanPath)}`,
      {
        method: "POST",
        requireAuth: true,
        timeoutMs: Core.REST_TIMEOUT_MS,
        headers: {
          "Content-Type": blob.type || "image/jpeg",
          "Cache-Control": "31536000",
          "x-upsert": "true"
        },
        body: blob,
        parseJson: false
      }
    );

    return {
      path: imagePath,
      source: "rest_storage"
    };
  }

  async function uploadFeedStorageWithFallback(db, imagePath, blob) {
    try {
      const result = await uploadFeedStorageViaSdk(db, imagePath, blob);
      const imageUrl = getPublicStorageUrl(db, Core.BUCKET, imagePath);

      console.info("Klevby feed: фото загружено в Storage через SDK", {
        imagePath
      });

      return {
        ...result,
        imageUrl
      };
    } catch (sdkError) {
      console.warn("Klevby feed: SDK upload Storage не сработал, пробую REST fallback", {
        imagePath,
        fallbackReason: String(sdkError?.message || sdkError),
        isLikelyResumeError: isCreateRestFallbackError(sdkError)
      });

      await recoverSupabaseClient(sdkError?.message || sdkError || "sdk_upload_failed", "feed_upload_fallback");

      try {
        const result = await uploadFeedStorageViaRest(imagePath, blob);
        const nextDb = Core.getClient ? Core.getClient() : db;
        const imageUrl = getPublicStorageUrl(nextDb || db, Core.BUCKET, imagePath);

        console.info("Klevby feed: фото загружено в Storage через REST fallback", {
          imagePath
        });

        return {
          ...result,
          imageUrl
        };
      } catch (restError) {
        if (isObjectAlreadyExistsError(restError)) {
          const nextDb = Core.getClient ? Core.getClient() : db;
          const imageUrl = getPublicStorageUrl(nextDb || db, Core.BUCKET, imagePath);

          console.warn("Klevby feed: Storage REST вернул duplicate, считаю файл уже загруженным", {
            imagePath
          });

          return {
            path: imagePath,
            imageUrl,
            source: "rest_storage_existing"
          };
        }

        console.error("Klevby feed: REST upload Storage не сработал", {
          imagePath,
          sdkError,
          restError
        });

        throw new Error("Фото не загрузилось в Supabase Storage: " + (restError?.message || sdkError?.message || restError));
      }
    }
  }

  async function findFeedPostByImagePathViaRest(imagePath) {
    const cleanImagePath = String(imagePath || "").trim();

    if (!cleanImagePath) return null;

    const attempts = [true, false];
    let lastError = null;

    for (const includeAvatar of attempts) {
      try {
        const data = await restTableRequestDirect(Core.TABLE, {
          method: "GET",
          query: buildFindPostByImagePathRestQuery(cleanImagePath, includeAvatar),
          requireAuth: true,
          timeoutMs: Core.REST_TIMEOUT_MS
        });

        const row = Array.isArray(data) ? data[0] : data;

        if (row?.id) {
          return row;
        }

        return null;
      } catch (error) {
        lastError = error;

        if (!isPostsRestFallbackError(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      console.debug("Klevby feed: поиск поста по image_path не сработал", lastError);
    }

    return null;
  }

  async function insertFeedPostViaSdk(db, payload) {
    if (!db) {
      throw new Error("Supabase SDK client недоступен.");
    }

    const insertPayload = {
      ...payload
    };

    let insertResult = await Core.rejectTimeout(
      db
        .from(Core.TABLE)
        .insert([insertPayload])
        .select(getPostSelectColumns(true))
        .single(),
      Core.REST_TIMEOUT_MS,
      "Пост ленты не создался: Supabase не ответил."
    );

    if (
      insertResult?.error &&
      String(insertResult.error.message || "").toLowerCase().includes("author_avatar")
    ) {
      delete insertPayload.author_avatar_url;

      insertResult = await Core.rejectTimeout(
        db
          .from(Core.TABLE)
          .insert([insertPayload])
          .select(getPostSelectColumns(false))
          .single(),
        Core.REST_TIMEOUT_MS,
        "Пост ленты не создался: Supabase не ответил."
      );
    }

    if (insertResult?.error) {
      throw insertResult.error;
    }

    return {
      data: insertResult?.data || null,
      payload: insertPayload,
      source: "sdk_insert"
    };
  }

  async function insertFeedPostViaRest(payload) {
    const attempts = [
      {
        includeAvatar: true,
        payload: { ...payload },
        source: "rest_insert"
      },
      {
        includeAvatar: false,
        payload: (() => {
          const cleanPayload = { ...payload };
          delete cleanPayload.author_avatar_url;
          return cleanPayload;
        })(),
        source: "rest_insert_no_avatar"
      }
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const data = await restTableRequestDirect(Core.TABLE, {
          method: "POST",
          query: buildInsertPostRestQuery(attempt.includeAvatar),
          requireAuth: true,
          timeoutMs: Core.REST_TIMEOUT_MS,
          headers: {
            Prefer: "return=representation"
          },
          body: attempt.payload
        });

        const row = Array.isArray(data) ? data[0] : data;

        if (!row?.id) {
          throw new Error("REST insert feed_posts не вернул созданный пост.");
        }

        return {
          data: row,
          payload: attempt.payload,
          source: attempt.source
        };
      } catch (error) {
        lastError = error;

        if (attempt.includeAvatar && isPostsRestFallbackError(error)) {
          console.debug("Klevby feed: REST insert с avatar пропущен, пробую без avatar", error);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("REST insert feed_posts не сработал.");
  }

  async function insertFeedPostWithFallback(db, payload, imagePath) {
    let restError = null;

    try {
      const result = await insertFeedPostViaRest(payload);

      console.info("Klevby feed: feed_posts создан через REST-first", {
        postId: result?.data?.id || "",
        source: result?.source || "rest_insert"
      });

      return result;
    } catch (error) {
      restError = error;

      if (isObjectAlreadyExistsError(error)) {
        try {
          const existing = await findFeedPostByImagePathViaRest(imagePath);

          if (existing?.id) {
            console.warn("Klevby feed: REST-first insert вернул duplicate, найден существующий post по image_path", {
              postId: existing.id,
              imagePath
            });

            return {
              data: existing,
              payload,
              source: "rest_existing_after_duplicate"
            };
          }
        } catch (findError) {
          console.debug("Klevby feed: после REST duplicate не удалось найти существующий post", findError);
        }
      }

      console.warn("Klevby feed: REST-first insert feed_posts не сработал, пробую SDK fallback", {
        imagePath,
        fallbackReason: String(error?.message || error),
        isLikelyResumeError: isCreateRestFallbackError(error)
      });
    }

    try {
      const existing = await findFeedPostByImagePathViaRest(imagePath);

      if (existing?.id) {
        console.warn("Klevby feed: после REST insert timeout найден уже созданный post по image_path", {
          postId: existing.id,
          imagePath
        });

        return {
          data: existing,
          payload,
          source: "rest_existing_after_rest_timeout"
        };
      }
    } catch (findError) {
      console.debug("Klevby feed: перед SDK fallback не удалось проверить существующий post", findError);
    }

    await recoverSupabaseClient(restError?.message || restError || "rest_insert_failed", "feed_insert_sdk_fallback");

    const nextDb = Core.getClient ? Core.getClient() || db : db;

    try {
      const result = await insertFeedPostViaSdk(nextDb, payload);

      console.info("Klevby feed: feed_posts создан через SDK fallback", {
        postId: result?.data?.id || ""
      });

      return result;
    } catch (sdkError) {
      try {
        const existing = await findFeedPostByImagePathViaRest(imagePath);

        if (existing?.id) {
          console.warn("Klevby feed: после SDK fallback timeout найден уже созданный post по image_path", {
            postId: existing.id,
            imagePath
          });

          return {
            data: existing,
            payload,
            source: "rest_existing_after_sdk_fallback"
          };
        }
      } catch (findError) {
        console.debug("Klevby feed: после SDK fallback не удалось проверить существующий post", findError);
      }

      if (isObjectAlreadyExistsError(sdkError)) {
        const existing = await findFeedPostByImagePathViaRest(imagePath);

        if (existing?.id) {
          return {
            data: existing,
            payload,
            source: "rest_existing_after_sdk_duplicate"
          };
        }
      }

      console.error("Klevby feed: feed_posts не создался ни через REST-first, ни через SDK fallback", {
        imagePath,
        restError,
        sdkError
      });

      throw new Error("Пост ленты не создался: " + (restError?.message || sdkError?.message || restError || sdkError));
    }
  }

  async function createFeedPhotoPost(photoData = {}) {
    let db = Core.getClient();
    const config = getConfig();

    if (!db && (!config.supabaseUrl && !config.SUPABASE_URL)) {
      throw new Error("Supabase ещё не готов. Обнови страницу.");
    }

    const user = await ensureFeedUserForCreate();

    if (!user || !user.id) {
      throw new Error("Сначала войди или создай профиль, чтобы фото было видно в общей ленте.");
    }

    const dataUrl = String(photoData.dataUrl || photoData.src || "");

    if (!dataUrl) {
      throw new Error("Фото не найдено для загрузки.");
    }

    const profile = Auth.readProfileData ? Auth.readProfileData() : {};
    const cleanTelegram = Core.cleanTelegram ? Core.cleanTelegram(profile.telegram) : String(profile.telegram || "").trim();
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

    const uploadResult = await uploadFeedStorageWithFallback(db, imagePath, blob);
    db = Core.getClient ? Core.getClient() || db : db;

    const imageUrl = uploadResult?.imageUrl || getPublicStorageUrl(db, Core.BUCKET, imagePath);

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
      author_name: profile.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Рыбак",
      author_city: profile.city || "",
      author_telegram: cleanTelegram,
      caption: caption || "Фото с рыбалки",
      image_path: imagePath,
      image_url: imageUrl,
      image_width: Number(photoData.width || 0),
      image_height: Number(photoData.height || 0),
      image_size_kb: Number(photoData.sizeKb || photoData.savedSizeKb || Math.round(blob.size / 1024) || 0)
    };

    const authorAvatarUrl = await resolveAuthorAvatarUrl(user, profile);

    if (authorAvatarUrl) {
      payload.author_avatar_url = authorAvatarUrl;
    }

    let insertResult = null;

    try {
      insertResult = await insertFeedPostWithFallback(db, payload, imagePath);
    } catch (insertError) {
      console.error("Klevby feed: запись feed_posts не создалась", insertError);

      await removeFeedStorageFileSafe(db, imagePath);

      throw insertError;
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

  async function recoverSupabaseClientBeforeDelete(reason = "") {
    return recoverSupabaseClient(reason, "feed_delete_fallback");
  }

  async function deleteFeedPostViaSdk(db, cleanPostId) {
    if (!db) {
      throw new Error("Supabase SDK client недоступен.");
    }

    const result = await Core.rejectTimeout(
      db
        .from(Core.TABLE)
        .delete()
        .eq("id", cleanPostId),
      Core.REST_TIMEOUT_MS,
      "Удаление поста не ответило."
    );

    if (result?.error) {
      throw result.error;
    }

    return true;
  }

  async function deleteFeedPostViaRest(cleanPostId) {
    if (!Rest || typeof Rest.restRequest !== "function") {
      await restTableRequestDirect(Core.TABLE, {
        method: "DELETE",
        query: buildDeletePostRestQuery(cleanPostId),
        requireAuth: true,
        timeoutMs: Core.REST_TIMEOUT_MS,
        headers: {
          Prefer: "return=minimal"
        },
        parseJson: false
      });

      return true;
    }

    await Rest.restRequest(Core.TABLE, {
      method: "DELETE",
      query: buildDeletePostRestQuery(cleanPostId),
      requireAuth: true,
      timeoutMs: Core.REST_TIMEOUT_MS,
      headers: {
        Prefer: "return=minimal"
      }
    });

    return true;
  }

  async function removeFeedStorageFileViaRest(imagePath = "") {
    const cleanImagePath = String(imagePath || "").trim();
    const cleanBucket = String(Core.BUCKET || "").trim();

    if (!cleanImagePath || !cleanBucket) return true;

    await directSupabaseRequest(`/storage/v1/object/${encodeURIComponent(cleanBucket)}`, {
      method: "DELETE",
      requireAuth: true,
      timeoutMs: Core.REST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        prefixes: [cleanImagePath]
      },
      parseJson: false
    });

    return true;
  }

  async function removeFeedStorageFileSafe(db, imagePath = "") {
    const cleanImagePath = String(imagePath || "").trim();

    if (!cleanImagePath) return true;

    if (db?.storage) {
      try {
        await Core.rejectTimeout(
          db.storage
            .from(Core.BUCKET)
            .remove([cleanImagePath]),
          Core.REST_TIMEOUT_MS,
          "Удаление файла Storage не ответило."
        );

        return true;
      } catch (storageError) {
        console.warn("Klevby feed: Storage SDK remove не сработал, пробую REST remove", storageError);
      }
    }

    try {
      await removeFeedStorageFileViaRest(cleanImagePath);
      return true;
    } catch (restStorageError) {
      const status = Number(restStorageError?.status || 0);

      if (status === 404) {
        return true;
      }

      console.warn("Klevby feed: пост удалён, но файл Storage удалить не получилось", restStorageError);
      return false;
    }
  }

  function removeFeedStorageFileInBackground(db, imagePath = "", postId = "") {
    const cleanImagePath = String(imagePath || "").trim();

    if (!cleanImagePath) return;

    setTimeout(() => {
      removeFeedStorageFileSafe(db, cleanImagePath)
        .then((ok) => {
          if (ok) {
            console.info("Klevby feed: файл Storage удалён в фоне", {
              postId: String(postId || ""),
              imagePath: cleanImagePath
            });
          }
        })
        .catch((error) => {
          console.warn("Klevby feed: фоновое удаление Storage не сработало", {
            postId: String(postId || ""),
            imagePath: cleanImagePath,
            error
          });
        });
    }, 0);
  }

  async function deleteFeedPostFromSupabase(postId, imagePath = "") {
    const cleanPostId = String(postId || "").trim();

    if (!cleanPostId) {
      throw new Error("Не указан id поста.");
    }

    let db = Core.getClient();
    let sdkError = null;
    let deleted = false;

    if (db) {
      try {
        await deleteFeedPostViaSdk(db, cleanPostId);
        deleted = true;

        console.info("Klevby feed: feed_posts удалён через SDK", {
          postId: cleanPostId
        });
      } catch (error) {
        sdkError = error;

        console.warn("Klevby feed: SDK delete feed_posts не сработал, пробую REST fallback", {
          postId: cleanPostId,
          fallbackReason: String(error?.message || error),
          isLikelyResumeError: isDeleteRestFallbackError(error)
        });
      }
    } else {
      sdkError = new Error("Supabase SDK client недоступен.");
      console.warn("Klevby feed: SDK client недоступен, пробую REST delete", {
        postId: cleanPostId
      });
    }

    if (!deleted) {
      await recoverSupabaseClientBeforeDelete(sdkError?.message || sdkError || "sdk_delete_failed");

      db = Core.getClient() || db;

      try {
        await deleteFeedPostViaRest(cleanPostId);
        deleted = true;

        console.info("Klevby feed: feed_posts удалён через REST fallback", {
          postId: cleanPostId
        });
      } catch (restError) {
        console.error("Klevby feed: ошибка удаления feed_posts", {
          postId: cleanPostId,
          sdkError,
          restError
        });

        const message =
          restError?.message ||
          sdkError?.message ||
          "Удаление поста не ответило.";

        throw new Error("Не получилось удалить пост: " + message);
      }
    }

    if (!deleted) {
      throw new Error("Не получилось удалить пост: удаление не подтвердилось.");
    }

    Core.dispatch("deleted", {
      postId: cleanPostId
    });

    removeFeedStorageFileInBackground(db, imagePath, cleanPostId);

    return true;
  }

  window.KlevbyFeedSupabasePosts = {
    getPostSelectColumns,
    isPostsRestFallbackError,
    isDeleteRestFallbackError,
    isCreateRestFallbackError,
    buildPostsRestQuery,
    buildDeletePostRestQuery,
    buildInsertPostRestQuery,
    buildFindPostByImagePathRestQuery,
    runFeedPostsRestQuery,
    runFeedPostsQuery,
    loadFeedPostsFromSupabase,
    createFeedPhotoPost,
    uploadFeedStorageViaSdk,
    uploadFeedStorageViaRest,
    insertFeedPostViaSdk,
    insertFeedPostViaRest,
    deleteFeedPostViaSdk,
    deleteFeedPostViaRest,
    removeFeedStorageFileSafe,
    removeFeedStorageFileInBackground,
    deleteFeedPostFromSupabase
  };
})();
