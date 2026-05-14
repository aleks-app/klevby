(function () {
  const PUBLIC_PROFILES_TABLE = "public_profiles";
  const FEED_POSTS_TABLE = "feed_posts";

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;

    if (window.KlevbyProfileCore && typeof window.KlevbyProfileCore.getProfileSupabaseClient === "function") {
      try {
        return window.KlevbyProfileCore.getProfileSupabaseClient();
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  function normalizeFallback(fallbackData = {}) {
    if (!fallbackData || typeof fallbackData !== "object") return {};

    return {
      authorName: String(fallbackData.authorName || fallbackData.display_name || "").trim(),
      authorCity: String(fallbackData.authorCity || fallbackData.city || "").trim(),
      avatarUrl: String(fallbackData.avatarUrl || fallbackData.authorAvatarUrl || "").trim()
    };
  }

  function mapPublicProfileRow(row, userId, fallbackData = {}) {
    const fallback = normalizeFallback(fallbackData);

    return {
      id: String(row?.id || userId || "").trim(),
      nickname: String(row?.nickname || "").trim(),
      username: String(row?.username || "").trim(),
      display_name: String(row?.display_name || fallback.authorName || "Рыбак").trim(),
      avatar_url: String(row?.avatar_url || fallback.avatarUrl || "").trim(),
      city: fallback.authorCity
    };
  }

  async function getPublicProfile(userId, fallbackData = {}) {
    const cleanUserId = String(userId || "").trim();
    const fallback = normalizeFallback(fallbackData);

    if (!cleanUserId) {
      return mapPublicProfileRow(null, "", fallback);
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return mapPublicProfileRow(null, cleanUserId, fallback);
    }

    try {
      const { data, error } = await supabase
        .from(PUBLIC_PROFILES_TABLE)
        .select("id,nickname,username,display_name,avatar_url")
        .eq("id", cleanUserId)
        .maybeSingle();

      if (error) {
        console.warn("Klevby public profile: public_profiles read failed", error);
        return mapPublicProfileRow(null, cleanUserId, fallback);
      }

      return mapPublicProfileRow(data, cleanUserId, fallback);
    } catch (error) {
      console.warn("Klevby public profile: getPublicProfile fallback", error);
      return mapPublicProfileRow(null, cleanUserId, fallback);
    }
  }

  function mapFeedPhoto(row) {
    return {
      id: String(row?.id || "").trim(),
      user_id: String(row?.user_id || "").trim(),
      caption: String(row?.caption || "").trim(),
      image_url: String(row?.image_url || "").trim(),
      created_at: String(row?.created_at || "").trim()
    };
  }

  async function getPublicProfilePhotos(userId) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return [];

    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from(FEED_POSTS_TABLE)
        .select("id,user_id,caption,image_url,created_at")
        .eq("user_id", cleanUserId)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        console.warn("Klevby public profile: feed_posts read failed", error);
        return [];
      }

      return Array.isArray(data)
        ? data.map(mapFeedPhoto).filter((item) => item.id && item.image_url)
        : [];
    } catch (error) {
      console.warn("Klevby public profile: getPublicProfilePhotos fallback", error);
      return [];
    }
  }

  window.KlevbyPublicProfileApi = {
    getPublicProfile,
    getPublicProfilePhotos
  };
})();
