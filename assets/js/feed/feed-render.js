(function () {
  let klevbyFeedRenderRetryTimer = null;
  let klevbyFeedRenderRetryCount = 0;

  const FEED_RENDER_RETRY_DELAYS = [300, 800, 1600, 3000, 5500, 9000];
  const FEED_RENDER_MAX_RETRIES = FEED_RENDER_RETRY_DELAYS.length;

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getStyles() {
    return window.KlevbyFeedRenderStyles || {};
  }

  function getCache() {
    return window.KlevbyFeedRenderCache || {};
  }

  function getRenderUtils() {
    return window.KlevbyFeedRenderUtils || {};
  }

  function getCards() {
    return window.KlevbyFeedRenderCards || {};
  }

  function getList() {
    return window.KlevbyFeedRenderList || {};
  }

  function setLastItems(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.setLastItems === "function") {
      renderUtils.setLastItems(items);
      return;
    }

    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
      return;
    }

    window.__klevbyFeedLastItems = safeItems;
  }

  function setItemsCacheFromArray(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.setItemsCacheFromArray === "function") {
      renderUtils.setItemsCacheFromArray(items);
      return;
    }

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
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getLastItems === "function") {
      const items = renderUtils.getLastItems();
      return Array.isArray(items) ? items : [];
    }

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

  function ensureFeedStyles() {
    const styles = getStyles();

    if (typeof styles.ensureFeedStyles === "function") {
      styles.ensureFeedStyles();
    }
  }

  function scheduleMobileFeedWidthLock(reason = "scheduled", delay = 0) {
    const styles = getStyles();

    if (typeof styles.scheduleMobileFeedWidthLock === "function") {
      styles.scheduleMobileFeedWidthLock(reason, delay);
    }
  }

  function runMobileFeedWidthLockBurst(reason = "burst") {
    const styles = getStyles();

    if (typeof styles.runMobileFeedWidthLockBurst === "function") {
      styles.runMobileFeedWidthLockBurst(reason);
    }
  }

  function cleanupLegacyFeedCache() {
    const cache = getCache();

    if (typeof cache.cleanupLegacyFeedCache === "function") {
      cache.cleanupLegacyFeedCache();
    }
  }

  function readFeedCache() {
    const cache = getCache();

    if (typeof cache.readFeedCache === "function") {
      const items = cache.readFeedCache();
      return Array.isArray(items) ? items : [];
    }

    return [];
  }

  function writeFeedCache(items) {
    const cache = getCache();

    if (typeof cache.writeFeedCache === "function") {
      cache.writeFeedCache(items);
    }
  }

  function getRenderableFeedItems(items) {
    const renderUtils = getRenderUtils();

    if (typeof renderUtils.getRenderableFeedItems === "function") {
      const renderableItems = renderUtils.getRenderableFeedItems(items);
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

  function setStaticListHtml(list, html, signature, source) {
    const listRenderer = getList();

    if (typeof listRenderer.setStaticListHtml === "function") {
      return listRenderer.setStaticListHtml(list, html, signature, source);
    }

    if (!list) return false;

    list.innerHTML = html;
    list.dataset.klevbyFeedSignature = String(signature || source || "static");
    list.dataset.klevbyFeedStructureSignature = String(signature || source || "static");
    list.dataset.klevbyFeedSource = String(source || "");

    scheduleMobileFeedWidthLock("static_html_fallback", 40);

    return true;
  }

  function renderFeedItems(list, items, source = "fresh") {
    const listRenderer = getList();

    if (typeof listRenderer.renderFeedItems === "function") {
      return listRenderer.renderFeedItems(list, items, source, {
        profilePhotoCardHtml,
        emptyHtml
      });
    }

    console.warn("Klevby feed render: list renderer is not ready");

    return false;
  }

  function profilePhotoCardHtml(item, index = 0) {
    const cards = getCards();

    if (typeof cards.profilePhotoCardHtml === "function") {
      return cards.profilePhotoCardHtml(item, index);
    }

    console.warn("Klevby feed render: card renderer is not ready");

    return "";
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
    renderFeedItems,
    renderProfileFeed,
    refreshFeedIfHomeVisible,
    getRenderableFeedItems
  };

  window.KlevbyFeedRender = renderer;

  window.renderProfileFeed = renderProfileFeed;
  window.profilePhotoCardHtml = profilePhotoCardHtml;
})();
