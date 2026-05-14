function getPostsStateSafe() {
  return window.KlevbyPostsState || {};
}

function getPostsUtilsSafe() {
  return window.KlevbyPostsUtils || {};
}

function getPostsApiSafe() {
  return window.KlevbyPostsApi || {};
}

function getPostsRenderSafe() {
  return window.KlevbyPostsRender || {};
}

function getOwnerId() {
  const state = getPostsStateSafe();

  if (typeof state.getOwnerId === "function") {
    return state.getOwnerId();
  }

  const user =
    (typeof currentUser !== "undefined" && currentUser)
      ? currentUser
      : (window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null);

  return user ? user.id : null;
}

function getCurrentUserSafe() {
  const state = getPostsStateSafe();

  if (typeof state.getCurrentUserSafe === "function") {
    return state.getCurrentUserSafe();
  }

  if (typeof currentUser !== "undefined" && currentUser) {
    return currentUser;
  }

  return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
}

function getCurrentAuthReady() {
  const state = getPostsStateSafe();

  if (typeof state.getCurrentAuthReady === "function") {
    return state.getCurrentAuthReady();
  }

  if (typeof authReady !== "undefined") {
    return authReady;
  }

  return Boolean(window.klevbyAuthReady || window.authReady);
}

function getPostsArray() {
  const state = getPostsStateSafe();

  if (typeof state.getPostsArray === "function") {
    return state.getPostsArray();
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
  const state = getPostsStateSafe();

  if (typeof state.setPostsArray === "function") {
    state.setPostsArray(value);
    return;
  }

  const safePosts = Array.isArray(value) ? value : [];
  window.posts = safePosts;
  window.klevbyPosts = safePosts;
}

function getCurrentViewMode() {
  const state = getPostsStateSafe();

  if (typeof state.getCurrentViewMode === "function") {
    return state.getCurrentViewMode();
  }

  if (window.klevbyViewMode) {
    return window.klevbyViewMode;
  }

  if (typeof viewMode !== "undefined" && viewMode) {
    return viewMode;
  }

  return "all";
}

function setCurrentViewMode(mode) {
  const state = getPostsStateSafe();

  if (typeof state.setCurrentViewMode === "function") {
    state.setCurrentViewMode(mode);
    return;
  }

  const safeMode = mode === "mine" ? "mine" : "all";

  if (typeof viewMode !== "undefined") {
    viewMode = safeMode;
  }

  window.klevbyViewMode = safeMode;
}

function getCurrentEditingId() {
  const state = getPostsStateSafe();

  if (typeof state.getCurrentEditingId === "function") {
    return state.getCurrentEditingId();
  }

  if (typeof editingId !== "undefined") {
    return editingId;
  }

  return window.klevbyEditingPostId || null;
}

function setCurrentEditingId(value) {
  const state = getPostsStateSafe();

  if (typeof state.setCurrentEditingId === "function") {
    state.setCurrentEditingId(value);
    return;
  }

  if (typeof editingId !== "undefined") {
    editingId = value;
  }

  window.klevbyEditingPostId = value;
}

function getActiveModalPost() {
  const state = getPostsStateSafe();

  if (typeof state.getActiveModalPost === "function") {
    return state.getActiveModalPost();
  }

  if (typeof activeModalPost !== "undefined") {
    return activeModalPost;
  }

  return window.klevbyActiveModalPost || null;
}

function setActiveModalPost(value) {
  const state = getPostsStateSafe();

  if (typeof state.setActiveModalPost === "function") {
    state.setActiveModalPost(value);
    return;
  }

  if (typeof activeModalPost !== "undefined") {
    activeModalPost = value;
  }

  window.klevbyActiveModalPost = value;
}

function getPostModalCloseTimer() {
  const state = getPostsStateSafe();

  if (typeof state.getPostModalCloseTimer === "function") {
    return state.getPostModalCloseTimer();
  }

  if (typeof postModalCloseTimer !== "undefined") {
    return postModalCloseTimer;
  }

  return window.klevbyPostModalCloseTimer || null;
}

function setPostModalCloseTimer(value) {
  const state = getPostsStateSafe();

  if (typeof state.setPostModalCloseTimer === "function") {
    state.setPostModalCloseTimer(value);
    return;
  }

  if (typeof postModalCloseTimer !== "undefined") {
    postModalCloseTimer = value;
  }

  window.klevbyPostModalCloseTimer = value;
}

function getSupabaseClientSafe() {
  const api = getPostsApiSafe();

  if (typeof api.getSupabaseClientSafe === "function") {
    return api.getSupabaseClientSafe();
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

function isAdminSafe() {
  if (typeof isAdmin === "function") {
    return isAdmin();
  }

  if (typeof window.isAdmin === "function") {
    return window.isAdmin();
  }

  return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
}

function showStatusSafe(message, isError = false) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.showStatusSafe === "function") {
    utils.showStatusSafe(message, isError);
    return;
  }

  if (typeof showStatus === "function") {
    showStatus(message, isError);
    return;
  }

  if (typeof window.showStatus === "function") {
    window.showStatus(message, isError);
    return;
  }

  const status = document.getElementById("statusLine");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error-line", Boolean(isError));
}

function showFormMessageSafe(message, isError = false) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.showFormMessageSafe === "function") {
    utils.showFormMessageSafe(message, isError);
    return;
  }

  if (typeof showFormMessage === "function") {
    showFormMessage(message, isError);
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

function openTelegramSafe() {
  const utils = getPostsUtilsSafe();

  if (typeof utils.openTelegramSafe === "function") {
    utils.openTelegramSafe();
    return;
  }

  if (typeof openTelegram === "function") {
    openTelegram();
    return;
  }

  if (typeof window.openTelegram === "function") {
    window.openTelegram();
    return;
  }

  const config = window.KLEVB_CONFIG || {};
  const link = config.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
  window.open(link, "_blank");
}

function cleanTelegram(value) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.cleanTelegram === "function") {
    return utils.cleanTelegram(value);
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

function normalizeText(value) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.normalizeText === "function") {
    return utils.normalizeText(value);
  }

  return String(value || "").toLowerCase().trim();
}

