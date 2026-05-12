(function () {
  const PUBLIC_MODE_CLASS = "klevby-profile-public-mode";
  const PUBLIC_BLOCK_ID = "klevbyPublicProfileBlock";

  const state = {
    viewedUserId: null,
    photos: [],
    activePhotoIndex: -1,
    requestToken: 0
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    const d = new Date(value || "");
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  }


  function withTimeout(promise, timeoutMs, fallbackValue) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallbackValue), Number(timeoutMs || 0));
      })
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }
  function getCurrentUser() {
    try {
      const core = window.KlevbyProfileCore || null;
      if (core && typeof core.getCurrentProfileUser === "function") return core.getCurrentProfileUser() || null;
    } catch (_) {}
    return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
  }

  function isOwnProfile(userId) {
    const currentUser = getCurrentUser();
    return Boolean(userId && currentUser?.id && String(currentUser.id) === String(userId));
  }

  function getFeedClient() {
    try {
      const core = window.KlevbyFeedSupabaseCore || null;
      if (core && typeof core.getClient === "function") return core.getClient() || null;
    } catch (_) {}
    return window.supabaseClient || null;
  }

  function ensurePublicProfileStyles() {
    // styles moved to assets/css/screens/profile-public.css
  }

  function getFeedStateItems() {
    try {
      const api = window.KlevbyFeedState || null;
      if (api && typeof api.getLastItems === "function") {
        return Array.isArray(api.getLastItems()) ? api.getLastItems() : [];
      }
    } catch (_) {}
    return [];
  }

  function getConfigValue(...keys) {
    for (const key of keys) {
      const value = window?.KLEVB_CONFIG?.[key] || window?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function normalizeFeedAuthorId(item) {
    return String(item?.userId || item?.user_id || item?.ownerId || item?.owner_id || "").trim();
  }

  function hasFeedImage(item) {
    return Boolean(item?.image || item?.imageUrl || item?.image_url || item?.imagePath || item?.image_path);
  }

  function getOrCreatePublicBlock() {
    const section = document.getElementById("profileSection");
    if (!section) return null;
    let block = document.getElementById(PUBLIC_BLOCK_ID);
    if (!block) {
      block = document.createElement("div");
      block.id = PUBLIC_BLOCK_ID;
      section.appendChild(block);
    }
    return block;
  }

  function isMissingProfileColumnError(error) {
    const code = String(error?.code || "").trim();
    const msg = String(error?.message || "").toLowerCase();
    return code === "42703" || msg.includes("does not exist") || msg.includes("column");
  }

  async function loadPublicProfile(userId) {
    const client = getFeedClient();
    if (!client || !userId) return null;

    const selectVariants = [
      "id,username,display_name,nickname,avatar_url,city,telegram",
      "id,username,nickname,avatar_url,city,telegram",
      "id,avatar_url,city,telegram",
      "id,avatar_url"
    ];

    for (const selectColumns of selectVariants) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select(selectColumns)
          .eq("id", String(userId))
          .maybeSingle();

        if (error) {
          if (isMissingProfileColumnError(error)) {
            console.debug("[KlevbyProfilePublic] profiles select fallback", {
              selectColumns,
              code: error?.code || null
            });
            continue;
          }
          console.warn("[KlevbyProfilePublic] profiles load failed", error);
          return null;
        }

        return data || null;
      } catch (error) {
        if (isMissingProfileColumnError(error)) {
          console.debug("[KlevbyProfilePublic] profiles select fallback (catch)", {
            selectColumns,
            code: error?.code || null
          });
          continue;
        }
        console.warn("[KlevbyProfilePublic] profiles load failed", error);
        return null;
      }
    }

    return null;
  }


  async function loadPublicProfilePhotos(userId, fallbackData = {}) {
    const cleanId = String(userId || "").trim();
    const sourcePostId = String(fallbackData?.sourcePostId || "").trim();
    const sourceUserId = String(fallbackData?.sourceUserId || "").trim();
    const fallbackAuthorName = String(fallbackData?.authorName || "").trim().toLowerCase();

    const feedStateItems = getFeedStateItems();
    let feedAuthorId = cleanId || sourceUserId;
    let sourcePost = null;

    if (sourcePostId && feedStateItems.length) {
      sourcePost = feedStateItems.find((item) => String(item?.id || "") === sourcePostId) || null;
      const sourcePostAuthorId = normalizeFeedAuthorId(sourcePost);
      if (sourcePostAuthorId) {
        feedAuthorId = sourcePostAuthorId;
      }
    }

    console.group("[KlevbyProfilePublic diagnostic]");
    console.log("selectedUserId", cleanId);
    console.log("fallbackData", fallbackData);
    console.log("resolvedFeedAuthorId", feedAuthorId);
    console.log("feed cache items count", feedStateItems.length);
    console.table(feedStateItems.slice(0, 10).map((item) => ({
      id: item?.id,
      userId: item?.userId,
      user_id: item?.user_id,
      ownerId: item?.ownerId,
      owner_id: item?.owner_id,
      type: item?.type,
      authorName: item?.authorName,
      author_name: item?.author_name,
      image: item?.image,
      imageUrl: item?.imageUrl,
      image_url: item?.image_url,
      imagePath: item?.imagePath,
      image_path: item?.image_path
    })));

    if (feedStateItems.length && feedAuthorId) {
      const matched = feedStateItems.filter((item) => normalizeFeedAuthorId(item) === feedAuthorId && hasFeedImage(item));
      console.log("matched photos count", matched.length);
      console.table(matched.map((item) => ({
        id: item?.id,
        userId: item?.userId,
        user_id: item?.user_id,
        type: item?.type,
        authorName: item?.authorName,
        author_name: item?.author_name,
        image: item?.image,
        imageUrl: item?.imageUrl,
        image_url: item?.image_url,
        imagePath: item?.imagePath,
        image_path: item?.image_path
      })));
      if (matched.length) {
        console.groupEnd();
        return { status: "ok", photos: matched, authorId: feedAuthorId };
      }
    }

    const supabaseUrl = getConfigValue("supabaseUrl", "SUPABASE_URL");
    const supabaseAnonKey = getConfigValue("supabaseAnonKey", "SUPABASE_ANON_KEY", "anonKey");
    if (supabaseUrl && supabaseAnonKey && feedAuthorId) {
      try {
        const params = new URLSearchParams();
        params.set("select", "id,user_id,type,author_name,author_city,author_avatar_url,caption,image_url,image_path,image_width,image_height,image_size_kb,created_at,likes_count,comments_count");
        params.set("user_id", `eq.${feedAuthorId}`);
        params.set("order", "created_at.desc");
        const response = await fetch(`${supabaseUrl}/rest/v1/feed_posts?${params.toString()}`, {
          headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
        });
        if (response.ok) {
          const rows = await response.json();
          console.log("REST rows count", Array.isArray(rows) ? rows.length : 0);
          console.table((Array.isArray(rows) ? rows : []).slice(0, 10).map((row) => ({
            id: row?.id,
            user_id: row?.user_id,
            type: row?.type,
            author_name: row?.author_name,
            author_city: row?.author_city,
            image_url: row?.image_url,
            image_path: row?.image_path,
            caption: row?.caption,
            created_at: row?.created_at
          })));
          const filtered = (Array.isArray(rows) ? rows : []).filter((row) => hasFeedImage(row));
          if (filtered.length) {
            console.groupEnd();
            return { status: "ok", photos: filtered, authorId: feedAuthorId };
          }
        }
      } catch (_) {}
    }

    const client = getFeedClient();
    if (!client) {
      console.groupEnd();
      return { status: "error", photos: [], reason: "client_missing" };
    }
    try {
      const { data, error } = await client
        .from("feed_posts")
        .select("id,user_id,type,author_name,author_city,author_avatar_url,caption,image_url,image_path,image_width,image_height,image_size_kb,created_at,likes_count,comments_count")
        .eq("user_id", feedAuthorId || cleanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const sdkRows = Array.isArray(data) ? data : [];
      const filtered = sdkRows.filter((row) => hasFeedImage(row));
      if (filtered.length) {
        console.groupEnd();
        return { status: "ok", photos: filtered, authorId: feedAuthorId || cleanId };
      }

      if (fallbackAuthorName && feedStateItems.length) {
        const nameMatched = feedStateItems.filter((item) => String(item?.authorName || item?.author_name || "").trim().toLowerCase() === fallbackAuthorName && hasFeedImage(item));
        if (nameMatched.length) {
          console.groupEnd();
          return { status: "ok", photos: nameMatched, authorId: "author_name_fallback" };
        }
      }

      console.groupEnd();
      return { status: "empty", photos: [], authorId: feedAuthorId || cleanId };
    } catch (error) {
      console.warn("[KlevbyProfilePublic] feed_posts load failed", error);
      console.groupEnd();
      return { status: "error", photos: [], reason: String(error?.message || error) };
    }
  }


  function closePhotoViewer() {
    const node = document.getElementById("kppPhotoViewer");
    if (node) node.remove();
    state.activePhotoIndex = -1;
  }

  function openPhotoViewer(index) {
    const photo = state.photos[index];
    if (!photo) return;
    closePhotoViewer();
    state.activePhotoIndex = index;

    const viewer = document.createElement("div");
    viewer.id = "kppPhotoViewer";
    viewer.className = "kpp-viewer";
    viewer.innerHTML = `
      <div class="kpp-viewer-inner">
        <button class="kpp-viewer-close" type="button" aria-label="Закрыть">Закрыть</button>
        <img class="kpp-viewer-img" src="${escapeHtml(photo.image_url || "")}" alt="Фото рыбака">
        <div class="kpp-viewer-caption">${escapeHtml(photo.caption || "Фото с рыбалки")}</div>
        <div class="kpp-viewer-date">${escapeHtml(formatDate(photo.created_at) || "")}</div>
      </div>
    `;
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) closePhotoViewer();
    });
    viewer.querySelector(".kpp-viewer-close")?.addEventListener("click", closePhotoViewer);
    document.body.appendChild(viewer);
  }

  function renderPublicProfile(profileData, photos, options = {}) {
    const block = getOrCreatePublicBlock();
    if (!block) return;
    const loadingPhotos = Boolean(options?.loadingPhotos);
    const photosLoadState = String(options?.photosLoadState || "ok");
    state.photos = Array.isArray(photos) ? photos.filter((x) => String(x?.image_url || "").trim()) : [];

    const displayName = String(profileData?.display_name || profileData?.nickname || profileData?.name || profileData?.username || "Рыбак").trim() || "Рыбак";
    const city = String(profileData?.city || "").trim();
    const avatarUrl = String(profileData?.avatar_url || "").trim();
    const initial = displayName.charAt(0).toUpperCase() || "Р";

    const gridHtml = loadingPhotos
      ? `<div class="kpp-empty">Загружаем фото…</div>`
      : (photosLoadState === "timeout" || photosLoadState === "error")
      ? `<div class="kpp-empty">Не удалось обновить фото. Попробуйте открыть профиль ещё раз.</div>`
      : state.photos.length
      ? `<div class="kpp-grid">${state.photos.map((photo, index) => `
          <button class="kpp-photo-btn" type="button" data-kpp-index="${index}" aria-label="Открыть фото ${index + 1}">
            <img src="${escapeHtml(photo.image_url || "")}" alt="Фото рыбака" loading="lazy">
            <span class="kpp-photo-meta">${escapeHtml(formatDate(photo.created_at) || "Фото")}</span>
          </button>
        `).join("")}</div>`
      : `<div class="kpp-empty">У этого рыбака пока нет опубликованных фото в ленте.</div>`;

    block.innerHTML = `
      <section class="kpp-card" aria-label="Публичный профиль">
        <div class="kpp-header">
          <div class="kpp-avatar"${avatarUrl ? ` style="background-image:url('${escapeHtml(avatarUrl)}')"` : ""}>${avatarUrl ? "" : escapeHtml(initial)}</div>
          <div>
            <div class="kpp-name">${escapeHtml(displayName)}</div>
            <div class="kpp-sub">Публичный профиль рыбака${city ? ` • 📍 ${escapeHtml(city)}` : ""}</div>
          </div>
        </div>
        <div class="kpp-stats">
          <div class="kpp-stat"><span class="kpp-stat-label">Фото</span><span class="kpp-stat-val">${state.photos.length}</span></div>
        </div>
        <h3 class="kpp-photos-title">Фото рыбака</h3>
        ${gridHtml}
      </section>
    `;

    block.querySelectorAll("[data-kpp-index]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPhotoViewer(Number(btn.dataset.kppIndex || -1));
      });
    });
  }

  function showProfileSection() {
    ["homeSection", "tripsSection", "createSection", "marketSection", "pondsSection", "mapSection", "authSection", "profileSection"].forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      if (id === "profileSection") section.classList.remove("hidden"); else section.classList.add("hidden");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePublicProfileMode() {
    state.viewedUserId = null;
    state.photos = [];
    state.requestToken = 0;
    closePhotoViewer();
    document.documentElement.classList.remove(PUBLIC_MODE_CLASS);
    const block = document.getElementById(PUBLIC_BLOCK_ID);
    if (block) block.remove();
  }

  async function openKlevbyPublicProfile(userId, fallbackData = {}) {
    const cleanId = String(userId || "").trim();
    if (!cleanId || isOwnProfile(cleanId)) {
      closePublicProfileMode();
      if (typeof window.openKlevbyProfile === "function") window.openKlevbyProfile();
      return;
    }

    ensurePublicProfileStyles();
    showProfileSection();
    document.documentElement.classList.add(PUBLIC_MODE_CLASS);
    state.viewedUserId = cleanId;

    const requestToken = Date.now();
    state.requestToken = requestToken;

    const fallbackProfileData = {
      id: cleanId,
      display_name: fallbackData?.authorName || "Рыбак",
      avatar_url: fallbackData?.authorAvatarUrl || "",
      city: fallbackData?.authorCity || "",
      username: "",
      nickname: "",
      telegram: ""
    };

    renderPublicProfile(fallbackProfileData, [], { loadingPhotos: true });

    const fromProfiles = await withTimeout(loadPublicProfile(cleanId), 3000, null);
    if (state.requestToken !== requestToken || state.viewedUserId !== cleanId) return;

    const profileData = {
      id: cleanId,
      display_name: fromProfiles?.display_name || fromProfiles?.nickname || fromProfiles?.username || fallbackData?.authorName || "Рыбак",
      avatar_url: fromProfiles?.avatar_url || fallbackData?.authorAvatarUrl || "",
      city: fromProfiles?.city || fallbackData?.authorCity || "",
      username: fromProfiles?.username || "",
      nickname: fromProfiles?.nickname || "",
      telegram: fromProfiles?.telegram || ""
    };

    renderPublicProfile(profileData, [], { loadingPhotos: true });

    const photosResult = await withTimeout(loadPublicProfilePhotos(cleanId, fallbackData), 5000, { status: "timeout", photos: [] });
    if (state.requestToken !== requestToken || state.viewedUserId !== cleanId) return;

    const safeResult = photosResult && typeof photosResult === "object" ? photosResult : { status: "error", photos: [] };
    renderPublicProfile(profileData, safeResult.photos || [], { loadingPhotos: false, photosLoadState: safeResult.status || "error" });
  }

  window.KlevbyProfilePublic = {
    openKlevbyPublicProfile,
    loadPublicProfile,
    loadPublicProfilePhotos,
    renderPublicProfile,
    closePublicProfileMode,
    isOwnProfile
  };

  window.openKlevbyPublicProfile = function (userId, fallbackData) {
    return openKlevbyPublicProfile(userId, fallbackData || {});
  };
})();
