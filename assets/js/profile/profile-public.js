(function () {
  const PUBLIC_MODE_CLASS = "klevby-profile-public-mode";
  const PUBLIC_BLOCK_ID = "klevbyPublicProfileBlock";

  const state = {
    viewedUserId: null,
    photos: [],
    activePhotoIndex: -1
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

  async function loadPublicProfile(userId) {
    const client = getFeedClient();
    if (!client || !userId) return null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("id,username,display_name,nickname,name,avatar_url,city,telegram")
        .eq("id", String(userId))
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("[KlevbyProfilePublic] profiles load failed", error);
      return null;
    }
  }

  async function loadPublicProfilePhotos(userId) {
    const client = getFeedClient();
    if (!client || !userId) return [];
    try {
      const { data, error } = await client
        .from("feed_posts")
        .select("id,user_id,type,author_name,author_city,author_avatar_url,caption,image_url,image_path,image_width,image_height,image_size_kb,created_at,likes_count,comments_count")
        .eq("user_id", String(userId))
        .eq("type", "profile_photo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("[KlevbyProfilePublic] feed_posts load failed", error);
      return [];
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

  function renderPublicProfile(profileData, photos) {
    const block = getOrCreatePublicBlock();
    if (!block) return;
    state.photos = Array.isArray(photos) ? photos.filter((x) => String(x?.image_url || "").trim()) : [];

    const displayName = String(profileData?.display_name || profileData?.nickname || profileData?.name || profileData?.username || "Рыбак").trim() || "Рыбак";
    const city = String(profileData?.city || "").trim();
    const avatarUrl = String(profileData?.avatar_url || "").trim();
    const initial = displayName.charAt(0).toUpperCase() || "Р";

    const gridHtml = state.photos.length
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
      btn.addEventListener("click", () => openPhotoViewer(Number(btn.dataset.kppIndex || -1)));
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

    const fromProfiles = await loadPublicProfile(cleanId);
    const profileData = {
      id: cleanId,
      display_name: fromProfiles?.display_name || fromProfiles?.nickname || fromProfiles?.name || fromProfiles?.username || fallbackData?.authorName || "Рыбак",
      name: fromProfiles?.name || fallbackData?.authorName || "Рыбак",
      avatar_url: fromProfiles?.avatar_url || fallbackData?.authorAvatarUrl || "",
      city: fromProfiles?.city || fallbackData?.authorCity || "",
      username: fromProfiles?.username || "",
      nickname: fromProfiles?.nickname || "",
      telegram: fromProfiles?.telegram || ""
    };

    const photos = await loadPublicProfilePhotos(cleanId);
    renderPublicProfile(profileData, photos);
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
