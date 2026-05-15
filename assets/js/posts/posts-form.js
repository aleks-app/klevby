(function () {
  const POSTS_FORM_VERSION = "20260515-posts-form-trip-date-required-1";
  const POSTS_SAVE_TIMEOUT_MS = 12000;
  const POSTS_RELOAD_AFTER_SAVE_DELAY_MS = 180;

  let savePostInProgress = false;

  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getUtils() {
    return window.KlevbyPostsUtils || {};
  }

  function getApi() {
    return window.KlevbyPostsApi || {};
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function debugSaveStep(step, details = {}) {
    try {
      console.debug("Klevby posts form save:", step, details);
    } catch (error) {
      // ignore debug errors
    }
  }

  function buildTimeoutError(label, timeoutMs) {
    const error = new Error(`${label} не ответил за ${timeoutMs} мс.`);
    error.name = "KlevbyPostsSaveTimeoutError";
    error.isKlevbySaveTimeout = true;
    return error;
  }

  async function runWithTimeout(promiseFactory, label, timeoutMs = POSTS_SAVE_TIMEOUT_MS) {
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

        reject(buildTimeoutError(label, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        promiseFactory(controller ? controller.signal : null),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
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

    if (Array.isArray(window.posts)) {
      return window.posts;
    }

    if (Array.isArray(window.klevbyPosts)) {
      return window.klevbyPosts;
    }

    return [];
  }

  function setPostsArray(value) {
    const state = getState();

    if (typeof state.setPostsArray === "function") {
      state.setPostsArray(Array.isArray(value) ? value : []);
      return;
    }

    const safePosts = Array.isArray(value) ? value : [];

    window.posts = safePosts;
    window.klevbyPosts = safePosts;
  }

  function upsertPostInLocalState(savedPost, activeEditingId = null) {
    if (!savedPost || !savedPost.id) {
      return;
    }

    const currentPosts = getPostsArray();
    let nextPosts = [];

    if (activeEditingId) {
      let replaced = false;

      nextPosts = currentPosts.map((post) => {
        if (String(post.id) === String(activeEditingId)) {
          replaced = true;
          return {
            ...post,
            ...savedPost
          };
        }

        return post;
      });

      if (!replaced) {
        nextPosts = [savedPost, ...nextPosts];
      }
    } else {
      nextPosts = [
        savedPost,
        ...currentPosts.filter((post) => String(post.id) !== String(savedPost.id))
      ];
    }

    setPostsArray(nextPosts);

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }
  }

  function getCurrentEditingId() {
    const state = getState();

    if (typeof state.getCurrentEditingId === "function") {
      return state.getCurrentEditingId();
    }

    if (typeof window.getCurrentEditingId === "function" && window.getCurrentEditingId !== getCurrentEditingId) {
      return window.getCurrentEditingId();
    }

    if (typeof editingId !== "undefined") {
      return editingId;
    }

    return window.klevbyEditingPostId || null;
  }

  function setCurrentEditingId(value) {
    const state = getState();

    if (typeof state.setCurrentEditingId === "function") {
      state.setCurrentEditingId(value);
      return;
    }

    if (typeof window.setCurrentEditingId === "function" && window.setCurrentEditingId !== setCurrentEditingId) {
      window.setCurrentEditingId(value);
      return;
    }

    if (typeof editingId !== "undefined") {
      editingId = value;
    }

    window.klevbyEditingPostId = value;
  }

  function setCurrentViewMode(mode) {
    const state = getState();

    if (typeof state.setCurrentViewMode === "function") {
      state.setCurrentViewMode(mode);
      return;
    }

    if (typeof window.setCurrentViewMode === "function" && window.setCurrentViewMode !== setCurrentViewMode) {
      window.setCurrentViewMode(mode);
      return;
    }

    const safeMode = mode === "mine" ? "mine" : "all";

    if (typeof viewMode !== "undefined") {
      viewMode = safeMode;
    }

    window.klevbyViewMode = safeMode;
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
      console.warn("Klevby posts form: cannot read auth token from localStorage", {
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
        console.warn("Klevby posts form: getSession token read failed, fallback to localStorage", {
          name: error?.name || null,
          message: error?.message || String(error || "")
        });
      }
    }

    return getAccessTokenFromLocalStorage();
  }

  function cleanTelegram(value) {
    const utils = getUtils();

    if (typeof utils.cleanTelegram === "function") {
      return utils.cleanTelegram(value);
    }

    if (typeof window.cleanTelegram === "function" && window.cleanTelegram !== cleanTelegram) {
      return window.cleanTelegram(value);
    }

    let v = String(value || "").trim();

    v = v.replace(/^@/, "");
    v = v.replace(/^https?:\/\/t\.me\//i, "");
    v = v.replace(/^https?:\/\/telegram\.me\//i, "");
    v = v.replace(/^t\.me\//i, "");
    v = v.split("?")[0];
    v = v.split("/")[0];
    v = v.replace(/[^a-zA-Z0-9_]/g, "");

    return v;
  }

  function getPostFishingType(post) {
    const utils = getUtils();

    if (typeof utils.getPostFishingType === "function") {
      return utils.getPostFishingType(post);
    }

    if (typeof window.getPostFishingType === "function" && window.getPostFishingType !== getPostFishingType) {
      return window.getPostFishingType(post);
    }

    return post?.fishing_type || post?.type || post?.category || "";
  }

  function showFormMessageSafe(message, isError = false) {
    const utils = getUtils();

    if (typeof utils.showFormMessageSafe === "function") {
      utils.showFormMessageSafe(message, isError);
      return;
    }

    if (typeof window.showFormMessage === "function") {
      window.showFormMessage(message, isError);
      return;
    }

    const el = document.getElementById("formMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
  }

  function saveAuthorLocal(name, telegram) {
    const utils = getUtils();

    if (typeof utils.saveAuthorLocal === "function") {
      utils.saveAuthorLocal(name, telegram);
      return;
    }

    if (typeof window.saveAuthorLocal === "function" && window.saveAuthorLocal !== saveAuthorLocal) {
      window.saveAuthorLocal(name, telegram);
      return;
    }

    localStorage.setItem("klevby_author_name", name || "");
    localStorage.setItem("klevby_author_telegram", telegram || "");
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

  function reloadPostsAfterSave() {
    setTimeout(() => {
      loadPosts({ force: true }).catch((error) => {
        console.warn("Klevby posts form: background posts reload failed after save", {
          message: error?.message || String(error || "")
        });
      });

      if (typeof window.klevbyReloadMap === "function") {
        try {
          window.klevbyReloadMap();
        } catch (error) {
          console.warn("Klevby posts form: map reload failed after save", {
            message: error?.message || String(error || "")
          });
        }
      }
    }, POSTS_RELOAD_AFTER_SAVE_DELAY_MS);
  }

  function getSaveButtonSafe() {
    return (
      document.querySelector('button[onclick="savePost()"]') ||
      Array.from(document.querySelectorAll("button")).find((button) => {
        return String(button.textContent || "").trim() === "Сохранить";
      }) ||
      null
    );
  }

  function setSaveButtonBusy(isBusy) {
    const button = getSaveButtonSafe();
    if (!button) return;

    button.disabled = Boolean(isBusy);
    button.setAttribute("aria-busy", isBusy ? "true" : "false");
    button.classList.toggle("is-saving", Boolean(isBusy));
  }

  async function getAuthDiagnosticsSafe() {
    const user = getCurrentUserSafe();
    const db = getSupabaseClientSafe();

    const diagnostics = {
      authReady: getCurrentAuthReady(),
      currentUserExists: Boolean(user),
      currentUserIdPresent: Boolean(user?.id),
      hasSupabaseClient: Boolean(db),
      hasAuthClient: Boolean(db?.auth),
      sessionUserPresent: false,
      sessionTokenPresent: false,
      sessionError: null,
      getUserPresent: false,
      getUserError: null,
      localStorageTokenPresent: Boolean(getAccessTokenFromLocalStorage())
    };

    if (!db?.auth) {
      return diagnostics;
    }

    try {
      const sessionResult = await runWithTimeout(
        () => db.auth.getSession(),
        "Диагностика сессии",
        3500
      );

      diagnostics.sessionUserPresent = Boolean(sessionResult?.data?.session?.user?.id);
      diagnostics.sessionTokenPresent = Boolean(sessionResult?.data?.session?.access_token);
      diagnostics.sessionError = sessionResult?.error?.message || null;
    } catch (error) {
      diagnostics.sessionError = error?.message || String(error || "session check failed");
    }

    try {
      const userResult = await runWithTimeout(
        () => db.auth.getUser(),
        "Диагностика пользователя",
        3500
      );

      diagnostics.getUserPresent = Boolean(userResult?.data?.user?.id);
      diagnostics.getUserError = userResult?.error?.message || null;
    } catch (error) {
      diagnostics.getUserError = error?.message || String(error || "user check failed");
    }

    return diagnostics;
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
      console.warn("Klevby posts form: restoreAuthState failed", {
        reason,
        name: error?.name || null,
        message: error?.message || String(error || "")
      });

      return null;
    }
  }

  async function ensureUserForPostAction() {
    debugSaveStep("ensure user start", {
      authReady: getCurrentAuthReady(),
      userIdPresent: Boolean(getCurrentUserSafe()?.id)
    });

    let user = getCurrentUserSafe();

    if (user && user.id) {
      debugSaveStep("ensure user immediate success", {
        userIdPresent: true
      });

      return user;
    }

    if (typeof window.restoreAuthState === "function" && !getCurrentAuthReady()) {
      await restoreAuthStateSafe("before_post_action");
    }

    user = getCurrentUserSafe();

    if (user && user.id) {
      debugSaveStep("ensure user after first restore", {
        userIdPresent: true
      });

      return user;
    }

    await restoreAuthStateSafe("post_action_retry");

    user = getCurrentUserSafe();

    if (user && user.id) {
      debugSaveStep("ensure user after retry restore", {
        userIdPresent: true
      });

      return user;
    }

    const retryDelays = [150, 220, 320];

    for (let i = 0; i < retryDelays.length; i += 1) {
      await wait(retryDelays[i]);

      user = getCurrentUserSafe();

      if (user && user.id) {
        debugSaveStep("ensure user delayed success before restore", {
          attempt: i + 1,
          delay: retryDelays[i],
          userIdPresent: true
        });

        return user;
      }

      await restoreAuthStateSafe(`post_action_delayed_retry_${i + 1}`);

      user = getCurrentUserSafe();

      if (user && user.id) {
        debugSaveStep("ensure user delayed success after restore", {
          attempt: i + 1,
          delay: retryDelays[i],
          userIdPresent: true
        });

        return user;
      }
    }

    const diagnostics = await getAuthDiagnosticsSafe();

    console.warn("Klevby posts form: user missing after auth retries", diagnostics);

    debugSaveStep("ensure user end missing", {
      authReady: diagnostics.authReady,
      currentUserExists: diagnostics.currentUserExists,
      currentUserIdPresent: diagnostics.currentUserIdPresent,
      sessionUserPresent: diagnostics.sessionUserPresent,
      sessionTokenPresent: diagnostics.sessionTokenPresent,
      localStorageTokenPresent: diagnostics.localStorageTokenPresent
    });

    return null;
  }

  function normalizeTripDateValue(value) {
    const raw = String(value || "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    return "";
  }

  function focusTripDateInput() {
    const input = document.getElementById("tripDateInput");

    if (!input) return;

    try {
      input.focus({ preventScroll: false });
    } catch (error) {
      input.focus();
    }

    input.classList.add("input-error-pulse");

    setTimeout(() => {
      input.classList.remove("input-error-pulse");
    }, 900);
  }

  function ensureTripDateRequiredUi() {
    const tripDateInput = document.getElementById("tripDateInput");
    const tripTimeInput = document.getElementById("tripTimeInput");

    if (tripDateInput) {
      tripDateInput.required = true;
      tripDateInput.setAttribute("aria-required", "true");
      tripDateInput.setAttribute("title", "Дата выезда обязательна");
      tripDateInput.setAttribute("autocomplete", "off");
    }

    if (tripTimeInput) {
      tripTimeInput.required = false;
      tripTimeInput.placeholder = "Время/детали: утром, вечером, после работы...";
      tripTimeInput.setAttribute("title", "Необязательно: время или детали выезда");
    }
  }

  function collectFormValues() {
    ensureTripDateRequiredUi();

    return {
      name: document.getElementById("nameInput")?.value.trim() || "",
      city: document.getElementById("cityInput")?.value.trim() || "",
      destination: document.getElementById("destinationInput")?.value.trim() || "",
      tripTime: document.getElementById("tripTimeInput")?.value.trim() || "",
      tripDate: normalizeTripDateValue(document.getElementById("tripDateInput")?.value || ""),
      fishingType: document.getElementById("fishingTypeInput")?.value.trim() || "",
      transport: document.getElementById("transportInput")?.value.trim() || "",
      seats: document.getElementById("seatsInput")?.value.trim() || "",
      text: document.getElementById("textInput")?.value.trim() || "",
      telegram: cleanTelegram(document.getElementById("telegramInput")?.value || "")
    };
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

  function isFishingTypeSchemaFallbackError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const payload = `${message} ${details} ${hint}`;

    return (
      payload.includes("fishing_type") ||
      payload.includes("schema cache") ||
      payload.includes("could not find") ||
      payload.includes("column")
    );
  }

  async function savePostViaRest(payload, activeEditingId = null) {
    const supabaseUrl = getSupabaseUrlSafe();
    const anonKey = getSupabaseAnonKeySafe();
    const accessToken = await getAccessTokenSafe();

    if (!supabaseUrl || !anonKey) {
      throw new Error("Supabase config недоступен для сохранения posts.");
    }

    if (!accessToken) {
      const error = new Error("Нет access token для сохранения объявления.");
      error.code = "KLEVB_AUTH_TOKEN_MISSING";
      throw error;
    }

    const isUpdate = Boolean(activeEditingId);
    const url = isUpdate
      ? `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(String(activeEditingId))}`
      : `${supabaseUrl}/rest/v1/posts`;

    const method = isUpdate ? "PATCH" : "POST";
    const body = isUpdate ? payload : [{ ...payload, crew_full: false }];

    debugSaveStep(isUpdate ? "REST update start" : "REST insert start", {
      activeEditingId: activeEditingId || null,
      hasFishingType: Boolean(payload.fishing_type),
      hasTripDate: Object.prototype.hasOwnProperty.call(payload, "trip_date"),
      tripDate: payload.trip_date || null,
      tokenPresent: Boolean(accessToken)
    });

    return runWithTimeout(
      async (signal) => {
        const response = await fetch(url, {
          method,
          signal: signal || undefined,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify(body)
        });

        const parsed = await parseRestResponse(response);

        if (!response.ok) {
          throw buildRestError(response, parsed);
        }

        return {
          data: Array.isArray(parsed) ? parsed : parsed ? [parsed] : [],
          error: null,
          source: "rest"
        };
      },
      isUpdate ? "REST-обновление выезда" : "REST-создание выезда"
    );
  }

  async function savePostViaRestWithSchemaFallback(payload, activeEditingId = null) {
    try {
      return await savePostViaRest(payload, activeEditingId);
    } catch (error) {
      if (!payload.fishing_type || !isFishingTypeSchemaFallbackError(error)) {
        throw error;
      }

      const withoutFishingType = { ...payload };
      delete withoutFishingType.fishing_type;

      console.warn("Klevby posts form: REST save retry without fishing_type", {
        activeEditingId: activeEditingId || null,
        message: error?.message || String(error || "")
      });

      debugSaveStep(activeEditingId ? "REST update retry without fishing_type" : "REST insert retry without fishing_type", {
        activeEditingId: activeEditingId || null
      });

      return savePostViaRest(withoutFishingType, activeEditingId);
    }
  }

  async function savePost() {
    if (savePostInProgress) {
      debugSaveStep("savePost ignored: already in progress");
      showFormMessageSafe("Сохранение уже выполняется. Подожди пару секунд.", false);
      return null;
    }

    savePostInProgress = true;
    setSaveButtonBusy(true);

    debugSaveStep("savePost entered", {
      version: POSTS_FORM_VERSION
    });

    try {
      const restoredUser = await ensureUserForPostAction();

      debugSaveStep("ensure user end", {
        userIdPresent: Boolean(restoredUser?.id)
      });

      const values = collectFormValues();

      debugSaveStep("form values collected", {
        nameLength: values.name.length,
        cityLength: values.city.length,
        destinationLength: values.destination.length,
        tripTimeLength: values.tripTime.length,
        tripDatePresent: Boolean(values.tripDate),
        textLength: values.text.length,
        fishingTypeLength: values.fishingType.length,
        transportLength: values.transport.length,
        seatsLength: values.seats.length,
        telegramPresent: Boolean(values.telegram)
      });

      if (!restoredUser) {
        const diagnostics = await getAuthDiagnosticsSafe();

        console.warn("Klevby posts form: cannot save because user is missing", diagnostics);

        if (diagnostics.sessionTokenPresent || diagnostics.sessionUserPresent || diagnostics.localStorageTokenPresent) {
          showFormMessageSafe("Авторизация ещё восстанавливается. Подожди пару секунд и нажми сохранить ещё раз.", true);
          return null;
        }

        if (typeof window.showSection === "function") {
          window.showSection("auth");
        }

        alert("Сначала создай профиль или войди. Так объявления будут защищены от удаления чужими людьми.");
        return null;
      }

      if (!values.name || !values.city || !values.destination || !values.text) {
        debugSaveStep("validation failed: required text fields", {
          name: Boolean(values.name),
          city: Boolean(values.city),
          destination: Boolean(values.destination),
          text: Boolean(values.text)
        });

        showFormMessageSafe("Заполни Nickname, город, куда едешь и описание.", true);
        return null;
      }

      if (!values.tripDate) {
        debugSaveStep("validation failed: trip_date missing", {
          tripDatePresent: false
        });

        focusTripDateInput();
        showFormMessageSafe("Выбери дату выезда. Без даты объявление не сохранится.", true);
        return null;
      }

      debugSaveStep("validation passed");

      saveAuthorLocal(values.name, values.telegram);

      const payload = {
        name: values.name,
        city: values.city,
        destination: values.destination,
        trip_time: values.tripTime,
        trip_date: values.tripDate,
        transport: values.transport,
        seats: values.seats,
        text: values.text,
        telegram: values.telegram,
        owner_id: restoredUser.id
      };

      if (values.fishingType) {
        payload.fishing_type = values.fishingType;
      }

      debugSaveStep("payload ready", {
        hasFishingType: Boolean(payload.fishing_type),
        hasTripDate: Object.prototype.hasOwnProperty.call(payload, "trip_date"),
        tripDate: payload.trip_date || null,
        ownerIdPresent: Boolean(payload.owner_id)
      });

      const activeEditingId = getCurrentEditingId();

      const result = await savePostViaRestWithSchemaFallback(payload, activeEditingId);

      if (result.error) {
        debugSaveStep(activeEditingId ? "REST update error" : "REST insert error", {
          message: result.error.message || "unknown REST error",
          code: result.error.code || null
        });

        showFormMessageSafe("Не получилось сохранить объявление: " + (result.error.message || "ошибка Supabase"), true);
        console.error("Ошибка сохранения posts:", result.error);
        return null;
      }

      debugSaveStep(activeEditingId ? "REST update success" : "REST insert success", {
        rows: Array.isArray(result.data) ? result.data.length : 0
      });

      const wasEditing = Boolean(activeEditingId);
      const savedPost = Array.isArray(result.data) ? result.data[0] : null;

      if (savedPost) {
        upsertPostInLocalState(savedPost, activeEditingId);
      }

      clearForm();

      if (typeof window.fillAuthorLocal === "function") {
        window.fillAuthorLocal();
      }

      setCurrentEditingId(null);

      const formTitle = document.getElementById("formTitle");
      const cancelEditBtn = document.getElementById("cancelEditBtn");

      if (formTitle) {
        formTitle.innerText = "Создать выезд";
      }

      if (cancelEditBtn) {
        cancelEditBtn.classList.add("hidden");
      }

      showFormMessageSafe(wasEditing ? "Выезд обновлён." : "Выезд создан.");

      setCurrentViewMode("all");

      if (typeof window.setMode === "function") {
        window.setMode("all");
      } else if (typeof window.showSection === "function") {
        window.showSection("trips");
      }

      reloadPostsAfterSave();

      debugSaveStep("savePost finished successfully");

      return result;
    } catch (error) {
      console.error("Klevby posts form: savePost crashed", error);

      if (error?.code === "KLEVB_AUTH_TOKEN_MISSING") {
        showFormMessageSafe(
          "Авторизация не готова для сохранения. Обнови приложение и войди снова.",
          true
        );
      } else if (error?.status === 401 || error?.status === 403) {
        showFormMessageSafe(
          "Supabase не разрешил сохранить выезд. Проверь вход в аккаунт и RLS.",
          true
        );
      } else if (error?.isKlevbySaveTimeout || error?.name === "KlevbyPostsSaveTimeoutError" || error?.name === "AbortError") {
        showFormMessageSafe(
          "Сохранение зависло и было остановлено. Проверь интернет и нажми сохранить ещё раз.",
          true
        );
      } else {
        showFormMessageSafe(
          "Не получилось сохранить объявление: " + (error?.message || "неизвестная ошибка"),
          true
        );
      }

      return null;
    } finally {
      savePostInProgress = false;
      setSaveButtonBusy(false);

      debugSaveStep("saving lock reset");
    }
  }

  function editPost(id) {
    const post = getPostsArray().find((item) => String(item.id) === String(id));
    if (!post) return;

    setCurrentEditingId(id);
    ensureTripDateRequiredUi();

    const values = {
      nameInput: post.name || "",
      cityInput: post.city || "",
      destinationInput: post.destination || "",
      tripTimeInput: post.trip_time || "",
      tripDateInput: normalizeTripDateValue(post.trip_date || ""),
      fishingTypeInput: getPostFishingType(post),
      transportInput: post.transport || "",
      seatsInput: post.seats || "",
      textInput: post.text || "",
      telegramInput: post.telegram || ""
    };

    Object.keys(values).forEach((idKey) => {
      const el = document.getElementById(idKey);

      if (el) {
        el.value = values[idKey];
      }
    });

    const formTitle = document.getElementById("formTitle");
    const cancelEditBtn = document.getElementById("cancelEditBtn");

    if (formTitle) {
      formTitle.innerText = "Редактировать выезд";
    }

    if (cancelEditBtn) {
      cancelEditBtn.classList.remove("hidden");
    }

    if (typeof window.showCreatePostScreen === "function") {
      window.showCreatePostScreen();
    } else if (typeof window.showSection === "function") {
      window.showSection("create");
    }

    if (typeof window.updateHomeFloatButton === "function") {
      setTimeout(window.updateHomeFloatButton, 120);
    }
  }

  function cancelEdit() {
    setCurrentEditingId(null);
    clearForm();

    if (typeof window.fillAuthorLocal === "function") {
      window.fillAuthorLocal();
    }

    const formTitle = document.getElementById("formTitle");
    const cancelEditBtn = document.getElementById("cancelEditBtn");

    if (formTitle) {
      formTitle.innerText = "Создать выезд";
    }

    if (cancelEditBtn) {
      cancelEditBtn.classList.add("hidden");
    }

    showFormMessageSafe("");
  }

  function clearForm() {
    const ids = [
      "nameInput",
      "cityInput",
      "destinationInput",
      "tripTimeInput",
      "tripDateInput",
      "fishingTypeInput",
      "transportInput",
      "seatsInput",
      "textInput",
      "telegramInput"
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);

      if (el) {
        el.value = "";
      }
    });

    ensureTripDateRequiredUi();
  }

  window.KlevbyPostsForm = {
    ensureUserForPostAction,
    savePost,
    editPost,
    cancelEdit,
    clearForm
  };

  ensureTripDateRequiredUi();

  console.log("Klevby posts form loaded", {
    version: POSTS_FORM_VERSION
  });
})();
