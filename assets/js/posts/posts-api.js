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

  const POSTS_LOAD_RETRY_DELAY_MS = 900;
  const POSTS_MAX_RETRIES = 3;
  const POSTS_LOAD_TIMEOUT_MS = 9000;
  const POSTS_REALTIME_RELOAD_DEBOUNCE_MS = 350;
  const POSTS_REALTIME_CHANNEL_NAME = "klevby-posts-live";
  const POSTS_REALTIME_OWNER = "posts";
  const POSTS_REALTIME_PURPOSE = "trips-realtime";
  const POSTS_AUTO_SYNC_INTERVAL_MS = 12000;
  let postsRealtimeChannel = null;
  let postsRealtimeReloadTimer = null;
  let postsAutoSyncTimer = null;

  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getUtils() {
    return window.KlevbyPostsUtils || {};
  }

  function getPostsArray() {
    const state = getState();

    if (typeof state.getPostsArray === "function") {
      return state.getPostsArray();
    }

    if (Array.isArray(window.posts)) return window.posts;
    if (Array.isArray(window.klevbyPosts)) return window.klevbyPosts;

    return [];
  }

  function setPostsArray(value) {
    const state = getState();

    if (typeof state.setPostsArray === "function") {
      state.setPostsArray(value);
      return;
    }

    const safePosts = Array.isArray(value) ? value : [];
    window.posts = safePosts;
    window.klevbyPosts = safePosts;
  }

  function getPostsLoadPromise() {
    const state = getState();

    if (typeof state.getPostsLoadPromise === "function") {
      return state.getPostsLoadPromise();
    }

    return null;
  }

  function setPostsLoadPromise(value) {
    const state = getState();

    if (typeof state.setPostsLoadPromise === "function") {
      state.setPostsLoadPromise(value);
    }
  }

  function getPostsLoadRetryTimer() {
    const state = getState();

    if (typeof state.getPostsLoadRetryTimer === "function") {
      return state.getPostsLoadRetryTimer();
    }

    return null;
  }

  function setPostsLoadRetryTimer(value) {
    const state = getState();

    if (typeof state.setPostsLoadRetryTimer === "function") {
      state.setPostsLoadRetryTimer(value);
    }
  }

  function getPostsPendingForceReload() {
    const state = getState();

    if (typeof state.getPostsPendingForceReload === "function") {
      return state.getPostsPendingForceReload();
    }

    return false;
  }

  function setPostsPendingForceReload(value) {
    const state = getState();

    if (typeof state.setPostsPendingForceReload === "function") {
      state.setPostsPendingForceReload(value);
    }
  }

  function setPostsInitialLoadStarted(value) {
    const state = getState();
    if (typeof state.setPostsInitialLoadStarted === "function") {
      state.setPostsInitialLoadStarted(value);
    }
  }

  function setPostsInitialLoadDone(value) {
    const state = getState();
    if (typeof state.setPostsInitialLoadDone === "function") {
      state.setPostsInitialLoadDone(value);
    }
  }

  function isAuthLockError(error) {
    const utils = getUtils();

    if (typeof utils.isAuthLockError === "function") {
      return utils.isAuthLockError(error);
    }

    const message = String(error?.message || error || "").toLowerCase();

    return (
      message.includes("lock") &&
      message.includes("auth-token")
    );
  }

  function isPostsTimeoutError(error) {
    const utils = getUtils();

    if (typeof utils.isPostsTimeoutError === "function") {
      return utils.isPostsTimeoutError(error);
    }

    return Boolean(error && error.name === "KlevbyPostsTimeoutError");
  }

  function isPostsSchemaFallbackError(error) {
    const utils = getUtils();

    if (typeof utils.isPostsSchemaFallbackError === "function") {
      return utils.isPostsSchemaFallbackError(error);
    }

    const message = String(error?.message || error || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const payload = `${message} ${details} ${hint}`;

    return (
      payload.includes("fishing_type") ||
      payload.includes("trip_date") ||
      payload.includes("schema cache") ||
      payload.includes("could not find") ||
      payload.includes("column")
    );
  }

  function showStatusSafe(message, isError = false) {
    const utils = getUtils();

    if (typeof utils.showStatusSafe === "function") {
      utils.showStatusSafe(message, isError);
      return;
    }

    const status = document.getElementById("tripsFullscreenStatusLine");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error-line", Boolean(isError));
  }

  function withPostsTimeout(promise, timeoutMs = POSTS_LOAD_TIMEOUT_MS) {
    const utils = getUtils();

    if (typeof utils.withPostsTimeout === "function") {
      return utils.withPostsTimeout(promise, timeoutMs);
    }

    let timeoutId = null;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error("Загрузка объявлений заняла слишком много времени.");
        error.name = "KlevbyPostsTimeoutError";
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  function getSupabaseClientSafe() {
    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      return supabaseClient;
    }

    return (
      window.supabaseClient ||
      window.klevbySupabase ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function getConfigSafe() {
    return window.KLEVB_CONFIG || window.klevbyConfig || {};
  }

  function getRealtimeManagerSafe() {
    const manager = window.KlevbySupabaseRealtimeManager;
    if (!manager || typeof manager !== "object") return null;
    return manager;
  }

  function getSupabaseUrlSafe() {
    const config = getConfigSafe();

    return String(
      config.SUPABASE_URL ||
      config.supabaseUrl ||
      window.KLEVB_CONFIG?.SUPABASE_URL ||
      ""
    ).replace(/\/+$/, "");
  }

  function getSupabaseAnonKeySafe() {
    const config = getConfigSafe();

    return String(
      config.SUPABASE_ANON_KEY ||
      config.supabaseAnonKey ||
      window.KLEVB_CONFIG?.SUPABASE_ANON_KEY ||
      ""
    );
  }

  function getPostsSelectQuery(includeFishingType = false, includeTripDate = true) {
    const columns = [
      "id",
      "created_at",
      "name",
      "city",
      "destination",
      "trip_time"
    ];

    if (includeTripDate) {
      columns.push("trip_date");
    }

    columns.push(
      "transport",
      "seats",
      "text",
      "telegram",
      "owner_id",
      "crew_full"
    );

    if (includeFishingType) {
      columns.push("fishing_type");
    }

    return columns.join(",");
  }



  function isTripsSectionActive() {
    const tripsSection = document.getElementById("tripsSection");
    return Boolean(tripsSection && !tripsSection.classList.contains("hidden"));
  }

  function isDocumentVisible() {
    return typeof document === "undefined" || document.visibilityState === "visible";
  }

  function canRunPostsAutoSync() {
    return isTripsSectionActive() && isDocumentVisible();
  }

  function getPostSyncFingerprint(post) {
    if (!post || typeof post !== "object") return "";

    return [
      post.id,
      post.created_at,
      post.updated_at,
      post.owner_id,
      post.name,
      post.city,
      post.destination,
      post.trip_time,
      post.trip_date,
      post.transport,
      post.seats,
      post.text,
      post.telegram,
      post.crew_full,
      post.fishing_type
    ].map((value) => String(value ?? "")).join("|");
  }

  function arePostsListsEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
      if (getPostSyncFingerprint(left[index]) !== getPostSyncFingerprint(right[index])) {
        return false;
      }
    }

    return true;
  }

  function ensureModalPostExists(postsList) {
    const activeModalPost = typeof getActiveModalPost === "function"
      ? getActiveModalPost()
      : (window.klevbyActiveModalPost || null);

    if (!activeModalPost || !activeModalPost.id) return;

    const exists = Array.isArray(postsList)
      && postsList.some((item) => String(item?.id) === String(activeModalPost.id));

    if (exists) return;

    if (typeof window.closePostModal === "function") {
      window.closePostModal();
    }
  }

  function clearPostsAutoSyncTimer() {
    if (!postsAutoSyncTimer) return;

    clearInterval(postsAutoSyncTimer);
    postsAutoSyncTimer = null;
  }

  function runPostsAutoSync(reason = "auto_sync") {
    if (!canRunPostsAutoSync()) return;

    loadPosts({ force: true, silent: true, reason }).catch((error) => {
      console.warn("Klevby posts auto-sync: background reload failed", {
        reason,
        error: String(error?.message || error)
      });
    });
  }

  function ensurePostsAutoSyncTimer() {
    if (postsAutoSyncTimer || !canRunPostsAutoSync()) return;

    postsAutoSyncTimer = setInterval(() => {
      runPostsAutoSync("interval");
    }, POSTS_AUTO_SYNC_INTERVAL_MS);
  }

  function refreshPostsAutoSyncState(reason = "state") {
    if (!canRunPostsAutoSync()) {
      clearPostsAutoSyncTimer();
      return;
    }

    ensurePostsAutoSyncTimer();

    if (reason !== "interval" && reason !== "section_guard") {
      runPostsAutoSync(reason);
    }
  }

  function buildPostsRestQuery(includeFishingType = true, includeTripDate = true) {
    const params = new URLSearchParams();

    params.set("select", getPostsSelectQuery(includeFishingType, includeTripDate));
    params.set("order", "created_at.desc");

    return params.toString();
  }

  function schedulePostsLoad(delay = POSTS_LOAD_RETRY_DELAY_MS) {
    clearTimeout(getPostsLoadRetryTimer());

    const timer = setTimeout(() => {
      loadPosts({ force: true }).catch((error) => {
        console.warn("Klevby posts: отложенная загрузка не удалась:", error);
      });
    }, delay);

    setPostsLoadRetryTimer(timer);
  }

  function clearPostsRealtimeReloadTimer() {
    if (postsRealtimeReloadTimer) {
      clearTimeout(postsRealtimeReloadTimer);
      postsRealtimeReloadTimer = null;
    }
  }

  function schedulePostsRealtimeReload(reason = "realtime_change") {
    clearPostsRealtimeReloadTimer();

    postsRealtimeReloadTimer = setTimeout(() => {
      loadPosts({ force: true }).catch((error) => {
        console.warn("Klevby posts realtime: background reload failed", {
          reason,
          error: String(error?.message || error)
        });
      });
    }, POSTS_REALTIME_RELOAD_DEBOUNCE_MS);
  }

  async function removePostsRealtimeChannel() {
    if (!postsRealtimeChannel) return;

    const db = getSupabaseClientSafe();
    const realtimeManager = getRealtimeManagerSafe();
    const channel = postsRealtimeChannel;
    postsRealtimeChannel = null;

    try {
      if (db && typeof db.removeChannel === "function") {
        await db.removeChannel(channel);
      } else if (typeof channel.unsubscribe === "function") {
        channel.unsubscribe();
      }
    } catch (error) {
      console.warn("Klevby posts realtime: removeChannel failed", error);
    } finally {
      if (realtimeManager && typeof realtimeManager.unregisterChannel === "function") {
        realtimeManager.unregisterChannel(
          POSTS_REALTIME_OWNER,
          POSTS_REALTIME_CHANNEL_NAME,
          POSTS_REALTIME_PURPOSE
        );
      }
    }
  }

  async function ensurePostsRealtimeSync() {
    const db = getSupabaseClientSafe();
    const realtimeManager = getRealtimeManagerSafe();
    if (!db || typeof db.channel !== "function") return;

    await removePostsRealtimeChannel();

    postsRealtimeChannel = db
      .channel(POSTS_REALTIME_CHANNEL_NAME)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "posts"
      }, (payload) => {
        schedulePostsRealtimeReload(payload?.eventType || "posts_changed");
      });

    postsRealtimeChannel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
      }
    });

    if (realtimeManager && typeof realtimeManager.registerChannel === "function") {
      realtimeManager.registerChannel({
        owner: POSTS_REALTIME_OWNER,
        channelName: POSTS_REALTIME_CHANNEL_NAME,
        purpose: POSTS_REALTIME_PURPOSE,
        channel: postsRealtimeChannel,
        allowReplace: true
      });
    }
  }

  async function queryPostsViaRest(includeFishingType = true, includeTripDate = true) {
    const supabaseUrl = getSupabaseUrlSafe();
    const anonKey = getSupabaseAnonKeySafe();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase config недоступен для REST-загрузки posts.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POSTS_LOAD_TIMEOUT_MS);

    try {
      const url = `${supabaseUrl}/rest/v1/posts?${buildPostsRestQuery(includeFishingType, includeTripDate)}`;

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        }
      });

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

      if (!text) return [];

      const data = JSON.parse(text);

      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("REST-загрузка posts не ответила.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function queryPostsRestSafe() {
    try {
      const data = await queryPostsViaRest(true, true);

      return {
        data,
        error: null,
        source: "rest"
      };
    } catch (error) {
      if (!isPostsSchemaFallbackError(error)) {
        throw error;
      }

      console.debug("Klevby posts: REST select с расширенными полями не сработал, пробую безопасные fallback-варианты", error);

      const fallbackAttempts = [
        {
          includeFishingType: false,
          includeTripDate: true,
          source: "rest_no_fishing_type"
        },
        {
          includeFishingType: true,
          includeTripDate: false,
          source: "rest_no_trip_date"
        },
        {
          includeFishingType: false,
          includeTripDate: false,
          source: "rest_basic"
        }
      ];

      let lastError = error;

      for (const attempt of fallbackAttempts) {
        try {
          const data = await queryPostsViaRest(attempt.includeFishingType, attempt.includeTripDate);

          return {
            data,
            error: null,
            source: attempt.source
          };
        } catch (fallbackError) {
          lastError = fallbackError;

          if (!isPostsSchemaFallbackError(fallbackError)) {
            throw fallbackError;
          }

          console.debug("Klevby posts: REST fallback не сработал, пробую следующий", {
            source: attempt.source,
            error: String(fallbackError?.message || fallbackError)
          });
        }
      }

      throw lastError;
    }
  }

  async function queryPostsSdkSafe(db, retry = 0) {
    if (!db) {
      throw new Error("Supabase SDK client недоступен для загрузки posts.");
    }

    try {
      const attempts = [
        {
          includeFishingType: true,
          includeTripDate: true,
          source: "sdk"
        },
        {
          includeFishingType: false,
          includeTripDate: true,
          source: "sdk_no_fishing_type"
        },
        {
          includeFishingType: true,
          includeTripDate: false,
          source: "sdk_no_trip_date"
        },
        {
          includeFishingType: false,
          includeTripDate: false,
          source: "sdk_basic"
        }
      ];

      let lastResult = null;

      for (const attempt of attempts) {
        const result = await db
          .from("posts")
          .select(getPostsSelectQuery(attempt.includeFishingType, attempt.includeTripDate))
          .order("created_at", { ascending: false });

        if (!result.error) {
          return {
            ...(result || {}),
            source: attempt.source
          };
        }

        lastResult = result;

        if (!isPostsSchemaFallbackError(result.error)) {
          return {
            ...(result || {}),
            source: attempt.source
          };
        }

        console.debug("Klevby posts: SDK select fallback", {
          source: attempt.source,
          error: String(result.error?.message || result.error)
        });
      }

      return {
        ...(lastResult || {}),
        source: "sdk_failed"
      };
    } catch (error) {
      if (isAuthLockError(error) && retry < POSTS_MAX_RETRIES) {
        console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", error);

        await new Promise((resolve) => {
          setTimeout(resolve, POSTS_LOAD_RETRY_DELAY_MS);
        });

        return queryPostsSdkSafe(db, retry + 1);
      }

      throw error;
    }
  }

  async function queryPostsSafe(db, retry = 0) {
    let restError = null;

    try {
      const restResult = await queryPostsRestSafe();

      console.info("Klevby posts: объявления загружены через REST-first", {
        count: Array.isArray(restResult.data) ? restResult.data.length : 0,
        source: restResult.source || "rest"
      });

      return restResult;
    } catch (error) {
      restError = error;

      console.warn("Klevby posts: REST-first загрузка не сработала, пробую SDK fallback", {
        error: String(error?.message || error)
      });
    }

    if (!db) {
      throw restError || new Error("Supabase недоступен для загрузки posts.");
    }

    const sdkResult = await queryPostsSdkSafe(db, retry);

    console.info("Klevby posts: объявления загружены через SDK fallback", {
      count: Array.isArray(sdkResult.data) ? sdkResult.data.length : 0,
      source: sdkResult.source || "sdk"
    });

    return sdkResult;
  }

  async function loadPosts(options = {}) {
    const force = Boolean(options.force);
    const retry = Number(options.retry || 0);
    const silent = Boolean(options.silent);

    const tripsFullscreenPostsSection = document.getElementById("tripsFullscreenPostsSection");
    const existingPosts = getPostsArray();
    const activePostsLoadPromise = getPostsLoadPromise();

    if (activePostsLoadPromise) {
      if (force) {
        setPostsPendingForceReload(true);
      }

      return activePostsLoadPromise;
    }

    setPostsPendingForceReload(false);

    const nextPostsLoadPromise = (async function () {
      setPostsInitialLoadStarted(true);
      setPostsInitialLoadDone(false);

      if (!silent) {
        showStatusSafe("Загрузка объявлений...");
      }

      if (!silent && tripsFullscreenPostsSection && !existingPosts.length) {
        tripsFullscreenPostsSection.innerHTML = `
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        `;
      }

      const db = getSupabaseClientSafe();
      const canUseRest = Boolean(getSupabaseUrlSafe() && getSupabaseAnonKeySafe());

      if (!db && !canUseRest) {
        if (!silent) {
          showStatusSafe("Supabase ещё не готов. Повторяем загрузку объявлений...");
        }

        if (!silent && tripsFullscreenPostsSection && !existingPosts.length) {
          tripsFullscreenPostsSection.innerHTML = '<div class="info-line">Supabase ещё не готов. Повторяем загрузку...</div>';
        }

        schedulePostsLoad(900);
        setPostsInitialLoadDone(true);
        return;
      }

      let result;

      try {
        result = await withPostsTimeout(queryPostsSafe(db, retry), POSTS_LOAD_TIMEOUT_MS);
      } catch (error) {
        if (isPostsTimeoutError(error) && retry < POSTS_MAX_RETRIES) {
          console.warn("Klevby posts: загрузка объявлений зависла, повторяем:", error);
          if (!silent) {
            showStatusSafe("Загрузка объявлений заняла слишком много времени. Повторяем...");
          }

          if (!silent && tripsFullscreenPostsSection && !existingPosts.length) {
            tripsFullscreenPostsSection.innerHTML = `
              <div class="info-line">
                Загрузка объявлений заняла слишком много времени. Повторяем...
              </div>
            `;
          }

          schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
          setPostsInitialLoadDone(true);
          return;
        }

        if (isAuthLockError(error) && retry < POSTS_MAX_RETRIES) {
          console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", error);
          if (!silent) {
            showStatusSafe("Supabase занят, повторяем загрузку объявлений...");
          }
          schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
          setPostsInitialLoadDone(true);
          return;
        }

        console.error("Ошибка загрузки posts:", error);

        const message = error?.message
          ? "Не удалось загрузить объявления: " + error.message
          : "Не удалось загрузить объявления. Проверь таблицу posts и RLS.";

        if (!silent) {
          showStatusSafe(message, true);
        }

        if (!silent && tripsFullscreenPostsSection && !existingPosts.length) {
          tripsFullscreenPostsSection.innerHTML = `
            <div class="info-line error-line">
              Не удалось загрузить объявления. Открой Console и посмотри ошибку posts.
            </div>
          `;
        }
        setPostsInitialLoadDone(true);
        return;
      }

      if (result.error) {
        if (isAuthLockError(result.error) && retry < POSTS_MAX_RETRIES) {
          console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", result.error);
          if (!silent) {
            showStatusSafe("Supabase занят, повторяем загрузку объявлений...");
          }
          schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
          setPostsInitialLoadDone(true);
          return;
        }

        console.error("Ошибка загрузки posts:", result.error);

        const message = result.error.message
          ? "Не удалось загрузить объявления: " + result.error.message
          : "Не удалось загрузить объявления. Проверь таблицу posts и RLS.";

        if (!silent) {
          showStatusSafe(message, true);
        }

        if (!silent && tripsFullscreenPostsSection && !existingPosts.length) {
          tripsFullscreenPostsSection.innerHTML = `
            <div class="info-line error-line">
              Не удалось загрузить объявления. Открой Console и посмотри ошибку posts.
            </div>
          `;
        }
        setPostsInitialLoadDone(true);
        return;
      }

      const loadedPosts = Array.isArray(result.data) ? result.data : [];
      const postsChanged = !arePostsListsEqual(existingPosts, loadedPosts);

      console.info("Klevby posts: render loaded posts", {
        count: loadedPosts.length,
        source: result.source || "unknown",
        silent,
        postsChanged
      });

      if (silent && !postsChanged) {
        setPostsInitialLoadDone(true);
        return;
      }

      setPostsArray(loadedPosts);
      ensureModalPostExists(loadedPosts);
      setPostsInitialLoadDone(true);

      if (typeof window.renderPosts === "function") {
        window.renderPosts();
      }
    })();

    setPostsLoadPromise(nextPostsLoadPromise);

    try {
      return await nextPostsLoadPromise;
    } finally {
      setPostsLoadPromise(null);

      if (getPostsPendingForceReload()) {
        setPostsPendingForceReload(false);
        schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
      }
    }
  }

  window.KlevbyPostsApi = {
    getSupabaseClientSafe,
    getConfigSafe,
    getSupabaseUrlSafe,
    getSupabaseAnonKeySafe,
    getPostsSelectQuery,
    buildPostsRestQuery,
    schedulePostsLoad,
    queryPostsViaRest,
    queryPostsRestSafe,
    queryPostsSdkSafe,
    queryPostsSafe,
    loadPosts,
    ensurePostsRealtimeSync,
    removePostsRealtimeChannel
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensurePostsRealtimeSync().catch((error) => {
        console.warn("Klevby posts realtime: init failed on DOMContentLoaded", error);
      });
    }, { once: true });
  } else {
    ensurePostsRealtimeSync().catch((error) => {
      console.warn("Klevby posts realtime: init failed", error);
    });
  }

  function handlePostsResume(trigger, { ensureRealtime = false, details = {} } = {}) {
    markKlevbyResumeDebug("posts.resume.listener", trigger, details);

    if (ensureRealtime) {
      ensurePostsRealtimeSync().catch((error) => {
        console.warn(`Klevby posts realtime: re-init on ${trigger} failed`, error);
      });
    }

    refreshPostsAutoSyncState(trigger);
  }

  window.addEventListener("klevby-app-resumed", () => {
    handlePostsResume("klevby-app-resumed", {
      ensureRealtime: true,
      details: { trigger: "klevby-app-resumed" }
    });
  });

  window.setInterval(() => {
    refreshPostsAutoSyncState("section_guard");
  }, 1000);

  console.log("Klevby posts api loaded", {
    version: "20260515-posts-api-trip-date-1"
  });
})();