function normalizeSelectFilterValue(elementId) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.normalizeSelectFilterValue === "function") {
    return utils.normalizeSelectFilterValue(elementId);
  }

  const value = normalizeText(document.getElementById(elementId)?.value);

  if (!value) return "";

  if (
    value === "выберите город" ||
    value === "все города" ||
    value === "город" ||
    value === "способ ловли" ||
    value === "выберите способ ловли" ||
    value === "тип ловли" ||
    value === "все способы"
  ) {
    return "";
  }

  return value;
}

function escapeHtml(text) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.escapeHtml === "function") {
    return utils.escapeHtml(text);
  }

  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.escapeAttr === "function") {
    return utils.escapeAttr(text);
  }

  return escapeHtml(text).replaceAll("`", "&#096;");
}

function getPostFishingType(post) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.getPostFishingType === "function") {
    return utils.getPostFishingType(post);
  }

  return post?.fishing_type || post?.type || post?.category || "";
}

function getFishingTypeClass(type) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.getFishingTypeClass === "function") {
    return utils.getFishingTypeClass(type);
  }

  const t = normalizeText(type);

  if (t.includes("спин")) return "type-spinning";
  if (t.includes("фидер")) return "type-feeder";
  if (t.includes("поплав")) return "type-float";
  if (t.includes("карп")) return "type-carp";
  if (t.includes("зим")) return "type-winter";

  return "";
}

function getCardImage(post) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.getCardImage === "function") {
    return utils.getCardImage(post);
  }

  return "assets/img/klevby-icon-512.png";
}

function saveAuthorLocal(name, telegram) {
  const utils = getPostsUtilsSafe();

  if (typeof utils.saveAuthorLocal === "function") {
    utils.saveAuthorLocal(name, telegram);
    return;
  }

  localStorage.setItem("klevby_author_name", name || "");
  localStorage.setItem("klevby_author_telegram", telegram || "");
}

async function loadPosts(options = {}) {
  const api = getPostsApiSafe();

  if (typeof api.loadPosts === "function") {
    return api.loadPosts(options);
  }

  console.warn("Klevby posts: posts-api module недоступен, загрузка объявлений пропущена.");

  showStatusSafe("Модуль загрузки объявлений ещё не готов. Обнови страницу.", true);

  const postsSection = document.getElementById("postsSection");

  if (postsSection && !getPostsArray().length) {
    postsSection.innerHTML = `
      <div class="info-line error-line">
        Модуль загрузки объявлений ещё не готов. Обнови страницу.
      </div>
    `;
  }

  return null;
}

function renderPosts() {
  const render = getPostsRenderSafe();

  if (typeof render.renderPosts === "function") {
    return render.renderPosts();
  }

  console.warn("Klevby posts: posts-render module недоступен.");

  const list = document.getElementById("postsSection");

  if (list && !getPostsArray().length) {
    list.innerHTML = `
      <div class="info-line error-line">
        Модуль отображения объявлений ещё не готов. Обнови страницу.
      </div>
    `;
  }

  return null;
}

function cardHtml(post) {
  const render = getPostsRenderSafe();

  if (typeof render.cardHtml === "function") {
    return render.cardHtml(post);
  }

  console.warn("Klevby posts: cardHtml fallback вызван без posts-render module.", post);

  return "";
}

