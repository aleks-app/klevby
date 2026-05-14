(function () {
  const POSTS_FORM_VERSION = "20260514-posts-form-split-1";

  function getState() {
    return window.KlevbyPostsState || {};
  }

  function getUtils() {
    return window.KlevbyPostsUtils || {};
  }

  function getApi() {
    return window.KlevbyPostsApi || {};
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

  async function ensureUserForPostAction() {
    let user = getCurrentUserSafe();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function" && !getCurrentAuthReady()) {
      await window.restoreAuthState("before_post_action", false);
    }

    user = getCurrentUserSafe();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function") {
      await window.restoreAuthState("post_action_retry", false);
    }

    return getCurrentUserSafe();
  }

  async function savePost() {
    const restoredUser = await ensureUserForPostAction();

    const name = document.getElementById("nameInput")?.value.trim() || "";
    const city = document.getElementById("cityInput")?.value.trim() || "";
    const destination = document.getElementById("destinationInput")?.value.trim() || "";
    const tripTime = document.getElementById("tripTimeInput")?.value.trim() || "";
    const fishingType = document.getElementById("fishingTypeInput")?.value.trim() || "";
    const transport = document.getElementById("transportInput")?.value.trim() || "";
    const seats = document.getElementById("seatsInput")?.value.trim() || "";
    const text = document.getElementById("textInput")?.value.trim() || "";
    const telegram = cleanTelegram(document.getElementById("telegramInput")?.value || "");

    if (!restoredUser) {
      if (typeof window.showSection === "function") {
        window.showSection("auth");
      }

      alert("Сначала создай профиль или войди. Так объявления будут защищены от удаления чужими людьми.");
      return;
    }

    if (!name || !city || !destination || !tripTime || !text) {
      showFormMessageSafe("Заполни Nickname, город, куда едешь, когда и описание.", true);
      return;
    }

    const db = getSupabaseClientSafe();

    if (!db) {
      showFormMessageSafe("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    saveAuthorLocal(name, telegram);

    const payload = {
      name,
      city,
      destination,
      trip_time: tripTime,
      transport,
      seats,
      text,
      telegram,
      owner_id: restoredUser.id
    };

    if (fishingType) {
      payload.fishing_type = fishingType;
    }

    let result;
    const activeEditingId = getCurrentEditingId();

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
      showFormMessageSafe("Не получилось сохранить объявление: " + (result.error.message || "ошибка Supabase"), true);
      console.error("Ошибка сохранения posts:", result.error);
      return;
    }

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
