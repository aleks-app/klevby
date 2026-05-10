(function () {
  let klevbyFeedRenderRetryTimer = null;
  let klevbyFeedRenderRetryCount = 0;

  const FEED_RENDER_RETRY_DELAYS = [300, 800, 1600, 3000, 5500, 9000];
  const FEED_RENDER_MAX_RETRIES = FEED_RENDER_RETRY_DELAYS.length;

  function resetRenderRetry() {
    klevbyFeedRenderRetryCount = 0;

    if (klevbyFeedRenderRetryTimer) {
      clearTimeout(klevbyFeedRenderRetryTimer);
      klevbyFeedRenderRetryTimer = null;
    }
  }

  function scheduleRenderRetry(callback, reason = "retry", customDelay = null) {
    if (typeof callback !== "function") {
      return;
    }

    if (klevbyFeedRenderRetryCount >= FEED_RENDER_MAX_RETRIES) {
      return;
    }

    if (klevbyFeedRenderRetryTimer) {
      clearTimeout(klevbyFeedRenderRetryTimer);
      klevbyFeedRenderRetryTimer = null;
    }

    const delayIndex = Math.min(
      klevbyFeedRenderRetryCount,
      FEED_RENDER_RETRY_DELAYS.length - 1
    );

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

      callback();
    }, delay);
  }

  window.KlevbyFeedRenderRetry = {
    resetRenderRetry,
    scheduleRenderRetry
  };
})();