function openPostModal(id) {
  const post = getPostsArray().find(p => String(p.id) === String(id));
  if (!post) return;

  setActiveModalPost(post);

  const modal = document.getElementById("postModal");
  const imageEl = document.getElementById("postModalImage");
  const titleEl = document.getElementById("postModalTitle");
  const metaEl = document.getElementById("postModalMeta");
  const textEl = document.getElementById("postModalText");
  const writeBtn = document.getElementById("postModalWriteBtn");

  if (!modal || !imageEl || !titleEl || !metaEl || !textEl || !writeBtn) return;

  const image = getCardImage(post);
  const tg = cleanTelegram(post.telegram);
  const isFull = Boolean(post.crew_full);
  const date = post.created_at
    ? new Date(post.created_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";
  const fishingType = getPostFishingType(post);
  const destination = post.destination || post.city || "рыбалку";

  imageEl.style.backgroundImage = `url('${image}')`;
  titleEl.textContent = `${post.name || "Рыбак"} едет на ${destination}`;
  textEl.textContent = post.text || "Описание не указано.";

  metaEl.innerHTML = `
    ${post.city ? `<span class="post-modal-pill">📍 Откуда: ${escapeHtml(post.city)}</span>` : ""}
    ${post.destination ? `<span class="post-modal-pill">🗺️ Куда: ${escapeHtml(post.destination)}</span>` : ""}
    ${post.trip_time ? `<span class="post-modal-pill">🕒 Когда: ${escapeHtml(post.trip_time)}</span>` : ""}
    ${fishingType ? `<span class="post-modal-pill">🎣 ${escapeHtml(fishingType)}</span>` : ""}
    ${post.transport ? `<span class="post-modal-pill">🚗 ${escapeHtml(post.transport)}</span>` : ""}
    ${post.seats ? `<span class="post-modal-pill">👥 ${escapeHtml(post.seats)}</span>` : ""}
    ${date ? `<span class="post-modal-pill">Создано: ${escapeHtml(date)}</span>` : ""}
    ${tg ? `<span class="post-modal-pill">Telegram</span>` : ""}
    ${isFull ? `<span class="post-modal-pill">Экипаж набран</span>` : ""}
  `;

  if (isFull) {
    writeBtn.textContent = "Экипаж уже набран";
    writeBtn.disabled = true;
  } else {
    writeBtn.textContent = "Написать";
    writeBtn.disabled = false;
  }

  clearTimeout(getPostModalCloseTimer());
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    modal.classList.add("open");
    document.body.classList.add("post-modal-open");
  });
}

function closePostModal() {
  const modal = document.getElementById("postModal");
  if (!modal) return;

  modal.classList.remove("open");
  document.body.classList.remove("post-modal-open");

  const timer = setTimeout(() => {
    modal.classList.add("hidden");
    setActiveModalPost(null);
  }, 360);

  setPostModalCloseTimer(timer);
}

function handlePostModalBackdrop(event) {
  if (event.target && event.target.id === "postModal") {
    closePostModal();
  }
}

function writePostAuthor() {
  const post = getActiveModalPost();
  if (!post) return;

  const tg = cleanTelegram(post.telegram);

  if (tg) {
    window.open(`https://t.me/${tg}`, "_blank");
  } else {
    openTelegramSafe();
  }
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
  const post = getPostsArray().find(p => String(p.id) === String(id));
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

async function toggleCrewFull(id, value) {
  const db = getSupabaseClientSafe();

  if (!db) {
    alert("Supabase ещё не готов. Обнови страницу.");
    return;
  }

  const { error } = await db
    .from("posts")
    .update({ crew_full: value })
    .eq("id", id);

  if (error) {
    alert("Не получилось изменить статус. Провь поле crew_full и RLS.");
    console.error("Ошибка crew_full:", error);
    return;
  }

  await loadPosts({ force: true });
}

async function deletePost(id) {
  if (!confirm("Удалить объявление? Это действие нельзя отменить.")) return;

  const db = getSupabaseClientSafe();

  if (!db) {
    alert("Supabase ещё не готов. Обнови страницу.");
    return;
  }

  const { error } = await db
    .from("posts")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Не получилось удалить. Удалять может только владелец объявления или админ.");
    console.error("Ошибка удаления posts:", error);
    return;
  }

  await loadPosts({ force: true });

  if (typeof window.klevbyReloadMap === "function") {
    window.klevbyReloadMap();
  }
}

window.getOwnerId = getOwnerId;
window.getCurrentUserSafe = getCurrentUserSafe;
window.getCurrentAuthReady = getCurrentAuthReady;
window.getPostsArray = getPostsArray;
window.setPostsArray = setPostsArray;
window.getCurrentViewMode = getCurrentViewMode;
window.setCurrentViewMode = setCurrentViewMode;
window.getPostFishingType = getPostFishingType;
window.cleanTelegram = cleanTelegram;
window.normalizeText = normalizeText;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.getFishingTypeClass = getFishingTypeClass;
window.getCardImage = getCardImage;
window.saveAuthorLocal = saveAuthorLocal;
window.loadPosts = loadPosts;
window.renderPosts = renderPosts;
window.cardHtml = cardHtml;
window.openPostModal = openPostModal;
window.closePostModal = closePostModal;
window.handlePostModalBackdrop = handlePostModalBackdrop;
window.writePostAuthor = writePostAuthor;
window.openTelegramSafe = openTelegramSafe;
window.savePost = savePost;
window.editPost = editPost;
window.cancelEdit = cancelEdit;
window.clearForm = clearForm;
window.toggleCrewFull = toggleCrewFull;
window.deletePost = deletePost;

console.log("Klevby posts bridge loaded", {
  version: "20260514-posts-render-split-1"
});
