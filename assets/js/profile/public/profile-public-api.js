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
        .filter((item) => String(item?.user_id || item?.userId || item?.author_id || "") === String(userId))
        .map((item) => item?.photo || item?.image || item?.image_url || item?.photo_url || null)
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  async function getPublicProfile(userId, fallbackData) {
    const fallbackProfile = {
      user_id: userId,
      name: fallbackData?.authorName || "Рыбак",
      city: fallbackData?.authorCity || "",
      avatar_url: fallbackData?.authorAvatar || ""
    };

    try {
      const client = window.klevbySupabase;
      if (!client) return fallbackProfile;

      const request = client
        .from("public_profiles")
        .select("user_id,name,city,avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      const result = await withTimeout(request, DEFAULT_TIMEOUT_MS);
      if (result?.error || !result?.data) return fallbackProfile;

      return { ...fallbackProfile, ...result.data };
    } catch (_) {
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
        .select("photo,image,image_url,photo_url,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      const result = await withTimeout(request, DEFAULT_TIMEOUT_MS);
      if (result?.error || !Array.isArray(result?.data)) return fallbackPhotos;

      const photos = result.data
        .map((row) => row?.photo || row?.image || row?.image_url || row?.photo_url || null)
        .filter(Boolean);

      return photos.length ? photos : fallbackPhotos;
    } catch (_) {
      return fallbackPhotos;
    }
  }

  window.KlevbyPublicProfileApi = {
    getPublicProfile,
    getPublicProfilePhotos,
    readFeedFallbackPhotos
  };
})();
