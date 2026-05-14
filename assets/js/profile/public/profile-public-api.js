(function () {
  const DEFAULT_TIMEOUT_MS = 6000;

  function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), timeoutMs);
      })
    ]);
  }

  function readFeedFallbackPhotos(userId) {
    try {
      const feedState = window.KlevbyFeedState;
      if (!feedState || typeof feedState.getLastItems !== "function") return [];

      const items = feedState.getLastItems() || [];
      return items
        .filter((item) => String(item?.userId || item?.user_id || item?.ownerId || item?.owner_id || "") === String(userId))
        .map((item) => item?.image || item?.imageUrl || item?.image_url || item?.imagePath || item?.image_path || null)
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  async function getPublicProfile(userId, fallbackData) {
    const fallbackProfile = {
      id: userId,
      display_name: fallbackData?.authorName || "Рыбак",
      city: fallbackData?.authorCity || "",
      avatar_url: fallbackData?.avatarUrl || fallbackData?.authorAvatarUrl || ""
    };

    try {
      const client = window.klevbySupabase;
      if (!client) return fallbackProfile;

      const request = client
        .from("public_profiles")
        .select("id,nickname,username,display_name,avatar_url")
        .eq("id", userId)
        .maybeSingle();

      const result = await withTimeout(request, DEFAULT_TIMEOUT_MS);
      if (result?.error || !result?.data) {
        console.warn("[public-profile] public_profiles fallback");
        return fallbackProfile;
      }

      const row = result.data || {};
      return {
        id: row.id || userId,
        display_name: row.display_name || row.nickname || row.username || fallbackData?.authorName || "Рыбак",
        avatar_url: row.avatar_url || fallbackData?.avatarUrl || fallbackData?.authorAvatarUrl || "",
        city: fallbackData?.authorCity || ""
      };
    } catch (_) {
      console.warn("[public-profile] public_profiles timeout fallback");
      return fallbackProfile;
    }
  }

  async function getPublicProfilePhotos(userId) {
    const fallbackPhotos = readFeedFallbackPhotos(userId);

    try {
      const client = window.klevbySupabase;
      if (!client) return fallbackPhotos;

      const request = client
        .from("feed_posts")
        .select("id,user_id,caption,image_url,image_path,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);

      const result = await withTimeout(request, DEFAULT_TIMEOUT_MS);
      if (result?.error || !Array.isArray(result?.data)) {
        console.warn("[public-profile] feed_posts fallback");
        return fallbackPhotos;
      }

      const photos = result.data
        .map((row) => row?.image_url || row?.image_path || null)
        .filter(Boolean);

      return photos.length ? photos : fallbackPhotos;
    } catch (_) {
      console.warn("[public-profile] feed_posts timeout fallback");
      return fallbackPhotos;
    }
  }

  window.KlevbyPublicProfileApi = {
    getPublicProfile,
    getPublicProfilePhotos,
    readFeedFallbackPhotos
  };
})();
