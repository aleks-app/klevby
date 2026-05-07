let postsLoadPromise = null;
let postsLoadRetryTimer = null;

const POSTS_LOAD_RETRY_DELAY_MS = 900;
const POSTS_MAX_RETRIES = 3;

function getOwnerId() {
  const user =
    (typeof currentUser !== "undefined" && currentUser)
      ? currentUser
      : (window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null);

  return user ? user.id : null;
}

function getCurrentUserSafe() {
  if (typeof currentUser !== "undefined" && currentUser) {
    return currentUser;
  }

  return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
}

function getCurrentAuthReady() {
  if (typeof authReady !== "undefined") {
    return authReady;
  }

  return Boolean(window.klevbyAuthReady || window.authReady);
}

function getPostsArray() {
  if (typeof posts !== "undefined" && Array.isArray(posts)) {
    return posts;
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
  const safePosts = Array.isArray(value) ? value : [];

  if (typeof posts !== "undefined") {
    posts = safePosts;
  }

  window.posts = safePosts;
  window.klevbyPosts = safePosts;
}

function getCurrentViewMode() {
  if (window.klevbyViewMode) {
    return window.klevbyViewMode;
  }

  if (typeof viewMode !== "undefined" && viewMode) {
    return viewMode;
  }

  return "all";
}

function setCurrentViewMode(mode) {
  const safeMode = mode === "mine" ? "mine" : "all";

  if (typeof viewMode !== "undefined") {
    viewMode = safeMode;
  }

  window.klevbyViewMode = safeMode;
}

function getCurrentEditingId() {
  if (typeof editingId !== "undefined") {
    return editingId;
  }

  return window.klevbyEditingPostId || null;
}

function setCurrentEditingId(value) {
  if (typeof editingId !== "undefined") {
    editingId = value;
  }

  window.klevbyEditingPostId = value;
}

function getActiveModalPost() {
  if (typeof activeModalPost !== "undefined") {
    return activeModalPost;
  }

  return window.klevbyActiveModalPost || null;
}

function setActiveModalPost(value) {
  if (typeof activeModalPost !== "undefined") {
    activeModalPost = value;
  }

  window.klevbyActiveModalPost = value;
}

function getPostModalCloseTimer() {
  if (typeof postModalCloseTimer !== "undefined") {
    return postModalCloseTimer;
  }

  return window.klevbyPostModalCloseTimer || null;
}

function setPostModalCloseTimer(value) {
  if (typeof postModalCloseTimer !== "undefined") {
    postModalCloseTimer = value;
  }

  window.klevbyPostModalCloseTimer = value;
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

function isAdminSafe() {
  if (typeof isAdmin === "function") {
    return isAdmin();
  }

  if (typeof window.isAdmin === "function") {
    return window.isAdmin();
  }

  return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
}

function isAuthLockError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("lock") &&
    message.includes("auth-token")
  );
}

function showStatusSafe(message, isError = false) {
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
  return String(value || "").toLowerCase().trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  return escapeHtml(text).replaceAll("`", "&#096;");
}

function getPostFishingType(post) {
  return post?.fishing_type || post?.type || post?.category || "";
}

function getFishingTypeClass(type) {
  const t = normalizeText(type);

  if (t.includes("спин")) return "type-spinning";
  if (t.includes("фидер")) return "type-feeder";
  if (t.includes("поплав")) return "type-float";
  if (t.includes("карп")) return "type-carp";
  if (t.includes("зим")) return "type-winter";

  return "";
}

function getCardImagesSafe() {
  const config = window.KLEVB_CONFIG || {};
  const images = Array.isArray(config.CARD_IMAGES) ? config.CARD_IMAGES.filter(Boolean) : [];

  if (images.length) {
    return images;
  }

  return [
    "assets/img/narach-bg.webp",
    "assets/img/klevby-icon-512.png"
  ];
}

function getCardImage(post) {
  const images = getCardImagesSafe();

  if (!images.length) {
    return "assets/img/klevby-icon-512.png";
  }

  const key = String(post?.id || post?.created_at || post?.name || "klevby");
  let sum = 0;

  for (let i = 0; i < key.length; i++) {
    sum += key.charCodeAt(i);
  }

  return images[Math.abs(sum) % images.length];
}

function getProfileFeedItemsSafe() {
  try {
    if (typeof window.getProfileFeedItems === "function") {
      const items = window.getProfileFeedItems();
      return Array.isArray(items) ? items.filter(Boolean) : [];
    }
  } catch (error) {
    console.warn("Klevby feed: не удалось получить фото профиля", error);
  }

  return [];
}

