(function () {
  const FEED_CACHE_VERSION = 3;
  const FEED_CACHE_LIMIT = 40;
  const FEED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v3";
  const FEED_LEGACY_CACHE_PREFIXES = [
    "klevby_feed_cache_v1",
    "klevby_feed_cache_v2"
  ];

  let legacyCacheCleanupDone = false;

  function getFeedCacheOwnerKey() {
    const possibleUser =
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null;

    const userId = String(possibleUser?.id || "").trim();

    if (userId) {
      return userId;
    }

    return "anon";
  }

  function uniqueArray(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function getFeedCacheReadKeys() {
    const ownerKey = getFeedCacheOwnerKey();

    return uniqueArray([
      `${FEED_CACHE_PREFIX}_${ownerKey}`,
      `${FEED_CACHE_PREFIX}_global`,
      `${FEED_CACHE_PREFIX}_anon`
    ]);
  }

  function getFeedCacheWriteKeys() {
    const ownerKey = getFeedCacheOwnerKey();

    return uniqueArray([
      `${FEED_CACHE_PREFIX}_${ownerKey}`,
      `${FEED_CACHE_PREFIX}_global`
    ]);
  }

  function removeCacheKey(cacheKey) {
    try {
      localStorage.removeItem(cacheKey);
    } catch (_) {}
  }

  function cleanupLegacyFeedCache() {
    if (legacyCacheCleanupDone) return;

    legacyCacheCleanupDone = true;

    try {
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = String(localStorage.key(i) || "");

        if (FEED_LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(removeCacheKey);

      if (keysToRemove.length) {
        console.info("Klevby feed render cache: old feed cache cleared", {
          removed: keysToRemove.length
        });
      }
    } catch (error) {
      console.debug("Klevby feed render cache: old cache cleanup skipped", {
        error: String(error?.message || error)
      });
    }
  }

  function normalizeFeedCacheItem(item) {
    if (!item || typeof item !== "object") return null;

    const id = String(item.id || "").trim();
    const image = String(item.image || item.imageUrl || "").trim();

    if (!id || !image) return null;

    const likesCount = Math.max(0, Number(item.likesCount || item.likes_count || 0) || 0);
    const commentsCount = Math.max(0, Number(item.commentsCount || item.comments_count || 0) || 0);
    const viewsCount = Math.max(0, Number(item.viewsCount || item.views_count || 0) || 0);
    const likedByViewer = Boolean(item.likedByViewer || item.viewerLiked || item.liked_by_viewer);

    return {
      id,
      source: item.source || "",
      image,
      imageUrl: item.imageUrl || item.image || "",
      imagePath: item.imagePath || item.image_path || "",
      authorName: item.authorName || item.author_name || "Рыбак",
      authorCity: item.authorCity || item.author_city || "",
      authorAvatarUrl: item.authorAvatarUrl || item.author_avatar_url || item.avatarUrl || item.avatar || "",
      avatarUrl: item.avatarUrl || item.authorAvatarUrl || item.author_avatar_url || item.avatar || "",
      avatar: item.avatar || item.avatarUrl || item.authorAvatarUrl || item.author_avatar_url || "",
      title: item.title || item.caption || "Фото с рыбалки",
      caption: item.caption || item.title || "Фото с рыбалки",
      likesCount,
      likes_count: likesCount,
      commentsCount,
      comments_count: commentsCount,
      viewsCount,
      views_count: viewsCount,
      likedByViewer,
      viewerLiked: likedByViewer,
      liked_by_viewer: likedByViewer,
      createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      updatedAt: item.updatedAt || item.updated_at || "",
      userId: item.userId || item.user_id || item.ownerId || item.owner_id || null,
      ownerId: item.ownerId || item.owner_id || item.userId || item.user_id || null
    };
  }

  function normalizeFeedCacheItems(items) {
    if (!Array.isArray(items)) return [];

    return items
      .map(normalizeFeedCacheItem)
      .filter(Boolean)
      .slice(0, FEED_CACHE_LIMIT);
  }

  function getRenderableFeedItems(items) {
    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      const id = String(item?.id || "").trim();
      const image = String(item?.image || item?.imageUrl || "").trim();

      return Boolean(id && image);
    });
  }

  function readFeedCache() {
    cleanupLegacyFeedCache();

    const cacheKeys = getFeedCacheReadKeys();

    for (const cacheKey of cacheKeys) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const version = Number(parsed?.version || 0);
        const savedAt = Number(parsed?.savedAt || 0);

        if (version !== FEED_CACHE_VERSION || !savedAt) {
          removeCacheKey(cacheKey);
          continue;
        }

        if (Date.now() - savedAt > FEED_CACHE_TTL_MS) {
          removeCacheKey(cacheKey);
          continue;
        }

        const normalized = normalizeFeedCacheItems(parsed?.items || []);

        if (normalized.length) {
          return normalized;
        }
      } catch (error) {
        removeCacheKey(cacheKey);

        console.debug("Klevby feed render cache: cache read skipped", {
          key: cacheKey,
          error: String(error?.message || error)
        });
      }
    }

    return [];
  }

  function writeFeedCache(items) {
    cleanupLegacyFeedCache();

    const normalized = normalizeFeedCacheItems(items);
    const cacheKeys = getFeedCacheWriteKeys();

    try {
      if (!normalized.length) {
        cacheKeys.forEach(removeCacheKey);
        return;
      }

      const payload = JSON.stringify({
        version: FEED_CACHE_VERSION,
        savedAt: Date.now(),
        count: normalized.length,
        items: normalized
      });

      cacheKeys.forEach((cacheKey) => {
        localStorage.setItem(cacheKey, payload);
      });
    } catch (error) {
      console.debug("Klevby feed render cache: cache write skipped", {
        error: String(error?.message || error)
      });
    }
  }

  window.KlevbyFeedRenderCache = {
    FEED_CACHE_VERSION,
    FEED_CACHE_LIMIT,
    FEED_CACHE_TTL_MS,
    FEED_CACHE_PREFIX,
    getFeedCacheOwnerKey,
    getFeedCacheReadKeys,
    getFeedCacheWriteKeys,
    cleanupLegacyFeedCache,
    normalizeFeedCacheItem,
    normalizeFeedCacheItems,
    getRenderableFeedItems,
    readFeedCache,
    writeFeedCache,
    removeCacheKey
  };

  console.info("Klevby feed render cache module loaded", {
    version: FEED_CACHE_VERSION
  });
})();
