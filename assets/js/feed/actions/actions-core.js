(function () {
  function getState() {
    return window.KlevbyFeedState || {};
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

  function getUtils() {
    return window.KlevbyFeedUtils || {};
  }

  function withSoftTimeout(promise, timeoutMs, fallbackValue = null, label = "operation") {
    const safeTimeout = Math.max(250, Number(timeoutMs || 0) || 0);
    let finished = false;
    let timer = null;

    return new Promise((resolve, reject) => {
      timer = window.setTimeout(() => {
        if (finished) return;

        finished = true;

        console.debug("Klevby feed actions: soft timeout", {
          label,
          timeoutMs: safeTimeout
        });

        resolve(fallbackValue);
      }, safeTimeout);

      Promise.resolve(promise)
        .then((value) => {
          if (finished) return;

          finished = true;

          if (timer) {
            window.clearTimeout(timer);
          }

          resolve(value);
        })
        .catch((error) => {
          if (finished) return;

          finished = true;

          if (timer) {
            window.clearTimeout(timer);
          }

          reject(error);
        });
    });
  }

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function getCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    if (typeof window.klevbyGetCurrentUser === "function") {
      return window.klevbyGetCurrentUser();
    }

    return null;
  }

  async function ensureCurrentUser() {
    let user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await window.restoreAuthState("feed_like_action", false);
      } catch (error) {
        console.debug("Klevby feed actions: restore auth skipped", {
          error: String(error?.message || error)
        });
      }
    }

    user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    return null;
  }

  function isHomeVisible() {
    const homeSection = document.getElementById("homeSection");

    return Boolean(homeSection && !homeSection.classList.contains("hidden"));
  }

  function renderFeed() {
    const renderer = getRender();

    if (typeof renderer.renderProfileFeed === "function") {
      return renderer.renderProfileFeed();
    }

    if (typeof window.renderProfileFeed === "function") {
      return window.renderProfileFeed();
    }

    return Promise.resolve();
  }

  function refreshFeedIfHomeVisible() {
    if (!isHomeVisible()) return Promise.resolve();

    return renderFeed();
  }

  function getLastItemsArray() {
    const state = getState();

    if (typeof state.getLastItems === "function") {
      const items = state.getLastItems();
      return Array.isArray(items) ? items : [];
    }

    return Array.isArray(window.__klevbyFeedLastItems)
      ? window.__klevbyFeedLastItems
      : [];
  }

  function setLastItemsArray(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const state = getState();

    if (typeof state.setLastItems === "function") {
      state.setLastItems(safeItems);
    } else {
      window.__klevbyFeedLastItems = safeItems;
    }

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

  function getCachedFeedItem(postId) {
    const cleanId = String(postId || "").trim();
    if (!cleanId) return null;

    const state = getState();

    if (typeof state.getCachedItem === "function") {
      const item = state.getCachedItem(cleanId);
      if (item) return item;
    }

    const items = getLastItemsArray();

    return items.find((item) => String(item?.id || "") === cleanId) || null;
  }

  window.KlevbyFeedActionsCore = {
    getState,
    getApi,
    getRender,
    getModals,
    getUtils,
    withSoftTimeout,
    getSupabaseClient,
    getCurrentUser,
    ensureCurrentUser,
    isHomeVisible,
    renderFeed,
    refreshFeedIfHomeVisible,
    getLastItemsArray,
    setLastItemsArray,
    getCachedFeedItem
  };
})();