function getProfileFeedAvatarSafe() {
  try {
    return localStorage.getItem("klevby_profile_avatar") || "";
  } catch (error) {
    return "";
  }
}

function getProfileFeedSearchText(item) {
  return normalizeText([
    item?.type,
    item?.authorName,
    item?.authorCity,
    item?.authorTelegram,
    item?.title,
    "фото",
    "рыбалка",
    "профиль",
    "отчет",
    "отчёт"
  ].join(" "));
}

function getFilteredProfileFeedItems(options = {}) {
  const search = normalizeText(options.search);
  const selectedCity = normalizeText(options.selectedCity);
  const selectedType = normalizeText(options.selectedType);
  const telegramOnly = Boolean(options.telegramOnly);

  let items = getProfileFeedItemsSafe();

  items = items.filter((item) => {
    if (!item || item.type !== "profile_photo" || !item.image) {
      return false;
    }

    if (search && !getProfileFeedSearchText(item).includes(search)) {
      return false;
    }

    if (selectedCity && !normalizeText(item.authorCity).includes(selectedCity)) {
      return false;
    }

    if (selectedType) {
      const typeText = getProfileFeedSearchText(item);

      if (!typeText.includes(selectedType)) {
        return false;
      }
    }

    if (telegramOnly && !cleanTelegram(item.authorTelegram)) {
      return false;
    }

    return true;
  });

  return items;
}

function formatProfileFeedDate(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    return "";
  }
}

function openKlevbyProfileSafe() {
  if (typeof window.openKlevbyProfile === "function") {
    window.openKlevbyProfile();
    return;
  }

  if (typeof window.showSection === "function") {
    window.showSection("profile");
  }
}

function openProfilePhotoFeedItem(photoId) {
  const cleanId = String(photoId || "");

  if (typeof window.openProfilePhotoViewer === "function") {
    window.openProfilePhotoViewer(cleanId);
    return;
  }

  openKlevbyProfileSafe();
}

