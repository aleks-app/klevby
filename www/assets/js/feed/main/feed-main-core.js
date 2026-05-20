(function () {
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

  function isPageVisible() {
    return document.visibilityState !== "hidden";
  }

  function hasFeedDom() {
    return Boolean(document.getElementById("profileFeedSection"));
  }

  function isLikeUpdateAction(action) {
    const value = String(action || "").toLowerCase();

    return (
      value.includes("like") ||
      value.includes("лайк")
    );
  }

  function isStartupRefreshReason(reason) {
    const value = String(reason || "").toLowerCase();

    return (
      value.includes("initial") ||
      value.includes("module_ready") ||
      value.includes("dom_watch") ||
      value.includes("already_started") ||
      value.includes("render_wait")
    );
  }

  function isResumeRefreshReason(reason) {
    const value = String(reason || "").toLowerCase();

    return (
      value.includes("resume") ||
      value.includes("app_resumed") ||
      value.includes("visibility_visible") ||
      value.includes("page_show") ||
      value.includes("window_focus") ||
      value.includes("browser_online") ||
      value.includes("auth_changed")
    );
  }

  function isManualRefreshReason(reason) {
    const value = String(reason || "").toLowerCase();

    return (
      value.includes("manual") ||
      value.includes("wake") ||
      value.includes("navigation_home")
    );
  }

  function isCriticalRefreshReason(reason) {
    return (
      isManualRefreshReason(reason) ||
      isStartupRefreshReason(reason) ||
      isResumeRefreshReason(reason)
    );
  }

  function isDuplicateLikeError(error) {
    const code = String(error?.code || error?.details?.code || "").trim();
    const message = String(error?.message || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const constraint = String(error?.constraint || error?.details?.constraint || "").toLowerCase();

    return (
      code === "23505" ||
      message.includes("duplicate key") ||
      message.includes("feed_likes_unique_user_post") ||
      details.includes("feed_likes_unique_user_post") ||
      hint.includes("feed_likes_unique_user_post") ||
      constraint.includes("feed_likes_unique_user_post")
    );
  }

  window.KlevbyFeedMainCore = {
    getState,
    getUtils,
    getApi,
    getRender,
    getModals,
    getActions,
    getEvents,
    safeCall,
    isPageVisible,
    hasFeedDom,
    isLikeUpdateAction,
    isStartupRefreshReason,
    isResumeRefreshReason,
    isManualRefreshReason,
    isCriticalRefreshReason,
    isDuplicateLikeError
  };
})();
