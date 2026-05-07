(function () {
  let klevbyFeedSoftRefreshTimer = null;
  let klevbyFeedSoftRefreshInProgress = false;
  let klevbyFeedSoftRefreshPending = false;
  let klevbyFeedSoftRefreshBound = false;
  let klevbyFeedSoftRefreshInterval = null;
  let klevbyFeedRealtimeFallbackStarted = false;
  let klevbyFeedLastSoftRefreshAt = 0;

  const KLEVB_FEED_SOFT_REFRESH_DELAY = 650;
  const KLEVB_FEED_SOFT_REFRESH_MIN_GAP = 900;
  const KLEVB_FEED_AUTO_REFRESH_MS = 25000;

  function getState() {
    return window.KlevbyFeedState || {};
  }

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function getApi() {
    return window.KlevbyFeedApi || {};
  }

  function getRender() {
    return window.KlevbyFeedRender || {};
  }

  function getModals() {
    return window.KlevbyFeedModals || {};
  }

  function getActions() {
    return window.KlevbyFeedActions || {};
  }

  function getEvents() {
    return window.KlevbyFeedEvents || {};
  }

  function safeCall(fn, args = [], fallbackValue = undefined) {
    try {
      if (typeof fn === "function") {
        return fn.apply(null, args);
      }
    } catch (error) {
      console.warn("Klevby feed: ошибка вызова функции", error);
    }

    return fallbackValue;
  }

  function isHomeFeedVisible() {
    const homeSection = document.getElementById("homeSection");
    const list = document.getElementById("profileFeedSection");

    return Boolean(
      homeSection &&
      list &&
      !homeSection.classList.contains("hidden")
    );
  }

  function isPageActive() {
    return document.visibilityState !== "hidden";
  }

  function openKlevbyProfileSafe() {
    const utils = getUtils();

    if (typeof utils.openKlevbyProfileSafe === "function") {
      return utils.openKlevbyProfileSafe();
    }

    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function renderProfileFeed() {
    const render = getRender();

    if (typeof render.renderProfileFeed === "function") {
      return render.renderProfileFeed();
    }

    const list = document.getElementById("profileFeedSection");

    if (list) {
      list.innerHTML = `
        <div class="home-empty-card">
          <div class="home-empty-icon">📸</div>
          <h3>Лента загружается</h3>
          <p>Модули ленты ещё подключаются. Обнови страницу через пару секунд.</p>
        </div>
      `;
    }

    return Promise.resolve();
  }

  function refreshFeedIfHomeVisible() {
    const render = getRender();

    if (typeof render.refreshFeedIfHomeVisible === "function") {
      return render.refreshFeedIfHomeVisible();
    }

    if (isHomeFeedVisible()) {
      return renderProfileFeed();
    }

    return Promise.resolve();
  }

  function scheduleSoftFeedRefresh(reason = "manual", options = {}) {
    const delay = Number.isFinite(Number(options.delay))
      ? Math.max(0, Number(options.delay))
      : KLEVB_FEED_SOFT_REFRESH_DELAY;

    const force = Boolean(options.force);

    clearTimeout(klevbyFeedSoftRefreshTimer);

    klevbyFeedSoftRefreshTimer = setTimeout(() => {
      softRefreshFeed(reason, {
        force
      });
    }, delay);
  }

  async function softRefreshFeed(reason = "manual", options = {}) {
    const force = Boolean(options.force);

    if (!force) {
      if (!isPageActive()) {
        return false;
      }

      if (!isHomeFeedVisible()) {
        return false;
      }
    }

    const now = Date.now();
    const timeFromLastRefresh = now - klevbyFeedLastSoftRefreshAt;

    if (!force && timeFromLastRefresh < KLEVB_FEED_SOFT_REFRESH_MIN_GAP) {
      scheduleSoftFeedRefresh(reason, {
        delay: KLEVB_FEED_SOFT_REFRESH_MIN_GAP - timeFromLastRefresh + 80,
        force
      });

      return false;
    }

    if (klevbyFeedSoftRefreshInProgress) {
      klevbyFeedSoftRefreshPending = true;
      return false;
    }

    klevbyFeedSoftRefreshInProgress = true;
    klevbyFeedLastSoftRefreshAt = Date.now();

    try {
      await Promise.resolve(renderProfileFeed());

      window.dispatchEvent(new CustomEvent("klevby-feed-soft-refreshed", {
        detail: {
          reason,
          at: new Date().toISOString()
        }
      }));

      return true;
    } catch (error) {
      console.warn("Klevby feed: мягкое обновление ленты не сработало", error);
      return false;
    } finally {
      klevbyFeedSoftRefreshInProgress = false;

      if (klevbyFeedSoftRefreshPending) {
        klevbyFeedSoftRefreshPending = false;

        scheduleSoftFeedRefresh("pending_after_" + reason, {
          delay: 500,
          force
        });
      }
    }
  }

  function bindSoftFeedRefreshHooks() {
    if (klevbyFeedSoftRefreshBound) return;

    klevbyFeedSoftRefreshBound = true;

    window.addEventListener("klevby-feed-updated", (event) => {
      const action = event?.detail?.action || "feed_updated";

      scheduleSoftFeedRefresh(action, {
        delay: 550
      });
    });

    window.addEventListener("klevby-feed-module-ready", () => {
      scheduleSoftFeedRefresh("module_ready", {
        delay: 700
      });
    });

    window.addEventListener("focus", () => {
      scheduleSoftFeedRefresh("window_focus", {
        delay: 250
      });
    });

    window.addEventListener("online", () => {
      scheduleSoftFeedRefresh("browser_online", {
        delay: 350
      });
    });

    window.addEventListener("pageshow", () => {
      scheduleSoftFeedRefresh("page_show", {
        delay: 350
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleSoftFeedRefresh("visibility_visible", {
          delay: 300
        });
      }
    });
  }

  function startSoftFeedAutoRefresh() {
    if (klevbyFeedSoftRefreshInterval) return;

    klevbyFeedSoftRefreshInterval = setInterval(() => {
      scheduleSoftFeedRefresh("soft_auto_interval", {
        delay: 0
      });
    }, KLEVB_FEED_AUTO_REFRESH_MS);
  }

  function stopSoftFeedAutoRefresh() {
    if (!klevbyFeedSoftRefreshInterval) return;

    clearInterval(klevbyFeedSoftRefreshInterval);
    klevbyFeedSoftRefreshInterval = null;
  }

  function startRealtimeFallbackSubscription() {
    if (klevbyFeedRealtimeFallbackStarted) return;

    const api = getApi();

    if (typeof api.subscribeToFeedChanges !== "function") {
      return;
    }

    klevbyFeedRealtimeFallbackStarted = true;

    try {
      api.subscribeToFeedChanges((payload) => {
        const table =
          payload?.table ||
          payload?.schema ||
          payload?.new?.id ||
          payload?.old?.id ||
          "supabase_realtime";

        scheduleSoftFeedRefresh("realtime_" + table, {
          delay: 500
        });
      });
    } catch (error) {
      klevbyFeedRealtimeFallbackStarted = false;
      console.warn("Klevby feed: fallback realtime не подключился", error);
    }
  }

  function getProfileFeedItemsSafe() {
    const render = getRender();
    const utils = getUtils();

    if (typeof render.getProfileFeedItemsSafe === "function") {
      return render.getProfileFeedItemsSafe();
    }

    if (typeof utils.getProfileFeedItemsSafe === "function") {
      return utils.getProfileFeedItemsSafe();
    }

    try {
      if (typeof window.getProfileFeedItems === "function") {
        const items = window.getProfileFeedItems();
        return Array.isArray(items) ? items : [];
      }
    } catch (error) {
      console.warn("Klevby feed: не удалось получить фото профиля", error);
    }

    return [];
  }

  function getFilteredProfileFeedItems(options = {}) {
    const render = getRender();
    const utils = getUtils();

    if (typeof render.getFilteredProfileFeedItems === "function") {
      return render.getFilteredProfileFeedItems(options);
    }

    if (typeof utils.getFilteredProfileFeedItems === "function") {
      return utils.getFilteredProfileFeedItems(options);
    }

    return getProfileFeedItemsSafe();
  }

  function profilePhotoCardHtml(item) {
    const render = getRender();

    if (typeof render.profilePhotoCardHtml === "function") {
      return render.profilePhotoCardHtml(item);
    }

    return "";
  }

  function openProfilePhotoFeedItem(postId) {
    const modals = getModals();
    const actions = getActions();

    if (typeof modals.openProfilePhotoFeedItem === "function") {
      return modals.openProfilePhotoFeedItem(postId);
    }

    if (typeof actions.openProfilePhotoFeedItem === "function") {
      return actions.openProfilePhotoFeedItem(postId);
    }

    if (typeof window.openProfilePhotoViewer === "function") {
      return window.openProfilePhotoViewer(postId);
    }

    return openKlevbyProfileSafe();
  }

  function closeFeedPhotoViewer() {
    const modals = getModals();

    if (typeof modals.closeFeedPhotoViewer === "function") {
      return modals.closeFeedPhotoViewer();
    }

    const viewer = document.getElementById("klevbyFeedPhotoViewer");
    const image = document.getElementById("klevbyFeedPhotoViewerImage");

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    document.body.classList.remove("post-modal-open");
  }

  function openFeedCommentModal(postId) {
    const modals = getModals();

    if (typeof modals.openFeedCommentModal === "function") {
      return modals.openFeedCommentModal(postId);
    }

    alert("Комментарии ещё загружаются. Обнови страницу и попробуй ещё раз.");
    return undefined;
  }

  function closeFeedCommentModal() {
    const modals = getModals();

    if (typeof modals.closeFeedCommentModal === "function") {
      return modals.closeFeedCommentModal();
    }

    const modal = document.getElementById("klevbyFeedCommentModal");

    if (modal) {
      modal.classList.add("hidden");
      modal.dataset.postId = "";
    }

    document.body.classList.remove("post-modal-open");
  }

  function submitFeedComment() {
    const actions = getActions();
    const modals = getModals();

    if (typeof actions.submitFeedComment === "function") {
      return actions.submitFeedComment();
    }

    if (typeof modals.submitFeedComment === "function") {
      return modals.submitFeedComment();
    }

    alert("Отправка комментариев ещё не подключена.");
    return Promise.resolve();
  }

  function deleteFeedComment(commentId) {
    const actions = getActions();
    const modals = getModals();

    if (typeof actions.deleteFeedComment === "function") {
      return actions.deleteFeedComment(commentId);
    }

    if (typeof modals.deleteFeedComment === "function") {
      return modals.deleteFeedComment(commentId);
    }

    alert("Удаление комментариев ещё не подключено.");
    return Promise.resolve();
  }

  function toggleFeedLike(postId) {
    const actions = getActions();

    if (typeof actions.toggleFeedLikeFromCard === "function") {
      return actions.toggleFeedLikeFromCard(postId);
    }

    if (typeof actions.toggleFeedLike === "function") {
      return actions.toggleFeedLike(postId);
    }

    if (typeof window.klevbyToggleFeedLike === "function") {
      return window.klevbyToggleFeedLike(postId)
        .then(() => scheduleSoftFeedRefresh("like_clicked", {
          delay: 350,
          force: true
        }))
        .catch((error) => {
          console.warn("Klevby feed: лайк не сработал", error);
          alert(error?.message || "Не получилось поставить лайк.");
        });
    }

    alert("Лайки ещё не подключены.");
    return Promise.resolve();
  }

  function exposeLegacyGlobals() {
    window.getProfileFeedItemsSafe = getProfileFeedItemsSafe;
    window.getFilteredProfileFeedItems = getFilteredProfileFeedItems;
    window.openKlevbyProfileSafe = openKlevbyProfileSafe;
    window.openProfilePhotoFeedItem = openProfilePhotoFeedItem;
    window.renderProfileFeed = renderProfileFeed;
    window.profilePhotoCardHtml = profilePhotoCardHtml;
    window.toggleFeedLike = toggleFeedLike;
    window.closeFeedPhotoViewer = closeFeedPhotoViewer;
    window.openFeedCommentModal = openFeedCommentModal;
    window.closeFeedCommentModal = closeFeedCommentModal;
    window.submitFeedComment = submitFeedComment;
    window.deleteFeedComment = deleteFeedComment;

    window.klevbySoftRefreshFeed = softRefreshFeed;
    window.klevbyScheduleSoftFeedRefresh = scheduleSoftFeedRefresh;
    window.refreshKlevbyFeedSilently = function refreshKlevbyFeedSilently() {
      return softRefreshFeed("manual_global", {
        force: true
      });
    };
  }

  function warmUpModules() {
    const utils = getUtils();
    const render = getRender();
    const events = getEvents();

    safeCall(utils.ensureFeedStyles);
    safeCall(render.ensureFeedStyles);

    if (typeof events.bindFeedRefreshHooks === "function") {
      events.bindFeedRefreshHooks();
    }

    if (typeof events.startFeedAutoRefresh === "function") {
      events.startFeedAutoRefresh();
    }

    bindSoftFeedRefreshHooks();
    startSoftFeedAutoRefresh();
  }

  function startRealtimeLater() {
    const events = getEvents();

    if (typeof events.tryStartRealtimeSubscription === "function") {
      setTimeout(events.tryStartRealtimeSubscription, 1200);
      setTimeout(events.tryStartRealtimeSubscription, 2600);
      setTimeout(events.tryStartRealtimeSubscription, 5000);
    }

    setTimeout(startRealtimeFallbackSubscription, 1600);
    setTimeout(startRealtimeFallbackSubscription, 3200);
    setTimeout(startRealtimeFallbackSubscription, 5800);
  }

  function renderLater() {
    setTimeout(renderProfileFeed, 350);
    setTimeout(refreshFeedIfHomeVisible, 900);
    setTimeout(refreshFeedIfHomeVisible, 1600);

    setTimeout(() => {
      scheduleSoftFeedRefresh("initial_soft_refresh", {
        delay: 300,
        force: true
      });
    }, 2200);
  }

  function initKlevbyFeed() {
    if (window.__klevbyFeedModularStarted) return;

    window.__klevbyFeedModularStarted = true;

    exposeLegacyGlobals();
    warmUpModules();
    renderLater();
    startRealtimeLater();

    window.dispatchEvent(new CustomEvent("klevby-feed-module-ready", {
      detail: {
        version: "20260507-feed-soft-refresh-1"
      }
    }));

    console.log("Klevby feed main soft refresh loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKlevbyFeed);
  } else {
    setTimeout(initKlevbyFeed, 0);
  }

  window.KlevbyFeedMain = {
    init: initKlevbyFeed,
    exposeLegacyGlobals,
    renderProfileFeed,
    refreshFeedIfHomeVisible,
    softRefreshFeed,
    scheduleSoftFeedRefresh,
    startSoftFeedAutoRefresh,
    stopSoftFeedAutoRefresh,
    openKlevbyProfileSafe,
    openProfilePhotoFeedItem,
    openFeedCommentModal,
    closeFeedPhotoViewer,
    closeFeedCommentModal,
    submitFeedComment,
    deleteFeedComment,
    toggleFeedLike
  };
})();