function profilePhotoCardHtml(item) {
  const safeId = escapeAttr(item?.id || "");
  const safeImage = escapeAttr(item?.image || "");
  const authorName = item?.authorName || "Рыбак";
  const authorCity = item?.authorCity || "";
  const title = item?.title || "Фото с рыбалки";
  const sizeKb = Number(item?.savedSizeKb || 0);
  const date = formatProfileFeedDate(item?.createdAt);
  const avatar = getProfileFeedAvatarSafe();
  const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";

  const avatarHtml = avatar
    ? `<span class="profile-feed-avatar-img" style="background-image: url('${escapeAttr(avatar)}');" aria-hidden="true"></span>`
    : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${escapeHtml(authorInitial)}</span>`;

  return `
    <article class="card profile-feed-card" onclick="openProfilePhotoFeedItem('${safeId}')">
      <div class="card-img profile-feed-image" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.42)), url('${safeImage}')"></div>

      <div class="card-body profile-feed-body">
        <button
          class="profile-feed-author"
          type="button"
          onclick="event.stopPropagation(); openKlevbyProfileSafe()"
          aria-label="Открыть профиль автора"
        >
          ${avatarHtml}

          <span class="profile-feed-author-text">
            <span class="profile-feed-author-name">${escapeHtml(authorName)}</span>
            <span class="profile-feed-author-action">добавил фото с рыбалки</span>
          </span>
        </button>

        <div class="trip-title profile-feed-title">
          <span class="trip-name">${escapeHtml(authorName)}</span>
          <span> добавил </span>
          <span class="trip-destination">${escapeHtml(title)}</span>
        </div>

        <p class="trip-description profile-feed-description">
          Новое фото в профиле рыбака. Нажми на карточку, чтобы открыть фото на весь экран.
        </p>

        <div class="tags profile-feed-tags">
          <span class="tag">📸 фото</span>
          <span class="tag">🎣 лента</span>
          ${authorCity ? `<span class="tag">📍 ${escapeHtml(authorCity)}</span>` : ""}
          ${sizeKb ? `<span class="tag">${escapeHtml(String(sizeKb))} КБ</span>` : ""}
          ${date ? `<span class="tag">🕒 ${escapeHtml(date)}</span>` : ""}
        </div>

        <div class="actions profile-feed-actions">
          <button class="small-btn green" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть фото</button>
          <button class="small-btn gray" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>
        </div>
      </div>
    </article>
  `;
}

function profileFeedEmptyHtml() {
  return `
    <div class="home-empty-card">
      <div class="home-empty-icon">📸</div>
      <h3>В ленте пока нет фото</h3>
      <p>Добавь первое фото в профиле — оно появится здесь как пост в ленте.</p>
      <div class="actions">
        <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
        <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
      </div>
    </div>
  `;
}

function renderProfileFeed() {
  const list = document.getElementById("profileFeedSection");
  if (!list) return;

  const items = getFilteredProfileFeedItems({});

  if (!items.length) {
    list.innerHTML = profileFeedEmptyHtml();
    return;
  }

  const cards = items
    .map((item) => {
      try {
        return profilePhotoCardHtml(item);
      } catch (error) {
        console.error("Ошибка отрисовки фото профиля:", item, error);
        return "";
      }
    })
    .filter(Boolean)
    .join("");

  list.innerHTML = cards || profileFeedEmptyHtml();
}

function refreshKlevbyFeedsIfVisible() {
  const homeSection = document.getElementById("homeSection");
  const tripsSection = document.getElementById("tripsSection");

  if (homeSection && !homeSection.classList.contains("hidden")) {
    renderProfileFeed();
  }

  if (tripsSection && !tripsSection.classList.contains("hidden")) {
    renderPosts();
  }
}

function bindProfileFeedRefreshHooks() {
  if (window.__klevbyProfileFeedRefreshBound) return;
  window.__klevbyProfileFeedRefreshBound = true;

  window.addEventListener("storage", (event) => {
    const key = String(event?.key || "");

    if (
      key === "klevby_profile_photos" ||
      key === "klevby_profile_avatar" ||
      key === "klevby_profile_settings" ||
      key === "klevby_profile_name"
    ) {
      setTimeout(refreshKlevbyFeedsIfVisible, 80);
    }
  });

  window.addEventListener("pageshow", () => {
    setTimeout(refreshKlevbyFeedsIfVisible, 120);
  });

  document.addEventListener("click", (event) => {
    const target = event.target?.closest?.(
      "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
    );

    if (!target) return;

    setTimeout(refreshKlevbyFeedsIfVisible, 180);
  });
}

function saveAuthorLocal(name, telegram) {
  localStorage.setItem("klevby_author_name", name || "");
  localStorage.setItem("klevby_author_telegram", telegram || "");
}

function getPostsSelectQuery(includeFishingType = false) {
  const columns = [
    "id",
    "created_at",
    "name",
    "city",
    "destination",
    "trip_time",
    "transport",
    "seats",
    "text",
    "telegram",
    "owner_id",
    "crew_full"
  ];

  if (includeFishingType) {
    columns.push("fishing_type");
  }

  return columns.join(",");
}

function schedulePostsLoad(delay = POSTS_LOAD_RETRY_DELAY_MS) {
  clearTimeout(postsLoadRetryTimer);

  postsLoadRetryTimer = setTimeout(() => {
    loadPosts({ force: true }).catch((error) => {
      console.warn("Klevby posts: отложенная загрузка не удалась:", error);
    });
  }, delay);
}

async function queryPostsSafe(db, retry = 0) {
  try {
    let result = await db
      .from("posts")
      .select(getPostsSelectQuery(true))
      .order("created_at", { ascending: false });

    if (result.error && String(result.error.message || "").includes("fishing_type")) {
      result = await db
        .from("posts")
        .select(getPostsSelectQuery(false))
        .order("created_at", { ascending: false });
    }

    return result;
  } catch (error) {
    if (isAuthLockError(error) && retry < POSTS_MAX_RETRIES) {
      console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", error);

      await new Promise((resolve) => {
        setTimeout(resolve, POSTS_LOAD_RETRY_DELAY_MS);
      });

      return queryPostsSafe(db, retry + 1);
    }

    throw error;
  }
}

async function loadPosts(options = {}) {
  const force = Boolean(options.force);
  const retry = Number(options.retry || 0);

  const postsSection = document.getElementById("postsSection");
  const existingPosts = getPostsArray();

  if (!force && postsLoadPromise) {
    return postsLoadPromise;
  }

  postsLoadPromise = (async function () {
    showStatusSafe("Загрузка объявлений...");

    if (postsSection && !existingPosts.length) {
      postsSection.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      `;
    }

    const db = getSupabaseClientSafe();

    if (!db) {
      showStatusSafe("Supabase ещё не готов. Повторяем загрузку объявлений...");

      if (postsSection && !existingPosts.length) {
        postsSection.innerHTML = '<div class="info-line">Supabase ещё не готов. Повторяем загрузку...</div>';
      }

      renderProfileFeed();
      schedulePostsLoad(900);
      return;
    }

    let result;

    try {
      result = await queryPostsSafe(db, retry);
    } catch (error) {
      if (isAuthLockError(error) && retry < POSTS_MAX_RETRIES) {
        console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", error);
        showStatusSafe("Supabase занят, повторяем загрузку объявлений...");
        schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
        return;
      }

      console.error("Ошибка загрузки posts:", error);

      const message = error?.message
        ? "Не удалось загрузить объявления: " + error.message
        : "Не удалось загрузить объявления. Проверь таблицу posts и RLS.";

      showStatusSafe(message, true);

      if (postsSection && !existingPosts.length) {
        postsSection.innerHTML = `
          <div class="info-line error-line">
            Не удалось загрузить объявления. Открой Console и посмотри ошибку posts.
          </div>
        `;
      }

      renderProfileFeed();
      return;
    }

    if (result.error) {
      if (isAuthLockError(result.error) && retry < POSTS_MAX_RETRIES) {
        console.warn("Klevby posts: Supabase Auth занят, повторяем загрузку:", result.error);
        showStatusSafe("Supabase занят, повторяем загрузку объявлений...");
        schedulePostsLoad(POSTS_LOAD_RETRY_DELAY_MS);
        return;
      }

      console.error("Ошибка загрузки posts:", result.error);

      const message = result.error.message
        ? "Не удалось загрузить объявления: " + result.error.message
        : "Не удалось загрузить объявления. Проверь таблицу posts и RLS.";

      showStatusSafe(message, true);

      if (postsSection && !existingPosts.length) {
        postsSection.innerHTML = `
          <div class="info-line error-line">
            Не удалось загрузить объявления. Открой Console и посмотри ошибку posts.
          </div>
        `;
      }

      renderProfileFeed();
      return;
    }

    const loadedPosts = Array.isArray(result.data) ? result.data : [];

    setPostsArray(loadedPosts);
    renderPosts();
    renderProfileFeed();
  })();

  try {
    return await postsLoadPromise;
  } finally {
    postsLoadPromise = null;
  }
}

