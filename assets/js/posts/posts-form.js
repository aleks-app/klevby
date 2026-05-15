(function () {
  const POSTS_FORM_VERSION = "20260515-posts-form-resume-save-1";

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
      getUserError: null
    };

    if (!db?.auth) {
      return diagnostics;
    }

    try {
      const sessionResult = await db.auth.getSession();

      diagnostics.sessionUserPresent = Boolean(sessionResult?.data?.session?.user?.id);
      diagnostics.sessionTokenPresent = Boolean(sessionResult?.data?.session?.access_token);
      diagnostics.sessionError = sessionResult?.error?.message || null;
    } catch (error) {
      diagnostics.sessionError = error?.message || String(error || "session check failed");
    }

    try {
      const userResult = await db.auth.getUser();

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
      return await window.restoreAuthState(reason, false);
    } catch (error) {
      console.warn("Klevby posts form: restoreAuthState failed", {
        reason,
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
      sessionTokenPresent: diagnostics.sessionTokenPresent
    });

    return null;
  }

  function collectFormValues() {
    return {
      name: document.getElementById("nameInput")?.value.trim() || "",
      city: document.getElementById("cityInput")?.value.trim() || "",
      destination: document.getElementById("destinationInput")?.value.trim() || "",
      tripTime: document.getElementById("tripTimeInput")?.value.trim() || "",
      fishingType: document.getElementById("fishingTypeInput")?.value.trim() || "",
      transport: document.getElementById("transportInput")?.value.trim() || "",
      seats: document.getElementById("seatsInput")?.value.trim() || "",
      text: document.getElementById("textInput")?.value.trim() || "",
      telegram: cleanTelegram(document.getElementById("telegramInput")?.value || "")
    };
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
        textLength: values.text.length,
        fishingTypeLength: values.fishingType.length,
        transportLength: values.transport.length,
        seatsLength: values.seats.length,
        telegramPresent: Boolean(values.telegram)
      });

      if (!restoredUser) {
        const diagnostics = await getAuthDiagnosticsSafe();

        console.warn("Klevby posts form: cannot save because user is missing", diagnostics);

        if (diagnostics.sessionTokenPresent || diagnostics.sessionUserPresent) {
          showFormMessageSafe("Авторизация ещё восстанавливается. Подожди пару секунд и нажми сохранить ещё раз.", true);
          return null;
        }

        if (typeof window.showSection === "function") {
          window.showSection("auth");
        }

        alert("Сначала создай профиль или войди. Так объявления будут защищены от удаления чужими людьми.");
        return null;
      }

      if (!values.name || !values.city || !values.destination || !values.tripTime || !values.text) {
        debugSaveStep("validation failed", {
          name: Boolean(values.name),
          city: Boolean(values.city),
          destination: Boolean(values.destination),
          tripTime: Boolean(values.tripTime),
          text: Boolean(values.text)
        });

        showFormMessageSafe("Заполни Nickname, город, куда едешь, когда и описание.", true);
        return null;
      }

      debugSaveStep("validation passed");

      const db = getSupabaseClientSafe();

      if (!db) {
        debugSaveStep("db missing");
        showFormMessageSafe("Supabase ещё не готов. Обнови страницу.", true);
        return null;
      }

      saveAuthorLocal(values.name, values.telegram);

      const payload = {
        name: values.name,
        city: values.city,
        destination: values.destination,
        trip_time: values.tripTime,
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
        ownerIdPresent: Boolean(payload.owner_id)
      });

      let result;
      const activeEditingId = getCurrentEditingId();

      debugSaveStep(activeEditingId ? "update start" : "insert start", {
        activeEditingId: activeEditingId || null
      });

      if (activeEditingId) {
        result = await db
          .from("posts")
          .update(payload)
          .eq("id", activeEditingId);
      } else {
        result = await db
          .from("posts")
          .insert([{ ...payload, crew_full: false }]);
      }

      if (result.error && String(result.error.message || "").includes("fishing_type")) {
        console.warn("В posts нет fishing_type. Сохраняю без этого поля:", result.error);

        delete payload.fishing_type;

        debugSaveStep(activeEditingId ? "update retry without fishing_type" : "insert retry without fishing_type", {
          activeEditingId: activeEditingId || null
        });

        if (activeEditingId) {
          result = await db
            .from("posts")
            .update(payload)
            .eq("id", activeEditingId);
        } else {
          result = await db
            .from("posts")
            .insert([{ ...payload, crew_full: false }]);
        }
      }

      if (result.error) {
        debugSaveStep(activeEditingId ? "update error" : "insert error", {
          message: result.error.message || "unknown Supabase error",
          code: result.error.code || null
        });

        showFormMessageSafe("Не получилось сохранить объявление: " + (result.error.message || "ошибка Supabase"), true);
        console.error("Ошибка сохранения posts:", result.error);
        return null;
      }

      debugSaveStep(activeEditingId ? "update success" : "insert success");

      const wasEditing = Boolean(activeEditingId);

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
      await loadPosts({ force: true });

      if (typeof window.klevbyReloadMap === "function") {
        window.klevbyReloadMap();
      }

      if (typeof window.setMode === "function") {
        window.setMode("all");
      } else if (typeof window.showSection === "function") {
        window.showSection("trips");
      }

      debugSaveStep("savePost finished successfully");

      return result;
    } catch (error) {
      console.error("Klevby posts form: savePost crashed", error);

      showFormMessageSafe(
        "Не получилось сохранить объявление. Проверь Console или попробуй обновить приложение.",
        true
      );

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

    const values = {
      nameInput: post.name || "",
      cityInput: post.city || "",
      destinationInput: post.destination || "",
      tripTimeInput: post.trip_time || "",
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
  }

  window.KlevbyPostsForm = {
    ensureUserForPostAction,
    savePost,
    editPost,
    cancelEdit,
    clearForm
  };

  console.log("Klevby posts form loaded", {
    version: POSTS_FORM_VERSION
  });
})();
