(function () {
  function getSupabaseClient() {
    return window.supabaseClient || window.klevbySupabase || null;
  }

  async function getCurrentUserId() {
    try {
      const client = getSupabaseClient();
      if (!client?.auth?.getUser) return "";
      const { data } = await client.auth.getUser();
      return String(data?.user?.id || "").trim();
    } catch (_) {
      return "";
    }
  }

  function normalizePost(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      userId: row.user_id || "",
      authorName: row.author_name || "Рыбак",
      authorCity: row.author_city || "",
      authorAvatarUrl: row.author_avatar_url || "",
      imageUrl: row.image_url || "",
      image: row.image_url || "",
      caption: row.caption || "",
      createdAt: row.created_at || ""
    };
  }

  async function loadPublicProfile(userId, fallbackData = {}) {
    const cleanUserId = String(userId || "").trim();
    if (!cleanUserId) return { ok: false, error: "empty_user_id" };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "supabase_unavailable" };

    let profile = null;
    try {
      const { data } = await client
        .from("profiles")
        .select("*")
        .eq("id", cleanUserId)
        .limit(1)
        .maybeSingle();
      profile = data || null;
    } catch (_) {}

    const { data: postsRows, error: postsError } = await client
      .from("feed_posts")
      .select("id,user_id,author_name,author_city,author_avatar_url,image_url,caption,created_at")
      .eq("user_id", cleanUserId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (postsError) return { ok: false, error: postsError.message || "posts_load_failed" };

    const posts = (Array.isArray(postsRows) ? postsRows : []).map(normalizePost).filter(Boolean);
    const firstPost = posts[0] || {};

    return {
      ok: true,
      profile: {
        id: cleanUserId,
        name: String(profile?.display_name || profile?.nickname || profile?.username || profile?.name || fallbackData?.authorName || firstPost.authorName || "Рыбак").trim(),
        city: String(profile?.city || profile?.location || fallbackData?.authorCity || firstPost.authorCity || "").trim(),
        avatarUrl: String(profile?.avatar_url || profile?.author_avatar_url || fallbackData?.authorAvatarUrl || fallbackData?.authorAvatar || firstPost.authorAvatarUrl || "").trim(),
        about: String(profile?.about || profile?.bio || profile?.description || "").trim()
      },
      posts
    };
  }

  window.KlevbyPublicProfileApi = { getCurrentUserId, loadPublicProfile };
})();