function renderPosts() {
  const list = document.getElementById("postsSection");
  if (!list) return;

  const allPosts = getPostsArray();
  const search = normalizeText(document.getElementById("searchInput")?.value);
  const selectedCity = normalizeText(document.getElementById("citySelect")?.value);
  const selectedType = normalizeText(document.getElementById("typeSelect")?.value);
  const telegramOnly = document.getElementById("telegramOnly")?.checked;
  const ownerId = getOwnerId();
  const mode = getCurrentViewMode();

  let filtered = [...allPosts];

  if (mode === "mine") {
    filtered = filtered.filter(post => ownerId && post.owner_id === ownerId);
    showStatusSafe("Сейчас показаны: мои выезды.");
  } else {
    showStatusSafe("Сейчас показаны: все объявления о выездах.");
  }

  if (search) {
    filtered = filtered.filter(post =>
      normalizeText(post.name).includes(search) ||
      normalizeText(post.city).includes(search) ||
      normalizeText(post.destination).includes(search) ||
      normalizeText(post.trip_time).includes(search) ||
      normalizeText(post.transport).includes(search) ||
      normalizeText(post.seats).includes(search) ||
      normalizeText(post.text).includes(search) ||
      normalizeText(getPostFishingType(post)).includes(search)
    );
  }

  if (selectedCity) {
    filtered = filtered.filter(post => normalizeText(post.city).includes(selectedCity));
  }

  if (selectedType) {
    filtered = filtered.filter(post => normalizeText(getPostFishingType(post)).includes(selectedType));
  }

  if (telegramOnly) {
    filtered = filtered.filter(post => cleanTelegram(post.telegram));
  }

  if (!filtered.length) {
    const emptyText = allPosts.length
      ? "По фильтрам ничего не найдено."
      : "Пока объявлений о выездах нет.";

    list.innerHTML = `
      <div class="info-line">
        ${emptyText}
        <div style="margin-top:12px;">
          <button class="small-btn green" type="button" onclick="showSection('create')">Создать выезд</button>
        </div>
      </div>
    `;

    if (typeof window.updateHomeFloatButton === "function") {
      setTimeout(window.updateHomeFloatButton, 80);
    }

    return;
  }

  const cards = filtered
    .map((post) => {
      try {
        return cardHtml(post);
      } catch (error) {
        console.error("Ошибка отрисовки карточки объявления:", post, error);
        return "";
      }
    })
    .filter(Boolean)
    .join("");

  if (!cards) {
    list.innerHTML = `
      <div class="info-line error-line">
        Объявления загрузились, но карточки не отрисовались. Смотри Console.
      </div>
    `;
    return;
  }

  list.innerHTML = cards;

  if (typeof window.updateHomeFloatButton === "function") {
    setTimeout(window.updateHomeFloatButton, 80);
  }
}

