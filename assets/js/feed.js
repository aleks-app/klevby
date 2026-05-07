(function () {
  const KLEVB_FEED_PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_FEED_PROFILE_SETTINGS_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";

  let klevbyFeedRenderToken = 0;
  let klevbyFeedLastItems = [];
  let klevbyFeedItemsCache = {};

  function klevbyFeedEscapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function klevbyFeedEscapeAttr(value) {
    return klevbyFeedEscapeHtml(value).replaceAll("`", "&#096;");
  }

  function klevbyFeedNormalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function klevbyFeedCleanTelegram(value) {
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

  function klevbyFeedGetCurrentUser() {
    return (
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null
    );
  }

  function klevbyFeedIsAdmin() {
    if (typeof window.isAdmin === "function") {
      try {
        return Boolean(window.isAdmin());
      } catch (error) {
        return false;
      }
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function klevbyFeedReadProfileData() {
    try {
      const raw = localStorage.getItem(KLEVB_FEED_PROFILE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const user = klevbyFeedGetCurrentUser();
      const meta = user?.user_metadata || {};

      const fallbackName =
        parsed.name ||
        localStorage.getItem(KLEVB_FEED_PROFILE_NAME_KEY) ||
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        "Рыбак";

      return {
        name: String(fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim()
      };
    } catch (error) {
      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: ""
      };
    }
  }

  function klevbyGetProfileFeedItemsSafe() {
    try {
      if (typeof window.getProfileFeedItems === "function") {
        const items = window.getProfileFeedItems();

        return Array.isArray(items)
          ? items
              .filter(Boolean)
              .map((item) => ({
                ...item,
                source: "local",
                userId: klevbyFeedGetCurrentUser()?.id || ""
              }))
          : [];
      }
    } catch (error) {
      console.warn("Klevby feed: не удалось получить локальные фото профиля", error);
    }

    return [];
  }

  function klevbyGetProfileFeedAvatarSafe() {
    try {
      return localStorage.getItem(KLEVB_FEED_PROFILE_AVATAR_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function klevbyGetProfileFeedSearchText(item) {
    return klevbyFeedNormalizeText([
      item?.type,
      item?.authorName,
      item?.authorCity,
      item?.authorTelegram,
      item?.title,
      item?.caption,
      item?.source,
      "фото",
      "рыбалка",
      "профиль",
      "отчет",
      "отчёт",
      "лента",
      "соцсеть"
    ].join(" "));
  }

  function klevbyGetFilteredProfileFeedItems(options = {}) {
    const search = klevbyFeedNormalizeText(options.search);
    const selectedCity = klevbyFeedNormalizeText(options.selectedCity);
    const selectedType = klevbyFeedNormalizeText(options.selectedType);
    const telegramOnly = Boolean(options.telegramOnly);

    let items = klevbyGetProfileFeedItemsSafe();

    items = items.filter((item) => {
      if (!item || item.type !== "profile_photo" || !item.image) {
        return false;
      }

      if (search && !klevbyGetProfileFeedSearchText(item).includes(search)) {
        return false;
      }

      if (selectedCity && !klevbyFeedNormalizeText(item.authorCity).includes(selectedCity)) {
        return false;
      }

      if (selectedType) {
        const typeText = klevbyGetProfileFeedSearchText(item);

        if (!typeText.includes(selectedType)) {
          return false;
        }
      }

      if (telegramOnly && !klevbyFeedCleanTelegram(item.authorTelegram)) {
        return false;
      }

      return true;
    });

    return items;
  }

  async function klevbyLoadSupabaseFeedItems() {
    if (!window.klevbyFeedSupabase || typeof window.klevbyFeedSupabase.loadPosts !== "function") {
      return {
        ok: false,
        items: [],
        error: new Error("feed-supabase.js ещё не готов")
      };
    }

    try {
      const result = await window.klevbyFeedSupabase.loadPosts({
        limit: 40
      });

      if (!result || !result.ok) {
        return {
          ok: false,
          items: [],
          error: result?.error || new Error("Supabase-лента не загрузилась")
        };
      }

      return {
        ok: true,
        items: Array.isArray(result.items) ? result.items.filter(Boolean) : [],
        error: null
      };
    } catch (error) {
      console.warn("Klevby feed: Supabase-лента временно недоступна", error);

      return {
        ok: false,
        items: [],
        error
      };
    }
  }

  async function klevbyGetFeedItemsForRender() {
    const supabaseResult = await klevbyLoadSupabaseFeedItems();

    if (supabaseResult.ok && supabaseResult.items.length) {
      return {
        source: "supabase",
        items: supabaseResult.items
      };
    }

    const localItems = klevbyGetFilteredProfileFeedItems({});

    if (localItems.length) {
      return {
        source: "local",
        items: localItems
      };
    }

    return {
      source: supabaseResult.ok ? "supabase_empty" : "local_empty",
      items: []
    };
  }

  function klevbyFormatProfileFeedDate(value) {
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

  function klevbyOpenKlevbyProfileSafe() {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function klevbyCanManageFeedItem(item) {
    if (!item) return false;

    if (item.source === "local") {
      return true;
    }

    const user = klevbyFeedGetCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      klevbyFeedIsAdmin() ||
      (userId && item.userId && String(userId) === String(item.userId))
    );
  }

  function klevbyProfilePhotoCardHtml(item) {
    const safeId = klevbyFeedEscapeAttr(item?.id || "");
    const safeImage = klevbyFeedEscapeAttr(item?.image || item?.imageUrl || "");
    const authorName = item?.authorName || "Рыбак";
    const authorCity = item?.authorCity || "";
    const title = item?.title || item?.caption || "Фото с рыбалки";
    const sizeKb = Number(item?.savedSizeKb || item?.imageSizeKb || 0);
    const likesCount = Number(item?.likesCount || 0);
    const commentsCount = Number(item?.commentsCount || 0);
    const viewsCount = Number(item?.viewsCount || 0);
    const date = klevbyFormatProfileFeedDate(item?.createdAt);
    const avatar = klevbyGetProfileFeedAvatarSafe();
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";
    const isSupabase = item?.source === "supabase";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${klevbyFeedEscapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${klevbyFeedEscapeHtml(authorInitial)}</span>`;

    const sourceTag = isSupabase
      ? `<span class="tag">🌐 общая лента</span>`
      : `<span class="tag">📱 локально</span>`;

    const likeButton = isSupabase
      ? `<button class="small-btn gray" onclick="event.stopPropagation(); toggleFeedLike('${safeId}')">👍 ${likesCount}</button>`
      : `<button class="small-btn gray" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>`;

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
              <span class="profile-feed-author-name">${klevbyFeedEscapeHtml(authorName)}</span>
              <span class="profile-feed-author-action">добавил фото с рыбалки</span>
            </span>
          </button>

          <div class="trip-title profile-feed-title">
            <span class="trip-name">${klevbyFeedEscapeHtml(authorName)}</span>
            <span> добавил </span>
            <span class="trip-destination">${klevbyFeedEscapeHtml(title)}</span>
          </div>

          <p class="trip-description profile-feed-description">
            Новое фото в ленте Klevby. Нажми на карточку, чтобы открыть фото на весь экран.
          </p>

          <div class="tags profile-feed-tags">
            <span class="tag">📸 фото</span>
            <span class="tag">🎣 лента</span>
            ${sourceTag}
            ${authorCity ? `<span class="tag">📍 ${klevbyFeedEscapeHtml(authorCity)}</span>` : ""}
            ${isSupabase ? `<span class="tag">👍 ${likesCount}</span>` : ""}
            ${isSupabase ? `<span class="tag">💬 ${commentsCount}</span>` : ""}
            ${isSupabase ? `<span class="tag">👁️ ${viewsCount}</span>` : ""}
            ${sizeKb ? `<span class="tag">${klevbyFeedEscapeHtml(String(sizeKb))} КБ</span>` : ""}
            ${date ? `<span class="tag">🕒 ${klevbyFeedEscapeHtml(date)}</span>` : ""}
          </div>

          <div class="actions profile-feed-actions">
            <button class="small-btn green" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть</button>
            ${likeButton}
          </div>
        </div>
      </article>
    `;
  }

  function klevbyProfileFeedEmptyHtml() {
    return `
      <div class="home-empty-card">
        <div class="home-empty-icon">📸</div>
        <h3>В ленте пока нет фото</h3>
        <p>Добавь первое фото в профиле — после следующего шага оно будет сохраняться в Supabase и станет видно всем.</p>
        <div class="actions">
          <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
          <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
        </div>
      </div>
    `;
  }

  function klevbyProfileFeedLoadingHtml() {
    return `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
  }

  async function klevbyRenderProfileFeed() {
    const list = document.getElementById("profileFeedSection");
    if (!list) return;

    const renderToken = ++klevbyFeedRenderToken;

    if (!klevbyFeedLastItems.length) {
      list.innerHTML = klevbyProfileFeedLoadingHtml();
    }

    const result = await klevbyGetFeedItemsForRender();

    if (renderToken !== klevbyFeedRenderToken) {
      return;
    }

    const items = Array.isArray(result.items) ? result.items : [];

    klevbyFeedLastItems = items;
    klevbyFeedItemsCache = {};

    items.forEach((item) => {
      if (item && item.id) {
        klevbyFeedItemsCache[String(item.id)] = item;
      }
    });

    if (!items.length) {
      list.innerHTML = klevbyProfileFeedEmptyHtml();
      return;
    }

    const cards = items
      .map((item) => {
        try {
          return klevbyProfilePhotoCardHtml(item);
        } catch (error) {
          console.error("Ошибка отрисовки фото ленты:", item, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    list.innerHTML = cards || klevbyProfileFeedEmptyHtml();
  }

  function klevbyRefreshFeedIfHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      klevbyRenderProfileFeed();
    }
  }

  function ensureKlevbyFeedPhotoViewer() {
    let viewer = document.getElementById("klevbyFeedPhotoViewer");

    if (viewer) return viewer;

    viewer = document.createElement("div");
    viewer.id = "klevbyFeedPhotoViewer";
    viewer.className = "profile-photo-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");

    viewer.innerHTML = `
      <div class="profile-photo-viewer-backdrop" onclick="closeFeedPhotoViewer()"></div>
      <div class="profile-photo-viewer-sheet">
        <button class="profile-photo-viewer-close" type="button" onclick="closeFeedPhotoViewer()" aria-label="Закрыть фото">×</button>
        <img id="klevbyFeedPhotoViewerImage" class="profile-photo-viewer-image" alt="Фото из ленты">
        <div class="profile-photo-viewer-info">
          <div>
            <strong id="klevbyFeedPhotoViewerTitle">Фото с рыбалки</strong>
            <span id="klevbyFeedPhotoViewerMeta">Лента Klevby</span>
          </div>

          <div class="profile-photo-viewer-actions">
            <button id="klevbyFeedViewerLikeBtn" type="button">👍 0</button>
            <button id="klevbyFeedViewerDeleteBtn" type="button">Удалить</button>
          </div>
        </div>
      </div>
    `;

    if (!document.getElementById("klevbyFeedPhotoViewerStyles")) {
      const style = document.createElement("style");
      style.id = "klevbyFeedPhotoViewerStyles";
      style.textContent = `
        #klevbyFeedPhotoViewer.hidden {
          display: none !important;
        }

        #klevbyFeedPhotoViewer .profile-photo-viewer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        #klevbyFeedPhotoViewer .profile-photo-viewer-actions button {
          appearance: none;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 15px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.18s ease;
        }

        #klevbyFeedViewerLikeBtn {
          border: 1px solid rgba(244,178,74,0.20);
          background: rgba(244,178,74,0.18);
          color: #fff8ea !important;
        }

        #klevbyFeedViewerDeleteBtn {
          border: 1px solid rgba(228,88,88,0.24);
          background: rgba(228,88,88,0.92);
        }

        #klevbyFeedViewerDeleteBtn.hidden,
        #klevbyFeedViewerLikeBtn.hidden {
          display: none !important;
        }

        .profile-feed-avatar-img,
        .profile-feed-avatar-fallback {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 auto;
          border: 1px solid rgba(244,178,74,0.24);
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        }

        .profile-feed-avatar-img {
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .profile-feed-avatar-fallback {
          align-items: center;
          justify-content: center;
          background: rgba(244,178,74,0.14);
          color: #fff8ea;
          font-weight: 900;
        }

        .profile-feed-author {
          appearance: none;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0;
          margin: 0 0 12px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .profile-feed-author-text {
          min-width: 0;
          display: block;
        }

        .profile-feed-author-name {
          display: block;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.2;
          color: #fff8ea;
        }

        .profile-feed-author-action {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,248,234,0.56);
        }

        .home-empty-card {
          grid-column: 1 / -1;
          width: 100%;
          padding: 22px;
          border-radius: 26px;
          border: 1px solid rgba(244,178,74,0.14);
          background:
            radial-gradient(circle at 0% 0%, rgba(244,178,74,0.14), transparent 38%),
            rgba(13, 20, 17, 0.86);
          box-shadow: 0 12px 32px rgba(0,0,0,0.34);
        }

        .home-empty-icon {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border-radius: 20px;
          background: rgba(244,178,74,0.14);
          font-size: 26px;
        }

        .home-empty-card h3 {
          margin: 0 0 8px;
          color: #fff8ea;
          font-size: 22px;
          line-height: 1.15;
          font-weight: 900;
        }

        .home-empty-card p {
          margin: 0 0 16px;
          color: rgba(255,248,234,0.66);
          font-size: 14px;
          line-height: 1.5;
          font-weight: 600;
        }
      `;

      document.body.appendChild(style);
    }

    document.body.appendChild(viewer);

    return viewer;
  }

  function klevbyOpenProfilePhotoFeedItem(photoId) {
    const cleanId = String(photoId || "");
    const cachedItem = klevbyFeedItemsCache[cleanId];

    if (cachedItem) {
      openKlevbyFeedPhotoViewer(cachedItem);
      return;
    }

    if (typeof window.openProfilePhotoViewer === "function") {
      window.openProfilePhotoViewer(cleanId);
      return;
    }

    klevbyOpenKlevbyProfileSafe();
  }

  function openKlevbyFeedPhotoViewer(item) {
    if (!item) return;

    const viewer = ensureKlevbyFeedPhotoViewer();
    const image = document.getElementById("klevbyFeedPhotoViewerImage");
    const title = document.getElementById("klevbyFeedPhotoViewerTitle");
    const meta = document.getElementById("klevbyFeedPhotoViewerMeta");
    const deleteButton = document.getElementById("klevbyFeedViewerDeleteBtn");
    const likeButton = document.getElementById("klevbyFeedViewerLikeBtn");

    const imageUrl = item.image || item.imageUrl || "";
    const titleText = item.title || item.caption || "Фото с рыбалки";
    const sizeText = item.savedSizeKb ? `${item.savedSizeKb} КБ` : "";
    const dimensionText = item.width && item.height ? `${item.width}×${item.height}` : "";
    const likesText = item.source === "supabase" ? `👍 ${Number(item.likesCount || 0)}` : "";
    const commentsText = item.source === "supabase" ? `💬 ${Number(item.commentsCount || 0)}` : "";
    const viewsText = item.source === "supabase" ? `👁️ ${Number(item.viewsCount || 0)}` : "";
    const sourceText = item.source === "supabase" ? "общая лента" : "локальное фото";

    if (image) image.src = imageUrl;
    if (title) title.textContent = titleText;

    if (meta) {
      meta.textContent = [
        sourceText,
        dimensionText,
        sizeText,
        likesText,
        commentsText,
        viewsText
      ].filter(Boolean).join(" • ");
    }

    if (deleteButton) {
      const canDelete = klevbyCanManageFeedItem(item);

      deleteButton.classList.toggle("hidden", !canDelete);
      deleteButton.onclick = () => klevbyDeleteFeedItem(item);
    }

    if (likeButton) {
      const isSupabase = item.source === "supabase";

      likeButton.classList.toggle("hidden", !isSupabase);
      likeButton.textContent = `👍 ${Number(item.likesCount || 0)}`;
      likeButton.onclick = () => klevbyToggleFeedLikeFromViewer(item.id);
    }

    viewer.classList.remove("hidden");
    document.body.classList.add("post-modal-open");

    if (item.source === "supabase" && typeof window.klevbyRegisterFeedView === "function") {
      window.klevbyRegisterFeedView(item.id).then((added) => {
        if (added) {
          setTimeout(klevbyRenderProfileFeed, 550);
        }
      });
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function closeKlevbyFeedPhotoViewer() {
    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const image = document.getElementById("klevbyFeedPhotoViewerImage");

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    document.body.classList.remove("post-modal-open");
  }

  async function klevbyDeleteFeedItem(item) {
    if (!item || !item.id) return;

    if (!confirm("Удалить фото из ленты? Это действие нельзя отменить.")) {
      return;
    }

    try {
      if (item.source === "supabase") {
        if (typeof window.klevbyDeleteFeedPostFromSupabase !== "function") {
          alert("Модуль удаления Supabase ещё не готов.");
          return;
        }

        await window.klevbyDeleteFeedPostFromSupabase(item.id, item.imagePath || "");
      } else if (typeof window.removeProfilePhoto === "function") {
        window.removeProfilePhoto(item.id);
      }

      closeKlevbyFeedPhotoViewer();
      await klevbyRenderProfileFeed();

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch (error) {
      console.error("Klevby feed: не удалось удалить фото", error);
      alert(error?.message || "Не получилось удалить фото.");
    }
  }

  async function klevbyToggleFeedLikeFromCard(postId) {
    const cleanId = String(postId || "");

    if (!cleanId) return;

    if (typeof window.klevbyToggleFeedLike !== "function") {
      alert("Лайки ещё не подключены.");
      return;
    }

    try {
      await window.klevbyToggleFeedLike(cleanId);
      await klevbyRenderProfileFeed();

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (error) {
      console.warn("Klevby feed: лайк не сработал", error);
      alert(error?.message || "Не получилось поставить лайк.");
    }
  }

  async function klevbyToggleFeedLikeFromViewer(postId) {
    await klevbyToggleFeedLikeFromCard(postId);

    const cleanId = String(postId || "");
    const updatedItem = klevbyFeedItemsCache[cleanId];

    if (updatedItem) {
      openKlevbyFeedPhotoViewer(updatedItem);
    }
  }

  function klevbyBindFeedRefreshHooks() {
    if (window.__klevbyFeedRefreshBound) return;
    window.__klevbyFeedRefreshBound = true;

    window.addEventListener("storage", (event) => {
      const key = String(event?.key || "");

      if (
        key === KLEVB_FEED_PROFILE_PHOTOS_KEY ||
        key === KLEVB_FEED_PROFILE_AVATAR_KEY ||
        key === KLEVB_FEED_PROFILE_SETTINGS_KEY ||
        key === KLEVB_FEED_PROFILE_NAME_KEY
      ) {
        setTimeout(klevbyRefreshFeedIfHomeVisible, 80);
      }
    });

    window.addEventListener("pageshow", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 120);
    });

    window.addEventListener("klevby-auth-changed", () => {
      setTimeout(klevbyRefreshFeedIfHomeVisible, 180);
    });

    window.addEventListener("klevby-feed-updated", () => {
      setTimeout(klevbyRenderProfileFeed, 220);
    });

    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        "#homeFloatBtn, #nav-home, .mobile-tab-btn, [onclick*='goHomeTop'], [onclick*='showSection'], [onclick*='setMode']"
      );

      if (!target) return;

      setTimeout(klevbyRefreshFeedIfHomeVisible, 180);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeKlevbyFeedPhotoViewer();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    klevbyBindFeedRefreshHooks();

    setTimeout(klevbyRenderProfileFeed, 350);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 900);
    setTimeout(klevbyRefreshFeedIfHomeVisible, 1600);
  });

  window.getProfileFeedItemsSafe = klevbyGetProfileFeedItemsSafe;
  window.getFilteredProfileFeedItems = klevbyGetFilteredProfileFeedItems;
  window.openKlevbyProfileSafe = klevbyOpenKlevbyProfileSafe;
  window.openProfilePhotoFeedItem = klevbyOpenProfilePhotoFeedItem;
  window.renderProfileFeed = klevbyRenderProfileFeed;
  window.profilePhotoCardHtml = klevbyProfilePhotoCardHtml;
  window.toggleFeedLike = klevbyToggleFeedLikeFromCard;
  window.closeFeedPhotoViewer = closeKlevbyFeedPhotoViewer;
})();
