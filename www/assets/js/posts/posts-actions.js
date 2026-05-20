(function () {
  const POSTS_ACTIONS_VERSION = "20260515-posts-actions-rest-auth-1";
  const POSTS_ACTION_TIMEOUT_MS = 12000;

  const deletingIds = new Set();
  const togglingIds = new Set();

  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getApi() {
    return window.KlevbyPostsApi || {};
  }

  function getConfigSafe() {
    return window.KLEVB_CONFIG || window.klevbyConfig || {};
  }

  function getSupabaseUrlSafe() {
    const api = getApi();

    if (typeof api.getSupabaseUrlSafe === "function") {
      return String(api.getSupabaseUrlSafe() || "").replace(/\/+$/, "");
    }

    const config = getConfigSafe();

    return String(
      config.SUPABASE_URL ||
      config.supabaseUrl ||
      window.KLEVB_CONFIG?.SUPABASE_URL ||
      ""
    ).replace(/\/+$/, "");
  }

  function getSupabaseAnonKeySafe() {
    const api = getApi();

    if (typeof api.getSupabaseAnonKeySafe === "function") {
      return String(api.getSupabaseAnonKeySafe() || "");
    }

    const config = getConfigSafe();

    return String(
      config.SUPABASE_ANON_KEY ||
      config.supabaseAnonKey ||
      window.KLEVB_CONFIG?.SUPABASE_ANON_KEY ||
      ""
    );
  }

  function getSupabaseStorageKeySafe() {
    const config = getConfigSafe();

    return String(
      config.SUPABASE_STORAGE_KEY ||
      window.KLEVB_CONFIG?.SUPABASE_STORAGE_KEY ||
      "sb-klevby-auth-token"
    );
  }

  function getSupabaseClientSafe() {
    const api = getApi();

    if (typeof api.getSupabaseClientSafe === "function") {
      return api.getSupabaseClientSafe();
    }

    if (typeof window.getSupabaseClientSafe === "function" && window.getSupabaseClientSafe !== getSupabaseClientSafe) {
      return window.getSupabaseClientSafe();
    }

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

  function getCurrentUserSafe() {
    const state = getState();

    if (typeof state.getCurrentUserSafe === "function") {
      return state.getCurrentUserSafe();
    }

    if (typeof window.getCurrentUserSafe === "function" && window.getCurrentUserSafe !== getCurrentUserSafe) {
      return window.getCurrentUserSafe();
    }

    if (typeof currentUser !== "undefined" && currentUser) {
      return currentUser;
    }

    return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
  }

  function getCurrentAuthReady() {
    const state = getState();

    if (typeof state.getCurrentAuthReady === "function") {
      return state.getCurrentAuthReady();
    }

    if (typeof window.getCurrentAuthReady === "function" && window.getCurrentAuthReady !== getCurrentAuthReady) {
      return window.getCurrentAuthReady();
    }

    if (typeof authReady !== "undefined") {
      return authReady;
    }

    return Boolean(window.klevbyAuthReady || window.authReady);
  }

  function getPostsArray() {
    const state = getState();

    if (typeof state.getPostsArray === "function") {
      return state.getPostsArray();
    }

    if (typeof window.getPostsArray === "function" && window.getPostsArray !== getPostsArray) {
      return window.getPostsArray();
    }

    if (Array.isArray(window.posts)) return window.posts;
    if (Array.isArray(window.klevbyPosts)) return window.klevbyPosts;

    return [];
  }

  function setPostsArray(value) {
    const state = getState();
    const safePosts = Array.isArray(value) ? value : [];

    if (typeof state.setPostsArray === "function") {
      state.setPostsArray(safePosts);
      return;
    }

    if (typeof window.setPostsArray === "function" && window.setPostsArray !== setPostsArray) {
      window.setPostsArray(safePosts);
      return;
    }

    window.posts = safePosts;
    window.klevbyPosts = safePosts;
  }

  async function loadPosts(options = {}) {
    const api = getApi();

    if (typeof api.loadPosts === "function") {
      return api.loadPosts(options);
    }

    if (typeof window.loadPosts === "function" && window.loadPosts !== loadPosts) {
      return window.loadPosts(options);
    }

    return null;
  }

  function runWithTimeout(promiseFactory, label, timeoutMs = POSTS_ACTION_TIMEOUT_MS) {
    const controller =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : null;

    let timeoutId = null;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) {
          try {
            controller.abort();
          } catch (error) {
            // ignore abort errors
          }
        }

        const timeoutError = new Error(`${label} не ответил за ${timeoutMs} мс.`);
        timeoutError.name = "KlevbyPostsActionTimeoutError";
        timeoutError.isKlevbyActionTimeout = true;
        reject(timeoutError);
      }, timeoutMs);
    });

    return Promise.race([
      promiseFactory(controller ? controller.signal : null),
      timeoutPromise
    ]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  function findAccessTokenDeep(value, depth = 0) {
    if (!value || depth > 6) {
      return "";
    }

    if (typeof value === "string") {
      return "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findAccessTokenDeep(item, depth + 1);

        if (found) {
          return found;
        }
      }

      return "";
    }

    if (typeof value === "object") {
      if (typeof value.access_token === "string" && value.access_token.length > 20) {
        return value.access_token;
      }

      for (const key of Object.keys(value)) {
        const found = findAccessTokenDeep(value[key], depth + 1);

        if (found) {
          return found;
        }
      }
    }

    return "";
  }

  function getAccessTokenFromLocalStorage() {
    const keys = [
      getSupabaseStorageKeySafe(),
      "sb-klevby-auth-token"
    ];

    try {
      for (const key of keys) {
        if (!key) continue;

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const found = findAccessTokenDeep(parsed);

          if (found) {
            return found;
          }
        } catch (error) {
          // ignore parse errors
        }
      }

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;

        const lowerKey = String(key).toLowerCase();

        if (!lowerKey.includes("auth-token") && !lowerKey.includes("supabase") && !lowerKey.startsWith("sb-")) {
          continue;
        }

        const raw = localStorage.getItem(key);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const found = findAccessTokenDeep(parsed);

          if (found) {
            return found;
          }
        } catch (error) {
          // ignore parse errors
        }
      }
    } catch (error) {
      console.warn("Klevby posts actions: cannot read auth token from localStorage", {
        message: error?.message || String(error || "")
      });
    }

    return "";
  }

  async function getAccessTokenSafe() {
    const db = getSupabaseClientSafe();

    if (db?.auth && typeof db.auth.getSession === "function") {
      try {
        const sessionResult = await runWithTimeout(
          () => db.auth.getSession(),
          "Проверка авторизации",
          3500
        );

        const token = sessionResult?.data?.session?.access_token || "";

        if (token) {
          return token;
        }
      } catch (error) {
        console.warn("Klevby posts actions: getSession failed, fallback to localStorage", {
          name: error?.name || null,
          message: error?.message || String(error || "")
        });
      }
    }

    return getAccessTokenFromLocalStorage();
  }

  async function restoreAuthStateSafe(reason) {
    if (typeof window.restoreAuthState !== "function") {
      return null;
    }

    try {
      return await runWithTimeout(
        () => window.restoreAuthState(reason, false),
        "Восстановление авторизации",
        4500
      );
    } catch (error) {
      console.warn("Klevby posts actions: restoreAuthState failed", {
        reason,
        name: error?.name || null,
        message: error?.message || String(error || "")
      });

      return null;
    }
  }

  async function ensureUserForPostAction() {
    let user = getCurrentUserSafe();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function" && !getCurrentAuthReady()) {
      await restoreAuthStateSafe("before_post_action");
    }

    user = getCurrentUserSafe();

    if (user && user.id) {
      return user;
    }

    await restoreAuthStateSafe("post_action_retry");

    user = getCurrentUserSafe();

    if (user && user.id) {
      return user;
    }

    const db = getSupabaseClientSafe();

    if (db?.auth && typeof db.auth.getUser === "function") {
      try {
        const userResult = await runWithTimeout(
          () => db.auth.getUser(),
          "Проверка пользователя",
          3500
        );

        if (userResult?.data?.user?.id) {
          return userResult.data.user;
        }
      } catch (error) {
        console.warn("Klevby posts actions: getUser failed", {
          name: error?.name || null,
          message: error?.message || String(error || "")
        });
      }
    }

    return null;
  }

  async function parseRestResponse(response) {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  function buildRestError(response, payload) {
    const message =
      payload?.message ||
      payload?.error ||
      response.statusText ||
      `HTTP ${response.status}`;

    const error = new Error(message);

    error.status = response.status;
    error.statusText = response.statusText;
    error.code = payload?.code || null;
    error.details = payload?.details || "";
    error.hint = payload?.hint || "";
    error.payload = payload;

    return error;
  }

  async function updatePostViaRest(id, payload) {
    const supabaseUrl = getSupabaseUrlSafe();
    const anonKey = getSupabaseAnonKeySafe();
    const accessToken = await getAccessTokenSafe();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase config недоступен для изменения posts.");
    }

    if (!accessToken) {
      const error = new Error("Нет access token для изменения объявления.");
      error.code = "KLEVB_AUTH_TOKEN_MISSING";
      throw error;
    }

    return runWithTimeout(
      async (signal) => {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(String(id))}`,
          {
            method: "PATCH",
            signal: signal || undefined,
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal"
            },
            body: JSON.stringify(payload)
          }
        );

        const parsed = await parseRestResponse(response);

        if (!response.ok) {
          throw buildRestError(response, parsed);
        }

        return {
          data: parsed,
          error: null,
          source: "rest"
        };
      },
      "REST-изменение объявления"
    );
  }

  async function deletePostViaRest(id) {
    const supabaseUrl = getSupabaseUrlSafe();
    const anonKey = getSupabaseAnonKeySafe();
    const accessToken = await getAccessTokenSafe();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase config недоступен для удаления posts.");
    }

    if (!accessToken) {
      const error = new Error("Нет access token для удаления объявления.");
      error.code = "KLEVB_AUTH_TOKEN_MISSING";
      throw error;
    }

    return runWithTimeout(
      async (signal) => {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(String(id))}`,
          {
            method: "DELETE",
            signal: signal || undefined,
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              Prefer: "return=minimal"
            }
          }
        );

        const parsed = await parseRestResponse(response);

        if (!response.ok) {
          throw buildRestError(response, parsed);
        }

        return {
          data: parsed,
          error: null,
          source: "rest"
        };
      },
      "REST-удаление объявления"
    );
  }

  async function toggleCrewFullViaSdk(id, value) {
    const db = getSupabaseClientSafe();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const { error } = await db
      .from("posts")
      .update({ crew_full: value })
      .eq("id", id);

    if (error) {
      throw error;
    }

    return {
      error: null,
      source: "sdk"
    };
  }

  async function deletePostViaSdk(id) {
    const db = getSupabaseClientSafe();

    if (!db) {
      throw new Error("Supabase ещё не готов.");
    }

    const { error } = await db
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return {
      error: null,
      source: "sdk"
    };
  }

  function updateCrewFullLocalState(id, value) {
    const posts = getPostsArray();

    if (!posts.length) {
      return;
    }

    const nextPosts = posts.map((post) => {
      if (String(post.id) === String(id)) {
        return {
          ...post,
          crew_full: Boolean(value)
        };
      }

      return post;
    });

    setPostsArray(nextPosts);

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }
  }

  function removePostFromLocalState(id) {
    const posts = getPostsArray();

    if (!posts.length) {
      return;
    }

    const nextPosts = posts.filter((post) => String(post.id) !== String(id));

    setPostsArray(nextPosts);

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }
  }

  function reloadMapSafe() {
    if (typeof window.klevbyReloadMap !== "function") {
      return;
    }

    try {
      window.klevbyReloadMap();
    } catch (error) {
      console.warn("Klevby posts actions: map reload failed", {
        message: error?.message || String(error || "")
      });
    }
  }

  function handleActionError(error, fallbackMessage) {
    console.error("Klevby posts actions error:", error);

    if (error?.code === "KLEVB_AUTH_TOKEN_MISSING") {
      alert("Авторизация не готова. Обнови приложение или войди снова.");
      return;
    }

    if (error?.status === 401 || error?.status === 403) {
      alert("Supabase не разрешил выполнить действие. Проверь, что ты вошёл в свой аккаунт.");
      return;
    }

    if (error?.isKlevbyActionTimeout || error?.name === "AbortError") {
      alert("Действие зависло. Проверь интернет и попробуй ещё раз.");
      return;
    }

    alert(fallbackMessage);
  }

  async function toggleCrewFull(id, value) {
    const safeId = String(id || "").trim();

    if (!safeId) {
      return;
    }

    if (togglingIds.has(safeId)) {
      return;
    }

    togglingIds.add(safeId);

    try {
      await ensureUserForPostAction();

      try {
        await updatePostViaRest(safeId, {
          crew_full: Boolean(value)
        });
      } catch (restError) {
        console.warn("Klevby posts actions: REST crew_full failed, trying SDK fallback", {
          message: restError?.message || String(restError || "")
        });

        await toggleCrewFullViaSdk(safeId, Boolean(value));
      }

      updateCrewFullLocalState(safeId, Boolean(value));
      await loadPosts({ force: true });
    } catch (error) {
      handleActionError(
        error,
        "Не получилось изменить статус. Проверь поле crew_full, вход в аккаунт и RLS."
      );
    } finally {
      togglingIds.delete(safeId);
    }
  }

  async function deletePost(id) {
    const safeId = String(id || "").trim();

    if (!safeId) {
      return;
    }

    if (deletingIds.has(safeId)) {
      return;
    }

    if (!confirm("Удалить объявление? Это действие нельзя отменить.")) {
      return;
    }

    deletingIds.add(safeId);

    try {
      await ensureUserForPostAction();

      try {
        await deletePostViaRest(safeId);
      } catch (restError) {
        console.warn("Klevby posts actions: REST delete failed, trying SDK fallback", {
          message: restError?.message || String(restError || ""),
          status: restError?.status || null,
          code: restError?.code || null
        });

        await deletePostViaSdk(safeId);
      }

      removePostFromLocalState(safeId);

      await loadPosts({ force: true });

      reloadMapSafe();
    } catch (error) {
      handleActionError(
        error,
        "Не получилось удалить. Удалять может только владелец объявления или админ."
      );
    } finally {
      deletingIds.delete(safeId);
    }
  }

  window.KlevbyPostsActions = {
    toggleCrewFull,
    deletePost
  };

  console.log("Klevby posts actions loaded", {
    version: POSTS_ACTIONS_VERSION
  });
})();
