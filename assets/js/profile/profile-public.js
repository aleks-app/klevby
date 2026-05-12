(function () {
  const PUBLIC_MODE_CLASS = "klevby-profile-public-mode";
  const PUBLIC_BLOCK_ID = "klevbyPublicProfileBlock";
  const PUBLIC_VIEWED_USER_KEY = "";

  const state = {
    viewedUserId: null
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCurrentUser() {
    try {
      const core = window.KlevbyProfileCore || null;
      if (core && typeof core.getCurrentProfileUser === "function") {
        return core.getCurrentProfileUser() || null;
      }
    } catch (_) {}

    return window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;
  }

  function isOwnProfile(userId) {
    const cleanId = String(userId || "").trim();
    if (!cleanId) return false;
    const currentUser = getCurrentUser();
    return Boolean(currentUser?.id && String(currentUser.id) === cleanId);
  }

  function getFeedClient() {
    try {
      const core = window.KlevbyFeedSupabaseCore || null;
      if (core && typeof core.getClient === "function") {
        return core.getClient() || null;
      }
    } catch (_) {}
    return window.supabaseClient || null;
  }

  function ensurePublicProfileStyles() {
    if (document.getElementById("klevby-public-profile-inline-style")) return;
    const style = document.createElement("style");
    style.id = "klevby-public-profile-inline-style";
    style.textContent = `
      #${PUBLIC_BLOCK_ID}{margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(0,0,0,.14)}
      #${PUBLIC_BLOCK_ID} .kpp-head{display:flex;gap:12px;align-items:center;margin-bottom:12px}
      #${PUBLIC_BLOCK_ID} .kpp-avatar{width:56px;height:56px;border-radius:50%;background:#2f3f4f center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
      #${PUBLIC_BLOCK_ID} .kpp-name{font-size:18px;font-weight:700}
      #${PUBLIC_BLOCK_ID} .kpp-sub{opacity:.85;font-size:13px}
      #${PUBLIC_BLOCK_ID} .kpp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
      #${PUBLIC_BLOCK_ID} .kpp-photo{display:block;width:100%;aspect-ratio:1/1;border-radius:10px;background:#21313f center/cover no-repeat}
      #${PUBLIC_BLOCK_ID} .kpp-empty{opacity:.85;font-size:14px;padding:10px 0}
      html.klevby-profile-public-mode #profileSection .profile-shell{display:none !important}
    `;
    document.head.appendChild(style);
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
    const cleanId = String(userId || "").trim();
    if (!cleanId) return null;
    const client = getFeedClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("profiles")
        .select("id,username,display_name,nickname,name,avatar_url,city,telegram")
        .eq("id", cleanId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("[KlevbyProfilePublic] profiles load failed", error);
      return null;
    }
  }

  async function loadPublicProfilePhotos(userId) {
    const cleanId = String(userId || "").trim();
    if (!cleanId) return [];
    const client = getFeedClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("feed_posts")
        .select("id,user_id,type,author_name,author_city,author_avatar_url,caption,image_url,image_path,image_width,image_height,image_size_kb,created_at,likes_count,comments_count")
        .eq("user_id", cleanId)
        .eq("type", "profile_photo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("[KlevbyProfilePublic] feed_posts load failed", error);
      return [];
    }
  }

  function renderPublicProfile(profileData, photos) {
    const block = getOrCreatePublicBlock();
    if (!block) return;

    const displayName = String(
      profileData?.display_name || profileData?.nickname || profileData?.name || profileData?.username || "Рыбак"
    ).trim() || "Рыбак";
    const city = String(profileData?.city || "").trim();
    const avatarUrl = String(profileData?.avatar_url || "").trim();
    const initial = displayName.charAt(0).toUpperCase() || "Р";

    const photosHtml = Array.isArray(photos) && photos.length
      ? `<div class="kpp-grid">${photos.map((photo) => {
        const url = String(photo?.image_url || "").trim();
        if (!url) return "";
        return `<span class="kpp-photo" style="background-image:url('${escapeHtml(url)}')" title="${escapeHtml(photo?.caption || "Фото с рыбалки")}"></span>`;
      }).join("")}</div>`
      : `<div class="kpp-empty">У этого рыбака пока нет опубликованных фото в ленте.</div>`;

    block.innerHTML = `
      <div class="kpp-head">
        <div class="kpp-avatar"${avatarUrl ? ` style="background-image:url('${escapeHtml(avatarUrl)}')"` : ""}>${avatarUrl ? "" : escapeHtml(initial)}</div>
        <div>
          <div class="kpp-name">${escapeHtml(displayName)}</div>
          <div class="kpp-sub">Публичный профиль рыбака${city ? ` • 📍 ${escapeHtml(city)}` : ""}</div>
        </div>
      </div>
      ${photosHtml}
    `;
  }

  function showProfileSection() {
    const sectionIds = ["homeSection", "tripsSection", "createSection", "marketSection", "pondsSection", "mapSection", "authSection", "profileSection"];
    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      if (id === "profileSection") section.classList.remove("hidden");
      else section.classList.add("hidden");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePublicProfileMode() {
    state.viewedUserId = null;
    document.documentElement.classList.remove(PUBLIC_MODE_CLASS);
    const block = document.getElementById(PUBLIC_BLOCK_ID);
    if (block) block.remove();
  }

  async function openKlevbyPublicProfile(userId, fallbackData = {}) {
    const cleanId = String(userId || "").trim();
    if (!cleanId || isOwnProfile(cleanId)) {
      closePublicProfileMode();
      if (typeof window.openKlevbyProfile === "function") {
        window.openKlevbyProfile();
      }
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