function cardHtml(post) {
  const id = post?.id;
  const tg = cleanTelegram(post?.telegram);
  const ownerId = getOwnerId();
  const canManage = isAdminSafe() || (ownerId && post?.owner_id === ownerId);
  const isFull = Boolean(post?.crew_full);
  const image = getCardImage(post);
  const fishingType = getPostFishingType(post);
  const fishingTypeClass = getFishingTypeClass(fishingType);

  const name = post?.name || "Рыбак";
  const city = post?.city || "";
  const destination = post?.destination || "";
  const tripTime = post?.trip_time || "";
  const transport = post?.transport || "";
  const seats = post?.seats || "";
  const titleDestination = destination || city || "рыбалку";

  const safeId = escapeAttr(id);

  const tgButton = isFull
    ? `<button class="small-btn disabled" disabled onclick="event.stopPropagation()">Экипаж набран</button>`
    : tg
      ? `<button class="small-btn green" onclick="event.stopPropagation(); window.open('https://t.me/${escapeAttr(tg)}','_blank')">Написать автору</button>`
      : `<button class="small-btn green" onclick="event.stopPropagation(); openTelegramSafe()">Написать в общий чат</button>`;

  const fullBtn = canManage
    ? `<button class="small-btn ${isFull ? "gray" : "blue"}" onclick="event.stopPropagation(); toggleCrewFull('${safeId}', ${isFull ? "false" : "true"})">${isFull ? "Снова ищу" : "Экипаж набран"}</button>`
    : "";

  const editBtn = canManage
    ? `<button class="small-btn yellow" onclick="event.stopPropagation(); editPost('${safeId}')">Редактировать</button>`
    : "";

  const deleteBtn = canManage
    ? `<button class="small-btn red" onclick="event.stopPropagation(); deletePost('${safeId}')">Удалить</button>`
    : "";

  const date = post?.created_at
    ? new Date(post.created_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

  return `
    <div class="card trip-card ${isFull ? "full" : ""}" onclick="openPostModal('${safeId}')">
      <div class="card-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.35)), url('${escapeAttr(image)}')"></div>

      <div class="card-body">
        <div class="trip-title">
          <span class="trip-name">${escapeHtml(name)}</span>
          <span> едет на </span>
          <span class="trip-destination">${escapeHtml(titleDestination)}</span>
        </div>

        <div class="trip-facts">
          <div class="trip-fact">
            <div class="trip-fact-label">Когда</div>
            <div class="trip-fact-value">${escapeHtml(tripTime || date || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Тип</div>
            <div class="trip-fact-value">${escapeHtml(fishingType || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Транспорт</div>
            <div class="trip-fact-value">${escapeHtml(transport || "Не указано")}</div>
          </div>

          <div class="trip-fact">
            <div class="trip-fact-label">Места</div>
            <div class="trip-fact-value">${escapeHtml(seats || (isFull ? "Экипаж набран" : "Уточнить"))}</div>
          </div>
        </div>

        <p class="trip-description">${escapeHtml(post?.text || "")}</p>

        <div class="tags">
          <span class="tag">🎣 выезд</span>
          ${city ? `<span class="tag">📍 ${escapeHtml(city)}</span>` : ""}
          ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
          ${isFull ? '<span class="tag full">экипаж набран</span>' : ''}
          ${tg ? '<span class="tag">Telegram</span>' : ''}
          ${ownerId && post?.owner_id === ownerId ? '<span class="tag">моё</span>' : ''}
        </div>

        <div class="actions">
          ${tgButton}
          ${fullBtn}
          ${editBtn}
          ${deleteBtn}
        </div>
      </div>
    </div>
  `;
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
    alert("Не получилось изменить статус. Проверь поле crew_full и RLS.");
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

document.addEventListener("DOMContentLoaded", () => {
  bindProfileFeedRefreshHooks();

  setTimeout(renderProfileFeed, 300);
  setTimeout(refreshKlevbyFeedsIfVisible, 800);
  setTimeout(refreshKlevbyFeedsIfVisible, 1400);
});

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
window.getProfileFeedItemsSafe = getProfileFeedItemsSafe;
window.getFilteredProfileFeedItems = getFilteredProfileFeedItems;
window.openKlevbyProfileSafe = openKlevbyProfileSafe;
window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
window.renderProfileFeed = renderProfileFeed;
window.saveAuthorLocal = saveAuthorLocal;
window.loadPosts = loadPosts;
window.renderPosts = renderPosts;
window.cardHtml = cardHtml;
window.profilePhotoCardHtml = profilePhotoCardHtml;
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
