(function () {
  let klevbyFeedRenderRetryTimer = null;
  let klevbyFeedRenderRetryCount = 0;
  let klevbyFeedImageWarmupTimer = null;
  let klevbyFeedMobileWidthLockBound = false;
  let klevbyFeedMobileWidthLockTimer = null;
  let klevbyFeedLegacyCacheCleanupDone = false;
  let klevbyFeedLikeTapFlashBound = false;
  let klevbyFeedRenderStylesModuleLoading = false;

  const klevbyFeedLikeTapFlashTimers = new WeakMap();

  const FEED_RENDER_RETRY_DELAYS = [300, 800, 1600, 3000, 5500, 9000];
  const FEED_RENDER_MAX_RETRIES = FEED_RENDER_RETRY_DELAYS.length;

  const FEED_DESKTOP_PRELOAD_LIMIT = 16;
  const FEED_DESKTOP_EAGER_LIMIT = 8;
  const FEED_DESKTOP_HIGH_PRIORITY_LIMIT = 5;
  const FEED_RENDER_STYLES_MODULE_SRC = "/assets/js/feed/render/feed-render-styles.js?v=20260510-feed-render-styles-1";

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function escapeHtml(value) {
    const utils = getUtils();

    if (typeof utils.escapeHtml === "function") {
      return utils.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    const utils = getUtils();

    if (typeof utils.escapeAttr === "function") {
      return utils.escapeAttr(value);
    }

    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function formatDate(value) {
    const utils = getUtils();

    if (typeof utils.formatDate === "function") {
      return utils.formatDate(value);
    }

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

  function getAvatar(item = null) {
    const utils = getUtils();

    if (typeof utils.getProfileFeedAvatarSafe === "function") {
      return utils.getProfileFeedAvatarSafe(item);
    }

    return "";
  }

  function setLastItems(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
      return;
    }

    window.__klevbyFeedLastItems = safeItems;
  }

  function setItemsCacheFromArray(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setItemsCacheFromArray === "function") {
      state.setItemsCacheFromArray(safeItems);
      return;
    }

    const cache = {};

    safeItems.forEach((item) => {
      if (item && item.id) {
        cache[String(item.id)] = item;
      }
    });

    window.__klevbyFeedItemsCache = cache;
  }

  function getLastItems() {
    const state = getState();

    if (typeof state.getLastItems === "function") {
      const items = state.getLastItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function nextRenderToken() {
    const state = getState();

    if (typeof state.nextRenderToken === "function") {
      return state.nextRenderToken();
    }

    window.__klevbyFeedRenderToken = Number(window.__klevbyFeedRenderToken || 0) + 1;
    return window.__klevbyFeedRenderToken;
  }

  function getRenderToken() {
    const state = getState();

    if (typeof state.getRenderToken === "function") {
      return state.getRenderToken();
    }

    return Number(window.__klevbyFeedRenderToken || 0);
  }

  const FEED_CACHE_VERSION = 3;
  const FEED_CACHE_LIMIT = 40;
  const FEED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const FEED_CACHE_PREFIX = "klevby_feed_cache_v3";
  const FEED_LEGACY_CACHE_PREFIXES = [
    "klevby_feed_cache_v1",
    "klevby_feed_cache_v2"
  ];

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

  function cleanupLegacyFeedCache() {
    if (klevbyFeedLegacyCacheCleanupDone) return;

    klevbyFeedLegacyCacheCleanupDone = true;

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
        console.info("Klevby feed render: old feed cache cleared", {
          removed: keysToRemove.length
        });
      }
    } catch (error) {
      console.debug("Klevby feed render: old cache cleanup skipped", {
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

  function removeCacheKey(cacheKey) {
    try {
      localStorage.removeItem(cacheKey);
    } catch (_) {}
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

        console.debug("Klevby feed render: cache read skipped", {
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
      console.debug("Klevby feed render: cache write skipped", {
        error: String(error?.message || error)
      });
    }
  }

  function resetRenderRetry() {
    klevbyFeedRenderRetryCount = 0;

    if (klevbyFeedRenderRetryTimer) {
      clearTimeout(klevbyFeedRenderRetryTimer);
      klevbyFeedRenderRetryTimer = null;
    }
  }

  function scheduleRenderRetry(reason = "retry", customDelay = null) {
    if (klevbyFeedRenderRetryCount >= FEED_RENDER_MAX_RETRIES) {
      return;
    }

    if (klevbyFeedRenderRetryTimer) {
      clearTimeout(klevbyFeedRenderRetryTimer);
      klevbyFeedRenderRetryTimer = null;
    }

    const delayIndex = Math.min(klevbyFeedRenderRetryCount, FEED_RENDER_RETRY_DELAYS.length - 1);
    const delay = customDelay === null
      ? FEED_RENDER_RETRY_DELAYS[delayIndex]
      : Math.max(0, Number(customDelay || 0));

    klevbyFeedRenderRetryCount += 1;

    klevbyFeedRenderRetryTimer = setTimeout(() => {
      klevbyFeedRenderRetryTimer = null;

      const list = document.getElementById("profileFeedSection");

      if (!list) return;
      if (document.visibilityState === "hidden") return;

      console.info("Klevby feed render: retry", {
        reason,
        attempt: klevbyFeedRenderRetryCount
      });

      renderProfileFeed();
    }, delay);
  }

  function cssEscape(value) {
    const cleanValue = String(value || "");

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(cleanValue);
    }

    return cleanValue.replace(/["\\]/g, "\\$&");
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

  function isMobileFeedMode() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
        return true;
      }

      return Number(window.innerWidth || 0) <= 760;
    } catch (_) {
      return false;
    }
  }

  function lockMobileHorizontalScroll() {
    const html = document.documentElement;
    const body = document.body;

    if (!html || !body) return;

    if (!isMobileFeedMode()) {
      html.classList.remove("klevby-feed-mobile-lock");
      body.classList.remove("klevby-feed-mobile-lock");
      return;
    }

    html.classList.add("klevby-feed-mobile-lock");
    body.classList.add("klevby-feed-mobile-lock");

    const scrollingElement = document.scrollingElement || html;
    const currentTop = Number(
      window.scrollY ||
      scrollingElement.scrollTop ||
      body.scrollTop ||
      html.scrollTop ||
      0
    );

    const nodes = [
      scrollingElement,
      html,
      body,
      document.getElementById("homeSection"),
      document.getElementById("profileFeedSection"),
      document.querySelector(".social-feed-grid"),
      document.querySelector(".app-shell"),
      document.querySelector(".main-shell"),
      document.querySelector("main")
    ].filter(Boolean);

    nodes.forEach((node) => {
      try {
        if (Number(node.scrollLeft || 0) !== 0) {
          node.scrollLeft = 0;
        }
      } catch (_) {}
    });

    try {
      if (Number(window.scrollX || 0) !== 0) {
        window.scrollTo(0, currentTop);
      }
    } catch (_) {}
  }

  function scheduleMobileFeedWidthLock(reason = "scheduled", delay = 0) {
    if (!isMobileFeedMode()) {
      lockMobileHorizontalScroll();
      return;
    }

    if (klevbyFeedMobileWidthLockTimer) {
      clearTimeout(klevbyFeedMobileWidthLockTimer);
      klevbyFeedMobileWidthLockTimer = null;
    }

    klevbyFeedMobileWidthLockTimer = setTimeout(() => {
      klevbyFeedMobileWidthLockTimer = null;
      lockMobileHorizontalScroll();
    }, Math.max(0, Number(delay || 0)));
  }

  function runMobileFeedWidthLockBurst(reason = "burst") {
    if (!isMobileFeedMode()) {
      lockMobileHorizontalScroll();
      return;
    }

    [0, 80, 260, 700, 1300].forEach((delay) => {
      setTimeout(() => {
        lockMobileHorizontalScroll();
      }, delay);
    });
  }

  function bindMobileFeedWidthLock() {
    if (klevbyFeedMobileWidthLockBound) return;

    klevbyFeedMobileWidthLockBound = true;

    window.addEventListener("resize", () => {
      runMobileFeedWidthLockBurst("resize");
    }, {
      passive: true
    });

    window.addEventListener("orientationchange", () => {
      runMobileFeedWidthLockBurst("orientationchange");
    }, {
      passive: true
    });

    window.addEventListener("pageshow", () => {
      runMobileFeedWidthLockBurst("pageshow");
    }, {
      passive: true
    });

    window.addEventListener("focus", () => {
      runMobileFeedWidthLockBurst("focus");
    }, {
      passive: true
    });

    window.addEventListener("klevby-app-resumed", () => {
      runMobileFeedWidthLockBurst("klevby_app_resumed");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        runMobileFeedWidthLockBurst("visibility_visible");
      }
    });

    window.addEventListener("scroll", () => {
      if (!isMobileFeedMode()) return;

      if (Number(window.scrollX || 0) !== 0) {
        scheduleMobileFeedWidthLock("window_scroll_x", 0);
      }
    }, {
      passive: true
    });
  }

  function triggerLikeTapFlash(button) {
    if (!button || !button.classList) return;

    const oldTimer = klevbyFeedLikeTapFlashTimers.get(button);

    if (oldTimer) {
      clearTimeout(oldTimer);
      klevbyFeedLikeTapFlashTimers.delete(button);
    }

    button.classList.remove("klevby-like-tap-flash");

    try {
      void button.offsetWidth;
    } catch (_) {}

    button.classList.add("klevby-like-tap-flash");

    const timer = setTimeout(() => {
      button.classList.remove("klevby-like-tap-flash");
      klevbyFeedLikeTapFlashTimers.delete(button);

      try {
        button.blur();
      } catch (_) {}
    }, 150);

    klevbyFeedLikeTapFlashTimers.set(button, timer);
  }

  function bindLikeTapFlash() {
    if (klevbyFeedLikeTapFlashBound) return;

    klevbyFeedLikeTapFlashBound = true;

    const handlePress = (event) => {
      const button = event.target?.closest?.(".profile-feed-like-btn");

      if (!button) return;

      triggerLikeTapFlash(button);
    };

    if (window.PointerEvent) {
      document.addEventListener("pointerdown", handlePress, {
        passive: true,
        capture: true
      });
    } else {
      document.addEventListener("touchstart", handlePress, {
        passive: true,
        capture: true
      });

      document.addEventListener("mousedown", handlePress, {
        passive: true,
        capture: true
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      const button = event.target?.closest?.(".profile-feed-like-btn");

      if (!button) return;

      triggerLikeTapFlash(button);
    }, {
      capture: true
    });
  }

  function hasFeedRenderStylesModuleScript() {
    try {
      return Array.from(document.scripts || []).some((script) => {
        const src = String(script?.src || "");
        const marker = String(script?.dataset?.klevbyFeedRenderStyles || "");

        return marker === "true" || src.includes("/assets/js/feed/render/feed-render-styles.js");
      });
    } catch (_) {
      return false;
    }
  }

  function loadFeedRenderStylesModule() {
    if (
      window.KlevbyFeedRenderStyles &&
      typeof window.KlevbyFeedRenderStyles.ensureFeedStyles === "function"
    ) {
      return;
    }

    if (klevbyFeedRenderStylesModuleLoading || hasFeedRenderStylesModuleScript()) {
      return;
    }

    const mountNode = document.head || document.body || document.documentElement;

    if (!mountNode) {
      setTimeout(loadFeedRenderStylesModule, 80);
      return;
    }

    klevbyFeedRenderStylesModuleLoading = true;

    const script = document.createElement("script");

    script.src = FEED_RENDER_STYLES_MODULE_SRC;
    script.defer = true;
    script.dataset.klevbyFeedRenderStyles = "true";

    script.onload = () => {
      klevbyFeedRenderStylesModuleLoading = false;
      ensureFeedStyles();
    };

    script.onerror = (error) => {
      klevbyFeedRenderStylesModuleLoading = false;

      console.warn("Klevby feed render: styles module не загрузился", {
        src: FEED_RENDER_STYLES_MODULE_SRC,
        error
      });
    };

    mountNode.appendChild(script);
  }

  function getItemId(item) {
    return String(item?.id || "").trim();
  }

  function getItemImage(item) {
    return String(item?.image || item?.imageUrl || "").trim();
  }

  function getItemTitle(item) {
    return String(item?.title || item?.caption || "Фото с рыбалки").trim();
  }

  function getItemAuthorName(item) {
    return String(item?.authorName || item?.author_name || "Рыбак").trim();
  }

  function getItemAuthorCity(item) {
    return String(item?.authorCity || item?.author_city || "").trim();
  }

  function getItemCreatedAt(item) {
    return String(item?.createdAt || item?.created_at || "").trim();
  }

  function getItemUpdatedAt(item) {
    return String(item?.updatedAt || item?.updated_at || "").trim();
  }

  function getItemLikesCount(item) {
    return Math.max(0, Number(item?.likesCount || item?.likes_count || 0) || 0);
  }

  function getItemCommentsCount(item) {
    return Math.max(0, Number(item?.commentsCount || item?.comments_count || 0) || 0);
  }

  function getItemViewsCount(item) {
    return Math.max(0, Number(item?.viewsCount || item?.views_count || 0) || 0);
  }

  function getItemLikedState(item) {
    if (!item || typeof item !== "object") return null;

    const candidates = [
      item.likedByViewer,
      item.viewerLiked,
      item.isLiked,
      item.liked,
      item.hasLiked,
      item.liked_by_viewer
    ];

    for (const value of candidates) {
      if (typeof value === "boolean") {
        return value;
      }
    }

    return null;
  }

  function signaturePart(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("|", "\\|")
      .replaceAll("\n", " ")
      .replaceAll("\r", " ");
  }

  function getFeedStructureSignature(items) {
    const safeItems = getRenderableFeedItems(items);

    return safeItems
      .map((item) => {
        return [
          getItemId(item),
          item?.source || "",
          getItemImage(item),
          item?.imagePath || item?.image_path || "",
          getItemAuthorName(item),
          getItemAuthorCity(item),
          getAvatar(item),
          getItemTitle(item),
          getItemCreatedAt(item),
          getItemUpdatedAt(item),
          item?.userId || item?.user_id || item?.ownerId || item?.owner_id || ""
        ].map(signaturePart).join("|");
      })
      .join("||");
  }

  function getFeedFullSignature(items) {
    const safeItems = getRenderableFeedItems(items);

    return safeItems
      .map((item) => {
        const likedState = getItemLikedState(item);

        return [
          getItemId(item),
          item?.source || "",
          getItemImage(item),
          item?.imagePath || item?.image_path || "",
          getItemAuthorName(item),
          getItemAuthorCity(item),
          getAvatar(item),
          getItemTitle(item),
          getItemCreatedAt(item),
          getItemUpdatedAt(item),
          getItemLikesCount(item),
          getItemCommentsCount(item),
          getItemViewsCount(item),
          typeof likedState === "boolean" ? String(likedState) : "unknown",
          item?.userId || item?.user_id || item?.ownerId || item?.owner_id || ""
        ].map(signaturePart).join("|");
      })
      .join("||");
  }

  function listHasRealContent(list) {
    return Boolean(list && list.children && list.children.length > 0);
  }

  function setListSignature(list, fullSignature, structureSignature, source) {
    if (!list) return;

    list.dataset.klevbyFeedSignature = String(fullSignature || "");
    list.dataset.klevbyFeedStructureSignature = String(structureSignature || fullSignature || "");
    list.dataset.klevbyFeedSource = String(source || "");
  }

  function setStaticListHtml(list, html, signature, source) {
    const safeSignature = String(signature || source || "static");

    if (
      listHasRealContent(list) &&
      String(list.dataset.klevbyFeedSignature || "") === safeSignature
    ) {
      return false;
    }

    list.innerHTML = html;
    setListSignature(list, safeSignature, safeSignature, source);
    scheduleMobileFeedWidthLock("static_html", 40);

    return true;
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

  function patchExistingFeedCards(list, items, fullSignature, structureSignature, source) {
    if (!list || !listHasRealContent(list)) return false;

    const safeItems = getRenderableFeedItems(items);
    const cards = Array.from(list.querySelectorAll(".profile-feed-card[data-feed-card-id]"));

    if (!safeItems.length || cards.length !== safeItems.length) {
      return false;
    }

    const currentStructure = String(list.dataset.klevbyFeedStructureSignature || "");

    if (!currentStructure || currentStructure !== structureSignature) {
      return false;
    }

    let canPatch = true;

    safeItems.forEach((item) => {
      const id = getItemId(item);
      const card = list.querySelector(`.profile-feed-card[data-feed-card-id="${cssEscape(id)}"]`);

      if (!id || !card) {
        canPatch = false;
      }
    });

    if (!canPatch) {
      return false;
    }

    safeItems.forEach((item) => {
      const id = getItemId(item);
      const likesCount = getItemLikesCount(item);
      const commentsCount = getItemCommentsCount(item);
      const likedState = getItemLikedState(item);

      const likeButton = list.querySelector(`.profile-feed-like-btn[data-feed-post-id="${cssEscape(id)}"]`);
      const commentButton = list.querySelector(`.profile-feed-comment-btn[data-feed-post-id="${cssEscape(id)}"]`);

      if (likeButton) {
        likeButton.textContent = `👍 ${likesCount}`;
        likeButton.dataset.likeCount = String(likesCount);
        likeButton.dataset.feedPostId = id;

        if (typeof likedState === "boolean") {
          likeButton.dataset.liked = likedState ? "true" : "false";
          likeButton.setAttribute("aria-pressed", likedState ? "true" : "false");
          likeButton.classList.toggle("liked", likedState);
          likeButton.classList.toggle("is-liked", likedState);
        }
      }

      if (commentButton) {
        commentButton.textContent = `💬 ${commentsCount}`;
        commentButton.dataset.commentCount = String(commentsCount);
        commentButton.dataset.feedPostId = id;
      }
    });

    setLastItems(safeItems);
    setItemsCacheFromArray(safeItems);
    setListSignature(list, fullSignature, structureSignature, source);
    scheduleMobileFeedWidthLock("patch_cards", 40);

    return true;
  }

  function renderFeedItems(list, items, source = "fresh") {
    const safeItems = getRenderableFeedItems(items);

    warmDesktopFeedImages(safeItems, source);
    setLastItems(safeItems);
    setItemsCacheFromArray(safeItems);

    if (!safeItems.length) {
      setStaticListHtml(list, emptyHtml(), "empty", "empty");
      return false;
    }

    const fullSignature = getFeedFullSignature(safeItems);
    const structureSignature = getFeedStructureSignature(safeItems);
    const currentSignature = String(list.dataset.klevbyFeedSignature || "");

    if (listHasRealContent(list) && currentSignature === fullSignature) {
      scheduleMobileFeedWidthLock("same_signature", 40);
      return true;
    }

    if (patchExistingFeedCards(list, safeItems, fullSignature, structureSignature, source)) {
      return true;
    }

    const cards = safeItems
      .map((item, index) => {
        try {
          return profilePhotoCardHtml(item, index);
        } catch (error) {
          console.error("Klevby feed render: ошибка карточки", item, error);
          return "";
        }
      })
      .filter(Boolean)
      .join("");

    setStaticListHtml(
      list,
      cards || emptyHtml(),
      cards ? fullSignature : "empty",
      source
    );

    if (cards) {
      list.dataset.klevbyFeedStructureSignature = structureSignature;
    }

    scheduleMobileFeedWidthLock("render_items", 80);

    return Boolean(cards);
  }

  function ensureFeedStyles() {
    bindMobileFeedWidthLock();
    bindLikeTapFlash();
    scheduleMobileFeedWidthLock("ensure_styles", 40);

    const externalStyles = window.KlevbyFeedRenderStyles;

    if (
      externalStyles &&
      typeof externalStyles.ensureFeedStyles === "function"
    ) {
      externalStyles.ensureFeedStyles({
        runMobileFeedWidthLockBurst
      });
      return;
    }

    loadFeedRenderStylesModule();
  }

  function profilePhotoCardHtml(item, index = 0) {
    const safeId = escapeAttr(item?.id || "");
    const safeImage = escapeAttr(item?.image || item?.imageUrl || "");
    const authorName = item?.authorName || "Рыбак";
    const authorCity = item?.authorCity || "";
    const title = item?.title || item?.caption || "Фото с рыбалки";
    const safeImageAlt = escapeAttr(title || authorName || "Фото");
    const likesCount = getItemLikesCount(item);
    const commentsCount = getItemCommentsCount(item);
    const date = formatDate(item?.createdAt);
    const avatar = getAvatar(item);
    const authorInitial = String(authorName || "Р").trim().charAt(0).toUpperCase() || "Р";
    const isSupabase = item?.source === "supabase";
    const likedState = getItemLikedState(item);
    const likedAttrs = typeof likedState === "boolean"
      ? ` data-liked="${likedState ? "true" : "false"}" aria-pressed="${likedState ? "true" : "false"}"`
      : "";

    const useDesktopImageElement = isDesktopFeedMode();
    const imageLoading = useDesktopImageElement && index < FEED_DESKTOP_EAGER_LIMIT ? "eager" : "lazy";
    const imageFetchPriority = useDesktopImageElement && index < FEED_DESKTOP_HIGH_PRIORITY_LIMIT ? "high" : "auto";
    const imageBackgroundAttr = useDesktopImageElement
      ? ""
      : ` style="background-image: url('${safeImage}')"`;
    const imageElementHtml = useDesktopImageElement
      ? `<img class="profile-feed-image-img" src="${safeImage}" alt="${safeImageAlt}" loading="${imageLoading}" decoding="async" fetchpriority="${imageFetchPriority}" draggable="false">`
      : "";
    const mobileImageBaseHtml = !useDesktopImageElement
      ? `<img class="profile-feed-mobile-image-img" src="${safeImage}" alt="${safeImageAlt}" loading="lazy" decoding="async" draggable="false">`
      : "";

    const avatarHtml = avatar
      ? `<span class="profile-feed-avatar-img" style="background-image: url('${escapeAttr(avatar)}');" aria-hidden="true"></span>`
      : `<span class="profile-feed-avatar-fallback" aria-hidden="true">${escapeHtml(authorInitial)}</span>`;

    const likeButton = isSupabase
      ? `<button class="small-btn gray profile-feed-like-btn${likedState ? " is-liked liked" : ""}" type="button" data-feed-post-id="${safeId}" data-like-count="${likesCount}"${likedAttrs} onclick="event.stopPropagation(); toggleFeedLike('${safeId}')">👍 ${likesCount}</button>`
      : "";

    const commentButton = isSupabase
      ? `<button class="small-btn gray profile-feed-comment-btn" type="button" data-feed-post-id="${safeId}" data-comment-count="${commentsCount}" onclick="event.stopPropagation(); openFeedCommentModal('${safeId}')">💬 ${commentsCount}</button>`
      : `<button class="small-btn gray profile-feed-profile-btn" type="button" onclick="event.stopPropagation(); openKlevbyProfileSafe()">Профиль</button>`;

    const authorButtonHtml = (className = "profile-feed-author") => `
          <button
            class="${className}"
            type="button"
            onclick="event.stopPropagation(); openKlevbyProfileSafe()"
            aria-label="Открыть профиль автора"
          >
            ${avatarHtml}

            <span class="profile-feed-author-text">
              <span class="profile-feed-author-name">${escapeHtml(authorName)}</span>
              <span class="profile-feed-author-action">добавил фото с рыбалки</span>
            </span>
          </button>
    `;

    return `
      <article class="card profile-feed-card" data-feed-card-id="${safeId}" onclick="openProfilePhotoFeedItem('${safeId}')">
        <div class="profile-feed-mobile-head" style="display: none;">
          ${authorButtonHtml("profile-feed-author profile-feed-author-mobile")}
        </div>

        <div class="profile-feed-media" data-feed-media="photo">
          <div class="card-img profile-feed-image"${imageBackgroundAttr}>${imageElementHtml}${mobileImageBaseHtml}</div>
        </div>

        <div class="card-body profile-feed-body">
          ${authorButtonHtml("profile-feed-author")}

          <div class="trip-title profile-feed-title">
            <span class="trip-name">${escapeHtml(authorName)}</span>
            <span> добавил </span>
            <span class="trip-destination">${escapeHtml(title)}</span>
          </div>

          <div class="tags profile-feed-tags">
            ${authorCity ? `<span class="tag">📍 ${escapeHtml(authorCity)}</span>` : ""}
            ${date ? `<span class="tag">🕒 ${escapeHtml(date)}</span>` : ""}
          </div>

          <div class="actions profile-feed-actions">
            <button class="small-btn green profile-feed-open-btn" type="button" onclick="event.stopPropagation(); openProfilePhotoFeedItem('${safeId}')">Открыть</button>
            ${likeButton}
            ${commentButton}
          </div>
        </div>
      </article>
    `;
  }

  function emptyHtml() {
    return `
      <div class="home-empty-card">
        <div class="home-empty-icon">📸</div>
        <h3>В ленте пока нет фото</h3>
        <p>Добавь первое фото в профиле — оно появится в общей ленте Klevby.</p>
        <div class="actions">
          <button class="small-btn green" type="button" onclick="openKlevbyProfileSafe()">Открыть профиль</button>
          <button class="small-btn gray" type="button" onclick="setMode('all')">Напарники</button>
        </div>
      </div>
    `;
  }

  function loadingHtml() {
    return `
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    `;
  }

  async function renderProfileFeed() {
    const list = document.getElementById("profileFeedSection");
    const api = getApi();

    if (!list) return;

    ensureFeedStyles();
    cleanupLegacyFeedCache();
    scheduleMobileFeedWidthLock("render_start", 0);

    const renderToken = nextRenderToken();
    let renderedFallback = false;
    let fallbackSource = "";

    const memoryItems = getRenderableFeedItems(getLastItems());

    if (memoryItems.length) {
      renderedFallback = renderFeedItems(list, memoryItems, "memory");
      fallbackSource = "memory";
    } else {
      const cachedItems = readFeedCache();

      if (cachedItems.length) {
        renderedFallback = renderFeedItems(list, cachedItems, "cache");
        fallbackSource = "cache";
      } else {
        setStaticListHtml(list, loadingHtml(), "loading", "loading");
      }
    }

    if (typeof api.getFeedItemsForRender !== "function") {
      console.info("Klevby feed render: api not ready, keep fallback", {
        fallback: fallbackSource || "loading"
      });

      scheduleRenderRetry("api_not_ready");
      scheduleMobileFeedWidthLock("api_not_ready", 120);
      return;
    }

    let result = {
      source: "fresh_empty",
      items: []
    };

    try {
      result = await api.getFeedItemsForRender({
        limit: 40
      });
    } catch (error) {
      console.warn("Klevby feed render: лента не загрузилась", error);

      if (!renderedFallback) {
        setStaticListHtml(list, loadingHtml(), "loading", "loading");
        scheduleRenderRetry("fresh_load_failed");
      }

      scheduleMobileFeedWidthLock("fresh_load_failed", 120);
      return;
    }

    if (renderToken !== getRenderToken()) {
      scheduleMobileFeedWidthLock("token_changed", 120);
      return;
    }

    const items = getRenderableFeedItems(result?.items || []);
    const resultSource = String(result?.source || "").toLowerCase();
    const isSupabaseAuthoritativeSource =
      resultSource === "supabase" || resultSource === "supabase_empty";

    if (!items.length) {
      if (renderedFallback) {
        console.info("Klevby feed render: fresh empty, keep fallback", {
          fallback: fallbackSource,
          source: result?.source || "unknown"
        });

        scheduleRenderRetry("fresh_empty_with_fallback", 5000);
        scheduleMobileFeedWidthLock("fresh_empty_with_fallback", 120);
        return;
      }

      setLastItems([]);
      setItemsCacheFromArray([]);
      if (isSupabaseAuthoritativeSource) {
        writeFeedCache([]);
      }
      setStaticListHtml(list, emptyHtml(), "empty", "empty");
      scheduleRenderRetry("fresh_empty_without_fallback", 5000);
      scheduleMobileFeedWidthLock("fresh_empty_without_fallback", 120);
      return;
    }

    resetRenderRetry();
    renderFeedItems(list, items, "fresh");
    if (isSupabaseAuthoritativeSource) {
      writeFeedCache(items);
    }
    runMobileFeedWidthLockBurst("render_done");
  }

  function refreshFeedIfHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    if (homeSection && !homeSection.classList.contains("hidden")) {
      renderProfileFeed();
    }
  }

  const renderer = {
    ensureFeedStyles,
    profilePhotoCardHtml,
    emptyHtml,
    loadingHtml,
    renderProfileFeed,
    refreshFeedIfHomeVisible
  };

  window.KlevbyFeedRender = renderer;

  window.renderProfileFeed = renderProfileFeed;
  window.profilePhotoCardHtml = profilePhotoCardHtml;

  setTimeout(loadFeedRenderStylesModule, 0);
})();
