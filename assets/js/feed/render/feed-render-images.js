(function () {
  const FEED_DESKTOP_PRELOAD_LIMIT = 16;
  const FEED_DESKTOP_EAGER_LIMIT = 8;
  const FEED_DESKTOP_HIGH_PRIORITY_LIMIT = 5;

  let klevbyFeedImageWarmupTimer = null;

  function getRenderUtils() {
    return window.KlevbyFeedRenderUtils || {};
  }

  function getCache() {
    return window.KlevbyFeedRenderCache || {};
  }

  function isDesktopFeedMode() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
        return false;
      }

      return Number(window.innerWidth || 0) > 760;
    } catch (_) {
      return false;
    }
  }

  function uniqueArray(values) {
    const utils = getRenderUtils();

    if (typeof utils.uniqueArray === "function") {
      return utils.uniqueArray(values);
    }

    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function getRenderableFeedItems(items) {
    const utils = getRenderUtils();

    if (typeof utils.getRenderableFeedItems === "function") {
      const renderableItems = utils.getRenderableFeedItems(items);
      return Array.isArray(renderableItems) ? renderableItems : [];
    }

    const cache = getCache();

    if (typeof cache.getRenderableFeedItems === "function") {
      const renderableItems = cache.getRenderableFeedItems(items);
      return Array.isArray(renderableItems) ? renderableItems : [];
    }

    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      const id = String(item?.id || "").trim();
      const image = String(item?.image || item?.imageUrl || "").trim();

      return Boolean(id && image);
    });
  }

  function getItemImage(item) {
    const utils = getRenderUtils();

    if (typeof utils.getItemImage === "function") {
      return utils.getItemImage(item);
    }

    return String(item?.image || item?.imageUrl || "").trim();
  }

  function warmDesktopFeedImage(url, index = 0) {
    const imageUrl = String(url || "").trim();

    if (!imageUrl) return;

    window.__klevbyFeedPreloadedImages = window.__klevbyFeedPreloadedImages || {};

    if (window.__klevbyFeedPreloadedImages[imageUrl]) {
      return;
    }

    window.__klevbyFeedPreloadedImages[imageUrl] = true;

    try {
      const image = new Image();

      image.decoding = "async";

      if ("fetchPriority" in image) {
        image.fetchPriority = index < FEED_DESKTOP_HIGH_PRIORITY_LIMIT ? "high" : "auto";
      }

      image.src = imageUrl;

      if (typeof image.decode === "function") {
        image.decode().catch(() => {});
      }
    } catch (_) {}
  }

  function warmDesktopFeedImages(items, source = "unknown") {
    if (!isDesktopFeedMode()) return;

    const safeItems = getRenderableFeedItems(items);
    const urls = uniqueArray(
      safeItems
        .slice(0, FEED_DESKTOP_PRELOAD_LIMIT)
        .map(getItemImage)
    );

    if (!urls.length) return;

    if (klevbyFeedImageWarmupTimer) {
      clearTimeout(klevbyFeedImageWarmupTimer);
      klevbyFeedImageWarmupTimer = null;
    }

    const delay = source === "cache" || source === "memory" ? 20 : 80;

    klevbyFeedImageWarmupTimer = setTimeout(() => {
      klevbyFeedImageWarmupTimer = null;

      urls.forEach((url, index) => {
        warmDesktopFeedImage(url, index);
      });
    }, delay);
  }

  function shouldUseDesktopImageElement() {
    return isDesktopFeedMode();
  }

  function getImageLoadingForIndex(index = 0) {
    return isDesktopFeedMode() && Number(index || 0) < FEED_DESKTOP_EAGER_LIMIT
      ? "eager"
      : "lazy";
  }

  function getImageFetchPriorityForIndex(index = 0) {
    return isDesktopFeedMode() && Number(index || 0) < FEED_DESKTOP_HIGH_PRIORITY_LIMIT
      ? "high"
      : "auto";
  }

  window.KlevbyFeedRenderImages = {
    FEED_DESKTOP_PRELOAD_LIMIT,
    FEED_DESKTOP_EAGER_LIMIT,
    FEED_DESKTOP_HIGH_PRIORITY_LIMIT,
    isDesktopFeedMode,
    shouldUseDesktopImageElement,
    getImageLoadingForIndex,
    getImageFetchPriorityForIndex,
    warmDesktopFeedImage,
    warmDesktopFeedImages
  };
})();
